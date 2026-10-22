// PASS2 Second Brain (FRONTEND-1): the Knowledge page as the accepted v4 mockup has it, on the REAL knowledge graph. Flag NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN (exact "true"),
// default off, and only with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL "true"). Rows (PROGRAM-1 table D + the "move to mock" verdicts):
//   SB-02 a read-only "Sources" popover: the sources the graph's own evidence names + the link to where uploads live (no connections, no "This Mac", nothing writes)
//   SB-05 the real 2D map restyled: a soft glow, a count badge in each node, clearer label plates (no 3D)
//   SB-06 "Full screen" in the map toolbar (the browser's full screen; Esc leaves it); no orbit animation
//   SB-08 the inspector's three-number strip (mentions / evidence / sessions) in place of the text line; no "Coverage"
//   SB-10 "Used in your decks": contributing session ids resolved to deck titles from the person's own deck list (GET /api/sessions, read only)
//   NOT built: SB-01 (deck nodes in the graph) and SB-12 (Ask Knowledge) are backlog by ruling; SB-17 (+ Presentation / rail cue) is Builder D's DET-12.
//
// Run: node scripts/test-studio-p2-second-brain.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   P2_SB_BASE=<commit> overrides the base commit flag-off identity is checked against (default d7c7751d, the studio-v4-dev-preparation-code tip the work was rebased onto: the Knowledge batch #440-#444 is in it).
//
// Proven on the REAL sources:
//   1. lib/studio-p2-second-brain.ts: import-free; the flag rule, words, routes, strip, source aggregation, deck resolution, badge, halo id, full-screen rules;
//   2. the components (executed with a small hooks runtime): the Sources popover, the deck-list hook + provider, the inspector, the graph view;
//   3. the wiring (executed against the base commit's files): flag off, or flag on without the shell = the same trees and the same requests as the base, for the page,
//      the inspector and the graph view; flag on = the rows above;
//   4. the CSS: every rule hangs on a marker only the flag-on markup carries; tokens only;
//   5. mutation check: every mutant of the sources is killed by sections 1-4.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.P2_SB_BASE || 'd7c7751d0306f97ffa8d07eea3ded80b38035593'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseCache = new Map()
const baseSource = rel => {
  if (!baseCache.has(rel)) {
    try { baseCache.set(rel, execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })) }
    catch (error) { throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history): ${error.message}`) }
  }
  return baseCache.get(rel)
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm carry its realm's prototypes
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))
const same = count((a, b, message) => assert.ok(a === b, message)) // string equality without dumping two whole trees on failure
const attempt = fn => { try { return fn() } catch (error) { return { threw: String(error) } } } // a mutant that crashes must fail an assertion, not the run

const LIB = 'lib/studio-p2-second-brain.ts'
const SOURCES_UI = 'components/knowledge/studio-p2-sources.tsx'
const HOOK = 'hooks/use-studio-p2-deck-titles.ts'
const PROVIDER = 'components/knowledge/studio-p2-deck-provider.tsx'
const INSPECTOR = 'components/knowledge/studio-knowledge-inspector.tsx'
const GRAPH = 'components/knowledge/kg-graph-view.tsx'
const PAGE = 'app/(app)/knowledge/page.tsx'
const CSS = 'components/knowledge/studio-p2-second-brain.css'
const ENV = '.env.example'
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN'
const SOURCES = Object.fromEntries([LIB, SOURCES_UI, HOOK, PROVIDER, INSPECTOR, GRAPH, PAGE, CSS, ENV].map(rel => [rel, read(rel)]))

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
let overrides = {} // a mutant of a shared file (the helper) reaches every component that loads it
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

const fakeDocument = (overrides = {}) => {
  const listeners = new Map()
  const doc = {
    fullscreenEnabled: true, fullscreenElement: null, listeners,
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => listeners.set(type, (listeners.get(type) ?? []).filter(item => item !== fn)),
    fire(type, event = {}) { for (const fn of listeners.get(type) ?? []) fn({ type, ...event }) },
    exited: 0, exitFullscreen() { doc.exited++; return Promise.resolve() },
    ...overrides,
  }
  return doc
}

// ---------------------------------------------------------------- 1. the helper
function proveLib(source, label = 'lib') {
  nomatch(source, /^\s*(?:import\b|export\s+\*?\s*from\b)|require\(/m, `${label}: import-free`)
  const module = { exports: {} }
  new Function('module', 'exports', compile(source, LIB))(module, module.exports)
  const lib = module.exports
  for (const [flag, shell, want] of [['true', 'true', true], ['true', 'false', false], ['true', undefined, false], ['true', 'TRUE', false], ['false', 'true', false], [undefined, 'true', false], ['1', 'true', false], ['TRUE', 'true', false], [' true', 'true', false], ['', 'true', false], [null, 'true', false]]) {
    eq(lib.studioP2SecondBrainOn(flag, shell), want, `${label}: flag ${JSON.stringify(flag)} with shell ${JSON.stringify(shell)}`)
  }
  deepEq({ ...lib.STUDIO_SB_WORDS }, {
    sources: 'Sources', sourcesTitle: 'Sources feeding your graph', sourcesClose: 'Close sources', sourcesLoading: 'Reading the evidence behind your strongest entities…',
    sourcesEmpty: 'No sources are recorded in your graph yet.', sourcesPartial: 'Some entities could not be read, so this list may be incomplete.', sourcesRetry: 'Try again',
    upload: 'Add a file or link in Studio', uploadHint: 'Uploads live in the chat composer in Studio. Nothing is added from this page.',
    fullScreen: 'Full screen', exitFullScreen: 'Exit full screen', usedInDecks: 'Used in your decks', decksLoading: 'Looking up your decks…',
    decksNone: 'No deck is recorded for this entity yet.', decksError: 'Your deck list could not be loaded.', decksRetry: 'Retry', untitledDeck: 'Untitled presentation',
  }, `${label}: the words`)
  eq(lib.STUDIO_SB_UPLOAD_HREF, '/builder?session_id=new', `${label}: uploads start in a fresh Studio session`)
  ok(fs.existsSync(path.join(repoRoot, 'app/builder/page.tsx')), `${label}: /builder is a real route`)
  ok(fs.existsSync(path.join(repoRoot, 'app/api/sessions/route.ts')), `${label}: /api/sessions is a real route`)
  ok(fs.existsSync(path.join(repoRoot, 'app/api/knowledge-graph/nodes/[nodeId]/route.ts')), `${label}: the node-detail read is a real route`)
  deepEq([lib.STUDIO_SB_MAX_SOURCE_ENTITIES, lib.STUDIO_SB_SESSION_PAGE, lib.STUDIO_SB_SESSION_MAX_PAGES], [8, 100, 5], `${label}: the read limits`)
  ok(/limit = Math\.min\(parseInt\(searchParams\.get\('limit'\) \|\| '50'\), 100\)/.test(read('app/api/sessions/route.ts')), `${label}: the deck list's own page cap is the 100 the helper pages by`)
  eq(lib.studioDeckHref('abc-123'), '/builder?session_id=abc-123', `${label}: deck link`)
  eq(lib.studioDeckHref('a b&c=d'), '/builder?session_id=a%20b%26c%3Dd', `${label}: a session id is encoded`)
  for (const [page, want] of [[0, '/api/sessions?limit=100&offset=0'], [1, '/api/sessions?limit=100&offset=100'], [4, '/api/sessions?limit=100&offset=400'], [-1, '/api/sessions?limit=100&offset=0'], [1.5, '/api/sessions?limit=100&offset=0'], [NaN, '/api/sessions?limit=100&offset=0']]) eq(lib.studioSessionsPageUrl(page), want, `${label}: sessions page ${page}`)
  // SB-08
  deepEq(lib.studioStatStrip(5, 3, 2), [{ id: 'mentions', label: 'Mentions', value: 5 }, { id: 'evidence', label: 'Evidence', value: 3 }, { id: 'sessions', label: 'Sessions', value: 2 }], `${label}: strip order, words, values`)
  deepEq(lib.studioStatStrip(undefined, NaN, -4).map(s => s.value), [0, 0, 0], `${label}: an unreadable count is 0`)
  deepEq(lib.studioStatStrip('7', null, 2.9).map(s => s.value), [0, 0, 2], `${label}: a string is not a count; a fraction floors`)
  ok(!lib.studioStatStrip(1, 1, 1).some(s => /coverage/i.test(s.label)), `${label}: no Coverage`)
  // SB-02
  for (const [type, want] of [['chunk', 'Uploaded document'], ['table_summary', 'Table summary'], ['researcher_context', 'Deck research'], ['web', 'Web research'], ['some_other_kind', 'some other kind'], [null, 'Knowledge source'], [undefined, 'Knowledge source'], ['', 'Knowledge source'], ['  ', 'Knowledge source'], [4, 'Knowledge source']]) eq(lib.studioSourceTypeLabel(type), want, `${label}: source label ${String(type)}`)
  const details = [
    { evidence: [{ document_filename: 'q3.pdf', source_type: 'chunk' }, { document_filename: 'q3.pdf', source_type: 'chunk' }, { document_filename: null, source_type: 'web' }] },
    { evidence: [{ document_filename: ' q3.pdf ', source_type: 'chunk' }, { document_filename: 'notes.docx', source_type: 'chunk' }, { source_type: 'web' }, null, 'x', 4] },
    { evidence: 'broken' }, null, undefined, 7, {},
    { evidence: [{ document_filename: 'a.pdf' }] },
  ]
  deepEq(lib.studioAggregateSources(details), [
    { key: 'file:q3.pdf', name: 'q3.pdf', kind: 'Uploaded document', passages: 3, entities: 2 },
    { key: 'kind:Web research', name: 'Web research', kind: 'Web research', passages: 2, entities: 2 },
    { key: 'file:a.pdf', name: 'a.pdf', kind: 'Knowledge source', passages: 1, entities: 1 },
    { key: 'file:notes.docx', name: 'notes.docx', kind: 'Uploaded document', passages: 1, entities: 1 },
  ], `${label}: sources grouped by filename (trimmed) or by kind, most passages first, then name; bad records skipped`)
  for (const empty of [null, undefined, 'x', {}, [], [null], [{}]]) deepEq(lib.studioAggregateSources(empty), [], `${label}: no sources for ${JSON.stringify(empty)}`)
  eq(lib.studioPassagesText(1), '1 passage', `${label}: singular`)
  eq(lib.studioPassagesText(2), '2 passages', `${label}: plural`)
  eq(lib.studioPassagesText(0), '0 passages', `${label}: zero`)
  // SB-10
  const byId = {}
  lib.studioIndexSessions(byId, [{ id: 's1', title: '  Q3 Board  ', slideCount: 12 }, { id: 's2', title: '', slideCount: null }, { id: 's3', title: null, slideCount: -2 }, { id: 's4', title: 'T', slideCount: 7.8 }, { id: '', title: 'x' }, { title: 'no id' }, null, 'x', { id: 5 }])
  deepEq(byId, { s1: { title: 'Q3 Board', slideCount: 12 }, s2: { title: null, slideCount: null }, s3: { title: null, slideCount: null }, s4: { title: 'T', slideCount: 7 } }, `${label}: the deck list folded into an id map`)
  deepEq(lib.studioIndexSessions({ a: { title: 'A', slideCount: 1 } }, 'nope'), { a: { title: 'A', slideCount: 1 } }, `${label}: a page that is not a list changes nothing`)
  deepEq(lib.studioResolveDecks(['s1', 's9', 's2', 's1', 's4', '', 7, null, 's9'], byId), {
    decks: [{ id: 's1', title: 'Q3 Board', slideCount: 12, href: '/builder?session_id=s1' }, { id: 's2', title: 'Untitled presentation', slideCount: null, href: '/builder?session_id=s2' }, { id: 's4', title: 'T', slideCount: 7, href: '/builder?session_id=s4' }],
    missing: 1,
  }, `${label}: decks in the entity's order, each once; an unknown id is counted, not shown`)
  deepEq(lib.studioResolveDecks('x', {}), { decks: [], missing: 0 }, `${label}: no ids`)
  deepEq(lib.studioResolveDecks(['toString', '__proto__', 'constructor'], {}), { decks: [], missing: 3 }, `${label}: an id named like an Object member is never a deck`)
  for (const [slides, want] of [[12, '12 slides'], [1, '1 slide'], [0, '0 slides'], [null, ''], [-1, ''], [NaN, '']]) eq(lib.studioSlidesText(slides), want, `${label}: slides text for ${slides}`)
  for (const [missing, want] of [[0, ''], [-1, ''], [NaN, ''], [1, '1 earlier session is no longer in your deck list.'], [3, '3 earlier sessions are no longer in your deck list.']]) eq(lib.studioMissingDecksText(missing), want, `${label}: missing text for ${missing}`)
  // SB-05
  deepEq(lib.studioNodeBadge(5, 12), { text: '5', fontSize: 10.8 }, `${label}: badge for a small count`)
  deepEq(lib.studioNodeBadge(150, 20), { text: '99+', fontSize: 11.3 }, `${label}: badge above 99 reads 99+, sized to its three characters`)
  deepEq(lib.studioNodeBadge(99, 22), { text: '99', fontSize: 14 }, `${label}: badge is at most 14`)
  deepEq(lib.studioNodeBadge(1, 5), { text: '1', fontSize: 8 }, `${label}: badge is at least 8`)
  for (const [mentions, radius] of [[0, 12], [-3, 12], [NaN, 12], ['5', 12], [undefined, 12], [null, 12], [5, 0], [5, -1], [5, NaN]]) eq(lib.studioNodeBadge(mentions, radius), null, `${label}: no badge for ${String(mentions)} at ${radius}`)
  eq(lib.STUDIO_NODE_HALO, 2.3, `${label}: the glow reaches 2.3 radii`)
  eq(lib.studioHaloId(['A', 'B', 'C'], 'C'), 'kg-p2-halo-2', `${label}: halo id is the type's position`)
  eq(lib.studioHaloId(['A', 'B'], 'weird <type> "x"'), 'kg-p2-halo-0', `${label}: an unknown type falls back to the first gradient`)
  // SB-06
  for (const [doc, want] of [[{ fullscreenEnabled: true }, true], [{ fullscreenEnabled: false }, false], [{}, false], [null, false], [undefined, false], [{ fullscreenEnabled: 'yes' }, false], [{ fullscreenEnabled: 1 }, false]]) eq(lib.studioFullscreenSupported(doc), want, `${label}: full screen support for ${JSON.stringify(doc)}`)
  const el = {}
  for (const [doc, element, want] of [[{ fullscreenElement: el }, el, true], [{ fullscreenElement: {} }, el, false], [{ fullscreenElement: null }, el, false], [{ fullscreenElement: el }, null, false], [{ fullscreenElement: null }, null, false], [null, el, false], [{}, el, false], [{ fullscreenElement: undefined }, undefined, false]]) eq(lib.studioFullscreenActive(doc, element), want, `${label}: full screen active`)
  eq(lib.studioFullscreenLabel(false), 'Full screen', `${label}: label off`)
  eq(lib.studioFullscreenLabel(true), 'Exit full screen', `${label}: label on`)
  return lib
}

