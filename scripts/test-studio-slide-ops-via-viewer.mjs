// SLIDE-OPS-VIA-VIEWER: an edit still pending when a slide is deleted, duplicated or re-laid-out reaches the server BEFORE the change
// (flag NEXT_PUBLIC_STUDIO_SLIDE_OPS_VIA_VIEWER, exact "true", default off; the Studio side of Layout MR !239).
// Offline and self-contained: no network, no browser. The repo root is found from this file. It loads the import-free helper
// (lib/studio-slide-ops-via-viewer.ts) on its own and drives it with a fake channel and a fake clock; it renders the REAL slide panel and the REAL version history
// panel through a small hook shim (state, effects, refs) against fakes of the Layout REST client and of the viewer iframe, and presses their real buttons with the flag off and on;
// it reads the REAL viewer source (the thirteen marked lines) and the REAL panels' sources, and, when the base commit is in the clone, proves that with the marked lines removed the
// three files are the base's. Then every suite re-runs against deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')

const FLAG = 'NEXT_PUBLIC_STUDIO_SLIDE_OPS_VIA_VIEWER'
const MARK = 'SLIDE-OPS-VIA-VIEWER'
const BASE_COMMIT = process.env.SLIDE_OPS_BASE || '7a4d894'
const FILES = {
  lib: 'lib/studio-slide-ops-via-viewer.ts',
  viewer: 'components/presentation-viewer.tsx',
  panel: 'components/element-format-panel/slide-format-panel.tsx',
  history: 'components/version-history-panel.tsx',
  messaging: 'lib/layout-viewer-messaging.ts',
  elements: 'types/elements.ts',
}
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const SRC = Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, read(rel)]))
const ENVEX = read('.env.example')
const PKG = JSON.parse(read('package.json'))
const git = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
function baseSource(rel) {
  try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]); return git(['show', `${BASE_COMMIT}:${rel}`]) } catch { return null }
}

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
// A world: the lib and the two panels loaded against stubs (the REST client, icons, the prompt input) and the real messaging and element-type modules.
function createWorld({ env = {}, src = {}, restClient = {}, global = {} } = {}) {
  const sources = { ...SRC, ...src }
  const cache = new Map()
  const icon = name => props => React.createElement('i', { 'data-icon': name, ...props })
  const stubs = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'lucide-react': new Proxy({}, { get: (_t, name) => icon(String(name)) }),
    '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' '), normalizeColorToHex: (v, fallback) => v || fallback },
    './shared/prompt-input': { PromptInput: props => React.createElement('div', { 'data-stub': 'prompt-input', ...props }) },
    '@/lib/layout-service-client': restClient,
  }
  const resolved = { '@/lib/studio-slide-ops-via-viewer': 'lib', '@/lib/layout-viewer-messaging': 'messaging', '@/types/elements': 'elements' }
  function load(key) {
    const rel = FILES[key]
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec in resolved) return load(resolved[spec])
      throw new Error(`unexpected import ${spec} from ${rel}`)
    }
    new Function('module', 'exports', 'require', 'process', ...Object.keys(global), compile(rel, sources[key]))(module, module.exports, require, { env }, ...Object.values(global))
    return module.exports
  }
  return { lib: () => load('lib'), panel: () => load('panel'), history: () => load('history') }
}

