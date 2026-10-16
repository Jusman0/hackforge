export const meta = {
  name: 'judge-panel',
  description: 'HackForge mock judging: evidence (golden-path runner, design critic, submission reader) -> rubric judges with personas -> dedup fixes -> adversarial verify of HIGH items -> fail-closed READY verdict + fix list ranked by points per hour',
  whenToUse: 'Called by /hackforge:judge with args {projectDir, pluginRoot, now, url, criteria, scale}. Writes .hackforge/build/JUDGE_REPORT.md and QA_DRILL.md.',
  phases: [
    { title: 'Evidence', detail: 'run the golden path, inspect design, read the submission' },
    { title: 'Judge', detail: 'one judge per persona, scored against rubric anchors' },
    { title: 'Verify', detail: 'skeptic refutes HIGH-severity fixes; uncertain stays blocking' },
    { title: 'Report', detail: 'JUDGE_REPORT.md + QA_DRILL.md' },
  ],
}

// ---------- args (fail closed) ----------
const A = args || {}
const isAbs = p => /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(p) // POSIX, C:\ or \\server
function need(ok, msg) { if (!ok) throw new Error('judge-panel args: ' + msg + ' — launch this through /hackforge:judge (the skill fills these args from .hackforge/), not directly') }
// Runtime failures (dead agents) are not arg problems: report them without relaunch advice.
function fail(msg) { throw new Error('judge-panel: ' + msg) }
if (typeof A === 'string') throw new Error('judge-panel was started without structured args — run /hackforge:judge instead; it reads .hackforge/ and passes projectDir, pluginRoot, now and the rubric')
need(typeof A.projectDir === 'string' && isAbs(A.projectDir), 'projectDir (absolute path) is required')
need(typeof A.pluginRoot === 'string' && isAbs(A.pluginRoot), 'pluginRoot (absolute path) is required')
need(typeof A.now === 'string' && !Number.isNaN(Date.parse(A.now)), 'now (ISO timestamp) is required')
need(typeof A.url === 'string' && /^https?:\/\//.test(A.url), 'url (the app to judge — prefer the production alias) is required')
need(Array.isArray(A.criteria) && A.criteria.length > 0 && A.criteria.every(c => c.id && typeof c.weight === 'number'), 'criteria (rubric.json criteria [{id,name,weight,anchors}]) is required')
const SCALE = ['small', 'medium', 'large'].includes(A.scale) ? A.scale : 'medium'

const P = A.projectDir
const HF = P + '/.hackforge'
const BUILD = HF + '/build'
const CLI = `"${A.pluginRoot}/bin/hackforge"`
const IS_LOCAL = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[^/]*\.(local|localhost|internal|lan)(:|\/|$))/i.test(A.url)

const ALL_PERSONAS = [
  { id: 'technical', brief: 'Senior engineer. Probes the hard part, error handling, whether it is a thin wrapper. Asks "what breaks if I type my own input?"' },
  { id: 'impact', brief: 'Product/impact judge. Wants a named user, a quantified before/after shown in the demo, and a credible path to real use.' },
  { id: 'sponsor', brief: 'Sponsor rep. Scores only load-bearing, visible, well-explained use of their tech (README section + on screen).' },
  { id: 'non-technical', brief: 'Non-technical judge with 2 minutes. Can they restate what it does after 60 seconds? Is anything confusing?' },
  { id: 'llm-prescreener', brief: 'Automated LLM pre-screener reading ONLY the written submission (README/Devpost). Rewards criterion-mapped headings and verifiable claims.' },
  { id: 'skeptic-vc', brief: 'Skeptical investor. Already exists? Who pays? Why now? Why this team?' },
]
const N_JUDGES = { small: 2, medium: 4, large: 6 }[SCALE]
const PERSONAS = ALL_PERSONAS.slice(0, N_JUDGES)

