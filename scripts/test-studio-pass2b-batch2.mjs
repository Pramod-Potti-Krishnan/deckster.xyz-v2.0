// PASS2B batch 2 (ELEMENT-2, canvas audit J3-02 / J3-09 / J5-09). Three default-off switches, each exact "true":
//   A  NEXT_PUBLIC_STUDIO_PROMPT_AUTOFOCUS            a NEW element opened in the Add Element panel (generate mode) focuses the "Generation prompt" box,
//      after the Radix menu that picked it has closed and handed focus back to its trigger; never in edit/refine mode, never over focus the person
//      already placed (inside the panel, another text field, an open menu/dialog), never into a box that takes no text, never in a hidden drawer.
//   B  NEXT_PUBLIC_STUDIO_SHAPE_PRESET_PROMPT_HINT    a preset (non-Custom) Shape: the prompt box is read-only + aria-disabled with the visible sentence
//      "Presets don't use a prompt. Choose Custom to describe a shape."; the typed text is kept; Custom and the request are unchanged.
//   C  NEXT_PUBLIC_STUDIO_TEMPLATE_SAVE_REASONS       the Save as Template dialog shows the first unmet reason under a disabled Save button
//      (aria-describedby on the button): name, session, source deck, loading.
//
// Proves, offline (no socket, fetch, timer or network; the #371 harness pattern: the REAL panel, input, forms, libs and dialog run in mini-react, only
// Radix wrappers and icons are stubbed; the lib's timers run on a fake clock against a fake DOM):
//   1. the libs: flag literals, the key / focus / reason / hint rules;
//   2. A: the real focus function on a fake DOM and clock, including the Radix focus-restore race, every no-steal rule, cancel;
//   3. A: the real panel's wiring: one scheduled focus per new activation of a generate-mode panel, none in edit/refine, none with the flag off;
//   4. B: the real Shape form + input: preset => read-only/aria-disabled/visible hint/text kept/placeholder, Custom unchanged, request payload and
//      #398 guard semantics unchanged;
//   5. C: the real dialog over every state (24): the reason names the first unmet rule, exists exactly when Save is disabled, is its description;
//   6. flag off == the base tree: traces of the panel (every form, both modes, a preset Shape) and of the dialog (every state) hash-equal to base;
//   7. wiring and the files this change must not touch; no Layout viewer command touched;
//   8. mutants of the libs, the input, the panel, the form and the dialog must each be caught.
//
//   node scripts/test-studio-pass2b-batch2.mjs
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'
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
const reactNoise = /You provided a `checked`|incorrect casing|React does not recognize|is unrecognized in this browser|Invalid DOM property|non-boolean attribute|Received `(true|false)` for a non-boolean/
const consoleError = console.error.bind(console)
console.error = (...args) => { if (typeof args[0] === 'string' && reactNoise.test(args[0])) return; consoleError(...args) }
const denied = () => { throw new Error('Offline harness forbids network') }
net.connect = net.createConnection = net.Socket.prototype.connect = denied
http.request = http.get = https.request = https.get = denied
globalThis.fetch = denied

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** studio-v4-dev-preparation-code at #404 (PASS2B batch 1 merged): flag off must behave exactly as this. */
const BASE_SHA = 'dd47bd58855636abae0ab2fdb7409c575a8f07ed'
const FLAG_AF = 'NEXT_PUBLIC_STUDIO_PROMPT_AUTOFOCUS'
const FLAG_SH = 'NEXT_PUBLIC_STUDIO_SHAPE_PRESET_PROMPT_HINT'
const FLAG_TS = 'NEXT_PUBLIC_STUDIO_TEMPLATE_SAVE_REASONS'
const FLAG_GUARD = 'NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD'
const LIB_AF = 'lib/studio-prompt-autofocus.ts'
const LIB_SH = 'lib/studio-shape-preset-prompt-hint.ts'
const LIB_TS = 'lib/studio-template-save-reasons.ts'
const PANEL = 'components/generation-panel/index.tsx'
const INPUT = 'components/generation-panel/shared/generation-input.tsx'
const SHAPE_FORM = 'components/generation-panel/forms/shape-form.tsx'
const TYPES = 'components/generation-panel/types.ts'
const DIALOG = 'components/template-save-dialog.tsx'
const VIEWER = 'components/presentation-viewer.tsx'
const HINT_TEXT = "Presets don't use a prompt. Choose Custom to describe a shape."
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16)

