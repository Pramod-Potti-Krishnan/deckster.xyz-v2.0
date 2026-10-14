// J6 pass-2 fixes for the Second Brain (Knowledge) page (frontend-2, card PASS2-J6-FINDINGS, KNOWLEDGE-2 run 0109439e).
// Flag NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES (exact "true", default off), read in app/(app)/knowledge/page.tsx. One flag, five groups of changes,
// one commit each:
//   1. S6  a stats / graph response that lacks nodes_by_type, top_entities, nodes or edges is treated as empty (the page used to throw at
//          `stats.nodes_by_type.length`), and each section plus the whole page sits in an error boundary.
//   2. S2/S3  "Failed to fetch" and the backend's verbatim error text become plain words with a Retry; the detail goes to the console.
//   3. S1  an import that was running when the page was reloaded is announced on return (per-viewer localStorage marker).
//   4. safety  "Import past sessions" (which writes to the person's real graph) asks first and names what it writes; it never auto-runs.
//   5. S4  singular/plural copy.
//
// Run: node scripts/test-studio-knowledge-fixes.mjs   (plain node: transpile + vm, no network, no timers that matter, no writes)
//   KNOWLEDGE_FIXES_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-knowledge-fixes.mjs
//     re-prints the flag-off render goldens below from the base sources (origin/studio-v4-dev-preparation-code at b0c5a4a, before this change).
//   KNOWLEDGE_FIXES_ROOT=<base checkout> node scripts/test-studio-knowledge-fixes.mjs
//     runs the flag-off checks against the base tree itself (the crash checks then show the crash, see CRASH_ON_BASE below).
//
// What runs: the REAL page.tsx (KnowledgePageForAccount and the default export), the REAL lib/studio-knowledge-fixes.ts and the REAL
// knowledge-section-boundary / knowledge-import-confirm components, transpiled and executed in a vm with a small hooks runtime (state, refs,
// memo, effects with dependency lists, layout effects) and a fake fetch / localStorage / clock. Child UI components (Button, Input, the graph
// view, the inspector) are inert strings. No service is contacted: the fake fetch throws for any URL it was not given an answer for.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = path.dirname(fileURLToPath(import.meta.url))
const treeRoot = process.env.KNOWLEDGE_FIXES_ROOT ? path.resolve(process.env.KNOWLEDGE_FIXES_ROOT) : path.resolve(here, '..')
const ON_BASE = Boolean(process.env.KNOWLEDGE_FIXES_ROOT)
const nodeRequire = createRequire(path.join(treeRoot, 'package.json'))
const realReact = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const exists = file => fs.existsSync(path.join(treeRoot, file))
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value))
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)

const PAGE = 'app/(app)/knowledge/page.tsx'
const LIB = 'lib/studio-knowledge-fixes.ts'
const BOUNDARY = 'components/knowledge/knowledge-section-boundary.tsx'
const CONFIRM = 'components/knowledge/knowledge-import-confirm.tsx'
const FLAG = 'NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES'

