// `hackforge doctor` — minute-zero readiness: tools, logins, keys (names only), git hygiene, Claude settings.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { run, which, readJSON } from './util.mjs'
import { githubToken } from './sources.mjs'
import { discover } from './web.mjs'

const ok = (name, detail, fix) => ({ name, status: 'ok', detail, fix })
const warn = (name, detail, fix) => ({ name, status: 'warn', detail, fix })
const fail = (name, detail, fix) => ({ name, status: 'fail', detail, fix })

function version(cmd, args = ['--version'], timeoutMs = 10000) {
  const bin = which(cmd)
  if (!bin) return null
  const r = run(bin, args, { timeoutMs })
  const text = (r.stdout || r.stderr).trim().split('\n')[0]
  return text || 'installed'
}

function cmpVersion(a, b) {
  const pa = String(a).match(/\d+/g)?.map(Number) || []
  const pb = String(b).match(/\d+/g)?.map(Number) || []
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}

export function doctor(projectDir, state, flags = {}) {
  const checks = []
  const cwd = projectDir || process.cwd()

  // Runtime
  const nodeMajor = Number(process.versions.node.split('.')[0])
  checks.push(nodeMajor >= 18 ? ok('node', `v${process.versions.node}`) : fail('node', `v${process.versions.node}`, 'Install Node >= 18 (hooks and CLI need it); >= 22.13 for ctx7'))
  if (nodeMajor < 20 && (which('bdata') || which('brightdata'))) checks.push(warn('node for bdata', `v${process.versions.node}`, 'The Bright Data CLI needs Node >= 20'))
  const claudeV = version('claude')
  if (!claudeV) checks.push(warn('claude', 'CLI not on PATH', 'Desktop/IDE users can ignore; CLI users: install Claude Code'))
  else checks.push(cmpVersion(claudeV, '2.1.285') >= 0 ? ok('claude', claudeV) : warn('claude', claudeV, 'Update Claude Code to >= 2.1.285 (plugin workflows, hooks exec form)'))

  // Claude settings that disable workflows
  const settings = readJSON(path.join(os.homedir(), '.claude', 'settings.json'), {})
  if (settings.disableWorkflows || process.env.CLAUDE_CODE_DISABLE_WORKFLOWS === '1') {
    checks.push(fail('workflows', 'disabled in settings/env', 'Enable dynamic workflows (/config → Dynamic workflows) or HackForge falls back to slower sequential agents'))
  } else checks.push(ok('workflows', 'not disabled (on Pro, also enable /config → Dynamic workflows)'))

  // Git
  const gitV = version('git')
  checks.push(gitV ? ok('git', gitV) : fail('git', 'missing', 'Install git'))
  const inRepo = gitV && run('git', ['rev-parse', '--is-inside-work-tree'], { cwd, timeoutMs: 5000 }).stdout.trim() === 'true'
  checks.push(inRepo ? ok('git repo', cwd) : warn('git repo', 'not a git repo', 'git init && git add -A && git commit -m "chore: hackathon start" (commit early and often — history is evidence)'))
  if (inRepo) {
    const envIgnored = run('git', ['check-ignore', '-q', '.env'], { cwd, timeoutMs: 5000 }).status === 0
    checks.push(envIgnored ? ok('.env ignored', 'yes') : fail('.env ignored', 'NO', 'Add .env and .env.* to .gitignore BEFORE the first commit (hackforge init does this)'))
    const tracked = run('git', ['ls-files', '.env', '.env.local', '.env.production'], { cwd, timeoutMs: 5000 }).stdout.trim()
    if (tracked) checks.push(fail('.env tracked', tracked, 'git rm --cached <file>, rotate every key in it, commit'))
    const remote = run('git', ['remote', 'get-url', 'origin'], { cwd, timeoutMs: 5000 }).stdout.trim()
    checks.push(remote ? ok('git remote', remote.replace(/\/\/[^@]+@/, '//***@')) : warn('git remote', 'none', 'Create a public repo (judges need it): gh repo create --public --source . --push'))
  }

  // Research tools
  const bd = which('bdata') || which('brightdata')
  if (!bd) checks.push(warn('bright data cli', 'missing', 'npm i -g @brightdata/cli && bdata login (5,000 free credits/month)'))
  else {
    const z = run(bd, ['zones'], { timeoutMs: 30000 })
    checks.push(z.status === 0 ? ok('bright data cli', `${version('bdata') || 'installed'}, authenticated`) : warn('bright data cli', 'installed but not authenticated', 'bdata login'))
    if (flags.probe && z.status === 0) {
      // Through the wrapper so a successful (billed) probe lands in the ledger and respects the budget.
      try {
        discover(projectDir, state, 'hackforge readiness probe', { n: 1 })
        checks.push(ok('bright data discover', 'available (1 call logged in the web ledger)'))
      } catch (e) {
        checks.push(warn('bright data discover', e.code === 13 ? 'unavailable on this key (404/403)' : `probe failed: ${e.message}`, 'Fine: hackforge falls back to search + scrape'))
      }
    }
  }
  const tok = githubToken()
  checks.push(tok ? ok('github token', 'present (30 searches/min, code search enabled)') : warn('github token', 'none (10 searches/min, no code search)', 'export GITHUB_TOKEN=<fine-grained read-only PAT> or `gh auth login`'))
  checks.push(which('gh') ? ok('gh', version('gh')) : warn('gh', 'missing', 'brew install gh (repo create, PRs, auth token)'))
  checks.push(which('jq') ? ok('jq', version('jq')) : warn('jq', 'missing', 'brew install jq (recipes in research-toolkit use it)'))

  // Build / ship tools
  for (const [cmd, why, fix] of [
    ['vercel', 'deploy (web profile)', 'npm i -g vercel && vercel login'],
    ['supabase', 'db/auth (optional; npx supabase works too)', 'brew install supabase/tap/supabase'],
    ['ffmpeg', 'demo video conversion + captions', 'brew install ffmpeg'],
    ['gitleaks', 'deep secret scan before going public', 'brew install gitleaks'],
    ['python3', 'python profile / data scripts', 'install Python 3.11+'],
    ['uv', 'python profile (fast envs)', 'curl -LsSf https://astral.sh/uv/install.sh | sh'],
  ]) checks.push(which(cmd) ? ok(cmd, version(cmd) || 'installed') : warn(cmd, `missing — ${why}`, fix))
  const pw = fs.existsSync(path.join(cwd, 'node_modules', '.bin', 'playwright'))
  checks.push(pw ? ok('playwright', 'in node_modules') : warn('playwright', 'not installed in this project', 'npm i -D @playwright/test playwright && npx playwright install chromium (golden-path test + demo recorder)'))

  // Env var NAMES only — never print values. Bright Data: the CLI reads BRIGHTDATA_API_KEY (or its own login);
  // the MCP profile references BRIGHTDATA_API_TOKEN — same key, either name.
  const keys = ['ANTHROPIC_API_KEY', 'BRIGHTDATA_API_KEY', 'BRIGHTDATA_API_TOKEN', 'GITHUB_TOKEN', 'CONTEXT7_API_KEY', 'SUPABASE_PROJECT_REF']
  const envFile = path.join(cwd, '.env.local')
  const envText = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''
  const present = keys.filter(k => process.env[k] || new RegExp(`^${k}=`, 'm').test(envText))
  checks.push(ok('env names present', present.length ? present.join(', ') : 'none of ' + keys.join(', ')))
  if (inRepo && !fs.existsSync(path.join(cwd, '.env.example'))) checks.push(warn('.env.example', 'missing', 'Commit a .env.example listing variable NAMES only (judges + teammates)'))

  // Project MCP file sanity
  const mcpFile = path.join(cwd, '.mcp.json')
  if (fs.existsSync(mcpFile)) {
    const m = readJSON(mcpFile, {})
    const servers = Object.entries(m.mcpServers || {})
    const unpinned = servers.filter(([, v]) => v.command && (v.args || []).some(a => /@latest$/.test(a) || (/^[@a-z][\w./-]*$/.test(a) && /mcp/.test(a) && !/@\d/.test(a))))
    const literal = servers.filter(([, v]) => JSON.stringify(v).match(/(sk-|ghp_|github_pat_|AKIA)[A-Za-z0-9]/))
    checks.push(unpinned.length ? warn('.mcp.json pins', `unpinned: ${unpinned.map(([k]) => k).join(', ')}`, 'Pin exact versions (pkg@1.2.3)') : ok('.mcp.json pins', `${servers.length} servers`))
    if (literal.length) checks.push(fail('.mcp.json secrets', `literal key in: ${literal.map(([k]) => k).join(', ')}`, 'Replace with ${VAR} and rotate the key'))
  }

  if (state) {
    const plans = (state.team?.members || []).map(m => m.plan).filter(Boolean)
    checks.push(ok('workflow scale', `${state.scale || 'medium'}${plans.length ? ` (plans: ${plans.join(', ')})` : ''}`, 'Pro plan or small workflow-size guideline → hackforge state set scale small'))
  }
  checks.push(ok('status line (optional)', 'countdown in your Claude Code status bar', 'hackforge statusline --snippet → paste into ~/.claude/settings.json'))

  const summary = { ok: checks.filter(c => c.status === 'ok').length, warn: checks.filter(c => c.status === 'warn').length, fail: checks.filter(c => c.status === 'fail').length }
  return { summary, checks, recommendedPlugins: RECOMMENDED_PLUGINS }
}

export const RECOMMENDED_PLUGINS = [
  'vercel@claude-plugins-official (deploy, env, logs)',
  'supabase@claude-plugins-official (db, auth, docs)',
  'context7@claude-plugins-official (version-correct library docs)',
  'frontend-design@claude-plugins-official (distinctive UI)',
  'playwright@claude-plugins-official (browser automation; CLI-first is fine too)',
]

export function doctorText(res) {
  const icon = { ok: '✓', warn: '!', fail: '✗' }
  const rows = res.checks.map(c => `${icon[c.status]} ${c.name.padEnd(22)} ${c.detail}${c.status !== 'ok' && c.fix ? `\n    → ${c.fix}` : ''}`)
  return [
    `HackForge doctor — ${res.summary.ok} ok, ${res.summary.warn} warnings, ${res.summary.fail} failures`,
    ...rows,
    '',
    'Optional official plugins (claude plugin install <id>):',
    ...res.recommendedPlugins.map(p => `  - ${p}`),
  ].join('\n')
}
