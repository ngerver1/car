// Builds the first-launch seed records from src/seed/*.json. Pure and deterministic.
import esm from '../seed/esm.json';
import vehicleSeed from '../seed/vehicle.json';
import settingsSeed from '../seed/settings.json';
import vendorsSeed from '../seed/vendors.json';
import serviceItemsSeed from '../seed/service-items.json';
import { seedId } from './ids';
import type { Group, OdometerReading, Section, ServiceItem, Settings, SyncColumns, Vehicle, Vendor } from './schemas';

export const SEED_DEVICE = 'seed';
export const SEED_CREATED_AT = '2026-11-15T00:00:00.000Z';
export const VEHICLE_ID = seedId('vehicle');
export const SETTINGS_ID = seedId('settings');

const cols = (key: string): SyncColumns => ({
  id: seedId(key),
  created_at: SEED_CREATED_AT,
  updated_at: null,
  updated_by_device: SEED_DEVICE,
  deleted: false,
  version: 1,
});

export function seedGroups(): Group[] {
  const esmGroups: Group[] = esm.groups.map((g, i) => ({
    ...cols(`group:${g.code}`),
    code: g.code,
    name: g.name,
    sort: i,
    active: true,
    source: esm.source,
    esm_link: '',
    esm_page: null,
    legacy_note: '',
  }));
  const extra: Group[] = [...esm.owner_groups, ...esm.legacy_groups].map((g, i) => ({
    ...cols(`group:${g.code}`),
    code: g.code,
    name: g.name,
    sort: 100 + i,
    active: g.active,
    source: g.source,
    esm_link: '',
    esm_page: null,
    legacy_note: g.legacy_note,
  }));
  return [...esmGroups, ...extra];
}

export function seedSections(): Section[] {
  return esm.groups.flatMap((g) =>
    g.sections.map(([code, name], i) => ({
      ...cols(`section:${code}`),
      group_code: g.code,
      code,
      name,
      sort: i,
      active: true,
      source: esm.source,
      esm_link: '',
      esm_page: null,
    })),
  );
}

export function seedVehicle(): Vehicle {
  return { ...cols('vehicle'), ...vehicleSeed };
}

export function seedSettings(): Settings {
  return { ...cols('settings'), ...settingsSeed };
}

export function seedVendors(): Vendor[] {
  return vendorsSeed.map((v) => ({
    ...cols(`vendor:${v.name}`),
    name: v.name,
    kind: v.kind as Vendor['kind'],
    phone: '',
    email: '',
    address: '',
    notes: v.notes,
    review_flag: v.review_flag,
  }));
}

export function seedServiceItems(): ServiceItem[] {
  return serviceItemsSeed.map((s, i) => ({
    ...cols(`service-item:${s.name}`),
    ...s,
    active: true,
    sort: i,
  }));
}

export function seedOdometer(): OdometerReading[] {
  return [
    {
      ...cols('odo:purchase'),
      date: vehicleSeed.purchase_date,
      km: vehicleSeed.purchase_odo,
      source: 'purchase',
      source_id: VEHICLE_ID,
    },
  ];
}

export function buildSeed() {
  return {
    vehicle: [seedVehicle()],
    settings: [seedSettings()],
    groups: seedGroups(),
    sections: seedSections(),
    vendors: seedVendors(),
    serviceItems: seedServiceItems(),
    odometerReadings: seedOdometer(),
  };
}
