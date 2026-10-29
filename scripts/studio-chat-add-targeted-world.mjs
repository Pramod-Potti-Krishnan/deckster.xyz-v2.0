// NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE (FRONTEND-2 B42): the world of scripts/test-studio-chat-add-targeted.mjs. One chat element ADD, from Director's element_directive frame to the stored deck, over REAL code at every step that can run under plain node:
//   STUDIO (this checkout, cut out by AST or loaded as it is):
//     - the page's runner (app/builder/page.tsx elementDirectiveRunnerRef.current) and handleApprovedTextLabsGenerate;
//     - lib/mdc-element-directive.ts (the form of the directive), hooks/use-textlabs-generation.ts (the REAL hook, run on plain hook bindings as scripts/test-studio-chat-element-refine.mjs does) and hooks/use-generation-panel.ts;
//     - components/presentation-viewer.tsx: sendCommand, handleSendElementCommand (INSERT-PERSIST's edit mode included) and handleSendTextBoxCommand;
//     - lib/studio-insert-persist.ts, lib/element-command-router.ts, lib/chat-edit-targeted.ts and lib/chat-add-targeted.ts.
//   LAYOUT (a layout-builder checkout at frontend2/layout-targeted-save, the merged tree of !262, run unchanged by scripts/studio-chat-element-edit-layout.mjs): the viewer page's postMessage bridge, edit-mode.js, auto-save.js, element-manager.js,
//     arrange-commands.js and (with Layout's flag) chat-targeted-save.js; Layout's own load path for the stored deck (scripts/studio-chat-edit-targeted-reload.mjs renderStoredDeck), and Layout's own server (server.py) answering every PUT the viewer makes.
// What is not real: Text Labs (a fetch stand-in that returns one element), the fake DOM the viewer scripts run in, the virtual clock, Date / Math.random / crypto.randomUUID (fixed, so a run is the same bytes every time and the recording replays),
//   and React's hook bindings (plain ones). The viewer's replies, frames and fetches are recordable; offline the proof replays the recording (replayViewer) and the server's answers are the recorded ones.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { createClock, createLayoutViewer, replayViewer } from './studio-chat-element-edit-layout.mjs'
import { applyWithLayoutServer, renderStoredDeck } from './studio-chat-edit-targeted-reload.mjs'

export const STUDIO_ORIGIN = 'https://studio.example'
export const LAYOUT_ORIGIN = 'https://layout.example'
export const PRESENTATION = 'pres-e2e'
export const SESSION = 's_e2e'
export const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))

