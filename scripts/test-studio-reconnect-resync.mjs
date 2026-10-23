// P3-4 (Studio side), slice A: a resync after Director's socket reconnects (flag NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC, exact "true",
// default off; acts only with NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE on). lib/studio-deck-changed-notice.ts' resyncAfterReconnect reads
// the slide inventory once and reloads the deck (no unsaved edits) or shows the notice (unsaved edits); hooks/use-deck-changed-notice.ts
// calls it when the socket counter rises for the same session and deck; the page passes the counter.
//
//   node scripts/test-studio-reconnect-resync.mjs            (plain node: transpile + vm, no network)
//   node scripts/test-studio-reconnect-resync.mjs --no-mutants
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(path.join(root, 'package.json'))
const FLAG = 'NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const LIB = 'lib/studio-deck-changed-notice.ts'
const HOOK = 'hooks/use-deck-changed-notice.ts'
const COMPONENT = 'components/builder/studio-deck-changed-notice.tsx'
const PAGE = 'app/builder/page.tsx'
const SRC = { [LIB]: read(LIB), [HOOK]: read(HOOK), [COMPONENT]: read(COMPONENT), [PAGE]: read(PAGE), '.env.example': read('.env.example') }

const transpile = (text, jsx = false) => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) },
}).outputText

function loadLib(libText, env) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(libText), {
    module: mod, exports: mod.exports, process: { env: { ...env } }, require: id => assert.fail(`the module must stay import-free: ${id}`),
    setTimeout, clearTimeout, Date, Math, globalThis: { crypto: { randomUUID: () => 'tab-uuid-fixed' } },
  })
  return mod.exports
}

function renderNotice(componentText, props) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(componentText, true), { module: mod, exports: mod.exports, require: id => nodeRequire(id), console })
  const React = nodeRequire('react')
  const { renderToStaticMarkup } = nodeRequire('react-dom/server')
  return renderToStaticMarkup(React.createElement(mod.exports.StudioDeckChangedNotice, props))
}

const inventory = (count, version = 'v1') => ({ slideCount: count, slides: Array.from({ length: count }, (_, i) => ({ slideId: `s${i}`, layout: 'L25', contentVersion: version })) })

/** A controller with fakes: a clock, a document, an inventory queue and a viewer. */
function setup(lib, { viewer = { presentationId: 'p1', slideCount: 6, unsaved: false }, reads = [inventory(7)], onResync = true, hidden = false } = {}) {
  let t = 1_000_000
  const calls = { reads: 0, resync: 0, notices: [] }
  const doc = { visibilityState: hidden ? 'hidden' : 'visible', addEventListener() {}, removeEventListener() {} }
  const queue = [...reads]
  const controller = lib.createDeckChangedController({
    sessionId: 'sess-1', presentationId: 'p1', tabId: 'tab-a',
    createChannel: () => null,
    readInventory: async () => { calls.reads++; return queue.length ? queue.shift() : null },
    getViewerState: () => viewer,
    onNotice: n => calls.notices.push(n),
    doc, win: { addEventListener() {}, removeEventListener() {} },
    now: () => t,
    ...(onResync ? { onResync: () => { calls.resync++ } } : {}),
  })
  return { controller, calls, viewer, doc, advance: ms => { t += ms }, push: inv => queue.push(inv) }
}

let checks = 0
const ok = (cond, msg) => { assert.ok(cond, msg); checks++ }
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++ }