// ---------------------------------------------------------------- fixtures
const TOP = Array.from({ length: 10 }, (_, i) => ({ node_id: `n${i + 1}`, name: `Entity ${i + 1}`, entity_type: 'ORG', salience: 1, mention_count: 2 }))
const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => structuredClone(body) })
const DETAILS = {
  n1: { evidence: [{ document_filename: 'q3.pdf', source_type: 'chunk', session_id: 's1' }, { document_filename: 'q3.pdf', source_type: 'chunk', session_id: 's1' }] },
  n2: { evidence: [{ document_filename: 'q3.pdf', source_type: 'chunk', session_id: 's1' }, { document_filename: null, source_type: 'web', session_id: 's2' }] },
  n3: { evidence: [{ document_filename: 'notes.docx', source_type: 'chunk', session_id: 's2' }] },
}
function createFetch(routes) {
  const calls = []
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET' })
    for (const [prefix, answer] of Object.entries(routes)) if (String(url).startsWith(prefix)) return typeof answer === 'function' ? answer(String(url), init) : answer
    throw new Error(`fixture refuses ${url}`)
  }
  fn.calls = calls
  return fn
}
const STUBS = { 'next/link': { default: 'Link', __esModule: true }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') }, './kg-graph-view': { typeColor: type => `#${type}` } }

// ---------------------------------------------------------------- 2a. the Sources popover (SB-02)
async function proveSourcesUi(source, label = 'sources') {
  const doc = fakeDocument()
  const fetchFn = createFetch({ '/api/knowledge-graph/nodes/': url => { const id = decodeURIComponent(url.split('/').pop()); return DETAILS[id] ? respond(200, DETAILS[id]) : respond(200, { evidence: [] }) } })
  const world = createWorld({ real: new Set([LIB, SOURCES_UI]), sources: { [SOURCES_UI]: source }, stubs: STUBS, globals: { document: doc, fetch: fetchFn, AbortController, Promise, Set, Map, Array, Object, JSON, encodeURIComponent, decodeURIComponent, structuredClone } })
  const { StudioP2Sources } = world.load(SOURCES_UI)
  const props = { entities: TOP }
  const view = () => world.runtime.render(StudioP2Sources, props)
  let tree = view()
  const buttonOf = t => all(t, i => i.type === 'Button')[0]
  eq(buttonOf(tree).props['aria-expanded'], false, `${label}: closed at first`)
  eq(all(tree, i => i.props?.['data-studio-p2-sources-panel']).length, 0, `${label}: no panel while closed`)
  eq(fetchFn.calls.length, 0, `${label}: nothing is read before it is opened`)
  eq(flat(buttonOf(tree)).replace(/\s/g, ''), 'Sources', `${label}: the button says Sources, with no count before the read`)
  const root = all(tree, i => i.props?.['data-studio-p2-sources'] === 'true')[0]
  const focused = []
  root.props.ref.current = { contains: node => node === 'inside' }
  buttonOf(tree).props.ref.current = { focus: () => focused.push(1) }
  buttonOf(tree).props.onClick()
  tree = view()
  eq(buttonOf(tree).props['aria-expanded'], true, `${label}: open after a click`)
  const panel = () => all(tree, i => i.props?.['data-studio-p2-sources-panel'])[0]
  eq(panel().props.id, buttonOf(tree).props['aria-controls'], `${label}: aria-controls names the panel`)
  match(flat(panel()), /Reading the evidence behind your strongest entities…/, `${label}: reading state first`)
  await settle(); tree = view()
  const reads = fetchFn.calls.map(c => c.url)
  deepEq(reads, TOP.slice(0, 8).map(e => `/api/knowledge-graph/nodes/${e.node_id}`), `${label}: one detail read for each of the 8 strongest entities, no more`)
  ok(fetchFn.calls.every(c => c.method === 'GET'), `${label}: every read is a GET (nothing writes)`)
  const rows = all(tree, i => i.props?.['data-studio-p2-source'] === 'true')
  deepEq(rows.map(r => flat(r)), ['q3.pdf Uploaded document · 3 passages', 'notes.docx Uploaded document · 1 passage', 'Web research Web research · 1 passage'], `${label}: the real sources, most passages first, then by name`)
  eq(flat(all(tree, i => i.props?.['data-studio-p2-sources-count'])[0]), '3', `${label}: the count badge after a full read`)
  const upload = all(tree, i => i.props?.['data-studio-p2-sources-upload'])[0]
  eq(upload.type, 'Link', `${label}: the upload entry is a link`)
  eq(upload.props.href, '/builder?session_id=new', `${label}: ...to a fresh Studio session`)
  match(flat(panel()), /Uploads live in the chat composer in Studio\. Nothing is added from this page\./, `${label}: says where uploads live`)
  nomatch(flat(tree), /Connections|This Mac|Include for Director|Remove|Drive|Dropbox/i, `${label}: no simulated connections or write controls`)
  eq(all(tree, i => i.type === 'input' || i.type === 'Input').length, 0, `${label}: no inputs (nothing to include or search)`)
  eq(all(tree, i => i.props?.['data-studio-p2-sources-state'] === 'partial').length, 0, `${label}: no partial note after a clean read`)
  // closing: Escape returns focus to the button; an outside press does not steal it; a press inside stays open
  doc.fire('mousedown', { target: 'inside' }); tree = view()
  eq(buttonOf(tree).props['aria-expanded'], true, `${label}: a press inside keeps it open`)
  doc.fire('keydown', { key: 'Enter' }); tree = view()
  eq(buttonOf(tree).props['aria-expanded'], true, `${label}: another key keeps it open`)
  doc.fire('keydown', { key: 'Escape' }); tree = view()
  eq(buttonOf(tree).props['aria-expanded'], false, `${label}: Escape closes`)
  eq(focused.length, 1, `${label}: ...and returns focus to the button`)
  eq((doc.listeners.get('keydown') ?? []).length + (doc.listeners.get('mousedown') ?? []).length, 0, `${label}: closed, no document listeners are left`)
  buttonOf(tree).props.onClick(); tree = view()
  eq(fetchFn.calls.length, 8, `${label}: reopening does not read again`)
  eq(flat(all(tree, i => i.props?.['data-studio-p2-sources-count'])[0]), '3', `${label}: the list is kept`)
  doc.fire('mousedown', { target: 'outside' }); tree = view()
  eq(buttonOf(tree).props['aria-expanded'], false, `${label}: a press outside closes`)
  eq(focused.length, 1, `${label}: ...without moving focus`)
  buttonOf(tree).props.onClick(); tree = view()
  all(tree, i => i.type === 'button' && i.props['aria-label'] === 'Close sources')[0].props.onClick(); tree = view()
  eq(buttonOf(tree).props['aria-expanded'], false, `${label}: the close button closes`)
  eq(focused.length, 2, `${label}: ...and returns focus`)
  // a failed read: partial note, no count, retry reads again
  const failing = createFetch({ '/api/knowledge-graph/nodes/': url => (url.endsWith('/n2') ? respond(500, {}) : respond(200, DETAILS[decodeURIComponent(url.split('/').pop())] ?? { evidence: [] })) })
  const world2 = createWorld({ real: new Set([LIB, SOURCES_UI]), sources: { [SOURCES_UI]: source }, stubs: STUBS, globals: { document: fakeDocument(), fetch: failing, AbortController, Promise, Set, Map, Array, Object, JSON, encodeURIComponent, decodeURIComponent, structuredClone } })
  const comp = world2.load(SOURCES_UI).StudioP2Sources
  let t2 = world2.runtime.render(comp, props)
  all(t2, i => i.type === 'Button')[0].props.ref.current = { focus() {} }
  all(t2, i => i.props?.['data-studio-p2-sources'])[0].props.ref.current = { contains: () => true }
  all(t2, i => i.type === 'Button')[0].props.onClick(); t2 = world2.runtime.render(comp, props); await settle(); t2 = world2.runtime.render(comp, props)
  eq(all(t2, i => i.props?.['data-studio-p2-sources-state'] === 'partial').length, 1, `${label}: an unreadable entity shows the partial note`)
  eq(all(t2, i => i.props?.['data-studio-p2-sources-count']).length, 0, `${label}: ...and no count that could mislead`)
  eq(all(t2, i => i.props?.['data-studio-p2-source'] === 'true').length, 2, `${label}: ...while the sources that were read are still listed`)
  const before = failing.calls.length
  all(t2, i => i.type === 'button' && flat(i) === 'Try again')[0].props.onClick(); t2 = world2.runtime.render(comp, props); await settle()
  eq(failing.calls.length, before + 8, `${label}: Try again reads the eight entities again`)
  // empty graph
  const empty = createFetch({ '/api/knowledge-graph/nodes/': respond(200, { evidence: [] }) })
  const world3 = createWorld({ real: new Set([LIB, SOURCES_UI]), sources: { [SOURCES_UI]: source }, stubs: STUBS, globals: { document: fakeDocument(), fetch: empty, AbortController, Promise, Set, Map, Array, Object, JSON, encodeURIComponent, decodeURIComponent, structuredClone } })
  const comp3 = world3.load(SOURCES_UI).StudioP2Sources
  let t3 = world3.runtime.render(comp3, { entities: [] })
  all(t3, i => i.type === 'Button')[0].props.ref.current = { focus() {} }
  all(t3, i => i.type === 'Button')[0].props.onClick(); t3 = world3.runtime.render(comp3, { entities: [] }); await settle(); t3 = world3.runtime.render(comp3, { entities: [] })
  match(flat(t3), /No sources are recorded in your graph yet\./, `${label}: an empty graph says so`)
  eq(empty.calls.length, 0, `${label}: with no entities there is nothing to read`)
}

// ---------------------------------------------------------------- 2b. the deck list hook + provider (SB-10)
async function proveDeckHook(hookSource, providerSource, label = 'decks') {
  const mk = (routes) => {
    const fetchFn = createFetch(routes)
    const world = createWorld({ real: new Set([LIB, HOOK, PROVIDER]), sources: { [HOOK]: hookSource, [PROVIDER]: providerSource }, stubs: STUBS, globals: { fetch: fetchFn, AbortController, Promise, Set, Map, Array, Object, JSON } })
    const { StudioP2DeckProvider } = world.load(PROVIDER)
    const seen = []
    const render = enabled => world.runtime.render(StudioP2DeckProvider, { enabled, children: decks => { seen.push(decks); return 'child' } })
    return { fetchFn, world, render, seen, last: () => seen[seen.length - 1] }
  }
  const page = (ids, hasMore) => respond(200, { sessions: ids.map(id => ({ id, title: `Deck ${id}`, slideCount: 3 })), pagination: { hasMore } })
  // disabled: never reads
  let h = mk({ '/api/sessions': page(['s1'], false) })
  eq(flat(attempt(() => h.render(false))), 'child', `${label}: the provider renders what its child function returns`)
  await settle(); h.render(false)
  eq(h.fetchFn.calls.length, 0, `${label}: disabled, nothing is read`)
  deepEq({ status: h.last().status, byId: h.last().byId }, { status: 'idle', byId: {} }, `${label}: disabled, idle`)
  // enabled: one page
  h.render(true); await settle(); h.render(true)
  deepEq(h.fetchFn.calls.map(c => c.url), ['/api/sessions?limit=100&offset=0'], `${label}: one read of the first page when it stops there`)
  eq(h.fetchFn.calls[0].method, 'GET', `${label}: a GET`)
  deepEq({ status: h.last().status, byId: h.last().byId }, { status: 'ready', byId: { s1: { title: 'Deck s1', slideCount: 3 } } }, `${label}: ready with the deck map`)
  h.render(false); h.render(true); await settle()
  eq(h.fetchFn.calls.length, 1, `${label}: turning it off and on again does not read again`)
  // paging, capped at 5 pages
  let n = 0
  h = mk({ '/api/sessions': () => { n++; return page([`p${n}`], true) } })
  h.render(true); await settle(30); h.render(true)
  deepEq(h.fetchFn.calls.map(c => c.url), [0, 1, 2, 3, 4].map(p => `/api/sessions?limit=100&offset=${p * 100}`), `${label}: pages while the list says there is more, at most 5`)
  deepEq(Object.keys(h.last().byId), ['p1', 'p2', 'p3', 'p4', 'p5'], `${label}: every page's decks are kept`)
  n = 0
  h = mk({ '/api/sessions': () => { n++; return page([`p${n}`], n < 2) } })
  h.render(true); await settle(30); h.render(true)
  eq(h.fetchFn.calls.length, 2, `${label}: stops at the first page that has no more`)
  // errors and reload
  let fail = true
  h = mk({ '/api/sessions': () => (fail ? respond(500, {}) : page(['s1'], false)) })
  h.render(true); await settle(); h.render(true)
  eq(h.last().status, 'error', `${label}: a failed read is an error state`)
  eq(h.last().byId && Object.keys(h.last().byId).length, 0, `${label}: ...with no decks`)
  fail = false; h.last().reload(); h.render(true); await settle(); h.render(true)
  eq(h.last().status, 'ready', `${label}: reload reads again`)
  eq(h.fetchFn.calls.length, 2, `${label}: one more read for the reload`)
  h = mk({ '/api/sessions': () => { throw new TypeError('Failed to fetch') } })
  h.render(true); await settle(); h.render(true)
  eq(h.last().status, 'error', `${label}: a network failure is an error state, not a crash`)
  h = mk({ '/api/sessions': respond(200, { nothing: true }) })
  h.render(true); await settle(); h.render(true)
  deepEq({ status: h.last().status, byId: h.last().byId }, { status: 'ready', byId: {} }, `${label}: an unexpected body is an empty list`)
  // unmount aborts
  h = mk({ '/api/sessions': () => new Promise(() => {}) })
  h.render(true); await settle()
  h.world.runtime.unmount()
  ok(true, `${label}: unmount runs its cleanup`)
}

// ---------------------------------------------------------------- 2c. the inspector (SB-08 / SB-10)
const NODE = { node_id: 'n1', name: 'Northwind', entity_type: 'ORG', salience: 1, mention_count: 5 }
const DETAIL = { node: NODE, evidence: [{ snippet: 'Revenue grew', source_type: 'chunk', session_id: 's1', document_filename: 'q3.pdf', page_number: 4 }, { snippet: 'More', source_type: 'web', session_id: 's2', document_filename: null, page_number: null }], provenance_session_ids: ['s1', 's2', 's9'], edges: [{ src_name: 'A', dst_name: 'B', relation: 'REPORTS', weight: 1 }] }
const inspectorWorld = (source, env) => createWorld({ real: new Set([LIB, INSPECTOR]), sources: { [INSPECTOR]: source }, env, stubs: STUBS, globals: { Date, Number } })
const INSPECTOR_PROPS = { selected: DETAIL, selectedId: 'n1', loading: false, error: null, topEntities: TOP.slice(0, 2), onSelect() {}, onRetry() {}, onClear() {} }
const READY = { status: 'ready', byId: { s1: { title: 'State of AI · 2026', slideCount: 30 }, s2: { title: null, slideCount: 1 } }, reload() {} }
function inspectorStates(source, env, decks) {
  const world = inspectorWorld(source, env)
  const { StudioKnowledgeInspector } = world.load(INSPECTOR)
  const out = {}
  const render = props => expand(world.runtime.render(StudioKnowledgeInspector, { ...props, ...(decks ? { decks } : {}) }))
  out.empty = render({ ...INSPECTOR_PROPS, selected: null, selectedId: null })
  out.loading = render({ ...INSPECTOR_PROPS, selected: null, loading: true })
  out.error = render({ ...INSPECTOR_PROPS, selected: null, error: 'boom' })
  let tree = render(INSPECTOR_PROPS)
  out.overview = tree
  const tabs = () => all(tree, i => i.type === 'button' && i.props['aria-pressed'] !== undefined)
  tabs().find(i => /^Evidence/.test(flat(i))).props.onClick(); tree = render(INSPECTOR_PROPS); out.evidence = tree
  tabs().find(i => /^Relations/.test(flat(i))).props.onClick(); tree = render(INSPECTOR_PROPS); out.relations = tree
  return out
}
function proveInspector(source, label = 'inspector') {
  const base = inspectorStates(baseSource(INSPECTOR), { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' })
  for (const [name, env] of [['flag unset', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }], ['flag "false"', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'false' }], ['flag "TRUE"', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'TRUE' }], ['flag on, shell off', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false', [FLAG]: 'true' }], ['flag on, shell unset', { [FLAG]: 'true' }]]) {
    const states = inspectorStates(source, env, READY)  // a deck list handed in must not change a flag-off render
    for (const state of Object.keys(base)) same(ser(states[state]), ser(base[state]), `${label}: ${name} renders the base's "${state}" state`)
  }
  const on = inspectorStates(source, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'true' }, READY)
  for (const state of ['empty', 'loading', 'error']) same(ser(on[state]), ser(base[state]), `${label}: flag on leaves the "${state}" state as the base has it`)
  for (const state of ['overview', 'evidence', 'relations']) {
    ok(all(on[state], i => i.props?.['data-studio-p2-strip'] === 'true').length === 1, `${label}: the strip is in the "${state}" tab too (it sits in the identity block)`)
    eq(all(on[state], i => i.type === 'button' && i.props['aria-pressed'] !== undefined).length, 3, `${label}: the three tabs stay in "${state}"`)
  }
  same(ser(all(on.evidence, i => i.type === 'section')[0]), ser(all(base.evidence, i => i.type === 'section')[0]), `${label}: the evidence list is the base's`)
  same(ser(all(on.relations, i => i.type === 'section')[0]), ser(all(base.relations, i => i.type === 'section')[0]), `${label}: the relations list is the base's`)
  const strip = all(on.overview, i => i.props?.['data-studio-p2-strip'] === 'true')[0]
  ok(strip, `${label}: the strip is there`)
  deepEq(all(strip, i => i.type === 'div' && i !== strip).map(c => flat(c)), ['5 Mentions', '2 Evidence', '3 Sessions'], `${label}: mentions, evidence, sessions with the live numbers`)
  nomatch(flat(on.overview), /contributing sessions\b(?!.*references)|Coverage/i, `${label}: the old text line and Coverage are gone from the identity block`)
  eq(all(on.overview, i => i.type === 'span' && /mentions ·/.test(flat(i))).length, 0, `${label}: the strip replaces the text line`)
  const base2 = base.overview
  ok(all(base2, i => i.type === 'span' && /5 mentions · 3 contributing sessions/.test(flat(i))).length === 1, `${label}: the base has the text line the strip replaces`)
  const decks = all(on.overview, i => i.props?.['data-studio-p2-decks'] === 'true')[0]
  ok(decks, `${label}: "Used in your decks" is there`)
  match(flat(decks), /^Used in your decks/, `${label}: its heading`)
  const links = all(decks, i => i.type === 'Link')
  deepEq(links.map(l => [l.props.href, flat(l)]), [['/builder?session_id=s1', 'State of AI · 2026 30 slides'], ['/builder?session_id=s2', 'Untitled presentation 1 slide']], `${label}: the resolved decks, each a link to its session`)
  match(flat(decks), /1 earlier session is no longer in your deck list\./, `${label}: the unknown session is counted, not shown`)
  const inState = (status, extra = {}, detail = DETAIL) => {
    const world = inspectorWorld(source, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'true' })
    const { StudioKnowledgeInspector } = world.load(INSPECTOR)
    return flat(all(expand(world.runtime.render(StudioKnowledgeInspector, { ...INSPECTOR_PROPS, selected: detail, decks: { status, byId: {}, reload: () => {}, ...extra } })), i => i.props?.['data-studio-p2-decks'] === 'true')[0])
  }
  match(inState('loading'), /Looking up your decks…/, `${label}: loading`)
  match(inState('idle'), /Looking up your decks…/, `${label}: idle reads as loading`)
  match(inState('error'), /Your deck list could not be loaded\. Retry/, `${label}: an error with Retry`)
  match(inState('ready'), /No deck is recorded for this entity yet\./, `${label}: nothing resolved`)
  match(inState('ready', {}, { ...DETAIL, provenance_session_ids: [] }), /No deck is recorded for this entity yet\./, `${label}: no sessions`)
  nomatch(inState('loading', {}, { ...DETAIL, provenance_session_ids: [] }), /Looking up/, `${label}: no sessions means nothing to look up`)
  let reloaded = 0
  const world = inspectorWorld(source, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'true' })
  const tree = expand(world.runtime.render(world.load(INSPECTOR).StudioKnowledgeInspector, { ...INSPECTOR_PROPS, decks: { status: 'error', byId: {}, reload: () => reloaded++ } }))
  all(tree, i => i.type === 'button' && flat(i) === 'Retry')[0].props.onClick()
  eq(reloaded, 1, `${label}: Retry reloads the deck list`)
  eq(all(expand(world.runtime.render(world.load(INSPECTOR).StudioKnowledgeInspector, INSPECTOR_PROPS)), i => i.props?.['data-studio-p2-decks']).length, 0, `${label}: flag on without a deck list: no section`)
  eq(all(on.overview, i => i.type === 'details').length, 1, `${label}: the contributing session references stay`)
}

