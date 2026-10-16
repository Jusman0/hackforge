#!/usr/bin/env node
// PreToolUse(Bash|PowerShell): keep secrets, history and the judge files honest during the hackathon.
//  - deny: bypassing git hooks (--no-verify / -n / core.hooksPath via -c, --config-env or git config),
//          staging or committing .env files
//  - ask (fast) / deny (safe): secrets in what a commit/push would publish, force-push or deletion of
//          main/master, `git add -f` with a broad pathspec, unignored .env files with a broad add,
//          hook-skipping env (HUSKY=0, SKIP=…), shell writes to judge files after Gate B, writes to state.json
//  - ask: `hackforge gate A|B --unlock`, `gate B --lock --force`, `state set gates|hooks|budget…`,
//         HACKFORGE_WEB_BUDGET overrides, rolling the tree back to an hf-cp/* tag (would revert state.json)
// Commands are parsed (quotes/heredocs stripped, continuations joined, chains and wrappers like bash -c /
// eval / subshells expanded, git global options skipped). Fails open on internal errors, except when a
// commit/push scan could not run — then it asks.
import fs from 'node:fs'
import path from 'node:path'
import { readInput, projectFor, loadStateSafe, profile, decide, failOpen, allow } from './_common.mjs'
import { expandCommands, segments, tokens, parseGit, clusterHas, isEnvPath, BROAD_PATHSPEC, writtenPaths, unquoteWith } from './_shell.mjs'
import { run, parseArgs } from '../../lib/util.mjs'
import { BOOLEANS, VALUE_FLAGS } from '../../lib/flags.mjs'
import { scanDiff, scanText, stagedEnvFiles } from '../../lib/secrets.mjs'
import { JUDGE_ALWAYS, GOLDEN_RE, goldenTests, judgeSnapshot } from '../../lib/state.mjs'

const UNTRACKED_BYTES_BUDGET = 8 * 1024 * 1024

function listFindings(findings) {
  return findings.slice(0, 6).map(f => `${f.rule} in ${f.file}${f.line ? ':' + f.line : ''} (${f.match})`).join('; ') + (findings.length > 6 ? `; +${findings.length - 6} more` : '')
}

function toplevel(cwd) {
  const r = run('git', ['rev-parse', '--show-toplevel'], { cwd, timeoutMs: 5000 })
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : cwd
}

function unignoredEnvFiles(top) {
  const r = run('git', ['ls-files', '--others', '--exclude-standard'], { cwd: top, timeoutMs: 10000 })
  return r.stdout.split('\n').filter(f => f && isEnvPath(f))
}

// Everything a `git add … && git commit` could publish, repo-wide: tracked changes (staged + unstaged)
// + untracked, non-ignored files. Runs at the toplevel so a subdirectory cwd or `-C sub` can't hide files.
function scanPendingCommit(top) {
  const findings = []
  const head = run('git', ['rev-parse', '--verify', 'HEAD'], { cwd: top, timeoutMs: 5000 }).status === 0
  const d = run('git', head ? ['diff', 'HEAD', '-U0', '--no-color'] : ['diff', '--cached', '-U0', '--no-color'], { cwd: top, timeoutMs: 30000 })
  if (d.status !== 0) throw new Error(`git diff failed: ${d.stderr.trim()}`)
  findings.push(...scanDiff(d.stdout))
  const untracked = run('git', ['ls-files', '--others', '--exclude-standard'], { cwd: top, timeoutMs: 10000 }).stdout.split('\n').filter(Boolean)
  let bytes = 0
  let skipped = 0
  for (const f of untracked) {
    const p = path.join(top, f)
    let st
    try { st = fs.statSync(p) } catch { continue }
    if (!st.isFile() || st.size > 1_000_000) continue // large files: assets/datasets, not config
    if (bytes + st.size > UNTRACKED_BYTES_BUDGET) { skipped++; continue }
    const buf = fs.readFileSync(p)
    if (buf.includes(0)) continue // binary
    bytes += st.size
    findings.push(...scanText(buf.toString('utf8'), f))
  }
  return { findings, skipped }
}

