// PASS2-J3 P1 (frontend-2): choosing an Add Element card must not leave an empty placeholder on the slide.
// Flag NEXT_PUBLIC_STUDIO_ELEMENT_PLACEHOLDER_FIX (exact "true", Studio shell only), default off.
//
// Loads the REAL hooks/use-generation-panel.ts, hooks/use-blank-elements.ts and hooks/use-textlabs-generation.ts (and the real lib/*) into a
// small React-hook runtime with a virtual clock. The Layout viewer is a fake that behaves like the real one (layout-builder origin/uat) where it
// matters here: it NAMES A NEW TEXT BOX ITSELF (insertTextBox ignores `elementId`), refuses a command on an element that is not there (Studio's
// bridge rejects it), refuses a slide-context read for a target that is not on the slide, tells the Builder which element a delete removed
// (the Builder's own close-the-panel rule is applied), and "saves" every mutation (so a reload shows what was saved). Text Labs HTTP is a fake.
// Offline: no sockets, no keys, no live or paid calls.
//
// Studio dev P0 (PASS2-J3 round 4): #388 as merged failed every Generate because Layout answered the placeholder under its own name and
// #388 refused any other name; its fake kept the `elementId` Studio sent. The checks below reproduce that failure on #388's code
// and prove the fix-forward (the deferral now aims the Generate's commands at the element Layout really holds).
//
// Before (flag off, or the base): choosing a card inserts the placeholder at once, cancelling leaves it, and the saved deck keeps it.
// After (flag on): choosing a card sends nothing to Layout; Generate inserts the placeholder just before it first needs it and replaces it
// with the generated element; a Generate that ends without the generated element takes the empty placeholder out again.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'

for (const name of Object.keys(process.env)) if (/KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD/i.test(name)) delete process.env[name]
const denied = () => { throw new Error('Offline harness forbids network') }
net.connect = net.createConnection = net.Socket.prototype.connect = denied
http.request = http.get = https.request = https.get = denied
globalThis.fetch = denied

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// The dev branch this fix was cut from: flag off must behave exactly as this.
const BASE = 'b0c5a4aa35ef6b00dc503923fc2b96288f56a99e'
const FLAG = 'NEXT_PUBLIC_STUDIO_ELEMENT_PLACEHOLDER_FIX'
const gitEnv = { ...process.env }
delete gitEnv.GIT_DIR
delete gitEnv.GIT_WORK_TREE
let baseAvailable = true
try { execFileSync('git', ['cat-file', '-e', `${BASE}^{commit}`], { cwd: root, env: gitEnv, stdio: 'ignore' }) } catch { baseAvailable = false }
const sourceCache = new Map()
const compileCache = new Map()
const read = (file, ref) => {
  const key = `${ref ?? 'working'}:${file}`
  if (!sourceCache.has(key)) {
    sourceCache.set(key, ref
      ? execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      : fs.readFileSync(path.join(root, file), 'utf8'))
  }
  return sourceCache.get(key)
}
const exists = (file, ref) => { try { read(file, ref); return true } catch { return false } }
const compile = source => {
  if (!compileCache.has(source)) {
    compileCache.set(source, ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText)
  }
  return compileCache.get(source)
}

const SLOW = 5000
const START = 1_800_000_000_000

