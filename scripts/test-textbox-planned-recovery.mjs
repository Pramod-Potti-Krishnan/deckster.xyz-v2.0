// Offline dispatcher/client and authoritative-theme tests. No live requests.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const repo = path.resolve(new URL('..', import.meta.url).pathname)
const baseline = process.env.TEXTBOX_RECOVERY_BASELINE_REF || 'ee532fab4b84a6883f8a5b50675ccab692b62240'
const sourceRoot = process.env.TEXTBOX_RECOVERY_SOURCE_ROOT || repo
const sourceAt = (file, ref) => ref
  ? execFileSync('git', ['show', `${ref}:${file}`], { cwd: repo, encoding: 'utf8' })
  : fs.existsSync(path.join(sourceRoot, file)) ? fs.readFileSync(path.join(sourceRoot, file), 'utf8')
    : execFileSync('git', ['show', `${process.env.TEXTBOX_RECOVERY_SOURCE_FALLBACK_REF}:${file}`], { cwd: repo, encoding: 'utf8' })
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve() }
function runtime({ ref, timeoutFlag, recoveryFlag, delay = 5_000, sessionDelay = 0 } = {}) {
  let now = 0, timerId = 0, uuid = 0, refCursor = 0, effectCursor = 0
  const timers = new Map(), refs = [], effectStates = [], pendingEffects = []
  const requests = [], commands = [], statuses = [], controllers = [], sessionSignals = []
  const panel = { blankElementId: 'blank-1', isOpen: true, elementType: 'TEXT_BOX', isGenerating: false,
    error: null, mode: 'generate', refineContext: null, researchMode: 'off', researchWeb: false,
    researchUploadedDocs: false, researchKnowledgeGraph: false }
  const blank = { elementId: 'blank-1', componentType: 'TEXT_BOX', slideIndex: 0,
    startCol: 2, startRow: 4, width: 10, height: 6, status: 'blank' }
  let theme = { status: 'applied', requestId: 'theme-1', presentationId: 'deck-1', themeFingerprint: 'theme-a', error: null }
  const setTimer = (fn, ms) => { const id = ++timerId; timers.set(id, { at: now + ms, fn }); return id }
  const clearTimer = id => timers.delete(id)
  class ClockDate extends Date { static now() { return now } }
  class TrackedController extends AbortController { constructor() { super(); controllers.push(this) } }
  const React = {
    useRef(value) { const i = refCursor++; return refs[i] ??= { current: value } },
    useCallback: fn => fn,
    useEffect(fn, deps) {
      const i = effectCursor++, previous = effectStates[i]
      if (!previous || deps.some((v, j) => !Object.is(v, previous.deps[j]))) {
        pendingEffects.push(() => { previous?.cleanup?.(); effectStates[i] = { deps, cleanup: fn() } })
      }
    },
  }
  const cache = new Map()
  const environment = { NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.example.test',
    NEXT_PUBLIC_STUDIO_V4_SHELL: process.env.TEXTBOX_RECOVERY_STUDIO_SHELL,
    NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED: process.env.TEXTBOX_RECOVERY_STUDIO_SHELL,
    NEXT_PUBLIC_TEXTBOX_PLANNED_TIMEOUT_ENABLED: timeoutFlag,
    NEXT_PUBLIC_ELEMENT_THEME_PREFLIGHT_RECOVERY_ENABLED: recoveryFlag }
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }; cache.set(file, mod.exports)
    const compiled = ts.transpileModule(sourceAt(file, ref), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
    } }).outputText
    vm.runInNewContext(compiled, { module: mod, exports: mod.exports, React,
      process: { env: environment }, Date: ClockDate, setTimeout: setTimer, clearTimeout: clearTimer,
      AbortController: TrackedController, AbortSignal, DOMException, FormData, Blob, URL,
      crypto: { randomUUID: () => `synthetic-${++uuid}` },
      console: { log() {}, warn() {}, error() {}, info() {} }, Error,
      fetch: async (url, init = {}) => {
        if (!url.includes('textlabs.example.test')) return { ok: true, json: async () => ({ primary: '#123456' }) }
        requests.push({ body: JSON.parse(init.body), signal: init.signal, at: now })
        return await new Promise((resolve, reject) => {
          const id = setTimer(() => resolve({ ok: true, headers: { get: () => null }, json: async () => ({
            success: true, elements: [{ component_type: 'TEXT_BOX', html: '<div>synthetic result</div>' }],
          }) }), delay)
          const abort = () => { clearTimer(id); reject(new DOMException('Aborted', 'AbortError')) }
          if (init.signal.aborted) abort()
          else init.signal.addEventListener('abort', abort, { once: true })
        })
      },
      require: id => {
        if (id === 'react') return React
        const relative = id.startsWith('@/') ? id.slice(2) : id.startsWith('.') ? path.normalize(path.join(path.dirname(file), id)) : null
        if (relative) return load(relative + '.ts')
        throw new Error(`Unexpected non-source dependency: ${id}`)
      },
    }, { filename: file })
    cache.set(file, mod.exports); return mod.exports
  }
  const methods = {
    setIsGenerating: value => { panel.isGenerating = value },
    setError: value => { panel.error = value }, setRetryStrategy: () => {},
    getSnapshot: () => ({ ...panel }), closePanel: () => { panel.isOpen = false },
    rememberDraftForElement: () => {}, openPanelForElement: () => {}, resumePanelForElement: () => {},
    openPanelForRefine: () => {}, completeBlankReplacement: () => { panel.mode = 'refine' }, changeElementType: () => {},
  }
  const params = {
    presentationId: 'deck-1', currentSlideIndex: 0, researchCapabilities: {},
    generationPanel: null,
    blankElements: { getElement: id => id === blank.elementId ? blank : undefined,
      updatePosition: () => {}, updateGenerationMetadata: () => {}, setStatus: (_id, status) => { blank.status = status; statuses.push(status) },
      removeElement: () => { blank.status = 'removed' }, addElement: () => {}, trackElement: () => {} },
    textLabsSession: { ensureSession: async signal => {
      sessionSignals.push(signal)
      if (sessionDelay) await new Promise((resolve, reject) => {
        setTimer(resolve, sessionDelay)
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
      return 'synthetic-session'
    } },
    layoutServiceApis: { sendElementCommand: async (action, args) => {
      commands.push({ action, args: JSON.parse(JSON.stringify(args)) })
      if (action === 'getElementGeometry') return { success: true, action, elementId: args.elementId,
        position: { gridRow: '4/10', gridColumn: '2/12' } }
      if (action === 'refreshElementThemeMetadata') return { themeVariantId: 'variant', themeBindings: { text: '--theme-text' } }
      return { success: true, elementId: action.startsWith('insert') || action.startsWith('upsert') ? 'generated-1' : args.elementId }
    } },
    getThemeSyncSnapshot: () => theme,
    ensureThemeReady: async () => ({ ready: true, source: 'director', sync: theme }), toast: () => {},
  }
  params.layoutServiceApis.captureStudioElementGeneration = () => ({ sendElementCommand: params.layoutServiceApis.sendElementCommand, isCurrent: () => params.presentationId === 'deck-1' })
  const hook = load('hooks/use-textlabs-generation.ts').useTextLabsGeneration
  let api
  function render() {
    refCursor = 0; effectCursor = 0
    params.generationPanel = { ...panel, ...methods }
    api = hook(params)
    while (pendingEffects.length) pendingEffects.shift()()
    return api
  }
  render()
  async function advance(ms) {
    await flush()
    const end = now + ms
    while (true) {
      const entry = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!entry) break
      now = entry[1].at; timers.delete(entry[0]); entry[1].fn(); await flush()
    }
    now = end; await flush()
  }
  const form = () => ({ componentType: 'TEXT_BOX', prompt: 'synthetic three sections', structure: 'SECTIONS', count: 1, useDeckTheme: false, textboxConfig: {}, compose: false,
    positionConfig: { start_col: 2, start_row: 4, position_width: 10, position_height: 6, auto_position: false } })
  return { load, render, params, panel, blank, requests, commands, statuses, controllers, sessionSignals, form,
    advance, flush, get api() { return api }, get now() { return now }, get theme() { return theme }, set theme(value) { theme = value },
    unmount: () => effectStates.forEach(effect => effect?.cleanup?.()),
    summary: () => JSON.parse(JSON.stringify({ requests: requests.map(x => ({ body: x.body, at: x.at, aborted: x.signal.aborted })), commands,
      statuses, panel: { error: panel.error, isGenerating: panel.isGenerating, mode: panel.mode }, blank: blank.status })),
    pageFunctions: () => {
      const page = sourceAt('app/builder/page.tsx', ref)
      const ast = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const declarations = {}
      function visit(node) {
        if (ts.isVariableDeclaration(node) && ['ensureThemeReady', 'requestThemeSyncForPresentation'].includes(node.name.getText(ast))) {
          declarations[node.name.getText(ast)] = node.initializer.getText(ast)
        }
        ts.forEachChild(node, visit)
      }
      visit(ast)
      const themeLib = load('lib/theme-sync.ts'), builder = load('lib/theme-builder.ts')
      const selection = { mode: 'auto' }, fingerprint = builder.themeSelectionFingerprint(selection)
      theme = { ...theme, status: 'failed', themeFingerprint: fingerprint, error: 'Theme application timed out.' }
      const target = { current: { presentationId: 'deck-1', isReady: true, selection, composerThemeBlocked: false, composerThemeFrozen: false, templateModeOn: false } }
      const wsSends = [], latest = { current: theme.requestId }, latestKey = { current: null }, timeout = { current: null }
      const localChange = { current: false }, transport = { sendWorks: true }
      const context = { ...themeLib, themeSelectionFingerprint: builder.themeSelectionFingerprint,
        process: { env: environment }, useCallback: fn => fn, themeSyncTargetRef: target, themeSyncRef: { get current() { return theme } },
        latestThemeSyncRequestRef: latest, latestThemeSyncKeyRef: latestKey, themeSyncTimeoutRef: timeout,
        getThemeSyncSnapshot: () => theme, commitThemeSync: next => { theme = next },
        clearThemeSyncTimeout: () => clearTimer(timeout.current),
        sendThemeSelection: (_selection, id, presentation) => { wsSends.push({ id, presentation }); return transport.sendWorks },
        crypto: { randomUUID: () => `theme-retry-${++uuid}` }, setTimeout: setTimer, clearTimeout: clearTimer,
        THEME_SYNC_TIMEOUT_MS: 20_000, LAYOUT_SERVICE_URL: 'https://layout.example.test', getLayoutServiceUrl: () => 'https://layout.example.test',
        studioShell: environment.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true', themeSelectionChangedLocallyRef: localChange,
      }
      const mod = { exports: {} }
      const fragment = `const requestThemeSyncForPresentation=${declarations.requestThemeSyncForPresentation}; const ensureThemeReady=${declarations.ensureThemeReady}; module.exports={ensureThemeReady};`
      vm.runInNewContext(ts.transpileModule(fragment, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
        { ...context, module: mod, exports: mod.exports })
      return { ensure: mod.exports.ensureThemeReady, wsSends, target, localChange, transport, retry: () => ({ presentationId: 'deck-1', requestId: theme.requestId, themeFingerprint: fingerprint }) }
    },
  }
}

function inputMarkup(error, ref) {
  const mod = { exports: {} }, source = sourceAt('components/generation-panel/shared/generation-input.tsx', ref)
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText, {
    module: mod, exports: mod.exports, React, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: process.env.TEXTBOX_RECOVERY_STUDIO_SHELL } }, require: id => {
      if (id.endsWith('.css')) return {}
      if (id === 'react') return { ...React, useRef: () => ({ current: null }), useEffect: () => {} }
      if (id === 'lucide-react') return new Proxy({}, { get: () => () => null })
      if (id === '@/components/ui/popover') return {}
      if (id === '@/lib/element-prompt-limit') return { elementPromptLengthState: () => ({ overLimit: false, overflow: 0 }) }
      throw new Error(`Unexpected generation input dependency: ${id}`)
    },
  })
  return renderToStaticMarkup(mod.exports.GenerationInput({ prompt: 'synthetic retained prompt', onPromptChange() {}, mandatoryConfig: null,
    showAdvanced: false, onToggleAdvanced() {}, onSubmit() {}, isGenerating: false, error }))
}

