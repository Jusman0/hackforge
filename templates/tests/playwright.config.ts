// HackForge template: copy to the hackathon repo root as playwright.config.ts.
// Install once: npm i -D @playwright/test && npx playwright install chromium
// Run:  npx playwright test tests/golden-path.spec.ts                        (BASE_URL defaults to http://localhost:3000)
//       GOLDEN_SMOKE=1 BASE_URL="https://<prod alias>" npx playwright test tests/golden-path.spec.ts
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',          // use './e2e' if the spec lives there; guard-edits protects tests/golden-path* and e2e/golden-path*
  // Playwright WIPES outputDir at the start of every run, so it gets its own subfolder. Agent evidence lives in sibling
  // folders it never touches: test-results/golden-path/ (this spec's step screenshots), test-results/qa/, test-results/judge/.
  // All of test-results/ is gitignored by `hackforge init`.
  outputDir: 'test-results/playwright',
  fullyParallel: false,
  workers: 1,                  // one journey through one shared app state
  retries: 0,                  // a flaky golden path is a broken demo: fail loudly, never retry it green
  forbidOnly: !!process.env.CI,
  timeout: 90_000,             // whole journey; per-step dead-air budgets live in the spec (maxMs)
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    video: 'retain-on-failure',
    trace: 'retain-on-failure', // npx playwright show-trace test-results/playwright/<test>/trace.zip
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  // One browser. Desktop Chrome is 1280x720, the same size demo/record-demo.mjs records at.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // No webServer block on purpose: the main session owns the dev server (`hackforge dev up`); tests only use it.
});
