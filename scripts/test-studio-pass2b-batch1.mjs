// PASS2B batch 1 (ELEMENT-2, canvas audit J3-01 / J5-01 / J6-01 / J3-05 / J3-04). Three default-off switches, each exact "true":
//   A  NEXT_PUBLIC_STUDIO_DISABLED_REASONS  greyed Add Slide / Add Element / Template / Theme buttons say why (tooltip on hover AND keyboard focus,
//      aria-disabled + aria-describedby), the Add Element cards say why in the gallery, and a greyed research source shows its reason as a visible line;
//      it EXTENDS the ONE_LIVE_TAB (#396) wrapper in components/presentation-viewer.tsx (`tabPausedWrap`), it is not a second mechanism.
//   B  NEXT_PUBLIC_STUDIO_GENERATING_STATUS  while an element generates: "Generating chart… usually 10–30 s" in an aria-live line under the prompt box,
//      and Escape closes the panel while generating exactly as the header's ✕ does (the same onClose; it does not abort the request).
//   C  the existing NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD (#398, still default off): a blocked Generate keeps its name "Generate (⌘↵)" and is described
//      by the hint (aria-describedby), not only by the title.
//
// Proves, offline (no socket, fetch, timer or network; the #371 harness pattern: the REAL panel, forms, input, gallery, research controls and libs run in
// mini-react; the REAL toolbar block of components/presentation-viewer.tsx is cut out by AST and evaluated; only Radix wrappers and icons are stubbed):
//   1. the libs: flag literals, the reason table, the status copy per type, the Escape rule;
//   2. the toolbar block of the viewer: flag off == the base viewer's toolbar (256 states, markup and child slots); flag on: a reason exists exactly when
//      the control's own `disabled` is true (read from the viewer's code, every state), the words, the paused-tab sentence, the fullscreen portal;
//   3. the wrapper component: a keyboard tab stop only while disabled, the tooltip opens on focus and on hover, closes on blur and on Escape, the
//      accessible name/role/state/description, the wrapped control is never remounted when it toggles; a real-Radix server render for the wiring;
//   4. the Add Element gallery and the research sources;
//   5. the panel: the status line per type (copy, aria-live, always in the tree), Escape == ✕ while generating, no new cancel semantics, an Escape from a
//      text field outside the panel is left alone, the empty-prompt button's name and description in both shells;
//   6. flag off == base: traces of the whole panel (markup per step, every call) hash-equal to the base tree under flags unset / "false" / "TRUE" / "1";
//   7. wiring and the files this change must not touch; no Layout viewer command touched;
//   8. mutants of the libs, the component, the viewer, the gallery, the research controls, the panel and the input must each be caught.
//
//   node scripts/test-studio-pass2b-batch1.mjs
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { Root, hostNodes, textOf, toElements } from './studio-chat-harness/mini-react.mjs'
import { lucideStub } from './studio-chat-harness/esm-packages.mjs'

for (const name of Object.keys(process.env)) if (/KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD/i.test(name)) delete process.env[name]
// React's dev-only warnings about the test stubs' props (a `checked` without onChange, a custom tag, a prop a div does not know) are not findings.
const reactNoise = /You provided a `checked`|incorrect casing|React does not recognize|is unrecognized in this browser|Invalid DOM property|non-boolean attribute|Received `(true|false)` for a non-boolean/
const consoleError = console.error.bind(console)
console.error = (...args) => { if (typeof args[0] === 'string' && reactNoise.test(args[0])) return; consoleError(...args) }
const denied = () => { throw new Error('Offline harness forbids network') }
net.connect = net.createConnection = net.Socket.prototype.connect = denied
http.request = http.get = https.request = https.get = denied
globalThis.fetch = denied

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** studio-v4-dev-preparation-code at #401: flag off must behave exactly as this. */
const BASE_SHA = '506f32fcc4e202b853d984a01b1ff1ce3229414e'
/** studio-v4-dev-preparation-code at #404: the frozen files below must equal this (they were not touched by PASS2B batch 1 or 2). */
const FROZEN_SHA = 'dd47bd58855636abae0ab2fdb7409c575a8f07ed'
const FLAG_A = 'NEXT_PUBLIC_STUDIO_DISABLED_REASONS'
const FLAG_B = 'NEXT_PUBLIC_STUDIO_GENERATING_STATUS'
const FLAG_C = 'NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD'
const LIB_A = 'lib/studio-disabled-reasons.ts'
const LIB_B = 'lib/studio-generating-status.ts'
const COMPONENT = 'components/studio-disabled-reason.tsx'
const VIEWER = 'components/presentation-viewer.tsx'
const GALLERY = 'components/studio-element-gallery.tsx'
const RESEARCH = 'components/generation-panel/shared/research-controls.tsx'
const PANEL = 'components/generation-panel/index.tsx'
const INPUT = 'components/generation-panel/shared/generation-input.tsx'
const HINT = 'Describe what you want to generate'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16)

const gitEnv = { ...process.env }
delete gitEnv.GIT_DIR
delete gitEnv.GIT_WORK_TREE
const git = args => execFileSync('git', args, { cwd: root, env: gitEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_SHA}^{commit}`]) } catch { baseAvailable = false }
const baseFile = rel => git(['show', `${BASE_SHA}:${rel}`])
/** The base tree = this tree with every file of the generation panel (and the gallery) read from BASE_SHA. */
function baseOverrides() {
  const overrides = { [GALLERY]: baseFile(GALLERY) }
  for (const file of git(['ls-tree', '-r', '--name-only', BASE_SHA, 'components/generation-panel']).split('\n').filter(Boolean)) {
    if (/\.(tsx?)$/.test(file)) overrides[file] = baseFile(file)
  }
  return overrides
}

let testCount = 0
const failures = []
async function check(name, fn) {
  testCount += 1
  try { await fn(); console.log(`ok   ${name}`) } catch (error) {
    failures.push(name)
    console.log(`FAIL ${name}\n     ${String(error?.stack ?? error).split('\n').slice(0, 5).join('\n     ')}`)
  }
}
/** Mutually quiet render of server markup (unknown test tags make React warn; the markup is what is asserted). */
function quietly(fn) {
  const original = console.error
  console.error = () => {}
  try { return fn() } finally { console.error = original }
}

// ---- loader: the repo's own modules, transpiled on require -----------------------------------------------------------------------
const compileCache = new Map()
const compile = (rel, source) => {
  if (!compileCache.has(source)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile`)
    compileCache.set(source, out.outputText)
  }
  return compileCache.get(source)
}
const passThrough = name => props => React.createElement('div', { 'data-fixture': name }, props.children)
/** Menu parts as plain host elements that keep their props, so a test can read title / aria / disabled off them. */
const menuPart = (tag, role) => ({ children, textValue, asChild, ...props }) => React.createElement(tag, { role, ...props }, children)
const baseStubs = {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'lucide-react': lucideStub(React),
  '@/components/ui/popover': { __esModule: true, Popover: passThrough('popover'), PopoverTrigger: passThrough('popover-trigger'), PopoverContent: passThrough('popover-content') },
  '@/components/ui/tooltip': { __esModule: true, Tooltip: passThrough('tooltip'), TooltipTrigger: passThrough('tooltip-trigger'), TooltipContent: passThrough('tooltip-content'), TooltipProvider: passThrough('tooltip-provider') },
  '@/components/ui/switch': { __esModule: true, Switch: props => React.createElement('button', { role: 'switch', ...props }) },
  '@/components/ui/checkbox': { __esModule: true, Checkbox: props => React.createElement('input', { type: 'checkbox', ...props }) },
  '@/components/ui/dropdown-menu': { __esModule: true, DropdownMenuContent: menuPart('div', 'menu'), DropdownMenuItem: menuPart('div', 'menuitem'), DropdownMenuLabel: menuPart('div', undefined) },
}
/** A Radix Tooltip with Radix's observable contract: Trigger (asChild) opens on focus and on pointer move and closes on blur / leave / Escape; Content
 * renders only while open; the child's own props win over the trigger's (Slot's merge). mini-react has no context, so Root hands its state down. */
const fakeRadixTooltip = {
  __esModule: true,
  Provider: ({ children }) => children,
  Root: ({ children }) => {
    const [open, setOpen] = React.useState(false)
    const tip = { open, setOpen }
    return React.createElement(React.Fragment, null, React.Children.map(children, child => (
      React.isValidElement(child) && (child.type === fakeRadixTooltip.Trigger || child.type === fakeRadixTooltip.Portal) ? React.cloneElement(child, { __tip: tip }) : child)))
  },
  Trigger: ({ children, __tip }) => {
    const child = React.Children.only(children)
    const own = child.props
    return React.cloneElement(child, {
      'data-state': __tip.open ? 'delayed-open' : 'closed',
      onFocus: event => { own.onFocus?.(event); __tip.setOpen(true) },
      onBlur: event => { own.onBlur?.(event); __tip.setOpen(false) },
      onPointerMove: event => { own.onPointerMove?.(event); __tip.setOpen(true) },
      onPointerLeave: event => { own.onPointerLeave?.(event); __tip.setOpen(false) },
      onKeyDown: event => { own.onKeyDown?.(event); if (event.key === 'Escape') __tip.setOpen(false) },
    })
  },
  Portal: ({ children, container, __tip }) => React.createElement('div', { 'data-fixture': 'tooltip-portal', 'data-container': container ? 'given' : 'none' }, React.Children.map(children, child => React.cloneElement(child, { __tip }))),
  Content: ({ children, __tip, ...props }) => (__tip.open ? React.createElement('div', { 'data-fixture': 'tooltip-content', role: 'tooltip', ...props }, children) : null),
}
const hostRequire = createRequire(path.join(root, 'package.json'))
const worldCache = new Map()
function worldFor(env, overrides = {}, extraStubs = {}) {
  const key = JSON.stringify([env, Object.entries(overrides).map(([file, source]) => [file, sha(source)]).sort(), Object.keys(extraStubs)])
  if (worldCache.has(key)) return worldCache.get(key)
  const stubs = { ...baseStubs, ...extraStubs }
  const cache = new Map()
  const exists = rel => rel in overrides || (fs.existsSync(path.join(root, rel)) && fs.statSync(path.join(root, rel)).isFile())
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext
    throw new Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const source = rel in overrides ? overrides[rel] : read(rel)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      if (spec.startsWith('node:') || ['fs', 'net', 'http', 'https', 'child_process', 'dns', 'tls', 'os'].includes(spec)) throw new Error(`harness refuses ${spec} (${rel})`)
      return hostRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', compile(rel, source))(module, module.exports, require, { env })
    return module.exports
  }
  const world = { load, Panel: null, env }
  worldCache.set(key, world)
  return world
}
const panelOf = world => (world.Panel ??= world.load(PANEL).GenerationPanel)
const libA = (env, overrides) => worldFor(env, overrides).load(LIB_A)
const libB = (env, overrides) => worldFor(env, overrides).load(LIB_B)

