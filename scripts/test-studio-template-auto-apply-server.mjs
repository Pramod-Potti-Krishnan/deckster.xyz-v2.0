// FRONTEND-2 (PK, 2 Nov 17:48Z: the template auto-apply check is per USER across devices): proof of NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER (the string "true", default off, build-time; effective only with
// NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH, #559). Stacked on #559.
//   lib/studio-template-auto-apply-server.ts (pure decisions), hooks/use-studio-template-auto-apply-server.ts (the fetch), six marked lines in hooks/use-studio-template-match.ts (#559's store), the NEW route
//   app/api/preferences/template-auto-apply/route.ts, ONE marked line in prisma/schema.prisma, prisma/sql/20261102_template_auto_apply.sql, the .env.example block.
//
//   A. The route, compiled and run unchanged with a STUBBED prisma and session (no database, no network, no real account): GET / PUT, 401 signed out, 404 with either flag off, a non-boolean body rejected, an explicit
//      `select` on every query, the user taken from the session only, nothing logged that names the user or a value.
//   B. The store's decisions through the REAL hook and lib of #559, driven by #559's REAL recorded frames (scripts/studio-template-match-fixtures/frames.json; no frame is made by hand) with a stubbed fetch: the stored value
//      differs -> cache, check and a re-sent template_auto_apply; null / an error -> the cache stays; a toggle -> PUT; a frame write-back -> PUT; a failure keeps the local value; once per page; a stale answer is ignored.
//   C. The pure lib, and the I/O module's shape.
//   D. Static: the existing preferences route and the settings pages are byte-identical to #559's; the SQL file is additive only; the schema gains one marked line.
//   E. Flag off = #559, byte for byte: the hook source through the strip, and the hook's OUTPUTS (messages, storage, views) hashed with and without this change. The strip, the registry, .env.example and the scope over the
//      COMMITTED diff, gate-safe (own commits found by subject over `rev-list --no-merges BASE..HEAD`, the HEAD^2 rule).
//   F. MUTANTS: every one of them must be caught.
//
//   node scripts/test-studio-template-auto-apply-server.mjs
//
// Offline: no socket, no real fetch (the harness's host network guard is installed), no database, no secret; git is read only (objects are written from temporary files, never `hash-object --stdin`).
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
installHostNetworkGuard(net, dns)
const strip = await import('./studio-template-auto-apply-server-strip.mjs')
const matchStrip = await import('./studio-template-match-strip.mjs')
const registry = await import('./studio-later-changes.mjs')

let checks = 0, passed = 0
const failures = []
let unhandled = [] // a promise that rejects with nobody listening: in the real code that is a failure of the check that caused it; in a mutant it is the mutant being caught
process.on('unhandledRejection', error => { unhandled.push(error) })
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); if (unhandled.length) { const first = unhandled[0]; unhandled = []; throw new Error(`an unhandled rejection: ${first && first.message}`) } }
const SUITE = [] // the checks of A-D (re-run for every mutant with the mutant's text in place)
async function check(label, fn, { mutable = true } = {}) {
  if (mutable) SUITE.push({ label, fn })
  const before = checks
  try { await fn(); await settle(); passed++; console.log(`ok   ${label} (${checks - before} asserts)`) } catch (error) { failures.push(`${label}: ${error.message.split('\n')[0]}`); console.log(`FAIL ${label}\n     ${error.message.split('\n').slice(0, 4).join('\n     ')}`) }
}
async function mutant(label, run) {
  try { await run() } catch { passed++; console.log(`ok   mutant caught: ${label}`); return }
  failures.push(`mutant survived: ${label}`); console.log(`FAIL mutant survived: ${label}`)
}
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const noComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }
const lines = text => text.split('\n')
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }

// ---- the files ------------------------------------------------------------------------------------------------------------------------------------------------------------
const SLIB = 'lib/studio-template-auto-apply-server.ts', IO = 'hooks/use-studio-template-auto-apply-server.ts', ROUTE = 'app/api/preferences/template-auto-apply/route.ts'
const HOOK = 'hooks/use-studio-template-match.ts', LIB = 'lib/studio-template-match.ts', SCHEMA = 'prisma/schema.prisma', SQL = 'prisma/sql/20261102_template_auto_apply.sql'
const PREFS_ROUTE = 'app/api/preferences/route.ts'
const FLAG = strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_FLAG, MATCH_FLAG = matchStrip.STUDIO_TEMPLATE_MATCH_FLAG
const BOTH = { [MATCH_FLAG]: 'true', [FLAG]: 'true' }
const MARK = strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_MARKER_RE
const PATH_URL = '/api/preferences/template-auto-apply'

// ---- #559's recordings (the real frames) -------------------------------------------------------------------------------------------------------------------------------
const FIX = JSON.parse(read('scripts/studio-template-match-fixtures/frames.json'))
const SC = FIX.scenarios
const SESSION = 's_p47_m'
const recorded = (name, seq) => { const item = SC[name].frames.find(frame => frame.seq === seq); assert.ok(item, `${name} seq ${seq}`); return item.frame }
const ENVELOPE_CAPS = SC.M1.client_caps.slice(0, -1) // Studio's list as the recordings carry it, without the new cap
const ON_FRAME = recorded('M4', 16), OFF_FRAME = recorded('M4', 18), ON_CONNECT = recorded('M1', 7), OFF_CONNECT = recorded('M4', 7), ON_TOGGLE = recorded('M4', 15), OFF_TOGGLE = recorded('M4', 17)

// ---- evaluation of module text (the real files and the mutants) -----------------------------------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
const resolveRepo = spec => { const base = spec.slice(2); for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, base + ext))) return base + ext; throw new Error(`no repo file for ${spec}`) }
let ACTIVE = {} // a mutant's text, merged into every loader (set and restored by mutantSuite)
const src = rel => (rel in ACTIVE ? ACTIVE[rel] : read(rel))
function makeLoader({ env = {}, window, fetchFn, setTimeoutFn, consoleObj, overrides = {}, stubs = {} } = {}) {
  const cache = new Map()
  const load = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const scope = { process: { env }, ...(window !== undefined ? { window } : {}), ...(fetchFn ? { fetch: fetchFn } : {}), ...(setTimeoutFn ? { setTimeout: setTimeoutFn } : {}), ...(consoleObj ? { console: consoleObj } : {}) }
    new Function('module', 'exports', 'require', ...Object.keys(scope), compile(rel in overrides ? overrides[rel] : src(rel), rel))(module, module.exports, spec => requireFor(rel, spec), ...Object.values(scope))
    return module.exports
  }
  const requireFor = (from, spec) => {
    if (spec in stubs) return stubs[spec]
    if (spec.startsWith('@/')) return load(resolveRepo(spec))
    if (['react', 'react/jsx-runtime'].includes(spec)) return require(spec)
    throw new Error(`unexpected import ${spec} in ${from}`)
  }
  return { load }
}
const recorder = () => { const logs = []; const rec = level => (...args) => { logs.push({ level, args: args.map(a => (a instanceof Error ? a.message : String(a))) }) }; return { logs, console: { log: rec('log'), info: rec('info'), warn: rec('warn'), error: rec('error'), debug: rec('debug') } } }

// ============================================================================================================================================
// A. The route, with a stubbed prisma and session
// ============================================================================================================================================
const NextResponse = { json: (body, init = {}) => new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { 'content-type': 'application/json' } }) }
const AUTH_OPTIONS = { stub: 'authOptions' }
function routeWorld({ env = BOTH, session = { user: { id: 'u_route_1' } }, find = async () => ({ templateAutoApply: null }), upsert = async args => ({ templateAutoApply: args.update.templateAutoApply, emailMarketing: true, userId: 'x' }), sessionImpl } = {}) {
  const calls = { session: [], find: [], upsert: [] }
  const { logs, console: consoleObj } = recorder()
  const world = { session }
  const prisma = { userPreferences: { findUnique: async args => { calls.find.push(args); return find(args) }, upsert: async args => { calls.upsert.push(args); return upsert(args) } } }
  const getServerSession = async options => { calls.session.push(options); return sessionImpl ? sessionImpl() : world.session }
  const route = makeLoader({ env, consoleObj, stubs: { 'next/server': { NextResponse }, 'next-auth': { getServerSession }, '@/lib/auth-options': { authOptions: AUTH_OPTIONS }, '@/lib/prisma': { prisma } } }).load(ROUTE)
  return { route, calls, logs, world }
}
const REQ = (method, body, raw) => new Request(`http://localhost${PATH_URL}`, { method, ...(method === 'GET' ? {} : { headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) }) })
const answer = async res => ({ status: res.status, body: await res.json() })
const put = (world, body, raw) => world.route.PUT(REQ('PUT', body, raw))
const untouched = (world, label) => eq([world.calls.find.length, world.calls.upsert.length], [0, 0], `${label}: the database is not touched`)

await check('A. the route is inert while a flag is off: 404 to GET and PUT for every spelling that is not the exact "true" on BOTH flags; neither the session nor the database is touched', async () => {
  const off = [{}, { [MATCH_FLAG]: 'true' }, { [FLAG]: 'true' }, { [MATCH_FLAG]: 'false', [FLAG]: 'true' }, { [MATCH_FLAG]: 'true', [FLAG]: 'false' }, ...['TRUE', 'True', '1', 'yes', ' true', 'true ', 'on', ''].flatMap(value => [{ [MATCH_FLAG]: 'true', [FLAG]: value }, { [MATCH_FLAG]: value, [FLAG]: 'true' }])]
  for (const env of off) {
    const world = routeWorld({ env })
    eq(await answer(await world.route.GET()), { status: 404, body: { error: 'Not found' } }, `GET off ${JSON.stringify(env)}`)
    eq((await answer(await put(world, { templateAutoApply: true }))).status, 404, `PUT off ${JSON.stringify(env)}`)
    eq([world.calls.session.length, world.calls.find.length, world.calls.upsert.length, world.logs.length], [0, 0, 0, 0], `off ${JSON.stringify(env)}: no session, no database, no log`)
  }
  const on = routeWorld({ env: BOTH })
  eq((await answer(await on.route.GET())).status, 200, 'both flags "true": the route answers')
})

await check('A. signed out (no session, no user, no user id): 401 to GET and PUT, the database is not touched', async () => {
  for (const session of [null, 'undefined', {}, { user: null }, { user: {} }, { user: { id: '' } }, { user: { id: null } }]) {
    const world = routeWorld(session === 'undefined' ? { sessionImpl: () => undefined } : { session })
    eq(await answer(await world.route.GET()), { status: 401, body: { error: 'Unauthorized' } }, `GET signed out ${JSON.stringify(session)}`)
    eq((await answer(await put(world, { templateAutoApply: true }))).status, 401, `PUT signed out ${JSON.stringify(session)}`)
    untouched(world, `signed out ${JSON.stringify(session)}`)
    ok(world.calls.session.every(options => options === AUTH_OPTIONS), 'the session is read with the app\'s authOptions')
  }
})