const CTX = `
## HackForge context
- Project: "${P}" (cd there first). Inputs: .hackforge/rubric.json, .hackforge/ideas/IDEA.md, .hackforge/spec/DEMO_SCRIPT.md, SLICES.md, FAKE_VS_REAL.md; README.md and .hackforge/ship/* if they exist.
- App under judgment: ${A.url}${IS_LOCAL ? ' (LOCAL — judges will need the public production URL; flag it if none exists)' : ''}.
- CLI: ${CLI} (status --brief, clock, dev status). Now: ${A.now}.
- Judge what EXISTS and works, not what is planned. Never edit project files except the report files you are told to write.`

// ---------- Evidence ----------
phase('Evidence')
const RUNNER_SCHEMA = {
  type: 'object',
  properties: {
    goldenPath: { type: 'string', enum: ['pass', 'fail', 'missing'] },
    steps: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, ok: { type: 'boolean' }, note: { type: 'string' } }, required: ['step', 'ok'] } },
    probe: { type: 'object', properties: { ok: { type: 'boolean' }, problem: { type: 'string' } }, required: ['ok'], description: 'verbatim result of hackforge probe' },
    httpStatus: { type: 'number' }, loggedOutAccess: { type: 'boolean' }, mobileOk: { type: 'boolean' },
    consoleErrors: { type: 'array', items: { type: 'string' } }, slowSteps: { type: 'array', items: { type: 'string' } },
    screenshots: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
  },
  required: ['goldenPath', 'steps', 'screenshots', 'probe'],
}
const evidenceJobs = [
  () => agent(`Read and adopt your role card: "${A.pluginRoot}/agents/qa-runner.md" (ignore its YAML frontmatter).${CTX}
## Task: run the golden path like a judge would
1. Run \`${CLI} probe "${A.url}"\` FIRST and put its JSON (ok, problem) in \`probe\` verbatim — it is the deterministic public-access check (auth walls, deployment protection, local URLs). Then load ${A.url} fresh (no cookies). Record HTTP status, whether it works logged-out (no auth wall), first-load time.
2. Walk the DEMO_SCRIPT.md golden path step by step with Playwright (prefer the repo's tests/golden-path.spec.ts with BASE_URL=${A.url}; otherwise write a throwaway script under test-results/judge/ — never in tests/). Use real-looking input, including one input of your own that is NOT the seeded demo data.
3. Screenshot each step (desktop 1280×720) plus the landing page on a mobile viewport (390×844) into test-results/judge/.
4. Collect console errors, 4xx/5xx responses, steps slower than 3 s.
goldenPath = "missing" if there is no runnable path, "fail" if any step fails.`, { label: 'evidence:runner', phase: 'Evidence', schema: RUNNER_SCHEMA }),
  () => agent(`You are a ruthless product-design critic for a hackathon demo.${CTX}
## Task
Take (or reuse from test-results/judge/) screenshots of the main screens at ${A.url} and judge: the 5-second test (is it obvious what this is and who it is for?), visual hierarchy, empty/loading/error states on the golden path, copy clarity, and "AI slop" tells (generic gradient hero, lorem-like copy, purple-on-white template look, emoji confetti, inconsistent spacing, fake testimonials/metrics). Give concrete, cheap fixes.`,
    { label: 'evidence:design', phase: 'Evidence', schema: { type: 'object', properties: { fiveSecondTest: { type: 'string' }, issues: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] }, fix: { type: 'string' }, effortHours: { type: 'number' } }, required: ['issue', 'severity', 'fix'] } }, slopTells: { type: 'array', items: { type: 'string' } } }, required: ['fiveSecondTest', 'issues'] } }),
  () => agent(`You read the written submission like an LLM pre-screener and a time-poor judge would.${CTX}
## Task
Read README.md, .hackforge/ship/DEVPOST.md and .hackforge/ship/FACTS.md if they exist (else IDEA.md + DEMO_SCRIPT.md) and the repo layout (git log --oneline | head -40; ls). Report: the one-sentence pitch as a stranger would restate it; which rubric criteria the text explicitly addresses (map headings → criterion ids); claims made without evidence; sponsor tech claims and where they live in code (grep); AI-usage disclosure present?; commit history shape (count, one giant commit?); anything that looks pre-existing or copied; whether a public repo URL and a live URL are present.`,
    { label: 'evidence:submission', phase: 'Evidence', schema: { type: 'object', properties: { pitchAsRestated: { type: 'string' }, criteriaCovered: { type: 'array', items: { type: 'string' } }, unsupportedClaims: { type: 'array', items: { type: 'string' } }, sponsorEvidence: { type: 'array', items: { type: 'string' } }, aiDisclosure: { type: 'boolean' }, commits: { type: 'number' }, redFlags: { type: 'array', items: { type: 'string' } } }, required: ['pitchAsRestated', 'criteriaCovered', 'unsupportedClaims', 'redFlags'] } }),
]
const [runner, design, submission] = await parallel(evidenceJobs)
const warnings = []
const evidenceMissing = []
if (!runner) evidenceMissing.push('golden-path runner')
if (!design) evidenceMissing.push('design critic')
if (!submission) evidenceMissing.push('submission reader')
evidenceMissing.forEach(e => warnings.push(`evidence agent failed: ${e} — verdict cannot be READY`))
const evidence = { runner, design, submission }

