// .hackforge/state.json model: init, get/set, gates, checkpoints, clock.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CliError, findProjectDir, hfDir, readJSON, writeJSON, parseTime, fmtDuration,
  getPath, setPath, ensureGitignore, nowISO, run, validTimeZone,
} from './util.mjs'

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const CHECKPOINT_IDS = ['IDEA_LOCK', 'SPEC_LOCK', 'SKELETON_DEPLOYED', 'WOW_WORKS', 'FEATURE_FREEZE', 'VIDEO_DONE', 'SUBMITTED']

// Percent of the event clock at which each checkpoint is due (playbook timeline.md / DESIGN §4.1).
export const PRESETS = {
  '24h': { IDEA_LOCK: 8, SPEC_LOCK: 12, SKELETON_DEPLOYED: 30, WOW_WORKS: 55, FEATURE_FREEZE: 75, VIDEO_DONE: 85, SUBMITTED: 92 },
  '48h': { IDEA_LOCK: 8, SPEC_LOCK: 12, SKELETON_DEPLOYED: 25, WOW_WORKS: 50, FEATURE_FREEZE: 75, VIDEO_DONE: 85, SUBMITTED: 92 },
  week: { IDEA_LOCK: 8, SPEC_LOCK: 20, SKELETON_DEPLOYED: 35, WOW_WORKS: 55, FEATURE_FREEZE: 78, VIDEO_DONE: 88, SUBMITTED: 93 },
}
PRESETS.custom = PRESETS['24h']

export const CHECKPOINT_EXIT = {
  IDEA_LOCK: 'Gate A locked; .hackforge/ideas/IDEA.md written',
  SPEC_LOCK: 'Gate B locked; DEMO_SCRIPT.md + SLICES.md written',
  SKELETON_DEPLOYED: 'Public prod URL returns 200, no auth wall, golden-path smoke green',
  WOW_WORKS: 'Aha works with real input; fallbacks in place (then run /hackforge:judge)',
  FEATURE_FREEZE: 'Only golden-path fixes from here on',
  VIDEO_DONE: 'Public video URL within the length limit',
  SUBMITTED: 'Checklist 100%, Gate C locked, submission confirmed',
}

// Submit no later than deadline minus this floor (playbook: ≥30 min early; week-long events: ~12 h early,
// scaled down for shorter "week" events so the floor never swallows the video/freeze windows).
export function submitFloorMs(format, span) {
  return format === 'week' ? Math.min(12 * 3600 * 1000, span * 0.08) : 30 * 60 * 1000
}
export const SCALES = ['small', 'medium', 'large']
export const STACK_DEFAULTS = {
  web: { devCommand: 'npm run dev', devPort: 3000 },
  python: { devCommand: 'python app.py', devPort: 7860 }, // Gradio default; Streamlit: streamlit run app.py --server.port $PORT (8501)
  mobile: { devCommand: 'npx expo start --web --port $PORT', devPort: 8081 },
  custom: { devCommand: 'npm run dev', devPort: 3000 },
}

// Judge files that guard-edits protects after Gate B (anti-Goodhart). Paths relative to the project root.
export const JUDGE_ALWAYS = ['.hackforge/rubric.json', '.hackforge/spec/SLICES.md', '.hackforge/spec/DEMO_SCRIPT.md']
export const JUDGE_CONFIG_RE = /^(\.eslintrc[^/]*|eslint\.config\.[cm]?[jt]s|\.prettierrc[^/]*|prettier\.config\.[cm]?[jt]s|biome\.jsonc?|tsconfig[^/]*\.json|playwright\.config\.[cm]?[jt]s|vitest\.config\.[cm]?[jt]s|jest\.config\.[cm]?[jt]s|pytest\.ini|pyproject\.toml)$/
export const GOLDEN_RE = /(^|\/)golden-path[^/]*\.(spec|test)\.[cm]?[jt]sx?$|^(tests|e2e)\/golden-path/

export function goldenTests(projectDir) {
  const out = []
  for (const d of ['tests', 'e2e', '.']) {
    const abs = path.join(projectDir, d)
    if (!fs.existsSync(abs)) continue
    for (const f of fs.readdirSync(abs)) if (/^golden-path.*\.(spec|test)\.[cm]?[jt]sx?$/.test(f)) out.push(path.posix.join(d === '.' ? '' : d, f))
  }
  return out
}