/** The behavioural cases. Throws on the first failed check (mutants must make it throw). */
async function scenarios(libText) {
  const lib = loadLib(libText, { [FLAG]: 'true', NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE: 'true' })
  eq(lib.STUDIO_RECONNECT_RESYNC_ENABLED, true, 'the flag reads exact "true"')
  eq(lib.RECONNECT_RESYNC_MIN_GAP_MS, 10_000, 'the reconnect read gap is 10 s')

  { // a changed deck, nothing unsaved: reloaded, no notice
    const s = setup(lib)
    eq(await s.controller.resyncAfterReconnect(), 'reloaded', 'a changed deck with no unsaved edits is reloaded')
    eq(s.calls.resync, 1, 'the page reload runs once'); eq(s.calls.reads, 1, 'one inventory read')
    ok(s.calls.notices.every(n => n === null) && s.controller.getNotice() === null, 'no notice for a silent resync')
  }
  { // unsaved edits: the notice, no reload
    const s = setup(lib, { viewer: { presentationId: 'p1', slideCount: 6, unsaved: true } })
    eq(await s.controller.resyncAfterReconnect(), 'notice', 'unsaved edits get the notice')
    eq(s.calls.resync, 0, 'unsaved edits are never reloaded away')
    eq(s.controller.getNotice()?.source, 'reconnect', 'the notice says it came from a reconnect')
  }
  { // an unchanged deck: nothing
    const s = setup(lib, { reads: [inventory(6)] })
    eq(await s.controller.resyncAfterReconnect(), 'same', 'an unchanged deck does nothing')
    eq(s.calls.resync, 0, 'no reload'); eq(s.controller.getNotice(), null, 'no notice')
  }
  { // the gap: two reconnects within 10 s read once; after the gap it reads again
    const s = setup(lib, { reads: [inventory(6), inventory(6)] })
    await s.controller.resyncAfterReconnect()
    s.advance(4_000)
    eq(await s.controller.resyncAfterReconnect(), 'skipped', 'a second reconnect inside 10 s is skipped')
    eq(s.calls.reads, 1, 'still one read')
    s.advance(6_001)
    eq(await s.controller.resyncAfterReconnect(), 'same', 'after 10 s the next reconnect reads again')
    eq(s.calls.reads, 2, 'two reads in all')
  }
  { // a hidden tab waits for its visibility read
    const s = setup(lib, { hidden: true })
    eq(await s.controller.resyncAfterReconnect(), 'skipped', 'a hidden tab skips the reconnect read')
    eq(s.calls.reads, 0, 'no read while hidden')
  }
  { // this tab's own change: quiet
    const s = setup(lib)
    s.controller.noteOwnEdit()
    eq(await s.controller.resyncAfterReconnect(), 'skipped', "this tab's own recent edit is not another change")
    eq(s.calls.reads, 0, 'no read during the own-change quiet window')
  }
  { // a failed read: nothing
    const s = setup(lib, { reads: [] })
    eq(await s.controller.resyncAfterReconnect(), 'skipped', 'a failed read does nothing')
    eq(s.calls.resync, 0, 'no reload on a failed read'); eq(s.controller.getNotice(), null, 'no notice on a failed read')
  }
  { // another deck on screen: nothing
    const s = setup(lib, { viewer: { presentationId: 'p2', slideCount: 6, unsaved: false } })
    eq(await s.controller.resyncAfterReconnect(), 'skipped', 'another deck on screen is left alone')
    eq(s.calls.resync, 0, 'no reload of another deck')
  }
  { // without a reload callback (the hook with the flag off): the notice instead
    const s = setup(lib, { onResync: false })
    eq(await s.controller.resyncAfterReconnect(), 'notice', 'without onResync a changed deck is noticed, never reloaded')
  }
  { // a notice already up: the user decides
    const s = setup(lib, { viewer: { presentationId: 'p1', slideCount: 6, unsaved: true }, reads: [inventory(7), inventory(8)] })
    await s.controller.resyncAfterReconnect()
    s.viewer.unsaved = false
    s.advance(10_001)
    eq(await s.controller.resyncAfterReconnect(), 'notice', 'with a notice up, a later reconnect does not reload')
    eq(s.calls.resync, 0, 'still no reload')
  }
  { // disposed: nothing
    const s = setup(lib)
    s.controller.dispose()
    eq(await s.controller.resyncAfterReconnect(), 'skipped', 'a disposed controller does nothing')
    eq(s.calls.reads, 0, 'no read after dispose')
  }
  { // a reload then the same deck: the next reconnect finds nothing new
    const s = setup(lib, { reads: [inventory(7), inventory(7)] })
    await s.controller.resyncAfterReconnect()
    await s.controller.check('visibility')
    eq(s.calls.reads, 1, 'the resync counts as a reload: an immediate visibility check stays quiet')
    s.viewer.slideCount = 7
    s.advance(10_001)
    eq(await s.controller.resyncAfterReconnect(), 'same', 'after the reload the same inventory is not a change')
    eq(s.calls.resync, 1, 'one reload in all')
  }
  // Flag off: the constant is false for every spelling but "true".
  for (const value of [undefined, '', 'false', 'TRUE', '1', ' true']) {
    const off = loadLib(libText, value === undefined ? {} : { [FLAG]: value })
    eq(off.STUDIO_RECONNECT_RESYNC_ENABLED, false, `flag value ${JSON.stringify(value)} is off`)
  }
}

