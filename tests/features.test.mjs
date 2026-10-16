// Tests for behaviour added after the first live run: SERP retry simplification, direct fetch + PDFs,
// URL probing (auth walls), checkpoint tags + probe enforcement, week submit floor, contract-aware
// SLICES guard, commit-cadence nudge, per-hook kill switch, status line, full-history secret scan.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { simplifyQuery, htmlToText } from '../lib/web.mjs'
import { probeUrl } from '../lib/probe.mjs'
import { computeCheckpoints, defaultState } from '../lib/state.mjs'
import { statusLine } from '../lib/status.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BIN = path.join(ROOT, 'bin', 'hackforge')
const HOOK = n => path.join(ROOT, 'scripts', 'hooks', n)

let server
let base
process.env.HACKFORGE_PROBE_ALLOW_LOCAL = '1' // the test server is on loopback; real use rejects local URLs
before(async () => {
  server = http.createServer((req, res) => {
    const u = req.url
    if (u === '/ok') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html><head><title>Permit Copilot</title><style>x{}</style></head><body><h1>Permit Copilot</h1><p>Hello <a href="/x">link</a></p><script>bad()</script></body></html>') }
    if (u === '/to-login') { res.writeHead(302, { location: '/login?next=/' }); return res.end() }
    if (u === '/to-vercel') { res.writeHead(307, { location: 'https://vercel.com/sso-api?url=x' }); return res.end() }
    if (u === '/hop') { res.writeHead(301, { location: '/ok' }); return res.end() }
    if (u === '/401') { res.writeHead(401); return res.end('no') }
    if (u === '/protected') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<title>Vercel Authentication</title> Log in to continue') }
    if (u === '/doc.pdf') { res.writeHead(200, { 'content-type': 'application/pdf' }); return res.end('%PDF-1.4 fake') }
    res.writeHead(404); res.end()
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

// Run the CLI asynchronously (spawnSync would block this process's event loop, which serves the test HTTP server).
function hfAsync(cwd, args, env = {}) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [BIN, ...args], { cwd, env: { ...process.env, HACKFORGE_PROJECT: '', CLAUDE_PROJECT_DIR: '', ...env } })
    let stdout = ''
    let stderr = ''
    p.stdout.on('data', d => { stdout += d })
    p.stderr.on('data', d => { stderr += d })
    p.on('close', status => {
      let json = null
      try { json = JSON.parse(stdout) } catch {}
      resolve({ status, stdout, stderr, json })
    })
  })
}

function gitProject({ startOffsetH = -1, hours = 24, gateB = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-feat-'))
  spawnSync('git', ['init', '-q'], { cwd: dir })
  spawnSync('git', ['config', 'user.email', 't@t'], { cwd: dir })
  spawnSync('git', ['config', 'user.name', 't'], { cwd: dir })
  const start = new Date(Date.now() + startOffsetH * 3600000).toISOString()
  const deadline = new Date(Date.parse(start) + hours * 3600000).toISOString()
  const r = spawnSync(process.execPath, [BIN, 'init', '--name', 'Feat', '--start', start, '--deadline', deadline], { cwd: dir, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  if (gateB) {
    const sp = path.join(dir, '.hackforge', 'state.json')
    const s = JSON.parse(fs.readFileSync(sp, 'utf8'))
    s.gates.B.locked = true
    fs.writeFileSync(sp, JSON.stringify(s))
  }
  return dir
}

function hook(name, input, env = {}) {
  const r = spawnSync(process.execPath, [HOOK(name)], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, HACKFORGE_HOOKS: '', HACKFORGE_DISABLED_HOOKS: '', CLAUDE_PROJECT_DIR: '', ...env } })
  let json = null
  try { json = r.stdout ? JSON.parse(r.stdout) : null } catch {}
  return { ...r, json }
}
const decision = r => r.json?.hookSpecificOutput?.permissionDecision || 'allow'

test('simplifyQuery drops site paths, quotes and date operators', () => {
  assert.equal(simplifyQuery('site:devpost.com/software "building permit" AI'), 'site:devpost.com building permit AI')
  assert.equal(simplifyQuery('"AI" "permit review" city after:2024-01-01 before:2025-01-01'), 'AI permit review city')
  assert.equal(simplifyQuery('plain query'), null)
})

test('htmlToText strips scripts/styles, keeps headings and links', () => {
  const t = htmlToText('<html><style>a{}</style><h1>Title</h1><p>Body <a href="https://x.y">here</a></p><script>evil()</script></html>')
  assert.match(t, /# Title/)
  assert.match(t, /here \(https:\/\/x\.y\)/)
  assert.ok(!/evil|a\{\}/.test(t))
})

test('probeUrl: public page ok; login/vercel/401/protection screens fail', async () => {
  const ok = await probeUrl(`${base}/hop`)
  assert.equal(ok.ok, true)
  assert.equal(ok.title, 'Permit Copilot')
  assert.equal(ok.chain.length, 2)
  for (const p of ['/to-login', '/to-vercel', '/401', '/protected', '/missing']) {
    const r = await probeUrl(base + p)
    assert.equal(r.ok, false, p)
    assert.ok(r.problem, p)
  }
})

test('checkpoint SKELETON_DEPLOYED: probes the URL, refuses auth walls, tags git, --force overrides', async () => {
  const dir = gitProject()
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x')
  spawnSync('git', ['add', '-A'], { cwd: dir })
  spawnSync('git', ['commit', '-qm', 'init'], { cwd: dir })
  let r = await hfAsync(dir, ['checkpoint', 'SKELETON_DEPLOYED', '--done', '--url', `${base}/to-login`])
  assert.equal(r.status, 14, r.stderr)
  assert.match(r.stderr, /login/)
  r = await hfAsync(dir, ['checkpoint', 'SKELETON_DEPLOYED', '--done', '--url', `${base}/ok`])
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.json.tag, 'hf-cp/SKELETON_DEPLOYED')
  assert.equal(r.json.probe.ok, true)
  assert.match(spawnSync('git', ['tag'], { cwd: dir, encoding: 'utf8' }).stdout, /hf-cp\/SKELETON_DEPLOYED/)
  r = await hfAsync(dir, ['checkpoint', 'VIDEO_DONE', '--done', '--url', `${base}/401`, '--force'])
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.json.probe.ok, false)
})

