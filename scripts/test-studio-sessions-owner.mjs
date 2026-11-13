#!/usr/bin/env node
// Proof (offline, $0): POST /api/sessions no longer hands another user's chat to a caller (P-73), no longer logs a secret or the
// caller's e-mail, and no longer echoes a raw error to the browser (P-74). NO flag: a data leak is closed for everyone (the
// precedent is the tier guard, PR #575, and the D1 debug routes: "by design, no flag").
// The REAL app/api/sessions/route.ts and hooks/use-chat-sessions.ts are transpiled and run on stubs: an in-memory prisma, a fixed
// signed-in session, a minimal NextResponse, and a fetch that calls the real route. No network, no database, no browser.
// Then mutants (each must make the proof FAIL): owner check removed, owner check inverted, allow-list widened, each log restored,
// raw error text restored, and the client trusting a 409 row again.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { LATER_CHANGE_FILES, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'
import * as strip from './studio-sessions-owner-strip.mjs'

const ROOT = new URL('../', import.meta.url)
const read = rel => fs.readFileSync(new URL(rel, ROOT), 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))
const compile = (code, fileName) => ts.transpileModule(code, { fileName, reportDiagnostics: false, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText

function evaluate(code, fileName, deps, globals = {}) {
  const module = { exports: {} }
  const require = id => { if (!Object.hasOwn(deps, id)) throw new Error(`unexpected import "${id}" in ${fileName}`); return deps[id] }
  vm.runInNewContext(compile(code, fileName), { module, exports: module.exports, require, process: { env: {} }, ...globals })
  return module.exports
}

const core = evaluate(read('lib/api-hardening-core.ts'), 'lib/api-hardening-core.ts', {})

// ---- the world: two accounts, one chat each, every column the real row has ---------------------------------------------------
const CALLER = { id: 'user-caller', email: 'caller@mail.example' }
const VICTIM = { id: 'user-victim', email: 'victim@mail.example' }
const OWN_ID = '11111111-1111-4111-8111-111111111111'
const FOREIGN_ID = '22222222-2222-4222-8222-222222222222'
const FRESH_ID = '33333333-3333-4333-8333-333333333333'
const DB_SECRET = 'fake-pass-for-proof'
const SECRET_URL = ['postgresql://postgres.fakeproject', `${DB_SECRET}@db.example.invalid`, '6543/postgres'].join(':') // made up: the proof's stand-in for DATABASE_URL (assembled so no scanner reads a credential in the source)
const fullRow = (id, owner, extra = {}) => ({
  id, userId: owner.id, title: `chat of ${owner.id}`, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-02T00:00:00.000Z', lastMessageAt: null,
  currentStage: 3, slideCount: 7, status: 'active', isFavorite: true,
  blankPresentationUrl: `https://layout.example/p/blank-${owner.id}`, strawmanPreviewUrl: `https://layout.example/p/straw-${owner.id}`, finalPresentationUrl: `https://layout.example/p/final-${owner.id}`,
  blankPresentationId: `blank-${owner.id}`, strawmanPresentationId: `straw-${owner.id}`, finalPresentationId: `final-${owner.id}`,
  geminiStoreName: `fileSearchStores/store-${owner.id}`, geminiStoreId: `store-id-${owner.id}`, ...extra,
})
const LEAK_MARKERS = [VICTIM.id, 'layout.example', 'fileSearchStores', 'store-id-', 'chat of', 'blank-', 'straw-', 'final-']

function makeWorld() {
  const rows = new Map([[OWN_ID, fullRow(OWN_ID, CALLER, { geminiStoreName: 'fileSearchStores/own-store' })], [FOREIGN_ID, fullRow(FOREIGN_ID, VICTIM)]])
  const users = new Map([[CALLER.email, { ...CALLER }], [VICTIM.email, { ...VICTIM }]])
  const world = {
    rows, users, session: { user: { email: CALLER.email, name: 'Caller' } }, userLookupError: null, userCreateError: null, created: [], userCreated: [],
    prisma: {
      user: {
        findUnique: async ({ where }) => { if (world.userLookupError) throw world.userLookupError; return users.get(where.email) ?? null },
        create: async ({ data }) => { if (world.userCreateError) throw world.userCreateError; const user = { id: `user-new-${users.size}`, ...data }; users.set(data.email, user); world.userCreated.push(user); return user },
      },
      chatSession: {
        findUnique: async ({ where }) => rows.get(where.id) ?? null,
        create: async ({ data }) => { world.created.push(plain(data)); const row = fullRow(data.id, { id: data.userId }, { title: data.title, geminiStoreName: null, geminiStoreId: null }); rows.set(data.id, row); return row },
      },
    },
  }
  return world
}

const NextResponse = { json: (body, init = {}) => ({ status: init.status ?? 200, body }) }

function loadRoute(source, world) {
  const logs = []
  const text = value => (typeof value === 'string' ? value : (() => { try { return JSON.stringify(value) } catch { return String(value) } })())
  const sink = (...args) => { logs.push(args.map(text).join(' ')) }
  const exports = evaluate(source, 'app/api/sessions/route.ts', {
    'next/server': { NextResponse },
    'next-auth': { getServerSession: async () => world.session },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma: world.prisma },
    '@/lib/api-hardening-core': core,
  }, { console: { log: sink, warn: sink, error: sink, info: sink, debug: sink }, process: { env: { NODE_ENV: 'production', DATABASE_URL: SECRET_URL, DIRECT_URL: SECRET_URL } } })
  const post = async body => {
    const res = await exports.POST({ json: async () => { if (body instanceof Error) throw body; return body }, url: 'http://localhost/api/sessions' })
    return { status: res.status, body: plain(res.body) }
  }
  return { post, logs }
}

// A Response look-alike that can be read once, like the real one.
function responseOf(status, body) {
  const raw = body === undefined ? '' : JSON.stringify(body)
  let used = false
  const take = () => { if (used) return Promise.reject(new TypeError('Body is unusable: Body has already been read')); used = true; return Promise.resolve(raw) }
  return { ok: status >= 200 && status < 300, status, statusText: String(status), json: () => take().then(value => JSON.parse(value)), text: () => take() }
}

function loadHook(source, world, routeSource) {
  const sent = []
  const seen = []
  const quiet = () => {}
  const { post } = loadRoute(routeSource, world)
  const reply = (status, body) => { seen.push({ status, body: JSON.stringify(body ?? null) }); return responseOf(status, body) }
  const fetchStub = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    sent.push({ url, method })
    if (url === '/api/sessions' && method === 'POST') { const res = await post(JSON.parse(init.body)); return reply(res.status, res.body) }
    const match = /^\/api\/sessions\/([^/]+)(\/messages)?$/.exec(url)
    if (match && (method === 'PATCH' || (match[2] && method === 'POST'))) { // the [id] routes: 404 no row, 403 another owner, 200 yours
      const row = world.rows.get(match[1])
      if (!row) return reply(404, { error: 'Session not found' })
      if (row.userId !== CALLER.id) return reply(403, { error: 'Forbidden' })
      return reply(200, match[2] ? { saved: 1, failed: 0, total: 1 } : { session: { id: row.id } })
    }
    throw new Error(`unexpected fetch ${method} ${url}`)
  }
  const exports = evaluate(source, 'hooks/use-chat-sessions.ts', {
    react: { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useCallback: fn => fn },
    '@/lib/studio-session-hygiene': { sessionLoadKindForStatus: () => 'error' },
    '@/lib/studio-blank-start-new-session': { STUDIO_BLANK_START_NEW_SESSION_ENABLED: false, browserBlankStartStorage: () => null, forgetBlankStartEverywhere: () => {} },
  }, { fetch: fetchStub, setTimeout: fn => { fn(); return 0 }, console: { log: quiet, warn: quiet, error: quiet, info: quiet, debug: quiet } })
  return { hook: exports.useChatSessions(), sent, seen }
}

