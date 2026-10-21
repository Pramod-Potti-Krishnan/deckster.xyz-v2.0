// KNOWLEDGE-MAP-TOOLBAR: the Second Brain map's controls as the accepted mock draws them (flag NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR, exact "true", Studio controls only,
// default off). Card PASS2-J6-FINDINGS finding L6 (streams/ops/PASS2/J6/RUN.md section 2); mock design/studio-v4-mockup/components/knowledge-map.tsx (`km-map-controls`).
// Offline and self-contained apart from one `git show` of the base's kg-graph-view.tsx (the repository needs that commit; KNOWLEDGE_MAP_TOOLBAR_BASE=<commit> picks another).
// Run: node scripts/test-studio-knowledge-map-toolbar.mjs
//   helper     lib/studio-knowledge-map-toolbar.ts on its own (import-free): the fit scale (checked against fitGraph's own lines), the readout, what the toolbar draws;
//   toolbar    components/knowledge/studio-knowledge-map-toolbar.tsx rendered: its buttons, labels and states, and what each press hands on;
//   graph      the REAL components/knowledge/kg-graph-view.tsx. Flag off: its markup is the base file's byte for byte (static render, 2 profiles x 6 views). Flag on, run through a
//              small hooks runtime: it opens at 100% (the readout is the fitted view), zoom in/out read 120% / 83%, "Reset map" fits again, "Focus entity" exists only with a
//              selection, "Fit graph" and "Reset graph view" are not drawn; flag off, the same run reads the raw scale (what it said before);
//   source     the flag is read once (exact "true", AND the Studio controls), the toolbar is the flag-on branch of one ternary, the old toolbar is the other branch;
//   css        every rule of the new stylesheet hangs on data-studio-graph-toolbar-kind, which exists only with the flag on.
// Then every layer re-runs against deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
let root = here
while (!fs.existsSync(path.join(root, 'package.json'))) {
  const parent = path.dirname(root)
  assert.notEqual(parent, root, 'no package.json above this script')
  root = parent
}
const requireOwn = createRequire(path.join(root, 'package.json'))
const ts = requireOwn('typescript')
const React = requireOwn('react')
const { renderToStaticMarkup } = requireOwn('react-dom/server')
const realJsx = requireOwn('react/jsx-runtime')

const BASE = process.env.KNOWLEDGE_MAP_TOOLBAR_BASE || 'fbc77c0430099ec7e11a188307ee5521b6937719'
const HELPER = 'lib/studio-knowledge-map-toolbar.ts'
const TOOLBAR = 'components/knowledge/studio-knowledge-map-toolbar.tsx'
const GRAPH = 'components/knowledge/kg-graph-view.tsx'
const CSS = 'components/knowledge/studio-knowledge-map-toolbar.css'
const FLAG = 'NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const baseGraph = execFileSync('git', ['show', `${BASE}:${GRAPH}`], { cwd: root, encoding: 'utf8' })

class MutationTargetMissing extends Error {}
const mutate = (source, edits, label) => edits.reduce((text, [from, to]) => {
  if (!text.includes(from)) throw new MutationTargetMissing(`mutation target missing in ${label}: ${from.slice(0, 70)}`)
  return text.replace(from, to)
}, source)

function transpile(source, fileName) {
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  assert.deepEqual((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [], `${fileName} transpiles`)
  return out.outputText
}
const iconStub = new Proxy({}, { get: (_, key) => { const Icon = props => React.createElement('svg', { 'data-icon': String(key), className: props.className }); Icon.iconName = String(key); return Icon } })

/** Loads the modules of `sources` (rel path -> text) that the first one pulls in; everything else it imports is a stub. */
function loadModule(entry, sources, { react = React, jsx = realJsx, env = {} } = {}) {
  const cache = new Map()
  const resolve = (spec, from) => {
    const rel = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(from), spec)
    return [rel, `${rel}.ts`, `${rel}.tsx`].find(candidate => candidate in sources)
  }
  const run = rel => {
    if (cache.has(rel)) return cache.get(rel)
    const mod = { exports: {} }
    cache.set(rel, mod.exports)
    const req = spec => {
      if (spec === 'react') return react
      if (spec === 'react/jsx-runtime') return jsx
      if (spec === 'lucide-react') return iconStub
      if (spec.endsWith('.css')) return {}
      const target = resolve(spec, rel)
      if (target) return run(target)
      throw new Error(`unexpected import ${spec} from ${rel}`)
    }
    vm.runInNewContext(transpile(sources[rel], rel), { module: mod, exports: mod.exports, require: req, Intl, Math, process: { env } })
    cache.set(rel, mod.exports)
    return mod.exports
  }
  return run(entry)
}

let checks = 0
const check = (fn, ...args) => { fn(...args); checks++ }
const plain = value => JSON.parse(JSON.stringify(value))
const deq = (actual, expected, message) => check(assert.deepStrictEqual, plain(actual), plain(expected), message)