function createRig({
  ref, flag, studio = true, type = 'CHART', backend = 'ok', elements = 1, scenario = 'none', theme = 'ready', saved = [], refine = false, immediate = false,
} = {}) {
  // ---- virtual clock ----
  let now = 0
  let timerSeq = 0
  let uuid = 0
  const timers = new Map()
  const setTimer = (fn, ms = 0) => { const id = ++timerSeq; timers.set(id, { at: now + (ms || 0), id, fn }); return id }
  const clearTimer = id => { timers.delete(id) }
  const sleep = ms => new Promise(resolve => setTimer(resolve, ms))
  const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }
  async function advance(ms) {
    await flush()
    const end = now + ms
    for (;;) {
      let due = null
      for (const timer of timers.values()) {
        if (timer.at <= end && (!due || timer.at < due.at || (timer.at === due.at && timer.id < due.id))) due = timer
      }
      if (!due) break
      timers.delete(due.id)
      now = Math.max(now, due.at)
      due.fn()
      await flush()
    }
    now = end
    await flush()
  }
  class ClockDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(START + now) }
    static now() { return START + now }
  }

  // ---- minimal React hook runtime (same shape as test-element-failure-panel-ownership.mjs) ----
  const cells = []
  let cursor = 0
  let pendingEffects = []
  let renderScheduled = false
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const schedule = () => { if (renderScheduled) return; renderScheduled = true; setTimer(() => { renderScheduled = false; render() }, 0) }
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++
      if (!(index in cells)) cells[index] = { value: typeof initial === 'function' ? initial() : initial }
      const cell = cells[index]
      cell.set ??= next => {
        const value = typeof next === 'function' ? next(cell.value) : next
        if (Object.is(value, cell.value)) return
        cell.value = value
        schedule()
      }
      return [cell.value, cell.set]
    },
    useRef(initial) { const index = cursor++; return cells[index] ??= { current: initial } },
    useCallback(fn, deps) { const index = cursor++; const previous = cells[index]; if (previous && sameDeps(previous.deps, deps)) return previous.fn; cells[index] = { fn, deps }; return fn },
    useMemo(fn, deps) { const index = cursor++; const previous = cells[index]; if (previous && sameDeps(previous.deps, deps)) return previous.value; const value = fn(); cells[index] = { value, deps }; return value },
    useEffect(fn, deps) {
      const index = cursor++
      const previous = cells[index]
      if (!previous || !deps || !sameDeps(previous.deps, deps)) {
        const entry = previous || { deps, cleanup: undefined }
        cells[index] = entry
        pendingEffects.push(() => { entry.cleanup?.(); entry.cleanup = fn(); entry.deps = deps })
      }
    },
  }

  // ---- module loader (real sources, optionally from a git ref) ----
  const env = {
    NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.example.test',
    NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false',
    NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED: 'true',
  }
  if (flag !== undefined) env[FLAG] = flag
  if (immediate) env.NEXT_PUBLIC_ELEMENT_FAILURE_IMMEDIATE_FEEDBACK_ENABLED = 'true'   // Studio dev runs with the immediate-failure-feedback flag too
  const requests = []
  const toasts = []
  const visible = []
  // honourElementId: the #388 stand-in's assumption (Layout keeps the `elementId` Studio sends). The real viewer does NOT (see below).
  const state = { backend, scenario, elements, theme, deleteRefusals: 0, insertRefusals: 0, honourElementId: false, leaseCurrent: true, presentationId: 'offline-deck', themeRequestId: 'r' }
  const fakeConsole = { log() {}, info() {}, warn() {}, error() {} }
  const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) })
  const component = () => ({
    component_type: type, html: '<div>Offline generated</div>', image_url: 'https://offline.invalid/i.svg', content: '<div>Offline generated</div>',
    grid_position: { start_col: 5, start_row: 4, position_width: 10, position_height: 6 },
  })
  const fakeFetch = async (url, init = {}) => {
    assert.ok(String(url).startsWith('https://textlabs.example.test/'), 'only the fake Text Labs host is reachable')
    requests.push({ at: now, url: String(url) })
    const signal = init.signal
    const abortable = promise => new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      promise.then(resolve, reject)
    })
    requests[requests.length - 1].body = typeof init.body === 'string' ? init.body : null
    await abortable(sleep(SLOW))
    if (state.backend === '500') return respond(500, { error: 'Upstream exploded', error_code: 'UPSTREAM_500', retryable: false })
    return respond(200, { success: true, elements: Array.from({ length: state.elements }, component) })
  }
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }
    cache.set(file, mod)
    const requireModule = id => {
      if (id === 'react') return hooks
      if (id === 'react/jsx-runtime') return jsxRuntime
      const relative = id.startsWith('@/') ? id.slice(2) : id.startsWith('.') ? path.normalize(path.join(path.dirname(file), id)) : null
      if (!relative) return new Proxy({}, { get: () => () => null })
      const resolved = ['.ts', '.tsx', '/index.ts', '/index.tsx'].map(ext => relative + ext).find(candidate => exists(candidate, ref))
      assert.ok(resolved, `source dependency ${relative}`)
      return load(resolved)
    }
    const run = new Function('module', 'exports', 'require', 'process', 'setTimeout', 'clearTimeout', 'Date', 'fetch', 'console', 'crypto', compile(read(file, ref)))
    run(mod, mod.exports, requireModule, { env }, setTimer, clearTimer, ClockDate, fakeFetch, fakeConsole, { randomUUID: () => `uuid-${++uuid}` })
    return mod.exports
  }

  // ---- fake Layout viewer, mirroring the REAL one (layout-builder origin/uat bda4578) where Add Element touches it ----
  // * insertTextBox names the new text box itself: ElementManager.insertTextBox uses `config.id || generateId('textbox')` and IGNORES the
  //   `elementId` Studio sends (src/utils/element-manager.js:6374; the bridge passes params straight through, viewer/presentation-viewer.html:3997-4004).
  //   With an `id` it keeps that id and answers an existing one with `alreadyExists` (element-manager.js:6385-6389).
  // * A command on an element that is not there answers {success:false, error:'Element not found…'} (getElementGeometry 8069-8071,
  //   setElementGenerationState 1087-1091, deleteElement 8157-8166); getSlideGenerationContext refuses a targetElementId that is not on
  //   the slide (8036-8043). Studio's bridge (components/presentation-viewer.tsx sendCommand) REJECTS every {success:false} answer.
  // * deleteElement tells the Builder which element vanished (emitElementDeletedEvent, 8193): app/builder/page.tsx onElementDeleted then
  //   closes the element panel when that element is the panel's and no Generate is running. Emulated below with the page's own predicate.
  // * Layout autosaves every mutation, so a reload shows what was saved.
  const live = new Map()          // id -> { blank, themeVariantId }
  const savedDeck = new Set(saved) // what a reload would show
  for (const id of saved) live.set(id, { blank: id.startsWith('blank_') })
  const log = []                  // every command as Layout received it: { at, action, id, target, blank, generating, params, assigned, outcome }
  const deletedEvents = []        // elementDeleted events the Builder received, and whether they closed the panel
  let inserted = 0
  let layoutSeq = 0
  const persist = () => { savedDeck.clear(); for (const id of live.keys()) savedDeck.add(id) }
  const refuse = error => { throw new Error(error) }   // presentation-viewer.tsx sendCommand: reject(new Error(event.data.error || 'Command failed'))
  const emitElementDeleted = id => setTimer(() => {
    const panel = latest.panel
    const deletedActiveElement = panel.editElementId === id || panel.refineContext?.elementId === id || panel.blankElementId === id
    const closes = deletedActiveElement && !panel.isGenerating
    deletedEvents.push({ at: now, id, closes })
    if (closes) panel.closePanel()
  }, 0)
  const layoutAnswer = (entry, action, args) => {
    if (action === 'getElementGeometry') {
      if (!live.has(args.elementId)) refuse('Element not found')
      return { success: true, action, elementId: args.elementId, position: { gridRow: '4/10', gridColumn: '5/15' }, z_index: 100,
        theme_variant_id: live.get(args.elementId).themeVariantId ?? null, theme_bindings: {} }
    }
    if (action === 'getElementGenerationMetadata') {
      if (!live.has(args.elementId)) refuse(`Element not found: ${args.elementId}`)
      return { success: true, componentType: type, themeVariantSource: 'manual' }
    }
    if (action === 'getSlideGenerationContext') {
      const target = args.targetElementId || null
      if (target && !live.has(target)) refuse(`Target element ${target} was not found on slide ${args.slideIndex ?? 0}`)
      return { success: true, action, slide_index: args.slideIndex ?? 0, slide_title: null, slide_summary: null, target_element_id: target,
        elements: [...live.keys()].sort().map(id => ({ element_id: id, renderer_type: 'textbox', component_type: null, position: null,
          summary: live.get(id).blank ? '' : 'Offline generated', properties: {}, is_target: id === target })), truncated: false }
    }
    if (action === 'getElementMutationReceipt') return { status: 'unknown' }
    if (action === 'setElementGenerationState') {
      if (!live.has(args.elementId)) refuse(`Element not found: ${args.elementId}`)
      return { success: true, action, elementId: args.elementId, generating: args.generating === true }
    }
    if (action.startsWith('insert') || action.startsWith('upsert')) {
      if (entry.blank && state.insertRefusals > 0) { state.insertRefusals--; refuse('Supplied Layout refusal') }
      if (!entry.blank) {
        inserted++
        if (state.scenario === 'partial2' && inserted === 2) refuse('Offline insertion failed')
      }
      let id
      if (entry.blank) {
        if (args.id && live.has(args.id)) return { success: true, action, elementId: args.id, alreadyExists: true }
        id = args.id || (state.honourElementId ? args.elementId : `textbox-layout-${++layoutSeq}`)
      } else id = `generated-${inserted}`
      entry.assigned = id
      const themeVariantId = entry.blank ? `variant-${type.toLowerCase()}` : null
      live.set(id, { blank: Boolean(entry.blank), themeVariantId })
      persist()
      return { success: true, action, elementId: id, position: { gridRow: args.gridRow, gridColumn: args.gridColumn },
        ...(entry.blank ? { component_type: args.componentType ?? null, theme_variant_id: themeVariantId, theme_bindings: {} } : {}) }
    }
    if (action === 'deleteElement') {
      if (state.deleteRefusals > 0 && live.get(args.elementId)?.blank) { state.deleteRefusals--; refuse('Supplied Layout delete refusal') }
      if (!live.has(args.elementId)) refuse('Element not found')
      const wasBlank = live.get(args.elementId).blank
      live.delete(args.elementId)
      persist()
      emitElementDeleted(args.elementId)
      if (wasBlank && state.scenario === 'themeChangeAfterReplace') state.themeRequestId = 'r-changed'  // the deck theme changes mid-Generate
      return { success: true, action }
    }
    return { success: true, action, elementId: args.elementId }
  }
  const sendElementCommand = async (action, args = {}) => {
    const entry = { at: now, action, id: args.elementId ?? null }
    if (args.targetElementId) entry.target = args.targetElementId
    if (action === 'insertTextBox' && typeof args.content === 'string' && args.content.includes('data-blank-element=')) entry.blank = true
    if (action === 'setElementGenerationState') entry.generating = args.generating
    entry.params = JSON.stringify(args)
    log.push(entry)
    try {
      const answer = layoutAnswer(entry, action, args)
      entry.outcome = 'ok'
      return answer
    } catch (error) {
      entry.outcome = String(error.message)
      throw error
    }
  }
  const layoutServiceApis = {
    sendElementCommand,
    captureStudioElementGeneration: () => ({ sendElementCommand: (...a) => sendElementCommand(...a), isCurrent: () => state.leaseCurrent }),
  }

  const panelModule = load('hooks/use-generation-panel.ts')
  const blankModule = load('hooks/use-blank-elements.ts')
  const generationModule = load('hooks/use-textlabs-generation.ts')
  let latest = null
  let lastPanelError = null
  const params = {
    textLabsSession: { ensureSession: async () => 'offline-session' }, currentSlideIndex: 0, getCurrentSlideIndex: () => 0,
    deckContext: null, researchSessionId: null, researchStoreName: null, researchUserId: null, researchCapabilities: {},
    getThemeSyncSnapshot: () => ({ status: 'applied', presentationId: 'offline-deck', requestId: state.themeRequestId, themeFingerprint: 'f' }),
    ensureThemeReady: async () => (state.theme === 'ready'
      ? { ready: true, source: 'neutral' }
      : { ready: false, code: 'failed', error: 'The selected deck theme could not be prepared. Reapply it, then generate again.' }),
    toast: value => { toasts.push({ at: now, ...value }); visible.push({ at: now, via: 'toast', text: value.description }) },
  }
  function Component() {
    const panel = panelModule.useGenerationPanel()
    const blank = blankModule.useBlankElements()
    // app/builder/page.tsx tracks the panel's placeholder for the element forms.
    const trackRef = hooks.useRef(blank.trackElement)
    trackRef.current = blank.trackElement
    hooks.useEffect(() => { trackRef.current(panel.blankElementId) }, [panel.blankElementId])
    const generation = generationModule.useTextLabsGeneration({
      ...params, layoutServiceApis, blankElements: blank, presentationId: state.presentationId, generationPanel: panel,
    })
    latest = { panel, generation, blank }
    return null
  }
  function render() {
    cursor = 0
    pendingEffects = []
    Component()
    const effects = pendingEffects
    pendingEffects = []
    for (const effect of effects) effect()
    const { panel } = latest
    if (panel.error && panel.isOpen && panel.error !== lastPanelError) visible.push({ at: now, via: 'panel', text: panel.error })
    lastPanelError = panel.error && panel.isOpen ? panel.error : null
  }
  render()
  if (refine) {
    live.set('original-1', { blank: false })
    persist()
    latest.panel.openPanelForRefine(type, {
      elementId: 'original-1', elementType: type, slideIndex: 0, research: {}, existingElement: { component_type: type, content: '<div>orig</div>' },
      gridPosition: { start_col: 5, start_row: 4, position_width: 10, position_height: 6 }, themeVariantId: null, themeBindings: null,
    })
    renderScheduled = false
    timers.clear()
    render()
  }

  const rig = {
    log, requests, toasts, visible, live, advance, sleep, state, deletedEvents,
    get now() { return now },
    get saved() { return [...savedDeck].sort() },
    get panel() { return latest.panel },
    get blank() { return latest.blank },
    // Handlers are captured the way a UI event handler captures them (the render's closure).
    open: typeName => latest.generation.handleOpenPanel(typeName),
    generate: (over = {}, intent = 'generate', invocation) => latest.generation.handleGenerate(rig.form(over), intent, invocation),
    rerender: async () => { schedule(); await advance(0) },
    form: (over = {}) => ({
      componentType: type, prompt: 'Offline authored prompt', count: 1, useDeckTheme: false, structure: 'SECTIONS', textboxConfig: {},
      imageConfig: { operation: 'generate' }, chartConfig: { requested_data_source_mode: 'illustrative' }, shapeConfig: { shape_type: null },
      infographicConfig: {}, iconLabelConfig: {}, metricsConfig: {}, tableConfig: {}, diagramConfig: {}, codeDisplayConfig: {}, kanbanConfig: {},
      ganttConfig: {}, chevronConfig: {}, ideaBoardConfig: {}, cloudArchitectureConfig: {}, logicalArchitectureConfig: {}, dataArchitectureConfig: {},
      positionConfig: { start_col: 5, start_row: 4, position_width: 10, position_height: 6, auto_position: false }, ...over,
    }),
  }
  rig.tracked = id => latest.blank.isBlankElement(id)
  return rig
}

