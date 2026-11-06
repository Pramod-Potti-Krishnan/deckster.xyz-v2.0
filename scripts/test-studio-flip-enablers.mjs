// program1/studio-flip-enablers: the Studio pieces that let the security flags go on.
//
//   node scripts/test-studio-flip-enablers.mjs     # offline: transpile + vm; next-auth, Prisma, fetch stubbed; secrets made up at run time
//
// Proves, on the REAL handlers / helpers:
//  1. Director library proxy: flag off 404 not_enabled before any read (plus a mutant without the gate); flag on: 401 signed-out, 404 not-owner / deleted, owner -> GET <director>/sessions/{id}/library, signed for the DB id (flag on), unsigned (flag off).
//  2. Researcher upload proxy: server flag off -> 404 + no fetch; unknown step 404; not-owner 404; key/secret unset 503; owner -> X-API-Key +
//     a session token an independent verifier accepts for (Researcher session, own e-mail); create's user_id overwritten; URL helper off = direct URL.
//  3. Layout viewer ticket: flag off 404; on -> X-Layout-Service-Token + X-Deckster-User-Id (DB id); withViewerTicket keeps other params; renew delay.
//  4. Downloads: flag off -> {} and no request; token route mints an HS256 JWT verifiable with the secret, sub = DB id; client attaches Bearer.
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
  throw new Error('typescript not found')
}
const ts = loadTs()
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')

