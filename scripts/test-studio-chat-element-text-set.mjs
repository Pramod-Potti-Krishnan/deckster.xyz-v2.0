// FRONTEND-2 (B49, 29 Oct; parity row 44, E2E-2 29 Oct 03:26-03:30Z: a chat "Change this to 'Order Smarter, Waste Less'." on a selected title came back as a model rewrite): proof of the Studio half of element_edit op "text"
// (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET, exact "true", default off, build-time; Director's half is DIRECTOR_MDC_ELEMENT_TEXT_SET_ENABLED). A chat "Change this to '<words>'" on ONE selected text box sets exactly those words.
//
//   node scripts/test-studio-chat-element-text-set.mjs                  # offline: the viewer's replies, its save requests and Layout's server answers come from scripts/fixtures/chat-element-text-set/layout-transcripts.json, recorded from Layout's real code
//   CHAT_ELEMENT_TEXT_SET_LAYOUT_DIR=<layout-builder at frontend2/layout-targeted-save> CHAT_ELEMENT_TEXT_SET_LAYOUT_PYTHON=<a Python with Layout's requirements> node scripts/test-studio-chat-element-text-set.mjs
//                                                                       # also runs the REAL Layout viewer code and the REAL Layout server (server.py) live and checks they say what was recorded
//   ... --record-layout                                                 # (with the variables) re-records the fixture
// (CHAT_EDIT_TARGETED_LAYOUT_DIR / CHAT_EDIT_TARGETED_LAYOUT_PYTHON, #540's names, are taken too.)
//
// THE FRAMES ARE DIRECTOR-2's RECORDED ones (29 Oct, workspace main 85b6f367 streams/director2/text-set/examples, Director MR !598 12a8c5bf), copied to scripts/fixtures/chat-element-text-set/director-frames: 01 (row 44's title gets op "text"), 02 (a value with
// "\n"), 03 (no element_text1 cap: today's element_refine_directive), 04 (over 500 characters: a line and no frame). They are replayed verbatim through the page's runner and the real viewer; the other scenarios vary the element and the value on the
// recorded envelope. The delete / bold ops of the identity checks use the recorded #522 frame. Nothing here is contract-built except those variations.
// What runs: Studio's own sendCommand and ensureEditMode (cut out of components/presentation-viewer.tsx), the page's runner (cut out of app/builder/page.tsx), lib/chat-element-edit.ts (+ -2, -wire, -save), lib/chat-edit-targeted.ts and
// lib/chat-element-text-set.ts in a vm; Layout's REAL viewer (the page bridge with its updateTextBoxContent case, element-manager.js, edit-mode.js, grid-converter.js, auto-save.js, arrange-commands.js, chat-targeted-save.js), a stored deck loaded through
// Layout's own load path (restoreTextBoxes and the template's direct-element-creator.js), and Layout's REAL server (server.py, in process) answering the targeted save. Layout's fetch is recorded, never sent to a network.
// The Layout command: viewer/presentation-viewer.html `updateTextBoxContent {elementId, content}` -> ElementManager.updateTextBoxContent (src/utils/element-manager.js): it sets the `.textbox-content` element's innerHTML (so it takes HTML: Studio sends text,
// escaped, one <p> per paragraph) and the registry's content, and refuses a text box with typed generation params (RECREATE_REQUIRED -> UNSUPPORTED_OP). The box's style is not in that innerHTML: font / size / colour / weight / alignment are inline styles of
// `.textbox-content`, the container's background / border / padding are the box's, the theme bindings are data attributes: they stay.
// What it proves:
//  1. the flag and the capability: element_text1 is advertised only while the flag is on (the exact "true"), right after element_edit1 / notes1, and flag off the caps are byte-identical to dev's; the hook is not touched;
//  2. the value: 1 to 500 characters (code points), no HTML, "\n" between paragraphs; empty, whitespace-only, 501, "<b>x</b>" and the like are INVALID_VALUE and nothing reaches the viewer; the value is stored as TEXT (escaped), never as markup;
//  3. on a stored text box (the real viewer, the real server): the exact words are stored, "\n" as paragraphs, every other field of the box (position, z, text style, container style) is what it was, and a fresh viewer loading the stored deck shows them;
//  4. on edit-mode template text (the slide's layout title, drawn by Layout from slide.content): stored as that title's own text box with the exact words, the style kept, nothing else stored; or an honest answer (see the table);
//  5. a non-text element (an image, a metrics box), a text box with typed params, a locked box: UNSUPPORTED_OP / ELEMENT_LOCKED before anything changes; a stale slide: SLIDE_CHANGED; a missing element: ELEMENT_NOT_FOUND;
//  6. ok:true only once stored: a refused save is SAVE_FAILED, a slow one (8 s, 18 s) is pending then ok, one still unanswered at 20 s is SAVE_FAILED; Layout's flag off: UNSUPPORTED_OP before any change;
//  7. flag off is identical: INVALID_VALUE for op "text" and the same viewer requests, saves and results as dev's runner (hashed), for text and for a regular op; the strip gives dev's files back byte for byte;
//  8. mutants are caught; 9. scope over the COMMITTED diff, GATE-SAFE and robust after merge (subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, registry / .env.example / strip reads past later changes), proved on a gate-style merge, on a
//     merge onto an advanced dev and on a synthetic change stacked after this one.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createClock, createLayoutViewer, replayViewer } from './studio-chat-element-edit-layout.mjs'
import { applyWithLayoutServer, elementState, renderStoredDeck, slotElementId } from './studio-chat-edit-targeted-reload.mjs'
import {
  BASE_COMMIT, CHAT_ELEMENT_TEXT_SET_FILES, CHAT_ELEMENT_TEXT_SET_NEW_FILES, CHAT_ELEMENT_TEXT_SET_PIN_FILES, CHAT_ELEMENT_TEXT_SET_PIN_EDITS, CHAT_ELEMENT_TEXT_SET_PIN_MARK, CHAT_ELEMENT_TEXT_SET_SCOPE_FILES,
  CHAT_ELEMENT_TEXT_SET_ENV_BLOCK, CHAT_ELEMENT_TEXT_SET_MARKER_RE, CHAT_ELEMENT_TEXT_SET_SUBJECT, stripChatElementTextSet,
} from './studio-chat-element-text-set-strip.mjs'
import * as registry from './studio-later-changes.mjs'
import { stripDeckSaveRefused } from './studio-deck-save-refused-strip.mjs' // the save-refused notice (#549) is stacked below this change: its marked lines in the viewer's save-status handler (isDeckSaveRefused) come out before the handler is cut out and evaluated

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const TRANSCRIPTS = path.join(root, 'scripts/fixtures/chat-element-text-set/layout-transcripts.json')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const [WIRE, RUNNER, TEXT_LIB] = ['lib/chat-element-edit-wire.ts', 'lib/chat-element-edit.ts', 'lib/chat-element-text-set.ts']

/** The strips of every change registered AFTER this one (below this change's strip in LATER_STRIPS), applied first: a file is read as this change left it, whatever a later change marked in it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripChatElementTextSet); return (at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1)).reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text) }
const laterRead = rel => laterStrips(rel, read(rel))
/** Every OTHER registered change's strip, in the registry's order (this change's is left out). */
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripChatElementTextSet), rel, text)
const laterBlob = (ref, rel) => laterStrips(rel, git('show', `${ref}:${rel}`))
const laterBlocks = () => { const at = registry.LATER_ENV_BLOCKS.indexOf(CHAT_ELEMENT_TEXT_SET_ENV_BLOCK); return at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1) }
/** `text` (an .env.example) without the blocks registered AFTER this one: theirs, not this change's. */
const withoutLaterEnvBlocks = text => laterBlocks().reduce((out, block) => { const body = String(block).replace(/^\n+/, '').replace(/\n+$/, ''); return body === '' ? out : out.replace(`\n${body}\n`, () => '') }, text)

const RECORD = process.argv.includes('--record-layout')
const LAYOUT_DIR = (process.env.CHAT_ELEMENT_TEXT_SET_LAYOUT_DIR || process.env.CHAT_EDIT_TARGETED_LAYOUT_DIR) ? path.resolve(process.env.CHAT_ELEMENT_TEXT_SET_LAYOUT_DIR || process.env.CHAT_EDIT_TARGETED_LAYOUT_DIR) : null
const PYTHON = process.env.CHAT_ELEMENT_TEXT_SET_LAYOUT_PYTHON || process.env.CHAT_EDIT_TARGETED_LAYOUT_PYTHON || null
const LIVE = Boolean(LAYOUT_DIR)
if (RECORD && !LIVE) throw new Error('--record-layout needs CHAT_ELEMENT_TEXT_SET_LAYOUT_DIR')
if (LIVE && !PYTHON) throw new Error('the live run needs CHAT_ELEMENT_TEXT_SET_LAYOUT_PYTHON (a Python with layout-builder\'s requirements) for Layout\'s own server')
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
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }

// ---- the flags and the Studio libs in a vm ---------------------------------------------------------------------------------------------------
const FLAG_EDIT = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT', FLAG_EDIT_2 = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2', FLAG_TARGETED = 'NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE', FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET'
const BASE_ENV = { [FLAG_EDIT]: 'true', [FLAG_EDIT_2]: 'true', [FLAG_TARGETED]: 'true' } // what dev has: chat element edit, #538 and #540 on, this change off
const ENVS = { on: { ...BASE_ENV, [FLAG]: 'true' }, off: BASE_ENV, 'on-whole-deck': { [FLAG_EDIT]: 'true', [FLAG_EDIT_2]: 'true', [FLAG]: 'true' }, 'off-whole-deck': { [FLAG_EDIT]: 'true', [FLAG_EDIT_2]: 'true' } }
function makeLibs({ env = ENVS.on, overrides = {}, clock = null } = {}) {
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
  return { wire: load(WIRE), save: load('lib/chat-element-edit-save.ts'), lib: load(RUNNER), targeted: load('lib/chat-edit-targeted.ts'), textSet: load(TEXT_LIB), load }
}
/** dev's runner and wire: this change's marked lines out. */
const BASE_OVERRIDES = { [WIRE]: stripChatElementTextSet(WIRE, read(WIRE)), [RUNNER]: stripChatElementTextSet(RUNNER, read(RUNNER)) }

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