const names = rig => rig.log.map(c => `${c.action}${c.blank ? '[blank]' : ''}${c.id ? `(${c.id})` : ''}${c.generating === undefined ? '' : `:${c.generating}`}`)
const blankInserts = rig => rig.log.filter(c => c.action === 'insertTextBox' && c.blank)
const generatedInserts = rig => rig.log.filter(c => c.action.startsWith('insert') && !c.blank)
const liveIds = rig => [...rig.live.keys()].sort()
const blankIdsOnSlide = rig => [...rig.live.entries()].filter(([, v]) => v.blank).map(([id]) => id)
const trace = rig => JSON.stringify({
  log: rig.log, requests: rig.requests, toasts: rig.toasts, visible: rig.visible, live: liveIds(rig), saved: rig.saved, deleted: rig.deletedEvents,
  panel: { isOpen: rig.panel.isOpen, blank: rig.panel.blankElementId, mode: rig.panel.mode, busy: rig.panel.isGenerating, error: rig.panel.error, type: rig.panel.elementType },
})

async function chooseThenGenerate(options, { generateOver, afterOpen } = {}) {
  const rig = createRig(options)
  await rig.advance(0)
  await rig.open(options.type ?? 'CHART')
  await rig.advance(0)
  await afterOpen?.(rig)
  const pending = rig.generate(generateOver)
  let result = null
  const done = Promise.resolve(pending).then(value => { result = value })
  await rig.advance(SLOW * 3)
  await done
  await rig.advance(0)
  return { rig, result }
}

