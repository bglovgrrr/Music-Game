import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests: a full demo game in a phone-sized browser, against the production build.
 * Run locally with `npm run e2e` (builds first), and on every push in CI.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // An iPhone-sized screen with Safari's bars showing.
    viewport: { width: 402, height: 760 },
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    // Use the browser installed in this container when there is one (CI installs its own).
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 402, height: 760 } } }],
  webServer: { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
})
