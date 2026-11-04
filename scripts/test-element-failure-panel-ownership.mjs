// Real-hook proof that Studio failure recovery follows presentation authority, not panel drafts.
//
// Loads the actual hooks/use-generation-panel.ts, hooks/use-blank-elements.ts and
// hooks/use-textlabs-generation.ts (and the real lib/*) into a small React-hook runtime with a
// virtual clock. Text Labs HTTP and the Layout command bridge are fakes. Offline: no sockets, no
// keys, no live or paid calls. Complements test-element-failure-feedback.mjs, whose panel is a
// hand-written adapter and therefore cannot model draft persistence bumping the intent revision.
//
// Pinned findings (PR #338 review): HIGH 1 a draft/self-triggered intent bump silenced the failure
// and skipped rollback/restore/overlay cleanup; HIGH 2 the image edit-preflight released its own
// busy key so cleanup never cleared the generating overlay; MEDIUM an older restore must still
// restore its placeholder while another element is opened or added.
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
let blockedSockets = 0
const denied = () => { blockedSockets++; throw new Error('Offline harness forbids network') }
net.connect = net.createConnection = net.Socket.prototype.connect = denied
http.request = http.get = https.request = https.get = denied
globalThis.fetch = denied

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Approved preparation target: the flag-off behavior every OFF trace must equal.
const BASE = '83feff51f98fb6db1480c274182825a0325831ed'
const FLAG = 'NEXT_PUBLIC_ELEMENT_FAILURE_IMMEDIATE_FEEDBACK_ENABLED'
const gitEnv = { ...process.env }
delete gitEnv.GIT_DIR
delete gitEnv.GIT_WORK_TREE
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

const SLOW = { deleteElement: 30000, insertTextBox: 30000, overlayOff: 30000 }

