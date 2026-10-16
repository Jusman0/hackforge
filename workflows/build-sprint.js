export const meta = {
  name: 'build-sprint',
  description: 'HackForge build: per slice, builder implements to contract -> separate QA runner verifies against the live app -> capped fix rounds with plateau stop (parallel mode: worktrees + integrator)',
  whenToUse: 'Called by /hackforge:build with args {projectDir, pluginRoot, now, slices:[ids], mode, label, maxRounds}. Writes .hackforge/build/feedback/*.',
  phases: [
    { title: 'Build', detail: 'builder agent per slice (minimal diff, commits, never edits judge files)' },
    { title: 'QA', detail: 'qa-runner checks every acceptance criterion on the running app' },
    { title: 'Integrate', detail: 'parallel mode only: merge slice branches, golden-path smoke after each' },
  ],
}

// ---------- args (fail closed) ----------
const A = args || {}
const isAbs = p => /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(p) // POSIX, C:\ or \\server
function need(ok, msg) { if (!ok) throw new Error('build-sprint args: ' + msg + ' — launch this through /hackforge:build (the skill fills these args from .hackforge/), not directly') }
// Runtime failures (dead agents) are not arg problems: report them without relaunch advice.
function fail(msg) { throw new Error('build-sprint: ' + msg) }
if (typeof A === 'string') throw new Error('build-sprint was started without structured args — run /hackforge:build instead; it reads .hackforge/ and passes projectDir, pluginRoot, now and the rubric')
need(typeof A.projectDir === 'string' && isAbs(A.projectDir), 'projectDir (absolute path) is required')
need(typeof A.pluginRoot === 'string' && isAbs(A.pluginRoot), 'pluginRoot (absolute path) is required')
need(typeof A.now === 'string' && !Number.isNaN(Date.parse(A.now)), 'now (ISO timestamp) is required')
need(Array.isArray(A.slices) && A.slices.length > 0 && A.slices.every(s => typeof s === 'string' && /^[\w.-]+$/.test(s)), 'slices must be a non-empty array of slice ids from .hackforge/spec/SLICES.md (e.g. ["S1"])')
const MODE = A.mode === 'parallel' || A.parallel === true ? 'parallel' : 'sequential'
const MAX_ROUNDS = Number.isInteger(A.maxRounds) ? Math.max(0, Math.min(3, A.maxRounds)) : 2
const LABEL = String(A.label || 'sprint').replace(/[^\w.-]/g, '_')
const DEV_URL = typeof A.devUrl === 'string' && A.devUrl ? A.devUrl : null
const CONTINUE = A.continueOnFail === true

const P = A.projectDir
const HF = P + '/.hackforge'
const FB = HF + '/build/feedback'
const CLI = `"${A.pluginRoot}/bin/hackforge"`

const CTX_COMMON = `
- CLI: ${CLI} (status --brief | clock | secrets --staged). Now: ${A.now}. Check \`${CLI} clock\` — if mode is frozen/final, only golden-path fixes are allowed.
- Judge files (SLICES.md contracts, DEMO_SCRIPT.md, rubric.json, golden-path tests, lint/tsconfig/test configs) are protected after Gate B: never weaken them to make work pass. If a criterion is genuinely wrong, report it instead.
- Secrets: env var NAMES only in code and .env.example; never hardcode keys, never commit .env*. Model/API calls go server-side.`

// Worktree builders must stay in their own checkout: "cd to the project" would switch the MAIN tree's branch.
const CTX_WORKTREE = `
## HackForge context (isolated worktree)
- Work ONLY in your current directory — it is a separate git worktree of the project. Never cd to "${P}" and never run git checkout/switch there.
- The spec is committed: read ./.hackforge/spec/SLICES.md (your slice contract), ./.hackforge/spec/DEMO_SCRIPT.md, STACK.md, FAKE_VS_REAL.md from THIS directory. Do not edit anything under ./.hackforge/.
- Do not start a dev server; QA runs after the integrator merges your branch.${CTX_COMMON}`

