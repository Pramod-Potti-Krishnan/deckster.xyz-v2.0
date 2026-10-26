// FRONTEND-2 Pass 3 (P3-1 A, chat parity): edit an element from chat and refresh the Notes panel, Studio half (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT, exact "true", default off).
//
//   node scripts/test-studio-chat-element-edit.mjs                  # everything, offline (the viewer's replies and acks come from layout-transcripts.json, which the real Layout code recorded)
//   CHAT_EDIT_LAYOUT_DIR=<layout-builder checkout at c77f0474, !261> node scripts/test-studio-chat-element-edit.mjs     # also runs the REAL Layout viewer code live, and checks it still says what was recorded
//   ... --record-layout                                             # (with the variable) re-records scripts/fixtures/chat-element-edit/layout-transcripts.json
//
// What it proves:
//  1. the wire half (lib/chat-element-edit-wire.ts), as streams/director2/element-edit/CONTRACT.md has it: the caps (element_edit1 / notes1) only with the flag on, after the other caps; {type:'element_edit', payload} and deck_mutation payload.mutation 'notes_updated' routed; {type:'element_edit_result', payload};
//  2. the runner (lib/chat-element-edit.ts), as the PAGE wires it (the runner assignment is cut out of app/builder/page.tsx and run with the page's values), against the REAL viewer code:
//       Studio side: components/presentation-viewer.tsx's own sendCommand, its saveStatusChanged handler and its ensureEditMode, cut out and run;
//       Layout side: viewer/presentation-viewer.html's postMessage bridge, as Layout serves it with LAYOUT_ARRANGE_COMMANDS_ENABLED on (arrange_commands.py's apply_to_viewer: the Arrange cases act only with intent 'arrange', layout-builder !261), with
//       edit-mode.js, auto-save.js, element-manager.js, grid-converter.js and arrange-commands.js (scripts/studio-chat-element-edit-layout.mjs), in a node vm;
//     every op (delete, order, place, style) through the viewer's own commands, every error code, `ok:true` only after the autosave ack, one result per directive, BUSY, a stale owner sends nothing;
//  3. the REAL Director socket hook: the frame goes to the runner out of band, the result goes back as bytes on the same socket, the caps are in client_caps only with the flag on, notes_updated reaches the Notes panel's event;
//  4. the Notes panel's listener (cut out of components/slide-notes-panel.tsx): the deck is read again, Director's notes show unless the user has an unsaved edit;
//  5. flag off is identical: the strip module gives back the base files byte for byte; the hook, run from the base commit and from this tree, puts the same bytes on the socket and leaves the same state and cache for the
//     same frames (the new frames included); the built payload of a send hashes the same;
//  6. the page wires it only behind the flag, after the theme / export runner (outside the region scripts/test-studio-chat-theme-export.mjs pins), every added line carries the marker, the commits are this change's own;
//  7. mutants of the runner, the wire, the hook, the page and the panel are caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { Root } from './studio-chat-harness/mini-react.mjs'
import { createEnvironment, SYNTHETIC_LAYOUT_URL } from './studio-chat-harness/fake-env.mjs'
import { createModuleLoader } from './studio-chat-harness/module-loader.mjs'
import { BASE_ENV } from './studio-chat-harness/profiles.mjs'
import { createClock, createLayoutViewer, replayViewer, LAYOUT_SCRIPTS, ARRANGE_SCRIPT, ARRANGE_MODULE } from './studio-chat-element-edit-layout.mjs'
import {
  BASE_COMMIT, CHAT_ELEMENT_EDIT_FILES, CHAT_ELEMENT_EDIT_NEW_FILES, CHAT_ELEMENT_EDIT_OWN_EDITS, CHAT_ELEMENT_EDIT_RETIRED_FILES, CHAT_ELEMENT_EDIT_SCOPE_FILES, CHAT_ELEMENT_EDIT_ENV_BLOCK, CHAT_ELEMENT_EDIT_MARKER_RE, stripChatElementEdit,
} from './studio-chat-element-edit-strip.mjs'
import { LATER_STRIPS } from './studio-later-changes.mjs'
import { stripPass3PolishB } from './studio-pass3-polish-b-strip.mjs' // COMPOSER-2's first-paint pin reads the viewer through it, and it now takes this change's lines out too: it is not a peer to strip before this change's own checks
// The other registered changes' marked lines (dev's: flow control, arrange, ... and the ones already in the base) come out of both sides before this change's identity checks; this change's own strip is the one left out.
const stripPeers = (rel, text) => LATER_STRIPS.filter(strip => strip !== stripChatElementEdit && strip !== stripPass3PolishB).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const FIXTURES = path.join(root, 'scripts/fixtures/chat-element-edit')
const TRANSCRIPTS = path.join(FIXTURES, 'layout-transcripts.json')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const baseFile = rel => git('show', `${BASE_COMMIT}:${rel}`)

const RECORD = process.argv.includes('--record-layout')
const LAYOUT_DIR = process.env.CHAT_EDIT_LAYOUT_DIR ? path.resolve(process.env.CHAT_EDIT_LAYOUT_DIR) : null
const LIVE = Boolean(LAYOUT_DIR)
if (RECORD && !LIVE) throw new Error('--record-layout needs CHAT_EDIT_LAYOUT_DIR')
const recordedTranscripts = RECORD ? { meta: {}, scenarios: {} } : JSON.parse(fs.readFileSync(TRANSCRIPTS, 'utf8'))

