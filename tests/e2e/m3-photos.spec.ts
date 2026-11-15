import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { createDefect, idbAll } from './helpers';

const FIXTURE_12MP = path.resolve('tests/fixtures/12mp-gps.jpg');
const FIXTURE_6MP = path.resolve('tests/fixtures/6mp.jpg');

/** Inspects a stored photo blob in the page: decoded size and whether any EXIF/GPS bytes remain. */
async function inspectBlob(page: Page, key: string) {
  return page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('r35-log');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const row = await new Promise<{ blob: Blob }>((res, rej) => {
      const q = db.transaction('photo_blobs').objectStore('photo_blobs').get(key);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    db.close();
    const bytes = new Uint8Array(await row.blob.arrayBuffer());
    const bmp = await createImageBitmap(row.blob);
    // Look for an APP1 (0xFFE1) segment and the ASCII markers of EXIF / GPS IFDs.
    let app1 = false;
    for (let i = 2; i < bytes.length - 1; ) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      if (marker === 0xda) break; // start of scan: no more metadata segments
      if (marker === 0xe1) app1 = true;
      i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    }
    const ascii = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
    return {
      type: row.blob.type,
      size: row.blob.size,
      width: bmp.width,
      height: bmp.height,
      app1,
      exif: ascii.includes('Exif'),
      make: ascii.includes('TestCam'),
    };
  }, key);
}

test('a 12 MP photo is stored at 2,048 px or less with no GPS data', async ({ page }) => {
  const id = await createDefect(page, { title: 'Oil weep at sump', group: 'B · Engine', section: 'LU · Engine Lubrication System' });
  await page.goto(`/defects/${id}/steps/new`);
  await page.getByLabel('Details').fill('Photographed the weep');
  await page.getByTestId('photo-library-input').setInputFiles(FIXTURE_12MP);
  await expect(page.getByTestId('pending-photos').locator('img')).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Save step' }).click();
  await expect(page.getByTestId('step-card').getByTestId('photo-grid').locator('img')).toHaveCount(1);

  const [photo] = await idbAll<{
    width: number;
    height: number;
    bytes: number;
    thumb: string;
    local_blob_key: string;
    upload_state: string;
    parent_type: string;
  }>(page, 'photos');
  expect(photo).toMatchObject({ width: 2048, height: 1536, upload_state: 'Pending', parent_type: 'step' });
  const blob = await inspectBlob(page, photo.local_blob_key);
  expect(blob).toMatchObject({ type: 'image/jpeg', width: 2048, height: 1536, app1: false, exif: false, make: false });
  expect(blob.size).toBe(photo.bytes);

  // Thumbnail is 320 px on the long edge.
  const thumb = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, photo.thumb);
  expect(thumb).toEqual([320, 240]);

  // Gallery viewer opens the full-size image.
  await page.getByTestId('step-card').getByTestId('photo-grid').locator('button').first().click();
  const viewer = page.getByRole('dialog');
  await expect(viewer.getByText('1 of 1')).toBeVisible();
  await expect(viewer.getByTestId('viewer-image')).toHaveAttribute('src', /^blob:/);
  const natural = await viewer.getByTestId('viewer-image').evaluate((img: HTMLImageElement) => img.decode().then(() => img.naturalWidth));
  expect(natural).toBe(2048);
});

test('photos attach to an issue from setup and from the detail screen', async ({ page }) => {
  await page.goto('/defects/new');
  await page.getByLabel('Title').fill('Scuffed wheel');
  await page.getByLabel('Group').selectOption({ label: 'E · Suspension' });
  await page.getByLabel('Section (optional)').selectOption({ label: 'WT · Road Wheels & Tires' });
  await page.getByLabel('Severity').selectOption('Cosmetic');
  await page.getByLabel('How found').selectOption('Driver');
  await page.getByTestId('photo-library-input').setInputFiles([FIXTURE_6MP, FIXTURE_6MP]);
  await expect(page.getByTestId('pending-photos').locator('img')).toHaveCount(2, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Remove new photo 2' }).click();
  await page.getByRole('button', { name: 'Save defect' }).click();
  await expect(page.getByTestId('photo-grid').locator('img')).toHaveCount(1);
  await page.getByTestId('photo-library-input').setInputFiles(FIXTURE_6MP);
  await expect(page.getByTestId('photo-grid').locator('img')).toHaveCount(2, { timeout: 20_000 });
  const photos = await idbAll<{ parent_type: string; width: number }>(page, 'photos');
  expect(photos.map((p) => [p.parent_type, p.width])).toEqual([
    ['issue', 2048],
    ['issue', 2048],
  ]);

  // Delete from the viewer.
  await page.getByTestId('photo-grid').locator('button').first().click();
  await page.getByRole('button', { name: 'Delete photo' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByTestId('photo-grid').locator('img')).toHaveCount(1);
});

test('20 photos on one step stay smooth to scroll', async ({ page }) => {
  test.setTimeout(180_000);
  const id = await createDefect(page, { title: 'Underbody survey', group: 'K · Body Exterior, Door, Roof & Vehicle Security', section: 'EXT · Exterior' });
  await page.goto(`/defects/${id}/steps/new`);
  await page.getByLabel('Details').fill('Underbody photo survey');
  await page.getByTestId('photo-library-input').setInputFiles(Array.from({ length: 20 }, () => FIXTURE_6MP));
  await expect(page.getByTestId('pending-photos').locator('img')).toHaveCount(20, { timeout: 150_000 });
  await page.getByRole('button', { name: 'Save step' }).click();
  const grid = page.getByTestId('step-card').getByTestId('photo-grid');
  await expect(grid.locator('img')).toHaveCount(20);

  // Thumbnails, not full images, are what the timeline renders.
  const srcs = await grid.locator('img').evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src.slice(0, 23)));
  expect(new Set(srcs)).toEqual(new Set(['data:image/jpeg;base64,']));

  // Measure frame times while scrolling the page up and down.
  const frames = await page.evaluate(async () => {
    const deltas: number[] = [];
    let last = performance.now();
    let running = true;
    const tick = (t: number) => {
      deltas.push(t - last);
      last = t;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const max = document.documentElement.scrollHeight;
    for (let i = 0; i < 3; i++) {
      for (let y = 0; y <= max; y += 120) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(r));
      }
      for (let y = max; y >= 0; y -= 120) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(r));
      }
    }
    running = false;
    deltas.sort((a, b) => a - b);
    return { count: deltas.length, p95: deltas[Math.floor(deltas.length * 0.95)], max: deltas[deltas.length - 1] };
  });
  console.log('scroll frames', frames);
  expect(frames.p95).toBeLessThan(50);
});