await check('A. GET: the stored value (true, false) or null (never set, or no row); a read, with an explicit select and the session\'s user', async () => {
  for (const [row, expected] of [[{ templateAutoApply: true }, true], [{ templateAutoApply: false }, false], [{ templateAutoApply: null }, null], [null, null], [undefined, null]]) {
    const world = routeWorld({ find: async () => row })
    eq(await answer(await world.route.GET()), { status: 200, body: { templateAutoApply: expected } }, `GET ${JSON.stringify(row)}`)
    eq(world.calls.find, [{ where: { userId: 'u_route_1' }, select: { templateAutoApply: true } }], 'one query: keyed on the session\'s user, the one column selected')
    eq(world.calls.upsert.length, 0, 'a GET writes nothing')
  }
  const rich = routeWorld({ find: async () => ({ templateAutoApply: true, emailMarketing: true, userId: 'u_x', id: 'row' }) })
  eq((await answer(await rich.route.GET())).body, { templateAutoApply: true }, 'only the one field is returned')
})

await check('A. PUT true / false: an upsert keyed on the session\'s user, the one column in update and create, an explicit select; the answer carries the one field', async () => {
  for (const value of [true, false]) {
    const world = routeWorld({ session: { user: { id: 'u_route_9' } } })
    eq(await answer(await put(world, { templateAutoApply: value })), { status: 200, body: { templateAutoApply: value } }, `PUT ${value}`)
    eq(world.calls.upsert, [{ where: { userId: 'u_route_9' }, update: { templateAutoApply: value }, create: { userId: 'u_route_9', templateAutoApply: value }, select: { templateAutoApply: true } }], `PUT ${value}: the upsert, exactly`)
    eq(world.calls.find.length, 0, 'a PUT reads nothing first')
  }
})

await check('A. PUT validates strictly: only an object with exactly one key, a boolean; anything else is 400 and the database is not touched', async () => {
  const bad = [{}, { templateAutoApply: 'true' }, { templateAutoApply: 'false' }, { templateAutoApply: 1 }, { templateAutoApply: 0 }, { templateAutoApply: null }, { templateAutoApply: {} }, { templateAutoApply: [true] }, [], [true], true, false, 'true', 7, null,
    { templateAutoApply: true, userId: 'u_other' }, { templateAutoApply: true, extra: 1 }, { TemplateAutoApply: true }, { template_auto_apply: true }, { enabled: true }]
  for (const body of bad) {
    const world = routeWorld()
    const res = await answer(await put(world, body))
    eq(res.status, 400, `PUT ${JSON.stringify(body)} is refused`)
    untouched(world, `PUT ${JSON.stringify(body)}`)
  }
  for (const raw of ['{', '', 'not json', '{"templateAutoApply":true']) {
    const world = routeWorld()
    eq((await answer(await put(world, null, raw))).status, 400, `PUT ${JSON.stringify(raw)} (not JSON) is refused`)
    untouched(world, `PUT ${JSON.stringify(raw)}`)
  }
  const proto = routeWorld()
  eq((await answer(await put(proto, null, '{"__proto__":{"templateAutoApply":true}}'))).status, 400, 'a __proto__ body is refused')
  untouched(proto, '__proto__')
})

await check('A. the user comes from the session only: two sessions, two keys; a body cannot name another user', async () => {
  for (const id of ['u_a', 'u_b']) {
    const world = routeWorld({ session: { user: { id } } })
    await put(world, { templateAutoApply: false })
    eq(world.calls.upsert[0].where, { userId: id }, `the key is ${id}`)
    eq(world.calls.upsert[0].create.userId, id, `the created row is ${id}'s`)
  }
})

await check('A. a failure is 500 with a fixed body and ONE fixed log line: nothing names the user, a value or the error', async () => {
  const secretError = new Error('Invalid `prisma.userPreferences.upsert()` invocation: userId u_route_1 templateAutoApply true')
  for (const make of [() => routeWorld({ find: async () => { throw secretError }, upsert: async () => { throw secretError } }), () => routeWorld({ sessionImpl: () => { throw secretError } })]) {
    const world = make()
    const got = await answer(await world.route.GET())
    eq(got.status, 500, 'GET fails with 500'); ok(!JSON.stringify(got.body).includes('u_route_1'), 'the body names no user')
    const got2 = await answer(await put(world, { templateAutoApply: true }))
    eq(got2.status, 500, 'PUT fails with 500'); ok(!JSON.stringify(got2.body).includes('u_route_1') && !/true/.test(JSON.stringify(got2.body)), 'the body names neither a user nor a value')
    eq(world.logs.length, 2, 'one log line per failure')
    for (const entry of world.logs) { eq(entry.level, 'error', 'an error line'); eq(entry.args.length, 1, 'one argument: no error object, no value'); ok(/^\[api\/preferences\/template-auto-apply\] (GET|PUT) failed$/.test(entry.args[0]), entry.args[0]); ok(!/u_route_1|true|false/.test(entry.args[0]), 'the line names neither the user nor a value') }
  }
  const world = routeWorld()
  await world.route.GET(); await put(world, { templateAutoApply: false })
  eq(world.logs, [], 'a good request logs nothing at all')
})