// ---- the deck: Layout's stored form (restoreTextBoxes / restoreImages), three C1 slides whose titles are slide.content (layout text: direct-element-creator.js draws them) ----------
const SESSION = 's_e2e', PRESENTATION = 'pres-e2e', STUDIO_ORIGIN = 'https://studio.example', LAYOUT_ORIGIN = 'https://layout.example'
const TEXT_STYLE = { font_size: '24px', color: '#1f2937', font_weight: '700', text_align: 'center', font_family: 'Inter' }
const BOX_STYLE = { background_color: '#eef2ff', border_color: '#6366f1', border_width: 2, border_radius: 8, opacity: 1, padding_top: 12, padding_right: 12, padding_bottom: 12, padding_left: 12 }
const box = (id, row, col, content, extra = {}) => ({ id, parent_slide_id: 'L1', position: { grid_row: row, grid_column: col }, z_index: 100, content, ...extra })
const STORED = { id: PRESENTATION, title: 'T', slides: [
  { layout: 'C1', slide_id: 'L0', content: { slide_title: 'Cover' }, text_boxes: [], images: [] },
  { layout: 'C1', slide_id: 'L1', content: { slide_title: 'Where we lose' },
    text_boxes: [
      box('textbox_b', '6/10', '12/24', '<p>High-turnover fresh</p>', { text_style: TEXT_STYLE, style: BOX_STYLE }),
      box('textbox_c', '11/15', '12/24', '<p>Neighbour</p>', { text_style: { font_size: '18px' } }),
      box('metrics_b', '11/15', '2/10', '<div class="metric">42%</div>', { component_type: 'METRICS' }),
      box('locked_b', '16/18', '12/24', '<p>Locked</p>', { locked: true }),
      box('typed_b', '16/18', '2/10', '<p>Typed</p>', { element_metadata: { regeneration_mode: 'typed', component_type: 'TEXT_BOX' } }),
    ],
    images: [{ id: 'image_b', parent_slide_id: 'L1', position: { grid_row: '6/16', grid_column: '2/11' }, z_index: 100, image_url: 'https://img.example/a.png' }] },
  { layout: 'C1', slide_id: 'L2', content: { slide_title: 'Plan' }, text_boxes: [box('textbox_a1', '6/10', '4/28', '<p>Old title</p>', { parent_slide_id: 'L2', text_style: TEXT_STYLE })], images: [] }, // textbox_a1: the box DIRECTOR-2's recorded frames name (slide 3, L2)
] }
const FRAMES_DIR = path.join(root, 'scripts/fixtures/chat-element-edit/director-frames')
const TEXT_FRAMES_DIR = path.join(root, 'scripts/fixtures/chat-element-text-set/director-frames') // DIRECTOR-2's RECORDED frames for op "text" (workspace main 85b6f367, streams/director2/text-set/examples; Director MR !598 12a8c5bf)
const RECORDED = Object.fromEntries(['01-row-44-title', '02-multi-line', '03-no-element-text1-refine-fallback', '04-over-500-characters'].map(name => [name, JSON.parse(fs.readFileSync(path.join(TEXT_FRAMES_DIR, `${name}.json`), 'utf8'))]))
const recordedDirective = JSON.parse(fs.readFileSync(path.join(FRAMES_DIR, '01-delete-ok.json'), 'utf8')).frames_out.flat().find(item => item.type === 'element_edit') // a recorded delete: the envelope of the regular ops
const recordedTextFrame = RECORDED['01-row-44-title'].director_frames[0]
assert.equal(recordedTextFrame.type, 'element_edit'); assert.equal(recordedTextFrame.payload.op, 'text')
let counter = 0
/** A directive on Director's RECORDED op "text" envelope (01-row-44-title) with the element, value and slide set per scenario, for slide 2 (index 1, slide_id L1) unless told otherwise. The recorded frames themselves are replayed verbatim by the "recorded frame" checks. */
const frame = (elementId, text, slide = { slide_index: 1, slide_id: 'L1' }, op = 'text') => ({ ...plain(recordedTextFrame), message_id: `msg_t_${++counter}`,
  payload: { ...plain(recordedTextFrame.payload), directive_id: `ele_t_${counter}`, ...slide, element_id: elementId, op, ...(text === undefined ? { text: undefined } : { text }) } })
const regularFrame = (op, elementId, extra) => ({ ...plain(recordedDirective), message_id: `msg_t_${++counter}`, payload: { ...plain(recordedDirective.payload), directive_id: `ele_t_${counter}`, slide_index: 1, slide_id: 'L1', element_id: elementId, op, ...extra } })
const fakeResponse = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body })
const TITLE = { slot: 'title', slideIndex: 1 }
/** The id Layout draws for slide 2's layout title (deterministic: the harness seeds crypto); offline it is the recorded one. */
const titleId = viewer => (LIVE ? slotElementId(viewer, 1, 'title') : recorded.meta.titleId)

/** One scenario: the Studio window and iframe with the real sendCommand, ensureEditMode and page runner over a viewer (live Layout code, or its recording). `server`: Layout's own server answers the saves against the stored deck. */
async function scenario(name, { env = 'on', layout = 'on', editMode = false, libs: libOptions = {}, shownIds = ['L0', 'L1', 'L2'], stored = STORED, server = false, putDelayMs = 0, putStatus = 200, transcriptFrom = null } = {}) {
  const clock = createClock()
  const libs = makeLibs({ env: ENVS[env], clock, ...libOptions })
  const listeners = new Set()
  const sent = []
  const fetches = []
  const answers = server ? { deck: plain(stored), statuses: [], summaries: [] } : null
  const key = transcriptFrom ?? name
  const studioWindow = { addEventListener(type, fn) { if (type === 'message') listeners.add(fn) }, removeEventListener(type, fn) { if (type === 'message') listeners.delete(fn) }, dispatchEvent() {} }
  let viewer = null
  const viewerHandle = { postMessage(data, targetOrigin) { assert.equal(targetOrigin, LAYOUT_ORIGIN); const request = plain(data); queueMicrotask(() => { viewer.deliver(request, STUDIO_ORIGIN).catch(error => { throw error }) }) } }
  const toStudio = data => queueMicrotask(() => { for (const fn of [...listeners]) fn({ source: viewerHandle, origin: LAYOUT_ORIGIN, data: plain(data) }) })
  const mutated = Object.keys(libOptions.overrides ?? {}).length > 0 || Boolean(libOptions.layoutScript)
  if (LIVE) {
    viewer = createLayoutViewer({ layoutDir: LAYOUT_DIR, studioOrigin: STUDIO_ORIGIN, parent: { postMessage: toStudio }, clock, presentationId: PRESENTATION, arrange: true, targeted: layout === 'on',
      fetchImpl: async (url, init) => {
        const request = { method: init?.method ?? 'GET', url: String(url), body: init?.body ? JSON.parse(init.body) : null }
        fetches.push({ at: clock.now(), ...request })
        if (answers) { // Layout's own server (server.py) answers, against the deck it stores
          const [answer] = applyWithLayoutServer(PYTHON, LAYOUT_DIR, [{ deck: answers.deck, requests: [request] }])
          answers.deck = answer.deck; answers.statuses.push(answer.statuses[0]); answers.summaries.push(...answer.summaries)
          return fakeResponse(answer.statuses[0], answer.bodies[0])
        }
        const response = fakeResponse(putStatus, putStatus === 200 ? { success: true } : { detail: { code: 'SYNTHETIC', message: 'synthetic save refusal' } })
        return putDelayMs ? new Promise(resolve => clock.setTimeout(() => resolve(response), putDelayMs)) : response
      } })
    if (libOptions.layoutScript) vm.runInContext(libOptions.layoutScript(fs.readFileSync(path.join(LAYOUT_DIR, 'src/utils/chat-targeted-save.js'), 'utf8')), viewer.context)
    renderStoredDeck(viewer, stored, LAYOUT_DIR) // Layout's own load path (scripts/studio-chat-edit-targeted-reload.mjs)
    if (editMode) viewer.enterEditMode()
  } else {
    const transcript = recorded.scenarios[key]
    assert.ok(transcript, `a recorded Layout transcript for "${key}" (record with CHAT_ELEMENT_TEXT_SET_LAYOUT_DIR=... --record-layout)`)
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
  const viewerTsx = stripDeckSaveRefused('components/presentation-viewer.tsx', read('components/presentation-viewer.tsx')) // the handler below is cut from the viewer without the stacked change's lines (no fake binding for its calls)
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
  const pageText = read('app/builder/page.tsx')
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
    clock, sent, viewer, libs, answers,
    fetches: () => (LIVE ? fetches : recorded.scenarios[key].fetches),
    server: () => (LIVE ? answers : recorded.scenarios[key].server),
    actions: () => viewer.log.requests.map(item => item.action),
    requests: () => viewer.log.requests,
    /** What the viewer shows for a text box: its words and its own style (the box's, not the words'). */
    probe: id => {
      if (!LIVE) return recorded.scenarios[key].probes?.[id] ?? null
      const node = viewer.document.getElementById(id)
      const content = node?.querySelector('.textbox-content')
      return node ? { content: content?.innerHTML ?? null, text: { fontSize: content?.style.fontSize ?? null, color: content?.style.color ?? null, fontWeight: content?.style.fontWeight ?? null, textAlign: content?.style.textAlign ?? null, fontFamily: content?.style.fontFamily ?? null },
        box: { gridRow: node.style.gridRow ?? null, gridColumn: node.style.gridColumn ?? null, zIndex: node.style.zIndex ?? null, background: node.style.backgroundColor ?? node.style.background ?? null, borderRadius: node.style.borderRadius ?? null } } : null
    },
    probes: {},
    async send(message) {
      const before = sent.length
      runner(plain(message), owner)
      for (let spent = 0; sent.length === before && spent < 60_000; spent += 50) await clock.advance(50)
      assert.ok(sent.length > before, 'a result was sent')
      await clock.advance(10_000) // past auto-save.js's 2.5 s debounce: a scheduled whole-deck save would have gone out by now
      return sent.at(-1)
    },
    /** A directive whose answer is the only thing to look at: nothing may reach the viewer. */
    async sendQuiet(message) { const result = await world.send(message); assert.equal(world.requests().length, 0, 'nothing reached the viewer'); assert.equal(world.fetches().length, 0, 'nothing was saved'); return result },
    finish(ids = []) {
      if (LIVE) for (const id of ids) world.probes[id] = world.probe(id)
      if (RECORD && !mutated) recorded.scenarios[name] = { ...plain(viewer.log), fetches: plain(fetches), server: plain(answers), probes: plain(world.probes) }
      if (LIVE && !RECORD && !mutated) {
        const was = recorded.scenarios[name]
        assert.deepEqual(plain(viewer.log.requests), was.requests, `${name}: the live viewer was asked what was recorded`)
        assert.deepEqual(plain(viewer.log.frames), was.frames, `${name}: the live viewer answered what was recorded`)
        assert.deepEqual(plain(fetches), was.fetches, `${name}: the live viewer saved what was recorded`)
        assert.deepEqual(plain(answers), was.server, `${name}: Layout's server stored what was recorded`)
        assert.deepEqual(plain(world.probes), was.probes, `${name}: the viewer ended as recorded`)
      }
      if (!LIVE) {
        assert.equal(viewer.log.requests.length, recorded.scenarios[key].requests.length, `${name}: every recorded request was made (no more, no fewer)`)
        assert.equal(viewer.log.divergence, null, `${name}: no request diverged from the recording`)
      }
    },
  }
  return world
}


