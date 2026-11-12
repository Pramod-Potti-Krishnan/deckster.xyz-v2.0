// J3-BLANK-START-SESSION (ELEMENT-2): NEXT_PUBLIC_STUDIO_BLANK_START_NEW_SESSION (exact "true", Studio shell only), default off.
// After "Deckster was updated · Reload now", Studio showed the brief page for an existing blank-canvas deck (deck A, with a table), and
// "Start on a blank canvas" reopened deck A, so the next Add Element landed on it (J3 RUN.md R13-2, shot 48). Cause and fix:
// lib/studio-blank-start-new-session.ts.
//
// Proves, offline (no socket, fetch, timer or network; the #371 harness pattern: REAL page code extracted by AST, run in mini-react):
//   1. the J3 R13-2 sequence through the REAL page pieces (the per-session dismissal reset effect, handleDismissBlankPlaceholder, the
//      useStudioBlankStart call and the <MessageList studioFirstRunActions> expression, all extracted from app/builder/page.tsx), the
//      REAL hook, lib, canvas lifecycle and StudioFirstRunActions button (clicked):
//        base tree / flag off: after the reload the landing (brief page) shows over deck A, the click reveals deck A, Metrics lands on it;
//        flag on: the reload opens on deck A (no brief page), the click opens a NEW session, its blank canvas starts when its deck
//        arrives, and Metrics lands on the new deck (deck A keeps only its table);
//   2. what must not change with the flag on: a just-started (unsaved) canvas clicked again, a theme pick before the first click, a
//      switch to another saved session (no memory leaks to it), a pending start dropped when the user opens another session;
//   3. flag off is identical to the base tree: every scenario's full trace (state per checkpoint, page calls, storage) hash-equals the
//      base tree's (BLANK_START_BASE_ROOT=<pristine base checkout>), and flag off never touches storage;
//   4. the lib (memory bound, storage failures, decisions, the pending-start steps);
//   5. the page wiring: one hook call right after the dismiss handler, the first-run row gets the old handler when the flag is off, the
//      flag read as a literal, the update-reload guard and the Text Labs hook untouched, .env.example and package.json;
//   6. mutants of the lib, the hook and the page must each be caught.
//
//   node scripts/test-studio-blank-start-new-session.mjs
//   BLANK_START_BASE_ROOT=../base node scripts/test-studio-blank-start-new-session.mjs     (also runs section 1/3 on the base tree)
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'
import { Root, hostNodes } from './studio-chat-harness/mini-react.mjs'
import { compile, findCalls, findVariableInitializer, jsxAttributes } from './studio-chat-harness/page-extract.mjs'
import { createStorage } from './studio-chat-harness/fake-env.mjs'
import { lucideStub } from './studio-chat-harness/esm-packages.mjs'

const branchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseRoot = process.env.BLANK_START_BASE_ROOT ? path.resolve(process.env.BLANK_START_BASE_ROOT) : null
const FLAG = 'NEXT_PUBLIC_STUDIO_BLANK_START_NEW_SESSION'
const PAGE = 'app/builder/page.tsx'
const LIB = 'lib/studio-blank-start-new-session.ts'
const HOOK = 'hooks/use-studio-blank-start.ts'
const readFrom = (treeRoot, rel) => fs.readFileSync(path.join(treeRoot, rel), 'utf8')
const read = rel => readFrom(branchRoot, rel)
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16)
const refuse = name => () => { throw new Error(`blank-start fixture refuses ${name}`) }

// ---- module loader: the repo's own modules, transpiled, in a vm with fake browser globals -----------------------------------------
const stubs = {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'lucide-react': lucideStub(React),
  'next/link': { __esModule: true, default: ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children) },
  '@/components/builder/studio-introduction': { StudioIntroductionButton: () => React.createElement('button', { 'data-fixture-intro': 'true' }) },
}
function createLoader(treeRoot, env, storage, overrides = {}, extraGlobals = {}) {
  const cache = new Map()
  const globals = { process: { env }, window: { localStorage: storage }, console, fetch: refuse('fetch'), setTimeout: refuse('timers'), setInterval: refuse('timers'), ...extraGlobals }
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(treeRoot, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const suffix of ['.ts', '.tsx']) if (overrides[path.relative(treeRoot, base + suffix)] !== undefined || fs.existsSync(base + suffix)) return base + suffix
    throw new Error(`unresolved import ${spec} in ${path.relative(treeRoot, from)}`)
  }
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const rel = path.relative(treeRoot, file)
    const text = overrides[rel] ?? fs.readFileSync(file, 'utf8')
    const out = ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const mod = { exports: {} }
    cache.set(file, mod)
    const req = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, file))
      throw new Error(`unexpected import ${spec} in ${rel}`)
    }
    vm.runInNewContext(out, { module: mod, exports: mod.exports, require: req, ...globals })
    return mod.exports
  }
  return rel => load(path.join(treeRoot, rel))
}

