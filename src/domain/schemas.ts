// Shared zod schemas: used by forms, the local Dexie store, sync payloads and import.
// Pure TypeScript — no React imports in src/domain.
import { z } from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const km = z.number().int().nonnegative();
export const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'ISO currency code, e.g. AUD');

/** Columns on every synced table. */
export const syncColumns = {
  id: z.string().uuid(),
  created_at: z.string(),
  /** Server-assigned on push; null until the record has been synced. */
  updated_at: z.string().nullable(),
  updated_by_device: z.string(),
  deleted: z.boolean(),
  version: z.number().int().positive(),
};
export type SyncColumns = { [K in keyof typeof syncColumns]: z.infer<(typeof syncColumns)[K]> };

// ---------- Enums ----------
export const ISSUE_KINDS = ['defect', 'job'] as const;
export const SEVERITIES = ['Safety-critical', 'Drivability', 'Reliability', 'Cosmetic'] as const;
export const STATUSES = ['Open', 'In progress', 'Deferred', 'Closed'] as const;
export const HOW_FOUND = ['Driver', 'Workshop inspection', 'Scan tool', 'During service', 'Other'] as const;
export const GEARS = ['P', 'R', 'N', '1', '2', '3', '4', '5', '6'] as const;
export const ENGINE_STATES = ['Cold', 'Warm', 'Hot'] as const;
export const LOADS = ['Idle', 'Cruise', 'Accel', 'Decel', 'Uphill'] as const;
export const FREQUENCIES = ['Always', 'Intermittent', 'Once'] as const;
export const DTC_MODULES = ['ECM', 'TCM', 'ABS-VDC', 'Other'] as const;
export const DTC_STATUSES = ['Current', 'Past', 'Cleared'] as const;
export const STEP_TYPES = ['Troubleshooting', 'Observation', 'Parts Order', 'Rectification'] as const;
export const OUTCOMES = ['Fixed', 'Not fixed', 'Inconclusive'] as const;
export const ORDER_STATUSES = ['Ordered', 'Received', 'Fitted', 'Returned', 'n/a'] as const;
export const VENDOR_KINDS = ['Workshop', 'Supplier', 'Both'] as const;
export const UPLOAD_STATES = ['Pending', 'Uploaded', 'Failed'] as const;
export const PHOTO_PARENTS = ['issue', 'step', 'service_record'] as const;
export const PART_PARENTS = ['step', 'service_record'] as const;

export type IssueKind = (typeof ISSUE_KINDS)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Status = (typeof STATUSES)[number];
export type StepType = (typeof STEP_TYPES)[number];
export type Outcome = (typeof OUTCOMES)[number];

// ---------- Reference data ----------
export const vehicleSchema = z.object({
  ...syncColumns,
  nickname: z.string().max(60),
  model_code: z.string(),
  vin: z.string(),
  engine: z.string(),
  transmission: z.string(),
  registration: z.string(),
  purchase_date: isoDate,
  purchase_odo: km,
  esm_publication: z.string(),
  notes: z.string(),
});
export type Vehicle = z.infer<typeof vehicleSchema>;

export const groupSchema = z.object({
  ...syncColumns,
  code: z.string().min(1).max(4),
  name: z.string().min(1),
  sort: z.number().int(),
  active: z.boolean(),
  source: z.string(),
  esm_link: z.string(),
  esm_page: z.number().int().positive().nullable(),
  /** Set on legacy groups (C, O) to explain why they are inactive. */
  legacy_note: z.string(),
});
export type Group = z.infer<typeof groupSchema>;

export const sectionSchema = z.object({
  ...syncColumns,
  group_code: z.string(),
  code: z.string().min(1).max(4),
  name: z.string().min(1),
  sort: z.number().int(),
  active: z.boolean(),
  source: z.string(),
  esm_link: z.string(),
  esm_page: z.number().int().positive().nullable(),
});
export type Section = z.infer<typeof sectionSchema>;