const TYPES = ['TEXT_BOX', 'IMAGE', 'CHART', 'METRICS', 'TABLE', 'DIAGRAM', 'INFOGRAPHIC', 'ICON_LABEL', 'SHAPE']
const ON = { flag: 'true' }
const results = []
const failedChecks = []
const check = async (name, fn) => {
  // A promise that never settles (a regression that stalls Generate) is a failure, not a hang.
  let watchdog
  const stalled = new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error('stalled: a promise never settled')), 20000) })
  try { await Promise.race([fn(), stalled]); results.push(name) } catch (error) { failedChecks.push(`[${name}] ${String(error?.message ?? error).split('\n')[0]}`) } finally { clearTimeout(watchdog) }
}
const unhandled = []
process.on('unhandledRejection', reason => unhandled.push(String(reason?.message ?? reason)))

// ======================= static: flag wiring and the untouched handlers =======================
await check('flag: exact "true", Studio shell only, documented off in .env.example, handlers untouched', async () => {
  const lib = read('lib/element-placeholder-defer.ts')
  assert.match(lib, /export const STUDIO_ELEMENT_PLACEHOLDER_FIX_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_ELEMENT_PLACEHOLDER_FIX === 'true'/)
  const hook = read('hooks/use-textlabs-generation.ts')
  assert.match(hook, /const placeholderFixEnabled = studio && STUDIO_ELEMENT_PLACEHOLDER_FIX_ENABLED/)
  assert.match(hook, /\n {2}return \{ handleGenerate, handleOpenPanel \}\n\}/, 'flag off returns the original handlers')
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_ELEMENT_PLACEHOLDER_FIX="false"$/m)
  // The two original handlers are byte-for-byte the base's: the fix only wraps them.
  if (baseAvailable) {
    const printer = ts.createPrinter({ removeComments: true })
    // IMAGE-PENDING-WRITE (NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE) later added marked lines to handleGenerate; with exactly those lines removed it is this base's
    // (scripts/test-studio-image-pending-write.mjs proves the hook minus those lines is the base file, byte for byte).
    const withoutImagePendingLines = source => { let inBlock = false; return source.split('\n').filter(line => { if (line.includes('// IMAGE-PENDING-WRITE begin')) { inBlock = true; return false } if (line.includes('// IMAGE-PENDING-WRITE end')) { inBlock = false; return false } return !inBlock && !line.includes('// IMAGE-PENDING-WRITE') }).join('\n') }
    const decl = (source, name) => {
      source = withoutImagePendingLines(source)
      const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      let found
      const visit = node => { if (!found && ts.isVariableDeclaration(node) && node.name.getText(sf) === name) found = printer.printNode(ts.EmitHint.Unspecified, node.initializer, sf); else ts.forEachChild(node, visit) }
      visit(sf)
      assert.ok(found, name)
      return found
    }
    // PASS2D (NEXT_PUBLIC_STUDIO_ELEMENT_FREE_SPOT) later changed the two lines handleOpenPanel takes its start from; with them put back it is this base's
    // (scripts/test-studio-element-free-spot.mjs proves that edit and the flag-off identity).
    const freeSpotLines = /const startCol = freeSpotRef\.current\?\.startCol \?\? 2;\s*const startRow = freeSpotRef\.current\?\.startRow \?\? 4;/
    for (const name of ['handleGenerate', 'handleOpenPanel']) {
      assert.equal(decl(read('hooks/use-textlabs-generation.ts'), name).replace(freeSpotLines, 'const startCol = 2;\n    const startRow = 4;'), decl(read('hooks/use-textlabs-generation.ts', BASE), name), `${name} is unchanged`)
    }
    const fn = source => { const m = source.match(/function buildPlaceholderHtml[\s\S]*?\n\}\n/); assert.ok(m); return m[0] }
    assert.equal(fn(read('hooks/use-textlabs-generation.ts')), fn(read('hooks/use-textlabs-generation.ts', BASE)), 'the placeholder markup is unchanged')
  }
})

// ======================= before (the bug, on the base / flag off) =======================
if (baseAvailable) {
  await check('before: choosing a card inserts a placeholder at once; cancelling leaves it, and a reload shows it', async () => {
    for (const variant of [{ ref: BASE }, {}, { flag: 'false' }]) {
      const rig = createRig({ ...variant, type: 'CHART' })
      await rig.advance(0)
      await rig.open('CHART')
      await rig.advance(0)
      assert.equal(blankInserts(rig).length, 1, 'the card click inserts the placeholder immediately')
      rig.panel.closePanel()
      await rig.rerender()
      assert.equal(blankIdsOnSlide(rig).length, 1, 'cancel leaves the empty placeholder on the slide')
      assert.equal(rig.saved.length, 1, 'and it was saved into the deck: a reload shows it')
    }
  })
}

// ======================= the Studio dev P0 (PASS2-J3 round 4): #388 as merged, on a Layout that names the placeholder itself ==========
// Live (Studio dev, flag on): every Generate failed with this text and no Text Labs request was made. Cause: Layout's insertTextBox
// ignores `elementId` and names the text box itself; #388 treated the answered name as "a different identity", deleted the element
// and failed. #388's own stand-in kept the `elementId` Studio sent, so its harness passed.
const PR388 = '9196a6af20b8cc5cf4aea30e332067cb65070160'   // merge of #388 (head 93822214) into studio-v4-dev-preparation-code
const LIVE_P0_TEXT = 'The presentation viewer could not show generation progress: The element placeholder could not be added. '
  + 'Please wait for the slide to finish loading and try again. Reload the slide and try again.'
