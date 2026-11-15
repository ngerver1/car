// Builds the one-file preview page published as a claude.ai artifact: docs/app-preview.html.
// The page has no service worker, so it can't be installed or used offline.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
execSync('npx vite build --mode artifact', { stdio: 'inherit' });
const dir = 'dist-artifact/assets';
const files = readdirSync(dir);
const js = readFileSync(`${dir}/${files.find((f) => f.endsWith('.js'))}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(`${dir}/${files.find((f) => f.endsWith('.css'))}`, 'utf8');
const page = `<title>R35 Log Preview</title>
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync('docs/app-preview.html', page);
console.log('docs/app-preview.html', (page.length / 1024).toFixed(0), 'KB');