async function success(options) {
  const h = runtime(options), work = h.api.handleGenerate(h.form())
  await h.advance((options?.sessionDelay || 0) + (options?.delay || 5_000)); await work
  return h
}
const pristine = await success({ ref: baseline })
assert.equal(pristine.requests.length, 1)
assert.equal(pristine.panel.error, null)
for (const literal of [undefined, 'false', '1', 'TRUE']) {
  const off = await success({ timeoutFlag: literal, recoveryFlag: literal })
  assert.deepEqual(off.summary(), pristine.summary(), `strict off flags preserve request/command/error output: ${literal}`)
  assert.equal(inputMarkup(off.panel.error), inputMarkup(pristine.panel.error, baseline), 'flag-off actual input DOM serialization is identical')
}
const delayed = runtime({ timeoutFlag: 'true', delay: 25_000, sessionDelay: 20_000 })
const work = delayed.api.handleGenerate(delayed.form())
const concurrent = delayed.api.handleGenerate(delayed.form())
await delayed.advance(45_000); await Promise.all([work, concurrent])
assert.equal(delayed.requests.length, 1, 'repeated submit joins/suppresses before paid dispatch')
assert.equal(delayed.controllers.length, 1, 'one shared abort controller spans session and message')
assert.equal(delayed.sessionSignals[0], delayed.requests[0].signal)
assert.equal(delayed.blank.status, 'removed', 'only successful acknowledged insertion retires original blank')
assert.ok(delayed.commands.some(x => x.action === 'insertTextBox' || x.action === 'upsertSemanticElement'))
assert.equal(delayed.panel.error, null)
const sharedDeadline = runtime({ timeoutFlag: 'true', sessionDelay: 100_000, delay: 100_000 })
const deadlineWork = sharedDeadline.api.handleGenerate(sharedDeadline.form())
await sharedDeadline.advance(180_000); await deadlineWork
assert.equal(sharedDeadline.requests.length, 1)
assert.equal(sharedDeadline.requests[0].at, 100_000)
assert.equal(sharedDeadline.requests[0].signal.aborted, true, 'session time consumes the same absolute browser budget')
assert.equal(sharedDeadline.blank.status, 'blank')