let pr388Available = true
try { execFileSync('git', ['cat-file', '-e', `${PR388}^{commit}`], { cwd: root, env: gitEnv, stdio: 'ignore' }) } catch { pr388Available = false }
if (pr388Available) {
  await check('live P0 reproduced: #388 as merged fails every Generate exactly like Studio dev (the text, no Text Labs request, nothing left)', async () => {
    for (const type of TYPES) {
      for (const immediate of [true, false]) {
        const { rig, result } = await chooseThenGenerate({ ref: PR388, ...ON, immediate, type })
        assert.equal(result.status, 'failed', `${type}: fails`)
        assert.equal(rig.panel.error, LIVE_P0_TEXT, `${type}: the exact text Studio dev showed`)
        assert.equal(rig.requests.length, 0, `${type}: no Text Labs request`)
        assert.match(blankInserts(rig)[0]?.assigned ?? '', /^textbox-layout-/, `${type}: Layout named the placeholder itself`)
        assert.deepEqual(liveIds(rig), [], `${type}: nothing is left`)
      }
    }
  })
  await check('why #388\'s harness passed: on its stand-in (Layout keeps the elementId Studio sends) the same code generates', async () => {
    const { rig, result } = await chooseThenGenerate({ ref: PR388, ...ON, type: 'CHART' }, { afterOpen: async r => { r.state.honourElementId = true } })
    assert.equal(result.status, 'inserted', rig.panel.error ?? '')
    assert.deepEqual(liveIds(rig), ['generated-1'])
  })
}

// ======================= after (flag on) =======================
for (const type of TYPES) {
  for (const immediate of [false, true]) {
    await check(`on: ${type}${immediate ? ' + immediate failure feedback' : ''}: Layout names the placeholder itself (as the real viewer does) and Generate still produces exactly one element`, async () => {
      const { rig, result } = await chooseThenGenerate({ ...ON, immediate, type })
      assert.equal(result.status, 'inserted', `Generate failed: ${rig.panel.error}`)
      assert.equal(rig.requests.length, 1, 'one Text Labs request')
      assert.equal(blankInserts(rig).length, 1, 'one placeholder insertion')
      const layoutId = blankInserts(rig)[0].assigned
      assert.notEqual(layoutId, blankInserts(rig)[0].id, 'Layout ignored the elementId and named the placeholder itself')
      const forPlaceholder = rig.log.slice(1).filter(c => c.id && !/^(insert|upsert)/.test(c.action) && !c.id.startsWith('generated-'))
      assert.ok(forPlaceholder.length >= 3 && forPlaceholder.every(c => c.id === layoutId),
        `every command for the placeholder reached the element Layout holds: ${JSON.stringify(names(rig))}`)
      assert.deepEqual(liveIds(rig), ['generated-1'], 'exactly one element')
      assert.deepEqual(rig.saved, ['generated-1'], 'and it is what is saved')
      assert.deepEqual(blankIdsOnSlide(rig), [])
    })
  }
}

await check('on: the old stand-in (Layout keeps the elementId) still works: the identity is simply the same', async () => {
  const { rig, result } = await chooseThenGenerate({ ...ON, type: 'CHART' }, { afterOpen: async r => { r.state.honourElementId = true } })
  assert.equal(result.status, 'inserted', rig.panel.error ?? '')
  assert.equal(blankInserts(rig)[0].assigned, blankInserts(rig)[0].id)
  assert.deepEqual(liveIds(rig), ['generated-1'])
})

await check('on: the deck theme changes after the placeholder was replaced: the Generate puts it back, the take-out removes that one; nothing empty is left and the form keeps its error', async () => {
  const { rig, result } = await chooseThenGenerate({ ...ON, type: 'CHART', scenario: 'themeChangeAfterReplace' }, { generateOver: { useDeckTheme: true, presentationId: 'offline-deck' } })
  assert.equal(result.status, 'failed')
  assert.equal(rig.requests.length, 1, 'Text Labs answered')
  assert.equal(generatedInserts(rig).length, 1, 'the generated element went in, replaced the placeholder, and was rolled back when the theme changed')
  assert.match(rig.panel.error ?? '', /theme/i, 'the failure is the theme change, not the placeholder')
  const inserts = blankInserts(rig)
  assert.equal(inserts.length, 2, 'the placeholder, then the Generate\'s own restore of it')
  assert.notEqual(inserts[1].assigned, inserts[0].assigned, 'Layout named the restored one afresh')
  assert.ok(rig.log.some(c => c.action === 'deleteElement' && c.id === inserts[1].assigned && c.outcome === 'ok'), 'the take-out removed the restored element')
  assert.deepEqual(liveIds(rig), [], 'nothing, empty or generated, is left')
  assert.deepEqual(rig.saved, [])
  assert.equal(rig.panel.isOpen, true)
  assert.equal(rig.panel.blankElementId, inserts[0].id, 'the form keeps its own identity')
  assert.ok(rig.panel.error, 'and shows the failure')
  assert.equal(rig.tracked(inserts[0].id), true, 'Retry works')
})
for (const type of TYPES) {
  await check(`on: choosing ${type} sends nothing to Layout and opens its form`, async () => {
    const rig = createRig({ ...ON, type })
    await rig.advance(0)
    await rig.open(type)
    await rig.advance(0)
    assert.deepEqual(names(rig), [], 'no Layout command at all')
    assert.deepEqual(liveIds(rig), [])
    assert.equal(rig.panel.isOpen, true)
    assert.equal(rig.panel.elementType, type)
    assert.ok(rig.panel.blankElementId?.startsWith('blank_'), 'the form still has its own target identity')
    assert.ok(rig.tracked(rig.panel.blankElementId), 'tracked, so the form gets its default geometry as before')
    assert.equal(rig.toasts.length, 0)
  })
}

await check('on: choose then cancel: nothing created, nothing deleted, nothing saved, nothing tracked; a reload is clean', async () => {
  const rig = createRig({ ...ON, type: 'CHART' })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  const id = rig.panel.blankElementId
  rig.panel.closePanel()
  await rig.rerender()
  await rig.advance(50)
  assert.deepEqual(names(rig), [], 'no create, no delete, no postMessage to Layout')
  assert.deepEqual(rig.saved, [])
  assert.equal(rig.tracked(id), false, 'the cancelled target is forgotten')
  const reloaded = createRig({ ...ON, type: 'CHART', saved: rig.saved })
  await reloaded.advance(0)
  assert.deepEqual(liveIds(reloaded), [], 'reload after cancel: no empty element')
})

