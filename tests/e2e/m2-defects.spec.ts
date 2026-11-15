import { expect, test } from '@playwright/test';
import { createDefect, idbAll } from './helpers';

test('defect with symptoms and 2 DTCs, 3 steps, Fixed offers to close, totals per currency', async ({ page }) => {
  await page.goto('/defects/new');
  await page.getByLabel('Title').fill('Shudder 1st/2nd at ~1250 rpm');

  // Section list filters by group.
  const section = page.getByLabel('Section (optional)');
  await expect(section).toBeDisabled();
  await page.getByLabel('Group').selectOption({ label: 'D · Transmission & Driveline' });
  const options = await section.locator('option').allTextContents();
  expect(options).toEqual(['None', 'TM · Transaxle & Transmission', 'DLN · Driveline', 'FAX · Front Axle', 'RAX · Rear Axle']);
  await section.selectOption({ label: 'TM · Transaxle & Transmission' });
  await page.getByLabel('Group').selectOption({ label: 'B · Engine' });
  await expect(section).toHaveValue(''); // section cleared when the group changes
  expect(await section.locator('option').allTextContents()).toContain('EM · Engine Mechanical');
  await page.getByLabel('Group').selectOption({ label: 'D · Transmission & Driveline' });
  await section.selectOption({ label: 'TM · Transaxle & Transmission' });

  await page.getByLabel('Severity').selectOption('Drivability');
  await page.getByLabel('How found').selectOption('Driver');
  await page.getByText('Symptom conditions').click();
  await page.getByLabel('rpm from').fill('1200');
  await page.getByLabel('rpm to').fill('1300');
  const gears = page.getByRole('group', { name: 'Gears' });
  await gears.getByRole('button', { name: '1', exact: true }).click();
  await gears.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('group', { name: 'Load' }).getByRole('button', { name: 'Accel' }).click();
  await page.getByRole('group', { name: 'Engine state' }).getByRole('button', { name: 'Warm' }).click();

  await page.getByRole('button', { name: 'Add DTC' }).click();
  await page.getByRole('button', { name: 'Add DTC' }).click();
  const rows = page.getByTestId('dtc-row');
  await rows.nth(0).getByLabel('Code').fill('p0300');
  await rows.nth(1).getByLabel('Code').fill('NOPE');
  await page.getByRole('button', { name: 'Save defect' }).click();
  await expect(page.getByText('DTC looks like P0300')).toBeVisible();
  await rows.nth(1).getByLabel('Code').fill('P0700');
  await rows.nth(1).getByLabel('Module').selectOption('TCM');
  await page.getByRole('button', { name: 'Save defect' }).click();

  await expect(page.getByTestId('issue-title')).toHaveText('Shudder 1st/2nd at ~1250 rpm');
  await expect(page.getByTestId('dtc-list').locator('li')).toHaveText(['P0300 · ECM · Current', 'P0700 · TCM · Current']);
  await expect(page.getByTestId('symptom-summary')).toHaveText('1200–1300 rpm, gear 1/2, warm, accel');
  await expect(page.getByText('Open', { exact: true })).toBeVisible();

  // Step 1: troubleshooting with an AUD part, qty 2.
  await page.getByRole('link', { name: 'Add step' }).click();
  await page.getByLabel('Details').fill('Clutch learn and TCM data check');
  await page.getByLabel('Vendor').selectOption({ label: 'Jacks Trans' });
  await page.getByRole('button', { name: 'Add part' }).click();
  const p1 = page.getByTestId('part-line').nth(0);
  await p1.getByLabel('Part name').fill('Clutch pack seal');
  await p1.getByLabel('Qty').fill('2');
  await p1.getByLabel('Cost (each)').fill('45.50');
  await page.getByRole('button', { name: 'Save step' }).click();
  await expect(page.getByText('In progress', { exact: true })).toBeVisible();

  // Step 2: parts order in JPY.
  await page.getByRole('link', { name: 'Add step' }).click();
  await page.getByLabel('Step type').selectOption('Parts Order');
  await page.getByLabel('Details').fill('Ordered circlips from Japan');
  await page.getByRole('button', { name: 'Add part' }).click();
  const p2 = page.getByTestId('part-line').nth(0);
  await p2.getByLabel('Part name').fill('Circlip');
  await p2.getByLabel('Part number').fill('01553-05933');
  await p2.getByLabel('Cost (each)').fill('1200');
  await p2.getByLabel('Currency').selectOption('JPY');
  await page.getByRole('button', { name: 'Save step' }).click();
  await expect(page.getByTestId('step-card')).toHaveCount(2);

  // Step 3: rectification, Fixed → offer to close, closing note pre-filled.
  await page.getByRole('link', { name: 'Add step' }).click();
  await page.getByLabel('Step type').selectOption('Rectification');
  await page.getByLabel('Details').fill('Replaced seal and circlips; shudder gone on test drive');
  await page.getByLabel('Outcome').selectOption('Fixed');
  await page.getByRole('button', { name: 'Save step' }).click();
  await expect(page.getByRole('dialog', { name: 'Close this defect?' })).toBeVisible();
  await page.getByRole('button', { name: 'Close defect' }).click();
  const dialog = page.getByRole('dialog', { name: 'Change status' });
  await expect(dialog.getByLabel('Closing note')).toHaveValue('Replaced seal and circlips; shudder gone on test drive');
  await dialog.getByRole('button', { name: 'Save status' }).click();
  await expect(page.getByTestId('closing-note')).toContainText('Replaced seal and circlips');
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();

  await expect(page.getByTestId('step-card')).toHaveCount(3);
  await expect(page.getByTestId('cost-totals').locator('li')).toHaveText(['AUD 91.00', 'JPY 1,200']);

  const outbox = await idbAll<{ record_table: string }>(page, 'outbox');
  expect(outbox.filter((o) => o.record_table === 'steps')).toHaveLength(3);
});

