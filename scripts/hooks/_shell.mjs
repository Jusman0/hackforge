// Lightweight shell-command analysis for the guard hooks. Not a full shell parser — just enough to see
// through quoting, chaining, continuations, wrappers (bash -c, eval, subshells, if/then, xargs), env
// prefixes and git's global options, which is where naive regexes fail. Handles PowerShell basics too.

// Join line continuations (bash `\` and PowerShell backtick) so one logical command stays one segment.
function joinContinuations(cmd) {
  return String(cmd).replace(/\\\r?\n/g, ' ').replace(/`\r?\n/g, ' ')
}

// Replace quoted strings and heredoc bodies with placeholders so commit messages ("never use -n") and
// echoed text never trigger rules. Returns the stripped command plus the quoted pieces.
export function stripQuoted(cmd) {
  const quoted = []
  // bash idiom 'don'\''t' → keep it one quoted word
  let s = joinContinuations(cmd).replace(/'\\''/g, '\u2019')
  // heredocs: keep the rest of the opening line (redirects, pipes) in the command; hide only the body.
  s = s.replace(/<<-?\s*(['"]?)(\w+)\1([^\n]*)\n([\s\S]*?)\n[ \t]*\2(?=\s|$)/g, (_, q, tag, rest, body) => {
    quoted.push(body)
    return `<<__HEREDOC${quoted.length - 1}__${rest}`
  })
  s = s.replace(/'([^']*)'|"((?:[^"\\]|\\.)*)"/g, (m, a, b) => {
    quoted.push(a ?? b)
    return `__Q${quoted.length - 1}__`
  })
  return { stripped: s, quoted }
}

const KEYWORDS = new Set(['then', 'do', 'else', 'elif', 'if', 'while', 'until', '!', 'time', 'function'])

// Split on && || ; | & newlines and grouping chars (outside quotes — call on the stripped command).
export function segments(stripped) {
  return stripped
    .split(/&&|\|\||[;|&\n(){}]/)
    .map(x => {
      let t = x.trim()
      for (;;) {
        const m = t.match(/^(\S+)\s+/)
        if (m && KEYWORDS.has(m[1])) t = t.slice(m[0].length)
        else break
      }
      return KEYWORDS.has(t) ? '' : t
    })
    .filter(x => x && !/^(fi|done|esac|end)$/.test(x))
}

export function tokens(segment) {
  return segment.split(/\s+/).filter(Boolean)
}

export const unquoteWith = quoted => t => t.replace(/__Q(\d+)__/g, (_, i) => quoted[Number(i)] ?? '')

// All commands to analyse: the top level plus bodies of `bash|sh|zsh -c "<cmd>"`, `eval "<cmd>"` and
// heredocs fed to a shell (`bash <<EOF`). Depth-limited.
export function expandCommands(cmd, depth = 0) {
  const top = stripQuoted(cmd)
  const out = [top]
  if (depth >= 3) return out
  for (const seg of segments(top.stripped)) {
    const m = seg.match(/^(?:\S*\/)?(?:bash|sh|zsh|dash)\s+(?:-\w+\s+)*-\w*c\w*\s+__Q(\d+)__/) || seg.match(/^eval\s+__Q(\d+)__/)
    if (m) out.push(...expandCommands(top.quoted[Number(m[1])] || '', depth + 1))
    const h = seg.match(/^(?:\S*\/)?(?:bash|sh|zsh|dash)(?:\s+-\w+)*\s*<<__HEREDOC(\d+)__/)
    if (h) out.push(...expandCommands(top.quoted[Number(h[1])] || '', depth + 1))
  }
  return out
}

const GIT_GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--exec-path', '--super-prefix', '--list-cmds'])
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/
const WRAPPERS = new Set(['command', 'exec', 'sudo', 'env', 'nice', 'time', 'nohup', 'builtin', 'xargs', 'doas', 'stdbuf', 'timeout'])

// Parse one segment as a git invocation. Returns null if the segment does not run git.
// { env: {K: V}, dir, configs: ['k=v'], configEnv: ['k=VAR'], sub, args: [] (unquoted), rawArgs }
export function parseGit(segment, quoted = []) {
  const unq = unquoteWith(quoted)
  const t = tokens(segment)
  const env = {}
  let i = 0
  for (;;) {
    while (i < t.length && ENV_ASSIGN.test(t[i])) {
      const [k, ...v] = t[i].split('=')
      env[k] = unq(v.join('='))
      i++
    }
    if (i < t.length && WRAPPERS.has(t[i])) {
      const w = t[i++]
      // wrapper options (xargs -I {} -n 1, timeout 30, env -i, sudo -u x)
      while (i < t.length && (t[i].startsWith('-') || (w === 'timeout' && /^\d/.test(t[i])))) {
        if (/^-(I|n|P|u|L|s)$/.test(t[i])) i++
        i++
      }
      continue
    }
    break
  }
  const head = unq(t[i] || '').replace(/^\\/, '')
  if (!/(^|[\\/])git(\.exe)?$/i.test(head)) return null
  i++
  const out = { env, dir: null, configs: [], configEnv: [], sub: null, args: [] }
  while (i < t.length && t[i].startsWith('-')) {
    const tok = t[i]
    const [flag, inline] = tok.includes('=') && tok.startsWith('--') ? [tok.slice(0, tok.indexOf('=')), tok.slice(tok.indexOf('=') + 1)] : [tok, null]
    if (GIT_GLOBAL_WITH_VALUE.has(flag)) {
      const val = unq(inline ?? t[++i] ?? '')
      if (flag === '-C') out.dir = val
      if (flag === '-c') out.configs.push(val)
      if (flag === '--config-env') out.configEnv.push(val)
    }
    i++
  }
  out.sub = unq(t[i] || '') || null
  out.rawArgs = t.slice(i + 1)
  out.args = out.rawArgs.map(unq)
  return out
}

// Short-option cluster check that respects value-taking letters: in `git commit -mnew`, "new" is the message.
export function clusterHas(tok, letter, valueLetters = '') {
  if (!/^-[A-Za-z]+$/.test(tok)) return false
  for (const ch of tok.slice(1)) {
    if (ch === letter) return true
    if (valueLetters.includes(ch)) return false
  }
  return false
}

export const PLACEHOLDER_ENV_RE = /(^|\/)\.env\.(example|sample|template|dist)$/
export const ENV_PATH_RE = /(^|\/)\.env(\.[\w.-]+)?$/
export const isEnvPath = p => ENV_PATH_RE.test(p) && !PLACEHOLDER_ENV_RE.test(p)
export const BROAD_PATHSPEC = new Set(['.', '-A', '--all', ':/', '*', ':', '-u', '--update'])

// ---- write detection (judge files / state.json) ----
const PS_WRITE = /^(set-content|sc|add-content|ac|out-file|remove-item|ri|del|erase|rd|rmdir|copy-item|copy|cpi|move-item|move|mi|new-item|ni|clear-content|clc|rename-item|ren|rni)$/i
const DEST_ONLY = new Set(['cp', 'install', 'ln', 'copy-item', 'copy', 'cpi'])
const ALL_ARGS = new Set(['rm', 'unlink', 'truncate', 'tee', 'mv', 'shred', 'chmod', 'touch'])
const WRITE_API_RE = /writeFile|appendFile|createWriteStream|unlink|rmSync|renameSync|copyFileSync|open\([^)]*['"][wa]\+?['"]|json\.dump\(|\.write\(|write_text|os\.remove|shutil\.(move|copy)|truncate/

// For one (quote-restored) segment: which path-like arguments may be written?
// Redirect targets always; cp/install/ln → destination only; mv/rm/tee/… → every argument;
// sed/perl -i (any spelling) → file arguments; PowerShell write cmdlets → -Path/-Destination/positional;
// node -e / python -c → only when the inline code calls a write API.
export function writtenPaths(seg) {
  const out = []
  const re = /\d?(?:>>?|&>)\s*([^\s&|;<>]+)/g
  let m
  while ((m = re.exec(seg))) out.push(m[1])
  const t = tokens(seg)
  const w = (t[0] || '').replace(/^.*[\\/]/, '').toLowerCase()
  const nonFlag = t.slice(1).filter(a => !a.startsWith('-'))
  if (DEST_ONLY.has(w)) {
    const dest = t.find((a, i) => /^-destination$/i.test(t[i - 1] || '')) || nonFlag[nonFlag.length - 1]
    if (dest) out.push(dest)
  } else if (ALL_ARGS.has(w)) out.push(...nonFlag)
  else if ((w === 'sed' || w === 'perl') && t.some(a => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'))) out.push(...nonFlag)
  else if (PS_WRITE.test(w)) out.push(...t.slice(1).filter(a => !a.startsWith('-')))
  else if (w === 'git' && /^(checkout|restore|rm|mv)$/.test(t[1] || '')) out.push(...t.slice(2).filter(a => !a.startsWith('-')))
  else if (/^(node|python3?|ruby|perl|deno|bun)$/.test(w) && WRITE_API_RE.test(seg)) out.push(...(seg.match(/[\w./\\-]*(?:\.hackforge|golden-path|tsconfig|eslint|prettier|playwright|vitest|jest|biome|pyproject|pytest)[\w./\\-]*/g) || []))
  return out.map(p => p.replace(/\\/g, '/').replace(/^['"]|['"]$/g, ''))
}
