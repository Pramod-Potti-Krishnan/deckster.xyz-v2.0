// FRONTEND-2 (B33, 27 Oct; PK 18:19Z): targeted chat edit, a chat element edit saves only that element and never sets off the editor's whole-deck autosave (NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE, exact "true",
// default off; it acts only with NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT on). Stacked on #538 (frontend2/chat-element-edit-2 @ 7a67ff6d), now merged into dev with #542, #539 and #543 on top.
//
//   node scripts/test-studio-chat-edit-targeted.mjs                     # offline: the viewer's replies and its save requests come from layout-transcripts.json, which the real Layout code recorded
//   CHAT_EDIT_TARGETED_LAYOUT_DIR=<layout-builder at frontend2/layout-targeted-save> node scripts/test-studio-chat-edit-targeted.mjs    # also runs the REAL Layout viewer code live and checks it says what was recorded
//   ... --record-layout                                                 # (with the variable) re-records scripts/fixtures/chat-edit-targeted/layout-transcripts.json
//
// What runs: Studio's own sendCommand and ensureEditMode (cut out of components/presentation-viewer.tsx), the page's runner (cut out of app/builder/page.tsx), lib/chat-element-edit.ts (+ -2, -wire, -save) and
// lib/chat-edit-targeted.ts in a vm; Layout's viewer bridge as Layout serves it (arrange_commands.py and, with Layout's flag, chat_targeted_save.py apply_to_viewer), edit-mode.js, grid-converter.js, auto-save.js,
// element-manager.js, arrange-commands.js and chat-targeted-save.js (scripts/studio-chat-element-edit-layout.mjs, `targeted`). Layout's fetch is recorded, never sent.
// What it proves:
//  1. the root cause, flags off: one chat edit on slide 2 makes ONE whole-deck PUT /slides "Auto-save from editor" that carries every slide's layout text (title boxes never stored) as text boxes;
//  2. flags on: a chat move / resize / delete / z-order / style on slide 2 makes ONE PUT .../slides/1/elements/<id>/chat-save carrying only that element, and no whole-deck save, even after the debounce;
//  3. a manual Edit Mode change (the Format panel's own command, no chat) is saved exactly as before: the same whole-deck PUT, byte for byte, on Layout's flag-off and flag-on pages, with Studio's flag on;
//  4. Studio's flag on with Layout's flag off: refused UNSUPPORTED_OP before any command changes anything, nothing saved (never a silent ok:true);
//  5. Undo: the ok:true result frame is byte-identical to today's (Director's Undo chip and chat undo key on it), and the save is a Layout version written after the edit (the Layout test pins create_version);
//  6. #538's slide checks still stand: a directive for a slide Layout does not show, or a stale slide id, is SLIDE_CHANGED before begin;
//  7. flag off is identical: the strip gives back dev's files (#538, #542, #539 and #543 merged) byte for byte; flag off runs today's requests exactly; the commits are this change's own (found by SUBJECT across `rev-list --no-merges BASE..head`, so a change stacked after this one, a dev merge and the gate's merge do not hide them; a commit that is not one touches only files a later change registered; HEAD^2 when HEAD is the gate's --no-ff merge onto dev, proved on a gate-style merge built here), every added line is marked; the file, .env.example and registry reads go past the changes registered after this one (their strips, blocks and registry lines are theirs), and a stray foreign file in a "Targeted chat edit:" commit fails the scope;
//  8. mutants are caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createClock, createLayoutViewer, replayViewer, TARGETED_SCRIPT, TARGETED_MODULE } from './studio-chat-element-edit-layout.mjs'
import { RELOAD_SCRIPTS, applyWithLayoutServer, elementState, renderStoredDeck, slotElementId } from './studio-chat-edit-targeted-reload.mjs'
import {
  BASE_COMMIT, CHAT_EDIT_TARGETED_FILES, CHAT_EDIT_TARGETED_NEW_FILES, CHAT_EDIT_TARGETED_PIN_FILES, CHAT_EDIT_TARGETED_PIN_EDITS, CHAT_EDIT_TARGETED_PIN_MARK, CHAT_EDIT_TARGETED_SCOPE_FILES, CHAT_EDIT_TARGETED_ENV_BLOCK, CHAT_EDIT_TARGETED_MARKER_RE, CHAT_EDIT_TARGETED_SUBJECT, stripChatEditTargeted,
} from './studio-chat-edit-targeted-strip.mjs'
import * as registry from './studio-later-changes.mjs'
const { stripLaterEnvBlocks, LATER_STRIPS, LATER_ENV_BLOCKS } = registry

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const TRANSCRIPTS = path.join(root, 'scripts/fixtures/chat-edit-targeted/layout-transcripts.json')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
/** The strips of every change registered AFTER this one (below this change's strip in LATER_STRIPS), applied first: a file is read as this change left it, whatever a later change marked in it. */
const laterStrips = (rel, text) => { const at = LATER_STRIPS.indexOf(stripChatEditTargeted); return (at === -1 ? [] : LATER_STRIPS.slice(at + 1)).reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text) }
const laterRead = rel => laterStrips(rel, read(rel))
const laterBlob = (ref, rel) => laterStrips(rel, git('show', `${ref}:${rel}`))
/** `text` (an .env.example) without the blocks registered AFTER this one (each with the one blank line before it): theirs, not this change's. */
const withoutLaterEnvBlocks = text => { const at = LATER_ENV_BLOCKS.indexOf(CHAT_EDIT_TARGETED_ENV_BLOCK); return (at === -1 ? [] : LATER_ENV_BLOCKS.slice(at + 1)).reduce((out, block) => { const body = String(block).replace(/^\n+/, '').replace(/\n+$/, ''); return body === '' ? out : out.replace(`\n${body}\n`, () => '') }, text) }

const RECORD = process.argv.includes('--record-layout')
const LAYOUT_DIR = process.env.CHAT_EDIT_TARGETED_LAYOUT_DIR ? path.resolve(process.env.CHAT_EDIT_TARGETED_LAYOUT_DIR) : null
const LIVE = Boolean(LAYOUT_DIR)
if (RECORD && !LIVE) throw new Error('--record-layout needs CHAT_EDIT_TARGETED_LAYOUT_DIR')
const recorded = RECORD ? { meta: {}, scenarios: {} } : JSON.parse(fs.readFileSync(TRANSCRIPTS, 'utf8'))

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch { caught++; console.log(`CAUGHT mutant ${label}`) }
}

// ---- the Studio libs in a vm --------------------------------------------------------------------------------------------------------
const FLAG_EDIT = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT', FLAG_EDIT_2 = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2', FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE'
const ENV_ON = { [FLAG_EDIT]: 'true', [FLAG_EDIT_2]: 'true', [FLAG]: 'true' }
const ENV_OFF = { [FLAG_EDIT]: 'true', [FLAG_EDIT_2]: 'true' }
function makeLibs({ env = ENV_ON, overrides = {}, clock = null } = {}) {
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
        if (spec.startsWith('@/')) for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, spec.slice(2) + ext))) return load(spec.slice(2) + ext)
        throw new Error(`unexpected dependency ${spec} of ${file}`)
      } }
    vm.runInNewContext(out, sandbox, { filename: file })
    return module.exports
  }
  return { wire: load('lib/chat-element-edit-wire.ts'), save: load('lib/chat-element-edit-save.ts'), lib: load('lib/chat-element-edit.ts'), targeted: load('lib/chat-edit-targeted.ts'), load }
}

