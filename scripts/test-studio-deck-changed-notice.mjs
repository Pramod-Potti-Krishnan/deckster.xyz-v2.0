// MULTITAB J2 P1: NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE (default off). A second tab never learned that the first one changed the deck
// (tab A 7 slides, tab B still 6) and said nothing. lib/studio-deck-changed-notice.ts has the full story.
//
// Proves, offline (fake BroadcastChannel hub, fake clock and timers, fake document / window, fake inventory reads; no browser,
// socket, fetch or timer is real):
//   1. the command table: which Layout viewer acks change the shared deck (slide add / delete / duplicate / reorder / layout,
//      composer slide, element create / delete) and which do not (navigation, edit mode, reads, placeholders, text formatting);
//   2. the wire message: ids and a kind only (no PII), a channel per session + deck, and the receive filter (own tab, other
//      session, other deck, wrong version / kind, junk);
//   3. the comparison rule (count, then signature only against this tab's own earlier read; an empty inventory is no verdict), and
//      the theme rule (only Director's `applied` for a theme the user picked here, recently, announces; the connect-time sync, a
//      restore, a failure and a stale pick do not);
//   4. the controller, two tabs on one hub: A's change reaches B once as a notice (immediately, one inventory read, no read for a
//      second message while the notice is up), A never gets its own notice, the send is throttled with a trailing send, a received
//      message / a reload silences this tab's own sends (no loop), a circuit breaker caps the rate, Reload deck ignores messages
//      sent before it, Dismiss re-arms; the visibility / focus path reads once per throttle window, only when visible, never after
//      this tab's own change or edit, and shows the notice only when the count or the signature differs; no BroadcastChannel and a
//      throwing one degrade to the visibility path; dispose closes everything;
//   5. flag off: every bridge entry is inert (no listener runs, no viewer state is kept);
//   6. the notice component: nothing without a notice, the calm copy, and it never reloads by itself;
//   7. the wiring: the page (flag read as a literal, hook inputs, reload = the existing deck-mutation reload, theme only when the
//      user picked it and WITHOUT touching the onMessage region the #371 chat harness pins nor handleBuildThemeChange (the session-hygiene
//      suite executes it), deck_mutation announced, none during a build in this tab), the viewer (the S-03 effect stays byte-for-byte; one ack funnel, Elementor injection, iframe element delete, own
//      autosave, viewer state), no WebSocket hook change, no new endpoint, .env.example and package.json;
//   8. mutants: broken copies of the module, the component, the page and the viewer must each be caught.
//
//   node scripts/test-studio-deck-changed-notice.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(path.join(root, 'package.json'))
const FLAG = 'NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const LIB = 'lib/studio-deck-changed-notice.ts'
const HOOK = 'hooks/use-deck-changed-notice.ts'
const COMPONENT = 'components/builder/studio-deck-changed-notice.tsx'
const PAGE = 'app/builder/page.tsx'
const VIEWER = 'components/presentation-viewer.tsx'
const SRC = {
  [LIB]: read(LIB),
  [HOOK]: read(HOOK),
  [COMPONENT]: read(COMPONENT),
  [PAGE]: read(PAGE),
  [VIEWER]: read(VIEWER),
  'hooks/use-deckster-websocket-v2.ts': read('hooks/use-deckster-websocket-v2.ts'),
  'lib/slide-rail-identity.ts': read('lib/slide-rail-identity.ts'),
  '.env.example': read('.env.example'),
  'package.json': read('package.json'),
}

const transpile = (text, jsx = false) => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) },
}).outputText

/** Load the (import-free) lib with the given env: a fresh module instance, so its bridge state is its own. */
function loadLib(sources, env) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(sources[LIB]), {
    module: mod, exports: mod.exports, process: { env: { ...env } }, require: id => assert.fail(`the module must stay import-free: ${id}`),
    setTimeout, clearTimeout, Date, Math, globalThis: { crypto: { randomUUID: () => 'tab-uuid-fixed' } },
  })
  return mod.exports
}

/** Render the notice component to static markup (the real file, real React). */
function loadComponent(sources) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(sources[COMPONENT], true), { module: mod, exports: mod.exports, require: id => nodeRequire(id), console })
  const React = nodeRequire('react')
  const { renderToStaticMarkup } = nodeRequire('react-dom/server')
  return props => renderToStaticMarkup(React.createElement(mod.exports.StudioDeckChangedNotice, props))
}

// ---------------------------------------------------------------- fakes
function makeClock() {
  const clock = { t: 100_000, timers: [], nextId: 1 }
  clock.now = () => clock.t
  clock.setTimer = (fn, ms) => { const id = clock.nextId++; clock.timers.push({ id, at: clock.t + ms, fn }); return id }
  clock.clearTimer = id => { clock.timers = clock.timers.filter(timer => timer.id !== id) }
  clock.advance = ms => {
    const end = clock.t + ms
    for (;;) {
      const due = clock.timers.filter(timer => timer.at <= end).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      clock.timers = clock.timers.filter(timer => timer !== due)
      clock.t = Math.max(clock.t, due.at)
      due.fn()
    }
    clock.t = end
  }
  return clock
}

/** BroadcastChannel semantics: a message reaches every OTHER channel object of the same name (never the posting object). */
function makeHub({ echoToSender = false } = {}) {
  const channels = []
  const posted = []
  return {
    channels, posted,
    create(name) {
      const channel = {
        name, onmessage: null, closed: false,
        postMessage(data) {
          posted.push({ name, data: JSON.parse(JSON.stringify(data)) })
          for (const other of channels) {
            if (other.name === name && !other.closed && other.onmessage && (echoToSender || other !== channel)) other.onmessage({ data: JSON.parse(JSON.stringify(data)) })
          }
        },
        close() { channel.closed = true },
      }
      channels.push(channel)
      return channel
    },
  }
}

function makeEvents(visibilityState = 'visible') {
  const listeners = new Map()
  return {
    visibilityState,
    addEventListener(type, fn) { (listeners.get(type) ?? listeners.set(type, new Set()).get(type)).add(fn) },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
    fire(type) { for (const fn of Array.from(listeners.get(type) ?? [])) fn() },
    count(type) { return listeners.get(type)?.size ?? 0 },
  }
}

const SESSION = 'sess-1'
const DECK = 'deck-1'
const inventory = (ids, version = 'v1') => ({ slideCount: ids.length, slides: ids.map(slideId => ({ slideId, contentVersion: `${version}-${slideId}`, layout: 'C1' })) })
const plain = value => JSON.parse(JSON.stringify(value))
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }

/** One tab: a controller on the shared hub, with its own fake document / window / inventory. */
function makeTab(lib, hub, clock, tabId, overrides = {}) {
  const tab = {
    reads: 0, notices: [], doc: makeEvents(), win: makeEvents(),
    inventory: inventory(['s1', 's2']), viewer: { presentationId: DECK, slideCount: 2, unsaved: false },
    readImpl: null,
  }
  tab.controller = lib.createDeckChangedController({
    sessionId: SESSION, presentationId: DECK, tabId,
    createChannel: name => hub.create(name),
    readInventory: async () => { tab.reads++; return tab.readImpl ? tab.readImpl() : tab.inventory },
    getViewerState: () => tab.viewer,
    onNotice: notice => tab.notices.push(notice),
    doc: tab.doc, win: tab.win,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    ...overrides,
  })
  tab.shown = () => tab.notices.filter(Boolean)
  tab.current = () => tab.controller.getNotice()
  return tab
}

