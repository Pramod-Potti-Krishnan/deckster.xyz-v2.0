/**
 * R-20261007-frontend-24: GET /api/identity/token mints the K-06 `v1.` session
 * token the Researcher verifies (flag DECKSTER_IDENTITY_TOKEN_ENABLED, secret
 * RESEARCHER_SESSION_TOKEN_SECRET; both server-only, flag default off).
 *
 * Offline and keyless: every secret below is a made-up string defined in this
 * file, auth and the database are stubs, and the real route and helper are
 * compiled and run unchanged. The verifier below is written from the token
 * format in lib/identity-token.ts's contract text and does not import the minter.
 *
 * Optional cross-language proof: set RESEARCHER_VERIFIER_PATH to a checkout's
 * services/session_auth_report.py (the Researcher's own verifier, read only,
 * never edited or copied) and every token the route mints is also verified by
 * that Python code and compared with its reference minter, byte for byte.
 * PYTHON overrides the interpreter (default python3).
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
const FLAG = 'DECKSTER_IDENTITY_TOKEN_ENABLED'
const SECRET_ENV = 'RESEARCHER_SESSION_TOKEN_SECRET'
const FIXTURE_FILE = 'scripts/fixtures/identity-session-token-v1--mint-and-verify.json'
// The secret behind the K-06 golden vector (a made-up, 31-byte test value from the
// capture harness; it is deliberately below the route's 32-byte floor).
const GOLDEN_SECRET = 'fixture-session-secret-not-real'
// The secret the route tests use: 40 made-up bytes.
const ROUTE_SECRET = 'route-test-secret-0123456789-abcdefghij!'
const CLOCK_START = 1789999100

const env = {}
const logs = []
let clockMs = CLOCK_START * 1000
const clock = { now: () => clockMs }
const setClock = seconds => { clockMs = seconds * 1000 }

function compile(relative, imports) {
  const source = fs.readFileSync(path.join(REPO, relative), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const record = level => (...args) => { logs.push({ level, text: args.map(a => (a instanceof Error ? a.message : String(a))).join(' ') }) }
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    Buffer, Response, URL, URLSearchParams, Promise, Number, String, Math,
    Date: clock,
    process: { env },
    console: { log: record('log'), info: record('info'), warn: record('warn'), error: record('error') },
    require: name => {
      if (!(name in imports)) throw new Error(`Unexpected import ${name} from ${relative}`)
      return imports[name]
    },
  })
  return module.exports
}

// ------------------------------------------------- independent verifier
// Mirrors the Researcher's rules (signature before expiry, 30 s leeway, 24 h cap, ids
// printable and without '|'). Imports nothing from the minter.
const LEEWAY = 30
const MAX_TTL = 24 * 3600
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
  const idOk = v => v.length > 0 && v.length <= 255 && !v.includes('|') && /^[\x20-\x7e]+$/.test(v)
  if (!idOk(sid) || !idOk(uid)) return invalid
  const want = crypto.createHmac('sha256', secret).update(`${sid}|${uid}|${exp}`, 'utf8').digest()
  const got = Buffer.from(parts[4], 'base64url')
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return invalid
  if (exp - now > MAX_TTL + LEEWAY) return invalid
  if (now > exp + LEEWAY) return { state: 'expired', session_id: sid, user_id: uid, exp }
  return { state: 'valid', session_id: sid, user_id: uid, exp }
}

// ----------------------------------------------------- 1. golden vector
const helper = compile('lib/identity-token.ts', { crypto })
const {
  mintIdentityToken, isIdentityTokenEnabled, identityTokenSecret, isIdentityId,
  IDENTITY_TOKEN_HEADER, IDENTITY_TOKEN_TTL_SECONDS, IDENTITY_TOKEN_MIN_SECRET_BYTES,
} = helper
const fixture = JSON.parse(fs.readFileSync(path.join(REPO, FIXTURE_FILE), 'utf8'))
assert.equal(fixture.contract, 'identity/v1')
assert.equal(IDENTITY_TOKEN_HEADER, 'X-Deckster-Session-Token')
assert.equal(IDENTITY_TOKEN_TTL_SECONDS, 900)
assert.equal(IDENTITY_TOKEN_MIN_SECRET_BYTES, 32)
{
  const { session_id: sid, exp, verify_now: verifyNow } = fixture.mint_inputs
  const cuid = Buffer.from(fixture.vector.token_for_cuid.split('.')[2], 'base64url').toString('utf8')
  assert.equal(cuid, fixture.vector.verify_cuid.user_id)
  assert.equal(exp - IDENTITY_TOKEN_TTL_SECONDS, verifyNow, 'the vector was minted 15 minutes before its exp')

  // The K-06 vector, reproduced byte for byte.
  const minted = mintIdentityToken({ secret: GOLDEN_SECRET, sessionId: sid, userId: cuid, nowSeconds: exp - 900 })
  assert.equal(minted.token, fixture.vector.token_for_cuid, 'golden vector: byte for byte')
  assert.equal(minted.expiresAt, exp)
  assert.equal(minted.ttlSeconds, 900)
  assert.match(minted.token, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[0-9]+\.[A-Za-z0-9_-]{43}$/, 'five parts, base64url without padding')

  // The verifier (independent of the minter) reads it the way the fixture says.
  assert.deepEqual(verify(minted.token, GOLDEN_SECRET, verifyNow), { state: 'valid', session_id: sid, user_id: cuid, exp })
  assert.equal(verify(minted.token, GOLDEN_SECRET, exp + 31).state, fixture.vector.verify_cuid_after_exp.state)
  assert.equal(verify(minted.token, 'another-secret-value', verifyNow).state, fixture.vector.verify_wrong_secret.state)

  // The fixture's e-mail-shaped token verifies at the Researcher (its verifier accepts any printable id);
  // that is exactly why the mint side refuses to write one.
  assert.equal(verify(fixture.vector.token_for_email_uid, GOLDEN_SECRET, verifyNow).state, 'valid')
  const emailUid = fixture.vector.verify_email_uid.user_id
  assert.equal(mintIdentityToken({ secret: GOLDEN_SECRET, sessionId: sid, userId: emailUid, nowSeconds: exp - 900 }), null, 'an e-mail uid is never minted')
  assert.equal(mintIdentityToken({ secret: GOLDEN_SECRET, sessionId: sid, userId: 'a|b', nowSeconds: exp - 900 }), null, "a '|' in uid is never minted")
  assert.equal(mintIdentityToken({ secret: GOLDEN_SECRET, sessionId: sid, userId: '', nowSeconds: exp - 900 }), null)
  assert.equal(mintIdentityToken({ secret: GOLDEN_SECRET, sessionId: 'a|b', userId: cuid, nowSeconds: exp - 900 }), null, "a '|' in sid is never minted")
  assert.equal(mintIdentityToken({ secret: GOLDEN_SECRET, sessionId: emailUid, userId: cuid, nowSeconds: exp - 900 }), null, 'an e-mail-shaped sid is never minted')
  assert.equal(mintIdentityToken({ secret: '', sessionId: sid, userId: cuid, nowSeconds: exp - 900 }), null)
  assert.equal(mintIdentityToken({ secret: GOLDEN_SECRET, sessionId: sid, userId: cuid }).expiresAt >= 1700000000 + 900, true, 'now defaults to the clock')
}

// ------------------------------------------- 2. flag, secret and id rules
{
  delete env[FLAG]
  assert.equal(isIdentityTokenEnabled(), false, 'default off')
  for (const value of ['', 'false', '0', '1', 'TRUE', 'True', ' true', 'true ', 'yes', 'on']) {
    env[FLAG] = value
    assert.equal(isIdentityTokenEnabled(), false, `"${value}" is not the exact string true`)
  }
  env[FLAG] = 'true'
  assert.equal(isIdentityTokenEnabled(), true)
  delete env[FLAG]

  delete env[SECRET_ENV]
  assert.equal(identityTokenSecret(), null, 'unset')
  env[SECRET_ENV] = ''
  assert.equal(identityTokenSecret(), null, 'empty')
  env[SECRET_ENV] = 'x'.repeat(31)
  assert.equal(identityTokenSecret(), null, '31 bytes counts as not configured')
  env[SECRET_ENV] = 'x'.repeat(32)
  assert.equal(identityTokenSecret(), 'x'.repeat(32), '32 bytes is configured')
  env[SECRET_ENV] = 'é'.repeat(16)
  assert.equal(identityTokenSecret(), 'é'.repeat(16), 'the floor counts bytes: 16 two-byte characters are 32 bytes')
  env[SECRET_ENV] = 'é'.repeat(15) + 'e'
  assert.equal(identityTokenSecret(), null, '31 bytes of mixed characters is below the floor')
  env[SECRET_ENV] = `  ${'x'.repeat(31)}  `
  assert.equal(identityTokenSecret(), null, 'padding does not count towards the floor')
  env[SECRET_ENV] = `\n${'x'.repeat(32)}\n`
  assert.equal(identityTokenSecret(), `\n${'x'.repeat(32)}\n`, 'returned exactly as set, never stripped')
  delete env[SECRET_ENV]

  for (const good of ['cm8xk2l0a0000abcdefghij123', 'uat-tpl-user', '0', 'A', '123e4567-e89b-12d3-a456-426614174000', 'a.b:c-d.e', 'x'.repeat(255)]) {
    assert.equal(isIdentityId(good), true, `${good.slice(0, 14)} is canonical`)
  }
  for (const bad of ['', undefined, null, 7, 'pat@example.test', 'a@b', 'a|b', '|', ' a', 'a ', 'a b', '-a', '.a', '_a', 'a\n', 'ünï', 'a/b', 'x'.repeat(256)]) {
    assert.equal(isIdentityId(bad), false, `${String(bad).slice(0, 14)} is not canonical`)
  }
}

// --------------------------------------------------------- 3. the route
const state = { session: null, rows: new Map(), lookups: [], failLookup: false }
const prisma = {
  chatSession: {
    findUnique: async args => {
      state.lookups.push(args)
      if (state.failLookup) throw new Error('database says: connection refused for user cuid-owner at host db.internal')
      return state.rows.has(args.where.id) ? state.rows.get(args.where.id) : null
    },
  },
}
const routeImports = {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => state.session },
  '@/lib/auth-options': { authOptions: {} },
  '@/lib/identity-token': helper,
  '@/lib/prisma': { prisma },
}
const route = compile('app/api/identity/token/route.ts', routeImports)
assert.equal(route.runtime, 'nodejs')
assert.equal(route.dynamic, 'force-dynamic')

const OWNER = 'cm8xk2l0a0000ownerabcdef12'
const OTHER = 'cm8xk2l0a0000otherabcdef12'
const EMAIL = 'pat.qa@example.test'
const SID = '123e4567-e89b-12d3-a456-426614174000'

function reset() {
  for (const k of Object.keys(env)) delete env[k]
  env[FLAG] = 'true'
  env[SECRET_ENV] = ROUTE_SECRET
  state.session = { user: { id: OWNER, email: EMAIL } }
  state.rows = new Map([[SID, { userId: OWNER, status: 'active' }]])
  state.lookups = []
  state.failLookup = false
  setClock(CLOCK_START)
}
async function call(query = `?session_id=${encodeURIComponent(SID)}`) {
  const url = `http://localhost/api/identity/token${query}`
  const req = new Request(url)
  req.nextUrl = new URL(url)
  const res = await route.GET(req)
  return { res, status: res.status, body: await res.clone().json(), text: await res.clone().text() }
}
const expectNoToken = r => {
  assert.equal('token' in r.body, false)
  assert.equal(/v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[0-9]+\./.test(r.text), false, 'no token-shaped text in the response')
}

// 3a. flag off or secret not usable: {token_enabled:false}, 200, nothing issued, no DB read
reset()
const minted = []
{
  for (const value of [undefined, '', 'false', '0', '1', 'TRUE', 'yes', ' true']) {
    reset()
    if (value === undefined) delete env[FLAG]; else env[FLAG] = value
    const r = await call()
    assert.equal(r.status, 200, `flag ${JSON.stringify(value)}: 200`)
    assert.deepEqual(r.body, { token_enabled: false })
    assert.equal(r.res.headers.get('cache-control'), 'no-store')
    expectNoToken(r)
    assert.equal(state.lookups.length, 0, 'off: no database read')
  }
  for (const secret of [undefined, '', 'short', 'x'.repeat(31), `  ${'x'.repeat(31)}  `, ' '.repeat(64)]) {
    reset()
    if (secret === undefined) delete env[SECRET_ENV]; else env[SECRET_ENV] = secret
    const r = await call()
    assert.equal(r.status, 200, `secret of ${secret === undefined ? 'unset' : secret.length + ' chars'}: 200`)
    assert.deepEqual(r.body, { token_enabled: false })
    expectNoToken(r)
    assert.equal(state.lookups.length, 0)
  }
  // exactly 32 bytes mints
  reset(); env[SECRET_ENV] = 'k'.repeat(32)
  const edge = await call()
  assert.equal(edge.status, 200)
  assert.equal(verify(edge.body.token, 'k'.repeat(32), CLOCK_START).state, 'valid', 'a 32-byte secret signs')
  // the flag is read on every request
  reset()
  assert.equal((await call()).body.token_enabled, undefined)
  env[FLAG] = 'false'
  assert.deepEqual((await call()).body, { token_enabled: false })
  env[FLAG] = 'true'
  assert.ok((await call()).body.token)
}

// 3b. identity: 401 without an account id, never an e-mail fallback
{
  const cases = [
    ['no session', null],
    ['session without a user', {}],
    ['user without an id (e-mail only)', { user: { email: EMAIL } }],
    ['empty id', { user: { id: '', email: EMAIL } }],
    ['id that is an e-mail', { user: { id: EMAIL, email: EMAIL } }],
    ["id with '@'", { user: { id: 'abc@def' } }],
    ["id with '|'", { user: { id: 'abc|def' } }],
    ['id with a space', { user: { id: 'abc def' } }],
    ['id over 255 characters', { user: { id: 'a'.repeat(256) } }],
    ['id that is not a string', { user: { id: 12345 } }],
  ]
  for (const [name, session] of cases) {
    reset()
    state.session = session
    const r = await call()
    assert.equal(r.status, 401, name)
    assert.deepEqual(r.body, { error: 'unauthenticated' }, name)
    expectNoToken(r)
    assert.equal(state.lookups.length, 0, `${name}: nothing is looked up`)
  }
  // with the flag off the caller still has to be signed in (an anonymous caller learns nothing)
  reset(); delete env[FLAG]; state.session = null
  assert.equal((await call()).status, 401)
}

// 3c. request: the chat session id
{
  reset()
  for (const query of ['', '?session_id=', '?session_id=%20%20', '?other=1']) {
    const r = await call(query)
    assert.equal(r.status, 400, `query ${JSON.stringify(query)}`)
    assert.deepEqual(r.body, { error: 'session_id_required' })
  }
  for (const sid of ['a|b', 'pat@example.test', 'a b', 'x'.repeat(256), '-lead', 'ünï', 'a/b']) {
    const r = await call(`?session_id=${encodeURIComponent(sid)}`)
    assert.equal(r.status, 400, `sid ${JSON.stringify(sid.slice(0, 12))}`)
    assert.deepEqual(r.body, { error: 'invalid_session_id' })
    expectNoToken(r)
  }
  assert.equal(state.lookups.length, 0, 'a refused id never reaches the database')
  // the id is trimmed, then checked
  const padded = await call(`?session_id=${encodeURIComponent(`  ${SID}  `)}`)
  assert.equal(padded.status, 200)
  assert.equal(verify(padded.body.token, ROUTE_SECRET, CLOCK_START).session_id, SID)
}

// 3d. ownership: 403 not yours, 410 deleted, 503 on a failed lookup, new ids allowed
{
  reset()
  state.rows.set(SID, { userId: OTHER, status: 'active' })
  let r = await call()
  assert.equal(r.status, 403)
  assert.deepEqual(r.body, { error: 'session_not_owned' })
  expectNoToken(r)

  state.rows.set(SID, { userId: OTHER, status: 'deleted' })
  assert.equal((await call()).status, 403, "someone else's deleted session is still 'not yours'")

  state.rows.set(SID, { userId: OWNER, status: 'deleted' })
  r = await call()
  assert.equal(r.status, 410)
  assert.deepEqual(r.body, { error: 'session_deleted' })
  expectNoToken(r)

  state.failLookup = true
  r = await call()
  assert.equal(r.status, 503)
  assert.deepEqual(r.body, { error: 'ownership_lookup_failed' })
  expectNoToken(r)
  assert.equal(r.text.includes('connection refused'), false, 'the database error is not echoed')
  state.failLookup = false

  // a session id that is not stored yet (uploads can start before the row exists) is allowed
  state.rows.clear()
  r = await call()
  assert.equal(r.status, 200)
  assert.equal(verify(r.body.token, ROUTE_SECRET, CLOCK_START).user_id, OWNER)

  // the lookup is by session id only, selecting just owner and status
  reset()
  await call()
  assert.deepEqual(JSON.parse(JSON.stringify(state.lookups)), [{ where: { id: SID }, select: { userId: true, status: true } }])
}

// 3e. success: the contract's response, a token claiming exactly (sid, uid, exp)
{
  reset()
  setClock(CLOCK_START)
  const r = await call()
  assert.equal(r.status, 200)
  assert.deepEqual(Object.keys(r.body).sort(), ['expires_at', 'header', 'token', 'ttl_seconds'])
  assert.equal(r.body.header, 'X-Deckster-Session-Token')
  assert.equal(r.body.ttl_seconds, 900)
  assert.equal(r.body.expires_at, CLOCK_START + 900)
  assert.equal(r.res.headers.get('cache-control'), 'no-store')
  const checked = verify(r.body.token, ROUTE_SECRET, CLOCK_START)
  assert.deepEqual(checked, { state: 'valid', session_id: SID, user_id: OWNER, exp: CLOCK_START + 900 })
  assert.equal(r.body.token.split('.')[3], String(r.body.expires_at))
  assert.equal(r.body.token.includes('@'), false)
  assert.equal(r.body.token.includes(EMAIL), false)
  assert.equal(r.text.includes(EMAIL), false, 'the e-mail is nowhere in the response')
  for (const part of r.body.token.split('.').slice(1, 3)) {
    assert.equal(Buffer.from(part, 'base64url').toString('utf8').includes('@'), false, 'no e-mail inside the encoded ids')
  }
  assert.equal(verify(r.body.token, ROUTE_SECRET, CLOCK_START + 900 + 31).state, 'expired')
  assert.equal(verify(r.body.token, 'a-different-secret-of-sufficient-length', CLOCK_START).state, 'invalid')

  // a surrounding-whitespace secret signs with the value exactly as set
  reset(); env[SECRET_ENV] = `  ${ROUTE_SECRET}\n`
  const ws = await call()
  assert.equal(verify(ws.body.token, `  ${ROUTE_SECRET}\n`, CLOCK_START).state, 'valid', 'HMAC key is the unstripped value')
  assert.equal(verify(ws.body.token, ROUTE_SECRET, CLOCK_START).state, 'invalid', 'and not the stripped one')

  // minted per request: a later second is a different token; another user differs
  reset()
  const first = (await call()).body.token
  setClock(CLOCK_START + 1)
  const second = (await call()).body.token
  assert.notEqual(first, second)
  reset()
  state.session = { user: { id: OTHER } }
  state.rows.set(SID, { userId: OTHER, status: 'active' })
  assert.notEqual((await call()).body.token, first)

  // dev login id and uuid-shaped ids are canonical
  reset()
  state.session = { user: { id: 'uat-tpl-user' } }
  state.rows.set(SID, { userId: 'uat-tpl-user', status: 'active' })
  assert.equal(verify((await call()).body.token, ROUTE_SECRET, CLOCK_START).user_id, 'uat-tpl-user')
  reset()
}

// 3f. nothing sensitive is ever logged
{
  logs.length = 0
  reset()
  state.session = { user: { id: OWNER, email: EMAIL } }
  const issued = (await call()).body.token
  state.failLookup = true
  await call()
  state.failLookup = false
  state.session = { user: { email: EMAIL } }
  await call()
  state.session = { user: { id: `${EMAIL}` } }
  await call()
  state.session = { user: { id: OWNER, email: EMAIL } }
  state.rows.set(SID, { userId: OTHER, status: 'active' })
  await call()
  const everything = logs.map(l => l.text).join('\n')
  for (const secretText of [ROUTE_SECRET, issued, SID, OWNER, OTHER, EMAIL, Buffer.from(SID).toString('base64url'), Buffer.from(OWNER).toString('base64url'), 'connection refused']) {
    assert.equal(everything.includes(secretText), false, `logs never carry ${secretText.slice(0, 6)}...`)
  }
  assert.ok(logs.length >= 3, 'refusals are logged as reason codes')
  for (const line of logs) assert.match(line.text, /^\[identity-token\] refused: [a-z_]+$/, 'only route-level reason codes')
}

// ---------------------------------------- 4. the Researcher's own verifier
const verifierPath = process.env.RESEARCHER_VERIFIER_PATH
let cross = null
if (verifierPath) {
  const python = process.env.PYTHON || 'python3'
  const code = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("session_auth_report", ${JSON.stringify(verifierPath)})
module = importlib.util.module_from_spec(spec)
sys.modules["session_auth_report"] = module
spec.loader.exec_module(module)
cases = json.load(sys.stdin)
out = []
for c in cases:
    r = module.verify_token(c["token"], c["secret"], now=c["now"])
    ref = None
    if c.get("sid") is not None:
        ref = module.mint_token(c["secret"], c["sid"], c["uid"], c["exp"])
    out.append({"state": r.state, "session_id": r.session_id, "user_id": r.user_id, "exp": r.exp, "reference": ref})
print(json.dumps(out))
`
  const run = cases => {
    const proc = spawnSync(python, ['-c', code], { input: JSON.stringify(cases), encoding: 'utf8' })
    assert.equal(proc.status, 0, `python verifier ran: ${proc.stderr}`)
    return JSON.parse(proc.stdout)
  }
  const cases = []
  // (a) the golden vector, minted here, verified there
  const g = fixture.mint_inputs
  const goldenUid = fixture.vector.verify_cuid.user_id
  const golden = mintIdentityToken({ secret: GOLDEN_SECRET, sessionId: g.session_id, userId: goldenUid, nowSeconds: g.exp - 900 })
  cases.push({ label: 'golden', token: golden.token, secret: GOLDEN_SECRET, now: g.verify_now, sid: g.session_id, uid: goldenUid, exp: g.exp })
  // (b) tokens minted by the ROUTE for a spread of ids
  const identities = [
    [OWNER, SID], ['uat-tpl-user', 'a'], ['A1.b:c-d', '0'], ['x'.repeat(255), 'y'.repeat(255)],
    ['cm9zzzzzzzzzzzzzzzzzzzzzz9', 'session.with:odd-chars.1'],
  ]
  for (const [uid, sid] of identities) {
    reset()
    state.session = { user: { id: uid } }
    state.rows = new Map([[sid, { userId: uid, status: 'active' }]])
    const r = await call(`?session_id=${encodeURIComponent(sid)}`)
    assert.equal(r.status, 200, `route minted for ${uid.slice(0, 8)}`)
    cases.push({ label: `route ${uid.slice(0, 8)}`, token: r.body.token, secret: ROUTE_SECRET, now: CLOCK_START, sid, uid, exp: r.body.expires_at })
  }
  // (c) the unstripped-secret case, the 32-byte edge, and negative controls
  reset(); env[SECRET_ENV] = `  ${ROUTE_SECRET}\n`
  const spaced = await call()
  cases.push({ label: 'unstripped secret', token: spaced.body.token, secret: `  ${ROUTE_SECRET}\n`, now: CLOCK_START, sid: SID, uid: OWNER, exp: spaced.body.expires_at })
  const expectations = cases.map(() => ({ state: 'valid' }))
  const routeToken = cases[1].token
  cases.push({ label: 'wrong secret', token: routeToken, secret: 'a-different-secret-of-sufficient-length', now: CLOCK_START })
  expectations.push({ state: 'invalid' })
  cases.push({ label: 'after exp', token: routeToken, secret: ROUTE_SECRET, now: CLOCK_START + 900 + 31 })
  expectations.push({ state: 'expired' })
  cases.push({ label: 'stripped secret on an unstripped token', token: spaced.body.token, secret: ROUTE_SECRET, now: CLOCK_START })
  expectations.push({ state: 'invalid' })

  const results = run(cases)
  results.forEach((result, n) => {
    const c = cases[n]
    assert.equal(result.state, expectations[n].state, `Researcher verify_token: ${c.label}`)
    if (c.sid !== undefined) {
      assert.equal(result.session_id, c.sid, `${c.label}: sid`)
      assert.equal(result.user_id, c.uid, `${c.label}: uid`)
      assert.equal(result.exp, c.exp, `${c.label}: exp`)
      assert.equal(result.reference, c.token, `${c.label}: identical to the Researcher's reference mint_token, byte for byte`)
    }
  })
  cross = { verifierPath: path.basename(path.dirname(path.dirname(verifierPath))), cases: cases.length, verified: results.filter(r => r.state === 'valid').length }
}
reset()

console.log('identity token tests passed')
console.log(cross
  ? `Researcher verify_token cross-check: ${cross.cases} cases, ${cross.verified} valid and byte-identical to the reference mint (${cross.verifierPath})`
  : 'Researcher cross-check skipped (set RESEARCHER_VERIFIER_PATH=<checkout>/services/session_auth_report.py)')
