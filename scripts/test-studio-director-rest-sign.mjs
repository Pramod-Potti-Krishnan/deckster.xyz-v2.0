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
//  4. flag on, no header: DB row missing, DB id != the id sent (e-mail fallback, with one log line that never holds the e-mail), DB error, secret unset, wrong secret fails verify;
//  5. the verified DB id is reused for 30 s per session user (a polling proxy reads the DB once), never across users, and read again after 30 s;
//  6. the claims bind the Director path of the call (`path`, no host, no query);
//  7. the house pattern: the newest commit named "Director sign ..." touches only this change's files; stripping the marked lines gives each owned file back byte for byte
//     (scripts/studio-director-rest-sign-strip.mjs), .env.example is the base plus the block, and the registry names the change (three LATER-CHANGE lines);
//  8. MUTANTS of the signer and the strip: each one must be caught by 2-7.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function loadTs() {
  for (const base of [root, path.resolve(root, '../frontend')]) {
    try { return createRequire(path.join(base, 'package.json'))('typescript') } catch {}
  }
  throw new Error('typescript not found (no node_modules here or in ../frontend)')
}
const ts = loadTs()
const overrides = new Map() // rel -> text (the mutants)
const read = rel => overrides.has(rel) ? overrides.get(rel) : fs.readFileSync(path.join(root, rel), 'utf8')

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
const state = { session: null, dbRows: new Map(), dbThrows: false, dbReads: 0, dbWheres: [], fetches: [], warns: [] }
const vmConsole = { ...console, warn: (...a) => state.warns.push(a.join(' ')) }
class NextResponse { constructor(body, init) { this.body = body; this.status = init?.status ?? 200 } static json(body, init) { return new NextResponse(body, init) } }
const stubs = {
  'next/server': { NextResponse, NextRequest: class {} },
  'next-auth': { getServerSession: async () => state.session },
  '@/lib/auth-options': { authOptions: {} },
  '@/lib/prisma': { prisma: { user: { findUnique: async ({ where }) => {
    state.dbReads++
    state.dbWheres.push(where)
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
    module, exports: module.exports, require: req, process: { env }, Buffer, URL, URLSearchParams, AbortSignal, console: vmConsole, Date, JSON, Math,
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

const SIGN = 'lib/studio-director-rest-sign.ts'
const FLAG = 'STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED'
const signer = () => load(SIGN)
function fresh() { cache.clear(); signer().clearDirectorRestSignCache() } // a new module realm: no cached id
let checks = 0
const ok = (cond, label) => { assert.ok(cond, label); checks++ }
const eq = (a, b, label) => { assert.deepEqual(a, b, label); checks++ }

async function suite() {
  fresh()
  state.session = { user: { id: UID, email: 'a@example.test' } }; state.dbRows = new Map([[`id:${UID}`, UID]]); state.dbThrows = false; state.warns = []
  env.DIRECTOR_WS_AUTH_SECRET = SECRET
  // ---- 2. flag off
  for (const v of [undefined, 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', '', 'on']) {
    if (v === undefined) delete env[FLAG]; else env[FLAG] = v
    state.dbReads = 0
    for (const c of await runAll()) eq(header(c.f), null, `flag ${JSON.stringify(v)}: ${c.rel} ${c.method} unsigned`)
    eq(state.dbReads, 0, `flag ${JSON.stringify(v)}: no DB read`)
  }

  // ---- 3 + 6. flag on
  env[FLAG] = 'true'
  for (const c of await runAll()) {
    const h = header(c.f)
    ok(h, `${c.rel} ${c.method} signed`)
    const claims = verify(h, SECRET, c.method)
    ok(claims, `${c.rel} ${c.method} verifies`)
    eq(claims.sub, UID, 'sub is the id')
    eq(claims.sub, sentUserId(c.f), `${c.rel}: sub == sent user_id`)
    eq(claims.exp - claims.iat, 120, 'lifetime 120')
    eq(Object.keys(claims).sort(), ['exp', 'iat', 'm', 'path', 'sub', 'typ', 'v'], `${c.rel}: the claims, no sid`)
    eq(claims.path, new URL(c.f.url).pathname, `${c.rel}: path == the Director path of the call (no host, no query)`)
    eq(verify(h, SECRET + 'x', c.method), null, 'wrong secret fails')
    eq(verify(h, SECRET, c.method === 'GET' ? 'POST' : 'GET'), null, 'wrong method fails')
  }
  eq(state.warns, [], 'flag on, an id session: nothing logged')

  // ---- 4. flag on, no header
  async function expectNone(label) { fresh(); for (const c of await runAll()) eq(header(c.f), null, `${label}: ${c.rel} ${c.method}`) }
  state.dbRows.clear(); await expectNone('no DB row')
  state.session = { user: { email: 'b@example.test' } }; state.dbRows.set('email:b@example.test', 'cm-other'); state.warns = []
  fresh()
  const jobs = ROUTES.find(r => r[0] === 'app/api/slides/jobs/[jobId]/route.ts')
  state.fetches = []; await jobs[2](load(jobs[0]))
  eq(header(state.fetches[0].init), null, 'e-mail fallback: no header (fail-closed)')
  eq(sentUserId(state.fetches[0]), 'b@example.test', 'e-mail fallback: the proxy sent the e-mail')
  eq(state.warns.length, 1, 'e-mail fallback: one log line')
  ok(/e-mail fallback/.test(state.warns[0]) && /DIRECTOR_REST_AUTH_ALL_ENABLED/.test(state.warns[0]), 'the line names the fallback and the Director flag')
  ok(!state.warns[0].includes('b@example.test') && !state.warns[0].includes(SECRET), 'the line holds neither the e-mail nor the secret')
  await expectNone('e-mail fallback, DB id differs from sent id')
  state.session = { user: { id: UID } }; state.dbRows.set(`id:${UID}`, 'someone-else'); state.warns = []; await expectNone('DB id mismatch')
  eq(state.warns, [], 'an id mismatch is not the e-mail fallback: no line')
  state.dbRows.set(`id:${UID}`, UID); state.dbThrows = true; await expectNone('DB error')
  state.dbThrows = false; delete env.DIRECTOR_WS_AUTH_SECRET; await expectNone('secret unset')
  env.DIRECTOR_WS_AUTH_SECRET = SECRET

  // ---- 5. the 30 s cache (direct calls, a fixed clock)
  fresh()
  const lib = signer()
  eq(lib.VERIFIED_ID_TTL_MS, 30000, 'TTL is 30 s')
  let now = 1_000_000
  const deps = who => ({ sessionUser: async () => who, now: () => now })
  const signs = async (who, sent = UID) => Object.keys(await lib.directorRestSignHeaders(sent, 'GET', { ...deps(who), path: '/p' })).length === 1
  state.dbRows = new Map([[`id:${UID}`, UID], ['id:u2', 'u2']]); state.dbReads = 0; state.dbWheres = []
  ok(await signs({ id: UID }), 'first call signs'); eq(state.dbReads, 1, 'first call reads the DB')
  now += 29_999; ok(await signs({ id: UID }), 'inside 30 s signs'); eq(state.dbReads, 1, 'inside 30 s: no DB read (polling)')
  ok(await signs({ id: 'u2' }, 'u2'), 'another user signs'); eq(state.dbReads, 2, 'another user: its own DB read'); eq(state.dbWheres[1], { id: 'u2' }, 'looked up by its own id')
  ok(!(await signs({ id: 'u2' }, UID)), 'the cache never lends one user\'s id to another sent id')
  now += 1; ok(await signs({ id: UID }), 'at 30 s signs'); eq(state.dbReads, 3, 'at 30 s: read again')
  state.dbRows.delete('id:u3'); now += 1; ok(!(await signs({ id: 'u3' }, 'u3')), 'no row: no header'); state.dbRows.set('id:u3', 'u3'); ok(await signs({ id: 'u3' }, 'u3'), 'a miss is not cached: the next call finds the new row')
  delete env[FLAG]; state.dbReads = 0; ok(!(await signs({ id: UID })), 'flag off: nothing, even with a cached id'); eq(state.dbReads, 0, 'flag off: no read')
  env[FLAG] = 'true'
}

// ---- 7. the house pattern (git): own commit by subject, strip identity, env block, registry lines
const strip = await import('./studio-director-rest-sign-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
const OWN = (() => { try { return git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^Director sign', 'HEAD').trim() || null } catch { return null } })()
function housePattern(stripFn) {
  ok(OWN, 'scope: a commit named "Director sign ..." is in HEAD')
  ok(git('log', '-1', '--format=%s', OWN).startsWith('Director sign'), 'scope: the commit is named "Director sign ..."')
  const own = git('diff-tree', '--no-commit-id', '--name-only', '-r', OWN).split('\n').filter(Boolean)
  eq(own.filter(rel => !strip.DIRECTOR_REST_SIGN_SCOPE_FILES.has(rel)), [], 'scope: the own commit touches only this change\'s files')
  const changed = git('diff', '--name-only', `${strip.BASE_COMMIT}..${OWN}`).split('\n').filter(Boolean)
  eq(changed.filter(rel => !strip.DIRECTOR_REST_SIGN_SCOPE_FILES.has(rel)), [], 'scope: BASE..own touches only this change\'s files')
  for (const rel of strip.DIRECTOR_REST_SIGN_FILES) {
    const head = git('show', `${OWN}:${rel}`), base = git('show', `${strip.BASE_COMMIT}:${rel}`)
    ok(head !== base, `${rel}: changed`)
    eq(stripFn(rel, head), base, `${rel}: stripped, it is the base byte for byte`)
    const added = git('diff', '-U0', `${strip.BASE_COMMIT}..${OWN}`, '--', rel).split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'))
    eq(added.filter(l => !strip.DIRECTOR_REST_SIGN_MARKER_RE.test(l)), [], `${rel}: every added line carries the marker`)
    for (const [has] of strip.DIRECTOR_REST_SIGN_EDITS[rel] || []) eq(head.split('\n').filter(l => l === has).length, 1, `${rel}: a replaced line occurs once`)
  }
  eq(stripFn('app/builder/page.tsx', 'x DIRECTOR-REST-SIGN\n'), 'x DIRECTOR-REST-SIGN\n', 'strip: a file it does not own is untouched')
  eq(stripFn(strip.DIRECTOR_REST_SIGN_FILES[0], 'a // DIRECTOR-REST-SIGN-X\nb // X-DIRECTOR-REST-SIGN\n'), 'a // DIRECTOR-REST-SIGN-X\nb // X-DIRECTOR-REST-SIGN\n', 'strip: the marker is a whole token')
  eq(git('show', `${OWN}:.env.example`), `${git('show', `${strip.BASE_COMMIT}:.env.example`)}\n${strip.DIRECTOR_REST_SIGN_ENV_BLOCK}`, '.env.example is the base plus the block')
  ok(/^STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED="false"$/m.test(strip.DIRECTOR_REST_SIGN_ENV_BLOCK), 'the block sets the flag off')
  const regAdded = git('diff', '-U0', `${strip.BASE_COMMIT}..${OWN}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l))
  eq(regAdded.length, 3, 'registry: three lines, added')
  ok(regAdded.every(l => l.startsWith('+') && l.includes('LATER-CHANGE') && l.includes('studio-director-rest-sign-strip.mjs')), 'registry: each line is a LATER-CHANGE line naming this strip')
  ok(registry.LATER_STRIPS.includes(strip.stripDirectorRestSign) && registry.LATER_ENV_BLOCKS.includes(strip.DIRECTOR_REST_SIGN_ENV_BLOCK) && [...strip.DIRECTOR_REST_SIGN_SCOPE_FILES].every(f => registry.LATER_CHANGE_FILES.has(f)), 'registry: the strip, the block and the files are registered')
}

// ---- statics: client code never imports the signer
for (const dir of ['components', 'hooks']) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
  for (const f of walk(path.join(root, dir))) ok(!fs.readFileSync(f, 'utf8').includes('studio-director-rest-sign'), `client import ${f}`)
}

await suite()
housePattern(strip.stripDirectorRestSign)
const realChecks = checks

// ---- 8. mutants
const SIGN_SRC = read(SIGN)
const MUTANTS = [
  ['drop the verified !== sentUserId check', 'if (!verified || verified !== sentUserId) {', 'if (!verified) {'],
  ['read the flag as truthy', "return process.env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED === 'true'", 'return !!process.env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED'],
  ['no cache: every call reads the DB', 'if (hit && now - hit.at < VERIFIED_ID_TTL_MS) return hit.id', 'if (false) return hit?.id'],
  ['cache forever', 'if (hit && now - hit.at < VERIFIED_ID_TTL_MS) return hit.id', 'if (hit) return hit.id'],
  ['cache key shared across users', "const key = 'id' in where ? `id:${where.id}` : `email:${where.email}`", "const key = 'k'"],
  ['cache a miss', "if (typeof id === 'string' && id) verifiedIdCache.set(key, { id, at: now })", "verifiedIdCache.set(key, { id: id as string, at: now })"],
  ['no path claim', '...(options.path ? { path: options.path } : {})', ''],
  ['no fallback log', "if (verified && sentUserId.includes('@')) {", 'if (false) {'],
  ['log on every mismatch', "if (verified && sentUserId.includes('@')) {", 'if (true) {'],
]
const survivors = []
for (const [name, from, to] of MUTANTS) {
  assert.equal(SIGN_SRC.split(from).length, 2, `mutant "${name}" matches the source once`)
  overrides.set(SIGN, SIGN_SRC.replace(from, () => to))
  let caught = false
  try { await suite() } catch { caught = true }
  overrides.delete(SIGN)
  if (!caught) survivors.push(name)
}
const STRIP_MUTANTS = [
  ['strip keeps marked lines', (rel, text) => text],
  ['strip does not put replaced lines back', (rel, text) => strip.DIRECTOR_REST_SIGN_FILES.includes(rel) ? text.split('\n').filter(l => !strip.DIRECTOR_REST_SIGN_MARKER_RE.test(l)).join('\n') : text],
  ['strip matches the marker as a substring', (rel, text) => strip.DIRECTOR_REST_SIGN_FILES.includes(rel) ? strip.stripDirectorRestSign(rel, text).split('\n').filter(l => !l.includes('DIRECTOR-REST-SIGN')).join('\n') : text],
]
for (const [name, fn] of STRIP_MUTANTS) { let caught = false; try { housePattern(fn) } catch { caught = true } if (!caught) survivors.push(name) }
fresh(); await suite() // the real module once more, clean
assert.deepEqual(survivors, [], `every mutant is caught (survivors: ${survivors.join('; ') || 'none'})`)
console.log(`ok - studio director REST sign: ${realChecks} checks (golden vector, ${ROUTES.length} routes x flag off/on, no-header cases, e-mail fallback log, 30 s cache, path claim, house pattern), ${MUTANTS.length + STRIP_MUTANTS.length} mutants all caught`)
