// CLI and library tests (no network; Bright Data/GitHub/HN calls are not exercised here).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs, fmtDuration, parseValue } from '../lib/util.mjs'
import { computeCheckpoints, clock, defaultState, PRESETS, CHECKPOINT_IDS } from '../lib/state.mjs'
import { nextStep } from '../lib/status.mjs'
import { scanText, scanDiff } from '../lib/secrets.mjs'
import { saturationLevel } from '../lib/sources.mjs'
import { slimSerp } from '../lib/web.mjs'
import { mcpCommand, PROFILES } from '../lib/mcp.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BIN = path.join(ROOT, 'bin', 'hackforge')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hf-cli-'))
const hf = (cwd, ...args) => {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...process.env, HACKFORGE_PROJECT: '', CLAUDE_PROJECT_DIR: '' } })
  let json = null
  try { json = JSON.parse(r.stdout) } catch {}
  return { ...r, json }
}

test('parseArgs: flags, booleans, repeats, --', () => {
  const { flags, pos } = parseArgs(['repos', 'a b', '--n', '5', '--fresh', '--k=v', '--tag', 'x', '--tag', 'y', '--', '--literal'], ['fresh'])
  assert.deepEqual(pos, ['repos', 'a b', '--literal'])
  assert.equal(flags.n, '5')
  assert.equal(flags.fresh, true)
  assert.equal(flags.k, 'v')
  assert.deepEqual(flags.tag, ['x', 'y'])
})

test('parseValue + fmtDuration', () => {
  assert.equal(parseValue('42'), 42)
  assert.deepEqual(parseValue('[{"a":1}]'), [{ a: 1 }])
  assert.equal(parseValue('hello world'), 'hello world')
  assert.equal(fmtDuration(90 * 60000), '1h30m')
  assert.equal(fmtDuration(26 * 3600000), '1d2h')
  assert.equal(fmtDuration(-5 * 60000), '-5m')
})

test('checkpoints stay strictly ordered for every event length', () => {
  for (const h of [2, 3, 12, 24, 36, 48, 60, 72, 96, 120, 168, 240]) {
    const start = '2026-10-10T00:00:00Z'
    const deadline = new Date(Date.parse(start) + h * 3600000).toISOString()
    const s = defaultState({ start, deadline })
    const dues = CHECKPOINT_IDS.map(id => Date.parse(s.checkpoints[id].due))
    for (let i = 1; i < dues.length; i++) assert.ok(dues[i] > dues[i - 1], `${h}h: ${CHECKPOINT_IDS[i]} must be after ${CHECKPOINT_IDS[i - 1]}`)
    assert.ok(dues.at(-1) <= Date.parse(deadline) - 30 * 60000 || h <= 1, `${h}h: SUBMITTED must leave ≥30 min`)
  }
})

test('timezones: naive times read in --tz, unknown tz and offset-less times rejected', () => {
  const s = defaultState({ start: '2026-10-17T09:00', deadline: '2026-10-18T09:00', tz: 'America/New_York' })
  assert.equal(s.event.start, '2026-10-17T13:00:00.000Z')
  assert.throws(() => defaultState({ start: '2026-10-17T09:00', deadline: '2026-10-18T09:00' }), /no timezone offset/)
  assert.throws(() => defaultState({ start: '2026-10-17T09:00Z', deadline: '2026-10-18T09:00Z', tz: 'Mars/Olympus' }), /unknown --tz/)
  assert.equal(defaultState({ start: '2026-10-17T09:00Z', deadline: '2026-10-18T09:00Z', stack: 'python' }).stack.devPort, 7860)
})

