// Add Element text box / metrics request fidelity (UAT J3-F1 / J3-F4).
// Flag NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED: literal "true" = on, default off.
// Checks the real Text Box / Metrics forms and the real Text Labs client end to end
// (control -> form data -> JSON body of POST /api/chat/message). Flag off must be
// byte-identical to the base commit; flag on must stop sending what the user never chose.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const require = createRequire(import.meta.url)
const BASE_REF = '6d47cae4' // studio-v4-dev-preparation-code before this change
const FLAG = 'NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED'
const copy = value => JSON.parse(JSON.stringify(value))
let checks = 0
async function check(name, fn) { await fn(); checks++; console.log('PASS ' + name) }

function baseSource(file) {
  try {
    return execFileSync('git', ['show', `${BASE_REF}:${file}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { return null }
}

// ---------------------------------------------------------------------------
// Module loader: transpile a repo file (working tree or the base commit) and run
// it in a vm with React hooks faked and CSS/UI leaves stubbed. '@/x' loads x.ts.
// ---------------------------------------------------------------------------
function loader({ flag, hooks, sourceOf = () => null, extraEnv = {} }) {
  const cache = new Map()
  const empty = () => null
  const stubs = {
    react: hooks ?? React,
    'lucide-react': new Proxy({}, { get: () => empty }),
    '../shared/collapsible-section': { CollapsibleSection: ({ children }) => children },
    '../shared/font-override-section': { FontOverrideSection: empty },
    '../shared/position-presets': { PositionPresets: empty },
    '../shared/toggle-row': { ToggleRow: empty },
    '../shared/z-index-input': { ZIndexInput: empty },
    '../shared/padding-control': { PaddingControl: empty },
    '@/hooks/use-deck-theme-palette': { useDeckThemePalette: () => ({ tokens: [], loading: false, error: null }) },
  }
  const env = { NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.example.test', ...extraEnv }
  if (flag !== undefined) env[FLAG] = flag
  const capture = { requests: [], reply: { success: true, elements: [] } }
  function load(file, sourceRef) {
    const key = `${sourceRef ?? 'tree'}:${file}`
    if (cache.has(key)) return cache.get(key)
    const text = sourceRef ? sourceOf(file) : fs.readFileSync(new URL(file, root), 'utf8')
    assert.ok(text, `source for ${file}`)
    const module = { exports: {} }
    cache.set(key, module.exports)
    const out = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } })
    vm.runInNewContext(out.outputText, {
      module, exports: module.exports, React: hooks ?? React, console, AbortController, DOMException, crypto: globalThis.crypto, URL,
      process: { env },
      fetch: async (url, init) => {
        capture.requests.push({ url, body: init?.body })
        return { ok: true, headers: { get: () => null }, json: async () => capture.reply }
      },
      require: id => id in stubs ? stubs[id]
        : id.endsWith('.css') ? {}
        : id.startsWith('@/') ? load(id.slice(2) + '.ts')
        : require(id),
    })
    cache.set(key, module.exports)
    return module.exports
  }
  return { load, capture, env }
}

// Wire builder: formData -> exact JSON string POSTed to /api/chat/message.
async function wire(client, formData) {
  const { capture, mod } = client
  capture.requests.length = 0
  const { message, options } = mod.buildApiPayload('session-1', copy(formData))
  await mod.sendMessage('session-1', message, options)
  assert.equal(capture.requests.length, 1)
  assert.match(capture.requests[0].url, /\/api\/chat\/message$/)
  return capture.requests[0].body
}
function clientFor({ flag, ref }) {
  const l = loader({ flag, sourceOf: baseSource })
  return { mod: l.load('lib/textlabs-client.ts', ref), capture: l.capture }
}

// ---------------------------------------------------------------------------
// 1. Pure helpers (import-free lib module), flag off and on.
// ---------------------------------------------------------------------------
const libOff = loader({ flag: undefined }).load('lib/textbox-request-fidelity.ts')
const libOn = loader({ flag: 'true' }).load('lib/textbox-request-fidelity.ts')
await check('flag defaults off and only the literal "true" turns it on', () => {
  assert.equal(libOff.TEXTBOX_REQUEST_FIDELITY_ENABLED, false)
  for (const value of ['', 'false', 'TRUE', '1', 'yes']) {
    assert.equal(loader({ flag: value }).load('lib/textbox-request-fidelity.ts').TEXTBOX_REQUEST_FIDELITY_ENABLED, false, value)
  }
  assert.equal(libOn.TEXTBOX_REQUEST_FIDELITY_ENABLED, true)
})
await check('list_style speaks the Text Service vocabulary and leaves everything else alone', () => {
  assert.equal(libOn.textBoxListStyleWire('numbered'), 'numbers')
  assert.equal(libOn.textBoxListStyleWire('plain'), 'none')
  for (const value of ['bullets', 'numbers', 'none', 'constructor', undefined, 3]) assert.equal(libOn.textBoxListStyleWire(value), value)
})
await check('body config keeps every visible choice and drops state behind hidden controls', () => {
  const config = {
    background: 'colored', color_variant: 'teal', opacity: 0.8, corners: 'rounded', shadow: true, show_title: true,
    title_style: 'colored-bg', title_underline: true, heading_align: 'center', list_style: 'numbered',
    simple_subtype: 'word', target_char_count: 40, content_font_family: 'Inter', heading_bold: true,
  }
  const kept = copy(libOn.textBoxConfigForRequest(config, { isBodyText: true, structure: 'classic' }))
  assert.deepEqual(kept, {
    background: 'colored', color_variant: 'teal', opacity: 0.8, corners: 'rounded', shadow: true, show_title: true,
    title_style: 'colored-bg', title_underline: true, heading_align: 'center', list_style: 'numbers',
    content_font_family: 'Inter', heading_bold: true,
  })
  const simple = copy(libOn.textBoxConfigForRequest(config, { isBodyText: true, structure: 'simple' }))
  assert.equal(simple.simple_subtype, 'word')
  assert.equal(simple.target_char_count, 40)
  const transparent = copy(libOn.textBoxConfigForRequest({ ...config, background: 'transparent' }, { isBodyText: true, structure: 'classic' }))
  assert.equal(transparent.background, 'transparent')
  assert.equal('color_variant' in transparent || 'opacity' in transparent, false)
  assert.equal(config.list_style, 'numbered', 'input is never mutated')
})
await check('structural roles only send the content font controls Template Text shows', () => {
  const sent = copy(libOn.textBoxConfigForRequest({
    background: 'colored', title_style: 'underline', list_style: 'plain', content_font_family: 'Inter', content_bold: true, content_align: 'center',
  }, { isBodyText: false, structure: 'classic' }))
  assert.deepEqual(sent, { content_font_family: 'Inter', content_bold: true })
  assert.deepEqual(copy(libOn.textBoxManualGeometryForRequest({
    items_per_box: 5, title_max_chars: 20, padding_px: 4, max_chars: 60, max_lines: 2, content_font_size_px: 44,
  }, { isBodyText: false })), { max_chars: 60, max_lines: 2, content_font_size_px: 44 })
  const body = { items_per_box: 5 }
  assert.equal(libOn.textBoxManualGeometryForRequest(body, { isBodyText: true }), body)
})

// ---------------------------------------------------------------------------
// 2. Client wire: Auto count is omitted, everything else is untouched.
// ---------------------------------------------------------------------------
const textBox = (extra = {}) => ({
  componentType: 'TEXT_BOX', prompt: 'Three key adoption risks for AI demand forecasting, one sentence each.', count: 1, layout: 'horizontal',
  advancedModified: false, z_index: 1000, presentationId: 'deck-1', useDeckTheme: true, textboxConfig: {}, semanticRole: 'BODY_TEXT',
  slotKind: 'body', geometryMode: 'AUTO', compose: false,
  positionConfig: { start_col: 2, start_row: 4, position_width: 12, position_height: 7, auto_position: false }, ...extra,
})
const metrics = (extra = {}) => ({
  componentType: 'METRICS', prompt: 'Four KPIs: +15 pts, -30%, -12%, -8%', count: 1, layout: 'horizontal', advancedModified: false, z_index: 1000,
  presentationId: 'deck-1', useDeckTheme: true, metricsFitMode: 'AUTO', metricsConfig: { layout: 'horizontal' }, compose: false,
  positionConfig: { start_col: 2, start_row: 4, position_width: 24, position_height: 8, auto_position: false }, ...extra,
})
const baseClient = baseSource('lib/textlabs-client.ts') ? clientFor({ flag: undefined, ref: BASE_REF }) : null
const nowClient = clientFor({ flag: undefined })
const nowClientOn = clientFor({ flag: 'true' })

if (baseClient) {
  const shapes = [
    textBox(), textBox({ count: 4, compose: true, structure: 'SEQUENTIAL', multiBoxColorMode: 'THEME_SEQUENCE',
      elements: [1, 2, 3, 4].map(n => ({ grid_position: { start_col: n, start_row: 4, position_width: 3, position_height: 6 } })) }),
    textBox({ textboxConfig: { list_style: 'numbered', background: 'colored', color_variant: 'teal' }, advancedModified: true }),
    textBox({ semanticRole: 'SLIDE_TITLE', slotName: 'slide_title', slotKind: 'structural', positionConfig: undefined }),
    metrics(), metrics({ count: 3, compose: true, metricsConfig: { layout: 'vertical', color_scheme: 'accent' }, advancedModified: true }),
  ]
  await check('flag off / unaffected shapes: wire bodies are byte-identical to the base commit (' + shapes.length + ' shapes, 3 build modes)', async () => {
    let index = 0
    for (const shape of shapes) {
      const label = `shape ${++index} (${shape.componentType} count ${shape.count})`
      const before = await wire(baseClient, shape)
      assert.equal(await wire(nowClient, shape), before, label + ' (flag unset)')
      assert.equal(await wire(nowClientOn, shape), before, label + ' (flag on, no Auto count)')
      // The new field alone changes nothing when the form (flag off) never sets it.
      assert.equal(await wire(nowClient, { ...shape, countAuto: false }), before, label + ' countAuto:false')
    }
  })
} else {
  console.log('SKIP base-commit byte comparison (git object ' + BASE_REF + ' unavailable)')
}

{
  const auto = JSON.parse(await wire(nowClient, textBox({ countAuto: true })))
  const explicit = JSON.parse(await wire(nowClient, textBox()))
  await check('Auto count is omitted from the body; nothing else changes', () => {
    assert.equal('count' in auto, false)
    assert.equal(explicit.count, 1)
    delete explicit.count
    assert.deepEqual(auto, explicit)
    assert.equal('countAuto' in auto || 'count_auto' in auto, false, 'the marker never reaches the wire')
  })
  const autoMetrics = JSON.parse(await wire(nowClient, metrics({ countAuto: true })))
  await check('Metrics Auto count is omitted too', () => {
    assert.equal('count' in autoMetrics, false)
    assert.equal(autoMetrics.component_type, 'METRICS')
  })
  const refine = JSON.parse(await wire(nowClient, textBox({ countAuto: true, refine: true, replaceElementId: 'el-1' })))
  await check('refinement always replaces one element: count stays 1 even if Auto leaked in', () => {
    assert.equal(refine.count, 1)
    assert.equal(refine.refine, true)
  })
  const multi = JSON.parse(await wire(nowClient, textBox({ count: 3, compose: true, countAuto: false,
    elements: [1, 2, 3].map(n => ({ grid_position: { start_col: n, start_row: 4, position_width: 3, position_height: 6 } })) })))
  await check('an explicit multi-box choice still sends count, compose and one geometry per box', () => {
    assert.equal(multi.count, 3)
    assert.equal(multi.compose, true)
    assert.equal(multi.elements.length, 3)
  })
}

// ---------------------------------------------------------------------------
// 3. Real forms: control -> submitted form data -> wire body.
// ---------------------------------------------------------------------------
function formHarness({ file, component, flag, ref, extraEnv }) {
  const states = [], refs = [], effects = [], submitted = [], registered = []
  let cursor = 0, refCursor = 0
  const hooks = {
    ...React,
    useState(value) { const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] },
    useRef(value) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: value }; return refs[i] },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => { effects.push(fn) },
  }
  const l = loader({ flag, hooks, sourceOf: baseSource, extraEnv })
  const mod = l.load(file, ref)
  const props = { prompt: 'Five rollout steps for a regional AI forecasting launch', showAdvanced: true, presentationId: 'deck-1', isGenerating: false,
    slotCatalog: { slots: [{ slot_name: 'slide_title', label: 'Slide title', role: 'SLIDE_TITLE', kind: 'structural', supported: true }] }, slotCatalogLoading: false,
    registerMandatoryConfig: () => {}, registerSubmit: fn => registered.push(fn), onSubmit: value => submitted.push(value), onDraftChange: () => {},
    elementContext: { startCol: 2, startRow: 4, width: 28, height: 12 } }
  const render = () => { cursor = 0; refCursor = 0; effects.length = 0; return mod[component](props) }
  const submit = () => {
    const tree = render()
    const effect = effects.find(fn => fn.toString().includes('registerSubmit'))
    assert.ok(effect, 'registerSubmit effect')
    effect()
    registered.at(-1)()
    return { data: copy(submitted.at(-1)), tree }
  }
  // Run the first effect whose source contains `fragment` (the fake hooks never run effects on their own).
  const effect = fragment => {
    const fn = effects.find(candidate => candidate.toString().includes(fragment))
    assert.ok(fn, 'effect ' + fragment)
    fn()
  }
  return { render, submit, props, submitted, effect }
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return tree
  for (const child of React.Children.toArray(tree.props?.children)) { const found = find(child, predicate); if (found) return found }
  return null
}
// Stable structural dump of a rendered element tree (functions elided; empty slots and array nesting
// flattened like React does) to prove flag-off markup is unchanged.
function dumpChildren(children) {
  return React.Children.toArray(children).flatMap(child => {
    if (typeof child !== 'object') return [child]
    const { children: nested, ...props } = child.props ?? {}
    const clean = Object.fromEntries(Object.entries(props)
      .filter(([, value]) => typeof value !== 'function')
      .map(([key, value]) => [key, typeof value === 'object' && value !== null ? JSON.parse(JSON.stringify(value)) : value]))
    return [{ t: typeof child.type === 'string' ? child.type : (child.type?.name || 'component'), p: clean, c: dumpChildren(nested) }]
  })
}
const dump = tree => dumpChildren(tree)
function need(tree, predicate, what) { const node = find(tree, predicate); assert.ok(node, what); return node.props }
const optionValues = node => React.Children.toArray(node.props.children).map(child => String(child.props.value))
const byLabel = (tree, text) => {
  const label = find(tree, n => n.type === 'label' && React.Children.toArray(n.props.children).some(c => c?.type === 'span' && c.props.children === text))
  assert.ok(label, 'label ' + text)
  return need(label, n => n.type === 'select', 'select under ' + text)
}
const structureSelect = tree => need(tree, n => n.type === 'select' && optionValues(n).includes('SEQUENTIAL'), 'Body structure select')
const countSelect = tree => need(tree, n => n.props?.['aria-label'] === 'Text box count', 'Text box count')
const roleSelect = tree => need(tree, n => n.props?.id === 'textbox-role', 'role select')
const toggle = (tree, field) => need(tree, n => n.props?.field === field && typeof n.props.onChange === 'function', 'toggle ' + field)
const FORMS = {
  text: { file: 'components/generation-panel/forms/text-box-form.tsx', component: 'TextBoxForm' },
  metrics: { file: 'components/generation-panel/forms/metrics-form.tsx', component: 'MetricsForm' },
}
const make = (kind, flag, ref) => formHarness({ ...FORMS[kind], flag, ref })

// 3a. Flag off: the submitted form data and the wire body match the base commit for every interaction below.
const interactions = {
  'text: defaults': { kind: 'text', run: () => {} },
  'text: Sequential, 4 boxes, grid, colour, list style, simple leftovers': { kind: 'text', run(h) {
    let tree = h.render(); structureSelect(tree).onChange({ target: { value: 'SECTIONS' } })
    tree = h.render(); countSelect(tree).onChange({ target: { value: '4' } })
    tree = h.render(); byLabel(tree, 'Arrangement').onChange({ target: { value: 'grid' } })
    byLabel(tree, 'Box').onChange({ target: { value: 'colored' } })
    toggle(tree, 'list_style').onChange('list_style', 'numbered')
    tree = h.render(); byLabel(tree, 'Color').onChange({ target: { value: 'teal' } })
  } },
  'text: Slide title after Body-only choices': { kind: 'text', run(h) {
    let tree = h.render(); byLabel(tree, 'Box').onChange({ target: { value: 'colored' } })
    byLabel(tree, 'Style').onChange({ target: { value: 'colored-bg' } })
    toggle(tree, 'list_style').onChange('list_style', 'plain')
    need(tree, n => n.props?.['aria-label'] === 'Items per box', 'items per box').onChange({ target: { value: '3' } })
    roleSelect(tree).onChange({ target: { value: 'slot:slide_title' } })
  } },
  'metrics: defaults': { kind: 'metrics', run: () => {} },
  'metrics: 4 cards vertical, accent surface': { kind: 'metrics', run(h) {
    let tree = h.render(); need(tree, n => n.props?.['aria-label'] === 'Metric count', 'Metric count').onChange({ target: { value: '4' } })
    tree = h.render(); need(tree, n => n.props?.['aria-label'] === 'Metric surface', 'Metric surface').onChange({ target: { value: 'accent' } })
  } },
}
async function runInteraction(name, flag, ref, withTree = false) {
  const { kind, run } = interactions[name]
  const h = make(kind, flag, ref)
  h.render(); run(h)
  const { data, tree } = h.submit()
  return withTree ? { data, tree } : data
}
if (baseClient) {
  for (const name of Object.keys(interactions)) {
    const { data: before, tree: beforeTree } = await runInteraction(name, undefined, BASE_REF, true)
    const { data: after, tree: afterTree } = await runInteraction(name, undefined, undefined, true)
    assert.deepEqual(after, before, name + ' form data')
    assert.equal(JSON.stringify(dump(afterTree)), JSON.stringify(dump(beforeTree)), name + ' rendered markup')
    assert.equal(await wire(nowClient, after), await wire(baseClient, before), name + ' wire body')
    console.log('PASS flag off: ' + name + ' -> form data, rendered markup and wire body identical to base')
    checks++
  }
}

// 3b. Flag on.
{
  const defaults = await runInteraction('text: defaults', 'true')
  const body = JSON.parse(await wire(nowClientOn, defaults))
  await check('Text Box defaults send no count and no textbox_config (the prompt decides)', () => {
    assert.equal(defaults.countAuto, true)
    assert.equal(defaults.count, 1, 'local geometry still uses one box')
    assert.equal('count' in body, false)
    assert.equal('textbox_config' in body, false)
    assert.equal(body.semantic_role, 'BODY_TEXT')
    assert.equal(body.geometry_mode, 'AUTO')
    assert.equal(body.message.startsWith('Five rollout steps'), true)
  })

  const h = make('text', 'true'); let tree = h.render()
  await check('Count offers Auto first, then 1-6, and shows Auto by default', () => {
    const select = countSelect(tree)
    assert.equal(select.value, 'auto')
    assert.deepEqual(optionValues(find(tree, n => n.props === select)), ['auto', '1', '2', '3', '4', '5', '6'])
  })
  await check('flag on: a quick Boxes control sits beside Body structure and shares state with Advanced > Instances', () => {
    assert.ok(find(tree, n => n.type === 'span' && n.props.children === 'Boxes'), 'Boxes label')
    const quick = countSelect(tree), advanced = need(tree, n => n.props?.['aria-label'] === 'Advanced text box count', 'Advanced text box count')
    assert.equal(quick.value, 'auto')
    assert.equal(advanced.value, 'auto')
    advanced.onChange({ target: { value: '3' } })
    const after = h.render()
    assert.equal(countSelect(after).value, 3)
    assert.equal(need(after, n => n.props?.['aria-label'] === 'Advanced text box count', 'adv').value, 3)
    countSelect(after).onChange({ target: { value: 'auto' } })
    assert.equal(countSelect(h.render()).value, 'auto')
  })
  await check('flag off: only the original Advanced control exists, with its original label', () => {
    const off = make('text', undefined), offTree = off.render()
    assert.equal(find(offTree, n => n.props?.['aria-label'] === 'Advanced text box count'), null)
    assert.equal(find(offTree, n => n.type === 'span' && n.props.children === 'Boxes'), null)
    assert.equal(countSelect(offTree).value, 1)
    assert.deepEqual(optionValues(find(offTree, n => n.props?.['aria-label'] === 'Text box count')), ['1', '2', '3', '4', '5', '6'])
  })
  structureSelect(tree).onChange({ target: { value: 'SEQUENTIAL' } })
  tree = h.render(); countSelect(tree).onChange({ target: { value: '5' } })
  tree = h.render()
  const explicit = h.submit().data
  const explicitBody = JSON.parse(await wire(nowClientOn, explicit))
  await check('picking Sequential + 5 sends count 5, compose and five box geometries', () => {
    assert.equal(explicit.countAuto, undefined)
    assert.equal(explicitBody.count, 5)
    assert.equal(explicitBody.structure, 'SEQUENTIAL')
    assert.equal(explicitBody.compose, true)
    assert.equal(explicitBody.elements.length, 5)
    assert.equal(countSelect(tree).value, 5)
  })
  tree = h.render(); countSelect(tree).onChange({ target: { value: 'auto' } })
  const backToAuto = h.submit().data
  await check('choosing Auto again drops the count and the multi-box request', async () => {
    assert.equal(backToAuto.countAuto, true)
    assert.equal(backToAuto.count, 1)
    assert.equal(backToAuto.compose, false)
    assert.equal(backToAuto.elements, undefined)
    assert.equal(backToAuto.structure, 'SEQUENTIAL', 'the structure choice survives')
    assert.equal('count' in JSON.parse(await wire(nowClientOn, backToAuto)), false)
  })
}
{
  const withStyles = await runInteraction('text: Sequential, 4 boxes, grid, colour, list style, simple leftovers', 'true')
  const body = JSON.parse(await wire(nowClientOn, withStyles))
  await check('explicit four-box grid with colour and Numbers list sends the Text Service vocabulary', () => {
    assert.equal(body.count, 4)
    assert.equal(body.layout, 'grid')
    assert.equal(body.structure, 'SECTIONS')
    assert.equal(body.textbox_config.list_style, 'numbers')
    assert.equal(body.textbox_config.color_variant, 'teal')
    assert.equal(body.textbox_config.background, 'colored')
    assert.equal(body.elements.length, 4)
  })
  const slide = await runInteraction('text: Slide title after Body-only choices', 'true')
  const slideBody = JSON.parse(await wire(nowClientOn, slide))
  const legacy = await runInteraction('text: Slide title after Body-only choices', undefined)
  await check('a Slide title no longer inherits Body-only Surface, Title, List and Items choices', () => {
    assert.equal(slide.semanticRole, 'SLIDE_TITLE')
    assert.equal(slide.count, 1)
    assert.equal('count' in slideBody, true, 'single-instance roles keep an explicit count of 1')
    assert.equal('textbox_config' in slideBody, false)
    assert.equal('manual_geometry_overrides' in slideBody, false)
    assert.equal(slideBody.geometry_mode, 'AUTO')
    assert.equal(slide.layout, 'horizontal')
    assert.ok(legacy.textboxConfig.background === 'colored' && legacy.textboxConfig.list_style === 'plain', 'baseline still leaks (proves the test sees it)')
    assert.equal(legacy.manualGeometryOverrides.items_per_box, 3)
  })
}
{
  const defaults = await runInteraction('metrics: defaults', 'true')
  const body = JSON.parse(await wire(nowClientOn, defaults))
  await check('Metrics defaults send no count and no metrics_config, so "four KPIs" reaches Text Labs unforced', () => {
    assert.equal(defaults.countAuto, true)
    assert.equal(defaults.metricsConfig.layout, undefined)
    assert.equal('count' in body, false)
    assert.equal('metrics_config' in body, false)
    assert.equal(body.metrics_fit_mode, 'AUTO')
  })
  const h = make('metrics', 'true'); let tree = h.render()
  await check('Metric count offers Auto first and shows it by default', () => {
    const select = need(tree, n => n.props?.['aria-label'] === 'Metric count', 'Metric count')
    assert.equal(select.value, 'auto')
    assert.deepEqual(optionValues(find(tree, n => n.props === select)), ['auto', '1', '2', '3', '4'])
  })
  const four = await runInteraction('metrics: 4 cards vertical, accent surface', 'true')
  const fourBody = JSON.parse(await wire(nowClientOn, four))
  await check('an explicit four-card choice still sends count, compose, geometry and layout', () => {
    assert.equal(four.countAuto, undefined)
    assert.equal(fourBody.count, 4)
    assert.equal(fourBody.compose, true)
    assert.equal(fourBody.elements.length, 4)
    assert.equal(fourBody.metrics_config.color_scheme, 'accent')
    assert.ok(['horizontal', 'vertical', 'grid'].includes(fourBody.metrics_config.layout))
  })
}

// 3c. Saved configs and per-card refinement.
{
  const studio = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
  const reopen = (kind, generationConfig, flag = 'true') => {
    const h = formHarness({ ...FORMS[kind], flag, extraEnv: studio })
    h.props.existingTextTarget = { elementId: 'el-1', generationConfig }
    h.props.targetElementId = 'el-1'
    return h.render()
  }
  const label = { text: 'Text box count', metrics: 'Metric count' }
  for (const kind of ['text', 'metrics']) {
    await check(`${kind}: a saved explicit count reopens as that count, a pre-flag count of 1 as Auto, a pre-flag count above 1 as that count`, () => {
      const pick = tree => need(tree, n => n.props?.['aria-label'] === label[kind], label[kind]).value
      assert.equal(pick(reopen(kind, { count: 3, countAuto: false })), 3)
      assert.equal(pick(reopen(kind, { count: 1, countAuto: true })), 'auto')
      assert.equal(pick(reopen(kind, { count: 1 })), 'auto')
      assert.equal(pick(reopen(kind, { count: 2 })), 2)
      assert.equal(pick(reopen(kind, { count: 1, countAuto: false })), 1, 'an explicit single box stays explicit')
    })
    await check(`${kind}: flag off ignores the marker and keeps the numeric count`, () => {
      const pick = tree => need(tree, n => n.props?.['aria-label'] === label[kind], label[kind]).value
      assert.equal(pick(reopen(kind, { count: 1, countAuto: true }, 'false')), 1)
      assert.equal(pick(reopen(kind, { count: 3, countAuto: true }, 'false')), 3)
    })
  }
  const refineLib = loader({ flag: 'true' }).load('lib/metrics-card-refine-draft.ts')
  const normalized = copy(refineLib.normalizeMetricsCardRefineGenerationConfig({ componentType: 'METRICS', count: 4, countAuto: true, compose: true }, 'METRICS'))
  await check('a single generated metric card is never "Auto"', () => {
    assert.equal(normalized.count, 1)
    assert.equal(normalized.countAuto, false)
  })
  const untouched = copy(refineLib.normalizeMetricsCardRefineGenerationConfig({ componentType: 'METRICS', count: 4, compose: true }, 'METRICS'))
  await check('configs without the marker normalise exactly as before', () => {
    assert.equal('countAuto' in untouched, false)
  })
}

// 3d. Chat-invoked adds.
{
  const off = loader({ flag: undefined }).load('lib/mdc-element-directive.ts')
  const on = loader({ flag: 'true' }).load('lib/mdc-element-directive.ts')
  await check('chat-invoked Text Box / Metrics let the prompt decide the count (flag on only)', () => {
    for (const type of ['TEXT_BOX', 'METRICS']) {
      assert.equal(copy(off.buildFormDataForDirective(type, 'Four KPIs')).countAuto, undefined, type + ' off')
      assert.equal(copy(on.buildFormDataForDirective(type, 'Four KPIs')).countAuto, true, type + ' on')
    }
    assert.equal(copy(on.buildFormDataForDirective('TABLE', 'x')).countAuto, undefined)
  })
}

// 3e0. The Studio draft suites freeze these declarations against earlier commits; the flag must not touch them.
function declarationText(source, name) {
  const ast = ts.createSourceFile('form.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  ts.forEachChild(ast, function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node.getText(ast)
    ts.forEachChild(node, visit)
  })
  return found
}
if (baseSource(FORMS.text.file)) {
  for (const [kind, names] of [['text', ['handleSubmit', 'generationConfig', 'resolvedLayout', 'feasibleCounts', 'effectiveGeometry', 'updateManualOverride']], ['metrics', ['handleSubmit', 'generationConfig', 'sparseMetricsConfig', 'resolvedLayout']]]) {
    for (const name of names) {
      await check(`${kind} ${name} is byte-identical to the base commit`, () => {
        const before = declarationText(baseSource(FORMS[kind].file), name)
        assert.ok(before, name)
        assert.equal(declarationText(fs.readFileSync(new URL(FORMS[kind].file, root), 'utf8'), name), before)
      })
    }
  }
}

// 3e. The three request surfaces stay wired through the real source.
{
  const textSource = fs.readFileSync(new URL(FORMS.text.file, root), 'utf8')
  const clientSource = fs.readFileSync(new URL('lib/textlabs-client.ts', root), 'utf8')
  await check('source guards: flag read from one module, client omission excludes refinement', () => {
    assert.match(textSource, /from '@\/lib\/textbox-request-fidelity'/)
    assert.match(clientSource, /formData\.countAuto === true && !formData\.refine \? undefined : count/)
    assert.equal(/NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED/.test(textSource), false, 'forms never read the env var directly')
  })
  const env = fs.readFileSync(new URL('.env.example', root), 'utf8')
  await check('.env.example documents the flag as off', () => assert.match(env, /^NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED="false"$/m))
}


// ---------------------------------------------------------------------------
// 4. A6: PK rulings D2 (N cards = ONE element), D3 (the prompt's count is never overridden by Auto), D8 (Boxes stays in the main panel).
//    Contract: Text Labs MR !84 (backend/services/textbox_count.py): a typed family with `compose:true` + `elements[N]` is ONE typed element of
//    max(count, len(elements)) cards laid out as the panel arranged the boxes; cards above the family limit are clamped there with a warning.
// ---------------------------------------------------------------------------
const TYPED_LIMITS = { SEQUENTIAL: 6, COMPARISON: 4, SECTIONS: 5, CALLOUT: 2, TEXT_BULLETS: 4, BULLET_BOX: 4, NUMBERED_LIST: 4 } // !84 TYPED[*].cards_max
const PLAIN_STRUCTURES = ['auto', 'classic', 'vertical', 'mixed']
// Port of textbox_count._arrangement (!84): how Text Labs reads the panel's Arrangement back off `elements[].grid_position`.
function arrangementFromElements(elements) {
  const starts = []
  for (const element of elements ?? []) {
    const position = element?.grid_position
    if (!position || position.start_col == null || position.start_row == null) return null
    starts.push([position.start_col, position.start_row])
  }
  if (starts.length < 2) return null
  const columns = new Set(starts.map(([c]) => c)), rows = new Set(starts.map(([, r]) => r))
  if (rows.size === 1) return ['horizontal', null]
  if (columns.size === 1) return ['vertical', null]
  return ['grid', columns.size]
}
const textHarness = (flag, prompt) => { const h = make('text', flag); if (prompt) h.props.prompt = prompt; return h }
function pickStructure(h, value) { structureSelect(h.render()).onChange({ target: { value } }); return h.render() }
const optionNodes = node => React.Children.toArray(node.props.children)
const countOptions = tree => optionNodes(find(tree, n => n.props === countSelect(tree)))

for (const [family, limit] of Object.entries(TYPED_LIMITS)) {
  await check(`D2 ${family}: Boxes above ${limit} are not offered, the panel label becomes Cards`, () => {
    const h = textHarness('true'); const tree = pickStructure(h, family)
    const options = countOptions(tree)
    assert.deepEqual(options.map(o => String(o.props.value)), ['auto', '1', '2', '3', '4', '5', '6'])
    for (const option of options) {
      const value = Number(option.props.value)
      if (Number.isInteger(value) && value > limit) assert.equal(option.props.disabled, true, `${family} ${value} disabled`)
      if (Number.isInteger(value) && value <= limit) assert.equal(option.props.disabled === true && !String(option.props.children).includes('resize'), false, `${family} ${value} offered`)
    }
    assert.ok(find(tree, n => n.type === 'span' && n.props.children === 'Cards'), 'Cards label')
    assert.equal(find(tree, n => n.type === 'span' && n.props.children === 'Boxes'), null)
  })
  await check(`D2 ${family}: ${Math.min(limit, 4)} cards go out as ONE typed request (count, compose, one geometry per card, structure)`, async () => {
    const h = textHarness('true', 'Rollout plan for the forecasting launch')
    pickStructure(h, family); const n = Math.min(limit, 4)
    countSelect(h.render()).onChange({ target: { value: String(n) } })
    const { data } = h.submit()
    const body = JSON.parse(await wire(nowClientOn, data))
    assert.equal(data.cardsInOneElement, true)
    assert.equal(data.countAuto, undefined)
    assert.equal(body.count, n)
    assert.equal(body.compose, true)
    assert.equal(body.structure, family)
    assert.equal(body.elements.length, n)
    for (const element of body.elements) for (const key of ['start_col', 'start_row', 'position_width', 'position_height']) assert.equal(typeof element.grid_position[key], 'number', key)
    assert.equal('cardsInOneElement' in body || 'cards_in_one_element' in body, false, 'the marker is panel-only')
  })
}
await check('D2: the Arrangement the user picks is exactly what Text Labs reads back off elements[].grid_position', async () => {
  for (const [count, layout, cols, expected] of [[2, 'horizontal', null, ['horizontal', null]], [2, 'vertical', null, ['vertical', null]], [4, 'grid', '2', ['grid', 2]]]) {
    const h = textHarness('true'); pickStructure(h, 'BULLET_BOX')
    countSelect(h.render()).onChange({ target: { value: String(count) } })
    byLabel(h.render(), 'Arrangement').onChange({ target: { value: layout } })
    if (cols) byLabel(h.render(), 'Grid columns').onChange({ target: { value: cols } })
    const body = JSON.parse(await wire(nowClientOn, h.submit().data))
    assert.deepEqual(arrangementFromElements(body.elements), expected, `${count} ${layout}`)
    assert.equal(body.layout, layout)
  }
})
await check('D2: switching to a smaller family lowers a bigger count to what it holds; the same count on plain boxes is untouched', async () => {
  const h = textHarness('true'); pickStructure(h, 'auto')
  countSelect(h.render()).onChange({ target: { value: '5' } })
  assert.equal(countSelect(h.render()).value, 5)
  pickStructure(h, 'CALLOUT'); h.effect('setCount(typedCardLimit)')
  const callout = h.render()
  assert.equal(countSelect(callout).value, 2)
  const body = JSON.parse(await wire(nowClientOn, h.submit().data))
  assert.equal(body.count, 2); assert.equal(body.elements.length, 2); assert.equal(body.structure, 'CALLOUT')
  pickStructure(h, 'auto'); h.effect('setCount(typedCardLimit)')
  assert.equal(countSelect(h.render()).value, 2, 'plain boxes never raise a count on their own')
})
for (const structure of PLAIN_STRUCTURES) {
  await check(`D2: ${structure} stays several separate boxes (COMPOSE, 1-6), never one element of cards`, async () => {
    const h = textHarness('true'); if (structure !== 'auto') pickStructure(h, structure)
    countSelect(h.render()).onChange({ target: { value: '3' } })
    const { data } = h.submit()
    const body = JSON.parse(await wire(nowClientOn, data))
    assert.equal(data.cardsInOneElement, undefined)
    assert.equal(body.compose, true); assert.equal(body.count, 3); assert.equal(body.elements.length, 3)
    assert.equal(find(h.render(), n => n.type === 'span' && n.props.children === 'Cards'), null)
    const opts = countOptions(h.render()); assert.equal(opts.some(o => String(o.props.children).includes('max')), false)
  })
}
await check('D2 flag off: no caps, no clamp, no one-element marker (a Callout can still be asked for 5, as before)', async () => {
  const h = textHarness(undefined); pickStructure(h, 'CALLOUT')
  countSelect(h.render()).onChange({ target: { value: '5' } })
  h.effect('!feasibleCounts.includes(count)')
  const { data, tree } = h.submit()
  assert.equal(data.count, 5); assert.equal(data.cardsInOneElement, undefined)
  assert.equal(countOptions(tree).some(o => String(o.props.children).includes('max')), false)
  assert.equal(find(tree, n => n.type === 'span' && n.props.children === 'Cards'), null)
})
await check('D2 METRICS is not a typed family: several cards stay a COMPOSE of N cards', async () => {
  const h = make('metrics', 'true')
  need(h.render(), n => n.props?.['aria-label'] === 'Metric count', 'Metric count').onChange({ target: { value: '3' } })
  const { data } = h.submit(); const body = JSON.parse(await wire(nowClientOn, data))
  assert.equal(data.cardsInOneElement, undefined); assert.equal(body.compose, true); assert.equal(body.elements.length, 3)
})
await check('D2 placement: the single typed element returned for N cards is placed over the whole panel area (hook fallback), flag-marked only', () => {
  const hook = fs.readFileSync(new URL('hooks/use-textlabs-generation.ts', root), 'utf8')
  assert.match(hook, /formData\.cardsInOneElement\s*&&\s*elements\.length === 1\s*&&\s*formData\.positionConfig\s*\?\s*\{\s*start_col: formData\.positionConfig\.start_col,\s*start_row: formData\.positionConfig\.start_row,\s*position_width: formData\.positionConfig\.position_width,\s*position_height: formData\.positionConfig\.position_height,\s*\}\s*:\s*formElements\?\.\[index\]\?\.grid_position/)
  assert.equal((hook.match(/cardsInOneElement/g) ?? []).length, 1, 'only the placement fallback reads the marker')
  // Text Labs answers the one-element path with grid_position = the request's position_config (chat_routes.py `computed_position`), so the whole area is also what a current backend returns.
})

// D3: the prompt's own count is never overridden by a default, and the prompt always reaches Text Labs verbatim.
await check('D3: Auto never overrides a count typed in the prompt (typed family, plain box, Metrics): no count, no compose, no elements, prompt verbatim', async () => {
  for (const [structure, prompt] of [['SEQUENTIAL', 'Five rollout steps to launch the forecasting pilot'], ['COMPARISON', 'Compare three options for demand forecasting'], [null, 'Three key adoption risks for AI demand forecasting, one sentence each.']]) {
    const h = textHarness('true', prompt); if (structure) pickStructure(h, structure)
    const { data } = h.submit(); const body = JSON.parse(await wire(nowClientOn, data))
    assert.equal(body.message, prompt)
    assert.equal('count' in body, false, structure + ' count'); assert.equal(body.compose, false); assert.equal('elements' in body, false)
  }
  const m = make('metrics', 'true'); m.props.prompt = '4 KPIs: +15 pts accuracy, -30% stockouts, -12% waste, -8% cost'
  const body = JSON.parse(await wire(nowClientOn, m.submit().data))
  assert.equal(body.message, m.props.prompt); assert.equal('count' in body, false); assert.equal('metrics_config' in body, false)
})
await check('D3: an explicit Boxes choice is sent next to the unmodified prompt, so Text Labs sees both (count 1 is sent too)', async () => {
  const prompt = 'Five rollout steps to launch the forecasting pilot'
  const h = textHarness('true', prompt); pickStructure(h, 'SEQUENTIAL')
  countSelect(h.render()).onChange({ target: { value: '3' } })
  const body = JSON.parse(await wire(nowClientOn, h.submit().data))
  assert.equal(body.message, prompt); assert.equal(body.count, 3); assert.equal(body.elements.length, 3)
  countSelect(h.render()).onChange({ target: { value: '1' } })
  const one = JSON.parse(await wire(nowClientOn, h.submit().data))
  assert.equal(one.message, prompt); assert.equal(one.count, 1)
})

// D8: the Boxes control is in the main panel, not behind Advanced.
function ancestorsOf(tree, predicate, trail = []) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return trail
  for (const child of React.Children.toArray(tree.props?.children)) { const found = ancestorsOf(child, predicate, [...trail, tree]); if (found) return found }
  return null
}
await check('D8: Boxes is in the main panel: visible with Advanced closed, under no collapsible section, beside Body structure', () => {
  const h = textHarness('true'); h.props.showAdvanced = false
  const tree = h.render()
  const trail = ancestorsOf(tree, n => n.props?.['aria-label'] === 'Text box count')
  assert.ok(trail, 'Text box count is rendered with Advanced closed')
  assert.equal(trail.some(n => n.props && 'isOpen' in n.props), false, 'not inside a collapsible section')
  assert.equal(find(tree, n => n.props?.['aria-label'] === 'Advanced text box count'), null, 'Advanced > Instances is not rendered while Advanced is closed')
  const section = trail.find(n => n.type === 'section')
  assert.ok(section && find(section, n => n.type === 'select' && optionValues(n).includes('SEQUENTIAL')), 'same section as Body structure')
  assert.equal(countSelect(tree).value, 'auto')
})
await check('D8: Boxes follows the role (Body only) and the flag (off: not rendered)', () => {
  const h = textHarness('true'); h.props.showAdvanced = false
  roleSelect(h.render()).onChange({ target: { value: 'slot:slide_title' } })
  assert.equal(find(h.render(), n => n.props?.['aria-label'] === 'Text box count'), null)
  const off = textHarness(undefined); off.props.showAdvanced = false
  assert.equal(find(off.render(), n => n.props?.['aria-label'] === 'Text box count'), null)
})

// ---------------------------------------------------------------------------
// 5. ELEMENT-1 contract answers (Text Labs): (a) multi_box_color_mode is read only in the COMPOSE branch, so the seven typed
//    families neither show nor send it; (b) a Sequential element's per-box item count is its number of steps; (c) the
//    response `warnings` that say which count was honoured reach the user in plain words.
// ---------------------------------------------------------------------------
const multiBoxLabel = tree => find(tree, n => n.type === 'span' && n.props.children === 'Multi-box color style')
const typedFamilies = Object.keys(TYPED_LIMITS)

for (const family of typedFamilies) {
  await check(`E1a ${family}: Multi-box color style is hidden and multi_box_color_mode is not sent, even after a colour was picked on separate boxes`, async () => {
    const h = textHarness('true', 'Rollout plan for the forecasting launch')
    pickStructure(h, 'classic')
    countSelect(h.render()).onChange({ target: { value: '2' } })
    byLabel(h.render(), 'Multi-box color style').onChange({ target: { value: 'THEME_SEQUENCE' } })
    const plain = JSON.parse(await wire(nowClientOn, h.submit().data))
    assert.equal(plain.multi_box_color_mode, 'THEME_SEQUENCE', 'separate boxes still send the colour style')
    pickStructure(h, family)
    const n = Math.min(TYPED_LIMITS[family], 3)
    countSelect(h.render()).onChange({ target: { value: String(n) } })
    const { data, tree } = h.submit()
    assert.equal(multiBoxLabel(tree), null, 'control hidden')
    assert.equal(data.multiBoxColorMode, undefined)
    const body = JSON.parse(await wire(nowClientOn, data))
    assert.equal('multi_box_color_mode' in body || 'multiBoxColorMode' in body, false, 'not on the wire')
    assert.equal(body.compose, true); assert.equal(body.count, n); assert.equal(body.structure, family)
    assert.equal(body.elements.length, n, 'the card count and arrangement still travel')
    pickStructure(h, 'classic')
    assert.ok(multiBoxLabel(h.render()), 'back on separate boxes the control returns')
    assert.equal(byLabel(h.render(), 'Multi-box color style').value, 'THEME_SEQUENCE', 'the earlier choice is kept')
    assert.equal(JSON.parse(await wire(nowClientOn, h.submit().data)).multi_box_color_mode, 'THEME_SEQUENCE')
  })
}
for (const structure of PLAIN_STRUCTURES) {
  await check(`E1a ${structure}: separate boxes keep the Multi-box color style control and send it`, async () => {
    const h = textHarness('true'); if (structure !== 'auto') pickStructure(h, structure)
    countSelect(h.render()).onChange({ target: { value: '3' } })
    assert.ok(multiBoxLabel(h.render()))
    const body = JSON.parse(await wire(nowClientOn, h.submit().data))
    assert.equal(body.multi_box_color_mode, 'SAME')
  })
}
await check('E1a flag off: a typed family still shows and sends Multi-box color style, exactly as before', async () => {
  const h = textHarness(undefined, 'Rollout plan for the forecasting launch'); pickStructure(h, 'SEQUENTIAL')
  countSelect(h.render()).onChange({ target: { value: '3' } })
  assert.ok(multiBoxLabel(h.render()))
  const body = JSON.parse(await wire(nowClient, h.submit().data))
  assert.equal(body.multi_box_color_mode, 'SAME')
})
await check('E1a METRICS is not a typed family: its colour style is untouched', async () => {
  const h = make('metrics', 'true')
  need(h.render(), n => n.props?.['aria-label'] === 'Metric count', 'Metric count').onChange({ target: { value: '3' } })
  const body = JSON.parse(await wire(nowClientOn, h.submit().data))
  assert.equal(typeof body.multi_box_color_mode, 'string')
})

const itemsControl = (tree, label) => find(tree, n => n.props?.['aria-label'] === label)
const itemsCaption = (tree, text) => find(tree, n => n.type === 'span' && n.props.children === text && n.props.className?.includes('font-medium'))
await check('E1b Sequential: the per-box item count is labelled "Steps" (caption and control) and still sends items_per_box', async () => {
  const h = textHarness('true'); const tree = pickStructure(h, 'SEQUENTIAL')
  assert.ok(itemsCaption(tree, 'Steps'), 'Steps caption'); assert.equal(itemsCaption(tree, 'Items / Box'), null)
  assert.ok(itemsControl(tree, 'Steps')); assert.equal(itemsControl(tree, 'Items per box'), null)
  itemsControl(tree, 'Steps').props.onChange({ target: { value: '4' } })
  const { data } = h.submit()
  assert.equal(data.manualGeometryOverrides.items_per_box, 4)
  assert.equal(JSON.parse(await wire(nowClientOn, data)).manual_geometry_overrides.items_per_box, 4)
})
for (const structure of [...typedFamilies.filter(f => f !== 'SEQUENTIAL'), ...PLAIN_STRUCTURES, 'simple']) {
  await check(`E1b ${structure}: keeps "Items per box"`, () => {
    const h = textHarness('true'); if (structure !== 'auto') pickStructure(h, structure)
    const tree = h.render()
    assert.ok(itemsCaption(tree, 'Items / Box')); assert.ok(itemsControl(tree, 'Items per box'))
    assert.equal(itemsCaption(tree, 'Steps'), null); assert.equal(itemsControl(tree, 'Steps'), null)
  })
}
await check('E1b flag off: Sequential keeps "Items per box"', () => {
  const tree = pickStructure(textHarness(undefined), 'SEQUENTIAL')
  assert.ok(itemsCaption(tree, 'Items / Box')); assert.ok(itemsControl(tree, 'Items per box'))
  assert.equal(itemsCaption(tree, 'Steps'), null); assert.equal(itemsControl(tree, 'Steps'), null)
})

const notices = (warnings, facts = {}) => copy(libOn.textBoxResponseNotices(warnings, { componentType: 'TEXT_BOX', ...facts }))
await check('E1c notices: text_box_count_overridden says which count won, in plain words', () => {
  assert.deepEqual(notices(['text_box_count_overridden'], { structure: 'SEQUENTIAL', count: 3, elementsReturned: 5 }), ['Used 5 cards from your prompt instead of 3.'])
  assert.deepEqual(notices(['text_box_count_overridden'], { componentType: 'METRICS', count: 3, elementsReturned: 5 }), ['Used 5 cards from your prompt instead of 3.'])
  assert.deepEqual(notices(['text_box_count_overridden'], { count: 3, elementsReturned: 5 }), ['Used 5 boxes from your prompt instead of 3.'])
  assert.deepEqual(notices(['text_box_count_overridden'], { structure: 'CALLOUT', count: 2, elementsReturned: 1 }), ['Used the number of cards named in your prompt instead of the 2 you picked.'])
  assert.deepEqual(notices(['text_box_count_overridden'], { count: 1, countAuto: true, elementsReturned: 4 }), ['Used the number of boxes named in your prompt.'])
  assert.deepEqual(notices(['text_box_count_overridden'], { count: 3, elementsReturned: 3 }), ['Used the number of boxes named in your prompt instead of the 3 you picked.'])
})
await check('E1c notices: text_box_count_not_overridden says the panel choice was kept', () => {
  assert.deepEqual(notices(['text_box_count_not_overridden'], { structure: 'SEQUENTIAL', count: 3, elementsReturned: 1 }), ['Your prompt names a different number of cards, but the 3 you picked was kept.'])
  assert.deepEqual(notices(['text_box_count_not_overridden'], { count: 3, elementsReturned: 3 }), ['Your prompt names a different number of boxes, but the 3 you picked was kept.'])
  assert.deepEqual(notices(['text_box_count_not_overridden'], { count: 1, countAuto: true }), ['Your prompt names a different number of boxes, but the number picked in the panel was kept.'])
})
await check('E1c notices: codes with detail still match; repeats collapse; order is kept; unknown text_box_ codes get a plain note; unrelated warnings are not shown', () => {
  assert.deepEqual(notices(['text_box_count_overridden: requested=3 used=5', 'text_box_count_overridden'], { count: 3, elementsReturned: 5 }), ['Used 5 boxes from your prompt instead of 3.'])
  assert.deepEqual(notices(['text_box_count_not_overridden', 'text_box_count_overridden'], { count: 2, elementsReturned: 2 }).length, 2)
  assert.deepEqual(notices(['text_box_cards_clamped'], { count: 6 }), ['Note: cards clamped.'])
  for (const ignored of [undefined, null, 'text_box_count_overridden', {}, [], [''], [3, null, {}], ['chart_points_trimmed'], ['Some other service warning']]) {
    assert.deepEqual(notices(ignored, { count: 3 }), [], JSON.stringify(ignored) ?? 'undefined')
  }
})
await check('E1c wiring: the success toast carries the notices only behind the flag and only for Text Box / Metrics, from response.warnings', () => {
  const hook = fs.readFileSync(new URL('hooks/use-textlabs-generation.ts', root), 'utf8')
  assert.match(hook, /import \{ TEXTBOX_REQUEST_FIDELITY_ENABLED, textBoxResponseNotices \} from '@\/lib\/textbox-request-fidelity'/)
  assert.match(hook, /const countNotices = TEXTBOX_REQUEST_FIDELITY_ENABLED\s*&&\s*\(formData\.componentType === 'TEXT_BOX' \|\| formData\.componentType === 'METRICS'\)\s*\?\s*textBoxResponseNotices\(response\.warnings, \{[^}]*countAuto: formData\.countAuto,[^}]*elementsReturned: elements\.length,\s*\}, response\.warning_details\)\s*:\s*\[\]/)
  assert.match(hook, /title: refineContext \? 'Element refined' : 'Element generated',\s*description: \(refineContext\s*\?\s*`\$\{formData\.componentType\.replace\(\/_\/g, ' '\)\} updated on slide`\s*:\s*`\$\{formData\.componentType\.replace\(\/_\/g, ' '\)\} added to slide`\)\s*\+ \(countNotices\.length > 0 \? `\. \$\{countNotices\.join\(' '\)\}` : ''\)/)
  assert.equal((hook.match(/textBoxResponseNotices\(/g) ?? []).length, 1)
  // With no notice (flag off, or no warning) the description is exactly the old string.
  const none = []
  assert.equal(`TEXT BOX added to slide` + (none.length > 0 ? `. ${none.join(' ')}` : ''), 'TEXT BOX added to slide')
  assert.equal(`TEXT BOX added to slide` + `. ${['Used 5 cards from your prompt instead of 3.'].join(' ')}`, 'TEXT BOX added to slide. Used 5 cards from your prompt instead of 3.')
})

// ---------------------------------------------------------------------------
// 6. warning_details (Text Labs TL_TEXTBOX_COUNT_ALL_TYPES_ENABLED): real numbers in the notices. Read first; the `warnings`
//    strings are the fallback and are read for their own numbers; a string that gives none keeps the generic words.
// ---------------------------------------------------------------------------
const noticesWith = (warnings, details, facts = {}) => copy(libOn.textBoxResponseNotices(warnings, { componentType: 'TEXT_BOX', ...facts }, details))
// the strings Text Labs writes (text-labs tests/test_textbox_count_all_types.py, test_warning_details_read_each_warning)
const TL_STRINGS = {
  overridden: "text_box_count_overridden: the prompt asks for 5 sequential cards, the panel's count of 3 was overridden; 5 used",
  overriddenClamped: "text_box_count_overridden: the prompt asks for 7 sequential cards, the panel's count of 3 was overridden; 6 used",
  notOverridden: "text_box_count_not_overridden: the prompt asks for 5 boxes, the area is too small for 5; the panel's 3 kept",
  boxClamped: 'text_box_count_clamped: asked 9 metric cards, one request holds at most 6; 6 used',
  itemsClamped: 'stated_item_count_clamped: asked 5 items, a bullet_box card fits 3; 3 used',
  itemsClampedBox: 'stated_item_count_clamped: box 1 asked 6 items, a text box holds at most 4; 4 used',
  unmet: 'stated_item_count_unmet: asked 4 items, planned 4, 3 rendered (x)',
  unmetBox: 'stated_item_count_unmet: box 0 asked 4 items, planned 4, 3 rendered (x)',
  reduced: 'item_count_reduced: asked 4 items, the box kept 3 (a longer text would not fit); 3 used',
  unsatisfied: 'stated_item_count_unsatisfied: the bullet_box card could not hold 2 items; generated without',
}
const detail = (code, requested, used, panel = null, box) => ({ code, requested, used, panel, ...(box === undefined ? {} : { box }) })

await check('F1 details: text_box_count_overridden names the count used and the count the user picked', () => {
  assert.deepEqual(noticesWith(['text_box_count_overridden'], [detail('text_box_count_overridden', 5, 5, 3)], { structure: 'SEQUENTIAL', count: 3, elementsReturned: 1 }),
    ['Used 5 cards from your prompt instead of the 3 you picked.'])
  assert.deepEqual(noticesWith(['text_box_count_overridden'], [detail('text_box_count_overridden', 3, 3, 2)], { count: 2, elementsReturned: 3 }),
    ['Used 3 boxes from your prompt instead of the 2 you picked.'])
  assert.deepEqual(noticesWith(['text_box_count_overridden'], [detail('text_box_count_overridden', 4, 4, 2)], { componentType: 'METRICS', count: 2 }),
    ['Used 4 cards from your prompt instead of the 2 you picked.'])
  // the number used wins over the number asked for (the prompt said 7, the family holds 6)
  assert.deepEqual(noticesWith([], [detail('text_box_count_overridden', 7, 6, 3)], { structure: 'SEQUENTIAL' }), ['Used 6 cards from your prompt instead of the 3 you picked.'])
  // no panel number in the entry: the panel's own count, unless it was Auto or is the number used
  assert.deepEqual(noticesWith([], [detail('text_box_count_overridden', 5, 5, null)], { structure: 'SEQUENTIAL', count: 3 }), ['Used 5 cards from your prompt instead of the 3 you picked.'])
  assert.deepEqual(noticesWith([], [detail('text_box_count_overridden', 5, 5, null)], { structure: 'SEQUENTIAL', count: 1, countAuto: true }), ['Used 5 cards from your prompt.'])
  assert.deepEqual(noticesWith([], [detail('text_box_count_overridden', 6, 6, 6)], { structure: 'SEQUENTIAL' }), ['Used 6 cards from your prompt.'])
  assert.deepEqual(noticesWith([], [detail('text_box_count_overridden', 1, 1, 3)], { count: 3 }), ['Used 1 box from your prompt instead of the 3 you picked.'])
})
await check('F1 details: text_box_count_not_overridden says what the area fits and what was kept', () => {
  assert.deepEqual(noticesWith(['text_box_count_not_overridden'], [detail('text_box_count_not_overridden', 5, 3, 3)], { count: 3 }),
    ['The area fits 3 boxes, so your 3 were kept instead of 5.'])
  assert.deepEqual(noticesWith([], [detail('text_box_count_not_overridden', 5, 2, 2)], { structure: 'SEQUENTIAL' }), ['The area fits 2 cards, so your 2 were kept instead of 5.'])
  assert.deepEqual(noticesWith([], [detail('text_box_count_not_overridden', 3, 1, 1)], {}), ['The area fits 1 box, so your 1 was kept instead of 3.'])
  assert.deepEqual(noticesWith([], [detail('text_box_count_not_overridden', 5, 3, null)], {}), ['The area fits 3 boxes, so your 3 were kept instead of 5.'])
})
await check('F1 details: item counts name the box (0-based from the Text Service, 1-based for the user) and what fits', () => {
  assert.deepEqual(noticesWith([], [detail('stated_item_count_clamped', 6, 4, null, 1)], {}), ['Box 2 fits 4 items, so 4 were used instead of 6.'])
  assert.deepEqual(noticesWith([], [detail('stated_item_count_clamped', 8, 5, null, 0)], {}), ['Box 1 fits 5 items, so 5 were used instead of 8.'])
  assert.deepEqual(noticesWith([], [detail('stated_item_count_clamped', 5, 3)], {}), ['The box fits 3 items, so 3 were used instead of 5.'])
  assert.deepEqual(noticesWith([], [detail('stated_item_count_clamped', 5, 3)], { structure: 'BULLET_BOX' }), ['The card fits 3 items, so 3 were used instead of 5.'])
  assert.deepEqual(noticesWith([], [detail('item_count_reduced', 4, 3)], {}), ['The box fits 3 items, so 3 were used instead of 4.'])
  assert.deepEqual(noticesWith([], [detail('stated_item_count_unmet', 4, 3, null, 2)], {}), ['Box 3 fits 3 items, so 3 were used instead of 4.'])
  assert.deepEqual(noticesWith([], [detail('item_count_reduced', 3, 1)], {}), ['The box fits 1 item, so 1 was used instead of 3.'])
})
await check('F1 details: clamped counts and unsatisfied item counts', () => {
  assert.deepEqual(noticesWith([], [detail('text_box_count_clamped', 9, 6)], { componentType: 'METRICS' }), ['Used 6 cards instead of the 9 in your prompt, the most that fit.'])
  assert.deepEqual(noticesWith([], [detail('stated_item_count_unsatisfied', 2, null, null)], { structure: 'BULLET_BOX' }), ['The card could not hold 2 items, so it was made without that count.'])
  assert.deepEqual(noticesWith([], [detail('stated_item_count_unsatisfied', 3, null, null, 1)], {}), ['Box 2 could not hold 3 items, so it was made without that count.'])
})
await check('F1 details are read first: an entry takes the place of the warnings string with its code; order follows warnings; the rest follow', () => {
  const both = noticesWith([TL_STRINGS.overridden, TL_STRINGS.itemsClamped],
    [detail('stated_item_count_clamped', 5, 3), detail('text_box_count_overridden', 5, 5, 3)], { structure: 'SEQUENTIAL', count: 3 })
  assert.deepEqual(both, ['Used 5 cards from your prompt instead of the 3 you picked.', 'The card fits 3 items, so 3 were used instead of 5.'])
  // the entry's numbers beat the string's (an entry is Text Labs' own reading)
  assert.deepEqual(noticesWith([TL_STRINGS.overridden], [detail('text_box_count_overridden', 4, 4, 2)], { structure: 'SEQUENTIAL' }), ['Used 4 cards from your prompt instead of the 2 you picked.'])
  // an entry with no matching string still shows; a string with no entry is read for its own numbers
  assert.deepEqual(noticesWith([TL_STRINGS.reduced], [detail('stated_item_count_clamped', 6, 4, null, 1)], {}),
    ['The box fits 3 items, so 3 were used instead of 4.', 'Box 2 fits 4 items, so 4 were used instead of 6.'])
  // details alone (no warnings array) are enough
  assert.deepEqual(noticesWith(undefined, [detail('text_box_count_not_overridden', 5, 3, 3)], {}), ['The area fits 3 boxes, so your 3 were kept instead of 5.'])
  // two entries of one code pair with two strings of that code, one each
  assert.deepEqual(noticesWith([TL_STRINGS.itemsClampedBox, TL_STRINGS.itemsClampedBox], [detail('stated_item_count_clamped', 6, 4, null, 1), detail('stated_item_count_clamped', 9, 5, null, 2)], {}),
    ['Box 2 fits 4 items, so 4 were used instead of 6.', 'Box 3 fits 5 items, so 5 were used instead of 9.'])
})
await check('F1 unusable entries are ignored; an entry without numbers keeps the generic words of its code', () => {
  for (const junk of [undefined, null, [], {}, 'text_box_count_overridden', 7, [null, 3, 'x', [], {}, { code: 7 }, { code: '' }, { requested: 3, used: 3 }]]) {
    assert.deepEqual(noticesWith(['text_box_count_overridden'], junk, { count: 3, elementsReturned: 5 }), ['Used 5 boxes from your prompt instead of 3.'], JSON.stringify(junk) ?? 'undefined')
  }
  assert.deepEqual(noticesWith([], [{ code: 'text_box_count_overridden', requested: 'many', used: 0, panel: -1 }], { count: 3, elementsReturned: 5 }), ['Used 5 boxes from your prompt instead of 3.'])
  assert.deepEqual(noticesWith([], [{ code: 'text_box_count_not_overridden', requested: 5, used: null, panel: null }], { count: 3 }), ['Your prompt names a different number of boxes, but the 3 you picked was kept.'])
  assert.deepEqual(noticesWith([], [{ code: 'text_box_count_not_overridden', requested: null, used: 3, panel: 3 }], { count: 4 }), ['Your prompt names a different number of boxes, but the 4 you picked was kept.'])
  assert.deepEqual(noticesWith([], [{ code: ' TEXT_BOX_Count_Overridden', requested: 5, used: 5, panel: 3 }], { structure: 'SEQUENTIAL' }), ['Used 5 cards from your prompt instead of the 3 you picked.'], 'codes are matched without case or padding')
  // an item-count entry without both numbers says nothing (it has no generic words), and codes that are not count warnings say nothing
  assert.deepEqual(noticesWith([], [detail('stated_item_count_clamped', 5, null), detail('item_count_reduced', null, 3), detail('chart_points_trimmed', 9, 6)], {}), [])
  assert.deepEqual(noticesWith([], [{ code: 'text_box_cards_clamped', requested: 9, used: 6, panel: null }], {}), ['Note: cards clamped.'])
  // a negative or fractional box index is not a box
  assert.deepEqual(noticesWith([], [{ code: 'stated_item_count_clamped', requested: 6, used: 4, panel: null, box: -1 }, { code: 'item_count_reduced', requested: 6, used: 4, panel: null, box: 1.5 }], {}), ['The box fits 4 items, so 4 were used instead of 6.'])
})
await check('F2 fallback: a warnings string with numbers gives the same real-number sentences (code = text before the first ":")', () => {
  const facts = { structure: 'SEQUENTIAL', count: 3, elementsReturned: 1 }
  assert.deepEqual(noticesWith([TL_STRINGS.overridden], undefined, facts), ['Used 5 cards from your prompt instead of the 3 you picked.'])
  assert.deepEqual(noticesWith([TL_STRINGS.overriddenClamped], undefined, facts), ['Used 6 cards from your prompt instead of the 3 you picked.'])
  assert.deepEqual(noticesWith([TL_STRINGS.notOverridden], undefined, { count: 3 }), ['The area fits 3 boxes, so your 3 were kept instead of 5.'])
  assert.deepEqual(noticesWith([TL_STRINGS.boxClamped], undefined, { componentType: 'METRICS' }), ['Used 6 cards instead of the 9 in your prompt, the most that fit.'])
  assert.deepEqual(noticesWith([TL_STRINGS.itemsClamped], undefined, { structure: 'BULLET_BOX' }), ['The card fits 3 items, so 3 were used instead of 5.'])
  assert.deepEqual(noticesWith([TL_STRINGS.itemsClampedBox], undefined, {}), ['Box 2 fits 4 items, so 4 were used instead of 6.'])
  assert.deepEqual(noticesWith([TL_STRINGS.unmet], undefined, {}), ['The box fits 3 items, so 3 were used instead of 4.'])
  assert.deepEqual(noticesWith([TL_STRINGS.unmetBox], undefined, {}), ['Box 1 fits 3 items, so 3 were used instead of 4.'])
  assert.deepEqual(noticesWith([TL_STRINGS.reduced], undefined, {}), ['The box fits 3 items, so 3 were used instead of 4.'])
  // its words ("could not hold 2 items") have no "asks for" / "asked": only warning_details can say it
  assert.deepEqual(noticesWith([TL_STRINGS.unsatisfied], undefined, { structure: 'BULLET_BOX' }), [])
  assert.deepEqual(noticesWith([TL_STRINGS.unsatisfied], [detail('stated_item_count_unsatisfied', 2, null)], { structure: 'BULLET_BOX' }), ['The card could not hold 2 items, so it was made without that count.'])
  // "used" before "kept"; "kept" alone is the count kept; the number asked for is the first integer after "asks for" / "asked"
  assert.deepEqual(noticesWith(['text_box_count_not_overridden: the prompt asks for 6 boxes (not 4); the panel\'s 2 kept'], undefined, {}), ['The area fits 2 boxes, so your 2 were kept instead of 6.'])
  assert.deepEqual(noticesWith(['stated_item_count_clamped: asked 8 items, a box holds 5, not 7; 5 used'], undefined, {}), ['The box fits 5 items, so 5 were used instead of 8.'])
  assert.deepEqual(noticesWith(['item_count_reduced: asked 5 items, the box kept 4 (a longer text would not fit); 3 used'], undefined, {}), ['The box fits 3 items, so 3 were used instead of 5.'])
  assert.deepEqual(noticesWith(['text_box_count_not_overridden: the prompt asks for 6 boxes; the panel\'s 2 kept, 3 used'], undefined, {}), ['The area fits 3 boxes, so your 3 were kept instead of 6.'], '"N used" wins over "N kept"')
  assert.deepEqual(noticesWith([TL_STRINGS.overridden], undefined, { structure: 'SEQUENTIAL', count: 2 }), ['Used 5 cards from your prompt instead of the 3 you picked.'], 'the panel count the warning names beats the form\'s')
})
await check('F2 fallback: a string whose numbers cannot be read keeps the current generic words (and item-count codes then say nothing)', () => {
  const facts = { count: 3, elementsReturned: 5 }
  for (const garbled of ['text_box_count_overridden', 'text_box_count_overridden: requested=3 used=5', 'text_box_count_overridden: garbled', 'text_box_count_overridden: the prompt asks for 3 boxes',
    'text_box_count_overridden: 3 used', 'TEXT_BOX_COUNT_OVERRIDDEN: asks for many boxes; many used', 'text_box_count_overridden (requested 3, used 5)']) {
    assert.deepEqual(noticesWith([garbled], undefined, facts), ['Used 5 boxes from your prompt instead of 3.'], garbled)
  }
  assert.deepEqual(noticesWith(['text_box_count_not_overridden: area too small'], undefined, { count: 3 }), ['Your prompt names a different number of boxes, but the 3 you picked was kept.'])
  assert.deepEqual(noticesWith(['text_box_count_clamped: asked many'], undefined, {}), ['Note: count clamped.'])
  for (const silent of ['item_count_reduced: asked many', 'stated_item_count_clamped: asked 5 items', 'stated_item_count_clamped', 'stated_item_count_unmet: planned 4, 3 rendered', 'stated_item_count_unsatisfied: could not hold items']) {
    assert.deepEqual(noticesWith([silent], undefined, {}), [], silent)
  }
})
await check('F3 without warning_details the notices are exactly what they were (flag-on prior behaviour)', () => {
  const cases = [
    [['text_box_count_overridden'], { structure: 'SEQUENTIAL', count: 3, elementsReturned: 5 }],
    [['text_box_count_overridden'], { count: 1, countAuto: true, elementsReturned: 4 }],
    [['text_box_count_not_overridden'], { count: 3, elementsReturned: 3 }],
    [['text_box_count_overridden: requested=3 used=5', 'text_box_count_overridden'], { count: 3, elementsReturned: 5 }],
    [['text_box_cards_clamped'], { count: 6 }],
    [['Some other service warning', 'chart_points_trimmed', '', 4, null], { count: 3 }],
  ]
  for (const [warnings, facts] of cases) {
    const bare = copy(libOn.textBoxResponseNotices(warnings, { componentType: 'TEXT_BOX', ...facts }))
    for (const absent of [undefined, null, [], {}]) assert.deepEqual(noticesWith(warnings, absent, facts), bare, JSON.stringify(absent) ?? 'undefined')
  }
  assert.deepEqual(noticesWith(undefined, undefined, { count: 3 }), []); assert.deepEqual(noticesWith([], [], { count: 3 }), [])
})
await check('F4 end to end: the Text Labs client hands warning_details back untouched, and the notices read it', async () => {
  const client = clientFor({ flag: 'true' })
  const reply = {
    success: true,
    elements: [],
    warnings: [TL_STRINGS.overridden],
    warning_details: [detail('text_box_count_overridden', 5, 5, 3)],
  }
  client.capture.reply = reply
  const sent = client.mod.buildApiPayload('session-1', copy(textBox({ count: 3 })))
  const response = await client.mod.sendMessage('session-1', sent.message, sent.options)
  assert.deepEqual(copy(response.warning_details), reply.warning_details)
  assert.deepEqual(copy(response.warnings), reply.warnings)
  assert.deepEqual(copy(libOn.textBoxResponseNotices(response.warnings, { componentType: 'TEXT_BOX', structure: 'SEQUENTIAL', count: 3, elementsReturned: 1 }, response.warning_details)),
    ['Used 5 cards from your prompt instead of the 3 you picked.'])
  // a response without the field (Text Labs flag off, or no count warning) has none to read
  const quiet = clientFor({ flag: 'true' }); quiet.capture.reply = { success: true, elements: [], warnings: [TL_STRINGS.overridden] }
  const again = quiet.mod.buildApiPayload('session-1', copy(textBox({ count: 3 })))
  assert.equal('warning_details' in await quiet.mod.sendMessage('session-1', again.message, again.options), false)
})
await check('F5 wiring: the hook gives the toast the response\'s warning_details, only behind the flag; the response type names the field', () => {
  const hook = fs.readFileSync(new URL('hooks/use-textlabs-generation.ts', root), 'utf8')
  assert.match(hook, /\? textBoxResponseNotices\(response\.warnings, \{[^}]*\}, response\.warning_details\)\s*:\s*\[\]/)
  assert.equal((hook.match(/warning_details/g) ?? []).length, 2, 'one comment, one argument')
  assert.match(hook, /const countNotices = TEXTBOX_REQUEST_FIDELITY_ENABLED\s*&&/)
  const types = fs.readFileSync(new URL('types/textlabs.ts', root), 'utf8')
  assert.match(types, /export interface TextLabsWarningDetail \{\s*code: string\s*requested\?: number \| null\s*used\?: number \| null\s*panel\?: number \| null\s*box\?: number\s*\}/)
  assert.match(types, /warning_details\?: TextLabsWarningDetail\[\]/)
  const lib = fs.readFileSync(new URL('lib/textbox-request-fidelity.ts', root), 'utf8')
  assert.doesNotMatch(lib, /^import /m, 'the lib stays import-free')
})

console.log(`\n${checks} checks passed`)