// ---- the cases: each returns on success and throws on a failure -------------------------------------------------------------
const noLeak = (value, label) => {
  const text = JSON.stringify(value)
  for (const marker of LEAK_MARKERS) assert.equal(text.includes(marker), false, `${label}: "${marker}" reached the caller`)
  for (const key of ['userId', 'blankPresentationUrl', 'strawmanPreviewUrl', 'finalPresentationUrl', 'geminiStoreId']) assert.equal(text.includes(`"${key}"`), false, `${label}: ${key} reached the caller`)
}
const noSecretInLogs = (logs, label, extra = []) => {
  const all = logs.join('\n')
  for (const bad of [CALLER.email, 'caller@', VICTIM.email, SECRET_URL, SECRET_URL.slice(0, 40), 'postgresql://', DB_SECRET, 'db.example.invalid', ...extra]) assert.equal(all.includes(bad), false, `${label}: the server log carries "${bad}"`)
}
const ALLOWED = ['geminiStoreName', 'id']

const cases = [
  ['P-73: an id that is another user\'s chat is answered 404 with no row and nothing is written', async ({ routeSource }) => {
    const world = makeWorld(); const { post } = loadRoute(routeSource, world)
    const res = await post({ sessionId: FOREIGN_ID, title: 'mine now' })
    assert.equal(res.status, 404)
    assert.deepEqual(res.body, { error: 'Session not found' })
    noLeak(res, 'foreign id')
    assert.equal(world.created.length, 0, 'no row was created')
    assert.equal(world.rows.get(FOREIGN_ID).userId, VICTIM.id, 'the row is still the victim\'s')
    assert.equal(world.rows.get(FOREIGN_ID).title, `chat of ${VICTIM.id}`, 'and untouched')
  }],
  ['P-73: the foreign answer is the same for any other account and any title', async ({ routeSource }) => {
    for (const body of [{ sessionId: FOREIGN_ID }, { sessionId: FOREIGN_ID, title: null }, { sessionId: FOREIGN_ID, title: 'x'.repeat(500), extra: { userId: CALLER.id } }]) {
      const world = makeWorld(); const { post } = loadRoute(routeSource, world)
      const res = await post(body)
      assert.deepEqual(res, { status: 404, body: { error: 'Session not found' } })
    }
    const world = makeWorld(); world.rows.set(FOREIGN_ID, fullRow(FOREIGN_ID, VICTIM, { status: 'deleted' })) // another user's deleted chat is theirs too
    assert.deepEqual(await loadRoute(routeSource, world).post({ sessionId: FOREIGN_ID }), { status: 404, body: { error: 'Session not found' } })
  }],
  ['P-73: the caller\'s own id keeps today\'s answer (409, error text, the row) with the allow-listed keys only', async ({ routeSource }) => {
    const world = makeWorld(); const { post } = loadRoute(routeSource, world)
    const res = await post({ sessionId: OWN_ID })
    assert.equal(res.status, 409)
    assert.equal(res.body.error, 'Session already exists')
    assert.deepEqual(Object.keys(res.body).sort(), ['error', 'session'])
    assert.deepEqual(Object.keys(res.body.session).sort(), ALLOWED)
    assert.equal(res.body.session.id, OWN_ID)
    assert.equal(res.body.session.geminiStoreName, 'fileSearchStores/own-store', 'the one other field the Builder reads when it adopts an id')
    const text = JSON.stringify(res.body)
    for (const key of ['userId', 'blankPresentationUrl', 'strawmanPreviewUrl', 'finalPresentationUrl', 'blankPresentationId', 'strawmanPresentationId', 'finalPresentationId', 'geminiStoreId', 'title', 'status', 'currentStage', 'slideCount', 'isFavorite']) assert.equal(text.includes(`"${key}"`), false, `${key} is not on the list`)
    assert.equal(world.created.length, 0)
  }],
  ['P-73: a new id still creates the caller\'s own row (201), answered with the same allow-listed keys', async ({ routeSource }) => {
    const world = makeWorld(); const { post } = loadRoute(routeSource, world)
    const res = await post({ sessionId: FRESH_ID, title: 'New topic: sales' })
    assert.equal(res.status, 201)
    assert.deepEqual(Object.keys(res.body), ['session'])
    assert.deepEqual(Object.keys(res.body.session).sort(), ALLOWED)
    assert.equal(res.body.session.id, FRESH_ID)
    assert.equal(world.created.length, 1)
    assert.deepEqual(world.created[0], { id: FRESH_ID, userId: CALLER.id, title: 'New topic: sales', currentStage: 1, status: 'active' }, 'the row is written exactly as before, owned by the caller')
    assert.equal(world.rows.get(FRESH_ID).userId, CALLER.id)
  }],
  ['unchanged: signed out is 401, no id is 400, a first-time account is created then the session is', async ({ routeSource }) => {
    let world = makeWorld(); world.session = null
    assert.deepEqual(await loadRoute(routeSource, world).post({ sessionId: FRESH_ID }), { status: 401, body: { error: 'Unauthorized' } })
    world = makeWorld(); world.session = { user: {} }
    assert.equal((await loadRoute(routeSource, world).post({ sessionId: FRESH_ID })).status, 401)
    world = makeWorld()
    assert.deepEqual(await loadRoute(routeSource, world).post({}), { status: 400, body: { error: 'sessionId is required' } })
    world = makeWorld(); world.session = { user: { email: 'newcomer@mail.example', name: 'N' } }
    const res = await loadRoute(routeSource, world).post({ sessionId: FRESH_ID })
    assert.equal(res.status, 201); assert.equal(world.userCreated.length, 1); assert.equal(world.created[0].userId, world.userCreated[0].id)
  }],
  ['P-74: no path logs the DATABASE_URL, a part of it, or an e-mail address', async ({ routeSource }) => {
    for (const [label, setup, body] of [
      ['fresh id', () => makeWorld(), { sessionId: FRESH_ID, title: 'a' }],
      ['own id', () => makeWorld(), { sessionId: OWN_ID }],
      ['foreign id', () => makeWorld(), { sessionId: FOREIGN_ID }],
      ['new account', () => { const w = makeWorld(); w.session = { user: { email: 'newcomer@mail.example' } }; return w }, { sessionId: FRESH_ID }],
      ['no sessionId', () => makeWorld(), {}],
      ['signed out', () => { const w = makeWorld(); w.session = null; return w }, { sessionId: FRESH_ID }],
    ]) {
      const world = setup(); const { post, logs } = loadRoute(routeSource, world)
      await post(body)
      assert.ok(logs.length > 0, `${label}: the route still logs its steps`)
      noSecretInLogs(logs, label, ['newcomer@mail.example', 'newcomer@'])
    }
  }],
  ['P-74: a failure answers a bare 500 and logs the error kind and code, not its text, in every catch', async ({ routeSource }) => {
    const rawMessage = `Invalid \`prisma.user.findUnique()\` invocation: where: { email: "${CALLER.email}" } Can't reach database server at ${SECRET_URL}`
    class PrismaClientKnownRequestError extends Error { constructor(message) { super(message); this.name = 'PrismaClientKnownRequestError' } }
    const makeError = () => Object.assign(new PrismaClientKnownRequestError(rawMessage), { code: 'P1001', clientVersion: '5.22.0', meta: { target: ['email'], note: DB_SECRET } })
    const check = async (label, world, body, expectBody, kindLogged = true) => {
      const { post, logs } = loadRoute(routeSource, world)
      const res = await post(body)
      assert.equal(res.status, 500, label)
      assert.deepEqual(res.body, expectBody, `${label}: the body says nothing about the error`)
      const all = logs.join('\n')
      for (const bad of [rawMessage, "Can't reach database", 'Invalid `prisma', 'invocation', DB_SECRET, 'fake-pass', CALLER.email, SECRET_URL.slice(0, 40)]) assert.equal(all.includes(bad), false, `${label}: the log carries "${bad}"`)
      assert.ok(all.includes('P1001'), `${label}: the code is still logged`)
      if (kindLogged) assert.ok(all.includes('PrismaClientKnownRequestError'), `${label}: and the kind`)
    }
    let world = makeWorld(); world.userLookupError = makeError()
    await check('user lookup fails', world, { sessionId: FRESH_ID }, { error: 'Internal server error' })
    world = makeWorld(); world.session = { user: { email: 'newcomer@mail.example' } }; world.userCreateError = makeError()
    await check('user create fails', world, { sessionId: FRESH_ID }, { error: 'Failed to create user account' }, false) // that catch has only ever logged the code
    world = makeWorld(); world.prisma.chatSession.create = async () => { throw makeError() }
    await check('session create fails', world, { sessionId: FRESH_ID }, { error: 'Internal server error' })
    world = makeWorld(); world.prisma.chatSession.findUnique = async () => { throw makeError() }
    await check('session lookup fails', world, { sessionId: FRESH_ID }, { error: 'Internal server error' })
    world = makeWorld() // a request body that is not JSON: the parser's text ("Unexpected token ...") stays out of the answer
    const { post } = loadRoute(routeSource, world)
    const res = await post(new SyntaxError('Unexpected token < in JSON at position 0'))
    assert.deepEqual(res, { status: 500, body: { error: 'Internal server error' } })
  }],
  ['source pins: the 409 and the 201 both go through the allow-list; no answer carries "details"; the list is the two fields the clients read', async ({ routeSource }) => {
    assert.match(routeSource, /const SESSION_CREATE_RESPONSE_KEYS = \['id', 'geminiStoreName'\] as const;/)
    assert.equal(routeSource.split('pickAllowedKeys(existing, SESSION_CREATE_RESPONSE_KEYS)').length, 2)
    assert.equal(routeSource.split('pickAllowedKeys(newSession, SESSION_CREATE_RESPONSE_KEYS)').length, 2)
    assert.equal(/details\s*:/.test(routeSource), false, 'no "details:" in any answer')
    assert.equal(/session:\s*(existing|newSession)\b/.test(routeSource), false, 'no whole row is answered')
    assert.match(routeSource, /existing\.userId !== user\.id/)
  }],
  ['P-73 client: a foreign id is never adopted: createSession answers null, and nothing of the victim\'s row reaches the browser', async ({ routeSource, hookSource }) => {
    const world = makeWorld(); const { hook, sent, seen } = loadHook(hookSource, world, routeSource)
    assert.equal(await hook.createSession(FOREIGN_ID, 'x'), null)
    assert.deepEqual(sent, [{ url: '/api/sessions', method: 'POST' }])
    noLeak(seen, 'what the browser received')
    assert.equal(seen[0].status, 404)
  }],
  ['P-73 client: the caller\'s own id is still adopted (409 row with its id and store name), and a new id is created (201)', async ({ routeSource, hookSource }) => {
    const world = makeWorld(); const { hook } = loadHook(hookSource, world, routeSource)
    const own = await hook.createSession(OWN_ID)
    assert.deepEqual(plain(own), { id: OWN_ID, geminiStoreName: 'fileSearchStores/own-store' })
    const fresh = await hook.createSession(FRESH_ID, 'T')
    assert.equal(fresh.id, FRESH_ID)
    assert.equal(world.rows.get(FRESH_ID).userId, CALLER.id)
  }],
  ['P-73 client: the "recover a missing row" paths (PATCH retry, message save) do not call a foreign id recovered, and do not retry on it', async ({ routeSource, hookSource }) => {
    let world = makeWorld(); let { hook, sent } = loadHook(hookSource, world, routeSource)
    // a foreign id: PATCH says 403 at once (the [id] route checks the owner), nothing is recovered, nothing is created
    assert.equal(await hook.updateSession(FOREIGN_ID, { title: 't' }), null)
    assert.equal(sent.filter(call => call.method === 'POST').length, 0)
    assert.equal(world.created.length, 0)
    // an id with no row at all: 404 x4, then ONE create, then the PATCH is retried (today's behaviour, unchanged)
    world = makeWorld(); ({ hook, sent } = loadHook(hookSource, world, routeSource))
    const updated = await hook.updateSession(FRESH_ID, { title: 't' })
    assert.equal(updated.id, FRESH_ID)
    assert.equal(sent.filter(call => call.method === 'POST').length, 1)
    assert.equal(world.rows.get(FRESH_ID).userId, CALLER.id)
    // the message save: foreign -> 403, not recovered; missing -> recovered and retried once
    world = makeWorld(); ({ hook, sent } = loadHook(hookSource, world, routeSource))
    assert.equal(await hook.saveMessages(FOREIGN_ID, [{ id: 'm', messageType: 't', timestamp: 'now', payload: {} }]), null)
    assert.equal(world.created.length, 0)
    world = makeWorld(); ({ hook, sent } = loadHook(hookSource, world, routeSource))
    assert.deepEqual(plain(await hook.saveMessages(FRESH_ID, [{ id: 'm', messageType: 't', timestamp: 'now', payload: {} }])), { saved: 1, failed: 0, total: 1 })
    assert.deepEqual(sent.map(call => `${call.method} ${call.url}`), [`POST /api/sessions/${FRESH_ID}/messages`, 'POST /api/sessions', `POST /api/sessions/${FRESH_ID}/messages`])
  }],
]

