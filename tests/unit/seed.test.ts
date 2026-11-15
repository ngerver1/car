import { describe, expect, it } from 'vitest';
import { buildSeed, seedGroups, seedSections } from '@/domain/seed';
import { groupSchema, sectionSchema, serviceItemSchema, vendorSchema, vehicleSchema, settingsSchema, odometerReadingSchema } from '@/domain/schemas';

describe('seed data', () => {
  const groups = seedGroups();
  const sections = seedSections();
  const esmGroups = groups.filter((g) => g.source === 'ESM SM13E00-1R35E0E');

  it('has the 14 ESM groups in index order', () => {
    expect(esmGroups.map((g) => g.code)).toEqual(['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P']);
  });

  it('has 54 ESM sections, each belonging to an ESM group', () => {
    expect(sections).toHaveLength(54);
    const codes = new Set(esmGroups.map((g) => g.code));
    for (const s of sections) expect(codes.has(s.group_code)).toBe(true);
    expect(new Set(sections.map((s) => s.code)).size).toBe(54);
  });

  it('matches the ESM table section counts per group', () => {
    const count = (g: string) => sections.filter((s) => s.group_code === g).length;
    expect(Object.fromEntries(esmGroups.map((g) => [g.code, count(g.code)]))).toEqual({
      A: 1,
      B: 8,
      D: 4,
      E: 4,
      F: 3,
      G: 2,
      H: 3,
      I: 3,
      J: 3,
      K: 7,
      L: 6,
      M: 6,
      N: 3,
      P: 1,
    });
  });

  it('uses ESM names exactly as printed', () => {
    const by = Object.fromEntries(sections.map((s) => [s.code, s.name]));
    expect(by.TM).toBe('Transaxle & Transmission');
    expect(by.WT).toBe('Road Wheels & Tires');
    expect(by.PG).toBe('Power Supply, Ground & Circuit Elements');
    expect(groups.find((g) => g.code === 'K')?.name).toBe('Body Exterior, Door, Roof & Vehicle Security');
  });

  it('adds Z as an active owner group and C, O as inactive legacy groups', () => {
    const z = groups.find((g) => g.code === 'Z')!;
    expect(z).toMatchObject({ active: true, source: 'owner', name: 'Other (owner-defined)' });
    expect(sections.filter((s) => s.group_code === 'Z')).toHaveLength(0);
    for (const code of ['C', 'O']) {
      const g = groups.find((x) => x.code === code)!;
      expect(g.active).toBe(false);
      expect(g.legacy_note).not.toBe('');
    }
    expect(groups).toHaveLength(17);
  });

  it('has stable ids across calls (so two devices seed the same rows)', () => {
    expect(seedGroups().map((g) => g.id)).toEqual(groups.map((g) => g.id));
  });

  it('every seed row passes its schema', () => {
    const s = buildSeed();
    s.groups.forEach((r) => groupSchema.parse(r));
    s.sections.forEach((r) => sectionSchema.parse(r));
    s.vendors.forEach((r) => vendorSchema.parse(r));
    s.serviceItems.forEach((r) => serviceItemSchema.parse(r));
    s.vehicle.forEach((r) => vehicleSchema.parse(r));
    s.settings.forEach((r) => settingsSchema.parse(r));
    s.odometerReadings.forEach((r) => odometerReadingSchema.parse(r));
  });

  it('seeds the vehicle, vendors and service items from the spec', () => {
    const s = buildSeed();
    expect(s.vehicle[0]).toMatchObject({ model_code: 'CBA-R35', engine: 'VR38DETT', purchase_date: '2026-03-25', purchase_odo: 74689 });
    expect(s.vendors.map((v) => v.name)).toEqual(['Private Corner', 'Pit Station', 'Jacks Trans', 'JustJap', 'Circlip Order']);
    expect(s.vendors.find((v) => v.name === 'Circlip Order')!.review_flag).not.toBe('');
    expect(s.serviceItems).toHaveLength(12);
    const oil = s.serviceItems.find((i) => i.name === 'Engine oil + oil filter')!;
    expect(oil).toMatchObject({ interval_km: 5000, interval_months: 12, seed_km: 15000, seed_months: 12 });
    const blank = s.serviceItems.filter((i) => i.interval_km == null && i.interval_months == null).map((i) => i.name);
    expect(blank).toContain('Engine coolant');
    expect(s.settings[0]).toMatchObject({ due_soon_km: 1000, due_soon_days: 30, default_currency: 'AUD' });
  });
});
