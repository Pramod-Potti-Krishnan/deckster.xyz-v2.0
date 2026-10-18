// PASS2D R1 (FRONTEND-1): a session row the pre-#389 build saved with Director's untouched blank deck in its FINAL slots too is restored as the blank deck it is, so it no longer opens as
// "What would you like to change? · 1 slide" over a bare navy slide. Flag NEXT_PUBLIC_STUDIO_BLANK_DECK_LEGACY_ROWS (exact "true"), default off. In memory only: nothing is written.
//   Bisect (scripts/ + the PR): #389 (BLANK_DECK_RELOAD_FIX) stopped writing such rows, so a session started after it restores clean; the rows saved before it stay broken, and that is this change.
//
// Run: node scripts/test-studio-legacy-blank-deck-row.mjs   (plain node: transpile + vm, no network, no browser, no env)
//
// Proven on the REAL sources: lib/studio-legacy-blank-deck-row.ts and hooks/use-builder-session.ts:
//   1. the helper over the whole product of row shapes (blank deck, final slots, strawman, stage, count) against an independent oracle;
//   2. the restore expression, cut out of the real hook and run over those rows: flag off the restored state is the row's own, field for field; flag on a legacy row loses only its final
//      slots (the presentation falls back to the blank deck) and every other row is the same as with the flag off;
//   3. the wiring: the flag is read once, exact "true"; the helper is applied to the loaded row only; nothing is written (no fetch, no persistence call in the added lines);
//   4. mutation check: every mutant of the helper and the hook is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const LIB = 'lib/studio-legacy-blank-deck-row.ts'
const HOOK = 'hooks/use-builder-session.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_BLANK_DECK_LEGACY_ROWS'
const SOURCES = { [LIB]: read(LIB), [HOOK]: read(HOOK) }

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)
const json = count((a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m))

const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
function loadLib(source, on) {
  const mod = { exports: {} }
  vm.runInNewContext(compile(source, LIB), { module: mod, exports: mod.exports, process: { env: on ? { [FLAG]: 'true' } : {} } })
  return mod.exports
}