// ---- the REAL page pieces, extracted by AST -------------------------------------------------------------------------------------
function extractPage(text) {
  const source = ts.createSourceFile(PAGE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const resets = findCalls(source, 'useEffect').filter(call => /^\(\) => \{\s*setBlankPlaceholderDismissed\(false\)\s*\}$/.test(call.arguments[0].getText(source)))
  assert.equal(resets.length, 1, 'one per-session reset of the dismissal')
  let startCall = null
  try { startCall = findVariableInitializer(source, 'handleStartOnBlankCanvas') } catch { /* the base page has none */ }
  return {
    reset: compile(resets[0], source, 'blankPlaceholderDismissed reset effect'),
    dismiss: compile(findVariableInitializer(source, 'handleDismissBlankPlaceholder'), source, 'handleDismissBlankPlaceholder'),
    start: startCall ? compile(startCall, source, 'useStudioBlankStart call') : null,
    firstRun: compile(jsxAttributes(source, 'MessageList').studioFirstRunActions.node, source, '<MessageList studioFirstRunActions>'),
  }
}

// ---- the world: sessions, decks, the session row, the Director's blank deck ---------------------------------------------------
function createWorld() {
  return { decks: new Map(), saved: new Set(), log: [], nextSession: 2, nextDeck: 1 }
}
function deliverBlankDeck(world, sessionId) {
  const id = `synthetic-deck-${world.nextDeck++}`
  world.decks.set(sessionId, { presentationId: id, presentationUrl: `https://layout.synthetic.invalid/p/${id}`, elements: [] })
  return id
}

// One mounted Builder tab. `classify` is the REAL canvas lifecycle; the page's own selection plumbing is out of scope: a deck is
// owned by the session Director made it for, exactly as the restored row / presentation_init make it.
function mountTab({ world, treeRoot, env, storage, overrides = {}, sessionId }) {
  const load = createLoader(treeRoot, env, storage, overrides)
  const page = extractPage(overrides[PAGE] ?? readFrom(treeRoot, PAGE))
  const { classifyStudioCanvasLifecycle } = load('lib/studio-canvas-lifecycle.ts')
  const { StudioFirstRunActions } = load('components/builder/studio-first-run-actions.tsx')
  const blankStartLib = page.start ? load(LIB) : {}
  const blankStartHook = page.start ? load(HOOK) : {}
  const ui = { snapshot: null, actions: null, sessionId }
  const studioShell = env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

  function Page() {
    const [currentSessionId, setCurrentSessionId] = React.useState(ui.sessionId)
    const [blankPlaceholderDismissed, setBlankPlaceholderDismissed] = React.useState(false)
    page.reset({ useEffect: React.useEffect, setBlankPlaceholderDismissed, currentSessionId })
    const deck = world.decks.get(currentSessionId) ?? null
    const isUnsavedSession = !world.saved.has(currentSessionId)
    const studioCanvasLifecycle = classifyStudioCanvasLifecycle({
      displayedSessionId: currentSessionId, deckOwnerSessionId: deck ? currentSessionId : null,
      selected: { presentationId: deck?.presentationId ?? null, presentationUrl: deck?.presentationUrl ?? null, activeVersion: deck?.generated ? 'final' : 'blank', slideCount: deck ? 1 : null },
      finalPresentationId: deck?.generated ? deck.presentationId : null, finalPresentationUrl: deck?.generated ? deck.presentationUrl : null,
      // A blank-canvas deck has no Director slide structure: elements added by hand are not "authored structure".
      hasAuthoredStructure: false, loading: false, generating: false, phase: 'idle', dismissed: blankPlaceholderDismissed,
      connected: true, connecting: false,
    })
    const studioSlideComposeOwnerRef = React.useRef({ key: null })
    const ownerKey = JSON.stringify([currentSessionId, deck?.presentationId ?? null])
    if (studioSlideComposeOwnerRef.current.key !== ownerKey) studioSlideComposeOwnerRef.current = { key: ownerKey }
    const studioInitialSelectedTarget = { owner: studioSlideComposeOwnerRef.current }
    const studioExplicitBlankOwnerRef = React.useRef(null)
    const handleDismissBlankPlaceholder = page.dismiss({ studioShell, studioSlideComposeOwnerRef, studioInitialSelectedTarget, studioExplicitBlankOwnerRef, setBlankPlaceholderDismissed })
    // The Builder's New flow, as far as this proof needs it: a new local id, unsaved, no deck yet (Director makes one).
    const handleNewChatWrappedRef = { current: () => { const id = `synthetic-session-${world.nextSession++}`; world.log.push(['newSession', currentSessionId, id]); setCurrentSessionId(id) } }
    const handleStartOnBlankCanvas = page.start ? page.start({
      useStudioBlankStart: blankStartHook.useStudioBlankStart, STUDIO_BLANK_START_NEW_SESSION_ENABLED: blankStartLib.STUDIO_BLANK_START_NEW_SESSION_ENABLED,
      studioShell, builderCacheOwner: 'synthetic-user', currentSessionId, isUnsavedSession, blankPlaceholderDismissed, setBlankPlaceholderDismissed,
      studioCanvasLifecycle, handleDismissBlankPlaceholder, handleNewChatWrappedRef,
    }) : undefined
    const actions = page.firstRun({
      React, process: { env }, studioShell, StudioFirstRunActions, effectivePresentationUrl: deck?.presentationUrl ?? null,
      handleDismissBlankPlaceholder, handleStartOnBlankCanvas, STUDIO_BLANK_START_NEW_SESSION_ENABLED: blankStartLib.STUDIO_BLANK_START_NEW_SESSION_ENABLED,
    })
    ui.snapshot = {
      session: currentSessionId, deck: deck?.presentationId ?? null, saved: !isUnsavedSession, dismissed: blankPlaceholderDismissed,
      // The brief page: the landing layout over this session (studioWelcome = studioShell && showLanding).
      briefPage: studioCanvasLifecycle.showLanding, startOffered: Boolean(actions),
      explicitBlankOwnerIsSelected: studioExplicitBlankOwnerRef.current === studioInitialSelectedTarget.owner,
    }
    ui.go = setCurrentSessionId
    return actions ?? null
  }

  const root = new Root()
  let revision = 0
  const render = () => { root.setElement(React.createElement(Page, { revision: ++revision })); root.flush() }
  render()
  const blankButton = () => hostNodes(root.tree).find(node => node.type === 'button' && node.props['data-studio-first-run-blank'] === 'true')
  return {
    render,
    get state() { return ui.snapshot },
    clickStartBlank() { const button = blankButton(); assert.ok(button, 'the first-run row offers "Start on a blank canvas"'); button.props.onClick(); root.flush(); render() },
    openSession(id) { ui.go(id); root.flush(); render() },
    unmount() { root.unmount() },
  }
}

// ---- user actions on the world (what the page does for them that matters here) ------------------------------------------------
function addElement(world, tab, kind) {
  assert.equal(tab.state.briefPage, false, `${kind}: Add Element is used on the canvas, not on the brief page`)
  const deck = world.decks.get(tab.state.session)
  deck.elements.push(kind)
  world.saved.add(tab.state.session) // NEXT_PUBLIC_STUDIO_SESSION_HYGIENE: the first element saves the row
  world.log.push(['addElement', kind, tab.state.session, deck.presentationId])
  tab.render()
  return deck.presentationId
}
function pickTheme(world, tab) {
  world.saved.add(tab.state.session) // a theme pick is a first action too
  world.log.push(['pickTheme', tab.state.session])
  tab.render()
}

// ---- scenarios ----------------------------------------------------------------------------------------------------------------
const SHELL_ENV = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_FIRST_RUN_V2: 'true' }
const SCENARIOS = {
  // J3 R13-2: deck A (blank canvas + a table) -> "Reload now" -> brief page -> "Start on a blank canvas" -> Metrics.
  'j3-r13-reload-then-start-blank'(ctx) {
    const { world, mount, checkpoint } = ctx
    let tab = mount('synthetic-session-1')
    deliverBlankDeck(world, 'synthetic-session-1')
    tab.render(); checkpoint('fresh session, Director blank deck', tab)
    tab.clickStartBlank(); checkpoint('started on the blank canvas', tab)
    const tableDeck = addElement(world, tab, 'table'); checkpoint('table added (deck A)', tab)
    tab.unmount()
    tab = mount('synthetic-session-1') // window.location.reload(): same URL, ?session_id= kept; the row restores deck A
    checkpoint('after Reload now', tab)
    tab.clickStartBlank(); checkpoint('clicked Start on a blank canvas', tab)
    if (tab.state.session !== 'synthetic-session-1' && !tab.state.deck) { deliverBlankDeck(world, tab.state.session); tab.render(); checkpoint('Director blank deck for the new session', tab) }
    const metricsDeck = addElement(world, tab, 'metrics'); checkpoint('metrics added', tab)
    ctx.result = { tableDeck, metricsDeck, deckAElements: [...world.decks.get('synthetic-session-1').elements] }
  },
  // A just-started canvas (no action yet, unsaved): a second click is the old dismiss, never a new session.
  'fresh-canvas-clicked-twice'(ctx) {
    const { world, mount, checkpoint } = ctx
    const tab = mount('synthetic-session-1')
    deliverBlankDeck(world, 'synthetic-session-1'); tab.render()
    tab.clickStartBlank(); checkpoint('first click', tab)
    tab.clickStartBlank(); checkpoint('second click', tab)
  },
  // A theme picked on the landing saves the row first: the first click still starts THIS session's canvas.
  'theme-pick-then-start'(ctx) {
    const { world, mount, checkpoint } = ctx
    const tab = mount('synthetic-session-1')
    deliverBlankDeck(world, 'synthetic-session-1'); tab.render()
    pickTheme(world, tab); checkpoint('theme picked', tab)
    tab.clickStartBlank(); checkpoint('clicked Start on a blank canvas', tab)
  },
  // Moving from a started deck to another saved session: no memory leaks to it, its landing shows, its click is the old dismiss.
  'switch-to-another-saved-session'(ctx) {
    const { world, mount, checkpoint } = ctx
    deliverBlankDeck(world, 'synthetic-session-9'); world.saved.add('synthetic-session-9')
    const tab = mount('synthetic-session-1')
    deliverBlankDeck(world, 'synthetic-session-1'); tab.render()
    tab.clickStartBlank(); addElement(world, tab, 'table'); checkpoint('deck A with a table', tab)
    tab.openSession('synthetic-session-9'); checkpoint('opened another saved session', tab)
    tab.clickStartBlank(); checkpoint('clicked Start on a blank canvas there', tab)
  },
  // Hygiene on: the button saves no row, so after Reload the started session is still UNSAVED (per-tab marker). The canvas is restored
  // and a second click there is the old dismiss (no new session), exactly as today.
  'unsaved-start-reload-start-again'(ctx) {
    const { world, mount, checkpoint } = ctx
    let tab = mount('synthetic-session-1')
    deliverBlankDeck(world, 'synthetic-session-1'); tab.render()
    tab.clickStartBlank(); checkpoint('started, unsaved', tab)
    tab.unmount(); tab = mount('synthetic-session-1')
    checkpoint('after Reload now (still unsaved)', tab)
    tab.clickStartBlank(); checkpoint('second click', tab)
  },
  // A started canvas that becomes a real deck (Director built it) no longer needs its memory.
  'started-then-real-deck'(ctx) {
    const { world, mount, checkpoint } = ctx
    const tab = mount('synthetic-session-1')
    deliverBlankDeck(world, 'synthetic-session-1'); tab.render()
    tab.clickStartBlank(); addElement(world, tab, 'table'); checkpoint('started deck', tab)
    world.decks.get('synthetic-session-1').generated = true; tab.render(); checkpoint('generated deck', tab)
  },
  // A pending start belongs to the new session only: opening another session before its deck arrives drops it.
  'pending-start-dropped-on-switch'(ctx) {
    const { world, mount, checkpoint } = ctx
    deliverBlankDeck(world, 'synthetic-session-9'); world.saved.add('synthetic-session-9')
    let tab = mount('synthetic-session-1')
    deliverBlankDeck(world, 'synthetic-session-1'); tab.render()
    tab.clickStartBlank(); addElement(world, tab, 'table')
    tab.unmount(); tab = mount('synthetic-session-1')
    tab.clickStartBlank(); checkpoint('clicked Start on a blank canvas', tab)
    tab.openSession('synthetic-session-9'); checkpoint('opened another session before the new deck arrived', tab)
    tab.openSession('synthetic-session-2'); deliverBlankDeck(world, 'synthetic-session-2'); tab.render()
    checkpoint('back on the new session when its deck arrives', tab)
  },
}