test('status rules: Deferred needs a reason, Closed needs a note', async ({ page }) => {
  await createDefect(page, { title: 'Rattle from dash', group: 'J · Body Interior', section: 'IP · Instrument Panel', severity: 'Cosmetic' });
  await page.getByRole('button', { name: 'Change status' }).click();
  const dialog = page.getByRole('dialog', { name: 'Change status' });
  await dialog.getByRole('button', { name: 'Deferred' }).click();
  await dialog.getByRole('button', { name: 'Save status' }).click();
  await expect(dialog.getByText('Deferring needs a reason.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Closed' }).click();
  await dialog.getByRole('button', { name: 'Save status' }).click();
  await expect(dialog.getByText('Closing needs a closing note.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Deferred' }).click();
  await dialog.getByLabel('Reason for deferring').fill('Waiting for next service');
  await dialog.getByRole('button', { name: 'Save status' }).click();
  await expect(page.getByText('Waiting for next service')).toBeVisible();
  const [issue] = await idbAll<{ status: string; deferred_reason: string }>(page, 'issues');
  expect(issue).toMatchObject({ status: 'Deferred', deferred_reason: 'Waiting for next service' });
});

test('job variant hides severity, symptoms, DTCs and how found', async ({ page }) => {
  await page.goto('/defects/new?kind=job');
  await expect(page.getByRole('heading', { name: 'New job' })).toBeVisible();
  for (const label of ['Severity', 'How found']) await expect(page.getByLabel(label)).toHaveCount(0);
  await expect(page.getByText('Symptom conditions')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add DTC' })).toHaveCount(0);
  await page.getByLabel('Title').fill('Dashcam install');
  await page.getByLabel('Group').selectOption({ label: 'N · Driver Information & Multimedia' });
  await page.getByRole('button', { name: 'Save job' }).click();
  await expect(page.getByRole('heading', { name: /^J-\d{4}$/ })).toBeVisible();
});

test('drafts survive a reload; list search and filters work', async ({ page }) => {
  await page.goto('/defects/new');
  await page.getByLabel('Title').fill('Half-typed defect');
  await page.getByLabel('Description').fill('Noticed a whine');
  await page.reload();
  await expect(page.getByLabel('Title')).toHaveValue('Half-typed defect');
  await expect(page.getByLabel('Description')).toHaveValue('Noticed a whine');
  await expect(page.getByText('Draft restored')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await createDefect(page, { title: 'Brake judder', group: 'F · Brakes', section: 'BR · Brake System', severity: 'Safety-critical' });
  await createDefect(page, { title: 'Wiper streaks', group: 'L · Driver Controls', section: 'WW · Wiper & Washer', severity: 'Cosmetic' });
  await page.goto('/defects');
  await expect(page.getByTestId('issue-row')).toHaveCount(2);
  await page.getByLabel('Search').fill('judder');
  await expect(page.getByTestId('issue-row')).toHaveCount(1);
  await expect(page.getByTestId('issue-row')).toContainText('F › BR');
  await page.getByLabel('Search').fill('');
  await page.getByText('Filters').click();
  await page.getByLabel('Severity').selectOption('Cosmetic');
  await expect(page.getByTestId('issue-row')).toHaveCount(1);
  await expect(page.getByTestId('issue-row')).toContainText('Wiper streaks');
});

test('lower odometer needs confirmation', async ({ page }) => {
  const id = await createDefect(page, { title: 'Idle hunt', group: 'B · Engine', section: 'EC · Engine Control System' });
  await page.goto(`/defects/${id}/steps/new`);
  await page.getByLabel('Odometer').fill('70000');
  await page.getByLabel('Details').fill('Logged idle');
  await page.getByRole('button', { name: 'Save step' }).click();
  await expect(page.getByRole('dialog', { name: 'Odometer lower than before' })).toContainText('74,689');
  await page.getByRole('button', { name: 'Cancel' }).last().click();
  await expect(page.getByRole('heading', { name: /Add step/ })).toBeVisible();
  await page.getByLabel('Odometer').fill('75000');
  await page.getByRole('button', { name: 'Save step' }).click();
  await expect(page.getByTestId('step-card')).toHaveCount(1);
  await page.goto('/');
  await expect(page.getByTestId('tile-odometer')).toHaveText('75,000 km');
});