/** A fresh viewer that loads `deck` through Layout's own load path, as a reload does. The harness seeds the random ids of the elements the template draws, the same in every viewer: the ids already used are spent first, so a stored box keeps its own id as it would with real random ones. */
function reloadedViewer(deck) {
  const fresh = createLayoutViewer({ layoutDir: LAYOUT_DIR, studioOrigin: STUDIO_ORIGIN, parent: { postMessage() {} }, clock: createClock(), presentationId: PRESENTATION, arrange: true, targeted: true })
  renderStoredDeck(fresh, { slides: [] }, LAYOUT_DIR)
  for (let i = 0; i < 40; i++) fresh.context.crypto.getRandomValues(new Uint8Array(4))
  renderStoredDeck(fresh, deck, LAYOUT_DIR)
  return fresh
}
const putsTo = (fetches, re) => fetches.filter(item => item.method === 'PUT' && re.test(item.url))
const WHOLE_DECK = new RegExp(`/api/presentations/${PRESENTATION}/slides$`)
const CHAT_SAVE = /\/slides\/\d+\/elements\/[^/]+\/chat-save$/
const resultShape = result => JSON.stringify({ ...result, directive_id: 'd' })
const storedBox = (deck, id, slide = 1) => (deck.slides[slide].text_boxes || []).find(item => item.id === id)
const paragraphs = text => text.split('\n').map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</p>`).join('')
/** The words of a stored content string, as a browser would read them (the harness has no HTML parser: the <p> paragraphs and the five escapes this change writes). */
const wordsOf = html => html.replace(/^<p>/, '').replace(/<\/p>$/, '').split('</p><p>').map(line => line.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')).join('\n')
const clonePlain = plain

// ===== 1. the flag and the capability ===========================================================================================================
const CAPS_IN = [undefined, [], ['mdc1'], ['mdc1', 'element_refine1'], ['mdc1', 'element_edit1'], ['mdc1', 'notes1', 'element_edit1'], ['mdc1', 7, null, 'themes1'], ['element_text1'], ['mdc1', 'element_text1', 'bulk_edit1']]
const capsOf = (libs, input) => JSON.stringify(libs.wire.addChatElementEditCaps({ text: 'x', client_caps: input === undefined ? undefined : clonePlain(input) }))
await check('flag: on only for the exact "true" of NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET (the runner is dev\'s flags\'); .env.example has the block after a blank line', async () => {
  assert.equal(makeLibs({ env: ENVS.on }).wire.CHAT_ELEMENT_TEXT_SET_ENABLED, true)
  assert.equal(makeLibs({ env: ENVS.off }).wire.CHAT_ELEMENT_TEXT_SET_ENABLED, false)
  for (const value of ['1', 'TRUE', 'yes', ' true', 'True', '', 'false']) assert.equal(makeLibs({ env: { ...BASE_ENV, [FLAG]: value } }).wire.CHAT_ELEMENT_TEXT_SET_ENABLED, false, JSON.stringify(value))
  const env = read('.env.example')
  assert.ok(env.includes(`\n\n${CHAT_ELEMENT_TEXT_SET_ENV_BLOCK}`), 'the .env.example block, after a blank line')
  assert.ok(withoutLaterEnvBlocks(env).endsWith(`${FLAG}="false"\n`), 'the block is the last of this change and above it, the blocks registered after this one aside')
})
await check('capability: flag on, element_text1 comes right after element_edit1 / notes1 in client_caps (after the caps already there), once; flag off, the caps are byte-identical to dev\'s for every input', async () => {
  const on = makeLibs({ env: ENVS.on }), off = makeLibs({ env: ENVS.off }), base = makeLibs({ env: ENVS.on, overrides: BASE_OVERRIDES })
  assert.equal(on.wire.ELEMENT_TEXT_CLIENT_CAP, 'element_text1')
  assert.deepEqual(JSON.parse(capsOf(on, ['mdc1', 'element_refine1'])).client_caps, ['mdc1', 'element_refine1', 'element_edit1', 'notes1', 'element_text1'])
  assert.deepEqual(JSON.parse(capsOf(on, undefined)).client_caps, ['element_edit1', 'notes1', 'element_text1'])
  assert.deepEqual(JSON.parse(capsOf(on, ['element_text1', 'mdc1'])).client_caps, ['element_text1', 'mdc1', 'element_edit1', 'notes1'], 'not twice')
  for (const input of CAPS_IN) {
    const flagOn = JSON.parse(capsOf(on, input)).client_caps, dev = JSON.parse(capsOf(base, input)).client_caps
    assert.deepEqual(flagOn, (input ?? []).includes('element_text1') ? dev : [...dev, 'element_text1'], 'dev\'s list, plus element_text1 at the end unless it was already there')
    if (!(input ?? []).includes('element_text1')) assert.ok(flagOn.indexOf('element_text1') > flagOn.indexOf('element_edit1'), 'after element_edit1')
    assert.equal(sha(capsOf(off, input)), sha(capsOf(base, input)), `flag off, input ${JSON.stringify(input)}: byte-identical to dev's (hashed)`)
    assert.ok(!capsOf(off, input).includes('element_text1') || (input ?? []).includes('element_text1'), 'flag off adds nothing')
  }
})
await check('capability: the hook is NOT touched (it already calls addChatElementEditCaps, only with CHAT_ELEMENT_EDIT on), so the cap needs the chat element edit flag', async () => {
  const hook = read('hooks/use-deckster-websocket-v2.ts')
  assert.equal(hook.split('addChatElementEditCaps(message.data').length, 2)
  assert.match(hook, /if \(CHAT_ELEMENT_EDIT_ENABLED\) addChatElementEditCaps\(message\.data as unknown as Record<string, unknown>\);/)
  assert.ok(!hook.includes('element_text1') && !hook.includes('CHAT-ELEMENT-TEXT-SET'))
  const withoutEdit = makeLibs({ env: { [FLAG]: 'true' } })
  assert.equal(withoutEdit.wire.CHAT_ELEMENT_EDIT_ENABLED, false, 'the hook calls addChatElementEditCaps only if this is true')
})

