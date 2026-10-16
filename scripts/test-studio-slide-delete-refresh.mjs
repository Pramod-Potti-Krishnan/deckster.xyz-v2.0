// PASS2D B4: after a slide is deleted the canvas stops showing it until the reloaded Layout frame has painted
// (flag NEXT_PUBLIC_STUDIO_SLIDE_DELETE_CANVAS_REFRESH, exact "true", default off).
// Offline and self-contained: no network, no git, no browser. The repo root is found from this file (package.json anchor).
// It loads the import-free store (lib/studio-slide-delete-refresh.ts) on its own and drives it with a fake clock and a fake viewer:
// the veil starts only when the delete is acknowledged and no frame has loaded since the command was sent, lifts on the next frame load or
// after 45 s, never lifts a newer veil early, and a viewer that goes away lifts it. It renders the REAL veil component, and reads the REAL
// viewer source: the six marked lines sit at their exact places, each is guarded by the flag (or is an import / a ref read), none adds
// a hook, and with the marked lines removed the delete handler and the frame-load handler are the base's. Then every suite re-runs against
// deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_SLIDE_DELETE_CANVAS_REFRESH'
const FILES = {
  lib: 'lib/studio-slide-delete-refresh.ts',
  veil: 'components/builder/studio-slide-delete-refresh-veil.tsx',
  viewer: 'components/presentation-viewer.tsx',
}
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const SRC = Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, read(rel)]))
const ENVEX = read('.env.example')
const PKG = JSON.parse(read('package.json'))

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
function createWorld({ env = {}, src = {} } = {}) {
  const sources = { ...SRC, ...src }
  const cache = new Map()
  const stubs = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    '@/components/builder/studio-waiting-state': { StudioWaitingState: props => React.createElement('div', { 'data-stub': 'waiting', 'data-scope': props.scope }, props.message) },
  }
  function load(rel, source) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec === '@/lib/studio-slide-delete-refresh') return load(FILES.lib, sources.lib)
      throw new Error(`unexpected import ${spec} from ${rel}`)
    }
    new Function('module', 'exports', 'require', 'process', compile(rel, source))(module, module.exports, require, { env })
    return module.exports
  }
  return { lib: () => load(FILES.lib, sources.lib), veil: () => load(FILES.veil, sources.veil) }
}

// ---------------------------------------------------------------- fake clock
function makeClock() {
  const clock = { now: 0, timers: new Set(), cleared: 0 }
  clock.setTimer = (callback, ms) => { const timer = { at: clock.now + ms, callback }; clock.timers.add(timer); return timer }
  clock.clearTimer = handle => { if (clock.timers.delete(handle)) clock.cleared++ }
  clock.advance = ms => {
    const target = clock.now + ms
    for (;;) {
      const due = [...clock.timers].filter(timer => timer.at <= target).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      clock.timers.delete(due); clock.now = due.at; due.callback()
    }
    clock.now = target
  }
  return clock
}

