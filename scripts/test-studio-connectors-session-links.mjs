// P4-15 slice 3 Studio half (DARK) — flag NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED.
// Run: node scripts/test-studio-connectors-session-links.mjs   (transpile + vm, fake fetch, no network)
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

function load(file, stubs, env, overrides = {}) {
  const cache = new Map()
  const run = (abs) => {
    if (cache.has(abs)) return cache.get(abs).exports
    const rel = path.relative(root, abs)
    const src = rel in overrides ? overrides[rel] : fs.readFileSync(abs, 'utf8')
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const mod = { exports: {} }; cache.set(abs, mod)
    const req = (spec) => {
      if (spec in stubs) { if (spec === '@/lib/prisma') prismaLoads++; return stubs[spec] }
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
// hardening: Researcher answers are real Responses (the server reads a capped stream); AbortSignal.timeout is recorded; Prisma is a fake ChatSession table
const signals = { requested: [], fastMs: null, speedup: null }
const TestAbortSignal = { timeout: ms => { signals.requested.push(ms); return AbortSignal.timeout(signals.fastMs ?? ms / (signals.speedup ?? 1)) } } // speedup: a simulated clock, 8000 ms of a limit is 8000 / speedup real ms
async function asResponse(r) {
  if (r instanceof Response) return r
  let text
  try { text = JSON.stringify(await r.json()) } catch { text = 'not json' }
  return new Response(text, { status: r.status })
}
let prismaLoads = 0, prismaCalls = [], chatRow = { userId: 'cuid_session_user', status: 'active' }, prismaError = null
const prismaStub = { prisma: { chatSession: { findUnique: async (q) => { prismaCalls.push(q); if (prismaError) throw prismaError; return chatRow } } } }
let calls = []
let reply = () => ({ ok: true, status: 200, json: async () => ({}) })
const stubsFor = (userId = 'cuid_session_user') => ({
  'next/server': { NextResponse },
  '@/lib/kg-proxy': {
    requireKgEntitled: async () => (userId ? { userId } : { error: new FakeRes({ error: 'Unauthorized' }, 401) }),
    kgHeaders: (x) => ({ ...x, 'X-API-Key': 'test-key' }),
  },
  '@/lib/service-url': { requireServiceUrl: (_l, c) => { if (!c[0].value) throw new Error('nc'); return c[0].value } },
  '@/lib/prisma': prismaStub,
})
const ENV_ON = { NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: 'true', NEXTAUTH_SECRET: 's3cret', NEXTAUTH_URL: 'https://app.test', GOOGLE_CONNECTOR_CLIENT_ID: 'cid', KNOWLEDGE_SERVICE_URL: 'https://researcher.test', RESEARCHER_SESSION_TOKEN_SECRET: 'test-only-researcher-session-secret-0123456789' }
const fakeFetch = async (url, init) => { calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : undefined }); return asResponse(await reply(url, init)) }
globalThis.fetch = fakeFetch
const SERVER = 'lib/connectors-gdrive-server.ts'
const req = (url, body, cookie) => ({ url, json: async () => body, cookies: { get: (n) => (cookie && n === 'deckster_gdrive_oauth_nonce' ? { value: cookie } : undefined) } })
let passed = 0
const reset = () => { calls = []; signals.requested = []; signals.fastMs = null; signals.speedup = null; prismaLoads = 0; prismaCalls = []; chatRow = { userId: 'cuid_session_user', status: 'active' }; prismaError = null; reply = () => ({ ok: true, status: 200, json: async () => ({}) }) }
const t = async (name, fn) => { reset(); await fn(); passed++; console.log('ok -', name) }


const ENV = { ...ENV_ON, NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED: 'true' }
const CHAT = 'chatsess00000001'
const links = load('lib/connectors-gdrive-session-links.ts', {}, {})
const gdriveLib = load('lib/connectors-gdrive.ts', {}, {}) // signState (hardening round 2: the callback tests sign a valid state)

// 1. flags
await t('session-links flag needs exact "true" AND the Drive flag', async () => {
  assert.equal(links.isGdriveSessionLinksEnabled(undefined, 'true'), false)
  assert.equal(links.isGdriveSessionLinksEnabled('TRUE', 'true'), false)
  assert.equal(links.isGdriveSessionLinksEnabled('true', undefined), false)
  assert.equal(links.isGdriveSessionLinksEnabled('true', 'true'), true)
})

// 2. message field: off => no key at all (byte-identical message)
await t('linkedItemIdsField: off / undefined / invalid => {}', async () => {
  assert.deepEqual(plain(links.linkedItemIdsField(['abc'], false)), {})
  assert.deepEqual(plain(links.linkedItemIdsField(undefined, true)), {})
  assert.deepEqual(plain(links.linkedItemIdsField(['ok', 'bad id'], true)), {})
  assert.deepEqual(plain(links.linkedItemIdsField(Array.from({ length: 26 }, (_, i) => `id${i}`), true)), {})
  assert.equal(JSON.stringify({ a: 1, ...links.linkedItemIdsField(['x'], false) }), JSON.stringify({ a: 1 }))
})
await t('linkedItemIdsField: on => deduped ids; [] passes through (clear)', async () => {
  assert.deepEqual(plain(links.linkedItemIdsField(['a1', 'b2', 'a1'], true)), { linked_item_ids: ['a1', 'b2'] })
  assert.deepEqual(plain(links.linkedItemIdsField([], true)), { linked_item_ids: [] })
})

// 3. route off => 404, no fetch
for (const env of [ENV_ON, { ...ENV, NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: 'false' }, { ...ENV, NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED: '1' }]) {
  await t(`route off (${env.NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED}/${env.NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED}) => 404`, async () => {
    const s = load(SERVER, stubsFor(), env)
    for (const m of ['POST', 'DELETE']) assert.equal((await s.handleSessionLinks(req('u', { session_id: CHAT, item_ids: ['abcdefghij12'] }), m)).status, 404)
    assert.equal(calls.length, 0)
    assert.equal(prismaLoads, 0, 'off: Prisma is never even loaded'); assert.equal(prismaCalls.length, 0)
  })
}

// 4. on: owner from session, chat-scoped K-06 token, allow-listed relay
const tokenParts = (tok) => String(tok).split('.').map(p => Buffer.from(p, 'base64url').toString('utf8'))
for (const m of ['POST', 'DELETE']) {
  await t(`${m}: owner = session cuid, token sid = chat session, extra fields dropped`, async () => {
    reply = () => ({ ok: true, status: 200, json: async () => ({ session_id: CHAT, linked: ['abcdefghij12'], unlinked: [], rejected: [{ id: 'zzzzzzzzzz99', error: 'not_found', secret: 'x' }], token: 'LEAK' }) })
    const s = load(SERVER, stubsFor(), ENV)
    const r = await s.handleSessionLinks(req('u', { session_id: CHAT, item_ids: ['abcdefghij12', 'abcdefghij12'], owner_id: 'attacker' }), m)
    assert.equal(r.status, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://researcher.test/api/v1/connectors/gdrive/session-links')
    assert.equal(calls[0].init.method, m)
    assert.deepEqual(calls[0].body, { owner_id: 'cuid_session_user', session_id: CHAT, item_ids: ['abcdefghij12'] })
    const hdrs = calls[0].init.headers
    const tokName = Object.keys(hdrs).find(k => k !== 'Content-Type' && k !== 'X-API-Key')
    const parts = tokenParts(hdrs[tokName])
    assert.ok(parts.includes(CHAT), 'token sid = chat session')
    assert.ok(parts.includes('cuid_session_user') && !parts.includes('lib:cuid_session_user'), 'uid = owner, not library scope')
    assert.ok(!JSON.stringify(plain(r.body)).includes('LEAK') && !JSON.stringify(plain(r.body)).includes('secret'))
    assert.deepEqual(plain(r.body).rejected, [{ id: 'zzzzzzzzzz99', error: 'not_found' }])
  })
}
await t('bad input => 400, no fetch (lib: scope, empty ids, bad ids)', async () => {
  const s = load(SERVER, stubsFor(), ENV)
  for (const b of [{ session_id: 'lib:cuid_session_user', item_ids: ['abcdefghij12'] }, { session_id: CHAT, item_ids: [] }, { session_id: CHAT, item_ids: ['../x'] }, null])
    assert.equal((await s.handleSessionLinks(req('u', b), 'POST')).status, 400)
  assert.equal(calls.length, 0)
})
await t('no identity secret => 503, no fetch', async () => {
  const s = load(SERVER, stubsFor(), { ...ENV, RESEARCHER_SESSION_TOKEN_SECRET: '' })
  assert.equal((await s.handleSessionLinks(req('u', { session_id: CHAT, item_ids: ['abcdefghij12'] }), 'POST')).status, 503)
  assert.equal(calls.length, 0)
})

// 5. flag-off identity of the hook: this change's lines stripped = the base hook, byte for byte
await t('hook: strip(this change) === base hook (both sides through the registry)', async () => {
  const { stripConnectorsSessionLinks } = await import('./studio-connectors-session-links-strip.mjs')
  const { stripLaterChanges } = await import('./studio-later-changes.mjs')
  const rel = 'hooks/use-deckster-websocket-v2.ts'
  // the base is PINNED (#566's head refreshed onto studio-v4-dev-preparation-code 2f06e51e), not a branch name: a gate clone fetches only dev
  // and the head branch, so a remote-tracking ref can be stale or missing there (RUNNER-MINI-B S6, 13 Nov); this commit is an ancestor of the head
  const base = execFileSync('git', ['show', `${process.env.SESSION_LINKS_BASE || '59f94e2d7ae685ebfcc3a9a43e71ba5432b488fb'}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
  // both sides through the registry (every registered change's strip, this one's included), so a LATER change's lines in the hook come out of the
  // live file as they do out of the base, and the check still holds once later changes sit on HEAD (FRONTEND-2 addendum 13 Nov, R3)
  assert.equal(stripLaterChanges(rel, fs.readFileSync(path.join(root, rel), 'utf8')), stripLaterChanges(rel, base))
  assert.equal(stripConnectorsSessionLinks('other.ts', 'x'), 'x')
})


// 6. hardening (REVIEW-1 #1 / #2 / #3 / #4), stacked on #615 815ea9cf: Studio checks the chat is the caller's BEFORE it signs anything; Researcher's own
//    refusals are relayed with their code; the call refuses redirects, times out and is read up to a cap. Each check also runs against the mutants below.
const LINK = (m = 'POST', sid = CHAT) => req('u', { session_id: sid, item_ids: ['abcdefghij12'] })
const NOT_OWNED_BODY = { error: "Drive files can't be added to this chat yet.", error_code: 'CONNECTOR_SESSION_NOT_OWNED' }
const HARDENING = [
  ['owner check: someone else\'s chat and a chat with no row read the same (404 CONNECTOR_SESSION_NOT_OWNED, no-store); nothing is signed or sent', async (L) => {
    for (const m of ['POST', 'DELETE']) {
      const bodies = []
      for (const row of [{ userId: 'someone_else', status: 'active' }, null, { userId: 'cuid_session_user_2', status: 'active' }]) {
        chatRow = row; prismaCalls = []
        const r = await L(stubsFor(), ENV).handleSessionLinks(LINK(m), m)
        assert.equal(r.status, 404, `${m} ${JSON.stringify(row)}`); assert.equal(r.headers.get('cache-control'), 'no-store')
        assert.deepEqual(plain(prismaCalls), [{ where: { id: CHAT }, select: { userId: true, status: true } }])
        bodies.push(JSON.stringify(plain(r.body)))
      }
      assert.deepEqual(JSON.parse(bodies[0]), NOT_OWNED_BODY); assert.equal(new Set(bodies).size, 1, 'not found and not yours are indistinguishable')
    }
    assert.equal(calls.length, 0, 'no Researcher call, no token minted for a chat that is not the caller\'s')
  }],
  ['owner check: a deleted chat of the caller\'s is refused (410, same code); a failed lookup is 503 with plain words; nothing is sent', async (L) => {
    chatRow = { userId: 'cuid_session_user', status: 'deleted' }
    const d = await L(stubsFor(), ENV).handleSessionLinks(LINK(), 'POST'); assert.equal(d.status, 410); assert.deepEqual(plain(d.body), NOT_OWNED_BODY)
    chatRow = { userId: 'cuid_session_user', status: 'active' }; prismaError = new Error('db down: postgres://user:secret@host')
    for (const m of ['POST', 'DELETE']) {
      const e = await L(stubsFor(), ENV).handleSessionLinks(LINK(m), m)
      assert.equal(e.status, 503); assert.equal(e.headers.get('cache-control'), 'no-store'); assert.ok(!JSON.stringify(plain(e.body)).includes('secret'))
    }
    assert.equal(calls.length, 0)
  }],
  ['owner check: the caller\'s own live chat links as before (draft / active / archived); the lookup runs only after the 400 and 401 checks', async (L) => {
    for (const status of ['draft', 'active', 'archived']) {
      chatRow = { userId: 'cuid_session_user', status }; calls = []
      reply = () => ({ ok: true, status: 200, json: async () => ({ session_id: CHAT, linked: ['abcdefghij12'], unlinked: [], rejected: [] }) })
      const r = await L(stubsFor(), ENV).handleSessionLinks(LINK(), 'POST'); assert.equal(r.status, 200, status); assert.equal(calls.length, 1, status)
      assert.equal(r.headers.get('cache-control'), 'no-store')
    }
    prismaCalls = []
    assert.equal((await L(stubsFor(), ENV).handleSessionLinks(req('u', { session_id: 'short', item_ids: ['abcdefghij12'] }), 'POST')).status, 400)
    assert.equal((await L(stubsFor(null), ENV).handleSessionLinks(LINK(), 'POST')).status, 401)
    assert.equal(prismaCalls.length, 0, 'no lookup for a bad body or a signed-out caller')
  }],
  ['Researcher\'s refusals: 403 CONNECTOR_SESSION_NOT_OWNED keeps 403 + its code; 503 CONNECTOR_SESSION_UNAVAILABLE is a retryable 502 + code; an unknown 403 is 502', async (L) => {
    for (const [status, detail, want, code] of [[403, 'CONNECTOR_SESSION_NOT_OWNED', 403, 'CONNECTOR_SESSION_NOT_OWNED'], [503, 'CONNECTOR_SESSION_UNAVAILABLE', 502, 'CONNECTOR_SESSION_UNAVAILABLE'], [403, 'Forbidden', 502, null], [401, 'expired token', 502, null]]) {
      reply = () => ({ ok: false, status, json: async () => ({ detail }) })
      const r = await L(stubsFor(), ENV).handleSessionLinks(LINK(), 'POST')
      assert.equal(r.status, want, detail); assert.equal(r.body.error_code, code, detail); assert.equal(r.headers.get('cache-control'), 'no-store')
      assert.equal(r.body.error, 'Could not add your Drive files to this chat. Please try again.')
    }
  }],
  ['the session-links call refuses redirects (3xx => 502, never followed), carries the 8 s timeout (a wedged call => 504) and is read up to 1 MiB', async (L) => {
    reply = () => new Response('{"linked":["abcdefghij12"]}', { status: 308, headers: { location: 'https://evil.test/' } })
    const r = await L(stubsFor(), ENV).handleSessionLinks(LINK(), 'POST'); assert.equal(r.status, 502); assert.equal(calls.length, 1)
    assert.equal(calls[0].init.redirect, 'manual'); assert.ok(calls[0].init.signal instanceof AbortSignal); assert.deepEqual(signals.requested, [8000])
    reply = () => new Response('{"linked":["abcdefghij12"],"pad":"' + 'x'.repeat(1024 * 1024) + '"}', { status: 200 })
    assert.equal((await L(stubsFor(), ENV).handleSessionLinks(LINK(), 'POST')).status, 502, 'over the cap')
    signals.fastMs = 5
    reply = (_u, init) => (init.signal ? new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))) : Promise.reject(new Error('no signal')))
    const keepAlive = setInterval(() => {}, 20)
    try { assert.equal((await L(stubsFor(), ENV).handleSessionLinks(LINK('DELETE'), 'DELETE')).status, 504) } finally { clearInterval(keepAlive) }
  }],
  // ---- review round 2 (REVIEW-1 notes 1 and 2) ------------------------------------------------------------------------------------------------------
  ['start (round 2, REVIEW-1 note 1): the chat to come back to must not be someone else\'s: their row, a deleted row and a failed lookup => the Settings landing (no return cookie, no error page); no row and the caller\'s own row keep the chat', async (L) => {
    const RET = `/builder?session_id=${CHAT}`
    const startReq = (sid = CHAT) => ({ url: `https://app.test/api/connectors/gdrive/start?return=${encodeURIComponent(`/builder?session_id=${sid}`)}` })
    const callbackReq = (started, withReturn) => {
      const nonce = started.cookies.jar.deckster_gdrive_oauth_nonce.v, state = new URL(started.location).searchParams.get('state')
      const cookies = { deckster_gdrive_oauth_nonce: nonce, ...(withReturn ? { deckster_gdrive_return: withReturn } : {}) }
      return { url: `https://app.test/api/connectors/gdrive/callback?code=C&state=${state}`, json: async () => null, cookies: { get: n => (n in cookies ? { value: cookies[n] } : undefined) } }
    }
    const cases = [ // [what the lookup finds, is the chat kept]
      ['someone else\'s active chat', { userId: 'someone_else', status: 'active' }, false],
      ['someone else\'s deleted chat', { userId: 'someone_else', status: 'deleted' }, false],
      ['the caller\'s own deleted chat', { userId: 'cuid_session_user', status: 'deleted' }, false],
      ['a failed lookup', 'error', false],
      ['no row yet (a brand-new chat is a local id until its first action)', null, true],
      ['the caller\'s own draft chat', { userId: 'cuid_session_user', status: 'draft' }, true],
      ['the caller\'s own active chat', { userId: 'cuid_session_user', status: 'active' }, true],
      ['the caller\'s own archived chat', { userId: 'cuid_session_user', status: 'archived' }, true],
    ]
    for (const [what, found, kept] of cases) {
      reset(); prismaError = found === 'error' ? new Error('db down: postgres://user:secret@host') : null; chatRow = found === 'error' ? null : found
      const s = L(stubsFor(), ENV)
      const started = await s.handleStart(startReq())
      assert.equal(started.status, 307, what); assert.match(started.location, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/, `${what}: still the Google consent, never an error page`)
      assert.ok(started.cookies.jar.deckster_gdrive_oauth_nonce.o.httpOnly, what); assert.ok(!started.location.includes('session_id') && !started.location.includes('secret'), what)
      assert.deepEqual(plain(prismaCalls), [{ where: { id: CHAT }, select: { userId: true, status: true } }], `${what}: one lookup, for the chat the return names`)
      const cookie = started.cookies.jar.deckster_gdrive_return
      if (kept) { assert.equal(cookie?.v, RET, what); assert.ok(cookie.o.httpOnly && cookie.o.secure && cookie.o.path === '/api/connectors/gdrive' && cookie.o.maxAge === 600, what) } else assert.equal(cookie, undefined, `${what}: no return cookie`)
      // the round trip, with the cookie the browser would send back: the chat (with its one-time marker) or Settings
      const back = await s.handleCallback(callbackReq(started, cookie?.v))
      if (kept) assert.match(back.location, new RegExp(`^https://app\\.test/builder\\?session_id=${CHAT}&gdrive=connected&gdrive_marker=[A-Za-z0-9_-]{32}$`), what)
      else { assert.equal(back.location, 'https://app.test/settings/connectors?gdrive=connected', what); assert.equal('deckster_gdrive_return_marker' in back.cookies.jar, false, `${what}: no marker for Settings`) }
      assert.equal(calls.length, 1, `${what}: start never calls Researcher; the callback's one call is the exchange`); assert.match(calls[0].url, /\/gdrive\/exchange$/)
    }
    // no chat named, an invalid return, no request at all, an unconfigured server, a signed-out caller, the flag off: no lookup at all (Prisma is not even loaded)
    for (const [what, run] of [
      ['no ?return=', s => s.handleStart({ url: 'https://app.test/api/connectors/gdrive/start' })],
      ['an invalid return', s => s.handleStart({ url: `https://app.test/api/connectors/gdrive/start?return=${encodeURIComponent('https://evil.test/')}` })],
      ['a return that is not a chat', s => s.handleStart({ url: `https://app.test/api/connectors/gdrive/start?return=${encodeURIComponent('/settings/connectors')}` })],
      ['no request object', s => s.handleStart()],
    ]) { reset(); const r = await run(L(stubsFor(), ENV)); assert.equal(r.status, 307, what); assert.equal('deckster_gdrive_return' in r.cookies.jar, false, what); assert.equal(prismaLoads, 0, `${what}: no lookup`); assert.equal(prismaCalls.length, 0, what) }
    for (const [what, stubs, env, want] of [
      ['the Researcher address unset', stubsFor(), { ...ENV, KNOWLEDGE_SERVICE_URL: '' }, 503], ['a signed-out caller', stubsFor(null), ENV, 401],
      ['the Drive flag off', stubsFor(), { ...ENV, NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: undefined }, 404],
    ]) { reset(); const r = await L(stubs, env).handleStart(startReq()); assert.equal(r.status, want, what); assert.equal(prismaLoads, 0, `${what}: no lookup`); assert.equal(prismaCalls.length, 0, what) }
  }],
  ['the exchange (round 2, REVIEW-1 note 2): the callback\'s code exchange has its own 20 s limit, every other Researcher call keeps 8 s; a slow exchange (14 s on a simulated clock) still connects, any other call at 14 s is a 504, and an exchange past 20 s ends "failed"', async (L) => {
    const s = L(stubsFor(), ENV)
    assert.equal(s.RESEARCHER_TIMEOUT_MS, 8000); assert.equal(s.RESEARCHER_EXCHANGE_TIMEOUT_MS, 20000)
    const st = gdriveLib.signState('s3cret', 'cuid_session_user', 'n1'), cb = () => req(`https://app.test/api/connectors/gdrive/callback?code=C&state=${st}`, null, 'n1')
    // which limit each call carries: the exchange 20 s, the others 8 s (limits are recorded in call order)
    await s.handleCallback(cb()); await s.handlePickerToken(); await s.handleItemsGet(); await s.handleItemsPost(req('u', { file_ids: ['1AbCdEfGhIjK_-x'] })); await s.handleDisconnect()
    await s.handleSessionLinks(LINK(), 'POST'); await s.handleItemsDelete(req('u', { item_ids: ['abcdefghij12'] }))
    assert.deepEqual(calls.map(c => c.url.split('/connectors/')[1].split('?')[0]), ['gdrive/exchange', 'gdrive/picker-token', 'gdrive/items', 'gdrive/items', 'gdrive/disconnect', 'gdrive/session-links', 'gdrive/items'])
    assert.deepEqual(signals.requested, [20000, 8000, 8000, 8000, 8000, 8000, 8000])
    // behaviour, on a simulated clock (1 s = 20 ms): a reply after 14 "s" is inside the exchange's limit and outside everyone else's
    reset(); signals.speedup = 50
    const slow = (ms) => (_u, init) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({ access_token: 'short', expires_in: 1 }) }), ms / 50)
      init.signal.addEventListener('abort', () => { clearTimeout(timer); reject(init.signal.reason) })
    })
    const keepAlive = setInterval(() => {}, 20), realError = console.error
    try {
      const s2 = L(stubsFor(), ENV)
      reply = slow(14000)
      const ok = await s2.handleCallback(cb()); assert.match(ok.location, /gdrive=connected$/, 'the exchange finishing at 14 s is a success')
      const p = await s2.handlePickerToken(); assert.equal(p.status, 504, 'any other call at 14 s has timed out')
      reply = slow(25000); console.error = () => {}
      const late = await s2.handleCallback(cb()); assert.match(late.location, /gdrive=failed$/, 'the exchange has a limit: past 20 s it ends "failed", as before')
    } finally { console.error = realError; clearInterval(keepAlive) }
  }],
]
for (const [name, fn] of HARDENING) await t(`hardening: ${name}`, () => fn((stubs, env) => load(SERVER, stubs, env)))

