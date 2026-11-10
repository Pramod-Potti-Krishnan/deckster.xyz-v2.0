/**
 * J6-INGEST-STATUS-AUTH-FE (J6P-5): the upload's ingest-status poll sends an owner-bound
 * Researcher session token (flag NEXT_PUBLIC_RESEARCHER_INGEST_STATUS_AUTH_ENABLED, default off).
 *
 * Offline and keyless: every secret below is a made-up string defined in this file or in the
 * fixture, auth, the database and the network are stubs, and the real helper, route and upload
 * hook are compiled and run unchanged. The verifier below is written from the token format in
 * lib/researcher-session-token.ts's contract text and does not import the minter. No git, no
 * network, no real account.
 *
 * Optional cross-language proof: set RESEARCHER_VERIFIER_PATH to a checkout's
 * services/session_auth_report.py (the Researcher's own verifier and reference minter, read
 * only, never edited or copied) and every token the route mints is also verified by that
 * Python code and compared with its reference minter, byte for byte. PYTHON overrides the
 * interpreter (default python3).
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FLAG = 'NEXT_PUBLIC_RESEARCHER_INGEST_STATUS_AUTH_ENABLED'
const SECRET_ENV = 'RESEARCHER_SESSION_TOKEN_SECRET'
const HEADER = 'X-Deckster-Session-Token'
const FIXTURE = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/fixtures/researcher-session-token-v1.json'), 'utf8'))
// The secret the route tests use: 40 made-up bytes.
const ROUTE_SECRET = 'route-test-signing-key-not-real-0123456789'
const CLOCK_START = 1789999100
const RESEARCHER_BASE = 'https://researcher.test.invalid'

let checks = 0
const ok = (cond, label) => { assert.ok(cond, label); checks += 1 }
// Objects built inside the sandbox come from another realm; compare their plain JSON shape.
const norm = value => (value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value)
const eq = (actual, expected, label) => { assert.deepEqual(norm(actual), norm(expected), label); checks += 1 }

const read = relative => fs.readFileSync(path.join(REPO, relative), 'utf8')
const transpile = (relative, source = read(relative)) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

// ------------------------------------------------- independent verifier
// Mirrors the Researcher's rules (signature before expiry, 30 s leeway, 24 h cap, ids
// printable and without '|'). Imports nothing from the minter.
const LEEWAY = 30
const MAX_TTL = 24 * 3600
const printable = value => /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u.test(value)
function verify(token, secret, now) {
  const invalid = { state: 'invalid' }
  if (!secret) return { state: 'no_secret' }
  if (typeof token !== 'string' || !token || token.length > 2048) return invalid
  const parts = token.split('.')
  if (parts.length !== 5 || parts[0] !== 'v1') return invalid
  if (!parts.slice(1).every(p => /^[A-Za-z0-9_-]*$/.test(p))) return invalid
  const sid = Buffer.from(parts[1], 'base64url').toString('utf8')
  const uid = Buffer.from(parts[2], 'base64url').toString('utf8')
  if (!/^[0-9]{1,12}$/.test(parts[3])) return invalid
  const exp = Number(parts[3])
  for (const id of [sid, uid]) {
    if (!id || Array.from(id).length > 255 || id.includes('|') || !printable(id)) return invalid
  }
  const expected = crypto.createHmac('sha256', secret).update(`${sid}|${uid}|${exp}`, 'utf8').digest()
  const supplied = Buffer.from(parts[4], 'base64url')
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return invalid
  if (exp - now > MAX_TTL + LEEWAY) return invalid
  if (now > exp + LEEWAY) return { state: 'expired', sid, uid, exp }
  return { state: 'valid', sid, uid, exp }
}

// ------------------------------------------------- the code under test
const env = {}
const logs = []
let clockMs = CLOCK_START * 1000
const setClock = seconds => { clockMs = seconds * 1000 }
const record = level => (...args) => {
  logs.push({ level, text: args.map(a => (a instanceof Error ? a.message : String(a))).join(' ') })
}
const sandboxConsole = { log: record('log'), info: record('info'), warn: record('warn'), error: record('error') }

function load(relative, imports = {}, extra = {}) {
  const module = { exports: {} }
  vm.runInNewContext(transpile(relative), {
    module,
    exports: module.exports,
    Buffer, Response, URL, URLSearchParams, Promise, Number, String, Math, Array, Error,
    Date: { now: () => clockMs },
    process: { env },
    console: sandboxConsole,
    require: name => {
      if (!(name in imports)) throw new Error(`Unexpected import ${name} from ${relative}`)
      return imports[name]
    },
    ...extra,
  })
  return module.exports
}

const tokenLib = load('lib/researcher-session-token.ts', { crypto })
const authLib = load('lib/researcher-ingest-status-auth.ts')

function setEnv(values) {
  for (const key of Object.keys(env)) delete env[key]
  Object.assign(env, values)
}
const flagOn = (extra = {}) => ({ [FLAG]: 'true', [SECRET_ENV]: ROUTE_SECRET, ...extra })

// ================================================= 1. token mint
{
  const { mintResearcherSessionToken: mint } = tokenLib
  ok(tokenLib.RESEARCHER_SESSION_TOKEN_HEADER === HEADER, 'header name is X-Deckster-Session-Token')
  // Golden vectors minted by the Researcher's own reference mint_token: byte for byte.
  for (const c of FIXTURE.cases) {
    const minted = mint({ secret: FIXTURE.secret, sessionId: c.sid, userId: c.uid, ttlSeconds: 100, nowSeconds: c.exp - 100 })
    eq(minted.token, c.token, `golden vector ${c.name}`)
    eq(minted.expiresAt, c.exp, `golden vector ${c.name} expiry`)
    eq(verify(c.token, FIXTURE.secret, c.exp - 100), { state: 'valid', sid: c.sid, uid: c.uid, exp: c.exp }, `verifier accepts the golden ${c.name}`)
  }

  // The verifier below is not trivially permissive: it rejects the usual forgeries.
  const base = FIXTURE.cases[0]
  eq(verify(base.token, FIXTURE.secret + 'x', base.exp - 100).state, 'invalid', 'wrong secret is rejected')
  eq(verify(base.token, FIXTURE.secret, base.exp + 31).state, 'expired', 'past expiry plus leeway is expired')
  eq(verify(base.token, FIXTURE.secret, base.exp + 30).state, 'valid', 'inside the 30 s leeway is valid')
  eq(verify(base.token, FIXTURE.secret, base.exp - MAX_TTL - 31).state, 'invalid', 'more than 24 h ahead is invalid')
  eq(verify(base.token.replace('.b3duZXJA', '.b3RoZXJA'), FIXTURE.secret, base.exp - 100).state, 'invalid', 'a swapped owner breaks the MAC')

  // Claims the Researcher would refuse are never signed.
  const good = { secret: ROUTE_SECRET, sessionId: 'researcher-session-1', userId: 'owner@example.test', ttlSeconds: 120, nowSeconds: CLOCK_START }
  ok(mint(good) !== null, 'baseline mint works')
  for (const [label, patch] of [
    ['empty secret', { secret: '' }],
    ['empty session id', { sessionId: '' }],
    ['empty owner', { userId: '' }],
    ['pipe in session id', { sessionId: 'a|b' }],
    ['pipe in owner', { userId: 'a|b@example.test' }],
    ['newline in owner', { userId: 'a\nb@example.test' }],
    ['tab in owner', { userId: 'a\tb@example.test' }],
    ['non-breaking space in owner', { userId: 'a b@example.test' }],
    ['null byte in owner', { userId: 'a\u0000b@example.test' }],
    ['256-character owner', { userId: 'a'.repeat(256) }],
    ['non-string owner', { userId: 42 }],
    ['zero lifetime', { ttlSeconds: 0 }],
    ['fractional lifetime', { ttlSeconds: 1.5 }],
    ['lifetime over 24 h', { ttlSeconds: 24 * 3600 + 1 }],
  ]) {
    eq(mint({ ...good, ...patch }), null, `no token for ${label}`)
  }
  ok(mint({ ...good, userId: 'a'.repeat(255) }) !== null, 'a 255-character owner is signed')
  ok(mint({ ...good, userId: 'a b@example.test' }) !== null, 'an ASCII space is printable and signed')
  ok(mint({ ...good, ttlSeconds: 24 * 3600 }) !== null, 'a 24 h lifetime is the limit')
  // Whole characters are counted, as Python counts them (an astral character is one).
  ok(mint({ ...good, userId: '\u{1F600}'.repeat(255) }) !== null, '255 astral characters are 255 characters (counted as Python counts them)')
  eq(mint({ ...good, userId: '\u{1F600}'.repeat(256) }), null, '256 astral characters are too long')
}

// ================================================= 2. secret floor
{
  const secret = () => tokenLib.researcherSessionTokenSecret()
  setEnv({})
  eq(secret(), null, 'unset secret')
  setEnv({ [SECRET_ENV]: '' })
  eq(secret(), null, 'empty secret')
  setEnv({ [SECRET_ENV]: 'x'.repeat(31) })
  eq(secret(), null, '31 bytes is below the floor')
  setEnv({ [SECRET_ENV]: 'x'.repeat(32) })
  eq(secret(), 'x'.repeat(32), '32 bytes is accepted')
  setEnv({ [SECRET_ENV]: `  ${'x'.repeat(31)}  ` })
  eq(secret(), null, 'padding does not count towards the floor')
  setEnv({ [SECRET_ENV]: `${'x'.repeat(32)}\n` })
  eq(secret(), `${'x'.repeat(32)}\n`, 'a secret over the floor is returned exactly as set, never trimmed')
  setEnv({ [SECRET_ENV]: 'é'.repeat(16) })
  eq(secret(), 'é'.repeat(16), 'the floor counts bytes, not characters (16 two-byte characters)')
  setEnv({ [SECRET_ENV]: 'é'.repeat(15) })
  eq(secret(), null, '15 two-byte characters is 30 bytes')
}

// ================================================= 3. client helper
{
  const url = (base, job, identity) => authLib.ingestStatusPollUrl(base, job, identity)
  const legacy = (base, job) => `${base}/api/v1/files/ingest-status/${job}`
  const identity = { sessionId: 'chat-A', userId: 'owner@example.test' }

  // Flag off, in every spelling that is not the exact string "true": the request it always was.
  const jobs = ['job-1', '11111111-2222-4333-8444-555555555555', 'a/b', 'a b', 'a?b=c', 'é', '']
  const bases = [RESEARCHER_BASE, `${RESEARCHER_BASE}:8443`, 'http://127.0.0.1:8000', '']
  for (const value of [undefined, '', 'false', '0', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on', 'truee']) {
    setEnv(value === undefined ? {} : { [FLAG]: value })
    eq(authLib.isIngestStatusAuthEnabled(), false, `flag ${JSON.stringify(value)} is off`)
    for (const base of bases) for (const job of jobs) {
      eq(url(base, job, identity), legacy(base, job), `off ${JSON.stringify(value)}: direct URL for ${JSON.stringify([base, job])}`)
      eq(url(base, job, undefined), legacy(base, job), 'off without an identity: direct URL')
    }
  }

  // Flag on: the same-origin route; session id and owner kind in the query, no e-mail, no token.
  setEnv({ [FLAG]: 'true' })
  eq(authLib.isIngestStatusAuthEnabled(), true, 'exact "true" is on')
  eq(url(RESEARCHER_BASE, 'job-1', identity), '/api/researcher/ingest-status/job-1?session_id=chat-A&owner=email', 'on, e-mail owner')
  eq(url(RESEARCHER_BASE, 'job-1', { sessionId: 'chat-A', userId: 'user_abc-123' }), '/api/researcher/ingest-status/job-1?session_id=chat-A&owner=id', 'on, account-id owner')
  eq(url(RESEARCHER_BASE, 'job-1', { sessionId: 'chat-A', userId: 'anonymous' }), '/api/researcher/ingest-status/job-1?session_id=chat-A&owner=id', 'on, placeholder owner reads as id (the server then cannot match it)')
  eq(url(RESEARCHER_BASE, 'job-1', { sessionId: 'chat-A', userId: '' }), '/api/researcher/ingest-status/job-1?session_id=chat-A&owner=id', 'on, empty owner reads as id')
  eq(url(RESEARCHER_BASE, 'job-1', { sessionId: 'chat-A', userId: null }), '/api/researcher/ingest-status/job-1?session_id=chat-A&owner=id', 'on, null owner reads as id')
  eq(url(RESEARCHER_BASE, 'a/b c', identity), '/api/researcher/ingest-status/a%2Fb%20c?session_id=chat-A&owner=email', 'on, job id is encoded')
  eq(url(RESEARCHER_BASE, 'job-1', { sessionId: 'a&b=c', userId: 'x' }), '/api/researcher/ingest-status/job-1?session_id=a%26b%3Dc&owner=id', 'on, session id is encoded')
  eq(url(RESEARCHER_BASE, 'job-1', undefined), '/api/researcher/ingest-status/job-1?session_id=&owner=id', 'on without an identity: still the route (it refuses with 400), never the direct URL')
  for (const built of [url(RESEARCHER_BASE, 'job-1', identity), url(RESEARCHER_BASE, 'job-1', { sessionId: 'chat-A', userId: 'user_abc-123' })]) {
    ok(!built.includes('@') && !built.includes('example.test') && !built.includes(RESEARCHER_BASE), 'the on URL carries no e-mail and never the Researcher host')
  }
  eq(authLib.ingestStatusOwnerKind('a@b.test'), 'email', 'owner kind: e-mail')
  eq(authLib.ingestStatusOwnerKind('user_abc-123'), 'id', 'owner kind: id')
  eq(authLib.ingestStatusOwnerKind(undefined), 'id', 'owner kind: undefined')
}

// ================================================= 4. the route
const ROUTE = 'app/api/researcher/ingest-status/[jobId]/route.ts'
const USER_A = { id: 'user_a-1111', email: 'alice@example.test' }
const USER_B = { id: 'user_b-2222', email: 'bob@example.test' }
const CHAT_A = 'chat-aaaaaaaa-1111-4111-8111-111111111111'
const CHAT_B = 'chat-bbbbbbbb-2222-4222-8222-222222222222'
const RESEARCHER_SESSION_A = 'researcher-session-AAAA-not-the-chat-id'
const JOB = '11111111-2222-4333-8444-555555555555'

function routeWorld() {
  const world = {
    session: { user: { ...USER_A } },
    rows: {
      [CHAT_A]: { userId: USER_A.id, status: 'active', geminiStoreName: RESEARCHER_SESSION_A },
      [CHAT_B]: { userId: USER_B.id, status: 'active', geminiStoreName: 'researcher-session-BBBB' },
    },
    dbError: null,
    knowledgeUrl: RESEARCHER_BASE,
    upstream: () => new Response(JSON.stringify({ job_id: JOB, status: 'ready' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    calls: { session: 0, db: [], fetch: [], timeouts: [] },
  }
  class ServiceUrlConfigError extends Error {
    constructor(message) { super(message); this.code = 'SERVICE_URL_NOT_CONFIGURED' }
  }
  world.ServiceUrlConfigError = ServiceUrlConfigError
  const imports = {
    'next/server': { NextRequest: class {}, NextResponse: { json: (body, init) => Response.json(body, init) } },
    'next-auth': { getServerSession: async () => { world.calls.session += 1; return world.session } },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/config': { getKnowledgeServiceUrl: () => { if (world.knowledgeUrl instanceof Error) throw world.knowledgeUrl; return world.knowledgeUrl } },
    '@/lib/prisma': { prisma: { chatSession: { findUnique: async args => {
      world.calls.db.push(args)
      if (world.dbError) throw world.dbError
      return world.rows[args.where.id] ?? null
    } } } },
    '@/lib/researcher-ingest-status-auth': authLib,
    '@/lib/researcher-session-token': tokenLib,
    '@/lib/service-url': { ServiceUrlConfigError },
  }
  const fetchStub = async (url, init) => {
    world.calls.fetch.push({ url, init })
    const answer = world.upstream(url, init)
    if (answer instanceof Error) throw answer
    return answer
  }
  const AbortSignalStub = { timeout: ms => { world.calls.timeouts.push(ms); return { timeoutMs: ms } } }
  world.route = load(ROUTE, imports, { fetch: fetchStub, AbortSignal: AbortSignalStub, encodeURIComponent })
  world.get = async (query = {}, jobId = JOB) => {
    const search = new URLSearchParams({ session_id: CHAT_A, owner: 'email', ...query })
    for (const [key, value] of [...search]) if (value === '\u0000drop') search.delete(key)
    const request = { nextUrl: new URL(`https://studio.test.invalid/api/researcher/ingest-status/${jobId}?${search}`) }
    return world.route.GET(request, { params: Promise.resolve({ jobId }) })
  }
  return world
}
const nothingDownstream = (w, label) => {
  eq(w.calls.fetch.length, 0, `${label}: nothing is sent to the Researcher`)
}
const bodyOf = async response => JSON.parse(await response.text())

{
  // Flag off: the route is inert (404), and touches no auth, database or network.
  for (const value of [undefined, '', 'false', 'TRUE', '1']) {
    setEnv(value === undefined ? { [SECRET_ENV]: ROUTE_SECRET } : { [FLAG]: value, [SECRET_ENV]: ROUTE_SECRET })
    const w = routeWorld()
    const res = await w.get()
    eq([res.status, await bodyOf(res)], [404, { error: 'not_enabled' }], `flag ${JSON.stringify(value)}: route is dark`)
    eq([w.calls.session, w.calls.db.length, w.calls.fetch.length], [0, 0, 0], `flag ${JSON.stringify(value)}: no auth, database or network use`)
  }
}

{
  setEnv(flagOn())
  logs.length = 0

  // ---- happy paths: the token proves the right session and the right owner
  for (const [kind, expectedUid] of [['email', USER_A.email], ['id', USER_A.id]]) {
    setClock(CLOCK_START)
    const w = routeWorld()
    const res = await w.get({ owner: kind })
    eq(res.status, 200, `${kind}: 200`)
    eq(await bodyOf(res), { job_id: JOB, status: 'ready' }, `${kind}: the Researcher's body, unchanged`)
    eq(res.headers.get('cache-control'), 'no-store', `${kind}: not cacheable`)
    eq(w.calls.fetch.length, 1, `${kind}: exactly one upstream poll`)
    const call = w.calls.fetch[0]
    eq(call.url, `${RESEARCHER_BASE}/api/v1/files/ingest-status/${JOB}`, `${kind}: the same upstream URL the direct poll used`)
    eq(Object.keys(call.init.headers), [HEADER], `${kind}: the only header is X-Deckster-Session-Token (no service key, no cookie)`)
    eq(call.init.cache, 'no-store', `${kind}: upstream is not cached`)
    eq(call.init.signal, { timeoutMs: 8000 }, `${kind}: 8 s upstream ceiling (inside the poll's own 10 s)`)
    const claim = verify(call.init.headers[HEADER], ROUTE_SECRET, CLOCK_START)
    eq(claim, { state: 'valid', sid: RESEARCHER_SESSION_A, uid: expectedUid, exp: CLOCK_START + 120 }, `${kind}: token is for the SAVED Researcher session and this user's own ${kind}`)
    ok(claim.sid !== CHAT_A, `${kind}: the signed session is the saved Researcher id, not the chat id`)
    eq(verify(call.init.headers[HEADER], ROUTE_SECRET, CLOCK_START + 120 + 31).state, 'expired', `${kind}: the token dies two minutes after it is minted`)
    eq(w.calls.db, [{ where: { id: CHAT_A }, select: { userId: true, status: true, geminiStoreName: true } }], `${kind}: one ownership read, selecting only the three fields`)
  }

  // ---- the secret is used exactly as set (padded values keep their padding)
  {
    const padded = `  ${ROUTE_SECRET}  `
    setEnv(flagOn({ [SECRET_ENV]: padded }))
    const w = routeWorld()
    await w.get()
    eq(verify(w.calls.fetch[0].init.headers[HEADER], padded, CLOCK_START).state, 'valid', 'signed with the exact configured value')
    eq(verify(w.calls.fetch[0].init.headers[HEADER], ROUTE_SECRET, CLOCK_START).state, 'invalid', 'not with a trimmed copy')
    setEnv(flagOn())
  }

  // ---- the browser cannot name an identity
  {
    const w = routeWorld()
    await w.get({ uid: 'mallory@example.test', user_id: 'user_b-2222', sid: CHAT_B, researcher_session_id: 'researcher-session-BBBB', session: CHAT_B })
    const claim = verify(w.calls.fetch[0].init.headers[HEADER], ROUTE_SECRET, CLOCK_START)
    eq([claim.sid, claim.uid], [RESEARCHER_SESSION_A, USER_A.email], 'extra uid / user_id / sid / researcher_session_id query parameters are ignored')
  }

  // ---- another user's chat session: refused before anything is signed or sent
  {
    const w = routeWorld()
    w.session = { user: { ...USER_B } }
    const cross = await w.get({ session_id: CHAT_A })
    const missing = await w.get({ session_id: 'chat-does-not-exist' })
    eq([cross.status, await bodyOf(cross)], [404, { error: 'session_not_found' }], "user B asking for user A's chat session")
    eq([missing.status, await bodyOf(missing)], [404, { error: 'session_not_found' }], 'a chat session that does not exist reads the same')
    nothingDownstream(w, "another user's session")
    // And user B's own session works, signed for B.
    const own = await w.get({ session_id: CHAT_B })
    eq(own.status, 200, 'user B polls their own session')
    const claim = verify(w.calls.fetch[0].init.headers[HEADER], ROUTE_SECRET, CLOCK_START)
    eq([claim.sid, claim.uid], ['researcher-session-BBBB', USER_B.email], "B's token is B's and B's session's")
    ok(claim.uid !== USER_A.email && claim.sid !== RESEARCHER_SESSION_A, "B's token does not carry A's session or owner")
  }

  // ---- refusals, each without a single upstream request
  const refusals = [
    ['no session', w => { w.session = null }, {}, 401, 'unauthenticated'],
    ['session without a user id', w => { w.session = { user: { email: USER_A.email } } }, {}, 401, 'unauthenticated'],
    ['empty user id', w => { w.session = { user: { id: '', email: USER_A.email } } }, {}, 401, 'unauthenticated'],
    ['numeric user id', w => { w.session = { user: { id: 42 } } }, {}, 401, 'unauthenticated'],
    ['missing session_id', () => {}, { session_id: '\u0000drop' }, 400, 'invalid_session_id'],
    ['blank session_id', () => {}, { session_id: '   ' }, 400, 'invalid_session_id'],
    ['session_id with a slash', () => {}, { session_id: 'a/b' }, 400, 'invalid_session_id'],
    ['session_id over 255', () => {}, { session_id: 'a'.repeat(256) }, 400, 'invalid_session_id'],
    ['missing owner', () => {}, { owner: '\u0000drop' }, 400, 'invalid_owner'],
    ['owner=admin', () => {}, { owner: 'admin' }, 400, 'invalid_owner'],
    ['owner=EMAIL', () => {}, { owner: 'EMAIL' }, 400, 'invalid_owner'],
    ['owner with an e-mail value', () => {}, { owner: USER_A.email }, 400, 'invalid_owner'],
    ['deleted chat session', w => { w.rows[CHAT_A].status = 'deleted' }, {}, 410, 'session_deleted'],
    ['database outage', w => { w.dbError = new Error('synthetic outage') }, {}, 503, 'ownership_lookup_failed'],
    ['no Researcher session saved', w => { w.rows[CHAT_A].geminiStoreName = null }, {}, 409, 'researcher_session_not_saved'],
    ['empty Researcher session saved', w => { w.rows[CHAT_A].geminiStoreName = '' }, {}, 409, 'researcher_session_not_saved'],
    ['saved id the Researcher would refuse', w => { w.rows[CHAT_A].geminiStoreName = 'a|b' }, {}, 403, 'identity_not_signable'],
    ['e-mail owner without an e-mail', w => { w.session = { user: { id: USER_A.id } } }, {}, 403, 'identity_not_signable'],
    ['e-mail with a pipe', w => { w.session = { user: { id: USER_A.id, email: 'a|b@example.test' } } }, {}, 403, 'identity_not_signable'],
    ['Researcher URL not configured', w => { w.knowledgeUrl = new w.ServiceUrlConfigError('Knowledge service is not configured.') }, {}, 503, undefined],
  ]
  for (const [label, arrange, query, status, code] of refusals) {
    const w = routeWorld()
    arrange(w)
    const res = await w.get(query)
    const body = await bodyOf(res)
    eq(res.status, status, `${label}: ${status}`)
    if (code) eq(body, { error: code }, `${label}: reason ${code}`)
    eq(res.headers.get('cache-control'), 'no-store', `${label}: not cacheable`)
    nothingDownstream(w, label)
  }
  {
    const wId = routeWorld()
    wId.session = { user: { id: USER_A.id } }
    const res = await wId.get({ owner: 'id' })
    eq(res.status, 200, 'owner=id needs no e-mail on the session')
  }
  for (const bad of ['a/b', 'a b', '..', '../x', 'a?b', 'a#b', 'a'.repeat(256), '-leading-dash']) {
    // The route sees the already-decoded path segment in production, so pass it decoded here.
    const w = routeWorld()
    const request = { nextUrl: new URL(`https://studio.test.invalid/x?session_id=${CHAT_A}&owner=email`) }
    const res = await w.route.GET(request, { params: Promise.resolve({ jobId: bad }) })
    eq(res.status, 400, `job id ${JSON.stringify(bad)} is refused`)
    nothingDownstream(w, `job id ${JSON.stringify(bad)}`)
  }

  // ---- signing secret: missing or short means no token and no request (never an unauthenticated poll)
  for (const [label, secretEnv] of [['unset', {}], ['empty', { [SECRET_ENV]: '' }], ['31 bytes', { [SECRET_ENV]: 'x'.repeat(31) }], ['padded short', { [SECRET_ENV]: `  ${'x'.repeat(31)}  ` }]]) {
    setEnv({ [FLAG]: 'true', ...secretEnv })
    const w = routeWorld()
    const res = await w.get()
    eq([res.status, await bodyOf(res)], [503, { error: 'signing_not_configured' }], `secret ${label}: 503`)
    nothingDownstream(w, `secret ${label}`)
  }
  setEnv(flagOn())

  // ---- the Researcher's answer comes back unchanged, whatever it is
  for (const [label, answer, status, text] of [
    ['401', () => new Response(JSON.stringify({ detail: { error_code: 'INGEST_STATUS_UNAUTHENTICATED', message: 'x' } }), { status: 401, headers: { 'content-type': 'application/json' } }), 401, '{"detail":{"error_code":"INGEST_STATUS_UNAUTHENTICATED","message":"x"}}'],
    ['403', () => new Response(JSON.stringify({ detail: { error_code: 'INGEST_STATUS_FORBIDDEN' } }), { status: 403, headers: { 'content-type': 'application/json' } }), 403, '{"detail":{"error_code":"INGEST_STATUS_FORBIDDEN"}}'],
    ['404', () => new Response('{"detail":"JOB_NOT_FOUND"}', { status: 404 }), 404, '{"detail":"JOB_NOT_FOUND"}'],
    ['429', () => new Response('slow down', { status: 429 }), 429, 'slow down'],
    ['500 plain text', () => new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } }), 500, 'boom'],
    ['502', () => new Response('', { status: 502 }), 502, ''],
  ]) {
    const w = routeWorld()
    w.upstream = answer
    const res = await w.get()
    eq([res.status, await res.text()], [status, text], `upstream ${label} passes through`)
    eq(res.headers.get('cache-control'), 'no-store', `upstream ${label}: not cacheable`)
  }
  {
    const w = routeWorld()
    w.upstream = () => new Response('plain', { status: 200, headers: { 'content-type': 'text/plain' } })
    eq((await w.get()).headers.get('content-type'), 'text/plain', 'the upstream content type is kept')
    w.upstream = () => new Response('{}', { status: 200 })
    ok((await w.get()).headers.get('content-type') !== null, 'a content type is always set')
  }
  {
    const w = routeWorld()
    w.upstream = () => Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    const res = await w.get()
    eq([res.status, await bodyOf(res)], [504, { error: 'researcher_timeout' }], 'a Researcher that does not answer in time is a clean 504 (the poll treats it as transient)')
    w.upstream = () => new Error('connect ECONNREFUSED')
    const down = await w.get()
    eq([down.status, await bodyOf(down)], [502, { error: 'researcher_unreachable' }], 'a Researcher that is down is a clean 502 (transient)')
  }

  // ---- the Researcher base URL is tolerated with a trailing slash and encoded job ids stay in the path
  {
    const w = routeWorld()
    w.knowledgeUrl = `${RESEARCHER_BASE}/`
    await w.get()
    eq(w.calls.fetch[0].url, `${RESEARCHER_BASE}/api/v1/files/ingest-status/${JOB}`, 'a trailing slash on the base URL is dropped')
  }

  // ---- logs: reason codes only
  {
    const text = logs.map(l => l.text).join('\n')
    ok(logs.length > 0 && logs.every(l => l.text.startsWith('[researcher-ingest-status] refused: ')), 'every log line is a fixed reason code')
    const secrets = [ROUTE_SECRET, CHAT_A, CHAT_B, RESEARCHER_SESSION_A, USER_A.id, USER_A.email, USER_B.id, USER_B.email, JOB, 'v1.']
    for (const value of secrets) ok(!text.includes(value), `no ${value.slice(0, 12)}... in the logs`)
  }
}

// ================================================= 5. the upload hook, run as shipped
const HOOK = 'hooks/use-file-upload.ts'
const plain = value => JSON.parse(JSON.stringify(value))
const response = (body = {}, status = 200) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body) })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const settle = async () => { for (let i = 0; i < 80; i += 1) await Promise.resolve() }
const nativeFile = (name = 'source.pdf') => ({ name, size: 20, type: 'application/pdf' })
const hookEnv = {}

function hookWorld({ props = {}, onRequest, processBody = { status: 'processing', job_id: 'job-1' } } = {}) {
  const slots = []
  const effects = []
  const requests = []
  const timeouts = []
  const delays = []
  let cursor = 0
  let clock = 1000
  let serial = 0
  const current = { sessionId: 'chat-A', userId: 'alice@example.test', ...props }
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next }]
    },
    useRef(initial) { const i = cursor++; return (slots[i] ??= { current: initial }) },
    useCallback(fn) { cursor += 1; return fn },
    useEffect(fn, deps) {
      const i = cursor++
      const old = slots[i]
      if (!old || deps.some((v, j) => v !== old.deps[j])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() } })
    },
  }
  const module = { exports: {} }
  const dependencies = {
    react,
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/lib/file-validation': load('lib/file-validation.ts'),
    '@/lib/config': { getKnowledgeServiceUrl: () => `${RESEARCHER_BASE}/`, uploadConfig: { maxFiles: 5 } },
    '@/lib/upload-status': load('lib/upload-status.ts'),
    '@/lib/researcher-ingest-status-auth': authLib,
  }
  vm.runInNewContext(transpile(HOOK), {
    module,
    exports: module.exports,
    Error, Promise, Date: { now: () => clock }, Array, Set, JSON, Math, Number, String, Object,
    process: { env: hookEnv },
    crypto: { randomUUID: () => `file-${++serial}` },
    AbortSignal: { timeout: ms => { timeouts.push(ms); return { timeout: ms } } },
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => { delays.push(ms); clock += ms; queueMicrotask(fn); return delays.length },
    clearTimeout() {},
    require: id => { assert.ok(id in dependencies, `Unexpected dependency ${id}`); return dependencies[id] },
    fetch: (url, options = {}) => {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
      const stage = url.endsWith('/sessions/create') ? 'create'
        : url.endsWith('/storage-upload-url') ? 'prepare'
          : options.method === 'PUT' ? 'put'
            : url.startsWith('/api/sessions/') ? 'link'
              : url.includes('/ingest-status/') ? 'poll'
                : 'process'
      const entry = { url, stage, options: { ...options }, body }
      requests.push(entry)
      const supplied = onRequest?.(entry, requests)
      if (supplied !== undefined) return supplied instanceof Error ? Promise.reject(supplied) : Promise.resolve(supplied)
      return Promise.resolve(response(
        stage === 'create' ? { session_id: `researcher-${body.session_id}` }
          : stage === 'prepare' ? { signed_url: `https://storage.test.invalid/${body.filename}`, storage_path: `${body.session_id}/${body.filename}` }
            : stage === 'process' ? processBody
              : stage === 'poll' ? { status: 'ready', readiness: { fully_ready: true, semantic_query_verified: true } }
                : {},
      ))
    },
  })
  const render = (next = {}) => {
    cursor = 0
    Object.assign(current, next)
    const api = module.exports.useFileUpload({ ...current, onUploadComplete() {} })
    while (effects.length) effects.shift()()
    return api
  }
  return { render, requests, timeouts, delays, props: current }
}
const pollsOf = h => h.requests.filter(r => r.stage === 'poll')
const stagesOf = h => h.requests.map(r => r.stage)

for (const studio of [false, true]) {
  const mode = studio ? 'Studio ownership' : 'classic'
  const setHookEnv = flag => {
    for (const key of Object.keys(hookEnv)) delete hookEnv[key]
    if (studio) hookEnv.NEXT_PUBLIC_STUDIO_V4_SHELL = 'true'
    if (flag !== undefined) hookEnv[FLAG] = flag
    setEnv(flag === undefined ? {} : { [FLAG]: flag })
  }

  // Flag off, in every spelling but "true": the poll is exactly the direct request it was.
  for (const flag of [undefined, 'false', '', 'TRUE', '1', ' true']) {
    setHookEnv(flag)
    const h = hookWorld()
    await h.render().handleFilesSelected([nativeFile()])
    await settle()
    eq(stagesOf(h), ['create', 'prepare', 'put', 'link', 'process', 'poll'], `${mode}, flag ${JSON.stringify(flag)}: the same six requests, in the same order`)
    const [poll] = pollsOf(h)
    eq(poll.url, `${RESEARCHER_BASE}/api/v1/files/ingest-status/job-1`, `${mode}, flag ${JSON.stringify(flag)}: the direct Researcher URL`)
    eq(Object.keys(poll.options), ['signal'], `${mode}, flag ${JSON.stringify(flag)}: the init is { signal } only (no headers, no credentials)`)
    eq(poll.options.signal, { timeout: 10000 }, `${mode}, flag ${JSON.stringify(flag)}: the 10 s per-request ceiling is unchanged`)
    eq(h.delays, [2000], `${mode}, flag ${JSON.stringify(flag)}: the 2 s settle delay is unchanged`)
    ok(!h.requests.some(r => r.url.includes('/api/researcher/')), `${mode}, flag ${JSON.stringify(flag)}: the new route is never called`)
    ok(!h.requests.some(r => JSON.stringify(r).includes('Session-Token') || JSON.stringify(r).toLowerCase().includes('x-api-key')), `${mode}, flag ${JSON.stringify(flag)}: no credential anywhere`)
  }

  // Flag on: the poll goes to the same-origin route, with the identity captured at upload time.
  for (const [userId, kind] of [['alice@example.test', 'email'], ['user_a-1111', 'id']]) {
    setHookEnv('true')
    const h = hookWorld({ props: { userId } })
    await h.render().handleFilesSelected([nativeFile()])
    await settle()
    eq(stagesOf(h), ['create', 'prepare', 'put', 'link', 'process', 'poll'], `${mode}, flag on, ${kind}: the same six requests`)
    const [poll] = pollsOf(h)
    eq(poll.url, `/api/researcher/ingest-status/job-1?session_id=chat-A&owner=${kind}`, `${mode}, flag on, ${kind}: the same-origin route with session and owner kind`)
    eq(Object.keys(poll.options), ['signal'], `${mode}, flag on, ${kind}: still { signal } only; the browser attaches no credential`)
    eq(poll.options.signal, { timeout: 10000 }, `${mode}, flag on, ${kind}: the 10 s ceiling is unchanged`)
    ok(!h.requests.some(r => r.url.includes('/api/v1/files/ingest-status/')), `${mode}, flag on, ${kind}: no direct poll of the Researcher`)
    ok(!JSON.stringify(h.requests).includes('Session-Token'), `${mode}, flag on, ${kind}: the browser never builds a token`)
    const create = h.requests.find(r => r.stage === 'create')
    eq(create.body.user_id, userId, `${mode}, flag on, ${kind}: the upload's own owner is untouched`)
  }

  // The identity is captured when the upload starts: opening another deck while the poll waits changes nothing.
  {
    setHookEnv('true')
    const gate = deferred()
    const h = hookWorld({ onRequest: r => (r.stage === 'process' ? gate.promise : undefined) })
    const pending = h.render().handleFilesSelected([nativeFile()])
    await settle()
    h.render({ sessionId: 'chat-B' })
    gate.resolve(response({ status: 'processing', job_id: 'job-1' }))
    await pending
    await settle()
    const polls = pollsOf(h)
    ok(polls.length >= 1, `${mode}: the poll ran`)
    // Classic mode re-points the hook at the new deck; the Studio owner is retired. Either way the
    // poll that does run carries the ORIGINAL chat session and owner kind, never the new deck's.
    for (const poll of polls) eq(poll.url, '/api/researcher/ingest-status/job-1?session_id=chat-A&owner=email', `${mode}: a poll after navigation still names the original deck`)
    ok(!h.requests.some(r => r.url.includes('chat-B') && r.stage === 'poll'), `${mode}: nothing polls as the new deck`)
  }

  // Result handling is the existing protocol: a 4xx from the route is terminal, a 5xx is retried.
  {
    setHookEnv('true')
    const h = hookWorld({ onRequest: r => (r.stage === 'poll' ? response({ error: 'session_not_found' }, 404) : undefined) })
    await h.render().handleFilesSelected([nativeFile()])
    await settle()
    eq(pollsOf(h).length, 1, `${mode}: a 404 from the route is terminal (one poll)`)
    eq(h.render().files[0].status, 'degraded', `${mode}: a refused poll degrades enrichment, exactly as a 401 did before`)
  }
  {
    setHookEnv('true')
    let n = 0
    const h = hookWorld({ onRequest: r => (r.stage === 'poll' && (n += 1) <= 2 ? response({ error: 'researcher_unreachable' }, 502) : undefined) })
    await h.render().handleFilesSelected([nativeFile()])
    await settle()
    eq(pollsOf(h).length, 3, `${mode}: 502 twice, then success: three polls`)
    eq(h.delays, [2000, 5000, 5000], `${mode}: transient answers keep the 5 s cadence`)
  }
}
setEnv({})

// ================================================= 6. source-level guards
{
  const hook = read(HOOK)
  const client = read('lib/researcher-ingest-status-auth.ts')
  const route = read(ROUTE)
  const tokenSource = read('lib/researcher-session-token.ts')
  ok(!/researcher-session-token'|from 'crypto'|process\.env\.RESEARCHER_SESSION_TOKEN_SECRET/.test(hook + client), 'the browser-side files never import the token minter or crypto, and never read the secret')
  ok(!hook.includes('Session-Token'), 'the hook never names the token header')
  ok(!/NEXT_PUBLIC_[A-Z_]*SECRET|NEXT_PUBLIC_RESEARCHER_SESSION/.test(hook + client + route + tokenSource + read('.env.example')), 'the secret is never a NEXT_PUBLIC_ variable')
  ok(!/KNOWLEDGE_API_KEY|X-API-Key|x-api-key/i.test(route + tokenSource + client), 'the route never uses the service key')
  ok(tokenSource.includes("process.env.RESEARCHER_SESSION_TOKEN_SECRET") && route.includes("'@/lib/researcher-session-token'"), 'the secret is read only by the server-side mint')
  ok(/runtime = 'nodejs'/.test(route) && /dynamic = 'force-dynamic'/.test(route), 'the route runs on Node and is never prerendered')
  const envExample = read('.env.example')
  ok(/^NEXT_PUBLIC_RESEARCHER_INGEST_STATUS_AUTH_ENABLED="false"$/m.test(envExample), '.env.example lists the flag, default false')
  ok(/^RESEARCHER_SESSION_TOKEN_SECRET=""$/m.test(envExample), '.env.example lists the server secret, empty')
  eq(envExample.split('NEXT_PUBLIC_RESEARCHER_INGEST_STATUS_AUTH_ENABLED=').length, 2, 'the flag is listed once')
  const pkg = JSON.parse(read('package.json'))
  eq(pkg.scripts['test:researcher-ingest-status-auth'], 'node scripts/test-researcher-ingest-status-auth.mjs', 'package.json runs this script')
}

// ================================================= 7. optional: the Researcher's own verifier
const verifierPath = process.env.RESEARCHER_VERIFIER_PATH
if (verifierPath) {
  setEnv(flagOn())
  const tokens = []
  for (const owner of ['email', 'id']) {
    setClock(CLOCK_START)
    const w = routeWorld()
    await w.get({ owner })
    tokens.push({ token: w.calls.fetch[0].init.headers[HEADER], sid: RESEARCHER_SESSION_A, uid: owner === 'email' ? USER_A.email : USER_A.id, exp: CLOCK_START + 120 })
  }
  const script = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("sar", sys.argv[1])
sar = importlib.util.module_from_spec(spec); sys.modules["sar"] = sar; spec.loader.exec_module(sar)
cases = json.loads(sys.stdin.read())
secret = cases["secret"]
out = []
for c in cases["tokens"]:
    check = sar.verify_token(c["token"], secret, now=cases["now"])
    ref = sar.mint_token(secret, c["sid"], c["uid"], c["exp"])
    out.append({"state": check.state, "sid": check.session_id, "uid": check.user_id, "exp": check.exp, "same_as_reference_mint": ref == c["token"]})
print(json.dumps(out))
`
  const run = spawnSync(process.env.PYTHON || 'python3', ['-c', script, verifierPath], {
    input: JSON.stringify({ secret: ROUTE_SECRET, now: CLOCK_START, tokens }),
    encoding: 'utf8',
  })
  assert.equal(run.status, 0, run.stderr)
  const results = JSON.parse(run.stdout)
  tokens.forEach((t, i) => {
    eq(results[i], { state: 'valid', sid: t.sid, uid: t.uid, exp: t.exp, same_as_reference_mint: true }, `the Researcher's own verifier accepts token ${i + 1} and its reference mint is byte-identical`)
  })
  console.log(`cross-language proof: ${tokens.length} route tokens verified by ${path.basename(verifierPath)}`)
} else {
  console.log('cross-language proof skipped (set RESEARCHER_VERIFIER_PATH to run it)')
}

console.log(`researcher ingest-status auth: ${checks} checks passed`)