// ---- one fake window: the panel's keyboard listener registers here ---------------------------------------------------------------------
const listeners = new Map()
globalThis.window = {
  addEventListener: (type, fn) => { (listeners.get(type) ?? listeners.set(type, new Set()).get(type)).add(fn) },
  removeEventListener: (type, fn) => { listeners.get(type)?.delete(fn) },
  location: { href: 'http://localhost/' },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  innerWidth: 1600,
  innerHeight: 900,
  getComputedStyle: () => ({}),
}
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }
const noop = () => {}

// ---- the panel, mounted -------------------------------------------------------------------------------------------------------------------
const CAPABILITIES = { web: { available: true }, uploaded_documents: { available: false, reason: 'none' }, knowledge_graph: { available: false, reason: 'none' } }
const ALL_FORMS = ['TEXT_BOX', 'METRICS', 'TABLE', 'CHART', 'IMAGE', 'ICON_LABEL', 'SHAPE', 'INFOGRAPHIC', 'DIAGRAM']
function mount(world, type, overrides = {}) {
  const calls = []
  const closes = []
  const onGenerate = async (formData, intent) => { calls.push({ type: formData.componentType, prompt: formData.prompt, intent }) }
  const props = {
    isOpen: true, activationId: 1, elementType: type, onClose: (...args) => { closes.push(args.length) }, onGenerate, onElementTypeChange: noop, isGenerating: false, error: null,
    slideIndex: 0, mode: 'generate', researchMode: 'off', researchWeb: false, researchUploadedDocs: false, researchKnowledgeGraph: false,
    researchCapabilities: CAPABILITIES, onResearchModeChange: noop, onResearchWebChange: noop, onResearchUploadedDocsChange: noop,
    onResearchKnowledgeGraphChange: noop, ...overrides,
  }
  const tree = new Root()
  const Panel = panelOf(world)
  const driver = {
    tree, calls, closes, props,
    hosts: () => hostNodes(tree.tree),
    rerender(next) { Object.assign(props, next); tree.setElement(React.createElement(Panel, { ...props })); tree.flush() },
    promptBox: () => driver.hosts().find(node => node.type === 'textarea'),
    generateButton: () => driver.hosts().find(node => node.type === 'button' && typeof node.props.title === 'string'
      && (node.props.title.startsWith('Generate') || node.props.title === HINT || node.props.title.startsWith('Check generation') || node.props.title.startsWith('Shorten'))),
    closeButton: () => driver.hosts().find(node => node.type === 'button' && node.props.title === 'Close panel'),
    statusLine: () => driver.hosts().find(node => node.type === 'p' && node.props.role === 'status'),
    async type(text) { driver.promptBox().props.onChange({ target: { value: text } }); tree.flush(); await settle() },
    async click(node) {
      if (!node || node.props.disabled || !node.props.onClick) return false
      node.props.onClick({ preventDefault: noop, stopPropagation: noop, currentTarget: node, target: node })
      tree.flush(); await settle(); return true
    },
    async key(init) {
      const event = { key: 'Enter', metaKey: false, ctrlKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, ...init }
      for (const listener of [...(listeners.get('keydown') ?? [])]) listener(event)
      tree.flush(); await settle(); return event
    },
    markup: () => renderToStaticMarkup(toElements(tree.tree)),
    destroy() { tree.unmount() },
  }
  driver.rerender({})
  return driver
}

// ---- environments ----------------------------------------------------------------------------------------------------------------------------
const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const ENV_B_ON = { ...SHELL, [FLAG_B]: 'true' }
const ENV_C_ON = { ...SHELL, [FLAG_C]: 'true' }
const ENV_C_ON_CLASSIC = { [FLAG_C]: 'true' }

// ======================================================================================================================================
// 1. the libs
// ======================================================================================================================================
const STATES = []
for (const tabPausedHint of [undefined, 'This session is live in another tab.']) for (const viewerIsReady of [true, false]) for (const templateModeOn of [false, true]) for (const slideMutationPending of [false, true]) {
  STATES.push({ tabPausedHint, viewerIsReady, templateModeOn, slideMutationPending })
}
const CONTROLS = ['add-slide', 'add-element', 'theme', 'template']
/** The viewer's own disabled rules, as written in components/presentation-viewer.tsx (the toolbar check below reads them from the real code and
 * compares: this table is only the expected words). */
const expectedReason = (control, s) => {
  if (s.tabPausedHint) return s.tabPausedHint
  if (!s.viewerIsReady) return 'Loading the slide…'
  if (control !== 'template' && s.templateModeOn) return { 'add-slide': 'Exit Template Mode to add slides', 'add-element': 'Exit Template Mode to add elements', theme: 'Exit Template Mode to change the theme' }[control]
  if ((control === 'add-slide' || control === 'add-element') && s.slideMutationPending) return 'Finishing your last change…'
  return null
}

function libAChecks(overrides = {}) {
  for (const [value, expected] of [['true', true], ['false', false], ['TRUE', false], ['1', false], ['', false], [undefined, false]]) {
    const env = value === undefined ? {} : { [FLAG_A]: value }
    assert.equal(libA(env, overrides).STUDIO_DISABLED_REASONS_ENABLED, expected, `flag ${JSON.stringify(value)}`)
  }
  const lib = libA({ [FLAG_A]: 'true' }, overrides)
  for (const control of CONTROLS) for (const state of STATES) {
    assert.equal(lib.studioToolbarDisabledReason(control, state), expectedReason(control, state), `${control} ${JSON.stringify(state)}`)
  }
  assert.equal(lib.studioElementCardsDisabledReason('Loading the slide…'), 'Loading the slide…')
  assert.equal(lib.studioElementCardsDisabledReason(null), 'Not available in this view.')
  assert.equal(lib.REASON_SOURCE_UNAVAILABLE, 'Not available right now.')
}
function libBChecks(overrides = {}) {
  for (const [value, expected] of [['true', true], ['false', false], ['TRUE', false], ['1', false], ['', false], [undefined, false]]) {
    const env = value === undefined ? {} : { [FLAG_B]: value }
    assert.equal(libB(env, overrides).STUDIO_GENERATING_STATUS_ENABLED, expected, `flag ${JSON.stringify(value)}`)
    assert.equal(libB(env, overrides).escapeClosesWhileGenerating({ isGenerating: true, fromEditableField: false, outsidePanel: true }), expected, `default enabled follows the flag ${JSON.stringify(value)}`)
  }
  const lib = libB({ [FLAG_B]: 'true' }, overrides)
  const COPY = {
    TEXT_BOX: 'Generating text box…', METRICS: 'Generating metrics…', TABLE: 'Generating table…', CHART: 'Generating chart… usually 10–30 s',
    IMAGE: 'Generating image… usually 60–90 s', ICON_LABEL: 'Generating icon / label…', SHAPE: 'Generating shape…', INFOGRAPHIC: 'Generating infographic… usually 60–90 s',
    DIAGRAM: 'Generating diagram…',
  }
  for (const [type, text] of Object.entries(COPY)) assert.equal(lib.generatingStatusText(type), text, type)
  assert.equal(lib.generatingStatusText('NOT_A_TYPE'), 'Generating element…')
  const escape = input => lib.escapeClosesWhileGenerating({ enabled: true, ...input })
  assert.equal(escape({ isGenerating: false, fromEditableField: false, outsidePanel: false }), false, 'not generating: not this rule (the panel\'s own Escape rule applies)')
  assert.equal(escape({ isGenerating: true, fromEditableField: false, outsidePanel: true }), true, 'generating, focus on the page: closes like the ✕')
  assert.equal(escape({ isGenerating: true, fromEditableField: false, outsidePanel: false }), true, 'generating, focus in the panel (a button): closes like the ✕')
  assert.equal(escape({ isGenerating: true, fromEditableField: true, outsidePanel: false }), true, 'generating, a field inside the panel (disabled while generating): closes')
  assert.equal(escape({ isGenerating: true, fromEditableField: true, outsidePanel: true }), false, 'generating, a text field OUTSIDE the panel: left alone')
  assert.equal(lib.escapeClosesWhileGenerating({ enabled: false, isGenerating: true, fromEditableField: false, outsidePanel: false }), false, 'flag off')
  for (const [target, expected] of [[{ tagName: 'INPUT' }, true], [{ tagName: 'textarea' }, true], [{ tagName: 'SELECT' }, true], [{ tagName: 'DIV', isContentEditable: true }, true],
    [{ tagName: 'BUTTON' }, false], [{ tagName: 'DIV' }, false], [null, false], [undefined, false], [{}, false], ['x', false]]) {
    assert.equal(lib.isEditableEventTarget(target), expected, JSON.stringify(target))
  }
}
await check('A lib: flag literal and the reason table (4 controls x 16 states, in the viewer\'s own precedence)', () => libAChecks())
await check('B lib: flag literal, the status copy per type, the Escape rule, editable-target detection', () => libBChecks())