const CTX = `
## HackForge context
- Project: "${P}" (cd there first). Spec: .hackforge/spec/SLICES.md (slice contracts = acceptance criteria), DEMO_SCRIPT.md (the golden path), STACK.md, FAKE_VS_REAL.md, PRD.md. Idea: .hackforge/ideas/IDEA.md.
- CLI: ${CLI} (status --brief | clock | dev up | dev status | dev logs | secrets --staged). Dev server: \`${CLI} dev up\` is idempotent and survives your session${DEV_URL ? `; expected at ${DEV_URL}` : ''}.
- Now: ${A.now}. Check \`${CLI} clock\` — if mode is frozen/final, only golden-path fixes are allowed.
- Judge files (SLICES.md contracts, DEMO_SCRIPT.md, rubric.json, golden-path tests, lint/tsconfig/test configs) are protected after Gate B: never weaken them to make work pass. If a criterion is genuinely wrong, report it instead.
- Secrets: env var NAMES only in code and .env.example; never hardcode keys, never commit .env*. Model/API calls go server-side.`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    slice: { type: 'string' }, summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    commits: { type: 'array', items: { type: 'string' }, description: 'short sha + subject' },
    branch: { type: 'string' },
    toplevel: { type: 'string', description: 'git rev-parse --show-toplevel (worktree mode)' },
    gitDir: { type: 'string', description: 'git rev-parse --absolute-git-dir (worktree mode)' },
    commonDir: { type: 'string', description: 'git rev-parse --path-format=absolute --git-common-dir (worktree mode)' },
    checksRun: { type: 'array', items: { type: 'string' }, description: 'build/typecheck/lint/test commands run and their result' },
    blocked: { type: 'boolean' }, blockedReason: { type: 'string' },
    notesForQa: { type: 'string' },
  },
  required: ['slice', 'summary', 'filesChanged', 'commits', 'blocked'],
}
const QA_SCHEMA = {
  type: 'object',
  properties: {
    slice: { type: 'string' }, pass: { type: 'boolean' },
    checks: { type: 'array', items: { type: 'object', properties: { criterion: { type: 'string' }, pass: { type: 'boolean' }, evidence: { type: 'string' } }, required: ['criterion', 'pass', 'evidence'] } },
    failures: { type: 'array', items: { type: 'object', properties: { criterion: { type: 'string' }, observed: { type: 'string' }, expected: { type: 'string' }, hint: { type: 'string' } }, required: ['criterion', 'observed', 'expected'] } },
    feedbackFile: { type: 'string' },
    devUrl: { type: 'string' },
    screenshots: { type: 'array', items: { type: 'string' } },
    contractProblems: { type: 'array', items: { type: 'string' }, description: 'criteria that look wrong/untestable — for the human, not for the builder to change' },
  },
  required: ['slice', 'pass', 'checks', 'failures', 'feedbackFile'],
}

const builderPrompt = (id, feedbackFile, round, worktree) => `Read and adopt your role card: "${A.pluginRoot}/agents/builder.md" (ignore its YAML frontmatter).${worktree ? CTX_WORKTREE : CTX}
## Task: implement slice ${id}${round ? ` — FIX ROUND ${round}` : ''}
Read slice ${id} in .hackforge/spec/SLICES.md and implement exactly its contract — nothing outside it. ${round ? `The QA report "${feedbackFile}" lists failures: fix ONLY those (minimal diff); do not refactor.` : 'Keep the diff minimal and the golden path working end-to-end; prefer thin vertical slices over layers.'}
${worktree
    ? `Create branch "hf/slice-${id}" in THIS worktree (git switch -c hf/slice-${id}) and commit there. Report \`git rev-parse --show-toplevel\` as toplevel, \`git rev-parse --absolute-git-dir\` as gitDir, \`git rev-parse --path-format=absolute --git-common-dir\` as commonDir and \`git rev-parse --abbrev-ref HEAD\` as branch. If something must change in FAKE_VS_REAL.md, put it in notesForQa instead (the integrator applies it).`
    : 'Work in the main tree. Commit small and often with messages like "feat(slice-' + id + '): …" (commit history is judging evidence).'}
Before finishing: run the project's fast checks (typecheck/build/lint as available) and fix what you broke. If something outside your control blocks you (missing key, account, unclear contract), set blocked=true with a precise reason instead of faking it — use DEMO_MODE fixtures only where FAKE_VS_REAL.md allows and record any new mock there.`

const qaPrompt = (id, round, build) => `Read and adopt your role card: "${A.pluginRoot}/agents/qa-runner.md" (ignore its YAML frontmatter).${CTX}
## Task: verify slice ${id}${round ? ` (after fix round ${round})` : ''}
Builder's report (claims to verify, not to trust): ${JSON.stringify(build ? { summary: build.summary, filesChanged: build.filesChanged, checksRun: build.checksRun, notesForQa: build.notesForQa } : null)}
1. Ensure the app runs: \`${CLI} dev up\` (or the command in STACK.md). Use the URL it reports.
2. Check EVERY acceptance criterion of slice ${id} in .hackforge/spec/SLICES.md with real evidence: commands and their output, HTTP status codes, Playwright runs (npx playwright test …, BASE_URL=<url>), screenshots of key screens into test-results/qa/. Also run the golden-path test if it exists (tests/golden-path.spec.ts or e2e/golden-path*) — a slice that breaks the golden path fails.
3. Never edit application code or tests. Write the report to "${FB}/${LABEL}-${id}-r${round}.md": verdict, per-criterion pass/fail with evidence, failures with observed vs expected and a hint (not a patch), and contract problems for the human.
Be strict: unverifiable = fail. Return the schema with feedbackFile set to that path.`