function runScenario(name, { treeRoot, env, overrides = {}, storage = createStorage() }) {
  // The vm refuses fetch, timers and sockets: any request from the page pieces, the hook or the lib would throw and fail the scenario.
  const world = createWorld()
  const checkpoints = []
  const ctx = {
    world,
    mount: sessionId => mountTab({ world, treeRoot, env, storage, overrides, sessionId }),
    checkpoint: (label, tab) => checkpoints.push({ label, ...tab.state }),
    result: null,
  }
  SCENARIOS[name](ctx)
  return { checkpoints, log: world.log, result: ctx.result, storage: storage.dump() }
}
const at = (trace, label) => { const found = trace.checkpoints.find(item => item.label === label); assert.ok(found, `checkpoint ${label}`); return found }

// What the fixed Builder must do in the J3 R13-2 sequence (fails on the base tree and with the flag off).
function expectFixed(trace) {
  const reload = at(trace, 'after Reload now')
  assert.equal(reload.session, 'synthetic-session-1', 'Reload now keeps the session')
  assert.equal(reload.briefPage, false, 'no brief page over the existing deck after Reload now')
  assert.equal(reload.deck, trace.result.tableDeck, 'the reload is on deck A')
  const clicked = at(trace, 'clicked Start on a blank canvas')
  assert.notEqual(clicked.session, 'synthetic-session-1', '"Start on a blank canvas" opened a NEW session')
  assert.deepEqual(trace.log.filter(entry => entry[0] === 'newSession'), [['newSession', 'synthetic-session-1', 'synthetic-session-2']], 'exactly one New, from deck A')
  const arrived = at(trace, 'Director blank deck for the new session')
  assert.equal(arrived.briefPage, false, 'the new session opens on its blank canvas once its deck arrives (the click was "Start on a blank canvas")')
  assert.equal(arrived.dismissed, true)
  assert.equal(arrived.explicitBlankOwnerIsSelected, true, 'started with the page dismiss handler, on the new deck')
  assert.notEqual(trace.result.metricsDeck, trace.result.tableDeck, 'Metrics lands on the new deck')
  assert.deepEqual(trace.result.deckAElements, ['table'], 'deck A keeps only its table')
}
// What the base tree does (the bug, reproduced).
function expectBug(trace) {
  const reload = at(trace, 'after Reload now')
  assert.equal(reload.session, 'synthetic-session-1')
  assert.equal(reload.briefPage, true, 'base: the brief page shows over deck A after Reload now')
  const clicked = at(trace, 'clicked Start on a blank canvas')
  assert.equal(clicked.session, 'synthetic-session-1', 'base: the click keeps deck A\'s session')
  assert.equal(clicked.briefPage, false)
  assert.equal(trace.result.metricsDeck, trace.result.tableDeck, 'base: Metrics lands on deck A')
  assert.deepEqual(trace.result.deckAElements, ['table', 'metrics'], 'base: Metrics on top of the table')
}