// ======================================================================================================================================
// 2. the toolbar block of the REAL viewer, evaluated (as test-studio-toolbar-cleanup.mjs does)
// ======================================================================================================================================
const FRAGMENT = '__Fragment'
const jsx = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) })
const JSX_OPTIONS = { jsx: ts.JsxEmit.React, jsxFactory: '__jsx', jsxFragmentFactory: FRAGMENT, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
function serialise(node, keepSlots = false) {
  if (node === null || node === undefined || typeof node === 'boolean') return keepSlots ? '∅' : ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(child => serialise(child, keepSlots)).join(keepSlots ? '|' : '')
  if (node.type === FRAGMENT) return keepSlots ? `<>${serialise(node.children, true)}</>` : serialise(node.children)
  const attrs = Object.keys(node.props).sort().map(key => typeof node.props[key] === 'function' ? `${key}=<fn>` : `${key}=${JSON.stringify(node.props[key])}`)
  return `<${String(node.type)}${attrs.length ? ' ' + attrs.join(' ') : ''}>${serialise(node.children, keepSlots)}</${String(node.type)}>`
}
const findAll = (node, predicate, found = []) => {
  if (node === null || node === undefined || typeof node !== 'object') return found
  if (Array.isArray(node)) { node.forEach(child => findAll(child, predicate, found)); return found }
  if (predicate(node)) found.push(node)
  findAll(node.children, predicate, found)
  return found
}
function parse(file, source) { return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }
function find(node, predicate) {
  if (predicate(node)) return node
  let match
  ts.forEachChild(node, child => { if (!match) match = find(child, predicate) })
  return match
}
/** Free capitalised names (icons, UI parts) resolve to name-only stubs; everything else must come from `scope`, or the run fails loudly. */
function compileExpression(expressionText, { call = false } = {}) {
  const js = ts.transpileModule(`(${expressionText})${call ? '()' : ''};`, { compilerOptions: JSX_OPTIONS, fileName: 'expression.tsx' }).outputText
  const script = new vm.Script(`with (__scope) { ${js} }`)
  return scope => {
    const proxy = new Proxy(scope, {
      has: (target, key) => typeof key === 'string' && (key in target || (/^[A-Z]/.test(key) && !(key in globalThis))),
      get: (target, key) => key === Symbol.unscopables ? undefined : key in target ? target[key] : String(key),
    })
    return script.runInContext(vm.createContext({ __scope: proxy, console }))
  }
}
function toolbarRenderer(viewerText) {
  const source = parse(VIEWER, viewerText)
  let block = find(source, n => ts.isVariableDeclaration(n) && n.name.getText(source) === 'authoringControls')
  assert.ok(block, 'authoringControls is declared in the viewer')
  while (block && !ts.isArrowFunction(block)) block = block.parent
  assert.ok(block, 'the toolbar block (an immediately-invoked arrow)')
  return compileExpression(block.getText(source), { call: true })
}
const PORTAL_CONTAINER = { fullscreen: 'the-fullscreen-element' }
function toolbarScope(state, lib) {
  const record = () => () => undefined
  return {
    __jsx: jsx, [FRAGMENT]: FRAGMENT, process: { env: { ...SHELL, ...(state.workspace ? { NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE: 'true' } : {}) } },
    studioShell: state.studioShell, isFullscreen: state.isFullscreen, viewerIsReady: state.viewerIsReady, templateBuilderEnabled: state.templateBuilderEnabled,
    presentViewOnlyActive: false, isGenerating: false, showToolbar: true, templateIngestEnabled: false, canSaveTemplate: true, studioToolbarCleanup: false,
    templateSaveGate: { canSave: true, disabledReason: null, sourcePresentationId: 'p' }, templateModeAvailable: true, templateModeOn: state.templateModeOn,
    templateSelectionLocked: false, studioPartialArtifact: false, studioWorkflowRequest: null, toolbarTemplateMenuOpen: false, toolbarTemplatePickerOpen: false,
    onStudioFormatRequested: record(), studioFormatBusy: false, studioFormatSelection: null, studioTabPausedHint: state.tabPausedHint,
    isSlideMutationPending: state.slideMutationPending, isEditMode: false, isGridActive: false, isBordersActive: false, isSaving: false, saveStatus: 'saved',
    resolvedTheme: 'light', activeVersion: 'blank', strawmanPreviewUrl: null, finalPresentationUrl: null,
    ADD_SLIDE_V2_ENABLED: false, STUDIO_SLIDE_COUNT_SYNC_ENABLED: false, addSlideV2Settings: null, buildThemeSelection: null, slideThumbnails: [],
    currentSlide: 1, totalSlides: 7, slideCount: 7, visualTotalSlides: 7, syncedFooterTotal: () => 7, toolbarOffset: 0,
    authoringStripRef: { current: null }, viewerInteractionIntentRef: { current: 0 }, toolbarDropdownPortalContainer: state.isFullscreen ? PORTAL_CONTAINER.fullscreen : undefined,
    downloadControls: 'DOWNLOAD', onOpenGenerationPanel: record(), onGenerateSlide: record(), onSelectTemplate: record(), onTemplateModeChange: record(),
    onComposerTemplateAction: undefined, onOpenComposerLibrary: undefined, onVersionSwitch: record(), handleAddSlide: record(), handleFullscreen: record(),
    handleInsertTable: record(), handleInsertChart: record(), handleInsertTextBox: record(), handleInsertImage: record(), handleInsertInfographic: record(), handleInsertDiagram: record(),
    handleSaveChanges: record(), handleToggleBorders: record(), handleToggleEditModeButton: record(), handleToggleGrid: record(),
    setShowPresentationSettings: record(), setShowTemplateIngest: record(), setShowTemplateSave: record(), setShowThemePanel: record(), setTheme: record(),
    setToolbarTemplateMenuOpen: record(), setToolbarTemplatePickerOpen: record(),
    studioAuthoringPortalTarget: 'target:authoring', studioPresentPortalTarget: 'target:present', toolbarPortalTarget: 'target:header',
    createPortal: (child, target) => ({ type: 'Portal', props: { target }, children: [child] }),
    cn: (...parts) => parts.flat(Infinity).filter(part => typeof part === 'string' && part).join(' '),
    ...(lib ? { STUDIO_DISABLED_REASONS_ENABLED: lib.STUDIO_DISABLED_REASONS_ENABLED, studioToolbarDisabledReason: lib.studioToolbarDisabledReason, studioElementCardsDisabledReason: lib.studioElementCardsDisabledReason } : {}),
  }
}
const product = axes => Object.entries(axes).reduce((cells, [key, values]) => cells.flatMap(cell => values.map(value => ({ ...cell, [key]: value }))), [{}])
const BOOLS = [false, true]
const TOOLBAR_MATRIX = product({ studioShell: BOOLS, isFullscreen: BOOLS, viewerIsReady: BOOLS, templateModeOn: BOOLS, slideMutationPending: BOOLS, tabPausedHint: [undefined, 'This session is live in another tab.'], templateBuilderEnabled: BOOLS, workspace: BOOLS })
const LABEL_KIND = { 'Add Slide': 'add-slide', 'Add Element': 'add-element', 'Template': 'template', 'Theme': 'theme' }

/** Flag off: the viewer's toolbar block, with and without the lib in scope, equals the base viewer's, markup and child slots, in every state. */
function toolbarFlagOffIdentity(viewerText, baseText) {
  const branch = toolbarRenderer(viewerText), base = toolbarRenderer(baseText)
  const off = libA({}), offFalse = libA({ [FLAG_A]: 'false' }), offUpper = libA({ [FLAG_A]: 'TRUE' }), offOne = libA({ [FLAG_A]: '1' })
  const digest = (render, lib, keepSlots) => sha(TOOLBAR_MATRIX.map(state => sha(serialise(render(toolbarScope(state, lib)), keepSlots))).join('\n'))
  const baseMarkup = digest(base, null, false), baseSlots = digest(base, null, true)
  for (const [name, lib] of [['unset', off], ['"false"', offFalse], ['"TRUE"', offUpper], ['"1"', offOne]]) {
    assert.equal(digest(branch, lib, false), baseMarkup, `toolbar markup, flag ${name}, ${TOOLBAR_MATRIX.length} states`)
    assert.equal(digest(branch, lib, true), baseSlots, `toolbar child slots, flag ${name}`)
  }
  return { markup: baseMarkup, slots: baseSlots, states: TOOLBAR_MATRIX.length }
}

/** Flag on: a reason exists exactly when the control is disabled in the viewer's own code, and says what the lib says. */
function toolbarFlagOnChecks(viewerText) {
  const render = toolbarRenderer(viewerText)
  const on = libA({ [FLAG_A]: 'true' })
  let cells = 0
  for (const state of TOOLBAR_MATRIX) {
    const tree = render(toolbarScope(state, on))
    const wrappers = findAll(tree, node => node.type === 'StudioDisabledReason')
    const shouldHave = ['Add Slide', 'Add Element', 'Theme']
    const hasTemplate = state.studioShell && state.workspace ? true : state.templateBuilderEnabled
    // the Template menu exists only without the workspace flag; with it the picker takes the slot (shell only)
    const expected = hasTemplate ? [...shouldHave, 'Template'] : shouldHave
    const authoring = findAll(tree, node => node.type === 'Portal' && node.props.target === 'target:authoring').length > 0
    if (state.isFullscreen || !state.studioShell) { /* the strip renders in the fullscreen overlay or the header slot */ }
    const seen = wrappers.map(w => w.props.label)
    const unique = [...new Set(seen)]
    for (const label of expected) assert.ok(unique.includes(label), `${label} is wrapped (${JSON.stringify(state)}), saw ${JSON.stringify(unique)}`)
    for (const wrapper of wrappers) {
      const kind = LABEL_KIND[wrapper.props.label]
      assert.ok(kind, `unknown wrapper label ${wrapper.props.label}`)
      const inner = findAll(wrapper.children, node => typeof node.props?.disabled === 'boolean')[0]
      assert.ok(inner, `${wrapper.props.label}: the wrapped control carries a boolean disabled`)
      const reason = wrapper.props.reason
      assert.equal(Boolean(reason), inner.props.disabled, `${wrapper.props.label}: a reason exists exactly when the control is disabled (${JSON.stringify(state)})`)
      assert.equal(reason, expectedReason(kind, state), `${wrapper.props.label}: the words (${JSON.stringify(state)})`)
      assert.equal(wrapper.props.tabPaused, Boolean(state.tabPausedHint), 'the paused-tab marker follows the hint')
      assert.equal(wrapper.props.portalContainer, state.isFullscreen ? PORTAL_CONTAINER.fullscreen : undefined, 'fullscreen: the tooltip portals into the viewer element')
      cells += 1
    }
    void authoring
  }
  return cells
}

const viewerText = read(VIEWER)
const baseViewerText = baseAvailable ? baseFile(VIEWER) : null
await check('A viewer: flag off, the toolbar block equals the base viewer\'s (256 states, markup and child slots, flag unset / "false" / "TRUE" / "1")', () => {
  if (!baseAvailable) { console.log('     (skipped: base commit not in this clone)'); return }
  const result = toolbarFlagOffIdentity(viewerText, baseViewerText)
  console.log(`     toolbar markup ${result.markup} slots ${result.slots} (${result.states} states, base ${BASE_SHA.slice(0, 8)} == branch)`)
})
await check('A viewer: flag on, every wrapped control has a reason exactly when it is disabled (read from the viewer\'s own code), with the right words', () => {
  console.log(`     ${toolbarFlagOnChecks(viewerText)} wrapper x state cells`)
})
await check('A viewer: ONE_LIVE_TAB is kept: the sentence is the reason, the same four controls, scripts/test-studio-one-live-tab.mjs keeps its anchors', () => {
  const on = libA({ [FLAG_A]: 'true' })
  const hint = 'This session is live in another tab.'
  const tree = toolbarRenderer(viewerText)(toolbarScope({ studioShell: true, isFullscreen: false, viewerIsReady: true, templateModeOn: false, slideMutationPending: false, tabPausedHint: hint, templateBuilderEnabled: true, workspace: false }, on))
  const wrappers = findAll(tree, node => node.type === 'StudioDisabledReason')
  assert.deepEqual(wrappers.map(w => w.props.label).sort(), ['Add Element', 'Add Slide', 'Template', 'Theme'])
  for (const w of wrappers) { assert.equal(w.props.reason, hint); assert.equal(w.props.tabPaused, true) }
  // flag on and not paused: no old title wrapper; flag off and paused: the old title wrapper, nothing new
  const offTree = toolbarRenderer(viewerText)(toolbarScope({ studioShell: true, isFullscreen: false, viewerIsReady: true, templateModeOn: false, slideMutationPending: false, tabPausedHint: hint, templateBuilderEnabled: true, workspace: false }, libA({})))
  assert.equal(findAll(offTree, node => node.type === 'StudioDisabledReason').length, 0)
  assert.equal(findAll(offTree, node => node.props?.['data-studio-tab-paused'] === 'true').length, 1, 'flag off: the one title wrapper of #396 (Add Slide)')
  assert.equal(findAll(tree, node => node.props?.['data-studio-tab-paused'] === 'true').length, 0, 'flag on: the title wrapper is replaced by the wrapper component, not doubled')
  const source = viewerText
  for (const anchor of ['const tabPaused = Boolean(studioTabPausedHint)', '{tabPausedWrap(<SlideLayoutPicker', '{tabPausedWrap(<StudioTemplatePicker']) assert.ok(source.includes(anchor), anchor)
})

// ======================================================================================================================================
// 3. the wrapper component
// ======================================================================================================================================
function mountWrapper(props, children, env = { [FLAG_A]: 'true' }) {
  const world = worldFor(env, {}, { '@radix-ui/react-tooltip': fakeRadixTooltip })
  const { StudioDisabledReason } = world.load(COMPONENT)
  const tree = new Root()
  const driver = {
    tree,
    hosts: () => hostNodes(tree.tree),
    wrapper: () => driver.hosts().find(node => node.type === 'span' && (node.props['data-studio-disabled-reason'] !== undefined || node.props.className?.includes('inline-flex'))),
    tip: () => driver.hosts().find(node => node.props?.['data-fixture'] === 'tooltip-content'),
    describedBy: () => driver.hosts().find(node => node.props?.id && node.props.id === driver.wrapper()?.props['aria-describedby']),
    set(next) { tree.setElement(React.createElement(StudioDisabledReason, next, children)); tree.flush() },
    fire(handler, event = {}) { driver.wrapper().props[handler]({ key: '', ...event }); tree.flush() },
    destroy() { tree.unmount() },
  }
  driver.set(props)
  return driver
}
await check('A component: disabled = a keyboard tab stop that takes the reason on focus and on hover, and gives it up on blur, leave and Escape', () => {
  const REASON = 'Loading the slide…'
  const d = mountWrapper({ reason: REASON, label: 'Add Element' }, React.createElement('button', { disabled: true }, 'Add Element'))
  try {
    const box = d.wrapper()
    assert.equal(box.props.tabIndex, 0, 'a disabled button is skipped by Tab; its box is the tab stop')
    assert.equal(box.props.role, 'button')
    assert.equal(box.props['aria-disabled'], true)
    assert.equal(box.props['aria-label'], 'Add Element', 'the control\'s own name')
    assert.equal(box.props['data-studio-disabled-reason'], 'true')
    assert.equal(box.props['data-studio-tab-paused'], undefined)
    assert.match(box.props.className, /\[&_button\]:pointer-events-none/, 'the disabled button no longer swallows the pointer (the #396 box\'s rule)')
    assert.match(box.props.className, /focus-visible:outline/, 'a visible focus ring')
    assert.equal(box.props['aria-describedby'] && d.describedBy() ? textOf(d.describedBy()) : null, REASON, 'aria-describedby points at an element holding the reason')
    assert.match(d.describedBy().props.className, /sr-only/)
    assert.equal(d.tip(), undefined, 'closed until focused')
    d.fire('onFocus')
    assert.equal(textOf(d.tip()), REASON, 'keyboard focus shows the reason')
    d.fire('onBlur')
    assert.equal(d.tip(), undefined, 'blur closes it')
    d.fire('onPointerMove')
    assert.equal(textOf(d.tip()), REASON, 'hover shows the reason')
    d.fire('onPointerLeave')
    assert.equal(d.tip(), undefined)
    d.fire('onFocus')
    d.fire('onKeyDown', { key: 'Escape' })
    assert.equal(d.tip(), undefined, 'Escape dismisses it')
    // the tooltip is portalled (toolbar overflow cannot clip it) into the container it is given
    d.fire('onFocus')
    assert.equal(d.hosts().find(node => node.props?.['data-fixture'] === 'tooltip-portal').props['data-container'], 'none')
    d.set({ reason: REASON, label: 'Add Element', portalContainer: { fullscreen: true } })
    assert.equal(d.hosts().find(node => node.props?.['data-fixture'] === 'tooltip-portal').props['data-container'], 'given')
  } finally { d.destroy() }
})
await check('A component: enabled = inert (no role, no tab stop, no description, no tooltip) and the wrapped control is never remounted when it toggles', () => {
  let mounts = 0
  function Probe() {
    React.useEffect(() => { mounts += 1 }, [])
    return React.createElement('button', { id: 'probe' }, 'Add Element')
  }
  const d = mountWrapper({ reason: null, label: 'Add Element' }, React.createElement(Probe))
  try {
    const box = d.wrapper()
    for (const name of ['tabIndex', 'role', 'aria-disabled', 'aria-label', 'aria-describedby', 'data-studio-disabled-reason']) assert.equal(box.props[name], undefined, name)
    assert.doesNotMatch(box.props.className, /pointer-events-none|cursor-not-allowed/)
    assert.equal(d.hosts().filter(node => node.props?.className?.includes('sr-only')).length, 0)
    d.fire('onFocus')
    assert.equal(d.tip(), undefined, 'enabled: a focus never opens a tooltip')
    assert.equal(mounts, 1)
    d.set({ reason: 'Finishing your last change…', label: 'Add Element' })
    assert.equal(d.wrapper().props.tabIndex, 0)
    d.set({ reason: null, label: 'Add Element' })
    d.set({ reason: 'Loading the slide…', label: 'Add Element' })
    assert.equal(mounts, 1, 'the wrapped control keeps its place: disabled <-> enabled never remounts it (focus, an open menu, the picker state survive)')
    d.set({ reason: '', label: 'Add Element' })
    assert.equal(d.wrapper().props.tabIndex, undefined, 'an empty reason is no reason')
  } finally { d.destroy() }
})
await check('A component: the paused-tab marker, and the real Radix wiring in a server render (describedby -> the reason, the child\'s props win)', () => {
  const d = mountWrapper({ reason: 'This session is live in another tab.', label: 'Theme', tabPaused: true }, React.createElement('button', { disabled: true }, 'Theme'))
  try { assert.equal(d.wrapper().props['data-studio-tab-paused'], 'true') } finally { d.destroy() }
  const { StudioDisabledReason } = worldFor({ [FLAG_A]: 'true' }).load(COMPONENT)
  const html = quietly(() => renderToStaticMarkup(React.createElement(StudioDisabledReason, { reason: 'Exit Template Mode to add elements', label: 'Add Element' }, React.createElement('button', { disabled: true }, 'Add Element'))))
  const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1]
  assert.ok(describedBy, `aria-describedby present: ${html}`)
  assert.ok(html.includes(`id="${describedBy}" class="sr-only">Exit Template Mode to add elements</span>`), `the description element: ${html}`)
  assert.match(html, /role="button"/)
  assert.match(html, /aria-disabled="true"/)
  assert.match(html, /aria-label="Add Element"/)
  assert.match(html, /tabindex="0"/)
  const idle = quietly(() => renderToStaticMarkup(React.createElement(StudioDisabledReason, { reason: null, label: 'Add Element' }, React.createElement('button', null, 'Add Element'))))
  assert.doesNotMatch(idle, /role=|aria-|tabindex|sr-only/, `enabled markup is a plain box: ${idle}`)
})

