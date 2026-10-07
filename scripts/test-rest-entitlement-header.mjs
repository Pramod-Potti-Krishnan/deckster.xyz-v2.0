/**
 * R-20261007-e2e-deck-17: the Next proxies sign Director user-scoped REST calls
 * (lib/director-rest-entitlement.ts; contract
 * streams/e2e-deck/contracts/F-rest-entitlement.md v1).
 *
 * Offline and keyless: every secret below is a throwaway string defined in this
 * file, `fetch` is a stub, and the 13 proxy route files run unchanged against
 * stubbed auth. The verifier below is written from the contract text and does
 * not import the minter.
 *
 * Optional proof mode: REST_ENTITLEMENT_BASE_ROOT=<checkout of the base commit>
 * also replays every proxy call against that checkout's routes with the flag
 * off and requires the outgoing request to be identical, then prints a SHA-256
 * of both runs.
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const D = 'http://director.test'
const FLAG = 'DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED'
const SECRET_ENV = 'DIRECTOR_WS_AUTH_SECRET'
const HEADER = 'x-deckster-entitlement'
const FIXTURE_SECRET = 'rest-entitlement-fixture-secret-not-real'
const CLOCK_START = 1790000000

// ---------------------------------------------------------------- loading
const read = rel => fs.readFileSync(path.join(REPO, rel), 'utf8')

function compile(root, relative, context, imports) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    URL,
    URLSearchParams,
    Buffer,
    Response,
    console,
    require: name => {
      if (!(name in imports)) throw new Error(`Unexpected import ${name} from ${relative}`)
      return imports[name]
    },
    ...context,
  })
  return module.exports
}

// One shared environment and clock for the helper and every route.
const env = {}
let clockMs = CLOCK_START * 1000
const clock = { now: () => clockMs }
const setClock = seconds => { clockMs = seconds * 1000 }

function loadHelper(root) {
  return compile(root, 'lib/director-rest-entitlement.ts', { process: { env }, Date: clock }, { crypto })
}

// ------------------------------------------------- independent verifier
// Written from F-rest-entitlement.md sections 1 and 2; imports nothing from the minter.
function verifyRestHeader(header, secret, { method, sub, now }) {
  const fail = why => ({ ok: false, why })
  if (typeof header !== 'string') return fail('not a string')
  if (Buffer.byteLength(header, 'utf8') > 4096) return fail('over 4096 bytes')
  const parts = header.split('.')
  if (parts.length !== 2) return fail('not exactly payload.signature')
  const [payloadB64, sigB64] = parts
  if (!/^[A-Za-z0-9_-]+$/.test(payloadB64) || !/^[A-Za-z0-9_-]+$/.test(sigB64)) return fail('not base64url without padding')
  const expected = crypto.createHmac('sha256', secret).update('deckster-rest-v1.' + payloadB64, 'ascii').digest()
  const got = Buffer.from(sigB64, 'base64url')
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return fail('bad signature')
  let claims
  try { claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) } catch { return fail('payload is not JSON') }
  if (claims.v !== 1) return fail('v')
  if (claims.typ !== 'rest') return fail('typ')
  if ('sid' in claims) return fail('sid present')
  if (typeof claims.sub !== 'string' || claims.sub === '') return fail('sub')
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)) return fail('iat/exp not integers')
  if (claims.exp - claims.iat > 120) return fail('lifetime over 120 s')
  if (claims.iat > now + 60) return fail('iat more than 60 s in the future')
  if (claims.exp <= now) return fail('expired')
  if (claims.m !== method) return fail('method mismatch')
  if (sub !== undefined && claims.sub !== sub) return fail('sub mismatch')
  return { ok: true, claims }
}

// --------------------------------------------- 1. helper: known answers
const rawHelper = loadHelper(REPO)
// The helper runs in its own vm realm; compare its plain objects across realms by value.
const plain = value => JSON.parse(JSON.stringify(value))
const helper = rawHelper
const { mintRestEntitlement, isRestEntitlementHeaderEnabled } = rawHelper
const restEntitlementHeaders = (...args) => plain(rawHelper.restEntitlementHeaders(...args))
assert.equal(helper.REST_ENTITLEMENT_HEADER, 'X-Deckster-Entitlement')
assert.equal(helper.REST_ENTITLEMENT_TTL_SECONDS, 120)

// Known-answer vectors computed outside this code base (Python hmac/base64 from
// the contract text, secret FIXTURE_SECRET). Replaced by / joined with the
// Director's golden vector once the contract directory carries it.
const KAT = [
  {
    input: { sub: 'user-123', method: 'GET' },
    payload: '{"v":1,"typ":"rest","sub":"user-123","iat":1790000000,"exp":1790000120,"m":"GET"}',
    header:
      'eyJ2IjoxLCJ0eXAiOiJyZXN0Iiwic3ViIjoidXNlci0xMjMiLCJpYXQiOjE3OTAwMDAwMDAsImV4cCI6MTc5MDAwMDEyMCwibSI6IkdFVCJ9.fy-SB4vfXveUAQel0FseuDv3jPrny0tA2K8db9a9FBA',
  },
  {
    input: { sub: 'pat+qa@example.test', method: 'delete', bq: { v: 1, ok: true, r: null, tier: 'pro', reset: null } },
    payload:
      '{"v":1,"typ":"rest","sub":"pat+qa@example.test","iat":1790000000,"exp":1790000120,"m":"DELETE","bq":{"v":1,"ok":true,"r":null,"tier":"pro","reset":null}}',
    header:
      'eyJ2IjoxLCJ0eXAiOiJyZXN0Iiwic3ViIjoicGF0K3FhQGV4YW1wbGUudGVzdCIsImlhdCI6MTc5MDAwMDAwMCwiZXhwIjoxNzkwMDAwMTIwLCJtIjoiREVMRVRFIiwiYnEiOnsidiI6MSwib2siOnRydWUsInIiOm51bGwsInRpZXIiOiJwcm8iLCJyZXNldCI6bnVsbH19.7thdkLXoBkV9cPRTa05AIh_hzfDfghYbCrX6str_mbk',
  },
]
env[SECRET_ENV] = FIXTURE_SECRET
for (const k of KAT) {
  assert.equal(mintRestEntitlement({ ...k.input, nowSeconds: CLOCK_START }), k.header, 'minter reproduces the known answer byte for byte')
  assert.equal(Buffer.from(k.header.split('.')[0], 'base64url').toString('utf8'), k.payload)
  assert.equal(verifyRestHeader(k.header, FIXTURE_SECRET, { method: k.input.method.toUpperCase(), sub: k.input.sub, now: CLOCK_START }).ok, true)
}
// A WS-style signature (over the bare payload) must not verify as REST.
{
  const [p] = KAT[0].header.split('.')
  const wsSig = crypto.createHmac('sha256', FIXTURE_SECRET).update(p).digest('base64url')
  assert.equal(wsSig, 'TqegTey7DBLDyh7sKhXV-JxmmeqjEYPTKmTU4CGjXks')
  assert.notEqual(wsSig, KAT[0].header.split('.')[1])
  assert.equal(verifyRestHeader(`${p}.${wsSig}`, FIXTURE_SECRET, { method: 'GET', now: CLOCK_START }).why, 'bad signature')
}

// The verifier itself rejects what the Director rejects (so passing it means something).
{
  const sign = (claims, secret = FIXTURE_SECRET, domain = 'deckster-rest-v1.') => {
    const p = Buffer.from(JSON.stringify(claims)).toString('base64url')
    return `${p}.${crypto.createHmac('sha256', secret).update(domain + p).digest('base64url')}`
  }
  const good = { v: 1, typ: 'rest', sub: 'u', iat: CLOCK_START, exp: CLOCK_START + 120, m: 'GET' }
  const check = (claims, why, opts = {}) => assert.equal(
    verifyRestHeader(sign(claims, opts.secret, opts.domain), FIXTURE_SECRET, { method: 'GET', now: CLOCK_START, ...opts.ctx }).why, why)
  assert.equal(verifyRestHeader(sign(good), FIXTURE_SECRET, { method: 'GET', now: CLOCK_START }).ok, true)
  check({ ...good, typ: 'svc' }, 'typ')
  check({ ...good, sid: 's' }, 'sid present')
  check({ ...good, exp: CLOCK_START + 121 }, 'lifetime over 120 s')
  check({ ...good, sub: '' }, 'sub')
  check({ ...good, m: 'POST' }, 'method mismatch')
  check(good, 'expired', { ctx: { now: CLOCK_START + 120 } })
  check({ ...good, iat: CLOCK_START + 61, exp: CLOCK_START + 150 }, 'iat more than 60 s in the future')
  check(good, 'bad signature', { secret: 'another-secret' })
  check(good, 'bad signature', { domain: '' })
}

// -------------------------------------------- 2. helper: off / unset / edge
{
  const fresh = () => { delete env[FLAG]; env[SECRET_ENV] = FIXTURE_SECRET }
  fresh()
  assert.equal(isRestEntitlementHeaderEnabled(), false)
  assert.deepEqual(restEntitlementHeaders('u', 'GET'), {}, 'flag unset: no header')
  for (const value of ['', 'false', '0', '1', 'TRUE', 'True', ' true', 'true ', 'yes', 'on']) {
    env[FLAG] = value
    assert.deepEqual(restEntitlementHeaders('u', 'GET'), {}, `flag "${value}" is not the exact string true`)
  }
  env[FLAG] = 'true'
  assert.equal(isRestEntitlementHeaderEnabled(), true)
  setClock(CLOCK_START)
  assert.deepEqual(restEntitlementHeaders('user-123', 'GET'), { 'X-Deckster-Entitlement': KAT[0].header })
  // secret unset or empty: no header, no throw
  delete env[SECRET_ENV]
  assert.deepEqual(restEntitlementHeaders('u', 'GET'), {})
  assert.equal(mintRestEntitlement({ sub: 'u', method: 'GET' }), null)
  env[SECRET_ENV] = ''
  assert.deepEqual(restEntitlementHeaders('u', 'GET'), {})
  env[SECRET_ENV] = FIXTURE_SECRET
  // unusable input: no header, no throw
  for (const [sub, method] of [['', 'GET'], [undefined, 'GET'], [null, 'GET'], ['u', ''], ['u', undefined]]) {
    assert.deepEqual(restEntitlementHeaders(sub, method), {})
    assert.equal(mintRestEntitlement({ sub, method }), null)
  }
  // over the 4096-byte cap: no header rather than one the Director must refuse
  assert.deepEqual(restEntitlementHeaders('x'.repeat(4000), 'GET'), {})
  assert.ok(restEntitlementHeaders('x'.repeat(2000), 'GET')['X-Deckster-Entitlement'])
  // never a sid; exp - iat is exactly 120; iat is "now"
  setClock(CLOCK_START + 7)
  const claims = verifyRestHeader(restEntitlementHeaders('u', 'PUT')['X-Deckster-Entitlement'], FIXTURE_SECRET, { method: 'PUT', sub: 'u', now: CLOCK_START + 7 }).claims
  assert.equal(claims.iat, CLOCK_START + 7)
  assert.equal(claims.exp - claims.iat, 120)
  assert.equal('sid' in claims, false)
  assert.equal('bq' in claims, false)
  assert.deepEqual(Object.keys(claims), ['v', 'typ', 'sub', 'iat', 'exp', 'm'])
  // bq travels only when the caller passes one
  const withBq = verifyRestHeader(
    restEntitlementHeaders('u', 'POST', { v: 1, ok: false, r: 'daily_limit', tier: 'free', reset: '2026-10-08T04:00:00.000Z' })['X-Deckster-Entitlement'],
    FIXTURE_SECRET, { method: 'POST', sub: 'u', now: CLOCK_START + 7 })
  assert.deepEqual(withBq.claims.bq, { v: 1, ok: false, r: 'daily_limit', tier: 'free', reset: '2026-10-08T04:00:00.000Z' })
  // minted per request: a later call at a later second is a different header; different users differ
  const first = restEntitlementHeaders('u', 'GET')['X-Deckster-Entitlement']
  setClock(CLOCK_START + 8)
  assert.notEqual(restEntitlementHeaders('u', 'GET')['X-Deckster-Entitlement'], first)
  assert.notEqual(restEntitlementHeaders('other', 'GET')['X-Deckster-Entitlement'], restEntitlementHeaders('u', 'GET')['X-Deckster-Entitlement'])
  delete env[FLAG]
}

// ----------------------------------------------- 3. the 13 proxy routes
const state = { identity: null, kgDenied: false, calls: [] }
const stubFetch = async (url, init) => {
  state.calls.push({ url: String(url), init })
  return Response.json({ ok: true, echo: 'director-body' }, { status: 200 })
}
function routeImports(root, helperModule) {
  const imports = {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => state.identity },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/kg-proxy': {
      kgHeaders: extra => ({ ...extra, ...(env.KNOWLEDGE_API_KEY ? { 'X-API-Key': env.KNOWLEDGE_API_KEY } : {}) }),
      requireKgEntitled: async () => (state.kgDenied
        ? { error: Response.json({ error: 'denied' }, { status: 403 }) }
        : { userId: state.identity?.user?.id }),
    },
  }
  if (helperModule) imports['@/lib/director-rest-entitlement'] = helperModule
  if (fs.existsSync(path.join(root, 'lib/service-url.ts'))) {
    imports['@/lib/service-url'] = compile(root, 'lib/service-url.ts', {}, {})
  }
  return imports
}

function thenableParams(values) {
  return Object.assign(Promise.resolve(values), values)
}
const enc = encodeURIComponent
function makeRequest(method, { body, headers = {}, query = '' } = {}) {
  const url = `http://localhost/api/proxy${query}`
  const init = { method, headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) } }
  if (body !== undefined) init.body = JSON.stringify(body)
  const req = new Request(url, init)
  req.nextUrl = new URL(url)
  return req
}

const PAYLOAD = { name: 'Quarterly', n: 1 }
const COMPOSE_BODY = { presentation_id: 'pres-1', slide_index: 2, user_id: 'attacker-chosen-id' }
const COMPOSE_KG_BODY = { ...COMPOSE_BODY, research: { use_knowledge_graph: true } }
const HANDOFF_BODY = { pending_request: '  build it  ', idempotency_key: ' key-1 ', user_id: 'attacker-chosen-id' }
const none = { headers: {}, cache: undefined, body: undefined }
const jsonH = { 'content-type': 'application/json' }

/**
 * Each case lists what the base (flag-less) proxy sent, as `base(uid)`:
 * `where` says how the user id travels, so the test can read it back from the
 * outgoing request and compare it with the signed `sub`.
 */
