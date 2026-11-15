// Renders public/favicon.svg to the PNG icons the manifest and iOS need.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, file, pad = 0) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - pad * 2;
  await page.setContent(`<html><body style="margin:0;background:#111827;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`);
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: false });
}
await render(192, 'pwa-192.png');
await render(512, 'pwa-512.png');
await render(512, 'pwa-512-maskable.png', 56);
await render(180, 'apple-touch-icon.png');
await browser.close();
