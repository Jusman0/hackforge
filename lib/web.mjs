// `hackforge web …` — the only path agents should use for paid Bright Data calls.
// Bakes in the verified rules: --country us --language en, -o to a cache file, slim output,
// one ledger line per paid call, a credit budget, no `scrape --async`, discover optional.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CliError, hfDir, run, which, slug, shortHash, readJSON, writeJSON, flagInt, flagStr, truncate } from './util.mjs'

const BLOCK_RE = /access denied|just a moment\.\.\.|captcha|cf-browser-verification|attention required|verify you are human|enable javascript and cookies/i
// Flags the pipe wrapper consumes itself; everything else is passed through to `bdata pipelines run`
// (e.g. --num_of_reviews 40 --country US).
const PIPE_WRAPPER_FLAGS = new Set(['async', 'limit', 'timeout', 'fresh', 'project', 'json'])

export function cacheDir(projectDir) {
  const d = projectDir
    ? path.join(hfDir(projectDir), 'web')
    : process.env.HACKFORGE_CACHE || path.join(os.homedir(), '.cache', 'hackforge', 'web')
  fs.mkdirSync(d, { recursive: true })
  return d
}

function ledgerFile(projectDir) {
  return path.join(cacheDir(projectDir), 'ledger.tsv')
}

export function budgetOf(state) {
  const env = Number.parseInt(process.env.HACKFORGE_WEB_BUDGET || '', 10)
  if (Number.isFinite(env)) return env
  const v = Number(state?.budget?.webCredits ?? 300)
  return Number.isFinite(v) && v >= 0 ? v : 300 // a malformed value must never remove the cap
}

export function readLedger(projectDir) {
  const f = ledgerFile(projectDir)
  if (!fs.existsSync(f)) return []
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(1).map(line => {
    const [ts, kind, credits, key, file, status, note] = line.split('\t')
    return { ts, kind, credits: Number(credits) || 0, key, file, status, note }
  })
}

export function ledgerSummary(projectDir, state) {
  let rows = []
  try { rows = readLedger(projectDir) } catch {}
  const byKind = {}
  let credits = 0
  for (const r of rows) {
    credits += r.credits
    byKind[r.kind] = (byKind[r.kind] || 0) + r.credits
  }
  return { credits, budget: budgetOf(state), calls: rows.length, byKind }
}

function appendLedger(projectDir, row) {
  const f = ledgerFile(projectDir)
  if (!fs.existsSync(f)) fs.writeFileSync(f, 'ts\tkind\tcredits\tkey\tfile\tstatus\tnote\n')
  const clean = v => String(v ?? '').replace(/[\t\n]/g, ' ')
  fs.appendFileSync(f, [new Date().toISOString(), row.kind, row.credits, row.key, row.file, row.status, row.note].map(clean).join('\t') + '\n')
}

// ---------- budget: reservations under an exclusive lock ----------
// Parallel scouts call the CLI concurrently, so "check then spend" must be atomic: under a lock file we
// check the budget AND append a reservation row (credits = estimate). After the call we release it
// (negative row) and log the actual spend. Async pipelines keep their reservation until harvest.

const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

function withLedgerLock(projectDir, fn) {
  const lock = ledgerFile(projectDir) + '.lock'
  const deadline = Date.now() + 15000
  for (;;) {
    try {
      const fd = fs.openSync(lock, 'wx')
      try {
        return fn()
      } finally {
        fs.closeSync(fd)
        try { fs.unlinkSync(lock) } catch {}
      }
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 30000) fs.unlinkSync(lock) // stale lock from a killed process
      } catch {}
      if (Date.now() > deadline) throw new CliError('web ledger is locked by another hackforge process (waited 15s)', 6)
      sleepSync(50)
    }
  }
}

function budgetMessage(projectDir, credits, estimate, budget) {
  const how = projectDir
    ? 'hackforge state set budget.webCredits <n> (or HACKFORGE_WEB_BUDGET=<n> for this shell)'
    : 'HACKFORGE_WEB_BUDGET=<n> for this shell (outside a project the ledger lives in the HACKFORGE_CACHE dir)'
  return `web budget exhausted: ${credits} used/reserved + ${estimate} needed > ${budget} credits. Ask the user before raising it: ${how}.`
}