// ---- helper ---------------------------------------------------------------------------------------------------------------------------------
function helperChecks(h, graphSource) {
  // the constants and the formula are the ones fitGraph() uses (a drift here would make "100%" a lie)
  check(assert.equal, h.MIN_SCALE, Number(/const MIN_SCALE = ([\d.]+)/.exec(graphSource)[1]), 'MIN_SCALE is the map\'s')
  check(assert.equal, h.MAX_SCALE, Number(/const MAX_SCALE = ([\d.]+)/.exec(graphSource)[1]), 'MAX_SCALE is the map\'s')
  for (const line of ['const minX = Math.min(...layout.map((point) => point.x - point.r))', 'const maxX = Math.max(...layout.map((point) => point.x + point.r))',
    'const minY = Math.min(...layout.map((point) => point.y - point.r - 24))', 'const maxY = Math.max(...layout.map((point) => point.y + point.r))',
    'const graphWidth = Math.max(maxX - minX, 1)', 'const graphHeight = Math.max(maxY - minY, 1)', 'Math.min(MAX_SCALE, Math.min((width - 80) / graphWidth, (height - 80) / graphHeight))']) {
    check(assert.ok, graphSource.includes(line), `fitGraph still reads: ${line}`)
  }
  const near = (actual, expected, message) => check(assert.ok, Math.abs(actual - expected) < 1e-9, `${message}: ${actual} vs ${expected}`)
  // the fit scale, worked by hand: a graph 400 wide x 300 tall (minY includes 24 for the label) in 960x610 -> min(880/400, 530/300)
  near(h.knowledgeFitScale([{ x: 100, y: 100, r: 10 }, { x: 480, y: 250, r: 10 }], 960, 610), Math.min(880 / 400, 530 / (250 + 10 - (100 - 10 - 24))), 'two points')
  near(h.knowledgeFitScale([{ x: 480, y: 305, r: 10 }], 960, 610), 3.5, 'one point is capped at MAX_SCALE')
  near(h.knowledgeFitScale([{ x: 0, y: 0, r: 5 }, { x: 5000, y: 5000, r: 5 }], 960, 610), 0.45, 'a huge graph is floored at MIN_SCALE')
  near(h.knowledgeFitScale([{ x: 100, y: 100, r: 10 }, { x: 600, y: 100, r: 10 }], 960, 610), Math.min(880 / 520, 530 / 44), 'a flat graph: the height is the label room and the radii')
  near(h.knowledgeFitScale([{ x: 100, y: 100, r: 10 }, { x: 600, y: 400, r: 20 }], 500, 800), Math.min(420 / 530, 720 / (420 - 66)), 'another panel')
  near(h.knowledgeFitScale([{ x: 50, y: 50, r: 0 }, { x: 50, y: 50, r: 0 }], 960, 610), 3.5, 'coincident points: a size of at least 1')
  for (const none of [[], undefined, null]) near(h.knowledgeFitScale(none, 960, 610), 1, 'no points')
  near(h.knowledgeFitScale([{ x: 50, y: 50, r: 0 }, { x: 50, y: 50, r: 0 }], 80.5, 610), 0.5, 'coincident points in a narrow panel: the width of 1, not 0')

  // the readout
  check(assert.equal, h.zoomPercent(1.9, 1.9), 100, 'the fitted view reads 100%')
  check(assert.equal, h.zoomPercent(1.9 * 1.2, 1.9), 120)
  check(assert.equal, h.zoomPercent(1.9 / 1.2, 1.9), 83)
  check(assert.equal, h.zoomPercent(1.9 * 1.2 * 1.2, 1.9), 144)
  check(assert.equal, h.zoomPercent(1, 1), 100)
  check(assert.equal, h.zoomPercent(3.5, 1), 350, 'a fit of 1 reads the raw scale')
  check(assert.equal, h.zoomPercent(0.45, 1.9), 24)
  check(assert.equal, h.zoomPercent(1.9, 0), 190, 'no usable fit: the raw scale')
  check(assert.equal, h.zoomPercent(1.9, -2), 190)
  check(assert.equal, h.zoomPercent(1.9, NaN), 190)
  check(assert.equal, h.zoomPercent(1.9, Infinity), 190)
  for (const odd of [0, -1, NaN, Infinity, '1', null, undefined]) check(assert.equal, h.zoomPercent(odd, 1.9), 100, `no usable scale: ${String(odd)}`)

  // what the toolbar draws
  deq(h.toolbarState({ showList: false, hasSelection: false }), { zoomDisabled: false, resetDisabled: false, showFocus: false, focusDisabled: false, listLabel: 'Entity list', listAriaLabel: 'Show entity list', listTitle: 'Entity list' }, 'map, nothing selected')
  deq(h.toolbarState({ showList: false, hasSelection: true }), { zoomDisabled: false, resetDisabled: false, showFocus: true, focusDisabled: false, listLabel: 'Entity list', listAriaLabel: 'Show entity list', listTitle: 'Entity list' }, 'map, selected')
  deq(h.toolbarState({ showList: true, hasSelection: false }), { zoomDisabled: true, resetDisabled: true, showFocus: false, focusDisabled: true, listLabel: 'Map', listAriaLabel: 'Show knowledge map', listTitle: 'Show map' }, 'list, nothing selected')
  deq(h.toolbarState({ showList: true, hasSelection: true }), { zoomDisabled: true, resetDisabled: true, showFocus: true, focusDisabled: true, listLabel: 'Map', listAriaLabel: 'Show knowledge map', listTitle: 'Show map' }, 'list, selected')
  check(assert.equal, h.focusTitle('Northwind'), 'Focus Northwind')
  for (const none of [undefined, null, '', '   ', 4]) check(assert.equal, h.focusTitle(none), 'Focus the selected entity', `no name: ${String(none)}`)
  check(assert.equal, h.RESET_LABEL, 'Reset map')
}

