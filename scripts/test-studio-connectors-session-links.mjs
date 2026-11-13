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
const signals = { requested: [], fastMs: null }
const TestAbortSignal = { timeout: ms => { signals.requested.push(ms); return AbortSignal.timeout(signals.fastMs ?? ms) } }
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
const reset = () => { calls = []; signals.requested = []; signals.fastMs = null; prismaLoads = 0; prismaCalls = []; chatRow = { userId: 'cuid_session_user', status: 'active' }; prismaError = null; reply = () => ({ ok: true, status: 200, json: async () => ({}) }) }
const t = async (name, fn) => { reset(); await fn(); passed++; console.log('ok -', name) }


const ENV = { ...ENV_ON, NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED: 'true' }
const CHAT = 'chatsess00000001'
const links = load('lib/connectors-gdrive-session-links.ts', {}, {})

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
await t('hook: strip(this change) === base hook', async () => {
  const { stripConnectorsSessionLinks } = await import('./studio-connectors-session-links-strip.mjs')
  const rel = 'hooks/use-deckster-websocket-v2.ts'
  // the base is PINNED (#566's head refreshed onto studio-v4-dev-preparation-code 2f06e51e), not a branch name: a gate clone fetches only dev
  // and the head branch, so a remote-tracking ref can be stale or missing there (RUNNER-MINI-B S6, 13 Nov); this commit is an ancestor of the head
  const base = execFileSync('git', ['show', `${process.env.SESSION_LINKS_BASE || '59f94e2d7ae685ebfcc3a9a43e71ba5432b488fb'}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
  assert.equal(stripConnectorsSessionLinks(rel, fs.readFileSync(path.join(root, rel), 'utf8')), base)
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
    'no timeout': [SRV, 'signal: AbortSignal.timeout(RESEARCHER_TIMEOUT_MS), ', ''],
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