// ======================================================================================================================================
// 4. the Add Element gallery and the research sources
// ======================================================================================================================================
const ITEMS = ['Text Box', 'Image', 'Chart', 'Metrics', 'Table', 'Diagram', 'Infographic', 'Icon / Label', 'Shape'].map(label => ({ label, icon: () => null, disabled: false, action: noop }))
const galleryWorld = (overrides = {}) => worldFor({}, overrides)
const galleryMarkup = (world, items, disabledReason) => quietly(() => renderToStaticMarkup(React.createElement(world.load(GALLERY).StudioElementGalleryMenu, disabledReason === undefined ? { items } : { items, disabledReason })))
function galleryChecks(overrides = {}) {
  const world = galleryWorld(overrides)
  const allOff = ITEMS.map(item => ({ ...item, disabled: true }))
  const someOff = ITEMS.map((item, index) => ({ ...item, disabled: index >= 3 && index <= 5 }))
  // no reason given == the base gallery, byte for byte (the viewer passes undefined with the flag off)
  if (baseAvailable) {
    const base = galleryWorld({ [GALLERY]: baseFile(GALLERY) })
    for (const items of [ITEMS, allOff, someOff]) assert.equal(sha(galleryMarkup(world, items)), sha(galleryMarkup(base, items)), 'reason not given: the base gallery')
  }
  const html = galleryMarkup(world, allOff, 'Loading the slide…')
  assert.equal((html.match(/data-studio-element-gallery-reason="true"/g) ?? []).length, 1, 'one reason line')
  assert.match(html, /<span id="studio-element-gallery-disabled-reason" role="status" data-studio-element-gallery-reason="true" class="seg-hint">Loading the slide…<\/span>/)
  const cards = html.match(/<div[^>]*data-studio-element-card="[^"]+"[^>]*>/g) ?? []
  assert.equal(cards.length, 9)
  for (const card of cards) {
    assert.match(card, /title="Loading the slide…"/, `a disabled card carries the reason: ${card}`)
    assert.match(card, /aria-describedby="studio-element-gallery-[a-z-]+-desc studio-element-gallery-disabled-reason"/, `described by its own line and by the reason: ${card}`)
  }
  // only the disabled cards get it
  const partial = galleryMarkup(world, someOff, 'Not available in this view.')
  const partialCards = partial.match(/<div[^>]*data-studio-element-card="[^"]+"[^>]*>/g)
  assert.equal(partialCards.filter(card => /title="Not available in this view\."/.test(card)).length, 3)
  assert.equal(partialCards.filter(card => /title=/.test(card)).length, 3, 'enabled cards keep no title')
  // nothing disabled: no line, no titles, even when a reason is passed (it is the viewer's reason for a disabled button, not for an open menu)
  const none = galleryMarkup(world, ITEMS, 'Loading the slide…')
  assert.doesNotMatch(none, /data-studio-element-gallery-reason|title=|disabled-reason/)
  assert.equal(sha(none), sha(galleryMarkup(world, ITEMS)))
  // empty string = no reason
  assert.equal(sha(galleryMarkup(world, allOff, '')), sha(galleryMarkup(world, allOff)))
}
await check('A gallery: reason line + per-card title/aria-describedby for disabled cards; none given == base gallery; none disabled == untouched', () => galleryChecks())