// A server that answers 409 with something that is not the caller's row for that id (an older build, a proxy, a bug): the client still does not adopt it.
const clientAgainstOddServer = [
  ['409 with another id\'s row', 409, { error: 'Session already exists', session: { id: 'someone-elses', geminiStoreName: 'fileSearchStores/x' } }],
  ['409 with no row', 409, { error: 'Session already exists' }],
  ['409 with no body', 409, undefined],
  ['409 with a null row', 409, { session: null }],
]
for (const [label, status, body] of clientAgainstOddServer) {
  cases.push([`P-73 client: ${label} is not an adoption (createSession answers null; the recovery path answers "not recovered")`, async ({ hookSource }) => {
    const calls = []
    const quiet = () => {}
    const fetchStub = async (url, init = {}) => {
      calls.push(`${init.method ?? 'GET'} ${url}`)
      if (url === '/api/sessions' && init.method === 'POST') return responseOf(status, body)
      return responseOf(404, { error: 'Session not found' })
    }
    const exports = evaluate(hookSource, 'hooks/use-chat-sessions.ts', {
      react: { useState: initial => [initial, () => {}], useCallback: fn => fn },
      '@/lib/studio-session-hygiene': { sessionLoadKindForStatus: () => 'error' },
      '@/lib/studio-blank-start-new-session': { STUDIO_BLANK_START_NEW_SESSION_ENABLED: false, browserBlankStartStorage: () => null, forgetBlankStartEverywhere: () => {} },
    }, { fetch: fetchStub, setTimeout: fn => { fn(); return 0 }, console: { log: quiet, warn: quiet, error: quiet, info: quiet, debug: quiet } })
    const hook = exports.useChatSessions()
    assert.equal(await hook.createSession(OWN_ID), null, 'createSession')
    // updateSession -> PATCH 404 x4 -> ensureSessionRow -> this 409 -> must NOT be "recovered": no fifth PATCH
    assert.equal(await hook.updateSession(OWN_ID, { title: 't' }), null)
    assert.equal(calls.filter(call => call.startsWith('PATCH')).length, 4, 'the PATCH is not retried after a 409 that is not the row asked for')
    // the message save: 404 -> ensureSessionRow -> same 409 -> not recovered -> no second message POST
    calls.length = 0
    assert.equal(await hook.saveMessages(OWN_ID, [{ id: 'm', messageType: 't', timestamp: 'now', payload: {} }]), null)
    assert.equal(calls.filter(call => call.endsWith('/messages')).length, 1, 'the message save is not retried')
  }])
}
cases.push(['P-73 client: the same 409 with the row of the id asked for IS recovered (own row: today\'s behaviour)', async ({ hookSource }) => {
  const calls = []
  const quiet = () => {}
  let patches = 0
  const fetchStub = async (url, init = {}) => {
    calls.push(`${init.method ?? 'GET'} ${url}`)
    if (url === '/api/sessions' && init.method === 'POST') return responseOf(409, { error: 'Session already exists', session: { id: OWN_ID, geminiStoreName: null } })
    if (init.method === 'PATCH') { patches++; return patches <= 4 ? responseOf(404, { error: 'Session not found' }) : responseOf(200, { session: { id: OWN_ID } }) }
    throw new Error(`unexpected ${url}`)
  }
  const exports = evaluate(hookSource, 'hooks/use-chat-sessions.ts', {
    react: { useState: initial => [initial, () => {}], useCallback: fn => fn },
    '@/lib/studio-session-hygiene': { sessionLoadKindForStatus: () => 'error' },
    '@/lib/studio-blank-start-new-session': { STUDIO_BLANK_START_NEW_SESSION_ENABLED: false, browserBlankStartStorage: () => null, forgetBlankStartEverywhere: () => {} },
  }, { fetch: fetchStub, setTimeout: fn => { fn(); return 0 }, console: { log: quiet, warn: quiet, error: quiet, info: quiet, debug: quiet } })
  const hook = exports.useChatSessions()
  assert.equal((await hook.createSession(OWN_ID)).id, OWN_ID)
  assert.equal((await hook.updateSession(OWN_ID, { title: 't' })).id, OWN_ID)
  assert.equal(patches, 5)
}])

