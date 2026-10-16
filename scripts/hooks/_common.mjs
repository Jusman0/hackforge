// Shared hook plumbing. Hooks are no-ops outside a HackForge project and fail open on internal errors.
import fs from 'node:fs'
import path from 'node:path'
import { findProjectDir, hfDir, readJSON, writeJSON, readStdin } from '../../lib/util.mjs'

export function readInput() {
  const raw = readStdin()
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return { __unparseable: true }
  }
}

export function projectFor(input) {
  return findProjectDir(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd())
}

export function loadStateSafe(projectDir) {
  return readJSON(path.join(hfDir(projectDir), 'state.json'), null)
}

export function profile(state, hookName) {
  // Per-hook kill switch, e.g. HACKFORGE_DISABLED_HOOKS=clock-nudge,guard-edits
  const disabled = String(process.env.HACKFORGE_DISABLED_HOOKS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (hookName && disabled.includes(hookName)) return 'off'
  const p = process.env.HACKFORGE_HOOKS || process.env.CLAUDE_PLUGIN_OPTION_HOOK_PROFILE || state?.hooks?.profile || 'fast'
  return ['off', 'fast', 'safe'].includes(p) ? p : 'fast'
}

// Hook-private scratch state (kept out of state.json so hooks never clobber CLI writes).
export function nudgeFile(projectDir) {
  return path.join(hfDir(projectDir), 'nudge.json')
}
export function readNudge(projectDir) {
  return readJSON(nudgeFile(projectDir), {})
}
export function writeNudge(projectDir, data) {
  try {
    writeJSON(nudgeFile(projectDir), data)
  } catch {}
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj))
  process.exit(0)
}

export function context(event, text) {
  emit({ hookSpecificOutput: { hookEventName: event, additionalContext: text.slice(0, 9500) } })
}

export function decide(decision, reason, extraContext) {
  const out = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: `HackForge: ${reason}` } }
  if (extraContext) out.hookSpecificOutput.additionalContext = extraContext
  emit(out)
}

export function allow() {
  process.exit(0)
}

export function failOpen(name, err) {
  try {
    process.stderr.write(`hackforge ${name} hook skipped: ${err?.message || err}\n`)
  } catch {}
  process.exit(0)
}

export function relToProject(projectDir, file) {
  if (!file) return null
  const abs = path.resolve(projectDir, file)
  return path.relative(projectDir, abs).split(path.sep).join('/')
}

export function exists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}
