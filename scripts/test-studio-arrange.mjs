// NEXT_PUBLIC_STUDIO_ARRANGE (FRONTEND-2, B21): proof that Arrange works in the Studio v4 Format inspector against Layout MR !260's REAL command handlers, and that selecting an element no longer raises it.
//
//   node scripts/test-studio-arrange.mjs                      offline: Layout's recorded transcript (scripts/fixtures/studio-arrange/layout-transcript.json) stands in for the viewer, request by request
//   STUDIO_ARRANGE_LAYOUT_DIR=<layout-builder checkout of !260 + the intent guard> STUDIO_ARRANGE_LAYOUT_SERVED=<dir with served-on.html / served-off.html> node scripts/test-studio-arrange.mjs [--record-layout]
//                                                             live: Layout's own viewer code runs in a vm (scripts/studio-arrange-layout.mjs); --record-layout rewrites the transcript
//   (the served pages come from scripts/fixtures/studio-arrange/serve-layout-viewer.py, run with Layout's own Python against the checkout)
//
// What is Studio's and real: lib/studio-arrange.ts, lib/studio-format-native.ts (the selection handle: its strict ACK bridge sendStudioFormatNativeCommand, read() and send()), lib/layout-viewer-messaging.ts, the
// inspector (components/builder/studio-format-inspector.tsx, rendered with real React for markup and with a hook-driven renderer for clicks), and the viewer's two selection handlers, cut out of
// components/presentation-viewer.tsx by exact anchors. What stands in: the page's command handler is the sequence page.tsx runs (selection.send, then selection.read; a source check holds page.tsx to it), and the
// viewer's sendCommand / ensureEditMode in the cut-out handlers are recorders.
//
// Intent (Layout's guard, LAYOUT_ARRANGE_COMMANDS_ENABLED): Layout runs an Arrange command only when its params carry intent 'arrange'. Every Arrange command the inspector sends must carry it (sections D, E, F, H
// and the INTENT block), and the older builds' select-raise payload (bringToFront {elementId}, no intent) must be a no-op at the viewer (section E).
// Sections: A strip and byte identity; B flag-off identity of outputs (inspector markup, the handle's transcript, the select path); C the select path (no bringToFront with the flag on); D every control -> the exact
// command against the real viewer, the answer, the refreshed numbers; E errors and changed:false; F disabled states; G scope over the own commits; H mutants.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(root, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const strip = await import('./studio-arrange-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const layoutHarness = await import('./studio-arrange-layout.mjs')

const FLAG = 'NEXT_PUBLIC_STUDIO_ARRANGE'
const INSPECTOR = 'components/builder/studio-format-inspector.tsx'
const NATIVE = 'lib/studio-format-native.ts'
const ARRANGE = 'lib/studio-arrange.ts'
const VIEWER = 'components/presentation-viewer.tsx'
const MESSAGING = 'lib/layout-viewer-messaging.ts'
const PAGE = 'app/builder/page.tsx'
const FIXTURE = 'scripts/fixtures/studio-arrange/layout-transcript.json'
const VIEWER_ORIGIN = 'https://layout.synthetic.test'
const STUDIO_ORIGIN = 'https://studio.synthetic.test'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(typeof text === 'string' ? text : JSON.stringify(text)).digest('hex')
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const turn = () => new Promise(resolve => setImmediate(resolve))
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await turn() }

const layoutDir = process.env.STUDIO_ARRANGE_LAYOUT_DIR || null
const servedDir = process.env.STUDIO_ARRANGE_LAYOUT_SERVED || null
const live = Boolean(layoutDir && servedDir)
const record = process.argv.includes('--record-layout')
if (record && !live) throw new Error('--record-layout needs STUDIO_ARRANGE_LAYOUT_DIR and STUDIO_ARRANGE_LAYOUT_SERVED')

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ============================================================ sources (overridable by the mutants)
const BASE = strip.BASE_COMMIT
const baseText = rel => git('show', `${BASE}:${rel}`)
const SRC = { [INSPECTOR]: read(INSPECTOR), [NATIVE]: read(NATIVE), [ARRANGE]: read(ARRANGE), [VIEWER]: read(VIEWER), [MESSAGING]: read(MESSAGING) }
const BASE_SRC = { [INSPECTOR]: baseText(INSPECTOR), [NATIVE]: baseText(NATIVE), [VIEWER]: baseText(VIEWER), [MESSAGING]: baseText(MESSAGING) }

function transpile(source, fileName) {
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const errors = (out.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function loadModule(source, fileName, { env, requireMap, globals = {} }) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(source, fileName), { module: mod, exports: mod.exports, process: { env }, console, setTimeout, clearTimeout, setImmediate, crypto: globalThis.crypto,
    URL, structuredClone, Promise, Error, ...globals,
    require: id => { if (!(id in requireMap)) throw new Error(`${fileName}: unexpected import ${id}`); return requireMap[id] } })
  return mod.exports
}

/** The Studio modules, loaded for one flag value (and one set of sources). */
function studioModules(env, src = SRC, studioWindow) {
  const messaging = loadModule(src[MESSAGING], MESSAGING, { env, requireMap: {} })
  const arrange = src[ARRANGE] ? loadModule(src[ARRANGE], ARRANGE, { env, requireMap: {} }) : null
  const native = loadModule(src[NATIVE], NATIVE, { env, requireMap: { '@/lib/layout-viewer-messaging': messaging, ...(arrange ? { '@/lib/studio-arrange': arrange } : {}) }, globals: { window: studioWindow } })
  return { messaging, arrange, native }
}

// ============================================================ the viewer: live (Layout's code) or the recording
const recorded = live ? null : JSON.parse(read(FIXTURE))
const transcript = { layout: null, worlds: {} }
const INTENT_LOG = {}

const DECK = [{ elements: [
  { id: 'tb1', type: 'textbox', componentType: 'TEXT_BOX', gridRow: '11/31', gridColumn: '6/86', zIndex: 1001 },
  { id: 'img1', type: 'image', componentType: 'IMAGE', gridRow: '1/91', gridColumn: '1/161', zIndex: 100 },
  { id: 'ch1', type: 'chart', componentType: 'CHART', gridRow: '21/61', gridColumn: '91/151', zIndex: 101 },
  { id: 'inf1', type: 'infographic', componentType: 'INFOGRAPHIC', gridRow: '61/86', gridColumn: '11/61', zIndex: 102 },
  { id: 'dg1', type: 'diagram', componentType: 'DIAGRAM', gridRow: '63/89', gridColumn: '101/151', zIndex: 103 },
  { id: 'sh1', type: 'shape', componentType: 'SHAPE', gridRow: '5/15', gridColumn: '140/158' },
  { id: 'tbl1', type: 'table', componentType: 'TABLE', gridRow: '70/88', gridColumn: '61/96', zIndex: 104 },
  { id: 'lk1', type: 'image', componentType: 'IMAGE', gridRow: '31/51', gridColumn: '21/41', zIndex: 105, locked: true },
  { id: 'lkt', type: 'textbox', componentType: 'TEXT_BOX', gridRow: '80/88', gridColumn: '120/150', zIndex: 1002, locked: true },
] }]

/** One world: a viewer (Layout's code, or the recording of it) and Studio's window, wired as an iframe and its parent. */
function createWorld(name, { layoutFlag = 'on' } = {}) {
  const listeners = new Set()
  const studioWindow = {
    addEventListener(type, fn) { if (type === 'message') listeners.add(fn) },
    removeEventListener(type, fn) { if (type === 'message') listeners.delete(fn) },
  }
  const requests = []
  const events = []
  let viewer = null
  const parentForViewer = { postMessage(data) { const copy = structuredClone(data); events.push({ frame: copy }); setImmediate(() => { for (const fn of [...listeners]) fn({ source: viewerWindow, origin: VIEWER_ORIGIN, data: copy }) }) } }
  const viewerWindow = { postMessage(data, targetOrigin) {
    assert.equal(targetOrigin, VIEWER_ORIGIN, 'Studio posts to the viewer origin only')
    const copy = structuredClone(data); requests.push(copy); events.push({ request: copy })
    setImmediate(() => viewer.deliver(copy, STUDIO_ORIGIN))
  } }
  if (live) {
    const servedHtml = fs.readFileSync(path.join(servedDir, `served-${layoutFlag}.html`), 'utf8')
    viewer = layoutHarness.createLayoutViewer({ layoutDir, servedHtml, parent: parentForViewer, slides: DECK })
    transcript.worlds[name] = events
  } else {
    // The recording: every request must be the recorded one (its requestId aside); the frames the viewer posted after it are posted again, with this run's requestId.
    const script = recorded.worlds[name]
    if (!script) throw new Error(`no recording for world ${name}`)
    let at = 0
    const emitFrames = requestId => {
      while (at < script.length && script[at].frame) {
        const frame = structuredClone(script[at++].frame)
        if (frame.requestId !== undefined) frame.requestId = requestId
        parentForViewer.postMessage(frame)
      }
    }
    viewer = {
      deliver(data) {
        // a request that is not the recorded one: the world diverged (reported by the test that drives it); the viewer refuses it so Studio fails fast
        const next = script[at]
        const want = next?.request ? { ...next.request, requestId: data.requestId } : null
        if (!want || JSON.stringify(plain(data)) !== JSON.stringify(plain(want))) {
          api.diverged ??= `${name}: Studio sent ${JSON.stringify(plain({ ...data, requestId: undefined }))}, the recording has ${JSON.stringify(next ?? 'nothing')}`
          parentForViewer.postMessage({ success: false, action: data.action, requestId: data.requestId, error: 'diverged from the recording' })
          return
        }
        at++
        emitFrames(data.requestId)
      },
      select(id) { const next = script[at++]; assert.deepEqual(next, { select: id }, `${name}: selection order`); emitFrames(undefined) },
      setMode(mode) { const next = script[at++]; assert.deepEqual(next, { mode }, `${name}: mode order`) },
      state: () => null, pending: () => null, slideGeometry: () => null,
      finished: () => assert.equal(at, script.length, `${name}: the whole recording was replayed`),
    }
  }
  INTENT_LOG[name] = requests // the INTENT block reads every world's requests (live and recorded alike)
  const iframe = { src: `${VIEWER_ORIGIN}/p/pres-e2e`, contentWindow: viewerWindow }
  const api = {
    name, studioWindow, iframe, requests, events, listeners, diverged: null,
    assertOnScript() { if (api.diverged) throw new Error(api.diverged) },
    select(id) { if (live) { events.push({ select: id }); viewer.select(id) } else viewer.select(id) },
    setMode(mode) { if (live) { events.push({ mode }); viewer.setMode(mode) } else viewer.setMode(mode) },
    state: () => viewer.state(), pending: () => viewer.pending(), slideGeometry: id => viewer.slideGeometry(id),
    finish() { api.assertOnScript(); if (!live) viewer.finished() },
    viewer,
  }
  return api
}