for (const [flag, limit] of [[undefined, 30_000], ['true', 180_000]]) {
  const h = runtime({ timeoutFlag: flag, delay: 190_000 })
  const pending = h.api.handleGenerate(h.form())
  await h.advance(limit); await pending
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].signal.aborted, true)
  assert.equal(h.blank.status, 'blank'); assert.match(h.panel.error, /timed out/i)
  assert.equal(h.panel.isGenerating, false)
  assert.equal(h.commands.some(x => x.action === 'deleteElement' || x.action === 'insertTextBox'), false)
  if (!flag) {
    const base = runtime({ ref: baseline, delay: 190_000 }), baseWork = base.api.handleGenerate(base.form())
    await base.advance(limit); await baseWork
    assert.deepEqual(h.summary(), base.summary(), 'flag-off actual abort/recovery/error parity')
    assert.equal(inputMarkup(h.panel.error), inputMarkup(base.panel.error, baseline))
  }
}
const cancelled = runtime({ timeoutFlag: 'true', delay: 45_000 })
const cancelWork = cancelled.api.handleGenerate(cancelled.form()); await cancelled.flush()
cancelled.controllers[0].abort(); await cancelWork
assert.equal(cancelled.blank.status, 'blank'); assert.equal(cancelled.requests.length, 1)
const unmounted = runtime({ timeoutFlag: 'true', delay: 45_000 })
const unmountWork = unmounted.api.handleGenerate(unmounted.form()); await unmounted.flush()
unmounted.unmount(); await unmounted.advance(45_000); await unmountWork
assert.equal(unmounted.commands.some(x => x.action === 'insertTextBox' || x.action === 'upsertSemanticElement'), false)
const navigated = runtime({ timeoutFlag: 'true', delay: 45_000 })
const navWork = navigated.api.handleGenerate(navigated.form()); await navigated.flush()
navigated.params.presentationId = 'deck-2'; navigated.render(); await navigated.advance(45_000); await navWork
assert.equal(navigated.commands.some(x => x.action === 'insertTextBox'), false, 'retired presentation cannot receive result')
const changedTheme = runtime({ timeoutFlag: 'true', delay: 45_000 })
const themeWork = changedTheme.api.handleGenerate({ ...changedTheme.form(), useDeckTheme: true }); await changedTheme.flush()
changedTheme.theme = { ...changedTheme.theme, themeFingerprint: 'changed-theme' }
await changedTheme.advance(45_000); await themeWork
assert.equal(changedTheme.commands.some(x => x.action === 'insertTextBox' || x.action === 'upsertSemanticElement'), false)

