// FRONTEND-2 (B46, 29 Oct; the Studio half of Layout MR !263, LAYOUT_SLIDES_PUT_STALE_GUARD_ENABLED): proof of NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE (exact "true", default off, build-time; it acts only with
// NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE and NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH). When Layout refuses a stale whole-deck save, Studio shows its existing "This deck was updated · Reload deck" notice, not a bare "Save failed".
//
// THE DEFECT. Layout (flag on) answers a stale whole-deck PUT with 409 DECK_CHANGED and stores nothing; the viewer (auto-save.js) keeps the change pending and posts saveStatusChanged {status: "error", deckChanged: true, message
// "This deck was updated (DECK_CHANGED) Request reference: ..."}. components/presentation-viewer.tsx counted every non-"saved" status as this tab's own autosave (reportOwnDeckEdit) and set the save status to "error": a generic failure.
// Once refused, EVERY later status carries deckChanged (unsaved, saving) until Layout stores a save, so only status "error" is the refusal itself.
//
// WHAT RUNS. Layout's side is Layout's own: scripts/fixtures/studio-deck-save-refused/layout-transcripts.json holds what the REAL viewer (src/utils/auto-save.js) posted against the REAL server.py of !263 (on loopback, filesystem store),
// recorded from a read-only `git archive` export of one commit (never a working tree) by scripts/studio-deck-save-refused-layout.mjs. Studio's side is Studio's own, unchanged: the viewer's real save-status handler (cut out of
// components/presentation-viewer.tsx by exact anchors, with the real message trust check), the REAL notice lib, sync-truth lib, notice hook (mounted) and notice component (rendered), on a small DOM-free React host.
//
//   node scripts/test-studio-deck-save-refused-notice.mjs                       # offline: the frames come from the fixture
//   DECK_SAVE_REFUSED_LAYOUT_DIR=<export of the Layout commit> node scripts/test-studio-deck-save-refused-notice.mjs     # live: the export's real server + viewer are run on loopback, the frames recorded now, compared with the fixture,
//                                                                                                                       #        and the same Studio proof is run on the LIVE frames (python: DECK_SAVE_REFUSED_LAYOUT_PYTHON, default ~/Deckster/.worktrees/ops2-venv-layout/bin/python)
//   DECK_SAVE_REFUSED_LAYOUT_DIR=<export> DECK_SAVE_REFUSED_LAYOUT_SHA=<commit> node scripts/test-studio-deck-save-refused-notice.mjs --record-layout     # re-records the fixture
//
//   1. Layout's frames: a refusal for each kind of change by Director (add, duplicate, delete, undo, refine) is ONE 409 DECK_CHANGED, nothing stored, the change kept pending, the frames carry deckChanged; its own saves and a non-refusal
//      error carry none; the flag-off Layout posts none.
//   2. The lib: the flag is exact "true" and acts only with the notice and sync-truth flags; the refusal predicate is status "error" and deckChanged === true, nothing looser; the bridge is inert while not active.
//   3. The world, frames through the real handler: flag on, a refusal shows the notice ("This deck was updated", Reload deck, Dismiss), is NOT counted as an own edit, the save status is unchanged, the pending change is never
//      dropped (Reload deck asks first; nothing reloads without Reload anyway), a second refusal leaves an open notice alone, Dismiss then another refusal raises it again; "unsaved" / "saving" after a refusal stay own edits;
//      flag off, or either dependency off: today's behaviour, hashed against the base (this change's marked lines stripped); a normal save error without deckChanged is unchanged either way.
//   4. Wiring and the strip: the marked lines (and only they), the strip gives the base back byte for byte, the dangling-else is placed where it binds only the base's call, no new copy, import-free lib, .env.example.
//   5. Mutants: each must be caught.
//   6. Scope over the COMMITTED diff, GATE-SAFE and robust after merge: this change's commits are found by SUBJECT across `rev-list --no-merges BASE..head`; on the gate's merge (first parent dev, second parent this change) the scope head is
//      HEAD^2; the registry, .env.example and strip reads go past every other change, proved on a gate-style merge, on a merge onto an advanced dev and on a synthetic change stacked after this one.
//
// Offline for Studio: no socket, fetch or real timer (the host network guard is installed once the live recording, if any, is done). git is read only for 6 (objects only, no ref, no working-tree write; blobs come from temp files).
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const FLAG = 'NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE'
const NOTICE = 'NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE'
const TRUTH = 'NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH'
const LIB = 'lib/studio-deck-save-refused.ts'
const VIEWER = 'components/presentation-viewer.tsx'
const HOOK = 'hooks/use-deck-changed-notice.ts'
const NOTICE_LIB = 'lib/studio-deck-changed-notice.ts'
const COMPONENT = 'components/builder/studio-deck-changed-notice.tsx'
const TRUTH_LIB = 'lib/studio-deck-sync-truth.ts'
const FIXTURE = 'scripts/fixtures/studio-deck-save-refused/layout-transcripts.json'
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}

// ---- Layout's frames: the fixture, or (with the export given) recorded live from the export's real server and viewer ------------------------------------------
const layoutRunner = await import('./studio-deck-save-refused-layout.mjs')
const RECORD = process.argv.includes('--record-layout')
const LAYOUT_DIR = process.env.DECK_SAVE_REFUSED_LAYOUT_DIR ? path.resolve(process.env.DECK_SAVE_REFUSED_LAYOUT_DIR) : null
const PYTHON = process.env.DECK_SAVE_REFUSED_LAYOUT_PYTHON || path.join(os.homedir(), 'Deckster/.worktrees/ops2-venv-layout/bin/python')
const norm = value => JSON.parse(JSON.stringify(value).replace(/Request reference: [A-Za-z0-9-]+\./g, 'Request reference: <ref>.').replace(/"lastSaveTime":\d+/g, '"lastSaveTime":"<t>"'))
if (RECORD && !LAYOUT_DIR) throw new Error('--record-layout needs DECK_SAVE_REFUSED_LAYOUT_DIR')
let live = null
if (LAYOUT_DIR) {
  assert.ok(fs.existsSync(path.join(LAYOUT_DIR, 'slides_put_stale_guard.py')) && fs.existsSync(path.join(LAYOUT_DIR, 'tests/slides_put_stale_guard_viewer.js')), 'the export holds !263\'s guard and its viewer harness')
  live = await layoutRunner.recordTranscripts({ layoutDir: LAYOUT_DIR, python: PYTHON, sha: process.env.DECK_SAVE_REFUSED_LAYOUT_SHA || 'unknown' })
  if (RECORD) {
    fs.mkdirSync(path.dirname(path.join(repo, FIXTURE)), { recursive: true })
    fs.writeFileSync(path.join(repo, FIXTURE), JSON.stringify(live, null, 1) + '\n')
    console.log(`recorded ${FIXTURE} from ${live.meta.layoutCommit}`)
    process.exit(0)
  }
}
const FIX = JSON.parse(read(FIXTURE))
const TRANSCRIPTS = live ?? FIX
const T = TRANSCRIPTS.scenarios
const MODE = live ? `live (export ${path.basename(LAYOUT_DIR)})` : 'offline (fixture)'