const RESEARCH_ENV_ON = { [FLAG_A]: 'true' }
const researchMarkup = (world, props) => quietly(() => renderToStaticMarkup(React.createElement(world.load(RESEARCH).ResearchControls, {
  researchMode: 'off', researchWeb: false, researchUploadedDocs: false, researchKnowledgeGraph: false, onResearchEnabledChange: noop, onResearchWebChange: noop,
  onResearchUploadedDocsChange: noop, onResearchKnowledgeGraphChange: noop, researchCapabilities: CAPABILITIES, ...props })))
const CAPS = {
  allOk: { web: { available: true }, uploaded_documents: { available: true }, knowledge_graph: { available: true } },
  real: { web: { available: true }, uploaded_documents: { available: false, reason: 'No uploaded documents are ready in this session.' }, knowledge_graph: { available: false, reason: 'Knowledge Graph requires the Max plan.' } },
  noReason: { web: { available: true }, uploaded_documents: { available: false }, knowledge_graph: { available: true } },
}
const idOf = (html, label) => html.match(new RegExp(`aria-label="Use ${label}" aria-describedby="([^"]+)"`))?.[1]
function researchChecks(overrides = {}) {
  const world = worldFor(RESEARCH_ENV_ON, overrides)
  const reasonLines = html => [...html.matchAll(/<p id="([^"]+)">([^<]*)<\/p>/g)].map(match => [match[1], match[2]])
  // Research on, the two real reasons from the page
  const on = researchMarkup(world, { researchMode: 'on', researchCapabilities: CAPS.real })
  assert.deepEqual(reasonLines(on), [['research-uploaded-documents-reason', 'No uploaded documents are ready in this session.'], ['research-knowledge-graph-reason', 'Knowledge Graph requires the Max plan.']])
  assert.equal(idOf(on, 'Uploaded Documents'), 'research-uploaded-documents-reason', 'the checkbox is described by its visible line')
  assert.equal(idOf(on, 'Knowledge Graph'), 'research-knowledge-graph-reason')
  assert.equal(idOf(on, 'Web Search'), undefined, 'Web Search is selectable: no reason')
  assert.doesNotMatch(on, /class="sr-only"/, 'the sr-only copy is dropped (the visible line is the description: no double reading)')
  assert.match(on, /data-studio-research-reasons="true" class="mt-1 [^"]*text-\[10px\]/, 'a visible 10px helper under the row')
  // Research off: one shared line, Web Search included (it is greyed only because Research is off); the capability reasons still show for the others
  const off = researchMarkup(world, { researchMode: 'off', researchCapabilities: CAPS.real })
  assert.deepEqual(reasonLines(off), [['research-sources-reason', 'Enable Research to select sources.'], ['research-uploaded-documents-reason', 'No uploaded documents are ready in this session.'], ['research-knowledge-graph-reason', 'Knowledge Graph requires the Max plan.']])
  assert.equal(idOf(off, 'Web Search'), 'research-sources-reason')
  assert.equal(idOf(off, 'Uploaded Documents'), 'research-uploaded-documents-reason')
  const offAllOk = researchMarkup(world, { researchMode: 'off', researchCapabilities: CAPS.allOk })
  assert.deepEqual(reasonLines(offAllOk), [['research-sources-reason', 'Enable Research to select sources.']], 'one line for three greyed sources')
  for (const label of ['Web Search', 'Uploaded Documents', 'Knowledge Graph']) assert.equal(idOf(offAllOk, label), 'research-sources-reason')
  // nothing greyed: nothing added
  const clear = researchMarkup(world, { researchMode: 'on', researchCapabilities: CAPS.allOk })
  assert.doesNotMatch(clear, /data-studio-research-reasons|aria-describedby|sr-only/)
  // greyed with no reason of its own: says so instead of staying silent (flag on only)
  const silent = researchMarkup(world, { researchMode: 'on', researchCapabilities: CAPS.noReason })
  assert.deepEqual(reasonLines(silent), [['research-uploaded-documents-reason', 'Not available right now.']])
  assert.equal(idOf(silent, 'Uploaded Documents'), 'research-uploaded-documents-reason')
  // every describedby id resolves to a line that is on the page
  for (const html of [on, off, offAllOk, silent]) for (const id of [...html.matchAll(/aria-describedby="([^"]+)"/g)].map(match => match[1])) assert.ok(html.includes(`<p id="${id}">`), `describedby ${id} resolves`)
}
await check('A research sources: a visible line per greyed source (Research off shares one), described-by wiring, nothing added when nothing is greyed', () => researchChecks())
await check('A research sources: flag off is the base file\'s markup (all capability x switch states), title and sr-only reason as before', () => {
  if (!baseAvailable) { console.log('     (skipped: base commit not in this clone)'); return }
  const baseWorld = worldFor({}, { [RESEARCH]: baseFile(RESEARCH) })
  const states = []
  for (const researchMode of ['off', 'on']) for (const caps of Object.values(CAPS)) for (const flagEnv of [{}, { [FLAG_A]: 'false' }, { [FLAG_A]: 'TRUE' }, { [FLAG_A]: '1' }]) states.push({ researchMode, caps, flagEnv })
  for (const { researchMode, caps, flagEnv } of states) {
    const branch = researchMarkup(worldFor(flagEnv), { researchMode, researchCapabilities: caps, researchWeb: true })
    const base = researchMarkup(baseWorld, { researchMode, researchCapabilities: caps, researchWeb: true })
    assert.equal(branch, base, `${researchMode} ${JSON.stringify(flagEnv)} ${JSON.stringify(caps)}`)
  }
  const offMarkup = researchMarkup(worldFor({}), { researchMode: 'on', researchCapabilities: CAPS.real })
  assert.match(offMarkup, /title="No uploaded documents are ready in this session\."/)
  assert.match(offMarkup, /class="sr-only">No uploaded documents are ready in this session\.<\/span>/)
})