const OFF = { ...SHELL_ENV }
const ON = { ...SHELL_ENV, [FLAG]: 'true' }
const libFor = (env, overrides = {}) => createLoader(branchRoot, env, createStorage(), overrides)(LIB)
const failures = []
const pending = []
const report = (label, error) => { if (!error) { console.log(`ok   ${label}`); return } failures.push(label); console.log(`FAIL ${label}\n     ${error.message.split('\n')[0]}`) }
const check = (label, fn) => {
  let out
  try { out = fn() } catch (error) { report(label, error); return }
  if (out && typeof out.then === 'function') pending.push(out.then(() => report(label), error => report(label, error)))
  else report(label)
}

// ---- 1. the J3 R13-2 sequence -----------------------------------------------------------------------------------------------------
const branchOff = Object.fromEntries(Object.keys(SCENARIOS).map(name => [name, runScenario(name, { treeRoot: branchRoot, env: OFF })]))
const branchOn = Object.fromEntries(Object.keys(SCENARIOS).map(name => [name, runScenario(name, { treeRoot: branchRoot, env: ON })]))
check('1a flag off: the bug is still reproduced as on the base tree (brief page after Reload now, Metrics on deck A)', () => expectBug(branchOff['j3-r13-reload-then-start-blank']))
check('1b flag on: no brief page after Reload now; Start on a blank canvas opens a new session; Metrics on the new deck', () => expectFixed(branchOn['j3-r13-reload-then-start-blank']))
check('1c the fixed-behaviour assertions fail with the flag off (the repro is real)', () => assert.throws(() => expectFixed(branchOff['j3-r13-reload-then-start-blank'])))
if (baseRoot) {
  const base = runScenario('j3-r13-reload-then-start-blank', { treeRoot: baseRoot, env: ON })
  check('1d base tree (flag set to "true", no code for it): the bug reproduces and the fixed-behaviour assertions fail', () => {
    expectBug(base)
    assert.throws(() => expectFixed(base))
  })
}