// React and the offline host are loaded AFTER NODE_ENV is set above (a static import would load React's development build first and mismatch the production server renderer).
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { installHostNetworkGuard } = await import('./studio-chat-harness/fake-env.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { Root, hostNodes, textOf, toElements } = await import('./studio-chat-harness/mini-react.mjs')
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-deck-save-refused-strip.mjs')
const { stripDeckSaveRefused, BASE_COMMIT, DECK_SAVE_REFUSED_FILES, DECK_SAVE_REFUSED_NEW_FILES, DECK_SAVE_REFUSED_SCOPE_FILES, DECK_SAVE_REFUSED_ENV_BLOCK, DECK_SAVE_REFUSED_SUBJECT, DECK_SAVE_REFUSED_MARKER_RE } = stripModule
const release = installHostNetworkGuard(net, dns)
const macrotask = () => new Promise(resolve => setImmediate(resolve))

// The strips of the changes registered AFTER this one, applied first; and, for the sources section, every OTHER registered strip (applied to both sides of a comparison).
const strips = registry.LATER_STRIPS
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
const laterStrips = (rel, text) => { const at = strips.indexOf(stripDeckSaveRefused); return applyAll(at === -1 ? [] : strips.slice(at + 1), rel, text) }
const otherStrips = (rel, text) => applyAll(strips.filter(strip => strip !== stripDeckSaveRefused), rel, text)
/** The file as this change left it (the later changes' marked lines out), and the same without this change's lines (the base's file). */
const ownText = rel => laterStrips(rel, read(rel))
const baseText = rel => stripDeckSaveRefused(rel, ownText(rel))

function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function loadRefused(text, env) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, LIB))(module, module.exports, () => { throw new Error('the lib must stay import-free') }, { env })
  return module.exports
}
const ON_ENV = { [FLAG]: 'true', [NOTICE]: 'true', [TRUTH]: 'true' }

// ============================================================================================================================================
// 1. Layout's frames
// ============================================================================================================================================
const KINDS = layoutRunner.REFUSAL_KINDS
const isRefusal = frame => frame.status === 'error' && frame.deckChanged === true
console.log(`mode: ${MODE}; Layout commit of the frames: ${FIX.meta.layoutCommit}`)
console.log('1. Layout\'s frames (the real viewer against the real server of !263)')
await check('a refusal for each kind of change by Director: ONE 409 DECK_CHANGED, nothing stored, the change kept pending, no retry loop; the frames carry deckChanged, "error" is the refusal itself', () => {
  assert.match(FIX.meta.layoutCommit, /^[0-9a-f]{40}$/, 'the fixture names the Layout commit the frames came from')
  for (const kind of KINDS) {
    const s = T[`stale:${kind}`]
    assert.equal(s.layoutFlagServed, true, `${kind}: the flag-on viewer`)
    assert.deepEqual(s.putStatuses, [409], `${kind}: one request, refused, not retried`)
    assert.equal(s.putsAfterTimers, 1, `${kind}: no retry loop on any timer`)
    assert.equal(s.pendingAfterRefusal, true, `${kind}: the change stays pending`)
    assert.equal(s.deckUnchanged, true, `${kind}: the stored deck is Director's, nothing written`)
    assert.deepEqual(s.refusal, { status: 409, body: { detail: { code: 'DECK_CHANGED', message: 'This deck was updated', reason: 'version' } } }, `${kind}: the server's refusal`)
    assert.deepEqual(s.frames.map(f => f.status + (f.deckChanged ? '+dc' : '')), ['unsaved', 'saving', 'error+dc', 'error+dc', 'unsaved+dc', 'saving+dc', 'error+dc'], `${kind}: the frames, in order (deckChanged is sticky once refused)`)
    for (const f of s.frames.filter(isRefusal)) {
      assert.match(f.message, /^This deck was updated \(DECK_CHANGED\) Request reference: [A-Za-z0-9-]+\.$/); assert.equal(f.hasPendingChanges, true); assert.equal(f.type, 'saveStatusChanged')
    }
    for (const f of s.frames.filter(f => f.status !== 'error')) assert.ok(f.status === 'unsaved' || f.status === 'saving')
  }
})
await check('its own saves, a non-refusal error and a Layout without the flag carry no deckChanged', () => {
  assert.deepEqual(T.own.putStatuses, [200, 200, 200, 200, 200, 200, 200]); assert.equal(T.own.finalStatus.status, 'saved'); assert.equal('deckChanged' in T.own.finalStatus, false)
  assert.deepEqual(T.fault.putStatuses, [500])
  const errors = T.fault.frames.filter(f => f.status === 'error')
  assert.ok(errors.length >= 1 && errors.every(f => !('deckChanged' in f)), 'a normal save error: status error, no deckChanged')
  const off = T['layout-flag-off:stale:refine']
  assert.equal(off.layoutFlagServed, false); assert.deepEqual(off.putStatuses, [200]); assert.ok(off.frames.every(f => !('deckChanged' in f)))
})
if (live) await check('LIVE: what the export\'s real server and viewer say now is what the fixture recorded (request references and times aside)', () => assert.deepEqual(norm(live.scenarios), norm(FIX.scenarios)))