await check('on: Escape-style close and a second card (choose Chart, cancel, choose Table) leave only the live form tracked', async () => {
  const rig = createRig({ ...ON })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  const first = rig.panel.blankElementId
  await rig.open('TABLE')
  await rig.advance(0)
  const second = rig.panel.blankElementId
  assert.notEqual(first, second)
  assert.deepEqual(names(rig), [])
  assert.equal(rig.tracked(first), false, 'the superseded card is not tracked')
  assert.equal(rig.tracked(second), true)
  rig.panel.closePanel()
  await rig.rerender()
  assert.equal(rig.tracked(second), false)
  assert.deepEqual(names(rig), [])
  assert.deepEqual(rig.saved, [])
})

await check('on: choose then Generate: the placeholder goes in only now, is replaced, and exactly one element is left and saved', async () => {
  const base = baseAvailable ? await chooseThenGenerate({ ref: BASE, type: 'CHART' }) : null
  const { rig, result } = await chooseThenGenerate({ ...ON, type: 'CHART' })
  assert.equal(result.status, 'inserted')
  const seq = names(rig)
  assert.equal(blankInserts(rig).length, 1, 'one placeholder insertion')
  assert.equal(generatedInserts(rig).length, 1, 'one generated insertion')
  const blankId = blankInserts(rig)[0].id
  const layoutId = blankInserts(rig)[0].assigned
  assert.match(layoutId, /^textbox-layout-\d+$/, 'Layout named the placeholder itself, as the real viewer does')
  assert.equal(seq[0], `insertTextBox[blank](${blankId})`, 'the very first Layout command is the placeholder, sent by Generate')
  assert.equal(seq[1], `setElementGenerationState(${layoutId}):true`, 'then the progress overlay on it, on the element Layout really holds')
  const context = rig.log.find(c => c.action === 'getSlideGenerationContext')
  assert.equal(context?.target, layoutId, 'the slide context is read for the element Layout really holds')
  assert.equal(context?.outcome, 'ok', 'and Layout found it (no degraded context)')
  const firstGenerated = rig.log.findIndex(c => c.action.startsWith('insert') && !c.blank)
  const placeholderDelete = rig.log.findIndex(c => c.action === 'deleteElement' && c.id === layoutId)
  assert.ok(firstGenerated > 1 && placeholderDelete > firstGenerated, 'create-first: the placeholder is deleted only after the generated element is in')
  assert.deepEqual(liveIds(rig), ['generated-1'], 'exactly one element remains on the slide')
  assert.deepEqual(rig.saved, ['generated-1'], 'and it is what is saved')
  assert.equal(rig.tracked(blankId), false)
  assert.equal(rig.panel.mode, 'refine', 'the panel moves on to refining the generated element, as before')
  if (base) {
    // The command the card click used to send is the command Generate now sends, parameter for parameter.
    assert.equal(blankInserts(base.rig)[0].params, blankInserts(rig)[0].params, 'the placeholder insertion is byte-identical to the base card-click command')
    assert.deepEqual(names(rig).slice(1), names(base.rig).slice(1), 'every other command, in order, equals the base')
    assert.equal(base.result.status, 'inserted')
    assert.deepEqual(liveIds(rig), liveIds(base.rig))
    // What Text Labs is asked is what the base asked (the placeholder's identity aside: the base's form held Layout's name for it).
    const body = (r, ids) => ids.reduce((text, id) => text.split(id).join('<placeholder>'), r.requests.map(q => q.body ?? '').join('\n'))
    assert.equal(body(rig, [blankId, layoutId]), body(base.rig, [blankInserts(base.rig)[0].id, blankInserts(base.rig)[0].assigned]),
      'the Text Labs request equals the base request')
  }
})

await check('on: Generate fails (provider error): the placeholder is taken out again, the form keeps its draft, Retry inserts it afresh and succeeds', async () => {
  const rig = createRig({ ...ON, type: 'CHART', backend: '500' })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  rig.panel.updateCurrentDraft({ prompt: 'my chart prompt' })
  await rig.rerender()
  const blankId = rig.panel.blankElementId
  const first = Promise.resolve(rig.generate())
  await rig.advance(SLOW * 3)
  const failed = await first
  await rig.advance(0)
  assert.equal(failed.status, 'failed')
  assert.equal(blankInserts(rig).length, 1)
  const layoutId = blankInserts(rig)[0].assigned
  assert.ok(rig.log.some(c => c.action === 'deleteElement' && c.id === layoutId && c.outcome === 'ok'), 'the take-out deleted the element Layout really holds')
  assert.ok(rig.deletedEvents.length > 0 && rig.deletedEvents.every(e => !e.closes), "the Builder's elementDeleted did not close the form")
  assert.deepEqual(blankIdsOnSlide(rig), [], 'no empty placeholder stays on the slide after a failed Generate')
  assert.deepEqual(rig.saved, [], 'and none is saved')
  assert.equal(rig.panel.isOpen, true)
  assert.equal(rig.panel.blankElementId, blankId)
  assert.ok(rig.panel.error, 'the failure is shown in the panel')
  assert.equal(rig.panel.currentDraft?.prompt, 'my chart prompt', 'the draft is kept')
  assert.equal(rig.panel.isGenerating, false)
  assert.equal(rig.tracked(blankId), true, 'still tracked: Retry works')
  // The provider recovers; Retry.
  rig.state.backend = 'ok'
  const retry = Promise.resolve(rig.generate({}, 'retry'))
  await rig.advance(SLOW * 3)
  const ok = await retry
  await rig.advance(0)
  assert.equal(ok.status, 'inserted')
  assert.equal(blankInserts(rig).length, 2, 'the retry inserted the placeholder afresh')
  assert.deepEqual(liveIds(rig), ['generated-1'])
  assert.deepEqual(rig.saved, ['generated-1'])
})

await check('on: Generate fails and the user then cancels: nothing is left on the slide or saved', async () => {
  const rig = createRig({ ...ON, type: 'CHART', backend: '500' })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  const first = Promise.resolve(rig.generate())
  await rig.advance(SLOW * 3)
  await first
  rig.panel.closePanel()
  await rig.rerender()
  await rig.advance(50)
  assert.deepEqual(liveIds(rig), [])
  assert.deepEqual(rig.saved, [])
  assert.equal(rig.tracked(rig.panel.blankElementId), false)
})

await check('on: the deck theme is not ready: Generate is refused, no empty placeholder stays behind', async () => {
  const rig = createRig({ ...ON, type: 'TEXT_BOX', theme: 'failed' })
  await rig.advance(0)
  await rig.open('TEXT_BOX')
  await rig.advance(0)
  const result = await Promise.resolve(rig.generate({ useDeckTheme: true }))
  await rig.advance(0)
  assert.equal(result.status, 'failed')
  assert.equal(rig.requests.length, 0, 'Text Labs is never called')
  assert.deepEqual(blankIdsOnSlide(rig), [])
  assert.deepEqual(rig.saved, [])
  assert.ok(rig.panel.error)
})

