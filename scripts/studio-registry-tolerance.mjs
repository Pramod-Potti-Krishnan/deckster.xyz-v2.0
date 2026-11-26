// PL-54 (Platform card, 26 Nov 2026): one generic tolerance for the registry-order pins, so a later change stops re-editing them.
// Three older proofs (scripts/test-studio-my-companions-wiring.mjs, scripts/test-studio-research-by-level.mjs, scripts/test-studio-upload-formats.mjs) pin "my strip / my block / my line is the last (but for the changes I name)" and hold
// files to the base's bytes. Every change registered after them used to turn them red until it edited them: it named its own strip, its scope files and its env block in each proof (PL-42 did it for three proofs, PL-19 and D-16
// had started to do it again). This helper replaces that, in a proof, with one call: the proof names the LAST change it knows by the file name of that change's registry line, and everything registered after that line is
// read OUT of what the proof sees:
//   - every read of a file goes through the strips registered after it (the registry's own order and its own contract: a strip returns a file it does not own untouched), then .env.example loses the env blocks registered
//     after it, and the registry file loses the lines registered after it (so "the line is at the true end of each list" is read as it was written);
//   - the registry's LATER_STRIPS and LATER_ENV_BLOCKS arrays are cut, IN PLACE, after the last known entry (the proofs assert what follows their own entry, by identity), so they are read as they stood when the proof was written;
//   - the files the later lines register (their scope modules, imported by the very names the registry rows give) are added to a set the proof's whole-range scope check already leaves out.
// Nothing else changes: the proof still holds its OWN change to its own checks. Plain node, no network, nothing is written. A registry row this helper cannot read, or a known anchor the registry lacks, THROWS (it never skips silently).
import fs from 'node:fs'
import path from 'node:path'

export const REGISTRY_REL = 'scripts/studio-later-changes.mjs'
export const REGISTRY_END_MARK = '// one line per later change, above this comment'
export const REGISTRY_LISTS = { files: 'LATER_CHANGE_FILES', env: 'LATER_ENV_BLOCKS', strips: 'LATER_STRIPS' }
const ROW = /^\s*(?:\.\.\.)?\(await import\('(\.\/[^']+)'\)\)\.(\w+),/

/** One registry list as rows: every line between `export const <list> = ` and the end comment that is neither blank nor a comment on its own. */
export function listRows(text, list) {
  const start = text.indexOf(`export const ${list} = `), end = start === -1 ? -1 : text.indexOf(REGISTRY_END_MARK, start)
  if (start === -1 || end === -1) throw new Error(`the registry has no ${list} list with its end comment`)
  const first = text.slice(0, start).split('\n').length - 1 // index of the line that opens the list
  const rows = []
  text.slice(start, end).split('\n').forEach((line, at) => {
    if (at === 0 || line.trim() === '' || line.trim().startsWith('//')) return
    const m = ROW.exec(line)
    rows.push({ line, index: first + at, module: m ? m[1] : null, name: m ? m[2] : null })
  })
  return rows
}

/** The rows of `list` that come after the row naming `anchor` (a file name, e.g. "studio-pl42-locked-copy-strip.mjs"). Throws when no row names it. */
export function laterRows(text, list, anchor) {
  const rows = listRows(text, list), at = rows.findIndex(row => row.line.includes(anchor))
  if (at === -1) throw new Error(`${list}: no row names ${anchor} (the last change this proof knows)`)
  const later = rows.slice(at + 1)
  const unreadable = later.filter(row => row.module === null)
  if (unreadable.length) throw new Error(`${list}: a row after ${anchor} is not in the registry's form "(await import('./x.mjs')).NAME,": ${unreadable[0].line.trim().slice(0, 120)}`)
  return later
}

/** The registry text without every row of the three lists that comes after its list's anchor. A list whose anchor is not in the text is left as it is. */
export function withoutLaterRows(text, anchors) {
  let out = text
  for (const [key, list] of Object.entries(REGISTRY_LISTS)) {
    let rows
    try { rows = listRows(out, list) } catch { continue }
    const at = rows.findIndex(row => row.line.includes(anchors[key]))
    if (at === -1) continue
    const drop = new Set(rows.slice(at + 1).map(row => row.index))
    out = out.split('\n').filter((_, index) => !drop.has(index)).join('\n')
  }
  return out
}