// ---- toolbar --------------------------------------------------------------------------------------------------------------------------------
function toolbarChecks(sources) {
  const { StudioKnowledgeMapToolbar } = loadModule(TOOLBAR, sources)
  const calls = []
  const props = { showList: false, viewScale: 2.28, fitScale: 1.9, selectedName: undefined, hasSelection: false, onToggleList: () => calls.push('list'), onZoomIn: () => calls.push('in'),
    onZoomOut: () => calls.push('out'), onReset: () => calls.push('reset'), onFocus: () => calls.push('focus') }
  const html = overrides => renderToStaticMarkup(React.createElement(StudioKnowledgeMapToolbar, { ...props, ...overrides }))
  let markup = html({})
  check(assert.match, markup, /^<div data-studio-graph-toolbar="true" data-studio-graph-toolbar-kind="map" role="group" aria-label="Knowledge map controls" class="absolute right-3 top-3 z-10 hidden items-center gap-1 rounded-xl border border-white\/10 bg-slate-950\/80 p-1 shadow-xl backdrop-blur lg:flex">/, 'the same container the map\'s own toolbar has, so its stylesheet places it')
  check(assert.match, markup, /<div class="skmt-zoom" role="group" aria-label="Zoom"><button type="button" aria-label="Zoom out" title="Zoom out"><svg data-icon="Minus"[^>]*><\/svg><\/button><output class="skg-zoom" aria-label="Map zoom">120%<\/output><button type="button" aria-label="Zoom in" title="Zoom in"><svg data-icon="Plus"/, '- 120% +, in that order, together')
  check(assert.match, markup, /<button type="button" aria-pressed="false" aria-label="Show entity list" title="Entity list"><svg data-icon="List"[^>]*><\/svg><span>Entity list<\/span><\/button>/, 'the entity list button')
  check(assert.match, markup, /<button type="button" aria-label="Reset map" title="Fit the whole map in the panel again"><svg data-icon="RotateCcw"[^>]*><\/svg><span>Reset map<\/span><\/button><\/div>$/, '"Reset map" last, with its words')
  check(assert.doesNotMatch, markup, /Focus/, 'nothing selected: no Focus entity')
  check(assert.doesNotMatch, markup, /Fit graph|Reset graph view|data-icon="Focus"/, 'no Fit graph, no Reset graph view')
  check(assert.equal, (markup.match(/<button /g) ?? []).length, 4, 'four buttons')
  check(assert.doesNotMatch, markup, /disabled/, 'nothing is off on the map')
  markup = html({ hasSelection: true, selectedName: 'Northwind Test Stores' })
  check(assert.match, markup, /<button type="button" aria-label="Focus selected entity" title="Focus Northwind Test Stores"><svg data-icon="ScanSearch"[^>]*><\/svg><span>Focus entity<\/span><\/button><button type="button" aria-label="Reset map"/, 'selected: Focus entity, before Reset map')
  markup = html({ showList: true, hasSelection: true })
  check(assert.match, markup, /<button type="button" aria-pressed="true" aria-label="Show knowledge map" title="Show map"><svg data-icon="Network"[^>]*><\/svg><span>Map<\/span><\/button>/, 'the list is showing: the button offers the map')
  check(assert.equal, (markup.match(/ disabled/g) ?? []).length, 4, 'in the list: zoom out, zoom in, Focus entity and Reset map are off')
  check(assert.match, markup, /<button type="button" disabled="" aria-label="Zoom out"/)
  check(assert.match, markup, /<button type="button" disabled="" aria-label="Reset map"/)
  check(assert.match, html({ viewScale: 1.9 }), /Map zoom">100%</, 'the fitted view')
  check(assert.match, html({ viewScale: 1.9, fitScale: 1 }), /Map zoom">190%</, 'a fit of 1')

  // what each press hands on
  const tree = StudioKnowledgeMapToolbar({ ...props, hasSelection: true })
  const nodes = (node, out = []) => { if (Array.isArray(node)) node.forEach(child => nodes(child, out)); else if (node && typeof node === 'object') { out.push(node); nodes(node.props?.children, out) } return out }
  const press = label => nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === label).props.onClick()
  for (const label of ['Zoom out', 'Zoom in', 'Show entity list', 'Focus selected entity', 'Reset map']) press(label)
  deq(calls.splice(0), ['out', 'in', 'list', 'focus', 'reset'], 'each button its own handler')
}

// ---- graph ----------------------------------------------------------------------------------------------------------------------------------
const NODES = Array.from({ length: 9 }, (_, i) => ({ node_id: `n${i + 1}`, name: ['AI Forecasting Pilot', 'Out-of-Stock Events', 'Weekly Forecast Error', 'Fresh Produce', 'AI Demand-Forecasting',
  'Northwind Quarterly Review Board', 'Northwind Test Stores', 'Priya Okafor', 'Ohio'][i], entity_type: ['EVENT', 'METRIC', 'METRIC', 'PRODUCT', 'TECHNOLOGY', 'ORG', 'ORG', 'PERSON', 'PLACE'][i],
  description: null, salience: [3, 2.4, 2.2, 1.6, 2.6, 2, 2.8, 1.4, 1.2][i], mention_count: i + 1 }))
const EDGES = [[1, 2], [1, 3], [1, 5], [1, 7], [5, 4], [6, 1], [8, 6], [7, 9], [3, 2]].map(([a, b], i) => ({ src_node_id: `n${a}`, dst_node_id: `n${b}`, relation: ['REDUCED', 'MEASURED_BY', 'USES'][i % 3], weight: 1 + (i % 3) }))
const VIEWS = [
  { name: 'nine entities', nodes: NODES, edges: EDGES, selectedId: null },
  { name: 'one selected', nodes: NODES, edges: EDGES, selectedId: 'n7' },
  { name: 'a selection that is not on the map', nodes: NODES, edges: EDGES, selectedId: 'n99' },
  { name: 'one entity', nodes: NODES.slice(0, 1), edges: [], selectedId: null },
  { name: 'two entities, one relation', nodes: NODES.slice(0, 2), edges: EDGES.slice(0, 1), selectedId: 'n2' },
  { name: 'a small panel', nodes: NODES, edges: EDGES, selectedId: null, width: 600, height: 400 },
]
// KNOWLEDGE-MAP-LABELS (a sibling change, when it is on this branch): kg-graph-view imports its label helper. Its flag is unset in every render here, so the markup is unaffected;
// the module only has to resolve. A file that is not there (this change alone on the base) is left out.
const LABELS_HELPER = 'lib/studio-knowledge-map-labels.ts'
const siblingSources = () => fs.existsSync(path.join(root, LABELS_HELPER)) ? { [LABELS_HELPER]: read(LABELS_HELPER) } : {}
const sourcesFor = (graph, extra = {}) => ({ ...siblingSources(), [GRAPH]: graph, [TOOLBAR]: read(TOOLBAR), [HELPER]: read(HELPER), ...extra })
const envFor = (shell, flag) => ({ ...(shell ? { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } : {}), ...(flag ? { [FLAG]: 'true' } : {}) })

function staticMarkup(graphSource, helperSource, env, view) {
  const { KgGraphView } = loadModule(GRAPH, sourcesFor(graphSource, { [HELPER]: helperSource }), { env })
  return renderToStaticMarkup(React.createElement(KgGraphView, { nodes: view.nodes, edges: view.edges, selectedId: view.selectedId, width: view.width, height: view.height }))
}

/** The graph view through a hooks runtime with effects (so the automatic fit runs) and plain element objects; function components are expanded. */
function runGraph(graphSource, helperSource, env, view) {
  const cells = []
  let cursor = 0, dirty = false
  const effects = [], layoutEffects = []
  const same = (deps, old) => !old || !deps || deps.some((value, index) => !Object.is(value, old.deps?.[index]))
  const react = {
    useState(init) { const i = cursor++; cells[i] ??= { value: typeof init === 'function' ? init() : init }; const cell = cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }] },
    useRef(init) { const i = cursor++; return cells[i] ??= { current: init } },
    useMemo(fn, deps) { const i = cursor++, old = cells[i]; if (same(deps, old)) cells[i] = { deps, value: fn() }; return cells[i].value },
    useCallback(fn, deps) { const i = cursor++, old = cells[i]; if (same(deps, old)) cells[i] = { deps, value: fn }; return cells[i].value },
    useEffect(fn, deps) { const i = cursor++, old = cells[i]; if (same(deps, old)) { cells[i] = { deps }; effects.push(fn) } },
    useLayoutEffect(fn, deps) { const i = cursor++, old = cells[i]; if (same(deps, old)) { cells[i] = { deps }; layoutEffects.push(fn) } },
  }
  const el = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null })
  const { KgGraphView } = loadModule(GRAPH, sourcesFor(graphSource, { [HELPER]: helperSource }), { react, jsx: { jsx: el, jsxs: el, Fragment: 'Fragment' }, env })
  const props = { nodes: view.nodes, edges: view.edges, selectedId: view.selectedId, width: view.width, height: view.height, onSelect: () => {} }
  let tree = null
  const expand = node => {
    if (Array.isArray(node)) return node.map(expand)
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') return expand(node.type(node.props))
    return { ...node, props: { ...node.props, children: expand(node.props.children) } }
  }
  const render = () => {
    for (let pass = 0; pass < 12; pass++) {
      cursor = 0; dirty = false
      tree = expand(KgGraphView(props))
      layoutEffects.splice(0).forEach(run => run())
      effects.splice(0).forEach(run => run())
      if (!dirty) return
    }
    throw new Error('render did not settle')
  }
  const nodes = (node, out = []) => { if (Array.isArray(node)) node.forEach(child => nodes(child, out)); else if (node && typeof node === 'object') { out.push(node); nodes(node.props?.children, out) } return out }
  const flat = node => nodes(node).flatMap(item => (typeof item.props?.children === 'string' ? [item.props.children] : typeof item.props?.children === 'number' ? [String(item.props.children)] : Array.isArray(item.props?.children) ? item.props.children.filter(c => typeof c === 'string' || typeof c === 'number').map(String) : [])).join('')
  render()
  const api = {
    render,
    button: label => nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === label) ?? null,
    labels: () => nodes(tree).filter(node => node.type === 'button' && node.props['aria-label']).map(node => node.props['aria-label']),
    readout: () => { const out = nodes(tree).find(node => node.type === 'output' && node.props['aria-label'] === 'Map zoom'); return out ? flat(out) : null },
    transform: () => nodes(tree).find(node => node.type === 'g' && typeof node.props.transform === 'string' && node.props.transform.startsWith('translate(') && node.props.transform.includes(') scale('))?.props.transform ?? null,
    press(label) { const button = api.button(label); assert.ok(button, `no button "${label}"`); button.props.onClick(); render() },
  }
  return api
}