await check('on: an invalid Generate (chart position outside the grid) never reaches Layout', async () => {
  const rig = createRig({ ...ON, type: 'CHART' })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  const result = await Promise.resolve(rig.generate({ positionConfig: { start_col: 40, start_row: 4, position_width: 10, position_height: 6, auto_position: false } }))
  await rig.advance(0)
  assert.equal(result.status, 'failed')
  assert.deepEqual(names(rig), [], 'the validation fails before anything is created')
  assert.ok(rig.panel.error)
})

await check('on: Layout refuses the placeholder at Generate: a plain error, no overlay, nothing left; Retry then works', async () => {
  const rig = createRig({ ...ON, type: 'CHART' })
  rig.state.insertRefusals = 1
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  const result = await Promise.resolve(rig.generate())
  await rig.advance(0)
  assert.equal(result.status, 'failed')
  assert.match(rig.panel.error, /placeholder could not be added/i)
  assert.equal(rig.log.filter(c => c.action === 'setElementGenerationState' && c.generating === true).length, 0, 'no progress overlay on an element that is not there')
  assert.equal(rig.requests.length, 0)
  assert.deepEqual(liveIds(rig), [])
  assert.equal(rig.panel.isGenerating, false)
  const retry = Promise.resolve(rig.generate({}, 'retry'))
  await rig.advance(SLOW * 3)
  assert.equal((await retry).status, 'inserted')
  assert.deepEqual(liveIds(rig), ['generated-1'])
})

await check('on: a double click on Generate inserts the placeholder once and never takes it out from under the running Generate', async () => {
  const rig = createRig({ ...ON, type: 'CHART' })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  const generate = rig.generate
  const a = Promise.resolve(generate())
  const b = Promise.resolve(generate())
  await rig.advance(SLOW * 3)
  const [ra, rb] = await Promise.all([a, b])
  await rig.advance(0)
  assert.equal(blankInserts(rig).length, 1, 'one placeholder')
  assert.equal([ra, rb].filter(r => r.status === 'inserted').length, 1, 'one Generate won')
  assert.deepEqual(liveIds(rig), ['generated-1'], 'the winner finished with exactly one element')
})

for (const [label, options] of [
  ['the second inserted element is refused (rollback)', { scenario: 'partial2', elements: 2 }],
]) {
  await check(`on: ${label}: the generated copies are rolled back and the empty placeholder is taken out too`, async () => {
    const { rig, result } = await chooseThenGenerate({ ...ON, type: 'TEXT_BOX', ...options })
    assert.equal(result.status, 'failed')
    assert.deepEqual(liveIds(rig), [], 'nothing, empty or generated, is left')
    assert.deepEqual(rig.saved, [])
  })
}

await check('on: the viewer was replaced during the Generate: no compensating command is sent to the new viewer', async () => {
  const rig = createRig({ ...ON, type: 'CHART', backend: '500' })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  const pending = Promise.resolve(rig.generate())
  await rig.advance(SLOW / 2)
  rig.state.leaseCurrent = false // the lease no longer matches the viewer: the slide's state is unknown
  const before = rig.log.length
  await rig.advance(SLOW * 3)
  await pending
  await rig.advance(0)
  assert.equal(rig.log.slice(before).filter(c => c.action === 'deleteElement').length, 0, 'no delete is attempted on an unknown viewer state')
})

await check('on: a refused take-out leaves the placeholder tracked and reachable, and Retry does not insert a second one', async () => {
  const rig = createRig({ ...ON, type: 'CHART', backend: '500' })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  rig.state.deleteRefusals = 1
  const first = Promise.resolve(rig.generate())
  await rig.advance(SLOW * 3)
  await first
  await rig.advance(0)
  const blankId = rig.panel.blankElementId
  assert.deepEqual(blankIdsOnSlide(rig), [blankInserts(rig)[0].assigned], 'today\'s behaviour is the fallback: the placeholder is still there')
  assert.equal(rig.tracked(blankId), true)
  rig.state.backend = 'ok'
  const retry = Promise.resolve(rig.generate({}, 'retry'))
  await rig.advance(SLOW * 3)
  assert.equal((await retry).status, 'inserted')
  assert.equal(blankInserts(rig).length, 1, 'no second placeholder')
  assert.deepEqual(liveIds(rig), ['generated-1'])
})

await check('on: switching to another presentation before Generate sends nothing to the new viewer', async () => {
  const rig = createRig({ ...ON, type: 'CHART' })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  rig.state.presentationId = 'another-deck'
  await rig.rerender() // the hook's presentation epoch moves on, as when another deck is shown
  const result = await Promise.resolve(rig.generate())
  await rig.advance(0)
  assert.equal(result.status, 'failed')
  assert.equal(blankInserts(rig).length, 0, 'the held placeholder is never inserted into a deck it was not chosen on')
})

await check('on: two cards chosen back to back (no render between): only the last is tracked, nothing reaches Layout', async () => {
  const rig = createRig({ ...ON })
  await rig.advance(0)
  const a = rig.open('CHART')
  const b = rig.open('TABLE')
  await Promise.all([a, b])
  await rig.advance(0)
  await rig.advance(0)
  assert.deepEqual(names(rig), [])
  assert.equal(rig.panel.elementType, 'TABLE')
  const live = rig.panel.blankElementId
  assert.equal(live, `blank_${START}_2`)
  assert.equal(rig.tracked(`blank_${START}_1`), false, 'the card no render ever showed is forgotten too')
  assert.equal(rig.tracked(live), true)
  rig.panel.closePanel()
  await rig.rerender()
  assert.equal(rig.tracked(live), false)
})

await check('on: the panel is closed while a Generate runs and fails, and the take-out is refused: the placeholder stays tracked and reachable', async () => {
  const rig = createRig({ ...ON, type: 'CHART', backend: '500' })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  const blankId = rig.panel.blankElementId
  rig.state.deleteRefusals = 1
  const pending = Promise.resolve(rig.generate())
  await rig.advance(SLOW / 2)
  rig.panel.closePanel()
  await rig.rerender()
  await rig.advance(SLOW * 3)
  await pending
  await rig.advance(0)
  assert.deepEqual(blankIdsOnSlide(rig), [blankInserts(rig)[0].assigned], 'the refused delete leaves it on the slide, as before the fix')
  assert.equal(rig.tracked(blankId), true, 'so it stays tracked and reachable (a click on it reopens the form)')
})