// ======================================================================================================================================
// 5. the panel: B (status + Escape) and C (the empty-prompt button's name and description)
// ======================================================================================================================================
const STATUS = {
  TEXT_BOX: 'Generating text box…', METRICS: 'Generating metrics…', TABLE: 'Generating table…', CHART: 'Generating chart… usually 10–30 s',
  IMAGE: 'Generating image… usually 60–90 s', ICON_LABEL: 'Generating icon / label…', SHAPE: 'Generating shape…', INFOGRAPHIC: 'Generating infographic… usually 60–90 s',
  DIAGRAM: 'Generating diagram…',
}
async function statusChecks(world) {
  for (const type of ALL_FORMS) {
    const d = mount(world, type, { isGenerating: false })
    try {
      const idle = d.statusLine()
      assert.ok(idle, `${type}: the live region is in the tree before generating (so its first text is announced)`)
      assert.equal(idle.props['aria-live'], 'polite')
      assert.equal(textOf(idle), '', `${type}: idle: empty`)
      assert.deepEqual(idle.props.style, { marginTop: 0 }, `${type}: idle: takes no room (the parent's space-y margin zeroed)`)
      assert.equal(idle.props['data-studio-generating-status'], undefined)
      d.rerender({ isGenerating: true })
      const live = d.statusLine()
      assert.equal(textOf(live), STATUS[type], `${type}: status copy`)
      assert.equal(live.props['aria-live'], 'polite')
      assert.equal(live.props['data-studio-generating-status'], 'true')
      assert.equal(live.props.style, undefined, `${type}: generating: normal spacing under the box`)
      // under the box: after the input container, before the form fields
      const hosts = d.hosts()
      assert.ok(hosts.indexOf(live) > hosts.findIndex(node => node.type === 'textarea'), 'under the prompt box')
      assert.ok(d.hosts().find(node => node.type === 'button' && node.props.disabled && node.props.title === 'Generate (⌘↵)'), `${type}: Generate stays disabled while generating`)
      d.rerender({ isGenerating: false })
      assert.equal(textOf(d.statusLine()), '', `${type}: done: the line empties`)
    } finally { d.destroy() }
  }
  // Refine shows the same line (the input is shown for Refine too)
  const refine = mount(world, 'CHART', { mode: 'refine', isGenerating: true })
  try { assert.equal(textOf(refine.statusLine()), STATUS.CHART) } finally { refine.destroy() }
}
async function escapeChecks(world) {
  for (const type of ALL_FORMS) {
    const d = mount(world, type, { isGenerating: true })
    try {
      // the ✕ while generating
      assert.ok(d.closeButton(), `${type}: the ✕ is there while generating`)
      await d.click(d.closeButton())
      assert.deepEqual(d.closes, [1], `${type}: ✕ calls onClose (with the click event: 1 argument)`)
      // Escape from the page while generating == ✕: the same prop, no new semantics (no argument, no other callback)
      const escape = await d.key({ key: 'Escape' })
      assert.deepEqual(d.closes, [1, 0], `${type}: Escape calls the same onClose`)
      assert.equal(escape.defaultPrevented, true)
      const fromButton = await d.key({ key: 'Escape', target: { tagName: 'BUTTON' } })
      assert.deepEqual(d.closes, [1, 0, 0], `${type}: Escape from a button`)
      assert.equal(fromButton.defaultPrevented, true)
      // an Escape typed in a text field outside the panel is left alone
      for (const target of [{ tagName: 'TEXTAREA' }, { tagName: 'INPUT' }, { tagName: 'DIV', isContentEditable: true }]) {
        const event = await d.key({ key: 'Escape', target })
        assert.deepEqual(d.closes, [1, 0, 0], `${type}: Escape in ${target.tagName} outside the panel does nothing while generating`)
        assert.equal(event.defaultPrevented, false)
      }
      assert.equal(d.calls.length, 0, 'nothing is generated by any of it')
    } finally { d.destroy() }
  }
  // not generating: Escape closes as it always did, wherever the focus is (flag on or off)
  const idle = mount(world, 'CHART', { isGenerating: false })
  try {
    await idle.key({ key: 'Escape', target: { tagName: 'TEXTAREA' } })
    await idle.key({ key: 'Escape' })
    assert.deepEqual(idle.closes, [0, 0], 'not generating: unchanged')
  } finally { idle.destroy() }
  // a shell Escape that something else already consumed (a Radix picker) is not the panel's
  const consumed = mount(world, 'CHART', { isGenerating: true })
  try {
    await consumed.key({ key: 'Escape', defaultPrevented: true })
    assert.deepEqual(consumed.closes, [], 'a picker\'s Escape (defaultPrevented) is left to the picker')
  } finally { consumed.destroy() }
  // other keys still do nothing while generating
  const typing = mount(world, 'CHART', { isGenerating: true })
  try {
    await typing.key({ key: 'Enter', metaKey: true })
    await typing.key({ key: 'a' })
    assert.deepEqual(typing.closes, [])
    assert.equal(typing.calls.length, 0, 'Cmd+Enter while generating still does nothing')
  } finally { typing.destroy() }
}
async function emptyPromptAriaChecks(world, { studio }) {
  for (const type of ['TEXT_BOX', 'METRICS', 'TABLE', 'CHART', 'IMAGE', 'ICON_LABEL', 'SHAPE', 'INFOGRAPHIC', 'DIAGRAM']) {
    const d = mount(world, type)
    try {
      const blocked = d.generateButton()
      assert.equal(blocked.props.disabled, true)
      assert.equal(blocked.props.title, HINT, 'the title still carries the hint')
      assert.equal(blocked.props['aria-label'], 'Generate (⌘↵)', `${type}: the accessible name stays "Generate (⌘↵)" (${studio ? 'Studio' : 'classic'} shell)`)
      const describedBy = blocked.props['aria-describedby']
      assert.ok(describedBy, `${type}: aria-describedby`)
      const hint = d.hosts().find(node => node.props?.id === describedBy)
      assert.ok(hint, `${type}: the description element exists`)
      assert.equal(textOf(hint), HINT)
      assert.match(hint.props.className, /sr-only/)
      assert.equal(d.hosts().filter(node => node.props?.id === describedBy).length, 1, 'one such element')
      await d.type('A quarterly revenue chart')
      const open = d.generateButton()
      assert.equal(open.props.disabled, false)
      assert.equal(open.props['aria-describedby'], undefined, `${type}: typed: no description`)
      assert.equal(d.hosts().filter(node => node.props?.id === describedBy).length, 0, 'the hint element goes with the block')
      assert.equal(open.props.title, 'Generate (⌘↵)')
      assert.equal(open.props['aria-label'], studio ? 'Generate (⌘↵)' : undefined, 'unblocked: the name as before in both shells')
    } finally { d.destroy() }
  }
}
await check('B panel: the status line per type (copy, aria-live, always in the tree, empty when idle), also in Refine', async () => statusChecks(worldFor(ENV_B_ON)))
await check('B panel: Escape == the header ✕ while generating (same onClose, no abort, no new semantics); a text field outside the panel is left alone; not generating unchanged', async () => escapeChecks(worldFor(ENV_B_ON)))
await check('B panel: flag off, the status line does not exist and Escape is ignored while generating exactly as before', async () => {
  for (const env of [SHELL, { ...SHELL, [FLAG_B]: 'false' }, { ...SHELL, [FLAG_B]: 'TRUE' }, { ...SHELL, [FLAG_B]: '1' }]) {
    const world = worldFor(env)
    for (const type of ALL_FORMS) {
      const d = mount(world, type, { isGenerating: true })
      try {
        assert.equal(d.statusLine(), undefined, `${type}: no status line`)
        assert.equal(d.hosts().filter(node => node.props?.['data-studio-generating-status'] !== undefined).length, 0)
        await d.key({ key: 'Escape' })
        assert.deepEqual(d.closes, [], `${type}: Escape ignored while generating (the defect, flag off)`)
        await d.click(d.closeButton())
        assert.deepEqual(d.closes, [1], 'the ✕ still works')
      } finally { d.destroy() }
    }
  }
})
await check('C panel: the empty-prompt guard on: a blocked Generate keeps its name and is described by the hint (Studio shell and classic shell, all nine forms); unblocked as before', async () => {
  await emptyPromptAriaChecks(worldFor(ENV_C_ON), { studio: true })
  await emptyPromptAriaChecks(worldFor(ENV_C_ON_CLASSIC), { studio: false })
})
await check('C panel: the guard off: no description, no hint element, no label added (the button as #398 left it)', async () => {
  for (const env of [SHELL, {}, { ...SHELL, [FLAG_C]: 'false' }]) {
    const d = mount(worldFor(env), 'TEXT_BOX')
    try {
      const button = d.generateButton()
      assert.equal(button.props.title, 'Generate (⌘↵)')
      assert.equal(button.props['aria-describedby'], undefined)
      assert.equal(button.props['aria-label'], env.NEXT_PUBLIC_STUDIO_V4_SHELL ? 'Generate (⌘↵)' : undefined)
      assert.equal(d.hosts().filter(node => node.props?.id === 'generation-empty-prompt-hint').length, 0)
    } finally { d.destroy() }
  }
})

// ======================================================================================================================================
// 6. flag off == the base tree: traces of the whole panel
// ======================================================================================================================================
async function trace(world) {
  const log = []
  for (const type of ALL_FORMS) for (const mode of ['generate', 'refine']) {
    const d = mount(world, type, { mode })
    try {
      const snap = label => log.push([type, mode, label, sha(d.markup()), d.state?.() ?? null])
      snap('mounted')
      await d.type('A quarterly revenue chart'); snap('typed')
      await d.key({ key: 'Enter', metaKey: true }); snap('cmd-enter')
      d.rerender({ isGenerating: true }); snap('generating')
      await d.key({ key: 'Escape' }); snap('escape-generating')
      d.rerender({ isGenerating: false, error: 'The service is busy.' }); snap('error')
      d.rerender({ error: null, researchMode: 'on' }); snap('research-on')
      await d.type(''); snap('cleared')
      await d.key({ key: 'Escape' }); snap('escape-idle')
      log.push([type, mode, 'calls', d.calls.length, d.closes.length])
    } finally { d.destroy() }
  }
  return sha(log)
}
await check('flag off == base tree: full traces of the panel (markup per step, every call) hash-equal, flags A/B/C unset / "false" / "TRUE" / "1", Studio and classic', async () => {
  if (!baseAvailable) { console.log('     (skipped: base commit not in this clone)'); return }
  const overrides = baseOverrides()
  const flagSets = [{}, { [FLAG_A]: 'false', [FLAG_B]: 'false', [FLAG_C]: 'false' }, { [FLAG_A]: 'TRUE', [FLAG_B]: 'TRUE', [FLAG_C]: 'TRUE' }, { [FLAG_A]: '1', [FLAG_B]: '1', [FLAG_C]: '1' }]
  let printed = null
  for (const shell of [SHELL, {}]) {
    const baseHash = await trace(worldFor(shell, overrides))
    for (const flags of flagSets) {
      const hash = await trace(worldFor({ ...shell, ...flags }))
      assert.equal(hash, baseHash, `shell=${Object.keys(shell).length ? 'studio' : 'classic'} flags=${JSON.stringify(flags)}`)
    }
    printed = baseHash
  }
  console.log(`     base trace ${printed}`)
})
await check('flags on do change the trace (the identity above is not vacuous)', async () => {
  if (!baseAvailable) return
  const baseHash = await trace(worldFor(SHELL, baseOverrides()))
  assert.notEqual(await trace(worldFor({ ...SHELL, [FLAG_B]: 'true' })), baseHash)
  assert.notEqual(await trace(worldFor({ ...SHELL, [FLAG_C]: 'true' })), baseHash)
})

