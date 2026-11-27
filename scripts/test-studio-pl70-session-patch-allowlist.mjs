#!/usr/bin/env node
// PL-70 Step A proof (offline, $0): the named allowlist for PATCH /api/sessions/[id] and the store-name guard of POST /api/sessions/[id]/files, behind TWO server flags that default off
// (STUDIO_SESSION_PATCH_ALLOWLIST_SHADOW_V1_ENABLED, STUDIO_SESSION_PATCH_ALLOWLIST_V1_ENABLED), plus the owner lookup of lib/api-hardening.ts as an existence query.
//   node scripts/test-studio-pl70-session-patch-allowlist.mjs      Plain node: the REAL routes and libs are transpiled and run on stubs (an in-memory prisma, a fixed signed-in session, a minimal NextResponse, a captured console).
//   A. the four flag states: off (and every loose spelling) is exactly today; shadow writes exactly as today and logs only names and a reason code; enforce refuses; both = enforce, with no shadow line;
//   B. what the legitimate writers send is written (each recorded body), and each allowed key alone;
//   C. every refusal answers the SAME status, body bytes and headers; no 409; no field name, no "another user" in a response; nothing written; the log carries the reason and key names only;
//   D. rule P3: an id another user's session records is refused, the caller's own other session's id and an unrecorded id are not (the residual is pinned, not hidden);
//   E. the files route: the store name is write-once, shape-checked and cross-user-checked; off, shadow and enforce;
//   F. lib/api-hardening.ts: the owner lookup is an existence query (a caller with 25 rows of their own no longer pushes the other owner out of a list of 20);
//   G. canary values (a deck id, a URL, a store name, a title, a user id) never reach any log line; key names are sanitised to one line;
//   H. Class 2 (partial objects and stubs): a client without findFirst fails CLOSED in enforce (nothing written) and never breaks a shadow write; a missing env, a boolean "true", a missing policy fail closed or off;
//   I. Class 1 (source readers): the routes keep `...sessionUpdates` (flag off), carry exactly three marked lines each, call the guard before the write; the strip gives the base byte for byte; the env block and the registry lines;
//   J. scope by the commit subject; K. mutants: each is one edit of the real text, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const ts = nodeRequire('typescript')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const strip = await import('./studio-pl70-session-patch-allowlist-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const ROUTE = 'app/api/sessions/[id]/route.ts', FILES = 'app/api/sessions/[id]/files/route.ts', UPLOAD = 'app/api/upload/route.ts', HARDENING = 'lib/api-hardening.ts'
const ALLOW = 'lib/studio-session-patch-allowlist.ts', GUARD = 'lib/studio-session-patch-guard.ts', POLICY = 'lib/layout-viewer-url-policy.ts'
const ENFORCE = 'STUDIO_SESSION_PATCH_ALLOWLIST_V1_ENABLED', SHADOW = 'STUDIO_SESSION_PATCH_ALLOWLIST_SHADOW_V1_ENABLED'

let checks = 0, caught = 0
const check = async (name, fn) => { checks++; await fn(); console.log(`PASS ${name}`) }