// ---- the real Studio code, cut out by AST ------------------------------------------------------------------------------------------
const parse = (rel, text) => ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
function findNode(ast, predicate) { let found = null; const visit = node => { if (found) return; if (predicate(node)) { found = node; return } ts.forEachChild(node, visit) }; visit(ast); return found }
const js = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
const evalExpression = (expression, context) => vm.runInNewContext(js(`(${expression})`), context)
function functionText(rel, name, text = read(rel)) {
  const ast = parse(rel, text)
  const found = findNode(ast, node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.ok(found, `${rel} defines ${name}`)
  return found.getText(ast)
}
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
  return node.right.getText(ast)
}
const messaging = makeLibs().load('lib/layout-viewer-messaging.ts')
const router = makeLibs().load('lib/element-command-router.ts')
const bridgeJs = js(`${functionText('components/presentation-viewer.tsx', 'createViewerRequestId')}\n${functionText('components/presentation-viewer.tsx', 'sendCommand')}\n;({ sendCommand })`)

// ---- the deck: three slides; each slide's title is layout text (drawn by direct-element-creator.js as a text box, never stored as one) ----
const SESSION = 's_e2e', PRESENTATION = 'pres-e2e', STUDIO_ORIGIN = 'https://studio.example', LAYOUT_ORIGIN = 'https://layout.example'
const MIRRORS = ['L0_textbox_title', 'L1_textbox_title', 'L2_textbox_title']
const DECK = [
  ['L0_textbox_title', { slideIndex: 0, gridRow: '1/3', gridColumn: '2/30', text: 'Cover', slot: 'title' }],
  ['L1_textbox_title', { slideIndex: 1, gridRow: '1/3', gridColumn: '12/32', text: 'Where we lose', slot: 'title' }],
  ['image_b', { slideIndex: 1, type: 'image', componentType: 'IMAGE', gridRow: '1/19', gridColumn: '1/11' }],
  ['textbox_b', { slideIndex: 1, gridRow: '4/10', gridColumn: '12/24', fontSize: '24px', text: 'High-turnover fresh' }],
  ['L2_textbox_title', { slideIndex: 2, gridRow: '1/3', gridColumn: '2/30', text: 'Plan', slot: 'title' }],
  ['textbox_c', { slideIndex: 2, gridRow: '4/10', gridColumn: '2/16', text: 'Monday launch' }],
]
const FRAMES_DIR = path.join(root, 'scripts/fixtures/chat-element-edit/director-frames')
const recordedDirective = JSON.parse(fs.readFileSync(path.join(FRAMES_DIR, '01-delete-ok.json'), 'utf8')).frames_out.flat().find(frame => frame.type === 'element_edit')
let counter = 0
const frame = (op, elementId, extra = {}, slide = { slide_index: 1, slide_id: 'L1' }) => ({ ...plain(recordedDirective), message_id: `msg_t_${++counter}`,
  payload: { ...plain(recordedDirective.payload), directive_id: `ele_t_${counter}`, ...slide, element_id: elementId, op, ...extra } })
const OPS = {
  move_image: ['place', 'image_b', { place: { h: 'right' } }],
  move_textbox: ['place', 'textbox_b', { place: { v: 'bottom' } }],
  delete_image: ['delete', 'image_b', {}],
  back_image: ['order', 'image_b', { order: 'back' }],
  front_textbox: ['order', 'textbox_b', { order: 'front' }],
  bold_textbox: ['style', 'textbox_b', { style: { bold: true } }],
}

function fakeResponse(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body }
}