const ALL_CASES = [
  { name: 'templates GET', file: 'app/api/templates/route.ts', fn: 'GET', m: 'GET', where: 'path',
    args: () => [makeRequest('GET')],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/templates`, method: 'GET', ...none, cache: 'no-store' }) },
  { name: 'templates POST', file: 'app/api/templates/route.ts', fn: 'POST', m: 'POST', where: 'path',
    args: () => [makeRequest('POST', { body: PAYLOAD })],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/templates`, method: 'POST', headers: jsonH, cache: undefined, body: JSON.stringify(PAYLOAD) }) },
  { name: 'templates/[id] GET', file: 'app/api/templates/[id]/route.ts', fn: 'GET', m: 'GET', where: 'path',
    args: () => [makeRequest('GET'), { params: thenableParams({ id: 'tpl 1' }) }],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/templates/${enc('tpl 1')}`, method: 'GET', ...none, cache: 'no-store' }) },
  { name: 'templates/[id] DELETE', file: 'app/api/templates/[id]/route.ts', fn: 'DELETE', m: 'DELETE', where: 'path',
    args: () => [makeRequest('DELETE'), { params: thenableParams({ id: 'tpl 1' }) }],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/templates/${enc('tpl 1')}`, method: 'DELETE', ...none }) },
  { name: 'templates/[id]/blueprint PATCH', file: 'app/api/templates/[id]/blueprint/route.ts', fn: 'PATCH', m: 'PATCH', where: 'path',
    args: () => [makeRequest('PATCH', { body: PAYLOAD }), { params: thenableParams({ id: 'tpl-1' }) }],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/templates/tpl-1/blueprint`, method: 'PATCH', headers: jsonH, cache: undefined, body: JSON.stringify(PAYLOAD) }) },
  { name: 'templates/[id]/enrich POST', file: 'app/api/templates/[id]/enrich/route.ts', fn: 'POST', m: 'POST', where: 'path',
    args: () => [makeRequest('POST'), { params: thenableParams({ id: 'tpl-1' }) }],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/templates/tpl-1/enrich`, method: 'POST', ...none }) },
  { name: 'themes GET', file: 'app/api/themes/route.ts', fn: 'GET', m: 'GET', where: 'path',
    args: () => [makeRequest('GET')],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/themes`, method: 'GET', ...none, cache: 'no-store' }) },
  { name: 'themes POST', file: 'app/api/themes/route.ts', fn: 'POST', m: 'POST', where: 'path',
    args: () => [makeRequest('POST', { body: PAYLOAD })],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/themes`, method: 'POST', headers: jsonH, cache: undefined, body: JSON.stringify(PAYLOAD) }) },
  { name: 'themes/[id] GET', file: 'app/api/themes/[id]/route.ts', fn: 'GET', m: 'GET', where: 'path',
    args: () => [makeRequest('GET'), { params: thenableParams({ id: 'th-1' }) }],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/themes/th-1`, method: 'GET', ...none, cache: 'no-store' }) },
  { name: 'themes/[id] PATCH', file: 'app/api/themes/[id]/route.ts', fn: 'PATCH', m: 'PATCH', where: 'path',
    args: () => [makeRequest('PATCH', { body: PAYLOAD }), { params: thenableParams({ id: 'th-1' }) }],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/themes/th-1`, method: 'PATCH', headers: jsonH, cache: undefined, body: JSON.stringify(PAYLOAD) }) },
  { name: 'themes/[id] DELETE', file: 'app/api/themes/[id]/route.ts', fn: 'DELETE', m: 'DELETE', where: 'path',
    args: () => [makeRequest('DELETE'), { params: thenableParams({ id: 'th-1' }) }],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/themes/th-1`, method: 'DELETE', ...none }) },
  { name: 'themes/[id]/standard PUT', file: 'app/api/themes/[id]/standard/route.ts', fn: 'PUT', m: 'PUT', where: 'path',
    args: () => [makeRequest('PUT'), { params: thenableParams({ id: 'th-1' }) }],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/themes/th-1/standard`, method: 'PUT', ...none }) },
  { name: 'themes/standard GET', file: 'app/api/themes/standard/route.ts', fn: 'GET', m: 'GET', where: 'path',
    args: () => [makeRequest('GET')],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/themes/standard`, method: 'GET', ...none, cache: 'no-store' }) },
  { name: 'themes/standard DELETE', file: 'app/api/themes/standard/route.ts', fn: 'DELETE', m: 'DELETE', where: 'path',
    args: () => [makeRequest('DELETE')],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/themes/standard`, method: 'DELETE', ...none }) },
  { name: 'ingest-jobs/[jobId] GET', file: 'app/api/ingest-jobs/[jobId]/route.ts', fn: 'GET', m: 'GET', where: 'path',
    args: () => [makeRequest('GET'), { params: thenableParams({ jobId: 'job-1' }) }],
    base: uid => ({ url: `${D}/api/users/${enc(uid)}/ingest-jobs/job-1`, method: 'GET', ...none, cache: 'no-store' }) },
  { name: 'slides/compose POST', file: 'app/api/slides/compose/route.ts', fn: 'POST', m: 'POST', where: 'body',
    args: () => [makeRequest('POST', { body: COMPOSE_BODY })],
    base: uid => ({ url: `${D}/api/v1/slides/compose-one`, method: 'POST', headers: jsonH, cache: 'no-store', body: JSON.stringify({ ...COMPOSE_BODY, user_id: uid }) }) },
  { name: 'slides/compose POST (knowledge graph)', file: 'app/api/slides/compose/route.ts', fn: 'POST', m: 'POST', where: 'body', idOnly: true,
    args: () => [makeRequest('POST', { body: COMPOSE_KG_BODY })],
    base: uid => ({ url: `${D}/api/v1/slides/compose-one`, method: 'POST', headers: { ...jsonH, 'x-api-key': 'kg-fixture-key' }, cache: 'no-store', body: JSON.stringify({ ...COMPOSE_KG_BODY, user_id: uid }) }) },
  { name: 'slides/refine POST', file: 'app/api/slides/refine/route.ts', fn: 'POST', m: 'POST', where: 'body',
    args: () => [makeRequest('POST', { body: COMPOSE_BODY })],
    base: uid => ({ url: `${D}/api/v1/slides/refine-one`, method: 'POST', headers: jsonH, cache: 'no-store', body: JSON.stringify({ ...COMPOSE_BODY, user_id: uid }) }) },
  { name: 'slides/jobs/[jobId] GET', file: 'app/api/slides/jobs/[jobId]/route.ts', fn: 'GET', m: 'GET', where: 'query',
    args: () => [makeRequest('GET', { query: '?session_id=sess-1&presentation_id=pres-1' }), { params: thenableParams({ jobId: 'job-9' }) }],
    base: uid => ({ url: `${D}/api/v1/slides/compose-jobs/job-9?${new URLSearchParams({ user_id: uid, session_id: 'sess-1', presentation_id: 'pres-1' })}`, method: 'GET', ...none, cache: 'no-store' }) },
  { name: 'director/sessions/[id]/handoff POST', file: 'app/api/director/sessions/[sourceSessionId]/handoff/route.ts', fn: 'POST', m: 'POST', where: 'body',
    args: () => [makeRequest('POST', { body: HANDOFF_BODY }), { params: thenableParams({ sourceSessionId: 'src sess/1' }) }],
    base: uid => ({ url: `${D}/api/sessions/${enc('src sess/1')}/handoff`, method: 'POST', headers: jsonH, cache: 'no-store',
      body: JSON.stringify({ ...HANDOFF_BODY, user_id: uid, pending_request: 'build it', idempotency_key: 'key-1' }) }) },
]
// The contract lists 13 proxy files on uat and 12 on main (`ingest-jobs` is uat-only), and main's
// compose route has no knowledge-graph branch. The same test file runs on all three branches.
const INGEST = 'app/api/ingest-jobs/[jobId]/route.ts'
const CASES = ALL_CASES.filter(c => fs.existsSync(path.join(REPO, c.file)) &&
  !(c.name.endsWith('(knowledge graph)') && !read(c.file).includes('requireKgEntitled')))
