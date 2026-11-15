import Dexie, { type Table } from 'dexie';
import type { RecordOf, SyncedTable } from '@/domain/schemas';
import { buildSeed } from '@/domain/seed';

export interface OutboxEntry {
  seq?: number;
  record_table: SyncedTable;
  record_id: string;
  version: number;
  op: 'upsert' | 'delete';
  payload: unknown;
  queued_at: string;
}

export interface PhotoBlob {
  key: string;
  blob: Blob;
}

export interface ConflictEntry {
  id: string;
  record_table: SyncedTable;
  record_id: string;
  losing: unknown;
  detected_at: string;
}

/** Device-local key/value data that never syncs (device id, ref block, sync cursor…). */
export interface MetaEntry {
  key: string;
  value: unknown;
}

type SyncedTables = { [T in SyncedTable]: Table<RecordOf<T>, string> };

export class R35DB extends Dexie {
  outbox!: Table<OutboxEntry, number>;
  photo_blobs!: Table<PhotoBlob, string>;
  conflicts!: Table<ConflictEntry, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'r35-log') {
    super(name);
    this.version(1).stores({
      vehicle: 'id',
      groups: 'id, &code, sort',
      sections: 'id, &code, group_code, sort',
      vendors: 'id, name',
      settings: 'id',
      issues: 'id, &ref_no, kind, status, group_code, date_identified, legacy_entry_no',
      steps: 'id, issue_id, date, legacy_entry_no',
      serviceItems: 'id, sort',
      serviceRecords: 'id, date, linked_issue_id',
      partLines: 'id, parent_id, order_status',
      installedParts: 'id, part_line_id, replaces_installed_part_id',
      photos: 'id, parent_id',
      shortlists: 'id, created_date',
      odometerReadings: 'id, date, source_id',
      outbox: '++seq, record_table, record_id',
      photo_blobs: 'key',
      conflicts: 'id, record_table, record_id',
      meta: 'key',
    });

    // First launch: write the seed data. Seed rows are version 1 with deterministic ids
    // and are not queued — any later edit pushes the whole row.
    this.on('populate', (tx) => {
      const seed = buildSeed();
      for (const [table, rows] of Object.entries(seed)) {
        tx.table(table).bulkAdd(rows);
      }
    });
  }
}

export interface R35DB extends SyncedTables {}

export const db = new R35DB();
