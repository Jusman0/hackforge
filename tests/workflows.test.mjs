// Offline tests for every workflow script: meta shape, arg validation (fail closed), happy paths,
// and behaviour when agents die (null results must be counted, never silently dropped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadWorkflow, makeRuntime, runWorkflow, jsonAfter } from './workflow-runtime.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WF = name => loadWorkflow(path.join(ROOT, 'workflows', name))
const BASE = { projectDir: '/tmp/hackforge-test-project', pluginRoot: ROOT, now: '2026-10-16T12:00:00Z' }
const CRITERIA = [
  { id: 'D', name: 'Working demo & completeness', weight: 25 },
  { id: 'T', name: 'Technical depth', weight: 20 },
  { id: 'I', name: 'Impact', weight: 20 },
  { id: 'O', name: 'Originality', weight: 15 },
  { id: 'S', name: 'Sponsor use', weight: 10 },
  { id: 'U', name: 'Design/UX & clarity', weight: 10 },
]

test('all workflows: meta is a pure literal with phases matching phase() calls; no forbidden APIs', () => {
  const files = fs.readdirSync(path.join(ROOT, 'workflows')).filter(f => f.endsWith('.js'))
  assert.equal(files.length, 5)
  for (const f of files) {
    const wf = WF(f)
    assert.ok(wf.meta.name && wf.meta.description, `${f}: meta.name/description`)
    assert.equal(wf.meta.name + '.js', f, `${f}: file name should match meta.name`)
    const titles = new Set(wf.meta.phases.map(p => p.title))
    const used = [...wf.body.matchAll(/phase\('([^']+)'\)|phase: '([^']+)'/g)].map(m => m[1] || m[2])
    for (const u of used) assert.ok(titles.has(u), `${f}: phase "${u}" missing from meta.phases`)
    assert.ok(!/Date\.now\(|Math\.random\(|new Date\(\)/.test(wf.body), `${f}: forbidden nondeterministic API`)
    assert.ok(!/\bimport\s*\(|require\(/.test(wf.body), `${f}: imports are not available in workflow scripts`)
  }
})

for (const name of ['research-sweep.js', 'idea-tournament.js', 'build-sprint.js', 'judge-panel.js', 'ship-kit.js']) {
  test(`${name}: rejects missing/invalid args (fail closed)`, async () => {
    const rt = makeRuntime(() => { throw new Error('no agent should run') })
    await assert.rejects(runWorkflow(WF(name), rt, undefined), /args/)
    await assert.rejects(runWorkflow(WF(name), rt, { ...BASE, now: 'yesterday' }), /now/)
    await assert.rejects(runWorkflow(WF(name), rt, { ...BASE, projectDir: 'relative/path' }), /projectDir/)
    assert.equal(rt.calls.length, 0)
  })
}

// ---------- research-sweep ----------
function researchHandler({ failScout } = {}) {
  return (label, prompt) => {
    if (label === 'plan') return { decision: 'pick a user + problem', channels: ['pain', 'market', 'prior-art', 'tech', 'sponsors', 'trends'].map(id => ({ id, questions: ['q?'], seeds: ['s'] })) }
    if (label.startsWith('scout:')) {
      const id = label.slice(6)
      if (id === failScout) return null
      return { channel: id, file: `/x/${id}.md`, claims: [{ id: `${id}-1`, claim: 'c', label: 'fact', evidence: [{ url: 'https://e.x' }], confidence: 'high', pitchWorthy: true }, { id: `${id}-2`, claim: 'd', label: 'inference', evidence: [{ url: 'https://e.y' }], confidence: 'low', pitchWorthy: false }], opportunities: [{ title: 'o', why: 'w' }], gaps: [] }
    }
    if (label.startsWith('verify')) {
      const claims = jsonAfter(prompt, 'Claims: ')
      return { verdicts: claims.map((c, i) => ({ id: c.id, verdict: i % 2 ? 'weak' : 'confirmed' })) }
    }
    if (label === 'synthesize' || label === 'resynthesize') {
      assert.ok(prompt.includes('claims.json'), 'synth must be told to write claims.json')
      return { opportunities: [{ rank: 1, title: 'Permit triage', user: 'city clerks', pain: '6 weeks' }], gaps: [{ channel: 'pain', question: 'how often?' }] }
    }
    if (label.startsWith('gap:')) return { channel: 'pain', file: '/x/pain.md', claims: [], opportunities: [], gaps: [] }
    throw new Error('unexpected agent ' + label)
  }
}

test('research-sweep medium: 9 agents, verdicts merged, gaps returned (no gap round)', async () => {
  const rt = makeRuntime(researchHandler())
  const r = await runWorkflow(WF('research-sweep.js'), rt, { ...BASE, scale: 'medium' })
  assert.equal(r.ok, true)
  assert.equal(rt.calls.length, 9)
  assert.equal(r.stats.claims, 12)
  assert.ok(r.stats.verified >= 1)
  assert.equal(r.remainingGaps.length, 1)
  assert.equal(r.stats.gapRounds, 0)
})

test('research-sweep small: 3 channels, ≤6 agents', async () => {
  const rt = makeRuntime(researchHandler())
  const r = await runWorkflow(WF('research-sweep.js'), rt, { ...BASE, scale: 'small' })
  assert.equal(r.stats.channels, 3)
  assert.ok(rt.calls.length <= 6, `small used ${rt.calls.length} agents`)
})

test('research-sweep large: per-channel verify (pipeline) + one gap round', async () => {
  const rt = makeRuntime(researchHandler())
  const r = await runWorkflow(WF('research-sweep.js'), rt, { ...BASE, scale: 'large' })
  assert.equal(r.stats.gapRounds, 1)
  assert.ok(rt.calls.some(c => c.label === 'verify:pain'))
  assert.ok(rt.calls.some(c => c.label === 'resynthesize'))
})

test('research-sweep: a dead scout is reported, not hidden', async () => {
  const rt = makeRuntime(researchHandler({ failScout: 'market' }))
  const r = await runWorkflow(WF('research-sweep.js'), rt, { ...BASE })
  assert.equal(JSON.stringify(r.stats.failedChannels), JSON.stringify(['market']))
  assert.ok(r.warnings.some(w => w.includes('market')))
})

// ---------- idea-tournament ----------
function ideaHandler({ dropFirst = true, killJudges = 0 } = {}) {
  let judgeDeaths = 0
  return (label, prompt) => {
    if (label.startsWith('ideate:')) {
      const d = label.slice(7)
      const POOL = {
        'pain-first': [['Invoice dispute resolver', 'Drafts supplier dispute emails from mismatched invoices', 'AP clerks'], ['Shift swap broker', 'Matches nurses who need to trade night shifts', 'nurses'], ['Grant deadline radar', 'Watches municipal grant portals and pre-fills applications', 'nonprofits']],
        'sponsor-first': [['Voice intake line', 'Phone agent that triages tenant repair calls', 'landlords'], ['Receipt vision ledger', 'Photographs receipts into categorized tax ledgers', 'freelancers'], ['Sign language tutor', 'Webcam coach scoring fingerspelling accuracy', 'ASL learners']],
        'wow-demo-first': [['Floorplan from video', 'Walkthrough video becomes an editable floorplan', 'realtors'], ['Drone roof inspector', 'Drone stills to annotated roof damage report', 'adjusters'], ['Live lecture map', 'Turns a lecture stream into a navigable concept graph', 'students']],
        'eval-first': [['Contract clause grader', 'Scores lease clauses against tenant law with citations', 'tenants'], ['Backtested menu pricer', 'Prices restaurant menus using sales history backtests', 'cafe owners'], ['Triage accuracy bench', 'Benchmarks symptom checkers on vignettes', 'clinics']],
      }[d]
      const ideas = POOL.map(([title, oneLiner, user]) => ({ title, oneLiner, user, pain: '6 weeks', aha: 'a', goldenPath: ['a', 'b'], hardPart: 'h', keywords: title.toLowerCase() }))
      ideas.push({ title: 'Permit copilot for city clerks', oneLiner: 'Permit copilot that drafts correction letters for city clerks', user: 'clerks', pain: 'p', aha: 'a', goldenPath: ['a'], hardPart: 'h', keywords: 'permit' })
      return { ideas }
    }
    if (label.startsWith('gate:')) {
      const ideas = jsonAfter(prompt, 'Ideas: ')
      const g = { G1: { pass: true }, G2: { pass: true }, G3: { pass: true }, G4: { pass: true }, G5: { pass: true }, G6: { pass: true } }
      return { results: ideas.map((x, i) => ({ slug: x.slug, gates: g, F: i % 2 ? 0.8 : 1.0, saturation: { level: 'low' }, fatigue: false, verdict: dropFirst && i === 0 ? 'drop' : 'keep', reason: 'r' })) }
    }
    if (label.startsWith('judge:')) {
      if (judgeDeaths < killJudges) { judgeDeaths++; return null }
      const ideas = jsonAfter(prompt, 'Ideas: ')
      return { scores: ideas.map((x, i) => ({ slug: x.slug, P: 5 - (i % 5), W: 4, A: 3, T: 3, S: 2, N: 3, E: 2, F: 1.0, rubric: CRITERIA.map(c => ({ id: c.id, score: 3 })), rationale: 'r', killerQuestion: 'who pays?' })) }
    }
    if (label.startsWith('council')) {
      const ideas = jsonAfter(prompt, 'Ideas: ')
      return { top: ideas.map(x => ({ slug: x.slug, verdict: 'go', skeptic: 's', pragmatist: 'p', breaker: 'b', file: `/x/top/${x.slug}.md` })) }
    }
    if (label === 'scribe') return 'ok'
    throw new Error('unexpected agent ' + label)
  }
}

test('idea-tournament medium: ≤9 agents, dedup, gates drop, deterministic scores, top 3', async () => {
  const rt = makeRuntime(ideaHandler())
  const r = await runWorkflow(WF('idea-tournament.js'), rt, { ...BASE, scale: 'medium', criteria: CRITERIA })
  assert.equal(r.ok, true)
  assert.ok(rt.calls.length <= 9, `medium used ${rt.calls.length} agents`)
  assert.equal(r.stats.generated, 16)
  assert.equal(r.stats.unique, 13, 'the shared "permit copilot" idea must be deduplicated')
  assert.equal(r.dropped.length, 1)
  assert.equal(r.top3.length, 3)
  const t = r.leaderboard[0]
  // 20 × F × Σ w·f with P=5,W=4,A=3,T=3,S=2,N=3,E=2 and default weights → 20 × 1.0 × 3.4 = 68
  assert.equal(t.score, 68)
  assert.ok(r.leaderboard.every((b, i, a) => i === 0 || (a[i - 1].score ?? -1) >= (b.score ?? -1)), 'sorted by score')
  assert.equal(t.predictedRubricPct, 60)
})

test('idea-tournament: rejects weights that do not sum to 1', async () => {
  const rt = makeRuntime(ideaHandler())
  await assert.rejects(runWorkflow(WF('idea-tournament.js'), rt, { ...BASE, ideaWeights: { P: 1, W: 1, A: 1, T: 1, S: 1, N: 1, E: 1 } }), /sum to 1/)
})

test('idea-tournament: a dead judge shrinks the panel with a warning', async () => {
  const rt = makeRuntime(ideaHandler({ killJudges: 1 }))
  const r = await runWorkflow(WF('idea-tournament.js'), rt, { ...BASE, criteria: CRITERIA })
  assert.equal(r.stats.judges, 2)
  assert.ok(r.warnings.some(w => w.includes('judge')))
})

test('idea-tournament small: ≤5 agents', async () => {
  const rt = makeRuntime(ideaHandler())
  await runWorkflow(WF('idea-tournament.js'), rt, { ...BASE, scale: 'small', criteria: CRITERIA })
  assert.ok(rt.calls.length <= 5, `small used ${rt.calls.length}`)
})

// ---------- build-sprint ----------
test('build-sprint: fails QA once, fixes in round 1, passes', async () => {
  const rt = makeRuntime((label) => {
    if (label.startsWith('build:')) return { slice: 'S1', summary: 's', filesChanged: ['a'], commits: ['abc feat'], blocked: false }
    if (label === 'qa:S1') return { slice: 'S1', pass: false, checks: [], failures: [{ criterion: 'c', observed: 'o', expected: 'e' }], feedbackFile: '/fb/s1-S1-r0.md' }
    if (label === 'qa:S1 r1') return { slice: 'S1', pass: true, checks: [{ criterion: 'c', pass: true, evidence: 'ok' }], failures: [], feedbackFile: '/fb/s1-S1-r1.md' }
    throw new Error(label)
  })
  const r = await runWorkflow(WF('build-sprint.js'), rt, { ...BASE, slices: ['S1'], label: 's1' })
  assert.equal(r.ok, true)
  assert.equal(r.results[0].status, 'pass')
  assert.equal(r.results[0].rounds, 1)
  assert.ok(rt.calls.find(c => c.label === 'build:S1 r1').prompt.includes('/fb/s1-S1-r0.md'), 'fix round gets the QA report')
})

test('build-sprint: plateau stops the loop; later slices are not attempted', async () => {
  const rt = makeRuntime((label) => {
    if (label.startsWith('build:')) return { slice: 'x', summary: 's', filesChanged: [], commits: [], blocked: false }
    if (label.startsWith('qa:')) return { slice: 'x', pass: false, checks: [], failures: [{ criterion: 'c', observed: 'o', expected: 'e' }], feedbackFile: '/fb/x.md' }
    throw new Error(label)
  })
  const r = await runWorkflow(WF('build-sprint.js'), rt, { ...BASE, slices: ['S1', 'S2'] })
  assert.equal(r.ok, false)
  assert.equal(r.results.length, 1)
  assert.equal(r.results[0].status, 'plateau')
  assert.ok(r.warnings.some(w => w.includes('S2')))
})

test('build-sprint: dead QA agent = unverified, never pass', async () => {
  const rt = makeRuntime((label) => (label.startsWith('build:') ? { slice: 'S1', summary: 's', filesChanged: [], commits: [], blocked: false } : null))
  const r = await runWorkflow(WF('build-sprint.js'), rt, { ...BASE, slices: ['S1'] })
  assert.equal(r.results[0].status, 'unverified')
  assert.equal(r.ok, false)
})

test('build-sprint parallel: worktree builders, integrator, per-slice QA', async () => {
  const rt = makeRuntime((label, prompt, opts) => {
    if (label.startsWith('build:')) {
      assert.equal(opts.isolation, 'worktree')
      const id = label.slice(6)
      return { slice: id, summary: 's', filesChanged: [], commits: [], branch: `hf/slice-${id}`, gitDir: `/repo/.git/worktrees/${id}`, commonDir: '/repo/.git', blocked: id === 'S3', blockedReason: 'needs key' }
    }
    if (label === 'integrate') return { merged: ['S1'], rejected: [{ slice: 'S2', reason: 'conflict' }] }
    if (label.startsWith('qa:')) return { slice: 'S1', pass: true, checks: [{ criterion: 'c', pass: true, evidence: 'ok' }], failures: [], feedbackFile: '/fb/x.md' }
    throw new Error(label)
  })
  const r = await runWorkflow(WF('build-sprint.js'), rt, { ...BASE, slices: ['S1', 'S2', 'S3'], mode: 'parallel' })
  const by = Object.fromEntries(r.results.map(x => [x.slice, x.status]))
  assert.equal(JSON.stringify(by, Object.keys(by).sort()), JSON.stringify({ S1: 'pass', S2: 'fail', S3: 'blocked' }))
})

// ---------- judge-panel ----------
function judgeHandler({ runner = 'pass', refute = false, probeOk = true } = {}) {
  return (label) => {
    if (label === 'evidence:runner') return runner === null ? null : { goldenPath: runner, probe: probeOk ? { ok: true } : { ok: false, problem: 'redirects to a login/auth page' }, steps: [{ step: 'open', ok: true }], screenshots: ['a.png'], httpStatus: 200, loggedOutAccess: true }
    if (label === 'evidence:design') return { fiveSecondTest: 'clear', issues: [{ issue: 'Empty state missing on results page', severity: 'MEDIUM', fix: 'add empty state', effortHours: 0.5 }] }
    if (label === 'evidence:submission') return { pitchAsRestated: 'x', criteriaCovered: ['D'], unsupportedClaims: [], redFlags: [] }
    if (label.startsWith('judge:')) return { scores: CRITERIA.map(c => ({ id: c.id, score: 4, why: 'w' })), killerQuestions: ['who pays?'], fixes: [{ fix: 'Demo needs login before the aha moment', criterion: 'D', severity: 'HIGH', expectedGain: 1, effortHours: 1, proof: 'redirect to /login' }, { fix: 'Add eval number to results screen', criterion: 'T', severity: 'MEDIUM', expectedGain: 1, effortHours: 2 }] }
    if (label === 'verify:high') return { verdicts: [{ i: 0, isReal: !refute, confidence: 0.9 }] }
    if (label === 'report') return 'written'
    throw new Error(label)
  }
}

test('judge-panel: confirmed HIGH finding blocks READY; fixes deduped across judges', async () => {
  const rt = makeRuntime(judgeHandler())
  const r = await runWorkflow(WF('judge-panel.js'), rt, { ...BASE, url: 'https://app.example.com', criteria: CRITERIA })
  assert.equal(r.verdict, 'NOT_READY')
  assert.equal(r.score, 80)
  assert.equal(r.stats.blocking, 1)
  assert.equal(r.topFixes.filter(f => f.severity === 'HIGH').length, 1, 'same HIGH fix from 4 judges must dedupe to 1')
  assert.ok(rt.calls.length <= 9)
})

test('judge-panel: refuted HIGH + passing golden path on a public URL = READY', async () => {
  const rt = makeRuntime(judgeHandler({ refute: true }))
  const r = await runWorkflow(WF('judge-panel.js'), rt, { ...BASE, url: 'https://app.example.com', criteria: CRITERIA })
  assert.equal(r.verdict, 'READY')
})

test('judge-panel: a failing public-access probe blocks READY; LAN URLs count as local', async () => {
  let rt = makeRuntime(judgeHandler({ refute: true, probeOk: false }))
  let r = await runWorkflow(WF('judge-panel.js'), rt, { ...BASE, url: 'https://app.example.com', criteria: CRITERIA })
  assert.equal(r.verdict, 'NOT_READY')
  assert.ok(r.reasons.some(x => /probe failed/.test(x)))
  for (const url of ['http://192.168.1.20:3000', 'http://my-mac.local:3000', 'http://0.0.0.0:3000']) {
    rt = makeRuntime(judgeHandler({ refute: true }))
    r = await runWorkflow(WF('judge-panel.js'), rt, { ...BASE, url, criteria: CRITERIA })
    assert.equal(r.verdict, 'NOT_READY', url)
  }
})

test('judge-panel: fail closed on dead runner and on localhost', async () => {
  let rt = makeRuntime(judgeHandler({ runner: null, refute: true }))
  let r = await runWorkflow(WF('judge-panel.js'), rt, { ...BASE, url: 'https://app.example.com', criteria: CRITERIA })
  assert.equal(r.verdict, 'NOT_READY')
  rt = makeRuntime(judgeHandler({ refute: true }))
  r = await runWorkflow(WF('judge-panel.js'), rt, { ...BASE, url: 'http://localhost:3000', criteria: CRITERIA })
  assert.equal(r.verdict, 'NOT_READY')
  assert.ok(r.reasons.some(x => x.includes('local')))
})

// ---------- ship-kit ----------
function shipHandler({ factFail = false, judgeFails = false, recheckResolves = true } = {}) {
  return (label, prompt) => {
    if (label === 'facts') return factFail ? null : { file: '/x/FACTS.md', oneLiner: 'o', todos: ['team names'] }
    if (label.startsWith('write:')) return { files: ['/x/a.md'], todos: [] }
    if (label.startsWith('review:')) {
      const files = jsonAfter(prompt, 'Review each file: ')
      const isJudge = label.startsWith('review:judge')
      const failsNow = f => judgeFails && isJudge && f.deliverable === 'devpost' && !label.includes(' r2')
      return { reviews: files.map(f => ({ deliverable: f.deliverable, pass: !failsNow(f), issues: failsNow(f) ? [{ issue: 'Impact criterion missing', severity: 'major' }] : [] })) }
    }
    if (label === 'revise') return { fixed: ['devpost'], unresolved: [] }
    if (label === 'checklist') {
      if (prompt.includes('Re-check these REVISED')) assert.ok(prompt.includes('"deliverable":"devpost"'), 'validator gets the revised file + issues')
      if (prompt.includes('Write "') ) assert.ok(prompt.includes('REVIEW.md'), 'validator writes REVIEW.md')
      return { passed: 14, failed: [], human: ['upload video'], todos: [], revisedResolved: recheckResolves ? ['devpost'] : [] }
    }
    throw new Error(label)
  }
}

test('ship-kit medium: 8 agents happy path', async () => {
  const rt = makeRuntime(shipHandler())
  const r = await runWorkflow(WF('ship-kit.js'), rt, { ...BASE, criteria: CRITERIA, links: { prodUrl: 'https://a.b' } })
  assert.equal(r.ok, true)
  assert.ok(rt.calls.length <= 9)
  assert.ok(r.todos.includes('team names'))
})

test('ship-kit: refuses to write copy without FACTS.md', async () => {
  const rt = makeRuntime(shipHandler({ factFail: true }))
  await assert.rejects(runWorkflow(WF('ship-kit.js'), rt, { ...BASE, criteria: CRITERIA }), /FACTS/)
})

test('ship-kit: a failing review triggers one revision; the independent re-check decides; large re-reviews with fresh reviewers', async () => {
  let rt = makeRuntime(shipHandler({ judgeFails: true }))
  let r = await runWorkflow(WF('ship-kit.js'), rt, { ...BASE, criteria: CRITERIA })
  assert.ok(rt.calls.some(c => c.label === 'revise'))
  const dp = r.review.find(x => x.deliverable === 'devpost')
  assert.equal(dp.revised, true)
  assert.equal(dp.pass, true, 'medium: resolved by the checklist validator re-check')
  assert.equal(r.ok, true)
  assert.ok(r.outputs.some(o => o.endsWith('REVIEW.md')))
  rt = makeRuntime(shipHandler({ judgeFails: true, recheckResolves: false }))
  r = await runWorkflow(WF('ship-kit.js'), rt, { ...BASE, criteria: CRITERIA })
  assert.equal(r.review.find(x => x.deliverable === 'devpost').pass, false)
  assert.equal(r.ok, false)
  rt = makeRuntime(shipHandler({ judgeFails: true }))
  r = await runWorkflow(WF('ship-kit.js'), rt, { ...BASE, criteria: CRITERIA, scale: 'large' })
  assert.equal(r.stats.reviewRounds, 2)
  assert.ok(r.review.every(x => x.pass))
})

test('build-sprint parallel: a builder that used the MAIN checkout is blocked; worktree prompt never says cd to the project', async () => {
  const rt = makeRuntime((label, prompt) => {
    if (label.startsWith('build:')) {
      assert.ok(!prompt.includes('(cd there first)'), 'worktree builders must not be told to cd into the main tree')
      return { slice: 'S1', summary: 's', filesChanged: [], commits: [], branch: 'hf/slice-S1', toplevel: BASE.projectDir, blocked: false }
    }
    throw new Error(label)
  })
  const r = await runWorkflow(WF('build-sprint.js'), rt, { ...BASE, slices: ['S1'], parallel: true })
  assert.equal(r.stats.mode, 'parallel', 'parallel:true is accepted as an alias')
  assert.equal(r.results[0].status, 'blocked')
  assert.match(r.results[0].reason, /own worktree/)
})

test('build-sprint parallel: merged-but-failing slices get sequential fix rounds; S1 vs S10 never collide', async () => {
  const rt = makeRuntime((label) => {
    if (label === 'build:S1' || label === 'build:S10') return { slice: label.slice(6), summary: 's', filesChanged: [], commits: [], branch: `hf/slice-${label.slice(6)}`, toplevel: '/tmp/wt-' + label.slice(6), gitDir: '/r/.git/worktrees/' + label.slice(6), commonDir: '/r/.git', blocked: false }
    if (label === 'integrate') return { merged: ['S10'], rejected: [{ slice: 'S1', reason: 'conflict' }] }
    if (label === 'qa:S10') return { slice: 'S10', pass: false, checks: [], failures: [{ criterion: 'c', observed: 'o', expected: 'e' }], feedbackFile: '/fb/S10-r0.md' }
    if (label === 'build:S10 r1') return { slice: 'S10', summary: 'fix', filesChanged: [], commits: ['x'], blocked: false }
    if (label === 'qa:S10 r1') return { slice: 'S10', pass: true, checks: [{ criterion: 'c', pass: true, evidence: 'ok' }], failures: [], feedbackFile: '/fb/S10-r1.md' }
    throw new Error(label)
  })
  const r = await runWorkflow(WF('build-sprint.js'), rt, { ...BASE, slices: ['S1', 'S10'], mode: 'parallel' })
  const by = Object.fromEntries(r.results.map(x => [x.slice, x.status]))
  assert.equal(by.S1, 'fail')
  assert.equal(by.S10, 'pass')
  assert.equal(r.results.length, 2)
  assert.equal(r.ok, false)
})

test('idea-tournament: a judged-fake rescue still gets the fatigue penalty; omitted ideas are flagged', async () => {
  const base = ideaHandler({ dropFirst: false })
  const rt = makeRuntime((label, prompt, opts) => {
    if (label.startsWith('gate:')) {
      const r = base(label, prompt, opts)
      r.results[0].fatigue = true
      r.results[0].rescue = 'but for X'
      r.results[0].rescueValid = false
      r.results.pop() // gate silently omits the last idea
      return r
    }
    return base(label, prompt, opts)
  })
  const r = await runWorkflow(WF('idea-tournament.js'), rt, { ...BASE, criteria: CRITERIA })
  assert.ok(r.leaderboard.some(b => b.fatiguePenalty === 10))
  assert.ok(r.warnings.some(w => /UNGATED \(gate agent omitted it\)/.test(w)))
  assert.equal(r.stats.judged, r.stats.unique, 'no capacity cap: every surviving idea is judged')
})

test('ship-kit: a reviewer that says pass but lists a major issue does not pass', async () => {
  const base = shipHandler()
  const rt = makeRuntime((label, prompt, opts) => {
    if (label === 'review:judge') {
      const r = base(label, prompt, opts)
      r.reviews[0].issues = [{ issue: 'no judge quickstart', severity: 'major' }]
      return r
    }
    return base(label, prompt, opts)
  })
  const r = await runWorkflow(WF('ship-kit.js'), rt, { ...BASE, criteria: CRITERIA })
  assert.ok(rt.calls.some(c => c.label === 'revise'))
})

test('ship-kit: checklist mode runs only the validator and keeps team edits (facts/writers not called)', async () => {
  const rt = makeRuntime(shipHandler())
  const r = await runWorkflow(WF('ship-kit.js'), rt, { ...BASE, criteria: CRITERIA, mode: 'checklist', links: { videoUrl: 'https://youtu.be/x' } })
  assert.equal(rt.calls.length, 1)
  assert.equal(rt.calls[0].label, 'checklist')
  assert.equal(r.stats.mode, 'checklist')
})

test('ship-kit: facts and writers update in place by default (resume), rebuild only with fresh', async () => {
  let rt = makeRuntime(shipHandler())
  await runWorkflow(WF('ship-kit.js'), rt, { ...BASE, criteria: CRITERIA })
  assert.match(rt.calls.find(c => c.label === 'facts').prompt, /KEEP every row a human added/)
  assert.match(rt.calls.find(c => c.label.startsWith('write:')).prompt, /UPDATE it in place/)
  rt = makeRuntime(shipHandler())
  await runWorkflow(WF('ship-kit.js'), rt, { ...BASE, criteria: CRITERIA, fresh: true })
  assert.doesNotMatch(rt.calls.find(c => c.label === 'facts').prompt, /KEEP every row/)
})

test('idea-tournament: gate-flagged semantic duplicates are merged before judging', async () => {
  const base = ideaHandler({ dropFirst: false })
  let judgedSlugs = null
  const rt = makeRuntime((label, prompt, opts) => {
    if (label.startsWith('gate:')) {
      const r = base(label, prompt, opts)
      r.results[1].duplicateOf = r.results[0].slug
      return r
    }
    if (label.startsWith('judge:') && !judgedSlugs) judgedSlugs = jsonAfter(prompt, 'Ideas: ').map(x => x.slug)
    return base(label, prompt, opts)
  })
  const r = await runWorkflow(WF('idea-tournament.js'), rt, { ...BASE, criteria: CRITERIA })
  assert.ok(r.dropped.some(d => /duplicate of/.test(d.reason)))
  assert.equal(judgedSlugs.length, r.stats.unique - 1)
})

test('build-sprint: QA that says pass but has a failing check does not pass (strict predicate)', async () => {
  const rt = makeRuntime((label) => {
    if (label.startsWith('build:')) return { slice: 'S1', summary: 's', filesChanged: [], commits: [], blocked: false }
    if (label === 'qa:S1') return { slice: 'S1', pass: true, checks: [{ criterion: 'AC1', pass: true, evidence: 'ok' }, { criterion: 'AC2 renders', pass: false, evidence: 'blank page' }], failures: [], feedbackFile: '/fb/r0.md' }
    if (label === 'qa:S1 r1') return { slice: 'S1', pass: true, checks: [{ criterion: 'AC1', pass: true, evidence: 'ok' }, { criterion: 'AC2 renders', pass: true, evidence: 'ok' }], failures: [], feedbackFile: '/fb/r1.md' }
    throw new Error(label)
  })
  const r = await runWorkflow(WF('build-sprint.js'), rt, { ...BASE, slices: ['S1'] })
  assert.equal(r.results[0].status, 'pass')
  assert.equal(r.results[0].rounds, 1, 'the inconsistent first QA forced a fix round')
})

test('build-sprint parallel: worktree proof via git-dir/common-dir; missing evidence fails closed', async () => {
  const rt = makeRuntime((label) => {
    if (label.startsWith('build:')) return { slice: 'S1', summary: 's', filesChanged: [], commits: [], branch: 'hf/slice-S1', toplevel: '/private' + BASE.projectDir, blocked: false }
    throw new Error(label)
  })
  const r = await runWorkflow(WF('build-sprint.js'), rt, { ...BASE, slices: ['S1'], mode: 'parallel' })
  assert.equal(r.results[0].status, 'blocked', '/private-prefixed main toplevel is still the main checkout')
})

test('research-sweep: claim ids are namespaced per channel so one verdict cannot confirm six claims', async () => {
  const rt = makeRuntime((label, prompt) => {
    if (label === 'plan') return { decision: 'd', channels: ['pain', 'market', 'prior-art', 'tech', 'sponsors', 'trends'].map(id => ({ id, questions: [], seeds: [] })) }
    if (label.startsWith('scout:')) return { channel: label.slice(6), file: '/x', claims: [{ id: 'C1', claim: 'c', label: 'fact', evidence: [{ url: 'u' }], confidence: 'high', pitchWorthy: true }], opportunities: [{ title: 'o', why: 'w', claimIds: ['C1'] }], gaps: [] }
    if (label === 'verify:all') {
      const claims = jsonAfter(prompt, 'Claims: ')
      assert.equal(new Set(claims.map(c => c.id)).size, 6, 'ids must be unique')
      return { verdicts: [{ id: claims[0].id, verdict: 'confirmed' }] }
    }
    if (label === 'synthesize') return { opportunities: [{ rank: 1, title: 't', user: 'u', pain: 'p' }], gaps: [] }
    throw new Error(label)
  })
  const r = await runWorkflow(WF('research-sweep.js'), rt, { ...BASE })
  assert.equal(r.stats.verified, 1)
})

test('judge-panel: a failed runner step or an unscored criterion blocks READY; criteria ids are enums', async () => {
  const base = judgeHandler({ refute: true })
  let rt = makeRuntime((label, prompt, opts) => {
    const r = base(label, prompt, opts)
    if (label === 'evidence:runner') r.steps.push({ step: 'submit form', ok: false, note: '500' })
    if (label.startsWith('judge:')) assert.deepEqual(opts.schema.properties.scores.items.properties.id.enum, CRITERIA.map(c => c.id))
    return r
  })
  let res = await runWorkflow(WF('judge-panel.js'), rt, { ...BASE, url: 'https://app.example.com', criteria: CRITERIA })
  assert.equal(res.verdict, 'NOT_READY')
  assert.ok(res.reasons.some(x => /step failed: submit form/.test(x)))
  rt = makeRuntime((label, prompt, opts) => {
    const r = base(label, prompt, opts)
    if (label.startsWith('judge:')) r.scores = r.scores.filter(x => x.id !== 'U')
    return r
  })
  res = await runWorkflow(WF('judge-panel.js'), rt, { ...BASE, url: 'https://app.example.com', criteria: CRITERIA })
  assert.ok(res.reasons.some(x => /not scored by any judge: U/.test(x)))
})

test('idea-tournament: a duplicate of a dropped idea survives; ungated fatigue ideas keep the penalty; bad directions are rejected', async () => {
  const base = ideaHandler({ dropFirst: true })
  const rt = makeRuntime((label, prompt, opts) => {
    if (label.startsWith('gate:')) {
      const r = base(label, prompt, opts)
      r.results[1].duplicateOf = r.results[0].slug // results[0] is dropped by dropFirst
      return r
    }
    return base(label, prompt, opts)
  })
  const r = await runWorkflow(WF('idea-tournament.js'), rt, { ...BASE, criteria: CRITERIA })
  assert.equal(r.dropped.length, 1, 'only the gate-dropped idea is lost')
  await assert.rejects(runWorkflow(WF('idea-tournament.js'), makeRuntime(base), { ...BASE, directions: ['nope'] }), /directions must be ids/)
  const rt2 = makeRuntime((label, prompt, opts) => {
    if (label.startsWith('ideate:')) {
      const out = base(label, prompt, opts)
      out.ideas[0].fatigueCategory = 'chat-with-pdf'
      return out
    }
    if (label.startsWith('gate:')) return null
    return base(label, prompt, opts)
  })
  const r2 = await runWorkflow(WF('idea-tournament.js'), rt2, { ...BASE, criteria: CRITERIA })
  assert.ok(r2.leaderboard.some(b => b.fatiguePenalty === 10 && !b.gated))
})

test('ship-kit: a deliverable no reviewer saw is not marked revised and cannot pass', async () => {
  const base = shipHandler({ judgeFails: true })
  const rt = makeRuntime((label, prompt, opts) => {
    const r = base(label, prompt, opts)
    if (label === 'review:fact-checker') r.reviews = r.reviews.filter(x => x.deliverable !== 'pitch')
    return r
  })
  const res = await runWorkflow(WF('ship-kit.js'), rt, { ...BASE, criteria: CRITERIA })
  const pitch = res.review.find(x => x.deliverable === 'pitch')
  assert.equal(pitch.revised, false)
  assert.equal(pitch.pass, false)
  assert.ok(res.warnings.some(w => /did not review pitch/.test(w)))
})