// ---------------------------------------------------------------- a small hook shim: state, memo, callback, ref, effect; synchronous re-render
function mount(Component, props) {
  const slots = []
  let cursor = 0
  let rendering = false
  let tree = null
  let pendingEffects = []
  const sameDeps = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const hooks = {
    useState(init) {
      const i = cursor++
      if (!(i in slots)) slots[i] = { value: typeof init === 'function' ? init() : init }
      const slot = slots[i]
      return [slot.value, next => {
        const value = typeof next === 'function' ? next(slot.value) : next
        if (Object.is(value, slot.value)) return
        slot.value = value
        if (!rendering) render()
      }]
    },
    useRef(init) { const i = cursor++; if (!(i in slots)) slots[i] = { value: { current: init } }; return slots[i].value },
    useMemo(fn, deps) { const i = cursor++; const prev = slots[i]; if (prev && sameDeps(prev.deps, deps)) return prev.value; slots[i] = { value: fn(), deps }; return slots[i].value },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps) },
    useEffect(fn, deps) {
      const i = cursor++
      const prev = slots[i]
      if (prev && sameDeps(prev.deps, deps)) return
      pendingEffects.push({ i, fn, prev })
      slots[i] = { ...(prev || {}), deps }
    },
  }
  function render() {
    rendering = true
    cursor = 0
    const original = { ...React }
    for (const name of Object.keys(hooks)) React[name] = hooks[name]
    try { tree = Component(props) } finally { for (const name of Object.keys(hooks)) React[name] = original[name]; rendering = false }
    const effects = pendingEffects; pendingEffects = []
    for (const { i, fn, prev } of effects) {
      if (prev?.cleanup) prev.cleanup()
      const cleanup = fn()
      slots[i].cleanup = typeof cleanup === 'function' ? cleanup : null
    }
  }
  render()
  return {
    tree: () => tree,
    find(predicate) {
      const found = []
      const walk = node => {
        if (Array.isArray(node)) return node.forEach(walk)
        if (!node || typeof node !== 'object' || !node.props) return
        if (predicate(node.props, node)) found.push(node)
        walk(node.props.children)
      }
      walk(tree)
      return found
    },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'string' ? node : node && node.props ? textOf(node.props.children) : ''
const settle = () => new Promise(resolve => setImmediate(resolve))
const hasClass = (props, token) => typeof props.className === 'string' && props.className.split(/\s+/).includes(token)

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
// a fake viewer channel: records what is posted, lets the test answer, counts listeners
function makeChannel() {
  const channel = { posted: [], listeners: new Set(), n: 0 }
  channel.post = message => { channel.posted.push(message) }
  channel.listen = handler => { channel.listeners.add(handler); return () => channel.listeners.delete(handler) }
  channel.newRequestId = () => `req-${++channel.n}`
  channel.deliver = data => { for (const handler of [...channel.listeners]) handler(data) }
  return channel
}

// ---------------------------------------------------------------- suites
function suiteFlag(src = {}) {
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['yes', false], ['true', true]]) {
    const env = value === undefined ? {} : { [FLAG]: value }
    check(assert.equal, createWorld({ env, src }).lib().STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED, expected, `flag ${JSON.stringify(value)}`)
  }
  const lib = createWorld({ src }).lib()
  check(assert.equal, lib.SLIDE_OP_VIEWER_TIMEOUT_MS, 30_000, 'a viewer command waits for the save of what is pending, then the request: the mutating-command budget')
  check(assert.equal, lib.RESTORE_FLUSH_ACK_TIMEOUT_MS, 8_000)
  check(assert.equal, lib.RESTORE_FLUSH_SAVE_TIMEOUT_MS, 20_000)
}
function suiteCommands(src = {}) {
  const lib = createWorld({ src }).lib()
  check(assert.deepEqual, lib.duplicateSlideCommand(2), { action: 'duplicateSlide', params: { index: 2, insert_after: true } })
  check(assert.deepEqual, lib.deleteSlideCommand(0), { action: 'deleteSlides', params: { indices: [0] } })
  check(assert.deepEqual, lib.changeSlideLayoutCommand(4, 'H3-closing'), { action: 'changeSlideLayout', params: { index: 4, new_layout: 'H3-closing', preserve_content: true } })
  for (const action of ['duplicateSlide', 'deleteSlides', 'changeSlideLayout']) check(assert.equal, lib.isSlideOpViewerAction(action), true, action)
  for (const action of ['deleteSlide', 'reorderSlides', 'addSlide', 'forceSave', 'restoreVersion', 'deleteElement', 'insertTextBox', '', 'DuplicateSlide']) check(assert.equal, lib.isSlideOpViewerAction(action), false, `not a slide op: ${action}`)
  check(assert.deepEqual, [...lib.SLIDE_OP_VIEWER_ACTIONS], ['duplicateSlide', 'deleteSlides', 'changeSlideLayout'])
  // the shapes are the ones the slide rail sends (presentation-viewer.tsx) and the viewer reads: same action names, same parameter keys
  const viewer = SRC.viewer
  const railKeys = action => {
    const match = viewer.match(new RegExp(`sendCommand\\(mutation\\.iframe, '${action}', \\{([^}]*)\\}`))
    assert.ok(match, `the rail sends ${action}`)
    return [...match[1].matchAll(/^\s*([a-z_]+):/gm)].map(m => m[1]).sort()
  }
  check(assert.deepEqual, railKeys('duplicateSlide'), Object.keys(lib.duplicateSlideCommand(1).params).sort(), 'duplicateSlide: the rail\'s parameter keys')
  check(assert.deepEqual, railKeys('deleteSlides'), Object.keys(lib.deleteSlideCommand(1).params).sort(), 'deleteSlides: the rail\'s parameter keys')
  check(assert.deepEqual, railKeys('changeSlideLayout'), Object.keys(lib.changeSlideLayoutCommand(1, 'X').params).sort(), 'changeSlideLayout: the rail\'s parameter keys')
}
function suiteAckTotals(src = {}) {
  const lib = createWorld({ src }).lib()
  // delete: Layout's bulk delete says remaining_slide_count; duplicate: slide_count (or data.slideCount); a layout change reports no count
  check(assert.equal, lib.slideTotalAfterAck('deleteSlides', { success: true, deleted_count: 1, remaining_slide_count: 4 }), 4)
  check(assert.equal, lib.slideTotalAfterAck('duplicateSlide', { success: true, new_slide_index: 2, slide_count: 6 }), 6)
  check(assert.equal, lib.slideTotalAfterAck('duplicateSlide', { success: true, data: { slideCount: 7 } }), 7)
  check(assert.equal, lib.slideTotalAfterAck('duplicateSlide', { slide_count: 6, data: { slideCount: 7 } }), 6, 'slide_count first, as the rail reads it')
  check(assert.equal, lib.slideTotalAfterAck('changeSlideLayout', { success: true, slide_count: 5, remaining_slide_count: 5 }), null, 'a layout change changes no count')
  check(assert.equal, lib.slideTotalAfterAck('deleteSlides', { slide_count: 5 }), null, 'a delete reads remaining_slide_count only')
  check(assert.equal, lib.slideTotalAfterAck('duplicateSlide', { remaining_slide_count: 5 }), null, 'a duplicate reads slide_count only')
  for (const bad of [undefined, null, 'x', 7, {}, { remaining_slide_count: 0 }, { remaining_slide_count: -1 }, { remaining_slide_count: 2.5 }, { remaining_slide_count: '4' }, { remaining_slide_count: NaN }, { remaining_slide_count: Infinity }]) {
    check(assert.equal, lib.slideTotalAfterAck('deleteSlides', bad), null, `no total from ${JSON.stringify(bad)}`)
  }
  check(assert.equal, lib.slideTotalAfterAck('forceSave', { remaining_slide_count: 4, slide_count: 4 }), null, 'only the two slide commands')
}
async function suiteRunOp(src = {}) {
  const lib = createWorld({ src }).lib()
  const cmd = lib.deleteSlideCommand(3)
  const sent = []
  const ok = async (action, params) => { sent.push([action, params]); return { success: true } }
  check(assert.deepEqual, await lib.runSlideOpViaViewer(ok, cmd, 'fail'), { success: true })
  check(assert.deepEqual, sent, [['deleteSlides', { indices: [3] }]], 'the command goes out once, as built')
  check(assert.deepEqual, await lib.runSlideOpViaViewer(async () => undefined, cmd, 'fail'), { success: true }, 'an acknowledgement with no body is a success')
  check(assert.deepEqual, await lib.runSlideOpViaViewer(async () => ({ success: false, error: 'No slide' }), cmd, 'fail'), { success: false, error: { code: 'VIEWER_COMMAND_FAILED', message: 'No slide' } })
  check(assert.deepEqual, await lib.runSlideOpViaViewer(async () => ({ success: false }), cmd, 'Failed to delete slide'), { success: false, error: { code: 'VIEWER_COMMAND_FAILED', message: 'Failed to delete slide' } }, 'the panel\'s own wording when the viewer gives none')
  check(assert.deepEqual, await lib.runSlideOpViaViewer(async () => { throw new Error('Command failed') }, cmd, 'fail'), { success: false, error: { code: 'VIEWER_COMMAND_FAILED', message: 'Command failed' } })
  check(assert.deepEqual, await lib.runSlideOpViaViewer(async () => { throw new Error('Layout Service not ready') }, cmd, 'fail'), { success: false, error: { code: 'VIEWER_COMMAND_FAILED', message: 'Layout Service not ready' } })
  check(assert.deepEqual, await lib.runSlideOpViaViewer(async () => { throw 'x' }, cmd, 'Failed to delete slide'), { success: false, error: { code: 'VIEWER_COMMAND_FAILED', message: 'Failed to delete slide' } }, 'a non-Error rejection')
  const timeout = await lib.runSlideOpViaViewer(async () => { throw new Error('Command timeout') }, cmd, 'fail')
  check(assert.equal, timeout.success, false)
  check(assert.equal, timeout.error.code, 'VIEWER_COMMAND_UNCONFIRMED', 'a timeout is not reported as a failure: the change may have happened')
  check(assert.equal, timeout.error.message, 'The slide change could not be confirmed. Check the slide list before trying again.')
}
async function suiteAck(src = {}) {
  const lib = createWorld({ src }).lib()
  // resolves on the reply with this action and request id; others are ignored; every path unlistens exactly once
  { const channel = makeChannel(), clock = makeClock()
    const promise = lib.requestViewerAck(channel, 'forceSave', { a: 1 }, 8000, clock)
    check(assert.deepEqual, channel.posted, [{ action: 'forceSave', params: { a: 1 }, requestId: 'req-1' }])
    check(assert.equal, channel.listeners.size, 1)
    channel.deliver({ action: 'forceSave', requestId: 'other', success: true })
    channel.deliver({ action: 'nextSlide', requestId: 'req-1', success: true })
    channel.deliver(null); channel.deliver('x'); channel.deliver({ type: 'saveStatusChanged' })
    check(assert.equal, channel.listeners.size, 1, 'unrelated messages do not settle it')
    channel.deliver({ action: 'forceSave', requestId: 'req-1', success: true, extra: 1 })
    check(assert.deepEqual, await promise, { action: 'forceSave', requestId: 'req-1', success: true, extra: 1 })
    check(assert.equal, channel.listeners.size, 0, 'unlistened')
    check(assert.equal, clock.timers.size, 0, 'timer dropped')
    channel.deliver({ action: 'forceSave', requestId: 'req-1', success: false })
    check(assert.equal, channel.posted.length, 1) }
  // a refusal rejects with the viewer's words, else with the action's
  { const channel = makeChannel(), clock = makeClock()
    const promise = lib.requestViewerAck(channel, 'forceSave', {}, 8000, clock)
    channel.deliver({ action: 'forceSave', requestId: 'req-1', success: false, error: 'No editor' })
    await assert.rejects(promise, /No editor/); checks++
    check(assert.equal, channel.listeners.size, 0)
    const channel2 = makeChannel()
    const promise2 = lib.requestViewerAck(channel2, 'forceSave', {}, 8000, makeClock())
    channel2.deliver({ action: 'forceSave', requestId: 'req-1', success: false })
    await assert.rejects(promise2, /forceSave was refused/); checks++ }
  // success must be exactly true
  { const channel = makeChannel(), clock = makeClock()
    const promise = lib.requestViewerAck(channel, 'forceSave', {}, 8000, clock)
    channel.deliver({ action: 'forceSave', requestId: 'req-1', success: 'yes' })
    await assert.rejects(promise); checks++ }
  // no answer: rejects "Command timeout" at the budget, not before, and unlistens
  { const channel = makeChannel(), clock = makeClock()
    const promise = lib.requestViewerAck(channel, 'forceSave', {}, 8000, clock)
    let settled = false; promise.catch(() => { settled = true })
    clock.advance(7999); await settle(); check(assert.equal, settled, false, 'not before the budget')
    clock.advance(1)
    await assert.rejects(promise, /Command timeout/); checks++
    check(assert.equal, channel.listeners.size, 0)
    channel.deliver({ action: 'forceSave', requestId: 'req-1', success: true }) }
}
function suiteTracker(src = {}) {
  const lib = createWorld({ src }).lib()
  const make = () => { const clock = makeClock(); return { clock, tracker: lib.createSaveStatusTracker(clock) } }
  const saved = { type: 'saveStatusChanged', status: 'saved', hasPendingChanges: false }
  { const { tracker } = make()
    check(assert.equal, tracker.last(), null, 'nothing seen yet')
    for (const junk of [null, undefined, 'saved', 7, {}, { type: 'other', status: 'saved' }, { type: 'saveStatusChanged' }, { type: 'saveStatusChanged', status: 'weird' }, { type: 'saveStatusChanged', status: 5 }]) tracker.record(junk)
    check(assert.equal, tracker.last(), null, 'only the viewer\'s save status messages count')
    tracker.record({ type: 'saveStatusChanged', status: 'unsaved', hasPendingChanges: true })
    check(assert.deepEqual, tracker.last(), { status: 'unsaved', hasPendingChanges: true })
    tracker.record({ type: 'save_status', status: 'saving' })
    check(assert.deepEqual, tracker.last(), { status: 'saving', hasPendingChanges: undefined }, 'the older message type is read too; a missing pending flag is unknown, not false')
    tracker.record(saved)
    check(assert.deepEqual, tracker.last(), { status: 'saved', hasPendingChanges: false })
    check(assert.equal, lib.isCleanSaveEvent(tracker.last()), true) }
  for (const [event, expected] of [[{ status: 'saved', hasPendingChanges: false }, true], [{ status: 'saved', hasPendingChanges: true }, false], [{ status: 'saved' }, false], [{ status: 'saved', hasPendingChanges: undefined }, false],
    [{ status: 'saving', hasPendingChanges: false }, false], [{ status: 'unsaved', hasPendingChanges: false }, false], [{ status: 'error', hasPendingChanges: false }, false], [null, false], [undefined, false]]) {
    check(assert.equal, lib.isCleanSaveEvent(event), expected, JSON.stringify(event))
  }
  // waitForClean: only a clean event resolves true; the timeout resolves false; cancel resolves false; waiters are dropped
  { const { clock, tracker } = make()
    const wait = tracker.waitForClean(20_000)
    let result = null; wait.promise.then(v => { result = v })
    check(assert.equal, clock.timers.size, 1, 'armed at once')
    tracker.record({ type: 'saveStatusChanged', status: 'saving', hasPendingChanges: true })
    tracker.record({ type: 'saveStatusChanged', status: 'saved', hasPendingChanges: true })
    tracker.record({ type: 'saveStatusChanged', status: 'error', hasPendingChanges: false })
    check(assert.equal, clock.timers.size, 1, 'a save with something still pending is not a clean one')
    tracker.record(saved)
    check(assert.equal, clock.timers.size, 0, 'timer dropped on success')
    return wait.promise.then(v => {
      check(assert.equal, v, true)
      // later events do not touch a settled wait
      tracker.record(saved); clock.advance(30_000)
      const timeoutWait = tracker.waitForClean(20_000)
      clock.advance(19_999)
      const probe = []; timeoutWait.promise.then(v2 => probe.push(v2))
      return settle().then(() => {
        check(assert.deepEqual, probe, [], 'not before the timeout')
        clock.advance(1)
        return timeoutWait.promise
      }).then(v2 => {
        check(assert.equal, v2, false, 'timeout: false')
        const cancelled = tracker.waitForClean(20_000)
        cancelled.cancel()
        return cancelled.promise
      }).then(v3 => {
        check(assert.equal, v3, false, 'cancel: false')
        check(assert.equal, clock.timers.size, 0, 'no timer left')
        // two waiters both resolve on one clean event; a cancelled one stays false
        const a = tracker.waitForClean(20_000), b = tracker.waitForClean(20_000), c = tracker.waitForClean(20_000)
        c.cancel()
        tracker.record(saved)
        return Promise.all([a.promise, b.promise, c.promise])
      }).then(all => check(assert.deepEqual, all, [true, true, false]))
    }) }
}
async function suiteRestoreFlush(src = {}) {
  const lib = createWorld({ src }).lib()
  const make = () => { const clock = makeClock(); const tracker = lib.createSaveStatusTracker(clock); const log = []; return { clock, tracker, log } }
  const dirty = { type: 'saveStatusChanged', status: 'unsaved', hasPendingChanges: true }
  const clean = { type: 'saveStatusChanged', status: 'saved', hasPendingChanges: false }
  // nothing seen, or the last status is clean: nothing to flush, the viewer is not asked
  for (const feed of [[], [dirty, clean]]) {
    const { tracker, log } = make()
    feed.forEach(m => tracker.record(m))
    const result = await lib.flushViewerBeforeRestore({ tracker, forceSave: async () => { log.push('forceSave') } })
    check(assert.deepEqual, result, { ok: true, flushed: false })
    check(assert.deepEqual, log, [], 'no forceSave when nothing is pending')
  }
  // pending: arms the wait, sends forceSave, waits for the ack, then for the clean event
  for (const lastEvent of [dirty, { type: 'saveStatusChanged', status: 'saving', hasPendingChanges: true }, { type: 'saveStatusChanged', status: 'error', hasPendingChanges: true }, { type: 'saveStatusChanged', status: 'saved', hasPendingChanges: true }]) {
    const { tracker, log } = make()
    tracker.record(lastEvent)
    let ack = null
    const promise = lib.flushViewerBeforeRestore({ tracker, forceSave: () => new Promise(resolve => { log.push('forceSave'); ack = resolve }) })
    await settle()
    check(assert.deepEqual, log, ['forceSave'], `${lastEvent.status}/${lastEvent.hasPendingChanges}: forceSave sent once`)
    ack({ success: true })
    let done = null; promise.then(r => { done = r })
    await settle()
    check(assert.equal, done, null, 'the acknowledgement alone is not a flush')
    tracker.record({ type: 'saveStatusChanged', status: 'saving', hasPendingChanges: true }); await settle()
    check(assert.equal, done, null, 'a save that has started is not a save that finished')
    tracker.record(clean)
    check(assert.deepEqual, await promise, { ok: true, flushed: true })
  }
  // the clean event can arrive BEFORE the acknowledgement (the wait was armed first)
  { const { tracker } = make()
    tracker.record(dirty)
    const result = await lib.flushViewerBeforeRestore({ tracker, forceSave: async () => { tracker.record(clean) } })
    check(assert.deepEqual, result, { ok: true, flushed: true }) }
  // the viewer refuses or does not answer: not restored, and the armed wait is cancelled (no timer, no waiter)
  { const { clock, tracker } = make()
    tracker.record(dirty)
    const result = await lib.flushViewerBeforeRestore({ tracker, forceSave: async () => { throw new Error('Command timeout') } })
    check(assert.deepEqual, result, { ok: false, reason: 'ack', message: lib.RESTORE_NOT_SAVED_MESSAGE })
    check(assert.equal, clock.timers.size, 0, 'the save wait was cancelled')
    tracker.record(clean) }
  // acknowledged but nothing finishes: refused at the save budget, not before
  { const { clock, tracker } = make()
    tracker.record(dirty)
    let result = null
    const promise = lib.flushViewerBeforeRestore({ tracker, forceSave: async () => {}, saveTimeoutMs: 20_000 }).then(r => { result = r })
    await settle(); clock.advance(19_999); await settle()
    check(assert.equal, result, null, 'still waiting at 19.999 s')
    clock.advance(1); await promise
    check(assert.deepEqual, result, { ok: false, reason: 'unsaved', message: lib.RESTORE_NOT_SAVED_MESSAGE })
    check(assert.equal, clock.timers.size, 0) }
  // the default save budget
  { const { clock, tracker } = make()
    tracker.record(dirty)
    let result = null
    const promise = lib.flushViewerBeforeRestore({ tracker, forceSave: async () => {} }).then(r => { result = r })
    await settle(); clock.advance(19_999); await settle(); check(assert.equal, result, null)
    clock.advance(1); await promise; check(assert.equal, result.ok, false) }
  check(assert.equal, lib.RESTORE_NOT_SAVED_MESSAGE, 'Your latest edits could not be saved first, so the version was not restored. Try again.')
}