test('web scrape --direct: free fetch, HTML → text, PDF saved for Read; devpost refused without consent', async () => {
  const dir = gitProject()
  let r = await hfAsync(dir, ['web', 'scrape', `${base}/ok`, '--direct', '--print'])
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.json.via, 'direct')
  assert.match(r.json.content, /# Permit Copilot/)
  r = await hfAsync(dir, ['web', 'scrape', `${base}/doc.pdf`, '--direct'])
  assert.equal(r.json.pdf, true)
  assert.ok(r.json.file.endsWith('.pdf'))
  const ledger = fs.readFileSync(path.join(dir, '.hackforge', 'web', 'ledger.tsv'), 'utf8')
  assert.match(ledger, /\tdirect\t0\t/)
  r = await hfAsync(dir, ['web', 'scrape', 'https://devpost.com/software/anything'])
  assert.equal(r.status, 10)
})

test('week format: SUBMITTED floor is min(12h, 8% of the span) before the deadline', () => {
  const five = computeCheckpoints('2026-10-12T00:00:00Z', '2026-10-17T00:00:00Z', 'week') // 5 days → 9.6h floor
  assert.ok(Date.parse(five.SUBMITTED.due) <= Date.parse('2026-10-17T00:00:00Z') - 9.6 * 3600000)
  const seven = computeCheckpoints('2026-10-10T00:00:00Z', '2026-10-17T00:00:00Z', 'week') // 7 days → 12h floor
  assert.ok(Date.parse(seven.SUBMITTED.due) <= Date.parse('2026-10-16T12:00:00Z'))
  assert.ok(Date.parse(seven.VIDEO_DONE.due) < Date.parse(seven.SUBMITTED.due))
})

test('probe rejects local/private URLs unless explicitly allowed (tests only)', async () => {
  const saved = process.env.HACKFORGE_PROBE_ALLOW_LOCAL
  delete process.env.HACKFORGE_PROBE_ALLOW_LOCAL
  try {
    for (const u of ['http://localhost:3000', 'http://127.0.0.1:8080', 'http://192.168.1.20:3000', 'http://my-mac.local:3000', 'http://[::1]:3000']) {
      const r = await probeUrl(u)
      assert.equal(r.ok, false, u)
    }
    const dp = await probeUrl('https://devpost.com/software/whatever')
    assert.equal(dp.ok, true)
    assert.match(dp.skipped, /not fetched/)
  } finally {
    process.env.HACKFORGE_PROBE_ALLOW_LOCAL = saved
  }
})

