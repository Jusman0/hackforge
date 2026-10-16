#!/usr/bin/env node
// HackForge demo recorder: records the golden path (.hackforge/spec/DEMO_SCRIPT.md) as a 1280x720 WebM plus an .srt file.
// Copy to demo/record-demo.mjs in the hackathon repo. Needs: npm i -D playwright && npx playwright install chromium
//
//   node demo/record-demo.mjs --discover --path /    dump the visible interactive elements of a page (to write selectors)
//   node demo/record-demo.mjs --rehearse             fast run, no video; every selector must be visible -> "REHEARSAL PASSED"
//   node demo/record-demo.mjs                        record -> demo/out/<timestamp>.webm + .srt, then prints the ffmpeg commands
//   BASE_URL="https://<prod alias>" node demo/record-demo.mjs        (default http://localhost:3000)
// Flags: --headed (watch it) · --slowmo <ms> (record pacing, default 60) · --captions (also draw captions on the page)
//        --no-cursor (no cursor dot / click ripple)
//
// Before recording: app running with DEMO_MODE=1, DEMO_SCRIPT "Reset procedure" done, notifications off.
// Rehearsal performs the real clicks (fast), so run the reset procedure again between --rehearse and the recording.
// Playwright video has NO audio. Narration is a human voice track recorded separately (ETHGlobal bans TTS/AI voiceover).
// Record a clean take at WOW_WORKS and again at FEATURE_FREEZE; keep the MP4 on local disk as the live-demo backup.
// Pattern adapted from ECC skills/ui-demo (MIT): Discover -> Rehearse -> Record, cursor overlay, pacing. Code is HackForge's own.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// =============================================================================================================
// STEPS: one entry per DEMO_SCRIPT beat, in order. Same order and selectors as tests/golden-path.spec.ts.
//   caption  <= 60 chars. Becomes an .srt cue (and an on-page caption with --captions). Recording refuses TODO captions.
//   action   async (page, h) => {}. Use the h.* helpers (below) so rehearse and record both work:
//            h.goto(url) · h.click(sel, label) · h.type(sel, text, label) · h.select(sel, value, label) · h.press(key)
//            h.see(sel, label, { timeout }) · h.scrollTo(sel, label) · h.pause(ms) · h.rec (true while recording)
//            sel = CSS / Playwright selector string, or a Locator (e.g. page.getByRole('button', { name: 'Run' })).
//   holdMs   how long to linger after the action so viewers can read the result (2-4 s is typical).
// =============================================================================================================
const STEPS = [
  {
    caption: 'TODO: hook, e.g. "<Name>: <task> in <new time>"', // DEMO_SCRIPT 0:00
    action: async (page, h) => {
      await h.goto('/');
      await h.see('[data-testid="TODO-hero"]', 'hero heading'); // TODO: the first thing a judge reads
    },
    holdMs: 3000,
  },
  {
    caption: 'TODO: step 1, e.g. "Load a real sample case"', // DEMO_SCRIPT 0:15
    action: async (page, h) => {
      await h.click(page.getByRole('button', { name: /TODO load sample/i }), 'Load sample button');
    },
    holdMs: 2000,
  },
  {
    caption: 'TODO: the aha in one line', // DEMO_SCRIPT 0:35, the aha must land by 1:00
    action: async (page, h) => {
      await h.type('[data-testid="TODO-input"]', 'TODO clipboard-ready input from DEMO_SCRIPT', 'main input');
      await h.click(page.getByRole('button', { name: /TODO run/i }), 'Run button');
      await h.see('[data-testid="TODO-artifact"]', 'aha artifact', { timeout: 30_000 }); // DEMO_MODE keeps this fast
    },
    holdMs: 4000,
  },
  {
    caption: 'TODO: judge-style input variant', // DEMO_SCRIPT 1:05
    action: async (page, h) => {
      await h.type('[data-testid="TODO-input"]', 'TODO judge-style input', 'main input');
      await h.click(page.getByRole('button', { name: /TODO run/i }), 'Run button');
      await h.see('[data-testid="TODO-artifact"]', 'variant result', { timeout: 30_000 });
    },
    holdMs: 2500,
  },
  {
    caption: 'TODO: the eval number / before -> after', // DEMO_SCRIPT 1:20
    action: async (page, h) => {
      await h.scrollTo('[data-testid="TODO-eval-number"]', 'eval number');
    },
    holdMs: 3000,
  },
];

