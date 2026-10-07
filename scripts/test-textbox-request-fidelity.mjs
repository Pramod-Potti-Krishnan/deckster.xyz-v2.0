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
  const capture = { requests: [] }
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
        return { ok: true, headers: { get: () => null }, json: async () => ({ success: true, elements: [] }) }
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
  return { render, submit, props, submitted }
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

console.log(`\n${checks} checks passed`)