function createRig({
  ref, flag, studio = true, type = 'TEXT_BOX', refine = false, backend = 'ok', scenario = 'none',
  delayMs = 0, slowMs = 5000, elementsReturned = 1, latency = {}, realBlank = false, formWiring = false,
} = {}) {
  // ---- virtual clock ----
  let now = 0
  let timerSeq = 0
  let uuid = 0
  const timers = new Map()
  const setTimer = (fn, ms = 0) => { const id = ++timerSeq; timers.set(id, { at: now + (ms || 0), id, fn }); return id }
  const clearTimer = id => { timers.delete(id) }
  const sleep = ms => new Promise(resolve => setTimer(resolve, ms))
  const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }
  const events = []
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
    constructor(...args) { if (args.length) super(...args); else super(1_800_000_000_000 + now) }
    static now() { return 1_800_000_000_000 + now }
  }

  // ---- minimal React hook runtime ----
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
  const requests = []
  const commands = []
  const toasts = []
  const visible = []
  const state = { backend, scenario, elementsReturned, delayMs }
  const fakeConsole = {
    log() {}, info() {},
    warn(...args) { events.push({ at: now, ev: 'console_warn', msg: `${args[0]} ${args[1]?.message ?? ''}` }) },
    error(label) { if (label === '[TextLabs] Generation error:') events.push({ at: now, ev: 'failure_formed' }) },
  }
  const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) })
  const component = () => ({
    component_type: type, html: '<div>Offline generated</div>', image_url: 'https://offline.invalid/i.svg', content: '<div>Offline generated</div>',
    grid_position: { start_col: 5, start_row: 4, position_width: 10, position_height: 6 },
  })
  const fakeFetch = async (url, init = {}) => {
    assert.ok(String(url).startsWith('https://textlabs.example.test/'), 'only the fake Text Labs host is reachable')
    requests.push({ at: now, url: String(url) })
    events.push({ at: now, ev: 'http_dispatch' })
    const signal = init.signal
    const abortable = promise => new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      promise.then(resolve, reject)
    })
    if (state.delayMs) await abortable(sleep(state.delayMs))
    if (state.backend === 'slow_then_500') {
      await abortable(sleep(slowMs))
      return respond(500, { error: 'Upstream exploded', error_code: 'UPSTREAM_500', retryable: false })
    }
    return respond(200, { success: true, elements: Array.from({ length: state.elementsReturned }, component) })
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

  // ---- fake Layout bridge ----
  let leaseCurrent = true
  const lat = { deleteElement: 0, insertTextBox: 0, overlayOn: 0, overlayOff: 0, ...latency }
  const live = new Set(['blank-1'])
  if (refine) live.add('original-1')
  const deleted = new Set()
  let inserted = 0
  const delayFor = async action => { if (lat[action]) await sleep(lat[action]) }
  const sendElementCommand = async (action, args = {}) => {
    commands.push({ at: now, action, id: args.elementId ?? null, generating: action === 'setElementGenerationState' ? args.generating : undefined })
    if (action === 'getElementGeometry') return { success: true, action, elementId: args.elementId, position: { gridRow: '4/10', gridColumn: '5/15' } }
    if (action === 'getElementGenerationMetadata') return { success: true, componentType: type, themeVariantSource: 'manual' }
    if (action === 'getSlideGenerationContext') throw new Error('context unavailable (offline)')
    if (action === 'getElementMutationReceipt') return { status: 'unknown' }
    if (action === 'setElementGenerationState') { await delayFor(args.generating ? 'overlayOn' : 'overlayOff'); return { success: true, elementId: args.elementId } }
    if (action.startsWith('insert') || action.startsWith('upsert')) {
      if (String(args.elementId || '').startsWith('blank-')) {
        await delayFor('insertTextBox') // placeholder restore
        live.add(args.elementId)
        events.push({ at: now, ev: 'restore_ack', id: args.elementId })
        return { success: true, elementId: args.elementId }
      }
      inserted++
      if (state.scenario === 'partial2' && inserted === 2) return { success: false, error: 'Offline insertion failed' }
      live.add(`generated-${inserted}`)
      return { success: true, elementId: `generated-${inserted}` }
    }
    if (action === 'deleteElement') {
      const id = args.elementId
      if (id.startsWith('blank-')) {
        if (deleted.has(id)) await delayFor('deleteElement') // restore delete is slow; the first (post-insert) one is not
      } else await delayFor('deleteElement') // generated rollback is slow
      live.delete(id)
      deleted.add(id)
      return { success: true, elementId: id }
    }
    return { success: true, elementId: args.elementId }
  }
  const layoutServiceApis = {
    sendElementCommand,
    captureStudioElementGeneration: () => ({ sendElementCommand, isCurrent: () => leaseCurrent }),
  }

  // ---- placeholder tracking: fake map or the real hook ----
  const tracked = new Map([['blank-1', { elementId: 'blank-1', componentType: type, slideIndex: 0, startCol: 5, startRow: 4, width: 10, height: 6, status: 'blank' }]])
  const fakeBlank = {
    getElement: id => tracked.get(id), updatePosition() {}, updateGenerationMetadata() {},
    setStatus(id, status) { const info = tracked.get(id); if (info) info.status = status },
    removeElement(id) { tracked.delete(id) },
    addElement(info) { tracked.set(info.elementId, info) },
    trackElement() {},
  }

  const panelModule = load('hooks/use-generation-panel.ts')
  const blankModule = realBlank ? load('hooks/use-blank-elements.ts') : null
  const generationModule = load('hooks/use-textlabs-generation.ts')
  let latest = null
  let lastPanelError = null
  const params = {
    textLabsSession: { ensureSession: async () => 'offline-session' }, layoutServiceApis, currentSlideIndex: 0, getCurrentSlideIndex: () => 0,
    deckContext: null, researchSessionId: null, researchStoreName: null, researchUserId: null, researchCapabilities: {},
    getThemeSyncSnapshot: () => ({ status: 'applied', presentationId: 'offline-deck', requestId: 'r', themeFingerprint: 'f' }),
    ensureThemeReady: async () => ({ ready: true, source: 'neutral' }),
    toast: value => { toasts.push({ at: now, ...value }); visible.push({ at: now, via: 'toast', text: value.description }) },
  }
  function Component() {
    const panel = panelModule.useGenerationPanel()
    const blank = realBlank ? blankModule.useBlankElements() : fakeBlank
    if (formWiring) {
      // app/builder/page.tsx tracks the panel's placeholder; every element form persists its draft
      // from an effect that lists elementContext (= blank.activePosition) as a dependency.
      const trackRef = hooks.useRef(blank.trackElement)
      trackRef.current = blank.trackElement
      hooks.useEffect(() => { trackRef.current(panel.blankElementId) }, [panel.blankElementId])
      const elementContext = hooks.useMemo(() => blank.activePosition, [blank.activePosition])
      hooks.useEffect(() => { panel.updateCurrentDraft({ prompt: 'form-draft' }) }, [panel.updateCurrentDraft, elementContext])
    }
    let generationPanel = panel
    if (state.scenario === 'completion_throws') {
      generationPanel = { ...panel, completeBlankReplacement: () => { throw new Error('Offline replacement completion failed') } }
    }
    const generation = generationModule.useTextLabsGeneration({ ...params, blankElements: blank, presentationId: 'offline-deck', generationPanel })
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
  if (realBlank) latest.blank.addElement(tracked.get('blank-1'))
  if (refine) {
    latest.panel.openPanelForRefine(type, {
      elementId: 'original-1', elementType: type, slideIndex: 0, research: {}, existingElement: { component_type: type, content: '<div>orig</div>' },
      gridPosition: { start_col: 5, start_row: 4, position_width: 10, position_height: 6 }, themeVariantId: null, themeBindings: null,
    })
  } else latest.panel.openPanelForElement(type, 'blank-1')
  renderScheduled = false
  timers.clear()
  render()

  const addBlank = id => {
    const info = { elementId: id, componentType: type, slideIndex: 0, startCol: 5, startRow: 4, width: 10, height: 6, status: 'blank' }
    if (realBlank) latest.blank.addElement(info); else tracked.set(id, info)
    live.add(id)
  }
  const isTracked = id => (realBlank ? latest.blank.isBlankElement(id) : tracked.has(id))
  return {
    events, requests, commands, toasts, visible, live, isTracked, addBlank, advance, sleep,
    get now() { return now },
    get panel() { return latest.panel },
    get state() { return state },
    handleGenerate: () => latest.generation.handleGenerate, // captured like a UI event handler (stale closure)
    form: (over = {}) => ({
      componentType: type, prompt: 'Offline authored prompt', count: 1, useDeckTheme: false, structure: 'SECTIONS', textboxConfig: {},
      imageConfig: { operation: 'generate' }, chartConfig: { requested_data_source_mode: 'illustrative' }, shapeConfig: { shape_type: null },
      infographicConfig: {}, iconLabelConfig: {}, metricsConfig: {}, tableConfig: {}, diagramConfig: {}, codeDisplayConfig: {}, kanbanConfig: {},
      ganttConfig: {}, chevronConfig: {}, ideaBoardConfig: {}, cloudArchitectureConfig: {}, logicalArchitectureConfig: {}, dataArchitectureConfig: {},
      positionConfig: { start_col: 5, start_row: 4, position_width: 10, position_height: 6, auto_position: false }, ...over,
    }),
  }
}