// ---- the REAL slide panel, its buttons pressed, against a fake REST client and a recording onSendCommand
async function suiteSlidePanel(src = {}) {
  for (const flagOn of [false, true]) {
    const rest = []
    const client = Object.fromEntries(['addSlide', 'changeSlideLayout', 'duplicateSlide', 'deleteSlide'].map(name => [name, async (...args) => { rest.push([name, ...args]); return { success: true } }]))
    const world = createWorld({ env: flagOn ? { [FLAG]: 'true' } : {}, src, restClient: client })
    const { SlideFormatPanel } = world.panel()
    const sent = [], events = []
    let reply = async () => ({ success: true })
    const view = mount(SlideFormatPanel, {
      slideIndex: 1, presentationId: 'deck-1', onSendCommand: async (action, params) => { sent.push([action, params]); return reply(action, params) },
      onSlideAdded: () => events.push('added'), onSlideDeleted: () => events.push('deleted'), onLayoutChanged: () => events.push('layout'),
    })
    const press = async title => { const [button] = view.find(p => p.title === title); assert.ok(button, `button ${title}`); await button.props.onClick(); await settle() }
    const label = flagOn ? 'flag on' : 'flag off'

    await press('Duplicate slide')
    if (flagOn) {
      check(assert.deepEqual, sent, [['duplicateSlide', { index: 1, insert_after: true }]], `${label}: duplicate is the viewer's command`)
      check(assert.deepEqual, rest, [], `${label}: and Layout's REST is not called by the panel`)
    } else {
      check(assert.deepEqual, rest, [['duplicateSlide', 'deck-1', 1]], `${label}: duplicate calls the REST client as before`)
      check(assert.deepEqual, sent, [], `${label}: and sends no viewer command`)
    }
    check(assert.deepEqual, events, ['added'], `${label}: the panel's callback`)

    sent.length = 0; rest.length = 0; events.length = 0
    await press('Delete slide')
    if (flagOn) {
      check(assert.deepEqual, sent, [['deleteSlides', { indices: [1] }]], `${label}: delete is the viewer's deleteSlides`)
      check(assert.deepEqual, rest, [])
    } else {
      check(assert.deepEqual, rest, [['deleteSlide', 'deck-1', 1]], `${label}: delete calls the REST client as before`)
      check(assert.deepEqual, sent, [])
    }
    check(assert.deepEqual, events, ['deleted'], `${label}: the panel's callback`)

    // the layout tab: pick Closing, Apply
    sent.length = 0; rest.length = 0; events.length = 0
    const [layoutTab] = view.find(p => typeof p.onClick === 'function' && textOf(p.children).trim() === 'Layout' && !p.title)
    assert.ok(layoutTab, 'the Layout tab'); layoutTab.props.onClick(); await settle()
    const [closing] = view.find(p => typeof p.onClick === 'function' && p.title === 'Thank you slide')
    assert.ok(closing, 'the Closing card'); closing.props.onClick(); await settle()
    const [apply] = view.find(p => typeof p.onClick === 'function' && /Apply Layout/.test(textOf(p.children)))
    assert.ok(apply, 'Apply Layout'); await apply.props.onClick(); await settle()
    if (flagOn) {
      check(assert.deepEqual, sent, [['changeSlideLayout', { index: 1, new_layout: 'H3-closing', preserve_content: true }]], `${label}: layout change is the viewer's command`)
      check(assert.deepEqual, rest, [])
    } else {
      check(assert.deepEqual, rest, [['changeSlideLayout', 'deck-1', 1, 'H3-closing', { preserve_content: true }]], `${label}: layout change calls the REST client as before`)
      check(assert.deepEqual, sent, [])
    }
    check(assert.deepEqual, events, ['layout'], `${label}: the panel's callback`)

    // failures: the viewer rejects (a refusal, a timeout, "not ready"): the panel shows it, fires no callback
    if (flagOn) {
      for (const [failure, expected] of [[new Error('No slide at that index'), 'No slide at that index'], [new Error('Command timeout'), 'The slide change could not be confirmed. Check the slide list before trying again.'], [new Error('Layout Service not ready'), 'Layout Service not ready']]) {
        events.length = 0; sent.length = 0
        reply = async () => { throw failure }
        await press('Delete slide')
        const [banner] = view.find(p => hasClass(p, 'text-red-400') && hasClass(p, 'bg-red-600/20'))
        assert.ok(banner, 'the error banner'); check(assert.equal, textOf(banner), expected, `delete failure: ${failure.message}`)
        check(assert.deepEqual, events, [], 'no callback on a failure')
        reply = async () => ({ success: true }); await press('Delete slide')
        check(assert.equal, view.find(p => hasClass(p, 'text-red-400') && hasClass(p, 'bg-red-600/20')).length, 0, 'the banner clears on the next try')
      }
    }
    view.unmount()
  }
}