for (const [label, options, expected] of [
  ['Generate succeeds', {}, ['generated-1']],
  ['Generate fails (provider error)', { backend: '500' }, []],
  ['the second inserted element is refused (rollback)', { scenario: 'partial2', elements: 2, type: 'TEXT_BOX' }, []],
]) {
  await check(`on + immediate failure feedback: ${label}: nothing empty is left on the slide or saved`, async () => {
    const { rig, result } = await chooseThenGenerate({ ...ON, immediate: true, type: 'CHART', ...options })
    assert.equal(result.status, expected.length ? 'inserted' : 'failed')
    assert.deepEqual(liveIds(rig), expected)
    assert.deepEqual(rig.saved, expected)
    assert.equal(rig.panel.isGenerating, false)
    if (!expected.length) assert.ok(rig.panel.error, 'the failure is still shown in the panel')
    // and the card click alone, then cancel, still sends nothing
    const idle = createRig({ ...ON, immediate: true })
    await idle.advance(0)
    await idle.open('CHART')
    await idle.advance(0)
    idle.panel.closePanel()
    await idle.rerender()
    assert.deepEqual(names(idle), [])
  })
}

// ======================= flows the fix must not touch =======================
await check('on: a chat-added element (no placeholder) behaves exactly as on the base', async () => {
  if (!baseAvailable) return
  const run = async variant => {
    const rig = createRig({ ...variant, type: 'TEXT_BOX' })
    await rig.advance(0)
    const pending = Promise.resolve(rig.generate({}, 'generate', { kind: 'chat-add', slideIndex: 0 }))
    await rig.advance(SLOW * 3)
    const result = await pending
    return { rig, result }
  }
  const base = await run({ ref: BASE })
  const on = await run(ON)
  assert.equal(trace(on.rig), trace(base.rig))
  assert.equal(on.result.status, base.result.status)
})

await check('on: refining an existing element behaves exactly as on the base', async () => {
  if (!baseAvailable) return
  const run = async variant => {
    const rig = createRig({ ...variant, type: 'CHART', refine: true })
    await rig.advance(0)
    const pending = Promise.resolve(rig.generate())
    await rig.advance(SLOW * 3)
    const result = await pending
    await rig.advance(0)
    return { rig, result }
  }
  const base = await run({ ref: BASE })
  const on = await run(ON)
  assert.equal(trace(on.rig), trace(base.rig))
  assert.equal(on.result.status, base.result.status)
})

await check('on: an existing (reloaded) placeholder that the user clicks is still tracked and generates as before', async () => {
  // Placeholders already saved in a deck are real elements: the fix does not touch them.
  const rig = createRig({ ...ON, type: 'CHART', saved: ['blank_old_1'] })
  await rig.advance(0)
  rig.blank.addElement({ elementId: 'blank_old_1', componentType: 'CHART', slideIndex: 0, startCol: 2, startRow: 4, width: 12, height: 8, status: 'blank' })
  rig.panel.openPanelForElement('CHART', 'blank_old_1')
  await rig.advance(0)
  const pending = Promise.resolve(rig.generate())
  await rig.advance(SLOW * 3)
  const result = await pending
  await rig.advance(0)
  assert.equal(result.status, 'inserted')
  assert.equal(blankInserts(rig).length, 0, 'it was already on the slide: nothing is inserted for it')
  assert.deepEqual(liveIds(rig), ['generated-1'])
})

// ======================= flag off: identical to the base =======================
const DEV_HEAD = '90f15a1f99242ceadde0799f2f51e458fcbe727a'   // origin/studio-v4-dev-preparation-code when this fix-forward was cut
let devHeadAvailable = true
try { execFileSync('git', ['cat-file', '-e', `${DEV_HEAD}^{commit}`], { cwd: root, env: gitEnv, stdio: 'ignore' }) } catch { devHeadAvailable = false }
if (baseAvailable) {
  const SCENARIOS = {
    'choose': async rig => { await rig.open('CHART'); await rig.advance(0) },
    'choose, cancel': async rig => { await rig.open('CHART'); await rig.advance(0); rig.panel.closePanel(); await rig.rerender() },
    'choose, switch card': async rig => { await rig.open('CHART'); await rig.advance(0); await rig.open('TABLE'); await rig.advance(0) },
    'choose, Generate ok': async rig => { await rig.open('CHART'); await rig.advance(0); const p = Promise.resolve(rig.generate()); await rig.advance(SLOW * 3); await p; await rig.advance(0) },
    'choose, Generate fails, cancel': async rig => {
      rig.state.backend = '500'
      await rig.open('CHART'); await rig.advance(0)
      const p = Promise.resolve(rig.generate()); await rig.advance(SLOW * 3); await p; await rig.advance(0)
      rig.panel.closePanel(); await rig.rerender()
    },
    'choose, Generate partial rollback': async rig => {
      rig.state.scenario = 'partial2'; rig.state.elements = 2
      await rig.open('CHART'); await rig.advance(0)
      const p = Promise.resolve(rig.generate()); await rig.advance(SLOW * 3); await p; await rig.advance(0)
    },
    'choose, refused placeholder': async rig => { rig.state.insertRefusals = 1; await rig.open('CHART'); await rig.advance(0) },
  }
  for (const [label, run] of Object.entries(SCENARIOS)) {
    await check(`off: "${label}" is identical to the base (flag unset and flag "false"): commands, requests, toasts, panel, saved deck`, async () => {
      const traces = []
      // The base before #388, and (when present) the dev head this fix-forward is cut from (#388 merged, its flag off).
      for (const variant of [{ ref: BASE }, {}, { flag: 'false' }, ...(devHeadAvailable ? [{ ref: DEV_HEAD }] : [])]) {
        const rig = createRig({ ...variant, type: 'CHART' })
        await rig.advance(0)
        await run(rig)
        traces.push(trace(rig))
      }
      assert.equal(traces[1], traces[0], 'flag unset equals the base')
      assert.equal(traces[2], traces[0], 'flag "false" equals the base')
      if (devHeadAvailable) assert.equal(traces[3], traces[0], 'and equals the dev head this fix is cut from (flag unset)')
    })
  }
}

await check('the flag is ignored outside the Studio shell', async () => {
  const rig = createRig({ ...ON, studio: false, type: 'CHART' })
  await rig.advance(0)
  await rig.open('CHART')
  await rig.advance(0)
  assert.equal(blankInserts(rig).length, 1, 'classic Builder: the card still inserts at once, as before')
})

assert.deepEqual(unhandled, [], 'no unhandled rejection')
if (failedChecks.length) { console.error(failedChecks.join('\n')); process.exit(1) }
console.log(`studio element placeholder fix: ${results.length} checks passed${baseAvailable ? '' : ' (base ref unavailable: parity checks skipped)'}`)