// Snapshot of judge files that exist now (configs created later are not retroactively locked).
export function judgeSnapshot(projectDir) {
  const files = [...JUDGE_ALWAYS.filter(f => fs.existsSync(path.join(projectDir, f))), ...goldenTests(projectDir)]
  try {
    for (const f of fs.readdirSync(projectDir)) if (JUDGE_CONFIG_RE.test(f)) files.push(f)
  } catch {}
  return [...new Set(files)]
}

export const PHASES = ['kickoff', 'research', 'ideate', 'spec', 'build', 'judge', 'ship', 'done']

export const GATE_PREREQS = {
  A: ['ideas/IDEA.md'],
  B: ['spec/DEMO_SCRIPT.md', 'spec/SLICES.md'],
  C: ['ship/SUBMISSION_CHECKLIST.md'],
}

const DIRS = ['research', 'ideas', 'ideas/top', 'spec', 'build', 'build/feedback', 'ship', 'web']

export const GITIGNORE_LINES = ['.env', '.env.*', '!.env.example', '.hackforge/web/', '.hackforge/dev.json', '.hackforge/dev.log', '.hackforge/nudge.json', 'test-results/', 'demo/out/']

export function inferFormat(start, deadline) {
  const h = (deadline - start) / 3600000
  if (h <= 30) return '24h'
  if (h <= 80) return '48h'
  return 'week'
}

export function computeCheckpoints(startISO, deadlineISO, format, prev = {}) {
  const start = parseTime(startISO, 'start')
  const deadline = parseTime(deadlineISO, 'deadline')
  if (deadline <= start) throw new CliError('deadline must be after start')
  const pcts = PRESETS[format] || PRESETS['24h']
  const span = deadline - start
  const cps = {}
  for (const id of CHECKPOINT_IDS) {
    const pct = prev[id]?.pctOverride ?? pcts[id]
    let due = start.getTime() + (span * pct) / 100
    if (id === 'SUBMITTED') due = Math.min(due, deadline.getTime() - submitFloorMs(format, span))
    cps[id] = {
      pct,
      dueMs: due,
      done: prev[id]?.done ?? null,
      note: prev[id]?.note ?? '',
      url: prev[id]?.url ?? '',
      ...(prev[id]?.pctOverride != null ? { pctOverride: prev[id].pctOverride } : {}),
      ...(prev[id]?.tag ? { tag: prev[id].tag } : {}),
    }
  }
  // Keep checkpoints strictly ordered: if the submit floor pulled SUBMITTED earlier, pull the ones
  // before it earlier too (backward pass), never before the start.
  const gap = Math.max(5 * 60 * 1000, span * 0.01)
  for (let i = CHECKPOINT_IDS.length - 2; i >= 0; i--) {
    const a = cps[CHECKPOINT_IDS[i]]
    const b = cps[CHECKPOINT_IDS[i + 1]]
    if (a.dueMs > b.dueMs - gap) a.dueMs = b.dueMs - gap
  }
  for (const id of CHECKPOINT_IDS) {
    const c = cps[id]
    c.due = new Date(Math.max(start.getTime(), c.dueMs)).toISOString()
    delete c.dueMs
  }
  return cps
}

function validateOpts(o) {
  if (o.tz && !validTimeZone(o.tz)) throw new CliError(`unknown --tz "${o.tz}" (use an IANA zone like America/Los_Angeles)`)
  if (o.format && !PRESETS[o.format]) throw new CliError(`--format must be one of ${Object.keys(PRESETS).join(', ')}`)
  if (o.scale && !SCALES.includes(o.scale)) throw new CliError(`--scale must be one of ${SCALES.join(', ')}`)
  if (o.stack && !STACK_DEFAULTS[o.stack]) throw new CliError(`--stack must be one of ${Object.keys(STACK_DEFAULTS).join(', ')}`)
  for (const k of ['teamSize', 'budget', 'devPort']) if (o[k] != null && !(Number(o[k]) > 0)) throw new CliError(`--${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())} must be a positive number`)
}