// ===== 2. the value =============================================================================================================================
const longText = length => 'a'.repeat(length)
const VALUE_CASES = [
  // [label, value, valid?]
  ['plain words', 'Order Smarter, Waste Less', true], ['one character', 'x', true], ['500 characters', longText(500), true], ['500 emoji (1000 UTF-16 units: code points count, as Director\'s len does)', '😀'.repeat(500), true],
  ['paragraphs', 'Line one\nLine two', true], ['a CRLF break', 'Line one\r\nLine two', true], ['quotes, ampersand, apostrophe', 'Tom & Jerry\'s "plan"', true], ['an entity written out (the user\'s own characters)', 'AT&amp;T', true],
  ['"5 < 6 and 7 > 3" (comparison signs are text)', '5 < 6 and 7 > 3', true], ['"<3" (a heart)', 'I <3 stock', true],
  ['empty', '', false], ['spaces only', '   ', false], ['line breaks only', '\n\n', false], ['501 characters', longText(501), false], ['501 emoji', '😀'.repeat(501), false],
  ['<b>x</b>', '<b>x</b>', false], ['an opening tag', 'hello <i>there', false], ['a closing tag', 'there</p>', false], ['a self-closing tag', 'a<br/>b', false], ['a script tag', '<script>alert(1)</script>', false],
  ['an img tag with attributes', '<img src=x onerror=alert(1)>', false], ['a comment', 'a <!-- hidden --> b', false], ['a doctype', '<!DOCTYPE html>', false], ['CDATA', '<![CDATA[x]]>', false], ['a processing instruction', '<?xml version="1.0"?>', false],
  ['a number', 12, false], ['null', null, false], ['undefined', undefined, false], ['an object', { text: 'x' }, false], ['an array', ['x'], false],
]
await check('value: 1 to 500 characters (code points), at least one word, no HTML; the rest is INVALID_VALUE (table of 30)', async () => {
  const { textSet } = makeLibs()
  for (const [label, value, valid] of VALUE_CASES) {
    const result = textSet.validateElementText(value)
    assert.equal(result.ok, valid, label)
    if (!valid) assert.equal(result.code, 'INVALID_VALUE', label)
  }
  assert.equal(textSet.validateElementText('a\r\nb').text, 'a\nb', 'line breaks are "\\n"')
  assert.deepEqual([textSet.ELEMENT_TEXT_MIN_CHARS, textSet.ELEMENT_TEXT_MAX_CHARS], [1, 500])
})
await check('value: written as TEXT: every & < > " \' is escaped, one <p> per paragraph, a line with no word is no paragraph; never the value as given', async () => {
  const { textSet } = makeLibs()
  assert.equal(textSet.elementTextToHtml('Order Smarter, Waste Less'), '<p>Order Smarter, Waste Less</p>')
  assert.equal(textSet.elementTextToHtml('One\nTwo\nThree'), '<p>One</p><p>Two</p><p>Three</p>')
  assert.equal(textSet.elementTextToHtml('One\n\n  \nTwo'), '<p>One</p><p>Two</p>')
  assert.equal(textSet.elementTextToHtml('Tom & Jerry\'s "plan" 5 < 6 > 3'), '<p>Tom &amp; Jerry&#39;s &quot;plan&quot; 5 &lt; 6 &gt; 3</p>')
  assert.equal(textSet.elementTextToHtml('AT&amp;T'), '<p>AT&amp;amp;T</p>', 'a typed entity stays the characters the user typed')
  for (const [label, value, valid] of VALUE_CASES) if (valid) { const html = textSet.elementTextToHtml(textSet.validateElementText(value).text); assert.equal(html.replace(/<\/?p>/g, '').match(/[<>"']/), null, `${label}: no raw markup character is left`); assert.equal(wordsOf(html), textSet.validateElementText(value).text.split('\n').filter(line => line.trim() !== '').join('\n'), `${label}: the words come back`) }
})

// ===== 3. contract-built frames through the runner: INVALID_VALUE reaches nothing ===========================================================================
for (const [label, value] of [['empty', ''], ['spaces', '  '], ['501 characters', longText(501)], ['"<b>x</b>"', '<b>x</b>'], ['no text field', undefined], ['a number', 7]]) {
  await check(`invalid value (${label}): INVALID_VALUE, nothing reaches the viewer, nothing is stored`, async () => {
    const w = await scenario(`on-invalid-${label.replace(/[^a-z0-9]+/gi, '_')}`)
    const result = await w.sendQuiet(frame('textbox_b', value))
    assert.deepEqual(Object.keys(result).sort(), ['directive_id', 'error_code', 'ok'])
    assert.equal(result.ok, false)
    assert.equal(result.error_code, 'INVALID_VALUE')
    w.finish()
  })
}

// ===== 4. a stored text box: the exact words, the style kept ======================================================================================================
const WORDS = 'Order Smarter, Waste Less'
const ON_CASES = {
  exact: { text: WORDS, html: `<p>${WORDS}</p>` },
  paragraphs: { text: 'Order Smarter\nWaste Less', html: '<p>Order Smarter</p><p>Waste Less</p>' },
  escaped: { text: 'Tom & Jerry\'s "plan" 5 < 6 > 3', html: '<p>Tom &amp; Jerry&#39;s &quot;plan&quot; 5 &lt; 6 &gt; 3</p>' },
  max500: { text: longText(500), html: `<p>${longText(500)}</p>` },
}
const onRuns = {}
let baselineSave = null // the record the box saves when its words are set to the words it already has: everything but the words is the box's
await check('baseline: setting a text box to the words it already has saves the box as it is (the style, place and z-order are the stored ones)', async () => {
  const w = await scenario('on-text-same', { server: true })
  const result = await w.send(frame('textbox_b', 'High-turnover fresh'))
  assert.equal(result.ok, true)
  assert.equal(w.fetches().length, 1)
  baselineSave = w.fetches()[0]
  assert.equal(baselineSave.body.element.content, '<p>High-turnover fresh</p>')
  for (const [name, value] of Object.entries(TEXT_STYLE)) assert.equal(baselineSave.body.element.text_style?.[name], value, `text_style.${name}`)
  assert.deepEqual(baselineSave.body.element.position, STORED.slides[1].text_boxes[0].position)
  w.finish(['textbox_b'])
})
for (const [key, spec] of Object.entries(ON_CASES)) {
  await check(`flag on, stored text box (${key}): the exact words are stored by Layout's server through ONE chat-save PUT of that box, as text; every other field of the box is what it was; no whole-deck save, nothing on any other slide or element; a reload shows them`, async () => {
    const w = await scenario(`on-text-${key}`, { server: true })
    const before = LIVE ? w.probe('textbox_b') : null
    const result = await w.send(frame('textbox_b', spec.text))
    onRuns[key] = result
    assert.deepEqual(Object.keys(result).sort(), ['directive_id', 'ok'])
    assert.equal(result.ok, true)
    assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0, 'no whole-deck save')
    assert.equal(w.fetches().length, 1, 'one request to Layout in all')
    const [save] = w.fetches()
    assert.equal(save.method, 'PUT')
    assert.equal(save.url, `/api/presentations/${PRESENTATION}/slides/1/elements/textbox_b/chat-save`)
    assert.equal(save.body.slide_id, 'L1')
    assert.equal(save.body.collection, 'text_boxes')
    assert.equal(save.body.element.id, 'textbox_b')
    assert.equal(save.body.element.content, spec.html, 'the saved record holds the words as text')
    assert.equal(wordsOf(save.body.element.content), spec.text, 'and they read back exactly')
    for (const other of ['textbox_c', 'metrics_b', 'locked_b', 'typed_b', 'image_b', 'Neighbour']) assert.ok(!JSON.stringify(save.body).includes(other), `${other} is not in the save`)
    const actions = w.actions()
    assert.deepEqual(actions.filter(action => action === 'updateTextBoxContent').length, 1)
    assert.ok(!actions.includes('saveAllChanges') && !actions.includes('generateTextBoxContent') && !actions.includes('requestElementRefine'), 'no viewer Save, no rewrite')
    const begin = actions.indexOf('beginTargetedElementSave'), set = actions.indexOf('updateTextBoxContent'), commit = actions.indexOf('commitTargetedElementSave')
    assert.ok(begin > actions.indexOf('getSlideGenerationContext') && set > begin && commit === actions.length - 1 && commit > set, actions.join(','))
    const sentContent = w.requests().find(item => item.action === 'updateTextBoxContent').params
    assert.deepEqual(Object.keys(sentContent).sort(), ['content', 'elementId'])
    assert.equal(sentContent.content, spec.html)
    // the server: the stored box is the box it was, with the words (style kept: every other field of the record is the stored one)
    const stored = storedBox(w.server().deck, 'textbox_b')
    assert.equal(stored.content, spec.html)
    const original = storedBox(STORED, 'textbox_b')
    assert.deepEqual(stored.position, original.position, 'position')
    for (const [name, value] of Object.entries(TEXT_STYLE)) assert.equal(stored.text_style?.[name], value, `text_style.${name}`)
    const unchanged = { ...save.body.element, content: null }, baseline = { ...baselineSave.body.element, content: null }
    assert.deepEqual(unchanged, baseline, 'the saved record is, but for its words, the record the same box saves when its words stay as they were (the style, the place, the z-order, the theme bindings)')
    assert.deepEqual(w.server().deck.slides.map(slide => (slide.text_boxes || []).length), [0, 5, 1], 'no layout text became a text box on any slide')
    for (const id of ['textbox_c', 'metrics_b', 'locked_b', 'typed_b']) assert.equal(storedBox(w.server().deck, id).content, storedBox(STORED, id).content, `${id} is untouched`)
    assert.deepEqual(w.server().deck.slides[1].images, STORED.slides[1].images, 'the image is untouched')
    assert.deepEqual(w.server().statuses, [200])
    // a reload: a fresh viewer loads the stored deck (Layout's load path) and shows the words with the same style
    if (LIVE) {
      const fresh = reloadedViewer(w.server().deck)
      const node = fresh.document.getElementById('textbox_b'), content = node.querySelector('.textbox-content')
      w.probes.reloaded = { content: content.innerHTML, fontSize: content.style.fontSize, color: content.style.color, fontWeight: content.style.fontWeight, textAlign: content.style.textAlign, row: node.style.gridRow, col: node.style.gridColumn }
      assert.equal(content.innerHTML, spec.html)
      assert.deepEqual([content.style.fontSize, content.style.color, content.style.fontWeight, content.style.textAlign], ['24px', '#1f2937', '700', 'center'], 'the reloaded box has its style')
      assert.equal(before.text.fontSize, '24px', 'and it had it before')
      assert.deepEqual(w.probe('textbox_b').text, before.text, 'the viewer\'s box keeps its text style through the change')
      assert.deepEqual(w.probe('textbox_b').box, before.box, 'and its container style and place')
    } else assert.deepEqual(recorded.scenarios[`on-text-${key}`].probes.reloaded.content, spec.html)
    w.finish(['textbox_b'])
  })
}

// ===== 5. edit-mode template text: the slide's layout title ==================================================================================================
// The title is slide.content (layout text): Layout's direct-element-creator.js draws it as a text box on every load. E2E-2 rows 43-46: in Edit mode it is a text box the viewer handles (bold, z-order and moves are stored as its own text box).
const titleRuns = {}
for (const [key, spec] of Object.entries({ exact: ON_CASES.exact, paragraphs: ON_CASES.paragraphs })) {
  await check(`flag on, the slide's layout title (${key}): the exact words are stored as that title's own text box by ONE chat-save PUT; nothing else is stored; a reload shows the new words in the title, with its style`, async () => {
    const w = await scenario(`on-title-${key}`, { server: true })
    const id = titleId(w.viewer)
    assert.ok(id, 'the layout title has an id')
    const before = LIVE ? w.probe(id) : null
    const result = await w.send(frame(id, spec.text))
    titleRuns[key] = result
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0)
    assert.equal(w.fetches().length, 1)
    const [save] = w.fetches()
    assert.equal(save.url, `/api/presentations/${PRESENTATION}/slides/1/elements/${id}/chat-save`)
    assert.equal(save.body.element.id, id)
    assert.equal(save.body.element.content, spec.html)
    assert.equal(save.body.element.slot_name, 'title', 'it is the title\'s own box')
    const stored = w.server().deck
    assert.equal(storedBox(stored, id).content, spec.html)
    assert.deepEqual(stored.slides.map(slide => (slide.text_boxes || []).map(item => item.id)), [[], [...STORED.slides[1].text_boxes.map(item => item.id), id], ['textbox_a1']], 'only the title became a stored box; no other slide\'s layout text did')
    assert.equal(stored.slides[1].content.slide_title, 'Where we lose', 'slide.content is not rewritten (the stored box is what Layout draws the title from on a reload)')
    if (LIVE) {
      const fresh = reloadedViewer(stored)
      assert.ok(fresh.document.getElementById(id), 'the title is on the reloaded slide, under its own id')
      const titles = fresh.slide(1).querySelectorAll('.inserted-textbox').filter(node => node.getAttribute('data-slot-name') === 'title')
      w.probes.reloaded = { count: titles.length, content: titles.map(node => node.querySelector('.textbox-content')?.innerHTML ?? null), fontSize: titles.map(node => node.querySelector('.textbox-content')?.style.fontSize ?? null) }
      assert.equal(titles.length, 1, 'one title on the slide after a reload')
      assert.equal(w.probes.reloaded.content[0], spec.html, 'the reloaded title shows the new words')
      assert.equal(w.probes.reloaded.fontSize[0], before.text.fontSize, 'with the title\'s own size')
      assert.deepEqual(w.probe(id).text, before.text, 'the viewer\'s title keeps its text style through the change')
    } else assert.equal(recorded.scenarios[`on-title-${key}`].probes.reloaded.content[0], spec.html)
    w.finish([])
  })
}

// ===== 5b. DIRECTOR-2's recorded frames, verbatim ===============================================================================================================
const recordedResult = name => RECORDED[name].studio_replies[0].payload
for (const [name, slot] of [['01-row-44-title', 'exact'], ['02-multi-line', 'lines']]) {
  await check(`recorded frame ${name}: Director's element_edit op "text", replayed verbatim through the page's runner and the real viewer, is answered exactly as Director's recorded Studio reply; the words are stored on slide 3's textbox_a1 as the recorded value says`, async () => {
    const recordedFrame = RECORDED[name].director_frames[0]
    const value = recordedFrame.payload.text
    assert.equal(recordedFrame.payload.op, 'text')
    const w = await scenario(`rec-${name}`, { server: true })
    const result = await w.send(plain(recordedFrame))
    assert.deepEqual(result, recordedResult(name), 'the result is the recorded element_edit_result (same directive_id, ok:true)')
    assert.equal(w.sent.length, 1, 'Studio sends the one result and no text of its own (the chat lines are Director\'s)')
    const [save] = w.fetches()
    assert.equal(w.fetches().length, 1)
    assert.equal(save.url, `/api/presentations/${PRESENTATION}/slides/2/elements/textbox_a1/chat-save`)
    assert.equal(save.body.slide_id, 'L2')
    assert.equal(save.body.element.content, paragraphs(value), 'the stored content: one <p> per paragraph of the recorded value')
    assert.equal(wordsOf(save.body.element.content), value, 'and the words read back exactly')
    if (name === '02-multi-line') assert.equal(save.body.element.content, '<p>Line one</p><p>Line two</p>', '"\\n" became paragraphs')
    assert.equal(storedBox(w.server().deck, 'textbox_a1', 2).content, paragraphs(value))
    for (const [key, original] of Object.entries(TEXT_STYLE)) assert.equal(save.body.element.text_style?.[key], original, `the box keeps its ${key}`)
    assert.deepEqual(w.server().deck.slides.map(slide => (slide.text_boxes || []).length), [0, 5, 1])
    assert.deepEqual(RECORDED[name].director_chat_lines.length, 2, 'Director\'s receipt and its closing line are Director\'s')
    w.finish(['textbox_a1'])
  })
}
await check('recorded frame 03 (no element_text1 in the client\'s caps): Director falls back to today\'s element_refine_directive; Studio advertises element_text1 only with the flag on (flag off: the caps are the recorded 03 caps, flag on: the recorded 01 caps) and does not take a refine directive for an element_edit', async () => {
  const [one, three] = [RECORDED['01-row-44-title'], RECORDED['03-no-element-text1-refine-fallback']]
  assert.equal(three.director_frames[0].type, 'element_refine_directive')
  assert.ok(!three.user_message.data.client_caps.includes('element_text1') && one.user_message.data.client_caps.includes('element_text1'))
  const set = list => [...list].sort()
  const studioSends = (env, input) => makeLibs({ env }).wire.addChatElementEditCaps({ text: 'x', client_caps: [...input] }).client_caps.filter(cap => cap !== 'notes1') // Director's samples list the caps that matter to the route; Studio also sends notes1
  const ask = ['mdc1', 'element_refine1'] // what Studio sends before the chat element edit caps are added
  assert.deepEqual(set(studioSends(ENVS.off, ask)), set(three.user_message.data.client_caps), 'flag off: the caps of the recorded fallback (no element_text1)')
  assert.deepEqual(set(studioSends(ENVS.on, ask)), set(one.user_message.data.client_caps), 'flag on: the caps of the recorded op-text request')
  const { wire } = makeLibs({ env: ENVS.on })
  const ctx = { sessionId: SESSION, isCurrent: () => true, unlockTurn() {}, onDirective: null }
  assert.equal(wire.routeElementEditFrame(RECORDED['01-row-44-title'].director_frames[0], ctx), true, 'the element_edit frame is the runner\'s')
  assert.equal(wire.routeElementEditFrame(three.director_frames[0], ctx), false, 'the refine directive is not (it goes the way it goes today)')
})
await check('recorded frame 04 (501 characters): Director sends no frame; were such a value to reach Studio it is INVALID_VALUE with nothing stored, and 500 of the same are stored', async () => {
  const four = RECORDED['04-over-500-characters']
  assert.deepEqual(four.director_frames, [], 'Director sends no element_edit')
  const quoted = /"([^"]*)"/.exec(four.user_message.data.text)[1]
  assert.equal(Array.from(quoted).length, 501)
  const w = await scenario('on-invalid-501_characters')
  assert.equal((await w.sendQuiet(frame('textbox_b', quoted))).error_code, 'INVALID_VALUE')
  w.finish()
  const ok = await scenario('on-text-quoted500', { server: true })
  assert.equal((await ok.send(frame('textbox_b', quoted.slice(0, 500)))).ok, true)
  ok.finish(['textbox_b'])
})
await check('code points, not UTF-16 units: a value of exactly 500 emoji (1000 units) is stored; 501 emoji is INVALID_VALUE and nothing is stored (Director counts with Python\'s len)', async () => {
  const w = await scenario('on-text-emoji500', { server: true })
  const value = '😀'.repeat(500)
  assert.equal(value.length, 1000); assert.equal(Array.from(value).length, 500)
  const result = await w.send(frame('textbox_b', value))
  assert.equal(result.ok, true, JSON.stringify(result))
  const [save] = w.fetches()
  assert.equal(w.fetches().length, 1)
  assert.equal(Array.from(wordsOf(save.body.element.content)).length, 500)
  assert.equal(save.body.element.content, `<p>${value}</p>`)
  w.finish(['textbox_b'])
  const over = await scenario('on-invalid-emoji501')
  assert.equal((await over.sendQuiet(frame('textbox_b', '😀'.repeat(501)))).error_code, 'INVALID_VALUE')
  over.finish()
  const mixed = await scenario('on-invalid-mixed501')
  assert.equal((await mixed.sendQuiet(frame('textbox_b', `${'a'.repeat(250)}\n${'é😀'.repeat(125)}x`))).error_code, 'INVALID_VALUE', '251 + 250 + 1 code points, line break included')
  mixed.finish()
})
await check('no new copy: Studio sends the element_edit_result and nothing else, and the files this change adds hold none of Director\'s sentences', async () => {
  const lines = Object.values(RECORDED).flatMap(item => item.director_chat_lines)
  assert.ok(lines.length >= 4)
  const mine = [TEXT_LIB, WIRE, RUNNER].map(rel => read(rel).split('\n').filter(line => rel === TEXT_LIB || CHAT_ELEMENT_TEXT_SET_MARKER_RE.test(line)).join('\n')).join('\n')
  for (const line of lines) assert.ok(!mine.includes(line.slice(0, 24)), `${line.slice(0, 24)}... is Director's`)
  assert.doesNotMatch(mine, /toast|alert\(|Setting the text|now reads exactly/)
})

// ===== 6. what is refused, and how: nothing changes, nothing is stored ===================================================================================================
const REFUSALS = [
  // [label, element, error_code, the viewer is asked to begin a save? (the element read said it could be)]
  ['an image', 'image_b', 'UNSUPPORTED_OP', false],
  ['a metrics box (a text box renderer, not text)', 'metrics_b', 'UNSUPPORTED_OP', false],
  ['a text box with typed generation params (Layout: RECREATE_REQUIRED)', 'typed_b', 'UNSUPPORTED_OP', true],
  ['a locked text box', 'locked_b', 'ELEMENT_LOCKED', false],
  ['an element that is not on the slide', 'nope', 'ELEMENT_NOT_FOUND', false],
]
for (const [label, id, code, begins] of REFUSALS) {
  await check(`refused (${label}): ${code}; the words are not set, no save is made, the box is as it was`, async () => {
    const w = await scenario(`on-refused-${id}`, { server: true })
    const before = LIVE ? w.probe(id) : null
    const result = await w.send(frame(id, WORDS))
    assert.equal(result.ok, false)
    assert.equal(result.error_code, code, JSON.stringify(result))
    assert.equal(w.fetches().length, 0, 'nothing was saved')
    const actions = w.actions()
    assert.equal(actions.includes('beginTargetedElementSave'), begins, actions.join(','))
    if (begins) assert.ok(actions.includes('cancelTargetedElementSave'), 'the scope it opened is closed again')
    assert.ok(!actions.includes('commitTargetedElementSave') && !actions.includes('saveAllChanges'))
    if (LIVE && before) assert.deepEqual(w.probe(id), before, 'the viewer\'s box is as it was')
    if (LIVE && before) assert.notEqual(w.probe(id).content, `<p>${WORDS}</p>`)
    w.finish([id])
  })
}
for (const [label, name, options, frameOptions] of [
  ['a slide id Layout does not have (#538)', 'on-stale-id', { shownIds: ['L0', 'Lx', 'L2'] }, {}],
  ['a slide Layout no longer shows', 'on-slide-gone', { shownIds: ['L0'] }, {}],
  ['a directive for a slide id the deck does not have', 'on-stale-frame', {}, { slide: { slide_index: 1, slide_id: 'Lzzz' } }],
  ['a slide index past the end', 'on-index-past', {}, { slide: { slide_index: 7, slide_id: null } }],
]) {
  await check(`stale slide (${label}): SLIDE_CHANGED before any save is begun; nothing is changed or stored`, async () => {
    const w = await scenario(name, { server: true, ...options })
    const result = await w.send(frame('textbox_b', WORDS, frameOptions.slide))
    assert.equal(result.error_code, 'SLIDE_CHANGED', JSON.stringify(result))
    assert.ok(!w.actions().some(action => action === 'beginTargetedElementSave' || action === 'updateTextBoxContent'))
    assert.equal(w.fetches().length, 0)
    w.finish()
  })
}
await check('Layout\'s flag off (Studio\'s on): UNSUPPORTED_OP before the words are touched; nothing stored (never a silent ok:true)', async () => {
  const w = await scenario('on-layout-off', { layout: 'off' })
  const result = await w.send(frame('textbox_b', WORDS))
  assert.equal(result.ok, false)
  assert.equal(result.error_code, 'UNSUPPORTED_OP')
  assert.equal(w.fetches().length, 0)
  const actions = w.actions()
  assert.equal(actions.at(-1), 'beginTargetedElementSave', actions.join(','))
  assert.ok(!actions.includes('updateTextBoxContent') && !actions.includes('saveAllChanges'))
  w.finish()
})

// ===== 7. ok only once stored =====================================================================================================================================
for (const [label, name, options, expectOk, reads] of [
  ['a save Layout refuses (500): SAVE_FAILED, never ok', 'on-save-refused', { putStatus: 500 }, false, false],
  ['a save that takes 8 s (past the 5 s command budget): pending, read until stored, then ok', 'on-save-slow-8s', { putDelayMs: 8_000 }, true, true],
  ['a save that takes 18 s (inside the 20 s rule): ok', 'on-save-slow-18s', { putDelayMs: 18_000 }, true, true],
  ['a save refused after 8 s: SAVE_FAILED', 'on-save-slow-refused', { putDelayMs: 8_000, putStatus: 500 }, false, true],
  ['a save still unanswered at the end of the 20 s rule (30 s): SAVE_FAILED, never ok', 'on-save-too-slow', { putDelayMs: 30_000 }, false, true],
]) {
  await check(`stored or not: ${label}`, async () => {
    const w = await scenario(name, options)
    const result = await w.send(frame('textbox_b', WORDS))
    assert.equal(result.ok, expectOk, JSON.stringify(result))
    if (!expectOk) assert.equal(result.error_code, 'SAVE_FAILED')
    assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 1)
    assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0)
    const statuses = w.actions().filter(action => action === 'getTargetedElementSaveStatus').length
    assert.ok(reads ? statuses > 0 : statuses === 0, `${statuses} status reads`)
    w.finish()
  })
}
await check('stored or not: the result of a stored set is the existing element_edit_result, byte-identical to a regular op\'s ok (the Undo chip and chat undo key on it)', async () => {
  const { wire } = makeLibs()
  const ok = onRuns.exact
  assert.deepEqual(Object.keys(ok).sort(), ['directive_id', 'ok'])
  assert.equal(JSON.stringify(wire.elementEditResultFrame({ ...ok, directive_id: 'd' })), JSON.stringify(wire.elementEditResultFrame({ directive_id: 'd', ok: true })))
  const refused = await scenario('on-refused-image_b', { server: true })
  const result = await refused.send(frame('image_b', WORDS))
  assert.equal(JSON.stringify(wire.elementEditResultFrame({ ...result, directive_id: 'd' })), JSON.stringify(wire.elementEditResultFrame({ directive_id: 'd', ok: false, error_code: 'UNSUPPORTED_OP' })))
  refused.finish(['image_b'])
})
await check('without #540\'s targeted save (its flag off): the words are stored by the runner\'s own path (the viewer\'s Save and its save acknowledgement), ok only after the ack; the record carries the exact words', async () => {
  const w = await scenario('on-text-whole-deck', { env: 'on-whole-deck', layout: 'off' })
  const result = await w.send(frame('textbox_b', ON_CASES.paragraphs.text))
  assert.equal(result.ok, true, JSON.stringify(result))
  const whole = putsTo(w.fetches(), WHOLE_DECK)
  assert.equal(whole.length, 1, 'the editor\'s own save')
  assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 0)
  assert.equal(whole[0].body.slides[1].text_boxes.find(item => item.id === 'textbox_b').content, ON_CASES.paragraphs.html)
  assert.ok(w.actions().includes('saveAllChanges') && w.actions().includes('updateTextBoxContent'))
  w.finish()
})

