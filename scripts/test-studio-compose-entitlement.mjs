// FRONTEND-2: Add Slide's compose proxy signs its user for Director (STUDIO_COMPOSE_ENTITLEMENT_ENABLED, a SERVER env, exact "true", default off; stacked on #475).
// Director !535 (DIRECTOR_ROUTER_COMPOSE_BIND_USER_ENABLED, off) binds a compose to its user for Model Router attribution ONLY when the request carries a verified
// X-Deckster-Entitlement (typ "rest", m "POST", sub == the body's user_id) and clean_id(sub) == sub. Today POST /api/slides/compose sends none, so !535 is inert.
//
//   node scripts/test-studio-compose-entitlement.mjs                 # everything, offline, plain node (transpile + vm; no network, no build, no browser, no secrets)
//   node scripts/test-studio-compose-entitlement.mjs --no-mutants
//   node scripts/test-studio-compose-entitlement.mjs --write-recorded  # rewrite scripts/fixtures/studio-compose-entitlement/recorded-request.json from the real route
//
// What it proves (the REAL route handler, loaded the way test-studio-deck-import.mjs loads its routes; getServerSession, Prisma and fetch stubbed; every secret made up at run time):
//  1. flag off (unset and ten other spellings, with the shared helper's flag and secret ON): the outbound request (url, method, header names and order, body, init keys) and the
//     response are byte-equal to BASE_COMMIT's route for the same input; no header; neither the shared flag nor the secret is even read;
//  2. flag on, canonical id: ONE X-Deckster-Entitlement header; an independent verifier (written from the contract, importing nothing of the minter) accepts its signature with the
//     run-time secret and finds exactly {v:1, typ:"rest", sub, iat, exp, m:"POST"} with sub === the body's user_id === the session id; everything else equals the base request;
//  3. flag on, no header and the request equal to the base's: an e-mail-only session (with or without an "@"), an id that fails clean_id (a table), the shared flag off or spelled
//     differently, no secret;
//  4. the Knowledge-Graph branch: sub is the GATE's id (the body's user_id there), the KG headers are untouched; a gate id that fails clean_id gets no header; a refused gate sends nothing;
//  5. clean_id, mirrored exactly: 877 candidate ids RECORDED from Director's real clean_id (scripts/fixtures/studio-compose-entitlement/clean-id-recorded.json), replayed against the lib;
//  6. mint per request (two users, two clocks: nothing cached), nothing in the response, 401 / 404 / 400 / 502 unchanged;
//  7. the recorded request for DIRECTOR-2 (scripts/fixtures/studio-compose-entitlement/recorded-request.json): the real route's outbound requests, signature redacted to a length;
//  8. statics: the minter is reached from this route only, no client module, no NEXT_PUBLIC_ alias, the .env.example block, the strip module, the three strip roots, STACKED_PASS3_FILES,
//     and a secret scan of every added line;
//  9. mutants (flag spelling, e-mail minted, sub != body, wrong m, wrong typ, minted with the flag off, body changed, clean_id dropped, unanchored, u flag, whitespace, length 256 ...): each caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { stripComposeEntitlement, BASE_COMMIT, COMPOSE_ENTITLEMENT_FILES, COMPOSE_ENTITLEMENT_NEW_FILES } from './studio-compose-entitlement-strip.mjs'
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripPublishReviewFit } from './studio-publish-review-fit-strip.mjs' // stacked: #492, below this change
import { stripVersionHistoryDeckOnly } from './studio-version-history-deck-only-strip.mjs' // stacked: #493, below this change
import { stripPublishPreviewInventory } from './studio-publish-preview-inventory-strip.mjs' // stacked: #495, after this change
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { STACKED_PASS3_FILES, isBaseFile } from './studio-library-manage-harness.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
const baseFile = rel => git('show', `${BASE_COMMIT}:${rel}`)
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const args = new Set(process.argv.slice(2))

const ROUTE = 'app/api/slides/compose/route.ts'
const LIB = 'lib/studio-compose-entitlement.ts'
const HELPER = 'lib/director-rest-entitlement.ts'
const REAL = [ROUTE, LIB, HELPER, 'lib/kg-proxy.ts', 'lib/kg-entitlement.ts', 'lib/service-url.ts']
const ENV = '.env.example'
const CLEAN_ID_FIXTURE = 'scripts/fixtures/studio-compose-entitlement/clean-id-recorded.json'
const RECORDED = 'scripts/fixtures/studio-compose-entitlement/recorded-request.json'
const FLAG = 'STUDIO_COMPOSE_ENTITLEMENT_ENABLED'
const HEADER = 'X-Deckster-Entitlement'
const BASE_ROUTE = baseFile(ROUTE)

const ID = 'clx9Kq2m0000AbCd1234efGh' // a canonical id: mixed case, digits
const KG_ID = 'gate_user.7f3a:2' // the KG gate's id: uses . _ : too
const OTHER_ID = 'user-2.Zq9'
const EMAIL = 'person@example.test'
const DIRECTOR = 'https://director.example.test'
const FIXED_NOW = 1790000000
// made up for this run only: never a literal, never printed
const TEST_SECRET = crypto.randomBytes(24).toString('hex')
const OTHER_SECRET = crypto.randomBytes(24).toString('hex')
const KG_KEY = crypto.randomBytes(12).toString('hex')

