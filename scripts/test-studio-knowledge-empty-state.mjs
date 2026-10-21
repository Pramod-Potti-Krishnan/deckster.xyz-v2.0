// KNOWLEDGE-EMPTY-STATE: the Second Brain's empty map on the map's own dark canvas, and a side panel that says there is nothing to follow yet (flag
// NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE, exact "true", Studio shell only, default off). Card PASS2-J6-FINDINGS finding L9 (streams/ops/PASS2/J6/RUN.md section 2, scenario 6).
// Offline and self-contained apart from one `git show` of the base's studio-knowledge-inspector.tsx (the repository needs that commit; KNOWLEDGE_EMPTY_STATE_BASE=<commit> picks another).
// Run: node scripts/test-studio-knowledge-empty-state.mjs
//   helper     lib/studio-knowledge-empty-state.ts on its own (import-free): when the graph counts as empty, the copy, the ghost constellation;
//   map        components/knowledge/studio-knowledge-empty-state.tsx rendered: the canvas, the ghost, the page's own words, the two buttons and what they do;
//   panel      the REAL components/knowledge/studio-knowledge-inspector.tsx: without the new prop (every flag-off state) its markup is the base file's byte for byte; with it, an
//              empty graph says there is nothing to follow yet instead of asking for a selection, and nothing else about the panel changes;
//   page       app/(app)/knowledge/page.tsx: the flag is read once (exact "true", AND the Studio shell); the new map is the flag-on branch and the pale box is the flag-off one, with its
//              own words; the panel is told only with the flag on (no extra prop flag off, so the sibling page tests' render hashes hold);
//   css        every rule of the new stylesheet hangs on data-studio-knowledge-empty-state, which exists only with the flag on.
// Flag-off identity of the whole page is held by the render goldens of scripts/test-studio-knowledge-fixes.mjs and scripts/test-atlas-knowledge-recovery.mjs (they run the real page with the
// flag unset, including its empty state).
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

