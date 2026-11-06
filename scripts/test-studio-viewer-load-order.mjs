import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import React from 'react'

// Actual ReactDOM, actual unchanged Viewer hooks/effects/JSX. The inert DOM
// below is a renderer host, not a browser, iframe navigation or hook model.
const require = createRequire(import.meta.url)
const root = path.resolve(new URL('..', import.meta.url).pathname)
const sourceHashes = {}
const adapters = new Set()
const trace = []
class HostTarget {
  listeners = new Map()
  addEventListener(type, fn, options) {
    const key = type + ':' + Boolean(typeof options === 'boolean' ? options : options?.capture)
    if (!this.listeners.has(key)) this.listeners.set(key, new Set())
    this.listeners.get(key).add(fn)
  }
  removeEventListener(type, fn, options) {
    this.listeners.get(type + ':' + Boolean(typeof options === 'boolean' ? options : options?.capture))?.delete(fn)
  }
  dispatchEvent(event) {
    event.target ??= this
    event.preventDefault ??= () => { event.defaultPrevented = true }
    event.stopPropagation ??= () => { event.cancelBubble = true }
    const chain = []
    for (let current = this; current; current = current.parentNode) chain.push(current)
    const invoke = (current, capture) => {
      event.currentTarget = current
      for (const fn of [...current.listeners?.get(event.type + ':' + capture) ?? []]) fn(event)
    }
    for (const current of [...chain].reverse()) invoke(current, true)
    for (const current of chain) {
      invoke(current, false)
      if (!event.bubbles || event.cancelBubble) break
    }
    return !event.defaultPrevented
  }
}
class HostNode extends HostTarget {
  constructor(type, name, doc) {
    super(); this.nodeType = type; this.nodeName = name; this.tagName = type === 1 ? name : undefined
    this.ownerDocument = doc; this.parentNode = null; this.childNodes = []; this.attributes = new Map()
    this.namespaceURI = 'http://www.w3.org/1999/xhtml'; this.style = { setProperty() {}, removeProperty() {} }
    this.clientWidth = 0; this.clientHeight = 0; this.clientLeft = 0
    if (name === 'IFRAME') this.contentWindow = { postMessage: (data, origin) => {
      commands.push({ frame: this, data, origin })
      if (this.respond) queueMicrotask(() => windowHost.dispatchEvent({ type: 'message',
        source: this.contentWindow, origin, data: { action: data.action, requestId: data.requestId,
          job_id: data.params?.job_id, ...this.respond(data) } }))
    } }
  }
  appendChild(node) { return this.insertBefore(node, null) }
  insertBefore(node, before) {
    node.parentNode?.removeChild(node)
    const index = before === null ? this.childNodes.length : this.childNodes.indexOf(before)
    assert.ok(index >= 0); this.childNodes.splice(index, 0, node); node.parentNode = this; return node
  }
  removeChild(node) { const index = this.childNodes.indexOf(node); assert.ok(index >= 0); this.childNodes.splice(index, 1); node.parentNode = null; return node }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  removeAttribute(name) { this.attributes.delete(name) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  get src() { return this.getAttribute('src') ?? '' }
  set src(value) { this.setAttribute('src', value) }
  get firstChild() { return this.childNodes[0] ?? null }
  get lastChild() { return this.childNodes.at(-1) ?? null }
  get nextSibling() { return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map(n => n.textContent).join('') }
  set textContent(value) { for (const node of this.childNodes) node.parentNode = null; this.childNodes = []; if (value) this.appendChild(this.ownerDocument.createTextNode(String(value))) }
  contains(node) { return node === this || this.childNodes.some(child => child.contains(node)) }
  getBoundingClientRect() { return { width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 } }
  focus() { this.ownerDocument.activeElement = this }
}
const documentHost = new HostTarget()
Object.assign(documentHost, { nodeType: 9, nodeName: '#document', parentNode: null,
  createElement: name => new HostNode(1, name.toUpperCase(), documentHost),
  createElementNS: (namespace, name) => new HostNode(1, name.toUpperCase(), documentHost),
  createTextNode: value => Object.assign(new HostNode(3, '#text', documentHost), { nodeValue: value }),
})
documentHost.documentElement = documentHost.createElement('html')
documentHost.body = documentHost.createElement('body')
documentHost.documentElement.appendChild(documentHost.body)
documentHost.activeElement = documentHost.body
const windowHost = new HostTarget()
Object.assign(windowHost, { document: documentHost, innerWidth: 1200, HTMLElement: HostNode,
  HTMLIFrameElement: class {}, Node: HostNode, localStorage: { getItem: key => key === 'deckster:debug' ? 'true' : null, setItem() {} },
  setTimeout, clearTimeout, location: { href: 'https://fixture.invalid' } })
documentHost.defaultView = windowHost
Object.assign(globalThis, { window: windowHost, document: documentHost, HTMLElement: HostNode,
  Node: HostNode, localStorage: windowHost.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
  ResizeObserver: class { observe() {} disconnect() {} },
})
const { createRoot } = await import('react-dom/client')
const intervals = new Map()
let timerId = 0
const commands = []
const logs = []
const forbidden = () => { throw Error('Isolated Viewer witness refuses network access') }
const sources = new Map()
const isolatedProcess = { env: { NODE_ENV: 'test', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout.invalid' } }
function readModule(file) {
  file = fs.realpathSync(file)
  if (sources.has(file)) return sources.get(file).exports
  const source = fs.readFileSync(file, 'utf8')
  const relative = path.relative(root, file)
  sourceHashes[relative] = crypto.createHash('sha256').update(source).digest('hex')
  const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0)
  const module = { exports: {} }; sources.set(file, module)
  const blankComponents = new Proxy({ __esModule: true }, { get: (obj, name) => name in obj ? obj[name] : () => null })
  const load = spec => {
    if (spec.endsWith('.css')) { adapters.add('CSS omitted'); return {} }
    if (spec === 'react' || spec.startsWith('react/') || spec === 'react-dom') return require(spec)
    if (spec === 'next-themes') { adapters.add(spec); return { useTheme: () => ({ resolvedTheme: 'light', setTheme() {} }) } }
    if (spec === '@/hooks/use-toast') { adapters.add(spec); return { useToast: () => ({ toast() {} }) } }
    if (spec === 'next/link') { adapters.add(spec); return { __esModule: true, default: ({ children }) => React.createElement('a', null, children) } }
    if (spec === 'lucide-react') { adapters.add(spec); return blankComponents }
    const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null
    if (base) {
      const target = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
      assert.ok(target, `Missing ${spec}`)
      if (target.includes('/components/') && !target.endsWith('/studio-toolbar-save-feedback.tsx')) { adapters.add(path.relative(root, target)); return blankComponents }
      return readModule(target)
    }
    return require(spec)
  }
  vm.runInNewContext(result.outputText, { module, exports: module.exports, require: load,
    process: isolatedProcess, window: windowHost, document: documentHost, localStorage: windowHost.localStorage,
    HTMLElement: HostNode, ResizeObserver: globalThis.ResizeObserver, URL, Map, Set, crypto,
    fetch: forbidden, WebSocket: forbidden, console: { ...console, log: (...args) => logs.push(args), info: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    setTimeout, clearTimeout, setInterval: (fn, delay) => { const id = ++timerId; intervals.set(id, { fn, delay }); return id }, clearInterval: id => intervals.delete(id),
  }, { filename: relative })
  return module.exports
}
const { PresentationViewer } = readModule(path.join(root, 'components/presentation-viewer.tsx'))
assert.equal(typeof PresentationViewer, 'function')
const find = (node, predicate) => predicate(node) ? node : node.childNodes.map(child => find(child, predicate)).find(Boolean)
const frameIn = container => find(container, node => node.tagName === 'IFRAME')
const loadingIn = container => Boolean(find(container, node => node.getAttribute?.('data-studio-viewer-loading') === 'true'))
const observations = []
function record(name, fixture, extra = {}) {
  const observation = { name, loadingCover: loadingIn(fixture.container), apiAdmitted: Boolean(fixture.api),
    introductionReady: fixture.safety?.ready ?? null, pollingIntervals: intervals.size, ...extra }
  observations.push(observation); return observation
}
const baselineProps = { presentationId: 'synthetic-final', presentationUrl: 'https://layout.invalid/p/synthetic-final',
  finalPresentationUrl: 'https://layout.invalid/p/synthetic-final', slideCount: 3, sessionId: 'synthetic-session',
  deckOwnerSessionId: 'synthetic-session', showControls: false, connected: true }
function createFixture(extra = {}) {
  const fixture = { container: documentHost.createElement('div'), api: null, safety: null, props: { ...baselineProps, ...extra } }
  documentHost.body.appendChild(fixture.container)
  fixture.root = createRoot(fixture.container)
  fixture.render = async (props = fixture.props, layoutLoad = false) => {
    fixture.props = props
    // Preserve the wrapper/component identity across prop changes.
    fixture.Wrapper ??= function Wrapper({ children, dispatchLoad }) {
      React.useLayoutEffect(() => {
        if (dispatchLoad) {
          trace.push('parent layout effect: current iframe synthetic load dispatched before passive effects')
          frameIn(fixture.container).dispatchEvent({ type: 'load', bubbles: false })
        }
      }, [dispatchLoad, fixture.props.presentationUrl])
      return children
    }
    await React.act(async () => fixture.root.render(React.createElement(fixture.Wrapper, { dispatchLoad: layoutLoad },
      React.createElement(PresentationViewer, { ...props, onApiReady: api => { fixture.api = api },
        onComposeApiReady: api => { fixture.composeApi = api },
        onStudioIntroductionSafetyChange: safety => { fixture.safety = safety } }))))
  }
  fixture.load = async (frame = frameIn(fixture.container)) => React.act(async () => frame.dispatchEvent({ type: 'load', bubbles: false }))
  fixture.message = async (data, source = frameIn(fixture.container).contentWindow, origin = 'https://layout.invalid') =>
    React.act(async () => windowHost.dispatchEvent({ type: 'message', data, source, origin }))
  fixture.close = async () => { await React.act(async () => fixture.root.unmount()); documentHost.body.removeChild(fixture.container) }
  return fixture
}

const normal = createFixture()
await normal.render()
assert.equal(record('initial_mount_reset_before_load', normal).loadingCover, true)
await normal.load()
assert.equal(record('normal_load_after_passive_reset', normal).loadingCover, false)
assert.ok(normal.api)
assert.equal(intervals.size, 1)
await normal.close()
assert.equal(intervals.size, 0)
const returned = createFixture()
await returned.render(); await returned.load()
assert.equal(record('unmount_then_client_return_remount_normal_load', returned).loadingCover, false)
await returned.close()

const early = createFixture()
const earlyLogStart = logs.length
await early.render(early.props, true)
const earlyLogs = logs.slice(earlyLogStart).map(args => String(args[0]))
const acceptedLogIndex = earlyLogs.findIndex(value => value.includes('Iframe loaded and ready'))
const resetLogIndex = earlyLogs.findIndex(value => value.includes('resetting readiness'))
const expectCommitLoadReady = process.argv.includes('--expect-commit-load-ready')
assert.ok(acceptedLogIndex >= 0 && resetLogIndex >= 0, 'Actual onLoad acceptance and reset both observed')
assert.equal(resetLogIndex < acceptedLogIndex, expectCommitLoadReady, 'Observed reset/load ordering matches expected actual source')
trace.push(...earlyLogs.filter(value => /Iframe loaded and ready|resetting readiness/.test(value)))
assert.equal(record('forced_commit_load_before_passive_reset', early, { schedule: 'synthetic parent layout-effect dispatch; not browser scheduling',
  acceptedOnLoadBeforeReset: acceptedLogIndex < resetLogIndex }).loadingCover, !expectCommitLoadReady)
assert.equal(Boolean(early.api), expectCommitLoadReady)
assert.equal(intervals.size, expectCommitLoadReady ? 1 : 0)
await early.load()
assert.equal(record('second_load_recovers_forced_failure', early).loadingCover, false)
await early.close()
const earlyReturned = createFixture()
await earlyReturned.render(earlyReturned.props, true)
assert.equal(record('client_return_remount_forced_commit_load', earlyReturned).loadingCover, !expectCommitLoadReady)
await earlyReturned.close()

const ownership = createFixture()
await ownership.render(); await ownership.load()
const retiredFrame = frameIn(ownership.container)
const oldProps = Object.keys(retiredFrame).find(key => key.startsWith('__reactProps$'))
assert.ok(oldProps, 'Actual ReactDOM installed current JSX event props')
const retiredCallback = retiredFrame[oldProps].onLoad
await ownership.render({ ...ownership.props, presentationId: 'synthetic-next', presentationUrl: 'https://layout.invalid/p/synthetic-next' })
const currentFrame = frameIn(ownership.container)
assert.notEqual(currentFrame, retiredFrame)
assert.equal(record('approved_source_change_retires_loaded_frame', ownership).loadingCover, true)
await React.act(async () => retiredCallback({ currentTarget: retiredFrame }))
assert.equal(record('retired_frame_callback_rejected', ownership).loadingCover, true)
const savedSrc = currentFrame.src
currentFrame.src = 'https://layout.invalid/p/retired'
await ownership.load(); currentFrame.src = savedSrc
assert.equal(record('current_frame_wrong_exact_src_rejected', ownership).loadingCover, true)
await ownership.load()
assert.equal(record('current_frame_exact_src_accepted', ownership).loadingCover, false)
await ownership.message({ type: 'save_status', status: 'unsaved' }, retiredFrame.contentWindow)
assert.equal(ownership.safety.dirty, false)
record('retired_window_message_rejected', ownership)
await ownership.message({ type: 'save_status', status: 'unsaved' }, currentFrame.contentWindow, 'https://foreign.invalid')
assert.equal(ownership.safety.dirty, false)
record('wrong_origin_message_rejected', ownership)
await ownership.message({ type: 'save_status', status: 'unsaved' })
assert.equal(ownership.safety.dirty, true)
record('current_window_exact_origin_dirty_admitted', ownership)
await ownership.message({ type: 'save_status', status: 'saved' })
assert.equal(ownership.safety.dirty, true)
record('saved_without_no_pending_receipt_retains_dirty_history', ownership)
await ownership.message({ type: 'save_status', status: 'saved', hasPendingChanges: false })
assert.equal(ownership.safety.dirty, false)
record('trusted_saved_no_pending_clears_dirty_history', ownership)
await ownership.render({ ...ownership.props, presentationId: 'synthetic-third', presentationUrl: 'https://layout.invalid/p/synthetic-third' }, true)
assert.equal(record('approved_source_change_forced_commit_load', ownership).loadingCover, !expectCommitLoadReady)
await ownership.close()
assert.equal(intervals.size, 0)

// Synthetic command receipts go through actual postMessage admission and actual
// snapshot effects; they prove the frontend gate distinction only.
const snapshot = { buildId: 'synthetic-build', presentationId: 'synthetic-final', slideCount: 3 }
const nativeReply = ({ action }) => action === 'getSlideCount' ? { success: true, data: { count: 1 } }
  : action === 'isEditModeActive' ? { success: true, isEditing: false }
  : action === 'getCurrentSlideInfo' ? { success: true, data: { index: 0, total: 3 } }
  : { success: true }
const refreshed = createFixture({ completedBuildSnapshot: snapshot })
await refreshed.render()
frameIn(refreshed.container).respond = nativeReply
await refreshed.load()
assert.ok(frameIn(refreshed.container).src.includes('studio_build_snapshot=1'))
assert.equal(record('synthetic_snapshot_receipts_admit_refresh_then_new_frame_load_gate', refreshed).loadingCover, true)
frameIn(refreshed.container).respond = nativeReply
await refreshed.load()
assert.equal(record('refreshed_iframe_load_passes_earlier_gate_before_native_selection', refreshed).loadingCover, false)
assert.equal(refreshed.api, null)
assert.equal(refreshed.safety.ready, false)
await React.act(async () => { await [...intervals.values()][0].fn() })
assert.ok(refreshed.api)
assert.equal(record('synthetic_native_navigation_receipts_admit_later_snapshot_gate', refreshed).introductionReady, true)
await refreshed.close()

for (const guard of ['dirty', 'saving-status', 'edit', 'structural-intent', 'foreign-session-owner']) {
  const fixture = createFixture()
  await fixture.render(); frameIn(fixture.container).respond = nativeReply; await fixture.load()
  if (guard === 'dirty') await fixture.message({ type: 'save_status', status: 'unsaved' })
  if (guard === 'saving-status') await fixture.message({ type: 'save_status', status: 'saving' })
  if (guard === 'edit') {
    frameIn(fixture.container).respond = data => data.action === 'isEditModeActive'
      ? { success: true, isEditing: true } : nativeReply(data)
    await fixture.message({ type: 'textBoxSelected', elementId: 'synthetic-text' })
    assert.equal(fixture.safety.dirty, true)
  }
  if (guard === 'structural-intent') await React.act(async () => { await fixture.composeApi.composePlaceholderAdd('synthetic-job', 0) })
  const start = commands.length
  await fixture.render({ ...fixture.props, completedBuildSnapshot: snapshot,
    ...(guard === 'foreign-session-owner' ? { deckOwnerSessionId: 'synthetic-foreign-session' } : {}) })
  assert.equal(frameIn(fixture.container).src, baselineProps.presentationUrl)
  assert.equal(commands.slice(start).filter(command => command.data.action === 'getSlideCount').length, 0)
  record(`snapshot_refresh_refused_${guard}`, fixture, { snapshotProbeCommands: 0 })
  await fixture.close()
}
const retiredOwner = createFixture({ completedBuildSnapshot: snapshot })
await retiredOwner.render(); await retiredOwner.load()
const ownerProbe = commands.at(-1)
assert.equal(ownerProbe.data.action, 'getSlideCount')
const ownerFrame = frameIn(retiredOwner.container)
await retiredOwner.render({ ...retiredOwner.props, sessionId: 'synthetic-new-session', deckOwnerSessionId: 'synthetic-new-session',
  completedBuildSnapshot: null })
const priorCommandCount = commands.length
await retiredOwner.message({ action: ownerProbe.data.action, requestId: ownerProbe.data.requestId, success: true, data: { count: 1 } }, ownerFrame.contentWindow)
assert.equal(commands.length, priorCommandCount)
assert.equal(frameIn(retiredOwner.container), ownerFrame)
assert.equal(ownerFrame.src, baselineProps.presentationUrl)
record('inflight_snapshot_receipt_retired_after_same_frame_session_owner_change', retiredOwner, { followupProbeCommands: 0 })
await retiredOwner.close()

const saving = createFixture({ showControls: true })
await saving.render(); await saving.load()
await saving.message({ type: 'save_status', status: 'unsaved' })
const saveButton = find(saving.container, node => node.tagName === 'BUTTON' && node.getAttribute('data-studio-toolbar-save') === 'true')
assert.ok(saveButton, 'Actual save-feedback component renders its actual Viewer onSave handler')
await React.act(async () => saveButton.dispatchEvent({ type: 'click', bubbles: true, button: 0 }))
const saveCommand = commands.at(-1)
assert.equal(saveCommand.data.action, 'saveAllChanges')
// A trusted no-pending notification isolates isSaving from dirty/saveStatus.
await saving.message({ type: 'save_status', status: 'saved', hasPendingChanges: false })
assert.equal(saving.safety.dirty, false)
assert.equal(saving.safety.busy, true)
assert.ok(find(saving.container, node => node.getAttribute?.('data-save-state') === 'saving'))
const saveProbeStart = commands.length
await saving.render({ ...saving.props, completedBuildSnapshot: snapshot })
assert.equal(commands.length, saveProbeStart)
assert.equal(frameIn(saving.container).src, baselineProps.presentationUrl)
record('actual_viewer_save_handler_inflight_blocks_snapshot_with_clean_native_status', saving, { snapshotProbeCommands: 0, dirty: false, busy: true })
await saving.render({ ...saving.props, completedBuildSnapshot: null })
await saving.message({ action: 'saveAllChanges', requestId: saveCommand.data.requestId, success: true })
assert.equal(saving.safety.busy, false)
record('actual_viewer_save_handler_receipt_releases_busy_gate', saving, { busy: false })
await saving.close()

const evidence = process.argv.find(value => value.startsWith('--evidence='))?.slice('--evidence='.length)
sourceHashes['scripts/test-studio-viewer-load-order.mjs'] = crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex')
const receipt = { level: 'Actual unchanged full Viewer mounted with installed ReactDOM in inert synthetic DOM host; no browser, native navigation, connected services or natural iframe timing proof',
  runtime: process.version, react: React.version, reactDom: require('react-dom/package.json').version,
  timestamp: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes, dependencyHashes: Object.fromEntries(Object.keys(require.cache)
    .filter(file => /node_modules\/(?:react|react-dom|scheduler)\//.test(file))
    .map(file => [path.relative(root, file), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  adapters: [...adapters].sort(), observations, trace,
  expectCommitLoadReady,
  failure: expectCommitLoadReady ? null : 'Actual React passive reset clears accepted synthetic commit-time load; loading cover retained, API null, polling absent until another accepted load',
  connectedCauseProven: false, naturalBrowserScheduleProven: false,
  limits: ['Inert DOM cannot navigate frames or model browser event loop/network/cache/router behavior.',
    'Commit-time load is explicitly forced by parent layout effect; does not demonstrate browser can naturally dispatch it.',
    'Full Viewer source and hooks/effects run; child UI, icons, theme/toast hooks and CSS are adapters.',
    'Snapshot, edit, saving-status and structural-intent checks use synthetic receipts; no native operation or end-to-end claim.',
    'Only actual toolbar save-feedback UI/save callback is mounted; other child UI, production router, cache and compiled styling remain unproven.'],
}
if (evidence) { fs.mkdirSync(path.dirname(path.resolve(evidence)), { recursive: true }); fs.writeFileSync(evidence, JSON.stringify(receipt, null, 2) + '\n') }
console.log(`Actual Viewer/ReactDOM: ${observations.length} observations passed; forced schedule ${expectCommitLoadReady ? 'retains readiness' : 'loses readiness'}; connected/browser cause unproven`)