// ============================================================ the viewer's selection handlers, cut out of components/presentation-viewer.tsx
function cutHandler(source, heading) {
  const start = source.indexOf(heading)
  assert.ok(start > 0, `viewer: ${heading.trim()} not found`)
  const from = source.indexOf('    const handleMessage = async (event: MessageEvent) => {\n', start)
  const to = source.indexOf("    window.addEventListener('message', handleMessage)\n", from)
  assert.ok(from > start && to > from, 'viewer: handler anchors')
  return source.slice(from, to)
}
const TEXT_HEADING = '  // Listen for text box selection events from iframe\n'
const ELEMENT_HEADING = '  // Listen for element selection events from iframe (Image, Chart, Table, Infographic, Diagram)\n'
/** The viewer read past every OTHER registered later change's marked lines (a change merged beside this one adds its own lines to these handlers), line by line: a line goes when another
 *  registered strip takes it out on its own. This change's own lines always stay (Pass 3 polish B's strip now takes them out too, for COMPOSER-2's first-paint pin). */
const peerStrips = () => registry.LATER_STRIPS.filter(fn => typeof fn === 'function' && fn !== strip.stripStudioArrange)
const viewerPastPeers = text => text.split('\n').filter(line => line === '' || strip.STUDIO_ARRANGE_MARKER_RE.test(line) || !peerStrips().some(fn => fn(VIEWER, line) === '')).join('\n')
const SAVE_HEADING = '      // Handle save status updates from auto-save system\n'
/** The viewer's save-status block (Layout's saveStatusChanged: "unsaved" / "saving" / "error" retire every selection by bumping the interaction intent), cut out by exact anchors. */
function cutSaveBlock(source) {
  const start = source.indexOf(SAVE_HEADING)
  const end = source.indexOf("\n      if (\n        type === 'refineElementRequested' &&", start)
  assert.ok(start > 0 && end > start, 'viewer: save-status block anchors')
  return source.slice(start, end + 1)
}
function selectionHandlers(viewerSource, env, deps) {
  viewerSource = viewerPastPeers(viewerSource)
  const body = [cutHandler(viewerSource, TEXT_HEADING), cutHandler(viewerSource, ELEMENT_HEADING)]
  const names = ['VIEWER_ORIGIN', 'LAYOUT_URL_CONFIG_ERROR', 'isTrustedLayoutViewerMessage', 'iframeRef', 'studioShell', 'beginStudioViewerInteraction', 'ensureEditMode', 'setSelectedTextBoxId',
    'studioArrangeSelectionRef', 'captureStudioFormatSelection', 'onTextBoxSelected', 'studioArrangeRaisesOnSelect', 'sendCommand', 'debugLog', 'viewerInteractionIntentRef', 'onTextBoxDeselected',
    'onElementSelected', 'onElementDeselected', 'reportDeckChange', 'onElementDeleted', 'nativeSnapshotDirtyRef', 'reportOwnDeckEdit', 'setNativeSnapshotSafetyRevision', 'setSaveStatus',
    ...(deps.studioArrangeOwnsSaveStatus ? ['studioArrangeOwnsSaveStatus'] : [])]
  const make = index => `export function make${index}(deps: any) {\n  const { ${names.join(', ')} } = deps\n${body[index]}  return handleMessage\n}\n`
  const save = `export function makeSave(deps: any) {\n  const { ${names.join(', ')} } = deps\n  return (event: MessageEvent) => {\n    if (!isTrustedLayoutViewerMessage(event, iframeRef.current, VIEWER_ORIGIN)) return\n    const type = event.data?.type\n${cutSaveBlock(viewerSource)}  }\n}\n`
  const mod = loadModule(make(0) + make(1) + save, 'viewer-selection-handlers.ts', { env, requireMap: {} })
  return [mod.make0(deps), mod.make1(deps), mod.makeSave(deps)]
}

/** The select path of one world: the viewer's real handlers (flag `env`), a selection handle per selection (built as captureStudioFormatSelection builds it), and what the handlers sent. */
function wireSelection(world, env, { viewerSource = SRC[VIEWER], src = SRC } = {}) {
  const modules = studioModules(env, src, world.studioWindow)
  const sent = [], selections = [], saveStatuses = []
  const ref = { current: null }
  const intentRef = { current: 0 }
  const deps = {
    VIEWER_ORIGIN, LAYOUT_URL_CONFIG_ERROR: null, isTrustedLayoutViewerMessage: modules.messaging.isTrustedLayoutViewerMessage, iframeRef: { current: world.iframe }, studioShell: true,
    beginStudioViewerInteraction: () => ({ iframe: world.iframe, isCurrent: () => true }), ensureEditMode: async () => true, setSelectedTextBoxId() {},
    studioArrangeSelectionRef: ref, onTextBoxSelected() {}, onElementSelected() {}, onTextBoxDeselected() {}, onElementDeselected() {}, onElementDeleted() {}, reportDeckChange() {},
    studioArrangeRaisesOnSelect: modules.arrange ? modules.arrange.studioArrangeRaisesOnSelect : () => true,
    sendCommand: (iframe, action, params) => { sent.push({ action, params: plain(params) }); return Promise.resolve({ success: true }) },
    debugLog() {}, viewerInteractionIntentRef: intentRef, nativeSnapshotDirtyRef: { current: false }, reportOwnDeckEdit() {}, setNativeSnapshotSafetyRevision() {}, setSaveStatus: status => saveStatuses.push(status),
    ...(modules.arrange?.studioArrangeOwnsSaveStatus ? { studioArrangeOwnsSaveStatus: modules.arrange.studioArrangeOwnsSaveStatus } : {}),
    captureStudioFormatSelection(elementId, eventKind, elementType) {
      const intent = intentRef.current // captureStudioFormatSelection's isCurrent holds viewerInteractionIntentRef.current === intent (section A holds the source to it)
      // as components/presentation-viewer.tsx captureStudioFormatSelection calls it (the STUDIO-ARRANGE spread sits between presentationId and sessionId: section A holds the source to it)
      const input = { iframe: world.iframe, elementId, presentationId: 'pres-e2e', ...(modules.arrange ? modules.arrange.studioArrangeSelectionInput(eventKind, ref.current) : {}),
        sessionId: 'session-1', slideIndex: 0, eventKind, elementType, owner: {}, isCurrent: () => intentRef.current === intent }
      selections.push({ elementId, eventKind, elementType, input, handle: modules.native.createStudioFormatSelectionHandle(input) })
    },
  }
  const handlers = selectionHandlers(viewerSource, env, deps)
  for (const handler of handlers) world.studioWindow.addEventListener('message', handler)
  return { modules, sent, selections, handlers, intentRef, saveStatuses }
}

async function selectAndRead(world, wiring, id) {
  const before = wiring.selections.length
  world.select(id)
  for (let i = 0; i < 50 && wiring.selections.length === before; i++) await turn()
  assert.equal(wiring.selections.length, before + 1, `selecting ${id} created a selection handle`)
  await settle()
  const selection = wiring.selections.at(-1)
  const target = await selection.handle.read()
  world.assertOnScript()
  return { selection, target }
}

// ============================================================ the inspector: real React markup, and a hook-driven renderer for clicks
const inspectorStubs = reactImpl => ({
  react: reactImpl, 'react/jsx-runtime': jsxRuntime,
  'lucide-react': { X: () => null, Sparkles: () => null, Loader2: () => null },
  '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  '@/components/ui/panel': { PanelSection: ({ children }) => jsxRuntime.jsx('div', { 'data-stub': 'PanelSection', children }), ButtonGroup: () => null, Divider: () => null },
  '@/components/element-format-panel/tabs/arrange-tab': { ArrangeTab: props => jsxRuntime.jsx('div', { 'data-stub': 'ArrangeTab', 'data-props': JSON.stringify({ properties: props.properties, elementId: props.elementId, isApplying: props.isApplying }) }) },
  '@/components/builder/studio-panels.css': {}, '@/components/builder/studio-format-failures.css': {},
})
const loadInspector = (env, source = SRC[INSPECTOR], reactImpl = React) => loadModule(source, INSPECTOR, { env, requireMap: inspectorStubs(reactImpl) })
const ssr = (mod, target, extra = {}) => renderToStaticMarkup(React.createElement(mod.StudioFormatInspector, { isOpen: true, target, busy: false, onClose() {}, onSendCommand: async () => ({ success: true }), ...extra }))

