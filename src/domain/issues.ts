import { daysBetween } from './dates';
import { formatRef } from './format';
import type { Dtc, Issue, PartLine, Status, Step, Symptom } from './schemas';

export const OPEN_STATUSES: Status[] = ['Open', 'In progress', 'Deferred'];

export function issueRef(issue: Pick<Issue, 'kind' | 'ref_no'>): string {
  return formatRef(issue.kind, issue.ref_no);
}

export type StatusChange =
  | { status: 'Open' | 'In progress' }
  | { status: 'Deferred'; reason: string; date: string; odo: number | null }
  | { status: 'Closed'; note: string; date: string; odo: number | null };

/** Validates a status change; returns an error message or null. */
export function statusChangeError(change: StatusChange): string | null {
  if (change.status === 'Deferred' && !change.reason.trim()) return 'Deferring needs a reason.';
  if (change.status === 'Closed' && !change.note.trim()) return 'Closing needs a closing note.';
  return null;
}

/** Applies a validated status change, returning the fields to write. */
export function applyStatusChange(change: StatusChange): Partial<Issue> {
  const err = statusChangeError(change);
  if (err) throw new Error(err);
  switch (change.status) {
    case 'Deferred':
      return { status: 'Deferred', deferred_reason: change.reason.trim(), closed_date: null, closed_odo: null };
    case 'Closed':
      return { status: 'Closed', closing_note: change.note.trim(), closed_date: change.date, closed_odo: change.odo };
    default:
      return { status: change.status, closed_date: null, closed_odo: null };
  }
}

/** Status after adding a step: a step on an Open issue means work has started. */
export function statusAfterStepAdded(current: Status): Status {
  return current === 'Open' ? 'In progress' : current;
}

/** Days from identification to today (or to the closed date). */
export function daysOpen(issue: Pick<Issue, 'date_identified' | 'closed_date' | 'status'>, today: string): number {
  const end = issue.status === 'Closed' && issue.closed_date ? issue.closed_date : today;
  return Math.max(0, daysBetween(issue.date_identified, end));
}

export interface CurrencyTotal {
  currency: string;
  amount: number;
}

/** Sums part-line costs per currency (qty × cost). Never sums across currencies. */
export function totalsByCurrency(lines: Pick<PartLine, 'cost' | 'qty' | 'currency' | 'deleted'>[]): CurrencyTotal[] {
  const cents = new Map<string, number>();
  for (const l of lines) {
    if (l.deleted || l.cost == null) continue;
    cents.set(l.currency, (cents.get(l.currency) ?? 0) + Math.round(l.cost * 100 * l.qty));
  }
  return [...cents.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, c]) => ({ currency, amount: c / 100 }));
}

export function symptomSummary(s: Symptom | null): string {
  if (!s) return '';
  const parts: string[] = [];
  if (s.rpm_from != null || s.rpm_to != null) {
    parts.push(s.rpm_from != null && s.rpm_to != null && s.rpm_from !== s.rpm_to ? `${s.rpm_from}–${s.rpm_to} rpm` : `~${s.rpm_from ?? s.rpm_to} rpm`);
  }
  if (s.gears.length) parts.push(`gear ${s.gears.join('/')}`);
  if (s.speed_from != null || s.speed_to != null) {
    parts.push(s.speed_from != null && s.speed_to != null ? `${s.speed_from}–${s.speed_to} km/h` : `~${s.speed_from ?? s.speed_to} km/h`);
  }
  if (s.engine_state) parts.push(s.engine_state.toLowerCase());
  if (s.load.length) parts.push(s.load.join('/').toLowerCase());
  if (s.frequency) parts.push(s.frequency.toLowerCase());
  if (s.notes.trim()) parts.push(s.notes.trim());
  return parts.join(', ');
}

export function dtcSummary(dtcs: Dtc[]): string {
  return dtcs.map((d) => `${d.code} (${d.module}, ${d.status.toLowerCase()})`).join(', ');
}

/** Full-text match over title, description, DTCs and step text. Every word must match. */
export function issueMatches(issue: Issue, steps: Step[], query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [
    issueRef(issue),
    issue.title,
    issue.description,
    issue.closing_note,
    issue.deferred_reason,
    ...issue.dtcs.map((d) => d.code),
    issue.symptom?.notes ?? '',
    ...steps.flatMap((s) => [s.details, s.comments]),
  ]
    .join('\n')
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Step seq for a new step: one past the highest existing. */
export function nextSeq(steps: Pick<Step, 'seq'>[]): number {
  return steps.reduce((m, s) => Math.max(m, s.seq + 1), 0);
}

export function sortSteps<T extends Pick<Step, 'date' | 'seq'>>(steps: T[], newestFirst = false): T[] {
  const sorted = [...steps].sort((a, b) => (a.date === b.date ? a.seq - b.seq : a.date < b.date ? -1 : 1));
  return newestFirst ? sorted.reverse() : sorted;
}