// ---------- Judge ----------
phase('Judge')
const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    scores: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', enum: A.criteria.map(c => c.id) }, score: { type: 'number', minimum: 1, maximum: 5 }, why: { type: 'string' } }, required: ['id', 'score', 'why'] } },
    killerQuestions: { type: 'array', items: { type: 'string' } },
    fixes: { type: 'array', items: { type: 'object', properties: {
      fix: { type: 'string' }, criterion: { type: 'string', enum: A.criteria.map(c => c.id) }, severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
      expectedGain: { type: 'number', description: 'expected score gain on that criterion, 0-2 points on the 1-5 scale' },
      effortHours: { type: 'number' }, proof: { type: 'string', description: 'evidence that the problem exists (required for HIGH)' },
    }, required: ['fix', 'criterion', 'severity', 'expectedGain', 'effortHours'] } },
  },
  required: ['scores', 'killerQuestions', 'fixes'],
}
const judgePrompt = p => `Read and adopt your role card: "${A.pluginRoot}/agents/judge-persona.md" (ignore its YAML frontmatter).${CTX}
## Persona: ${p.id}
${p.brief}
## Rubric (score every criterion 1-5 using the anchors; be calibrated — 3 means "meets", 5 is rare)
${JSON.stringify(A.criteria)}
## Evidence gathered by others (trust but verify cheaply if something looks off; you may open the app/screenshots yourself)
${JSON.stringify(evidence)}
Return per-criterion scores with one-line reasons, the 3 questions you would ask the team, and fixes. HIGH = would likely cost a placing (broken golden path, auth wall, missing required tech, crash, misleading claim) and MUST include proof.`
const judged = await parallel(PERSONAS.map(p => () => agent(judgePrompt(p), { label: `judge:${p.id}`, phase: 'Judge', schema: JUDGE_SCHEMA })))
const okJudges = judged.filter(Boolean)
PERSONAS.forEach((p, i) => { if (!judged[i]) warnings.push(`judge ${p.id} failed (null)`) })
if (!(okJudges.length > 0)) fail('every judge failed — no scores')