// Returns a reservation id; throws if the budget would be exceeded.
function reserve(projectDir, state, estimate, key) {
  return withLedgerLock(projectDir, () => {
    const { credits, budget } = ledgerSummary(projectDir, state)
    if (credits + estimate > budget) throw new CliError(budgetMessage(projectDir, credits, estimate, budget), 6)
    const id = 'r' + shortHash(key + process.pid + process.hrtime.bigint())
    appendLedger(projectDir, { kind: 'reserve', credits: estimate, key, file: '', status: 'reserved', note: id })
    return { id, estimate }
  })
}

function release(projectDir, r) {
  if (r) appendLedger(projectDir, { kind: 'release', credits: -r.estimate, key: '', file: '', status: 'released', note: r.id })
}

function bdata(args, timeoutMs = 180000) {
  const bin = which('bdata') || which('brightdata')
  if (!bin) throw new CliError('Bright Data CLI not found. Install: npm i -g @brightdata/cli (Node >= 20), then `bdata login`.', 7)
  const r = run(bin, args, { timeoutMs })
  if (r.timedOut) throw new CliError(`bdata timed out after ${timeoutMs / 1000}s: bdata ${args.slice(0, 2).join(' ')}`, 8)
  return r
}

function bdataError(r) {
  const msg = (r.stderr || r.stdout).split('\n').filter(l => l.trim() && !/^\s*(Searching|Scraping|Fetching|Output written)/.test(l)).slice(0, 6).join(' | ')
  return truncate(msg || `exit ${r.status}`, 600)
}

// ---------- search / count ----------

export function slimSerp(raw, n) {
  const g = raw.general || {}
  const items = raw.organic || raw.news || []
  return {
    query: g.query ?? raw.input?.original_url ?? null,
    results_cnt: g.results_cnt ?? null,
    type: raw.news ? 'news' : 'web',
    organic: items.slice(0, n).map(o => ({
      rank: o.rank ?? o.global_rank,
      title: o.title,
      link: o.link,
      description: truncate(o.description ?? o.snippet ?? '', 300),
      ...(o.display_link ? { display_link: o.display_link } : {}),
      ...(o.source && raw.news ? { source: o.source, date: o.date } : {}),
    })),
    related: (raw.related || []).slice(0, 8).map(r => r.text),
  }
}

// Errors seen live (2026-10-16) that succeed on a retry or with a simpler query.
const TRANSIENT_RE = /redirect location was rejected|waiting for selector|timeout|timed out|ECONNRESET|socket hang up|50[0234]|429/i
// Bright Data refuses some domains by policy (government sites, incl. some non-.gov ones). Not retryable via Bright Data.
const POLICY_RE = /classified as Government|blocked by Bright Data|usage policy/i
const GOV_HOST_RE = /(\.gov|\.mil|\.gov\.[a-z]{2}|\.gc\.ca|\.gouv\.fr|\.gob\.[a-z]{2})$/i