// ---------------------------------------------------------------- suites
function suiteFlag(src = {}) {
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['yes', false], ['true', true]]) {
    const env = value === undefined ? {} : { [FLAG]: value }
    check(assert.equal, createWorld({ env, src }).lib().STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED, expected, `flag ${JSON.stringify(value)}`)
  }
  check(assert.equal, createWorld({ src }).lib().STUDIO_SLIDE_DELETE_REFRESH_TIMEOUT_MS, 45_000)
}
function suiteStore(src = {}) {
  const lib = createWorld({ src }).lib()
  const make = () => { const clock = makeClock(); const events = []; const store = lib.createSlideDeleteRefreshStore(clock); store.subscribe(() => events.push(store.getSnapshot())); return { clock, events, store } }

  // 1. the normal case: acknowledged with no frame since the send -> veil; the reloaded frame loads -> lifted at once, timer dropped
  { const { clock, events, store } = make()
    check(assert.equal, store.getSnapshot(), false, 'idle: no veil')
    check(assert.equal, store.acknowledged({ revisionAtSend: 3, revisionNow: 3 }), true, 'veils')
    check(assert.equal, store.getSnapshot(), true)
    check(assert.equal, clock.timers.size, 1, 'one safety timer')
    clock.advance(10_000)
    check(assert.equal, store.getSnapshot(), true, 'still up while the new frame has not painted')
    store.frameLoaded()
    check(assert.equal, store.getSnapshot(), false, 'lifted by the frame load')
    check(assert.equal, clock.timers.size, 0, 'timer dropped')
    check(assert.deepEqual, events, [true, false], 'one notification per change') }

  // 2. a frame loaded between the send and the reply (a fast reload): no veil is ever started, so none can be left up
  { const { clock, events, store } = make()
    check(assert.equal, store.acknowledged({ revisionAtSend: 3, revisionNow: 4 }), false)
    check(assert.equal, store.getSnapshot(), false)
    check(assert.equal, clock.timers.size, 0, 'no timer')
    check(assert.deepEqual, events, [], 'no notification') }

  // 3. nothing ever reloads (a Layout that did not): 45 s lifts it
  { const { clock, store } = make()
    store.acknowledged({ revisionAtSend: 1, revisionNow: 1 })
    clock.advance(44_999); check(assert.equal, store.getSnapshot(), true, 'up at 44.999 s')
    clock.advance(1); check(assert.equal, store.getSnapshot(), false, 'lifted at 45 s')
    check(assert.equal, clock.timers.size, 0) }

  // 4. a second delete while a veil is up restarts the 45 s window and never lets the old timer lift the new veil early
  { const { clock, events, store } = make()
    store.acknowledged({ revisionAtSend: 1, revisionNow: 1 })
    clock.advance(30_000)
    store.acknowledged({ revisionAtSend: 1, revisionNow: 1 })
    check(assert.equal, clock.timers.size, 1, 'one timer, the old one cleared')
    clock.advance(30_000); check(assert.equal, store.getSnapshot(), true, 'the old timer would have fired here')
    clock.advance(15_000); check(assert.equal, store.getSnapshot(), false)
    check(assert.deepEqual, events, [true, false], 'no extra notification for the repeated acknowledgement') }

  // 5. a frame load with no veil, and reset, are harmless; reset lifts and drops the timer
  { const { clock, events, store } = make()
    store.frameLoaded(); store.reset()
    check(assert.deepEqual, events, [])
    store.acknowledged({ revisionAtSend: 2, revisionNow: 2 })
    store.reset()
    check(assert.equal, store.getSnapshot(), false); check(assert.equal, clock.timers.size, 0)
    check(assert.deepEqual, events, [true, false]) }

  // 6. subscribers: unsubscribe stops notifications; a listener removed during a notification does not break the others
  { const { store } = make()
    const seen = []
    const off = store.subscribe(() => seen.push('a'))
    store.subscribe(() => seen.push('b'))
    store.acknowledged({ revisionAtSend: 0, revisionNow: 0 })
    off(); store.frameLoaded()
    check(assert.deepEqual, seen, ['a', 'b', 'b']) }

  // 7. the module's shared store is a real store on the real clock
  { const shared = lib.studioSlideDeleteRefresh
    check(assert.equal, typeof shared.acknowledged, 'function')
    shared.acknowledged({ revisionAtSend: 0, revisionNow: 0 }); check(assert.equal, shared.getSnapshot(), true)
    shared.reset(); check(assert.equal, shared.getSnapshot(), false) }
}
function suiteVeil(src = {}) {
  const world = createWorld({ src })
  const lib = world.lib()
  const { StudioSlideDeleteRefreshVeil } = world.veil()
  lib.studioSlideDeleteRefresh.reset()
  check(assert.equal, renderToStaticMarkup(React.createElement(StudioSlideDeleteRefreshVeil)), '', 'no veil: renders nothing')
  lib.studioSlideDeleteRefresh.acknowledged({ revisionAtSend: 0, revisionNow: 0 })
  const html = renderToStaticMarkup(React.createElement(StudioSlideDeleteRefreshVeil))
  check(assert.match, html, /data-studio-canvas-refreshing="true"/)
  check(assert.match, html, /class="absolute inset-0 z-30"/, 'over the iframe, above the loading overlay (z-20)')
  check(assert.doesNotMatch, html, /pointer-events-none/, 'not click-through: the stale document must not be edited')
  check(assert.match, html, /data-scope="canvas"/)
  check(assert.match, html, />Updating your slides…</)
  lib.studioSlideDeleteRefresh.reset()
  check(assert.equal, renderToStaticMarkup(React.createElement(StudioSlideDeleteRefreshVeil)), '', 'lifted: renders nothing again')
  const veil = src.veil ?? SRC.veil
  check(assert.match, veil, /useEffect\(\(\) => \(\) => studioSlideDeleteRefresh\.reset\(\), \[\]\)/, 'unmounting (the viewer going away) lifts the veil')
  check(assert.match, veil, /useSyncExternalStore\(studioSlideDeleteRefresh\.subscribe, studioSlideDeleteRefresh\.getSnapshot, studioSlideDeleteRefresh\.getSnapshot\)/)
}

