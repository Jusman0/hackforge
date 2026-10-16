// Deterministic mock of the Claude Code Workflow runtime, for testing workflow scripts offline.
// Runs the script body inside a vm context where Date.now(), Math.random() and argless new Date() throw
// (as in the real runtime), and agent() is answered by a test-supplied handler.
import fs from 'node:fs'
import vm from 'node:vm'

class SafeDate extends Date {
  constructor(...a) {
    if (!a.length) throw new Error('new Date() without arguments is forbidden in workflow scripts')
    super(...a)
  }
  static now() {
    throw new Error('Date.now() is forbidden in workflow scripts')
  }
}
const SafeMath = Object.create(Math)
SafeMath.random = () => {
  throw new Error('Math.random() is forbidden in workflow scripts')
}

export function loadWorkflow(file) {
  const src = fs.readFileSync(file, 'utf8')
  if (!src.startsWith('export const meta = {')) throw new Error(`${file}: must start with "export const meta = {"`)
  const end = src.indexOf('\n}\n')
  if (end < 0) throw new Error(`${file}: cannot find end of meta literal`)
  const metaSrc = src.slice('export const meta = '.length, end + 2)
  if (/\$\{|`/.test(metaSrc)) throw new Error(`${file}: meta must be a pure literal (no template strings)`)
  const meta = vm.runInNewContext('(' + metaSrc + ')')
  const body = src.slice(end + 3)
  return { meta, body, file }
}

export function makeRuntime(handler) {
  const calls = []
  const logs = []
  const phases = []
  const agent = async (prompt, opts = {}) => {
    if (typeof prompt !== 'string' || !prompt) throw new Error('agent() needs a prompt string')
    calls.push({ label: opts.label, prompt, opts })
    const res = await handler(opts.label || '', prompt, opts, calls.length)
    if (res === undefined) throw new Error(`mock handler returned undefined for ${opts.label}`)
    if (res !== null && opts.schema) checkRequired(opts.schema, res, opts.label)
    return res
  }
  const parallel = async thunks => {
    if (!Array.isArray(thunks)) throw new Error('parallel() needs an array of thunks')
    return Promise.all(thunks.map(t => Promise.resolve().then(t).catch(() => null)))
  }
  const pipeline = async (items, ...stages) =>
    Promise.all(items.map(async (item, i) => {
      let v = item
      try {
        for (const [si, s] of stages.entries()) v = await s(si === 0 ? item : v, item, i)
        return v
      } catch {
        return null
      }
    }))
  const phase = t => phases.push(t)
  const log = m => logs.push(m)
  const budget = { total: null, spent: () => 0, remaining: () => Infinity }
  return { agent, parallel, pipeline, phase, log, budget, calls, logs, phases }
}

// Minimal schema check: required keys present at each object level (enough to catch handler/schema drift).
function checkRequired(schema, val, label, path = '$') {
  if (!schema || val == null) return
  if (schema.type === 'object') {
    for (const k of schema.required || []) {
      if (!(k in val)) throw new Error(`${label}: mock result missing required ${path}.${k}`)
    }
    for (const [k, sub] of Object.entries(schema.properties || {})) if (k in val) checkRequired(sub, val[k], label, `${path}.${k}`)
  } else if (schema.type === 'array' && Array.isArray(val)) {
    val.forEach((v, i) => checkRequired(schema.items, v, label, `${path}[${i}]`))
  }
}

export async function runWorkflow(wf, rt, args) {
  const ctx = vm.createContext({ Date: SafeDate, Math: SafeMath, JSON, Number, String, Array, Object, Set, Map, Promise, Error, Boolean, RegExp, Infinity, NaN, console })
  const fn = vm.runInContext(`(async function (agent, parallel, pipeline, phase, log, args, budget, workflow) {\n${wf.body}\n})`, ctx, { filename: wf.file })
  return fn(rt.agent, rt.parallel, rt.pipeline, rt.phase, rt.log, args, rt.budget, async () => { throw new Error('workflow() not mocked') })
}

// Extract the JSON array that follows a marker like "Ideas: " in a prompt (bracket matching).
export function jsonAfter(prompt, marker) {
  const i = prompt.lastIndexOf(marker)
  if (i < 0) return null
  const start = prompt.indexOf('[', i)
  let depth = 0
  let inStr = false
  for (let j = start; j < prompt.length; j++) {
    const ch = prompt[j]
    if (inStr) {
      if (ch === '\\') j++
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') {
      depth--
      if (depth === 0) return JSON.parse(prompt.slice(start, j + 1))
    }
  }
  return null
}