// ============================================================================================================================================
// 2. The lib
// ============================================================================================================================================
console.log('2. the lib')
const ALL_FRAMES = Object.values(T).flatMap(s => s.frames)
const SYNTHETIC_FRAMES = [
  { status: 'error', deckChanged: 'true' }, { status: 'error', deckChanged: 1 }, { status: 'error', deckChanged: 'yes' }, { status: 'error', deckChanged: false }, { status: 'error' }, { status: 'error', deckChanged: null },
  { status: 'unsaved', deckChanged: true }, { status: 'saving', deckChanged: true }, { status: 'saved', deckChanged: true }, { status: 'ERROR', deckChanged: true }, { deckChanged: true }, { status: 'error', deckChanged: true, extra: 1 },
  null, undefined, 'error', 7, [], [{ status: 'error', deckChanged: true }],
]
const want = (frame, active) => active && frame !== null && typeof frame === 'object' && !Array.isArray(frame) && frame.status === 'error' && frame.deckChanged === true
function libSuite(libText = ownText(LIB)) {
  const values = [undefined, 'false', 'TRUE', '1', ' true', 'true ', 'yes', '', 'true']
  let cells = 0
  for (const f of values) for (const n of [undefined, 'true', 'false', 'TRUE']) for (const t of [undefined, 'true', 'false', '1']) {
    const env = { ...(f === undefined ? {} : { [FLAG]: f }), ...(n === undefined ? {} : { [NOTICE]: n }), ...(t === undefined ? {} : { [TRUTH]: t }) }
    const lib = loadRefused(libText, env)
    const active = f === 'true' && n === 'true' && t === 'true'
    assert.equal(lib.STUDIO_DECK_SAVE_REFUSED_NOTICE_ENABLED, f === 'true', `flag ${JSON.stringify(f)}`)
    assert.equal(lib.STUDIO_DECK_SAVE_REFUSED_ACTIVE, active, `active for ${JSON.stringify(env)}`)
    for (const frame of [...ALL_FRAMES, ...SYNTHETIC_FRAMES]) { assert.equal(lib.isDeckSaveRefused(frame), want(frame, active), `${JSON.stringify(frame)?.slice(0, 80)} under ${JSON.stringify(env)}`); cells++ }
    // the bridge: inert while not active
    const calls = []
    const off = lib.onDeckSaveRefused(() => calls.push('a'))
    lib.reportDeckSaveRefused()
    assert.deepEqual(calls, active ? ['a'] : [], `bridge under ${JSON.stringify(env)}`)
    off(); lib.reportDeckSaveRefused(); assert.equal(calls.length, active ? 1 : 0, 'unsubscribed')
  }
  const on = loadRefused(libText, ON_ENV)
  const seen = []
  const offA = on.onDeckSaveRefused(() => { throw new Error('a listener that throws') }), offB = on.onDeckSaveRefused(() => seen.push('b'))
  on.reportDeckSaveRefused(); assert.deepEqual(seen, ['b'], 'a throwing listener never breaks the caller or the others'); offA(); offB()
  assert.deepEqual(Object.keys(on).sort(), ['STUDIO_DECK_SAVE_REFUSED_ACTIVE', 'STUDIO_DECK_SAVE_REFUSED_NOTICE_ENABLED', 'isDeckSaveRefused', 'onDeckSaveRefused', 'reportDeckSaveRefused'], 'the lib\'s whole surface')
  return cells
}
let libCells = 0
await check('the flag is exact "true"; active only with the notice and sync-truth flags; the refusal is status "error" and deckChanged === true and nothing looser (every recorded frame and 18 synthetic ones, 9 x 4 x 4 env cells); the bridge is inert while not active', () => { libCells = libSuite() })
console.log(`       (${libCells} frame x env cells)`)

// ============================================================================================================================================
// 3. The world: frames through the viewer's real save-status handler, the real notice lib / hook / component
// ============================================================================================================================================
console.log('3. the world: Layout\'s frames -> the viewer\'s real handler -> the real notice (lib, hook, component)')
const VIEWER_ORIGIN = 'https://layout.example'
const SESSION = 'sess-b46', DECK = 'deck-b46'
const peerStrips = () => strips.filter(fn => typeof fn === 'function' && fn !== stripDeckSaveRefused)
/** The viewer read past every OTHER registered later change's marked lines (they name things this cut does not have), line by line; this change's own lines stay. */
const viewerPastPeers = text => text.split('\n').filter(line => line === '' || DECK_SAVE_REFUSED_MARKER_RE.test(line) || !peerStrips().some(fn => fn(VIEWER, line) === '')).join('\n')
const HANDLER_ANCHOR = '  // Listen for save status/refine events from iframe\n  useEffect(() => {\n    const handleMessage = (event: MessageEvent) => {\n'
const SAVE_HEADING = '      // Handle save status updates from auto-save system\n'
const SAVE_END = "\n      if (\n        type === 'refineElementRequested' &&"
/** The viewer's trust check, type check and save-status block, cut out by exact anchors, as a function of its deps. */
function cutHandler(viewerText) {
  const text = viewerPastPeers(viewerText)
  const at = text.indexOf(HANDLER_ANCHOR)
  assert.ok(at > 0, 'viewer: the save status / refine message handler anchor')
  const head = text.slice(at + HANDLER_ANCHOR.length).split('\n').slice(0, 3).join('\n') + '\n'
  assert.equal(head, "      if (!VIEWER_ORIGIN || LAYOUT_URL_CONFIG_ERROR || !isTrustedLayoutViewerMessage(event, iframeRef.current, VIEWER_ORIGIN)) return\n      const type = event.data?.type\n      if (typeof type !== 'string' || !isLayoutViewerEvent(type)) return\n", 'viewer: the handler\'s trust and type checks')
  const start = text.indexOf(SAVE_HEADING, at), end = text.indexOf(SAVE_END, start)
  assert.ok(start > at && end > start, 'viewer: save-status block anchors')
  const names = ['VIEWER_ORIGIN', 'LAYOUT_URL_CONFIG_ERROR', 'isTrustedLayoutViewerMessage', 'isLayoutViewerEvent', 'iframeRef', 'studioShell', 'viewerInteractionIntentRef', 'nativeSnapshotDirtyRef', 'reportOwnDeckEdit',
    'setNativeSnapshotSafetyRevision', 'setSaveStatus', 'debugLog', 'isDeckSaveRefused', 'reportDeckSaveRefused']
  return `export function make(deps: any) {\n  const { ${names.join(', ')} } = deps\n  return (event: MessageEvent) => {\n${head}\n${text.slice(start, end + 1)}  }\n}\n`
}
const origins = { value: 0 }
const FILE_STUBS = { 'lib/layout-service-client': { getLayoutServiceUrl: () => VIEWER_ORIGIN }, 'lib/slide-rail-identity': { fetchSlideInventory: async () => ({ kind: 'unavailable' }) } }

/** One engine: the REAL modules in one vm for one env; `overrides` ({rel: text}) replace files the loader reads (the base's, a mutant's); `viewerText` is the viewer the handler is cut from. */
async function makeEngine({ env, overrides = {}, viewerText = read(VIEWER), refusedLib = true }) {
  const fsReal = fs.readFileSync
  fs.readFileSync = function (file, ...rest) { if (typeof file === 'string' && path.relative(repo, file) in overrides) return overrides[path.relative(repo, file)]; return fsReal.call(fs, file, ...rest) }
  let loader, mods
  const fakeDoc = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
  try {
    loader = createModuleLoader({
      root: repo,
      globals: { process: { env: { NODE_ENV: 'production', ...env } }, console, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, Date, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp, URL, queueMicrotask, document: fakeDoc, window: { ...fakeDoc } },
      stubs: { react: React }, fileStubs: FILE_STUBS,
    })
    mods = {
      notice: loader.load(NOTICE_LIB), truth: loader.load(TRUTH_LIB), hook: loader.load(HOOK), component: loader.load(COMPONENT),
      messaging: loader.load('lib/layout-viewer-messaging.ts'), router: loader.load('lib/element-command-router.ts'),
      refused: refusedLib ? loader.load(LIB) : null,
    }
  } finally { fs.readFileSync = fsReal }
  return { env, mods, viewerText }
}