async function themeFailure(flag, ref) {
  const h = runtime({ recoveryFlag: flag, ref })
  h.theme = { ...h.theme, status: 'failed', error: 'Theme application timed out.' }
  const readinessCalls = []
  h.params.ensureThemeReady = async (...args) => { readinessCalls.push(args); return { ready: false, code: 'failed', error: 'Theme application timed out.', sync: { ...h.theme } } }
  h.render(); await h.api.handleGenerate({ ...h.form(), useDeckTheme: true }); h.render()
  assert.equal(h.requests.length, 0); assert.equal(h.blank.status, 'blank'); assert.equal(h.panel.isGenerating, false)
  return { h, readinessCalls }
}
const baseFailure = await themeFailure(undefined, baseline)
const offFailure = await themeFailure('false')
assert.deepEqual(offFailure.h.summary(), baseFailure.h.summary(), 'off theme failure/placeholder/overlay parity')
assert.equal(inputMarkup(offFailure.h.panel.error), inputMarkup(baseFailure.h.panel.error, baseline))
offFailure.h.theme = { ...offFailure.h.theme, status: 'applied', error: null }; offFailure.h.render()
assert.equal(offFailure.h.panel.error, 'Theme application timed out.', 'flag off preserves stale error behavior')
const recovered = await themeFailure('true')
recovered.h.theme = { ...recovered.h.theme, status: 'applied', error: null }; recovered.h.render()
assert.equal(recovered.h.panel.error, 'Deck theme is now ready. Try again to generate this element.')
assert.equal(recovered.h.requests.length, 0, 'late ACK cannot automatically generate')
const ackRace = runtime({ recoveryFlag: 'true' })
ackRace.theme = { ...ackRace.theme, status: 'failed', error: 'Theme application timed out.' }
ackRace.params.ensureThemeReady = async () => {
  const failedSync = { ...ackRace.theme }
  ackRace.theme = { ...ackRace.theme, status: 'applied', error: null }
  return { ready: false, code: 'failed', error: failedSync.error, sync: failedSync }
}
ackRace.render(); await ackRace.api.handleGenerate({ ...ackRace.form(), useDeckTheme: true }); ackRace.render()
assert.equal(ackRace.panel.error, 'Deck theme is now ready. Try again to generate this element.', 'ACK between failure and publication still recovers exact failed handshake')
assert.equal(ackRace.requests.length, 0)
const blocked = runtime({ recoveryFlag: 'true' })
blocked.params.ensureThemeReady = async () => ({ ready: false, code: 'failed', error: 'Template policy blocks this operation.' })
blocked.render(); await blocked.api.handleGenerate({ ...blocked.form(), useDeckTheme: true })
blocked.theme = { ...blocked.theme, status: 'applied' }; blocked.render()
assert.equal(blocked.panel.error, 'Template policy blocks this operation.', 'guard errors without a failed handshake are never converted to ready')
recovered.h.render(); await recovered.h.api.handleGenerate({ ...recovered.h.form(), useDeckTheme: true }, 'retry')
assert.equal(recovered.readinessCalls.at(-1).length, 2, 'explicit Retry forwards failed authority context')
assert.equal(recovered.readinessCalls.at(-1)[1].requestId, 'theme-1')
for (const mutation of [h => { h.theme = { ...h.theme, requestId: 'unrelated', status: 'applied' } },
  h => { h.theme = { ...h.theme, themeFingerprint: 'different', status: 'applied' } },
  h => { h.params.presentationId = 'deck-2' }, h => { h.panel.blankElementId = 'blank-2' },
  h => { h.panel.error = 'A newer different failure' }, h => { h.panel.isOpen = false }]) {
  const { h } = await themeFailure('true'); mutation(h); const error = h.panel.error; h.render()
  assert.equal(h.panel.error, error, 'unrelated or retired context cannot dismiss/replace failure')
  assert.equal(h.requests.length, 0)
}

