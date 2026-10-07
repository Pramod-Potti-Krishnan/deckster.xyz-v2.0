/**
 * J8.0 / R-20261007-frontend-22: fail-closed service URLs for the server proxies.
 *
 * Contract under test (DECKSTER_SERVICE_URL_FAIL_CLOSED_ENABLED, default off):
 *   1. Flag OFF is today's behaviour. For every proxy handler, the outgoing URL,
 *      method, headers and body, and the response status and body, are identical
 *      to the pre-change (uat) source across an env matrix. This is checked two
 *      ways: by hashing a transcript and comparing it with a golden hash recorded
 *      from the uat base, and (when git can read BASE_REF, default origin/uat)
 *      by running the SAME driver against the base source and comparing directly.
 *      The only permitted difference is one `[service-url]` warning line.
 *   2. Flag OFF + default actually used: exactly one warning per process per
 *      variable chain, names only (never a URL).
 *   3. Flag ON + variable unset: 503 `service_url_not_configured`, naming the
 *      variables, and NO outbound call. An invalid value is `service_url_invalid`.
 *   4. Flag ON + variable set: the same outgoing request as flag off with the
 *      same env.
 *
 * Run: node scripts/test-service-url-fail-closed.mjs
 *      BASE_REF=origin/uat node scripts/test-service-url-fail-closed.mjs   (direct base comparison)
 *      PRINT_GOLDEN=1 BASE_REF=origin/uat node scripts/test-service-url-fail-closed.mjs   (re-record golden from base)
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE_REF = process.env.BASE_REF || 'origin/uat'
const FLAG = 'DECKSTER_SERVICE_URL_FAIL_CLOSED_ENABLED'

// Recorded by running this driver against the uat base sources (BASE_REF=ee532fa, PRINT_GOLDEN=1).
const GOLDEN_FLAG_OFF_TRANSCRIPT_SHA256 = 'a4a4cfcbe6b7b9c61e7ef27eddf2a597f8b1e4061d955f61a60c5f70c7f09d63'

// ---------------------------------------------------------------------------
// Tiny module world: real sources, transpiled and run in one vm context, with
// process.env / console / fetch owned by the test.
// ---------------------------------------------------------------------------
const compiled = new Map()
function readSource(side, rel) {
  if (side === 'new') return fs.readFileSync(path.join(ROOT, rel), 'utf8')
  return execFileSync('git', ['show', `${BASE_REF}:${rel}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}
function compile(side, rel) {
  const key = `${side}:${rel}`
  if (!compiled.has(key)) {
    const source = readSource(side, rel)
    compiled.set(key, ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText)
  }
  return compiled.get(key)
}
function resolveSpec(side, spec) {
  const base = spec.replace(/^@\//, '')
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    try { readSource(side, candidate); return candidate } catch { /* try next */ }
  }
  throw new Error(`Cannot resolve ${spec} on side ${side}`)
}

const USER_SESSION = { user: { id: 'user-1', email: 'user-1@example.test' } }

function headersObject(headers) {
  if (!headers) return {}
  const entries = headers instanceof Headers ? [...headers.entries()] : Object.entries(headers)
  return Object.fromEntries(entries.map(([key, value]) => [key.toLowerCase(), String(value)]).sort(([a], [b]) => a.localeCompare(b)))
}
function describeBody(body) {
  if (body == null) return null
  if (typeof body === 'string') return body
  if (body instanceof FormData) return [...body.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : `file:${value.name}:${value.size}`])
  return String(body)
}

