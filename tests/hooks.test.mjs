// Hook behaviour tests: run each hook script with crafted stdin inside temporary git repos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOOK = n => path.join(ROOT, 'scripts', 'hooks', n)
const BIN = path.join(ROOT, 'bin', 'hackforge')

function project({ hours = 24, startOffsetH = -1, gateB = false, profile } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-hook-'))
  spawnSync('git', ['init', '-q'], { cwd: dir })
  spawnSync('git', ['config', 'user.email', 't@t'], { cwd: dir })
  spawnSync('git', ['config', 'user.name', 't'], { cwd: dir })
  const start = new Date(Date.now() + startOffsetH * 3600000).toISOString()
  const deadline = new Date(Date.parse(start) + hours * 3600000).toISOString()
  const r = spawnSync(process.execPath, [BIN, 'init', '--name', 'Hook test', '--start', start, '--deadline', deadline], { cwd: dir, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  if (gateB) {
    const sp = path.join(dir, '.hackforge', 'state.json')
    const s = JSON.parse(fs.readFileSync(sp, 'utf8'))
    s.gates.B.locked = true
    if (profile) s.hooks.profile = profile
    fs.writeFileSync(sp, JSON.stringify(s))
  }
  return dir
}

function runHook(name, input, env = {}) {
  const r = spawnSync(process.execPath, [HOOK(name)], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, HACKFORGE_HOOKS: '', CLAUDE_PLUGIN_OPTION_HOOK_PROFILE: '', CLAUDE_PROJECT_DIR: '', ...env } })
  let json = null
  try { json = r.stdout ? JSON.parse(r.stdout) : null } catch {}
  return { ...r, json }
}
const decision = r => r.json?.hookSpecificOutput?.permissionDecision || 'allow'

test('hooks are no-ops outside a HackForge project', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-none-'))
  for (const h of ['session-context.mjs', 'clock-nudge.mjs', 'git-guard.mjs', 'guard-edits.mjs']) {
    const r = runHook(h, { cwd: dir, tool_name: 'Bash', tool_input: { command: 'git commit --no-verify -m x', file_path: 'a.ts' } })
    assert.equal(r.status, 0, h)
    assert.equal(r.stdout, '', `${h} must be silent outside a project`)
  }
})

test('session-context injects the brief status', () => {
  const dir = project()
  const r = runHook('session-context.mjs', { cwd: dir, hook_event_name: 'SessionStart' })
  assert.equal(r.status, 0, r.stderr)
  const ctx = r.json.hookSpecificOutput.additionalContext
  assert.match(ctx, /HackForge · Hook test/)
  assert.match(ctx, /\/hackforge:go/)
})

test('profile off silences everything', () => {
  const dir = project()
  const r = runHook('git-guard.mjs', { cwd: dir, tool_name: 'Bash', tool_input: { command: 'git commit --no-verify -m x' } }, { HACKFORGE_HOOKS: 'off' })
  assert.equal(r.stdout, '')
})