async function exercise(options, { actions = [], formOver, invocation, intent = 'generate', horizon = 400000, probes = [] } = {}) {
  const rig = createRig(options)
  await rig.advance(0)
  await rig.advance(0)
  const before = { intent: rig.panel.getIntentRevision?.(), ownership: rig.panel.getPanelOwnershipRevision?.() }
  const generate = rig.handleGenerate()
  let result = null
  let settledAt = null
  const done = Promise.resolve(generate(rig.form(formOver), intent, invocation)).then(value => { result = value; settledAt = rig.now })
  let cursor = 0
  const observations = []
  let mid = null
  const revisionProbe = { at: 4999, silent: true, run: rig => { mid = { intent: rig.panel.getIntentRevision?.(), ownership: rig.panel.getPanelOwnershipRevision?.() }; return {} } }
  const timeline = [...actions.map(action => ({ ...action, kind: 'action' })), ...[revisionProbe, ...probes].map(probe => ({ ...probe, kind: 'probe' }))].sort((a, b) => a.at - b.at)
  for (const step of timeline) {
    await rig.advance(step.at - cursor)
    cursor = step.at
    if (step.kind === 'action') await step.run(rig)
    else { const seen = step.run(rig); if (!step.silent) observations.push({ at: step.at, ...seen }) }
  }
  await rig.advance(horizon - cursor)
  await done
  return { rig, result, settledAt, before, mid, observations }
}

