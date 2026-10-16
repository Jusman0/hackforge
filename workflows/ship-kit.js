export const meta = {
  name: 'ship-kit',
  description: 'HackForge submission factory: FACTS.md (single source of truth) -> README, Devpost story, 5-slide pitch, video script in parallel -> Santa dual review (fact-checker + judge persona) -> revise -> submission checklist validation',
  whenToUse: 'Called by /hackforge:ship with args {projectDir, pluginRoot, now, criteria, video, links, scale}. Writes .hackforge/ship/*.',
  phases: [
    { title: 'Facts', detail: 'extract verified facts only; TODO where unknown' },
    { title: 'Write', detail: 'README, DEVPOST, PITCH.html, VIDEO_SCRIPT from FACTS.md' },
    { title: 'Review', detail: 'two isolated reviewers; both must pass' },
    { title: 'Checklist', detail: 'validate links, video, repo, secrets, disclosure' },
  ],
}

// ---------- args (fail closed) ----------
const A = args || {}
const isAbs = p => /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(p) // POSIX, C:\ or \\server
function need(ok, msg) { if (!ok) throw new Error('ship-kit args: ' + msg + ' — launch this through /hackforge:ship (the skill fills these args from .hackforge/), not directly') }
// Runtime failures (dead agents) are not arg problems: report them without relaunch advice.
function fail(msg) { throw new Error('ship-kit: ' + msg) }
if (typeof A === 'string') throw new Error('ship-kit was started without structured args — run /hackforge:ship instead; it reads .hackforge/ and passes projectDir, pluginRoot, now and the rubric')
need(typeof A.projectDir === 'string' && isAbs(A.projectDir), 'projectDir (absolute path) is required')
need(typeof A.pluginRoot === 'string' && isAbs(A.pluginRoot), 'pluginRoot (absolute path) is required')
need(typeof A.now === 'string' && !Number.isNaN(Date.parse(A.now)), 'now (ISO timestamp) is required')
need(Array.isArray(A.criteria) && A.criteria.length > 0, 'criteria (rubric.json criteria) is required')
const SCALE = ['small', 'medium', 'large'].includes(A.scale) ? A.scale : 'medium'
const VIDEO = A.video && typeof A.video.maxSeconds === 'number' ? A.video : { maxSeconds: 180, minSeconds: 0, bans: [], mustInclude: [] }
const LINKS = A.links || {}
const ALL = ['readme', 'devpost', 'pitch', 'video']
const WANT = Array.isArray(A.deliverables) && A.deliverables.length ? ALL.filter(d => A.deliverables.includes(d)) : ALL
need(WANT.length > 0, 'deliverables must include at least one of readme, devpost, pitch, video')

const P = A.projectDir
const HF = P + '/.hackforge'
const SHIP = HF + '/ship'
const T = A.pluginRoot + '/templates/ship'
const CLI = `"${A.pluginRoot}/bin/hackforge"`
const SUB = `${A.pluginRoot}/skills/playbook/references/submission.md`

const CTX = `
## HackForge context
- Project: "${P}" (cd there first). Ship folder: .hackforge/ship/. Playbook for submissions: "${SUB}".
- Rubric criteria: ${JSON.stringify(A.criteria.map(c => ({ id: c.id, name: c.name, weight: c.weight })))}. Video rules: ${JSON.stringify(VIDEO)}.
- Links known so far: ${JSON.stringify(LINKS)}. Now: ${A.now}.
- THE RULE: every claim in any deliverable must trace to "${SHIP}/FACTS.md". If a fact is missing, write "TODO: <what is needed>" — never invent URLs, metrics, users, quotes, teammates or prizes. Mark mocked parts honestly.`