const lineStart = (text, at) => at === 0 || text[at - 1] === '\n'
const lineEnd = (text, at) => at === text.length || text[at] === '\n'
/** .env.example without the given blocks, exactly as the registry's own stripLaterEnvBlocks takes a block out (the block and the one blank line that separates it from its neighbour; only a whole block, at the start of a line). */
export function withoutEnvBlocks(text, blocks) {
  let out = text
  for (const registered of blocks) {
    const block = String(registered).replace(/^\n+/, '').replace(/\n+$/, '')
    if (block === '') continue
    let at = out.indexOf(block)
    while (at !== -1 && !(lineStart(out, at) && lineEnd(out, at + block.length))) at = out.indexOf(block, at + 1)
    if (at === -1) continue
    const before = out.slice(0, at), after = out.slice(at + block.length)
    if (/^\n*$/.test(after)) out = before.endsWith('\n\n') ? before.slice(0, -1) : before
    else if (after.startsWith('\n\n')) out = before + after.slice(2)
    else out = before + after.slice(1)
  }
  return out
}

/**
 * Read everything registered after `known` out of the calling proof (see the header). Call it ONCE, with `await`, right after the proof defines its `read` and BEFORE it installs its own read hooks (this hook is then the
 * innermost, as the registry's own stripLaterChanges is, and the proof's hooks for the changes it names run on what is left).
 *   registry   the namespace of scripts/studio-later-changes.mjs the proof imported
 *   root       the repository root the proof reads from
 *   known      the file name of the last change's registry row the proof names, per list: { files, env, strips }
 *   scopeSink  an optional Set the proof's whole-range scope check already leaves out; the later changes' scope files are added to it
 * Returns { laterStrips, laterBlocks, laterScopeFiles, laterLines } (what it read out).
 */
export async function tolerateLaterChanges({ registry, root, known, scopeSink }) {
  for (const key of Object.keys(REGISTRY_LISTS)) if (typeof known?.[key] !== 'string' || known[key] === '') throw new Error(`known.${key}: name the last known change's file`)
  const realRead = fs.readFileSync
  const registryText = realRead.call(fs, path.join(root, REGISTRY_REL), 'utf8')
  const later = Object.fromEntries(Object.entries(REGISTRY_LISTS).map(([key, list]) => [key, laterRows(registryText, list, known[key])]))
  const take = (array, rows, what) => {
    if (rows.length === 0) return []
    if (array.length < rows.length) throw new Error(`${what}: ${rows.length} later rows but only ${array.length} entries`)
    const entries = array.slice(array.length - rows.length)
    entries.forEach((entry, i) => { if (typeof entry === 'function' && entry.name !== rows[i].name) throw new Error(`${what}: the entry ${entry.name} is not the row's ${rows[i].name}`) })
    array.length = array.length - rows.length // cut IN PLACE: the proof asserts what follows its own entry, by identity
    return entries
  }
  const laterStrips = take(registry.LATER_STRIPS, later.strips, 'LATER_STRIPS')
  const laterBlocks = take(registry.LATER_ENV_BLOCKS, later.env, 'LATER_ENV_BLOCKS')
  const laterScopeFiles = new Set()
  for (const row of later.files) { const found = (await import(new URL(row.module, import.meta.url).href))[row.name]; if (found == null || typeof found[Symbol.iterator] !== 'function') throw new Error(`LATER_CHANGE_FILES: ${row.module} exports no list called ${row.name}`); for (const rel of found) laterScopeFiles.add(rel) }
  if (scopeSink) for (const rel of laterScopeFiles) scopeSink.add(rel)
  fs.readFileSync = function (file, ...rest) {
    const out = realRead.call(this, file, ...rest)
    if (typeof out !== 'string' || typeof file !== 'string') return out
    const rel = path.relative(root, file)
    let text = out
    for (const strip of laterStrips) { const next = strip(rel, text); if (typeof next === 'string') text = next }
    if (rel === '.env.example') text = withoutEnvBlocks(text, laterBlocks)
    if (rel === REGISTRY_REL) text = withoutLaterRows(text, known)
    return text
  }
  return { laterStrips, laterBlocks, laterScopeFiles, laterLines: Object.values(later).flat().map(row => row.line) }
}