const gitEnv = { ...process.env }
delete gitEnv.GIT_DIR
delete gitEnv.GIT_WORK_TREE
const git = args => execFileSync('git', args, { cwd: root, env: gitEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_SHA}^{commit}`]) } catch { baseAvailable = false }
const baseFile = rel => git(['show', `${BASE_SHA}:${rel}`])
/** The base tree = this tree with every file of the generation panel and the template dialog read from BASE_SHA. */
function baseOverrides() {
  const overrides = { [DIALOG]: baseFile(DIALOG) }
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
const keepProps = tag => ({ children, asChild, ...props }) => React.createElement(tag, props, children)
const templateState = { loading: false, events: [] }
const baseStubs = {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'lucide-react': lucideStub(React),
  '@/components/ui/popover': { __esModule: true, Popover: passThrough('popover'), PopoverTrigger: passThrough('popover-trigger'), PopoverContent: passThrough('popover-content') },
  '@/components/ui/tooltip': { __esModule: true, Tooltip: passThrough('tooltip'), TooltipTrigger: passThrough('tooltip-trigger'), TooltipContent: passThrough('tooltip-content'), TooltipProvider: passThrough('tooltip-provider') },
  '@/components/ui/switch': { __esModule: true, Switch: props => React.createElement('button', { role: 'switch', ...props }) },
  '@/components/ui/checkbox': { __esModule: true, Checkbox: props => React.createElement('input', { type: 'checkbox', ...props }) },
  '@/components/ui/dropdown-menu': { __esModule: true, DropdownMenuContent: keepProps('div'), DropdownMenuItem: keepProps('div'), DropdownMenuLabel: keepProps('div') },
  // the template dialog's UI parts: plain host elements that keep their props
  '@/components/ui/dialog': { __esModule: true, Dialog: ({ children }) => React.createElement('div', { 'data-fixture': 'dialog' }, children),
    DialogContent: keepProps('div'), DialogHeader: keepProps('div'), DialogTitle: keepProps('h2'), DialogDescription: keepProps('p'), DialogFooter: keepProps('div') },
  '@/components/ui/button': { __esModule: true, Button: keepProps('button') },
  '@/components/ui/input': { __esModule: true, Input: keepProps('input') },
  '@/components/ui/label': { __esModule: true, Label: keepProps('label') },
  '@/hooks/use-toast': { __esModule: true, useToast: () => ({ toast: value => templateState.events.push(['toast', value.title]) }) },
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
  const world = { load, Panel: null, Dialog: null, env }
  worldCache.set(key, world)
  return world
}
const panelOf = world => (world.Panel ??= world.load(PANEL).GenerationPanel)
const libAF = (env, overrides) => worldFor(env, overrides).load(LIB_AF)
const libSH = (env, overrides) => worldFor(env, overrides).load(LIB_SH)
const libTS = (env, overrides) => worldFor(env, overrides).load(LIB_TS)

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
  const onGenerate = async (formData, intent) => { calls.push({ type: formData.componentType, prompt: formData.prompt, intent, formData }) }
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
    hintLine: () => driver.hosts().find(node => node.props?.id === 'generation-prompt-disabled-hint'),
    generateButton: () => driver.hosts().find(node => node.type === 'button' && typeof node.props.title === 'string'
      && (node.props.title.startsWith('Generate') || node.props.title === 'Describe what you want to generate' || node.props.title.startsWith('Check generation') || node.props.title.startsWith('Shorten'))),
    optionButton: label => driver.hosts().find(node => node.type === 'button' && textOf(node) === label && typeof node.props.onClick === 'function'),
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
const ENV_AF = { ...SHELL, [FLAG_AF]: 'true' }
const ENV_SH = { ...SHELL, [FLAG_SH]: 'true' }
const ENV_SH_GUARD = { ...SHELL, [FLAG_SH]: 'true', [FLAG_GUARD]: 'true' }
const ENV_GUARD = { ...SHELL, [FLAG_GUARD]: 'true' }
const FLAG_VALUES = [['true', true], ['false', false], ['TRUE', false], ['1', false], ['', false], [undefined, false]]

// ======================================================================================================================================
// A. a fake DOM and a fake clock for the real focus function
// ======================================================================================================================================
const PANEL_SELECTOR = '[data-studio-v4-panel="element-generation"]'
const HIDDEN_SELECTOR = '[data-studio-v4-shell="true"] [data-studio-workspace-visible="false"]'
function fakeDom() {
  let now = 0, order = 0
  const timers = []
  const view = {
    setTimeout(fn, ms) { const timer = { at: now + ms, order: ++order, fn }; timers.push(timer); return timer },
    clearTimeout(timer) { const index = timers.indexOf(timer); if (index >= 0) timers.splice(index, 1) },
  }
  const doc = { activeElement: null, body: { tagName: 'BODY' }, defaultView: view, menus: 0, querySelector: selector => (selector === '[role="menu"]' && doc.menus > 0 ? { role: 'menu' } : null) }
  doc.activeElement = doc.body
  const panelHolds = new Set()
  const panelEl = { contains: other => panelHolds.has(other) }
  const attrs = {}
  const box = {
    tagName: 'TEXTAREA', ownerDocument: doc, disabled: false, readOnly: false, focusCalls: 0, hidden: false, inPanel: true,
    getAttribute: name => attrs[name] ?? null,
    setAttr: (name, value) => { attrs[name] = value },
    closest: selector => (selector === HIDDEN_SELECTOR ? (box.hidden ? {} : null) : selector === PANEL_SELECTOR ? (box.inPanel ? panelEl : null) : null),
    focus: () => { box.focusCalls += 1; doc.activeElement = box },
  }
  panelHolds.add(box)
  const element = (tagName, extra = {}) => ({ tagName, closest: () => null, ...extra })
  const clock = {
    get now() { return now },
    /** Runs every timer due within `ms`, in (time, creation) order, advancing the clock to each. */
    advance(ms) {
      const until = now + ms
      for (;;) {
        const due = timers.filter(timer => timer.at <= until).sort((a, b) => a.at - b.at || a.order - b.order)[0]
        if (!due) break
        timers.splice(timers.indexOf(due), 1)
        now = due.at
        due.fn()
      }
      now = until
    },
    pending: () => timers.length,
    /** What Radix does when the picking menu closes: the content leaves the DOM, then a zero-delay timer restores focus to the trigger. */
    menuCloses(trigger) { doc.menus = 0; view.setTimeout(() => { doc.activeElement = trigger }, 0) },
    at(ms, fn) { view.setTimeout(fn, ms) },
  }
  return { doc, view, box, clock, element, panelEl, panelHolds }
}
const lib = overrides => libAF(ENV_AF, overrides)

function autofocusLibChecks(overrides = {}) {
  // flag literal: exact "true" only
  for (const [value, expected] of FLAG_VALUES) {
    const env = value === undefined ? {} : { [FLAG_AF]: value }
    assert.equal(libAF(env, overrides).STUDIO_PROMPT_AUTOFOCUS_ENABLED, expected, `flag ${JSON.stringify(value)}`)
    assert.equal(libAF(env, overrides).promptAutofocusKey({ isOpen: true, mode: 'generate', showsPromptBox: true, activationId: 3, elementType: 'CHART' }) !== undefined, expected, `default enabled follows the flag ${JSON.stringify(value)}`)
  }
  const { promptAutofocusKey } = lib(overrides)
  const base = { enabled: true, isOpen: true, mode: 'generate', showsPromptBox: true, activationId: 3, elementType: 'CHART' }
  assert.equal(promptAutofocusKey(base), '3:CHART')
  assert.notEqual(promptAutofocusKey({ ...base, activationId: 4 }), promptAutofocusKey(base), 'a new activation is a new key')
  assert.notEqual(promptAutofocusKey({ ...base, elementType: 'IMAGE' }), promptAutofocusKey(base), 'a new element type is a new key')
  assert.equal(promptAutofocusKey({ ...base, enabled: false }), undefined, 'flag off')
  assert.equal(promptAutofocusKey({ ...base, isOpen: false }), undefined, 'closed')
  assert.equal(promptAutofocusKey({ ...base, mode: 'edit' }), undefined, 'edit mode never')
  assert.equal(promptAutofocusKey({ ...base, mode: 'refine' }), undefined, 'refine mode never')
  assert.equal(promptAutofocusKey({ ...base, showsPromptBox: false }), undefined, 'no prompt box')
}
function mayTakeFocusChecks(overrides = {}) {
  const { promptBoxMayTakeFocus } = lib(overrides)
  assert.equal(promptBoxMayTakeFocus(null), false)
  assert.equal(promptBoxMayTakeFocus(undefined), false)
  const fresh = () => fakeDom()
  // focus on the page body, or on a button (the Add Element trigger Radix restored): the box may take it
  let w = fresh(); assert.equal(promptBoxMayTakeFocus(w.box), true, 'nothing focused')
  w = fresh(); w.doc.activeElement = w.element('BUTTON'); assert.equal(promptBoxMayTakeFocus(w.box), true, 'the Add Element button holds it')
  w = fresh(); w.doc.activeElement = w.element('IFRAME'); assert.equal(promptBoxMayTakeFocus(w.box), true, 'the viewer iframe holds it (a placeholder was clicked)')
  w = fresh(); w.doc.activeElement = null; assert.equal(promptBoxMayTakeFocus(w.box), true, 'no active element')
  // the box itself
  w = fresh(); w.box.disabled = true; assert.equal(promptBoxMayTakeFocus(w.box), false, 'disabled (generating)')
  w = fresh(); w.box.readOnly = true; assert.equal(promptBoxMayTakeFocus(w.box), false, 'read-only (a preset shape)')
  w = fresh(); w.box.setAttr('aria-disabled', 'true'); assert.equal(promptBoxMayTakeFocus(w.box), false, 'aria-disabled')
  w = fresh(); w.box.setAttr('aria-disabled', 'false'); assert.equal(promptBoxMayTakeFocus(w.box), true, 'aria-disabled="false" is not disabled')
  w = fresh(); w.box.hidden = true; assert.equal(promptBoxMayTakeFocus(w.box), false, 'hidden Studio drawer')
  w = fresh(); w.doc.activeElement = w.box; assert.equal(promptBoxMayTakeFocus(w.box), false, 'already focused: nothing to do')
  assert.equal(promptBoxMayTakeFocus({ ownerDocument: fresh().doc }), false, 'no focus function')
  // focus the person already placed
  w = fresh(); const inPanel = w.element('BUTTON'); w.panelHolds.add(inPanel); w.doc.activeElement = inPanel
  assert.equal(promptBoxMayTakeFocus(w.box), false, 'focus is on a control inside the panel')
  w = fresh(); w.doc.activeElement = w.element('INPUT'); assert.equal(promptBoxMayTakeFocus(w.box), false, 'another text field')
  w = fresh(); w.doc.activeElement = w.element('TEXTAREA'); assert.equal(promptBoxMayTakeFocus(w.box), false, 'another textarea (the chat box)')
  w = fresh(); w.doc.activeElement = w.element('select'); assert.equal(promptBoxMayTakeFocus(w.box), false, 'a select')
  w = fresh(); w.doc.activeElement = w.element('DIV', { isContentEditable: true }); assert.equal(promptBoxMayTakeFocus(w.box), false, 'contenteditable')
  for (const overlay of ['[role="menu"]', '[role="dialog"]', '[role="alertdialog"]', '[role="listbox"]']) {
    w = fresh(); w.doc.activeElement = w.element('BUTTON', { closest: selector => (selector.includes(overlay) ? {} : null) })
    assert.equal(promptBoxMayTakeFocus(w.box), false, `focus inside an open ${overlay}`)
  }
  // a box outside any panel marker (no panel found): the "inside the panel" rule has nothing to compare, the others still apply
  w = fresh(); w.box.inPanel = false; w.doc.activeElement = w.element('BUTTON'); assert.equal(promptBoxMayTakeFocus(w.box), true)
}
function scheduleChecks(overrides = {}) {
  const { schedulePromptFocus, AUTOFOCUS_POLL_MS, AUTOFOCUS_MAX_WAIT_MS, AUTOFOCUS_SETTLE_MS } = lib(overrides)
  assert.equal(AUTOFOCUS_POLL_MS, 40); assert.equal(AUTOFOCUS_MAX_WAIT_MS, 1000); assert.equal(AUTOFOCUS_SETTLE_MS, 60)
  // 1. no menu at all (a blank placeholder was clicked): focuses after the settle pause, not before
  let w = fakeDom(); const trigger = w.element('BUTTON')
  w.doc.activeElement = trigger
  schedulePromptFocus(() => w.box)
  w.clock.advance(AUTOFOCUS_SETTLE_MS - 1); assert.equal(w.box.focusCalls, 0, 'not before the settle pause')
  w.clock.advance(1); assert.equal(w.doc.activeElement, w.box, 'no menu: focused'); assert.equal(w.box.focusCalls, 1)
  // 2. the Radix race: the menu stays through its exit animation, leaves at 250 ms, Radix restores focus to the trigger from a timer queued then
  w = fakeDom(); const addElement = w.element('BUTTON'); w.doc.activeElement = addElement; w.doc.menus = 1
  schedulePromptFocus(() => w.box)
  w.clock.at(250, () => w.clock.menuCloses(addElement))
  w.clock.advance(249); assert.equal(w.box.focusCalls, 0, 'not while the menu is still on the page')
  w.clock.advance(1)
  w.clock.advance(200); assert.equal(w.doc.activeElement, w.box, 'after Radix restored focus to the trigger, the box has it (the defect: it ended on the button)'); assert.equal(w.box.focusCalls, 1)
  // 3. a menu that never goes (another menu is open and holds focus): after the wait ceiling the box is still not forced
  w = fakeDom(); w.doc.menus = 1; w.doc.activeElement = w.element('DIV', { closest: selector => (selector.includes('[role="menu"]') ? {} : null) })
  schedulePromptFocus(() => w.box)
  w.clock.advance(AUTOFOCUS_MAX_WAIT_MS + AUTOFOCUS_SETTLE_MS + 200)
  assert.equal(w.box.focusCalls, 0, 'focus inside an open menu is never stolen')
  assert.equal(w.clock.pending(), 0, 'and the polling stopped')
  // 3b. a menu that never goes but focus is on the page: the ceiling ends the wait and the box takes focus
  w = fakeDom(); w.doc.menus = 1; w.doc.activeElement = w.element('BUTTON')
  schedulePromptFocus(() => w.box)
  w.clock.advance(AUTOFOCUS_MAX_WAIT_MS - 1); assert.equal(w.box.focusCalls, 0, 'still waiting below the ceiling')
  w.clock.advance(AUTOFOCUS_SETTLE_MS + 200); assert.equal(w.box.focusCalls, 1, 'the wait is bounded')
  // 4. cancel (the panel closed or a new activation): nothing happens afterwards, at any stage
  for (const cancelAt of [0, 30, 100, 300]) {
    w = fakeDom(); w.doc.menus = 1; w.doc.activeElement = w.element('BUTTON')
    w.clock.at(250, () => { w.doc.menus = 0 })
    const cancel = schedulePromptFocus(() => w.box)
    w.clock.advance(cancelAt); cancel(); w.clock.advance(2000)
    assert.equal(w.box.focusCalls, 0, `cancelled at ${cancelAt} ms: no focus`)
    assert.equal(w.clock.pending(), 0, `cancelled at ${cancelAt} ms: no timer left`)
  }
  // 5. the person moved on while it waited
  w = fakeDom(); w.doc.menus = 1; w.doc.activeElement = w.element('BUTTON')
  schedulePromptFocus(() => w.box)
  w.clock.at(100, () => { w.doc.menus = 0; w.doc.activeElement = w.element('TEXTAREA') })
  w.clock.advance(1000); assert.equal(w.box.focusCalls, 0, 'they started typing in the chat box: left alone')
  w = fakeDom(); w.doc.activeElement = w.element('BUTTON')
  schedulePromptFocus(() => w.box)
  w.clock.at(20, () => { const control = w.element('BUTTON'); w.panelHolds.add(control); w.doc.activeElement = control })
  w.clock.advance(1000); assert.equal(w.box.focusCalls, 0, 'they moved to a control of the panel: left alone')
  // 6. the box changed after the focus was scheduled (a Shape preset registered late, a generation started): read at the moment of focusing
  w = fakeDom(); w.doc.activeElement = w.element('BUTTON')
  schedulePromptFocus(() => w.box)
  w.clock.at(10, () => { w.box.readOnly = true })
  w.clock.advance(1000); assert.equal(w.box.focusCalls, 0, 'read-only by then')
  w = fakeDom(); w.doc.activeElement = w.element('BUTTON')
  schedulePromptFocus(() => w.box)
  w.clock.at(10, () => { w.box.disabled = true })
  w.clock.advance(1000); assert.equal(w.box.focusCalls, 0, 'disabled by then')
  // 6b. the textarea was replaced (remounted) after scheduling: the box current at the moment of focusing gets it
  w = fakeDom(); w.doc.activeElement = w.element('BUTTON')
  let current = w.box
  const replacement = { ...w.box, focusCalls: 0, focus: () => { replacement.focusCalls += 1; w.doc.activeElement = replacement } }
  w.panelHolds.add(replacement)
  schedulePromptFocus(() => current)
  w.clock.at(10, () => { current = replacement })
  w.clock.advance(1000); assert.equal(replacement.focusCalls, 1, 'the replacement box is focused'); assert.equal(w.box.focusCalls, 0, 'the old one is not')
  // 7. the box is gone / has no document
  let gone = false; w = fakeDom()
  schedulePromptFocus(() => (gone ? null : w.box)); gone = true; w.clock.advance(1000); assert.equal(w.box.focusCalls, 0, 'unmounted before it fired')
  assert.equal(typeof schedulePromptFocus(() => null), 'function', 'no box: a no-op cancel')
  assert.equal(typeof schedulePromptFocus(() => ({ focus() {} })), 'function', 'no document: a no-op cancel')
}
await check('A lib: flag literal (exact "true"), the key per activation, edit/refine/closed/no-box never', () => autofocusLibChecks())
await check('A lib: may-take-focus: the box rules and every focus the person already placed', () => mayTakeFocusChecks())
await check('A lib: the real focus function on a fake DOM and clock: the Radix focus-restore race, the wait ceiling, cancel, a person who moved on, a box that changed', () => scheduleChecks())

// ======================================================================================================================================
// A. the real panel: one scheduled focus per new activation of a generate-mode panel
// ======================================================================================================================================
const afLog = { events: [], n: 0 }
function afWorld(env, overrides = {}) {
  const real = worldFor(env, overrides).load(LIB_AF)
  const stub = {
    ...real,
    schedulePromptFocus: getBox => {
      const id = ++afLog.n
      afLog.events.push(['schedule', id, typeof getBox])
      return () => { afLog.events.push(['cancel', id]) }
    },
  }
  return worldFor(env, overrides, { '@/lib/studio-prompt-autofocus': stub })
}
const afEvents = () => afLog.events.map(event => event.slice(0, 2).join(':')).join(' ')
async function autofocusPanelChecks(overrides = {}) {
  const world = afWorld(ENV_AF, overrides)
  for (const type of ALL_FORMS) {
    afLog.events.length = 0
    const d = mount(world, type, { activationId: 1 })
    try {
      assert.equal(afEvents(), `schedule:${afLog.n}`, `${type}: opened in generate mode: one focus scheduled`)
      const first = afLog.n
      d.rerender({ researchMode: 'on' }); d.rerender({ isGenerating: false, error: 'x' })
      assert.equal(afLog.events.length, 1, `${type}: re-rendering the same activation schedules nothing more`)
      d.rerender({ activationId: 2 })
      assert.equal(afEvents(), `schedule:${first} cancel:${first} schedule:${first + 1}`, `${type}: a new activation cancels the old focus and schedules one`)
      d.rerender({ isOpen: false })
      assert.equal(afEvents(), `schedule:${first} cancel:${first} schedule:${first + 1} cancel:${first + 1}`, `${type}: closing cancels a pending focus`)
      d.rerender({ isOpen: true })
      assert.equal(afLog.events.length, 5, `${type}: reopening (same activation) schedules once more`)
      assert.equal(afLog.events[4][0], 'schedule')
      d.rerender({ elementType: type === 'CHART' ? 'IMAGE' : 'CHART' })
      assert.equal(afLog.events.slice(5).map(event => event[0]).join(' '), 'cancel schedule', `${type}: a different element type is a new target`)
    } finally { d.destroy() }
  }
  // never in edit mode (no prompt box at all) or refine mode; never while closed
  for (const mode of ['edit', 'refine']) for (const type of ALL_FORMS) {
    afLog.events.length = 0
    const d = mount(world, type, { mode })
    try { assert.equal(afLog.events.length, 0, `${type}: ${mode} mode: nothing scheduled`) } finally { d.destroy() }
  }
  afLog.events.length = 0
  const closed = mount(world, 'TEXT_BOX', { isOpen: false })
  try {
    assert.equal(afLog.events.length, 0, 'mounted closed: nothing scheduled')
    closed.rerender({ isOpen: true })
    assert.equal(afLog.events.length, 1, 'opened: scheduled')
    closed.rerender({ mode: 'refine' })
    assert.equal(afEvents().endsWith('cancel:' + afLog.n), true, 'switching to refine cancels')
  } finally { closed.destroy() }
  // unmount cancels
  afLog.events.length = 0
  const gone = mount(world, 'TABLE')
  const id = afLog.n
  gone.destroy()
  assert.equal(afEvents(), `schedule:${id} cancel:${id}`, 'unmounting the panel cancels a pending focus')
}
await check('A panel: one scheduled focus per new generate-mode activation (all nine forms), cancelled by close / new activation / unmount; never in edit or refine mode or while closed', () => autofocusPanelChecks())
function autofocusInputChecks(overrides = {}) {
  // the input on its own: it schedules only when it is given a key AND a scheduler, once per key, and cancels on a new key / unmount
  const { GenerationInput } = worldFor(ENV_AF, overrides).load(INPUT)
  const log = []
  const scheduleFocus = getBox => { const id = log.filter(entry => entry[0] === 'schedule').length + 1; log.push(['schedule', id, typeof getBox]); return () => log.push(['cancel', id]) }
  const render = props => { const tree = new Root(); const set = next => { tree.setElement(React.createElement(GenerationInput, { prompt: '', onPromptChange: noop, mandatoryConfig: null, showAdvanced: false, onToggleAdvanced: noop, onSubmit: noop, isGenerating: false, error: null, ...next })); tree.flush() }; set(props); return { tree, set } }
  const none = render({ scheduleFocus }); assert.deepEqual(log, [], 'no key: nothing scheduled'); none.tree.unmount()
  const noScheduler = render({ autoFocusKey: '1:CHART' }); assert.deepEqual(log, [], 'no scheduler: nothing scheduled'); noScheduler.tree.unmount()
  const some = render({ autoFocusKey: '1:CHART', scheduleFocus })
  assert.deepEqual(log, [['schedule', 1, 'function']], 'key + scheduler: one focus scheduled')
  some.set({ autoFocusKey: '1:CHART', scheduleFocus }); assert.equal(log.length, 1, 'same key: nothing more')
  some.set({ autoFocusKey: '2:CHART', scheduleFocus }); assert.deepEqual(log.slice(1), [['cancel', 1], ['schedule', 2, 'function']], 'new key: cancel then schedule')
  some.set({ autoFocusKey: undefined, scheduleFocus }); assert.deepEqual(log.slice(3), [['cancel', 2]], 'key gone: cancel')
  some.set({ autoFocusKey: '3:CHART', scheduleFocus }); some.tree.unmount(); assert.deepEqual(log.slice(4), [['schedule', 3, 'function'], ['cancel', 3]], 'unmount cancels')
}
await check('A input: schedules only with a key and a scheduler, once per key, cancels on a new key, no key and unmount', () => autofocusInputChecks())
await check('A panel: flag off (unset / "false" / "TRUE" / "1"): nothing is ever scheduled', async () => {
  for (const value of [undefined, 'false', 'TRUE', '1', '']) {
    const env = value === undefined ? SHELL : { ...SHELL, [FLAG_AF]: value }
    const world = afWorld(env)
    for (const type of ALL_FORMS) for (const mode of ['generate', 'refine', 'edit']) {
      afLog.events.length = 0
      const d = mount(world, type, { mode })
      try { d.rerender({ activationId: 5 }); d.rerender({ isOpen: false }); d.rerender({ isOpen: true }) } finally { d.destroy() }
      assert.equal(afLog.events.length, 0, `${type}/${mode}/${value}: nothing scheduled`)
    }
  }
})

// ======================================================================================================================================
// B. the Shape form + the input: a preset disables the box and says why
// ======================================================================================================================================
const ENV_SH_VARIANTS = [ENV_SH, { [FLAG_SH]: 'true' }]
const payloadOf = call => JSON.parse(JSON.stringify(call.formData))
async function shapeChecks(overrides = {}, env = ENV_SH) {
  const world = worldFor(env, overrides)
  const d = mount(world, 'SHAPE')
  try {
    // Custom (the default): exactly the box as before
    const customBox = d.promptBox()
    assert.equal(customBox.props.readOnly, undefined, 'Custom: not read-only')
    assert.equal(customBox.props['aria-disabled'], undefined, 'Custom: no aria-disabled')
    assert.equal(customBox.props.placeholder, 'e.g., three concentric circles', 'Custom: its own placeholder')
    assert.equal(d.hintLine(), undefined, 'Custom: no hint line')
    assert.equal(customBox.props['aria-describedby'], undefined)
    assert.doesNotMatch(customBox.props.className, /cursor-not-allowed/)
    await d.type('three concentric circles')
    assert.equal(d.promptBox().props.value, 'three concentric circles')
    // a preset: read-only, aria-disabled, the visible hint, the text kept, no placeholder inviting text
    await d.click(d.optionButton('Circle'))
    const presetBox = d.promptBox()
    assert.equal(presetBox.props.readOnly, true, 'preset: read-only')
    assert.equal(presetBox.props['aria-disabled'], true, 'preset: aria-disabled')
    assert.equal(presetBox.props.disabled, false, 'preset: not natively disabled (stays focusable so the reason can be reached)')
    assert.equal(presetBox.props.value, 'three concentric circles', 'preset: the typed text is kept')
    assert.equal(presetBox.props.placeholder, '', 'preset: no "e.g., a red star" inviting text')
    assert.match(presetBox.props.className, /cursor-not-allowed/)
    assert.match(presetBox.props.className, /opacity-50/)
    const hint = d.hintLine()
    assert.ok(hint, 'preset: the hint line is on the page')
    assert.equal(textOf(hint), HINT_TEXT)
    assert.equal(presetBox.props['aria-describedby'], hint.props.id, 'preset: the box is described by the hint')
    assert.equal(d.hosts().filter(node => node.props?.id === 'generation-prompt-disabled-hint').length, 1, 'one hint element')
    // every other preset behaves the same, and switching presets keeps the text
    for (const label of ['Star', 'Square', 'Hexagon']) {
      await d.click(d.optionButton(label))
      assert.equal(d.promptBox().props.readOnly, true, `${label}: read-only`)
      assert.equal(textOf(d.hintLine()), HINT_TEXT, `${label}: hint`)
      assert.equal(d.promptBox().props.value, 'three concentric circles', `${label}: text kept`)
    }
    // back to Custom: the text is there and the box takes text again
    await d.click(d.optionButton('Custom'))
    const backBox = d.promptBox()
    assert.equal(backBox.props.readOnly, undefined, 'Custom again: editable')
    assert.equal(backBox.props['aria-disabled'], undefined)
    assert.equal(backBox.props.value, 'three concentric circles', 'Custom again: the text is restored')
    assert.equal(backBox.props.placeholder, 'e.g., three concentric circles')
    assert.equal(d.hintLine(), undefined, 'Custom again: no hint')
    await d.type('three concentric circles, blue')
    assert.equal(d.promptBox().props.value, 'three concentric circles, blue', 'Custom again: typing works')
  } finally { d.destroy() }
}
async function shapePayloadChecks(world) {
  // Custom + text, preset + text typed earlier, preset + nothing: the request each of them sends (the whole form data)
  const runs = {}
  for (const [name, steps] of Object.entries({
    custom: async d => { await d.type('three concentric circles') },
    presetAfterText: async d => { await d.type('a red star'); await d.click(d.optionButton('Star')) },
    presetEmpty: async d => { await d.click(d.optionButton('Circle')) },
    presetThenCustom: async d => { await d.type('a red star'); await d.click(d.optionButton('Star')); await d.click(d.optionButton('Custom')) },
  })) {
    const d = mount(world, 'SHAPE')
    try { await steps(d); await d.key({ key: 'Enter', metaKey: true }); runs[name] = d.calls.map(payloadOf) } finally { d.destroy() }
  }
  return runs
}
async function shapeGuardChecks(world) {
  // #398 semantics for Shape: presets open, Custom needs text (the hint flag does not change that)
  const out = []
  const d = mount(world, 'SHAPE')
  try {
    out.push(['custom-empty', d.generateButton().props.disabled])
    await d.type('a spiral'); out.push(['custom-text', d.generateButton().props.disabled])
    await d.type(''); await d.click(d.optionButton('Circle')); out.push(['preset-empty', d.generateButton().props.disabled])
    await d.click(d.optionButton('Custom')); out.push(['custom-again-empty', d.generateButton().props.disabled])
  } finally { d.destroy() }
  return out
}
function shapeLibChecks(overrides = {}) {
  for (const [value, expected] of FLAG_VALUES) {
    const env = value === undefined ? {} : { [FLAG_SH]: value }
    const lib = libSH(env, overrides)
    assert.equal(lib.STUDIO_SHAPE_PRESET_PROMPT_HINT_ENABLED, expected, `flag ${JSON.stringify(value)}`)
    assert.equal(lib.shapePresetPromptHint('circle'), expected ? HINT_TEXT : undefined, `default enabled follows the flag ${JSON.stringify(value)}`)
  }
  const lib = libSH({ [FLAG_SH]: 'true' }, overrides)
  assert.equal(lib.SHAPE_PRESET_PROMPT_HINT, HINT_TEXT)
  assert.equal(lib.shapePresetPromptHint('custom'), undefined)
  for (const type of ['circle', 'star', 'polygon', 'line-diagonal', 'square']) assert.equal(lib.shapePresetPromptHint(type), HINT_TEXT)
  assert.equal(lib.shapePresetPromptHint('circle', false), undefined)
  assert.equal(lib.shapePresetPromptHint('custom', true), undefined)
  assert.deepEqual(lib.shapePresetPromptHintConfig('circle'), { promptDisabledHint: HINT_TEXT })
  assert.deepEqual(lib.shapePresetPromptHintConfig('custom'), {})
  assert.deepEqual(lib.shapePresetPromptHintConfig('circle', false), {})
  assert.equal(Object.keys(libSH({}, overrides).shapePresetPromptHintConfig('circle')).length, 0, 'flag off: not even an undefined key')
}
await check('B libs: flag literal (exact "true"), the sentence, Custom has no hint, flag off has none', () => shapeLibChecks())
await check('B shape: a preset => read-only + aria-disabled + the visible hint + text kept + no inviting placeholder; Custom unchanged; switching back restores (Studio and classic shell)', async () => {
  for (const env of ENV_SH_VARIANTS) await shapeChecks({}, env)
})
await check('B shape: the request payload is unchanged (hash-equal to the flag-off panel and to the base tree) and prompt is null for every preset', async () => {
  const off = await shapePayloadChecks(worldFor(SHELL))
  const on = await shapePayloadChecks(worldFor(ENV_SH))
  assert.equal(sha(on), sha(off), 'flag on == flag off, for the whole form data of four runs')
  if (baseAvailable) assert.equal(sha(await shapePayloadChecks(worldFor(SHELL, baseOverrides()))), sha(off), 'flag off == base tree')
  assert.equal(off.custom.length, 1); assert.equal(off.custom[0].shapeConfig.prompt, 'three concentric circles', 'Custom sends its text')
  assert.equal(on.presetAfterText[0].shapeConfig.prompt, null, 'a preset sends prompt: null')
  assert.equal(on.presetAfterText[0].shapeConfig.shape_type, 'star')
  assert.equal(on.presetEmpty[0].shapeConfig.prompt, null)
  assert.equal(on.presetThenCustom[0].shapeConfig.prompt, 'a red star', 'Custom again sends the restored text')
})
await check('B shape: the #398 empty-prompt guard keeps its rule for Shape: a preset opens Generate, Custom needs text (hint flag on == off)', async () => {
  const on = await shapeGuardChecks(worldFor(ENV_SH_GUARD))
  const off = await shapeGuardChecks(worldFor(ENV_GUARD))
  assert.deepEqual(on, off)
  assert.deepEqual(on, [['custom-empty', true], ['custom-text', false], ['preset-empty', false], ['custom-again-empty', true]])
})
await check('B input: a form that sets no hint leaves the box and the page exactly as before; the prompt-limit description is kept beside the hint', async () => {
  // a Chart form (promptMaxLength registered by some forms) with the hint flag on: no hint line, no read-only
  for (const type of ALL_FORMS.filter(type => type !== 'SHAPE')) {
    const d = mount(worldFor(ENV_SH), type)
    try {
      assert.equal(d.hintLine(), undefined, `${type}: no hint line`)
      assert.equal(d.promptBox().props.readOnly, undefined, `${type}: not read-only`)
      assert.equal(d.promptBox().props['aria-disabled'], undefined)
    } finally { d.destroy() }
  }
  const world = worldFor(ENV_SH)
  const { GenerationInput } = world.load(INPUT)
  const render = configs => {
    const tree = new Root()
    tree.setElement(React.createElement(GenerationInput, { prompt: 'x', onPromptChange: noop, mandatoryConfig: configs, showAdvanced: false, onToggleAdvanced: noop, onSubmit: noop, isGenerating: false, error: null }))
    tree.flush()
    const area = hostNodes(tree.tree).find(node => node.type === 'textarea')
    return { area, hosts: hostNodes(tree.tree) }
  }
  const both = render([{ fieldLabel: 'A', displayLabel: 'A', onChange: noop, promptMaxLength: 100, promptLimitLabel: 'Prompt' }, { fieldLabel: 'B', displayLabel: 'B', onChange: noop, promptDisabledHint: 'Nope.' }])
  assert.equal(both.area.props['aria-describedby'], 'generation-prompt-limit generation-prompt-disabled-hint', 'limit and hint both describe the box')
  assert.ok(both.hosts.find(node => node.props?.id === 'generation-prompt-limit'))
  assert.equal(textOf(both.hosts.find(node => node.props?.id === 'generation-prompt-disabled-hint')), 'Nope.')
  const limitOnly = render([{ fieldLabel: 'A', displayLabel: 'A', onChange: noop, promptMaxLength: 100 }])
  assert.equal(limitOnly.area.props['aria-describedby'], 'generation-prompt-limit')
  assert.equal(limitOnly.area.props.readOnly, undefined)
})

// ======================================================================================================================================
// C. the Save as Template dialog
// ======================================================================================================================================
const NAMES = ['', '   ', 'Q4 report']
const SESSIONS = [null, 'session-1']
const SOURCES = [null, 'presentation-1']
const LOADINGS = [false, true]
const DIALOG_STATES = []
for (const name of NAMES) for (const sessionId of SESSIONS) for (const sourcePresentationId of SOURCES) for (const loading of LOADINGS) DIALOG_STATES.push({ name, sessionId, sourcePresentationId, loading })
const expectedReason = s => (!s.name.trim() ? 'Add a name to save this template.' : !s.sessionId ? 'Open a deck to save it as a template.'
  : !s.sourcePresentationId ? 'Finish building the deck before saving it as a template.' : s.loading ? 'Loading…' : null)
const dialogApi = () => ({
  loading: templateState.loading,
  saveTemplate: async value => { templateState.events.push(['save', value]); return null },
  reoptimizeTemplate: async () => null, getTemplate: async () => null, watchTemplateStatus: () => () => {},
})
function dialogWorld(env, overrides = {}) {
  // the real use-templates helpers (isTemplateGenerationReady ...) with only the hook replaced
  const real = worldFor(env).load('hooks/use-templates.ts')
  return worldFor(env, overrides, { '@/hooks/use-templates': { ...real, useTemplates: () => dialogApi() } })
}
function renderDialog(world, state) {
  templateState.loading = state.loading
  templateState.events.length = 0
  const Dialog = (world.Dialog ??= world.load(DIALOG).TemplateSaveDialog)
  const tree = new Root()
  const props = { open: true, onOpenChange: noop, sessionId: state.sessionId, sourcePresentationId: state.sourcePresentationId }
  tree.setElement(React.createElement(Dialog, props)); tree.flush()
  const input = hostNodes(tree.tree).find(node => node.type === 'input')
  if (state.name) { input.props.onChange({ target: { value: state.name } }); tree.flush() }
  const hosts = hostNodes(tree.tree)
  return {
    tree, hosts,
    save: hosts.find(node => node.type === 'button' && /Save Template|Saving/.test(textOf(node))),
    reasonEl: id => hosts.find(node => node.props?.id === id),
    markup: renderToStaticMarkup(toElements(tree.tree)),
    destroy: () => tree.unmount(),
  }
}
function dialogReasonChecks(overrides = {}) {
  for (const [value, expected] of FLAG_VALUES) {
    const env = value === undefined ? {} : { [FLAG_TS]: value }
    assert.equal(libTS(env, overrides).STUDIO_TEMPLATE_SAVE_REASONS_ENABLED, expected, `flag ${JSON.stringify(value)}`)
    assert.equal(libTS(env, overrides).templateSaveReason({ name: '', sessionId: null, sourcePresentationId: null, loading: false }) !== null, expected, `default enabled follows the flag ${JSON.stringify(value)}`)
  }
  const on = libTS({ [FLAG_TS]: 'true' }, overrides)
  const world = dialogWorld({ ...SHELL, [FLAG_TS]: 'true' }, overrides)
  for (const state of DIALOG_STATES) {
    const label = JSON.stringify(state)
    const expectedDisabled = state.loading || !state.name.trim() || !state.sessionId || !state.sourcePresentationId
    assert.equal(on.templateSaveDisabled(state), expectedDisabled, `lib disabled rule ${label}`)
    assert.equal(on.templateSaveReason(state), expectedReason(state), `lib reason ${label}`)
    assert.equal(on.templateSaveReason(state, false), null, `lib reason, flag off ${label}`)
    const d = renderDialog(world, state)
    try {
      assert.ok(d.save, `Save button exists ${label}`)
      assert.equal(d.save.props.disabled, expectedDisabled, `the dialog's own disabled rule ${label}`)
      const reason = expectedReason(state)
      assert.equal(reason === null, !expectedDisabled, `a reason exists exactly when Save is disabled ${label}`)
      if (reason) {
        assert.equal(d.save.props['aria-describedby'], 'template-save-reason', `Save is described by the reason ${label}`)
        const el = d.reasonEl('template-save-reason')
        assert.ok(el, `the reason is on the page ${label}`)
        assert.equal(textOf(el), reason, `the words ${label}`)
        assert.equal(d.hosts.filter(node => node.props?.id === 'template-save-reason').length, 1)
        // the reason sits after the footer's buttons: under the Save button, not above the dialog's body
        const html = d.markup
        assert.ok(html.indexOf('id="template-save-reason"') > html.lastIndexOf('</button>'), `under the Save button ${label}`)
      } else {
        assert.equal(d.save.props['aria-describedby'], undefined, `enabled: no description ${label}`)
        assert.equal(d.reasonEl('template-save-reason'), undefined, `enabled: no reason element ${label}`)
      }
    } finally { d.destroy() }
  }
}
await check('C dialog: 24 states: the reason is the first unmet rule (name, session, source deck, loading), exists exactly when Save is disabled, and describes the button; the disabled rule is the dialog\'s own', () => dialogReasonChecks())
await check('C dialog: flag off (unset / "false" / "TRUE" / "1"): no reason element, no description, no new attribute, in every state', () => {
  for (const value of [undefined, 'false', 'TRUE', '1', '']) {
    const env = value === undefined ? SHELL : { ...SHELL, [FLAG_TS]: value }
    const world = dialogWorld(env)
    for (const state of DIALOG_STATES) {
      const d = renderDialog(world, state)
      try {
        assert.equal(d.reasonEl('template-save-reason'), undefined)
        assert.equal(d.save.props['aria-describedby'], undefined)
        assert.equal(Object.hasOwn(d.save.props, 'aria-describedby'), false, 'not even an undefined attribute')
        assert.doesNotMatch(d.markup, /template-save-reason/)
      } finally { d.destroy() }
    }
  }
})
await check('C dialog: the save path itself is unchanged by the flag (events of a save click and of a click on the disabled button hash-equal on / off / base)', async () => {
  const eventsOf = async world => {
    const log = []
    for (const state of DIALOG_STATES) {
      const d = renderDialog(world, state)
      try { await d.save.props.onClick(); await settle(); log.push([state, templateState.events.map(event => (event[0] === 'save' ? ['save', event[1]] : event))]) } finally { d.destroy() }
    }
    return sha(log)
  }
  const off = await eventsOf(dialogWorld(SHELL))
  assert.equal(await eventsOf(dialogWorld({ ...SHELL, [FLAG_TS]: 'true' })), off)
  if (baseAvailable) assert.equal(await eventsOf(dialogWorld(SHELL, baseOverrides())), off)
})