function mountInspector(env, props, source = SRC[INSPECTOR]) {
  const instances = new Map()
  let ctx = null, effects = []
  const fake = {
    ...React,
    useState(initial) { const inst = ctx, slot = (inst.slots[inst.cursor] ??= { value: typeof initial === 'function' ? initial() : initial }); inst.cursor++; return [slot.value, value => { slot.value = typeof value === 'function' ? value(slot.value) : value }] },
    useRef(initial) { const inst = ctx, slot = (inst.slots[inst.cursor] ??= { current: initial }); inst.cursor++; return slot },
    useCallback(callback) { ctx.cursor++; return callback },
    useEffect(callback, deps) { const inst = ctx, slot = (inst.slots[inst.cursor] ??= { deps: null, cleanup: undefined }); inst.cursor++; if (!slot.deps || !deps || deps.some((v, i) => v !== slot.deps[i])) effects.push(() => { slot.cleanup?.(); slot.cleanup = callback(); slot.deps = deps }) },
  }
  const component = loadInspector(env, source, fake).StudioFormatInspector
  function expand(node, key) {
    if (Array.isArray(node)) return node.flatMap((child, index) => expand(child, `${key}/${child?.key ?? index}`))
    if (node === null || node === undefined || typeof node === 'boolean') return []
    if (typeof node !== 'object') return [String(node)]
    if (typeof node.type === 'function') {
      const id = `${key}/${node.type.name || 'anon'}#${node.key ?? ''}`
      const inst = instances.get(id) ?? { slots: [], cursor: 0 }
      instances.set(id, inst); inst.cursor = 0
      const previous = ctx; ctx = inst
      const out = node.type(node.props)
      ctx = previous
      return expand(out, id)
    }
    if (typeof node.type === 'symbol') return expand(node.props.children, key)
    return [{ type: node.type, props: node.props, children: expand(node.props.children, key) }]
  }
  const all = nodes => nodes.flatMap(node => typeof node === 'string' ? [] : [node, ...all(node.children)])
  const text = node => typeof node === 'string' ? node : node.children.map(text).join('')
  const api = {
    props, tree: [],
    render(next = api.props) { api.props = next; api.tree = expand(React.createElement(component, api.props), 'root'); let guard = 0; while (effects.length && guard++ < 50) effects.shift()(); return api },
    nodes: () => all(api.tree),
    panel: label => api.nodes().find(node => node.props?.role === 'tabpanel' && node.props['aria-label'] === label),
    within: (label, predicate) => all(api.panel(label)?.children ?? []).filter(predicate),
    button: (label, panel = 'Arrange') => api.within(panel, node => node.type === 'button' && (node.props['aria-label'] === label || text(node) === label)),
    input: (label, panel = 'Arrange') => api.within(panel, node => node.type === 'input' && node.props['aria-label'] === label),
    checkbox: (panel = 'Arrange') => api.within(panel, node => node.type === 'input' && node.props.type === 'checkbox'),
    failure: () => { const node = api.nodes().find(n => n.props?.['data-studio-format-failure'] === 'true'); return node ? text(node) : null },
    arrangeText: () => text(api.panel('Arrange') ?? { children: [] }),
    variant: () => api.within('Arrange', node => node.props?.['data-studio-arrange-v4'] !== undefined)[0]?.props['data-studio-arrange-v4'] ?? null,
    tabs: () => api.nodes().filter(node => node.props?.role === 'tab').map(text),
    text,
  }
  return api.render(props)
}

// ============================================================ A. strip and byte identity
{
  for (const rel of strip.STUDIO_ARRANGE_FILES) {
    const now = read(rel)
    check(assert.equal, strip.stripStudioArrange(rel, now), baseText(rel), `${rel}: without its STUDIO-ARRANGE lines it is the base's, byte for byte`)
    check(assert.equal, registry.stripLaterChanges(rel, now), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: through the registry it is the base's`)
    const marked = now.split('\n').filter(line => strip.STUDIO_ARRANGE_MARKER_RE.test(line)).length
    check(assert.ok, marked > 0, `${rel}: has marked lines`)
  }
  check(assert.equal, registry.stripLaterEnvBlocks('.env.example', read('.env.example')), registry.stripLaterEnvBlocks('.env.example', baseText('.env.example')), '.env.example: without the block it is the base\'s')
  check(assert.ok, read('.env.example').lastIndexOf('\n' + strip.STUDIO_ARRANGE_ENV_BLOCK) >= 0 && registry.stripLaterEnvBlocks('.env.example', read('.env.example').slice(read('.env.example').lastIndexOf('\n' + strip.STUDIO_ARRANGE_ENV_BLOCK) + strip.STUDIO_ARRANGE_ENV_BLOCK.length + 1)).trim() === '', 'the block is the file\'s last, or followed only by the blocks of changes registered after it') // LATER-CHANGES: registry read (MODEL-CHOICE)
  check(assert.ok, strip.STUDIO_ARRANGE_ENV_BLOCK.trimEnd().endsWith(`${FLAG}="false"`), 'the example value is "false"')
  for (const rel of strip.STUDIO_ARRANGE_PIN_FILES) {
    check(assert.equal, registry.stripLaterChanges(rel, strip.putBackPin(rel, read(rel))), registry.stripLaterChanges(rel, baseText(rel)), `the taught line of ${rel} puts back to the base's`) // LATER-CHANGES: registry read (CHAT-CLEAN): a change registered later (chat clean) teaches this pin too, with lines of its own; past them (the registry's strips, both sides) the put-back is the base's
    check(assert.equal, strip.putBackPin(rel, baseText(rel)), baseText(rel), `putBackPin is idempotent (${rel})`)
    check(assert.equal, registry.stripLaterChanges(rel, strip.stripStudioArrange(rel, read(rel))), registry.stripLaterChanges(rel, baseText(rel)), `${rel} through the strip is the base's`) // LATER-CHANGES: registry read (CHAT-CLEAN): the same pin through this change's strip, past the later change's lines
  }
  for (const file of strip.STUDIO_ARRANGE_SCOPE_FILES) check(assert.ok, registry.LATER_CHANGE_FILES.has(file), `registered: ${file}`)
  check(assert.ok, registry.LATER_STRIPS.includes(strip.stripStudioArrange), 'the strip is registered')
  check(assert.ok, registry.LATER_ENV_BLOCKS.includes(strip.STUDIO_ARRANGE_ENV_BLOCK), 'the env block is registered')
  check(assert.equal, strip.stripStudioArrange('app/builder/page.tsx', 'x STUDIO-ARRANGE\n'), 'x STUDIO-ARRANGE\n', 'a file it does not own comes back as it is')
  check(assert.equal, strip.stripStudioArrange(VIEWER, 'a\nSTUDIO-ARRANGE-X\nX-STUDIO-ARRANGE\n'), 'a\nSTUDIO-ARRANGE-X\nX-STUDIO-ARRANGE\n', 'the marker is a whole token')
  // the legacy panel is not changed; the viewer's handle call carries the spread exactly where section C's capture puts it
  for (const rel of ['components/element-format-panel/tabs/arrange-tab.tsx', 'components/element-format-panel/index.tsx', PAGE]) check(assert.equal, registry.stripLaterChanges(rel, read(rel)), registry.stripLaterChanges(rel, baseText(rel)), `${rel} is not changed`) // LATER-CHANGES: registry read (CHAT-CLEAN): a change registered after this one (chat clean) adds marked lines to the page; through the registry both sides are the base's
  check(assert.ok, SRC[VIEWER].includes("    selection = createStudioFormatSelectionHandle({ iframe, elementId, presentationId: owner.presentationId,\n      ...studioArrangeSelectionInput(eventKind, studioArrangeSelectionRef.current), // STUDIO-ARRANGE"), 'the handle input spread')
  check(assert.equal, (SRC[VIEWER].match(/^\s*if \(studioArrangeRaisesOnSelect\(\)\) \/\/ STUDIO-ARRANGE[^\n]*\n\s*void sendCommand\(interaction\?\.iframe \?\? iframeRef\.current, 'bringToFront', \{ elementId \}\)/gm) || []).length, 2, 'both select-raises are behind the one guard')
  check(assert.equal, (SRC[VIEWER].match(/'bringToFront'/g) || []).length, 2, 'no other bringToFront in the viewer')
  check(assert.match, SRC[VIEWER], /const isCurrent = \(\) => Boolean\(selection && studioFormatSelectionRef\.current === selection[\s\S]{0,600}viewerInteractionIntentRef\.current === intent/, 'the selection is current only while the viewer\'s interaction intent is the one it was captured at (what the wiring emulates)')
  check(assert.match, SRC[VIEWER], /if \(status !== 'saved'\) \{\n(?:[^\n]*STUDIO-ARRANGE[^\n]*\n)?\s*if \(studioShell\) viewerInteractionIntentRef\.current \+= 1\n/, 'a save status other than "saved" retires the selection (the bump the wiring runs)')
  // page.tsx: a confirmed command is followed by a native re-read (what pageSend does)
  check(assert.match, read(PAGE), /const result = await request\.selection\.send\(action, params, target\)[\s\S]{0,700}const refreshed = await request\.selection\.read\(\)/, 'page.tsx re-reads after a confirmed command')
  console.log(`PASS A  strip and byte identity (${checks} checks)`)
}

// ============================================================ B. flag off: outputs identical to the base's
const OFF_VALUES = [undefined, 'false', 'TRUE', '1', ' true']
const env = value => value === undefined ? {} : { [FLAG]: value }
const validProps = id => ({ elementId: id, position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 }, rotation: 0, locked: false, zIndex: 100 })
const TARGETS = {
  text: () => ({ selectionOwner: {}, elementId: 'tb1', presentationId: 'pres-e2e', slideIndex: 0, sessionId: 's', properties: null, kind: 'editable-text', formatting: { padding: '12px' }, box: { padding: '12px' },
    supportedCommands: ['setTextBoxFont', 'setTextBoxPadding'] }),
  shell: () => ({ selectionOwner: {}, elementId: 'tb2', presentationId: 'pres-e2e', slideIndex: 0, sessionId: 's', properties: null, kind: 'textbox-shell', box: { padding: '1px' }, supportedCommands: [] }),
  image: () => ({ selectionOwner: {}, elementId: 'img1', presentationId: 'pres-e2e', slideIndex: 0, sessionId: 's', properties: null, kind: 'element', elementType: 'image', supportedCommands: [] }),
  shape: () => ({ selectionOwner: {}, elementId: 'sh1', presentationId: 'pres-e2e', slideIndex: 0, sessionId: 's', properties: null, kind: 'element', elementType: 'shape', supportedCommands: [] }),
  legacyArrange: () => ({ selectionOwner: {}, elementId: 'img1', presentationId: 'pres-e2e', slideIndex: 0, sessionId: 's', properties: validProps('img1'), kind: 'element', elementType: 'image',
    supportedCommands: ['bringToFront', 'sendToBack', 'bringForward', 'sendBackward', 'alignElement', 'resizeElement', 'positionElement', 'rotateElement', 'flipElement', 'lockElement', 'setElementClasses'] }),
}
async function flagOffInspectorIdentity(src = SRC) {
  const base = loadInspector({}, BASE_SRC[INSPECTOR])
  for (const value of OFF_VALUES) {
    const mod = loadInspector(env(value), src[INSPECTOR])
    assert.equal(mod.STUDIO_ARRANGE, false, `flag ${JSON.stringify(value)} is off`)
    for (const [name, make] of Object.entries(TARGETS)) assert.equal(sha(ssr(mod, make())), sha(ssr(base, make())), `inspector markup (${name}) with the flag ${JSON.stringify(value)} is the base's`)
  }
}
async function handleTranscript(world, modules, run) {
  const out = []
  for (const step of run) {
    const selection = modules.native.createStudioFormatSelectionHandle({ iframe: world.iframe, elementId: step.id, presentationId: 'pres-e2e', sessionId: 's', slideIndex: 0, eventKind: step.kind, elementType: step.type,
      owner: {}, isCurrent: () => true, ...(step.properties ? { arrangeProperties: step.properties } : {}) })
    const target = await selection.read().catch(error => ({ error: error.message }))
    out.push({ id: step.id, target: plain({ ...target, selectionOwner: undefined }) })
    if (!target.error) for (const [action, params] of step.sends || []) out.push({ action, result: { ...plain(await selection.send(action, { elementId: step.id, ...params }, target).catch(error => ({ refused: error.message }))), requestId: undefined } })
  }
  return out
}
const OFF_RUN = [
  { id: 'tb1', kind: 'textBoxSelected', sends: [['setTextBoxPadding', { padding: '8px' }], ['bringToFront', {}], ['positionElement', { x: 0, y: 0 }]] },
  { id: 'img1', kind: 'elementSelected', type: 'image', properties: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 }, rotation: 0, locked: false, zIndex: 100 }, sends: [['bringToFront', {}], ['lockElement', { locked: true }]] },
]
{
  await flagOffInspectorIdentity()
  checks += OFF_VALUES.length * Object.keys(TARGETS).length
  // the handle: with the flag off, the current source's transcript against the viewer is the base source's, byte for byte
  const runs = {}
  for (const [label, src] of [['base', { ...BASE_SRC, [ARRANGE]: null }], ['head', SRC]]) {
    const world = createWorld(`flag-off-handle-${label}`)
    const modules = studioModules({}, src, world.studioWindow)
    runs[label] = { out: await handleTranscript(world, modules, OFF_RUN), requests: plain(world.requests).map(r => ({ ...r, requestId: 'R' })) }
    world.finish()
  }
  check(assert.equal, sha(runs.head.out), sha(runs.base.out), 'flag off: the handle reads and answers exactly as the base\'s')
  check(assert.equal, sha(runs.head.requests), sha(runs.base.requests), 'flag off: the handle sends exactly what the base\'s sends')
  check(assert.ok, runs.head.out.filter(step => step.result?.refused).length >= 3, 'flag off: Arrange commands stay refused before they are sent (as today)')
  check(assert.ok, !runs.head.requests.some(r => ['bringToFront', 'positionElement', 'lockElement'].includes(r.action)), 'flag off: no Arrange command reaches the viewer from the inspector')
  console.log(`PASS B  flag off: inspector markup for ${OFF_VALUES.length} off values x ${Object.keys(TARGETS).length} targets, and the handle's transcript, are the base's (${checks} checks)`)
}

