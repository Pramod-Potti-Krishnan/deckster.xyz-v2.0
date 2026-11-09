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
    vm.runInNewContext(js, { require: req, module: mod, exports: mod.exports, process: { env }, console, URL, URLSearchParams, Buffer, JSON, Date, Promise, fetch: (...a) => globalThis.fetch(...a) }, { filename: abs })
    return mod.exports
  }
  return run(path.join(root, file))
}

// ---- fakes ----
class FakeRes {
  constructor(body, status = 200, location) { this.body = body; this.status = status; this.location = location; this.cookies = { jar: {}, set: (n, v, o) => { this.cookies.jar[n] = { v, o } } } }
}
const plain = v => JSON.parse(JSON.stringify(v))
const NextResponse = { json: (b, i = {}) => new FakeRes(b, i.status ?? 200), redirect: (u) => new FakeRes(null, 307, String(u)) }
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
const fakeFetch = async (url, init) => { calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : undefined }); return reply(url, init) }
globalThis.fetch = fakeFetch
const SERVER = 'lib/connectors-gdrive-server.ts'
const req = (url, body, cookie) => ({ url, json: async () => body, cookies: { get: (n) => (cookie && n === 'deckster_gdrive_oauth_nonce' ? { value: cookie } : undefined) } })
let passed = 0
const t = async (name, fn) => { calls = []; reply = () => ({ ok: true, status: 200, json: async () => ({}) }); await fn(); passed++; console.log('ok -', name) }


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
  const base = execFileSync('git', ['show', `${process.env.SESSION_LINKS_BASE || 'origin/knowledge/connectors-gdrive-stub'}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
  assert.equal(stripConnectorsSessionLinks(rel, fs.readFileSync(path.join(root, rel), 'utf8')), base)
  assert.equal(stripConnectorsSessionLinks('other.ts', 'x'), 'x')
})

console.log(`\n${passed} passed`)
