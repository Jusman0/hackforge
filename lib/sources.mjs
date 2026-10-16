// Free research sources: GitHub REST, Hacker News (Algolia), OpenAlex papers, plus `saturation`.
import { CliError, fetchJSON, flagInt, flagStr, run, which, truncate } from './util.mjs'
import { serp } from './web.mjs'

// ---------- GitHub ----------

let cachedToken
export function githubToken() {
  if (cachedToken !== undefined) return cachedToken
  cachedToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT || null
  if (!cachedToken && which('gh')) {
    const r = run('gh', ['auth', 'token'], { timeoutMs: 8000 })
    if (r.status === 0 && r.stdout.trim()) cachedToken = r.stdout.trim()
  }
  return cachedToken
}

async function gh(pathAndQuery, { raw = false } = {}) {
  const token = githubToken()
  const headers = { accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' }
  if (token) headers.authorization = `Bearer ${token}`
  let res = await fetchJSON(`https://api.github.com${pathAndQuery}`, { headers })
  // Search is 10/min unauthenticated: when the reset is close, wait it out once instead of failing.
  if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
    const waitMs = Number(res.headers.get('x-ratelimit-reset')) * 1000 - Date.now() + 1000
    if (waitMs > 0 && waitMs <= 65000) {
      process.stderr.write(`hackforge gh: rate limited, waiting ${Math.ceil(waitMs / 1000)}s${token ? '' : ' (set GITHUB_TOKEN for 3x the limit)'}…\n`)
      await new Promise(r => setTimeout(r, waitMs))
      res = await fetchJSON(`https://api.github.com${pathAndQuery}`, { headers })
    }
  }
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    const reset = res.headers.get('x-ratelimit-reset')
    const hint = remaining === '0'
      ? ` — rate limited until ${new Date(Number(reset) * 1000).toISOString()}${token ? '' : ' (set GITHUB_TOKEN for 30 searches/min instead of 10)'}`
      : ''
    throw new CliError(`GitHub ${res.status}: ${truncate(typeof res.body === 'string' ? res.body : res.body?.message, 200)}${hint}`, 3)
  }
  return res.body
}

const repoRow = r => ({
  full_name: r.full_name,
  stars: r.stargazers_count,
  pushed: r.pushed_at?.slice(0, 10),
  created: r.created_at?.slice(0, 10),
  language: r.language,
  topics: (r.topics || []).slice(0, 6),
  description: truncate(r.description || '', 200),
  url: r.html_url,
  archived: r.archived || undefined,
})

export async function ghCommand(sub, pos, flags) {
  switch (sub) {
    case 'repos': {
      if (!pos[0]) throw new CliError('usage: hackforge gh repos "<query + qualifiers>" [--n 20] [--sort stars|updated]')
      const n = Math.min(100, flagInt(flags, 'n', 20))
      const sort = flagStr(flags, 'sort', 'stars')
      const q = encodeURIComponent(pos.join(' '))
      const body = await gh(`/search/repositories?q=${q}&sort=${sort}&order=desc&per_page=${n}`)
      return { query: pos.join(' '), total_count: body.total_count, items: body.items.map(repoRow) }
    }
    case 'repo': {
      const [full] = pos
      if (!/^[\w.-]+\/[\w.-]+$/.test(full || '')) throw new CliError('usage: hackforge gh repo owner/name')
      const r = await gh(`/repos/${full}`)
      return { ...repoRow(r), open_issues: r.open_issues_count, forks: r.forks_count, license: r.license?.spdx_id, homepage: r.homepage || undefined, default_branch: r.default_branch }
    }
    case 'readme': {
      const [full] = pos
      if (!/^[\w.-]+\/[\w.-]+$/.test(full || '')) throw new CliError('usage: hackforge gh readme owner/name [--max-chars 8000]')
      const max = flagInt(flags, 'max-chars', 8000)
      // raw.githubusercontent.com is not rate limited like the API; fall back to the API endpoint.
      for (const name of ['README.md', 'readme.md', 'README.rst', 'README']) {
        const res = await fetchJSON(`https://raw.githubusercontent.com/${full}/HEAD/${name}`)
        if (res.ok && typeof res.body === 'string') return { repo: full, file: name, chars: res.body.length, content: truncate(res.body, max) }
      }
      const body = await gh(`/repos/${full}/readme`, { raw: true })
      return { repo: full, file: 'README (api)', chars: String(body).length, content: truncate(String(body), max) }
    }
    case 'code': {
      if (!githubToken()) throw new CliError('GitHub code search requires a token: export GITHUB_TOKEN=… or `gh auth login`. Alternative without a token: the Grep MCP (hackforge mcp research).', 3)
      if (!pos[0]) throw new CliError('usage: hackforge gh code "<query>" [--n 20]')
      const n = Math.min(100, flagInt(flags, 'n', 20))
      const body = await gh(`/search/code?q=${encodeURIComponent(pos.join(' '))}&per_page=${n}`)
      return { query: pos.join(' '), total_count: body.total_count, items: body.items.map(i => ({ repo: i.repository.full_name, path: i.path, url: i.html_url })) }
    }
    case 'rate': {
      const body = await gh('/rate_limit')
      return { authenticated: Boolean(githubToken()), search: body.resources.search, core: body.resources.core }
    }
    default:
      throw new CliError('usage: hackforge gh <repos|repo|readme|code|rate> …')
  }
}

