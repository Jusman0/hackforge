/**
 * HackForge golden-path test: walks .hackforge/spec/DEMO_SCRIPT.md beat by beat.
 *
 * Copy to tests/golden-path.spec.ts (or e2e/). The architect fills it in BEFORE Gate B, so it is runnable the moment B locks:
 *   - Selectors come from the "Test id / selector" column of .hackforge/spec/DEMO_SCRIPT.md (a stable data-testid, or an
 *     accessible role + name, per beat). Prefer getByTestId / getByRole / getByLabel; never CSS classes.
 *   - Every placeholder below carries the upper-case to-do marker. The file must contain zero of those markers when Gate B
 *     locks: `hackforge gate B --lock` refuses otherwise. (This header never spells the marker, so it does not count.)
 *   - Builders implement those test ids in the app (S1 with stub data, later slices for real). They never edit this file.
 * After Gate B the guard-edits hook protects it. To change it, a human runs `hackforge gate B --unlock --note "why"`,
 * edits it, then `hackforge gate B --lock`.
 *
 * One script, three jobs: the smoke test on every merge and against the production alias, the qa-runner's script, and
 * the source of the STEPS in demo/record-demo.mjs (keep the order and selectors identical).
 *
 *   npx playwright test tests/golden-path.spec.ts                                   # full path, BASE_URL or http://localhost:3000
 *   GOLDEN_SMOKE=1 BASE_URL="https://<prod alias>" npx playwright test tests/golden-path.spec.ts
 *     → smoke = landing + first step only. Green against the production alias (never the deployment-hash URL) closes
 *       SKELETON_DEPLOYED: `hackforge checkpoint SKELETON_DEPLOYED --done --url "https://<prod alias>"`.
 *
 * On every step it asserts: no console errors, no uncaught page errors, no 4xx/5xx responses, no failed requests.
 * Screenshots: test-results/golden-path/NN-<step>.png, one per step (attached to the report too). That folder sits outside
 * Playwright's outputDir (test-results/playwright), which Playwright wipes at the start of every run.
 * Run the app with DEMO_MODE=1 (seed data, guest user, cached slow calls) so the path is deterministic.
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const SMOKE = process.env.GOLDEN_SMOKE === '1';

/** Noise you have decided is NOT a demo problem. Keep both lists short and justify every entry in a comment. */
const IGNORE_CONSOLE: RegExp[] = [
  // /Download the React DevTools/,          // example: dev-only chatter
];
const IGNORE_URLS: RegExp[] = [
  // /\/_vercel\/insights\//,               // example: analytics beacon blocked in CI
];

type Step = {
  name: string;   // short slug: screenshot file name and step title
  beat: string;   // DEMO_SCRIPT time + what the judge sees
  maxMs?: number; // dead-air budget: the step fails if it takes longer (slow = silence on stage)
  run: (page: Page) => Promise<void>;
};

// ------------------------------------------------------------------------------------------------
// The golden path, in DEMO_SCRIPT order. STEPS[0] and STEPS[1] are the smoke test.
// Selectors = DEMO_SCRIPT's "Test id / selector" column. Assert what the judge SEES (text, numbers), not just presence.
// Replace every upper-case to-do marker below with the real beat before Gate B locks (the lock refuses while any is left).
// ------------------------------------------------------------------------------------------------
const STEPS: Step[] = [
  {
    name: 'landing',
    beat: '0:00 landing loads, sample case preloaded, no login wall',
    run: async (page) => {
      const res = await page.goto('/');
      expect(res, 'no response for /').not.toBeNull();
      expect(res!.status(), 'landing must answer 200 (no auth wall, no error page)').toBe(200);
      // Deployment protection / SSO walls redirect to another host. Judges must land on the app itself.
      // If the app legitimately redirects to another host (e.g. www.), compare against that host instead.
      expect(new URL(page.url()).host, `landing left ${new URL(BASE_URL).host} (auth wall?)`).toBe(new URL(BASE_URL).host);
      await expect(page.getByTestId('TODO-hero')).toContainText(/TODO hero text/i); // DEMO_SCRIPT 0:00: the hero text a judge reads first
    },
  },
  {
    name: 'step-1',
    beat: '0:15 TODO step 1 from DEMO_SCRIPT (e.g. load the sample case)',
    run: async (page) => {
      await page.getByRole('button', { name: /TODO load sample/i }).click();
      await expect(page.getByTestId('TODO-input-preview')).toBeVisible();
    },
  },
  {
    name: 'aha',
    beat: '0:35 TODO step 2 → the AHA artifact appears (must land by 1:00 in the demo)',
    maxMs: 20_000, // TODO: tune to the DEMO_MODE response time; cached responses should make this a few seconds
    run: async (page) => {
      await page.getByRole('button', { name: /TODO run/i }).click();
      const artifact = page.getByTestId('TODO-artifact');
      await expect(artifact).toBeVisible({ timeout: 20_000 });
      await expect(artifact).toContainText(/TODO expected visible result/i); // content, not just presence
    },
  },
  {
    name: 'judge-variant',
    beat: '1:05 a judge-style input variant still works (DEMO_SCRIPT "Judge\'s own input")',
    maxMs: 20_000,
    run: async (page) => {
      await page.getByRole('textbox', { name: /TODO input label/i }).fill('TODO a judge-style input from DEMO_SCRIPT');
      await page.getByRole('button', { name: /TODO run/i }).click();
      await expect(page.getByTestId('TODO-artifact')).toContainText(/TODO expected result or graceful message/i);
    },
  },
  {
    name: 'evidence',
    beat: '1:20 evidence on screen: eval number, before/after',
    run: async (page) => {
      await expect(page.getByTestId('TODO-eval-number')).toHaveText(/\d/); // TODO: the number you quote in the pitch
    },
  },
];