export const vendorSchema = z.object({
  ...syncColumns,
  name: z.string().min(1, 'Name is required').max(80),
  kind: z.enum(VENDOR_KINDS),
  phone: z.string(),
  email: z.string(),
  address: z.string(),
  notes: z.string(),
  /** Non-empty when the record needs the owner's review (e.g. "Circlip Order"). */
  review_flag: z.string(),
});
export type Vendor = z.infer<typeof vendorSchema>;

export const settingsSchema = z.object({
  ...syncColumns,
  due_soon_km: km,
  due_soon_days: z.number().int().nonnegative(),
  default_currency: currencyCode,
});
export type Settings = z.infer<typeof settingsSchema>;

// ---------- Issues ----------
export const symptomSchema = z.object({
  rpm_from: z.number().int().nonnegative().nullable(),
  rpm_to: z.number().int().nonnegative().nullable(),
  gears: z.array(z.enum(GEARS)),
  speed_from: z.number().int().nonnegative().nullable(),
  speed_to: z.number().int().nonnegative().nullable(),
  engine_state: z.enum(ENGINE_STATES).nullable(),
  load: z.array(z.enum(LOADS)),
  frequency: z.enum(FREQUENCIES).nullable(),
  notes: z.string(),
});
export type Symptom = z.infer<typeof symptomSchema>;

export const dtcSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[PBCU][0-9A-F]{4}$/, 'DTC looks like P0300'),
  module: z.enum(DTC_MODULES),
  status: z.enum(DTC_STATUSES),
  date_read: isoDate.nullable(),
});
export type Dtc = z.infer<typeof dtcSchema>;

export const issueSchema = z.object({
  ...syncColumns,
  kind: z.enum(ISSUE_KINDS),
  /** Human number; shown as D-0009 / J-0010 (prefix from kind). Unique across issues. */
  ref_no: z.number().int().positive(),
  title: z.string().trim().min(1, 'Title is required').max(120, 'Keep the title to 120 characters'),
  description: z.string(),
  date_identified: isoDate,
  odo_identified: km.nullable(),
  group_code: z.string().min(1, 'Pick a group'),
  section_code: z.string().nullable(),
  severity: z.enum(SEVERITIES).nullable(),
  status: z.enum(STATUSES),
  how_found: z.enum(HOW_FOUND).nullable(),
  found_by_vendor_id: z.string().nullable(),
  symptom: symptomSchema.nullable(),
  dtcs: z.array(dtcSchema),
  deferred_reason: z.string(),
  closed_date: isoDate.nullable(),
  closed_odo: km.nullable(),
  closing_note: z.string(),
  legacy_entry_no: z.number().int().nullable(),
});
export type Issue = z.infer<typeof issueSchema>;

export const stepSchema = z.object({
  ...syncColumns,
  issue_id: z.string().uuid(),
  seq: z.number().int().nonnegative(),
  date: isoDate,
  odo: km.nullable(),
  step_type: z.enum(STEP_TYPES),
  vendor_id: z.string().nullable(),
  details: z.string().trim().min(1, 'Details are required'),
  comments: z.string(),
  outcome: z.enum(OUTCOMES).nullable(),
  /** Tagged "track / high oil temp" — makes the next due point use the severe interval. */
  severe_use: z.boolean(),
  legacy_entry_no: z.number().int().nullable(),
});
export type Step = z.infer<typeof stepSchema>;

// ---------- Service ----------
export const serviceItemSchema = z.object({
  ...syncColumns,
  name: z.string().min(1),
  group_code: z.string(),
  section_code: z.string().nullable(),
  /** Current interval in force (owner override wins over seed). null = "Set interval". */
  interval_km: km.nullable(),
  interval_months: z.number().int().positive().nullable(),
  severe_km: km.nullable(),
  severe_months: z.number().int().positive().nullable(),
  seed_km: km.nullable(),
  seed_months: z.number().int().positive().nullable(),
  seed_source: z.string(),
  seed_source_url: z.string(),
  spec: z.string(),
  capacity_l: z.number().nonnegative().nullable(),
  active: z.boolean(),
  sort: z.number().int(),
  notes: z.string(),
});
export type ServiceItem = z.infer<typeof serviceItemSchema>;