// ---------- deterministic aggregation ----------
const mean = xs => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
const totalW = A.criteria.reduce((a, c) => a + c.weight, 0) || 1
const perCriterion = A.criteria.map(c => {
  const xs = okJudges.map(j => j.scores.find(s => s.id === c.id)?.score).filter(x => typeof x === 'number')
  return { id: c.id, name: c.name, weight: c.weight, mean: xs.length ? Math.round(mean(xs) * 10) / 10 : null, spread: xs.length ? Math.max(...xs) - Math.min(...xs) : null, scored: xs.length }
})
const total = Math.round(perCriterion.reduce((a, c) => a + c.weight * ((c.mean ?? 1) / 5), 0) / totalW * 1000) / 10

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 8).sort().join(' ')
const fixMap = new Map()
const sevRank = { HIGH: 3, MEDIUM: 2, LOW: 1 }
for (const [i, j] of okJudges.entries()) {
  for (const f of j.fixes) {
    const k = `${f.criterion}|${norm(f.fix)}`
    const prev = fixMap.get(k)
    if (prev) {
      prev.reportedBy.push(PERSONAS[judged.indexOf(j)]?.id || `judge${i}`)
      if (sevRank[f.severity] > sevRank[prev.severity]) { prev.severity = f.severity; prev.proof = f.proof || prev.proof }
      prev.expectedGain = Math.max(prev.expectedGain, f.expectedGain)
    } else fixMap.set(k, { ...f, reportedBy: [PERSONAS[judged.indexOf(j)]?.id || `judge${i}`] })
  }
}
for (const d of design?.issues || []) {
  const k = `U|${norm(d.issue)}`
  if (!fixMap.has(k)) fixMap.set(k, { fix: d.fix, criterion: (A.criteria.find(c => /design|ux|usab/i.test(c.name)) || A.criteria[A.criteria.length - 1]).id, severity: d.severity, expectedGain: d.severity === 'HIGH' ? 1 : 0.5, effortHours: d.effortHours ?? 1, proof: d.issue, reportedBy: ['design-critic'] })
}
const weightOf = id => A.criteria.find(c => c.id === id)?.weight ?? 0
let fixes = [...fixMap.values()].map(f => ({ ...f, pointsPerHour: Math.round(((f.expectedGain / 5) * weightOf(f.criterion)) / Math.max(0.25, f.effortHours || 1) * 10) / 10 }))

// ---------- Verify HIGH fixes ----------
phase('Verify')
const highs = fixes.filter(f => f.severity === 'HIGH').slice(0, 6)
if (fixes.filter(f => f.severity === 'HIGH').length > 6) warnings.push(`more than 6 HIGH findings — only the first 6 were verified; the rest stay blocking`)
let verdicts = []
if (highs.length) {
  const v = await agent(`You are a skeptical verifier. For each HIGH-severity finding below, try to REFUTE it by checking the live app (${A.url}) and the repo yourself. Return isReal=false only if you are confident (>= 0.8) it is wrong. If you cannot check it, say so (isReal stays true).${CTX}
Findings: ${JSON.stringify(highs.map((f, i) => ({ i, fix: f.fix, criterion: f.criterion, proof: f.proof })))}`,
    { label: 'verify:high', phase: 'Verify', schema: { type: 'object', properties: { verdicts: { type: 'array', items: { type: 'object', properties: { i: { type: 'number' }, isReal: { type: 'boolean' }, confidence: { type: 'number' }, note: { type: 'string' } }, required: ['i', 'isReal', 'confidence'] } } }, required: ['verdicts'] } })
  if (!v) warnings.push('HIGH-finding verifier failed — all HIGH findings stay blocking (unverified)')
  verdicts = v ? v.verdicts : []
}
fixes = fixes.map(f => {
  if (f.severity !== 'HIGH') return { ...f, status: 'advisory' }
  const idx = highs.indexOf(f)
  const vd = verdicts.find(x => x.i === idx)
  if (vd && vd.isReal === false && vd.confidence >= 0.8) return { ...f, status: 'refuted', verifierNote: vd.note }
  return { ...f, status: vd ? 'blocking' : 'blocking-unverified', verifierNote: vd?.note }
}).sort((a, b) => (a.status.startsWith('blocking') ? 0 : 1) - (b.status.startsWith('blocking') ? 0 : 1) || b.pointsPerHour - a.pointsPerHour)
const blocking = fixes.filter(f => f.status.startsWith('blocking'))

