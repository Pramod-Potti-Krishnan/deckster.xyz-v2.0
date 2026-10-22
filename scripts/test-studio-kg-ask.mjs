// STUDIO KG ASK, "Ask your second brain" (FRONTEND-2, Pass 3): a question box on the Knowledge page that queries the Researcher's POST /api/v1/kg/query through a Next proxy and shows the cited result.
// Flag NEXT_PUBLIC_STUDIO_KG_ASK (exact "true"), default off, and only with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL "true"). With the flag off the page is the base's page, byte for byte in the
// rendered tree and in the requests it makes, and the proxy route answers 404 before it reads a session or calls the backend.
//
// What the Researcher returns (routers/kg.py, services/kg/retriever.py, schemas_kg.py on origin/uat): a retrieval context pack (nodes, edges, citations, and a prompt-injection text block), NOT a written answer.
// So the box shows the cited passages, each with its source link and its deck, and says so. The fixture below is shaped exactly like KgQueryResponse as the retriever builds it.
//
// Run: node scripts/test-studio-kg-ask.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   KG_ASK_BASE=<commit>        the commit flag-off identity is checked against (default bcd8aed0, the studio-v4-dev-preparation-code tip the work was branched from).
//   KG_ASK_SCHEMA=<file>        optional: a copy of backend/researcher schemas_kg.py (git show origin/uat:schemas_kg.py); the request shape is then also checked against the real KgQueryRequest.
//
// Proven on the REAL sources:
//   1. lib/studio-kg-ask.ts: import-free; the flag rule, the question guard, the two request bodies (pinned to KgQueryRequest), the normaliser (order, dedupe, caps, safe links, junk), the summary, the error words;
//   2. app/api/knowledge-graph/query/route.ts (executed with stubs for the session, the backend and Next): 404 with the flag off, the entitlement gate, the guard, the exact backend request, user_id only from the session, failures;
//   3. the hook and the component (executed with a small hooks runtime): idle, loading, answer with citations, nothing found, error + retry, guards, Enter submits, one request at a time, stale answers ignored;
//   4. the page wiring (executed against the base commit's page): flag off / shell off = the base's tree and requests; flag on = one box above the map, nothing else changed, no request on load;
//   5. the CSS (every rule hangs on the box's marker; tokens only, light and dark) and the env example;
//   6. mutation check: every mutant of the sources is killed by sections 1-5.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.KG_ASK_BASE || 'bcd8aed0d0e8d202c8859c4fd45ccae06de8e307'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseCache = new Map()
const baseSource = (rel, commit = BASE_COMMIT) => {
  const key = `${commit}:${rel}`
  if (!baseCache.has(key)) {
    try { baseCache.set(key, execFileSync('git', ['show', key], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })) }
    catch (error) { throw new Error(`base commit ${commit} is not in this clone (fetch the full history): ${error.message}`) }
  }
  return baseCache.get(key)
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm carry its realm's prototypes
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))
const same = count((a, b, message) => assert.ok(a === b, message)) // string equality without dumping two whole trees on failure

const LIB = 'lib/studio-kg-ask.ts'
const ROUTE = 'app/api/knowledge-graph/query/route.ts'
const HOOK = 'hooks/use-studio-kg-ask.ts'
const UI = 'components/knowledge/studio-kg-ask.tsx'
const CSS = 'components/knowledge/studio-kg-ask.css'
const PAGE = 'app/(app)/knowledge/page.tsx'
const ENV = '.env.example'
const P2_LIB = 'lib/studio-p2-second-brain.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_KG_ASK'
const SOURCES = Object.fromEntries([LIB, ROUTE, HOOK, UI, CSS, PAGE, ENV].map(rel => [rel, read(rel)]))

// ---------------------------------------------------------------- loading: transpile + vm, a small hooks runtime, inert strings for everything else
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null })
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' }
const inert = () => new Proxy({}, { get: (_target, key) => (key === '__esModule' ? false : String(key)) })
const compiled = new Map()
const compile = (source, fileName) => {
  if (!compiled.has(fileName + '\0' + source)) {
    const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
    assert.equal((out.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0, `${fileName} compiles`)
    compiled.set(fileName + '\0' + source, out.outputText)
  }
  return compiled.get(fileName + '\0' + source)
}
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
    useId() { const i = cursor++; return (cells[i] ??= { value: `:r${i}:` }).value },
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
  }
  react.default = react
  return {
    react,
    render(Component, props) {
      for (let tries = 0; tries < 14; tries++) {
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
}
let overrides = {} // a mutant of a shared file reaches every module that loads it
/** A module graph: `real` files are executed (their text from `sources`, else from disk), everything else is an inert string. */
function createWorld({ real, sources = {}, env = {}, stubs = {}, globals = {} }) {
  const runtime = createRuntime()
  const cache = new Map()
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(repoRoot, spec.slice(2)) : path.resolve(path.dirname(path.join(repoRoot, from)), spec)
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return path.relative(repoRoot, base + suffix)
    return null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec === 'react') return runtime.react
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) { const rel = resolve(spec, from); if (rel && real.has(rel)) return load(rel) }
    return inert()
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const mod = { exports: {} }
    cache.set(rel, mod.exports)
    let source = sources[rel] ?? overrides[rel] ?? read(rel)
    if (rel === PAGE) source += '\nexport { KnowledgePageForAccount };'
    vm.runInNewContext(compile(source, rel), { module: mod, exports: mod.exports, process: { env }, ...globals, require: spec => requireFor(spec, rel) })
    cache.set(rel, mod.exports)
    return mod.exports
  }
  return { load, runtime }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function settle(rounds = 8) { for (let i = 0; i < rounds; i++) await tick() }
const all = (tree, predicate, found = []) => {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(item => all(item, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props?.children, predicate, found)
  return found
}
const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children)
const flat = tree => text(tree).replace(/\s+/g, ' ').trim()
/** Function components expanded the way a render would (only components without hooks), so the result is host markup plus inert strings. */
function expand(node) {
  if (Array.isArray(node)) return node.map(expand)
  if (!node || typeof node !== 'object') return node
  const { type, props = {} } = node
  if (typeof type === 'function') return expand(type(props))
  const out = {}
  for (const [key, value] of Object.entries(props)) out[key] = key === 'children' ? expand(value) : value
  return { type, props: out, key: node.key ?? null }
}
/** What a person's render would show: functions and refs are not markup; false / null / undefined children and props are not markup. */
const ser = value => JSON.stringify(value, (key, item) => key === 'ref' ? undefined : typeof item === 'function' ? (key === 'type' ? `[component ${item.name}]` : '[fn]')
  : Array.isArray(item) ? ((kept) => kept.length === 1 ? kept[0] : kept)(item.filter(entry => entry !== null && entry !== undefined && typeof entry !== 'boolean')) : item)
/** The tree without every element of one type (the box), so "everything else is unchanged" can be compared to the base. */
function without(node, type) {
  if (Array.isArray(node)) return node.filter(item => !(item && typeof item === 'object' && !Array.isArray(item) && (item.type === type || item.type?.name === type))).map(item => without(item, type))
  if (!node || typeof node !== 'object') return node
  const out = {}
  for (const [key, value] of Object.entries(node.props ?? {})) out[key] = key === 'children' ? without(value, type) : value
  return { type: node.type, props: out, key: node.key ?? null }
}
/** The one element carrying a marker, or a failed assertion (a mutant that removes it must not crash the run). */
const pick = (tree, name) => { const found = all(tree, n => n.props?.[`data-studio-kg-ask-${name}`] === 'true')[0]; assert.ok(found, `the ${name} is shown`); return found }
const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => structuredClone(body) })
/** A fetch double: routes by URL prefix; every call is recorded with its method, headers, body and signal. A handler may return a promise (a held request) and sees the abort signal. */
function createFetch(routes) {
  const calls = []
  const fn = (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body, signal: init.signal })
    for (const [prefix, answer] of Object.entries(routes)) {
      if (!String(url).startsWith(prefix)) continue
      return new Promise((resolve, reject) => {
        const aborted = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        if (init.signal?.aborted) return aborted()
        init.signal?.addEventListener('abort', aborted)
        Promise.resolve(typeof answer === 'function' ? answer(String(url), init) : answer).then(resolve, reject)
      })
    }
    return Promise.reject(new Error(`fixture refuses ${url}`))
  }
  fn.calls = calls
  return fn
}
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }

// ---------------------------------------------------------------- fixtures
/** KgQueryResponse exactly as KgRetriever._query_inner builds it (pydantic JSON: Optional fields are null, never absent). Synthetic names only. */
const RESPONSE = {
  user_id: 'user-fixture',
  context_pack: '## Cross-Session Knowledge (from your previous research)\n\n**Key Entities:**\n- Q3 revenue (METRIC)\n\n**Supporting Evidence (cite with the [KGn] ids):**\n- [KG1] "Q3 revenue grew" (re: Q3 revenue — from q3-board-pack.pdf)\n',
  nodes: [
    { node_id: 'n-2', entity_type: 'ORG', name: 'Northwind Traders', description: 'A fixture company.', salience: 1.4, similarity: 0.82 },
    { node_id: 'n-1', entity_type: 'METRIC', name: 'Q3 revenue', description: null, salience: 2.0, similarity: 0.91 },
    { node_id: 'n-3', entity_type: 'PERSON', name: 'Casey Placeholder', description: null, salience: 0.7, similarity: null },
    { node_id: 'n-4', entity_type: 'product_line', name: 'Casey Placeholder', description: null, salience: 0.5, similarity: null },
  ],
  edges: [
    { src_name: 'Northwind Traders', dst_name: 'Q3 revenue', relation: 'REPORTS_METRIC', weight: 1.0 },
    { src_name: 'Northwind Traders', dst_name: 'Q3 revenue', relation: 'REPORTS_METRIC', weight: 0.5 },
    { src_name: '?', dst_name: 'Q3 revenue', relation: 'MENTIONS', weight: 1.0 },
    { src_name: 'Casey Placeholder', dst_name: 'Northwind Traders', relation: 'WORKS_AT', weight: 0.8 },
  ],
  citations: [
    { entity_name: 'Q3 revenue', snippet: 'Q3 revenue grew 12% year on year, led by the northern region.', source_type: 'chunk', source_ref: 'chunk-42', session_id: 'sess-aaa', url: null, document_filename: 'q3-board-pack.pdf', page_number: 7, chunk_id: 'chunk-42', table_id: null, sheet_name: null },
    { entity_name: 'Northwind Traders', snippet: 'Northwind opened two new depots in the spring.', source_type: 'web', source_ref: 'https://www.example.com/news/northwind', session_id: 'sess-bbb', url: 'https://www.example.com/news/northwind', document_filename: null, page_number: null, chunk_id: null, table_id: null, sheet_name: null },
    { entity_name: 'Northwind Traders', snippet: 'Q3 revenue grew 12% year on year, led by the northern region.', source_type: 'chunk', source_ref: 'chunk-42', session_id: 'sess-aaa', url: null, document_filename: 'q3-board-pack.pdf', page_number: 7, chunk_id: 'chunk-42', table_id: null, sheet_name: null },
    { entity_name: 'Casey Placeholder', snippet: '   ', source_type: 'chunk', source_ref: null, session_id: 'sess-ccc', url: null, document_filename: null, page_number: null, chunk_id: null, table_id: null, sheet_name: null },
    { entity_name: 'Casey Placeholder', snippet: 'Notes from the deck research.', source_type: 'researcher_context', source_ref: null, session_id: '', url: 'javascript:alert(1)', document_filename: null, page_number: null, chunk_id: null, table_id: null, sheet_name: null },
  ],
}
const EMPTY_RESPONSE = { user_id: 'user-fixture', context_pack: '', nodes: [], edges: [], citations: [] }
const NODES_ONLY = { ...EMPTY_RESPONSE, nodes: RESPONSE.nodes.slice(0, 2), edges: [RESPONSE.edges[0]] }
const many = (n, make) => Array.from({ length: n }, (_, i) => make(i))