// The viewer: six marked lines, in file order (two imports, the frame-load handler, the delete handler twice, the canvas JSX), each at its exact place, each guarded (or an import / a ref read), none adds a hook.
const MARK = 'PASS2D B4'
const INSERTS = [
  { name: 'import of the flag and the store', previous: ["import { STUDIO_DECK_MUTATION_REFRESH_ENABLED, onSlideRailRefreshRequest } from '@/lib/studio-deck-mutation-refresh'"],
    body: /^import \{ STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED, studioSlideDeleteRefresh \} from '@\/lib\/studio-slide-delete-refresh'/ },
  { name: 'import of the veil', previous: ['import { STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED, studioSlideDeleteRefresh }'],
    body: /^import \{ StudioSlideDeleteRefreshVeil \} from '@\/components\/builder\/studio-slide-delete-refresh-veil'/ },
  { name: 'the frame load', previous: ['studioComposeLoadRevisionRef.current += 1'],
    body: /^if \(STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED\) studioSlideDeleteRefresh\.frameLoaded\(\) /, guarded: true },
  { name: 'the frame lifetime at the moment of the send', previous: ["debugLog('🗑️ Attempting bulk delete with indices:', slidesToDelete)"],
    body: /^const deleteLoadRevision = studioComposeLoadRevisionRef\.current /, ref: true },
  { name: 'the acknowledgement', previous: ['throw new Error(errorMsg)', '}'],
    body: /^if \(STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studioShell\) studioSlideDeleteRefresh\.acknowledged\(\{ revisionAtSend: deleteLoadRevision, revisionNow: studioComposeLoadRevisionRef\.current \}\) /, guarded: true },
  { name: 'the veil in the canvas', previous: ['<StudioWaitingState scope="canvas" message="Loading your slides…" />', '</div>}'],
    body: /^\{studioShell && STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && <StudioSlideDeleteRefreshVeil \/>\}\{\/\* PASS2D B4 \*\/\}$/, guarded: true },
]
function suiteViewer(src = {}) {
  const viewer = src.viewer ?? SRC.viewer
  const lines = viewer.split('\n')
  const marked = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.includes(MARK))
  check(assert.equal, marked.length, INSERTS.length, `exactly ${INSERTS.length} marked lines in the viewer`)
  INSERTS.forEach((insert, i) => {
    const { line, index } = marked[i]
    check(assert.match, line.trim(), insert.body, insert.name)
    insert.previous.forEach((text, back) => {
      const above = lines[index - insert.previous.length + back].trim()
      check(assert.ok, above.startsWith(text), `${insert.name}: the line ${insert.previous.length - back} above is ${text} (got ${above})`)
    })
    if (insert.guarded) check(assert.match, line, /STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED/, `${insert.name}: guarded by the flag`)
    check(assert.doesNotMatch, line, /\buse[A-Z][A-Za-z]*\(/, `${insert.name}: adds no hook`)
  })
  // the viewer reads the flag only through the helper (one reader of the environment)
  check(assert.doesNotMatch, viewer, new RegExp(`process\\.env\\.${FLAG}`))
  // nothing else in the viewer mentions the store
  const mentions = lines.filter(line => /studioSlideDeleteRefresh|StudioSlideDeleteRefreshVeil|STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED|deleteLoadRevision/.test(line))
  check(assert.equal, mentions.length, INSERTS.length, 'only the marked lines mention the store, the veil, the flag or the captured revision')
}
function suiteWiring(src = {}) {
  check(assert.match, ENVEX, new RegExp(`^${FLAG}="false"$`, 'm'), 'documented in .env.example, default off')
  check(assert.equal, PKG.scripts['test:studio-slide-delete-refresh'], 'node scripts/test-studio-slide-delete-refresh.mjs', 'npm script registered')
  const lib = src.lib ?? SRC.lib
  check(assert.doesNotMatch, lib, /^import\s/m, 'the helper has no imports')
  const readers = []
  for (const rel of ['components', 'lib', 'hooks', 'app']) {
    const walk = dir => { for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
      const next = path.posix.join(dir, entry.name)
      if (entry.isDirectory()) walk(next)
      else if (/\.(ts|tsx)$/.test(entry.name) && fs.readFileSync(path.join(repoRoot, next), 'utf8').includes(`process.env.${FLAG}`)) readers.push(next)
    } }
    walk(rel)
  }
  check(assert.deepEqual, readers, [FILES.lib], 'the flag is read in exactly one file')
}
const SUITES = { flag: suiteFlag, store: suiteStore, veil: suiteVeil, viewer: suiteViewer, wiring: suiteWiring }
for (const [name, suite] of Object.entries(SUITES)) { suite(); console.log(`ok   ${name}`) }