const BASE = process.env.KNOWLEDGE_EMPTY_STATE_BASE || 'fbc77c0430099ec7e11a188307ee5521b6937719'
const HELPER = 'lib/studio-knowledge-empty-state.ts'
const MAP = 'components/knowledge/studio-knowledge-empty-state.tsx'
const INSPECTOR = 'components/knowledge/studio-knowledge-inspector.tsx'
const CSS = 'components/knowledge/studio-knowledge-empty-state.css'
const PAGE = 'app/(app)/knowledge/page.tsx'
const FLAG = 'NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const baseInspector = execFileSync('git', ['show', `${BASE}:${INSPECTOR}`], { cwd: root, encoding: 'utf8' })

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
const LinkStub = props => React.createElement('a', { href: props.href, className: props.className, 'data-variant': props['data-variant'] }, props.children)
// the shadcn Button, reduced to what it does here: a <button>, or (asChild) its child with the button's props
const ButtonStub = ({ asChild, variant, children, ...rest }) => (asChild ? React.cloneElement(children, { 'data-variant': variant ?? 'default' }) : React.createElement('button', { type: 'button', 'data-variant': variant ?? 'default', ...rest }, children))
function loadModule(entry, sources, env = {}) {
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
      if (spec === 'react') return React
      if (spec === 'react/jsx-runtime') return realJsx
      if (spec === 'lucide-react') return iconStub
      if (spec === 'next/link') return { default: LinkStub }
      if (spec === '@/components/ui/button') return { Button: ButtonStub }
      if (spec.endsWith('.css')) return {}
      if (spec === './kg-graph-view') return { typeColor: type => `#${String(type).length.toString(16).padStart(2, '0')}0000` }
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
function helperChecks(h) {
  // the page's own words for the map
  check(assert.equal, h.EMPTY_MAP_TITLE, 'Your graph is ready to grow')
  check(assert.equal, h.EMPTY_MAP_BODY, 'Build a deck with Knowledge enabled, or import eligible past sessions to create your first entities and connections.')
  check(assert.equal, h.EMPTY_PANEL_TITLE, 'Nothing to follow yet.')
  check(assert.match, h.EMPTY_PANEL_BODY, /^Entities, the relations between them and the evidence behind each one appear here once your knowledge has something in it\./)
  check(assert.match, h.EMPTY_PANEL_BODY, /Import past sessions, or build a deck with Knowledge on, to start\.$/)
  check(assert.doesNotMatch, h.EMPTY_PANEL_BODY, /Select an entity/, 'the panel does not ask for a selection')

  // when the graph is empty: it loaded, it is not an error, it has no entities
  const empty = { nodes: [], edges: [], total_nodes: 0 }
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: empty, loadError: null }), true, 'loaded, no entities')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: empty, loadError: undefined }), true, 'no error (undefined)')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: empty, loadError: '' }), true, 'no error (empty text)')
  check(assert.equal, h.isEmptyGraph({ dataLoading: true, graph: empty, loadError: null }), false, 'still loading')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: null, loadError: null }), false, 'no graph yet')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: undefined, loadError: null }), false, 'no graph (undefined)')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: empty, loadError: 'Your knowledge graph could not be loaded.' }), false, 'a load error: that is not an empty library')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: { nodes: [{ node_id: 'n1' }] }, loadError: null }), false, 'one entity')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: { nodes: [{}, {}, {}] }, loadError: null }), false, 'three entities')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: {}, loadError: null }), false, 'a graph without a node list is not empty, it is unknown')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: { nodes: null }, loadError: null }), false, 'nodes null')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: { nodes: 'x' }, loadError: null }), false, 'nodes not a list')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: { nodes: '' }, loadError: null }), false, 'an empty string is not an empty node list')
  check(assert.equal, h.isEmptyGraph({ dataLoading: false, graph: { nodes: { length: 0 } }, loadError: null }), false, 'nor is an object with a length of 0')
  check(assert.equal, typeof h.isEmptyGraph({ dataLoading: false, graph: null, loadError: null }), 'boolean', 'a boolean')

  // the ghost constellation
  const ghost = h.ghostConstellation()
  check(assert.equal, ghost.nodes.length, 8)
  check(assert.ok, ghost.edges.length >= ghost.nodes.length, 'every node can be joined')
  for (const node of ghost.nodes) check(assert.ok, node.x - node.r >= 0 && node.x + node.r <= 100 && node.y - node.r >= 0 && node.y + node.r <= 60 && node.r > 0, `inside the 100 x 60 box: ${JSON.stringify(node)}`)
  for (const [from, to] of ghost.edges) check(assert.ok, Number.isInteger(from) && Number.isInteger(to) && from !== to && from >= 0 && to >= 0 && from < ghost.nodes.length && to < ghost.nodes.length, `edge ${from}-${to} joins two nodes`)
  const seen = new Set(ghost.edges.flat())
  check(assert.equal, seen.size, ghost.nodes.length, 'no node is on its own')
  check(assert.equal, new Set(ghost.edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`)).size, ghost.edges.length, 'no edge twice')
  // the middle is left clear for the words (a 40 x 20 box at the centre)
  for (const node of ghost.nodes) check(assert.ok, !(node.x > 30 && node.x < 70 && node.y > 20 && node.y < 40), 'the centre is clear')
  deq(h.ghostConstellation(), ghost, 'the same every time')
}

// ---- map ------------------------------------------------------------------------------------------------------------------------------------
function mapChecks(sources) {
  const { StudioKnowledgeEmptyMap } = loadModule(MAP, sources)
  const h = loadModule(HELPER, sources)
  const html = props => renderToStaticMarkup(React.createElement(StudioKnowledgeEmptyMap, { importing: false, onImport() {}, ...props }))
  let markup = html({})
  check(assert.match, markup, /^<div data-studio-knowledge-role="map-start" data-studio-knowledge-empty-state="true" class="skes">/, 'the container')
  check(assert.doesNotMatch, markup, /map-empty/, 'not the pale box\'s role (the shell\'s stylesheet makes that one light)')
  const ghost = h.ghostConstellation()
  check(assert.match, markup, /<svg class="skes-ghost" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">/, 'the ghost is decoration')
  check(assert.equal, (markup.match(/<line /g) ?? []).length, ghost.edges.length, 'one line per edge')
  check(assert.equal, (markup.match(/<circle /g) ?? []).length, ghost.nodes.length, 'one circle per node')
  for (const [from, to] of ghost.edges) check(assert.ok, markup.includes(`<line x1="${ghost.nodes[from].x}" y1="${ghost.nodes[from].y}" x2="${ghost.nodes[to].x}" y2="${ghost.nodes[to].y}"></line>`), `edge ${from}-${to} between its nodes`)
  for (const node of ghost.nodes) check(assert.ok, markup.includes(`<circle cx="${node.x}" cy="${node.y}" r="${node.r}"></circle>`), 'a node where it is')
  check(assert.match, markup, /<div class="skes-icon"><svg data-icon="Brain" class="h-8 w-8"><\/svg><\/div><h3>Your graph is ready to grow<\/h3><p>Build a deck with Knowledge enabled, or import eligible past sessions to create your first entities and connections\.<\/p>/, 'the page\'s own words')
  check(assert.match, markup, /<div class="skes-actions"><button type="button" data-variant="default"><svg data-icon="Import" class="mr-2 h-4 w-4"><\/svg> Import past sessions<\/button><a href="\/builder" data-variant="outline">Build a deck<\/a><\/div>/, 'the same two buttons')
  check(assert.doesNotMatch, markup, / disabled/, 'nothing is off')
  markup = html({ importing: true })
  check(assert.match, markup, /<button type="button" data-variant="default" disabled="">/, 'an import is running: Import past sessions is off')
  check(assert.equal, (markup.match(/ disabled/g) ?? []).length, 1, 'and only that button')
  // what the button does: the page's own handler
  const tree = StudioKnowledgeEmptyMap({ importing: false, onImport: () => calls.push('import') })
  const calls = []
  const nodes = (node, out = []) => { if (Array.isArray(node)) node.forEach(child => nodes(child, out)); else if (node && typeof node === 'object') { out.push(node); nodes(node.props?.children, out) } return out }
  const button = nodes(tree).find(node => node.type === ButtonStub && node.props.onClick)
  check(assert.ok, button, 'a button with a handler')
  button.props.onClick()
  deq(calls, ['import'], 'it hands on the import')
  check(assert.equal, nodes(tree).filter(node => node.props?.onClick).length, 1, 'the only handler')
  check(assert.equal, button.props.disabled, false)
  check(assert.equal, StudioKnowledgeEmptyMap({ importing: true, onImport() {} }) && nodes(StudioKnowledgeEmptyMap({ importing: true, onImport() {} })).find(node => node.type === ButtonStub && node.props.onClick).props.disabled, true)
}

// ---- panel ----------------------------------------------------------------------------------------------------------------------------------
const TOP = [{ node_id: 'n1', name: 'AI Forecasting Pilot', entity_type: 'EVENT' }, { node_id: 'n2', name: 'Northwind Test Stores', entity_type: 'ORG' }]
const DETAIL = { node: { node_id: 'n1', name: 'AI Forecasting Pilot', entity_type: 'EVENT', description: 'A six-week pilot.', salience: 3, mention_count: 4 },
  evidence: [{ snippet: 'Pilot results.', source_type: 'chunk', session_id: 's1', document_filename: 'pilot.pdf', page_number: 4, created_at: '2026-10-10T09:00:00Z' }], provenance_session_ids: ['s1'], edges: [{ src_name: 'A', dst_name: 'B', relation: 'USES', weight: 1 }] }
const PANEL_STATES = [
  { name: 'nothing selected, entities listed', props: { selected: null, selectedId: null, loading: false, error: null, topEntities: TOP } },
  { name: 'nothing selected, nothing listed', props: { selected: null, selectedId: null, loading: false, error: null, topEntities: [] } },
  { name: 'loading', props: { selected: null, selectedId: 'n1', loading: true, error: null, topEntities: TOP } },
  { name: 'an error', props: { selected: null, selectedId: 'n1', loading: false, error: 'Entity details could not be loaded.', topEntities: TOP } },
  { name: 'an entity selected', props: { selected: DETAIL, selectedId: 'n1', loading: false, error: null, topEntities: TOP } },
]
const panelHtml = (source, props, extra = {}, sourcesOverride = {}) => {
  const { StudioKnowledgeInspector } = loadModule(INSPECTOR, { [INSPECTOR]: source, [HELPER]: read(HELPER), ...sourcesOverride })
  return renderToStaticMarkup(React.createElement(StudioKnowledgeInspector, { onSelect() {}, onRetry() {}, onClear() {}, ...props, ...extra }))
}

function panelChecks(sources, baseMarkupOf) {
  const inspector = sources.inspector
  for (const state of PANEL_STATES) {
    check(assert.equal, panelHtml(inspector, state.props, {}, { [HELPER]: sources.helper }), baseMarkupOf(state), `the panel as the pages used to call it (no new prop), ${state.name}: the base's markup`)
    check(assert.equal, panelHtml(inspector, state.props, { emptyGraph: false }, { [HELPER]: sources.helper }), baseMarkupOf(state), `emptyGraph false, ${state.name}: the base's markup`)
  }
  const empty = panelHtml(inspector, PANEL_STATES[1].props, { emptyGraph: true }, { [HELPER]: sources.helper })
  check(assert.match, empty, /<div class="ski-notice"><svg data-icon="Network"[^>]*><\/svg><strong>Nothing to follow yet\.<\/strong><p>Entities, the relations between them and the evidence behind each one appear here once your knowledge has something in it\. Import past sessions, or build a deck with Knowledge on, to start\.<\/p><\/div>/, 'an empty graph: nothing to follow yet')
  check(assert.doesNotMatch, empty, /Follow an idea|Select an entity|Most reinforced/, 'and no request for a selection')
  check(assert.match, empty, /ENTITY &amp; SOURCES<\/p><h2>What your sources support<\/h2>/, 'the panel\'s heading is unchanged')
  // the flag changes the words for an empty graph and nothing else: the other states are the base's even with the prop
  for (const state of PANEL_STATES.slice(2)) check(assert.equal, panelHtml(inspector, state.props, { emptyGraph: true }, { [HELPER]: sources.helper }), baseMarkupOf(state), `emptyGraph true does not touch: ${state.name}`)
  // entities listed (a graph that is not empty but has no selection) keeps the old words even if the prop were set wrongly: the list is the page's, the words follow the prop
  const listed = panelHtml(inspector, PANEL_STATES[0].props, { emptyGraph: true }, { [HELPER]: sources.helper })
  check(assert.match, listed, /Nothing to follow yet\./, 'the words follow the prop')
  check(assert.match, listed, /Most reinforced/, 'and the list is untouched')
}