// ---------- Settings ----------
const SIZE = { width: 1280, height: 720 };      // >= 720p is the floor (ETHGlobal); use 1920x1080 for 1080p footage
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PACE = { afterNav: 1500, beforeClick: 250, afterClick: 900, afterType: 600, afterScroll: 1200, typeMs: 35 }; // record mode only
const SELECTOR_TIMEOUT_MS = 10_000;              // per-call default; pass { timeout } for slow steps
const SRT_OFFSET_MS = 0;                         // shift every cue if captions lead (+) or lag (-) the picture
const COLOR_SCHEME = 'light';                    // deterministic look between takes
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, 'out');          // demo/out/ (gitignored by `hackforge init`)
const REPO_ROOT = path.resolve(HERE, '..');      // where .hackforge/rubric.json lives

const USAGE = 'Usage: node demo/record-demo.mjs [--discover [--path /x]] [--rehearse] [--headed] [--slowmo 60] [--captions] [--no-cursor]';
let args;
try {
  ({ values: args } = parseArgs({ options: {
    rehearse: { type: 'boolean', default: false },
    discover: { type: 'boolean', default: false },
    path: { type: 'string', default: '/' },
    headed: { type: 'boolean', default: false },
    slowmo: { type: 'string', default: '60' },
    captions: { type: 'boolean', default: false },
    'no-cursor': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  } }));
} catch (err) {
  console.error(`ERROR ${err.message}\n${USAGE}`);
  process.exit(2);
}

// ---------- Helpers ----------
const pad = (n, w = 2) => String(n).padStart(w, '0');
const stamp = (d = new Date()) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const srtTime = (ms) => {
  const t = Math.max(0, Math.round(ms + SRT_OFFSET_MS));
  return `${pad(Math.floor(t / 3600000))}:${pad(Math.floor(t / 60000) % 60)}:${pad(Math.floor(t / 1000) % 60)},${pad(t % 1000, 3)}`;
};
const toSrt = (cues) => cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
const fmtSec = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

function videoLimitSeconds() {
  try {
    const rubric = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.hackforge', 'rubric.json'), 'utf8'));
    return Number(rubric?.video?.maxSeconds) || null;
  } catch {
    return null; // no HackForge project here, or no limit recorded
  }
}

/** Prints the visible interactive elements: the Discover phase, and the evidence when a selector fails. */
async function dumpVisible(page, log = console.error) {
  const rows = await page
    .evaluate(() => {
      const out = [];
      const sel = 'a[href], button, input, select, textarea, [role="button"], [role="tab"], [contenteditable="true"], [data-testid]';
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
        const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('name') || '')
          .trim().replace(/\s+/g, ' ').slice(0, 40);
        const tid = el.getAttribute('data-testid');
        const type = el.getAttribute('type');
        out.push(`${el.tagName.toLowerCase()}${type ? `[type=${type}]` : ''}${tid ? ` [data-testid="${tid}"]` : ''} "${name}"`);
        if (out.length >= 40) break;
      }
      return out;
    })
    .catch(() => []);
  log(`  visible elements on ${page.url()}:\n    ${rows.join('\n    ') || '(none)'}`);
}

/**
 * Runs inside every new document of the recording (context.addInitScript), so it survives full navigations.
 * CSSOM + Web Animations only (no <style> tag), so a strict page CSP cannot block it. Mounts lazily on the first
 * mouse event or caption, after the app has hydrated, and re-mounts if the app re-renders <body>.
 */
