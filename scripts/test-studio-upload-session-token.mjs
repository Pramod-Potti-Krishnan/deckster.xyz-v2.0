/**
 * DSB-5a (KNOWLEDGE-3): the browser's Researcher upload calls carry a signed K-06 session token
 * (flag NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED, exact "true", default off; server secret
 * RESEARCHER_SESSION_TOKEN_SECRET). Ports the cases of OPS-2's Drafts #316 (the mint route) and #319
 * (the wiring: refusal and retry-once, flag-off identity, the ingest-status job-to-session mapping).
 *
 * Offline and keyless: every secret below is a made-up string defined here or in the fixture; auth,
 * the database and the network are stubs; the real route, client, hook, upload helper and template
 * dialog are compiled and run unchanged. The verifier is written from the K-06 format and does not
 * import the minter. Nothing is diffed against HEAD or the worktree: the scope and marker checks read
 * this change's OWN frozen range (BASE_COMMIT..OWN_HEAD) and SKIP when a commit is not in the clone;
 * content checks read through stripLaterChanges on both sides, so they hold after later changes land.
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { serviceUrl } from './service-url-harness.mjs'
import * as registry from './studio-later-changes.mjs'
import * as S from './studio-upload-session-token-strip.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { BASE_COMMIT, stripUploadSessionToken } = S
// The last commit of this change's own work (the pin-only commit that sets this line comes after it).
const OWN_HEAD = process.env.STUDIO_UPLOAD_SESSION_TOKEN_HEAD || ''
const FLAG = 'NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED'
const PROXY_FLAG = 'NEXT_PUBLIC_RESEARCHER_INGEST_STATUS_AUTH_ENABLED'
const SECRET_ENV = 'RESEARCHER_SESSION_TOKEN_SECRET'
const HEADER = 'X-Deckster-Session-Token'
const ROUTE = 'app/api/researcher/session-token/route.ts'
const CLIENT = 'lib/upload-session-token.ts'
const HOOK = 'hooks/use-file-upload.ts'
const HELPER = 'lib/researcher-upload.ts'
const DIALOG = 'components/template-ingest-dialog.tsx'
const ENVFILE = '.env.example'
// Made-up signing keys, 40 and 32 bytes: test values only.
const ROUTE_SECRET = 'route-test-signing-key-not-real-0123456789'
const EDGE_SECRET = 'k'.repeat(32)
const CLOCK_START = 1789999100
const RESEARCHER_BASE = 'https://researcher.test.invalid'

let checks = 0
const norm = value => (value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value)
const ok = (cond, label) => { assert.ok(cond, label); checks += 1 }
const eq = (actual, expected, label) => { assert.deepEqual(norm(actual), norm(expected), label); checks += 1 }
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')

const read = rel => fs.readFileSync(path.join(REPO, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 << 20 })
const hasCommit = commit => { if (!commit) return false; try { execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: REPO, stdio: 'ignore' }); return true } catch { return false } }
const baseText = rel => (hasCommit(BASE_COMMIT) ? git('show', `${BASE_COMMIT}:${rel}`) : null)

// The file as THIS change left it: the strips of the changes registered after this one come out first.
const ownAt = registry.LATER_STRIPS.indexOf(stripUploadSessionToken)
const POST_ME = registry.LATER_STRIPS.slice(ownAt + 1).filter(fn => typeof fn === 'function')
const ownEnvAt = registry.LATER_ENV_BLOCKS.indexOf(S.UPLOAD_SESSION_TOKEN_ENV_BLOCK)
// One registered block out of .env.example with the blank line that separates it (the registry's own rule, for one block).
function dropEnvBlock(text, registered) {
  const block = String(registered).replace(/^\n+/, '').replace(/\n+$/, '')
  let at = text.indexOf(block)
  while (at !== -1 && !((at === 0 || text[at - 1] === '\n') && (at + block.length === text.length || text[at + block.length] === '\n'))) at = text.indexOf(block, at + 1)
  if (at === -1 || block === '') return text
  const before = text.slice(0, at), after = text.slice(at + block.length)
  if (/^\n*$/.test(after)) return before.endsWith('\n\n') ? before.slice(0, -1) : before
  return after.startsWith('\n\n') ? before + after.slice(2) : before + after.slice(1)
}
const ownView = rel => {
  const text = POST_ME.reduce((out, fn) => { const next = fn(rel, out); return typeof next === 'string' ? next : out }, read(rel))
  if (rel !== ENVFILE) return text
  // .env.example: the blocks registered after this one come out
  return registry.LATER_ENV_BLOCKS.slice(ownEnvAt + 1).filter(block => typeof block === 'string').reduce(dropEnvBlock, text)
}
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

// ------------------------------------------------- independent verifier (K-06 rules; imports nothing from the minter)
const LEEWAY = 30
const MAX_TTL = 24 * 3600
const printable = value => /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u.test(value)
function verify(token, secret, now) {
  const invalid = { state: 'invalid' }
  if (typeof token !== 'string' || !token || token.length > 2048) return invalid
  const parts = token.split('.')
  if (parts.length !== 5 || parts[0] !== 'v1') return invalid
  if (!parts.slice(1).every(p => /^[A-Za-z0-9_-]*$/.test(p))) return invalid
  const sid = Buffer.from(parts[1], 'base64url').toString('utf8')
  const uid = Buffer.from(parts[2], 'base64url').toString('utf8')
  if (!/^[0-9]{1,12}$/.test(parts[3])) return invalid
  const exp = Number(parts[3])
  for (const id of [sid, uid]) if (!id || Array.from(id).length > 255 || id.includes('|') || !printable(id)) return invalid
  const expected = crypto.createHmac('sha256', secret).update(`${sid}|${uid}|${exp}`, 'utf8').digest()
  const supplied = Buffer.from(parts[4], 'base64url')
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return invalid
  if (exp - now > MAX_TTL + LEEWAY) return invalid
  if (now > exp + LEEWAY) return { state: 'expired', sid, uid, exp }
  return { state: 'valid', sid, uid, exp }
}

// ------------------------------------------------- loader
const env = {}
const logs = []
let clockMs = CLOCK_START * 1000
const setClock = seconds => { clockMs = seconds * 1000 }
const record = level => (...args) => { logs.push({ level, text: args.map(a => (a instanceof Error ? a.message : String(a))).join(' ') }) }
const sandboxConsole = { log: record('log'), info: record('info'), warn: record('warn'), error: record('error') }
function load(source, imports = {}, extra = {}) {
  const module = { exports: {} }
  vm.runInNewContext(transpile(source), {
    module, exports: module.exports,
    Buffer, Response, Request, Headers, URL, URLSearchParams, Promise, Number, String, Math, Array, Error, Map, Set, JSON, Object,
    Date: { now: () => clockMs },
    process: { env },
    console: sandboxConsole,
    require: name => { if (!(name in imports)) throw new Error(`Unexpected import ${name}`); return imports[name] },
    ...extra,
  })
  return module.exports
}
const setEnv = values => { for (const key of Object.keys(env)) delete env[key]; Object.assign(env, values) }
const tokenLib = load(read('lib/researcher-session-token.ts'), { crypto })
const authLibSource = ownView('lib/researcher-ingest-status-auth.ts')

// ================================================= 1. the mint route (#316's cases, on dev's minter)
const OWNER = { id: 'user_a-1111', email: 'alice@example.test' }
const OTHER = { id: 'user_b-2222', email: 'bob@example.test' }
const CHAT = 'chat-11111111-1111-4111-8111-111111111111'
const state = { session: null, rows: new Map(), lookups: [], failLookup: false }
const prisma = {
  chatSession: {
    findUnique: async args => {
      state.lookups.push(args)
      if (state.failLookup) throw new Error('database says: connection refused for user user_a-1111 at host db.internal')
      return state.rows.has(args.where.id) ? state.rows.get(args.where.id) : null
    },
  },
}
const route = load(ownView(ROUTE), {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => state.session },
  '@/lib/auth-options': { authOptions: {} },
  '@/lib/prisma': { prisma },
  '@/lib/researcher-session-token': tokenLib,
})
eq([route.runtime, route.dynamic], ['nodejs', 'force-dynamic'], 'the route runs on Node and is never prerendered')
function resetRoute() {
  setEnv({ [FLAG]: 'true', [SECRET_ENV]: ROUTE_SECRET })
  state.session = { user: { ...OWNER } }
  state.rows = new Map([[CHAT, { userId: OWNER.id, status: 'active' }]])
  state.lookups = []
  state.failLookup = false
  setClock(CLOCK_START)
}
async function mintCall(query = `?session_id=${encodeURIComponent(CHAT)}&owner=email`) {
  const url = `http://localhost/api/researcher/session-token${query}`
  const req = new Request(url)
  req.nextUrl = new URL(url)
  const res = await route.GET(req)
  const text = await res.text()
  return { res, status: res.status, body: JSON.parse(text), text, cache: res.headers.get('cache-control') }
}
const noToken = r => { ok(!('token' in r.body) && !/v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[0-9]+\./.test(r.text), 'no token in the answer'); eq(r.cache, 'no-store', 'no-store') }

// 1a. flag off or no usable secret: 200 {token_enabled:false}, nothing read, nothing issued
for (const value of [undefined, '', 'false', '0', '1', 'TRUE', 'True', ' true', 'true ', 'yes']) {
  resetRoute()
  if (value === undefined) delete env[FLAG]; else env[FLAG] = value
  const r = await mintCall()
  eq([r.status, r.body], [200, { token_enabled: false }], `flag ${JSON.stringify(value)}: token_enabled false`)
  noToken(r)
  eq(state.lookups.length, 0, `flag ${JSON.stringify(value)}: no database read`)
}
for (const secret of [undefined, '', 'short', 'x'.repeat(31), `  ${'x'.repeat(31)}  `, ' '.repeat(64), 'é'.repeat(15) + 'e']) {
  resetRoute()
  if (secret === undefined) delete env[SECRET_ENV]; else env[SECRET_ENV] = secret
  const r = await mintCall()
  eq([r.status, r.body], [200, { token_enabled: false }], `secret of ${secret === undefined ? 'unset' : `${Buffer.byteLength(secret)} bytes`}: token_enabled false`)
  noToken(r)
  eq(state.lookups.length, 0, 'no database read')
}
{
  resetRoute(); env[SECRET_ENV] = EDGE_SECRET
  const r = await mintCall()
  eq(verify(r.body.token, EDGE_SECRET, CLOCK_START).state, 'valid', 'a 32-byte secret signs')
  resetRoute()
  ok(typeof (await mintCall()).body.token === 'string', 'on: a token')
  env[FLAG] = 'false'
  eq((await mintCall()).body, { token_enabled: false }, 'the flag is read on every request')
}

// 1b. signed in, or 401 (also with the flag off: an anonymous caller learns nothing)
for (const [name, session] of [['no session', null], ['no user', {}], ['e-mail only', { user: { email: OWNER.email } }], ['empty id', { user: { id: '', email: OWNER.email } }], ['id not a string', { user: { id: 7 } }]]) {
  for (const flag of ['true', undefined]) {
    resetRoute(); state.session = session
    if (flag === undefined) delete env[FLAG]
    const r = await mintCall()
    eq([r.status, r.body], [401, { error: 'unauthenticated' }], `${name}, flag ${flag}: 401`)
    noToken(r)
    eq(state.lookups.length, 0, `${name}: nothing looked up`)
  }
}

// 1c. the request: a canonical chat session id, an owner kind; a client can never name an identity
{
  resetRoute()
  for (const query of ['', '?owner=email', '?session_id=&owner=email', '?session_id=%20%20&owner=email']) {
    const r = await mintCall(query)
    eq([r.status, r.body], [400, { error: 'invalid_session_id' }], `query ${JSON.stringify(query)}: 400`)
  }
  for (const sid of ['a|b', 'pat@example.test', 'a b', 'x'.repeat(256), '-lead', '.lead', 'ünï', 'a/b', '../x']) {
    const r = await mintCall(`?session_id=${encodeURIComponent(sid)}&owner=email`)
    eq([r.status, r.body], [400, { error: 'invalid_session_id' }], `sid ${JSON.stringify(sid.slice(0, 12))}: 400`)
    noToken(r)
  }
  for (const owner of [null, '', 'EMAIL', 'Id', 'cuid', OWNER.email, OTHER.id, 'email ']) {
    const r = await mintCall(`?session_id=${CHAT}${owner === null ? '' : `&owner=${encodeURIComponent(owner)}`}`)
    eq([r.status, r.body], [400, { error: 'invalid_owner' }], `owner ${JSON.stringify(owner)}: 400`)
    noToken(r)
  }
  eq(state.lookups.length, 0, 'a refused request never reaches the database')
  const padded = await mintCall(`?session_id=${encodeURIComponent(`  ${CHAT}  `)}&owner=email`)
  eq(verify(padded.body.token, ROUTE_SECRET, CLOCK_START).sid, CHAT, 'the id is trimmed, then checked')
}

// 1d. ownership: 403 not yours (no row reads the same), 410 deleted, 503 on a failed lookup
{
  resetRoute(); state.rows.set(CHAT, { userId: OTHER.id, status: 'active' })
  let r = await mintCall()
  eq([r.status, r.body], [403, { error: 'session_not_owned' }], "someone else's chat: 403"); noToken(r)
  state.rows.set(CHAT, { userId: OTHER.id, status: 'deleted' })
  eq((await mintCall()).body, { error: 'session_not_owned' }, "someone else's deleted chat is still not yours")
  state.rows.clear()
  r = await mintCall()
  eq([r.status, r.body], [403, { error: 'session_not_owned' }], 'a chat with no row: 403 (no token for an id nobody owns yet)'); noToken(r)
  state.rows.set(CHAT, { userId: OWNER.id, status: 'deleted' })
  r = await mintCall()
  eq([r.status, r.body], [410, { error: 'session_deleted' }], 'own deleted chat: 410'); noToken(r)
  resetRoute(); state.failLookup = true
  r = await mintCall()
  eq([r.status, r.body], [503, { error: 'ownership_lookup_failed' }], 'lookup failure: 503'); noToken(r)
  ok(!r.text.includes('connection refused'), 'the database error is not echoed')
  resetRoute(); await mintCall()
  eq(state.lookups, [{ where: { id: CHAT }, select: { userId: true, status: true } }], 'one lookup, by chat id, owner and status only')
}

// 1e. success: {token, expires_at, header, ttl_seconds}; the owner is the caller's OWN e-mail or account id
{
  for (const [kind, uid] of [['email', OWNER.email], ['id', OWNER.id]]) {
    resetRoute()
    const r = await mintCall(`?session_id=${CHAT}&owner=${kind}`)
    eq(r.status, 200, `${kind}: 200`)
    eq(Object.keys(r.body).sort(), ['expires_at', 'header', 'token', 'ttl_seconds'], `${kind}: the contract's keys`)
    eq([r.body.header, r.body.ttl_seconds, r.body.expires_at], [HEADER, 900, CLOCK_START + 900], `${kind}: header, 15 minutes`)
    eq(r.cache, 'no-store', `${kind}: no-store`)
    eq(verify(r.body.token, ROUTE_SECRET, CLOCK_START), { state: 'valid', sid: CHAT, uid, exp: CLOCK_START + 900 }, `${kind}: sid = the chat, uid = the caller's own ${kind}`)
    eq(verify(r.body.token, ROUTE_SECRET, CLOCK_START + 931).state, 'expired', `${kind}: expires`)
    eq(verify(r.body.token, 'a-different-signing-key-of-enough-length', CLOCK_START).state, 'invalid', `${kind}: bound to the secret`)
  }
  resetRoute(); state.session = { user: { id: OWNER.id } }
  eq([(await mintCall()).status, (await mintCall()).body], [403, { error: 'identity_not_signable' }], 'owner=email with no e-mail in the session: refused, never another identity')
  eq(verify((await mintCall(`?session_id=${CHAT}&owner=id`)).body.token, ROUTE_SECRET, CLOCK_START).uid, OWNER.id, 'owner=id still works')
  resetRoute(); env[SECRET_ENV] = `  ${ROUTE_SECRET}\n`
  const spaced = (await mintCall()).body.token
  eq([verify(spaced, `  ${ROUTE_SECRET}\n`, CLOCK_START).state, verify(spaced, ROUTE_SECRET, CLOCK_START).state], ['valid', 'invalid'], 'the HMAC key is the secret exactly as set')
  resetRoute()
  const first = (await mintCall()).body.token
  setClock(CLOCK_START + 1)
  ok(first !== (await mintCall()).body.token, 'minted per request')
}

// 1f. logs: fixed reason codes only
{
  logs.length = 0
  resetRoute(); const issued = (await mintCall()).body.token
  state.failLookup = true; await mintCall(); state.failLookup = false
  state.session = { user: { email: OWNER.email } }; await mintCall()
  state.session = { user: { ...OWNER } }; state.rows.set(CHAT, { userId: OTHER.id, status: 'active' }); await mintCall()
  await mintCall('?session_id=a|b&owner=email'); await mintCall(`?session_id=${CHAT}&owner=x`)
  const text = logs.map(l => l.text).join('\n')
  ok(logs.length >= 5 && logs.every(l => /^\[researcher-session-token\] refused: [a-z_]+$/.test(l.text)), 'every log line is a fixed reason code')
  for (const value of [ROUTE_SECRET, issued, CHAT, OWNER.id, OWNER.email, OTHER.id, Buffer.from(CHAT).toString('base64url'), 'connection refused', 'v1.']) ok(!text.includes(value), `no ${value.slice(0, 8)}... in the logs`)
}

// ================================================= 2. the fixture: #316's K-06 vectors on dev's minter
{
  const fixture = JSON.parse(read(S.UPLOAD_SESSION_TOKEN_FIXTURE))
  const k = fixture.k06_mint_and_verify
  for (const [uid, token] of [[k.uid_cuid, k.token_for_cuid], [k.uid_email, k.token_for_email_uid]]) {
    const minted = tokenLib.mintResearcherSessionToken({ secret: k.secret, sessionId: k.sid, userId: uid, ttlSeconds: k.exp - k.verify_now, nowSeconds: k.verify_now })
    eq(minted, { token, expiresAt: k.exp }, `${uid}: dev's minter reproduces #316's vector byte for byte`)
    eq(verify(token, k.secret, k.verify_now).state, k.verify_at_verify_now, `${uid}: valid at verify_now`)
    eq(verify(token, k.secret, k.exp + 31).state, k.verify_after_exp_plus_31, `${uid}: expired after exp + 31`)
    eq(verify(token, `${k.secret}x`, k.verify_now).state, k.verify_wrong_secret, `${uid}: wrong secret is invalid`)
  }
  for (const c of k.mint_refused) eq(tokenLib.mintResearcherSessionToken({ secret: k.secret, sessionId: c.sid, userId: c.uid, ttlSeconds: 900, nowSeconds: k.verify_now }), null, `refused: ${c.name}`)
  ok(Buffer.byteLength(k.secret.trim()) < 32, 'the fixture secret is below the 32-byte floor: the routes would never sign with it')
  // the cases already there are untouched (read through the registry on both sides)
  const base = baseText(S.UPLOAD_SESSION_TOKEN_FIXTURE)
  if (base) eq(JSON.parse(base).cases, fixture.cases, 'the existing cases are unchanged')
  eq(Object.keys(fixture), ['_provenance', 'secret', 'cases', 'k06_mint_and_verify'], 'one new key, after the existing ones')
}

// ================================================= 3. the client rules (#319's cases)
const clientSource = ownView(CLIENT)
function clientWorld({ researcher = () => ({ status: 200, body: { ok: true } }), mint = () => ({ status: 200, body: tokenBody() }) } = {}) {
  const calls = []
  let serial = 0
  const fetchImpl = (url, init) => {
    const entry = { url, init }
    calls.push(entry)
    if (url.startsWith('/api/researcher/session-token')) {
      const answer = mint(entry, calls.filter(c => c.url.startsWith('/api/researcher/session-token')).length)
      if (answer instanceof Error) return Promise.reject(answer)
      if (answer && typeof answer.then === 'function') return answer
      return Promise.resolve(new Response(answer.raw ?? JSON.stringify(answer.body), { status: answer.status }))
    }
    const answer = researcher(entry, calls.filter(c => !c.url.startsWith('/api/researcher/session-token')).length)
    return Promise.resolve(new Response(JSON.stringify(answer.body ?? {}), { status: answer.status }))
  }
  const lib = load(clientSource, { '@/lib/researcher-ingest-status-auth': load(authLibSource) })
  const mints = () => calls.filter(c => c.url.startsWith('/api/researcher/session-token'))
  const sent = () => calls.filter(c => !c.url.startsWith('/api/researcher/session-token'))
  return { lib, fetchImpl, calls, mints, sent, next: () => `tok-${++serial}` }
}
let tokenSerial = 0
function tokenBody(ttl = 900) { tokenSerial += 1; return { token: `v1.made-up-token-${tokenSerial}`, header: HEADER, ttl_seconds: ttl, expires_at: Math.floor(clockMs / 1000) + ttl } }
const SID = 'chat-A'
const POST = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: SID, user_id: OWNER.email }) }
const headerOf = init => (init?.headers instanceof Headers ? init.headers.get(HEADER) : init?.headers?.[HEADER]) ?? null

// 3a. flag off: fetch itself, the caller's own call; nothing else happens
for (const flag of [undefined, '', 'false', 'TRUE', '1', ' true', 'true ']) {
  setEnv(flag === undefined ? {} : { [FLAG]: flag })
  const w = clientWorld()
  ok(w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email }) === w.fetchImpl, `flag ${JSON.stringify(flag)}: fetch itself`)
  ok(w.lib.researcherUploadPollFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email }) === w.fetchImpl, `flag ${JSON.stringify(flag)}: the poll's fetch itself`)
  eq(w.calls.length, 0, 'no request of its own')
}
// 3b. on: the header the route names, minted for the call's session and the owner's kind
{
  setEnv({ [FLAG]: 'true' }); setClock(CLOCK_START)
  const w = clientWorld()
  const res = await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/api/v1/sessions/create`, POST)
  eq(res.status, 200, 'the answer')
  eq(w.mints().map(c => [c.url, c.init]), [[`/api/researcher/session-token?session_id=${SID}&owner=email`, { method: 'GET', credentials: 'same-origin', cache: 'no-store' }]], 'one mint, same-origin, the kind only')
  const [call] = w.sent()
  eq([call.url, call.init.method, call.init.body, call.init.headers['Content-Type']], [`${RESEARCHER_BASE}/api/v1/sessions/create`, 'POST', POST.body, 'application/json'], 'the call is otherwise the caller\'s own')
  ok(/^v1\.made-up-token-\d+$/.test(headerOf(call.init)), 'the token header is on')
  eq(Object.keys(call.init.headers).sort(), ['Content-Type', HEADER].sort(), 'one header added')
  ok(POST.headers[HEADER] === undefined, "the caller's init is not mutated")
  await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.id })(`${RESEARCHER_BASE}/x`, POST)
  eq(w.mints().at(-1).url, `/api/researcher/session-token?session_id=${SID}&owner=id`, 'an account id is owner=id (its own cache entry)')
  await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/x`, POST)
  eq(w.mints().length, 2, 'cached per session and kind')
  const h = await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/x`, { headers: new Headers({ A: 'b' }) })
  ok(h.status === 200 && w.sent().at(-1).init.headers.get('A') === 'b' && headerOf(w.sent().at(-1).init), 'a Headers init keeps its headers and gains the token')
  await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/poll`, { signal: new AbortController().signal })
  eq(Object.keys(w.sent().at(-1).init).sort(), ['headers', 'signal'], 'a { signal } init gains only the header')
  // refresh after 60% of the lifetime, not before
  setClock(CLOCK_START + 539)
  await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/x`, POST)
  eq(w.mints().length, 2, 'not before 60% of 15 minutes')
  setClock(CLOCK_START + 541)
  await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/x`, POST)
  eq(w.mints().length, 3, 'refreshed after 60%')
  // no session id: no header, no mint
  await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: '', userId: OWNER.email })(`${RESEARCHER_BASE}/x`, POST)
  eq([w.mints().length, headerOf(w.sent().at(-1).init)], [3, null], 'no session: the call as it is')
}
// 3c. concurrent calls share one mint; a failed refresh keeps a still-valid token
{
  setEnv({ [FLAG]: 'true' }); setClock(CLOCK_START)
  let release
  const gate = new Promise(r => { release = r })
  const w = clientWorld({ mint: () => gate.then(() => new Response(JSON.stringify(tokenBody()), { status: 200 })) })
  const f = w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })
  const both = Promise.all([f(`${RESEARCHER_BASE}/a`, POST), f(`${RESEARCHER_BASE}/b`, POST)])
  await Promise.resolve(); release(); await both
  eq(w.mints().length, 1, 'one mint in flight is shared')
  eq(new Set(w.sent().map(c => headerOf(c.init))).size, 1, 'both calls carry it')
  const v = clientWorld({ mint: (entry, n) => (n === 1 ? { status: 200, body: tokenBody() } : { status: 503, body: { error: 'ownership_lookup_failed' } }) })
  const g = v.lib.researcherUploadFetch(v.fetchImpl, { sessionId: SID, userId: OWNER.email })
  await g(`${RESEARCHER_BASE}/a`, POST)
  setClock(CLOCK_START + 600)
  await g(`${RESEARCHER_BASE}/b`, POST)
  eq([v.mints().length, headerOf(v.sent()[1].init)], [2, headerOf(v.sent()[0].init)], 'a failed refresh keeps the still-valid token')
}
// 3d. the route says tokens are off, or has none to give: no header, the call as today
for (const [name, mint, warned] of [
  ['token_enabled false', () => ({ status: 200, body: { token_enabled: false } }), false],
  ['401 signed out', () => ({ status: 401, body: { error: 'unauthenticated' } }), true],
  ['503', () => ({ status: 503, body: { error: 'ownership_lookup_failed' } }), true],
  ['400', () => ({ status: 400, body: { error: 'invalid_session_id' } }), true],
  ['403 identity_not_signable', () => ({ status: 403, body: { error: 'identity_not_signable' } }), true],
  ['network', () => new TypeError('Failed to fetch'), true],
  ['not JSON', () => ({ status: 200, raw: '<html>' }), true],
  ['a body without a token', () => ({ status: 200, body: { header: HEADER, ttl_seconds: 900, expires_at: 1 } }), true],
]) {
  setEnv({ [FLAG]: 'true' }); setClock(CLOCK_START); logs.length = 0
  const w = clientWorld({ mint, researcher: () => ({ status: 401, body: { detail: 'SESSION_OWNER_UNVERIFIED' } }) })
  const res = await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/api/v1/sessions/create`, POST)
  eq([res.status, w.sent().length, w.mints().length], [401, 1, 1], `${name}: the Researcher's answer to a call with no token passes through, no retry`)
  eq(w.sent()[0].init, POST, `${name}: the very init the caller gave`)
  eq(logs.length, warned ? 1 : 0, `${name}: ${warned ? 'one' : 'no'} reason-code warning`)
  if (warned) ok(/^\[upload-session-token\] no token for this call \([a-z_0-9]+\)$/.test(logs[0].text), `${name}: a fixed code`)
}
{
  setEnv({ [FLAG]: 'true' }); setClock(CLOCK_START)
  const w = clientWorld({ mint: () => ({ status: 200, body: { token_enabled: false } }) })
  const f = w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })
  await f(`${RESEARCHER_BASE}/a`, POST); await f(`${RESEARCHER_BASE}/b`, POST)
  eq(w.mints().length, 1, 'tokens off: asked again no sooner than 60 s')
  setClock(CLOCK_START + 61); await f(`${RESEARCHER_BASE}/c`, POST)
  eq(w.mints().length, 2, 'and asked again after')
}
// 3e. the route refuses the chat session: the call is not sent; a terminal error
for (const [status, code] of [[403, 'session_not_owned'], [410, 'session_deleted']]) {
  setEnv({ [FLAG]: 'true' }); setClock(CLOCK_START)
  const w = clientWorld({ mint: () => ({ status, body: { error: code } }) })
  await assert.rejects(w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/x`, POST), error => error.code === code && error.terminal === true && error instanceof w.lib.UploadSessionRefusedError)
  eq(w.sent().length, 0, `${code}: the Researcher is not called`)
}
// 3f. refused WITH a token: one re-mint, one retry; that answer as is
for (const [first, second, expect] of [[401, 200, 200], [403, 200, 200], [403, 403, 403], [401, 403, 403], [403, 401, 401]]) {
  setEnv({ [FLAG]: 'true' }); setClock(CLOCK_START)
  const w = clientWorld({ researcher: (entry, n) => ({ status: n === 1 ? first : second, body: { n } }) })
  const res = await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/api/v1/sessions/create`, POST)
  eq([res.status, w.sent().length, w.mints().length], [expect, 2, 2], `${first} then ${second}: two calls, two mints, the second answer`)
  ok(headerOf(w.sent()[0].init) !== headerOf(w.sent()[1].init) && headerOf(w.sent()[1].init), 'the retry carries the fresh token')
  eq([w.sent()[1].url, w.sent()[1].init.body], [w.sent()[0].url, POST.body], 'the same request')
}
for (const status of [200, 202, 404, 409, 429, 500]) {
  setEnv({ [FLAG]: 'true' }); setClock(CLOCK_START)
  const w = clientWorld({ researcher: () => ({ status }) })
  const res = await w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/x`, POST)
  eq([res.status, w.sent().length, w.mints().length], [status, 1, 1], `${status}: no retry`)
}
for (const [name, remint, outcome] of [
  ['tokens switched off meanwhile', { status: 200, body: { token_enabled: false } }, 'first'],
  ['the route down', { status: 503, body: {} }, 'first'],
  ['not yours any more', { status: 403, body: { error: 'session_not_owned' } }, 'throws'],
]) {
  setEnv({ [FLAG]: 'true' }); setClock(CLOCK_START)
  const w = clientWorld({ mint: (entry, n) => (n === 1 ? { status: 200, body: tokenBody() } : remint), researcher: () => ({ status: 403 }) })
  const pending = w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/x`, POST)
  if (outcome === 'throws') await assert.rejects(pending, error => error.code === 'session_not_owned')
  else eq((await pending).status, 403, `${name}: the Researcher's own answer stands`)
  eq(w.sent().length, 1, `${name}: no retry without a fresh token`)
}
// 3g. the request's own signal ends a hung mint; the poll's proxy path is never wrapped
{
  setEnv({ [FLAG]: 'true' }); setClock(CLOCK_START)
  const w = clientWorld({ mint: () => new Promise(() => {}) })
  const controller = new AbortController()
  const pending = w.lib.researcherUploadFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email })(`${RESEARCHER_BASE}/poll`, { signal: controller.signal })
  controller.abort(new Error('poll timeout'))
  await assert.rejects(pending, /poll timeout/)
  eq(w.sent().length, 0, 'aborted while minting: nothing sent')
  setEnv({ [FLAG]: 'true', [PROXY_FLAG]: 'true' })
  ok(w.lib.researcherUploadPollFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email }) === w.fetchImpl, 'ingest-status proxy on: the poll is fetch itself (the proxy signs on the server)')
  setEnv({ [FLAG]: 'true' })
  ok(w.lib.researcherUploadPollFetch(w.fetchImpl, { sessionId: SID, userId: OWNER.email }) !== w.fetchImpl, 'proxy off: the direct poll is wrapped')
}

// ================================================= 4. the upload hook, run as shipped (both upload paths)
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const settle = async () => { for (let i = 0; i < 200; i += 1) await Promise.resolve() }
const nativeFile = (name = 'source.pdf') => ({ name, size: 20, type: 'application/pdf' })
const asText = body => (typeof body === 'string' ? body : body ? `[${body.name ?? 'body'}]` : null)
const headersOf = init => (init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers ? { ...init.headers } : null)
const wire = requests => requests.map(r => ({ url: r.url, keys: Object.keys(r.init ?? {}), method: r.init?.method ?? null, headers: headersOf(r.init), body: asText(r.init?.body), signal: r.init?.signal ? r.init.signal.__ms : null }))
const hookMine = ownView(HOOK)
const hookBase = registry.stripLaterChanges(HOOK, read(HOOK))
ok(hookMine !== hookBase && stripUploadSessionToken(HOOK, hookMine) === hookBase, 'the hook with this change\'s lines out is the base\'s hook')

function hookWorld({ source = hookMine, hookEnv = {}, props = {}, onRequest, createSession, mint } = {}) {
  const slots = [], effects = [], requests = [], delays = []
  let cursor = 0, clock = 1000, serial = 0
  const current = { sessionId: 'chat-A', userId: OWNER.email, ...props }
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next }] },
    useRef(initial) { const i = cursor++; return (slots[i] ??= { current: initial }) },
    useCallback(fn) { cursor += 1; return fn },
    useEffect(fn, deps) { const i = cursor++; const old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() } }) },
  }
  const hookProcess = { env: hookEnv }
  const sub = (src, imports = {}) => { const m = { exports: {} }; vm.runInNewContext(transpile(src), { module: m, exports: m.exports, process: hookProcess, URLSearchParams, Headers, Response, Map, Promise, Number, Error, Array, Object, JSON, Date: { now: () => clock }, console: { log() {}, warn() {}, error() {} }, require: id => { assert.ok(id in imports, `Unexpected import ${id}`); return imports[id] } }); return m.exports }
  const authLib = sub(authLibSource)
  const deps = {
    react,
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/lib/file-validation': sub(read('lib/file-validation.ts')),
    '@/lib/config': { getKnowledgeServiceUrl: () => `${RESEARCHER_BASE}/`, uploadConfig: { maxFiles: 5 } },
    '@/lib/upload-status': sub(read('lib/upload-status.ts')),
    '@/lib/researcher-ingest-status-auth': authLib,
    '@/lib/upload-session-token': sub(clientSource, { '@/lib/researcher-ingest-status-auth': authLib }),
  }
  const module = { exports: {} }
  vm.runInNewContext(transpile(source), {
    module, exports: module.exports,
    Error, Promise, Date: { now: () => clock }, Array, Set, JSON, Math, Number, String, Object,
    process: hookProcess,
    crypto: { randomUUID: () => `file-${++serial}` },
    AbortSignal: { timeout: ms => Object.assign(new AbortController().signal, { __ms: ms }) },
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => { delays.push(ms); clock += ms; queueMicrotask(fn); return delays.length },
    clearTimeout() {},
    require: id => { assert.ok(id in deps, `Unexpected dependency ${id}`); return deps[id] },
    fetch: (url, init) => {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
      const stage = url.startsWith('/api/researcher/session-token') ? 'mint'
        : url.startsWith('/api/researcher/ingest-status/') ? 'proxy-poll'
          : url.endsWith('/sessions/create') ? 'create'
            : url.endsWith('/storage-upload-url') ? 'prepare'
              : init?.method === 'PUT' ? 'put'
                : url.startsWith('/api/sessions/') ? 'link'
                  : url.includes('/ingest-status/') ? 'poll' : 'process'
      const entry = { url, init, stage, body }
      requests.push(entry)
      if (stage === 'mint') {
        const query = new URL(`http://x${url}`).searchParams
        const answer = mint ? mint(entry) : { status: 200, body: { ...tokenBody(), token: `v1.for.${query.get('session_id')}.${query.get('owner')}.${requests.length}` } }
        return Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status }))
      }
      const supplied = onRequest?.(entry, requests)
      if (supplied !== undefined) return Promise.resolve(supplied)
      const reply = stage === 'create' ? { session_id: createSession ? createSession(body.session_id) : body.session_id }
        : stage === 'prepare' ? { signed_url: `https://storage.test.invalid/${body.filename}`, storage_path: `${body.session_id}/${body.filename}` }
          : stage === 'process' ? { status: 'processing', job_id: 'job-1' }
            : stage === 'poll' || stage === 'proxy-poll' ? { status: 'ready', readiness: { fully_ready: true, semantic_query_verified: true } } : {}
      return Promise.resolve(new Response(JSON.stringify(reply), { status: stage === 'process' ? 202 : 200 }))
    },
  })
  const render = (next = {}) => { cursor = 0; Object.assign(current, next); const api = module.exports.useFileUpload({ ...current, onUploadComplete() {} }); while (effects.length) effects.shift()(); return api }
  return { render, requests, delays, researcher: () => requests.filter(r => r.stage !== 'mint'), mints: () => requests.filter(r => r.stage === 'mint') }
}
const stagesOf = list => list.map(r => r.stage)
const tokenOn = list => Object.fromEntries(list.map(r => [r.stage, Boolean(headersOf(r.init)?.[HEADER])]))
const flagOffHashes = []
for (const studio of [false, true]) {
  const mode = studio ? 'Studio ownership' : 'classic'
  const base = { ...(studio ? { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } : {}) }
  // 4a. flag off, in every spelling but "true": the requests are the base hook's, byte for byte (hashed), with and without the proxy flag
  for (const proxy of [undefined, 'true']) {
    for (const flag of [undefined, 'false', '', 'TRUE', '1', ' true']) {
      const e = { ...base, ...(proxy ? { [PROXY_FLAG]: proxy } : {}), ...(flag === undefined ? {} : { [FLAG]: flag }) }
      const mine = hookWorld({ hookEnv: { ...e } }), theirs = hookWorld({ source: hookBase, hookEnv: { ...e } })
      await mine.render().handleFilesSelected([nativeFile()]); await theirs.render().handleFilesSelected([nativeFile()])
      await settle()
      eq(stagesOf(mine.requests), ['create', 'prepare', 'put', 'link', 'process', proxy ? 'proxy-poll' : 'poll'], `${mode}, proxy ${proxy}, flag ${JSON.stringify(flag)}: the six requests`)
      eq(sha(wire(mine.requests)), sha(wire(theirs.requests)), `${mode}, proxy ${proxy}, flag ${JSON.stringify(flag)}: request hash equals the base hook's`)
      eq(mine.delays, theirs.delays, `${mode}: the same delays`)
      ok(!JSON.stringify(wire(mine.requests)).includes('Session-Token'), `${mode}: no token anywhere`)
      flagOffHashes.push(sha(wire(mine.requests)))
    }
  }
  // 4b. flag on: the four calls carry it, for the session each names; the PUT and the link POST never do
  for (const [userId, kind] of [[OWNER.email, 'email'], [OWNER.id, 'id']]) {
    const w = hookWorld({ hookEnv: { ...base, [FLAG]: 'true' }, props: { userId } })
    await w.render().handleFilesSelected([nativeFile()]); await settle()
    eq(stagesOf(w.researcher()), ['create', 'prepare', 'put', 'link', 'process', 'poll'], `${mode}, ${kind}: the same six requests`)
    eq(tokenOn(w.researcher()), { create: true, prepare: true, put: false, link: false, process: true, poll: true }, `${mode}, ${kind}: the token on the four Researcher calls only`)
    eq([...new Set(w.mints().map(r => r.url))], [`/api/researcher/session-token?session_id=chat-A&owner=${kind}`], `${mode}, ${kind}: one session, one kind (cached across the four calls)`)
    const create = w.researcher().find(r => r.stage === 'create')
    eq([create.body.user_id, create.body.session_id], [userId, 'chat-A'], `${mode}, ${kind}: the upload's own body is untouched`)
  }
  // 4c. the token follows the session each call names: the create names the chat; the rest, and the poll, the job's own Researcher session
  {
    const w = hookWorld({ hookEnv: { ...base, [FLAG]: 'true' }, createSession: () => 'researcher-R1' })
    await w.render().handleFilesSelected([nativeFile()]); await settle()
    const sidOf = r => new URL(`http://x${r.url}`).searchParams.get('session_id')
    eq(w.mints().map(sidOf), ['chat-A', 'researcher-R1'], `${mode}: the create's token is for the chat; the next three are for the Researcher session it returned`)
    eq(w.researcher().filter(r => ['prepare', 'process'].includes(r.stage)).map(r => r.body.session_id), ['researcher-R1', 'researcher-R1'], `${mode}: (the bodies name that session)`)
    const tokenSid = r => (headersOf(r.init)?.[HEADER] ?? '').split('.').slice(2, -2).join('.') || null
    eq(w.researcher().map(r => [r.stage, tokenSid(r)]), [['create', 'chat-A'], ['prepare', 'researcher-R1'], ['put', null], ['link', null], ['process', 'researcher-R1'], ['poll', 'researcher-R1']], `${mode}: each call's token is for the session that call names; the poll's for the job's own session`)
  }
  // 4d. the poll keeps the job's session and owner after another deck is opened
  {
    const gate = deferred()
    const w = hookWorld({ hookEnv: { ...base, [FLAG]: 'true' }, onRequest: r => (r.stage === 'process' ? gate.promise : undefined) })
    const pending = w.render().handleFilesSelected([nativeFile()])
    await settle()
    w.render({ sessionId: 'chat-B', userId: OTHER.email })
    gate.resolve(new Response(JSON.stringify({ status: 'processing', job_id: 'job-1' }), { status: 202 }))
    await pending; await settle()
    const polls = w.researcher().filter(r => r.stage === 'poll')
    ok(polls.length >= 1 && polls.every(p => headersOf(p.init)?.[HEADER]), `${mode}: the poll ran with a token`)
    ok(w.mints().every(r => r.url === '/api/researcher/session-token?session_id=chat-A&owner=email'), `${mode}: never minted for the new deck or its owner`)
  }
  // 4e. proxy flag on: the poll goes to the proxy exactly as before (no header); the other three still carry it
  {
    const w = hookWorld({ hookEnv: { ...base, [FLAG]: 'true', [PROXY_FLAG]: 'true' } })
    await w.render().handleFilesSelected([nativeFile()]); await settle()
    const proxy = w.researcher().find(r => r.stage === 'proxy-poll')
    eq([proxy.url, Object.keys(proxy.init), proxy.init.signal.__ms], ['/api/researcher/ingest-status/job-1?session_id=chat-A&owner=email', ['signal'], 10000], `${mode}: the proxy poll is untouched`)
    eq(tokenOn(w.researcher()), { create: true, prepare: true, put: false, link: false, process: true, 'proxy-poll': false }, `${mode}: the other three still carry it`)
  }
  // 4f. tokens off on the server: the Researcher requests are flag off's, byte for byte (plus the one mint)
  {
    const w = hookWorld({ hookEnv: { ...base, [FLAG]: 'true' }, mint: () => ({ status: 200, body: { token_enabled: false } }) })
    await w.render().handleFilesSelected([nativeFile()]); await settle()
    const off = hookWorld({ hookEnv: { ...base } }); await off.render().handleFilesSelected([nativeFile()]); await settle()
    eq(sha(wire(w.researcher())), sha(wire(off.requests)), `${mode}: token_enabled false sends exactly flag off's requests`)
    eq(w.mints().length, 1, `${mode}: asked once (tokens off is remembered for 60 s)`)
  }
  // 4g. refusals: a chat that is not the caller's stops the upload before the Researcher; a refused poll is terminal
  {
    const w = hookWorld({ hookEnv: { ...base, [FLAG]: 'true' }, mint: () => ({ status: 403, body: { error: 'session_not_owned' } }) })
    await w.render().handleFilesSelected([nativeFile()]); await settle()
    eq(stagesOf(w.researcher()), [], `${mode}: not yours: nothing is sent to the Researcher`)
    eq(w.render().files[0].status, 'error', `${mode}: the upload fails through its existing error path`)
    eq(w.render().files[0].errorMessage, 'This chat session does not belong to your account.', `${mode}: with the route's meaning`)
  }
  {
    let mintsSeen = 0
    const w = hookWorld({ hookEnv: { ...base, [FLAG]: 'true' }, mint: () => { mintsSeen += 1; return mintsSeen === 1 ? { status: 200, body: tokenBody() } : { status: 410, body: { error: 'session_deleted' } } }, onRequest: r => (r.stage === 'poll' ? new Response('{}', { status: 403 }) : undefined) })
    await w.render().handleFilesSelected([nativeFile()]); await settle()
    eq(w.researcher().filter(r => r.stage === 'poll').length, 1, `${mode}: a poll whose re-mint says the chat was deleted is terminal (one poll)`)
    eq(w.render().files[0].status, 'degraded', `${mode}: enrichment degraded, the file stays attached`)
  }
  // 4h. the Researcher refuses the create's token (expired): one re-mint, one retry, the upload goes on
  {
    let creates = 0
    const w = hookWorld({ hookEnv: { ...base, [FLAG]: 'true' }, onRequest: r => (r.stage === 'create' && (creates += 1) === 1 ? new Response('{"detail":"forbidden"}', { status: 403 }) : undefined) })
    await w.render().handleFilesSelected([nativeFile()]); await settle()
    eq(stagesOf(w.researcher()), ['create', 'create', 'prepare', 'put', 'link', 'process', 'poll'], `${mode}: refused once, retried once`)
    eq(w.render().files[0].status, 'success', `${mode}: and the upload completes`)
  }
}
eq(new Set(flagOffHashes).size, 2, 'flag off: one request hash per poll path (direct, proxy), the same in both upload modes and every flag spelling')

// ================================================= 5. the upload helper (composer, deck import, template upload), run as shipped
const helperMine = ownView(HELPER)
const helperBase = registry.stripLaterChanges(HELPER, read(HELPER))
ok(stripUploadSessionToken(HELPER, helperMine) === helperBase && helperMine !== helperBase, 'the helper with this change\'s lines out is the base\'s')
async function helperRun({ source = helperMine, helperEnv = {}, storageOnly = false, userId = OWNER.id, createSession, mint } = {}) {
  const requests = []
  const processEnv = { env: helperEnv }
  const sub = (src, imports = {}) => { const m = { exports: {} }; vm.runInNewContext(transpile(src), { module: m, exports: m.exports, process: processEnv, URLSearchParams, Headers, Response, Map, Promise, Number, Error, Array, Object, JSON, Date: { now: () => clockMs }, console: { log() {}, warn() {}, error() {} }, require: id => { assert.ok(id in imports, id); return imports[id] } }); return m.exports }
  const authLib = sub(authLibSource)
  const deps = { '@/lib/config': { getKnowledgeServiceUrl: () => `${RESEARCHER_BASE}/` }, '@/lib/service-url': serviceUrl, '@/lib/upload-session-token': sub(clientSource, { '@/lib/researcher-ingest-status-auth': authLib }) }
  const module = { exports: {} }
  vm.runInNewContext(transpile(source), {
    module, exports: module.exports, process: processEnv, Error, Promise, JSON, URL,
    require: id => { assert.ok(id in deps, `Unexpected import ${id}`); return deps[id] },
    fetch: (url, init) => {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
      const stage = url.startsWith('/api/researcher/session-token') ? 'mint' : url.endsWith('/sessions/create') ? 'create' : url.endsWith('/storage-upload-url') ? 'prepare' : init?.method === 'PUT' ? 'put' : 'process'
      requests.push({ url, init, stage, body })
      if (stage === 'mint') { const a = mint ? mint() : { status: 200, body: tokenBody() }; return Promise.resolve(new Response(JSON.stringify(a.body), { status: a.status })) }
      const reply = stage === 'create' ? { session_id: createSession ? createSession(body.session_id) : body.session_id } : stage === 'prepare' ? { signed_url: 'https://storage.example.test/signed-upload', storage_path: `${body.session_id}/deck.pptx` } : stage === 'process' ? { job_id: 'job-9' } : {}
      return Promise.resolve(new Response(JSON.stringify(reply), { status: stage === 'process' ? 202 : 200 }))
    },
  })
  const file = { name: 'deck.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
  const result = await module.exports.uploadFileToResearcher({ sessionId: 'chat-T', userId, file, intent: 'template_ingest', storageOnly })
  return { requests, result, researcher: requests.filter(r => r.stage !== 'mint'), mints: requests.filter(r => r.stage === 'mint') }
}
for (const storageOnly of [false, true]) {
  for (const flag of [undefined, 'false', 'TRUE', '1']) {
    const e = flag === undefined ? {} : { [FLAG]: flag }
    const mine = await helperRun({ helperEnv: { ...e }, storageOnly }), theirs = await helperRun({ source: helperBase, helperEnv: { ...e }, storageOnly })
    eq(sha(wire(mine.requests)), sha(wire(theirs.requests)), `helper, storageOnly ${storageOnly}, flag ${JSON.stringify(flag)}: request hash equals the base helper's`)
    eq(mine.result, theirs.result, 'the same result')
  }
  for (const [userId, kind] of [[OWNER.id, 'id'], [OWNER.email, 'email']]) {
    const on = await helperRun({ helperEnv: { [FLAG]: 'true' }, storageOnly, userId, createSession: () => 'researcher-T1' })
    eq(stagesOf(on.researcher), storageOnly ? ['create', 'prepare', 'put'] : ['create', 'prepare', 'put', 'process'], `helper on, ${kind}: the same requests`)
    eq(tokenOn(on.researcher), storageOnly ? { create: true, prepare: true, put: false } : { create: true, prepare: true, put: false, process: true }, `helper on, ${kind}: the token on the Researcher calls, never on the signed PUT`)
    eq(on.mints.map(r => r.url), [`/api/researcher/session-token?session_id=chat-T&owner=${kind}`, `/api/researcher/session-token?session_id=researcher-T1&owner=${kind}`], `helper on, ${kind}: the chat for the create, the Researcher session for the rest`)
  }
}

// ================================================= 6. the template upload: the chat row first, only with the flag on
const dialogMine = ownView(DIALOG)
const dialogBase = registry.stripLaterChanges(DIALOG, read(DIALOG))
ok(stripUploadSessionToken(DIALOG, dialogMine) === dialogBase && dialogMine !== dialogBase, 'the dialog with this change\'s line out is the base\'s')
const jsx = (type, props, key) => ({ type, props, ...(key === undefined ? {} : { key }) })
const flat = value => (Array.isArray(value) ? value.flatMap(flat) : !value || typeof value !== 'object' ? [] : [value, ...flat(value.props?.children)])
function dialogWorld(code, dialogEnv, api = {}) {
  const slots = [], effects = [], events = []
  let cursor = 0, serial = 0, props, tree, scheduled = false
  const a = { user: { id: OWNER.id }, upload: async () => ({ storagePath: 'offline/source.pptx', researcherSessionId: 'offline-new-1', jobId: null, fileName: 'x' }), create: async id => ({ id }), ...api }
  const react = {
    Fragment: 'Fragment',
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: initial }; return [slots[i].value, value => { const next = typeof value === 'function' ? value(slots[i].value) : value; if (!Object.is(next, slots[i].value)) scheduled = true; slots[i].value = next }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useCallback(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) slots[i] = { deps, callback }; return slots[i].callback },
    useLayoutEffect(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, effect: callback, cleanup: callback() } }) },
  }
  const createSession = (...args) => { events.push(['create', ...args]); return a.create(...args) }
  const deps = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/navigation': { usePathname: () => context.window.location.pathname },
    '@/hooks/use-auth': { useAuth: () => ({ user: a.user }) }, '@/hooks/use-chat-sessions': { useChatSessions: () => ({ createSession }) },
    '@/lib/researcher-upload': { uploadFileToResearcher: options => { events.push(['upload', options.sessionId, options.userId, options.intent]); return a.upload(options) } },
    '@/hooks/use-deckster-websocket-v2': { INGEST_INTENT_KEY_PREFIX: 'deckster_ingest_intent_' }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    './studio-editor-dialogs.css': {}, './studio-template-flows.css': {},
  }
  for (const [id, names] of [['lucide-react', ['AlertTriangle', 'FileUp', 'Loader2', 'Upload']], ['@/components/ui/dialog', ['Dialog', 'DialogContent', 'DialogDescription', 'DialogFooter', 'DialogHeader', 'DialogTitle']], ['@/components/ui/button', ['Button']]]) deps[id] = Object.fromEntries(names.map(n => [n, n]))
  const mod = { exports: {} }
  const context = {
    module: mod, exports: mod.exports, Error, process: { env: dialogEnv }, crypto: { randomUUID: () => `offline-new-${++serial}` }, console: { error: (...args) => events.push(['error-log', String(args[1]?.message ?? '')]) },
    sessionStorage: { setItem: key => events.push(['intent', key]) },
    window: { location: { pathname: '/studio/templates', search: '', assign: url => events.push(['navigate', url]) } }, fetch: () => assert.fail('No network'),
    require: id => { assert.ok(id in deps, id); return deps[id] },
  }
  const point = '\n  const phaseLabel = phase'
  assert.equal(code.split(point).length, 2)
  vm.runInNewContext(transpile(code.replace(point, `\n  globalThis.__handlers = { handleStart }\n${point}`)), context)
  const h = {
    events,
    render(next = props || { open: true, onOpenChange: open => events.push(['open', open]) }) { props = next; let turns = 0; do { assert.ok(turns++ < 10); scheduled = false; cursor = 0; tree = mod.exports.TemplateIngestDialog(props); while (effects.length) effects.shift()() } while (scheduled); return tree },
    choose(file = { name: 'Original source.pptx', size: 2048, type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }) { const input = flat(tree).find(n => n.type === 'input'); input.props.onChange({ target: { files: [file], value: 'chosen' } }); if (scheduled) h.render(); return h },
    start: () => context.__handlers.handleStart(),
    text: () => JSON.stringify(tree),
  }
  h.render()
  return h
}
for (const shell of [undefined, 'true']) {
  for (const flag of [undefined, 'false', 'TRUE', '1']) {
    const e = { ...(shell ? { NEXT_PUBLIC_STUDIO_V4_SHELL: shell } : {}), ...(flag === undefined ? {} : { [FLAG]: flag }) }
    const mine = dialogWorld(dialogMine, { ...e }), theirs = dialogWorld(dialogBase, { ...e })
    mine.choose(); theirs.choose(); await mine.start(); await theirs.start()
    eq(mine.events, theirs.events, `dialog, shell ${shell}, flag ${JSON.stringify(flag)}: the base's events, in the base's order`)
    eq(mine.events.filter(ev => ['upload', 'create'].includes(ev[0])).map(ev => ev[0]), ['upload', 'create'], 'off: upload, then the row')
  }
  const on = dialogWorld(dialogMine, { ...(shell ? { NEXT_PUBLIC_STUDIO_V4_SHELL: shell } : {}), [FLAG]: 'true' })
  on.choose(); await on.start()
  eq(on.events.filter(ev => ['upload', 'create'].includes(ev[0])), [['create', 'offline-new-1', 'Template: Original source.pptx'], ['upload', 'offline-new-1', OWNER.id, 'template_ingest']], `dialog on, shell ${shell}: the row first (same call and title), then the upload, once each`)
  eq(on.events.slice(-2), [['open', false], ['navigate', '/builder?session_id=offline-new-1']], `dialog on, shell ${shell}: the hand-off is unchanged`)
  const failed = dialogWorld(dialogMine, { ...(shell ? { NEXT_PUBLIC_STUDIO_V4_SHELL: shell } : {}), [FLAG]: 'true' }, { create: async () => null })
  failed.choose(); await failed.start(); failed.render()
  eq(failed.events.filter(ev => ev[0] === 'upload').length, 0, `dialog on, shell ${shell}: no row, no upload`)
  ok(failed.text().includes('Failed to create a new builder session'), `dialog on, shell ${shell}: the dialog's own error`)
}

// ================================================= 7. source guards
{
  const browser = [HOOK, HELPER, DIALOG, CLIENT].map(rel => ownView(rel))
  for (const [i, text] of browser.entries()) {
    ok(!/researcher-session-token'|from 'crypto'|require\('crypto'\)|RESEARCHER_SESSION_TOKEN_SECRET/.test(text), `${[HOOK, HELPER, DIALOG, CLIENT][i]}: never imports the minter or crypto, never reads the secret`)
    ok(!text.includes('Session-Token'), `${[HOOK, HELPER, DIALOG, CLIENT][i]}: never names the header (the route says which)`)
  }
  const routeText = ownView(ROUTE)
  ok(routeText.includes("'@/lib/researcher-session-token'") && !/KNOWLEDGE_API_KEY|X-API-Key/i.test(routeText + ownView(CLIENT)), 'the route signs with dev\'s minter and never uses the service key')
  ok(!/console\.\w+\([^)]*\$\{(?!code)/.test(routeText), 'the route logs nothing but its reason code')
  // who reads the flag (scripts aside): the client, the route, the dialog
  const readers = []
  const walk = dir => { for (const entry of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) { if (['node_modules', '.next', '.git'].includes(entry.name)) continue; const rel = path.posix.join(dir, entry.name); if (entry.isDirectory()) walk(rel); else if (/\.(tsx?|mjs|js)$/.test(entry.name) && ownView(rel).includes(`process.env.${FLAG}`)) readers.push(rel) } }
  for (const dir of ['app', 'components', 'lib', 'hooks']) walk(dir)
  eq(readers.sort(), [ROUTE, DIALOG, CLIENT].sort(), 'the flag is read in the client, the route and the dialog only')
  const importers = []
  const walk2 = dir => { for (const entry of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) { if (['node_modules', '.next', '.git'].includes(entry.name)) continue; const rel = path.posix.join(dir, entry.name); if (entry.isDirectory()) walk2(rel); else if (/\.(tsx?)$/.test(entry.name) && ownView(rel).includes("'@/lib/upload-session-token'")) importers.push(rel) } }
  for (const dir of ['app', 'components', 'lib', 'hooks']) walk2(dir)
  eq(importers.sort(), [HOOK, HELPER].sort(), 'the client is imported by the hook and the helper only')
}

// ================================================= 8. .env.example, the strip and the registry
{
  const BLOCK = S.UPLOAD_SESSION_TOKEN_ENV_BLOCK
  const envNow = ownView(ENVFILE)
  const lines = BLOCK.replace(/\n$/, '').split('\n')
  ok(BLOCK.endsWith('\n') && !BLOCK.startsWith('\n'), 'the block is whole lines')
  eq(lines.at(-1), `${FLAG}="false"`, 'one assignment, last, default off')
  ok(lines.slice(0, -1).every(line => line.startsWith('# ')), 'comments, then the flag')
  eq(BLOCK.split('\n').filter(line => /^[A-Z_]+=/.test(line)).length, 1, 'it assigns nothing else (the secret is the ingest-status block\'s, above)')
  ok(!/NEXT_PUBLIC_[A-Z_]*SECRET|NEXT_PUBLIC_RESEARCHER_SESSION|NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED/.test(BLOCK), 'no secret behind NEXT_PUBLIC_, and no other change\'s flag named')
  ok(!BLOCK.includes('exact "true" enables it'), 'not the phrase older env proofs refuse')
  eq(envNow.split(BLOCK).length - 1, 1, 'in .env.example once, verbatim')
  ok(envNow.endsWith(`\n\n${BLOCK}`), 'at the true end, after one blank line (once the blocks registered after it are out)')
  eq(envNow.split(`${FLAG}=`).length - 1, 1, 'assigned once')
  ok(!registry.stripLaterChanges(ENVFILE, read(ENVFILE)).includes(FLAG), 'the registry takes it out for the older pins')
  ok(registry.LATER_ENV_BLOCKS.includes(BLOCK), 'registered')
  // the strip: the base's files back, byte for byte, read through the registry on BOTH sides
  for (const rel of [...S.UPLOAD_SESSION_TOKEN_APP_FILES, ...S.UPLOAD_SESSION_TOKEN_PIN_FILES, S.UPLOAD_SESSION_TOKEN_FIXTURE, ENVFILE]) {
    const now = registry.stripLaterChanges(rel, read(rel))
    ok(!S.UPLOAD_SESSION_TOKEN_MARKER_RE.test(now) && !now.includes(S.UPLOAD_SESSION_TOKEN_PIN_MARK) && !now.includes('k06_mint_and_verify'), `${rel}: none of this change's lines left after the registry`)
    eq(registry.stripLaterChanges(rel, now), now, `${rel}: idempotent`)
    const base = baseText(rel)
    if (base !== null) eq(now, registry.stripLaterChanges(rel, base), `${rel}: through the registry it is the base's`)
    const own = ownView(rel)
    if (rel !== ENVFILE) ok(stripUploadSessionToken(rel, own) !== own, `${rel}: this change's strip has something to take out`)
  }
  eq(stripUploadSessionToken('app/builder/page.tsx', 'x\n'), 'x\n', 'any other file comes back as it is')
  eq(stripUploadSessionToken(ENVFILE, read(ENVFILE)), read(ENVFILE), '.env.example is the registry\'s to take out')
  // every line this change put into an app file carries the marker; every taught line the pin mark
  for (const [rel, pairs] of Object.entries(S.UPLOAD_SESSION_TOKEN_EDITS)) for (const [has] of pairs) for (const line of has.replace(/\n$/, '').split('\n')) ok(S.UPLOAD_SESSION_TOKEN_MARKER_RE.test(line), `${rel}: a marked line`)
  for (const [rel, pairs] of Object.entries(S.UPLOAD_SESSION_TOKEN_PIN_EDITS)) for (const [has] of pairs) for (const line of has.replace(/\n$/, '').split('\n')) ok(line.includes(S.UPLOAD_SESSION_TOKEN_PIN_MARK), `${rel}: a taught line`)
  for (const rel of [...S.UPLOAD_SESSION_TOKEN_APP_FILES]) eq(ownView(rel).split('\n').filter(line => S.UPLOAD_SESSION_TOKEN_MARKER_RE.test(line)).length, S.UPLOAD_SESSION_TOKEN_EDITS[rel].reduce((n, [has]) => n + has.split('\n').length - 1, 0), `${rel}: every marked line is one the strip knows`)
  // registration: three lines, one in each list, each at the end of its list (only other changes' registered lines after it)
  ok(registry.LATER_STRIPS.includes(stripUploadSessionToken) && [...S.UPLOAD_SESSION_TOKEN_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'the strip and every scope file are registered')
  const regLines = read('scripts/studio-later-changes.mjs').split('\n')
  const sectionOf = i => regLines.slice(0, i).reduce((name, line) => /^export const (LATER_\w+) = /.exec(line)?.[1] ?? name, '')
  const own = regLines.map((line, i) => [line, i]).filter(([line]) => line.includes("'./studio-upload-session-token-strip.mjs'"))
  eq(own.map(([line, i]) => [sectionOf(i), /\)\.(\w+), \/\/ LATER-CHANGE: /.exec(line)?.[1]]), [['LATER_CHANGE_FILES', 'UPLOAD_SESSION_TOKEN_SCOPE_FILES'], ['LATER_ENV_BLOCKS', 'UPLOAD_SESSION_TOKEN_ENV_BLOCK'], ['LATER_STRIPS', 'stripUploadSessionToken']], 'one line in each list')
  for (const [, i] of own) for (let j = i + 1; !/^\]\)?$/.test(regLines[j]); j++) assert.match(regLines[j], /^ {2}(\.\.\.)?\(await import\('\.\/studio-[\w-]+\.mjs'\)\)\.\w+, \/\/ LATER-CHANGE: |^ {2}\/\/ one line per later change/)
  checks += 1
  // package.json stays dev's
  const pkgBase = baseText('package.json')
  if (pkgBase !== null) eq(registry.stripLaterChanges('package.json', read('package.json')), registry.stripLaterChanges('package.json', pkgBase), 'package.json is dev\'s')
}

// ================================================= 9. scope: this change's OWN frozen range (BASE_COMMIT..OWN_HEAD)
if (hasCommit(BASE_COMMIT) && hasCommit(OWN_HEAD)) {
  const files = git('diff', '--name-only', BASE_COMMIT, OWN_HEAD).split('\n').filter(Boolean).sort()
  eq(files, [...S.UPLOAD_SESSION_TOKEN_SCOPE_FILES].sort(), `the frozen diff ${BASE_COMMIT.slice(0, 8)}..${OWN_HEAD.slice(0, 8)} is this change's scope, no more, no less`)
  const subjects = git('log', '--no-merges', '--format=%s', `${BASE_COMMIT}..${OWN_HEAD}`).split('\n').filter(Boolean)
  ok(subjects.length >= 1 && subjects.every(s => s.startsWith(S.UPLOAD_SESSION_TOKEN_SUBJECT)), 'every own commit is "Upload session token: ..."')
  const diff = git('diff', '--unified=0', BASE_COMMIT, OWN_HEAD)
  ok(!/RESEARCHER_SESSION_TOKEN_SECRET[ \t]*=[ \t]*["']?[A-Za-z0-9+/_-]{8,}/.test(diff), 'no secret value in the diff')
  ok(!/sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|[a-z]+:\/\/[^\s/:@]+:[^\s/@]+@/.test(diff), 'nothing key-shaped or userinfo-shaped in the diff')
  for (const rel of S.UPLOAD_SESSION_TOKEN_APP_FILES) {
    const added = git('diff', '--unified=0', BASE_COMMIT, OWN_HEAD, '--', rel).split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'))
    ok(added.length > 0 && added.every(line => S.UPLOAD_SESSION_TOKEN_MARKER_RE.test(line)), `${rel}: every line added in the frozen range carries the marker`)
  }
} else {
  console.log(`  SKIP frozen scope: ${BASE_COMMIT.slice(0, 8)} or OWN_HEAD (${OWN_HEAD ? OWN_HEAD.slice(0, 8) : 'not pinned yet'}) is not in this clone`)
}

console.log(`test-studio-upload-session-token: ${checks} checks passed`)