// ---------------------------------------------------------------- the checks
async function run(sources) {
  const failures = []
  let checks = 0
  const check = async (fn, ...args) => {
    checks++
    try { await fn(...args) } catch (error) { failures.push(String(args[args.length - 1] ?? error.message).slice(0, 200) + ' :: ' + String(error.message).split('\n')[0]) }
  }
  const test = async (name, fn) => {
    checks++
    try { await fn() } catch (error) { failures.push(`${name} :: ${String(error.message).split('\n')[0].slice(0, 220)}`) }
  }

  let on, off
  try {
    on = loadLib(sources, { [FLAG]: 'true' })
    off = loadLib(sources, {})
  } catch (error) {
    return { checks: 1, failures: [`module failed to load: ${error.message}`] }
  }

  // ---- 1. flag + command table
  await check(assert.equal, off.STUDIO_DECK_CHANGED_NOTICE_ENABLED, false, 'unset env is OFF')
  await check(assert.equal, loadLib(sources, { [FLAG]: 'false' }).STUDIO_DECK_CHANGED_NOTICE_ENABLED, false, '"false" is OFF')
  await check(assert.equal, loadLib(sources, { [FLAG]: '1' }).STUDIO_DECK_CHANGED_NOTICE_ENABLED, false, '"1" is OFF (exact "true" only)')
  await check(assert.equal, loadLib(sources, { [FLAG]: 'TRUE' }).STUDIO_DECK_CHANGED_NOTICE_ENABLED, false, '"TRUE" is OFF')
  await check(assert.equal, on.STUDIO_DECK_CHANGED_NOTICE_ENABLED, true, '"true" is ON')
  for (const action of ['addSlide', 'duplicateSlide', 'deleteSlides', 'reorderSlides', 'changeSlideLayout', 'composeSlideReconcile', 'refineSlideReconcile']) {
    await check(assert.equal, on.classifyDeckCommand(action), 'slide', `${action} changes the deck (slide)`)
  }
  for (const action of ['insertTextBox', 'insertTable', 'insertImage', 'insertChart', 'insertInfographic', 'insertDiagram', 'insertShape',
    'upsertSemanticElement', 'upsertCitedElement', 'deleteElement', 'deleteTextBox', 'generateImage', 'generateChartData', 'generateText']) {
    await check(assert.equal, on.classifyDeckCommand(action), 'element', `${action} changes the deck (element)`)
  }
  for (const action of ['goToSlide', 'nextSlide', 'getCurrentSlideInfo', 'composeGetState', 'isEditModeActive', 'enterEditMode', 'exitEditMode',
    'toggleBorderHighlight', 'forceSave', 'composePlaceholderAdd', 'composePlaceholderFail', 'composePlaceholderUpdate', 'refineOverlayMark',
    'refineOverlayClear', 'formatText', 'getElementGeometry', 'getElementMutationReceipt', 'bringToFront', 'refreshSlide', 'constructor', '__proto__', '', null, undefined, 7]) {
    await check(assert.equal, on.classifyDeckCommand(action), null, `${String(action)} does not change the shared deck`)
  }

  // ---- 2. the wire message
  await check(assert.equal, on.deckChangedChannelName('sess-1', 'deck-1'), 'deckster:deck-changed:v1:sess-1:deck-1', 'channel name = session + deck')
  await check(assert.notEqual, on.deckChangedChannelName('sess-1', 'deck-1'), on.deckChangedChannelName('sess-1', 'deck-2'), 'another deck -> another channel')
  await check(assert.notEqual, on.deckChangedChannelName('sess-1', 'deck-1'), on.deckChangedChannelName('sess-2', 'deck-1'), 'another session -> another channel')
  for (const [s, p] of [[null, 'd'], ['s', null], ['', 'd'], ['s', ' '], [undefined, undefined], ['x'.repeat(201), 'd']]) {
    await check(assert.equal, on.deckChangedChannelName(s, p), null, `no channel for session=${String(s).slice(0, 8)} deck=${String(p)}`)
  }
  const good = { v: 1, type: 'deck-changed', tabId: 'tab-a', sessionId: SESSION, presentationId: DECK, change: 'slide', sentAt: 5 }
  const expected = { sessionId: SESSION, presentationId: DECK, tabId: 'tab-b' }
  await check(assert.deepEqual, plain(on.parseDeckChangedMessage(good, expected)), good, 'a valid message from another tab parses')
  const rejected = [
    ['own tab', { ...good, tabId: 'tab-b' }], ['other session', { ...good, sessionId: 'sess-2' }], ['other deck', { ...good, presentationId: 'deck-2' }],
    ['version 2', { ...good, v: 2 }], ['other type', { ...good, type: 'x' }], ['unknown change', { ...good, change: 'theme2' }],
    ['no tab id', { ...good, tabId: '' }], ['sentAt not a number', { ...good, sentAt: '5' }], ['sentAt NaN', { ...good, sentAt: NaN }],
    ['array', [good]], ['string', 'deck-changed'], ['null', null], ['undefined', undefined], ['number', 4],
  ]
  for (const [name, data] of rejected) await check(assert.equal, on.parseDeckChangedMessage(data, expected), null, `ignored: ${name}`)
  await check(assert.deepEqual, plain(on.parseDeckChangedMessage({ ...good, email: 'a@b.c', title: 'Q3', extra: 1 }, expected)), good, 'extra fields never survive parsing')

  // ---- 3. the comparison rule
  await check(assert.equal, on.inventorySignature(inventory(['a', 'b'])), on.inventorySignature(inventory(['a', 'b'])), 'same inventory -> same signature')
  await check(assert.notEqual, on.inventorySignature(inventory(['a', 'b'])), on.inventorySignature(inventory(['b', 'a'])), 'order changes the signature')
  await check(assert.notEqual, on.inventorySignature(inventory(['a', 'b'])), on.inventorySignature(inventory(['a', 'b'], 'v2')), 'a content version changes the signature')
  await check(assert.notEqual, on.inventorySignature(inventory(['a', 'b'])), on.inventorySignature(inventory(['a', 'b', 'c'])), 'a new slide changes the signature')
  const differs = (viewerSlideCount, readCount, readSignature, knownSignature) => on.inventoryDiffers({ viewerSlideCount, readCount, readSignature, knownSignature })
  await check(assert.equal, differs(6, 7, 'x', null), true, 'count differs (6 vs 7) -> differs, no baseline needed')
  await check(assert.equal, differs(7, 7, 'x', null), false, 'same count and no baseline -> no verdict of change')
  await check(assert.equal, differs(7, 7, 'x', 'x'), false, 'same count and same baseline -> same')
  await check(assert.equal, differs(7, 7, 'y', 'x'), true, 'same count, baseline signature changed -> differs')
  await check(assert.equal, differs(null, 7, 'y', 'x'), false, 'viewer count unknown -> never a notice')
  await check(assert.equal, differs(1, 0, 'y', 'x'), false, 'an empty inventory is no verdict (Layout hiding the untouched blank deck)')
  await check(assert.equal, differs(6, 0, 'y', null), false, 'an empty inventory is no verdict, whatever the viewer shows')
  await check(assert.equal, differs(Number.NaN, 7, 'y', 'x'), false, 'viewer count NaN -> never a notice')

  const NOW = 1_000_000
  const decide = (pickedAt, status, requestId, now = NOW) => { try { return on.themeAnnounceDecision(pickedAt, now, { status, requestId }) } catch (error) { return `threw: ${error.message}` } }
  await check(assert.equal, decide(null, 'applied', 'r2'), 'wait', 'no pick (connect-time sync, restore, another tab): never announces')
  await check(assert.equal, decide(NOW - 1000, 'applied', 'r2'), 'announce', 'the user picked; Director confirmed it (applied) -> announce')
  await check(assert.equal, decide(NOW - 1000, 'syncing', 'r2'), 'wait', 'still syncing')
  await check(assert.equal, decide(NOW - 1000, 'idle', null), 'wait', 'idle')
  await check(assert.equal, decide(NOW - 1000, 'applied', null), 'wait', 'applied without a request id is not a confirmation')
  await check(assert.equal, decide(NOW - 1000, 'failed', 'r2'), 'drop', 'the request failed: nothing changed, forget the pick')
  await check(assert.equal, decide(NOW - 1000, 'failed', null), 'wait', 'a "pending selection" failure keeps the pick for when it is sent')
  await check(assert.equal, decide(NOW - on.THEME_PICK_ANNOUNCE_WINDOW_MS, 'applied', 'r2'), 'announce', 'still inside the window at its edge')
  await check(assert.equal, decide(NOW - on.THEME_PICK_ANNOUNCE_WINDOW_MS - 1, 'applied', 'r2'), 'drop', 'a pick too old to be the one confirmed is dropped (a later connect-time sync must not announce it)')
  await check(assert.equal, decide(NOW - on.THEME_PICK_ANNOUNCE_WINDOW_MS - 1, 'syncing', 'r2'), 'drop', 'and so is a stale pick that never got confirmed')

  // ---- 4. the controller
  await test('A -> B: one notice, immediately, one inventory read; A never hears itself', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    A.controller.announce('slide')
    assert.equal(hub.posted.length, 1, 'one message posted')
    assert.deepEqual(Object.keys(hub.posted[0].data).sort(), ['change', 'presentationId', 'sentAt', 'sessionId', 'tabId', 'type', 'v'], 'ids and a kind only')
    assert.equal(hub.posted[0].name, `deckster:deck-changed:v1:${SESSION}:${DECK}`)
    assert.equal(B.shown().length, 1, 'B shows a notice at once (no wait for the read)')
    assert.equal(B.current().source, 'broadcast')
    assert.equal(B.current().change, 'slide')
    assert.equal(A.shown().length, 0, 'A gets no self-notice')
    await settle()
    assert.equal(B.reads, 1, 'B read the inventory once')
    assert.equal(A.reads, 0, 'A read nothing')
  })
  await test('the tab-id filter is what keeps a hub that echoes to the sender quiet', async () => {
    const clock = makeClock(), hub = makeHub({ echoToSender: true })
    const A = makeTab(on, hub, clock, 'tab-a')
    A.controller.announce('element')
    await settle()
    assert.equal(A.shown().length, 0)
    assert.equal(A.reads, 0)
  })
  await test('a second message while the notice is up adds no notice and no read', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    A.controller.announce('slide'); await settle()
    clock.advance(400)
    A.controller.announce('element'); await settle()
    assert.equal(B.shown().length, 1)
    assert.equal(B.reads, 1)
  })
  await test('other deck / other session: B hears nothing', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a')
    const otherDeck = on.createDeckChangedController({ sessionId: SESSION, presentationId: 'deck-9', tabId: 'tab-c', createChannel: n => hub.create(n),
      readInventory: async () => assert.fail('no read'), getViewerState: () => ({}), onNotice: n => assert.equal(n, null), doc: makeEvents(), win: makeEvents(), now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    A.controller.announce('slide'); await settle()
    assert.equal(otherDeck.getNotice(), null)
  })
  await test('sends are throttled: the first goes at once, a burst collapses into one trailing send', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    for (let i = 0; i < 5; i++) { A.controller.announce(i === 4 ? 'element' : 'slide'); clock.advance(20) }
    assert.equal(hub.posted.length, 1, 'only the leading send so far')
    clock.advance(500)
    assert.equal(hub.posted.length, 2, 'one trailing send')
    assert.equal(hub.posted[1].data.change, 'element', 'the trailing send carries the latest change')
    await settle()
    assert.equal(B.shown().length, 1)
  })
  await test('no loop: a received message silences this tab\'s own sends for a moment, then it speaks again', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    A.controller.announce('slide'); await settle()
    assert.equal(hub.posted.length, 1)
    clock.advance(100)
    B.controller.announce('slide') // B's viewer reacting to the remote change must not echo it back
    assert.equal(hub.posted.length, 1, 'B did not answer')
    assert.equal(A.shown().length, 0)
    clock.advance(5000)
    B.controller.announce('slide')
    assert.equal(hub.posted.length, 2, 'later, a real edit in B is announced')
    assert.equal(A.shown().length, 1)
  })
  await test('a circuit breaker caps the send rate', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a', { breakerMaxSends: 5, breakerWindowMs: 10_000 })
    for (let i = 0; i < 20; i++) { A.controller.announce('slide'); clock.advance(260) } // 5.2 s: well inside one window
    assert.equal(hub.posted.length, 5, 'exactly the cap inside the window')
    clock.advance(10_000)
    A.controller.announce('slide')
    assert.equal(hub.posted.length, 6, 'and it speaks again once the window has passed')
  })
  await test('Reload deck: the notice goes, a message sent before the reload is ignored, a later one shows again', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    A.controller.announce('slide'); await settle()
    assert.ok(B.current())
    clock.advance(1000)
    B.controller.markReloaded()
    assert.equal(B.current(), null)
    assert.equal(B.notices[B.notices.length - 1], null, 'the page is told the notice is gone')
    // a message that was in flight from before the reload
    B.controller.dispose()
    const B2 = makeTab(on, hub, clock, 'tab-b')
    clock.advance(1)
    B2.controller.markReloaded()
    const stale = { ...good, tabId: 'tab-a', sentAt: clock.now() - 50 }
    hub.channels.filter(c => !c.closed && c.onmessage).forEach(c => c.onmessage({ data: stale }))
    assert.equal(B2.current(), null, 'sent before the reload: already included')
    clock.advance(5000)
    A.controller.announce('slide')
    assert.ok(B2.current(), 'a new change after the reload shows again')
  })
  await test('Dismiss clears the notice; the next change shows a new one with one more read', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    A.controller.announce('slide'); await settle()
    B.controller.dismiss()
    assert.equal(B.current(), null)
    clock.advance(5000)
    A.controller.announce('slide'); await settle()
    assert.ok(B.current())
    assert.equal(B.reads, 2, 'one read per notice')
  })
  await test('visibility: hidden -> nothing; visible + count differs (6 vs 7) -> one read, one notice', async () => {
    const clock = makeClock(), hub = makeHub()
    const B = makeTab(on, hub, clock, 'tab-b')
    B.viewer.slideCount = 6; B.inventory = inventory(['s1', 's2', 's3', 's4', 's5', 's6', 's7'])
    B.doc.visibilityState = 'hidden'
    B.doc.fire('visibilitychange'); await settle()
    assert.equal(B.reads, 0, 'a hidden tab reads nothing')
    B.doc.visibilityState = 'visible'
    B.doc.fire('visibilitychange'); await settle()
    assert.equal(B.reads, 1)
    assert.equal(B.current().source, 'visibility')
    assert.equal(B.current().change, null)
  })
  await test('visibility: same count and no baseline -> one read, no notice; the next focus within the gap reads nothing', async () => {
    const clock = makeClock(), hub = makeHub()
    const B = makeTab(on, hub, clock, 'tab-b')
    B.doc.fire('visibilitychange'); B.win.fire('focus'); await settle()
    assert.equal(B.reads, 1, 'visibilitychange + focus is one read')
    assert.equal(B.current(), null)
    clock.advance(1000)
    B.win.fire('focus'); await settle()
    assert.equal(B.reads, 1, 'throttled')
    clock.advance(6000)
    B.win.fire('focus'); await settle()
    assert.equal(B.reads, 2)
    assert.equal(B.current(), null)
  })
  await test('visibility: with a baseline, a changed signature at the same count shows the notice (another device edited content)', async () => {
    const clock = makeClock(), hub = makeHub()
    const B = makeTab(on, hub, clock, 'tab-b')
    B.win.fire('focus'); await settle()
    assert.equal(B.current(), null)
    B.inventory = inventory(['s1', 's2'], 'v2')
    clock.advance(6000)
    B.win.fire('focus'); await settle()
    assert.equal(B.current()?.source, 'focus')
  })
  await test('visibility: this tab\'s own autosave never reads as another tab (noteOwnEdit resets the baseline)', async () => {
    const clock = makeClock(), hub = makeHub()
    const B = makeTab(on, hub, clock, 'tab-b')
    B.win.fire('focus'); await settle()
    B.inventory = inventory(['s1', 's2'], 'v2') // B's own edit bumped the content versions
    B.controller.noteOwnEdit()
    clock.advance(6000)
    B.win.fire('focus'); await settle()
    assert.equal(B.current(), null, 'no notice')
    B.inventory = inventory(['s1', 's2'], 'v3') // now a different device edits
    clock.advance(6000)
    B.win.fire('focus'); await settle()
    assert.ok(B.current(), 'but a later difference does')
  })
  await test('visibility: right after this tab\'s own change nothing is read', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a')
    A.controller.announce('slide')
    A.viewer.slideCount = 2; A.inventory = inventory(['s1', 's2', 's3'])
    A.win.fire('focus'); await settle()
    assert.equal(A.reads, 0)
    assert.equal(A.current(), null)
    clock.advance(6000)
    A.win.fire('focus'); await settle()
    assert.equal(A.reads, 1, 'after the quiet period it checks again')
  })
  await test('visibility: a notice already up means no read at all', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    A.controller.announce('slide'); await settle()
    assert.equal(B.reads, 1)
    clock.advance(6000)
    B.win.fire('focus'); B.doc.fire('visibilitychange'); await settle()
    assert.equal(B.reads, 1)
  })
  await test('visibility: another presentation on screen / viewer count unknown -> no notice', async () => {
    const clock = makeClock(), hub = makeHub()
    const B = makeTab(on, hub, clock, 'tab-b')
    B.viewer = { presentationId: 'deck-other', slideCount: 1, unsaved: false }; B.inventory = inventory(['s1', 's2', 's3'])
    B.win.fire('focus'); await settle()
    assert.equal(B.current(), null)
    clock.advance(6000)
    B.viewer = { presentationId: DECK, slideCount: null, unsaved: false }
    B.win.fire('focus'); await settle()
    assert.equal(B.current(), null)
  })
  await test('an unavailable / failing / throwing inventory read: no visibility notice; a broadcast notice still shows', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    B.viewer.slideCount = 1
    B.readImpl = () => null
    B.win.fire('focus'); await settle()
    assert.equal(B.current(), null)
    clock.advance(6000)
    B.readImpl = () => { throw new Error('network') }
    B.win.fire('focus'); await settle()
    assert.equal(B.current(), null)
    A.controller.announce('slide'); await settle()
    assert.ok(B.current(), 'a message is proof enough')
  })
  await test('one inventory read per notice even when a visibility read is already in flight (reads are shared)', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    let release
    B.readImpl = () => new Promise(resolve => { release = () => resolve(B.inventory) })
    B.viewer.slideCount = 1
    B.win.fire('focus'); await settle()
    assert.equal(B.reads, 1, 'the focus read is in flight')
    A.controller.announce('slide'); await settle()
    assert.ok(B.current(), 'the message shows the notice at once')
    assert.equal(B.reads, 1, 'and shares that read instead of starting another')
    release(); await settle()
    assert.equal(B.shown().length, 1, 'and the finished focus read adds no second notice')
  })
  await test('visibility: a focus event while the tab is hidden reads nothing', async () => {
    const clock = makeClock(), hub = makeHub()
    const B = makeTab(on, hub, clock, 'tab-b')
    B.viewer.slideCount = 1
    B.doc.visibilityState = 'hidden'
    B.win.fire('focus'); await settle()
    assert.equal(B.reads, 0)
    assert.equal(B.current(), null)
  })
  await test('visibility: this tab\'s own element change does not read as another tab (announce resets the baseline)', async () => {
    const clock = makeClock(), hub = makeHub()
    const B = makeTab(on, hub, clock, 'tab-b')
    B.win.fire('focus'); await settle() // baseline
    B.controller.announce('element') // B inserted an element: its content versions move
    B.inventory = inventory(['s1', 's2'], 'v2')
    clock.advance(6000)
    B.win.fire('focus'); await settle()
    assert.equal(B.current(), null)
  })
  await test('dispose leaves no timer behind', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a')
    A.controller.announce('slide'); A.controller.announce('slide')
    assert.ok(clock.timers.length > 0, 'a trailing send is pending')
    A.controller.dispose()
    assert.equal(clock.timers.length, 0)
  })
  await test('no BroadcastChannel / a throwing one: the visibility path still works, announce is harmless', async () => {
    const clock = makeClock()
    for (const createChannel of [() => null, () => { throw new Error('SecurityError') }]) {
      const tab = makeTab(on, makeHub(), clock, 'tab-x', { createChannel })
      tab.controller.announce('slide')
      clock.advance(6000)
      tab.viewer.slideCount = 1
      tab.win.fire('focus'); await settle()
      assert.ok(tab.current(), 'visibility notice without a channel')
      tab.controller.dispose()
    }
  })
  await test('a throwing postMessage is swallowed', async () => {
    const clock = makeClock()
    const tab = makeTab(on, makeHub(), clock, 'tab-x', { createChannel: () => ({ onmessage: null, postMessage() { throw new Error('DataCloneError') }, close() {} }) })
    tab.controller.announce('slide')
  })
  await test('dispose closes the channel, removes the listeners, stops timers and ignores later messages', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    assert.equal(B.doc.count('visibilitychange'), 1)
    assert.equal(B.win.count('focus'), 1)
    A.controller.announce('slide'); A.controller.announce('slide') // schedules a trailing send
    B.controller.dispose(); A.controller.dispose()
    assert.equal(B.doc.count('visibilitychange'), 0)
    assert.equal(B.win.count('focus'), 0)
    assert.ok(hub.channels.every(c => c.closed), 'channels closed')
    const before = hub.posted.length
    clock.advance(5000)
    assert.equal(hub.posted.length, before, 'the pending trailing send never fires')
    A.controller.announce('slide')
    assert.equal(hub.posted.length, before)
  })
  await test('a superseded second tab still receives (the channel owns no Director socket)', async () => {
    const clock = makeClock(), hub = makeHub()
    const A = makeTab(on, hub, clock, 'tab-a'), B = makeTab(on, hub, clock, 'tab-b')
    A.controller.announce('theme'); await settle()
    assert.equal(B.current()?.change, 'theme')
    const lib = sources[LIB], hook = sources[HOOK]
    assert.doesNotMatch(stripComments(lib + hook), /WebSocket|use-deckster-websocket|wsRef|sendThemeSelection/, 'no WebSocket involvement at all')
  })

  // ---- 5. flag off: the bridge is inert
  await test('flag off: bridge entries do nothing', async () => {
    const seen = []
    off.onDeckChange(c => seen.push(c)); off.onOwnDeckEdit(() => seen.push('edit')); off.onViewerDeckState(() => seen.push('viewer'))
    off.reportDeckChange('slide'); off.reportLayoutCommandAck('addSlide'); off.reportOwnDeckEdit()
    off.reportViewerDeckState({ presentationId: 'p', slideCount: 3, unsaved: true })
    assert.deepEqual(seen, [], 'no listener ran')
    assert.deepEqual(JSON.parse(JSON.stringify(off.getViewerDeckState())), { presentationId: null, slideCount: null, unsaved: false }, 'no viewer state kept')
  })
  await test('flag on: the bridge delivers and survives a throwing listener', async () => {
    const lib = loadLib(sources, { [FLAG]: 'true' })
    const seen = []
    lib.onDeckChange(() => { throw new Error('boom') })
    const off1 = lib.onDeckChange(c => seen.push(c)); lib.onOwnDeckEdit(() => seen.push('edit')); lib.onViewerDeckState(() => seen.push('viewer'))
    lib.reportLayoutCommandAck('addSlide'); lib.reportLayoutCommandAck('goToSlide'); lib.reportLayoutCommandAck('insertChart'); lib.reportDeckChange('theme')
    lib.reportOwnDeckEdit()
    lib.reportViewerDeckState({ presentationId: 'p', slideCount: 3, unsaved: true })
    lib.reportViewerDeckState({ presentationId: 'p', slideCount: 3, unsaved: true }) // unchanged: no second notification
    assert.deepEqual(seen, ['slide', 'element', 'theme', 'edit', 'viewer'])
    assert.deepEqual(JSON.parse(JSON.stringify(lib.getViewerDeckState())), { presentationId: 'p', slideCount: 3, unsaved: true })
    off1(); lib.reportDeckChange('slide')
    assert.equal(seen.length, 5, 'unsubscribed')
    lib.reportViewerDeckState(null)
    assert.equal(lib.getViewerDeckState().slideCount, null)
  })
  await test('the tab id is stable within a page lifetime', async () => {
    assert.equal(on.getDeckChangedTabId(), on.getDeckChangedTabId())
  })

  // ---- 6. the notice component
  await test('the notice component: nothing without a notice; calm copy; reloads nothing by itself', async () => {
    const render = loadComponent(sources)
    let calls = 0
    const props = { onReload: () => { calls++ }, onDismiss: () => { calls++ } }
    assert.equal(render({ ...props, notice: null }), '')
    assert.equal(render({ ...props }), '')
    const html = render({ ...props, notice: { id: 1, source: 'broadcast', change: 'slide' } })
    assert.match(html, /role="status"/)
    assert.match(html, /aria-live="polite"/)
    assert.match(html, /This deck changed in another tab/)
    assert.match(html, /Reload deck/)
    assert.match(html, /data-studio-deck-changed-notice="broadcast"/)
    assert.doesNotMatch(html, /Reload anyway|not saved/, 'the unsaved question appears only after a click')
    assert.equal(calls, 0, 'rendering reloads nothing')
    const src = sources[COMPONENT]
    assert.match(src, /onClick=\{\(\) => \{ if \(needsConfirm\) setConfirming\(true\); else onReload\(\) \}\}/, 'with unsaved edits the first click asks, otherwise it reloads')
    assert.equal((src.match(/onReload\(\)/g) || []).length, 1, 'onReload is called from a click handler only')
    assert.match(src, /onClick=\{onReload\}[^\n]*\n?[^\n]*Reload anyway|Reload anyway/, 'there is an explicit "Reload anyway"')
    assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''), /useEffect\([^)]*onReload|setTimeout|window\.location|location\.reload/, 'no automatic reload')
  })

  // ---- 7. wiring
  const page = sources[PAGE], viewer = sources[VIEWER], lib = sources[LIB], hook = sources[HOOK]
  await check(assert.match, lib, /process\.env\.NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE === 'true'/, 'the flag is read as the literal env name (inlined by the build), exact "true"')
  await check(assert.match, page, /import \{ STUDIO_DECK_CHANGED_NOTICE_ENABLED, reportDeckChange, themeAnnounceDecision \} from '@\/lib\/studio-deck-changed-notice'/, 'the page imports the flag and the report entry')
  await check(assert.match, page, /import \{ useDeckChangedNotice \} from '@\/hooks\/use-deck-changed-notice'/, 'the page imports the hook')
  await check(assert.match, page, /enabled: STUDIO_DECK_CHANGED_NOTICE_ENABLED && studioShell && !studioPartialMetadata && !templateModeOn && !isGeneratingFinal && !isGeneratingStrawman,\s*\n\s*sessionId: currentSessionId \|\| wsSessionId,\s*\n\s*presentationId: effectivePresentationId,\s*\n\s*onReload: reloadDeckFromOtherTab,/, 'the hook is enabled only by the flag, in the Studio shell, outside a build in this tab and template mode, keyed by session + displayed deck')
  await check(assert.match, page, /const reloadDeckFromOtherTab = useCallback\(\(\) => \{\n    const displayed = slideComposerPresentationRef\.current\n    const reloadPresentationId = displayed\.presentationId\n    if \(!reloadPresentationId\) return\n    const override = \{\n      presentationUrl: displayed\.presentationUrl \?\? presentationUrl,\n      presentationId: reloadPresentationId,\n      slideCount: displayed\.slideCount,\n      refreshToken: Math\.max\(Date\.now\(\), displayed\.refreshToken \+ 1\),\n    \}\n    slideComposerPresentationRef\.current = \{ \.\.\.displayed, \.\.\.override \}\n    setSlideComposerOverride\(override\)\n    requestSlideRailRefresh\(reloadPresentationId\)\n  \}, \[presentationUrl\]\)/, 'Reload deck is the existing deck-mutation reload: same override shape, new refresh token, rail inventory re-read')
  await check(assert.match, page, /requestSlideRailRefresh\(plan\.override\.presentationId\)\n        reportDeckChange\('slide'\)/, 'a Director deck_mutation is announced to the other tabs')
  await check(assert.match, page, /useEffect\(\(\) => \{\n    \/\/ [^\n]*\n    if \(!STUDIO_DECK_CHANGED_NOTICE_ENABLED \|\| !themeSelectionChangedLocallyRef\.current\) return\n    themePickedAtRef\.current = Date\.now\(\)\n  \}, \[buildThemeSelection\]\)/, 'the user\'s pick (handleBuildThemeChange raised the local-change flag) is stamped when the selection changes; a restore never is')
  await check(assert.equal, (page.match(/themePickedAtRef\.current = Date\.now\(\)/g) || []).length, 1, 'one place stamps the pick')
  await check(assert.match, page, /useEffect\(\(\) => \{\n    if \(!STUDIO_DECK_CHANGED_NOTICE_ENABLED\) return\n    const decision = themeAnnounceDecision\(themePickedAtRef\.current, Date\.now\(\), themeSync\)\n    if \(decision === 'wait'\) return\n    themePickedAtRef\.current = null\n    if \(decision === 'announce'\) reportDeckChange\('theme'\)\n  \}, \[themeSync\.status, themeSync\.requestId\]\)/, 'the theme is announced once Director confirms it, by the tested rule, flag on only')
  {
    // The user-pick handler is executed in isolation by scripts/test-studio-session-hygiene.mjs: it must stay exactly as it was.
    const at = page.indexOf('const handleBuildThemeChange = useCallback(')
    const handler = page.slice(at, page.indexOf('const handleActiveBuildThemeProfileChange', at))
    await check(assert.ok, at > 0 && handler.length > 300, 'found handleBuildThemeChange')
    await check(assert.doesNotMatch, handler, /themePickedAt|themeAnnounce|reportDeckChange|DECK_CHANGED/, 'handleBuildThemeChange carries nothing of this change')
    await check(assert.match, handler, /themeSelectionChangedLocallyRef\.current = true\n    setBuildThemeSelection\(next\)\n  \}, \[toast, saveSessionOnFirstAction\]\)/, 'and still ends as it did')
  }
  await check(assert.equal, (page.match(/reportDeckChange\('theme'\)/g) || []).length, 1, 'exactly one theme site')
  {
    // The #371 chat harness executes the page\'s onMessage option and pins its sha256: this change must not touch it.
    const at = page.indexOf('    onMessage: (message) => {\n      if (message.type === \'theme_sync\') {')
    const region = page.slice(at, page.indexOf('const isTemplateActionRequest', at))
    await check(assert.ok, at > 0 && region.length > 300, 'found the onMessage option')
    await check(assert.match, region, /if \(next\.status === 'applied'\) \{\n          themeSelectionChangedLocallyRef\.current = false\n        \}\n        if \(next !== current\) commitThemeSync\(next\)/, 'its theme_sync handling is byte-for-byte what it was')
    await check(assert.doesNotMatch, region, /reportDeckChange|DECK_CHANGED/, 'and carries nothing of this change')
  }
  await check(assert.match, page, /\{deckChangedNotice\.notice && <StudioDeckChangedNotice notice=\{deckChangedNotice\.notice\} unsaved=\{deckChangedNotice\.unsaved\}\n\s*onReload=\{deckChangedNotice\.reload\} onDismiss=\{deckChangedNotice\.dismiss\} \/>\}\n\s*\{session\.isLoadingSession \? \(/, 'the notice is the first child of the canvas column, nothing when there is none')
  await check(assert.match, viewer, /settle\(\(\) => \{\n            resolve\(event\.data\)\n          \}\)\n          reportLayoutCommandAck\(action\)[^\n]*\n        \} else \{/, 'sendCommand: the success ack is reported, the failure path is untouched')
  await check(assert.equal, (stripComments(viewer).match(/reportLayoutCommandAck\(/g) || []).length, 2, 'the sendCommand funnel plus the Elementor injection, nothing else')
  await check(assert.match, viewer, /triggerIframeRefresh\(\)\n          reportLayoutCommandAck\(action\)/, 'Elementor injection is reported')
  await check(assert.match, viewer, /if \(event\.data\.type === 'elementDeleted'\) \{\n        if \(studioShell\) viewerInteractionIntentRef\.current \+= 1\n        reportDeckChange\('element'\)/, 'an element deleted in the viewer is reported')
  await check(assert.match, viewer, /nativeSnapshotDirtyRef\.current = true\n          reportOwnDeckEdit\(\)/, 'the viewer\'s own autosave activity is reported (so it never reads as another tab)')
  await check(assert.match, viewer, /reportViewerDeckState\(\{ presentationId: presentationId \?\? null, slideCount: iframeReady && totalSlides > 0 \? totalSlides : null, unsaved: saveStatus !== 'saved' \}\)/, 'the viewer reports the count on screen (null until its iframe is ready) and unsaved edits')
  await check(assert.match, viewer, /  useEffect\(\(\) => \{\n    if \(!STUDIO_DECK_MUTATION_REFRESH_ENABLED \|\| !presentationId\) return\n    return onSlideRailRefreshRequest\(id => \{ if \(id === presentationId\) slideRailRefreshRef\.current\(\) \}\)\n  \}, \[presentationId\]\)\n/, 'the S-03 effect is byte-for-byte what it was (scripts/test-studio-deck-mutation-refresh.mjs pins it)')
  await check(assert.match, viewer, /  useEffect\(\(\) => \{\n    if \(STUDIO_DECK_MUTATION_REFRESH_ENABLED \|\| !STUDIO_DECK_CHANGED_NOTICE_ENABLED \|\| !presentationId\) return\n    return onSlideRailRefreshRequest\(id => \{ if \(id === presentationId\) slideRailRefreshRef\.current\(\) \}\)\n  \}, \[presentationId\]\)\n/, 'Reload deck\'s rail re-read is heard through its own effect (only with the notice flag on and S-03 off, so never twice)')
  await check(assert.doesNotMatch, sources['hooks/use-deckster-websocket-v2.ts'], /deck-changed|DECK_CHANGED/, 'no WebSocket hook change')
  await check(assert.match, hook, /fetchSlideInventory\(\{\s*baseUrl: getLayoutServiceUrl\(\),\s*presentationId,/, 'the inventory is read through the existing fetchSlideInventory')
  await check(assert.doesNotMatch, stripComments(lib + hook + sources[COMPONENT]), /\/api\/|https?:\/\/|new WebSocket/, 'no endpoint, URL or socket of its own')
  await check(assert.match, hook, /typeof BroadcastChannel === 'function'/, 'BroadcastChannel is feature-detected')
  await check(assert.match, hook, /enabled && Boolean\(sessionId\) && Boolean\(presentationId\)/, 'disabled (no channel, no listener, no request) without the flag / a session / a deck')
  await check(assert.match, sources['.env.example'], /^NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE="false"$/m, '.env.example documents the flag, default "false"')
  await check(assert.equal, JSON.parse(sources['package.json']).scripts['test:studio-deck-changed-notice'], 'node scripts/test-studio-deck-changed-notice.mjs', 'package.json runs this suite')
  return { checks, failures }
}

// ---------------------------------------------------------------- run, then mutants
const result = await run(SRC)
if (result.failures.length) {
  console.error(`FAIL studio deck-changed notice: ${result.failures.length} of ${result.checks} checks failed\n  - ${result.failures.join('\n  - ')}`)
  process.exit(1)
}

const MUTANTS = [
  // module: table, wire, comparison
  ['lib: addSlide no longer announced', LIB, "'addSlide', 'duplicateSlide'", "'duplicateSlide'"],
  ['lib: navigation announced', LIB, "'composeSlideReconcile', 'refineSlideReconcile',\n])", "'composeSlideReconcile', 'refineSlideReconcile', 'goToSlide',\n])"],
  ['lib: element delete not announced', LIB, "'deleteElement', 'deleteTextBox',", ''],
  ['lib: flag read loosely', LIB, "process.env.NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE === 'true'", 'Boolean(process.env.NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE)'],
  ['lib: own-tab messages accepted', LIB, 'm.tabId === expected.tabId) return null', 'false) return null'],
  ['lib: any session accepted', LIB, 'if (m.sessionId !== expected.sessionId || m.presentationId !== expected.presentationId) return null', 'if (m.presentationId !== expected.presentationId) return null'],
  ['lib: any deck accepted', LIB, 'if (m.sessionId !== expected.sessionId || m.presentationId !== expected.presentationId) return null', 'if (m.sessionId !== expected.sessionId) return null'],
  ['lib: unknown change kinds accepted', LIB, "|| !CHANGES.has(m.change)) return null", ') return null'],
  ['lib: extra message fields survive', LIB, "return {\n    v: DECK_CHANGED_MESSAGE_VERSION, type: 'deck-changed', tabId: m.tabId,", 'return { ...m,\n    v: DECK_CHANGED_MESSAGE_VERSION, type: \'deck-changed\', tabId: m.tabId,'],
  ['lib: signature ignores content versions', LIB, '${s.slideId}:${s.layout ?? \'\'}:${s.contentVersion ?? \'\'}', '${s.slideId}:${s.layout ?? \'\'}'],
  ['lib: signature differs ignored', LIB, 'return input.knownSignature !== null && input.knownSignature !== input.readSignature', 'return false'],
  ['lib: unknown viewer count counts as different', LIB, 'if (input.viewerSlideCount === null || !Number.isFinite(input.viewerSlideCount)) return false', 'if (input.viewerSlideCount === null) return true'],
  // controller
  ['lib: no send throttle', LIB, 'const wait = Math.max(0, lastSentAt + sendThrottleMs - t)', 'const wait = 0'],
  ['lib: no trailing send', LIB, 'else sendTimer = setTimer(flushSend, wait)', ''],
  ['lib: no echo guard on received messages', LIB, '    echoQuietUntil = now() + echoQuietMs\n    if (notice) return', '    if (notice) return'],
  ['lib: no echo guard in announce', LIB, '      if (t < echoQuietUntil) return\n      queuedChange = change', '      queuedChange = change'],
  ['lib: no circuit breaker', LIB, 'if (recentSends.length >= breakerMaxSends) { queuedChange = null; return }', ''],
  ['lib: a second message while the notice is up re-notifies and re-reads', LIB, '    if (notice) return // one notice, one read: a second message while it is up adds nothing\n', ''],
  ['lib: a received message reads no inventory', LIB, "    show('broadcast', message.change)\n    void readOnce()", "    show('broadcast', message.change)"],
  ['lib: the notice waits for the read', LIB, "    show('broadcast', message.change)\n    void readOnce()", "    void readOnce().then(() => show('broadcast', message.change))"],
  ['lib: reads are not shared', LIB, '    if (reading) return reading\n', ''],
  ['lib: messages from before the reload still notify', LIB, 'if (message.sentAt < reloadedAt) return', ''],
  ['lib: reload keeps the notice', LIB, '      if (notice) { notice = null; deps.onNotice(null) }\n    },\n    dismiss()', '    },\n    dismiss()'],
  ['lib: hidden tabs read', LIB, "      if (deps.doc && deps.doc.visibilityState && deps.doc.visibilityState !== 'visible') return\n      const t = now()", '      const t = now()'],
  ['lib: no visibility throttle', LIB, 'nextCheckAt = t + checkMinGapMs\n      checking = true', 'checking = true'],
  ['lib: own change does not quiet the check', LIB, 'if (t < nextCheckAt || t < ownChangeQuietUntil) return', 'if (t < nextCheckAt) return'],
  ['lib: own edit keeps the baseline', LIB, '      ownChangeQuietUntil = now() + ownChangeQuietMs\n      knownSignature = null\n    },\n    async check', '      ownChangeQuietUntil = now() + ownChangeQuietMs\n    },\n    async check'],
  ['lib: own change keeps the baseline', LIB, '      ownChangeQuietUntil = t + ownChangeQuietMs\n      knownSignature = null\n', '      ownChangeQuietUntil = t + ownChangeQuietMs\n'],
  ['lib: a notice up still reads', LIB, 'if (disposed || notice || checking) return\n      if (deps.doc', 'if (disposed || checking) return\n      if (deps.doc'],
  ['lib: a visibility notice for another deck', LIB, '        if (viewer.presentationId !== deps.presentationId) return\n', ''],
  ['lib: dispose leaves the channel open', LIB, '        try { channel.close() } catch { /* a closed channel is fine */ }\n', ''],
  ['lib: dispose leaves the listeners', LIB, "      if (deps.win) deps.win.removeEventListener('focus', onFocus)\n      notice = null", '      notice = null'],
  ['lib: dispose leaves the pending send', LIB, '      if (sendTimer !== null) { clearTimer(sendTimer); sendTimer = null }\n      queuedChange = null\n', ''],
  ['lib: a throwing channel factory escapes', LIB, 'try { channel = deps.createChannel(channelName) } catch { channel = null }', 'channel = deps.createChannel(channelName)'],
  ['lib: a throwing post escapes', LIB, 'try { channel.postMessage(message) } catch { return }', 'channel.postMessage(message)'],
  ['lib: bridge runs with the flag off', LIB, "export function reportDeckChange(change: DeckChangeKind): void {\n  if (!STUDIO_DECK_CHANGED_NOTICE_ENABLED) return\n", 'export function reportDeckChange(change: DeckChangeKind): void {\n'],
  ['lib: viewer state kept with the flag off', LIB, "export function reportViewerDeckState(state: DeckChangedViewerState | null): void {\n  if (!STUDIO_DECK_CHANGED_NOTICE_ENABLED) return\n", 'export function reportViewerDeckState(state: DeckChangedViewerState | null): void {\n'],
  ['lib: ack bridge ignores the table', LIB, '  if (change) reportDeckChange(change)\n}', '  reportDeckChange(change ?? \'slide\')\n}'],
  // component
  ['component: reloads without asking', COMPONENT, 'if (needsConfirm) setConfirming(true); else onReload()', 'onReload()'],
  ['component: reloads by itself', COMPONENT, '  useEffect(() => { setConfirming(false) }, [noticeId])', '  useEffect(() => { setConfirming(false); onReload() }, [noticeId])'],
  ['component: changed copy', COMPONENT, '<span data-studio-deck-changed-part="text">This deck changed in another tab</span>', '<span data-studio-deck-changed-part="text">The deck was modified elsewhere</span>'],
  // page
  ['page: Reload deck no longer bumps the refresh token', PAGE, 'refreshToken: Math.max(Date.now(), displayed.refreshToken + 1),\n    }\n    slideComposerPresentationRef.current = { ...displayed, ...override }\n    setSlideComposerOverride(override)\n    requestSlideRailRefresh(reloadPresentationId)', 'refreshToken: displayed.refreshToken,\n    }\n    slideComposerPresentationRef.current = { ...displayed, ...override }\n    setSlideComposerOverride(override)\n    requestSlideRailRefresh(reloadPresentationId)'],
  ['page: Reload deck forgets the rail re-read', PAGE, '    setSlideComposerOverride(override)\n    requestSlideRailRefresh(reloadPresentationId)\n  }, [presentationUrl])', '    setSlideComposerOverride(override)\n  }, [presentationUrl])'],
  ['page: hook enabled without the flag', PAGE, 'enabled: STUDIO_DECK_CHANGED_NOTICE_ENABLED && studioShell', 'enabled: studioShell'],
  ['page: the theme announce is not flag-gated', PAGE, "    if (!STUDIO_DECK_CHANGED_NOTICE_ENABLED) return\n    const decision = themeAnnounceDecision(", "    const decision = themeAnnounceDecision("],
  ['page: a theme pick is never stamped', PAGE, "    themePickedAtRef.current = Date.now()\n", ''],
  ['page: every selection change counts as a pick (a restore too)', PAGE, "    if (!STUDIO_DECK_CHANGED_NOTICE_ENABLED || !themeSelectionChangedLocallyRef.current) return\n    themePickedAtRef.current = Date.now()", "    if (!STUDIO_DECK_CHANGED_NOTICE_ENABLED) return\n    themePickedAtRef.current = Date.now()"],
  ['page: theme announced on every apply (the connect-time sync too)', PAGE, "if (decision === 'announce') reportDeckChange('theme')", "if (themeSync.status === 'applied') reportDeckChange('theme')"],
  ['page: theme pick kept after it was announced', PAGE, "    themePickedAtRef.current = null\n    if (decision === 'announce')", "    if (decision === 'announce')"],
  ['page: the pick moved into handleBuildThemeChange (session-hygiene executes it)', PAGE, "    themeSelectionChangedLocallyRef.current = true\n    setBuildThemeSelection(next)", "    themeSelectionChangedLocallyRef.current = true\n    themePickedAtRef.current = Date.now()\n    setBuildThemeSelection(next)"],
  ['page: the onMessage region carries the theme announce', PAGE, "        if (next.status === 'applied') {\n          themeSelectionChangedLocallyRef.current = false\n        }", "        if (next.status === 'applied') {\n          reportDeckChange('theme')\n          themeSelectionChangedLocallyRef.current = false\n        }"],
  ['page: a build in this tab still notifies', PAGE, " && !isGeneratingFinal && !isGeneratingStrawman,\n    sessionId:", ",\n    sessionId:"],
  ['lib: the pick never expires', LIB, "  if (now - pickedAt > THEME_PICK_ANNOUNCE_WINDOW_MS) return 'drop'\n", ''],
  ['lib: a failed sync still announces', LIB, "  if (sync.status === 'failed') return 'drop'\n", "  if (sync.status === 'failed') return 'announce'\n"],
  ['lib: no pick still announces', LIB, "  if (pickedAt === null) return 'wait'\n", ''],
  ['lib: a request-less applied announces', LIB, "  if (sync.requestId === null) return 'wait'\n", ''],
  ['lib: an empty inventory counts as a change', LIB, "  if (input.readCount <= 0) return false\n", ''],
  ['page: deck_mutation not announced', PAGE, "        reportDeckChange('slide') // NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE: other tabs on this deck are told (no-op with the flag off)\n", ''],
  ['page: notice not rendered', PAGE, '{deckChangedNotice.notice && <StudioDeckChangedNotice', '{false && <StudioDeckChangedNotice'],
  ['page: notice shown even when there is none', PAGE, '{deckChangedNotice.notice && <StudioDeckChangedNotice notice={deckChangedNotice.notice}', '{<StudioDeckChangedNotice notice={deckChangedNotice.notice}'],
  // viewer
  ['viewer: the ack funnel is gone', VIEWER, '          reportLayoutCommandAck(action) // NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE: other tabs hear about deck-changing acks (no-op with the flag off)\n', ''],
  ['viewer: failures are announced too', VIEWER, "          settle(() => {\n            reject(new Error(event.data.error || 'Command failed'))\n          })", "          reportLayoutCommandAck(action)\n          settle(() => {\n            reject(new Error(event.data.error || 'Command failed'))\n          })"],
  ['viewer: own autosave not reported', VIEWER, '          reportOwnDeckEdit() // NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE: this tab\'s own autosave is not "another tab" (no-op with the flag off)\n', ''],
  ['viewer: count reported before the iframe is ready', VIEWER, 'slideCount: iframeReady && totalSlides > 0 ? totalSlides : null', 'slideCount: totalSlides'],
  ['viewer: the S-03 effect is edited', VIEWER, "    if (!STUDIO_DECK_MUTATION_REFRESH_ENABLED || !presentationId) return\n    return onSlideRailRefreshRequest", "    if (!(STUDIO_DECK_MUTATION_REFRESH_ENABLED || STUDIO_DECK_CHANGED_NOTICE_ENABLED) || !presentationId) return\n    return onSlideRailRefreshRequest"],
  ['viewer: rail re-read not heard for the notice', VIEWER, "    if (STUDIO_DECK_MUTATION_REFRESH_ENABLED || !STUDIO_DECK_CHANGED_NOTICE_ENABLED || !presentationId) return\n", "    if (STUDIO_DECK_MUTATION_REFRESH_ENABLED || !presentationId) return\n"],
  ['viewer: the notice\'s rail listener also runs with S-03 on (heard twice)', VIEWER, "    if (STUDIO_DECK_MUTATION_REFRESH_ENABLED || !STUDIO_DECK_CHANGED_NOTICE_ENABLED || !presentationId) return\n", "    if (!STUDIO_DECK_CHANGED_NOTICE_ENABLED || !presentationId) return\n"],
]
let caught = 0
const survivors = []
for (const [name, rel, from, to] of MUTANTS) {
  assert.ok(SRC[rel].includes(from), `mutant "${name}": anchor not found in ${rel}`)
  const mutated = await run({ ...SRC, [rel]: SRC[rel].replace(from, to) })
  if (mutated.failures.length) caught++
  else survivors.push(name)
}
if (survivors.length) {
  console.error(`FAIL studio deck-changed notice: ${survivors.length} mutant(s) survived\n  - ${survivors.join('\n  - ')}`)
  process.exit(1)
}
console.log(`studio deck-changed notice: ${result.checks} checks passed; ${caught}/${MUTANTS.length} mutants caught`)