// ======================================================================================================================================
// 6. flag off == the base tree
// ======================================================================================================================================
async function panelTrace(world) {
  const log = []
  for (const type of ALL_FORMS) for (const mode of ['generate', 'refine']) {
    const d = mount(world, type, { mode })
    try {
      const snap = label => log.push([type, mode, label, sha(d.markup())])
      snap('mounted')
      await d.type('A quarterly revenue chart'); snap('typed')
      if (type === 'SHAPE') { await d.click(d.optionButton('Circle')); snap('preset'); await d.type('ignored'); snap('typed-in-preset'); await d.click(d.optionButton('Custom')); snap('custom-again') }
      await d.key({ key: 'Enter', metaKey: true }); snap('cmd-enter')
      d.rerender({ isGenerating: true }); snap('generating')
      d.rerender({ isGenerating: false, error: 'The service is busy.' }); snap('error')
      d.rerender({ error: null, activationId: 2 }); snap('new-activation')
      d.rerender({ isOpen: false }); snap('closed')
      d.rerender({ isOpen: true }); snap('reopened')
      log.push([type, mode, 'calls', d.calls.length, sha(d.calls.map(payloadOf))])
    } finally { d.destroy() }
  }
  return sha(log)
}
async function dialogTrace(world) {
  const log = []
  for (const state of DIALOG_STATES) {
    const d = renderDialog(world, state)
    try { log.push([state, sha(d.markup)]) } finally { d.destroy() }
  }
  return sha(log)
}
await check('flag off == base tree: full traces of the panel (markup per step, payloads) and of the dialog (24 states) hash-equal, flags unset / "false" / "TRUE" / "1", Studio and classic', async () => {
  if (!baseAvailable) { console.log('     (skipped: base commit not in this clone)'); return }
  const overrides = baseOverrides()
  const all = value => ({ [FLAG_AF]: value, [FLAG_SH]: value, [FLAG_TS]: value })
  const flagSets = [{}, all('false'), all('TRUE'), all('1')]
  for (const shell of [SHELL, {}]) {
    const basePanel = await panelTrace(worldFor(shell, overrides))
    const baseDialog = await dialogTrace(dialogWorld(shell, overrides))
    for (const flags of flagSets) {
      assert.equal(await panelTrace(worldFor({ ...shell, ...flags })), basePanel, `panel shell=${Object.keys(shell).length ? 'studio' : 'classic'} flags=${JSON.stringify(flags)}`)
      assert.equal(await dialogTrace(dialogWorld({ ...shell, ...flags })), baseDialog, `dialog shell=${Object.keys(shell).length ? 'studio' : 'classic'} flags=${JSON.stringify(flags)}`)
    }
    console.log(`     ${Object.keys(shell).length ? 'studio' : 'classic'}: base panel trace ${basePanel}, base dialog trace ${baseDialog}`)
  }
})
await check('flags on do change the traces (the identity above is not vacuous)', async () => {
  if (!baseAvailable) return
  const overrides = baseOverrides()
  assert.notEqual(await panelTrace(worldFor({ ...SHELL, [FLAG_SH]: 'true' })), await panelTrace(worldFor(SHELL, overrides)))
  assert.notEqual(await dialogTrace(dialogWorld({ ...SHELL, [FLAG_TS]: 'true' })), await dialogTrace(dialogWorld(SHELL, overrides)))
})