// mode "checklist": only re-validate the checklist (e.g. after the video is uploaded / links changed).
const MODE = A.mode === 'checklist' ? 'checklist' : 'full'
const FRESH = A.fresh === true
const warnings = []
const SPEC = {
  readme: { file: `${SHIP}/README.md`, tpl: `${T}/README.judge.md`, task: 'Judge-facing README for the repo root: Judge quickstart (≤60 s: live URL, demo login if any, 3 clicks to the aha), Judging Highlights mapped to each rubric criterion, problem with a number, what it does, how it works (the hard part), evaluation, one "Built with <sponsor>" section per sponsor (what, where in code, why load-bearing), "How we used AI coding agents", "What\'s real vs mocked", limitations & next, run locally (.env.example names only), license, team.' },
  devpost: { file: `${SHIP}/DEVPOST.md`, tpl: `${T}/DEVPOST.md`, task: `Devpost project story using the standard headings, each mapped to rubric criteria (put the criterion in an HTML comment), plus title (≤${A.limits?.titleChars || 60} chars), tagline (≤${A.limits?.taglineChars || 200} chars)${A.limits?.summaryWords ? `, a summary of ≤${A.limits.summaryWords} words` : ''}, and a "Built with" tag list.` },
  pitch: { file: `${SHIP}/PITCH.html`, tpl: `${T}/pitch.html`, task: 'Fill the 5-slide HTML deck template (replace every double-brace token; ≤4 bullets per slide): title + named user, problem with a number, LIVE DEMO slot (backup video path/URL + QR/URL), how it works / the hard part, evidence + impact + sponsors + next. Speaker notes per slide timed for a 3-minute live pitch.' },
  video: { file: `${SHIP}/VIDEO_SCRIPT.md`, tpl: `${T}/VIDEO_SCRIPT.md`, task: `Timed demo-video script within ${VIDEO.maxSeconds}s${VIDEO.minSeconds ? ` and ≥${VIDEO.minSeconds}s` : ''}: hook+problem, demo (about half the runtime, aha by ~1/3), the hard part + how quality was measured, impact + next. Columns: time, on-screen (matching DEMO_SCRIPT steps and the demo/record-demo.mjs STEPS), narration for a HUMAN to read (~2.3 words/s, so ≤ ${Math.floor(VIDEO.maxSeconds * 2.3)} words), caption. Include the constraint checklist (length, ${VIDEO.minHeight ? `≥${VIDEO.minHeight}p, ` : ''}visibility ${VIDEO.visibility || 'public or unlisted'}, bans ${JSON.stringify(VIDEO.bans || [])}, must-include ${JSON.stringify(VIDEO.mustInclude || [])}). ${VIDEO.ttsAllowed ? 'TTS is allowed by the rules, but human narration is still better.' : 'Human narration only (no TTS/AI voice).'}` },
}
const strictPass = x => Boolean(x && x.pass && !x.issues.some(i => i.severity !== 'minor'))

let facts = null
let written = []
let writeRes = []
let review = []
let rounds = 0
let files = []