const SKIPPED = ALL_CASES.filter(c => !CASES.includes(c)).map(c => c.name)
const ROUTE_FILES = [...new Set(CASES.map(c => c.file))]
for (const name of SKIPPED) {
  assert.ok(name.startsWith('ingest-jobs') || name.endsWith('(knowledge graph)'), `unexpected missing proxy: ${name}`)
}
assert.equal(ROUTE_FILES.length, fs.existsSync(path.join(REPO, INGEST)) ? 13 : 12, 'the contract lists 13 proxy files (12 on main)')
assert.equal(CASES.filter(c => !c.name.endsWith('(knowledge graph)')).length, fs.existsSync(path.join(REPO, INGEST)) ? 19 : 18, 'every Director call in them')

const IDENTITIES = {
  idKeyed: { user: { id: 'user-abc-123', email: 'abc@example.test' } },
  emailKeyed: { user: { email: 'pat+qa@example.test' } },
  oddId: { user: { id: 'org/ünï user+1&x=%20', email: 'odd@example.test' } },
}
const uidOf = identity => identity.user.id || identity.user.email

const KNOWN_INIT_KEYS = new Set(['method', 'headers', 'body', 'cache'])
function normalize(call) {
  const extraKeys = Object.keys(call.init ?? {}).filter(k => !KNOWN_INIT_KEYS.has(k))
  const headers = {}
  for (const [k, v] of new Headers(call.init?.headers ?? {})) headers[k] = v
  return {
    url: call.url,
    method: call.init?.method ?? 'GET',
    headers: Object.fromEntries(Object.entries(headers).sort(([a], [b]) => a.localeCompare(b))),
    cache: call.init?.cache,
    body: call.init?.body,
    extraKeys,
  }
}
const withoutEntitlement = n => {
  const { [HEADER]: entitlement, ...rest } = n.headers
  return { n: { ...n, headers: rest }, entitlement }
}