test('clock-nudge: speaks once when checkpoints are newly due, then stays quiet', () => {
  const dir = project({ hours: 10, startOffsetH: -2 }) // 20% elapsed → IDEA_LOCK + SPEC_LOCK due
  let r = runHook('clock-nudge.mjs', { cwd: dir, prompt: 'hi' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.json.hookSpecificOutput.additionalContext, /IDEA_LOCK/)
  r = runHook('clock-nudge.mjs', { cwd: dir, prompt: 'again' })
  assert.equal(r.stdout, '', 'second prompt with nothing new must be silent')
  assert.ok(fs.existsSync(path.join(dir, '.hackforge', 'nudge.json')))
  const state = JSON.parse(fs.readFileSync(path.join(dir, '.hackforge', 'state.json'), 'utf8'))
  assert.equal(state.nudge, undefined, 'hooks must not write state.json')
})

test('git-guard: denies --no-verify, core.hooksPath and staging .env', () => {
  const dir = project()
  assert.equal(decision(runHook('git-guard.mjs', { cwd: dir, tool_name: 'Bash', tool_input: { command: 'git commit --no-verify -m "x"' } })), 'deny')
  assert.equal(decision(runHook('git-guard.mjs', { cwd: dir, tool_name: 'Bash', tool_input: { command: 'git -c core.hooksPath=/dev/null commit -m x' } })), 'deny')
  assert.equal(decision(runHook('git-guard.mjs', { cwd: dir, tool_name: 'Bash', tool_input: { command: 'git add .env.local && git commit -m x' } })), 'deny')
  assert.equal(decision(runHook('git-guard.mjs', { cwd: dir, tool_name: 'Bash', tool_input: { command: 'git add .env.example' } })), 'allow')
  assert.equal(decision(runHook('git-guard.mjs', { cwd: dir, tool_name: 'Bash', tool_input: { command: 'ls -la' } })), 'allow')
})

test('git-guard: asks (fast) / denies (safe) when a commit would publish a secret', () => {
  const dir = project()
  fs.writeFileSync(path.join(dir, 'config.ts'), 'export const key = "sk-ant-api03-' + 'Z'.repeat(40) + '"\n')
  const cmd = { cwd: dir, tool_name: 'Bash', tool_input: { command: 'git add -A && git commit -m "feat: x"' } }
  const fast = runHook('git-guard.mjs', cmd)
  assert.equal(decision(fast), 'ask', fast.stdout + fast.stderr)
  assert.match(fast.json.hookSpecificOutput.permissionDecisionReason, /anthropic-key in config\.ts/)
  assert.ok(!fast.stdout.includes('Z'.repeat(20)), 'the secret itself must never be echoed')
  assert.equal(decision(runHook('git-guard.mjs', cmd, { HACKFORGE_HOOKS: 'safe' })), 'deny')
  fs.writeFileSync(path.join(dir, 'config.ts'), 'export const key = process.env.ANTHROPIC_API_KEY\n')
  assert.equal(decision(runHook('git-guard.mjs', cmd)), 'allow')
})

test('git-guard: broad add with an unignored env file asks', () => {
  const dir = project()
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\n') // drop the .env rule
  fs.writeFileSync(path.join(dir, '.env'), 'X=1\n')
  assert.equal(decision(runHook('git-guard.mjs', { cwd: dir, tool_name: 'Bash', tool_input: { command: 'git add .' } })), 'ask')
})

test('guard-edits: judge files are protected only after Gate B, and only if they exist', () => {
  const dir = project()
  const f = path.join(dir, '.hackforge', 'rubric.json')
  const edit = { cwd: dir, tool_name: 'Edit', tool_input: { file_path: f } }
  assert.equal(decision(runHook('guard-edits.mjs', edit)), 'allow', 'before Gate B')
  const locked = project({ gateB: true })
  const lockedEdit = { cwd: locked, tool_name: 'Edit', tool_input: { file_path: path.join(locked, '.hackforge', 'rubric.json') } }
  assert.equal(decision(runHook('guard-edits.mjs', lockedEdit)), 'ask')
  assert.equal(decision(runHook('guard-edits.mjs', lockedEdit, { HACKFORGE_HOOKS: 'safe' })), 'deny')
  assert.equal(decision(runHook('guard-edits.mjs', { cwd: locked, tool_name: 'Write', tool_input: { file_path: path.join(locked, 'tests', 'golden-path.spec.ts') } })), 'allow', 'creating a new test is fine')
  fs.mkdirSync(path.join(locked, 'tests'))
  fs.writeFileSync(path.join(locked, 'tests', 'golden-path.spec.ts'), '// test')
  assert.equal(decision(runHook('guard-edits.mjs', { cwd: locked, tool_name: 'Edit', tool_input: { file_path: path.join(locked, 'tests', 'golden-path.spec.ts') } })), 'ask')
  assert.equal(decision(runHook('guard-edits.mjs', { cwd: locked, tool_name: 'Edit', tool_input: { file_path: path.join(locked, 'src', 'app.ts') } })), 'allow')
})

test('guard-edits: after feature freeze, code edits get a (rate-limited) reminder; safe profile asks', () => {
  const dir = project({ hours: 10, startOffsetH: -8 }) // 80% elapsed → past FEATURE_FREEZE (75%)
  const edit = { cwd: dir, tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src', 'page.tsx') } }
  const r1 = runHook('guard-edits.mjs', edit)
  assert.match(r1.json.hookSpecificOutput.additionalContext, /FEATURE FREEZE/)
  const r2 = runHook('guard-edits.mjs', edit)
  assert.equal(r2.stdout, '', 'reminder is rate-limited')
  assert.equal(decision(runHook('guard-edits.mjs', edit, { HACKFORGE_HOOKS: 'safe' })), 'ask')
  const md = runHook('guard-edits.mjs', { cwd: dir, tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'README.md') } }, { HACKFORGE_HOOKS: 'safe' })
  assert.equal(decision(md), 'allow', 'docs are expected during ship')
})

test('hooks fail open on garbage input', () => {
  const dir = project()
  for (const h of ['git-guard.mjs', 'guard-edits.mjs', 'clock-nudge.mjs', 'session-context.mjs']) {
    const r = spawnSync(process.execPath, [HOOK(h)], { input: '{not json', encoding: 'utf8', cwd: dir })
    assert.equal(r.status, 0, `${h}: ${r.stderr}`)
  }
})