if (MODE === 'full') {
  // ---------- Facts (merge, never rebuild: the team answers TODOs between runs) ----------
  phase('Facts')
  facts = await agent(`Read and adopt your role card: "${A.pluginRoot}/agents/storyteller.md" (ignore its YAML frontmatter).${CTX}
## Task: ${FRESH ? `build "${SHIP}/FACTS.md" from the template "${T}/FACTS.md"` : `update "${SHIP}/FACTS.md" (create it from the template "${T}/FACTS.md" only if it does not exist)`}
${FRESH ? '' : 'If FACTS.md exists: KEEP every row a human added or that has evidence (team names, measured numbers, video URL, answers to earlier TODOs), refresh rows whose evidence changed, and only fill or re-list TODOs. Never delete a human-supplied fact.\n'}Sources (verify, don't trust): .hackforge/ideas/IDEA.md, .hackforge/spec/*.md (DEMO_SCRIPT, PRD, FAKE_VS_REAL, STACK), .hackforge/build/JUDGE_REPORT.md and feedback/, .hackforge/research/claims.json (use ONLY verdict "confirmed" or high-confidence "fact" claims for numbers, with their URLs), git log, package.json / requirements, the code (grep for each sponsor SDK to get file paths), and the live URL (${LINKS.prodUrl || 'see state: ' + CLI + ' state get stack.prodUrl'}). Record what the golden path verifiably does (from the latest judge/QA evidence), what is mocked, sponsor integrations with code locations, AI-agent usage (how Claude Code/HackForge was used, honestly), team (from HACKATHON.md / state — names only if given), and links. List every missing fact under "## TODO".`,
    { label: 'facts', phase: 'Facts', schema: { type: 'object', properties: { file: { type: 'string' }, oneLiner: { type: 'string' }, verifiedNumbers: { type: 'number' }, mocked: { type: 'array', items: { type: 'string' } }, sponsors: { type: 'array', items: { type: 'string' } }, todos: { type: 'array', items: { type: 'string' } } }, required: ['file', 'oneLiner', 'todos'] } })
  if (!(facts)) fail('fact extraction failed — refusing to write submission copy without FACTS.md')

  // ---------- Write (update in place when a deliverable exists, so hand edits survive) ----------
  phase('Write')
  const groups = SCALE === 'small' ? [WANT.filter(d => d === 'readme' || d === 'devpost'), WANT.filter(d => d === 'pitch' || d === 'video')].filter(g => g.length) : WANT.map(d => [d])
  writeRes = await parallel(groups.map(g => () => agent(`Read and adopt your role card: "${A.pluginRoot}/agents/storyteller.md" (ignore its YAML frontmatter).${CTX}
## Task: write ${g.join(' + ')} from "${SHIP}/FACTS.md"
${g.map(d => `- ${d}: "${SPEC[d].file}" — ${FRESH ? `write it from the template "${SPEC[d].tpl}"` : `if it exists, UPDATE it in place (keep the team's edits; change only what FACTS.md changed and what the task below requires); otherwise start from the template "${SPEC[d].tpl}"`}. ${SPEC[d].task}`).join('\n')}
Plain, specific language. No hype words (revolutionary, seamless, game-changing, leverage, unlock). Numbers only from FACTS.md.`,
    { label: `write:${g.join('+')}`, phase: 'Write', schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } }, todos: { type: 'array', items: { type: 'string' } } }, required: ['files'] } })))
  groups.forEach((g, i) => { if (!writeRes[i]) warnings.push(`writer for ${g.join('+')} failed — those deliverables are missing`) })
  written = groups.filter((g, i) => writeRes[i]).flat()
  if (!(written.length > 0)) fail('all writers failed')

  // ---------- Review (Santa: two isolated reviewers, both must pass) ----------
  phase('Review')
  const REVIEW_SCHEMA = {
    type: 'object',
    properties: {
      reviews: { type: 'array', items: { type: 'object', properties: {
        deliverable: { type: 'string' }, pass: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, where: { type: 'string' } }, required: ['issue', 'severity'] } },
      }, required: ['deliverable', 'pass', 'issues'] } },
    },
    required: ['reviews'],
  }
  files = written.map(d => ({ deliverable: d, file: SPEC[d].file }))
  const reviewers = [
    { id: 'fact-checker', brief: `Fact-checker. For every factual claim, number, URL, name and capability in each file, find it in "${SHIP}/FACTS.md" (and spot-check the code/live URL). Any claim not traceable to FACTS.md = blocker. Any mocked feature presented as real = blocker. Unfilled double-brace tokens = major. Also check video length math (words ÷ 2.3 ≤ ${VIDEO.maxSeconds}s).` },
    { id: 'judge', brief: 'Hackathon judge persona with 2 minutes per project. Does each deliverable make the case for every rubric criterion (explicit, criterion-mapped)? Is the aha clear in the first 30 seconds? Is sponsor tech load-bearing and explained? Is it skimmable? Vague or hype-only = major; a missing criterion = major; a missing judge quickstart/live link = blocker.' },
  ]
  const reviewOnce = round => parallel(reviewers.map(r => () => agent(`You are an isolated submission reviewer (round ${round}). You have NOT seen the other reviewer's opinion.${CTX}
## Your lens: ${r.id}
${r.brief}
Review each file: ${JSON.stringify(files)}. Use the deliverable names exactly as given. pass=true only if there is no blocker or major issue. Be specific about where.`,
    { label: `review:${r.id}${round > 1 ? ' r' + round : ''}`, phase: 'Review', schema: REVIEW_SCHEMA })))
  const verdictOf = (revs, round) => {
    revs.forEach((r, i) => { if (!r) warnings.push(`reviewer ${reviewers[i].id} (round ${round}) failed — deliverables cannot pass review`) })
    return files.map(f => {
      const rs = revs.map(r => r?.reviews.find(x => x.deliverable.toLowerCase() === f.deliverable))
      const missingReviewer = rs.some(x => !x)
      if (missingReviewer && revs.every(Boolean)) warnings.push(`round ${round}: ${rs.map((x, i) => (x ? null : reviewers[i].id)).filter(Boolean).join(' & ')} did not review ${f.deliverable} — it cannot pass`)
      return { ...f, pass: !missingReviewer && rs.every(strictPass), missingReviewer, issues: rs.flatMap((x, i) => (x ? x.issues.map(is => ({ ...is, by: reviewers[i].id })) : [])) }
    })
  }
  review = verdictOf(await reviewOnce(1), 1)
  rounds = 1
  const failing = review.filter(r => !r.pass && !r.missingReviewer)
  if (failing.length) {
    const fix = await agent(`Read and adopt your role card: "${A.pluginRoot}/agents/storyteller.md" (ignore its YAML frontmatter).${CTX}
## Task: revise the failing deliverables to resolve every blocker and major issue (edit in place). If an issue needs a fact that is not in FACTS.md, replace the claim with "TODO: …" rather than inventing it.
${JSON.stringify(failing.map(r => ({ deliverable: r.deliverable, file: r.file, issues: r.issues.filter(i => i.severity !== 'minor') })))}
Report fixed/unresolved by deliverable name (${failing.map(r => r.deliverable).join(', ')}).`,
      { label: 'revise', phase: 'Review', schema: { type: 'object', properties: { fixed: { type: 'array', items: { type: 'string' } }, unresolved: { type: 'array', items: { type: 'object', properties: { deliverable: { type: 'string' }, issue: { type: 'string' } }, required: ['deliverable', 'issue'] } } }, required: ['fixed', 'unresolved'] } })
    if (!fix) warnings.push('reviser failed — review issues unresolved')
    if (fix && SCALE === 'large') {
      // Santa rule: FRESH reviewers for the next round.
      review = verdictOf(await reviewOnce(2), 2)
      rounds = 2
    } else if (fix) {
      // small/medium: the (independent) checklist validator re-checks the revised files below.
      const sent = new Set(failing.map(f => f.deliverable))
      review = review.map(r => (sent.has(r.deliverable) ? { ...r, revised: true, unresolved: fix.unresolved.filter(u => u.deliverable.toLowerCase() === r.deliverable).map(u => u.issue) } : r))
    }
  }
}