// Every local commit not on any remote, whatever refspec is pushed (pushing another branch, --all, …).
function scanUnpushed(top) {
  const r = run('git', ['log', '-p', '-U0', '--no-color', 'HEAD', '--branches', '--tags', '--not', '--remotes'], { cwd: top, timeoutMs: 60000 })
  if (r.status !== 0) {
    const r2 = run('git', ['log', '-p', '-U0', '--no-color', '--branches', '--tags', '--not', '--remotes'], { cwd: top, timeoutMs: 60000 })
    if (r2.status !== 0) throw new Error(`git log failed: ${r.stderr.trim()}`)
    return scanDiff(r2.stdout)
  }
  return scanDiff(r.stdout)
}

try {
  const input = readInput()
  if (input.__unparseable) failOpen('git-guard', 'unparseable hook input')
  if (input.tool_name && !['Bash', 'PowerShell'].includes(input.tool_name)) allow()
  const dir = projectFor(input)
  if (!dir) allow()
  let state = loadStateSafe(dir)
  // Unreadable state.json (merge conflict, bad edit) must not switch protection off: assume Gate B is locked.
  const corrupt = !state && fs.existsSync(path.join(dir, '.hackforge', 'state.json'))
  const prof = profile(corrupt ? null : state, 'git-guard')
  if (prof === 'off') allow()
  const cmd = String(input.tool_input?.command || '')
  const snapshot = corrupt ? judgeSnapshot(dir) : state?.gates?.B?.protected || []
  const gateB = corrupt || Boolean(state?.gates?.B?.locked)
  const judgeList = [...new Set([...JUDGE_ALWAYS, ...snapshot, ...goldenTests(dir)])]
  // Fast exit for the vast majority of commands (judge basenames included so new config files are seen).
  const names = judgeList.map(p => path.basename(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const FAST = new RegExp(`\\b(git|gh|hackforge|xargs|eval|bash|sh|zsh)\\b|\\.hackforge|golden-path|HACKFORGE_|\\$env:|tsconfig|eslint|prettier|playwright|vitest|jest|biome|pyproject|pytest${names ? '|' + names : ''}`, 'i')
  if (!FAST.test(cmd)) allow()
  const baseCwd = input.cwd || dir
  const soft = prof === 'safe' ? 'deny' : 'ask'
  const norm = p => p.replace(/\\/g, '/')
  const sameFile = (written, rel) => {
    const w = norm(written)
    const abs = path.resolve(dir, rel)
    return w === rel || w.endsWith('/' + rel) || path.resolve(baseCwd, w) === abs
  }

  let push = false
  let commit = false
  let commitAll = false
  let scanCwd = baseCwd

  for (const { stripped, quoted } of expandCommands(cmd)) {
    const unquote = unquoteWith(quoted)
    const segs = segments(stripped)
    let psEnv = {} // PowerShell `$env:HUSKY=0; git commit …`

    for (const seg of segs) {
      const unq = norm(unquote(seg))
      const t = tokens(seg).map(unquote)

      // PowerShell env assignment carries to later segments.
      const pe = unq.match(/^\$env:(\w+)\s*=\s*(\S+)/i)
      if (pe) { psEnv[pe[1]] = pe[2]; continue }

      // ---- judge files + state.json written from the shell (guard-edits only sees Write/Edit) ----
      const written = writtenPaths(unq)
      if (written.some(w => sameFile(w, '.hackforge/state.json'))) {
        decide(soft, '.hackforge/state.json is written only by the hackforge CLI (state set / gate / checkpoint) — editing it by hand can silently disable the gates.')
      }
      if (gateB) {
        const golden = written.map(w => norm(path.relative(dir, path.resolve(baseCwd, norm(w))))).find(rel => GOLDEN_RE.test(rel))
        const hit = judgeList.find(p => written.some(w => sameFile(w, p))) || golden
        if (hit) decide(soft, `${hit} is a judge file (acceptance criteria / rubric / test / lint config), protected since Gate B — a shell write would move the goalposts. Proceed only if the human explicitly wants the criteria changed.`)
      }

      // ---- hackforge CLI calls that weaken guardrails or spend money (parsed like the CLI does) ----
      if (/(^|\s)HACKFORGE_(WEB_BUDGET|HOOKS|DISABLED_HOOKS)=/.test(unq)) decide('ask', 'this command overrides a HackForge budget/guardrail via environment variable — only with the human\'s explicit OK.')
      const hi = t.findIndex(x => /(^|[\\/])hackforge(\.cmd|\.mjs)?$/i.test(x))
      if (hi >= 0) {
        const { flags, pos } = parseArgs(t.slice(hi + 1), BOOLEANS, VALUE_FLAGS)
        const [sub, a1, a2] = pos
        if (sub === 'gate' && /^[AB]$/i.test(a1 || '') && flags.unlock) decide('ask', `unlocking Gate ${String(a1).toUpperCase()} re-opens decisions the team already made (idea/scope). Only with the human's explicit OK.`)
        if (sub === 'gate' && /^[ABC]$/i.test(a1 || '') && flags.lock && flags.force) decide('ask', `force-locking Gate ${String(a1).toUpperCase()} skips its readiness checks (e.g. TODO selectors left in the golden-path test). Only with the human's explicit OK.`)
        if (sub === 'state' && a1 === 'set' && /^(gates|hooks)(\.|$)/.test(a2 || '')) decide('ask', `changing ${a2} weakens HackForge's guardrails. Only with the human's explicit OK.`)
        if (sub === 'state' && a1 === 'set' && /^budget(\.|$)/.test(a2 || '')) decide('ask', 'changing the web-credit budget changes how much paid Bright Data usage is allowed — confirm with the human.')
      }

      // ---- git ----
      if (/^gh\s+repo\s+(create\b.*\s--push\b|sync\b)/.test(unq)) push = true
      const g = parseGit(seg, quoted)
      if (!g) continue
      const cwd = g.dir ? path.resolve(baseCwd, g.dir) : baseCwd
      const env = { ...psEnv, ...g.env }
      if (g.configs.some(c => /^core\.hookspath\s*=/i.test(c)) || g.configEnv.some(c => /^core\.hookspath=/i.test(c))) decide('deny', 'do not override core.hooksPath — fix what the git hooks report instead.')
      if (g.configs.some(c => /^alias\.\w+\s*=.*(--no-verify|\s-n\b|hookspath)/i.test(c))) decide('deny', 'do not alias around git hooks.')
      if (g.sub === 'config' && g.args.some(a => /^core\.hookspath$/i.test(a))) decide('deny', 'do not change core.hooksPath — it disables the repo\'s git hooks.')
      if (g.sub === 'config' && g.args.some(a => /^alias\./i.test(a)) && g.args.some(a => /--no-verify|(^|\s)-n\b|hookspath/i.test(a))) decide('deny', 'do not alias around git hooks.')
      if ((env.HUSKY === '0' || env.HUSKY_SKIP_HOOKS === '1' || 'SKIP' in env || env.PRE_COMMIT_ALLOW_NO_CONFIG) && ['commit', 'push', 'merge'].includes(g.sub)) {
        decide(soft, `skipping git hooks via ${Object.keys(env).join(', ')} — fix what the hooks report instead.`)
      }
      // Rolling the tree back to a checkpoint tag would also roll back .hackforge/state.json.
      if (/^(checkout|switch|reset|restore)$/.test(g.sub) && g.args.some(a => /^hf-cp\//.test(a) || /source=hf-cp\//.test(a)) && !g.args.some(a => /exclude\)?\.hackforge|:!\.hackforge/.test(a))) {
        decide('ask', 'rolling back to an hf-cp/* tag also reverts .hackforge/state.json (gates, checkpoints). Prefer: git restore --source <tag> --staged --worktree -- . \':(exclude).hackforge\'')
      }
      if (g.sub === 'commit') {
        commit = true
        scanCwd = cwd
        if (g.rawArgs.some(a => /^--no-veri(f(y)?)?$/.test(a) || clusterHas(a, 'n', 'mFCctuS'))) decide('deny', 'do not bypass git hooks (--no-verify / -n). Fix what the hook reports instead.')
        if (g.rawArgs.some(a => a === '--all' || clusterHas(a, 'a', 'mFCctuS'))) commitAll = true
      }
      if (g.sub === 'push') {
        push = true
        scanCwd = cwd
        if (g.rawArgs.some(a => /^--no-veri(f(y)?)?$/.test(a))) decide('deny', 'do not bypass git hooks (--no-verify).')
        const force = g.rawArgs.some(a => a === '--force' || clusterHas(a, 'f', 'o'))
        const lease = g.rawArgs.some(a => a.startsWith('--force-with-lease') || a.startsWith('--force-if-includes'))
        const mirror = g.rawArgs.includes('--mirror')
        const del = g.rawArgs.some(a => a === '--delete' || clusterHas(a, 'd', 'o'))
        const refs = g.args.filter(a => !a.startsWith('-')).slice(1) // first non-flag is the remote
        const current = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, timeoutMs: 5000 }).stdout.trim()
        const resolve = r => (r === 'HEAD' || r === '@' || r === '' ? current : r.replace(/^refs\/heads\//, ''))
        const plusRef = refs.some(r => r.startsWith('+'))
        const dsts = refs.map(r => r.replace(/^\+/, '')).map(r => (r.includes(':') ? r.split(':')[1] || r.split(':')[0] : r)).map(resolve)
        const targets = dsts.length ? dsts : [current]
        const isMain = b => b === 'main' || b === 'master'
        const touchesMain = targets.some(isMain) || refs.some(r => /^:(refs\/heads\/)?(main|master)$/.test(r))
        if (mirror) decide(soft, '`git push --mirror` overwrites every ref on the remote, including history judges may inspect.')
        if ((force || plusRef) && touchesMain) decide(soft, 'force-push to main/master rewrites the history judges may inspect. Use a branch, or --force-with-lease if you must.')
        if (lease && touchesMain) decide('ask', 'force-with-lease to main/master still rewrites shared history — confirm.')
        if ((del || refs.some(r => r.startsWith(':'))) && touchesMain) decide(soft, 'deleting main/master on the remote.')
      }
      if (g.sub === 'add' || g.sub === 'stage') {
        const paths = g.args.filter(a => !a.startsWith('-') || BROAD_PATHSPEC.has(a))
        if (paths.some(p => isEnvPath(norm(p)))) decide('deny', 'never stage .env files — they hold real keys. Commit .env.example with variable NAMES only.')
        const forced = g.rawArgs.some(a => a === '--force' || clusterHas(a, 'f'))
        const broad = g.rawArgs.some(a => BROAD_PATHSPEC.has(a)) || (!paths.length && g.rawArgs.some(a => clusterHas(a, 'A') || clusterHas(a, 'u')))
        if (forced && broad) decide(soft, '`git add -f` with a broad pathspec stages ignored files too (.env, caches, build output). Add specific paths instead.')
        if (broad) {
          const envs = unignoredEnvFiles(toplevel(cwd))
          if (envs.length) decide(soft, `broad git add while unignored env files exist (${envs.join(', ')}). Add them to .gitignore first.`)
        }
      }
    }
  }

  if (commit || push) {
    const top = toplevel(scanCwd)
    let findings = []
    let skipped = 0
    try {
      if (commit) {
        const staged = stagedEnvFiles(top, { includeTracked: commitAll })
        if (staged.length) decide('deny', `.env file(s) are staged (${staged.join(', ')}) — unstage with \`git restore --staged <file>\`, add them to .gitignore, and rotate any key they contain.`)
        const r = scanPendingCommit(top)
        findings.push(...r.findings)
        skipped = r.skipped
      }
      if (push) findings.push(...scanUnpushed(top))
    } catch (e) {
      decide('ask', `secret scan could not run (${e.message}); confirm nothing secret is being committed/pushed.`)
    }
    if (findings.length) {
      decide(soft, `possible secrets in what this ${push ? 'push' : 'commit'} would publish: ${listFindings(findings)}. Move them to .env (gitignored) and rotate any real key. Mark a false positive with a trailing comment "hackforge:allow-secret".`)
    }
    if (skipped) decide('ask', `${skipped} untracked file(s) were not secret-scanned (over the ${UNTRACKED_BYTES_BUDGET / 1048576} MB scan budget) — confirm they hold no keys, or commit in smaller batches.`)
  }
  allow()
} catch (e) {
  failOpen('git-guard', e)
}