const formedAt = rig => rig.events.find(event => event.ev === 'failure_formed')?.at ?? null
const sequence = rig => rig.commands.map(c => `${c.action}${c.id ? `(${c.id})` : ''}${c.generating === undefined ? '' : `:${c.generating}`}`)
const overlay = (rig, id) => rig.commands.filter(c => c.action === 'setElementGenerationState' && c.id === id).map(c => c.generating)
const orphans = rig => [...rig.live].filter(id => id.startsWith('generated-'))
const finalState = rig => ({
  live: [...rig.live].sort(),
  tracked: ['blank-1', 'blank-2', 'restored-1', 'original-1'].filter(id => rig.isTracked(id)),
  panel: { isOpen: rig.panel.isOpen, blank: rig.panel.blankElementId, mode: rig.panel.mode, busy: rig.panel.isGenerating, hasError: Boolean(rig.panel.error) },
})
const trace = run => JSON.stringify({
  events: run.rig.events, requests: run.rig.requests, commands: run.rig.commands, visible: run.rig.visible, toasts: run.rig.toasts,
  final: finalState(run.rig), status: run.result?.status, error: run.result?.error, settledAt: run.settledAt,
})

const FAILURES = {
  'pre-insert HTTP 500': { backend: 'slow_then_500', slowMs: 5000 },
  'partial insert (rollback)': { backend: 'ok', scenario: 'partial2', elementsReturned: 2, delayMs: 5000 },
  'completion throws (rollback + restore)': { backend: 'ok', scenario: 'completion_throws', delayMs: 5000 },
}
const touchDraft = { at: 1000, run: async rig => { rig.panel.updateCurrentDraft({ showAdvanced: true }); await rig.advance(0) } }
const openOther = { at: 1000, run: async rig => { rig.addBlank('blank-2'); rig.panel.openPanelForElement('TEXT_BOX', 'blank-2'); await rig.advance(0) } }
const closePanel = { at: 1000, run: async rig => { rig.panel.closePanel(); await rig.advance(0) } }
const reopenSame = { at: 1000, run: async rig => { rig.panel.closePanel(); await rig.advance(0); rig.panel.openPanelForElement('TEXT_BOX', 'blank-1'); await rig.advance(0) } }
const claimInsertion = { at: 1000, run: async rig => { rig.panel.claimInsertionIntent(); await rig.advance(0) } }

// Every scenario the OFF-identity and ON-parity checks sweep.
const SCENARIOS = []
for (const type of ['TEXT_BOX', 'CHART']) {
  for (const [failure, spec] of Object.entries(FAILURES)) {
    SCENARIOS.push({ id: `draft-touch:${type}:${failure}`, options: { type, latency: SLOW, ...spec }, run: { actions: [touchDraft] } })
  }
}
for (const [failure, spec] of Object.entries(FAILURES)) {
  SCENARIOS.push({ id: `self-triggered-bump:${failure}`, options: { latency: SLOW, realBlank: true, formWiring: true, ...spec }, run: {} })
  SCENARIOS.push({ id: `other-panel:${failure}`, options: { latency: SLOW, ...spec }, run: { actions: [openOther] } })
  SCENARIOS.push({ id: `panel-closed:${failure}`, options: { latency: SLOW, ...spec }, run: { actions: [closePanel] } })
  SCENARIOS.push({ id: `reopen-same:${failure}`, options: { latency: SLOW, ...spec }, run: { actions: [reopenSame] } })
  SCENARIOS.push({ id: `claimed-insertion:${failure}`, options: { latency: SLOW, ...spec }, run: { actions: [claimInsertion] } })
}
SCENARIOS.push({ id: 'image-edit-preflight:blank', options: { type: 'IMAGE', latency: SLOW }, run: { formOver: { imageConfig: { operation: 'edit' } } } })
SCENARIOS.push({ id: 'image-edit-preflight:refine', options: { type: 'IMAGE', refine: true, latency: SLOW }, run: { formOver: { imageConfig: { operation: 'edit' } } } })
const RESTORE = FAILURES['completion throws (rollback + restore)']
SCENARIOS.push({ id: 'restore-while-open-other', options: { latency: SLOW, ...RESTORE }, run: { actions: [{ at: 10000, run: openOther.run }] } })
SCENARIOS.push({
  id: 'restore-while-add-and-generate',
  options: { latency: SLOW, ...RESTORE },
  run: { actions: [{ at: 10000, run: async rig => {
    rig.addBlank('blank-2'); rig.panel.openPanelForElement('TEXT_BOX', 'blank-2'); await rig.advance(0)
    rig.state.scenario = 'none'; rig.state.delayMs = 0
    const second = rig.handleGenerate()(rig.form()); await rig.advance(0); rig.second = second
  } }] },
})