const routeEnv = () => {
  for (const k of Object.keys(env)) delete env[k]
  Object.assign(env, {
    DIRECTOR_API_URL: D,
    NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED: 'true',
    NEXT_PUBLIC_SLIDE_REFINER_ENABLED: 'true',
    KNOWLEDGE_API_KEY: 'kg-fixture-key',
    [SECRET_ENV]: FIXTURE_SECRET,
  })
}

function loadRoutes(root, helperModule) {
  const imports = routeImports(root, helperModule)
  const modules = {}
  for (const file of ROUTE_FILES) modules[file] = compile(root, file, { process: { env }, fetch: stubFetch, Date: clock }, imports)
  return modules
}

async function invoke(modules, c, identity, { inbound = {} } = {}) {
  state.identity = identity
  state.calls = []
  const args = c.args()
  for (const [k, v] of Object.entries(inbound)) args[0].headers.set(k, v)
  const res = await modules[c.file][c.fn](...args)
  return { res, calls: state.calls.slice(), text: await res.clone().text() }
}

routeEnv()
const routes = loadRoutes(REPO, rawHelper)

const countedEqual = (a, b, m) => assert.deepEqual(a, b, m)

for (const [idName, identity] of Object.entries(IDENTITIES)) {
  const uid = uidOf(identity)
  for (const c of CASES) {
    if (c.idOnly && !identity.user.id) continue // the KG gate needs a real id (unchanged behaviour)
    const label = `${c.name} / ${idName}`
    const expectedBase = { ...c.base(uid), extraKeys: [] }

    // 3a. flag unset, secret set: exactly the request the base proxy sent
    routeEnv()
    setClock(CLOCK_START)
    state.kgDenied = false
    const off = await invoke(routes, c, identity)
    assert.equal(off.calls.length, 1, `${label}: one Director call`)
    countedEqual(normalize(off.calls[0]), expectedBase, `${label}: flag off is the base request`)
    assert.equal(HEADER in normalize(off.calls[0]).headers, false)
    assert.equal(off.res.status, 200)

    // 3b. flag values that are not the exact string true stay off
    for (const value of ['false', '1', 'TRUE', '']) {
      routeEnv(); env[FLAG] = value
      const r = await invoke(routes, c, identity)
      countedEqual(normalize(r.calls[0]), expectedBase, `${label}: flag "${value}" is off`)
    }

    // 3c. flag on, secret unset or empty: still the base request
    for (const secret of [undefined, '']) {
      routeEnv(); env[FLAG] = 'true'
      if (secret === undefined) delete env[SECRET_ENV]; else env[SECRET_ENV] = secret
      const r = await invoke(routes, c, identity)
      countedEqual(normalize(r.calls[0]), expectedBase, `${label}: flag on but no secret is the base request`)
    }

    // 3d. flag on, secret set: base request plus one verifiable header
    routeEnv(); env[FLAG] = 'true'
    setClock(CLOCK_START + 5)
    const on = await invoke(routes, c, identity, { inbound: { 'X-Deckster-Entitlement': 'forged-by-client' } })
    assert.equal(on.calls.length, 1)
    const { n, entitlement } = withoutEntitlement(normalize(on.calls[0]))
    countedEqual(n, expectedBase, `${label}: only the entitlement header was added`)
    assert.ok(entitlement, `${label}: header present`)
    assert.notEqual(entitlement, 'forged-by-client', `${label}: an inbound header is never forwarded`)
    const verdict = verifyRestHeader(entitlement, FIXTURE_SECRET, { method: c.m, sub: uid, now: CLOCK_START + 5 })
    assert.equal(verdict.ok, true, `${label}: verifies (${verdict.why})`)
    assert.equal(verdict.claims.m, c.m, `${label}: m is the method sent`)
    assert.equal(verdict.claims.exp - verdict.claims.iat, 120)
    assert.equal(verdict.claims.iat, CLOCK_START + 5)
    assert.equal('bq' in verdict.claims, false, `${label}: no bq yet (TODO until the quota-claim helper lands)`)
    // sub is the very id the request carries, read back from the outgoing request
    const sent = on.calls[0]
    const carried =
      c.where === 'path' ? decodeURIComponent(/\/api\/users\/([^/]+)\//.exec(sent.url)[1])
      : c.where === 'query' ? new URL(sent.url).searchParams.get('user_id')
      : JSON.parse(sent.init.body).user_id
    assert.equal(verdict.claims.sub, carried, `${label}: sub equals the id in the ${c.where}`)
    assert.equal(carried, uid)
    // never echoed back to the browser
    assert.equal(on.res.headers.get(HEADER), null)
    assert.equal(on.text.includes(entitlement), false)
    assert.equal(JSON.stringify([...on.res.headers]).includes(entitlement), false)
  }
}

// 3e. the client cannot choose sub: a spoofed body user_id is overwritten by the proxy, and sub follows it
{
  routeEnv(); env[FLAG] = 'true'; setClock(CLOCK_START)
  for (const c of CASES.filter(x => x.where === 'body')) {
    const r = await invoke(routes, c, IDENTITIES.idKeyed)
    const entitlement = new Headers(r.calls[0].init.headers).get(HEADER)
    const claims = verifyRestHeader(entitlement, FIXTURE_SECRET, { method: 'POST', now: CLOCK_START }).claims
    assert.equal(claims.sub, 'user-abc-123')
    assert.notEqual(claims.sub, 'attacker-chosen-id')
    assert.equal(JSON.parse(r.calls[0].init.body).user_id, claims.sub)
  }
}

// 3f. knowledge-graph compose keeps its X-API-Key; the entitlement is added next to it
const kg = CASES.find(c => c.name === 'slides/compose POST (knowledge graph)')
if (kg) {
  routeEnv(); env[FLAG] = 'true'; setClock(CLOCK_START)
  const r = await invoke(routes, kg, IDENTITIES.idKeyed)
  const headers = new Headers(r.calls[0].init.headers)
  assert.equal(headers.get('x-api-key'), 'kg-fixture-key')
  assert.equal(headers.get('content-type'), 'application/json')
  assert.ok(headers.get(HEADER))
  // sub follows the gate's id (the body user_id), not a second lookup
  assert.equal(verifyRestHeader(headers.get(HEADER), FIXTURE_SECRET, { method: 'POST', sub: JSON.parse(r.calls[0].init.body).user_id, now: CLOCK_START }).ok, true)
}

// 3g. the login check comes first: no session, no Director call, nothing minted or sent
{
  routeEnv(); env[FLAG] = 'true'
  for (const c of CASES) {
    const r = await invoke(routes, c, null)
    assert.equal(r.calls.length, 0, `${c.name}: no Director call without a session`)
    assert.ok([401, 404].includes(r.res.status), `${c.name}: refused (${r.res.status})`)
    assert.equal(r.text.includes('deckster-rest'), false)
    const empty = await invoke(routes, c, { user: {} })
    assert.equal(empty.calls.length, 0, `${c.name}: no Director call without a user id`)
  }
}

// 3h. minted per request, never reused across requests or users
{
  routeEnv(); env[FLAG] = 'true'
  const c = CASES.find(x => x.name === 'themes/standard DELETE')
  setClock(CLOCK_START)
  const a = await invoke(routes, c, IDENTITIES.idKeyed)
  setClock(CLOCK_START + 1)
  const b = await invoke(routes, c, IDENTITIES.idKeyed)
  const other = await invoke(routes, c, IDENTITIES.emailKeyed)
  const h = r => new Headers(r.calls[0].init.headers).get(HEADER)
  assert.equal(new Set([h(a), h(b), h(other)]).size, 3)
  assert.equal(verifyRestHeader(h(other), FIXTURE_SECRET, { method: 'DELETE', sub: 'pat+qa@example.test', now: CLOCK_START + 1 }).ok, true)
  // a header minted for user A never verifies for user B's request
  assert.equal(verifyRestHeader(h(a), FIXTURE_SECRET, { method: 'DELETE', sub: 'pat+qa@example.test', now: CLOCK_START }).why, 'sub mismatch')
}

// ------------------------------------- 3i. golden vector shared with the Director
// scripts/fixtures/rest-entitlement-golden-vector.json is the Director's fixture
// (generated by its Python test, throwaway test key, `dummy: true`). The minter
// must reproduce every case byte for byte, the independent verifier must accept
// the positives and reject the negatives for the stated reason, and a real proxy
// call at the fixed clock must emit the identical header.
{
  const vector = JSON.parse(read('scripts/fixtures/rest-entitlement-golden-vector.json'))
  assert.equal(vector.dummy, true)
  assert.equal(vector.header_name, 'X-Deckster-Entitlement')
  assert.equal(vector.signing_prefix, 'deckster-rest-v1.')
  const goldenKey = Buffer.from(vector.test_hmac_key_hex, 'hex').toString('utf8')
  const { mint_now: mintNow } = vector.fixed_clock
  routeEnv(); env[FLAG] = 'true'; env[SECRET_ENV] = goldenKey
  setClock(mintNow)
  for (const c of vector.cases) {
    const bq = c.inputs.bq ?? undefined
    const header = mintRestEntitlement({ sub: c.inputs.sub, method: c.inputs.method, bq, nowSeconds: c.inputs.now })
    assert.equal(header, c.header, `${c.id}: header reproduced byte for byte`)
    const [payloadB64, signatureB64] = header.split('.')
    assert.equal(payloadB64, c.payload_b64, `${c.id}: payload_b64`)
    assert.equal(signatureB64, c.signature_b64, `${c.id}: signature_b64`)
    assert.equal(Buffer.from(payloadB64, 'base64url').toString('utf8'), c.payload_json, `${c.id}: payload JSON text`)
    assert.equal('deckster-rest-v1.' + payloadB64, c.signing_message, `${c.id}: signing message`)
    assert.deepEqual(restEntitlementHeaders(c.inputs.sub, c.inputs.method, bq), { [vector.header_name]: c.header }, `${c.id}: through the flag-gated helper`)
    const verdict = verifyRestHeader(c.header, goldenKey, { method: c.verify.method, sub: c.inputs.sub, now: c.verify.now })
    assert.equal(verdict.ok, c.verify.expected === 'accepted', `${c.id}: independent verifier (${verdict.why})`)
  }
  const reasons = { bad_signature: 'bad signature', method_mismatch: 'method mismatch', expired: 'expired' }
  for (const c of vector.negative_cases) {
    const verdict = verifyRestHeader(c.header, goldenKey, { method: c.verify.method, now: c.verify.now })
    assert.equal(c.verify.expected, 'rejected')
    assert.equal(verdict.ok, false, `${c.id}: rejected`)
    assert.equal(verdict.why, reasons[c.verify.director_reason], `${c.id}: rejected for the Director's reason`)
  }
  // the real proxy path emits the golden header: themes/standard DELETE for user-golden-1 at the fixed clock
  const deletePlain = vector.cases.find(c => c.id === 'delete-theme-plain')
  const route = CASES.find(c => c.name === 'themes/standard DELETE')
  const out = await invoke(routes, route, { user: { id: deletePlain.inputs.sub } })
  assert.equal(new Headers(out.calls[0].init.headers).get(vector.header_name), deletePlain.header, 'proxy output equals the golden header')
}

// ---------------------------------------------------- 4. static guards
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}
{
  // every Director fetch in the 13 files is signed (a new unsigned fetch in one of them fails here)
  for (const file of ROUTE_FILES) {
    const source = read(file)
    const fetches = (source.match(/\bfetch\(/g) ?? []).length
    const signed = (source.match(/\brestEntitlementHeaders\(/g) ?? []).length
    assert.equal(signed, fetches, `${file}: ${fetches} fetch call(s), ${signed} signed`)
    assert.match(source, /from '@\/lib\/director-rest-entitlement'/, `${file} imports the helper`)
  }
  // no other proxy reaches the Director's user-scoped routes unsigned
  const covered = new Set(ROUTE_FILES.map(f => path.join(REPO, f)))
  for (const file of walk(path.join(REPO, 'app/api')).filter(f => f.endsWith('route.ts'))) {
    const source = fs.readFileSync(file, 'utf8')
    if (/\bDIRECTOR_API_URL\b|SLIDE_COMPOSER_DIRECTOR_URL/.test(source)) {
      assert.ok(covered.has(file), `${path.relative(REPO, file)} calls the Director but is not in the signed set`)
    }
  }
  // server-only: nothing outside app/api imports the helper, and it cannot reach a browser bundle
  const importers = []
  for (const root of ['app', 'components', 'hooks', 'contexts', 'lib']) {
    if (!fs.existsSync(path.join(REPO, root))) continue
    for (const file of walk(path.join(REPO, root)).filter(f => /\.(ts|tsx|js|jsx|mjs)$/.test(f))) {
      if (/director-rest-entitlement/.test(fs.readFileSync(file, 'utf8'))) importers.push(path.relative(REPO, file))
    }
  }
  for (const importer of importers) {
    assert.ok(importer === 'lib/director-rest-entitlement.ts' || importer.startsWith('app/api/'), `${importer} must not import the REST entitlement helper`)
    if (importer.startsWith('app/api/')) assert.doesNotMatch(read(importer), /['"]use client['"]/)
  }
  const helperSource = read('lib/director-rest-entitlement.ts')
  assert.doesNotMatch(helperSource, /\bconsole\b/, 'the helper never logs')
  assert.doesNotMatch(helperSource, /NEXT_PUBLIC_/, 'the helper reads server env only')
  assert.doesNotMatch(helperSource, /['"]use client['"]/)
  assert.doesNotMatch(helperSource, /\bsid\s*:/, 'the helper never writes a sid claim')
  assert.match(helperSource, /DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED/)
  // the flag is documented next to the secret and defaults off
  assert.match(read('.env.example'), /DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED="?(false)?"?\s*$/m)
}

// ---------------------------- 5. proof mode: same requests as a base checkout
if (process.env.REST_ENTITLEMENT_BASE_ROOT) {
  const baseRoot = path.resolve(process.env.REST_ENTITLEMENT_BASE_ROOT)
  const baseRoutes = loadRoutes(baseRoot, null)
  const dump = async (modules, flagState) => {
    const rows = []
    let initWithoutHeadersKey = 0
    for (const [idName, identity] of Object.entries(IDENTITIES)) {
      for (const c of CASES) {
        if (c.idOnly && !identity.user.id) continue
        routeEnv()
        if (flagState !== 'unset') env[FLAG] = flagState
        setClock(CLOCK_START)
        const r = await invoke(modules, c, identity)
        if (!('headers' in r.calls[0].init)) initWithoutHeadersKey++
        rows.push({ id: `${c.name}/${idName}`, call: normalize(r.calls[0]), status: r.res.status, body: r.text })
      }
    }
    return { rows, initWithoutHeadersKey }
  }
  const hash = rows => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')
  const base = await dump(baseRoutes, 'unset')
  const branchUnset = await dump(routes, 'unset')
  const branchFalse = await dump(routes, 'false')
  assert.deepEqual(branchUnset.rows, base.rows, 'flag unset: every outgoing request and response equals the base checkout')
  assert.deepEqual(branchFalse.rows, base.rows, 'flag false: every outgoing request and response equals the base checkout')
  console.log(`base-compare: ${base.rows.length} request/response pairs`)
  console.log(`  fetch init objects with no headers key: base ${base.initWithoutHeadersKey}, branch ${branchUnset.initWithoutHeadersKey} (the branch passes an empty headers object there; same bytes on the wire)`)
  console.log(`  base   sha256 ${hash(base.rows)}`)
  console.log(`  branch sha256 ${hash(branchUnset.rows)} (flag unset)`)
  console.log(`  branch sha256 ${hash(branchFalse.rows)} (flag "false")`)
}

console.log(`rest entitlement header: ok (${CASES.length} proxy calls in ${ROUTE_FILES.length} files x ${Object.keys(IDENTITIES).length} identities, flag off/unset/on${SKIPPED.length ? `; not on this branch: ${SKIPPED.join(', ')}` : ''})`)
