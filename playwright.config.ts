import { defineConfig, devices } from '@playwright/test';

// Only Chromium is available in this environment, so the "Mobile Safari" project
// emulates an iPhone viewport, touch and user agent on Chromium (not real WebKit).
const iphone = { ...devices['iPhone 14'], browserName: 'chromium' as const, defaultBrowserType: 'chromium' as const };

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'allow' },
  projects: [
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
    { name: 'Mobile Safari', use: iphone },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