// ======================================================================================================================================
// 7. wiring and what must not change
// ======================================================================================================================================
function wiringChecks() {
  assert.match(read(LIB_AF), /process\.env\.NEXT_PUBLIC_STUDIO_PROMPT_AUTOFOCUS === 'true'/)
  assert.match(read(LIB_SH), /process\.env\.NEXT_PUBLIC_STUDIO_SHAPE_PRESET_PROMPT_HINT === 'true'/)
  assert.match(read(LIB_TS), /process\.env\.NEXT_PUBLIC_STUDIO_TEMPLATE_SAVE_REASONS === 'true'/)
  const readers = { [FLAG_AF]: [], [FLAG_SH]: [], [FLAG_TS]: [] }
  const walk = dir => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (['node_modules', '.next', '.git', 'docs', 'screenshots'].includes(entry.name)) continue
      const rel = dir === '.' ? entry.name : `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(rel)
      else if (/\.(tsx?|mjs)$/.test(entry.name) && !rel.startsWith('scripts/')) for (const flag of Object.keys(readers)) if (read(rel).includes(`process.env.${flag}`)) readers[flag].push(rel)
    }
  }
  walk('.')
  assert.deepEqual(readers[FLAG_AF], [LIB_AF], 'flag AF is read in exactly one file')
  assert.deepEqual(readers[FLAG_SH], [LIB_SH], 'flag SH is read in exactly one file')
  assert.deepEqual(readers[FLAG_TS], [LIB_TS], 'flag TS is read in exactly one file')
  for (const flag of Object.keys(readers)) assert.match(read('.env.example'), new RegExp(`^${flag}="false"$`, 'm'), `${flag} documented default off`)
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-pass2b-batch2'], 'node scripts/test-studio-pass2b-batch2.mjs')
  // the input and the form read no flag themselves: the panel / the form hand the decision in
  const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(strip(read(INPUT)), /process\.env\.NEXT_PUBLIC_STUDIO_(PROMPT_AUTOFOCUS|SHAPE_PRESET_PROMPT_HINT)/)
  // generation-input.tsx adds no import (test-shape-typed-failure and test-textbox-planned-recovery load it with a closed list of imports)
  const imports = file => read(file).split('\n').filter(line => /^import /.test(line) && !/^import type /.test(line))
  if (baseAvailable) assert.deepEqual(imports(INPUT), baseFile(INPUT).split('\n').filter(line => /^import /.test(line) && !/^import type /.test(line)), 'generation-input.tsx: no new runtime import')
  assert.doesNotMatch(strip(read(DIALOG)), /process\.env\.NEXT_PUBLIC_STUDIO_TEMPLATE_SAVE_REASONS/)
  // the libs are pure of network and storage
  for (const file of [LIB_SH, LIB_TS]) assert.doesNotMatch(strip(read(file)), /\b(fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|setTimeout|setInterval|document|window)\b/, file)
  assert.doesNotMatch(strip(read(LIB_AF)), /\b(fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|postMessage|sendCommand)\b/, LIB_AF)
  // the Shape form's change is additive (nothing removed), and the prompt it sends is untouched
  if (baseAvailable) {
    const removed = file => git(['diff', BASE_SHA, '--', file]).split('\n').filter(line => /^-(?!--)/.test(line)).map(line => line.slice(1).trim())
    assert.deepEqual(removed(SHAPE_FORM), [], 'shape-form.tsx: additions only')
    assert.deepEqual(removed(TYPES), [], 'types.ts: additions only')
    assert.deepEqual(removed(PANEL), [], 'index.tsx: additions only')
    assert.deepEqual(removed(DIALOG), [], 'template-save-dialog.tsx: additions only (its disabled expression and handlers are untouched)')
    // the files this change must not touch (other builders' and the request path): byte-equal to the base commit
    const frozen = ['components/builder/chat-input.tsx', 'components/studio-add-slide-v2.tsx', 'app/builder/page.tsx', 'hooks/use-textlabs-generation.ts', 'components/builder/studio-theme-menu.tsx',
      'lib/studio-theme-restore.ts', 'lib/studio-empty-prompt-guard.ts', 'components/generation-panel/header.tsx', 'lib/textlabs-client.ts', VIEWER]
    for (const file of git(['ls-tree', '-r', '--name-only', BASE_SHA, 'lib', 'components']).split('\n').filter(file => /composer-library|composer-popups|studio-theme-|question|outline|recovery/.test(file))) frozen.push(file)
    for (const file of frozen) assert.equal(read(file), baseFile(file), `${file} is untouched`)
    // no Layout viewer command anywhere in the change
    const diff = git(['diff', BASE_SHA, '--', 'components', 'lib', 'hooks', 'app']).split('\n').filter(line => /^[+-](?![+-])/.test(line))
    for (const line of diff) assert.doesNotMatch(line, /postMessage|sendCommand|sendLayout|contentWindow|iframeRef|createViewerRequestId|action:/, `the change touches a Layout command: ${line}`)
    // the dialog's disabled rule is still the same text
    assert.ok(read(DIALOG).includes('disabled={loading || !name.trim() || !sessionId || !sourcePresentationId}'), 'the Save button keeps its own disabled expression')
  }
}
await check('wiring: flags read in one file each, documented default off, script registered, additions only, frozen files untouched, no Layout command touched', () => wiringChecks())

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
await check('mutants: every one of them breaks a check above', async () => {
  const afLibMut = source => { autofocusLibChecks({ [LIB_AF]: source }); mayTakeFocusChecks({ [LIB_AF]: source }); scheduleChecks({ [LIB_AF]: source }) }
  await mutant('A lib: the flag is ignored', LIB_AF, "=== 'true'", "!== 'x'", afLibMut)
  await mutant('A lib: edit/refine mode focuses too', LIB_AF, "input.mode !== 'generate' || ", '', afLibMut)
  await mutant('A lib: a closed panel focuses', LIB_AF, '!input.isOpen || ', '', afLibMut)
  await mutant('A lib: no prompt box still focuses', LIB_AF, ' || !input.showsPromptBox', '', afLibMut)
  await mutant('A lib: the key ignores the activation', LIB_AF, '`${input.activationId}:${input.elementType}`', "'x'", afLibMut)
  await mutant('A lib: the key ignores the element type', LIB_AF, '`${input.activationId}:${input.elementType}`', '`${input.activationId}`', afLibMut)
  await mutant('A lib: a read-only box takes focus', LIB_AF, 'box.readOnly === true || ', '', afLibMut)
  await mutant('A lib: an aria-disabled box takes focus', LIB_AF, " || box.getAttribute?.('aria-disabled') === 'true'", '', afLibMut)
  await mutant('A lib: a disabled box takes focus', LIB_AF, 'box.disabled === true || ', '', afLibMut)
  await mutant('A lib: a hidden drawer takes focus', LIB_AF, 'if (box.closest?.(HIDDEN_DRAWER_SELECTOR)) return false\n', '', afLibMut)
  await mutant('A lib: focus inside the panel is taken over', LIB_AF, 'if (panel && (panel as FocusableLike).contains?.(active as never)) return false\n', '', afLibMut)
  await mutant('A lib: another text field is taken over', LIB_AF, 'if (isEditable(active)) return false\n', '', afLibMut)
  await mutant('A lib: an open menu or dialog is taken over', LIB_AF, 'if (active.closest?.(OVERLAY_SELECTOR)) return false\n', '', afLibMut)
  await mutant('A lib: the open menu is not waited for', LIB_AF, 'box.ownerDocument?.querySelector?.(OPEN_MENU_SELECTOR)', 'false', afLibMut)
  await mutant('A lib: no settle pause after the menu left (Radix restores focus after the box)', LIB_AF, 'handle = view.setTimeout(settle, AUTOFOCUS_SETTLE_MS)', 'settle()', afLibMut)
  await mutant('A lib: the settle pause is too short', LIB_AF, 'AUTOFOCUS_SETTLE_MS = 60', 'AUTOFOCUS_SETTLE_MS = 0', afLibMut)
  await mutant('A lib: the wait never ends', LIB_AF, 'waited < AUTOFOCUS_MAX_WAIT_MS && ', '', afLibMut)
  await mutant('A lib: cancel leaves the timer', LIB_AF, 'if (handle !== undefined) view.clearTimeout(handle as never)', '', afLibMut)
  await mutant('A lib: the box is read when scheduled, not when focusing', LIB_AF, '    const box = getBox()\n    if (promptBoxMayTakeFocus(box)) box!.focus!({ preventScroll: true })', '    if (promptBoxMayTakeFocus(first)) first.focus!({ preventScroll: true })', afLibMut)
  await mutant('A lib: the poll interval is wrong', LIB_AF, 'AUTOFOCUS_POLL_MS = 40', 'AUTOFOCUS_POLL_MS = 5', afLibMut)

  const afPanelMut = file => async source => { await autofocusPanelChecks({ [file]: source }); if (file === INPUT) autofocusInputChecks({ [file]: source }) }
  await mutant('A input: the focus effect is gone', INPUT, 'return scheduleFocus(() => textareaRef.current)', 'return undefined', afPanelMut(INPUT))
  await mutant('A input: the effect runs once only (a new activation is not refocused)', INPUT, '  }, [autoFocusKey])', '  }, [])', afPanelMut(INPUT))
  await mutant('A input: the effect is not cancelled', INPUT, 'return scheduleFocus(() => textareaRef.current)', 'scheduleFocus(() => textareaRef.current)', afPanelMut(INPUT))
  await mutant('A input: the no-key guard is gone (schedules with no key)', INPUT, 'if (autoFocusKey === undefined || !scheduleFocus) return\n', 'if (!scheduleFocus) return\n', source => autofocusInputChecks({ [INPUT]: source }))
  await mutant('A input: the no-scheduler guard is gone', INPUT, 'if (autoFocusKey === undefined || !scheduleFocus) return\n', 'if (autoFocusKey === undefined) return\n', source => autofocusInputChecks({ [INPUT]: source }))
  await mutant('A panel: the key is never handed to the input', PANEL, '            autoFocusKey={promptFocusKey}\n', '', afPanelMut(PANEL))
  await mutant('A panel: the scheduler is never handed to the input', PANEL, 'scheduleFocus={promptFocusKey === undefined ? undefined : schedulePromptFocus}', '', afPanelMut(PANEL))
  await mutant('A panel: edit and refine get a key', PANEL, 'promptAutofocusKey({ isOpen, mode, showsPromptBox: showGenerationInput, activationId, elementType })', "promptAutofocusKey({ isOpen, mode: 'generate', showsPromptBox: true, activationId, elementType })", afPanelMut(PANEL))
  await mutant('A panel: the key ignores whether the panel is open', PANEL, 'promptAutofocusKey({ isOpen, mode, showsPromptBox: showGenerationInput, activationId, elementType })', 'promptAutofocusKey({ isOpen: true, mode, showsPromptBox: showGenerationInput, activationId, elementType })', afPanelMut(PANEL))

  const shapeMut = (file, env = ENV_SH) => source => shapeChecks({ [file]: source }, env)
  await mutant('B form: a preset gets no hint', SHAPE_FORM, '...shapePresetPromptHintConfig(shapeType),', '', shapeMut(SHAPE_FORM))
  await mutant('B form: the hint is registered with the wrong text', SHAPE_FORM, '...shapePresetPromptHintConfig(shapeType),', "...shapePresetPromptHintConfig(shapeType), ...{ promptDisabledHint: 'x' },", shapeMut(SHAPE_FORM))
  const shapeLibMut = async source => { shapeLibChecks({ [LIB_SH]: source }); await shapeChecks({ [LIB_SH]: source }) }
  await mutant('B lib: the sentence changed', LIB_SH, "Presets don't use a prompt. Choose Custom to describe a shape.", 'Presets ignore the prompt.', shapeLibMut)
  await mutant('B lib: Custom gets the hint', LIB_SH, "return shapeType === 'custom' ? undefined : SHAPE_PRESET_PROMPT_HINT", 'return SHAPE_PRESET_PROMPT_HINT', shapeLibMut)
  await mutant('B lib: the flag is ignored', LIB_SH, "=== 'true'", "!== 'x'", shapeLibMut)
  await mutant('B lib: the explicit enabled argument is ignored', LIB_SH, 'if (!enabled) return undefined', '', shapeLibMut)
  await mutant('B lib: the config carries an undefined key for Custom', LIB_SH, "return promptDisabledHint === undefined ? {} : { promptDisabledHint }", 'return { promptDisabledHint }', shapeLibMut)
  await mutant('B input: the box stays editable', INPUT, "{ readOnly: true, 'aria-disabled': true }", "{ 'aria-disabled': true }", shapeMut(INPUT))
  await mutant('B input: no aria-disabled', INPUT, "{ readOnly: true, 'aria-disabled': true }", '{ readOnly: true }', shapeMut(INPUT))
  await mutant('B input: natively disabled instead (out of the tab order)', INPUT, "{ readOnly: true, 'aria-disabled': true }", "{ readOnly: true, 'aria-disabled': true, disabled: true }", shapeMut(INPUT))
  await mutant('B input: the hint line is gone', INPUT, '{promptDisabledHint !== null && (\n        <p id={PROMPT_DISABLED_HINT_ID}', '{false && (\n        <p id={PROMPT_DISABLED_HINT_ID}', shapeMut(INPUT))
  await mutant('B input: the box is not described by the hint', INPUT, 'promptMaxLength ? `generation-prompt-limit ${PROMPT_DISABLED_HINT_ID}` : PROMPT_DISABLED_HINT_ID', "promptMaxLength ? 'generation-prompt-limit' : undefined", shapeMut(INPUT))
  await mutant('B input: the inviting placeholder stays', INPUT, "const placeholder = promptDisabledHint !== null ? '' : placeholderOverride", 'const placeholder = placeholderOverride', shapeMut(INPUT))
  await mutant('B input: no greyed look', INPUT, " cursor-not-allowed opacity-50", '', shapeMut(INPUT))
  await mutant('B input: the hint shows for every form', INPUT, 'const promptDisabledHint = mandatoryConfigs.find(config => config.promptDisabledHint)?.promptDisabledHint ?? null', "const promptDisabledHint: string | null = 'x'", shapeMut(INPUT))
  await mutant('B input: the typed text is dropped for a preset', INPUT, 'value={prompt}', "value={promptDisabledHint !== null ? '' : prompt}", shapeMut(INPUT))

  const tsLibMut = source => dialogReasonChecks({ [LIB_TS]: source })
  await mutant('C lib: the flag is ignored', LIB_TS, "=== 'true'", "!== 'x'", tsLibMut)
  await mutant('C lib: no name reason', LIB_TS, "  if (!state.name.trim()) return TEMPLATE_SAVE_REASON_NAME\n", '', tsLibMut)
  await mutant('C lib: no session reason', LIB_TS, "  if (!state.sessionId) return TEMPLATE_SAVE_REASON_SESSION\n", '', tsLibMut)
  await mutant('C lib: no source reason', LIB_TS, "  if (!state.sourcePresentationId) return TEMPLATE_SAVE_REASON_SOURCE\n", '', tsLibMut)
  await mutant('C lib: loading is not a reason', LIB_TS, "  if (state.loading) return TEMPLATE_SAVE_REASON_LOADING\n", '', tsLibMut)
  await mutant('C lib: session before name', LIB_TS, "  if (!state.name.trim()) return TEMPLATE_SAVE_REASON_NAME\n  if (!state.sessionId) return TEMPLATE_SAVE_REASON_SESSION\n", "  if (!state.sessionId) return TEMPLATE_SAVE_REASON_SESSION\n  if (!state.name.trim()) return TEMPLATE_SAVE_REASON_NAME\n", tsLibMut)
  await mutant('C lib: loading first', LIB_TS, "  if (!state.name.trim()) return TEMPLATE_SAVE_REASON_NAME\n", "  if (state.loading) return TEMPLATE_SAVE_REASON_LOADING\n  if (!state.name.trim()) return TEMPLATE_SAVE_REASON_NAME\n", tsLibMut)
  await mutant('C lib: the name words changed', LIB_TS, "'Add a name to save this template.'", "'Name required'", tsLibMut)
  await mutant('C lib: the session words changed', LIB_TS, "'Open a deck to save it as a template.'", "'No deck'", tsLibMut)
  await mutant('C lib: the source words changed', LIB_TS, "'Finish building the deck before saving it as a template.'", "'No completed deck'", tsLibMut)
  await mutant('C lib: the loading words changed', LIB_TS, "'Loading…'", "'Saving…'", tsLibMut)
  await mutant('C lib: a whitespace-only name counts as a name', LIB_TS, "if (!state.name.trim()) return TEMPLATE_SAVE_REASON_NAME", "if (!state.name) return TEMPLATE_SAVE_REASON_NAME", tsLibMut)
  await mutant('C lib: the disabled rule drifts from the dialog\'s', LIB_TS, 'return state.loading || !state.name.trim() || !state.sessionId || !state.sourcePresentationId', 'return state.loading || !state.name.trim() || !state.sessionId', tsLibMut)
  const dialogMut = source => dialogReasonChecks({ [DIALOG]: source })
  await mutant('C dialog: Save is not described by the reason', DIALOG, "{...(saveReason ? { 'aria-describedby': SAVE_REASON_ID } : {})}", '', dialogMut)
  await mutant('C dialog: the reason line is gone', DIALOG, '{saveReason && <p id={SAVE_REASON_ID}', '{false && <p id={SAVE_REASON_ID}', dialogMut)
  await mutant('C dialog: the description points at nothing', DIALOG, "const SAVE_REASON_ID = 'template-save-reason'", "const SAVE_REASON_ID = 'template-save-reason-x'", dialogMut)
  await mutant('C dialog: the reason ignores loading', DIALOG, 'templateSaveReason({ name, sessionId, sourcePresentationId, loading })', 'templateSaveReason({ name, sessionId, sourcePresentationId, loading: false })', dialogMut)
  await mutant('C dialog: the reason ignores the source deck', DIALOG, 'templateSaveReason({ name, sessionId, sourcePresentationId, loading })', 'templateSaveReason({ name, sessionId, sourcePresentationId: \'x\', loading })', dialogMut)
  const reasonLine = '        {saveReason && <p id={SAVE_REASON_ID} className="mt-2 text-right text-xs text-slate-500 dark:text-slate-400">{saveReason}</p>}\n'
  await mutant('C dialog: the reason line sits above the buttons', DIALOG, '        <DialogFooter className="studio-template-flow-footer">\n', reasonLine + '        <DialogFooter className="studio-template-flow-footer">\n', source => dialogMut(source.replace(reasonLine + '      </DialogContent>', '      </DialogContent>').replace('        </DialogFooter>\n' + reasonLine, '        </DialogFooter>\n')))
  await mutant('C dialog: the attribute is always present (even flag off)', DIALOG, "{...(saveReason ? { 'aria-describedby': SAVE_REASON_ID } : {})}", "aria-describedby={saveReason ? SAVE_REASON_ID : undefined}", source => {
    const world = dialogWorld(SHELL, { [DIALOG]: source }); const d = renderDialog(world, DIALOG_STATES[0])
    try { assert.equal(Object.hasOwn(d.save.props, 'aria-describedby'), false) } finally { d.destroy() }
  })
  console.log(`     ${mutantOk.length} mutants caught`)
  assert.deepEqual(mutantMissed, [], 'every mutant must apply and be caught')
})

if (failures.length) {
  console.error(`\nFAIL studio pass2b batch2: ${failures.length} of ${testCount} checks failed:\n  - ${failures.join('\n  - ')}`)
  process.exit(1)
}
console.log(`\nPASS studio pass2b batch2: ${testCount} checks, ${mutantOk.length} mutants caught${baseAvailable ? '' : ' (base commit not in this clone: the flag-off identity checks were skipped)'}`)
process.exit(0)