// ---------- Checklist (+ re-check of revised copy, + REVIEW.md) ----------
phase('Checklist')
const recheck = review.filter(r => r.revised)
const check = await agent(`You are the HackForge submission-checklist validator (independent of the writers and reviewers).${CTX}
${MODE === 'checklist' ? 'Checklist-only run: deliverables were not regenerated; re-validate everything with the links above.\n' : ''}1. Fill "${SHIP}/SUBMISSION_CHECKLIST.md" from the template "${T}/SUBMISSION_CHECKLIST.md" (update it in place if it exists), marking each item [x] pass / [ ] fail / [~] needs a human, with the evidence you gathered. Run the checks yourself:
- Live URL: \`${CLI} probe "<prodUrl>"\` (must be ok: public, no login/deployment-protection wall, not a localhost/LAN URL). Repo: public? (\`${CLI} gh repo owner/name\`). Video URL (if known): \`${CLI} probe "<videoUrl>"\` (checks it is public or unlisted, not private/missing).
- Repo hygiene: \`${CLI} secrets --tracked\` AND \`${CLI} secrets --history\` (both must be clean — a key in any past commit is public once the repo is), .env* not tracked (git ls-files), LICENSE present ${A.openSourceRequired ? '(REQUIRED by rules)' : ''}, .env.example lists names only, commit history not one giant commit (git rev-list --count HEAD).
- Content: README has judge quickstart + AI disclosure + real-vs-mocked + one section per claimed sponsor; video script length within ${VIDEO.maxSeconds}s; deliverables have no unfilled double-brace tokens; list remaining "TODO:" lines across the deliverables (not FACTS.md's TODO section).
- Human-only items (always [~]): upload video publicly/unlisted and test logged-out; fill the Devpost form; opt into sponsor prizes; confirm team members; final submit click.
${recheck.length ? `2. Re-check these REVISED deliverables against the issues the reviewers raised; for each, say whether every blocker/major issue is now resolved: ${JSON.stringify(recheck.map(r => ({ deliverable: r.deliverable, file: r.file, issues: r.issues.filter(i => i.severity !== 'minor').map(i => i.issue) })))}\n` : ''}${MODE === 'full' ? `3. Write "${SHIP}/REVIEW.md": per deliverable — final verdict (PASS / FAIL), each reviewer's verdict, the issues raised, what the revision fixed${recheck.length ? ' and your re-check result' : ''}. Review data: ${JSON.stringify(review.map(r => ({ deliverable: r.deliverable, pass: r.pass, revised: r.revised || false, issues: r.issues })))}\n` : ''}Return counts, failing items${recheck.length ? ', and revisedResolved (deliverable names whose issues are all resolved)' : ''}.`,
  { label: 'checklist', phase: 'Checklist', ...(A.cheapModel && !recheck.length ? { model: A.cheapModel } : {}), schema: { type: 'object', properties: { passed: { type: 'number' }, failed: { type: 'array', items: { type: 'string' } }, human: { type: 'array', items: { type: 'string' } }, todos: { type: 'array', items: { type: 'string' } }, revisedResolved: { type: 'array', items: { type: 'string' } } }, required: ['passed', 'failed', 'human', 'todos'] } })