export function defaultState(o) {
  validateOpts(o)
  const start = parseTime(o.start, 'start', o.tz)
  const deadline = parseTime(o.deadline, 'deadline', o.tz)
  const format = o.format || inferFormat(start, deadline)
  const sd = STACK_DEFAULTS[o.stack || 'web']
  const devPort = Number(o.devPort || sd.devPort)
  return {
    version: 1,
    event: {
      name: o.name || 'Untitled hackathon',
      url: o.url || '',
      theme: o.theme || '',
      tracks: [],
      start: start.toISOString(),
      deadline: deadline.toISOString(),
      timezone: o.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      format,
    },
    // members: [{ name, role: driver|integrator|demo-owner|researcher, skills: [], plan: pro|max5x|max20x|team|api }]
    team: { size: Number(o.teamSize || 1), members: [], domains: [] },
    // Workflow fan-out default (args.scale). Pro plans / small workflow-size guideline → small.
    scale: o.scale || 'medium',
    sponsors: [],
    stack: {
      profile: o.stack || 'web',
      devCommand: o.devCommand || sd.devCommand,
      devPort,
      devUrl: `http://localhost:${devPort}`,
      prodUrl: '',
      repoUrl: '',
    },
    phase: 'kickoff',
    gates: { A: { locked: false, at: null, note: '' }, B: { locked: false, at: null, note: '' }, C: { locked: false, at: null, note: '' } },
    checkpoints: computeCheckpoints(start.toISOString(), deadline.toISOString(), format),
    budget: { webCredits: Number(o.budget || 300) },
    hooks: { profile: 'fast' },
  }
}

export function statePath(projectDir) {
  return path.join(hfDir(projectDir), 'state.json')
}

export function requireProject(flags = {}) {
  const dir = findProjectDir(flags.project)
  if (!dir) throw new CliError('no .hackforge/state.json found here or in any parent — run `hackforge init` (or /hackforge:kickoff) first', 4)
  return dir
}

export function loadState(projectDir) {
  const s = readJSON(statePath(projectDir), null)
  if (!s) throw new CliError(`cannot read ${statePath(projectDir)}`, 4)
  return s
}

export function saveState(projectDir, state) {
  writeJSON(statePath(projectDir), state)
}

export function initProject(projectDir, o) {
  const dir = hfDir(projectDir)
  const sp = statePath(projectDir)
  let created = false
  let state
  if (fs.existsSync(sp) && !o.force) {
    state = loadState(projectDir)
    validateOpts(o)
    // Re-init (e.g. when the rules change) applies every flag passed, without losing gates/checkpoints.
    const updated = []
    const set = (obj, k, v, label) => { if (v != null && v !== '' && obj[k] !== v) { obj[k] = v; updated.push(label) } }
    set(state.event, 'name', o.name, 'name')
    set(state.event, 'theme', o.theme, 'theme')
    set(state.event, 'url', o.url, 'url')
    set(state.event, 'timezone', o.tz, 'timezone')
    set(state, 'scale', o.scale, 'scale')
    if (o.teamSize) set(state.team, 'size', Number(o.teamSize), 'team.size')
    if (o.budget) set(state.budget, 'webCredits', Number(o.budget), 'budget.webCredits')
    // Stack defaults apply only when the profile actually changes (never clobber a customised dev command/port).
    if (o.stack && o.stack !== state.stack.profile) {
      set(state.stack, 'profile', o.stack, 'stack.profile')
      if (!o.devCommand) set(state.stack, 'devCommand', STACK_DEFAULTS[o.stack].devCommand, 'stack.devCommand')
      if (!o.devPort) o.devPort = STACK_DEFAULTS[o.stack].devPort
    }
    set(state.stack, 'devCommand', o.devCommand, 'stack.devCommand')
    if (o.devPort) {
      set(state.stack, 'devPort', Number(o.devPort), 'stack.devPort')
      state.stack.devUrl = `http://localhost:${state.stack.devPort}`
    }
    if (o.start || o.deadline || o.format) {
      const tz = o.tz || state.event.timezone
      state.event.start = parseTime(o.start || state.event.start, 'start', tz).toISOString()
      state.event.deadline = parseTime(o.deadline || state.event.deadline, 'deadline', tz).toISOString()
      if (Date.parse(state.event.deadline) <= Date.parse(state.event.start)) throw new CliError('deadline must be after start')
      state.event.format = o.format || state.event.format
      state.checkpoints = computeCheckpoints(state.event.start, state.event.deadline, state.event.format, state.checkpoints)
      updated.push('timing')
    }
    if (updated.length) saveState(projectDir, state)
    o.__updated = updated
  } else {
    if (!o.start || !o.deadline) throw new CliError('init needs --start and --deadline (ISO 8601 with timezone offset)')
    state = defaultState(o)
    saveState(projectDir, state)
    created = true
  }
  for (const d of DIRS) fs.mkdirSync(path.join(dir, d), { recursive: true })
  const rubric = path.join(dir, 'rubric.json')
  let rubricCreated = false
  if (!fs.existsSync(rubric)) {
    fs.copyFileSync(path.join(PLUGIN_ROOT, 'templates', 'rubric.default.json'), rubric)
    rubricCreated = true
  }
  const hk = path.join(dir, 'HACKATHON.md')
  let hackathonCreated = false
  const tpl = path.join(PLUGIN_ROOT, 'templates', 'HACKATHON.md')
  if (!fs.existsSync(hk) && fs.existsSync(tpl)) {
    fs.copyFileSync(tpl, hk)
    hackathonCreated = true
  }
  const gitignored = ensureGitignore(projectDir, GITIGNORE_LINES)
  const tz = state.event.timezone
  return {
    projectDir, created, ...(created ? {} : { updated: o.__updated || [] }), rubricCreated, hackathonCreated, gitignoreAdded: gitignored, state,
    // Echo the parsed times in the event's zone so a wrong offset is visible immediately.
    startLocal: localTime(state.event.start, tz, true), deadlineLocal: localTime(state.event.deadline, tz, true),
  }
}