test('statusLine: compact countdown with gates and next checkpoint', () => {
  const s = defaultState({ start: '2026-10-17T00:00:00Z', deadline: '2026-10-18T00:00:00Z' })
  const line = statusLine('/nonexistent', s, new Date('2026-10-17T05:00:00Z'))
  assert.match(line, /^HF T-19h00m · LATE IDEA_LOCK · SKELETON_DEPLOYED in 2h12m · A✗B✗C✗ · kickoff$/)
})

test('guard-edits: SLICES.md board edits pass, contract edits ask, Write that keeps contracts passes', () => {
  const dir = gitProject({ gateB: true })
  const f = path.join(dir, '.hackforge', 'spec', 'SLICES.md')
  fs.copyFileSync(path.join(ROOT, 'templates', 'spec', 'SLICES.md'), f)
  const text = fs.readFileSync(f, 'utf8')
  const boardRow = text.match(/\| S1 \|[^\n]*\n/)[0]
  let r = hook('guard-edits.mjs', { cwd: dir, tool_name: 'Edit', tool_input: { file_path: f, old_string: boardRow, new_string: boardRow.replace('todo', 'pass') } })
  assert.equal(decision(r), 'allow', r.stdout)
  const contractLine = text.match(/\| 1 \| Dev server up[^\n]*/)[0]
  r = hook('guard-edits.mjs', { cwd: dir, tool_name: 'Edit', tool_input: { file_path: f, old_string: contractLine, new_string: contractLine.replace('`200`', '`200 or 500`') } })
  assert.equal(decision(r), 'ask')
  r = hook('guard-edits.mjs', { cwd: dir, tool_name: 'Write', tool_input: { file_path: f, content: text.replace(boardRow, boardRow.replace('todo', 'qa')) } })
  assert.equal(decision(r), 'allow')
  r = hook('guard-edits.mjs', { cwd: dir, tool_name: 'Write', tool_input: { file_path: f, content: text.replace(/<!-- CONTRACT S2 BEGIN -->[\s\S]*?<!-- CONTRACT S2 END -->/, '') } })
  assert.equal(decision(r), 'ask', 'deleting a contract block is a contract change')
})

test('clock-nudge: reminds to commit after 90+ minutes without one (during build), at most hourly', () => {
  const dir = gitProject({ gateB: true, startOffsetH: -0.2 })
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x')
  spawnSync('git', ['add', '-A'], { cwd: dir })
  const old = new Date(Date.now() - 3 * 3600000).toISOString()
  spawnSync('git', ['commit', '-qm', 'old'], { cwd: dir, env: { ...process.env, GIT_COMMITTER_DATE: old, GIT_AUTHOR_DATE: old } })
  // silence the checkpoint part: first nudge happened just now
  fs.writeFileSync(path.join(dir, '.hackforge', 'nudge.json'), JSON.stringify({ lastAt: new Date().toISOString() }))
  let r = hook('clock-nudge.mjs', { cwd: dir, prompt: 'hi' })
  assert.match(r.json.hookSpecificOutput.additionalContext, /No commit for 3h/)
  r = hook('clock-nudge.mjs', { cwd: dir, prompt: 'again' })
  assert.equal(r.stdout, '', 'commit reminder is rate-limited')
})

test('HACKFORGE_DISABLED_HOOKS turns off a single hook', () => {
  const dir = gitProject()
  const input = { cwd: dir, tool_name: 'Bash', tool_input: { command: 'git commit --no-verify -m x' } }
  assert.equal(decision(hook('git-guard.mjs', input)), 'deny')
  assert.equal(hook('git-guard.mjs', input, { HACKFORGE_DISABLED_HOOKS: 'clock-nudge, git-guard' }).stdout, '')
})

test('secrets --history scans every commit including the root', async () => {
  const dir = gitProject()
  fs.writeFileSync(path.join(dir, 'leak.ts'), `const k = "AKIA${'A'.repeat(16)}"\n`)
  spawnSync('git', ['add', 'leak.ts'], { cwd: dir })
  spawnSync('git', ['commit', '-qm', 'root with leak'], { cwd: dir })
  fs.writeFileSync(path.join(dir, 'leak.ts'), 'const k = process.env.K\n')
  spawnSync('git', ['commit', '-qam', 'remove leak'], { cwd: dir })
  const tracked = await hfAsync(dir, ['secrets', '--tracked'])
  assert.equal(tracked.status, 0, 'current tree is clean')
  const hist = await hfAsync(dir, ['secrets', '--history'])
  assert.equal(hist.status, 1, 'history still contains the leaked key → rotate it')
  assert.equal(hist.json.findings[0].rule, 'aws-access-key')
})
