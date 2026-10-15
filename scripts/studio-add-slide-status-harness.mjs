// PASS2B J2-04 harness (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS): shared by scripts/test-studio-add-slide-status.mjs and
// scripts/render-studio-add-slide-status.mjs. Offline: no network, no browser, no service, no key.
//
// What runs here is the shipped code, not a copy of it:
//   - the Add Slide panel (components/studio-add-slide-v2.tsx) under a tiny hooks runtime;
//   - the page's own handlers and wiring, cut out of app/builder/page.tsx by AST and run in a vm: handleSlideComposerAccepted,
//     onSlideComposeReady, onSlideComposeFailed, handleRetrySlideCompose, removeSlideComposeJob, narrationNavigate, the thumbnail-job
//     memo the rail draws, the createAddSlideV2Hooks({...}) call and the `status:` entry of addSlideV2Settings;
//   - the viewer's own command wrappers (handleComposePlaceholderAdd / handleComposeSlideReconcile / handleComposePlaceholderFail /
//     handleGoToSlide), cut out of components/presentation-viewer.tsx by AST;
//   - the frames: Director's real slide_ready / slide_failed frames and the accepted bodies (director-frames.json), and every answer
//     the Layout Service gives to the viewer commands (layout-viewer-replies.json), both recorded from the real services by the
//     record-*.py scripts next to them. The viewer commands the page sends must equal, parameter for parameter, the ones that were
//     sent to the real viewer when the replies were recorded.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

export const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
export const React = nodeRequire('react')
export const { renderToStaticMarkup } = nodeRequire('react-dom/server')
export const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
export const FIXTURES = 'scripts/fixtures/studio-add-slide-status'
export const readFixture = name => JSON.parse(read(`${FIXTURES}/${name}`))