// ---- 2. what must not change with the flag on ------------------------------------------------------------------------------------
check('2a flag on: a just-started (unsaved) canvas clicked twice is the old dismiss, no new session', () => {
  const on = branchOn['fresh-canvas-clicked-twice'], off = branchOff['fresh-canvas-clicked-twice']
  assert.deepEqual(on.checkpoints, off.checkpoints)
  assert.deepEqual(on.log, [])
  assert.equal(at(on, 'second click').session, 'synthetic-session-1')
})
check('2b flag on: a theme pick before the first click still starts this session\'s canvas', () => {
  const on = branchOn['theme-pick-then-start']
  assert.deepEqual(on.checkpoints, branchOff['theme-pick-then-start'].checkpoints)
  assert.equal(on.log.some(entry => entry[0] === 'newSession'), false)
})
check('2c flag on: switching to another saved session leaks no memory; its landing shows and its click dismisses', () => {
  const on = branchOn['switch-to-another-saved-session']
  assert.deepEqual(on.checkpoints, branchOff['switch-to-another-saved-session'].checkpoints)
  assert.deepEqual(JSON.parse(on.storage[libFor(ON).blankStartKey('synthetic-user')]), ['synthetic-session-1', 'synthetic-session-9'],
    'remembered: deck A, then session 9 only after its own click')
  assert.equal(at(on, 'opened another saved session').briefPage, true)
})
check('2e flag on, hygiene on: Start saves no row; after Reload the still-UNSAVED session opens on its canvas; a second Start is the old dismiss', () => {
  const on = branchOn['unsaved-start-reload-start-again'], off = branchOff['unsaved-start-reload-start-again']
  const reload = at(on, 'after Reload now (still unsaved)')
  assert.equal(reload.saved, false, 'still unsaved (the per-tab marker keeps it a local session)')
  assert.equal(reload.briefPage, false, 'the started canvas is restored, no brief page')
  assert.equal(at(off, 'after Reload now (still unsaved)').briefPage, true, 'flag off: the brief page (today)')
  assert.equal(at(on, 'second click').session, 'synthetic-session-1')
  assert.deepEqual(on.log, [], 'no New, no row')
  assert.deepEqual(at(on, 'second click'), { ...at(off, 'second click'), label: 'second click' }, 'second click: same state as today')
})
check('2f flag on: a session with a real (generated) deck is forgotten', () => {
  const on = branchOn['started-then-real-deck']
  assert.deepEqual(JSON.parse(on.storage[libFor(ON).blankStartKey('synthetic-user')] ?? '[]'), [], 'entry dropped')
  assert.equal(at(on, 'generated deck').briefPage, false)
})
check('2d flag on: a pending start is dropped when the user opens another session first', () => {
  const on = branchOn['pending-start-dropped-on-switch']
  const opened = at(on, 'opened another session before the new deck arrived')
  assert.equal(opened.session, 'synthetic-session-9')
  assert.equal(opened.briefPage, true, 'session 9 is not auto-started')
  assert.equal(opened.dismissed, false)
  assert.equal(at(on, 'back on the new session when its deck arrives').briefPage, true, 'the dropped start does not fire later')
})

// ---- 3. flag off == base tree ---------------------------------------------------------------------------------------------------
check('3a flag off never reads or writes the blank-start memory', () => {
  for (const [name, trace] of Object.entries(branchOff)) assert.deepEqual(trace.storage, {}, name)
})
if (baseRoot) {
  check('3b flag off: every scenario trace is identical to the base tree\'s (hash)', () => {
    for (const name of Object.keys(SCENARIOS)) {
      const base = runScenario(name, { treeRoot: baseRoot, env: OFF })
      assert.equal(sha(branchOff[name]), sha(base), name)
      console.log(`     ${name}: ${sha(base)}`)
    }
  })
  check('3c base tree with the flag set to "true" behaves as the branch with the flag off (hash)', () => {
    for (const name of Object.keys(SCENARIOS)) assert.equal(sha(runScenario(name, { treeRoot: baseRoot, env: ON })), sha(branchOff[name]), name)
  })
} else {
  console.log('skip 3b/3c (set BLANK_START_BASE_ROOT to a pristine base checkout)')
}

