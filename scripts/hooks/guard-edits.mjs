#!/usr/bin/env node
// PreToolUse(Write|Edit|MultiEdit|NotebookEdit): anti-Goodhart + freeze discipline.
//  - After Gate B: editing an EXISTING judge file (rubric, slice contracts, demo script, golden-path test,
//    lint/type/test configs) → ask (fast) / deny (safe). Builders must not move the goalposts.
//  - After FEATURE_FREEZE is due: code edits get a reminder (fast, at most every 10 min) or ask (safe).
import fs from 'node:fs'
import path from 'node:path'
import { readInput, projectFor, loadStateSafe, profile, decide, context, failOpen, allow, relToProject, readNudge, writeNudge } from './_common.mjs'
import { JUDGE_ALWAYS, GOLDEN_RE, judgeSnapshot } from '../../lib/state.mjs'

const NON_CODE = /^(\.hackforge\/|docs\/|demo\/)|\.(md|mdx|txt)$|^README/i
const SLICES = '.hackforge/spec/SLICES.md'

// SLICES.md mixes protected contracts (between <!-- CONTRACT Sn BEGIN/END --> markers) with a free-to-edit
// board (owner/status). Return the contract blocks so we can tell whether an edit touches one.
function contractBlocks(text) {
  const blocks = new Map()
  const re = /<!--\s*CONTRACT\s+([\w.-]+)\s+BEGIN\s*-->([\s\S]*?)<!--\s*CONTRACT\s+\1\s+END\s*-->/g
  let m
  while ((m = re.exec(text))) {
    if (blocks.has(m[1])) return null // duplicate id: ambiguous → treat as unsafe
    blocks.set(m[1], { start: m.index, end: m.index + m[0].length, body: m[2].trim() })
  }
  return blocks
}

// Literal replacement, exactly like the Edit tool (String.replace would expand $&, $' and $`).
function literalReplace(text, oldS, newS, all) {
  if (all) return text.split(oldS).join(newS)
  const i = text.indexOf(oldS)
  return i < 0 ? text : text.slice(0, i) + newS + text.slice(i + oldS.length)
}

// true = the proposed edit leaves every existing contract block byte-identical.
function slicesEditSafe(current, ti, tool) {
  const before = contractBlocks(current)
  if (!before || !before.size) return false // no/duplicate markers → cannot tell → protect the whole file
  let after = null
  if (tool === 'Write' && typeof ti.content === 'string') after = ti.content
  else {
    const edits = Array.isArray(ti.edits) ? ti.edits : [{ old_string: ti.old_string, new_string: ti.new_string, replace_all: ti.replace_all }]
    after = current
    for (const e of edits) {
      if (typeof e.old_string !== 'string' || !after.includes(e.old_string)) return false
      after = literalReplace(after, e.old_string, e.new_string ?? '', e.replace_all)
    }
  }
  const nb = contractBlocks(after)
  if (!nb) return false
  for (const [id, b] of before) if (!nb.has(id) || nb.get(id).body !== b.body) return false
  return true
}

try {
  const input = readInput()
  if (input.__unparseable) failOpen('guard-edits', 'unparseable hook input')
  const dir = projectFor(input)
  if (!dir) allow()
  const ti = input.tool_input || {}
  const rel = relToProject(dir, ti.file_path || ti.notebook_path || ti.path)
  if (!rel || rel.startsWith('..')) allow()
  const stateFile = path.join(dir, '.hackforge', 'state.json')
  let state = loadStateSafe(dir)
  // Unreadable state.json must not silently switch protection off: assume Gate B is locked if a spec exists.
  const corrupt = !state && fs.existsSync(stateFile)
  if (corrupt) state = { gates: { B: { locked: true, protected: judgeSnapshot(dir) } }, checkpoints: {} }
  const prof = profile(corrupt ? null : state, 'guard-edits')
  if (!state || prof === 'off') allow()
  const soft = prof === 'safe' ? 'deny' : 'ask'

  if (rel === '.hackforge/state.json') {
    decide(soft, '.hackforge/state.json is written only by the hackforge CLI (`hackforge state set`, `gate`, `checkpoint`) — hand edits can silently disable the gates and the clock.')
  }

  if (state.gates?.B?.locked) {
    // Protected = what existed at Gate B (snapshot; still protected if deleted) + the always-judge files
    // + golden-path tests. Configs scaffolded after Gate B join the set at SKELETON_DEPLOYED.
    const snapshot = state.gates.B.protected || []
    const isJudge = JUDGE_ALWAYS.includes(rel) || snapshot.includes(rel) || GOLDEN_RE.test(rel)
    const exists = fs.existsSync(path.join(dir, rel))
    if (isJudge && (exists || snapshot.includes(rel))) {
      if (rel === SLICES && exists) {
        let safe = false
        try { safe = slicesEditSafe(fs.readFileSync(path.join(dir, rel), 'utf8'), ti, input.tool_name) } catch {}
        if (safe) allow() // board/status edits are fine; contracts are untouched
      }
      decide(soft, `${rel} is a judge file (acceptance criteria / rubric / test / lint config), protected since Gate B. Changing it to make work "pass" is moving the goalposts. Proceed only if the human explicitly wants the criteria changed.`)
    }
  }

  const freezeDue = Date.parse(state.checkpoints?.FEATURE_FREEZE?.due || '')
  const deadline = Date.parse(state.event?.deadline || '')
  const finished = Boolean(state.checkpoints?.SUBMITTED?.done || state.gates?.C?.locked) || (Number.isFinite(deadline) && Date.now() >= deadline)
  if (!finished && Number.isFinite(freezeDue) && Date.now() >= freezeDue && !NON_CODE.test(rel)) {
    if (prof === 'safe') decide('ask', `feature freeze is in effect. Is editing ${rel} a golden-path bug fix? No new features or dependencies after freeze.`)
    const nudge = readNudge(dir)
    const last = nudge.freezeRemindAt ? Date.parse(nudge.freezeRemindAt) : 0
    if (Date.now() - last > 10 * 60 * 1000) {
      writeNudge(dir, { ...nudge, freezeRemindAt: new Date().toISOString() })
      context('PreToolUse', `HackForge: FEATURE FREEZE is in effect. Only golden-path bug fixes now (no new features, no new dependencies). Re-run the golden-path test after this edit.`)
    }
  }
  allow()
} catch (e) {
  failOpen('guard-edits', e)
}