// ---------------------------------------------------------------- loading: transpile + vm, a closed list of imports, a source override for mutants
let OVER = {}
const src = (rel, texts = {}) => texts[rel] ?? OVER[rel] ?? read(rel)
const compiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!compiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
    assert.equal((out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `${rel} compiles`)
    compiled.set(key, out.outputText)
  }
  return compiled.get(key)
}
function createWorld({ stubs = {}, globals = {}, texts = {} }) {
  const cache = new Map()
  const resolve = (spec, from) => {
    if (!spec.startsWith('@/') && !spec.startsWith('.')) return null
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(from), spec))
    return ['.ts', '.tsx'].map(suffix => base + suffix).find(file => fs.existsSync(path.join(root, file))) ?? null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    const rel = resolve(spec, from)
    if (rel && REAL.includes(rel)) return load(rel)
    return assert.fail(`${from} asked for an import nobody handed in: ${spec}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const mod = { exports: {} }
    cache.set(rel, mod.exports)
    const context = { module: mod, exports: mod.exports, console, URL, URLSearchParams, Buffer, Response, Request, Headers, ...globals, require: spec => requireFor(spec, rel) }
    vm.runInNewContext(compile(rel, src(rel, texts)), context, { filename: rel })
    cache.set(rel, mod.exports)
    return mod.exports
  }
  return { load }
}

// ---------------------------------------------------------------- the independent verifier of the REST entitlement header (written from F-rest-entitlement.md; imports nothing of the minter)
function verifyRestHeader(header, secret, { method, sub, now }) {
  const fail = why => ({ ok: false, why })
  if (typeof header !== 'string' || Buffer.byteLength(header, 'utf8') > 4096) return fail('shape')
  const parts = header.split('.')
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return fail('shape')
  const expected = crypto.createHmac('sha256', secret).update('deckster-rest-v1.' + parts[0], 'ascii').digest()
  const got = Buffer.from(parts[1], 'base64url')
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return fail('signature')
  const claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
  if (claims.v !== 1 || claims.typ !== 'rest' || 'sid' in claims) return fail('claims')
  if (claims.m !== method) return fail('method')
  if (sub !== undefined && claims.sub !== sub) return fail('sub')
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.exp - claims.iat !== 120) return fail('lifetime')
  if (now < claims.iat - 60 || now >= claims.exp) return fail('expired')
  return { ok: true, claims, payload: parts[0], signature: parts[1] }
}

// ---------------------------------------------------------------- a rig for the REAL route: stubs for the session, Prisma, Next and Director
const ON = { [FLAG]: 'true', DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'true', DIRECTOR_WS_AUTH_SECRET: TEST_SECRET }
const SESSION_IN = { user: { id: ID, email: EMAIL } }
function routeRig({ texts = {}, env = {}, sessions = [SESSION_IN], gate = 'entitled', clock = { seconds: FIXED_NOW }, director } = {}) {
  const envObject = Object.fromEntries(Object.entries({ NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED: 'true', SLIDE_COMPOSER_DIRECTOR_URL: DIRECTOR, ...env }).filter(([, value]) => value !== undefined))
  const reads = []
  const envProxy = new Proxy(envObject, { get: (target, key) => { reads.push(String(key)); return target[key] } })
  const calls = { session: 0, fetch: [] }
  const outbound = async (url, init) => {
    calls.fetch.push({ url: String(url), init })
    if (director) return director(String(url), init)
    return new Response(JSON.stringify({ status: 'ok', slide_index: 2 }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const stubs = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) }, NextRequest: Request },
    'next-auth': { getServerSession: async () => { const entry = sessions[Math.min(calls.session, sessions.length - 1)]; calls.session++; return entry } },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ tier: gate === 'entitled' ? 'pro' : 'free' }) } } },
    '@/lib/stripe/stripe-utils': { getUserSubscription: async () => (gate === 'entitled' ? { status: 'active', tier: 'pro' } : null) },
    crypto,
  }
  const world = createWorld({ stubs, texts, globals: { process: { env: envProxy }, fetch: outbound, Date: { now: () => clock.seconds * 1000 } } })
  const post = async (body, { raw } = {}) => {
    const { POST } = world.load(ROUTE)
    const res = await POST(new Request('http://localhost/api/slides/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) }))
    const json = await res.clone().json().catch(() => null)
    return { res, json, sent: calls.fetch.at(-1) ?? null, count: calls.fetch.length }
  }
  const lib = () => world.load(LIB)
  return { post, calls, reads, lib, clock, env: envObject }
}
/** What Director would receive, as plain data (names AND order of the headers, the body string, the init keys). */
function wire(sent) {
  if (!sent) return null
  const headers = sent.init.headers instanceof Headers ? [...sent.init.headers] : Object.entries(sent.init.headers)
  return { url: sent.url, method: sent.init.method, headers, body: sent.init.body, cache: sent.init.cache, keys: Object.keys(sent.init) }
}
const withoutEntitlement = w => ({ ...w, headers: w.headers.filter(([name]) => name !== HEADER) })
const entitlementOf = w => w.headers.filter(([name]) => name === HEADER)
const SECRET_READS = ['DIRECTOR_WS_AUTH_SECRET', 'DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED']
const BODY = { slide_type: 'content', prompt: 'A slide about onboarding', insert_after_index: 1, user_id: 'client-supplied-id', research: { use_knowledge_graph: false } }
const BODY_KG = { ...BODY, research: { use_knowledge_graph: true } }

/** The base route (BASE_COMMIT) and this route, same input: both outbound requests and both responses. */
async function both(options, body = BODY) {
  const base = routeRig({ ...options, texts: { [ROUTE]: BASE_ROUTE } })
  const mine = routeRig(options)
  const [b, m] = [await base.post(body), await mine.post(body)]
  return { base, mine, b, m, bw: wire(b.sent), mw: wire(m.sent) }
}
const bodyOf = w => JSON.parse(w.body)

// ---------------------------------------------------------------- the checks (one suite: the normal run prints, a mutant run collects what catches it)
let checks = 0
const failures = []
const mode = { collect: null }
async function t(label, fn) {
  if (mode.collect) { try { await fn() } catch { mode.collect.push(label) } return }
  try { await fn(); checks++; console.log(`PASS ${label}`) } catch (error) { failures.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 900)}`) }
}

const FLAG_OFF_SPELLINGS = [undefined, 'false', '', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'enabled']
const label = value => (value === undefined ? 'unset' : JSON.stringify(value))

