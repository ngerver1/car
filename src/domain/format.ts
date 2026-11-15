import type { IssueKind } from './schemas';

export function formatRef(kind: IssueKind, refNo: number): string {
  return `${kind === 'job' ? 'J' : 'D'}-${String(refNo).padStart(4, '0')}`;
}

export function formatKm(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value.toLocaleString('en-AU')} km`;
}

export function chapterLabel(code: string, name: string): string {
  return `${code} · ${name}`;
}

/** Formats an amount in its own currency; never converts. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency, currencyDisplay: 'code' }).format(amount).replace(/ /g, ' ');
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