// ---- the REAL version history panel, a fake viewer iframe and a fake window
async function suiteHistoryPanel(src = {}) {
  for (const flagOn of [false, true]) {
    const listeners = new Set(), posted = []
    const viewerWindow = { postMessage: (message, origin) => posted.push([message, origin]) }
    const iframe = { src: 'http://layout.test/p/deck-1', contentWindow: viewerWindow }
    const confirms = []
    const win = { addEventListener: (type, fn) => { if (type === 'message') listeners.add(fn) }, removeEventListener: (type, fn) => { if (type === 'message') listeners.delete(fn) } }
    const clock = makeClock()
    const world = createWorld({ env: flagOn ? { [FLAG]: 'true' } : {}, src, global: { window: win, confirm: () => { confirms.push(1); return true }, setTimeout: clock.setTimer, clearTimeout: clock.clearTimer } })
    const { VersionHistoryPanel } = world.history()
    const view = mount(VersionHistoryPanel, { isOpen: true, onClose: () => {}, iframeRef: { current: iframe }, viewerOrigin: 'http://layout.test' })
    const deliver = (data, source = viewerWindow, origin = 'http://layout.test') => { for (const fn of [...listeners]) fn({ data, source, origin }) }
    // the list arrives (the message shape the panel reads)
    deliver({ command: 'getVersionHistory', success: true, versions: [{ version_id: 'v-1', created_at: '2026-10-16T10:00:00Z', created_by: 'user' }, { version_id: 'v-2', created_at: '2026-10-16T09:00:00Z', created_by: 'auto-save' }], currentVersionId: 'v-1' })
    posted.length = 0
    const restoreButton = () => { const [button] = view.find(p => p.title === 'Restore this version'); assert.ok(button, 'a Restore button for the older version'); return button }
    const restoreMessage = { command: 'restoreVersion', params: { versionId: 'v-2', createBackup: true, reload: true } }
    const label = flagOn ? 'flag on' : 'flag off'

    if (!flagOn) {
      // flag off: the restore goes out at once, with nothing asked of the viewer first, whatever the save status was
      deliver({ type: 'saveStatusChanged', status: 'unsaved', hasPendingChanges: true })
      restoreButton().props.onClick(); await settle()
      check(assert.deepEqual, posted, [[restoreMessage, 'http://layout.test']], `${label}: restore posted at once, as before`)
      check(assert.equal, listeners.size, 1, `${label}: the panel listens to messages exactly as before`)
      view.unmount(); continue
    }
    // flag on, nothing pending (the last status is clean, or none seen): the restore goes out at once, nothing else is posted
    deliver({ type: 'saveStatusChanged', status: 'saved', hasPendingChanges: false })
    restoreButton().props.onClick(); await settle()
    check(assert.deepEqual, posted, [[restoreMessage, 'http://layout.test']], `${label}: clean: restore posted, no forceSave`)
    // pending: forceSave first; restore only after the viewer reports "saved, nothing pending"
    const unsaved = { type: 'saveStatusChanged', status: 'unsaved', hasPendingChanges: true }
    const cleanEvent = { type: 'saveStatusChanged', status: 'saved', hasPendingChanges: false }
    const begin = async () => { posted.length = 0; deliver(unsaved); restoreButton().props.onClick(); await settle(); assert.equal(posted.length, 1); return posted[0][0] }
    // round 1: answers from another window or origin, or to another request, are ignored; a clean save without the acknowledgement does not release it; the acknowledgement then does
    let force = await begin()
    check(assert.equal, force.action, 'forceSave'); check(assert.deepEqual, force.params, {}); check(assert.equal, typeof force.requestId, 'string')
    check(assert.equal, posted[0][1], 'http://layout.test', 'to the viewer\'s own origin')
    const stranger = { postMessage() {} }
    deliver({ action: 'forceSave', requestId: force.requestId, success: true }, stranger)
    deliver({ action: 'forceSave', requestId: force.requestId, success: true }, viewerWindow, 'http://evil.test')
    deliver({ action: 'forceSave', requestId: 'someone-else', success: true })
    deliver(cleanEvent, stranger)
    await settle()
    check(assert.equal, posted.length, 1, `${label}: untrusted or unrelated messages release nothing`)
    deliver(cleanEvent); await settle()
    check(assert.equal, posted.length, 1, `${label}: a clean save without the forceSave acknowledgement does not release the restore`)
    deliver({ action: 'forceSave', requestId: force.requestId, success: true }); await settle()
    check(assert.deepEqual, posted.slice(1), [[restoreMessage, 'http://layout.test']], `${label}: the trusted acknowledgement releases it (the clean save had come)`)
    // round 2: the acknowledgement alone releases nothing, nor does a save that has only started; the clean save does
    force = await begin()
    deliver({ action: 'forceSave', requestId: force.requestId, success: true }); await settle()
    check(assert.equal, posted.length, 1, `${label}: the forceSave acknowledgement alone does not release the restore`)
    deliver({ type: 'saveStatusChanged', status: 'saving', hasPendingChanges: true }); await settle()
    check(assert.equal, posted.length, 1, `${label}: nor does a save that has only started`)
    deliver(cleanEvent); await settle()
    check(assert.deepEqual, posted.slice(1), [[restoreMessage, 'http://layout.test']], `${label}: the restore goes out after the clean save status`)
    // the viewer never answers forceSave: no restore, the panel says why and lets go of the spinner
    posted.length = 0
    deliver({ type: 'saveStatusChanged', status: 'unsaved', hasPendingChanges: true })
    restoreButton().props.onClick(); await settle()
    clock.advance(8_000); await settle()
    check(assert.equal, posted.length, 1, `${label}: no acknowledgement: only the forceSave was posted`)
    const banner = () => view.find(p => hasClass(p, 'text-red-600') && hasClass(p, 'text-sm'))
    check(assert.equal, banner().map(textOf).join('|'), 'Your latest edits could not be saved first, so the version was not restored. Try again.', `${label}: the panel says why`)
    check(assert.equal, view.find(p => p.title === 'Restore this version')[0].props.disabled, false, `${label}: the Restore button is usable again`)
    // acknowledged, but the save never finishes: no restore after the save budget
    posted.length = 0
    restoreButton().props.onClick(); await settle()
    const [force2] = posted[0]
    deliver({ action: 'forceSave', requestId: force2.requestId, success: true }); await settle()
    clock.advance(20_000); await settle()
    check(assert.equal, posted.length, 1, `${label}: acknowledged but never saved: no restore`)
    check(assert.equal, banner().length > 0, true)
    check(assert.equal, listeners.size, 1, `${label}: the ack listener is gone (only the panel's own remains)`)
    // a restore of the current version, or a declined confirm, does nothing
    view.unmount()
  }
}