// ---- the stack: real code on stubs -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
const compile = (code, fileName) => ts.transpileModule(code, { fileName, reportDiagnostics: false, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
function evaluate(code, fileName, deps, globals) {
  const module = { exports: {} }
  const req = (id) => { if (!Object.hasOwn(deps, id)) throw new Error(`unexpected import "${id}" in ${fileName}`); return deps[id] }
  vm.runInNewContext(compile(code, fileName), { module, exports: module.exports, require: req, URL, Date, JSON, Object, Array, Promise, Number, Boolean, String, Symbol, Map, Set, Error, TypeError, ...globals })
  return module.exports
}
class FakeResponse {
  constructor(body, init = {}) { this.bodyText = body; this.status = init.status ?? 200; this.headers = Object.fromEntries(Object.entries({ 'content-type': 'text/plain;charset=UTF-8', ...(init.headers ?? {}) }).map(([k, v]) => [k.toLowerCase(), v])) }
  static json(value, init = {}) { return new FakeResponse(JSON.stringify(value), { status: init.status ?? 200, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } }) }
  async text() { return this.bodyText }
  async json() { return JSON.parse(this.bodyText) }
}
const policyLib = evaluate(read(POLICY), POLICY, {}, {})
const LAYOUT = 'https://layout.example'
const POLICY_OBJ = policyLib.createLayoutViewerUrlPolicy(LAYOUT)
const CALLER = { id: 'user-caller', email: 'caller@mail.example' }, VICTIM = { id: 'user-victim', email: 'victim@mail.example' }
const ID = (n) => `deck-${String(n).padStart(8, '0')}-aaaa-bbbb`
const OWN = 'session-own-0001', OTHER_OWN = 'session-own-0002', VICTIM_SESSION = 'session-victim-0001'
const url = (id, extra = '') => `${LAYOUT}/p/${id}${extra}`

function makeWorld(rows = {}, { noFindFirst = false, noTransaction = false, failFileCreate = false, dropRowDuringTx = false } = {}) {
  const table = new Map(Object.entries(rows).map(([key, value]) => [key, { ...value }]))
  const world = { table, calls: [], files: [] }
  const users = new Map([[CALLER.email, CALLER], [VICTIM.email, VICTIM]])
  const matches = (row, where) => Object.entries(where).every(([key, want]) => {
    if (key === 'OR') return want.some((clause) => matches(row, clause))
    if (want && typeof want === 'object' && 'not' in want) return row[key] !== want.not
    return row[key] === want
  })
  const tick = () => Promise.resolve()
  const client = (undo) => ({
    chatSession: {
      findUnique: async ({ where }) => { await tick(); const found = table.get(where.id); return found ? { ...found } : null },
      update: async ({ where, data }) => { await tick(); world.calls.push(['update', { where, data }]); const found = table.get(where.id); const next = { ...found }; for (const [k, v] of Object.entries(data)) if (k !== 'stateCache') next[k] = v; undo.push(() => table.set(where.id, found)); table.set(where.id, next); return next },
      updateMany: async ({ where, data }) => { await tick(); world.calls.push(['updateMany', { where, data }]); let count = 0; for (const [id, found] of [...table]) if (matches(found, where)) { undo.push(() => table.set(id, found)); table.set(id, { ...found, ...data }); count++ } return { count } },
      ...(noFindFirst ? {} : { findFirst: async (args) => { await tick(); world.calls.push(['findFirst', args]); for (const found of table.values()) if (matches(found, args.where)) return { id: found.id, userId: found.userId, geminiStoreName: found.geminiStoreName, geminiStoreId: found.geminiStoreId }; return null } }),
    },
    uploadedFile: {
      count: async () => 0,
      create: async ({ data }) => { await tick(); if (failFileCreate) throw new Error('file insert failed'); const file = { id: `f${world.files.length + 1}`, uploadedAt: 'now', ...data }; world.files.push(file); undo.push(() => world.files.splice(world.files.indexOf(file), 1)); world.calls.push(['file.create', data]); return file },
      update: async ({ where, data }) => { await tick(); const file = world.files.find((f) => f.id === where.id); Object.assign(file, data); return file },
    },
  })
  world.prisma = {
    user: { findUnique: async ({ where }) => users.get(where.email) ?? null },
    ...client([]),
    ...(noTransaction ? {} : { $transaction: async (fn) => { const undo = []; world.calls.push(['tx', {}]); try { return await fn(client(undo)) } catch (error) { for (const step of undo.reverse()) step(); throw error } } }),
  }
  world.dropRowDuringTx = dropRowDuringTx
  return world
}
const row = (id, user, extra = {}) => ({ id, userId: user.id, title: 't', status: 'active', geminiStoreName: null, geminiStoreId: null, blankPresentationId: null, strawmanPresentationId: null, finalPresentationId: null, ...extra })

/** The whole stack on one world; `overrides` are in-memory source mutations. `env` is the process env the libs read. */
function load(overrides = {}) {
  const src = (rel) => overrides[rel] ?? read(rel)
  const env = {}, logs = []
  const sink = (level) => (...parts) => { logs.push({ level, text: parts.map(String).join(' ') }) }
  const console_ = { log: sink('log'), warn: sink('warn'), error: sink('error'), info: sink('info'), debug: sink('debug') }
  const globals = { process: { env }, console: console_ }
  const current = { world: makeWorld() }
  const allow = evaluate(src(ALLOW), ALLOW, { '@/lib/layout-viewer-url-policy': policyLib }, globals)
  const guard = evaluate(src(GUARD), GUARD, { 'next/server': { NextResponse: FakeResponse }, '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: POLICY_OBJ }, '@/lib/studio-session-patch-allowlist': allow }, globals)
  const prismaProxy = new Proxy({}, { get: (_t, key) => current.world.prisma[key] })
  const session = { user: { email: CALLER.email } }
  const common = { 'next/server': { NextRequest: class {}, NextResponse: FakeResponse }, 'next-auth': { getServerSession: async () => session }, '@/lib/auth-options': { authOptions: {} }, '@/lib/prisma': { prisma: prismaProxy }, '@/lib/studio-session-patch-guard': guard }
  const route = evaluate(src(ROUTE), ROUTE, common, globals)
  const files = evaluate(src(FILES), FILES, common, globals)
  const uploadRoute = (world, knowledge) => evaluate(src(UPLOAD), UPLOAD, { ...common, '@/lib/service-url': { ServiceUrlConfigError: class extends Error {} }, '@/lib/config': { getKnowledgeServiceUrl: () => 'https://knowledge.example' }, '@/lib/knowledge-service-client': { createSession: knowledge.createSession, uploadFile: knowledge.uploadFile, KnowledgeServiceError: class extends Error {} }, '@/lib/api-hardening': { requireApprovedUser: async () => null } }, globals)
  const core = evaluate(read('lib/api-hardening-core.ts'), 'lib/api-hardening-core.ts', {}, globals)
  const hardening = evaluate(src(HARDENING), HARDENING, { 'next/server': { NextResponse: FakeResponse }, 'next-auth': { getServerSession: async () => session }, '@/lib/auth-options': { authOptions: {} }, '@/lib/prisma': { prisma: prismaProxy }, '@/lib/api-hardening-core': core }, globals)
  return {
    env, logs, allow, guard, route, files, hardening, core, current,
    flags: (state) => { delete env[ENFORCE]; delete env[SHADOW]; if (state.enforce !== undefined) env[ENFORCE] = state.enforce; if (state.shadow !== undefined) env[SHADOW] = state.shadow; logs.length = 0 },
    world: (rows, opts) => { current.world = makeWorld(rows, opts); logs.length = 0; return current.world },
    async patch(id, body) { return route.PATCH({ json: async () => body }, { params: Promise.resolve({ id }) }) },
    upload: (world, knowledge) => { current.world = world; return uploadRoute(world, knowledge) },
    async postFile(id, body) { return files.POST({ json: async () => body }, { params: Promise.resolve({ id }) }) },
  }
}
const std = (extra = {}) => ({ [OWN]: row(OWN, CALLER, extra), [OTHER_OWN]: row(OTHER_OWN, CALLER, { finalPresentationId: ID(7) }), [VICTIM_SESSION]: row(VICTIM_SESSION, VICTIM, { finalPresentationId: ID(1), geminiStoreName: 'victim-store-0001' }) })
const plain = (value) => JSON.parse(JSON.stringify(value))
const signature = async (res) => JSON.stringify([res.status, await res.text(), Object.entries(res.headers).sort()])

// ---- the bodies the legitimate browser writers send (STEP0-DESIGN section 3.5) ---------------------------------------------------------------------------------------------------------------
const NOW = new Date().toISOString()
const W1 = { title: 'My deck', currentStage: 3, blankPresentationUrl: url(ID(11)), blankPresentationId: ID(11), strawmanPreviewUrl: url(ID(12)), strawmanPresentationId: ID(12), finalPresentationUrl: url(ID(13), '?x=1#/0'), finalPresentationId: ID(13), slideCount: 9, lastMessageAt: NOW, stateCache: { currentStatus: { phase: 'done' }, slideStructure: [{ id: 's1' }], activeVersion: 'final' } }
const W3 = { blankPresentationUrl: url(ID(1 + 20)), strawmanPreviewUrl: url(ID(22)), finalPresentationUrl: url(ID(23)) }
const W4 = { currentStage: 5, slideCount: 4, lastMessageAt: NOW, finalPresentationUrl: url(ID(30)), finalPresentationId: ID(30), stateCache: { activeVersion: 'final', currentStatus: { copiedFrom: { sessionId: 's', title: 'x' } } } }
const W5 = { title: 'First message title...' }
const W6 = { currentStage: 0, blankPresentationUrl: url(ID(31)), blankPresentationId: ID(31), slideCount: 3, lastMessageAt: NOW }
const ROW_FOR_W3 = { blankPresentationId: ID(21), strawmanPresentationId: ID(22), finalPresentationId: ID(23) }
const ALLOWED_BODIES = [['W1 updateMetadata', W1, {}], ['W3 recovered URLs', W3, ROW_FOR_W3], ['W4 Duplicate Deck', W4, {}], ['W5 title', W5, {}], ['W6 handoff', W6, {}],
  ['title alone', { title: 'x' }, {}], ['currentStage 0', { currentStage: 0 }, {}], ['currentStage 6', { currentStage: 6 }, {}], ['slideCount 0', { slideCount: 0 }, {}], ['isFavorite', { isFavorite: true }, {}], ['status archived', { status: 'archived' }, {}], ['status active', { status: 'active' }, {}],
  ['clear a pointer', { finalPresentationId: null, finalPresentationUrl: null }, {}], ['stateCache alone', { stateCache: { activeVersion: 'blank' } }, {}], ['empty body', {}, {}]]
// each refusal: [name, body, reason, key names the log carries]
const REFUSALS = [
  ['userId', { userId: 'attacker' }, 'key_not_allowed', 'userId'], ['id', { id: 'x' }, 'key_not_allowed', 'id'], ['createdAt', { createdAt: NOW }, 'key_not_allowed', 'createdAt'], ['updatedAt', { updatedAt: NOW }, 'key_not_allowed', 'updatedAt'],
  ['firstMessageAt', { firstMessageAt: NOW }, 'key_not_allowed', 'firstMessageAt'], ['geminiStoreId', { geminiStoreId: 's' }, 'key_not_allowed', 'geminiStoreId'], ['geminiStoreName', { geminiStoreName: 's' }, 'key_not_allowed', 'geminiStoreName'],
  ['relation user', { user: { connect: { id: 'x' } } }, 'key_not_allowed', 'user'], ['relation messages', { messages: { deleteMany: {} } }, 'key_not_allowed', 'messages'], ['relation uploadedFiles', { uploadedFiles: { create: {} } }, 'key_not_allowed', 'uploadedFiles'],
  ['relation publishedDeck', { publishedDeck: { delete: true } }, 'key_not_allowed', 'publishedDeck'], ['unknown key', { somethingElse: 1 }, 'key_not_allowed', 'unknown(1)'], ['mixed good and bad', { title: 'ok', userId: 'x', geminiStoreName: 'y' }, 'key_not_allowed', 'userId,geminiStoreName'],
  ['status deleted', { status: 'deleted' }, 'value_invalid', 'status'], ['status draft', { status: 'draft' }, 'value_invalid', 'status'], ['array body', [{ title: 'x' }], 'body_not_object', ''], ['string body', 'title', 'body_not_object', ''], ['null body', null, 'body_not_object', ''],
  ['stateCache extra key', { stateCache: { activeVersion: 'final', extra: 1 } }, 'state_cache_invalid', 'stateCache'], ['stateCache as a Prisma op', { stateCache: { upsert: { create: {}, update: {} } } }, 'state_cache_invalid', 'stateCache'], ['stateCache a string', { stateCache: 'x' }, 'state_cache_invalid', 'stateCache'],
  ['stateCache null', { stateCache: null }, 'state_cache_invalid', 'stateCache'], ['stateCache bad version', { stateCache: { activeVersion: 'draft' } }, 'state_cache_invalid', 'stateCache'], ['stateCache too big', { stateCache: { slideStructure: 'x'.repeat(1_000_001) } }, 'state_cache_invalid', 'stateCache'],
  ['currentStage -1', { currentStage: -1 }, 'value_invalid', 'currentStage'], ['currentStage 7', { currentStage: 7 }, 'value_invalid', 'currentStage'], ['currentStage 1.5', { currentStage: 1.5 }, 'value_invalid', 'currentStage'], ['currentStage string', { currentStage: '3' }, 'value_invalid', 'currentStage'],
  ['slideCount huge', { slideCount: 99999 }, 'value_invalid', 'slideCount'], ['slideCount negative', { slideCount: -1 }, 'value_invalid', 'slideCount'], ['title empty', { title: '' }, 'value_invalid', 'title'], ['title blank', { title: '   ' }, 'value_invalid', 'title'], ['title 201', { title: 'x'.repeat(201) }, 'value_invalid', 'title'],
  ['title number', { title: 5 }, 'value_invalid', 'title'], ['lastMessageAt garbage', { lastMessageAt: 'soon' }, 'value_invalid', 'lastMessageAt'], ['lastMessageAt far future', { lastMessageAt: '2099-01-01T00:00:00.000Z' }, 'value_invalid', 'lastMessageAt'], ['lastMessageAt number', { lastMessageAt: 5 }, 'value_invalid', 'lastMessageAt'],
  ['isFavorite string', { isFavorite: 'yes' }, 'value_invalid', 'isFavorite'], ['id with a slash', { finalPresentationId: 'a/b/c/d/e/f/g/h' }, 'value_invalid', 'finalPresentationId'], ['id too short', { finalPresentationId: 'abc' }, 'value_invalid', 'finalPresentationId'], ['id 200 chars', { finalPresentationId: 'a'.repeat(200) }, 'value_invalid', 'finalPresentationId'],
  ['id number', { finalPresentationId: 12345678 }, 'value_invalid', 'finalPresentationId'], ['url on another origin', { finalPresentationId: ID(40), finalPresentationUrl: `https://evil.example/p/${ID(40)}` }, 'value_invalid', 'finalPresentationUrl'],
  ['url whose id differs from the body id', { finalPresentationId: ID(41), finalPresentationUrl: url(ID(42)) }, 'value_invalid', 'finalPresentationUrl'], ['url with no id anywhere', { finalPresentationUrl: url(ID(43)) }, 'value_invalid', 'finalPresentationUrl'],
  ['url not a viewer path', { finalPresentationId: ID(44), finalPresentationUrl: `${LAYOUT}/api/presentations/${ID(44)}` }, 'value_invalid', 'finalPresentationUrl'], ['url javascript', { finalPresentationId: ID(45), finalPresentationUrl: 'javascript:alert(1)' }, 'value_invalid', 'finalPresentationUrl'],
  ['url with credentials', { finalPresentationId: ID(46), finalPresentationUrl: ['https://', 'user', ':', 'word', '@layout.example/p/', ID(46)].join('') }, 'value_invalid', 'finalPresentationUrl'], // assembled at run time: no credential-shaped literal in the source
  ['url not a string', { finalPresentationId: ID(47), finalPresentationUrl: 5 }, 'value_invalid', 'finalPresentationUrl'],
  ['url cleared id kept', { finalPresentationId: null, finalPresentationUrl: url(ID(48)) }, 'value_invalid', 'finalPresentationUrl'],
]
const FORBIDDEN_WORDS = ['another', 'exist', 'belong', 'recorded', 'userId', 'geminiStore', 'finalPresentation', 'stateCache', 'reason', 'field', 'immutable', 'key_not']

// ---- A. the four flag states ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
const ATTACK = { title: 'x', userId: 'attacker', geminiStoreName: 'zz' }
async function suiteFlags(L) {
  const writes = async (state) => { L.flags(state); const world = L.world(std()); const res = await L.patch(OWN, ATTACK); return { res, world, updates: world.calls.filter((c) => c[0] === 'update') } }
  for (const state of [{}, { enforce: 'TRUE' }, { enforce: '1' }, { enforce: ' true' }, { enforce: 'false' }, { enforce: '' }, { enforce: true }, { shadow: 'True' }, { shadow: 'yes' }, { shadow: 1 }, { enforce: 'true ', shadow: 'TRUE' }]) {
    const { res, world, updates } = await writes(state)
    assert.equal(res.status, 200, `flags ${JSON.stringify(state)}: off, today's 200`); assert.equal(updates.length, 1); assert.deepEqual(updates[0][1].data.userId, 'attacker', 'off: the raw body is written exactly as today (the spread)'); assert.equal(updates[0][1].data.geminiStoreName, 'zz')
    assert.equal(world.calls.filter((c) => c[0] === 'findFirst').length, 0, 'off: the guard reads nothing'); assert.deepEqual(L.logs, [], 'off: nothing is logged')
  }
  { // shadow: the same write, one log line with names and a reason code
    const { res, updates } = await writes({ shadow: 'true' })
    assert.equal(res.status, 200); assert.equal(updates.length, 1); assert.equal(updates[0][1].data.userId, 'attacker', 'shadow writes exactly as today (the unlisted key too)')
    assert.deepEqual(L.logs.map((l) => l.text), ['[sessions PATCH shadow] refused reason=key_not_allowed keys=userId,geminiStoreName'])
    const bodyOk = await writes({ shadow: 'true' }); assert.equal(bodyOk.updates.length, 1)
    L.flags({ shadow: 'true' }); L.world(std()); await L.patch(OWN, { title: 'fine' }); assert.deepEqual(L.logs, [], 'shadow: an allowed body logs nothing')
  }
  { // enforce: refused as a whole
    const { res, updates } = await writes({ enforce: 'true' })
    assert.equal(res.status, 400); assert.equal(updates.length, 0, 'enforce: nothing written'); assert.deepEqual(L.logs.map((l) => l.text), ['[sessions PATCH enforce] refused reason=key_not_allowed keys=userId,geminiStoreName'])
  }
  { // both: enforce wins, one line (enforce), no shadow line
    const { res, updates } = await writes({ enforce: 'true', shadow: 'true' })
    assert.equal(res.status, 400); assert.equal(updates.length, 0); assert.deepEqual(L.logs.map((l) => l.text), ['[sessions PATCH enforce] refused reason=key_not_allowed keys=userId,geminiStoreName'])
    const ok = await (async () => { L.flags({ enforce: 'true', shadow: 'true' }); L.world(std()); return L.patch(OWN, { title: 'fine' }) })(); assert.equal(ok.status, 200, 'both on: an allowed body is written')
  }
}

// ---- B. allowed bodies are written -----------------------------------------------------------------------------------------------------------------------------------------------------------------
async function suiteAllowed(L) {
  for (const [name, body, rowExtra] of ALLOWED_BODIES) {
    L.flags({ enforce: 'true' }); const world = L.world(std(rowExtra))
    const res = await L.patch(OWN, body)
    assert.equal(res.status, 200, `${name}: written`); const updates = world.calls.filter((c) => c[0] === 'update'); assert.equal(updates.length, 1, `${name}: one write`)
    const data = updates[0][1].data
    for (const [key, value] of Object.entries(body)) { if (key === 'stateCache') { assert.deepEqual(Object.keys(data.stateCache), ['upsert']); assert.deepEqual(Object.keys(data.stateCache.upsert).sort(), ['create', 'update']); assert.deepEqual(Object.keys(data.stateCache.upsert.create).sort(), ['activeVersion', 'currentStatus', 'slideStructure'], `${name}: the explicit three-field upsert`) } else if (key === 'lastMessageAt') assert.ok(data[key] instanceof Date, `${name}: lastMessageAt as a Date`); else assert.deepEqual(data[key], typeof value === 'string' ? value.trim() : value, `${name}: ${key}`) }
    assert.ok(data.updatedAt instanceof Date, `${name}: updatedAt is set by the server`); assert.deepEqual(Object.keys(data).filter((k) => !(k in body) && k !== 'updatedAt'), [], `${name}: nothing the body did not carry`)
    assert.deepEqual(L.logs, [], `${name}: no log line`)
  }
  { L.flags({ enforce: 'true' }); const world = L.world(std()); const res = await L.patch(OWN, { title: 'x' }); const answer = await res.json(); assert.equal(answer.session.title, 'x', "the answer is today's { session } with the updated row") }
  { L.flags({ enforce: 'true' }); const sessions = std(); L.world(sessions); const stranger = await L.patch(VICTIM_SESSION, { title: 'x' }); assert.equal(stranger.status, 403, 'not your session: 403 as before'); const missing = await L.patch('nope-00000000', { title: 'x' }); assert.equal(missing.status, 404, 'no such session: 404 as before') }
}

// ---- C. one uniform refusal -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function suiteUniform(L) {
  assert.equal(REFUSALS.length, 50, 'the refusal table is whole (a trailing comment once swallowed a case on its own line)'); assert.equal(new Set(REFUSALS.map(([name]) => name)).size, 50, 'every case has its own name')
  let first = null
  for (const [name, body, reason, keys] of REFUSALS) {
    L.flags({ enforce: 'true' }); const world = L.world(std())
    const res = await L.patch(OWN, body)
    assert.equal(res.status, 400, `${name}: 400`); assert.equal(world.calls.filter((c) => c[0] === 'update').length, 0, `${name}: nothing written`)
    const sig = await signature(res); first ??= sig; assert.equal(sig, first, `${name}: the same status, body bytes and headers as every other refusal`)
    const text = await res.text(); for (const word of FORBIDDEN_WORDS) assert.ok(!text.toLowerCase().includes(word.toLowerCase()), `${name}: the response never says "${word}"`)
    assert.deepEqual(L.logs.map((l) => l.text), [`[sessions PATCH enforce] refused reason=${reason} keys=${keys}`], `${name}: one log line, the reason and the key names`)
  }
  // the cross-user refusals answer the very same bytes
  L.flags({ enforce: 'true' }); L.world(std()); const crossPointer = await L.patch(OWN, { finalPresentationId: ID(1) }); assert.equal(await signature(crossPointer), first, 'a deck id another user records: the same bytes as every other refusal')
  L.flags({ enforce: 'true' }); L.world(std()); const crossStore = await L.postFile(OWN, { fileName: 'a.pdf', geminiFileUri: 'u', geminiStoreName: 'victim-store-0001' }); assert.equal(await signature(crossStore), first, 'a store name another user records: the same bytes')
  L.flags({ enforce: 'true' }); L.world(std({ geminiStoreName: 'own-store-00001' })); const immutable = await L.postFile(OWN, { fileName: 'a.pdf', geminiFileUri: 'u', geminiStoreName: 'another-store-0002' }); assert.equal(await signature(immutable), first, 'an immutable store: the same bytes')
  assert.notEqual(JSON.parse(first)[0], 409, 'no 409'); assert.equal(JSON.parse(first)[1], '{"error":"Invalid request"}')
}

// ---- D. rule P3 -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function suiteP3(L) {
  L.flags({ enforce: 'true' }); let world = L.world(std())
  let res = await L.patch(OWN, { finalPresentationId: ID(1) }); assert.equal(res.status, 400, "a deck id another user's session records: refused"); assert.equal(world.calls.filter((c) => c[0] === 'update').length, 0)
  assert.deepEqual(L.logs.map((l) => l.text), ['[sessions PATCH enforce] refused reason=pointer_recorded_elsewhere keys=finalPresentationId'])
  for (const field of ['blankPresentationId', 'strawmanPresentationId']) { L.flags({ enforce: 'true' }); world = L.world(std()); res = await L.patch(OWN, { [field]: ID(1) }); assert.equal(res.status, 400, `${field}: the same id in another slot is the same refusal`) }
  const q = world.calls.find((c) => c[0] === 'findFirst'); assert.deepEqual(plain(q[1].where.userId), { not: CALLER.id }, 'an existence query for ANOTHER user'); assert.equal(q[1].take, undefined, 'not a list'); assert.equal(q[1].where.OR.length, 3)
  L.flags({ enforce: 'true' }); world = L.world(std()); res = await L.patch(OWN, { finalPresentationId: ID(7) }); assert.equal(res.status, 200, "the id the caller's own other session records: allowed")
  L.flags({ enforce: 'true' }); world = L.world(std()); res = await L.patch(OWN, { finalPresentationId: ID(99) }); assert.equal(res.status, 200, 'an id nobody records is written: the residual STEP0 section 4 names (Step B closes it), pinned here so nobody reads it as closed')
  // a URL change alone makes no existence query
  L.flags({ enforce: 'true' }); world = L.world(std({ finalPresentationId: ID(5) })); res = await L.patch(OWN, { finalPresentationUrl: url(ID(5)) }); assert.equal(res.status, 200); assert.equal(world.calls.filter((c) => c[0] === 'findFirst').length, 0)
  // shadow: the refusal is only logged, the write follows
  L.flags({ shadow: 'true' }); world = L.world(std()); res = await L.patch(OWN, { finalPresentationId: ID(1) }); assert.equal(res.status, 200); assert.equal(world.calls.filter((c) => c[0] === 'update').length, 1, 'shadow still writes'); assert.deepEqual(L.logs.map((l) => l.text), ['[sessions PATCH shadow] refused reason=pointer_recorded_elsewhere keys=finalPresentationId'])
}

// ---- E. the files route -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const FILE = { fileName: 'a.pdf', fileSize: 10, fileType: 'application/pdf', geminiFileUri: 'files/x' }
async function suiteStore(L) {
  // off: today (any store name, even another user's, and over a held one)
  L.flags({}); let world = L.world(std({ geminiStoreName: 'own-store-00001' })); let res = await L.postFile(OWN, { ...FILE, geminiStoreName: 'victim-store-0001' }); assert.equal(res.status, 200); assert.equal(world.table.get(OWN).geminiStoreName, 'victim-store-0001', 'off: the store name is written as today'); assert.deepEqual(L.logs, [])
  // enforce
  L.flags({ enforce: 'true' }); world = L.world(std()); res = await L.postFile(OWN, { ...FILE, geminiStoreName: 'researcher-session-01' }); assert.equal(res.status, 200, 'first write accepted'); assert.equal(world.table.get(OWN).geminiStoreName, 'researcher-session-01'); assert.equal(world.files.length, 1)
  res = await L.postFile(OWN, { ...FILE, geminiStoreName: 'researcher-session-01' }); assert.equal(res.status, 200, 'the same value again: idempotent'); assert.equal(world.files.length, 2)
  res = await L.postFile(OWN, { ...FILE, geminiStoreName: 'researcher-session-02' }); assert.equal(res.status, 400, 'a different value: refused'); assert.equal(world.files.length, 2, 'and no file row is created'); assert.equal(world.table.get(OWN).geminiStoreName, 'researcher-session-01', 'the store stays')
  assert.ok(L.logs.some((l) => l.text === '[sessions PATCH enforce] refused reason=store_immutable keys=geminiStoreName'))
  L.flags({ enforce: 'true' }); world = L.world(std()); res = await L.postFile(OWN, { ...FILE, geminiStoreName: 'victim-store-0001' }); assert.equal(res.status, 400, "a store name another user's session records: refused"); assert.equal(world.table.get(OWN).geminiStoreName, null); assert.equal(world.files.length, 0)
  assert.deepEqual(L.logs.map((l) => l.text), ['[sessions PATCH enforce] refused reason=store_recorded_elsewhere keys=geminiStoreName'])
  for (const bad of ['', 'a b', '../../etc', 'x'.repeat(201), 'ünï', ' lead']) { if (bad === '') continue; L.flags({ enforce: 'true' }); world = L.world(std()); res = await L.postFile(OWN, { ...FILE, geminiStoreName: bad }); assert.equal(res.status, 400, `shape: ${JSON.stringify(bad.slice(0, 12))} refused`); assert.equal(world.files.length, 0) }
  L.flags({ enforce: 'true' }); world = L.world(std()); res = await L.postFile(OWN, { ...FILE }); assert.equal(res.status, 200, 'no store name in the body: nothing to guard, as today'); assert.equal(world.files.length, 1)
  L.flags({ enforce: 'true' }); world = L.world(std()); res = await L.postFile(OWN, { ...FILE, geminiStoreName: 12345 }); assert.equal(res.status, 400, 'a non-string store name is a malformed value: refused (the route would have ignored it; a real browser never sends one)'); assert.equal(world.table.get(OWN).geminiStoreName, null); assert.equal(world.files.length, 0)
  // shadow: everything passes, refusals are logged
  L.flags({ shadow: 'true' }); world = L.world(std({ geminiStoreName: 'own-store-00001' })); res = await L.postFile(OWN, { ...FILE, geminiStoreName: 'victim-store-0001' }); assert.equal(res.status, 200); assert.equal(world.table.get(OWN).geminiStoreName, 'victim-store-0001', 'shadow writes as today'); assert.deepEqual(L.logs.map((l) => l.text), ['[sessions PATCH shadow] refused reason=store_immutable keys=geminiStoreName'])
}

// ---- E2. atomic store binding + file registration (P2-1) -------------------------------------------------------------------------------------------------------------------------------------------
async function suiteAtomic(L) {
  const STORE_A = 'researcher-session-AAA1', STORE_B = 'researcher-session-BBB2'
  // overlapping registrations with different stores: exactly one binds, the other is refused, one file exists and it is the winner's
  L.flags({ enforce: 'true' }); let world = L.world(std())
  const [one, two] = await Promise.all([L.postFile(OWN, { ...FILE, geminiStoreName: STORE_A }), L.postFile(OWN, { ...FILE, geminiStoreName: STORE_B })])
  const statuses = [one.status, two.status].sort(); assert.deepEqual(statuses, [200, 400], 'one wins, the other is the uniform refusal')
  const winner = world.table.get(OWN).geminiStoreName; assert.ok([STORE_A, STORE_B].includes(winner)); assert.equal(world.files.length, 1, 'exactly one file row'); assert.equal(world.files[0].geminiStoreName, winner, "the file is the winner's: the session and the accepted file never disagree")
  assert.equal(world.table.get(OWN).geminiStoreId, winner, 'the first bind sets both columns, as the legacy route did')
  // overlapping registrations with the SAME store: both succeed (idempotent append), two files, one binding
  L.flags({ enforce: 'true' }); world = L.world(std())
  const both = await Promise.all([L.postFile(OWN, { ...FILE, geminiStoreName: STORE_A }), L.postFile(OWN, { ...FILE, geminiStoreName: STORE_A })]); assert.deepEqual(both.map((r) => r.status), [200, 200]); assert.equal(world.files.length, 2); assert.equal(world.table.get(OWN).geminiStoreName, STORE_A)
  // a binding the upload route already made (a DISTINCT store id) is kept by an idempotent append
  L.flags({ enforce: 'true' }); world = L.world(std({ geminiStoreName: STORE_A, geminiStoreId: 'ks-session-id-9999' }))
  let res = await L.postFile(OWN, { ...FILE, geminiStoreName: STORE_A }); assert.equal(res.status, 200); assert.equal(world.table.get(OWN).geminiStoreId, 'ks-session-id-9999', 'the store id the upload route set is preserved'); assert.equal(world.files.length, 1)
  // the legacy conditional: the bind never matches a row that already holds another name
  assert.ok(world.calls.some((c) => c[0] === 'updateMany' && JSON.stringify(c[1].where.OR) === JSON.stringify([{ geminiStoreName: null }, { geminiStoreName: '' }])), 'the first bind is conditional on no store yet')
  assert.ok(world.calls.filter((c) => c[0] === 'tx').length === 1, 'one transaction per registration')
  // the file insert fails: the session write is rolled back with it (0 file, 0 session write)
  L.flags({ enforce: 'true' }); world = L.world(std(), { failFileCreate: true }); res = await L.postFile(OWN, { ...FILE, geminiStoreName: STORE_A })
  assert.equal(res.status, 500, "the route's own error answer"); assert.equal(world.files.length, 0, 'no file'); assert.equal(world.table.get(OWN).geminiStoreName, null, 'and the binding is rolled back with it'); assert.equal(world.table.get(OWN).geminiStoreId, null)
  // a refusal inside the transaction rolls back too (cross-user store, immutable store): nothing written
  L.flags({ enforce: 'true' }); world = L.world(std({ geminiStoreName: STORE_A })); res = await L.postFile(OWN, { ...FILE, geminiStoreName: STORE_B }); assert.equal(res.status, 400); assert.equal(world.files.length, 0); assert.equal(world.table.get(OWN).geminiStoreName, STORE_A)
  // a client without $transaction fails closed in enforce (nothing written) and never breaks a shadow or an off write
  L.flags({ enforce: 'true' }); world = L.world(std(), { noTransaction: true }); res = await L.postFile(OWN, { ...FILE, geminiStoreName: STORE_A }); assert.equal(res.status, 500); assert.equal(world.files.length, 0); assert.equal(world.table.get(OWN).geminiStoreName, null)
  L.flags({ shadow: 'true' }); world = L.world(std(), { noTransaction: true }); res = await L.postFile(OWN, { ...FILE, geminiStoreName: STORE_A }); assert.equal(res.status, 200); assert.equal(world.files.length, 1, 'shadow: the legacy write follows')
  L.flags({}); world = L.world(std(), { noTransaction: true }); res = await L.postFile(OWN, { ...FILE, geminiStoreName: STORE_A }); assert.equal(res.status, 200); assert.equal(world.table.get(OWN).geminiStoreName, STORE_A, 'off: exactly the legacy route')
  // enforce with no store name: the legacy file write, no transaction
  L.flags({ enforce: 'true' }); world = L.world(std()); res = await L.postFile(OWN, { ...FILE }); assert.equal(res.status, 200); assert.equal(world.calls.filter((c) => c[0] === 'tx').length, 0); assert.equal(world.files.length, 1)
}

// ---- E3. the upload route never overwrites a winning binding (P2-1 b) -----------------------------------------------------------------------------------------------------------------------------
const KS = { session_id: 'ks-session-id-0001', store_name: 'fileSearchStores/ks-0001' }
async function runUpload(L, rows, { raceStore = null, deleteRow = false, opts } = {}) {
  const world = L.world(rows, opts); const calls = { created: 0, uploadedTo: [] }
  const route = L.upload(world, {
    createSession: async () => { calls.created++; if (raceStore) { const held = world.table.get(OWN); world.table.set(OWN, { ...held, geminiStoreName: raceStore.name, geminiStoreId: raceStore.id }) } if (deleteRow) world.table.delete(OWN); return KS },
    uploadFile: async (storeId) => { calls.uploadedTo.push(storeId); return { file_uri: 'files/u1', file_name: 'a.pdf' } },
  })
  const res = await route.POST({ formData: async () => ({ get: (key) => ({ file: { name: 'a.pdf', size: 10, type: 'application/pdf' }, sessionId: OWN, userId: CALLER.id })[key] }) })
  return { res, world, calls }
}
async function suiteUpload(L) {
  // no race: the new store is bound with a conditional first bind and used
  L.flags({ enforce: 'true' }); let r = await runUpload(L, std()); assert.equal(r.res.status, 200); assert.equal(r.world.table.get(OWN).geminiStoreName, KS.store_name); assert.equal(r.world.table.get(OWN).geminiStoreId, KS.session_id); assert.deepEqual(r.calls.uploadedTo, [KS.session_id])
  assert.ok(r.world.calls.some((c) => c[0] === 'updateMany' && JSON.stringify(c[1].where.OR) === JSON.stringify([{ geminiStoreName: null }, { geminiStoreName: '' }])), 'a conditional first bind')
  // a binding that wins first (the files route, between the read and the write): enforce adopts it and never overwrites it
  L.flags({ enforce: 'true' }); r = await runUpload(L, std(), { raceStore: { name: 'winner-store-0001', id: 'winner-id-000001' } })
  assert.equal(r.res.status, 200); assert.equal(r.world.table.get(OWN).geminiStoreName, 'winner-store-0001', 'the winning binding stays'); assert.equal(r.world.table.get(OWN).geminiStoreId, 'winner-id-000001'); assert.deepEqual(r.calls.uploadedTo, ['winner-id-000001'], 'the upload goes to the adopted store'); assert.equal(r.world.files[0].geminiStoreName, 'winner-store-0001')
  // the winner has a name and no id: the name is used for both
  L.flags({ enforce: 'true' }); r = await runUpload(L, std(), { raceStore: { name: 'winner-store-0002', id: null } }); assert.equal(r.res.status, 200); assert.deepEqual(r.calls.uploadedTo, ['winner-store-0002'])
  // nothing to adopt (the row is gone): fail closed, nothing uploaded
  L.flags({ enforce: 'true' }); r = await runUpload(L, std(), { deleteRow: true }); assert.equal(r.res.status, 500); assert.deepEqual(r.calls.uploadedTo, [], 'fails closed: nothing is uploaded'); assert.equal(r.world.files.length, 0)
  // off and shadow are the legacy route: the upload's own store overwrites (the very thing enforce prevents), no extra read or write
  for (const mode of [{}, { shadow: 'true' }]) { L.flags(mode); r = await runUpload(L, std(), { raceStore: { name: 'winner-store-0001', id: 'winner-id-000001' } }); assert.equal(r.res.status, 200); assert.equal(r.world.table.get(OWN).geminiStoreName, KS.store_name, 'flags off or shadow: the legacy update, byte for byte'); assert.equal(r.world.calls.filter((c) => c[0] === 'updateMany').length, 0) }
  // a chat that already has a store: no new session, no bind
  L.flags({ enforce: 'true' }); r = await runUpload(L, std({ geminiStoreName: 'held-store-00001', geminiStoreId: 'held-id-0000001' })); assert.equal(r.res.status, 200); assert.equal(r.calls.created, 0); assert.deepEqual(r.calls.uploadedTo, ['held-id-0000001']); assert.equal(r.world.calls.filter((c) => c[0] === 'updateMany').length, 0)
  // a client without updateMany or findFirst fails closed in enforce
  L.flags({ enforce: 'true' }); r = await runUpload(L, std(), { raceStore: { name: 'winner-store-0001', id: 'winner-id-000001' }, opts: { noFindFirst: true } }); assert.equal(r.res.status, 500); assert.deepEqual(r.calls.uploadedTo, [])
}

// ---- F. api-hardening -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function suiteHardening(L) {
  L.env.STUDIO_API_HARDENING_V1_ENABLED = 'true'
  try {
    const rows = {}
    for (let i = 0; i < 25; i++) rows[`attacker-${i}`] = row(`attacker-${i}`, CALLER, { finalPresentationId: ID(1) })
    rows[VICTIM_SESSION] = row(VICTIM_SESSION, VICTIM, { finalPresentationId: ID(1) })
    rows[OWN] = row(OWN, CALLER)
    L.world(rows)
    const denied = await L.hardening.requireSessionOwner(CALLER.id, OWN, ID(1)); assert.equal(denied?.status, 403, "25 rows of the caller's own do not push the victim's row out: still refused")
    const own = {}; for (let i = 0; i < 25; i++) own[`own-${i}`] = row(`own-${i}`, CALLER, { finalPresentationId: ID(2) }); own[OWN] = row(OWN, CALLER); L.world(own)
    assert.equal(await L.hardening.requireSessionOwner(CALLER.id, OWN, ID(2)), null, "a deck only the caller's own sessions record is allowed (no other user in the way)")
    const w = L.world({ [OWN]: row(OWN, CALLER) }); await L.hardening.requireSessionOwner(CALLER.id, OWN, ID(3))
    const q = w.calls.find((c) => c[0] === 'findFirst'); assert.ok(q, 'an existence query'); assert.deepEqual(plain(q[1].where.userId), { not: CALLER.id }); assert.equal(q[1].take, undefined); assert.equal(q[1].where.OR.length, 3)
    L.world({ [OWN]: row(OWN, CALLER) }, { noFindFirst: true }); const failed = await L.hardening.requireSessionOwner(CALLER.id, OWN, ID(3)); assert.equal(failed?.status, 503, 'a client without findFirst fails CLOSED (503), never allowed')
  } finally { delete L.env.STUDIO_API_HARDENING_V1_ENABLED }
  L.world({}); assert.equal(await L.hardening.requireSessionOwner(CALLER.id, OWN, ID(3)), null, 'hardening flag off: nothing is read, as before')
}

