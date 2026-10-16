// `hackforge mcp <profile> [--write]` — opt-in, exact-pinned MCP profiles. HackForge bundles none.
// Default: print `claude mcp add` commands. --write merges into ./.mcp.json without overwriting existing names.
import path from 'node:path'
import { CliError, readJSON, writeJSON } from './util.mjs'

// Secrets only ever appear as ${VAR} references (expanded by Claude Code at load time).
export const PROFILES = {
  research: {
    about: 'Keyless research core + optional keyed extras. Bright Data CLI (hackforge web) is the primary deep-scrape path; its MCP is optional.',
    servers: {
      'parallel-search': { type: 'http', url: 'https://search.parallel.ai/mcp' },
      deepwiki: { type: 'http', url: 'https://mcp.deepwiki.com/mcp' },
      grep: { type: 'http', url: 'https://mcp.grep.app' },
      context7: { type: 'http', url: 'https://mcp.context7.com/mcp' },
      // Anonymous Hub search/trending works without login; use the ?login variant (python profile) for higher limits.
      huggingface: { type: 'http', url: 'https://huggingface.co/mcp' },
    },
    optional: {
      // OAuth-only (free account): run /mcp once interactively. Or use the claude.ai alphaXiv connector.
      alphaxiv: { type: 'http', url: 'https://api.alphaxiv.org/mcp/v1' },
      'context7-keyed': { type: 'http', url: 'https://mcp.context7.com/mcp', headers: { Authorization: 'Bearer ${CONTEXT7_API_KEY}' }, requiredEnv: ['CONTEXT7_API_KEY'] },
      brightdata: {
        type: 'http',
        url: 'https://mcp.brightdata.com/mcp?token=${BRIGHTDATA_API_TOKEN}&tools=search_engine,scrape_as_markdown,scrape_batch,search_scrapers,get_scraper_details,run_scraper,get_scraper_progress,get_scraper_results',
        requiredEnv: ['BRIGHTDATA_API_TOKEN'],
      },
    },
  },
  web: {
    about: 'Default web stack (Next.js + shadcn + Supabase + Vercel). Prefer the official plugins (vercel, supabase) if you install those instead.',
    servers: {
      supabase: { type: 'http', url: 'https://mcp.supabase.com/mcp?project_ref=${SUPABASE_PROJECT_REF}&features=database,docs,development,debugging', requiredEnv: ['SUPABASE_PROJECT_REF'] },
      vercel: { type: 'http', url: 'https://mcp.vercel.com' },
      shadcn: { type: 'stdio', command: 'npx', args: ['-y', 'shadcn@4.21.5', 'mcp'] },
      'chrome-devtools': { type: 'stdio', command: 'npx', args: ['-y', 'chrome-devtools-mcp@1.11.0', '--isolated', '--no-usage-statistics', '--no-performance-crux'] },
    },
  },
  python: {
    about: 'ML/Python demos (Gradio/Streamlit/FastAPI). Hugging Face Hub search, papers, Spaces.',
    servers: {
      huggingface: { type: 'http', url: 'https://huggingface.co/mcp?login' },
    },
  },
  github: {
    about: 'Official GitHub remote MCP, read-only repos toolset. Most research works without it via `hackforge gh`.',
    servers: {
      github: { type: 'http', url: 'https://api.githubcopilot.com/mcp/x/repos/readonly', headers: { Authorization: 'Bearer ${GITHUB_TOKEN}' }, requiredEnv: ['GITHUB_TOKEN'] },
    },
  },
}

function entry(def) {
  const { requiredEnv, ...rest } = def
  return rest
}

function addCommand(name, def) {
  const e = entry(def)
  if (e.type === 'stdio') return `claude mcp add --scope project ${name} -- ${e.command} ${e.args.join(' ')}`
  // Single quotes keep ${VAR} literal in the shell; Claude Code expands it from the environment at load time.
  const headers = Object.entries(e.headers || {}).map(([k, v]) => ` --header '${k}: ${v}'`).join('')
  return `claude mcp add --scope project --transport http ${name} '${e.url}'${headers}`
}

export function mcpCommand(profile, flags, cwd) {
  const p = PROFILES[profile]
  if (!p) throw new CliError(`profile must be one of: ${Object.keys(PROFILES).join(', ')}`)
  const include = { ...p.servers, ...(flags.all ? p.optional || {} : {}) }
  const env = Object.values(include).flatMap(d => d.requiredEnv || [])
  const missingEnv = [...new Set(env)].filter(k => !process.env[k])
  if (!flags.write) {
    return {
      profile,
      about: p.about,
      note: 'Run these yourself (or ask Claude to). --scope project writes .mcp.json; OAuth servers need one interactive /mcp login. Never paste literal keys into --header (stored in plaintext); export the env var instead. If you installed the official vendor plugin (e.g. vercel@claude-plugins-official), skip that server here to avoid duplicates. Project .mcp.json servers load without an approval prompt under claude -p / the Agent SDK.',
      commands: Object.entries(include).map(([n, d]) => addCommand(n, d)),
      optional: Object.entries(p.optional || {}).map(([n, d]) => ({ name: n, command: addCommand(n, d), requires: d.requiredEnv || [] })),
      missingEnv,
    }
  }
  const file = path.join(cwd, '.mcp.json')
  const cur = readJSON(file, { mcpServers: {} })
  cur.mcpServers = cur.mcpServers || {}
  const added = []
  const skipped = []
  for (const [n, d] of Object.entries(include)) {
    if (cur.mcpServers[n]) { skipped.push(n); continue }
    cur.mcpServers[n] = entry(d)
    added.push(n)
  }
  if (added.length) writeJSON(file, cur)
  return { profile, file, added, skipped, missingEnv, next: added.length ? 'Restart Claude Code (or /mcp) and approve the project servers; authenticate OAuth servers via /mcp.' : 'nothing to add' }
}

export function listProfiles() {
  return Object.fromEntries(Object.entries(PROFILES).map(([k, v]) => [k, { about: v.about, servers: Object.keys(v.servers), optional: Object.keys(v.optional || {}) }]))
}

