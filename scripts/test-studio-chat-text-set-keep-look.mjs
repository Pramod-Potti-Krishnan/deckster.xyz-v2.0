// FRONTEND-2 (B49b, 29 Oct; follow-up to #551, E2E-2 run-B5 29 Oct: a chat exact-text set on a slide TITLE drew it at 20px instead of 42px/700): proof of text set keep look (NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK, exact "true", default off, build-time).
// With it on, an exact-text set writes the user's words in the text box's EXISTING structure: inline text with <br> between lines where the box held inline text (a title), <p> per line where it held <p> (body text), #551's <p> per line for
// any other structure or when the structure cannot be read. Layout styles a <p> in a text box as body text (src/styles/content-typography.css), so #551's <p> turned a title into body text.
//
//   node scripts/test-studio-chat-text-set-keep-look.mjs                # offline: the viewer's replies, its saves, Layout's server answers and the Chromium measurements come from scripts/fixtures/chat-text-set-keep-look/layout-transcripts.json
//   CHAT_TEXT_SET_KEEP_LOOK_LAYOUT_DIR=<layout-builder at frontend2/layout-targeted-save> CHAT_TEXT_SET_KEEP_LOOK_LAYOUT_PYTHON=<a Python with Layout's requirements> node scripts/test-studio-chat-text-set-keep-look.mjs
//                                                                       # also runs the REAL Layout viewer code, the REAL Layout server (server.py) and headless Chromium over Layout's REAL stylesheets live and checks they say what was recorded
//   ... --record-layout                                                 # (with the variables) re-records the fixture
// (CHAT_EDIT_TARGETED_LAYOUT_DIR / CHAT_EDIT_TARGETED_LAYOUT_PYTHON, #540's names, are taken too. CHAT_TEXT_SET_KEEP_LOOK_PNG_DIR: where the live run saves its before/after PNGs, 1600x900. CHAT_TEXT_SET_KEEP_LOOK_RENDER_PYTHON: the Python with Playwright, default python3.)
//
// FRAMES: DIRECTOR-2's RECORDED op "text" frames (scripts/fixtures/chat-element-text-set/director-frames/, on dev with #551): 01 (row 44's title) and 02 (a value with a line break) are replayed verbatim; the other scenarios vary the element and the value on the recorded envelope.
// What runs: the page's runner (cut out of app/builder/page.tsx), Studio's real sendCommand and ensureEditMode, lib/chat-element-edit.ts (+ -2, -wire, -save), lib/chat-edit-targeted.ts, lib/chat-element-text-set.ts and lib/chat-text-set-keep-look.ts in a vm; Layout's REAL viewer
// (the page bridge with getTextBoxContent and updateTextBoxContent, element-manager.js, edit-mode.js, auto-save.js, arrange-commands.js, chat-targeted-save.js), a stored deck loaded through Layout's own load path, and Layout's REAL server (server.py) answering the targeted save.
// The look is MEASURED: the box the viewer holds after the command is put in a 1600x900 slide frame and styled by Layout's real stylesheets in headless Chromium (scripts/studio-chat-text-set-keep-look-render.py), which reports the computed size / weight / colour of the words.
// What it proves:
//  1. the flag (exact "true"; acts only where #551's flag sends the words); 2. the structure rule (inline / paragraphs / other / unread) and the content it writes (units);
//  3. the structure is read with Layout's existing getTextBoxContent (no new command), once, before any save is begun, and the words are written in it: stored by ONE chat-save PUT of that box; the box keeps its text style; a reload shows them; flag off is #551's content;
//  4. an unreadable structure (the read refused, no content) is #551's <p> and the edit still succeeds; 5. escaping and the value rules are unchanged;
//  6. the look, measured: the stored title is 42px/700; flag OFF (#551) it is drawn at 20px/400 (the bug); flag ON it stays 42px/700 in the same colour; a body <p> box keeps its body look; 7. Undo, and flag off is identical to dev's runner (hashed);
//  8. mutants are caught; 9. Layout identity; 10. scope over the COMMITTED diff, GATE-SAFE and robust after merge (subject across `rev-list --no-merges`, HEAD^2 on the gate's merge, registry / .env.example / strip reads past later changes, no hash-object --stdin).
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
  BASE_COMMIT, CHAT_TEXT_SET_KEEP_LOOK_FILES, CHAT_TEXT_SET_KEEP_LOOK_NEW_FILES, CHAT_TEXT_SET_KEEP_LOOK_PIN_FILES, CHAT_TEXT_SET_KEEP_LOOK_PIN_EDITS, CHAT_TEXT_SET_KEEP_LOOK_PIN_MARK, CHAT_TEXT_SET_KEEP_LOOK_SCOPE_FILES,
  CHAT_TEXT_SET_KEEP_LOOK_ENV_BLOCK, CHAT_TEXT_SET_KEEP_LOOK_MARKER_RE, CHAT_TEXT_SET_KEEP_LOOK_SUBJECT, stripChatTextSetKeepLook,
} from './studio-chat-text-set-keep-look-strip.mjs'
import * as registry from './studio-later-changes.mjs'
import { stripDeckSaveRefused } from './studio-deck-save-refused-strip.mjs' // the save-refused notice (#549) is stacked below this change: its marked lines in the viewer's save-status handler (isDeckSaveRefused) come out before the handler is cut out and evaluated

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const TRANSCRIPTS = path.join(root, 'scripts/fixtures/chat-text-set-keep-look/layout-transcripts.json')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const [WIRE, RUNNER, TEXT_LIB, KEEP_LIB] = ['lib/chat-element-edit-wire.ts', 'lib/chat-element-edit.ts', 'lib/chat-element-text-set.ts', 'lib/chat-text-set-keep-look.ts']

/** The strips of every change registered AFTER this one (below this change's strip in LATER_STRIPS), applied first: a file is read as this change left it, whatever a later change marked in it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripChatTextSetKeepLook); return (at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1)).reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text) }
const laterRead = rel => laterStrips(rel, read(rel))
/** Every OTHER registered change's strip, in the registry's order (this change's is left out). */
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripChatTextSetKeepLook), rel, text)
const laterBlob = (ref, rel) => laterStrips(rel, git('show', `${ref}:${rel}`))
const laterBlocks = () => { const at = registry.LATER_ENV_BLOCKS.indexOf(CHAT_TEXT_SET_KEEP_LOOK_ENV_BLOCK); return at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1) }
/** `text` (an .env.example) without the blocks registered AFTER this one: theirs, not this change's. */
const withoutLaterEnvBlocks = text => laterBlocks().reduce((out, block) => { const body = String(block).replace(/^\n+/, '').replace(/\n+$/, ''); return body === '' ? out : out.replace(`\n${body}\n`, () => '') }, text)

