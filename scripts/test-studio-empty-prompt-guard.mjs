// J3-EMPTY-PROMPT-GUARD (ELEMENT-2, J3 pass 2 R5-9): NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD (exact "true"), default off.
// In Add Element the "Generate (⌘↵)" button stayed enabled while the "Generation prompt" was empty, so a paid generation could be fired with
// nothing to generate from (the forms then substitute a stand-in prompt: "shopping cart icon", "custom shape", "Generate an infographic" ...).
// Cause and fix: components/generation-panel/{index,shared/generation-input}.tsx + lib/studio-empty-prompt-guard.ts.
//
// Proves, offline (no socket, fetch, timer or network; the #371 harness pattern: the REAL panel, the REAL nine forms and the REAL libs run in
// mini-react, buttons clicked and the window keydown listener fired; only the Radix wrappers and lucide icons are stubbed):
//   1. the lib (flag read as an exact literal, what "empty" means, the decision table, the form opt-out);
//   2. the defect on the base tree / flag off: with an EMPTY prompt Generate is enabled and fires onGenerate for every one of the nine
//      forms, by the button and by Cmd/Ctrl+Enter;
//   3. flag on, every form whose prompt is required (Text Box, Metrics, Table, Chart, Image, Icon/Label, custom Shape, Infographic without a
//      reference, Diagram), Studio shell and classic: empty / whitespace / no-break space / zero-width => Generate disabled with
//      aria-disabled and the hint, the button, a forced onClick, Cmd+Enter, Ctrl+Enter and the error box's retry all do nothing; real text
//      enables it; the prompt is reactive both ways. A blocked Generate never reaches onGenerate, which is the page's
//      handleApprovedTextLabsGenerate -> the Text Labs hook, the only place a Layout placeholder is inserted (NEXT_PUBLIC_STUDIO_ELEMENT_
//      PLACEHOLDER_FIX defers that insertion to Generate): no placeholder command, on either path;
//   4. flag on, the exceptions stay open: Chart with Custom JSON (the form's own data check still runs), a preset Shape, an Infographic with a
//      reference image or manual rows, Refine / Edit current (every form), "Check generation result" (resume_same_attempt), and the slide
//      panel's own use of the shared input;
//   5. flag off is the base tree: full traces (markup hash per step, button state, every onGenerate call, render passes) of both trees hash-equal
//      under flag unset / "false" / "TRUE" / "1" (git base = BASE_SHA; skipped with a notice if that commit is not in the clone);
//   6. wiring: the page hands the panel the one onGenerate, no other file of the panel reads the flag, .env.example, package.json;
//   7. mutants of the lib, the panel, the input and three forms must each be caught.
//
//   node scripts/test-studio-empty-prompt-guard.mjs
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { Root, hostNodes, textOf, toElements } from './studio-chat-harness/mini-react.mjs'
import { lucideStub } from './studio-chat-harness/esm-packages.mjs'

for (const name of Object.keys(process.env)) if (/KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD/i.test(name)) delete process.env[name]
const denied = () => { throw new Error('Offline harness forbids network') }
net.connect = net.createConnection = net.Socket.prototype.connect = denied
http.request = http.get = https.request = https.get = denied
globalThis.fetch = denied

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** The dev branch this fix was cut from (studio-v4-dev-preparation-code at #397): flag off must behave exactly as this. */
const BASE_SHA = '1372f01032894b0edd45da0a5224b786929250f9'
const FLAG = 'NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD'
const LIB = 'lib/studio-empty-prompt-guard.ts'
const PANEL = 'components/generation-panel/index.tsx'
const INPUT = 'components/generation-panel/shared/generation-input.tsx'
const CHART = 'components/generation-panel/forms/chart-form.tsx'
const SHAPE = 'components/generation-panel/forms/shape-form.tsx'
const INFOGRAPHIC = 'components/generation-panel/forms/infographic-form.tsx'
const HINT = 'Describe what you want to generate'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16)

