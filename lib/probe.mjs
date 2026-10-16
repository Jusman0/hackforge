// `hackforge probe <url>` — is this URL what a judge will see? Follows redirects by hand and fails on
// auth walls (Vercel deployment protection, SSO, /login redirects) and non-200 endings.
import dns from 'node:dns/promises'
import net from 'node:net'

const AUTH_HOST_RE = /(^|\.)(vercel\.com|accounts\.google\.com|login\.microsoftonline\.com|auth0\.com|okta\.com)$/i
const AUTH_PATH_RE = /\/(login|signin|sign-in|sso|auth|oauth|_vercel\/sso)(\/|\?|$)/i
const LOCAL_HOST_RE = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|.*\.home\.arpa)$/i

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  if (net.isIPv6(ip)) return /^(::1|::|fe80:|fc|fd)/i.test(ip) || ip.startsWith('::ffff:') && isPrivateIp(ip.slice(7))
  return false
}

// Judges cannot reach localhost / LAN addresses.
async function localProblem(u) {
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (LOCAL_HOST_RE.test(host)) return `${host} is a local address — judges can't reach it; use the public production URL`
  if (net.isIP(host)) return isPrivateIp(host) ? `${host} is a private/loopback IP — not reachable by judges` : null
  try {
    const addrs = await dns.lookup(host, { all: true })
    if (addrs.length && addrs.every(a => isPrivateIp(a.address))) return `${host} resolves only to private addresses (${addrs[0].address}) — not reachable by judges`
  } catch {
    return `${host} does not resolve (DNS lookup failed)`
  }
  return null
}

// Video hosts answer 200 even for private or missing videos; their oEmbed endpoints tell them apart.
const OEMBED = [
  { re: /(^|\.)(youtube\.com|youtu\.be)$/i, api: u => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}` },
  { re: /(^|\.)vimeo\.com$/i, api: u => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}` },
  { re: /(^|\.)loom\.com$/i, api: u => `https://www.loom.com/v1/oembed?url=${encodeURIComponent(u)}` },
]

async function oembedCheck(u, timeoutMs) {
  const o = OEMBED.find(x => x.re.test(u.hostname))
  if (!o) return null
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(o.api(u.href), { signal: ctrl.signal })
    if (res.status === 200) {
      const j = await res.json().catch(() => ({}))
      return { ok: true, url: u.href, video: true, title: j.title || null, author: j.author_name || null }
    }
    const why = res.status === 401 || res.status === 403 ? 'private (only public or unlisted videos are viewable by judges)' : res.status === 400 || res.status === 404 ? 'not found (check the link / video id)' : `oEmbed HTTP ${res.status}`
    return { ok: false, url: u.href, video: true, problem: `video is ${why}` }
  } catch (e) {
    return { ok: false, url: u.href, video: true, problem: `could not verify video (${e.name === 'AbortError' ? 'timeout' : e.message})` }
  } finally {
    clearTimeout(t)
  }
}

export async function probeUrl(url, { maxRedirects = 6, timeoutMs = 15000 } = {}) {
  let current
  try {
    current = new URL(url)
  } catch {
    return { ok: false, url, problem: 'invalid URL' }
  }
  if (!/^https?:$/.test(current.protocol)) return { ok: false, url, problem: `unsupported scheme ${current.protocol}` }
  // HackForge never fetches devpost.com (ToS forbids automated access): record, don't probe.
  if (/(^|\.)devpost\.com$/i.test(current.hostname)) return { ok: true, url, skipped: 'devpost.com is not fetched (ToS) — confirm the page by hand in a logged-out window' }
  // HACKFORGE_PROBE_ALLOW_LOCAL=1 is for HackForge's own tests (loopback test servers) only.
  const allowLocal = process.env.HACKFORGE_PROBE_ALLOW_LOCAL === '1'
  const local = allowLocal ? null : await localProblem(current)
  if (local) return { ok: false, url, problem: local }
  const video = await oembedCheck(current, timeoutMs)
  if (video) return video
  const chain = []
  const started = Date.now()
  for (let i = 0; i <= maxRedirects; i++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    let res
    try {
      res = await fetch(current, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 hackforge-probe (judge view; no cookies)' } })
    } catch (e) {
      clearTimeout(t)
      return { ok: false, url, chain, problem: e.name === 'AbortError' ? `timeout after ${timeoutMs / 1000}s` : `unreachable: ${e.message}` }
    }
    chain.push({ url: current.href, status: res.status })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      clearTimeout(t)
      current = new URL(res.headers.get('location'), current)
      const redirLocal = allowLocal ? null : await localProblem(current)
      if (redirLocal) return { ok: false, url, chain, problem: `redirects to ${current.href}: ${redirLocal}` }
      if (AUTH_HOST_RE.test(current.hostname) || AUTH_PATH_RE.test(current.pathname)) {
        return { ok: false, url, chain: [...chain, { url: current.href, status: 'redirect' }], problem: `redirects to a login/auth page (${current.hostname}${current.pathname}) — judges will hit an auth wall. On Vercel give the production alias/custom domain, not the deployment hash URL, or turn off deployment protection.` }
      }
      continue
    }
    const ms = Date.now() - started
    let body = ''
    if (res.status === 200) {
      // Read at most ~20 KB under the same deadline (a streaming/slow body must not hang the probe).
      try {
        const reader = res.body.getReader()
        const chunks = []
        let size = 0
        while (size < 20000) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          size += value.length
        }
        reader.cancel().catch(() => {})
        body = Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8')
      } catch (e) {
        if (e.name === 'AbortError') { clearTimeout(t); return { ok: false, url, chain, problem: `body read timed out after ${timeoutMs / 1000}s` } }
      }
    }
    clearTimeout(t)
    if (res.status === 401 || res.status === 403) return { ok: false, url, chain, problem: `HTTP ${res.status} — not public` }
    if (res.status !== 200) return { ok: false, url, chain, problem: `HTTP ${res.status}` }
    if (/vercel authentication|deployment protection|sign in to vercel|log in to continue/i.test(body)) {
      return { ok: false, url, chain, problem: 'page body is a login/protection screen' }
    }
    return { ok: true, url, finalUrl: current.href, chain, ms, title: (body.match(/<title[^>]*>([^<]{0,120})/i) || [])[1]?.trim() || null }
  }
  return { ok: false, url, chain, problem: `more than ${maxRedirects} redirects` }
}
