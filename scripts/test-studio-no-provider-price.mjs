// UX-01 (pre-promotion, PK rule: Studio never shows provider cost). Static proof over every .tsx under components/ and app/: no
// "Price per 1M" row, no per-token price wording, no call of the catalog's priceLabel() renderer, no "public list prices" note.
// The catalog JSON keeps its pricePerMillionTokens data (never rendered). Not flag-gated: an honesty fix applies everywhere. Plus mutants.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(dir, e.name))) : /\.tsx$/.test(e.name) ? [path.join(dir, e.name)] : [])
const FILES = [...walk('components'), ...walk('app')]
const BANNED = [/Price per 1M/i, /per 1M tokens/i, /\bpriceLabel\(/, /public list prices/i, /pricePerMillionTokens\.(input|output)\.toFixed[\s\S]{0,40}<\//]
const INTEL = ['components/studio-personal/intelligence-workspace.tsx', 'components/studio-personal/intelligence-p2.tsx', 'components/studio-personal/intelligence-model-choice.tsx']

function scan(read) {
  const hits = []
  for (const rel of FILES) {
    // priceLabel's own definition is internal data handling; only its use in markup counts
    const text = read(rel).replace(/export const priceLabel = [^\n]*\n/, '')
    for (const re of BANNED) if (re.test(text)) hits.push(`${rel}: ${re}`)
  }
  return hits
}
const disk = rel => fs.readFileSync(path.join(root, rel), 'utf8')
assert.ok(FILES.length > 50, 'scanned the app')
for (const rel of INTEL) assert.ok(FILES.includes(rel), `${rel} scanned`)
assert.deepEqual(scan(disk), [], 'no provider price renders')
let checks = FILES.length

// mutants: put each removed piece back in memory; the scan must catch every one
const MUTANTS = [
  ['workspace price row', INTEL[0], s => s.replace('<tr><th scope="row">Release status</th>', '<tr><th scope="row">Price per 1M tokens</th><td>{priceLabel(chosen)}</td></tr><tr><th scope="row">Release status</th>')],
  ['p2 price row', INTEL[1], s => s.replace('<tr><th scope="row">Release status</th>', '<tr><th scope="row">Price per 1M tokens</th><td>{priceLabel(chosen)}</td></tr><tr><th scope="row">Release status</th>')],
  ['model choice price cell', INTEL[2], s => s.replace('<tr><th scope="row">Release status</th>', '<tr><td>{cell(id => priceLabel(catalog.models[id]), current)}</td></tr><tr><th scope="row">Release status</th>')],
  ['list-price note', INTEL[1], s => s.replace('"Snapshot specifications only. Speed, quality, and live', '"Snapshot specifications and public list prices only. Speed, quality, and live')],
  ['per-token wording elsewhere', 'app/layout.tsx', s => s + '\n// <span>$0.50 per 1M tokens</span>\n'],
]
let killed = 0
for (const [name, rel, mutate] of MUTANTS) {
  const mutated = mutate(disk(rel)); assert.notEqual(mutated, disk(rel), `mutant applies: ${name}`)
  if (scan(r => r === rel ? mutated : disk(r)).length) killed++; else assert.fail(`mutant survived: ${name}`)
}
console.log(`no provider price: ${checks} files scanned clean, ${killed}/${MUTANTS.length} mutants killed`)
