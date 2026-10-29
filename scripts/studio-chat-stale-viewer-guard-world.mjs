// NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD (FRONTEND-2 B43): the world of scripts/test-studio-chat-stale-viewer-guard.mjs. A chat element ADD or EDIT after Director changed the deck on the server, from Director's directive frame to the stored deck, over REAL code at every step
// that can run under plain node:
//   STUDIO (this checkout, cut out by AST or loaded as it is):
//     - the page: the add runner (app/builder/page.tsx elementDirectiveRunnerRef.current), handleApprovedTextLabsGenerate, the edit runner (elementEditDirectiveRunnerRef.current) and the guard's deps (chatStaleViewerDepsRef.current), each evaluated as written;
//     - hooks/use-textlabs-generation.ts (the REAL hook, on plain hook bindings), hooks/use-generation-panel.ts, lib/chat-add-targeted.ts, lib/chat-edit-targeted.ts, lib/chat-element-edit*.ts, lib/chat-stale-viewer-guard.ts, lib/slide-rail-identity.ts (the inventory read), lib/studio-native-slide-order.ts;
//     - components/presentation-viewer.tsx: sendCommand, handleSendElementCommand (INSERT-PERSIST's edit mode included), handleSendTextBoxCommand, getStudioIntroductionSafety, captureStudioElementGeneration (the lease: it answers null while the viewer's last save status
//       is 'error'), getStudioSaveStatus, handleIframeLoad (the new frame), the save-status message effect and the save-ack effect.
//   LAYOUT (a layout-builder checkout at frontend2/layout-targeted-save, run unchanged): the viewer page's postMessage bridge (composeGetState included: its own handleComposeGetState is cut out of viewer/presentation-viewer.html), edit-mode.js, auto-save.js,
//     element-manager.js, arrange-commands.js, chat-targeted-save.js, Layout's own load path for a stored deck, and Layout's own server (server.py) answering every request: Director's slide changes (add, duplicate, delete, undo = restore a version), the slide inventory
//     GET Studio reads, the editor's whole-deck PUT and the targeted chat-save PUT.
// What is not real: Text Labs (a fetch stand-in that returns one element), the fake DOM, the virtual clock, Date / Math.random / crypto.randomUUID (fixed, so a run is the same bytes every time and the recording replays), React's hook bindings (plain ones), the page's
//   iframe (a viewer that is RELOADED is a new viewer built from the server's deck; the old one is retired), Layout's storage (a dict with versions), and Director's slide swap (a refine: modelled as the stored deck after it). The viewer's replies and frames and every
//   request to Layout are recordable; offline the proof replays the recording (replayViewer, and the recorded answers of Layout's server).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createClock, createLayoutViewer, replayViewer } from './studio-chat-element-edit-layout.mjs'
import { renderStoredDeck } from './studio-chat-edit-targeted-reload.mjs'
import { STUDIO_ORIGIN, LAYOUT_ORIGIN, PRESENTATION, SESSION, plain, functionText, callbackText, assignmentRight, constText, evalExpression, deterministic, TEXT_LABS_ANSWERS } from './studio-chat-add-targeted-world.mjs'
import { createServer } from './studio-chat-stale-viewer-guard-server.mjs'
import ts from 'typescript'

export { STUDIO_ORIGIN, LAYOUT_ORIGIN, PRESENTATION, SESSION, plain }

/** The Chromium rule the viewer's unload / hidden-tab flush runs into: a keepalive fetch whose body is over 64 KiB is refused with a TypeError before anything is sent (auto-save.js KEEPALIVE_BODY_BUDGET says so, and measured it). */
export const KEEPALIVE_LIMIT_BYTES = 65536
/** Virtual time a reloaded viewer takes to load the server's deck. */
export const RELOAD_LOAD_MS = 1500

const parseTs = (rel, text) => ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

/** Layout's compose state (composeGetState) for the harness viewer: its own handleComposeGetState and isComposePlaceholder, cut out of the viewer page by exact anchors; the slide sections come from the fake DOM. */
function addComposeState(viewer, layoutDir) {
  const html = fs.readFileSync(path.join(layoutDir, 'viewer/presentation-viewer.html'), 'utf8')
  const cut = name => {
    const head = `\n    function ${name}(`
    const at = html.indexOf(head)
    if (at < 0 || html.indexOf(head, at + 1) >= 0) throw new Error(`viewer html: expected exactly one ${name}`)
    const end = html.indexOf('\n    }\n', at + 1) + '\n    }\n'.length
    return html.slice(at + 1, end)
  }
  vm.runInContext(`${cut('isComposePlaceholder')}${cut('handleComposeGetState')}
    function getComposeSlideSections() { return Array.from(document.querySelectorAll('.reveal .slides > section')) }
    function scTrace() {}`, viewer.context, { filename: 'viewer-compose-state.js' })
}