export function gateStatus(projectDir, state, id) {
  const g = state.gates[id]
  if (!g) throw new CliError('gate must be A, B or C')
  const missing = GATE_PREREQS[id].filter(f => !fs.existsSync(path.join(hfDir(projectDir), f)))
  const blockers = []
  const warnings = []
  if (id === 'B') {
    // The golden-path test is the acceptance gate for every merge and is protected after B, so it must
    // be runnable now: selectors come from DEMO_SCRIPT's test-id column, never "TODO".
    const tests = goldenTests(projectDir)
    if (!tests.length) warnings.push('no tests/golden-path.spec.* found — QA will have no golden-path gate (copy templates/tests/golden-path.spec.ts)')
    for (const t of tests) {
      const n = (fs.readFileSync(path.join(projectDir, t), 'utf8').match(/\bTODO\b/g) || []).length
      if (n) blockers.push(`${t} still has ${n} TODO marker(s) — name the test ids in DEMO_SCRIPT.md and write the steps against them before locking`)
    }
  }
  return { gate: id, ...g, prerequisites: GATE_PREREQS[id], missing, blockers, warnings }
}

export function lockGate(projectDir, state, id, { unlock = false, note = '', force = false } = {}) {
  const st = gateStatus(projectDir, state, id)
  if (!unlock && st.missing.length) {
    throw new CliError(`gate ${id} cannot lock — missing: ${st.missing.map(f => '.hackforge/' + f).join(', ')}`, 5)
  }
  if (!unlock && st.blockers.length && !force) throw new CliError(`gate ${id} cannot lock — ${st.blockers.join('; ')}. Fix these first (only a human may override with --force).`, 5)
  state.gates[id] = unlock ? { locked: false, at: null, note } : { locked: true, at: nowISO(), note, ...(id === 'B' ? { protected: judgeSnapshot(projectDir) } : {}) }
  if (!unlock) {
    const phaseAfter = { A: 'spec', B: 'build', C: 'done' }[id]
    if (PHASES.indexOf(phaseAfter) > PHASES.indexOf(state.phase)) state.phase = phaseAfter
    const cp = { A: 'IDEA_LOCK', B: 'SPEC_LOCK' }[id]
    if (cp && !state.checkpoints[cp].done) {
      saveState(projectDir, state)
      markCheckpoint(projectDir, state, cp, { done: true }) // same path as `checkpoint --done`: tags hf-cp/<ID>
      return gateStatus(projectDir, state, id)
    }
  }
  saveState(projectDir, state)
  return gateStatus(projectDir, state, id)
}