// ---------------------------------------------------------------- mutants
const replaceOnce = (source, from, to) => { assert.ok(source.includes(from), `mutant anchor missing: ${from}`); return source.replace(from, to) }
const MUTANTS = [
  ['flag parse accepts any truthy value', { lib: s => replaceOnce(s, "process.env.NEXT_PUBLIC_STUDIO_SLIDE_DELETE_CANVAS_REFRESH === 'true'", '!!process.env.NEXT_PUBLIC_STUDIO_SLIDE_DELETE_CANVAS_REFRESH') }],
  ['timeout is 60 s', { lib: s => replaceOnce(s, '45_000', '60_000') }],
  ['veils even when a frame loaded since the send', { lib: s => replaceOnce(s, 'if (revisionNow !== revisionAtSend) return false', '') }],
  ['veils never (the revision test is inverted)', { lib: s => replaceOnce(s, 'if (revisionNow !== revisionAtSend) return false', 'if (revisionNow === revisionAtSend) return false') }],
  ['no safety timer', { lib: s => replaceOnce(s, 'timer = clock.setTimer(() => { timer = null; lift() }, timeoutMs)', 'timer = null') }],
  ['the safety timer fires on the wrong clock (does not lift)', { lib: s => replaceOnce(s, 'timer = clock.setTimer(() => { timer = null; lift() }, timeoutMs)', 'timer = clock.setTimer(() => { timer = null }, timeoutMs)') }],
  ['a repeated acknowledgement leaves the old timer running', { lib: s => replaceOnce(s, 'if (timer !== null) clock.clearTimer(timer)\n      timer = clock.setTimer', 'timer = clock.setTimer') }],
  ['the frame load does not lift the veil', { lib: s => replaceOnce(s, 'frameLoaded: lift,', 'frameLoaded() {},') }],
  ['reset does not lift the veil', { lib: s => replaceOnce(s, 'reset: lift,', 'reset() {},') }],
  ['lift keeps the timer', { lib: s => replaceOnce(s, 'if (timer !== null) { clock.clearTimer(timer); timer = null }\n    if (!active) return', 'if (!active) return') }],
  ['notifies on every acknowledgement', { lib: s => replaceOnce(s, 'if (!active) { active = true; emit() }', 'active = true; emit()') }],
  ['unsubscribe does nothing', { lib: s => replaceOnce(s, 'return () => { listeners.delete(listener) }', 'return () => {}') }],
  ['lib gains an import', { lib: s => `import fs from 'fs'\n${s}` }],
  ['veil is click-through', { veil: s => replaceOnce(s, 'className="absolute inset-0 z-30"', 'className="absolute inset-0 z-30 pointer-events-none"') }],
  ['veil sits under the loading overlay', { veil: s => replaceOnce(s, 'z-30', 'z-10') }],
  ['veil forgets to reset on unmount', { veil: s => replaceOnce(s, 'useEffect(() => () => studioSlideDeleteRefresh.reset(), [])', '') }],
  ['veil copy changed', { veil: s => replaceOnce(s, 'Updating your slides…', 'Loading…') }],
  ['veil ignores the store', { veil: s => replaceOnce(s, 'if (!active) return null', 'if (false) return null') }],
  ['viewer: acknowledgement not guarded by the flag', { viewer: s => replaceOnce(s, 'if (STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studioShell) studioSlideDeleteRefresh.acknowledged(', 'if (studioShell) studioSlideDeleteRefresh.acknowledged(') }],
  ['viewer: frame load not guarded by the flag', { viewer: s => replaceOnce(s, 'if (STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED) studioSlideDeleteRefresh.frameLoaded()', 'studioSlideDeleteRefresh.frameLoaded()') }],
  ['viewer: veil mounted without the flag', { viewer: s => replaceOnce(s, '{studioShell && STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && <StudioSlideDeleteRefreshVeil />}', '{studioShell && <StudioSlideDeleteRefreshVeil />}') }],
  ['viewer: the revision is read after the reply (not at the send)', { viewer: s => replaceOnce(s, 'revisionAtSend: deleteLoadRevision', 'revisionAtSend: studioComposeLoadRevisionRef.current') }],
  ['viewer: a marked line moved', { viewer: s => replaceOnce(s, "      debugLog('🗑️ Attempting bulk delete with indices:', slidesToDelete)\n", "      debugLog('🗑️ Attempting bulk delete with indices:', slidesToDelete)\n      void 0\n") }],
  ['viewer: a hook added on a marked line', { viewer: s => replaceOnce(s, 'studioSlideDeleteRefresh.frameLoaded() // PASS2D B4', 'studioSlideDeleteRefresh.frameLoaded(); useRef(0) // PASS2D B4') }],
  ['viewer: the flag read in the viewer directly', { viewer: s => `const __x = process.env.NEXT_PUBLIC_STUDIO_SLIDE_DELETE_CANVAS_REFRESH\n${s}` }],
]
let caught = 0
for (const [label, mutation] of MUTANTS) {
  const src = {}
  for (const [key, fn] of Object.entries(mutation)) src[key] = fn(SRC[key])
  let failedIn = null
  for (const [name, suite] of Object.entries(SUITES)) {
    try { suite(src) } catch { failedIn = name; break }
  }
  assert.ok(failedIn, `mutant NOT caught: ${label}`)
  caught++
  if (process.env.VERBOSE) console.log(`     caught by [${failedIn}]: ${label}`)
}
console.log(`ok   mutants: ${caught} of ${MUTANTS.length} caught`)
console.log(`PASS: studio slide delete refresh (${checks} checks, ${MUTANTS.length} mutants)`)