// ---- 4. the lib -------------------------------------------------------------------------------------------------------------------
check('4a flag literal: only exact "true" enables', () => {
  assert.equal(libFor(OFF).STUDIO_BLANK_START_NEW_SESSION_ENABLED, false)
  assert.equal(libFor({ [FLAG]: 'TRUE' }).STUDIO_BLANK_START_NEW_SESSION_ENABLED, false)
  assert.equal(libFor({ [FLAG]: '1' }).STUDIO_BLANK_START_NEW_SESSION_ENABLED, false)
  assert.equal(libFor(ON).STUDIO_BLANK_START_NEW_SESSION_ENABLED, true)
})
check('4b memory: per account, bounded to the newest 50, "new"/empty ignored, storage errors swallowed', () => {
  const lib = libFor(ON)
  const storage = createStorage()
  for (let i = 0; i < 60; i++) lib.rememberBlankStart(storage, 'u1', `s${i}`)
  lib.rememberBlankStart(storage, 'u1', 's15') // re-start moves to newest
  const list = JSON.parse(storage.getItem(lib.blankStartKey('u1')))
  assert.equal(list.length, lib.BLANK_START_MEMORY_LIMIT)
  assert.equal(list.at(-1), 's15')
  assert.equal(lib.hasBlankStart(storage, 'u1', 's59'), true)
  assert.equal(lib.hasBlankStart(storage, 'u1', 's0'), false)
  assert.equal(lib.hasBlankStart(storage, 'u2', 's59'), false, 'another account')
  lib.rememberBlankStart(storage, 'u1', 'new'); lib.rememberBlankStart(storage, '', 'x'); lib.rememberBlankStart(storage, 'u1', null)
  assert.equal(lib.hasBlankStart(storage, 'u1', 'new'), false)
  storage.setItem(lib.blankStartKey('u3'), '{not json'); assert.equal(lib.hasBlankStart(storage, 'u3', 'x'), false)
  const throwing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('quota') } }
  assert.equal(lib.hasBlankStart(throwing, 'u1', 's1'), false)
  assert.doesNotThrow(() => lib.rememberBlankStart(throwing, 'u1', 's1'))
  assert.equal(lib.hasBlankStart(null, 'u1', 's1'), false)
})
check('4b2 storage hygiene: account id never in clear in the key; forget; forget on delete across accounts; every access guarded', () => {
  const lib = libFor(ON)
  const email = 'person@example.invalid'
  assert.ok(!lib.blankStartKey(email).includes('person') && !lib.blankStartKey(email).includes('@'), 'no email in the key name')
  assert.match(lib.blankStartKey(email), /^deckster:studio-blank-started:v1:[0-9a-f]{8}$/)
  assert.notEqual(lib.blankStartKey('u1'), lib.blankStartKey('u2'))
  const storage = createStorage()
  lib.rememberBlankStart(storage, 'u1', 's1'); lib.rememberBlankStart(storage, 'u1', 's2'); lib.rememberBlankStart(storage, 'u2', 's1')
  storage.setItem('unrelated', '["s1"]')
  assert.deepEqual(Object.values(storage.dump()).flatMap(v => JSON.parse(v)).every(id => /^s\d$/.test(id)), true, 'values: session ids only')
  lib.forgetBlankStart(storage, 'u1', 's2')
  assert.equal(lib.hasBlankStart(storage, 'u1', 's2'), false)
  assert.equal(lib.hasBlankStart(storage, 'u1', 's1'), true)
  lib.forgetBlankStartEverywhere(storage, 's1')
  assert.equal(lib.hasBlankStart(storage, 'u1', 's1'), false)
  assert.equal(lib.hasBlankStart(storage, 'u2', 's1'), false)
  assert.equal(storage.getItem(lib.blankStartKey('u1')), null, 'an emptied list removes its key')
  assert.equal(storage.getItem('unrelated'), '["s1"]', 'other keys untouched')
  const throwing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('quota') }, removeItem: () => { throw new Error('denied') }, get length() { throw new Error('denied') }, key: () => { throw new Error('denied') } }
  for (const call of [() => lib.forgetBlankStart(throwing, 'u1', 's1'), () => lib.forgetBlankStartEverywhere(throwing, 's1'), () => lib.rememberBlankStart(throwing, 'u1', 's1'), () => lib.hasBlankStart(throwing, 'u1', 's1')]) assert.doesNotThrow(call)
  const blocked = createLoader(branchRoot, ON, null, {}, { window: Object.defineProperty({}, 'localStorage', { get() { throw new Error('SecurityError') } }) })(LIB)
  assert.equal(blocked.browserBlankStartStorage(), null, 'blocked localStorage: null, no throw')
  const server = createLoader(branchRoot, ON, null, {}, { window: undefined })(LIB)
  assert.equal(server.browserBlankStartStorage(), null, 'server render: null')
})
check('4e delete: the REAL useChatSessions.deleteSession forgets the session after a successful DELETE (flag on only)', () => {
  const run = (env, ok) => {
    const storage = createStorage()
    const lib = createLoader(branchRoot, env, storage)(LIB)
    lib.rememberBlankStart(storage, 'u1', 's1'); lib.rememberBlankStart(storage, 'u1', 's2')
    const before = JSON.stringify(storage.dump())
    const requests = []
    const fetchStub = async (url, init) => { requests.push(`${init?.method ?? 'GET'} ${url}`); return { ok, statusText: ok ? 'OK' : 'Server Error', json: async () => ({}) } }
    const quiet = ok ? console : { ...console, error() {} } // the failed DELETE logs its error; expected here
    const { useChatSessions } = createLoader(branchRoot, env, storage, {}, { fetch: fetchStub, console: quiet })('hooks/use-chat-sessions.ts')
    let api = null
    const root = new Root()
    root.setElement(React.createElement(function Probe() { api = useChatSessions(); return null })); root.flush()
    return { storage, before, requests, deleted: api.deleteSession('s1') , root }
  }
  return Promise.all([run(ON, true), run(OFF, true), run(ON, false)].map(async r => ({ ...r, result: await r.deleted }))).then(([on, off, failed]) => {
    assert.deepEqual(on.requests, ['DELETE /api/sessions/s1'])
    assert.equal(on.result, true)
    const lib = libFor(ON)
    assert.equal(lib.hasBlankStart(on.storage, 'u1', 's1'), false, 'flag on: forgotten')
    assert.equal(lib.hasBlankStart(on.storage, 'u1', 's2'), true)
    assert.equal(JSON.stringify(off.storage.dump()), off.before, 'flag off: storage untouched')
    assert.equal(JSON.stringify(failed.storage.dump()), failed.before, 'a failed DELETE forgets nothing')
  })
})
check('4c decision table', () => {
  const { decideBlankStart: d } = libFor(ON)
  assert.equal(d({ enabled: false, sessionId: 's', started: true, unsavedSession: false }), 'dismiss')
  assert.equal(d({ enabled: true, sessionId: 's', started: true, unsavedSession: false }), 'new_session')
  assert.equal(d({ enabled: true, sessionId: 's', started: false, unsavedSession: false }), 'dismiss')
  assert.equal(d({ enabled: true, sessionId: 's', started: true, unsavedSession: true }), 'dismiss')
  assert.equal(d({ enabled: true, sessionId: null, started: true, unsavedSession: false }), 'dismiss')
})
check('4d pending start steps', () => {
  const { advanceBlankStartCarry } = libFor(ON)
  const step = (carry, now) => JSON.parse(JSON.stringify(advanceBlankStartCarry(carry, now))) // plain objects across the vm realm
  assert.deepEqual(step(null, { sessionId: 'a', hasOwnedSelection: true, showLanding: true }), { carry: null, dismiss: false })
  const c = { from: 'a', to: null }
  assert.deepEqual(step(c, { sessionId: 'a', hasOwnedSelection: true, showLanding: true }), { carry: c, dismiss: false }, 'still on the old session')
  assert.deepEqual(step(c, { sessionId: 'b', hasOwnedSelection: false, showLanding: true }), { carry: { from: 'a', to: 'b' }, dismiss: false }, 'waits for the deck')
  assert.deepEqual(step({ from: 'a', to: 'b' }, { sessionId: 'b', hasOwnedSelection: true, showLanding: true }), { carry: null, dismiss: true })
  assert.deepEqual(step({ from: 'a', to: 'b' }, { sessionId: 'b', hasOwnedSelection: true, showLanding: false }), { carry: null, dismiss: false }, 'a build started: dropped')
  assert.deepEqual(step({ from: 'a', to: 'b' }, { sessionId: 'c', hasOwnedSelection: true, showLanding: true }), { carry: null, dismiss: false }, 'another session: dropped')
})