// ======================================================================================================================================
// 7. wiring and what must not change
// ======================================================================================================================================
function wiringChecks() {
  assert.match(read(LIB_A), /process\.env\.NEXT_PUBLIC_STUDIO_DISABLED_REASONS === 'true'/)
  assert.match(read(LIB_B), /process\.env\.NEXT_PUBLIC_STUDIO_GENERATING_STATUS === 'true'/)
  const readers = { [FLAG_A]: [], [FLAG_B]: [] }
  const walk = dir => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (['node_modules', '.next', '.git', 'docs', 'screenshots'].includes(entry.name)) continue
      const rel = dir === '.' ? entry.name : `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(rel)
      else if (/\.(tsx?|mjs)$/.test(entry.name) && !rel.startsWith('scripts/')) for (const flag of Object.keys(readers)) if (read(rel).includes(`process.env.${flag}`)) readers[flag].push(rel)
    }
  }
  walk('.')
  assert.deepEqual(readers[FLAG_A], [LIB_A], 'flag A is read in exactly one file')
  assert.deepEqual(readers[FLAG_B], [LIB_B], 'flag B is read in exactly one file')
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_DISABLED_REASONS="false"$/m)
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_GENERATING_STATUS="false"$/m)
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD="false"$/m, 'C stays under the existing flag (still documented default off)')
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-pass2b-batch1'], 'node scripts/test-studio-pass2b-batch1.mjs')
  // C adds no flag: the guard lib is unchanged and the input does not read it
  const inputCode = read(INPUT).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(inputCode, /studio-empty-prompt-guard|EMPTY_PROMPT_GUARD/, 'the input is told by its caller and imports nothing of the guard')
  assert.doesNotMatch(inputCode, /process\.env\.NEXT_PUBLIC_STUDIO_(DISABLED_REASONS|GENERATING_STATUS)/)
  // one wrapper: the viewer has no second hint mechanism
  const viewer = read(VIEWER)
  assert.equal((viewer.match(/data-studio-tab-paused="true"/g) ?? []).length, 1, 'the #396 wrapper is still the only title-wrapper')
  assert.equal((viewer.match(/<StudioDisabledReason\b/g) ?? []).length, 1, 'one use of the component, inside reasonWrap')
  assert.match(viewer, /const tabPausedWrap = \(control: React\.ReactNode, kind\?: StudioToolbarControl, label\?: string\) => STUDIO_DISABLED_REASONS_ENABLED && kind && label/)
  // the component and libs are pure of network and storage
  for (const file of [LIB_A, LIB_B, COMPONENT]) assert.doesNotMatch(read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /\b(fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|setTimeout|setInterval)\b/, file)
  if (baseAvailable) {
    // the files this change must not touch (other builders' and FRONTEND-2's): byte-equal to the base commit
    const frozen = ['app/builder/page.tsx', 'lib/studio-theme-restore.ts', 'components/builder/studio-theme-menu.tsx', 'lib/studio-empty-prompt-guard.ts', 'components/generation-panel/header.tsx']
    for (const file of git(['ls-tree', '-r', '--name-only', BASE_SHA, 'lib', 'components']).split('\n').filter(file => /composer-library|composer-popups/.test(file))) frozen.push(file)
    // #402 and #404 (the chat stream) changed app/builder/page.tsx after #401; these files are compared with the base they were merged onto (#404), not #401.
    for (const file of frozen) assert.equal(read(file), git(['show', `${FROZEN_SHA}:${file}`]), `${file} is untouched`)
    // no Layout viewer command: not one added or removed line of the viewer names a command, a postMessage or the iframe
    const diff = git(['diff', BASE_SHA, '--', VIEWER]).split('\n').filter(line => /^[+-](?![+-])/.test(line))
    for (const line of diff) assert.doesNotMatch(line, /postMessage|sendCommand|sendLayout|contentWindow|iframeRef|addEventListener|createViewerRequestId|action:/, `viewer diff touches a Layout command: ${line}`)
    // the viewer diff is the import, the wrappers and the gallery prop only
    const removed = git(['diff', BASE_SHA, '--', VIEWER]).split('\n').filter(line => /^-(?!--)/.test(line)).map(line => line.slice(1).trim())
    assert.deepEqual(removed, ['const tabPausedWrap = (control: React.ReactNode) => tabPaused', '/>)}', '<DropdownMenu>', '<StudioElementGalleryMenu items={addElementItems} />', '</DropdownMenu>',
      '<DropdownMenu', '</DropdownMenu>', '<button', '</button>', '/>)}'], 'the viewer\'s removed lines are exactly the openings and closings the wrappers replace')
  }
}
await check('wiring: flags read in one file each, documented default off, script registered, one wrapper (no second mechanism), frozen files untouched, no Layout command in the viewer diff', () => wiringChecks())

// ======================================================================================================================================
// 8. mutants
// ======================================================================================================================================
const mutantOk = []
const mutantMissed = []
async function mutant(name, file, find, replace, runner) {
  const original = read(file)
  if (!original.includes(find)) { mutantMissed.push(`does not apply: ${name}`); return }
  const mutated = original.replace(find, replace)
  if (mutated === original) { mutantMissed.push(`does not change the source: ${name}`); return }
  let caught = false
  try { await runner(mutated) } catch { caught = true }
  if (caught) mutantOk.push(name); else mutantMissed.push(`not caught: ${name}`)
}
const asWorld = (file, env) => source => ({ overrides: { [file]: source }, env })
await check('mutants: every one of them breaks a check above', async () => {
  const libAMut = source => libAChecks({ [LIB_A]: source })
  const libBMut = source => libBChecks({ [LIB_B]: source })
  // lib A
  await mutant('A lib: the paused-tab sentence is not first', LIB_A, "  if (state.tabPausedHint) return state.tabPausedHint\n", '', libAMut)
  await mutant('A lib: loading is not a reason', LIB_A, "  if (!state.viewerIsReady) return REASON_VIEWER_LOADING\n", '', libAMut)
  await mutant('A lib: Template is greyed by Template Mode', LIB_A, "if (control !== 'template' && state.templateModeOn)", 'if (state.templateModeOn)', libAMut)
  await mutant('A lib: Theme is greyed by a change in flight', LIB_A, "if ((control === 'add-slide' || control === 'add-element') && state.slideMutationPending)", 'if (state.slideMutationPending)', libAMut)
  await mutant('A lib: the flag is ignored', LIB_A, "=== 'true'", "!== 'x'", libAMut)
  await mutant('A lib: the Template Mode words changed', LIB_A, "'add-element': 'Exit Template Mode to add elements'", "'add-element': 'Template Mode is on'", libAMut)
  // lib B
  await mutant('B lib: the chart estimate is wrong', LIB_B, "usually: '10–30 s'", "usually: '1–2 s'", libBMut)
  await mutant('B lib: Image has no estimate', LIB_B, "IMAGE: { noun: 'image', usually: '60–90 s' }", "IMAGE: { noun: 'image' }", libBMut)
  await mutant('B lib: Escape closes from a text field outside the panel', LIB_B, 'return !(input.fromEditableField && input.outsidePanel)', 'return true', libBMut)
  await mutant('B lib: Escape rule ignores the flag', LIB_B, "if (!(input.enabled ?? STUDIO_GENERATING_STATUS_ENABLED)) return false\n", '', libBMut)
  await mutant('B lib: editable detection misses textarea', LIB_B, "tag === 'TEXTAREA' || ", '', libBMut)
  // component (interactive checks)
  const componentMut = source => {
    const world = worldFor({ [FLAG_A]: 'true' }, { [COMPONENT]: source }, { '@radix-ui/react-tooltip': fakeRadixTooltip })
    const { StudioDisabledReason } = world.load(COMPONENT)
    const mountIt = (reason, extra = {}) => {
      const tree = new Root()
      tree.setElement(React.createElement(StudioDisabledReason, { reason, label: 'Add Element', ...extra }, React.createElement('button', { disabled: true }, 'Add Element')))
      tree.flush()
      const hosts = hostNodes(tree.tree)
      const box = hosts.find(node => node.type === 'span')
      return { tree, hosts, box }
    }
    const blocked = mountIt('Loading the slide…')
    assert.equal(blocked.box.props.tabIndex, 0)
    assert.equal(blocked.box.props.role, 'button')
    assert.equal(blocked.box.props['aria-disabled'], true)
    assert.equal(blocked.box.props['aria-label'], 'Add Element')
    assert.ok(blocked.hosts.find(node => node.props?.id === blocked.box.props['aria-describedby'] && textOf(node) === 'Loading the slide…'))
    assert.match(blocked.box.props.className, /\[&_button\]:pointer-events-none/)
    blocked.box.props.onFocus({}); blocked.tree.flush()
    assert.equal(textOf(hostNodes(blocked.tree.tree).find(node => node.props?.['data-fixture'] === 'tooltip-content')), 'Loading the slide…')
    const idle = mountIt(null)
    assert.equal(idle.box.props.tabIndex, undefined)
    assert.equal(idle.box.props.role, undefined)
    assert.equal(idle.hosts.filter(node => node.props?.className?.includes('sr-only')).length, 0)
    idle.box.props.onFocus({}); idle.tree.flush()
    assert.equal(hostNodes(idle.tree.tree).find(node => node.props?.['data-fixture'] === 'tooltip-content'), undefined)
    assert.equal(mountIt('x', { tabPaused: true }).box.props['data-studio-tab-paused'], 'true')
    assert.equal(mountIt('').box.props.tabIndex, undefined, 'an empty reason is no reason')
    const withContainer = mountIt('x', { portalContainer: { fullscreen: true } })
    withContainer.box.props.onFocus({}); withContainer.tree.flush()
    assert.equal(hostNodes(withContainer.tree.tree).find(node => node.props?.['data-fixture'] === 'tooltip-portal').props['data-container'], 'given', 'the fullscreen container reaches the portal')
  }
  await mutant('A component: no tab stop', COMPONENT, 'tabIndex={blocked ? 0 : undefined}', 'tabIndex={undefined}', componentMut)
  await mutant('A component: no aria-describedby', COMPONENT, 'aria-describedby={blocked ? reasonId : undefined}', 'aria-describedby={undefined}', componentMut)
  await mutant('A component: no aria-disabled', COMPONENT, 'aria-disabled={blocked ? true : undefined}', 'aria-disabled={undefined}', componentMut)
  await mutant('A component: no role', COMPONENT, "role={blocked ? 'button' : undefined}", 'role={undefined}', componentMut)
  await mutant('A component: no accessible name', COMPONENT, 'aria-label={blocked ? label : undefined}', 'aria-label={undefined}', componentMut)
  await mutant('A component: the box is a tab stop even when enabled', COMPONENT, 'tabIndex={blocked ? 0 : undefined}', 'tabIndex={0}', componentMut)
  await mutant('A component: the reason is not rendered for assistive tech', COMPONENT, '{blocked && <span id={reasonId} className="sr-only">{reason}</span>}', '', componentMut)
  await mutant('A component: no tooltip', COMPONENT, '{blocked && (\n          <TooltipPrimitive.Portal', '{false && (\n          <TooltipPrimitive.Portal', componentMut)
  await mutant('A component: the disabled button still swallows the pointer', COMPONENT, '[&_button]:pointer-events-none ', '', componentMut)
  await mutant('A component: an empty reason counts', COMPONENT, "typeof reason === 'string' && reason !== ''", "typeof reason === 'string'", componentMut)
  await mutant('A component: the paused-tab marker dropped', COMPONENT, "data-studio-tab-paused={blocked && tabPaused ? 'true' : undefined}", 'data-studio-tab-paused={undefined}', componentMut)
  await mutant('A component: the portal container is dropped', COMPONENT, '<TooltipPrimitive.Portal container={portalContainer}>', '<TooltipPrimitive.Portal>', componentMut)
  // viewer
  const viewerMut = source => { toolbarFlagOnChecks(source); toolbarFlagOffIdentity(source, baseViewerText) }
  if (baseAvailable) {
    await mutant('A viewer: reasonWrap ignores the flag', VIEWER, 'STUDIO_DISABLED_REASONS_ENABLED\n          ? <StudioDisabledReason reason={toolbarReason(kind)}', 'true\n          ? <StudioDisabledReason reason={toolbarReason(kind)}', viewerMut)
    await mutant('A viewer: Theme has no wrapper', VIEWER, "{reasonWrap(<button\n                onClick={() => setShowThemePanel(true)}", '{(<button\n                onClick={() => setShowThemePanel(true)}', viewerMut)
    await mutant('A viewer: Theme wrapper dropped from its closing call', VIEWER, "</button>, 'theme', 'Theme')}", '</button>, \'add-slide\', \'Theme\')}', viewerMut)
    await mutant('A viewer: Add Slide has no wrapper', VIEWER, "/>, 'add-slide', 'Add Slide')}", '/>)}', viewerMut)
    await mutant('A viewer: Add Element has no wrapper', VIEWER, "{reasonWrap(<DropdownMenu>\n                <DropdownMenuTrigger asChild>", "{(<DropdownMenu>\n                <DropdownMenuTrigger asChild>", viewerMut)
    await mutant('A viewer: Template (menu) wrapper wrong kind', VIEWER, "</DropdownMenu>, 'template', 'Template')", "</DropdownMenu>, 'theme', 'Template')", viewerMut)
    await mutant('A viewer: Template (picker) wrapper dropped', VIEWER, "/>, 'template', 'Template')}", '/>)}', viewerMut)
    await mutant('A viewer: the title wrapper is doubled with the flag on', VIEWER, 'STUDIO_DISABLED_REASONS_ENABLED && kind && label\n          ? reasonWrap(control, kind, label)', 'false\n          ? reasonWrap(control, kind, label)', viewerMut)
    await mutant('A viewer: the paused sentence is not the reason', VIEWER, '{ tabPausedHint: studioTabPausedHint, viewerIsReady,', '{ tabPausedHint: undefined, viewerIsReady,', viewerMut)
    await mutant('A viewer: the fullscreen container is not passed', VIEWER, 'tabPaused={tabPaused} portalContainer={toolbarDropdownPortalContainer}>', 'tabPaused={tabPaused}>', viewerMut)
    await mutant('A viewer: the flag-off tooltip box is always on (the title wrapper loses its flag test)', VIEWER, ': tabPaused\n          ? <span title={studioTabPausedHint}', ': true\n          ? <span title={studioTabPausedHint}', viewerMut)
  }
  // gallery
  const galleryMut = source => galleryChecks({ [GALLERY]: source })
  await mutant('A gallery: no reason line', GALLERY, '{reasonShown && <span id={GALLERY_REASON_ID}', '{false && <span id={GALLERY_REASON_ID}', galleryMut)
  await mutant('A gallery: cards lose their title', GALLERY, 'title={cardReason ? disabledReason : undefined}', 'title={undefined}', galleryMut)
  await mutant('A gallery: cards are not described by the reason', GALLERY, "aria-describedby={cardReason ? [describedBy, GALLERY_REASON_ID].filter(Boolean).join(' ') : describedBy}", 'aria-describedby={describedBy}', galleryMut)
  await mutant('A gallery: enabled cards get the reason too', GALLERY, 'const cardReason = reasonShown && disabled', 'const cardReason = reasonShown', galleryMut)
  await mutant('A gallery: the line shows with nothing disabled', GALLERY, "items.some(item => item.disabled)", 'true', galleryMut)
  // research
  const researchMut = source => researchChecks({ [RESEARCH]: source })
  await mutant('A research: the visible lines are gone', RESEARCH, '{STUDIO_DISABLED_REASONS_ENABLED && (\n          <VisibleSourceReasons', '{false && (\n          <VisibleSourceReasons', researchMut)
  await mutant('A research: the checkbox is not described by the visible line', RESEARCH, 'aria-describedby={reason || visibleReason ? reasonId : undefined}', 'aria-describedby={reason ? reasonId : undefined}', researchMut)
  await mutant('A research: the sr-only copy stays (read twice)', RESEARCH, '{reason && !visibleReason && <span', '{reason && <span', researchMut)
  await mutant('A research: Research-off sources do not share one line', RESEARCH, "const id = reason === RESEARCH_OFF_REASON ? RESEARCH_OFF_REASON_ID : sourceReasonId(label)", 'const id = sourceReasonId(label)', researchMut)
  await mutant('A research: the capability reason is not shown', RESEARCH, "const reason = sourceReason(researchEnabled, capability) ?? REASON_SOURCE_UNAVAILABLE", 'const reason = RESEARCH_OFF_REASON', researchMut)
  await mutant('A research: a reasonless greyed source stays silent', RESEARCH, "const reason = sourceReason(researchEnabled, capability) ?? REASON_SOURCE_UNAVAILABLE", 'const reason = sourceReason(researchEnabled, capability) ?? \'\'', researchMut)
  // panel and input
  const panelWorld = (file, env) => source => worldFor(env, { [file]: source })
  const statusMut = source => statusChecks(worldFor(ENV_B_ON, { [PANEL]: source }))
  const statusInputMut = source => statusChecks(worldFor(ENV_B_ON, { [INPUT]: source }))
  const escapeMut = source => escapeChecks(worldFor(ENV_B_ON, { [PANEL]: source }))
  await mutant('B panel: the status is never handed to the input', PANEL, "generatingStatus={STUDIO_GENERATING_STATUS_ENABLED ? (isGenerating ? generatingStatusText(elementType) : '') : undefined}", '', statusMut)
  await mutant('B panel: the status ignores the type', PANEL, 'generatingStatusText(elementType)', "generatingStatusText('TEXT_BOX')", statusMut)
  await mutant('B panel: the status stays after generating', PANEL, "(isGenerating ? generatingStatusText(elementType) : '')", 'generatingStatusText(elementType)', statusMut)
  await mutant('B panel: Escape is still ignored while generating', PANEL, "if (e.key === 'Escape' && (!isGenerating || escapeClosesWhileGenerating({", "if (e.key === 'Escape' && (!isGenerating || false && escapeClosesWhileGenerating({", escapeMut)
  await mutant('B panel: Escape also closes from a field outside the panel', PANEL, 'fromEditableField: isEditableEventTarget(e.target),', 'fromEditableField: false,', escapeMut)
  await mutant('B panel: Escape closes without the ✕ handler (a different callback)', PANEL, "        e.preventDefault()\n        onClose()\n      }\n      if (e.key === 'Enter'", "        e.preventDefault()\n        onClose(e)\n      }\n      if (e.key === 'Enter'", escapeMut)
  await mutant('B panel: Escape while generating no longer swallows the key', PANEL, "        e.preventDefault()\n        onClose()\n      }\n      if (e.key === 'Enter'", "        onClose()\n      }\n      if (e.key === 'Enter'", escapeMut)
  await mutant('B input: the live region is not polite', INPUT, 'aria-live="polite"\n          data-studio-generating-status', 'data-studio-generating-status', statusInputMut)
  await mutant('B input: the line is rendered only while generating', INPUT, '{generatingStatus !== undefined && (', "{generatingStatus && (", statusInputMut)
  await mutant('B input: the idle line takes room', INPUT, "style={generatingStatus ? undefined : { marginTop: 0 }}", '', statusInputMut)
  await mutant('B input: the status role is dropped', INPUT, 'role="status"\n          aria-live="polite"', 'aria-live="polite"', statusInputMut)
  const cMut = studio => async source => emptyPromptAriaChecks(worldFor(studio ? ENV_C_ON : ENV_C_ON_CLASSIC, { [INPUT]: source }), { studio })
  await mutant('C input: no description on the blocked button', INPUT, 'aria-describedby={promptGuardBlocked ? EMPTY_PROMPT_HINT_ID : undefined}', '', cMut(true))
  await mutant('C input: the hint element is missing', INPUT, '{promptGuardBlocked && <span id={EMPTY_PROMPT_HINT_ID} className="sr-only">{promptGuardHint}</span>}', '', cMut(true))
  await mutant('C input: the classic shell loses its name (the hint title becomes the name)', INPUT, 'aria-label={STUDIO_GENERATION_FEEDBACK || promptGuardBlocked', 'aria-label={STUDIO_GENERATION_FEEDBACK', cMut(false))
  await mutant('C input: the description stays after the prompt is typed', INPUT, 'aria-describedby={promptGuardBlocked ? EMPTY_PROMPT_HINT_ID : undefined}', 'aria-describedby={EMPTY_PROMPT_HINT_ID}', cMut(true))
  void panelWorld; void asWorld
  console.log(`     ${mutantOk.length} mutants caught`)
  assert.deepEqual(mutantMissed, [], 'every mutant must apply and be caught')
})

if (failures.length) {
  console.error(`\nFAIL studio pass2b batch1: ${failures.length} of ${testCount} checks failed:\n  - ${failures.join('\n  - ')}`)
  process.exit(1)
}
console.log(`\nPASS studio pass2b batch1: ${testCount} checks, ${mutantOk.length} mutants caught${baseAvailable ? '' : ' (base commit not in this clone: the flag-off identity checks were skipped)'}`)
process.exit(0)