// ---- G. canaries ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function suiteCanary(L) {
  const C = { deck: 'CANARY-DECK-0000AAAA', store: 'canary-store-name-zzzz', title: 'CANARY TITLE secret', urlHost: 'canary.example', user: 'user-canary-9999' }
  const bodies = [
    { finalPresentationId: C.deck, finalPresentationUrl: `https://${C.urlHost}/p/${C.deck}` }, { title: C.title, userId: C.user }, { geminiStoreName: C.store, geminiStoreId: C.store }, { ['evil\nkey']: C.deck },
    { stateCache: { slideStructure: C.title, extra: C.deck } }, { title: C.title.repeat(40) }, { finalPresentationId: ID(1), finalPresentationUrl: url(ID(1)), title: C.title },
  ]
  for (const mode of [{ enforce: 'true' }, { shadow: 'true' }]) {
    for (const body of bodies) { L.flags(mode); L.world(std()); await L.patch(OWN, body); const lines = L.logs.map((l) => l.text); for (const text of lines) { for (const canary of [C.deck, C.store, C.title, C.urlHost, C.user, ID(1)]) assert.ok(!text.includes(canary), `the log never carries a value: ${text}`); assert.ok(!/\n/.test(text), 'one line'); assert.match(text, /^\[sessions PATCH (shadow|enforce)\] refused reason=[a-z_]+ keys=[A-Za-z0-9_.,()-]*$/) } }
    { L.flags(mode); const rows = std(); rows[VICTIM_SESSION] = row(VICTIM_SESSION, VICTIM, { geminiStoreName: C.store }); L.world(rows); await L.postFile(OWN, { ...FILE, geminiStoreName: C.store }); assert.ok(L.logs.length >= 1, 'the cross-user store case logs'); for (const l of L.logs) assert.ok(!l.text.includes(C.store), 'the other user\'s store name is never logged') }
    for (const store of [C.store, `${C.store} bad`]) { L.flags(mode); L.world(std({ geminiStoreName: 'held-store-00001' })); await L.postFile(OWN, { ...FILE, geminiStoreName: store }); for (const l of L.logs) assert.ok(!l.text.includes(C.store), 'the store name is never logged') }
  }
  // P2-2: a client key outside the closed set of server-known labels never has one character logged, however innocent it looks
  const UNKNOWN = ['Canary_Key.v2-abcXYZ', 'Zq8vK2mNp4Rt7WxYcanaryTwo', 'canary-0123456789-ABCDEFGHIJ-name', `k\n${'y'.repeat(200)}`, '__proto__', 'constructor']
  for (const mode of [{ shadow: 'true' }, { enforce: 'true' }]) {
    for (const key of UNKNOWN) {
      L.flags(mode); L.world(std()); await L.patch(OWN, JSON.parse(`{${JSON.stringify(key)}: 1, "title": "ok"}`))
      assert.equal(L.logs.length, 1, 'one line'); const line = L.logs[0].text
      for (const piece of [key, key.slice(0, 6), key.slice(-6)].filter((s) => s.length >= 6 && !/\s/.test(s))) assert.ok(!line.includes(piece), `0 bytes of the unknown key appear in the log (${JSON.stringify(piece.slice(0, 8))}...): ${line}`)
      assert.match(line, /^\[sessions PATCH (shadow|enforce)\] refused reason=key_not_allowed keys=unknown\(1\)$/, 'a fixed count label and the closed reason code')
    }
    L.flags(mode); L.world(std()); await L.patch(OWN, { userId: 'x', Canary_Key: 1, geminiStoreName: 'y', another_one: 2 }); assert.match(L.logs[0].text, /keys=userId,geminiStoreName,unknown\(2\)$/, 'known labels stay, the rest is counted')
    L.flags(mode); L.world(std()); await L.patch(OWN, Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`bad${i}`, 1]))); assert.match(L.logs[0].text, /keys=unknown\(30\)$/, 'thirty unknown keys are one count')
    L.flags(mode); L.world(std()); await L.patch(OWN, Object.fromEntries(['id', 'userId', 'createdAt', 'updatedAt', 'firstMessageAt', 'geminiStoreId', 'geminiStoreName', 'user', 'messages', 'uploadedFiles', 'publishedDeck'].map((k) => [k, 1]))); assert.equal(L.logs[0].text.split('keys=')[1].split(',').length, 10, 'at most ten known labels')
  }
  assert.ok(L.allow.SESSION_PATCH_LOG_LABELS instanceof Set && !L.allow.SESSION_PATCH_LOG_LABELS.has('somethingElse'), 'the closed set is a static Set of server-known labels')
}

