// hackforge CLI dispatcher. Every command prints JSON (except help, status --brief, doctor text, dev logs).
import path from 'node:path'
import { CliError, parseArgs, out, flagStr, getPath, setPath, parseValue, findProjectDir } from './util.mjs'
import {
  initProject, requireProject, loadState, saveState, gateStatus, lockGate, markCheckpoint, clock,
  CHECKPOINT_IDS, CHECKPOINT_EXIT, computeCheckpoints, PLUGIN_ROOT,
} from './state.mjs'
import { statusData, statusBrief, nextStep, statusLine } from './status.mjs'
import { probeUrl } from './probe.mjs'
import { webCommand } from './web.mjs'
import { ghCommand, hnCommand, papers, saturation } from './sources.mjs'
import { devCommand } from './dev.mjs'
import { secretsScan } from './secrets.mjs'
import { doctor, doctorText } from './doctor.mjs'
import { mcpCommand, listProfiles } from './mcp.mjs'
import { BOOLEANS, VALUE_FLAGS } from './flags.mjs'

const HELP = `hackforge — hackathon state, clock and research CLI (HackForge plugin)

Project state
  init --name N --theme T --start ISO --deadline ISO [--tz Z] [--format 24h|48h|week|custom]
       [--url U] [--team-size n] [--stack web|python|mobile|custom] [--scale small|medium|large] [--dev-command c] [--dev-port p] [--budget 300] [--force]
  state get [dot.path]            state set <dot.path> <json|string>
  gate <A|B|C> [--lock|--unlock] [--note s]   (locking A/B also tags hf-cp/IDEA_LOCK, hf-cp/SPEC_LOCK)
  checkpoint [list]               checkpoint <ID> --done|--undo [--url U] [--note s] [--force]   (tags git hf-cp/<ID>)
                                  checkpoint <ID> --url U | --note s    (update fields without marking done)
  clock                           status [--brief]            next            probe <url>
  statusline [--snippet]          (one-line countdown for your Claude Code status line)

Research (free unless noted)
  web search "<q>" [--n 10] [--site d] [--type web|news]     (Bright Data SERP, 1 credit, cached)
  web count "<q>" [--site d]                                 (result count; 1 credit, cached)
  web scrape <url> [--print] [--max-chars n] [--direct]      (Bright Data unlocker, 1 credit, cached; .gov → free direct fetch; PDFs saved for Read)
  web discover "<q>" [--intent "…"] [--n 10] [--include-content]   (optional: unavailable on some keys)
  web pipe <gd_id> <method> [inputs…] [--field v…] [--limit n] [--async]   (1 credit per record)
  web harvest <snapshot_id>       web release <snapshot_id> (free a failed run's reservation)       web ledger
  gh repos "<q>" [--n 20] [--sort stars|updated]   gh repo o/r   gh readme o/r   gh code "<q>"   gh rate
  hn search "<q>" [--tags story|show_hn|ask_hn|comment|all] [--min-points n]   hn trend "<q>" [--from 2019]   hn item <id>
  papers "<q>" [--n 10] [--since 2024]
  saturation "<keywords>" [--free]

Build & ship
  dev up [--cmd c] [--port p] [--wait s] | dev status | dev down | dev logs [--n 80]
  secrets [--staged | --range A..B | --history | --tracked | --path p]
  doctor [--json] [--probe]       mcp [research|web|python|github] [--write] [--all]

Global: --project <dir> (default: nearest dir containing .hackforge/state.json) · --fresh bypasses the web cache
Env: HACKFORGE_WEB_BUDGET (credit cap override; ask the user first) · HACKFORGE_CACHE (cache dir outside a project)
     HACKFORGE_HOOKS=off|fast|safe · HACKFORGE_DISABLED_HOOKS=a,b · GITHUB_TOKEN (30 searches/min, code search)
Docs: ${path.join(PLUGIN_ROOT, 'docs', 'DESIGN.md')}`


export async function main(argv) {
  const [cmd, ...rest] = argv
  const { flags, pos } = parseArgs(rest, BOOLEANS, VALUE_FLAGS)
  try {
    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return out(HELP)
    const res = await dispatch(cmd, pos, flags)
    if (res !== undefined) out(res)
  } catch (e) {
    if (e instanceof CliError) {
      process.stderr.write(`hackforge ${cmd}: ${e.message}\n`)
      process.exit(e.code)
    }
    throw e
  }
}