function overlay({ cursor, captions }) {
  if (window !== window.top) return; // not inside iframes
  const ACCENT = 'rgba(255, 90, 60, 0.92)';
  let dot = null;
  let bar = null;
  let text = '';
  const make = (css) => {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = css;
    (document.body || document.documentElement).appendChild(el);
    return el;
  };
  const ensure = () => {
    if (cursor && !(dot && dot.isConnected)) {
      dot = make(`position:fixed;left:-100px;top:-100px;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;
        background:${ACCENT};border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35);z-index:2147483647;pointer-events:none;
        transition:transform .1s ease`);
    }
    if (captions && !(bar && bar.isConnected)) {
      bar = make(`position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:80%;padding:10px 18px;border-radius:10px;
        background:rgba(15,17,21,.82);color:#fff;font:600 22px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;
        z-index:2147483646;pointer-events:none;transition:opacity .25s;opacity:0`);
    }
  };
  window.__hfCaption = (t) => {
    text = t || '';
    if (!captions) return;
    ensure();
    bar.textContent = text;
    bar.style.opacity = text ? '1' : '0';
  };
  const opts = { capture: true, passive: true };
  addEventListener('mousemove', (e) => {
    ensure();
    if (dot) { dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`; }
  }, opts);
  addEventListener('mousedown', (e) => {
    if (!cursor) return;
    ensure();
    dot.style.transform = 'scale(.7)';
    const ring = make(`position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:46px;height:46px;margin:-23px 0 0 -23px;
      border-radius:50%;border:3px solid ${ACCENT};z-index:2147483646;pointer-events:none`);
    ring.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 650, easing: 'ease-out' })
      .onfinish = () => ring.remove();
  }, opts);
  addEventListener('mouseup', () => { if (dot) dot.style.transform = ''; }, opts);
}

/** The h.* API given to every STEPS action. Rehearse: verify and act fast. Record: glide the cursor, type visibly, pause. */
function makeHelpers(page, rec, slowMo) {
  let mouse = { x: SIZE.width / 2, y: SIZE.height / 2 };
  const loc = (target) => (typeof target === 'string' ? page.locator(target).first() : target);
  const describe = (target) => (typeof target === 'string' ? target : String(target));
  const pause = (ms) => (rec && ms > 0 ? page.waitForTimeout(ms) : Promise.resolve());

  async function visible(target, label, timeout = SELECTOR_TIMEOUT_MS) {
    const el = loc(target);
    try {
      await el.waitFor({ state: 'visible', timeout });
      return el;
    } catch {
      await dumpVisible(page);
      throw new Error(`"${label}" not visible after ${timeout} ms (selector: ${describe(target)})`);
    }
  }
  async function glide(x, y) { // eased path instead of a teleporting cursor
    const dist = Math.hypot(x - mouse.x, y - mouse.y);
    const n = Math.min(18, Math.max(6, Math.round(dist / 40)));
    const from = { ...mouse };
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; // easeInOutCubic
      await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
      if (slowMo < 16) await page.waitForTimeout(16 - slowMo);
    }
    mouse = { x, y };
  }
  async function pointAt(el) {
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    if (box) await glide(box.x + box.width / 2, box.y + box.height / 2);
  }

  return {
    rec,
    pause,
    async goto(url) {
      await page.goto(new URL(url, BASE_URL).href, { waitUntil: 'load' });
      await pause(PACE.afterNav);
      if (rec) await page.mouse.move(mouse.x, mouse.y); // re-show the cursor dot (after hydration) following a full navigation
    },
    async click(target, label, opts = {}) {
      const el = await visible(target, label, opts.timeout);
      if (rec) { await pointAt(el); await pause(PACE.beforeClick); }
      await el.click();
      await pause(opts.after ?? PACE.afterClick);
    },
    async type(target, text, label, opts = {}) {
      const el = await visible(target, label, opts.timeout);
      if (rec) {
        await pointAt(el);
        await el.click();
        await el.fill('');
        await el.pressSequentially(text, { delay: PACE.typeMs });
      } else {
        await el.fill(text);
      }
      await pause(PACE.afterType);
    },
    async select(target, value, label, opts = {}) {
      const el = await visible(target, label, opts.timeout);
      if (rec) { await pointAt(el); await pause(PACE.beforeClick); }
      await el.selectOption(value);
      await pause(PACE.afterClick);
    },
    async press(key) {
      await page.keyboard.press(key);
      await pause(PACE.afterClick);
    },
    async see(target, label, opts = {}) { // assert visible; while recording, also point the cursor at it
      const el = await visible(target, label, opts.timeout);
      if (rec) await pointAt(el);
    },
    async scrollTo(target, label, opts = {}) {
      const el = await visible(target, label, opts.timeout);
      if (rec) {
        await el.evaluate((node) => node.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await pause(PACE.afterScroll);
      } else {
        await el.scrollIntoViewIfNeeded();
      }
    },
  };
}

// ---------- Modes ----------
async function discover() {
  const browser = await chromium.launch({ headless: !args.headed });
  try {
    const page = await (await browser.newContext({ viewport: SIZE, colorScheme: COLOR_SCHEME })).newPage();
    await page.goto(new URL(args.path, BASE_URL).href, { waitUntil: 'load' });
    console.log(`DISCOVER ${page.url()}`);
    await dumpVisible(page, console.log);
  } finally {
    await browser.close();
  }
}

async function runSteps(rec) {
  const slowMo = rec ? Math.max(0, Number(args.slowmo) || 0) : 0;
  const rawDir = path.join(OUT_DIR, '.raw');
  const browser = await chromium.launch({ headless: !args.headed, slowMo });
  try {
    const context = await browser.newContext({
      viewport: SIZE,
      deviceScaleFactor: 1,
      colorScheme: COLOR_SCHEME,
      ...(rec ? { recordVideo: { dir: rawDir, size: SIZE } } : {}),
    });
    if (rec) await context.addInitScript(overlay, { cursor: !args['no-cursor'], captions: args.captions });

    let mainPage = null;
    context.on('page', (p) => { if (mainPage) console.warn(`WARN popup opened (${p.url()}): popups record as a separate video`); });
    const page = await context.newPage();
    mainPage = page;
    const t0 = Date.now(); // the video starts when the page is created; cue times are relative to this

    const problems = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`uncaught: ${e.message}`));

    let caption = '';
    const paint = () => page.evaluate((t) => window.__hfCaption && window.__hfCaption(t), caption).catch(() => {});
    if (rec && args.captions) page.on('load', paint); // re-draw the caption after full navigations

    const h = makeHelpers(page, rec, slowMo);
    const cues = [];
    let failure = null;
    for (const [i, step] of STEPS.entries()) {
      const label = `${pad(i + 1)} ${step.caption}`;
      const start = Date.now() - t0;
      caption = step.caption;
      if (rec && args.captions) await paint();
      try {
        await step.action(page, h);
        await h.pause(step.holdMs ?? 2000);
      } catch (err) {
        failure = { label, message: err?.message || String(err) };
        break;
      }
      const end = Date.now() - t0;
      cues.push({ start, end, text: step.caption });
      console.log(`${rec ? 'RECORDED    ' : 'REHEARSAL OK'}  ${label}  (${((end - start) / 1000).toFixed(1)} s)`);
    }
    caption = '';
    if (rec && args.captions) await paint();

    const video = rec ? page.video() : null;
    await context.close(); // finalises the video file
    let webm = null;
    if (video) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      webm = path.join(OUT_DIR, `${stamp()}${failure ? '-FAILED' : ''}.webm`);
      await video.saveAs(webm);
      await video.delete();
      fs.rmSync(rawDir, { recursive: true, force: true });
    }
    return { cues, failure, problems, webm };
  } finally {
    await browser.close().catch(() => {});
  }
}

function printFfmpeg(webm, srt) {
  const base = path.basename(webm, '.webm');
  const sub = path.basename(srt);
  const vf = args.captions ? '' : `-vf "subtitles=${sub}" `; // captions already drawn on the page with --captions
  console.log(`
Next: convert with ffmpeg (the subtitles filter needs an ffmpeg built with libass). The WebM has no audio track.
  cd "${path.dirname(webm)}"
  # Silent MP4 with burned-in captions: review copy and PITCH.html backup (cp ${base}.mp4 demo.mp4)
  ffmpeg -i ${base}.webm ${vf}-c:v libx264 -pix_fmt yuv420p -crf 20 -an ${base}.mp4
  # Final: add your recorded HUMAN narration (narration.wav), loudness-normalised, captions burned in
  ffmpeg -i ${base}.webm -i narration.wav -map 0:v -map 1:a ${vf}-c:v libx264 -pix_fmt yuv420p -crf 20 -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a aac -b:a 160k -shortest ${base}-narrated.mp4
  ffprobe -v error -show_entries format=duration -of csv=p=0 ${base}-narrated.mp4   # seconds; must be <= rubric video.maxSeconds
Upload ${sub} as closed captions too (judges often watch muted). Open the public link logged out before submitting.`);
}

async function main() {
  if (args.help) {
    console.log(USAGE);
    return;
  }
  new URL(BASE_URL); // throws early on a malformed BASE_URL
  if (args.discover) return discover();

  const rec = !args.rehearse;
  const placeholders = STEPS.filter((s) => /TODO|\{\{/.test(s.caption));
  const long = STEPS.filter((s) => s.caption.length > 60);
  for (const s of long) console.warn(`WARN caption over 60 chars (${s.caption.length}): "${s.caption}"`);
  if (placeholders.length) {
    const msg = `${placeholders.length} caption(s) still contain TODO/{{…}}: fill them from DEMO_SCRIPT`;
    if (rec) { console.error(`REFUSING TO RECORD: ${msg}`); process.exitCode = 1; return; }
    console.warn(`WARN ${msg}`);
  }

  console.log(`${rec ? 'RECORD' : 'REHEARSE'} ${BASE_URL} at ${SIZE.width}x${SIZE.height}, ${STEPS.length} steps`);
  const { cues, failure, problems, webm } = await runSteps(rec);
  for (const p of problems) console.warn(`WARN ${p}`);

  if (failure) {
    console.error(`\n${rec ? 'RECORDING' : 'REHEARSAL'} FAILED at step ${failure.label}\n  ${failure.message}`);
    console.error(rec ? `  Partial video kept for debugging: ${webm}` : '  Fix the selector (try --discover --path <page>) before recording.');
    process.exitCode = 1;
    return;
  }

  const totalMs = cues.length ? cues[cues.length - 1].end : 0;
  const limit = videoLimitSeconds();
  if (!rec) {
    console.log(`\nREHEARSAL PASSED: ${cues.length} steps, every selector visible. Holds alone add ${fmtSec(STEPS.reduce((a, s) => a + (s.holdMs ?? 2000), 0))}.`);
    return;
  }
  const srt = webm.replace(/\.webm$/, '.srt');
  fs.writeFileSync(srt, toSrt(cues));
  console.log(`\nVideo:    ${webm}\nCaptions: ${srt}\nFootage:  ${fmtSec(totalMs)}${limit ? ` (event limit ${fmtSec(limit * 1000)})` : ''}`);
  if (limit && totalMs > limit * 1000) console.warn(`WARN footage is longer than the event limit: cut holdMs or steps. Never speed footage up.`);
  printFfmpeg(webm, srt);
}

main().catch((err) => {
  console.error(`ERROR ${err?.stack || err}`);
  process.exitCode = 1;
});
