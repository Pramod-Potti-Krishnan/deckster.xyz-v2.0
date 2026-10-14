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

function createStorage({ broken = false, denied = false } = {}) {
  const map = new Map()
  const log = []
  const guard = (op, key) => { log.push([op, key]); if (broken) throw new Error('storage is blocked') }
  return {
    map, log, denied,
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
      // `denied`: reading window.localStorage itself throws (blocked site data, some private windows)
      window: Object.defineProperties({ location: { reload() {} } }, { localStorage: { get() { if (storage.denied) throw new Error('SecurityError: access denied'); return storage } } }),
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
// 2. S2 / S3: plain words and a Retry instead of "Failed to fetch" and the backend's own error text
// ===========================================================================================================================================

const importButtonOf = tree => buttons(tree, 'Import past sessions')[0]
const noticeOf = tree => all(tree, item => item.type === 'div' && item.props.role === 'status')[0]
const noticeText = tree => text(noticeOf(tree).props.children[0]).replace(/\s+/g, ' ').trim()   // the message only, not the buttons
const OFFLINE = /You seem to be offline, or Deckster can't be reached right now\. Check your connection and try again\./
const TECHNICAL = /Failed to fetch|NetworkError|Unexpected end of JSON|TypeError|SyntaxError|db-prod|Traceback/

check('S2: flag on, a network failure while loading says so in plain words with Retry; the detail goes to the console', async ({ shell }) => {
  const server = createServer({ stats: networkDown })
  const world = mountPage({ shell, server })
  const tree = await world.load()
  assert.match(text(tree), /Knowledge could not be loaded/)
  assert.match(text(tree), OFFLINE)
  assert.doesNotMatch(text(tree), TECHNICAL)
  assert.ok(world.logs.warn.some(entry => entry.some(part => part instanceof TypeError && part.message === 'Failed to fetch')), 'the raw error is in the console')
  assert.equal(buttons(tree, 'Retry').length, 1)
  server.routes.stats = respond(200, STATS)
  buttons(tree, 'Retry')[0].props.onClick()
  await settle()
  const after = world.view()
  assert.equal(server.count('stats'), 2, 'Retry asks again')
  assert.doesNotMatch(text(after), /Knowledge could not be loaded/)
})

check('S2: flag on, an unreadable response says the graph could not be loaded, not the parser\'s message; HTTP errors keep their plain sentences', async ({ shell }) => {
  const parse = mountPage({ shell, server: createServer({ stats: respond(200, undefined) }) })
  const tree = await parse.load()
  assert.match(text(tree), /Your knowledge graph could not be loaded\./)
  assert.doesNotMatch(text(tree), TECHNICAL)
  assert.ok(parse.logs.warn.some(entry => entry.some(part => part instanceof SyntaxError)))
  const unavailable = await mountPage({ shell, server: createServer({ stats: respond(503, { error: 'x' }) }) }).load()
  assert.match(text(unavailable), /The Knowledge Graph service is not activated or is temporarily unavailable\./)
  const failed = await mountPage({ shell, server: createServer({ graph: respond(500, { error: 'Traceback: db-prod' }) }) }).load()
  assert.match(text(failed), /Your knowledge graph could not be loaded\./)
  assert.doesNotMatch(text(failed), TECHNICAL)
})

check('S2: flag on, search and entity details fail in plain words with Retry too', async ({ shell }) => {
  const server = createServer({ search: networkDown, node: networkDown })
  const world = mountPage({ shell, server })
  await world.load()
  all(world.view(), item => item.type === 'Input')[0].props.onChange({ target: { value: 'north' } })
  all(world.view(), item => item.type === 'form')[0].props.onSubmit({ preventDefault() {} })
  await settle()
  let tree = world.view()
  assert.match(text(tree), OFFLINE)
  assert.doesNotMatch(text(tree), /Failed to fetch/)
  assert.equal(rawButtons(tree, 'Retry').length, 1, 'search has a Retry')
  server.routes.search = respond(200, { nodes: [{ node_id: 'n1', name: 'Northwind', entity_type: 'ORG' }] })
  rawButtons(tree, 'Retry')[0].props.onClick()
  await settle()
  assert.equal(server.count('search'), 2)
  assert.match(text(world.view()), /Northwind/)

  all(tree, item => item.type === 'KgGraphView')[0].props.onSelect('n1')
  world.render(); await settle()
  tree = world.view()
  const inspector = all(tree, item => item.type === 'StudioKnowledgeInspector')[0]
  if (inspector) {
    assert.match(inspector.props.error, OFFLINE)
    assert.doesNotMatch(inspector.props.error, /Failed to fetch/)
  } else {
    assert.match(text(tree), OFFLINE)
    assert.equal(rawButtons(tree, 'Retry').length, 1, 'the classic inspector has a Retry')
    server.routes.node = respond(200, { node: GRAPH.nodes[0], evidence: [], provenance_session_ids: [], edges: [] })
    rawButtons(tree, 'Retry')[0].props.onClick()
    world.render(); await settle()
    assert.equal(server.count('node'), 2, 'Retry asks again')
  }
})

check('S2/S3: flag on, a failed import shows one plain sentence and Retry; the backend text and the raw error stay in the console', async ({ shell }) => {
  const cases = [
    ['network', networkDown, /You seem to be offline, so Deckster couldn't confirm the import finished\. Check your connection and try again\. Sessions already imported are skipped\./],
    ['HTTP 500 with a verbatim backend error', () => respond(500, { error: 'Backfill failed: connection to db-prod-7 refused' }), /^The import could not be completed\. Please try again in a moment\.$/],
    ['HTTP 502 with no body', () => respond(502, undefined), /^The import could not be completed\. Please try again in a moment\.$/],
    ['HTTP 503', () => respond(503, { error: 'Knowledge Graph is not activated on the backend yet' }), /^Knowledge is temporarily unavailable, so the import could not continue\. Please try again in a moment\.$/],
  ]
  for (const [label, backfill, expected] of cases) {
    const server = createServer({ backfill })
    const world = mountPage({ shell, server })
    await world.load()
    await startImport(world)
    await settle(20)
    const tree = world.view()
    assert.match(noticeText(tree), expected, label)
    assert.doesNotMatch(noticeText(tree), TECHNICAL, label)
    assert.ok(world.logs.warn.length > 0, `${label}: the detail is in the console`)
    const retry = rawButtons(noticeOf(tree), 'Retry')
    assert.equal(retry.length, 1, `${label}: Retry`)
    retry[0].props.onClick(); await confirmIfAsked(world)
    await settle(20)
    assert.equal(server.count('backfill'), 2, `${label}: Retry asks again`)
  }
  const verbatim = mountPage({ shell, server: createServer({ backfill: () => respond(500, { error: 'Backfill failed: connection to db-prod-7 refused' }) }) })
  await verbatim.load(); await startImport(verbatim)
  assert.ok(verbatim.logs.warn.some(entry => entry.some(part => String(part).includes('db-prod-7'))), 'the backend text is in the console')
})

check('S2: flag on, a failure after some batches keeps the progress sentence; Retry is only on a failed request', async ({ shell }) => {
  let n = 0
  const batch = { sessions_processed: 3, sessions_completed: 3, entities_created: 2, entities_merged: 0, total_candidates: 9, next_cursor: 3 }
  const world = mountPage({ shell, server: createServer({ backfill: () => (++n === 1 ? respond(200, batch) : networkDown()) }) })
  await world.load()
  await startImport(world)
  await settle(20)
  assert.match(noticeText(world.view()), /^3 session IDs were processed before import paused\. You seem to be offline/)
  assert.equal(rawButtons(noticeOf(world.view()), 'Retry').length, 1)
  const partial = mountPage({ shell, server: createServer({ backfill: () => respond(200, { sessions_processed: 2, sessions_completed: 0, sessions_retryable: 0, total_candidates: 2, next_cursor: null }) }) })
  await partial.load(); await startImport(partial)
  assert.match(noticeText(partial.view()), /could not be imported/)
  assert.equal(rawButtons(noticeOf(partial.view()), 'Retry').length, 0, 'an import that ran and reported results has no Retry')
  const running = mountPage({ shell, server: createServer({ backfill: () => new Promise(() => {}) }) })
  await running.load(); await startImport(running)
  assert.equal(rawButtons(noticeOf(running.view()), 'Retry').length, 0, 'no Retry while an import is running')
})

check('S2: network and text classification (browser engines, our own sentences, everything else)', async () => {
  const lib = mountPage().loader.load(LIB)
  for (const message of ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'fetch failed', 'Network request failed', 'The Internet connection appears to be offline.', 'The network connection was lost.'])
    assert.equal(lib.isNetworkFailure(new TypeError(message)), true, message)
  for (const value of [new Error('Failed to fetch'), new TypeError('x is not a function'), new SyntaxError('Unexpected token'), null, undefined, 'Failed to fetch', { name: 'TypeError' }])
    assert.equal(lib.isNetworkFailure(value), false, String(value))
  assert.equal(lib.plainKnowledgeError(new Error('Entity details could not be loaded.'), 'fallback'), 'Entity details could not be loaded.', 'our own sentence passes through')
  assert.equal(lib.plainKnowledgeError(new TypeError('x is not a function'), 'fallback'), 'fallback')
  assert.equal(lib.plainKnowledgeError(new SyntaxError('Unexpected token <'), 'fallback'), 'fallback')
  assert.equal(lib.plainKnowledgeError('boom', 'fallback'), 'fallback')
  assert.equal(lib.plainKnowledgeError(new TypeError('Failed to fetch'), 'fallback', 'offline text'), 'offline text')
  assert.equal(lib.importFailureText(503, 'x'), lib.IMPORT_UNAVAILABLE_TEXT)
  assert.equal(lib.importFailureText(500, 'x'), lib.IMPORT_FAILED_TEXT)
})

mutant('a network failure is not recognised', { [LIB]: [['return name === "TypeError" && typeof message === "string" && NETWORK_MESSAGE.test(message)', 'return false']] })
mutant('every TypeError counts as offline', { [LIB]: [['return name === "TypeError" && typeof message === "string" && NETWORK_MESSAGE.test(message)', 'return name === "TypeError"']] })
mutant('the raw error message is shown', { [LIB]: [['  return fallback\n}', '  return String((error as { message?: unknown })?.message ?? fallback)\n}']] })
mutant('the raw error is not logged', { [LIB]: [['    console.warn("[knowledge] request failed (network)", error)\n', '']] })
mutant('the backend error text is shown for a failed import', { [LIB]: [['return status === 503 ? IMPORT_UNAVAILABLE_TEXT : IMPORT_FAILED_TEXT', 'return String(detail)']] })
mutant('the backend error text is not logged', { [LIB]: [['  console.warn("[knowledge] import batch failed", status, detail)\n', '']] })
mutant('a 503 import is not told apart', { [LIB]: [['return status === 503 ? IMPORT_UNAVAILABLE_TEXT : IMPORT_FAILED_TEXT', 'return IMPORT_FAILED_TEXT']] })
mutant('loading shows the raw error again', { [PAGE]: [['setLoadError(KNOWLEDGE_FIXES\n          ? plainKnowledgeError(error, "Your knowledge graph could not be loaded.")\n          : error instanceof Error', 'setLoadError(false\n          ? plainKnowledgeError(error, "Your knowledge graph could not be loaded.")\n          : error instanceof Error']] })
mutant('entity details show the raw error again', { [PAGE]: [['setSelectedError(KNOWLEDGE_FIXES\n            ? plainKnowledgeError', 'setSelectedError(false\n            ? plainKnowledgeError']] })
mutant('search shows the raw error again', { [PAGE]: [['setSearchError(KNOWLEDGE_FIXES\n          ? plainKnowledgeError', 'setSearchError(false\n          ? plainKnowledgeError']] })
mutant('a failed import shows the raw error again', { [PAGE]: [['              ? plainKnowledgeError(error, IMPORT_FAILED_TEXT, OFFLINE_IMPORT_TEXT)', '              ? (error instanceof Error ? error.message : "")']] })
mutant('a failed import still shows the backend text', { [PAGE]: [['KNOWLEDGE_FIXES\n              ? importFailureText(response.status, body.error)', 'false\n              ? importFailureText(response.status, body.error)']] })
mutant('a failed import has no Retry', { [PAGE]: [['{KNOWLEDGE_FIXES && importNotice.kind === "failed" && !importing && (', '{false && importNotice.kind === "failed" && !importing && (']] })
mutant('every error notice has a Retry', { [PAGE]: [['{KNOWLEDGE_FIXES && importNotice.kind === "failed" && !importing && (', '{KNOWLEDGE_FIXES && !importing && (']] })
mutant('a failed import is not marked failed', { [PAGE]: [['...(KNOWLEDGE_FIXES ? { kind: "failed" as const } : {}),', '']] })
mutant('search has no Retry', { [PAGE]: [['{searchError && (KNOWLEDGE_FIXES', '{searchError && (false']] })
mutant('the classic inspector has no Retry', { [PAGE]: [['{KNOWLEDGE_FIXES && (\n              <button type="button" onClick={onRetry}', '{false && (\n              <button type="button" onClick={onRetry}']] })

// ===========================================================================================================================================
// 3. S1: an import that was running when the page was reloaded is announced on return
// ===========================================================================================================================================

const MIN = 60 * 1000
const batchOf = (extra = {}) => ({ sessions_processed: 3, sessions_completed: 3, sessions_retryable: 0, sessions_already_consolidated: 0, entities_created: 2, entities_merged: 1, total_candidates: 3, next_cursor: null, ...extra })
const hang = () => new Promise(() => {})
const markerKeyFor = (world, account = OWNER) => { const lib = world.loader.load(LIB); return lib.IMPORT_MARKER_PREFIX + lib.ownerTag(account) }
const readMarker = (world, account = OWNER) => { const raw = world.storage.map.get(markerKeyFor(world, account)); return raw ? JSON.parse(raw) : null }
/** With the flag on the button only asks; this confirms in the dialog when one is open, as a person would. */
async function confirmIfAsked(world) {
  const open = all(world.view(), item => item.type === 'AlertDialog')[0]
  if (open?.props.open) all(all(world.view(), item => item.type === 'AlertDialogContent')[0], item => item.type === 'AlertDialogAction')[0].props.onClick()
  await settle(20)
}
async function startImport(world) { importButtonOf(world.view()).props.onClick(); await confirmIfAsked(world) }
const sharedBrowser = () => ({ storage: createStorage(), clock: createClock() })

check('S1: flag on, starting an import leaves a marker in this browser, refreshed after every batch and removed when it finishes', async ({ shell }) => {
  const browser = sharedBrowser()
  const gate = []
  let n = 0
  const server = createServer({ backfill: () => { browser.clock.t += 2 * MIN; return ++n < 3 ? respond(200, batchOf({ next_cursor: n * 3, total_candidates: 9 })) : (gate.push(1), respond(200, batchOf({ next_cursor: null, total_candidates: 9 }))) } })
  const world = mountPage({ shell, server, ...browser })
  await world.load()
  assert.equal(readMarker(world), null, 'nothing before an import')
  const started = browser.clock.t
  await startImport(world)
  assert.equal(server.count('backfill'), 3)
  assert.equal(readMarker(world), null, 'removed when the import finished')
  // while it runs: the marker exists with the start time and moves its activeAt forward after each batch
  const seen = []
  const watched = createServer({ backfill: () => { seen.push(readMarker(world2)); browser.clock.t += 2 * MIN; return respond(200, batchOf({ next_cursor: seen.length < 3 ? seen.length * 3 : null, total_candidates: 9 })) } })
  const world2 = mountPage({ shell, server: watched, ...browser })
  await world2.load(); await startImport(world2)
  assert.equal(seen.length, 3)
  assert.ok(seen[0] && seen[0].v === 1, 'the marker exists before the first batch is asked for')
  assert.equal(seen[0].startedAt, seen[0].activeAt)
  assert.ok(seen[2].activeAt > seen[0].activeAt, 'activeAt moves after each batch')
  assert.equal(seen[2].startedAt, seen[0].startedAt, 'startedAt does not')
  assert.ok(seen[0].startedAt >= started)
})

check('S1: flag on, the marker is removed however the import ends in this tab (success, partial, no sessions, HTTP error, network error)', async ({ shell }) => {
  for (const [label, backfill] of [
    ['success', () => respond(200, batchOf())],
    ['partial', () => respond(200, batchOf({ sessions_completed: 1, sessions_retryable: 2 }))],
    ['unfinished', () => respond(200, batchOf({ sessions_completed: 0 }))],
    ['no sessions', () => respond(200, { no_sessions_found: true })],
    ['HTTP error', () => respond(500, { error: 'x' })],
    ['network error', networkDown],
  ]) {
    const world = mountPage({ shell, server: createServer({ backfill }) })
    await world.load(); await startImport(world)
    assert.equal(readMarker(world), null, label)
    assert.ok(world.storage.log.some(([op]) => op === 'set'), `${label}: a marker was written first`)
  }
})

check('S1: flag on, a reload during an import says one may still be running (and does not start another)', async ({ shell }) => {
  const browser = sharedBrowser()
  const server = createServer({ backfill: hang })
  const world = mountPage({ shell, server, ...browser })
  await world.load(); await startImport(world)
  assert.match(noticeText(world.view()), /^Importing eligible past sessions/)
  browser.clock.t += 90 * 1000
  world.reload()
  const tree = await world.load()
  assert.match(noticeText(tree), /^An import may still be running\. It was started at .+ and can take a few minutes to finish\. Refresh in a few minutes to see what it added\.$/)
  assert.equal(importButtonOf(tree).props.disabled, false, 'the person is not locked out')
  assert.equal(server.count('backfill'), 1, 'only the first import ever asked the service')
  assert.doesNotMatch(text(tree), /Importing…/)
  const refresh = rawButtons(noticeOf(tree), 'Refresh')
  assert.equal(refresh.length, 1)
  refresh[0].props.onClick(); await settle()
  assert.equal(server.count('stats'), 3, 'Refresh re-reads the graph (twice before, once now)')
  assert.match(noticeText(world.view()), /^An import may still be running/, 'refreshing does not hide it')
  assert.ok(readMarker(world), 'the marker stays while the import may be running')
})

check('S1: flag on, a marker older than ten minutes reads as an interrupted import; dismissing it forgets it', async ({ shell }) => {
  const browser = sharedBrowser()
  const world = mountPage({ shell, server: createServer({ backfill: hang }), ...browser })
  await world.load(); await startImport(world)
  browser.clock.t += 11 * MIN
  world.reload()
  const tree = await world.load()
  assert.match(noticeText(tree), /^An earlier import stopped before it finished, because the page was closed or reloaded\. Sessions it already added are kept\. Run Import past sessions again to continue; sessions already in your graph are skipped\.$/)
  assert.equal(rawButtons(noticeOf(tree), 'Refresh').length, 0)
  all(tree, item => item.type === 'button' && item.props['aria-label'] === 'Dismiss import message')[0].props.onClick()
  assert.equal(world.view().props.children?.length === undefined ? 0 : all(world.view(), item => item.type === 'div' && item.props.role === 'status').length, 0, 'dismissed')
  assert.equal(readMarker(world), null, 'the interrupted marker is forgotten')
  world.reload()
  assert.equal(all(await world.load(), item => item.type === 'div' && item.props.role === 'status').length, 0, 'and does not come back')
})

check('S1: flag on, dismissing the "may still be running" notice hides it for now but keeps the marker', async ({ shell }) => {
  const browser = sharedBrowser()
  const world = mountPage({ shell, server: createServer({ backfill: hang }), ...browser })
  await world.load(); await startImport(world)
  world.reload()
  const tree = await world.load()
  all(tree, item => item.type === 'button' && item.props['aria-label'] === 'Dismiss import message')[0].props.onClick()
  assert.ok(readMarker(world))
  world.reload()
  assert.match(noticeText(await world.load()), /may still be running/)
})

check('S1: flag on, the marker is per account and carries no account identity; another account never sees it', async ({ shell }) => {
  const browser = sharedBrowser()
  const world = mountPage({ shell, server: createServer({ backfill: hang }), ...browser })
  await world.load(); await startImport(world)
  const keys = [...world.storage.map.keys()]
  assert.equal(keys.length, 1)
  assert.doesNotMatch(keys[0] + world.storage.map.get(keys[0]), /fixture-owner|user:|@/, 'no account key or email in the key or the value')
  const other = mountPage({ shell, kg: access('user:someone-else@example.com'), server: createServer(), ...browser })
  const tree = await other.load()
  assert.equal(all(tree, item => item.type === 'div' && item.props.role === 'status').length, 0, 'another account sees nothing')
  assert.ok(keys[0].includes(world.loader.load(LIB).ownerTag(OWNER)))
  assert.notEqual(world.loader.load(LIB).ownerTag(OWNER), world.loader.load(LIB).ownerTag('user:someone-else@example.com'))
})

check('S1: flag on, unusable storage changes nothing (blocked, full, corrupt, wrong version, expired)', async ({ shell }) => {
  for (const storage of [createStorage({ broken: true }), createStorage({ denied: true })]) {
    const blocked = mountPage({ shell, server: createServer({ backfill: () => respond(200, batchOf()) }), storage })
    const view = await blocked.load()
    assert.equal(all(view, item => item.type === 'div' && item.props.role === 'status').length, 0)
    await startImport(blocked)
    assert.match(noticeText(blocked.view()), /^Imported 3 session IDs/, 'the import itself is unaffected')
  }
  const world = mountPage({ shell })
  const lib = world.loader.load(LIB)
  const bad = [['corrupt', '{not json'], ['wrong version', JSON.stringify({ v: 2, startedAt: CLOCK0, activeAt: CLOCK0 })], ['no times', JSON.stringify({ v: 1 })], ['expired', JSON.stringify({ v: 1, startedAt: CLOCK0 - 30 * 60 * MIN, activeAt: CLOCK0 - 25 * 60 * MIN })], ['not an object', '7']]
  for (const [label, raw] of bad) {
    const browser = sharedBrowser()
    browser.storage.map.set(lib.IMPORT_MARKER_PREFIX + lib.ownerTag(OWNER), raw)
    const page = mountPage({ shell, server: createServer(), ...browser })
    const view = await page.load()
    assert.equal(all(view, item => item.type === 'div' && item.props.role === 'status').length, 0, label)
    assert.equal(browser.storage.map.size, 0, `${label}: the unusable marker is removed`)
  }
})

check('S1: flag on, the notice survives the page\'s start-up (loading, then a moment of no access, then ready), and an access-change notice is never replaced', async ({ shell }) => {
  const browser = sharedBrowser()
  const world = mountPage({ shell, server: createServer({ backfill: hang }), ...browser })
  await world.load(); await startImport(world)
  world.reload()
  // what the real hook does on a reload: loading, then settings not read yet (blocked), then ready
  world.render({ kg: { ...access(), isLoading: true } })
  world.render({ kg: { ...access(), isSubscribed: false, settings: null } })
  const tree = await world.load({ kg: access() })
  assert.match(noticeText(tree), /^An import may still be running/)
  // access lost while an import runs: its own notice stays even though the marker is still there
  const second = mountPage({ shell, server: createServer({ backfill: hang }), ...sharedBrowser() })
  await second.load(); await startImport(second)
  second.render({ kg: { ...access(), isSubscribed: false, settings: null } })
  second.render({ kg: access() }); await settle()
  assert.match(noticeText(second.view()), /^Import interrupted because Knowledge access changed/)
})

check('S1: flag on, a marker alone never starts an import; a reload mid-import does not repeat requests', async ({ shell }) => {
  const browser = sharedBrowser()
  const server = createServer({ backfill: hang })
  const world = mountPage({ shell, server, ...browser })
  await world.load(); await startImport(world)
  for (let i = 0; i < 3; i++) { world.reload(); await world.load() }
  assert.equal(server.count('backfill'), 1)
})

check('S1: flag on, leaving the page keeps the marker; a newer import in another tab keeps its own marker when this one ends', async ({ shell }) => {
  const browser = sharedBrowser()
  let release
  const server = createServer({ backfill: () => new Promise(resolve => { release = () => resolve(respond(200, batchOf())) }) })
  const world = mountPage({ shell, server, ...browser })
  await world.load(); await startImport(world)
  assert.ok(readMarker(world))
  world.unmount()
  release(); await settle(20)
  assert.ok(readMarker(world), 'an import cut short by leaving the page keeps its marker')

  // another tab's newer import
  const tabA = sharedBrowser()
  let releaseA
  const a = mountPage({ shell, server: createServer({ backfill: () => new Promise(resolve => { releaseA = () => resolve(respond(200, batchOf())) }) }), ...tabA })
  await a.load(); await startImport(a)
  const lib = a.loader.load(LIB)
  const newer = { v: 1, startedAt: tabA.clock.t + 5000, activeAt: tabA.clock.t + 5000 }
  tabA.storage.map.set(lib.IMPORT_MARKER_PREFIX + lib.ownerTag(OWNER), JSON.stringify(newer))
  releaseA(); await settle(20)
  assert.deepEqual(readMarker(a), newer, 'the first import ending does not erase the newer import\'s marker')
})

check('S1: flag off writes and reads no marker and shows no notice after a reload', async ({ shell }) => {
  const browser = sharedBrowser()
  const world = mountPage({ flag: false, shell, server: createServer({ backfill: hang }), ...browser })
  await world.load(); await startImport(world)
  world.reload()
  const tree = await world.load()
  assert.deepEqual(browser.storage.log, [])
  assert.equal(all(tree, item => item.type === 'div' && item.props.role === 'status').length, 0)
})

check('S1: marker states and texts', async () => {
  const lib = mountPage().loader.load(LIB)
  const marker = { v: 1, startedAt: CLOCK0, activeAt: CLOCK0 }
  assert.equal(lib.importMarkerState(marker, CLOCK0 + 10 * MIN), 'running')
  assert.equal(lib.importMarkerState(marker, CLOCK0 + 10 * MIN + 1), 'interrupted')
  assert.equal(lib.importMarkerState(marker, CLOCK0 - 5 * MIN), 'running', 'a clock set back is not an interruption')
  assert.equal(lib.resumedImportNotice(marker, CLOCK0 + 2 * MIN).kind, 'resumed')
  assert.equal(lib.resumedImportNotice(marker, CLOCK0 + 20 * MIN).kind, 'interrupted')
  assert.equal(lib.ownerTag('user:a'), lib.ownerTag('user:a'))
  assert.match(lib.ownerTag('user:a'), /^[0-9a-f]{8}$/)
})

const MARKER_KEY_RE = /deckster:knowledge:import-marker:v1:/
mutant('no marker is written when an import starts', { [PAGE]: [['if (KNOWLEDGE_FIXES) writeImportMarker(markerOwner, markerStartedAt, markerStartedAt)', '']] })
mutant('the marker is not refreshed after a batch', { [PAGE]: [['if (KNOWLEDGE_FIXES) touchImportMarker(markerOwner, markerStartedAt)', '']] })
mutant('the marker is not cleared when the import finishes', { [PAGE]: [['if (KNOWLEDGE_FIXES) clearImportMarker(markerOwner, markerStartedAt)', '']] })
mutant('the marker is cleared even by an import cut short by leaving the page', { [PAGE]: [['      if (await admitted() && isCurrent()) {\n        // Flag on: the import finished', '      if (KNOWLEDGE_FIXES) clearImportMarker(markerOwner)\n      if (await admitted() && isCurrent()) {\n        // Flag on: the import finished']] })
mutant('an import ending clears the newer import\'s marker', { [LIB]: [['      if (marker && marker.startedAt !== startedAt) return\n', '']] })
mutant('a batch revives or rewrites another import\'s marker', { [LIB]: [['if (marker && marker.startedAt === startedAt) writeImportMarker(owner, startedAt, now, store)', 'writeImportMarker(owner, startedAt, now, store)']] })
mutant('the marker is shared by every account', { [LIB]: [['  return hash.toString(16).padStart(8, "0")', '  return "shared"']] })
mutant('the marker key carries the account key', { [LIB]: [['  let hash = 0x811c9dc5', '  return accountKey\n  let hash = 0x811c9dc5']] })
mutant('blocked storage breaks the page', { [LIB]: [['    return typeof window === "undefined" ? null : window.localStorage\n  } catch {\n    return null\n  }', '    return typeof window === "undefined" ? null : window.localStorage\n  } finally {\n  }']] })
mutant('a corrupt marker is believed', { [LIB]: [['if (!isRecord(parsed) || parsed.v !== 1 || typeof parsed.startedAt !== "number" || typeof parsed.activeAt !== "number") {', 'if (false) {']] })
mutant('an old marker is never forgotten', { [LIB]: [['if (now - parsed.activeAt > IMPORT_MARKER_MAX_AGE_MS) {', 'if (false) {']] })
mutant('every marker reads as still running', { [LIB]: [['return now - marker.activeAt <= IMPORT_FRESH_MS ? "running" : "interrupted"', 'return "running"']] })
mutant('every marker reads as interrupted', { [LIB]: [['return now - marker.activeAt <= IMPORT_FRESH_MS ? "running" : "interrupted"', 'return "interrupted"']] })
mutant('the notice is not shown on return', { [PAGE]: [['    setImportNotice(current => current ?? { tone: "neutral", kind: found.kind, text: found.text })', '']] })
mutant('the marker is read with the flag off', { [PAGE]: [['    if (!KNOWLEDGE_FIXES || accessStatus !== "ready" || importActiveRef.current) return\n    const marker', '    if (accessStatus !== "ready" || importActiveRef.current) return\n    const marker']] })
mutant('the marker is read before access is ready (a later access change wipes the notice)', { [PAGE]: [['    if (!KNOWLEDGE_FIXES || accessStatus !== "ready" || importActiveRef.current) return\n    const marker', '    if (!KNOWLEDGE_FIXES || importActiveRef.current) return\n    const marker'], ['  }, [operationOwner, accessStatus, accessRevision])', '  }, [operationOwner])']] })
mutant('the notice replaces one that is already shown', { [PAGE]: [['setImportNotice(current => current ?? { tone: "neutral", kind: found.kind, text: found.text })', 'setImportNotice({ tone: "neutral", kind: found.kind, text: found.text })']] })
mutant('the marker is written with the flag off', { [PAGE]: [['if (KNOWLEDGE_FIXES) writeImportMarker(markerOwner, markerStartedAt, markerStartedAt)', 'writeImportMarker(markerOwner, markerStartedAt, markerStartedAt)']] })
mutant('no Refresh in the "may still be running" notice', { [PAGE]: [['{KNOWLEDGE_FIXES && importNotice.kind === "resumed" && (', '{false && importNotice.kind === "resumed" && (']] })
mutant('dismissing an interrupted notice keeps its marker', { [PAGE]: [['if (KNOWLEDGE_FIXES && importNotice.kind === "interrupted") clearImportMarker(ownerTag(operationOwner));', '']] })
mutant('dismissing any notice forgets the marker', { [PAGE]: [['if (KNOWLEDGE_FIXES && importNotice.kind === "interrupted") clearImportMarker(ownerTag(operationOwner));', 'if (KNOWLEDGE_FIXES) clearImportMarker(ownerTag(operationOwner));']] })

// ===========================================================================================================================================
// 4. safety: "Import past sessions" writes to the person's real graph, so it asks first and never auto-runs
// ===========================================================================================================================================

const dialogOf = tree => all(tree, item => item.type === 'AlertDialog')[0]
const dialogText = tree => text(all(tree, item => item.type === 'AlertDialogContent')[0]).replace(/\s+/g, ' ').trim()
const confirmButton = tree => all(all(tree, item => item.type === 'AlertDialogContent')[0], item => item.type === 'AlertDialogAction')[0]
const emptyWorld = (options = {}) => mountPage({ ...options, server: createServer({ stats: respond(200, { ...STATS, node_count: 0, nodes_by_type: [], top_entities: [] }), graph: respond(200, EMPTY_GRAPH), backfill: () => respond(200, batchOf()), ...(options.routes ?? {}) }) })

check('safety: flag on, "Import past sessions" opens a dialog that names what is written; nothing is requested until confirm', async ({ shell }) => {
  const server = createServer({ backfill: () => respond(200, batchOf()) })
  const world = mountPage({ shell, server })
  let tree = await world.load()
  assert.equal(dialogOf(tree).props.open, false, 'closed until asked')
  importButtonOf(tree).props.onClick()
  tree = world.view()
  assert.equal(dialogOf(tree).props.open, true)
  assert.equal(server.count('backfill'), 0, 'opening the dialog asks nothing')
  const body = dialogText(tree)
  assert.match(body, /Add your past sessions to your knowledge graph\?/)
  assert.match(body, /past sessions that have uploads, research or a finished deck/)
  assert.match(body, /write what it finds into your saved knowledge graph/)
  assert.match(body, /entities: the people, organizations, products and ideas it recognizes/)
  assert.match(body, /relations: how those entities connect/)
  assert.match(body, /evidence: short source snippets that back each entity/)
  assert.match(body, /This is your real graph, not a practice copy\. Sessions already in your graph are skipped\. Up to 50 sessions/)
  assert.match(body, /Keep this page open until it finishes/)
  assert.match(body, /Cancel/)
  assert.match(text(confirmButton(tree)), /^Import sessions$/)
  assert.equal(role(tree, 'import-confirm-warning').length, 0, 'no warning without another import')
  assert.equal(server.count('backfill'), 0)
})

check('safety: flag on, Cancel, Escape and a click outside close the dialog without a request', async ({ shell }) => {
  const server = createServer({ backfill: () => respond(200, batchOf()) })
  const world = mountPage({ shell, server })
  await world.load()
  importButtonOf(world.view()).props.onClick()
  dialogOf(world.view()).props.onOpenChange(false)   // what Radix calls for Cancel, Escape and the overlay
  await settle()
  assert.equal(dialogOf(world.view()).props.open, false)
  assert.equal(server.count('backfill'), 0)
  importButtonOf(world.view()).props.onClick()
  assert.equal(dialogOf(world.view()).props.open, true, 'it can be opened again')
})

check('safety: flag on, confirm starts exactly one import (POST, cursor 0), once, and closes the dialog', async ({ shell }) => {
  const server = createServer({ backfill: () => respond(200, batchOf()) })
  const world = mountPage({ shell, server })
  await world.load()
  importButtonOf(world.view()).props.onClick()
  const action = confirmButton(world.view())
  action.props.onClick()
  dialogOf(world.view()).props.onOpenChange(false)   // Radix closes an AlertDialog after its action's own handler
  action.props.onClick()                              // a second click on the same handler
  await settle(20)
  assert.equal(server.count('backfill'), 1)
  assert.deepEqual(server.calls.filter(call => call.name === 'backfill').map(call => [call.method, call.url]), [['POST', '/api/knowledge-graph/backfill?cursor=0']])
  assert.equal(dialogOf(world.view()).props.open, false)
  assert.match(noticeText(world.view()), /^Imported 3 session IDs/)
})

check('safety: flag on, the empty map\'s Import button and the failed-import Retry open the same dialog; neither starts an import', async ({ shell }) => {
  const empty = emptyWorld({ shell })
  await empty.load()
  const buttonsFound = buttons(empty.view(), 'Import past sessions')
  assert.equal(buttonsFound.length, 2, 'header and empty map')
  buttonsFound.at(-1).props.onClick()
  assert.equal(dialogOf(empty.view()).props.open, true)
  assert.equal(empty.server.count('backfill'), 0)

  const failing = mountPage({ shell, server: createServer({ backfill: () => respond(500, { error: 'x' }) }) })
  await failing.load()
  importButtonOf(failing.view()).props.onClick()
  confirmButton(failing.view()).props.onClick(); await settle(20)
  assert.equal(failing.server.count('backfill'), 1)
  rawButtons(noticeOf(failing.view()), 'Retry')[0].props.onClick()
  assert.equal(dialogOf(failing.view()).props.open, true, 'Retry asks first')
  assert.equal(failing.server.count('backfill'), 1)
  confirmButton(failing.view()).props.onClick(); await settle(20)
  assert.equal(failing.server.count('backfill'), 2)
})

check('safety: flag on, nothing but the dialog\'s confirm ever starts an import (mount, reload, markers, refresh, retry, search, selection)', async ({ shell }) => {
  const browser = sharedBrowser()
  const server = createServer({ backfill: () => respond(200, batchOf()), search: respond(200, { nodes: [] }), node: respond(200, { node: GRAPH.nodes[0], evidence: [], provenance_session_ids: [], edges: [] }) })
  const world = mountPage({ shell, server, ...browser })
  await world.load()
  const lib = world.loader.load(LIB)
  browser.storage.map.set(lib.IMPORT_MARKER_PREFIX + lib.ownerTag(OWNER), JSON.stringify({ v: 1, startedAt: browser.clock.t - MIN, activeAt: browser.clock.t - MIN }))
  world.reload(); await world.load()
  server.routes.stats = networkDown
  world.reload(); let tree = await world.load()
  buttons(tree, 'Retry')[0].props.onClick(); await settle()
  server.routes.stats = respond(200, STATS)
  buttons(world.view(), 'Retry')[0].props.onClick(); await settle()
  if (shell) { buttons(world.view(), 'Refresh')[0].props.onClick(); await settle() }
  all(world.view(), item => item.type === 'Input')[0].props.onChange({ target: { value: 'x' } })
  all(world.view(), item => item.type === 'form')[0].props.onSubmit({ preventDefault() {} }); await settle()
  all(world.view(), item => item.type === 'KgGraphView')[0].props.onSelect('n1'); world.render(); await settle()
  rawButtons(world.view(), 'Refresh').forEach(button => button.props.onClick())
  await settle()
  assert.equal(server.count('backfill'), 0)
})

check('safety: flag on, the dialog warns when another import may still be running, and only then', async ({ shell }) => {
  const browser = sharedBrowser()
  const server = createServer({ backfill: hang })
  const tabA = mountPage({ shell, server, ...browser })
  await tabA.load(); await startImport(tabA)
  const tabB = mountPage({ shell, server: createServer(), ...browser })
  await tabB.load()
  importButtonOf(tabB.view()).props.onClick()
  const warning = role(tabB.view(), 'import-confirm-warning')
  assert.equal(warning.length, 1)
  assert.match(text(warning[0]), /^An import started at .+, possibly in another tab or before a reload, may still be running\. Starting another one now can repeat the same work\.$/)
  browser.clock.t += 11 * MIN
  tabB.reload(); await tabB.load()
  importButtonOf(tabB.view()).props.onClick()
  assert.equal(role(tabB.view(), 'import-confirm-warning').length, 0, 'an interrupted import is not a running one')
})

check('safety: flag on, a dialog left open does not survive a change of access, and double-opening does not stack', async ({ shell }) => {
  const server = createServer({ backfill: () => respond(200, batchOf()) })
  const world = mountPage({ shell, server })
  await world.load()
  importButtonOf(world.view()).props.onClick()
  importButtonOf(world.view()).props.onClick()
  assert.equal(all(world.view(), item => item.type === 'AlertDialog').length, 1)
  world.render({ kg: { ...access(), isSubscribed: false } })   // access lost: the paused screen
  world.render({ kg: access() })                                // and restored
  await settle()
  assert.equal(dialogOf(world.view()).props.open, false)
  assert.equal(server.count('backfill'), 0)
})

check('safety: flag on, a stale confirm or a stale Import click while an import runs neither starts nor re-opens anything', async ({ shell }) => {
  const server = createServer({ backfill: hang })
  const world = mountPage({ shell, server })
  await world.load()
  const staleRequest = importButtonOf(world.view()).props.onClick
  staleRequest()
  const staleConfirm = confirmButton(world.view()).props.onClick
  staleConfirm()
  await settle()
  const starts = () => world.storage.log.filter(([op]) => op === 'set').length
  assert.equal(starts(), 1, 'one import started')
  staleConfirm(); staleConfirm()
  await settle()
  assert.equal(starts(), 1, 'a stale confirm does not start another')
  staleRequest()
  assert.equal(dialogOf(world.view()).props.open, false, 'a stale Import click does not re-open the dialog')
  assert.equal(server.count('backfill'), 1)
})

check('safety: flag on, the dialog closes itself on confirm (it does not rely on the dialog library to do it)', async ({ shell }) => {
  const world = mountPage({ shell, server: createServer({ backfill: () => respond(200, batchOf()) }) })
  await world.load()
  importButtonOf(world.view()).props.onClick()
  assert.equal(dialogOf(world.view()).props.open, true)
  const raw = all(world.render(), item => typeof item.type === 'function' && item.type.name === 'KnowledgeImportConfirm')[0]
  raw.props.onConfirm()
  assert.equal(dialogOf(world.view()).props.open, false)
  await settle(20)
})

check('safety: flag off, the buttons start the import at once and there is no dialog (the base)', async ({ shell }) => {
  const server = createServer({ backfill: () => respond(200, batchOf()) })
  const world = mountPage({ flag: false, shell, server })
  await world.load()
  assert.equal(all(world.view(), item => item.type === 'AlertDialog').length, 0)
  importButtonOf(world.view()).props.onClick()
  await settle(20)
  assert.equal(server.count('backfill'), 1)
})

check('safety wiring: runImport is started from exactly the dialog\'s confirm (and by the flag-off buttons)', onlyOnBranch(async () => {
  const source = read(PAGE)
  const uses = [...source.matchAll(/\brunImport\b/g)].map(match => source.slice(source.lastIndexOf('\n', match.index) + 1, source.indexOf('\n', match.index)).trim())
  assert.deepEqual(uses.map(line => line.replace(/\s+/g, ' ')), [
    'const runImport = useCallback(async () => {',
    '<Button variant="outline" onClick={KNOWLEDGE_FIXES ? requestImport : runImport} disabled={importing}>',
    '<Button onClick={KNOWLEDGE_FIXES ? requestImport : runImport} disabled={importing}><Import className="mr-2 h-4 w-4" /> Import past sessions</Button>',
    'onConfirm={() => { setImportConfirm(null); if (!importActiveRef.current) void runImport() }}',
  ])
  assert.equal((source.match(/backfill/g) ?? []).length, 1, 'the page names the backfill route once')
}))

mutant('the header button imports at once again', { [PAGE]: [['<Button variant="outline" onClick={KNOWLEDGE_FIXES ? requestImport : runImport} disabled={importing}>', '<Button variant="outline" onClick={runImport} disabled={importing}>']] })
mutant('the empty map button imports at once again', { [PAGE]: [['<Button onClick={KNOWLEDGE_FIXES ? requestImport : runImport} disabled={importing}><Import', '<Button onClick={runImport} disabled={importing}><Import']] })
mutant('Retry imports at once', { [PAGE]: [['<button type="button" onClick={() => requestImport()}', '<button type="button" onClick={() => void runImport()}']] })
mutant('confirm does not start the import', { [PAGE]: [['if (!importActiveRef.current) void runImport() }}', '}}']] })
mutant('confirm can start a second import', { [PAGE]: [['if (!importActiveRef.current) void runImport() }}', 'void runImport() }}']] })
mutant('cancel starts the import', { [PAGE]: [['onCancel={() => setImportConfirm(null)}', 'onCancel={() => { setImportConfirm(null); void runImport() }}']] })
mutant('the dialog is always open', { [PAGE]: [['open={importConfirm !== null}', 'open={true}']] })
mutant('the dialog opens while an import runs', { [PAGE]: [['    if (importActiveRef.current) return\n    setImportConfirm', '    setImportConfirm']] })
mutant('the dialog stays open after confirm', { [PAGE]: [['onConfirm={() => { setImportConfirm(null); if', 'onConfirm={() => { if']] })
mutant('the dialog survives a change of access', { [PAGE]: [['      setImportConfirm(null)\n      setImportNotice(retainInterruptedNotice', '      setImportNotice(retainInterruptedNotice']] })
mutant('the dialog never warns about another import', { [LIB]: [['if (!marker || importMarkerState(marker, now) !== "running") return null', 'return null']] })
mutant('the dialog warns about interrupted imports too', { [LIB]: [['if (!marker || importMarkerState(marker, now) !== "running") return null', 'if (!marker) return null']] })
mutant('the dialog does not name the relations', { [CONFIRM]: [['<li>relations: how those entities connect</li>', '']] })
mutant('the dialog does not name the evidence', { [CONFIRM]: [['<li>evidence: short source snippets that back each entity</li>', '']] })
mutant('the dialog does not say it is the real graph', { [CONFIRM]: [['This is your real graph, not a practice copy. ', '']] })
mutant('the dialog is not rendered', { [PAGE]: [['      {KNOWLEDGE_FIXES && (\n        <KnowledgeImportConfirm', '      {false && (\n        <KnowledgeImportConfirm']] })

// ===========================================================================================================================================
// 5. S4: singular and plural
// ===========================================================================================================================================

async function importMessage(shell, extra, flag = true) {
  const world = mountPage({ flag, shell, server: createServer({ backfill: () => respond(200, batchOf(extra)) }) })
  await world.load(); await startImport(world)
  return noticeText(world.view())
}

check('S4: flag on, "1 new entity", "1 needs another attempt", "1 was already in your graph" (and the plural forms stay plural)', async ({ shell }) => {
  assert.match(await importMessage(shell, { entities_created: 1, entities_merged: 1 }), /\. 1 new entity and 1 reinforced\.$/)
  assert.match(await importMessage(shell, { entities_created: 0, entities_merged: 0 }), /\. 0 new entities and 0 reinforced\.$/)
  assert.match(await importMessage(shell, { entities_created: 2 }), /\. 2 new entities and 1 reinforced\.$/)
  assert.match(await importMessage(shell, { sessions_completed: 2, sessions_retryable: 1 }), /^Processed 3 session IDs: 2 completed, 1 needs another attempt\./)
  assert.match(await importMessage(shell, { sessions_completed: 1, sessions_retryable: 2 }), /^Processed 3 session IDs: 1 completed, 2 need another attempt\./)
  assert.match(await importMessage(shell, { sessions_already_consolidated: 1 }), / 1 was already in your graph\.$/)
  assert.match(await importMessage(shell, { sessions_already_consolidated: 4 }), / 4 were already in your graph\.$/)
  assert.match(await importMessage(shell, { sessions_processed: 1, sessions_completed: 1 }), /^Imported 1 session ID: 1 completed\./)
})

check('S4: flag on, the progress line and the "processed before import paused" line agree with their counts', async ({ shell }) => {
  let n = 0
  const progress = mountPage({ shell, server: createServer({ backfill: () => (++n === 1 ? respond(200, batchOf({ sessions_processed: 1, sessions_completed: 1, total_candidates: 1, next_cursor: 1 })) : hang()) }) })
  await progress.load(); await startImport(progress)
  assert.match(noticeText(progress.view()), /^Processed 1 of 1 eligible session ID · 1 completed…$/)
  let m = 0
  const failed = mountPage({ shell, server: createServer({ backfill: () => (++m === 1 ? respond(200, batchOf({ sessions_processed: 1, sessions_completed: 1, total_candidates: 4, next_cursor: 1 })) : networkDown()) }) })
  await failed.load(); await startImport(failed)
  assert.match(noticeText(failed.view()), /^1 session ID was processed before import paused\./)
  let k = 0
  const several = mountPage({ shell, server: createServer({ backfill: () => (++k === 1 ? respond(200, batchOf({ total_candidates: 4, next_cursor: 3 })) : networkDown()) }) })
  await several.load(); await startImport(several)
  assert.match(noticeText(several.view()), /^3 session IDs were processed before import paused\./)
})

check('S4: flag on, the counts in the summary and over the map say "1 entity", "1 relation", "1 session"', async ({ shell }) => {
  const one = mountPage({ shell, server: createServer({ stats: respond(200, { ...STATS, node_count: 1, edge_count: 1, sessions_consolidated: 1 }), graph: respond(200, { ...GRAPH, total_nodes: 1 }) }) })
  const tree = await one.load()
  assert.match(text(tree), /Showing 2 of 1 entity/)
  if (shell) assert.match(text(tree), /1 entity · 1 relation · 11 evidence · 1 session(?!s)/)
  const many = mountPage({ shell })
  const loaded = await many.load()
  assert.match(text(loaded), /Showing 2 of 9 entities/)
  if (shell) assert.match(text(loaded), /9 entities · 9 relations · 11 evidence · 1 session(?!s)/, 'the counts stay plural where they are not 1')
})

check('S4: flag off keeps the old wording ("1 new entities", "1 were already in your graph")', async ({ shell }) => {
  const message = await importMessage(shell, { sessions_processed: 1, sessions_completed: 1, entities_created: 1, sessions_already_consolidated: 1, sessions_retryable: 0 }, false)
  assert.match(message, /1 new entities and 1 reinforced\. 1 were already in your graph\./)
})

mutant('the singular is never used', { [PAGE]: [['const noun = (count: number | undefined, one: string, many: string) => (KNOWLEDGE_FIXES && count === 1 ? one : many)', 'const noun = (count: number | undefined, one: string, many: string) => many']] })
mutant('the singular is used with the flag off', { [PAGE]: [['const noun = (count: number | undefined, one: string, many: string) => (KNOWLEDGE_FIXES && count === 1 ? one : many)', 'const noun = (count: number | undefined, one: string, many: string) => (count === 1 ? one : many)']] })
mutant('zero reads as singular', { [PAGE]: [['KNOWLEDGE_FIXES && count === 1 ? one : many', 'KNOWLEDGE_FIXES && (count ?? 0) <= 1 ? one : many']] })
mutant('the entity count word is not singular', { [PAGE]: [['new ${noun(totals.entitiesCreated, "entity", "entities")} and', 'new entities and']] })
mutant('the already-in-your-graph verb is not singular', { [PAGE]: [['${noun(totals.alreadyPresent, "was", "were")} already', 'were already']] })
mutant('the needs-another-attempt verb is not singular', { [PAGE]: [['${noun(totals.retryable, "needs", "need")} another attempt', 'need another attempt']] })
mutant('the progress line is not singular', { [PAGE]: [['eligible session ${noun(totalCandidates, "ID", "IDs")} ·', 'eligible session IDs ·']] })
mutant('the paused line is not singular', { [PAGE]: [['${noun(totals.processed, "ID was", "IDs were")} processed before', 'IDs were processed before']] })
mutant('the summary line is not singular', { [PAGE]: [['${noun(stats.sessions_consolidated, "session", "sessions")}`', 'sessions`']] })
mutant('the map header is not singular', { [PAGE]: [['${noun(graph.total_nodes, "entity", "entities")}`', 'entities`']] })

// ===========================================================================================================================================
// flag off = the base, byte for byte: render hashes over a matrix of states (markup, requests, console, storage)
// ===========================================================================================================================================

// React renders nothing for an undefined prop or for a null / boolean child, so those are omitted (an undefined property is dropped by
// JSON.stringify; the filter drops the `false` of `{flag && <x/>}`, and a one-element list is its element) rather than recorded: the hashes
// cover what the DOM gets.
const serTree = value => JSON.stringify(value, (key, item) =>
  typeof item === 'function' ? (key === 'type' ? `[component ${item.name}]` : '[fn]')
    : Array.isArray(item) ? ((kept) => kept.length === 1 ? kept[0] : kept)(item.filter(entry => entry !== null && entry !== undefined && typeof entry !== 'boolean')) : item)

/**
 * Drives the page through the states below with the flag OFF and returns a hash per state of everything observable: the expanded markup
 * tree, the requests made, the console output and the storage calls. The goldens were recorded from the base tree (b0c5a4a).
 */
async function offStates(shell) {
  const states = {}
  const record = (name, world, extra = null) => {
    const view = world.view()
    if (process.env.DUMP_DIR) fs.writeFileSync(path.join(process.env.DUMP_DIR, `${shell ? 'studio' : 'classic'}-${name}.json`), JSON.stringify(JSON.parse(serTree({ view, calls: world.server.calls, logs: world.logs, storage: world.storage.log })), null, 1))
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
    "loading": "176908a50f25476e480e",
    "loaded": "2daa54d1cc309b1a5fc9",
    "empty": "a0b39b099a771b455180",
    "load-503": "4d24dca63ec2fae56899",
    "load-network": "7f38683e158af87d2952",
    "refresh-failed": "1d85082cc74b5fb2c6ad",
    "type-hidden": "46a27e4bd8556db93e0c",
    "importing": "c9316f08e396e1862db5",
    "import-success": "93d0613ff072c04201fd",
    "import-singular": "853841c27774a98c1b01",
    "import-partial": "06e28bf093e2e64c585b",
    "import-unfinished": "2db2a27295838b8d27a5",
    "import-no-sessions": "d094c3a06fb9533ceeda",
    "import-http-error": "18808cd3dac1b82a85f9",
    "import-http-error-bare": "db4181900d68f25b40ea",
    "import-network-error": "c675b8ef6e43425e2554",
    "import-error-after-batch": "99d9c56643078a2383b0",
    "import-dismissed": "f841b7ae48330251ef9d",
    "empty-import-success": "44c6aa80a3fca74d7e14",
    "search-hits": "f4b742ab977025754520",
    "search-error": "3a2ee484d6dc4ba0dae1",
    "search-network": "27a4ecd2c0984911222d",
    "detail-loaded": "fc239e9a8214a579b855",
    "detail-error": "405b74537bdaeb0a84ad",
    "detail-network": "384e32b8620e6cc64e8c",
    "gate-loading": "5031ff6f6463edd5061a",
    "gate-locked": "71b84c0d13ab9da2fe0f",
    "gate-unavailable": "376083621d64decd1a49",
    "gate-paused": "88d1d96a360894d0da0a",
    "default-export": "7f394dc27664a83a98b7",
    "missing-nodes-by-type": "e980ad1b24fa0c73f93b"
  },
  "classic": {
    "loading": "e2e35f2287af81419d3d",
    "loaded": "12c265d1a32fd28b3f29",
    "empty": "ab76b502464063e33726",
    "load-503": "cd236630ea797deeca14",
    "load-network": "b32c03d79a5fa8c3a4d1",
    "type-hidden": "7c0fe91484fc8ace7a3c",
    "importing": "bcd070d9e618e431a143",
    "import-success": "ae87fcb435dd2d0d5805",
    "import-singular": "0f711c59f2b6ed6a0e78",
    "import-partial": "e2d31bab74a61505a8a1",
    "import-unfinished": "1ee29115fc99c3903251",
    "import-no-sessions": "37ba5a4d6fbf085c79e1",
    "import-http-error": "fe681d1406f2d5fd9699",
    "import-http-error-bare": "ee639da0fab4f7069a11",
    "import-network-error": "e629a949be9ae9c24e46",
    "import-error-after-batch": "f5f38e9381118513437c",
    "import-dismissed": "7f71ef9fd20b10e6ef18",
    "empty-import-success": "9bfd8abb832c048af890",
    "search-hits": "59b997f35eada2d54fb3",
    "search-error": "248e93d82e055401b620",
    "search-network": "8fbfa08ce23dcb8161d8",
    "detail-loaded": "3f72ba973a008eb3e2dc",
    "detail-error": "6fd0fd174e5aec4c4f87",
    "detail-network": "1f53c524607e5d1b2b85",
    "gate-loading": "5031ff6f6463edd5061a",
    "gate-locked": "71b84c0d13ab9da2fe0f",
    "gate-unavailable": "376083621d64decd1a49",
    "gate-paused": "88d1d96a360894d0da0a",
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