/** One scenario: the Studio window and iframe with the real sendCommand, ensureEditMode and page runner over a viewer (live Layout code, or its recording). */
async function scenario(name, { studio = 'on', layout = 'on', editMode = false, sources = {}, libs: libOptions = {}, shownIds = ['L0', 'L1', 'L2'], stored = null, putDelayMs = 0, putStatus = 200, server = null } = {}) {
  const clock = createClock()
  const env = studio === 'on' ? ENV_ON : ENV_OFF
  const libs = makeLibs({ env, clock, ...libOptions })
  const listeners = new Set()
  const sent = []
  const fetches = []
  const studioWindow = { addEventListener(type, fn) { if (type === 'message') listeners.add(fn) }, removeEventListener(type, fn) { if (type === 'message') listeners.delete(fn) }, dispatchEvent() {} }
  let viewer = null
  const viewerHandle = { postMessage(data, targetOrigin) { assert.equal(targetOrigin, LAYOUT_ORIGIN); const request = plain(data); queueMicrotask(() => { viewer.deliver(request, STUDIO_ORIGIN).catch(error => { throw error }) }) } }
  const toStudio = data => queueMicrotask(() => { for (const fn of [...listeners]) fn({ source: viewerHandle, origin: LAYOUT_ORIGIN, data: plain(data) }) })
  const mutated = Object.keys(sources).length > 0 || Object.keys(libOptions.overrides ?? {}).length > 0 || Boolean(libOptions.layoutScript)
  if (LIVE) {
    viewer = createLayoutViewer({ layoutDir: LAYOUT_DIR, studioOrigin: STUDIO_ORIGIN, parent: { postMessage: toStudio }, clock, presentationId: PRESENTATION, arrange: true, targeted: layout === 'on',
      fetchImpl: async (url, init) => {
        fetches.push({ at: clock.now(), url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : null })
        if (server) { // Layout's own server answers (scripts/studio-chat-edit-targeted-reload.mjs applyWithLayoutServer), against the deck it stores
          const [answer] = applyWithLayoutServer(PYTHON, LAYOUT_DIR, [{ deck: server.deck, requests: [{ method: init?.method ?? 'GET', url: String(url), body: init?.body ? JSON.parse(init.body) : null }] }])
          server.deck = answer.deck; server.statuses.push(answer.statuses[0]); server.summaries.push(...answer.summaries)
          return fakeResponse(answer.statuses[0], answer.bodies[0])
        }
        const response = fakeResponse(putStatus, putStatus === 200 ? { success: true } : { detail: { code: 'SYNTHETIC', message: 'synthetic save refusal' } })
        return putDelayMs ? new Promise(resolve => clock.setTimeout(() => resolve(response), putDelayMs)) : response
      } })
    if (libOptions.layoutScript) vm.runInContext(libOptions.layoutScript(fs.readFileSync(path.join(LAYOUT_DIR, TARGETED_SCRIPT), 'utf8')), viewer.context)
    if (stored) renderStoredDeck(viewer, stored, LAYOUT_DIR) // Layout's own load path (scripts/studio-chat-edit-targeted-reload.mjs)
    else for (const [id, spec] of DECK) {
      const node = viewer.registerElement(id, spec)
      node.setAttribute('data-parent-slide-id', `L${spec.slideIndex}`)
      if (spec.slot) { node.setAttribute('data-slot-name', spec.slot); node.setAttribute('data-slot-kind', 'structural') }
    }
    if (editMode) viewer.enterEditMode()
  } else {
    const transcript = recorded.scenarios[name]
    assert.ok(transcript, `a recorded Layout transcript for "${name}" (record with CHAT_EDIT_TARGETED_LAYOUT_DIR=... --record-layout)`)
    viewer = replayViewer({ transcript, parent: { postMessage: toStudio }, clock })
  }
  clock.setGuard?.(() => { if (viewer.log.divergence) throw viewer.log.divergence })
  const iframe = { src: `${LAYOUT_ORIGIN}/p/${PRESENTATION}`, contentWindow: viewerHandle }
  const iframeRef = { current: iframe }
  const { sendCommand } = vm.runInNewContext(bridgeJs, {
    window: studioWindow, Promise, Error, Date, Math, JSON, Object, Array, queueMicrotask, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    crypto: { randomUUID: (() => { let n = 0; return () => `studio-request-${++n}` })() }, getLayoutServiceUrl: () => LAYOUT_ORIGIN, VIEWER_ORIGIN: LAYOUT_ORIGIN,
    getLayoutViewerOrigin: messaging.getLayoutViewerOrigin, isTrustedLayoutViewerMessage: messaging.isTrustedLayoutViewerMessage,
    isMatchingSlideComposeCommandResponse: () => { throw new Error('not a compose command') }, scTrace() {}, isSlideComposerTraceEnabled: () => false, reportLayoutCommandAck() {},
  })
  const sendElementCommand = (action, params) => { assert.notEqual(router.getCommandType(action), 'elementor'); return sendCommand(iframe, action, params, { timeoutMs: 30_000 }) }
  const sendTextBoxCommand = (action, params) => sendCommand(iframe, action, params)
  const viewerTsx = sources['components/presentation-viewer.tsx'] ?? read('components/presentation-viewer.tsx')
  const saveEffect = evalExpression(callbackText('components/presentation-viewer.tsx', 'useEffect', "'saveStatusChanged'", viewerTsx), {
    window: studioWindow, VIEWER_ORIGIN: LAYOUT_ORIGIN, LAYOUT_URL_CONFIG_ERROR: null, isTrustedLayoutViewerMessage: messaging.isTrustedLayoutViewerMessage, iframeRef,
    isLayoutViewerEvent: router.isLayoutViewerEvent, isDiagramRendererStateEvent: () => false, parseDiagramRendererStateUpdate: () => null, studioShell: false,
    viewerInteractionIntentRef: { current: 0 }, pendingDiagramStatesRef: { current: new Map() }, diagramStateTimersRef: { current: new Map() }, postCommand() {},
    nativeSnapshotDirtyRef: { current: false }, reportOwnDeckEdit() {}, setNativeSnapshotSafetyRevision() {}, setSaveStatus() {}, debugLog() {},
    onRefineElementRequested: null, resolveRefineElementGenerationConfig: () => null, studioArrangeOwnsSaveStatus: () => false, CHAT_ELEMENT_EDIT_ENABLED: libs.wire.CHAT_ELEMENT_EDIT_ENABLED,
    publishViewerSaveEvent: libs.save.publishViewerSaveEvent, console, clearTimeout: clock.clearTimeout,
  })
  saveEffect()
  const ensureEditMode = evalExpression(callbackText('components/presentation-viewer.tsx', 'useCallback', 'Studio must also observe native E/Escape exits', viewerTsx), {
    studioShell: true, beginStudioViewerInteraction: () => ({ isCurrent: () => true, iframe }), isEditMode: false, iframeRef, sendCommand,
    setIsEditMode() {}, onEditModeChange() {}, debugLog() {}, console,
  })
  libs.save.registerChatEditViewer({ ensureEditMode: () => ensureEditMode() })
  const slideState = { current: 1 }
  const ownerRef = { current: { sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: PRESENTATION, epoch: 0 } }
  const pageText = sources['app/builder/page.tsx'] ?? read('app/builder/page.tsx')
  const runner = evalExpression(assignmentRight('app/builder/page.tsx', 'elementEditDirectiveRunnerRef.current', pageText), {
    CHAT_ELEMENT_EDIT_ENABLED: libs.wire.CHAT_ELEMENT_EDIT_ENABLED, runElementEditDirective: libs.lib.runElementEditDirective,
    chatElementEditGateRef: { current: libs.lib.createElementEditGate() }, elementDirectiveGenerationOwnerRef: ownerRef, oneLiveTabSuperseded: false, templateModeOn: false,
    slideStructure: { slides: [{ slide_id: 'u0' }, { slide_id: 'u1' }, { slide_id: 'u2' }] }, currentSlideIndexRef: slideState,
    chatElementEdit2ShownSlides: async () => ({ slideCount: shownIds.length, slideIds: shownIds }),
    layoutServiceApis: { sendElementCommand, sendTextBoxCommand, goToSlide: async index => { slideState.current = index } },
    getChatEditViewer: libs.save.getChatEditViewer, subscribeViewerSaveEvents: libs.save.subscribeViewerSaveEvents,
    sendElementEditResult: result => { sent.push(plain(result)); return true }, setTimeout: clock.setTimeout, Promise,
  })
  const owner = { sessionId: SESSION, isCurrent: () => true }
  const world = {
    clock, sent, viewer, libs,
    fetches: () => (LIVE ? fetches : recorded.scenarios[name].fetches),
    actions: () => viewer.log.requests.map(item => item.action),
    async send(message) {
      const before = sent.length
      runner(plain(message), owner)
      for (let spent = 0; sent.length === before && spent < 60_000; spent += 50) await clock.advance(50)
      assert.ok(sent.length > before, 'a result was sent')
      await clock.advance(10_000) // past auto-save.js's 2.5 s debounce: a scheduled whole-deck save would have gone out by now
      return sent.at(-1)
    },
    /** The Format panel's own command, as the user sends it in Edit Mode (no chat, no begin). */
    async manual(action, params) { const reply = sendCommand(iframe, action, params); await clock.drive(reply); await clock.advance(10_000); return reply },
    finish() {
      if (RECORD && !mutated) recorded.scenarios[name] = { ...plain(viewer.log), fetches: plain(fetches) }
      if (LIVE && !RECORD && !mutated) {
        const was = recorded.scenarios[name]
        assert.deepEqual(plain(viewer.log.requests), was.requests, `${name}: the live viewer was asked what was recorded`)
        assert.deepEqual(plain(viewer.log.frames), was.frames, `${name}: the live viewer answered what was recorded`)
        assert.deepEqual(plain(fetches), was.fetches, `${name}: the live viewer saved what was recorded`)
      }
      if (!LIVE) {
        assert.equal(viewer.log.requests.length, recorded.scenarios[name].requests.length, `${name}: every recorded request was made (no more, no fewer)`)
        assert.equal(viewer.log.divergence, null, `${name}: no request diverged from the recording`)
      }
    },
  }
  return world
}

