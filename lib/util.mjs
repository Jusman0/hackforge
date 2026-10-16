// Shared helpers for the hackforge CLI and hooks. Zero dependencies; Node >= 18.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

export class CliError extends Error {
  constructor(message, code = 2) {
    super(message)
    this.code = code
  }
}

// Minimal argv parser: positionals + --flag value / --flag=value / --bool.
// Flags listed in `booleans` never consume the next token; flags in `values` always do
// (so `--note "--skip tests"` keeps its text).
export function parseArgs(argv, booleans = [], values = []) {
  const flags = {}
  const pos = []
  const bools = new Set(booleans)
  const vals = new Set(values)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') { pos.push(...argv.slice(i + 1)); break }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 2) { addFlag(flags, a.slice(2, eq), a.slice(eq + 1)); continue }
      const key = a.slice(2)
      const next = argv[i + 1]
      if (vals.has(key) && next !== undefined) { addFlag(flags, key, next); i++ }
      else if (bools.has(key) || next === undefined || next.startsWith('--')) addFlag(flags, key, true)
      else { addFlag(flags, key, next); i++ }
    } else pos.push(a)
  }
  return { flags, pos }
}

function addFlag(flags, key, value) {
  if (key in flags) flags[key] = [].concat(flags[key], value)
  else flags[key] = value
}

export function flagInt(flags, key, dflt) {
  if (flags[key] === undefined || flags[key] === true) return dflt
  const n = Number.parseInt(String(flags[key]), 10)
  if (!Number.isFinite(n)) throw new CliError(`--${key} must be an integer`)
  return n
}

export function flagStr(flags, key, dflt) {
  const v = flags[key]
  if (v === undefined || v === true) return dflt
  return Array.isArray(v) ? String(v[v.length - 1]) : String(v)
}

// Project dir = nearest ancestor (from cwd or $CLAUDE_PROJECT_DIR / $HACKFORGE_PROJECT) holding .hackforge/state.json.
export function findProjectDir(start) {
  const seeds = [process.env.HACKFORGE_PROJECT, start, process.env.CLAUDE_PROJECT_DIR, process.cwd()].filter(Boolean)
  for (const seed of seeds) {
    let dir = path.resolve(seed)
    for (;;) {
      if (fs.existsSync(path.join(dir, '.hackforge', 'state.json'))) return dir
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return null
}

export function hfDir(projectDir) {
  return path.join(projectDir, '.hackforge')
}

export function readJSON(file, dflt = undefined) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    if (dflt !== undefined && (e.code === 'ENOENT' || e instanceof SyntaxError)) return dflt
    throw e
  }
}

// Atomic write: temp file + rename, so a crashed hook never leaves half a state file.
export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
  fs.renameSync(tmp, file)
}

export function slug(s, max = 60) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max) || 'x'
}

export function shortHash(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 10)
}

export function which(cmd) {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : ['']
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext)
      try {
        if (fs.statSync(p).isFile()) return p
      } catch {}
    }
  }
  return null
}

// Run a command synchronously; never throws on non-zero exit.
export function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: opts.timeoutMs ?? 120000,
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    input: opts.input,
    maxBuffer: 64 * 1024 * 1024,
  })
  return {
    status: r.status ?? (r.error ? 127 : 1),
    stdout: r.stdout || '',
    stderr: r.stderr || (r.error ? String(r.error.message) : ''),
    timedOut: r.error?.code === 'ETIMEDOUT',
    error: r.error,
  }
}

export function out(obj) {
  process.stdout.write(typeof obj === 'string' ? obj + (obj.endsWith('\n') ? '' : '\n') : JSON.stringify(obj, null, 2) + '\n')
}

export function nowISO() {
  return new Date().toISOString()
}

export function validTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// Offset (ms) of `tz` at instant `ms`: wall-clock time in tz minus UTC.
function tzOffsetMs(ms, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map(p => [p.type, p.value]))
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second)
  return wall - (ms - (ms % 1000))
}