// ============================================================ C. the select path
async function selectPath(value, viewerSource = SRC[VIEWER], src = SRC, label = value ?? 'unset') {
  const world = createWorld(`select-${label}`)
  const wiring = wireSelection(world, env(value), { viewerSource, src })
  for (const id of ['tb1', 'img1', 'ch1']) { world.select(id); await settle(20) }
  world.assertOnScript()
  world.finish()
  return { sent: wiring.sent, inputs: wiring.selections.map(s => ({ id: s.elementId, arrange: 'arrangeProperties' in s.input ? s.input.arrangeProperties : undefined })) }
}
{
  const base = await selectPath(undefined, BASE_SRC[VIEWER], { ...BASE_SRC, [ARRANGE]: null }, 'base')
  check(assert.deepEqual, base.sent.map(s => s.action), ['bringToFront', 'bringToFront', 'bringToFront'], 'base: every selection raises (the defect\'s cause)')
  const off = await selectPath(undefined)
  check(assert.deepEqual, off.sent, base.sent, 'flag off: the select path sends exactly what the base sends')
  check(assert.deepEqual, off.inputs.map(i => i.arrange), [undefined, undefined, undefined], 'flag off: no properties ride the handle input')
  const on = await selectPath('true')
  check(assert.deepEqual, on.sent, [], 'flag on: selecting an element sends NO bringToFront (nor anything else)')
  check(assert.equal, on.inputs[0].arrange, undefined, 'a text box selection carries no properties')
  check(assert.ok, on.inputs[1].arrange && on.inputs[2].arrange, 'an element selection hands its properties to the handle')
  if (live) check(assert.deepEqual, plain({ position: on.inputs[1].arrange.position, size: on.inputs[1].arrange.size }), createWorld('probe-geometry').slideGeometry('img1'), 'with Layout\'s flag on, those properties are Layout\'s slide pixels')
  // the viewer's save-status block: flag off it retires the selection exactly as the base's does; flag on, only Layout's "unsaved" inside the selection's own Arrange command is spared
  const baseSave = await saveStatusRuns(undefined, BASE_SRC[VIEWER], { ...BASE_SRC, [ARRANGE]: null })
  check(assert.equal, baseSave.outside, 4, 'base: unsaved, saving, error and unsaved each retire the selection')
  for (const value of OFF_VALUES) {
    const off = await saveStatusRuns(value)
    check(assert.deepEqual, [off.outside, off.saved.slice(0, 5)], [baseSave.outside, baseSave.saved], `flag ${JSON.stringify(value)}: the save-status block is the base's`)
    check(assert.deepEqual, [off.inside, off.after], [[1, 1, 0, 1, 1], 1], `flag ${JSON.stringify(value)}: nothing is spared, even inside an Arrange command`)
  }
  const onSave = await saveStatusRuns('true')
  check(assert.equal, onSave.outside, 4, 'flag on, no own command in flight: every non-"saved" status retires the selection')
  check(assert.deepEqual, onSave.inside, [0, 1, 0, 1, 0], 'flag on, inside the own command: only "unsaved" is spared ("saving" and "error" still retire)')
  check(assert.equal, onSave.after, 1, 'flag on, after the answer: "unsaved" retires the selection again')
  console.log(`PASS C  select path: base and flag off raise on every selection; flag on sends nothing; the save-status block spares only the own command's "unsaved" (${checks} checks)`)
}

/** The viewer's real save-status block on a bare window: how many times each status sequence retires the selection, outside and inside the selection's own Arrange command. */
async function saveStatusRuns(value, viewerSource = SRC[VIEWER], src = SRC) {
  const listeners = new Set()
  const viewerWindow = {}
  const bare = { studioWindow: { addEventListener: (type, fn) => type === 'message' && listeners.add(fn), removeEventListener: (type, fn) => listeners.delete(fn) }, iframe: { src: `${VIEWER_ORIGIN}/p/pres-e2e`, contentWindow: viewerWindow } }
  const wiring = wireSelection(bare, env(value), { viewerSource, src })
  const post = status => { for (const fn of [...listeners]) fn({ source: viewerWindow, origin: VIEWER_ORIGIN, data: { type: 'saveStatusChanged', status, hasPendingChanges: status !== 'saved' } }) }
  const bumps = statuses => { const before = wiring.intentRef.current; statuses.forEach(post); return wiring.intentRef.current - before }
  const statuses = ['unsaved', 'saving', 'saved', 'error', 'unsaved']
  const outside = bumps(statuses)
  let inside = null, after = null
  if (wiring.modules.arrange?.studioArrangeOwnCommand) {
    let release
    const own = wiring.modules.arrange.studioArrangeOwnCommand(() => new Promise(resolve => { release = resolve }))
    inside = statuses.map(status => bumps([status]))
    release(); await own; await turn()
    after = bumps(['unsaved'])
  }
  return { outside, inside, after, saved: plain(wiring.saveStatuses) }
}

