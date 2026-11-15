// The only way the app writes synced data. Each write updates the record locally
// (version + 1, updated_by_device) and appends an outbox entry in the same transaction.
import { newId } from '@/domain/ids';
import { TABLE_SCHEMAS, SYNCED_TABLES, type RecordOf, type SyncColumns, type SyncedTable } from '@/domain/schemas';
import { db as defaultDb, type R35DB } from './db';

export interface DeviceInfo {
  id: string;
  /** Ref block: device 1 issues refs 1000–1999, device 2 2000–2999… Assigned by the server once sync exists. */
  block: number;
}

let device: DeviceInfo | null = null;
let database: R35DB = defaultDb;

/** For tests: point the repo at another database. */
export function useDatabase(d: R35DB) {
  database = d;
  device = null;
}

export function getDb(): R35DB {
  return database;
}

/** Loads (or creates) this device's identity. Call once before the first write. */
export async function ensureDevice(): Promise<DeviceInfo> {
  if (device) return device;
  const existing = await database.meta.get('device');
  if (existing) {
    device = existing.value as DeviceInfo;
  } else {
    device = { id: newId(), block: 1 };
    await database.meta.put({ key: 'device', value: device });
  }
  return device;
}

function currentDevice(): DeviceInfo {
  if (!device) throw new Error('ensureDevice() must run before writing');
  return device;
}

type Fields<T extends SyncedTable> = Omit<RecordOf<T>, keyof SyncColumns> & { id?: string };

const nowIso = () => new Date().toISOString();

/** Runs fn in one read-write transaction over every synced table, the outbox, meta and photo blobs. */
export function inTx<R>(fn: () => Promise<R>): Promise<R> {
  const d = database;
  return d.transaction('rw', [...SYNCED_TABLES.map((t) => d.table(t)), d.outbox, d.meta, d.photo_blobs], fn);
}

async function enqueue(table: SyncedTable, record: RecordOf<SyncedTable>, op: 'upsert' | 'delete') {
  await database.outbox.add({
    record_table: table,
    record_id: record.id,
    version: record.version,
    op,
    payload: record,
    queued_at: nowIso(),
  });
}

export async function create<T extends SyncedTable>(table: T, fields: Fields<T>): Promise<RecordOf<T>> {
  const dev = currentDevice();
  const record = TABLE_SCHEMAS[table].parse({
    ...fields,
    id: fields.id ?? newId(),
    created_at: nowIso(),
    updated_at: null,
    updated_by_device: dev.id,
    deleted: false,
    version: 1,
  }) as RecordOf<T>;
  return inTx(async () => {
    await database.table(table).add(record);
    await enqueue(table, record, 'upsert');
    return record;
  });
}

export async function update<T extends SyncedTable>(table: T, id: string, patch: Partial<Fields<T>>): Promise<RecordOf<T>> {
  const dev = currentDevice();
  return inTx(async () => {
    const existing = (await database.table(table).get(id)) as RecordOf<T> | undefined;
    if (!existing) throw new Error(`${table} ${id} not found`);
    const record = TABLE_SCHEMAS[table].parse({
      ...existing,
      ...patch,
      id,
      created_at: existing.created_at,
      updated_at: existing.updated_at,
      updated_by_device: dev.id,
      deleted: existing.deleted,
      version: existing.version + 1,
    }) as RecordOf<T>;
    await database.table(table).put(record);
    await enqueue(table, record, 'upsert');
    return record;
  });
}

/** Soft delete: sets deleted = true so the delete syncs. */
export async function remove(table: SyncedTable, id: string): Promise<void> {
  const dev = currentDevice();
  await inTx(async () => {
    const existing = (await database.table(table).get(id)) as RecordOf<SyncedTable> | undefined;
    if (!existing || existing.deleted) return;
    const record = { ...existing, deleted: true, version: existing.version + 1, updated_by_device: dev.id };
    await database.table(table).put(record);
    await enqueue(table, record, 'delete');
  });
}

/** Rows that are not soft-deleted. */
export function live<T extends { deleted: boolean }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deleted);
}