const warnings = []
const results = []
// QA must agree with itself: pass only if it says pass, lists no failures, and every check passed.
const qaPass = q => Boolean(q && q.pass && q.failures.length === 0 && q.checks.length > 0 && q.checks.every(c => c.pass))
const qaFailures = q => [...q.failures, ...q.checks.filter(c => !c.pass && !q.failures.some(f => f.criterion === c.criterion)).map(c => ({ criterion: c.criterion, observed: c.evidence, expected: 'pass' }))]

// One slice, in the main tree: build → QA → fix rounds (≤ MAX_ROUNDS) with plateau stop.
// startFeedback lets parallel mode continue fixing a slice whose merged QA failed.
async function runSlice(id, { startRound = 0, startFeedback = null, startFailures = Infinity } = {}) {
  let round = startRound
  let feedbackFile = startFeedback
  let lastFailures = startFailures
  let status = 'fail'
  let reason = ''
  let lastQa = null
  const builds = []
  while (round <= MAX_ROUNDS) {
    const b = await agent(builderPrompt(id, feedbackFile, round, false), { label: `build:${id}${round ? ' r' + round : ''}`, phase: 'Build', schema: BUILD_SCHEMA })
    if (!b) { status = 'blocked'; reason = 'builder agent failed (null)'; break }
    builds.push(b)
    if (b.blocked) { status = 'blocked'; reason = b.blockedReason || 'builder reported blocked'; break }
    const q = await agent(qaPrompt(id, round, b), { label: `qa:${id}${round ? ' r' + round : ''}`, phase: 'QA', schema: QA_SCHEMA })
    if (!q) { status = 'unverified'; reason = 'QA agent failed (null) — slice NOT verified'; break }
    lastQa = q
    if (qaPass(q)) { status = 'pass'; break }
    const nFail = qaFailures(q).length
    if (nFail >= lastFailures) { status = 'plateau'; reason = `no progress in round ${round} (${nFail} failures)`; break }
    lastFailures = nFail
    feedbackFile = q.feedbackFile
    round++
    if (round > MAX_ROUNDS) { status = 'fail'; reason = `still failing after ${MAX_ROUNDS} fix round(s)` }
  }
  return {
    slice: id, status, reason, rounds: round, commits: builds.flatMap(b => b.commits || []),
    failures: lastQa ? qaFailures(lastQa) : [], contractProblems: lastQa?.contractProblems || [], feedbackFile: lastQa?.feedbackFile || null, devUrl: lastQa?.devUrl || null,
  }
}

// In a linked worktree, --absolute-git-dir (…/.git/worktrees/x) differs from --git-common-dir (…/.git).
// Path comparison alone is fooled by /private symlinks and Windows slashes, so it is only a fallback.
const normPath = p => String(p || '').replace(/\\/g, '/').replace(/^\/private(?=\/)/, '').replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase() + ':').replace(/\/+$/, '')
function inWorktree(b) {
  if (b.gitDir && b.commonDir) return normPath(b.gitDir) !== normPath(b.commonDir)
  if (b.toplevel) return normPath(b.toplevel) !== normPath(P)
  return false // fail closed: no evidence
}

