// program1/studio-director-rest-sign: every Next proxy to a Director user-scoped REST route attaches X-Deckster-Entitlement
// (STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED, server env, exact "true", default off). Director side: program1/director-rest-auth
// (DIRECTOR_REST_AUTH_ALL_ENABLED; src/utils/rest_entitlement.py).
//
//   node scripts/test-studio-director-rest-sign.mjs     # offline: transpile + vm; next-auth, Prisma, fetch stubbed; secrets made up at run time
//
// Proves, on the REAL route handlers:
//  1. the shared minter reproduces Director's golden vector byte-for-byte (tests/fixtures/rest_entitlement/golden_vector.json, copied below);
//  2. flag off (unset + other spellings): no header on any route, Prisma never read, outbound request unchanged;
//  3. flag on: exactly one header per Director call; an independent verifier (written from the contract) accepts it and finds
//     {v:1, typ:"rest", sub, iat, exp=iat+120, m} with no sid, m == the call's method, sub == the user_id in path / query / body;
//  4. flag on, no header: DB row missing, DB id != the id sent (e-mail fallback), DB error, secret unset, wrong secret fails verify.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function loadTs() {
  for (const base of [root, path.resolve(root, '../frontend')]) {
    try { return createRequire(path.join(base, 'package.json'))('typescript') } catch {}
  }
  throw new Error('typescript not found (no node_modules here or in ../frontend)')
}
const ts = loadTs()
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')

// ---- 1. golden vector (from Director tests/fixtures/rest_entitlement/golden_vector.json; dummy key, test only)
const GOLDEN = {
  keyHex: '7131372d676f6c64656e2d64756d6d792d686d61632d6b65792d30303031',
  cases: [
    { sub: 'user-golden-1', method: 'DELETE', header: 'eyJ2IjoxLCJ0eXAiOiJyZXN0Iiwic3ViIjoidXNlci1nb2xkZW4tMSIsImlhdCI6MTc5MDAwMDAwMCwiZXhwIjoxNzkwMDAwMTIwLCJtIjoiREVMRVRFIn0.iasZhhLy3Nv7gB4V61cexIeXWZvtJPyD673b5CvQUVI' },
    { sub: "zoë.o'neil+q17@example.test", method: 'PATCH', header: 'eyJ2IjoxLCJ0eXAiOiJyZXN0Iiwic3ViIjoiem_Dqy5vJ25laWwrcTE3QGV4YW1wbGUudGVzdCIsImlhdCI6MTc5MDAwMDAwMCwiZXhwIjoxNzkwMDAwMTIwLCJtIjoiUEFUQ0gifQ.xURY_8FIuFv2Ia3CDNSu8fWvlfxEiOmGj7EeVVscFEw' },
  ],
}

