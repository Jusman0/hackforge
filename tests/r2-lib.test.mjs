// Round-2 review regressions for the CLI/library (no network, no paid calls).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseTime } from '../lib/util.mjs'
import { scanText } from '../lib/secrets.mjs'
import { siteIgnored } from '../lib/web.mjs'
import { probeUrl } from '../lib/probe.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BIN = path.join(ROOT, 'bin', 'hackforge')

let server
let base
before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/ok') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<title>ok</title>') }
    if (req.url === '/slow') { res.writeHead(200, { 'content-type': 'text/html' }); const iv = setInterval(() => res.write('x'), 300); req.on('close', () => clearInterval(iv)); return }
    res.writeHead(404); res.end()
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

function hf(cwd, args, env = {}) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [BIN, ...args], { cwd, env: { ...process.env, HACKFORGE_PROJECT: '', CLAUDE_PROJECT_DIR: '', HACKFORGE_WEB_BUDGET: '', ...env } })
    let so = ''
    let se = ''
    p.stdout.on('data', d => { so += d })
    p.stderr.on('data', d => { se += d })
    p.on('close', status => { let json = null; try { json = JSON.parse(so) } catch {} ; resolve({ status, stdout: so, stderr: se, json }) })
  })
}
async function project(extra = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-r2-'))
  spawnSync('git', ['init', '-q'], { cwd: dir })
  spawnSync('git', ['config', 'user.email', 't@t'], { cwd: dir })
  spawnSync('git', ['config', 'user.name', 't'], { cwd: dir })
  const start = new Date(Date.now() - 3600000).toISOString()
  const deadline = new Date(Date.now() + 23 * 3600000).toISOString()
  const r = await hf(dir, ['init', '--name', 'R2', '--start', start, '--deadline', deadline, ...extra])
  assert.equal(r.status, 0, r.stderr)
  return dir
}

test('checkpoint: a URL saved first is still probed at --done; --done without any URL is refused; --url sets prodUrl', async () => {
  const dir = await project()
  const env = { HACKFORGE_PROBE_ALLOW_LOCAL: '' }
  let r = await hf(dir, ['checkpoint', 'SKELETON_DEPLOYED', '--url', 'http://localhost:3000'], env)
  assert.equal(r.status, 14, 'a local URL is refused even when only saving it')
  r = await hf(dir, ['checkpoint', 'VIDEO_DONE', '--done'], env)
  assert.equal(r.status, 14)
  assert.match(r.stderr, /needs the public URL/)
  r = await hf(dir, ['checkpoint', 'SKELETON_DEPLOYED', '--url', `${base}/ok`], { HACKFORGE_PROBE_ALLOW_LOCAL: '1' })
  assert.equal(r.status, 0, r.stderr)
  assert.equal((await hf(dir, ['state', 'get', 'stack.prodUrl'])).json, `${base}/ok`)
  r = await hf(dir, ['checkpoint', 'SKELETON_DEPLOYED', '--done'], { HACKFORGE_PROBE_ALLOW_LOCAL: '1' })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.json.probe.ok, true, 'stored URL was probed')
})

test('gate locks tag hf-cp/<ID> like checkpoint --done', async () => {
  const dir = await project()
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x')
  spawnSync('git', ['add', '-A'], { cwd: dir })
  spawnSync('git', ['commit', '-qm', 'x'], { cwd: dir })
  fs.writeFileSync(path.join(dir, '.hackforge', 'ideas', 'IDEA.md'), '# IDEA: x')
  const r = await hf(dir, ['gate', 'A', '--lock'])
  assert.equal(r.status, 0, r.stderr)
  assert.match(spawnSync('git', ['tag'], { cwd: dir, encoding: 'utf8' }).stdout, /hf-cp\/IDEA_LOCK/)
})

test('re-init with the same --stack keeps a customised dev command/port; devUrl follows devPort', async () => {
  const dir = await project(['--stack', 'web'])
  assert.equal((await hf(dir, ['state', 'set', 'stack.devCommand', '"pnpm dev"'])).status, 0)
  assert.equal((await hf(dir, ['state', 'set', 'stack.devPort', '5173'])).status, 0)
  assert.equal((await hf(dir, ['state', 'get', 'stack.devUrl'])).json, 'http://localhost:5173')
  const r = await hf(dir, ['init', '--stack', 'web', '--deadline', new Date(Date.now() + 30 * 3600000).toISOString()])
  assert.equal(r.status, 0, r.stderr)
  assert.equal((await hf(dir, ['state', 'get', 'stack.devPort'])).json, 5173)
  assert.equal((await hf(dir, ['state', 'get', 'stack.devCommand'])).json, 'pnpm dev')
})