const results = []
let failures = 0
let currentCase = 'setup'
const check = async (name, fn) => {
  currentCase = name
  try { await fn(); results.push({ name, status: 'passed' }) } catch (error) { failures++; results.push({ name, status: 'failed' }); throw error }
}
const unhandled = []
const onUnhandled = reason => unhandled.push(String(reason?.message ?? reason))
process.on('unhandledRejection', onUnhandled)

try {
  const ON = { flag: 'true' }
  const scenario = id => SCENARIOS.find(item => item.id === id)
  const runScenario = (item, variant) => exercise({ ...item.options, ...variant }, item.run)

  // ---- HIGH 1: draft bumps (user-visible or self-triggered) never silence the failure ----
  for (const type of ['TEXT_BOX', 'CHART']) for (const failure of Object.keys(FAILURES)) {
    await check(`high1-draft-touch:${type}:${failure}`, async () => {
      const item = scenario(`draft-touch:${type}:${failure}`)
      const on = await runScenario(item, ON)
      const base = await runScenario(item, { ref: BASE })
      assert.ok(on.mid.intent > on.before.intent, 'the draft touch really bumped the intent revision')
      assert.equal(on.mid.ownership, on.before.ownership, 'a draft touch is not an ownership change')
      assert.equal(formedAt(on.rig), 5000)
      assert.deepEqual([on.rig.visible[0]?.at, on.rig.visible[0]?.via], [5000, 'panel'], 'the error reaches the still-owned panel at failure time')
      assert.equal(on.rig.toasts.length, 0, 'an owned panel needs no fallback toast')
      assert.deepEqual(sequence(on.rig), sequence(base.rig), 'compensation commands equal the flag-off behavior')
      assert.deepEqual(finalState(on.rig), finalState(base.rig))
      assert.deepEqual(orphans(on.rig), [])
      assert.ok(on.rig.live.has('blank-1') && on.rig.isTracked('blank-1'), 'the placeholder survives or is restored and tracked')
      assert.equal(on.rig.panel.isGenerating, false)
      assert.equal(on.result.status, 'failed')
      if (failure === 'pre-insert HTTP 500') assert.deepEqual(overlay(on.rig, 'blank-1'), [true, false], 'generating overlay is cleared')
    })
  }
  for (const failure of Object.keys(FAILURES)) {
    await check(`high1-self-triggered-bump:${failure}`, async () => {
      const item = scenario(`self-triggered-bump:${failure}`)
      const on = await runScenario(item, ON)
      const base = await runScenario(item, { ref: BASE })
      assert.ok(on.mid.intent > on.before.intent, 'handleGenerate -> updatePosition -> activePosition -> form draft effect bumps intent')
      assert.equal(on.mid.ownership, on.before.ownership)
      assert.deepEqual([on.rig.visible[0]?.at, on.rig.visible[0]?.via], [5000, 'panel'])
      assert.deepEqual(sequence(on.rig), sequence(base.rig))
      assert.deepEqual(finalState(on.rig), finalState(base.rig))
      assert.deepEqual(orphans(on.rig), [])
      assert.ok(on.rig.live.has('blank-1') && on.rig.isTracked('blank-1'))
      assert.equal(on.rig.panel.isGenerating, false)
      if (failure === 'pre-insert HTTP 500') assert.deepEqual(overlay(on.rig, 'blank-1'), [true, false])
    })
  }
  for (const label of ['other-panel', 'panel-closed', 'reopen-same', 'claimed-insertion']) for (const failure of Object.keys(FAILURES)) {
    await check(`high1-fallback-toast-never-silent:${label}:${failure}`, async () => {
      const item = scenario(`${label}:${failure}`)
      const on = await runScenario(item, ON)
      const base = await runScenario(item, { ref: BASE })
      assert.deepEqual([on.rig.visible[0]?.at, on.rig.visible[0]?.via], [5000, 'toast'], 'a retired panel still gets the failure, as a toast, at failure time')
      assert.equal(on.rig.toasts.length, 1)
      assert.deepEqual(sequence(on.rig), sequence(base.rig), 'a new panel does not abandon the old compensation')
      if (label === 'panel-closed') {
        // The user's close is respected: no hidden error, no reopen. The toast carries the failure.
        assert.deepEqual([on.rig.panel.isOpen, Boolean(on.rig.panel.error)], [false, false])
        assert.deepEqual(finalState(on.rig).live, finalState(base.rig).live)
        assert.deepEqual(finalState(on.rig).tracked, finalState(base.rig).tracked)
      } else if (label === 'reopen-same' || label === 'claimed-insertion') {
        // A reopened or insertion-claimed panel belongs to a newer intent: the old failure must not write into it.
        assert.equal(on.rig.panel.error, null, 'the retired attempt never writes into the newer intent')
        assert.equal(on.rig.panel.isOpen, true)
        assert.deepEqual(finalState(on.rig).live, finalState(base.rig).live)
        assert.deepEqual(finalState(on.rig).tracked, finalState(base.rig).tracked)
      } else assert.deepEqual(finalState(on.rig), finalState(base.rig))
      assert.deepEqual(orphans(on.rig), [])
      assert.ok(on.rig.live.has('blank-1') && on.rig.isTracked('blank-1'))
      if (label === 'other-panel') assert.equal(Boolean(on.rig.panel.error), false, 'the old failure never overwrites the newer panel')
    })
  }

  // ---- HIGH 2: image edit-preflight leaves cleanup to the central finally ----
  for (const target of ['blank', 'refine']) {
    await check(`high2-image-edit-preflight:${target}`, async () => {
      const item = scenario(`image-edit-preflight:${target}`)
      const id = target === 'blank' ? 'blank-1' : 'original-1'
      const probes = [{ at: 0, run: rig => ({ error: Boolean(rig.panel.error), busy: rig.panel.isGenerating }) }, { at: 29999, run: rig => ({ busy: rig.panel.isGenerating }) }]
      const on = await exercise({ ...item.options, ...ON }, { ...item.run, probes })
      const base = await runScenario(item, { ref: BASE })
      assert.deepEqual(on.observations[0], { at: 0, error: true, busy: true }, 'the error is visible at once while the key stays reserved')
      assert.deepEqual(on.observations[1], { at: 29999, busy: true }, 'retry stays blocked until the overlay is cleared')
      assert.deepEqual(overlay(on.rig, id), [true, false], 'the generating overlay is cleared, not stranded')
      assert.deepEqual(sequence(on.rig), sequence(base.rig))
      assert.equal(on.rig.panel.isGenerating, false)
      assert.equal(on.result.status, 'failed')
      assert.equal(on.rig.requests.length, 0)
    })
  }

  // ---- MEDIUM: an older restore survives the user opening or adding another element ----
  await check('medium-restore-survives-open-other', async () => {
    const item = scenario('restore-while-open-other')
    const on = await runScenario(item, ON)
    const base = await runScenario(item, { ref: BASE })
    assert.deepEqual(sequence(on.rig), sequence(base.rig))
    assert.ok(on.rig.live.has('blank-1') && on.rig.isTracked('blank-1'), 'old placeholder restored and tracked')
    assert.ok(on.rig.isTracked('blank-2'))
    assert.deepEqual([on.rig.panel.blankElementId, on.rig.panel.isOpen, on.rig.panel.error], ['blank-2', true, null], 'newer panel untouched by the old failure')
    assert.deepEqual(on.rig.visible.map(v => [v.at, v.via]), [[5000, 'panel'], [35000, 'toast']], 'shown at failure time, then re-announced once the panel has moved on')
    assert.deepEqual(finalState(on.rig), finalState(base.rig))
    assert.deepEqual(orphans(on.rig), [])
  })
  await check('medium-restore-survives-add-and-generate', async () => {
    const item = scenario('restore-while-add-and-generate')
    const run = async variant => {
      const out = await exercise({ ...item.options, ...variant }, item.run)
      await out.rig.second
      return out
    }
    const on = await run(ON)
    const base = await run({ ref: BASE })
    assert.deepEqual(sequence(on.rig), sequence(base.rig))
    assert.ok(on.rig.live.has('blank-1') && on.rig.isTracked('blank-1'), 'old placeholder restored and tracked while the user generated elsewhere')
    assert.ok(on.rig.isTracked('blank-2'))
    assert.equal(on.rig.panel.blankElementId, 'blank-2')
    assert.deepEqual(finalState(on.rig), finalState(base.rig))
    assert.deepEqual(orphans(on.rig), [])
  })
  await check('medium-same-element-retry-reserved-until-cleanup', async () => {
    const probe = { at: 10000, run: rig => ({ busy: rig.panel.isGenerating, error: rig.panel.error }) }
    const on = await exercise({ latency: SLOW, ...ON, ...RESTORE }, { probes: [probe], actions: [{ at: 10000, run: async rig => {
      rig.retryOutcome = await rig.handleGenerate()(rig.form(), 'retry')
    } }] })
    assert.equal(on.observations[0].busy, true, 'the old target stays busy during awaited cleanup')
    assert.match(on.observations[0].error, /Offline replacement completion failed/, 'the failure is already visible while cleanup runs')
    assert.equal(on.rig.retryOutcome.status, 'failed')
    assert.equal(on.rig.requests.length, 1, 'a retry during cleanup sends nothing')
  })

  // ---- flag-off identity and the panel hook contract ----
  for (const item of SCENARIOS) {
    await check(`flag-off-identity:${item.id}`, async () => {
      const second = out => out.rig.second
      const base = await runScenario(item, { ref: BASE })
      await second(base)
      for (const flag of [undefined, 'false', '1', 'TRUE', '']) {
        const off = await runScenario(item, { flag })
        await second(off)
        assert.equal(trace(off), trace(base), `Studio shell + flag ${JSON.stringify(flag)} equals the approved target`)
      }
      const classic = await runScenario(item, { flag: 'true', studio: false })
      const classicBase = await runScenario(item, { ref: BASE, studio: false })
      await second(classic); await second(classicBase)
      assert.equal(trace(classic), trace(classicBase), 'flag true outside the Studio shell equals the approved target')
    })
  }
  for (const studio of [true, false]) {
    await check(`panel-hook-contract:studio=${studio}`, async () => {
      const rig = createRig({ studio })
      await rig.advance(0)
      const { panel } = rig
      const read = () => [panel.getIntentRevision(), panel.getPanelOwnershipRevision()]
      const [intent0, ownership0] = read()
      rig.panel.updateCurrentDraft({ showAdvanced: true })
      const [intent1, ownership1] = read()
      rig.panel.closePanel()
      const [intent2, ownership2] = read()
      const claimed = rig.panel.claimInsertionIntent()
      const [intent3, ownership3] = read()
      rig.panel.openPanelForElement('TEXT_BOX', 'blank-1')
      const [intent4, ownership4] = read()
      if (studio) {
        assert.equal(intent1, intent0 + 1, 'draft persistence is a user intent')
        assert.equal(ownership1, ownership0, 'draft persistence is not a panel ownership change')
        assert.equal(intent2, intent1 + 1)
        assert.equal(ownership2, ownership1 + 1, 'close transfers panel ownership')
        assert.equal(intent3, intent2 + 1)
        assert.equal(ownership3, ownership2 + 1, 'a new insertion claims panel ownership')
        assert.equal(claimed, intent3)
        assert.deepEqual([intent4, ownership4], [intent3 + 1, ownership3 + 1], 'reopening a panel (even the same element) is a new owner')
      } else {
        assert.deepEqual([intent1, intent2, intent3, intent4, ownership1, ownership2, ownership3, ownership4, claimed], [0, 0, 0, 0, 0, 0, 0, 0, 0], 'outside the shell nothing is counted')
      }
    })
  }

  await new Promise(resolve => setImmediate(resolve))
  assert.equal(unhandled.length, 0, `no unhandled rejection: ${unhandled.slice(0, 2)}`)
  assert.equal(blockedSockets, 0)
  console.log(JSON.stringify({ passed: results.length, failed: 0, scenarios: SCENARIOS.length, unhandled_rejections: 0, external_socket_attempts: blockedSockets }))
} catch (error) {
  console.error(`Failed ownership scenario: ${currentCase}: ${error.message}`)
  process.exitCode = 1
} finally {
  process.off('unhandledRejection', onUnhandled)
}