export function markCheckpoint(projectDir, state, id, { done = true, url, note } = {}) {
  if (!CHECKPOINT_IDS.includes(id)) throw new CliError(`checkpoint must be one of ${CHECKPOINT_IDS.join(', ')}`)
  const cp = state.checkpoints[id]
  cp.done = done ? nowISO() : null
  if (url) cp.url = url
  if (note) cp.note = note
  if (id === 'SKELETON_DEPLOYED' && url) state.stack.prodUrl = url
  // Configs scaffolded during S1 (tsconfig, eslint, playwright…) join the protected set once the skeleton ships.
  if (done && id === 'SKELETON_DEPLOYED' && state.gates.B?.locked) state.gates.B.protected = [...new Set([...(state.gates.B.protected || []), ...judgeSnapshot(projectDir)])]
  // A lightweight git tag per checkpoint = a known-good point to roll back to (git checkout hf-cp/<ID>).
  let tag = null
  if (done && run('git', ['rev-parse', '--verify', 'HEAD'], { cwd: projectDir, timeoutMs: 5000 }).status === 0) {
    const t = `hf-cp/${id}`
    if (run('git', ['tag', '-f', t], { cwd: projectDir, timeoutMs: 5000 }).status === 0) tag = t
  }
  if (tag) cp.tag = tag
  saveState(projectDir, state)
  return { id, ...cp }
}

// Clock: remaining time, % elapsed, current window, next checkpoint, overdue checkpoints.
export function clock(state, now = new Date()) {
  const start = parseTime(state.event.start, 'start', 'UTC')
  const deadline = parseTime(state.event.deadline, 'deadline', 'UTC')
  const t = now.getTime()
  const span = deadline - start
  const pctElapsed = Math.max(0, Math.min(100, ((t - start) / span) * 100))
  const cps = CHECKPOINT_IDS.map(id => ({ id, ...state.checkpoints[id], dueMs: Date.parse(state.checkpoints[id].due) }))
  const overdue = cps.filter(c => !c.done && c.dueMs <= t).map(c => ({ id: c.id, due: c.due, late: fmtDuration(t - c.dueMs) }))
  const nextCp = cps.find(c => !c.done && c.dueMs > t) || null
  const passed = cps.filter(c => c.dueMs <= t)
  const current = passed.length ? passed[passed.length - 1].id : 'START'
  const frozen = t >= Date.parse(state.checkpoints.FEATURE_FREEZE.due)
  const final = t >= Date.parse(state.checkpoints.VIDEO_DONE.due)
  // crunch = behind schedule: the skeleton or the aha is overdue before freeze → cut and deploy now.
  const behind = ['SKELETON_DEPLOYED', 'WOW_WORKS'].some(id => !state.checkpoints[id]?.done && Date.parse(state.checkpoints[id].due) <= t)
  let mode = 'normal'
  if (t < start) mode = 'pre'
  else if (t >= deadline) mode = 'over'
  else if (final) mode = 'final'
  else if (frozen) mode = 'frozen'
  else if (behind) mode = 'crunch'
  return {
    now: now.toISOString(),
    start: start.toISOString(),
    deadline: deadline.toISOString(),
    timezone: state.event.timezone,
    remainingMs: deadline - t,
    remaining: fmtDuration(deadline - t),
    remainingLabel: t >= deadline ? `deadline passed ${fmtDuration(t - deadline)} ago` : t < start ? `starts in ${fmtDuration(start - t)}` : `T-${fmtDuration(deadline - t)}`,
    sinceStart: fmtDuration(t - start),
    pctElapsed: Math.round(pctElapsed * 10) / 10,
    mode,
    current,
    next: nextCp ? { id: nextCp.id, due: nextCp.due, in: fmtDuration(nextCp.dueMs - t), exit: CHECKPOINT_EXIT[nextCp.id] } : null,
    overdue,
  }
}

export function localTime(iso, tz, full = false) {
  try {
    return new Date(iso).toLocaleString('en-US', { timeZone: tz, weekday: 'short', ...(full ? { month: 'short', day: 'numeric', timeZoneName: 'short' } : {}), hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return iso
  }
}

export { getPath, setPath }