// ---- 5. wiring ----------------------------------------------------------------------------------------------------------------
check('5a page wiring', () => {
  const page = read(PAGE)
  assert.match(page, /^import \{ STUDIO_BLANK_START_NEW_SESSION_ENABLED \} from '@\/lib\/studio-blank-start-new-session'$/m)
  assert.match(page, /^import \{ useStudioBlankStart \} from '@\/hooks\/use-studio-blank-start'$/m)
  assert.equal((page.match(/useStudioBlankStart\(/g) || []).length, 1, 'one hook call')
  assert.match(page, /    setBlankPlaceholderDismissed\(true\)\n  \}\n(  \/\/ [^\n]*\n)+  const handleStartOnBlankCanvas = useStudioBlankStart\(\{\n    enabled: STUDIO_BLANK_START_NEW_SESSION_ENABLED && studioShell,\n/, 'right after the dismiss handler, Studio shell only')
  assert.match(page, /    hasRealDeck: studioCanvasLifecycle\.hasGeneratedDeck \|\| studioCanvasLifecycle\.hasAuthoredDeck,\n    dismiss: handleDismissBlankPlaceholder,\n    startNewSession: \(\) => handleNewChatWrappedRef\.current\?\.\(\),\n  \}\)/, 'the page\'s own dismiss handler and New flow')
  const sessions = read('hooks/use-chat-sessions.ts')
  assert.match(sessions, /throw new Error\(`Failed to delete session: \$\{response\.statusText\}`\);\n      \}\n\n      \/\/ [^\n]*\n      if \(STUDIO_BLANK_START_NEW_SESSION_ENABLED\) forgetBlankStartEverywhere\(browserBlankStartStorage\(\), sessionId\);\n\n      return true;/, 'delete cleanup only after a successful DELETE, flag-gated')
  assert.match(page, /onStartBlank=\{effectivePresentationUrl \? \(STUDIO_BLANK_START_NEW_SESSION_ENABLED \? handleStartOnBlankCanvas : handleDismissBlankPlaceholder\) : undefined\}/, 'flag off: the same handler as before')
  assert.match(page, /onDismissBlankPlaceholder=\{handleDismissBlankPlaceholder\}/, 'the stage button is unchanged')
  assert.match(page, /useEffect\(\(\) => \{\n    setBlankPlaceholderDismissed\(false\)\n  \}, \[currentSessionId\]\)/, 'the per-session reset is unchanged')
  assert.ok(page.indexOf('setBlankPlaceholderDismissed(false)') < page.indexOf('useStudioBlankStart({'), 'the hook (and its restore effect) comes after the reset')
})
check('5b the flag is read as a literal; lib and hook make no request', () => {
  const lib = read(LIB), hook = read(HOOK)
  assert.match(lib, /process\.env\.NEXT_PUBLIC_STUDIO_BLANK_START_NEW_SESSION === 'true'/)
  for (const [file, source] of [[LIB, lib], [HOOK, hook]]) {
    assert.doesNotMatch(source.replace(/\/\*[\s\S]*?\*\//g, ''), /\b(fetch|WebSocket|XMLHttpRequest|sessionStorage|sendBeacon)\b/, file)
  }
  assert.doesNotMatch(hook, /process\.env/, 'the hook takes `enabled` from the page')
})
if (baseRoot) {
  check('5c untouched: the update-reload guard, the Text Labs hook, the session hooks, the first-run row', () => {
    for (const file of ['components/build-version-guard.tsx', 'hooks/use-textlabs-generation.ts', 'hooks/use-builder-session.ts',
      'hooks/use-session-persistence.ts', 'components/builder/studio-first-run-actions.tsx', 'lib/studio-canvas-lifecycle.ts']) {
      assert.equal(read(file), readFrom(baseRoot, file), file)
    }
  })
}
check('5d documented default off; script registered', () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_BLANK_START_NEW_SESSION="false"$/m)
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-blank-start-new-session'], 'node scripts/test-studio-blank-start-new-session.mjs')
})