// ===== 8. flag off is identical ===================================================================================================================================
const twin = async (name, send, options = {}) => {
  const mine = await scenario(name, options)
  const mineResult = await send(mine)
  const base = await scenario(`${name}-dev`, { ...options, transcriptFrom: name, libs: { overrides: BASE_OVERRIDES } })
  const baseResult = await send(base)
  const summary = w => ({ result: resultShape(w === mine ? mineResult : baseResult), requests: plain(w.requests().map(item => [item.action, item.params])), fetches: plain(w.fetches().map(item => [item.method, item.url, item.body])) })
  mine.finish()
  return { mine: summary(mine), base: summary(base), same: sha(JSON.stringify(summary(mine))) === sha(JSON.stringify(summary(base))), mineResult, baseResult }
}
await check('flag off: op "text" is today\'s INVALID_VALUE, answered before the viewer is touched, and the runner is dev\'s: the same results, viewer requests and saves, hashed, with this change\'s lines out', async () => {
  const a = await twin('off-text', w => w.send(frame('textbox_b', WORDS)), { env: 'off' })
  assert.equal(a.mineResult.error_code, 'INVALID_VALUE')
  assert.equal(a.mine.requests.length, 0)
  assert.ok(a.same, 'the same as dev\'s runner')
  for (const value of ['', '<b>x</b>', longText(501), undefined]) {
    const w = await scenario('off-text', { env: 'off' }), d = await scenario('off-text-dev', { env: 'off', transcriptFrom: 'off-text', libs: { overrides: BASE_OVERRIDES } })
    const one = frame('textbox_b', value), two = frame('textbox_b', value)
    assert.equal(resultShape(await w.send(one)), resultShape(await d.send(two)), JSON.stringify(value)?.slice(0, 20))
  }
})
await check('flag off: a regular op (bold) sends the same viewer requests, makes the same save and answers the same as dev\'s runner (hashed)', async () => {
  const a = await twin('off-bold', w => w.send(regularFrame('style', 'textbox_b', { style: { bold: true } })), { env: 'off', server: true })
  assert.equal(a.mineResult.ok, true)
  assert.equal(putsTo(a.mine.fetches.map(([method, url, body]) => ({ method, url, body })), CHAT_SAVE).length, 1)
  assert.ok(a.same, 'identical to dev')
})
await check('flag on: a regular op (bold) is unchanged too (same requests, same save, same answer as dev\'s runner)', async () => {
  const a = await twin('on-bold', w => w.send(regularFrame('style', 'textbox_b', { style: { bold: true } })), { env: 'on', server: true })
  assert.equal(a.mineResult.ok, true)
  assert.ok(a.same, 'identical to dev')
})
await check('flag off: the strip gives dev\'s files back byte for byte (every added line is marked, pure insertions); the .env.example block comes out with its blank line; all read past the changes registered after this one', async () => {
  for (const rel of CHAT_ELEMENT_TEXT_SET_FILES) {
    const base = git('show', `${BASE_COMMIT}:${rel}`), now = laterRead(rel)
    assert.equal(sha(stripChatElementTextSet(rel, now)), sha(laterStrips(rel, base)), rel)
    const added = now.split('\n').length - laterStrips(rel, base).split('\n').length
    assert.equal(now.split('\n').filter(line => CHAT_ELEMENT_TEXT_SET_MARKER_RE.test(line)).length, added, `${rel}: every added line carries the marker`)
  }
  assert.equal(withoutLaterEnvBlocks(read('.env.example')), `${git('show', `${BASE_COMMIT}:.env.example`)}\n${CHAT_ELEMENT_TEXT_SET_ENV_BLOCK}`, 'the base, one blank line, the block (the blocks of the changes registered after this one aside)')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', read('.env.example')), registry.stripLaterEnvBlocks('.env.example', git('show', `${BASE_COMMIT}:.env.example`)), 'the registry takes the block out')
  for (const rel of CHAT_ELEMENT_TEXT_SET_NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)), rel)
  for (const rel of CHAT_ELEMENT_TEXT_SET_FILES) assert.equal(stripChatElementTextSet(rel, stripChatElementTextSet(rel, read(rel))), stripChatElementTextSet(rel, read(rel)), `${rel}: idempotent`)
  assert.equal(stripChatElementTextSet('scripts/studio-later-changes.mjs', 'x'), 'x')
  assert.equal(stripChatElementTextSet('hooks/use-deckster-websocket-v2.ts', 'x // CHAT-ELEMENT-TEXT-SET\n'), 'x // CHAT-ELEMENT-TEXT-SET\n', 'a file the change does not own comes back untouched')
  for (const rel of CHAT_ELEMENT_TEXT_SET_PIN_FILES) {
    const dev = git('show', `${BASE_COMMIT}:${rel}`)
    assert.equal(sha(otherStrips(rel, stripChatElementTextSet(rel, laterRead(rel)))), sha(otherStrips(rel, laterStrips(rel, dev))), `${rel}: the proof this change taught, put back (then the other changes' put-backs), is dev's`)
    assert.equal(sha(stripChatElementTextSet(rel, otherStrips(rel, laterRead(rel)))), sha(otherStrips(rel, laterStrips(rel, dev))), `${rel}: and in the other order (the other changes' put-backs first)`)
    for (const [has] of CHAT_ELEMENT_TEXT_SET_PIN_EDITS[rel]) { const lines = has.split('\n').filter(Boolean); assert.ok(lines.some(line => line.includes(CHAT_ELEMENT_TEXT_SET_PIN_MARK)), `${rel}: a taught line carries the pin mark`); for (const line of lines) assert.match(line, /\/\/ LATER-CHANGES: registry read \(/, `${rel}: every line of a taught block is a registry read`) }
  }
})