function graphChecks(sources, baseMarkup) {
  const graph = sources.graph, helper = sources.helper
  // flag off: the base file's markup, byte for byte, in both profiles and every view
  for (const shell of [true, false]) for (const view of VIEWS) {
    check(assert.equal, staticMarkup(graph, helper, envFor(shell, false), view), baseMarkup(shell, view), `flag off, ${shell ? 'Studio' : 'classic'} controls, ${view.name}: the base's markup`)
  }
  // the flag without the Studio controls does nothing (the mock's controls are the Studio's)
  for (const view of VIEWS.slice(0, 3)) check(assert.equal, staticMarkup(graph, helper, envFor(false, true), view), baseMarkup(false, view), `flag on without the Studio controls: the base's markup, ${view.name}`)
  // flag on, static: the new toolbar replaces the old one
  const on = staticMarkup(graph, helper, envFor(true, true), VIEWS[1])
  check(assert.match, on, /data-studio-graph-toolbar-kind="map"/, 'flag on: the new toolbar')
  check(assert.match, on, /aria-label="Focus selected entity"/, 'a selected entity: Focus entity')
  check(assert.doesNotMatch, on, /Fit graph to view|Reset graph view|title="Fit graph"/, 'flag on: no Fit graph, no Reset graph view')
  check(assert.equal, (on.match(/aria-label="Knowledge map controls"/g) ?? []).length, 1, 'one toolbar')
  check(assert.doesNotMatch, staticMarkup(graph, helper, envFor(true, true), VIEWS[0]), /Focus/, 'nothing selected: no Focus entity at all')
  check(assert.doesNotMatch, staticMarkup(graph, helper, envFor(true, true), VIEWS[2]), /Focus/, 'a selection that is not on the map: no Focus entity')
  // the rest of the view is the base's: with the toolbar cut out of both, the markup is the same
  const cutToolbar = html => html.replace(/<div data-studio-graph-toolbar="true"[\s\S]*?<\/div>(?=<div data-studio-graph-hint)/, '').replace(/<div data-studio-graph-toolbar="true" data-studio-graph-toolbar-kind="map"[\s\S]*?<\/div><\/div>(?=<div data-studio-graph-hint)/, '')
  for (const view of VIEWS.slice(0, 3)) check(assert.equal, cutToolbar(staticMarkup(graph, helper, envFor(true, true), view)), cutToolbar(baseMarkup(true, view)), `flag on: everything but the toolbar is the base's, ${view.name}`)

  // behaviour through the runtime: 9 entities, nothing selected
  const view = VIEWS[0]
  const off = runGraph(graph, helper, envFor(true, false), view)
  const on9 = runGraph(graph, helper, envFor(true, true), view)
  const fit = Number(/scale\(([\d.]+)\)/.exec(on9.transform())[1])
  check(assert.ok, fit > 1.2 && fit < 4, `the map was fitted (scale ${fit})`)
  check(assert.equal, off.readout(), `${Math.round(fit * 100)}%`, 'flag off: the readout is the raw scale, as before')
  check(assert.equal, on9.readout(), '100%', 'flag on: the map opens at 100%')
  check(assert.equal, off.transform(), on9.transform(), 'and it is the same fitted view')
  deq(off.labels().filter(label => /Zoom|Fit|Reset|Focus|entity list/i.test(label)), ['Show entity list', 'Zoom in', 'Zoom out', 'Fit graph to view', 'Focus selected entity', 'Reset graph view'], 'flag off: the old controls, in their order')
  deq(on9.labels().filter(label => /Zoom|Fit|Reset|Focus|entity list/i.test(label)), ['Zoom out', 'Zoom in', 'Show entity list', 'Reset map'], 'flag on: - + list, Reset map; no Focus entity, no Fit graph')
  on9.press('Zoom in'); check(assert.equal, on9.readout(), '120%')
  on9.press('Zoom in'); check(assert.equal, on9.readout(), '144%')
  on9.press('Zoom out'); on9.press('Zoom out'); on9.press('Zoom out'); check(assert.equal, on9.readout(), '83%')
  check(assert.notEqual, on9.transform(), off.transform(), 'the view moved')
  on9.press('Reset map'); check(assert.equal, on9.readout(), '100%', 'Reset map: back to the fitted view')
  check(assert.equal, on9.transform(), off.transform(), 'exactly the view the map opened at')
  off.press('Zoom in'); check(assert.equal, off.readout(), `${Math.round(fit * 1.2 * 100)}%`, 'flag off: zoom in reads the raw scale')
  off.press('Reset graph view'); check(assert.equal, off.readout(), '100%', 'flag off: "Reset graph view" went to raw scale 1 (not the fitted view)')
  check(assert.ok, off.transform() !== on9.transform(), 'flag off: and that is not the fitted view')
  // the list: the map's controls are off, the toggle offers the map
  on9.press('Show entity list')
  check(assert.equal, on9.button('Zoom in').props.disabled, true, 'the list: zoom is off')
  check(assert.equal, on9.button('Reset map').props.disabled, true, 'the list: Reset map is off')
  check(assert.ok, on9.button('Show knowledge map'), 'the list: the toggle offers the map')
  on9.press('Show knowledge map'); check(assert.equal, on9.button('Zoom in').props.disabled, false)
  // a selection: Focus entity appears and works
  const fitSelected = Number(/scale\(([\d.]+)\)/.exec(runGraph(graph, helper, envFor(true, false), VIEWS[1]).transform())[1])
  const selected = runGraph(graph, helper, envFor(true, true), VIEWS[1])
  check(assert.ok, selected.button('Focus selected entity'), 'a selected entity: Focus entity')
  check(assert.equal, selected.readout(), '100%')
  selected.press('Focus selected entity')
  check(assert.equal, selected.readout(), `${Math.round(Math.max(fitSelected, 1.8) / fitSelected * 100)}%`, 'Focus entity zooms to the selected entity (at least 1.8), read against the fit')
  selected.press('Reset map'); check(assert.equal, selected.readout(), '100%')
  // a single entity: the fit is capped, still 100%
  const one = runGraph(graph, helper, envFor(true, true), VIEWS[3])
  check(assert.equal, one.readout(), '100%', 'one entity opens at 100% too')
  // a small panel
  const small = runGraph(graph, helper, envFor(true, true), VIEWS[5])
  check(assert.equal, small.readout(), '100%', 'a small panel opens at 100%')
}
// ---- source + css ---------------------------------------------------------------------------------------------------------------------------
function selectorsOf(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { const head = text.slice(start, i).trim(); if (!head.startsWith('@')) out.push(head); start = i + 1 } else if (text[i] === '}') start = i + 1
  }
  return out
}
function sourceChecks(graph, css) {
  const occurrences = (text, needle) => text.split(needle).length - 1
  check(assert.equal, occurrences(graph, FLAG), 1, 'the flag is named once')
  check(assert.ok, graph.includes(`const MAP_TOOLBAR = STUDIO_GRAPH_CONTROLS && process.env.${FLAG} === 'true'\n`), 'read once, exact "true", AND the Studio controls')
  check(assert.ok, graph.indexOf('const STUDIO_GRAPH_CONTROLS =') < graph.indexOf('const MAP_TOOLBAR ='), 'STUDIO_GRAPH_CONTROLS is defined first')
  check(assert.equal, (graph.match(/\bMAP_TOOLBAR\b/g) ?? []).length, 3, 'defined, the fit scale, the toolbar')
  check(assert.ok, graph.includes("const fitScale = useMemo(() => MAP_TOOLBAR ? knowledgeFitScale(layout, width, height) : 1, [layout, width, height])"), 'the fit scale: computed only for the flag')
  const branch = /\{MAP_TOOLBAR \? \(\n {8}<StudioKnowledgeMapToolbar\n {10}showList=\{showList\}\n {10}viewScale=\{view\.scale\}\n {10}fitScale=\{fitScale\}\n {10}selectedName=\{selectedPoint\?\.name\}\n {10}hasSelection=\{Boolean\(selectedPoint\)\}\n {10}onToggleList=\{\(\) => setShowList\(current => !current\)\}\n {10}onZoomIn=\{\(\) => zoomAround\(view\.scale \* 1\.2\)\}\n {10}onZoomOut=\{\(\) => zoomAround\(view\.scale \/ 1\.2\)\}\n {10}onReset=\{fitGraph\}\n {10}onFocus=\{focusSelected\}\n {8}\/>\n {6}\) : \(\n {8}<div data-studio-graph-toolbar=\{STUDIO_GRAPH_CONTROLS \? 'true' : undefined\}/
  check(assert.match, graph, branch, 'the new toolbar is the flag-on branch, with the view\'s own handlers; the old toolbar is the other branch')
  for (const part of ['aria-label="Zoom in"', 'aria-label="Zoom out"', 'aria-label="Fit graph to view"', 'aria-label="Reset graph view"', "aria-label=\"Focus selected entity\"", "{Math.round(view.scale * 100)}%",
    'onClick={() => setView({ x: 0, y: 0, scale: 1 })}', 'onClick={fitGraph}', 'disabled={showList || !selectedPoint}']) check(assert.ok, graph.includes(part), `the old toolbar keeps: ${part}`)
  check(assert.equal, occurrences(graph, 'knowledgeFitScale'), 2, 'imported and used once')
  check(assert.equal, occurrences(graph, 'StudioKnowledgeMapToolbar'), 2, 'imported and used once (component)')
  const selectors = selectorsOf(css)
  check(assert.ok, selectors.length >= 4, 'the stylesheet has rules')
  for (const selector of selectors) check(assert.match, selector, /^\[data-studio-graph-toolbar-kind="map"\] /, `scoped: ${selector}`)
  deq(css.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{3,8}\b/g), ['#2a3e48'], 'no colour of its own but the hover the map\'s own stylesheet uses for its buttons')
  check(assert.ok, css.includes('var(--skg-line)') && css.includes('var(--skg-control)'), 'on the map\'s own tokens')
}

// ---- run, then break things ------------------------------------------------------------------------------------------------------------------
const sources = { helper: read(HELPER), toolbar: read(TOOLBAR), graph: read(GRAPH), css: read(CSS) }
const baseCache = new Map()
const baseMarkup = (shell, view) => {
  const key = `${shell}/${view.name}`
  if (!baseCache.has(key)) baseCache.set(key, staticMarkup(baseGraph, read(HELPER), envFor(shell, false), view))
  return baseCache.get(key)
}
const runAll = s => {
  const h = loadModule(HELPER, { [HELPER]: s.helper })
  helperChecks(h, s.graph)
  toolbarChecks({ [TOOLBAR]: s.toolbar, [HELPER]: s.helper })
  graphChecks(s, baseMarkup)
  sourceChecks(s.graph, s.css)
}
runAll(sources)
const real = checks

const MUTANTS = [
  // helper
  ['helper', 'export const MIN_SCALE = 0.45', 'export const MIN_SCALE = 0.5', 'a different floor'],
  ['helper', 'export const MAX_SCALE = 3.5', 'export const MAX_SCALE = 4', 'a different cap'],
  ['helper', 'const FIT_MARGIN = 80', 'const FIT_MARGIN = 60', 'a different margin'],
  ['helper', 'const LABEL_ROOM = 24', 'const LABEL_ROOM = 20', 'a different label room'],
  ['helper', 'point.y - point.r - LABEL_ROOM', 'point.y - point.r', 'no label room'],
  ['helper', 'const minX = Math.min(...points.map(point => point.x - point.r))', 'const minX = Math.min(...points.map(point => point.x))', 'the radius is ignored on the left'],
  ['helper', 'const maxY = Math.max(...points.map(point => point.y + point.r))', 'const maxY = Math.max(...points.map(point => point.y))', 'the radius is ignored at the bottom'],
  ['helper', 'Math.max(maxX - minX, 1)', 'maxX - minX', 'a zero-width graph'],
  ['helper', 'Math.min((width - FIT_MARGIN) / graphWidth, (height - FIT_MARGIN) / graphHeight)', 'Math.max((width - FIT_MARGIN) / graphWidth, (height - FIT_MARGIN) / graphHeight)', 'the larger of the two fits'],
  ['helper', 'Math.max(MIN_SCALE, Math.min(MAX_SCALE,', 'Math.max(0, Math.min(MAX_SCALE,', 'no floor'],
  ['helper', 'Math.min(MAX_SCALE, Math.min(', 'Math.min(99, Math.min(', 'no cap'],
  ['helper', 'if (!Array.isArray(points) || points.length === 0) return 1', 'if (!Array.isArray(points)) return 1', 'no points: Infinity'],
  ['helper', 'return Math.round((viewScale / base) * 100)', 'return Math.round(viewScale * 100)', 'the readout is the raw scale'],
  ['helper', 'return Math.round((viewScale / base) * 100)', 'return Math.floor((viewScale / base) * 100)', 'the readout rounds down'],
  ['helper', 'return Math.round((viewScale / base) * 100)', 'return Math.round((base / viewScale) * 100)', 'the readout is inverted'],
  ['helper', 'fitScale > 0 ? fitScale : 1', 'fitScale >= 0 ? fitScale : 1', 'a fit of 0 divides'],
  ['helper', 'Number.isFinite(fitScale) && fitScale > 0', 'fitScale > 0', 'an infinite fit'],
  ['helper', 'Number.isFinite(viewScale) && viewScale > 0)) return 100', 'Number.isFinite(viewScale))) return 100', 'a zero scale reads 0%'],
  ['helper', 'zoomDisabled: showList,', 'zoomDisabled: false,', 'zoom stays on in the list'],
  ['helper', 'resetDisabled: showList,', 'resetDisabled: false,', 'reset stays on in the list'],
  ['helper', 'showFocus: hasSelection,', 'showFocus: true,', 'Focus entity always drawn'],
  ['helper', 'focusDisabled: showList,', 'focusDisabled: false,', 'Focus stays on in the list'],
  ['helper', "listLabel: showList ? 'Map' : 'Entity list'", "listLabel: 'Entity list'", 'the list button never offers the map'],
  ['helper', "listAriaLabel: showList ? 'Show knowledge map' : 'Show entity list'", "listAriaLabel: 'Show entity list'", 'the list button announces the wrong thing'],
  ['helper', "listTitle: showList ? 'Show map' : 'Entity list'", "listTitle: 'Entity list'", 'the list button\'s title'],
  ['helper', "return typeof name === 'string' && name.trim() !== '' ? `Focus ${name}` : 'Focus the selected entity'", "return `Focus ${name}`", 'Focus undefined'],
  ['helper', "export const RESET_LABEL = 'Reset map'", "export const RESET_LABEL = 'Reset'", 'the reset label'],
  // toolbar
  ['toolbar', '<output className="skg-zoom" aria-label="Map zoom">{zoomPercent(viewScale, fitScale)}%</output>', '<output className="skg-zoom" aria-label="Map zoom">{Math.round(viewScale * 100)}%</output>', 'the raw scale'],
  ['toolbar', 'onClick={onZoomOut} disabled={state.zoomDisabled}', 'onClick={onZoomIn} disabled={state.zoomDisabled}', 'zoom out zooms in'],
  ['toolbar', 'onClick={onReset} disabled={state.resetDisabled}', 'onClick={onFocus} disabled={state.resetDisabled}', 'Reset focuses'],
  ['toolbar', 'onClick={onReset} disabled={state.resetDisabled}', 'onClick={onReset} disabled={false}', 'Reset stays on in the list'],
  ['toolbar', 'onClick={onFocus} disabled={state.focusDisabled}', 'onClick={onFocus}', 'Focus stays on in the list'],
  ['toolbar', 'onClick={onZoomIn} disabled={state.zoomDisabled}', 'onClick={onZoomIn}', 'zoom in stays on in the list'],
  ['toolbar', '{state.showFocus && <button', '{<button', 'Focus entity always drawn'],
  ['toolbar', 'aria-pressed={showList}', 'aria-pressed={!showList}', 'the list button\'s state is inverted'],
  ['toolbar', 'onClick={onToggleList}', 'onClick={onReset}', 'the list button resets'],
  ['toolbar', 'data-studio-graph-toolbar-kind="map"', 'data-studio-graph-toolbar-kind="new"', 'the scoping attribute is renamed'],
  ['toolbar', 'data-studio-graph-toolbar="true" ', '', 'the map\'s own stylesheet no longer places it'],
  ['toolbar', 'aria-label={RESET_LABEL} title="Fit the whole map in the panel again"', 'aria-label="Reset graph view" title="Fit the whole map in the panel again"', 'the old name'],
  ['toolbar', '<span>{RESET_LABEL}</span>', '', 'Reset map has no words'],
  ['toolbar', '<div className="skmt-zoom" role="group" aria-label="Zoom">', '<div role="group" aria-label="Zoom">', 'the zoom group has no class'],
  ['toolbar', 'title={focusTitle(selectedName)}', 'title="Focus"', 'Focus entity does not name the entity'],
  // graph
  ['graph', "const MAP_TOOLBAR = STUDIO_GRAPH_CONTROLS && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR === 'true'", "const MAP_TOOLBAR = process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR === 'true'", 'not tied to the Studio controls'],
  ['graph', "const MAP_TOOLBAR = STUDIO_GRAPH_CONTROLS && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR === 'true'", "const MAP_TOOLBAR = STUDIO_GRAPH_CONTROLS && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR !== 'false'", 'on unless "false"'],
  ['graph', "const MAP_TOOLBAR = STUDIO_GRAPH_CONTROLS && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR === 'true'", "const MAP_TOOLBAR = STUDIO_GRAPH_CONTROLS && Boolean(process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR)", 'on for any value'],
  ['graph', 'MAP_TOOLBAR ? knowledgeFitScale(layout, width, height) : 1', 'knowledgeFitScale(layout, width, height)', 'the fit scale is computed flag off too'],
  ['graph', 'MAP_TOOLBAR ? knowledgeFitScale(layout, width, height) : 1', 'MAP_TOOLBAR ? knowledgeFitScale(layout, height, width) : 1', 'width and height swapped'],
  ['graph', '[layout, width, height])\n\n  const labeledIds', '[width, height])\n\n  const labeledIds', 'the fit scale does not follow the layout'],
  ['graph', '      {MAP_TOOLBAR ? (\n', '      {!MAP_TOOLBAR ? (\n', 'the branch is inverted'],
  ['graph', 'fitScale={fitScale}', 'fitScale={1}', 'the readout is not read against the fit'],
  ['graph', 'viewScale={view.scale}', 'viewScale={1}', 'the readout never moves'],
  ['graph', 'hasSelection={Boolean(selectedPoint)}', 'hasSelection={Boolean(selectedId)}', 'Focus entity for a selection that is not on the map'],
  ['graph', 'hasSelection={Boolean(selectedPoint)}', 'hasSelection={true}', 'Focus entity always'],
  ['graph', 'onZoomIn={() => zoomAround(view.scale * 1.2)}', 'onZoomIn={() => zoomAround(view.scale * 1.5)}', 'a different zoom step'],
  ['graph', 'onZoomOut={() => zoomAround(view.scale / 1.2)}', 'onZoomOut={() => zoomAround(view.scale * 1.2)}', 'zoom out zooms in'],
  ['graph', 'onReset={fitGraph}', 'onReset={() => setView({ x: 0, y: 0, scale: 1 })}', 'Reset map goes to raw scale 1 again'],
  ['graph', 'onFocus={focusSelected}', 'onFocus={fitGraph}', 'Focus entity fits'],
  ['graph', 'onToggleList={() => setShowList(current => !current)}', 'onToggleList={() => setShowList(true)}', 'the list cannot be left'],
  ['graph', 'selectedName={selectedPoint?.name}', 'selectedName={undefined}', 'Focus does not name the entity'],
  ['graph', '{Math.round(view.scale * 100)}%', '{Math.round(view.scale * 90)}%', 'the old readout is changed'],
  ['graph', 'aria-label="Reset graph view"', 'aria-label="Reset map"', 'the old reset is renamed'],
  ['graph', 'const MIN_SCALE = 0.45', 'const MIN_SCALE = 0.4', 'the map\'s floor moves (the fit scale and the map disagree)'],
  ['graph', 'Math.min((width - 80) / graphWidth, (height - 80) / graphHeight)', 'Math.min((width - 90) / graphWidth, (height - 80) / graphHeight)', 'the map\'s own fit moves (the readout and the map disagree)'],
  ['graph', 'point.y - point.r - 24', 'point.y - point.r - 30', 'the map\'s label room moves'],
  ['graph', 'import { StudioKnowledgeMapToolbar } from \'./studio-knowledge-map-toolbar\'\n', '', 'the toolbar is not imported'],
  // css
  ['css', '[data-studio-graph-toolbar-kind="map"] .skmt-zoom button:hover:not(:disabled) {', '.skmt-zoom button:hover:not(:disabled) {', 'a rule that is not scoped'],
  ['css', '[data-studio-graph-toolbar-kind="map"] .skmt-zoom .skg-zoom {', '[data-studio-graph-toolbar="true"] .skmt-zoom .skg-zoom {', 'a rule scoped to the old toolbar too'],
]
let caught = 0
for (const [file, from, to, name] of MUTANTS) {
  const before = checks
  const broken = { ...sources, [file]: mutate(sources[file], [[from, to]], `${file} (${name})`) }
  let failed = false
  try { runAll(broken) } catch (error) { if (error instanceof MutationTargetMissing) throw error; failed = true }
  checks = before
  assert.ok(failed, `mutant not caught: ${file}: ${name}`)
  caught++
}
checks = real
console.log(`PASS: studio knowledge map toolbar (${checks} checks, ${caught}/${MUTANTS.length} mutants caught)`)