// ---- 6. mutants must be caught ------------------------------------------------------------------------------------------------
const MUTANTS = [
  ['lib: new session even for an unsaved canvas', LIB, '&& !input.unsavedSession ', '', 'fresh-canvas-clicked-twice'],
  ['lib: never remember', LIB, 'writeStarted(storage, blankStartKey(ownerId), started.slice(-BLANK_START_MEMORY_LIMIT))', 'void 0', 'j3-r13-reload-then-start-blank'],
  ['hook: remember on the session-switch commit', HOOK, 'else if (sameSession && dismissed)', 'else if (dismissed)', 'switch-to-another-saved-session'],
  ['hook: no restore after load', HOOK, 'latest.current.setDismissed(true)', 'void 0', 'j3-r13-reload-then-start-blank'],
  ['hook: pending start never fires', HOOK, 'if (step.dismiss) latest.current.dismiss()', 'void step', 'j3-r13-reload-then-start-blank'],
  ['hook: pending start not dropped on a switch', LIB, 'if (now.sessionId !== carry.to) return { carry: null, dismiss: false }', 'if (now.sessionId !== carry.to) return { carry, dismiss: false }', 'pending-start-dropped-on-switch'],
  ['page: first-run row keeps the old handler with the flag on', PAGE, '(STUDIO_BLANK_START_NEW_SESSION_ENABLED ? handleStartOnBlankCanvas : handleDismissBlankPlaceholder)', 'handleDismissBlankPlaceholder', 'j3-r13-reload-then-start-blank'],
  ['hook: a real deck is never forgotten', HOOK, 'if (hasRealDeck) forgetBlankStart(browserBlankStartStorage(), ownerId, sessionId)\n    else if', 'if'],
  ['page: hook enabled outside the flag', PAGE, 'enabled: STUDIO_BLANK_START_NEW_SESSION_ENABLED && studioShell,', 'enabled: studioShell,', 'flag-off'],
]
for (const [label, file, from, to, scenario] of MUTANTS) {
  check(`6 mutant caught: ${label}`, () => {
    const source = read(file)
    assert.ok(source.includes(from), `mutant anchor present in ${file}`)
    const overrides = { [file]: source.replace(from, to) }
    let caught = false
    try {
      if (scenario === 'flag-off') {
        for (const name of Object.keys(SCENARIOS)) assert.equal(sha(runScenario(name, { treeRoot: branchRoot, env: OFF, overrides })), sha(branchOff[name]), name)
      } else {
        const trace = runScenario(scenario, { treeRoot: branchRoot, env: ON, overrides })
        if (scenario === 'j3-r13-reload-then-start-blank') expectFixed(trace)
        else if (scenario === 'started-then-real-deck') assert.deepEqual(JSON.parse(trace.storage[libFor(ON).blankStartKey('synthetic-user')] ?? '[]'), [])
        else assert.equal(sha(trace), sha(branchOn[scenario]))
      }
    } catch { caught = true }
    assert.ok(caught, 'the mutant passed every check')
  })
}

await Promise.all(pending)
console.log(failures.length ? `\n${failures.length} FAILED` : '\nall blank-start checks passed')
process.exit(failures.length ? 1 : 0)