if (!check) warnings.push('checklist validator failed — SUBMISSION_CHECKLIST.md not validated')
if (check && recheck.length) {
  const resolved = new Set((check.revisedResolved || []).map(x => x.toLowerCase()))
  review = review.map(r => (r.revised ? { ...r, pass: resolved.has(r.deliverable), recheckedBy: 'checklist validator' } : r))
}

const reviewPass = review.every(r => r.pass)
return {
  ok: Boolean(check) && check.failed.length === 0 && reviewPass,
  summary: MODE === 'checklist'
    ? `checklist-only: ${check ? `${check.passed} passed, ${check.failed.length} failed, ${check.human.length} for humans` : 'NOT validated'}`
    : `${written.length}/${WANT.length} deliverables written; review ${reviewPass ? 'passed' : 'has open issues'} (${rounds} round(s)${recheck.length ? ' + re-check' : ''}); checklist ${check ? `${check.passed} passed, ${check.failed.length} failed, ${check.human.length} for humans` : 'NOT validated'}`,
  outputs: MODE === 'checklist' ? [`${SHIP}/SUBMISSION_CHECKLIST.md`] : [facts.file, ...files.map(f => f.file), `${SHIP}/REVIEW.md`, `${SHIP}/SUBMISSION_CHECKLIST.md`],
  review: review.map(r => ({ deliverable: r.deliverable, file: r.file, pass: r.pass, revised: r.revised || false, openIssues: r.pass ? 0 : r.issues.filter(i => i.severity !== 'minor').length, unresolved: r.unresolved })),
  checklist: check,
  todos: [...new Set([...(facts?.todos || []), ...writeRes.filter(Boolean).flatMap(w => w.todos || []), ...(check?.todos || [])])].slice(0, 40),
  stats: { scale: SCALE, mode: MODE, deliverables: written.length, reviewRounds: rounds },
  warnings,
}
