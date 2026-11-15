// Multi-record operations used by the screens. Each runs in one transaction.
import { newId } from '@/domain/ids';
import { applyStatusChange, nextSeq, statusAfterStepAdded, type StatusChange } from '@/domain/issues';
import { nextRefNo } from '@/domain/refs';
import type { Issue, PartLine, Photo, Step, SyncColumns } from '@/domain/schemas';
import { create, ensureDevice, getDb, inTx, remove, update } from './repo';

export type IssueFields = Omit<Issue, keyof SyncColumns | 'ref_no'>;
export type StepFields = Omit<Step, keyof SyncColumns | 'issue_id' | 'seq'>;
export type PartLineFields = Omit<PartLine, keyof SyncColumns | 'parent_type' | 'parent_id' | 'sort'> & { id?: string };

/** A photo already resized on the device, waiting to be written. */
export interface ProcessedPhoto {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  thumb: string;
  taken_at: string;
  caption: string;
}

/** Keeps exactly one Odometer Reading per source record in step with its date/km. */
async function syncOdometer(source: string, sourceId: string, date: string, km: number | null) {
  const db = getDb();
  const existing = (await db.odometerReadings.where('source_id').equals(sourceId).toArray()).filter((r) => !r.deleted);
  const current = existing[0];
  if (km == null) {
    for (const r of existing) await remove('odometerReadings', r.id);
    return;
  }
  if (current) {
    if (current.km !== km || current.date !== date) await update('odometerReadings', current.id, { km, date });
  } else {
    await create('odometerReadings', { date, km, source, source_id: sourceId });
  }
}

export async function allocateRefNo(): Promise<number> {
  const dev = await ensureDevice();
  const used = (await getDb().issues.toArray()).map((i) => i.ref_no);
  return nextRefNo(used, dev.block);
}

export async function addPhotos(parentType: Photo['parent_type'], parentId: string, photos: ProcessedPhoto[]) {
  const db = getDb();
  await inTx(async () => {
    for (const p of photos) {
      const id = newId();
      const key = `photo:${id}`;
      await db.photo_blobs.put({ key, blob: p.blob });
      await create('photos', {
        id,
        parent_type: parentType,
        parent_id: parentId,
        caption: p.caption,
        taken_at: p.taken_at,
        width: p.width,
        height: p.height,
        bytes: p.bytes,
        local_blob_key: key,
        remote_path: null,
        upload_state: 'Pending',
        thumb: p.thumb,
      });
    }
  });
}

export async function createIssue(fields: IssueFields, photos: ProcessedPhoto[] = []): Promise<Issue> {
  await ensureDevice();
  return inTx(async () => {
    const refNo = await allocateRefNo();
    const issue = await create('issues', { ...fields, ref_no: refNo });
    await syncOdometer('issues', issue.id, issue.date_identified, issue.odo_identified);
    if (photos.length) await addPhotos('issue', issue.id, photos);
    return issue;
  });
}

export async function updateIssue(id: string, fields: Partial<IssueFields>): Promise<Issue> {
  return inTx(async () => {
    const issue = await update('issues', id, fields);
    await syncOdometer('issues', issue.id, issue.date_identified, issue.odo_identified);
    return issue;
  });
}

export async function changeStatus(id: string, change: StatusChange): Promise<Issue> {
  return update('issues', id, applyStatusChange(change));
}

export async function deleteIssue(id: string): Promise<void> {
  const db = getDb();
  await inTx(async () => {
    const steps = await db.steps.where('issue_id').equals(id).toArray();
    for (const s of steps) await deleteStep(s.id);
    for (const p of await db.photos.where('parent_id').equals(id).toArray()) await remove('photos', p.id);
    for (const r of await db.odometerReadings.where('source_id').equals(id).toArray()) await remove('odometerReadings', r.id);
    await remove('issues', id);
  });
}

/**
 * Creates or updates a step with its part lines. Part lines missing from `lines`
 * (by id) are soft-deleted. Adding the first step to an Open issue moves it to In progress.
 */
export async function saveStep(
  issueId: string,
  stepId: string | null,
  fields: StepFields,
  lines: PartLineFields[],
  photos: ProcessedPhoto[] = [],
): Promise<Step> {
  const db = getDb();
  return inTx(async () => {
    let step: Step;
    if (stepId) {
      step = await update('steps', stepId, fields);
    } else {
      const siblings = (await db.steps.where('issue_id').equals(issueId).toArray()).filter((s) => !s.deleted);
      step = await create('steps', { ...fields, issue_id: issueId, seq: nextSeq(siblings) });
      const issue = await db.issues.get(issueId);
      if (issue) {
        const next = statusAfterStepAdded(issue.status);
        if (next !== issue.status) await update('issues', issueId, { status: next });
      }
    }
    await syncOdometer('steps', step.id, step.date, step.odo);

    const existing = (await db.partLines.where('parent_id').equals(step.id).toArray()).filter((l) => !l.deleted);
    const keep = new Set(lines.map((l) => l.id).filter(Boolean));
    for (const old of existing) if (!keep.has(old.id)) await remove('partLines', old.id);
    for (const [i, line] of lines.entries()) {
      const { id, ...rest } = line;
      const data = { ...rest, parent_type: 'step' as const, parent_id: step.id, sort: i };
      if (id && existing.some((e) => e.id === id)) await update('partLines', id, data);
      else await create('partLines', data);
    }
    if (photos.length) await addPhotos('step', step.id, photos);
    return step;
  });
}

export async function deleteStep(id: string): Promise<void> {
  const db = getDb();
  await inTx(async () => {
    for (const l of await db.partLines.where('parent_id').equals(id).toArray()) await remove('partLines', l.id);
    for (const p of await db.photos.where('parent_id').equals(id).toArray()) await remove('photos', p.id);
    for (const r of await db.odometerReadings.where('source_id').equals(id).toArray()) await remove('odometerReadings', r.id);
    await remove('steps', id);
  });
}

export async function deletePhoto(id: string): Promise<void> {
  await remove('photos', id);
}