/** [id, why] pairs: ids Director's clean_id(id) == id refuses (each is also in the recorded corpus or follows its rule). */
const BAD_IDS = [
  [' abc', 'leading space'], ['abc ', 'trailing space'], ['abc\n', 'trailing newline'], ['\tabc', 'leading tab'], ['ab cd', 'inner space'], ['a@b.co', 'an @'], ['-abc', 'leading hyphen'],
  ['.abc', 'leading dot'], ['_abc', 'leading underscore'], [':abc', 'leading colon'], ['abc/def', 'slash'], ['abç', 'non-ASCII letter'], ['é123', 'leading non-ASCII letter'], ['٣abc', 'Arabic-Indic digit'],
  ['ａbc', 'fullwidth letter'], ['abc ', 'no-break space'], ['a'.repeat(256), '256 characters'], ['abc\u0000', 'NUL'], ["user'--", 'quote'], ['A1‮', 'bidi control'],
]
const GOOD_IDS = ['a', '0', 'Z9', 'abc.def', 'a_b', 'a:b', 'a-b', 'a'.repeat(255), `A${'-'.repeat(254)}`, `9${'.'.repeat(254)}`, ID, KG_ID, OTHER_ID, '123e4567-e89b-12d3-a456-426614174000']

async function suite() {
  // ---- 1. flag off: byte-identical to the base route
  for (const spelling of FLAG_OFF_SPELLINGS) {
    await t(`flag off (${label(spelling)}), the shared flag and the secret ON: the request and the response are the base route's, no header, nothing secret read`, async () => {
      const { m, b, mw, bw, mine } = await both({ env: { ...ON, [FLAG]: spelling } })
      assert.deepEqual(mw, bw)
      assert.equal(sha(mw), sha(bw))
      assert.deepEqual(entitlementOf(mw), [])
      assert.equal(m.res.status, b.res.status)
      assert.deepEqual(m.json, b.json)
      assert.deepEqual(mine.reads.filter(name => SECRET_READS.includes(name)), [], 'the shared flag and the secret are not even read')
    })
  }
  await t('flag off: the same for an e-mail-only session, the KG branch and a Director failure', async () => {
    for (const [options, body] of [
      [{ env: { ...ON, [FLAG]: undefined }, sessions: [{ user: { email: EMAIL } }] }, BODY],
      [{ env: { ...ON, [FLAG]: undefined }, sessions: [SESSION_IN, SESSION_IN] }, BODY_KG],
      [{ env: { ...ON, [FLAG]: 'false' }, director: async () => { throw new Error('connection refused') } }, BODY],
      [{ env: { ...ON, [FLAG]: undefined }, director: async () => new Response('{"detail":"nope"}', { status: 422 }) }, BODY],
    ]) {
      const { m, b, mw, bw } = await both(options, body)
      assert.deepEqual(mw, bw)
      assert.equal(m.res.status, b.res.status)
      assert.deepEqual(m.json, b.json)
    }
  })

  // ---- 2. flag on, canonical id
  await t('flag on, canonical session id: one header, verified with the run-time secret; typ rest, m POST, sub === the body user_id === the id; nothing else differs from the base request', async () => {
    const { m, mw, bw } = await both({ env: ON })
    const found = entitlementOf(mw)
    assert.equal(found.length, 1, 'exactly one X-Deckster-Entitlement header')
    const verdict = verifyRestHeader(found[0][1], TEST_SECRET, { method: 'POST', sub: ID, now: FIXED_NOW })
    assert.equal(verdict.ok, true, `the verifier accepts it (${verdict.why ?? ''})`)
    assert.deepEqual(Object.keys(verdict.claims), ['v', 'typ', 'sub', 'iat', 'exp', 'm'], 'no sid, no bq, nothing else')
    assert.equal(verdict.claims.typ, 'rest')
    assert.equal(verdict.claims.m, 'POST')
    assert.equal(verdict.claims.sub, ID)
    assert.equal(verdict.claims.sub, bodyOf(mw).user_id, 'sub === the body user_id')
    assert.equal(bodyOf(mw).user_id, ID, 'the body user_id is the session id, not the client-supplied one')
    assert.equal(verifyRestHeader(found[0][1], OTHER_SECRET, { method: 'POST', now: FIXED_NOW }).ok, false, 'another secret does not verify')
    assert.equal(verifyRestHeader(found[0][1], TEST_SECRET, { method: 'GET', now: FIXED_NOW }).ok, false, 'a GET does not verify')
    assert.deepEqual(withoutEntitlement(mw), bw, 'url, method, the other headers and their order, the body bytes and the init keys are the base request')
    assert.equal(m.res.status, 200)
    assert.ok(!JSON.stringify([...m.res.headers]).includes(HEADER) && !JSON.stringify(m.json).includes(verdict.signature), 'the header never reaches the browser')
  })
  await t('flag on, a session with an id AND an e-mail: the id is used (never the e-mail), same as the base', async () => {
    const { mw, bw } = await both({ env: ON })
    assert.equal(bodyOf(mw).user_id, ID)
    assert.equal(bodyOf(bw).user_id, ID)
  })

  // ---- 3. flag on, no header
  for (const [name, session] of [
    ['an e-mail-only session', { user: { email: EMAIL } }],
    ['an e-mail-only session whose e-mail has no @ (only the canonical rule can refuse it)', { user: { email: 'plainname' } }],
    ['a session whose id is null', { user: { id: null, email: 'plainname' } }],
  ]) {
    await t(`flag on, ${name}: no header, the body is the base body (user_id = the e-mail)`, async () => {
      const { mw, bw, m, b } = await both({ env: ON, sessions: [session] })
      assert.deepEqual(entitlementOf(mw), [])
      assert.deepEqual(mw, bw)
      assert.equal(bodyOf(mw).user_id, session.user.email)
      assert.equal(m.res.status, b.res.status)
    })
  }
  for (const [id, why] of BAD_IDS) {
    await t(`flag on, session id fails clean_id (${why}): no header, request equal to the base`, async () => {
      const { mw, bw } = await both({ env: ON, sessions: [{ user: { id, email: EMAIL } }] })
      assert.deepEqual(entitlementOf(mw), [])
      assert.deepEqual(mw, bw)
      assert.equal(bodyOf(mw).user_id, id, 'the body user_id is still chosen exactly as before')
    })
  }
  for (const id of GOOD_IDS) {
    await t(`flag on, a valid id (${id.length > 30 ? `${id.length} characters` : id}): header, sub === the body user_id === the id`, async () => {
      const { mw, bw } = await both({ env: ON, sessions: [{ user: { id, email: EMAIL } }] })
      const found = entitlementOf(mw)
      assert.equal(found.length, 1)
      assert.equal(verifyRestHeader(found[0][1], TEST_SECRET, { method: 'POST', sub: id, now: FIXED_NOW }).ok, true)
      assert.equal(bodyOf(mw).user_id, id)
      assert.deepEqual(withoutEntitlement(mw), bw)
    })
  }
  for (const [name, env] of [
    ['the shared helper flag off', { ...ON, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: undefined }],
    ['the shared helper flag "false"', { ...ON, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'false' }],
    ['the shared helper flag "TRUE"', { ...ON, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'TRUE' }],
    ['no secret', { ...ON, DIRECTOR_WS_AUTH_SECRET: undefined }],
    ['an empty secret', { ...ON, DIRECTOR_WS_AUTH_SECRET: '' }],
  ]) {
    await t(`flag on but ${name}: no header, request equal to the base`, async () => {
      const { mw, bw } = await both({ env })
      assert.deepEqual(entitlementOf(mw), [])
      assert.deepEqual(mw, bw)
    })
  }

  // ---- 4. the Knowledge-Graph branch
  await t('flag on, KG branch: sub = the GATE id = the body user_id (not the first session read); the KG headers are untouched', async () => {
    const options = { env: { ...ON, KNOWLEDGE_API_KEY: KG_KEY }, sessions: [{ user: { id: 'route-session-id', email: EMAIL } }, { user: { id: KG_ID, email: EMAIL } }] }
    const { mw, bw } = await both(options, BODY_KG)
    assert.equal(bodyOf(bw).user_id, KG_ID, 'base: the body carries the gate id')
    assert.equal(bodyOf(mw).user_id, KG_ID)
    const found = entitlementOf(mw)
    assert.equal(found.length, 1)
    const verdict = verifyRestHeader(found[0][1], TEST_SECRET, { method: 'POST', sub: KG_ID, now: FIXED_NOW })
    assert.equal(verdict.ok, true)
    assert.equal(verdict.claims.sub, bodyOf(mw).user_id)
    assert.deepEqual(withoutEntitlement(mw), bw, 'including the X-API-Key header and its place')
    assert.ok(bw.headers.some(([name, value]) => name === 'X-API-Key' && value === KG_KEY))
  })
  await t('flag on, KG branch with a gate id that fails clean_id: no header, request equal to the base', async () => {
    const options = { env: ON, sessions: [{ user: { id: ID, email: EMAIL } }, { user: { id: 'gate id', email: EMAIL } }] }
    const { mw, bw } = await both(options, BODY_KG)
    assert.deepEqual(entitlementOf(mw), [])
    assert.deepEqual(mw, bw)
    assert.equal(bodyOf(mw).user_id, 'gate id')
  })
  await t('flag on, KG branch refused (not entitled / no session): the same answer as the base, nothing sent to Director, no secret read', async () => {
    for (const options of [{ env: ON, gate: 'free' }, { env: ON, sessions: [SESSION_IN, null] }]) {
      const { m, b, mine } = await both(options, BODY_KG)
      assert.equal(m.count, 0)
      assert.equal(m.res.status, b.res.status)
      assert.deepEqual(m.json, b.json)
      assert.deepEqual(mine.reads.filter(name => SECRET_READS.includes(name)), [])
    }
  })

  // ---- 5. clean_id, mirrored exactly (Director's real answers, recorded)
  await t('clean_id: the lib answers like Director\'s real clean_id for every one of the recorded ids (a header is minted exactly when Director binds)', async () => {
    const recorded = JSON.parse(read(CLEAN_ID_FIXTURE))
    assert.ok(recorded.cases.length >= 800 && recorded.cases.some(c => c.ok) && recorded.cases.some(c => !c.ok))
    const { composeEntitlementHeaders, isComposeEntitlementId } = routeRig({ env: ON }).lib()
    const wrong = []
    for (const c of recorded.cases) {
      const id = c.parts.map(([unit, times]) => unit.repeat(times)).join('')
      const minted = Object.keys(composeEntitlementHeaders(id, id)).length === 1
      if (minted !== c.ok || isComposeEntitlementId(id) !== c.ok) wrong.push(JSON.stringify(id).slice(0, 40))
    }
    assert.deepEqual(wrong, [])
  })
  await t('clean_id: the rule\'s edges, stated plainly', async () => {
    const { isComposeEntitlementId: ok } = routeRig({ env: ON }).lib()
    assert.equal(ok('a'), true); assert.equal(ok('a'.repeat(255)), true); assert.equal(ok('a'.repeat(256)), false); assert.equal(ok(''), false)
    assert.equal(ok('a b'), false); assert.equal(ok(' a'), false); assert.equal(ok('a\n'), false); assert.equal(ok('a@b.c'), false); assert.equal(ok('_a'), false); assert.equal(ok('٣'), false)
    assert.equal(ok(null), false); assert.equal(ok(undefined), false); assert.equal(ok(42), false)
  })
  await t('the lib never throws: odd inputs give {}', async () => {
    const { composeEntitlementHeaders } = routeRig({ env: ON }).lib()
    for (const [a, b] of [[ID, null], [ID, undefined], [ID, ''], [ID, OTHER_ID], ['', ''], [null, null], [undefined, undefined], [42, 42], [{}, {}], [ID, ID.toUpperCase()]]) {
      assert.equal(Object.keys(composeEntitlementHeaders(a, b)).length, 0)
    }
  })

  // ---- 6. per request, nothing else moves
  await t('minted per request: two users and two clocks give two different headers, each for its own user (nothing cached or shared)', async () => {
    const clock = { seconds: FIXED_NOW }
    const rigs = routeRig({ env: ON, sessions: [{ user: { id: ID, email: EMAIL } }], clock })
    const first = await rigs.post(BODY)
    clock.seconds += 30
    const again = await rigs.post(BODY)
    const a = entitlementOf(wire(first.sent))[0][1], b = entitlementOf(wire(again.sent))[0][1]
    assert.notEqual(a, b)
    assert.equal(verifyRestHeader(b, TEST_SECRET, { method: 'POST', sub: ID, now: clock.seconds }).claims.iat, FIXED_NOW + 30)
    const second = routeRig({ env: ON, sessions: [{ user: { id: OTHER_ID, email: EMAIL } }] })
    const other = entitlementOf(wire((await second.post(BODY)).sent))[0][1]
    assert.equal(verifyRestHeader(other, TEST_SECRET, { method: 'POST', sub: OTHER_ID, now: FIXED_NOW }).ok, true)
    const sameWorld = routeRig({ env: ON, sessions: [{ user: { id: ID, email: EMAIL } }, { user: { id: OTHER_ID, email: EMAIL } }] })
    await sameWorld.post(BODY)
    const second2 = entitlementOf(wire((await sameWorld.post(BODY)).sent))[0][1]
    assert.equal(verifyRestHeader(second2, TEST_SECRET, { method: 'POST', sub: OTHER_ID, now: FIXED_NOW }).ok, true, 'the second user in the same module instance is signed for herself')
  })
  await t('401 (no session), 404 (composer off), 400 (bad JSON), 502 / 503: unchanged and nothing signed', async () => {
    for (const [options, raw, status] of [
      [{ env: ON, sessions: [null] }, undefined, 401],
      [{ env: ON, sessions: [{ user: {} }] }, undefined, 401],
      [{ env: { ...ON, NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED: undefined } }, undefined, 404],
      [{ env: ON }, '{not json', 400],
      [{ env: ON, director: async () => { throw new Error('boom') } }, undefined, 502],
      [{ env: { ...ON, SLIDE_COMPOSER_DIRECTOR_URL: undefined } }, undefined, 503],
    ]) {
      const base = routeRig({ ...options, texts: { [ROUTE]: BASE_ROUTE } }), mine = routeRig(options)
      const [b, m] = [await base.post(BODY, { raw }), await mine.post(BODY, { raw })]
      assert.equal(b.res.status, status); assert.equal(m.res.status, status)
      assert.deepEqual(m.json, b.json)
      assert.deepEqual(m.sent ? withoutEntitlement(wire(m.sent)) : null, wire(b.sent), 'the same request, bar the one header, when one is sent at all')
      if (status === 401 || status === 404 || status === 400) assert.equal(m.count, 0, 'nothing is sent')
      if (status === 401 || status === 404) assert.deepEqual(mine.reads.filter(name => SECRET_READS.includes(name)), [], 'the secret is not read before the login check')
    }
  })
  await t('Director\'s answer passes through exactly (status and body), flag on', async () => {
    const answer = { status: 'success', slide: { html: '<div>hi</div>' } }
    const { m, b } = await both({ env: ON, director: async () => new Response(JSON.stringify(answer), { status: 201 }) })
    assert.equal(m.res.status, 201); assert.equal(b.res.status, 201)
    assert.deepEqual(m.json, answer)
  })
  await t('the client cannot choose the signed id: a body user_id of another person is replaced, and the header carries the session id', async () => {
    const { mw } = await both({ env: ON }, { ...BODY, user_id: OTHER_ID })
    assert.equal(bodyOf(mw).user_id, ID)
    assert.equal(verifyRestHeader(entitlementOf(mw)[0][1], TEST_SECRET, { method: 'POST', sub: ID, now: FIXED_NOW }).ok, true)
  })

  // ---- 8a. statics that follow the (possibly mutated) sources
  await t('statics: one signing call, in the route only; no client module; the flag is a server variable', async () => {
    const route = src(ROUTE), lib = src(LIB)
    assert.equal((route.match(/composeEntitlementHeaders\(/g) ?? []).length, 1)
    assert.equal((route.match(/\bfetch\(/g) ?? []).length, 1)
    assert.match(route, /composeEntitlementHeaders\(payload\.user_id, canonicalUserId\)/)
    assert.match(route, /let canonicalUserId: string \| null = sessionUser\?\.id \|\| null/)
    assert.match(route, /canonicalUserId = gate\.userId/)
    assert.doesNotMatch(route, /'use client'|"use client"/)
    assert.doesNotMatch(lib, /'use client'|"use client"/)
    assert.doesNotMatch(lib.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /DIRECTOR_WS_AUTH_SECRET|NEXT_PUBLIC_/, 'the lib never reads the secret itself and has no NEXT_PUBLIC_ name')
    assert.match(lib, /process\.env\.STUDIO_COMPOSE_ENTITLEMENT_ENABLED === 'true'/)
    assert.match(lib, /restEntitlementHeaders\(bodyUserId, 'POST'\)/)
  })
}

// ---------------------------------------------------------------- the recorded request for DIRECTOR-2
async function recordedRequest() {
  const cases = []
  const record = async (name, why, options, body = BODY) => {
    const r = routeRig(options)
    const { sent } = await r.post(body)
    const w = wire(sent)
    const headers = {}
    let claim = null
    for (const [key, value] of w.headers) {
      if (key !== HEADER) { headers[key] = value; continue }
      const verdict = verifyRestHeader(value, TEST_SECRET, { method: 'POST', now: options.clock.seconds })
      assert.equal(verdict.ok, true)
      claim = verdict.claims
      assert.equal(Buffer.from(verdict.payload, 'base64url').toString('utf8'), JSON.stringify(claim), 'the payload is the compact JSON of the claim')
      headers[key] = `<base64url of payload_json: ${verdict.payload.length} chars>.<HMAC-SHA256, base64url, ${verdict.signature.length} chars, redacted>`
    }
    cases.push({
      case: name, why,
      env: { [FLAG]: options.env[FLAG] ?? null, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: options.env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED ?? null, DIRECTOR_WS_AUTH_SECRET: options.env.DIRECTOR_WS_AUTH_SECRET ? '<set at run time, not recorded>' : null },
      request: { url: w.url, method: w.method, headers, body: JSON.parse(w.body) },
      entitlement_claim: claim,
      payload_json: claim ? JSON.stringify(claim) : null,
      bound_by_director_535: claim !== null && claim.typ === 'rest' && claim.m === 'POST' && claim.sub === JSON.parse(w.body).user_id,
    })
  }
  const clock = () => ({ seconds: FIXED_NOW })
  await record('canonical_session_id', 'flag on, the session has a canonical id: header minted', { env: ON, clock: clock() })
  await record('kg_gate_id', 'flag on, the Knowledge-Graph branch: sub is the gate id', { env: ON, clock: clock(), sessions: [{ user: { id: KG_ID, email: EMAIL } }, { user: { id: KG_ID, email: EMAIL } }] }, BODY_KG)
  await record('email_only_session', 'flag on, the session has no id (the body carries the e-mail, as today): no header, so Director binds nothing', { env: ON, clock: clock(), sessions: [{ user: { email: EMAIL } }] })
  await record('id_fails_clean_id', 'flag on, a session id with a space (fails Director\'s clean_id): no header', { env: ON, clock: clock(), sessions: [{ user: { id: 'gate id', email: EMAIL } }] })
  await record('flag_off', 'flag off: byte-for-byte today\'s request', { env: { ...ON, [FLAG]: undefined }, clock: clock() })
  return {
    what: 'The outbound request of the REAL app/api/slides/compose/route.ts (POST to Director /api/v1/slides/compose-one) for DIRECTOR-2\'s !535 (DIRECTOR_ROUTER_COMPOSE_BIND_USER_ENABLED), produced by scripts/test-studio-compose-entitlement.mjs with getServerSession and fetch stubbed.',
    flag: `${FLAG} (server env, exact "true", default off); it also needs DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED "true" and DIRECTOR_WS_AUTH_SECRET (the shared helper's rules)`,
    header: `${HEADER}: <payload_b64>.<signature_b64>, both base64url without padding; payload_b64 = base64url(payload_json); signature_b64 = HMAC-SHA256 over the literal "deckster-rest-v1." + payload_b64 keyed with DIRECTOR_WS_AUTH_SECRET`,
    redacted: 'The signature is redacted to its length. The secret in the run is random and never recorded. iat is fixed (1790000000) so the file is deterministic: to replay, re-sign payload_json with your own test secret and a fresh iat/exp (exp - iat is 120).',
    how_director_checks: 'Binds only when the header verifies (typ rest, m POST, sub == body user_id) and clean_id(sub) == sub (director-v4.0 src/utils/mr_context.py:84,101-111).',
    cases,
  }
}

// ---------------------------------------------------------------- mutants: one source edit each; the suite must then fail somewhere
const MUTANTS = [
  ['flag spelling: any case turns it on', LIB, [["return process.env.STUDIO_COMPOSE_ENTITLEMENT_ENABLED === 'true'", "return String(process.env.STUDIO_COMPOSE_ENTITLEMENT_ENABLED).toLowerCase() === 'true'"]]],
  ['flag spelling: the variable is misspelled', LIB, [["process.env.STUDIO_COMPOSE_ENTITLEMENT_ENABLED === 'true'", "process.env.STUDIO_COMPOSE_ENTITLEMENT_ENABLE === 'true'"]]],
  ['flag spelling: any value turns it on', LIB, [["process.env.STUDIO_COMPOSE_ENTITLEMENT_ENABLED === 'true'", 'process.env.STUDIO_COMPOSE_ENTITLEMENT_ENABLED !== undefined']]],
  ['header minted when the flag is off', LIB, [['  if (!isStudioComposeEntitlementEnabled()) return {}\n  try {', '  try {']]],
  ['the flag is checked after the secret was read', LIB, [['  if (!isStudioComposeEntitlementEnabled()) return {}\n  try {', '  try {'], ["return restEntitlementHeaders(bodyUserId, 'POST')", "const minted = restEntitlementHeaders(bodyUserId, 'POST')\n    return isStudioComposeEntitlementEnabled() ? minted : {}"]]],
  ['e-mail minted: the e-mail counts as the canonical id', ROUTE, [['sessionUser?.id || null', 'sessionUser?.id || sessionUser?.email || null']]],
  ['canonical rule dropped', LIB, [["    if (typeof canonicalUserId !== 'string' || canonicalUserId === '') return {}\n    if (bodyUserId !== canonicalUserId) return {}\n", '']]],
  ['sub != body: the id is lower-cased before signing', LIB, [["restEntitlementHeaders(bodyUserId, 'POST')", "restEntitlementHeaders(bodyUserId.toLowerCase(), 'POST')"]]],
  ['sub != body: the route signs the client-supplied id', ROUTE, [['composeEntitlementHeaders(payload.user_id, canonicalUserId)', 'composeEntitlementHeaders(String(body.user_id ?? payload.user_id), canonicalUserId)']]],
  ['sub != body: the route signs the first session id, not the gate id', ROUTE, [['composeEntitlementHeaders(payload.user_id, canonicalUserId)', 'composeEntitlementHeaders(userId, canonicalUserId)']]],
  ['KG branch: the gate id is not the canonical id', ROUTE, [['    canonicalUserId = gate.userId\n', '']]],
  ['KG branch: the header is dropped there', ROUTE, [['headers: { ...directorHeaders, ...entitlement },', 'headers: useKnowledgeGraph ? directorHeaders : { ...directorHeaders, ...entitlement },']]],
  ['wrong m', LIB, [["restEntitlementHeaders(bodyUserId, 'POST')", "restEntitlementHeaders(bodyUserId, 'GET')"]]],
  ['wrong typ', HELPER, [["typ: 'rest',", "typ: 'ws',"]]],
  ['body changed (flag off too)', ROUTE, [['body: JSON.stringify(payload),', "body: JSON.stringify({ ...payload, entitled: Boolean(entitlement['X-Deckster-Entitlement']) }),"]]],
  ['body changed: the e-mail fallback is cut to its local part', ROUTE, [['const userId = sessionUser?.id || sessionUser?.email', "const userId = sessionUser?.id || sessionUser?.email?.split('@')[0]"]]],
  ['clean_id check dropped', LIB, [['    if (!isComposeEntitlementId(bodyUserId)) return {}\n', '']]],
  ['clean_id: unanchored', LIB, [['/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/', '/[A-Za-z0-9][A-Za-z0-9._:-]{0,254}/']]],
  ['clean_id: anchored at the start only', LIB, [['/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/', '/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}/']]],
  ['clean_id: anchored at the end only', LIB, [['/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/', '/[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/']]],
  ['clean_id: the u flag and Unicode letters and digits', LIB, [['/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/', '/^[\\p{L}\\p{N}][\\p{L}\\p{N}._:-]{0,254}$/u']]],
  ['clean_id: \\w (a leading underscore passes)', LIB, [['/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/', '/^\\w[\\w.:-]{0,254}$/']]],
  ['clean_id: whitespace trimmed before matching', LIB, [['COMPOSE_ENTITLEMENT_ID_PATTERN.test(value)', 'COMPOSE_ENTITLEMENT_ID_PATTERN.test(value.trim())']]],
  ['clean_id: whitespace allowed in the class', LIB, [['[A-Za-z0-9._:-]{0,254}$/', '[A-Za-z0-9._:\\s-]{0,254}$/']]],
  ['clean_id: 256 characters allowed', LIB, [['{0,254}$/', '{0,255}$/']]],
  ['clean_id: only 254 characters allowed', LIB, [['{0,254}$/', '{0,253}$/']]],
  ['cached: one header is reused across users', LIB, [['export function composeEntitlementHeaders(', 'let memo: Record<string, string> | null = null\nexport function composeEntitlementHeaders('], ["return restEntitlementHeaders(bodyUserId, 'POST')", "return (memo ??= restEntitlementHeaders(bodyUserId, 'POST'))"]]],
  ['the header is added after a failed login check (minted before the 401)', ROUTE, [['  const sessionUser = session?.user as SessionUserWithId | undefined\n', "  const sessionUser = session?.user as SessionUserWithId | undefined\n  composeEntitlementHeaders('probe', 'probe')\n"]]],
]

async function runMutants() {
  const report = []
  for (const [name, file, edits] of MUTANTS) {
    let text = read(file)
    for (const [from, to] of edits) {
      assert.equal(text.split(from).length - 1, 1, `mutant "${name}": its source text occurs once in ${file}`)
      text = text.replace(from, () => to)
    }
    OVER = { [file]: text }
    mode.collect = []
    try { await suite() } catch (error) { mode.collect.push(`suite threw: ${String(error?.message).slice(0, 60)}`) }
    const caught = mode.collect
    mode.collect = null
    OVER = {}
    report.push([name, caught.length])
    await t(`mutant caught: ${name}  (${caught.length} check${caught.length === 1 ? '' : 's'} fail${caught.length === 1 ? 's' : ''}; first: ${caught[0] ?? 'NONE'})`, async () => { assert.ok(caught.length > 0, 'a mutant survived') })
  }
  return report
}

// ================================================================ run
console.log(`base ${BASE_COMMIT.slice(0, 8)}, test secrets are random per run and never printed`)
await suite()

await t('recorded request for DIRECTOR-2 equals what the real route sends now (deterministic)', async () => {
  const fresh = await recordedRequest()
  const text = `${JSON.stringify(fresh, null, 2)}\n`
  if (args.has('--write-recorded')) fs.writeFileSync(path.join(root, RECORDED), text)
  assert.equal(read(RECORDED), text, `${RECORDED} is out of date; run with --write-recorded`)
  const got = JSON.parse(text)
  const byName = Object.fromEntries(got.cases.map(c => [c.case, c]))
  assert.equal(byName.canonical_session_id.bound_by_director_535, true)
  assert.equal(byName.kg_gate_id.bound_by_director_535, true)
  assert.equal(byName.kg_gate_id.entitlement_claim.sub, KG_ID)
  for (const name of ['email_only_session', 'id_fails_clean_id', 'flag_off']) { assert.equal(byName[name].entitlement_claim, null); assert.equal(byName[name].request.headers[HEADER], undefined) }
  assert.equal(byName.email_only_session.request.body.user_id, EMAIL)
  assert.ok(!/[A-Za-z0-9_-]{60,}/.test(text.replace(/<[^>]*>/g, '')), 'no long token-like text in the recorded file')
  assert.ok(!text.includes(TEST_SECRET) && !text.includes(OTHER_SECRET) && !text.includes(KG_KEY))
})

// ---- 8b. statics that read the tree and git
const added = rel => (fs.existsSync(path.join(root, rel)) && !git('ls-files', '--', rel).trim() ? read(rel).split('\n') : git('diff', '-U0', BASE_COMMIT, '--', rel).split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)))
const TOUCHED = [...COMPOSE_ENTITLEMENT_FILES, ...COMPOSE_ENTITLEMENT_NEW_FILES, 'scripts/studio-library-manage-harness.mjs', 'scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs']