const putsTo = (fetches, re) => fetches.filter(item => item.method === 'PUT' && re.test(item.url))
const WHOLE_DECK = new RegExp(`/api/presentations/${PRESENTATION}/slides$`)
const CHAT_SAVE = /\/elements\/[^/]+\/chat-save$/
const COLLECTION = { image_b: 'images', textbox_b: 'text_boxes' }

// ===== 1. the flag ======================================================================================================================
await check('flag: on only for the exact "true" of BOTH NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE and NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT', async () => {
  assert.equal(makeLibs({ env: ENV_ON }).targeted.CHAT_EDIT_TARGETED_SAVE_ENABLED, true)
  assert.equal(makeLibs({ env: ENV_OFF }).targeted.CHAT_EDIT_TARGETED_SAVE_ENABLED, false)
  assert.equal(makeLibs({ env: { [FLAG]: 'true' } }).targeted.CHAT_EDIT_TARGETED_SAVE_ENABLED, false, 'needs chat element edit')
  for (const value of ['1', 'TRUE', 'yes', ' true', 'True', '']) assert.equal(makeLibs({ env: { ...ENV_OFF, [FLAG]: value } }).targeted.CHAT_EDIT_TARGETED_SAVE_ENABLED, false, value)
  const env = read('.env.example')
  assert.ok(env.includes(`\n\n${CHAT_EDIT_TARGETED_ENV_BLOCK}`), 'the .env.example block, after a blank line')
  assert.ok(withoutLaterEnvBlocks(env).endsWith(`${FLAG}="false"\n`), 'the block is the last of this change and above it, the blocks registered after this one aside')
})

// ===== 2. the root cause, flags off (today) ===============================================================================================
for (const key of ['move_image', 'delete_image']) {
  await check(`root cause (flags off): a chat ${key.replace('_', ' ')} on slide 2 is ONE whole-deck "Auto-save from editor" PUT that stores every slide's layout text as text boxes`, async () => {
    const w = await scenario(`off-${key}`, { studio: 'off', layout: 'off' })
    const [op, id, extra] = OPS[key]
    const result = await w.send(frame(op, id, extra))
    assert.equal(result.ok, true)
    const whole = putsTo(w.fetches(), WHOLE_DECK)
    assert.equal(whole.length, 1, 'one whole-deck save')
    assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 0)
    const body = whole[0].body
    assert.equal(body.change_summary, 'Auto-save from editor')
    assert.equal(body.slides.length, 3, 'every slide is in the save')
    body.slides.forEach((slide, index) => assert.ok(slide.text_boxes.some(box => box.id === MIRRORS[index] && box.slot_name === 'title'), `slide ${index + 1}'s layout title is saved as a text box`))
    assert.ok(w.actions().includes('saveAllChanges'))
    w.finish()
  })
}

// ===== 3. flags on: only the element ===================================================================================================
const onRuns = {}
for (const key of Object.keys(OPS)) {
  await check(`flags on: a chat ${key.replace('_', ' ')} on slide 2 saves ONLY that element (one chat-save PUT), no whole-deck save even after the debounce, every layout text stays layout text`, async () => {
    const w = await scenario(`on-${key}`)
    const [op, id, extra] = OPS[key]
    const result = await w.send(frame(op, id, extra))
    onRuns[key] = result
    assert.deepEqual(Object.keys(result).sort(), ['directive_id', 'ok'])
    assert.equal(result.ok, true)
    assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0, 'no whole-deck save')
    assert.equal(w.fetches().length, 1, 'one request to Layout in all')
    const [save] = w.fetches()
    assert.equal(save.method, 'PUT')
    assert.equal(save.url, `/api/presentations/${PRESENTATION}/slides/1/elements/${id}/chat-save`)
    assert.equal(save.body.slide_id, 'L1')
    assert.equal(save.body.collection, COLLECTION[id])
    if (op === 'delete') assert.equal(save.body.element, null)
    else assert.equal(save.body.element.id, id)
    const withoutZ = JSON.stringify({ ...save.body, z_index: null })
    for (const other of ['textbox_c', ...MIRRORS, ...Object.keys(COLLECTION).filter(other => other !== id)]) assert.ok(!withoutZ.includes(other), `${other} is not in the save`)
    for (const [sibling, z] of Object.entries(save.body.z_index ?? {})) { assert.ok(['image_b', 'textbox_b', 'L1_textbox_title'].includes(sibling) && sibling !== id, sibling); assert.ok(Number.isInteger(z)) }
    const actions = w.actions()
    assert.ok(!actions.includes('saveAllChanges'), 'no viewer Save')
    const begin = actions.indexOf('beginTargetedElementSave'), commit = actions.indexOf('commitTargetedElementSave')
    assert.ok(begin > actions.indexOf('getSlideGenerationContext') && commit === actions.length - 1 && begin < commit, actions.join(','))
    if (op === 'style') assert.ok(save.body.element.text_style?.font_weight, 'the bold is in the saved record')
    if (key === 'move_image') assert.notEqual(save.body.element.position.grid_column, '1/11')
    w.finish()
  })
}

// ===== 4. a manual Edit Mode change is unchanged ==========================================================================================
await check('manual Edit Mode (Studio\'s flag on): the Format panel\'s own resize is saved by the same whole-deck PUT, byte for byte, on Layout\'s flag-off and flag-on pages', async () => {
  const bodies = []
  for (const layout of ['off', 'on']) {
    const w = await scenario(`manual-${layout}`, { layout, editMode: true })
    const reply = await w.manual('resizeTextBox', { elementId: 'textbox_b', gridRow: '6/12', gridColumn: '12/24' })
    assert.equal((await reply).success, true)
    const whole = putsTo(w.fetches(), WHOLE_DECK)
    assert.equal(whole.length, 1, `layout ${layout}: the editor's own debounced save`)
    assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 0)
    bodies.push(JSON.stringify(whole[0].body))
    w.finish()
  }
  assert.equal(sha(bodies[0]), sha(bodies[1]))
})
async function chatThenManual(options = {}) {
  const w = await scenario('on-then-manual', { editMode: true, ...options })
  assert.equal((await w.send(frame(...OPS.move_textbox))).ok, true)
  await w.manual('resizeTextBox', { elementId: 'textbox_b', gridRow: '5/11', gridColumn: '12/24' }) // the same slide as the chat edit: a scope left open would hold this mark
  assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 1)
  assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 1, 'the manual change: the editor\'s save, as before')
  return w
}
await check('manual Edit Mode after a chat edit: the scope is closed, the next manual change is tracked and saved whole-deck as before', async () => {
  const w = await chatThenManual()
  w.finish()
})

// ===== 5. Studio on, Layout off: a clear refusal ============================================================================================
await check('Studio\'s flag on, Layout\'s flag off: UNSUPPORTED_OP before any command changes anything; nothing saved, no Save sent', async () => {
  const w = await scenario('studio-on-layout-off', { layout: 'off' })
  const [op, id, extra] = OPS.move_image
  const result = await w.send(frame(op, id, extra))
  assert.equal(result.ok, false)
  assert.equal(result.error_code, 'UNSUPPORTED_OP')
  assert.equal(w.fetches().length, 0)
  const actions = w.actions()
  assert.equal(actions.at(-1), 'beginTargetedElementSave', actions.join(','))
  assert.ok(!actions.includes('alignElement') && !actions.includes('saveAllChanges'))
  w.finish()
})