async function runSuite(sources) {
  const failures = []
  for (const [name, fn] of cases) {
    try { await fn(sources) } catch (error) { failures.push(`${name}: ${String(error?.message ?? error).split('\n')[0]}`) }
  }
  return failures
}

// ---- real sources ---------------------------------------------------------------------------------------------------------------
const real = { routeSource: read('app/api/sessions/route.ts'), hookSource: read('hooks/use-chat-sessions.ts') }
const realFailures = await runSuite(real)
assert.deepEqual(realFailures, [], `the real sources fail the proof:\n  ${realFailures.join('\n  ')}`)

const git = (...args) => execFileSync('git', args, { cwd: ROOT.pathname, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
const baseOf = rel => git('show', `${process.env.SESSIONS_OWNER_BASE || strip.BASE_COMMIT}:${rel}`)
// ---- mutants: each must be caught ---------------------------------------------------------------------------------------------
const swap = (key, from, to) => ({ ...real, [key]: (() => { assert.equal(real[key].split(from).length, 2, `mutant text must be there once: ${from}`); return real[key].replace(from, () => to) })() })
const mutants = {
  'the owner check is removed': swap('routeSource', 'existing.userId !== user.id', 'false'),
  'the owner check is inverted': swap('routeSource', 'existing.userId !== user.id', 'existing.userId === user.id'),
  'the owner check compares the e-mail, not the id': swap('routeSource', 'existing.userId !== user.id', 'existing.userId !== session.user.email'),
  'the whole row is answered again (409)': swap('routeSource', 'pickAllowedKeys(existing, SESSION_CREATE_RESPONSE_KEYS)', 'existing'),
  'the whole row is answered again (201)': swap('routeSource', 'pickAllowedKeys(newSession, SESSION_CREATE_RESPONSE_KEYS)', 'newSession'),
  'the allow-list is widened by userId': swap('routeSource', "['id', 'geminiStoreName'] as const", "['id', 'geminiStoreName', 'userId'] as const"),
  'the allow-list is widened by the presentation url': swap('routeSource', "['id', 'geminiStoreName'] as const", "['id', 'geminiStoreName', 'finalPresentationUrl'] as const"),
  'the allow-list loses the store name the Builder reads': swap('routeSource', "['id', 'geminiStoreName'] as const", "['id'] as const"),
  'the foreign answer is a 409 with a row': swap('routeSource', "{ error: 'Session not found' },\n          { status: 404 }", "{ error: 'Session already exists', session: existing },\n          { status: 409 }"),
  'the DATABASE_URL prefix log is restored': swap('routeSource', "  console.log('[Session Create] DIRECT_URL configured:', !!process.env.DIRECT_URL);", "  console.log('[Session Create] DATABASE_URL prefix:', process.env.DATABASE_URL?.substring(0, 40) + '...');\n  console.log('[Session Create] DIRECT_URL configured:', !!process.env.DIRECT_URL);"),
  'the e-mail is logged after sign-in again': swap('routeSource', "console.log('[Session Create] ✅ Authenticated');", "console.log('[Session Create] ✅ Authenticated user:', session.user.email);"),
  'the e-mail is logged in the query line again': swap('routeSource', "console.log('[Session Create] Attempting Prisma query: user.findUnique by email');", "console.log('[Session Create] Attempting Prisma query: user.findUnique({ where: { email:', session.user.email, '}})');"),
  'the e-mail is logged when the user is created again': swap('routeSource', "console.warn('[Session Create] ⚠️ User not found in database, creating');", "console.warn('[Session Create] ⚠️ User not found in database, creating:', session.user.email);"),
  'the lookup error message is logged again': swap('routeSource', "      console.error('[Session Create] Error name:', dbError.name);", "      console.error('[Session Create] Error message:', dbError.message);\n      console.error('[Session Create] Error name:', dbError.name);"),
  'the create-user error message is logged again': swap('routeSource', "        console.error('[Session Create] Code:', createError.code);", "        console.error('[Session Create] Error:', createError.message);\n        console.error('[Session Create] Code:', createError.code);"),
  'the create-user error text is answered again': swap('routeSource', "{ error: 'Failed to create user account' }", "{ error: 'Failed to create user account', details: createError.message }"),
  'the final error message is logged again': swap('routeSource', "    console.error('[Session Create] Error type:', error?.constructor?.name);", "    console.error('[Session Create] Error message:', error.message);\n    console.error('[Session Create] Error type:', error?.constructor?.name);"),
  'the full error object is logged again': swap('routeSource', "    console.error('[Session Create] Error type:', error?.constructor?.name);", "    console.error('[Session Create] Full error:', JSON.stringify(error, null, 2));\n    console.error('[Session Create] Error type:', error?.constructor?.name);"),
  'the stack is logged again': swap('routeSource', "    console.error('[Session Create] Error type:', error?.constructor?.name);", "    console.error('[Session Create] Stack trace:', error.stack);\n    console.error('[Session Create] Error type:', error?.constructor?.name);"),
  'the error code is no longer logged': swap('routeSource', "    console.error('[Session Create] Error code:', error?.code);\n", ''),
  'the 500 body carries the raw message again': swap('routeSource', "    console.error('='.repeat(80));\n\n    return NextResponse.json(\n      { error: 'Internal server error' },", "    console.error('='.repeat(80));\n\n    return NextResponse.json(\n      { error: 'Internal server error', details: error.message, code: error.code },"),
  'the route as the base had it (the leak before this change)': { ...real, routeSource: baseOf('app/api/sessions/route.ts') },
  'the hook as the base had it (a 409 row is always adopted)': { ...real, hookSource: baseOf('hooks/use-chat-sessions.ts') },
  'the client trusts any 409 row again (createSession)': swap('hookSource', 'row.id === sessionId', 'true'),
  'the client treats any 409 as recovered again': swap('hookSource', '(response.status === 409 && ownRowFromCreateAnswer', '(response.status === 409 || ownRowFromCreateAnswer'),
}
let killed = 0
for (const [name, sources] of Object.entries(mutants)) {
  const failures = await runSuite(sources)
  assert.ok(failures.length > 0, `mutant survived: ${name}`)
  killed++
}

// ---- strip + registry (the older pins read these two files through the later-changes registry) ---------------------------------
const others = (rel, text) => LATER_STRIPS.filter(fn => fn !== strip.stripSessionsOwner).reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, text)
for (const rel of Object.keys(strip.SESSIONS_OWNER_PAIRS)) {
  const now = read(rel)
  assert.notEqual(now, baseOf(rel), `${rel}: this change edits it`)
  assert.equal(strip.stripSessionsOwner(rel, others(rel, now)), others(rel, baseOf(rel)), `${rel}: the strip gives back the base's file byte for byte`)
  assert.equal(strip.stripSessionsOwner(rel, strip.stripSessionsOwner(rel, others(rel, now))), strip.stripSessionsOwner(rel, others(rel, now)), `${rel}: stripping twice changes nothing more`)
  assert.equal(strip.stripSessionsOwner(rel, 'unrelated\n'), 'unrelated\n', `${rel}: a file without this change's text comes back as it is`)
}
assert.equal(strip.stripSessionsOwner('lib/other.ts', 'x'), 'x')
const registry = read('scripts/studio-later-changes.mjs')
for (const [list, name] of [['LATER_CHANGE_FILES', 'SESSIONS_OWNER_SCOPE_FILES'], ['LATER_STRIPS', 'stripSessionsOwner']]) {
  const body = (registry.split(`export const ${list} = `)[1] || '').split('\n  // one line per later change, above this comment')[0]
  const mine = body.split('\n').filter(line => line.includes('LATER-CHANGE') && line.includes(`'./studio-sessions-owner-strip.mjs')).${name}`))
  assert.equal(mine.length, 1, `${list}: one marked line`)
}
assert.ok(strip.SESSIONS_OWNER_SCOPE_FILES.every(rel => LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
for (const rel of ['app/api/sessions/route.ts', 'hooks/use-chat-sessions.ts', 'scripts/test-studio-sessions-owner.mjs', 'scripts/studio-sessions-owner-strip.mjs', 'scripts/studio-later-changes.mjs', 'scripts/test-studio-deck-sync-truth.mjs', 'scripts/test-studio-chat-element-edit.mjs']) assert.ok(strip.SESSIONS_OWNER_SCOPE_FILES.includes(rel), `${rel} is in scope`)
assert.equal(stripLaterChanges('.env.example', read('.env.example')), stripLaterChanges('.env.example', baseOf('.env.example')), 'no flag, no .env.example block (read through the later changes\' blocks)')

// the two older proofs that read their own first-parent commits skip a later change's by subject: this change's commits start "Sessions:"
for (const rel of ['scripts/test-studio-deck-sync-truth.mjs', 'scripts/test-studio-chat-element-edit.mjs']) assert.ok(read(rel).includes("!/^Sessions:/.test(git('log', '-1', '--format=%s', sha))"), `${rel}: skips this change's commits`)

console.log(`test-studio-sessions-owner: all checks passed (${cases.length} cases on the real route and hook, ${killed} mutants killed)`)