// Simpler fallback for a failed SERP query: drop the path from site: (site:devpost.com/software → site:devpost.com)
// and strip quotes and date operators. Returns null when nothing would change.
export function simplifyQuery(q) {
  const s = q
    .replace(/site:([^\s/]+)\/\S*/g, 'site:$1')
    .replace(/\b(after|before):\S+/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s !== q ? s : null
}

function runSerp(projectDir, q, opt, file) {
  const args = ['search', q, '--country', opt.country, '--language', opt.language, '--json', '-o', file]
  if (opt.type !== 'web') args.push('--type', opt.type)
  if (opt.page) args.push('--page', String(opt.page))
  try { fs.rmSync(file, { force: true }) } catch {}
  const r = bdata(args, 120000)
  const ok = r.status === 0 && fs.existsSync(file) && fs.statSync(file).size > 0
  // Failed requests are not billed by Bright Data; log them with 0 credits so the ledger reflects spend.
  appendLedger(projectDir, { kind: 'search', credits: ok ? 1 : 0, key: q, file: path.basename(file), status: ok ? 'ok' : 'error', note: ok ? '' : bdataError(r) })
  return { ok, r }
}

const serpFile = (projectDir, q, opt) => path.join(cacheDir(projectDir), `serp_${slug(q, 50)}_${shortHash(JSON.stringify({ q, ...opt }))}.json`)
const hasFile = f => fs.existsSync(f) && fs.statSync(f).size > 0

// Google sometimes ignores site: and returns whole-web results; flag that so counts aren't trusted.
export function siteIgnored(q, slim) {
  // Positive site: operators only (skip "-site:x" exclusions); several site: terms are any-of (OR groups).
  const sites = [...q.matchAll(/(^|[\s(])site:([^\s)]+)/g)].map(m => m[2])
  if (!sites.length || !slim.organic.length) return false
  const onSite = slim.organic.filter(o => {
    try {
      const u = new URL(o.link)
      return sites.some(s => {
        const [host, ...p] = s.split('/')
        const prefix = p.length ? '/' + p.join('/') : ''
        return (u.hostname === host || u.hostname.endsWith('.' + host)) && u.pathname.startsWith(prefix)
      })
    } catch {
      return false
    }
  }).length
  return onSite < Math.ceil(slim.organic.length / 2)
}

export function serp(projectDir, state, query, flags = {}) {
  const site = flagStr(flags, 'site')
  const opt = { type: flagStr(flags, 'type', 'web'), country: flagStr(flags, 'country', 'us'), language: flagStr(flags, 'language', 'en'), page: flagInt(flags, 'page', 0) }
  const q = site ? `site:${site} ${query}` : query
  const file = serpFile(projectDir, q, opt)
  const meta = file.replace(/\.json$/, '.meta.json')
  const n = flagInt(flags, 'n', 10)
  const finish = (usedFile, cached, retriedAs) => {
    const slim = slimSerp(readJSON(usedFile), n)
    const ignored = siteIgnored(retriedAs || q, slim)
    return { cached, file: usedFile, ...(retriedAs ? { retriedAs } : {}), ...(ignored ? { siteIgnored: true } : {}), ...slim }
  }
  if (!flags.fresh) {
    if (hasFile(file)) return finish(file, true)
    // A previous call fell back to a simplified query: serve that result and keep reporting the retry.
    const m = readJSON(meta, null)
    if (m?.retriedAs && hasFile(m.file)) return finish(m.file, true, m.retriedAs)
  }
  const res = reserve(projectDir, state, 1, q)
  try {
    let { ok, r } = runSerp(projectDir, q, opt, file)
    if (ok) return finish(file, false)
    if (TRANSIENT_RE.test(bdataError(r))) {
      // One retry: the simplified query if there is one (fixes the site:<domain>/<path> + quotes failure), else the same query.
      const simple = simplifyQuery(q)
      const retryFile = simple ? serpFile(projectDir, simple, opt) : file
      ;({ ok, r } = runSerp(projectDir, simple || q, opt, retryFile))
      if (ok) {
        if (simple) writeJSON(meta, { retriedAs: simple, file: retryFile })
        return finish(retryFile, false, simple || undefined)
      }
    }
    throw new CliError(`bdata search failed: ${bdataError(r)}`, 9)
  } finally {
    release(projectDir, res)
  }
}

// ---------- scrape ----------

// Free direct fetch (no Bright Data): used for government domains Bright Data refuses, or with --direct.
// PDFs are saved as .pdf so Claude's Read tool can open them; HTML is reduced to readable text.
export async function directFetch(url, fileBase) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 hackforge-research', accept: 'text/html,application/pdf,text/plain,*/*' } })
    const type = res.headers.get('content-type') || ''
    const buf = Buffer.from(await res.arrayBuffer())
    if (!res.ok) throw new CliError(`direct fetch ${res.status} for ${url}`, 9)
    if (/pdf/i.test(type) || buf.subarray(0, 5).toString() === '%PDF-') {
      const file = fileBase + '.pdf'
      fs.writeFileSync(file, buf)
      return { file, pdf: true, bytes: buf.length, note: 'PDF saved — open it with the Read tool (supports PDFs; use the pages parameter for long files)' }
    }
    let text = buf.toString('utf8')
    if (/html/i.test(type) || /<html|<body/i.test(text.slice(0, 2000))) text = htmlToText(text)
    const file = fileBase + '.md'
    fs.writeFileSync(file, `<!-- direct fetch of ${url} (no Bright Data) -->\n` + text)
    return { file, pdf: false, bytes: Buffer.byteLength(text) }
  } catch (e) {
    if (e instanceof CliError) throw e
    throw new CliError(`direct fetch failed for ${url}: ${e.name === 'AbortError' ? 'timeout' : e.message}`, 9)
  } finally {
    clearTimeout(t)
  }
}

export function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h([1-6])[^>]*>/gi, (_, n) => '\n' + '#'.repeat(Number(n)) + ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

export async function scrape(projectDir, state, url, flags = {}) {
  let u
  try {
    u = new URL(url)
  } catch {
    throw new CliError(`invalid URL: ${url}`)
  }
  const host = u.hostname
  if (/(^|\.)devpost\.com$/i.test(host) && !flags.consented) {
    throw new CliError(
      'Devpost ToS forbids automated access. Use `hackforge web count`/`search --site devpost.com` for saturation, ' +
        'or — for a single page the user explicitly asked you to read (e.g. their own event rules) — re-run with --consented.',
      10,
    )
  }
  if (/(^|\.)reddit\.com$/i.test(host)) {
    process.stderr.write('note: scraping reddit returns the post body only (no comments). For comments use: hackforge web pipe gd_lvz8ah06191smkebj4 collect_by_url <url> --async\n')
  }
  const key = shortHash(url)
  const stem = path.join(cacheDir(projectDir), `scrape_${slug(host + u.pathname, 60)}_${key}`)
  // A challenge page is short; a long article that merely mentions "access denied"/"captcha" is content.
  const isBlocked = text => text.trim().length === 0 || (text.length < 3000 && BLOCK_RE.test(text)) || BLOCK_RE.test((text.match(/^#?\s*(.{0,120})/) || [])[1] || '')
  const finish = (res, text) => {
    const out = { ...res, blocked: !res.pdf && isBlocked(text) }
    if (flags.print && !res.pdf) out.content = truncate(text, flagInt(flags, 'max-chars', 12000))
    return out
  }
  // Decide the route first, then use that route's cache (direct and Bright Data results are cached separately).
  const viaDirect = flags.direct ? 'requested --direct' : GOV_HOST_RE.test(host) ? 'government domain: Bright Data refuses these by policy; fetched directly (free)' : null
  const fromCache = base => {
    if (flags.fresh) return null
    for (const ext of ['.md', '.pdf']) {
      if (!hasFile(base + ext)) continue
      const pdf = ext === '.pdf'
      const text = pdf ? '' : fs.readFileSync(base + ext, 'utf8')
      if (!pdf && isBlocked(text)) { try { fs.unlinkSync(base + ext) } catch {} ; continue } // never serve a cached block page
      return finish({ cached: true, file: base + ext, pdf, bytes: fs.statSync(base + ext).size, ...(base.endsWith('.direct') ? { via: 'direct' } : {}) }, text)
    }
    return null
  }
  const direct = async why => {
    const base = stem + '.direct'
    const hit = fromCache(base)
    if (hit) return hit
    const d = await directFetch(url, base)
    appendLedger(projectDir, { kind: 'direct', credits: 0, key: url, file: path.basename(d.file), status: 'ok', note: why })
    return finish({ cached: false, via: 'direct', why, ...d }, d.pdf ? '' : fs.readFileSync(d.file, 'utf8'))
  }
  if (viaDirect) return direct(viaDirect)
  const hit = fromCache(stem)
  if (hit) return hit
  const file = stem + '.md'
  const res = reserve(projectDir, state, 1, url)
  let r
  let ok
  try {
    r = bdata(['scrape', url, '-o', file], 150000)
    ok = r.status === 0 && hasFile(file)
    let text = ok ? fs.readFileSync(file, 'utf8') : ''
    const blocked = ok && isBlocked(text)
    appendLedger(projectDir, { kind: 'scrape', credits: ok ? 1 : 0, key: url, file: path.basename(file), status: ok ? (blocked ? 'blocked' : 'ok') : 'error', note: ok ? '' : bdataError(r) })
    if (blocked) {
      try { fs.unlinkSync(file) } catch {} // don't cache challenge pages
      return { cached: false, file: null, blocked: true, bytes: Buffer.byteLength(text), hint: `challenge/block page — try: hackforge web scrape "${url}" --direct, or WebFetch`, ...(flags.print ? { content: truncate(text, 2000) } : {}) }
    }
    if (ok) return finish({ cached: false, file, pdf: false, bytes: fs.statSync(file).size }, text)
  } finally {
    release(projectDir, res)
  }
  const err = bdataError(r)
  if (POLICY_RE.test(err)) return direct(`Bright Data policy block (${truncate(err, 120)}); fetched directly (free)`)
  throw new CliError(`bdata scrape failed: ${err}. Try: hackforge web scrape "${url}" --direct (free, no unblocking) or WebFetch.`, 9)
}

// ---------- discover (optional: unavailable on some keys) ----------

export function discover(projectDir, state, query, flags = {}) {
  const intent = flagStr(flags, 'intent')
  const n = Math.min(20, flagInt(flags, 'n', 10))
  const key = shortHash(JSON.stringify({ query, intent, n, content: Boolean(flags['include-content']) }))
  const file = path.join(cacheDir(projectDir), `discover_${slug(query, 50)}_${key}.json`)
  if (!(fs.existsSync(file) && fs.statSync(file).size > 0 && !flags.fresh)) {
    const res = reserve(projectDir, state, 1, query)
    const args = ['discover', query, '--num-results', String(n), '--json', '-o', file, '--timeout', '300']
    if (intent) args.push('--intent', intent)
    if (flags['include-content']) args.push('--include-content')
    let r
    try { r = bdata(args, 360000) } finally { release(projectDir, res) }
    const ok = r.status === 0 && fs.existsSync(file) && fs.statSync(file).size > 0
    appendLedger(projectDir, { kind: 'discover', credits: ok ? 1 : 0, key: query, file: path.basename(file), status: ok ? 'ok' : 'error', note: ok ? 'cost per call unpublished; logged as 1' : bdataError(r) })
    if (!ok) {
      const err = bdataError(r)
      const unavailable = /not found|404|403|not enabled/i.test(err)
      throw new CliError(unavailable ? `Discover is not available on this Bright Data key (${err}). Use: hackforge web search "<q>" then hackforge web scrape <url> for the top results.` : `bdata discover failed: ${err}`, unavailable ? 13 : 9)
    }
  }
  const raw = readJSON(file)
  return {
    file,
    results: (raw.results || []).slice(0, n).map(x => ({ link: x.link, title: x.title, relevance: x.relevance_score, description: truncate(x.description || '', 300), ...(x.content ? { contentChars: x.content.length } : {}) })),
  }
}

// ---------- pipelines ----------

function passthrough(flags) {
  const extra = []
  for (const [k, v] of Object.entries(flags)) {
    if (PIPE_WRAPPER_FLAGS.has(k)) continue
    for (const val of [].concat(v)) {
      if (val === true) extra.push(`--${k}`)
      else extra.push(`--${k}`, String(val))
    }
  }
  return extra
}

function countRecords(file) {
  let data
  try {
    data = readJSON(file)
  } catch {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
    data = lines.map(l => { try { return JSON.parse(l) } catch { return { error: 'unparseable line' } } })
  }
  const arr = Array.isArray(data) ? data : [data]
  const errors = arr.filter(r => r && (r.error || r.error_code)).map(r => truncate(r.error || r.error_code, 160))
  return { records: arr.length, errors: errors.length, errorSamples: errors.slice(0, 3) }
}

export function pipe(projectDir, state, datasetId, method, inputs, flags = {}) {
  if (!/^gd_[a-z0-9]+$/i.test(datasetId || '')) {
    throw new CliError('dataset id must look like gd_xxxx — find one free with: bdata pipelines search "<site>" then bdata pipelines info <id> <method>')
  }
  if (!method) throw new CliError('method required (e.g. collect_by_url, discover_by_keyword) — see bdata pipelines info <id>')
  const limit = flags.limit !== undefined ? flagInt(flags, 'limit') : null
  const estimate = Math.max(1, inputs.length || 1) * perInputEstimate(datasetId, method, flags, limit)
  const args = ['pipelines', 'run', datasetId, method, ...inputs, ...passthrough(flags)]
  if (limit !== null) args.push('--limit-per-input', String(limit))
  const key = shortHash(JSON.stringify(args))
  const file = path.join(cacheDir(projectDir), `pipe_${slug(datasetId + '_' + method, 50)}_${key}.json`)
  if (!flags.async && hasFile(file) && !flags.fresh) return { cached: true, file, ...countRecords(file) }
  const res = reserve(projectDir, state, estimate, `${datasetId} ${method}`)
  if (flags.async) {
    let snap = null
    let r
    try {
      r = bdata([...args, '--async', '--json'], 120000)
      try { snap = JSON.parse(r.stdout.trim().split('\n').filter(l => l.trim().startsWith('{')).pop() || '{}').snapshot_id } catch {}
    } finally {
      // Keep the reservation until harvest (records are billed then); release now only if the trigger failed.
      if (!snap) release(projectDir, res)
    }
    appendLedger(projectDir, { kind: 'pipe-start', credits: 0, key: `${datasetId} ${method}`, file: '', status: snap ? 'started' : 'error', note: snap ? `${snap} reservation=${res.id}:${res.estimate}` : bdataError(r) })
    if (!snap) throw new CliError(`pipeline trigger failed: ${bdataError(r)}`, 9)
    return { snapshot_id: snap, estimate, reserved: estimate, harvest: `hackforge web harvest ${snap}` }
  }
  const timeout = flagInt(flags, 'timeout', 900)
  let r
  let counts = { records: 0, errors: 0, errorSamples: [] }
  let okFile = false
  try {
    r = bdata([...args, '--timeout', String(timeout), '-o', file], (timeout + 60) * 1000)
    okFile = hasFile(file)
    if (okFile) counts = countRecords(file)
    appendLedger(projectDir, { kind: 'pipe', credits: counts.records, key: `${datasetId} ${method}`, file: path.basename(file), status: r.status === 0 && okFile ? 'ok' : 'error', note: r.status === 0 ? `${counts.errors} record errors` : bdataError(r) })
  } finally {
    release(projectDir, res)
  }
  if (r.status !== 0 || !okFile) throw new CliError(`pipeline run failed: ${bdataError(r)}`, 9)
  return { file, ...counts, warning: counts.errors ? 'some records failed (partial failures still exit 0) — check errorSamples' : undefined }
}

// Records billed per input: an explicit count flag wins; review/comment datasets default high.
const REVIEW_DATASETS = new Set(['gd_m6zagkt024uwvvwuyu', 'gd_m734msue16e0adkbit', 'gd_l88xvdka1uao86xvlb', 'gd_lm5zmhwd2sni130p', 'gd_le8e811kzy4ggddlq', 'gd_luzfs1dn2oa0teb81', 'gd_lvzdpsdlw09j6t702', 'gd_lk9q0ew71spt1mxywf'])
export function perInputEstimate(datasetId, method, flags, limit) {
  if (method.startsWith('discover')) return limit ?? 10
  for (const [k, v] of Object.entries(flags)) {
    if (/^(num_of_|max_reviews|comment_limit|limit_per|num_of_reviews_limit)/.test(k) && Number(v) > 0) return Number(v)
    if (k === 'pages' && Number(v) > 0) return Number(v) * 10
  }
  return REVIEW_DATASETS.has(datasetId) ? 30 : 1
}

function reservationFor(projectDir, snapshotId) {
  const rows = readLedger(projectDir)
  const start = rows.find(x => x.kind === 'pipe-start' && (x.note || '').startsWith(snapshotId + ' '))
  const m = start && start.note.match(/reservation=(\w+):(\d+)/)
  if (!m || rows.some(x => x.kind === 'release' && x.note === m[1])) return null
  return { id: m[1], estimate: Number(m[2]) }
}

// Release a stuck reservation (failed/abandoned snapshot) so it stops counting against the budget.
export function releaseSnapshot(projectDir, snapshotId) {
  const r = reservationFor(projectDir, snapshotId)
  if (!r) return { released: false, note: 'no open reservation for this snapshot' }
  release(projectDir, r)
  return { released: true, credits: r.estimate }
}

export function harvest(projectDir, state, snapshotId, flags = {}) {
  if (!/^s[a-z]?_[a-z0-9]+$/i.test(snapshotId || '')) throw new CliError('snapshot id must look like sd_xxxx')
  const file = path.join(cacheDir(projectDir), `snapshot_${snapshotId}.json`)
  if (fs.existsSync(file) && fs.statSync(file).size > 0 && !flags.fresh) return { cached: true, file, ...countRecords(file) }
  const alreadyBilled = readLedger(projectDir).some(x => x.kind === 'pipe' && x.key === snapshotId && x.status === 'ok')
  const timeout = flagInt(flags, 'timeout', 900)
  const st = bdata(['pipelines', 'status', snapshotId, '--wait', '--timeout', String(timeout), '--json'], (timeout + 60) * 1000)
  if (st.status !== 0) {
    const err = bdataError(st)
    // A terminal failure bills nothing: log it and free the reservation. A plain timeout keeps it (still running).
    if (!/timed? ?out|running|pending/i.test(err)) {
      appendLedger(projectDir, { kind: 'pipe', credits: 0, key: snapshotId, file: '', status: 'error', note: err })
      const r = reservationFor(projectDir, snapshotId)
      if (r) release(projectDir, r)
    }
    throw new CliError(`snapshot not ready: ${err}${/timed? ?out|running|pending/i.test(err) ? ' — still running; harvest again later' : ' — reservation released'}`, 9)
  }
  const r = bdata(['pipelines', 'results', snapshotId, '-o', file], 180000)
  const okFile = fs.existsSync(file) && fs.statSync(file).size > 0
  const counts = okFile ? countRecords(file) : { records: 0, errors: 0, errorSamples: [] }
  appendLedger(projectDir, { kind: 'pipe', credits: alreadyBilled ? 0 : counts.records, key: snapshotId, file: path.basename(file), status: r.status === 0 && okFile ? 'ok' : 'error', note: r.status === 0 ? `${counts.errors} record errors${alreadyBilled ? ' (re-download, already billed)' : ''}` : bdataError(r) })
  if (r.status === 0 && okFile) {
    // Release the reservation made at trigger time (now replaced by the real record count).
    const res = reservationFor(projectDir, snapshotId)
    if (res) release(projectDir, res)
  }
  if (r.status !== 0 || !okFile) throw new CliError(`results fetch failed: ${bdataError(r)}`, 9)
  return { file, ...counts }
}

export async function webCommand(sub, pos, flags, ctx) {
  const { projectDir, state } = ctx
  switch (sub) {
    case 'search': {
      if (!pos[0]) throw new CliError('usage: hackforge web search "<query>" [--n 10] [--site domain] [--type web|news]')
      return serp(projectDir, state, pos.join(' '), flags)
    }
    case 'count': {
      if (!pos[0]) throw new CliError('usage: hackforge web count "<query>" [--site domain]')
      const r = serp(projectDir, state, pos.join(' '), { ...flags, n: 3 })
      const warning = r.retriedAs ? `query fell back to "${r.retriedAs}" — count is for the simplified query` : r.siteIgnored ? 'Google ignored the site: filter (results are off-site) — do not trust this count' : undefined
      return { query: r.query, results_cnt: r.results_cnt, top: r.organic.map(o => ({ title: o.title, link: o.link })), cached: r.cached, ...(r.retriedAs ? { retriedAs: r.retriedAs } : {}), ...(r.siteIgnored ? { siteIgnored: true } : {}), ...(warning ? { warning } : {}) }
    }
    case 'scrape': {
      if (!pos[0]) throw new CliError('usage: hackforge web scrape <url> [--print] [--max-chars n] [--direct]')
      return scrape(projectDir, state, pos[0], flags)
    }
    case 'discover': {
      if (!pos[0]) throw new CliError('usage: hackforge web discover "<query>" [--intent "<goal>"] [--n 10] [--include-content]')
      return discover(projectDir, state, pos.join(' '), flags)
    }
    case 'pipe': {
      const [id, method, ...inputs] = pos
      return pipe(projectDir, state, id, method, inputs, flags)
    }
    case 'harvest':
      return harvest(projectDir, state, pos[0], flags)
    case 'release':
      if (!pos[0]) throw new CliError('usage: hackforge web release <snapshot_id>  — free the reservation of a failed/abandoned async pipeline')
      return releaseSnapshot(projectDir, pos[0])
    case 'ledger':
      return { ...ledgerSummary(projectDir, state), recent: readLedger(projectDir).slice(-15) }
    default:
      throw new CliError('usage: hackforge web <search|count|scrape|discover|pipe|harvest|ledger> …')
  }
}