// 7. mutants: each broken copy of the server (or the allow-list) must fail at least one hardening check above
{
  const SRV = 'lib/connectors-gdrive-server.ts', LIB = 'lib/connectors-gdrive.ts'
  const MUTANTS = {
    'owner check skipped': [SRV, '  const refused = await ownChatRefusal(g.userId, sessionId)\n  if (refused) return refused\n', ''],
    'another user\'s chat accepted (only "no row" refused)': [SRV, 'if (!chat || chat.userId !== ownerId) return refuse(404)', 'if (!chat) return refuse(404)'],
    'no row told apart from not yours (existence revealed)': [SRV, 'if (!chat || chat.userId !== ownerId) return refuse(404)', 'if (!chat) return refuse(409)\n  if (chat.userId !== ownerId) return refuse(404)'],
    'a deleted chat accepted': [SRV, "  if (chat.status === 'deleted') return refuse(410)\n", ''],
    'a failed lookup treated as owned': [SRV, "return fail(503, 'Could not check this chat right now. Please try again.')", 'return null'],
    'redirects followed': [SRV, "redirect: 'manual', ", "redirect: 'follow', "],
    'no timeout': [SRV, 'signal: AbortSignal.timeout(timeoutMs), ', ''],
    'the exchange on the 8 s limit': [SRV, 'undefined, undefined, RESEARCHER_EXCHANGE_TIMEOUT_MS)', 'undefined, undefined, RESEARCHER_TIMEOUT_MS)'],
    'every call on the 20 s limit': [SRV, 'timeoutMs = RESEARCHER_TIMEOUT_MS) {', 'timeoutMs = RESEARCHER_EXCHANGE_TIMEOUT_MS) {'],
    'the exchange limit is not 20 s': [SRV, 'export const RESEARCHER_EXCHANGE_TIMEOUT_MS = 20000', 'export const RESEARCHER_EXCHANGE_TIMEOUT_MS = 30000'],
    'the exchange has no limit of its own (the constant is the default one)': [SRV, 'export const RESEARCHER_EXCHANGE_TIMEOUT_MS = 20000', 'export const RESEARCHER_EXCHANGE_TIMEOUT_MS = 8000'],
    'start: the return chat is not checked': [SRV, 'const returnTo = requested ? await chatReturnIfOwn(g.userId, requested) : null', 'const returnTo = requested'],
    'start: someone else\'s chat is kept': [SRV, "return chat && (chat.userId !== ownerId || chat.status === 'deleted') ? null : returnTo", "return chat && chat.status === 'deleted' ? null : returnTo"],
    'start: a deleted chat is kept': [SRV, "return chat && (chat.userId !== ownerId || chat.status === 'deleted') ? null : returnTo", 'return chat && chat.userId !== ownerId ? null : returnTo'],
    'start: no row drops the chat': [SRV, "return chat && (chat.userId !== ownerId || chat.status === 'deleted') ? null : returnTo", "return !chat || chat.userId !== ownerId || chat.status === 'deleted' ? null : returnTo"],
    'start: a failed lookup keeps the chat': [SRV, '    return chat && (chat.userId !== ownerId || chat.status === \'deleted\') ? null : returnTo\n  } catch {\n    return null\n', '    return chat && (chat.userId !== ownerId || chat.status === \'deleted\') ? null : returnTo\n  } catch {\n    return returnTo\n'],
    'start: a failed lookup is an error page': [SRV, '    return chat && (chat.userId !== ownerId || chat.status === \'deleted\') ? null : returnTo\n  } catch {\n    return null\n', '    return chat && (chat.userId !== ownerId || chat.status === \'deleted\') ? null : returnTo\n  } catch {\n    throw new Error(\'lookup failed\')\n'],
    'start: looks the chat up even without a return': [SRV, 'const returnTo = requested ? await chatReturnIfOwn(g.userId, requested) : null', 'const returnTo = requested ? await chatReturnIfOwn(g.userId, requested) : (await chatReturnIfOwn(g.userId, \'/builder?session_id=chatsess00000001\'), null)'],
    'no size cap': [SRV, 'if (bytes > RESEARCHER_MAX_BODY_BYTES) {', 'if (false) {'],
    'an unknown 4xx keeps its status': [SRV, 'status: code && res.status >= 400 && res.status < 500 ? res.status : 502', 'status: res.status >= 500 ? 502 : res.status'],
    'no-store dropped from relayed answers': [SRV, 'return NextResponse.json(keep(data), { headers: NO_STORE })', 'return NextResponse.json(keep(data))'],
    'NOT_OWNED off the allow-list': [LIB, "'CONNECTOR_SESSION_NOT_OWNED', 'CONNECTOR_SESSION_UNAVAILABLE',", "'CONNECTOR_SESSION_UNAVAILABLE',"],
    'UNAVAILABLE off the allow-list': [LIB, "'CONNECTOR_SESSION_NOT_OWNED', 'CONNECTOR_SESSION_UNAVAILABLE',", "'CONNECTOR_SESSION_NOT_OWNED',"],
  }
  let killed = 0
  for (const [name, [rel, from, to]] of Object.entries(MUTANTS)) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8')
    assert.equal(src.split(from).length - 1, 1, `mutant "${name}" no longer applies`)
    const overrides = { [rel]: src.replace(from, () => to) }
    let caught = false
    for (const [, fn] of HARDENING) { reset(); try { await fn((stubs, env) => load(SERVER, stubs, env, overrides)) } catch { caught = true; break } }
    assert.ok(caught, `mutant not caught: ${name}`)
    killed++
  }
  reset()
  console.log(`ok - mutants: ${killed}/${Object.keys(MUTANTS).length} killed`)
}
console.log(`\n${passed} passed`)