test('checkpoints: 24h preset percentages and the 30-minute submit floor', () => {
  const cps = computeCheckpoints('2026-10-17T09:00:00Z', '2026-10-18T09:00:00Z', '24h')
  assert.deepEqual(CHECKPOINT_IDS, Object.keys(cps))
  assert.equal(cps.IDEA_LOCK.due, new Date(Date.parse('2026-10-17T09:00:00Z') + 0.08 * 86400000).toISOString())
  assert.equal(cps.FEATURE_FREEZE.due, '2026-10-18T03:00:00.000Z')
  // 92% of 24h = 22:04:48 into the event; floor is T-30m = 23:30 → 92% wins.
  assert.equal(cps.SUBMITTED.due, new Date(Date.parse('2026-10-17T09:00:00Z') + 0.92 * 86400000).toISOString())
  // 2-hour event: 92% = T-9.6min → floor T-30m wins.
  const short = computeCheckpoints('2026-10-17T09:00:00Z', '2026-10-17T11:00:00Z', '24h')
  assert.equal(short.SUBMITTED.due, '2026-10-17T10:30:00.000Z')
  for (const p of Object.values(PRESETS)) {
    const vals = CHECKPOINT_IDS.map(id => p[id])
    assert.deepEqual([...vals].sort((a, b) => a - b), vals, 'preset percentages must increase')
  }
})

test('clock modes: pre, normal, crunch, frozen, final, over', () => {
  const s = defaultState({ start: '2026-10-17T00:00:00Z', deadline: '2026-10-18T00:00:00Z', format: '24h' })
  const at = h => clock(s, new Date(Date.parse('2026-10-17T00:00:00Z') + h * 3600000)).mode
  assert.equal(at(-1), 'pre')
  assert.equal(at(5), 'normal')
  assert.equal(at(8), 'crunch', 'SKELETON_DEPLOYED (30% = 7.2h) overdue and not done → behind schedule')
  s.checkpoints.SKELETON_DEPLOYED.done = '2026-10-17T07:00:00Z'
  assert.equal(at(8), 'normal')
  assert.equal(at(14), 'crunch', 'WOW_WORKS (55%) overdue')
  s.checkpoints.WOW_WORKS.done = '2026-10-17T13:00:00Z'
  assert.equal(at(17), 'normal')
  assert.equal(at(18.5), 'frozen')
  assert.equal(at(21), 'final')
  assert.equal(at(25), 'over')
  const c = clock(defaultState({ start: '2026-10-17T00:00:00Z', deadline: '2026-10-18T00:00:00Z', format: '24h' }), new Date('2026-10-17T03:00:00Z'))
  assert.equal(c.overdue.map(o => o.id).join(), 'IDEA_LOCK,SPEC_LOCK')
  assert.equal(c.next.id, 'SKELETON_DEPLOYED')
})

test('nextStep: walks the phases in order and lets crunch override', () => {
  const dir = tmp()
  const s = defaultState({ start: '2026-10-17T00:00:00Z', deadline: '2026-10-18T00:00:00Z' })
  const hfd = path.join(dir, '.hackforge')
  fs.mkdirSync(path.join(hfd, 'research'), { recursive: true })
  fs.mkdirSync(path.join(hfd, 'ideas'), { recursive: true })
  const t0 = new Date('2026-10-17T00:30:00Z')
  assert.equal(nextStep(dir, s, t0).skill, '/hackforge:kickoff')
  fs.writeFileSync(path.join(hfd, 'rubric.json'), '{}')
  fs.writeFileSync(path.join(hfd, 'HACKATHON.md'), '#')
  assert.equal(nextStep(dir, s, t0).skill, '/hackforge:research')
  fs.writeFileSync(path.join(hfd, 'research', 'OPPORTUNITIES.md'), '#')
  assert.equal(nextStep(dir, s, t0).skill, '/hackforge:ideate')
  s.gates.A.locked = true
  assert.equal(nextStep(dir, s, t0).skill, '/hackforge:spec')
  s.gates.B.locked = true
  assert.match(nextStep(dir, s, t0).why, /skeleton/i)
  // frozen with nothing deployed → deploy what works now (urgent), not ship
  const frozenNoDeploy = nextStep(dir, s, new Date('2026-10-17T19:00:00Z'))
  assert.equal(frozenNoDeploy.skill, '/hackforge:build')
  assert.equal(frozenNoDeploy.urgent, true)
  // behind schedule before freeze → urgent cut
  const behind = nextStep(dir, s, new Date('2026-10-17T08:00:00Z'))
  assert.equal(behind.mode, 'crunch')
  assert.match(behind.why, /Behind schedule/)
  s.checkpoints.SKELETON_DEPLOYED.done = '2026-10-17T07:00:00Z'
  assert.equal(nextStep(dir, s, new Date('2026-10-17T19:00:00Z')).skill, '/hackforge:ship')
  // after Gate C: wait for the human to submit, don't regenerate
  s.gates.C.locked = true
  assert.equal(nextStep(dir, s, new Date('2026-10-17T21:00:00Z')).waitForHuman, true)
  s.gates.C.locked = false
  s.checkpoints.SKELETON_DEPLOYED.done = null
  // idea lock overdue at 15% → urgent ideate
  s.gates.A.locked = false
  const late = nextStep(dir, s, new Date('2026-10-17T03:36:00Z'))
  assert.equal(late.skill, '/hackforge:ideate')
  assert.equal(late.urgent, true)
})

