// J3-SHAPE-FILL-CONTRAST-FE (ELEMENT-2, J3 pass 2 P3): NEXT_PUBLIC_STUDIO_SHAPE_TARGET_BACKGROUND (exact "true"), default off.
// Studio half of the shape-fill contrast fix. With Fill on "Auto (deck)" the Shape form sends no fill; Text Labs then paints the deck primary
// on an assumed light ground, which is navy on navy on a dark hero (1.40:1). Text Labs !96 (TL_SHAPE_FILL_CONTRAST_ENABLED) picks the first
// palette colour reaching 3:1 against `shape_config.target_background` when that is a hex. Flag on: Fill Auto and Background not set by the
// user -> the form adds `target_background: "#rrggbb"` = the current slide's ground (lib/studio-shape-target-background.ts).
//
// Proves, offline (the #371 harness pattern: the REAL panel, the REAL Shape form, the REAL hook and libs run in mini-react; the Layout viewer
// and Layout REST are answered with frames recorded from the REAL layout-builder code, scripts/fixtures/studio-shape-target-background/):
//   1. the lib: flag read as an exact literal; colour normalisation (#rgb, #rrggbb, rgb(), rgba() alpha 1, plain names -> #rrggbb; gradient,
//      url(), var(), hsl(), translucent, unknown -> null); hero vs content layout; the decision table;
//   2. the real Layout frames: the slide's `canvas_type` read from the viewer's getTemplateSlotCatalog frame, the deck's `--theme-bg` /
//      `--theme-hero-bg` read from Layout's /theme/css-variables response; the fixtures are re-derived from the pinned layout-builder
//      commit when this machine has it (skipped with a notice otherwise); server.py and the viewer are pinned for the keys read;
//   3. flag on, in the mounted panel (Studio shell and classic): a navy hero sends its hex, a light content slide its hex, a dark theme both
//      grounds, an rgb() ground is normalised; a gradient ground, a failed or empty viewer read, a failed theme read, no presentation or
//      slide: nothing; Fill set by the user, Background set by the user: nothing (the user's own word is untouched); a restored draft that
//      holds the hex Studio sent last time counts as Auto; moving to another slide re-reads; every other shape_config key is unchanged;
//      Generate is never blocked by the read; the key survives the real request builder into `shape_config`;
//   4. flag off is the base tree: traces (markup hash per step, every onGenerate call, every viewer read, every fetch) of both trees
//      hash-equal under flag unset / "false" / "TRUE" / "1" (git base = BASE_SHA; skipped with a notice if the commit is not in the clone);
//   5. wiring: the flag is read in one file, .env.example, package.json, FRONTEND-2's files untouched;
//   6. mutants of the lib, the form, the hook and the panel must each be caught.
//
//   node scripts/test-studio-shape-target-background.mjs
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
import { recordCatalogFrames } from './fixtures/studio-shape-target-background/record-catalog.mjs'

for (const name of Object.keys(process.env)) if (/KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD/i.test(name)) delete process.env[name]
const denied = () => { throw new Error('Offline harness forbids network') }
net.connect = net.createConnection = net.Socket.prototype.connect = denied
http.request = http.get = https.request = https.get = denied

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const FIXTURES = path.join(here, 'fixtures', 'studio-shape-target-background')
/** studio-v4-dev-preparation-code at #398: flag off must behave exactly as this. */
const BASE_SHA = 'ff57a9816534004d92b46540a477f501c0923f55'
/** layout-builder origin/uat the frames were recorded from. */
const LAYOUT_SHA = 'b0e78e2772e2652269c5874dfd147f755dc56b19'
const LAYOUT_REPO = path.resolve(root, '..', '..', 'backend', 'layout-builder')
const FLAG = 'NEXT_PUBLIC_STUDIO_SHAPE_TARGET_BACKGROUND'
const LIB = 'lib/studio-shape-target-background.ts'
const PANEL = 'components/generation-panel/index.tsx'
const SHAPE = 'components/generation-panel/forms/shape-form.tsx'
const HOOK = 'hooks/use-deck-theme-palette.ts'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16)
const clone = value => JSON.parse(JSON.stringify(value))

const CATALOG = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'catalog-frames.json'), 'utf8'))
const THEMES = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'css-variables-frames.json'), 'utf8'))