// ---------------------------------------------------------------- 1. the helper
const BLANK = { url: 'http://l/p/blank-1', id: 'blank-1' }
const OTHER = { url: 'http://l/p/other-9', id: 'other-9' }
const blanks = [{ url: BLANK.url, id: BLANK.id }, { url: BLANK.url, id: null }, { url: null, id: BLANK.id }, { url: '', id: BLANK.id }, { url: BLANK.url, id: '  ' }, { url: null, id: null }]
const finals = [{ url: null, id: null }, { url: BLANK.url, id: BLANK.id }, { url: BLANK.url, id: null }, { url: null, id: BLANK.id }, { url: OTHER.url, id: OTHER.id }, { url: BLANK.url, id: OTHER.id }, { url: OTHER.url, id: BLANK.id }, { url: '', id: '' }]
const strawmen = [{ url: null, id: null }, { url: 'http://l/p/s1', id: 's1' }, { url: 'http://l/p/s1', id: null }, { url: null, id: 's1' }]
const stages = [undefined, null, 0, 1, 4, 6, '0']
const counts = [undefined, null, 0, 1, 2, 30, -1, '1', 1.5]
const row = (b, f, s, stage, slideCount) => ({ blankPresentationUrl: b.url, blankPresentationId: b.id, finalPresentationUrl: f.url, finalPresentationId: f.id, strawmanPreviewUrl: s.url, strawmanPresentationId: s.id, currentStage: stage, slideCount })
const str = v => typeof v === 'string' && v.trim() !== '' ? v : null
function oracle(r) {
  if (!r || typeof r !== 'object') return false
  const bu = str(r.blankPresentationUrl), bi = str(r.blankPresentationId), fu = str(r.finalPresentationUrl), fi = str(r.finalPresentationId)
  if (!bu || !bi) return false
  if (str(r.strawmanPreviewUrl) || str(r.strawmanPresentationId)) return false
  if (!fu && !fi) return false
  if ((fu && fu !== bu) || (fi && fi !== bi)) return false
  if (!(r.currentStage === undefined || r.currentStage === null || r.currentStage === 0)) return false
  if (!(r.slideCount === undefined || r.slideCount === null || (typeof r.slideCount === 'number' && r.slideCount >= 0 && r.slideCount <= 1))) return false
  return true
}
function proveLib(libSource, label = 'lib') {
  const lib = loadLib(libSource, true)
  let legacy = 0, total = 0
  for (const b of blanks) for (const f of finals) for (const s of strawmen) for (const stage of stages) for (const slideCount of counts) {
    const r = row(b, f, s, stage, slideCount)
    const got = lib.isLegacyBlankDeckRow(r), want = oracle(r)
    total++; if (want) legacy++
    if (got !== want) assert.fail(`${label}: ${JSON.stringify(r)}: got ${got}, want ${want}`)
  }
  checks += total
  ok(legacy > 0 && legacy < total / 20, `${label}: the grid has legacy rows (${legacy}) and plenty that are not (${total})`)
  const base = row(blanks[0], finals[1], strawmen[0], 0, 1)
  eq(lib.isLegacyBlankDeckRow(base), true, `${label}: the pre-#389 row`)
  eq(lib.isLegacyBlankDeckRow({ ...base, currentStage: 6, slideCount: 8 }), false, `${label}: a finished deck is not`)
  eq(lib.isLegacyBlankDeckRow({ ...base, slideCount: 2 }), false, `${label}: a second slide makes it a real deck`)
  eq(lib.isLegacyBlankDeckRow({ ...base, finalPresentationUrl: OTHER.url, finalPresentationId: OTHER.id }), false, `${label}: another final deck is not`)
  eq(lib.isLegacyBlankDeckRow({ ...row(blanks[5], finals[4], strawmen[0], 6, 8) }), false, `${label}: a built deck with no blank deck is not`)
  for (const bad of [null, undefined, 0, 'x', [], true]) eq(lib.isLegacyBlankDeckRow(bad), false, `${label}: ${JSON.stringify(bad)} is not a row`)
  eq(lib.STUDIO_BLANK_DECK_LEGACY_ROWS_ENABLED, true, `${label}: flag "true" is on`)
  for (const value of ['false', '', '1', 'TRUE', ' true', 'true ', 'yes']) { const m = { exports: {} }; vm.runInNewContext(compile(libSource, LIB), { module: m, exports: m.exports, process: { env: { [FLAG]: value } } }); eq(m.exports.STUDIO_BLANK_DECK_LEGACY_ROWS_ENABLED, false, `${label}: ${JSON.stringify(value)} is off`) }
  eq(loadLib(libSource, false).STUDIO_BLANK_DECK_LEGACY_ROWS_ENABLED, false, `${label}: unset is off`)
}

