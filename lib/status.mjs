// `hackforge status` and `hackforge next`: what is true now and what to do next.
import fs from 'node:fs'
import path from 'node:path'
import { hfDir, truncate, readJSON } from './util.mjs'
import { clock, CHECKPOINT_IDS, localTime } from './state.mjs'
import { ledgerSummary } from './web.mjs'

const has = (projectDir, rel) => fs.existsSync(path.join(hfDir(projectDir), rel))

function ideaTitle(projectDir) {
  const f = path.join(hfDir(projectDir), 'ideas', 'IDEA.md')
  if (!fs.existsSync(f)) return null
  const m = fs.readFileSync(f, 'utf8').match(/^#\s+(.+)$/m)
  return m ? m[1].replace(/^IDEA:?\s*/i, '').trim() : null
}

// Ordered decision list. First matching rule wins; crunch rules come first.
export function nextStep(projectDir, state, now = new Date()) {
  const c = clock(state, now)
  const cp = state.checkpoints
  const g = state.gates
  const done = id => Boolean(cp[id]?.done)
  // Track B: while one teammate researches/ideates, another proves the deploy pipeline (playbook timeline).
  const teamSize = Math.max(Number(state.team?.size) || 0, state.team?.members?.length || 0)
  const trackB = !state.stack.prodUrl && !done('SKELETON_DEPLOYED') && !g.B.locked && teamSize > 1
    ? 'Teammate 2 in parallel: create the public repo, deploy a hello-world of THIS repo to its production alias, `hackforge state set stack.prodUrl <alias>`, install Playwright, and smoke-test every sponsor/model API key with one call.'
    : undefined
  const r = (skill, why, extra = {}) => ({ skill: `/hackforge:${skill}`, why, mode: c.mode, remaining: c.remainingLabel, ...(trackB ? { parallel: trackB } : {}), ...extra })

  if (done('SUBMITTED')) return r('status', 'Submitted. Rehearse the pitch 3x and keep the backup video on local disk.')
  if (g.C.locked) return r('ship', 'Gate C is locked: the human submits the form now (≥30 min before the deadline), then `hackforge checkpoint SUBMITTED --done --url <submission url>`. Nothing to regenerate.', { waitForHuman: true })
  if (c.mode === 'over') return r('status', 'Deadline has passed. Make sure the submission is confirmed, then rehearse the pitch.')
  if (c.mode === 'pre') return r('doctor', 'Event has not started. Run the minute-zero readiness check and pre-event prep (no project code before start).')

  // Late-event overrides: protect the submission above everything else — but a submission needs a live URL.
  if ((c.mode === 'final' || c.mode === 'frozen') && g.B.locked && !done('SKELETON_DEPLOYED')) {
    return r('build', 'Nothing is deployed and the freeze has passed: deploy whatever works on the golden path NOW (production alias), mark SKELETON_DEPLOYED, then ship.', { urgent: true })
  }
  if (c.mode === 'final') return r('ship', 'Past VIDEO_DONE: finish the submission package and checklist now. Submit before the 30-minute floor.', { urgent: true })
  if (c.mode === 'frozen' && !done('VIDEO_DONE')) return r('ship', 'Feature freeze is in effect: record the video and build the submission package. Only golden-path fixes from here on.')
  if (!g.A.locked && c.pctElapsed >= 12) {
    return r('ideate', 'IDEA_LOCK is overdue. Lock the best idea you have now; the time math only gets worse.', { urgent: true })
  }
  if (c.mode === 'crunch' && g.B.locked) {
    const late = c.overdue.map(o => o.id).filter(id => ['SKELETON_DEPLOYED', 'WOW_WORKS'].includes(id)).join(', ')
    return r('build', `Behind schedule (${late} overdue): cut scope to the golden path, deploy what works now, and move every non-essential slice to the NOT-building list.`, { urgent: true })
  }

  if (!has(projectDir, 'rubric.json') || !has(projectDir, 'HACKATHON.md')) return r('kickoff', 'No event intake yet (rubric.json / HACKATHON.md).')
  if (!has(projectDir, 'research/OPPORTUNITIES.md') && !g.A.locked) return r('research', 'No opportunity map yet. Run the research sweep for the theme.')
  if (!has(projectDir, 'ideas/LEADERBOARD.md') && !g.A.locked) return r('ideate', 'Research done; run the idea tournament.')
  if (!g.A.locked) return r('ideate', 'Leaderboard exists. Pick one of the top 3 and lock Gate A.')
  if (!g.B.locked) return r('spec', 'Idea locked. Write the demo script and slices, then lock Gate B.')
  if (!done('SKELETON_DEPLOYED')) return r('build', 'Build slice 1 (the end-to-end golden-path skeleton) and deploy it to a public URL.')
  if (!done('WOW_WORKS')) return r('build', 'Skeleton is live. Build the aha slice with real input plus fallbacks.')
  if (!has(projectDir, 'build/JUDGE_REPORT.md')) return r('judge', 'WOW works. Run the mock judging panel to get a ranked fix list.')
  if (!done('FEATURE_FREEZE')) return r('build', 'Apply the top judge fixes (points per hour), then mark FEATURE_FREEZE.')
  if (!done('VIDEO_DONE') || !g.C.locked) return r('ship', 'Build the submission package and record the video.')
  if (!done('SUBMITTED')) return r('ship', 'Run the final checklist and submit.')
  return r('status', 'Submitted. Rehearse the pitch 3x and keep the backup video on local disk.')
}

export function statusData(projectDir, state, now = new Date()) {
  const c = clock(state, now)
  const files = {
    rubric: has(projectDir, 'rubric.json'),
    research: has(projectDir, 'research/OPPORTUNITIES.md'),
    leaderboard: has(projectDir, 'ideas/LEADERBOARD.md'),
    idea: has(projectDir, 'ideas/IDEA.md'),
    demoScript: has(projectDir, 'spec/DEMO_SCRIPT.md'),
    slices: has(projectDir, 'spec/SLICES.md'),
    judgeReport: has(projectDir, 'build/JUDGE_REPORT.md'),
    facts: has(projectDir, 'ship/FACTS.md'),
    checklist: has(projectDir, 'ship/SUBMISSION_CHECKLIST.md'),
  }
  const rubric = readJSON(path.join(hfDir(projectDir), 'rubric.json'), null)
  return {
    event: state.event.name,
    theme: state.event.theme,
    phase: state.phase,
    clock: c,
    gates: state.gates,
    idea: ideaTitle(projectDir),
    checkpoints: CHECKPOINT_IDS.map(id => ({ id, due: state.checkpoints[id].due, done: state.checkpoints[id].done, url: state.checkpoints[id].url || undefined })),
    prodUrl: state.stack.prodUrl || null,
    rubric: rubric ? { source: rubric.source, criteria: (rubric.criteria || []).map(k => `${k.id}:${k.weight}`) } : null,
    web: ledgerSummary(projectDir, state),
    files,
    next: nextStep(projectDir, state, now),
  }
}

// ≤1500 chars, plain text, for SessionStart injection and humans.
export function statusBrief(projectDir, state, now = new Date()) {
  const d = statusData(projectDir, state, now)
  const c = d.clock
  const tz = state.event.timezone
  const gate = id => (state.gates[id].locked ? `${id}✓` : `${id}✗`)
  const cps = d.checkpoints
    .map(k => (k.done ? `${k.id}✓` : Date.parse(k.due) <= now.getTime() ? `${k.id}!LATE` : `${k.id}@${localTime(k.due, tz)}`))
    .join(' · ')
  const lines = [
    `HackForge · ${truncate(d.event, 50)} · phase ${d.phase} · ${c.remainingLabel}${c.mode === 'pre' ? '' : ` (${c.pctElapsed}% elapsed, mode ${c.mode})`}`,
    d.theme ? `Theme: ${truncate(d.theme, 120)}` : null,
    `Gates: ${gate('A')} ${gate('B')} ${gate('C')}${d.idea ? ` · Idea: ${truncate(d.idea, 80)}` : ''}`,
    `Checkpoints: ${cps}`,
    c.overdue.length ? `OVERDUE: ${c.overdue.map(o => `${o.id} (${o.late})`).join(', ')}` : null,
    d.prodUrl ? `Prod: ${d.prodUrl}` : null,
    d.rubric ? `Rubric (${d.rubric.source}): ${d.rubric.criteria.join(' ')}` : null,
    `Web credits: ${d.web.credits}/${d.web.budget}`,
    `Next: ${d.next.skill} — ${d.next.why}`,
    d.next.parallel ? `Parallel: ${d.next.parallel}` : null,
    (c.mode === 'frozen' || c.mode === 'final') && !state.checkpoints.SUBMITTED.done ? 'FREEZE: only golden-path fixes. No new features, no new dependencies.' : null,
    c.mode === 'crunch' ? 'CRUNCH: behind schedule — cut to the golden path and deploy now.' : null,
    'State: .hackforge/ (state.json, rubric.json, HACKATHON.md). CLI: hackforge status|clock|next.',
  ].filter(Boolean)
  let s = lines.join('\n')
  if (s.length > 1500) s = s.slice(0, 1497) + '…'
  return s
}

// One line for the Claude Code status line: "HF T-12h01m · next WOW_WORKS in 1h13m · A✓B✗C✗ · build".
export function statusLine(projectDir, state, now = new Date()) {
  const c = clock(state, now)
  const g = ['A', 'B', 'C'].map(id => id + (state.gates[id].locked ? '✓' : '✗')).join('')
  const late = c.overdue.length ? ` · LATE ${c.overdue[0].id}` : ''
  const next = c.next ? ` · ${c.next.id} in ${c.next.in}` : ''
  const mode = c.mode === 'normal' ? '' : ` · ${c.mode.toUpperCase()}`
  return `HF ${c.remainingLabel}${mode}${late}${next} · ${g} · ${state.phase}`
}