const env = {}
const state = { session: null, users: new Map(), chats: new Map(), fetches: [], reply: { status: 200, body: '{}' } }
class NextResponse { constructor(body, init) { this.body = body; this.status = init?.status ?? 200 } static json(body, init) { return new NextResponse(body, init) } }
class Response { constructor(body, init) { this.body = body; this.status = init?.status ?? 200 } }
class ServiceUrlConfigError extends Error {}
const stubs = {
  'next/server': { NextResponse, NextRequest: class {} },
  'next-auth': { getServerSession: async () => state.session },
  '@/lib/auth-options': { authOptions: {} },
  '@/lib/prisma': { prisma: {
    user: { findUnique: async ({ where }) => { const k = where.id ? `id:${where.id}` : `email:${where.email}`; return state.users.has(k) ? { id: state.users.get(k) } : null } },
    chatSession: { findUnique: async ({ where }) => state.chats.get(where.id) ?? null },
  } },
  '@/lib/service-url': { requireServiceUrl: (_n, vals) => vals[0].value, ServiceUrlConfigError },
  '@/lib/config': { getKnowledgeServiceUrl: () => 'https://researcher.test' },
  '@/lib/publish/service-urls': { getLayoutServiceBaseUrl: () => 'https://layout.test' },
  'react': { useEffect() {}, useRef: v => ({ current: v }), useState: v => [v, () => {}] },
}
const cache = new Map()
function load(rel, source) {
  if (source === undefined && cache.has(rel)) return cache.get(rel)
  const module = { exports: {} }
  if (source === undefined) cache.set(rel, module.exports)
  const out = ts.transpileModule(source ?? read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const req = spec => {
    if (stubs[spec]) return stubs[spec]
    if (spec.startsWith('@/')) return load(spec.slice(2) + '.ts')
    if (spec === 'crypto' || spec.startsWith('node:')) return createRequire(import.meta.url)(spec)
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(out, {
    module, exports: module.exports, require: req, process: { env }, Buffer, URL, URLSearchParams, AbortSignal, console, Date, JSON, Math, Response, Number,
    fetch: async (url, init = {}) => { state.fetches.push({ url, init }); return { ok: state.reply.status < 400, status: state.reply.status, headers: { get: () => 'application/json' }, json: async () => JSON.parse(state.reply.body), text: async () => state.reply.body } },
  })
  if (source === undefined) cache.set(rel, module.exports)
  return module.exports
}
const ctx = obj => ({ params: Promise.resolve(obj) })
const reset = () => { state.fetches = []; state.reply = { status: 200, body: '{}' } }

const UID = 'cm-user-1', EMAIL = 'a@example.test', CHAT = 'chat-1'
state.users.set(`id:${UID}`, UID); state.users.set(`email:${EMAIL}`, UID)
state.chats.set(CHAT, { userId: UID, status: 'active' })
state.chats.set('chat-other', { userId: 'someone', status: 'active' })
state.chats.set('chat-gone', { userId: UID, status: 'deleted' })
env.DIRECTOR_API_URL = 'https://director.test'
env.DIRECTOR_WS_AUTH_SECRET = 'director-secret-made-up-at-test-time'

// ---- 1. library proxy
{
  const LIB = 'app/api/director/sessions/[sourceSessionId]/library/route.ts'
  const lib = load(LIB)
  // flag off: 404 not_enabled first, for a signed-out caller and an owner alike; no session, DB or Director read
  const offCase = async route => {
    const reads = { db: 0 }, find = stubs['@/lib/prisma'].prisma.chatSession.findUnique, auth = stubs['next-auth'].getServerSession
    stubs['@/lib/prisma'].prisma.chatSession.findUnique = async q => { reads.db++; return find(q) }
    stubs['next-auth'].getServerSession = async () => { reads.db++; return auth() }
    try {
      for (const session of [null, { user: { id: UID } }]) {
        state.session = session; reset()
        const res = await route.GET({}, ctx({ sourceSessionId: CHAT }))
        if (res.status !== 404 || res.body?.error !== 'not_enabled' || state.fetches.length !== 0 || reads.db !== 0) return false
      }
      return true
    } finally { stubs['@/lib/prisma'].prisma.chatSession.findUnique = find; stubs['next-auth'].getServerSession = auth }
  }
  assert.equal(await offCase(lib), true, 'flag off: 404 not_enabled, nothing read or sent')
  const gate = "  if (!isStudioDirectorRestSignAllEnabled()) return NextResponse.json({ error: 'not_enabled' }, { status: 404, headers: NO_STORE })\n"
  assert.ok(read(LIB).includes(gate), 'the gate line is in the route')
  for (const [name, text] of [['gate removed', read(LIB).replace(gate, '')], ['gate inverted', read(LIB).replace(gate, gate.replace('if (!is', 'if (is'))], ['gate after the auth read', read(LIB).replace(gate, '').replace("  if (!userId) return", gate + "  if (!userId) return")]]) {
    assert.notEqual(text, read(LIB), `mutant ${name} applies`)
    assert.equal(await offCase(load(LIB, text)), false, `mutant caught: ${name}`)
  }
  env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED = 'true'
  state.session = null; reset()
  assert.equal((await lib.GET({}, ctx({ sourceSessionId: CHAT }))).status, 401)
  state.session = { user: { email: EMAIL } }  // e-mail-only session resolves to the DB id
  for (const id of ['chat-other', 'chat-gone', 'nope']) { reset(); assert.equal((await lib.GET({}, ctx({ sourceSessionId: id }))).status, 404); assert.equal(state.fetches.length, 0) }
  reset(); assert.equal((await lib.GET({}, ctx({ sourceSessionId: '../x' }))).status, 400)
  reset(); let r = await lib.GET({}, ctx({ sourceSessionId: CHAT }))
  assert.equal(r.status, 200); assert.equal(state.fetches[0].url, 'https://director.test/sessions/chat-1/library')
  const h = state.fetches[0].init.headers['X-Deckster-Entitlement']; assert.ok(h)
  const [p, s] = h.split('.')
  assert.equal(s, crypto.createHmac('sha256', env.DIRECTOR_WS_AUTH_SECRET).update('deckster-rest-v1.' + p).digest('base64url'))
  const claims = JSON.parse(Buffer.from(p, 'base64url')); assert.equal(claims.sub, UID); assert.equal(claims.m, 'GET')
  delete env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED
}

// ---- 2. Researcher upload proxy
{
  const route = load('app/api/researcher/upload/[step]/route.ts')
  const helper = load('lib/researcher-upload-proxy.ts')
  const req = (q, body) => ({ nextUrl: new URL(`https://studio.test/x?${q}`), json: async () => body })
  state.session = { user: { id: UID, email: EMAIL } }
  reset(); assert.equal((await route.POST(req('session_id=chat-1&owner=email', { session_id: CHAT }), ctx({ step: 'create-session' }))).status, 404, 'server flag off')
  assert.equal(state.fetches.length, 0)
  env.STUDIO_RESEARCHER_PROXY_ENABLED = 'true'
  reset(); assert.equal((await route.POST(req('session_id=chat-1&owner=email', { session_id: CHAT }), ctx({ step: 'evil' }))).status, 404)
  reset(); assert.equal((await route.POST(req('session_id=chat-other&owner=email', { session_id: 'chat-other' }), ctx({ step: 'create-session' }))).status, 404)
  reset(); assert.equal((await route.POST(req('session_id=chat-1&owner=email', { session_id: CHAT }), ctx({ step: 'create-session' }))).status, 503, 'no key/secret')
  env.KNOWLEDGE_API_KEY = 'k-made-up'; env.RESEARCHER_SESSION_TOKEN_SECRET = 'r'.repeat(40)
  reset(); assert.equal((await route.POST(req('session_id=chat-1&owner=email', { session_id: 'other-sess' }), ctx({ step: 'create-session' }))).status, 400, 'create must name the chat session')
  reset(); let r = await route.POST(req('session_id=chat-1&owner=email', { session_id: CHAT, user_id: 'victim@example.test' }), ctx({ step: 'create-session' }))
  assert.equal(r.status, 200)
  const f = state.fetches[0]
  assert.equal(f.url, 'https://researcher.test/api/v1/sessions/create')
  assert.equal(f.init.headers['X-API-Key'], 'k-made-up')
  assert.equal(JSON.parse(f.init.body).user_id, EMAIL, 'user_id overwritten with own identity')
  const [v, sidB, uidB, exp, mac] = f.init.headers['X-Deckster-Session-Token'].split('.')
  assert.equal(v, 'v1'); assert.equal(Buffer.from(sidB, 'base64url').toString(), CHAT); assert.equal(Buffer.from(uidB, 'base64url').toString(), EMAIL)
  assert.equal(mac, crypto.createHmac('sha256', env.RESEARCHER_SESSION_TOKEN_SECRET).update(`${CHAT}|${EMAIL}|${exp}`).digest('base64url'))
  reset(); r = await route.POST(req('session_id=chat-1&owner=id', { session_id: 'rs-9', filename: 'a.pdf' }), ctx({ step: 'storage-upload-url' }))
  assert.equal(state.fetches[0].url, 'https://researcher.test/api/v1/files/storage-upload-url')
  assert.equal(Buffer.from(state.fetches[0].init.headers['X-Deckster-Session-Token'].split('.')[2], 'base64url').toString(), UID)
  assert.equal(JSON.parse(state.fetches[0].init.body).filename, 'a.pdf')
  // URL helper
  assert.equal(helper.researcherUploadUrl('https://r', 'files/process-uploaded', { sessionId: CHAT, userId: EMAIL }), 'https://r/api/v1/files/process-uploaded')
  env.NEXT_PUBLIC_STUDIO_RESEARCHER_PROXY_ENABLED = 'true'
  assert.equal(helper.researcherUploadUrl('https://r', 'files/process-uploaded', { sessionId: CHAT, userId: EMAIL }), '/api/researcher/upload/process-uploaded?session_id=chat-1&owner=email')
  assert.equal(helper.researcherUploadUrl('https://r', 'sessions/create', { sessionId: CHAT, userId: UID }), '/api/researcher/upload/create-session?session_id=chat-1&owner=id')
  delete env.NEXT_PUBLIC_STUDIO_RESEARCHER_PROXY_ENABLED
  // statics: the browser never sees the key or the secret
  for (const rel of ['hooks/use-file-upload.ts', 'lib/researcher-upload.ts', 'lib/researcher-upload-proxy.ts']) {
    assert.ok(!/KNOWLEDGE_API_KEY|RESEARCHER_SESSION_TOKEN_SECRET/.test(read(rel).replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), rel)
  }
  assert.equal((read('hooks/use-file-upload.ts').match(/researcherUploadUrl\(/g) || []).length, 4)
  assert.equal((read('lib/researcher-upload.ts').match(/researcherUploadUrl\(/g) || []).length, 3)
}

// ---- 3. Layout viewer ticket
{
  const route = load('app/api/presentations/[id]/viewer-ticket/route.ts')
  const t = load('lib/studio-layout-viewer-ticket.ts')
  state.session = { user: { email: EMAIL } }
  reset(); assert.equal((await route.POST({}, ctx({ id: 'deck-1' }))).status, 404)
  env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED = 'true'
  reset(); assert.equal((await route.POST({}, ctx({ id: 'deck-1' }))).status, 503, 'no service token')
  env.LAYOUT_SERVICE_TOKEN = 'lst-made-up'
  reset(); state.reply = { status: 200, body: JSON.stringify({ ticket: 'tk', expires_in: 600, url: '/p/deck-1?t=tk' }) }
  const r = await route.POST({}, ctx({ id: 'deck-1' }))
  assert.equal(r.status, 200)
  assert.equal(state.fetches[0].url, 'https://layout.test/api/presentations/deck-1/viewer-ticket')
  assert.deepEqual({ ...state.fetches[0].init.headers }, { 'X-Layout-Service-Token': 'lst-made-up', 'X-Deckster-User-Id': UID })
  state.session = null; reset(); assert.equal((await route.POST({}, ctx({ id: 'deck-1' }))).status, 401)
  assert.equal(t.withViewerTicket('https://layout.test/p/deck-1?rev=3', 'tk'), 'https://layout.test/p/deck-1?rev=3&t=tk')
  assert.equal(t.renewDelayMs(600), 450000); assert.equal(t.renewDelayMs(10), 15000)
  const posted = []
  assert.equal(t.postViewerTicket({ contentWindow: { postMessage: (m, o) => posted.push([m, o]) } }, 'tk2', 'https://layout.test/p/deck-1?t=tk'), true)
  assert.deepEqual(JSON.parse(JSON.stringify(posted)), [[{ type: 'deckster:viewer-ticket', ticket: 'tk2' }, 'https://layout.test']])
  delete env.NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED
  assert.match(read("components/presentation-viewer.tsx"), /LAYOUT-TICKET \*\/ ticketedIframeSrc !== approvedIframeNavigationUrl/)
}

// ---- 4. Downloads
{
  const client = load('lib/downloads-auth-client.ts')
  const route = load('app/api/downloads/access-token/route.ts')
  let calls = 0
  const fakeFetch = async () => { calls++; return { ok: true, json: async () => ({ access_token: 'jwt', expires_at: Math.floor(Date.now() / 1000) + 600 }) } }
  assert.deepEqual({ ...(await client.downloadAuthHeaders(fakeFetch)) }, {}); assert.equal(calls, 0, 'flag off: no request')
  state.session = { user: { id: UID } }
  assert.equal((await route.GET()).status, 404)
  env.NEXT_PUBLIC_STUDIO_DOWNLOADS_AUTH_ENABLED = 'true'
  assert.equal((await route.GET()).status, 503, 'no secret')
  env.SUPABASE_JWT_SECRET = 'supabase-jwt-secret-made-up'
  const res = await route.GET(); assert.equal(res.status, 200)
  const [hh, pp, ss] = res.body.access_token.split('.')
  assert.equal(ss, crypto.createHmac('sha256', env.SUPABASE_JWT_SECRET).update(`${hh}.${pp}`).digest('base64url'))
  assert.equal(JSON.parse(Buffer.from(hh, 'base64url')).alg, 'HS256')
  const c = JSON.parse(Buffer.from(pp, 'base64url')); assert.equal(c.sub, UID); assert.equal(c.role, 'authenticated'); assert.ok(c.exp - c.iat === 600)
  assert.deepEqual(JSON.parse(JSON.stringify(await client.downloadAuthHeaders(fakeFetch))), { Authorization: 'Bearer jwt' })
  await client.downloadAuthHeaders(fakeFetch); assert.equal(calls, 1, 'cached until near expiry')
  assert.equal((read('lib/api/download-service.ts').match(/\.\.\.\(await downloadAuthHeaders\(\)\)/g) || []).length, 2)
  assert.ok(!read('lib/downloads-auth-client.ts').includes("from 'crypto'"))
}
console.log('ok - studio flip enablers: library proxy, Researcher upload proxy, Layout viewer ticket, Downloads bearer')