test('CLI init → status → gate prerequisites → checkpoint → state set', () => {
  const dir = tmp()
  let r = hf(dir, 'init', '--name', 'T', '--theme', 'civic', '--start', '2026-10-17T09:00:00-07:00', '--deadline', '2026-10-18T09:00:00-07:00', '--tz', 'America/Los_Angeles')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.json.created, true)
  assert.ok(fs.existsSync(path.join(dir, '.hackforge', 'rubric.json')))
  assert.ok(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8').includes('.hackforge/web/'))
  r = hf(dir, 'status', '--brief')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /HackForge · T/)
  assert.ok(r.stdout.length <= 1500)
  r = hf(dir, 'gate', 'A', '--lock')
  assert.equal(r.status, 5)
  assert.match(r.stderr, /IDEA\.md/)
  fs.writeFileSync(path.join(dir, '.hackforge', 'ideas', 'IDEA.md'), '# IDEA: Permit triage\n')
  r = hf(dir, 'gate', 'A', '--lock', '--note', 'permit')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.json.locked, true)
  r = hf(dir, 'checkpoint', 'list')
  assert.ok(r.json.checkpoints.find(c => c.id === 'IDEA_LOCK').done, 'locking Gate A marks IDEA_LOCK done')
  r = hf(dir, 'checkpoint', 'SKELETON_DEPLOYED', '--done', '--url', 'https://x.vercel.app')
  assert.equal(r.json.url, 'https://x.vercel.app')
  assert.equal(hf(dir, 'state', 'get', 'stack.prodUrl').json, 'https://x.vercel.app')
  r = hf(dir, 'state', 'set', 'budget.webCredits', '500')
  assert.equal(r.json.value, 500)
  r = hf(dir, 'state', 'set', 'gates.B.locked', 'true')
  assert.notEqual(r.status, 0, 'gates must go through `hackforge gate`')
  assert.notEqual(hf(dir, 'state', 'set', 'gates', '{"B":{"locked":true}}').status, 0, 'whole-object gate writes are blocked too')
  assert.notEqual(hf(dir, 'state', 'set', 'checkpoints', '{}').status, 0)
  // --note alone updates the note without marking done
  r = hf(dir, 'checkpoint', 'WOW_WORKS', '--note', '--half working, fallback missing')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.json.done, null)
  assert.equal(r.json.note, '--half working, fallback missing')
  // re-init applies scale/budget/stack and reports what changed
  r = hf(dir, 'init', '--scale', 'small', '--budget', '120', '--stack', 'python')
  assert.equal(r.status, 0, r.stderr)
  assert.ok(r.json.updated.includes('scale') && r.json.updated.includes('budget.webCredits'))
  assert.equal(hf(dir, 'state', 'get', 'stack.devPort').json, 7860)
  // re-init keeps gates, updates deadline
  r = hf(dir, 'init', '--deadline', '2026-10-18T12:00:00-07:00')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(hf(dir, 'gate', 'A').json.locked, true)
  assert.equal(hf(dir, 'state', 'get', 'event.deadline').json, '2026-10-18T19:00:00.000Z')
})

test('CLI: commands needing a project fail with a helpful message outside one', () => {
  const r = hf(tmp(), 'status')
  assert.equal(r.status, 4)
  assert.match(r.stderr, /hackforge init/)
})

test('CLI: unknown command and help', () => {
  assert.equal(hf(tmp(), 'nope').status, 2)
  const h = hf(tmp(), 'help')
  assert.equal(h.status, 0)
  assert.match(h.stdout, /web search/)
})

