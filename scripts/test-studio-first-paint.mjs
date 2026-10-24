// COMPOSER-2 (FUTURE-OPS-2 section 3, row 4 "first paint"): Studio opens its connections early and polls the Layout viewer's slide info the moment the viewer has loaded
// (flag NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED, exact "true", default off). This file proves lib/studio-first-paint.ts; scripts/test-studio-first-paint-viewer.mjs proves the viewer's use of it.
// Run: node scripts/test-studio-first-paint.mjs   (plain node: transpile + vm, no network, no timers, no browser, no git)
//
// What runs for real: the lib's own source, transpiled and evaluated in a vm. What is modelled: react-dom (a recorder with preconnect and prefetchDNS), setInterval (a recorder that never fires on its own;
// the test fires the callbacks it was given), Date.now (a counter), and `document` (present = a browser, absent = a server render).
// Then every suite is re-run against deliberately broken copies of the lib: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIB = 'lib/studio-first-paint.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED'
const source = fs.readFileSync(path.join(repoRoot, LIB), 'utf8')
let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }
const settle = () => new Promise(resolve => setImmediate(resolve))

/** Evaluate the lib (or a mutated copy) with the given env and world. */
function load({ env = {}, browser = false, text = source } = {}) {
  const compiled = ts.transpileModule(text, { fileName: LIB, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const errors = (compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, 'the lib transpiles')
  const world = { preconnect: [], prefetchDNS: [], intervals: [], timeouts: [], now: 1_000_000 }
  const reactDom = {
    preconnect: (...args) => world.preconnect.push(args),
    prefetchDNS: (...args) => world.prefetchDNS.push(args),
  }
  const module = { exports: {} }
  const context = {
    module, exports: module.exports, URL, WeakMap, Set, Promise,
    process: { env },
    require: spec => { assert.equal(spec, 'react-dom', 'the lib imports only react-dom'); return reactDom },
    setInterval: (fn, ms) => { world.intervals.push({ fn, ms }); return world.intervals.length },
    setTimeout: (fn, ms) => { world.timeouts.push({ fn, ms }); return world.timeouts.length },
    Date: { now: () => world.now },
    ...(browser ? { document: {} } : {}),
  }
  vm.runInNewContext(compiled.outputText, context, { filename: LIB })
  return { lib: module.exports, world }
}
const on = { [FLAG]: 'true' }
const asPlain = value => JSON.parse(JSON.stringify(value))

const unhandled = []
process.on('unhandledRejection', reason => { unhandled.push(reason) })

async function suites(text = source) {
  const L = opts => load({ text, ...opts })

  // ---- 1. the flag: exact "true", default off, read in one place ------------------------------------------------------------
  for (const value of [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', '"true"']) {
    check(assert.equal, L({ env: value === undefined ? {} : { [FLAG]: value } }).lib.STUDIO_FIRST_PAINT_ENABLED, false, `flag value ${JSON.stringify(value)} is off`)
  }
  check(assert.equal, L({ env: on }).lib.STUDIO_FIRST_PAINT_ENABLED, true, 'the exact value "true" is on')
  check(assert.equal, (text.match(new RegExp(`process\\.env\\.${FLAG}\\b`, 'g')) ?? []).length, 1, 'the flag is read once, as process.env.NEXT_PUBLIC_... (Next inlines it)')
  check(assert.match, text, new RegExp(`process\\.env\\.${FLAG} === 'true'`), 'exact-true comparison')
  check(assert.deepEqual, [...text.matchAll(/^import .* from '(.*)'$/gm)].map(m => m[1]), ['react-dom'], 'the lib\'s only import is react-dom')

  // ---- 2. origins: parse, de-dupe, crossOrigin set --------------------------------------------------------------------------
  const { lib } = L({ env: on })
  for (const [input, want] of [
    ['https://layout.example.com', 'https://layout.example.com'],
    ['https://layout.example.com/', 'https://layout.example.com'],
    ['https://layout.example.com/p/abc?x=1#y', 'https://layout.example.com'],
    ['  https://layout.example.com/api  ', 'https://layout.example.com'],
    ['http://localhost:8504', 'http://localhost:8504'],
    ['https://layout.example.com:8443/x', 'https://layout.example.com:8443'],
    ['HTTPS://Layout.Example.com/x', 'https://layout.example.com'],
    [undefined, null], [null, null], ['', null], ['   ', null], ['layout.example.com', null], ['/relative/path', null], ['not a url', null],
    ['ftp://layout.example.com', null], ['javascript:alert(1)', null], ['data:text/html,x', null], ['file:///etc/hosts', null], [42, null], [{}, null],
  ]) check(assert.equal, lib.firstPaintOriginOf(input), want, `origin of ${JSON.stringify(input)}`)

  const cdns = [['https://cdn.jsdelivr.net', undefined], ['https://cdn.tailwindcss.com', undefined], ['https://fonts.googleapis.com', undefined], ['https://fonts.gstatic.com', 'anonymous']]
  const shape = list => asPlain(list).map(c => [c.origin, c.crossOrigin])
  check(assert.deepEqual, shape(lib.FIRST_PAINT_CDN_CONNECTIONS), cdns, 'the four CDN hosts, and only the font host is cross-origin')
  check(assert.deepEqual, shape(lib.firstPaintConnections('https://layout.example.com/p/1')), [['https://layout.example.com', undefined], ...cdns], 'Layout first, then the CDN hosts')
  check(assert.deepEqual, shape(lib.firstPaintConnections('not a url')), cdns, 'an invalid Layout URL is skipped; the CDN hosts stay')
  check(assert.deepEqual, shape(lib.firstPaintConnections(undefined)), cdns, 'a missing Layout URL is skipped')
  check(assert.deepEqual, shape(lib.firstPaintConnections('ftp://layout.example.com')), cdns, 'a non-http(s) Layout URL is skipped')
  // de-dupe: Layout on a CDN host (or the same host twice) is asked for once, the first (Layout's, no crossOrigin) entry wins
  check(assert.deepEqual, shape(lib.firstPaintConnections('https://cdn.jsdelivr.net/x')), [['https://cdn.jsdelivr.net', undefined], cdns[1], cdns[2], cdns[3]], 'Layout on a CDN host: one entry per origin')
  check(assert.deepEqual, shape(lib.firstPaintConnections('https://fonts.gstatic.com')), [['https://fonts.gstatic.com', undefined], cdns[0], cdns[1], cdns[2]], 'the first entry for an origin wins (Layout\'s, not cross-origin)')
  const origins = lib.firstPaintConnections('https://layout.example.com').map(c => c.origin)
  check(assert.equal, new Set(origins).size, origins.length, 'no origin twice')
  for (const c of lib.firstPaintConnections('https://layout.example.com')) check(assert.match, c.origin, /^https?:\/\/[^/]+$/, 'origins carry no path')

  // ---- 3. preconnect: flag off asks for nothing -----------------------------------------------------------------------------
  for (const env of [{}, { [FLAG]: 'false' }, { [FLAG]: '1' }, { [FLAG]: 'TRUE' }]) {
    for (const browser of [false, true]) {
      const off = L({ env, browser })
      const result = off.lib.warmStudioFirstPaintConnections('https://layout.example.com')
      check(assert.deepEqual, [off.world.preconnect.length, off.world.prefetchDNS.length, asPlain(result)], [0, 0, []], `flag off (${JSON.stringify(env)}, browser=${browser}): no react-dom call, nothing returned`)
    }
  }
  // ---- 4. preconnect: flag on ------------------------------------------------------------------------------------------------
  {
    const { lib: l, world } = L({ env: on })
    const asked = l.warmStudioFirstPaintConnections('https://layout.example.com/p/9')
    check(assert.deepEqual, shape(asked), [['https://layout.example.com', undefined], ...cdns], 'returns what it asked for')
    check(assert.deepEqual, asPlain(world.preconnect), [
      ['https://layout.example.com'], ['https://cdn.jsdelivr.net'], ['https://cdn.tailwindcss.com'], ['https://fonts.googleapis.com'], ['https://fonts.gstatic.com', { crossOrigin: 'anonymous' }],
    ], 'preconnect(origin) for each, with { crossOrigin: "anonymous" } for the font host only')
    check(assert.deepEqual, asPlain(world.prefetchDNS), world.preconnect.map(([origin]) => [origin]), 'prefetchDNS(origin) for the same origins')
    // server render: every render is its own document, so a second call asks again (React de-dupes per request)
    l.warmStudioFirstPaintConnections('https://layout.example.com/p/9')
    check(assert.equal, world.preconnect.length, 10, 'on a server nothing is remembered between renders')
  }
  {
    const { lib: l, world } = L({ env: on, browser: true })
    l.warmStudioFirstPaintConnections('https://layout.example.com')
    check(assert.equal, world.preconnect.length, 5, 'browser: first render asks')
    check(assert.deepEqual, asPlain(l.warmStudioFirstPaintConnections('https://layout.example.com/other/path')), [], 'browser: the same origins again ask for nothing')
    check(assert.equal, world.preconnect.length, 5, 'browser: no repeat call')
    l.warmStudioFirstPaintConnections('https://layout-two.example.com')
    check(assert.equal, world.preconnect.length, 10, 'browser: another Layout origin asks again')
    l.warmStudioFirstPaintConnections(null)
    check(assert.equal, world.preconnect.length, 14, 'browser: no Layout URL asks for the CDN hosts alone (a changed list is asked for)')
    check(assert.deepEqual, world.preconnect.slice(10).map(([origin]) => origin), cdns.map(([origin]) => origin), 'only the CDN hosts')
  }
  {
    const { lib: l, world } = L({ env: on })
    l.warmStudioFirstPaintConnections('nonsense')
    check(assert.equal, world.preconnect.length, 4, 'an invalid Layout URL still opens the CDN hosts, and nothing throws')
  }

  // ---- 4b. which head-start answers may be acted on ---------------------------------------------------------------------------
  for (const [answer, want, why] of [
    [{ success: true, data: { index: 0, total: 3 } }, true, 'a getCurrentSlideInfo reply'],
    [{ success: true, data: { index: 2, total: 3 } }, true, 'a later slide'],
    [{ success: true, data: { index: 0, total: 0 } }, false, 'no slides drawn yet'],
    [{ success: true, data: { total: 3 } }, false, 'no current index'],
    [{ success: true, data: { index: -1, total: 3 } }, false, 'a negative index'],
    [{ success: true, data: {} }, false, 'an empty data object'],
    [{ success: true }, false, 'nothing in it'],
    [{ success: false, data: { index: 0, total: 3 } }, false, 'not a success'],
    [{ success: true, real_slide_count: 4, current_visual_index: 1, visual_section_count: 5 }, true, 'a composeGetState reply'],
    [{ success: true, real_slide_count: 0, current_visual_index: 0, visual_section_count: 0 }, false, 'a composeGetState reply with no slides'],
    [{ success: true, data: { index: '0', total: '3' } }, false, 'strings are not counts'],
    [{ success: true, data: { index: NaN, total: 3 } }, false, 'NaN is not an index'],
    [{ success: true, data: { index: 0, total: Infinity } }, false, 'Infinity is not a count'],
    [null, false, 'null'], [undefined, false, 'undefined'], ['ok', false, 'a string'], [3, false, 'a number'],
  ]) check(assert.equal, lib.isUsableFirstPollAnswer(answer), want, `head-start answer usable? ${why}`)

  // ---- 5. the first poll ------------------------------------------------------------------------------------------------------
  // flag off: exactly the base's call, setInterval(tick, ms), and never a tick of its own
  for (const env of [{}, { [FLAG]: 'false' }]) {
    const { lib: l, world } = L({ env })
    const calls = []
    const tick = (...args) => { calls.push(args); return Promise.resolve() }
    const frame = {}
    const handle = l.startStudioSlideInfoPoll(frame, 'https://layout.example.com/p/1', tick, 3000)
    check(assert.equal, world.intervals.length, 1, 'flag off: one interval')
    check(assert.equal, world.intervals[0].fn, tick, 'flag off: the interval callback IS the viewer\'s tick (the base\'s call)')
    check(assert.equal, world.intervals[0].ms, 3000, 'flag off: the same period')
    check(assert.equal, handle, 1, 'flag off: the interval handle comes back')
    check(assert.equal, calls.length, 0, 'flag off: no tick at start')
    l.startStudioSlideInfoPoll(frame, 'https://layout.example.com/p/1', tick, 6000)
    check(assert.equal, calls.length, 0, 'flag off: a restart also starts no tick')
    check(assert.equal, world.intervals[1].fn, tick, 'flag off: restarts are the base call too')
  }
  // flag on, but nothing to claim yet (no frame or no URL): also the base's call
  for (const [frame, url] of [[null, 'https://layout.example.com/p/1'], [undefined, 'u'], [{}, null], [{}, undefined], [{}, '']]) {
    const { lib: l, world } = L({ env: on })
    const calls = []
    const tick = (...args) => { calls.push(args) }
    l.startStudioSlideInfoPoll(frame, url, tick, 3000)
    check(assert.deepEqual, [world.intervals.length, world.intervals[0].fn === tick, calls.length], [1, true, 0], `flag on, frame=${frame} url=${JSON.stringify(url)}: the base's call, no tick`)
  }
  // flag on: one tick at once, with `true`; the interval's own ticks are called with no argument
  {
    const { lib: l, world } = L({ env: on })
    const calls = []
    let release
    const tick = (...args) => { calls.push(args); return args[0] === true ? new Promise(resolve => { release = resolve }) : Promise.resolve() }
    const frame = {}
    const url = 'https://layout.example.com/p/1'
    const handle = l.startStudioSlideInfoPoll(frame, url, tick, 3000)
    check(assert.deepEqual, calls, [[true]], 'flag on: exactly one tick at once, called with true')
    check(assert.equal, world.intervals.length, 1, 'flag on: one interval')
    check(assert.equal, world.intervals[0].ms, 3000, 'flag on: the same period')
    check(assert.notEqual, world.intervals[0].fn, tick, 'flag on: the interval callback is the guard around the tick')
    check(assert.equal, handle, 1, 'flag on: the interval handle comes back')
    // no overlap: while the first tick is in flight the interval's ticks wait
    world.intervals[0].fn(); world.intervals[0].fn()
    check(assert.equal, calls.length, 1, 'no overlap: interval ticks wait for the first tick')
    release(); await settle()
    world.intervals[0].fn()
    check(assert.deepEqual, calls, [[true], []], 'after the first tick settles the interval tick runs, called with no argument')
    // once per frame and URL: a restart of the effect (same frame, same URL) starts no new first tick
    l.startStudioSlideInfoPoll(frame, url, tick, 6000)
    check(assert.equal, calls.length, 2, 'a restart for the same frame and URL has no first tick')
    check(assert.equal, world.intervals.length, 2, 'a restart still gets its interval')
    world.intervals[1].fn()
    check(assert.deepEqual, calls.at(-1), [], 'the restart\'s interval tick is the plain tick')
    // a new URL on the same frame, or another frame, gets its own first tick
    l.startStudioSlideInfoPoll(frame, 'https://layout.example.com/p/2', tick, 3000)
    check(assert.deepEqual, calls.at(-1), [true], 'the same frame at a new URL: a new first tick')
    l.startStudioSlideInfoPoll({}, url, tick, 3000)
    check(assert.deepEqual, calls.at(-1), [true], 'another frame: a first tick')
    check(assert.equal, calls.filter(a => a[0] === true).length, 3, 'three first ticks in all')
  }
  // a restart while the first tick is still in flight keeps waiting too (the guard belongs to the frame and URL, not to one interval)
  {
    const { lib: l, world } = L({ env: on })
    const calls = []
    let release
    const tick = (...args) => { calls.push(args); return args[0] === true ? new Promise(resolve => { release = resolve }) : Promise.resolve() }
    const frame = {}
    l.startStudioSlideInfoPoll(frame, 'u', tick, 3000)
    l.startStudioSlideInfoPoll(frame, 'u', tick, 6000)
    world.intervals[1].fn()
    check(assert.equal, calls.length, 1, 'a restarted interval waits for the first tick that is still in flight')
    release(); await settle()
    world.intervals[1].fn()
    check(assert.equal, calls.length, 2, '... and runs once it settled')
  }
  // a first tick that fails (rejects, throws) neither throws out of the lib nor holds the interval back
  for (const [name, make] of [
    ['rejects', () => Promise.reject(new Error('Command timeout'))],
    ['throws', () => { throw new Error('boom') }],
    ['returns nothing', () => undefined],
  ]) {
    const { lib: l, world } = L({ env: on })
    const calls = []
    const tick = (...args) => { calls.push(args); if (args[0] === true) return make(); return Promise.resolve() }
    l.startStudioSlideInfoPoll({}, 'u', tick, 3000)
    await settle()
    world.intervals[0].fn()
    check(assert.deepEqual, calls, [[true], []], `a first tick that ${name}: the lib survives and the interval tick runs`)
    check(assert.deepEqual, unhandled.splice(0), [], `a first tick that ${name}: no unhandled rejection`)
  }
  // a first tick that never settles cannot stop the polling for good
  {
    const { lib: l, world } = L({ env: on })
    const calls = []
    const tick = (...args) => { calls.push(args); return args[0] === true ? new Promise(() => {}) : Promise.resolve() }
    l.startStudioSlideInfoPoll({}, 'u', tick, 3000)
    world.now += l.FIRST_POLL_MAX_HOLD_MS - 1
    world.intervals[0].fn()
    check(assert.equal, calls.length, 1, 'still held just before the deadline')
    world.now += 2
    world.intervals[0].fn()
    check(assert.deepEqual, calls, [[true], []], 'past the deadline the interval ticks run again')
    check(assert.equal, l.FIRST_POLL_MAX_HOLD_MS, 15_000, 'the hold is 15 s at most')
  }
  // one retry: a head start the viewer could not answer yet (the tick resolves to exactly false) is tried ONCE more FIRST_POLL_RETRY_MS later,
  // still with `true` (uncounted); a usable head start gets none; a frame that moved to another URL gets none; the interval waits for it
  {
    const { lib: l, world } = L({ env: on })
    const calls = []
    const tick = (...args) => { calls.push(args); return Promise.resolve(args[0] === true ? false : undefined) }
    l.startStudioSlideInfoPoll({}, 'https://layout.example.com/p/9', tick, 3000)
    await settle()
    check(assert.equal, world.timeouts.length, 1, 'a rejected head start schedules one retry')
    check(assert.equal, world.timeouts[0].ms, l.FIRST_POLL_RETRY_MS, 'the retry comes FIRST_POLL_RETRY_MS later')
    check(assert.equal, l.FIRST_POLL_RETRY_MS, 500, 'the retry delay is 500 ms (Layout starts Reveal 300 ms after DOMContentLoaded)')
    world.timeouts[0].fn(); await settle()
    check(assert.deepEqual, calls, [[true], [true]], 'the retry is another head-start tick, called with true (uncounted)')
    check(assert.equal, world.timeouts.length, 1, 'never more than one retry, even when the retry is rejected too')
  }
  {
    const { lib: l, world } = L({ env: on })
    l.startStudioSlideInfoPoll({}, 'u', () => Promise.resolve(undefined), 3000); await settle()
    check(assert.equal, world.timeouts.length, 0, 'a head start that is not rejected schedules no retry')
    const { lib: l2, world: w2 } = L({ env: on })
    l2.startStudioSlideInfoPoll({}, 'u', () => Promise.resolve(true), 3000); await settle()
    check(assert.equal, w2.timeouts.length, 0, 'only exactly false asks for a retry')
  }
  {
    const { lib: l, world } = L({ env: on })
    const calls = []
    const tick = (...args) => { calls.push(args); return Promise.resolve(args[0] === true ? false : undefined) }
    const frame = {}
    l.startStudioSlideInfoPoll(frame, 'https://layout.example.com/p/1', tick, 3000); await settle()
    l.startStudioSlideInfoPoll(frame, 'https://layout.example.com/p/2', tick, 3000); await settle()
    const before = calls.length
    world.timeouts[0].fn(); await settle()
    check(assert.equal, calls.length, before, 'a retry for a frame that has moved to another URL does nothing')
  }
  {
    const { lib: l, world } = L({ env: on })
    const calls = []
    let heads = 0, releaseRetry
    const tick = (...args) => {
      calls.push(args)
      if (args[0] !== true) return Promise.resolve()
      heads += 1
      return heads === 1 ? Promise.resolve(false) : new Promise(resolve => { releaseRetry = resolve })
    }
    l.startStudioSlideInfoPoll({}, 'u', tick, 3000); await settle()
    world.timeouts[0].fn()
    world.intervals[0].fn()
    check(assert.equal, calls.filter(c => c.length === 0).length, 0, 'an interval tick waits while the retry is in flight')
    releaseRetry(); await settle()
    world.intervals[0].fn()
    check(assert.equal, calls.filter(c => c.length === 0).length, 1, 'after the retry settles the interval ticks run again')
  }
  // the lib counts nothing: the failure count lives in the viewer (its catch skips the count for a first tick); the lib never calls anything but the tick, the timer and Date.now
  check(assert.doesNotMatch, text.replace(/\/\/.*$/gm, ''), /pollingFailure|setPollingFailureCount|sendCommand|postMessage|fetch\(|localStorage/, 'the lib has no request, no storage and no failure counter')
}

await suites()
const libChecks = checks
console.log(`PASS lib suites: ${libChecks} checks`)

// ---------- mutation check: each broken copy of the lib must fail at least one check ----------
const once = (text, from, to) => {
  assert.equal(text.split(from).length - 1, 1, `mutant source text exists once: ${from.slice(0, 70)}`)
  return text.replace(from, () => to)
}
const MUTANTS = [
  ['flag compares loosely', t => once(t, `process.env.${FLAG} === 'true'`, `Boolean(process.env.${FLAG})`)],
  ['flag on by default', t => once(t, `process.env.${FLAG} === 'true'`, `process.env.${FLAG} !== 'false'`)],
  ['warm ignores the flag', t => once(t, 'if (!STUDIO_FIRST_PAINT_ENABLED) return []', '')],
  ['font host not cross-origin', t => once(t, `{ origin: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' }`, `{ origin: 'https://fonts.gstatic.com' }`)],
  ['a CDN host missing', t => once(t, `  { origin: 'https://cdn.tailwindcss.com' },\n`, '')],
  ['no de-dupe of origins', t => once(t, 'if (seen.has(connection.origin)) continue', '')],
  ['Layout origin kept with its path', t => once(t, 'parsed.origin : null', 'parsed.href : null')],
  ['any scheme accepted', t => once(t, "parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null", 'parsed.origin')],
  ['no prefetchDNS', t => once(t, '    prefetchDNS(origin)\n', '')],
  ['browser repeats every render', t => once(t, 'if (key === warmedInBrowser) return []', '')],
  ['server remembers (starves later requests)', t => once(t, "if (typeof document !== 'undefined') {", 'if (true) {')],
  ['flag off still starts a first tick', t => once(t, 'if (!STUDIO_FIRST_PAINT_ENABLED || !frame || !url) return setInterval(tick, intervalMs)', 'if (!frame || !url) return setInterval(tick, intervalMs)')],
  ['a non-success answer is usable', t => once(t, "if (record.success !== true) return false\n  const data", "const data")],
  ['a zero slide count is usable', t => once(t, 'return total > 0 && index !== null && index >= 0', 'return total >= 0 && index !== null && index >= 0')],
  ['an answer without an index is usable', t => once(t, 'return total > 0 && index !== null && index >= 0', 'return total > 0')],
  ['first tick not marked', t => once(t, 'running = tick(true)', 'running = tick()')],
  ['no overlap guard', t => once(t, 'current.inFlight && Date.now() < current.holdUntil ? undefined : tick()', 'tick()')],
  ['guard never expires', t => once(t, 'current.inFlight && Date.now() < current.holdUntil', 'current.inFlight')],
  ['first tick on every restart', t => once(t, '!state || state.url !== url', 'true')],
  ['first tick once per frame regardless of URL', t => once(t, '!state || state.url !== url', '!state')],
  ['a rejected first tick escapes', t => once(t, 'Promise.resolve(running).catch(() => undefined).then(', 'Promise.resolve(running).then(')],
  ['a throwing first tick escapes', t => once(t, 'try { running = tick(true) } catch { running = undefined }', 'running = tick(true)')],
  ['no retry after a rejected head start', t => once(t, 'if (outcome === false && !claimed.retried) {', 'if (false) {')],
  ['retry after any head start', t => once(t, 'if (outcome === false && !claimed.retried) {', 'if (!claimed.retried) {')],
  ['retry repeats', t => once(t, '          claimed.retried = true\n', '')],
  ['retry ignores a moved frame', t => once(t, '            if (firstPolls.get(frame) !== claimed) return\n', '')],
  ['retry does not hold the interval', t => once(t, '            claimed.inFlight = true\n', '')],
  ['retry delay is not the constant', t => once(t, '}, FIRST_POLL_RETRY_MS)', '}, 0)')],
  ['interval passes the first-tick marker', t => once(t, '? undefined : tick()), intervalMs)', '? undefined : tick(true)), intervalMs)')],
]
let killed = 0
for (const [name, mutate] of MUTANTS) {
  const mutated = mutate(source)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try { await suites(mutated); survived = true } catch { killed++ }
  unhandled.splice(0)
  assert.ok(!survived, `mutant survived: ${name}`)
}
check(assert.equal, killed, MUTANTS.length, 'every mutant killed')
console.log(`Studio first paint (lib): ${libChecks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network, no browser.`)
