// Regression tests for every guard bypass and false positive found by the adversarial review.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BIN = path.join(ROOT, 'bin', 'hackforge')
const HOOK = n => path.join(ROOT, 'scripts', 'hooks', n)
const KEY = ['sk', 'ant', 'api03', 'Zq9'.repeat(14)].join('-') // assembled at runtime; no key literal in the repo

function project({ gateB = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-guard-'))
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@t')
  git('config', 'user.name', 't')
  const start = new Date(Date.now() - 3600000).toISOString()
  const deadline = new Date(Date.now() + 23 * 3600000).toISOString()
  assert.equal(spawnSync(process.execPath, [BIN, 'init', '--name', 'G', '--start', start, '--deadline', deadline], { cwd: dir }).status, 0)
  git('add', '-A')
  git('commit', '-qm', 'init')
  if (gateB) {
    const sp = path.join(dir, '.hackforge', 'state.json')
    const s = JSON.parse(fs.readFileSync(sp, 'utf8'))
    s.gates.B = { locked: true, at: new Date().toISOString(), protected: ['.hackforge/rubric.json', 'tsconfig.json'] }
    fs.writeFileSync(sp, JSON.stringify(s))
  }
  return { dir, git }
}

function guard(dir, command, env = {}, tool = 'Bash') {
  const r = spawnSync(process.execPath, [HOOK('git-guard.mjs')], { input: JSON.stringify({ cwd: dir, tool_name: tool, tool_input: { command } }), encoding: 'utf8', env: { ...process.env, HACKFORGE_HOOKS: '', HACKFORGE_DISABLED_HOOKS: '', ...env } })
  try { return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision } catch { return 'allow' }
}
function edit(dir, file, tool = 'Edit', extra = {}, env = {}) {
  const r = spawnSync(process.execPath, [HOOK('guard-edits.mjs')], { input: JSON.stringify({ cwd: dir, tool_name: tool, tool_input: { file_path: path.join(dir, file), ...extra } }), encoding: 'utf8', env: { ...process.env, HACKFORGE_HOOKS: '', HACKFORGE_DISABLED_HOOKS: '', ...env } })
  try { return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision } catch { return 'allow' }
}

test('git global options no longer hide the subcommand', () => {
  const { dir } = project()
  fs.writeFileSync(path.join(dir, 'config.ts'), `export const k = "${KEY}"\n`)
  for (const c of [`git -C "${dir}" add -A && git -C "${dir}" commit -m "feat: x"`, 'git --no-pager commit -am "feat: x"', 'git -c user.name=a -c user.email=b commit -am x']) {
    assert.equal(guard(dir, c), 'ask', c)
  }
  for (const c of ['git -C . commit -n -m x', 'git commit -nm x', 'git commit -anm x', 'git commit --no-verif -m x', 'git -c core.hookspath=/dev/null commit -m x', 'HP=/dev/null git --config-env=core.hooksPath=HP commit -m x', 'git config core.hooksPath /dev/null']) {
    assert.equal(guard(dir, c), 'deny', c)
  }
})

test('commit messages and echoed text never trigger rules', () => {
  const { dir } = project()
  for (const c of ['git commit -m "docs: explain the -n flag"', 'git commit -m "never use --no-verify"', "git commit -m 'chore: never commit .env'", 'echo "git push -f origin main"', 'git commit -mnew-feature']) {
    assert.equal(guard(dir, c), 'allow', c)
  }
})

test('hook-skipping env vars ask', () => {
  const { dir } = project()
  assert.equal(guard(dir, 'HUSKY=0 git commit -m x'), 'ask')
  assert.equal(guard(dir, 'SKIP=lint git commit -m x'), 'ask')
})

test('.env staging: -f, git stage, -C forms are caught; placeholder env files are fine; staged .env blocks commit', () => {
  const { dir, git } = project()
  for (const c of ['git stage .env', 'git -C . add .env', 'git add .env.local']) assert.equal(guard(dir, c), 'deny', c)
  for (const c of ['git add .env.example', 'git add .env.sample', 'git add .env.template']) assert.equal(guard(dir, c), 'allow', c)
  assert.equal(guard(dir, 'git add -f -A'), 'ask')
  assert.equal(guard(dir, 'git add -f .'), 'ask')
  fs.writeFileSync(path.join(dir, '.env'), 'DATABASE_URL=postgres://' + 'postgres:' + 'Hunter2Pass' + '@db.example.co:5432/postgres\n')
  git('add', '-f', '.env')
  assert.equal(guard(dir, 'git commit -m wip'), 'deny')
})

test('force push: +refspec, clustered flags, delete and mirror are caught; unrelated -f and "main" substrings are not', () => {
  const { dir, git } = project()
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-bare-'))
  spawnSync('git', ['init', '-q', '--bare', bare])
  git('remote', 'add', 'origin', bare)
  git('push', '-q', 'origin', 'main')
  for (const c of ['git push origin +main', 'git push origin +HEAD:main', 'git push -uf origin main', 'git push -fu origin main', 'git push origin --delete main', 'git push origin :main', 'git push --mirror']) {
    assert.equal(guard(dir, c), 'ask', c)
  }
  git('checkout', '-qb', 'feat')
  assert.equal(guard(dir, 'git push -f origin fix-main-page'), 'allow')
  assert.equal(guard(dir, 'git push origin feat && rm -f tmp.txt'), 'allow')
})

test('push scan covers other branches, --all and gh repo create --push', () => {
  const { dir, git } = project()
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-bare-'))
  spawnSync('git', ['init', '-q', '--bare', bare])
  git('remote', 'add', 'origin', bare)
  git('push', '-q', 'origin', 'main')
  git('checkout', '-qb', 'hf/slice-S2')
  fs.writeFileSync(path.join(dir, 'leak.ts'), `const k = "AKIA${'Q7'.repeat(8)}"\n`)
  git('add', 'leak.ts')
  git('commit', '-qm', 'slice')
  git('checkout', '-q', 'main')
  for (const c of ['git push origin hf/slice-S2', 'git push --all origin', 'git push origin hf/slice-S2:main', 'gh repo create demo --public --source=. --push']) {
    assert.equal(guard(dir, c), 'ask', c)
  }
})

test('large first commits: scanning is budgeted by bytes, not a silent 400-file cap', () => {
  const { dir } = project()
  fs.mkdirSync(path.join(dir, 'data'))
  for (let i = 0; i < 450; i++) fs.writeFileSync(path.join(dir, 'data', `f${i}.json`), '{"x":1}')
  fs.mkdirSync(path.join(dir, 'src'))
  fs.writeFileSync(path.join(dir, 'src', 'zz-config.ts'), `export const k = "${KEY}"\n`)
  assert.equal(guard(dir, 'git add -A && git commit -m "feat: initial"'), 'ask')
})

test('judge files: shell writes after Gate B ask; reading/running them does not; state.json is CLI-only', () => {
  const { dir } = project({ gateB: true })
  fs.mkdirSync(path.join(dir, 'tests'))
  fs.writeFileSync(path.join(dir, 'tests', 'golden-path.spec.ts'), '// test')
  for (const c of ["sed -i '' 's/200/500/' .hackforge/spec/SLICES.md", "echo '{}' > .hackforge/rubric.json", 'rm tests/golden-path.spec.ts', 'cat > tests/golden-path.spec.ts <<EOF\nx\nEOF', "echo '{}' > .hackforge/state.json"]) {
    assert.equal(guard(dir, c), 'ask', c)
  }
  for (const c of ['npx playwright test tests/golden-path.spec.ts 2>&1 | tail -20', 'cat .hackforge/rubric.json', 'jq .gates .hackforge/state.json', 'grep -n CONTRACT .hackforge/spec/SLICES.md']) {
    assert.equal(guard(dir, c), 'allow', c)
  }
  assert.equal(guard(dir, 'hackforge gate B --unlock'), 'ask')
  assert.equal(guard(dir, '"/x/y/bin/hackforge" state set hooks.profile off'), 'ask')
  assert.equal(guard(dir, 'hackforge state set budget.webCredits 400'), 'ask', 'raising the paid budget needs the human')
  assert.equal(guard(dir, 'hackforge state set scale small'), 'allow')
})

test('PowerShell tool is guarded too', () => {
  const { dir } = project()
  assert.equal(guard(dir, 'git commit --no-verify -m x', {}, 'PowerShell'), 'deny')
})

test('guard-edits: state.json is CLI-only; snapshot protects deleted judge files; configs created after Gate B are free', () => {
  const { dir } = project({ gateB: true })
  assert.equal(edit(dir, '.hackforge/state.json'), 'ask')
  assert.equal(edit(dir, 'tsconfig.json', 'Write'), 'ask', 'in the snapshot: protected even though it does not exist now (delete-then-write)')
  assert.equal(edit(dir, 'eslint.config.mjs', 'Write'), 'allow', 'created after Gate B — not locked yet')
  assert.equal(edit(dir, '.hackforge/rubric.json'), 'ask')
})

test('guard-edits: corrupt state.json keeps protection on (fail safe) and session-context says so', () => {
  const { dir } = project({ gateB: true })
  fs.mkdirSync(path.join(dir, '.hackforge', 'spec'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.hackforge', 'spec', 'SLICES.md'), '# slices')
  fs.writeFileSync(path.join(dir, '.hackforge', 'state.json'), '{"gates": <<<<<<< HEAD')
  assert.equal(edit(dir, '.hackforge/rubric.json'), 'ask')
  const r = spawnSync(process.execPath, [HOOK('session-context.mjs')], { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' })
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /unreadable/)
})

test('after submission, freeze reminders and nudges stop', () => {
  const { dir } = project()
  const sp = path.join(dir, '.hackforge', 'state.json')
  const s = JSON.parse(fs.readFileSync(sp, 'utf8'))
  const past = new Date(Date.now() - 3600000).toISOString()
  for (const id of Object.keys(s.checkpoints)) { s.checkpoints[id].due = past; s.checkpoints[id].done = past }
  s.gates.C.locked = true
  fs.writeFileSync(sp, JSON.stringify(s))
  const n = spawnSync(process.execPath, [HOOK('clock-nudge.mjs')], { input: JSON.stringify({ cwd: dir, prompt: 'hi' }), encoding: 'utf8', env: { ...process.env, HACKFORGE_HOOKS: '' } })
  assert.equal(n.stdout, '')
  assert.equal(edit(dir, 'src/app.ts', 'Edit', {}, { HACKFORGE_HOOKS: 'safe' }), 'allow')
})

test('fast path: non-git commands are allowed quickly', () => {
  const { dir } = project()
  const t0 = Date.now()
  for (let i = 0; i < 5; i++) assert.equal(guard(dir, 'ls -la && npm run build'), 'allow')
  assert.ok((Date.now() - t0) / 5 < 400, 'git-guard should be cheap on non-git commands')
})

// ---------------- round-2 regressions ----------------
test('r2: secret scan covers the whole repo even from a subdirectory or with -C sub', () => {
  const { dir } = project()
  fs.mkdirSync(path.join(dir, 'web'))
  fs.writeFileSync(path.join(dir, 'web', 'x.txt'), 'x')
  fs.writeFileSync(path.join(dir, 'config.ts'), `export const k = "${KEY}"\n`)
  const sub = path.join(dir, 'web')
  const run = c => { const r = spawnSync(process.execPath, [HOOK('git-guard.mjs')], { input: JSON.stringify({ cwd: sub, tool_name: 'Bash', tool_input: { command: c } }), encoding: 'utf8', env: { ...process.env, HACKFORGE_HOOKS: '' } }); try { return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision } catch { return 'allow' } }
  assert.equal(run('git add -A && git commit -m "feat: x"'), 'ask')
  assert.equal(guard(dir, 'git -C web add -A && git -C web commit -m x'), 'ask')
})

test('r2: wrappers, continuations and compound commands are seen through', () => {
  const { dir } = project()
  for (const c of ['git commit \\\n  --no-verify \\\n  -m "x"', '(git commit -n -m x)', '{ git commit -n -m x; }', 'if true; then git commit --no-verify -m x; fi', 'bash -c "git commit --no-verify -m x"', 'sh -lc \'git commit -n -m x\'', 'eval "git commit --no-verify -m x"', 'echo x | xargs git commit --no-verify -m', '\\git commit -n -m x', 'git config alias.ci "commit --no-verify"']) {
    assert.equal(guard(dir, c), 'deny', c)
  }
  fs.writeFileSync(path.join(dir, 'config.ts'), `export const k = "${KEY}"\n`)
  assert.equal(guard(dir, 'git add -A; (git commit -m x)'), 'ask')
})

test('r2: force push via HEAD/@/quoted refs on main is caught', () => {
  const { dir, git } = project()
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-bare-'))
  spawnSync('git', ['init', '-q', '--bare', bare])
  git('remote', 'add', 'origin', bare)
  for (const c of ['git push -f origin HEAD', 'git push --force origin HEAD', 'git push origin +HEAD', 'git push -f origin @', 'git push -f origin "main"', "git push origin '+main'"]) {
    assert.equal(guard(dir, c), 'ask', c)
  }
})

test('r2: heredoc redirects, sed variants, python configs and relative paths reach the judge check', () => {
  const { dir } = project({ gateB: true })
  const sp = path.join(dir, '.hackforge', 'state.json')
  const s = JSON.parse(fs.readFileSync(sp, 'utf8'))
  s.gates.B.protected.push('pyproject.toml', 'pytest.ini')
  fs.writeFileSync(sp, JSON.stringify(s))
  fs.mkdirSync(path.join(dir, 'sub'))
  for (const c of ["cat <<'EOF' > .hackforge/rubric.json\n{}\nEOF", 'cat <<EOF >> .hackforge/rubric.json\nx\nEOF', "sed -i.bak 's/a/b/' .hackforge/spec/SLICES.md", "sed -E -i '' 's/a/b/' .hackforge/spec/SLICES.md", "echo '[pytest]' > pytest.ini", 'rm pytest.ini', "sed -i '' 's/-q/-x/' pyproject.toml"]) {
    assert.equal(guard(dir, c), 'ask', c)
  }
  const sub = path.join(dir, 'sub')
  const r = spawnSync(process.execPath, [HOOK('git-guard.mjs')], { input: JSON.stringify({ cwd: sub, tool_name: 'Bash', tool_input: { command: "echo '{}' > ../.hackforge/rubric.json" } }), encoding: 'utf8', env: { ...process.env, HACKFORGE_HOOKS: '' } })
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'ask', 'cwd-relative path')
})

test('r2: read-only uses of judge files are allowed (no false positives)', () => {
  const { dir } = project({ gateB: true })
  for (const c of ["node -e \"console.log(require('./.hackforge/state.json').phase)\"", "python3 -c \"import json;print(json.load(open('.hackforge/rubric.json'))['criteria'])\"", 'cp tests/golden-path.spec.ts /tmp/gp-backup.ts', 'cp .hackforge/state.json /tmp/state-backup.json', "git commit -m 'don'\\''t panic' -u", 'git commit -S -m signed']) {
    assert.equal(guard(dir, c), 'allow', c)
  }
  assert.equal(guard(dir, "node -e \"require('fs').writeFileSync('.hackforge/rubric.json','{}')\""), 'ask')
  assert.equal(guard(dir, 'cp /tmp/x.json .hackforge/rubric.json'), 'ask')
})

test('r2: hackforge flags anywhere are parsed like the CLI', () => {
  const { dir } = project({ gateB: true })
  for (const c of ['hackforge gate --unlock B', 'hackforge gate --note "scope change" B --unlock', 'hackforge gate B --unlock=1', 'hackforge state set --note x hooks.profile off', 'hackforge gate B --lock --force', 'HACKFORGE_WEB_BUDGET=5000 hackforge web search x']) {
    assert.equal(guard(dir, c), 'ask', c)
  }
})

test('r2: PowerShell forms', () => {
  const { dir } = project({ gateB: true })
  const ps = c => guard(dir, c, {}, 'PowerShell')
  assert.equal(ps('Set-Content -Path .hackforge\\rubric.json -Value "{}"'), 'ask')
  assert.equal(ps("'{}' | Out-File .hackforge/rubric.json"), 'ask')
  assert.equal(ps('Remove-Item tests/golden-path.spec.ts'), 'ask')
  assert.equal(ps('$env:HUSKY=0; git commit -m x'), 'ask')
  assert.equal(ps('git commit `\n --no-verify -m x'), 'deny')
})

test('r2: corrupt state.json → git-guard also treats Gate B as locked', () => {
  const { dir } = project({ gateB: true })
  fs.writeFileSync(path.join(dir, '.hackforge', 'state.json'), '{"gates": <<<<<<< HEAD')
  assert.equal(guard(dir, "echo '{}' > .hackforge/rubric.json"), 'ask')
  assert.equal(edit(dir, '.hackforge/rubric.json'), 'ask')
})

test('r2: rolling back to an hf-cp tag asks unless .hackforge is excluded', () => {
  const { dir } = project()
  assert.equal(guard(dir, 'git checkout hf-cp/SKELETON_DEPLOYED'), 'ask')
  assert.equal(guard(dir, "git restore --source hf-cp/SKELETON_DEPLOYED --staged --worktree -- . ':(exclude).hackforge'"), 'allow')
})

test('r2: SLICES board check replaces literally ($& cannot sneak a contract change through)', () => {
  const { dir } = project({ gateB: true })
  const f = path.join(dir, '.hackforge', 'spec', 'SLICES.md')
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.copyFileSync(path.join(ROOT, 'templates', 'spec', 'SLICES.md'), f)
  const text = fs.readFileSync(f, 'utf8')
  const row = text.match(/\| 1 \| Dev server up[^\n]*/)[0]
  assert.equal(edit(dir, '.hackforge/spec/SLICES.md', 'Edit', { old_string: row, new_string: '$&' }), 'ask')
})
