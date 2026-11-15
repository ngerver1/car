import { expect, type Page } from '@playwright/test';

/** Reads every row of an IndexedDB object store in the app's database. */
export async function idbAll<T = Record<string, unknown>>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(async (store) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('r35-log');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise<unknown[]>((res, rej) => {
      const q = db.transaction(store).objectStore(store).getAll();
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    db.close();
    return rows;
  }, store) as Promise<T[]>;
}

export async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.active || !navigator.serviceWorker.controller) return false;
      // Wait until the app shell (HTML, JS, CSS) is in the precache, not just the worker being active.
      const urls: string[] = [];
      for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) urls.push(r.url);
      return ['/index.html', '.js', '.css'].every((needle) => urls.some((u) => u.includes(needle) && (needle !== '.js' || u.includes('/assets/'))));
    },
    undefined,
    { timeout: 20_000, polling: 250 },
  );
}

export interface NewDefect {
  title: string;
  group: string; // option label, e.g. 'D · Transmission & Driveline'
  section?: string;
  severity?: string;
  howFound?: string;
}

export async function createDefect(page: Page, d: NewDefect) {
  await page.goto('/defects/new');
  await page.getByLabel('Title').fill(d.title);
  await page.getByLabel('Group').selectOption({ label: d.group });
  if (d.section) await page.getByLabel('Section (optional)').selectOption({ label: d.section });
  await page.getByLabel('Severity').selectOption(d.severity ?? 'Drivability');
  await page.getByLabel('How found').selectOption(d.howFound ?? 'Driver');
  await page.getByRole('button', { name: 'Save defect' }).click();
  await expect(page.getByTestId('issue-title')).toHaveText(d.title);
  return page.url().split('/defects/')[1];
}