// ---- module loader: transpile repo files (optionally with in-memory mutations) and run them in a vm ----------------------------------------
class MutationTargetMissing extends Error {}
const transpiled = new Map()
const REAL = new Set([PAGE, LIB, BOUNDARY, CONFIRM])   // everything else the page imports is an inert string, so only our own code runs
const inert = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : String(key)) })
function createLoader({ env, stubs, globals, mutate = {}, react }) {
  const cache = new Map()
  const resolveFile = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(treeRoot, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return base + suffix
    return null
  }
  const requireFor = (spec, from) => {
    // The boundary is executed with the real React (it is a class component and is also rendered to static markup below).
    const realReactModule = path.relative(treeRoot, from) === BOUNDARY
    if (spec in stubs) return stubs[spec]
    if (spec === 'react') return realReactModule ? { ...realReact, default: realReact } : react
    if (spec === 'react/jsx-runtime') return realReactModule ? nodeRequire('react/jsx-runtime') : jsxRuntime
    if (spec === 'lucide-react') return realReactModule ? new Proxy({}, { get: (_, key) => () => realReact.createElement('svg', { 'data-icon': String(key) }) }) : inert()
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      const file = resolveFile(spec, from)
      if (file && REAL.has(path.relative(treeRoot, file))) return run(file)
    }
    return inert()
  }
  function run(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }
    cache.set(file, mod.exports)
    const rel = path.relative(treeRoot, file)
    let source = fs.readFileSync(file, 'utf8')
    for (const [from, to] of mutate[rel] ?? []) {
      if (!source.includes(from)) throw new MutationTargetMissing(`mutation target missing in ${rel}: ${from.slice(0, 80)}`)
      source = source.replace(from, to)
    }
    if (rel === PAGE) source += '\nexport { KnowledgePageForAccount };'
    const key = `${rel}\0${sha(source)}`
    if (!transpiled.has(key)) {
      const out = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
      assert.deepEqual((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [], `${rel} transpiles`)
      transpiled.set(key, out.outputText)
    }
    vm.runInNewContext(transpiled.get(key), { module: mod, exports: mod.exports, ...globals, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return { load: rel => run(path.join(treeRoot, rel)) }
}

// ---- a small hooks runtime: stateful root component, effects with dependency lists, inert children ----------------------------------------
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null })
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' }
function createRuntime() {
  const cells = []
  let cursor = 0, dirty = false
  const layout = [], effects = []
  const depsChanged = (old, deps) => !old || !deps || deps.some((value, index) => !Object.is(value, old.deps?.[index]))
  const react = {
    useState(init) {
      const i = cursor++
      cells[i] ??= { value: typeof init === 'function' ? init() : init }
      const cell = cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(init) { const i = cursor++; return cells[i] ??= { current: init } },
    useMemo(fn, deps) { const i = cursor++, old = cells[i]; if (depsChanged(old, deps)) cells[i] = { deps, value: fn() }; return cells[i].value },
    useCallback(fn, deps) { const i = cursor++, old = cells[i]; if (depsChanged(old, deps)) cells[i] = { deps, value: fn }; return cells[i].value },
    useEffect(fn, deps) {
      const i = cursor++, old = cells[i]
      if (depsChanged(old, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
    useLayoutEffect(fn, deps) {
      const i = cursor++, old = cells[i]
      if (depsChanged(old, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; layout.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
    Fragment: 'Fragment',
    Component: realReact.Component,
  }
  react.default = react
  const runtime = {
    react,
    /** Renders until no state changed during the render (layout effects run first, then effects), like a browser commit loop. */
    render(Component, props) {
      for (let attempt = 0; attempt < 14; attempt++) {
        cursor = 0; dirty = false
        const tree = Component(props)
        while (layout.length) layout.shift()()
        while (effects.length) effects.shift()()
        if (!dirty) return tree
      }
      throw new Error('render did not settle')
    },
    unmount() { for (const cell of cells) if (cell && typeof cell.cleanup === 'function') { cell.cleanup(); cell.cleanup = undefined } },
  }
  return runtime
}

/**
 * Expands function components the way a render would (class components included), so the result is host markup plus inert strings. A class
 * component with getDerivedStateFromError behaves like an error boundary: if expanding what it renders throws, it renders its fallback.
 */
function expand(node, onCatch = () => {}) {
  if (Array.isArray(node)) return node.map(item => expand(item, onCatch))
  if (!node || typeof node !== 'object') return node
  const { type, props = {} } = node
  if (typeof type === 'function') {
    if (type.prototype?.isReactComponent) {
      const instance = new type(props)
      instance.setState = update => { Object.assign(instance.state, typeof update === 'function' ? update(instance.state, props) : update) }
      try {
        return expand(instance.render(), onCatch)
      } catch (error) {
        if (typeof type.getDerivedStateFromError !== 'function') throw error
        Object.assign(instance.state, type.getDerivedStateFromError(error))
        instance.componentDidCatch?.(error, { componentStack: '\n    at test' })
        onCatch(error, instance)
        return expand(instance.render(), onCatch)
      }
    }
    return expand(type(props), onCatch)
  }
  const out = {}
  for (const [key, value] of Object.entries(props)) out[key] = key === 'children' ? expand(value, onCatch) : value
  return { type, props: out, key: node.key ?? null }
}

// ---- tree helpers -----------------------------------------------------------------------------------------------------------------------
function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(item => all(item, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props?.children, predicate, found)
  return found
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return ''
  if (typeof tree !== 'object') return String(tree)
  if (Array.isArray(tree)) return tree.map(text).join(' ')
  return text(tree.props?.children)
}
const role = (tree, name) => all(tree, item => item.props?.['data-studio-knowledge-role'] === name)
const buttons = (tree, label) => all(tree, item => item.type === 'Button' && text(item).replace(/\s+/g, ' ').trim() === label)
const rawButtons = (tree, label) => all(tree, item => item.type === 'button' && text(item).replace(/\s+/g, ' ').trim() === label)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function settle(rounds = 8) { for (let i = 0; i < rounds; i++) await tick() }

// ---- fixtures -----------------------------------------------------------------------------------------------------------------------------
const STATS = {
  node_count: 9, edge_count: 9, evidence_count: 11, sessions_consolidated: 1, last_updated_at: '2026-10-01T12:00:00Z',
  nodes_by_type: [{ entity_type: 'ORG', count: 3 }, { entity_type: 'METRIC', count: 6 }],
  top_entities: [{ node_id: 'n1', name: 'Northwind', entity_type: 'ORG', salience: 1, mention_count: 2 }],
}
const GRAPH = {
  nodes: [
    { node_id: 'n1', name: 'Northwind', entity_type: 'ORG', salience: 1, mention_count: 2 },
    { node_id: 'n2', name: 'Revenue', entity_type: 'METRIC', salience: 1, mention_count: 1 },
  ],
  edges: [{ src_node_id: 'n1', dst_node_id: 'n2', relation: 'REPORTS', weight: 1 }],
  total_nodes: 9,
}
const EMPTY_GRAPH = { nodes: [], edges: [], total_nodes: 0 }
const without = (object, ...keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)))
const OWNER = 'user:fixture-owner'
function access(accountKey = OWNER) {
  return {
    accountKey, userId: 'fixture-owner', isAuthenticated: true, isLoading: false, isEntitled: true, isSubscribed: true,
    serviceAvailable: true, error: null,
    settings: { user_id: 'fixture-owner', subscribed: true, cross_session_enabled: true, consent_version: '2026-05-28-v1' },
    capability: { source: 'knowledge_graph', configured: true, available: true, code: null, reason: null },
    refetch: async () => {},
  }
}
const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new SyntaxError('Unexpected end of JSON input'); return structuredClone(body) } })
const networkDown = () => { throw new TypeError('Failed to fetch') }

/** A fake service. Each route is a value, or a function (url, init) => response | throws. Unanswered URLs throw, so nothing can reach a service. */
function createServer(routes = {}) {
  const calls = []
  const table = { stats: respond(200, STATS), graph: respond(200, GRAPH), ...routes }
  const server = {
    calls,
    routes: table,
    count: name => calls.filter(call => call.name === name).length,
    fetch: async (url, init = {}) => {
      const method = init.method ?? 'GET'
      const name = String(url).startsWith('/api/knowledge-graph/stats') ? 'stats'
        : String(url).startsWith('/api/knowledge-graph/graph') ? 'graph'
        : String(url).startsWith('/api/knowledge-graph/nodes/') ? 'node'
        : String(url).startsWith('/api/knowledge-graph/search') ? 'search'
        : String(url).startsWith('/api/knowledge-graph/backfill') ? 'backfill' : null
      calls.push({ name, method, url: String(url) })
      if (name === null || !(name in table)) throw new Error(`fixture refuses ${method} ${url}`)
      const answer = table[name]
      return typeof answer === 'function' ? answer(String(url), init) : answer
    },
  }
  return server
}

function createStorage({ broken = false } = {}) {
  const map = new Map()
  const log = []
  const guard = (op, key) => { log.push([op, key]); if (broken) throw new Error('storage is blocked') }
  return {
    map, log,
    getItem: key => { guard('get', key); return map.has(key) ? map.get(key) : null },
    setItem: (key, value) => { guard('set', key); map.set(key, String(value)) },
    removeItem: key => { guard('remove', key); map.delete(key) },
  }
}

const CLOCK0 = Date.parse('2026-10-14T15:00:00Z')
function createClock() {
  const clock = { t: CLOCK0 }
  class FakeDate extends Date {
    constructor(...args) { if (args.length === 0) super(clock.t); else super(...args) }
    static now() { return clock.t }
  }
  clock.Date = FakeDate
  return clock
}

/**
 * Mounts the page. `flag` / `shell` choose the build-time flags (read from process.env at module load, like Next inlines them). `reload()`
 * discards all React state and mounts again on the same storage, clock and server, like a browser reload of the same tab.
 */
let activeMutation = {}   // set while a mutant runs: { 'relative/path': [[from, to], ...] }
function mountPage({ flag = true, shell = true, kg = access(), server = createServer(), storage = createStorage(), clock = createClock(), mutate = activeMutation } = {}) {
  const logs = { warn: [], error: [], log: [] }
  const make = () => {
    const runtime = createRuntime()
    const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: shell ? 'true' : 'false' }
    if (flag === true) env[FLAG] = 'true'
    else if (flag === 'false') env[FLAG] = 'false'
    const globals = {
      process: { env }, fetch: server.fetch, AbortController, Intl, Set, Map, Promise, JSON, Math, Number, String, Object, Array, Boolean, Error, TypeError, Date: clock.Date, URL,
      window: { localStorage: storage, location: { reload() {} } },
      console: { warn: (...a) => logs.warn.push(a), error: (...a) => logs.error.push(a), log: (...a) => logs.log.push(a), info() {}, debug() {} },
    }
    const loader = createLoader({ env, stubs: {
      '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
      '@/components/knowledge/kg-graph-view': { KgGraphView: 'KgGraphView', typeColor: () => '#60A5FA' },
      '@/hooks/use-knowledge-graph': { useKnowledgeGraph: () => kg },
    }, globals, mutate, react: runtime.react })
    const exports = loader.load(PAGE)
    return { runtime, exports, loader }
  }
  let current = make()
  const world = {
    logs, server, storage, clock, kg,
    get exports() { return current.exports },
    get loader() { return current.loader },
    render(props = { kg: world.kg }) { return current.runtime.render(current.exports.KnowledgePageForAccount, props) },
    renderDefault() { return current.runtime.render(current.exports.default, {}) },
    /** the page as a person sees it: function components expanded, error boundaries applied */
    view(props, onCatch) { return expand(world.render(props), onCatch) },
    async load(props) { world.render(props); await settle(); return world.view(props) },
    reload() { current.runtime.unmount(); current = make() },
    unmount() { current.runtime.unmount() },
  }
  return world
}

// ---- the checks ---------------------------------------------------------------------------------------------------------------------------
const checks = []     // [name, async fn(profile)] each must pass on the real sources, and (for the ones marked) fail for the mutants below
const check = (name, fn, options = {}) => checks.push([name, fn, options])   // options.base: also runs against KNOWLEDGE_FIXES_ROOT (the base tree)
const mutants = []    // [name, mutate map, check names that must catch it]
const mutant = (name, mutate) => mutants.push([name, mutate])
const PROFILES = [{ shell: true, label: 'studio' }, { shell: false, label: 'classic' }]
const onlyOnBranch = fn => async profile => { if (!ON_BASE) await fn(profile) }
const CRASH_RE = /Cannot read properties of undefined \(reading 'length'\)|undefined is not an object|Cannot read properties of undefined/

// ===========================================================================================================================================
// 1. S6: a response that lacks nodes_by_type (and friends) must not blank the page
// ===========================================================================================================================================

check('S6 reproduction: flag off (= the base), a stats response without nodes_by_type throws while the page renders', async ({ shell }) => {
  const world = mountPage({ flag: false, shell, server: createServer({ stats: respond(200, without(STATS, 'nodes_by_type')) }) })
  world.render()
  await settle()
  assert.throws(() => world.render(), CRASH_RE, 'the base crashes at stats.nodes_by_type.length')
}, { base: true })

check('S6: flag on, a stats response without nodes_by_type renders (treated as empty), with no filter chips', async ({ shell }) => {
  const world = mountPage({ shell, server: createServer({ stats: respond(200, without(STATS, 'nodes_by_type')) }) })
  const tree = await world.load()
  assert.equal(role(tree, 'filters').length, 0, 'no type chips without nodes_by_type')
  assert.match(text(tree), /Knowledge map/)
  assert.match(text(tree), /Showing 2 of 9 entities/)
  assert.equal(world.logs.error.length, 0, 'normalised data never reaches a boundary')
})

check('S6: flag on, stats without top_entities / graph without nodes and edges / both missing: renders, treated as empty', async ({ shell }) => {
  for (const [label, stats, graph] of [
    ['no top_entities', respond(200, without(STATS, 'top_entities')), respond(200, GRAPH)],
    ['no nodes', respond(200, STATS), respond(200, without(GRAPH, 'nodes'))],
    ['no edges', respond(200, STATS), respond(200, without(GRAPH, 'edges'))],
    ['no total_nodes', respond(200, STATS), respond(200, without(GRAPH, 'total_nodes'))],
    ['stats {}', respond(200, {}), respond(200, GRAPH)],
    ['graph {}', respond(200, STATS), respond(200, {})],
  ]) {
    const world = mountPage({ shell, server: createServer({ stats, graph }) })
    const tree = await world.load()
    assert.match(text(tree), /Knowledge map/, label)
    assert.equal(world.logs.error.length, 0, label)
    if (label === 'no total_nodes') assert.match(text(tree), /Showing 2 of 2 entities/, 'a missing total is the loaded count')
    if (label === 'no nodes') assert.match(text(tree), /Your graph is ready to grow/, 'a missing node list is an empty graph')
  }
})

check('S6: flag off, those same responses crash the base page (the reproduction is not specific to nodes_by_type)', async ({ shell }) => {
  const world = mountPage({ flag: false, shell, server: createServer({ graph: respond(200, without(GRAPH, 'nodes')) }) })
  world.render(); await settle()
  assert.throws(() => world.render(), CRASH_RE)
}, { base: true })

check('S6: flag on, a response that is not an object is not a crash: stats become "not loaded", a bad graph is a load error with Retry', async ({ shell }) => {
  const statsNull = mountPage({ shell, server: createServer({ stats: respond(200, null) }) })
  const tree = await statsNull.load()
  assert.match(text(tree), shell ? /Counts not loaded/ : /Entities/)
  const graphNull = mountPage({ shell, server: createServer({ graph: respond(200, [1, 2]) }) })
  const failed = await graphNull.load()
  assert.match(text(failed), /Knowledge could not be loaded/)
  assert.match(text(failed), /Your knowledge graph could not be loaded\./)
  assert.equal(buttons(failed, 'Retry').length, 1)
})

check('S6: a well-formed response is passed through untouched (same objects), so the map is not refitted by a refresh', async () => {
  const lib = mountPage().loader.load(LIB)
  const stats = structuredClone(STATS), graph = structuredClone(GRAPH)
  assert.equal(lib.normalizeKgStats(stats), stats)
  assert.equal(lib.normalizeKgGraph(graph), graph)
  const fixedStats = lib.normalizeKgStats(without(STATS, 'nodes_by_type'))
  assert.deepEqual(plain(fixedStats.nodes_by_type), [])
  assert.deepEqual(plain(fixedStats.top_entities), plain(STATS.top_entities))
  const fixedGraph = lib.normalizeKgGraph({ nodes: [{ node_id: 'a' }, null, { name: 'no id' }], edges: [{ src_node_id: 'a', dst_node_id: 'b' }, { src_node_id: 'a' }] })
  assert.deepEqual(plain(fixedGraph.nodes), [{ node_id: 'a' }])
  assert.deepEqual(plain(fixedGraph.edges), [{ src_node_id: 'a', dst_node_id: 'b' }])
  assert.equal(fixedGraph.total_nodes, 1)
  assert.equal(lib.normalizeKgStats(null), null)
  assert.equal(lib.normalizeKgStats([1]), null)
  assert.equal(lib.normalizeKgGraph('x'), null)
})

check('S6: the same snapshot twice keeps the graph identity (the page does not replace an equal graph)', async ({ shell }) => {
  const world = mountPage({ shell })
  const first = await world.load()
  const graphA = all(first, item => item.type === 'KgGraphView')[0].props.nodes
  world.render(); await settle()
  // a refresh: Retry/Refresh re-requests; the equal response must not give the map new node objects
  const refresh = shell ? buttons(world.view(), 'Refresh')[0] : null
  if (refresh) { refresh.props.onClick(); await settle() }
  const graphB = all(world.view(), item => item.type === 'KgGraphView')[0].props.nodes
  assert.equal(graphA, graphB)
})

// ---- the boundary ------------------------------------------------------------------------------------------------------------------------
check('S6 boundary: renders its children; a throwing child shows the plain notice with Try again, logs the detail to the console only', onlyOnBranch(async () => {
  const world = mountPage()
  const { KnowledgeSectionBoundary } = world.loader.load(BOUNDARY)
  const Bad = () => { throw new TypeError("Cannot read properties of undefined (reading 'length')") }
  const caught = []
  const view = expand({ type: 'main', props: { children: [
    jsx('p', { children: 'before' }),
    jsx(KnowledgeSectionBoundary, { label: 'test section', children: jsx(Bad, {}) }),
    jsx('p', { children: 'after' }),
  ] } }, error => caught.push(error))
  assert.match(text(view), /before/)
  assert.match(text(view), /after/)
  assert.match(text(view), /This part of the page could not be shown/)
  assert.doesNotMatch(text(view), /Cannot read properties|reading 'length'|TypeError/, 'no technical detail on screen')
  assert.equal(all(view, item => item.props?.role === 'alert').length, 1)
  assert.equal(all(view, item => item.type === 'button' && text(item).trim() === 'Try again').length, 1)
  assert.equal(caught.length, 1)
  assert.equal(world.logs.error.length, 1, 'the detail goes to the console')
  assert.match(String(world.logs.error[0][0]), /"test section" could not be shown/)
  assert.match(String(world.logs.error[0][1].message), /reading 'length'/)
  const ok = expand(jsx(KnowledgeSectionBoundary, { label: 'ok', children: jsx('p', { children: 'fine' }) }))
  assert.equal(text(ok), 'fine')
}))

check('S6 boundary: Try again and a new resetKey show the section again; the page variant says the page; real React markup', onlyOnBranch(async () => {
  const world = mountPage()
  const { KnowledgeSectionBoundary: Boundary } = world.loader.load(BOUNDARY)
  const failed = props => {
    const instance = new Boundary(props)
    instance.setState = update => Object.assign(instance.state, update)
    Object.assign(instance.state, Boundary.getDerivedStateFromError(new Error('x')))
    return instance
  }
  const section = failed({ label: 'a', resetKey: 1, children: 'kids' })
  assert.deepEqual(plain(section.state), { failed: true })
  section.componentDidUpdate({ label: 'a', resetKey: 1 })
  assert.equal(section.state.failed, true, 'same resetKey: stays failed')
  section.componentDidUpdate({ label: 'a', resetKey: 0 })
  assert.equal(section.state.failed, false, 'a new resetKey shows the section again')
  const again = failed({ label: 'a', children: 'kids' })
  all(expand(again.render()), item => item.type === 'button')[0].props.onClick()
  assert.equal(again.state.failed, false, 'Try again')
  class FailedPage extends Boundary { state = { failed: true } }
  const pageHtml = renderToStaticMarkup(realReact.createElement(FailedPage, { label: 'p', page: true }))
  const sectionHtml = renderToStaticMarkup(realReact.createElement(FailedPage, { label: 's' }))
  assert.match(pageHtml, /role="alert"/)
  assert.match(pageHtml, /Your Second Brain could not be shown/)
  assert.match(sectionHtml, /This part of the page could not be shown/)
  assert.match(sectionHtml, /Try again/)
  assert.doesNotMatch(sectionHtml + pageHtml, /undefined|\[object/)
  assert.equal(renderToStaticMarkup(realReact.createElement(Boundary, { label: 'ok' }, 'child')), 'child')
}))

check('S6 wiring: flag on, summary / type filters / map / inspector and the whole page sit in boundaries; flag off, none do', async ({ shell }) => {
  const on = mountPage({ shell })
  await on.load()
  const rawOn = on.render()
  const boundaries = all(rawOn, item => typeof item.type === 'function' && item.type.name === 'KnowledgeSectionBoundary').map(item => item.props.label)
  assert.deepEqual(boundaries.sort(), ['entity inspector', 'knowledge map', 'summary', 'type filters'])
  const pageLevel = on.renderDefault()
  assert.equal(pageLevel.type.name, 'KnowledgeSectionBoundary')
  assert.equal(pageLevel.props.page, true)
  assert.equal(pageLevel.props.resetKey, OWNER)
  assert.equal(pageLevel.props.children.type, on.exports.KnowledgePageForAccount)
  const filters = all(rawOn, item => typeof item.type === 'function' && item.type.name === 'KnowledgeSectionBoundary' && item.props.label === 'type filters')[0]
  assert.equal(filters.props.children.type.name, 'LazySection', 'the type filters are evaluated inside their own boundary, not in the page body')
  const off = mountPage({ flag: false, shell })
  await off.load()
  assert.deepEqual(all(off.render(), item => typeof item.type === 'function' && item.type.name === 'KnowledgeSectionBoundary'), [])
  assert.equal(off.renderDefault().type, off.exports.KnowledgePageForAccount, 'flag off: the page is returned as before')
  const exact = mountPage({ flag: 'false', shell })
  await exact.load()
  assert.equal(exact.renderDefault().type, exact.exports.KnowledgePageForAccount, 'only the exact "true" enables it')
})

check('S6 wiring: a section that throws is contained, the others still render (page, summary and inspector survive a bad map)', onlyOnBranch(async ({ shell }) => {
  const world = mountPage({ shell })
  await world.load()
  // Make the map component throw while it renders, as a node with an unusable entity_type would.
  const Broken = () => { throw new TypeError("Cannot read properties of null (reading 'length')") }
  const raw = world.render()
  const swap = node => {
    if (Array.isArray(node)) return node.map(swap)
    if (!node || typeof node !== 'object') return node
    return { ...node, type: node.type === 'KgGraphView' ? Broken : node.type, props: { ...node.props, children: swap(node.props?.children) } }
  }
  const contained = []
  const view = expand(swap(raw), (error) => contained.push(error))
  assert.equal(contained.length, 1, 'exactly the map section failed')
  assert.match(text(view), /This part of the page could not be shown/)
  assert.equal(all(view, item => item.type === 'StudioKnowledgeInspector').length + all(view, item => item.type === 'aside').length, 1, 'the inspector still renders')
  assert.match(text(view), /Knowledge map/, 'the map header still renders')
  assert.equal(role(view, 'summary').length + role(view, 'summary-disclosure').length > 0, true, 'the summary still renders')
}))

// ===========================================================================================================================================
// flag off = the base, byte for byte: render hashes over a matrix of states (markup, requests, console, storage)
// ===========================================================================================================================================

const serTree = value => JSON.stringify(value, (key, item) =>
  typeof item === 'function' ? (key === 'type' ? `[component ${item.name}]` : '[fn]') : item === undefined ? '__undefined__' : item)

/**
 * Drives the page through the states below with the flag OFF and returns a hash per state of everything observable: the expanded markup
 * tree, the requests made, the console output and the storage calls. The goldens were recorded from the base tree (b0c5a4a).
 */
async function offStates(shell) {
  const states = {}
  const record = (name, world, extra = null) => {
    const view = world.view()
    if (process.env.SHOW === name) console.log(`--- ${name}\n${text(view).replace(/\s+/g, ' ')}`)
    states[name] = sha(serTree({ view, calls: world.server.calls, logs: world.logs, storage: world.storage.log, extra })).slice(0, 20)
  }
  const fresh = (routes, kg) => mountPage({ flag: false, shell, kg, server: createServer(routes) })
  const never = new Promise(() => {})
  const importButton = world => buttons(world.view(), 'Import past sessions')[0]

  { const w = fresh(); w.render(); record('loading', w) }
  { const w = fresh(); await w.load(); record('loaded', w) }
  { const w = fresh({ stats: respond(200, { ...STATS, node_count: 0, edge_count: 0, evidence_count: 0, sessions_consolidated: 0, nodes_by_type: [], top_entities: [] }), graph: respond(200, EMPTY_GRAPH) }); await w.load(); record('empty', w) }
  { const w = fresh({ stats: respond(503, { error: 'x' }) }); await w.load(); record('load-503', w) }
  { const w = fresh({ stats: networkDown }); await w.load(); record('load-network', w) }
  if (shell) {
    const w = fresh(); await w.load()
    w.server.routes.stats = respond(500, {}); buttons(w.view(), 'Refresh')[0].props.onClick(); await settle(); record('refresh-failed', w)
  }
  { const w = fresh(); await w.load(); const chip = all(w.view(), item => item.type === 'button' && item.props['aria-pressed'] !== undefined)[0]; chip.props.onClick(); record('type-hidden', w) }
  { const w = fresh({ backfill: () => never }); await w.load(); importButton(w).props.onClick(); await settle(); record('importing', w) }
  const importCase = async (name, backfill, after = null) => {
    const w = fresh({ backfill }); await w.load(); importButton(w).props.onClick(); await settle(20)
    if (after) await after(w)
    record(name, w)
  }
  const batch = (extra = {}) => ({ sessions_processed: 2, sessions_completed: 2, sessions_retryable: 0, sessions_already_consolidated: 0, entities_created: 3, entities_merged: 1, total_candidates: 2, next_cursor: null, ...extra })
  await importCase('import-success', () => respond(200, batch()))
  await importCase('import-singular', () => respond(200, batch({ sessions_processed: 1, sessions_completed: 1, entities_created: 1, entities_merged: 1, sessions_already_consolidated: 1, total_candidates: 1 })))
  await importCase('import-partial', () => respond(200, batch({ sessions_completed: 1, sessions_retryable: 1, next_cursor: 3, total_candidates: 7 })))
  await importCase('import-unfinished', () => respond(200, batch({ sessions_completed: 0, sessions_retryable: 0 })))
  await importCase('import-no-sessions', () => respond(200, { no_sessions_found: true }))
  await importCase('import-http-error', () => respond(500, { error: 'Backfill failed: connection to db-prod-7 refused' }))
  await importCase('import-http-error-bare', () => respond(502, {}))
  await importCase('import-network-error', networkDown)
  await importCase('import-error-after-batch', (() => { let n = 0; return () => (++n === 1 ? respond(200, batch({ next_cursor: 3, total_candidates: 6 })) : networkDown()) })())
  await importCase('import-dismissed', () => respond(200, batch()), async w => { all(w.view(), item => item.type === 'button' && item.props['aria-label'] === 'Dismiss import message')[0].props.onClick() })
  { // the empty graph's own Import button
    const w = fresh({ stats: respond(200, { ...STATS, node_count: 0, nodes_by_type: [], top_entities: [] }), graph: respond(200, EMPTY_GRAPH), backfill: () => respond(200, batch()) })
    await w.load(); buttons(w.view(), 'Import past sessions').at(-1).props.onClick(); await settle(20); record('empty-import-success', w)
  }
  const searchWorld = async routes => {
    const w = fresh(routes); await w.load()
    all(w.view(), item => item.type === 'Input')[0].props.onChange({ target: { value: 'north' } })
    all(w.view(), item => item.type === 'form')[0].props.onSubmit({ preventDefault() {} })
    await settle(); return w
  }
  { const w = await searchWorld({ search: () => respond(200, { nodes: [{ node_id: 'n1', name: 'Northwind', entity_type: 'ORG' }] }) }); record('search-hits', w) }
  { const w = await searchWorld({ search: () => respond(500, {}) }); record('search-error', w) }
  { const w = await searchWorld({ search: networkDown }); record('search-network', w) }
  const detailWorld = async node => {
    const w = fresh({ node }); await w.load()
    const select = all(w.view(), item => item.type === 'KgGraphView')[0].props.onSelect
    select('n1'); w.render(); await settle(); return w
  }
  const detail = { node: GRAPH.nodes[0], evidence: [{ snippet: 'Revenue grew 12%', source_type: 'chunk', session_id: 's1', document_filename: 'q3.pdf', page_number: 4 }], provenance_session_ids: ['s1'], edges: [{ src_name: 'Northwind', dst_name: 'Revenue', relation: 'REPORTS', weight: 1 }] }
  { const w = await detailWorld(() => respond(200, detail)); record('detail-loaded', w) }
  { const w = await detailWorld(() => respond(500, {})); record('detail-error', w) }
  { const w = await detailWorld(networkDown); record('detail-network', w) }
  for (const [name, patch] of [['gate-loading', { isLoading: true }], ['gate-locked', { isEntitled: false }], ['gate-unavailable', { serviceAvailable: false }], ['gate-paused', { isSubscribed: false }]]) {
    const w = fresh({}, { ...access(), ...patch }); record(name, w)
  }
  { const w = fresh(); const tree = w.renderDefault(); states['default-export'] = sha(serTree({ tree: { type: tree.type, key: tree.key, props: tree.props } })).slice(0, 20) }
  { const w = fresh({ stats: respond(200, without(STATS, 'nodes_by_type')) }); w.render(); await settle(); let message = 'rendered'; try { w.render() } catch (error) { message = error.message }; states['missing-nodes-by-type'] = sha(message).slice(0, 20) }
  return states
}

// Recorded from the base tree with: KNOWLEDGE_FIXES_ROOT=<b0c5a4a checkout> PRINT_GOLDEN=1 node scripts/test-studio-knowledge-fixes.mjs
const GOLDEN = {
  "studio": {
    "loading": "60886f604a9dd6738882",
    "loaded": "e06697c14cf3edf02e05",
    "empty": "f78da70f4df4fa3718bb",
    "load-503": "36c6dc7078216b4f079c",
    "load-network": "51640033926a98ded730",
    "refresh-failed": "94150d2643b90a9d32ed",
    "type-hidden": "91c3fcc3b0a0802a89ba",
    "importing": "d31b9ce61c2b0a9b5175",
    "import-success": "cea019207be7f1823ae5",
    "import-singular": "ff03ee5b3c9b11e189c3",
    "import-partial": "0bc002fd306e891d1354",
    "import-unfinished": "0c09f6ee0a68e7557e6d",
    "import-no-sessions": "c7caf58b45c5f3513ba1",
    "import-http-error": "31019ce553703efe0c05",
    "import-http-error-bare": "dbbd4d6b9ed832ae6c40",
    "import-network-error": "62a7470dc1cef31624ba",
    "import-error-after-batch": "1b26750d6ae5d4c85075",
    "import-dismissed": "96742123972aace273de",
    "empty-import-success": "37817feba68f0d9c4f86",
    "search-hits": "9309dc06c69d0550f7a4",
    "search-error": "922a7994ed7a5a8b17e0",
    "search-network": "3a6fd7b2bdbbe4c5a97b",
    "detail-loaded": "0dadbcdd7cc74f76bbaf",
    "detail-error": "7178d5afdd49b852f347",
    "detail-network": "8187d326c32de0b4bfb6",
    "gate-loading": "9dbe8c32bb7040ad30dd",
    "gate-locked": "38e4a649d1d4521f797c",
    "gate-unavailable": "3e209867f4b726ee3a79",
    "gate-paused": "a712b9be136fc55bd359",
    "default-export": "7f394dc27664a83a98b7",
    "missing-nodes-by-type": "e980ad1b24fa0c73f93b"
  },
  "classic": {
    "loading": "c769fe2eb7913acd68fd",
    "loaded": "6d7250fe06c85ecc788c",
    "empty": "5531550a4998c8d4a8e2",
    "load-503": "86c2c6879d0b1d7ff3ab",
    "load-network": "e5cec89efc081c8e5448",
    "type-hidden": "09885692fdb1cf6fb185",
    "importing": "a64036be400db22400f3",
    "import-success": "ec4fb433610d43d893d0",
    "import-singular": "712e2755d8d9112b3a4b",
    "import-partial": "7b17f2297414cd972ccc",
    "import-unfinished": "7ee64ab516faffd19b26",
    "import-no-sessions": "011ecdbf851faa755c94",
    "import-http-error": "f91d72afbc7cc9350f05",
    "import-http-error-bare": "e97f9dcecf40f63268af",
    "import-network-error": "ce3c4f1362787bc6fd38",
    "import-error-after-batch": "d59d3a0aac8ecbd2c11e",
    "import-dismissed": "5d6d5d4f4151e4d51e05",
    "empty-import-success": "de4cfaa3b4f97cf59c12",
    "search-hits": "43a347292507a03a9086",
    "search-error": "0503e4922f985bd2f1fe",
    "search-network": "d9f6f53715d22466fcaf",
    "detail-loaded": "f9070dfc38f61f8bb9d3",
    "detail-error": "5ede905068f800e4bab5",
    "detail-network": "a95d4f6f5f0df75f1e43",
    "gate-loading": "9dbe8c32bb7040ad30dd",
    "gate-locked": "38e4a649d1d4521f797c",
    "gate-unavailable": "3e209867f4b726ee3a79",
    "gate-paused": "a712b9be136fc55bd359",
    "default-export": "7f394dc27664a83a98b7",
    "missing-nodes-by-type": "e980ad1b24fa0c73f93b"
  }
}

if (process.env.PRINT_GOLDEN) {
  const out = {}
  for (const profile of PROFILES) out[profile.label] = await offStates(profile.shell)
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

check('flag off is the base byte for byte: render, request, console and storage hashes over every state', async ({ shell, label }) => {
  const actual = await offStates(shell)
  assert.ok(Object.keys(GOLDEN[label] ?? {}).length > 20, 'goldens are recorded')
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(GOLDEN[label]).sort())
  for (const [name, hash] of Object.entries(actual)) assert.equal(hash, GOLDEN[label][name], `flag off: state "${name}" differs from the base`)
}, { base: true })

check('flag off touches no storage and makes no request the base did not make', async ({ shell }) => {
  const world = mountPage({ flag: false, shell })
  await world.load()
  buttons(world.view(), 'Import past sessions')[0].props.onClick()
  await settle(20)
  assert.deepEqual(world.storage.log, [])
  assert.deepEqual(world.server.calls.map(call => call.name), ['stats', 'graph', 'backfill'].filter(Boolean).slice(0, world.server.calls.length))
}, { base: false })

// ---- mutants: each in-memory edit of the real sources must make at least one check fail --------------------------------------------------
const PAGE_FLAG = 'const KNOWLEDGE_FIXES = process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES === "true"'
mutant('stats are not normalised (lib returns the raw response)', { [LIB]: [['export function normalizeKgStats<T>(raw: T): T | null {\n  if (!isRecord(raw)) return null', 'export function normalizeKgStats<T>(raw: T): T | null {\n  return raw']] })
mutant('graph is not normalised (lib returns the raw response)', { [LIB]: [['export function normalizeKgGraph<T>(raw: T): T | null {\n  if (!isRecord(raw)) return null', 'export function normalizeKgGraph<T>(raw: T): T | null {\n  return raw']] })
mutant('the page does not apply the stats normaliser', { [PAGE]: [['KNOWLEDGE_FIXES ? normalizeKgStats(nextStats) : nextStats', 'nextStats']] })
mutant('the page does not apply the graph normaliser', { [PAGE]: [['KNOWLEDGE_FIXES ? normalizeKgGraph(nextGraph) : nextGraph', 'nextGraph']] })
mutant('a missing total_nodes is not defaulted', { [LIB]: [['total_nodes: typeof raw.total_nodes === "number" ? raw.total_nodes : nodes.length', 'total_nodes: raw.total_nodes']] })
mutant('malformed nodes are kept', { [LIB]: [['raw.nodes.filter(item => isRecord(item) && typeof item.node_id === "string")', 'raw.nodes']] })
mutant('a non-object graph is accepted as loaded', { [PAGE]: [['if (KNOWLEDGE_FIXES && !loadedGraph) throw', 'if (false) throw']] })
mutant('the flag is ignored (always on)', { [PAGE]: [[PAGE_FLAG, 'const KNOWLEDGE_FIXES = true']] })
mutant('the flag is inverted', { [PAGE]: [[PAGE_FLAG, 'const KNOWLEDGE_FIXES = process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES !== "true"']] })
mutant('sections are not wrapped in boundaries', { [PAGE]: [['KNOWLEDGE_FIXES ? <KnowledgeSectionBoundary label={label} resetKey={resetKey}>{node}</KnowledgeSectionBoundary> : node', 'node']] })
mutant('the whole-page boundary is dropped', { [PAGE]: [['return KNOWLEDGE_FIXES ? <KnowledgeSectionBoundary label="Second Brain page" page resetKey={kg.accountKey}>{account}</KnowledgeSectionBoundary> : account', 'return account']] })
mutant('the type filters are evaluated in the page body again', { [PAGE]: [['<KnowledgeSectionBoundary label="type filters" resetKey={stats}><LazySection render={renderTypeFilters} /></KnowledgeSectionBoundary>', '<KnowledgeSectionBoundary label="type filters" resetKey={stats}>{renderTypeFilters()}</KnowledgeSectionBoundary>']] })
mutant('the boundary does not catch (getDerivedStateFromError ignores the error)', { [BOUNDARY]: [['return { failed: true }', 'return { failed: false }']] })
mutant('Try again does nothing', { [BOUNDARY]: [['private retry = () => this.setState({ failed: false })', 'private retry = () => {}']] })
mutant('the boundary ignores resetKey', { [BOUNDARY]: [['!Object.is(previous.resetKey, this.props.resetKey)', 'false']] })
mutant('the boundary keeps the detail to itself (no console.error)', { [BOUNDARY]: [['console.error(`[knowledge] "${this.props.label}" could not be shown`, error, info?.componentStack)', '']] })
mutant('the boundary fallback shows the technical error', { [BOUNDARY]: [['{page ? "Your Second Brain could not be shown" : "This part of the page could not be shown"}', '{String(this.state.failed) + " TypeError: Cannot read properties of undefined (reading \'length\')"}']] })

// ===========================================================================================================================================
// run
// ===========================================================================================================================================

const failures = []
let ran = 0
async function runChecks(label, only = null) {
  const failed = []
  for (const [name, fn, options] of checks) {
    if (only && !only.includes(name)) continue
    if (ON_BASE && !options.base) continue
    for (const profile of PROFILES) {
      try { await fn(profile); ran++ } catch (error) {
        if (error instanceof MutationTargetMissing) throw error
        failed.push(`${label} / ${profile.label}: ${name}\n      ${String(error?.message ?? error).split('\n')[0]}`)
      }
    }
  }
  return failed
}

const baseFailures = await runChecks('checks')
failures.push(...baseFailures)
const passed = ran

if (!ON_BASE && !process.env.SKIP_MUTANTS) {
  for (const [name, mutate] of mutants) {
    activeMutation = mutate
    let caught
    try { caught = await runChecks('mutant') } catch (error) { failures.push(`mutant "${name}": ${error.message}`); continue } finally { activeMutation = {} }
    if (!caught.length) failures.push(`mutant NOT caught: ${name}`)
    else if (process.env.VERBOSE) console.log(`mutant caught (${caught.length}): ${name}\n    first: ${caught[0].replace(/\n\s*/g, ' | ').slice(0, 230)}`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  console.error(`\nFAILED: ${failures.length} problem(s) (${passed} check runs passed)`)
  process.exit(1)
}
console.log(`Knowledge fixes: ${passed} check runs passed${ON_BASE ? ` on the base tree (${treeRoot}); the S6 crash reproduces there` : ` (${checks.length} checks x ${PROFILES.length} profiles); ${mutants.length} mutants caught`}.`)
