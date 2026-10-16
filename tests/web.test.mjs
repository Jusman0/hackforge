// Bright Data wrapper tests against a FAKE bdata on PATH (no paid calls): budget holds under
// concurrency, async reservations, sync pipe cache, SERP retry caching, blocked pages, saturation guards.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BIN = path.join(ROOT, 'bin', 'hackforge')

const FAKE = `#!/usr/bin/env node
const fs = require('fs')
const a = process.argv.slice(2)
const out = a.includes('-o') ? a[a.indexOf('-o') + 1] : null
const log = process.env.FAKE_BDATA_LOG
if (log) fs.appendFileSync(log, a.join(' ') + '\\n')
if (a[0] === 'search') {
  const q = a[1]
  if (/site:\\S+\\/\\S+/.test(q) && process.env.FAKE_FAIL_SITE_PATH) { console.error('Error: waiting for selector "#main" failed: timeout 30000ms exceeded'); process.exit(1) }
  const host = (q.match(/site:(\\S+)/) || [])[1] || 'example.com'
  const organic = Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, title: 't' + i, link: 'https://' + (process.env.FAKE_OFFSITE ? 'wikipedia.org' : host) + '/p' + i, description: 'd' }))
  fs.writeFileSync(out, JSON.stringify({ general: { query: q, results_cnt: 98000 }, organic, related: [] }))
  process.exit(0)
}
if (a[0] === 'scrape') {
  fs.writeFileSync(out, process.env.FAKE_BLOCK ? 'Just a moment... checking your browser' : process.env.FAKE_LONG_DENIED ? '# How to fix S3 errors\\n\\nWhen you see Access Denied from S3, check the bucket policy. ' + 'More prose about IAM. '.repeat(400) : '# Page\\n' + 'content '.repeat(100))
  process.exit(0)
}
if (a[0] === 'pipelines' && a[1] === 'run') {
  if (a.includes('--async')) { console.log(JSON.stringify({ snapshot_id: 'sd_' + Math.abs(a.join('').split('').reduce((h, c) => h * 31 + c.charCodeAt(0) | 0, 7)).toString(36) })); process.exit(0) }
  fs.writeFileSync(out, JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ id: i }))))
  process.exit(0)
}
if (a[0] === 'pipelines' && a[1] === 'status') { if (process.env.FAKE_STATUS_FAIL) { console.error('Error: snapshot failed: dead_page'); process.exit(1) } console.log('{"status":"ready"}'); process.exit(0) }
if (a[0] === 'pipelines' && a[1] === 'results') { fs.writeFileSync(out, JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ id: i })))); process.exit(0) }
process.exit(2)
`

