#!/usr/bin/env node
// SessionStart (startup|resume|clear|compact): re-inject the hackathon state so a fresh or
// compacted context knows the clock, the gates and the next step without re-reading files.
import { readInput, projectFor, loadStateSafe, profile, context, failOpen, allow } from './_common.mjs'
import { statusBrief } from '../../lib/status.mjs'

try {
  const input = readInput()
  const dir = projectFor(input)
  if (!dir) allow()
  const state = loadStateSafe(dir)
  if (!state) {
    if (profile(null, 'session-context') === 'off') allow()
    context('SessionStart', 'HackForge: .hackforge/state.json exists but is unreadable (merge conflict or bad edit?). Guards now treat Gate B as locked. Repair it before continuing: resolve the conflict markers by hand (keep the newer gates/checkpoints), or `git checkout HEAD -- .hackforge/state.json`, then run `hackforge status`.')
  }
  if (profile(state, 'session-context') === 'off') allow()
  const brief = statusBrief(dir, state)
  context('SessionStart', `${brief}\nHackForge skills: /hackforge:go (conductor) · status · research · ideate · spec · build · judge · ship · doctor.`)
} catch (e) {
  failOpen('session-context', e)
}
