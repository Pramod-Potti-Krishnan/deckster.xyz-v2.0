// FRONTEND-2 Pass 3 "model catalog on the Intelligence page" (flag NEXT_PUBLIC_STUDIO_MODEL_CATALOG, default off). Offline: no DOM, no network, no sign-in, no model call.
//
// What is proven, on the REAL sources (the TypeScript is transpiled and run in a vm; the page, workspace and chooser are the real files rendered with react-dom/server):
//   1. lib/studio-model-catalog.ts: the query the route may forward (only include_available, limit, offset, validated as Director validates), how each Director answer becomes a Studio answer, how a Studio
//      answer becomes a state (ready / empty / not available yet / unavailable / error), the rows (certified only, vendor, capabilities, context window, premium, speed class unless "unverified", Suggested,
//      the slug when a model is not on the current page, no price anywhere), the paging merge, and the client cache (ttl_seconds, 300 s when absent, capped, errors never kept, one request in flight);
//   2. app/api/models/catalogue/route.ts: 404 with the flag off BEFORE any session read or backend call, 401 without a session, the forwarded URL and headers, and every recorded Director fixture
//      replayed through it (200 default, 200 include_available page one and two, 400, 502, 503 not configured, 503 unreachable);
//   3. components/studio-personal/intelligence-models.tsx: each state's markup, the container's wiring (what is fetched, in what order, what a toggle / "Show more" / "Try again" does, a late answer
//      dropped), and that the browser only ever calls the Studio route;
//   4. flag-off identity: app/(app)/studio/intelligence/layout.tsx returns the page as it is. The REAL page (workspace and chooser included) rendered through it with the flag off, unset or malformed has
//      the same SHA-256 as the page rendered alone, for every Studio shell / chooser / catalog flag combination; page.tsx, the workspace and the chooser are byte-identical to the base commit;
//   5. the stylesheet only styles the new markup, .env.example and package.json only gain this change's lines, and mutants of all of the above are caught.
//
// Fixtures: scripts/fixtures/studio-model-catalog/ are the recorded bodies of Director's GET /api/v1/models/catalogue from streams/director2/model-catalogue/ (DIRECTOR-2, recorded from the router's real app);
// their SHA-256s are pinned below. MODEL_CATALOG_FIXTURE_SOURCE=<that folder> also checks them byte for byte against the originals.
// Run: node scripts/test-studio-model-catalog.mjs
//   MODEL_CATALOG_ROOT=<checkout> runs the checks against another checkout (the base commit exports, to see this test fail there);
//   MODEL_CATALOG_BASE=<commit> overrides the base commit the untouched files and the append-only files are compared with;
//   MODEL_CATALOG_PRINT=1 prints the identity hashes.

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'
import React from 'react'
import jsxRuntimeReal from 'react/jsx-runtime'
import ReactDOMServer from 'react-dom/server'

const { renderToStaticMarkup } = ReactDOMServer
const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const ROOT = path.resolve(process.env.MODEL_CATALOG_ROOT || repoRoot)
// studio-v4-dev-preparation-code at the tip this change was built on (4c5fd0f)
const BASE_COMMIT = process.env.MODEL_CATALOG_BASE || '4c5fd0fbe6500afeb8218075261e268157706eed'
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const clone = value => JSON.parse(JSON.stringify(value))
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)
const deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))

// ---------------------------------------------------------------- files
const LIB = 'lib/studio-model-catalog.ts'
const ROUTE = 'app/api/models/catalogue/route.ts'
const UI = 'components/studio-personal/intelligence-models.tsx'
const CSS = 'components/studio-personal/intelligence-models.css'
const LAYOUT = 'app/(app)/studio/intelligence/layout.tsx'
const PAGE = 'app/(app)/studio/intelligence/page.tsx'
const WORKSPACE = 'components/studio-personal/intelligence-workspace.tsx'
const CHOOSER = 'components/studio-personal/intelligence-p2.tsx'
const ENV = '.env.example'
const PKG = 'package.json'
const FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CATALOG'
const OWN = [LIB, ROUTE, UI, CSS, LAYOUT, ENV, PKG]
for (const rel of [LIB, ROUTE, UI, CSS, LAYOUT]) assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} exists`)
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const SOURCES = Object.fromEntries(OWN.map(rel => [rel, read(rel)]))
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1')
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const baseSource = rel => {
  try { return git('show', `${BASE_COMMIT}:${rel}`) } catch (error) { throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history, or set MODEL_CATALOG_BASE): ${error.message}`) }
}

// ---------------------------------------------------------------- fixtures
const FIXDIR = path.join(repoRoot, 'scripts/fixtures/studio-model-catalog')
const FIXTURE_SHA256 = {
  'fixture-200': '26b2e99f95929685a9dd3bb8c9f9b3b002af5a326696e5484fc849a7d7faff42',
  'fixture-200-available': 'daca49680d4c6b84072a8ce02a2d4816fdafbe90651a54a272e7070759f3e037',
  'fixture-200-available-page2': '67e0810b7d5c9b7c96803c9e7892bb6aac5d5eb0a1007f1f3ca31fba10e14a43',
  'fixture-400': '92be94d764c73db758d6650831893c93ddb5de624c8ad334e8ebada7f8287ecb',
  'fixture-502': '92e586273f4077eecfdd411bbfc8597027370161eddcb106f30bf75f4d46feee',
  'fixture-503': '5d730d3acae1db319e85544bc52da48b7535c15ca92e116ae205709a9e64025a',
  'fixture-503-unreachable': '6de83ccad104a59b4addaea9934cf53719878c4d717b7939744cfd9f2dccd75f',
}
const fx = {}
for (const [name, want] of Object.entries(FIXTURE_SHA256)) {
  const bytes = fs.readFileSync(path.join(FIXDIR, `${name}.json`))
  eq(sha256(bytes), want, `fixture ${name} is the recorded one`)
  if (process.env.MODEL_CATALOG_FIXTURE_SOURCE) ok(bytes.equals(fs.readFileSync(path.join(process.env.MODEL_CATALOG_FIXTURE_SOURCE, `${name}.json`))), `fixture ${name} equals the DIRECTOR-2 original`)
  fx[name] = JSON.parse(bytes.toString('utf8'))
}
const F200 = fx['fixture-200'], FAV = fx['fixture-200-available'], FP2 = fx['fixture-200-available-page2']
const userGroups = body => Object.keys(body.groups).filter(key => body.groups[key].visibility === 'user')
const USER_GROUPS = userGroups(F200)
const allUserSelectable = body => new Set(userGroups(body).flatMap(key => body.groups[key].selectable_models))
// the router quirk the README names: selectable slugs that the page of `models` does not carry
const missingFromModels = body => new Set(Object.values(body.groups).flatMap(group => group.selectable_models).filter(slug => !(slug in body.models)))
eq(missingFromModels(F200).size, 0, 'fixture facts: none missing in the default view')
eq(missingFromModels(FAV).size, 32, 'fixture facts: 32 selectable slugs without a models entry on page one (README)')
eq(missingFromModels(FP2).size, 25, 'fixture facts: 25 on page two (README)')