// ---------------------------------------------------------------- 1. the helper
const PARSE_SCHEMA = file => {
  const block = fs.readFileSync(file, 'utf8').match(/class KgQueryRequest\(BaseModel\):[\s\S]*?(?=\n\nclass |\n# ====)/)
  assert.ok(block, 'KgQueryRequest is in the schema file')
  const fields = {}
  for (const line of block[0].split('\n')) {
    const m = line.match(/^    (\w+): (\w+) = Field\((.*)\)\s*$/)
    if (!m) continue
    const num = key => { const x = m[3].match(new RegExp(`${key}=([\\d.]+)`)); return x ? Number(x[1]) : undefined }
    fields[m[1]] = { type: m[2], min_length: num('min_length'), default: num('default'), ge: num('ge'), le: num('le') }
  }
  return fields
}
function proveLib(source, label = 'lib') {
  nomatch(source, /^\s*(?:import\b|export\s+\*?\s*from\b)|require\(/m, `${label}: import-free`)
  const module = { exports: {} }
  new Function('module', 'exports', compile(source, LIB))(module, module.exports)
  const lib = module.exports
  // the flag
  for (const [flag, shell, want] of [['true', 'true', true], ['true', 'false', false], ['true', undefined, false], ['true', 'TRUE', false], ['false', 'true', false], [undefined, 'true', false], ['1', 'true', false], ['TRUE', 'true', false], [' true', 'true', false], ['', 'true', false], [null, 'true', false]]) {
    eq(lib.studioKgAskOn(flag, shell), want, `${label}: flag ${JSON.stringify(flag)} with shell ${JSON.stringify(shell)}`)
  }
  eq(lib.STUDIO_KG_ASK_ENDPOINT, '/api/knowledge-graph/query', `${label}: the one route the UI calls`)
  // the question guard
  const check = lib.studioKgAskCheck
  for (const bad of ['', '   ', '\n\t', null, undefined, 5, {}, [], true]) { const r = check(bad); eq(r.ok, false, `${label}: ${JSON.stringify(bad)} is refused`); eq(r.reason, 'empty', `${label}: ...as empty`); eq(r.message, lib.STUDIO_KG_ASK_WORDS.guardEmpty, `${label}: ...with the empty words`) }
  deepEq(check('  what changed in Q3?  '), { ok: true, question: 'what changed in Q3?' }, `${label}: a question is trimmed`)
  eq(lib.STUDIO_KG_ASK_MAX_QUESTION, 500, `${label}: the question limit`)
  eq(lib.STUDIO_KG_ASK_COUNTER_FROM, 450, `${label}: the counter starts at 450`)
  eq(lib.STUDIO_KG_ASK_TIMEOUT_MS, 30000, `${label}: the timeout is 30 seconds`)
  eq(check('a'.repeat(500)).ok, true, `${label}: 500 characters pass`)
  const long = check('a'.repeat(501))
  eq(long.ok, false, `${label}: 501 characters are refused`); eq(long.reason, 'too_long', `${label}: ...as too long`); eq(long.message, lib.STUDIO_KG_ASK_WORDS.guardTooLong, `${label}: ...with the too-long words`)
  eq(check('  ' + 'a'.repeat(500) + '  ').ok, true, `${label}: the limit counts the trimmed question`)
  eq(check('😀'.repeat(500)).ok, true, `${label}: 500 emoji pass (code points, as the backend counts)`)
  eq(check('😀'.repeat(501)).ok, false, `${label}: 501 emoji are refused`)
  eq(lib.studioKgAskLength('  abc  '), 3, `${label}: length is of the trimmed text`)
  eq(lib.studioKgAskLength(7), 0, `${label}: length of a non-string is 0`)
  // the request bodies, pinned to KgQueryRequest (schemas_kg.py): user_id and query_text required (min_length 1); max_nodes 1..50 (8); hops 0..2 (1); min_similarity 0..1 (0.6); extra="ignore"
  deepEq(lib.studioKgAskClientBody('hello'), { query: 'hello' }, `${label}: the browser sends only the question`)
  const SCHEMA = { user_id: { required: true }, query_text: { required: true }, max_nodes: { ge: 1, le: 50, default: 8 }, hops: { ge: 0, le: 2, default: 1 }, min_similarity: { ge: 0, le: 1, default: 0.6 } }
  const body = lib.studioKgAskBackendBody('user-1', 'what changed?')
  deepEq(Object.keys(body).sort(), Object.keys(SCHEMA).sort(), `${label}: the backend body has exactly KgQueryRequest's fields`)
  eq(body.user_id, 'user-1', `${label}: user_id is the one given`); eq(body.query_text, 'what changed?', `${label}: query_text is the question`)
  for (const [key, rule] of Object.entries(SCHEMA)) if (rule.ge !== undefined) {
    ok(typeof body[key] === 'number' && body[key] >= rule.ge && body[key] <= rule.le, `${label}: ${key} ${body[key]} is inside ${rule.ge}..${rule.le}`)
    eq(body[key], rule.default, `${label}: ${key} is the backend's own default`)
  }
  eq(Number.isInteger(body.max_nodes) && Number.isInteger(body.hops), true, `${label}: max_nodes and hops are integers`)
  if (process.env.KG_ASK_SCHEMA) {
    const real = PARSE_SCHEMA(process.env.KG_ASK_SCHEMA)
    deepEq(Object.keys(real).sort(), Object.keys(SCHEMA).sort(), `${label}: the real KgQueryRequest has the fields the test pins`)
    for (const [key, rule] of Object.entries(SCHEMA)) {
      if (rule.ge !== undefined) deepEq([real[key].ge, real[key].le, real[key].default], [rule.ge, rule.le, rule.default], `${label}: real schema bounds of ${key}`)
      else eq(real[key].min_length, 1, `${label}: real schema: ${key} needs at least 1 character`)
    }
  }
  // links
  for (const [value, want] of [['https://example.com/a?b=1', 'https://example.com/a?b=1'], ['HTTP://Example.com/x', 'http://example.com/x'], ['  https://example.com/  ', 'https://example.com/'], ['javascript:alert(1)', null], ['data:text/html,x', null], ['ftp://example.com/x', null], ['file:///etc/passwd', null], ['/builder?session_id=x', null], ['//example.com/x', null], ['https://', null], ['', null], [null, null], [7, null]]) {
    eq(lib.studioKgAskWebUrl(value), want, `${label}: web url ${JSON.stringify(value)}`)
  }
  const p2 = { exports: {} }
  new Function('module', 'exports', compile(read(P2_LIB), P2_LIB))(p2, p2.exports)
  for (const id of ['sess-aaa', 'a b/c?d&e', 'ü-1', '../x']) eq(lib.studioKgAskDeckHref(id), p2.exports.studioDeckHref(id), `${label}: the deck link is the Second Brain deck list's (${id})`)
  eq(lib.studioKgAskDeckHref('a b/c'), '/builder?session_id=a%20b%2Fc', `${label}: the deck id is encoded`)
  // the normaliser
  const result = lib.studioKgAskNormalise(RESPONSE)
  deepEq(result.entities.map(e => [e.name, e.best, e.typeLabel]), [['Q3 revenue', true, 'metric'], ['Northwind Traders', true, 'org'], ['Casey Placeholder', false, 'person']], `${label}: entities: seeds by similarity first, then the rest by salience, one per name`)
  deepEq(result.entities.map(e => e.id), ['n-1', 'n-2', 'n-3'], `${label}: ...with the backend's node ids`)
  deepEq(result.connections.map(c => [c.from, c.relation, c.to]), [['Northwind Traders', 'REPORTS METRIC', 'Q3 revenue'], ['Casey Placeholder', 'WORKS AT', 'Northwind Traders']], `${label}: connections: a repeat and an unresolved ("?") name are dropped; underscores read as spaces`)
  eq(result.passages.length, 3, `${label}: passages: a repeat and an empty snippet are dropped`)
  deepEq(result.passages.map(p => p.number), [1, 2, 3], `${label}: ...numbered in the backend's order`)
  const [p1, p2n, p3] = result.passages
  eq(p1.snippet, RESPONSE.citations[0].snippet, `${label}: the passage text is the citation's snippet`)
  eq(p1.title, 'q3-board-pack.pdf', `${label}: a document passage is titled by its file`); eq(p1.meta, 'Uploaded document · p.7', `${label}: ...with its kind and page`); eq(p1.entity, 'Q3 revenue', `${label}: ...and the entity it is about`)
  deepEq(p1.links, [{ kind: 'deck', href: '/builder?session_id=sess-aaa', label: 'Open the deck', external: false }], `${label}: a document passage links to its deck only`)
  eq(p2n.title, 'example.com', `${label}: a web passage is titled by its host (no www)`); eq(p2n.meta, 'Web research', `${label}: ...with its kind, no page`)
  deepEq(p2n.links.map(l => [l.kind, l.href, l.external]), [['source', 'https://www.example.com/news/northwind', true], ['deck', '/builder?session_id=sess-bbb', false]], `${label}: a web passage links to the source (external) and to its deck`)
  eq(p3.title, 'Deck research', `${label}: a passage with no file or url is titled by its kind`); eq(p3.meta, '', `${label}: ...and the kind is not said twice`); deepEq(p3.links, [], `${label}: no deck id and an unsafe url = no links at all`)
  eq(lib.studioKgAskNormalise({ citations: [{ snippet: 'a', document_filename: 'f.pdf', source_type: 'chunk', page_number: 0 }, { snippet: 'b', document_filename: 'f.pdf', source_type: 'chunk', page_number: 12.9 }, { snippet: 'c', document_filename: 'f.pdf', source_type: 'chunk', page_number: -3 }] }).passages.map(p => p.meta).join('|'), 'Uploaded document|Uploaded document · p.12|Uploaded document', `${label}: a page is shown when it is a positive number (rounded down)`)
  eq(result.sourceCount, 3, `${label}: three distinct sources`)
  nomatch(JSON.stringify(result), /Cross-Session|KG1/, `${label}: the context pack (prompt text) is never used`)
  eq(lib.studioKgAskIsEmpty(result), false, `${label}: a result with passages is not empty`)
  const capped = lib.studioKgAskNormalise({ nodes: many(20, i => ({ node_id: `n${i}`, name: `Entity ${i}`, entity_type: 'ORG', salience: i, similarity: null })), edges: many(20, i => ({ src_name: `A${i}`, dst_name: `B${i}`, relation: 'R' })), citations: many(20, i => ({ snippet: `Passage ${i}`, session_id: `s${i}` })) })
  deepEq([capped.entities.length, capped.connections.length, capped.passages.length], [8, 5, 8], `${label}: caps: 8 ideas, 5 connections, 8 passages`)
  eq(capped.entities[0].name, 'Entity 19', `${label}: ...the most salient ideas are the ones kept`)
  eq(lib.studioKgAskNormalise(EMPTY_RESPONSE) && lib.studioKgAskIsEmpty(lib.studioKgAskNormalise(EMPTY_RESPONSE)), true, `${label}: the retriever's empty pack is empty`)
  eq(lib.studioKgAskIsEmpty(lib.studioKgAskNormalise({ user_id: 'u' })), true, `${label}: a body with only user_id is empty`)
  eq(lib.studioKgAskIsEmpty(lib.studioKgAskNormalise(NODES_ONLY)), false, `${label}: ideas without passages are not empty`)
  eq(lib.studioKgAskIsEmpty(null), true, `${label}: nothing is empty`)
  eq(lib.studioKgAskIsEmpty(lib.studioKgAskNormalise({ citations: [{ snippet: 'a passage alone', session_id: 's' }] })), false, `${label}: passages without ideas are not empty`)
  const cite = (snippet, extra) => ({ snippet, session_id: 's', ...extra })
  eq(lib.studioKgAskNormalise({ citations: [cite('a', { session_id: 's1', document_filename: 'f.pdf' }), cite('b', { session_id: 's2', document_filename: 'f.pdf' })] }).sourceCount, 1, `${label}: two passages from one file are one source`)
  eq(lib.studioKgAskNormalise({ citations: [cite('a', { document_filename: 'f.pdf' }), cite('b', { document_filename: 'g.pdf' })] }).sourceCount, 2, `${label}: two files in one deck are two sources`)
  eq(lib.studioKgAskNormalise({ citations: [cite('a', { session_id: 's1', url: 'https://example.com/x' }), cite('b', { session_id: 's2', url: 'https://example.com/x' })] }).sourceCount, 1, `${label}: two passages from one web page are one source`)
  eq(lib.studioKgAskNormalise({ citations: [cite('a', { session_id: 's1' }), cite('b', { session_id: 's1' }), cite('c', { session_id: 's2' })] }).sourceCount, 2, `${label}: bare passages count by deck`)
  for (const junk of [null, undefined, 'x', 5, [], true]) eq(lib.studioKgAskNormalise(junk), null, `${label}: ${JSON.stringify(junk)} is unreadable`)
  const rough = lib.studioKgAskNormalise({ nodes: [null, 5, 'x', { name: '' }, { name: 7 }], edges: 'x', citations: [null, { snippet: 3 }, { snippet: 'ok' }, []] })
  deepEq([rough.entities.length, rough.connections.length, rough.passages.length], [0, 0, 1], `${label}: unreadable records are skipped, never guessed`)
  eq(rough.passages[0].title, 'Knowledge source', `${label}: a bare passage has a plain title`)
  eq(lib.studioKgAskSourceLabel('table_summary'), 'Table summary', `${label}: source label`); eq(lib.studioKgAskSourceLabel('some_new_kind'), 'some new kind', `${label}: an unknown kind reads plainly`)
  // the words
  eq(lib.studioKgAskSummary(result), 'Found 3 passages from 3 sources, across 3 related ideas.', `${label}: summary`)
  eq(lib.studioKgAskSummary(lib.studioKgAskNormalise({ citations: [{ snippet: 'one', session_id: 's' }] })), 'Found 1 passage from 1 source.', `${label}: summary, singular`)
  eq(lib.studioKgAskSummary(lib.studioKgAskNormalise(NODES_ONLY)), 'Found 2 related ideas, but no source passage was recorded for them.', `${label}: summary, ideas only`)
  eq(lib.studioKgAskSummary(lib.studioKgAskNormalise({ nodes: [RESPONSE.nodes[0]] })), 'Found 1 related idea, but no source passage was recorded for it.', `${label}: summary, one idea only`)
  const W = lib.STUDIO_KG_ASK_WORDS
  for (const [failure, words] of [[{ status: 400 }, W.errorBad], [{ status: 413 }, W.errorBad], [{ status: 422 }, W.errorBad], [{ status: 401 }, W.errorSignedOut], [{ status: 403 }, W.errorPlan], [{ status: 404 }, W.errorMissing], [{ status: 429 }, W.errorBusy], [{ status: 500 }, W.errorDown], [{ status: 502 }, W.errorDown], [{ status: 503 }, W.errorDown], [{ status: 0 }, W.errorDown], [{ network: true }, W.errorNetwork], [{ timeout: true }, W.errorTimeout], [{ unreadable: true }, W.errorUnreadable]]) {
    eq(lib.studioKgAskErrorText(failure), words, `${label}: error words for ${JSON.stringify(failure)}`)
  }
  eq(new Set([W.errorBad, W.errorSignedOut, W.errorPlan, W.errorMissing, W.errorBusy, W.errorDown, W.errorNetwork, W.errorTimeout, W.errorUnreadable]).size, 9, `${label}: nine different error messages`)
  nomatch(Object.values(W).join(' '), /<|http|\bLLM\b|\bAI\b/, `${label}: plain words (no markup, no urls, no jargon)`)
  return lib
}

// ---------------------------------------------------------------- 2. the proxy route
class ServiceUrlConfigError extends Error { constructor(message, code) { super(message); this.code = code } }
function routeWorld(source, env, { gate = { userId: 'user-session' }, fetchFn, baseUrl = 'https://kg.fixture.invalid' } = {}) {
  const trace = { gateCalls: 0, baseUrlCalls: 0 }
  const json = (body, init = {}) => ({ status: init.status ?? 200, body })
  const world = createWorld({
    real: new Set([ROUTE, LIB]), sources: { [ROUTE]: source }, env,
    stubs: {
      'next/server': { NextResponse: { json }, NextRequest: 'NextRequest' },
      '@/lib/service-url': { ServiceUrlConfigError },
      '@/lib/kg-proxy': {
        requireKgEntitled: async () => { trace.gateCalls++; return typeof gate === 'function' ? gate() : gate },
        getKgBaseUrl: () => { trace.baseUrlCalls++; if (baseUrl instanceof Error) throw baseUrl; return baseUrl },
        kgHeaders: extra => ({ ...extra, ...(env.KNOWLEDGE_API_KEY ? { 'X-API-Key': env.KNOWLEDGE_API_KEY } : {}) }),
      },
    },
    globals: { fetch: fetchFn, URL, console: { error() {}, warn() {}, log() {} } },
  })
  const { POST } = world.load(ROUTE)
  return { POST, trace, json }
}
const requestOf = body => ({ json: async () => { if (body instanceof Error) throw body; return structuredClone(body) } })
async function proveRoute(source, label = 'route') {
  const ON = { [FLAG]: 'true', KNOWLEDGE_API_KEY: 'fixture' }
  // flag off: 404 before anything runs
  for (const [name, env] of [['unset', {}], ['"false"', { [FLAG]: 'false' }], ['"TRUE"', { [FLAG]: 'TRUE' }], ['"1"', { [FLAG]: '1' }], ['" true"', { [FLAG]: ' true' }], ['empty', { [FLAG]: '' }]]) {
    const fetchFn = createFetch({ '': () => respond(200, RESPONSE) })
    const { POST, trace } = routeWorld(source, env, { fetchFn })
    const res = await POST(requestOf({ query: 'hello' }))
    eq(res.status, 404, `${label}: flag ${name}: 404`)
    deepEq(res.body, { error: 'Not found' }, `${label}: flag ${name}: nothing about why`)
    eq(trace.gateCalls + trace.baseUrlCalls + fetchFn.calls.length, 0, `${label}: flag ${name}: no session read, no URL, no backend call`)
  }
  // the entitlement gate, then the guard: nothing is sent
  for (const status of [401, 403, 503]) {
    const fetchFn = createFetch({ '': () => respond(200, RESPONSE) })
    const { POST, trace, json } = routeWorld(source, ON, { fetchFn, gate: { error: json_(status) } })
    function json_(s) { return { status: s, body: { error: 'gate' } } }
    const res = await POST(requestOf({ query: 'hello' }))
    eq(res.status, status, `${label}: gate ${status} is returned as it is`)
    eq(fetchFn.calls.length, 0, `${label}: gate ${status}: no backend call`)
    eq(trace.baseUrlCalls, 0, `${label}: gate ${status}: no URL resolved`)
  }
  for (const [name, body] of [['not JSON', new Error('bad json')], ['no query', {}], ['null body', null], ['empty', { query: '' }], ['blank', { query: '   ' }], ['a number', { query: 5 }], ['an object', { query: { a: 1 } }], ['too long', { query: 'a'.repeat(501) }], ['only query_text', { query_text: 'hello' }]]) {
    const fetchFn = createFetch({ '': () => respond(200, RESPONSE) })
    const { POST } = routeWorld(source, ON, { fetchFn })
    const res = await POST(requestOf(body))
    eq(res.status, 400, `${label}: ${name}: 400`)
    eq(fetchFn.calls.length, 0, `${label}: ${name}: no backend call`)
  }
  eq((await routeWorld(source, ON, { fetchFn: createFetch({}) }).POST(requestOf({ query: 'a'.repeat(501) }))).body.code, 'too_long', `${label}: the 400 says why (too_long)`)
  eq((await routeWorld(source, ON, { fetchFn: createFetch({}) }).POST(requestOf({ query: ' ' }))).body.code, 'empty', `${label}: ...(empty)`)
  // the request to the Researcher
  const fetchFn = createFetch({ 'https://kg.fixture.invalid/api/v1/kg/query': () => respond(200, RESPONSE) })
  const { POST, trace } = routeWorld(source, ON, { fetchFn })
  const res = await POST(requestOf({ query: '  what did I learn about Northwind?  ', user_id: 'someone-else', userId: 'someone-else', query_text: 'ignored', max_nodes: 50, hops: 2, min_similarity: 0 }))
  eq(res.status, 200, `${label}: a question is answered`); deepEq(res.body, RESPONSE, `${label}: ...with the Researcher's response as it is`)
  eq(trace.gateCalls, 1, `${label}: the gate ran once`)
  eq(fetchFn.calls.length, 1, `${label}: one backend call`)
  const call = fetchFn.calls[0]
  eq(call.url, 'https://kg.fixture.invalid/api/v1/kg/query', `${label}: POST {KNOWLEDGE_SERVICE_URL}/api/v1/kg/query`)
  eq(call.method, 'POST', `${label}: ...by POST`)
  deepEq(call.headers, { 'Content-Type': 'application/json', 'X-API-Key': 'fixture' }, `${label}: ...JSON, with the service key from the environment`)
  deepEq(JSON.parse(call.body), { user_id: 'user-session', query_text: 'what did I learn about Northwind?', max_nodes: 8, hops: 1, min_similarity: 0.6 }, `${label}: ...KgQueryRequest: the session's user_id, the trimmed question, the backend's own defaults; nothing from the browser's body but the question`)
  const keyless = routeWorld(source, { [FLAG]: 'true' }, { fetchFn: createFetch({ '': () => respond(200, RESPONSE) }) })
  await keyless.POST(requestOf({ query: 'hello' }))
  // failures: plain statuses, the backend's own text never passed on
  for (const [name, answer, status, extra] of [
    ['the router is not mounted (404)', () => respond(404, { detail: 'Not Found' }), 503, { service_unavailable: true }],
    ['the service key is wrong (401)', () => respond(401, { detail: 'secret internals' }), 401],
    ['forbidden (403)', () => respond(403, { detail: 'secret internals' }), 403],
    ['a server error (500)', () => respond(500, { detail: 'psycopg2.OperationalError: password for kg_user' }), 500],
    ['a bad gateway (502)', () => respond(502, 'x'), 502],
  ]) {
    const f = createFetch({ '': answer })
    const out = await routeWorld(source, ON, { fetchFn: f }).POST(requestOf({ query: 'hello' }))
    eq(out.status, status, `${label}: ${name} -> ${status}`)
    nomatch(JSON.stringify(out.body), /secret|psycopg2|Not Found|kg_user/, `${label}: ${name}: the backend's text is not passed on`)
    if (extra) eq(out.body.service_unavailable, true, `${label}: ${name}: marked service_unavailable`)
  }
  const down = await routeWorld(source, ON, { fetchFn: () => Promise.reject(new TypeError('fetch failed: ECONNREFUSED kg.internal')) }).POST(requestOf({ query: 'hello' }))
  eq(down.status, 503, `${label}: the service cannot be reached: 503`); eq(down.body.service_unavailable, true, `${label}: ...marked service_unavailable`)
  nomatch(JSON.stringify(down.body), /ECONNREFUSED|kg\.internal/, `${label}: ...without the network error`)
  const badJson = await routeWorld(source, ON, { fetchFn: () => Promise.resolve({ ok: true, status: 200, json: async () => { throw new Error('Unexpected token <') } }) }).POST(requestOf({ query: 'hello' }))
  eq(badJson.status, 503, `${label}: an unreadable 200 is a 503, not a crash`)
  const noUrl = await routeWorld(source, ON, { fetchFn: createFetch({}), baseUrl: new ServiceUrlConfigError('Knowledge Service URL is not configured', 'SERVICE_URL_MISSING') }).POST(requestOf({ query: 'hello' }))
  eq(noUrl.status, 503, `${label}: no service URL configured: 503`); eq(noUrl.body.code, 'SERVICE_URL_MISSING', `${label}: ...says so, as the other routes do`)
  // no other outbound call, no body user_id
  eq((source.match(/\bfetch\(/g) || []).length, 1, `${label}: exactly one outbound call in the route`)
  nomatch(source, /body\??\.user_?[iI]d|request\.nextUrl|searchParams/, `${label}: the route never reads a user id from the request`)
  match(source, /process\.env\.NEXT_PUBLIC_STUDIO_KG_ASK !== 'true'/, `${label}: the flag is read as the exact string`)
  ok(source.indexOf("NEXT_PUBLIC_STUDIO_KG_ASK !== 'true'") < source.indexOf('requireKgEntitled()'), `${label}: the flag is checked before the session`)
}

// ---------------------------------------------------------------- 3. the hook and the component
function uiWorld(source, fetchFn, { timers } = {}) {
  return createWorld({
    real: new Set([LIB, HOOK, UI]), sources: { [UI]: source },
    stubs: { 'next/link': { default: 'Link', __esModule: true } },
    globals: { fetch: fetchFn, AbortController, Promise, URL, JSON, Array, Set, Map, Object, Number, String, Boolean, Math, Error, setTimeout: timers?.setTimeout ?? setTimeout, clearTimeout: timers?.clearTimeout ?? clearTimeout },
  })
}
const fakeTimers = () => {
  const list = []
  return { list, setTimeout: (fn, ms) => { list.push({ fn, ms, live: true }); return list.length }, clearTimeout: id => { if (list[id - 1]) list[id - 1].live = false }, fire() { for (const t of list) if (t.live) { t.live = false; t.fn() } } }
}
const QUESTION = 'What did I learn about Northwind?'
async function proveUi(source, label = 'ui') {
  const fetchFn = createFetch({ '/api/knowledge-graph/query': () => hold.promise })
  let hold = deferred()
  const timers0 = fakeTimers()
  const world = uiWorld(source, fetchFn, { timers: timers0 })
  const { StudioKgAsk } = world.load(UI)
  const view = () => expand(world.runtime.render(StudioKgAsk, {}))
  let tree = view()
  const el = (type, pred = () => true) => all(tree, n => n.type === type && pred(n))
  const input = () => el('input')[0]
  const form = () => el('form')[0]
  const section = () => el('section')[0]
  const result = () => pick(tree, 'result')
  const type = value => { input().props.onChange({ target: { value } }); tree = view() }
  const submit = () => { let prevented = 0; form().props.onSubmit({ preventDefault() { prevented++ } }); tree = view(); return prevented }
  const note = () => all(tree, n => n.props?.['data-studio-kg-ask-note'] === 'true')[0] // may be absent: that is asserted where it matters
  const answerWith = async (answer) => { hold.resolve(answer); await settle(); tree = view() }
  const nextRound = () => { hold = deferred() }

  // idle
  eq(section().props['data-studio-kg-ask'], 'true', `${label}: the box carries its marker`)
  eq(section().props['data-studio-kg-ask-state'], 'idle', `${label}: idle at first`)
  const heading = all(tree, n => n.type === 'h2')[0]
  eq(flat(heading), 'Ask your second brain', `${label}: the title`)
  eq(section().props['aria-labelledby'], heading.props.id, `${label}: the box is labelled by its title`)
  eq(pick(tree, 'row').props.children.length, 2, `${label}: the title and the form share one row (the box is one line high, plus its hint)`)
  eq(el('input').length + el('textarea').length, 1, `${label}: one field`)
  eq(input().props.type, 'text', `${label}: ...a single-line field, so Enter submits its form`)
  eq(input().props.maxLength, undefined, `${label}: ...no silent maxLength: a long question is refused out loud, not cut`)
  const label_ = el('label')[0]
  eq(label_.props.htmlFor, input().props.id, `${label}: the field has a label`); eq(flat(label_), 'Your question', `${label}: ...Your question`)
  ok(input().props.placeholder.length > 5, `${label}: ...and a placeholder`)
  eq(form().props.role, 'search', `${label}: the field sits in a search form`); eq(typeof form().props.onSubmit, 'function', `${label}: ...whose submit asks`)
  const button = el('button', n => n.props['data-studio-kg-ask-submit'] === 'true')[0]
  eq(button.props.type, 'submit', `${label}: the Ask button is the form's submit (Enter = click)`); eq(button.props.disabled, false, `${label}: ...enabled`); eq(flat(button), 'Ask', `${label}: ...says Ask`)
  ok(flat(pick(tree, 'hint')).includes('does not write an answer'), `${label}: the hint says it shows passages and does not write an answer`)
  eq(result().props['aria-live'], 'polite', `${label}: results are announced politely`)
  eq(result().props['data-open'], undefined, `${label}: no panel while idle`); eq(flat(result()), '', `${label}: ...and nothing in it`)
  eq(el('button', n => n.props['data-studio-kg-ask-clear'] === 'true').length, 0, `${label}: no Clear while idle`)
  eq(fetchFn.calls.length, 0, `${label}: nothing is requested on render`)

  // an empty or blank question is guarded (Enter on an empty field)
  eq(submit(), 1, `${label}: submit prevents the browser's own form post`)
  eq(fetchFn.calls.length, 0, `${label}: an empty question sends nothing`)
  eq(flat(note()), 'Type a question first.', `${label}: ...and says so`); eq(note().props.role, 'alert', `${label}: ...as an alert`); eq(input().props['aria-invalid'], true, `${label}: ...the field is marked invalid`); eq(input().props['aria-describedby'], note().props.id, `${label}: ...and described by the note`)
  type('   '); submit()
  eq(fetchFn.calls.length, 0, `${label}: a blank question sends nothing`)
  type('x'); eq(note(), undefined, `${label}: typing clears the note`)
  // too long: refused live and on submit; 500 passes
  type('a'.repeat(449)); eq(note(), undefined, `${label}: no counter at 449`)
  type('a'.repeat(450)); eq(flat(note()).replace(/ \/ /g, '/'), '450/500', `${label}: the counter appears at 450`); eq(note().props.role, undefined, `${label}: ...as a quiet count`)
  type('a'.repeat(501)); ok(flat(note()).startsWith('Keep your question under 500 characters.'), `${label}: 501 characters are refused as you type`); eq(note().props['data-over'], 'true', `${label}: ...marked over`); ok(flat(note()).replace(/ \/ /g, '/').endsWith('501/500'), `${label}: ...with the count`)
  submit(); eq(fetchFn.calls.length, 0, `${label}: an over-long question sends nothing`)
  type('a'.repeat(500)); eq(note().props['data-over'], undefined, `${label}: 500 is fine`)
  type('')

  // loading
  type(`  ${QUESTION}  `)
  submit()
  eq(fetchFn.calls.length, 1, `${label}: one request`)
  const sent = fetchFn.calls[0]
  eq(sent.url, '/api/knowledge-graph/query', `${label}: to the proxy`); eq(sent.method, 'POST', `${label}: by POST`); deepEq(sent.headers, { 'Content-Type': 'application/json' }, `${label}: JSON`)
  deepEq(JSON.parse(sent.body), { query: QUESTION }, `${label}: the trimmed question and nothing else`)
  eq(section().props['data-studio-kg-ask-state'], 'loading', `${label}: loading`)
  eq(result().props['data-open'], 'true', `${label}: the panel opens while asking`); eq(flat(pick(tree, 'hint')).length > 20, true, `${label}: ...and the hint stays (the box does not change height)`)
  const status = pick(tree, 'loading')
  eq(status.props.role, 'status', `${label}: loading is a status`); eq(flat(status), 'Searching your second brain…', `${label}: ...Searching your second brain…`)
  const busy = el('button', n => n.props['data-studio-kg-ask-submit'] === 'true')[0]
  eq(busy.props.disabled, true, `${label}: the button is disabled while asking`); eq(flat(busy), 'Asking', `${label}: ...and says Asking`)
  submit(); eq(fetchFn.calls.length, 1, `${label}: Enter while asking sends nothing more`)
  eq(el('button', n => n.props['data-studio-kg-ask-clear'] === 'true').length, 0, `${label}: no Clear while asking`)

  // the answer
  eq(timers0.list.filter(t => t.live).length, 1, `${label}: one timeout is running while it waits`)
  await answerWith(respond(200, RESPONSE))
  eq(timers0.list.filter(t => t.live).length, 0, `${label}: ...and it is cleared once the answer is in`)
  eq(section().props['data-studio-kg-ask-state'], 'ready', `${label}: ready`)
  const summary = pick(tree, 'summary')
  ok(flat(summary).startsWith('Found 3 passages from 3 sources, across 3 related ideas.'), `${label}: the summary has the real numbers`)
  ok(flat(summary).includes('not a written answer'), `${label}: ...and says it is not a written answer`)
  const passages = all(tree, n => n.props?.['data-studio-kg-ask-passage'] === 'true')
  eq(passages.length, 3, `${label}: three passages`)
  eq(flat(all(passages[0], n => n.type === 'blockquote')[0]), RESPONSE.citations[0].snippet, `${label}: the passage text`)
  ok(flat(passages[0]).includes('q3-board-pack.pdf') && flat(passages[0]).includes('Uploaded document · p.7 · about Q3 revenue'), `${label}: ...with its source file, kind, page and idea`)
  eq((flat(passages[2]).match(/Deck research/g) || []).length, 1, `${label}: a deck-research passage does not say so twice`)
  eq(pick(tree, 'columns').props['data-two'], 'true', `${label}: passages and ideas sit in two columns`)
  const links = n => all(n, x => x.props?.['data-studio-kg-ask-link']).map(x => [x.type, x.props.href, x.props.target, x.props.rel, flat(x)])
  deepEq(links(passages[0]), [['Link', '/builder?session_id=sess-aaa', undefined, undefined, 'Open the deck']], `${label}: a document passage opens its deck (an in-app link)`)
  deepEq(links(passages[1]), [['a', 'https://www.example.com/news/northwind', '_blank', 'noopener noreferrer', 'Open source'], ['Link', '/builder?session_id=sess-bbb', undefined, undefined, 'Open the deck']], `${label}: a web passage opens its source in a new tab (noopener noreferrer) and its deck`)
  deepEq(links(passages[2]), [], `${label}: a passage with nothing to open has no link`)
  deepEq(pick(tree, 'entities').props.children.map(c => flat(c)), ['Q3 revenue metric', 'Northwind Traders org', 'Casey Placeholder person'], `${label}: related ideas`)
  eq(pick(tree, 'connections').props.children.length, 2, `${label}: two connections`)
  ok(flat(pick(tree, 'connections').props.children[0]).includes('Northwind Traders REPORTS METRIC Q3 revenue'), `${label}: ...read as sentences`)
  nomatch(flat(result()), /Cross-Session|\[KG/, `${label}: the prompt text is not shown`)
  eq(result().props['data-open'], 'true', `${label}: the answer is in the panel`)
  eq(el('button', n => n.props['data-studio-kg-ask-clear'] === 'true').length, 1, `${label}: Clear appears with an answer`)
  eq(el('button', n => n.props['data-studio-kg-ask-submit'] === 'true')[0].props.disabled, false, `${label}: ...and Ask is enabled again`)

  // Escape closes the panel and keeps the words
  let stopped = 0
  section().props.onKeyDown({ key: 'Enter', stopPropagation() { stopped++ } }); tree = view()
  eq(section().props['data-studio-kg-ask-state'], 'ready', `${label}: another key does nothing`)
  section().props.onKeyDown({ key: 'Escape', stopPropagation() { stopped++ } }); tree = view()
  eq(section().props['data-studio-kg-ask-state'], 'idle', `${label}: Escape closes the panel`); eq(input().props.value, `  ${QUESTION}  `, `${label}: ...the words stay in the field`); eq(stopped, 1, `${label}: ...and Escape goes no further`)
  eq(result().props['data-open'], undefined, `${label}: ...no panel`)
  section().props.onKeyDown({ key: 'Escape', stopPropagation() { stopped++ } }); eq(stopped, 1, `${label}: Escape with nothing open is left to the page`)
  nextRound(); submit(); await answerWith(respond(200, RESPONSE))
  eq(section().props['data-studio-kg-ask-state'], 'ready', `${label}: the same question can be asked again`)
  // Clear
  el('button', n => n.props['data-studio-kg-ask-clear'] === 'true')[0].props.onClick(); tree = view()
  eq(section().props['data-studio-kg-ask-state'], 'idle', `${label}: Clear goes back to the hint`); eq(input().props.value, '', `${label}: ...and empties the field`)

  // nothing found
  nextRound(); type(QUESTION); submit(); await answerWith(respond(200, EMPTY_RESPONSE))
  eq(section().props['data-studio-kg-ask-state'], 'empty', `${label}: the empty pack = nothing found`)
  const empty = pick(tree, 'empty')
  eq(flat(empty.props.children[0]), 'Nothing in your second brain matches that yet', `${label}: says so`); ok(flat(empty).includes('imported past sessions'), `${label}: ...and what to try`)
  eq(all(tree, n => n.props?.['data-studio-kg-ask-passage'] === 'true').length, 0, `${label}: no passage`)
  // ideas but no passages
  nextRound(); submit(); await answerWith(respond(200, NODES_ONLY))
  eq(section().props['data-studio-kg-ask-state'], 'ready', `${label}: ideas without passages are shown`)
  ok(flat(pick(tree, 'summary')).includes('no source passage was recorded'), `${label}: ...with the plain note`)
  eq(all(tree, n => n.props?.['data-studio-kg-ask-passages'] === 'true').length, 0, `${label}: ...and no empty Passages list`)

  // errors and Try again
  for (const [status, words] of [[503, 'Your second brain is not reachable right now. Try again in a moment.'], [403, 'Asking your second brain needs a Pro plan or above.'], [401, 'Sign in again to ask your second brain.'], [400, 'That question could not be sent. Check it and try again.'], [429, 'Too many questions in a row. Wait a moment, then try again.'], [500, 'Your second brain is not reachable right now. Try again in a moment.']]) {
    nextRound(); submit(); await answerWith(respond(status, { error: 'psycopg2 leak', service_unavailable: true }))
    eq(section().props['data-studio-kg-ask-state'], 'error', `${label}: ${status}: error state`)
    const err = pick(tree, 'error')
    eq(err.props.role, 'alert', `${label}: ${status}: an alert`); eq(flat(err.props.children[1]), words, `${label}: ${status}: ${words}`)
    nomatch(flat(err), /psycopg2/, `${label}: ${status}: the service's text is not shown`)
  }
  const callsBefore = fetchFn.calls.length
  nextRound(); type('edited after the failure'); pick(tree, 'error').props.children[2].props.onClick(); tree = view()
  eq(fetchFn.calls.length, callsBefore + 1, `${label}: Try again asks again`)
  deepEq(JSON.parse(fetchFn.calls.at(-1).body), { query: QUESTION }, `${label}: ...the same question`)
  eq(section().props['data-studio-kg-ask-state'], 'loading', `${label}: ...and is loading`)
  await answerWith(respond(200, RESPONSE)); eq(section().props['data-studio-kg-ask-state'], 'ready', `${label}: ...then the answer`)
  // network failure, unreadable bodies
  nextRound(); submit(); hold.reject(new TypeError('Failed to fetch')); await settle(); tree = view()
  eq(flat(pick(tree, 'error').props.children[1]), 'Deckster could not be reached. Check your connection and try again.', `${label}: a network failure`)
  for (const [name, answer] of [['a body that is not JSON', { ok: true, status: 200, json: () => Promise.reject(new Error('x')) }], ['JSON null', respond(200, null)], ['a JSON array', respond(200, [1])], ['a JSON string', respond(200, 'x')]]) {
    nextRound(); submit(); await answerWith(answer)
    eq(flat(pick(tree, 'error').props.children[1]), 'The result could not be read. Try again.', `${label}: ${name}: unreadable`)
  }
  // an error can be cleared
  el('button', n => n.props['data-studio-kg-ask-clear'] === 'true')[0].props.onClick(); tree = view()
  eq(section().props['data-studio-kg-ask-state'], 'idle', `${label}: Clear also leaves an error`)
  world.runtime.unmount()

  // a question that never answers
  const timers = fakeTimers()
  const f2 = createFetch({ '/api/knowledge-graph/query': () => new Promise(() => {}) })
  const w2 = uiWorld(source, f2, { timers })
  const C2 = w2.load(UI).StudioKgAsk
  let t2 = expand(w2.runtime.render(C2, {}))
  const find2 = (type, pred = () => true) => all(t2, n => n.type === type && pred(n))
  find2('input')[0].props.onChange({ target: { value: QUESTION } }); t2 = expand(w2.runtime.render(C2, {}))
  find2('form')[0].props.onSubmit({ preventDefault() {} }); t2 = expand(w2.runtime.render(C2, {}))
  eq(timers.list.filter(t => t.live).length, 1, `${label}: a timeout is running while it waits`); eq(timers.list[0].ms, 30000, `${label}: ...30 seconds`)
  timers.fire(); await settle(); t2 = expand(w2.runtime.render(C2, {}))
  eq(find2('section')[0].props['data-studio-kg-ask-state'], 'error', `${label}: a question that never answers ends in the error state`)
  eq(flat(pick(t2, 'error').props.children[1]), 'That took too long. Try again.', `${label}: ...with the timeout words`)
  eq(f2.calls[0].signal.aborted, true, `${label}: ...and the request is cancelled`)
}
async function proveHook(source, label = 'hook') {
  // two questions: the older answer never shows; reset drops the one in flight; unmount cancels
  const holds = []
  const fetchFn = createFetch({ '/api/knowledge-graph/query': () => { const d = deferred(); holds.push(d); return d.promise } })
  const world = createWorld({ real: new Set([LIB, HOOK]), sources: { [HOOK]: source }, globals: { fetch: fetchFn, AbortController, Promise, URL, JSON, Array, Set, Map, Object, Number, String, Boolean, Math, Error, setTimeout, clearTimeout } })
  const { useStudioKgAsk } = world.load(HOOK)
  const use = () => world.runtime.render(() => useStudioKgAsk(), {})
  let hook = use()
  eq(hook.state.phase, 'idle', `${label}: idle`)
  eq(hook.ask('   '), false, `${label}: ask refuses a blank question`); eq(hook.ask('a'.repeat(501)), false, `${label}: ...and a long one`); eq(fetchFn.calls.length, 0, `${label}: ...sending nothing`)
  eq(hook.ask('  first  '), true, `${label}: ask accepts a question`); hook = use()
  deepEq(JSON.parse(fetchFn.calls[0].body), { query: 'first' }, `${label}: ...and sends it trimmed`)
  hook.ask('second'); hook = use()
  eq(fetchFn.calls.length, 2, `${label}: two requests`)
  eq(fetchFn.calls[0].signal.aborted, true, `${label}: the older request is cancelled`); eq(fetchFn.calls[1].signal.aborted, false, `${label}: ...the newer is not`)
  eq(hook.state.asked, 'second', `${label}: the current question is the second`)
  holds[1].resolve(respond(200, { ...RESPONSE, citations: [{ snippet: 'SECOND answer', session_id: 's2' }] })); await settle(); hook = use()
  holds[0].resolve(respond(200, { ...RESPONSE, citations: [{ snippet: 'FIRST answer', session_id: 's1' }] })); await settle(); hook = use()
  eq(hook.state.phase, 'ready', `${label}: ready`); deepEq(hook.state.result.passages.map(p => p.snippet), ['SECOND answer'], `${label}: only the newest question's answer is shown`)
  // reset during loading
  hook.ask('third'); hook = use(); eq(hook.state.phase, 'loading', `${label}: loading`)
  hook.reset(); hook = use(); eq(hook.state.phase, 'idle', `${label}: reset goes idle`); eq(fetchFn.calls.at(-1).signal.aborted, true, `${label}: ...and cancels the request`)
  holds.at(-1).resolve(respond(200, RESPONSE)); await settle(); hook = use(); eq(hook.state.phase, 'idle', `${label}: a late answer after reset is ignored`)
  // unmount
  hook.ask('fourth'); hook = use()
  const last = fetchFn.calls.at(-1)
  world.runtime.unmount()
  eq(last.signal.aborted, true, `${label}: leaving the page cancels the request`)
  holds.at(-1).resolve(respond(200, RESPONSE)); await settle()
  eq(use().state.phase, 'loading', `${label}: nothing is set once the page is left`)
  match(source, /fetch\(STUDIO_KG_ASK_ENDPOINT,/, `${label}: the only call is to the proxy route`)
  eq((source.match(/\bfetch\(/g) || []).length, 1, `${label}: exactly one fetch`)
  nomatch(source, /localStorage|sessionStorage|document\.cookie/, `${label}: nothing is stored`)
}

// ---------------------------------------------------------------- 4. the page wiring
const STATS = { node_count: 9, edge_count: 9, evidence_count: 11, sessions_consolidated: 1, last_updated_at: '2026-10-01T12:00:00Z', nodes_by_type: [{ entity_type: 'ORG', count: 3 }], top_entities: [{ node_id: 'n1', name: 'Northwind', entity_type: 'ORG', salience: 1, mention_count: 2 }] }
const GRAPH_DATA = { nodes: [{ node_id: 'n1', name: 'Northwind', entity_type: 'ORG', salience: 1, mention_count: 2 }, { node_id: 'n2', name: 'Revenue', entity_type: 'METRIC', salience: 1, mention_count: 1 }], edges: [{ src_node_id: 'n1', dst_node_id: 'n2', relation: 'REPORTS', weight: 1 }], total_nodes: 9 }
const DETAIL = { node: { node_id: 'n1', name: 'Northwind', entity_type: 'ORG', salience: 1, mention_count: 2 }, evidence: [], edges: [], provenance_session_ids: [] }
const ACCESS = { accountKey: 'user:fixture', userId: 'fixture', isAuthenticated: true, isLoading: false, isEntitled: true, isSubscribed: true, serviceAvailable: true, error: null, settings: { subscribed: true }, capability: {}, refetch: async () => {} }
function pageWorld(source, env) {
  const fetchFn = createFetch({ '/api/knowledge-graph/stats': () => respond(200, STATS), '/api/knowledge-graph/graph': () => respond(200, GRAPH_DATA), '/api/knowledge-graph/nodes/': () => respond(200, DETAIL), '/api/sessions': () => respond(200, { sessions: [], pagination: { hasMore: false } }) })
  const world = createWorld({
    real: new Set([PAGE, LIB]), sources: { [PAGE]: source }, env,
    stubs: { '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') }, '@/components/knowledge/kg-graph-view': { KgGraphView: 'KgGraphView', typeColor: () => '#60A5FA' }, '@/hooks/use-knowledge-graph': { useKnowledgeGraph: () => ACCESS }, 'next/link': { default: 'Link', __esModule: true } },
    globals: { fetch: fetchFn, AbortController, Intl, Set, Map, Promise, JSON, Math, Number, String, Object, Array, Boolean, Error, TypeError, Date, URL, console: { warn() {}, error() {}, log() {}, info() {}, debug() {} }, window: { addEventListener() {}, removeEventListener() {}, location: { reload() {} } } },
  })
  const { KnowledgePageForAccount } = world.load(PAGE)
  const render = () => world.runtime.render(KnowledgePageForAccount, { kg: ACCESS })
  return { world, fetchFn, render }
}
async function pageStates(source, env) {
  const { fetchFn, render } = pageWorld(source, env)
  render(); await settle(); const loaded = render()
  const graph = all(loaded, i => i.type === 'KgGraphView')[0]
  graph.props.onSelect('n1'); render(); await settle(); const selected = render()
  return { loaded, selected, calls: fetchFn.calls.map(c => ({ url: c.url, method: c.method })) }
}
const boxes = tree => all(tree, i => i.type === 'StudioKgAsk')
async function provePage(source, label = 'page') {
  const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
  const base = await pageStates(baseSource(PAGE), SHELL)
  const baseClassic = await pageStates(baseSource(PAGE), { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false' })
  eq(boxes(base.loaded).length, 0, `${label}: (sanity) the base has no box`)
  for (const [name, env, expected] of [
    ['flag unset', SHELL, base], ['flag "false"', { ...SHELL, [FLAG]: 'false' }, base], ['flag "TRUE"', { ...SHELL, [FLAG]: 'TRUE' }, base], ['flag "1"', { ...SHELL, [FLAG]: '1' }, base], ['flag " true"', { ...SHELL, [FLAG]: ' true' }, base],
    ['flag on, shell off', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false', [FLAG]: 'true' }, baseClassic], ['flag on, shell unset', { [FLAG]: 'true' }, baseClassic],
  ]) {
    const got = await pageStates(source, env)
    same(ser(got.loaded), ser(expected.loaded), `${label}: ${name}: the loaded page is the base's`)
    same(ser(got.selected), ser(expected.selected), `${label}: ${name}: the selected page is the base's`)
    deepEq(got.calls, expected.calls, `${label}: ${name}: the same requests as the base`)
    eq(boxes(got.loaded).length + boxes(got.selected).length, 0, `${label}: ${name}: no box`)
    eq(got.calls.some(c => c.url.includes('/query')), false, `${label}: ${name}: no query request`)
  }
  const ON = { ...SHELL, [FLAG]: 'true' }
  const on = await pageStates(source, ON)
  eq(boxes(on.loaded).length, 1, `${label}: flag on: one box`); eq(boxes(on.selected).length, 1, `${label}: ...also with an entity selected`)
  same(ser(without(on.loaded, 'StudioKgAsk')), ser(base.loaded), `${label}: flag on: everything else on the page is the base's`)
  same(ser(without(on.selected, 'StudioKgAsk')), ser(base.selected), `${label}: ...also with an entity selected`)
  deepEq(on.calls, base.calls, `${label}: flag on: no request on load (the box asks only when asked)`)
  const main = all(on.loaded, i => i.props?.['data-studio-knowledge'] === 'true')[0]
  const kids = [].concat(main.props.children).filter(c => c && typeof c === 'object' && !Array.isArray(c))
  const at = kids.findIndex(c => c.type === 'StudioKgAsk')
  eq(kids[at + 1].props['data-studio-knowledge-role'], 'layout', `${label}: the box sits right above the map and the inspector`)
  eq(kids[at - 1]?.props?.['data-studio-knowledge-role'] !== 'layout', true, `${label}: ...below the header and the counts`)
  ok(kids.findIndex(c => c.type === 'header' || c.props?.['data-studio-knowledge-role'] === 'header') < at, `${label}: ...after the header`)
  // orthogonal to the neighbouring flags: with the box removed the page is what it is with the flag off
  for (const extra of [{ NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN: 'true' }, { NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS: 'true' }, { NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN: 'true', NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS: 'true' }]) {
    const off = await pageStates(source, { ...SHELL, ...extra })
    const withBox = await pageStates(source, { ...ON, ...extra })
    eq(boxes(withBox.loaded).length, 1, `${label}: ${Object.keys(extra)[0]} + flag: one box`)
    same(ser(without(withBox.loaded, 'StudioKgAsk')), ser(off.loaded), `${label}: ${Object.keys(extra)[0]} + flag: nothing else changes`)
    deepEq(withBox.calls, off.calls, `${label}: ${Object.keys(extra)[0]} + flag: the same requests`)
  }
  match(source, /const KG_ASK = studioKgAskOn\(process\.env\.NEXT_PUBLIC_STUDIO_KG_ASK, process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL\)/, `${label}: the page's rule is the helper's (exact "true" AND the shell)`)
  match(source, /\{KG_ASK && <StudioKgAsk \/>\}/, `${label}: the box is guarded by the flag`)
  // the diff against the base is only the box
  const added = source.split('\n').filter(line => !baseSource(PAGE).split('\n').includes(line))
  ok(added.length <= 6, `${label}: the page differs from the base by ${added.length} lines (the imports, the flag, the box)`)
  ok(added.every(line => /studio-kg-ask|studioKgAsk|KG_ASK|^\s*$/.test(line)), `${label}: ...and every one of them is about the box`)
}

// ---------------------------------------------------------------- 5. the CSS and the env example
function proveCss(source, label = 'css') {
  const root = postcss.parse(source)
  let rules = 0
  root.walkRules(rule => {
    rules++
    for (const selector of rule.selectors) ok(selector.startsWith('[data-studio-v4-shell="true"] [data-studio-kg-ask="true"]'), `${label}: "${selector.slice(0, 90)}" hangs on the box's marker inside the shell`)
  })
  ok(rules >= 40, `${label}: the rules are there (${rules})`)
  nomatch(source, /!important/, `${label}: no !important`)
  nomatch(source.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b/, `${label}: no hex colours: tokens only`)
  root.walkDecls(decl => { if (/color|background|border|outline/.test(decl.prop)) nomatch(decl.value, /\b(?:rgb|hsl)a?\(/, `${label}: no raw colour in ${decl.prop}`) })
  const shell = fs.readFileSync(path.join(repoRoot, 'components/layout/studio-shell.css'), 'utf8')
  const tokens = new Set([...source.matchAll(/var\((--ss-[a-z-]+)\)/g)].map(m => m[1]))
  ok(tokens.size >= 8, `${label}: it uses the shell's tokens (${tokens.size})`)
  for (const token of tokens) {
    const light = new RegExp(`\\[data-studio-v4-shell="true"\\] \\{[^}]*${token}:`).test(shell), dark = new RegExp(`\\.dark \\[data-studio-v4-shell="true"\\] \\{[^}]*${token}:`).test(shell)
    ok(light && dark, `${label}: ${token} exists in light and dark in studio-shell.css`)
  }
  // every marker the sheet styles is one the markup carries, and the other way round
  const used = new Set([...source.matchAll(/\[(data-studio-kg-ask[a-z-]*)(?:="[a-z]+")?\]/g)].map(m => m[1]))
  const markup = SOURCES[UI]
  for (const marker of used) ok(markup.includes(marker), `${label}: the markup carries ${marker}`)
  for (const marker of ['data-studio-kg-ask-form', 'data-studio-kg-ask-submit', 'data-studio-kg-ask-result', 'data-studio-kg-ask-passage', 'data-studio-kg-ask-error', 'data-studio-kg-ask-empty', 'data-studio-kg-ask-loading', 'data-studio-kg-ask-entities', 'data-studio-kg-ask-connections', 'data-studio-kg-ask-links', 'data-studio-kg-ask-columns', 'data-studio-kg-ask-hint']) ok(used.has(marker), `${label}: ${marker} is styled`)
  match(source, /data-studio-kg-ask-result="true"\]\[data-open="true"\] \{\s*position: absolute;[^}]*max-height: min\(58vh, 540px\); overflow-y: auto/, `${label}: whatever is asked opens in a panel over the page (the page never reflows); a long answer scrolls inside it`)
  match(source, /\[data-studio-kg-ask="true"\] \{\s*position: relative; z-index: 20;/, `${label}: the box is the panel's anchor and sits over the map`)
  match(source, /data-studio-kg-ask-columns="true"\]\[data-two="true"\] \{ grid-template-columns:/, `${label}: two columns when there is room`)
  for (const attr of ['data-open', 'data-two']) ok(source.includes(`[${attr}=`) && markup.includes(attr), `${label}: ${attr} is in the sheet and in the markup`)
  match(source, /data-studio-kg-ask-error="true"\] \{ flex-wrap: wrap; \}/, `${label}: the error row wraps on a narrow screen`)
  const sheet = fs.readFileSync(path.join(repoRoot, 'components/knowledge/studio-knowledge.css'), 'utf8')
  eq(sheet.includes('data-studio-kg-ask'), false, `${label}: the page's own sheet is untouched`)
}
function proveEnv(source, label = 'env') {
  const lines = source.split('\n')
  const at = lines.findIndex(line => line.trim() === `${FLAG}="false"`)
  ok(at > 0, `${label}: ${FLAG}="false" is documented`)
  eq(lines.filter(line => line.startsWith(`${FLAG}=`)).length, 1, `${label}: exactly once`)
  const block = []
  for (let i = at - 1; i >= 0 && lines[i].startsWith('#'); i--) block.unshift(lines[i])
  const body = block.join(' ')
  match(body, /exact "true"/i, `${label}: says exact "true"`)
  match(body, /default off/i, `${label}: says default off`)
  match(body, /answers 404/, `${label}: says the route answers 404 with the flag off`)
  match(body, /NEXT_PUBLIC_STUDIO_V4_SHELL/, `${label}: says it needs the Studio shell`)
  match(body, /BUILD TIME/, `${label}: says it is read at build time`)
  match(body, /POST \/api\/v1\/kg\/query/, `${label}: names the backend route`)
  match(body, /not a written\s+# answer|not a written answer/, `${label}: says it is not a written answer`)
  match(body, /RESEARCHER_KG_RETRIEVAL_ENABLED/, `${label}: says what the Researcher needs`)
  match(body, /one text embedding/, `${label}: says what a question costs`)
  const base = baseSource(ENV).split('\n')
  const kept = base.filter(line => !lines.includes(line))
  eq(kept.length, 0, `${label}: every line of the base's example is still there`)
}

// ---------------------------------------------------------------- run
async function proveAll(replaced = {}, only = null) {
  overrides = replaced
  const s = file => replaced[file] ?? SOURCES[file]
  const run = (name, fn) => { if (!only || only.includes(name)) return fn() }
  await run('lib', async () => { proveLib(s(LIB)) })
  await run('route', () => proveRoute(s(ROUTE)))
  await run('ui', () => proveUi(s(UI)))
  await run('hook', () => proveHook(s(HOOK)))
  await run('page', () => provePage(s(PAGE)))
  await run('css', () => proveCss(s(CSS)))
  await run('env', () => proveEnv(s(ENV)))
}

const t0 = Date.now()
await proveAll()
const realChecks = checks
const realMs = Date.now() - t0
counting = false
if (process.env.KG_ASK_QUICK) { console.log(`Studio KG Ask (quick, mutants skipped): ${realChecks} checks passed in ${realMs} ms; no network.`); process.exit(0) }

// ---------------------------------------------------------------- 6. mutation check: [file, name, from, to]; every one must be killed by an assertion (not a crash)
const ONLY = { [LIB]: null, [ROUTE]: ['route'], [HOOK]: ['hook', 'ui'], [UI]: ['ui'], [PAGE]: ['page'], [CSS]: ['css'], [ENV]: ['env'] }
const MUTANTS = [
  // the helper
  [LIB, 'flag: either one is enough', "flag === 'true' && shell === 'true'", "flag === 'true' || shell === 'true'"],
  [LIB, 'flag: any value is on', "return flag === 'true' && shell === 'true'", "return Boolean(flag) && shell === 'true'"],
  [LIB, 'endpoint', "'/api/knowledge-graph/query'", "'/api/knowledge-graph/search'"],
  [LIB, 'limit moved', 'STUDIO_KG_ASK_MAX_QUESTION = 500', 'STUDIO_KG_ASK_MAX_QUESTION = 5000'],
  [LIB, 'counter moved', 'STUDIO_KG_ASK_COUNTER_FROM = 450', 'STUDIO_KG_ASK_COUNTER_FROM = 100'],
  [LIB, 'timeout moved', 'STUDIO_KG_ASK_TIMEOUT_MS = 30000', 'STUDIO_KG_ASK_TIMEOUT_MS = 300000'],
  [LIB, 'question not trimmed', "const question = typeof raw === 'string' ? raw.trim() : ''", "const question = typeof raw === 'string' ? raw : ''"],
  [LIB, 'length counts UTF-16 units', 'Array.from(question).length > STUDIO_KG_ASK_MAX_QUESTION', 'question.length > STUDIO_KG_ASK_MAX_QUESTION'],
  [LIB, 'length counts untrimmed', 'Array.from(value.trim()).length', 'Array.from(value).length'],
  [LIB, 'blank passes', "if (!question) return { ok: false, reason: 'empty'", "if (question === null) return { ok: false, reason: 'empty'"],
  [LIB, 'client sends more', 'return { query: question }', 'return { query: question, user_id: question }'],
  [LIB, 'user_id dropped', 'return { user_id: userId, query_text: question, ...STUDIO_KG_QUERY_PARAMS }', 'return { query_text: question, ...STUDIO_KG_QUERY_PARAMS }'],
  [LIB, 'query_text renamed', 'query_text: question, ...STUDIO_KG_QUERY_PARAMS', 'query: question, ...STUDIO_KG_QUERY_PARAMS'],
  [LIB, 'max_nodes out of range', 'max_nodes: 8,', 'max_nodes: 80,'],
  [LIB, 'hops out of range', 'hops: 1,', 'hops: 3,'],
  [LIB, 'min_similarity moved', 'min_similarity: 0.6 }', 'min_similarity: 0.1 }'],
  [LIB, 'protocol check dropped', "return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null", 'return parsed.href'],
  [LIB, 'only https', "parsed.protocol === 'http:' || parsed.protocol === 'https:'", "parsed.protocol === 'https:'"],
  [LIB, 'deck id not encoded', 'encodeURIComponent(sessionId)', 'sessionId'],
  [LIB, 'seeds not first', 'seeds.sort((a, b) => b.similarity - a.similarity || a.index - b.index)', 'seeds.sort((a, b) => a.similarity - b.similarity || a.index - b.index)'],
  [LIB, 'others not by salience', 'others.sort((a, b) => b.salience - a.salience || a.index - b.index)', 'others.sort((a, b) => a.salience - b.salience || a.index - b.index)'],
  [LIB, 'idea repeated', 'if (seenEntity.has(key)) continue', ''],
  [LIB, 'best flag wrong', 'best: rank < seeds.length', 'best: rank < 1'],
  [LIB, 'unresolved name kept', "from === '?' || to === '?'", 'false'],
  [LIB, 'connection repeated', 'if (seenEdge.has(key)) continue', ''],
  [LIB, 'underscores kept', ".replace(/_/g, ' ')\n    if (!from", "\n    if (!from"],
  [LIB, 'passage repeated', 'if (seenPassage.has(key)) continue', ''],
  [LIB, 'empty snippet kept', 'if (!snippet) continue', ''],
  [LIB, 'passage cap', 'STUDIO_KG_ASK_MAX_PASSAGES = 8', 'STUDIO_KG_ASK_MAX_PASSAGES = 80'],
  [LIB, 'idea cap', 'STUDIO_KG_ASK_MAX_ENTITIES = 8', 'STUDIO_KG_ASK_MAX_ENTITIES = 80'],
  [LIB, 'connection cap', 'STUDIO_KG_ASK_MAX_CONNECTIONS = 5', 'STUDIO_KG_ASK_MAX_CONNECTIONS = 50'],
  [LIB, 'source link dropped', "if (url) links.push({ kind: 'source'", "if (false) links.push({ kind: 'source'"],
  [LIB, 'deck link dropped', "if (sessionId) links.push({ kind: 'deck'", "if (false) links.push({ kind: 'deck'"],
  [LIB, 'source link not external', "label: STUDIO_KG_ASK_WORDS.openSource, external: true", "label: STUDIO_KG_ASK_WORDS.openSource, external: false"],
  [LIB, 'title ignores the file', "const title = filename || (url ? hostOf(url) : '') || kind", "const title = (url ? hostOf(url) : '') || kind"],
  [LIB, 'host keeps www', ".replace(/^www\\./i, '')", ''],
  [LIB, 'page number dropped', "page !== null && page > 0 ? `p.${Math.floor(page)}` : ''", "''"],
  [LIB, 'page of zero shown', 'page !== null && page > 0 ?', 'page !== null ?'],
  [LIB, 'kind said twice', "title === kind ? '' : kind", 'kind'],
  [LIB, 'source count wrong', 'sources.add(filename ?', 'sources.add(sessionId ?'],
  [LIB, 'numbering from zero', 'number: passages.length + 1', 'number: passages.length'],
  [LIB, 'context pack used', 'if (!root) return null\n', 'if (!root) return null\n  if (typeof root.context_pack === \'string\' && root.context_pack) return { entities: [], connections: [], sourceCount: 1, passages: [{ key: \'pack\', number: 1, snippet: root.context_pack, title: \'pack\', meta: \'\', entity: \'\', links: [] }] }\n'],
  [LIB, 'empty counts ideas only', 'result.passages.length === 0 && result.entities.length === 0', 'result.entities.length === 0'],
  [LIB, 'junk body accepted', "if (!root) return null\n", "if (!root) return { entities: [], connections: [], passages: [], sourceCount: 0 }\n"],
  [LIB, 'summary plural', "n === 1 ? one : many", "n === 0 ? one : many"],
  [LIB, '403 reads as down', "if (status === 403) return STUDIO_KG_ASK_WORDS.errorPlan", "if (status === 403) return STUDIO_KG_ASK_WORDS.errorDown"],
  [LIB, '429 reads as down', "if (status === 429) return STUDIO_KG_ASK_WORDS.errorBusy", "if (status === 429) return STUDIO_KG_ASK_WORDS.errorDown"],
  [LIB, 'timeout reads as network', "if ('timeout' in failure) return STUDIO_KG_ASK_WORDS.errorTimeout", "if ('timeout' in failure) return STUDIO_KG_ASK_WORDS.errorNetwork"],
  [LIB, 'hint promises an answer', 'It does not write an answer.', 'It writes you an answer.'],
  // the route
  [ROUTE, 'flag ignored', "if (process.env.NEXT_PUBLIC_STUDIO_KG_ASK !== 'true') {", 'if (false) {'],
  [ROUTE, 'flag is truthy', "process.env.NEXT_PUBLIC_STUDIO_KG_ASK !== 'true'", '!process.env.NEXT_PUBLIC_STUDIO_KG_ASK'],
  [ROUTE, 'flag checked after the session', "  if (process.env.NEXT_PUBLIC_STUDIO_KG_ASK !== 'true') {\n    return NextResponse.json({ error: 'Not found' }, { status: 404 })\n  }\n\n  const gate = await requireKgEntitled()", "  const gate = await requireKgEntitled()\n  if (process.env.NEXT_PUBLIC_STUDIO_KG_ASK !== 'true') {\n    return NextResponse.json({ error: 'Not found' }, { status: 404 })\n  }\n"],
  [ROUTE, 'gate skipped', 'if (gate.error) return gate.error', ''],
  [ROUTE, 'guard skipped', 'if (!checked.ok) {', 'if (false) {'],
  [ROUTE, 'untrimmed question', 'checked.question)', 'String(body.query))'],
  [ROUTE, 'browser sets the user', 'studioKgAskBackendBody(gate.userId, checked.question)', 'studioKgAskBackendBody((body as any).user_id ?? gate.userId, checked.question)'],
  [ROUTE, 'wrong backend path', '/api/v1/kg/query`', '/api/v1/kg/search`'],
  [ROUTE, 'wrong method', "method: 'POST',", "method: 'PUT',"],
  [ROUTE, 'no service key', "headers: kgHeaders({ 'Content-Type': 'application/json' })", "headers: { 'Content-Type': 'application/json' }"],
  [ROUTE, 'missing router passes through', 'if (resp.status === 404) {', 'if (false) {'],
  [ROUTE, 'failure passes as ok', 'if (!resp.ok) {', 'if (false) {'],
  [ROUTE, 'backend text passed on', "{ error: 'Ask failed' }", '{ error: await resp.text() }'],
  [ROUTE, 'network error passed on', "{ error: 'Knowledge graph service is temporarily unavailable', service_unavailable: true }", '{ error: String(e), service_unavailable: true }'],
  [ROUTE, 'config error swallowed', 'if (e instanceof ServiceUrlConfigError) return', 'if (false) return'],
  // the hook
  [HOOK, 'no abort of the older request', 'controllerRef.current?.abort()\n    const controller', 'const controller'],
  [HOOK, 'stale answer shown', 'generationRef.current === generation', 'true'],
  [HOOK, 'unmounted still sets', 'mountedRef.current && generationRef.current === generation', 'generationRef.current === generation'],
  [HOOK, 'unmount does not abort', 'mountedRef.current = false\n      controllerRef.current?.abort()', 'mountedRef.current = false'],
  [HOOK, 'reset does not cancel', 'generationRef.current += 1\n    controllerRef.current?.abort()', 'generationRef.current += 0'],
  [HOOK, 'no timeout', 'const timer = setTimeout(() => { timedOut = true; controller.abort() }, STUDIO_KG_ASK_TIMEOUT_MS)', 'const timer = 0'],
  [HOOK, 'timeout reads as network', 'fail(timedOut ? { timeout: true } : { network: true })', 'fail({ network: true })'],
  [HOOK, 'empty answer is ready', 'phase: studioKgAskIsEmpty(result) ? "empty" : "ready"', 'phase: "ready"'],
  [HOOK, 'failed answer is ready', 'if (!resp.ok) return fail({ status: resp.status })', ''],
  [HOOK, 'unreadable body is empty', 'if (!result) return fail({ unreadable: true })', ''],
  [HOOK, 'untrimmed question sent', 'studioKgAskClientBody(checked.question)', 'studioKgAskClientBody(raw)'],
  [HOOK, 'guard skipped', 'if (!checked.ok) return false', ''],
  [HOOK, 'GET instead of POST', 'method: "POST",', 'method: "GET",'],
  [HOOK, 'timer never cleared', 'clearTimeout(timer)', ''],
  // the component
  [UI, 'no form: Enter does not submit', '<form onSubmit={submit} role="search"', '<div role="search"'],
  [UI, 'submit not prevented', 'event.preventDefault()\n    if (loading) return', 'if (loading) return'],
  [UI, 'second request while asking', 'if (loading) return\n    const checked', 'const checked'],
  [UI, 'button stays enabled', 'disabled={loading}', 'disabled={false}'],
  [UI, 'guard skipped', "if (!checked.ok) { setGuard(checked.message); return }", 'if (!checked.ok) { return }'],
  [UI, 'typing keeps the note', 'setText(event.target.value); setGuard(null)', 'setText(event.target.value)'],
  [UI, 'no live too-long note', 'const note = over ? WORDS.guardTooLong : guard', 'const note = guard'],
  [UI, 'counter always on', 'const showCount = length >= STUDIO_KG_ASK_COUNTER_FROM', 'const showCount = length >= 0'],
  [UI, 'maxLength cuts silently', 'autoComplete="off"', 'autoComplete="off" maxLength={500}'],
  [UI, 'label dropped', 'htmlFor={inputId}', ''],
  [UI, 'note not described', 'aria-describedby={note ? noteId : undefined}', ''],
  [UI, 'result not announced', 'aria-live="polite"', ''],
  [UI, 'loading not a status', 'role="status" data-studio-kg-ask-loading', 'data-studio-kg-ask-loading'],
  [UI, 'error not an alert', 'data-studio-kg-ask-error="true" role="alert"', 'data-studio-kg-ask-error="true"'],
  [UI, 'retry asks something else', 'onClick={() => ask(state.asked)}', 'onClick={() => ask(text)}'],
  [UI, 'external link in the same tab', 'target="_blank" rel="noopener noreferrer"', ''],
  [UI, 'external link without noopener', 'rel="noopener noreferrer"', 'rel="noreferrer"'],
  [UI, 'deck link external', 'link.external\n              ?', '!link.external\n              ?'],
  [UI, 'no not-an-answer note', '<span>{WORDS.notAnswer}</span>', ''],
  [UI, 'no clear when idle guard', '{state.phase !== "idle" && !loading &&', '{!loading &&'],
  [UI, 'clear keeps the text', 'reset()\n    setText("")', 'reset()'],
  [UI, 'empty state missing', '{state.phase === "empty" && (', '{false && ('],
  [UI, 'hint missing', '<p data-studio-kg-ask-hint="true">{WORDS.hint}</p>', ''],
  [UI, 'hint only while idle', '<p data-studio-kg-ask-hint="true">{WORDS.hint}</p>', '{state.phase === "idle" && <p data-studio-kg-ask-hint="true">{WORDS.hint}</p>}'],
  [UI, 'panel always open', 'data-open={state.phase !== "idle" ? "true" : undefined}', 'data-open="true"'],
  [UI, 'panel never opens', 'data-open={state.phase !== "idle" ? "true" : undefined}', ''],
  [UI, 'Escape does not close', 'event.key === "Escape" && state.phase !== "idle"', 'event.key === "Esc"'],
  [UI, 'Escape closes an idle page', 'event.key === "Escape" && state.phase !== "idle"', 'event.key === "Escape"'],
  [UI, 'Escape clears the words', 'event.stopPropagation(); reset() }', 'event.stopPropagation(); reset(); setText("") }'],
  [UI, 'Escape bubbles', 'event.stopPropagation(); reset()', 'reset()'],
  [UI, 'one column', 'data-two={side && result.passages.length > 0 ? "true" : undefined}', ''],
  [UI, 'passages list when none', '{result.passages.length > 0 && (', '{true && ('],
  [UI, 'marker dropped', '<section data-studio-kg-ask="true"', '<section'],
  [UI, 'state not exposed', 'data-studio-kg-ask-state={state.phase}', ''],
  // the page
  [PAGE, 'box always on', 'const KG_ASK = studioKgAskOn(process.env.NEXT_PUBLIC_STUDIO_KG_ASK, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)', 'const KG_ASK = true'],
  [PAGE, 'box ignores the shell', 'process.env.NEXT_PUBLIC_STUDIO_KG_ASK, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)', 'process.env.NEXT_PUBLIC_STUDIO_KG_ASK, "true")'],
  [PAGE, 'box unguarded', '{KG_ASK && <StudioKgAsk />}', '<StudioKgAsk />'],
  [PAGE, 'box below the map', '      {KG_ASK && <StudioKgAsk />}\n\n      <div data-studio-knowledge-role="layout"', '      <div data-studio-knowledge-role="layout"'],
  // the sheet and the example
  [CSS, 'a hex colour', 'color: var(--ss-text); font-size: 14px; font-weight: 600; white-space: nowrap;', 'color: #123456; font-size: 14px; font-weight: 600; white-space: nowrap;'],
  [CSS, 'an unanchored rule', '[data-studio-v4-shell="true"] [data-studio-kg-ask="true"] [data-studio-kg-ask-form="true"] { display: flex;', '[data-studio-kg-ask-form="true"] { display: flex;'],
  [CSS, 'result no longer scrolls', 'max-height: min(58vh, 540px); overflow-y: auto;', 'max-height: none;'],
  [CSS, 'panel in the flow', 'position: absolute; z-index: 30; top: calc(100% + 6px);', 'position: static; z-index: 30; top: calc(100% + 6px);'],
  [CSS, 'box not an anchor', 'position: relative; z-index: 20;', 'z-index: 20;'],
  [CSS, 'one column only', 'grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);', ''],
  [CSS, 'a token that does not exist', 'background: var(--ss-panel); color: var(--ss-text);\n}', 'background: var(--ss-nonexistent); color: var(--ss-text);\n}'],
  [CSS, '!important', 'text-transform: uppercase; }', 'text-transform: uppercase !important; }'],
  [ENV, 'flag default on', `${FLAG}="false"`, `${FLAG}="true"`],
  [ENV, 'flag undocumented', `${FLAG}="false"`, `${FLAG}_X="false"`],
  [ENV, 'no 404 note', 'answers 404', 'answers'],
  [ENV, 'claims an answer', 'It is not a written\n# answer', 'It is a written\n# answer'],
]
const missing = MUTANTS.filter(([file, , from]) => !SOURCES[file].includes(from)).map(([file, name]) => `${file}: ${name}`)
assert.deepEqual(missing, [], `mutants whose text is not in the source: ${missing.join('; ')}`)
const survivors = []
let killed = 0
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  try { await proveAll({ [file]: mutated }, ONLY[file] ?? null); survivors.push(`${file}: ${name}`) }
  catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
}
counting = true
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join('; ')}`)
eq(killed, MUTANTS.length)
checks = realChecks + 1
console.log(`Studio KG Ask (Ask your second brain): ${realChecks} checks passed in ${realMs} ms, ${killed}/${MUTANTS.length} mutants killed; no network.`)