type Problem = { step: string; kind: 'console' | 'pageerror' | 'http' | 'requestfailed'; detail: string };

/** Records every console error, uncaught exception, 4xx/5xx response and failed request, tagged with the current step. */
function watch(page: Page, currentStep: () => string, problems: Problem[]): void {
  const ignoredUrl = (url: string) => IGNORE_URLS.some((re) => re.test(url));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Chromium echoes every 4xx/5xx as "Failed to load resource"; the response listener reports it with its URL.
    if (text.startsWith('Failed to load resource') || IGNORE_CONSOLE.some((re) => re.test(text))) return;
    problems.push({ step: currentStep(), kind: 'console', detail: `${text} @ ${msg.location().url}` });
  });
  page.on('pageerror', (err) => problems.push({ step: currentStep(), kind: 'pageerror', detail: err.message }));
  page.on('response', (res) => {
    if (res.status() < 400 || ignoredUrl(res.url())) return;
    problems.push({ step: currentStep(), kind: 'http', detail: `${res.status()} ${res.request().method()} ${res.url()}` });
  });
  page.on('requestfailed', (req) => {
    const err = req.failure()?.errorText ?? 'failed';
    if (err.includes('ERR_ABORTED') || ignoredUrl(req.url())) return; // cancelled prefetches and superseded navigations
    problems.push({ step: currentStep(), kind: 'requestfailed', detail: `${err} ${req.method()} ${req.url()}` });
  });
}

test(SMOKE ? 'golden path (smoke: landing + first step)' : 'golden path (full demo)', async ({ page }, testInfo) => {
  const steps = SMOKE ? STEPS.slice(0, 2) : STEPS;
  const problems: Problem[] = [];
  let current = 'setup';
  watch(page, () => current, problems);

  // Next to playwright.config.ts, NOT inside outputDir (test-results/playwright), which Playwright wipes on every run.
  const root = testInfo.config.configFile ? path.dirname(testInfo.config.configFile) : process.cwd();
  const shotDir = path.join(root, 'test-results', 'golden-path');
  fs.mkdirSync(shotDir, { recursive: true });

  for (const [i, step] of steps.entries()) {
    current = step.name;
    const nn = String(i + 1).padStart(2, '0');
    await test.step(`${nn} ${step.name}: ${step.beat}`, async () => {
      const t0 = Date.now();
      await step.run(page);
      const ms = Date.now() - t0;

      const file = path.join(shotDir, `${nn}-${step.name}.png`);
      await page.screenshot({ path: file });
      await testInfo.attach(`${nn}-${step.name}`, { path: file, contentType: 'image/png' });

      if (step.maxMs !== undefined) {
        expect.soft(ms, `"${step.name}" took ${ms} ms, budget ${step.maxMs} ms (dead air on stage)`).toBeLessThanOrEqual(step.maxMs);
      }
      expect(problems.filter((p) => p.step === step.name), `errors during "${step.name}"`).toEqual([]);
    });
  }

  // Anything that fired outside a step (setup) or arrived late still fails the run.
  expect(problems, 'errors anywhere on the golden path').toEqual([]);
});