if (MODE === 'sequential') {
  for (const id of A.slices) {
    phase('Build')
    const r = await runSlice(id)
    results.push(r)
    log(`slice ${id}: ${r.status}${r.reason ? ' — ' + r.reason : ''}`)
    if (r.status !== 'pass' && !CONTINUE) {
      const rest = A.slices.slice(A.slices.indexOf(id) + 1)
      if (rest.length) warnings.push(`stopped after ${id} (${r.status}); not attempted: ${rest.join(', ')}`)
      break
    }
  }
} else {
  phase('Build')
  const built = await parallel(A.slices.map(id => () => agent(builderPrompt(id, null, 0, true), { label: `build:${id}`, phase: 'Build', schema: BUILD_SCHEMA, isolation: 'worktree' })))
  const ready = []
  A.slices.forEach((id, i) => {
    const b = built[i]
    if (!b) results.push({ slice: id, status: 'blocked', reason: 'builder agent failed (null)' })
    else if (b.blocked) results.push({ slice: id, status: 'blocked', reason: b.blockedReason || 'blocked' })
    else if (!inWorktree(b)) results.push({ slice: id, status: 'blocked', reason: 'builder could not prove it worked in its own worktree (git-dir equals git-common-dir, or toplevel is the main checkout) — inspect `git status` / `git branch` in the main tree before continuing' })
    else ready.push({ id, branch: b.branch || `hf/slice-${id}`, summary: b.summary, notes: b.notesForQa || '' })
  })
  if (ready.length) {
    phase('Integrate')
    const integ = await agent(
      `You are the HackForge integrator.${CTX}
Merge these slice branches into the current branch of "${P}" ONE AT A TIME, in this order: ${JSON.stringify(ready.map(r => ({ id: r.id, branch: r.branch, notes: r.notes })))}.
After each merge: run the fast checks (build/typecheck) and the golden-path smoke (GOLDEN_SMOKE=1 npx playwright test tests/golden-path.spec.ts with BASE_URL from \`${CLI} dev up\`, if the test exists). If a merge conflicts or breaks the smoke, abort/revert THAT merge (git merge --abort or git revert -m 1), record why, and continue with the next. Apply any FAKE_VS_REAL notes from the builders after their merge. Never force-push. Never edit judge files.
Report merged and rejected by slice id exactly as given.`,
      { label: 'integrate', phase: 'Integrate', schema: { type: 'object', properties: {
        merged: { type: 'array', items: { type: 'string', enum: ready.map(r => r.id) } },
        rejected: { type: 'array', items: { type: 'object', properties: { slice: { type: 'string', enum: ready.map(r => r.id) }, reason: { type: 'string' } }, required: ['slice', 'reason'] } },
      }, required: ['merged', 'rejected'] } },
    )
    if (!integ) {
      warnings.push('integrator failed — branches were NOT merged; merge them manually')
      ready.forEach(r => results.push({ slice: r.id, status: 'unverified', reason: `built on ${r.branch}, not merged` }))
    } else {
      const mergedIds = new Set(integ.merged)
      const rejectedIds = new Set(integ.rejected.map(r => r.slice))
      integ.rejected.forEach(r => results.push({ slice: r.slice, status: 'fail', reason: `merge rejected: ${r.reason}` }))
      ready.filter(r => !mergedIds.has(r.id) && !rejectedIds.has(r.id)).forEach(r => results.push({ slice: r.id, status: 'unverified', reason: 'integrator reported neither merged nor rejected' }))
      phase('QA')
      const merged = ready.filter(r => mergedIds.has(r.id) && !rejectedIds.has(r.id))
      const qas = await parallel(merged.map(r => () => agent(qaPrompt(r.id, 0, { summary: r.summary }), { label: `qa:${r.id}`, phase: 'QA', schema: QA_SCHEMA })))
      for (const [i, r] of merged.entries()) {
        const q = qas[i]
        if (!q) { results.push({ slice: r.id, status: 'unverified', reason: 'QA agent failed (null)' }); continue }
        if (qaPass(q)) { results.push({ slice: r.id, status: 'pass', reason: '', failures: [], feedbackFile: q.feedbackFile, devUrl: q.devUrl }); continue }
        // Merged but failing: continue with sequential fix rounds in the main tree (bounded by MAX_ROUNDS).
        if (MAX_ROUNDS > 0) {
          phase('Build')
          results.push(await runSlice(r.id, { startRound: 1, startFeedback: q.feedbackFile, startFailures: qaFailures(q).length }))
        } else results.push({ slice: r.id, status: 'fail', reason: `${q.failures.length} failing criteria`, failures: q.failures, contractProblems: q.contractProblems || [], feedbackFile: q.feedbackFile, devUrl: q.devUrl })
      }
    }
  }
}

const passed = [...new Set(results.filter(r => r.status === 'pass').map(r => r.slice))]
return {
  ok: A.slices.every(id => passed.includes(id)),
  summary: `${MODE} sprint "${LABEL}": ${passed.length}/${A.slices.length} slices passed QA${results.some(r => r.status !== 'pass') ? ' — ' + results.filter(r => r.status !== 'pass').map(r => `${r.slice}:${r.status}`).join(', ') : ''}`,
  outputs: results.map(r => r.feedbackFile).filter(Boolean),
  results,
  devUrl: results.find(r => r.devUrl)?.devUrl || DEV_URL,
  stats: { mode: MODE, maxRounds: MAX_ROUNDS, slices: A.slices.length, passed: passed.length, maxAgents: MODE === 'sequential' ? A.slices.length * 2 * (MAX_ROUNDS + 1) : A.slices.length * 2 + 1 + A.slices.length * 2 * MAX_ROUNDS },
  warnings,
}