async function mount(engine) {
  const { mods } = engine
  const calls = { ownEdits: 0, saveStatuses: [], reloads: 0 }
  const api = {}
  const unsubscribeSpy = mods.notice.onOwnDeckEdit(() => { calls.ownEdits += 1 }) // the bridge the hook\'s noteOwnEdit listens on
  function Page() {
    const h = mods.hook.useDeckChangedNotice({ enabled: engine.env[NOTICE] === 'true', sessionId: SESSION, presentationId: DECK, onReload: () => { calls.reloads += 1 } })
    api.h = h
    return React.createElement(mods.component.StudioDeckChangedNotice, { notice: h.notice, unsaved: h.unsaved, onReload: h.reload, onDismiss: h.dismiss })
  }
  const root = new Root()
  root.setElement(React.createElement(Page))
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 160) throw new Error('did not settle'); await macrotask(); quiet = root.flush() ? 0 : quiet + 1 } }
  await settle()
  const refresh = async () => { root.schedule(); await settle() }
  // the viewer's handler: its REAL save-status block, with the real trust check, the real notice lib and the real bridges
  const viewerWindow = { name: 'layout viewer window' }
  const deps = {
    VIEWER_ORIGIN, LAYOUT_URL_CONFIG_ERROR: null, isTrustedLayoutViewerMessage: mods.messaging.isTrustedLayoutViewerMessage, isLayoutViewerEvent: mods.router.isLayoutViewerEvent,
    iframeRef: { current: { src: `${VIEWER_ORIGIN}/p/${DECK}`, contentWindow: viewerWindow } }, studioShell: true, viewerInteractionIntentRef: { current: 0 }, nativeSnapshotDirtyRef: { current: false },
    reportOwnDeckEdit: mods.notice.reportOwnDeckEdit, setNativeSnapshotSafetyRevision() {}, debugLog() {},
    // the viewer's effect: reportViewerDeckState({ presentationId, slideCount, unsaved: saveStatus !== 'saved' }) on every save status (section 4 holds the viewer to that expression)
    setSaveStatus: status => { calls.saveStatuses.push(status); mods.notice.reportViewerDeckState({ presentationId: DECK, slideCount: 3, unsaved: status !== 'saved' }) },
    isDeckSaveRefused: mods.refused?.isDeckSaveRefused, reportDeckSaveRefused: mods.refused?.reportDeckSaveRefused,
  }
  const modMake = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(cutHandler(engine.viewerText), VIEWER))(modMake, modMake.exports, () => { throw new Error('the cut handler takes its deps') }, { env: {} })
  const handler = modMake.exports.make(deps)
  const nodes = () => hostNodes(root.tree)
  const part = name => nodes().find(n => n.props?.['data-studio-deck-changed-part'] === name) ?? null
  const w = {
    api, calls, deps,
    async frame(data) { handler({ source: viewerWindow, origin: VIEWER_ORIGIN, data: JSON.parse(JSON.stringify(data)) }); await refresh() },
    async foreignFrame(data) { handler({ source: { name: 'another window' }, origin: VIEWER_ORIGIN, data }); await refresh() },
    async click(name) { const node = part(name); assert.ok(node, `no ${name} button`); node.props.onClick(); await refresh() },
    observe() {
      const bar = nodes().find(n => n.props?.['data-studio-deck-changed-notice'] !== undefined)
      return JSON.parse(JSON.stringify({
        ownEdits: calls.ownEdits, saveStatuses: calls.saveStatuses, reloads: calls.reloads, unsaved: api.h.unsaved,
        notice: bar ? { source: bar.props['data-studio-deck-changed-notice'], parts: nodes().filter(n => n.props?.['data-studio-deck-changed-part']).map(n => n.props['data-studio-deck-changed-part']),
          text: part('text') ? textOf(part('text')) : null, unsavedText: part('unsaved') ? textOf(part('unsaved')) : null, buttons: nodes().filter(n => n.type === 'button').map(n => textOf(n)) } : null,
      }))
    },
    markup: () => renderToStaticMarkup(toElements(root.tree)),
    unmount() { unsubscribeSpy(); root.unmount() },
  }
  return w
}

/** Every scenario's frames through a fresh mount, one observation per frame. */
async function traceAll(engine, names = Object.keys(T)) {
  const out = {}
  for (const name of names) {
    const w = await mount(engine)
    try { const rows = []; for (const frame of T[name].frames) { await w.frame(frame); rows.push(w.observe()) } out[name] = rows } finally { w.unmount() }
  }
  return out
}