// Commands that work without a project (research from anywhere) get state = null.
function optionalProject(flags) {
  const dir = findProjectDir(flags.project)
  return { projectDir: dir, state: dir ? loadState(dir) : null }
}

async function dispatch(cmd, pos, flags) {
  switch (cmd) {
    case 'init': {
      const dir = path.resolve(flagStr(flags, 'project', process.cwd()))
      const r = initProject(dir, {
        name: flagStr(flags, 'name'), theme: flagStr(flags, 'theme'), start: flagStr(flags, 'start'), deadline: flagStr(flags, 'deadline'),
        tz: flagStr(flags, 'tz'), format: flagStr(flags, 'format'), url: flagStr(flags, 'url'), teamSize: flagStr(flags, 'team-size'),
        stack: flagStr(flags, 'stack'), scale: flagStr(flags, 'scale'), devCommand: flagStr(flags, 'dev-command'), devPort: flagStr(flags, 'dev-port'),
        budget: flagStr(flags, 'budget'), force: Boolean(flags.force),
      })
      return { ...r, state: undefined, clock: clock(r.state), checkpoints: r.state.checkpoints }
    }
    case 'state': {
      const dir = requireProject(flags)
      const state = loadState(dir)
      const [sub, key, ...vals] = pos
      if (!sub || sub === 'get') {
        const v = key ? getPath(state, key) ?? null : state
        return v !== null && typeof v === 'object' ? v : JSON.stringify(v) // always valid JSON on stdout
      }
      if (sub === 'set') {
        if (!key || !vals.length) throw new CliError('usage: hackforge state set <dot.path> <json|string>')
        if (/^(gates|checkpoints)(\.|$)/.test(key)) throw new CliError('use `hackforge gate` / `hackforge checkpoint` for gates and checkpoints (they check prerequisites)')
        if (/^event(\.(start|deadline|format|timezone))?$/.test(key)) throw new CliError('use `hackforge init --start … --deadline … [--tz …] [--format …]` to change timing (it validates and recomputes checkpoints)')
        if (key === 'scale' && !['small', 'medium', 'large'].includes(String(vals[0]))) throw new CliError('scale must be small, medium or large')
        const value = parseValue(vals.join(' '))
        if (/^budget(\.webCredits)?$/.test(key)) {
          const n = key === 'budget' ? value?.webCredits : value
          if (!(typeof n === 'number' && Number.isFinite(n) && n >= 0)) throw new CliError('budget.webCredits must be a non-negative number (e.g. 500)')
        }
        if (key === 'stack.devPort' && !(Number.isInteger(value) && value > 0)) throw new CliError('stack.devPort must be a port number')
        if (key === 'team' && (typeof value !== 'object' || value === null)) throw new CliError('team must be a JSON object; to set just the people use: state set team.members \'[…]\'')
        setPath(state, key, value)
        if (key === 'stack.devPort') state.stack.devUrl = `http://localhost:${value}`
        if (key === 'team' && Array.isArray(value.members) && !value.size) state.team.size = value.members.length
        saveState(dir, state)
        return { set: key, value: getPath(state, key) }
      }
      throw new CliError('usage: hackforge state get [path] | state set <path> <value>')
    }
    case 'gate': {
      const dir = requireProject(flags)
      const state = loadState(dir)
      const id = String(pos[0] || '').toUpperCase()
      if (!['A', 'B', 'C'].includes(id)) {
        return Object.fromEntries(['A', 'B', 'C'].map(g => [g, gateStatus(dir, state, g)]))
      }
      if (flags.lock || flags.unlock) return lockGate(dir, state, id, { unlock: Boolean(flags.unlock), note: flagStr(flags, 'note', ''), force: Boolean(flags.force) })
      return gateStatus(dir, state, id)
    }
    case 'checkpoint': {
      const dir = requireProject(flags)
      const state = loadState(dir)
      const id = String(pos[0] || 'list').toUpperCase()
      if (id === 'LIST') return { clock: clock(state), checkpoints: CHECKPOINT_IDS.map(k => ({ id: k, exit: CHECKPOINT_EXIT[k], ...state.checkpoints[k] })) }
      if (!CHECKPOINT_IDS.includes(id)) throw new CliError(`checkpoint must be one of ${CHECKPOINT_IDS.join(', ')}`)
      const url = flagStr(flags, 'url')
      const note = flagStr(flags, 'note')
      const PUBLIC_URL_IDS = ['SKELETON_DEPLOYED', 'VIDEO_DONE', 'SUBMITTED']
      const probeOrRefuse = async u => {
        const pr = await probeUrl(u)
        if (!pr.ok && !flags.force) throw new CliError(`refusing: ${pr.problem} (${u}). Fix it, or pass --force if a human verified it by hand.`, 14)
        return pr
      }
      if (!flags.done && !flags.undo) {
        if (!url && !note) return { id, exit: CHECKPOINT_EXIT[id], ...state.checkpoints[id] }
        // --url / --note alone only update fields; marking done needs an explicit --done.
        let pr
        if (url && PUBLIC_URL_IDS.includes(id)) pr = await probeOrRefuse(url)
        if (url) state.checkpoints[id].url = url
        if (url && id === 'SKELETON_DEPLOYED') state.stack.prodUrl = url
        if (note) state.checkpoints[id].note = note
        saveState(dir, state)
        return { id, updated: [url && 'url', note && 'note'].filter(Boolean), ...state.checkpoints[id], ...(pr ? { probe: pr } : {}) }
      }
      let probeRes
      // Enforce the exit criterion where a machine can check it: the URL judges get must be public.
      // The URL may come from this call or from an earlier `--url`; one is required.
      if (flags.done && PUBLIC_URL_IDS.includes(id)) {
        const u = url || state.checkpoints[id].url
        if (!u && !flags.force) throw new CliError(`${id} needs the public URL judges will use: --url <url> (it is probed)`, 14)
        if (u) probeRes = await probeOrRefuse(u)
      }
      return { ...markCheckpoint(dir, state, id, { done: Boolean(flags.done) && !flags.undo, url: url || (flags.done ? state.checkpoints[id].url : undefined), note }), ...(probeRes ? { probe: probeRes } : {}) }
    }
    case 'probe': {
      if (!pos[0]) throw new CliError('usage: hackforge probe <url>  — is this URL publicly reachable without login?')
      const r = await probeUrl(pos[0])
      out(r)
      if (!r.ok) process.exit(1)
      return undefined
    }
    case 'statusline': {
      if (flags.snippet) {
        return { statusLine: { type: 'command', command: `node "${path.join(PLUGIN_ROOT, 'scripts', 'statusline.mjs')}"` }, note: 'Add this to ~/.claude/settings.json (or .claude/settings.json). Plugins cannot set the main status line themselves.' }
      }
      const dir = findProjectDir(flags.project)
      if (!dir) return ''
      return statusLine(dir, loadState(dir))
    }
    case 'clock': {
      const dir = requireProject(flags)
      return clock(loadState(dir))
    }
    case 'status': {
      const dir = requireProject(flags)
      const state = loadState(dir)
      return flags.brief ? statusBrief(dir, state) : statusData(dir, state)
    }
    case 'next': {
      const dir = requireProject(flags)
      return nextStep(dir, loadState(dir))
    }
    case 'web': {
      const [sub, ...p] = pos
      return webCommand(sub, p, flags, optionalProject(flags))
    }
    case 'gh': {
      const [sub, ...p] = pos
      return ghCommand(sub, p, flags)
    }
    case 'hn': {
      const [sub, ...p] = pos
      return hnCommand(sub, p, flags)
    }
    case 'papers': {
      if (!pos[0]) throw new CliError('usage: hackforge papers "<query>" [--n 10] [--since 2024]')
      return papers(pos.join(' '), { n: Number(flagStr(flags, 'n', '10')), since: flagStr(flags, 'since') })
    }
    case 'saturation': {
      if (!pos[0]) throw new CliError('usage: hackforge saturation "<keywords>" [--free]')
      const { projectDir, state } = optionalProject(flags)
      return saturation(projectDir, state, pos.join(' '), { free: Boolean(flags.free) })
    }
    case 'dev': {
      const dir = requireProject(flags)
      const [sub] = pos
      return devCommand(sub, pos.slice(1), flags, { projectDir: dir, state: loadState(dir) })
    }
    case 'secrets': {
      const dir = findProjectDir(flags.project) || process.cwd()
      const res = secretsScan(dir, flags)
      out(res)
      if (!res.clean) process.exit(1)
      return undefined
    }
    case 'doctor': {
      const { projectDir, state } = optionalProject(flags)
      const res = doctor(projectDir, state, flags)
      return flags.json ? res : doctorText(res)
    }
    case 'mcp': {
      if (!pos[0]) return listProfiles()
      const dir = findProjectDir(flags.project) || process.cwd()
      return mcpCommand(pos[0], flags, dir)
    }
    default:
      throw new CliError(`unknown command "${cmd}". Run: hackforge help`)
  }
}