// ---------------------------------------------------------------- 2d. the graph view (SB-05 / SB-06)
const G_NODES = [
  { node_id: 'a', name: 'Northwind', entity_type: 'ORG', salience: 4, mention_count: 7 },
  { node_id: 'b', name: 'Revenue', entity_type: 'METRIC', salience: 2, mention_count: 150 },
  { node_id: 'c', name: 'Ada', entity_type: 'PERSON', salience: 1, mention_count: 0 },
]
const G_EDGES = [{ src_node_id: 'a', dst_node_id: 'b', relation: 'REPORTS', weight: 1 }]
const graphWorld = (source, env, doc, extraReal = []) => createWorld({ real: new Set([LIB, GRAPH, ...extraReal]), sources: { [GRAPH]: source }, env, globals: { document: doc ?? fakeDocument(), Promise, Set, Map, Math, Number, Array, Object, JSON, String, Infinity, NaN, ResizeObserver: class { observe() {} disconnect() {} } } })
function graphView(source, env, props = {}, doc, extraReal = []) {
  const world = graphWorld(source, env, doc, extraReal)
  const { KgGraphView } = world.load(GRAPH)
  const render = () => world.runtime.render(KgGraphView, { nodes: G_NODES, edges: G_EDGES, selectedId: null, ...props })
  return { world, render }
}
async function proveGraph(source, label = 'graph') {
  const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
  const base = graphView(baseSource(GRAPH), SHELL).render()
  for (const [name, env] of [['flag unset', SHELL], ['flag "false"', { ...SHELL, [FLAG]: 'false' }], ['flag "TRUE"', { ...SHELL, [FLAG]: 'TRUE' }], ['flag "1"', { ...SHELL, [FLAG]: '1' }], ['flag on, shell off', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false', [FLAG]: 'true' }], ['flag on, shell unset', { [FLAG]: 'true' }]]) {
    const shellOff = env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'true'
    const expected = shellOff ? graphView(baseSource(GRAPH), { NEXT_PUBLIC_STUDIO_V4_SHELL: env.NEXT_PUBLIC_STUDIO_V4_SHELL }).render() : base
    same(ser(graphView(source, env).render()), ser(expected), `${label}: ${name} renders the base's map`)
    same(ser(graphView(source, env, { selectedId: 'a' }).render()), ser(shellOff ? graphView(baseSource(GRAPH), { NEXT_PUBLIC_STUDIO_V4_SHELL: env.NEXT_PUBLIC_STUDIO_V4_SHELL }, { selectedId: 'a' }).render() : graphView(baseSource(GRAPH), SHELL, { selectedId: 'a' }).render()), `${label}: ${name} renders the base's selected map`)
  }
  const ON = { ...SHELL, [FLAG]: 'true' }
  const { render, world } = graphView(source, ON, { selectedId: 'a' })
  let tree = render()
  const root = all(tree, i => i.props?.['data-studio-graph-view'] === 'true')[0]
  eq(root.props['data-studio-p2-map'], 'true', `${label}: the root carries the marker only flag on`)
  eq(all(base, i => i.props?.['data-studio-p2-map']).length, 0, `${label}: the base has no marker`)
  const halos = all(tree, i => i.props?.['data-studio-p2-halo'] === 'true')
  eq(halos.length, 3, `${label}: one soft glow per node`)
  const gradients = all(tree, i => i.type === 'radialGradient').map(g => g.props.id).filter(id => id.startsWith('kg-p2-halo-'))
  deepEq(gradients, ['kg-p2-halo-0', 'kg-p2-halo-1', 'kg-p2-halo-2'], `${label}: one gradient per entity type, ids by position`)
  ok(halos.every(h => gradients.some(id => h.props.fill === `url(#${id})`)), `${label}: every glow fills with a defined gradient`)
  ok(halos.every(h => String(h.props.className).includes('pointer-events-none')), `${label}: the glow never takes a click`)
  const radii = all(tree, i => i.props?.['data-kg-node']).map(g => all(g, c => c.type === 'circle' && c.props.stroke)[0].props.r)
  deepEq(halos.map(h => Math.round(h.props.r * 100)), radii.map(r => Math.round(r * 2.3 * 100)), `${label}: each glow is 2.3 radii of its node`)
  const badges = all(tree, i => i.props?.['data-studio-p2-badge'] === 'true')
  deepEq(badges.map(b => flat(b)), ['7', '99+'], `${label}: the count badges (a node with no mentions has none)`)
  ok(badges.every(b => b.props.fill === '#0B1220' && String(b.props.className).includes('pointer-events-none')), `${label}: dark ink, never a click target`)
  const plates = all(tree, i => i.props?.['data-studio-graph-label'] === 'entity')
  ok(plates.length >= 1, `${label}: label plates are drawn`)
  ok(plates.every(p => { const rect = all(p, i => i.type === 'rect')[0], t = all(p, i => i.type === 'text')[0]; return typeof rect.props.style?.stroke === 'string' && rect.props.style.stroke.startsWith('#') && rect.props.style.strokeWidth === 1 && t.props.fontWeight === 600 && t.props.fill === '#F8FAFC' }), `${label}: plates take the type colour outline, semi-bold near-white text`)
  const basePlates = all(base, i => i.props?.['data-studio-graph-label'] === 'entity')
  ok(basePlates.every(p => all(p, i => i.type === 'rect')[0].props.style === undefined && all(p, i => i.type === 'text')[0].props.fontWeight === 500), `${label}: the base plates are as they were`)
  // SB-06
  const toolbar = () => all(tree, i => i.props?.['data-studio-graph-toolbar'])[0]
  const fsButton = () => all(toolbar(), i => i.props?.['data-studio-p2-fullscreen'] === 'true')[0]
  ok(fsButton(), `${label}: the Full screen button is in the toolbar (the browser allows it)`)
  eq(fsButton().props['aria-label'], 'Full screen', `${label}: named Full screen`)
  eq(fsButton().props['aria-pressed'], false, `${label}: not pressed`)
  const buttons = all(toolbar(), i => i.type === 'button').map(b => b.props['aria-label'])
  ok(buttons.indexOf('Reset graph view') < buttons.indexOf('Full screen'), `${label}: Full screen follows Reset, as in the mockup`)
  for (const kept of ['Show entity list', 'Zoom in', 'Zoom out', 'Fit graph to view', 'Focus selected entity', 'Reset graph view']) ok(buttons.includes(kept), `${label}: ${kept} stays`)
  nomatch(buttons.join('|'), /orbit|pause/i, `${label}: no orbit control`)
  let requested = 0
  const rootNode = { requestFullscreen() { requested++; return Promise.reject(new Error('refused')) } }
  root.props.ref.current = rootNode
  fsButton().props.onClick(); await settle()
  eq(requested, 1, `${label}: the click asks the browser to put the map full screen`)
  eq(fsButton().props['aria-label'], 'Full screen', `${label}: a refused request changes nothing`)
  return { render }
}
async function proveGraphFullscreen(source, label = 'graph') {
  const doc = fakeDocument()
  const { render, world } = graphView(source, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'true' }, {}, doc)
  let tree = render()
  const root = () => all(tree, i => i.props?.['data-studio-graph-view'] === 'true')[0]
  const rootNode = { requestFullscreen() { doc.fullscreenElement = rootNode; return Promise.resolve() } }
  root().props.ref.current = rootNode
  const fs = () => all(tree, i => i.props?.['data-studio-p2-fullscreen'] === 'true')[0]
  fs().props.onClick(); await settle()
  doc.fire('fullscreenchange'); tree = render()
  eq(fs().props['aria-label'], 'Exit full screen', `${label}: in full screen the button says how to leave`)
  eq(fs().props['aria-pressed'], true, `${label}: ...and is pressed`)
  fs().props.onClick(); eq(doc.exited, 1, `${label}: it leaves through the browser's own exit`)
  doc.fullscreenElement = null; doc.fire('fullscreenchange'); tree = render()
  eq(fs().props['aria-label'], 'Full screen', `${label}: Esc (the browser's own exit) puts the button back`)
  doc.fullscreenElement = {}; doc.fire('fullscreenchange'); tree = render()
  eq(fs().props['aria-label'], 'Full screen', `${label}: another element in full screen is not this map`)
  eq((doc.listeners.get('fullscreenchange') ?? []).length, 1, `${label}: one listener while mounted`)
  world.runtime.unmount()
  eq((doc.listeners.get('fullscreenchange') ?? []).length, 0, `${label}: none after unmount`)
  // not allowed by the browser: no button
  const denied = graphView(source, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'true' }, {}, fakeDocument({ fullscreenEnabled: false }))
  eq(all(denied.render(), i => i.props?.['data-studio-p2-fullscreen']).length, 0, `${label}: where the browser forbids full screen there is no button`)
  const flagOff = graphView(source, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, {}, doc)
  eq(all(flagOff.render(), i => i.props?.['data-studio-p2-fullscreen']).length, 0, `${label}: flag off: no button even where the browser allows it`)
  eq((fakeDocument().listeners.get('fullscreenchange') ?? []).length, 0, `${label}: (sanity) a fresh document has no listeners`)
  const offDoc = fakeDocument()
  const off2 = graphView(source, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, {}, offDoc); off2.render()
  eq((offDoc.listeners.get('fullscreenchange') ?? []).length, 0, `${label}: flag off adds no listener`)
  // With the J6 map toolbar on as well (NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR, a separate component) the Full screen button reaches it as `extra`; with only that flag on, the toolbar gets none.
  const TOOLBAR_LIB = 'lib/studio-knowledge-map-toolbar.ts'
  const J6 = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR: 'true' }
  const j6Toolbar = tree => all(tree, i => i.type === 'StudioKnowledgeMapToolbar')[0]
  const both = graphView(source, { ...J6, [FLAG]: 'true' }, {}, doc, [TOOLBAR_LIB]).render()
  ok(j6Toolbar(both), `${label}: both flags: the J6 toolbar is drawn`)
  eq(j6Toolbar(both).props.extra?.props?.['data-studio-p2-fullscreen'], 'true', `${label}: both flags: Full screen is the J6 toolbar's extra control`)
  eq(all(both, i => i.props?.['data-studio-p2-fullscreen']).length, 0, `${label}: both flags: not drawn a second time outside the J6 toolbar`)
  const only = graphView(source, J6, {}, doc, [TOOLBAR_LIB]).render()
  ok(j6Toolbar(only) && !('extra' in j6Toolbar(only).props), `${label}: J6 toolbar alone: no extra prop`)
  same(ser(only), ser(graphView(baseSource(GRAPH), J6, {}, doc, [TOOLBAR_LIB]).render()), `${label}: J6 toolbar alone: the base's map`)
  const bothDenied = graphView(source, { ...J6, [FLAG]: 'true' }, {}, fakeDocument({ fullscreenEnabled: false }), [TOOLBAR_LIB]).render()
  ok(!('extra' in j6Toolbar(bothDenied).props), `${label}: both flags, browser forbids full screen: no extra prop`)
}

