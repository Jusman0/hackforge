#!/usr/bin/env node
// UserPromptSubmit: silent unless (a) a checkpoint became due since the last nudge and is not done,
// or (b) the event is in crunch/frozen/final mode and the last nudge was > 30 min ago. One short line.
import { readInput, projectFor, loadStateSafe, profile, context, failOpen, allow, readNudge, writeNudge } from './_common.mjs'
import { clock, CHECKPOINT_EXIT, CHECKPOINT_IDS } from '../../lib/state.mjs'
import { nextStep } from '../../lib/status.mjs'
import { run } from '../../lib/util.mjs'

const MODE_RULE = {
  crunch: 'behind schedule (skeleton or aha overdue): cut to the golden path and deploy what works now',
  frozen: 'FEATURE FREEZE: only golden-path fixes; record the video and build the submission',
  final: 'final stretch: finish the submission and checklist; submit before the 30-minute floor',
  over: 'deadline passed: confirm the submission went through',
}

try {
  const input = readInput()
  const dir = projectFor(input)
  if (!dir) allow()
  const state = loadStateSafe(dir)
  if (!state || profile(state, 'clock-nudge') === 'off') allow()
  const now = new Date()
  const c = clock(state, now)
  const nudge = readNudge(dir)
  const lastAt = nudge.lastAt ? Date.parse(nudge.lastAt) : 0
  const newlyDue = CHECKPOINT_IDS.filter(id => {
    const cp = state.checkpoints[id]
    const due = Date.parse(cp.due)
    return !cp.done && due <= now.getTime() && due > lastAt
  })
  const submitted = Boolean(state.checkpoints?.SUBMITTED?.done)
  if (submitted) allow() // nothing left to nudge about
  const urgentMode = state.gates?.C?.locked ? (c.mode === 'over' ? MODE_RULE.over : null) : MODE_RULE[c.mode]
  const stale = now.getTime() - lastAt > 30 * 60 * 1000
  // Commit cadence: during the build, a long gap since the last commit risks losing work and
  // weakens the commit-history evidence some events check (one giant commit can disqualify).
  let commitGapH = null
  const lastCommitNudge = nudge.commitAt ? Date.parse(nudge.commitAt) : 0
  if (state.gates?.B?.locked && c.mode !== 'over' && now.getTime() - lastCommitNudge > 60 * 60 * 1000) {
    const r = run('git', ['log', '-1', '--format=%ct'], { cwd: dir, timeoutMs: 3000 })
    const ts = Number(r.stdout.trim()) * 1000
    if (r.status === 0 && ts && now.getTime() - ts > 90 * 60 * 1000) commitGapH = Math.round((now.getTime() - ts) / 360000) / 10
  }
  if (!newlyDue.length && !(urgentMode && stale) && commitGapH === null) allow()

  const parts = [`⏰ HackForge ${c.remainingLabel} (${c.pctElapsed}% elapsed).`]
  if (newlyDue.length) parts.push(`Now due: ${newlyDue.map(id => `${id} — ${CHECKPOINT_EXIT[id]}`).join('; ')}.`)
  if (urgentMode) parts.push(`Mode ${c.mode}: ${urgentMode}.`)
  if (commitGapH !== null) parts.push(`No commit for ${commitGapH}h — commit working state now (small, descriptive commits are judging evidence).`)
  const nx = nextStep(dir, state, now)
  if (newlyDue.length || (urgentMode && stale)) parts.push(`Suggested next: ${nx.skill} (${nx.why})`)
  writeNudge(dir, {
    ...nudge,
    ...(newlyDue.length || (urgentMode && stale) ? { lastAt: now.toISOString(), lastCheckpoint: c.current } : {}),
    ...(commitGapH !== null ? { commitAt: now.toISOString() } : {}),
  })
  context('UserPromptSubmit', parts.join(' ') + ' Mention this to the user once, briefly, if relevant to their request.')
} catch (e) {
  failOpen('clock-nudge', e)
}