function setup(budget = 300) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-web-'))
  const binDir = path.join(dir, 'fakebin')
  fs.mkdirSync(binDir)
  fs.writeFileSync(path.join(binDir, 'bdata'), FAKE, { mode: 0o755 })
  const start = new Date(Date.now() - 3600000).toISOString()
  const deadline = new Date(Date.now() + 23 * 3600000).toISOString()
  assert.equal(spawnSync(process.execPath, [BIN, 'init', '--name', 'W', '--start', start, '--deadline', deadline, '--budget', String(budget)], { cwd: dir }).status, 0)
  const env = { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}`, HACKFORGE_WEB_BUDGET: '', HACKFORGE_PROJECT: '', CLAUDE_PROJECT_DIR: '', FAKE_BDATA_LOG: path.join(dir, 'calls.log') }
  const hf = (args, extra = {}) => new Promise(resolve => {
    const p = spawn(process.execPath, [BIN, ...args], { cwd: dir, env: { ...env, ...extra } })
    let so = ''
    let se = ''
    p.stdout.on('data', d => { so += d })
    p.stderr.on('data', d => { se += d })
    p.on('close', status => { let json = null; try { json = JSON.parse(so) } catch {} ; resolve({ status, stdout: so, stderr: se, json }) })
  })
  const calls = () => (fs.existsSync(env.FAKE_BDATA_LOG) ? fs.readFileSync(env.FAKE_BDATA_LOG, 'utf8').split('\n').filter(Boolean) : [])
  return { dir, hf, calls }
}

test('budget holds under 8 concurrent searches (lock + reservations)', async () => {
  const { hf } = setup(3)
  const res = await Promise.all(Array.from({ length: 8 }, (_, i) => hf(['web', 'search', `query number ${i}`])))
  const ok = res.filter(r => r.status === 0).length
  assert.ok(ok <= 3, `${ok} searches ran on a budget of 3`)
  assert.ok(res.some(r => r.status === 6 && /budget exhausted/.test(r.stderr)))
  const ledger = await hf(['web', 'ledger'])
  assert.ok(ledger.json.credits <= 3, `ledger shows ${ledger.json.credits}`)
})

test('async pipelines reserve their estimate until harvest', async () => {
  const { hf } = setup(100)
  const a = await hf(['web', 'pipe', 'gd_abc123', 'discover_by_keyword', 'k1', '--limit', '40', '--async'])
  assert.equal(a.status, 0, a.stderr)
  assert.equal(a.json.reserved, 40)
  const b = await hf(['web', 'pipe', 'gd_abc123', 'discover_by_keyword', 'k2', '--limit', '40', '--async'])
  assert.equal(b.status, 0, b.stderr)
  const c = await hf(['web', 'pipe', 'gd_abc123', 'discover_by_keyword', 'k3', '--limit', '40', '--async'])
  assert.equal(c.status, 6, 'third 40-record reservation must exceed the 100 budget')
  const h = await hf(['web', 'harvest', a.json.snapshot_id])
  assert.equal(h.status, 0, h.stderr)
  const l = await hf(['web', 'ledger'])
  assert.equal(l.json.credits, 12 + 40, 'harvest replaces the 40 reservation with the 12 real records; the other reservation stays')
})

test('sync pipe results are cached (identical calls are not billed twice)', async () => {
  const { hf, calls } = setup()
  const args = ['web', 'pipe', 'gd_m6zagkt024uwvvwuyu', 'collect_by_url', 'https://play.google.com/store/apps/details?id=x', '--num_of_reviews', '20']
  const one = await hf(args)
  assert.equal(one.status, 0, one.stderr)
  const two = await hf(args)
  assert.equal(two.json.cached, true)
  assert.equal(calls().filter(c => c.startsWith('pipelines run')).length, 1)
})

test('review pipelines estimate per-record billing before the call', async () => {
  const { hf } = setup(10)
  const r = await hf(['web', 'pipe', 'gd_m6zagkt024uwvvwuyu', 'collect_by_url', 'https://play.google.com/x', '--num_of_reviews', '30'])
  assert.equal(r.status, 6, '30 review records cannot fit a 10-credit budget')
})

test('SERP retry: simplified query is cached separately and still reported; saturation ignores it', async () => {
  const { hf } = setup()
  const env = { FAKE_FAIL_SITE_PATH: '1' }
  const first = await hf(['web', 'search', 'building permit', '--site', 'devpost.com/software'], env)
  assert.equal(first.status, 0, first.stderr)
  assert.equal(first.json.retriedAs, 'site:devpost.com building permit')
  const second = await hf(['web', 'search', 'building permit', '--site', 'devpost.com/software'], env)
  assert.equal(second.json.cached, true)
  assert.equal(second.json.retriedAs, 'site:devpost.com building permit', 'cache hit keeps the retry visible')
  const sat = await hf(['saturation', 'building permit'], env)
  assert.equal(sat.json.signals.devpost_serp, undefined)
  assert.ok(sat.json.warnings.some(w => /fell back/.test(w)))
})

test('SERP: off-site results are flagged and not used as saturation counts', async () => {
  const { hf } = setup()
  const r = await hf(['web', 'search', 'meal planner', '--site', 'producthunt.com/products'], { FAKE_OFFSITE: '1' })
  assert.equal(r.json.siteIgnored, true)
})

test('blocked pages are not cached; --direct is a separate cache', async () => {
  const { hf, calls } = setup()
  const blocked = await hf(['web', 'scrape', 'https://example.com/a'], { FAKE_BLOCK: '1' })
  assert.equal(blocked.json.blocked, true)
  assert.equal(blocked.json.file, null)
  const ok = await hf(['web', 'scrape', 'https://example.com/a'])
  assert.equal(ok.json.cached, false, 'block page must not have been cached')
  assert.equal(ok.json.blocked, false)
  assert.equal(calls().filter(c => c.startsWith('scrape')).length, 2)
  const ledger = await hf(['web', 'ledger'])
  assert.ok(ledger.json.recent.some(r => r.status === 'blocked'))
})

test('outside a project the budget message points at HACKFORGE_WEB_BUDGET, not state set', async () => {
  const { hf } = setup()
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-cache-'))
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-out-'))
  const r = await new Promise(resolve => {
    const p = spawn(process.execPath, [BIN, 'web', 'search', 'x'], { cwd: outside, env: { ...process.env, HACKFORGE_CACHE: cache, HACKFORGE_WEB_BUDGET: '0', HACKFORGE_PROJECT: '', CLAUDE_PROJECT_DIR: '' } })
    let se = ''
    p.stderr.on('data', d => { se += d })
    p.on('close', status => resolve({ status, stderr: se }))
  })
  assert.equal(r.status, 6)
  assert.match(r.stderr, /HACKFORGE_WEB_BUDGET/)
  assert.doesNotMatch(r.stderr, /state set/)
  void hf
})

test('failed async snapshot releases its reservation; web release frees a stuck one; harvest --fresh is not billed twice', async () => {
  const { hf } = setup(100)
  const a = await hf(['web', 'pipe', 'gd_lk9q0ew71spt1mxywf', 'collect_by_url', 'u1', 'u2', 'u3', '--async'])
  assert.equal(a.json.reserved, 90)
  const failed = await hf(['web', 'harvest', a.json.snapshot_id], { FAKE_STATUS_FAIL: '1' })
  assert.notEqual(failed.status, 0)
  assert.match(failed.stderr, /reservation released/)
  assert.equal((await hf(['web', 'ledger'])).json.credits, 0)
  const b = await hf(['web', 'pipe', 'gd_abc123', 'discover_by_keyword', 'k', '--limit', '10', '--async'])
  assert.equal((await hf(['web', 'release', b.json.snapshot_id])).json.released, true)
  assert.equal((await hf(['web', 'ledger'])).json.credits, 0)
  const c = await hf(['web', 'pipe', 'gd_abc123', 'discover_by_keyword', 'k2', '--limit', '10', '--async'])
  await hf(['web', 'harvest', c.json.snapshot_id])
  await hf(['web', 'harvest', c.json.snapshot_id, '--fresh'])
  assert.equal((await hf(['web', 'ledger'])).json.credits, 12, 're-downloading a billed snapshot logs 0 credits')
})

test('long articles that mention "Access Denied" are content, not a block page', async () => {
  const { hf } = setup()
  const r = await hf(['web', 'scrape', 'https://docs.example.com/s3-access-denied'], { FAKE_LONG_DENIED: '1' })
  assert.equal(r.json.blocked, false)
  assert.ok(r.json.file)
})

test('saturation SERP counts use the full page (no collapse to 5)', async () => {
  const { hf } = setup()
  const r = await hf(['saturation', 'ai agent'])
  assert.equal(r.json.signals.devpost_serp, 98000)
})

test('web count carries retriedAs/siteIgnored warnings', async () => {
  const { hf } = setup()
  const r = await hf(['web', 'count', 'meal planning', '--site', 'devpost.com'], { FAKE_OFFSITE: '1' })
  assert.equal(r.json.siteIgnored, true)
  assert.match(r.json.warning, /ignored the site/)
})