// Fail closed: READY needs a passing golden path, all evidence, no blocking finding, and a public URL.
const reasons = []
const failedSteps = (runner?.steps || []).filter(s => !s.ok)
if (!runner || runner.goldenPath !== 'pass' || !runner.steps?.length || failedSteps.length) reasons.push(`golden path ${!runner ? 'not run' : failedSteps.length ? `step failed: ${failedSteps.map(s => s.step).join(', ')}` : runner.goldenPath}`)
const unscored = perCriterion.filter(c => c.scored === 0).map(c => c.id)
if (unscored.length) reasons.push(`criteria not scored by any judge: ${unscored.join(', ')}`)
if (runner && !runner.probe?.ok) reasons.push(`public-access probe failed: ${runner.probe?.problem || 'no probe result'}`)
if (runner && (runner.loggedOutAccess === false || (runner.httpStatus && runner.httpStatus !== 200))) reasons.push(`not publicly accessible (HTTP ${runner.httpStatus ?? '?'}, logged-out access ${runner.loggedOutAccess})`)
if (evidenceMissing.length) reasons.push(`missing evidence: ${evidenceMissing.join(', ')}`)
if (blocking.length) reasons.push(`${blocking.length} blocking finding(s)`)
if (IS_LOCAL) reasons.push('judged a local URL — no public production URL verified')
if (okJudges.length < PERSONAS.length) reasons.push(`${PERSONAS.length - okJudges.length} judge(s) failed`)
const verdict = reasons.length ? 'NOT_READY' : 'READY'

// ---------- Report ----------
phase('Report')
const report = await agent(`You are the HackForge judging-report writer. Write two files from the data below; do not change numbers or verdicts.
1. "${BUILD}/JUDGE_REPORT.md": "# Mock judging — ${verdict} — ${total}/100" (${A.now.slice(0, 16)}Z, URL ${A.url}); reasons if NOT_READY: ${JSON.stringify(reasons)}; per-criterion table (criterion, weight, mean, spread); the golden-path step table; "## Fix list (ranked)" — blocking first, then by points/hour: fix, criterion, severity, status, effort h, points/h, reported by; "## Design notes"; "## Submission gaps"; "## Warnings": ${JSON.stringify(warnings)}.
2. "${BUILD}/QA_DRILL.md": the judges' killer questions grouped and deduplicated, each with a suggested honest answer drawn ONLY from the repo/.hackforge facts (write "TODO — team must answer" when unknown), plus the standard drill (who is the user, who pays, what is real vs mocked, why this model, how did you measure quality, what did AI write vs you, hardest bug, what's next).
Data: ${JSON.stringify({ perCriterion, total, verdict, fixes, evidence, killerQuestions: okJudges.flatMap(j => j.killerQuestions) })}`,
  { label: 'report', phase: 'Report', effort: 'low', ...(A.cheapModel ? { model: A.cheapModel } : {}) })
if (report === null) warnings.push('report writer failed — JUDGE_REPORT.md may be missing; the returned JSON is authoritative')

return {
  ok: verdict === 'READY',
  verdict,
  score: total,
  summary: `${verdict} — ${total}/100 from ${okJudges.length} judge(s); ${blocking.length} blocking, ${fixes.length} fixes total${reasons.length ? ' — ' + reasons.join('; ') : ''}`,
  outputs: [`${BUILD}/JUDGE_REPORT.md`, `${BUILD}/QA_DRILL.md`],
  perCriterion,
  topFixes: fixes.slice(0, 8).map(({ reportedBy, ...f }) => ({ ...f, reportedBy: reportedBy.join(',') })),
  reasons,
  stats: { scale: SCALE, judges: okJudges.length, fixes: fixes.length, blocking: blocking.length, refuted: fixes.filter(f => f.status === 'refuted').length },
  warnings,
}