const gitEnv = { ...process.env }
delete gitEnv.GIT_DIR
delete gitEnv.GIT_WORK_TREE
const gitIn = (cwd, args) => execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
const git = args => gitIn(root, args)
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE_SHA}^{commit}`]) } catch { baseAvailable = false }
let layoutAvailable = true
try { gitIn(LAYOUT_REPO, ['cat-file', '-e', `${LAYOUT_SHA}^{commit}`]) } catch { layoutAvailable = false }
/** The base tree = this tree with the panel, its forms and the theme hook read from BASE_SHA (the new lib does not exist there and is not imported). */
function baseOverrides() {
  const overrides = {}
  for (const file of git(['ls-tree', '-r', '--name-only', BASE_SHA, 'components/generation-panel', 'hooks/use-deck-theme-palette.ts']).split('\n').filter(Boolean)) {
    if (/\.(tsx?)$/.test(file)) overrides[file] = git(['show', `${BASE_SHA}:${file}`])
  }
  return overrides
}

// ---- the two backends, answered with the recorded real frames ----------------------------------------------------------------------------
const LAYOUT_URL = 'http://127.0.0.1:9'
const TEXTLABS_URL = 'http://127.0.0.1:10'
let fetchLog = []
let textLabsBodies = []
globalThis.fetch = async (url, init) => {
  const u = String(url)
  fetchLog.push(u)
  const css = /^http:\/\/127\.0\.0\.1:9\/api\/presentations\/([^/]+)\/theme\/css-variables$/.exec(u)
  if (css) {
    const deck = THEMES.decks[decodeURIComponent(css[1])]
    if (!deck) return { ok: false, status: 404, json: async () => ({ detail: 'Presentation not found' }) }
    return { ok: deck.status === 200, status: deck.status, json: async () => ({ success: true, css_variables: clone(deck.css_variables), theme_id: deck.theme_id, is_custom: deck.is_custom }) }
  }
  if (u.startsWith(`${TEXTLABS_URL}/`)) {
    textLabsBodies.push(JSON.parse(init.body))
    return { ok: false, status: 503, json: async () => ({}), text: async () => '' }
  }
  throw new Error(`Offline harness forbids network: ${u}`)
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
  '@/components/ui/popover': { __esModule: true, Popover: passThrough('popover'), PopoverTrigger: passThrough('popover-trigger'), PopoverContent: passThrough('popover-content') },
  '@/components/ui/tooltip': { __esModule: true, Tooltip: passThrough('tooltip'), TooltipTrigger: passThrough('tooltip-trigger'), TooltipContent: passThrough('tooltip-content'), TooltipProvider: passThrough('tooltip-provider') },
  '@/components/ui/switch': { __esModule: true, Switch: props => React.createElement('button', { role: 'switch', ...props }) },
  '@/components/ui/checkbox': { __esModule: true, Checkbox: props => React.createElement('input', { type: 'checkbox', ...props }) },
}
const hostRequire = (await import('node:module')).createRequire(path.join(root, 'package.json'))
const worldCache = new Map()
function worldFor(env, overrides = {}) {
  const fullEnv = { NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT_URL, NEXT_PUBLIC_ELEMENTOR_URL: TEXTLABS_URL, ...env }
  const key = JSON.stringify([fullEnv, Object.entries(overrides).map(([file, source]) => [file, sha(source)]).sort()])
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
    new Function('module', 'exports', 'require', 'process', compile(rel, source))(module, module.exports, require, { env: fullEnv })
    return module.exports
  }
  const world = { load, Panel: null, env: fullEnv }
  worldCache.set(key, world)
  return world
}
const panelOf = world => (world.Panel ??= world.load(PANEL).GenerationPanel)

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

// ---- the panel, mounted with the Shape form ------------------------------------------------------------------------------------------------
const CAPABILITIES = { web: { available: true }, uploaded_documents: { available: false, reason: 'none' }, knowledge_graph: { available: false, reason: 'none' } }
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }
const noop = () => {}

/** The viewer's getTemplateSlotCatalog, answered with the recorded real frame of the layout each slide index holds. */
function catalogReader(layouts, log) {
  return async slideIndex => {
    log.push(slideIndex)
    const layoutId = layouts[slideIndex]
    if (!layoutId) throw new Error(`Slide ${slideIndex} not found`)
    return clone(CATALOG.frames[layoutId])
  }
}

function mount(world, { presentationId = 'default', slideIndex = 0, layouts = ['H1s', 'L25'], reader, draft, mandatory = true } = {}) {
  const calls = []
  const catalogReads = []
  const onGenerate = async (formData, intent) => { calls.push({ formData: clone(formData), intent }) }
  const props = {
    isOpen: true, activationId: 1, elementType: 'SHAPE', onClose: noop, onGenerate, onElementTypeChange: noop, isGenerating: false, error: null,
    slideIndex, presentationId, mode: 'generate', researchMode: 'off', researchWeb: false, researchUploadedDocs: false, researchKnowledgeGraph: false,
    researchCapabilities: CAPABILITIES, onResearchModeChange: noop, onResearchWebChange: noop, onResearchUploadedDocsChange: noop,
    onResearchKnowledgeGraphChange: noop, draft,
  }
  if (mandatory) props.getTemplateSlotCatalog = reader ?? catalogReader(layouts, catalogReads)
  const tree = new Root()
  const Panel = panelOf(world)
  const driver = {
    tree, calls, catalogReads, props,
    hosts: () => hostNodes(tree.tree),
    rerender(next) { Object.assign(props, next); tree.setElement(React.createElement(Panel, { ...props })); tree.flush() },
    generateButton: () => driver.hosts().find(node => node.type === 'button' && typeof node.props.title === 'string' && node.props.title.startsWith('Generate')),
    async click(node) {
      if (!node || node.props.disabled || !node.props.onClick) return false
      node.props.onClick({ preventDefault: noop, stopPropagation: noop, currentTarget: node, target: node })
      tree.flush(); await settle(); return true
    },
    preset: label => driver.hosts().find(node => node.type === 'button' && textOf(node).trim() === label && node.props.onClick),
    async openStyling() {
      const styling = () => driver.hosts().find(node => node.type === 'button' && textOf(node).trim() === 'Styling' && node.props.onClick)
      if (!styling()) await driver.click(driver.hosts().find(node => node.type === 'button' && node.props.title === 'Show advanced options'))
      await driver.click(styling())
    },
    backgroundSelect: () => driver.hosts().find(node => node.type === 'select' && node.props.value !== undefined && ['light', 'dark'].includes(node.props.value)),
    markup: () => renderToStaticMarkup(toElements(tree.tree)),
    async generate() {
      await driver.click(driver.preset('Circle')) // a preset shape needs no prompt; Fill stays Auto
      const ok = await driver.click(driver.generateButton())
      assert.equal(ok, true, 'Generate is clickable')
      return calls[calls.length - 1].formData.shapeConfig
    },
    destroy() { tree.unmount() },
  }
  driver.rerender({})
  return driver
}
async function mounted(world, options) { const d = mount(world, options); await settle(); d.rerender({}); await settle(); return d }

/** Slide 0 answers at once; slide 1's read never answers (the viewer is busy): what is sent while it is pending? */
async function pendingReadSends(env, overrides) {
  const reader = slideIndex => slideIndex === 0 ? Promise.resolve(clone(CATALOG.frames.H1s)) : new Promise(() => {})
  const d = await mounted(worldFor(env, overrides), { presentationId: 'custom-hero-navy', reader })
  try {
    assert.equal(GROUND(await d.generate()), '#16203a', 'slide 0 answered')
    d.rerender({ slideIndex: 1 }); await settle(); d.rerender({}); await settle()
    return await d.generate()
  } finally { d.destroy() }
}

/** What the form's Target Background select shows once Styling is open. */
async function selectValueAfterOpening(env, { deck, draft, overrides }) {
  const d = await mounted(worldFor(env, overrides), { presentationId: deck, layouts: ['H1s'], draft })
  try { await d.openStyling(); return d.backgroundSelect()?.props.value } finally { d.destroy() }
}

/** The deck changes under a mounted form: the old deck's theme must not linger when the new one cannot be read. */
async function deckChangeSends(env, overrides, nextDeck) {
  const d = await mounted(worldFor(env, overrides), { presentationId: 'custom-hero-navy', layouts: ['H1s'] })
  try {
    assert.equal(GROUND(await d.generate()), '#16203a')
    d.rerender({ presentationId: nextDeck }); await settle(); d.rerender({}); await settle()
    return await d.generate()
  } finally { d.destroy() }
}

const ON = { [FLAG]: 'true' }
const ON_STUDIO = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'true' }
const OFF = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }

/** One Generate on a deck/layout, the shape_config it sent. */
async function shapeConfigFor(env, { deck = 'default', layout = 'H1s', overrides, ...rest } = {}) {
  const d = await mounted(worldFor(env, overrides), { presentationId: deck, layouts: [layout], ...rest })
  try { return await d.generate() } finally { d.destroy() }
}
const GROUND = shapeConfig => shapeConfig.target_background

// ---- 1. the lib --------------------------------------------------------------------------------------------------------------------------
const libFor = (env, overrides = {}) => worldFor(env, overrides).load(LIB)
function libChecks(overrides = {}) {
  for (const [value, expected] of [['true', true], ['false', false], ['TRUE', false], ['1', false], ['', false], [undefined, false]]) {
    const env = value === undefined ? {} : { [FLAG]: value }
    assert.equal(libFor(env, overrides).STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED, expected, `flag ${JSON.stringify(value)}`)
  }
  const lib = libFor(ON, overrides)
  const hex = lib.normaliseGroundToHex
  for (const [input, expected] of [
    ['#16203a', '#16203a'], ['#16203A', '#16203a'], ['  #FFFFFF ', '#ffffff'], ['#abc', '#aabbcc'], ['#FFF', '#ffffff'], ['#16203aff', '#16203a'],
    ['rgb(15, 23, 42)', '#0f172a'], ['rgb(15,23,42)', '#0f172a'], ['RGB(255, 255, 255)', '#ffffff'], ['rgba(15, 23, 42, 1)', '#0f172a'],
    ['rgba(15, 23, 42, 1.0)', '#0f172a'], ['rgb(15 23 42)', '#0f172a'], ['rgb(15 23 42 / 1)', '#0f172a'], ['rgb(15 23 42 / 100%)', '#0f172a'],
    ['white', '#ffffff'], ['Navy', '#000080'], ['black', '#000000'],
  ]) assert.equal(hex(input), expected, `normalise ${JSON.stringify(input)}`)
  for (const input of [
    'linear-gradient(135deg,#16203a,#0f172a)', 'radial-gradient(circle,#fff,#000)', 'url(bg.png)', 'url("https://x/y.png") center', 'var(--theme-bg)',
    'var(--theme-bg, #fff)', 'hsl(220, 50%, 15%)', 'rgba(15, 23, 42, 0.5)', 'rgba(15, 23, 42, 0)', 'rgb(15 23 42 / 50%)', 'rgb(300, 0, 0)',
    '#16203a80', '#12345', '#1234567', 'transparent', 'currentColor', 'inherit', 'rebeccapurple', 'none', '', '   ', null, undefined, 5, {}, [],
    'x'.repeat(80),
  ]) assert.equal(hex(input), null, `not solid: ${JSON.stringify(input)}`)
  for (const canvas of ['H1', 'H1s', 'H2', 'H3', 'h1s', ' H3 ', 'H1-generated']) assert.equal(lib.isHeroCanvasType(canvas), true, `hero ${canvas}`)
  for (const canvas of ['C1', 'L25', 'I1', 'S3', 'B1', 'V2', '', 'blank', undefined, null, 4]) assert.equal(lib.isHeroCanvasType(canvas), false, `content ${canvas}`)
  const vars = { '--theme-bg': '#ffffff', '--theme-hero-bg': '#16203a', '--theme-background': '#eeeeee' }
  assert.equal(lib.resolveSlideGroundHex('H1s', vars), '#16203a')
  assert.equal(lib.resolveSlideGroundHex('H3', vars), '#16203a')
  assert.equal(lib.resolveSlideGroundHex('L25', vars), '#ffffff')
  assert.equal(lib.resolveSlideGroundHex('L25', { '--theme-background': '#EEEEEE' }), '#eeeeee', 'alias token')
  assert.equal(lib.resolveSlideGroundHex('H1s', { '--theme-bg': '#ffffff' }), null, 'a hero never falls back to the content ground')
  assert.equal(lib.resolveSlideGroundHex('L25', { '--theme-hero-bg': '#16203a' }), null, 'a content slide never takes the hero ground')
  assert.equal(lib.resolveSlideGroundHex('H1s', { '--theme-hero-bg': 'linear-gradient(#000,#111)' }), null, 'gradient: nothing')
  assert.equal(lib.resolveSlideGroundHex('L25', { '--theme-bg': 'linear-gradient(#000,#111)', '--theme-background': '#ffffff' }), null, 'a non-solid token does not fall through to another')
  assert.equal(lib.resolveSlideGroundHex('L25', { '--theme-bg': '' , '--theme-background': '#ffffff' }), '#ffffff')
  assert.equal(lib.resolveSlideGroundHex(null, vars), null)
  assert.equal(lib.resolveSlideGroundHex('', vars), null)
  assert.equal(lib.resolveSlideGroundHex('H1s', null), null)
  assert.equal(lib.resolveSlideGroundHex('H1s', undefined), null)
  assert.equal(lib.resolveSlideGroundHex('H1s', {}), null)
  assert.equal(lib.isSentGroundValue('#16203a'), true)
  assert.equal(lib.isSentGroundValue('#16203A'), true)
  for (const word of ['light', 'dark', '', '#fff', 'rgb(1,2,3)', null, undefined, 3]) assert.equal(lib.isSentGroundValue(word), false, `user word ${word}`)
  const field = (over = {}) => lib.shapeTargetBackgroundField({ enabled: true, fillExplicit: false, backgroundExplicit: false, groundHex: '#16203a', ...over })
  assert.deepEqual(field(), { target_background: '#16203a' })
  assert.deepEqual(field({ enabled: false }), {}, 'flag off')
  assert.deepEqual(field({ fillExplicit: true }), {}, 'Fill set by the user')
  assert.deepEqual(field({ backgroundExplicit: true }), {}, 'Background set by the user')
  assert.deepEqual(field({ groundHex: null }), {}, 'no solid ground known')
  assert.deepEqual(field({ groundHex: '' }), {})
}

// ---- 3. flag on, the mounted panel ---------------------------------------------------------------------------------------------------------
const EXPECT = [
  // deck, layout, expected target_background (the recorded real frames: css-variables-frames.json, catalog-frames.json)
  ['custom-hero-navy', 'H1s', '#16203a', 'navy hero of a custom deck'],
  ['custom-hero-navy', 'H2', '#16203a', 'section hero'],
  ['custom-hero-navy', 'H3', '#16203a', 'closing hero'],
  ['custom-hero-navy', 'H1', '#16203a', 'generated hero'],
  ['custom-hero-navy', 'L25', '#0f172a', 'content slide of the same deck takes --theme-bg'],
  ['default', 'H1s', '#1e3a5f', 'default deck hero'],
  ['default', 'L25', '#ffffff', 'light content slide'],
  ['default', 'C1', '#ffffff', 'light content slide (C1)'],
  ['default', 'I1', '#ffffff', 'light content slide (I1)'],
  ['theme:elegant-emerald', 'C1', '#f0fdf4', 'tinted light content slide'],
  ['theme:elegant-emerald', 'H2', '#064e3b', 'its hero'],
  ['theme:vibrant-orange', 'H3', '#c2410c', 'orange hero'],
  ['theme:dark-mode', 'L25', '#111827', 'dark theme content slide'],
  ['theme:dark-mode', 'H1s', '#030712', 'dark theme hero'],
  ['custom-rgb-bg', 'L25', '#0f172a', 'rgb() ground is normalised to hex'],
]
const NOTHING = [
  ['custom-rgb-bg', 'H1s', 'gradient hero ground'],
  ['missing-deck', 'H1s', 'theme read answers 404'],
  [null, 'H1s', 'no presentation'],
]

async function assertFlagOn(env) {
  for (const [deck, layout, expected, label] of EXPECT) {
    const base = await shapeConfigFor(OFF, { deck, layout })
    const config = await shapeConfigFor(env, { deck, layout })
    assert.equal(GROUND(config), expected, `${label}: ${deck} / ${layout}`)
    const { target_background, ...rest } = config
    assert.deepEqual(rest, base, `${label}: every other shape_config key is exactly as before`)
    assert.equal('target_background' in base, false, 'flag off sends none')
  }
  for (const [deck, layout, label] of NOTHING) {
    const config = await shapeConfigFor(env, { deck, layout })
    assert.equal('target_background' in config, false, `${label}: nothing sent`)
    assert.deepEqual(config, await shapeConfigFor(OFF, { deck, layout }), `${label}: the request is the old one`)
  }
  // the viewer read failing in each way: nothing sent, Generate still works
  for (const [label, options] of [
    ['viewer rejects', { reader: async () => { throw new Error('Iframe not ready') } }],
    ['viewer answers success:false', { reader: async () => ({ success: false, error: 'Slide 0 not found' }) }],
    ['viewer answers null', { reader: async () => null }],
    ['viewer answers a catalog without canvas_type', { reader: async () => ({ success: true, data: { slots: [] } }) }],
    ['viewer answers garbage', { reader: async () => 'nope' }],
    ['reader synchronous throw', { reader: () => { throw new Error('sync') } }],
    ['no reader prop', { mandatory: false }],
  ]) {
    const config = await shapeConfigFor(env, { deck: 'custom-hero-navy', ...options })
    assert.equal('target_background' in config, false, `${label}: nothing sent`)
    assert.equal(config.shape_type, 'circle', `${label}: the shape is still generated`)
  }
  // slide index missing
  {
    const d = await mounted(worldFor(env), { presentationId: 'custom-hero-navy', slideIndex: null })
    try { assert.equal('target_background' in await d.generate(), false, 'no slide index: nothing'); assert.deepEqual(d.catalogReads, []) } finally { d.destroy() }
  }
  // Fill set by the user: nothing, even on a navy hero
  {
    const draft = { prompt: '', formData: { componentType: 'SHAPE', prompt: '', count: 1, layout: 'horizontal', shapeConfig: { shape_type: 'circle', fill_color: '#ff0000' } } }
    const config = await shapeConfigFor(env, { deck: 'custom-hero-navy', layout: 'H1s', draft })
    assert.equal('target_background' in config, false, 'Fill set by the user: nothing')
    assert.equal(config.fill_color, '#ff0000')
    // and with the flag off the same draft sends the same thing
    assert.deepEqual(config, await shapeConfigFor(OFF, { deck: 'custom-hero-navy', layout: 'H1s', draft }))
  }
  // Background set by the user: their own word is untouched, no hex added
  {
    const d = await mounted(worldFor(env), { presentationId: 'custom-hero-navy', layouts: ['H1s'] })
    try {
      await d.openStyling()
      const select = d.backgroundSelect()
      assert.ok(select, 'the Target Background select is in the form')
      select.props.onChange({ target: { value: 'dark' } }); d.tree.flush(); await settle()
      assert.equal(GROUND(await d.generate()), 'dark', 'the user\'s "dark" is sent as it always was')
    } finally { d.destroy() }
    for (const word of ['light', 'dark']) {
      const draft = { prompt: '', formData: { componentType: 'SHAPE', prompt: '', count: 1, layout: 'horizontal', shapeConfig: { shape_type: 'circle', target_background: word } } }
      const config = await shapeConfigFor(env, { deck: 'custom-hero-navy', layout: 'H1s', draft })
      assert.equal(GROUND(config), word, `a restored Background "${word}" stays the user's`)
      assert.deepEqual(config, await shapeConfigFor(OFF, { deck: 'custom-hero-navy', layout: 'H1s', draft }))
    }
  }
  // a restored draft holding the hex Studio sent last time is Auto again (fresh ground, not the stale one)
  {
    const draft = { prompt: '', formData: { componentType: 'SHAPE', prompt: '', count: 1, layout: 'horizontal', shapeConfig: { shape_type: 'circle', target_background: '#abcdef' } } }
    assert.equal(GROUND(await shapeConfigFor(env, { deck: 'custom-hero-navy', layout: 'H1s', draft })), '#16203a', 'the old hex is replaced by the current ground')
    const none = await shapeConfigFor(env, { deck: 'missing-deck', layout: 'H1s', draft })
    assert.equal('target_background' in none, false, 'and nothing is carried over when no ground is known')
    assert.equal(await selectValueAfterOpening(env, { deck: 'custom-hero-navy', draft }), 'light', 'the Target Background select shows its own default, not the hex')
  }
  // moving to another slide re-reads
  {
    const d = await mounted(worldFor(env), { presentationId: 'default', layouts: ['H1s', 'L25', 'H3'], slideIndex: 0 })
    try {
      assert.equal(GROUND(await d.generate()), '#1e3a5f', 'slide 0 is a hero')
      d.rerender({ slideIndex: 1 }); await settle(); d.rerender({}); await settle()
      assert.equal(GROUND(await d.generate()), '#ffffff', 'slide 1 is a light content slide')
      d.rerender({ slideIndex: 9 }); await settle(); d.rerender({}); await settle()
      assert.equal('target_background' in await d.generate(), false, 'a slide the viewer cannot find: nothing, never the previous slide\'s ground')
      d.rerender({ slideIndex: 2 }); await settle(); d.rerender({}); await settle()
      assert.equal(GROUND(await d.generate()), '#1e3a5f', 'slide 2 is a hero again')
      assert.deepEqual(d.catalogReads, [0, 1, 9, 2], 'one viewer read per slide, nothing on submit')
    } finally { d.destroy() }
  }
  // the next slide's read still pending: the previous slide's ground is never reused
  assert.equal('target_background' in await pendingReadSends(env), false, 'a pending read sends nothing, never the previous slide\'s ground')
  for (const next of ['missing-deck', null]) assert.equal('target_background' in await deckChangeSends(env, undefined, next), false, `deck changed to ${next}: the old deck's ground is not reused`)
  assert.equal(GROUND(await deckChangeSends(env, undefined, 'theme:dark-mode')), '#030712', 'deck changed to another readable deck: its ground')
  // exactly one theme read per form (the hook already fetched it; no second fetch is added)
  {
    fetchLog = []
    const d = await mounted(worldFor(env), { presentationId: 'custom-hero-navy' })
    try {
      await d.generate()
      assert.equal(fetchLog.filter(url => url.endsWith('/theme/css-variables')).length, 1, 'one css-variables read')
      assert.deepEqual(fetchLog.filter(url => !url.endsWith('/theme/css-variables')), [], 'no other request')
    } finally { d.destroy() }
  }
  // the key survives the real request builder into shape_config
  {
    const config = await shapeConfigFor(env, { deck: 'custom-hero-navy', layout: 'H1s' })
    const client = worldFor(env).load('lib/textlabs-client.ts')
    const formData = { componentType: 'SHAPE', prompt: 'blue circle', count: 1, layout: 'horizontal', advancedModified: false, z_index: 100, presentationId: 'custom-hero-navy',
      useDeckTheme: true, themeOverrides: null, shapeConfig: config, positionConfig: { start_col: 4, start_row: 4, position_width: 6, position_height: 6, auto_position: false }, paddingConfig: { top: 0, right: 0, bottom: 0, left: 0 } }
    const { message, options } = client.buildApiPayload('session-1', formData)
    textLabsBodies = []
    await client.sendMessage('session-1', message, options).catch(() => {})
    assert.equal(textLabsBodies.length, 1, 'the request reached the (stub) Text Labs')
    assert.equal(textLabsBodies[0].shape_config.target_background, '#16203a', 'shape_config.target_background in the request body')
    assert.equal(textLabsBodies[0].shape_config.fill_color, undefined, 'and still no fill: Text Labs picks it')
  }
}

