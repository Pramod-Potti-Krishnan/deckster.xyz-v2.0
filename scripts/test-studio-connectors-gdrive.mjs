// P4-15 slice 1: Google Drive connector (DARK) — flag NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED.
// Run: node scripts/test-studio-connectors-gdrive.mjs   (transpile + vm, fake fetch, no network)
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { execFileSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(path.join(root, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

function load(file, stubs, env) {
  const cache = new Map()
  const run = (abs) => {
    if (cache.has(abs)) return cache.get(abs).exports
    const src = fs.readFileSync(abs, 'utf8')
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const mod = { exports: {} }; cache.set(abs, mod)
    const req = (spec) => {
      if (spec in stubs) return stubs[spec]
      if (spec.startsWith('@/')) { const base = path.join(root, spec.slice(2)); for (const s of ['.ts', '.tsx']) if (fs.existsSync(base + s)) return run(base + s) }
      return nodeRequire(spec)
    }
    vm.runInNewContext(js, { require: req, module: mod, exports: mod.exports, process: { env }, console, URL, URLSearchParams, Buffer, JSON, Date, Promise, AbortSignal: TestAbortSignal, fetch: (...a) => globalThis.fetch(...a) }, { filename: abs })
    return mod.exports
  }
  return run(path.join(root, file))
}

// ---- fakes ----
class FakeRes {
  constructor(body, status = 200, location, headers) { this.body = body; this.status = status; this.location = location; this.headers = new Headers(headers); this.cookies = { jar: {}, set: (n, v, o) => { this.cookies.jar[n] = { v, o } } } }
}
const plain = v => JSON.parse(JSON.stringify(v))
const NextResponse = { json: (b, i = {}) => new FakeRes(b, i.status ?? 200, undefined, i.headers), redirect: (u) => new FakeRes(null, 307, String(u)) }
// hardening: the server reads Researcher answers as real Responses (a capped stream), so every fake answer becomes one; AbortSignal.timeout is recorded
const signals = { requested: [], fastMs: null }
const TestAbortSignal = { timeout: ms => { signals.requested.push(ms); return AbortSignal.timeout(signals.fastMs ?? ms) } }
async function asResponse(r) {
  if (r instanceof Response) return r
  let text
  try { text = JSON.stringify(await r.json()) } catch { text = 'not json' }
  return new Response(text, { status: r.status })
}
let calls = []
let reply = () => ({ ok: true, status: 200, json: async () => ({}) })
const stubsFor = (userId = 'cuid_session_user') => ({
  'next/server': { NextResponse },
  '@/lib/kg-proxy': {
    requireKgEntitled: async () => (userId ? { userId } : { error: new FakeRes({ error: 'Unauthorized' }, 401) }),
    kgHeaders: (x) => ({ ...x, 'X-API-Key': 'test-key' }),
  },
  '@/lib/service-url': { requireServiceUrl: (_l, c) => { if (!c[0].value) throw new Error('nc'); return c[0].value } },
})
const ENV_ON = { NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: 'true', NEXTAUTH_SECRET: 's3cret', NEXTAUTH_URL: 'https://app.test', GOOGLE_CONNECTOR_CLIENT_ID: 'cid', KNOWLEDGE_SERVICE_URL: 'https://researcher.test', RESEARCHER_SESSION_TOKEN_SECRET: 'test-only-researcher-session-secret-0123456789' }
const fakeFetch = async (url, init) => { calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : undefined }); return asResponse(await reply(url, init)) }
globalThis.fetch = fakeFetch
const SERVER = 'lib/connectors-gdrive-server.ts'
const req = (url, body, cookie) => ({ url, json: async () => body, cookies: { get: (n) => (cookie && n === 'deckster_gdrive_oauth_nonce' ? { value: cookie } : undefined) } })
let passed = 0
const t = async (name, fn) => { calls = []; signals.requested = []; signals.fastMs = null; reply = () => ({ ok: true, status: 200, json: async () => ({}) }); await fn(); passed++; console.log('ok -', name) }

// 1. flag off => every route 404s, no fetch
for (const flag of [undefined, 'false', 'TRUE', '1', ' true']) {
  await t(`flag ${JSON.stringify(flag)} => all routes 404`, async () => {
    const s = load(SERVER, stubsFor(), { ...ENV_ON, NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: flag })
    for (const r of [await s.handleStart(), await s.handleCallback(req('https://app.test/cb?code=x&state=y')), await s.handlePickerToken(), await s.handleItemsGet(), await s.handleItemsPost(req('u', { file_ids: ['abcdefghij12'] })), await s.handleDisconnect()]) assert.equal(r.status, 404)
    assert.equal(calls.length, 0)
  })
}

// 2. settings card/sidebar absent when off; page calls notFound
const sidebarStubs = { 'next/link': { __esModule: true, default: (p) => React.createElement('a', { href: p.href }, p.children) }, 'next/navigation': { usePathname: () => '/settings/profile' }, 'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: 'u' } } }) }, 'lucide-react': new Proxy({}, { get: () => () => null }), '@/lib/utils': { cn: (...a) => a.filter(Boolean).join(' ') }, react: React }
await t('sidebar: Connectors only when flag exactly "true"', async () => {
  const off = renderToStaticMarkup(React.createElement(load('components/settings/settings-sidebar.tsx', sidebarStubs, {}).SettingsSidebar))
  const on = renderToStaticMarkup(React.createElement(load('components/settings/settings-sidebar.tsx', sidebarStubs, { NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: 'true' }).SettingsSidebar))
  assert.ok(!off.includes('/settings/connectors')); assert.ok(on.includes('/settings/connectors'))
  assert.equal(on.replace(/<a href="\/settings\/connectors">.*?<\/a>/, ''), off)
})
await t('connectors page: flag off => notFound, no card', async () => {
  let nf = 0
  const page = load('app/(app)/settings/connectors/page.tsx', { ...sidebarStubs, 'next/navigation': { notFound: () => { nf++; throw new Error('NEXT_NOT_FOUND') } }, '@/components/ui/button': {}, '@/components/ui/card': {}, '@/components/ui/alert': {} }, {})
  assert.throws(() => renderToStaticMarkup(React.createElement(page.default)), /NEXT_NOT_FOUND/); assert.equal(nf, 1)
})

// 3. state / nonce
const lib = load('lib/connectors-gdrive.ts', {}, {})
await t('state verifies; tampering, wrong user, wrong nonce, expiry rejected', async () => {
  const st = lib.signState('k', 'userA', 'nonce1', 1000)
  assert.equal(lib.verifyState('k', st, 'userA', 'nonce1', 2000).ok, true)
  const [p, sig] = st.split('.')
  const forged = Buffer.from(JSON.stringify({ u: 'userB', n: 'nonce1', e: 9e15 })).toString('base64url')
  assert.equal(lib.verifyState('k', `${forged}.${sig}`, 'userB', 'nonce1', 2000).ok, false)
  assert.equal(lib.verifyState('k', `${p}.${sig.slice(0, -1)}A`, 'userA', 'nonce1', 2000).ok, false)
  assert.equal(lib.verifyState('other', st, 'userA', 'nonce1', 2000).ok, false)
  assert.equal(lib.verifyState('k', st, 'userB', 'nonce1', 2000).reason, 'user mismatch')
  assert.equal(lib.verifyState('k', st, 'userA', 'nonceX', 2000).reason, 'nonce mismatch')
  assert.equal(lib.verifyState('k', st, 'userA', undefined, 2000).reason, 'nonce mismatch')
  assert.equal(lib.verifyState('k', st, 'userA', 'nonce1', 1000 + 11 * 60 * 1000).reason, 'expired')
  assert.equal(lib.verifyState('k', 'garbage', 'userA', 'nonce1').ok, false)
})

// 4. start + callback
await t('start: drive.file URL, state bound to session user, httpOnly nonce cookie', async () => {
  const s = load(SERVER, stubsFor(), ENV_ON)
  const r = await s.handleStart()
  const u = new URL(r.location)
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.file')
  const c = r.cookies.jar.deckster_gdrive_oauth_nonce
  assert.ok(c.o.httpOnly && c.v)
  assert.equal(lib.verifyState('s3cret', u.searchParams.get('state'), 'cuid_session_user', c.v).ok, true)
  assert.equal(calls.length, 0)
})
await t('callback: tampered/mismatched state never calls Researcher', async () => {
  const s = load(SERVER, stubsFor(), ENV_ON)
  const st = lib.signState('s3cret', 'someone_else', 'n1')
  const r = await s.handleCallback(req(`https://app.test/api/connectors/gdrive/callback?code=c&state=${st}`, null, 'n1'))
  assert.match(r.location, /gdrive=invalid/); assert.equal(calls.length, 0)
  const st2 = lib.signState('s3cret', 'cuid_session_user', 'n1')
  const r2 = await s.handleCallback(req(`https://app.test/x?code=c&state=${st2}`, null, 'n2'))
  assert.match(r2.location, /gdrive=invalid/); assert.equal(calls.length, 0)
})
await t('callback: valid -> exchange server-to-server, tokens never returned', async () => {
  reply = () => ({ ok: true, status: 200, json: async () => ({ refresh_token: 'RT_SECRET', access_token: 'AT_SECRET' }) })
  const s = load(SERVER, stubsFor(), ENV_ON)
  const st = lib.signState('s3cret', 'cuid_session_user', 'n1')
  const r = await s.handleCallback(req(`https://app.test/api/connectors/gdrive/callback?code=CODE1&state=${st}&owner_id=evil`, null, 'n1'))
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://researcher.test/api/v1/connectors/gdrive/exchange')
  assert.equal(calls[0].init.headers['X-API-Key'], 'test-key')
  assert.deepEqual(plain(calls[0].body), { owner_id: 'cuid_session_user', code: 'CODE1', redirect_uri: 'https://app.test/api/connectors/gdrive/callback' })
  assert.equal(r.status, 307); assert.match(r.location, /gdrive=connected$/); assert.equal(r.body, null)
  assert.ok(!JSON.stringify(r).includes('RT_SECRET') && !JSON.stringify(r).includes('AT_SECRET'))
  assert.equal(r.cookies.jar.deckster_gdrive_oauth_nonce.o.maxAge, 0)
})

// 5. owner from session, ids validated, no tokens leak
await t('items POST: owner from session not body; ids validated', async () => {
  const s = load(SERVER, stubsFor(), ENV_ON)
  const r = await s.handleItemsPost(req('u', { owner_id: 'evil', file_ids: ['1AbCdEfGhIjK_-x', '1AbCdEfGhIjK_-x'] }))
  assert.equal(r.status, 200); assert.deepEqual(plain(calls[0].body), { owner_id: 'cuid_session_user', file_ids: ['1AbCdEfGhIjK_-x'] })
  for (const bad of [undefined, [], 'abc', ['short'], ['../../etc/passwd'], ['a'.repeat(129)], [123], Array.from({ length: 51 }, (_, i) => `file_id_${String(i).padStart(4, '0')}`)]) {
    calls = []
    const rb = await s.handleItemsPost(req('u', { file_ids: bad }))
    assert.equal(rb.status, 400); assert.equal(calls.length, 0)
  }
})
await t('items GET / disconnect / picker-token use session owner; token-like fields scrubbed', async () => {
  reply = () => ({ ok: true, status: 200, json: async () => ({ connected: true, refresh_token: 'RT', items: [{ title: 'Doc', access_token: 'X' }] }) })
  const s = load(SERVER, stubsFor(), ENV_ON)
  const g = await s.handleItemsGet()
  assert.equal(new URL(calls[0].url).searchParams.get('owner_id'), 'cuid_session_user')
  assert.deepEqual(plain(g.body), { connected: true, account_label: null, items: [{ title: 'Doc' }] })
  await s.handleDisconnect(); assert.deepEqual(plain(calls[1].body), { owner_id: 'cuid_session_user' })
  reply = () => ({ ok: true, status: 200, json: async () => ({ access_token: 'short', expires_in: 3599, refresh_token: 'RT' }) })
  const p = await s.handlePickerToken(); assert.deepEqual(plain(p.body), { access_token: 'short', expires_in: 3599 })
})
await t('unauthenticated => 401, no fetch; upstream 500 => plain-words 502', async () => {
  const s = load(SERVER, stubsFor(null), ENV_ON)
  assert.equal((await s.handleItemsGet()).status, 401); assert.equal(calls.length, 0)
  reply = () => ({ ok: false, status: 500, json: async () => ({ detail: 'Traceback...' }) })
  const s2 = load(SERVER, stubsFor(), ENV_ON)
  const r = await s2.handleDisconnect(); assert.equal(r.status, 502); assert.ok(!JSON.stringify(r.body).includes('Traceback'))
})
// 6. K-06 identity contract (shared vector with Researcher tests/test_connectors_gdrive.py)
const VECTOR = { secret: ['deckster-p4-15', 'connector-contract-test-vector'].join('-'), owner: 'cuid_vector_user_01', exp: 4102444800,
  token: 'v1.' + 'bGliOmN1aWRfdmVjdG9yX3VzZXJfMDE.Y3VpZF92ZWN0b3JfdXNlcl8wMQ.4102444800.vImUHf3LHLKn-HLM7ujUHthqmabrtM9C5r8Oki-0_mQ' }
await t('shared vector: Studio mint == Researcher-accepted token', async () => {
  const tok = load('lib/researcher-session-token.ts', {}, {})
  const m = tok.mintResearcherSessionToken({ secret: VECTOR.secret, sessionId: lib.connectorSessionId(VECTOR.owner), userId: VECTOR.owner, ttlSeconds: 600, nowSeconds: VECTOR.exp - 600 })
  assert.equal(m.token, VECTOR.token)
})
await t('every Researcher call (callback included) carries a lib:<owner> K-06 token for the session user', async () => {
  const s = load(SERVER, stubsFor(), ENV_ON)
  const st = lib.signState('s3cret', 'cuid_session_user', 'n1')
  await s.handleCallback(req(`https://app.test/api/connectors/gdrive/callback?code=C&state=${st}`, null, 'n1'))
  await s.handlePickerToken(); await s.handleItemsGet(); await s.handleItemsPost(req('u', { file_ids: ['1AbCdEfGhIjK_-x'] })); await s.handleDisconnect()
  assert.equal(calls.length, 5)
  for (const c of calls) {
    const [v, sid, uid, exp, mac] = c.init.headers['X-Deckster-Session-Token'].split('.')
    assert.equal(v, 'v1'); assert.equal(Buffer.from(sid, 'base64url').toString(), 'lib:cuid_session_user')
    assert.equal(Buffer.from(uid, 'base64url').toString(), 'cuid_session_user')
    const want = crypto.createHmac('sha256', ENV_ON.RESEARCHER_SESSION_TOKEN_SECRET).update(`lib:cuid_session_user|cuid_session_user|${exp}`).digest('base64url')
    assert.equal(mac, want); assert.ok(Number(exp) - Date.now() / 1000 <= 301)
    assert.equal(c.init.headers['X-API-Key'], 'test-key')
  }
})
await t('secret unset/short => fail closed: 503 / callback failed, no Researcher call', async () => {
  for (const sec of [undefined, 'short']) {
    calls = []
    const s = load(SERVER, stubsFor(), { ...ENV_ON, RESEARCHER_SESSION_TOKEN_SECRET: sec })
    assert.equal((await s.handleStart()).status, 503)
    for (const r of [await s.handlePickerToken(), await s.handleItemsGet(), await s.handleItemsPost(req('u', { file_ids: ['1AbCdEfGhIjK_-x'] })), await s.handleDisconnect()]) assert.equal(r.status, 503)
    const st = lib.signState('s3cret', 'cuid_session_user', 'n1')
    assert.match((await s.handleCallback(req(`https://app.test/cb?code=C&state=${st}`, null, 'n1'))).location, /gdrive=failed/)
    assert.equal(calls.length, 0)
  }
})
await t('allow-list relay: contract fields kept, unknown/secret fields dropped, error_code relayed', async () => {
  const row = { id: 'f1', source_ref: 'f1', title: 'Doc', mime: 'm', modified_time: 't', url: 'https://d', status: 'queued', error: null, job_id: 'j',
    storage_path: 'connectors/x', owner_id: 'o', enc_refresh_token: 'RT', credentials: { a: 1 } }
  reply = () => ({ ok: true, status: 200, json: async () => ({ connected: true, account_label: 'a@b', items: [row], refresh_token: 'RT', debug: 1 }) })
  const s = load(SERVER, stubsFor(), ENV_ON)
  const g = plain((await s.handleItemsGet()).body)
  assert.deepEqual(g, { connected: true, account_label: 'a@b', items: [{ id: 'f1', source_ref: 'f1', title: 'Doc', mime: 'm', modified_time: 't', url: 'https://d', status: 'queued', error: null, job_id: 'j' }] })
  reply = () => ({ ok: false, status: 409, json: async () => ({ detail: 'CONNECTOR_GRANT_REVOKED' }) })
  const e = await s.handleItemsGet(); assert.equal(e.status, 409); assert.equal(e.body.error_code, 'CONNECTOR_GRANT_REVOKED')
  reply = () => ({ ok: false, status: 401, json: async () => ({ detail: 'secret=abc' }) })
  const e2 = await s.handleItemsGet(); assert.equal(e2.body.error_code, null)
})

// 7. hardening (REVIEW-1 #2 / #3 / #4 / #7a; FRONTEND-2 N2 / N3 / N4), stacked on #615 815ea9cf
const CAP = 1024 * 1024
await t('hardening #2: every Researcher call refuses redirects and carries an 8 s timeout (the ingest-status route\'s)', async () => {
  const s = load(SERVER, stubsFor(), ENV_ON)
  assert.equal(s.RESEARCHER_TIMEOUT_MS, 8000); assert.equal(s.RESEARCHER_MAX_BODY_BYTES, CAP)
  const st = lib.signState('s3cret', 'cuid_session_user', 'n1')
  await s.handleCallback(req(`https://app.test/api/connectors/gdrive/callback?code=C&state=${st}`, null, 'n1'))
  await s.handlePickerToken(); await s.handleItemsGet(); await s.handleItemsPost(req('u', { file_ids: ['1AbCdEfGhIjK_-x'] })); await s.handleDisconnect()
  assert.equal(calls.length, 5)
  for (const c of calls) { assert.equal(c.init.redirect, 'manual', c.url); assert.ok(c.init.signal instanceof AbortSignal, c.url) }
  assert.deepEqual(signals.requested, [8000, 8000, 8000, 8000, 8000])
})
await t('hardening #2: a 3xx answer is an upstream error (502, error_code null), never followed or read; the exchange ends "failed"', async () => {
  reply = () => new Response('{"access_token":"FROM_REDIRECT"}', { status: 307, headers: { location: 'https://evil.test/steal' } })
  const s = load(SERVER, stubsFor(), ENV_ON)
  for (const r of [await s.handlePickerToken(), await s.handleItemsGet(), await s.handleDisconnect()]) {
    assert.equal(r.status, 502); assert.equal(r.body.error_code, null); assert.ok(!JSON.stringify(plain(r.body)).includes('FROM_REDIRECT'))
  }
  assert.equal(calls.length, 3, 'one call each: nothing followed the Location')
  const st = lib.signState('s3cret', 'cuid_session_user', 'n1')
  const cb = await s.handleCallback(req(`https://app.test/api/connectors/gdrive/callback?code=C&state=${st}`, null, 'n1'))
  assert.match(cb.location, /gdrive=failed$/)
})
await t('hardening #2: a wedged Researcher ends at the timeout: 504 plain words, nothing leaked; the exchange ends "failed"', async () => {
  signals.fastMs = 5
  reply = (_u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))
  const keepAlive = setInterval(() => {}, 20) // AbortSignal.timeout's timer does not hold the process open on its own
  const realError = console.error
  try {
    const s = load(SERVER, stubsFor(), ENV_ON)
    const r = await s.handleItemsGet(); assert.equal(r.status, 504); assert.equal(r.body.error, 'Could not load your Drive files. Please try again.')
    const p = await s.handlePickerToken(); assert.equal(p.status, 504)
    const st = lib.signState('s3cret', 'cuid_session_user', 'n1')
    console.error = () => {}
    assert.match((await s.handleCallback(req(`https://app.test/api/connectors/gdrive/callback?code=C&state=${st}`, null, 'n1'))).location, /gdrive=failed$/)
  } finally { console.error = realError; clearInterval(keepAlive) }
})
await t('hardening #2: answers are read up to 1 MiB: over it (streamed or declared) => 502, exactly at it => read', async () => {
  const s = load(SERVER, stubsFor(), ENV_ON)
  reply = () => new Response('{"access_token":"' + 'a'.repeat(CAP) + '"}', { status: 200 })
  const big = await s.handlePickerToken(); assert.equal(big.status, 502); assert.equal(big.body.access_token, undefined)
  reply = () => new Response('{}', { status: 200, headers: { 'content-length': String(CAP + 1) } })
  assert.equal((await s.handleItemsGet()).status, 502, 'a declared length over the cap is refused before reading')
  const head = '{"access_token":"', foot = '","expires_in":1}'
  reply = () => new Response(head + 'b'.repeat(CAP - head.length - foot.length) + foot, { status: 200 })
  const at = await s.handlePickerToken(); assert.equal(at.status, 200); assert.equal(at.body.access_token.length, CAP - head.length - foot.length)
  reply = () => new Response('{"detail":"CONNECTOR_GRANT_REVOKED","pad":"' + 'x'.repeat(CAP) + '"}', { status: 409 })
  assert.equal((await s.handleItemsGet()).status, 502, 'an error body over the cap is not read either')
})
await t('hardening #4: only an allow-listed Researcher 4xx keeps its status; any other 4xx and every 5xx => 502, generic words', async () => {
  const s = load(SERVER, stubsFor(), ENV_ON)
  for (const [status, detail, want, code] of [
    [409, 'CONNECTOR_GRANT_REVOKED', 409, 'CONNECTOR_GRANT_REVOKED'], [404, 'CONNECTOR_NOT_CONNECTED', 404, 'CONNECTOR_NOT_CONNECTED'],
    [403, 'CONNECTOR_SESSION_NOT_OWNED', 403, 'CONNECTOR_SESSION_NOT_OWNED'], [403, 'CONNECTOR_OWNER_MISMATCH', 403, 'CONNECTOR_OWNER_MISMATCH'],
    [403, 'Forbidden', 502, null], [401, 'secret=abc', 502, null], [404, 'Not Found', 502, null], [400, undefined, 502, null], [422, [{ msg: 'x' }], 502, null],
    [503, 'CONNECTOR_SESSION_UNAVAILABLE', 502, 'CONNECTOR_SESSION_UNAVAILABLE'], [500, 'Traceback...', 502, null],
  ]) {
    reply = () => ({ ok: false, status, json: async () => ({ detail }) })
    const r = await s.handleItemsGet()
    assert.equal(r.status, want, `${status} ${detail}`); assert.equal(r.body.error_code, code, `${status} ${detail}`)
    assert.equal(r.body.error, 'Could not load your Drive files. Please try again.'); assert.ok(!JSON.stringify(plain(r.body)).includes('secret') && !JSON.stringify(plain(r.body)).includes('Traceback'))
  }
  assert.ok(lib.CONNECTOR_ERROR_CODES.includes('CONNECTOR_SESSION_NOT_OWNED') && lib.CONNECTOR_ERROR_CODES.includes('CONNECTOR_SESSION_UNAVAILABLE'))
})
await t('hardening #3: Cache-Control no-store on every flag-on JSON answer; the flag-off 404 is exactly what it was (no header)', async () => {
  reply = () => ({ ok: true, status: 200, json: async () => ({ access_token: 'short', expires_in: 1, items: [] }) })
  const s = load(SERVER, stubsFor(), ENV_ON)
  const answers = [await s.handlePickerToken(), await s.handleItemsGet(), await s.handleItemsPost(req('u', { file_ids: ['1AbCdEfGhIjK_-x'] })), await s.handleDisconnect(),
    await s.handleItemsPost(req('u', { file_ids: [] })), await load(SERVER, stubsFor(null), ENV_ON).handleItemsGet(), await load(SERVER, stubsFor(), { ...ENV_ON, RESEARCHER_SESSION_TOKEN_SECRET: '' }).handlePickerToken()]
  assert.deepEqual(answers.map(r => r.status), [200, 200, 200, 200, 400, 401, 503])
  for (const r of answers) assert.equal(r.headers.get('cache-control'), 'no-store', String(r.status))
  reply = () => ({ ok: false, status: 409, json: async () => ({ detail: 'CONNECTOR_GRANT_REVOKED' }) })
  assert.equal((await s.handlePickerToken()).headers.get('cache-control'), 'no-store', 'relayed errors too')
  const off = load(SERVER, stubsFor(), { ...ENV_ON, NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: undefined })
  for (const r of [await off.handlePickerToken(), await off.handleItemsGet(), await off.handleStart()]) {
    assert.equal(r.status, 404); assert.deepEqual(plain(r.body), { error: 'Not found' }); assert.equal(r.headers.get('cache-control'), null); assert.deepEqual([...r.headers.keys()], [])
  }
})
await t('hardening #7a: start checks the Researcher address and the identity BEFORE Google: unset => 503, no redirect, no cookie, no call', async () => {
  for (const env of [{ ...ENV_ON, KNOWLEDGE_SERVICE_URL: undefined }, { ...ENV_ON, KNOWLEDGE_SERVICE_URL: '' }]) {
    const r = await load(SERVER, stubsFor(), env).handleStart(); assert.equal(r.status, 503); assert.equal(r.location, undefined); assert.deepEqual(r.cookies.jar, {})
    assert.equal(r.body.error, 'Google Drive connection is not set up on this server yet.')
  }
  const ok = await load(SERVER, stubsFor(), ENV_ON).handleStart(); assert.equal(ok.status, 307); assert.match(ok.location, /^https:\/\/accounts\.google\.com\//)
  assert.equal(calls.length, 0, 'start never calls Researcher')
})
await t('FRONTEND-2 N2 / N3 / N4: the sidebar edit has a strip pair (frozen: own strip of this change\'s head == the base sidebar; live: through the registry on both sides); isGdriveConnectorEnabled; package.json out of slice 1\'s scope', async () => {
  const { stripConnectorsGdrive, CONNECTORS_GDRIVE_SCOPE_FILES } = await import('./studio-connectors-gdrive-strip.mjs')
  const { LATER_STRIPS, stripLaterChanges } = await import('./studio-later-changes.mjs')
  const rel = 'components/settings/settings-sidebar.tsx'
  const DEV_BASE = process.env.CONNECTORS_GDRIVE_BASE || '2f06e51ec807d4ecd5cd00edc9bfd0005a5fd0b8' // studio-v4-dev-preparation-code, the base #566 stacks on (the sidebar's base)
  // the hardening's own head, frozen (its PR's last code + proof commit; this pin is set by a commit of its own): what this change made of the sidebar, however much lands on top later
  const OWN_HEAD = process.env.CONNECTORS_HARDENING_HEAD || 'PENDING'
  const have = commit => { try { execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: root, stdio: 'ignore' }); return true } catch { return false } }
  const show = ref => execFileSync('git', ['show', `${ref}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
  assert.ok(LATER_STRIPS.includes(stripConnectorsGdrive), 'registered')
  assert.equal(stripConnectorsGdrive('app/builder/page.tsx', 'x'), 'x'); assert.equal(stripConnectorsGdrive(rel, 7), 7)
  assert.equal(CONNECTORS_GDRIVE_SCOPE_FILES.has('package.json'), false)
  if (!have(DEV_BASE)) { console.log(`   SKIP sidebar identity: ${DEV_BASE.slice(0, 8)} is not in this clone`); return }
  const base = show(DEV_BASE)
  // live: the sidebar as it is now and the base read the same once every registered later change (this one included) is taken out
  assert.equal(stripLaterChanges(rel, fs.readFileSync(path.join(root, rel), 'utf8')), stripLaterChanges(rel, base), 'through the registry, both sides')
  // frozen: this change's own strip pair, on this change's own head
  if (!have(OWN_HEAD)) { console.log(`   SKIP sidebar strip pair (frozen): ${OWN_HEAD.slice(0, 8)} is not in this clone`); return }
  const own = show(OWN_HEAD)
  assert.notEqual(own, base); assert.equal(stripConnectorsGdrive(rel, own), base, 'strip(sidebar at this change\'s head) === the base sidebar, byte for byte')
  assert.match(own, /isGdriveConnectorEnabled\(\) \? \[\.\.\.ITEMS, CONNECTORS_ITEM\] : ITEMS/); assert.ok(!own.includes('process.env.NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED'))
})
console.log(`\n${passed} passed`)
