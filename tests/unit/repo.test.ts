import { beforeEach, describe, expect, it } from 'vitest';
import { R35DB } from '@/db/db';
import { create, ensureDevice, remove, update, useDatabase } from '@/db/repo';
import { changeStatus, createIssue, saveStep } from '@/db/actions';
import type { IssueFields } from '@/db/actions';
import { emptySymptom } from '@/domain/schemas';

let db: R35DB;
let n = 0;
beforeEach(async () => {
  db = new R35DB(`test-${n++}`);
  useDatabase(db);
  await ensureDevice();
});

const issueFields = (over: Partial<IssueFields> = {}): IssueFields => ({
  kind: 'defect',
  title: 'Shudder',
  description: '',
  date_identified: '2026-11-15',
  odo_identified: 80000,
  group_code: 'D',
  section_code: 'TM',
  severity: 'Drivability',
  status: 'Open',
  how_found: 'Driver',
  found_by_vendor_id: null,
  symptom: emptySymptom(),
  dtcs: [],
  deferred_reason: '',
  closed_date: null,
  closed_odo: null,
  closing_note: '',
  legacy_entry_no: null,
  ...over,
});

describe('local store', () => {
  it('seeds on first open: 17 groups, 54 sections, vehicle, purchase odometer', async () => {
    expect(await db.groups.count()).toBe(17);
    expect(await db.sections.count()).toBe(54);
    expect((await db.vehicle.toArray())[0].model_code).toBe('CBA-R35');
    expect(await db.odometerReadings.count()).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it('create/update/remove bump version and queue outbox entries in order', async () => {
    const v = await create('vendors', { name: 'Test Garage', kind: 'Workshop', phone: '', email: '', address: '', notes: '', review_flag: '' });
    expect(v.version).toBe(1);
    const u = await update('vendors', v.id, { phone: '0400 000 000' });
    expect(u.version).toBe(2);
    await remove('vendors', v.id);
    const stored = await db.vendors.get(v.id);
    expect(stored).toMatchObject({ deleted: true, version: 3 });
    const out = await db.outbox.toArray();
    expect(out.map((o) => [o.op, o.version])).toEqual([
      ['upsert', 1],
      ['upsert', 2],
      ['delete', 3],
    ]);
  });

  it('rejects invalid records and writes nothing', async () => {
    await expect(create('vendors', { name: '', kind: 'Workshop', phone: '', email: '', address: '', notes: '', review_flag: '' })).rejects.toThrow();
    expect(await db.outbox.count()).toBe(0);
  });

  it('creates issues with refs from the device block and an odometer reading', async () => {
    const a = await createIssue(issueFields());
    const b = await createIssue(issueFields({ kind: 'job', severity: null, how_found: null }));
    expect([a.ref_no, b.ref_no]).toEqual([1000, 1001]);
    const readings = await db.odometerReadings.where('source_id').equals(a.id).toArray();
    expect(readings[0]).toMatchObject({ km: 80000, source: 'issues' });
  });

  it('adding a step with part lines moves Open to In progress; editing drops removed lines', async () => {
    const issue = await createIssue(issueFields());
    const line = {
      part_name: 'Seal',
      part_number: '38342-JF00A',
      brand: 'Nissan',
      qty: 1,
      cost: 45.5,
      currency: 'AUD',
      order_status: 'Ordered' as const,
      fitted: false,
      position: '',
    };
    const step = await saveStep(
      issue.id,
      null,
      {
        date: '2026-11-16',
        odo: 80100,
        step_type: 'Parts Order',
        vendor_id: null,
        details: 'Ordered seal',
        comments: '',
        outcome: null,
        severe_use: false,
        legacy_entry_no: null,
      },
      [line, { ...line, part_name: 'Circlip', cost: 1200, currency: 'JPY' }],
    );
    expect((await db.issues.get(issue.id))!.status).toBe('In progress');
    const lines = await db.partLines.where('parent_id').equals(step.id).toArray();
    expect(lines).toHaveLength(2);
    await saveStep(
      issue.id,
      step.id,
      {
        date: '2026-11-16',
        odo: 80100,
        step_type: 'Parts Order',
        vendor_id: null,
        details: 'Ordered seal only',
        comments: '',
        outcome: null,
        severe_use: false,
        legacy_entry_no: null,
      },
      [{ ...line, id: lines[0].id }],
    );
    const after = (await db.partLines.where('parent_id').equals(step.id).toArray()).filter((l) => !l.deleted);
    expect(after.map((l) => l.part_name)).toEqual(['Seal']);
  });

  it('status change rules are enforced on write', async () => {
    const issue = await createIssue(issueFields());
    await expect(changeStatus(issue.id, { status: 'Deferred', reason: '', date: '2026-11-15', odo: null })).rejects.toThrow(/reason/);
    const closed = await changeStatus(issue.id, { status: 'Closed', note: 'Fixed by seal', date: '2026-11-20', odo: 80500 });
    expect(closed).toMatchObject({ status: 'Closed', closed_date: '2026-11-20', closed_odo: 80500 });
  });
});
