# R35 Log

An offline-first web app (installable PWA) for one car, a 2008 JDM Nissan GT-R (CBA-R35). It logs defects and their troubleshooting steps, servicing, fitted parts and photos. It replaces `Maintenance_Log.xlsx`.

Everything is stored on the device in IndexedDB. The app works the same with or without a connection. Cloud sync (Supabase) comes in milestone 7.

## Status

| Milestone | State |
| --- | --- |
| 1. Skeleton and local data | ✅ Done |
| 2. Defects and steps | ✅ Done |
| 3. Photos | ✅ Done |
| 4. Service schedule and dashboard | Next. Service items are seeded and shown read-only |
| 5. Parts register | Parts on order view done. Installed register to come |
| 6. Shortlist and exports | — |
| 7. Backend and sync | — (outbox is already filled on every write) |
| 8. Spreadsheet import | — |
| 9. Backup and polish | Dark mode follows the system setting already |

## Develop

Needs Node 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173 (no service worker in dev)
npm test             # unit tests (Vitest): domain logic and the local store
npm run e2e          # Playwright: builds, serves on :4173, runs phone-size Chrome and iPhone-size profiles
npm run build        # production build in dist/, with service worker and manifest
```

Playwright uses the browser's own offline mode for the offline test. The "Mobile Safari" profile runs Chromium with iPhone 14 screen size, touch and user agent. It is not real WebKit, so check iOS behaviour on a real iPhone.

## Layout

```
src/domain/   pure TypeScript, no React: zod schemas, refs, status rules, odometer, dates, seed builder
src/db/       Dexie schema (db.ts), the write path (repo.ts), multi-record actions (actions.ts)
src/seed/     seed JSON: ESM groups/sections, vehicle, vendors, service items, settings (with sources)
src/lib/      React hooks and on-device photo processing
src/ui/       shared components: fields, sheets/confirm, badges, photos, layout
src/features/ screens: dashboard, defects (list, setup, detail, step form), service, parts, more
tests/unit/   Vitest
tests/e2e/    Playwright, with fixtures in tests/fixtures
```

### Data rules worth knowing

- Every write goes through `src/db/repo.ts`. It validates with zod, increments `version`, sets `updated_by_device`, and appends an `outbox` entry in the same IndexedDB transaction. Deletes are soft deletes (`deleted = true`).
- Ids are UUID v7, made on the device. Seed rows use fixed UUID v5 ids, so every device seeds identical rows.
- The issue `ref_no` is a number. The display ref (D-0009 / J-0010) takes its prefix from the kind. New refs come from this device's block (1000–1999 for device 1). The sync server will assign blocks in milestone 7. Imported rows keep their sheet numbers (2–67).
- Costs are never added up across currencies.
- Photos are resized on the device to a 2,048 px long edge (JPEG, quality 0.8). The full image is kept in `photo_blobs`, and a 320 px thumbnail is stored on the photo record. Re-encoding through a canvas drops EXIF, including GPS.
- Form drafts are kept in `localStorage` as you type.

## Deploy (Cloudflare Pages)

Any static host with HTTPS works. On Cloudflare Pages:

1. Create a Pages project connected to this repo.
2. Build command `npm run build`, output directory `dist`.
3. Add a SPA fallback: Pages serves `index.html` for unknown paths by default. The service worker also handles deep links offline.

Supabase environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) arrive with milestone 7.

## Decisions and spec notes

- **Groups:** the spec says "14 groups", but its table lists 15 rows. The seed has the 14 ESM groups (A, B, D–N, P) and 54 sections, plus Z (owner-defined, active) and C and O (legacy, inactive).
- **Engine oil:** the interval is seeded as an owner override of 5,000 km / 12 months (owner's choice, 2026-11-15). The Nissan seed of 15,000 km / 12 months is kept alongside it. The milestone 4 check will expect a due point of 79,689 km, not 77,689 km.
- **Gears and load:** both accept several values (e.g. shudder in gears 1 and 2 under Accel and Uphill). Engine state and frequency take one value each.
- **First step:** adding the first step to an Open issue moves it to In progress, matching the import rule.
- **Vendor kinds:** the seed vendors' kinds are guesses, and the notes on each say so.
- **Not built yet:** "Add to shortlist" and the "replaces which installed part?" prompt need milestones 6 and 5. They'll be added then rather than shown as dead buttons now.