// ---- H. Class 2: partial objects, stubs, missing attributes ----------------------------------------------------------------------------------------------------------------------------------------
async function suiteClass2(L) {
  assert.equal(L.allow.sessionPatchMode({}), 'off'); assert.equal(L.allow.sessionPatchMode(null), 'off'); assert.equal(L.allow.sessionPatchMode('true'), 'off'); assert.equal(L.allow.sessionPatchMode({ [ENFORCE]: true }), 'off', 'a boolean true is not the exact string')
  assert.equal(L.allow.sessionPatchMode({ [ENFORCE]: 'true' }), 'enforce'); assert.equal(L.allow.sessionPatchMode({ [SHADOW]: 'true' }), 'shadow'); assert.equal(L.allow.sessionPatchMode({ [ENFORCE]: 'true', [SHADOW]: 'true' }), 'enforce', 'enforce wins')
  // enforce with a client that has no findFirst: the write must NOT happen
  L.flags({ enforce: 'true' }); let world = L.world(std(), { noFindFirst: true }); let res = await L.patch(OWN, { finalPresentationId: ID(99) }); assert.equal(res.status, 500, 'a guard that cannot run is the route\'s own error answer'); assert.equal(world.calls.filter((c) => c[0] === 'update').length, 0, 'fail closed: nothing written')
  L.flags({ enforce: 'true' }); world = L.world(std(), { noFindFirst: true }); res = await L.postFile(OWN, { ...FILE, geminiStoreName: 'researcher-session-09' }); assert.equal(res.status, 500); assert.equal(world.files.length, 0, 'the files route fails closed too')
  // a body with nothing to look up needs no findFirst: an enforce write of a title still works on such a client
  L.flags({ enforce: 'true' }); world = L.world(std(), { noFindFirst: true }); res = await L.patch(OWN, { title: 'x' }); assert.equal(res.status, 200)
  // shadow: a client without findFirst never breaks the write
  L.flags({ shadow: 'true' }); world = L.world(std(), { noFindFirst: true }); res = await L.patch(OWN, { finalPresentationId: ID(99) }); assert.equal(res.status, 200); assert.equal(world.calls.filter((c) => c[0] === 'update').length, 1, 'shadow: the write follows'); assert.ok(L.logs.some((l) => l.text === '[sessions PATCH shadow] guard error'))
  L.flags({ shadow: 'true' }); world = L.world(std(), { noFindFirst: true }); res = await L.postFile(OWN, { ...FILE, geminiStoreName: 'researcher-session-09' }); assert.equal(res.status, 200); assert.equal(world.files.length, 1)
  // the pure decision with partial contexts: no policy approves no URL; no row is an empty row
  const d = (body, ctx) => L.allow.decideSessionPatch(body, ctx)
  assert.equal(d({ finalPresentationId: ID(5), finalPresentationUrl: url(ID(5)) }, { row: null, urlPolicy: null }).ok, false, 'no policy: a URL is never approved (fail closed)'); assert.equal(d({ finalPresentationId: ID(5), finalPresentationUrl: url(ID(5)) }, { row: null, urlPolicy: undefined }).ok, false)
  assert.equal(d({ finalPresentationId: ID(5), finalPresentationUrl: url(ID(5)) }, { row: null, urlPolicy: POLICY_OBJ }).ok, true); assert.equal(d({ finalPresentationUrl: url(ID(5)) }, { row: undefined, urlPolicy: POLICY_OBJ }).ok, false, 'no row and no id: refused')
  assert.equal(d({ finalPresentationUrl: url(ID(5)) }, { row: { finalPresentationId: ID(5) }, urlPolicy: POLICY_OBJ }).ok, true, "the URL pairs with the row's own id when the body has none"); assert.equal(d({ finalPresentationUrl: url(ID(5)) }, { row: { finalPresentationId: ID(6) }, urlPolicy: POLICY_OBJ }).ok, false)
  assert.equal(d({ title: 'x' }, undefined).ok, true, 'a missing context is an empty one for a body with no URL'); assert.equal(d({ title: 'x' }, { row: {}, urlPolicy: POLICY_OBJ, now: new Date('invalid') }).ok, true)
  assert.equal(d({ stateCache: {} }, { row: {}, urlPolicy: POLICY_OBJ }).ok, true, "an empty stateCache object is today's no-op upsert"); assert.equal(d(Object.create({ title: 'inherited' }), { row: {}, urlPolicy: POLICY_OBJ }).ok, false, 'an object with a foreign prototype is not a body')
  assert.equal(d(JSON.parse('{"__proto__":{"userId":"x"}}'), { row: {}, urlPolicy: POLICY_OBJ }).ok, false, 'a __proto__ key from JSON is an unlisted key')
  assert.equal(d({ lastMessageAt: new Date(Date.now() + 3600_000).toISOString() }, { row: {}, urlPolicy: POLICY_OBJ }).ok, true, 'a client clock an hour ahead is a legitimate save'); assert.equal(d({ lastMessageAt: new Date(Date.now() + 3 * 86400_000).toISOString() }, { row: {}, urlPolicy: POLICY_OBJ }).ok, false)
}