// ===== 5b. the commit's budget: a slow write is not SAVE_FAILED ===========================================================================
await check('budget: the commit\'s save may take TARGETED_SAVE_COMMIT_TIMEOUT_MS = 20 s, the flag-off path\'s own save-ack wait (ELEMENT_EDIT_SAVE_TIMEOUT_MS); every command keeps the default 5 s', async () => {
  const libs = makeLibs()
  assert.equal(libs.targeted.TARGETED_SAVE_COMMIT_TIMEOUT_MS, libs.lib.ELEMENT_EDIT_SAVE_TIMEOUT_MS)
  assert.equal(libs.targeted.TARGETED_SAVE_COMMIT_TIMEOUT_MS, 20_000)
  const handler = callbackText('components/presentation-viewer.tsx', 'useCallback', "if (studioShell) viewerInteractionIntentRef.current += 1\n    return sendCommand(iframeRef.current, action, params)")
  assert.ok(/return sendCommand\(iframeRef\.current, action, params\)\n  \}$/.test(handler), 'the text box commands (begin, commit, status included) go out with sendCommand\'s default budget')
  assert.equal(laterRead('components/presentation-viewer.tsx'), laterStrips('components/presentation-viewer.tsx', git('show', `${BASE_COMMIT}:components/presentation-viewer.tsx`)), 'the viewer is not touched (past the changes registered after this one)')
})
for (const [label, name, options, expectOk] of [
  ['a PUT that takes 8 s (past the 5 s command budget): commit answers pending, the status reads saved, ok:true', 'budget-slow-8s', { putDelayMs: 8_000 }, true],
  ['a PUT that takes 18 s (inside the 20 s budget): ok:true', 'budget-slow-18s', { putDelayMs: 18_000 }, true],
  ['a PUT Layout refuses (500): SAVE_FAILED', 'budget-refused', { putStatus: 500 }, false],
  ['a PUT refused after 8 s: SAVE_FAILED', 'budget-slow-refused', { putDelayMs: 8_000, putStatus: 500 }, false],
  ['a PUT still unanswered at the end of the budget (30 s): SAVE_FAILED, never ok:true', 'budget-too-slow', { putDelayMs: 30_000 }, false],
]) {
  await check(`budget: ${label}`, async () => {
    const w = await scenario(name, options)
    const result = await w.send(frame(...OPS.move_image))
    assert.equal(result.ok, expectOk, JSON.stringify(result))
    if (!expectOk) assert.equal(result.error_code, 'SAVE_FAILED')
    assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 1)
    assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0)
    const statuses = w.actions().filter(action => action === 'getTargetedElementSaveStatus').length
    assert.ok(options.putDelayMs ? statuses > 0 : statuses === 0, `${statuses} status reads`)
    w.finish()
  })
}

// ===== 6. Undo ==========================================================================================================================
await check('Undo: the ok:true frame of a targeted edit is byte-identical to today\'s (the Undo chip and chat undo key on it); chat undo is not touched', async () => {
  const today = await scenario('off-move_image', { studio: 'off', layout: 'off' })
  const result = await today.send(frame(...OPS.move_image))
  const shape = r => JSON.stringify(makeLibs().wire.elementEditResultFrame({ ...r, directive_id: 'd' }))
  assert.equal(shape(result), shape(onRuns.move_image ?? { ok: true }))
  for (const rel of ['lib/chat-undo-v2.ts', 'lib/chat-undo.ts'].filter(rel => fs.existsSync(path.join(root, rel)))) assert.equal(laterRead(rel), laterStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), rel)
  today.finish()
})

// ===== 7. #538's slide checks ===========================================================================================================
await check('#538 still in force: a stale slide id, or a slide Layout does not show, is SLIDE_CHANGED before begin (nothing sent to save)', async () => {
  const stale = await scenario('on-stale-slide-id', { shownIds: ['L0', 'Lx', 'L2'] })
  const a = await stale.send(frame(...OPS.move_image))
  assert.equal(a.error_code, 'SLIDE_CHANGED')
  assert.ok(!stale.actions().includes('beginTargetedElementSave'))
  stale.finish()
  const gone = await scenario('on-slide-gone', { shownIds: ['L0'] })
  const b = await gone.send(frame(...OPS.move_image))
  assert.equal(b.error_code, 'SLIDE_CHANGED')
  assert.ok(!gone.actions().includes('beginTargetedElementSave'))
  assert.equal(gone.fetches().length + stale.fetches().length, 0)
  gone.finish()
})
await check('begin\'s refusals map honestly: busy = BUSY, another slide = SLIDE_CHANGED, a type saved only whole = UNSUPPORTED_OP, else the runner\'s own mapping', async () => {
  const { beginErrorCode } = makeLibs().targeted
  const map = makeLibs().lib.elementEditCommandErrorCode
  assert.equal(beginErrorCode(new Error('Another targeted save is open'), map), 'BUSY')
  assert.equal(beginErrorCode(new Error('Element is not on that slide'), map), 'SLIDE_CHANGED')
  assert.equal(beginErrorCode(new Error('This element type is not saved on its own'), map), 'UNSUPPORTED_OP')
  assert.equal(beginErrorCode(new Error('Unknown action: beginTargetedElementSave'), map), 'UNSUPPORTED_OP')
  assert.equal(beginErrorCode(new Error('Element not found'), map), 'ELEMENT_NOT_FOUND')
  assert.equal(beginErrorCode(new Error('Command timeout'), map), 'VIEWER_NOT_READY')
})