// ============================================================ D. every control -> the exact command, against the viewer
const EXPECT_GEOMETRY = { // slide pixels of DECK's physical grid lines: (line - 1) x 12
  tb1: { position: { x: 60, y: 120 }, size: { width: 960, height: 240 } },
  img1: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 } },
  ch1: { position: { x: 1080, y: 240 }, size: { width: 720, height: 480 } },
  inf1: { position: { x: 120, y: 720 }, size: { width: 600, height: 300 } },
  dg1: { position: { x: 1200, y: 744 }, size: { width: 600, height: 312 } },
}
const WORKING = ['bringToFront', 'sendToBack', 'bringForward', 'sendBackward', 'alignElement', 'resizeElement', 'positionElement', 'lockElement']
const INTENT = { intent: 'arrange' } // Layout's guard: what every Arrange command carries
async function inspectorWorld(name, value = 'true', { layoutFlag = 'on', src = SRC } = {}) {
  const world = createWorld(name, { layoutFlag })
  const wiring = wireSelection(world, env(value), { src })
  const pending = []
  const state = { world, wiring, selection: null, target: null, inspector: null }
  const pageSend = async (action, params, target) => {
    const result = await state.selection.handle.send(action, params, target)
    state.target = await state.selection.handle.read()
    return result
  }
  state.open = async id => {
    const { selection, target } = await selectAndRead(world, wiring, id)
    state.selection = selection; state.target = target
    state.inspector = mountInspector(env(value), { isOpen: true, target, readSnapshot: target, busy: false, onClose() {}, onSendCommand: (...args) => { const p = pageSend(...args); pending.push(p); return p } }, src[INSPECTOR])
    return state
  }
  state.idle = async () => { await settle(); await Promise.allSettled(pending.splice(0)); await settle(); world.assertOnScript(); state.inspector.render({ ...state.inspector.props, target: state.target, readSnapshot: state.target }) }
  state.click = async label => { const [button] = state.inspector.button(label); assert.ok(button, `${name}: control "${label}"`); assert.equal(button.props.disabled, false, `${name}: "${label}" is enabled`); button.props.onClick(); await state.idle() }
  state.type = async (label, value) => { const [input] = state.inspector.input(label); assert.ok(input, `${name}: input "${label}"`); assert.equal(input.props.disabled, false, `${name}: "${label}" is enabled`)
    input.props.onChange({ target: { value: String(value) } }); state.inspector.render(); const [again] = state.inspector.input(label); again.props.onBlur(); await state.idle() }
  state.lastRequest = () => { const r = world.requests.filter(q => WORKING.includes(q.action) || ['rotateElement', 'flipElement', 'setElementClasses'].includes(q.action)).at(-1); return r ? { action: r.action, params: plain(r.params) } : null }
  state.arrangeRequests = () => world.requests.filter(q => [...WORKING, 'rotateElement', 'flipElement', 'setElementClasses'].includes(q.action)).length
  return state
}
const TABLE = [] // control -> command, as observed at the viewer
/** Every control of the Arrange tab, in one order (resize first, so a full-slide element can then move): [control, act, command, params]. */
const controlSteps = s => [
  ['Send to back', () => s.click('Send to back'), 'sendToBack', {}],
  ['Bring to front', () => s.click('Bring to front'), 'bringToFront', {}],
  ['Send backward', () => s.click('Send backward'), 'sendBackward', {}],
  ['Bring forward', () => s.click('Bring forward'), 'bringForward', {}],
  ['Width', () => s.type('Width in slide pixels', 480), 'resizeElement', { width: 480 }],
  ['Height', () => s.type('Height in slide pixels', 216), 'resizeElement', { height: 216 }],
  ['Width, keep proportions', async () => { s.inspector.checkbox()[0].props.onChange({ target: { checked: true } }); s.inspector.render(); await s.type('Width in slide pixels', 240) }, 'resizeElement', { width: 240, maintainAspectRatio: true }],
  ['Align left', () => s.click('Align to slide left'), 'alignElement', { horizontal: 'left' }],
  ['Align center', () => s.click('Align to slide center'), 'alignElement', { horizontal: 'center' }],
  ['Align right', () => s.click('Align to slide right'), 'alignElement', { horizontal: 'right' }],
  ['Align top', () => s.click('Align to slide top'), 'alignElement', { vertical: 'top' }],
  ['Align middle', () => s.click('Align to slide middle'), 'alignElement', { vertical: 'middle' }],
  ['Align bottom', () => s.click('Align to slide bottom'), 'alignElement', { vertical: 'bottom' }],
  ['X', () => s.type('Horizontal position in slide pixels', 240), 'positionElement', () => ({ x: 240, y: s.before.position.y })],
  ['Y', () => s.type('Vertical position in slide pixels', 36), 'positionElement', () => ({ x: s.before.position.x, y: 36 })],
]
/** Lock is disabled with "Not available yet" (STUDIO_ARRANGE_LOCK_ENABLED = false): shown, never enabled, and never sends lockElement, even when its handler is called. */
async function lockHidden(s, id) {
  const [lock] = s.inspector.button('Lock unavailable')
  assert.ok(lock, `${id}: the Lock control is shown`)
  assert.equal(s.inspector.text(lock), 'Lock', `${id}: it reads Lock`)
  assert.equal(lock.props.disabled, true, `${id}: Lock is disabled`)
  assert.match(s.inspector.arrangeText(), /Not available yet: a locked element cannot be selected again to unlock it\./, `${id}: with the note`)
  const sent = s.world.requests.filter(r => r.action === 'lockElement').length
  lock.props.onClick?.(); await s.idle()
  assert.equal(s.world.requests.filter(r => r.action === 'lockElement').length, sent, `${id}: its handler sends no lockElement`)
  assert.equal(s.inspector.failure(), null, `${id}: and shows no notice`)
}
/** The numbers each step leaves (slide pixels): every element ends at 240 x 108, then moves by align and position. */
const AFTER = { 'Width, keep proportions': p => assert.deepEqual(plain(p.size), { width: 240, height: 108 }), 'Align left': p => assert.equal(p.position.x, 0),
  'Align center': p => assert.equal(p.position.x, 840), 'Align right': p => assert.equal(p.position.x, 1680), 'Align top': p => assert.equal(p.position.y, 0),
  'Align middle': p => assert.equal(p.position.y, 492), 'Align bottom': p => assert.equal(p.position.y, 972), X: p => assert.deepEqual(plain(p.position), { x: 240, y: 972 }),
  Y: p => assert.deepEqual(plain(p.position), { x: 240, y: 36 }), Width: p => assert.equal(p.size.width, 480), Height: p => assert.deepEqual(plain(p.size), { width: 480, height: 216 }),
  }
{
  for (const id of Object.keys(EXPECT_GEOMETRY)) {
    const s = await inspectorWorld(`controls-${id}`)
    await s.open(id)
    const geometry = EXPECT_GEOMETRY[id]
    check(assert.deepEqual, plain({ position: s.target.properties.position, size: s.target.properties.size }), geometry, `${id}: the admitted numbers are the slide pixels`)
    if (live) check(assert.deepEqual, plain({ position: s.target.properties.position, size: s.target.properties.size }), s.world.slideGeometry(id), `${id}: equal to Layout's own slideGeometry`)
    check(assert.deepEqual, [...s.target.supportedCommands].filter(c => WORKING.includes(c) || ['rotateElement', 'flipElement', 'setElementClasses'].includes(c)).sort(), [...WORKING].sort(), `${id}: the eight working commands are admitted, never rotate / flip / classes`)
    check(assert.equal, s.inspector.input('Horizontal position in slide pixels')[0].props.value, String(geometry.position.x), `${id}: X shows the slide pixels`)
    check(assert.equal, s.inspector.input('Width in slide pixels')[0].props.value, String(geometry.size.width), `${id}: Width shows the slide pixels`)
    const steps = controlSteps(s)
    for (const [control, act, command, params] of steps) {
      s.before = plain(s.target.properties)
      const count = s.arrangeRequests()
      await act()
      check(assert.equal, s.arrangeRequests(), count + 1, `${id} ${control}: one command`)
      const want = { action: command, params: { elementId: id, ...(typeof params === 'function' ? params() : params), ...INTENT } }
      check(assert.deepEqual, s.lastRequest(), want, `${id} ${control}: ${command} with exactly these params, intent 'arrange' included`)
      check(assert.equal, s.inspector.failure(), null, `${id} ${control}: no failure notice after a confirmed command`)
      check(assert.equal, s.selection.handle.isCurrent(), true, `${id} ${control}: the viewer's own "unsaved" for this change did not retire the selection`)
      check(assert.equal, s.inspector.variant(), 'on', `${id} ${control}: the panel is the full one`)
      if (id === 'tb1') TABLE.push([control, `${command} ${JSON.stringify(want.params).replace(`"elementId":"${id}"`, 'elementId')}`])
      const p = s.target.properties
      check(assert.equal, s.inspector.input('Horizontal position in slide pixels')[0]?.props.value ?? null, p.locked ? null : String(p.position.x), `${id} ${control}: the numbers are the re-read ones`)
      if (AFTER[control]) { checks++; AFTER[control](p) }
      const answer = s.world.events.filter(e => e.frame?.action === command && e.frame.requestId === s.world.requests.at(-1 - s.world.requests.slice().reverse().findIndex(r => r.action === command))?.requestId).at(-1)?.frame
      check(assert.equal, answer?.success, true, `${id} ${control}: the viewer confirmed it`)
      if (answer?.changed === true) check(assert.equal, s.world.pending() ?? true, true, `${id} ${control}: Layout marked the slide for saving (live)`)
    }
    await lockHidden(s, id); checks += 6
    check(assert.equal, s.world.requests.filter(r => r.action === 'lockElement').length, 0, `${id}: the panel never sent lockElement`)
    if (live) {
      const state = s.world.state()[id]
      check(assert.equal, state.locked, false, `${id}: Layout's lock class is off again`)
      check(assert.equal, state.registryLocked, false, `${id}: Layout's registry lock is off again`)
    }
    s.world.finish()
  }
  console.log(`PASS D  every control on a text box, image, chart, infographic and diagram -> the exact command at the viewer, the numbers re-read (${checks} checks)`)
}