await t(`strip: stripping this change gives back ${BASE_COMMIT.slice(0, 8)}'s route and .env.example byte for byte`, async () => {
  for (const rel of COMPOSE_ENTITLEMENT_FILES) {
    const stripped = stripComposeEntitlement(rel, rel === ENV ? stripPublishPreviewInventory(rel, stripVersionHistoryDeckOnly(rel, stripPublishReviewFit(rel, read(rel)))) : read(rel)) // stacked: #492/#493's .env.example blocks (below this change in the stack) come out too
    assert.ok(read(rel) !== stripped, `${rel}: the change is there to strip`)
    assert.ok(isBaseFile(rel, stripped, baseFile(rel)), `${rel}: stripped, it is the base's file`)
    if (rel !== ENV) assert.equal(stripped, baseFile(rel))
  }
  assert.equal(stripComposeEntitlement('app/other.ts', 'x'), 'x')
  assert.equal(stripComposeEntitlement(ROUTE, baseFile(ROUTE)), baseFile(ROUTE), 'a file that no longer carries the change comes back as it is')
})
await t('strip roots: the three shared roots chain it (a root that acts on one of this change\'s files takes this change out of it)', async () => {
  for (const root3 of [stripOpenReadOnly, stripDarkPersist, stripAddSlideStatus]) {
    for (const rel of COMPOSE_ENTITLEMENT_FILES) {
      const current = read(rel), out = root3(rel, current)
      if (out !== current) assert.equal(out, root3(rel, baseFile(rel)), `${root3.name}(${rel}): a root that acts on this file gives the base's result, so this change's lines are out`)
    }
  }
  for (const rel of ['scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs']) assert.match(read(rel), /stripComposeEntitlement\(rel, stripNewDeckHandoffSend\(rel, (?:stripPublishReviewFit\(rel, stripVersionHistoryDeckOnly\(rel, )?(?:stripPublishPreviewInventory\(rel, )?text\)/) // stacked: #492/#493 nest their strips inside
})
await t('STACKED_PASS3_FILES lists the route and the lib; the new files are what the strip module says', async () => {
  assert.ok(STACKED_PASS3_FILES.includes(ROUTE) && STACKED_PASS3_FILES.includes(LIB))
  for (const rel of COMPOSE_ENTITLEMENT_NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)), rel)
  assert.ok(COMPOSE_ENTITLEMENT_NEW_FILES.includes(RECORDED) && !COMPOSE_ENTITLEMENT_NEW_FILES.includes('app/api/slides/compose/route.ts'))
})
await t('no other file reaches the lib; no NEXT_PUBLIC_ alias of the flag anywhere', async () => {
  const files = git('ls-files', '--', 'app', 'components', 'hooks', 'lib', 'middleware.ts').split('\n').filter(rel => /\.(ts|tsx)$/.test(rel))
  const users = files.filter(rel => rel !== LIB && /studio-compose-entitlement/.test(read(rel)))
  assert.deepEqual(users, [ROUTE])
  let aliases = []
  try { aliases = git('grep', '-l', '-E', 'NEXT_PUBLIC_STUDIO_COMPOSE_ENTITLEMENT|NEXT_PUBLIC_COMPOSE_ENTITLEMENT', '--', '.').split('\n').filter(Boolean) } catch { /* git grep exits 1 when nothing matches */ }
  assert.deepEqual(aliases.filter(rel => rel !== 'scripts/test-studio-compose-entitlement.mjs'), [])
})
await t('.env.example: one block, right after the new-deck handoff block and right before # PASS2 ADMIN; the flag is "false"', async () => {
  const env = stripPublishPreviewInventory(ENV, read(ENV)) // stacked: #495's later block comes out first
  assert.equal(env.split('\n').filter(line => line.startsWith(`${FLAG}=`)).length, 1)
  assert.match(env, new RegExp(`\\n${FLAG}="false"\\n\\n# PASS2 ADMIN \\(FRONTEND-1,`))
  assert.ok(env.indexOf('NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND="false"') < env.indexOf(`${FLAG}=`))
  const block = env.slice(env.indexOf('# ADD SLIDE COMPOSE SIGNS ITS USER'), env.indexOf('# PASS2 ADMIN (FRONTEND-1,'))
  assert.match(block, /#475/); assert.match(block, /stacked/)
  assert.match(block, /director-v4\.0 src\/utils\/mr_context\.py:84,101-111/)
  assert.ok(!/^[^#\n].*$/m.test(block.replace(`${FLAG}="false"\n`, '').replace(/\n+$/, '')), 'only comments and the one assignment')
})
await t('the lib cites Director\'s clean_id by file and line', async () => {
  const lib = read(LIB)
  assert.match(lib, /director-v4\.0 src\/utils\/mr_context\.py:84/)
  assert.match(lib, /101-111/); assert.match(lib, /as of !535/)
  const fixture = JSON.parse(read(CLEAN_ID_FIXTURE))
  assert.match(fixture.director.rule, /\[A-Za-z0-9\]\[A-Za-z0-9\._:-\]\{0,254\}/)
})
await t('secret scan: no credential-shaped literal in any line this change adds', async () => {
  const patterns = [
    [/\b(?:sk|pk|rk)[-_](?:live|test)[-_][A-Za-z0-9]{10,}/, 'a key prefix'], [/\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'a token'], [/AKIA[0-9A-Z]{16}/, 'an access key id'],
    [/\bgh[pousr]_[A-Za-z0-9]{20,}/, 'a GitHub token'], [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'], [/-----BEGIN [A-Z ]*PRIVATE KEY/, 'a private key'],
    [/(?:secret|token|password|passwd|api[_-]?key)\w*\s*[:=]\s*['"][^'"\s]{12,}['"]/i, 'a quoted secret assignment'], [/\b[0-9a-f]{32,}\b/i, 'a long hex string'], [/(?=[A-Za-z0-9+_-]*[A-Za-z])(?=[A-Za-z0-9+_-]*\d)[A-Za-z0-9+_-]{48,}={0,2}/, 'a long token-like run'],
  ]
  const hits = []
  for (const rel of TOUCHED) {
    for (const line of added(rel)) {
      if (line.includes(BASE_COMMIT)) continue // the pinned base commit (40 hex), as every strip module has
      if (/^\s*(?:\/\/|\*|#)/.test(line) && /https?:\/\/|\/Users\//.test(line)) continue
      for (const [re, why] of patterns) if (re.test(line.replace(/\/\*\*?|\*\//g, ''))) hits.push(`${rel}: ${why}: ${line.slice(0, 60)}`)
    }
  }
  assert.deepEqual(hits, [])
})

let mutantReport = []
if (!args.has('--no-mutants')) mutantReport = await runMutants()

console.log(`\n${checks} checks passed, ${failures.length} failed${mutantReport.length ? `, ${mutantReport.length} mutants all caught` : ''}`)
if (failures.length) { console.error(failures.map(f => ` - ${f}`).join('\n')); process.exit(1) }