const handshake = runtime({ recoveryFlag: 'true' }), page = handshake.pageFunctions()
const retry = page.retry(), ready = page.ensure('deck-1', retry)
const sharedReady = page.ensure('deck-1', retry)
await handshake.flush(); assert.equal(page.wsSends.length, 1)
handshake.theme = { ...handshake.theme, status: 'applied', error: null }
await handshake.advance(50); assert.equal((await ready).ready, true)
assert.equal((await sharedReady).ready, true)
assert.equal(page.wsSends.length, 1, 'explicit failed-handshake retry sends once; wait reuses it')
const missing = runtime({ recoveryFlag: 'true' }), missingPage = missing.pageFunctions()
const missingWait = missingPage.ensure('deck-1', missingPage.retry())
await missing.advance(20_000); assert.equal((await missingWait).ready, false); assert.equal(missingPage.wsSends.length, 1)
for (const guard of ['composerThemeBlocked', 'templateModeOn']) {
  const h = runtime({ recoveryFlag: 'true' }), p = h.pageFunctions(); p.target.current[guard] = true
  const result = await p.ensure('deck-1', p.retry()); assert.equal(result.ready, false); assert.equal(p.wsSends.length, 0)
}
const local = runtime({ recoveryFlag: 'true' }), localPage = local.pageFunctions()
local.theme = { ...local.theme, requestId: null }
assert.equal((await localPage.ensure('deck-1', { ...localPage.retry(), requestId: 'old' })).ready, false)
assert.equal(localPage.wsSends.length, 0, 'pending local theme cannot use retry to bypass readiness')
const disconnected = runtime({ recoveryFlag: 'true' }), disconnectedPage = disconnected.pageFunctions()
disconnectedPage.transport.sendWorks = false
assert.equal((await disconnectedPage.ensure('deck-1', disconnectedPage.retry())).code, 'disconnected')
assert.equal(disconnectedPage.wsSends.length, 1)
if (process.env.TEXTBOX_RECOVERY_STUDIO_SHELL === 'true') {
  const h = runtime({ recoveryFlag: 'true' }), p = h.pageFunctions(); p.localChange.current = true
  assert.equal((await p.ensure('deck-1', p.retry())).ready, false)
  assert.equal(p.wsSends.length, 0, 'Studio locally changed failed-theme guard is preserved')
}
const budgets = runtime({ timeoutFlag: 'true' }).load('lib/element-generation-timeout.ts')
assert.equal(budgets.resolveElementGenerationTimeoutMs('TEXT_BOX', 'on'), 150_000)
assert.equal(budgets.resolveElementGenerationTimeoutMs('DIAGRAM_AUTO', 'off'), 150_000)
assert.equal(budgets.resolveElementGenerationTimeoutMs('INFOGRAPHIC', 'off'), 300_000)
assert.equal(budgets.resolveElementGenerationTimeoutMs('TABLE', 'off'), 30_000)
console.log('Text-box planned budget, strict-off parity, actual dispatcher/client, singleflight, recovery and authoritative theme retry tests passed')