const gitEnv = { ...process.env }
delete gitEnv.GIT_DIR
delete gitEnv.GIT_WORK_TREE
const git = args => execFileSync('git', args, { cwd: root, env: gitEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_SHA}^{commit}`]) } catch { baseAvailable = false }
/** The base tree = this tree with every file of the generation panel read from BASE_SHA (the guard lib does not exist there and is not imported). */
function baseOverrides() {
  const overrides = {}
  for (const file of git(['ls-tree', '-r', '--name-only', BASE_SHA, 'components/generation-panel']).split('\n').filter(Boolean)) {
    if (/\.(tsx?)$/.test(file)) overrides[file] = git(['show', `${BASE_SHA}:${file}`])
  }
  return overrides
}

// ---- loader: the repo's own modules, transpiled on require ---------------------------------------------------------------------------
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
const stubs = {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'lucide-react': lucideStub(React),
  // Radix wrappers need their provider trees; the panel's own behaviour does not depend on them. Popover content is always shown so the
  // chip's real option buttons can be clicked.
  '@/components/ui/popover': { __esModule: true, Popover: passThrough('popover'), PopoverTrigger: passThrough('popover-trigger'), PopoverContent: passThrough('popover-content') },
  '@/components/ui/tooltip': { __esModule: true, Tooltip: passThrough('tooltip'), TooltipTrigger: passThrough('tooltip-trigger'), TooltipContent: passThrough('tooltip-content'), TooltipProvider: passThrough('tooltip-provider') },
  '@/components/ui/switch': { __esModule: true, Switch: props => React.createElement('button', { role: 'switch', ...props }) },
  '@/components/ui/checkbox': { __esModule: true, Checkbox: props => React.createElement('input', { type: 'checkbox', ...props }) },
}
const hostRequire = (await import('node:module')).createRequire(path.join(root, 'package.json'))
const worldCache = new Map()
function worldFor(env, overrides = {}) {
  const key = JSON.stringify([env, Object.entries(overrides).map(([file, source]) => [file, sha(source)]).sort()])
  if (worldCache.has(key)) return worldCache.get(key)
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

// ---- one fake window: the panel's Cmd/Ctrl+Enter and Escape listeners register here ------------------------------------------------------
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

// ---- the panel, mounted ------------------------------------------------------------------------------------------------------------------
const CAPABILITIES = { web: { available: true }, uploaded_documents: { available: false, reason: 'none' }, knowledge_graph: { available: false, reason: 'none' } }
const ALL_FORMS = ['TEXT_BOX', 'METRICS', 'TABLE', 'CHART', 'IMAGE', 'ICON_LABEL', 'SHAPE', 'INFOGRAPHIC', 'DIAGRAM']
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }
const noop = () => {}

function mount(world, type, overrides = {}) {
  const calls = []
  // Stand-in for the page's handleApprovedTextLabsGenerate -> the Text Labs hook: with NEXT_PUBLIC_STUDIO_ELEMENT_PLACEHOLDER_FIX on, the hook's
  // first act on Generate is the Layout placeholder insertion (hooks/use-textlabs-generation.ts handleGenerateDeferred). Every call is that insertion.
  const layoutCommands = []
  const onGenerate = async (formData, intent) => {
    layoutCommands.push(`insertPlaceholder:${formData.componentType}`)
    calls.push({ type: formData.componentType, prompt: formData.prompt, intent, referenceImage: formData.referenceImage?.name ?? null, shape: formData.shapeConfig?.shape_type ?? null })
  }
  const props = {
    isOpen: true, activationId: 1, elementType: type, onClose: noop, onGenerate, onElementTypeChange: noop, isGenerating: false, error: null,
    slideIndex: 0, mode: 'generate', researchMode: 'off', researchWeb: false, researchUploadedDocs: false, researchKnowledgeGraph: false,
    researchCapabilities: CAPABILITIES, onResearchModeChange: noop, onResearchWebChange: noop, onResearchUploadedDocsChange: noop,
    onResearchKnowledgeGraphChange: noop, ...overrides,
  }
  const tree = new Root()
  const Panel = panelOf(world)
  const driver = {
    tree, calls, layoutCommands, props,
    hosts: () => hostNodes(tree.tree),
    rerender(next) { Object.assign(props, next); tree.setElement(React.createElement(Panel, { ...props })); tree.flush() },
    promptBox: () => driver.hosts().find(node => node.type === 'textarea'),
    generateButton: () => driver.hosts().find(node => node.type === 'button' && typeof node.props.title === 'string'
      && (node.props.title.startsWith('Generate') || node.props.title === HINT || node.props.title.startsWith('Check generation') || node.props.title.startsWith('Shorten'))),
    button: label => driver.hosts().find(node => node.type === 'button' && textOf(node).trim().startsWith(label) && !node.props.disabled),
    state() {
      const button = driver.generateButton()
      return { found: Boolean(button), disabled: Boolean(button?.props.disabled), ariaDisabled: button?.props['aria-disabled'], title: button?.props.title, label: button?.props['aria-label'] }
    },
    async type(text) { driver.promptBox().props.onChange({ target: { value: text } }); tree.flush(); await settle() },
    async click(node) {
      if (!node || node.props.disabled || !node.props.onClick) return false
      node.props.onClick({ preventDefault: noop, stopPropagation: noop, currentTarget: node, target: node })
      tree.flush(); await settle(); return true
    },
    async clickGenerate() { return driver.click(driver.generateButton()) },
    async forceGenerateClick() { driver.generateButton().props.onClick({ preventDefault: noop, stopPropagation: noop }); tree.flush(); await settle() },
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

// ---- 1. the lib ------------------------------------------------------------------------------------------------------------------------
const ON_STUDIO = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'true' }
const ON_CLASSIC = { [FLAG]: 'true' }
const OFF = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const libFor = (env, overrides = {}) => worldFor(env, overrides).load(LIB)

function libChecks(overrides = {}) {
  for (const [value, expected] of [['true', true], ['false', false], ['TRUE', false], ['1', false], ['', false], [undefined, false]]) {
    const env = value === undefined ? {} : { [FLAG]: value }
    assert.equal(libFor(env, overrides).STUDIO_EMPTY_PROMPT_GUARD_ENABLED, expected, `flag ${JSON.stringify(value)}`)
    assert.equal(libFor(env, overrides).emptyPromptBlocksGenerate({ mode: 'generate', prompt: '' }), expected, `default enabled follows the flag ${JSON.stringify(value)}`)
  }
  const lib = libFor(ON_STUDIO, overrides)
  assert.equal(lib.EMPTY_PROMPT_HINT, HINT)
  for (const empty of ['', ' ', '   ', '\n', '\t \r\n', '\u00a0', '\u2003', '\u200b', '\u200c\u200d', '\u2060', '\ufeff', ' \u200b \u00a0 ', undefined, null, 5]) {
    assert.equal(lib.isEmptyElementPrompt(empty), true, `empty: ${JSON.stringify(empty)}`)
  }
  for (const text of ['a', ' a ', '0', '.', 'é', '\u200ba\u200b', '😀', '  two words  ']) assert.equal(lib.isEmptyElementPrompt(text), false, `text: ${JSON.stringify(text)}`)
  const blocks = input => lib.emptyPromptBlocksGenerate({ enabled: true, ...input })
  assert.equal(blocks({ mode: 'generate', prompt: '' }), true)
  assert.equal(blocks({ mode: 'generate', prompt: '  ' }), true)
  assert.equal(blocks({ mode: 'generate', prompt: 'x' }), false)
  assert.equal(blocks({ mode: 'refine', prompt: '' }), false, 'Refine keeps today\'s rules')
  assert.equal(blocks({ mode: 'edit', prompt: '' }), false)
  assert.equal(blocks({ mode: 'generate', prompt: '', retryStrategy: 'resume_same_attempt' }), false, 'checking an attempt already paid for')
  assert.equal(blocks({ mode: 'generate', prompt: '', retryStrategy: 'start_fresh_attempt' }), true)
  assert.equal(blocks({ mode: 'generate', prompt: '', retryStrategy: 'do_not_retry' }), true)
  assert.equal(blocks({ mode: 'generate', prompt: '', retryStrategy: null }), true)
  assert.equal(blocks({ mode: 'generate', prompt: '', promptOptional: true }), false, 'the form opts out')
  assert.equal(blocks({ mode: 'generate', prompt: '', promptOptional: false }), true)
  assert.equal(lib.emptyPromptBlocksGenerate({ enabled: false, mode: 'generate', prompt: '' }), false, 'flag off')
  assert.equal(lib.mandatoryConfigPromptOptional(null), false)
  assert.equal(lib.mandatoryConfigPromptOptional(undefined), false)
  assert.equal(lib.mandatoryConfigPromptOptional({ promptOptional: true }), true)
  assert.equal(lib.mandatoryConfigPromptOptional({}), false)
  assert.equal(lib.mandatoryConfigPromptOptional([{ x: 1 }, { promptOptional: true }]), true)
  assert.equal(lib.mandatoryConfigPromptOptional([{ promptOptional: false }, {}]), false)
  assert.equal(lib.mandatoryConfigPromptOptional([]), false)
}

// ---- 2/3. the defect (flag off) and the guard (flag on), form by form ---------------------------------------------------------------------
const EMPTIES = ['', ' ', '   ', '\n', '\t \n', '\u00a0', '\u200b', ' \u200b ']
const labelsOf = (type, prompt) => `${type} ${JSON.stringify(prompt)}`

async function assertDefectFlagOff(world, forms = ALL_FORMS) {
  for (const type of forms) {
    const d = mount(world, type)
    try {
      const state = d.state()
      assert.equal(state.found, true, `${type}: Generate present`)
      assert.equal(state.disabled, false, `${type}: flag off, empty prompt: Generate enabled (the defect)`)
      assert.equal(state.ariaDisabled, undefined, `${type}: no aria-disabled`)
      assert.equal(state.title, 'Generate (⌘↵)')
      assert.equal(await d.clickGenerate(), true)
      assert.equal(d.calls.length, 1, `${type}: flag off, empty prompt: the click fires a generation`)
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 2, `${type}: and so does Cmd+Enter`)
      assert.equal(d.layoutCommands.length, 2)
    } finally { d.destroy() }
  }
}

async function assertGuardOn(world, forms = ALL_FORMS, { studio = true } = {}) {
  for (const type of forms) {
    const d = mount(world, type)
    try {
      for (const empty of EMPTIES) {
        await d.type(empty)
        const state = d.state()
        assert.equal(state.found, true, labelsOf(type, empty))
        assert.equal(state.disabled, true, `${labelsOf(type, empty)}: Generate disabled`)
        assert.equal(state.ariaDisabled, true, `${labelsOf(type, empty)}: aria-disabled`)
        assert.equal(state.title, HINT, `${labelsOf(type, empty)}: hint`)
        if (studio) assert.equal(state.label, 'Generate (⌘↵)', 'the accessible name is unchanged; the hint is its description')
        assert.equal(await d.clickGenerate(), false, `${labelsOf(type, empty)}: a disabled button does not click`)
        await d.forceGenerateClick()
        const meta = await d.key({ metaKey: true })
        await d.key({ ctrlKey: true })
        await d.key({})
        assert.equal(meta.defaultPrevented, true, 'the shortcut is still swallowed (no stray newline)')
        assert.equal(d.calls.length, 0, `${labelsOf(type, empty)}: nothing generated by button, forced click, Cmd+Enter, Ctrl+Enter or Enter`)
        assert.deepEqual(d.layoutCommands, [], `${labelsOf(type, empty)}: no Layout placeholder inserted`)
      }
      // text enables it, whitespace around the text is fine
      await d.type('  Quarterly revenue by region ')
      const enabled = d.state()
      assert.equal(enabled.disabled, false, `${type}: text enables Generate`)
      assert.equal(enabled.ariaDisabled, undefined)
      assert.equal(enabled.title, 'Generate (⌘↵)')
      assert.equal(await d.clickGenerate(), true)
      assert.equal(d.calls.length, 1, `${type}: one generation by the button`)
      assert.equal(d.layoutCommands.length, 1)
      assert.match(d.calls[0].prompt, /Quarterly revenue by region/)
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 2, `${type}: Cmd+Enter generates with text`)
      await d.key({ ctrlKey: true })
      assert.equal(d.calls.length, 3, `${type}: Ctrl+Enter generates with text`)
      await d.key({})
      assert.equal(d.calls.length, 3, 'plain Enter never submits')
      // reactive the other way
      await d.type('')
      assert.equal(d.state().disabled, true, `${type}: cleared again: disabled again`)
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 3, `${type}: Cmd+Enter after clearing does nothing`)
    } finally { d.destroy() }
  }
}

/** The error box's retry buttons and "Check generation result". */
async function assertRetryRules(world) {
  const find = (d, label) => d.hosts().find(node => node.type === 'button' && textOf(node).trim() === label)
  for (const strategy of ['start_fresh_attempt', undefined, null]) {
    const d = mount(world, 'TEXT_BOX', { error: 'The service is busy.', retryStrategy: strategy })
    try {
      await d.type('Draft that failed')
      const retry = find(d, strategy === 'start_fresh_attempt' ? 'Try fresh generation' : 'Try again')
      assert.ok(retry, `retry button (${strategy})`)
      assert.equal(retry.props.disabled, false, 'text present: retry enabled')
      await d.type('')
      assert.equal(find(d, strategy === 'start_fresh_attempt' ? 'Try fresh generation' : 'Try again').props.disabled, true, `empty prompt: the retry is disabled too (${strategy})`)
      await d.click(find(d, strategy === 'start_fresh_attempt' ? 'Try fresh generation' : 'Try again'))
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 0, `nothing generated from an empty prompt after an error (${strategy})`)
      await d.type('Second try')
      assert.equal(await d.click(find(d, strategy === 'start_fresh_attempt' ? 'Try fresh generation' : 'Try again')), true)
      assert.equal(d.calls.length, 1)
      assert.equal(d.calls[0].intent, 'retry')
    } finally { d.destroy() }
  }
  // "Check generation result" re-reads an attempt already paid for: not blocked, even with the prompt cleared
  const d = mount(world, 'TEXT_BOX', { error: 'The result may still arrive.', retryStrategy: 'resume_same_attempt' })
  try {
    await d.type('')
    const state = d.state()
    assert.equal(state.title, 'Check generation result (⌘↵)')
    assert.equal(state.disabled, false)
    assert.equal(state.ariaDisabled, undefined)
    assert.equal(await d.clickGenerate(), true)
    assert.deepEqual(d.calls.map(call => call.intent), ['retry'])
    await d.key({ metaKey: true })
    assert.equal(d.calls.length, 2)
    const retry = find(d, 'Check generation result')
    assert.ok(retry && retry.props.disabled === false, 'the error box check button too')
  } finally { d.destroy() }
}

// ---- 4. exceptions stay open ---------------------------------------------------------------------------------------------------------------
async function assertExceptions(world) {
  // Chart: Custom JSON
  {
    const d = mount(world, 'CHART')
    try {
      assert.equal(d.state().disabled, true, 'Chart Auto: required')
      await d.click(d.button('Custom JSON'))
      assert.equal(d.state().disabled, false, 'Chart Custom JSON, empty prompt: Generate stays open')
      assert.equal(d.state().ariaDisabled, undefined)
      assert.equal(await d.clickGenerate(), true)
      assert.equal(d.calls.length, 0, 'the form\'s own data check still runs (no JSON yet)')
      assert.match(textOf(d.tree.tree), /Enter custom chart data before generating\./)
      const data = d.hosts().find(node => node.type === 'textarea' && node.props.id === 'chart-custom-data')
      data.props.onChange({ target: { value: '[{"label":"Jan","value":100},{"label":"Feb","value":120}]' } }); d.tree.flush(); await settle()
      assert.equal(d.state().disabled, false)
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 1, 'valid Custom JSON generates with no prompt')
      assert.equal(d.calls[0].type, 'CHART')
      assert.equal(d.calls[0].prompt, '')
      await d.click(d.button('Auto'))
      assert.equal(d.state().disabled, true, 'back to Auto: required again')
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 1)
    } finally { d.destroy() }
  }
  // Shape: preset vs custom
  {
    const d = mount(world, 'SHAPE')
    try {
      assert.equal(d.state().disabled, true, 'Shape Custom: required')
      const circle = d.hosts().find(node => node.type === 'button' && textOf(node).trim() === 'Circle' && node.props.onClick)
      await d.click(circle)
      assert.equal(d.state().disabled, false, 'a preset Shape, empty prompt: Generate open')
      assert.equal(await d.clickGenerate(), true)
      assert.equal(d.calls.length, 1)
      assert.equal(d.calls[0].shape, 'circle')
      assert.equal(d.calls[0].prompt, 'blue circle', 'the form\'s own stand-in prompt, unchanged')
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 2)
      const custom = d.hosts().find(node => node.type === 'button' && textOf(node).trim() === 'Custom' && node.props.onClick)
      await d.click(custom)
      assert.equal(d.state().disabled, true, 'back to Custom: required')
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 2)
    } finally { d.destroy() }
  }
  // Infographic: reference image, manual rows
  {
    const d = mount(world, 'INFOGRAPHIC')
    try {
      assert.equal(d.state().disabled, true, 'Infographic Creative, no reference: required')
      const file = d.hosts().find(node => node.type === 'input' && node.props.type === 'file')
      file.props.onChange({ target: { files: [{ name: 'sketch.png' }] }, currentTarget: { value: '' } }); d.tree.flush(); await settle()
      assert.equal(d.state().disabled, false, 'with a reference image: Generate open')
      assert.equal(await d.clickGenerate(), true)
      assert.equal(d.calls.length, 1)
      assert.equal(d.calls[0].prompt, 'Recreate infographic from reference image')
      assert.equal(d.calls[0].referenceImage, 'sketch.png')
      await d.key({ ctrlKey: true })
      assert.equal(d.calls.length, 2)
      // Structured removes the reference -> required; Manual rows -> open again
      await d.click(d.button('Structured'))
      assert.equal(d.state().disabled, true, 'Structured, automatic content, no reference: required')
      await d.click(d.hosts().find(node => node.type === 'button' && node.props.title === 'Show advanced options'))
      await d.click(d.button('Manual rows'))
      assert.equal(d.state().disabled, false, 'Structured with manual rows: Generate open')
      assert.equal(await d.clickGenerate(), true)
      assert.equal(d.calls.length, 2, 'the manual-rows check still runs (the seeded rows are empty)')
      assert.match(textOf(d.tree.tree), /Segment 1 needs a heading\./)
      await d.click(d.button('Automatic'))
      assert.equal(d.state().disabled, true, 'automatic again: required')
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 2)
    } finally { d.destroy() }
  }
  // Refine / Edit current: every form keeps today's rules (the element already exists)
  for (const type of ALL_FORMS) {
    const d = mount(world, type, { mode: 'refine' })
    try {
      const state = d.state()
      assert.equal(state.found, true, `${type} refine: Generate present`)
      assert.equal(state.disabled, false, `${type} refine, empty prompt: enabled as before`)
      assert.equal(state.ariaDisabled, undefined)
      assert.equal(state.title, 'Generate (⌘↵)')
      assert.equal(await d.clickGenerate(), true)
      assert.equal(d.calls.length, 1, `${type} refine: the empty-prompt click still fires`)
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 2, `${type} refine: and Cmd+Enter`)
    } finally { d.destroy() }
  }
  // Edit mode has no prompt box at all
  for (const type of ['TEXT_BOX', 'IMAGE']) {
    const d = mount(world, type, { mode: 'edit' })
    try {
      assert.equal(d.state().found, false, `${type} edit: no Generate button`)
      await d.key({ metaKey: true })
      assert.equal(d.calls.length, 0)
    } finally { d.destroy() }
  }
  // A panel that switches from Add (generate) to Refine (the placeholder became an element) releases the guard, and back
  {
    const d = mount(world, 'IMAGE')
    try {
      assert.equal(d.state().disabled, true)
      d.rerender({ mode: 'refine' })
      assert.equal(d.state().disabled, false, 'generate -> refine: released')
      d.rerender({ mode: 'generate' })
      assert.equal(d.state().disabled, true, 'refine -> generate: blocked again')
    } finally { d.destroy() }
  }
}

// ---- 4b. the slide panel shares the input and is untouched ---------------------------------------------------------------------------
function assertSharedInputDefault(world) {
  const { GenerationInput } = world.load(INPUT)
  const calls = []
  const tree = new Root()
  tree.setElement(React.createElement(GenerationInput, { prompt: '', onPromptChange: noop, mandatoryConfig: null, showAdvanced: false, onToggleAdvanced: noop, onSubmit: intent => calls.push(intent), isGenerating: false, error: null }))
  tree.flush()
  try {
    const button = hostNodes(tree.tree).find(node => node.type === 'button' && node.props.title === 'Generate (⌘↵)')
    assert.ok(button, 'no prop given (the Add Slide panel): the input behaves as before')
    assert.equal(Boolean(button.props.disabled), false)
    assert.equal(button.props['aria-disabled'], undefined)
    button.props.onClick({})
    assert.deepEqual(calls, ['generate'])
  } finally { tree.unmount() }
  // the input takes its hint from its caller and imports nothing of the guard (test-shape-typed-failure and test-textbox-planned-recovery
  // load it with a closed list of imports)
  assert.doesNotMatch(read(INPUT), /studio-empty-prompt-guard/)
}

/** The input's own contract: a non-empty hint blocks, anything else (not set, null, '') does not; the error box's retry follows. */
function assertInputContract(world) {
  const { GenerationInput } = world.load(INPUT)
  const render = extra => {
    const calls = []
    const tree = new Root()
    tree.setElement(React.createElement(GenerationInput, { prompt: '', onPromptChange: noop, mandatoryConfig: null, showAdvanced: false, onToggleAdvanced: noop,
      onSubmit: intent => calls.push(intent), isGenerating: false, error: 'Offline failure', retryStrategy: 'start_fresh_attempt', ...extra }))
    tree.flush()
    const hosts = hostNodes(tree.tree)
    const submit = hosts.find(node => node.type === 'button' && /^(Generate|Shorten)/.test(node.props['aria-label'] ?? ''))
    const retry = hosts.find(node => node.type === 'button' && textOf(node).trim() === 'Try fresh generation')
    tree.unmount()
    return { calls, submit, retry }
  }
  for (const hint of [undefined, null, '']) {
    const { submit, retry } = render({ emptyPromptHint: hint })
    assert.equal(Boolean(submit.props.disabled), false, `hint ${JSON.stringify(hint)}: not blocked`)
    assert.equal(submit.props['aria-disabled'], undefined)
    assert.equal(submit.props.title, 'Generate (⌘↵)')
    assert.equal(Boolean(retry.props.disabled), false)
  }
  const { calls, submit, retry } = render({ emptyPromptHint: 'Say what to make' })
  assert.equal(submit.props.disabled, true)
  assert.equal(submit.props['aria-disabled'], true)
  assert.equal(submit.props.title, 'Say what to make', 'the hint is the caller\'s text')
  assert.equal(retry.props.disabled, true, 'the error box\'s retry is disabled too')
  submit.props.onClick({}); retry.props.onClick({})
  assert.deepEqual(calls, [], 'forced clicks do nothing')
  const over = render({ emptyPromptHint: 'Say what to make', prompt: 'x'.repeat(50), mandatoryConfig: { fieldLabel: 'F', displayLabel: 'F', onChange: noop, promptMaxLength: 10 } })
  assert.equal(over.submit.props.title, 'Shorten the prompt before generating', 'the length message wins')
}

// ---- 5. flag off is the base tree ---------------------------------------------------------------------------------------------------------
/** A scripted session through every form; everything observable goes into the trace. */
async function traceSession(world) {
  const trace = []
  for (const type of ALL_FORMS) {
    const d = mount(world, type)
    const snap = async step => {
      trace.push({ type, step, markup: sha(d.markup()), button: d.state(), calls: d.calls.map(call => ({ ...call })), commands: [...d.layoutCommands], renders: d.tree.renders })
    }
    try {
      await snap('mounted')
      for (const prompt of ['   ', 'A short brief', '']) {
        await d.type(prompt); await snap(`typed ${JSON.stringify(prompt)}`)
        await d.clickGenerate(); await snap('clicked')
        await d.key({ metaKey: true }); await snap('Cmd+Enter')
        await d.key({ ctrlKey: true }); await snap('Ctrl+Enter')
      }
      if (type === 'CHART') {
        await d.click(d.button('Custom JSON')); await snap('custom json')
        await d.clickGenerate(); await snap('custom clicked')
        const data = d.hosts().find(node => node.type === 'textarea' && node.props.id === 'chart-custom-data')
        data.props.onChange({ target: { value: '[{"label":"Jan","value":100},{"label":"Feb","value":120}]' } }); d.tree.flush(); await settle()
        await d.key({ metaKey: true }); await snap('custom data Cmd+Enter')
        await d.click(d.button('Auto')); await snap('auto again')
      }
      if (type === 'SHAPE') {
        await d.click(d.hosts().find(node => node.type === 'button' && textOf(node).trim() === 'Circle' && node.props.onClick)); await snap('circle')
        await d.clickGenerate(); await snap('circle clicked')
        await d.click(d.hosts().find(node => node.type === 'button' && textOf(node).trim() === 'Custom' && node.props.onClick)); await snap('custom again')
      }
      if (type === 'INFOGRAPHIC') {
        d.hosts().find(node => node.type === 'input' && node.props.type === 'file').props.onChange({ target: { files: [{ name: 'sketch.png' }] }, currentTarget: { value: '' } })
        d.tree.flush(); await settle(); await snap('reference attached')
        await d.clickGenerate(); await snap('reference clicked')
        await d.click(d.button('Structured')); await snap('structured')
        await d.click(d.hosts().find(node => node.type === 'button' && node.props.title === 'Show advanced options')); await snap('advanced')
        await d.click(d.button('Manual rows')); await snap('manual rows')
        await d.clickGenerate(); await snap('manual clicked')
        await d.click(d.button('Automatic')); await snap('automatic')
      }
      d.rerender({ mode: 'refine' }); await snap('refine')
      await d.clickGenerate(); await snap('refine clicked')
      await d.key({ metaKey: true }); await snap('refine Cmd+Enter')
      d.rerender({ mode: 'generate', error: 'Offline failure', retryStrategy: 'start_fresh_attempt' }); await snap('error')
      const retry = d.hosts().find(node => node.type === 'button' && textOf(node).trim() === 'Try fresh generation')
      await d.click(retry); await snap('retry clicked')
      d.rerender({ retryStrategy: 'resume_same_attempt' }); await snap('resume')
      await d.clickGenerate(); await snap('resume clicked')
      d.rerender({ isGenerating: true }); await snap('generating')
    } finally { d.destroy() }
  }
  return trace
}

async function identityChecks(overrides = {}, envs = [{}, { [FLAG]: 'false' }, { [FLAG]: 'TRUE' }, { [FLAG]: '1' }]) {
  if (!baseAvailable) return 'skipped'
  const base = await traceSession(worldFor({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, baseOverrides()))
  const baseClassic = await traceSession(worldFor({}, baseOverrides()))
  assert.ok(base.length > 100, 'the trace is not trivially empty')
  assert.ok(base.some(step => step.calls.length > 0) && base.some(step => step.button.disabled), 'the trace exercises generation and disabled states')
  for (const extra of envs) {
    const studio = await traceSession(worldFor({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', ...extra }, overrides))
    const classic = await traceSession(worldFor({ ...extra }, overrides))
    for (const [label, a, b] of [['studio', base, studio], ['classic', baseClassic, classic]]) {
      assert.equal(a.length, b.length, `${label} ${JSON.stringify(extra)}: same number of steps`)
      for (let i = 0; i < a.length; i++) assert.deepEqual(b[i], a[i], `${label} ${JSON.stringify(extra)}: step ${i} (${a[i].type} ${a[i].step}) differs from the base tree`)
    }
  }
  return sha(base)
}

/** The forms' opt-out is read only with the flag on (flag off: the registered config and its effect deps are exactly the base's). */
function gatingChecks(overrides = {}) {
  for (const file of [CHART, SHAPE, INFOGRAPHIC]) {
    const source = overrides[file] ?? read(file)
    assert.match(source, /STUDIO_EMPTY_PROMPT_GUARD_ENABLED && /, `${file}: the opt-out is gated on the flag`)
  }
}

// ---- the whole behaviour, as one function the mutants re-run -------------------------------------------------------------------------------
async function behaviourSuite(overrides = {}, { identity = true } = {}) {
  libChecks(overrides)
  gatingChecks(overrides)
  await assertGuardOn(worldFor(ON_STUDIO, overrides), ALL_FORMS, { studio: true })
  await assertGuardOn(worldFor(ON_CLASSIC, overrides), ['TEXT_BOX', 'SHAPE', 'DIAGRAM'], { studio: false })
  await assertRetryRules(worldFor(ON_STUDIO, overrides))
  await assertExceptions(worldFor(ON_STUDIO, overrides))
  await assertDefectFlagOff(worldFor(OFF, overrides))
  assertSharedInputDefault(worldFor(ON_STUDIO, overrides))
  assertInputContract(worldFor(ON_STUDIO, overrides))
  if (identity) await identityChecks(overrides)
}

let checks = 0
const failures = []
const pending = []
const check = (name, fn) => {
  checks++
  pending.push((async () => { try { await fn(); console.log(`ok   ${name}`) } catch (error) { failures.push(name); console.log(`FAIL ${name}\n     ${String(error?.stack ?? error).split('\n').slice(0, 6).join('\n     ')}`) } })())
  return pending[pending.length - 1]
}

// run the sections one after another (they share the one fake window)
await check('1 lib: exact flag literal, what empty means, decision table, form opt-out', () => libChecks())
await check('2 the defect: base tree and flag off, an EMPTY prompt fires a generation in all nine forms (button and Cmd+Enter)', async () => {
  await assertDefectFlagOff(worldFor(OFF))
  await assertDefectFlagOff(worldFor({}))
  if (baseAvailable) await assertDefectFlagOff(worldFor({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, baseOverrides()))
  else console.log('     (base commit not in this clone: the base-tree half of 2 is skipped)')
})
await check('3 flag on, Studio shell: every required-prompt form is blocked (button, forced click, Cmd/Ctrl+Enter, Enter) and no placeholder is inserted', () => assertGuardOn(worldFor(ON_STUDIO), ALL_FORMS, { studio: true }))
await check('3b flag on, classic shell: same rules, title carries the hint', () => assertGuardOn(worldFor(ON_CLASSIC), ALL_FORMS, { studio: false }))
await check('3c error box retry and "Check generation result"', () => assertRetryRules(worldFor(ON_STUDIO)))
await check('4 exceptions: Chart Custom JSON, preset Shape, Infographic reference / manual rows, Refine on every form, edit mode, generate <-> refine', () => assertExceptions(worldFor(ON_STUDIO)))
await check('4b the slide panel\'s use of the shared input (no prop) is unchanged; the input\'s own hint contract', () => { assertSharedInputDefault(worldFor(ON_STUDIO)); assertInputContract(worldFor(ON_STUDIO)) })
await check('5 flag off (unset / "false" / "TRUE" / "1") equals the base tree: markup, button state, every call, render passes, Studio and classic', async () => {
  const result = await identityChecks()
  if (result === 'skipped') console.log('     (base commit not in this clone: identity skipped)')
  else console.log(`     base trace ${result}`)
})
await check('6a wiring: the page gives the panel its one onGenerate; the flag lives only in the lib; the forms gate their opt-out on it', () => {
  const page = read('app/builder/page.tsx')
  assert.equal((page.match(/<GenerationPanel\b/g) || []).length, 1)
  assert.match(page, /<GenerationPanel[\s\S]{0,900}onGenerate=\{handleApprovedTextLabsGenerate\}/)
  assert.doesNotMatch(page, /EMPTY_PROMPT_GUARD/, 'page.tsx untouched')
  const hook = read('hooks/use-textlabs-generation.ts')
  assert.doesNotMatch(hook, /EMPTY_PROMPT_GUARD/, 'the Text Labs hook untouched')
  assert.match(hook, /const handleGenerateDeferred = useCallback\(/, 'the placeholder is inserted inside Generate (deferred), i.e. behind onGenerate')
  const lib = read(LIB)
  assert.match(lib, /process\.env\.NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD === 'true'/)
  assert.doesNotMatch(lib.replace(/\/\*[\s\S]*?\*\//g, ''), /\b(fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|setTimeout)\b/)
  for (const file of fs.readdirSync(path.join(root, 'components/generation-panel'), { recursive: true }).filter(name => /\.tsx?$/.test(name))) {
    assert.doesNotMatch(read(`components/generation-panel/${file}`), /process\.env\.NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD/, `${file}: the flag is read only in the lib`)
  }
  gatingChecks()
  assert.match(read(PANEL), /if \(emptyPromptBlockedRef\.current\) return\n/, 'one choke point for every submit')
})
await check('6b documented default off; script registered', () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD="false"$/m)
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-empty-prompt-guard'], 'node scripts/test-studio-empty-prompt-guard.mjs')
})
if (baseAvailable) {
  await check('6c untouched: the Text Labs hook, the page, the session and theme code, the other panels and forms', () => {
    const touched = git(['diff', '--name-only', BASE_SHA]).split('\n').filter(Boolean)
    const allowed = new Set([LIB, PANEL, INPUT, CHART, SHAPE, INFOGRAPHIC, 'components/generation-panel/types.ts', '.env.example', 'package.json', 'scripts/test-studio-empty-prompt-guard.mjs'])
    for (const file of touched) assert.ok(allowed.has(file), `unexpected file changed: ${file}`)
  })
}

// ---- 7. mutants ---------------------------------------------------------------------------------------------------------------------------
const MUTANTS = [
  ['lib: whitespace is not empty', LIB, "return prompt.replace(/[\\u200b-\\u200d\\u2060\\ufeff]/g, '').trim() === ''", "return prompt === ''"],
  ['lib: zero-width characters count as text', LIB, "prompt.replace(/[\\u200b-\\u200d\\u2060\\ufeff]/g, '').trim()", 'prompt.trim()'],
  ['lib: Refine is guarded too', LIB, "  if (input.mode !== 'generate') return false\n", ''],
  ['lib: "Check generation result" is guarded too', LIB, "  if (input.retryStrategy === 'resume_same_attempt') return false\n", ''],
  ['lib: the form opt-out is ignored', LIB, "  if (input.promptOptional === true) return false\n", ''],
  ['lib: the flag is ignored', LIB, "if (!(input.enabled ?? STUDIO_EMPTY_PROMPT_GUARD_ENABLED)) return false", 'if (false) return false'],
  ['lib: any registered config opts out (every)', LIB, 'configs.some(entry => entry?.promptOptional === true)', 'configs.every(entry => entry?.promptOptional === true)'],
  ['panel: the shortcut / click funnel is not guarded', PANEL, '    if (emptyPromptBlockedRef.current) return\n', ''],
  ['panel: the input is not told', PANEL, '            emptyPromptHint={emptyPromptBlocked ? EMPTY_PROMPT_HINT : undefined}\n', ''],
  ['panel: the input is told, but with no hint', PANEL, 'emptyPromptHint={emptyPromptBlocked ? EMPTY_PROMPT_HINT : undefined}', "emptyPromptHint={emptyPromptBlocked ? ' ' : undefined}"],
  ['panel: the form opt-out is not read', PANEL, 'promptOptional: mandatoryConfigPromptOptional(mandatoryConfig),', 'promptOptional: false,'],
  ['panel: the guard ignores the panel mode', PANEL, "  const emptyPromptBlocked = emptyPromptBlocksGenerate({\n    mode,", "  const emptyPromptBlocked = emptyPromptBlocksGenerate({\n    mode: 'generate',"],
  ['panel: the ref is never updated', PANEL, '  emptyPromptBlockedRef.current = emptyPromptBlocked\n', ''],
  // only the flag-off identity traces (render passes) can see this one
  ['panel: an extra render pass with the flag off', PANEL, '  emptyPromptBlockedRef.current = emptyPromptBlocked\n',
    '  emptyPromptBlockedRef.current = emptyPromptBlocked\n  const [, bump] = useState(0)\n  useEffect(() => { bump(n => n + 1) }, [mandatoryConfig])\n', { identity: true }],
  ['input: Generate is not disabled', INPUT, 'isGenerating || promptOverLimit || promptGuardBlocked', 'isGenerating || promptOverLimit'],
  ['input: no aria-disabled', INPUT, '              aria-disabled={promptGuardBlocked ? true : undefined}\n', ''],
  ['input: no hint', INPUT, '                  : promptGuardHint !== null\n                    ? promptGuardHint\n                    : retryStrategy', '                  : retryStrategy'],
  ['input: a blank hint blocks too', INPUT, "const promptGuardHint = emptyPromptHint ? emptyPromptHint : null", "const promptGuardHint = emptyPromptHint ?? null"],
  ['chart: Custom JSON never opts out', CHART, "STUDIO_EMPTY_PROMPT_GUARD_ENABLED && dataSource === 'custom'", 'false'],
  ['chart: Auto opts out too', CHART, "STUDIO_EMPTY_PROMPT_GUARD_ENABLED && dataSource === 'custom'", 'STUDIO_EMPTY_PROMPT_GUARD_ENABLED'],
  ['chart: opt-out not gated on the flag (flag off re-registers)', CHART, "STUDIO_EMPTY_PROMPT_GUARD_ENABLED && dataSource === 'custom'", "dataSource === 'custom'"],
  ['shape: presets never opt out', SHAPE, "STUDIO_EMPTY_PROMPT_GUARD_ENABLED && shapeType !== 'custom'", 'false'],
  ['shape: Custom opts out (inverted)', SHAPE, "STUDIO_EMPTY_PROMPT_GUARD_ENABLED && shapeType !== 'custom'", "STUDIO_EMPTY_PROMPT_GUARD_ENABLED && shapeType === 'custom'"],
  ['infographic: a reference image does not opt out', INFOGRAPHIC, "(guardMode === 'v1' && referenceImage !== null) || ", ''],
  ['infographic: manual rows do not opt out', INFOGRAPHIC, " || (guardMode === 'v2' && contentMode === 'manual')", ''],
  ['infographic: always opts out', INFOGRAPHIC, "STUDIO_EMPTY_PROMPT_GUARD_ENABLED && (() => {", "STUDIO_EMPTY_PROMPT_GUARD_ENABLED && (() => { return true"],
]
for (const [label, file, from, to, options = {}] of MUTANTS) {
  await check(`7 mutant caught: ${label}`, async () => {
    const source = read(file)
    assert.ok(source.includes(from), `mutant anchor present in ${file}`)
    assert.equal(source.split(from).length, 2, `mutant anchor unique in ${file}`)
    const overrides = { [file]: source.replace(from, to) }
    let caught = false
    try { await behaviourSuite(overrides, { identity: options.identity === true }) } catch { caught = true }
    assert.ok(caught, 'the mutant passed every check')
  })
}

await Promise.all(pending)
console.log(failures.length ? `\n${failures.length} of ${checks} FAILED` : `\nall ${checks} empty-prompt-guard checks passed`)
process.exit(failures.length ? 1 : 0)