export const serviceRecordSchema = z.object({
  ...syncColumns,
  date: isoDate,
  odo: km,
  vendor_id: z.string().nullable(),
  service_item_ids: z.array(z.string()),
  notes: z.string(),
  linked_issue_id: z.string().nullable(),
  severe_use: z.boolean(),
  legacy_entry_no: z.number().int().nullable(),
});
export type ServiceRecord = z.infer<typeof serviceRecordSchema>;

// ---------- Parts ----------
export const partLineSchema = z.object({
  ...syncColumns,
  parent_type: z.enum(PART_PARENTS),
  parent_id: z.string().uuid(),
  sort: z.number().int(),
  part_name: z.string().trim().min(1, 'Part name is required'),
  part_number: z.string(),
  brand: z.string(),
  qty: z.number().positive(),
  /** Decimal amount in `currency`; null when unknown. */
  cost: z.number().nonnegative().nullable(),
  currency: currencyCode,
  order_status: z.enum(ORDER_STATUSES),
  fitted: z.boolean(),
  position: z.string(),
});
export type PartLine = z.infer<typeof partLineSchema>;

export const installedPartSchema = z.object({
  ...syncColumns,
  part_line_id: z.string().uuid(),
  fitted_date: isoDate,
  fitted_odo: km.nullable(),
  position: z.string(),
  replaces_installed_part_id: z.string().nullable(),
  removed_date: isoDate.nullable(),
  removed_odo: km.nullable(),
  active: z.boolean(),
});
export type InstalledPart = z.infer<typeof installedPartSchema>;

// ---------- Photos ----------
export const photoSchema = z.object({
  ...syncColumns,
  parent_type: z.enum(PHOTO_PARENTS),
  parent_id: z.string().uuid(),
  caption: z.string(),
  taken_at: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  /** Key into the local photo_blobs table (full-size JPEG). */
  local_blob_key: z.string().nullable(),
  remote_path: z.string().nullable(),
  upload_state: z.enum(UPLOAD_STATES),
  /** 320 px JPEG thumbnail as a data URL, stored with the record so it syncs with it. */
  thumb: z.string(),
});
export type Photo = z.infer<typeof photoSchema>;

// ---------- Shortlists ----------
export const shortlistSchema = z.object({
  ...syncColumns,
  name: z.string().min(1),
  vendor_id: z.string().nullable(),
  created_date: isoDate,
  notes: z.string(),
  items: z.array(z.string()),
  exported_at: z.string().nullable(),
  snapshot: z.unknown().nullable(),
});
export type Shortlist = z.infer<typeof shortlistSchema>;

// ---------- Odometer ----------
export const odometerReadingSchema = z.object({
  ...syncColumns,
  date: isoDate,
  km: km,
  /** 'manual', 'purchase', or the table of the record it came from. */
  source: z.string(),
  source_id: z.string().nullable(),
});
export type OdometerReading = z.infer<typeof odometerReadingSchema>;

/** Table name → schema, for every synced table. */
export const TABLE_SCHEMAS = {
  vehicle: vehicleSchema,
  groups: groupSchema,
  sections: sectionSchema,
  vendors: vendorSchema,
  settings: settingsSchema,
  issues: issueSchema,
  steps: stepSchema,
  serviceItems: serviceItemSchema,
  serviceRecords: serviceRecordSchema,
  partLines: partLineSchema,
  installedParts: installedPartSchema,
  photos: photoSchema,
  shortlists: shortlistSchema,
  odometerReadings: odometerReadingSchema,
} as const;
export type SyncedTable = keyof typeof TABLE_SCHEMAS;
export type RecordOf<T extends SyncedTable> = z.infer<(typeof TABLE_SCHEMAS)[T]>;
export const SYNCED_TABLES = Object.keys(TABLE_SCHEMAS) as SyncedTable[];

export const emptySymptom = (): Symptom => ({
  rpm_from: null,
  rpm_to: null,
  gears: [],
  speed_from: null,
  speed_to: null,
  engine_state: null,
  load: [],
  frequency: null,
  notes: '',
});
