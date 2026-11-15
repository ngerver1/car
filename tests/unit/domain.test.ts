import { describe, expect, it } from 'vitest';
import { addMonths, daysBetween, todayISO } from '@/domain/dates';
import { formatRef } from '@/domain/format';
import {
  applyStatusChange,
  daysOpen,
  issueMatches,
  nextSeq,
  sortSteps,
  statusAfterStepAdded,
  statusChangeError,
  symptomSummary,
  totalsByCurrency,
} from '@/domain/issues';
import { currentOdometer, kmPerYear, odometerWarning } from '@/domain/odometer';
import { blockRange, nextRefNo } from '@/domain/refs';
import { dtcSchema, emptySymptom, type Issue, type Step } from '@/domain/schemas';

describe('refs', () => {
  it('formats with kind prefix and four digits', () => {
    expect(formatRef('defect', 9)).toBe('D-0009');
    expect(formatRef('job', 10)).toBe('J-0010');
    expect(formatRef('defect', 1068)).toBe('D-1068');
  });
  it('allocates within the device block, ignoring imported numbers', () => {
    expect(blockRange(1)).toEqual([1000, 1999]);
    expect(nextRefNo([2, 9, 67], 1)).toBe(1000);
    expect(nextRefNo([2, 1000, 1001, 2005], 1)).toBe(1002);
    expect(nextRefNo([1000, 1500], 2)).toBe(2000);
  });
  it('refuses a full block', () => {
    expect(() => nextRefNo([1999], 1)).toThrow(/full/);
  });
});

describe('status rules', () => {
  it('Deferred needs a reason, Closed needs a note', () => {
    expect(statusChangeError({ status: 'Deferred', reason: '  ', date: '2026-11-15', odo: null })).toMatch(/reason/);
    expect(statusChangeError({ status: 'Closed', note: '', date: '2026-11-15', odo: null })).toMatch(/closing note/);
    expect(() => applyStatusChange({ status: 'Closed', note: '', date: '2026-11-15', odo: null })).toThrow();
  });
  it('closing stores date and km', () => {
    expect(applyStatusChange({ status: 'Closed', note: 'Replaced seal', date: '2026-11-15', odo: 80000 })).toEqual({
      status: 'Closed',
      closing_note: 'Replaced seal',
      closed_date: '2026-11-15',
      closed_odo: 80000,
    });
  });
  it('reopening clears the closed date', () => {
    expect(applyStatusChange({ status: 'In progress' })).toMatchObject({ status: 'In progress', closed_date: null });
  });
  it('first step moves Open to In progress only', () => {
    expect(statusAfterStepAdded('Open')).toBe('In progress');
    expect(statusAfterStepAdded('Deferred')).toBe('Deferred');
  });
});

describe('totals by currency', () => {
  it('groups by currency and never sums across them', () => {
    const lines = [
      { cost: 10.1, qty: 2, currency: 'AUD', deleted: false },
      { cost: 0.2, qty: 1, currency: 'AUD', deleted: false },
      { cost: 5000, qty: 1, currency: 'JPY', deleted: false },
      { cost: 99, qty: 1, currency: 'AUD', deleted: true },
      { cost: null, qty: 1, currency: 'USD', deleted: false },
    ];
    expect(totalsByCurrency(lines)).toEqual([
      { currency: 'AUD', amount: 20.4 },
      { currency: 'JPY', amount: 5000 },
    ]);
  });
});

describe('odometer', () => {
  const r = (date: string, km: number) => ({ date, km, deleted: false, source_id: null });
  it('current = latest by date, highest km on ties', () => {
    expect(currentOdometer([r('2026-03-25', 74689), r('2026-07-30', 76233), r('2026-07-30', 76300), r('2026-05-01', 75000)])?.km).toBe(76300);
  });
  it('warns when lower than the previous reading', () => {
    const rs = [r('2026-03-25', 74689), r('2026-07-30', 76233)];
    expect(odometerWarning(rs, '2026-08-01', 76000)).toMatch(/lower than the previous reading of 76,233/);
    expect(odometerWarning(rs, '2026-08-01', 76500)).toBeNull();
    expect(odometerWarning(rs, '2026-05-01', 75000)).toBeNull();
    expect(odometerWarning(rs, '2026-08-01', null)).toBeNull();
  });
  it('km per year', () => {
    expect(kmPerYear(76233, 74689, 127)).toBeCloseTo(4437.48, 1);
    expect(kmPerYear(1, 0, 0)).toBeNull();
  });
});

describe('dates', () => {
  it('adds months with end-of-month clamping', () => {
    expect(addMonths('2026-03-25', 12)).toBe('2027-03-25');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
  it('days between and today in Brisbane', () => {
    expect(daysBetween('2026-03-25', '2026-11-15')).toBe(235);
    // 2026-11-14T15:00Z is 1am on the 15th in Brisbane (UTC+10, no DST).
    expect(todayISO('Australia/Brisbane', new Date('2026-11-14T15:00:00Z'))).toBe('2026-11-15');
  });
});

describe('issues', () => {
  const issue = {
    kind: 'defect',
    ref_no: 65,
    title: 'Shudder 1st/2nd',
    description: 'At low rpm',
    closing_note: '',
    deferred_reason: '',
    dtcs: [{ code: 'P0300', module: 'ECM', status: 'Current', date_read: null }],
    symptom: null,
    date_identified: '2026-10-01',
    closed_date: null,
    status: 'Open',
  } as unknown as Issue;
  const steps = [{ details: 'Checked clutch learn', comments: 'TCM reflash suggested' }] as Step[];
  it('searches title, DTCs and step text, all words', () => {
    expect(issueMatches(issue, steps, 'shudder')).toBe(true);
    expect(issueMatches(issue, steps, 'p0300')).toBe(true);
    expect(issueMatches(issue, steps, 'reflash clutch')).toBe(true);
    expect(issueMatches(issue, steps, 'reflash brakes')).toBe(false);
    expect(issueMatches(issue, steps, 'D-0065')).toBe(true);
  });
  it('days open', () => {
    expect(daysOpen(issue, '2026-11-15')).toBe(45);
    expect(daysOpen({ ...issue, status: 'Closed', closed_date: '2026-10-11' }, '2026-11-15')).toBe(10);
  });
  it('symptom summary', () => {
    expect(symptomSummary({ ...emptySymptom(), rpm_from: 1200, rpm_to: 1300, gears: ['1', '2'], load: ['Accel'] })).toBe('1200–1300 rpm, gear 1/2, accel');
  });
  it('validates and normalises DTC codes', () => {
    expect(dtcSchema.parse({ code: ' p0300 ', module: 'ECM', status: 'Current', date_read: null }).code).toBe('P0300');
    expect(() => dtcSchema.parse({ code: 'XYZ', module: 'ECM', status: 'Current', date_read: null })).toThrow();
  });
  it('step ordering', () => {
    expect(nextSeq([{ seq: 0 }, { seq: 4 }])).toBe(5);
    const s = [
      { date: '2026-02-01', seq: 1 },
      { date: '2026-01-01', seq: 2 },
      { date: '2026-02-01', seq: 0 },
    ];
    expect(sortSteps(s).map((x) => x.seq)).toEqual([2, 0, 1]);
    expect(sortSteps(s, true).map((x) => x.seq)).toEqual([1, 0, 2]);
  });
});