// ---- 2. the real Layout frames -----------------------------------------------------------------------------------------------------------
function layoutFrameChecks() {
  assert.equal(CATALOG._provenance.layout_builder_sha, LAYOUT_SHA)
  assert.equal(THEMES._provenance.layout_builder_sha, LAYOUT_SHA)
  const parse = worldFor(ON).load('lib/text-slot-catalog.ts').parseTemplateSlotCatalog
  for (const [layoutId, frame] of Object.entries(CATALOG.frames)) {
    assert.equal(frame.success, true, `${layoutId}: the viewer answers`)
    assert.equal(frame.canvas_type, layoutId, `${layoutId}: canvas_type is the layout id, alias-normalised`)
    assert.equal(frame.data.canvas_type, layoutId, `${layoutId}: and in data`)
    assert.equal(parse(frame).canvas_type, layoutId, `${layoutId}: Studio's own parser reads it`)
  }
  for (const name of ['default', 'custom-hero-navy', 'theme:elegant-emerald', 'theme:dark-mode']) {
    const vars = THEMES.decks[name].css_variables
    assert.match(vars['--theme-bg'], /^#[0-9a-f]{6}$/i, `${name}: Layout's --theme-bg is a hex`)
    assert.match(vars['--theme-hero-bg'], /^#[0-9a-f]{6}$/i, `${name}: Layout's --theme-hero-bg is a hex`)
  }
  assert.equal(THEMES.decks['custom-rgb-bg'].css_variables['--theme-bg'], 'rgb(15, 23, 42)', 'a stored custom theme is returned verbatim, so rgb() can reach Studio')
  assert.match(THEMES.decks['custom-rgb-bg'].css_variables['--theme-hero-bg'], /^linear-gradient/, 'and so can a gradient')
  // pinned to the code on this machine, when it is here
  if (!layoutAvailable) { console.log(`  note: layout-builder ${LAYOUT_SHA.slice(0, 8)} not in this clone: frames checked against the fixtures only`); return }
  const show = rel => gitIn(LAYOUT_REPO, ['show', `${LAYOUT_SHA}:${rel}`])
  assert.deepEqual(recordCatalogFrames(show), CATALOG.frames, 'the catalog fixtures are what the REAL semantic-slot-catalog.js returns')
  const server = show('server.py')
  assert.match(server, /@app\.get\("\/api\/presentations\/\{presentation_id\}\/theme\/css-variables"\)/, 'the REST route Studio reads')
  assert.match(server, /"background": "--theme-bg"/)
  assert.match(server, /"hero_background": "--theme-hero-bg"/)
  assert.match(server, /"css_variables": custom_theme_bundle/, 'a custom bundle is returned verbatim')
  const viewer = show('viewer/presentation-viewer.html')
  assert.match(viewer, /case 'getTemplateSlotCatalog':[\s\S]{0,700}canvas_type: catalogResult\.canvas_type/, 'the viewer posts canvas_type back')
  const catalog = show('src/utils/semantic-slot-catalog.js')
  assert.match(catalog, /const canvasType = normalizeTemplateId\(slide\.dataset\.template \|\| slide\.dataset\.layout\)/)
  assert.match(catalog, /return \{ success: true, canvas_type: canvasType, hero_style: heroStyle, slots \}/)
  // no viewer command reports a slide's painted ground, which is why the layout + theme read is used
  assert.doesNotMatch(viewer, /case 'getSlideBackground'|case 'getSlideGround'|case 'getSlideStyle'/)
}

// ---- 4. flag off is the base tree ----------------------------------------------------------------------------------------------------------
async function trace(world) {
  const out = []
  const scenarios = [
    { deck: 'custom-hero-navy', layouts: ['H1s'] },
    { deck: 'default', layouts: ['L25'] },
    { deck: 'theme:dark-mode', layouts: ['H3'] },
    { deck: 'custom-hero-navy', layouts: ['H1s'], draft: { prompt: '', formData: { componentType: 'SHAPE', prompt: '', count: 1, layout: 'horizontal', shapeConfig: { shape_type: 'circle', fill_color: '#ff0000' } } } },
    { deck: 'custom-hero-navy', layouts: ['H1s'], draft: { prompt: '', formData: { componentType: 'SHAPE', prompt: '', count: 1, layout: 'horizontal', shapeConfig: { shape_type: 'circle', target_background: '#abcdef' } } } },
    { deck: 'custom-hero-navy', layouts: ['H1s'], draft: { prompt: '', formData: { componentType: 'SHAPE', prompt: '', count: 1, layout: 'horizontal', shapeConfig: { shape_type: 'circle', target_background: 'dark' } } } },
    { deck: 'missing-deck', layouts: ['H1s'] },
    { deck: null, layouts: ['H1s'], mandatory: false },
  ]
  for (const [index, scenario] of scenarios.entries()) {
    fetchLog = []
    const d = mount(world, scenario)
    try {
      const steps = [sha(d.markup())]
      await settle(); d.rerender({}); await settle()
      steps.push(sha(d.markup()))
      await d.openStyling()
      steps.push(sha(d.markup()))
      const select = d.backgroundSelect()
      steps.push(select ? select.props.value : null)
      const shapeConfig = await d.generate()
      steps.push(sha(d.markup()))
      d.rerender({ slideIndex: 1 }); await settle(); d.rerender({}); await settle()
      steps.push(sha(d.markup()))
      await d.generate()
      out.push({ index, steps, calls: d.calls.map(call => ({ call: call.formData, intent: call.intent })), shapeConfig, catalogReads: d.catalogReads, fetches: [...fetchLog] })
    } finally { d.destroy() }
  }
  return out
}
async function assertFlagOffIdentity() {
  if (!baseAvailable) { console.log(`  note: base commit ${BASE_SHA.slice(0, 8)} not in this clone: flag-off identity skipped`); return }
  const baseTrace = await trace(worldFor(OFF, baseOverrides()))
  const baseHash = sha(baseTrace)
  assert.ok(baseTrace.every(item => item.calls.length === 2), 'the trace generated in every scenario')
  assert.ok(baseTrace.some(item => item.fetches.length > 0), 'and the base reads the deck theme')
  for (const flagValue of [undefined, 'false', 'TRUE', '1', '']) {
    const env = flagValue === undefined ? OFF : { ...OFF, [FLAG]: flagValue }
    const branchTrace = await trace(worldFor(env))
    assert.equal(sha(branchTrace), baseHash, `flag ${JSON.stringify(flagValue)}: the trace (markup, calls, viewer reads, fetches) hashes equal to the base tree`)
    assert.deepEqual(branchTrace, baseTrace)
  }
  // the classic panel (no Studio shell) too
  assert.equal(sha(await trace(worldFor({}))), sha(await trace(worldFor({}, baseOverrides()))), 'classic panel: identical')
  console.log(`  flag-off trace hash ${baseHash} (base ${BASE_SHA.slice(0, 8)} == branch, flag unset/false/TRUE/1/empty, ${baseTrace.length} scenarios)`)
}

// ---- 5. wiring ---------------------------------------------------------------------------------------------------------------------------
function wiringChecks() {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_SHAPE_TARGET_BACKGROUND="false"$/m, '.env.example documents the flag, off')
  assert.match(read('package.json'), /"test:studio-shape-target-background": "node scripts\/test-studio-shape-target-background\.mjs"/, 'registered in package.json')
  const readers = []
  const walk = dir => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (['node_modules', '.next', '.git', 'scripts', 'docs', 'screenshots'].includes(entry.name)) continue
      const rel = path.posix.join(dir, entry.name)
      if (entry.isDirectory()) walk(rel)
      else if (/\.(tsx?|mjs)$/.test(entry.name) && read(rel).includes('process.env.NEXT_PUBLIC_STUDIO_SHAPE_TARGET_BACKGROUND')) readers.push(rel)
    }
  }
  walk('.')
  assert.deepEqual(readers, [LIB], 'the flag is read in exactly one file')
  assert.match(read(SHAPE), /STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED/)
  assert.match(read(PANEL), /getTemplateSlotCatalog=\{getTemplateSlotCatalog\}/)
  if (baseAvailable) {
    const touched = git(['diff', '--name-only', BASE_SHA, '--']).split('\n').filter(Boolean)
    // The viewer was frozen for this change; PASS2B batch 1 later edits it behind its own flag (test-studio-pass2b-batch1.mjs proves that edit).
    for (const frozen of ['hooks/use-textlabs-generation.ts', 'lib/element-free-spot.ts']) {
      assert.equal(touched.includes(frozen), false, `${frozen} is FRONTEND-2's and is untouched`)
    }
  }
}