function staticChecks() {
  const hook = SRC[HOOK]
  ok(/\.\.\.\(STUDIO_RECONNECT_RESYNC_ENABLED && \{ onResync: \(\) => onReloadRef\.current\(\) \}\)/.test(hook), 'the hook hands the reload to the controller only with the flag on')
  ok(/if \(!STUDIO_RECONNECT_RESYNC_ENABLED \|\| !active \|\| typeof connectionGeneration !== 'number'\) return/.test(hook), 'the reconnect effect returns at once with the flag off')
  ok(/if \(!seen \|\| seen\.key !== key \|\| connectionGeneration <= seen\.generation\) return/.test(hook), "a session's first connection (or a new session / deck) is not a reconnect")
  ok(/void controllerRef\.current\?\.resyncAfterReconnect\(\)/.test(hook), 'a rise in the counter runs the resync')
  ok(/\[active, sessionId, presentationId, connectionGeneration\]/.test(hook), 'the effect follows the counter, the session and the deck')
  const page = SRC[PAGE]
  const call = page.slice(page.indexOf('const deckChangedNotice = useDeckChangedNotice({'), page.indexOf('})', page.indexOf('const deckChangedNotice = useDeckChangedNotice({')))
  ok(/\n    connectionGeneration, \/\/ P3-4 NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC/.test(call), 'the page passes the socket counter to the notice hook')
  eq((page.match(/connectionGeneration, \/\/ P3-4 NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC/g) || []).length, 1, 'the page adds exactly one line')
  // The component: the reconnect copy, and every other source exactly as before.
  const html = source => renderNotice(SRC[COMPONENT], { notice: { id: 1, source, change: null }, unsaved: false, onReload() {}, onDismiss() {} })
  ok(html('reconnect').includes('This deck changed while you were reconnecting'), 'the reconnect notice says so')
  for (const source of ['broadcast', 'visibility', 'focus']) {
    const h = html(source)
    ok(h.includes('>This deck changed in another tab<') && !h.includes('reconnecting'), `the ${source} notice is unchanged`)
  }
  const env = SRC['.env.example']
  eq((env.match(/^NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC="false"$/gm) || []).length, 1, '.env.example declares the flag once, "false"')
  ok(env.indexOf('NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC="false"') < env.indexOf('# PASS2 ADMIN'), 'its block sits before # PASS2 ADMIN')
  ok(/Works only with NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE "true"/.test(env), 'the block names its dependency')
}