// ---------------------------------------------------------------- loading TypeScript modules
export function compile(source, fileName = 'module.tsx') {
  return ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
}
/** Same realm as the caller, so deepEqual compares plain objects. `imports`: specifier -> module (anything else is refused). */
export function load(source, { env = {}, imports = {} } = {}) {
  const module = { exports: {} }
  new Function('module', 'exports', 'process', 'require', compile(source))(module, module.exports, { env }, name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`)
    return imports[name]
  })
  return module.exports
}
export function loadLibs({ env = {}, sources = {} } = {}) {
  const src = rel => sources[rel] ?? read(rel)
  const add = load(src('lib/studio-add-slide-v2.ts'), { env })
  const regenerate = load(src('lib/studio-add-slide-v2-regenerate.ts'), { env })
  const status = load(src('lib/studio-add-slide-status.ts'), { env })
  const async_ = load(src('lib/slide-compose-async.ts'), { env })
  const submit = load(src('lib/studio-add-slide-v2-submit.ts'), { env, imports: {
    '@/lib/slide-compose-async': async_,
    '@/lib/element-generation-timeout': load(src('lib/element-generation-timeout.ts'), { env }),
    '@/components/slide-generation-panel/compose-helpers': load(src('components/slide-generation-panel/compose-helpers.ts'), { env }),
    '@/lib/studio-add-slide-v2': add,
  } })
  return { add, regenerate, status, async: async_, submit }
}

// ---------------------------------------------------------------- the panel under a tiny hooks runtime
const noop = () => null
export function loadPanel(source, libs, { realIcons = false } = {}) {
  const icon = name => realIcons ? props => React.createElement(nodeRequire('lucide-react')[name], props) : noop
  let cursor = 0, dirty = false
  const slotsRef = { slots: [] }, queued = []
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const hooks = {
    useState(init) {
      const i = cursor++, slots = slotsRef.slots
      if (!(i in slots)) slots[i] = { value: typeof init === 'function' ? init() : init }
      return [slots[i].value, v => { const next = typeof v === 'function' ? v(slots[i].value) : v; if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true } }]
    },
    useReducer(reducer, arg, init) {
      const i = cursor++, slots = slotsRef.slots
      if (!(i in slots)) slots[i] = { value: init ? init(arg) : arg }
      return [slots[i].value, action => { const next = reducer(slots[i].value, action); if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true } }]
    },
    useRef(init) { const i = cursor++, slots = slotsRef.slots; if (!(i in slots)) slots[i] = { current: init }; return slots[i] },
    useMemo(fn, deps) { const i = cursor++, slots = slotsRef.slots; if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value },
    useId() { return ':r0:' }, // one per panel; React derives it from the tree position, not from the hook count
    useEffect(setup, deps) {
      const i = cursor++, slots = slotsRef.slots
      if (!same(slots[i]?.deps, deps)) { const prev = slots[i]; slots[i] = { deps }; queued.push(() => { prev?.cleanup?.(); const cleanup = setup(); if (typeof cleanup === 'function') slots[i].cleanup = cleanup }) }
    },
  }
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
  const mod = load(source, { imports: {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-dom': { createPortal: (node, host) => ({ portal: true, host, node }) },
    'lucide-react': { Layout: icon('Layout'), Plus: icon('Plus'), RefreshCw: icon('RefreshCw'), Sparkles: icon('Sparkles'), Square: icon('Square'), X: icon('X') },
    '@/lib/utils': { cn: (...a) => a.filter(Boolean).join(' ') }, '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [] },
    '@/lib/studio-add-slide-v2': libs.add, '@/lib/studio-add-slide-v2-regenerate': libs.regenerate,
    '@/components/builder/studio-panels.css': {}, './studio-add-slide-v2.css': {},
  } })
  return { mod, hooks, slotsRef, queued, takeDirty: () => { const d = dirty; dirty = false; return d }, resetCursor: () => { cursor = 0 } }
}

/** Mount the panel. `props` is read at every render, so a test (or the page world) can change it between renders. */
export function mountPanel(source, libs, props, options = {}) {
  const runtime = loadPanel(source, libs, options)
  const fakeWindow = { sessionStorage: null, addEventListener() {}, removeEventListener() {} }
  let tree
  function attachRefs(node) {
    if (!node || typeof node !== 'object') return
    const ref = node.props?.ref
    if (ref && typeof ref === 'object' && !ref.current) ref.current = { focus() {}, closest: () => null, querySelector: () => null }
    const c = node.props?.children
    for (const child of Array.isArray(c) ? c.flat(Infinity) : [c]) attachRefs(child)
  }
  const rt = {
    props,
    /** Render until a pass sets no state (the panel stores the status line during the render itself). */
    render() {
      const prev = globalThis.window
      globalThis.window = fakeWindow
      try {
        runtime.takeDirty()
        let passes = 0
        do {
          runtime.resetCursor()
          tree = runtime.mod.AddSlideV2Panel({ ...rt.props })
          attachRefs(tree)
          while (runtime.queued.length) runtime.queued.shift()()
          assert.ok(++passes < 30, 'the panel did not settle')
        } while (runtime.takeDirty())
      } finally { if (prev === undefined) delete globalThis.window; else globalThis.window = prev }
      return tree
    },
    get tree() { return tree },
    all(pred) {
      const out = []
      const walk = node => { if (!node || typeof node !== 'object') return; if (pred(node)) out.push(node); const c = node.props?.children; for (const child of Array.isArray(c) ? c.flat(Infinity) : [c]) walk(child) }
      walk(tree)
      return out
    },
    one(pred, label = 'node') { const hits = rt.all(pred); assert.equal(hits.length, 1, `exactly one ${label} (got ${hits.length})`); return hits[0] },
    byClass: name => rt.one(n => hasClass(n, name), `.${name}`),
    maybeClass: name => rt.all(n => hasClass(n, name))[0] ?? null,
    button: label => rt.one(n => n.type === 'button' && textOf(n).trim() === label, `button "${label}"`),
    maybeButton: label => rt.all(n => n.type === 'button' && textOf(n).trim() === label)[0] ?? null,
    statusLine: () => rt.all(n => n.props && 'data-add-slide-status' in n.props)[0] ?? null,
    queuedLine: () => rt.all(n => n.type === 'p' && hasClass(n, 'asv2-queued') && !hasClass(n, 'asv2-status'))[0] ?? null,
    type(value) { rt.one(n => n.type === 'textarea', 'textarea').props.onChange({ target: { value } }); rt.render() },
    async click(node) { node.props.onClick(); await settle(); rt.render() },
    html: () => toHtml(tree, options),
    text: () => textOf(tree),
  }
  rt.render()
  return rt
}
const hasClass = (node, name) => typeof node.props?.className === 'string' && node.props.className.split(/\s+/).includes(name)
export async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); await new Promise(r => setTimeout(r, 0)) }

export function textOf(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node.portal) return textOf(node.node)
  return textOf(node.props?.children)
}

/** The tiny runtime's tree as HTML, for hashes and for the screenshots (icons are the stubs' null unless realIcons). */
export function toHtml(node, options = {}) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return escapeHtml(String(node))
  if (Array.isArray(node)) return node.map(n => toHtml(n, options)).join('')
  if (node.portal) return toHtml(node.node, options)
  if (typeof node.type === 'function') return options.realIcons ? renderToStaticMarkup(node.type(node.props)) : toHtml(node.type(node.props), options)
  if (node.type === 'Fragment') return toHtml(node.props.children, options)
  const attrs = Object.entries(node.props).filter(([k, v]) => !['children', 'ref', 'key'].includes(k) && typeof v !== 'function' && v !== undefined && v !== false && v !== null)
    .map(([k, v]) => v === true ? ` ${attrName(k)}=""` : ` ${attrName(k)}="${escapeHtml(String(v))}"`).join('')
  const VOID = new Set(['input', 'br', 'img'])
  return VOID.has(node.type) ? `<${node.type}${attrs}>` : `<${node.type}${attrs}>${toHtml(node.props.children, options)}</${node.type}>`
}
const attrName = k => ({ className: 'class', htmlFor: 'for', readOnly: 'readonly', tabIndex: 'tabindex' }[k] ?? k)
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------------------------------------------------------------- AST helpers
export const parse = (text, name = 'file.tsx') => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
export function find(root, predicate) {
  if (predicate(root)) return root
  let match
  ts.forEachChild(root, child => { if (!match) match = find(child, predicate) })
  return match
}
const printer = ts.createPrinter({ removeComments: true })
export const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source)
const decl = (source, name) => find(source, n => ts.isVariableDeclaration(n) && n.name.getText(source) === name)?.initializer
/** `const name = useCallback(fn, deps)` / `useMemo(fn, deps)`: the function. */
export const hookFn = (source, name) => {
  const call = decl(source, name)
  assert.ok(call, `${name} is declared`)
  return call.arguments[0]
}
export const fnDecl = (source, name) => find(source, n => ts.isFunctionDeclaration(n) && n.name?.text === name)
export const prop = (source, name) => find(source, n => ts.isPropertyAssignment(n) && n.name.getText(source) === name)?.initializer

// ---------------------------------------------------------------- recorded replay of the real viewer
/**
 * Every command goes to the next recorded command with the same action; its parameters must equal what was sent to the real viewer.
 * `read(action)` hands the test the next recorded answer of an action the page itself never sends (composeGetState, getCurrentSlideInfo, ...).
 */
export function createViewerReplay(scenario) {
  const queues = new Map()
  for (const step of scenario.steps) if (step.do === 'command') queues.set(step.action, [...(queues.get(step.action) ?? []), step])
  const log = []
  const json = v => JSON.parse(JSON.stringify(v ?? {}))
  const take = action => {
    const step = queues.get(action)?.shift()
    assert.ok(step, `no recorded ${action} left: the page sent a command the real viewer was never sent`)
    return step
  }
  return {
    log,
    async sendCommand(_iframe, action, params, options) {
      const step = take(action)
      assert.deepEqual(json(params), step.params, `${action}: the parameters the page sends equal the ones recorded against the real viewer`)
      if (options?.expectedJobId) assert.equal(options.expectedJobId, step.params.job_id, `${action}: the expected job`)
      log.push({ action, params: json(params) })
      if (step.reply.success) return json(step.reply)
      throw new Error(step.reply.error || 'Command failed')
    },
    read: action => take(action),
    unconsumed: () => [...queues].flatMap(([action, steps]) => steps.map(() => action)),
  }
}

// ---------------------------------------------------------------- the page world
/**
 * A Studio page holding one deck, one session and no jobs, with the panel mounted on it. `scenario` names the recorded run
 * ("generate-ready" or "fail-retry-ready"). `sources` overrides file text (mutation checks); `env` is the build environment.
 */
export function createPageWorld({ scenario, env = {}, sources = {}, panelSource, realIcons = false, disabled = false } = {}) {
  const layoutFixture = readFixture('layout-viewer-replies.json')
  const directorFixture = readFixture('director-frames.json')
  const layout = layoutFixture.scenarios[scenario]
  const director = directorFixture.scenarios[scenario]
  assert.ok(layout && director, `recorded scenario ${scenario}`)
  const pid = layout.presentation_id
  const sessionId = directorFixture._provenance.session_id
  const libs = loadLibs({ env, sources })
  const src = rel => sources[rel] ?? read(rel)
  const pageText = src('app/builder/page.tsx')
  const page = parse(pageText, 'page.tsx')
  const viewerText = src('components/presentation-viewer.tsx')
  const viewer = parse(viewerText, 'presentation-viewer.tsx')

  const replay = createViewerReplay(layout)
  const events = []
  const jobIds = director.frames.filter(f => f.at === 'accepted' || f.at === 'retry-accepted').map(f => f.body.job_id)
  const state = { jobs: {} }
  const noopStamp = () => ({})

  // The viewer's own wrappers and go-to, with the replay in place of the iframe round trip.
  const viewerCtx = {
    studioShell: true, iframeRef: { current: { replay: true } }, viewerInteractionIntentRef: { current: 0 }, nativeSnapshotStructureEditedRef: { current: false },
    sendCommand: replay.sendCommand, postCommand: () => events.push(['postCommand']), debugLog: () => {}, console, setTimeout,
    beginStudioManualSlideNavigation: () => ({ cancel() {}, capture: async () => {} }),
    beginStudioViewerInteraction: () => ({ iframe: { replay: true }, isCurrent: () => true }),
    setCurrentSlide: () => {}, snapshotSelectionRef: { current: null },
    onSlideChangeRef: { current: slideNumber => { ctx.currentSlideIndexRef.current = slideNumber - 1; events.push(['viewer-slide-change', slideNumber]) } },
  }
  vm.createContext(viewerCtx)
  const evalIn = (context, code) => vm.runInContext(compile(code), context)
  const viewerFn = name => { evalIn(viewerCtx, `globalThis.${name} = ${print(hookFn(viewer, name), viewer)};`); return viewerCtx[name] }
  const composeViewerApi = {
    composePlaceholderAdd: viewerFn('handleComposePlaceholderAdd'),
    composeSlideReconcile: viewerFn('handleComposeSlideReconcile'),
    composePlaceholderFail: viewerFn('handleComposePlaceholderFail'),
  }
  const viewerGoToSlide = viewerFn('handleGoToSlide')

  const ctx = {
    ...libs.async, ...pureLib('lib/builder-presentation-ownership.ts', src), ...pureLib('lib/slide-compose-job-recovery.ts', src), ...pureLib('lib/stage-f-thumbnails.ts', src),
    ...libs.add, createAddSlideV2Hooks: libs.submit.createAddSlideV2Hooks, createAddSlideV2StatusSettings: libs.status.createAddSlideV2StatusSettings,
    STUDIO_ADD_SLIDE_STATUS_ENABLED: libs.status.STUDIO_ADD_SLIDE_STATUS_ENABLED,
    process: { env: { ...env } }, console: { warn: (...a) => events.push(['warn', ...a]), error: (...a) => events.push(['error', ...a]), log() {} },
    studioShell: true, presentationId: pid, effectivePresentationId: pid, effectiveSlideCount: 3, selectedLayoutSlideIndex: 1,
    features: { slideComposerEnabled: true, slideComposerAsyncEnabled: true },
    currentSessionIdRef: { current: sessionId }, currentSlideIndexRef: { current: 1 },
    slideComposerPresentationRef: { current: { presentationId: pid, presentationUrl: `http://layout.invalid/p/${pid}`, slideCount: 3, activeVersion: 'final', refreshToken: 0 } },
    slideComposeJobsRef: { current: {} }, slideComposeWatchdogsRef: { current: {} }, studioSlideComposeCountsRef: { current: { [pid]: 3 } },
    studioSlideComposeOwnerRef: { current: { key: 'A', sessionId, presentationId: pid, activeVersion: 'final' } },
    questionSubmissionScopeRef: { current: { active: true, generation: 0, sessionId, userId: 'owner' } },
    pendingComposePlaceholdersRef: { current: new Map() }, pendingComposeSelectionRestoreRef: { current: null },
    addSlideV2FollowRef: { current: new Map() }, composeViewerApiRef: { current: composeViewerApi },
    persistenceRef: { current: { updateMetadata: v => events.push(['persist', v]) } },
    scTrace: () => {}, toast: v => events.push(['toast', v.title, v.description]), setSlideComposePanelEvent: v => events.push(['panel-event', v]),
    clearSlideComposeWatchdog: id => events.push(['clear-watchdog', id]), clearSlideComposePoller: id => events.push(['clear-poller', id]),
    startStudioSlideComposeWatchdog: id => events.push(['start-watchdog', id]), startSlideComposePoller: id => events.push(['start-poller', id]),
    triggerCoalescedSlideComposeReload: reason => events.push(['reload', reason]), confirmSlideComposeJobAfterRefresh: async id => { events.push(['confirm', id]); return false },
    SLIDE_COMPOSE_WATCHDOG_MS: 300000, STUDIO_BLANK_DECK_RELOAD_FIX_ENABLED: false, deckSlotUpdates: noopStamp,
    setReceivedSlideThumbnailUrlsByPresentation: () => {}, setSlideThumbnailUrlsByPresentation: () => {},
    setSlideComposerOverride: v => events.push(['override', v && v.slideCount]), setCurrentSlideIndex: v => events.push(['select', v]), setSelectedLayoutSlideIndex: () => {},
    enqueueSlideComposeReconcile: (key, task) => task(),
    crypto: { randomUUID: () => { const id = jobIds.shift(); assert.ok(id, 'a job id left to mint'); return id } },
    fetch: async (url, init) => fetchStub(url, init), window: { setTimeout: (fn, delay) => { events.push(['timer', delay]); return 1 } }, setTimeout,
    composeFailsafe: { decorate: card => card }, handleSelectPendingSlideCompose: () => {},
    layoutServiceApis: { goToSlide: viewerGoToSlide },
    get slideComposeJobs() { return state.jobs },
    setSlideComposeJobs: fn => { state.jobs = typeof fn === 'function' ? fn(state.jobs) : fn; ctx.slideComposeJobsRef.current = state.jobs; world.rerender() },
  }
  vm.createContext(ctx)
  const run = code => evalIn(ctx, code)
  const expose = (name, node) => run(`globalThis.${name} = ${print(node, page)};`)
  expose('captureStudioSlideComposeSessionOwner', fnDecl(page, 'captureStudioSlideComposeSessionOwner'))
  expose('captureStudioSlideComposeOwner', fnDecl(page, 'captureStudioSlideComposeOwner'))
  expose('queueComposeSelectionRestore', fnDecl(page, 'queueComposeSelectionRestore'))
  for (const name of ['removeSlideComposeJob', 'handleSlideComposerAccepted', 'handleRetrySlideCompose', 'narrationNavigate']) expose(name, hookFn(page, name))
  expose('onSlideComposeReady', prop(page, 'onSlideComposeReady'))
  expose('onSlideComposeFailed', prop(page, 'onSlideComposeFailed'))
  // The memo the rail's cards come from (their onRetry is the page's retry), and the two entries of addSlideV2Settings this slice adds.
  run(`globalThis.__thumbnailJobs = ${print(hookFn(page, 'slideComposeThumbnailJobs'), page)};`)
  Object.defineProperty(ctx, 'slideComposeThumbnailJobs', { get: () => ctx.__thumbnailJobs() })
  const settings = find(page, n => ts.isJsxAttribute(n) && n.name.getText(page) === 'addSlideV2Settings').initializer.expression.whenTrue
  const hooksCall = find(settings, n => ts.isSpreadAssignment(n) && n.expression.getText(page).startsWith('createAddSlideV2Hooks(')).expression
  const statusEntry = find(settings, n => ts.isPropertyAssignment(n) && n.name.getText(page) === 'status')?.initializer
  world_assert(hooksCall, 'the page calls createAddSlideV2Hooks in addSlideV2Settings')

  function fetchStub(url, init) {
    const body = JSON.parse(init.body)
    assert.equal(url, '/api/slides/compose', 'Generate and Try again both post to the compose route')
    assert.equal(body.async, true)
    const frame = director.frames.find(f => (f.at === 'accepted' || f.at === 'retry-accepted') && f.body.job_id === body.job_id)
    assert.ok(frame, `Director accepted the job ${body.job_id}`)
    assert.equal(body.session_id, frame.body.session_id)
    events.push(['compose-post', body.job_id, body.insert_after_index ?? null])
    return { ok: true, status: frame.http_status, json: async () => JSON.parse(JSON.stringify(frame.body)) }
  }

  const panelProps = {
    context: { sessionId, presentationId: pid, currentSlide: 2, slideCount: 3, research: { useUploadedDocuments: false, useWebSearch: false, useDeepResearch: false, useKnowledgeGraph: false }, theme: { mode: 'preset', preset_id: 'corporate_light' }, themeLabel: 'Corporate Light' },
    storage: null, onInsertBlank() {}, onClose() {}, disabled,
  }
  const world = {
    pid, sessionId, layout, director, replay, events, state, ctx, libs, panelProps,
    get panel() { return panel },
    /** What a page render does: fresh hooks and a fresh `status`, from the jobs as they are now. */
    rerender() {
      ctx.__hooks = run(`(${print(hooksCall, page)})`)
      panelProps.submit = ctx.__hooks.submit
      panelProps.status = statusEntry ? run(`(${print(statusEntry, page)})`) : undefined
      panel?.render()
    },
    frame(index) {
      const frames = director.frames.filter(f => f.at === 'ws')
      return libs.async.normalizeSlideComposeSocketFrame(JSON.parse(JSON.stringify(frames[index].frame)))
    },
    async deliverReady(index) { const task = ctx.onSlideComposeReady(world.frame(index)); await settle(); return task },
    async deliverFailed(index) { ctx.onSlideComposeFailed(world.frame(index)); await settle() },
    jobs: () => JSON.parse(JSON.stringify(state.jobs)),
  }
  let panel
  world.rerender()
  panel = mountPanel(panelSource ?? src('components/studio-add-slide-v2.tsx'), libs, panelProps, { realIcons })
  world.rerender()
  // The recorded run starts with the user on slide 2 (goToSlide index 1, then the viewer's own getCurrentSlideInfo): take those two answers.
  const arrival = replay.read('goToSlide')
  assert.equal(arrival.reply.success, true)
  ctx.currentSlideIndexRef.current = arrival.params.index
  const info = layout.steps.some(s => s.do === 'command' && s.action === 'getCurrentSlideInfo') ? replay.read('getCurrentSlideInfo') : null
  if (info) assert.equal(info.reply.data.index, arrival.params.index, 'the real viewer reports the slide the user is on')
  return world
}
function world_assert(value, message) { assert.ok(value, message) }
function pureLib(rel, src) { return load(src(rel)) }