const NOTICE_WORDS = 'This deck was updated'
/** What flag on means, stated from the frames and the notice's own words (not derived from the flag-off trace): used for the real engine and, expecting a throw, for every mutant. */
async function onChecks(engine, { traces } = {}) {
  const on = traces ?? await traceAll(engine)
  for (const kind of KINDS) {
    const name = `stale:${kind}`, rows = on[name], frames = T[name].frames
    let refusals = 0
    frames.forEach((frame, i) => {
      if (isRefusal(frame)) refusals++
      const row = rows[i]
      assert.deepEqual(row.saveStatuses, frames.slice(0, i + 1).map(f => f.status), `${name} #${i}: the save status path is unchanged`)
      assert.equal(row.ownEdits, i + 1 - refusals, `${name} #${i}: only the refusals are not counted as own edits`)
      if (refusals === 0) assert.equal(row.notice, null, `${name} #${i}: no notice before the refusal`)
      else {
        assert.ok(row.notice, `${name} #${i}: the notice is up`)
        assert.deepEqual(row.notice.parts, ['text', 'reload', 'dismiss']); assert.equal(row.notice.text, NOTICE_WORDS); assert.deepEqual(row.notice.buttons, ['Reload deck', 'Dismiss'])
      }
      assert.equal(row.reloads, 0, `${name} #${i}: nothing reloads on its own`)
      assert.equal(row.unsaved, frame.status !== 'saved', `${name} #${i}: the pending change reads as unsaved edits`)
    })
  }
  // the normal paths: no notice, every non-saved status an own edit, today
  const fault = on.fault; assert.equal(fault.at(-1).notice, null); assert.equal(fault.at(-1).ownEdits, T.fault.frames.length); assert.deepEqual(fault.at(-1).saveStatuses, T.fault.frames.map(f => f.status))
  assert.equal(on.own.at(-1).notice, null); assert.equal(on.own.at(-1).ownEdits, 0); assert.deepEqual(on.own.at(-1).saveStatuses, ['saved'])
  const flagOff = on['layout-flag-off:stale:refine']; assert.equal(flagOff.at(-1).notice, null); assert.equal(flagOff.at(-1).ownEdits, flagOff.length - flagOff.filter((_, i) => T['layout-flag-off:stale:refine'].frames[i].status === 'saved').length)
  // the user's say: Reload deck asks first, Keep editing keeps, a second refusal leaves the open question alone, only Reload anyway reloads
  const refuseFrames = T['stale:refine'].frames
  const w = await mount(engine)
  try {
    for (const frame of refuseFrames.slice(0, 3)) await w.frame(frame)
    assert.ok(w.observe().notice && w.observe().unsaved, 'refused: notice up and unsaved')
    await w.click('reload')
    let seen = w.observe()
    assert.equal(seen.reloads, 0, 'Reload deck with unsaved edits does not reload'); assert.deepEqual(seen.notice.parts, ['unsaved', 'reload-anyway', 'keep'])
    assert.equal(seen.notice.unsavedText, 'This tab has changes that are not saved yet. Reloading drops them.'); assert.deepEqual(seen.notice.buttons, ['Reload anyway', 'Keep editing'])
    await w.frame(refuseFrames[3])
    seen = w.observe(); assert.deepEqual(seen.notice.parts, ['unsaved', 'reload-anyway', 'keep'], 'a second refusal leaves the open question alone'); assert.equal(seen.reloads, 0)
    await w.click('keep')
    seen = w.observe(); assert.deepEqual(seen.notice.parts, ['text', 'reload', 'dismiss']); assert.equal(seen.reloads, 0, 'Keep editing keeps the edits')
    await w.click('reload'); await w.click('reload-anyway')
    seen = w.observe(); assert.equal(seen.reloads, 1, 'Reload anyway reloads, once'); assert.equal(seen.notice, null, 'and closes the notice')
  } finally { w.unmount() }
  const v = await mount(engine)
  try {
    for (const frame of refuseFrames.slice(0, 3)) await v.frame(frame)
    await v.click('dismiss'); assert.equal(v.observe().notice, null, 'Dismiss closes it')
    await v.frame(refuseFrames[4]); assert.equal(v.observe().notice, null, 'unsaved / saving after a refusal are the user\'s own edit and raise nothing')
    await v.frame(refuseFrames[5]); assert.equal(v.observe().notice, null)
    await v.frame(refuseFrames[6]); assert.ok(v.observe().notice, 'the next refusal raises it again'); assert.equal(v.observe().reloads, 0)
    // a message from another window is not the viewer's
    const before = JSON.stringify(v.observe()); await v.foreignFrame(refuseFrames[2]); assert.equal(JSON.stringify(v.observe()), before, 'an untrusted source is ignored')
  } finally { v.unmount() }
  return on
}

let engines = {}
const baseOverrides = () => ({ [HOOK]: baseText(HOOK), [NOTICE_LIB]: baseText(NOTICE_LIB) })
await check('the engines load: the real notice lib, sync-truth lib, hook, component and message helpers in one vm per env (own sources, and the base = this change\'s marked lines stripped)', async () => {
  const ownViewer = read(VIEWER), baseViewer = stripDeckSaveRefused(VIEWER, read(VIEWER))
  engines.on = await makeEngine({ env: ON_ENV })
  engines.off = await makeEngine({ env: { [NOTICE]: 'true', [TRUTH]: 'true' } })
  engines.base = await makeEngine({ env: ON_ENV, overrides: baseOverrides(), viewerText: baseViewer, refusedLib: false })
  assert.equal(typeof engines.on.mods.notice.createDeckChangedController, 'function'); assert.ok(ownViewer.includes('isDeckSaveRefused(event.data)'))
})
let onTraces, offTraces, baseTraces
await check('flag on: a refusal shows the existing notice with Reload deck, is not an own edit, leaves the save status alone, and the pending change is never dropped (Reload anyway / Keep editing); a normal error and the other frames are today\'s', async () => {
  onTraces = await onChecks(engines.on)
})
await check('flag off (and the base): the same frames give today\'s behaviour, no notice, every refusal an own edit and the generic "error" status; flag off hashes as the base', async () => {
  offTraces = await traceAll(engines.off); baseTraces = await traceAll(engines.base)
  assert.equal(sha(JSON.stringify(offTraces)), sha(JSON.stringify(baseTraces)), 'flag off: every observation of every frame hashes as the base\'s')
  for (const kind of KINDS) {
    const rows = offTraces[`stale:${kind}`]; assert.ok(rows.every(row => row.notice === null), `${kind}: no notice`)
    assert.equal(rows.at(-1).ownEdits, rows.length, `${kind}: every non-saved status, the refusals included, is an own edit (today)`); assert.equal(rows.at(-1).saveStatuses.filter(s => s === 'error').length, 3)
  }
})
await check('only the refusal differs: flag on against flag off, frame by frame, the save status and everything outside a refusal is identical; scenarios with no refusal are byte-identical', () => {
  for (const name of Object.keys(T)) {
    const hasRefusal = T[name].frames.some(isRefusal)
    if (!hasRefusal) { assert.equal(sha(JSON.stringify(onTraces[name])), sha(JSON.stringify(offTraces[name])), `${name}: identical`); continue }
    onTraces[name].forEach((row, i) => {
      const refusals = T[name].frames.slice(0, i + 1).filter(isRefusal).length
      assert.deepEqual(row.saveStatuses, offTraces[name][i].saveStatuses); assert.equal(row.ownEdits, offTraces[name][i].ownEdits - refusals); assert.equal(row.unsaved, offTraces[name][i].unsaved)
    })
  }
})
await check('the flag is only that flag: "false", "TRUE", "1", " true", "yes", "" and unset are off (the base\'s traces); either dependency off (the notice, sync-truth) is today\'s too, whatever this flag says', async () => {
  const frames = ['stale:refine', 'stale:add', 'fault', 'own']
  for (const value of ['false', 'TRUE', '1', ' true', 'yes', '']) {
    const e = await makeEngine({ env: { [FLAG]: value, [NOTICE]: 'true', [TRUTH]: 'true' } })
    assert.equal(sha(JSON.stringify(await traceAll(e, frames))), sha(JSON.stringify(Object.fromEntries(frames.map(f => [f, baseTraces[f]])))), `flag ${JSON.stringify(value)}`)
  }
  for (const [label, env] of [['notice off', { [FLAG]: 'true', [NOTICE]: 'false', [TRUTH]: 'true' }], ['sync-truth off', { [FLAG]: 'true', [NOTICE]: 'true', [TRUTH]: 'false' }], ['both unset', { [FLAG]: 'true' }]]) {
    const own = await makeEngine({ env }), base = await makeEngine({ env, overrides: baseOverrides(), viewerText: stripDeckSaveRefused(VIEWER, read(VIEWER)), refusedLib: false })
    const a = await traceAll(own, frames), b = await traceAll(base, frames)
    assert.equal(sha(JSON.stringify(a)), sha(JSON.stringify(b)), `${label}: today's behaviour`)
    assert.ok(Object.values(a).every(rows => rows.every(row => row.notice === null)), `${label}: no notice`)
  }
})
await check('the notice\'s words are all existing words: "This deck was updated", "Reload deck", "Dismiss", and with unsaved edits the base component\'s question; none is in this change', () => {
  const words = [NOTICE_WORDS, 'Reload deck', 'Dismiss', 'This tab has changes that are not saved yet. Reloading drops them.', 'Reload anyway', 'Keep editing']
  const shipped = `${read(COMPONENT)}\n${read(TRUTH_LIB)}`
  for (const word of words) assert.ok(shipped.includes(word), word)
  for (const rel of [COMPONENT, TRUTH_LIB]) assert.ok(!DECK_SAVE_REFUSED_MARKER_RE.test(read(rel)), `${rel} is not touched by this change`)
  for (const rel of DECK_SAVE_REFUSED_FILES) for (const line of read(rel).split('\n').filter(l => DECK_SAVE_REFUSED_MARKER_RE.test(l))) for (const word of words) assert.ok(!line.replace(/ \/\/ .*$/, '').includes(word), `${rel}: a marked line of code spells ${word}`)
})