// ===== 8. flag off is identical; the commits are this change's own =======================================================================
await check('flag off: the strip gives back dev\'s files byte for byte (every added line is marked, pure insertions), and the .env.example block comes out with its blank line; all read past the changes registered after this one', async () => {
  for (const rel of CHAT_EDIT_TARGETED_FILES) {
    const base = git('show', `${BASE_COMMIT}:${rel}`), now = laterRead(rel)
    assert.equal(sha(stripChatEditTargeted(rel, now)), sha(base), rel)
    const added = now.split('\n').length - base.split('\n').length
    assert.equal(now.split('\n').filter(line => CHAT_EDIT_TARGETED_MARKER_RE.test(line)).length, added, `${rel}: every added line carries the marker`)
  }
  assert.equal(withoutLaterEnvBlocks(read('.env.example')), `${git('show', `${BASE_COMMIT}:.env.example`)}\n${CHAT_EDIT_TARGETED_ENV_BLOCK}`, 'the base, one blank line, the block (the blocks of the changes registered after this one aside)')
  assert.equal(stripLaterEnvBlocks('.env.example', read('.env.example')), stripLaterEnvBlocks('.env.example', git('show', `${BASE_COMMIT}:.env.example`)), 'the registry takes the block out')
  for (const rel of CHAT_EDIT_TARGETED_NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)), rel)
  for (const rel of CHAT_EDIT_TARGETED_PIN_FILES) {
    assert.equal(sha(stripChatEditTargeted(rel, laterRead(rel))), sha(git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: the proof this change taught, put back, is dev's`)
    for (const [has] of CHAT_EDIT_TARGETED_PIN_EDITS[rel]) for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(CHAT_EDIT_TARGETED_PIN_MARK), `${rel}: a taught line carries the pin mark`)
  }
})
await check('flag off: the runner sends today\'s requests exactly (the flag-off scenario is the recording of today\'s code path: Save, no begin)', async () => {
  for (const name of ['off-move_image', 'off-delete_image']) {
    const actions = recorded.scenarios[name].requests.map(item => item.action)
    assert.ok(!actions.some(action => /TargetedElementSave/.test(action)), name)
    assert.ok(actions.includes('saveAllChanges'), name)
  }
})
/** GATE-SAFE head of every own-commit / scope query. In the gate, HEAD is a local --no-ff merge whose FIRST parent is BASE (dev) and whose second parent is this change's head, so `--first-parent --no-merges BASE..HEAD` is empty: the
 *  scope then runs against HEAD^2. On a branch (HEAD is this change's own tip, or a merge of dev INTO it, whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const sha = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = git('rev-list', '--parents', '-n', '1', sha).trim().split(/\s+/).slice(1)
  return gateRule && parents.length === 2 && parents[0] === BASE_COMMIT ? parents[1] : sha
}
const SCOPE_HEAD = scopeHead('HEAD')
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge, and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(CHAT_EDIT_TARGETED_SUBJECT))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  const all = git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)
  for (const c of all) assert.doesNotMatch(subjectOf(c), /^Chat element edit/, c.slice(0, 8)) // #522's and #538's own-commit greps
  for (const c of all.filter(c => !own.includes(c))) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) assert.ok(CHAT_EDIT_TARGETED_SCOPE_FILES.has(rel) || registry.LATER_CHANGE_FILES.has(rel), `a commit between the base and HEAD that is not this change's (${c.slice(0, 8)}) touches ${rel}, which no later change registered`)
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
}
const scopeCommittedFiles = head => {
  const changed = git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(rel => CHAT_EDIT_TARGETED_SCOPE_FILES.has(rel) || !registry.LATER_CHANGE_FILES.has(rel)).sort()
  assert.deepEqual(changed, [...CHAT_EDIT_TARGETED_SCOPE_FILES].sort(), 'the files BASE..head changes (the files a later change registered aside) are exactly this change\'s')
  // pure insertions that all carry the marker: without its marked lines (and past the later strips) each file is dev's, byte for byte
  for (const rel of [...CHAT_EDIT_TARGETED_FILES, ...CHAT_EDIT_TARGETED_PIN_FILES]) assert.equal(sha(stripChatEditTargeted(rel, laterBlob(head, rel))), sha(git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is dev's, byte for byte`)
  for (const rel of CHAT_EDIT_TARGETED_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
}
const scopeEnvAndRegistry = head => {
  const base = git('show', `${BASE_COMMIT}:.env.example`), env = git('show', `${head}:.env.example`)
  assert.equal(registry.stripLaterEnvBlocks('.env.example', env), registry.stripLaterEnvBlocks('.env.example', `${base}\n${CHAT_EDIT_TARGETED_ENV_BLOCK}`))
  assert.equal(withoutLaterEnvBlocks(env), `${base}\n${CHAT_EDIT_TARGETED_ENV_BLOCK}`, 'byte for byte: the base, one blank line, the block (the blocks of the changes registered after this one aside)')
  const laterRegistry = (() => { const later = new Set(); let after = false; for (const line of git('show', `${head}:scripts/studio-later-changes.mjs`).split('\n')) { if (/^export const LATER_/.test(line)) after = false; else if (line.includes('studio-chat-edit-targeted-strip.mjs')) after = true; else if (after && line.includes('// LATER-CHANGE:') && /-strip\.mjs/.test(line)) later.add(line) } return later })() // the registry lines of every change registered after this one (below this change's own line in each list, in the registered shape) are theirs
  const diff = git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line) && !(line.startsWith('+') && laterRegistry.has(line.slice(1))))
  assert.equal(diff.length, 3); for (const line of diff) assert.ok(line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-chat-edit-targeted-strip.mjs'), line.slice(0, 140))
}
await check('scope: this change\'s own commits ("Targeted chat edit:", found across the whole line, no merges) exist, with the co-author line; a commit that is not one touches only files a later change registered', async () => scopeOwnCommits(SCOPE_HEAD))
await check('scope: the files BASE..HEAD changes are exactly this change\'s (a later change\'s registered files aside); every line added to an existing file is a pure insertion that carries the marker; the registry gains exactly its three lines; .env.example is the base, a blank line, the block', async () => { scopeCommittedFiles(SCOPE_HEAD); scopeEnvAndRegistry(SCOPE_HEAD) })
// GATE-SAFE: build the gate's merge (first parent BASE, second parent this change's head; the tree is `git merge-tree --write-tree BASE head`) and run the whole scope section against it.
const GATE_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-27T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-27T00:00:00Z' }
const gateStyleMerge = head => {
  const tree = git('merge-tree', '--write-tree', BASE_COMMIT, head).trim().split('\n')[0]
  return execFileSync('git', ['commit-tree', tree, '-p', BASE_COMMIT, '-p', head, '-m', 'gate-style merge (local, no ref)'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...GATE_IDENT } }).trim()
}
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it', async () => {
  const gate = gateStyleMerge(SCOPE_HEAD)
  assert.deepEqual(git('rev-list', '--parents', '-n', '1', gate).trim().split(/\s+/).slice(1), [BASE_COMMIT, SCOPE_HEAD], 'the gate-style merge: first parent BASE, second parent the head')
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${gate}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  const head = scopeHead(gate)
  assert.equal(head, SCOPE_HEAD, 'HEAD^2 is the change\'s head')
  scopeOwnCommits(head); scopeCommittedFiles(head); scopeEnvAndRegistry(head)
  assert.equal(scopeHead(SCOPE_HEAD), SCOPE_HEAD, 'a branch head (not a merge onto BASE) is used as it is')
  assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await check('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge (the scope fails on it), and without the HEAD^2 rule the scope head is the merge itself', async () => {
  const gate = gateStyleMerge(SCOPE_HEAD), head = scopeHead(gate, { gateRule: false })
  assert.equal(head, gate)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
await check('mutant caught: a stray foreign file in a "Targeted chat edit:" commit fails the committed-files check (own commits found by subject; the diff names the file), and the same file in a commit of another subject fails the own-commit check', async () => {
  const run = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', input, env: { ...process.env, ...GATE_IDENT }, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  const tree = run(['mktree'], `${git('ls-tree', SCOPE_HEAD)}100644 blob ${run(['hash-object', '-w', '--stdin'], 'stray\n')}\tstray-chat-edit-targeted.txt\n`)
  const stray = run(['commit-tree', tree, '-p', SCOPE_HEAD, '-m', `${CHAT_EDIT_TARGETED_SUBJECT} a stray file\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`])
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(SCOPE_HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), undefined, 'the committed-files check must fail on a stray file')
  const other = run(['commit-tree', tree, '-p', SCOPE_HEAD, '-m', 'Somebody else: a stray file\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'])
  assert.throws(() => scopeOwnCommits(other), /touches stray-chat-edit-targeted\.txt/, 'a commit of another subject must touch only registered files')
})
await check('Layout identity: the recording names the Layout files it ran (and, live, they are the files on disk)', async () => {
  if (RECORD) return
  assert.ok(recorded.meta?.sources?.[TARGETED_SCRIPT] && recorded.meta?.sources?.[TARGETED_MODULE])
  if (LIVE && !RECORD) for (const [rel, hash] of Object.entries(recorded.meta.sources)) assert.equal(sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8')), hash, rel)
})


// ===== 10. reload persistence: what shows after a real reload, flags on vs flags off ==========================================================
// The stored deck Layout loads: three C1 slides whose titles are slide.content (layout text: direct-element-creator.js draws them), slide 2 holding one
// stored text box and one stored image. Each case: load it (Layout's load path), the chat edit (Studio's runner, the real viewer), the save the viewer made
// answered by Layout's own server, then a fresh viewer loads what was stored.
const STORED = { id: PRESENTATION, title: 'T', slides: [
  { layout: 'C1', slide_id: 'L0', content: { slide_title: 'Cover' }, text_boxes: [], images: [] },
  { layout: 'C1', slide_id: 'L1', content: { slide_title: 'Where we lose' },
    text_boxes: [{ id: 'textbox_b', parent_slide_id: 'L1', position: { grid_row: '6/10', grid_column: '12/24' }, z_index: 100, content: '<p>High-turnover fresh</p>' }],
    images: [{ id: 'image_b', parent_slide_id: 'L1', position: { grid_row: '6/16', grid_column: '2/11' }, z_index: 100, image_url: 'https://img.example/a.png' }] },
  { layout: 'C1', slide_id: 'L2', content: { slide_title: 'Plan' }, text_boxes: [], images: [] },
] }
const KINDS = { 'layout title': { slot: 'title' }, 'text box': { id: 'textbox_b' }, image: { id: 'image_b' } }
const RELOAD_OPS = { move: { place: { v: 'bottom' } }, delete: {}, back: { order: 'back' }, front: { order: 'front' }, bold: { style: { bold: true } } }
const OP_OF = { move: 'place', delete: 'delete', back: 'order', front: 'order', bold: 'style' }
const PYTHON = process.env.CHAT_EDIT_TARGETED_LAYOUT_PYTHON || null
const reloadCases = []
for (const [kind, spec] of Object.entries(KINDS)) for (const op of Object.keys(RELOAD_OPS)) {
  if (kind === 'image' && op === 'bold') continue // style is a text box's (the runner refuses it for an image: UNSUPPORTED_OP, both flags)
  for (const flag of ['off', 'on']) reloadCases.push({ kind, op, flag, name: `reload-${flag}-${kind.replace(/ /g, '_')}-${op}`, spec })
}
const reloadRecord = recorded.reload ?? {}
if (LIVE) {
  if (!PYTHON) throw new Error('the live run needs CHAT_EDIT_TARGETED_LAYOUT_PYTHON (a Python with layout-builder\'s requirements) for Layout\'s own server')
  for (const item of reloadCases) {
    if (process.env.DEBUG_RELOAD) console.error('reload case', item.name)
    const server = { deck: plain(STORED), statuses: [], summaries: [] }
    const w = await scenario(item.name, { studio: item.flag, layout: item.flag, stored: STORED, server })
    const id = item.spec.id ?? slotElementId(w.viewer, 1, item.spec.slot)
    const before = elementState(w.viewer, id)
    const result = await w.send(frame(OP_OF[item.op], id, RELOAD_OPS[item.op]))
    const after = elementState(w.viewer, id)
    w.finish()
    const fresh = createLayoutViewer({ layoutDir: LAYOUT_DIR, studioOrigin: STUDIO_ORIGIN, parent: { postMessage() {} }, clock: createClock(), presentationId: PRESENTATION, arrange: true, targeted: item.flag === 'on' })
    renderStoredDeck(fresh, server.deck, LAYOUT_DIR)
    const record = { id, before, after, result: { ok: result.ok, error_code: result.error_code ?? null }, statuses: server.statuses, summaries: server.summaries,
      reloaded: elementState(fresh, id), reloadedSlot: item.spec.slot ? elementState(fresh, slotElementId(fresh, 1, item.spec.slot)) : null,
      otherSlidesStoredTextBoxes: [0, 2].map(i => (server.deck.slides[i].text_boxes || []).length) }
    if (RECORD) reloadRecord[item.name] = record
    else assert.deepEqual(plain(record), reloadRecord[item.name], `${item.name}: the live reload is what was recorded`)
  }
  if (RECORD) recorded.reload = reloadRecord
} else {
  for (const item of reloadCases) {
    const w = await scenario(item.name, { studio: item.flag, layout: item.flag })
    await w.send(frame(OP_OF[item.op], reloadRecord[item.name].id, RELOAD_OPS[item.op]))
    w.finish()
  }
}
const kept = (op, r) => {
  if (op === 'delete') return r.after.present === false && (r.reloadedSlot ?? r.reloaded).present === false // a layout text comes back as its slot's box (a new id)
  if (!r.reloaded.present || !r.after.present) return false
  if (op === 'move') return r.reloaded.row === r.after.row && r.reloaded.col === r.after.col
  if (op === 'bold') return r.reloaded.weight === r.after.weight
  return r.reloaded.z === r.after.z
}
const shown = (op, s) => (!s.present ? 'gone' : op === 'move' ? `${s.row} | ${s.col}` : op === 'bold' ? `weight ${s.weight}` : op === 'delete' ? 'present' : `z ${s.z}`)
const rows = []
for (const [kind] of Object.entries(KINDS)) for (const op of Object.keys(RELOAD_OPS)) {
  const off = reloadRecord[`reload-off-${kind.replace(/ /g, '_')}-${op}`], on = reloadRecord[`reload-on-${kind.replace(/ /g, '_')}-${op}`]
  if (!off || !on) continue
  rows.push({ kind, op, off, on, keptOff: off.result.ok && kept(op, off), keptOn: on.result.ok && kept(op, on) })
}
console.log('\nRELOAD PERSISTENCE (slide 2; "after edit" -> "after reload"; result = element_edit_result; other slides = text boxes stored on slides 1 and 3)')
console.log('| element | op | flags OFF (today: whole-deck save) | kept | flags ON (targeted save) | kept |')
console.log('|---|---|---|---|---|---|')
for (const row of rows) {
  const cell = r => `${r.result.ok ? 'ok' : r.result.error_code}; ${shown(row.op, r.after)} -> ${shown(row.op, row.op === 'delete' ? (r.reloadedSlot ?? r.reloaded) : r.reloaded)}; other slides ${r.otherSlidesStoredTextBoxes.join('/')}`
  console.log(`| ${row.kind} | ${row.op} | ${cell(row.off)} | ${row.keptOff ? 'yes' : 'NO'} | ${cell(row.on)} | ${row.keptOn ? 'yes' : 'NO'} |`)
}
await check('reload: every element kind x op was loaded, edited, saved by Layout\'s own server and reloaded, both flags (14 cases each)', async () => {
  assert.equal(rows.length, 14)
  for (const row of rows) for (const r of [row.off, row.on]) assert.ok(r.statuses.length >= 1 || !r.result.ok, `${row.kind} ${row.op}: a save reached Layout's server`)
})
await check('reload: flags on never keep LESS than flags off (every change today\'s whole-deck save keeps after a reload, the targeted save keeps too)', async () => {
  const less = rows.filter(row => row.keptOff && !row.keptOn).map(row => `${row.kind} ${row.op}`)
  assert.deepEqual(less, [])
})
await check('reload: flags on leave the other slides\' layout text as layout text (nothing stored on slides 1 and 3); flags off store it there as text boxes', async () => {
  for (const row of rows) {
    assert.deepEqual(row.on.otherSlidesStoredTextBoxes, [0, 0], `${row.kind} ${row.op}`)
    if (row.off.result.ok) assert.ok(row.off.otherSlidesStoredTextBoxes.every(count => count > 0), `${row.kind} ${row.op}: today's save stores them`)
  }
})
await check('reload: the layout title\'s bold (row 46) and its z-order are kept after a reload with flags on, as with flags off', async () => {
  for (const op of ['bold', 'back', 'front']) { const row = rows.find(r => r.kind === 'layout title' && r.op === op); assert.ok(row.keptOn && row.keptOff, op) }
})

// ===== 9. mutants =======================================================================================================================
const runnerText = read('lib/chat-element-edit.ts')
const targetedText = read('lib/chat-edit-targeted.ts')
const runOn = async (name, overrides, key = 'move_image', options = {}) => {
  const w = await scenario(name, { libs: { overrides }, ...options })
  const result = await w.send(frame(...OPS[key]))
  if (LIVE) {
    assert.equal(result.ok, true)
    assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0)
    assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 1)
  } else {
    assert.equal(result.ok, true)
    assert.equal(w.viewer.log.divergence, null)
    assert.equal(w.viewer.log.requests.length, recorded.scenarios[name].requests.length)
  }
}
await mutant('runner: the targeted branch removed (today\'s whole-deck Save comes back)', () => runOn('on-move_image', { 'lib/chat-element-edit.ts': stripChatEditTargeted('lib/chat-element-edit.ts', runnerText) }))
await mutant('targeted: commit never sent (ok:true without a save)', () => runOn('on-move_image', { 'lib/chat-edit-targeted.ts': targetedText.replace('okReply(await ctx.sendTextBox(TARGETED_SAVE_COMMANDS.commit, { saveId: held }))', 'void held') }))
await mutant('targeted: a refused begin read as ok', async () => {
  const mutated = targetedText.replace('    return ctx.owns() ? fail(beginErrorCode(error, ctx.commandErrorCode)) : null\n', "    saveId = 'x'\n")
  assert.notEqual(mutated, targetedText)
  const w = await scenario('studio-on-layout-off', { layout: 'off', libs: { overrides: { 'lib/chat-edit-targeted.ts': mutated } } })
  const result = await w.send(frame(...OPS.move_image))
  assert.equal(result.error_code, 'UNSUPPORTED_OP')
  assert.ok(!w.actions().includes('alignElement'))
})
await mutant('targeted: the flag reads only its own variable', () => assert.equal(makeLibs({ overrides: { 'lib/chat-edit-targeted.ts': targetedText.replace("process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT === 'true'\n  && ", '') }, env: { [FLAG]: 'true' } }).targeted.CHAT_EDIT_TARGETED_SAVE_ENABLED, false))
await mutant('targeted: begin\'s busy mapped as UNSUPPORTED_OP', () => {
  const lib = makeLibs({ overrides: { 'lib/chat-edit-targeted.ts': targetedText.replace("return 'BUSY'", "return 'UNSUPPORTED_OP'") } })
  assert.equal(lib.targeted.beginErrorCode(new Error('Another targeted save is open'), lib.lib.elementEditCommandErrorCode), 'BUSY')
})
await mutant('targeted: a pending commit read as failed (no status reads: a slow write answers SAVE_FAILED)', async () => {
  const w = await scenario('budget-slow-8s', { putDelayMs: 8_000, libs: { overrides: { 'lib/chat-edit-targeted.ts': targetedText.replace('answer?.pending === true && waited', 'false && waited') } } })
  assert.equal((await w.send(frame(...OPS.move_image))).ok, true)
})
await mutant('targeted: a status read that says saving taken as saved (ok:true before the write lands)', async () => {
  const w = await scenario('budget-too-slow', { putDelayMs: 30_000, libs: { overrides: { 'lib/chat-edit-targeted.ts': targetedText.replace("answer = read?.state === 'saving' ? answer : read", "answer = read?.state === 'saving' ? { saved: true } : read") } } })
  assert.equal((await w.send(frame(...OPS.move_image))).ok, false)
})
if (LIVE && !RECORD) {
  // The REAL Layout script, mutated, loaded over the served one (window.LayoutChatTargetedSave is looked up at each command).
  const layoutMutant = (from, to) => text => { assert.equal(text.split(from).length, 2, from); return text.replace(from, to) }
  await mutant('Layout script: the chat edit\'s marks reach auto-save.js (the whole-deck save comes back)', () => runOn('on-move_image', {}, 'move_image',
    { libs: { layoutScript: layoutMutant('        scope.held += 1;\n        return;\n', '        scope.held += 1;\n') } }))
  await mutant('Layout script: commit leaves the scope open (the next manual change is held, never saved)', () => chatThenManual({ libs: { layoutScript: layoutMutant('    } finally {\n      close(open);\n    }', '    } finally {\n    }') } }))
  await mutant('Layout script: begin holds no slide (null or numbered marks all pass through)', () => runOn('on-move_image', {}, 'move_image',
    { libs: { layoutScript: layoutMutant('    if (!scope) return false;\n', '    return false;\n') } }))
}

if (RECORD) {
  recorded.meta = { recorded_with: 'CHAT_EDIT_TARGETED_LAYOUT_DIR + --record-layout', layout_checkout: 'layout-builder frontend2/layout-targeted-save (LAYOUT_CHAT_TARGETED_SAVE_ENABLED) on uat 05cf75d', studio_origin: STUDIO_ORIGIN,
    sources: Object.fromEntries(['viewer/presentation-viewer.html', 'arrange_commands.py', TARGETED_MODULE, TARGETED_SCRIPT, 'src/utils/arrange-commands.js', 'src/utils/edit-mode.js', 'src/utils/grid-converter.js', 'src/utils/auto-save.js', 'src/utils/element-manager.js', 'server.py', ...RELOAD_SCRIPTS]
      .map(rel => [rel, sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8'))])) }
  fs.mkdirSync(path.dirname(TRANSCRIPTS), { recursive: true })
  fs.writeFileSync(TRANSCRIPTS, `${JSON.stringify(recorded, null, 1)}\n`)
  console.log(`recorded ${Object.keys(recorded.scenarios).length} scenarios`)
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed${LIVE ? ' (live Layout code)' : ' (offline, recorded Layout code)'}`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