const RECORD = process.argv.includes('--record-layout')
const LAYOUT_DIR = (process.env.CHAT_TEXT_SET_KEEP_LOOK_LAYOUT_DIR || process.env.CHAT_EDIT_TARGETED_LAYOUT_DIR) ? path.resolve(process.env.CHAT_TEXT_SET_KEEP_LOOK_LAYOUT_DIR || process.env.CHAT_EDIT_TARGETED_LAYOUT_DIR) : null
const PYTHON = process.env.CHAT_TEXT_SET_KEEP_LOOK_LAYOUT_PYTHON || process.env.CHAT_EDIT_TARGETED_LAYOUT_PYTHON || null
const LIVE = Boolean(LAYOUT_DIR)
if (RECORD && !LIVE) throw new Error('--record-layout needs CHAT_TEXT_SET_KEEP_LOOK_LAYOUT_DIR')
if (LIVE && !PYTHON) throw new Error('the live run needs CHAT_TEXT_SET_KEEP_LOOK_LAYOUT_PYTHON (a Python with layout-builder\'s requirements) for Layout\'s own server')
const recorded = RECORD ? { meta: {}, scenarios: {}, render: {}, pageRender: {} } : JSON.parse(fs.readFileSync(TRANSCRIPTS, 'utf8'))

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
const FLAG_EDIT = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT', FLAG_EDIT_2 = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2', FLAG_TARGETED = 'NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE', FLAG_TEXT = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET', FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK'
const DEV_ENV = { [FLAG_EDIT]: 'true', [FLAG_EDIT_2]: 'true', [FLAG_TARGETED]: 'true', [FLAG_TEXT]: 'true' } // what dev has once #551's flag is on: chat element edit, #538, #540 and the exact-text set; this change off
const ENVS = { on: { ...DEV_ENV, [FLAG]: 'true' }, off: DEV_ENV, 'keep-only': { [FLAG_EDIT]: 'true', [FLAG_EDIT_2]: 'true', [FLAG_TARGETED]: 'true', [FLAG]: 'true' } } // keep-only: this flag on, #551's off
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
  return { wire: load(WIRE), save: load('lib/chat-element-edit-save.ts'), lib: load(RUNNER), targeted: load('lib/chat-edit-targeted.ts'), textSet: load(TEXT_LIB), keepLook: load(KEEP_LIB), load }
}
/** dev's runner: this change's marked lines out. */
const BASE_OVERRIDES = { [RUNNER]: stripChatTextSetKeepLook(RUNNER, read(RUNNER)) }

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
const TITLE_STYLE = { font_size: '42px', color: '#111827', font_weight: '700', text_align: 'left', font_family: 'Inter' } // the E2E-2 title: 42px / 700
const BODY_STYLE = { font_size: '24px', color: '#1f2937', font_weight: '400', text_align: 'left', font_family: 'Inter' }
const BR_STYLE = { font_size: '36px', color: '#0f172a', font_weight: '600', text_align: 'left', font_family: 'Inter' }
const EMPTY_STYLE = { font_size: '30px', color: '#334155', font_weight: '600', text_align: 'left', font_family: 'Inter' }
const box = (id, row, col, content, extra = {}) => ({ id, parent_slide_id: 'L1', position: { grid_row: row, grid_column: col }, z_index: 100, content, ...extra })
const STORED = { id: PRESENTATION, title: 'T', slides: [
  { layout: 'C1', slide_id: 'L0', content: { slide_title: 'Cover' }, text_boxes: [], images: [] },
  { layout: 'C1', slide_id: 'L1', content: { slide_title: 'Where we lose' },
    text_boxes: [
      box('body_b', '6/10', '12/24', '<p>High-turnover fresh</p>', { text_style: BODY_STYLE }), // a body box: <p> blocks
      box('list_b', '11/15', '12/24', '<ul><li>One</li><li>Two</li></ul>', { text_style: BODY_STYLE }),
      box('div_b', '16/18', '12/24', '<div>Block one</div><div>Block two</div>', { text_style: BODY_STYLE }),
      box('mixed_b', '11/15', '2/10', '<h2>Heading</h2><p>Body</p>', { text_style: BODY_STYLE }),
      box('empty_b', '16/18', '2/10', '', { text_style: EMPTY_STYLE }),
      box('br_b', '6/10', '2/10', 'Line one<br>Line two', { text_style: BR_STYLE }), // inline text with a <br>
    ],
    images: [] },
  { layout: 'C1', slide_id: 'L2', content: { slide_title: 'Plan' }, text_boxes: [box('textbox_a1', '6/10', '4/28', 'Old <span class="accent" style="color: #0ea5e9">title</span>', { parent_slide_id: 'L2', text_style: TITLE_STYLE })], images: [] }, // textbox_a1: the box DIRECTOR-2's recorded frames name (slide 3, L2): a title, inline text and an accent span
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
async function scenario(name, { env = 'on', layout = 'on', editMode = false, libs: libOptions = {}, shownIds = ['L0', 'L1', 'L2'], stored = STORED, server = false, putDelayMs = 0, putStatus = 200, transcriptFrom = null, patch = null } = {}) {
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
    if (patch) patch(viewer) // a viewer fault for a scenario (recorded like any other)
  } else {
    const transcript = recorded.scenarios[key]
    assert.ok(transcript, `a recorded Layout transcript for "${key}" (record with CHAT_TEXT_SET_KEEP_LOOK_LAYOUT_DIR=... --record-layout)`)
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
    /** What the viewer shows for a text box now (live only): its content, the content div's class and its own style (the box's, not the words'), the box's place. */
    probe: id => {
      const node = LIVE ? viewer.document.getElementById(id) : null
      const content = node?.querySelector('.textbox-content')
      return node ? { content: content?.innerHTML ?? null, contentClass: content?.className ?? null, text: { fontSize: content?.style.fontSize ?? null, color: content?.style.color ?? null, fontWeight: content?.style.fontWeight ?? null, textAlign: content?.style.textAlign ?? null, fontFamily: content?.style.fontFamily ?? null },
        box: { gridRow: node.style.gridRow ?? null, gridColumn: node.style.gridColumn ?? null, zIndex: node.style.zIndex ?? null, background: node.style.backgroundColor ?? node.style.background ?? null, borderRadius: node.style.borderRadius ?? null } } : null
    },
    probes: {},
    /** Remembers what the viewer shows for these boxes under a label (live: read now; offline: the recording has it). */
    snap(label, ids) { if (LIVE) for (const id of ids) world.probes[`${label}:${id}`] = world.probe(id) },
    recall(label, id) { return (LIVE ? world.probes : recorded.scenarios[key].probes)[`${label}:${id}`] },
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
    finish() {
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


// ===== render: Layout's real CSS in Chromium =====================================================================================================================
// The viewer's DOM after the command (the content div's own inline style and its words) is put in a 1600x900 slide frame and styled by Layout's REAL stylesheets (the ones the viewer page links, in its order) in headless Chromium, which computes
// the sizes. (This Mac's Chromium refuses a loopback viewer in an iframe, and the harness viewer is a fake DOM with no CSS, so the page is rebuilt from the viewer's DOM.) Offline the measurements are the recorded ones, checked to be of the same markup (its hash).
const RENDER_SCRIPT = path.join(root, 'scripts/studio-chat-text-set-keep-look-render.py')
const RENDER_PYTHON = process.env.CHAT_TEXT_SET_KEEP_LOOK_RENDER_PYTHON || path.join(os.homedir(), 'Deckster/.worktrees/ops2-venv-layout-pw160/bin/python') // playwright 1.60.0, Chromium 1223
const PNG_DIR = process.env.CHAT_TEXT_SET_KEEP_LOOK_PNG_DIR ? path.resolve(process.env.CHAT_TEXT_SET_KEEP_LOOK_PNG_DIR) : null
const CSS_FILES = ['src/styles/core/reset.css', 'src/styles/element-manager.css', 'src/styles/textbox.css', 'src/styles/elements.css', 'src/styles/slot-converter.css', 'src/styles/theme-variables.css', 'src/styles/content-typography.css']
const attr = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
const inlineStyle = style => Object.entries({ 'font-size': style.fontSize, color: style.color, 'font-weight': style.fontWeight, 'text-align': style.textAlign, 'font-family': style.fontFamily }).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join('; ')
/** The box as the viewer drew it after the command: its content div (class and inline style as the viewer has them) with its words. */
const renderHtml = probe => `<div class="dynamic-element inserted-textbox" data-component-type="TEXT_BOX" style="position: absolute; left: 96px; top: 120px; width: 1408px; box-sizing: border-box; display: flex; flex-direction: column;"><div class="${attr(probe.contentClass)}" style="${attr(inlineStyle(probe.text))}; width: 100%;">${probe.content}</div></div>`
/** Browser work waits while the 5-minute load average is over 7 (the seat's rule); live mode only. */
async function settleLoad() { for (let waited = 0; os.loadavg()[1] > 7 && waited < 40; waited++) { console.log(`  waiting: load5=${os.loadavg()[1].toFixed(1)} (> 7)`); await new Promise(resolve => setTimeout(resolve, 30_000)) } }
async function renderCases(cases) { // [{name, html, png?}] -> {name: measurement}
  if (!LIVE) return Object.fromEntries(cases.map(item => { const m = recorded.render?.[item.name]; assert.ok(m, `a recorded render of ${item.name}`); assert.equal(m.htmlSha, sha(item.html), `${item.name}: the recorded measurement is of this markup`); return [item.name, m] }))
  await settleLoad()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tskl-render-'))
  try {
    const spec = path.join(dir, 'spec.json')
    fs.writeFileSync(spec, JSON.stringify({ layoutDir: LAYOUT_DIR, css: CSS_FILES, viewport: { width: 1600, height: 900 }, pngDir: null, cases: cases.map(item => ({ name: item.name, html: item.html, png: item.png ?? null })) }))
    const out = execFileSync(RENDER_PYTHON, ['-B', RENDER_SCRIPT, spec], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 180_000, maxBuffer: 1 << 26 })
    const measured = JSON.parse(out.slice(out.lastIndexOf('@@RESULT@@') + '@@RESULT@@'.length))
    const result = {}
    for (const item of cases) {
      const m = { htmlSha: sha(item.html), ...measured[item.name] }
      assert.ok(measured[item.name], `${item.name} was measured`)
      result[item.name] = m
      if (RECORD) recorded.render[item.name] = m
      else assert.deepEqual(m, recorded.render[item.name], `${item.name}: Chromium measured what was recorded`)
    }
    return result
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

/** The real viewer page (live only; B48's render550 method): Layout's real server.py and viewer page on 127.0.0.1 from a copy of the Layout checkout, decks seeded by POST, rendered at 1600x900 in Chromium 1223 / playwright 1.60.0. Offline: the recorded measurements. */
const PAGE_RENDER_SCRIPT = path.join(root, 'scripts/studio-chat-text-set-keep-look-page-render.py')
const PAGE_PYTHON = process.env.CHAT_TEXT_SET_KEEP_LOOK_PAGE_PYTHON || path.join(os.homedir(), 'Deckster/.worktrees/ops2-venv-layout-pw160/bin/python')
const REVEAL_DIR = process.env.CHAT_TEXT_SET_KEEP_LOOK_REVEAL_DIR || path.join(os.homedir(), 'Deckster/.worktrees/composer2-dl-elem-renders/fixture/static')
const UAT_FLAGS = path.join(os.homedir(), 'Deckster/tools/render/uat_flags_2026-10-04.json')
/** A one-slide deck for the real page: slide 3 of the proof's deck with its title text box (id) placed where a slide title sits and nothing else drawn by the template. */
const pageDeck = (deck, id) => { const slide = plain(deck.slides[2]); slide.content = { slide_title: '', body: '' }; slide.text_boxes.find(item => item.id === id).position = { grid_row: '3/9', grid_column: '3/30' }; return { title: 'Text set keep look', slides: [slide] } }
async function pageRender(variants) { // [{name, deck, id, png}] -> {name: measurement without the presentation id}
  if (!LIVE) return Object.fromEntries(variants.map(item => { assert.ok(recorded.pageRender?.[item.name], `a recorded page render of ${item.name}`); return [item.name, recorded.pageRender[item.name]] }))
  await settleLoad()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tskl-page-spec-'))
  try {
    const spec = path.join(dir, 'spec.json')
    fs.writeFileSync(spec, JSON.stringify({ layoutDir: LAYOUT_DIR, layoutPython: PYTHON, revealDir: REVEAL_DIR, pngDir: PNG_DIR, uatFlags: UAT_FLAGS, viewport: { width: 1600, height: 900 }, variants: variants.map(item => ({ name: item.name, deck: pageDeck(item.deck, item.id), elementId: item.id, png: item.png ?? null })) }))
    const out = execFileSync(PAGE_PYTHON, ['-B', PAGE_RENDER_SCRIPT, spec], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 300_000, maxBuffer: 1 << 26 })
    const measured = JSON.parse(out.slice(out.lastIndexOf('@@RESULT@@') + '@@RESULT@@'.length))
    const result = {}
    for (const item of variants) {
      const { presentationId, externalRequests, ...m } = measured[item.name]
      for (const url of externalRequests) assert.ok(['cdn.jsdelivr.net', 'cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(url).host), `${item.name}: ${url} is outside what the page's routes answer locally or abort`) // asked for by the page, answered from this Mac or aborted: nothing leaves loopback
      result[item.name] = m
      if (RECORD) { recorded.pageRender ??= {}; recorded.pageRender[item.name] = m } else assert.deepEqual(m, recorded.pageRender[item.name], `${item.name}: the real page measured what was recorded`)
    }
    return result
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

// ===== the runs: one scenario per (flags, box), memoised ===============================================================================================================
const SLIDE3 = { slide_index: 2, slide_id: 'L2' }
const TITLE_TEXT = 'Order Smarter, Waste Less'
// [element id (or a function of the viewer), slide, text, expected structure, the content flag ON writes, the content flag OFF writes (#551)]
const P = text => text.split('\n').map(line => `<p>${line}</p>`).join('')
const SETS = {
  'title-exact': { id: 'textbox_a1', slide: SLIDE3, text: TITLE_TEXT, structure: 'inline', on: TITLE_TEXT, off: P(TITLE_TEXT), recorded: '01-row-44-title' },
  'title-lines': { id: 'textbox_a1', slide: SLIDE3, text: 'Line one\nLine two', structure: 'inline', on: 'Line one<br>Line two', off: P('Line one\nLine two'), recorded: '02-multi-line' },
  'title-escape': { id: 'textbox_a1', slide: SLIDE3, text: 'Tom & Jerry\'s "plan" 5 < 6 > 3', structure: 'inline', on: 'Tom &amp; Jerry&#39;s &quot;plan&quot; 5 &lt; 6 &gt; 3', off: '<p>Tom &amp; Jerry&#39;s &quot;plan&quot; 5 &lt; 6 &gt; 3</p>' },
  'layout-title': { id: viewer => titleId(viewer), text: TITLE_TEXT, structure: 'inline', on: TITLE_TEXT, off: P(TITLE_TEXT) },
  'layout-title-lines': { id: viewer => titleId(viewer), text: 'Line one\nLine two', structure: 'inline', on: 'Line one<br>Line two', off: P('Line one\nLine two') },
  body: { id: 'body_b', text: 'Fresh words', structure: 'paragraphs', on: P('Fresh words'), off: P('Fresh words') },
  'body-lines': { id: 'body_b', text: 'Line one\nLine two', structure: 'paragraphs', on: P('Line one\nLine two'), off: P('Line one\nLine two') },
  list: { id: 'list_b', text: 'Line one\nLine two', structure: 'other', on: P('Line one\nLine two'), off: P('Line one\nLine two') },
  div: { id: 'div_b', text: 'Line one\nLine two', structure: 'other', on: P('Line one\nLine two'), off: P('Line one\nLine two') },
  mixed: { id: 'mixed_b', text: 'Fresh words', structure: 'other', on: P('Fresh words'), off: P('Fresh words') },
  empty: { id: 'empty_b', text: 'Fresh words', structure: 'inline', on: 'Fresh words', off: P('Fresh words') },
  br: { id: 'br_b', text: 'Line one\nLine two', structure: 'inline', on: 'Line one<br>Line two', off: P('Line one\nLine two') },
}
const memo = new Map()
const once = (key, make) => { if (!memo.has(key)) memo.set(key, make()); return memo.get(key) }
/** What the box shows now, rebuilt from the probe: markup for the render. */
const htmlOf = probe => renderHtml(probe)
async function runSet(env, key, { name = `${env}-${key}`, patch = null, record = null } = {}) {
  const spec = SETS[key]
  const w = await scenario(name, { env, server: true, patch })
  const id = typeof spec.id === 'function' ? spec.id(w.viewer) : spec.id
  w.snap('before', [id])
  const result = await w.send(record ? plain(record) : frame(id, spec.text, spec.slide))
  w.snap('after', [id])
  w.finish()
  return { w, id, spec, result, before: w.recall('before', id), after: w.recall('after', id) }
}
const set = (env, key) => once(`${env}:${key}`, () => runSet(env, key))
const slideOf = spec => spec.slide?.slide_index ?? 1
const contentOfSave = run => putsTo(run.w.fetches(), CHAT_SAVE)[0]?.body.element.content
/** The checks every successful set shares: ok, one chat-save PUT of this element only, the words as expected, the stored deck holds them, nothing else stored or changed, the box keeps its text style and its place. */
function assertStoredSet(run, expected, label) {
  const { w, id, spec, result, before, after } = run
  assert.deepEqual(Object.keys(result).sort(), ['directive_id', 'ok'], label)
  assert.equal(result.ok, true, `${label}: ${JSON.stringify(result)}`)
  assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0, `${label}: no whole-deck save`)
  assert.equal(w.fetches().length, 1, `${label}: one request to Layout`)
  const [save] = w.fetches()
  assert.equal(save.url, `/api/presentations/${PRESENTATION}/slides/${slideOf(spec)}/elements/${id}/chat-save`, label)
  assert.equal(save.body.element.id, id)
  assert.equal(save.body.element.content, expected, `${label}: the saved record holds the words`)
  assert.equal(storedBox(w.server().deck, id, slideOf(spec)).content, expected, `${label}: and Layout's server stored them`)
  assert.deepEqual(w.server().statuses, [200])
  const actions = w.actions()
  assert.ok(actions.indexOf('beginTargetedElementSave') < actions.indexOf('updateTextBoxContent') && actions.indexOf('updateTextBoxContent') < actions.indexOf('commitTargetedElementSave') && actions.at(-1) === 'commitTargetedElementSave', actions.join(','))
  assert.ok(!actions.includes('saveAllChanges') && !actions.includes('generateTextBoxContent'), `${label}: no viewer Save, no rewrite`)
  assert.equal(w.requests().find(item => item.action === 'updateTextBoxContent').params.content, expected)
  assert.deepEqual(after.text, before.text, `${label}: the box keeps its text style (font, size, weight, colour, alignment)`)
  assert.deepEqual(after.box, before.box, `${label}: and its place and container style`)
  const boxesBut = deck => deck.slides.flatMap((slide, index) => (slide.text_boxes || []).filter(item => item.id !== id).map(item => [index, item.id, item.content]))
  assert.deepEqual(boxesBut(w.server().deck), boxesBut(STORED), `${label}: no other stored box changed, and no layout text became a stored box`)
}

// ===== 1. the flag =================================================================================================================================================
await check('flag: on only for the exact "true" of NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK; .env.example has the block after a blank line; with #551\'s flag off op "text" stays INVALID_VALUE and nothing is read', async () => {
  assert.equal(makeLibs({ env: ENVS.on }).keepLook.CHAT_TEXT_SET_KEEP_LOOK_ENABLED, true)
  assert.equal(makeLibs({ env: ENVS.off }).keepLook.CHAT_TEXT_SET_KEEP_LOOK_ENABLED, false)
  for (const value of ['1', 'TRUE', 'yes', ' true', 'True', '', 'false']) assert.equal(makeLibs({ env: { ...ENVS.off, [FLAG]: value } }).keepLook.CHAT_TEXT_SET_KEEP_LOOK_ENABLED, false, JSON.stringify(value))
  const env = read('.env.example')
  assert.ok(env.includes(`\n\n${CHAT_TEXT_SET_KEEP_LOOK_ENV_BLOCK}`), 'the .env.example block, after a blank line')
  assert.ok(withoutLaterEnvBlocks(env).endsWith(`${FLAG}="false"\n`), 'the block is the last of this change and above it, the blocks registered after this one aside')
  const w = await scenario('keep-only-invalid', { env: 'keep-only' })
  const result = await w.sendQuiet(frame('textbox_a1', TITLE_TEXT, SLIDE3))
  assert.equal(result.error_code, 'INVALID_VALUE', 'this flag acts only where the chat text set (#551) sends the words')
  w.finish()
})

// ===== 2. the structure rule and the content it writes (units) =================================================================================================
const STRUCTURES = [
  ['inline', ['Plain words', 'a<br>b', 'a<br/>b', '<span>x</span> y', '', '   ', '<strong>x</strong>', 'Where we <span class="accent" style="color: #0ea5e9">lose</span>', '<!-- note -->title', '<a href="#">link</a> text', 'x<sup>2</sup>', '<br>', '<em>a</em><br><em>b</em>']],
  ['paragraphs', ['<p>a</p>', '<p>a</p><p>b</p>', '<P>a</P>', '<p class="x" style="font-size: 18px">a</p>', '<p>a<br>b</p>', '<p>a <span>b</span></p>', '<p data-x="1">a</p>\n<p>b</p>']],
  ['other', ['<ul><li>x</li></ul>', '<ol><li>x</li></ol>', '<div>a</div>', '<div>a</div><div>b</div>', '<h1>t</h1>', '<h2>H</h2><p>b</p>', '<p>a</p><ul><li>b</li></ul>', '<blockquote>q</blockquote>', '<table><tr><td>1</td></tr></table>', 'text<div>more</div>', '<pre>code</pre>', '<p>a</p><div>b</div>']],
  ['unread', [null, undefined]],
]
await check('structure: inline text (spans, <br>, an empty box) is inline; <p> blocks are paragraphs; a list, a heading, a div, a table or a mix is other; no content is unread (table of 34)', async () => {
  const { keepLook } = makeLibs()
  let count = 0
  for (const [expected, samples] of STRUCTURES) for (const html of samples) { assert.equal(keepLook.textBoxStructure(html), expected, JSON.stringify(html)); count++ }
  assert.equal(keepLook.textBoxStructure(5), 'unread'); assert.equal(keepLook.textBoxStructure({}), 'unread')
  assert.equal(count, 34)
  assert.equal(keepLook.contentFromReply({ success: true, content: '<p>a</p>' }), '<p>a</p>')
  assert.equal(keepLook.contentFromReply({ success: true, content: '' }), '')
  for (const reply of [null, undefined, 'x', {}, { success: false, content: 'x' }, { success: true, content: 5 }, { success: true }]) assert.equal(keepLook.contentFromReply(reply), null, JSON.stringify(reply))
})
await check('content: an inline box gets the escaped words inline with <br> between lines (no <p>, a line with no word is no line); every other structure, and an unread one, gets #551\'s <p> per line, byte for byte', async () => {
  const { keepLook, textSet } = makeLibs()
  assert.equal(keepLook.keepLookHtml(TITLE_TEXT, 'inline'), TITLE_TEXT)
  assert.equal(keepLook.keepLookHtml('One\nTwo\nThree', 'inline'), 'One<br>Two<br>Three')
  assert.equal(keepLook.keepLookHtml('One\n\n  \nTwo', 'inline'), 'One<br>Two')
  assert.equal(keepLook.keepLookHtml('Tom & Jerry\'s "plan" 5 < 6 > 3', 'inline'), 'Tom &amp; Jerry&#39;s &quot;plan&quot; 5 &lt; 6 &gt; 3', 'escaped text, never markup')
  assert.equal(keepLook.keepLookHtml('AT&amp;T', 'inline'), 'AT&amp;amp;T', 'a typed entity stays the characters the user typed')
  for (const text of [TITLE_TEXT, 'One\nTwo', 'a\n\nb', 'Tom & Jerry\'s <3']) for (const structure of ['paragraphs', 'other', 'unread']) assert.equal(keepLook.keepLookHtml(text, structure), textSet.elementTextToHtml(text), `${structure}: ${JSON.stringify(text)}`)
  for (const value of ['<b>x</b>', '', '   ', 'a'.repeat(501)]) assert.equal(makeLibs().textSet.validateElementText(value).ok, false, 'the value rules are #551\'s, unchanged')
})

// ===== 3. the structure is read with Layout's existing getTextBoxContent, then the words are written in it ===============================================================
for (const [key, label] of [['title-exact', 'the row-44 title (inline text and an accent span, 42px/700)'], ['title-lines', 'the same title, a value with a line break'], ['layout-title', 'the slide\'s layout title (edit-mode template text)'], ['body', 'a body box of <p> paragraphs'],
  ['body-lines', 'a body box, a value with a line break'], ['list', 'a list (<ul>)'], ['div', 'a box of <div> blocks'], ['mixed', 'a heading and a paragraph'], ['empty', 'an empty box'], ['br', 'inline text with a <br>']]) {
  await check(`flag on, ${label}: the structure is read once with getTextBoxContent (before any save is begun), the words are written in it, stored by ONE chat-save PUT, the box keeps its text style; flag off is #551's content`, async () => {
    const on = await set('on', key), off = await set('off', key)
    const spec = SETS[key]
    assert.equal(makeLibs().keepLook.textBoxStructure(on.before.content), spec.structure, `the box holds ${spec.structure} content: ${on.before.content}`)
    assertStoredSet(on, spec.on, 'flag on')
    assertStoredSet(off, spec.off, 'flag off')
    const reads = on.w.requests().filter(item => item.action === 'getTextBoxContent')
    assert.equal(reads.length, 1); assert.deepEqual(reads[0].params, { elementId: on.id })
    const actions = on.w.actions()
    assert.ok(actions.indexOf('getSlideGenerationContext') < actions.indexOf('getTextBoxContent') && actions.indexOf('getTextBoxContent') < actions.indexOf('beginTargetedElementSave'), actions.join(','))
    assert.equal(off.w.actions().filter(action => action === 'getTextBoxContent').length, 0, 'flag off reads nothing')
    const reply = on.w.viewer.log.frames.map(item => item.data).find(data => data.requestId !== undefined && data.content !== undefined && data.plainText !== undefined)
    assert.ok(reply, 'the viewer answered the read')
    assert.equal(reply.content, on.before.content, 'the read answers the box\'s content')
    assert.equal(resultShape(on.result), resultShape(off.result), 'the result frame is the same either way')
    if (spec.structure === 'inline') assert.notEqual(spec.on, spec.off); else assert.equal(spec.on, spec.off, 'a paragraph box or another structure: #551\'s content, byte for byte')
    if (LIVE) { // a reload of the stored deck shows the words in the box
      const fresh = reloadedViewer(on.w.server().deck)
      assert.equal(fresh.document.getElementById(on.id).querySelector('.textbox-content').innerHTML, spec.on, 'the reloaded box')
    }
  })
}
await check('recorded frames: DIRECTOR-2\'s 01 (row 44 title) and 02 (a value with a line break), replayed verbatim with the flag on, are answered as Director\'s recorded Studio reply; the title is written inline (no <p>), "\\n" as <br>', async () => {
  for (const [name, key] of [['01-row-44-title', 'title-exact'], ['02-multi-line', 'title-lines']]) {
    const recordedFrame = RECORDED[name].director_frames[0]
    const run = await runSet('on', key, { name: `on-rec-${name}`, record: recordedFrame })
    assert.deepEqual(run.result, RECORDED[name].studio_replies[0].payload, `${name}: the result is the recorded element_edit_result`)
    assert.equal(run.w.sent.length, 1, 'Studio sends the one result and no text of its own')
    assert.equal(run.after.content, SETS[key].on)
    assert.equal(putsTo(run.w.fetches(), CHAT_SAVE)[0].body.element.content, SETS[key].on)
  }
})

// ===== 4. the structure cannot be read: #551's <p> per line, the edit still succeeds ===========================================================================================
for (const [key, label, patch] of [
  ['unread-rejected', 'the read is refused (Layout answers success:false: the command rejects)', viewer => { viewer.context.ElementManager.getTextBoxContent = () => ({ success: false, error: 'Text box not found' }) }],
  ['unread-no-content', 'the read answers no content', viewer => { viewer.context.ElementManager.getTextBoxContent = () => ({ success: true }) }],
]) {
  await check(`unread (${label}): #551's <p> content is written and stored, ok:true; the edit is not failed for it`, async () => {
    const run = await runSet('on', 'title-exact', { name: `on-${key}`, patch })
    assertStoredSet(run, SETS['title-exact'].off, key)
    assert.equal(run.w.actions().filter(action => action === 'getTextBoxContent').length, 1, 'the read was tried once')
  })
}

// ===== 5. escaping and the value rules are unchanged ===================================================================================================================
await check('escaping: a typed & < > " \' is text, never markup, inline too (stored as entities, one <br> between lines); "<b>x</b>", empty and 501 characters are INVALID_VALUE and nothing is read or stored', async () => {
  const run = await set('on', 'title-escape')
  assertStoredSet(run, SETS['title-escape'].on, 'escaped inline')
  assert.ok(!run.after.content.includes('<b>') && !/<(?!br>)/.test(run.after.content), 'no tag')
  for (const [name, value] of [['html', '<b>x</b>'], ['empty', ''], ['501', 'a'.repeat(501)], ['emoji501', '😀'.repeat(501)]]) {
    const w = await scenario(`on-invalid-${name}`)
    assert.equal((await w.sendQuiet(frame('textbox_a1', value, SLIDE3))).error_code, 'INVALID_VALUE', name)
    w.finish()
  }
  const ok = await runSet('on', 'title-exact', { name: 'on-emoji500', record: frame('textbox_a1', '😀'.repeat(500), SLIDE3) })
  assert.equal(Array.from(ok.after.content).length, 500); assert.equal(ok.after.content, '😀'.repeat(500))
})

// ===== 6. the look, measured: Layout's real CSS in Chromium ===================================================================================================================
const lookOf = (run, which) => renderHtml(which === 'before' ? run.before : run.after)
const sameLook = (a, b, label) => { for (const field of ['boxFontSize', 'boxFontWeight', 'leafTag', 'fontSize', 'fontWeight', 'color']) assert.equal(a[field], b[field], `${label}: ${field}`) }
await check('look (the bug, measured): the title as stored is 42px/700 straight in the box; with the flag OFF (#551) the stored <p> is drawn at the body size (20px; it inherits the weight of the box); with the flag ON it stays 42px/700 in the same colour, and two lines are two lines', async () => {
  const on = await set('on', 'title-exact'), off = await set('off', 'title-exact'), onLines = await set('on', 'title-lines'), offLines = await set('off', 'title-lines')
  const m = await renderCases([
    { name: 'title-baseline', html: lookOf(on, 'before') },
    { name: 'title-flag-off', html: lookOf(off, 'after') },
    { name: 'title-flag-on', html: lookOf(on, 'after') },
    { name: 'title-lines-flag-off', html: lookOf(offLines, 'after') },
    { name: 'title-lines-flag-on', html: lookOf(onLines, 'after') },
  ])
  for (const key of ['title-baseline', 'title-flag-on', 'title-lines-flag-on']) { assert.equal(m[key].fontSize, '42px', key); assert.equal(m[key].fontWeight, '700', key); assert.equal(m[key].leafTag, 'div', `${key}: the words sit directly in the box`) }
  sameLook(m['title-flag-on'], m['title-baseline'], 'flag on keeps the stored look')
  assert.equal(m['title-flag-off'].leafTag, 'p'); assert.equal(m['title-flag-off'].fontSize, '20px', 'the bug: the body paragraph size (Layout\'s --theme-body-p-size)')
  assert.equal(m['title-flag-off'].fontWeight, m['title-baseline'].fontWeight, 'the weight is inherited by a <p> (Layout\'s paragraph rule sets no weight): only the size and the colour are the body\'s')
  // colour: reported, not asserted (whether the theme's body colour differs from the title's is the theme's business: asserting a difference could fake one)
  assert.equal(m['title-baseline'].lines, 1); assert.equal(m['title-flag-on'].lines, 1)
  assert.equal(m['title-lines-flag-on'].lines, 2, 'two lines'); assert.equal(m['title-lines-flag-off'].lines, 2); assert.equal(m['title-lines-flag-off'].fontSize, '20px')
  // the REAL viewer page (Layout's server.py and viewer, Layout's CSS and JS, Chromium): the same title as stored, as #551 stores it, and as this change stores it, from the decks Layout's server held in this run
  const pages = await pageRender([
    { name: 'page-baseline', deck: STORED, id: 'textbox_a1', png: 'title-1-baseline-stored-inline' },
    { name: 'page-flag-off', deck: off.w.server().deck, id: 'textbox_a1', png: 'title-2-flag-off-p' },
    { name: 'page-flag-on', deck: on.w.server().deck, id: 'textbox_a1', png: 'title-3-flag-on-inline' },
    { name: 'page-lines-flag-off', deck: offLines.w.server().deck, id: 'textbox_a1', png: 'title-4-flag-off-two-lines' },
    { name: 'page-lines-flag-on', deck: onLines.w.server().deck, id: 'textbox_a1', png: 'title-5-flag-on-two-lines' },
  ])
  assert.equal(pages['page-baseline'].storedContent, STORED.slides[2].text_boxes[0].content); assert.equal(pages['page-flag-off'].storedContent, SETS['title-exact'].off); assert.equal(pages['page-flag-on'].storedContent, SETS['title-exact'].on)
  assert.equal(pages['page-flag-off'].leafTag, 'p', 'on the real page the flag-off words sit in a <p>')
  assert.notEqual(pages['page-flag-off'].fontSize, pages['page-baseline'].fontSize, 'and are drawn at another size than the stored title')
  for (const key of ['page-flag-on', 'page-lines-flag-on']) { assert.equal(pages[key].fontSize, pages['page-baseline'].fontSize, `${key}: the stored title's size`); assert.equal(pages[key].fontWeight, pages['page-baseline'].fontWeight, `${key}: weight`); assert.equal(pages[key].leafTag, pages['page-baseline'].leafTag, `${key}: the words sit where the stored title's did`) }
  assert.equal(pages['page-lines-flag-on'].lines, 2); assert.equal(pages['page-lines-flag-off'].lines, 2)
  console.log(`  real page: title stored ${pages['page-baseline'].fontSize}/${pages['page-baseline'].fontWeight} <${pages['page-baseline'].leafTag}>; flag OFF <${pages['page-flag-off'].leafTag}> ${pages['page-flag-off'].fontSize}/${pages['page-flag-off'].fontWeight} ${pages['page-flag-off'].color}; flag ON ${pages['page-flag-on'].fontSize}/${pages['page-flag-on'].fontWeight} ${pages['page-flag-on'].color}`)
  console.log(`  computed: title stored ${m['title-baseline'].fontSize}/${m['title-baseline'].fontWeight}; flag OFF (#551) <${m['title-flag-off'].leafTag}> ${m['title-flag-off'].fontSize}/${m['title-flag-off'].fontWeight}; flag ON ${m['title-flag-on'].fontSize}/${m['title-flag-on'].fontWeight}; colours stored ${m['title-baseline'].color}, OFF ${m['title-flag-off'].color}, ON ${m['title-flag-on'].color}; two lines ON ${m['title-lines-flag-on'].lines}`)
})
await check('look: the slide\'s layout title (edit-mode template text) keeps its look with the flag on (the same size, weight and colour as before the set); with the flag off the words sit in a <p>', async () => {
  const on = await set('on', 'layout-title'), off = await set('off', 'layout-title')
  const m = await renderCases([{ name: 'layout-title-baseline', html: lookOf(on, 'before') }, { name: 'layout-title-flag-off', html: lookOf(off, 'after') }, { name: 'layout-title-flag-on', html: lookOf(on, 'after') }])
  sameLook(m['layout-title-flag-on'], m['layout-title-baseline'], 'flag on')
  assert.equal(m['layout-title-flag-off'].leafTag, 'p'); assert.equal(m['layout-title-flag-on'].leafTag, m['layout-title-baseline'].leafTag)
  console.log(`  computed: layout title stored ${m['layout-title-baseline'].fontSize}/${m['layout-title-baseline'].fontWeight} (<${m['layout-title-baseline'].leafTag}>, class "${on.before.contentClass}"); flag OFF <${m['layout-title-flag-off'].leafTag}> ${m['layout-title-flag-off'].fontSize}/${m['layout-title-flag-off'].fontWeight}; flag ON ${m['layout-title-flag-on'].fontSize}/${m['layout-title-flag-on'].fontWeight}`)
})
await check('look: a body <p> box keeps its body style with the flag on (a <p> before and after, the same size and colour), one <p> per line; an empty box and a <br> box keep the box\'s own text style; other structures are #551\'s', async () => {
  const body = await set('on', 'body'), bodyLines = await set('on', 'body-lines'), empty = await set('on', 'empty'), emptyOff = await set('off', 'empty'), br = await set('on', 'br'), brOff = await set('off', 'br')
  const m = await renderCases([
    { name: 'body-baseline', html: lookOf(body, 'before') }, { name: 'body-flag-on', html: lookOf(body, 'after') }, { name: 'body-lines-flag-on', html: lookOf(bodyLines, 'after') },
    { name: 'empty-flag-on', html: lookOf(empty, 'after') }, { name: 'empty-flag-off', html: lookOf(emptyOff, 'after') },
    { name: 'br-baseline', html: lookOf(br, 'before') }, { name: 'br-flag-on', html: lookOf(br, 'after') }, { name: 'br-flag-off', html: lookOf(brOff, 'after') },
  ])
  sameLook(m['body-flag-on'], m['body-baseline'], 'body'); assert.equal(m['body-flag-on'].leafTag, 'p'); assert.equal(m['body-flag-on'].fontSize, '20px')
  assert.equal(m['body-lines-flag-on'].lines, 2); assert.equal(m['body-lines-flag-on'].leafTag, 'p')
  assert.equal(m['empty-flag-on'].leafTag, 'div'); assert.equal(m['empty-flag-on'].fontSize, m['empty-flag-on'].boxFontSize, 'an empty box\'s words take the box\'s own size'); assert.equal(m['empty-flag-off'].leafTag, 'p')
  sameLook(m['br-flag-on'], m['br-baseline'], 'a <br> box'); assert.equal(m['br-flag-on'].lines, 2); assert.equal(m['br-flag-off'].leafTag, 'p')
})

// ===== 7. Undo, and flag off is identical =====================================================================================================================================
await check('Undo: the result frame is byte-identical with the flag on and off, each set is ONE Layout version (the same summary), the previous stored words are the version before; chat undo is untouched', async () => {
  const on = await set('on', 'title-exact'), off = await set('off', 'title-exact')
  assert.equal(resultShape(on.result), resultShape({ directive_id: 'd', ok: true }))
  assert.equal(resultShape(on.result), resultShape(off.result))
  assert.equal(on.w.server().summaries.length, 1, 'one version'); assert.deepEqual(on.w.server().summaries, off.w.server().summaries)
  assert.equal(storedBox(STORED, 'textbox_a1', 2).content, 'Old <span class="accent" style="color: #0ea5e9">title</span>', 'the stored deck before the set (the version an Undo restores) still has the old words')
  for (const rel of ['lib/chat-undo-v2.ts', 'lib/chat-undo.ts'].filter(item => fs.existsSync(path.join(root, item)))) assert.equal(laterRead(rel), laterBlob(BASE_COMMIT, rel), `${rel} is not touched`)
})
const twin = async (name, send, options = {}) => {
  const mine = await scenario(name, options)
  const mineResult = await send(mine)
  const base = await scenario(`${name}-dev`, { ...options, transcriptFrom: name, libs: { overrides: BASE_OVERRIDES } })
  const baseResult = await send(base)
  const summary = (w, result) => ({ result: resultShape(result), requests: plain(w.requests().map(item => [item.action, item.params])), fetches: plain(w.fetches().map(item => [item.method, item.url, item.body])) })
  mine.finish()
  return { mine: summary(mine, mineResult), base: summary(base, baseResult), same: sha(JSON.stringify(summary(mine, mineResult))) === sha(JSON.stringify(summary(base, baseResult))), mineResult }
}
await check('flag off: an exact-text set sends the same viewer requests, makes the same saves and answers the same as dev\'s runner (this change\'s lines out), hashed: #551\'s <p>, no getTextBoxContent', async () => {
  const a = await twin('off-twin-set', w => w.send(frame('textbox_a1', TITLE_TEXT, SLIDE3)), { env: 'off', server: true })
  assert.equal(a.mineResult.ok, true)
  assert.ok(a.same, 'identical to dev\'s runner')
  assert.ok(!a.mine.requests.some(([action]) => action === 'getTextBoxContent'))
  assert.equal(a.mine.fetches[0][2].element.content, `<p>${TITLE_TEXT}</p>`)
})
for (const env of ['off', 'on']) {
  await check(`flag ${env}: a regular op (bold) sends the same viewer requests, makes the same save and answers the same as dev's runner (hashed)`, async () => {
    const a = await twin(`${env}-twin-bold`, w => w.send(regularFrame('style', 'body_b', { style: { bold: true } })), { env, server: true })
    assert.equal(a.mineResult.ok, true)
    assert.ok(a.same, 'identical to dev')
  })
}
await check('flag off: the strip gives dev\'s files back byte for byte (every added line is marked, pure insertions); the .env.example block comes out with its blank line; the taught proofs are dev\'s once put back; all read past the changes registered after this one', async () => {
  for (const rel of CHAT_TEXT_SET_KEEP_LOOK_FILES) {
    const base = git('show', `${BASE_COMMIT}:${rel}`), now = laterRead(rel)
    assert.equal(sha(stripChatTextSetKeepLook(rel, now)), sha(laterStrips(rel, base)), rel)
    const added = now.split('\n').length - laterStrips(rel, base).split('\n').length
    assert.equal(now.split('\n').filter(line => CHAT_TEXT_SET_KEEP_LOOK_MARKER_RE.test(line)).length, added, `${rel}: every added line carries the marker`)
  }
  assert.equal(withoutLaterEnvBlocks(read('.env.example')), `${git('show', `${BASE_COMMIT}:.env.example`)}\n${CHAT_TEXT_SET_KEEP_LOOK_ENV_BLOCK}`, 'the base, one blank line, the block')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', read('.env.example')), registry.stripLaterEnvBlocks('.env.example', git('show', `${BASE_COMMIT}:.env.example`)), 'the registry takes the block out')
  for (const rel of CHAT_TEXT_SET_KEEP_LOOK_NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)), rel)
  for (const rel of CHAT_TEXT_SET_KEEP_LOOK_FILES) assert.equal(stripChatTextSetKeepLook(rel, stripChatTextSetKeepLook(rel, read(rel))), stripChatTextSetKeepLook(rel, read(rel)), `${rel}: idempotent`)
  assert.equal(stripChatTextSetKeepLook('scripts/studio-later-changes.mjs', 'x'), 'x')
  assert.equal(stripChatTextSetKeepLook('hooks/use-deckster-websocket-v2.ts', 'x // CHAT-TEXT-SET-KEEP-LOOK\n'), 'x // CHAT-TEXT-SET-KEEP-LOOK\n', 'a file the change does not own comes back untouched')
  for (const rel of CHAT_TEXT_SET_KEEP_LOOK_PIN_FILES) {
    const dev = git('show', `${BASE_COMMIT}:${rel}`)
    assert.equal(sha(otherStrips(rel, stripChatTextSetKeepLook(rel, laterRead(rel)))), sha(otherStrips(rel, laterStrips(rel, dev))), `${rel}: the proof this change taught, put back (then the other changes' put-backs), is dev's`)
    assert.equal(sha(stripChatTextSetKeepLook(rel, otherStrips(rel, laterRead(rel)))), sha(otherStrips(rel, laterStrips(rel, dev))), `${rel}: and in the other order`)
    for (const [has] of CHAT_TEXT_SET_KEEP_LOOK_PIN_EDITS[rel]) { const lines = has.split('\n').filter(Boolean); assert.ok(lines.some(line => line.includes(CHAT_TEXT_SET_KEEP_LOOK_PIN_MARK)), `${rel}: a taught line carries the pin mark`); for (const line of lines) assert.match(line, /\/\/ LATER-CHANGES: registry read \(/, `${rel}: every line of a taught block is a registry read`) }
  }
})

// ===== 8. mutants ===========================================================================================================================================================================
const keepLibText = read(KEEP_LIB), runnerText = read(RUNNER)
/** A set under (possibly mutated) libs: the stored content is what it should be, every recorded request was made, nothing diverged (offline: the replay refuses a request that is not the recorded one). */
const keepRun = async (name, from, key, env, overrides, options = {}) => {
  const w = await scenario(name, { env, server: true, transcriptFrom: from, libs: { overrides }, ...options })
  const spec = SETS[key]
  const id = typeof spec.id === 'function' ? spec.id(w.viewer) : spec.id
  const result = await w.send(frame(id, spec.text, spec.slide))
  assert.equal(w.viewer.log.divergence, null, 'the viewer was asked what was recorded')
  assert.equal(w.requests().length, recorded.scenarios[from].requests.length, 'and every recorded request was made')
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(putsTo(w.fetches(), CHAT_SAVE)[0].body.element.content, env === 'on' ? spec.on : spec.off)
  assert.equal(w.requests().find(item => item.action === 'updateTextBoxContent').params.content, env === 'on' ? spec.on : spec.off)
}
await mutant('structure: every box taken for inline (the block check dropped: a body box loses its <p>)', () => keepRun('m-allinline', 'on-body', 'body', 'on', { [KEEP_LIB]: swap(keepLibText, "if (tags.size === 0) return 'inline'", "return 'inline'") }))
await mutant('structure: <p> not a block (a body box of paragraphs is taken for inline)', () => keepRun('m-pinline', 'on-body-lines', 'body-lines', 'on', { [KEEP_LIB]: swap(keepLibText, "'p', 'div', 'ul'", "'div', 'ul'") }))
await mutant('structure: lists not blocks (a list is taken for inline)', () => keepRun('m-listinline', 'on-list', 'list', 'on', { [KEEP_LIB]: swap(keepLibText, "'ul', 'ol', 'li', 'dl'", "'dl'") }))
await mutant('structure: a divs box is taken for paragraphs-or-inline (div not a block)', () => keepRun('m-divinline', 'on-div', 'div', 'on', { [KEEP_LIB]: swap(keepLibText, "'p', 'div', 'ul'", "'p', 'ul'") }))
await mutant('structure: a mixed box (a heading and a paragraph) taken for inline (the "other" rule dropped)', () => keepRun('m-mixed', 'on-mixed', 'mixed', 'on', { [KEEP_LIB]: swap(keepLibText, "return tags.size === 1 && tags.has('p') ? 'paragraphs' : 'other'", "return 'inline'") }))
await mutant('content: an unreadable structure is taken for inline (the title look is guessed for any box)', () => keepRun('m-unread', 'on-unread-rejected', 'title-exact', 'on', { [KEEP_LIB]: swap(keepLibText, "structure = 'unread'\n  }\n  step.params.content", "structure = 'inline'\n  }\n  step.params.content") }, { patch: viewer => { viewer.context.ElementManager.getTextBoxContent = () => ({ success: false, error: 'Text box not found' }) } }))
await mutant('content: the read\'s failure is not caught (a refused read fails the edit)', async () => {
  const w = await scenario('m-nocatch', { env: 'on', server: true, transcriptFrom: 'on-unread-rejected', libs: { overrides: { [KEEP_LIB]: swap(keepLibText, "  try {\n    structure = textBoxStructure(contentFromReply(await read(KEEP_LOOK_READ_COMMAND, { elementId })))\n  } catch {\n    structure = 'unread'\n  }\n", "  structure = textBoxStructure(contentFromReply(await read(KEEP_LOOK_READ_COMMAND, { elementId })))\n") } },
    patch: viewer => { viewer.context.ElementManager.getTextBoxContent = () => ({ success: false, error: 'Text box not found' }) } })
  const result = await w.send(frame('textbox_a1', TITLE_TEXT, SLIDE3))
  assert.equal(result.ok, true, JSON.stringify(result))
})
await mutant('content: lines joined by a space, not <br> (a two-line title is one line)', () => keepRun('m-nobr', 'on-title-lines', 'title-lines', 'on', { [KEEP_LIB]: swap(keepLibText, ".join('<br>')", ".join(' ')") }))
await mutant('content: no escaping on the inline path (a typed & < > " \' is markup)', () => keepRun('m-noescape', 'on-title-escape', 'title-escape', 'on', { [KEEP_LIB]: swap(keepLibText, '.map(line => escapeElementText(line)).join', '.map(line => line).join') }))
await mutant('content: the read command is misspelt (Layout answers "Unknown action": every structure is unread)', () => keepRun('m-readcmd', 'on-title-exact', 'title-exact', 'on', { [KEEP_LIB]: swap(keepLibText, "KEEP_LOOK_READ_COMMAND = 'getTextBoxContent'", "KEEP_LOOK_READ_COMMAND = 'getTextBoxContents'") }))
await mutant('content: the structure is read but the step keeps #551\'s content (the write dropped)', () => keepRun('m-nowrite', 'on-title-exact', 'title-exact', 'on', { [KEEP_LIB]: swap(keepLibText, '  step.params.content = keepLookHtml(text, structure)\n', '') }))
await mutant('content: the read is for another element', () => keepRun('m-otherid', 'on-title-exact', 'title-exact', 'on', { [KEEP_LIB]: swap(keepLibText, 'read(KEEP_LOOK_READ_COMMAND, { elementId })', "read(KEEP_LOOK_READ_COMMAND, { elementId: 'textbox_x' })") }))
await mutant('flag: the flag reads a loose value', () => assert.equal(makeLibs({ env: { ...ENVS.off, [FLAG]: '1' }, overrides: { [KEEP_LIB]: swap(keepLibText, "=== 'true'", '!== undefined') } }).keepLook.CHAT_TEXT_SET_KEEP_LOOK_ENABLED, false))
await mutant('runner: the structure is read with the flag off (the flag check dropped)', async () => {
  const w = await scenario('m-flagoff', { env: 'off', server: true, transcriptFrom: 'off-title-exact', libs: { overrides: { [RUNNER]: swap(runnerText, "if (CHAT_TEXT_SET_KEEP_LOOK_ENABLED && checked.edit.op === 'text') {", "if (checked.edit.op === 'text') {") } } })
  const result = await w.send(frame('textbox_a1', TITLE_TEXT, SLIDE3))
  assert.equal(w.viewer.log.divergence, null, 'flag off asks the viewer only what dev\'s runner does')
  assert.equal(result.ok, true)
})
await mutant('runner: the structure is read but the plan keeps #551\'s content (the keep-look call dropped)', () => keepRun('m-nocall', 'on-title-exact', 'title-exact', 'on', { [RUNNER]: swap(runnerText, 'await keepLookContent(plan.steps, checked.edit.text, elementId, sendTextBox)', 'void 0') }))
if (LIVE && !RECORD) {
  // The REAL Chromium and Layout CSS: with Layout's paragraph rule taken out of the page, the flag-off title would be 42px too (the bug is that rule)
  await mutant('render: Layout\'s body paragraph rule taken out of the CSS (the flag-off title is no longer small)', async () => {
    const off = await set('off', 'title-exact')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tskl-mut-'))
    try {
      const css = fs.readFileSync(path.join(LAYOUT_DIR, 'src/styles/content-typography.css'), 'utf8')
      const patched = swap(css, '.textbox-content:not(.leaf-rendered-content) p {\n  font-size: var(--theme-body-p-size);', '.textbox-content:not(.leaf-rendered-content) p {\n  font-size: inherit;')
      fs.mkdirSync(path.join(dir, 'src/styles/core'), { recursive: true })
      for (const rel of CSS_FILES) fs.writeFileSync(path.join(dir, rel), rel.endsWith('content-typography.css') ? patched : fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8'))
      const spec = path.join(dir, 'spec.json')
      fs.writeFileSync(spec, JSON.stringify({ layoutDir: dir, css: CSS_FILES, viewport: { width: 1600, height: 900 }, pngDir: null, cases: [{ name: 'x', html: lookOf(off, 'after'), png: null }] }))
      const out = execFileSync(RENDER_PYTHON, ['-B', RENDER_SCRIPT, spec], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 180_000, maxBuffer: 1 << 26 })
      assert.equal(JSON.parse(out.slice(out.lastIndexOf('@@RESULT@@') + '@@RESULT@@'.length)).x.fontSize, '20px', 'the flag-off title is small because of that rule')
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })
}

// ===== 9. Layout identity ======================================================================================================================================================
await check('Layout identity: the recording names the Layout files it ran (and, live, they are the files on disk); getTextBoxContent and updateTextBoxContent are served by the page; the CSS files measured are the recorded ones', async () => {
  if (RECORD) return
  for (const rel of ['viewer/presentation-viewer.html', 'src/utils/element-manager.js', 'chat_targeted_save.py', ...CSS_FILES]) assert.ok(recorded.meta?.sources?.[rel], rel)
  if (LIVE) {
    for (const [rel, hash] of Object.entries(recorded.meta.sources)) assert.equal(sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8')), hash, rel)
    const w = await scenario('identity', { server: false })
    assert.ok(w.viewer.bridge.commands.has('getTextBoxContent') && w.viewer.bridge.commands.has('updateTextBoxContent'), 'the served page has both commands')
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
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(CHAT_TEXT_SET_KEEP_LOOK_SUBJECT))
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
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), /^(Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:)/, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].sort(), [...CHAT_TEXT_SET_KEEP_LOOK_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of CHAT_TEXT_SET_KEEP_LOOK_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, CHAT_TEXT_SET_KEEP_LOOK_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.ok(diff.length > 0, `${rel}: the number of added lines`)
    assert.equal(stripChatTextSetKeepLook(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of CHAT_TEXT_SET_KEEP_LOOK_PIN_FILES) {
    const now = git('show', `${head}:${rel}`), dev = ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))
    assert.equal(stripChatTextSetKeepLook(rel, ctx.norm(rel, now)), dev, `${rel}: the proof this change taught, put back, is the base's`)
    assert.equal(ctx.norm(rel, stripChatTextSetKeepLook(rel, now)), dev, `${rel}: in either order of the put-backs (this change's strip commutes with the other changes' on a file they share)`)
  }
  for (const rel of CHAT_TEXT_SET_KEEP_LOOK_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['app/builder/page.tsx', 'components/presentation-viewer.tsx', 'hooks/use-deckster-websocket-v2.ts', 'hooks/use-textlabs-generation.ts', 'lib/chat-edit-targeted.ts', 'lib/chat-element-edit-2.ts', 'lib/chat-element-edit-wire.ts', 'lib/chat-element-text-set.ts', 'lib/chat-element-edit-save.ts', 'lib/chat-element-refine.ts', 'lib/chat-add-targeted.ts', 'scripts/studio-chat-element-edit-layout.mjs']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(CHAT_TEXT_SET_KEEP_LOOK_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${CHAT_TEXT_SET_KEEP_LOOK_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-chat-text-set-keep-look-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['CHAT_TEXT_SET_KEEP_LOOK_SCOPE_FILES', 'CHAT_TEXT_SET_KEEP_LOOK_ENV_BLOCK', 'stripChatTextSetKeepLook'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${CHAT_TEXT_SET_KEEP_LOOK_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to an existing file is a pure insertion that carries the marker; the strip gives the base back byte for byte (other changes\' lines out of both sides); the taught proofs put back are the base\'s', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of [...CHAT_TEXT_SET_KEEP_LOOK_NEW_FILES.filter(rel => !rel.endsWith('.json')), WIRE, RUNNER]) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
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
  for (const rel of CHAT_TEXT_SET_KEEP_LOOK_FILES) assert.equal(stripChatTextSetKeepLook(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
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
const syntheticStrip = (rel, text) => rel === RUNNER && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const runner = at(RUNNER).split('\n').flatMap(line => line.startsWith('export const ARRANGE_INTENT') ? [line, `const syntheticLater = 1 // ${SYN.marker}`] : [line]).join('\n')
  assert.ok(runner.includes(SYN.marker), 'the synthetic anchor exists')
  const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('CHAT_TEXT_SET_KEEP_LOOK_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('CHAT_TEXT_SET_KEEP_LOOK_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripChatTextSetKeepLook')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  return commitWith(parent, { [RUNNER]: runner, 'scripts/studio-later-changes.mjs': reg, '.env.example': `${at('.env.example')}\n${SYN.block}`, [SYN.file]: 'export const SYNTHETIC_SCOPE_FILES = new Set()\n' }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC = syntheticCommit(HEAD)
const SYN_CTX = {
  norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)),
  env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''),
}
await check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked line beside this change\'s in the runner, a registry trio, an .env.example block, a new file; its own commit has another subject) leaves this change\'s scope section passing, on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  assert.ok(ownOf(SYNTHETIC).length === ownOf(HEAD).length && !ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  for (const rel of CHAT_TEXT_SET_KEEP_LOOK_FILES) assert.equal(stripChatTextSetKeepLook(rel, SYN_CTX.norm(rel, git('show', `${gate}:${rel}`))), SYN_CTX.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree is the base's ${rel} without this change's and the later change's lines`)
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its lines are unmarked additions, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray foreign file in a "Text set keep look:" commit fails the committed-files check (own commits found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-chat-text-set.txt': 'stray\n' }, `${CHAT_TEXT_SET_KEEP_LOOK_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, and an unmarked line added to the runner in an own commit, fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${CHAT_TEXT_SET_KEEP_LOOK_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  const sneaky = commitWith(HEAD, { [RUNNER]: git('show', `${HEAD}:${RUNNER}`).replace('export const ARRANGE_INTENT', 'const sneaky = 1\nexport const ARRANGE_INTENT') }, `${CHAT_TEXT_SET_KEEP_LOOK_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/)
  const hook = commitWith(HEAD, { 'hooks/use-deckster-websocket-v2.ts': git('show', `${HEAD}:hooks/use-deckster-websocket-v2.ts`) + '\n' }, `${CHAT_TEXT_SET_KEEP_LOOK_SUBJECT} touches the hook${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(hook), /exactly its scope|is not touched/)
})


// ===== TAIL =====
if (RECORD) {
  recorded.meta = { recorded_with: 'CHAT_TEXT_SET_KEEP_LOOK_LAYOUT_DIR + --record-layout', layout_checkout: 'layout-builder uat, `git archive origin/uat` (a clean export: it cannot pick up an uncommitted edit)', layout_uat_sha: fs.existsSync(path.join(LAYOUT_DIR, '.uat-sha')) ? fs.readFileSync(path.join(LAYOUT_DIR, '.uat-sha'), 'utf8').trim() : null, studio_origin: STUDIO_ORIGIN,
    director_frame: 'scripts/fixtures/chat-element-text-set/director-frames/01-row-44-title.json (DIRECTOR-2\'s recorded op "text" frame); 01 and 02 are replayed verbatim, the others vary the element and the value on that envelope',
    render: 'headless Chromium (Playwright) over Layout\'s stylesheets (CSS_FILES), the page rebuilt from the viewer\'s DOM; the sizes are the computed ones. pageRender: the real viewer page (Layout\'s server.py and viewer on loopback, Chromium 1223 / playwright 1.60.0, reveal.js 5.2.0), seeded with the decks of this run',
    titleId: titleId((await scenario('probe-ids', { server: false })).viewer),
    sources: Object.fromEntries(['viewer/presentation-viewer.html', 'arrange_commands.py', 'chat_targeted_save.py', 'src/utils/chat-targeted-save.js', 'src/utils/arrange-commands.js', 'src/utils/edit-mode.js', 'src/utils/grid-converter.js', 'src/utils/auto-save.js', 'src/utils/element-manager.js', 'server.py',
      'src/utils/drag-drop.js', 'src/templates/template-registry.js', 'src/utils/semantic-slot-catalog.js', 'src/utils/direct-element-creator.js', ...CSS_FILES].map(rel => [rel, sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8'))])) }
  fs.mkdirSync(path.dirname(TRANSCRIPTS), { recursive: true })
  fs.writeFileSync(TRANSCRIPTS, `${JSON.stringify(recorded, null, 1)}\n`)
  console.log(`recorded ${Object.keys(recorded.scenarios).length} scenarios, ${Object.keys(recorded.render).length} renders`)
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed${LIVE ? ' (live Layout code, server and Chromium)' : ' (offline, recorded Layout code and measurements)'}`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