// ============================================================================================================================================
// 4. Wiring and the strip
// ============================================================================================================================================
console.log('4. wiring and the strip')
const literalsOf = (text, file) => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const found = []
  const visit = node => { if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) found.push(node.text); ts.forEachChild(node, visit) }
  visit(source)
  return found
}
const markedOf = text => text.split('\n').filter(line => DECK_SAVE_REFUSED_MARKER_RE.test(line))
const COUNTS = { [VIEWER]: 2, [HOOK]: 3, [NOTICE_LIB]: 2 }
const wiringSources = () => ({ viewer: ownText(VIEWER), hook: ownText(HOOK), noticeLib: ownText(NOTICE_LIB), lib: read(LIB) })
function wiringSuite({ viewer, hook, noticeLib, lib }) {
  const own = { [VIEWER]: viewer, [HOOK]: hook, [NOTICE_LIB]: noticeLib }
  for (const [rel, text] of Object.entries(own)) {
    const base = stripDeckSaveRefused(rel, text), marked = markedOf(text)
    assert.equal(marked.length, COUNTS[rel], `${rel}: the marked lines`)
    assert.equal(text.split('\n').length - base.split('\n').length, COUNTS[rel], `${rel}: and nothing else is added`)
    assert.ok(!/DECK-SAVE-REFUSED-NOTICE/.test(base), `${rel}: the strip takes every line that carries the marker`)
    assert.equal(stripDeckSaveRefused(rel, base), base, `${rel}: stripping twice changes nothing more`)
  }
  // the viewer: an import and the dangling else, bound to the base's own call, placed after nativeSnapshotDirtyRef and AFTER the arrange guard's pair (never between a guard and its statement)
  const lines = viewer.split('\n'), at = lines.findIndex(line => DECK_SAVE_REFUSED_MARKER_RE.test(line) && line.includes('else'))
  assert.ok(at > 0, 'the viewer\'s else line')
  assert.ok(lines[at].startsWith('          if (isDeckSaveRefused(event.data)) reportDeckSaveRefused(); else // DECK-SAVE-REFUSED-NOTICE: '), 'the else line is the whole statement before the base\'s call')
  assert.equal(lines[at - 1], '          nativeSnapshotDirtyRef.current = true', 'it follows the base\'s dirty-flag line')
  assert.ok(lines[at + 1].startsWith('          reportOwnDeckEdit() // NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE: '), 'and the base\'s reportOwnDeckEdit() call is the next line, unchanged, its else branch')
  assert.ok(!lines[at + 1].includes('DECK-SAVE-REFUSED-NOTICE'), 'the base line is not edited')
  const importLine = lines.find(line => DECK_SAVE_REFUSED_MARKER_RE.test(line) && line.startsWith('import '))
  assert.equal(importLine, "import { isDeckSaveRefused, reportDeckSaveRefused } from '@/lib/studio-deck-save-refused' // DECK-SAVE-REFUSED-NOTICE")
  const guard = lines.findIndex(line => line.includes('if (!studioArrangeOwnsSaveStatus(status))'))
  if (guard !== -1) assert.ok(lines[guard + 1].trim().startsWith('if (studioShell) viewerInteractionIntentRef.current += 1'), 'the arrange guard still binds its own statement')
  // the viewer's unsaved report: the notice reads a save status other than saved as unsaved edits (what keeps the pending change from being dropped)
  assert.ok(viewer.includes("reportViewerDeckState({ presentationId: presentationId ?? null, slideCount: iframeReady && totalSlides > 0 ? totalSlides : null, unsaved: saveStatus !== 'saved' })"), 'the viewer reports unsaved: saveStatus !== saved')
  assert.ok(viewer.includes('setSaveStatus(status)'), 'and the handler still sets the save status')
  // the controller: one interface line, one method, behind the open-notice guard, the existing source, nothing else
  const [iface, method] = markedOf(noticeLib)
  assert.equal(iface.trim().replace(/ \/\/ DECK-SAVE-REFUSED-NOTICE.*$/, ''), 'noteSaveRefused(): void')
  assert.ok(method.trim().startsWith("noteSaveRefused() { if (disposed || notice) return; show('focus', null) }, // DECK-SAVE-REFUSED-NOTICE: "), 'the method: guard, show the existing "focus" source')
  assert.ok(!/quietRefresh|onResync|markReloaded|onNotice\(/.test(method.replace(/\/\/ DECK-SAVE-REFUSED-NOTICE.*$/, '')), 'it reloads and refreshes nothing')
  // the hook: an import, the subscription to the bridge and its unsubscribe
  const h = markedOf(hook)
  assert.equal(h[0], "import { onDeckSaveRefused } from '@/lib/studio-deck-save-refused' // DECK-SAVE-REFUSED-NOTICE")
  assert.ok(h[1].startsWith('    const offRefused = onDeckSaveRefused(() => controller.noteSaveRefused()) // DECK-SAVE-REFUSED-NOTICE'))
  assert.equal(h[2], '      offRefused() // DECK-SAVE-REFUSED-NOTICE')
  assert.ok(hook.indexOf('const offRefused') < hook.indexOf('const syncUnsaved') && hook.indexOf('      offRefused()') < hook.indexOf('controller.dispose()'), 'subscribed with the others, released in the same cleanup before the controller is disposed')
  assert.equal((hook.match(/offRefused/g) ?? []).length, 2, 'one subscription, one release')
  // the lib: import-free, three literal env reads, the flag exact "true", no UI copy
  assert.ok(!/^import /m.test(lib) && !/\brequire\(/.test(lib), 'the lib is import-free')
  assert.deepEqual(lib.match(/process\.env\.[A-Z_]+/g), [`process.env.${FLAG}`, `process.env.${NOTICE}`, `process.env.${TRUTH}`], 'the lib reads exactly its three flags, as literals (Next inlines them)')
  assert.equal((lib.match(/=== 'true'/g) ?? []).length, 3, 'each flag is the exact string true')
  assert.deepEqual([...new Set(literalsOf(lib, LIB))].sort(), ['error', 'object', 'true'], 'the lib\'s only string literals are not copy')
  assert.deepEqual([...new Set(markedOf(noticeLib).flatMap(line => literalsOf(line.replace(/\/\/.*$/, ''), 'x.ts')))], ['focus'], 'the controller\'s marked lines say no new word (the existing "focus" source)')
}
await check('the marked lines (viewer 2, hook 3, notice controller 2) and only they; the else binds only the base\'s call; the existing "focus" source; import-free lib with three exact-"true" literal reads; no new copy', () => wiringSuite(wiringSources()))
await check('the strip gives the base back byte for byte: working tree and BASE, other strips applied to both sides; the new files have no base', () => {
  for (const rel of DECK_SAVE_REFUSED_FILES) assert.equal(stripDeckSaveRefused(rel, otherStrips(rel, read(rel))), otherStrips(rel, execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 })), rel)
  for (const rel of DECK_SAVE_REFUSED_NEW_FILES) assert.ok(fs.existsSync(path.join(repo, rel)), rel)
  for (const rel of ['.env.example', 'package.json', COMPONENT, TRUTH_LIB]) assert.equal(stripDeckSaveRefused(rel, 'x'), 'x')
})
await check('the page is not touched: the notice hook\'s call and flag reads are the base\'s (the registry strips every other change; this change has no page line)', () => {
  assert.ok(!DECK_SAVE_REFUSED_MARKER_RE.test(read('app/builder/page.tsx')), 'no marked line in the page')
  assert.ok(!stripModule.DECK_SAVE_REFUSED_FILES.includes('app/builder/page.tsx'))
})