function makeWorld({ side, env = {}, session = USER_SESSION, fetchMode = 'ok' }) {
  const logs = []
  const calls = []
  const world = { side, logs, calls, session, process: { env: { ...env } } }
  const fmt = (...args) => args.map(arg => (arg instanceof Error ? arg.message : typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')
  const console = {
    warn: (...args) => logs.push(`warn ${fmt(...args)}`),
    error: (...args) => logs.push(`error ${fmt(...args)}`),
    log: (...args) => logs.push(`log ${fmt(...args)}`),
    info: (...args) => logs.push(`info ${fmt(...args)}`),
  }
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', headers: headersObject(init.headers), body: describeBody(init.body) })
    if (world.fetchMode === 'throw') throw new Error('connect refused (mock)')
    return new Response(JSON.stringify({
      ok: true, available: true, session_id: 'ks-1', store_name: 'store-1', file_uri: 'uri-1', file_name: 'a.txt',
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  world.fetchMode = fetchMode
  const context = vm.createContext({
    process: world.process, console, fetch, URL, URLSearchParams, Response, Request, Headers, FormData, Blob, File,
    Buffer, AbortSignal, DOMException, setTimeout, clearTimeout, TextEncoder, TextDecoder,
  })
  const prisma = {
    user: { findUnique: async () => ({ id: 'user-1', tier: 'pro' }) },
    chatSession: {
      findMany: async () => [{ id: 'chat-1', geminiStoreId: 'store-1' }],
      findUnique: async () => ({ userId: 'user-1', geminiStoreName: null, geminiStoreId: null }),
      update: async () => ({}),
    },
    uploadedFile: {
      count: async () => 0,
      create: async () => ({ id: 'file-1' }),
      update: async () => ({ id: 'file-1', fileName: 'a.txt', fileSize: 3, fileType: 'text/plain', geminiFileUri: 'uri-1', geminiFileName: 'a.txt', uploadedAt: '2026-01-01T00:00:00.000Z' }),
    },
  }
  const stubs = {
    'next/server': { NextResponse: Response, NextRequest: Request },
    'next-auth': { getServerSession: async () => world.session },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/stripe/stripe-utils': { getUserSubscription: async () => ({ status: 'active', tier: 'pro' }) },
    '@/lib/kg-entitlement': { isKgEntitled: () => true },
  }
  const modules = new Map()
  world.load = function load(rel) {
    if (modules.has(rel)) return modules.get(rel).exports
    const module = { exports: {} }
    modules.set(rel, module)
    const wrapper = vm.runInContext(`(function (module, exports, require) {${compile(side, rel)}\n})`, context)
    wrapper(module, module.exports, spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.startsWith('@/')) return world.load(resolveSpec(side, spec))
      throw new Error(`Unexpected import ${spec}`)
    })
    return module.exports
  }
  return world
}

function makeReq(method, url, body, extra = {}) {
  const request = new Request(`http://127.0.0.1${url}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    ...extra,
  })
  return Object.assign(request, { nextUrl: new URL(request.url) })
}
const asParams = value => ({ params: Promise.resolve(value) })
const plainParams = value => ({ params: value })

// ---------------------------------------------------------------------------
// Handler matrix: every server handler whose URL had a production/localhost default.
// ---------------------------------------------------------------------------
const CHAINS = {
  director: ['DIRECTOR_API_URL'],
  handoff: ['DIRECTOR_API_URL', 'NEXT_PUBLIC_DIRECTOR_API_URL'],
  composer: ['SLIDE_COMPOSER_DIRECTOR_URL', 'DIRECTOR_API_URL', 'NEXT_PUBLIC_DIRECTOR_API_URL'],
  kg: ['KNOWLEDGE_SERVICE_URL'],
  upload: ['NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL', 'KNOWLEDGE_SERVICE_URL'],
}

const H = (id, chain, file, fn, args, extraEnv = {}) => ({ id, chain, file, fn, args, extraEnv })
const uploadForm = () => {
  const form = new FormData()
  form.append('file', new File(['abc'], 'a.txt', { type: 'text/plain' }))
  form.append('sessionId', 'chat-1')
  form.append('userId', 'user-1')
  return form
}
const HANDLERS = [
  H('templates GET', 'director', 'app/api/templates/route.ts', 'GET', () => []),
  H('templates POST', 'director', 'app/api/templates/route.ts', 'POST', () => [makeReq('POST', '/api/templates', { name: 'T', source_session_id: 's1' })]),
  H('templates/[id] GET', 'director', 'app/api/templates/[id]/route.ts', 'GET', () => [makeReq('GET', '/api/templates/t1'), plainParams({ id: 't1' })]),
  H('templates/[id] DELETE', 'director', 'app/api/templates/[id]/route.ts', 'DELETE', () => [makeReq('DELETE', '/api/templates/t1'), plainParams({ id: 't1' })]),
  H('templates/[id]/blueprint PATCH', 'director', 'app/api/templates/[id]/blueprint/route.ts', 'PATCH', () => [makeReq('PATCH', '/api/templates/t1/blueprint', { slides: [] }), plainParams({ id: 't1' })]),
  H('templates/[id]/enrich POST', 'director', 'app/api/templates/[id]/enrich/route.ts', 'POST', () => [makeReq('POST', '/api/templates/t1/enrich'), asParams({ id: 't1' })]),
  H('themes GET', 'director', 'app/api/themes/route.ts', 'GET', () => []),
  H('themes POST', 'director', 'app/api/themes/route.ts', 'POST', () => [makeReq('POST', '/api/themes', { name: 'Th' })]),
  H('themes/[id] GET', 'director', 'app/api/themes/[id]/route.ts', 'GET', () => [makeReq('GET', '/api/themes/th1'), asParams({ id: 'th1' })]),
  H('themes/[id] PATCH', 'director', 'app/api/themes/[id]/route.ts', 'PATCH', () => [makeReq('PATCH', '/api/themes/th1', { name: 'New' }), asParams({ id: 'th1' })]),
  H('themes/[id] DELETE', 'director', 'app/api/themes/[id]/route.ts', 'DELETE', () => [makeReq('DELETE', '/api/themes/th1'), asParams({ id: 'th1' })]),
  H('themes/standard GET', 'director', 'app/api/themes/standard/route.ts', 'GET', () => []),
  H('themes/standard DELETE', 'director', 'app/api/themes/standard/route.ts', 'DELETE', () => []),
  H('themes/[id]/standard PUT', 'director', 'app/api/themes/[id]/standard/route.ts', 'PUT', () => [makeReq('PUT', '/api/themes/th1/standard'), asParams({ id: 'th1' })]),
  H('ingest-jobs/[jobId] GET', 'director', 'app/api/ingest-jobs/[jobId]/route.ts', 'GET', () => [makeReq('GET', '/api/ingest-jobs/j1'), plainParams({ jobId: 'j1' })]),
  H('director handoff POST', 'handoff', 'app/api/director/sessions/[sourceSessionId]/handoff/route.ts', 'POST',
    () => [makeReq('POST', '/api/director/sessions/src-1/handoff', { pending_request: 'Build it', idempotency_key: 'key-1' }), asParams({ sourceSessionId: 'src-1' })]),
  H('slides/compose POST', 'composer', 'app/api/slides/compose/route.ts', 'POST',
    () => [makeReq('POST', '/api/slides/compose', { slide: 1 })], { NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED: 'true' }),
  H('slides/compose POST (kg)', 'composer', 'app/api/slides/compose/route.ts', 'POST',
    () => [makeReq('POST', '/api/slides/compose', { slide: 1, research: { use_knowledge_graph: true } })], { NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED: 'true', KNOWLEDGE_API_KEY: 'unit-test-placeholder' }),
  H('slides/refine POST', 'composer', 'app/api/slides/refine/route.ts', 'POST',
    () => [makeReq('POST', '/api/slides/refine', { slide: 1 })], { NEXT_PUBLIC_SLIDE_REFINER_ENABLED: 'true' }),
  H('slides/jobs/[jobId] GET', 'composer', 'app/api/slides/jobs/[jobId]/route.ts', 'GET',
    () => [makeReq('GET', '/api/slides/jobs/job-1?session_id=s1&presentation_id=p1'), asParams({ jobId: 'job-1' })]),
  H('knowledge-graph/stats GET', 'kg', 'app/api/knowledge-graph/stats/route.ts', 'GET', () => []),
  H('knowledge-graph/graph GET', 'kg', 'app/api/knowledge-graph/graph/route.ts', 'GET', () => [makeReq('GET', '/api/knowledge-graph/graph?limit=5')]),
  H('knowledge-graph/nodes/[nodeId] GET', 'kg', 'app/api/knowledge-graph/nodes/[nodeId]/route.ts', 'GET', () => [makeReq('GET', '/api/knowledge-graph/nodes/n1'), asParams({ nodeId: 'n1' })]),
  H('knowledge-graph/search POST', 'kg', 'app/api/knowledge-graph/search/route.ts', 'POST', () => [makeReq('POST', '/api/knowledge-graph/search', { query: 'q' })]),
  H('knowledge-graph/subscribe POST', 'kg', 'app/api/knowledge-graph/subscribe/route.ts', 'POST', () => []),
  H('knowledge-graph/unsubscribe POST', 'kg', 'app/api/knowledge-graph/unsubscribe/route.ts', 'POST', () => []),
  H('knowledge-graph/purge DELETE', 'kg', 'app/api/knowledge-graph/purge/route.ts', 'DELETE', () => []),
  H('knowledge-graph/settings GET', 'kg', 'app/api/knowledge-graph/settings/route.ts', 'GET', () => []),
  H('knowledge-graph/backfill POST', 'kg', 'app/api/knowledge-graph/backfill/route.ts', 'POST', () => [makeReq('POST', '/api/knowledge-graph/backfill')]),
  H('upload POST', 'upload', 'app/api/upload/route.ts', 'POST', () => [makeReq('POST', '/api/upload', undefined, { body: uploadForm() })]),
]

const exampleUrl = name => `https://${name.toLowerCase().replace(/_/g, '-')}.example.test`
function scenariosFor(chain) {
  const names = CHAINS[chain]
  const scenarios = [{ id: 'unset', env: {} }]
  names.forEach(name => scenarios.push({ id: `only ${name}`, env: { [name]: exampleUrl(name) } }))
  scenarios.push({ id: 'all set', env: Object.fromEntries(names.map(name => [name, exampleUrl(name)])) })
  scenarios.push({ id: 'trailing slash', env: { [names[0]]: `${exampleUrl(names[0])}/` } })
  scenarios.push({ id: 'blank first', env: { [names[0]]: '   ', ...(names[1] ? { [names[1]]: exampleUrl(names[1]) } : {}) } })
  if (names[1]) scenarios.push({ id: 'empty first', env: { [names[0]]: '', [names[1]]: exampleUrl(names[1]) } })
  scenarios.push({ id: `fetch throws (${names[0]} set)`, env: { [names[0]]: exampleUrl(names[0]) }, fetchMode: 'throw' })
  return scenarios
}

async function run(side, handler, scenario, { flag = false, session } = {}) {
  const env = { ...handler.extraEnv, ...scenario.env, ...(flag ? { [FLAG]: 'true' } : {}) }
  const world = makeWorld({ side, env, session, fetchMode: scenario.fetchMode ?? 'ok' })
  const route = world.load(handler.file)
  const response = await route[handler.fn](...handler.args())
  return {
    world,
    entry: {
      calls: world.calls,
      response: { status: response.status, body: await response.text() },
      // Everything the handler logs except the one new J8.0 warning line.
      logs: world.logs.filter(line => !line.includes('[service-url]')),
    },
    warnings: world.logs.filter(line => line.includes('[service-url]')),
  }
}

const sha256 = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const failures = []
let checks = 0
const check = (name, fn) => {
  checks += 1
  return Promise.resolve().then(fn).catch(error => { failures.push(`${name}\n    ${String(error.message).split('\n').slice(0, 6).join('\n    ')}`) })
}

// ---------------------------------------------------------------------------
// 1. Flag OFF is identical to the base, request for request.
// ---------------------------------------------------------------------------
async function transcript(side) {
  const out = []
  for (const handler of HANDLERS) {
    for (const scenario of scenariosFor(handler.chain)) {
      const { entry } = await run(side, handler, scenario)
      out.push({ handler: handler.id, scenario: scenario.id, ...entry })
    }
  }
  return out
}

const newTranscript = await transcript('new')
const newHash = sha256(newTranscript)

let baseReadable = true
try { readSource('base', 'app/api/templates/route.ts') } catch { baseReadable = false }

if (process.env.PRINT_GOLDEN) {
  const base = await transcript('base')
  console.log(`GOLDEN ${sha256(base)} (${base.length} request transcripts)`)
  process.exit(0)
}

await check(`flag off: ${newTranscript.length} request transcripts match the recorded uat golden hash`, () => {
  assert.equal(newHash, GOLDEN_FLAG_OFF_TRANSCRIPT_SHA256)
})
if (baseReadable) {
  await check(`flag off: identical to the ${BASE_REF} source, request for request (direct comparison)`, async () => {
    const base = await transcript('base')
    assert.equal(newTranscript.length, base.length)
    newTranscript.forEach((entry, index) => assert.deepEqual(entry, base[index], `${entry.handler} / ${entry.scenario}`))
    assert.equal(sha256(base), GOLDEN_FLAG_OFF_TRANSCRIPT_SHA256, 'golden hash is stale against the base')
  })
} else {
  console.log(`note: ${BASE_REF} is not readable here; direct base comparison skipped (golden hash still enforced)`)
}

// The transcript must actually exercise the legacy defaults, or identity proves little.
await check('flag off: the unset scenarios really hit the built-in production/localhost defaults', () => {
  const unsetCalls = newTranscript.filter(entry => entry.scenario === 'unset').flatMap(entry => entry.calls)
  assert.ok(unsetCalls.length >= HANDLERS.length, 'every handler made an outbound call in the unset scenario')
  const hosts = new Set(unsetCalls.map(call => new URL(call.url).host))
  assert.deepEqual([...hosts].sort(), ['directorv33-production.up.railway.app', 'localhost:8000', 'researcher-v1.up.railway.app'])
})

// ---------------------------------------------------------------------------
// 2. Flag OFF: one warning per process per variable chain, names only.
// ---------------------------------------------------------------------------
await check('flag off + default used: one warning per process per variable chain (names only)', async () => {
  const world = makeWorld({ side: 'new', env: { NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED: 'true' } })
  const templates = world.load('app/api/templates/route.ts')
  const themes = world.load('app/api/themes/route.ts')
  const compose = world.load('app/api/slides/compose/route.ts')
  const kgStats = world.load('app/api/knowledge-graph/stats/route.ts')
  const warnings = () => world.logs.filter(line => line.startsWith('warn') && line.includes('[service-url]'))
  assert.equal(warnings().length, 0, 'loading a route logs nothing')
  await templates.GET(); await templates.GET()
  assert.equal(warnings().length, 1, 'two requests, one warning')
  await themes.GET()
  assert.equal(warnings().length, 1, 'the same variable chain across other routes does not warn again')
  await compose.POST(makeReq('POST', '/api/slides/compose', { slide: 1 })); await compose.POST(makeReq('POST', '/api/slides/compose', { slide: 1 }))
  assert.equal(warnings().length, 2, 'a different chain (localhost default) warns once')
  await kgStats.GET()
  assert.equal(warnings().length, 3)
  assert.match(warnings()[0], /DIRECTOR_API_URL/)
  assert.match(warnings()[0], /production default/)
  assert.match(warnings()[1], /SLIDE_COMPOSER_DIRECTOR_URL \/ DIRECTOR_API_URL \/ NEXT_PUBLIC_DIRECTOR_API_URL/)
  assert.match(warnings()[1], /localhost default/)
  assert.match(warnings()[2], /KNOWLEDGE_SERVICE_URL/)
  for (const line of warnings()) assert.doesNotMatch(line, /https?:\/\/|railway|localhost:|\.app/, 'a warning never carries a URL')
})
await check('flag off + variable set: no warning at all', async () => {
  const { warnings } = await run('new', HANDLERS[0], { env: { DIRECTOR_API_URL: exampleUrl('DIRECTOR_API_URL') } })
  assert.deepEqual(warnings, [])
})

// ---------------------------------------------------------------------------
// 3 + 4. Flag ON.
// ---------------------------------------------------------------------------
for (const handler of HANDLERS) {
  const names = CHAINS[handler.chain]
  await check(`flag on + unset: ${handler.id} fails closed with 503 service_url_not_configured and no outbound call`, async () => {
    const { entry, warnings } = await run('new', handler, { env: {} }, { flag: true })
    assert.equal(entry.response.status, 503)
    const body = JSON.parse(entry.response.body)
    assert.equal(body.error, 'service_url_not_configured')
    assert.equal(body.code, 'SERVICE_URL_NOT_CONFIGURED')
    assert.deepEqual(body.variables, names)
    assert.equal(entry.calls.length, 0, 'no outbound call')
    assert.doesNotMatch(entry.response.body, /railway\.app|localhost:8000|https?:\/\//, 'the response names variables, never URLs')
    assert.deepEqual(warnings, [], 'flag on never logs a fallback warning')
  })
  await check(`flag on + invalid value: ${handler.id} fails closed with service_url_invalid`, async () => {
    const { entry } = await run('new', handler, { env: { [names[0]]: 'not-a-url' } }, { flag: true })
    assert.equal(entry.response.status, 503)
    assert.equal(JSON.parse(entry.response.body).error, 'service_url_invalid')
    assert.equal(entry.calls.length, 0)
  })
  for (const scenario of scenariosFor(handler.chain).filter(s => s.id.startsWith('only ') || s.id === 'all set' || s.id.startsWith('fetch throws'))) {
    await check(`flag on + set (${scenario.id}): ${handler.id} sends the same request and response as flag off`, async () => {
      const off = await run('new', handler, scenario)
      const on = await run('new', handler, scenario, { flag: true })
      assert.deepEqual(on.entry, off.entry)
      assert.deepEqual(on.warnings, [])
    })
  }
  await check(`flag on + trailing slash: ${handler.id} uses the env URL without a doubled slash`, async () => {
    const { entry } = await run('new', handler, { env: { [names[0]]: `${exampleUrl(names[0])}/` } }, { flag: true })
    assert.ok(entry.calls.length > 0)
    for (const call of entry.calls) assert.ok(call.url.startsWith(`${exampleUrl(names[0])}/`) && !call.url.includes('.test//'), call.url)
  })
}

await check('flag on + alias chain: the first non-blank candidate wins and later aliases are not consulted', async () => {
  const composer = HANDLERS.find(h => h.id === 'slides/refine POST')
  const env = { SLIDE_COMPOSER_DIRECTOR_URL: '', DIRECTOR_API_URL: '  ', NEXT_PUBLIC_DIRECTOR_API_URL: exampleUrl('NEXT_PUBLIC_DIRECTOR_API_URL') }
  const { entry } = await run('new', composer, { env }, { flag: true })
  assert.ok(entry.calls[0].url.startsWith(exampleUrl('NEXT_PUBLIC_DIRECTOR_API_URL')))
})
await check('flag on: auth still comes first (unauthenticated + unset is 401, not 503)', async () => {
  for (const id of ['templates GET', 'themes POST', 'slides/jobs/[jobId] GET', 'ingest-jobs/[jobId] GET']) {
    const handler = HANDLERS.find(h => h.id === id)
    const { entry } = await run('new', handler, { env: {} }, { flag: true, session: null })
    assert.equal(entry.response.status, 401, id)
    assert.equal(entry.calls.length, 0)
  }
})
await check('flag on: module load never throws or warns (next build safe) even with every variable unset', () => {
  for (const handler of HANDLERS) {
    const world = makeWorld({ side: 'new', env: { [FLAG]: 'true' } })
    world.load(handler.file)
    assert.deepEqual(world.logs.filter(line => line.includes('[service-url]')), [], handler.file)
  }
})
await check('the flag is on only for the exact string "true"', () => {
  for (const [value, expected] of [['true', true], ['TRUE', false], ['1', false], ['', false], [undefined, false], ['false', false]]) {
    const world = makeWorld({ side: 'new', env: value === undefined ? {} : { [FLAG]: value } })
    assert.equal(world.load('lib/server-service-url.ts').isServiceUrlFailClosedEnabled(), expected, String(value))
  }
})

// ---------------------------------------------------------------------------
// Narration (server routes that use the NEXT_PUBLIC Layout URL constant) and publish.
// ---------------------------------------------------------------------------
await check('layout guard: flag off is a no-op (one warning when unset); flag on + unset is 503; flag on + set is a no-op', () => {
  const off = makeWorld({ side: 'new', env: {} })
  const offGuard = off.load('lib/service-url-response.ts').layoutServiceGuardResponse
  assert.equal(offGuard(), null); assert.equal(offGuard(), null)
  assert.equal(off.logs.filter(line => line.includes('[service-url]')).length, 1)
  assert.match(off.logs[0], /NEXT_PUBLIC_LAYOUT_SERVICE_URL/)

  const set = makeWorld({ side: 'new', env: { NEXT_PUBLIC_LAYOUT_SERVICE_URL: exampleUrl('layout') } })
  assert.equal(set.load('lib/service-url-response.ts').layoutServiceGuardResponse(), null)
  assert.deepEqual(set.logs, [])

  const on = makeWorld({ side: 'new', env: { [FLAG]: 'true' } })
  const response = on.load('lib/service-url-response.ts').layoutServiceGuardResponse()
  assert.equal(response.status, 503)
  const onSet = makeWorld({ side: 'new', env: { [FLAG]: 'true', NEXT_PUBLIC_LAYOUT_SERVICE_URL: exampleUrl('layout') } })
  assert.equal(onSet.load('lib/service-url-response.ts').layoutServiceGuardResponse(), null)
})
await check('narration routes call the layout guard before the first getPresentation()', () => {
  for (const file of ['manifest', 'render', 'script']) {
    const source = fs.readFileSync(path.join(ROOT, `app/api/narration/${file}/route.ts`), 'utf8')
    const guard = source.indexOf('layoutServiceGuardResponse()')
    const call = source.indexOf('await getPresentation(')
    assert.ok(guard > 0 && call > 0 && guard < call, file)
  }
})

function publishProbe(side, env) {
  const world = makeWorld({ side, env })
  const urls = world.load('lib/publish/service-urls.ts')
  const result = {}
  for (const [name, fn] of [['layout', urls.getLayoutServiceBaseUrl], ['publicLayout', urls.getPublicLayoutBaseUrl], ['download', urls.getDownloadServiceUrl], ['researcher', urls.getResearcherBaseUrl]]) {
    try { result[name] = fn() } catch (error) { result[name] = `${error.name}: ${error.message}` }
  }
  return { result, warnings: world.logs.filter(line => line.includes('[service-url]')) }
}
const PUBLISH_ENVS = [
  {},
  { NEXT_PUBLIC_APP_URL: 'https://deckster.xyz' },
  { NEXT_PUBLIC_APP_URL: 'https://uat.example.test' },
  { NEXT_PUBLIC_APP_URL: 'https://uat.example.test', LAYOUT_SERVICE_URL: 'https://layout.example.test/', NEXT_PUBLIC_DOWNLOAD_SERVICE_URL: 'https://dl.example.test', RESEARCHER_SERVICE_URL: 'https://res.example.test' },
  { LAYOUT_SERVICE_URL: ' https://layout.example.test ', KNOWLEDGE_SERVICE_URL: 'https://kg.example.test/' },
]
await check('publish service urls: flag off is identical to the base (production fallback, non-production guard, trimming)', () => {
  const rows = PUBLISH_ENVS.map(env => publishProbe('new', env).result)
  assert.equal(rows[0].layout, 'https://web-production-f0d13.up.railway.app')
  assert.match(rows[2].layout, /^PublishServiceConfigError: .*Refusing to fall back to the production service from a non-production deployment\.$/)
  if (baseReadable) {
    PUBLISH_ENVS.forEach((env, index) => assert.deepEqual(rows[index], publishProbe('base', env).result, JSON.stringify(Object.keys(env))))
  }
})
await check('publish service urls: flag off warns once per process when the production default is used, never otherwise', () => {
  const world = makeWorld({ side: 'new', env: {} })
  const urls = world.load('lib/publish/service-urls.ts')
  urls.getLayoutServiceBaseUrl(); urls.getLayoutServiceBaseUrl(); urls.getDownloadServiceUrl()
  const warnings = world.logs.filter(line => line.includes('[service-url]'))
  assert.equal(warnings.length, 2)
  assert.doesNotMatch(warnings.join('\n'), /https?:\/\//)
  assert.deepEqual(publishProbe('new', PUBLISH_ENVS[2]).warnings, [], 'a refused non-production resolve is not a fallback')
  assert.deepEqual(publishProbe('new', PUBLISH_ENVS[3]).warnings, [])
})
await check('publish service urls: flag on removes the production fallback, even for a production deployment', () => {
  for (const env of [{}, { NEXT_PUBLIC_APP_URL: 'https://deckster.xyz' }, { NEXT_PUBLIC_APP_URL: 'https://uat.example.test' }]) {
    const { result, warnings } = publishProbe('new', { ...env, [FLAG]: 'true' })
    for (const value of Object.values(result)) assert.match(value, /^PublishServiceConfigError: .*no fallback to a built-in production service\.$/)
    assert.deepEqual(warnings, [])
  }
  const set = publishProbe('new', { [FLAG]: 'true', LAYOUT_SERVICE_URL: 'https://layout.example.test/', NEXT_PUBLIC_DOWNLOAD_SERVICE_URL: 'https://dl.example.test', NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://public-layout.example.test', KNOWLEDGE_SERVICE_URL: 'https://kg.example.test' }).result
  assert.deepEqual(set, { layout: 'https://layout.example.test', publicLayout: 'https://public-layout.example.test', download: 'https://dl.example.test', researcher: 'https://kg.example.test' })
})

// ---------------------------------------------------------------------------
// Copy of the Studio helper keeps the Studio semantics.
// ---------------------------------------------------------------------------
await check('requireServiceUrl keeps the Studio semantics (missing, blank, invalid, credentials, trailing slash, no cross-alias fallthrough)', () => {
  const { requireServiceUrl, inspectServiceUrl, ServiceUrlConfigError } = makeWorld({ side: 'new' }).load('lib/service-url.ts')
  const c = (name, value) => ({ name, value })
  assert.throws(() => requireServiceUrl('X', [c('A', undefined), c('B', '  ')]), error => error instanceof ServiceUrlConfigError && error.code === 'SERVICE_URL_NOT_CONFIGURED' && /A or B/.test(error.message))
  assert.equal(requireServiceUrl('X', [c('A', ''), c('B', 'https://b.example.test/')], { stripTrailingSlash: true }), 'https://b.example.test')
  assert.equal(requireServiceUrl('X', [c('A', 'https://a.example.test'), c('B', 'https://b.example.test')]), 'https://a.example.test')
  for (const bad of ['a.example.test', 'https:a.example.test', 'ftp://a.example.test', 'https://u:p@a.example.test', 'https://a.example.test?x=1', 'https://a.example.test#f', 'https://a b.example.test', 'https:\\\\a.example.test']) {
    assert.throws(() => requireServiceUrl('X', [c('A', bad), c('B', 'https://b.example.test')]), error => error.code === 'SERVICE_URL_INVALID', bad)
  }
  assert.equal(inspectServiceUrl('X', [c('A', undefined)]).url, null)
  assert.equal(requireServiceUrl('X', [c('A', 'http://127.0.0.1:9')]), 'http://127.0.0.1:9')
})

// ---------------------------------------------------------------------------
// No proxy keeps a production/localhost literal or a module-load URL read.
// ---------------------------------------------------------------------------
await check('proxy sources no longer carry a built-in production or localhost URL or a module-load URL read', () => {
  const files = [...new Set([...HANDLERS.map(h => h.file), 'lib/kg-proxy.ts', 'lib/knowledge-service-client.ts'])]
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.doesNotMatch(source, /railway\.app|localhost:8000|process\.env\.(DIRECTOR_API_URL|SLIDE_COMPOSER_DIRECTOR_URL|KNOWLEDGE_SERVICE_URL)/, file)
    assert.doesNotMatch(source, /^(export )?const (DIRECTOR_API_URL|DEFAULT_DIRECTOR_URL|KG_BASE|BASE_URL)\b/m, file)
  }
})

// ---------------------------------------------------------------------------
// Build-time check script (not wired into the build).
// ---------------------------------------------------------------------------
const CHECK_SCRIPT = path.join(ROOT, 'scripts/check-public-service-urls.mjs')
function runCheck(args, env = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CHECK_SCRIPT, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, stdout }
  } catch (error) {
    return { code: error.status, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? '') }
  }
}
const CHECK_LIST = execFileSync(process.execPath, [CHECK_SCRIPT, '--list'], { env: {}, encoding: 'utf8' })
  .trim().split('\n').map(line => { const [name, scope, defaultHost] = line.split('\t'); return { name, scope, defaultHost } })
const allSet = Object.fromEntries(CHECK_LIST.map(({ name }) => [name, `https://${name.toLowerCase().replace(/_/g, '-')}.example.test`]))

await check('check script: strict env with every variable unset exits 1 and names them, without printing any value', () => {
  const result = runCheck(['--env', 'uat'])
  assert.equal(result.code, 1)
  for (const { name, scope } of CHECK_LIST.filter(v => v.name !== 'NEXT_PUBLIC_API_URL')) assert.match(result.stdout, new RegExp(`FAIL +${name}\\b`), `${name} (${scope})`)
  assert.match(result.stdout, /warn +NEXT_PUBLIC_API_URL/)
})
await check('check script: strict env with every variable set exits 0 and never echoes a configured value', () => {
  for (const target of ['uat', 'prod']) {
    const result = runCheck(['--env', target], allSet)
    assert.equal(result.code, 0, result.stdout)
    assert.doesNotMatch(result.stdout, /example\.test/)
    assert.match(result.stdout, /every checked variable is explicitly set/)
  }
})
await check('check script: --env uat fails a variable set to the production default host; --env prod accepts it', () => {
  const env = { ...allSet, NEXT_PUBLIC_WS_URL: 'wss://directorv33-production.up.railway.app/ws' }
  const uat = runCheck(['--env', 'uat'], env)
  assert.equal(uat.code, 1)
  assert.match(uat.stdout, /FAIL +NEXT_PUBLIC_WS_URL +browser +SET TO THE PRODUCTION DEFAULT HOST/)
  assert.equal(runCheck(['--env', 'prod'], env).code, 0)
})
await check('check script: VERCEL_ENV preview/production is strict, development/unset/--env local is report-only, bad --env is a usage error', () => {
  assert.equal(runCheck([], { VERCEL_ENV: 'production' }).code, 1)
  assert.equal(runCheck([], { VERCEL_ENV: 'preview' }).code, 1)
  assert.equal(runCheck([], { VERCEL_ENV: 'development' }).code, 0)
  assert.equal(runCheck([]).code, 0)
  assert.equal(runCheck(['--env', 'local'], { VERCEL_ENV: 'production' }).code, 0, '--env wins over VERCEL_ENV')
  assert.equal(runCheck(['--env', 'uat'], { ...allSet, VERCEL_ENV: 'development' }).code, 0)
  assert.equal(runCheck(['--env', 'staging']).code, 2)
  assert.equal(runCheck(['--nope']).code, 2)
  const noServer = runCheck(['--env', 'uat', '--no-server'], Object.fromEntries(Object.entries(allSet).filter(([name]) => !['DIRECTOR_API_URL', 'KNOWLEDGE_SERVICE_URL'].includes(name))))
  assert.equal(noServer.code, 0)
})
await check('check script: --json is machine readable', () => {
  const result = runCheck(['--env', 'uat', '--json'], allSet)
  const parsed = JSON.parse(result.stdout)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.variables.length, CHECK_LIST.length)
})

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(rel, out)
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel)
  }
  return out
}
await check('check script stays in step with the code: every listed variable and default host is still in the source, and no new NEXT_PUBLIC_ production default is missing from the list', () => {
  const files = ['app', 'components', 'hooks', 'lib', 'contexts'].flatMap(dir => sourceFiles(dir))
  const text = files.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n')
  for (const { name, defaultHost } of CHECK_LIST) {
    assert.ok(text.includes(`process.env.${name}`) || text.includes(`'${name}'`), `${name} no longer read anywhere`)
    assert.ok(text.includes(defaultHost), `${defaultHost} (default of ${name}) no longer in the source`)
  }
  const listed = new Set(CHECK_LIST.map(({ name }) => name))
  const withDefault = /process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)(?:\s*(?:\|\||\?\?)\s*process\.env\.[A-Z0-9_]+)*\s*(?:\|\||\?\?)\s*['"`](?:https?|wss?):\/\//g
  const found = new Set([...text.matchAll(withDefault)].map(match => match[1]))
  for (const name of found) assert.ok(listed.has(name), `${name} has a production default in the source but is missing from scripts/check-public-service-urls.mjs`)
})

console.log(`${checks - failures.length}/${checks} service-url checks passed (${newTranscript.length} flag-off request transcripts, hash ${newHash.slice(0, 12)})`)
if (failures.length) {
  console.error(`\n${failures.length} FAILED:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