// ---------------------------------------------------------------- 2. the restore, cut out of the real hook
const GUARD_START = '            // NEXT_PUBLIC_STUDIO_BLANK_DECK_LEGACY_ROWS: a row the pre-#389'
const LITERAL_START = '            const restoredSessionState = {'
const LITERAL_END = '            if (LAYOUT_URL_CONFIG_ERROR && restoredSessionState.presentationUrl)'
function blocks(hookSource) {
  const g = hookSource.indexOf(GUARD_START), l = hookSource.indexOf(LITERAL_START), e = hookSource.indexOf(LITERAL_END)
  assert.ok(g > 0 && l > g && e > l, 'the guard and the restore literal are in the hook, in that order')
  return { guard: hookSource.slice(g, l), literal: hookSource.slice(l, e) }
}
function evalRestore(hookSource, libMod, session, flagOn) {
  const { guard, literal } = blocks(hookSource)
  const clone = JSON.parse(JSON.stringify(session))
  const body = `${guard}\n${literal}\nreturn restoredSessionState`
  const fn = vm.runInNewContext(`(function (session, STUDIO_BLANK_DECK_LEGACY_ROWS_ENABLED, isLegacyBlankDeckRow, process, persistence) { ${compile(body, HOOK)} })`)
  const writes = []
  const state = fn(clone, flagOn, libMod.isLegacyBlankDeckRow, { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } }, { updateMetadata: (...a) => writes.push(a) })
  return Object.assign(state, { __writes: writes.length, __row: clone })
}
const RAW_SESSION = (r, extra = {}) => ({ id: 'S1', ...r, stateCache: { slideStructure: null, activeVersion: null }, ...extra })
function proveRestore(src, label = 'restore') {
  const lib = loadLib(src[LIB], true)
  const rows = [
    ['legacy', row(blanks[0], finals[1], strawmen[0], 0, 1)], ['legacy, count null', row(blanks[0], finals[1], strawmen[0], null, null)], ['legacy, id only', row(blanks[0], finals[3], strawmen[0], 0, 1)],
    ['clean blank row', row(blanks[0], finals[0], strawmen[0], 0, null)], ['finished deck', row(blanks[0], finals[4], strawmen[0], 6, 8)], ['finished deck, same blank id', row(blanks[0], finals[1], strawmen[0], 6, 8)],
    ['strawman at stage 4', row(blanks[0], finals[0], strawmen[1], 4, 3)], ['edited blank deck', row(blanks[0], finals[1], strawmen[0], 0, 4)], ['no blank deck', row(blanks[5], finals[4], strawmen[0], 6, 8)],
  ]
  for (const [name, r] of rows) {
    const session = RAW_SESSION(r)
    const off = evalRestore(src[HOOK], lib, session, false), on = evalRestore(src[HOOK], lib, session, true)
    // flag off: the row's own fields
    eq(off.finalPresentationUrl, r.finalPresentationUrl, `${label}: ${name}: flag off keeps the final URL`)
    eq(off.finalPresentationId, r.finalPresentationId, `${label}: ${name}: flag off keeps the final id`)
    eq(off.presentationUrl, r.finalPresentationUrl || r.strawmanPreviewUrl || r.blankPresentationUrl, `${label}: ${name}: flag off, the displayed URL is final, then strawman, then blank`)
    eq(off.presentationId, r.finalPresentationId || r.strawmanPresentationId || r.blankPresentationId, `${label}: ${name}: flag off, the displayed id`)
    const isLegacy = oracle(r)
    if (isLegacy) {
      eq(on.finalPresentationUrl, null, `${label}: ${name}: flag on, the final URL is empty`); eq(on.finalPresentationId, null, `${label}: ${name}: flag on, the final id is empty`)
      eq(on.presentationUrl, r.strawmanPreviewUrl || r.blankPresentationUrl, `${label}: ${name}: flag on, the blank deck is displayed`)
      eq(on.presentationId, r.strawmanPresentationId || r.blankPresentationId, `${label}: ${name}: flag on, the blank deck's id`)
    } else json(on, off, `${label}: ${name}: flag on is the same as off for a row that is not a legacy blank row`)
    // everything else is the row's own in both
    for (const key of ['blankPresentationUrl', 'blankPresentationId', 'strawmanPreviewUrl', 'strawmanPresentationId', 'slideCount', 'currentStage']) { eq(on[key], r[key], `${label}: ${name}: ${key} untouched (on)`); eq(off[key], r[key], `${label}: ${name}: ${key} untouched (off)`) }
    eq(on.isBlankPresentation, Boolean(r.blankPresentationUrl), `${label}: ${name}: isBlankPresentation untouched`)
    eq(on.deckOwnerSessionId, 'S1', `${label}: ${name}: owner`)
    eq(on.__writes, 0, `${label}: ${name}: nothing is written`)
    for (const key of ['id', 'title', 'status', 'blankPresentationUrl', 'blankPresentationId', 'strawmanPreviewUrl', 'strawmanPresentationId', 'currentStage', 'slideCount']) eq(on.__row[key], session[key], `${label}: ${name}: the loaded copy keeps ${key}`)
  }
}