// ============================================================ E. errors in plain words, and changed:false
{
  // changed:false: already at the front -> nothing shown, nothing changes
  const s = await inspectorWorld('changed-false')
  await s.open('tb1')
  await s.click('Bring to front')
  const before = plain(s.target.properties)
  await s.click('Bring to front')
  const answer = s.world.events.filter(e => e.frame?.action === 'bringToFront').at(-1).frame
  check(assert.equal, answer.success, true); check(assert.equal, answer.changed, false, 'the viewer answers changed:false')
  check(assert.equal, s.inspector.failure(), null, 'changed:false shows nothing')
  check(assert.deepEqual, plain(s.target.properties), before, 'changed:false changes no number')
  // a refusal: edit mode left
  s.world.setMode('view')
  await s.click('Align to slide left')
  check(assert.match, s.inspector.failure() ?? '', /The slide left edit mode\. Select the element again, then try again\./, 'a refusal is shown in plain words (Edit mode required)')
  check(assert.ok, !(s.inspector.failure() ?? '').includes('Edit mode required'), 'the raw viewer text is not shown')
  s.world.setMode('edit')
  s.world.finish()

  // a change that is NOT the selection's own (a lockElement another caller sent) still retires the selection: Layout's "unsaved" for it bumps the intent as before
  const k = await inspectorWorld('foreign-change')
  await k.open('img1')
  await k.click('Bring to front')
  check(assert.equal, k.selection.handle.isCurrent(), true, 'after its own command the selection is current')
  const foreign = await k.wiring.modules.native.sendStudioFormatNativeCommand(k.world.iframe, 'lockElement', { elementId: 'img1', locked: true, ...INTENT }, () => true, 8000)
  await settle()
  check(assert.equal, foreign.locked, true)
  check(assert.equal, k.selection.handle.isCurrent(), false, 'a foreign change retires the selection (the viewer\'s save status bump, unchanged)')
  check(assert.ok, k.wiring.saveStatuses.includes('unsaved'), 'the viewer saw Layout\'s "unsaved"')
  const sentBefore = k.world.requests.length
  await k.inspector.button('Align to slide right')[0].props.onClick(); await k.idle()
  check(assert.match, k.inspector.failure() ?? '', /Select the element again before formatting\./, 'the stale inspector asks for a new selection')
  check(assert.equal, k.world.requests.length, sentBefore, 'and sends nothing')
  // Layout's own refusal of a locked element, in plain words
  const refusal = await k.wiring.modules.native.sendStudioFormatNativeCommand(k.world.iframe, 'alignElement', { elementId: 'img1', horizontal: 'right', ...INTENT }, () => true, 8000).catch(error => error.message)
  check(assert.equal, refusal, 'Element is locked', 'Layout refuses a move of a locked element')
  check(assert.equal, k.wiring.modules.arrange.studioArrangeErrorText(refusal), 'This element is locked. Unlock it to move, resize or align it.', 'in plain words')
  k.world.finish()

  // Studio's flag on, Layout's off: an element's properties are viewport pixels -> Arrange stays disabled (as today); a text box (no properties) -> the viewer's "Unknown action" in plain words
  const o = await inspectorWorld('layout-off', 'true', { layoutFlag: 'off' })
  await o.open('img1')
  check(assert.equal, o.target.properties, null, 'Layout off: viewport-pixel properties are not admitted')
  check(assert.match, o.inspector.arrangeText(), /Arrangement is unavailable until native properties and commands are confirmed for this selection\./, 'Layout off: the Arrange tab says unavailable, as today')
  await o.open('tb1')
  await o.click('Bring to front')
  check(assert.match, o.inspector.failure() ?? '', /Arranging is not available on this deck yet\./, 'Layout off: Unknown action -> plain words')
  o.world.finish()

  // invalid params never reach the viewer
  const v = await inspectorWorld('invalid-params')
  await v.open('ch1')
  const count = v.world.requests.length
  for (const [action, params] of [['alignElement', { horizontal: 'diagonal' }], ['alignElement', {}], ['positionElement', { x: 1 }], ['positionElement', { x: 'a', y: 2 }], ['resizeElement', { width: 0 }],
    ['resizeElement', { maintainAspectRatio: true }], ['lockElement', { locked: 'yes' }], ['bringToFront', { extra: 1 }], ['rotateElement', { angle: 4 }], ['flipElement', { direction: 'horizontal' }], ['setElementClasses', { classes: ['x'] }]]) {
    await check(assert.rejects, v.selection.handle.send(action, { elementId: 'ch1', ...params }, v.target), /unavailable for the current selection/, `${action} ${JSON.stringify(params)} is refused before sending`)
  }
  check(assert.equal, v.world.requests.length, count, 'nothing invalid was sent')
  v.world.finish()
  // the older builds' select-raise (components/presentation-viewer.tsx on Studio uat ee532fab :2433 / :2467, main 5878eaf8 :2395 / :2429): bringToFront {elementId}, NO intent. At the viewer (Layout's
  // flag on) it is the no-op it was before the flag: "Unknown action", no z-index or lock change, nothing marked for saving. With the intent the same command acts.
  const g = await inspectorWorld('legacy-select-raise')
  await g.open('inf1')
  const zBefore = g.world.state()?.inf1?.zIndex ?? null
  for (const id of ['tb1', 'img1', 'ch1', 'inf1', 'dg1']) {
    const legacy = await g.wiring.modules.native.sendStudioFormatNativeCommand(g.world.iframe, 'bringToFront', { elementId: id }, () => true, 8000).catch(error => error.message)
    check(assert.equal, legacy, 'Unknown action: bringToFront', `${id}: the legacy select-raise (no intent) is unknown at the viewer`)
  }
  if (live) {
    check(assert.equal, g.world.state().inf1.zIndex, zBefore, 'the legacy select-raise changed no z-index')
    check(assert.equal, g.world.pending(), false, 'the legacy select-raise marked nothing for saving')
  }
  const raised = await g.wiring.modules.native.sendStudioFormatNativeCommand(g.world.iframe, 'bringToFront', { elementId: 'inf1', ...INTENT }, () => true, 8000)
  check(assert.equal, raised.success, true, 'the same command with intent \'arrange\' acts')
  if (live) check(assert.ok, Number(g.world.state().inf1.zIndex) > Number(zBefore), 'and raises the element')
  g.world.finish()
  console.log(`PASS E  changed:false shows nothing; refusals in plain words; invalid params never sent; the legacy select-raise (no intent) is a no-op at the viewer (${checks} checks)`)
}

// ============================================================ F. disabled states
{
  for (const id of ['sh1', 'tbl1']) {
    const s = await inspectorWorld(`not-yet-${id}`)
    await s.open(id)
    check(assert.equal, s.target.properties, null, `${id}: no properties admitted`)
    check(assert.ok, !s.target.supportedCommands.some(c => WORKING.includes(c)), `${id}: no Arrange command admitted`)
    const controls = s.inspector.within('Arrange', n => n.type === 'button' || n.type === 'input')
    check(assert.ok, controls.length >= 14, `${id}: the controls are shown`)
    check(assert.ok, controls.every(n => n.props.disabled === true), `${id}: every Arrange control is disabled`)
    check(assert.match, s.inspector.arrangeText(), /Not available yet for shapes and tables\./, `${id}: the note`)
    const count = s.arrangeRequests()
    for (const n of s.inspector.within('Arrange', n => n.type === 'button')) n.props.onClick?.()
    await s.idle()
    check(assert.equal, s.arrangeRequests(), count, `${id}: a click sends nothing`)
    s.world.finish()
  }
  for (const id of ['tb1', 'img1']) {
    const s = await inspectorWorld(`not-yet-controls-${id}`)
    await s.open(id)
    for (const label of ['Rotate unavailable', 'Element CSS classes unavailable']) {
      const [input] = s.inspector.input(label)
      check(assert.ok, input && input.props.disabled === true && input.props.placeholder === 'Not available yet', `${id}: ${label} disabled, "Not available yet"`)
    }
    for (const label of ['Flip horizontally unavailable', 'Flip vertically unavailable']) check(assert.equal, s.inspector.button(label)[0]?.props.disabled, true, `${id}: ${label} disabled`)
    check(assert.match, s.inspector.arrangeText(), /Rotate, flip and style classes are not available yet\./)
    s.world.finish()
  }
  for (const id of ['lk1', 'lkt']) {
    const s = await inspectorWorld(`locked-${id}`)
    await s.open(id)
    check(assert.equal, s.target.properties.locked, true, `${id}: read as locked`)
    check(assert.deepEqual, [...s.target.supportedCommands].filter(c => WORKING.includes(c)), ['lockElement'], `${id}: only lockElement admitted`)
    check(assert.deepEqual, s.inspector.within('Arrange', n => n.type === 'button' || n.type === 'input').map(n => s.inspector.text(n)), ['Unlock'], `${id}: only Unlock is shown`)
    check(assert.match, s.inspector.arrangeText(), /This element is locked\. Unlock it to arrange it\./)
    await s.click('Unlock')
    check(assert.deepEqual, s.lastRequest(), { action: 'lockElement', params: { elementId: id, locked: false, ...INTENT } }, `${id}: Unlock sends lockElement {locked: false, intent: 'arrange'}`)
    check(assert.equal, s.target.properties.locked, false, `${id}: unlocked`)
    check(assert.ok, s.inspector.button('Bring to front')[0]?.props.disabled === false, `${id}: the controls are back`)
    s.world.finish()
  }
  // labels, and 44 px targets on phones (the inspector's own size from md up)
  {
    const s = await inspectorWorld('a11y')
    await s.open('ch1')
    const controls = s.inspector.within('Arrange', n => (n.type === 'button' || n.type === 'input') && n.props.type !== 'checkbox')
    check(assert.ok, controls.every(n => / min-h-\[44px\] md:min-h-0 |^min-h-\[44px\] md:min-h-0 /.test(n.props.className)), 'every Arrange button and field is 44 px tall on phones')
    check(assert.ok, controls.filter(n => n.type === 'input').every(n => typeof n.props['aria-label'] === 'string' && n.props['aria-label']), 'every field is labelled')
    check(assert.ok, controls.filter(n => n.type === 'button').every(n => n.props['aria-label'] || s.inspector.text(n).trim()), 'every button has a name')
    check(assert.ok, !/text-(sm|base|lg)/.test(SRC[INSPECTOR].split('\n').filter(l => strip.STUDIO_ARRANGE_MARKER_RE.test(l)).join('\n')), 'text stays at the inspector\'s size')
    s.world.finish()
  }
  console.log(`PASS F  shapes and tables disabled with the note; rotate, flip, classes "Not available yet"; locked -> Unlock only; labels and phone targets (${checks} checks)`)
}

// ============================================================ INTENT: every Arrange command the inspector sent, in every world above, carried intent 'arrange'
{
  const ARRANGE_ACTIONS = [...WORKING, 'rotateElement', 'flipElement', 'setElementClasses']
  let commands = 0, legacy = 0
  for (const [name, requests] of Object.entries(INTENT_LOG)) for (const request of requests) {
    if (!ARRANGE_ACTIONS.includes(request.action)) continue
    if (name === 'legacy-select-raise' && request.params?.intent === undefined) { legacy++; continue } // section E's own legacy payloads
    commands++
    check(assert.equal, request.params?.intent, 'arrange', `${name}: ${request.action} carries intent 'arrange'`)
  }
  check(assert.ok, commands >= 80, `every Arrange command checked (${commands})`)
  check(assert.equal, legacy, 5, 'only the five legacy select-raise payloads went without it')
  console.log(`PASS I  intent: ${commands} Arrange commands at the viewer, every one with intent 'arrange' (${checks} checks)`)
}