test('state set validates the budget (a typo cannot remove the cap) and team members keep the team size', async () => {
  const dir = await project(['--team-size', '3'])
  assert.notEqual((await hf(dir, ['state', 'set', 'budget.webCredits', '1,000'])).status, 0)
  assert.equal((await hf(dir, ['state', 'set', 'budget.webCredits', '500'])).status, 0)
  assert.equal((await hf(dir, ['state', 'set', 'team.members', '[{"name":"a"},{"name":"b"}]'])).status, 0)
  const nx = await hf(dir, ['next'])
  assert.ok(nx.json.parallel, 'Track B hint survives setting team.members')
})

test('parseTime: fractional seconds and 1-digit hours honour --tz; impossible dates and zone-less free text are rejected', () => {
  assert.equal(parseTime('2026-10-17T09:00:00.000', 't', 'America/Los_Angeles').toISOString(), '2026-10-17T16:00:00.000Z')
  assert.equal(parseTime('2026-10-17 9:00', 't', 'America/Los_Angeles').toISOString(), '2026-10-17T16:00:00.000Z')
  assert.throws(() => parseTime('2026-02-30T09:00', 't', 'UTC'), /not a real date/)
  assert.throws(() => parseTime('Oct 17 2026 09:00', 't'), /no timezone offset/)
  assert.throws(() => parseTime('2026/10/17 09:00', 't'), /no timezone offset/)
  assert.equal(parseTime('2026-10-17T09:00:00+02:00', 't').toISOString(), '2026-10-17T07:00:00.000Z')
})

test('secrets: ordinary auth code and local dev DB URLs are not flagged; real literals still are', () => {
  const benign = ['const token = response.data.accessToken', 'token.accessToken = account.access_token', 'const authToken = localStorage.getItem("authToken")', 'const token = req.headers.authorization', 'refreshToken: account.refresh_token', 'apiKey: settings.openaiApiKey', 'self.api_key = config.OPENAI_API_KEY_VALUE', 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app', 'REDIS_URL=redis://default:redispw@localhost:6379', 'password: z.string().min(8)']
  for (const l of benign) assert.equal(scanText(l, 'f').length, 0, l)
  assert.ok(scanText('NEXTAUTH_SECRET=' + '8f3kQ0pXz71L' + 'mN2vB5cD9eR4tY6uI0oP', 'f').length)
  assert.ok(scanText('const apiKey = "' + 'a1B2c3D4e5F6' + 'g7H8i9J0k1L2"', 'f').length)
  assert.ok(scanText('DATABASE_URL=postgres://app:' + 'Hx9q2LmN4' + '@db.abcd.supabase.co:5432/postgres', 'f').length)
})

test('siteIgnored: -site: exclusions and OR groups are handled', () => {
  const slim = links => ({ organic: links.map(l => ({ link: l })) })
  assert.equal(siteIgnored('meal planning -site:pinterest.com', slim(['https://a.com/x', 'https://b.com/y'])), false)
  assert.equal(siteIgnored('(site:devpost.com OR site:producthunt.com) meal', slim(['https://devpost.com/software/a', 'https://www.producthunt.com/products/b'])), false)
  assert.equal(siteIgnored('site:devpost.com meal', slim(['https://wikipedia.org/a', 'https://x.org/b'])), true)
})

test('probe: a slow streaming body cannot hang it', async () => {
  process.env.HACKFORGE_PROBE_ALLOW_LOCAL = '1'
  const t0 = Date.now()
  const r = await probeUrl(`${base}/slow`, { timeoutMs: 1500 })
  assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0}ms`)
  assert.equal(r.ok, false)
  delete process.env.HACKFORGE_PROBE_ALLOW_LOCAL
})

test('dev down never kills a process outside the project; dev up refuses a foreign server on the port', async () => {
  const dir = await project()
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-foreign-'))
  const port = 43000 + Math.floor(process.pid % 900)
  fs.writeFileSync(path.join(other, 'srv.cjs'), `require('http').createServer((q,s)=>s.end('x')).listen(${port})`)
  const foreign = spawn(process.execPath, ['srv.cjs'], { cwd: other, stdio: 'ignore' })
  await new Promise(r => setTimeout(r, 600))
  try {
    assert.equal((await hf(dir, ['state', 'set', 'stack.devPort', String(port)])).status, 0)
    const up = await hf(dir, ['dev', 'up', '--wait', '2'])
    assert.equal(up.status, 11)
    assert.match(up.stderr, /another process/)
    const down = await hf(dir, ['dev', 'down'])
    assert.equal(down.json.stopped, false)
    assert.ok(down.json.skipped?.length >= 1)
    assert.equal(foreign.exitCode, null, 'the foreign server must still be running')
  } finally {
    foreign.kill()
  }
})