await check('A. the route\'s source: every query narrows with an explicit select, the only console call is the fixed error line, the exports are GET, PUT and dynamic, and it imports the same four modules as /api/preferences', () => {
  const text = noComments(src(ROUTE))
  const calls = text.match(/prisma\.userPreferences\.\w+\(/g) ?? []
  eq(calls.sort(), ['prisma.userPreferences.findUnique(', 'prisma.userPreferences.upsert('], 'two queries: a read and an upsert')
  eq((text.match(/select: \{ templateAutoApply: true \}/g) ?? []).length, 2, 'both name the select')
  eq((text.match(/console\.\w+\(/g) ?? []).sort(), ['console.error(', 'console.error('], 'two console calls, both error')
  ok(!/console\.error\([^"\n]*[,+`$]/.test(text), 'the error line is a fixed string')
  eq([...text.matchAll(/^export (?:async function |const )(\w+)/gm)].map(match => match[1]).sort(), ['GET', 'PUT', 'dynamic'], 'exports')
  ok(/export const dynamic = "force-dynamic"/.test(text), 'never evaluated at build time')
  eq([...text.matchAll(/^import .* from "([^"]+)"/gm)].map(match => match[1]).sort(), ['@/lib/auth-options', '@/lib/prisma', '@/lib/studio-template-auto-apply-server', 'next-auth', 'next/server'], 'imports')
  ok(!/process\.env|req\.url|searchParams|headers\.get|cookies/.test(text), 'the route reads nothing but the session and the body')
})

// ============================================================================================================================================
// B. The store\'s decisions, through the real hook and lib of #559, on #559\'s real recorded frames, with a stubbed fetch
// ============================================================================================================================================
const fakeStorage = seed => {
  const map = new Map(seed ? Object.entries(seed) : [])
  const storage = { map, writes: 0, getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { storage.writes++; map.set(key, String(value)) } }
  return storage
}
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new Error('no body'); return body } })
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const STORAGE_KEY = 'studio.templateAutoApply.v1'
function hookWorld({ env = BOTH, storage = fakeStorage(), handler, overrides = {} } = {}) {
  const fetchLog = [], delays = []
  const { logs, console: consoleObj } = recorder()
  const world = { handler }
  const fetchFn = (url, init) => { fetchLog.push({ url, init }); const index = fetchLog.length; return Promise.resolve().then(() => { if (!world.handler) throw new Error('no network'); return world.handler(url, init, index) }) }
  const setTimeoutFn = (fn, ms) => { delays.push(ms); if (delays.length <= 20) queueMicrotask(fn); return 0 } // a runaway retry (a mutant) stops waiting after 20 delays instead of looping for ever
  const loader = makeLoader({ env, window: { localStorage: storage }, fetchFn, setTimeoutFn, consoleObj, overrides })
  const hook = loader.load(HOOK), lib = loader.load(LIB), io = loader.load(IO), slib = loader.load(SLIB)
  hook.studioTemplateMatchStore.reset(); io.autoApplyServerReset()
  return Object.assign(world, { storage, fetchLog, delays, logs, hook, lib, io, slib })
}
function open(world, { userId = 'u_test', sessionId = SESSION } = {}) {
  const sent = []
  const socket = { send: message => { sent.push(message); return true }, caps: () => ENVELOPE_CAPS }
  world.hook.templateMatchSocketOpened({ sessionId, userId, socket })
  return sent
}
const stored = world => JSON.parse(world.storage.map.get(STORAGE_KEY) ?? 'null')
const autoApply = world => world.hook.studioTemplateMatchStore.getSnapshot().autoApply
const puts = world => world.fetchLog.filter(call => call.init.method === 'PUT').map(call => JSON.parse(call.init.body))
const gets = world => world.fetchLog.filter(call => call.init.method === 'GET')
const getReply = (status, body) => (url, init) => (init.method === 'GET' ? reply(status, body) : reply(200, { templateAutoApply: JSON.parse(init.body).templateAutoApply }))

await check('B. the stored value differs from the cache: ONE GET, then the cache, the check and a re-sent template_auto_apply (the recorded "off" envelope) follow it; the connect-time send had gone out first, with the cache', async () => {
  const world = hookWorld({ handler: getReply(200, { templateAutoApply: false }) })
  const sent = open(world)
  eq(sent, [ON_CONNECT], 'at connect: the recorded "on" envelope (the cache), before anything is fetched')
  eq(world.fetchLog.length, 1, 'one request was started, without waiting')
  await flush()
  eq([gets(world).length, world.fetchLog[0].url, world.fetchLog[0].init.method, world.fetchLog[0].init.credentials, 'body' in world.fetchLog[0].init], [1, PATH_URL, 'GET', 'same-origin', false], 'a same-origin GET of the route, no body')
  eq(sent, [ON_CONNECT, OFF_CONNECT], 'the stored OFF is re-sent on the open socket: the recorded "off" envelope')
  eq([stored(world), autoApply(world), world.storage.writes], [{ u_test: false }, false, 1], 'the cache holds it (once), the check follows')
  eq(world.fetchLog.length, 1, 'adopting a stored value is not PUT back')
  // and the other way: cache OFF, stored ON
  const back = hookWorld({ storage: fakeStorage({ [STORAGE_KEY]: JSON.stringify({ u_test: false, u_other: false }) }), handler: getReply(200, { templateAutoApply: true }) })
  const sent2 = open(back); await flush()
  eq(sent2, [OFF_CONNECT, ON_CONNECT], 'cache OFF, stored ON: off at connect, then the recorded "on" envelope')
  eq([stored(back), autoApply(back)], [{ u_test: true, u_other: false }, true], 'the cache is the user\'s; another user\'s entry is left as it was')
})

await check('B. the answer is then followed by Director\'s recorded frames as ever: the frame of the adopted value writes nothing and PUTs nothing; a recorded frame that differs is the standing change (cache + PUT)', async () => {
  const world = hookWorld({ handler: getReply(200, { templateAutoApply: false }) })
  const sent = open(world); await flush()
  const writes = world.storage.writes
  ok(world.hook.templateMatchFrameReceived(OFF_FRAME, SESSION), 'M4 seq 18 (auto_apply false) is taken')
  await flush()
  eq([world.storage.writes, puts(world), sent.length], [writes, [], 2], 'its auto_apply equals the adopted value: nothing written, nothing PUT, nothing sent')
  ok(world.hook.templateMatchFrameReceived(ON_FRAME, SESSION), 'M4 seq 16 (auto_apply true) is taken')
  await flush()
  eq([autoApply(world), stored(world), puts(world), sent.length], [true, { u_test: true }, [{ templateAutoApply: true }], 2], 'a differing frame: the standing change is cached and PUT, nothing is sent back')
})

await check('B. the stored value is null, missing, or not a boolean, or equals the cache: nothing changes (no write, no check change, no re-send, no PUT)', async () => {
  for (const [label, handlerReply] of [['null', reply(200, { templateAutoApply: null })], ['no key', reply(200, {})], ['a string', reply(200, { templateAutoApply: 'false' })], ['a number', reply(200, { templateAutoApply: 0 })], ['an array', reply(200, [false])], ['not an object', reply(200, 'false')], ['equal to the cache', reply(200, { templateAutoApply: true })], ['unreadable JSON', reply(200, undefined)]]) {
    const world = hookWorld({ handler: () => handlerReply })
    const sent = open(world); await flush()
    eq([sent, world.storage.writes, world.storage.map.size, autoApply(world), puts(world), world.logs], [[ON_CONNECT], 0, 0, true, [], []], `${label}: the cache stays`)
  }
  const off = hookWorld({ storage: fakeStorage({ [STORAGE_KEY]: JSON.stringify({ u_test: false }) }), handler: getReply(200, { templateAutoApply: null }) })
  const sent = open(off); await flush()
  eq([sent, autoApply(off), puts(off)], [[OFF_CONNECT], false, []], 'a cached OFF with nothing stored stays OFF, and is not pushed up')
})

await check('B. the user\'s check is PUT: the toggle (off, then on) sends the recorded envelopes and one PUT each, same-origin, JSON, in order', async () => {
  const world = hookWorld({ handler: getReply(200, { templateAutoApply: null }) })
  const sent = open(world); await flush()
  world.hook.setTemplateAutoApply(false); await flush()
  world.hook.setTemplateAutoApply(true); await flush()
  eq(sent, [ON_CONNECT, OFF_TOGGLE, ON_TOGGLE], 'the recorded toggle envelopes, as without this change')
  eq(puts(world), [{ templateAutoApply: false }, { templateAutoApply: true }], 'one PUT per toggle, in order')
  const call = world.fetchLog.filter(item => item.init.method === 'PUT')[0]
  eq([call.url, call.init.method, call.init.credentials, call.init.headers, call.init.keepalive, call.init.body], [PATH_URL, 'PUT', 'same-origin', { 'Content-Type': 'application/json' }, true, '{"templateAutoApply":false}'], 'the request: path, method, same-origin, JSON, keepalive (a page closed right after still saves), the body')
  eq(stored(world), { u_test: true }, 'the cache is written by the toggle as before')
})

await check('B. a frame write-back is PUT: a recorded frame whose auto_apply differs from the preference (a chat "no template") saves it; a refresh, our own toggle\'s answer, another session\'s frame and a switch to null save nothing', async () => {
  let world = hookWorld({ handler: getReply(200, { templateAutoApply: null }) })
  open(world); await flush()
  ok(world.hook.templateMatchFrameReceived(OFF_FRAME, SESSION), 'M4 seq 18 (auto_apply false) while the preference is ON'); await flush()
  eq([puts(world), stored(world), autoApply(world)], [[{ templateAutoApply: false }], { u_test: false }, false], 'cached and PUT (false), once')
  world.hook.templateMatchFrameReceived(recorded('M4', 14), SESSION); world.hook.templateMatchFrameReceived(OFF_FRAME, SESSION); await flush()
  eq(puts(world), [{ templateAutoApply: false }], 'refreshes with the same value: nothing more')
  world = hookWorld({ handler: getReply(200, { templateAutoApply: null }) }); open(world); await flush()
  world.hook.templateMatchFrameReceived(recorded('M1', 14), SESSION); world.hook.templateMatchFrameReceived(recorded('M1', 14), SESSION)
  world.hook.templateMatchFrameReceived(recorded('M3', 23), SESSION); world.hook.templateMatchFrameReceived(OFF_FRAME, 's_other'); await flush()
  eq(puts(world), [], 'a refresh (ON), a switch to null (M3 seq 23) and another session\'s frame: nothing PUT')
  world = hookWorld({ handler: getReply(200, { templateAutoApply: null }) }); open(world); await flush()
  world.hook.setTemplateAutoApply(false); world.hook.templateMatchFrameReceived(OFF_FRAME, SESSION); await flush()
  eq(puts(world), [{ templateAutoApply: false }], 'our own toggle\'s answer is not saved a second time')
})

await check('B. a failure keeps the local value: GET fails (network, 500, 401, 404, 403, unreadable) and PUT fails (network twice, 500 twice) with nothing thrown and NOTHING logged', async () => {
  for (const [label, handler] of [['network', () => { throw new Error('offline for u_test') }], ['500', () => reply(500, { error: 'x' })], ['403', () => reply(403, {})], ['401', () => reply(401, {})], ['404', () => reply(404, {})]]) {
    const world = hookWorld({ handler })
    const sent = open(world); await flush()
    eq([sent, autoApply(world), world.storage.map.size, world.logs], [[ON_CONNECT], true, 0, []], `GET ${label}: the cache stays, nothing logged`)
  }
  const down = hookWorld({ handler: () => { throw new Error('offline for u_test') } })
  open(down); await flush()
  down.hook.setTemplateAutoApply(false); await flush()
  eq([down.fetchLog.length, down.delays, autoApply(down), stored(down), down.logs], [3, [1500], false, { u_test: false }, []], 'PUT with the network down: tried, one retry after 1.5 s, then given up; the local value is kept; nothing logged (1 GET + 2 PUT calls)')
  const flaky = hookWorld({ handler: getReply(200, { templateAutoApply: null }) })
  open(flaky); await flush()
  let n = 0
  flaky.handler = (url, init) => (init.method === 'PUT' && ++n === 1 ? reply(503, {}) : reply(200, { templateAutoApply: false }))
  flaky.hook.setTemplateAutoApply(false); await flush()
  eq([puts(flaky), flaky.delays], [[{ templateAutoApply: false }, { templateAutoApply: false }], [1500]], 'a 5xx is retried once and then it is saved')
  const refused = hookWorld({ handler: getReply(200, { templateAutoApply: null }) })
  open(refused); await flush()
  refused.handler = (url, init) => reply(400, {})
  refused.hook.setTemplateAutoApply(false); await flush()
  eq([puts(refused).length, refused.delays, autoApply(refused), refused.logs], [1, [], false, []], 'a 4xx is not retried and the local value stays')
})

await check('B. a 401 or a 404 (signed out; the route is off on the server) stops every further request this page: no PUT after it', async () => {
  for (const status of [401, 404]) {
    const world = hookWorld({ handler: () => reply(status, {}) })
    open(world); await flush()
    world.hook.setTemplateAutoApply(false); world.hook.templateMatchFrameReceived(OFF_FRAME, SESSION); await flush()
    eq([world.fetchLog.length, autoApply(world), stored(world)], [1, false, { u_test: false }], `GET ${status}: one request only, the local value works as in #559`)
  }
  const world = hookWorld({ handler: getReply(200, { templateAutoApply: null }) })
  open(world); await flush()
  world.handler = () => reply(404, {})
  world.hook.setTemplateAutoApply(false); await flush()
  world.hook.setTemplateAutoApply(true); world.hook.templateMatchFrameReceived(OFF_FRAME, SESSION); await flush()
  eq(world.fetchLog.length, 2, 'a PUT answered 404 stops the rest: GET + one PUT')
})

await check('B. once per page and user: a second socket of the same user asks nothing; another user asks again; no user id (a visitor) asks and saves nothing', async () => {
  const world = hookWorld({ handler: getReply(200, { templateAutoApply: null }) })
  open(world); await flush(); open(world); open(world, { sessionId: 's_other_session' }); await flush()
  eq(gets(world).length, 1, 'one GET for three sockets of one user')
  open(world, { userId: 'u_second' }); await flush()
  eq(gets(world).length, 2, 'another user: asked again')
  for (const userId of [null, '']) {
    const visitor = hookWorld({ handler: getReply(200, { templateAutoApply: false }) })
    const sent = open(visitor, { userId }); visitor.hook.setTemplateAutoApply(false); visitor.hook.templateMatchFrameReceived(OFF_FRAME, SESSION); await flush()
    eq([visitor.fetchLog.length, sent.length], [0, 2], `no user (${JSON.stringify(userId)}): nothing is fetched (the connect send and the toggle still go out)`)
  }
})

await check('B. a stale answer is ignored: after a toggle, or a frame write-back, or another user opened a socket, the GET\'s answer changes nothing (the newer value is the one PUT)', async () => {
  const cases = [
    ['a toggle', world => { world.hook.setTemplateAutoApply(true) }, [{ templateAutoApply: true }]],
    ['a frame write-back', world => { world.hook.templateMatchFrameReceived(OFF_FRAME, SESSION) }, [{ templateAutoApply: false }]],
  ]
  for (const [label, act, expectedPuts] of cases) {
    const gate = defer()
    const world = hookWorld({ handler: (url, init) => (init.method === 'GET' ? gate.promise : reply(200, {})) })
    const sent = open(world)
    // the stored value says the opposite of what the user just did
    act(world)
    const after = autoApply(world), sentBefore = sent.length
    gate.resolve(reply(200, { templateAutoApply: !after }))
    await flush()
    eq([autoApply(world), sent.length, puts(world)], [after, sentBefore, expectedPuts], `${label} while the GET was out: the answer is dropped, nothing re-sent, the newer value is PUT`)
  }
  const gate = defer()
  const world = hookWorld({ handler: (url, init, n) => (init.method === 'GET' ? (n === 1 ? gate.promise : reply(200, { templateAutoApply: null })) : reply(200, {})) })
  const sent = open(world)
  open(world, { userId: 'u_second', sessionId: 's_second' })
  gate.resolve(reply(200, { templateAutoApply: false })); await flush()
  eq([autoApply(world), sent.length, stored(world), puts(world)], [true, 1, null, []], 'another user signed in while the GET was out: the first user\'s answer is dropped (the second user\'s own answer is null)')
})

await check('B. PUTs go out in order, one at a time (a slow first PUT does not let the second overtake it)', async () => {
  const world = hookWorld({ handler: getReply(200, { templateAutoApply: null }) })
  open(world); await flush()
  const gate = defer()
  world.handler = (url, init) => (JSON.parse(init.body).templateAutoApply === false ? gate.promise : reply(200, {}))
  world.hook.setTemplateAutoApply(false); world.hook.setTemplateAutoApply(true); await flush()
  eq(puts(world), [{ templateAutoApply: false }], 'the second waits for the first')
  gate.resolve(reply(200, {})); await flush()
  eq(puts(world), [{ templateAutoApply: false }, { templateAutoApply: true }], 'then it goes: last write wins, in order')
})

/** Studio's side of one recording, driven the way the UI drives it (as #559's proof does): the socket opens, each recorded step is replayed. Everything observable is returned. */
function replayOutputs(world, name) {
  const { hook } = world
  const first = SC[name].frames.find(step => step.direction === 'in' && step.type === 'template_auto_apply')
  if (first && first.frame.data.enabled === false) world.storage.map.set(STORAGE_KEY, JSON.stringify({ u_test: false }))
  const sent = [], views = [], returns = []
  const socket = { send: message => { sent.push(message); return true }, caps: () => ENVELOPE_CAPS }
  returns.push(hook.templateMatchSocketOpened({ sessionId: SESSION, userId: 'u_test', socket }))
  let seenConnect = false
  const view = () => { const s = hook.studioTemplateMatchStore.getSnapshot(); return JSON.stringify({ a: s.autoApply, b: s.badge, c: [...s.chips.entries()], r: s.rows, f: s.frame !== null }) }
  for (const step of SC[name].frames) {
    if (step.direction === 'in' && step.type === 'template_auto_apply') { if (seenConnect) returns.push(hook.setTemplateAutoApply(step.frame.data.enabled)); seenConnect = true }
    else if (step.direction === 'in' && step.type === 'template_switch') returns.push(hook.switchTemplate(step.frame.data.template_id))
    else if (step.type === 'template_match') returns.push(hook.templateMatchFrameReceived(step.frame, SESSION))
    views.push(view())
  }
  return { sent, views, returns, writes: world.storage.writes, map: [...world.storage.map.entries()] }
}
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

await check('B. FLAG OFF is #559: with the server flag off (unset, "false", "TRUE") or the template match off, all seven recordings are replayed through the hook with NO request at all, and every output (messages, views, storage, return values) hashes the same as the hook without this change', async () => {
  const baseHook = strip.stripStudioTemplateAutoApplyServer(HOOK, src(HOOK))
  ok(baseHook !== src(HOOK), 'the hook with this change differs from #559\'s')
  for (const env of [{ [MATCH_FLAG]: 'true' }, { [MATCH_FLAG]: 'true', [FLAG]: 'false' }, { [MATCH_FLAG]: 'true', [FLAG]: 'TRUE' }, { [MATCH_FLAG]: 'true', [FLAG]: '' }]) {
    const hashes = []
    for (const name of Object.keys(SC)) {
      const now = hookWorld({ env, handler: () => { throw new Error('a request while the flag is off') } }), before = hookWorld({ env, overrides: { [HOOK]: baseHook } })
      const a = replayOutputs(now, name), b = replayOutputs(before, name)
      eq(a, b, `${JSON.stringify(env)} ${name}: the same outputs as #559's hook`)
      eq([now.fetchLog.length, now.logs.length], [0, 0], `${JSON.stringify(env)} ${name}: no request, no log`)
      hashes.push([name, sha(a).slice(0, 12), sha(b).slice(0, 12)])
    }
    for (const [name, now, before] of hashes) eq(now, before, `${name}: output hash`)
    if (JSON.stringify(env) === JSON.stringify({ [MATCH_FLAG]: 'true' })) console.log(`     output hashes with this change / without it (flag off): ${hashes.map(h => `${h[0]} ${h[1]}=${h[2]}`).join(', ')}`)
  }
  const matchOff = hookWorld({ env: { [FLAG]: 'true' }, handler: () => { throw new Error('a request') } })
  const sent = []
  eq([matchOff.hook.templateMatchSocketOpened({ sessionId: SESSION, userId: 'u_test', socket: { send: message => { sent.push(message); return true }, caps: () => ENVELOPE_CAPS } }), matchOff.hook.setTemplateAutoApply(false), matchOff.hook.templateMatchFrameReceived(OFF_FRAME, SESSION)], [false, false, false], 'the template match off: the hook returns at once, as in #559')
  eq([sent, matchOff.fetchLog.length, matchOff.storage.writes], [[], 0, 0], 'the server flag alone does nothing: no message, no request, no write')
})

await check('B. FLAG ON: the recordings still replay exactly as #559 does with the stored value null (the same messages, views and storage), with only the GET added', async () => {
  const baseHook = strip.stripStudioTemplateAutoApplyServer(HOOK, src(HOOK))
  for (const name of Object.keys(SC)) {
    const now = hookWorld({ handler: getReply(200, { templateAutoApply: null }) }), before = hookWorld({ env: { [MATCH_FLAG]: 'true' }, overrides: { [HOOK]: baseHook } })
    eq(replayOutputs(now, name), replayOutputs(before, name), `${name}: same outputs`)
    await flush()
    eq(gets(now).length, 1, `${name}: one GET`)
  }
})

// ============================================================================================================================================
// C. The pure lib and the I/O module\'s shape
// ============================================================================================================================================
await check('C. the lib: the flag needs BOTH flags to be the exact "true"; the wire; what to adopt; what stops the calls; the one retry; the strict PUT body', () => {
  const lib = makeLoader({ env: BOTH }).load(SLIB), libOff = makeLoader({ env: { [MATCH_FLAG]: 'true' } }).load(SLIB), libOnly = makeLoader({ env: { [FLAG]: 'true' } }).load(SLIB)
  eq([lib.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED, libOff.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED, libOnly.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED, makeLoader({ env: {} }).load(SLIB).STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED], [true, false, false, false], 'on only with both')
  for (const value of [undefined, '', 'false', '0', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']) eq([lib.templateAutoApplyServerActive('true', value), lib.templateAutoApplyServerActive(value, 'true')], [false, false], `${JSON.stringify(value)} is off`)
  eq(lib.templateAutoApplyServerActive('true', 'true'), true, 'both "true"')
  eq(lib.TEMPLATE_AUTO_APPLY_SERVER_PATH, PATH_URL, 'the path')
  eq([true, false, null, undefined, 'true', 'false', 1, 0, {}, [], { templateAutoApply: 'true' }].map(value => lib.parseServerPreference(value)), Array(11).fill(null), 'only {templateAutoApply: boolean} reads as a value')
  eq([lib.parseServerPreference({ templateAutoApply: true }), lib.parseServerPreference({ templateAutoApply: false }), lib.parseServerPreference({ templateAutoApply: null }), lib.parseServerPreference({ templateAutoApply: true, other: 1 })], [true, false, null, true], 'a boolean, null; an extra key is no harm on the client')
  eq([lib.serverPreferenceBody(true), lib.serverPreferenceBody(false), lib.serverPreferenceBody('yes')], [{ templateAutoApply: true }, { templateAutoApply: false }, { templateAutoApply: false }], 'the PUT body is a boolean, only true is true')
  eq([lib.serverPreferenceToAdopt({ server: false, local: true, changedSinceAsk: false }), lib.serverPreferenceToAdopt({ server: true, local: false, changedSinceAsk: false }), lib.serverPreferenceToAdopt({ server: true, local: true, changedSinceAsk: false }), lib.serverPreferenceToAdopt({ server: false, local: false, changedSinceAsk: false })], [false, true, null, null], 'adopt when it differs')
  eq([null, undefined, 'false', 0, {}, []].map(server => lib.serverPreferenceToAdopt({ server, local: true, changedSinceAsk: false })), Array(6).fill(null), 'a stored value that is not a boolean is never adopted')
  eq(lib.serverPreferenceToAdopt({ server: false, local: true, changedSinceAsk: true }), null, 'not after a change since the question')
  eq(lib.serverPreferenceToAdopt({ server: false, local: 'yes', changedSinceAsk: false }), null, 'no real local value: nothing')
  eq([401, 404, 200, 403, 500, null].map(status => lib.serverPreferenceUnavailable(status)), [true, true, false, false, false, false], 'only 401 and 404 stop the calls')
  eq([[null, 0], [500, 0], [503, 0], [599, 0], [400, 0], [401, 0], [404, 0], [200, 0], [null, 1], [500, 1], [503, 2]].map(([status, attempt]) => lib.shouldRetryServerPut(status, attempt)), [true, true, true, true, false, false, false, false, false, false, false], 'one retry, only a network error or a 5xx')
  eq([{ templateAutoApply: true }, { templateAutoApply: false }].map(body => lib.parseServerPutBody(body)), [true, false], 'the PUT body: a boolean')
  eq([{}, { templateAutoApply: 1 }, { templateAutoApply: null }, { templateAutoApply: true, a: 1 }, { a: true }, [], null, true, 'x', undefined, [true]].map(body => lib.parseServerPutBody(body)), Array(11).fill(null), 'anything else is null')
  const proto = JSON.parse('{"__proto__":{"templateAutoApply":true}}')
  eq(lib.parseServerPutBody(proto), null, 'a __proto__ key is not the key')
})

await check('C. the lib is import-free and pure (no storage, no network, no DOM, no clock); the I/O module has one fetch, no log, no storage, and reaches only the lib', () => {
  const lib = noComments(src(SLIB)), io = noComments(src(IO))
  ok(!/^import /m.test(lib) && !/\brequire\(/.test(lib), 'lib: import-free')
  eq([...lib.matchAll(/process\.env\.(\w+)/g)].map(match => match[1]).sort(), [FLAG, MATCH_FLAG].sort(), 'lib: two literal process.env reads (so Next inlines them), the two flags')
  ok(!/localStorage|sessionStorage|\bwindow\b|\bdocument\b|\bfetch\b|Date\.now|setTimeout|Math\.random|console\./.test(lib), 'lib: no storage, DOM, network, clock or log')
  eq((io.match(/\bfetch\(/g) ?? []).length, 1, 'io: one fetch call'); ok(!/console\.|localStorage|sessionStorage|process\.env|\bwindow\b|\bdocument\b/.test(io), 'io: no log, no storage, no env, no DOM')
  eq([...io.matchAll(/^import[\s\S]*?from "([^"]+)"/gm)].map(match => match[1]), ['@/lib/studio-template-auto-apply-server'], 'io: imports only the lib')
  ok(/export function autoApplyServerAsk\([^)]*\): void \{\n  if \(!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED/.test(io) && /export function autoApplyServerSave\([^)]*\): void \{\n  if \(!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED/.test(io), 'io: both entry points return at once with the flag off')
})

// ============================================================================================================================================
// D. Static: the existing route and the settings pages, the SQL, the schema line
// ============================================================================================================================================
const gitText = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 })
const git = (...a) => gitText(...a)
const BASE_COMMIT = strip.BASE_COMMIT
const baseOk = (() => { try { git('cat-file', '-e', `${BASE_COMMIT}^{commit}`); return true } catch { return false } })()
const SUBJECT = strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_SUBJECT
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = c => git('rev-list', '--parents', '-n', '1', c).trim().split(/\s+/).slice(1)
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT))
/** GATE-SAFE head: on the gate's merge (first parent dev, second parent this change's head) the scope runs against HEAD^2; a branch head is used as it is. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-02T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-02T00:00:00Z' }
const plumb = (args, extra = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const applyAll = (fns, rel, text) => fns.reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(fn => fn !== strip.stripStudioTemplateAutoApplyServer), rel, text)
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(strip.stripStudioTemplateAutoApplyServer); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const HEAD = baseOk ? scopeHead('HEAD') : null
const HAS_OWN = baseOk && ownOf(HEAD).length > 0
const headText = (rel, head = HEAD) => (HAS_OWN ? git('show', `${head}:${rel}`) : read(rel)) // this change's files at its own head (the working tree until the first commit exists)
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)

if (baseOk) {
  await check('D. the existing /api/preferences route and every settings page are byte-identical to #559\'s (not edited), in the working tree and at the head; the route still selects every field, which is why the column comes first', () => {
    const listing = (ref) => git('ls-tree', '-r', ref, '--', 'app/api/preferences/route.ts', 'app/(app)/settings').split('\n').filter(Boolean)
    const files = listing(BASE_COMMIT)
    ok(files.length >= 3 && files.some(row => row.endsWith('app/api/preferences/route.ts')) && files.some(row => row.includes('settings/notifications/page.tsx')) && files.some(row => row.includes('settings/privacy/page.tsx')), `the settings pages and the route are there (${files.length} files)`)
    eq(listing(HEAD), files, 'the same files with the same blobs at the head')
    eq(git('status', '--porcelain', '--', 'app/api/preferences/route.ts', 'app/(app)/settings').trim(), '', 'the working tree has no change there')
    eq(git('ls-files', '--others', '--exclude-standard', '--', 'app/(app)/settings').trim(), '', 'no new file under the settings pages')
    eq(git('ls-tree', '-r', '--name-only', HEAD, '--', 'app/api/preferences').split('\n').filter(Boolean).sort(), ['app/api/preferences/route.ts', 'app/api/preferences/template-auto-apply/route.ts'], 'the only new file under app/api/preferences is the new route')
    const prefs = read(PREFS_ROUTE)
    eq((prefs.match(/prisma\.userPreferences\.upsert\(/g) ?? []).length, 2, 'the existing route has its two upserts')
    ok(!/\bselect\b/.test(noComments(prefs)), 'and neither narrows with select: the generated client reads EVERY column, so the column must exist before the schema field is merged')
  }, { mutable: false })

  await check('D. the SQL file is additive and idempotent: one ALTER TABLE ... ADD COLUMN IF NOT EXISTS (nullable, no default); no DROP / RENAME / TYPE / DEFAULT / NOT NULL / UPDATE / DELETE outside comments; the header orders the apply BEFORE the merge; the rollback and the read-only check are in it', () => {
    const sql = read(SQL)
    const code = sql.split('\n').filter(row => !row.trim().startsWith('--')).join('\n').trim()
    eq(code, 'ALTER TABLE fe_user_preferences ADD COLUMN IF NOT EXISTS template_auto_apply boolean;', 'the only statement')
    ok(!/\b(DROP|RENAME|TRUNCATE|DELETE|UPDATE|INSERT|DEFAULT|NOT\s+NULL|ALTER\s+COLUMN|\bTYPE\b|CASCADE|CREATE|GRANT|REVOKE)\b/i.test(code), 'no destructive or other-column keyword in the executable code')
    eq((code.match(/ALTER TABLE/gi) ?? []).length, 1, 'one ALTER TABLE'); eq((code.match(/;/g) ?? []).length, 1, 'one statement')
    ok(/IF NOT EXISTS/.test(code), 'idempotent')
    ok(/^-- .*(\n-- .*)*\n-- APPLY THIS BEFORE THE PR/m.test(sql) || /APPLY THIS BEFORE THE PR THAT ADDS/.test(sql), 'the header says: apply BEFORE the PR is merged')
    ok(/Additive only and idempotent/.test(sql) && /Nullable, NO default/.test(sql) && /NULL means "never set"/.test(sql), 'the header says: additive, idempotent, nullable with no default, NULL = never set')
    ok(sql.includes('--   ALTER TABLE fe_user_preferences DROP COLUMN IF EXISTS template_auto_apply;'), 'the rollback line (a comment)')
    ok(sql.includes("WHERE table_name = 'fe_user_preferences' AND column_name = 'template_auto_apply';") && sql.includes('template_auto_apply | boolean | YES'), 'the read-only check and its expected row (a comment)')
    ok(/fe_user_preferences/.test(sql) && !/[^_]user_preferences/.test(code), 'the table is fe_user_preferences')
    const existing = git('ls-tree', '--name-only', BASE_COMMIT, 'prisma/sql/').split('\n').filter(Boolean)
    ok(existing.length >= 10 && !existing.includes(SQL), 'a new file next to the older hand-run files')
  }, { mutable: false })

  await check('D. prisma/schema.prisma gains ONE marked line, inside model UserPreferences, nullable, no default, mapped to template_auto_apply; nothing else changes, and the strip gives the base back', () => {
    const now = headText(SCHEMA), base = baseText(SCHEMA)
    const diff = diffLines(git('diff', '-U0', blobOf(base), blobOf(now)))
    eq(diff.length, 1, 'one changed line'); ok(diff[0].startsWith('+') && MARK.test(diff[0]), 'an added, marked line')
    const model = /model UserPreferences \{[\s\S]*?\n\}/.exec(now)[0]
    ok(model.includes(diff[0].slice(1)), 'inside model UserPreferences')
    ok(/^\+  templateAutoApply +Boolean\? +@map\("template_auto_apply"\) \/\/ STUDIO-TEMPLATE-AUTO-APPLY-SERVER/.test(diff[0]), `the field: ${diff[0].slice(0, 90)}`)
    ok(!/@default/.test(diff[0].split('//')[0]), 'no default')
    ok(strip.stripStudioTemplateAutoApplyServer(SCHEMA, now) === base, 'without its marked line the schema is #559\'s, byte for byte')
    ok(strip.stripStudioTemplateAutoApplyServer(SCHEMA, strip.stripStudioTemplateAutoApplyServer(SCHEMA, now)) === base, 'the strip is idempotent')
    eq((now.split('\n').map(row => row.replace(/\/\/.*$/, '')).join('\n').match(/template_auto_apply/g) ?? []).length, 1, 'the column name appears once in the schema (comments aside)')
  }, { mutable: false })
}

// ============================================================================================================================================
// E. The marked lines, the strip, .env.example, the registry, the scope over the committed diff
// ============================================================================================================================================
function markedSuite(hookText) {
  const marked = lines(hookText).filter(row => MARK.test(row))
  eq(marked.length, 6, 'the hook: six marked lines (two imports, the handlers, three uses)')
  const only = needle => { const hit = marked.filter(row => row.includes(needle)); ok(hit.length === 1, `exactly one marked line with: ${needle.slice(0, 80)} (${hit.length})`); return hit[0] }
  ok(only('from "@/lib/studio-template-auto-apply-server"').startsWith('import { STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED }'), 'the lib import')
  ok(only('from "@/hooks/use-studio-template-auto-apply-server"').startsWith('import { autoApplyServerAsk, autoApplyServerSave, type AutoApplyServerHandlers }'), 'the io import')
  ok(/^const autoApplyServerHandlers: AutoApplyServerHandlers = \{ user: \(\) => user, current: \(\) => snapshot\.autoApply, adopt: enabled => \{ writeAutoApplyPreference\(browserStorage\(\), user, enabled\); publish\(\{ \.\.\.snapshot, autoApply: enabled \}\); if \(socket\) socket\.send\(templateAutoApplyMessage\(enabled, socket\.caps\(\)\)\) \} \} \/\/ STUDIO/.test(only('const autoApplyServerHandlers')), 'the handlers: the cache, the check, the re-send')
  const ask = only('autoApplyServerAsk(user'), toggle = only('autoApplyServerSave(user, on)'), frame = only('autoApplyServerSave(user, standing)')
  ok(ask.trim().startsWith('if (STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerAsk(user, autoApplyServerHandlers) //'), 'the ask: gated by the flag')
  ok(toggle.trim().startsWith('if (STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerSave(user, on) //'), 'the toggle: gated by the flag')
  ok(frame.trim().startsWith('if (standing !== null && STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerSave(user, standing) //'), 'the frame write-back: gated by the flag')
  const at = row => lines(hookText).indexOf(row)
  const next = row => lines(hookText)[at(row) + 1], prev = row => lines(hookText)[at(row) - 1]
  ok(prev(ask).includes('publish({ ...(sameSession ? snapshot : withFrame(null, input.sessionId)), autoApply, sessionId: input.sessionId })') && next(ask).startsWith('  return input.socket.send(templateAutoApplyMessage(autoApply, input.socket.caps()))'), 'the ask: after the connect-time publish and BEFORE the connect-time send is returned (the send never waits for it)')
  ok(prev(frame).includes('if (standing !== null) writeAutoApplyPreference(browserStorage(), user, standing)') && next(frame).startsWith('  publish({ ...withFrame(frame, sessionId)'), 'the write-back save: right after the cache write')
  ok(prev(toggle).includes('writeAutoApplyPreference(browserStorage(), user, on)') && next(toggle).startsWith('  publish({ ...snapshot, autoApply: on })'), 'the toggle save: right after the cache write')
  ok(!/\bfetch\b|localStorage.*STUDIO-TEMPLATE-AUTO|console\./.test(marked.join('\n')), 'no fetch, log or storage read of its own on a marked line')
}
const SOURCE_FILES = strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_FILES
const normSources = (head = HEAD) => Object.fromEntries(SOURCE_FILES.map(rel => [rel, otherStrips(rel, headText(rel, head))]))
const normBases = () => Object.fromEntries(SOURCE_FILES.map(rel => [rel, otherStrips(rel, baseText(rel))]))
function stripSuite(sources, bases) {
  for (const rel of SOURCE_FILES) {
    ok(strip.stripStudioTemplateAutoApplyServer(rel, sources[rel]) === bases[rel], `${rel}: without this change's lines it is #559's file, byte for byte`)
    ok(sources[rel] !== bases[rel], `${rel}: it is changed`)
    const diff = diffLines(git('diff', '-U0', blobOf(bases[rel]), blobOf(sources[rel])))
    for (const row of diff) ok(row.startsWith('+') && MARK.test(row), `${rel}: only marked insertions: ${row.slice(0, 100)}`)
    ok(strip.stripStudioTemplateAutoApplyServer(rel, strip.stripStudioTemplateAutoApplyServer(rel, sources[rel])) === bases[rel], `${rel}: the strip is idempotent`)
  }
  ok(strip.stripStudioTemplateAutoApplyServer('lib/other.ts', 'x // STUDIO-TEMPLATE-AUTO-APPLY-SERVER\n') === 'x // STUDIO-TEMPLATE-AUTO-APPLY-SERVER\n', 'strip: a file that is not this change\'s comes back as it is')
  ok(strip.stripStudioTemplateAutoApplyServer(HOOK, 'a\nb // STUDIO-TEMPLATE-AUTO-APPLY-SERVER-X\nc // X-STUDIO-TEMPLATE-AUTO-APPLY-SERVER\nd // STUDIO-TEMPLATE-AUTO-APPLY-SERVER\n') === 'a\nb // STUDIO-TEMPLATE-AUTO-APPLY-SERVER-X\nc // X-STUDIO-TEMPLATE-AUTO-APPLY-SERVER\n', 'strip: the marker is a whole token')
  ok(strip.stripStudioTemplateAutoApplyServer(HOOK, 'a\r\nb // STUDIO-TEMPLATE-AUTO-APPLY-SERVER\r\nc') === 'a\r\nc', 'strip: only the marked lines go, the other bytes stay')
  ok(!MARK.test('STUDIO-TEMPLATE-MATCH') && !matchStrip.STUDIO_TEMPLATE_MATCH_MARKER_RE.test('STUDIO-TEMPLATE-AUTO-APPLY-SERVER'), 'the two markers do not match each other: the strips of the two changes commute')
}

await check('E. the marked lines of the store, on its text as it is (the mutants re-run this): six, each in its place, each use gated by the flag, the ask before the connect-time send is returned', () => markedSuite(src(HOOK)))

if (baseOk) {
  await check('E. the marked lines: where each is, how each is gated; the strip gives the hook and the schema back as #559 has them (flag off = #559, byte for byte); the registry reads them as #559\'s', () => {
    const sources = normSources(), bases = normBases()
    markedSuite(sources[HOOK]); stripSuite(sources, bases)
    for (const rel of SOURCE_FILES) ok(registry.stripLaterChanges(rel, headText(rel)) === registry.stripLaterChanges(rel, baseText(rel)), `registry: ${rel} read through it is #559's`)
  }, { mutable: false })

  const scopeOwnCommits = (head, opts) => {
    const own = ownOf(head, opts); assert.ok(own.length >= 1, 'no own commit yet')
    for (const c of own) { assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude [A-Za-z0-9. ]+ <noreply@anthropic\.com>\s*$/, c.slice(0, 8)); checks++ }
    return own
  }
  const NEVER = ['app/api/preferences/route.ts', 'lib/studio-template-match.ts', 'app/builder/page.tsx', 'lib/studio-flow-control.ts', 'hooks/use-studio-flow-control.ts', 'lib/studio-stage-open-gate.ts']
  const scopeCommittedFiles = (head, ctx) => {
    const own = scopeOwnCommits(head), touched = new Set()
    for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
    eq([...touched].sort(), [...strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
    for (const rel of SOURCE_FILES) {
      const diff = diffLines(git('diff', '-U0', blobOf(ctx.norm(rel, baseText(rel))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`)))))
      for (const row of diff) ok(row.startsWith('+') && MARK.test(row), `${rel}: an unmarked or removed line: ${row.slice(0, 100)}`)
      eq(diff.length, { [HOOK]: 6, [SCHEMA]: 1 }[rel], `${rel}: exactly the marked lines this change adds (six in the store, one in the schema)`)
      ok(strip.stripStudioTemplateAutoApplyServer(rel, ctx.norm(rel, git('show', `${head}:${rel}`))) === ctx.norm(rel, baseText(rel)), `${rel}: without its marked lines the file is #559's, byte for byte`)
    }
    for (const rel of strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_NEW_FILES) eq(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
    for (const rel of strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_FILES) { // the older proofs this change teaches: one registry-read edit each, every taught line marked, put back byte for byte
      const now = git('show', `${head}:${rel}`), base = baseText(rel)
      ok(ctx.norm(rel, strip.stripStudioTemplateAutoApplyServer(rel, now)) === ctx.norm(rel, base), `${rel}: the proof this change taught, put back, is #559's`)
      ok(strip.stripStudioTemplateAutoApplyServer(rel, strip.stripStudioTemplateAutoApplyServer(rel, now)) === strip.stripStudioTemplateAutoApplyServer(rel, now), `${rel}: putting back twice changes nothing`)
      for (const [has, was] of strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_EDITS[rel]) {
        eq(now.split(has).length - 1, 1, `${rel}: a taught edit is there once`)
        for (const line of has.split('\n').filter(Boolean)) ok(line.includes(strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_MARK), `${rel}: every taught line carries the registry-read mark: ${line.slice(0, 80)}`)
        ok(!MARK.test(was), `${rel}: what a taught edit replaces is not marked`)
      }
      for (const row of diffLines(git('diff', '-U0', blobOf(ctx.norm(rel, base)), blobOf(ctx.norm(rel, now))))) ok(row.startsWith('+') && row.includes(strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_MARK), `${rel}: only marked additions: ${row.slice(0, 100)}`)
    }
    ok(strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_FILES.length > 0 && strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_FILES.every(rel => !SOURCE_FILES.includes(rel) && !strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_NEW_FILES.includes(rel)), 'the taught proofs are a list of their own')
    for (const rel of NEVER) ok(!touched.has(rel), `${rel} is not touched by this change`)
    for (const rel of touched) ok(!/^app\/\(app\)\/settings\//.test(rel) && !/^scripts\/test-studio-(p2-|flow-control|stage-open-gate|strawman-stage)|launch-wording|env-append-tolerant|route-params|admin-email-guard|uat-marketing|deck-title|first-paint|deck-card-thumbnail|director-websocket-reconnect|(^|\/)(docs|landing)/i.test(rel) && !/test-director-websocket-reconnect/.test(rel), `${rel}: not on the never-edit list`)
  }
  const scopeEnvAndRegistry = (head, ctx) => {
    const env = git('show', `${head}:.env.example`), baseEnv = baseText('.env.example')
    eq(ctx.env(env), ctx.env(baseEnv), '.env.example is #559\'s plus the registered blocks and nothing else')
    eq(env.split(strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
    ok(env.includes(`\n\n${strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK.split('\n')[0]}`), 'a blank line before the block')
    ok(env.indexOf(matchStrip.STUDIO_TEMPLATE_MATCH_ENV_BLOCK) !== -1 && env.indexOf(matchStrip.STUDIO_TEMPLATE_MATCH_ENV_BLOCK) < env.indexOf(strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK), 'after #559\'s block')
    ok(/^NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER="false"$/m.test(strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK), 'documented, default off')
    ok(lines(strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK).filter(row => row && !row.startsWith('#') && row !== `${FLAG}="false"`).length === 0, 'the block is comments and its one assignment')
    ok(/BEFORE the change that adds templateAutoApply/.test(strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK) && /ONLY together with NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH/.test(strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK), 'the block says: database first, and only with the template match')
    const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
    eq(diff.filter(row => row.startsWith('-')).length, 0, 'the registry loses no line')
    const mine = diff.filter(row => row.includes('studio-template-auto-apply-server-strip.mjs'))
    eq(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const row of mine) ok(row.startsWith('+') && row.includes('// LATER-CHANGE:'), row.slice(0, 140))
    eq(mine.map(row => /\)\.(\w+), \/\//.exec(row)?.[1]), ['STUDIO_TEMPLATE_AUTO_APPLY_SERVER_SCOPE_FILES', 'STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK', 'stripStudioTemplateAutoApplyServer'], 'the three lines are the scope, the block and the strip')
    const reg = ctx.norm('scripts/studio-later-changes.mjs', git('show', `${scopeHead(head)}:scripts/studio-later-changes.mjs`)).split('\n')
    for (const name of ['STUDIO_TEMPLATE_AUTO_APPLY_SERVER_SCOPE_FILES', 'STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK', 'stripStudioTemplateAutoApplyServer']) {
      const found = reg.findIndex(row => row.includes(`studio-template-auto-apply-server-strip.mjs')).${name}`)); ok(found > 0, name)
      ok(reg[found - 1].includes('studio-template-match-strip.mjs'), `${name} is registered right after #559's line`)
      const nextRow = reg.slice(found + 1).find(row => row.trim() !== '')
      ok(nextRow.trim() === '// one line per later change, above this comment' || ctx.laterRegistryLine?.(nextRow), `${name} is the last registered line of its list (a later change's own line may follow): ${nextRow.slice(0, 80)}`)
    }
    for (const rel of strip.STUDIO_TEMPLATE_AUTO_APPLY_SERVER_NEW_FILES) ok(!/(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|postgres(ql)?:\/\/\S+@)/.test(git('show', `${head}:${rel}`)), `${rel}: no credential-shaped literal, no connection string`)
  }
  const REAL = { norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }
  const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }
  const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
  const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
  const commitWith = (parent, edits, message) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-idx-'))
    try {
      const env = { GIT_INDEX_FILE: path.join(dir, 'index') }
      plumb(['read-tree', parent], env)
      for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], env)
      return plumb(['commit-tree', plumb(['write-tree'], env), '-p', parent, '-m', message])
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  }
  const DEV = 'dc1540195b58630a345d4ada0f81edd9a31b4673' // origin/studio-v4-dev-preparation-code, the dev tip #559 was gated onto
  const devOk = (() => { try { git('cat-file', '-e', `${DEV}^{commit}`); return true } catch { return false } })()
  if (HAS_OWN) {
    await check('E. scope over the COMMITTED diff: this change\'s own commits (subject "Template auto-apply server:", found across `rev-list --no-merges BASE..HEAD` with BASE = #559\'s head, with the co-author line) touch exactly its files; the added lines are marked insertions; #559\'s own commits are not counted as this change\'s', () => {
      scopeOwnCommits(HEAD); scopeCommittedFiles(HEAD, REAL)
      eq(git('rev-list', '--no-merges', `${BASE_COMMIT}..${HEAD}`).split('\n').filter(Boolean).filter(c => !subjectOf(c).startsWith(SUBJECT)), [], 'every commit after #559\'s head is this change\'s own')
      eq(git('merge-base', '--is-ancestor', BASE_COMMIT, HEAD) === '' ? 'ancestor' : 'no', 'ancestor', '#559\'s head is an ancestor: this branch is stacked on it')
    }, { mutable: false })
    await check('E. .env.example is #559\'s plus the block (after one blank line); the registry gains exactly its three marked lines right after #559\'s, each closing its list, and loses none', () => scopeEnvAndRegistry(HEAD, REAL), { mutable: false })
    if (devOk) {
      const GATE = gateMerge(DEV, HEAD)
      await check('E. GATE-SAFE: on a gate-style merge (first parent dev, second parent this change\'s head) the scope head is HEAD^2 and the scope passes against it; the merged tree is read too', () => {
        eq(parentsOf(GATE), [DEV, HEAD], 'the gate merge')
        eq(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
        eq(scopeHead(GATE), HEAD, 'HEAD^2 is taken on the gate merge'); scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE, REAL)
        for (const rel of SOURCE_FILES) ok(strip.stripStudioTemplateAutoApplyServer(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))) === otherStrips(rel, baseText(rel)), `the merged tree, without this change's lines, is #559's ${rel}`)
        eq(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); eq(scopeHead(BASE_COMMIT), BASE_COMMIT, 'a base commit too')
      }, { mutable: false })
      await mutant('scope: the old first-parent own-commit query on the gate-style merge (no HEAD^2 rule) finds no own commit', () => { scopeOwnCommits(scopeHead(GATE, { gateRule: false }), { firstParentOnly: true }) })
      const unrelated = commitWith(DEV, { 'unrelated-after-dev.txt': 'unrelated\n' }, 'Dev: an unrelated commit after dev')
      await check('E. GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past #559\'s base: the scope head is still this change\'s head and the scope passes', () => {
        const advanced = gateMerge(unrelated, HEAD); eq(parentsOf(advanced), [unrelated, HEAD]); eq(scopeHead(advanced), HEAD); scopeAll(scopeHead(advanced)); scopeEnvAndRegistry(advanced, REAL)
      }, { mutable: false })
    } else console.log(`NOTE E  git has no dev ${DEV.slice(0, 8)}: the gate-style merge checks were skipped`)
    // a SYNTHETIC change stacked after this one: a marked line beside this change's, a registry trio below this change's, an .env.example block, a new file
    const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
    const syntheticStrip = (rel, text) => SOURCE_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(row => !row.includes(SYN.marker)).join('\n') : text
    const syntheticCommit = parent => {
      const at = rel => git('show', `${parent}:${rel}`)
      const hook = at(HOOK).split('\n').flatMap(row => row.includes('autoApplyServerAsk(user, autoApplyServerHandlers)') ? [row, `  /* ${SYN.marker} */`] : [row]).join('\n')
      const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(row => {
        if (row.includes('STUDIO_TEMPLATE_AUTO_APPLY_SERVER_SCOPE_FILES')) return [row, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
        if (row.includes('STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK')) return [row, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
        if (row.includes(').stripStudioTemplateAutoApplyServer')) return [row, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
        return [row]
      }).join('\n')
      ok(hook.includes(SYN.marker), 'the synthetic anchor exists')
      return commitWith(parent, { [HOOK]: hook, 'scripts/studio-later-changes.mjs': reg, '.env.example': `${at('.env.example')}\n${SYN.block}`, [SYN.file]: 'export const SYNTHETIC_SCOPE_FILES = new Set()\n' }, `Synthetic later: a change stacked after this one${TRAILER}`)
    }
    const synthetic = (() => { try { return syntheticCommit(HEAD) } catch (error) { return error } })()
    const SYN_CTX = { norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)), env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''), laterRegistryLine: row => row.includes('studio-synthetic-later-strip.mjs') }
    await check('E. ROBUST AFTER MERGE: a synthetic change stacked after this one (a marked line beside this change\'s, a registry trio, an .env.example block, a new file; another subject) leaves this change\'s scope passing on the branch and on a merge onto an advanced dev', () => {
      if (synthetic instanceof Error) throw synthetic
      assert.ok(!ownOf(synthetic).includes(synthetic), 'the later commit is not this change\'s'); eq(scopeHead(synthetic), synthetic)
      scopeAll(synthetic, SYN_CTX)
      if (devOk) { const gate = gateMerge(DEV, synthetic); eq(scopeHead(gate), synthetic); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX) }
      markedSuite(laterStrips(HOOK, syntheticStrip(HOOK, git('show', `${synthetic}:${HOOK}`)))) // the wiring, read past the later change's line, is still this change's
    }, { mutable: false })
    await mutant('scope: the synthetic later change is not told to the scope (its lines are unmarked additions, its registry lines extra)', () => { if (synthetic instanceof Error) throw synthetic; scopeCommittedFiles(synthetic, REAL); scopeEnvAndRegistry(synthetic, REAL) })
    await mutant('scope: a stray foreign file in a "Template auto-apply server:" commit', () => { scopeCommittedFiles(commitWith(HEAD, { 'stray-auto-apply.txt': 'stray\n' }, `${SUBJECT} a stray file${TRAILER}`), REAL) })
    await mutant('scope: an own commit without the co-author line', () => { scopeOwnCommits(commitWith(HEAD, {}, `${SUBJECT} no trailer`)) })
    await mutant('scope: the existing /api/preferences route touched in an own commit', () => { scopeCommittedFiles(commitWith(HEAD, { [PREFS_ROUTE]: `${git('show', `${HEAD}:${PREFS_ROUTE}`)}\n` }, `${SUBJECT} touches the settings route${TRAILER}`), REAL) })
    await mutant('scope: a settings page touched in an own commit', () => { scopeCommittedFiles(commitWith(HEAD, { 'app/(app)/settings/privacy/page.tsx': `${git('show', `${HEAD}:app/(app)/settings/privacy/page.tsx`)}\n` }, `${SUBJECT} touches a settings page${TRAILER}`), REAL) })
    await mutant('scope: an unmarked line added to the store in an own commit', () => { scopeCommittedFiles(commitWith(HEAD, { [HOOK]: git('show', `${HEAD}:${HOOK}`).replace('const NONE:', '// sneaky\nconst NONE:') }, `${SUBJECT} sneaky${TRAILER}`), REAL) })
    await mutant('scope: a second schema line (a field that is not the one)', () => { scopeCommittedFiles(commitWith(HEAD, { [SCHEMA]: git('show', `${HEAD}:${SCHEMA}`).replace('  activityTracking      Boolean  @default(false) @map("activity_tracking")\n', '  activityTracking      Boolean  @default(false) @map("activity_tracking")\n  extraField            Boolean? @map("extra_field") // STUDIO-TEMPLATE-AUTO-APPLY-SERVER\n') }, `${SUBJECT} second field${TRAILER}`), REAL) })
    await mutant('scope: a taught proof gains an unmarked line', () => { scopeCommittedFiles(commitWith(HEAD, { 'scripts/test-studio-chat-element-edit.mjs': git('show', `${HEAD}:scripts/test-studio-chat-element-edit.mjs`).replace("const read = rel =>", "const sneaky = 1\nconst read = rel =>") }, `${SUBJECT} sneaky proof line${TRAILER}`), REAL) })
    await mutant('scope: the .env.example block registered in the middle of its list', () => {
      const reg = git('show', `${HEAD}:scripts/studio-later-changes.mjs`).split('\n')
      const mineAt = reg.findIndex(row => row.includes(').STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK')); const [row] = reg.splice(mineAt, 1)
      reg.splice(reg.findIndex(r => r.includes(').LEGAL_SHORT_LINKS_ENV_BLOCK')) + 1, 0, row)
      scopeEnvAndRegistry(commitWith(HEAD, { 'scripts/studio-later-changes.mjs': reg.join('\n') }, `${SUBJECT} misplaced env line${TRAILER}`), REAL)
    })
  } else console.log(`NOTE E  no commit named "${SUBJECT} ..." yet: the committed-diff scope checks were skipped (the marked lines and the strip were checked on the working tree)`)
} else console.log(`NOTE E  git has no ${BASE_COMMIT.slice(0, 8)}: the base-identity and scope checks were skipped`)

// ============================================================================================================================================
// F. Mutants: every one must be caught (the mutated text is made OUTSIDE the mutant: a mutant whose text is not found fails the proof, it is never counted as caught)
// ============================================================================================================================================
console.log('F. mutants')
async function mutantSuite(label, rel, from, to) {
  const mutated = swap(read(rel), from, to)
  await mutant(label, async () => {
    ACTIVE = { [rel]: mutated }
    try { for (const { fn } of SUITE) { await fn(); await settle() } } finally { ACTIVE = {}; unhandled = [] }
  })
}
const R = (label, from, to) => mutantSuite(`route: ${label}`, ROUTE, from, to)
await R('the flag check is gone from GET', "export async function GET() {\n  if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) return notFound()\n", "export async function GET() {\n")
await R('the flag check is gone from PUT', "export async function PUT(req: Request) {\n  if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) return notFound()\n", "export async function PUT(req: Request) {\n")
await R('the flag off answers 200', 'const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 })', 'const notFound = () => NextResponse.json({ error: "Not found" }, { status: 200 })')
await R('GET does not need a session', 'if (!session?.user?.id) return unauthorized()\n\n    const row = await prisma.userPreferences.findUnique', 'const row = await prisma.userPreferences.findUnique')
await R('PUT does not need a session', 'if (!session?.user?.id) return unauthorized()\n\n    let body', 'let body')
await R('a session without an id is accepted', 'if (!session?.user?.id) return unauthorized()\n\n    const row = await prisma.userPreferences.findUnique', 'if (!session) return unauthorized()\n\n    const row = await prisma.userPreferences.findUnique')
await R('the read has no select', "      where: { userId: session.user.id },\n      select: { templateAutoApply: true },\n    })\n    return NextResponse.json({ templateAutoApply: row?.templateAutoApply ?? null })", "      where: { userId: session.user.id },\n    })\n    return NextResponse.json({ templateAutoApply: row?.templateAutoApply ?? null })")
await R('the upsert has no select', "      create: { userId: session.user.id, templateAutoApply },\n      select: { templateAutoApply: true },\n", "      create: { userId: session.user.id, templateAutoApply },\n")
await R('the select names every column of another kind', "      create: { userId: session.user.id, templateAutoApply },\n      select: { templateAutoApply: true },\n", "      create: { userId: session.user.id, templateAutoApply },\n      select: { templateAutoApply: true, emailMarketing: true },\n")
await R('the body is not validated', 'const templateAutoApply = parseServerPutBody(body)\n    if (templateAutoApply === null) {', 'const templateAutoApply = (body as { templateAutoApply: boolean }).templateAutoApply\n    if (false) {')
await R('the PUT answers with the whole row', 'return NextResponse.json({ templateAutoApply: row.templateAutoApply })', 'return NextResponse.json(row)')
await R('the GET answers false for never set', 'row?.templateAutoApply ?? null', 'row?.templateAutoApply ?? false')
await R('the GET writes (an upsert on read)', 'const row = await prisma.userPreferences.findUnique({\n      where: { userId: session.user.id },\n      select: { templateAutoApply: true },\n    })', 'const row = await prisma.userPreferences.upsert({\n      where: { userId: session.user.id },\n      update: {},\n      create: { userId: session.user.id },\n      select: { templateAutoApply: true },\n    })')
await R('the key is not the session\'s user', 'where: { userId: session.user.id },\n      update: { templateAutoApply },\n      create: { userId: session.user.id, templateAutoApply },', 'where: { userId: "u_fixed" },\n      update: { templateAutoApply },\n      create: { userId: session.user.id, templateAutoApply },')
await R('the created row is another user\'s', 'create: { userId: session.user.id, templateAutoApply },', 'create: { userId: "u_fixed", templateAutoApply },')
await R('the error log carries the error', 'console.error("[api/preferences/template-auto-apply] PUT failed")', 'console.error("[api/preferences/template-auto-apply] PUT failed", session)')
await R('the error log names the user', 'console.error("[api/preferences/template-auto-apply] GET failed")', 'console.error(`[api/preferences/template-auto-apply] GET failed u_route_1`)')
await R('a success is logged', 'return NextResponse.json({ templateAutoApply: row?.templateAutoApply ?? null })', 'console.log("read", row); return NextResponse.json({ templateAutoApply: row?.templateAutoApply ?? null })')
await R('a failure is 200', 'return NextResponse.json({ error: "Failed to save the preference" }, { status: 500 })', 'return NextResponse.json({ error: "Failed to save the preference" }, { status: 200 })')
await R('the route is not dynamic', 'export const dynamic = "force-dynamic"\n', '')
await R('the route imports the existing route\'s model differently (a second query)', 'return NextResponse.json({ templateAutoApply: row.templateAutoApply })', 'await prisma.userPreferences.findUnique({ where: { userId: session.user.id } }); return NextResponse.json({ templateAutoApply: row.templateAutoApply })')

const S = (label, from, to) => mutantSuite(`lib: ${label}`, SLIB, from, to)
await S('either flag is enough', "return templateMatchFlag === 'true' && serverFlag === 'true'", "return templateMatchFlag === 'true' || serverFlag === 'true'")
await S('the server flag alone is enough', "return templateMatchFlag === 'true' && serverFlag === 'true'", "return serverFlag === 'true'")
await S('the flag is truthy', "return templateMatchFlag === 'true' && serverFlag === 'true'", "return templateMatchFlag === 'true' && Boolean(serverFlag)")
await S('the server flag is read from another name', 'process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER)', 'process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER_X)')
await S('the flag is always on', 'export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED = templateAutoApplyServerActive(process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH, process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER)', 'export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED = true')
await S('the path changes', "'/api/preferences/template-auto-apply'", "'/api/preferences'")
await S('a string is read as a stored value', "if (!isRecord(body)) return null\n  return typeof body.templateAutoApply === 'boolean' ? body.templateAutoApply : null\n}\n\n/** What a PUT carries", "if (!isRecord(body)) return null\n  return typeof body.templateAutoApply === 'string' ? body.templateAutoApply === 'true' : null\n}\n\n/** What a PUT carries")
await S('the answer is adopted after a change since the ask', 'if (input.changedSinceAsk) return null\n', '')
await S('an equal value is adopted (a needless re-send)', 'input.server !== input.local ? input.server : null', 'true ? input.server : null')
await S('a non-boolean stored value is adopted', "return typeof input.server === 'boolean' && typeof input.local === 'boolean' && input.server !== input.local ? input.server : null", "return input.server !== input.local ? (input.server as boolean) : null")
await S('only a 404 stops the calls', 'return status === 404 || status === 401', 'return status === 404')
await S('a 500 stops the calls', 'return status === 404 || status === 401', 'return status === 404 || status === 401 || status === 500')
await S('a 4xx is retried', 'return attempt === 0 && (status === null || status >= 500)', 'return attempt === 0')
await S('a PUT is retried for ever', 'return attempt === 0 && (status === null || status >= 500)', 'return status === null || status >= 500')
await S('a network error is not retried', 'return attempt === 0 && (status === null || status >= 500)', 'return attempt === 0 && status !== null && status >= 500')
await S('the PUT body accepts extra keys', "if (keys.length !== 1 || keys[0] !== 'templateAutoApply') return null\n", '')
await S('the PUT body accepts a truthy value', "keys[0] !== 'templateAutoApply') return null\n  return typeof body.templateAutoApply === 'boolean' ? body.templateAutoApply : null\n}", "keys[0] !== 'templateAutoApply') return null\n  return body.templateAutoApply ? true : false\n}")

const I = (label, from, to) => mutantSuite(`io: ${label}`, IO, from, to)
await I('it asks on every socket', 'if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED || stopped || !user || askedFor === user) return\n  askedFor = user', 'if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED || stopped || !user) return\n  askedFor = user')
await I('it asks without a user', 'if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED || stopped || !user || askedFor === user) return', 'if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED || stopped || askedFor === user) return')
await I('it asks with the flag off', 'if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED || stopped || !user || askedFor === user) return', 'if (stopped || !user || askedFor === user) return')
await I('it saves with the flag off', 'if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED || !user) return\n  changes += 1', 'if (!user) return\n  changes += 1')
await I('it saves for a visitor', 'if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED || !user) return\n  changes += 1', 'if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) return\n  changes += 1')
await I('a change does not make the answer stale', '  changes += 1\n', '')
await I('the answer of another user is taken', ' || handlers.user() !== user })', ' })')
await I('the stale mark is ignored', 'changedSinceAsk: changes !== mark || handlers.user() !== user', 'changedSinceAsk: false')
await I('401 and 404 do not stop the calls', 'if (serverPreferenceUnavailable(status)) { stopped = true; return }\n    const next', 'if (false) { stopped = true; return }\n    const next')
await I('a PUT answered 404 does not stop the calls', 'if (serverPreferenceUnavailable(status)) { stopped = true; return }\n      if (!shouldRetryServerPut', 'if (false) { stopped = true; return }\n      if (!shouldRetryServerPut')
await I('PUTs are not in order', 'queue = queue.then(async () => {', 'queue = Promise.resolve().then(async () => {')
await I('a PUT is not retried', 'if (!shouldRetryServerPut(status, attempt)) return', 'return')
await I('the retry does not wait', 'await new Promise<void>(resolve => setTimeout(resolve, AUTO_APPLY_SERVER_RETRY_MS))', '')
await I('a PUT carries no keepalive', ', keepalive: true }', ' }')
await I('the request leaves the origin', 'credentials: "same-origin"', 'credentials: "include"')
await I('the request goes to another path', 'fetch(TEMPLATE_AUTO_APPLY_SERVER_PATH,', 'fetch("/api/preferences",')
await I('a failure is logged', "  } catch {\n    return { status: null, json: null }", "  } catch (error) {\n    console.error(error)\n    return { status: null, json: null }")
await I('the first failure is thrown', '.catch(() => {})\n}\n\n/** The preference changed', '.then(() => { throw new Error("x") })\n}\n\n/** The preference changed')

const H = (label, from, to) => mutantSuite(`hook: ${label}`, HOOK, from, to)
await H('the ask line is gone', "  if (STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerAsk(user, autoApplyServerHandlers) // STUDIO-TEMPLATE-AUTO-APPLY-SERVER: once per page and user, ask for the stored preference (it never waits: the send below goes out with the cache)\n", '')
await H('the toggle save is gone', "  if (STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerSave(user, on) // STUDIO-TEMPLATE-AUTO-APPLY-SERVER: the user's check: saved for the user too\n", '')
await H('the frame write-back save is gone', "  if (standing !== null && STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerSave(user, standing) // STUDIO-TEMPLATE-AUTO-APPLY-SERVER: the frame changed the standing preference (a chat \"no template\"): saved for the user too\n", '')
await H('every frame is saved, not only a change', 'if (standing !== null && STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerSave(user, standing)', 'if (STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerSave(user, frame.auto_apply)')
await H('the adopted value is not cached', 'adopt: enabled => { writeAutoApplyPreference(browserStorage(), user, enabled); publish', 'adopt: enabled => { publish')
await H('the adopted value does not tick the check', 'publish({ ...snapshot, autoApply: enabled }); if (socket) socket.send(templateAutoApplyMessage(enabled, socket.caps())) } }', 'if (socket) socket.send(templateAutoApplyMessage(enabled, socket.caps())) } }')
await H('the adopted value is not re-sent', '; if (socket) socket.send(templateAutoApplyMessage(enabled, socket.caps())) } }', ' } }')
await H('the adopted value is re-sent with the wrong value', 'if (socket) socket.send(templateAutoApplyMessage(enabled, socket.caps())) } }', 'if (socket) socket.send(templateAutoApplyMessage(!enabled, socket.caps())) } }')
await H('the adopted value is PUT back', 'adopt: enabled => { writeAutoApplyPreference(browserStorage(), user, enabled);', 'adopt: enabled => { autoApplyServerSave(user, enabled); writeAutoApplyPreference(browserStorage(), user, enabled);')
await H('the handlers read the preference from the wrong place', 'current: () => snapshot.autoApply,', 'current: () => true,')
await H('the ask is not gated by the flag', "  if (STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerAsk(user, autoApplyServerHandlers) //", "  autoApplyServerAsk(user, autoApplyServerHandlers) //")
await H('the ask happens after the connect send', "  if (STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerAsk(user, autoApplyServerHandlers) // STUDIO-TEMPLATE-AUTO-APPLY-SERVER: once per page and user, ask for the stored preference (it never waits: the send below goes out with the cache)\n  return input.socket.send(templateAutoApplyMessage(autoApply, input.socket.caps()))", "  const sentAtConnect = input.socket.send(templateAutoApplyMessage(autoApply, input.socket.caps()))\n  if (STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED) autoApplyServerAsk(user, autoApplyServerHandlers) // STUDIO-TEMPLATE-AUTO-APPLY-SERVER: once per page and user, ask for the stored preference (it never waits: the send below goes out with the cache)\n  return sentAtConnect")
await H('a marked line loses its marker (an unmarked insertion)', "autoApplyServerSave(user, on) // STUDIO-TEMPLATE-AUTO-APPLY-SERVER: the user's check: saved for the user too", "autoApplyServerSave(user, on) // the user's check: saved for the user too")

if (baseOk) {
  const sources0 = normSources(), bases0 = normBases()
  await mutant('marked line: the strip leaves a marked line of the store in place', () => stripSuite({ ...sources0, [HOOK]: sources0[HOOK].replace('\n', '\n// not marked\n') }, bases0))
  await mutant('marked line: the strip leaves the marked schema line in place', () => stripSuite({ ...sources0, [SCHEMA]: sources0[SCHEMA].replace('\n', '\n// not marked\n') }, bases0))
  await mutant('marked line: a schema field with a default', () => { const now = sources0[SCHEMA].replace('Boolean? @map("template_auto_apply")', 'Boolean  @default(true) @map("template_auto_apply")'); ok(/@default/.test(diffLines(git('diff', '-U0', blobOf(bases0[SCHEMA]), blobOf(now)))[0].split('//')[0]) === false, 'no default') })
  await mutant('marked line: a seventh marked line in the store', () => markedSuite(sources0[HOOK].replace('const NONE:', 'const NONE: // STUDIO-TEMPLATE-AUTO-APPLY-SERVER\nconst NONE:')))
}
{
  const sql = read(SQL)
  const sqlOk = text => { const code = text.split('\n').filter(row => !row.trim().startsWith('--')).join('\n').trim(); assert.equal(code, 'ALTER TABLE fe_user_preferences ADD COLUMN IF NOT EXISTS template_auto_apply boolean;'); assert.ok(!/\b(DROP|RENAME|TRUNCATE|DELETE|UPDATE|INSERT|DEFAULT|NOT\s+NULL|ALTER\s+COLUMN|\bTYPE\b)\b/i.test(code)) }
  sqlOk(sql)
  for (const [label, text] of [
    ['no IF NOT EXISTS', sql.replace('ADD COLUMN IF NOT EXISTS', 'ADD COLUMN')],
    ['a default', sql.replace('template_auto_apply boolean;', 'template_auto_apply boolean DEFAULT true;')],
    ['NOT NULL', sql.replace('template_auto_apply boolean;', 'template_auto_apply boolean NOT NULL;')],
    ['another column dropped', `${sql}\nALTER TABLE fe_user_preferences DROP COLUMN email_marketing;\n`],
    ['another column retyped', `${sql}\nALTER TABLE fe_user_preferences ALTER COLUMN email_marketing TYPE text;\n`],
    ['an UPDATE', `${sql}\nUPDATE fe_user_preferences SET template_auto_apply = true;\n`],
    ['the wrong table', sql.replace('ALTER TABLE fe_user_preferences ADD', 'ALTER TABLE user_preferences ADD')],
  ]) await mutant(`sql: ${label}`, () => sqlOk(text))
}

// ============================================================================================================================================
console.log(`\n${failures.length ? 'FAIL' : 'PASS'}  studio template auto-apply server: ${passed} checks and mutants passed, ${failures.length} failed (${checks} asserts)`)
for (const failure of failures) console.log(`  - ${failure}`)
process.exit(failures.length ? 1 : 0)