// The viewer: thirteen marked lines, in file order (an import and the block of handleSendElementCommand), each at its exact place, none adds a hook.
const INSERTS = [
  { name: 'import', previous: ["import { StudioSlideDeleteRefreshVeil } from '@/components/builder/studio-slide-delete-refresh-veil'"],
    body: /^import \{ STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED, SLIDE_OP_VIEWER_TIMEOUT_MS, isSlideOpViewerAction, slideTotalAfterAck \} from '@\/lib\/studio-slide-ops-via-viewer' / },
  { name: 'the gate', previous: [']\.includes(action)) viewerInteractionIntentRef.current += 1', ''],
    body: /^if \(STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED && isSlideOpViewerAction\(action\)\) \{ / },
  { name: 'the frame lifetime at the send', previous: ['if (STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED && isSlideOpViewerAction(action)) {'],
    body: /^const loadRevisionAtSend = studioComposeLoadRevisionRef\.current / },
  { name: 'the viewer command', previous: ['const loadRevisionAtSend = studioComposeLoadRevisionRef.current'],
    body: /^const result = await sendCommand\(iframeRef\.current, action, params, \{ timeoutMs: SLIDE_OP_VIEWER_TIMEOUT_MS \}\) / },
  { name: 'the canvas veil path of the rail\'s delete', previous: ['const result = await sendCommand(iframeRef.current, action, params, { timeoutMs: SLIDE_OP_VIEWER_TIMEOUT_MS })'],
    body: /^if \(action === 'deleteSlides' && STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studioShell\) studioSlideDeleteRefresh\.acknowledged\(\{ revisionAtSend: loadRevisionAtSend, revisionNow: studioComposeLoadRevisionRef\.current \}\) / },
  { name: 'the total the acknowledgement reports', previous: ["if (action === 'deleteSlides' && STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studioShell) studioSlideDeleteRefresh.acknowledged("],
    body: /^const newTotal = slideTotalAfterAck\(action, result\) / },
  { name: 'the count gate', previous: ['const newTotal = slideTotalAfterAck(action, result)'], body: /^if \(newTotal !== null\) \{ / },
  { name: 'the real total', previous: ['if (newTotal !== null) {'], body: /^setTotalSlides\(newTotal\) / },
  { name: 'the visual total (count sync)', previous: ['setTotalSlides(newTotal)'],
    body: /^if \(STUDIO_SLIDE_COUNT_SYNC_ENABLED\) setVisualTotalSlides\(visualTotalAfterCommit\(\{ totalBefore: slideTotalsRef\.current\.total, visualBefore: slideTotalsRef\.current\.visual, totalAfter: newTotal \}\)\) / },
  { name: 'the modified flag', previous: ['if (STUDIO_SLIDE_COUNT_SYNC_ENABLED) setVisualTotalSlides('], body: /^setSlidesModifiedByCrud\(true\) / },
  { name: 'the count gate close', previous: ['setSlidesModifiedByCrud(true)'], body: /^\} / },
  { name: 'the return', previous: ['setSlidesModifiedByCrud(true)', '}'], body: /^return result / },
  { name: 'the close', previous: ['return result'], body: /^\} / },
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
    check(assert.doesNotMatch, line, /\buse[A-Z][A-Za-z]*\(/, `${insert.name}: adds no hook`)
  })
  // the block is consecutive lines 2..13 and sits right before the Layout Service branch of handleSendElementCommand
  const block = marked.slice(1)
  block.forEach((entry, i) => { if (i > 0) check(assert.equal, entry.index, block[i - 1].index + 1, 'the block is consecutive') })
  check(assert.ok, lines[block[block.length - 1].index + 1].trim().startsWith('// Direct Layout Service command - send to iframe'), 'the Layout Service branch follows the block')
  // the block runs only with the flag on and for the three slide commands; it comes after the interaction-intent bump and before the command-type routing... of the base
  check(assert.match, marked[1].line, /STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED && isSlideOpViewerAction\(action\)/)
  // the viewer reads the flag only through the helper
  check(assert.doesNotMatch, viewer, new RegExp(`process\\.env\\.${FLAG}`))
  // nothing else in the viewer mentions the helper
  const mentions = lines.filter(line => /STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED|SLIDE_OP_VIEWER_TIMEOUT_MS|isSlideOpViewerAction|studio-slide-ops-via-viewer|loadRevisionAtSend/.test(line))
  check(assert.equal, mentions.filter(line => !line.includes(MARK)).length, 0, 'only the marked lines mention the helper')
  // the rail's own delete path is the one #420 left: this block neither edits nor duplicates its marked lines
  check(assert.equal, lines.filter(line => line.includes('PASS2D B4')).length, 6, 'the six PASS2D B4 lines are untouched')
  // the old Layout Service / Elementor branches of handleSendElementCommand are still reachable, in order
  check(assert.ok, viewer.indexOf('const commandType = getCommandType(action)') < viewer.indexOf("if (STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED && isSlideOpViewerAction(action))"), 'the block follows the command-type read')
}
function suiteSources(src = {}) {
  const panel = src.panel ?? SRC.panel, history = src.history ?? SRC.history, lib = src.lib ?? SRC.lib
  const marked = text => text.split('\n').filter(line => line.includes(MARK))
  // slide panel: one import; three handlers, each a flag ternary whose else-branch is the base's call
  check(assert.match, panel, /^import \{ STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED, runSlideOpViaViewer, duplicateSlideCommand, deleteSlideCommand, changeSlideLayoutCommand \} from '@\/lib\/studio-slide-ops-via-viewer' \/\/ SLIDE-OPS-VIA-VIEWER$/m)
  const handler = name => { const m = panel.match(new RegExp(`const ${name} = async \\(\\) => \\{[\\s\\S]*?\\n  \\}\\n`)); assert.ok(m, name); return m[0] }
  check(assert.match, handler('handleDuplicateSlide'), /const result = STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED\n\s+\? await runSlideOpViaViewer\(onSendCommand, duplicateSlideCommand\(slideIndex\), 'Failed to duplicate slide'\)\n\s+: await duplicateSlide\(presentationId, slideIndex\)\n/)
  check(assert.match, handler('handleDeleteSlide'), /const result = STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED\n\s+\? await runSlideOpViaViewer\(onSendCommand, deleteSlideCommand\(slideIndex\), 'Failed to delete slide'\)\n\s+: await deleteSlide\(presentationId, slideIndex\)\n/)
  check(assert.match, handler('handleChangeLayout'), /const result = STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED\n\s+\? await runSlideOpViaViewer\(onSendCommand, changeSlideLayoutCommand\(slideIndex, newLayout\), 'Failed to change layout'\)\n\s+: await changeSlideLayout\(presentationId, slideIndex, newLayout, \{\n\s+preserve_content: true,\n\s+\}\)\n/)
  check(assert.doesNotMatch, panel, new RegExp(`process\\.env\\.${FLAG}`), 'the panel reads the flag through the helper')
  // version history: every added line is marked; restore is posted only on the flag-off path or inside the .then() after an ok flush
  check(assert.equal, (history.match(/command: 'restoreVersion'/g) ?? []).length, 2, 'two restore posts: the base\'s and the one after the flush')
  check(assert.match, history, /\}\)\.then\(flush => \{ \/\/ SLIDE-OPS-VIA-VIEWER\n\s+if \(!flush\.ok\) \{ \/\/ SLIDE-OPS-VIA-VIEWER\n\s+setRestoring\(null\) \/\/ SLIDE-OPS-VIA-VIEWER\n\s+setError\(flush\.message\) \/\/ SLIDE-OPS-VIA-VIEWER\n\s+return \/\/ SLIDE-OPS-VIA-VIEWER\n\s+\} \/\/ SLIDE-OPS-VIA-VIEWER\n\s+iframe\.contentWindow\?\.postMessage\(\{ command: 'restoreVersion', params: \{ versionId, createBackup: true, reload: true \} \}, getLayoutViewerOrigin\(iframe, viewerOrigin\)\) \/\/ SLIDE-OPS-VIA-VIEWER/, 'restore only after an ok flush')
  check(assert.match, history, /void flushViewerBeforeRestore\(\{ \/\/ SLIDE-OPS-VIA-VIEWER/)
  check(assert.match, history, /forceSave: \(\) => requestViewerAck\(channel, 'forceSave', \{\}, RESTORE_FLUSH_ACK_TIMEOUT_MS\)/)
  check(assert.match, history, /saveTimeoutMs: RESTORE_FLUSH_SAVE_TIMEOUT_MS/)
  check(assert.match, history, /^\s+return \/\/ SLIDE-OPS-VIA-VIEWER$/m, 'the flag-on path returns before the base\'s post')
  check(assert.match, history, /if \(saveTracker\) \{ \/\/ SLIDE-OPS-VIA-VIEWER/, 'the whole branch is behind the tracker, which exists only with the flag on')
  check(assert.match, history, /useState\(\(\) => \(STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED \? createSaveStatusTracker\(\) : null\)\)/)
  check(assert.match, history, /saveTracker\?\.record\(event\.data\) \/\/ SLIDE-OPS-VIA-VIEWER/)
  check(assert.doesNotMatch, history, new RegExp(`process\\.env\\.${FLAG}`), 'the history panel reads the flag through the helper')
  check(assert.ok, marked(history).length >= 20, 'the history panel\'s added lines are marked')
  // helper
  check(assert.doesNotMatch, lib, /^import\s/m, 'the helper has no imports')
  check(assert.equal, (lib.match(new RegExp(`process\\.env\\.${FLAG}`, 'g')) ?? []).length, 1, 'the flag is read once, in the helper')
}
function suiteBaseIdentity(src = {}) {
  // flag-off identity: with the marked lines removed, the viewer and the version history panel are the base's byte for byte; the slide panel is the base's once the three ternaries are put back
  const strip = text => text.split('\n').filter(line => !line.includes(MARK)).join('\n')
  const baseViewer = baseSource(FILES.viewer), baseHistory = baseSource(FILES.history), basePanel = baseSource(FILES.panel)
  if (!baseViewer) { console.log(`  SKIP base identity: ${BASE_COMMIT} is not in this clone`); return }
  // The committed change set must be only this branch's files. If the branch has moved past its base (other work merged on top, so these files may have changed for other reasons), identity against the base no longer applies.
  // (Committed state only: other tests in the full suite rewrite tracked evidence files in the working tree.)
  const allowed = new Set([FILES.viewer, FILES.panel, FILES.history, FILES.lib, '.env.example', 'package.json', 'scripts/test-studio-rail-add-slide.mjs', 'scripts/test-studio-slide-delete-refresh.mjs', 'scripts/test-studio-slide-ops-via-viewer.mjs'])
  let committed = []
  try { committed = git(['diff', '--name-only', BASE_COMMIT, 'HEAD', '--']).split('\n').filter(Boolean) } catch { committed = [] }
  const drifted = committed.filter(file => !allowed.has(file))
  if (drifted.length) { console.log(`  SKIP base identity: the branch has moved past ${BASE_COMMIT} (${drifted.length} other files changed since)`); return }
  check(assert.equal, strip(src.viewer ?? SRC.viewer), baseViewer, 'viewer minus the marked lines == base')
  check(assert.equal, strip(src.history ?? SRC.history), baseHistory, 'version history panel minus the marked lines == base')
  let panel = strip(src.panel ?? SRC.panel)
  panel = panel.replace(/const result = STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED\n\s+\? await runSlideOpViaViewer\(onSendCommand, duplicateSlideCommand\(slideIndex\), 'Failed to duplicate slide'\)\n\s+: await duplicateSlide\(presentationId, slideIndex\)\n/, 'const result = await duplicateSlide(presentationId, slideIndex)\n')
  panel = panel.replace(/const result = STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED\n\s+\? await runSlideOpViaViewer\(onSendCommand, deleteSlideCommand\(slideIndex\), 'Failed to delete slide'\)\n\s+: await deleteSlide\(presentationId, slideIndex\)\n/, 'const result = await deleteSlide(presentationId, slideIndex)\n')
  panel = panel.replace(/const result = STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED\n\s+\? await runSlideOpViaViewer\(onSendCommand, changeSlideLayoutCommand\(slideIndex, newLayout\), 'Failed to change layout'\)\n\s+: await changeSlideLayout\(presentationId, slideIndex, newLayout, \{\n\s+preserve_content: true,\n\s+\}\)\n/, 'const result = await changeSlideLayout(presentationId, slideIndex, newLayout, {\n        preserve_content: true,\n      })\n')
  check(assert.equal, panel, basePanel, 'slide panel with the three ternaries put back == base')
}
function suiteWiring(src = {}) {
  check(assert.match, ENVEX, new RegExp(`^${FLAG}="false"$`, 'm'), 'documented in .env.example, default off')
  check(assert.equal, PKG.scripts['test:studio-slide-ops-via-viewer'], 'node scripts/test-studio-slide-ops-via-viewer.mjs', 'npm script registered')
  const readers = []
  const users = []
  for (const rel of ['components', 'lib', 'hooks', 'app']) {
    const walk = dir => { for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
      const next = path.posix.join(dir, entry.name)
      if (entry.isDirectory()) walk(next)
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const text = fs.readFileSync(path.join(repoRoot, next), 'utf8')
        if (text.includes(`process.env.${FLAG}`)) readers.push(next)
        if (text.includes('studio-slide-ops-via-viewer')) users.push(next)
      }
    } }
    walk(rel)
  }
  check(assert.deepEqual, readers, [FILES.lib], 'the flag is read in exactly one file')
  // + VERSION-HISTORY-V2: its panel reuses the helper's proven restore flush (scripts/test-studio-version-history-v2.mjs pins how); the old panel above stays the one this flag guards.
  check(assert.deepEqual, users.sort(), [FILES.history, FILES.viewer, FILES.panel, 'components/version-history-panel-v2.tsx', 'lib/studio-image-pending-runtime.ts'].sort(), 'exactly the three components import the helper (+ the Version history v2 panel, which reuses its flush, + IMAGE-PENDING-WRITE\'s runtime, which was already on the base)')
  // the older rail add-slide test counts the viewer's added lines against a fixed commit; it skips the marked ones, and only the marked ones
  const rail = read('scripts/test-studio-rail-add-slide.mjs')
  check(assert.match, rail, /!line\.includes\('PASS2D B4'\) && !line\.includes\('SLIDE-OPS-VIA-VIEWER'\)/, 'the rail test skips this flag\'s marked lines')
  const deleteRefresh = read('scripts/test-studio-slide-delete-refresh.mjs')
  check(assert.match, deleteRefresh, /\.test\(line\) && !line\.includes\('SLIDE-OPS-VIA-VIEWER'\)\)/, 'the delete-refresh test skips this flag\'s one line that takes its veil path')
}
const SUITES = { flag: suiteFlag, commands: suiteCommands, ackTotals: suiteAckTotals, runOp: suiteRunOp, ack: suiteAck, tracker: suiteTracker, restoreFlush: suiteRestoreFlush, slidePanel: suiteSlidePanel, historyPanel: suiteHistoryPanel, viewer: suiteViewer, sources: suiteSources, baseIdentity: suiteBaseIdentity, wiring: suiteWiring }
// a broken source can leave a promise pending forever (a wait that never ends): a suite that does not finish in time fails
const runSuite = (suite, src, ms) => { let timer; return Promise.race([Promise.resolve().then(() => suite(src)), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('suite did not finish')), ms) })]).finally(() => clearTimeout(timer)) }
for (const [name, suite] of Object.entries(SUITES)) { await runSuite(suite, {}, 30_000); console.log(`ok   ${name}`) }