// ============================================================================================================================================
// 5. Mutants
// ============================================================================================================================================
console.log('5. mutants')
const caughtBy = []
const replaceOnce = (text, from, to) => { assert.ok(text.split(from).length === 2, `mutant anchor not unique/present: ${from.slice(0, 70)}`); return text.replace(from, () => to) }
/** A mutant is caught when the lib suite, the wiring suite or the world checks throw for it. */
async function mutant(label, { viewer, hook, noticeLib, lib, env = ON_ENV }) {
  const sources = wiringSources()
  const texts = { viewer: viewer ?? sources.viewer, hook: hook ?? sources.hook, noticeLib: noticeLib ?? sources.noticeLib, lib: lib ?? sources.lib }
  const tried = []
  for (const [name, run] of [
    ['world', async () => { const e = await makeEngine({ env, overrides: { [HOOK]: texts.hook, [NOTICE_LIB]: texts.noticeLib, [LIB]: texts.lib }, viewerText: texts.viewer }); await onChecks(e) }],
    ['lib suite', () => { if (texts.lib === sources.lib) throw new Error('lib unchanged'); return libSuite(texts.lib) }],
    ['wiring', () => wiringSuite(texts)],
  ]) {
    try { await run() } catch (error) { if (name === 'lib suite' && error.message === 'lib unchanged') continue; caughtBy.push(`  ${label.padEnd(60)} ${name.padEnd(10)} ${String(error.message).split('\n')[0].slice(0, 110)}`); return }
    tried.push(name)
  }
  assert.fail(`MISSED: ${label} (passed ${tried.join(', ')})`)
}
const S = wiringSources()
await check('mutant caught: the else removed (both the notice and the own-edit call run)', () => mutant('viewer: the dangling else removed', { viewer: replaceOnce(S.viewer, 'reportDeckSaveRefused(); else //', 'reportDeckSaveRefused(); //') }))
await check('mutant caught: the predicate fed the event, not its data (never a refusal)', () => mutant('viewer: isDeckSaveRefused(event)', { viewer: replaceOnce(S.viewer, 'isDeckSaveRefused(event.data)', 'isDeckSaveRefused(event)') }))
await check('mutant caught: the else line moved between the arrange guard and its statement', () => mutant('viewer: the else line inside the arrange guard pair', { viewer: (() => {
  const lines = S.viewer.split('\n'), at = lines.findIndex(line => line.includes('reportDeckSaveRefused(); else')), guard = lines.findIndex(line => line.includes('if (!studioArrangeOwnsSaveStatus(status))'))
  const [moved] = lines.splice(at, 1); lines.splice(guard + 1, 0, moved); return lines.join('\n')
})() }))
await check('mutant caught: the base line edited instead of a pure insertion', () => mutant('viewer: reportOwnDeckEdit line edited', { viewer: replaceOnce(S.viewer, '          reportOwnDeckEdit() // NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE:', '          reportOwnDeckEdit() // DECK-SAVE-REFUSED-NOTICE edited: NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE:') }))
await check('mutant caught: the predicate without the status test (unsaved / saving after a refusal read as refusals)', () => mutant('lib: deckChanged alone', { lib: replaceOnce(S.lib, "message.status === 'error' && message.deckChanged === true", 'message.deckChanged === true') }))
await check('mutant caught: a truthy deckChanged', () => mutant('lib: Boolean(deckChanged)', { lib: replaceOnce(S.lib, "message.status === 'error' && message.deckChanged === true", "message.status === 'error' && Boolean(message.deckChanged)") }))
await check('mutant caught: the flag without the dependencies (sync-truth ignored, so the notice would say "in another tab")', () => mutant('lib: sync-truth not required', { lib: replaceOnce(S.lib, "\n  && process.env.NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH === 'true'", '') }))
await check('mutant caught: the flag read loosely (any non-empty value)', () => mutant('lib: flag !== false', { lib: replaceOnce(S.lib, "process.env.NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE === 'true'", "process.env.NEXT_PUBLIC_STUDIO_DECK_SAVE_REFUSED_NOTICE !== 'false'") }))
await check('mutant caught: the bridge subscribes and reports while not active (both guards gone)', () => mutant('lib: bridge unguarded', { lib: replaceOnce(replaceOnce(S.lib, 'export function reportDeckSaveRefused(): void {\n  if (!STUDIO_DECK_SAVE_REFUSED_ACTIVE) return\n', 'export function reportDeckSaveRefused(): void {\n'), "  if (!STUDIO_DECK_SAVE_REFUSED_ACTIVE) return () => {}\n", '') }))
await check('mutant caught: the controller raises the notice again while one is open (an open Reload anyway question is reset)', () => mutant('controller: no open-notice guard', { noticeLib: replaceOnce(S.noticeLib, 'noteSaveRefused() { if (disposed || notice) return; show(', 'noteSaveRefused() { if (disposed) return; show(') }))
await check('mutant caught: the controller reloads quietly (the pending change dropped)', () => mutant('controller: quietRefresh after show', { noticeLib: replaceOnce(S.noticeLib, "show('focus', null) }, // DECK-SAVE-REFUSED-NOTICE", "show('focus', null); deps.quietRefresh?.() }, // DECK-SAVE-REFUSED-NOTICE") }))
await check('mutant caught: a new word in the notice', () => mutant('controller: a new source', { noticeLib: replaceOnce(S.noticeLib, "show('focus', null) }, // DECK-SAVE-REFUSED-NOTICE", "show('save-refused', null) }, // DECK-SAVE-REFUSED-NOTICE") }))
await check('mutant caught: the hook does not subscribe', () => mutant('hook: no subscription', { hook: S.hook.split('\n').filter(line => !line.includes('const offRefused')).join('\n') }))
await check('mutant caught: the hook never releases the subscription', () => mutant('hook: no unsubscribe', { hook: S.hook.split('\n').filter(line => !/^\s+offRefused\(\)/.test(line)).join('\n') }))
await check('mutant caught: the hook subscribes to the wrong signal (an own edit, not a refusal)', () => mutant('hook: wired to noteOwnEdit', { hook: replaceOnce(S.hook, 'controller.noteSaveRefused()', 'controller.noteOwnEdit()') }))
await check('mutant caught: a marker removed from a line (the strip would leave it behind)', () => mutant('hook: unmarked subscription', { hook: replaceOnce(S.hook, '// DECK-SAVE-REFUSED-NOTICE: Layout refused a stale whole-deck save: this tab shows', '// Layout refused a stale whole-deck save: this tab shows') }))
console.log('mutants (each caught by):'); for (const line of caughtBy) console.log(line)