// Fake key fixtures are assembled at runtime so no key-shaped literal lives in the repo
// (GitHub push protection and other scanners would otherwise flag this test file).
const FAKE = {
  ant: (c = 'A') => ['sk', 'ant', 'api03', c.repeat(40)].join('-'),
  aws: () => 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP',
  ghp: () => 'gh' + 'p_' + '0123456789abcdefghijklmnopqrstuvwxyzAB',
}

test('secrets: detects common key shapes, ignores env refs and placeholders, redacts', () => {
  const text = [
    `ANTHROPIC_API_KEY=${FAKE.ant()}`,
    `const k = "${FAKE.aws()}"`,
    `token: ${FAKE.ghp()}`,
    'OPENAI_API_KEY=${OPENAI_API_KEY}',
    'API_KEY = process.env.API_KEY',
    'STRIPE_SECRET_KEY=your_stripe_secret_key_here',
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=abc',
    `harmless = "${FAKE.ant('B')}" // hackforge:allow-secret`,
  ].join('\n')
  const f = scanText(text, 'x.env')
  const rules = f.map(x => x.rule)
  assert.ok(rules.includes('anthropic-key'))
  assert.ok(rules.includes('aws-access-key'))
  assert.ok(rules.includes('github-token'))
  assert.ok(rules.includes('client-exposed-secret'))
  assert.ok(!f.some(x => x.line === 4 || x.line === 5 || x.line === 6 || x.line === 8), JSON.stringify(f))
  assert.ok(f.every(x => !x.match.includes('AAAAAAAAAAAAAAAAAAAA')), 'matches must be redacted')
})

test('secrets: diff scanner reports added lines with new-file line numbers', () => {
  const diff = ['diff --git a/app.ts b/app.ts', '--- a/app.ts', '+++ b/app.ts', '@@ -10,0 +11,2 @@', '+const a = 1', `+const key = "${FAKE.aws()}"`, '--- a/package-lock.json', '+++ b/package-lock.json', '@@ -1,0 +1 @@', `+"${FAKE.aws()}"`].join('\n')
  const f = scanDiff(diff)
  assert.equal(f.length, 1)
  assert.equal(f[0].file, 'app.ts')
  assert.equal(f[0].line, 12)
})

test('saturationLevel heuristic', () => {
  assert.equal(saturationLevel({}), 'unknown')
  assert.equal(saturationLevel({ github_total: 5, github_top_stars: 10, hn_total: 3 }), 'low')
  assert.equal(saturationLevel({ github_total: 13114, github_top_stars: 13582, hn_total: 232 }), 'high')
})

test('slimSerp keeps the useful fields only', () => {
  const s = slimSerp({ general: { query: 'q', results_cnt: 2800 }, organic: [{ rank: 1, title: 't', link: 'l', description: 'd', icon: 'data:image/png;base64,AAAA', display_link: '200+ comments' }], related: [{ text: 'r' }] }, 10)
  assert.equal(s.results_cnt, 2800)
  assert.equal(s.organic[0].icon, undefined)
  assert.equal(s.organic[0].display_link, '200+ comments')
  assert.deepEqual(s.related, ['r'])
})

test('mcp profiles: exact pins, ${VAR} secrets only, --write merges without overwriting', () => {
  for (const p of Object.values(PROFILES)) {
    for (const def of Object.values({ ...p.servers, ...(p.optional || {}) })) {
      for (const a of def.args || []) if (/^[@a-z].*mcp|^shadcn/.test(a)) assert.match(a, /@\d+\.\d+\.\d+$/, `unpinned: ${a}`)
      assert.ok(!/(sk-|ghp_|AKIA)/.test(JSON.stringify(def)), 'no literal secrets')
    }
  }
  const dir = tmp()
  fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { vercel: { type: 'http', url: 'https://custom' } } }))
  const r = mcpCommand('web', { write: true }, dir)
  assert.ok(r.skipped.includes('vercel'))
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.mcp.json'), 'utf8'))
  assert.equal(cfg.mcpServers.vercel.url, 'https://custom', 'existing entries are never overwritten')
  assert.ok(cfg.mcpServers.supabase.url.includes('${SUPABASE_PROJECT_REF}'))
  assert.equal(cfg.mcpServers.supabase.requiredEnv, undefined, 'internal fields are stripped')
  const printed = mcpCommand('research', {}, dir)
  assert.ok(printed.commands.every(c => c.startsWith('claude mcp add --scope project')))
})