// ---- 6. mutants --------------------------------------------------------------------------------------------------------------------------
async function coreScenarios(overrides) {
  const env = ON_STUDIO
  libChecks(overrides)
  const w = o => ({ overrides, ...o })
  assert.equal(GROUND(await shapeConfigFor(env, w({ deck: 'custom-hero-navy', layout: 'H1s' }))), '#16203a')
  assert.equal(GROUND(await shapeConfigFor(env, w({ deck: 'default', layout: 'L25' }))), '#ffffff')
  assert.equal(GROUND(await shapeConfigFor(env, w({ deck: 'theme:dark-mode', layout: 'H3' }))), '#030712')
  assert.equal(GROUND(await shapeConfigFor(env, w({ deck: 'custom-rgb-bg', layout: 'L25' }))), '#0f172a')
  assert.equal('target_background' in await shapeConfigFor(env, w({ deck: 'custom-rgb-bg', layout: 'H1s' })), false)
  assert.equal('target_background' in await shapeConfigFor(env, w({ deck: 'missing-deck', layout: 'H1s' })), false)
  assert.equal('target_background' in await shapeConfigFor(env, w({ deck: 'custom-hero-navy', reader: async () => { throw new Error('x') } })), false)
  assert.equal('target_background' in await shapeConfigFor(env, w({ deck: 'custom-hero-navy', mandatory: false })), false)
  const fill = { prompt: '', formData: { componentType: 'SHAPE', prompt: '', count: 1, layout: 'horizontal', shapeConfig: { shape_type: 'circle', fill_color: '#ff0000' } } }
  assert.equal('target_background' in await shapeConfigFor(env, w({ deck: 'custom-hero-navy', draft: fill })), false)
  const dark = { prompt: '', formData: { componentType: 'SHAPE', prompt: '', count: 1, layout: 'horizontal', shapeConfig: { shape_type: 'circle', target_background: 'dark' } } }
  assert.equal(GROUND(await shapeConfigFor(env, w({ deck: 'custom-hero-navy', draft: dark }))), 'dark')
  const sent = { prompt: '', formData: { componentType: 'SHAPE', prompt: '', count: 1, layout: 'horizontal', shapeConfig: { shape_type: 'circle', target_background: '#abcdef' } } }
  assert.equal(GROUND(await shapeConfigFor(env, w({ deck: 'custom-hero-navy', draft: sent }))), '#16203a')
  assert.equal(await selectValueAfterOpening(env, { deck: 'custom-hero-navy', draft: sent, overrides }), 'light')
  {
    const d = await mounted(worldFor(env, overrides), { presentationId: 'default', layouts: ['H1s', 'L25'] })
    try {
      assert.equal(GROUND(await d.generate()), '#1e3a5f')
      d.rerender({ slideIndex: 1 }); await settle(); d.rerender({}); await settle()
      assert.equal(GROUND(await d.generate()), '#ffffff')
    } finally { d.destroy() }
  }
  assert.equal('target_background' in await pendingReadSends(env, overrides), false)
  assert.equal('target_background' in await deckChangeSends(env, overrides, 'missing-deck'), false)
  assert.equal('target_background' in await deckChangeSends(env, overrides, null), false)
  // flag off: no viewer read, nothing sent
  {
    const d = await mounted(worldFor(OFF, overrides), { presentationId: 'custom-hero-navy' })
    try { assert.equal('target_background' in await d.generate(), false); assert.deepEqual(d.catalogReads, []) } finally { d.destroy() }
  }
  {
    const d = await mounted(worldFor({ NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'false' }, overrides), { presentationId: 'custom-hero-navy' })
    try { assert.equal('target_background' in await d.generate(), false); assert.deepEqual(d.catalogReads, []) } finally { d.destroy() }
  }
}