// ---- the stack runs -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const SUITES = { flags: suiteFlags, allowed: suiteAllowed, uniform: suiteUniform, p3: suiteP3, store: suiteStore, atomic: suiteAtomic, upload: suiteUpload, hardening: suiteHardening, canary: suiteCanary, class2: suiteClass2 }
const real = load()
await check('A the four flag states: off and every loose spelling is today; shadow writes as today and logs names and a reason only; enforce refuses; both = enforce', () => suiteFlags(real))
await check('B what the legitimate writers send (W1 W3 W4 W5 W6 and each key alone) is written, with the three-field stateCache upsert and a server updatedAt', () => suiteAllowed(real))
await check('C every refusal answers the same status, body bytes and headers; no 409; no field name or "another user"; nothing written; one log line with the reason and the key names', () => suiteUniform(real))
await check('D rule P3: a deck id another user records is refused (an existence query), the caller\'s own and an unrecorded id are not; shadow only logs', () => suiteP3(real))
await check('E the files route: the store name is write-once, shape-checked and cross-user-checked; off, shadow and enforce', () => suiteStore(real))
await check('E2 atomic store binding and file registration: overlapping registrations (one winner, the session and the accepted file agree), idempotent append keeps a distinct store id, a failing file insert rolls the binding back, no $transaction fails closed', () => suiteAtomic(real))
await check('E3 the upload route binds a new store only if the chat has none (a conditional first bind), adopts a binding that won first and never overwrites it, fails closed when it cannot confirm; off and shadow are the legacy update', () => suiteUpload(real))
await check('F lib/api-hardening.ts: the owner lookup is an existence query; 25 rows of the caller\'s own do not hide the other owner; a client without findFirst fails closed', () => suiteHardening(real))
await check('G canary values never reach a log line; key names are sanitised, one line, at most ten', () => suiteCanary(real))
await check('H Class 2: missing findFirst fails closed in enforce and never breaks a shadow write; missing env, boolean true, missing policy, missing row, foreign prototype, __proto__', () => suiteClass2(real))