const short = value => (typeof value === 'string' && value.length > 400 ? `~long:${value.length}:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 8)}` : value)
/** A stored deck as the proof reads it (and as the recording keeps it): every slide's id, layout and content, and each stored element's id, owner, position, z-index, text style and (shortened) content. The style blocks and padding are dropped: they are not what is asserted. */
export function shapeDeck(deck) {
  const box = item => ({ id: item.id, parent_slide_id: item.parent_slide_id ?? null, position: item.position ?? null, z_index: item.z_index ?? null, text_style: item.text_style ?? null, content: short(item.content) })
  return { id: deck.id, slides: deck.slides.map(slide => ({ slide_id: slide.slide_id, layout: slide.layout, content: Object.fromEntries(Object.entries(slide.content ?? {}).map(([key, value]) => [key, short(value)])),
    text_boxes: (slide.text_boxes ?? []).map(box), images: (slide.images ?? []).map(item => ({ id: item.id })), charts: (slide.charts ?? []).map(item => ({ id: item.id })) })) }
}
/** What the viewer PUT, as the proof reads it: the editor's whole-deck body by slide (id, element ids, field names); every other body (the targeted save's) as it is. */
export function shapeBody(url, body) {
  if (body && Array.isArray(body.slides)) return { keys: Object.keys(body), change_summary: body.change_summary ?? null, slides: body.slides.map(slide => ({ slide_id: slide.slide_id ?? null, keys: Object.keys(slide), boxes: (slide.text_boxes ?? []).map(item => item.id), images: (slide.images ?? []).map(item => item.id) })) }
  return body
}
const shapeAnswer = body => (body && typeof body === 'object' && body.presentation ? { ...body, presentation: shapeDeck(body.presentation) } : body)
/** What the viewer page is handed: renderPresentation sets data-slide-id from slide_id (or the legacy `id`) only when there is one, so a slide with neither is given '' here (the harness's loader sets the attribute unconditionally; '' is falsy, as an absent attribute is, and direct-element-creator.js then draws legacy ids and a temporary slide id of its own, as it does for a stored slide with no id). */
const renderCopy = deck => ({ ...deck, slides: deck.slides.map(slide => ({ ...slide, slide_id: slide.slide_id || slide.id || '' })) })
const fakeResponse = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body })

/** What Director does to the stored deck, as requests to Layout's own routes (`restore` takes a version id and is resolved by the caller). */
export const CHANGES = {
  addEnd: () => [{ method: 'POST', url: `/api/presentations/${PRESENTATION}/slides`, body: { layout: 'C1' } }],
  addMid: () => [{ method: 'POST', url: `/api/presentations/${PRESENTATION}/slides`, body: { layout: 'C1', position: 1 } }],
  dup: () => [{ method: 'POST', url: `/api/presentations/${PRESENTATION}/slides/1/duplicate`, body: {} }],
  del: () => [{ method: 'DELETE', url: `/api/presentations/${PRESENTATION}/slides/0` }],
}

/**
 * One scenario world. `options`:
 *   root, layoutDir (null: replay `recording`), python, env (the process.env of the Studio libs), overrides ({file: text}: mutants), stored (the stored deck), layoutTargeted (Layout's flag: the page served with chat-targeted-save.js),
 *   recording (offline: {viewers: [transcript...], calls: [...], deck}), viewerPutStatus (a stand-in refusal for the editor's whole-deck PUT), reloadMs (how long a reloaded viewer takes to load), slideCount (slides Director's outline lists).
 */