// ---------------------------------------------------------------- the vm: a module loader, a small hooks runtime, a tiny tree walker
const compiled = new Map()
const compile = (source, fileName) => {
  const key = `${fileName}\u0000${source}`
  if (compiled.has(key)) return compiled.get(key)
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
  assert.equal((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${fileName} compiles`)
  compiled.set(key, out.outputText)
  return out.outputText
}
const EXT = ['', '.ts', '.tsx', '.json', '/index.ts', '/index.tsx']
function resolveFile(spec, from, sources) {
  const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(from), spec)
  for (const ext of EXT) {
    const rel = base + ext
    if (rel in sources) return rel
    const abs = path.join(ROOT, rel)
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return rel
  }
  return null
}
/** Runs `entry` (a repo path) in a vm. `sources` overrides files by path (the mutants); `stubs` replaces imports by name; anything else must resolve to a repo file. */
function load(entry, { sources = SOURCES, env = {}, react = React, jsx = jsxRuntimeReal, stubs = {}, globals = {}, cache = new Map() } = {}) {
  const run = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const mod = { exports: {} }
    cache.set(rel, mod)
    const text = rel in sources ? sources[rel] : fs.readFileSync(path.join(ROOT, rel), 'utf8')
    if (rel.endsWith('.json')) { mod.exports = JSON.parse(text); return mod.exports }
    vm.runInNewContext(compile(text, rel), {
      module: mod, exports: mod.exports, process: { env }, JSON, Math, Object, Array, Set, Map, Promise, Number, String, Boolean, Error, TypeError, URL, URLSearchParams, Date, RegExp, Symbol, console, ...globals,
      require: spec => {
        if (spec in stubs) return stubs[spec]
        if (spec === 'react') return react
        if (spec === 'react/jsx-runtime') return jsx
        if (spec.endsWith('.css')) return {}
        const found = resolveFile(spec, rel, sources)
        return found ? run(found) : assert.fail(`Unexpected import in ${rel}: ${spec}`)
      },
    })
    return mod.exports
  }
  return run(entry)
}
const icons = new Proxy({}, { get: (_target, key) => (key === '__esModule' ? false : () => React.createElement('svg', { 'data-icon': String(key) })) })
const names = new Proxy({}, { get: (_target, key) => (key === '__esModule' ? false : String(key)) })
const miniJsx = { jsx: (type, props, key) => ({ type, props: props ?? {}, key: key ?? null }), jsxs: (type, props, key) => ({ type, props: props ?? {}, key: key ?? null }), Fragment: 'Fragment' }
function createRuntime() {
  const cells = []
  let cursor = 0, dirty = false
  const effects = []
  const changed = (old, deps) => !old || !deps || deps.some((value, index) => !Object.is(value, old.deps?.[index]))
  const react = {
    useState(init) {
      const i = cursor++
      cells[i] ??= { value: typeof init === 'function' ? init() : init }
      const cell = cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(init) { const i = cursor++; return cells[i] ??= { current: init } },
    useEffect(fn, deps) {
      const i = cursor++, old = cells[i]
      if (changed(old, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
    Fragment: 'Fragment',
  }
  return {
    react,
    render(Component, props) {
      for (let pass = 0; pass < 12; pass++) {
        cursor = 0; dirty = false
        const tree = Component(props)
        while (effects.length) effects.shift()()
        if (!dirty) return tree
      }
      throw new Error('render did not settle')
    },
    unmount() { for (const cell of cells) if (cell && typeof cell.cleanup === 'function') { cell.cleanup(); cell.cleanup = undefined } },
    values: () => cells.filter(cell => cell && 'value' in cell).map(cell => cell.value),
  }
}
const expand = node => {
  if (Array.isArray(node)) return node.map(expand)
  if (!node || typeof node !== 'object') return node
  if (typeof node.type === 'function') return expand(node.type(node.props))
  return { ...node, props: { ...node.props, children: expand(node.props?.children) } }
}
const nodesOf = value => Array.isArray(value) ? value.flatMap(nodesOf) : value && typeof value === 'object' ? [value, ...nodesOf(value.props?.children)] : []
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? textOf(value.props?.children) : String(value)
const classes = node => String(node.props?.className ?? '').split(/\s+/)
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

// ---------------------------------------------------------------- 1. the helper
const ready = result => { eq(result.kind, 'ready'); return result.catalogue }
async function proveLib(S, label = 'lib') {
  const L = load(LIB, { sources: S })
  nomatch(stripComments(S[LIB]), /^\s*import\b|\brequire\(|process\.env|\bfetch\(|XMLHttpRequest|localStorage/m, `${label}: import-free, reads no environment, makes no request`)
  eq(L.MODEL_CATALOG_ENDPOINT, '/api/models/catalogue', `${label}: the Studio route`)
  eq(L.MODEL_CATALOG_SCHEMA_VERSION, 1, `${label}: schema 1 is pinned`)
  eq(L.MODEL_CATALOG_PAGE_LIMIT, 10, `${label}: the page size the fixtures were recorded with`)
  eq(L.MODEL_CATALOG_NOT_AVAILABLE_TEXT, "The model catalog isn't available yet", `${label}: the not-available words`)

  // the query: only include_available, limit, offset; rebuilt in a fixed order; Director's own rules
  const q = (...pairs) => plain(L.parseCatalogueQuery(pairs))
  deepEq(q(), { ok: true, search: '' }, `${label}: no query`)
  deepEq(q(['include_available', 'true']), { ok: true, search: '?include_available=true' }, `${label}: include_available=true`)
  deepEq(q(['include_available', 'false']), { ok: true, search: '?include_available=false' }, `${label}: include_available=false`)
  deepEq(q(['limit', '10']), { ok: true, search: '?limit=10' }, `${label}: limit alone`)
  deepEq(q(['offset', '0']), { ok: true, search: '?offset=0' }, `${label}: offset 0`)
  deepEq(q(['offset', '10'], ['limit', '10'], ['include_available', 'true']), { ok: true, search: '?include_available=true&limit=10&offset=10' }, `${label}: rebuilt in a fixed order`)
  deepEq(q(['limit', '200']), { ok: true, search: '?limit=200' }, `${label}: 200 is the router's maximum`)
  deepEq(q(['limit', '201']), { ok: true, search: '?limit=200' }, `${label}: above it is reduced, as Director does`)
  deepEq(q(['limit', '999999999999999999']), { ok: true, search: '?limit=200' }, `${label}: a huge limit is reduced`)
  deepEq(q(['limit', '007']), { ok: true, search: '?limit=7' }, `${label}: leading zeros are dropped`)
  deepEq(q(['offset', '00012']), { ok: true, search: '?offset=12' }, `${label}: leading zeros are dropped from the offset`)
  deepEq(q(['offset', '000']), { ok: true, search: '?offset=0' }, `${label}: all zeros is 0`)
  const bad = (name, ...pairs) => { const out = q(...pairs); eq(out.ok, false, `${label}: ${name} is refused`); eq(out.code, 'invalid_query', `${label}: ${name}: the code`); ok(typeof out.error === 'string' && out.error.length > 0, `${label}: ${name}: says why`); eq('search' in out, false, `${label}: ${name}: forwards nothing`) }
  bad('another parameter', ['group', 'planning_strategy'])
  bad('another parameter beside good ones', ['include_available', 'true'], ['limit', '10'], ['foo', '1'])
  bad('an encoded key', ['limit\u0000', '1'])
  bad('a differently cased key', ['Limit', '10'])
  bad('an empty key', ['', '1'])
  bad('a repeated include_available', ['include_available', 'true'], ['include_available', 'false'])
  bad('a repeated limit', ['limit', '1'], ['limit', '2'])
  bad('a repeated offset', ['offset', '1'], ['offset', '1'])
  for (const value of ['1', '0', 'yes', 'TRUE', 'True', '', ' true', 'true ', 'true&limit=1', 'on']) bad(`include_available=${JSON.stringify(value)}`, ['include_available', value])
  for (const value of ['0', '000', '-1', '1.5', '', ' 10', '10 ', 'ten', '1e3', '0x10', '+5', '１０', '1234567890123456789']) bad(`limit=${JSON.stringify(value)}`, ['limit', value])
  for (const value of ['-1', '1.5', '', ' 1', 'one', '1e3', '+5', '1234567890123456789']) bad(`offset=${JSON.stringify(value)}`, ['offset', value])
  eq(q(['group', 'planning_strategy']).error, fx['fixture-400'].error, `${label}: the sentence is Director's own for an unsupported parameter (fixture-400)`)
  eq(q(['group', 'planning_strategy']).code, fx['fixture-400'].code, `${label}: and its code`)

  // Director's answer -> Studio's answer
  const map = (status, body) => plain(L.mapDirectorCatalogueResponse(status, body))
  for (const name of ['fixture-200', 'fixture-200-available', 'fixture-200-available-page2']) deepEq(map(200, fx[name]), { status: 200, body: fx[name] }, `${label}: ${name} passes through untouched`)
  const NOT_YET = "The model catalog isn't available yet.", UNREACHABLE = 'The model catalog could not be reached right now.', FAILED = 'The model catalog could not be loaded right now.'
  deepEq(map(503, fx['fixture-503']), { status: 503, body: { error: NOT_YET, code: 'router_not_configured', service_unavailable: true } }, `${label}: 503 not configured`)
  deepEq(map(503, fx['fixture-503-unreachable']), { status: 503, body: { error: UNREACHABLE, code: 'router_unreachable', service_unavailable: true } }, `${label}: 503 unreachable`)
  for (const code of ['router_timeout', 'router_unavailable', 'ENTITLEMENT_UNAVAILABLE']) deepEq(map(503, { error: 'x', code, service_unavailable: true }), { status: 503, body: { error: UNREACHABLE, code, service_unavailable: true } }, `${label}: 503 ${code}`)
  deepEq(map(503, null), { status: 503, body: { error: UNREACHABLE, code: 'service_unavailable', service_unavailable: true } }, `${label}: a 503 without a body`)
  deepEq(map(503, { code: 'not a code!' }), { status: 503, body: { error: UNREACHABLE, code: 'service_unavailable', service_unavailable: true } }, `${label}: a code that is not a tag is not repeated`)
  deepEq(map(404, { detail: 'Not Found' }), { status: 503, body: { error: NOT_YET, code: 'catalogue_not_enabled', service_unavailable: true } }, `${label}: Director's own flag off reads as not available yet`)
  deepEq(map(502, fx['fixture-502']), { status: 502, body: { error: FAILED, code: 'router_auth_rejected' } }, `${label}: 502 in Studio's words`)
  deepEq(map(400, fx['fixture-400']), { status: 502, body: { error: FAILED, code: 'invalid_query' } }, `${label}: a 400 for a query Studio had validated is a 502`)
  deepEq(map(401, { error: 'x', code: 'ENTITLEMENT_REQUIRED' }), { status: 502, body: { error: FAILED, code: 'ENTITLEMENT_REQUIRED' } }, `${label}: a refused entitlement`)
  deepEq(map(500, null), { status: 502, body: { error: FAILED, code: 'director_error' } }, `${label}: anything else`)
  for (const garbage of [null, [], 'text', 7, {}, { groups: {} }, { models: {} }, { groups: [], models: {} }, { groups: {}, models: [] }]) deepEq(map(200, garbage), { status: 502, body: { error: FAILED, code: 'catalogue_bad_body' } }, `${label}: a 200 that is not a catalogue (${JSON.stringify(garbage)})`)
  for (const out of [map(503, fx['fixture-503']), map(502, fx['fixture-502']), map(503, fx['fixture-503-unreachable'])]) nomatch(out.body.error, /router|Director|key|Bearer/i, `${label}: the words never name the router, Director or a key`)
  deepEq(plain(L.catalogueCallFailure('not-configured', 'SERVICE_URL_NOT_CONFIGURED')), { status: 503, body: { error: NOT_YET, code: 'SERVICE_URL_NOT_CONFIGURED', service_unavailable: true } }, `${label}: no Director URL`)
  deepEq(plain(L.catalogueCallFailure('not-configured', 'SERVICE_URL_INVALID')), { status: 503, body: { error: NOT_YET, code: 'SERVICE_URL_INVALID', service_unavailable: true } }, `${label}: a bad Director URL`)
  deepEq(plain(L.catalogueCallFailure('not-configured', 'whatever')), { status: 503, body: { error: NOT_YET, code: 'SERVICE_URL_NOT_CONFIGURED', service_unavailable: true } }, `${label}: any other config code is the missing one`)
  deepEq(plain(L.catalogueCallFailure('timeout')), { status: 502, body: { error: FAILED, code: 'director_timeout' } }, `${label}: a timeout`)
  deepEq(plain(L.catalogueCallFailure('unreachable')), { status: 502, body: { error: FAILED, code: 'director_unreachable' } }, `${label}: a network failure`)

  // a Studio answer -> a state
  const cls = (status, body) => L.classifyCatalogueResponse(status, body)
  for (const name of ['fixture-200', 'fixture-200-available', 'fixture-200-available-page2']) eq(cls(200, fx[name]).kind, 'ready', `${label}: ${name} is ready`)
  for (const version of [2, 0, '1', null, undefined, 1.5, true]) eq(cls(200, { ...clone(F200), schema_version: version }).kind, 'unavailable', `${label}: schema_version ${JSON.stringify(version)} reads as unavailable`)
  { const noVersion = clone(F200); delete noVersion.schema_version; eq(cls(200, noVersion).kind, 'unavailable', `${label}: no schema_version`) }
  for (const garbage of [null, [], 'x', 7, {}, { schema_version: 1 }, { schema_version: 1, groups: [], models: {} }, { schema_version: 1, groups: {}, models: [] }]) eq(cls(200, garbage).kind, 'unavailable', `${label}: ${JSON.stringify(garbage)} is not a catalogue`)
  eq(cls(200, { ...clone(F200), surprise: { nested: [1] }, ttl_seconds: 60 }).kind, 'ready', `${label}: unknown fields are ignored`)
  deepEq(cls(503, fx['fixture-503']), { kind: 'not-available' }, `${label}: 503 not configured is "not available yet"`)
  deepEq(cls(503, { error: 'x', code: 'catalogue_not_enabled', service_unavailable: true }), { kind: 'not-available' }, `${label}: Director's flag off is "not available yet"`)
  for (const code of ['SERVICE_URL_NOT_CONFIGURED', 'SERVICE_URL_INVALID']) deepEq(cls(503, { error: 'x', code, service_unavailable: true }), { kind: 'not-available' }, `${label}: ${code} is "not available yet"`)
  deepEq(cls(503, { code: 'router_not_configured' }), { kind: 'error', reason: 'unreachable' }, `${label}: a 503 that does not say service_unavailable is an error`)
  deepEq(cls(503, fx['fixture-503-unreachable']), { kind: 'error', reason: 'unreachable' }, `${label}: 503 unreachable is an error`)
  deepEq(cls(502, fx['fixture-502']), { kind: 'error', reason: 'unreachable' }, `${label}: 502 is an error`)
  deepEq(cls(400, fx['fixture-400']), { kind: 'error', reason: 'unreachable' }, `${label}: 400 is an error`)
  deepEq(cls(401, { error: 'Unauthorized' }), { kind: 'error', reason: 'signed-out' }, `${label}: 401 is signed out`)
  for (const status of [0, 404, 429, 500, 504]) deepEq(cls(status, null), { kind: 'error', reason: 'unreachable' }, `${label}: ${status} is an error`)

  // the rows, fixture 200 (default view)
  const cat200 = ready(cls(200, F200))
  const view = L.buildModelsView(cat200, false)
  deepEq(view.groups.map(group => group.key), USER_GROUPS, `${label}: only the user groups are shown (${USER_GROUPS.join(', ')}), none of the system ones`)
  deepEq(view.groups.map(group => group.label), USER_GROUPS.map(key => F200.groups[key].label), `${label}: their labels`)
  deepEq(view.groups.map(group => group.rows.map(row => row.slug)), USER_GROUPS.map(key => F200.groups[key].selectable_models), `${label}: each group lists exactly its selectable (certified) models, in order`)
  deepEq(view.groups.map(group => group.certified), USER_GROUPS.map(key => F200.groups[key].selectable_models.length), `${label}: the certified counts`)
  eq(view.certifiedTotal, allUserSelectable(F200).size, `${label}: the distinct certified models`)
  eq(view.empty, false, `${label}: not empty`)
  eq(view.nextOffset, null, `${label}: no paging without include_available`)
  const rowOf = (v, group, slug) => v.groups.find(item => item.key === group).rows.find(item => item.slug === slug)
  deepEq(rowOf(view, 'planning_strategy', 'anthropic/claude-opus-5.5'), {
    slug: 'anthropic/claude-opus-5.5', title: 'Claude Opus 5.5', provider: 'Anthropic', chips: ['Vision', 'Tools', 'Structured output'], contextWindow: '1M', maxOutput: '128K',
    speed: null, premium: true, suggested: false, suggestedFor: [], selectable: true,
  }, `${label}: Claude Opus 5.5: premium, no speed (unverified), not marked Suggested in the default view`)
  deepEq(rowOf(view, 'planning_strategy', 'deepseek/deepseek-v4.1-flash'), {
    slug: 'deepseek/deepseek-v4.1-flash', title: 'DeepSeek V4.1 Flash', provider: 'DeepSeek', chips: ['Vision', 'Tools', 'Structured output'], contextWindow: '1M', maxOutput: '384K',
    speed: 'fast', premium: false, suggested: false, suggestedFor: [], selectable: true,
  }, `${label}: DeepSeek V4.1 Flash: a speed class that says something is shown`)
  deepEq(rowOf(view, 'planning_strategy', 'moonshotai/kimi-k3').maxOutput, '944K', `${label}: sizes round to the nearest thousand`)
  deepEq(rowOf(view, 'planning_strategy', 'nvidia/nemotron-3.5-lightning').chips, ['Tools', 'Structured output'], `${label}: only the capabilities a model has`)
  eq(rowOf(view, 'planning_strategy', 'x-ai/grok-4.6').title, 'SpaceXAI: Grok 4.6', `${label}: a name prefix that is not the vendor's own is kept`)
  eq(rowOf(view, 'planning_strategy', 'x-ai/grok-4.6').provider, 'xAI', `${label}: the vendor is named from the slug prefix`)
  eq(rowOf(view, 'planning_strategy', 'x-ai/grok-4.6').speed, 'deep', `${label}: deep`)
  // every row, against an independent reading of the raw body
  const verify = (body, v, showAll, where) => {
    for (const group of v.groups) {
      const raw = body.groups[group.key]
      const recommended = new Set(Object.values(raw.recommended).flatMap(list => list.map(item => item.model)))
      const open = new Set(raw.selectable_models)
      const listed = showAll ? raw.available.map(item => item.model) : raw.selectable_models
      deepEq(group.rows.map(row => row.slug), listed, `${where}: ${group.key}: the rows`)
      for (const row of group.rows) {
        const model = body.models[row.slug]
        const flag = raw.available.find(item => item.model === row.slug)
        eq(row.selectable, showAll ? open.has(row.slug) : true, `${where}: ${row.slug}: open for selection`)
        eq(row.suggested, showAll && (recommended.has(row.slug) || Boolean(flag?.recommended)), `${where}: ${row.slug}: suggested only under Show all models`)
        if (!showAll) deepEq(row.suggestedFor, [], `${where}: ${row.slug}: no shortlist weights in the default view`)
        if (!model) {
          eq(row.title, row.slug, `${where}: ${row.slug} is listed under its slug`)
          deepEq([row.chips, row.contextWindow, row.maxOutput, row.speed, row.premium], [[], null, null, null, false], `${where}: ${row.slug}: nothing is made up`)
          continue
        }
        const caps = model.capabilities
        deepEq(row.chips, [caps.vision && 'Vision', caps.tools && 'Tools', caps.json_schema && 'Structured output', caps.audio_input && 'Audio in', caps.image_output && 'Image out', caps.speech_output && 'Speech out'].filter(Boolean), `${where}: ${row.slug}: chips`)
        eq(row.premium, model.premium[group.key] === true, `${where}: ${row.slug}: premium`)
        eq(row.speed, model.speed_class === 'unverified' ? null : model.speed_class, `${where}: ${row.slug}: speed`)
        ok(row.speed !== 'unverified', `${where}: ${row.slug}: never "unverified"`)
        eq(row.provider === null, !(model.provider || row.slug.includes('/')), `${where}: ${row.slug}: vendor`)
        ok(row.title.length > 0 && model.name.endsWith(row.title), `${where}: ${row.slug}: the title is the name (less the vendor's prefix)`)
      }
    }
  }
  verify(F200, view, false, `${label} 200`)
  { // premium is per group: the same model can be premium for one kind of work and not another
    const perGroup = clone(F200); perGroup.models['anthropic/claude-opus-5.5'].premium = { planning_strategy: true, content_writing: false, research_analysis: false }
    ok(F200.groups.content_writing.selectable_models.includes('anthropic/claude-opus-5.5') && F200.groups.research_analysis.selectable_models.includes('anthropic/claude-opus-5.5'), `${label}: premium: Opus is listed in three groups`)
    const pv = L.buildModelsView(ready(cls(200, perGroup)), false)
    deepEq(['planning_strategy', 'content_writing', 'research_analysis'].map(key => rowOf(pv, key, 'anthropic/claude-opus-5.5').premium), [true, false, false], `${label}: premium follows the group, not the model`)
    const none = clone(F200); none.models['anthropic/claude-opus-5.5'].premium = {}; eq(rowOf(L.buildModelsView(ready(cls(200, none)), false), 'planning_strategy', 'anthropic/claude-opus-5.5').premium, false, `${label}: no premium map, no badge`)
  }
  // include_available, page one: names the quirk (selectable slugs the page of models does not carry)
  const catAv = ready(cls(200, FAV))
  const viewAv = L.buildModelsView(catAv, true)
  verify(FAV, viewAv, true, `${label} available`)
  deepEq(viewAv.groups.map(group => group.rows.length), USER_GROUPS.map(key => FAV.groups[key].available.length), `${label}: one page of each group`)
  deepEq(viewAv.groups.map(group => group.total), USER_GROUPS.map(key => FAV.groups[key].available_count), `${label}: "of N" is available_count`)
  deepEq(viewAv.groups.map(group => group.hasMore), USER_GROUPS.map(key => FAV.groups[key].available_next_offset !== null), `${label}: which groups have another page`)
  eq(viewAv.nextOffset, 10, `${label}: "Show more" continues at offset 10`)
  { const opusAll = rowOf(viewAv, 'planning_strategy', 'anthropic/claude-opus-5.5'); deepEq([opusAll.suggested, opusAll.suggestedFor], [true, ['moderate', 'heavy']], `${label}: all: Claude Opus 5.5 is Suggested, for moderate and heavy`)
    const notRecommended = rowOf(viewAv, 'planning_strategy', 'openai/gpt-6.1-sol-pro'); deepEq([notRecommended.suggested, notRecommended.suggestedFor], [false, []], `${label}: all: a model off the shortlist is not`)
    // an entry the router itself flags recommended is Suggested even when no weight lists it
    const flagged = clone(FAV); flagged.groups.planning_strategy.available.find(item => item.model === 'openai/gpt-6.1-sol-pro').recommended = true
    const flaggedRow = rowOf(L.buildModelsView(ready(cls(200, flagged)), true), 'planning_strategy', 'openai/gpt-6.1-sol-pro'); deepEq([flaggedRow.suggested, flaggedRow.suggestedFor], [true, []], `${label}: all: the router's own recommended flag counts`) }
  ok(viewAv.groups.find(group => group.key === 'imagery').rows.every(row => row.selectable === false), `${label}: nothing in Imagery is certified yet: listed, not open for selection`)
  ok(viewAv.groups.find(group => group.key === 'voice_narration').rows.every(row => row.selectable === false), `${label}: nor in Voice & Narration`)
  ok(viewAv.groups.find(group => group.key === 'planning_strategy').rows.every(row => row.selectable === true), `${label}: Planning & Strategy's first page is all certified`)
  { // the certified list of this view is every certified model, most of them without an entry in `models`: they are listed by slug
    const viewSel = L.buildModelsView(catAv, false)
    verify(FAV, viewSel, false, `${label} available/selectable`)
    const planning = viewSel.groups.find(group => group.key === 'planning_strategy')
    eq(planning.rows.length, FAV.groups.planning_strategy.selectable_models.length, `${label}: all of Planning's certified models`)
    const slugRows = planning.rows.filter(row => !(row.slug in FAV.models))
    eq(slugRows.length, FAV.groups.planning_strategy.selectable_models.filter(slug => !(slug in FAV.models)).length, `${label}: the ones the page does not carry`)
    ok(slugRows.length > 20, `${label}: there are many of them`)
    ok(slugRows.every(row => row.title === row.slug && row.provider !== null && row.chips.length === 0), `${label}: each is its slug with the vendor from the prefix`)
    eq(slugRows.find(row => row.slug === 'amazon/nova-2-lite-v1').provider, 'Amazon', `${label}: Amazon from "amazon/"`)
    eq(L.catalogueSummary({ kind: 'ready', catalogue: catAv }, false), `${new Set(userGroups(FAV).flatMap(key => FAV.groups[key].selectable_models)).size} models open for selection`, `${label}: the header counts the certified models`)
  }
  // page two merged onto page one
  const catP2 = ready(cls(200, FP2))
  const merged = L.mergeCataloguePage(catAv, catP2)
  ok(merged !== null, `${label}: the pages merge`)
  const viewMerged = L.buildModelsView(merged, true)
  for (const key of USER_GROUPS) {
    const expected = [...new Set([...FAV.groups[key].available, ...FP2.groups[key].available].map(item => item.model))]
    deepEq(viewMerged.groups.find(group => group.key === key).rows.map(row => row.slug), expected, `${label}: ${key}: page one then page two, once each`)
  }
  eq(viewMerged.nextOffset, 20, `${label}: and on to offset 20`)
  deepEq(Object.keys(merged.models).sort(), [...new Set([...Object.keys(FAV.models), ...Object.keys(FP2.models)])].sort(), `${label}: the models of both pages`)
  deepEq(L.buildModelsView(L.mergeCataloguePage(catAv, catAv), true).groups.map(group => group.rows.length), viewAv.groups.map(group => group.rows.length), `${label}: a page merged with itself adds nothing`)
  eq(L.mergeCataloguePage(catAv, { ...catP2, version: 'a-later-catalogue' }), null, `${label}: another catalogue version does not merge`)
  deepEq(L.buildModelsView(catAv, true).groups.map(group => group.rows.length), viewAv.groups.map(group => group.rows.length), `${label}: merging does not change the first page`)

  // empty / summary
  { const nothing = clone(F200); for (const group of Object.values(nothing.groups)) { group.selectable_models = []; group.recommended = {} }
    const empty = ready(cls(200, nothing)); const emptyView = L.buildModelsView(empty, false)
    eq(emptyView.empty, true, `${label}: no certified model anywhere is empty`); eq(emptyView.certifiedTotal, 0, `${label}: none`)
    eq(L.catalogueSummary({ kind: 'ready', catalogue: empty }), 'No models open for selection yet', `${label}: the empty summary`)
    const one = clone(F200); for (const group of Object.values(one.groups)) group.selectable_models = []; one.groups.planning_strategy.selectable_models = ['anthropic/claude-opus-5.5']
    eq(L.catalogueSummary({ kind: 'ready', catalogue: ready(cls(200, one)) }), '1 model open for selection', `${label}: one model`)
    const noGroups = clone(F200); noGroups.groups = {}
    eq(L.buildModelsView(ready(cls(200, noGroups)), false).empty, true, `${label}: no groups at all is empty`)
  }
  eq(L.catalogueSummary(null), 'Loading…', `${label}: summary: loading`)
  eq(L.catalogueSummary({ kind: 'ready', catalogue: cat200 }), `${allUserSelectable(F200).size} models open for selection`, `${label}: summary: ready`)
  eq(L.catalogueSummary({ kind: 'ready', catalogue: cat200 }, true), 'Showing all models', `${label}: summary: all models`)
  eq(L.catalogueSummary({ kind: 'not-available' }), 'Not available yet', `${label}: summary: not available`)
  eq(L.catalogueSummary({ kind: 'unavailable' }), 'Unavailable', `${label}: summary: unavailable`)
  eq(L.catalogueSummary({ kind: 'error', reason: 'unreachable' }), 'Could not be loaded', `${label}: summary: error`)
  // small helpers
  for (const [count, want] of [[1000000, '1M'], [1048576, '1M'], [1050000, '1.1M'], [2000000, '2M'], [128000, '128K'], [262144, '262K'], [999, '999'], [1000, '1K']]) eq(L.formatTokenCount(count), want, `${label}: ${count} is ${want}`)
  eq(L.providerLabel('openai'), 'OpenAI', `${label}: OpenAI`); eq(L.providerLabel('fish-audio'), 'Fish Audio', `${label}: Fish Audio`); eq(L.providerLabel('some-new-lab'), 'Some New Lab', `${label}: a vendor it does not know`)
  eq(L.providerLabel('constructor'), 'Constructor', `${label}: a vendor named like an Object property`)
  eq(L.providerOf('openai/gpt-x'), 'openai', `${label}: vendor from the prefix`); eq(L.providerOf('gemini-embedding-001'), null, `${label}: no prefix, no vendor`)
  eq(L.providerOf('openai/gpt-x', { provider: 'someone' }), 'someone', `${label}: the model's own provider wins`)
  eq(L.modelTitle('a/b'), 'a/b', `${label}: no entry, the slug`)
  { const hostile = clone(F200); hostile.models['__proto__x'] = hostile.models['anthropic/claude-opus-5.5']; hostile.groups.planning_strategy.selectable_models.push('constructor', '__proto__')
    const hv = L.buildModelsView(ready(cls(200, hostile)), false); const rows = hv.groups[0].rows
    eq(rows.find(row => row.slug === 'constructor').title, 'constructor', `${label}: a slug named like an Object property is only a slug`)
    eq(rows.find(row => row.slug === '__proto__').title, '__proto__', `${label}: nor does __proto__ reach anything`) }

  // the client cache (ttl_seconds, 300 s without one, capped; errors never kept; one request in flight)
  const clock = { t: 0 }
  const make = handler => { const calls = []; const loader = L.createCatalogueLoader({ now: () => clock.t, fetchJson: async url => { calls.push(url); return handler(url, calls.length) } }); return { loader, calls } }
  { clock.t = 0; const { loader, calls } = make(() => ({ status: 200, body: F200 }))
    eq((await loader.load(false)).kind, 'ready', `${label}: loads`); await loader.load(false); eq(calls.length, 1, `${label}: the second read is the first's`)
    clock.t = 299_999; await loader.load(false); eq(calls.length, 1, `${label}: still kept at 299.999 s (no ttl_seconds: 300 s)`)
    clock.t = 300_001; await loader.load(false); eq(calls.length, 2, `${label}: asked again after 300 s`)
    deepEq(calls, ['/api/models/catalogue', '/api/models/catalogue'], `${label}: always the Studio route`) }
  for (const [ttl, expiry, name] of [[60, 60_000, 'ttl_seconds 60'], [99999, 3_600_000, 'a huge ttl_seconds is capped at an hour'], [0, 300_000, 'ttl_seconds 0 is the default'], [-5, 300_000, 'a negative one is the default'], ['60', 300_000, 'a string one is the default'], [null, 300_000, 'null is the default']]) {
    clock.t = 0; const { loader, calls } = make(() => ({ status: 200, body: { ...clone(F200), ttl_seconds: ttl } }))
    await loader.load(false); clock.t = expiry - 1; await loader.load(false); eq(calls.length, 1, `${label}: ${name}: kept until the end`)
    clock.t = expiry + 1; await loader.load(false); eq(calls.length, 2, `${label}: ${name}: asked again after it`)
  }
  { clock.t = 0; const { loader, calls } = make(() => ({ status: 200, body: F200 }))
    await loader.load(false); await loader.load(true); eq(calls.length, 2, `${label}: the two views are two reads`)
    deepEq(calls, ['/api/models/catalogue', '/api/models/catalogue?include_available=true&limit=10'], `${label}: the all-models URL`)
    await loader.load(false); await loader.load(true); eq(calls.length, 2, `${label}: and each is kept`) }
  { clock.t = 0; const answers = [{ status: 503, body: fx['fixture-503'] }, { status: 200, body: F200 }]; const { loader, calls } = make(() => answers.shift())
    eq((await loader.load(false)).kind, 'not-available', `${label}: not configured`); eq((await loader.load(false)).kind, 'ready', `${label}: an error is not kept: it is asked again`); eq(calls.length, 2, `${label}: two reads`)
    await loader.load(false); eq(calls.length, 2, `${label}: a good answer is kept`) }
  { clock.t = 0; let n = 0; const { loader, calls } = make(() => { if (n++ === 0) throw new TypeError('network'); return { status: 200, body: F200 } })
    deepEq(await loader.load(false), { kind: 'error', reason: 'unreachable' }, `${label}: a network failure is an error`); eq((await loader.load(false)).kind, 'ready', `${label}: and is asked again`); eq(calls.length, 2, `${label}: twice`) }
  { clock.t = 0; const gate = deferred(); const { loader, calls } = make(async () => { await gate.promise; return { status: 200, body: F200 } })
    const both = Promise.all([loader.load(false), loader.load(false), loader.load(false)]); await settle(); gate.resolve(); const results = await both
    eq(calls.length, 1, `${label}: three callers at once ask once`); ok(results.every(result => result.kind === 'ready'), `${label}: and all get the answer`) }
  { clock.t = 0; const { loader, calls } = make(url => (url.includes('offset=10') ? { status: 200, body: FP2 } : { status: 200, body: FAV }))
    const first = await loader.load(true); const more = await loader.loadMore(ready(first))
    deepEq(calls, ['/api/models/catalogue?include_available=true&limit=10', '/api/models/catalogue?include_available=true&limit=10&offset=10'], `${label}: "Show more" asks for the next offset`)
    eq(L.buildModelsView(ready(more), true).groups[0].rows.length, 20, `${label}: and the rows are 20`)
    const done = await loader.loadMore(cat200); eq(done.kind, 'ready', `${label}: nothing more to load is not an error`); eq(calls.length, 2, `${label}: and asks nobody`) }
  { clock.t = 0; const { loader } = make(url => (url.includes('offset=10') ? { status: 503, body: fx['fixture-503-unreachable'] } : { status: 200, body: FAV }))
    const failed = await loader.loadMore(ready(await loader.load(true))); eq(failed.kind, 'error', `${label}: a failed next page is an error the caller can show`) }
  { clock.t = 0; const second = { ...clone(FAV), catalogue_version: 'v2' }; let firstReads = 0
    const { loader, calls } = make(url => (url.includes('offset=10') ? { status: 200, body: { ...clone(FP2), catalogue_version: 'v2' } } : { status: 200, body: ++firstReads === 1 ? FAV : second }))
    const first = await loader.load(true); const result = await loader.loadMore(ready(first))
    eq(ready(result).version, 'v2', `${label}: a catalogue that changed between the pages starts again from page one`); eq(L.buildModelsView(ready(result), true).groups[0].rows.length, 10, `${label}: with the first page only`)
    eq(calls.filter(url => !url.includes('offset=10')).length, 2, `${label}: the first page was asked for again`) }
  return L
}

// ---------------------------------------------------------------- 2. the route
const ROUTE_STUBS = calls => ({
  'next/server': { NextRequest: class {}, NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } },
  'next-auth': { getServerSession: async () => { calls.session++; return calls.sessionValue } },
  '@/lib/auth-options': { authOptions: {} },
})
async function runRoute(S, opts = {}) {
  // an option passed as undefined means "unset", not "the default"
  const pick = (name, fallback) => (name in opts ? opts[name] : fallback)
  const flag = pick('flag', 'true'), director = pick('director', 'https://director.test'), session = pick('session', { user: { email: 'person@example.test' } })
  const query = pick('query', ''), answer = pick('answer', { status: 200, body: F200 }), throws = pick('throws', undefined)
  const calls = { session: 0, sessionValue: session, fetch: [] }
  const env = {}
  if (flag !== undefined) env[FLAG] = flag
  if (director !== undefined) env.DIRECTOR_API_URL = director
  const fetchStub = async (url, init) => {
    calls.fetch.push({ url, init })
    if (throws) throw throws
    return { status: answer.status, json: async () => { if (answer.body === undefined) throw new SyntaxError('not json'); return answer.body } }
  }
  const mod = load(ROUTE, { sources: S, env, stubs: ROUTE_STUBS(calls), globals: { fetch: fetchStub, AbortSignal: { timeout: ms => ({ timeoutMs: ms }) } } })
  assert.equal(typeof mod.GET, 'function', 'the route exports GET')
  const response = await mod.GET({ url: `https://studio.test/api/models/catalogue${query}` })
  return { status: response.status, body: plain(response.body), calls, exports: Object.keys(mod) }
}
async function proveRoute(S, label = 'route') {
  const code = stripComments(S[ROUTE])
  deepEq(code.match(/process\.env\.[A-Z0-9_]+/g).sort(), ['process.env.DIRECTOR_API_URL', 'process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG'], `${label}: reads only the flag and the Director URL`)
  nomatch(code, /Authorization|Bearer|API_KEY|ROUTER|cookie|X-Deckster|userId\s*[,}]/i, `${label}: no key, no identity, no entitlement header is sent yet`)
  match(S[ROUTE], /TODO\(entitlement\)[\s\S]*X-Deckster-Entitlement[\s\S]*DIRECTOR_REST_ENTITLEMENT_READ_REQUIRED_ENABLED/, `${label}: the entitlement TODO is marked`)
  match(code, /process\.env\.NEXT_PUBLIC_STUDIO_MODEL_CATALOG !== 'true'/, `${label}: the flag is read inline, exact "true"`)
  // flag off: 404 before any session read or backend call
  for (const off of [undefined, '', 'false', '0', '1', 'TRUE', 'True', 'yes', ' true', 'true ', 'on']) {
    const out = await runRoute(S, { flag: off })
    eq(out.status, 404, `${label}: flag ${JSON.stringify(off)}: 404`); deepEq(out.body, { error: 'Not found' }, `${label}: flag ${JSON.stringify(off)}: the body`)
    eq(out.calls.session, 0, `${label}: flag ${JSON.stringify(off)}: no session read`); eq(out.calls.fetch.length, 0, `${label}: flag ${JSON.stringify(off)}: no backend call`)
    const withQuery = await runRoute(S, { flag: off, query: '?group=x&limit=zz' }); eq(withQuery.status, 404, `${label}: flag ${JSON.stringify(off)}: 404 even for a bad query`)
  }
  // signed in only
  for (const none of [null, undefined, {}, { user: {} }, { user: { email: '' } }, { user: { id: '' } }]) {
    const out = await runRoute(S, { session: none })
    eq(out.status, 401, `${label}: session ${JSON.stringify(none)}: 401`); deepEq(out.body, { error: 'Unauthorized' }, `${label}: session ${JSON.stringify(none)}: the body`); eq(out.calls.fetch.length, 0, `${label}: session ${JSON.stringify(none)}: no backend call`)
  }
  for (const some of [{ user: { email: 'a@b.test' } }, { user: { id: 'u1' } }]) eq((await runRoute(S, { session: some })).status, 200, `${label}: ${JSON.stringify(some)} is signed in`)
  { const out = await runRoute(S, { session: null, query: '?group=x' }); eq(out.status, 401, `${label}: signed out beats a bad query`) }
  // the query: only the three, validated, rebuilt
  const forwarded = async query => (await runRoute(S, { query })).calls.fetch.map(call => call.url)
  deepEq(await forwarded(''), ['https://director.test/api/v1/models/catalogue'], `${label}: no query`)
  deepEq(await forwarded('?include_available=true&limit=10'), ['https://director.test/api/v1/models/catalogue?include_available=true&limit=10'], `${label}: include_available and limit`)
  deepEq(await forwarded('?offset=10&limit=10&include_available=true'), ['https://director.test/api/v1/models/catalogue?include_available=true&limit=10&offset=10'], `${label}: rebuilt in order`)
  deepEq(await forwarded('?limit=5000'), ['https://director.test/api/v1/models/catalogue?limit=200'], `${label}: limit reduced to 200`)
  for (const query of ['?group=planning_strategy', '?include_available=true&x=1', '?limit=0', '?limit=-3', '?limit=abc', '?offset=-1', '?offset=', '?include_available=yes', '?include_available=true&include_available=true', '?limit=1&limit=2', '?include_available=true%26x%3D1', '?Limit=10', '?limit=10#frag&x=1']) {
    const out = await runRoute(S, { query })
    if (query === '?limit=10#frag&x=1') { eq(out.status, 200, `${label}: ${query}: a fragment is not part of the query`); continue }
    eq(out.status, 400, `${label}: ${query}: 400`); eq(out.body.code, 'invalid_query', `${label}: ${query}: the code`); eq(out.calls.fetch.length, 0, `${label}: ${query}: nothing is forwarded`)
  }
  { const out = await runRoute(S, { query: '?group=planning_strategy' }); eq(out.body.error, fx['fixture-400'].error, `${label}: the 400 reads as Director's own (fixture-400)`) }
  // what is sent
  { const out = await runRoute(S, { query: '?include_available=true&limit=10', director: 'https://director.test/' }); const call = out.calls.fetch[0]
    eq(call.url, 'https://director.test/api/v1/models/catalogue?include_available=true&limit=10', `${label}: a trailing slash on DIRECTOR_API_URL is dropped`)
    deepEq(call.init, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal: { timeoutMs: 15000 } }, `${label}: a plain GET: Accept only, never cached, a 15 s timeout, no body, no cookies, no identity`)
    eq(out.calls.fetch.length, 1, `${label}: one call`) }
  // every recorded Director answer, replayed
  const replay = async (name, status, query) => runRoute(S, { query, answer: { status, body: fx[name] } })
  for (const [name, query] of [['fixture-200', ''], ['fixture-200-available', '?include_available=true&limit=10'], ['fixture-200-available-page2', '?include_available=true&limit=10&offset=10']]) {
    const out = await replay(name, 200, query); eq(out.status, 200, `${label}: ${name}: 200`); deepEq(out.body, fx[name], `${label}: ${name}: the body, whole and untouched`)
    eq(sha256(JSON.stringify(out.body)), sha256(JSON.stringify(fx[name])), `${label}: ${name}: same bytes`)
  }
  { const out = await replay('fixture-400', 400, '?include_available=true'); eq(out.status, 502, `${label}: fixture-400 (a refusal of a query Studio forwarded): 502`); deepEq(out.body, { error: 'The model catalog could not be loaded right now.', code: 'invalid_query' }, `${label}: fixture-400: body`) }
  { const out = await replay('fixture-502', 502, ''); eq(out.status, 502, `${label}: fixture-502: 502`); deepEq(out.body, { error: 'The model catalog could not be loaded right now.', code: 'router_auth_rejected' }, `${label}: fixture-502: body`) }
  { const out = await replay('fixture-503', 503, ''); eq(out.status, 503, `${label}: fixture-503: 503`); deepEq(out.body, { error: "The model catalog isn't available yet.", code: 'router_not_configured', service_unavailable: true }, `${label}: fixture-503: body`) }
  { const out = await replay('fixture-503-unreachable', 503, ''); eq(out.status, 503, `${label}: fixture-503-unreachable: 503`); deepEq(out.body, { error: 'The model catalog could not be reached right now.', code: 'router_unreachable', service_unavailable: true }, `${label}: fixture-503-unreachable: body`) }
  // other Director answers
  { const out = await runRoute(S, { answer: { status: 404, body: { detail: 'Not Found' } } }); eq(out.status, 503, `${label}: Director's flag off: 503`); eq(out.body.code, 'catalogue_not_enabled', `${label}: its code`); eq(out.body.service_unavailable, true, `${label}: service_unavailable`) }
  { const out = await runRoute(S, { answer: { status: 401, body: { code: 'ENTITLEMENT_REQUIRED', error: 'x' } } }); eq(out.status, 502, `${label}: a refused entitlement: 502`); eq(out.body.code, 'ENTITLEMENT_REQUIRED', `${label}: its code`) }
  { const out = await runRoute(S, { answer: { status: 200, body: undefined } }); eq(out.status, 502, `${label}: a 200 that is not JSON: 502`); eq(out.body.code, 'catalogue_bad_body', `${label}: its code`) }
  { const out = await runRoute(S, { answer: { status: 200, body: { hello: 1 } } }); eq(out.status, 502, `${label}: a 200 that is not a catalogue: 502`) }
  { const out = await runRoute(S, { answer: { status: 500, body: undefined } }); eq(out.status, 502, `${label}: a 500 page: 502`); eq(out.body.code, 'director_error', `${label}: its code`) }
  { const out = await runRoute(S, { throws: new TypeError('fetch failed') }); eq(out.status, 502, `${label}: a network failure: 502`); eq(out.body.code, 'director_unreachable', `${label}: its code`) }
  for (const name of ['TimeoutError', 'AbortError']) { const error = new Error('aborted'); error.name = name; const out = await runRoute(S, { throws: error }); eq(out.status, 502, `${label}: ${name}: 502`); eq(out.body.code, 'director_timeout', `${label}: ${name}: its code`) }
  // no Director URL
  for (const [director, codeWant] of [[undefined, 'SERVICE_URL_NOT_CONFIGURED'], ['', 'SERVICE_URL_NOT_CONFIGURED'], ['   ', 'SERVICE_URL_NOT_CONFIGURED'], ['ftp://director.test', 'SERVICE_URL_INVALID'], ['director.test', 'SERVICE_URL_INVALID'], ['https://user:pw@director.test', 'SERVICE_URL_INVALID']]) {
    const out = await runRoute(S, { director }); eq(out.status, 503, `${label}: DIRECTOR_API_URL ${JSON.stringify(director)}: 503`); eq(out.body.code, codeWant, `${label}: its code`); eq(out.body.service_unavailable, true, `${label}: service_unavailable`)
    eq(out.calls.fetch.length, 0, `${label}: no call`); nomatch(JSON.stringify(out.body), /director\.test|user:pw|DIRECTOR_API_URL/, `${label}: the answer repeats neither the URL nor the variable's name`)
  }
  { const out = await runRoute(S); deepEq(Object.keys(out.body).sort(), Object.keys(F200).sort(), `${label}: the answer carries the catalogue and nothing added`) }
  { const out = await runRoute(S); deepEq([...out.exports].sort(), ['GET', 'dynamic'], `${label}: GET only, always dynamic`) }
}