// ---------------------------------------------------------------- mutants
const replaceOnce = (source, from, to) => { assert.ok(source.includes(from), `mutant anchor missing: ${from}`); return source.replace(from, to) }
const MUTANTS = [
  ['flag parse accepts any truthy value', { lib: s => replaceOnce(s, "process.env.NEXT_PUBLIC_STUDIO_SLIDE_OPS_VIA_VIEWER === 'true'", '!!process.env.NEXT_PUBLIC_STUDIO_SLIDE_OPS_VIA_VIEWER') }],
  ['command timeout 5 s', { lib: s => replaceOnce(s, 'SLIDE_OP_VIEWER_TIMEOUT_MS = 30_000', 'SLIDE_OP_VIEWER_TIMEOUT_MS = 5_000') }],
  ['restore save budget 5 s', { lib: s => replaceOnce(s, 'RESTORE_FLUSH_SAVE_TIMEOUT_MS = 20_000', 'RESTORE_FLUSH_SAVE_TIMEOUT_MS = 5_000') }],
  ['duplicate drops insert_after', { lib: s => replaceOnce(s, 'params: { index, insert_after: true }', 'params: { index }') }],
  ['delete sends the single-slide command', { lib: s => replaceOnce(s, "action: 'deleteSlides', params: { indices: [index] }", "action: 'deleteSlide', params: { index }") }],
  ['delete sends a number, not a list', { lib: s => replaceOnce(s, 'params: { indices: [index] }', 'params: { indices: index }') }],
  ['layout change drops preserve_content', { lib: s => replaceOnce(s, 'new_layout: newLayout, preserve_content: true', 'new_layout: newLayout') }],
  ['layout change renames the parameter', { lib: s => replaceOnce(s, 'new_layout: newLayout', 'newLayout') }],
  ['isSlideOpViewerAction accepts the single delete', { lib: s => replaceOnce(s, "['duplicateSlide', 'deleteSlides', 'changeSlideLayout']", "['duplicateSlide', 'deleteSlides', 'changeSlideLayout', 'deleteSlide']") }],
  ['total: a delete reads slide_count', { lib: s => replaceOnce(s, "action === 'deleteSlides' ? ack?.remaining_slide_count", "action === 'deleteSlides' ? ack?.slide_count") }],
  ['total: a layout change reports a count', { lib: s => replaceOnce(s, ": action === 'duplicateSlide' ? (ack?.slide_count ?? ack?.data?.slideCount) : undefined", ': (ack?.slide_count ?? ack?.data?.slideCount)') }],
  ['total: zero is a total', { lib: s => replaceOnce(s, 'Number.isInteger(total) && total > 0', 'Number.isInteger(total)') }],
  ['total: a fraction is a total', { lib: s => replaceOnce(s, 'Number.isInteger(total) && total > 0', 'total > 0') }],
  ['isSlideOpViewerAction accepts anything', { lib: s => replaceOnce(s, "return (SLIDE_OP_VIEWER_ACTIONS as readonly string[]).includes(action)", 'return true') }],
  ['a refusal counts as success', { lib: s => replaceOnce(s, 'if (reply && reply.success === false) {', 'if (false) {') }],
  ['a timeout is reported as a plain failure', { lib: s => replaceOnce(s, "if (/command timeout/i.test(message)) {", 'if (false) {') }],
  ['a failure loses the viewer\'s words', { lib: s => replaceOnce(s, "message: reply.error || failureMessage", 'message: failureMessage') }],
  ['an unconfirmed message changed', { lib: s => replaceOnce(s, 'Check the slide list before trying again.', 'Try again.') }],
  ['ack accepts any request id', { lib: s => replaceOnce(s, 'reply.action !== action || reply.requestId !== requestId', 'reply.action !== action') }],
  ['ack accepts any action', { lib: s => replaceOnce(s, 'reply.action !== action || reply.requestId !== requestId', 'reply.requestId !== requestId') }],
  ['ack treats a truthy success as success', { lib: s => replaceOnce(s, 'if (reply.success === true) settle', 'if (reply.success) settle') }],
  ['ack never times out', { lib: s => replaceOnce(s, "timer = clock.setTimer(() => { timer = null; settle(() => reject(new Error('Command timeout'))) }, timeoutMs)", 'timer = null') }],
  ['ack timeout error text changed (the rail\'s unconfirmed detection)', { lib: s => replaceOnce(s, "new Error('Command timeout')", "new Error('Timed out')") }],
  ['ack keeps listening after it settles', { lib: s => replaceOnce(s, "      unlisten()\n      callback()", '      callback()') }],
  ['ack posts without the request id', { lib: s => replaceOnce(s, 'channel.post({ action, params, requestId })', 'channel.post({ action, params })') }],
  ['tracker accepts any message type', { lib: s => replaceOnce(s, "if (!message || (message.type !== 'saveStatusChanged' && message.type !== 'save_status')) return", 'if (!message) return') }],
  ['tracker accepts an unknown status', { lib: s => replaceOnce(s, "!['saved', 'unsaved', 'saving', 'error'].includes(message.status)", 'false') }],
  ['tracker reads a missing pending flag as false', { lib: s => replaceOnce(s, "typeof message.hasPendingChanges === 'boolean' ? message.hasPendingChanges : undefined", 'message.hasPendingChanges === true') }],
  ['clean = saved, whatever is pending', { lib: s => replaceOnce(s, "event.status === 'saved' && event.hasPendingChanges === false", "event.status === 'saved'") }],
  ['clean = no pending changes, whatever the status', { lib: s => replaceOnce(s, "event.status === 'saved' && event.hasPendingChanges === false", 'event.hasPendingChanges === false') }],
  ['a wait resolves on any status event', { lib: s => replaceOnce(s, 'if (isCleanSaveEvent(last)) for (const settle of [...waiters]) settle()', 'for (const settle of [...waiters]) settle()') }],
  ['a wait never times out', { lib: s => replaceOnce(s, 'timer = clock.setTimer(() => { timer = null; finish(false) }, timeoutMs)', 'timer = null') }],
  ['a wait times out as success', { lib: s => replaceOnce(s, 'timer = clock.setTimer(() => { timer = null; finish(false) }, timeoutMs)', 'timer = clock.setTimer(() => { timer = null; finish(true) }, timeoutMs)') }],
  ['cancel resolves true', { lib: s => replaceOnce(s, 'return { promise, cancel: () => finish(false) }', 'return { promise, cancel: () => finish(true) }') }],
  ['a settled wait keeps its timer', { lib: s => replaceOnce(s, 'if (timer !== null) { clock.clearTimer(timer); timer = null }\n        done(clean)', 'done(clean)') }],
  ['flush asks the viewer even when clean', { lib: s => replaceOnce(s, 'if (seen === null || isCleanSaveEvent(seen)) return { ok: true, flushed: false }', '') }],
  ['flush treats "nothing seen" as dirty', { lib: s => replaceOnce(s, 'if (seen === null || isCleanSaveEvent(seen))', 'if (isCleanSaveEvent(seen))') }],
  ['flush arms the wait after the command', { lib: s => replaceOnce(s, "  const clean = tracker.waitForClean(saveTimeoutMs)\n  try {\n    await forceSave()\n  } catch {\n    clean.cancel()\n    return { ok: false, reason: 'ack', message: RESTORE_NOT_SAVED_MESSAGE }\n  }\n", "  try {\n    await forceSave()\n  } catch {\n    return { ok: false, reason: 'ack', message: RESTORE_NOT_SAVED_MESSAGE }\n  }\n  const clean = tracker.waitForClean(saveTimeoutMs)\n") }],
  ['flush does not wait for the clean save (the ack is enough)', { lib: s => replaceOnce(s, 'if (await clean.promise) return { ok: true, flushed: true }', 'return { ok: true, flushed: true }') }],
  ['flush does not cancel the wait when the ack fails', { lib: s => replaceOnce(s, '    clean.cancel()\n    return { ok: false, reason', '    return { ok: false, reason') }],
  ['flush proceeds when the ack fails', { lib: s => replaceOnce(s, "return { ok: false, reason: 'ack', message: RESTORE_NOT_SAVED_MESSAGE }", 'return { ok: true, flushed: false }') }],
  ['flush default save budget 10 s', { lib: s => replaceOnce(s, 'saveTimeoutMs = RESTORE_FLUSH_SAVE_TIMEOUT_MS', 'saveTimeoutMs = 10_000') }],
  ['restore message changed', { lib: s => replaceOnce(s, 'so the version was not restored. Try again.', 'try again.') }],
  ['lib gains an import', { lib: s => `import fs from 'fs'\n${s}` }],
  ['slide panel: delete not behind the flag', { panel: s => replaceOnce(s, "const result = STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED\n        ? await runSlideOpViaViewer(onSendCommand, deleteSlideCommand(slideIndex), 'Failed to delete slide')\n        : await deleteSlide(presentationId, slideIndex)", "const result = await runSlideOpViaViewer(onSendCommand, deleteSlideCommand(slideIndex), 'Failed to delete slide')") }],
  ['slide panel: duplicate calls both', { panel: s => replaceOnce(s, '? await runSlideOpViaViewer(onSendCommand, duplicateSlideCommand(slideIndex), \'Failed to duplicate slide\')', '? (await duplicateSlide(presentationId, slideIndex), await runSlideOpViaViewer(onSendCommand, duplicateSlideCommand(slideIndex), \'Failed to duplicate slide\'))') }],
  ['slide panel: layout change flag-on sends the delete command', { panel: s => replaceOnce(s, 'changeSlideLayoutCommand(slideIndex, newLayout)', 'deleteSlideCommand(slideIndex)') }],
  ['slide panel: flag-off layout change loses preserve_content', { panel: s => replaceOnce(s, ': await changeSlideLayout(presentationId, slideIndex, newLayout, {\n          preserve_content: true,\n        })', ': await changeSlideLayout(presentationId, slideIndex, newLayout, {})') }],
  ['slide panel: failure wording changed', { panel: s => replaceOnce(s, "'Failed to delete slide')\n        : await deleteSlide", "'Delete failed')\n        : await deleteSlide") }],
  ['slide panel: reads the flag itself', { panel: s => `const __x = process.env.NEXT_PUBLIC_STUDIO_SLIDE_OPS_VIA_VIEWER\n${s}` }],
  ['viewer: the block runs without the flag', { viewer: s => replaceOnce(s, 'if (STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED && isSlideOpViewerAction(action)) {', 'if (isSlideOpViewerAction(action)) {') }],
  ['viewer: the block runs for every command', { viewer: s => replaceOnce(s, 'if (STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED && isSlideOpViewerAction(action)) {', 'if (STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED) {') }],
  ['viewer: default 5 s command budget', { viewer: s => replaceOnce(s, 'params, { timeoutMs: SLIDE_OP_VIEWER_TIMEOUT_MS })', 'params)') }],
  ['viewer: the veil without the delete-refresh flag', { viewer: s => replaceOnce(s, "if (action === 'deleteSlides' && STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studioShell)", "if (action === 'deleteSlides' && studioShell)") }],
  ['viewer: the veil for every slide command', { viewer: s => replaceOnce(s, "if (action === 'deleteSlides' && STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studioShell)", 'if (STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED && studioShell)') }],
  ['viewer: the revision read after the reply', { viewer: s => replaceOnce(s, 'revisionAtSend: loadRevisionAtSend', 'revisionAtSend: studioComposeLoadRevisionRef.current') }],
  ['viewer: the reply is dropped', { viewer: s => replaceOnce(s, 'return result // SLIDE-OPS-VIA-VIEWER', 'return undefined // SLIDE-OPS-VIA-VIEWER') }],
  ['viewer: a hook added on a marked line', { viewer: s => replaceOnce(s, 'return result // SLIDE-OPS-VIA-VIEWER', 'return useRef(result) // SLIDE-OPS-VIA-VIEWER') }],
  ['viewer: an unmarked line added', { viewer: s => replaceOnce(s, '    } // SLIDE-OPS-VIA-VIEWER\n', '    } // SLIDE-OPS-VIA-VIEWER\n    void 0\n') }],
  ['viewer: the block moved above the intent bump', { viewer: s => { const lines = s.split('\n'); const i = lines.findIndex(l => l.includes("if (STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED && isSlideOpViewerAction(action))")); const block = lines.splice(i, 6); const at = lines.findIndex(l => l.includes('const commandType = getCommandType(action)')); lines.splice(at, 0, ...block); return lines.join('\n') } }],
  ['viewer: the count committed without the helper', { viewer: s => replaceOnce(s, 'const newTotal = slideTotalAfterAck(action, result) // SLIDE-OPS-VIA-VIEWER', 'const newTotal = result?.slide_count ?? null // SLIDE-OPS-VIA-VIEWER') }],
  ['viewer: the count committed even without a total', { viewer: s => replaceOnce(s, 'if (newTotal !== null) { // SLIDE-OPS-VIA-VIEWER', 'if (true) { // SLIDE-OPS-VIA-VIEWER') }],
  ['viewer: the visual total committed without the count-sync flag', { viewer: s => replaceOnce(s, 'if (STUDIO_SLIDE_COUNT_SYNC_ENABLED) setVisualTotalSlides(visualTotalAfterCommit(', 'setVisualTotalSlides(visualTotalAfterCommit(') }],
  ['viewer: the visual total ignores the pending sections', { viewer: s => replaceOnce(s, 'totalBefore: slideTotalsRef.current.total, visualBefore: slideTotalsRef.current.visual, totalAfter: newTotal', 'totalBefore: 0, visualBefore: 0, totalAfter: newTotal') }],
  ['viewer: the structure is not marked stale', { viewer: s => replaceOnce(s, '        setSlidesModifiedByCrud(true) // SLIDE-OPS-VIA-VIEWER\n', '') }],
  ['viewer: reads the flag itself', { viewer: s => `const __x = process.env.NEXT_PUBLIC_STUDIO_SLIDE_OPS_VIA_VIEWER\n${s}` }],
  ['history: the restore goes out without waiting', { history: s => replaceOnce(s, 'if (!flush.ok) { // SLIDE-OPS-VIA-VIEWER', 'if (false) { // SLIDE-OPS-VIA-VIEWER') }],
  ['history: a refused flush leaves the spinner on', { history: s => replaceOnce(s, 'setRestoring(null) // SLIDE-OPS-VIA-VIEWER', 'void 0 // SLIDE-OPS-VIA-VIEWER') }],
  ['history: a refused flush says nothing', { history: s => replaceOnce(s, 'setError(flush.message) // SLIDE-OPS-VIA-VIEWER', 'void 0 // SLIDE-OPS-VIA-VIEWER') }],
  ['history: the flag-on path falls through to the base post', { history: s => replaceOnce(s, '      return // SLIDE-OPS-VIA-VIEWER\n    } // SLIDE-OPS-VIA-VIEWER', '    } // SLIDE-OPS-VIA-VIEWER') }],
  ['history: the tracker exists without the flag', { history: s => replaceOnce(s, '(STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED ? createSaveStatusTracker() : null)', 'createSaveStatusTracker()') }],
  ['history: the tracker misses the viewer messages', { history: s => replaceOnce(s, 'saveTracker?.record(event.data) // SLIDE-OPS-VIA-VIEWER', 'void 0 // SLIDE-OPS-VIA-VIEWER') }],
  ['history: trusts any window', { history: s => replaceOnce(s, 'if (isTrustedLayoutViewerMessage(event, iframe, viewerOrigin)) handler(event.data)', 'handler(event.data)') }],
  ['history: forceSave posted to any origin', { history: s => replaceOnce(s, 'iframe.contentWindow?.postMessage(message, getLayoutViewerOrigin(iframe, viewerOrigin))', "iframe.contentWindow?.postMessage(message, '*')") }],
  ['history: the ack budget 1 s', { history: s => replaceOnce(s, "'forceSave', {}, RESTORE_FLUSH_ACK_TIMEOUT_MS", "'forceSave', {}, 1000") }],
  ['history: the restore message changed', { history: s => replaceOnce(s, "{ command: 'restoreVersion', params: { versionId, createBackup: true, reload: true } }", "{ command: 'restoreVersion', params: { versionId } }") }],
  ['history: reads the flag itself', { history: s => `const __x = process.env.NEXT_PUBLIC_STUDIO_SLIDE_OPS_VIA_VIEWER\n${s}` }],
]
let caught = 0
for (const [label, mutation] of MUTANTS) {
  const src = {}
  for (const [key, fn] of Object.entries(mutation)) src[key] = fn(SRC[key])
  let failedIn = null
  for (const [name, suite] of Object.entries(SUITES)) {
    try { await runSuite(suite, src, 4_000) } catch { failedIn = name; break }
  }
  assert.ok(failedIn, `mutant NOT caught: ${label}`)
  caught++
  if (process.env.VERBOSE) console.log(`     caught by [${failedIn}]: ${label}`)
}
console.log(`ok   mutants: ${caught} of ${MUTANTS.length} caught`)
console.log(`PASS: studio slide ops via viewer (${checks} checks, ${MUTANTS.length} mutants)`)