/** The strip module (for pins that hold these files to an earlier commit): it removes exactly this change's text. */
async function stripChecks() {
  const { stripReconnectResync, RECONNECT_RESYNC_FILES, BASE_COMMIT } = await import('./studio-reconnect-resync-strip.mjs')
  const { execFileSync } = await import('node:child_process')
  eq([...RECONNECT_RESYNC_FILES].sort(), ['.env.example', 'app/builder/page.tsx', COMPONENT, HOOK, LIB].sort(), 'the strip covers exactly the 5 changed files')
  let base
  try { base = rel => execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }) }
  catch { base = null }
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  for (const rel of RECONNECT_RESYNC_FILES) {
    const stripped = stripReconnectResync(rel, read(rel))
    // Strict (byte for byte = the base) unless a later PR's commit touched this file after the base; then the stacked rule: stripping
    // leaves none of this change's text, and every base line is still there in order.
    let later = false
    try { later = git(['log', '--format=%s', `${BASE_COMMIT}..HEAD`, '--', rel]).split('\n').filter(Boolean).some(s => !/p3-4/i.test(s)) } catch { later = false }
    const baseText = base(rel)
    if (!later) { eq(stripped, baseText, `${rel}: stripping gives back the base byte for byte`); continue }
    ok(!/RECONNECT_RESYNC|resyncAfterReconnect|connectionGeneration, \/\/ P3-4|while you were reconnecting/.test(stripped), `${rel}: stripping leaves none of this change's text (stacked)`)
    let at = 0
    for (const line of baseText.split('\n')) { const i = stripped.indexOf(line, at); ok(i >= 0, `${rel}: base line kept in order (stacked)`); at = i + line.length }
  }
  eq(stripReconnectResync('lib/other.ts', 'x'), 'x', 'any other file comes back as it is')
}

const MUTANTS = [
  ['no reconnect gap', s => s.replace('if (t < nextReconnectAt || t < ownChangeQuietUntil) return \'skipped\'', "if (t < ownChangeQuietUntil) return 'skipped'")],
  ['no own-change quiet', s => s.replace('if (t < nextReconnectAt || t < ownChangeQuietUntil) return \'skipped\'', "if (t < nextReconnectAt) return 'skipped'")],
  ['reload despite unsaved edits', s => s.replace('if (viewer.unsaved || !deps.onResync)', 'if (!deps.onResync)')],
  ['hidden tab reads', s => s.replace("if (deps.doc && deps.doc.visibilityState && deps.doc.visibilityState !== 'visible') return 'skipped'", '')],
  ['unchanged deck noticed', s => s.replace("knownSignature: previous })) return 'same'", "knownSignature: previous })) { show('reconnect', null); return 'notice' }")],
  ['another deck reloaded', s => s.replace("if (viewer.presentationId !== deps.presentationId) return 'skipped'\n        if (!inventoryDiffers", 'if (!inventoryDiffers')],
  ['reload over a notice', s => s.replace("if (notice) return 'notice' // a notice is already up", '// mutant')],
  ['reload without markReloaded', s => s.replace('api.markReloaded()\n        deps.onResync()', 'deps.onResync()')],
  ['wrong gap', s => s.replace('export const RECONNECT_RESYNC_MIN_GAP_MS = 10_000', 'export const RECONNECT_RESYNC_MIN_GAP_MS = 1_000')],
  ['loose flag', s => s.replace("process.env.NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC === 'true'", "Boolean(process.env.NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC)")],
  ['disposed still reads', s => s.replace("if (disposed || checking) return 'skipped'\n      // A hidden tab", "if (checking) return 'skipped'\n      // A hidden tab")],
]

await scenarios(SRC[LIB])
staticChecks()
await stripChecks()
console.log(`reconnect resync: ${checks} checks passed`)
if (!process.argv.includes('--no-mutants')) {
  let caught = 0
  const survivors = []
  for (const [name, mutate] of MUTANTS) {
    const mutated = mutate(SRC[LIB])
    assert.notEqual(mutated, SRC[LIB], `mutant "${name}" must change the source`)
    try { await scenarios(mutated); survivors.push(name) } catch { caught++ }
  }
  assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
  console.log(`PASS mutation check: ${caught} of ${MUTANTS.length} mutants fail at least one check`)
}
