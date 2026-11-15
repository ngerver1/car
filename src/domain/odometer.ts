import type { OdometerReading } from './schemas';

type Reading = Pick<OdometerReading, 'date' | 'km' | 'deleted'> & { source_id?: string | null };

/** Latest reading by date; highest km wins on ties. */
export function currentOdometer(readings: Reading[]): Reading | null {
  let best: Reading | null = null;
  for (const r of readings) {
    if (r.deleted) continue;
    if (!best || r.date > best.date || (r.date === best.date && r.km > best.km)) best = r;
  }
  return best;
}

/**
 * The reading an entry should not go below: the latest reading on or before `date`
 * (excluding readings created by the record being edited).
 */
export function previousReading(readings: Reading[], date: string, excludeSourceId?: string | null): Reading | null {
  const eligible = readings.filter((r) => !r.deleted && r.date <= date && (!excludeSourceId || r.source_id !== excludeSourceId));
  return currentOdometer(eligible);
}

/** Returns a warning message when `km` is lower than the previous reading, else null. */
export function odometerWarning(readings: Reading[], date: string, km: number | null, excludeSourceId?: string | null): string | null {
  if (km == null) return null;
  const prev = previousReading(readings, date, excludeSourceId);
  if (prev && km < prev.km) {
    return `${km.toLocaleString('en-AU')} km is lower than the previous reading of ${prev.km.toLocaleString('en-AU')} km on ${prev.date}.`;
  }
  return null;
}

/** km per year = (current km − purchase km) ÷ days since purchase × 365. */
export function kmPerYear(currentKm: number, purchaseKm: number, daysSincePurchase: number): number | null {
  if (daysSincePurchase <= 0) return null;
  return ((currentKm - purchaseKm) / daysSincePurchase) * 365;
}