// ---- page + css -----------------------------------------------------------------------------------------------------------------------------
function selectorsOf(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { const head = text.slice(start, i).trim(); if (!head.startsWith('@')) out.push(head); start = i + 1 } else if (text[i] === '}') start = i + 1
  }
  return out
}
function pageChecks(page, css, inspector) {
  const occurrences = (text, needle) => text.split(needle).length - 1
  check(assert.equal, occurrences(page, FLAG), 1, 'the flag is named once')
  check(assert.ok, page.includes(`const KNOWLEDGE_EMPTY_STATE = STUDIO_SHELL && process.env.${FLAG} === "true"\n`), 'read once, exact "true", AND the Studio shell')
  check(assert.ok, page.indexOf('const STUDIO_SHELL =') < page.indexOf('const KNOWLEDGE_EMPTY_STATE ='), 'STUDIO_SHELL is defined first')
  check(assert.equal, (page.match(/\bKNOWLEDGE_EMPTY_STATE\b/g) ?? []).length, 4, 'defined, the graph test, the old box, the panel')
  check(assert.ok, page.includes('import { StudioKnowledgeEmptyMap } from "@/components/knowledge/studio-knowledge-empty-state"\nimport { isEmptyGraph } from "@/lib/studio-knowledge-empty-state"\n'), 'the imports (a function only: the sibling page tests stub every import but their own four modules, and call nothing flag off)')
  check(assert.ok, page.includes('const graphIsEmpty = KNOWLEDGE_EMPTY_STATE && isEmptyGraph({ dataLoading, graph, loadError })\n'), 'the empty test runs only for the flag, on the page\'s own state')
  check(assert.equal, occurrences(page, 'isEmptyGraph('), 1, 'called once')
  const branch = /\{graphIsEmpty && \(\n {14}<StudioKnowledgeEmptyMap importing=\{importing\} onImport=\{KNOWLEDGE_FIXES \? requestImport : runImport\} \/>\n {12}\)\}\n {12}\{!KNOWLEDGE_EMPTY_STATE && !dataLoading && graph && graph\.nodes\.length === 0 && !loadError && \(\n {14}<div data-studio-knowledge-role=\{STUDIO_SHELL \? "map-empty" : undefined\}/
  check(assert.match, page, branch, 'the new map, with the page\'s own import choice; then the pale box, flag off only, under its own condition')
  for (const part of ['className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl bg-[#070b18] px-6 text-center"', '<h3 className="mt-4 text-lg font-semibold text-white">Your graph is ready to grow</h3>', '<Button onClick={KNOWLEDGE_FIXES ? requestImport : runImport} disabled={importing}><Import className="mr-2 h-4 w-4" /> Import past sessions</Button>', '<Link href="/builder">Build a deck</Link>']) {
    check(assert.ok, page.includes(part), `the pale box keeps: ${part.slice(0, 70)}`)
  }
  // the panel is told only with the flag on: no extra prop flag off
  check(assert.ok, page.includes('            {...(KNOWLEDGE_EMPTY_STATE ? { emptyGraph: graphIsEmpty } : {})}\n          />'), 'the panel is told only with the flag on (a spread, so there is no extra prop flag off)')
  check(assert.ok, page.includes('  emptyGraph,\n}: {') && page.includes('  emptyGraph?: boolean\n}) {'), 'Inspector takes it')
  check(assert.ok, page.includes('onRetry={onRetry} onClear={onClear} emptyGraph={emptyGraph} />\n'), 'and hands it to the Studio panel only')
  check(assert.equal, occurrences(page, 'emptyGraph'), 5, 'the spread, the parameter, its type, the hand-over (twice in the line above counts once each): the legacy panel gets nothing')
  // the panel component
  check(assert.ok, inspector.includes('emptyGraph = false }: {') && inspector.includes('  emptyGraph?: boolean\n}) {'), 'the panel\'s prop defaults to false')
  check(assert.ok, inspector.includes('<strong>{emptyGraph ? EMPTY_PANEL_TITLE : "Follow an idea to its sources."}</strong><p>{emptyGraph ? EMPTY_PANEL_BODY : "Select an entity on the map or in search to inspect its recorded relationships and evidence."}</p>'), 'the words follow the prop; the old words are the other branch')
  // css
  const selectors = selectorsOf(css)
  check(assert.ok, selectors.length >= 12, 'the stylesheet has rules')
  for (const selector of selectors) for (const part of selector.split(',')) check(assert.match, part.trim(), /^\[data-studio-knowledge-empty-state="true"\]\.skes/, `scoped: ${part.trim()}`)
  check(assert.match, css.replace(/\/\*[\s\S]*?\*\//g, ''), /28px 28px, #10182b;/, 'the map\'s own canvas colour (studio-graph-controls.css) under the dots and the glow')
}

// ---- run, then break things ------------------------------------------------------------------------------------------------------------------
const sources = { helper: read(HELPER), map: read(MAP), inspector: read(INSPECTOR), page: read(PAGE), css: read(CSS) }
const baseCache = new Map()
const baseMarkupOf = state => {
  if (!baseCache.has(state.name)) baseCache.set(state.name, panelHtml(baseInspector, state.props, {}, { [HELPER]: read(HELPER) }))
  return baseCache.get(state.name)
}
const runAll = s => {
  helperChecks(loadModule(HELPER, { [HELPER]: s.helper }))
  mapChecks({ [MAP]: s.map, [HELPER]: s.helper })
  panelChecks(s, baseMarkupOf)
  pageChecks(s.page, s.css, s.inspector)
}
runAll(sources)
const real = checks

const MUTANTS = [
  // helper
  ['helper', "export const EMPTY_MAP_TITLE = 'Your graph is ready to grow'", "export const EMPTY_MAP_TITLE = 'Your second brain is empty'", 'the page\'s title changed'],
  ['helper', "to create your first entities and connections.'", "to create your first entities.'", 'the page\'s body changed'],
  ['helper', "export const EMPTY_PANEL_TITLE = 'Nothing to follow yet.'", "export const EMPTY_PANEL_TITLE = 'Select an entity.'", 'the panel still asks for a selection'],
  ['helper', "Import past sessions, or build a deck with Knowledge on, to start.'", "Select an entity on the map.'", 'the panel body asks for a selection'],
  ['helper', "return !dataLoading && Boolean(graph) && Array.isArray(graph?.nodes) && graph.nodes.length === 0 && !loadError", "return Boolean(graph) && Array.isArray(graph?.nodes) && graph.nodes.length === 0 && !loadError", 'empty while loading'],
  ['helper', "Array.isArray(graph?.nodes) && graph.nodes.length === 0", "graph?.nodes?.length === 0", 'a string of no characters is a node list'],
  ['helper', "Array.isArray(graph?.nodes) && graph.nodes.length === 0 && !loadError", "(!Array.isArray(graph?.nodes) || graph.nodes.length === 0) && !loadError", 'a graph without a node list is empty'],
  ['helper', "graph.nodes.length === 0 && !loadError", "graph.nodes.length <= 1 && !loadError", 'one entity is empty'],
  ['helper', "graph.nodes.length === 0 && !loadError", "graph.nodes.length === 0", 'a load error is an empty library'],
  ['helper', "x: 52, y: 8, r: 3 }, { x: 80, y: 14, r: 2.2 }", "x: 52, y: 28, r: 3 }, { x: 80, y: 14, r: 2.2 }", 'a ghost node behind the words'],
  ['helper', "{ x: 90, y: 38, r: 2.8 }", "{ x: 99, y: 38, r: 2.8 }", 'a ghost node outside the box'],
  ['helper', "[5, 6], [6, 7], [7, 0], [1, 7], [2, 4]]", "[5, 6], [2, 4]]", 'a ghost node on its own'],
  ['helper', "[7, 0], [1, 7], [2, 4]]", "[7, 0], [1, 7], [2, 4], [0, 1]]", 'an edge twice'],
  ['helper', "[7, 0], [1, 7], [2, 4]]", "[7, 0], [1, 7], [2, 2]]", 'an edge from a node to itself'],
  ['helper', "[7, 0], [1, 7], [2, 4]]", "[7, 0], [1, 7], [2, 9]]", 'an edge to a node that is not there'],
  // map
  ['map', 'data-studio-knowledge-role="map-start" data-studio-knowledge-empty-state="true"', 'data-studio-knowledge-role="map-empty" data-studio-knowledge-empty-state="true"', 'the pale box\'s role is back'],
  ['map', 'data-studio-knowledge-empty-state="true" className="skes"', 'data-studio-knowledge-empty-state="true" className="skes-x"', 'the container\'s class'],
  ['map', 'aria-hidden="true" focusable="false"', 'focusable="false"', 'the ghost is announced'],
  ['map', 'viewBox="0 0 100 60"', 'viewBox="0 0 100 100"', 'the ghost box'],
  ['map', 'x1={ghost.nodes[from].x} y1={ghost.nodes[from].y} x2={ghost.nodes[to].x} y2={ghost.nodes[to].y}', 'x1={ghost.nodes[to].x} y1={ghost.nodes[from].y} x2={ghost.nodes[from].x} y2={ghost.nodes[to].y}', 'a ghost edge between the wrong nodes'],
  ['map', '{ghost.nodes.map((node, index) => <circle key={index} cx={node.x} cy={node.y} r={node.r} />)}', '{ghost.nodes.slice(1).map((node, index) => <circle key={index} cx={node.x} cy={node.y} r={node.r} />)}', 'a ghost node missing'],
  ['map', '<h3>{EMPTY_MAP_TITLE}</h3>', '<h3>Empty</h3>', 'another title'],
  ['map', '<p>{EMPTY_MAP_BODY}</p>', '<p>Nothing here.</p>', 'another body'],
  ['map', '<Button onClick={onImport} disabled={importing}>', '<Button onClick={onImport}>', 'Import stays on while importing'],
  ['map', '<Button onClick={onImport} disabled={importing}>', '<Button onClick={() => {}} disabled={importing}>', 'Import does nothing'],
  ['map', '<Button asChild variant="outline"><Link href="/builder">Build a deck</Link></Button>', '<Button asChild variant="outline"><Link href="/">Build a deck</Link></Button>', 'Build a deck goes elsewhere'],
  ['map', '<Button asChild variant="outline"><Link href="/builder">Build a deck</Link></Button>', '', 'no Build a deck'],
  ['map', '<Import className="mr-2 h-4 w-4" /> Import past sessions', 'Import', 'the button is renamed'],
  // panel
  ['inspector', 'emptyGraph = false }: {', 'emptyGraph = true }: {', 'the panel says empty by default'],
  ['inspector', '<strong>{emptyGraph ? EMPTY_PANEL_TITLE : "Follow an idea to its sources."}</strong>', '<strong>{emptyGraph ? "Follow an idea to its sources." : EMPTY_PANEL_TITLE}</strong>', 'the title is inverted'],
  ['inspector', '<p>{emptyGraph ? EMPTY_PANEL_BODY : "Select an entity on the map or in search to inspect its recorded relationships and evidence."}</p>', '<p>{"Select an entity on the map or in search to inspect its recorded relationships and evidence."}</p>', 'the body is never new'],
  ['inspector', '<strong>{emptyGraph ? EMPTY_PANEL_TITLE : "Follow an idea to its sources."}</strong>', '<strong>{"Follow an idea to its sources."}</strong>', 'the title is never new'],
  ['inspector', '"Follow an idea to its sources."}</strong>', '"Follow an idea to its source."}</strong>', 'the old title is changed'],
  ['inspector', 'Select an entity on the map or in search to inspect its recorded relationships and evidence.', 'Select an entity on the map or in search to inspect its relationships and evidence.', 'the old body is changed'],
  ['inspector', '{topEntities.length > 0 && <section>', '{topEntities.length > 0 && !emptyGraph && <section>', 'the list is hidden for an empty graph'],
  ['inspector', 'import { EMPTY_PANEL_BODY, EMPTY_PANEL_TITLE } from "@/lib/studio-knowledge-empty-state"', 'const EMPTY_PANEL_BODY = "x", EMPTY_PANEL_TITLE = "y"', 'the copy is not the helper\'s'],
  // page
  ['page', 'const KNOWLEDGE_EMPTY_STATE = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE === "true"', 'const KNOWLEDGE_EMPTY_STATE = process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE === "true"', 'not tied to the Studio shell'],
  ['page', 'const KNOWLEDGE_EMPTY_STATE = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE === "true"', 'const KNOWLEDGE_EMPTY_STATE = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE !== "false"', 'on unless "false"'],
  ['page', 'const KNOWLEDGE_EMPTY_STATE = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE === "true"', 'const KNOWLEDGE_EMPTY_STATE = STUDIO_SHELL && Boolean(process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE)', 'on for any value'],
  ['page', 'const graphIsEmpty = KNOWLEDGE_EMPTY_STATE && isEmptyGraph({ dataLoading, graph, loadError })', 'const graphIsEmpty = isEmptyGraph({ dataLoading, graph, loadError })', 'the empty test runs flag off'],
  ['page', 'isEmptyGraph({ dataLoading, graph, loadError })', 'isEmptyGraph({ dataLoading: false, graph, loadError })', 'empty while loading'],
  ['page', 'isEmptyGraph({ dataLoading, graph, loadError })', 'isEmptyGraph({ dataLoading, graph, loadError: null })', 'a load error is an empty library'],
  ['page', '<StudioKnowledgeEmptyMap importing={importing} onImport={KNOWLEDGE_FIXES ? requestImport : runImport} />', '<StudioKnowledgeEmptyMap importing={importing} onImport={runImport} />', 'Import skips the confirm dialog'],
  ['page', '<StudioKnowledgeEmptyMap importing={importing} onImport={KNOWLEDGE_FIXES ? requestImport : runImport} />', '<StudioKnowledgeEmptyMap importing={false} onImport={KNOWLEDGE_FIXES ? requestImport : runImport} />', 'Import stays on while importing'],
  ['page', '{!KNOWLEDGE_EMPTY_STATE && !dataLoading && graph && graph.nodes.length === 0 && !loadError && (', '{!dataLoading && graph && graph.nodes.length === 0 && !loadError && (', 'the pale box is also drawn flag on'],
  ['page', '{!KNOWLEDGE_EMPTY_STATE && !dataLoading && graph && graph.nodes.length === 0 && !loadError && (', '{!KNOWLEDGE_EMPTY_STATE && !dataLoading && graph && graph.nodes.length === 0 && (', 'the pale box\'s own condition is changed'],
  ['page', '{graphIsEmpty && (\n              <StudioKnowledgeEmptyMap', '{graphIsEmpty && graph && (\n              <StudioKnowledgeEmptyMap', 'the new map has another condition'],
  ['page', '{...(KNOWLEDGE_EMPTY_STATE ? { emptyGraph: graphIsEmpty } : {})}', 'emptyGraph={graphIsEmpty}', 'the panel is told flag off too'],
  ['page', '{...(KNOWLEDGE_EMPTY_STATE ? { emptyGraph: graphIsEmpty } : {})}', '{...(KNOWLEDGE_EMPTY_STATE ? { emptyGraph: true } : {})}', 'the panel is always told empty'],
  ['page', 'onClear={onClear} emptyGraph={emptyGraph} />', 'onClear={onClear} />', 'the panel is not told'],
  ['page', 'className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl bg-[#070b18] px-6 text-center"', 'className="flex min-h-[480px] flex-col items-center justify-center rounded-2xl bg-[#070b18] px-6 text-center"', 'the pale box is changed'],
  ['page', '<h3 className="mt-4 text-lg font-semibold text-white">Your graph is ready to grow</h3>', '<h3 className="mt-4 text-lg font-semibold text-white">Your graph is empty</h3>', 'the pale box\'s words are changed'],
  ['page', 'import { isEmptyGraph } from "@/lib/studio-knowledge-empty-state"\n', 'import { isEmptyGraph, EMPTY_MAP_TITLE } from "@/lib/studio-knowledge-empty-state"\n', 'another import of the helper'],
  // css
  ['css', '[data-studio-knowledge-empty-state="true"].skes .skes-ghost line {', '.skes .skes-ghost line {', 'a rule that is not scoped'],
  ['css', '[data-studio-knowledge-empty-state="true"].skes h3 {', '[data-studio-knowledge-role="map-start"].skes h3 {', 'a rule on another attribute'],
  ['css', '28px 28px, #10182b;', '28px 28px, #f5f7f6;', 'the pale canvas'],
]
let caught = 0
const uncaught = []
for (const [file, from, to, name] of MUTANTS) {
  if (process.env.PROGRESS) console.log('mutant', file, name)
  const before = checks
  const broken = { ...sources, [file]: mutate(sources[file], [[from, to]], `${file} (${name})`) }
  let failed = false
  try { runAll(broken) } catch (error) { if (error instanceof MutationTargetMissing) throw error; failed = true }
  checks = before
  if (failed) caught++
  else uncaught.push(`${file}: ${name}`)
}
assert.deepEqual(uncaught, [], 'mutants not caught')
checks = real
console.log(`PASS: studio knowledge empty state (${checks} checks, ${caught}/${MUTANTS.length} mutants caught)`)