// ---- module loader (CommonJS transpile into a vm, with an explicit stub map)
const env = {}
const state = { session: null, dbRows: new Map(), dbThrows: false, dbReads: 0, fetches: [] }
class NextResponse { constructor(body, init) { this.body = body; this.status = init?.status ?? 200 } static json(body, init) { return new NextResponse(body, init) } }
const stubs = {
  'next/server': { NextResponse, NextRequest: class {} },
  'next-auth': { getServerSession: async () => state.session },
  '@/lib/auth-options': { authOptions: {} },
  '@/lib/prisma': { prisma: { user: { findUnique: async ({ where }) => {
    state.dbReads++
    if (state.dbThrows) throw new Error('db down')
    const key = where.id ? `id:${where.id}` : `email:${where.email}`
    return state.dbRows.has(key) ? { id: state.dbRows.get(key) } : null
  } } } },
  '@/lib/kg-proxy': { requireKgEntitled: async () => ({ error: null, userId: 'kg' }), kgHeaders: h => h },
  '@/lib/studio-compose-entitlement': { composeEntitlementHeaders: () => ({}) },
}
const cache = new Map()
function load(rel) {
  if (cache.has(rel)) return cache.get(rel)
  const module = { exports: {} }
  cache.set(rel, module.exports)
  const out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const req = spec => {
    if (stubs[spec]) return stubs[spec]
    if (spec.startsWith('@/')) return load(spec.slice(2) + '.ts')
    if (spec === 'crypto' || spec.startsWith('node:')) return createRequire(import.meta.url)(spec)
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(out, {
    module, exports: module.exports, require: req, process: { env }, Buffer, URL, URLSearchParams, AbortSignal, console, Date, JSON, Math,
    fetch: async (url, init = {}) => { state.fetches.push({ url, init }); return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' } },
  })
  cache.set(rel, module.exports)
  return module.exports
}

const minter = load('lib/director-rest-entitlement.ts')
const keyAscii = Buffer.from(GOLDEN.keyHex, 'hex').toString('utf8')
env.DIRECTOR_WS_AUTH_SECRET = keyAscii
for (const c of GOLDEN.cases) {
  assert.equal(minter.mintRestEntitlement({ sub: c.sub, method: c.method, nowSeconds: 1790000000 }), c.header, `golden ${c.method}`)
}

// ---- independent verifier (from the contract; imports nothing of the minter)
function verify(header, secret, method) {
  const [p, s] = header.split('.')
  const want = crypto.createHmac('sha256', secret).update('deckster-rest-v1.' + p).digest('base64url')
  if (s !== want) return null
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
  if (claims.v !== 1 || claims.typ !== 'rest' || 'sid' in claims || claims.m !== method) return null
  if (!(claims.exp - claims.iat <= 120 && claims.exp > claims.iat)) return null
  return claims
}

// ---- the routes and how to call them
const req = (url, body) => ({ nextUrl: new URL(url), json: async () => body, headers: { get: () => 'application/json' } })
const p = obj => ({ params: Promise.resolve(obj) })
const ROUTES = [
  ['app/api/templates/route.ts', 'GET', m => m.GET()],
  ['app/api/templates/route.ts', 'POST', m => m.POST({ json: async () => ({ name: 't' }) })],
  ['app/api/templates/[id]/route.ts', 'GET', m => m.GET(req('http://x/'), p({ id: 't1' }))],
  ['app/api/templates/[id]/route.ts', 'DELETE', m => m.DELETE(req('http://x/'), p({ id: 't1' }))],
  ['app/api/templates/[id]/route.ts', 'PATCH', m => m.PATCH(req('http://x/', { name: 'n' }), p({ id: 't1' }))],
  ['app/api/templates/[id]/blueprint/route.ts', 'PATCH', m => m.PATCH(req('http://x/', { blueprint: {} }), p({ id: 't1' }))],
  ['app/api/templates/[id]/enrich/route.ts', 'POST', m => m.POST(req('http://x/'), p({ id: 't1' }))],
  ['app/api/themes/route.ts', 'GET', m => m.GET()],
  ['app/api/themes/route.ts', 'POST', m => m.POST(req('http://x/', { name: 'th', theme: {} }))],
  ['app/api/themes/[id]/route.ts', 'GET', m => m.GET(req('http://x/'), p({ id: 'h1' }))],
  ['app/api/themes/[id]/route.ts', 'PATCH', m => m.PATCH(req('http://x/', { name: 'n' }), p({ id: 'h1' }))],
  ['app/api/themes/[id]/route.ts', 'DELETE', m => m.DELETE(req('http://x/'), p({ id: 'h1' }))],
  ['app/api/themes/[id]/standard/route.ts', 'PUT', m => m.PUT(req('http://x/'), p({ id: 'h1' }))],
  ['app/api/themes/standard/route.ts', 'GET', m => m.GET()],
  ['app/api/themes/standard/route.ts', 'DELETE', m => m.DELETE()],
  ['app/api/ingest-jobs/[jobId]/route.ts', 'GET', m => m.GET(req('http://x/'), p({ jobId: 'j1' }))],
  ['app/api/slides/jobs/[jobId]/route.ts', 'GET', m => m.GET(req('http://x/?session_id=s1'), p({ jobId: 'j1' }))],
  ['app/api/slides/compose/route.ts', 'POST', m => m.POST(req('http://x/', { slide: 1 }))],
  ['app/api/slides/refine/route.ts', 'POST', m => m.POST(req('http://x/', { slide: 1 }))],
  ['app/api/director/sessions/[sourceSessionId]/handoff/route.ts', 'POST', m => m.POST(req('http://x/', { pending_request: 'r', idempotency_key: 'k' }), p({ sourceSessionId: 'src1' }))],
]
function sentUserId(call) {
  const u = new URL(call.url)
  const m = u.pathname.match(/\/api\/users\/([^/]+)/)
  if (m) return decodeURIComponent(m[1])
  if (u.searchParams.has('user_id')) { assert.equal(u.searchParams.getAll('user_id').length, 1); return u.searchParams.get('user_id') }
  return JSON.parse(call.init.body).user_id
}
const header = call => {
  const h = call.init.headers || {}
  const keys = Object.keys(h).filter(k => k.toLowerCase() === 'x-deckster-entitlement')
  assert.ok(keys.length <= 1)
  return keys.length ? h[keys[0]] : null
}
async function runAll() {
  const calls = []
  for (const [rel, method, call] of ROUTES) {
    state.fetches = []
    const res = await call(load(rel))
    assert.equal(state.fetches.length, 1, `${rel} ${method}: one Director call (status ${res?.status})`)
    const f = state.fetches[0]
    assert.equal((f.init.method || 'GET').toUpperCase(), method, `${rel} method`)
    calls.push({ rel, method, f })
  }
  return calls
}

Object.assign(env, {
  DIRECTOR_API_URL: 'https://director.test', SLIDE_COMPOSER_DIRECTOR_URL: 'https://director.test',
  NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED: 'true', NEXT_PUBLIC_SLIDE_REFINER_ENABLED: 'true', NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE: 'true',
})
const SECRET = crypto.randomBytes(24).toString('hex')
env.DIRECTOR_WS_AUTH_SECRET = SECRET
const UID = 'cm-user-' + crypto.randomBytes(4).toString('hex')
state.session = { user: { id: UID, email: 'a@example.test' } }
state.dbRows.set(`id:${UID}`, UID)

// ---- 2. flag off
for (const v of [undefined, 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', '']) {
  if (v === undefined) delete env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED; else env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED = v
  state.dbReads = 0
  for (const c of await runAll()) assert.equal(header(c.f), null, `flag ${JSON.stringify(v)}: ${c.rel} ${c.method} unsigned`)
  assert.equal(state.dbReads, 0, 'flag off: no DB read')
}

// ---- 3. flag on
env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED = 'true'
for (const c of await runAll()) {
  const h = header(c.f)
  assert.ok(h, `${c.rel} ${c.method} signed`)
  const claims = verify(h, SECRET, c.method)
  assert.ok(claims, `${c.rel} ${c.method} verifies`)
  assert.equal(claims.sub, UID)
  assert.equal(claims.sub, sentUserId(c.f), `${c.rel}: sub == sent user_id`)
  assert.equal(claims.exp - claims.iat, 120)
  assert.deepEqual(Object.keys(claims).sort(), ['exp', 'iat', 'm', 'sub', 'typ', 'v'])
  assert.equal(verify(h, SECRET + 'x', c.method), null, 'wrong secret fails')
  assert.equal(verify(h, SECRET, c.method === 'GET' ? 'POST' : 'GET'), null, 'wrong method fails')
}

// ---- 4. flag on, no header
async function expectNone(label) { for (const c of await runAll()) assert.equal(header(c.f), null, `${label}: ${c.rel} ${c.method}`) }
state.dbRows.clear(); await expectNone('no DB row')
// program1/studio-flip-enablers gap 1: an e-mail-only session now sends AND signs its DB id (flag on); unresolvable e-mail stays unsigned.
state.session = { user: { email: 'b@example.test' } }; state.dbRows.set('email:b@example.test', 'cm-other')
for (const c of await runAll()) {
  const h = header(c.f)
  assert.ok(h, `${c.rel} ${c.method} e-mail session signed`)
  const claims = verify(h, SECRET, c.method)
  assert.equal(claims.sub, 'cm-other')
  assert.equal(sentUserId(c.f), 'cm-other', `${c.rel}: e-mail session sends the DB id`)
}
state.dbRows.delete('email:b@example.test'); await expectNone('e-mail session, no DB row')
env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED = 'false'
for (const c of await runAll()) { assert.equal(header(c.f), null); assert.equal(sentUserId(c.f), 'b@example.test', `${c.rel}: flag off sends the e-mail as before`) }
env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED = 'true'
state.session = { user: { id: UID } }; state.dbRows.set(`id:${UID}`, 'someone-else'); await expectNone('DB id mismatch')
state.dbRows.set(`id:${UID}`, UID); state.dbThrows = true; await expectNone('DB error')
state.dbThrows = false; delete env.DIRECTOR_WS_AUTH_SECRET; await expectNone('secret unset')

// ---- statics: client code never imports the signer
for (const dir of ['components', 'hooks']) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
  for (const f of walk(path.join(root, dir))) assert.ok(!fs.readFileSync(f, 'utf8').includes('studio-director-rest-sign'), `client import ${f}`)
}
console.log(`ok - studio director REST sign: golden vector, ${ROUTES.length} routes x flag off/on, 5 no-header cases`)