export async function createGuardWorld(options) {
  const { root, layoutDir, python, env, overrides = {}, stored, layoutTargeted = true, recording = null, viewerPutStatus: initialPutStatus = 200, reloadMs = RELOAD_LOAD_MS, base = false } = options // base: the files are read without this change's lines (they carry none), so nothing of it is cut out
  const read = options.read ?? (rel => fs.readFileSync(path.join(root, rel), 'utf8'))
  const live = !recording
  let viewerPutStatus = initialPutStatus // what the editor's whole-deck PUT is answered by a stand-in (not Layout's server) while it is not 200; setPutStatus changes it
  const clock = createClock()
  const fixed = deterministic(clock)
  const listeners = new Set()
  const fetches = []        // what the viewer asked Layout (every viewer, in order)
  const calls = []          // every request to Layout's server: {kind: 'change' | 'studio' | 'viewer', requests, statuses, bodies}
  const textLabs = []
  const consoleNotes = []
  const toasts = []
  const sent = []           // element_directive_result / element_edit_result frames
  const reloads = []        // virtual times of the viewer reloads
  const commandLog = []
  const server = live ? createServer(python, layoutDir, stored) : null
  let callIndex = 0
  const deckLog = []        // every deck() read, in order: the stored deck at that moment (shaped); replayed in the same order offline
  let deckReads = 0
  const serverCall = (kind, requests) => {
    if (live) {
      const answer = server.request(requests)
      calls.push({ kind, requests: plain(requests), statuses: answer.statuses, bodies: answer.bodies.map(shapeAnswer) })
      return answer
    }
    const recorded = recording.calls[callIndex++]
    assert.ok(recorded && recorded.kind === kind && JSON.stringify(recorded.requests) === JSON.stringify(plain(requests)), `replay: server call #${callIndex - 1} is ${kind} ${JSON.stringify(requests).slice(0, 120)}, recorded ${recorded ? `${recorded.kind} ${JSON.stringify(recorded.requests).slice(0, 120)}` : 'nothing'}`)
    calls.push(recorded)
    return recorded
  }

  // ---- the viewer (the iframe's document): one at a time; a reload retires it and loads the server's deck into a new one ----
  const studioWindow = { addEventListener(type, fn) { if (type === 'message') listeners.add(fn) }, removeEventListener(type, fn) { if (type === 'message') listeners.delete(fn) }, dispatchEvent() {} }
  let viewer = null
  const retired = new Set()
  let viewerNumber = 0
  const viewerHandle = { postMessage(data, targetOrigin) { assert.equal(targetOrigin, LAYOUT_ORIGIN); const request = plain(data); const target = viewer; queueMicrotask(() => { if (!retired.has(target)) target.deliver(request, STUDIO_ORIGIN).catch(error => { throw error }) }) } }
  const toStudio = viewerOf => data => queueMicrotask(() => { if (retired.has(viewerOf())) return; for (const fn of [...listeners]) fn({ source: viewerHandle, origin: LAYOUT_ORIGIN, data: plain(data) }) })
  const viewerFetch = holder => async (url, init) => {
    if (retired.has(holder.viewer)) return new Promise(() => {}) // the document is gone: its timers and requests go nowhere
    const body = init?.body ? JSON.parse(init.body) : null
    fetches.push({ at: clock.now(), viewer: holder.number, url: String(url), method: init?.method ?? 'GET', keepalive: init?.keepalive === true, bytes: init?.body ? init.body.length : 0, body: shapeBody(String(url), body) })
    if (init?.keepalive === true && init.body && init.body.length > KEEPALIVE_LIMIT_BYTES) throw new TypeError('Failed to fetch') // Chromium: nothing is sent
    if (viewerPutStatus !== 200 && init?.method === 'PUT' && /\/slides$/.test(String(url))) return fakeResponse(viewerPutStatus, { detail: { code: 'SYNTHETIC', message: 'synthetic save refusal' } })
    const answer = serverCall('viewer', [{ method: init?.method ?? 'GET', url: String(url), body }])
    return fakeResponse(answer.statuses[0], answer.bodies[0])
  }
  function makeViewer() {
    const number = ++viewerNumber
    const holder = { number, viewer: null }
    if (live) {
      const next = createLayoutViewer({ layoutDir, studioOrigin: STUDIO_ORIGIN, parent: { postMessage: data => toStudio(() => holder.viewer)(data) }, clock, presentationId: PRESENTATION, arrange: true, targeted: layoutTargeted, fetchImpl: viewerFetch(holder) })
      holder.viewer = next
      next.context.Date = fixed.Date; next.context.Math = fixed.Math
      renderStoredDeck(next, renderCopy(server.state.deck), layoutDir) // Layout's own load path, over the deck the server holds NOW
      for (const section of next.document.querySelectorAll('.reveal .slides > section')) if (section.getAttribute('data-slide-id') === '') section.removeAttribute('data-slide-id') // a slide with no id and no temporary one keeps no attribute at all, as in renderPresentation
      addComposeState(next, layoutDir)
      return next
    }
    const transcript = recording.viewers[number - 1]
    assert.ok(transcript, `a recorded viewer #${number}`)
    holder.viewer = replayViewer({ transcript, parent: { postMessage: data => toStudio(() => holder.viewer)(data) }, clock })
    return holder.viewer
  }
  const allViewers = []
  viewer = makeViewer(); allViewers.push(viewer)
  clock.setGuard?.(() => { for (const v of allViewers) if (v.log.divergence) throw v.log.divergence })

  // ---- Studio libs in a vm ----
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const text = overrides[file] ?? read(file)
    const out = ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
    const sandbox = { module, exports: module.exports, process: { env }, console: { log() {}, info: (...args) => consoleNotes.push(args.map(String).join(' ')), debug() {}, warn() {}, error() {} },
      URL, Promise, Error, TypeError, DOMException, AbortController, JSON, Math: fixed.Math, Set, Map, Object, Array, Number, String, Boolean, RegExp, Symbol, parseFloat, isFinite, Date: fixed.Date, FormData, Blob, encodeURIComponent,
      crypto: { randomUUID: fixed.randomUUID }, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, WebSocket: () => { throw new Error('no sockets') },
      fetch: async (url, init) => {
        if (String(url).startsWith(LAYOUT_ORIGIN)) return studioFetch(url, init)
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body instanceof FormData ? Object.fromEntries(init.body.entries()) : null
        textLabs.push({ url: String(url), body })
        const type = body?.component_type ?? body?.componentType ?? options.currentType
        const answer = TEXT_LABS_ANSWERS[options.currentType] ?? TEXT_LABS_ANSWERS[type] ?? TEXT_LABS_ANSWERS.TEXT_BOX
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, elements: [{ element_id: 'tl-1', ...answer }] }) }
      },
      require(spec) {
        if (spec === 'react') return hooks
        if (spec.startsWith('@/')) for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, spec.slice(2) + ext))) return load(spec.slice(2) + ext)
        throw new Error(`unexpected dependency ${spec} of ${file}`)
      } }
    vm.runInNewContext(out, sandbox, { filename: file })
    return module.exports
  }
  /** Studio's own reads of Layout (the slide inventory): Layout's server answers them, against the deck it stores. */
  async function studioFetch(url, init) {
    const rel = String(url).slice(LAYOUT_ORIGIN.length)
    const answer = serverCall('studio', [{ method: init?.method ?? 'GET', url: rel }])
    return fakeResponse(answer.statuses[0], answer.bodies[0])
  }
  const equalDeps = (a, b) => a?.length === b?.length && a.every((value, index) => Object.is(value, b[index]))
  let active
  const hooks = {
    useRef(value) { const s = active, i = s.cursor++; return s.slots[i] ??= { current: value } },
    useState(value) { const s = active, i = s.cursor++; if (!(i in s.slots)) s.slots[i] = typeof value === 'function' ? value() : value; return [s.slots[i], next => { const old = s.slots[i], v = typeof next === 'function' ? next(old) : next; if (!Object.is(old, v)) { s.slots[i] = v; s.dirty = true } }] },
    useCallback(fn, deps) { const s = active, i = s.cursor++, old = s.slots[i]; if (!old || !equalDeps(deps, old.deps)) s.slots[i] = { value: fn, deps }; return s.slots[i].value },
    useMemo(fn, deps) { const s = active, i = s.cursor++, old = s.slots[i]; if (!old || !equalDeps(deps, old.deps)) s.slots[i] = { value: fn(), deps }; return s.slots[i].value },
    useEffect(fn, deps) { const s = active, i = s.cursor++, old = s.slots[i]; if (!old || !equalDeps(deps, old.deps)) s.pending.push(() => { old?.cleanup?.(); s.slots[i] = { deps, cleanup: fn() } }) },
  }
  const scope = () => ({ slots: [], cursor: 0, pending: [], dirty: false })
  const render = (s, fn) => { let result, n = 0; do { s.cursor = 0; s.pending = []; s.dirty = false; active = s; result = fn(); s.pending.forEach(effect => effect()); assert.ok(++n < 20) } while (s.dirty); return result }

  // ---- libs ----
  const messaging = load('lib/layout-viewer-messaging.ts')
  const router = load('lib/element-command-router.ts')
  const persist = load('lib/studio-insert-persist.ts')
  const composeAsync = load('lib/slide-compose-async.ts')
  const nativeOrder = load('lib/studio-native-slide-order.ts')
  const inventoryLib = load('lib/slide-rail-identity.ts')
  const editWire = load('lib/chat-element-edit-wire.ts')
  const editSave = load('lib/chat-element-edit-save.ts')
  const editLib = load('lib/chat-element-edit.ts')
  const guardLib = load('lib/chat-stale-viewer-guard.ts')
  const mdc = load('lib/mdc-element-directive.ts')
  const { useTextLabsGeneration } = load('hooks/use-textlabs-generation.ts')
  const { useGenerationPanel } = load('hooks/use-generation-panel.ts')

  // ---- Studio's command path and the viewer's own state, cut out of components/presentation-viewer.tsx ----
  const viewerTsx = read('components/presentation-viewer.tsx')
  const bridgeJs = js(`${functionText('components/presentation-viewer.tsx', 'createViewerRequestId', viewerTsx)}\n${functionText('components/presentation-viewer.tsx', 'sendCommand', viewerTsx)}\n;({ sendCommand })`)
  const iframe = { src: `${LAYOUT_ORIGIN}/p/${PRESENTATION}`, contentWindow: viewerHandle }
  const iframeRef = { current: iframe }
  const { sendCommand } = vm.runInNewContext(bridgeJs, {
    window: studioWindow, Promise, Error, Date: fixed.Date, Math: fixed.Math, JSON, Object, Array, queueMicrotask, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    crypto: { randomUUID: (() => { let n = 0; return () => `studio-request-${++n}` })() }, getLayoutServiceUrl: () => LAYOUT_ORIGIN, VIEWER_ORIGIN: LAYOUT_ORIGIN,
    getLayoutViewerOrigin: messaging.getLayoutViewerOrigin, isTrustedLayoutViewerMessage: messaging.isTrustedLayoutViewerMessage,
    isMatchingSlideComposeCommandResponse: composeAsync.isMatchingSlideComposeCommandResponse, scTrace() {}, isSlideComposerTraceEnabled: () => false, reportLayoutCommandAck() {},
  })
  const timeoutConstants = {}
  for (const statement of parseTs('components/presentation-viewer.tsx', viewerTsx).statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
    const name = declaration.name.getText(), value = declaration.initializer?.getText() ?? ''
    if (/_TIMEOUT_MS$/.test(name) && /^[\d_]+$/.test(value)) timeoutConstants[name] = Number(value.replace(/_/g, ''))
  }
  const timeouts = evalExpression(constText('components/presentation-viewer.tsx', 'LAYOUT_ELEMENT_COMMAND_TIMEOUTS', viewerTsx), timeoutConstants)
  const editModeChanges = []
  const slideState = { current: 1 }
  // the viewer's React state, as the cut code reads and writes it
  const viewerState = { saveStatus: 'saved', ready: true, isEditMode: false }
  const introSafetyRef = { current: { presentationId: PRESENTATION, presentationUrl: iframe.src, viewerIsReady: true, isEditMode: false, isSaving: false, saveStatus: 'saved', composing: false, composeError: false } }
  const setSaveStatus = value => { viewerState.saveStatus = value; introSafetyRef.current = { ...introSafetyRef.current, saveStatus: value } }
  const refs = {
    nativeSnapshotDirtyRef: { current: false }, slideMutationPendingRef: { current: false }, slideMutationRequestRef: { current: null },
    diagramStateTimersRef: { current: new Map() }, pendingDiagramStatesRef: { current: new Map() },
  }
  const getStudioIntroductionSafety = evalExpression(callbackText('components/presentation-viewer.tsx', 'useCallback', 'const safety = introSafetyRef.current', viewerTsx), { introSafetyRef, ...refs })
  const getStudioSaveStatus = base ? null : evalExpression(callbackText('components/presentation-viewer.tsx', 'useCallback', 'introSafetyRef.current.saveStatus', viewerTsx), { introSafetyRef })
  const sendElementCommandText = callbackText('components/presentation-viewer.tsx', 'useCallback', '// Direct Layout Service command - send to iframe', viewerTsx)
  const handleSendElementCommand = evalExpression(sendElementCommandText, {
    iframeRef, getCommandType: router.getCommandType, studioShell: true, viewerInteractionIntentRef: { current: 0 }, STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED: false, isSlideOpViewerAction: () => false, debugLog() {}, console: { warn() {}, error() {}, log() {} },
    shouldEnsureEditModeForPersistence: persist.shouldEnsureEditModeForPersistence, STUDIO_INSERT_PERSIST_ENABLED: persist.STUDIO_INSERT_PERSIST_ENABLED, ensureViewerTracksEdits: persist.ensureViewerTracksEdits, sendCommand,
    setIsEditMode: value => { viewerState.isEditMode = value; editModeChanges.push(value) }, onEditModeChangeRef: { current: value => editModeChanges.push(`notify:${value}`) },
    LAYOUT_ELEMENT_COMMAND_TIMEOUTS: timeouts, DEFAULT_LAYOUT_COMMAND_TIMEOUT_MS: 5000, presentationId: PRESENTATION, currentSlide: 2, reportLayoutCommandAck() {},
  })
  const handleSendTextBoxCommand = evalExpression(callbackText('components/presentation-viewer.tsx', 'useCallback', "if (studioShell) viewerInteractionIntentRef.current += 1\n    return sendCommand(iframeRef.current, action, params)", viewerTsx), {
    iframeRef, studioShell: true, viewerInteractionIntentRef: { current: 0 }, sendCommand,
  })
  const owner = { userId: 'user-1', presentationId: PRESENTATION, sessionId: SESSION, deckOwnerSessionId: SESSION }
  // the lease the generation takes: the viewer's own captureStudioElementGeneration; the native frame it holds is current while this viewer is the one in the iframe
  const loggedElementCommand = (action, params) => { commandLog.push(action); world.onCommand?.(action); return handleSendElementCommand(action, params) } // the lease's commands are logged (and may be hooked) like the others
  const captureLease = evalExpression(callbackText('components/presentation-viewer.tsx', 'useCallback', 'StudioElementGenerationLease', viewerTsx), {
    renderSlideMutationOwner: owner, studioFormatModeRef: { current: { enabled: false } }, getStudioIntroductionSafety, studioShell: true, handleSendElementCommand: loggedElementCommand,
    captureStudioNativeSlideFrame: () => { const mine = viewer; return { isCurrent: () => viewer === mine && !retired.has(mine) } },
  })
  /** the new frame: handleIframeLoad's own code, over stand-ins for the refs it clears */
  const handleIframeLoad = evalExpression(callbackText('components/presentation-viewer.tsx', 'useCallback', "debugLog('✅ Iframe loaded and ready')", viewerTsx), {
    studioShell: true, iframeRef, approvedIframeNavigationUrl: iframe.src, debugLog() {}, STUDIO_SLIDE_DELETE_CANVAS_REFRESH_ENABLED: false, studioSlideDeleteRefresh: { frameLoaded() {} },
    studioComposeLoadRevisionRef: { current: 0 }, studioComposeLoadedFrameRef: { current: null }, slideMutationOwnerRef: { current: { generation: 0 } }, slideMutationRequestRef: { current: null }, slideMutationPendingRef: refs.slideMutationPendingRef,
    studioNativeMutationPublicationRef: { current: null }, studioDeleteDialogRef: { current: null }, studioManualSlideNavigationRef: { current: null }, studioSaveRequestRef: { current: null },
    setIsSaving() {}, setIsSlideMutationPending() {}, setIsDeleting() {}, setShowDeleteDialog() {}, setSlidesToDelete() {}, setNativeSnapshotSafetyRevision() {}, setLoadedApprovedNavigationUrl() {}, setIframeReady() {}, setPollingFailureCount() {},
    lastSlideInfoRef: { current: null }, setSaveStatus, CHAT_STALE_VIEWER_GUARD_ENABLED: guardLib.CHAT_STALE_VIEWER_GUARD_ENABLED,
  })
  const saveStatusEffect = evalExpression(callbackText('components/presentation-viewer.tsx', 'useEffect', "'saveStatusChanged'", viewerTsx), {
    window: studioWindow, VIEWER_ORIGIN: LAYOUT_ORIGIN, LAYOUT_URL_CONFIG_ERROR: null, isTrustedLayoutViewerMessage: messaging.isTrustedLayoutViewerMessage, iframeRef,
    isLayoutViewerEvent: router.isLayoutViewerEvent, isDiagramRendererStateEvent: () => false, parseDiagramRendererStateUpdate: () => null, studioShell: false,
    viewerInteractionIntentRef: { current: 0 }, pendingDiagramStatesRef: refs.pendingDiagramStatesRef, diagramStateTimersRef: refs.diagramStateTimersRef, postCommand() {},
    nativeSnapshotDirtyRef: refs.nativeSnapshotDirtyRef, reportOwnDeckEdit() {}, setNativeSnapshotSafetyRevision() {}, setSaveStatus, debugLog() {},
    onRefineElementRequested: null, resolveRefineElementGenerationConfig: () => null, studioArrangeOwnsSaveStatus: () => false, CHAT_ELEMENT_EDIT_ENABLED: editWire.CHAT_ELEMENT_EDIT_ENABLED,
    publishViewerSaveEvent: editSave.publishViewerSaveEvent, console, clearTimeout: clock.clearTimeout,
  })
  saveStatusEffect()
  const saveAckEffect = base ? null : evalExpression(callbackText('components/presentation-viewer.tsx', 'useEffect', 'handleSaveAck', viewerTsx), {
    window: studioWindow, VIEWER_ORIGIN: LAYOUT_ORIGIN, LAYOUT_URL_CONFIG_ERROR: null, isTrustedLayoutViewerMessage: messaging.isTrustedLayoutViewerMessage, iframeRef,
    CHAT_STALE_VIEWER_GUARD_ENABLED: guardLib.CHAT_STALE_VIEWER_GUARD_ENABLED, CHAT_ELEMENT_EDIT_ENABLED: editWire.CHAT_ELEMENT_EDIT_ENABLED, publishViewerSaveEvent: editSave.publishViewerSaveEvent,
  })
  saveAckEffect?.()
  const ensureEditMode = evalExpression(callbackText('components/presentation-viewer.tsx', 'useCallback', 'Studio must also observe native E/Escape exits', viewerTsx), {
    studioShell: true, beginStudioViewerInteraction: () => ({ isCurrent: () => true, iframe }), isEditMode: false, iframeRef, sendCommand,
    setIsEditMode() {}, onEditModeChange() {}, debugLog() {}, console,
  })
  if (editWire.CHAT_ELEMENT_EDIT_ENABLED) editSave.registerChatEditViewer({ ensureEditMode: () => ensureEditMode() })

  const sendElementCommand = (action, params) => { commandLog.push(action); world.onCommand?.(action); return handleSendElementCommand(action, params) }
  const sendTextBoxCommand = (action, params) => { commandLog.push(action); world.onCommand?.(action); return handleSendTextBoxCommand(action, params) }

  // ---- the page, as it holds the viewer: rebuilt on every viewer load (a render of app/builder/page.tsx) ----
  const pageText = read('app/builder/page.tsx')
  const ownerRef = { current: { sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: PRESENTATION, epoch: 0 } }
  const composeViewerApiRef = { current: null }
  const chatStaleViewerApisRef = { current: null }
  const elementDirectiveRunnerRef = { current: null }
  const elementEditDirectiveRunnerRef = { current: null }
  const chatStaleViewerDepsRef = { current: null }
  const chatElementEditGateRef = { current: editWire.CHAT_ELEMENT_EDIT_ENABLED ? editLib.createElementEditGate() : null }
  const panel = render(scope(), useGenerationPanel)
  const themeSync = { status: 'applied', requestId: 'synthetic-theme-request', presentationId: PRESENTATION, themeFingerprint: 'synthetic-theme', error: null }
  const genScope = scope()
  const guardRef = { current: null }
  const deckChangedNotice = { reload: () => world.reload() }
  let layoutApis = null
  const buildPage = () => {
    layoutApis = viewerState.ready ? { sendElementCommand, sendTextBoxCommand, goToSlide: async index => { slideState.current = index }, captureStudioElementGeneration: captureLease, getStudioIntroductionSafety, getStudioSaveStatus } : null
    const hookParams = { generationPanel: panel, blankElements: { getElement: () => undefined, updatePosition() {}, setStatus() {}, updateGenerationMetadata() {}, removeElement() {}, addElement() {}, trackElement() {} },
      textLabsSession: { ensureSession: async () => 'synthetic-textlabs-session' }, layoutServiceApis: layoutApis, presentationId: PRESENTATION, currentSlideIndex: slideState.current, getCurrentSlideIndex: () => slideState.current,
      researchCapabilities: { web: false, uploadedDocuments: false, knowledgeGraph: false }, getThemeSyncSnapshot: () => ({ ...themeSync }),
      ensureThemeReady: async () => ({ ready: true, source: 'director', sync: { ...themeSync } }), toast: value => toasts.push(plain(value)) }
    const driver = render(genScope, () => useTextLabsGeneration(hookParams))
    const handleApprovedTextLabsGenerate = evalExpression(callbackText('app/builder/page.tsx', 'useCallback', 'try { return await handleTextLabsGenerate(formData, submitIntent, invocation) }', pageText), {
      layoutServiceApis: layoutApis, generationPanel: { setError() {} }, toast: value => toasts.push(plain(value)), effectivePresentationId: PRESENTATION, saveSessionOnFirstAction() {}, studioShell: true,
      studioPartialLocalWorkRef: { current: new Set() }, studioPartialMountedRef: { current: true }, setStudioPartialRevision() {}, handleTextLabsGenerate: driver.handleGenerate,
    })
    const runnerText = assignmentRight('app/builder/page.tsx', 'elementDirectiveRunnerRef.current', pageText)
    elementDirectiveRunnerRef.current = evalExpression(runnerText.replace("await import('@/lib/mdc-element-directive')", '__mdc'), {
      __mdc: mdc, elementDirectiveGenerationOwnerRef: ownerRef, sendElementDirectiveResult: result => { sent.push(plain(result)); return true },
      slideStructure: { slides: Array.from({ length: 12 }, () => ({})) }, generationPanel: { getSnapshot: () => ({ isOpen: false }), hasActiveGenerations: false }, currentSlideIndexRef: slideState, layoutServiceApis: layoutApis,
      handleApprovedTextLabsGenerate, toast: value => toasts.push(plain(value)), setTimeout: clock.setTimeout, Promise,
    })
    if (editWire.CHAT_ELEMENT_EDIT_ENABLED) elementEditDirectiveRunnerRef.current = evalExpression(assignmentRight('app/builder/page.tsx', 'elementEditDirectiveRunnerRef.current', pageText), {
      CHAT_ELEMENT_EDIT_ENABLED: editWire.CHAT_ELEMENT_EDIT_ENABLED, runElementEditDirective: editLib.runElementEditDirective, chatElementEditGateRef, elementDirectiveGenerationOwnerRef: ownerRef, oneLiveTabSuperseded: false, templateModeOn: false,
      slideStructure: { slides: Array.from({ length: 12 }, (_, i) => ({ slide_id: `u${i}` })) }, currentSlideIndexRef: slideState,
      chatElementEdit2ShownSlides: async () => { const result = await inventoryLib.fetchSlideInventory({ baseUrl: LAYOUT_ORIGIN, presentationId: PRESENTATION, fetchImpl: studioFetch }); return result.kind === 'ok' ? load('lib/chat-element-edit-2.ts').shownSlidesFromInventory(result.inventory) : null },
      layoutServiceApis: layoutApis, getChatEditViewer: editSave.getChatEditViewer, subscribeViewerSaveEvents: editSave.subscribeViewerSaveEvents,
      sendElementEditResult: result => { sent.push(plain(result)); return true }, setTimeout: clock.setTimeout, Promise,
    })
    chatStaleViewerApisRef.current = layoutApis
    if (!base) chatStaleViewerDepsRef.current = evalExpression(assignmentRight('app/builder/page.tsx', 'chatStaleViewerDepsRef.current', pageText), {
      CHAT_STALE_VIEWER_GUARD_ENABLED: guardLib.CHAT_STALE_VIEWER_GUARD_ENABLED, elementDirectiveGenerationOwnerRef: ownerRef, generationPanel: { getSnapshot: () => ({ isOpen: false }), hasActiveGenerations: false },
      ensureViewerMatchesServer: guardLib.ensureViewerMatchesServer, fetchSlideInventory: inventoryLib.fetchSlideInventory, getLayoutServiceUrl: () => LAYOUT_ORIGIN, fetch: studioFetch, composeViewerApiRef,
      parseStudioNativeSlideOrder: nativeOrder.parseStudioNativeSlideOrder, chatStaleViewerApisRef, deckChangedNotice, setTimeout: clock.setTimeout, Date: fixed.Date, Promise, Array, Boolean, Error, JSON, encodeURIComponent,
      elementDirectiveRunnerRef, sendElementDirectiveResult: result => { sent.push(plain(result)); return true }, elementEditDirectiveRunnerRef, sendElementEditResult: result => { sent.push(plain(result)); return true },
    })
    if (!base && guardLib.CHAT_STALE_VIEWER_GUARD_ENABLED && !guardRef.current) guardRef.current = guardLib.createChatStaleViewerGuard(() => chatStaleViewerDepsRef.current)
    composeViewerApiRef.current = viewerState.ready ? { composeGetState: () => sendCommand(iframe, 'composeGetState', {}, { timeoutMs: 5000 }) } : null
  }
  buildPage()

  const world = {
    onCommand: null, clock, sent, fetches: () => fetches, calls: () => calls, textLabs, toasts, consoleNotes, commandLog, editModeChanges, reloads, libs: { load, guard: guardLib, editSave, editWire, editLib }, viewerState, introSafetyRef,
    viewers: () => allViewers, viewer: () => viewer, ownerRef, slideState, layoutApis: () => layoutApis, guard: () => guardRef.current, server, recording,
    /** The stored deck now (live: Layout's own storage; offline: what the recording ended with). */
    deck: () => {
      if (live) { const shaped = shapeDeck(server.state.deck); deckLog.push(shaped); return plain(shaped) }
      const shaped = recording.deckLog[deckReads++]; assert.ok(shaped, 'replay: a recorded deck read'); deckLog.push(shaped); return plain(shaped)
    },
    deckLog: () => deckLog,
    actions: () => allViewers.flatMap(v => v.log.requests.map(item => item.action)),
    /** What Director does to the deck on the server, through Layout's own routes (the viewer is not told). `name`: addEnd | addMid | dup | del | undo | swap. */
    async change(name) {
      if (name === 'none') return // nothing changed on the server
      if (name === 'swap') { // Director's refine: slide 3 is swapped in place under a new id (the stored deck after Layout's compose-one route)
        if (live) { const slides = server.state.deck.slides; const was = slides[3]; slides[3] = { ...JSON.parse(JSON.stringify(was)), slide_id: 'S3x', content: { slide_title: 'Cost, refined' }, text_boxes: [], images: [] } }
        return
      }
      if (name === 'undo') { // a change, a delete, then the Undo chip: Layout restores the version from before the delete
        await world.change('addMid'); await world.change('del')
        if (live) { const version = server.state.versions.at(-1).version_id; serverCall('change', [{ method: 'POST', url: `/api/presentations/${PRESENTATION}/restore/${version}`, body: { create_backup: true } }]) } else serverCall('change', [{ method: 'POST', url: `/api/presentations/${PRESENTATION}/restore/v2`, body: { create_backup: true } }])
        return
      }
      const answer = serverCall('change', CHANGES[name]())
      assert.deepEqual(answer.statuses, [200], `Layout accepted ${name}`)
    },
    /** The index of a slide, by id, in the deck the server stores now. */
    indexOf: id => world.deck().slides.findIndex(slide => slide.slide_id === id),
    /** One element_directive, delivered the way the page's handler gets it (through the guard when it is on); resolves with the result frame, once the debounce of auto-save.js and more have passed. */
    async add(payload, { settleMs = 10_000 } = {}) {
      options.currentType = payload.element_type
      const before = sent.length
      const guard = guardRef.current
      if (guard) guard.add(plain(payload)); else elementDirectiveRunnerRef.current(plain(payload))
      for (let spent = 0; sent.length === before && spent < 240_000; spent += 50) await clock.advance(50)
      assert.ok(sent.length > before, 'a result was sent')
      await clock.advance(settleMs)
      return sent.at(-1)
    },
    /** One element_edit, as the page's handler gets it. */
    async edit(message, { settleMs = 10_000 } = {}) {
      const before = sent.length
      const ownerRecord = { sessionId: SESSION, isCurrent: () => true }
      const guard = guardRef.current
      if (guard) guard.edit(plain(message), ownerRecord); else elementEditDirectiveRunnerRef.current(plain(message), ownerRecord)
      for (let spent = 0; sent.length === before && spent < 240_000; spent += 50) await clock.advance(50)
      assert.ok(sent.length > before, 'a result was sent')
      await clock.advance(settleMs)
      return sent.at(-1)
    },
    /** Reload deck (the page's reload): the viewer in the iframe is retired and a new one loads the server's deck. */
    reload() {
      reloads.push(clock.now())
      retired.add(viewer)
      viewerState.ready = false; composeViewerApiRef.current = null; layoutApis = null; chatStaleViewerApisRef.current = null; 
      introSafetyRef.current = { ...introSafetyRef.current, viewerIsReady: false }
      clock.setTimeout(() => {
        viewer = makeViewer(); allViewers.push(viewer)
        viewerState.ready = true
        introSafetyRef.current = { ...introSafetyRef.current, viewerIsReady: true }
        handleIframeLoad({ currentTarget: iframe }) // the new frame: handleIframeLoad's own code (it ends the last status the old document posted, flag on)
        buildPage()
      }, reloadMs)
    },
    /** Waits (virtual time) until the reloaded viewer is up. */
    async settle(ms = 5_000) { await clock.advance(ms) },
    /** The Format panel's own command (Edit Mode, no chat), as the user sends it. */
    async manual(action, params) { const reply = sendCommand(iframe, action, params); await clock.drive(reply); await clock.advance(10_000); return reply },
    /** The tab goes hidden `ms` from now (virtual time): Layout's visibilitychange handler calls flushPendingChanges {keepalive: true} (auto-save.js). */
    hideTabSoon(ms) { clock.setTimeout(() => { viewer.context?.flushPendingChanges?.({ keepalive: true })?.catch?.(() => {}) }, ms) }, // a replayed viewer has no code to run: its recorded frames carry what the flush did
    /** The tab goes hidden: Layout's visibilitychange handler calls flushPendingChanges {keepalive: true} (auto-save.js), the page's own call. */
    async hideTab() {
      const flush = viewer.context?.flushPendingChanges?.({ keepalive: true })
      if (flush) { let settled = false; flush.then(() => { settled = true }, () => { settled = true }); for (let spent = 0; !settled && spent < 30_000; spent += 50) await clock.advance(50) }
      await clock.advance(1_000)
    },
    /** The same "is the viewer usable for an add" the hook asks: the lease, or null (the hook then says "not ready"). */
    lease: () => captureLease(),
    /** The viewer's frame loads again with the same document (a navigation that is not a deck reload): only handleIframeLoad runs. */
    frameLoad: () => handleIframeLoad({ currentTarget: iframe }),
    setSaveStatus,
    setPutStatus: value => { viewerPutStatus = value },
    buildPage,
    transcripts: () => allViewers.map(v => plain(v.log)),
  }
  return world
}

function js(text) { return ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText }
