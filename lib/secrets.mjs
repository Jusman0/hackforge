// `hackforge secrets` — fast regex secret scan used by the git-guard hook and the ship checklist.
// Not a gitleaks replacement: if gitleaks is installed, `doctor` recommends running it too.
import fs from 'node:fs'
import path from 'node:path'
import { run, CliError } from './util.mjs'

// Order matters: specific rules first; the generic rule is skipped on a line span a specific rule already hit.
export const RULES = [
  { id: 'anthropic-key', re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: 'openai-key', re: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/g },
  { id: 'aws-access-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'github-token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g },
  { id: 'stripe-live-key', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g },
  { id: 'slack-token', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'slack-webhook', re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]{20,}/g },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'huggingface-token', re: /\bhf_[A-Za-z0-9]{30,}\b/g },
  { id: 'groq-key', re: /\bgsk_[A-Za-z0-9]{40,}\b/g },
  { id: 'replicate-token', re: /\br8_[A-Za-z0-9]{30,}\b/g },
  { id: 'supabase-secret-key', re: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/g },
  { id: 'db-url-with-password', re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqp):\/\/([^\s:@/'"]+):(?!\$\{|<|password\b|pass\b)([^\s@/'"]{3,})@([^\s/:'"]+)[^\s'"]*/gi, check: m => !LOCAL_DB_HOST.test(m[3]) && m[1] !== m[2] },
  { id: 'service-role-jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{20,})\.[A-Za-z0-9_-]{10,}/g, check: m => jwtRole(m[1]) === 'service_role' },
  // Names: UPPER_SNAKE, lower_snake, camelCase, JSON keys. Values: 20+ token chars, not a placeholder or env reference.
  { id: 'generic-assigned-secret', generic: true, re: /["']?\b(?![\w.-]*tokeni[sz]er|[\w.-]*_tokens\b|max_?tokens)[\w.-]*(?:api[_-]?key|apikey|secret|access[_-]?token|auth[_-]?token|token|password|passwd|private[_-]?key)[\w.-]*["']?\s*[:=]\s*(["'`]?)(?!\$\{|\$[A-Z_]|process\.env|os\.environ|import\.meta|env\(|<|\{\{)([A-Za-z0-9_\-+/=.]{20,})/gi, check: m => looksLikeSecretValue(m[2], Boolean(m[1])) },
  { id: 'client-exposed-secret', re: /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE_ROLE)[A-Z0-9_]*\s*=/g },
]

const PLACEHOLDER_RE = /your|xxx|changeme|change_me|example|placeholder|todo|replace|here|dummy|fake|sample|sk_test|pk_test|test_?key|insert|redacted|\*{4}|^(.)\1+$/i
const LOCAL_DB_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|db|postgres|mysql|redis|mongo|host\.docker\.internal|\[?::1\]?)$/i

// A generic "name = value" match is only a secret if the value looks like key material: not a code
// identifier path (account.access_token, settings.openaiApiKey, CONFIG_VALUE), and — when unquoted — mixed
// letters+digits (entropy). Quoted literals need letters+digits too.
function looksLikeSecretValue(v, quoted) {
  if (PLACEHOLDER_RE.test(v)) return false
  if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(v)) return false // member access / dotted identifier
  if (!quoted && /^[A-Z][A-Z0-9_]*$/.test(v)) return false // CONSTANT_NAME reference
  if (!/[0-9]/.test(v) || !/[A-Za-z]/.test(v)) return false
  return true
}

function jwtRole(payloadB64) {
  try {
    return JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role
  } catch {
    return null
  }
}

const SKIP_FILE = /(^|\/)(\.env\.(example|sample|template|dist)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|.*\.min\.js|.*\.map)$/
export const ENV_FILE_RE = /(^|\/)\.env(\.(?!example$|sample$|template$|dist$)[\w.-]+)?$/

export function redact(s) {
  return s.length <= 10 ? '***' : `${s.slice(0, 4)}…${s.slice(-2)} (${s.length} chars)`
}

// Long lines (minified bundles, JSON blobs) are scanned in overlapping windows instead of truncated.
function windows(line, size = 4000, overlap = 200) {
  if (line.length <= size) return [[line, 0]]
  const out = []
  for (let i = 0; i < line.length; i += size - overlap) out.push([line.slice(i, i + size), i])
  return out
}

export function scanText(text, file = '<text>') {
  const findings = []
  const lines = text.split('\n')
  lines.forEach((full, i) => {
    if (/hackforge:allow-secret/.test(full)) return
    const spans = []
    for (const [line, offset] of windows(full)) {
      for (const rule of RULES) {
        rule.re.lastIndex = 0
        let m
        while ((m = rule.re.exec(line))) {
          const at = offset + m.index
          if (rule.check && !rule.check(m)) continue
          if (spans.some(([a, b]) => at < b && at + m[0].length > a)) continue // dedupe overlapping hits (window overlap / generic after specific)
          spans.push([at, at + m[0].length])
          findings.push({ rule: rule.id, file, line: i + 1, match: redact(m[0]) })
        }
      }
    }
  })
  return findings
}

// Parse unified diff (added lines only) into per-file text.
export function scanDiff(diff) {
  const findings = []
  let file = null
  let lineNo = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) { file = line.slice(4).replace(/^b\//, ''); continue }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/)
    if (hunk) { lineNo = Number(hunk[1]) - 1; continue }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNo++
      if (file && SKIP_FILE.test(file)) continue
      for (const f of scanText(line.slice(1), file || '<diff>')) findings.push({ ...f, line: lineNo })
    } else if (!line.startsWith('-')) lineNo++
  }
  return findings
}

export function stagedEnvFiles(cwd, { includeTracked = false } = {}) {
  const r = run('git', ['diff', '--cached', '--name-only'], { cwd, timeoutMs: 15000 })
  const files = r.stdout.split('\n')
  if (includeTracked) files.push(...run('git', ['diff', 'HEAD', '--name-only'], { cwd, timeoutMs: 15000 }).stdout.split('\n'))
  return [...new Set(files.filter(f => f && ENV_FILE_RE.test(f)))]
}

export function secretsScan(cwd, flags = {}) {
  let findings = []
  let scope
  if (flags.staged || (!flags.range && !flags.tracked && !flags.path && !flags.history)) {
    scope = 'staged'
    const r = run('git', ['diff', '--cached', '-U0', '--no-color'], { cwd, timeoutMs: 30000 })
    if (r.status !== 0) throw new CliError(`git diff --cached failed: ${r.stderr.trim()}`, 12)
    findings = scanDiff(r.stdout)
    for (const f of stagedEnvFiles(cwd)) findings.push({ rule: 'env-file-staged', file: f, line: 0, match: '(whole file)' })
  } else if (flags.range) {
    scope = `range ${flags.range}`
    const r = run('git', ['log', '-p', '-U0', '--no-color', String(flags.range)], { cwd, timeoutMs: 60000 })
    if (r.status !== 0) throw new CliError(`git log failed: ${r.stderr.trim()}`, 12)
    findings = scanDiff(r.stdout)
  } else if (flags.history) {
    scope = 'full history (all refs, including the root commit)'
    const r = run('git', ['log', '-p', '-U0', '--no-color', '--all'], { cwd, timeoutMs: 120000 })
    if (r.status !== 0) throw new CliError(`git log failed: ${r.stderr.trim()}`, 12)
    findings = scanDiff(r.stdout)
  } else if (flags.tracked) {
    scope = 'tracked files'
    const r = run('git', ['ls-files'], { cwd, timeoutMs: 30000 })
    for (const f of r.stdout.split('\n').filter(Boolean)) {
      if (SKIP_FILE.test(f)) continue
      if (ENV_FILE_RE.test(f)) findings.push({ rule: 'env-file-tracked', file: f, line: 0, match: '(whole file)' })
      const p = path.join(cwd, f)
      try {
        const st = fs.statSync(p)
        if (!st.isFile() || st.size > 2_000_000) continue
        const buf = fs.readFileSync(p)
        if (buf.includes(0)) continue // binary
        findings.push(...scanText(buf.toString('utf8'), f))
      } catch {}
    }
  } else {
    scope = 'paths'
    for (const p of [].concat(flags.path)) {
      const text = fs.readFileSync(path.resolve(cwd, String(p)), 'utf8')
      findings.push(...scanText(text, String(p)))
    }
  }
  return { scope, clean: findings.length === 0, count: findings.length, findings: findings.slice(0, 50) }
}