// ============================================================================================================================================
// 6. Scope over the COMMITTED diff (BASE..head), gate-safe and robust after merge
// ============================================================================================================================================
console.log('6. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 })
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-29T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-29T00:00:00Z' }
const plumb = (args, env) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run); --no-filters, stdin ignored, 60 s. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsr-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(DECK_SAVE_REFUSED_SUBJECT))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits, whether or not dev has moved past BASE) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it, whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const REAL = { files: registry.LATER_CHANGE_FILES, norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
/** `git diff -U0` of the base file against the file at `head`, both read through ctx.norm (every other change's lines out). */
const normDiff = (ctx, rel, head) => git('diff', '-U0', blobOf(ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`))))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  return own
}
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].sort(), [...DECK_SAVE_REFUSED_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of DECK_SAVE_REFUSED_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, DECK_SAVE_REFUSED_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.equal(diff.length, COUNTS[rel], `${rel}: the number of added lines`)
    assert.equal(stripDeckSaveRefused(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of DECK_SAVE_REFUSED_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['app/builder/page.tsx', COMPONENT, TRUTH_LIB, 'package.json']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(DECK_SAVE_REFUSED_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${DECK_SAVE_REFUSED_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-deck-save-refused-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['DECK_SAVE_REFUSED_SCOPE_FILES', 'DECK_SAVE_REFUSED_ENV_BLOCK', 'stripDeckSaveRefused'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${DECK_SAVE_REFUSED_SUBJECT}", found across the whole line, no merges) exist, with the co-author line`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to the three files is a pure insertion that carries the marker; the strip gives the base back byte for byte (other changes\' lines out of both sides)', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of ['scripts/test-studio-deck-save-refused-notice.mjs', 'scripts/studio-deck-save-refused-strip.mjs', 'scripts/studio-deck-save-refused-layout.mjs', LIB, FIXTURE]) assert.doesNotMatch(fs.readFileSync(path.join(repo, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of DECK_SAVE_REFUSED_FILES) assert.equal(stripDeckSaveRefused(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await check('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsr-idx-'))
  try {
    const env = { GIT_INDEX_FILE: path.join(dir, 'index') }
    plumb(['read-tree', parent], env)
    for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], env)
    return plumb(['commit-tree', plumb(['write-tree'], env), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await check('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE (an unrelated commit): the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
// a SYNTHETIC change stacked after this one: marked lines beside this change's own in the controller and the viewer, a registry trio below this change's, an .env.example block, a new file
const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
const syntheticStrip = (rel, text) => (rel === NOTICE_LIB || rel === VIEWER) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const noticeLib = at(NOTICE_LIB).split('\n').flatMap(line => line.includes('noteSaveRefused() {') ? [line, `    noteSyntheticLater() { return }, // ${SYN.marker}`] : [line]).join('\n')
  const viewer = at(VIEWER).split('\n').flatMap(line => line.startsWith("import { isDeckSaveRefused, reportDeckSaveRefused }") ? [line, `const syntheticLater = 1 // ${SYN.marker}`] : [line]).join('\n')
  const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('DECK_SAVE_REFUSED_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('DECK_SAVE_REFUSED_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripDeckSaveRefused')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  return commitWith(parent, { [NOTICE_LIB]: noticeLib, [VIEWER]: viewer, 'scripts/studio-later-changes.mjs': reg, '.env.example': `${at('.env.example')}\n${SYN.block}`, [SYN.file]: 'export const SYNTHETIC_SCOPE_FILES = new Set()\n' }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC = syntheticCommit(HEAD)
const SYN_CTX = { files: new Set([...registry.LATER_CHANGE_FILES, SYN.file]), norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)), env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, '') }
await check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked lines beside this change\'s in the controller and the viewer, a registry trio, an .env.example block, a new file; its own commit has another subject) leaves this change\'s scope section passing, on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  assert.ok(ownOf(SYNTHETIC).length === ownOf(HEAD).length && !ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  for (const rel of DECK_SAVE_REFUSED_FILES) assert.equal(stripDeckSaveRefused(rel, SYN_CTX.norm(rel, git('show', `${gate}:${rel}`))), SYN_CTX.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree is the base's ${rel} without this change's and the later change's lines`)
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its lines are unmarked additions, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|number of added lines|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray non-B46 file in a "Save refused notice:" commit fails the committed-files check (the own commits are found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-save-refused.txt': 'stray\n' }, `${DECK_SAVE_REFUSED_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, and an unmarked line added to the viewer in an own commit, fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${DECK_SAVE_REFUSED_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  const sneaky = commitWith(HEAD, { [VIEWER]: git('show', `${HEAD}:${VIEWER}`).replace('const [saveStatus, setSaveStatus]', 'const sneaky = 1\n  const [saveStatus, setSaveStatus]') }, `${DECK_SAVE_REFUSED_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/)
})

release()
console.log(`\nLayout frames from ${FIX.meta.layoutCommit}${live ? ` (live export ${path.basename(LAYOUT_DIR)} re-recorded now and equal to the fixture)` : ' (fixture)'}`)
console.log(`${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed  [${MODE}]`)
process.exit(failed ? 1 : 0)