// ===== 9. mutants =================================================================================================================================================
const textLibText = read(TEXT_LIB), runnerText = read(RUNNER), wireText = read(WIRE), targetedText = read('lib/chat-edit-targeted.ts')
/** The exact words on 'textbox_b' under (possibly mutated) libs: stored once, as the contract says. Offline the recorded viewer refuses a request that is not the recorded one (divergence). */
const storedExactly = async (name, from, spec, overrides, options = {}) => {
  const w = await scenario(name, { server: !options.putStatus && !options.putDelayMs, transcriptFrom: from, libs: { overrides }, ...options })
  const result = await w.send(frame('textbox_b', spec.text))
  assert.equal(w.viewer.log.divergence, null, 'the viewer was asked what was recorded')
  assert.equal(w.requests().length, recorded.scenarios[from].requests.length, 'and every recorded request was made (a commit that is never sent is a missing request)')
  assert.equal(result.ok, true, JSON.stringify(result))
  const saves = putsTo(w.fetches(), CHAT_SAVE)
  assert.equal(saves.length, 1)
  assert.equal(saves[0].body.element.content, spec.html)
  assert.equal(w.requests().find(item => item.action === 'updateTextBoxContent')?.params.content, spec.html)
}
const refused = async (name, from, id, code, overrides, options = {}) => {
  const w = await scenario(name, { server: true, transcriptFrom: from, libs: { overrides }, ...options })
  const result = await w.send(frame(id, WORDS))
  assert.equal(w.viewer.log.divergence, null, 'the viewer was asked what was recorded')
  assert.equal(w.requests().length, recorded.scenarios[from].requests.length, 'and every recorded request was made')
  assert.equal(result.error_code, code, JSON.stringify(result))
  assert.equal(w.fetches().length, 0)
}
await mutant('lib: the HTML check dropped ("<b>x</b>" is stored)', async () => {
  const w = await scenario('m-html', { transcriptFrom: 'on-invalid-b_x_b', libs: { overrides: { [TEXT_LIB]: swap(textLibText, "if (text.trim() === '' || HTML_LOOKING.test(text)) return invalid", "if (text.trim() === '') return invalid") } } })
  assert.equal((await w.sendQuiet(frame('textbox_b', '<b>x</b>'))).error_code, 'INVALID_VALUE')
})
await mutant('lib: the HTML check dropped AND no escaping (markup is stored as markup)', async () => {
  const overrides = { [TEXT_LIB]: swap(swap(textLibText, "if (text.trim() === '' || HTML_LOOKING.test(text)) return invalid", "if (text.trim() === '') return invalid"), 'return text.replace(/[&<>"\']/g, character => ESCAPES[character])', 'return text') }
  const w = await scenario('m-markup', { transcriptFrom: 'on-invalid-b_x_b', libs: { overrides } })
  assert.equal((await w.sendQuiet(frame('textbox_b', '<b>x</b>'))).error_code, 'INVALID_VALUE')
})
await mutant('lib: no escaping (a typed & < > " \' reaches the box as markup)', () => storedExactly('m-escape', 'on-text-escaped', ON_CASES.escaped, { [TEXT_LIB]: swap(textLibText, 'return text.replace(/[&<>"\']/g, character => ESCAPES[character])', 'return text') }))
await mutant('lib: "\\n" is not a paragraph break (one <p> with the line break inside)', () => storedExactly('m-paragraphs', 'on-text-paragraphs', ON_CASES.paragraphs, { [TEXT_LIB]: swap(textLibText, "text.split('\\n').filter(line => line.trim() !== '')", '[text]') }))
await mutant('lib: no <p> (bare text, not the paragraph Layout styles)', () => storedExactly('m-nop', 'on-text-exact', ON_CASES.exact, { [TEXT_LIB]: swap(textLibText, '`<p>${escapeElementText(line)}</p>`', 'escapeElementText(line)') }))
await mutant('lib: 501 characters allowed', () => assert.equal(makeLibs({ overrides: { [TEXT_LIB]: swap(textLibText, 'ELEMENT_TEXT_MAX_CHARS = 500', 'ELEMENT_TEXT_MAX_CHARS = 5000') } }).textSet.validateElementText(longText(501)).ok, false))
await mutant('lib: an empty or blank value allowed', () => { const lib = makeLibs({ overrides: { [TEXT_LIB]: swap(swap(textLibText, 'ELEMENT_TEXT_MIN_CHARS = 1', 'ELEMENT_TEXT_MIN_CHARS = 0'), "text.trim() === '' || ", '') } }).textSet; assert.equal(lib.validateElementText('').ok, false); assert.equal(lib.validateElementText('  ').ok, false) })
await mutant('lib: length counted in UTF-16 units (500 emoji refused)', () => assert.equal(makeLibs({ overrides: { [TEXT_LIB]: swap(textLibText, 'Array.from(text).length', 'text.length') } }).textSet.validateElementText('😀'.repeat(500)).ok, true))
await mutant('lib: the viewer command is a rewrite (generateTextBoxContent)', () => storedExactly('m-command', 'on-text-exact', ON_CASES.exact, { [TEXT_LIB]: swap(textLibText, "ELEMENT_TEXT_VIEWER_COMMAND = 'updateTextBoxContent'", "ELEMENT_TEXT_VIEWER_COMMAND = 'generateTextBoxContent'") }))
await mutant('runner: op "text" validated with the flag off (the flag check dropped)', async () => {
  const w = await scenario('m-flag', { env: 'off', transcriptFrom: 'off-text', libs: { overrides: { [RUNNER]: swap(runnerText, "if (CHAT_ELEMENT_TEXT_SET_ENABLED && op === 'text')", "if (op === 'text')") } } })
  const result = await w.send(frame('textbox_b', WORDS))
  assert.equal(result.error_code, 'INVALID_VALUE'); assert.equal(w.requests().length, 0)
})
await mutant('runner: any element accepts the words (the text box check dropped: a metrics box is rewritten)', () => refused('m-textbox', 'on-refused-metrics_b', 'metrics_b', 'UNSUPPORTED_OP', { [RUNNER]: swap(runnerText, "case 'text': return isTextBox(element) ? {", "case 'text': return true ? {") }))
await mutant('runner: the image is sent the words too (no text box check): the viewer is asked to begin a save for it', async () => {
  const w = await scenario('m-image', { server: true, transcriptFrom: 'on-refused-image_b', libs: { overrides: { [RUNNER]: swap(runnerText, "case 'text': return isTextBox(element) ? {", "case 'text': return true ? {") } } })
  const result = await w.send(frame('image_b', WORDS))
  assert.equal(w.viewer.log.divergence, null)
  assert.equal(result.error_code, 'UNSUPPORTED_OP'); assert.ok(!w.actions().includes('beginTargetedElementSave'))
})
await mutant('wire: element_text1 advertised with the flag off', () => assert.equal(capsOf(makeLibs({ env: ENVS.off, overrides: { [WIRE]: swap(wireText, 'if (CHAT_ELEMENT_TEXT_SET_ENABLED && !(data', 'if (!(data') } }), ['mdc1']), capsOf(makeLibs({ env: ENVS.off, overrides: BASE_OVERRIDES }), ['mdc1'])))
await mutant('wire: element_text1 first (before element_edit1)', () => assert.ok(JSON.parse(capsOf(makeLibs({ overrides: { [WIRE]: swap(wireText, '.push(ELEMENT_TEXT_CLIENT_CAP)', '.unshift(ELEMENT_TEXT_CLIENT_CAP)') } }), ['mdc1'])).client_caps.indexOf('element_text1') > 0))
await mutant('wire: the capability is spelt otherwise', () => assert.deepEqual(JSON.parse(capsOf(makeLibs({ overrides: { [WIRE]: swap(wireText, "ELEMENT_TEXT_CLIENT_CAP = 'element_text1'", "ELEMENT_TEXT_CLIENT_CAP = 'element_text'") } }), ['mdc1'])).client_caps, ['mdc1', 'element_edit1', 'notes1', 'element_text1']))
await mutant('wire: the flag reads a loose value', () => assert.equal(makeLibs({ env: { ...BASE_ENV, [FLAG]: '1' }, overrides: { [WIRE]: swap(wireText, "process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET === 'true'", 'process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET !== undefined') } }).wire.CHAT_ELEMENT_TEXT_SET_ENABLED, false))
await mutant('wire: element_text1 added twice when the client already had it', () => assert.deepEqual(JSON.parse(capsOf(makeLibs({ overrides: { [WIRE]: swap(wireText, 'if (CHAT_ELEMENT_TEXT_SET_ENABLED && !(data.client_caps as string[]).includes(ELEMENT_TEXT_CLIENT_CAP)) ', 'if (CHAT_ELEMENT_TEXT_SET_ENABLED) ') } }), ['element_text1'])).client_caps, ['element_text1', 'element_edit1', 'notes1']))
await mutant('targeted: commit never sent (ok:true without a stored record)', () => storedExactly('m-nocommit', 'on-text-exact', ON_CASES.exact, { 'lib/chat-edit-targeted.ts': swap(targetedText, 'let answer = okReply(await ctx.sendTextBox(TARGETED_SAVE_COMMANDS.commit, { saveId: held }))', 'let answer: any = { saved: true }; void held') }))
await mutant('targeted: a save Layout refused is swallowed and answers ok (SAVE_FAILED never comes)', async () => {
  const overrides = { 'lib/chat-edit-targeted.ts': swap(targetedText, 'let answer = okReply(await ctx.sendTextBox(TARGETED_SAVE_COMMANDS.commit, { saveId: held }))', 'let answer: any = await ctx.sendTextBox(TARGETED_SAVE_COMMANDS.commit, { saveId: held }).then(() => ({ saved: true }), () => ({ saved: true }))') }
  const w = await scenario('m-notsaved', { putStatus: 500, transcriptFrom: 'on-save-refused', libs: { overrides } })
  const result = await w.send(frame('textbox_b', WORDS))
  assert.equal(result.ok, false); assert.equal(result.error_code, 'SAVE_FAILED')
})
if (LIVE && !RECORD) {
  // The REAL Layout code, mutated: Layout's updateTextBoxContent stores nothing of the words (it would answer success and the commit would store the old words)
  await mutant('Layout: updateTextBoxContent answers success but does not set the words (the stored words are the old ones)', async () => {
    const w = await scenario('m-layout-noop', { server: true })
    const real = w.viewer.context.ElementManager.updateTextBoxContent
    w.viewer.context.ElementManager.updateTextBoxContent = () => ({ success: true })
    const result = await w.send(frame('textbox_b', WORDS))
    assert.equal(real.name, 'updateTextBoxContent')
    assert.equal(result.ok, true)
    assert.equal(storedBox(w.server().deck, 'textbox_b').content, `<p>${WORDS}</p>`, 'the words are what was stored')
  })
}