const hasPattern = (text, pattern) => (text.match(pattern) ?? []).length
await check('I Class 1: the routes keep the spread (flag off), carry exactly three marked lines each, call the guard before the write; the strip gives the base byte for byte; env block; registry', () => {
  const route = read(ROUTE), files = read(FILES), upload = read(UPLOAD)
  assert.ok(route.includes('...sessionUpdates'), "the PATCH still writes the fields it was sent when the flags are off (test-studio-deck-sync-truth reads this)")
  for (const [rel, text] of [[ROUTE, route], [FILES, files], [UPLOAD, upload]]) { assert.equal(hasPattern(text, /PL-70 STEP A/g), 3, `${rel}: exactly three marked lines (the import and two calls)`); assert.equal(strip.stripPl70SessionPatchAllowlist(rel, text), git('show', `${strip.PL70_BASE_COMMIT}:${rel}`), `${rel}: without the marked lines it is the base, byte for byte`); assert.equal(strip.stripPl70SessionPatchAllowlist(rel, strip.stripPl70SessionPatchAllowlist(rel, text)), git('show', `${strip.PL70_BASE_COMMIT}:${rel}`), `${rel}: twice over changes nothing more`) }
  for (const rel of strip.PL70_TAUGHT_TEST_FILES) { const text = read(rel); assert.equal(hasPattern(text, /PL-70 STEP A/g), 1, `${rel}: the taught older proof carries exactly one marked line`); assert.equal(strip.stripPl70SessionPatchAllowlist(rel, text), git('show', `${strip.PL70_BASE_COMMIT}:${rel}`), `${rel}: without that line it is the base, byte for byte`) }
  assert.equal(strip.PL70_TAUGHT_TEST_FILES.size, 3); for (const rel of strip.PL70_TAUGHT_TEST_FILES) assert.ok(strip.PL70_SCOPE_FILES.has(rel), `${rel}: in the scope`)
  assert.ok(route.indexOf('guardSessionPatch({') < route.indexOf('prisma.chatSession.update('), 'the guard runs before the route\'s own write'); assert.ok(files.indexOf('guardSessionStoreWrite({') < files.indexOf('prisma.uploadedFile.create('), 'the store guard runs before anything is created')
  assert.ok(upload.indexOf('guardUploadStoreBind({') < upload.indexOf('await prisma.chatSession.update({'), "the upload route binds (conditionally) before its own session update, which then restates the adopted binding"); assert.ok(upload.indexOf('guardUploadStoreBind({') > upload.indexOf('storeName = ksSession.store_name'), 'after the new store exists')
  assert.ok(files.indexOf('guardSessionStoreWrite({') > files.indexOf('Missing file metadata'), 'the store guard runs after the missing-metadata check')
  assert.ok(route.indexOf('guardSessionPatch({') > route.indexOf('existing.userId !== user.id'), 'after the ownership check: 401/404/403 are unchanged')
  assert.equal(strip.stripPl70SessionPatchAllowlist(HARDENING, read(HARDENING)), git('show', `${strip.PL70_BASE_COMMIT}:${HARDENING}`), 'api-hardening strips back to the base'); assert.ok(!/take: 20/.test(read(HARDENING)) && read(HARDENING).includes('findFirst'), 'no unordered list of 20 left')
  const reg = read('scripts/studio-later-changes.mjs'); assert.equal(strip.stripPl70SessionPatchAllowlist('scripts/studio-later-changes.mjs', reg), git('show', `${strip.PL70_BASE_COMMIT}:scripts/studio-later-changes.mjs`), 'the registry loses its three lines and is the base'); assert.equal(strip.PL70_REGISTRY_LINES.length, 3); for (const line of strip.PL70_REGISTRY_LINES) assert.equal(reg.split(line.trimEnd()).length - 1, 1, 'each registry line is there once')
  const env = read('.env.example'); assert.equal(hasPattern(env, new RegExp(`^${SHADOW}="false"$`, 'm')), 1); assert.equal(hasPattern(env, new RegExp(`^${ENFORCE}="false"$`, 'm')), 1); assert.ok(env.endsWith(`\n${strip.PL70_ENV_BLOCK}`) || env.includes(strip.PL70_ENV_BLOCK), 'the block is in .env.example')
  assert.ok(registry.LATER_ENV_BLOCKS.includes(strip.PL70_ENV_BLOCK) && registry.LATER_STRIPS.includes(strip.stripPl70SessionPatchAllowlist) && [...strip.PL70_SCOPE_FILES].every((rel) => registry.LATER_CHANGE_FILES.has(rel)), 'registered')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', env), registry.stripLaterEnvBlocks('.env.example', git('show', `${strip.PL70_BASE_COMMIT}:.env.example`)), 'read through the registry .env.example is what the base gives')
  const block = strip.PL70_ENV_BLOCK; for (const other of ['NEXT_PUBLIC_', 'STUDIO_API_HARDENING', 'DEV_BYPASS', 'ADMIN_EMAILS']) assert.ok(!block.includes(other), `the block names only its own two flags, not ${other}`)
  for (const [rel, text] of [[ALLOW, read(ALLOW)], [GUARD, read(GUARD)]]) assert.ok(!/console\.(log|info|debug)/.test(text), `${rel}: only warn lines, names and codes`)
})
await check('J scope: this change\'s own commits (subject PL-70:) touch only its files', () => {
  const log = git('log', '--format=%H %s', `${strip.PL70_BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter((line) => strip.PL70_COMMIT_SUBJECT.test(line.slice(41)))
  if (log.length === 0) { console.log('NOTE scope: no commit of this change on the range yet (not committed, or squash merged)'); return }
  const touched = new Set(log.flatMap((line) => git('show', '--name-only', '--format=', line.slice(0, 40)).split('\n').filter(Boolean)))
  assert.deepEqual([...touched].filter((rel) => !strip.PL70_SCOPE_FILES.has(rel)).sort(), [], 'no file outside the scope')
})

// ---- K. mutants: each is one edit of the real text and must make one of the suites FAIL ---------------------------------------------------------------------------------------------------
const rep = (rel, from, to) => { const text = read(rel); assert.ok(text.includes(from), `mutation target in ${rel}: ${from.slice(0, 70)}`); return { [rel]: text.replace(from, () => to) } }
const MUTANTS = [
  ['the allowlist admits geminiStoreName', rep(ALLOW, "  'stateCache',\n]", "  'stateCache', 'geminiStoreName',\n]"), 'flags'],
  ['the allowlist admits userId', rep(ALLOW, "  'stateCache',\n]", "  'stateCache', 'userId',\n]"), 'uniform'],
  ['status deleted is allowed', rep(ALLOW, "value === 'active' || value === 'archived'", "value === 'active' || value === 'archived' || value === 'deleted'"), 'uniform'],
  ['a stateCache extra key is allowed', rep(ALLOW, 'if (extra.length > 0) return refuse', 'if (extra.length > 99) return refuse'), 'uniform'],
  ['the URL id equality is dropped', rep(ALLOW, 'typeof pairedId === \'string\' && pairedId === named', "typeof pairedId === 'string'"), 'uniform'],
  ['a URL on any origin is approved', rep(ALLOW, "evaluateLayoutViewerUrl(value, policy).status === 'allowed'", 'true'), 'uniform'],
  ['a missing policy approves a URL', rep(ALLOW, 'const approved = policy && typeof value', 'const approved = !policy || typeof value'), 'class2'],
  ['the shadow flag is read loosely', rep(ALLOW, "env[SESSION_PATCH_SHADOW_FLAG] === 'true'", "env[SESSION_PATCH_SHADOW_FLAG] !== undefined"), 'flags'],
  ['the enforce flag is read loosely', rep(ALLOW, "env[SESSION_PATCH_ENFORCE_FLAG] === 'true'", "String(env[SESSION_PATCH_ENFORCE_FLAG]).toLowerCase() === 'true'"), 'flags'],
  ['shadow wins over enforce', rep(ALLOW, "  if (env[SESSION_PATCH_ENFORCE_FLAG] === 'true') return 'enforce'\n  if (env[SESSION_PATCH_SHADOW_FLAG] === 'true') return 'shadow'", "  if (env[SESSION_PATCH_SHADOW_FLAG] === 'true') return 'shadow'\n  if (env[SESSION_PATCH_ENFORCE_FLAG] === 'true') return 'enforce'"), 'flags'],
  ['the refusal is a 409', rep(ALLOW, 'export const SESSION_PATCH_REFUSAL_STATUS = 400', 'export const SESSION_PATCH_REFUSAL_STATUS = 409'), 'uniform'],
  ['the refusal body names a field', rep(ALLOW, `'{"error":"Invalid request"}'`, `'{"error":"Invalid request","field":"x"}'`), 'uniform'],
  ['the cross-user pointer refusal is a 409', rep(GUARD, "    logRefusal('enforce', verdict.reason, verdict.keys)\n    return sessionPatchRefusal()\n  }\n  const updated", "    logRefusal('enforce', verdict.reason, verdict.keys)\n    return verdict.reason === 'pointer_recorded_elsewhere' ? new NextResponse('{\"error\":\"taken\"}', { status: 409 }) : sessionPatchRefusal()\n  }\n  const updated"), 'uniform'],
  ['the log line carries the request body', rep(GUARD, "if (!decision.ok) return { refused: true, reason: decision.reason, keys: decision.keys }", "if (!decision.ok) return { refused: true, reason: decision.reason, keys: [...decision.keys, JSON.stringify(args.body)] }"), 'canary'],
  ['the log carries the store name', rep(GUARD, "if (elsewhere) return { refused: true, reason: 'store_recorded_elsewhere', keys: ['geminiStoreName'] }", "if (elsewhere) { console.warn('store ' + String(wanted)); return { refused: true, reason: 'store_recorded_elsewhere', keys: ['geminiStoreName'] } }"), 'canary'],
  ['shadow refuses instead of writing', rep(GUARD, "      if (verdict.refused) logRefusal('shadow', verdict.reason, verdict.keys)\n    } catch {\n      try { console.warn('[sessions PATCH shadow] guard error')", "      if (verdict.refused) { logRefusal('shadow', verdict.reason, verdict.keys); return sessionPatchRefusal() }\n    } catch {\n      try { console.warn('[sessions PATCH shadow] guard error')"), 'flags'],
  ['off still runs the guard', rep(GUARD, "  const mode = args.mode ?? sessionPatchMode()\n  if (mode === 'off') return null\n  if (mode === 'shadow') {\n    try {\n      const verdict = await judgePatch(args)", "  const mode = args.mode ?? sessionPatchMode()\n  if (mode === 'shadow' || mode === 'off') {\n    try {\n      const verdict = await judgePatch(args)"), 'flags'],
  ['P3 is dropped', rep(GUARD, 'for (const { field, id } of decision.pointerIds) {', 'for (const { field, id } of [] as Array<{ field: string; id: string }>) {'), 'p3'],
  ['P3 counts the caller\'s own rows', rep(GUARD, "where: { userId: { not: args.userId }, OR: [{ blankPresentationId: id }", "where: { OR: [{ blankPresentationId: id }"), 'p3'],
  ['an enforce guard failure is swallowed (fails open)', rep(GUARD, "  // enforce: nothing in here is allowed to turn into a pass\n  const verdict = await judgePatch(args)", "  // enforce: nothing in here is allowed to turn into a pass\n  let verdict: Verdict\n  try { verdict = await judgePatch(args) } catch { return null }"), 'class2'],
  ['the store guard fails open in enforce', rep(GUARD, "    throw error // anything else was rolled back; the route's own error answer follows and nothing was written", '    return null'), 'class2'],
  ['a missing $transaction falls back to the legacy write (fails open)', rep(GUARD, "if (typeof run !== 'function') throw new Error('transactions are unavailable')", "if (typeof run !== 'function') return null"), 'atomic'],
  ['the store is not write-once (an immutable binding still registers the file)', rep(GUARD, "if (same.count !== 1) throw new StoreRefusal('store_immutable')", ''), 'store'],
  ['the store cross-user check is dropped inside the transaction', rep(GUARD, "if (elsewhere) throw new StoreRefusal('store_recorded_elsewhere')", ''), 'store'],
  ['the store shape is not checked in enforce', rep(GUARD, "if (!isSessionStoreName(wanted)) {\n    logRefusal('enforce'", "if (false) {\n    logRefusal('enforce'"), 'store'],
  ['the first bind is unconditional', rep(GUARD, "where: { id: args.sessionId, userId: args.userId, OR: [{ geminiStoreName: null }, { geminiStoreName: '' }] },\n        data: { geminiStoreName: wanted", "where: { id: args.sessionId, userId: args.userId },\n        data: { geminiStoreName: wanted"), 'atomic'],
  ['the session bind is outside the transaction (no rollback with the file)', rep(GUARD, "const bound = await tx.chatSession.updateMany({", "const bound = await (args.prisma as unknown as TxClient).chatSession.updateMany({"), 'atomic'],
  ['the idempotent append overwrites the store id the upload route set', rep(GUARD, "data: { updatedAt: now } })\n        if (same.count", "data: { geminiStoreId: wanted, updatedAt: now } })\n        if (same.count"), 'atomic'],
  ['the upload bind is unconditional (it can overwrite a winning binding)', rep(GUARD, "OR: [{ geminiStoreName: null }, { geminiStoreName: '' }] },\n    data: { geminiStoreName: args.storeName", "},\n    data: { geminiStoreName: args.storeName"), 'upload'],
  ['the upload does not adopt the winning binding', rep(GUARD, "return { storeName: row.geminiStoreName, storeId: typeof row.geminiStoreId", "return null as unknown as { storeName: string; storeId: string } && { storeName: row.geminiStoreName, storeId: typeof row.geminiStoreId"), 'upload'],
  ['the upload does not fail closed when it cannot confirm the binding', rep(GUARD, "throw new Error('the store binding could not be confirmed')", 'return null'), 'upload'],
  ['the log names an unknown key', rep(ALLOW, "} else unknown++", "} else { unknown++; known.push(String(key)) }"), 'canary'],
  ['the closed label set admits any key', rep(ALLOW, "SESSION_PATCH_LOG_LABELS.has(key))", "true)"), 'canary'],
  ['the enforced write spreads the raw body', rep(GUARD, "data: { ...verdict.data, updatedAt: new Date() } })", "data: { ...(args.body as object), updatedAt: new Date() } })"), 'allowed'],
  ['api-hardening is back to the unordered list of 20', rep(HARDENING, 'const foreignOwner = pid\n      ? await prisma.chatSession.findFirst({', 'const foreignOwner = pid\n      ? await prisma.chatSession.findFirst({ take: 20,'), 'hardening'],
  ['api-hardening counts the caller\'s own rows', rep(HARDENING, '            userId: { not: userId },\n', ''), 'hardening'],
]
let mutantCount = 0
for (const [name, overrides, suite] of MUTANTS) {
  mutantCount++
  let failed = false
  try { const L = load(overrides); await SUITES[suite](L) } catch (error) { if (error?.code === 'ERR_ASSERTION' || error instanceof TypeError || /unexpected import|Unexpected|is not|Cannot/.test(String(error?.message))) failed = true; else throw error; if (process.env.PL70_DEBUG) console.log(`     caught: ${String(error?.message).split('\n')[0].slice(0, 150)}`) }
  assert.ok(failed, `MUTANT NOT CAUGHT: ${name}`); caught++; console.log(`CAUGHT mutant: ${name}`)
}
console.log(`PASS: ${checks} checks passed, 0 failed (${caught}/${mutantCount} mutants caught)`)