// ============================================================ G. scope over this change's own commits
{
  const NEWEST = git('log', '-1', '--format=%H', '-E', '--grep=^Studio arrange:', 'HEAD').trim() // this change's newest commit, its merges of dev included (a change stacked after it is not read as its diff)
  // #523 was merged into dev at FOLLOW_UP_BASE; a follow-up (the intent 'arrange' commit) is cut from dev after it. Each is held to its own range: #523 to BASE..its last commit, a follow-up to
  // FOLLOW_UP_BASE..its newest commit (dev's other merged work between them is neither's).
  const PR523_HEAD = 'df15abc0b5fb8eeb69f109ed608fbd30e43ae2b2'
  const FOLLOW_UP_BASE = '0545569384ae3f6f7073699bff95662ec80c633a' // studio-v4-dev-preparation-code at #523's merge
  const isAncestor = (a, b) => { try { git('merge-base', '--is-ancestor', a, b); return true } catch { return false } }
  const followUp = Boolean(NEWEST) && NEWEST !== FOLLOW_UP_BASE && isAncestor(FOLLOW_UP_BASE, NEWEST)
  const HEAD = followUp ? PR523_HEAD : NEWEST
  if (!HEAD) {
    console.log('SKIP G  nothing committed yet ("Studio arrange:" commits)')
  } else {
    if (followUp) {
      const own = git('log', '--format=%s', '--no-merges', `${FOLLOW_UP_BASE}..${NEWEST}`).trim().split('\n').filter(Boolean)
      check(assert.ok, own.length > 0 && own.every(subject => strip.STUDIO_ARRANGE_COMMIT_SUBJECT.test(subject)), `follow-up: every commit on ${FOLLOW_UP_BASE.slice(0, 8)}..${NEWEST.slice(0, 8)} is "Studio arrange:"`)
      const touched = git('diff', '--name-only', `${FOLLOW_UP_BASE}..${NEWEST}`).trim().split('\n').filter(Boolean)
      for (const file of touched) check(assert.ok, strip.STUDIO_ARRANGE_SCOPE_FILES.has(file) && !strip.STUDIO_ARRANGE_PIN_FILES.includes(file), `follow-up in scope: ${file}`)
      for (const rel of strip.STUDIO_ARRANGE_FILES) {
        const lines = git('diff', '-U0', `${FOLLOW_UP_BASE}..${NEWEST}`, '--', rel).split('\n').filter(l => /^[+-](?![+-])/.test(l))
        check(assert.ok, lines.every(l => strip.STUDIO_ARRANGE_MARKER_RE.test(l)), `follow-up: ${rel} changes only marked lines`)
      }
      console.log(`PASS G  follow-up: ${touched.length} files on ${FOLLOW_UP_BASE.slice(0, 8)}..${NEWEST.slice(0, 8)}, all this change's, marked lines only (${checks} checks)`)
    }
    const subjects = git('log', '--format=%s', '--no-merges', `${BASE}..${HEAD}`).trim().split('\n').filter(Boolean)
    check(assert.ok, subjects.length > 0 && subjects.every(subject => strip.STUDIO_ARRANGE_COMMIT_SUBJECT.test(subject)), `every commit on ${BASE.slice(0, 8)}..${HEAD.slice(0, 8)} is this change's ("Studio arrange:")`)
    const files = git('diff', '--name-only', `${BASE}..${HEAD}`).trim().split('\n').filter(Boolean)
    for (const file of files) check(assert.ok, strip.STUDIO_ARRANGE_SCOPE_FILES.has(file), `in scope: ${file}`)
    for (const file of strip.STUDIO_ARRANGE_SCOPE_FILES) check(assert.ok, files.includes(file), `committed: ${file}`)
    for (const line of git('diff', '--numstat', `${BASE}..${HEAD}`).trim().split('\n')) {
      const [added, removed, file] = line.split('\t')
      if (strip.STUDIO_ARRANGE_PIN_FILES.includes(file)) { const edits = strip.STUDIO_ARRANGE_PIN_EDITS[file]; check(assert.deepEqual, [added, removed], [String(edits.length), String(edits.filter(([, was]) => was !== '').length)], `${file}: only its taught lines`) }
      else check(assert.equal, removed, '0', `${file}: pure insertions`)
    }
    for (const rel of strip.STUDIO_ARRANGE_FILES) {
      const added = git('diff', '-U0', `${BASE}..${HEAD}`, '--', rel).split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'))
      check(assert.ok, added.length > 0 && added.every(l => strip.STUDIO_ARRANGE_MARKER_RE.test(l)), `${rel}: every committed added line carries the marker`)
    }
    console.log(`PASS G  scope: ${files.length} files on ${BASE.slice(0, 8)}..${HEAD.slice(0, 8)}, all registered, marked files pure insertions (${checks} checks)`)
  }
}

if (record) {
  transcript.layout = { flag: layoutHarness.LAYOUT_FLAG, served: JSON.parse(fs.readFileSync(path.join(servedDir, 'served.json'), 'utf8')),
    sources: Object.fromEntries(layoutHarness.LAYOUT_SCRIPTS.map(file => [file, sha(fs.readFileSync(path.join(layoutDir, file), 'utf8'))])),
    served_by: 'scripts/fixtures/studio-arrange/serve-layout-viewer.py (server.py /p/<id> in process, flag unset and "true", FRONTEND_ALLOWED_ORIGINS=' + STUDIO_ORIGIN + ')' }
  const lines = ['{', `  "layout": ${JSON.stringify(transcript.layout)},`, '  "worlds": {']
  const names = Object.keys(transcript.worlds)
  names.forEach((name, i) => {
    lines.push(`    ${JSON.stringify(name)}: [`)
    transcript.worlds[name].forEach((event, j) => lines.push(`      ${JSON.stringify(normalize(event))}${j < transcript.worlds[name].length - 1 ? ',' : ''}`)) // requestIds are this run's random ones: recorded as "R"
    lines.push(`    ]${i < names.length - 1 ? ',' : ''}`)
  })
  lines.push('  }', '}')
  fs.writeFileSync(path.join(root, FIXTURE), lines.join('\n') + '\n')
  console.log(`RECORDED ${FIXTURE}: ${names.length} worlds, ${names.reduce((n, name) => n + transcript.worlds[name].length, 0)} events`)
} else if (live) {
  // the live run says exactly what was recorded
  const fixture = JSON.parse(read(FIXTURE))
  for (const [file, digest] of Object.entries(fixture.layout.sources)) check(assert.equal, sha(fs.readFileSync(path.join(layoutDir, file), 'utf8')), digest, `the checkout's ${file} is the recorded one`)
  for (const name of Object.keys(transcript.worlds)) check(assert.deepEqual, plain(transcript.worlds[name]).map(e => normalize(e)), fixture.worlds[name].map(e => normalize(e)), `live ${name} is the recording`)
  console.log('PASS    live Layout code says exactly what the recording says')
} else {
  console.log(`PASS    recording: Layout's sources (!260 + the intent guard) ${Object.entries(recorded.layout.sources).map(([f, d]) => `${path.basename(f)} ${d.slice(0, 8)}`).join(', ')}; served on ${recorded.layout.served.on.sha256.slice(0, 8)}, off ${recorded.layout.served.off.sha256.slice(0, 8)}`)
}
function normalize(event) {
  const copy = structuredClone(event)
  for (const value of Object.values(copy)) if (value && typeof value === 'object' && 'requestId' in value) value.requestId = 'R'
  return copy
}