const MUTANTS = [
  [LIB, 'hero ground unused', s => s.replace('/^H\\d/i.test(canvasType.trim())', '/^X\\d/i.test(canvasType.trim())')],
  [LIB, 'rgb() not normalised', s => s.replace("m = /^rgba?\\(", "m = /^rgbz?\\(")],
  [LIB, 'alpha ignored', s => s.replace('if (m[4] !== undefined && (m[5] ? Number(m[4]) !== 100 : Number(m[4]) !== 1)) return null', '')],
  [LIB, 'unknown colour guessed', s => s.replace('return NAMED[text] ?? null', "return NAMED[text] ?? '#ffffff'")],
  [LIB, 'non-solid token falls through', s => s.replace("if (cssVars[name] !== undefined && cssVars[name] !== null && cssVars[name] !== '') return null", '')],
  [LIB, 'hero falls back to --theme-bg', s => s.replace("? ['--theme-hero-bg'] :", "? ['--theme-hero-bg', '--theme-bg'] :")],
  [LIB, 'Fill ignored', s => s.replace('input.fillExplicit || ', '')],
  [LIB, 'Background ignored', s => s.replace('input.backgroundExplicit || ', '')],
  [LIB, 'flag ignored in the field', s => s.replace('!input.enabled || ', '')],
  [LIB, 'flag read as truthy', s => s.replace("=== 'true'", '!== undefined')],
  [LIB, 'sent-ground test too loose', s => s.replace('/^#[0-9a-f]{6}$/i.test(value.trim())', 'value.length > 0')],
  [SHAPE, 'ground never added', s => s.replace('...shapeTargetBackgroundField({', '...({}) && ({}) , void ({')],
  [SHAPE, 'flag ignored by the form (read, ground and field)', s => s
    .replace('    if (!STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED) return\n    setSlideCanvasType(null)', '    setSlideCanvasType(null)')
    .replace('const groundHex = STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED ? resolveSlideGroundHex(slideCanvasType, deckCssVars) : null', 'const groundHex = resolveSlideGroundHex(slideCanvasType, deckCssVars)')
    .replace('enabled: STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED, fillExplicit', 'enabled: true, fillExplicit')],
  [SHAPE, 'Fill not passed', s => s.replace("fillExplicit: explicitFields.has('fill')", 'fillExplicit: false')],
  [SHAPE, 'Background not passed', s => s.replace("backgroundExplicit: explicitFields.has('background'), groundHex", 'backgroundExplicit: false, groundHex')],
  [SHAPE, 'viewer read ignores the flag', s => s.replace('    if (!STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED) return\n    setSlideCanvasType(null)', '    setSlideCanvasType(null)')],
  [SHAPE, 'slide change not re-read', s => s.replace('  }, [getTemplateSlotCatalog, slideIndex])', '  }, [getTemplateSlotCatalog])')],
  [SHAPE, 'previous slide ground kept', s => s.replace('    setSlideCanvasType(null)\n    if (!getTemplateSlotCatalog', '    if (!getTemplateSlotCatalog')],
  [SHAPE, 'theme vars ignored', s => s.replace('resolveSlideGroundHex(slideCanvasType, deckCssVars)', 'resolveSlideGroundHex(slideCanvasType, null)')],
  [SHAPE, 'sent hex counts as user Background', s => s.replace('!(STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED && isSentGroundValue(initialConfig.target_background))', 'true')],
  [SHAPE, 'sent hex loaded into the select', s => s.replace("(STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED && isSentGroundValue(initialConfig.target_background) ? '' : initialConfig.target_background)", 'initialConfig.target_background')],
  [SHAPE, 'ground missing from the submit deps', s => s.replace('onSubmit, noBorderFromPrompt, groundHex])', 'onSubmit, noBorderFromPrompt])')],
  [HOOK, 'css vars never kept', s => s.replace("if (STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED) setCssVars(vars && typeof vars === 'object' ? vars : null)", '')],
  [HOOK, 'css vars not cleared on error', s => s.replace(/(\.catch\(err => \{[\s\S]*?)if \(STUDIO_SHAPE_TARGET_BACKGROUND_ENABLED\) setCssVars\(null\)/, '$1')],
  [PANEL, 'catalog reader not handed to the form', s => s.replace('getTemplateSlotCatalog={getTemplateSlotCatalog} />', '/>')],
  [PANEL, 'slide index not handed to the form', s => s.replace('slideIndex={slideIndex} getTemplateSlotCatalog={getTemplateSlotCatalog} />', 'getTemplateSlotCatalog={getTemplateSlotCatalog} />')],
]
// mutants of the flag-off identity (each must be caught by the base-tree trace or the core scenarios)
async function assertMutantsCaught() {
  for (const [file, label, mutate] of MUTANTS) {
    const source = read(file)
    const mutated = mutate(source)
    assert.notEqual(mutated, source, `mutant "${label}" (${file}) changes the source`)
    let caught = false
    try { await coreScenarios({ [file]: mutated }) } catch { caught = true }
    assert.equal(caught, true, `mutant "${label}" (${file}) must be caught`)
  }
}

// ---- run -------------------------------------------------------------------------------------------------------------------------------
let passed = 0
async function run(name, fn) { await fn(); passed++; console.log(`ok  ${name}`) }

await run('lib: flag literal, normalisation, hero vs content, decision table', () => libChecks())
await run('real Layout frames: canvas_type, --theme-bg / --theme-hero-bg, pinned code', layoutFrameChecks)
await run('flag on, Studio shell: ground sent / not sent, every case', () => assertFlagOn(ON_STUDIO))
await run('flag on, classic panel: same', () => assertFlagOn(ON))
await run('flag off == base tree (hash)', assertFlagOffIdentity)
await run('wiring: one reader, .env.example, package.json, FRONTEND-2 files untouched', wiringChecks)
await run(`${MUTANTS.length} mutants caught`, assertMutantsCaught)
console.log(`\n${passed} groups passed`)
