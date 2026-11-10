// Canonical serialisation + snapshot-directory comparison used by the transcript runner.
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export const sha256 = text => crypto.createHash('sha256').update(text).digest('hex')

// JSON-able, key-sorted, cycle-safe. Functions become "[fn]" so presence is recorded, not identity.
export function canonical(value, seen = new WeakSet()) {
  if (value === null) return null
  switch (typeof value) {
    case 'undefined': return undefined
    case 'function': return '[fn]'
    case 'symbol': return value.toString()
    case 'bigint': return `${value}n`
    case 'number': return Number.isFinite(value) ? value : String(value)
    case 'string': case 'boolean': return value
  }
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  let out
  if (value instanceof Date) out = value.toISOString()
  else if (Array.isArray(value)) out = value.map(item => { const c = canonical(item, seen); return c === undefined ? null : c })
  else if (value instanceof Set) out = { '[set]': [...value].map(item => canonical(item, seen)) }
  else if (value instanceof Map) out = { '[map]': [...value].map(([k, v]) => [canonical(k, seen), canonical(v, seen)]) }
  else if (value instanceof Error || (typeof value.message === 'string' && typeof value.name === 'string' && 'stack' in value)) {
    out = { '[error]': value.name, message: String(value.message) }
    for (const key of Object.keys(value).sort()) if (key !== 'stack') { const c = canonical(value[key], seen); if (c !== undefined) out[key] = c }
  } else {
    out = {}
    for (const key of Object.keys(value).sort()) { const c = canonical(value[key], seen); if (c !== undefined) out[key] = c }
  }
  seen.delete(value)
  return out
}

// Stable, diff-friendly JSON: small arrays/objects stay on one line, larger ones are indented.
function render(value, indent, width) {
  const flat = JSON.stringify(value)
  if (flat === undefined) return 'null'
  if (flat.length <= width || value === null || typeof value !== 'object') return flat
  const pad = ' '.repeat(indent + 2)
  if (Array.isArray(value)) return `[\n${value.map(item => pad + render(item, indent + 2, width)).join(',\n')}\n${' '.repeat(indent)}]`
  return `{\n${Object.keys(value).map(key => `${pad}${JSON.stringify(key)}: ${render(value[key], indent + 2, width)}`).join(',\n')}\n${' '.repeat(indent)}}`
}
export const pretty = (value, width = 110) => `${render(canonical(value), 0, width)}\n`
export const prettyHtml = markup => `${markup.replace(/></g, '>\n<')}\n`

// A snapshot is a map of relative path -> text. It is written to / read from a directory
// so that a failure can be shown as an ordinary `git diff`.
export function writeSnapshot(dir, files) {
  fs.rmSync(dir, { recursive: true, force: true })
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
  }
}

export function readSnapshot(dir) {
  const files = {}
  if (!fs.existsSync(dir)) return files
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const next = path.join(rel, entry.name)
      if (entry.isDirectory()) walk(next)
      else files[next.split(path.sep).join('/')] = fs.readFileSync(path.join(dir, next), 'utf8')
    }
  }
  walk('')
  return files
}

export const isMarkupFile = name => name.startsWith('markup/') || name === 'markup.json'

// Returns [{file, kind: 'changed'|'missing'|'extra'}]; `skip` filters out whole file classes.
export function compareSnapshots(expected, actual, { skip = () => false } = {}) {
  const names = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort().filter(name => !skip(name))
  const diffs = []
  for (const name of names) {
    if (!(name in actual)) diffs.push({ file: name, kind: 'missing' })
    else if (!(name in expected)) diffs.push({ file: name, kind: 'extra' })
    else if (expected[name] !== actual[name]) diffs.push({ file: name, kind: 'changed' })
  }
  return diffs
}

// Unified diff via `git diff --no-index` (git is already a dependency of the repo's tests).
export function renderDiff(name, expectedText = '', actualText = '', maxLines = 60) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-harness-diff-'))
  try {
    const a = path.join(dir, 'baseline'), b = path.join(dir, 'actual')
    fs.writeFileSync(a, expectedText)
    fs.writeFileSync(b, actualText)
    const run = spawnSync('git', ['diff', '--no-index', '--no-color', '--no-ext-diff', '-U2', '--', a, b], { encoding: 'utf8' })
    const body = (run.stdout || '').split('\n').filter(line => !/^(diff --git|index |--- |\+\+\+ )/.test(line))
    const shown = body.slice(0, maxLines)
    const more = body.length - shown.length
    return [`  ${name}`, ...shown.map(line => `    ${line}`), ...(more > 0 ? [`    ... ${more} more diff lines (use --full)`] : [])].join('\n')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// outbound.ndjson holds one very long line per socket send; a line diff buries the one
// changed field. Explain each differing entry by its first differing byte with context.
export function explainOutbound(expectedText = '', actualText = '', limit = 8) {
  const parse = text => text.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line) } catch { return { kind: 'unparsable', bytes: line } } })
  const a = parse(expectedText), b = parse(actualText)
  const out = [`  outbound.ndjson: baseline has ${a.length} entries, this run produced ${b.length}`]
  const context = (text, at) => `${at > 70 ? '...' : ''}${text.slice(Math.max(0, at - 70), at + 70)}${at + 70 < text.length ? '...' : ''}`
  let shown = 0
  for (let i = 0; i < Math.max(a.length, b.length) && shown < limit; i++) {
    const x = a[i], y = b[i]
    if (JSON.stringify(x) === JSON.stringify(y)) continue
    shown++
    const label = `#${i} ${(y || x).kind}${(y || x).socket !== undefined ? ` socket ${(y || x).socket}` : ''}${(y || x).at !== undefined ? ` at +${(y || x).at}ms` : ''}`
    if (!x) { out.push(`    ${label}: NEW entry not in the baseline: ${String(y.bytes ?? y.url ?? '').slice(0, 160)}`); continue }
    if (!y) { out.push(`    ${label}: MISSING, the baseline sent ${String(x.bytes ?? x.url ?? '').slice(0, 160)}`); continue }
    const xb = String(x.bytes ?? x.url ?? JSON.stringify(x)), yb = String(y.bytes ?? y.url ?? JSON.stringify(y))
    let at = 0
    while (at < xb.length && at < yb.length && xb[at] === yb[at]) at++
    const timing = x.at !== y.at || x.socket !== y.socket || x.kind !== y.kind ? ` (kind ${x.kind}->${y.kind}, socket ${x.socket}->${y.socket}, at ${x.at}->${y.at})` : ''
    out.push(`    ${label}: bytes differ at offset ${at} (${xb.length} -> ${yb.length} bytes)${timing}`)
    out.push(`      baseline: ${context(xb, at)}`)
    out.push(`      actual:   ${context(yb, at)}`)
  }
  if (shown === limit) out.push('    ... more differing entries (use --full to see the raw line diff)')
  return out.join('\n')
}
