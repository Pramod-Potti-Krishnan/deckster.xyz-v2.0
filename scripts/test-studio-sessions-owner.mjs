#!/usr/bin/env node
// Proof (offline, $0): POST /api/sessions no longer hands another user's chat to a caller (P-73), no longer logs a secret or the
// caller's e-mail, and no longer echoes a raw error to the browser (P-74). NO flag: a data leak is closed for everyone (the
// precedent is the tier guard, PR #575, and the D1 debug routes: "by design, no flag").
// The REAL app/api/sessions/route.ts and hooks/use-chat-sessions.ts are transpiled and run on stubs: an in-memory prisma, a fixed
// signed-in session, a minimal NextResponse, and a fetch that calls the real route. No network, no database, no browser.
// A 2xx from POST /api/sessions always means the row is the caller's (201 new, 200 own); another user's id is a 404 with fixed bytes
// and the same database calls as the own-id path; the client adopts only a 2xx and never a 409 (REVIEW-1's two checks, 13 Nov).
// Then mutants (each must make the proof FAIL): owner check removed, owner check inverted, allow-list widened, each log restored,
// raw error text restored, an extra database round trip or a write on the foreign path, and the client adopting a 409 again.
// FOLLOW-UP (13 Nov, REVIEW-1's two P3s and DIRECTOR-2's 14:55Z recommendation): no log line carries an account id or a chat id; and a URL session id that POST /api/sessions
// refuses (404) is never kept by the Builder: it mints a fresh id, creates the caller's own row, replaces the URL and opens the Director socket on the fresh id only (the REAL
// use-builder-session and use-chat-sessions hooks on a hook runtime against the real route; the caller's own id and new ids give the base hook's exact trace). Mutants for each.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { createRequire } from 'node:module'
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
const DELETED_ID = '44444444-4444-4444-8444-444444444444' // FOLLOW-UP 2: a deleted chat of the caller's own
const OTHER_FRESH_ID = '55555555-5555-4555-8555-555555555555' // FOLLOW-UP 2: a second id nobody has (a client navigation)
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
    calls: [], rows, users, session: { user: { email: CALLER.email, name: 'Caller' } }, userLookupError: null, userCreateError: null, created: [], userCreated: [],
    prisma: {
      user: {
        findUnique: async ({ where }) => { world.calls.push('user.findUnique'); if (world.userLookupError) throw world.userLookupError; return users.get(where.email) ?? null },
        create: async ({ data }) => { world.calls.push('user.create'); if (world.userCreateError) throw world.userCreateError; const user = { id: `user-new-${users.size}`, ...data }; users.set(data.email, user); world.userCreated.push(user); return user },
      },
      chatSession: {
        findUnique: async ({ where }) => { world.calls.push('chatSession.findUnique'); return rows.get(where.id) ?? null },
        create: async ({ data }) => { world.calls.push('chatSession.create'); world.created.push(plain(data)); const row = fullRow(data.id, { id: data.userId }, { title: data.title, geminiStoreName: null, geminiStoreId: null }); rows.set(data.id, row); return row },
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

const git = (...args) => execFileSync('git', args, { cwd: ROOT.pathname, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
const baseTexts = new Map()
const baseOf = rel => { if (!baseTexts.has(rel)) baseTexts.set(rel, git('show', `${process.env.SESSIONS_OWNER_BASE || strip.BASE_COMMIT}:${rel}`)); return baseTexts.get(rel) }

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
// REVIEW-1's P3 (13 Nov): the route logs no account id and no chat id, in any line, on any path (neither is an e-mail, but both identify a person or their chat).
const UUID_SHAPE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const noIdInLogs = (logs, label, extra = []) => {
  const all = logs.join('\n')
  for (const bad of [CALLER.id, VICTIM.id, 'user-other', 'user-new-', OWN_ID, FOREIGN_ID, FRESH_ID, ...extra]) assert.equal(all.includes(bad), false, `${label}: the server log carries the id "${bad}"`)
  assert.equal(UUID_SHAPE.test(all), false, `${label}: the server log carries a UUID-shaped id`)
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
  ['P-73: the caller\'s own id is answered 200 (never 409) with the row, allow-listed keys only: a 2xx always means yours', async ({ routeSource }) => {
    const world = makeWorld(); const { post } = loadRoute(routeSource, world)
    const res = await post({ sessionId: OWN_ID })
    assert.equal(res.status, 200)
    assert.deepEqual(Object.keys(res.body), ['session'])
    assert.deepEqual(Object.keys(res.body.session).sort(), ALLOWED)
    assert.equal(res.body.session.id, OWN_ID)
    assert.equal(res.body.session.geminiStoreName, 'fileSearchStores/own-store', 'the one other field the Builder reads when it adopts an id')
    const text = JSON.stringify(res.body)
    for (const key of ['userId', 'blankPresentationUrl', 'strawmanPreviewUrl', 'finalPresentationUrl', 'blankPresentationId', 'strawmanPresentationId', 'finalPresentationId', 'geminiStoreId', 'title', 'status', 'currentStage', 'slideCount', 'isFavorite']) assert.equal(text.includes(`"${key}"`), false, `${key} is not on the list`)
    assert.equal(world.created.length, 0)
    assert.equal(world.rows.get(OWN_ID).geminiStoreName, 'fileSearchStores/own-store', 'and the row is untouched')
  }],
  ['P-73 (REVIEW-1 check 1): the foreign answer is the same bytes every time, whoever owns the row, whatever the title; and it costs the same database calls as the own-id answer (one user read, one session read, no write)', async ({ routeSource }) => {
    const answers = new Set(); const sequences = []
    const OTHER = { id: 'user-other', email: 'other@mail.example' }
    for (const [setup, body] of [
      [w => w, { sessionId: FOREIGN_ID }],
      [w => w, { sessionId: FOREIGN_ID, title: 'a title' }],
      [w => { w.rows.set(FOREIGN_ID, fullRow(FOREIGN_ID, OTHER, { title: null, geminiStoreName: null })); return w }, { sessionId: FOREIGN_ID }], // another owner, a row with no store
      [w => { w.rows.set(FOREIGN_ID, fullRow(FOREIGN_ID, VICTIM, { status: 'archived' })); return w }, { sessionId: FOREIGN_ID, title: 'x' }],
    ]) {
      const world = setup(makeWorld()); const { post } = loadRoute(routeSource, world)
      const res = await post(body)
      answers.add(JSON.stringify(res)); sequences.push(world.calls.join(','))
      assert.equal(world.created.length, 0)
    }
    assert.equal(answers.size, 1, `one byte string for every foreign answer, got ${[...answers].join(' | ')}`)
    assert.equal([...answers][0], JSON.stringify({ status: 404, body: { error: 'Session not found' } }))
    const own = makeWorld(); await loadRoute(routeSource, own).post({ sessionId: OWN_ID })
    const missing = makeWorld(); await loadRoute(routeSource, missing).post({ sessionId: FRESH_ID })
    assert.deepEqual(sequences, Array(sequences.length).fill('user.findUnique,chatSession.findUnique'), 'the foreign path: one user read, one session read')
    assert.equal(own.calls.join(','), 'user.findUnique,chatSession.findUnique', 'the own-id path makes exactly those calls: the foreign path has no round trip of its own')
    assert.equal(missing.calls.join(','), 'user.findUnique,chatSession.findUnique,chatSession.create', 'a missing id: the same two reads, then the create it exists to do')
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
  ['P-74 (REVIEW-1 P3): no path logs an account id or a chat id: not when it creates, finds, refuses or fails, and every line still reads as a step', async ({ routeSource }) => {
    class PrismaClientKnownRequestError extends Error { constructor(message) { super(message); this.name = 'PrismaClientKnownRequestError' } }
    const boom = () => Object.assign(new PrismaClientKnownRequestError('x'), { code: 'P1001', clientVersion: '5.22.0' })
    for (const [label, setup, body] of [
      ['fresh id', () => makeWorld(), { sessionId: FRESH_ID, title: 'a' }],
      ['own id', () => makeWorld(), { sessionId: OWN_ID }],
      ['foreign id', () => makeWorld(), { sessionId: FOREIGN_ID, title: 'mine now' }],
      ['new account (its row is created)', () => { const w = makeWorld(); w.session = { user: { email: 'newcomer@mail.example' } }; return w }, { sessionId: FRESH_ID }],
      ['an existing account', () => makeWorld(), { sessionId: FRESH_ID }],
      ['no sessionId', () => makeWorld(), {}],
      ['signed out', () => { const w = makeWorld(); w.session = null; return w }, { sessionId: FRESH_ID }],
      ['the user lookup fails', () => { const w = makeWorld(); w.userLookupError = boom(); return w }, { sessionId: FRESH_ID }],
      ['the session create fails', () => { const w = makeWorld(); w.prisma.chatSession.create = async () => { throw boom() }; return w }, { sessionId: FRESH_ID }],
    ]) {
      const world = setup(); const { post, logs } = loadRoute(routeSource, world)
      await post(body)
      assert.ok(logs.length > 0, `${label}: the route still logs its steps`)
      noIdInLogs(logs, label, world.userCreated.map(user => user.id))
    }
    // the steps the ids used to ride on are still logged, as booleans or bare
    const world = makeWorld(); const { post, logs } = loadRoute(routeSource, world)
    await post({ sessionId: FRESH_ID, title: 'a' })
    const all = logs.join('\n')
    for (const step of ['User found in database', 'Session ID given: true', 'Title given: true', 'Chat session created successfully']) assert.ok(all.includes(step), `the step "${step}" is still logged`)
    const foreign = makeWorld(); const refused = loadRoute(routeSource, foreign); await refused.post({ sessionId: FOREIGN_ID })
    assert.ok(refused.logs.join('\n').includes('belongs to another user, refused'), 'a refusal is still logged (without the id)')
    const own = makeWorld(); const found = loadRoute(routeSource, own); await found.post({ sessionId: OWN_ID })
    assert.ok(found.logs.join('\n').includes('Session already exists'), 'a found own row is still logged (without the id)')
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
    assert.equal(/status:\s*409/.test(routeSource), false, 'the route answers no 409 any more')
  }],
  ['P-73 client (REVIEW-1 check 2): a foreign id is never adopted: createSession answers null (404), and nothing of the victim\'s row reaches the browser', async ({ routeSource, hookSource }) => {
    const world = makeWorld(); const { hook, sent, seen } = loadHook(hookSource, world, routeSource)
    assert.equal(await hook.createSession(FOREIGN_ID, 'x'), null)
    assert.deepEqual(sent, [{ url: '/api/sessions', method: 'POST' }])
    noLeak(seen, 'what the browser received')
    assert.equal(seen[0].status, 404)
  }],
  ['P-73 client: the caller\'s own id is still adopted (200 row with its id and store name), and a new id is created (201)', async ({ routeSource, hookSource }) => {
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
  ['409 with the row of the id asked for (an older build\'s whole-row answer: the client cannot tell whose it is)', 409, { error: 'Session already exists', session: { id: OWN_ID, userId: VICTIM.id, geminiStoreName: 'fileSearchStores/x' } }],
  ['409 with another id\'s row', 409, { error: 'Session already exists', session: { id: 'someone-elses', geminiStoreName: 'fileSearchStores/x' } }],
  ['409 with no row', 409, { error: 'Session already exists' }],
  ['409 with no body', 409, undefined],
  ['409 with a null row', 409, { session: null }],
]
for (const [label, status, body] of clientAgainstOddServer) {
  cases.push([`P-73 client: ${label} is not an adoption (a 409 is never one: createSession answers null; the recovery path answers "not recovered")`, async ({ hookSource }) => {
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
cases.push(['P-73 client: a 200 with the row (the caller\'s own) IS recovered, as the 409 was (the PATCH is retried once)', async ({ hookSource }) => {
  const calls = []
  const quiet = () => {}
  let patches = 0
  const fetchStub = async (url, init = {}) => {
    calls.push(`${init.method ?? 'GET'} ${url}`)
    if (url === '/api/sessions' && init.method === 'POST') return responseOf(200, { session: { id: OWN_ID, geminiStoreName: null } })
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

// ================================================================================================================================
// FOLLOW-UP (13 Nov, REVIEW-1's P3 on the unsaved local session, DIRECTOR-2's 14:55Z recommendation): a URL session id that POST /api/sessions refuses (404:
// another account's chat) is never kept. With session hygiene off the Builder used to keep that id as an unsaved local session and open its Director socket on it;
// now it mints a fresh id, creates the caller's own row, replaces the URL (no history entry) and opens the socket on the fresh id only. The REAL
// hooks/use-builder-session.ts and hooks/use-chat-sessions.ts run on a tiny hook runtime against the REAL route (the same accounts and rows as above), the way the
// Builder page wires them (it hands the socket hook `existingSessionId: currentSessionId` and does not auto-connect for a URL id: pinned on the page below).
// ================================================================================================================================
const nodeRequire = createRequire(new URL('../package.json', import.meta.url))
const transpiledModules = new Map()
function compileModule(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiledModules.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
    transpiledModules.set(key, out.outputText)
  }
  return transpiledModules.get(key)
}
/** Repo files, transpiled on require; `overrides`: repo-relative path -> source text; `stubs`: import specifier as written -> module object. */
function createWorld({ env = {}, overrides = {}, stubs = {}, globals = {} } = {}) {
  const cache = new Map()
  const names = Object.keys(globals)
  const exists = rel => rel in overrides || (fs.existsSync(new URL(rel, ROOT)) && fs.statSync(new URL(rel, ROOT)).isFile())
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext
    throw new Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const source = rel in overrides ? overrides[rel] : read(rel)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      return nodeRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', ...names, compileModule(rel, source))(module, module.exports, require, { env }, ...names.map(name => globals[name]))
    return module.exports
  }
  return { load }
}
function hookRuntime() {
  let current = null
  const impl = { useState: (...a) => current.useState(...a), useRef: (...a) => current.useRef(...a), useCallback: (...a) => current.useCallback(...a), useMemo: (...a) => current.useMemo(...a), useEffect: (...a) => current.useEffect(...a) }
  function instance(call, onDirty) {
    let cursor = 0
    const slots = []
    let pending = []
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((dep, n) => Object.is(dep, b[n]))
    const hooks = {
      useState(initial) {
        const i = cursor++
        if (!slots[i]) {
          const slot = { value: typeof initial === 'function' ? initial() : initial }
          slot.set = next => { const value = typeof next === 'function' ? next(slot.value) : next; if (!Object.is(value, slot.value)) { slot.value = value; onDirty() } }
          slots[i] = slot
        }
        return [slots[i].value, slots[i].set]
      },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
      useCallback(fn, deps) { const i = cursor++, old = slots[i]; if (old && sameDeps(deps, old.deps)) return old.fn; slots[i] = { fn, deps }; return fn },
      useMemo(fn, deps) { const i = cursor++, old = slots[i]; if (old && sameDeps(deps, old.deps)) return old.value; slots[i] = { value: fn(), deps }; return slots[i].value },
      useEffect(callback, deps) {
        const i = cursor++, old = slots[i]
        if (!old || !deps || !sameDeps(deps, old.deps)) { const next = { deps, cleanup: old?.cleanup }; slots[i] = next; pending.push(() => { next.cleanup?.(); next.cleanup = callback() }) }
      },
    }
    return {
      render() { current = hooks; cursor = 0; pending = []; let result; try { result = call() } finally { current = null } for (const effect of pending) effect(); return result },
      unmount() { for (const slot of slots) if (slot && typeof slot.cleanup === 'function') slot.cleanup() },
    }
  }
  return { impl, instance }
}
class MemStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
  removeItem(key) { this.map.delete(key) }
}
const unsavedKey = id => `deckster_unsaved_v2_${encodeURIComponent(CALLER.id)}_${id}`
const UUID_ONLY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NO_LAYOUT_ROW = { blankPresentationUrl: null, strawmanPreviewUrl: null, finalPresentationUrl: null, blankPresentationId: null, strawmanPresentationId: null, finalPresentationId: null }
const turns = async (n = 6) => { for (let i = 0; i < n; i++) await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)) }

/**
 * One Builder page: it owns what page.tsx owns (the URL, currentSessionId, isUnsavedSession) and runs the real hooks as the page wires them. The history API is the
 * real route for the create call and the [id] routes' answers (404 no row, 403 another owner, 200 yours) for the rest. `sockets` is the session id each Director socket
 * is opened with: the page gives the socket hook `existingSessionId: currentSessionId`, so it is the page's current id at the moment the session hook asks to connect.
 */
async function runPage({ routeSource, hookSource, builderSource, url, mutateWorld, hygiene = false, postFaults = 0, postNetworkFaults = 0, seedStorage, slow = false, script }) {
  const { log, warn, error } = console
  console.log = console.warn = console.error = () => {}
  try {
    const world = makeWorld()
    world.rows.set(OWN_ID, fullRow(OWN_ID, CALLER, { ...NO_LAYOUT_ROW, geminiStoreName: 'fileSearchStores/own-store' }))
    mutateWorld?.(world)
    const storage = new MemStorage()
    seedStorage?.(storage)
    const { post } = loadRoute(routeSource, world)
    const calls = [], sockets = [], navigation = [], toasts = []
    let faults = postFaults, networkFaults = postNetworkFaults, slowNetwork = slow
    const heldRequests = [] // FOLLOW-UP 2: while `slowNetwork` is on, every history request waits here until the script lets it through (a cold start, a poor line)
    const longTimers = new Set() // FOLLOW-UP 2: the timers of 5 s or more (the 10 s loading safety net), fired only when the script says so
    const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: String(status), json: async () => JSON.parse(JSON.stringify(body)), text: async () => JSON.stringify(body) })
    const fetchStub = async (target, init = {}) => {
      await Promise.resolve()
      if (slowNetwork) await new Promise(resolve => heldRequests.push(resolve))
      const method = String(init.method || 'GET').toUpperCase()
      const body = init.body ? JSON.parse(init.body) : null
      let answer
      if (target === '/api/sessions' && method === 'POST' && networkFaults > 0 && networkFaults--) throw new TypeError('Failed to fetch') // FOLLOW-UP 2: no answer at all
      if (target === '/api/sessions' && method === 'POST') answer = faults > 0 && faults-- ? { status: 500, body: { error: 'Internal server error' } } : await post(body)
      else {
        const match = /^\/api\/sessions\/([^/?]+)(\/messages)?$/.exec(target)
        if (!match) throw new Error(`unexpected request ${method} ${target}`)
        const row = world.rows.get(match[1])
        if (!row) answer = { status: 404, body: { error: 'Session not found' } }
        else if (row.userId !== CALLER.id) answer = { status: 403, body: { error: 'Forbidden' } }
        else if (method === 'GET') answer = { status: 200, body: { session: { ...row, messages: [] } } }
        else answer = { status: 200, body: match[2] ? { saved: 1, failed: 0, total: 1 } : { session: { id: row.id } } }
      }
      calls.push({ method, url: target, sessionId: body?.sessionId ?? (/^\/api\/sessions\/([^/?]+)/.exec(target)?.[1] ?? null), status: answer.status })
      return reply(answer.status, answer.body)
    }
    const runtime = hookRuntime()
    const page = { url, currentSessionId: null, isUnsavedSession: false, dirty: false }
    const route = () => new URLSearchParams(page.url.split('?')[1] ?? '').get('session_id')
    const initialRoute = route()
    page.currentSessionId = initialRoute && initialRoute !== 'new' ? initialRoute : null // page.tsx's initial state
    page.isUnsavedSession = Boolean(page.currentSessionId && storage.getItem(unsavedKey(page.currentSessionId)) === 'true')
    const win = { location: { get search() { return '?' + (page.url.split('?')[1] ?? '') } }, sessionStorage: storage, addEventListener() {}, removeEventListener() {} }
    const worldOfModules = createWorld({
      env: hygiene ? { NEXT_PUBLIC_STUDIO_SESSION_HYGIENE: 'true' } : {},
      overrides: { 'hooks/use-builder-session.ts': builderSource, 'hooks/use-chat-sessions.ts': hookSource },
      globals: { window: win, sessionStorage: storage, fetch: fetchStub, setTimeout: (fn, ms) => { if (ms >= 5000) { const timer = { fn }; longTimers.add(timer); return timer } return setImmediate(fn) }, clearTimeout: handle => { if (handle && typeof handle.fn === 'function') longTimers.delete(handle); else if (handle) clearImmediate(handle) } }, // the 10 s loading safety net fires only when a script runs it (fireSafetyNet): in every other run it never does
      stubs: {
        react: runtime.impl,
        'next/navigation': { useRouter: () => ({ replace: next => { navigation.push({ kind: 'replace', href: next }); page.url = next; page.dirty = true }, push: next => { navigation.push({ kind: 'push', href: next }); page.url = next; page.dirty = true } }) },
        '@/lib/config': { features: { immediateConnection: true } },
        '@/lib/layout-service-client': { getLayoutServiceUrl: () => 'https://layout.invalid', LAYOUT_URL_CONFIG_ERROR: null, LAYOUT_VIEWER_URL_POLICY: { configuredOrigin: null, allowedOrigins: [] } },
      },
    })
    const builder = worldOfModules.load('hooks/use-builder-session.ts')
    const chat = worldOfModules.load('hooks/use-chat-sessions.ts')
    let latest = null, hookDirty = false
    const signedInUser = { id: CALLER.id, email: CALLER.email } // FOLLOW-UP 2: one object for the whole run, as next-auth's session user is: a fresh object per render would re-run the connection effect on every render and hide a missing dependency
    const ensureConnected = () => { sockets.push(page.currentSessionId); return true } // FOLLOW-UP 2: stable across renders (a useCallback in the real socket hook), for the same reason as the user object
    const instance = runtime.instance(() => {
      const sessions = chat.useChatSessions()
      return builder.useBuilderSession({
        user: signedInUser, isAuthLoading: false, searchParams: new URLSearchParams(page.url.split('?')[1] ?? ''),
        loadSession: sessions.loadSession, loadSessionResult: sessions.loadSessionResult, createSession: sessions.createSession, persistence: null,
        connected: false, connecting: false, reconnectStatus: 'idle',
        ensureConnected, disconnect() {}, clearMessages() {}, restoreMessages() {}, updateCacheUserMessages() {}, messages: [], toast: t => { toasts.push(t) },
        isUnsavedSession: page.isUnsavedSession, setIsUnsavedSession: v => { if (v !== page.isUnsavedSession) { page.isUnsavedSession = v; page.dirty = true } },
        currentSessionId: page.currentSessionId, setCurrentSessionId: v => { if (v !== page.currentSessionId) { page.currentSessionId = v; page.dirty = true } },
        setSessionStoreName() {},
      })
    }, () => { hookDirty = true })
    const render = () => { page.dirty = false; hookDirty = false; latest = instance.render() }
    render()
    const settle = async () => {
      let stable = 0, last = -1
      for (let i = 0; i < 400 && stable < 10; i++) {
        await turns(3)
        if (page.dirty || hookDirty) render()
        const now = calls.length + navigation.length + sockets.length + toasts.length
        if (now === last && !page.dirty && !hookDirty) stable++; else stable = 0
        last = now
      }
    }
    await settle()
    // FOLLOW-UP 2: a script drives a slow start: it fires the 10 s safety net while requests are still in flight, lets requests through one at a time, or moves the URL (a client navigation), settling after each step
    const control = {
      settle,
      pending: () => heldRequests.length,
      sockets: () => [...sockets],
      fireSafetyNet: async () => { for (const timer of [...longTimers]) { longTimers.delete(timer); timer.fn() } await settle() },
      release: async () => { heldRequests.shift()?.(); await settle() },
      releaseAll: async () => { while (heldRequests.length) { heldRequests.shift()(); await settle() } },
      slow: async on => { slowNetwork = on; if (!on) await control.releaseAll() },
      navigate: async next => { page.url = next; page.dirty = true; await settle() },
      snapshot: () => ({ id: page.currentSessionId, loading: latest?.isLoadingSession, sockets: [...sockets], unsaved: page.isUnsavedSession }),
    }
    await script?.(control)
    instance.unmount()
    return { world, page, calls, sockets, navigation, storage, latest, toasts, problem: latest?.sessionProblem ?? null }
  } finally { console.log = log; console.warn = warn; console.error = error }
}

const pageCases = {
  'a foreign id in the URL (hygiene off)': { url: `/builder?session_id=${FOREIGN_ID}` },
  'an id that is the caller\'s own, with a row': { url: `/builder?session_id=${OWN_ID}` },
  'an id nobody has (adopted: the row is created for it)': { url: `/builder?session_id=${FRESH_ID}` },
  'an id nobody has, the create answers 500 (a failed adoption that is not a refusal)': { url: `/builder?session_id=${FRESH_ID}`, postFaults: 1, noBaseTrace: true }, // FOLLOW-UP 2: no socket on it, by design: its own case below
  'a bare /builder (a local id is minted, as before)': { url: '/builder' },
  'session_id=new': { url: '/builder?session_id=new' },
  // FOLLOW-UP 2 (REVIEW-1 P2 and DIRECTOR-2): the starts that must stay exactly as they were, with the new gate in the connection effect
  'a bare /builder whose create for the minted local id answers 500': { url: '/builder', postFaults: 1 },
  'a deleted chat of the caller\'s own (loadSession answers null for it: the adoption path, the row is the caller\'s)': { url: `/builder?session_id=${DELETED_ID}`, mutateWorld: world => world.rows.set(DELETED_ID, fullRow(DELETED_ID, CALLER, { ...NO_LAYOUT_ROW, status: 'deleted' })) },
  'hygiene on: the caller\'s own id': { url: `/builder?session_id=${OWN_ID}`, hygiene: true },
  'hygiene on: a local unsaved id this tab minted (its unsaved marker; no row under any account)': { url: `/builder?session_id=${FRESH_ID}`, hygiene: true, seedStorage: storage => storage.setItem(unsavedKey(FRESH_ID), 'true') },
  'hygiene on: a staged hand-off id (the row is created for it)': { url: `/builder?session_id=${FRESH_ID}`, hygiene: true, seedStorage: storage => storage.setItem(`deckster_composer_ready_${FRESH_ID}`, '1') },
}
/** Ids made of random UUIDs (the minted ones) come out as <local>, so a run on the base hook and one on this hook can be compared. */
const named = value => JSON.stringify(value).replaceAll(OWN_ID, '<own>').replaceAll(FRESH_ID, '<fresh>').replaceAll(FOREIGN_ID, '<foreign>').replace(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '<local>')
const traceOf = run => named({ calls: run.calls.map(c => [c.method, c.url, c.sessionId, c.status]), sockets: run.sockets, navigation: run.navigation, id: run.page.currentSessionId, unsaved: run.page.isUnsavedSession, rows: [...run.world.rows.keys()].map(id => named(id)).sort(), markers: [...run.storage.map.keys()].map(key => named(key)).sort() })

cases.push(['P3 (REVIEW-1, DIRECTOR-2): a foreign id in the URL is never kept: a fresh id is minted, its row is created, the URL is replaced (no history entry) and the socket opens on the fresh id only; nothing is written or opened with the foreign id', async sources => {
  const run = await runPage({ ...sources, ...pageCases['a foreign id in the URL (hygiene off)'] })
  const minted = run.page.currentSessionId
  assert.match(minted, UUID_ONLY, 'a fresh UUID')
  assert.notEqual(minted, FOREIGN_ID)
  assert.deepEqual(run.navigation, [{ kind: 'replace', href: `/builder?session_id=${minted}` }], 'one router.replace to the fresh id, no push (Back does not return to the foreign id)')
  assert.deepEqual(run.sockets, [minted], 'the Director socket is opened once, on the fresh id')
  assert.deepEqual(run.calls.map(c => `${c.method} ${c.url.replace(minted, '<fresh>')} ${c.status}`), [`GET /api/sessions/${FOREIGN_ID} 403`, 'POST /api/sessions 404', 'POST /api/sessions 201'], 'the lookup, the refused create, the create of the fresh id: nothing else, and no second load of the fresh id after the URL changed')
  assert.deepEqual(run.calls.filter(c => c.sessionId === FOREIGN_ID).map(c => `${c.method} ${c.url}`), [`GET /api/sessions/${FOREIGN_ID}`, 'POST /api/sessions'], 'the foreign id is only ever asked about (the lookup and the one refused create); nothing is written under it and no PATCH or message save carries it')
  assert.equal(run.world.rows.get(minted)?.userId, CALLER.id, 'the row for the fresh id is the caller\'s')
  assert.equal(run.world.rows.get(FOREIGN_ID).userId, VICTIM.id, 'the other account\'s row is untouched')
  assert.equal(run.page.isUnsavedSession, false, 'the row exists, so the session is saved')
  assert.equal(run.storage.getItem(unsavedKey(FOREIGN_ID)), null, 'no unsaved marker for the foreign id')
  assert.ok(run.latest.studioInitialFreshCanonicalEntry && run.latest.studioInitialFreshCanonicalEntry.sessionId === minted, 'a local fresh id, as the bare /builder one: the Studio stage knows it is a new session')
  assert.equal(run.latest.isLoadingSession, false)
  assert.equal(run.problem, null)
}])
cases.push(['P3: the fresh id\'s own create fails: it stays an unsaved local session (marker set), the URL is still replaced, the socket still opens on it only', async sources => {
  const run = await runPage({ ...sources, url: `/builder?session_id=${FOREIGN_ID}`, postFaults: 0, mutateWorld: world => { world.prisma.chatSession.create = async () => { throw new Error('database down') } } })
  const minted = run.page.currentSessionId
  assert.match(minted, UUID_ONLY); assert.notEqual(minted, FOREIGN_ID)
  assert.equal(run.page.isUnsavedSession, true)
  assert.equal(run.storage.getItem(unsavedKey(minted)), 'true', 'the guard the page reads on reload')
  assert.equal(run.storage.getItem(unsavedKey(FOREIGN_ID)), null)
  assert.deepEqual(run.sockets, [minted])
  assert.deepEqual(run.navigation, [{ kind: 'replace', href: `/builder?session_id=${minted}` }])
  assert.equal(run.world.rows.has(minted), false, 'no row yet: the first real action creates it')
}])
cases.push(['P3: only a refusal (404) mints: any other failed adoption keeps the id as an unsaved session as before (a 500 never swaps a person\'s own id), and (FOLLOW-UP 2) the Director socket never opens on it', async sources => {
  for (const [label, options, answered] of [['a 500', { postFaults: 1 }, ['GET /api/sessions/' + FRESH_ID + ' 404', 'POST /api/sessions 500']], ['no answer at all (a network error)', { postNetworkFaults: 1 }, ['GET /api/sessions/' + FRESH_ID + ' 404']]]) {
    const run = await runPage({ ...sources, url: `/builder?session_id=${FRESH_ID}`, ...options })
    assert.equal(run.page.currentSessionId, FRESH_ID, `${label}: the id stays`)
    assert.equal(run.page.isUnsavedSession, true, `${label}: unsaved, as before`)
    assert.deepEqual(run.navigation, [], `${label}: no new id, no URL change`)
    assert.deepEqual(run.sockets, [], `${label}: nobody has said whose this id is: no Director socket on it`)
    assert.equal(run.storage.getItem(unsavedKey(FRESH_ID)), 'true', `${label}: the unsaved guard is kept, as before`)
    assert.equal(run.world.rows.has(FRESH_ID), false, `${label}: no row`)
    assert.deepEqual(run.calls.map(c => `${c.method} ${c.url} ${c.status}`), answered, `${label}: the requests`)
    assert.equal(run.toasts.length, 1, `${label}: the person is told`)
    assert.deepEqual(run.toasts[0], { title: 'This chat could not be opened', description: 'Check your connection and reload the page to try again.', variant: 'destructive' }, `${label}: and told only that (nothing about any account)`)
    assert.equal(run.latest.isLoadingSession, false, `${label}: the loading screen is over`)
  }
}])
cases.push(['P3: the caller\'s own id and an id nobody has behave as before: the same requests, socket, URL and state as the base hook (own id, new id, a failed adoption, bare /builder, session_id=new)', async sources => {
  const baseBuilder = baseOf('hooks/use-builder-session.ts')
  for (const [name, options] of Object.entries(pageCases)) {
    if (name.startsWith('a foreign id') || options.noBaseTrace) continue
    const now = await runPage({ ...sources, ...options })
    const before = await runPage({ ...sources, builderSource: baseBuilder, ...options })
    assert.equal(traceOf(now), traceOf(before), `${name}: the trace is the base hook's`)
  }
  const own = await runPage({ ...sources, ...pageCases['an id that is the caller\'s own, with a row'] })
  assert.deepEqual(own.sockets, [OWN_ID]); assert.deepEqual(own.navigation, []); assert.deepEqual(own.calls.map(c => `${c.method} ${c.status}`), ['GET 200'])
  const fresh = await runPage({ ...sources, ...pageCases['an id nobody has (adopted: the row is created for it)'] })
  assert.equal(fresh.page.currentSessionId, FRESH_ID); assert.deepEqual(fresh.sockets, [FRESH_ID]); assert.deepEqual(fresh.navigation, []); assert.equal(fresh.world.rows.get(FRESH_ID)?.userId, CALLER.id)
}])
cases.push(['P3: session hygiene on is untouched: a foreign id is still "not found" with no write and no socket (it never reaches the adoption branch)', async sources => {
  const run = await runPage({ ...sources, url: `/builder?session_id=${FOREIGN_ID}`, hygiene: true })
  assert.equal(run.problem?.kind, 'not_found')
  assert.deepEqual(run.sockets, []); assert.deepEqual(run.navigation, [])
  assert.deepEqual(run.calls.map(c => `${c.method} ${c.url} ${c.status}`), [`GET /api/sessions/${FOREIGN_ID} 403`], 'one lookup, no create, nothing else')
}])
cases.push(['P3: createSessionWasRefused says "refused" only for an id whose latest create was answered 404 (another id, a later answer, a call with no answer, any other status: no; each id has its own mark)', async ({ hookSource }) => {
  let script = []
  const quiet = () => {}
  const exports = evaluate(hookSource, 'hooks/use-chat-sessions.ts', {
    react: { useState: initial => [initial, () => {}], useCallback: fn => fn },
    '@/lib/studio-session-hygiene': { sessionLoadKindForStatus: () => 'error' },
    '@/lib/studio-blank-start-new-session': { STUDIO_BLANK_START_NEW_SESSION_ENABLED: false, browserBlankStartStorage: () => null, forgetBlankStartEverywhere: () => {} },
  }, { fetch: async () => { const next = script.shift(); if (next === 'network') throw new TypeError('Failed to fetch'); return responseOf(next, next >= 200 && next < 300 ? { session: { id: 'x' } } : { error: 'e' }) }, setTimeout: fn => { fn(); return 0 }, console: { log: quiet, warn: quiet, error: quiet, info: quiet, debug: quiet } })
  const hook = exports.useChatSessions()
  const refused = exports.createSessionWasRefused
  assert.equal(refused(OWN_ID), false, 'before any call')
  script = [404]; assert.equal(await hook.createSession(OWN_ID), null); assert.equal(refused(OWN_ID), true, 'a 404 for that id'); assert.equal(refused(FRESH_ID), false, 'another id')
  script = [201]; assert.notEqual(await hook.createSession(OWN_ID), null); assert.equal(refused(OWN_ID), false, 'the next answer for that id replaces it')
  script = [404]; await hook.createSession(OWN_ID); script = ['network']; assert.equal(await hook.createSession(OWN_ID), null); assert.equal(refused(OWN_ID), false, 'a call that got no answer leaves no old refusal behind')
  script = [404]; await hook.createSession(OWN_ID); script = [404]; await hook.createSession(FRESH_ID); assert.equal(refused(OWN_ID), true, 'a call for another id leaves this id\'s mark alone (two creates in flight)'); assert.equal(refused(FRESH_ID), true)
  script = [201]; await hook.createSession(FRESH_ID); assert.equal(refused(FRESH_ID), false); assert.equal(refused(OWN_ID), true)
  for (const status of [400, 401, 403, 409, 429, 500, 502, 503]) { script = [status]; assert.equal(await hook.createSession(OWN_ID), null); assert.equal(refused(OWN_ID), false, `a ${status} is not a refusal as another account's chat`) }
}])

// ================================================================================================================================
// FOLLOW-UP 2 (13 Nov, REVIEW-1's P2 on #629 and DIRECTOR-2's 17:10Z note): through the Builder the Director socket never opens on a session id the caller does not own, or that is not
// confirmed new or the caller's own. (a) A slow start: the page's chat id starts as the URL's id, the 10 s loading safety net ends "loading" whatever is in flight, and the connection
// effect used to open the socket as soon as loading was over. (b) A failed create that is not a 404 (a 500, no answer) kept the URL's id and connected on it. Now the connection effect also waits
// for "this id has been checked" (the caller's own row answered 200, the create for it answered 2xx, or a local id this tab minted). The runs below RUN the safety net (the harness above no
// longer drops timers of 5 s or more: a script fires them) with the history requests held back, and assert the socket log at every step.
// (c) The ws-token mint: it already refuses another account's chat id before it signs (route.ts, `existingSession.userId !== session.user.id` -> 403); no route change, the cases below prove it.
// ================================================================================================================================
const neverOn = (sockets, id, label) => assert.equal(sockets.includes(id), false, `${label}: the Director socket was opened on ${id === FOREIGN_ID ? 'the other account\'s id' : id}`)
const callLine = c => `${c.method} ${c.url.replace(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, id => (id === OWN_ID ? '<own>' : id === FOREIGN_ID ? '<foreign>' : id === FRESH_ID ? '<fresh>' : '<local>'))} ${c.status}`

cases.push(['follow-up 2 (a): a slow start on another account\'s id: the 10 s safety net ends "loading" with the requests still in flight and the socket does NOT open on the foreign id at any step; it opens once, on the fresh id, after the swap', async sources => {
  const steps = []
  const run = await runPage({ ...sources, url: `/builder?session_id=${FOREIGN_ID}`, slow: true, script: async ctl => {
    assert.equal(ctl.pending(), 1, 'the first lookup is in flight')
    await ctl.fireSafetyNet()
    steps.push(['after the safety net', ctl.snapshot()])
    assert.equal(ctl.snapshot().loading, false, 'the safety net ended "loading": the proof really runs it')
    assert.equal(ctl.pending(), 1, 'and the lookup is still in flight')
    for (let n = 0; ctl.pending() > 0 && n < 8; n++) { await ctl.release(); steps.push([`after answer ${n + 1}`, ctl.snapshot()]) }
  } })
  assert.deepEqual(steps[0][1].sockets, [], 'nothing connected while the id was unchecked, with loading over')
  for (const [label, snapshot] of steps) neverOn(snapshot.sockets, FOREIGN_ID, label)
  const minted = run.page.currentSessionId
  assert.match(minted, UUID_ONLY); assert.notEqual(minted, FOREIGN_ID)
  assert.deepEqual(run.sockets, [minted], 'the socket opened once, on the fresh id')
  assert.deepEqual(run.calls.map(callLine), [`GET /api/sessions/<foreign> 403`, 'POST /api/sessions 404', 'POST /api/sessions 201'], 'the same three requests as a fast start')
  assert.deepEqual(run.navigation, [{ kind: 'replace', href: `/builder?session_id=${minted}` }])
}])
cases.push(['follow-up 2 (a): a slow start on the caller\'s own id: no socket while the lookup is in flight (loading over), then one socket on that id when the lookup answers; the base hook opens it at the safety net, before the answer', async sources => {
  const seen = {}
  const run = await runPage({ ...sources, url: `/builder?session_id=${OWN_ID}`, slow: true, script: async ctl => {
    await ctl.fireSafetyNet(); seen.atNet = ctl.sockets(); seen.loading = ctl.snapshot().loading
    await ctl.releaseAll()
  } })
  assert.equal(seen.loading, false); assert.deepEqual(seen.atNet, [], 'no socket at the safety net')
  assert.deepEqual(run.sockets, [OWN_ID], 'one socket, on the own id, once the lookup answered')
  assert.deepEqual(run.calls.map(c => `${c.method} ${c.status}`), ['GET 200']); assert.deepEqual(run.navigation, [])
  assert.equal(run.page.isUnsavedSession, false)
  const baseSeen = {}
  await runPage({ ...sources, builderSource: baseOf('hooks/use-builder-session.ts'), url: `/builder?session_id=${OWN_ID}`, slow: true, script: async ctl => { await ctl.fireSafetyNet(); baseSeen.atNet = ctl.sockets(); await ctl.releaseAll() } })
  assert.deepEqual(baseSeen.atNet, [OWN_ID], 'the base hook connected at the safety net on an id nobody had checked: the gap this closes')
  const baseForeign = {}
  await runPage({ ...sources, builderSource: baseOf('hooks/use-builder-session.ts'), url: `/builder?session_id=${FOREIGN_ID}`, slow: true, script: async ctl => { await ctl.fireSafetyNet(); baseForeign.atNet = ctl.sockets(); await ctl.releaseAll() } })
  assert.deepEqual(baseForeign.atNet, [FOREIGN_ID], 'and on the other account\'s id: the proof can see the P2 (REVIEW-1 saw it only by reading)')
}])
cases.push(['follow-up 2 (a): a slow start on an id nobody has: no socket at the safety net, then one on that id after the create (201) that makes it the caller\'s', async sources => {
  const seen = {}
  const run = await runPage({ ...sources, url: `/builder?session_id=${FRESH_ID}`, slow: true, script: async ctl => { await ctl.fireSafetyNet(); seen.atNet = ctl.sockets(); await ctl.releaseAll() } })
  assert.deepEqual(seen.atNet, []); assert.deepEqual(run.sockets, [FRESH_ID])
  assert.deepEqual(run.calls.map(c => `${c.method} ${c.status}`), ['GET 404', 'POST 201']); assert.equal(run.world.rows.get(FRESH_ID)?.userId, CALLER.id)
}])
cases.push(['follow-up 2 (a), hygiene on: a slow start: the caller\'s own id waits for its row; another account\'s id is "not found" and never connects; a local unsaved id (its marker) connects after the 404 that says nobody has it', async sources => {
  let seen = {}
  let run = await runPage({ ...sources, url: `/builder?session_id=${OWN_ID}`, hygiene: true, slow: true, script: async ctl => { await ctl.fireSafetyNet(); seen.atNet = ctl.sockets(); await ctl.releaseAll() } })
  assert.deepEqual(seen.atNet, []); assert.deepEqual(run.sockets, [OWN_ID])
  seen = {}; run = await runPage({ ...sources, url: `/builder?session_id=${FOREIGN_ID}`, hygiene: true, slow: true, script: async ctl => { await ctl.fireSafetyNet(); seen.atNet = ctl.sockets(); await ctl.releaseAll() } })
  assert.deepEqual(seen.atNet, []); assert.deepEqual(run.sockets, []); assert.equal(run.problem?.kind, 'not_found')
  seen = {}; run = await runPage({ ...sources, url: `/builder?session_id=${FRESH_ID}`, hygiene: true, slow: true, seedStorage: storage => storage.setItem(unsavedKey(FRESH_ID), 'true'), script: async ctl => { await ctl.fireSafetyNet(); seen.atNet = ctl.sockets(); await ctl.releaseAll() } })
  assert.deepEqual(seen.atNet, []); assert.deepEqual(run.sockets, [FRESH_ID]); assert.equal(run.page.isUnsavedSession, true)
}])
cases.push(['follow-up 2 (b): the create fails with a 500 or no answer on another account\'s id too: the id is kept as before, and the socket never opens on it, with the safety net run or not', async sources => {
  for (const options of [{ postFaults: 1 }, { postNetworkFaults: 1 }]) {
    const quick = await runPage({ ...sources, url: `/builder?session_id=${FOREIGN_ID}`, ...options })
    assert.deepEqual(quick.sockets, []); assert.equal(quick.toasts.length, 1); assert.equal(quick.page.currentSessionId, FOREIGN_ID); assert.deepEqual(quick.navigation, [])
    assert.equal(quick.world.rows.get(FOREIGN_ID).userId, VICTIM.id, 'the other account\'s row is untouched')
    const steps = []
    const slow = await runPage({ ...sources, url: `/builder?session_id=${FOREIGN_ID}`, slow: true, ...options, script: async ctl => { await ctl.fireSafetyNet(); steps.push(ctl.sockets()); for (let n = 0; ctl.pending() > 0 && n < 8; n++) { await ctl.release(); steps.push(ctl.sockets()) } } })
    for (const seen of steps) assert.deepEqual(seen, [], 'no socket at any step')
    assert.deepEqual(slow.sockets, []); assert.equal(slow.toasts.length, 1)
  }
}])
cases.push(['follow-up 2: the starts that must not change keep the base hook\'s trace and make no sound: a bare /builder whose create fails (the local id this tab minted still connects, no toast), a deleted chat of the caller\'s, hygiene on with an own id, a local unsaved id or a staged hand-off', async sources => {
  const baseBuilder = baseOf('hooks/use-builder-session.ts')
  for (const name of ['a bare /builder whose create for the minted local id answers 500', 'a deleted chat of the caller\'s own (loadSession answers null for it: the adoption path, the row is the caller\'s)', 'hygiene on: the caller\'s own id', 'hygiene on: a local unsaved id this tab minted (its unsaved marker; no row under any account)', 'hygiene on: a staged hand-off id (the row is created for it)']) {
    const options = pageCases[name]
    assert.ok(options, name)
    const now = await runPage({ ...sources, ...options })
    const before = await runPage({ ...sources, builderSource: baseBuilder, ...options })
    assert.equal(traceOf(now), traceOf(before), `${name}: the trace is the base hook's`)
    assert.equal(now.toasts.filter(t => t?.title === 'This chat could not be opened').length, 0, `${name}: no "could not be opened" word`)
    assert.ok(now.sockets.length >= 1, `${name}: it still connects`)
  }
  const staged = await runPage({ ...sources, ...pageCases['hygiene on: a staged hand-off id (the row is created for it)'] })
  assert.deepEqual(staged.sockets, [FRESH_ID]); assert.equal(staged.world.rows.get(FRESH_ID)?.userId, CALLER.id)
  const bare = await runPage({ ...sources, ...pageCases['a bare /builder whose create for the minted local id answers 500'] })
  assert.equal(bare.sockets.length, 1); assert.match(bare.sockets[0], UUID_ONLY); assert.equal(bare.page.isUnsavedSession, true)
}])
cases.push(['follow-up 2 (hygiene on): a staged hand-off id whose create fails (500, no answer): kept unsaved as before, no socket on it, the person is told', async sources => {
  for (const options of [{ postFaults: 1 }, { postNetworkFaults: 1 }]) {
    const run = await runPage({ ...sources, ...pageCases['hygiene on: a staged hand-off id (the row is created for it)'], ...options })
    assert.deepEqual(run.sockets, []); assert.equal(run.page.currentSessionId, FRESH_ID); assert.equal(run.page.isUnsavedSession, true); assert.equal(run.toasts.length, 1)
  }
}])
cases.push(['follow-up 2: client navigation inside the Builder: the page keeps its own connected chat while another account\'s id is checked (slowly) and is never connected to it; an id whose create fails is held too (the hold is not only the first URL id)', async sources => {
  const seen = {}
  const run = await runPage({ ...sources, url: `/builder?session_id=${OWN_ID}`, script: async ctl => {
    assert.deepEqual(ctl.sockets(), [OWN_ID], 'the own chat connected')
    await ctl.slow(true)
    await ctl.navigate(`/builder?session_id=${FOREIGN_ID}`)
    await ctl.fireSafetyNet(); seen.duringForeign = ctl.sockets(); seen.idDuringForeign = ctl.snapshot().id
    await ctl.slow(false)
    seen.afterForeign = ctl.sockets(); seen.idAfterForeign = ctl.snapshot().id
  } })
  assert.deepEqual(seen.duringForeign, [OWN_ID], 'no new socket while the foreign id is unchecked'); assert.equal(seen.idDuringForeign, OWN_ID, 'the page still holds its own id')
  assert.equal(seen.afterForeign.length, 2); assert.equal(seen.afterForeign[0], OWN_ID); assert.match(seen.afterForeign[1], UUID_ONLY); neverOn(seen.afterForeign, FOREIGN_ID, 'after the swap')
  assert.equal(seen.idAfterForeign, seen.afterForeign[1])
  assert.deepEqual(run.sockets, seen.afterForeign)
  const failed = await runPage({ ...sources, url: `/builder?session_id=${OWN_ID}`, postFaults: 1, script: async ctl => {
    assert.deepEqual(ctl.sockets(), [OWN_ID])
    await ctl.navigate(`/builder?session_id=${OTHER_FRESH_ID}`)
  } })
  assert.equal(failed.page.currentSessionId, OTHER_FRESH_ID, 'the page moved to the id in the URL (unsaved, as before)')
  assert.deepEqual(failed.sockets, [OWN_ID], 'and no socket opened on it: the hold follows the id the failed create left as current, not only the first URL id')
  assert.equal(failed.toasts.length, 1)
}])

// ---- (c) the ws-token mint: the REAL route, signing only for the caller's own or a new id --------------------------------------------------
const nodeCrypto = nodeRequire('node:crypto')
function loadMint(source, { rows, userId = CALLER.id, lookupError = null, signedIn = true, signingKey = 'proof-only-hmac-key' }) {
  const reads = []
  const prisma = { chatSession: { findUnique: async args => { reads.push(plain(args)); if (lookupError) throw lookupError; return rows.get(args.where.id) ?? null } }, user: { findUnique: async () => ({ tier: 'free' }) } }
  const quiet = () => {}
  const exports = evaluate(source, 'app/api/director/ws-token/route.ts', {
    crypto: nodeCrypto,
    'next/server': { NextRequest: class {}, NextResponse },
    'next-auth': { getServerSession: async () => (signedIn ? { user: { id: userId } } : null) },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/kg-entitlement': { isKgEntitled: () => false },
    '@/lib/prisma': { prisma },
    '@/lib/quota/build-quota': { isWsBqClaimEnabled: () => false },
    '@/lib/quota/build-quota-claim': { mintBuildQuotaClaim: async () => null },
    '@/lib/stripe/stripe-utils': { getUserSubscription: async () => null },
    '@/lib/api-hardening': { requireApprovedUser: async () => null },
  }, { Buffer, console: { log: quiet, warn: quiet, error: quiet, info: quiet, debug: quiet }, process: { env: { DIRECTOR_WS_AUTH_SECRET: signingKey } } })
  const get = async sessionId => {
    const res = await exports.GET({ nextUrl: { searchParams: new URLSearchParams(sessionId === undefined ? '' : { session_id: sessionId }) } })
    return { status: res.status, body: plain(res.body) }
  }
  const claims = body => { const [payload, signature] = String(body.auth_token).split('.'); assert.equal(nodeCrypto.createHmac('sha256', signingKey).update(payload).digest('base64url'), signature, 'a real signature'); return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) }
  return { get, reads, claims }
}
const mintRows = () => new Map([[OWN_ID, fullRow(OWN_ID, CALLER)], [FOREIGN_ID, fullRow(FOREIGN_ID, VICTIM)], [DELETED_ID, fullRow(DELETED_ID, CALLER, { status: 'deleted' })]])

cases.push(['mint (c): another account\'s chat id is refused (403, a generic body) before anything is signed, with exactly one read of the row by id and nothing about its owner', async ({ mintSource }) => {
  for (const owner of [VICTIM, { id: 'user-other' }]) for (const status of ['active', 'archived', 'deleted']) {
    const rows = mintRows(); rows.set(FOREIGN_ID, fullRow(FOREIGN_ID, owner, { status }))
    const { get, reads } = loadMint(mintSource, { rows })
    const res = await get(FOREIGN_ID)
    assert.deepEqual(res, { status: 403, body: { error: 'Forbidden' } }, `owner ${owner.id}, status ${status}`)
    assert.equal(JSON.stringify(res).includes('auth_token'), false); assert.equal(JSON.stringify(res).includes(owner.id), false, 'no owner in the answer')
    assert.deepEqual(reads, [{ where: { id: FOREIGN_ID }, select: { userId: true, status: true } }], 'one read, by id, selecting only the owner and the status')
  }
}])
cases.push(['mint (c): the caller\'s own id and an id with no row are signed (sub is the caller, sid is the id asked for); a deleted own chat is 410; a failed lookup is 503 and signs nothing', async ({ mintSource }) => {
  const own = loadMint(mintSource, { rows: mintRows() })
  const signed = await own.get(OWN_ID)
  assert.equal(signed.status, 200); assert.equal(signed.body.auth_enabled, true)
  const claims = own.claims(signed.body)
  assert.equal(claims.sub, CALLER.id); assert.equal(claims.sid, OWN_ID); assert.ok(claims.exp > claims.iat)
  assert.equal(own.reads.length, 1)
  const fresh = loadMint(mintSource, { rows: mintRows() })
  const minted = await fresh.get(FRESH_ID)
  assert.equal(minted.status, 200); assert.equal(fresh.claims(minted.body).sid, FRESH_ID); assert.equal(fresh.reads.length, 1)
  assert.deepEqual(await loadMint(mintSource, { rows: mintRows() }).get(DELETED_ID), { status: 410, body: { error: 'Session is deleted' } })
  const broken = loadMint(mintSource, { rows: mintRows(), lookupError: new Error('database down') })
  assert.deepEqual(await broken.get(OWN_ID), { status: 503, body: { error: 'Could not verify session ownership' } })
  assert.deepEqual(await broken.get(FOREIGN_ID), { status: 503, body: { error: 'Could not verify session ownership' } }, 'a failed lookup never falls through to a signature')
}])
cases.push(['mint (c): signed out is 401 and a missing session_id is 400, each before any read of a row', async ({ mintSource }) => {
  const out = loadMint(mintSource, { rows: mintRows(), signedIn: false })
  assert.deepEqual(await out.get(OWN_ID), { status: 401, body: { error: 'Unauthorized' } }); assert.equal(out.reads.length, 0)
  const none = loadMint(mintSource, { rows: mintRows() })
  assert.deepEqual(await none.get(undefined), { status: 400, body: { error: 'session_id is required' } }); assert.deepEqual(await none.get('  '), { status: 400, body: { error: 'session_id is required' } }); assert.equal(none.reads.length, 0)
}])
cases.push(['mint (c), the client side: the socket hook asks for the token with the id it is about to open (session_id) and opens no socket when the mint does not answer 2xx (it retries instead), so a 403 for another account\'s id is no socket at all where the route signs', async ({ wsHookSource }) => {
  assert.ok(wsHookSource.includes('`/api/director/ws-token?session_id=${encodeURIComponent(socketSessionId)}`'), 'the start-of-connection request names the session')
  const refusal = wsHookSource.indexOf("if (!tokenResponse.ok) {\n              return { ok: false, reason: `ws-token HTTP ${tokenResponse.status}` };")
  const gate = wsHookSource.indexOf('if (!tokenOutcome.ok) {')
  const open = wsHookSource.indexOf('ws = protocols ? new WebSocket(wsUrl, protocols) : new WebSocket(wsUrl);')
  assert.ok(refusal > 0 && gate > refusal && open > gate, 'a non-2xx answer becomes { ok: false }, which returns before the socket is built')
  assert.match(wsHookSource.slice(gate, open), /scheduleReconnect\('ws_token_failed'\);\s*return;/)
}])

async function runSuite(sources) {
  const failures = []
  for (const [name, fn] of cases) {
    try { await fn(sources) } catch (error) { failures.push(`${name}: ${String(error?.message ?? error).split('\n')[0]}`) }
  }
  return failures
}

// ---- real sources ---------------------------------------------------------------------------------------------------------------
const real = { routeSource: read('app/api/sessions/route.ts'), hookSource: read('hooks/use-chat-sessions.ts'), builderSource: read('hooks/use-builder-session.ts'), mintSource: read('app/api/director/ws-token/route.ts'), wsHookSource: read('hooks/use-deckster-websocket-v2.ts') }
const realFailures = await runSuite(real)
assert.deepEqual(realFailures, [], `the real sources fail the proof:\n  ${realFailures.join('\n  ')}`)

// ---- mutants: each must be caught ---------------------------------------------------------------------------------------------
const swap = (key, from, to) => ({ ...real, [key]: (() => { assert.equal(real[key].split(from).length, 2, `mutant text must be there once: ${from}`); return real[key].replace(from, () => to) })() })
const mutants = {
  'the owner check is removed': swap('routeSource', 'existing.userId !== user.id', 'false'),
  'the owner check is inverted': swap('routeSource', 'existing.userId !== user.id', 'existing.userId === user.id'),
  'the owner check compares the e-mail, not the id': swap('routeSource', 'existing.userId !== user.id', 'existing.userId !== session.user.email'),
  'the whole row is answered again (own id)': swap('routeSource', 'pickAllowedKeys(existing, SESSION_CREATE_RESPONSE_KEYS)', 'existing'),
  'the whole row is answered again (201)': swap('routeSource', 'pickAllowedKeys(newSession, SESSION_CREATE_RESPONSE_KEYS)', 'newSession'),
  'the allow-list is widened by userId': swap('routeSource', "['id', 'geminiStoreName'] as const", "['id', 'geminiStoreName', 'userId'] as const"),
  'the allow-list is widened by the presentation url': swap('routeSource', "['id', 'geminiStoreName'] as const", "['id', 'geminiStoreName', 'finalPresentationUrl'] as const"),
  'the allow-list loses the store name the Builder reads': swap('routeSource', "['id', 'geminiStoreName'] as const", "['id'] as const"),
  'the own id is answered 409 again': swap('routeSource', "{ session: pickAllowedKeys(existing, SESSION_CREATE_RESPONSE_KEYS) },\n        { status: 200 }", "{ error: 'Session already exists', session: pickAllowedKeys(existing, SESSION_CREATE_RESPONSE_KEYS) },\n        { status: 409 }"),
  'the foreign path makes an extra database round trip': swap('routeSource', "      if (existing.userId !== user.id) {\n", "      if (existing.userId !== user.id) {\n        await prisma.chatSession.findUnique({ where: { id: sessionId } });\n"),
  'the foreign path writes a row under the caller': swap('routeSource', "      if (existing.userId !== user.id) {\n", "      if (existing.userId !== user.id) {\n        await prisma.chatSession.create({ data: { id: sessionId, userId: user.id, title: null, currentStage: 1, status: 'active' } });\n"),
  'the foreign answer carries the owner in a message': swap('routeSource', "{ error: 'Session not found' },\n          { status: 404 }", "{ error: 'Session belongs to another user' },\n          { status: 404 }"),
  'the foreign answer is a 403 (the [id] routes\' pattern: it names the id as taken)': swap('routeSource', "{ error: 'Session not found' },\n          { status: 404 }", "{ error: 'Forbidden' },\n          { status: 403 }"),
  'the foreign answer is a 409 with a row': swap('routeSource', "{ error: 'Session not found' },\n          { status: 404 }", "{ error: 'Session already exists', session: existing },\n          { status: 409 }"),
  'the account id is logged when the user is created (P3)': swap('routeSource', "console.log('[Session Create] ✅ User created successfully');", "console.log('[Session Create] ✅ User created successfully:', user.id);"),
  'the account id is logged when the user is found (P3)': swap('routeSource', "console.log('[Session Create] ✅ User found in database');", "console.log('[Session Create] ✅ User found in database:', user.id);"),
  'the chat id is logged when the body is read (P3)': swap('routeSource', "console.log('[Session Create] Session ID given:', !!sessionId);", "console.log('[Session Create] Session ID:', sessionId);"),
  'the chat id is logged on a refusal (P3)': swap('routeSource', "console.warn('[Session Create] ⚠️ Session id belongs to another user, refused');", "console.warn('[Session Create] ⚠️ Session id belongs to another user, refused:', sessionId);"),
  'the chat id is logged when the own row is found (P3)': swap('routeSource', "console.log('[Session Create] ⚠️ Session already exists (the caller\\'s own)');", "console.log('[Session Create] ⚠️ Session already exists:', sessionId);"),
  'the chat id is logged in the Data line again (P3)': swap('routeSource', "console.log('[Session Create] Data:', {\n      hasTitle: !!title,", "console.log('[Session Create] Data:', {\n      id: sessionId,\n      hasTitle: !!title,"),
  'the account id is logged in the Data line again (P3)': swap('routeSource', "console.log('[Session Create] Data:', {\n      hasTitle: !!title,", "console.log('[Session Create] Data:', {\n      userId: user.id,\n      hasTitle: !!title,"),
  'the chat id is logged when the row is created (P3)': swap('routeSource', "console.log('[Session Create] ✅ Chat session created successfully');", "console.log('[Session Create] ✅ Chat session created successfully:', newSession.id);"),
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
  'the client adopts a 409 row again (createSession)': swap('hookSource', "      if (!response.ok) {\n        // Try to get error details from response", "      if (response.status === 409) return (await response.json()).session;\n\n      if (!response.ok) {\n        // Try to get error details from response"),
  'the client treats any 409 as recovered again (ensureSessionRow)': swap('hookSource', 'if (response.ok) { // POST /api/sessions', 'if (response.ok || response.status === 409) { // POST /api/sessions'),
  // the follow-up: a refused URL id is replaced by a fresh one
  'P3: the refusal branch is gone (the foreign id is kept as an unsaved session again)': swap('builderSource', 'if (!adopted && createSessionWasRefused(sessionParam)) {', 'if (false) {'),
  'P3: any failed adoption mints a new id, not only a refusal': swap('builderSource', 'if (!adopted && createSessionWasRefused(sessionParam)) {', 'if (!adopted) {'),
  'P3: the URL is pushed, not replaced (Back would return to the foreign id)': swap('builderSource', 'router.replace(getInitializedBuilderHref(searchParams, ownSessionId,', 'router.push(getInitializedBuilderHref(searchParams, ownSessionId,'),
  'P3: the fresh id gets no row': swap('builderSource', 'const ownRow = await createSession(ownSessionId)', 'const ownRow = null'),
  'P3: the page keeps the foreign id as its current id (the socket opens on it)': swap('builderSource', 'setCurrentSessionId(ownSessionId)', 'setCurrentSessionId(sessionParam)'),
  'P3: the "fresh" id is the foreign id': swap('builderSource', 'const ownSessionId = crypto.randomUUID()', 'const ownSessionId = sessionParam'),
  'P3: the URL change loads the fresh id again': swap('builderSource', 'lastLoadedSessionRef.current = ownSessionId', 'lastLoadedSessionRef.current = null'),
  'P3: the fresh session is never marked saved': swap('builderSource', 'setIsUnsavedSession(!ownRow)', 'setIsUnsavedSession(true)'),
  'P3: a fresh id with no row leaves no unsaved marker': swap('builderSource', "else sessionStorage.setItem(unsavedBuilderSessionKey(builderCacheOwner, ownSessionId), 'true')", 'else {}'),
  'P3: the fresh id is not recorded as a local fresh assignment': swap('builderSource', "              recordStudioFreshAssignment(ownSessionId, { kind: 'local_uuid', generatedSessionId: ownSessionId }) // SESSIONS-OWNER\n", ''),
  'P3: the branch falls through to the adoption below (it puts the foreign id back)': swap('builderSource', "              return // SESSIONS-OWNER\n            } // SESSIONS-OWNER", '            } // SESSIONS-OWNER'),
  'P3: the refusal is never recorded by the chat hook': swap('hookSource', 'if (response.status === 404) refusedCreateIds.add(sessionId);', 'if (false) refusedCreateIds.add(sessionId);'),
  'P3: any 4xx or 5xx counts as a refusal': swap('hookSource', 'if (response.status === 404) refusedCreateIds.add(sessionId);', 'if (response.status >= 400) refusedCreateIds.add(sessionId);'),
  'P3: a 403 counts as a refusal': swap('hookSource', 'if (response.status === 404) refusedCreateIds.add(sessionId);', 'if (response.status === 404 || response.status === 403) refusedCreateIds.add(sessionId);'),
  'P3: the refusal is not tied to the id asked about': swap('hookSource', 'return refusedCreateIds.has(sessionId);', 'return refusedCreateIds.size > 0;'),
  'P3: an old refusal survives a later call for the same id': swap('hookSource', '      refusedCreateIds.delete(sessionId); // SESSIONS-OWNER\n', ''),
  // follow-up 2 (a) and (b): the connection effect waits for the id to be checked
  'follow-up 2: the follow-up\'s own insertions are all gone (the hook as #629 left it: the socket opens as soon as loading is over)': { ...real, builderSource: strip.SESSIONS_OWNER_PAIRS['hooks/use-builder-session.ts'].slice(2).reduce((out, [now]) => { assert.equal(out.split(now).length, 2, 'each follow-up 2 insertion is there once'); return out.replace(now, () => '') }, real.builderSource) },
  'follow-up 2: the connection effect does not wait for the check': swap('builderSource', 'if (ownerUnconfirmedId && currentSessionId === ownerUnconfirmedId) return', 'if (false) return'),
  'follow-up 2: the wait ends with "loading" (the 10 s safety net lets the socket open again)': swap('builderSource', 'if (ownerUnconfirmedId && currentSessionId === ownerUnconfirmedId) return', 'if (ownerUnconfirmedId && currentSessionId === ownerUnconfirmedId && isLoadingSession) return'),
  'follow-up 2: the URL\'s first id is not held (only ids a failed create left are)': swap('builderSource', 'useState<string | null>(() => currentSessionId)', 'useState<string | null>(() => null)'),
  'follow-up 2: the effect does not run again when the id is confirmed': swap('builderSource', '    ownerUnconfirmedId, // SESSIONS-OWNER\n', ''),
  'follow-up 2: the caller\'s own row (found) never confirms the id': swap('builderSource', 'confirmSessionOwner(sessionParam) // SESSIONS-OWNER (found)', 'void 0 // SESSIONS-OWNER (found)'),
  'follow-up 2: a 2xx create (adopted) never confirms the id': swap('builderSource', 'confirmSessionOwner(adopted.id) // SESSIONS-OWNER (adopted)', 'void 0 // SESSIONS-OWNER (adopted)'),
  'follow-up 2: a local unsaved id this tab minted (hygiene on) never confirms the id': swap('builderSource', 'confirmSessionOwner(sessionParam) // SESSIONS-OWNER (local id)', 'void 0 // SESSIONS-OWNER (local id)'),
  'follow-up 2: a failed create does not hold the id it left as current': swap('builderSource', 'setOwnerUnconfirmedId(sessionParam) // SESSIONS-OWNER (adoption failed, a URL id)', 'void 0 // SESSIONS-OWNER (adoption failed, a URL id)'),
  'follow-up 2: a failed create says nothing to the person': swap('builderSource', "toast({ title: 'This chat could not be opened',", "void ({ title: 'This chat could not be opened',"),
  'follow-up 2: a failed create on a local id this tab minted is held too (the bare /builder start loses its socket and gets the word)': swap('builderSource', 'if (freshStageAssignmentRef.current?.sessionId === sessionParam) confirmSessionOwner(sessionParam)', 'if (false) confirmSessionOwner(sessionParam)'),
  'follow-up 2: a failed create on a URL id counts as confirmed (the socket opens on it)': swap('builderSource', 'if (freshStageAssignmentRef.current?.sessionId === sessionParam) confirmSessionOwner(sessionParam)', 'if (true) confirmSessionOwner(sessionParam)'),
  // follow-up 2 (c): the mint (unchanged route) and the socket hook's side of it
  'mint: the owner check is removed': swap('mintSource', 'existingSession.userId !== session.user.id', 'false'),
  'mint: the owner check is inverted': swap('mintSource', 'existingSession.userId !== session.user.id', 'existingSession.userId === session.user.id'),
  'mint: the owner check compares the e-mail': swap('mintSource', 'existingSession.userId !== session.user.id', 'existingSession.userId !== session.user.email'),
  'mint: the refusal names the owner': swap('mintSource', "return NextResponse.json({ error: 'Forbidden' }, { status: 403 })", "return NextResponse.json({ error: 'Forbidden', owner: existingSession.userId }, { status: 403 })"),
  'mint: a failed lookup falls through to a signature': swap('mintSource', "    return NextResponse.json(\n      { error: 'Could not verify session ownership' },\n      { status: 503 },\n    )\n", ''),
  'mint: the lookup reads more than the owner and the status': swap('mintSource', 'select: { userId: true, status: true },', 'select: { userId: true, status: true, title: true },'),
  'mint: a second read of the row': swap('mintSource', '    const existingSession = await prisma.chatSession.findUnique({', '    await prisma.chatSession.findUnique({ where: { id: sessionId }, select: { userId: true } })\n    const existingSession = await prisma.chatSession.findUnique({'),
  'mint: a deleted own chat is signed': swap('mintSource', "existingSession?.status === 'deleted'", 'false'),
  'socket hook: a failed token goes on to build the socket': swap('wsHookSource', "scheduleReconnect('ws_token_failed');\n          return;", "scheduleReconnect('ws_token_failed');"),
  'socket hook: the token request does not name the session': swap('wsHookSource', '`/api/director/ws-token?session_id=${encodeURIComponent(socketSessionId)}`', "'/api/director/ws-token'"),
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
// the follow-up's edits to the two hooks are PURE INSERTIONS, each line marked SESSIONS-OWNER (a whole token): older proofs hold every base line of these files, in order
const markerProblems = pairs => pairs.filter(([, before]) => before === '').flatMap(([now]) => now.split('\n').filter(line => line.trim() && !strip.SESSIONS_OWNER_MARKER_RE.test(line)))
assert.ok(strip.SESSIONS_OWNER_MARKER_RE.test('x // SESSIONS-OWNER: y') && !strip.SESSIONS_OWNER_MARKER_RE.test('x // SESSIONS-OWNER-X') && !strip.SESSIONS_OWNER_MARKER_RE.test('x // X-SESSIONS-OWNER'), 'the marker is a whole token')
assert.deepEqual(strip.SESSIONS_OWNER_INSERTED_FILES, ['hooks/use-builder-session.ts', 'hooks/use-chat-sessions.ts'])
assert.ok(strip.SESSIONS_OWNER_PAIRS['hooks/use-builder-session.ts'].length >= 2 && strip.SESSIONS_OWNER_PAIRS['hooks/use-builder-session.ts'].every(([, before]) => before === ''), 'the builder hook: every pair is an insertion (empty base text)')
assert.equal(strip.SESSIONS_OWNER_PAIRS['hooks/use-chat-sessions.ts'].filter(([, before]) => before === '').length, 3, 'the chat hook: this follow-up adds three insertions to the two edits of the change itself')
for (const rel of strip.SESSIONS_OWNER_INSERTED_FILES) assert.deepEqual(markerProblems(strip.SESSIONS_OWNER_PAIRS[rel]), [], `${rel}: every inserted line carries the marker`)
assert.ok(markerProblems([['// SESSIONS-OWNER: a\nunmarked();\n', '']]).length === 1, 'an unmarked inserted line is caught')
for (const rel of strip.SESSIONS_OWNER_INSERTED_FILES) {
  const lines = read(rel).split('\n'), baseLines = baseOf(rel).split('\n')
  const marked = lines.filter(line => strip.SESSIONS_OWNER_MARKER_RE.test(line))
  assert.ok(marked.length > 0 && baseLines.every(line => !strip.SESSIONS_OWNER_MARKER_RE.test(line)), `${rel}: the marker is this follow-up's alone (no base line carries it)`)
}
// the Builder page is not touched (the socket's id comes from it: existingSessionId follows currentSessionId and a URL id does not auto-connect), and the page still hands the socket hook what the proof ran
const PAGE = 'app/builder/page.tsx'
assert.equal(others(PAGE, read(PAGE)), others(PAGE, baseOf(PAGE)), 'app/builder/page.tsx is the base\'s file (this follow-up does not touch it)')
const pageText = read(PAGE)
for (const line of ['    autoConnect: features.immediateConnection && !currentSessionId,', '    existingSessionId: currentSessionId || undefined,', '  const { loadSession, loadSessionResult, createSession } = useChatSessions()']) assert.equal(pageText.split(line + '\n').length, 2, `the page keeps: ${line.trim()}`)
const registry = read('scripts/studio-later-changes.mjs')
for (const [list, name] of [['LATER_CHANGE_FILES', 'SESSIONS_OWNER_SCOPE_FILES'], ['LATER_STRIPS', 'stripSessionsOwner']]) {
  const body = (registry.split(`export const ${list} = `)[1] || '').split('\n  // one line per later change, above this comment')[0]
  const mine = body.split('\n').filter(line => line.includes('LATER-CHANGE') && line.includes(`'./studio-sessions-owner-strip.mjs')).${name}`))
  assert.equal(mine.length, 1, `${list}: one marked line`)
}
assert.ok(strip.SESSIONS_OWNER_SCOPE_FILES.every(rel => LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
for (const rel of ['app/api/sessions/route.ts', 'hooks/use-chat-sessions.ts', 'scripts/test-studio-sessions-owner.mjs', 'scripts/studio-sessions-owner-strip.mjs', 'scripts/studio-later-changes.mjs', 'scripts/test-studio-deck-sync-truth.mjs', 'scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-new-deck-handoff-send.mjs', 'scripts/test-studio-session-hygiene.mjs']) assert.ok(strip.SESSIONS_OWNER_SCOPE_FILES.includes(rel), `${rel} is in scope`)
assert.equal(stripLaterChanges('.env.example', read('.env.example')), stripLaterChanges('.env.example', baseOf('.env.example')), 'no flag, no .env.example block (read through the later changes\' blocks)')

// the two older proofs that read their own first-parent commits skip a later change's by subject: this change's commits start "Sessions:"
for (const rel of ['scripts/test-studio-deck-sync-truth.mjs', 'scripts/test-studio-chat-element-edit.mjs']) assert.ok(read(rel).includes("!/^Sessions:/.test(git('log', '-1', '--format=%s', sha))"), `${rel}: skips this change's commits`)

console.log(`test-studio-sessions-owner: all checks passed (${cases.length} cases on the real route and hook, ${killed} mutants killed)`)
