// `hackforge dev up|status|down|logs` — idempotent, detached dev server owned by the project,
// so QA agents and the main session can share one server (subagent-started processes may die with them).
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { CliError, hfDir, readJSON, writeJSON, flagInt, flagStr, run, which } from './util.mjs'
import { saveState } from './state.mjs'

const devFile = p => path.join(hfDir(p), 'dev.json')
const logFile = p => path.join(hfDir(p), 'dev.log')

function alive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function probe(url, timeoutMs = 3000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'manual' })
    return { up: true, status: res.status }
  } catch {
    return { up: false, status: null }
  } finally {
    clearTimeout(t)
  }
}

export async function devStatus(projectDir, state) {
  const info = readJSON(devFile(projectDir), {})
  const port = info.port || state.stack.devPort || 3000
  const url = `http://localhost:${port}`
  const p = await probe(url)
  return { url, port, pid: info.pid || null, pidAlive: alive(info.pid), up: p.up, httpStatus: p.status, cmd: info.cmd || state.stack.devCommand, startedAt: info.startedAt || null, log: path.relative(projectDir, logFile(projectDir)) }
}

// ---- ownership: never reuse or kill a process that isn't this project's dev server ----
function procCwd(pid) {
  try { return fs.realpathSync(`/proc/${pid}/cwd`) } catch {}
  if (!which('lsof')) return null
  const r = run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { timeoutMs: 5000 })
  const line = r.stdout.split('\n').find(l => l.startsWith('n'))
  return line ? line.slice(1) : null
}
function procCmd(pid) {
  const r = run('ps', ['-o', 'command=', '-p', String(pid)], { timeoutMs: 5000 })
  return r.status === 0 ? r.stdout.trim() : null
}
const real = p => { try { return fs.realpathSync(p) } catch { return p } }
function insideProject(projectDir, cwd) {
  if (!cwd) return false
  const root = real(projectDir)
  const c = real(cwd)
  return c === root || c.startsWith(root + path.sep)
}
// The pid in dev.json is ours only if it is alive AND still runs the command we started (pids get reused).
function ownPid(info) {
  if (!info.pid || !alive(info.pid)) return null
  const cmd = procCmd(info.pid) || ''
  const want = info.rawCmd || (info.cmd || '').replace(/^sh -c /, '')
  return want && cmd.includes(want) ? info.pid : null
}
function listeners(port) {
  if (!which('lsof')) return []
  const r = run('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { timeoutMs: 5000 })
  return [...new Set(r.stdout.split('\n').map(Number).filter(Boolean))]
}

async function waitUp(url, pid, wait) {
  const deadline = Date.now() + wait * 1000
  while (Date.now() < deadline) {
    if ((await probe(url)).up) return true
    if (pid && !alive(pid)) return false
    await new Promise(r => setTimeout(r, 1500))
  }
  return false
}

export async function devUp(projectDir, state, flags) {
  const info = readJSON(devFile(projectDir), {})
  const cmd = flagStr(flags, 'cmd', state.stack.devCommand || 'npm run dev')
  const port = flagInt(flags, 'port', state.stack.devPort || info.port || 3000)
  const wait = flagInt(flags, 'wait', 120)
  // Remember explicit --cmd/--port so every later `dev up` (QA agents, judges) reuses the same server.
  if ((flags.cmd && cmd !== state.stack.devCommand) || (flags.port && port !== state.stack.devPort)) {
    state.stack.devCommand = cmd
    state.stack.devPort = port
    state.stack.devUrl = `http://localhost:${port}`
    saveState(projectDir, state)
  }
  const url = `http://localhost:${port}`
  const mine = ownPid(info)
  if (mine && info.port !== port) throw new CliError(`a HackForge dev server is still running on port ${info.port} (pid ${mine}); run \`hackforge dev down\` first, then \`dev up --port ${port}\``, 11)
  const already = await probe(url)
  if (already.up) {
    // Reuse only this project's server (ours, or one the team started by hand inside this repo).
    const holders = listeners(port)
    const foreign = holders.filter(pid => pid !== mine && !insideProject(projectDir, procCwd(pid)))
    if (holders.length && foreign.length === holders.length) {
      throw new CliError(`port ${port} is served by another process (pid ${foreign[0]}, cwd ${procCwd(foreign[0]) || 'unknown'}) — not this project. Stop it, or use another port: hackforge dev up --port <p>`, 11)
    }
    return { ...(await devStatus(projectDir, state)), started: false, note: mine ? 'already serving — reused' : 'already serving (started outside HackForge, inside this project) — reused' }
  }
  // A server we started earlier is still booting (slow first compile): wait for it instead of starting a second one.
  if (mine && info.port === port) {
    if (await waitUp(url, info.pid, wait)) return { ...(await devStatus(projectDir, state)), started: false, note: 'previous start finished booting — reused' }
    throw new CliError(`dev server pid ${info.pid} is running but not answering on ${url} after ${wait}s — check \`hackforge dev logs\`, or \`hackforge dev down\` then retry`, 11)
  }
  fs.mkdirSync(hfDir(projectDir), { recursive: true })
  const log = fs.openSync(logFile(projectDir), 'a')
  fs.writeSync(log, `\n--- ${new Date().toISOString()} hackforge dev up: ${cmd} (PORT=${port})\n`)
  const child = spawn('sh', ['-c', cmd], {
    cwd: projectDir,
    env: { ...process.env, PORT: String(port), BROWSER: 'none' },
    detached: true,
    stdio: ['ignore', log, log],
  })
  child.unref()
  // Record the pid right away (so a later `dev up` waits for it instead of double-starting) — we only ever
  // get here when no recorded server is alive, so this never overwrites a live pid.
  writeJSON(devFile(projectDir), { pid: child.pid, port, cmd, rawCmd: cmd, startedAt: new Date().toISOString() })
  if (await waitUp(url, child.pid, wait)) return { ...(await devStatus(projectDir, state)), started: true }
  if (!alive(child.pid)) {
    const tail = fs.readFileSync(logFile(projectDir), 'utf8').split('\n').slice(-25).join('\n')
    throw new CliError(`dev server exited early. Last log lines:\n${tail}`, 11)
  }
  throw new CliError(`dev server did not answer on ${url} within ${wait}s (still booting as pid ${child.pid}; re-run \`hackforge dev up\` to keep waiting, see .hackforge/dev.log)`, 11)
}

async function killTree(pid) {
  for (const sig of ['SIGTERM', 'SIGKILL']) {
    try { process.kill(-pid, sig) } catch { try { process.kill(pid, sig) } catch {} }
    for (let i = 0; i < 10 && alive(pid); i++) await new Promise(r => setTimeout(r, 300))
    if (!alive(pid)) return true
  }
  return !alive(pid)
}

export async function devDown(projectDir, state) {
  const info = readJSON(devFile(projectDir), {})
  const port = info.port || state?.stack?.devPort
  const stopped = []
  const skipped = []
  const mine = ownPid(info)
  if (mine && (await killTree(mine))) stopped.push(mine) // whole process group (sh + npm + next)
  if (info.pid && !mine && alive(info.pid)) skipped.push({ pid: info.pid, why: 'recorded pid now runs something else (pid reused) — left alone' })
  // Orphans: an earlier server of THIS project whose pid was lost but still holds the port. Never foreign ones.
  if (port) {
    for (const pid of listeners(port)) {
      if (stopped.includes(pid)) continue
      if (insideProject(projectDir, procCwd(pid))) { if (await killTree(pid)) stopped.push(pid) }
      else skipped.push({ pid, why: `listening on ${port} but not from this project (cwd ${procCwd(pid) || 'unknown'}) — left alone` })
    }
  }
  writeJSON(devFile(projectDir), { ...info, pid: null, stoppedAt: new Date().toISOString() })
  return { stopped: stopped.length > 0, pids: stopped, port, ...(skipped.length ? { skipped } : {}), ...(stopped.length ? {} : { note: 'no running dev server of this project found' }) }
}

export function devLogs(projectDir, n = 80) {
  const f = logFile(projectDir)
  if (!fs.existsSync(f)) return ''
  return fs.readFileSync(f, 'utf8').split('\n').slice(-n).join('\n')
}

export async function devCommand(sub, pos, flags, { projectDir, state }) {
  switch (sub) {
    case 'up': return devUp(projectDir, state, flags)
    case 'status': case undefined: return devStatus(projectDir, state)
    case 'down': return devDown(projectDir, state)
    case 'logs': return devLogs(projectDir, flagInt(flags, 'n', 80))
    default: throw new CliError('usage: hackforge dev <up|status|down|logs>')
  }
}