// ---------------------------------------------------------------- 3. the wiring
function proveSource(src, label = 'hook') {
  const hook = src[HOOK], lib = src[LIB]
  eq(lib.match(/process\.env\.NEXT_PUBLIC_STUDIO_BLANK_DECK_LEGACY_ROWS === 'true'/g)?.length, 1, `${label}: the flag is read once, exact "true"`)
  nomatch(hook, /process\.env\.NEXT_PUBLIC_STUDIO_BLANK_DECK_LEGACY_ROWS/, `${label}: the hook reads the lib's constant`)
  match(hook, /import \{ STUDIO_BLANK_DECK_LEGACY_ROWS_ENABLED, isLegacyBlankDeckRow \} from '@\/lib\/studio-legacy-blank-deck-row'/, `${label}: imported`)
  const { guard, literal } = blocks(hook)
  match(guard, /if \(STUDIO_BLANK_DECK_LEGACY_ROWS_ENABLED && isLegacyBlankDeckRow\(session\)\) \{\n\s+session\.finalPresentationUrl = null\n\s+session\.finalPresentationId = null\n\s+\}\n$/, `${label}: the flag and the loaded row decide; only the two final slots are emptied`)
  eq((hook.match(/isLegacyBlankDeckRow\(/g) || []).length, 1, `${label}: one call`)
  nomatch(guard, /fetch\(|persistence|updateMetadata|queueMessage|sessionStorage|localStorage/, `${label}: the guard writes nothing`)
  ok(hook.indexOf(GUARD_START) > hook.indexOf('setCurrentSessionId(session.id)'), `${label}: after the row is read and adopted`)
  // the restore literal is the base's, untouched: it still reads the final slots from the (guarded) row
  match(literal, /presentationUrl: session\.finalPresentationUrl \|\| session\.strawmanPreviewUrl \|\| session\.blankPresentationUrl/, `${label}: the displayed URL`)
  match(literal, /presentationId: session\.finalPresentationId \|\| session\.strawmanPresentationId \|\| session\.blankPresentationId/, `${label}: the displayed id`)
  match(literal, /finalPresentationUrl: session\.finalPresentationUrl,\n\s+finalPresentationId: session\.finalPresentationId,/, `${label}: the restored final slots`)
  nomatch(literal, /legacy|LEGACY|rowFinal/, `${label}: the restore literal is untouched (the chat-transcript harness hashes it)`)
}

function checkAll(src) {
  proveLib(src[LIB])
  proveRestore(src)
  proveSource(src)
}
checkAll(SOURCES)
const realChecks = checks

// ---------------------------------------------------------------- 4. mutants
const mutants = [
  [LIB, 'blank URL not required', s => s.replace('if (!blankUrl || !blankId) return false', 'if (!blankId) return false')],
  [LIB, 'blank id not required', s => s.replace('if (!blankUrl || !blankId) return false', 'if (!blankUrl) return false')],
  [LIB, 'strawman ignored', s => s.replace("  if (text(row.strawmanPreviewUrl) || text(row.strawmanPresentationId)) return false\n", '')],
  [LIB, 'strawman URL only', s => s.replace('text(row.strawmanPreviewUrl) || text(row.strawmanPresentationId)', 'text(row.strawmanPreviewUrl)')],
  [LIB, 'empty final slots count', s => s.replace('  if (!finalUrl && !finalId) return false\n', '')],
  [LIB, 'other final URL allowed', s => s.replace('  if (finalUrl && finalUrl !== blankUrl) return false\n', '')],
  [LIB, 'other final id allowed', s => s.replace('  if (finalId && finalId !== blankId) return false\n', '')],
  [LIB, 'final URL compared with the id', s => s.replace('if (finalUrl && finalUrl !== blankUrl) return false', 'if (finalUrl && finalUrl !== blankId) return false')],
  [LIB, 'stage not checked', s => s.replace("  if (stage !== undefined && stage !== null && stage !== 0) return false\n", '')],
  [LIB, 'stage 4 allowed', s => s.replace('stage !== null && stage !== 0)', 'stage !== null && stage !== 0 && stage !== 4)')],
  [LIB, 'stage 6 allowed', s => s.replace('stage !== null && stage !== 0)', 'stage !== null && stage !== 0 && stage !== 6)')],
  [LIB, 'count not checked', s => s.replace("  if (count !== undefined && count !== null && !(typeof count === 'number' && count >= 0 && count <= 1)) return false\n", '')],
  [LIB, 'two slides allowed', s => s.replace('count <= 1', 'count <= 2')],
  [LIB, 'zero slides refused', s => s.replace('count >= 0 &&', 'count >= 1 &&')],
  [LIB, 'string count allowed', s => s.replace("typeof count === 'number' && ", '')],
  [LIB, 'blank text trimmed away', s => s.replace("typeof value === 'string' && value.trim() !== '' ? value : null", "typeof value === 'string' ? value : null")],
  [LIB, 'flag loosened', s => s.replace("=== 'true'", '!== undefined')],
  [LIB, 'flag inverted', s => s.replace("=== 'true'", "!== 'true'")],
  [LIB, 'flag wrong name', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_BLANK_DECK_LEGACY_ROWS', 'process.env.NEXT_PUBLIC_STUDIO_BLANK_DECK_LEGACY')],
  [HOOK, 'flag ignored', s => s.replace('if (STUDIO_BLANK_DECK_LEGACY_ROWS_ENABLED && isLegacyBlankDeckRow(session)) {', 'if (isLegacyBlankDeckRow(session)) {')],
  [HOOK, 'helper ignored', s => s.replace('if (STUDIO_BLANK_DECK_LEGACY_ROWS_ENABLED && isLegacyBlankDeckRow(session)) {', 'if (STUDIO_BLANK_DECK_LEGACY_ROWS_ENABLED) {')],
  [HOOK, 'final URL kept', s => s.replace('              session.finalPresentationUrl = null\n', '')],
  [HOOK, 'final id kept', s => s.replace('              session.finalPresentationId = null\n', '')],
  [HOOK, 'blank slots cleared too', s => s.replace('              session.finalPresentationId = null\n', '              session.finalPresentationId = null\n              session.blankPresentationUrl = null\n')],
  [HOOK, 'count zeroed', s => s.replace('              session.finalPresentationId = null\n', '              session.finalPresentationId = null\n              session.slideCount = 0\n')],
  [HOOK, 'stage advanced', s => s.replace('              session.finalPresentationId = null\n', '              session.finalPresentationId = null\n              session.currentStage = 4\n')],
  [HOOK, 'a write added', s => s.replace('              session.finalPresentationId = null\n', "              session.finalPresentationId = null\n              persistence?.updateMetadata({ finalPresentationUrl: null })\n")],
  [HOOK, 'a fetch added', s => s.replace('              session.finalPresentationId = null\n', "              session.finalPresentationId = null\n              void fetch('/api/sessions/' + session.id, { method: 'PATCH' })\n")],
  [HOOK, 'guard after the restore literal', s => { const g = s.indexOf(GUARD_START), l = s.indexOf(LITERAL_START); const block = s.slice(g, l); return s.slice(0, g) + s.slice(l).replace(LITERAL_END, block + LITERAL_END) }],
  [HOOK, 'literal reads the guard away', s => s.replace('presentationUrl: session.finalPresentationUrl || session.strawmanPreviewUrl', 'presentationUrl: session.strawmanPreviewUrl || session.finalPresentationUrl')],
  [HOOK, 'literal touched', s => s.replace('finalPresentationUrl: session.finalPresentationUrl,\n              finalPresentationId: session.finalPresentationId,', 'finalPresentationUrl: session.finalPresentationUrl, // LEGACY\n              finalPresentationId: session.finalPresentationId,')],
]
let killed = 0
const survivors = []
for (const [file, name, mutate] of mutants) {
  const mutated = mutate(SOURCES[file])
  if (mutated === SOURCES[file]) { survivors.push(`${name} (mutation did not apply)`); continue }
  let died = false
  const before = checks
  try { checkAll({ ...SOURCES, [file]: mutated }) } catch { died = true }
  checks = before
  if (died) killed++; else survivors.push(name)
}
eq(survivors.length, 0, `surviving mutants: ${survivors.join('; ')}`)
console.log(`legacy blank-deck rows: ${realChecks} checks, ${killed}/${mutants.length} mutants killed`)