// ---------------------------------------------------------------- 3. the page wiring
const STATS = { node_count: 9, edge_count: 9, evidence_count: 11, sessions_consolidated: 1, last_updated_at: '2026-10-01T12:00:00Z', nodes_by_type: [{ entity_type: 'ORG', count: 3 }], top_entities: TOP.slice(0, 3) }
const GRAPH_DATA = { nodes: [{ node_id: 'n1', name: 'Northwind', entity_type: 'ORG', salience: 1, mention_count: 2 }, { node_id: 'n2', name: 'Revenue', entity_type: 'METRIC', salience: 1, mention_count: 1 }], edges: [{ src_node_id: 'n1', dst_node_id: 'n2', relation: 'REPORTS', weight: 1 }], total_nodes: 9 }
const ACCESS = { accountKey: 'user:fixture', userId: 'fixture', isAuthenticated: true, isLoading: false, isEntitled: true, isSubscribed: true, serviceAvailable: true, error: null, settings: { subscribed: true }, capability: {}, refetch: async () => {} }
function pageWorld(source, env) {
  const fetchFn = createFetch({ '/api/knowledge-graph/stats': respond(200, STATS), '/api/knowledge-graph/graph': respond(200, GRAPH_DATA), '/api/knowledge-graph/nodes/': respond(200, DETAIL), '/api/sessions': respond(200, { sessions: [], pagination: { hasMore: false } }) })
  const world = createWorld({
    real: new Set([PAGE]), sources: { [PAGE]: source }, env,
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
  return { loaded, selected, calls: fetchFn.calls }
}
async function provePage(source, label = 'page') {
  const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
  const base = await pageStates(baseSource(PAGE), SHELL)
  const baseClassic = await pageStates(baseSource(PAGE), { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false' })
  for (const [name, env, expected] of [
    ['flag unset', SHELL, base], ['flag "false"', { ...SHELL, [FLAG]: 'false' }, base], ['flag "TRUE"', { ...SHELL, [FLAG]: 'TRUE' }, base], ['flag "1"', { ...SHELL, [FLAG]: '1' }, base],
    ['flag on, shell off', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'false', [FLAG]: 'true' }, baseClassic], ['flag on, shell unset', { [FLAG]: 'true' }, baseClassic],
  ]) {
    const got = await pageStates(source, env)
    same(ser(got.loaded), ser(expected.loaded), `${label}: ${name}: the loaded page is the base's`)
    same(ser(got.selected), ser(expected.selected), `${label}: ${name}: the selected page is the base's`)
    deepEq(got.calls, expected.calls, `${label}: ${name}: the same requests as the base`)
    eq(got.calls.some(c => c.url.startsWith('/api/sessions')), false, `${label}: ${name}: no deck-list read`)
    eq(all(got.selected, i => i.type === 'StudioP2Sources' || i.type === 'StudioP2DeckProvider').length, 0, `${label}: ${name}: no P2 element`)
  }
  const on = await pageStates(source, { ...SHELL, [FLAG]: 'true' })
  const sources = all(on.loaded, i => i.type === 'StudioP2Sources')
  eq(sources.length, 1, `${label}: flag on: one Sources button`)
  deepEq(sources[0].props.entities, STATS.top_entities, `${label}: ...fed the graph's own most reinforced entities`)
  const actions = all(on.loaded, i => i.props?.['data-studio-knowledge-role'] === 'actions')[0]
  eq([].concat(actions.props.children).filter(c => c && typeof c === 'object')[0].type, 'StudioP2Sources', `${label}: ...first in the header actions, before Refresh`)
  ok(all(actions, i => i.type === 'Button').length >= 2, `${label}: Refresh and Import stay`)
  const provider = (tree) => all(tree, i => i.type === 'StudioP2DeckProvider')[0]
  eq(provider(on.loaded).props.enabled, false, `${label}: flag on: the deck list is not wanted before an entity is selected`)
  eq(provider(on.selected).props.enabled, true, `${label}: ...and is after the first selection`)
  const child = provider(on.selected).props.children
  eq(typeof child, 'function', `${label}: the provider's child is a render function`)
  const rendered = child({ status: 'ready', byId: {}, reload() {} })
  eq(rendered.type.name, 'Inspector', `${label}: ...which renders the page's inspector`)
  ok('decks' in rendered.props && rendered.props.decks.status === 'ready', `${label}: ...with the deck list`)
  eq(provider(on.selected).props.children.name, 'renderInspector', `${label}: (the render function is the page's)`)
  const inner = expand(rendered)
  eq(inner.type, 'StudioKnowledgeInspector', `${label}: the page's inspector hands the studio inspector...`)
  ok(inner.props.decks && inner.props.decks.status === 'ready', `${label}: ...the deck list`)
  eq('decks' in expand(child()).props, false, `${label}: ...and no decks prop without one`)
  const plainEl = child()
  ok(plainEl && !('decks' in plainEl.props), `${label}: the same inspector without a deck list has no decks prop`)
  eq(on.calls.filter(c => c.url.startsWith('/api/sessions')).length, 0, `${label}: the page itself makes no deck-list read (the provider's hook does, once selected)`)
  const baseInspector = all(base.selected, i => i.type === 'StudioKnowledgeInspector' || (typeof i.type === 'function' && i.type.name === 'Inspector'))
  ok(baseInspector.length >= 0, `${label}: (the base has its inspector)`)
  match(source, /const P2_SB = process\.env\.NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN === "true" && STUDIO_SHELL/, `${label}: the page's rule is the helper's (exact "true" AND the shell)`)
}

// ---------------------------------------------------------------- 4. the CSS
function proveCss(source, label = 'css') {
  const root = postcss.parse(source)
  const MARKERS = ['[data-studio-p2-sources="true"]', '[data-studio-p2-strip="true"]', '[data-studio-p2-decks="true"]', '[data-studio-p2-map="true"]']
  let rules = 0
  root.walkRules(rule => {
    rules++
    for (const selector of rule.selectors) ok(MARKERS.some(m => selector.includes(m)), `${label}: "${selector.slice(0, 90)}" hangs on a P2 marker`)
    for (const selector of rule.selectors) ok(/^\[data-studio-(v4-shell|knowledge-inspector|graph-view)="true"\]/.test(selector), `${label}: "${selector.slice(0, 60)}" is anchored to the shell, the inspector or the graph view`)
  })
  ok(rules >= 30, `${label}: the rules are there`)
  nomatch(source, /!important/, `${label}: no !important`)
  nomatch(source.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b/, `${label}: no hex colours: tokens only`)
  root.walkDecls(decl => { if (/color|background|border|box-shadow|outline/.test(decl.prop) && /\b(?:rgb|hsl)a?\(/.test(decl.value)) ok(decl.prop === 'box-shadow', `${label}: only the popover shadow uses a raw colour (${decl.prop})`) })
  const shell = fs.readFileSync(path.join(repoRoot, 'components/layout/studio-shell.css'), 'utf8')
  const tokens = new Set([...source.matchAll(/var\((--ss-[a-z-]+)\)/g)].map(m => m[1]))
  ok(tokens.size >= 6, `${label}: it uses the shell's tokens`)
  for (const token of tokens) {
    const light = new RegExp(`\\[data-studio-v4-shell="true"\\] \\{[^}]*${token}:`).test(shell), dark = new RegExp(`\\.dark \\[data-studio-v4-shell="true"\\] \\{[^}]*${token}:`).test(shell)
    ok(light && dark, `${label}: ${token} exists in light and dark in studio-shell.css`)
  }
  ok(/\[data-studio-p2-map="true"\]:fullscreen \{[^}]*height: 100vh/.test(source), `${label}: the map fills the screen in full screen`)
  ok(/:-webkit-full-screen/.test(source), `${label}: ...also in the prefixed form`)
}

// ---------------------------------------------------------------- 5. the env example
function proveEnv(source, label = 'env') {
  const lines = source.split('\n')
  const at = lines.findIndex(line => line.trim() === `${FLAG}="false"`)
  ok(at > 0, `${label}: ${FLAG}="false" is documented`)
  eq(lines.filter(line => line.startsWith(`${FLAG}=`)).length, 1, `${label}: exactly once`)
  const block = []
  for (let i = at - 1; i >= 0 && lines[i].startsWith('#'); i--) block.unshift(lines[i])
  const body = block.join(' ')
  match(body, /SB-02/, `${label}: names the rows`)
  match(body, /SB-05/, `${label}: SB-05`)
  match(body, /SB-06/, `${label}: SB-06`)
  match(body, /SB-08/, `${label}: SB-08`)
  match(body, /SB-10/, `${label}: SB-10`)
  match(body, /exact "true"/i, `${label}: says exact "true"`)
  match(body, /NEXT_PUBLIC_STUDIO_V4_SHELL/, `${label}: says it needs the Studio shell`)
  match(body, /BUILD TIME/, `${label}: says it is read at build time`)
  match(body, /Not built: SB-01 \(deck nodes in the graph\) and SB-12 \(Ask Knowledge\) are backlog by ruling/, `${label}: says what is not built (SB-01, SB-12)`)
  match(body, /DET-12/, `${label}: says who owns the "+ Presentation" button`)
}

// ---------------------------------------------------------------- run
async function proveAll(replaced = {}, only = null) {
  overrides = replaced
  const s = file => replaced[file] ?? SOURCES[file]
  const run = (name, fn) => { if (!only || only === name) return fn() }
  let lib
  await run('lib', async () => { lib = proveLib(s(LIB)) })
  await run('sources', () => proveSourcesUi(s(SOURCES_UI)))
  await run('decks', () => proveDeckHook(s(HOOK), s(PROVIDER)))
  await run('inspector', () => proveInspector(s(INSPECTOR)))
  await run('graph', async () => { await proveGraph(s(GRAPH)); await proveGraphFullscreen(s(GRAPH)) })
  await run('page', () => provePage(s(PAGE)))
  await run('css', () => proveCss(s(CSS)))
  await run('env', () => proveEnv(s(ENV)))
  return lib
}

const t0 = Date.now()
await proveAll()
const realChecks = checks
const realMs = Date.now() - t0
counting = false

// ---------------------------------------------------------------- 6. mutation check: [file, name, from, to]; every one must be killed by an assertion (not a crash)
const MUTANTS = [
  // the helper
  [LIB, 'flag: either one is enough', "flag === 'true' && shell === 'true'", "flag === 'true' || shell === 'true'"],
  [LIB, 'flag: any value is on', "return flag === 'true' && shell === 'true'", "return Boolean(flag) && shell === 'true'"],
  [LIB, 'upload goes to the last session', "'/builder?session_id=new'", "'/builder'"],
  [LIB, 'deck link not encoded', 'encodeURIComponent(sessionId)', 'sessionId'],
  [LIB, 'sessions page size', 'STUDIO_SB_SESSION_PAGE = 100', 'STUDIO_SB_SESSION_PAGE = 50'],
  [LIB, 'sessions page cap', 'STUDIO_SB_SESSION_MAX_PAGES = 5', 'STUDIO_SB_SESSION_MAX_PAGES = 50'],
  [LIB, 'source entity cap', 'STUDIO_SB_MAX_SOURCE_ENTITIES = 8', 'STUDIO_SB_MAX_SOURCE_ENTITIES = 80'],
  [LIB, 'strip says Coverage', "label: 'Evidence'", "label: 'Coverage'"],
  [LIB, 'strip accepts strings', 'value: count(mentions) },', 'value: Number(mentions) },'],
  [LIB, 'filename not trimmed', 'item.document_filename.trim()', 'item.document_filename'],
  [LIB, 'sources sorted fewest first', 'b.passages - a.passages ||', 'a.passages - b.passages ||'],
  [LIB, 'entities counted wrongly', 'row.entities.add(entityIndex)', 'row.entities.add(row.passages)'],
  [LIB, 'a deck listed twice', "if (typeof id !== 'string' || !id || seen.has(id)) continue", "if (typeof id !== 'string' || !id) continue"],
  [LIB, 'prototype ids resolve', 'Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : null', 'byId[id] ?? null'],
  [LIB, 'untitled deck is blank', 'known.title ?? STUDIO_SB_WORDS.untitledDeck', "known.title ?? ''"],
  [LIB, 'unknown sessions not counted', 'missing += 1; continue', 'continue'],
  [LIB, 'badge cap', "value > 99 ? '99+'", "value > 999 ? '99+'"],
  [LIB, 'badge min size', 'Math.max(8,', 'Math.max(6,'],
  [LIB, 'badge for zero', 'if (value < 1 ||', 'if (value < 0 ||'],
  [LIB, 'halo reach', 'STUDIO_NODE_HALO = 2.3', 'STUDIO_NODE_HALO = 3'],
  [LIB, 'halo id of an unknown type', 'index < 0 ? 0 : index', 'index'],
  [LIB, 'full screen offered where forbidden', 'doc?.fullscreenEnabled === true', 'doc?.fullscreenEnabled !== false'],
  [LIB, 'any full screen element is the map', 'doc?.fullscreenElement === element', 'doc?.fullscreenElement != null'],
  [LIB, 'full screen label swapped', 'active ? STUDIO_SB_WORDS.exitFullScreen : STUDIO_SB_WORDS.fullScreen', 'active ? STUDIO_SB_WORDS.fullScreen : STUDIO_SB_WORDS.exitFullScreen'],
  [LIB, 'sessions offset ignores the page', 'offset=${index * STUDIO_SB_SESSION_PAGE}', 'offset=${index}'],
  [LIB, 'one slide reads slides', "slideCount === 1 ? 'slide' : 'slides'", "slideCount === 1 ? 'slides' : 'slides'"],
  [LIB, 'upload hint loses its promise', ' Nothing is added from this page.', ''],
  // the Sources popover
  [SOURCES_UI, 'reads again on every open', 'if (!open || startedRef.current === attempt) return', 'if (!open) return'],
  [SOURCES_UI, 'reads every top entity', 'entities.slice(0, STUDIO_SB_MAX_SOURCE_ENTITIES)', 'entities'],
  [SOURCES_UI, 'Escape does not close', 'event.key === "Escape"', 'event.key === "Enter"'],
  [SOURCES_UI, 'a press inside closes', '!rootRef.current.contains(event.target as Node)', 'rootRef.current.contains(event.target as Node)'],
  [SOURCES_UI, 'focus not returned', 'if (returnFocus) buttonRef.current?.focus()', 'if (!returnFocus) buttonRef.current?.focus()'],
  [SOURCES_UI, 'keydown listener leaks', 'document.removeEventListener("keydown", onKey)', ''],
  [SOURCES_UI, 'count shown after a partial read', 'phase === "ready" && failed === 0', 'phase === "ready"'],
  [SOURCES_UI, 'upload link goes elsewhere', 'href={STUDIO_SB_UPLOAD_HREF}', 'href="/builder"'],
  [SOURCES_UI, 'reads with POST', 'fetch(`/api/knowledge-graph/nodes/${encodeURIComponent(id)}`, { signal: controller.signal })', 'fetch(`/api/knowledge-graph/nodes/${encodeURIComponent(id)}`, { method: "POST", signal: controller.signal })'],
  [SOURCES_UI, 'aria-expanded inverted', 'aria-expanded={open}', 'aria-expanded={!open}'],
  [SOURCES_UI, 'aria-controls dropped', 'aria-controls={open ? panelId : undefined}', 'aria-controls={undefined}'],
  [SOURCES_UI, 'no partial note', '{phase === "ready" && failed > 0 && (', '{false && ('],
  [SOURCES_UI, 'no empty state', 'sources.length === 0 &&', 'sources.length === 99 &&'],
  [SOURCES_UI, 'a Connections entry appears', '<footer>', '<footer><span>Connections</span>'],
  // the deck list hook + provider
  [HOOK, 'reads again when turned off and on', 'if (!enabled || startedRef.current === attempt) return', 'if (!enabled) return'],
  [HOOK, 'reads while disabled', 'if (!enabled || startedRef.current === attempt) return', 'if (startedRef.current === attempt) return'],
  [HOOK, 'page cap lifted', 'page < STUDIO_SB_SESSION_MAX_PAGES', 'page < 50'],
  [HOOK, 'never stops paging', 'if (!body?.pagination?.hasMore) break', ''],
  [HOOK, 'a failure reads as ready', 'setState({ status: "error", byId: {} })', 'setState({ status: "ready", byId: {} })'],
  [HOOK, 'a bad status is accepted', 'if (!response.ok) throw new Error("Deck list unavailable")', ''],
  [PROVIDER, 'the provider drops its child', 'return <>{children(decks)}</>', 'return <></>'],
  // the inspector
  [INSPECTOR, 'strip swaps evidence and sessions', 'selected.evidence.length, selected.provenance_session_ids.length).map', 'selected.provenance_session_ids.length, selected.evidence.length).map'],
  [INSPECTOR, 'flag ignored', 'studioP2SecondBrainOn(process.env.NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)', 'process.env.NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN !== "false"'],
  [INSPECTOR, 'decks without the flag', '{STUDIO_P2_SB && decks && <UsedInDecks', '{decks && <UsedInDecks'],
  [INSPECTOR, 'strip inverted', '{STUDIO_P2_SB ? <div data-studio-p2-strip', '{!STUDIO_P2_SB ? <div data-studio-p2-strip'],
  [INSPECTOR, 'no sessions resolved', 'studioResolveDecks(sessionIds, decks.byId)', 'studioResolveDecks([], decks.byId)'],
  [INSPECTOR, 'missing sessions not said', '{missingText && <p>{missingText}</p>}', ''],
  [INSPECTOR, 'Retry does nothing', 'onClick={decks.reload}', 'onClick={() => undefined}'],
  [INSPECTOR, 'deck link goes elsewhere', '<Link href={deck.href}>', '<Link href="/builder">'],
  [INSPECTOR, 'idle is not loading', '(decks.status === "idle" || decks.status === "loading")', '(decks.status === "loading")'],
  [INSPECTOR, 'no sessions not said', '{sessionIds.length === 0 && <p>{STUDIO_SB_WORDS.decksNone}</p>}', ''],
  // the graph view
  [GRAPH, 'flag ignored', 'studioP2SecondBrainOn(process.env.NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)', 'true'],
  [GRAPH, 'glow as small as the node', 'r={point.r * STUDIO_NODE_HALO}', 'r={point.r}'],
  [GRAPH, 'glow takes clicks', 'fill={`url(#${studioHaloId(entityTypes, point.entity_type)})`} className="pointer-events-none"', 'fill={`url(#${studioHaloId(entityTypes, point.entity_type)})`}'],
  [GRAPH, 'badge in white', 'fill="#0B1220"', 'fill="#FFFFFF"'],
  [GRAPH, 'badge counts salience', 'studioNodeBadge(point.mention_count, point.r)', 'studioNodeBadge(point.salience, point.r)'],
  [GRAPH, 'plates without the outline', 'style={STUDIO_P2_MAP ? { stroke: typeColor(point.entity_type), strokeWidth: 1, strokeOpacity: .75 } : undefined}', 'style={undefined}'],
  [GRAPH, 'plate text not semi-bold', 'fontWeight={STUDIO_P2_MAP ? 600 : 500}', 'fontWeight={500}'],
  [GRAPH, 'button before support is known', 'STUDIO_P2_MAP && canFullscreen && <button', 'STUDIO_P2_MAP && <button'],
  [GRAPH, 'J6 toolbar loses Full screen', '{...(p2FullscreenButton ? { extra: p2FullscreenButton } : {})}', ''],
  [GRAPH, 'J6 toolbar extra even when forbidden', '{...(p2FullscreenButton ? { extra: p2FullscreenButton } : {})}', '{...{ extra: p2FullscreenButton }}'],
  [GRAPH, 'legacy toolbar loses Full screen', '          {p2FullscreenButton}\n', ''],
  [GRAPH, 'support assumed', 'setCanFullscreen(studioFullscreenSupported(document))', 'setCanFullscreen(true)'],
  [GRAPH, 'full screen listener leaks', 'document.removeEventListener("fullscreenchange", sync)', ''],
  [GRAPH, 'cannot leave full screen', 'void Promise.resolve(document.exitFullscreen?.()).catch(() => undefined)', 'void 0'],
  [GRAPH, 'cannot enter full screen', 'else void Promise.resolve(root.requestFullscreen?.()).catch(() => undefined)', 'else void 0'],
  [GRAPH, 'pressed state inverted', 'onClick={toggleFullscreen} aria-pressed={fullscreen}', 'onClick={toggleFullscreen} aria-pressed={!fullscreen}'],
  [GRAPH, 'marker always on', "data-studio-p2-map={STUDIO_P2_MAP ? 'true' : undefined}", 'data-studio-p2-map="true"'],
  [GRAPH, 'state ignores the browser', 'setFullscreen(studioFullscreenActive(document, rootRef.current))', 'setFullscreen(true)'],
  [GRAPH, 'one gradient for every type', 'id={studioHaloId(entityTypes, type)}', 'id="kg-p2-halo-0"'],
  // the page
  [PAGE, 'flag without the shell', 'process.env.NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN === "true" && STUDIO_SHELL', 'process.env.NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN === "true"'],
  [PAGE, 'Sources without the flag', '{P2_SB && <StudioP2Sources entities={stats?.top_entities ?? []} />}', '{<StudioP2Sources entities={stats?.top_entities ?? []} />}'],
  [PAGE, 'Sources fed the map nodes', 'entities={stats?.top_entities ?? []}', 'entities={graph?.nodes ?? []}'],
  [PAGE, 'deck list wanted at once', 'enabled={selectedId !== null}', 'enabled={true}'],
  [PAGE, 'provider without the flag', 'P2_SB ? <StudioP2DeckProvider', 'true ? <StudioP2DeckProvider'],
  [PAGE, 'decks prop always present', '      {...(decks ? { decks } : {})}\n    />\n  )\n  const summaryCards', '      decks={decks}\n    />\n  )\n  const summaryCards'],
  [PAGE, 'studio inspector loses the decks', 'onClear={onClear} emptyGraph={emptyGraph} {...(decks ? { decks } : {})} />', 'onClear={onClear} emptyGraph={emptyGraph} />'],
  // the CSS
  [CSS, 'a rule loses its anchor', '[data-studio-v4-shell="true"] [data-studio-p2-sources="true"] { position: relative; display: inline-flex; }', '[data-studio-p2-sources="true"] { position: relative; display: inline-flex; }'],
  [CSS, 'a rule without a marker', '[data-studio-graph-view="true"][data-studio-p2-map="true"]:fullscreen > svg[role="group"] { height: auto; min-height: 0; }', '[data-studio-graph-view="true"][data-studio-p2-map="true"]:fullscreen > svg[role="group"] { height: auto; min-height: 0; }\n[data-studio-graph-view="true"] svg { height: 1px; }'],
  [CSS, 'an important', 'height: auto; border: 0;', 'height: auto !important; border: 0;'],
  [CSS, 'a hex colour', 'border-radius: 12px; background: var(--ss-panel);', 'border-radius: 12px; background: #ffffff;'],
  [CSS, 'a token that does not exist', 'background: var(--ss-soft);', 'background: var(--ss-nope);'],
  [CSS, 'full screen is half the screen', ':fullscreen { width: 100vw; height: 100vh;', ':fullscreen { width: 100vw; height: 50vh;'],
  // the env example
  [ENV, 'flag documented on', 'NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN="false"', 'NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN="true"'],
  [ENV, 'shell not mentioned', 'Needs the Studio shell\n# (NEXT_PUBLIC_STUDIO_V4_SHELL "true")', 'Needs the Studio shell\n# (the shell)'],
  [ENV, 'build time not mentioned', 'untouched. READ AT BUILD TIME', 'untouched. read later'],
  [ENV, 'backlog rows not mentioned', 'Not built: SB-01', 'Not built: none'],
]
const ONLY = { [SOURCES_UI]: 'sources', [HOOK]: 'decks', [PROVIDER]: 'decks', [INSPECTOR]: 'inspector', [GRAPH]: 'graph', [PAGE]: 'page', [CSS]: 'css', [ENV]: 'env' }
let killed = 0
const survivors = []
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
console.log(`Studio P2 Second Brain (SB-02/05/06/08/10): ${realChecks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