// ---------- Hacker News (Algolia, free) ----------

const HN = 'https://hn.algolia.com/api/v1'
const stripHtml = s => String(s || '').replace(/<p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&#x2F;/g, '/')

export async function hnSearch(query, { n = 20, tags = 'story', minPoints = 0 } = {}) {
  const params = new URLSearchParams({ query, hitsPerPage: String(n) })
  const tagMap = { story: 'story', show_hn: 'show_hn', ask_hn: 'ask_hn', comment: 'comment', all: '' }
  const t = tags in tagMap ? tagMap[tags] : tags
  if (t) params.set('tags', t)
  if (minPoints) params.set('numericFilters', `points>${minPoints}`)
  const res = await fetchJSON(`${HN}/search?${params}`)
  if (!res.ok) throw new CliError(`HN Algolia ${res.status}`, 3)
  return {
    query,
    total: res.body.nbHits,
    hits: res.body.hits.map(h => ({
      points: h.points, comments: h.num_comments, date: h.created_at?.slice(0, 10),
      title: h.title || truncate(stripHtml(h.comment_text), 160),
      url: h.url || undefined, hn: `https://news.ycombinator.com/item?id=${h.story_id || h.objectID}`,
    })),
  }
}

export async function hnTrend(query, { from = 2019, to = new Date().getUTCFullYear() } = {}) {
  const years = []
  for (let y = from; y <= to; y++) years.push(y)
  const counts = await Promise.all(years.map(async y => {
    const a = Date.UTC(y, 0, 1) / 1000
    const b = Date.UTC(y + 1, 0, 1) / 1000
    const params = new URLSearchParams({ query, tags: 'story', hitsPerPage: '0', numericFilters: `created_at_i>=${a},created_at_i<${b}` })
    const res = await fetchJSON(`${HN}/search?${params}`)
    return { year: y, stories: res.ok ? res.body.nbHits : null }
  }))
  const last = counts[counts.length - 1]
  return { query, counts, note: last && last.year === new Date().getUTCFullYear() ? 'current year is partial' : undefined }
}

export async function hnItem(id, { max = 60 } = {}) {
  const res = await fetchJSON(`${HN}/items/${encodeURIComponent(id)}`)
  if (!res.ok) throw new CliError(`HN item ${id}: ${res.status}`, 3)
  const out = []
  const walk = (node, depth) => {
    for (const c of node.children || []) {
      if (out.length >= max) return
      if (c.text) out.push({ depth, text: truncate(stripHtml(c.text).replace(/\s+/g, ' '), 400) })
      walk(c, depth + 1)
    }
  }
  walk(res.body, 0)
  return { id: res.body.id, title: res.body.title, points: res.body.points, url: res.body.url, comments: out }
}

export async function hnCommand(sub, pos, flags) {
  switch (sub) {
    case 'search':
      if (!pos[0]) throw new CliError('usage: hackforge hn search "<query>" [--n 20] [--tags story|show_hn|ask_hn|comment|all] [--min-points n]')
      return hnSearch(pos.join(' '), { n: flagInt(flags, 'n', 20), tags: flagStr(flags, 'tags', 'story'), minPoints: flagInt(flags, 'min-points', 0) })
    case 'trend':
      if (!pos[0]) throw new CliError('usage: hackforge hn trend "<query>" [--from 2019]')
      return hnTrend(pos.join(' '), { from: flagInt(flags, 'from', 2019) })
    case 'item':
      if (!pos[0]) throw new CliError('usage: hackforge hn item <id> [--max 60]')
      return hnItem(pos[0], { max: flagInt(flags, 'max', 60) })
    default:
      throw new CliError('usage: hackforge hn <search|trend|item> …')
  }
}

// ---------- OpenAlex (free paper metadata) ----------

function abstractFrom(inv) {
  if (!inv) return ''
  const words = []
  for (const [w, idxs] of Object.entries(inv)) for (const i of idxs) words[i] = w
  return words.filter(Boolean).join(' ')
}

export async function papers(query, { n = 10, since } = {}) {
  const params = new URLSearchParams({ search: query, 'per-page': String(Math.min(50, n)) })
  if (since) params.set('filter', `from_publication_date:${since}-01-01`)
  if (process.env.HACKFORGE_EMAIL) params.set('mailto', process.env.HACKFORGE_EMAIL)
  const res = await fetchJSON(`https://api.openalex.org/works?${params}`)
  if (!res.ok) throw new CliError(`OpenAlex ${res.status}`, 3)
  return {
    query,
    total: res.body.meta?.count,
    items: res.body.results.map(w => ({
      title: w.display_name, year: w.publication_year, cited_by: w.cited_by_count,
      doi: w.doi || undefined, url: w.primary_location?.landing_page_url || w.id,
      venue: w.primary_location?.source?.display_name || undefined,
      abstract: truncate(abstractFrom(w.abstract_inverted_index), 500),
    })),
  }
}

// ---------- saturation: is this idea crowded? ----------

export function saturationLevel(sig) {
  // Heuristic, deliberately simple and explainable. GitHub is the backbone signal: without it the
  // answer is 'unknown' rather than a confident guess from HN alone.
  if (sig.github_total == null) return 'unknown'
  if (sig.github_total > 2000) return 'high' // thousands of repos = a well-trodden idea, whatever the rest says
  const votes = []
  votes.push(sig.github_total > 500 ? 2 : sig.github_total > 60 ? 1 : 0)
  if (sig.github_top_stars != null) votes.push(sig.github_top_stars > 5000 ? 2 : sig.github_top_stars > 500 ? 1 : 0)
  if (sig.hn_total != null) votes.push(sig.hn_total > 400 ? 2 : sig.hn_total > 60 ? 1 : 0)
  if (sig.hn_show != null) votes.push(sig.hn_show > 40 ? 2 : sig.hn_show > 8 ? 1 : 0)
  if (sig.devpost_serp != null) votes.push(sig.devpost_serp > 2000 ? 2 : sig.devpost_serp > 200 ? 1 : 0)
  if (sig.producthunt_serp != null) votes.push(sig.producthunt_serp > 500 ? 2 : sig.producthunt_serp > 50 ? 1 : 0)
  const avg = votes.reduce((a, b) => a + b, 0) / votes.length
  return avg >= 1.3 ? 'high' : avg >= 0.6 ? 'medium' : 'low'
}

export async function saturation(projectDir, state, keywords, { free = false } = {}) {
  const warnings = []
  const sig = {}
  let topRepos = []
  try {
    // name/description only: README matches drag in giant awesome-lists and skew the star signal.
    const g = await ghCommand('repos', [`${keywords} in:name,description`], { n: 15 })
    const isList = r => /awesome|list|public-apis|collection/i.test(r.full_name) || r.topics.some(t => /^awesome/.test(t))
    topRepos = g.items.filter(r => !isList(r)).slice(0, 5)
    sig.github_total = g.total_count
    sig.github_top_stars = topRepos[0]?.stars ?? 0
  } catch (e) { warnings.push(`github: ${e.message}`) }
  let hn = null
  try {
    const s = await hnSearch(keywords, { n: 5, tags: 'story' })
    sig.hn_total = s.total
    const show = await hnSearch(keywords, { n: 5, tags: 'show_hn' })
    sig.hn_show = show.total
    const t = await hnTrend(keywords, { from: new Date().getUTCFullYear() - 3 })
    hn = { top: s.hits.slice(0, 3), show_hn: show.hits.slice(0, 3), trend: t.counts }
  } catch (e) { warnings.push(`hn: ${e.message}`) }
  const serpTop = {}
  if (!free) {
    for (const [k, site] of [['devpost_serp', 'devpost.com/software'], ['producthunt_serp', 'producthunt.com/products']]) {
      try {
        const r = serp(projectDir, state, keywords, { site, n: 10 })
        serpTop[k] = r.organic.slice(0, 5).map(o => ({ title: o.title, link: o.link }))
        // Don't vote on counts that aren't about the requested site/path.
        if (r.retriedAs) warnings.push(`${k}: query fell back to "${r.retriedAs}" — count is whole-site, not used`)
        else if (r.siteIgnored) warnings.push(`${k}: Google ignored site:${site} (results are off-site) — count not used`)
        else sig[k] = r.organic.length < 10 && r.results_cnt > 1000 ? r.organic.length : r.results_cnt
      } catch (e) { warnings.push(`${k}: ${e.message}`) }
    }
  }
  const level = saturationLevel(sig)
  if (level === 'unknown') warnings.push('GitHub signal missing (rate limit or network) — saturation is UNKNOWN; set GITHUB_TOKEN or retry in a minute')
  return {
    keywords,
    level,
    signals: sig,
    github_top: topRepos,
    hn,
    serp_top: serpTop,
    method: 'GitHub repo count + top stars, HN story count + trend, Google result counts for site:devpost.com/software and site:producthunt.com/products (paid unless --free). Next: deep-read the 3 nearest competitors by hand.',
    warnings,
  }
}