// ===== 10. Layout identity ======================================================================================================================================
await check('Layout identity: the recording names the Layout files it ran (and, live, they are the files on disk); updateTextBoxContent is the command the page serves', async () => {
  if (RECORD) return
  assert.ok(recorded.meta?.sources?.['viewer/presentation-viewer.html'] && recorded.meta?.sources?.['src/utils/element-manager.js'] && recorded.meta?.sources?.['chat_targeted_save.py'])
  if (LIVE) {
    for (const [rel, hash] of Object.entries(recorded.meta.sources)) assert.equal(sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8')), hash, rel)
    const w = await scenario('identity', { server: false })
    assert.ok(w.viewer.bridge.commands.has('updateTextBoxContent'), 'the served page has the command')
  }
})

// ===== 11. scope over the COMMITTED diff (BASE..head), gate-safe and robust after merge ==========================================================================
console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-29T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-29T00:00:00Z' }
const plumb = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...(input === undefined ? {} : { input }), env: { ...process.env, ...GIT_IDENT }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cts-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = sha => git('rev-list', '--parents', '-n', '1', sha).trim().split(/\s+/).slice(1)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(CHAT_ELEMENT_TEXT_SET_SUBJECT))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits, whether or not dev has moved past BASE) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it, whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const REAL = { norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
/** `git diff -U0` of the base file against the file at `head`, both read through ctx.norm (every other change's lines out). */
const normDiff = (ctx, rel, head) => git('diff', '-U0', blobOf(ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`))))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), /^(Chat element edit|Targeted chat edit:|Targeted chat add:)/, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].sort(), [...CHAT_ELEMENT_TEXT_SET_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of CHAT_ELEMENT_TEXT_SET_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, CHAT_ELEMENT_TEXT_SET_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.ok(diff.length > 0, `${rel}: the number of added lines`)
    assert.equal(stripChatElementTextSet(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of CHAT_ELEMENT_TEXT_SET_PIN_FILES) {
    const now = git('show', `${head}:${rel}`), dev = ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))
    assert.equal(stripChatElementTextSet(rel, ctx.norm(rel, now)), dev, `${rel}: the proof this change taught, put back, is the base's`)
    assert.equal(ctx.norm(rel, stripChatElementTextSet(rel, now)), dev, `${rel}: in either order of the put-backs (this change's strip commutes with the other changes' on a file they share)`)
  }
  for (const rel of CHAT_ELEMENT_TEXT_SET_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['app/builder/page.tsx', 'components/presentation-viewer.tsx', 'hooks/use-deckster-websocket-v2.ts', 'hooks/use-textlabs-generation.ts', 'lib/chat-edit-targeted.ts', 'lib/chat-element-edit-2.ts', 'lib/chat-element-edit-save.ts', 'lib/chat-element-refine.ts', 'lib/chat-add-targeted.ts', 'scripts/studio-chat-element-edit-layout.mjs']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(CHAT_ELEMENT_TEXT_SET_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${CHAT_ELEMENT_TEXT_SET_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-chat-element-text-set-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['CHAT_ELEMENT_TEXT_SET_SCOPE_FILES', 'CHAT_ELEMENT_TEXT_SET_ENV_BLOCK', 'stripChatElementTextSet'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${CHAT_ELEMENT_TEXT_SET_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to an existing file is a pure insertion that carries the marker; the strip gives the base back byte for byte (other changes\' lines out of both sides); the taught proofs put back are the base\'s', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of [...CHAT_ELEMENT_TEXT_SET_NEW_FILES.filter(rel => !rel.endsWith('.json')), WIRE, RUNNER]) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
// GATE-SAFE: the gate's merge (first parent dev, second parent this change's head; the tree is `git merge-tree --write-tree dev head`) and the whole scope section against it
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE))
  scopeEnvAndRegistry(GATE)
  for (const rel of CHAT_ELEMENT_TEXT_SET_FILES) assert.equal(stripChatElementTextSet(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cts-idx-'))
  try {
    const env = { ...process.env, ...GIT_IDENT, GIT_INDEX_FILE: path.join(dir, 'index') }
    const viaIndex = (...a) => execFileSync('git', a, { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim()
    viaIndex('read-tree', parent)
    for (const [rel, text] of Object.entries(edits)) viaIndex('update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`)
    return plumb(['commit-tree', viaIndex('write-tree'), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
// a merge onto an ADVANCED dev: a commit on dev after BASE that touches an unrelated file; the gate's first parent is no longer BASE
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await check('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE (an unrelated commit): the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
// a SYNTHETIC change stacked after this one: marked lines in the runner and the wire (next to this change's own), a registry trio below this change's, an .env.example block, a new file
const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
const syntheticStrip = (rel, text) => (rel === RUNNER || rel === WIRE) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const runner = at(RUNNER).split('\n').flatMap(line => line.startsWith('export const ARRANGE_INTENT') ? [line, `const syntheticLater = 1 // ${SYN.marker}`] : [line]).join('\n')
  const wire = at(WIRE).split('\n').flatMap(line => line.startsWith('export const ELEMENT_EDIT_ALIGNS') ? [line, `export const SYNTHETIC_LATER = 1 // ${SYN.marker}`] : [line]).join('\n')
  assert.ok(runner.includes(SYN.marker) && wire.includes(SYN.marker), 'the synthetic anchors exist')
  const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('CHAT_ELEMENT_TEXT_SET_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('CHAT_ELEMENT_TEXT_SET_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripChatElementTextSet')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  return commitWith(parent, { [RUNNER]: runner, [WIRE]: wire, 'scripts/studio-later-changes.mjs': reg, '.env.example': `${at('.env.example')}\n${SYN.block}`, [SYN.file]: 'export const SYNTHETIC_SCOPE_FILES = new Set()\n' }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC = syntheticCommit(HEAD)
const SYN_CTX = {
  norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)),
  env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''),
}
await check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked lines beside this change\'s in the runner and the wire, a registry trio, an .env.example block, a new file; its own commit has another subject) leaves this change\'s scope section passing, on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  assert.ok(ownOf(SYNTHETIC).length === ownOf(HEAD).length && !ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  for (const rel of CHAT_ELEMENT_TEXT_SET_FILES) assert.equal(stripChatElementTextSet(rel, SYN_CTX.norm(rel, git('show', `${gate}:${rel}`))), SYN_CTX.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree is the base's ${rel} without this change's and the later change's lines`)
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its lines are unmarked additions, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray foreign file in a "Chat text set:" commit fails the committed-files check (own commits found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-chat-text-set.txt': 'stray\n' }, `${CHAT_ELEMENT_TEXT_SET_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, and an unmarked line added to the runner in an own commit, fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${CHAT_ELEMENT_TEXT_SET_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  const sneaky = commitWith(HEAD, { [RUNNER]: git('show', `${HEAD}:${RUNNER}`).replace('export const ARRANGE_INTENT', 'const sneaky = 1\nexport const ARRANGE_INTENT') }, `${CHAT_ELEMENT_TEXT_SET_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/)
  const hook = commitWith(HEAD, { 'hooks/use-deckster-websocket-v2.ts': git('show', `${HEAD}:hooks/use-deckster-websocket-v2.ts`) + '\n' }, `${CHAT_ELEMENT_TEXT_SET_SUBJECT} touches the hook${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(hook), /exactly its scope|is not touched/)
})

// ===== TAIL =====
if (RECORD) {
  recorded.meta = { recorded_with: 'CHAT_ELEMENT_TEXT_SET_LAYOUT_DIR + --record-layout', layout_checkout: 'layout-builder frontend2/layout-targeted-save (LAYOUT_CHAT_TARGETED_SAVE_ENABLED), the merged tree of !262', studio_origin: STUDIO_ORIGIN,
    director_frame: 'scripts/fixtures/chat-element-edit/director-frames/01-delete-ok.json (a recorded element_edit; op "text" and text are set from the agreed contract: the frames are CONTRACT-BUILT, not recorded from Director)',
    titleId: titleId((await scenario('probe-ids', { server: false })).viewer),
    sources: Object.fromEntries(['viewer/presentation-viewer.html', 'arrange_commands.py', 'chat_targeted_save.py', 'src/utils/chat-targeted-save.js', 'src/utils/arrange-commands.js', 'src/utils/edit-mode.js', 'src/utils/grid-converter.js', 'src/utils/auto-save.js', 'src/utils/element-manager.js', 'server.py',
      'src/utils/drag-drop.js', 'src/templates/template-registry.js', 'src/utils/semantic-slot-catalog.js', 'src/utils/direct-element-creator.js'].map(rel => [rel, sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8'))])) }
  fs.mkdirSync(path.dirname(TRANSCRIPTS), { recursive: true })
  fs.writeFileSync(TRANSCRIPTS, `${JSON.stringify(recorded, null, 1)}\n`)
  console.log(`recorded ${Object.keys(recorded.scenarios).length} scenarios`)
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed${LIVE ? ' (live Layout code and server)' : ' (offline, recorded Layout code)'}`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