// The libs run in their own vm realm: compare plain data (a prototype from another realm is not the point of any check).
const deepEqual = (actual, expected, message) => (message === undefined ? assert.deepStrictEqual(plain(actual), plain(expected)) : assert.deepStrictEqual(plain(actual), plain(expected), message))
let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return // a debugging filter: one check by a word of its label
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, process.env.DEBUG_FULL ? 40 : 4).join(process.env.DEBUG_FULL ? '\n' : ' | ') ?? error}`) }
}
let mutantsCaught = 0
const mutantsMissed = []
/** A mutant: `run(text)` must throw (the proof's own check fails on the broken code). */
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); mutantsMissed.push(label); console.error(`MISSED mutant ${label}`) } catch { mutantsCaught++; console.log(`CAUGHT mutant ${label}`) }
}

// ---- TypeScript modules in a vm, with overridable source (for the mutants) -----------------------------------------------------------
const liveRuns = new Map()
const SESSION = 's_e2e', PRESENTATION = 'pres-chat-edit', STUDIO_ORIGIN = 'https://studio.example', LAYOUT_ORIGIN = 'https://layout.example'
const FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT'

function makeLibs({ env = { [FLAG]: 'true' }, overrides = {}, clock = null } = {}) {
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const text = overrides[file] ?? read(file)
    const out = ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const sandbox = { module, exports: module.exports, process: { env }, console, URL, Promise, Error, JSON, Math, Set, Map, Object, Array, Number, String, Boolean, RegExp, Symbol, parseFloat, isFinite,
      setTimeout: clock ? clock.setTimeout : setTimeout, clearTimeout: clock ? clock.clearTimeout : clearTimeout,
      require(spec) {
        if (spec.startsWith('@/')) {
          const base = spec.slice(2)
          for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, base + ext))) return load(base + ext)
        }
        throw new Error(`unexpected dependency ${spec} of ${file}`)
      } }
    vm.runInNewContext(out, sandbox, { filename: file })
    return module.exports
  }
  return { wire: load('lib/chat-element-edit-wire.ts'), save: load('lib/chat-element-edit-save.ts'), lib: load('lib/chat-element-edit.ts'), load }
}

// ---- AST helpers: the real code, cut out of the Studio files ----------------------------------------------------------------------------
const parse = (rel, text = read(rel)) => ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
function findNode(ast, predicate) { let found = null; const visit = node => { if (found) return; if (predicate(node)) { found = node; return } ts.forEachChild(node, visit) }; visit(ast); return found }
const js = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
const evalExpression = (expression, context) => vm.runInNewContext(js(`(${expression})`), context)
function functionDeclarationText(rel, name, text = read(rel)) {
  const ast = parse(rel, text)
  const found = findNode(ast, node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.ok(found, `${rel} defines ${name}`)
  return found.getText(ast)
}
/** The text of the first argument of the call `callee(...)` whose first argument contains `needle`. */
function callbackText(rel, callee, needle, text = read(rel)) {
  const ast = parse(rel, text)
  const call = findNode(ast, node => ts.isCallExpression(node) && node.expression.getText(ast) === callee && node.arguments[0]?.getText(ast).includes(needle))
  assert.ok(call, `${rel}: ${callee}(... ${needle} ...)`)
  return call.arguments[0].getText(ast)
}
function assignmentRight(rel, left, text = read(rel)) {
  const ast = parse(rel, text)
  const node = findNode(ast, n => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && n.left.getText(ast) === left)
  assert.ok(node, `${rel}: ${left} = ...`)
  return { text: node.right.getText(ast), start: node.getStart(ast), end: node.getEnd(), ast, node }
}
function constText(rel, name, text = read(rel)) {
  const ast = parse(rel, text)
  const decl = findNode(ast, n => ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
  assert.ok(decl?.initializer, `${rel} defines ${name}`)
  return decl.initializer.getText(ast)
}

const viewerTsx = read('components/presentation-viewer.tsx')
const messaging = makeLibs().load('lib/layout-viewer-messaging.ts')
const router = makeLibs().load('lib/element-command-router.ts')
const bridgeJs = js(`${functionDeclarationText('components/presentation-viewer.tsx', 'createViewerRequestId')}\n${functionDeclarationText('components/presentation-viewer.tsx', 'sendCommand')}\n;({ sendCommand })`)
const timeoutConstants = Object.fromEntries(['DEFAULT', 'READ', 'MUTATING', 'CITED_UPSERT'].map(name => [`${name}_LAYOUT_COMMAND_TIMEOUT_MS`, Number(constText('components/presentation-viewer.tsx', `${name}_LAYOUT_COMMAND_TIMEOUT_MS`).replace(/_/g, ''))]))
const ELEMENT_TIMEOUTS = vm.runInNewContext(js(`(${constText('components/presentation-viewer.tsx', 'LAYOUT_ELEMENT_COMMAND_TIMEOUTS')})`), timeoutConstants)
const DEFAULT_TIMEOUT = timeoutConstants.DEFAULT_LAYOUT_COMMAND_TIMEOUT_MS

// ---- Layout: the real viewer code (live) or its recorded transcript (offline) -------------------------------------------------------------
const DECK = [
  ['el_text_a', { gridRow: '4/10', gridColumn: '2/16', fontSize: '24px' }],
  ['el_text_locked', { gridRow: '11/15', gridColumn: '2/10', locked: true }],
  ['el_chart_b', { type: 'chart', componentType: 'CHART', gridRow: '4/14', gridColumn: '18/32' }],
  ['el_metrics_c', { type: 'textbox', componentType: 'METRICS', gridRow: '11/17', gridColumn: '12/30' }],
  ['el_image_e', { type: 'image', componentType: 'IMAGE', gridRow: '12/18', gridColumn: '20/30' }],
  ['el_table_d', { type: 'table', componentType: 'TABLE', gridRow: '4/9', gridColumn: '2/10' }], // Layout's autosave never collects a table or a shape: Arrange refuses it
  ['el_chart_locked', { type: 'chart', componentType: 'CHART', gridRow: '12/17', gridColumn: '3/9', classLocked: true }], // locked in the DOM only: the registry does not say so, Arrange does
  ['el_slot_fixed', { type: 'image', componentType: 'IMAGE', gridRow: '6/9', gridColumn: '12/18', noDrag: true }], // the viewer itself does not let the user drag it (a template slot)
]
const layoutSources = LIVE ? Object.fromEntries(['viewer/presentation-viewer.html', ARRANGE_MODULE, ARRANGE_SCRIPT, ...LAYOUT_SCRIPTS].map(file => [file, sha(fs.readFileSync(path.join(LAYOUT_DIR, file), 'utf8'))])) : null

function fakeResponse(status) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => ({ detail: 'synthetic save refusal' }) }
}

/**
 * One scenario: a Studio window and iframe, the real sendCommand over it, the viewer's save-ack handler and edit-mode function (cut out of
 * components/presentation-viewer.tsx), the page's runner (cut out of app/builder/page.tsx), and a viewer behind it.
 */
async function scenario(name, frameOverrides = null, options = {}) {
  const { deck = DECK, editMode = false, put = 'ok', viewOnly = false, arrange = true, libs: libOptions = {}, owner: ownerOptions = {}, page = {}, manual = false, sources = {} } = options
  const clock = options.clock ?? createClock()
  const libs = options.libsInstance ?? makeLibs({ ...libOptions, clock })
  const listeners = new Set()
  const sentResults = []
  const studioWindow = { addEventListener(type, fn) { if (type === 'message') listeners.add(fn) }, removeEventListener(type, fn) { if (type === 'message') listeners.delete(fn) }, dispatchEvent() {} }
  let viewerWorld = null
  const viewerHandle = {
    postMessage(data, targetOrigin) {
      assert.equal(targetOrigin, LAYOUT_ORIGIN, 'Studio posts to the viewer origin only')
      const request = plain(data)
      queueMicrotask(() => { viewerWorld.deliver(request, STUDIO_ORIGIN).catch(error => { throw error }) })
    },
  }
  const toStudio = (data, _origin) => queueMicrotask(() => { for (const fn of [...listeners]) fn({ source: viewerHandle, origin: LAYOUT_ORIGIN, data: plain(data) }) })
  const putControl = { requests: [], release: () => {}, mode: put }
  if (LIVE) {
    let held = null
    putControl.release = () => { held?.(fakeResponse(200)); held = null }
    viewerWorld = createLayoutViewer({ layoutDir: LAYOUT_DIR, studioOrigin: STUDIO_ORIGIN, parent: { postMessage: toStudio }, clock, viewOnly, arrange, presentationId: PRESENTATION,
      fetchImpl: async (url, init) => {
        putControl.requests.push({ at: clock.now(), url: String(url), method: init?.method })
        if (putControl.mode === 'fail') return fakeResponse(500)
        if (putControl.mode === 'hold') return new Promise(resolve => { held = resolve })
        return fakeResponse(200)
      } })
    for (const [id, spec] of deck) viewerWorld.registerElement(id, spec)
    if (editMode) viewerWorld.enterEditMode()
  } else {
    const transcript = recordedTranscripts.scenarios[name]
    assert.ok(transcript, `a recorded Layout transcript for scenario "${name}" (record with CHAT_EDIT_LAYOUT_DIR=... --record-layout)`)
    viewerWorld = replayViewer({ transcript, parent: { postMessage: toStudio }, clock })
  }
  clock.setGuard?.(() => { if (viewerWorld.log.divergence) throw viewerWorld.log.divergence })
  const iframe = { src: `${LAYOUT_ORIGIN}/p/${PRESENTATION}`, contentWindow: viewerHandle }
  const iframeRef = { current: iframe }
  const bridgeContext = {
    window: studioWindow, Promise, Error, Date, Math, JSON, Object, Array, queueMicrotask,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, crypto: { randomUUID: (() => { let n = 0; return () => `studio-request-${++n}` })() },
    getLayoutServiceUrl: () => LAYOUT_ORIGIN, VIEWER_ORIGIN: LAYOUT_ORIGIN,
    getLayoutViewerOrigin: messaging.getLayoutViewerOrigin, isTrustedLayoutViewerMessage: messaging.isTrustedLayoutViewerMessage,
    isMatchingSlideComposeCommandResponse: () => { throw new Error('these commands must not take the strict compose/refine matcher') },
    scTrace() {}, isSlideComposerTraceEnabled: () => false, reportLayoutCommandAck() {},
  }
  const { sendCommand } = vm.runInNewContext(bridgeJs, bridgeContext)
  const routes = []
  // handleSendElementCommand: a Layout-service command goes to sendCommand with its budget; handleSendTextBoxCommand: sendCommand as it is.
  const sendElementCommand = (action, params) => {
    const type = router.getCommandType(action)
    routes.push(['element', action, type])
    assert.notEqual(type, 'elementor', `${action} must not go to Elementor`)
    return sendCommand(iframe, action, params, { timeoutMs: ELEMENT_TIMEOUTS[action] ?? DEFAULT_TIMEOUT })
  }
  const sendTextBoxCommand = (action, params) => { routes.push(['textbox', action, router.getCommandType(action)]); return sendCommand(iframe, action, params) }

  // The viewer's own save-ack handler (the effect with saveStatusChanged in components/presentation-viewer.tsx), run over this window.
  const statuses = []
  const saveEffect = evalExpression(callbackText('components/presentation-viewer.tsx', 'useEffect', "'saveStatusChanged'", sources['components/presentation-viewer.tsx'] ?? viewerTsx), {
    window: studioWindow, VIEWER_ORIGIN: LAYOUT_ORIGIN, LAYOUT_URL_CONFIG_ERROR: null, isTrustedLayoutViewerMessage: messaging.isTrustedLayoutViewerMessage, iframeRef,
    isLayoutViewerEvent: router.isLayoutViewerEvent, isDiagramRendererStateEvent: () => false, parseDiagramRendererStateUpdate: () => null, studioShell: false,
    viewerInteractionIntentRef: { current: 0 }, pendingDiagramStatesRef: { current: new Map() }, diagramStateTimersRef: { current: new Map() }, postCommand() {},
    nativeSnapshotDirtyRef: { current: false }, reportOwnDeckEdit() {}, setNativeSnapshotSafetyRevision() {}, setSaveStatus: status => statuses.push(status), debugLog() {},
    onRefineElementRequested: null, resolveRefineElementGenerationConfig: () => null, studioArrangeOwnsSaveStatus: () => false, CHAT_ELEMENT_EDIT_ENABLED: libs.wire.CHAT_ELEMENT_EDIT_ENABLED,
    publishViewerSaveEvent: libs.save.publishViewerSaveEvent, window_: null, console, clearTimeout: clock.clearTimeout,
  })
  const published = []
  libs.save.subscribeViewerSaveEvents(event => published.push({ at: clock.now(), status: event.status, pending: event.hasPendingChanges }))
  saveEffect()

  // The viewer's own lazy edit mode (ensureEditMode), run over the same sendCommand, and its registration.
  const editState = { entered: [], isEditMode: false }
  const ensureEditMode = evalExpression(callbackText('components/presentation-viewer.tsx', 'useCallback', 'Studio must also observe native E/Escape exits', sources['components/presentation-viewer.tsx'] ?? viewerTsx), {
    studioShell: true, beginStudioViewerInteraction: () => ({ isCurrent: () => true, iframe }), isEditMode: false, iframeRef, sendCommand,
    setIsEditMode: value => { editState.isEditMode = value; editState.entered.push(value) }, onEditModeChange: () => {}, debugLog() {}, console,
  })
  const registerEffect = evalExpression(callbackText('components/presentation-viewer.tsx', 'useEffect', 'registerChatEditViewer', sources['components/presentation-viewer.tsx'] ?? viewerTsx), {
    CHAT_ELEMENT_EDIT_ENABLED: libs.wire.CHAT_ELEMENT_EDIT_ENABLED, viewerIsReady: true, registerChatEditViewer: libs.save.registerChatEditViewer, ensureEditMode,
  })
  const unregister = registerEffect()

  // The page's runner, with the page's values.
  const slideState = { current: page.current ?? 0 }
  const ownerRef = { current: { sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: PRESENTATION, epoch: 0, ...ownerOptions } }
  const gate = options.gate ?? libs.lib.createElementEditGate()
  const apis = { sendElementCommand: page.noViewer ? undefined : sendElementCommand, sendTextBoxCommand: page.noViewer ? undefined : sendTextBoxCommand,
    goToSlide: page.noGoTo ? undefined : async index => { slideState.current = index } }
  const pageText = sources['app/builder/page.tsx'] ?? read('app/builder/page.tsx')
  const pageContext = {
    CHAT_ELEMENT_EDIT_ENABLED: libs.wire.CHAT_ELEMENT_EDIT_ENABLED, runElementEditDirective: libs.lib.runElementEditDirective,
    chatElementEditGateRef: { current: gate }, elementDirectiveGenerationOwnerRef: ownerRef,
    oneLiveTabSuperseded: Boolean(page.paused), templateModeOn: Boolean(page.templateMode),
    slideStructure: { slides: page.slides ?? [{ slide_id: 'L0' }, { slide_id: 'L1' }, { slide_id: 'L2' }] }, currentSlideIndexRef: slideState,
    layoutServiceApis: apis, getChatEditViewer: libs.save.getChatEditViewer, subscribeViewerSaveEvents: libs.save.subscribeViewerSaveEvents,
    sendElementEditResult: result => { sentResults.push({ at: clock.now(), result: plain(result) }); return true },
    setTimeout: clock.setTimeout, Promise,
  }
  const runner = evalExpression(assignmentRight('app/builder/page.tsx', 'elementEditDirectiveRunnerRef.current', pageText).text, pageContext)
  const ownerHandle = { sessionId: ownerOptions.socketSessionId === undefined ? SESSION : ownerOptions.socketSessionId, current: true, isCurrent() { return this.current } }
  const studio = {
    clock, libs, put: putControl, sentResults, published, statuses, editState, routes, ownerRef, ownerHandle,
    /** The page replaces its owner record when the session, the deck or the epoch changes (a new object each time). */
    switchDeck(changes = {}) { ownerRef.current = { ...ownerRef.current, epoch: ownerRef.current.epoch + 1, ...changes } }, slideState, gate, viewer: viewerWorld, apis, runner, ensureEditMode, unregister,
    requests: () => viewerWorld.log.requests.map(item => ({ action: item.action, params: item.params })),
    actions: () => viewerWorld.log.requests.map(item => item.action),
    /** Delivers an element_edit frame to the page's runner and drives the virtual clock until its result is sent (or `stepsMs` pass). */
    async send(message, { forMs = 60_000, expectResult = true } = {}) {
      const before = sentResults.length
      runner(plain(message), ownerHandle)
      if (expectResult) {
        for (let spent = 0; sentResults.length === before && spent < forMs; spent += 50) await clock.advance(50)
        assert.ok(sentResults.length > before, `a result was sent for ${idOf(message)}`)
      } else await clock.advance(Math.min(forMs, 30_000))
      return sentResults.at(-1)?.result
    },
  }
  // A broken copy of the code under test (a mutant) must not overwrite a recording.
  const mutated = Object.keys(libOptions.overrides ?? {}).length > 0 || Object.keys(sources).length > 0
  if (RECORD && !mutated) recordedTranscripts.scenarios[name] = viewerWorld.log
  if (LIVE && !RECORD && !mutated) { if (!liveRuns.has(name)) liveRuns.set(name, []); liveRuns.get(name).push(viewerWorld.log) }
  if (manual) return studio
  if (frameOverrides) studio.result = await studio.send(frameOverrides)
  return studio
}

const envelope = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'director-frames/contract-envelope.json'), 'utf8'))
let directiveCounter = 0
/** A frame of CONTRACT.md's envelope ({type, message_id, session_id, payload}), with a fresh directive_id; `overrides` go into the payload (session_id into the frame as well). */
const frameOf = (key, overrides = {}) => {
  const frame = plain(envelope.frames[key])
  return { ...frame, ...(overrides.session_id !== undefined ? { session_id: overrides.session_id } : {}), payload: { ...frame.payload, directive_id: `ele_${key}_${++directiveCounter}`, ...overrides } }
}
const idOf = frame => frame.payload.directive_id
/** The same frame flat (no payload): Director's envelope is the payload one; a flat frame is read as well. */
const flatOf = frame => ({ type: frame.type, message_id: frame.message_id, session_id: frame.session_id, ...frame.payload })
const errorOf = result => result.error_code ?? null
const lastRequestFor = (studio, action) => studio.requests().filter(request => request.action === action).at(-1)

// ===== 1. the wire half ==================================================================================================================
const on = makeLibs()
const off = makeLibs({ env: {} })
await check('wire: the flag is the exact string "true", read at build time; the envelope\'s caps are element_edit1 and notes1', async () => {
  assert.equal(on.wire.CHAT_ELEMENT_EDIT_ENABLED, true)
  assert.equal(off.wire.CHAT_ELEMENT_EDIT_ENABLED, false)
  for (const value of ['1', 'TRUE', 'yes', ' true', 'True']) assert.equal(makeLibs({ env: { [FLAG]: value } }).wire.CHAT_ELEMENT_EDIT_ENABLED, false, value)
  deepEqual([...on.wire.ELEMENT_EDIT_CLIENT_CAPS], envelope.caps)
  assert.equal(on.wire.ELEMENT_EDIT_DIRECTIVE_TYPE ?? 'element_edit', 'element_edit')
})
await check('wire: addChatElementEditCaps appends element_edit1 and notes1 after the other caps, once, and touches nothing else', async () => {
  const data = { text: 'hi', client_caps: ['mdc1', 'element_refine1'], deep_research: false }
  const out = on.wire.addChatElementEditCaps(data)
  assert.equal(out, data, 'in place')
  deepEqual(data.client_caps, ['mdc1', 'element_refine1', 'element_edit1', 'notes1'])
  on.wire.addChatElementEditCaps(data)
  deepEqual(data.client_caps, ['mdc1', 'element_refine1', 'element_edit1', 'notes1'], 'not twice')
  deepEqual(on.wire.addChatElementEditCaps({ text: 'x' }).client_caps, ['element_edit1', 'notes1'])
  deepEqual(Object.keys(data), ['text', 'client_caps', 'deep_research'])
})
await check('wire: the directive id is read from the payload (CONTRACT.md) and from a flat frame, and a frame without one is dropped', async () => {
  const { elementEditDirectiveId, elementEditFields } = on.wire
  assert.equal(elementEditDirectiveId(envelope.frames.delete), idOf(envelope.frames.delete))
  assert.equal(elementEditDirectiveId({ type: 'element_edit', payload: { directive_id: 'p-1', element_id: 'x' } }), 'p-1')
  assert.equal(elementEditDirectiveId(flatOf(envelope.frames.delete)), idOf(envelope.frames.delete), 'flat as well')
  assert.equal(elementEditFields(flatOf(envelope.frames.place_right)).place.h, 'right')
  assert.equal(elementEditFields({ type: 'element_edit', payload: { element_id: 'x' } }).element_id, 'x')
  for (const bad of [null, undefined, 3, {}, { directive_id: '' }, { directive_id: '  ' }, { directive_id: 7 }, { payload: { directive_id: null } }]) assert.equal(elementEditDirectiveId(bad), null, JSON.stringify(bad))
})
await check('wire: the result frame is {type:"element_edit_result", payload:{directive_id, ok, error_code?}} (CONTRACT.md §1), the eight codes and no TIMEOUT', async () => {
  deepEqual(on.wire.elementEditResultFrame({ directive_id: 'd', ok: true }), { type: 'element_edit_result', payload: { directive_id: 'd', ok: true } })
  deepEqual(on.wire.elementEditResultFrame({ directive_id: 'd', ok: false, error_code: 'BUSY' }), { type: 'element_edit_result', payload: { directive_id: 'd', ok: false, error_code: 'BUSY' } })
  assert.equal(on.wire.ELEMENT_EDIT_ERROR_CODES.includes('TIMEOUT'), false)
  deepEqual([...on.wire.ELEMENT_EDIT_ERROR_CODES], ['ELEMENT_NOT_FOUND', 'SLIDE_CHANGED', 'UNSUPPORTED_OP', 'INVALID_VALUE', 'ELEMENT_LOCKED', 'VIEWER_NOT_READY', 'BUSY', 'SAVE_FAILED'], 'DIRECTOR-2\'s reserved codes; TIMEOUT is Director\'s own')
})
await check('wire: routeElementEditFrame takes only element_edit, unlocks the turn, and hands the runner the message with its owner', async () => {
  const seen = []
  let unlocked = 0
  const ctx = { sessionId: SESSION, isCurrent: () => true, unlockTurn: () => { unlocked++ }, onDirective: (message, owner) => seen.push({ message, owner }) }
  assert.equal(on.wire.routeElementEditFrame({ type: 'chat_message' }, ctx), false)
  assert.equal(on.wire.routeElementEditFrame(null, ctx), false)
  assert.equal(unlocked, 0); assert.equal(seen.length, 0)
  assert.equal(on.wire.routeElementEditFrame(envelope.frames.delete, ctx), true)
  assert.equal(unlocked, 1); assert.equal(seen.length, 1); assert.equal(seen[0].owner.sessionId, SESSION); assert.equal(seen[0].owner.isCurrent(), true)
  assert.equal(on.wire.routeElementEditFrame({ type: 'element_edit' }, ctx), true, 'consumed even without an id')
  assert.equal(unlocked, 2); assert.equal(seen.length, 1, 'but never run')
})
await check('wire: routeNotesUpdatedFrame takes only deck_mutation notes_updated for the deck on screen; every other mutation carries on', async () => {
  const updates = []
  const ctx = (displayed = { deckOwnerSessionId: SESSION, presentationId: PRESENTATION }, sessionId = SESSION) => ({ sessionId, isCurrent: () => true, displayed, onNotesUpdated: (update, owner) => updates.push({ update, owner }) })
  const { routeNotesUpdatedFrame } = on.wire
  for (const other of [{ type: 'deck_mutation', session_id: SESSION, payload: { mutation: 'slide_added', presentation_id: PRESENTATION, slide_index: 1 } }, { type: 'chat_message', payload: { kind: 'notes_updated' } },
    { type: 'deck_mutation', session_id: SESSION, payload: {} }, null]) assert.equal(routeNotesUpdatedFrame(other, ctx()), false, JSON.stringify(other))
  assert.equal(routeNotesUpdatedFrame(envelope.notes_updated, ctx()), true)
  deepEqual(updates.map(item => item.update), [{ presentationId: PRESENTATION, slideIndex: 1 }])
  assert.equal(routeNotesUpdatedFrame({ ...envelope.notes_updated, payload: { mutation: 'notes_updated', presentation_id: PRESENTATION, slide_index: 2 } }, ctx()), true, 'payload.mutation, deck_mutation\'s own discriminator, and nothing else')
  assert.equal(updates.length, 2)
  for (const notThis of [{ kind: 'notes_updated', presentation_id: PRESENTATION, slide_index: 2 }, { mutation: 'Notes_Updated', presentation_id: PRESENTATION, slide_index: 2 }]) assert.equal(routeNotesUpdatedFrame({ type: 'deck_mutation', session_id: SESSION, payload: notThis }, ctx()), false, JSON.stringify(notThis))
  assert.equal(routeNotesUpdatedFrame({ type: 'deck_mutation', session_id: SESSION, ...envelope.notes_updated.payload }, ctx()), false, 'the mutation is in the payload')
  // Consumed but not acted on: another session, another deck on screen, a bad index.
  assert.equal(routeNotesUpdatedFrame({ ...envelope.notes_updated, session_id: 's_other' }, ctx()), true)
  assert.equal(routeNotesUpdatedFrame(envelope.notes_updated, ctx({ deckOwnerSessionId: SESSION, presentationId: 'pres-other' })), true)
  assert.equal(routeNotesUpdatedFrame(envelope.notes_updated, ctx({ deckOwnerSessionId: 's_other', presentationId: PRESENTATION })), true)
  for (const slide_index of [-1, 1.5, '1', null]) assert.equal(routeNotesUpdatedFrame({ ...envelope.notes_updated, payload: { mutation: 'notes_updated', presentation_id: PRESENTATION, slide_index } }, ctx()), true)
  assert.equal(updates.length, 2, 'none of those reached the panel')
})

// ===== 2. the pure helpers ================================================================================================================
await check('validate: every op, order, place axis, size_step, colour token and alignment; anything else is INVALID_VALUE', async () => {
  const { validateElementEdit } = on.lib
  const okOf = fields => validateElementEdit(fields)
  deepEqual(okOf({ op: 'delete' }), { ok: true, edit: { op: 'delete' } })
  for (const order of ['front', 'back', 'forward', 'backward']) deepEqual(okOf({ op: 'order', order }), { ok: true, edit: { op: 'order', order } })
  for (const h of ['left', 'center', 'right']) deepEqual(okOf({ op: 'place', place: { h } }), { ok: true, edit: { op: 'place', h } })
  for (const v of ['top', 'middle', 'bottom']) deepEqual(okOf({ op: 'place', place: { v } }), { ok: true, edit: { op: 'place', v } })
  deepEqual(okOf({ op: 'place', place: { h: 'right', v: 'bottom' } }), { ok: true, edit: { op: 'place', h: 'right', v: 'bottom' } })
  deepEqual(okOf({ op: 'place', place: { h: 'center', v: undefined } }), { ok: true, edit: { op: 'place', h: 'center' } })
  deepEqual(okOf({ op: 'style', style: { bold: true, italic: false, size_step: -1, color_token: 'accent_1', align: 'right' } }),
    { ok: true, edit: { op: 'style', bold: true, italic: false, sizeStep: -1, binding: 'accent_1', align: 'right' } })
  const invalid = [{}, { op: 'resize' }, { op: 7 }, { op: 'order' }, { op: 'order', order: 'up' }, { op: 'order', order: 'FRONT' }, { op: 'place' }, { op: 'place', place: {} }, { op: 'place', place: { h: undefined } },
    { op: 'place', place: { h: 'centre' } }, { op: 'place', place: { h: 'top' } }, { op: 'place', place: { v: 'left' } }, { op: 'place', place: { v: 'center' } }, { op: 'place', place: { h: 'left', v: 'nowhere' } },
    { op: 'place', place: 'left' }, { op: 'place', place: { anchor: 'left' } }, { op: 'place', place: { h: 'left', x: 1 } }, { op: 'place', place: ['left'] }, { op: 'style' }, { op: 'style', style: {} },
    { op: 'style', style: { underline: true } }, { op: 'style', style: { bold: 'yes' } }, { op: 'style', style: { italic: 1 } }, { op: 'style', style: { size_step: 0 } }, { op: 'style', style: { size_step: 2 } },
    { op: 'style', style: { size_step: '1' } }, { op: 'style', style: { color_token: 'chartreuse' } }, { op: 'style', style: { color_token: '#ff0000' } }, { op: 'style', style: { color_token: 5 } },
    { op: 'style', style: { align: 'justify' } }, { op: 'style', style: { align: 'LEFT' } }, { op: 'style', style: { bold: true, extra: 1 } }]
  for (const fields of invalid) deepEqual(okOf(fields), { ok: false, code: 'INVALID_VALUE' }, JSON.stringify(fields))
})
await check('colour tokens: the deck palette ids Layout stores in theme_bindings (accent_1, text_body ...) or their CSS custom property, as given; nothing else binds', async () => {
  const { paletteBindingFor, PALETTE_IDS } = on.lib
  assert.ok(['primary', 'accent_1', 'accent_2', 'surface', 'text_heading', 'text_body'].every(id => PALETTE_IDS.includes(id)), 'Studio\'s own six are palette ids')
  for (const id of PALETTE_IDS) for (const spelled of [id, `--theme-${id.replace(/_/g, '-')}`]) assert.equal(paletteBindingFor(spelled), spelled, spelled)
  assert.equal(paletteBindingFor(' accent_1 '), 'accent_1', 'trimmed')
  for (const bad of ['', 'accent-1', 'ACCENT_1', 'theme-primary', '--theme-bg', '--theme-accent-3-500', '--theme-font-body', 'font_body', 'red', '#fff', 'url(x)', '--theme-primary; color: red', 'var(--theme-primary)', null, 4]) assert.equal(paletteBindingFor(bad), null, String(bad))
})
await check('place: h / v on the 32 x 18 grid inside the content area (columns 2..32, rows 4..18), size kept, an axis not given stays, 0.2 grid, clamped to the canvas', async () => {
  const { placementFor } = on.lib
  const expected = { left: [undefined, 'left', '4/10', '2/16'], center: [undefined, 'center', '4/10', '10/24'], right: [undefined, 'right', '4/10', '18/32'], top: ['top', undefined, '4/10', '2/16'],
    middle: ['middle', undefined, '8/14', '2/16'], bottom: ['bottom', undefined, '12/18', '2/16'], 'top-left': ['top', 'left', '4/10', '2/16'], 'top-right': ['top', 'right', '4/10', '18/32'],
    'bottom-left': ['bottom', 'left', '12/18', '2/16'], 'bottom-right': ['bottom', 'right', '12/18', '18/32'], 'center-middle': ['middle', 'center', '8/14', '10/24'] }
  for (const [name, [v, h, row, column]] of Object.entries(expected)) deepEqual(placementFor(h, v, '4/10', '2/16'), { gridRow: row, gridColumn: column }, name)
  deepEqual(placementFor('center', undefined, '5/8', '3.4/9.4'), { gridRow: '5/8', gridColumn: '14/20' }, 'a 6-wide box centres at 14..20')
  deepEqual(placementFor(undefined, 'middle', '5/8.2', '3/8'), { gridRow: '9.4/12.6', gridColumn: '3/8' }, 'minor grid: 3.2 tall, centred in rows 4..18')
  deepEqual(placementFor('right', undefined, '4/10', '1/33'), { gridRow: '4/10', gridColumn: '1/33' }, 'wider than the canvas stays on it')
  deepEqual(placementFor('right', 'bottom', '1/19', '2/16'), { gridRow: '1/19', gridColumn: '18/32' }, 'taller than the area stays on the canvas')
  for (const [row, column] of [[null, '2/16'], ['4/10', null], ['x/10', '2/16'], ['10/4', '2/16'], ['4/10', '2']]) assert.equal(placementFor('left', undefined, row, column), null, `${row} ${column}`)
  assert.equal(placementFor(undefined, undefined, '4/10', '2/16'), null, 'at least one axis')
})
await check('size_step: one place along Studio\'s own font size list; the ends stay; an unreadable size is null', async () => {
  const { steppedFontSize, fontSizeFromFormatting, FONT_SIZE_STEPS } = on.lib
  deepEqual([...FONT_SIZE_STEPS], [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96, 115, 120])
  assert.equal(steppedFontSize(24, 1), 28); assert.equal(steppedFontSize(24, -1), 20); assert.equal(steppedFontSize(25, 1), 28); assert.equal(steppedFontSize(25, -1), 24)
  assert.equal(steppedFontSize(120, 1), 120); assert.equal(steppedFontSize(12, -1), 12); assert.equal(steppedFontSize(8, -1), 12); assert.equal(steppedFontSize(200, 1), 120)
  for (const bad of [null, NaN, 0, -3]) assert.equal(steppedFontSize(bad, 1), null)
  assert.equal(fontSizeFromFormatting({ formatting: { fontSize: '24px' } }), 24); assert.equal(fontSizeFromFormatting({ formatting: { fontSize: '18pt' } }), 18)
  assert.equal(fontSizeFromFormatting({ formatting: { fontSize: 30 } }), 30); assert.equal(fontSizeFromFormatting({ formatting: {} }), null); assert.equal(fontSizeFromFormatting(null), null)
})
await check('plan: each op is a viewer command Layout has, Arrange commands always with intent \'arrange\'; what Layout cannot do stays UNSUPPORTED_OP (italic, style on non-text)', async () => {
  const { planViewerSteps, VIEWER_COMMANDS, ARRANGE_INTENT } = on.lib
  assert.equal(ARRANGE_INTENT, 'arrange')
  const text = { elementId: 'e', rendererType: 'textbox', componentType: 'TEXT_BOX', locked: false, gridRow: '4/10', gridColumn: '2/16' }
  const chart = { ...text, rendererType: 'chart', componentType: 'CHART' }
  const metrics = { ...text, componentType: 'METRICS' }
  const plan = (edit, element, size = 24) => planViewerSteps(edit, element, size)
  const arrange = (action, extra = {}) => ({ route: 'element', action, params: { elementId: 'e', ...extra, intent: 'arrange' } })
  deepEqual(plan({ op: 'delete' }, chart), { ok: true, steps: [{ route: 'element', action: 'deleteElement', params: { elementId: 'e' } }] })
  // order: a text box keeps its own front / back; every other element, and forward / backward of every element, is an Arrange command.
  deepEqual(plan({ op: 'order', order: 'front' }, text).steps, [{ route: 'textbox', action: 'bringTextBoxToFront', params: { elementId: 'e' } }])
  deepEqual(plan({ op: 'order', order: 'back' }, metrics).steps, [{ route: 'textbox', action: 'sendTextBoxToBack', params: { elementId: 'e' } }])
  deepEqual(plan({ op: 'order', order: 'front' }, chart).steps, [arrange('bringToFront')])
  deepEqual(plan({ op: 'order', order: 'back' }, chart).steps, [arrange('sendToBack')])
  for (const element of [text, chart]) {
    deepEqual(plan({ op: 'order', order: 'forward' }, element).steps, [arrange('bringForward')])
    deepEqual(plan({ op: 'order', order: 'backward' }, element).steps, [arrange('sendBackward')])
  }
  // place: a text box moves inside the content area (resizeTextBox); anything else aligns to the slide (alignElement).
  deepEqual(plan({ op: 'place', h: 'right' }, text).steps, [{ route: 'textbox', action: 'resizeTextBox', params: { elementId: 'e', gridRow: '4/10', gridColumn: '18/32' } }])
  deepEqual(plan({ op: 'place', h: 'center', v: 'middle' }, text).steps, [{ route: 'textbox', action: 'resizeTextBox', params: { elementId: 'e', gridRow: '8/14', gridColumn: '10/24' } }])
  deepEqual(plan({ op: 'place', v: 'bottom' }, metrics).ok, true, 'a textbox-rendered element has resizeTextBox')
  deepEqual(plan({ op: 'place', h: 'right' }, chart).steps, [arrange('alignElement', { horizontal: 'right' })])
  deepEqual(plan({ op: 'place', v: 'top' }, chart).steps, [arrange('alignElement', { vertical: 'top' })])
  deepEqual(plan({ op: 'place', h: 'left', v: 'middle' }, chart).steps, [arrange('alignElement', { horizontal: 'left', vertical: 'middle' })])
  deepEqual(plan({ op: 'place', h: 'right' }, { ...text, gridRow: null }), { ok: false, code: 'UNSUPPORTED_OP' }, 'a text box the viewer cannot report')
  deepEqual(plan({ op: 'style', bold: true, sizeStep: 1, binding: 'accent_1', align: 'center' }, text).steps.map(step => [step.action, step.params]),
    [['setTextBoxFontWeight', { elementId: 'e', fontWeight: '700' }], ['setTextBoxFontSize', { elementId: 'e', fontSize: 28 }], ['setTextBoxColor', { elementId: 'e', themeBinding: 'accent_1' }], ['setTextBoxAlignment', { elementId: 'e', alignment: 'center' }]])
  deepEqual(plan({ op: 'style', bold: false }, text).steps[0].params.fontWeight, '400')
  for (const edit of [{ op: 'style', italic: true }, { op: 'style', italic: false }, { op: 'style', bold: true, italic: true }]) deepEqual(plan(edit, text), { ok: false, code: 'UNSUPPORTED_OP' }, `italic is never faked: ${JSON.stringify(edit)}`)
  for (const element of [chart, metrics]) deepEqual(plan({ op: 'style', bold: true }, element), { ok: false, code: 'UNSUPPORTED_OP' }, element.componentType)
  deepEqual(plan({ op: 'style', sizeStep: 1 }, text, null), { ok: false, code: 'UNSUPPORTED_OP' }, 'an unreadable size')
  // Every Arrange command in a plan carries the intent; nothing that rotates, flips, locks, resizes or sets classes is ever planned.
  const everyPlan = []
  for (const element of [text, chart, metrics]) {
    for (const order of ['front', 'back', 'forward', 'backward']) everyPlan.push(plan({ op: 'order', order }, element))
    for (const place of [{ h: 'left' }, { v: 'top' }, { h: 'center', v: 'middle' }]) everyPlan.push(plan({ op: 'place', ...place }, element))
    everyPlan.push(plan({ op: 'delete' }, element), plan({ op: 'style', bold: true, sizeStep: -1, binding: 'primary', align: 'left' }, element))
  }
  const ARRANGE = ['bringToFront', 'sendToBack', 'bringForward', 'sendBackward', 'alignElement', 'positionElement', 'resizeElement', 'rotateElement', 'flipElement', 'lockElement', 'setElementClasses']
  for (const result of everyPlan) for (const step of result.steps ?? []) {
    if (ARRANGE.includes(step.action)) assert.equal(step.params.intent, 'arrange', `${step.action} carries the intent`)
    else assert.equal('intent' in step.params, false, `${step.action} is not an Arrange command`)
    assert.equal(['positionElement', 'resizeElement', 'rotateElement', 'flipElement', 'lockElement', 'setElementClasses', 'applyTextFormatCommand', 'formatText'].includes(step.action), false, step.action)
  }
  assert.deepEqual(Object.values(VIEWER_COMMANDS).filter(name => ARRANGE.includes(name)).sort(), ['alignElement', 'bringForward', 'bringToFront', 'sendBackward', 'sendToBack'])
})
await check('viewer errors: the reply\'s error text maps to a code, never to success', async () => {
  const { elementEditCommandErrorCode: code } = on.lib
  const expectations = { 'Command timeout': 'VIEWER_NOT_READY', 'Iframe not ready': 'VIEWER_NOT_READY', 'The presentation viewer is unavailable.': 'VIEWER_NOT_READY', 'view-only': 'ELEMENT_LOCKED',
    'Unknown action: bringForward': 'UNSUPPORTED_OP', 'RECREATE_REQUIRED: render edited typed params': 'UNSUPPORTED_OP', 'Element not found': 'ELEMENT_NOT_FOUND', 'Text box not found': 'ELEMENT_NOT_FOUND',
    'Text box content not found': 'ELEMENT_NOT_FOUND', 'elementId and fontSize parameters required': 'UNSUPPORTED_OP', 'something else': 'UNSUPPORTED_OP', '': 'UNSUPPORTED_OP',
    // Arrange's own answers (arrange-commands.js)
    'Element is locked': 'ELEMENT_LOCKED', 'This element cannot be moved': 'ELEMENT_LOCKED', 'Edit mode required': 'VIEWER_NOT_READY', 'z-order not supported for this element yet': 'UNSUPPORTED_OP',
    'alignElement not supported for this element yet': 'UNSUPPORTED_OP', 'The change was applied but could not be marked for saving': 'SAVE_FAILED', 'Element is not on a slide': 'UNSUPPORTED_OP' }
  for (const [message, expected] of Object.entries(expectations)) assert.equal(code(new Error(message)), expected, message)
  assert.equal(code('Command timeout'), 'VIEWER_NOT_READY'); assert.equal(code(null), 'UNSUPPORTED_OP'); assert.equal(code({}), 'UNSUPPORTED_OP')
})
await check('gate: one at a time, a repeated directive_id is never admitted twice', async () => {
  const gate = on.lib.createElementEditGate(3)
  assert.equal(gate.admit('a'), 'run'); assert.equal(gate.admit('b'), 'busy'); assert.equal(gate.admit('a'), 'duplicate', 'a repeat of the running directive is not BUSY: it is ignored')
  assert.equal(gate.admit('b'), 'duplicate', 'a repeat of a busy directive is ignored too (one BUSY answer)')
  gate.done('a'); assert.equal(gate.admit('c'), 'run'); gate.done('b'); assert.equal(gate.admit('c'), 'duplicate'); gate.done('c')
  assert.equal(gate.admit('d'), 'run'); gate.done('d'); assert.equal(gate.admit('a'), 'run', 'the oldest id aged out of a 3-entry memory'); gate.done('a')
})
async function saveWatchChecks(saveModule) {
  const { watchViewerSave } = saveModule
  const clock = createClock()
  const timers = { setTimer: (fn, ms) => clock.setTimeout(fn, ms), clearTimer: id => clock.clearTimeout(id) }
  const run = async (events, timeoutMs = 1000) => {
    let emit = () => {}
    const watch = watchViewerSave(listener => { emit = listener; return () => { emit = () => {} } }, timers)
    const outcome = watch.settled(timeoutMs)
    for (const event of events) { emit(event); await clock.advance(1) }
    return clock.drive(outcome, { stepMs: 100, maxMs: 5000 })
  }
  const E = (status, hasPendingChanges = status !== 'saved') => ({ status, hasPendingChanges })
  assert.equal(await run([E('unsaved'), E('saving'), E('saved')]), 'saved')
  assert.equal(await run([E('saved'), E('unsaved'), E('saved')]), 'saved', 'a saved before the change is ignored, the later one counts')
  assert.equal(await run([E('saved')]), 'timeout', 'a change the viewer never tracked is not saved')
  assert.equal(await run([E('unsaved'), E('saving')]), 'timeout')
  assert.equal(await run([E('unsaved'), E('saving'), E('error')]), 'error')
  assert.equal(await run([E('unsaved'), E('saved', true)]), 'timeout', 'saved with changes still pending (a newer edit) is not the ack')
  assert.equal(await run([E('unsaved'), E('saved', null)]), 'saved', 'no pending flag in the message: saved is saved')
  assert.equal(await run([E('error'), E('unsaved'), E('saved')]), 'saved', 'an error before tracking is not this change\'s')
  // settled() after the answer arrived, and a watch that was closed.
  let emit = () => {}; let closed = 0
  const early = watchViewerSave(listener => { emit = listener; return () => { closed++ } }, timers)
  emit(E('unsaved')); emit(E('saved'))
  assert.equal(await early.settled(1000), 'saved'); assert.ok(closed >= 1)
}
await check('save watch: ack = a saved with nothing pending AFTER the change was tracked; an earlier saved, an untracked change and a failed save are not acks', async () => { await saveWatchChecks(on.save) })

// ===== 3. the runner against the real viewer ==================================================================================================
const SAVE_ACK = result => result?.ok === true
await check('delete: deleteElement through the router, the viewer\'s Save, and ok:true only after Layout\'s saved ack (edit mode entered the way a selection does)', async () => {
  const studio = await scenario('delete', frameOf('delete'))
  deepEqual(studio.result, { directive_id: studio.result.directive_id, ok: true })
  deepEqual(studio.requests().map(r => r.action), ['getSlideGenerationContext', 'isEditModeActive', 'enterEditMode', 'deleteElement', 'saveAllChanges'])
  deepEqual(studio.requests()[0].params, { slideIndex: 0, targetElementId: 'el_chart_b' })
  deepEqual(studio.requests()[3].params, { elementId: 'el_chart_b' })
  deepEqual(studio.routes.filter(([route]) => route === 'element').map(([, action, type]) => [action, type]), [['getSlideGenerationContext', 'layout-service'], ['deleteElement', 'layout-service']])
  deepEqual(studio.editState.entered, [true], 'the viewer\'s React edit mode state follows')
  const ack = studio.published.filter(event => event.status === 'saved' && event.pending === false).at(-1)
  assert.ok(ack, 'Layout acknowledged the save'); assert.ok(studio.sentResults[0].at >= ack.at, 'the result was sent after the ack')
  deepEqual(studio.published.map(event => event.status).slice(-3), ['unsaved', 'saving', 'saved'])
  assert.equal(studio.sentResults.length, 1, 'exactly one result')
  if (LIVE) { assert.equal(studio.viewer.registryHas('el_chart_b'), false, 'Layout removed the element'); assert.equal(studio.put.requests.length, 1, 'one PUT') }
})
await check('ok only after the save ack: with the autosave PUT held, no result; once Layout acknowledges, ok:true', async () => {
  const studio = await scenario('hold', null, { put: 'hold', editMode: true, manual: true })
  const message = frameOf('delete')
  const mark = studio.published.length
  studio.runner(plain(message), studio.ownerHandle)
  await studio.clock.advance(3900)
  assert.equal(studio.sentResults.length, 0, 'applied, flushed, but not acknowledged: nothing is sent')
  assert.ok(studio.actions().includes('deleteElement') && studio.actions().includes('saveAllChanges'))
  assert.equal(studio.published.slice(mark).some(event => event.status === 'saved'), false, 'Layout has not acknowledged')
  await studio.clock.advance(100) // the PUT is still held: time alone acknowledges nothing (offline, Layout's recorded ack is due now)
  studio.put.release()
  await studio.clock.advance(1000)
  deepEqual(studio.sentResults.map(item => item.result), [{ directive_id: idOf(message), ok: true }])
  assert.ok(studio.sentResults[0].at >= 3900, 'after the ack, not before')
})
await check('SAVE_FAILED: applied, the autosave refused (Layout\'s error ack), so ok:false and no ok:true', async () => {
  const studio = await scenario('save-failed', frameOf('delete'), { put: 'fail', editMode: true })
  deepEqual(studio.result, { directive_id: studio.result.directive_id, ok: false, error_code: 'SAVE_FAILED' })
  assert.equal(studio.published.at(-1).status, 'error')
  assert.equal(studio.sentResults.length, 1)
})
await check('SAVE_FAILED: no ack within the budget (a z-order change the flush never reaches is never tracked): ok:false after 20 s of virtual time, never ok:true', async () => {
  const studio = await scenario('no-ack', null, { editMode: true, manual: true })
  const real = studio.apis.sendTextBoxCommand
  studio.apis.sendTextBoxCommand = (action, params) => action === 'saveAllChanges' ? Promise.resolve({ success: true }) : real(action, params)
  const result = await studio.send(frameOf('order_front'))
  deepEqual(result, { directive_id: result.directive_id, ok: false, error_code: 'SAVE_FAILED' })
  assert.ok(studio.sentResults[0].at >= 20_000 && studio.sentResults[0].at < 21_000, `sent at ${studio.sentResults[0].at}`)
  assert.equal(studio.published.some(event => event.status === 'unsaved'), false, 'Layout never tracked it, so nothing could have saved it')
})
await check('order front / back of a text box: bringTextBoxToFront / sendTextBoxToBack (no unsaved from Layout: the runner\'s flush is what tracks and saves the change)', async () => {
  for (const key of ['order_front', 'order_back']) {
    const studio = await scenario(key, frameOf(key), { editMode: true })
    assert.equal(studio.result.ok, true, key)
    deepEqual(studio.actions(), ['getSlideGenerationContext', 'isEditModeActive', key === 'order_front' ? 'bringTextBoxToFront' : 'sendTextBoxToBack', 'saveAllChanges'])
    const order = studio.published.map(event => event.status)
    assert.equal(order.indexOf('unsaved') > -1, true, 'the flush marked it unsaved')
    if (LIVE) {
      const z = Number(studio.viewer.nodeById('el_text_a').style.zIndex)
      assert.ok(key === 'order_front' ? z > 100 : z < 100, `z-index ${z}`)
      assert.equal(studio.put.requests.length, 1)
    }
  }
})
/** The viewer's last reply to a command: what Layout answered, from its log (live or replayed). */
const replyOf = (studio, action) => studio.viewer.log.frames.map(frame => frame.data).filter(data => data.action === action).at(-1)
await check('order front / back of a non-text element, forward / backward of any: Layout\'s Arrange commands, every one with intent \'arrange\' (!261); the order Layout reports is the one asked for', async () => {
  const cases = [
    ['order-front-chart', frameOf('order_front', { element_id: 'el_chart_b' }), 'bringToFront', 'el_chart_b', order => order.at(-1) === 'el_chart_b'],
    ['order-back-chart', frameOf('order_back', { element_id: 'el_chart_b' }), 'sendToBack', 'el_chart_b', order => order[0] === 'el_chart_b'],
    ['order-forward-text', frameOf('order_forward'), 'bringForward', 'el_text_a', order => order.indexOf('el_text_a') === 1],
    ['order-forward-chart', frameOf('order_forward', { element_id: 'el_chart_b' }), 'bringForward', 'el_chart_b', order => order.indexOf('el_chart_b') === 3],
    ['order-backward-text', frameOf('order_backward', { element_id: 'el_metrics_c' }), 'sendBackward', 'el_metrics_c', order => order.indexOf('el_metrics_c') === 2],
    ['order-backward-chart', frameOf('order_backward', { element_id: 'el_chart_b' }), 'sendBackward', 'el_chart_b', order => order.indexOf('el_chart_b') === 1],
  ]
  for (const [name, frame, command, elementId, inOrder] of cases) {
    const studio = await scenario(name, frame, { editMode: true })
    assert.equal(studio.result.ok, true, `${name} ${JSON.stringify(studio.result)}`)
    deepEqual(studio.requests(), [{ action: 'getSlideGenerationContext', params: { slideIndex: 0, targetElementId: elementId } }, { action: 'isEditModeActive', params: null },
      { action: command, params: { elementId, intent: 'arrange' } }, { action: 'saveAllChanges', params: {} }], name)
    assert.deepEqual(studio.routes.filter(([, action]) => action === command).map(([route, , type]) => [route, type]), [['element', 'layout-service']], 'through the element router, as the Arrange tab sends it')
    const reply = replyOf(studio, command)
    assert.equal(reply.success, true); assert.equal(reply.changed, true); assert.ok(inOrder(reply.zOrder), `${name}: the paint order Layout reports ${reply.zOrder}`)
    assert.equal(studio.published.slice(-3).map(event => event.status).join(), 'unsaved,saving,saved')
    if (LIVE) assert.equal(studio.put.requests.length, 1)
  }
})
await check('order forward / backward with Layout\'s Arrange flag off, and the raw command without the intent: "Unknown action", so UNSUPPORTED_OP and nothing changes', async () => {
  for (const [name, frame] of [['order-forward-flag-off', frameOf('order_forward')], ['order-front-chart-flag-off', frameOf('order_front', { element_id: 'el_chart_b' })]]) {
    const studio = await scenario(name, frame, { editMode: true, arrange: false })
    deepEqual(studio.result, { directive_id: studio.result.directive_id, ok: false, error_code: 'UNSUPPORTED_OP' }, name)
    deepEqual(studio.actions().slice(0, 2), ['getSlideGenerationContext', 'isEditModeActive']); assert.equal(studio.actions().includes('saveAllChanges'), false, 'nothing was applied, so nothing is flushed')
    assert.match(replyOf(studio, name === 'order-forward-flag-off' ? 'bringForward' : 'bringToFront').error, /^Unknown action: /)
  }
  const text = await scenario('order-front-text-flag-off', frameOf('order_front'), { editMode: true, arrange: false })
  assert.equal(text.result.ok, true, 'a text box keeps its own front command: it does not need the flag')
  const legacy = await scenario('no-intent', null, { editMode: true, manual: true })
  for (const action of ['bringToFront', 'sendToBack', 'bringForward', 'sendBackward', 'alignElement']) {
    await assert.rejects(legacy.apis.sendElementCommand(action, { elementId: 'el_chart_b', horizontal: 'center' }), new RegExp(`^Error: Unknown action: ${action}$`), `${action} without the intent is the old no-op`)
  }
  await legacy.clock.advance(10)
  assert.equal(legacy.published.filter(event => event.status !== 'saved').length, 0, 'nothing changed, nothing was marked for saving')
  if (LIVE) assert.equal(legacy.viewer.nodeById('el_chart_b').style.zIndex, '100')
  await legacy.apis.sendElementCommand('bringToFront', { elementId: 'el_chart_b', intent: 'arrange' })
  await legacy.clock.advance(10)
  assert.equal(replyOf(legacy, 'bringToFront').success, true, 'with the intent the same command acts')
})
await check('place: h / v through resizeTextBox on a text box; the viewer ends with the box where they say (live) and every request equals the expected one', async () => {
  const expected = { left: ['4/10', '2/16'], center: ['4/10', '10/24'], right: ['4/10', '18/32'], top: ['4/10', '2/16'], middle: ['8/14', '2/16'], bottom: ['12/18', '2/16'],
    'top-left': ['4/10', '2/16'], 'top-right': ['4/10', '18/32'], 'bottom-left': ['12/18', '2/16'], 'bottom-right': ['12/18', '18/32'], 'center-middle': ['8/14', '10/24'] }
  for (const [name, [gridRow, gridColumn]] of Object.entries(expected)) {
    const studio = await scenario(`place-${name}`, frameOf(`place_${name}`), { editMode: true })
    assert.equal(studio.result.ok, true, name)
    deepEqual(lastRequestFor(studio, 'resizeTextBox'), { action: 'resizeTextBox', params: { elementId: 'el_text_a', gridRow, gridColumn } }, name)
    deepEqual(studio.routes.find(([, action]) => action === 'resizeTextBox').slice(0, 2), ['textbox', 'resizeTextBox'])
    if (LIVE) {
      const GC = studio.viewer.context.GridConverter, node = studio.viewer.nodeById('el_text_a')
      deepEqual([GC.toLogical(node.style.gridRow), GC.toLogical(node.style.gridColumn)], [gridRow, gridColumn], `Layout moved the box: ${name}`)
    }
  }
})
await check('place on a non-text element: alignElement with intent \'arrange\' (to the slide\'s edges / centre); a metrics card is textbox-rendered and is moved like a text box', async () => {
  const cases = [
    ['place-chart-right', frameOf('place_right', { element_id: 'el_chart_b' }), { horizontal: 'right' }, '4/14', '19/33'],
    ['place-chart-top', frameOf('place_top', { element_id: 'el_chart_b' }), { vertical: 'top' }, '1/11', '18/32'],
    ['place-chart-center-middle', frameOf('place_center-middle', { element_id: 'el_chart_b' }), { horizontal: 'center', vertical: 'middle' }, '5/15', '10/24'],
    ['place-image-bottom-left', frameOf('place_bottom-left', { element_id: 'el_image_e' }), { horizontal: 'left', vertical: 'bottom' }, '13/19', '1/11'],
  ]
  for (const [name, frame, axes, gridRow, gridColumn] of cases) {
    const studio = await scenario(name, frame, { editMode: true })
    assert.equal(studio.result.ok, true, `${name} ${JSON.stringify(studio.result)}`)
    const elementId = frame.payload.element_id
    deepEqual(studio.requests().slice(1), [{ action: 'isEditModeActive', params: null }, { action: 'alignElement', params: { elementId, ...axes, intent: 'arrange' } }, { action: 'saveAllChanges', params: {} }], name)
    const reply = replyOf(studio, 'alignElement')
    assert.equal(reply.success, true); deepEqual([reply.gridRow, reply.gridColumn], [gridRow, gridColumn], `${name}: where Layout put it`)
    assert.equal(studio.actions().includes('resizeTextBox'), false)
  }
  const metrics = await scenario('place-metrics', frameOf('place_left', { element_id: 'el_metrics_c' }), { editMode: true })
  assert.equal(metrics.result.ok, true); deepEqual(lastRequestFor(metrics, 'resizeTextBox').params, { elementId: 'el_metrics_c', gridRow: '11/17', gridColumn: '2/20' })
})
await check('what Arrange refuses stays UNSUPPORTED_OP (a table is never saved by the autosave), a locked or undraggable element is ELEMENT_LOCKED; nothing is flushed after a refusal', async () => {
  for (const [name, frame, command] of [['place-table', frameOf('place_left', { element_id: 'el_table_d' }), 'alignElement'], ['order-front-table', frameOf('order_front', { element_id: 'el_table_d' }), 'bringToFront'],
    ['order-forward-table', frameOf('order_forward', { element_id: 'el_table_d' }), 'bringForward']]) {
    const studio = await scenario(name, frame, { editMode: true })
    deepEqual(studio.result, { directive_id: studio.result.directive_id, ok: false, error_code: 'UNSUPPORTED_OP' }, name)
    deepEqual(studio.actions(), ['getSlideGenerationContext', 'isEditModeActive', command]); assert.match(replyOf(studio, command).error, /not supported for this element yet$/)
    assert.equal(studio.published.filter(event => event.status !== 'saved').length, 0, 'nothing was marked changed')
  }
  for (const [name, frame, command] of [['place-chart-class-locked', frameOf('place_left', { element_id: 'el_chart_locked' }), 'alignElement'], ['place-slot-fixed', frameOf('place_left', { element_id: 'el_slot_fixed' }), 'alignElement']]) {
    const studio = await scenario(name, frame, { editMode: true })
    deepEqual(studio.result, { directive_id: studio.result.directive_id, ok: false, error_code: 'ELEMENT_LOCKED' }, name)
    deepEqual(studio.actions(), ['getSlideGenerationContext', 'isEditModeActive', command]); assert.match(replyOf(studio, command).error, /^(Element is locked|This element cannot be moved)$/)
  }
  const del = await scenario('delete-table', frameOf('delete', { element_id: 'el_table_d' }), { editMode: true })
  assert.equal(del.result.ok, true, 'delete serves every element')
})
await check('style: bold, size_step +1 / -1 (read with getTextBoxFormatting), colour (theme binding), alignment, and all four together, each through its text box command', async () => {
  const cases = [
    ['style-bold', frameOf('style_bold'), [['setTextBoxFontWeight', { elementId: 'el_text_a', fontWeight: '700' }]]],
    ['style-size-up', frameOf('style_size_up'), [['getTextBoxFormatting', { elementId: 'el_text_a' }], ['setTextBoxFontSize', { elementId: 'el_text_a', fontSize: 28 }]]],
    ['style-size-down', frameOf('style_size_down'), [['getTextBoxFormatting', { elementId: 'el_text_a' }], ['setTextBoxFontSize', { elementId: 'el_text_a', fontSize: 20 }]]],
    ['style-color', frameOf('style_color'), [['setTextBoxColor', { elementId: 'el_text_a', themeBinding: 'accent_1' }]]],
    ['style-align', frameOf('style_align'), [['setTextBoxAlignment', { elementId: 'el_text_a', alignment: 'center' }]]],
    ['style-all', frameOf('style_bold', { style: { bold: false, size_step: 1, color_token: 'text_body', align: 'right' } }),
      [['getTextBoxFormatting', { elementId: 'el_text_a' }], ['setTextBoxFontWeight', { elementId: 'el_text_a', fontWeight: '400' }], ['setTextBoxFontSize', { elementId: 'el_text_a', fontSize: 28 }],
        ['setTextBoxColor', { elementId: 'el_text_a', themeBinding: 'text_body' }], ['setTextBoxAlignment', { elementId: 'el_text_a', alignment: 'right' }]]],
  ]
  for (const [name, frame, commands] of cases) {
    const studio = await scenario(name, frame, { editMode: true })
    assert.equal(studio.result.ok, true, `${name} ${JSON.stringify(studio.result)}`)
    deepEqual(studio.requests().filter(r => r.action !== 'isEditModeActive').slice(1, -1).map(r => [r.action, r.params]), commands, name)
    assert.equal(studio.actions().at(-1), 'saveAllChanges')
    assert.equal(studio.routes.filter(([route]) => route === 'element').length, 1, 'only the read goes through the element router')
    if (LIVE && name === 'style-bold') assert.equal(studio.viewer.nodeById('el_text_a').children[0].style.fontWeight, '700')
    if (LIVE && name === 'style-size-up') assert.equal(studio.viewer.nodeById('el_text_a').children[0].style.fontSize, '28px')
  }
})
await check('style: italic is UNSUPPORTED_OP (no whole-box italic setter in Layout), and so is style on a chart or a metrics card; nothing is applied', async () => {
  for (const [name, frame] of [['style-italic', frameOf('style_italic')], ['style-chart', frameOf('style_bold', { element_id: 'el_chart_b' })], ['style-metrics', frameOf('style_bold', { element_id: 'el_metrics_c' })],
    ['style-bold-italic', frameOf('style_bold', { style: { bold: true, italic: true } })]]) {
    const studio = await scenario(name, frame, { editMode: true })
    deepEqual(studio.result, { directive_id: studio.result.directive_id, ok: false, error_code: 'UNSUPPORTED_OP' }, name)
    deepEqual(studio.actions(), ['getSlideGenerationContext'], `${name}: nothing applied`)
  }
})
await check('errors: ELEMENT_NOT_FOUND (Layout\'s own "was not found on slide"), ELEMENT_LOCKED, INVALID_VALUE (nothing reaches the viewer), SLIDE_CHANGED, VIEWER_NOT_READY', async () => {
  const gone = await scenario('not-found', frameOf('delete', { element_id: 'el_nope' }), { editMode: true })
  assert.equal(errorOf(gone.result), 'ELEMENT_NOT_FOUND'); deepEqual(gone.actions(), ['getSlideGenerationContext'])
  const otherSlide = await scenario('not-found-slide', frameOf('delete', { slide_index: 1, slide_id: 'L1', element_id: 'el_chart_b' }), { editMode: true, page: { current: 1 } })
  assert.equal(errorOf(otherSlide.result), 'ELEMENT_NOT_FOUND', 'the element is on slide 0, not slide 1')
  const locked = await scenario('locked', frameOf('delete', { element_id: 'el_text_locked' }), { editMode: true })
  assert.equal(errorOf(locked.result), 'ELEMENT_LOCKED'); deepEqual(locked.actions(), ['getSlideGenerationContext'])
  for (const [name, overrides] of [['invalid-op', { op: 'explode' }], ['invalid-order', { op: 'order', order: 'sideways' }], ['invalid-place', { op: 'place', place: { h: 'nowhere' } }], ['invalid-place-empty', { op: 'place', place: {} }],
    ['invalid-step', { op: 'style', style: { size_step: 3 } }], ['invalid-color', { op: 'style', style: { color_token: 'plaid' } }], ['invalid-align', { op: 'style', style: { align: 'justify' } }]]) {
    const studio = await scenario(name, frameOf('delete', overrides), { editMode: true })
    assert.equal(errorOf(studio.result), 'INVALID_VALUE', name); deepEqual(studio.actions(), [], `${name}: the viewer is never touched`)
  }
  const changed = await scenario('slide-changed', frameOf('delete', { slide_id: 'L9' }), { editMode: true })
  assert.equal(errorOf(changed.result), 'SLIDE_CHANGED'); deepEqual(changed.actions(), [])
  const removed = await scenario('slide-gone', frameOf('delete', { slide_index: 7, slide_id: null }), { editMode: true })
  assert.equal(errorOf(removed.result), 'SLIDE_CHANGED', 'beyond the deck')
  const deckChanged = await scenario('deck-changed', frameOf('delete', { presentation_id: 'pres-other' }), { editMode: true })
  assert.equal(errorOf(deckChanged.result), 'SLIDE_CHANGED')
  const notReady = await scenario('not-ready', frameOf('delete'), { page: { noViewer: true } })
  assert.equal(errorOf(notReady.result), 'VIEWER_NOT_READY'); deepEqual(notReady.actions(), [])
  const paused = await scenario('paused', frameOf('delete'), { page: { paused: true } })
  assert.equal(errorOf(paused.result), 'VIEWER_NOT_READY')
  const template = await scenario('template-mode', frameOf('delete'), { page: { templateMode: true }, editMode: true })
  assert.equal(errorOf(template.result), 'ELEMENT_LOCKED'); deepEqual(template.actions(), ['getSlideGenerationContext'])
  const noElementId = await scenario('no-element-id', frameOf('delete', { element_id: '' }), {})
  assert.equal(errorOf(noElementId.result), 'ELEMENT_NOT_FOUND')
  const longId = await scenario('long-id', frameOf('delete', { element_id: 'e'.repeat(129) }), {})
  assert.equal(errorOf(longId.result), 'ELEMENT_NOT_FOUND')
  const badIndex = await scenario('bad-index', frameOf('delete', { slide_index: -1 }), {})
  assert.equal(errorOf(badIndex.result), 'INVALID_VALUE')
})
await check('a view-only viewer refuses the read: ELEMENT_LOCKED, nothing applied', async () => {
  const studio = await scenario('view-only', frameOf('delete'), { viewOnly: true })
  assert.equal(errorOf(studio.result), 'ELEMENT_LOCKED'); deepEqual(studio.actions(), ['getSlideGenerationContext'])
})
await check('navigation: a directive for another slide goes there first (goToSlide, then a settle), and SLIDE_CHANGED when the viewer cannot navigate', async () => {
  const studio = await scenario('goto', frameOf('delete', { slide_index: 0, slide_id: 'L0' }), { editMode: true, page: { current: 2 } })
  assert.equal(studio.result.ok, true); assert.equal(studio.slideState.current, 0, 'the viewer was moved to the directive\'s slide')
  const stuck = await scenario('goto-missing', frameOf('delete'), { page: { current: 2, noGoTo: true } })
  assert.equal(errorOf(stuck.result), 'SLIDE_CHANGED'); deepEqual(stuck.actions(), [])
})
await check('one result per directive: a repeat while it runs and after it ran sends nothing more; a second edit while one runs is BUSY (one answer, the first still ok)', async () => {
  const studio = await scenario('busy', null, { put: 'hold', editMode: true, manual: true })
  const first = frameOf('delete'), second = frameOf('order_front', { element_id: 'el_text_a' })
  studio.runner(plain(first), studio.ownerHandle)
  await studio.clock.advance(500)
  studio.runner(plain(second), studio.ownerHandle)
  await studio.clock.advance(500)
  studio.runner(plain(first), studio.ownerHandle)
  studio.runner(plain(second), studio.ownerHandle)
  await studio.clock.advance(400)
  deepEqual(studio.sentResults.map(item => item.result), [{ directive_id: idOf(second), ok: false, error_code: 'BUSY' }], 'BUSY once, the repeats are silent, the first is still saving')
  await studio.clock.advance(100)
  studio.put.release()
  await studio.clock.advance(1000)
  deepEqual(studio.sentResults.map(item => item.result), [{ directive_id: idOf(second), ok: false, error_code: 'BUSY' }, { directive_id: idOf(first), ok: true }])
  studio.runner(plain(first), studio.ownerHandle)
  await studio.clock.advance(1000)
  assert.equal(studio.sentResults.length, 2, 'after it finished, a repeat is still not run again')
  deepEqual(studio.actions().filter(action => action === 'deleteElement'), ['deleteElement'], 'deleted once')
  assert.equal(studio.actions().includes('bringTextBoxToFront'), false, 'the busy one never touched the viewer')
})
await check('a stale socket or owner sends nothing: a closed socket, another session, another deck on screen, a deck switch mid-run (and nothing is applied after the switch)', async () => {
  const staleSocket = await scenario('stale-socket', null, { editMode: true, manual: true })
  staleSocket.ownerHandle.current = false
  staleSocket.runner(plain(frameOf('delete')), staleSocket.ownerHandle); await staleSocket.clock.advance(2000)
  assert.equal(staleSocket.sentResults.length, 0); deepEqual(staleSocket.actions(), [])
  const otherSession = await scenario('other-session', null, { editMode: true, manual: true })
  otherSession.runner(plain(frameOf('delete', { session_id: 's_other' })), otherSession.ownerHandle); await otherSession.clock.advance(2000)
  assert.equal(otherSession.sentResults.length, 0); deepEqual(otherSession.actions(), [])
  const noSocketSession = await scenario('no-socket-session', null, { editMode: true, manual: true, owner: { socketSessionId: null } })
  noSocketSession.runner(plain(frameOf('delete')), noSocketSession.ownerHandle); await noSocketSession.clock.advance(2000)
  assert.equal(noSocketSession.sentResults.length, 0)
  const notOwned = await scenario('not-owned', null, { editMode: true, manual: true, owner: { deckOwnerSessionId: 's_other' } })
  notOwned.runner(plain(frameOf('delete')), notOwned.ownerHandle); await notOwned.clock.advance(2000)
  assert.equal(notOwned.sentResults.length, 0); deepEqual(notOwned.actions(), [])
  // The deck switches while the runner waits for the viewer to arrive on the slide: it stops, reads and applies nothing, and says nothing.
  const midRun = await scenario('mid-run-switch', null, { editMode: true, manual: true, page: { current: 2 } })
  midRun.runner(plain(frameOf('delete')), midRun.ownerHandle)
  await midRun.clock.advance(100)
  midRun.switchDeck()
  await midRun.clock.advance(5000)
  assert.equal(midRun.sentResults.length, 0, 'the old deck\'s directive is not answered')
  deepEqual(midRun.actions(), [], 'and the viewer was not touched after the switch')
  // The deck switches while the save is awaited: the change is in the old deck, whose directive is not answered.
  const lateSwitch = await scenario('hold-switch', null, { put: 'hold', editMode: true, manual: true })
  lateSwitch.runner(plain(frameOf('delete')), lateSwitch.ownerHandle)
  await lateSwitch.clock.advance(1900)
  lateSwitch.switchDeck()
  await lateSwitch.clock.advance(100)
  lateSwitch.put.release(); await lateSwitch.clock.advance(2000)
  assert.equal(lateSwitch.sentResults.length, 0, 'the ack arrived for a deck that is no longer on screen')
  const socketDies = await scenario('socket-dies', null, { put: 'hold', editMode: true, manual: true })
  socketDies.runner(plain(frameOf('delete')), socketDies.ownerHandle)
  await socketDies.clock.advance(900)
  socketDies.ownerHandle.current = false
  await socketDies.clock.advance(100)
  socketDies.put.release(); await socketDies.clock.advance(2000)
  assert.equal(socketDies.sentResults.length, 0, 'the socket that delivered it is gone: no answer on another one')
})
await check('edit mode: with no viewer to enter it the runner answers VIEWER_NOT_READY and applies nothing', async () => {
  const studio = await scenario('edit-mode-refused', null, { manual: true })
  studio.unregister()
  const none = await studio.send(frameOf('delete'))
  deepEqual(none, { directive_id: none.directive_id, ok: false, error_code: 'VIEWER_NOT_READY' })
  assert.equal(studio.actions().includes('deleteElement'), false)
})

// ===== 4. the real Director socket hook ====================================================================================================
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
function withFileText(rel, text, fn) {
  if (text === null || text === undefined) return fn()
  const target = path.join(root, rel), original = fs.readFileSync
  fs.readFileSync = function (file, ...rest) { return path.resolve(String(file)) === target ? text : original.call(this, file, ...rest) }
  try { return fn() } finally { fs.readFileSync = original }
}
async function mountHook({ flag, hookText = null, extraEnv = {}, handlers = {} }) {
  const env = createEnvironment({ processEnv: { ...BASE_ENV, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_CHAT_DIRECTIVES: 'true', ...(flag ? { [FLAG]: 'true' } : {}), ...extraEnv } })
  const user = { id: 'synthetic-user', email: 'synthetic-user@example.invalid' }
  const hookModule = withFileText(HOOK, hookText, () => createModuleLoader({ root, globals: env.globals, stubs: { react: React }, fileStubs: { 'hooks/use-auth': { useAuth: () => ({ user, isLoading: false }) } } }).load(HOOK))
  const seen = { edits: [], notes: [], onMessage: [] }
  const probe = { api: null, deckOwner: { deckOwnerSessionId: SESSION, presentationId: PRESENTATION } }
  function Probe() {
    probe.api = hookModule.useDecksterWebSocketV2({
      autoConnect: false, existingSessionId: SESSION, onMessage: message => { seen.onMessage.push(message.message_id) },
      // What the page passes with the flag on (app/builder/page.tsx): the runner ref's forwarder and the notes event. They are passed with the flag OFF too here,
      // which the page never does, so that a hook that calls them with the flag off is caught.
      onElementEditDirective: (message, owner) => { seen.edits.push({ message: plain(message), owner }); handlers.onElementEditDirective?.(message, owner) },
      onNotesUpdated: (update, owner) => { seen.notes.push({ update, owner }); handlers.onNotesUpdated?.(update, owner) },
    })
    return null
  }
  const rootNode = new Root()
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 80) throw new Error('hook did not settle'); await env.macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  rootNode.setElement(React.createElement(Probe))
  await settle()
  probe.api.ensureConnected()
  await env.clock.advance(0, settle)
  env.sockets[0].serverOpen()
  await env.clock.advance(0, settle)
  return {
    env, probe, seen, settle, get api() { return probe.api },
    async deliver(frame) { env.sockets[0].serverMessage(JSON.stringify(frame)); await env.clock.advance(0, settle) },
    async send(text) { const ok = probe.api.sendMessage(text); await env.clock.advance(0, settle); return ok },
    sent: () => env.outbound.filter(item => item.data !== 'ping').map(item => item.data),
    state: () => plain({ messages: probe.api.messages, awaiting: probe.api.awaitingDirectorReply, status: probe.api.currentStatus ?? null, presentationId: probe.api.presentationId ?? null,
      cache: env.sessionStorage.dump(), consoleErrors: env.consoleEvents.filter(e => e.level === 'error').length }),
    unmount() { rootNode.unmount() },
  }
}
const presentationUrlFrame = () => ({ message_id: 'm-url', session_id: SESSION, timestamp: '2026-10-26T12:00:00.000000Z', type: 'presentation_url', role: 'assistant',
  payload: { url: `${SYNTHETIC_LAYOUT_URL}/p/${PRESENTATION}`, presentation_id: PRESENTATION, slide_count: 4, message: 'Your presentation is ready.' } })
const userData = hook => JSON.parse(hook.sent().filter(data => data.startsWith('{"type":"user_message"')).at(-1)).data

await check('hook (flag on): client_caps carry element_edit1 and notes1 after mdc1; every other field of the send is as before', async () => {
  const hook = await mountHook({ flag: true })
  assert.equal(await hook.send('shorten the title'), true)
  const data = userData(hook)
  deepEqual(data.client_caps, ['mdc1', 'element_edit1', 'notes1'])
  const base = await mountHook({ flag: false })
  assert.equal(await base.send('shorten the title'), true)
  const { client_caps: baseCaps, ...baseRest } = userData(base)
  const { client_caps: _caps, ...rest } = data
  deepEqual(baseCaps, ['mdc1']); deepEqual(rest, baseRest)
})
await check('hook (flag on): element_edit goes out of band to the page\'s runner with its socket, unlocks the turn, and the result is answered on the same socket as bytes', async () => {
  const results = []
  const hook = await mountHook({ flag: true, handlers: { onElementEditDirective: (message, owner) => { results.push({ message: plain(message), owner }) } } })
  await hook.send('delete the chart')
  assert.equal(hook.api.awaitingDirectorReply, true)
  const before = hook.state()
  const frame = frameOf('delete')
  await hook.deliver(frame)
  assert.equal(hook.seen.edits.length, 1); deepEqual(hook.seen.edits[0].message, plain(frame))
  assert.equal(hook.seen.edits[0].owner.sessionId, SESSION); assert.equal(hook.seen.edits[0].owner.isCurrent(), true)
  const after = hook.state()
  deepEqual(after.messages, before.messages, 'not a chat message'); deepEqual(after.cache, before.cache, 'not cached'); assert.equal(after.awaiting, false, 'it answers the turn')
  const sentBefore = hook.sent().length
  assert.equal(hook.api.sendElementEditResult({ directive_id: idOf(frame), ok: true }), true)
  await hook.settle()
  assert.equal(hook.sent().length, sentBefore + 1)
  assert.equal(hook.sent().at(-1), JSON.stringify({ type: 'element_edit_result', payload: { directive_id: idOf(frame), ok: true } }))
  hook.api.sendElementEditResult({ directive_id: 'd2', ok: false, error_code: 'SAVE_FAILED' })
  deepEqual(JSON.parse(hook.sent().at(-1)), { type: 'element_edit_result', payload: { directive_id: 'd2', ok: false, error_code: 'SAVE_FAILED' } })
  // A frame without a directive id is consumed and never run.
  await hook.deliver({ type: 'element_edit', message_id: 'x', session_id: SESSION, op: 'delete' })
  assert.equal(hook.seen.edits.length, 1)
})
await check('hook (flag on): the result is not sent on a closed socket', async () => {
  const hook = await mountHook({ flag: true })
  hook.env.sockets[0].readyState = 3
  assert.equal(hook.api.sendElementEditResult({ directive_id: 'd', ok: true }), false)
  assert.equal(hook.sent().some(data => data.includes('element_edit_result')), false)
})
await check('hook (flag on): deck_mutation notes_updated reaches the page once; every other mutation is untouched (the slide_added of the existing family still reaches its callback)', async () => {
  const hook = await mountHook({ flag: true })
  await hook.send('write notes')
  await hook.deliver(presentationUrlFrame())
  await hook.send('write notes')
  await hook.deliver(envelope.notes_updated)
  assert.equal(hook.seen.notes.length, 1); deepEqual(hook.seen.notes[0].update, { presentationId: PRESENTATION, slideIndex: 1 }); assert.equal(hook.seen.notes[0].owner.isCurrent(), true)
  assert.equal(hook.api.awaitingDirectorReply, true, 'a notes update is not a reply: the turn stays locked until Director answers')
  deepEqual(hook.state().messages.filter(m => m.type === 'deck_mutation'), [], 'not a chat message')
})
const deckMutation = (kind, extra = {}) => ({ type: 'deck_mutation', message_id: `m-${kind}-${extra.slide_index ?? 0}`, session_id: SESSION,
  payload: { mutation: kind, slide_index: 1, refresh_token: 'tok', presentation_id: PRESENTATION, ...extra } })
await check('hook (flag off): element_edit and notes_updated are unknown frames, dropped exactly as the base drops them — same state, same cache, same bytes — and no cap is sent', async () => {
  const headHook = await mountHook({ flag: false })
  const baseHook = await mountHook({ flag: false, hookText: baseFile(HOOK) })
  const script = [() => ({ text: 'hello' }), () => presentationUrlFrame(), () => frameOf('delete'), () => envelope.notes_updated, () => ({ type: 'chat_message', message_id: 'cm-1', session_id: SESSION, timestamp: 't', payload: { text: 'hi', content: 'hi' } }), () => deckMutation('slide_added')]
  const run = async hook => {
    const trace = []
    for (const step of script) {
      const item = step()
      if (item.type === undefined) await hook.send(item.text); else await hook.deliver(item)
      trace.push({ state: hook.state(), sent: hook.sent() })
    }
    return trace
  }
  const head = await run(headHook), base = await run(baseHook)
  deepEqual(head, base)
  assert.equal(headHook.seen.edits.length + headHook.seen.notes.length, 0, 'the page is never called with the flag off')
  assert.equal(userData(headHook).client_caps.includes('element_edit1'), false)
  assert.equal(sha(JSON.stringify(head)), sha(JSON.stringify(base)))
})
await check('hook (flag on): the built send equals the base\'s except the caps, hashed without them', async () => {
  const on = await mountHook({ flag: true }), offBuild = await mountHook({ flag: false, hookText: baseFile(HOOK) })
  await on.send('same words'); await offBuild.send('same words')
  const a = userData(on), b = userData(offBuild)
  deepEqual(a.client_caps.filter(cap => !['element_edit1', 'notes1'].includes(cap)), b.client_caps)
  delete a.client_caps; delete b.client_caps
  assert.equal(sha(JSON.stringify(a)), sha(JSON.stringify(b)))
})
await check('hook: the stripped hook is the base hook byte for byte; every added line carries the marker (and the base had none)', async () => {
  const head = read(HOOK)
  assert.equal(stripPeers(HOOK, stripChatElementEdit(HOOK, head)), stripPeers(HOOK, baseFile(HOOK)))
  const added = git('diff', '-U0', BASE_COMMIT, '--', HOOK).split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++') && stripPeers(HOOK, `${line.slice(1)}\n`) !== '') // a line another registered change marks is its own
  assert.ok(added.length > 15)
  for (const line of added) assert.match(line, CHAT_ELEMENT_EDIT_MARKER_RE, line.slice(0, 80))
  assert.equal(git('diff', '-U0', BASE_COMMIT, '--', HOOK).split('\n').filter(line => line.startsWith('-') && !line.startsWith('---')).length, 0, 'no line of the base is removed or changed')
})

// ===== 5. the Notes panel ==========================================================================================================================
function notesPanel({ flag = true, text = null, pending = [], edited = [] } = {}) {
  const panelText = text ?? read('components/slide-notes-panel.tsx')
  const listeners = new Map()
  const reloads = []
  const editedFields = new Set(edited)
  const effect = evalExpression(callbackText('components/slide-notes-panel.tsx', 'useEffect', 'NOTES_UPDATED_EVENT', panelText), {
    CHAT_ELEMENT_EDIT_ENABLED: flag, NOTES_UPDATED_EVENT: on.wire.NOTES_UPDATED_EVENT, presentationIdRef: { current: PRESENTATION }, slideIdsRef: { current: ['L0', 'L1', 'L2'] },
    saversRef: { current: new Map([[PRESENTATION, { pending: new Map(pending) }]]) }, editedFieldsRef: { current: editedFields },
    setReloadToken: updater => { reloads.push(updater(10)) },
    window: { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) },
  })
  const cleanup = effect()
  return { listeners, reloads, edited: editedFields, cleanup, fire: detail => listeners.get(on.wire.NOTES_UPDATED_EVENT)?.({ detail }) }
}
await check('notes panel: notes_updated for the deck on screen reads the deck again (reloadToken + 1, the existing authoritative read); another deck or a bad index does nothing; removed on cleanup', async () => {
  const panel = notesPanel()
  assert.ok(panel.listeners.has(on.wire.NOTES_UPDATED_EVENT))
  panel.fire({ presentationId: PRESENTATION, slideIndex: 1 }); deepEqual(panel.reloads, [11])
  panel.fire({ presentationId: 'pres-other', slideIndex: 1 }); panel.fire({ presentationId: PRESENTATION, slideIndex: '1' }); panel.fire(undefined); panel.fire(null)
  deepEqual(panel.reloads, [11], 'nothing else reloads')
  panel.cleanup(); assert.equal(panel.listeners.size, 0)
  assert.equal(notesPanel({ flag: false }).listeners.size, 0, 'flag off: no listener')
})
await check('notes panel: the refetch effect is the existing one and depends on reloadToken; the panel lets go of a saved edit of that slide\'s notes (and only that) so Director\'s notes show', async () => {
  const text = read('components/slide-notes-panel.tsx')
  const ast = parse('components/slide-notes-panel.tsx')
  const fetchEffect = findNode(ast, node => ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0].getText(ast).includes('getPresentation(presentationId)'))
  assert.ok(fetchEffect.arguments[1].getText(ast).includes('reloadToken'), 'the authoritative read re-runs when reloadToken changes')
  const panel = notesPanel({ edited: ['L1:notes', 'L1:script', 'L2:notes'], pending: [['L2', new Set(['notes'])]] })
  panel.fire({ presentationId: PRESENTATION, slideIndex: 1 })
  deepEqual([...panel.edited].sort(), ['L1:script', 'L2:notes'], 'L1\'s saved notes edit is let go; its script edit and L2 stay')
  panel.fire({ presentationId: PRESENTATION, slideIndex: 2 })
  deepEqual([...panel.edited].sort(), ['L1:script', 'L2:notes'], 'an UNSAVED edit of the user\'s is kept')
  assert.equal(panel.reloads.length, 2)
})
await check('notes panel: the stripped panel is the base byte for byte; every added line carries the marker', async () => {
  const rel = 'components/slide-notes-panel.tsx'
  assert.equal(stripChatElementEdit(rel, read(rel)), baseFile(rel))
  for (const line of git('diff', '-U0', BASE_COMMIT, '--', rel).split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'))) assert.match(line, CHAT_ELEMENT_EDIT_MARKER_RE)
})

// ===== 6. the viewer's two additions and the page ===================================================================================================
await check('viewer: the save-ack publish and the edit-mode registration are marked insertions; the stripped viewer is the base byte for byte', async () => {
  const rel = 'components/presentation-viewer.tsx'
  assert.equal(stripPeers(rel, stripChatElementEdit(rel, read(rel))), stripPeers(rel, baseFile(rel)))
  const added = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++') && stripPeers(rel, `${l.slice(1)}\n`) !== '') // a line another registered change marks (Arrange's) is its own
  assert.equal(added.length, 8); for (const line of added) assert.match(line, CHAT_ELEMENT_EDIT_MARKER_RE)
  const text = read(rel)
  // the publish sits inside the handler, after the status is validated, before the status is acted on
  const handler = text.slice(text.indexOf("if (type === 'save_status' || type === 'saveStatusChanged') {"), text.indexOf("type === 'refineElementRequested' &&"))
  assert.ok(handler.indexOf("includes(status)) return") < handler.indexOf('publishViewerSaveEvent') && handler.indexOf('publishViewerSaveEvent') < handler.indexOf("if (status !== 'saved') {"))
})
await check('viewer: with the flag off nothing publishes and nothing registers (the same handler and registration run with the flag constant false)', async () => {
  const studio = await scenario('flag-off-viewer', null, { libs: { env: {} }, manual: true })
  // A saveStatusChanged from the viewer reaches the viewer's own state, and the runner store sees nothing.
  await studio.viewer.deliver({ action: 'enterEditMode', params: {}, requestId: 'x1' }, STUDIO_ORIGIN)
  await studio.clock.advance(10)
  assert.equal(studio.published.length, 0, 'no save event is published'); assert.ok(studio.statuses.length > 0, 'but the viewer\'s own status still updates')
  assert.equal(studio.libs.save.getChatEditViewer(), null, 'the viewer registers nothing')
})
await check('page: the runner is assigned only behind the flag, after the theme / export runner, outside the region the theme / export proof pins, on the K5 owner record', async () => {
  const page = read('app/builder/page.tsx')
  const ast = parse('app/builder/page.tsx')
  const assign = text => assignmentRight('app/builder/page.tsx', text)
  const add = assign('elementDirectiveRunnerRef.current'), refine = assign('elementRefineDirectiveRunnerRef.current'), themeExport = assign('themeExportDirectiveRunnerRef.current'), edit = assign('elementEditDirectiveRunnerRef.current')
  assert.ok(edit.start > themeExport.end, 'after the theme / export runner')
  assert.ok(refine.end < themeExport.start && add.end < refine.start, 'the refine and theme / export runners keep their places beside the add runner')
  // The theme / export proof measures what sits between the add runner and its own runner: nothing of ours is there.
  const between = page.slice(add.end, themeExport.start)
  assert.equal(CHAT_ELEMENT_EDIT_MARKER_RE.test(between), false)
  assert.ok(edit.text.startsWith('!CHAT_ELEMENT_EDIT_ENABLED ? null : (message, owner) => {'))
  assert.ok(edit.text.includes('displayed: () => elementDirectiveGenerationOwnerRef.current'))
  const options = page.slice(page.indexOf('...(CHAT_ELEMENT_EDIT_ENABLED ? {'), page.indexOf('} : {}), // CHAT-ELEMENT-EDIT'))
  assert.ok(options.includes('onElementEditDirective') && options.includes('onNotesUpdated') && options.includes('NOTES_UPDATED_EVENT'))
  // flag off: the conditional spread is {} and the runner is null.
  for (const [env, enabled] of [[{}, false], [{ [FLAG]: 'true' }, true], [{ [FLAG]: '1' }, false]]) {
    const libs = makeLibs({ env })
    assert.equal(libs.wire.CHAT_ELEMENT_EDIT_ENABLED, enabled)
    const spread = evalExpression(page.slice(page.indexOf('...(CHAT_ELEMENT_EDIT_ENABLED ? {') + 3, page.indexOf('} : {}), // CHAT-ELEMENT-EDIT') + '} : {})'.length)
      .replace(/\)\s*,?\s*$/, ''), { CHAT_ELEMENT_EDIT_ENABLED: libs.wire.CHAT_ELEMENT_EDIT_ENABLED, elementEditDirectiveRunnerRef: { current: null }, NOTES_UPDATED_EVENT: libs.wire.NOTES_UPDATED_EVENT,
        window: { dispatchEvent: () => {} }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail } } })
    assert.equal(Object.keys(spread).length, enabled ? 2 : 0, JSON.stringify(env))
    const runner = evalExpression(edit.text, { CHAT_ELEMENT_EDIT_ENABLED: libs.wire.CHAT_ELEMENT_EDIT_ENABLED })
    assert.equal(runner === null, !enabled)
  }
})
async function pageAnswerGuard(pageText) {
  // The page sends what the runner returns only on the socket that delivered the directive, and nothing when the runner returns nothing.
  for (const [result, current, expected] of [[{ directive_id: 'd', ok: true }, true, 1], [{ directive_id: 'd', ok: true }, false, 0], [null, true, 0]]) {
    const sent = []
    const libs = makeLibs()
    const runner = evalExpression(assignmentRight('app/builder/page.tsx', 'elementEditDirectiveRunnerRef.current', pageText).text, {
      CHAT_ELEMENT_EDIT_ENABLED: true, runElementEditDirective: async () => result, chatElementEditGateRef: { current: libs.lib.createElementEditGate() },
      elementDirectiveGenerationOwnerRef: { current: {} }, oneLiveTabSuperseded: false, templateModeOn: false, slideStructure: { slides: [] }, currentSlideIndexRef: { current: 0 }, layoutServiceApis: null,
      getChatEditViewer: () => null, subscribeViewerSaveEvents: () => () => {}, sendElementEditResult: value => { sent.push(value) }, setTimeout, Promise })
    runner({ type: 'element_edit' }, { isCurrent: () => current })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(sent.length, expected, JSON.stringify([result, current]))
  }
}
await check('page: the runner\'s answer goes out only on the live socket, and nothing goes out when the runner has nothing to say', async () => { await pageAnswerGuard(read('app/builder/page.tsx')) })
await check('page: onNotesUpdated dispatches the Notes panel\'s window event only for the live socket, with the update as detail', async () => {
  const page = read('app/builder/page.tsx')
  const dispatched = []
  const block = page.slice(page.indexOf('...(CHAT_ELEMENT_EDIT_ENABLED ? {'), page.indexOf('} : {}), // CHAT-ELEMENT-EDIT') + '} : {})'.length)
  const spread = evalExpression(block.slice(3), { CHAT_ELEMENT_EDIT_ENABLED: true, elementEditDirectiveRunnerRef: { current: null }, NOTES_UPDATED_EVENT: on.wire.NOTES_UPDATED_EVENT,
    window: { dispatchEvent: event => dispatched.push(event) }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail } } })
  spread.onNotesUpdated({ presentationId: PRESENTATION, slideIndex: 3 }, { isCurrent: () => true })
  spread.onNotesUpdated({ presentationId: PRESENTATION, slideIndex: 4 }, { isCurrent: () => false })
  deepEqual(dispatched.map(event => [event.type, event.detail]), [['deckster:chat-notes-updated', { presentationId: PRESENTATION, slideIndex: 3 }]])
})
await check('page: the stripped page is the base byte for byte; every added line carries the marker; the Builder has exactly one connect() as before', async () => {
  const rel = 'app/builder/page.tsx'
  assert.equal(stripPeers(rel, stripChatElementEdit(rel, read(rel))), stripPeers(rel, baseFile(rel)))
  const diff = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\n')
  for (const line of diff.filter(l => l.startsWith('+') && !l.startsWith('+++') && stripPeers(rel, `${l.slice(1)}\n`) !== '')) assert.match(line, CHAT_ELEMENT_EDIT_MARKER_RE) // a line another registered change marks is its own
  assert.equal(diff.filter(l => l.startsWith('-') && !l.startsWith('---')).length, 0)
  const connects = (text) => (text.match(/\bconnect\(\)/g) || []).length
  assert.equal(connects(read(rel)), connects(baseFile(rel)))
  const hookConnects = text => (text.match(/(?<![A-Za-z])connect\(\);/g) || []).length
  assert.equal(hookConnects(read(HOOK)), hookConnects(baseFile(HOOK)), 'the hook gains no connect();')
})
await check('flag off is identical in every file the change touches: the strip gives the base back, and the new lib files are inert with the flag off', async () => {
  for (const rel of CHAT_ELEMENT_EDIT_FILES) assert.equal(stripPeers(rel, stripChatElementEdit(rel, read(rel))), stripPeers(rel, baseFile(rel)), rel)
  assert.equal(stripChatElementEdit('lib/chat-element-edit.ts', 'x'), 'x', 'a file the change does not own comes back untouched')
  assert.equal(stripChatElementEdit('scripts/studio-later-changes.mjs', 'x'), 'x')
  const registry = await import('./studio-later-changes.mjs')
  for (const rel of CHAT_ELEMENT_EDIT_FILES) assert.equal(registry.stripLaterChanges(rel, read(rel)).includes('CHAT-ELEMENT-EDIT'), false, `the registry takes the marked lines out of ${rel}`)
  assert.ok(read('.env.example').includes(CHAT_ELEMENT_EDIT_ENV_BLOCK)); assert.ok(CHAT_ELEMENT_EDIT_ENV_BLOCK.endsWith('NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT="false"\n'))
  assert.ok(registry.LATER_CHANGE_FILES.has('lib/chat-element-edit.ts') && registry.LATER_CHANGE_FILES.has('scripts/test-studio-chat-element-edit.mjs'))
  deepEqual([...CHAT_ELEMENT_EDIT_SCOPE_FILES].sort(), [...CHAT_ELEMENT_EDIT_FILES, ...CHAT_ELEMENT_EDIT_NEW_FILES, ...CHAT_ELEMENT_EDIT_OWN_EDITS, ...CHAT_ELEMENT_EDIT_RETIRED_FILES].sort())
  // The env block is the only change to .env.example, and nothing is exposed by it (a build-time flag defaulting off).
  const envDiff = git('diff', '-U0', BASE_COMMIT, '--', '.env.example').split('\n').filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
  assert.equal(envDiff.filter(l => l.startsWith('-')).length, 0)
  assert.ok(envDiff.some(l => l === '+NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT="false"'))
})
const DEV_COMMIT = '0545569384ae3f6f7073699bff95662ec80c633a' // dev at #523: the files this change teaches are read against dev's, which holds the other changes' edits of them
// The arrange proof also carries the two tolerance commits taken over from the sibling branches (SHARED_COMMITS below): its reference is the last of them.
const REFERENCE = { 'scripts/test-studio-arrange.mjs': 'b6c51d2a747233cfc90b6ddf92127b8b74442169' }
const devFile = rel => git('show', `${REFERENCE[rel] ?? DEV_COMMIT}:${rel}`)
await check('pins: the older files this change teaches are the reference\'s (dev\'s, plus the shared tolerances) byte for byte once its edits are put back, every line it added carries the mark, and putting back twice changes nothing', async () => {
  for (const [rel, gained, lost] of [['scripts/test-studio-chat-theme-export.mjs', 2, 1], ['scripts/studio-pass3-polish-b-strip.mjs', 2, 0], ['scripts/test-studio-rail-add-slide.mjs', 1, 1], ['scripts/test-studio-arrange.mjs', 2, 1]]) {
    const text = read(rel)
    assert.equal(stripChatElementEdit(rel, text), devFile(rel), rel)
    assert.equal(stripChatElementEdit(rel, stripChatElementEdit(rel, text)), devFile(rel), `${rel}: idempotent`)
    assert.equal(stripChatElementEdit(rel, devFile(rel)), devFile(rel), `${rel}: dev's own file comes back as it is`)
    const devLines = devFile(rel).split('\n'), textLines = text.split('\n')
    const added = textLines.filter(line => !devLines.includes(line)), removed = devLines.filter(line => !textLines.includes(line))
    assert.equal(added.length, gained, rel); for (const line of added) assert.ok(line.includes('LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT)'), `${rel}: ${line.slice(0, 80)}`)
    assert.equal(removed.length, lost, `${rel}: ${lost ? 'one line replaced' : 'nothing removed'}`)
  }
  // The speed-perceived scope line is #520's exact line from dev: this change leaves the file alone.
  assert.equal(read('scripts/test-studio-speed-perceived.mjs'), devFile('scripts/test-studio-speed-perceived.mjs'))
  assert.equal(CHAT_ELEMENT_EDIT_OWN_EDITS.includes('scripts/test-studio-speed-perceived.mjs'), false)
  // polish-b's strip takes this change's lines out of the viewer first (COMPOSER-2's first-paint pin reads the viewer through it), before Arrange's, as #523's does.
  const polishB = await import('./studio-pass3-polish-b-strip.mjs')
  const viewer = 'components/presentation-viewer.tsx'
  assert.equal(CHAT_ELEMENT_EDIT_MARKER_RE.test(polishB.stripPass3PolishB(viewer, read(viewer))), false, 'polish-b\'s strip leaves none of this change\'s lines in the viewer')
  assert.equal(stripPeers(viewer, polishB.stripPass3PolishB(viewer, read(viewer))), stripPeers(viewer, polishB.stripPass3PolishB(viewer, baseFile(viewer))), 'and what is left is the base\'s viewer')
})
// A commit this branch took over from another change on purpose (git cherry-pick -x, so its text is byte-identical on the sibling branches): the files it may touch.
const SHARED_COMMITS = { // "Arrange proof tolerance: ..." (tests only), both byte-identical on the sibling branches (#519, #520, #521)
  d4e62e0b0affcab480694e056af3946ec23a9136: ['scripts/test-studio-arrange.mjs'], // the .env.example block may be followed by the blocks of changes registered after it
  e638f8171b6f236e5141255e6b95be1219dfa03a: ['scripts/test-studio-arrange.mjs'], // the Builder page is read through the registry in its "not changed" check
}
await check('scope: this change\'s own commits (the first-parent line without merges) touch this change\'s files, every subject starts "Chat element edit:" (a shared cherry-pick is named and bounded)', async () => {
  // A merge of dev brings dev's history in by its second parent, and dev's files are their changes' own.
  const shas = git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)
  assert.ok(shas.length >= 5, `${shas.length} own commits`)
  const own = []
  for (const sha of shas) {
    const subject = git('log', '-1', '--format=%s', sha).trim(), body = git('log', '-1', '--format=%b', sha)
    const files = git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean)
    const shared = Object.keys(SHARED_COMMITS).find(commit => body.includes(`(cherry picked from commit ${commit})`))
    if (shared) { for (const file of files) assert.ok(SHARED_COMMITS[shared].includes(file), `${sha}: the shared commit ${shared} touches only ${SHARED_COMMITS[shared]}: ${file}`); continue }
    assert.ok(subject.startsWith('Chat element edit:'), subject)
    own.push(...files)
  }
  // scripts/test-studio-speed-perceived.mjs: this branch's first commits taught it a scope line; at the merge with dev it became #520's identical-intent line (the pins check proves it is dev's file).
  // scripts/fixtures/chat-element-edit/director-frames/agreed-envelope.json: the 26 Oct envelope, renamed contract-envelope.json when CONTRACT.md landed.
  const superseded = new Set(['scripts/test-studio-speed-perceived.mjs', ...CHAT_ELEMENT_EDIT_RETIRED_FILES])
  for (const file of new Set(own)) assert.ok(CHAT_ELEMENT_EDIT_SCOPE_FILES.has(file) || superseded.has(file), `a file outside the change: ${file}`)
  assert.ok(fs.existsSync(path.join(root, 'scripts/test-studio-chat-element-edit.mjs')))
  // Nothing of FRONTEND-1's or COMPOSER-2's tests, and not test-director-websocket-reconnect, is touched.
  const protectedTests = /^scripts\/(test-studio-p2-|test-studio-launch-wording|test-studio-env-append-tolerant|test-studio-route-params|test-studio-admin-email-guard|test-studio-uat-marketing|test-studio-deck-title|test-studio-deck-card-thumbnail|test-studio-first-paint|test-director-websocket-reconnect)/
  for (const file of [...own, ...Object.values(SHARED_COMMITS).flat()]) assert.equal(protectedTests.test(file), false, file)
})
await check('secrets: this change\'s new files and marked lines hold no credential-shaped literal', async () => {
  const texts = [...CHAT_ELEMENT_EDIT_NEW_FILES.filter(file => file.endsWith('.ts') || file.endsWith('.mjs')).map(read), ...CHAT_ELEMENT_EDIT_FILES.map(file => git('diff', '-U0', BASE_COMMIT, '--', file)), read('.env.example').slice(-3000)]
  const patterns = [/sk-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9/+_-]{16,}['"]/i]
  for (const text of texts) for (const pattern of patterns) assert.equal(pattern.test(text), false, String(pattern))
})

// ===== 7. the real Layout still says what was recorded ======================================================================================
const ARRANGE_ACTIONS = ['bringToFront', 'sendToBack', 'bringForward', 'sendBackward', 'alignElement', 'positionElement', 'resizeElement', 'rotateElement', 'flipElement', 'lockElement', 'setElementClasses']
await check('layout: the viewer code is the recorded one (live), or the transcripts name the viewer they were recorded from (offline)', async () => {
  const sourceFiles = ['viewer/presentation-viewer.html', ARRANGE_MODULE, ARRANGE_SCRIPT, ...LAYOUT_SCRIPTS]
  if (LIVE) {
    if (!RECORD) {
      const meta = recordedTranscripts.meta
      for (const [file, hash] of Object.entries(layoutSources)) if (meta.sources?.[file] !== hash) console.warn(`NOTE ${file} differs from the recorded copy; the live transcripts below are compared with the recorded ones`)
    }
  } else {
    assert.ok(recordedTranscripts.meta?.sources?.['viewer/presentation-viewer.html'], 'the transcripts name the viewer they came from')
    for (const file of sourceFiles) assert.match(recordedTranscripts.meta.sources[file], /^[0-9a-f]{64}$/, file)
  }
  const commands = new Set(['getSlideGenerationContext', 'getTextBoxFormatting', 'deleteElement', 'bringTextBoxToFront', 'sendTextBoxToBack', 'resizeTextBox', 'setTextBoxFontWeight', 'setTextBoxFontSize',
    'setTextBoxColor', 'setTextBoxAlignment', 'saveAllChanges', 'isEditModeActive', 'enterEditMode', 'bringToFront', 'sendToBack', 'bringForward', 'sendBackward', 'alignElement'])
  const asked = new Set(Object.values(recordedTranscripts.scenarios).flatMap(item => item.requests.map(request => request.action)))
  for (const action of asked) assert.ok(commands.has(action), `the runner asked the viewer for ${action}, which is not one of the commands this change names`)
  if (LIVE) {
    const { bridgeFromViewerHtml, arrangeServedHtml } = await import('./studio-chat-element-edit-layout.mjs')
    const raw = fs.readFileSync(path.join(LAYOUT_DIR, 'viewer/presentation-viewer.html'), 'utf8')
    const served = bridgeFromViewerHtml(arrangeServedHtml(LAYOUT_DIR, raw), STUDIO_ORIGIN)
    for (const action of commands) assert.ok(served.commands.has(action), `the real Layout viewer (Arrange flag on) has a case for ${action}`)
    const plainPage = bridgeFromViewerHtml(raw, STUDIO_ORIGIN)
    for (const action of ['bringToFront', 'sendToBack', 'bringForward', 'sendBackward', 'alignElement']) assert.equal(plainPage.commands.has(action), false, `with Layout's Arrange flag off ${action} is not a case: UNSUPPORTED_OP`)
  }
})
await check('layout: the LIVE Layout viewer code says exactly what the recorded transcripts say (every request and every frame, with its virtual time)', async () => {
  if (!LIVE || RECORD) return
  assert.ok(liveRuns.size > 40, `${liveRuns.size} scenarios ran live`)
  for (const [name, runs] of liveRuns) for (const log of runs) {
    const recorded = recordedTranscripts.scenarios[name]
    assert.ok(recorded, `a recording for ${name}`)
    assert.equal(JSON.stringify(plain({ requests: log.requests, frames: log.frames })), JSON.stringify(plain({ requests: recorded.requests, frames: recorded.frames })), `scenario ${name}: the live Layout code differs from the recording`)
  }
})
await check('layout: every Arrange command in every recorded scenario carries intent \'arrange\' (but the one scenario that proves the old no-op), and no command that rotates, flips, locks, resizes or sets classes is ever sent', async () => {
  const never = new Set(['positionElement', 'resizeElement', 'rotateElement', 'flipElement', 'lockElement', 'setElementClasses', 'applyTextFormatCommand', 'formatText', 'generateText', 'updateTextBoxStyle'])
  let arrangeRequests = 0
  for (const [name, item] of Object.entries(recordedTranscripts.scenarios)) for (const request of item.requests) {
    assert.equal(never.has(request.action), false, `${name}: ${request.action}`)
    if (!ARRANGE_ACTIONS.includes(request.action)) continue
    arrangeRequests++
    if (name === 'no-intent' && request.params.intent === undefined) continue
    assert.equal(request.params.intent, 'arrange', `${name}: ${request.action} carries the intent`)
  }
  assert.ok(arrangeRequests > 20, `${arrangeRequests} Arrange requests recorded`)
  const noIntent = recordedTranscripts.scenarios['no-intent'].requests.filter(request => ARRANGE_ACTIONS.includes(request.action))
  assert.equal(noIntent.filter(request => request.params.intent === undefined).length, 5, 'the five raw commands without the intent')
})

// ===== 8. mutants ===================================================================================================================================
/** Re-runs a few scenarios against a broken copy of `rel`: the proof's own assertions must fail. */
/** The viewer answers the read with success but does not list the element (an older Layout, a race): the element is not found, nothing is applied. */
async function unlistedElementCheck(lib) {
  const sent = []
  const reply = { success: true, slide_index: 0, elements: [{ element_id: 'someone_else', renderer_type: 'textbox', component_type: 'TEXT_BOX', position: { gridRow: '4/10', gridColumn: '2/16' }, properties: {} }] }
  const result = await lib.runElementEditDirective(plain(frameOf('delete')), { sessionId: SESSION, isCurrent: () => true }, {
    displayed: () => ({ sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: PRESENTATION, epoch: 0 }), gate: lib.createElementEditGate(), paused: () => false, templateMode: () => false,
    slideCount: () => 3, currentSlideIndex: () => 0, slideIdAt: () => 'L0', sendElementCommand: async action => { sent.push(action); return reply }, sendTextBoxCommand: async action => { sent.push(action); return { success: true } },
    ensureEditMode: async () => true, subscribeSave: () => () => {}, settle: async () => {} })
  deepEqual(plain(result), { directive_id: result.directive_id, ok: false, error_code: 'ELEMENT_NOT_FOUND' }); deepEqual(sent, ['getSlideGenerationContext'])
}
await check('read: a success reply that does not list the element is ELEMENT_NOT_FOUND and nothing is applied', async () => { await unlistedElementCheck(on.lib) })
async function quickSuite(libOverrides, sources = {}) {
  await saveWatchChecks(makeLibs({ overrides: libOverrides }).save)
  await unlistedElementCheck(makeLibs({ overrides: libOverrides }).lib)
  const libOptions = { overrides: libOverrides }
  const withLibs = { libs: libOptions, sources }
  const deleted = await scenario('delete', frameOf('delete'), withLibs)
  deepEqual(deleted.result, { directive_id: deleted.result.directive_id, ok: true })
  assert.ok(deleted.sentResults[0].at >= deleted.published.filter(event => event.status === 'saved').at(-1).at, 'after the ack')
  deepEqual(deleted.actions(), ['getSlideGenerationContext', 'isEditModeActive', 'enterEditMode', 'deleteElement', 'saveAllChanges'])
  const front = await scenario('order_front', frameOf('order_front'), { ...withLibs, editMode: true })
  assert.equal(front.result.ok, true)
  deepEqual(front.actions(), ['getSlideGenerationContext', 'isEditModeActive', 'bringTextBoxToFront', 'saveAllChanges'])
  const forward = await scenario('order-forward-chart', frameOf('order_forward', { element_id: 'el_chart_b' }), { ...withLibs, editMode: true })
  assert.equal(forward.result.ok, true)
  deepEqual(forward.requests().slice(2), [{ action: 'bringForward', params: { elementId: 'el_chart_b', intent: 'arrange' } }, { action: 'saveAllChanges', params: {} }])
  const backwardChart = await scenario('order-backward-chart', frameOf('order_backward', { element_id: 'el_chart_b' }), { ...withLibs, editMode: true })
  assert.equal(backwardChart.result.ok, true); deepEqual(backwardChart.requests()[2], { action: 'sendBackward', params: { elementId: 'el_chart_b', intent: 'arrange' } })
  const alignBoth = await scenario('place-chart-center-middle', frameOf('place_center-middle', { element_id: 'el_chart_b' }), { ...withLibs, editMode: true })
  assert.equal(alignBoth.result.ok, true); deepEqual(alignBoth.requests()[2], { action: 'alignElement', params: { elementId: 'el_chart_b', horizontal: 'center', vertical: 'middle', intent: 'arrange' } })
  const emptyPlace = await scenario('invalid-place-empty', frameOf('delete', { op: 'place', place: {} }), { ...withLibs, editMode: true })
  assert.equal(errorOf(emptyPlace.result), 'INVALID_VALUE'); deepEqual(emptyPlace.actions(), [])
  const colour = await scenario('style-color', frameOf('style_color'), { ...withLibs, editMode: true })
  assert.equal(colour.result.ok, true); deepEqual(colour.requests()[2], { action: 'setTextBoxColor', params: { elementId: 'el_text_a', themeBinding: 'accent_1' } })
  const alignChart = await scenario('place-chart-right', frameOf('place_right', { element_id: 'el_chart_b' }), { ...withLibs, editMode: true })
  assert.equal(alignChart.result.ok, true)
  deepEqual(alignChart.requests()[2], { action: 'alignElement', params: { elementId: 'el_chart_b', horizontal: 'right', intent: 'arrange' } })
  const frontChart = await scenario('order-front-chart', frameOf('order_front', { element_id: 'el_chart_b' }), { ...withLibs, editMode: true })
  assert.equal(frontChart.result.ok, true); deepEqual(frontChart.requests()[2], { action: 'bringToFront', params: { elementId: 'el_chart_b', intent: 'arrange' } })
  const table = await scenario('place-table', frameOf('place_left', { element_id: 'el_table_d' }), { ...withLibs, editMode: true })
  assert.equal(errorOf(table.result), 'UNSUPPORTED_OP')
  const fixed = await scenario('place-slot-fixed', frameOf('place_left', { element_id: 'el_slot_fixed' }), { ...withLibs, editMode: true })
  assert.equal(errorOf(fixed.result), 'ELEMENT_LOCKED')
  const flagOff = await scenario('order-forward-flag-off', frameOf('order_forward'), { ...withLibs, editMode: true, arrange: false })
  assert.equal(errorOf(flagOff.result), 'UNSUPPORTED_OP')
  const italic = await scenario('style-bold-italic', frameOf('style_bold', { style: { bold: true, italic: true } }), { ...withLibs, editMode: true })
  assert.equal(errorOf(italic.result), 'UNSUPPORTED_OP'); deepEqual(italic.actions(), ['getSlideGenerationContext'])
  const plaid = await scenario('invalid-color', frameOf('delete', { op: 'style', style: { color_token: 'plaid' } }), { ...withLibs, editMode: true })
  assert.equal(errorOf(plaid.result), 'INVALID_VALUE'); deepEqual(plaid.actions(), [])
  const gone = await scenario('not-found', frameOf('delete', { element_id: 'el_nope' }), { ...withLibs, editMode: true })
  assert.equal(errorOf(gone.result), 'ELEMENT_NOT_FOUND'); deepEqual(gone.actions(), ['getSlideGenerationContext'])
  const locked = await scenario('locked', frameOf('delete', { element_id: 'el_text_locked' }), { ...withLibs, editMode: true })
  assert.equal(errorOf(locked.result), 'ELEMENT_LOCKED')
  const invalid = await scenario('invalid-place', frameOf('delete', { op: 'place', place: { h: 'nowhere' } }), { ...withLibs, editMode: true })
  assert.equal(errorOf(invalid.result), 'INVALID_VALUE'); deepEqual(invalid.actions(), [])
  const failedSave = await scenario('save-failed', frameOf('delete'), { ...withLibs, put: 'fail', editMode: true })
  assert.equal(errorOf(failedSave.result), 'SAVE_FAILED')
  const place = await scenario('place-center', frameOf('place_center'), { ...withLibs, editMode: true })
  deepEqual(lastRequestFor(place, 'resizeTextBox').params.gridColumn, '10/24')
  const metricsPlace = await scenario('place-metrics', frameOf('place_left', { element_id: 'el_metrics_c' }), { ...withLibs, editMode: true })
  deepEqual(lastRequestFor(metricsPlace, 'resizeTextBox').params, { elementId: 'el_metrics_c', gridRow: '11/17', gridColumn: '2/20' })
  const stale = await scenario('stale-socket', null, { ...withLibs, editMode: true, manual: true })
  stale.ownerHandle.current = false
  stale.runner(plain(frameOf('delete')), stale.ownerHandle); await stale.clock.advance(2000)
  assert.equal(stale.sentResults.length, 0); deepEqual(stale.actions(), [])
  const midRun = await scenario('mid-run-switch', null, { ...withLibs, editMode: true, manual: true, page: { current: 2 } })
  midRun.runner(plain(frameOf('delete')), midRun.ownerHandle); await midRun.clock.advance(100); midRun.switchDeck(); await midRun.clock.advance(5000)
  assert.equal(midRun.sentResults.length, 0); deepEqual(midRun.actions(), [])
  const dup = await scenario('busy-quick', null, { ...withLibs, put: 'hold', editMode: true, manual: true })
  const a = frameOf('delete'), b = frameOf('order_front')
  dup.runner(plain(a), dup.ownerHandle); await dup.clock.advance(500); dup.runner(plain(b), dup.ownerHandle); dup.runner(plain(a), dup.ownerHandle); dup.runner(plain(b), dup.ownerHandle); await dup.clock.advance(400)
  deepEqual(dup.sentResults.map(item => item.result), [{ directive_id: idOf(b), ok: false, error_code: 'BUSY' }])
  await dup.clock.advance(100); dup.put.release(); await dup.clock.advance(1000)
  assert.equal(dup.sentResults.length, 2)
  const held = await scenario('hold-unreleased', null, { ...withLibs, put: 'hold', editMode: true, manual: true })
  held.runner(plain(frameOf('delete')), held.ownerHandle); await held.clock.advance(3900)
  assert.equal(held.sentResults.length, 0, 'not before the ack')
  const lateSwitch = await scenario('hold-switch', null, { ...withLibs, put: 'hold', editMode: true, manual: true })
  lateSwitch.runner(plain(frameOf('delete')), lateSwitch.ownerHandle); await lateSwitch.clock.advance(1900); lateSwitch.switchDeck(); await lateSwitch.clock.advance(100); lateSwitch.put.release(); await lateSwitch.clock.advance(2000)
  assert.equal(lateSwitch.sentResults.length, 0, 'an ack for a deck no longer on screen is not answered')
}
const LIB = 'lib/chat-element-edit.ts', SAVE = 'lib/chat-element-edit-save.ts', WIRE = 'lib/chat-element-edit-wire.ts'
const mut = (rel, from, to, all = false) => { const text = read(rel); assert.ok(text.includes(from), `mutant anchor in ${rel}: ${from.slice(0, 60)}`); return all ? text.split(from).join(to) : text.replace(from, () => to) }
await check('control: the unbroken code passes the quick suite the mutants run against', async () => { await quickSuite({}) })
for (const [label, rel, from, to] of [
  ['ok:true before the ack (the save wait returns saved at once)', LIB, "const outcome = await watch.settled(deps.saveTimeoutMs ?? ELEMENT_EDIT_SAVE_TIMEOUT_MS)", "const outcome = 'saved'"],
  ['no flush: the runner never sends the viewer\'s Save', LIB, "await sendTextBox(VIEWER_COMMANDS.flushSave, {})", "void 0"],
  ['edit mode is not ensured (the viewer would drop the change)', LIB, "editing = await deps.ensureEditMode()", "editing = true"],
  ['a save failure is reported as success', LIB, "return outcome === 'saved' ? { directive_id: directiveId as string, ok: true } : fail('SAVE_FAILED')", "return { directive_id: directiveId as string, ok: true }"],
  ['the owner check is dropped (a stale owner answers)', LIB, "if (!owner.sessionId || !owns() || start.sessionId !== owner.sessionId", "if (false"],
  ['a deck switch while the viewer is navigated is not noticed', LIB, "if (!owns()) return null\n      if (deps.currentSlideIndex() !== target || !sameSlide()) return fail('SLIDE_CHANGED')", "if (deps.currentSlideIndex() !== target || !sameSlide()) return fail('SLIDE_CHANGED')"],
  ['a deck switch while the save is awaited still answers', LIB, "const outcome = await watch.settled(deps.saveTimeoutMs ?? ELEMENT_EDIT_SAVE_TIMEOUT_MS)\n      if (!owns()) return null", "const outcome = await watch.settled(deps.saveTimeoutMs ?? ELEMENT_EDIT_SAVE_TIMEOUT_MS)"],
  ['a repeated directive runs again', LIB, "if (seen.has(directiveId)) return 'duplicate'", "if (false) return 'duplicate'"],
  ['no BUSY: a second edit runs alongside', LIB, "if (running !== null) return 'busy'", "if (false) return 'busy'"],
  ['the locked check is dropped', LIB, "if (element.locked || deps.templateMode()) return fail('ELEMENT_LOCKED')", "if (false) return fail('ELEMENT_LOCKED')"],
  ['italic is faked as bold', LIB, "if (!isTextBox(element) || edit.italic !== undefined) return unsupported", "if (!isTextBox(element)) return unsupported"],
  ['forward is sent as front', LIB, "if (edit.order === 'forward') return { ok: true, steps: [arrange(VIEWER_COMMANDS.arrangeForward)] }", "if (edit.order === 'forward') return { ok: true, steps: [arrange(VIEWER_COMMANDS.arrangeFront)] }"],
  ['backward is sent as back', LIB, "arrangeBackward: 'sendBackward'", "arrangeBackward: 'sendToBack'"],
  ['the Arrange intent is dropped (Layout answers "Unknown action")', LIB, "export const ARRANGE_INTENT = 'arrange'", "export const ARRANGE_INTENT = undefined as unknown as string"],
  ['a wrong intent word', LIB, "export const ARRANGE_INTENT = 'arrange'", "export const ARRANGE_INTENT = 'select'"],
  ['a non-text front goes to the text box command', LIB, "if (isTextboxRendered(element)) return { ok: true, steps: [{ route: 'textbox', action: edit.order === 'front'", "if (true) return { ok: true, steps: [{ route: 'textbox', action: edit.order === 'front'"],
  ['a non-text place is moved with resizeTextBox', LIB, "if (!isTextboxRendered(element)) {\n        // Any other element: Layout's alignElement", "if (false) {\n        // Any other element: Layout's alignElement"],
  ['alignElement loses its vertical axis', LIB, "...(edit.v !== undefined ? { vertical: edit.v } : {}), intent", "intent"],
  ['place center is left', LIB, "h === 'center' ? 'middle' : null", "h === 'center' ? 'start' : null"],
  ['an unknown place axis value is accepted', LIB, "(ELEMENT_EDIT_PLACE_H as readonly string[]).includes(h)", "true"],
  ['a place with no axis is accepted', LIB, "given.length === 0 || given.some", "given.some"],
  ['a locked element answers UNSUPPORTED_OP instead (Arrange\'s own refusal)', LIB, "if (message === 'Element is locked' || message === 'This element cannot be moved') return 'ELEMENT_LOCKED'", "void 0"],
  ['a bad colour token is bound', LIB, "return PALETTE_IDS.includes(id) && (raw === id || raw === `--theme-${id.replace(/_/g, '-')}`) ? raw : null", "return raw ? raw : null"],
  ['a colour token is rewritten before Layout sees it', LIB, "? raw : null\n}", "? `--theme-${id}` : null\n}"],
  ['the element is not read first (not found goes unnoticed)', LIB, "if (!element) return fail('ELEMENT_NOT_FOUND')", "if (!element) element = { elementId, rendererType: 'textbox', componentType: 'TEXT_BOX', locked: false, gridRow: '4/10', gridColumn: '2/16' }"],
  ['the save watch counts a saved from before the change', SAVE, "if (!tracked) return\n    if (event.status === 'saved'", "if (event.status === 'saved'"],
  ['the save watch ignores an error ack', SAVE, "else if (event.status === 'error') finish('error')", "else if (false) finish('error')"],
  ['the save watch takes saved with changes still pending', SAVE, "event.status === 'saved' && event.hasPendingChanges !== true", "event.status === 'saved'"],
]) await mutant(label, async () => quickSuite({ [rel]: mut(rel, from, to) }))
const wireMutants = [
  ['caps on although the flag is off', WIRE, "export const CHAT_ELEMENT_EDIT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT === 'true'", "export const CHAT_ELEMENT_EDIT_ENABLED = true"],
  ['the cap is dropped from the send', WIRE, "export const ELEMENT_EDIT_CLIENT_CAPS: readonly string[] = [ELEMENT_EDIT_CLIENT_CAP, NOTES_CLIENT_CAP]", "export const ELEMENT_EDIT_CLIENT_CAPS: readonly string[] = [ELEMENT_EDIT_CLIENT_CAP]"],
  ['notes_updated takes every deck_mutation', WIRE, "if (!fields || fields.mutation !== NOTES_UPDATED_KIND) return false", "if (!fields) return false"],
  ['notes_updated is also read from a "kind"', WIRE, "if (!fields || fields.mutation !== NOTES_UPDATED_KIND) return false", "if (!fields || (fields.mutation !== NOTES_UPDATED_KIND && fields.kind !== NOTES_UPDATED_KIND)) return false"],
  ['a notes_updated for another deck refreshes this one', WIRE, "if (ctx.displayed.deckOwnerSessionId !== ctx.sessionId || ctx.displayed.presentationId !== presentationId) return true", "if (false) return true"],
  ['the directive id is not required', WIRE, "if (elementEditDirectiveId(parsed)) ctx.onDirective?.(", "if (true) ctx.onDirective?.("],
  ['the result frame has another type', WIRE, "return { type: ELEMENT_EDIT_RESULT_TYPE, payload }", "return { type: 'element_directive_result', payload } as never"],
  ['the result frame is flat', WIRE, "return { type: ELEMENT_EDIT_RESULT_TYPE, payload }", "return { type: ELEMENT_EDIT_RESULT_TYPE, ...payload } as never"],
  ['the result frame carries data, not payload', WIRE, "return { type: ELEMENT_EDIT_RESULT_TYPE, payload }", "return { type: ELEMENT_EDIT_RESULT_TYPE, data: payload } as never"],
]
for (const [label, rel, from, to] of wireMutants) await mutant(label, async () => {
  const libs = makeLibs({ overrides: { [rel]: mut(rel, from, to) } })
  const offLibs = makeLibs({ env: {}, overrides: { [rel]: mut(rel, from, to) } })
  assert.equal(offLibs.wire.CHAT_ELEMENT_EDIT_ENABLED, false, 'flag off stays off')
  deepEqual([...libs.wire.ELEMENT_EDIT_CLIENT_CAPS], envelope.caps)
  const ran = [], notified = []
  const ctx = { sessionId: SESSION, isCurrent: () => true, unlockTurn() {}, displayed: { deckOwnerSessionId: SESSION, presentationId: PRESENTATION }, onDirective() { ran.push(1) }, onNotesUpdated() { notified.push(1) } }
  assert.equal(libs.wire.routeNotesUpdatedFrame(deckMutation('slide_added'), ctx), false)
  assert.equal(libs.wire.routeNotesUpdatedFrame({ ...envelope.notes_updated, payload: { ...envelope.notes_updated.payload, presentation_id: 'pres-other' } }, ctx), true)
  assert.equal(notified.length, 0, 'a notes update for another deck reaches nobody')
  libs.wire.routeElementEditFrame({ type: 'element_edit' }, ctx); assert.equal(ran.length, 0)
  deepEqual(libs.wire.elementEditResultFrame({ directive_id: 'd', ok: true }), { type: 'element_edit_result', payload: { directive_id: 'd', ok: true } })
  assert.equal(libs.wire.routeNotesUpdatedFrame({ type: 'deck_mutation', session_id: SESSION, payload: { kind: 'notes_updated', presentation_id: PRESENTATION, slide_index: 1 } }, ctx), false, 'only payload.mutation names notes_updated')
})
async function hookFlagOffSuite(hookText) {
  const head = await mountHook({ flag: false, hookText })
  const base = await mountHook({ flag: false, hookText: baseFile(HOOK) })
  for (const item of [{ text: 'hello' }, presentationUrlFrame(), frameOf('delete'), envelope.notes_updated]) {
    if (item.type === undefined) { await head.send(item.text); await base.send(item.text) } else { await head.deliver(item); await base.deliver(item) }
    deepEqual(head.state(), base.state()); deepEqual(head.sent(), base.sent())
  }
  assert.equal(head.seen.edits.length + head.seen.notes.length, 0, 'flag off: the page is never called')
  const on = await mountHook({ flag: true, hookText })
  await on.send('x'); deepEqual(userData(on).client_caps, ['mdc1', 'element_edit1', 'notes1'])
  const ran = []
  const watch = await mountHook({ flag: true, hookText, handlers: { onElementEditDirective: () => ran.push(1) } })
  await watch.deliver(frameOf('delete')); assert.equal(ran.length, 1)
  await watch.deliver(presentationUrlFrame()); await watch.deliver(envelope.notes_updated); assert.equal(watch.seen.notes.length, 1)
  assert.equal(watch.api.sendElementEditResult({ directive_id: 'd-x', ok: true }), true); await watch.settle()
  assert.equal(watch.sent().at(-1), JSON.stringify({ type: 'element_edit_result', payload: { directive_id: 'd-x', ok: true } }))
}
await check('control: the unbroken hook passes the hook suite the hook mutants run against', async () => { await hookFlagOffSuite(null) })
for (const [label, from, to, all] of [
  ['the element_edit route ignores the flag', "if (CHAT_ELEMENT_EDIT_ENABLED && routeElementEditFrame(", "if (routeElementEditFrame(", false],
  ['the notes route ignores the flag', "if (CHAT_ELEMENT_EDIT_ENABLED && routeNotesUpdatedFrame(", "if (routeNotesUpdatedFrame(", false],
  ['the caps ignore the flag', "if (CHAT_ELEMENT_EDIT_ENABLED) addChatElementEditCaps(", "addChatElementEditCaps(", false],
  ['the hook never routes element_edit', "if (CHAT_ELEMENT_EDIT_ENABLED && routeElementEditFrame(parsedMessage, {", "if (false && routeElementEditFrame(parsedMessage, {", false],
  ['the hook never routes notes_updated', "if (CHAT_ELEMENT_EDIT_ENABLED && routeNotesUpdatedFrame(parsedMessage, {", "if (false && routeNotesUpdatedFrame(parsedMessage, {", false],
  ['the hook sends the result as an element_directive_result', "wsRef.current.send(JSON.stringify(elementEditResultFrame(data)))", "wsRef.current.send(JSON.stringify({ type: 'element_directive_result', data }))", false],
  ['the hook sends the result flat', "wsRef.current.send(JSON.stringify(elementEditResultFrame(data)))", "wsRef.current.send(JSON.stringify({ type: 'element_edit_result', ...data }))", false],
]) await mutant(label, async () => hookFlagOffSuite(mut(HOOK, from, to, all)))
await mutant('the page wires the runner without the flag gate', async () => {
  const text = mut('app/builder/page.tsx', "elementEditDirectiveRunnerRef.current = !CHAT_ELEMENT_EDIT_ENABLED ? null : (message, owner) => {", "elementEditDirectiveRunnerRef.current = (message, owner) => {")
  const right = assignmentRight('app/builder/page.tsx', 'elementEditDirectiveRunnerRef.current', text).text
  assert.ok(right.startsWith('!CHAT_ELEMENT_EDIT_ENABLED ? null : (message, owner) => {'))
})
await mutant('the page answers on a socket that is not the live one', async () => {
  await pageAnswerGuard(mut('app/builder/page.tsx', "if (result && owner.isCurrent()) sendElementEditResult(result)", "if (result) sendElementEditResult(result)"))
})
await mutant('the page hands the runner no owner record of the K5 add runner', async () => {
  const text = mut('app/builder/page.tsx', "      displayed: () => elementDirectiveGenerationOwnerRef.current, // CHAT-ELEMENT-EDIT\n      gate:", "      displayed: () => ({ sessionId: 's_x' }), // CHAT-ELEMENT-EDIT\n      gate:")
  await quickSuite({}, { 'app/builder/page.tsx': text })
})
await mutant('the notes panel listens with the flag off', async () => {
  const panel = notesPanel({ flag: true, text: mut('components/slide-notes-panel.tsx', "if (!CHAT_ELEMENT_EDIT_ENABLED) return // CHAT-ELEMENT-EDIT", "") })
  const off = notesPanel({ flag: false, text: mut('components/slide-notes-panel.tsx', "if (!CHAT_ELEMENT_EDIT_ENABLED) return // CHAT-ELEMENT-EDIT", "") })
  assert.equal(off.listeners.size, 0); void panel
})
await mutant('the notes panel does not read the deck again', async () => {
  const panel = notesPanel({ text: mut('components/slide-notes-panel.tsx', "setReloadToken((token) => token + 1) // CHAT-ELEMENT-EDIT", "void 0 // CHAT-ELEMENT-EDIT") })
  panel.fire({ presentationId: PRESENTATION, slideIndex: 1 }); deepEqual(panel.reloads, [11])
})
await mutant('the notes panel reloads for another deck', async () => {
  const panel = notesPanel({ text: mut('components/slide-notes-panel.tsx', "detail.presentationId !== pid ||", "false ||") })
  panel.fire({ presentationId: 'pres-other', slideIndex: 1 }); deepEqual(panel.reloads, [])
})
await mutant('the viewer publishes no save ack', async () => {
  const text = mut('components/presentation-viewer.tsx', "if (CHAT_ELEMENT_EDIT_ENABLED) publishViewerSaveEvent(", "if (false) publishViewerSaveEvent(")
  await quickSuite({}, { 'components/presentation-viewer.tsx': text })
})
await mutant('the viewer registers no edit mode', async () => {
  const text = mut('components/presentation-viewer.tsx', "return registerChatEditViewer({ ensureEditMode: () => ensureEditMode() })", "return () => {}")
  await quickSuite({}, { 'components/presentation-viewer.tsx': text })
})

if (RECORD) {
  recordedTranscripts.meta = { recorded_with: 'CHAT_EDIT_LAYOUT_DIR + --record-layout', studio_origin: STUDIO_ORIGIN, layout_origin: LAYOUT_ORIGIN, sources: layoutSources,
    layout_checkout: 'layout-builder at c77f0474 (branch frontend2/arrange-intent, !261: Arrange commands act only with intent \'arrange\'; on top of !260 LAYOUT_ARRANGE_COMMANDS_ENABLED), the page served with the flag on (arrange_commands.py apply_to_viewer); the file hashes above are its identity',
    note: 'Every request the real Layout viewer code received and every frame it posted, with the virtual time (ms from the scenario start). lastSaveTime is normalised to the virtual time.',
    scenarios_recorded: Object.keys(recordedTranscripts.scenarios).length }
  fs.writeFileSync(TRANSCRIPTS, JSON.stringify(recordedTranscripts, null, 1) + '\n')
  console.log(`recorded ${Object.keys(recordedTranscripts.scenarios).length} scenarios to ${path.relative(root, TRANSCRIPTS)}`)
}
console.log(`\n${passed} checks passed, ${failed.length} failed; mutants: ${mutantsCaught} caught, ${mutantsMissed.length} missed (${LIVE ? 'live Layout viewer code' : 'recorded Layout transcripts'})`)
if (failed.length || mutantsMissed.length) { console.error(`FAILED: ${[...failed, ...mutantsMissed.map(label => `mutant ${label}`)].join(' | ')}`); process.exit(1) }