// Parse a timestamp. Strings with Z or ±hh:mm are absolute. A naive date-time ("2026-10-17T09:00") is
// read as wall-clock time in `tz`; without a tz it is rejected rather than silently using the machine zone.
export function parseTime(s, label = 'time', tz) {
  if (s instanceof Date) return s
  const str = String(s).trim()
  const naive = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/)
  if (naive) {
    const [, y0, mo0, d0, h0 = '0', mi0 = '0', se0 = '0'] = naive
    const probe = new Date(Date.UTC(+y0, +mo0 - 1, +d0, +h0, +mi0, +se0))
    if (probe.getUTCFullYear() !== +y0 || probe.getUTCMonth() !== +mo0 - 1 || probe.getUTCDate() !== +d0 || +h0 > 23 || +mi0 > 59 || +se0 > 59) {
      throw new CliError(`${label} "${str}" is not a real date/time`)
    }
    if (!tz) throw new CliError(`${label} "${str}" has no timezone offset — use e.g. ${str.length === 10 ? str + 'T09:00' : str}-07:00 or Z, or pass --tz <IANA zone>`)
    if (!validTimeZone(tz)) throw new CliError(`unknown --tz "${tz}" (use an IANA zone like America/Los_Angeles)`)
    const [, y, mo, d, h = '00', mi = '00', se = '00'] = naive
    const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se)
    let ms = guess - tzOffsetMs(guess, tz)
    ms = guess - tzOffsetMs(ms, tz) // second pass settles DST transitions
    return new Date(ms)
  }
  // Anything else must carry an explicit zone (Z or ±hh:mm) — never fall back to the machine's local zone.
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(str)) throw new CliError(`${label} "${str}" has no timezone offset — use ISO 8601 like 2026-10-17T09:00:00-07:00 (or Z), or a plain YYYY-MM-DDTHH:MM with --tz <IANA zone>`)
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) throw new CliError(`invalid ${label}: ${s} (use ISO 8601, e.g. 2026-10-17T09:00:00-07:00)`)
  return d
}

export function fmtDuration(ms) {
  const neg = ms < 0
  let s = Math.floor(Math.abs(ms) / 1000)
  const d = Math.floor(s / 86400); s -= d * 86400
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60)
  const parts = d ? `${d}d${h}h` : h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`
  return (neg ? '-' : '') + parts
}

export function truncate(s, n) {
  s = String(s ?? '')
  return s.length > n ? s.slice(0, Math.max(0, n - 1)) + '…' : s
}

export function getPath(obj, dotPath) {
  if (!dotPath) return obj
  return dotPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function setPath(obj, dotPath, value) {
  const keys = dotPath.split('.')
  let o = obj
  for (const k of keys.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {}
    o = o[k]
  }
  o[keys[keys.length - 1]] = value
  return obj
}

// Parse a CLI value as JSON when it looks like JSON, else keep the string.
export function parseValue(raw) {
  if (raw === true) return true
  const s = String(raw)
  if (/^(true|false|null|-?\d+(\.\d+)?)$/.test(s) || /^[[{"]/.test(s)) {
    try { return JSON.parse(s) } catch {}
  }
  return s
}

export async function fetchJSON(url, { headers = {}, timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'hackforge-cli', ...headers }, signal: ctrl.signal })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    return { ok: res.ok, status: res.status, headers: res.headers, body }
  } catch (e) {
    throw new CliError(`request failed: ${url} (${e.name === 'AbortError' ? 'timeout' : e.message})`, 3)
  } finally {
    clearTimeout(t)
  }
}

export function ensureGitignore(projectDir, lines) {
  const f = path.join(projectDir, '.gitignore')
  const existing = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''
  const have = new Set(existing.split(/\r?\n/).map(l => l.trim()))
  const add = lines.filter(l => !have.has(l))
  if (!add.length) return []
  const block = (existing && !existing.endsWith('\n') ? '\n' : '') + (existing ? '\n' : '') + '# HackForge\n' + add.join('\n') + '\n'
  fs.appendFileSync(f, block)
  return add
}

export function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}