// ---------------------------------------------------------------- 3. the section
const PRICE = /\$|price|pricing|per 1M|per million|cost|USD|in \/ \d/i
async function proveUi(S, label = 'ui') {
  const code = stripComments(S[UI])
  nomatch(code, /process\.env|localStorage|sessionStorage|\/api\/v1|director|router|XMLHttpRequest|WebSocket|sendBeacon|dangerouslySetInnerHTML/i, `${label}: no environment, storage, Director or router in the section`)
  eq(code.match(/\bfetch\(/g).length, 1, `${label}: one fetch`); match(code, /fetch\(url, \{ credentials: "same-origin", cache: "no-store" \}\)/, `${label}: that fetch takes the URL the helper builds, same origin`)
  nomatch(code, /https?:/, `${label}: no absolute URL`)
  const U = load(UI, { sources: S, stubs: { 'lucide-react': icons } })
  const section = props => renderToStaticMarkup(React.createElement(U.ModelsSection, { open: true, showAll: false, result: null, more: 'idle', onOpen() {}, onShowAll() {}, onRetry() {}, onMore() {}, ...props }))
  const L = load(LIB, { sources: S })
  const readyOf = body => ({ kind: 'ready', catalogue: ready(L.classifyCatalogueResponse(200, body)) })
  const none = (markup, pattern, name) => nomatch(markup, pattern, `${label}: ${name}`)
  // loading
  { const markup = section({ result: null }); match(markup, /data-model-catalog="loading"/, `${label}: loading: state`); match(markup, /<p class="sp-mc-state" role="status">Loading the model catalog…<\/p>/, `${label}: loading: words`); match(markup, /<span class="sp-mc-summary">Loading…<\/span>/, `${label}: loading: header`); none(markup, /Show all models|sp-mc-group/, 'loading: no controls, no groups') }
  // closed / open
  { const closed = section({ open: false, result: readyOf(F200) }); match(closed, /aria-expanded="false"/, `${label}: closed: aria-expanded false`); match(closed, /<div id="sp-mc-panel" class="sp-mc-panel" hidden="">/, `${label}: closed: the panel is hidden`); match(closed, /data-mc-open="false"/, `${label}: closed: state`)
    const open = section({ open: true, result: readyOf(F200) }); match(open, /aria-expanded="true"/, `${label}: open: aria-expanded true`); none(open, /<div id="sp-mc-panel"[^>]* hidden/, 'open: the panel is not hidden'); match(open, /aria-controls="sp-mc-panel"/, `${label}: the button controls the panel`) }
  // ready, the default view
  { const markup = section({ result: readyOf(F200) })
    match(markup, /<h2 id="sp-mc-heading" class="sp-mc-heading"><button type="button" class="sp-mc-toggle"/, `${label}: ready: the heading holds the disclosure button`)
    match(markup, new RegExp(`<span class="sp-mc-summary">${allUserSelectable(F200).size} models open for selection</span>`), `${label}: ready: the header counts`)
    match(markup, /<input type="checkbox"\/><span>Show all models<\/span>/, `${label}: ready: "Show all models", off`); none(markup, /<input type="checkbox" checked/, 'ready: not checked')
    for (const key of USER_GROUPS) match(markup, new RegExp(`data-mc-group="${key}"`), `${label}: ready: group ${key}`)
    none(markup, /data-mc-group="(structure_layout|visual_review|utilities|embeddings)"/, 'ready: no system group')
    eq(markup.match(/<li class="sp-mc-row"/g).length, USER_GROUPS.reduce((n, key) => n + F200.groups[key].selectable_models.length, 0), `${label}: ready: a row for every certified model of every shown group`)
    match(markup, /<strong>Claude Opus 5\.5<\/strong>/, `${label}: ready: a name`); match(markup, /<p class="sp-mc-meta">Anthropic · 1M context · 128K output<\/p>/, `${label}: ready: vendor, context window, output size (no speed when unverified)`)
    match(markup, /<p class="sp-mc-meta">DeepSeek · 1M context · 384K output · Speed: fast<\/p>/, `${label}: ready: a speed class that says something`)
    match(markup, /<ul class="sp-mc-chips" aria-label="Capabilities"><li>Vision<\/li><li>Tools<\/li><li>Structured output<\/li><\/ul>/, `${label}: ready: capability chips`)
    match(markup, /<span class="sp-mc-badge sp-mc-badge-premium">Premium<\/span>/, `${label}: ready: a premium badge`)
    const premiumRows = USER_GROUPS.reduce((n, key) => n + F200.groups[key].selectable_models.filter(slug => F200.models[slug].premium[key] === true).length, 0)
    eq((markup.match(/sp-mc-badge-premium/g) ?? []).length, premiumRows, `${label}: ready: Premium exactly where the catalogue says (${premiumRows})`)
    none(markup, /Suggested|sp-mc-badge-suggested/, 'ready: no "Suggested" in the default view (the list is the shortlist, so every row would carry it)')
    none(markup, /Not open for selection/, 'ready: every row in the default view is open for selection')
    match(markup, /No models are open for selection yet\./, `${label}: ready: a group with none says so (Imagery, Voice & Narration)`)
    match(markup, /Catalog 2026-09-30\.wp1-stage25-proposed-mapping-revision-two-layer\+shortlist:2026-10-02-shortlist-v1/, `${label}: ready: the catalogue version`)
    match(markup, /This list is read-only\./, `${label}: ready: read-only`)
    none(markup, /unverified/i, 'ready: "unverified" is never shown'); none(markup, PRICE, 'ready: no price, no cost, no currency'); none(markup, /Show more models/, 'ready: no paging without include_available')
    match(markup, /Planning &amp; Strategy/, `${label}: ready: labels are escaped`) }
  // ready, every model
  { const merged = L.mergeCataloguePage(readyOf(FAV).catalogue, readyOf(FP2).catalogue)
    const markup = section({ showAll: true, result: readyOf(FAV) })
    match(markup, /<input type="checkbox" checked=""\/><span>Show all models<\/span>/, `${label}: all: the switch is on`); match(markup, /<span class="sp-mc-summary">Showing all models<\/span>/, `${label}: all: header`)
    eq(markup.match(/<li class="sp-mc-row"/g).length, USER_GROUPS.reduce((n, key) => n + FAV.groups[key].available.length, 0), `${label}: all: one page of every shown group`)
    const suggestedAll = USER_GROUPS.reduce((n, key) => { const rec = new Set(Object.values(FAV.groups[key].recommended).flatMap(list => list.map(item => item.model))); return n + FAV.groups[key].available.filter(item => rec.has(item.model) || item.recommended).length }, 0)
    ok(suggestedAll > 0 && suggestedAll < markup.match(/<li class="sp-mc-row"/g).length, `${label}: all: some rows are on the shortlist and some are not (${suggestedAll})`)
    eq((markup.match(/sp-mc-badge-suggested/g) ?? []).length, suggestedAll, `${label}: all: Suggested exactly on the shortlist (${suggestedAll})`)
    match(markup, /<span class="sp-mc-badge sp-mc-badge-suggested" title="Suggested for moderate, heavy work\. A proposed shortlist, not final\.">Suggested<\/span>/, `${label}: all: Suggested says it is proposed, and for which weights`)
    match(markup, /Showing 10 of 51/, `${label}: all: "Showing 10 of 51"`); match(markup, /Showing 2 of 2|Showing 4 of 4/, `${label}: all: and a group that fits says so`)
    match(markup, /<span class="sp-mc-badge sp-mc-badge-closed" title="Not certified yet, so it cannot be picked\.">Not open for selection<\/span>/, `${label}: all: a model that is not certified says so`)
    match(markup, /data-mc-selectable="false"/, `${label}: all: and is marked`)
    match(markup, /<button type="button" class="sp-mc-button">Show more models<\/button>/, `${label}: all: "Show more models"`); none(markup, /Loading…<\/button>/, 'all: not loading more')
    none(markup, /unverified/i, 'all: "unverified" is never shown'); none(markup, PRICE, 'all: no price')
    const more = section({ showAll: true, result: readyOf(FAV), more: 'loading' }); match(more, /<button type="button" class="sp-mc-button" disabled="">Loading…<\/button>/, `${label}: all: loading more`)
    const moreError = section({ showAll: true, result: readyOf(FAV), more: 'error' }); match(moreError, /<span class="sp-mc-more-error" role="alert">Could not load more models\. Try again\.<\/span>/, `${label}: all: a failed page says so`)
    const done = section({ showAll: true, result: { kind: 'ready', catalogue: merged } }); eq(done.match(/<li class="sp-mc-row"/g).length, USER_GROUPS.reduce((n, key) => n + new Set([...FAV.groups[key].available, ...FP2.groups[key].available].map(item => item.model)).size, 0), `${label}: all: both pages listed`)
    match(done, /Showing 20 of 51/, `${label}: all: "Showing 20 of 51"`)
    // the last page: nothing more
    const last = clone(FP2); for (const group of Object.values(last.groups)) group.available_next_offset = null
    const lastMarkup = section({ showAll: true, result: { kind: 'ready', catalogue: L.mergeCataloguePage(readyOf(FAV).catalogue, readyOf(last).catalogue) } }); none(lastMarkup, /Show more models/, 'all: no "Show more models" on the last page') }
  // the slug fallback, in the markup
  { const markup = section({ result: readyOf(FAV) }); match(markup, /<strong>amazon\/nova-2-lite-v1<\/strong>(<span[^>]*>[^<]*<\/span>)*<\/div><p class="sp-mc-meta">Amazon<\/p>/, `${label}: a model the page holds no entry for is listed under its slug, with its vendor`) }
  // empty
  { const nothing = clone(F200); for (const group of Object.values(nothing.groups)) { group.selectable_models = []; group.recommended = {} }
    const markup = section({ result: readyOf(nothing) }); match(markup, /<p class="sp-mc-state" data-mc-state="empty">No models are open for selection yet\.<\/p>/, `${label}: empty: words`); none(markup, /sp-mc-group/, 'empty: no groups'); match(markup, /data-model-catalog="ready"/, `${label}: empty: still a ready catalogue`); match(markup, /Show all models/, `${label}: empty: and the switch stays`) }
  // not available yet / unavailable / error
  { const markup = section({ result: { kind: 'not-available' } }); match(markup, /data-model-catalog="not-available"/, `${label}: not available: state`)
    match(markup, /<strong>The model catalog isn&#x27;t available yet\.<\/strong>/, `${label}: not available: the words`); match(markup, /<span class="sp-mc-summary">Not available yet<\/span>/, `${label}: not available: header`); none(markup, /Try again|role="alert"|Show all models/, 'not available: not an error, no controls') }
  { const markup = section({ result: { kind: 'unavailable' } }); match(markup, /data-model-catalog="unavailable"/, `${label}: unavailable: state`); match(markup, /<strong>The model catalog is unavailable\.<\/strong>/, `${label}: unavailable: the words`); none(markup, /Show all models/, 'unavailable: no controls') }
  { const markup = section({ result: { kind: 'error', reason: 'unreachable' } }); match(markup, /data-model-catalog="error"/, `${label}: error: state`); match(markup, /data-mc-state="error" role="alert"><p><strong>The model catalog could not be loaded right now\.<\/strong><\/p><button type="button" class="sp-mc-button">Try again<\/button>/, `${label}: error: words, alert, "Try again"`) }
  { const markup = section({ showAll: true, result: { kind: 'error', reason: 'unreachable' } }); match(markup, /<button type="button" class="sp-mc-button">Try again<\/button><button type="button" class="sp-mc-button">Show only the open models<\/button>/, `${label}: error in the all-models view: a way back to the open models`)
    none(section({ showAll: false, result: { kind: 'error', reason: 'unreachable' } }), /Show only the open models/, 'error in the default view: no way back needed') }
  { const markup = section({ result: { kind: 'error', reason: 'signed-out' } }); match(markup, /Sign in again to see the model catalog\./, `${label}: signed out: the words`) }
  for (const result of [null, { kind: 'not-available' }, { kind: 'unavailable' }, { kind: 'error', reason: 'unreachable' }]) none(section({ result }), /Director|router|503|502|undefined|null|\[object/i, `state ${result?.kind ?? 'loading'}: no jargon, no leaks`)

  // the container: what is fetched, in what order
  const runContainer = async (answers, fn) => {
    const fetches = []
    const stub = async (url, init) => { fetches.push({ url, init }); const answer = await answers(url, fetches.length); return { status: answer.status, json: async () => { if (answer.body === undefined) throw new SyntaxError('no'); return answer.body } } }
    const rt = createRuntime()
    const C = load(UI, { sources: S, react: rt.react, jsx: miniJsx, stubs: { 'lucide-react': names }, globals: { fetch: stub } })
    const view = () => expand(rt.render(C.IntelligenceModels))
    const find = (tree, predicate) => nodesOf(tree).find(predicate)
    await fn({ view, find, fetches, settle, rt })
  }
  const byUrl = url => (url.includes('offset=10') ? { status: 200, body: FP2 } : url.includes('include_available') ? { status: 200, body: FAV } : { status: 200, body: F200 })
  await runContainer(async url => byUrl(url), async ({ view, find, fetches }) => {
    let tree = view()
    eq(fetches.length, 1, `${label}: opening the page asks once`); eq(fetches[0].url, '/api/models/catalogue', `${label}: for the certified models, from the Studio route`)
    deepEq(fetches[0].init, { credentials: 'same-origin', cache: 'no-store' }, `${label}: with nothing added`)
    ok(textOf(tree).includes('Loading…'), `${label}: loading until it answers`); eq(find(tree, node => node.props?.id === 'sp-mc-panel').props.hidden, true, `${label}: the panel starts closed`)
    await settle(); tree = view()
    ok(textOf(tree).includes(`${allUserSelectable(F200).size} models open for selection`), `${label}: the header says what there is`)
    eq(fetches.length, 1, `${label}: still one read`)
    find(tree, node => node.props?.className === 'sp-mc-toggle').props.onClick(); tree = view(); eq(find(tree, node => node.props?.id === 'sp-mc-panel').props.hidden, false, `${label}: the bar opens the panel`)
    find(tree, node => node.props?.type === 'checkbox').props.onChange(); tree = view()
    eq(fetches.length, 2, `${label}: "Show all models" asks again`); eq(fetches[1].url, '/api/models/catalogue?include_available=true&limit=10', `${label}: with include_available and the page size`)
    ok(textOf(tree).includes('Loading the model catalog…'), `${label}: loading again`)
    await settle(); tree = view(); ok(textOf(tree).includes('Showing all models'), `${label}: all models`)
    eq(find(tree, node => node.props?.type === 'checkbox').props.checked, true, `${label}: the switch is on`)
    find(tree, node => node.type === 'button' && textOf(node) === 'Show more models').props.onClick(); tree = view()
    eq(fetches.length, 3, `${label}: "Show more models" asks for the next page`); eq(fetches[2].url, '/api/models/catalogue?include_available=true&limit=10&offset=10', `${label}: at offset 10`)
    ok(find(tree, node => node.type === 'button' && textOf(node) === 'Loading…'), `${label}: and says it is loading`)
    await settle(); tree = view(); eq(nodesOf(tree).filter(node => classes(node).includes('sp-mc-row')).length, USER_GROUPS.reduce((n, key) => n + new Set([...FAV.groups[key].available, ...FP2.groups[key].available].map(item => item.model)).size, 0), `${label}: both pages are listed`)
    find(tree, node => node.props?.type === 'checkbox').props.onChange(); tree = view(); await settle(); tree = view()
    eq(fetches.length, 3, `${label}: back to the certified models: kept, so nobody is asked`); ok(textOf(tree).includes(`${allUserSelectable(F200).size} models open for selection`), `${label}: and the header is back`)
    ok(fetches.every(call => call.url.startsWith('/api/models/catalogue')), `${label}: only the Studio route is ever called`)
  })
  await runContainer(async () => ({ status: 503, body: fx['fixture-503'] }), async ({ view, find, fetches }) => {
    view(); await settle(); const tree = view(); eq(find(tree, node => node.props?.['data-model-catalog'])?.props['data-model-catalog'], 'not-available', `${label}: UAT's answer reads as not available yet`)
    ok(textOf(tree).includes("The model catalog isn't available yet."), `${label}: with its words`); eq(fetches.length, 1, `${label}: and is not asked again by itself`)
  })
  { let n = 0
    await runContainer(async () => (n++ === 0 ? { status: 503, body: fx['fixture-503-unreachable'] } : { status: 200, body: F200 }), async ({ view, find, fetches }) => {
      view(); await settle(); let tree = view(); eq(find(tree, node => node.props?.['data-model-catalog'])?.props['data-model-catalog'], 'error', `${label}: unreachable is an error`)
      find(tree, node => node.type === 'button' && textOf(node) === 'Try again').props.onClick(); tree = view(); eq(fetches.length, 2, `${label}: "Try again" asks again`)
      await settle(); tree = view(); eq(find(tree, node => node.props?.['data-model-catalog'])?.props['data-model-catalog'], 'ready', `${label}: and the list arrives`)
    }) }
  await runContainer(async () => { throw new TypeError('network') }, async ({ view, find }) => { view(); await settle(); eq(find(view(), node => node.props?.['data-model-catalog'])?.props['data-model-catalog'], 'error', `${label}: a network failure is an error`) })
  await runContainer(async () => ({ status: 200, body: { ...clone(F200), schema_version: 2 } }), async ({ view, find }) => { view(); await settle(); eq(find(view(), node => node.props?.['data-model-catalog'])?.props['data-model-catalog'], 'unavailable', `${label}: another schema reads as unavailable`) })
  { const gate = deferred() // an answer that lands after the page was left is dropped
    await runContainer(async () => { await gate.promise; return { status: 200, body: F200 } }, async ({ view, rt }) => {
      view(); rt.unmount(); gate.resolve(); await settle()
      ok(!rt.values().some(value => value && typeof value === 'object' && 'kind' in value), `${label}: leaving the page drops the answer that lands later`)
    }) }
  { // a page of "Show more" that lands after the view was changed is dropped
    const gate = deferred()
    await runContainer(async url => (url.includes('offset=10') ? (await gate.promise, { status: 200, body: FP2 }) : byUrl(url)), async ({ view, find, fetches }) => {
      view(); await settle(); let tree = view()
      find(tree, node => node.props?.type === 'checkbox').props.onChange(); view(); await settle(); tree = view()
      find(tree, node => node.type === 'button' && textOf(node) === 'Show more models').props.onClick(); tree = view(); eq(fetches.length, 3, `${label}: late: the next page is out`)
      find(tree, node => node.props?.type === 'checkbox').props.onChange(); view(); await settle(); tree = view() // back to the certified list while it is out
      const rows = () => nodesOf(tree).filter(node => classes(node).includes('sp-mc-row')).length
      const before = rows(); eq(before, USER_GROUPS.reduce((n, key) => n + F200.groups[key].selectable_models.length, 0), `${label}: late: the certified list is showing`)
      gate.resolve(); await settle(); tree = view()
      eq(rows(), before, `${label}: late: the page that lands afterwards is dropped`); ok(textOf(tree).includes('models open for selection') && !textOf(tree).includes('Showing all models'), `${label}: late: the header is the certified list's`)
      ok(!find(tree, node => node.type === 'button' && textOf(node) === 'Loading…'), `${label}: late: nothing is still loading`)
    }) }
}

// ---------------------------------------------------------------- 4. the layout, and the page it wraps
const OFF_VALUES = [undefined, '', 'false', '0', '1', 'TRUE', 'True', 'yes', ' true', 'true ', 'on']
function proveLayout(S, label = 'layout') {
  const code = stripComments(S[LAYOUT])
  match(code, /process\.env\.NEXT_PUBLIC_STUDIO_MODEL_CATALOG !== "true"/, `${label}: the flag is read inline, exact "true"`)
  match(code, /process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true"/, `${label}: and the Studio shell is required`)
  const Stub = () => React.createElement('aside', { 'data-stub': 'models' })
  const page = () => React.createElement('main', { id: 'page' }, 'PAGE')
  const alone = renderToStaticMarkup(page())
  for (const shell of [undefined, 'false', 'true']) for (const flag of [...OFF_VALUES, 'true']) {
    const env = {}
    if (shell !== undefined) env.NEXT_PUBLIC_STUDIO_V4_SHELL = shell
    if (flag !== undefined) env[FLAG] = flag
    const Layout = load(LAYOUT, { sources: S, env, stubs: { '@/components/studio-personal/intelligence-models': { IntelligenceModels: Stub } } }).default
    const html = renderToStaticMarkup(React.createElement(Layout, null, page()))
    const on = shell === 'true' && flag === 'true'
    eq(html, on ? `<div class="sp-mc-frame" data-studio-model-catalog-frame="true">${alone}<aside data-stub="models"></aside></div>` : alone, `${label}: shell ${JSON.stringify(shell)}, flag ${JSON.stringify(flag)}: ${on ? 'the page, then the section, in one frame' : 'the page, exactly'}`)
  }
}
/** The REAL page (workspace and chooser included) with and without the layout. */
function proveIdentity(S) {
  const stubs = {
    'lucide-react': icons,
    '@/components/studio-libraries/studio-workflow-action': { StudioWorkflowAction: props => React.createElement('button', { 'data-action': props.action }, props.children) },
    '@/components/layout/app-header': { BackToBuilderButton: () => React.createElement('button', { 'data-back': 'true' }, 'Back to Builder') },
    '@/components/studio-intro-replay': { StudioIntroReplay: () => React.createElement('div', { 'data-intro': 'true' }) },
    'next/navigation': { notFound: () => { throw new Error('NOT_FOUND') } },
  }
  const hashes = []
  for (const p2 of [undefined, 'true']) for (const catalog2610 of [undefined, 'true']) for (const flag of [...OFF_VALUES, 'true']) {
    const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
    if (p2) env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE = p2
    if (catalog2610) env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10 = catalog2610
    if (flag !== undefined) env[FLAG] = flag
    const cache = new Map()
    const Page = load(PAGE, { sources: S, env, stubs, cache }).default
    const Layout = load(LAYOUT, { sources: S, env, stubs, cache }).default
    const alone = renderToStaticMarkup(React.createElement(Page))
    const wrapped = renderToStaticMarkup(React.createElement(Layout, null, React.createElement(Page)))
    ok(alone.includes('data-studio-personal="intelligence"') && alone.length > 3000, `identity: the real page rendered (${alone.length} bytes)`)
    if (flag === 'true') {
      const prefix = '<div class="sp-mc-frame" data-studio-model-catalog-frame="true">'
      ok(wrapped.startsWith(prefix + alone), 'identity: flag on: the page, byte for byte, in the frame, then')
      match(wrapped.slice(prefix.length + alone.length), /^<section class="sp-mc"/, 'identity: flag on: the section follows the page')
      ok(wrapped.includes('data-model-catalog="loading"') && wrapped.includes('<div id="sp-mc-panel" class="sp-mc-panel" hidden="">'), 'identity: flag on: the first render is a closed bar, loading')
      continue
    }
    eq(sha256(wrapped), sha256(alone), `identity: p2 ${p2}, 2026-10 ${catalog2610}, flag ${JSON.stringify(flag)}: the page through the layout hashes as the page`)
    ok(wrapped === alone, `identity: and is the same string`)
    hashes.push([`p2=${p2 ?? '-'} 2026-10=${catalog2610 ?? '-'} flag=${JSON.stringify(flag)}`, sha256(alone), sha256(wrapped)])
  }
  if (process.env.MODEL_CATALOG_PRINT) for (const [name, a, b] of hashes) console.log(`${a}  ${b}  ${name}`)
  // the shell off: the page is a 404 and the layout adds nothing
  { const env = { NEXT_PUBLIC_STUDIO_MODEL_CATALOG: 'true' }; const cache = new Map()
    const Page = load(PAGE, { sources: S, env, stubs, cache }).default; const Layout = load(LAYOUT, { sources: S, env, stubs, cache }).default
    assert.throws(() => renderToStaticMarkup(React.createElement(Page)), /NOT_FOUND/); assert.throws(() => renderToStaticMarkup(React.createElement(Layout, null, React.createElement(Page))), /NOT_FOUND/)
    ok(true, 'identity: shell off: the page is a 404 with or without the layout') }
  return hashes
}
function proveUntouched() {
  for (const rel of [PAGE, WORKSPACE, CHOOSER, 'components/studio-personal/intelligence-p2.css', 'lib/studio-intelligence-p2.ts']) eq(sha256(read(rel)), sha256(baseSource(rel)), `untouched: ${rel} is byte-identical to ${BASE_COMMIT.slice(0, 7)}`)
}

// ---------------------------------------------------------------- 5. the stylesheet, .env.example, package.json
const OWN_SELECTOR = /^(\.sp-mc\b|\[data-studio-model-catalog-frame\])/
function proveCss(S, label = 'css') {
  const root = postcss.parse(S[CSS])
  let rules = 0
  root.walkRules(rule => {
    rules++
    for (const selector of rule.selectors) ok(OWN_SELECTOR.test(selector.trim()), `${label}: "${selector.trim()}" is a selector of the new markup only`)
    if (rule.selector.includes('.sp-workspace')) eq(rule.selector.trim(), '[data-studio-model-catalog-frame] > .sp-workspace', `${label}: the page's workspace is only touched inside the frame`)
  })
  root.walkDecls(decl => ok(!decl.important, `${label}: no !important (${decl.prop})`))
  root.walkAtRules(rule => { ok(rule.name === 'media', `${label}: only media queries`); ok(/^\((min-width: 851px|max-width: 850px)\)$/.test(rule.params), `${label}: the page's own breakpoint (${rule.params})`) })
  ok(rules > 40, `${label}: styled (${rules} rules)`)
  const frame = postcss.parse(S[CSS]).nodes.flatMap(node => node.type === 'atrule' ? node.nodes : [node]).filter(node => node.type === 'rule' && node.selector.startsWith('[data-studio-model-catalog-frame]'))
  ok(frame.length === 3, `${label}: three frame rules (the frame, the page in it, the bar)`)
  const decl = (selector, prop) => postcss.parse(S[CSS]).nodes.flatMap(node => node.type === 'atrule' ? node.nodes : [node]).find(node => node.type === 'rule' && node.selector === selector)?.nodes.find(item => item.prop === prop)?.value
  eq(decl('[data-studio-model-catalog-frame] > .sp-workspace', 'flex'), '1 1 0', `${label}: the page takes the height that is left`)
  eq(decl('[data-studio-model-catalog-frame] > .sp-workspace', 'height'), 'auto', `${label}: its own 100% height gives way`)
  eq(decl('.sp-mc-panel', 'overflow-y'), 'auto', `${label}: the open panel scrolls on its own`)
  eq(postcss.parse(S[CSS]).nodes.find(node => node.type === 'comment')?.text.startsWith('NEXT_PUBLIC_STUDIO_MODEL_CATALOG'), true, `${label}: says which flag it belongs to`)
}
function proveEnvAndPackage(env, pkg, label = 'env') {
  match(env, new RegExp(`^${FLAG}="false"$`, 'm'), `${label}: documented, default off`)
  eq(env.split(`\n${FLAG}=`).length - 1, 1, `${label}: once (the 2026-10 flag is a different line)`)
  const start = env.indexOf('# PASS3 MODEL CATALOG'), end = env.indexOf(`\n${FLAG}="false"`)
  ok(start !== -1 && start < end, `${label}: with its comment above`)
  const block = env.slice(start, end)
  match(block, /the exact value "true" turns it on, anything else leaves it off/, `${label}: says what turns it on`)
  match(block, /Build-time flag: set it on Vercel and redeploy/, `${label}: says it is read at build time`)
  match(block, /Studio shell only/, `${label}: says it needs the shell`)
  match(block, /\/api\/models\/catalogue answers 404/, `${label}: says what off means for the route`)
  match(block, /No prices are shown/, `${label}: says there are no prices`)
  match(block, /DIRECTOR_MODEL_CATALOGUE_PASSTHROUGH_ENABLED/, `${label}: names Director's flag`)
  match(block, /503 and the section says "The model catalog isn't available yet"/, `${label}: says what UAT shows today`)
  match(block, /No new secret/, `${label}: says there is no new secret`)
  match(block, /the browser never calls Director or the router/, `${label}: says the browser never calls Director`)
  nomatch(block, /READ AT BUILD TIME|exact "true" enables it|Needs the Studio shell \(|Nothing is sent or stored|P2_POLISH|PASS2/, `${label}: reuses no other block's phrases`)
  for (const line of block.split('\n')) { ok(/^#/.test(line), `${label}: only comments above the flag`); if (line.length > 40) eq(env.split(line).length - 1, 1, `${label}: no line of it is repeated elsewhere: ${line.slice(0, 50)}`) }
  ok(env.indexOf('NEXT_PUBLIC_STUDIO_P2_POLISH="false"') < start, `${label}: below the polish block (whose strip cuts from its marker on)`)
  // append-only against the base
  const want = baseSource(ENV).split('\n'), extras = []
  let next = 0
  for (const line of env.split('\n')) { if (next < want.length && line === want[next]) next++; else extras.push(line) }
  eq(next, want.length, `${label}: every line of the base's .env.example is still there, in order`)
  ok(extras.every(line => /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/.test(line)), `${label}: what is added is comments, blanks and env lines`)
  ok(extras.includes(`${FLAG}="false"`), `${label}: the flag's line is among them`)
  // package.json
  const json = JSON.parse(pkg), baseJson = JSON.parse(baseSource(PKG))
  eq(json.scripts['test:studio-model-catalog'], 'node scripts/test-studio-model-catalog.mjs', `${label}: the test is registered`)
  for (const [name, command] of Object.entries(baseJson.scripts)) eq(json.scripts[name], command, `${label}: package script ${name} is the base's`)
  const norm = line => line.replace(/,\s*$/, '')
  const baseLines = baseSource(PKG).split('\n').map(norm), lines = pkg.split('\n').map(norm), added = []
  let at = 0
  for (const line of lines) { if (at < baseLines.length && line === baseLines[at]) at++; else added.push(line) }
  eq(at, baseLines.length, `${label}: every line of the base's package.json is still there, in order`)
  ok(added.every(line => /^\s*"test:[a-z0-9-]+": "node scripts\/test-[a-z0-9-]+\.mjs"$/.test(line)), `${label}: what is added are test script lines`)
  ok(added.some(line => line.includes('test:studio-model-catalog"')), `${label}: this change's script is among them`)
  eq(JSON.stringify(json.dependencies), JSON.stringify(baseJson.dependencies), `${label}: no dependency added`)
}

const SECTIONS = {
  lib: proveLib, route: proveRoute, ui: proveUi,
  layout: async (S, label) => proveLayout(S, label), css: async (S, label) => proveCss(S, label), env: async (S, label) => proveEnvAndPackage(S[ENV], S[PKG], label),
}
const FIRST = { [LIB]: 'lib', [ROUTE]: 'route', [UI]: 'ui', [LAYOUT]: 'layout', [CSS]: 'css', [ENV]: 'env', [PKG]: 'env' }
/** Every section on `S`; for a mutant the section that watches the mutated file goes first, so a caught mutant costs one section. */
async function proveAll(S, label, first) {
  const order = [...new Set([first, ...Object.keys(SECTIONS)].filter(Boolean))]
  for (const name of order) await SECTIONS[name](S, label)
}

// ---------------------------------------------------------------- run
await proveAll(SOURCES, 'branch')
const hashes = proveIdentity(SOURCES)
proveUntouched()
const checksBeforeMutants = checks

// ---------------------------------------------------------------- mutants: each must be caught
const swap = (text, from, to) => { assert.ok(text.includes(from), `mutant text exists: ${from.slice(0, 60)}`); return text.replace(from, () => to) }
const MUTANTS = [
  // the helper
  [LIB, 'schema 1 not pinned', t => swap(t, 'body.schema_version !== MODEL_CATALOG_SCHEMA_VERSION', 'body.schema_version === undefined')],
  [LIB, 'the pinned schema number moved', t => swap(t, 'MODEL_CATALOG_SCHEMA_VERSION = 1', 'MODEL_CATALOG_SCHEMA_VERSION = 2')],
  [LIB, 'unverified speed shown', t => swap(t, "speed !== 'unverified'", "speed !== 'unknown'")],
  [LIB, 'system groups shown', t => swap(t, "visible: value.visibility === 'user'", 'visible: true')],
  [LIB, 'slug fallback lost', t => swap(t, 'if (!name) return slug', "if (!name) return 'Unnamed model'")],
  [LIB, 'ttl ignored', t => swap(t, 'ttlMs: result.catalogue.ttlSeconds * 1000', 'ttlMs: 0')],
  [LIB, 'default ttl changed', t => swap(t, 'MODEL_CATALOG_DEFAULT_TTL_SECONDS = 300', 'MODEL_CATALOG_DEFAULT_TTL_SECONDS = 30')],
  [LIB, 'ttl not capped', t => swap(t, 'Math.min(ttl ?? MODEL_CATALOG_DEFAULT_TTL_SECONDS, MODEL_CATALOG_MAX_TTL_SECONDS)', '(ttl ?? MODEL_CATALOG_DEFAULT_TTL_SECONDS)')],
  [LIB, 'errors kept', t => swap(t, 'else kept.delete(url)', 'else kept.set(url, { at: deps.now(), ttlMs: 600000, result })')],
  [LIB, 'in-flight read not shared', t => swap(t, 'if (pending) return pending', '')],
  [LIB, 'limit not reduced', t => swap(t, 'digits.length > 3 ? MODEL_CATALOG_LIMIT_MAX : Math.min(Number(digits), MODEL_CATALOG_LIMIT_MAX)', 'Number(digits)')],
  [LIB, 'limit 0 allowed', t => swap(t, "if (digits === '0') return refuse", "if (digits === '-1') return refuse")],
  [LIB, 'another parameter allowed', t => swap(t, "key !== 'offset') return refuse", "key !== 'offset' && key !== 'group') return refuse")],
  [LIB, 'a repeated parameter allowed', t => swap(t, 'if (key in seen) return refuse', 'if (false) return refuse')],
  [LIB, 'include_available loosely read', t => swap(t, "seen.include_available !== 'true' && seen.include_available !== 'false'", "seen.include_available === ''")],
  [LIB, 'not-configured is a 502', t => swap(t, "({ status: 503, body: { error: NOT_YET_CODES.includes(code)", "({ status: 502, body: { error: NOT_YET_CODES.includes(code)")],
  [LIB, 'service_unavailable dropped', t => swap(t, 'code, service_unavailable: true } })\nconst failed', 'code } })\nconst failed')],
  [LIB, 'router words leaked', t => swap(t, "const FAILED_TEXT = 'The model catalog could not be loaded right now.'", "const FAILED_TEXT = 'The model router refused Director.'")],
  [LIB, 'a 200 not checked', t => swap(t, 'return isRecord(body) && isRecord(body.groups) && isRecord(body.models) ? { status: 200, body } : failed(\'catalogue_bad_body\')', 'return { status: 200, body }')],
  [LIB, 'Director 404 passed on', t => swap(t, "if (status === 404) return unavailable('catalogue_not_enabled')", '')],
  [LIB, 'merge keeps repeats', t => swap(t, 'next.available.filter(entry => !listed.has(entry.model))', 'next.available')],
  [LIB, 'versions not compared', t => swap(t, 'if (base.version !== page.version) return null', '')],
  [LIB, 'paging offset wrong', t => swap(t, 'return offsets.length ? Math.min(...offsets) : null', 'return offsets.length ? Math.max(...offsets) + 10 : null')],
  [LIB, 'uncertified rows look certified', t => swap(t, 'open.has(entry.model), entry.recommended, true)', 'true, entry.recommended, true)')],
  [LIB, 'every certified model listed in the shortlist view', t => swap(t, ': group.selectable.map(slug => rowFor(slug, group, catalogue.models, true, false, false))', ': group.available.map(entry => rowFor(entry.model, group, catalogue.models, true, false, false))')],
  [LIB, 'suggested ignored', t => swap(t, 'suggested: markSuggested && (weights.length > 0 || listedAsRecommended)', 'suggested: false')],
  [LIB, 'suggested marked in the default view too', t => swap(t, 'suggested: markSuggested && (weights.length > 0 || listedAsRecommended)', 'suggested: weights.length > 0 || listedAsRecommended')],
  [LIB, 'suggested weights shown in the default view', t => swap(t, 'suggestedFor: markSuggested ? ', 'suggestedFor: true ? ')],
  [LIB, 'default view marks suggested', t => swap(t, 'rowFor(slug, group, catalogue.models, true, false, false))', 'rowFor(slug, group, catalogue.models, true, false, true))')],
  [LIB, 'all view never marks suggested', t => swap(t, 'entry.recommended, true))', 'entry.recommended, false))')],
  [LIB, 'the shortlist flag of an entry ignored', t => swap(t, 'weights.length > 0 || listedAsRecommended)', 'weights.length > 0)')],
  [LIB, 'premium ignored', t => swap(t, 'premium: Boolean(model?.premiumGroups.includes(group.key))', 'premium: false')],
  [LIB, 'premium for any group', t => swap(t, 'premium: Boolean(model?.premiumGroups.includes(group.key))', 'premium: Boolean(model?.premiumGroups.length)')],
  [LIB, 'a price read', t => swap(t, "chips: capabilityChips(model),", "chips: capabilityChips(model).concat(model ? ['$1 per 1M'] : []),")],
  [LIB, 'vendor from upstream', t => swap(t, "const vendor = model?.provider ?? (slug.includes('/')", "const vendor = (slug.includes('/')")],
  [LIB, 'prototype keys reach a model', t => swap(t, 'Object.create(null) as Record<string, T>', '{} as Record<string, T>')],
  [LIB, 'fixed reading of the vendor label', t => swap(t, "if (Object.prototype.hasOwnProperty.call(PROVIDER_LABELS, vendor)) return PROVIDER_LABELS[vendor]", 'if (PROVIDER_LABELS[vendor]) return PROVIDER_LABELS[vendor]')],
  [LIB, 'context window wrongly rounded', t => swap(t, "if (count >= 1000) return `${Math.round(count / 1000)}K`", "if (count >= 1000) return `${Math.floor(count / 1000)}K`")],
  // the route
  [ROUTE, 'flag gate loosened', t => swap(t, "process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG !== 'true'", "process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG === 'false'")],
  [ROUTE, 'flag gate after the session read', t => swap(swap(t, "  if (process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG !== 'true') return NextResponse.json({ error: 'Not found' }, { status: 404 })\n", ''), "  if (!userId) return", "  if (process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG !== 'true') return NextResponse.json({ error: 'Not found' }, { status: 404 })\n  if (!userId) return")],
  [ROUTE, 'no session check', t => swap(t, "if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })", '')],
  [ROUTE, 'raw query forwarded', t => swap(t, '/api/v1/models/catalogue${query.search}', '/api/v1/models/catalogue${new URL(req.url).search}')],
  [ROUTE, 'validation skipped', t => swap(t, "if (!query.ok) return NextResponse.json({ error: query.error, code: query.code }, { status: 400 })", '')],
  [ROUTE, 'an identity header sent', t => swap(t, "headers: { Accept: 'application/json' }", "headers: { Accept: 'application/json', 'X-User': String(userId) }")],
  [ROUTE, 'a key header sent', t => swap(t, "headers: { Accept: 'application/json' }", "headers: { Accept: 'application/json', Authorization: 'Bearer x' }")],
  [ROUTE, 'caching allowed', t => swap(t, "      cache: 'no-store',\n", '')],
  [ROUTE, 'no timeout', t => swap(t, '      signal: AbortSignal.timeout(DIRECTOR_TIMEOUT_MS),\n', '')],
  [ROUTE, 'not a GET', t => swap(t, "      method: 'GET',\n", "      method: 'POST',\n")],
  [ROUTE, 'answers not mapped', t => swap(t, 'const outcome = mapDirectorCatalogueResponse(response.status, body)', 'const outcome = { status: response.status, body: body as Record<string, unknown> }')],
  [ROUTE, 'config failure unmapped', t => swap(t, "catalogueCallFailure('not-configured', error.code)", "catalogueCallFailure('unreachable')")],
  [ROUTE, 'timeout unmapped', t => swap(t, "error.name === 'TimeoutError' || error.name === 'AbortError'", 'false')],
  [ROUTE, 'trailing slash kept', t => swap(t, ', { stripTrailingSlash: true }', '')],
  [ROUTE, 'a second environment variable read', t => swap(t, "const DIRECTOR_TIMEOUT_MS = 15000", "const DIRECTOR_TIMEOUT_MS = Number(process.env.ROUTER_TIMEOUT) || 15000")],
  [ROUTE, 'entitlement TODO dropped', t => swap(t, 'TODO(entitlement)', 'note')],
  [ROUTE, 'a non-GET export', t => swap(t, 'export async function GET(', 'export async function POST(')],
  // the section
  [UI, 'a price shown', t => swap(t, '`Speed: ${row.speed}`', '`Speed: ${row.speed} · $1 per 1M`')],
  [UI, 'premium badge dropped', t => swap(t, '{row.premium && <span className="sp-mc-badge sp-mc-badge-premium">Premium</span>}', '')],
  [UI, 'suggested badge dropped', t => swap(t, '{row.suggested && <span', '{false && <span')],
  [UI, 'not-open badge dropped', t => swap(t, '{!row.selectable && <span', '{false && <span')],
  [UI, 'speed dropped', t => swap(t, 'row.speed && `Speed: ${row.speed}`', 'null')],
  [UI, 'capability chips dropped', t => swap(t, '{row.chips.length > 0 && ', '{false && ')],
  [UI, 'version hidden', t => swap(t, '{version && <span', '{false && <span')],
  [UI, 'the browser calls Director', t => swap(t, 'await fetch(url, ', 'await fetch(`https://director.example/api/v1/models/catalogue`, ')],
  [UI, 'credentials changed', t => swap(t, 'credentials: "same-origin"', 'credentials: "include"')],
  [UI, 'switch inverted', t => swap(t, 'checked={showAll}', 'checked={!showAll}')],
  [UI, 'panel always open', t => swap(t, 'hidden={!open}', 'hidden={false}')],
  [UI, 'panel open when it should be shut', t => swap(t, 'hidden={!open}', 'hidden={open}')],
  [UI, 'not expanded state', t => swap(t, 'aria-expanded={open}', 'aria-expanded={!open}')],
  [UI, 'error alert dropped', t => swap(t, 'data-mc-state="error" role="alert"', 'data-mc-state="error"')],
  [UI, 'retry button dropped', t => swap(t, '<button type="button" className="sp-mc-button" onClick={onRetry}>Try again</button>', '')],
  [UI, 'no way back from an error', t => swap(t, '{showAll && <button type="button" className="sp-mc-button" onClick={onShowAll}>Show only the open models</button>}', '')],
  [UI, 'show more dropped', t => swap(t, '{showAll && view.nextOffset !== null && ', '{false && ')],
  [UI, 'show more always', t => swap(t, '{showAll && view.nextOffset !== null && ', '{showAll && ')],
  [UI, 'view change does not refetch', t => swap(t, '}, [showAll, attempt])', '}, [attempt])')],
  [UI, 'retry does not refetch', t => swap(t, '}, [showAll, attempt])', '}, [showAll])')],
  [UI, 'late answers kept', t => swap(t, 'if (run.current === id) setResult(next)', 'setResult(next)')],
  [UI, 'late pages kept', t => swap(t, 'if (run.current !== id) return', '')],
  [UI, 'the not-available words changed', t => swap(t, '<p><strong>{MODEL_CATALOG_NOT_AVAILABLE_TEXT}.</strong></p>', '<p><strong>Something went wrong.</strong></p>')],
  [UI, 'unavailable words dropped', t => swap(t, 'The model catalog is unavailable.', 'Error.')],
  [UI, 'a router detail leaked', t => swap(t, 'The answer was not one this page can read.', 'The router answered with schema_version 2.')],
  [UI, 'the header ignores the view', t => swap(t, '{catalogueSummary(result, showAll)}', '{catalogueSummary(result)}')],
  [UI, 'the loading words dropped', t => swap(t, 'Loading the model catalog…', '')],
  [UI, 'storage used', t => swap(t, 'const run = useRef(0)', 'const run = useRef(0); try { window.localStorage.setItem("models", "1") } catch {}')],
  // the layout
  [LAYOUT, 'flag not checked', t => swap(t, ' || process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG !== "true"', '')],
  [LAYOUT, 'shell not required', t => swap(t, 'process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true" || ', '')],
  [LAYOUT, 'flag loosened', t => swap(t, 'process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG !== "true"', 'process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG === "false"')],
  [LAYOUT, 'a wrapper when off', t => swap(t, 'return <>{children}</>', 'return <div>{children}</div>')],
  [LAYOUT, 'section dropped when on', t => swap(t, '<IntelligenceModels />', '')],
  [LAYOUT, 'section before the page', t => swap(t, '{children}<IntelligenceModels />', '<IntelligenceModels />{children}')],
  [LAYOUT, 'frame mark dropped', t => swap(t, ' data-studio-model-catalog-frame="true"', '')],
  // the stylesheet
  [CSS, 'the page restyled', t => `${t}\n.sp-workspace { padding: 0; }\n`],
  [CSS, 'a global rule', t => `${t}\nbody { overflow: auto; }\n`],
  [CSS, 'an important', t => swap(t, 'min-height: 42px;', 'min-height: 42px !important;')],
  [CSS, 'the frame loses the page height', t => swap(t, 'flex: 1 1 0; height: auto;', 'flex: 1 1 0; height: 100%;')],
  [CSS, 'the panel stops scrolling', t => swap(t, 'overflow-y: auto; overscroll-behavior: contain;', 'overflow-y: visible; overscroll-behavior: contain;')],
  [CSS, 'the comment names no flag', t => swap(t, '/* NEXT_PUBLIC_STUDIO_MODEL_CATALOG.', '/* Models.')],
  // .env.example and package.json
  [ENV, 'default on', t => swap(t, `${FLAG}="false"`, `${FLAG}="true"`)],
  [ENV, 'renamed', t => swap(t, `\n${FLAG}="false"`, `\nNEXT_PUBLIC_STUDIO_MODELS="false"`)],
  [ENV, 'declared twice', t => swap(t, `\n${FLAG}="false"\n`, `\n${FLAG}="false"\n${FLAG}="false"\n`)],
  [ENV, 'build time unsaid', t => swap(t, 'Build-time flag: set it on Vercel and redeploy.', 'Set it on Vercel.')],
  [ENV, 'prices unsaid', t => swap(t, 'No prices are shown', 'Prices are shown')],
  [ENV, 'the 503 unsaid', t => swap(t, `503 and the section says "The model catalog isn't available yet"`, '503')],
  [ENV, 'a phrase borrowed', t => swap(t, 'Build-time flag: set it on Vercel and redeploy.', 'READ AT BUILD TIME: set it on Vercel, then redeploy.')],
  [ENV, 'the base changed', t => swap(t, 'NEXT_PUBLIC_STUDIO_P2_POLISH="false"', 'NEXT_PUBLIC_STUDIO_P2_POLISH="true"')],
  [ENV, 'moved above the polish block', t => { const at = t.indexOf('# PASS3 MODEL CATALOG'); const end = t.indexOf(`\n${FLAG}="false"\n`) + `\n${FLAG}="false"\n`.length; const block = t.slice(at, end); const rest = t.slice(0, at) + t.slice(end); const polish = rest.indexOf('# PASS2 POLISH PP-1'); return rest.slice(0, polish) + block + '\n' + rest.slice(polish) }],
  [PKG, 'test registered to another file', t => swap(t, 'node scripts/test-studio-model-catalog.mjs', 'node scripts/test-studio-model-catalog-2026-10.mjs')],
  [PKG, 'test not registered', t => swap(t, '    "test:studio-model-catalog": "node scripts/test-studio-model-catalog.mjs",\n', '')],
  [PKG, 'a base script changed', t => swap(t, '"test:studio-p2-polish": "node scripts/test-studio-p2-polish.mjs"', '"test:studio-p2-polish": "node scripts/test-studio-p2-intelligence.mjs"')],
]
counting = false
const survivors = [], crashed = []
for (const [file, name, mutate] of MUTANTS) {
  const mutated = mutate(SOURCES[file])
  assert.notEqual(mutated, SOURCES[file], `mutant "${name}" changes ${file}`)
  let survived = false
  try {
    await proveAll({ ...SOURCES, [file]: mutated }, `mutant ${name}`, FIRST[file])
    survived = true
  } catch (error) {
    if (!(error instanceof assert.AssertionError)) crashed.push(`${name}: ${String(error?.message ?? error).split('\n')[0]}`)
  }
  if (survived) survivors.push(`${file}: ${name}`)
}
counting = true
assert.deepEqual(survivors, [], `mutants survived:\n${survivors.join('\n')}`)
console.log(`test-studio-model-catalog: ${checksBeforeMutants} checks, ${MUTANTS.length} mutants caught${crashed.length ? ` (${crashed.length} by a crash rather than an assertion: ${crashed.slice(0, 3).join(' | ')})` : ''}, ${hashes.length} identity hashes equal`)