// ---- AST helpers (the same cuts scripts/test-studio-chat-edit-targeted.mjs makes) ----
const parse = (rel, text) => ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
function findNode(ast, predicate) { let found = null; const visit = node => { if (found) return; if (predicate(node)) { found = node; return } ts.forEachChild(node, visit) }; visit(ast); return found }
const js = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
export const evalExpression = (expression, context) => vm.runInNewContext(js(`(${expression})`), context)
export function functionText(rel, name, text) {
  const ast = parse(rel, text)
  const found = findNode(ast, node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.ok(found, `${rel} defines ${name}`)
  return found.getText(ast)
}
export function callbackText(rel, callee, needle, text) {
  const ast = parse(rel, text)
  const call = findNode(ast, node => ts.isCallExpression(node) && node.expression.getText(ast) === callee && node.arguments[0]?.getText(ast).includes(needle))
  assert.ok(call, `${rel}: ${callee}(... ${needle} ...)`)
  return call.arguments[0].getText(ast)
}
export function assignmentRight(rel, left, text) {
  const ast = parse(rel, text)
  const node = findNode(ast, n => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && n.left.getText(ast) === left)
  assert.ok(node, `${rel}: ${left} = ...`)
  return node.right.getText(ast)
}
export function constText(rel, name, text) {
  const ast = parse(rel, text)
  const found = findNode(ast, node => ts.isVariableDeclaration(node) && node.name.getText(ast) === name)
  assert.ok(found?.initializer, `${rel} declares ${name}`)
  return found.initializer.getText(ast)
}

const FIXED_NOW = Date.UTC(2026, 9, 28, 21, 11, 0)
/** Fixed time and ids for the code the vm runs: `now()` follows the virtual clock, so a run is the same bytes every time. */
export function deterministic(clock) {
  class FixedDate extends Date {
    constructor(...args) { if (args.length === 0) super(FIXED_NOW + clock.now()); else super(...args) }
    static now() { return FIXED_NOW + clock.now() }
  }
  let uuid = 0, seed = 12345
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000 }
  const FixedMath = Object.create(Math); FixedMath.random = random
  return { Date: FixedDate, Math: FixedMath, randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` }
}

/** What the Text Labs stand-in answers for each chat-addable type: one element (the form Text Labs' response takes, as scripts/test-studio-chat-element-refine.mjs's stand-in has it). */
export const TEXT_LABS_ANSWERS = {
  TEXT_BOX: { component_type: 'TEXT_BOX', html: '<p>Fresh produce turnover is the biggest lever this quarter.</p>' },
  IMAGE: { component_type: 'IMAGE', html: '<img src="https://img.example/chat-add.png" alt="">', image_url: 'https://img.example/chat-add.png' },
  CHART: { component_type: 'CHART', html: '<div>Synthetic bar chart</div>', content: '<div>Synthetic bar chart</div>' },
  METRICS: { component_type: 'METRICS', html: '<div class="metric">42%</div>' },
  SHAPE: { component_type: 'SHAPE', html: '<div class="shape">rectangle</div>' },
  ICON_LABEL: { component_type: 'ICON_LABEL', html: '<div class="icon-label">Growth</div>' },
  TABLE: { component_type: 'TABLE', html: '<table><tr><td>North</td><td>12</td></tr></table>' },
}

/**
 * One chat add, end to end. `options`:
 *   root, layoutDir (null: replay `transcript`), env (the process.env of the Studio libs), overrides ({file: text}: mutants), layout ('on' | 'off'), stored (the stored deck), server ({deck, statuses, summaries}: Layout's own server answers the PUTs),
 *   putDelayMs / putStatus (a stand-in answer when there is no server), layoutScript (a mutant of chat-targeted-save.js), transcript (offline), beforeRun (hook to change the viewer first), read (file reader), slideIndex (the slide on screen), applyServer, python.
 */
export async function createAddWorld(options) {
  const { root, layoutDir, env, overrides = {}, layout = 'on', stored, server = null, putDelayMs = 0, putStatus = 200, layoutScript = null, transcript = null, slideIndex = 1, python = null } = options
  const read = options.read ?? (rel => fs.readFileSync(path.join(root, rel), 'utf8'))
  const clock = createClock()
  const fixed = deterministic(clock)
  const listeners = new Set()
  const fetches = []
  const textLabs = []
  const consoleNotes = []
  const studioWindow = { addEventListener(type, fn) { if (type === 'message') listeners.add(fn) }, removeEventListener(type, fn) { if (type === 'message') listeners.delete(fn) }, dispatchEvent() {} }
  let viewer = null
  const viewerHandle = { postMessage(data, targetOrigin) { assert.equal(targetOrigin, LAYOUT_ORIGIN); const request = plain(data); queueMicrotask(() => { viewer.deliver(request, STUDIO_ORIGIN).catch(error => { throw error }) }) } }
  const toStudio = data => queueMicrotask(() => { for (const fn of [...listeners]) fn({ source: viewerHandle, origin: LAYOUT_ORIGIN, data: plain(data) }) })
  const fakeResponse = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body })
  if (!transcript) {
    viewer = createLayoutViewer({ layoutDir, studioOrigin: STUDIO_ORIGIN, parent: { postMessage: toStudio }, clock, presentationId: PRESENTATION, arrange: true, targeted: layout === 'on',
      fetchImpl: async (url, init) => {
        const body = init?.body ? JSON.parse(init.body) : null
        fetches.push({ at: clock.now(), url: String(url), method: init?.method ?? 'GET', body })
        if (server) { // Layout's own server answers (server.py in process), against the deck it stores
          const [answer] = applyWithLayoutServer(python, layoutDir, [{ deck: server.deck, requests: [{ method: init?.method ?? 'GET', url: String(url), body }] }])
          server.deck = answer.deck; server.statuses.push(answer.statuses[0]); server.summaries.push(...answer.summaries)
          return fakeResponse(answer.statuses[0], answer.bodies[0])
        }
        const response = fakeResponse(putStatus, putStatus === 200 ? { success: true } : { detail: { code: 'SYNTHETIC', message: 'synthetic save refusal' } })
        return putDelayMs ? new Promise(resolve => clock.setTimeout(() => resolve(response), putDelayMs)) : response
      } })
    viewer.context.Date = fixed.Date; viewer.context.Math = fixed.Math // Layout names new elements and saves from Date.now() / Math.random(): fixed, so the recording replays
    if (layoutScript) vm.runInContext(layoutScript(fs.readFileSync(path.join(layoutDir, 'src/utils/chat-targeted-save.js'), 'utf8')), viewer.context)
    renderStoredDeck(viewer, stored, layoutDir) // Layout's own load path: the title boxes of every slide are layout text drawn by direct-element-creator.js
    if (options.beforeRun) options.beforeRun(viewer)
  } else {
    viewer = replayViewer({ transcript, parent: { postMessage: toStudio }, clock })
  }
  clock.setGuard?.(() => { if (viewer.log.divergence) throw viewer.log.divergence })

  // ---- Studio libs in a vm ----
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const text = overrides[file] ?? read(file)
    const out = ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
    const sandbox = { module, exports: module.exports, process: { env }, console: { log() {}, info: (...args) => consoleNotes.push(args.map(String).join(' ')), debug() {}, warn() {}, error() {} },
      URL, Promise, Error, TypeError, DOMException, AbortController, JSON, Math: fixed.Math, Set, Map, Object, Array, Number, String, Boolean, RegExp, Symbol, parseFloat, isFinite, Date: fixed.Date, FormData, Blob,
      crypto: { randomUUID: fixed.randomUUID }, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, WebSocket: () => { throw new Error('no sockets') },
      fetch: async (url, init) => {
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
  // plain hook bindings (scripts/test-studio-chat-element-refine.mjs generateThrough)
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

  // ---- Studio's command path, cut out of components/presentation-viewer.tsx ----
  const messaging = load('lib/layout-viewer-messaging.ts')
  const router = load('lib/element-command-router.ts')
  const persist = load('lib/studio-insert-persist.ts')
  const viewerTsx = read('components/presentation-viewer.tsx')
  const bridgeJs = js(`${functionText('components/presentation-viewer.tsx', 'createViewerRequestId', viewerTsx)}\n${functionText('components/presentation-viewer.tsx', 'sendCommand', viewerTsx)}\n;({ sendCommand })`)
  const iframe = { src: `${LAYOUT_ORIGIN}/p/${PRESENTATION}`, contentWindow: viewerHandle }
  const iframeRef = { current: iframe }
  const { sendCommand } = vm.runInNewContext(bridgeJs, {
    window: studioWindow, Promise, Error, Date: fixed.Date, Math: fixed.Math, JSON, Object, Array, queueMicrotask, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    crypto: { randomUUID: (() => { let n = 0; return () => `studio-request-${++n}` })() }, getLayoutServiceUrl: () => LAYOUT_ORIGIN, VIEWER_ORIGIN: LAYOUT_ORIGIN,
    getLayoutViewerOrigin: messaging.getLayoutViewerOrigin, isTrustedLayoutViewerMessage: messaging.isTrustedLayoutViewerMessage,
    isMatchingSlideComposeCommandResponse: () => { throw new Error('not a compose command') }, scTrace() {}, isSlideComposerTraceEnabled: () => false, reportLayoutCommandAck() {},
  })
  const timeoutConstants = {} // every `const X_TIMEOUT_MS = <number>` of the viewer, in order (the table below names some of them)
  for (const statement of parse('components/presentation-viewer.tsx', viewerTsx).statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
    const name = declaration.name.getText(), value = declaration.initializer?.getText() ?? ''
    if (/_TIMEOUT_MS$/.test(name) && /^[\d_]+$/.test(value)) timeoutConstants[name] = Number(value.replace(/_/g, ''))
  }
  const timeouts = evalExpression(constText('components/presentation-viewer.tsx', 'LAYOUT_ELEMENT_COMMAND_TIMEOUTS', viewerTsx), timeoutConstants)
  const editModeChanges = []
  const sendElementCommandText = callbackText('components/presentation-viewer.tsx', 'useCallback', '// Direct Layout Service command - send to iframe', viewerTsx)
  const handleSendElementCommand = evalExpression(sendElementCommandText, {
    iframeRef, getCommandType: router.getCommandType, studioShell: true, viewerInteractionIntentRef: { current: 0 }, STUDIO_SLIDE_OPS_VIA_VIEWER_ENABLED: false, isSlideOpViewerAction: () => false, debugLog() {}, console: { warn() {}, error() {}, log() {} },
    shouldEnsureEditModeForPersistence: persist.shouldEnsureEditModeForPersistence, STUDIO_INSERT_PERSIST_ENABLED: persist.STUDIO_INSERT_PERSIST_ENABLED, ensureViewerTracksEdits: persist.ensureViewerTracksEdits, sendCommand,
    setIsEditMode: value => editModeChanges.push(value), onEditModeChangeRef: { current: value => editModeChanges.push(`notify:${value}`) },
    LAYOUT_ELEMENT_COMMAND_TIMEOUTS: timeouts, DEFAULT_LAYOUT_COMMAND_TIMEOUT_MS: 5000, presentationId: PRESENTATION, currentSlide: slideIndex + 1, reportLayoutCommandAck() {},
  })
  const handleSendTextBoxCommand = evalExpression(callbackText('components/presentation-viewer.tsx', 'useCallback', "if (studioShell) viewerInteractionIntentRef.current += 1\n    return sendCommand(iframeRef.current, action, params)", viewerTsx), {
    iframeRef, studioShell: true, viewerInteractionIntentRef: { current: 0 }, sendCommand,
  })
  const commandLog = []
  const world = { onCommand: null }
  const sendElementCommand = (action, params) => { commandLog.push(action); world.onCommand?.(action); return handleSendElementCommand(action, params) }
  const sendTextBoxCommand = (action, params) => { commandLog.push(action); world.onCommand?.(action); return handleSendTextBoxCommand(action, params) }
  const slideState = { current: slideIndex }
  // the lease Studio hands a generation (components/presentation-viewer.tsx captureStudioElementGeneration): every command checks it is current before and after
  const lease = { isCurrent: () => options.leaseCurrent?.() ?? true, sendElementCommand: async (action, params) => { if (!lease.isCurrent()) throw new Error('The presentation viewer changed during element generation.'); const result = await sendElementCommand(action, params); if (!lease.isCurrent()) throw new Error('The presentation viewer changed during element generation. Check the original slide before retrying.'); return result } }
  const layoutServiceApis = { sendElementCommand, sendTextBoxCommand, goToSlide: async index => { slideState.current = index }, captureStudioElementGeneration: () => lease }

  // ---- the REAL hooks ----
  const { useTextLabsGeneration } = load('hooks/use-textlabs-generation.ts')
  const { useGenerationPanel } = load('hooks/use-generation-panel.ts')
  const panelScope = scope(), genScope = scope()
  const panel = render(panelScope, useGenerationPanel)
  const toasts = []
  const themeSync = { status: 'applied', requestId: 'synthetic-theme-request', presentationId: PRESENTATION, themeFingerprint: 'synthetic-theme', error: null }
  const hookParams = { generationPanel: panel, blankElements: { getElement: () => undefined, updatePosition() {}, setStatus() {}, updateGenerationMetadata() {}, removeElement() {}, addElement() {}, trackElement() {} },
    textLabsSession: { ensureSession: async () => 'synthetic-textlabs-session' }, layoutServiceApis, presentationId: PRESENTATION, currentSlideIndex: slideIndex, getCurrentSlideIndex: () => slideState.current,
    researchCapabilities: { web: false, uploadedDocuments: false, knowledgeGraph: false }, getThemeSyncSnapshot: () => ({ ...themeSync }),
    ensureThemeReady: async () => ({ ready: true, source: 'director', sync: { ...themeSync } }), toast: value => toasts.push(plain(value)) }
  const driver = render(genScope, () => useTextLabsGeneration(hookParams))

  // ---- the page's runner and its handleApprovedTextLabsGenerate, cut out of app/builder/page.tsx ----
  const pageText = read('app/builder/page.tsx')
  const sent = []
  const ownerRef = { current: { sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: PRESENTATION, epoch: 0 } }
  const mdc = load('lib/mdc-element-directive.ts')
  const handleApprovedTextLabsGenerate = evalExpression(callbackText('app/builder/page.tsx', 'useCallback', 'try { return await handleTextLabsGenerate(formData, submitIntent, invocation) }', pageText), {
    layoutServiceApis, generationPanel: { setError() {} }, toast: value => toasts.push(plain(value)), effectivePresentationId: PRESENTATION, saveSessionOnFirstAction() {}, studioShell: true,
    studioPartialLocalWorkRef: { current: new Set() }, studioPartialMountedRef: { current: true }, setStudioPartialRevision() {}, handleTextLabsGenerate: driver.handleGenerate,
  })
  const runnerText = assignmentRight('app/builder/page.tsx', 'elementDirectiveRunnerRef.current', pageText)
  assert.ok([2, 3].includes(runnerText.split("await import('@/lib/mdc-element-directive')").length), 'the runner imports lib/mdc-element-directive once, dynamically (twice with MDC element fields: its one marked page line)') // LATER-CHANGES: registry read (MDC-ELEMENT-FIELDS): the page runner calls applyDirectiveElementFields on the same module, so the import appears twice with that change
  const runner = evalExpression(runnerText.replaceAll("await import('@/lib/mdc-element-directive')", '__mdc'), { // the one substitution: a dynamic import cannot run in a vm, the module is the same one // LATER-CHANGES: registry read (MDC-ELEMENT-FIELDS): every occurrence is the same module (replaceAll)
    __mdc: mdc, elementDirectiveGenerationOwnerRef: ownerRef, sendElementDirectiveResult: result => { sent.push(plain(result)); return true },
    slideStructure: { slides: [{}, {}, {}] }, generationPanel: { getSnapshot: () => ({ isOpen: false }), hasActiveGenerations: false }, currentSlideIndexRef: slideState, layoutServiceApis,
    handleApprovedTextLabsGenerate, toast: value => toasts.push(plain(value)), setTimeout: clock.setTimeout, Promise,
  })

  Object.assign(world, {
    clock, viewer, sent, fetches: () => fetches, textLabs, toasts, consoleNotes, commandLog, editModeChanges, libs: { load }, layoutServiceApis,
    actions: () => viewer.log.requests.map(item => item.action),
    /** What only the live viewer can say (recorded with the scenario): whether Layout's targeted-save scope is still open. null on a viewer that does not have the script. */
    probe: () => ({ scopeOpen: viewer.context?.LayoutChatTargetedSave?.isOpen ? viewer.context.LayoutChatTargetedSave.isOpen() : null }),
    /** The Element panel's own generate (no chat invocation): handleApprovedTextLabsGenerate as the panel's Generate button calls it. */
    async manualGenerate(formData) {
      options.currentType = formData.componentType
      const run = handleApprovedTextLabsGenerate(formData, 'generate')
      let settled = false, outcome
      run.then(value => { settled = true; outcome = value }, error => { settled = true; outcome = { status: 'failed', error: String(error?.message ?? error) } })
      for (let spent = 0; !settled && spent < 120_000; spent += 50) await clock.advance(50)
      assert.ok(settled, 'the manual generate ended')
      return outcome
    },
    /** One element_directive, delivered the way the runner gets it; resolves with the element_directive_result the runner sent, once the debounce of auto-save.js (2.5 s) and more have passed. */
    async directive(payload, { settleMs = 10_000 } = {}) {
      options.currentType = payload.element_type
      const before = sent.length
      runner(plain(payload))
      for (let spent = 0; sent.length === before && spent < 120_000; spent += 50) await clock.advance(50)
      assert.ok(sent.length > before, 'the runner sent a result')
      await clock.advance(settleMs) // past auto-save.js's debounce: a scheduled whole-deck save would have gone out by now
      return sent.at(-1)
    },
    /** The Format panel's own command (Edit Mode, no chat), as the user sends it. */
    async manual(action, params) { const reply = sendCommand(iframe, action, params); await clock.drive(reply); await clock.advance(10_000); return reply },
  })
  return world
}
