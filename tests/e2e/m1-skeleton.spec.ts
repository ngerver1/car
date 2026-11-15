import { expect, test } from '@playwright/test';
import { idbAll, waitForServiceWorker } from './helpers';

test('app shell loads with tab bar and sync indicator', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'GT-R · CBA-R35' })).toBeVisible();
  await expect(page.getByTestId('tile-odometer')).toHaveText('74,689 km');
  const tabs = page.getByRole('navigation', { name: 'Tabs' });
  for (const name of ['Dashboard', 'Defects', 'Service', 'Parts', 'More']) await expect(tabs.getByRole('link', { name })).toBeVisible();
  await expect(page.getByTestId('sync-indicator')).toHaveText(/Synced|pending/);
  await tabs.getByRole('link', { name: 'Defects' }).click();
  await expect(page.getByRole('heading', { name: 'Defects & jobs' })).toBeVisible();
});

test('installable: manifest, icons and service worker', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: 'R35 Maintenance Log', display: 'standalone', start_url: '/' });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) expect((await request.get('/' + icon.src)).ok()).toBe(true);
  expect((await request.get('/apple-touch-icon.png')).ok()).toBe(true);
  await waitForServiceWorker(page);
});

test('works with the network off after first load, including deep links', async ({ page, context }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  // Reopen online until the page itself is served by the service worker (the first navigation
  // straight after install can still go to the network), then cut the network.
  await expect(async () => {
    const resp = await page.reload();
    expect(resp?.fromServiceWorker()).toBe(true);
  }).toPass({ timeout: 10_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'GT-R · CBA-R35' })).toBeVisible();
  await expect(page.getByTestId('sync-indicator')).toHaveText(/Offline · \d+ pending/);
  await page.goto('/more/groups');
  await expect(page.getByTestId('group-counts')).toBeVisible();
  // Writes work offline too.
  await page.goto('/defects/new');
  await page.getByLabel('Title').fill('Offline test defect');
  await page.getByLabel('Group').selectOption({ label: 'B · Engine' });
  await page.getByLabel('Severity').selectOption('Cosmetic');
  await page.getByLabel('How found').selectOption('Driver');
  await page.getByRole('button', { name: 'Save defect' }).click();
  await expect(page.getByTestId('issue-title')).toHaveText('Offline test defect');
  await expect(page.getByTestId('sync-indicator')).toHaveText(/Offline · [1-9]\d* pending/);
  await context.setOffline(false);
});

test('seed groups match the ESM index: 14 groups, 54 sections, plus Z and legacy C/O', async ({ page }) => {
  await page.goto('/more/groups');
  await expect(page.getByTestId('group-counts')).toHaveText('14 ESM groups · 54 sections');
  const groups = await idbAll<{ code: string; active: boolean; source: string }>(page, 'groups');
  expect(
    groups
      .filter((g) => g.source === 'ESM SM13E00-1R35E0E')
      .map((g) => g.code)
      .sort(),
  ).toEqual(['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P']);
  expect(groups.find((g) => g.code === 'C')?.active).toBe(false);
  expect(groups.find((g) => g.code === 'O')?.active).toBe(false);
  expect(groups.find((g) => g.code === 'Z')?.active).toBe(true);
  expect(await idbAll(page, 'sections')).toHaveLength(54);
  await expect(page.getByText('TM', { exact: true })).toBeVisible();
  await expect(page.getByText('Transaxle & Transmission')).toBeVisible();
  await expect(page.getByText('Legacy · inactive')).toHaveCount(2);
});