// ============================================================ H. mutants (each must be caught)
if (!record) {
  const SCENARIO = async src => {
    // a compact run of the claims: flag off identity, the select path, a control table slice, locked, shapes, an error
    await flagOffInspectorIdentity(src)
    const off = await selectPath(undefined, src[VIEWER], src, 'unset')
    assert.deepEqual(off.sent.map(s => s.action), ['bringToFront', 'bringToFront', 'bringToFront'])
    const on = await selectPath('true', src[VIEWER], src, 'true')
    assert.deepEqual(on.sent, [])
    assert.ok(on.inputs[1].arrange)
    const s = await inspectorWorld('controls-ch1', 'true', { src })
    await s.open('ch1')
    assert.deepEqual(plain({ position: s.target.properties.position, size: s.target.properties.size }), EXPECT_GEOMETRY.ch1)
    for (const [control, act, command, params] of controlSteps(s)) {
      s.before = plain(s.target.properties)
      await act()
      assert.deepEqual(s.lastRequest(), { action: command, params: { elementId: 'ch1', ...(typeof params === 'function' ? params() : params), ...INTENT } }, control)
      if (AFTER[control]) AFTER[control](s.target.properties)
      assert.equal(s.inspector.failure(), null, `${control}: no failure notice`)
      assert.equal(s.selection.handle.isCurrent(), true, `${control}: still current`)
      assert.equal(s.inspector.variant(), 'on', `${control}: panel variant`)
      const p = s.target.properties
      assert.equal(s.inspector.input('Horizontal position in slide pixels')[0]?.props.value ?? null, p.locked ? null : String(p.position.x), `${control}: the numbers are the re-read ones`)
    }
    const save = await saveStatusRuns('true', src[VIEWER], src)
    assert.deepEqual([save.outside, save.inside, save.after], [4, [0, 1, 0, 1, 0], 1])
    const k = await inspectorWorld('foreign-change', 'true', { src })
    await k.open('img1'); await k.click('Bring to front'); assert.equal(k.selection.handle.isCurrent(), true)
    await k.wiring.modules.native.sendStudioFormatNativeCommand(k.world.iframe, 'lockElement', { elementId: 'img1', locked: true, ...INTENT }, () => true, 8000); await settle()
    assert.equal(k.selection.handle.isCurrent(), false, 'a foreign change retires the selection')
    for (const label of ['Rotate unavailable', 'Element CSS classes unavailable']) assert.equal(s.inspector.input(label)[0].props.disabled, true)
    await lockHidden(s, 'ch1')
    assert.equal(s.world.requests.filter(r => r.action === 'lockElement').length, 0)
    const sh = await inspectorWorld('not-yet-sh1', 'true', { src })
    await sh.open('sh1')
    assert.equal(sh.target.properties, null); assert.ok(!sh.target.supportedCommands.some(c => WORKING.includes(c)))
    assert.ok(sh.inspector.within('Arrange', n => n.type === 'button' || n.type === 'input').every(n => n.props.disabled === true))
    assert.match(sh.inspector.arrangeText(), /Not available yet for shapes and tables\./)
    const lk = await inspectorWorld('locked-lk1', 'true', { src })
    await lk.open('lk1')
    assert.deepEqual([...lk.target.supportedCommands].filter(c => WORKING.includes(c)), ['lockElement'])
    assert.deepEqual(lk.inspector.within('Arrange', n => n.type === 'button' || n.type === 'input').map(n => lk.inspector.text(n)), ['Unlock'])
    await lk.click('Unlock'); assert.equal(lk.target.properties.locked, false)
    const o = await inspectorWorld('layout-off', 'true', { layoutFlag: 'off', src })
    await o.open('img1'); assert.equal(o.target.properties, null)
    await o.open('tb1'); await o.click('Bring to front'); assert.match(o.inspector.failure() ?? '', /Arranging is not available on this deck yet\./)
  }
  await SCENARIO(SRC) // the control: the real sources pass
  const M = (file, from, to, name) => ({ file, from, to, name })
  const mutants = [
    M(ARRANGE, "process.env.NEXT_PUBLIC_STUDIO_ARRANGE === 'true'", "process.env.NEXT_PUBLIC_STUDIO_ARRANGE !== 'false'", 'flag: not exact "true"'),
    M(ARRANGE, '  return !STUDIO_ARRANGE_ENABLED\n', '  return true\n', 'select-raise guard: always raises'),
    M(ARRANGE, "return STUDIO_ARRANGE_ENABLED && eventKind === 'elementSelected' && record(properties)", "return STUDIO_ARRANGE_ENABLED && eventKind === 'textBoxSelected' && record(properties)", 'element properties never reach the handle'),
    M(ARRANGE, "const CELL = 12 ", "const CELL = 10 ", 'geometry: wrong cell size'),
    M(ARRANGE, "    if (!confirmed && !studioArrangeSlidePixels(input.arrangeProperties, geometry)) return unchanged\n", "", 'viewport-pixel properties admitted'),
    M(ARRANGE, "const commands = locked ? ['lockElement'] : [...STUDIO_ARRANGE_COMMANDS]", "const commands = [...STUDIO_ARRANGE_COMMANDS]", 'locked: every command admitted'),
    M(ARRANGE, "export const STUDIO_ARRANGE_TYPES = ['textbox', 'image', 'chart', 'infographic', 'diagram'] as const", "export const STUDIO_ARRANGE_TYPES = ['textbox', 'image', 'chart', 'infographic', 'diagram', 'shape'] as const", 'shapes admitted'),
    M(ARRANGE, "if (/^Unknown action: /.test(message) || / is not available$/.test(message)) return 'Arranging is not available on this deck yet.'", "", 'Unknown action not in plain words'),
    M(NATIVE, "        if (STUDIO_ARRANGE_ENABLED && admitted) { const next", "        if (false && admitted) { const next", 'Arrange never admitted'),
    M(NATIVE, "arrange.confirmedLock = studioArrangeConfirmedLock(arrange.confirmedLock, action, answer); ", "", 'the confirmed lock is forgotten'),
    M(NATIVE, "throw error instanceof Error ? new Error(studioArrangeErrorText(error.message)) : error", "throw error", 'refusals in raw viewer words'),
    M(VIEWER, "        if (studioArrangeRaisesOnSelect()) // STUDIO-ARRANGE: the select-raise only while NEXT_PUBLIC_STUDIO_ARRANGE is off (the one guard: lib/studio-arrange.ts)\n        void sendCommand(interaction?.iframe ?? iframeRef.current, 'bringToFront', { elementId }).catch((error) => {\n          console.warn('[PresentationViewer] Failed to bring selected element", "        void sendCommand(interaction?.iframe ?? iframeRef.current, 'bringToFront', { elementId }).catch((error) => {\n          console.warn('[PresentationViewer] Failed to bring selected element", 'element select-raise unguarded'),
    M(VIEWER, "        studioArrangeSelectionRef.current = properties // STUDIO-ARRANGE", "        studioArrangeSelectionRef.current = null // STUDIO-ARRANGE", 'element properties not captured'),
    M(INSPECTOR, "[['sendToBack', 'Send to back'], ['sendBackward', 'Send backward'], ['bringForward', 'Bring forward'], ['bringToFront', 'Bring to front']]", "[['sendToBack', 'Send to back'], ['sendBackward', 'Send backward'], ['bringToFront', 'Bring forward'], ['bringForward', 'Bring to front']]", 'order buttons swapped'),
    M(INSPECTOR, "y: axis === 'y' ? next : properties.position.y", "y: next", 'X blur moves Y too'),
    M(INSPECTOR, "...(keepRatio ? { maintainAspectRatio: true } : {})", "", 'keep proportions ignored'),
    M(INSPECTOR, '<input aria-label="Rotate unavailable" disabled placeholder', '<input aria-label="Rotate unavailable" placeholder', 'rotate enabled'),
    M(INSPECTOR, "  if (properties?.locked && !notYet) return", "  if (false && properties?.locked && !notYet) return", 'locked shows every control'),
    M(INSPECTOR, "  const notYet = studioArrangeNotYet(target) // STUDIO-ARRANGE\n", "  const notYet = false // STUDIO-ARRANGE\n", 'shapes and tables not marked'),
    M(INSPECTOR, "{STUDIO_ARRANGE && (nativeProperties || studioArrangeNotYet(target)) ?", "{(nativeProperties || studioArrangeNotYet(target)) ?", 'inspector ignores the flag'),
    // follow-up (PNG run on Layout 0aaef720): the false "not confirmed" notice and the Lock panel that did not refresh
    M(VIEWER, "          if (!studioArrangeOwnsSaveStatus(status)) // STUDIO-ARRANGE", "          if (true) // STUDIO-ARRANGE", 'the own command\'s "unsaved" retires the selection again (the false notice)'),
    M(NATIVE, "const answer = await studioArrangeOwnCommand(() => native(action, studioArrangeCommandParams(commandParams), 30000))", "const answer = await (() => native(action, studioArrangeCommandParams(commandParams), 30000))()", 'the arrange send runs outside the own-command window'),
    // intent 'arrange' (Layout's guard)
    M(NATIVE, "native(action, studioArrangeCommandParams(commandParams), 30000)", "native(action, commandParams, 30000)", 'Arrange sent without the intent'),
    M(ARRANGE, "export const STUDIO_ARRANGE_INTENT = 'arrange'", "export const STUDIO_ARRANGE_INTENT = 'Arrange'", 'the wrong intent word'),
    M(ARRANGE, "({ ...params, intent: STUDIO_ARRANGE_INTENT })", "({ intent: STUDIO_ARRANGE_INTENT, ...params, elementId: undefined })", 'the intent replaces the params'),
    M(ARRANGE, "  ownCommand = token\n", "", 'the own-command window never opens'),
    M(ARRANGE, "  return run().finally(() => { if (ownCommand === token) ownCommand = null })", "  return run()", 'the own-command window never closes (a foreign change would not retire the selection)'),
    M(ARRANGE, "return STUDIO_ARRANGE_ENABLED && ownCommand !== null && status === 'unsaved'", "return STUDIO_ARRANGE_ENABLED && ownCommand !== null", 'every save status is spared inside the window'),
    M(INSPECTOR, "<StudioArrange key={`arrange-${readRevision}`}", "<StudioArrange key=\"arrange\"", 'the numbers do not refresh after a change'),
    // Lock hidden until Layout lets a locked element be selected again (PROGRAM-1's GO, 26 Oct)
    M(INSPECTOR, "export const STUDIO_ARRANGE_LOCK_ENABLED = false // STUDIO-ARRANGE", "export const STUDIO_ARRANGE_LOCK_ENABLED = true // STUDIO-ARRANGE", 'Lock enabled again'),
    M(INSPECTOR, "disabled={!STUDIO_ARRANGE_LOCK_ENABLED || !allowed('lockElement')}", "disabled={!allowed('lockElement')}", 'the Lock button ignores the constant'),
    M(INSPECTOR, "onClick={() => { if (STUDIO_ARRANGE_LOCK_ENABLED) call('lockElement', { locked: true }) }}", "onClick={() => { call('lockElement', { locked: true }) }}", 'the Lock handler ignores the constant'),
    M(INSPECTOR, "{!STUDIO_ARRANGE_LOCK_ENABLED && <p className=\"text-xs\" role=\"status\">Not available yet: a locked element cannot be selected again to unlock it.</p>}", "{null}", 'Lock disabled without the note'),
  ]
  let caught = 0
  for (const mutant of mutants) {
    assert.ok(SRC[mutant.file].includes(mutant.from), `mutant "${mutant.name}" no longer matches the source`)
    const src = { ...SRC, [mutant.file]: SRC[mutant.file].replace(mutant.from, mutant.to) }
    assert.notEqual(src[mutant.file], SRC[mutant.file], `mutant "${mutant.name}" changes nothing`)
    transpile(src[mutant.file], mutant.file) // a mutant must be valid code: it is caught by behaviour, not by a syntax error
    let survived = true
    try { await SCENARIO(src) } catch { survived = false }
    assert.equal(survived, false, `mutant survived: ${mutant.name}`)
    caught++
  }
  check(assert.equal, caught, mutants.length)
  console.log(`PASS H  ${caught} of ${mutants.length} mutants caught (the real sources pass the same run)`)
}

console.log(`Studio arrange (NEXT_PUBLIC_STUDIO_ARRANGE): ${checks} checks passed. Layout: ${live ? 'live code of the checkout' : 'recorded real transcript'}.`)
if (process.env.STUDIO_ARRANGE_PRINT_TABLE) for (const [control, command] of TABLE) console.log(`  ${control.padEnd(26)} ${command}`)
