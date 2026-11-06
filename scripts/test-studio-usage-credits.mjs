// FRONTEND-2 (B62; the Model Router's usage read API, CODEX-8's streams/router/USAGE-READ-API.md): proof of Studio's server read of a person's credits and of the credits view the Usage page will draw. Flag NEXT_PUBLIC_STUDIO_USAGE_CREDITS (exact "true",
// build-time, default off). New files only: app/api/usage/credits/route.ts (GET, session-bound), lib/studio-usage-credits.ts (flag, parser, words), components/studio-usage-credits.tsx + .css. No existing app file is edited; the Usage page is NOT touched.
//
//   node scripts/test-studio-usage-credits.mjs        (plain node: transpile + vm of the REAL sources, react-dom/server for the markup, postcss over the REAL stylesheet; no network, no router, no browser, no .next; a test key, never a real one)
//
// What it proves:
//  1. the flag is the exact string "true" (every other spelling is off); the environment is read inline, once, in the lib; the component reads none; the route reads exactly the router address and the server-only key;
//  2. the route (the REAL route.ts in a vm, with a session, authOptions and NextResponse as stubs and a fake fetch): the exact URL with the encoded session id and no query, GET, the Bearer header carrying the test key, a timeout signal, no-store on every answer; a
//     different person's id can never be requested (query, body, header and an echoed foreign user_id are all ignored or refused); 401 without a session; 404 with the flag off (before the session is read); 503 unconfigured; every router error mapped to its own code
//     with Retry-After passed through; the key and the router's body appear in no answer and no log; malformed JSON, a body that is not the contract and a network failure each have their own code;
//  3. the parser: the contract's own example, amounts kept as exact six-place strings (no float), timestamps, at most 31 ascending real days, a missing or malformed required field is invalid (never zeros), unknown fields ignored, a real zero-usage month is not unavailable;
//  4. the view (react-dom/server of every state): loading, ok, zero usage, each unavailable kind, rate limited, unconfigured, invalid, signed out; the chart is labelled "This UTC month"; the stylesheet (postcss): Studio v4 tokens light and dark, no purple, no gradient, phone 375 wide;
//  5. the pins: .env.example (one block after the last, the flag "false", the key's value EMPTY), the registry (three lines at the true end), the two older proofs taught (put back they are the base's, byte for byte), the strip is plain data;
//  6. scope over the COMMITTED diff, GATE-SAFE and ROBUST AFTER MERGE (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, `laterStrips`, ON_OWN_LINE, no hash-object --stdin); 7. mutants are caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'
import {
  BASE_COMMIT, USAGE_CREDITS_ENV_BLOCK, USAGE_CREDITS_FILES, USAGE_CREDITS_FLAG, USAGE_CREDITS_KEY_NAME, USAGE_CREDITS_MARKER_RE, USAGE_CREDITS_NEW_FILES, USAGE_CREDITS_PIN_EDITS, USAGE_CREDITS_PIN_FILES, USAGE_CREDITS_PIN_MARK,
  USAGE_CREDITS_SCOPE_FILES, USAGE_CREDITS_SUBJECT, stripUsageCredits,
} from './studio-usage-credits-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
/** Strips of the changes registered AFTER this one only, in the registry's order: on a branch stacked after this change a later change's own lines (its subject filter beside this one's in a taught proof, ...) are undone first, so a file reads as this change left it. */
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripUsageCredits); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
/** A mutant is caught only by a failed ASSERTION of a check. A mutant whose edit did not apply (SwapError) or that crashed some other way proves nothing and is reported as missed. */
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 120)})`) } else { caught++; console.log(`CAUGHT mutant ${label}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }
/** The code of a source without its comments (line and block): what a pin on "the route reads X" must look at. */
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')

// ---- the real sources in a vm ---------------------------------------------------------------------------------------------------------------------
const ROUTE = 'app/api/usage/credits/route.ts', LIB = 'lib/studio-usage-credits.ts', COMP = 'components/studio-usage-credits.tsx', CSS = 'components/studio-usage-credits.css'
const FLAG = USAGE_CREDITS_FLAG, KEY_NAME = USAGE_CREDITS_KEY_NAME
const SPELLINGS = [undefined, 'false', 'TRUE', '1', ' true', 'true ', 'yes', '', 'true']
const TEST_KEY = 'test-usage-read-key' // a made-up key: never a real one
const ROUTER = 'https://router.example.test'
const ENV_ON = { [FLAG]: 'true', MODEL_ROUTER_URL: ROUTER, [KEY_NAME]: TEST_KEY }
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const h = React.createElement
/** Load one real source in a new context. `libText` replaces the lib wherever a module imports it; `overrides` replace any import; `globals` are extra globals of the context (fetch, console). */
function load(rel, { env = {}, text, libText, overrides = {}, globals = {} } = {}) {
  const module = { exports: {} }
  const source = text ?? read(rel)
  const req = spec => {
    if (spec in overrides) return overrides[spec]
    if (spec === 'react') return React
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    if (spec === '@/lib/studio-usage-credits') return load(LIB, { env, text: libText })
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, source), { module, exports: module.exports, require: req, process: { env }, URL, AbortSignal, ...globals }, { filename: rel })
  return module.exports
}
const lib = load(LIB, { env: ENV_ON })

// ---- the contract's own example (streams/router/USAGE-READ-API.md) ---------------------------------------------------------------------------------
const EXAMPLE = {
  user_id: 'user_123',
  as_of: '2026-11-02T12:00:00Z',
  month: { start: '2026-11-01T00:00:00Z', end: '2026-12-01T00:00:00Z' },
  credits_used: '3.000000',
  credits_left: '4502.500000',
  balance_period: { key: '2026-10-15T07:00:00Z', start: '2026-10-15T07:00:00Z', end: '2026-11-15T07:00:00Z' },
  plan: 'pro',
  plan_source: 'fresh',
  plan_credits_granted: '5000.000000',
  plan_credits_used: '510.000000',
  plan_credits_left: '4490.000000',
  topup_credits_left: '12.500000',
  daily: [{ date: '2026-11-01', credits_used: '2.250000' }, { date: '2026-11-02', credits_used: '0.750000' }],
}
const EXAMPLE_VIEW = {
  asOf: '2026-11-02T12:00:00Z',
  month: { start: '2026-11-01T00:00:00Z', end: '2026-12-01T00:00:00Z' },
  creditsUsed: '3.000000',
  creditsLeft: '4502.500000',
  balancePeriod: { key: '2026-10-15T07:00:00Z', start: '2026-10-15T07:00:00Z', end: '2026-11-15T07:00:00Z' },
  plan: 'pro',
  planSource: 'fresh',
  planCreditsGranted: '5000.000000',
  planCreditsUsed: '510.000000',
  planCreditsLeft: '4490.000000',
  topupCreditsLeft: '12.500000',
  daily: [{ date: '2026-11-01', creditsUsed: '2.250000' }, { date: '2026-11-02', creditsUsed: '0.750000' }],
  zeroUsage: false,
}
const clone = value => JSON.parse(JSON.stringify(value))
/** EXAMPLE with one path changed: set a value, or delete it with `undefined`. */
function withField(pathText, value, base = EXAMPLE) {
  const copy = clone(base), keys = pathText.split('.')
  let node = copy
  for (const key of keys.slice(0, -1)) node = node[key]
  if (value === undefined) delete node[keys[keys.length - 1]]; else node[keys[keys.length - 1]] = value
  return copy
}
const days = (from, count, amount = '1.000000') => Array.from({ length: count }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, from + i)).toISOString().slice(0, 10), credits_used: amount }))

// ===== 1. the flag ======================================================================================================================================
console.log('1. flag')
function proveFlag(libText) {
  for (const spelling of SPELLINGS) {
    const mod = load(LIB, { env: spelling === undefined ? {} : { [FLAG]: spelling }, text: libText })
    assert.equal(mod.STUDIO_USAGE_CREDITS_ENABLED, spelling === 'true', `the constant for ${JSON.stringify(spelling)}`)
    assert.equal(mod.studioUsageCreditsOn(spelling), spelling === 'true', `the reader for ${JSON.stringify(spelling)}`)
  }
  assert.equal(load(LIB, { env: {}, text: libText }).studioUsageCreditsOn(undefined), false); assert.equal(load(LIB, { env: {}, text: libText }).studioUsageCreditsOn(null), false)
}
await check('the flag is the exact string "true": every other spelling (unset, false, TRUE, 1, a padded true) is off; the lib exports the reader and the build-time constant', () => proveFlag(read(LIB)))
await check('the environment is read inline: the lib reads only the flag (once), the component reads none, the route reads exactly the router address and the server-only key; the key name is never a NEXT_PUBLIC_ name', () => {
  const envReads = text => [...code(text).matchAll(/process\.env\.(\w+)/g)].map(m => m[1])
  assert.deepEqual(envReads(read(LIB)), [FLAG]); assert.deepEqual(envReads(read(COMP)), [])
  assert.deepEqual(envReads(read(ROUTE)).sort(), [KEY_NAME, 'MODEL_ROUTER_URL'].sort())
  assert.doesNotMatch(KEY_NAME, /^NEXT_PUBLIC_/); assert.doesNotMatch(code(read(ROUTE)), /NEXT_PUBLIC_/, 'the route names no NEXT_PUBLIC_ variable (the flag comes from the lib)')
  assert.doesNotMatch(code(read(COMP)) + code(read(LIB)), new RegExp(`${KEY_NAME}|MODEL_ROUTER`), 'neither the lib nor the view knows the key or the router address (they are imported by the browser bundle)')
})

// ===== 2. the route =====================================================================================================================================
console.log('2. the route (the real route.ts in a vm, fake session and fake fetch)')
const AUTH_OPTIONS = { stub: 'auth-options' }
const SESSION = { user: { id: 'user_123', email: 'someone@example.test' } }
const answer = (status, body, headers = {}) => () => ({ status, headers: { get: name => headers[name.toLowerCase()] ?? null }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })
const routerError = (code, message = 'ROUTER-SECRET-BODY') => ({ error: { code, message } })
/** One runner per source text: `call` runs GET once and records every answer in `seen` (the leak check reads them all). */
function runner(routeText, libText) {
  const seen = []
  const call = async (opts = {}) => {
    const { env = ENV_ON, reply = answer(200, EXAMPLE), args = [] } = opts, session = 'session' in opts ? opts.session : SESSION // an explicit undefined is "no session", not the default
    const calls = [], logs = [], sessionCalls = []
    const log = (...parts) => logs.push(parts.map(String).join(' '))
    const mod = load(ROUTE, {
      env, text: routeText, libText,
      overrides: {
        'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200, headers: new Headers(init?.headers ?? {}) }) } },
        'next-auth': { getServerSession: async options => { sessionCalls.push(options); if (session instanceof Error) throw session; return session } },
        '@/lib/auth-options': { authOptions: AUTH_OPTIONS },
      },
      globals: { fetch: async (url, init) => { calls.push({ url, init }); const r = reply(url, init); if (r instanceof Error) throw r; return r }, console: { log: log, info: log, warn: log, error: log, debug: log } },
    })
    const res = await mod.GET(...args)
    const out = { status: res.status, body: plain(res.body), headers: Object.fromEntries(res.headers.entries()), calls, logs, sessionCalls, mod }
    seen.push(out)
    return out
  }
  return { call, seen }
}
const NO_STORE = 'private, no-store'
const pathOf = url => new URL(url).pathname
const failBody = (res, status, code) => { assert.equal(res.status, status, `${code}: status`); assert.equal(res.body.ok, false); assert.equal(res.body.code, code, `${code}: code`); assert.equal(typeof res.body.message, 'string'); assert.equal(res.headers['cache-control'], NO_STORE, `${code}: no-store`) }

const routeScenarios = {
  async flag(R) {
    for (const spelling of SPELLINGS) {
      const res = await R.call({ env: { ...ENV_ON, ...(spelling === undefined ? { [FLAG]: undefined } : { [FLAG]: spelling }) } })
      if (spelling === 'true') { assert.equal(res.status, 200); continue }
      assert.equal(res.status, 404, `flag ${JSON.stringify(spelling)}: 404`); assert.deepEqual(res.body, { error: 'Not found' }); assert.equal(res.calls.length, 0, 'nothing is sent'); assert.equal(res.sessionCalls.length, 0, 'the session is not even read')
      assert.equal(res.headers['cache-control'], NO_STORE)
    }
  },
  async happy(R) {
    const res = await R.call()
    assert.equal(res.status, 200); assert.deepEqual(res.body, { ok: true, view: EXAMPLE_VIEW }, 'the parsed view, not the raw body'); assert.equal(res.headers['cache-control'], NO_STORE)
    assert.equal(res.calls.length, 1, 'one router call'); const { url, init } = res.calls[0]
    assert.equal(url, `${ROUTER}/v1/usage/user/user_123/credits`, 'the exact URL'); assert.ok(!url.includes('?') && !url.includes('#'), 'no query')
    assert.equal(init.method, 'GET'); assert.equal(init.headers.Authorization, `Bearer ${TEST_KEY}`, 'the Bearer header carries the key'); assert.equal(init.body, undefined, 'no body')
    assert.ok(init.signal instanceof AbortSignal, 'a timeout signal'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error', 'a redirect never carries the key elsewhere')
    assert.deepEqual(Object.keys(init.headers).sort(), ['Accept', 'Authorization'], 'no other header (no user id header)')
    assert.deepEqual(res.sessionCalls, [AUTH_OPTIONS], 'the session is read with authOptions'); assert.equal(res.logs.length, 0, 'nothing is logged')
    assert.equal(lib.usageCreditsStateOf(res.body).kind, 'ready', 'the browser reads it as ready')
    for (const base of [`${ROUTER}/`, `${ROUTER}/v1`, `${ROUTER}/v1/`, `  ${ROUTER}  `]) assert.equal((await R.call({ env: { ...ENV_ON, MODEL_ROUTER_URL: base } })).calls[0].url, `${ROUTER}/v1/usage/user/user_123/credits`, `router base ${JSON.stringify(base)}`)
    assert.equal((await R.call({ env: { ...ENV_ON, MODEL_ROUTER_URL: 'https://gw.example.test/router/' } })).calls[0].url, 'https://gw.example.test/router/v1/usage/user/user_123/credits')
    assert.equal((await R.call({ env: { ...ENV_ON, MODEL_ROUTER_URL: 'http://localhost:8080' } })).calls[0].url, 'http://localhost:8080/v1/usage/user/user_123/credits')
  },
  async encoding(R) {
    for (const id of ['user_123', 'a/b c?d=e&f#g%h', 'ünï cödé', 'x'.repeat(200), 'user@example.test']) {
      const res = await R.call({ session: { user: { id } }, reply: () => ({ ...answer(200, { ...EXAMPLE, user_id: id })() }) })
      assert.equal(res.status, 200, id.slice(0, 20)); const { url } = res.calls[0]
      assert.equal(url, `${ROUTER}/v1/usage/user/${encodeURIComponent(id)}/credits`, 'the id is URL-encoded')
      const parsed = new URL(url); assert.deepEqual(parsed.pathname.split('/').slice(1).length, 5, 'one path segment for the id'); assert.equal(parsed.search, ''); assert.equal(parsed.hash, '')
      assert.equal(decodeURIComponent(parsed.pathname.split('/')[4]), id, 'and it is the session id')
    }
    for (const id of ['.', '..', 'a\nb', 'a\u0000b', 'a\u007fb', 'x'.repeat(201)]) { const res = await R.call({ session: { user: { id } } }); failBody(res, 422, 'usage_read_user_invalid'); assert.equal(res.calls.length, 0, `${JSON.stringify(id.slice(0, 12))}: never sent`) }
  },
  async binding(R) {
    const hostile = { url: 'https://studio.example.test/api/usage/credits?user_id=victim_999&userId=victim_999&id=victim_999', headers: new Headers({ 'x-user-id': 'victim_999', authorization: 'attacker-value' }), json: async () => ({ user_id: 'victim_999' }), nextUrl: { searchParams: new URLSearchParams('user_id=victim_999') } }
    const res = await R.call({ args: [hostile] })
    assert.equal(res.status, 200); assert.equal(res.calls.length, 1); assert.ok(!res.calls[0].url.includes('victim_999'), 'a query, body or header can not name another person'); assert.equal(res.calls[0].url, `${ROUTER}/v1/usage/user/user_123/credits`)
    assert.ok(!JSON.stringify(res.calls[0].init.headers).includes('victim_999') && !JSON.stringify(res.calls[0].init.headers).includes('attacker-value'))
    const other = await R.call({ reply: answer(200, { ...EXAMPLE, user_id: 'victim_999' }) })
    failBody(other, 502, 'usage_read_invalid'); assert.ok(!JSON.stringify(other.body).includes('victim_999') && !JSON.stringify(other.body).includes('4502'), 'another person\'s numbers are never returned')
    assert.deepEqual(Object.keys(res.mod).sort(), ['GET', 'dynamic'], 'GET is the only method'); assert.equal(res.mod.GET.length, 0, 'GET takes no request: there is nothing to read an id from'); assert.equal(res.mod.dynamic, 'force-dynamic')
    const src = code(read(ROUTE)); assert.doesNotMatch(src, /searchParams|\brequest\b|\breq\b|headers\(|cookies\(|\.json\(\)|formData/, 'the route reads no query, header, cookie or body of the request')
    assert.equal((src.match(/encodeURIComponent\(/g) || []).length, 1); assert.equal((src.match(/\bfetch\(/g) || []).length, 1)
  },
  async session(R) {
    for (const session of [null, undefined, {}, { user: null }, { user: {} }, { user: { id: '' } }, { user: { id: 5 } }, { user: { id: undefined, email: 'someone@example.test' } }]) {
      const res = await R.call({ session }); failBody(res, 401, 'unauthorized'); assert.equal(res.calls.length, 0, 'nothing is sent without a session')
    }
    failBody(await R.call({ session: null, env: { ...ENV_ON, [KEY_NAME]: '' } }), 401, 'unauthorized')
    const boom = await R.call({ session: new Error(`session store down ${TEST_KEY}`) }); failBody(boom, 500, 'usage_read_failed'); assert.equal(boom.calls.length, 0)
  },
  async unconfigured(R) {
    const bad = [
      { MODEL_ROUTER_URL: undefined }, { MODEL_ROUTER_URL: '' }, { MODEL_ROUTER_URL: '   ' }, { MODEL_ROUTER_URL: 'not a url' }, { MODEL_ROUTER_URL: 'ftp://router.example.test' }, { MODEL_ROUTER_URL: 'javascript:alert(1)' },
      { [KEY_NAME]: undefined }, { [KEY_NAME]: '' }, { [KEY_NAME]: '   ' }, { [KEY_NAME]: 'has a space in it' }, { [KEY_NAME]: 'short' }, { [KEY_NAME]: 'x'.repeat(513) }, { [KEY_NAME]: 'line\nbreak-key' },
    ]
    for (const change of bad) { const res = await R.call({ env: { ...ENV_ON, ...change } }); failBody(res, 503, 'usage_read_unconfigured'); assert.equal(res.calls.length, 0, `${JSON.stringify(change).slice(0, 40)}: nothing is sent`) }
    assert.equal((await R.call({ env: { ...ENV_ON, [KEY_NAME]: 'x'.repeat(8) } })).status, 200, 'an 8-character key is usable'); assert.equal((await R.call({ env: { ...ENV_ON, [KEY_NAME]: ` ${TEST_KEY} ` } })).calls[0].init.headers.Authorization, `Bearer ${TEST_KEY}`, 'a padded key is trimmed')
  },
  async errors(R) {
    const table = [
      ['router 401', answer(401, routerError('unauthorized')), 502, 'usage_read_refused'],
      ['router 403', answer(403, routerError('insufficient_scope')), 502, 'usage_read_refused'],
      ['router 422 invalid_user_id', answer(422, routerError('invalid_user_id')), 422, 'usage_read_user_invalid'],
      ['router 422 another code', answer(422, routerError('something_else')), 502, 'usage_read_unavailable'],
      ['router 429', answer(429, routerError('router_rate_limited'), { 'retry-after': '17' }), 429, 'usage_read_rate_limited'],
      ['router 503 plans_unavailable', answer(503, routerError('plans_unavailable')), 503, 'usage_plans_unavailable'],
      ['router 503 credit_store_unavailable', answer(503, routerError('credit_store_unavailable')), 503, 'usage_credit_store_unavailable'],
      ['router 503 another code', answer(503, routerError('overloaded')), 502, 'usage_read_unavailable'],
      ['router 503 with no body', answer(503, ''), 502, 'usage_read_unavailable'],
      ['router 503 with a body that is not JSON', answer(503, '<html>ROUTER-SECRET-BODY</html>'), 502, 'usage_read_unavailable'],
      ['router 404 (route absent: usage read not enabled)', answer(404, routerError('not_found')), 502, 'usage_read_unavailable'],
      ['router 500', answer(500, routerError('internal_error')), 502, 'usage_read_unavailable'],
      ['router 302', answer(302, ''), 502, 'usage_read_unavailable'],
      ['network failure (the message carries the key)', () => new Error(`connect ECONNREFUSED 10.0.0.1:443 (Authorization: Bearer ${TEST_KEY})`), 502, 'usage_read_network'],
      ['timeout', () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }), 502, 'usage_read_network'],
      ['the body can not be read', () => ({ status: 200, headers: { get: () => null }, text: async () => { throw new Error('socket hang up') } }), 502, 'usage_read_network'],
      ['200 that is not JSON', answer(200, '<html>ROUTER-SECRET-BODY</html>'), 502, 'usage_read_malformed'],
      ['200 empty', answer(200, ''), 502, 'usage_read_malformed'],
      ['200 over 256 KB', answer(200, `{"pad":"${'x'.repeat(262144)}"}`), 502, 'usage_read_malformed'],
      ['200 null', answer(200, 'null'), 502, 'usage_read_invalid'],
      ['200 array', answer(200, '[]'), 502, 'usage_read_invalid'],
      ['200 empty object', answer(200, '{}'), 502, 'usage_read_invalid'],
      ['200 a number', answer(200, '5'), 502, 'usage_read_invalid'],
      ['200 missing credits_used', answer(200, withField('credits_used', undefined)), 502, 'usage_read_invalid'],
      ['200 an amount that is a number', answer(200, withField('credits_left', 4502.5)), 502, 'usage_read_invalid'],
      ['200 an amount with two places', answer(200, withField('plan_credits_used', '510.00')), 502, 'usage_read_invalid'],
      ['200 32 days', answer(200, { ...EXAMPLE, daily: [...days(1, 31), { date: '2026-11-01', credits_used: '1.000000' }] }), 502, 'usage_read_invalid'],
      ['200 another person', answer(200, { ...EXAMPLE, user_id: 'user_124' }), 502, 'usage_read_invalid'],
    ]
    for (const [label, reply, status, code] of table) {
      const res = await R.call({ reply }); failBody(res, status, code); assert.equal(res.calls.length, 1, `${label}: one call`); assert.equal(res.body.view, undefined, `${label}: no view`)
      assert.ok(!JSON.stringify(res.body).includes('ROUTER-SECRET-BODY') && !JSON.stringify(res.body).includes('ECONNREFUSED') && !JSON.stringify(res.body).includes('socket hang up'), `${label}: the router's text is not returned`)
    }
    assert.equal(new Set(table.map(row => row[3])).size, 9, 'nine distinct codes in the table'); assert.equal(new Set(['usage_read_refused', 'usage_read_network', 'usage_read_malformed', 'usage_read_invalid', 'usage_plans_unavailable', 'usage_credit_store_unavailable', 'usage_read_rate_limited', 'usage_read_user_invalid']).size, 8, 'each of the asked-for kinds has its own code')
    const limited = await R.call({ reply: answer(429, routerError('router_rate_limited'), { 'retry-after': '17' }) })
    assert.equal(limited.headers['retry-after'], '17', 'Retry-After is passed through'); assert.equal(limited.body.retryAfterSeconds, 17); assert.equal(lib.usageCreditsStateOf(limited.body).retryAfterSeconds, 17)
    for (const wait of [undefined, '', 'soon', '17\r\nX-Evil: 1', '-5', '1.5', '123456', 'Wed, 21 Oct 2026 07:28:00 GMT']) {
      const res = await R.call({ reply: answer(429, routerError('router_rate_limited'), wait === undefined ? {} : { 'retry-after': wait }) }); failBody(res, 429, 'usage_read_rate_limited')
      assert.equal(res.headers['retry-after'], undefined, `Retry-After ${JSON.stringify(wait)} is not passed on`); assert.equal(res.body.retryAfterSeconds, undefined)
    }
    assert.equal((await R.call({ reply: answer(429, '', { 'retry-after': '0' }) })).headers['retry-after'], '0')
  },
  async leaks(R) {
    assert.ok(R.seen.length >= (R.minSeen ?? 1), `the leak check saw many answers (${R.seen.length})`)
    for (const out of R.seen) {
      const text = JSON.stringify({ body: out.body, headers: out.headers })
      assert.ok(!text.includes(TEST_KEY), 'the key is in no answer'); assert.ok(!text.includes('ROUTER-SECRET-BODY'), 'the router\'s body is in no answer'); assert.ok(!/Bearer/i.test(text), 'no Authorization text is in an answer')
      assert.equal(out.logs.length, 0, `nothing is logged (${out.logs.join(' | ').slice(0, 80)})`); assert.equal(out.headers['cache-control'], NO_STORE, 'every answer, errors included, is no-store')
    }
    assert.ok(R.seen.some(out => out.calls.length === 1 && out.calls[0].init.headers.Authorization === `Bearer ${TEST_KEY}`), 'positive control: the key was sent to the router')
  },
}
async function proveRoute(routeText, libText, only) {
  const R = runner(routeText, libText)
  for (const [name, scenario] of Object.entries(routeScenarios)) if (!only || only.includes(name) || name === 'leaks') await scenario(R)
}
const ROUTE_SRC = read(ROUTE), LIB_SRC = read(LIB), COMP_SRC = read(COMP), CSS_SRC = read(CSS)
{
  const R = runner()
  const label = {
    flag: 'flag off: 404 before the session is read, nothing sent (every spelling but "true")',
    happy: 'on: the exact URL with the session id and no query, GET, the Bearer header with the test key, a timeout signal, no-store, the parsed view (not the raw body); the router base is tidied',
    encoding: 'the id is URL-encoded as one path segment and is the session\'s; a dot segment, a control character or a very long id is never sent',
    binding: 'a different person\'s id can never be requested: a query, a body, a header and an echoed foreign user_id change nothing; GET takes no request; only GET is exported',
    session: '401 without a session (every shape of none, the e-mail is not used); the session is checked before the configuration; a failing session read is 500 usage_read_failed',
    unconfigured: '503 usage_read_unconfigured while the router address or the key is missing or unusable (13 variants), before anything is sent; a padded key is trimmed',
    errors: 'every router answer maps to its own code (401/403, 422, 429 with Retry-After, 503 plans / credit store, network, malformed JSON, not the contract, any other), none leaks the router\'s text',
    leaks: 'the key and the router\'s body are in no answer and no log across every answer above; every answer is no-store',
  }
  R.minSeen = 60
  for (const [name, scenario] of Object.entries(routeScenarios)) await check(label[name], () => scenario(R))
}

// ===== 3. the parser ====================================================================================================================================
console.log('3. the parser')
const DECIMAL_FIELDS = ['credits_used', 'credits_left', 'plan_credits_granted', 'plan_credits_used', 'plan_credits_left', 'topup_credits_left']
const TIME_FIELDS = ['as_of', 'month.start', 'month.end', 'balance_period.start', 'balance_period.end']
const REQUIRED = ['user_id', 'as_of', 'month', 'month.start', 'month.end', 'credits_used', 'credits_left', 'balance_period', 'balance_period.key', 'balance_period.start', 'balance_period.end', 'plan', 'plan_source', 'plan_credits_granted', 'plan_credits_used', 'plan_credits_left', 'topup_credits_left', 'daily']
function proveParser(libText) {
  const mod = load(LIB, { env: ENV_ON, text: libText })
  const parse = (body, id = 'user_123') => plain(mod.parseUsageCredits(body, id))
  const invalid = (body, why, id) => assert.equal(parse(body, id).ok, false, why)
  const valid = (body, why, id) => { const r = parse(body, id); assert.ok(r.ok, `${why}: ${r.reason}`); return r.view }
  // the contract's own example
  assert.deepEqual(valid(EXAMPLE, 'the contract example'), EXAMPLE_VIEW, 'the example becomes exactly the expected view')
  for (const key of ['creditsUsed', 'creditsLeft', 'planCreditsGranted', 'planCreditsUsed', 'planCreditsLeft', 'topupCreditsLeft']) assert.equal(typeof parse(EXAMPLE).view[key], 'string', `${key} stays a string`)
  assert.ok(mod.parseUsageCredits(EXAMPLE).ok, 'with no id to compare it still parses')
  // exact amounts: strings stay as they came; no float anywhere in the path
  const exact = withField('credits_left', '0.300000'); exact.plan_credits_left = '123456789012345.123457'; exact.daily[0].credits_used = '0.100000'
  const exactView = valid(exact, 'exact amounts'); assert.equal(exactView.creditsLeft, '0.300000'); assert.equal(exactView.planCreditsLeft, '123456789012345.123457'); assert.equal(exactView.daily[0].creditsUsed, '0.100000')
  assert.equal(mod.formatUsageCredits('0.300000'), '0.3'); assert.equal(mod.formatUsageCredits('123456789012345.123457'), '123,456,789,012,345.123457', 'six places beyond a float\'s reach are shown whole')
  assert.equal(mod.usagePercent('499999999999999.999999', '999999999999999.999999'), 49, 'the meter is exact (floats say 50)'); assert.equal(mod.usagePercent('0.290000', '1.000000'), 29, 'the meter is exact (0.29 * 100 is 28.999999999999996 as a float)'); assert.equal(mod.usagePercent('0.570000', '1.000000'), 57); assert.equal(mod.usagePercent('510.000000', '5000.000000'), 10); assert.equal(mod.usagePercent('5.000000', '0.000000'), null); assert.equal(mod.usagePercent('9.000000', '3.000000'), 100, 'capped at 100')
  for (const [amount, shown] of [['3.000000', '3'], ['4502.500000', '4,502.5'], ['0.000000', '0'], ['0.000001', '0.000001'], ['1234567.123400', '1,234,567.1234'], ['999.999999', '999.999999'], ['1000.000000', '1,000'], ['007.500000', '7.5']]) assert.equal(mod.formatUsageCredits(amount), shown, amount)
  assert.equal(mod.formatUsageCredits('3'), '3', 'not an amount: returned as it is, never changed into a number'); assert.equal(mod.formatUsageDate('2026-11-15T07:00:00Z'), 'Nov 15, 2026'); assert.equal(mod.formatUsageDay('2026-11-02'), 'Nov 2'); assert.equal(mod.formatUsageDate('whatever'), 'whatever')
  // a real zero month is valid and is not unavailable
  const zero = { ...EXAMPLE, credits_used: '0.000000', daily: [{ date: '2026-11-01', credits_used: '0.000000' }, { date: '2026-11-02', credits_used: '0.000000' }] }
  assert.equal(valid(zero, 'a zero-usage month').zeroUsage, true); assert.equal(valid({ ...zero, daily: [] }, 'a zero month with no day rows yet').zeroUsage, true); assert.equal(valid({ ...zero, credits_used: '0.000001' }, 'one millionth').zeroUsage, false)
  assert.equal(mod.usageCreditsStateName(mod.usageCreditsStateOf({ ok: true, view: parse(zero).view })), 'zero'); assert.notEqual(mod.usageCreditsStateName({ kind: 'error', code: 'usage_credit_store_unavailable', retryAfterSeconds: null }), 'zero')
  // required fields: missing, null, wrong type
  for (const field of REQUIRED) for (const [how, value] of [['missing', undefined], ['null', null], ['a number', 7], ['an array', []]]) if (!(field === 'daily' && how === 'an array')) invalid(withField(field, value), `${field} ${how}`)
  assert.equal(REQUIRED.length, 18)
  // decimals
  const BAD_DECIMALS = ['3', '3.0', '3.00', '3.00000', '3.0000000', '-3.000000', '+3.000000', ' 3.000000', '3.000000 ', '3,000000', '1e3', '1.000000e3', 'NaN', 'Infinity', '', '.000000', '3.', 3, 3.5, null, true, {}, ['3.000000'], '١.000000', '1234567890123456.000000']
  for (const field of DECIMAL_FIELDS) for (const bad of BAD_DECIMALS) invalid(withField(field, bad), `${field} = ${JSON.stringify(bad)}`)
  for (const bad of BAD_DECIMALS) { const body = clone(EXAMPLE); body.daily[0].credits_used = bad; invalid(body, `daily amount ${JSON.stringify(bad)}`) }
  // timestamps
  const BAD_TIMES = ['2026-11-02 12:00:00Z', '2026-11-02T12:00:00', '2026-11-02T12:00:00+00:00', '2026-11-02T12:00:00.5+01:00', '2026-13-02T12:00:00Z', '2026-02-30T12:00:00Z', '2026-11-02T25:00:00Z', '2026-11-02T12:60:00Z', '2026-11-02T12:00:60Z', '2026-11-02', 'yesterday', '', 0, null]
  for (const field of TIME_FIELDS) for (const bad of BAD_TIMES) invalid(withField(field, bad), `${field} = ${JSON.stringify(bad)}`)
  valid(withField('as_of', '2026-11-02T12:00:00.123Z'), 'fractional seconds are fine'); valid(withField('as_of', '2026-11-02T12:00:00.123456Z'), 'microseconds are fine'); valid(withField('month.start', '2024-02-29T00:00:00Z'), 'a leap day is a real day', 'user_123')
  invalid(withField('month.end', '2026-11-01T00:00:00Z'), 'month end equal to start'); invalid(withField('month.end', '2026-10-01T00:00:00Z'), 'month end before start'); invalid(withField('balance_period.end', '2026-10-15T07:00:00Z'), 'balance period end equal to start'); invalid(withField('balance_period.end', '2026-10-01T00:00:00Z'), 'balance period end before start')
  // daily: at most 31, ascending, real days
  assert.equal(parse({ ...EXAMPLE, daily: days(1, 31) }).ok, true, '31 days'); assert.equal(parse({ ...EXAMPLE, daily: days(1, 31) }).view.daily.length, 31); invalid({ ...EXAMPLE, daily: days(1, 32) }, '32 days'); valid({ ...EXAMPLE, daily: [] }, 'no days yet')
  invalid({ ...EXAMPLE, daily: [...days(1, 2)].reverse() }, 'descending'); invalid({ ...EXAMPLE, daily: [days(1, 1)[0], days(1, 1)[0]] }, 'a day twice'); invalid({ ...EXAMPLE, daily: [days(3, 1)[0], days(2, 1)[0]] }, 'out of order')
  for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-10-00', '2026-1-1', '2026-11-1', '20261101', '2026-11-01T00:00:00Z', 'today', '', 5, null, undefined]) invalid({ ...EXAMPLE, daily: [{ date: bad, credits_used: '1.000000' }] }, `day ${JSON.stringify(bad)}`)
  for (const bad of [{}, 'x', 5, null, [[]], [null], [5], ['2026-11-01'], [{ date: '2026-11-01' }], [{ credits_used: '1.000000' }]]) invalid({ ...EXAMPLE, daily: bad }, `daily ${JSON.stringify(bad)}`)
  // texts
  for (const field of ['plan', 'plan_source', 'balance_period.key']) for (const bad of ['', ' leading', 'a\nb', 'x'.repeat(65), 'ünï']) invalid(withField(field, bad), `${field} = ${JSON.stringify(bad.slice(0, 10))}`)
  valid(withField('plan', 'x'.repeat(64)), 'a 64-character plan id'); valid(withField('balance_period.key', '2026-11'), 'the Free plan\'s month key'); valid(withField('plan_source', 'no_row'), 'no_row')
  // unknown fields are ignored (and never carried)
  const extra = { ...clone(EXAMPLE), surprise: { a: 1 }, credit_limit_usd: '10.000000', month_extra: 1 }; extra.month.extra = 'x'; extra.balance_period.more = 1; extra.daily[0].note = 'x'
  assert.deepEqual(valid(extra, 'unknown fields'), EXAMPLE_VIEW, 'unknown fields are ignored and not carried into the view')
  // not an object / not the signed-in person
  for (const body of [null, undefined, [], 'text', 5, true]) invalid(body, `body ${JSON.stringify(body)}`)
  invalid(EXAMPLE, 'another person\'s answer', 'user_124'); invalid(withField('user_id', 'USER_123'), 'the id is compared exactly'); invalid(withField('user_id', ''), 'an empty user_id'); invalid(withField('user_id', 123), 'a numeric user_id', undefined)
  // missing fields are never zeros: a refused answer carries no view at all
  const refused = parse(withField('credits_used', undefined)); assert.equal(refused.ok, false); assert.equal(refused.view, undefined); assert.equal(typeof refused.reason, 'string')
  // the browser's own check of the route's answer
  const good = parse(EXAMPLE).view
  assert.ok(mod.isUsageCreditsView(good)); for (const [what, broken] of [
    ['zeroUsage that does not match', { ...good, zeroUsage: true }], ['an amount that is a number', { ...good, creditsLeft: 4502.5 }], ['days out of order', { ...good, daily: [...good.daily].reverse() }], ['33 days', { ...good, daily: Array.from({ length: 32 }, (_, i) => ({ date: days(1, 31)[i % 31].date, creditsUsed: '1.000000' })) }],
    ['a missing period', { ...good, balancePeriod: undefined }], ['a bad timestamp', { ...good, asOf: 'now' }], ['null', null], ['an array', []],
  ]) assert.equal(mod.isUsageCreditsView(broken), false, what)
  // the state of the route's JSON
  assert.equal(plain(mod.usageCreditsStateOf({ ok: true, view: good })).kind, 'ready')
  assert.deepEqual(plain(mod.usageCreditsStateOf({ ok: false, code: 'usage_read_rate_limited', retryAfterSeconds: 12 })), { kind: 'error', code: 'usage_read_rate_limited', retryAfterSeconds: 12 })
  for (const wait of [-1, 1.5, '5', null, 100000, undefined]) assert.equal(plain(mod.usageCreditsStateOf({ ok: false, code: 'usage_read_rate_limited', retryAfterSeconds: wait })).retryAfterSeconds, null, `wait ${JSON.stringify(wait)}`)
  for (const body of [null, undefined, 'x', 5, [], {}, { error: 'Not found' }, { ok: true }, { ok: true, view: {} }, { ok: true, view: { ...good, creditsUsed: 3 } }, { ok: false }, { ok: false, code: 'bogus' }, { ok: false, code: 5 }, { ok: 'true', view: good }]) assert.deepEqual(plain(mod.usageCreditsStateOf(body)), { kind: 'error', code: 'usage_read_invalid', retryAfterSeconds: null }, `state of ${JSON.stringify(body)?.slice(0, 40)}`)
  for (const code of mod.USAGE_CREDITS_ERROR_CODES) assert.equal(plain(mod.usageCreditsStateOf({ ok: false, code })).code, code, `the route's code ${code} is read as it is`)
  // chart numbers
  assert.deepEqual(plain(mod.usageBarHeights(good.daily)), [1000, 333]); assert.deepEqual(plain(mod.usageBarHeights([{ date: '2026-11-01', creditsUsed: '0.000000' }, { date: '2026-11-02', creditsUsed: '0.000000' }])), [0, 0]); assert.deepEqual(plain(mod.usageBarHeights([])), [])
  assert.deepEqual(plain(mod.usageBusiestDay(good.daily)), { date: '2026-11-01', creditsUsed: '2.250000' }); assert.equal(mod.usageBusiestDay([]), null)
  assert.equal(mod.usagePlanLabel('pro'), 'Pro'); assert.equal(mod.usagePlanLabel('free'), 'Free'); assert.equal(mod.usagePlanLabel('team'), 'team')
}
await check('the parser: the contract example becomes the exact view, amounts stay six-place strings (no float), a real zero month is valid and not unavailable, a missing or malformed required field is invalid (never zeros), unknown fields are ignored', () => proveParser(LIB_SRC))
await check('the parser: timestamps are ISO UTC and real, at most 31 ascending real days, text fields are short plain text, another person\'s id is refused, the browser\'s own check and state reading hold', () => {
  const mod = load(LIB, { env: ENV_ON })
  assert.deepEqual(mod.USAGE_CREDITS_ERROR_CODES.length, 12); assert.equal(mod.USAGE_CREDITS_MAX_DAYS, 31)
  for (const code of mod.USAGE_CREDITS_ERROR_CODES) assert.match(code, /^(unauthorized|usage_[a-z_]+)$/)
  assert.doesNotMatch(code(read(LIB)), /parseFloat|Number\(\s*(amount|body|value|entry)|\+\s*body\.|toFixed|Math\.round/, 'no float conversion of an amount in the lib')
  assert.doesNotMatch(code(read(LIB)), /^import |require\(|fetch\(|localStorage/m, 'the lib is import-free and does no I/O')
})

// ===== 4. the view =====================================================================================================================================
console.log('4. the view (react-dom/server, every state) and the stylesheet')
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
/** The markup is well formed (every tag closed, no stray close); returns the tag names in order. */
function wellFormed(html) {
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>/g, stack = [], tags = []
  let m
  while ((m = re.exec(html))) { const [, close, tag, , selfClose] = m; tags.push(tag); if (close) { assert.equal(stack.pop(), tag, `</${tag}> closes ${tag}`) } else if (!VOID.has(tag) && !selfClose) stack.push(tag) }
  assert.deepEqual(stack, [], 'every tag is closed'); return tags
}
const textOf = html => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
const count = (html, needle) => html.split(needle).length - 1
const GOOD = lib.parseUsageCredits(EXAMPLE, 'user_123').view
const ready = view => ({ kind: 'ready', view })
const errorState = (code, retryAfterSeconds = null) => ({ kind: 'error', code, retryAfterSeconds })
const viewHtml = (state, { env = ENV_ON, text, libText, retry = true } = {}) => {
  const mod = load(COMP, { env, text, libText })
  return renderToStaticMarkup(h(mod.StudioUsageCreditsView, { state: plain(state), ...(retry ? { onRetry: () => {} } : {}) }))
}
const ZERO_VIEW = lib.parseUsageCredits({ ...EXAMPLE, credits_used: '0.000000', daily: [{ date: '2026-11-01', credits_used: '0.000000' }, { date: '2026-11-02', credits_used: '0.000000' }] }, 'user_123').view
function proveStates(compText, libText) {
  const html = state => viewHtml(state, { text: compText, libText })
  const BAD_WORDS = /undefined|NaN|\[object|null|usage_read_|usage_plans|usage_credit|MODEL_ROUTER|Bearer|router|unauthorized|test-usage-read-key/i
  // loading
  const loading = html({ kind: 'loading' }); wellFormed(loading)
  assert.match(loading, /data-studio-usage-credits="true"/); assert.match(loading, /data-state="loading"/); assert.match(loading, /aria-busy="true"/); assert.match(textOf(loading), /Loading your credits/); assert.doesNotMatch(loading, /suc-bars|progressbar|This UTC month/)
  // ok: the contract example
  const ok = html(ready(GOOD)); wellFormed(ok); const okText = textOf(ok)
  assert.match(ok, /data-state="ok"/); assert.equal(count(ok, '<h3>This UTC month</h3>'), 1, 'the chart is labelled "This UTC month"'); assert.match(okText, /This UTC month 3 credits used/); assert.match(ok, /<h2>Credits<\/h2>/); assert.match(okText, /Pro plan/)
  assert.match(okText, /Plan credits used 510 of 5,000/, 'the plan meter: used of granted'); assert.match(ok, /role="progressbar" aria-label="Plan credits used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="10"/); assert.match(ok, /class="suc-fill" style="width:10%"/)
  assert.match(okText, /Resets Nov 15, 2026 \(UTC\)/, 'the reset date is balance_period.end'); assert.doesNotMatch(okText, /Dec 1, 2026/, 'not the calendar month\'s end')
  assert.match(okText, /Plan credits left 4,490/); assert.match(okText, /Top-up credits left \(never expire\) 12\.5/); assert.match(okText, /Total you can spend 4,502\.5/)
  assert.equal(count(ok, 'class="suc-bar"'), 2); assert.match(ok, /aria-label="Nov 1: 2\.25 credits"/); assert.match(ok, /aria-label="Nov 2: 0\.75 credits"/); assert.match(ok, /style="height:100%"/); assert.match(ok, /style="height:33\.3%"/)
  assert.match(okText, /Nov 1 Nov 2/, 'the axis names the first and the last day'); assert.match(okText, /Busiest day: Nov 1, 2\.25 credits/); assert.doesNotMatch(ok, /data-zero="true"/); assert.doesNotMatch(okText, BAD_WORDS)
  const month = lib.parseUsageCredits({ ...EXAMPLE, daily: days(1, 31).map((d, i) => ({ ...d, credits_used: i === 3 ? '0.000000' : '1.500000' })) }, 'user_123').view
  const full = html(ready(month)); wellFormed(full); assert.equal(count(full, 'class="suc-bar"'), 31); assert.equal(count(full, 'data-zero="true"'), 1, 'a day with no usage is drawn as a baseline'); assert.match(textOf(full), /Oct 1 Oct 31/)
  assert.match(html(ready({ ...GOOD, creditsUsed: '1.000000', daily: [{ date: '2026-11-01', creditsUsed: '1.000000' }] })), /1 credit used/, 'one credit is singular'); assert.equal(count(html(ready({ ...GOOD, daily: [{ date: '2026-11-01', creditsUsed: '3.000000' }] })), 'class="suc-axis"'), 1)
  assert.match(textOf(html(ready({ ...GOOD, creditsUsed: '3.000000', daily: [] }))), /The day-by-day detail is not available for this month/); assert.doesNotMatch(textOf(html(ready({ ...GOOD, daily: [] }))), /have not used any credits/, 'a month with usage is never called empty')
  const noPlan = html(ready({ ...GOOD, planCreditsGranted: '0.000000', planCreditsUsed: '0.000000', planCreditsLeft: '0.000000' })); wellFormed(noPlan); assert.match(textOf(noPlan), /Plan credits used 0 of 0/); assert.doesNotMatch(noPlan, /progressbar/); assert.doesNotMatch(noPlan, /NaN/)
  assert.match(html(ready({ ...GOOD, planCreditsUsed: '9000.000000' })), /aria-valuenow="100"/, 'over the grant is drawn as full')
  const escaped = html(ready({ ...GOOD, plan: '<b>x</b>' })); assert.match(escaped, /&lt;b&gt;x&lt;\/b&gt; plan/); assert.doesNotMatch(escaped, /<b>x/)
  // zero usage: a real, valid month
  const zero = html(ready(ZERO_VIEW)); wellFormed(zero); const zeroText = textOf(zero)
  assert.match(zero, /data-state="zero"/); assert.match(zeroText, /This UTC month 0 credits used/); assert.match(zeroText, /You have not used any credits this UTC month yet\./); assert.doesNotMatch(zero, /suc-bars|data-zero/); assert.match(zeroText, /Plan credits used 510 of 5,000/, 'the balances still show'); assert.doesNotMatch(zeroText, BAD_WORDS)
  // every error code: its own words, never zeros
  const SEEN = new Map()
  for (const code of lib.USAGE_CREDITS_ERROR_CODES) {
    const state = errorState(code, code === 'usage_read_rate_limited' ? 30 : null), page = html(state); wellFormed(page); const words = textOf(page)
    assert.match(page, new RegExp(`data-state="${lib.usageCreditsStateName(state)}"`), code); assert.match(page, /role="alert"/); assert.match(page, /<h3>[^<]+<\/h3><p>[^<]+<\/p>/, `${code}: a title and a sentence`)
    assert.doesNotMatch(words, BAD_WORDS, `${code}: plain words only (${words})`); assert.doesNotMatch(page, /suc-bars|progressbar|credits used|This UTC month|aria-valuenow/, `${code}: no numbers drawn`)
    assert.equal(words.length < 220, true, `${code}: short`); SEEN.set(code, lib.usageCreditsStateName(state))
    const stateName = lib.usageCreditsStateName(state), retry = /<button type="button" class="suc-retry">Try again<\/button>/.test(page)
    assert.equal(retry, stateName !== 'unconfigured' && stateName !== 'signed-out', `${code}: Try again only where trying again can help`)
    assert.equal(/Try again/.test(viewHtml(state, { text: compText, libText, retry: false })), false, `${code}: no button without an onRetry`)
  }
  assert.deepEqual([...new Set(SEEN.values())].sort(), ['credit-store-unavailable', 'invalid', 'plans-unavailable', 'rate-limited', 'signed-out', 'unavailable', 'unconfigured'], 'the seven error states')
  assert.equal(SEEN.get('usage_read_malformed'), 'invalid'); assert.equal(SEEN.get('usage_read_invalid'), 'invalid'); for (const code of ['usage_read_network', 'usage_read_refused', 'usage_read_user_invalid', 'usage_read_unavailable', 'usage_read_failed']) assert.equal(SEEN.get(code), 'unavailable', code)
  const wordsOf = code => textOf(html(errorState(code)))
  assert.match(wordsOf('usage_plans_unavailable'), /not zero usage/); assert.match(wordsOf('usage_credit_store_unavailable'), /not zero usage/); assert.notEqual(wordsOf('usage_plans_unavailable'), wordsOf('usage_credit_store_unavailable'), 'plans and the credit store read differently')
  assert.match(textOf(html(errorState('usage_read_rate_limited', 30))), /Please try again in 30 seconds/); assert.match(textOf(html(errorState('usage_read_rate_limited', 1))), /in 1 second\./); assert.match(textOf(html(errorState('usage_read_rate_limited', 0))), /in 0 seconds/); assert.match(textOf(html(errorState('usage_read_rate_limited'))), /try again in a moment/)
  assert.match(wordsOf('usage_read_unconfigured'), /not switched on yet/); assert.match(wordsOf('unauthorized'), /Sign in/); assert.match(wordsOf('usage_read_invalid'), /could not read your usage/)
}
await check('the view in every state (react-dom/server): loading; ok with the plan meter (used of granted, balance_period.end as the reset date), top-up left, total spendable and the "This UTC month" bars; a real zero-usage month; empty or oversize edge cases; text is escaped', () => proveStates(COMP_SRC))
await check('the view: each unavailable kind (plans, credit store, other), rate limited (with the wait), unconfigured, invalid, signed out has its own words, draws no number, and offers Try again only where it can help; unavailable is never shown as zero', () => {
  const html = code => viewHtml(errorState(code))
  assert.notEqual(textOf(html('usage_plans_unavailable')), textOf(html('usage_read_network')))
  assert.doesNotMatch(textOf(html('usage_credit_store_unavailable')), /\b0 credits/); assert.match(textOf(viewHtml(ready(ZERO_VIEW))), /0 credits used/)
})
function proveGate(compText) {
  const off = load(COMP, { env: {}, text: compText }), on = load(COMP, { env: ENV_ON, text: compText })
  assert.equal(renderToStaticMarkup(h(off.StudioUsageCredits)), '', 'flag off: nothing'); assert.match(renderToStaticMarkup(h(on.StudioUsageCredits)), /data-state="loading"/, 'flag on: the loading state first')
  assert.equal(renderToStaticMarkup(h(load(COMP, { env: { [FLAG]: 'TRUE' }, text: compText }).StudioUsageCredits)), '', 'a mis-spelled flag is off')
}
await check('the view: the flag gates the Usage page entry (flag off draws nothing, on draws the loading state first, fetching /api/usage/credits itself); the view imports only react, the lib and its stylesheet and does no other I/O', () => {
  const on = load(COMP, { env: ENV_ON }); proveGate(COMP_SRC)
  const src = code(COMP_SRC)
  assert.deepEqual([...COMP_SRC.matchAll(/^import [^'"]*['"]([^'"]+)['"]/gm)].map(m => m[1]).sort(), ['./studio-usage-credits.css', '@/lib/studio-usage-credits', 'react'], 'three imports: no new dependency')
  assert.deepEqual([...src.matchAll(/\bfetch\(\s*(['"][^'"]*['"])/g)].map(m => m[1]), ["'/api/usage/credits'"], 'one fetch, to our own route'); assert.doesNotMatch(src, /process\.env|localStorage|sessionStorage|dangerouslySetInnerHTML|document\.|window\./)
  assert.match(COMP_SRC, /^'use client'/); assert.deepEqual(Object.keys(on).sort(), ['StudioUsageCredits', 'StudioUsageCreditsView'])
  assert.doesNotMatch(src, /recharts|chart\.js|\bd3\b|victory|<svg/i, 'the chart is CSS bars: no chart library, no svg')
})

// ---- the stylesheet ---------------------------------------------------------------------------------------------------------------------------------
function cssRules(text) {
  const out = []
  postcss.parse(text).walkRules(rule => out.push({ selectors: rule.selectors, decls: rule.nodes.filter(n => n.type === 'decl').map(d => [d.prop, d.value]), media: rule.parent?.type === 'atrule' ? `${rule.parent.name} ${rule.parent.params}` : null }))
  return out
}
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
function proveCss(cssText) {
  const rules = cssRules(cssText), ROOT = '[data-studio-usage-credits="true"]'
  assert.ok(rules.length >= 25, `rules found (${rules.length})`)
  for (const r of rules) for (const s of r.selectors) assert.match(s, /^(\.dark )?\[data-studio-usage-credits="true"\]|^\.suc[-\w]*/, `scoped selector: ${s}`)
  const all = rules.flatMap(r => r.decls.map(([prop, value]) => ({ prop, value, sel: r.selectors.join(', '), media: r.media })))
  for (const { prop, value, sel } of all) { assert.doesNotMatch(`${prop}: ${value}`, /gradient|purple|violet|#6a4fc0|#b4a0f2|--ss-accent|conic/i, `no purple, no gradient (${sel} { ${prop} })`) }
  const light = rules.find(r => r.selectors.length === 1 && r.selectors[0] === ROOT && !r.media), dark = rules.find(r => r.selectors.length === 1 && r.selectors[0] === `.dark ${ROOT}`)
  assert.ok(light && dark, 'a light and a dark token rule')
  const tokens = r => Object.fromEntries(r.decls.filter(([prop]) => prop.startsWith('--suc-')).map(([prop, value]) => { const m = /^var\((--ss-[a-z-]+), (#[0-9a-f]{6})\)$/.exec(value); assert.ok(m, `${prop}: a Studio v4 token with a hex fallback`); return [prop, m] }))
  const L = tokens(light), D = tokens(dark)
  assert.deepEqual(Object.keys(L).sort(), ['--suc-action', '--suc-bar', '--suc-line', '--suc-muted', '--suc-on-action', '--suc-panel', '--suc-soft', '--suc-text']); assert.deepEqual(Object.keys(D).sort(), Object.keys(L).sort())
  for (const key of Object.keys(L)) assert.equal(D[key][1], L[key][1], `${key}: the same Studio token in both`)
  for (const key of ['--suc-panel', '--suc-soft', '--suc-line', '--suc-text', '--suc-muted', '--suc-bar', '--suc-action']) assert.notEqual(D[key][2], L[key][2], `${key}: dark has its own value`)
  const fb = (T, key) => T[key][2]
  for (const [name, T] of [['light', L], ['dark', D]]) {
    assert.ok(contrast(fb(T, '--suc-text'), fb(T, '--suc-panel')) >= 7, `${name}: text on the panel`); assert.ok(contrast(fb(T, '--suc-muted'), fb(T, '--suc-panel')) >= 4.5, `${name}: muted text on the panel`); assert.ok(contrast(fb(T, '--suc-muted'), fb(T, '--suc-soft')) >= 4.5, `${name}: muted text on the soft tile`)
    assert.ok(contrast(fb(T, '--suc-bar'), fb(T, '--suc-panel')) >= 3, `${name}: the bars against the panel`); assert.ok(contrast(fb(T, '--suc-on-action'), fb(T, '--suc-action')) >= 4.5, `${name}: the button's text`); assert.ok(contrast(fb(T, '--suc-line'), fb(T, '--suc-panel')) >= 1.1, `${name}: the line is visible`)
  }
  const get = (sel, prop, media = false) => all.filter(d => d.sel === sel && d.prop === prop && (!!d.media) === media).map(d => d.value).pop()
  assert.equal(get(ROOT, 'max-width'), '100%'); assert.equal(get(ROOT, 'min-width'), '0'); assert.equal(get(ROOT, 'overflow-wrap'), 'anywhere'); assert.equal(get(ROOT, 'box-sizing'), 'border-box'); assert.equal(get(ROOT, 'width'), '100%')
  for (const { prop, value, sel, media } of all) {
    if (/^(width|min-width|max-width|flex-basis|height|min-height)$/.test(prop)) for (const px of value.matchAll(/(\d+(?:\.\d+)?)px/g)) if (/width|basis/.test(prop)) assert.ok(Number(px[1]) <= 320, `${sel}: ${prop} ${value} is wider than a phone's content box`)
    assert.doesNotMatch(`${prop}:${value}`, /^white-space:nowrap|^position:(fixed|absolute)|^overflow-x|^overflow:(scroll)|\d+vw/, `${sel}: no nowrap, no fixed/absolute position, no horizontal scroll (${prop}: ${value})`)
    if (prop === 'grid-template-columns') assert.match(value, /minmax\(0/, `${sel}: grid columns can shrink (${value})`)
    void media
  }
  assert.equal(get('.suc-bars', 'display'), 'flex'); assert.equal(get('.suc-bars', 'overflow'), undefined); assert.match(get('.suc-bar', 'flex'), /^1 1 0$/); assert.ok(Number.parseInt(get('.suc-bars', 'height'), 10) <= 160); assert.equal(get('.suc-bar-fill', 'min-height'), '2px', 'a zero day is still drawn as a baseline')
  assert.equal(get('.suc-balances', 'grid-template-columns'), 'repeat(3, minmax(0, 1fr))'); assert.equal(get('.suc-balances', 'grid-template-columns', true), 'minmax(0, 1fr)', 'the phone breakpoint stacks the balances')
  const media = rules.filter(r => r.media).map(r => r.media); assert.ok(media.length >= 3 && media.every(m => m === 'media (max-width: 520px)'), `one phone breakpoint above 375 (${media[0]})`)
  assert.equal(get('.suc-head', 'flex-wrap'), 'wrap'); assert.equal(get('.suc-row', 'flex-wrap'), 'wrap'); assert.equal(get('.suc-track', 'overflow'), 'hidden')
}
await check('the stylesheet (postcss, the real file): Studio v4 tokens (--ss-*) with light fallbacks and a .dark set, contrast holds in both, no purple, no gradient, every selector scoped, nothing wider than a phone (375: one column below 520 px, shrinkable grids, wrapping rows, no horizontal overflow)', () => proveCss(CSS_SRC))

// ===== 5. pins ==========================================================================================================================================
console.log('5. pins')
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const lineDiff = (before, after) => { const b = before.split('\n'), a = after.split('\n'), out = []; let i = 0, j = 0; while (i < b.length || j < a.length) { if (b[i] === a[j]) { i++; j++ } else if (a[j] !== undefined && !b.slice(i).includes(a[j])) { out.push(`+${a[j++]}`) } else if (b[i] !== undefined && !a.slice(j).includes(b[i])) { out.push(`-${b[i++]}`) } else { out.push(`-${b[i++]}`); out.push(`+${a[j++]}`) } } return out }
const SECRET_SHAPE = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/
function provePins(readNow = read, at = '', later = laterStrips) {
  const a = m => (at ? `${at}: ${m}` : m)
  for (const rel of USAGE_CREDITS_PIN_FILES) {
    const now = later(rel, readNow(rel)), base = baseText(rel)
    assert.equal(stripUsageCredits(rel, now), base, a(`${rel}: an older proof taught: put back it is the base's, byte for byte`))
    assert.equal(stripUsageCredits(rel, stripUsageCredits(rel, now)), base, a(`${rel}: put back twice changes nothing more`))
    for (const [has, was] of USAGE_CREDITS_PIN_EDITS[rel]) { assert.equal(now.split(has).length - 1, 1, a(`${rel}: a taught line is there exactly once`)); for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(USAGE_CREDITS_PIN_MARK), a(`${rel}: a taught line carries the registry-read mark`)); assert.ok(!was.includes(USAGE_CREDITS_PIN_MARK)) }
    const added = lineDiff(base, now).filter(l => l.startsWith('+')); assert.ok(added.length === 1 && added.every(l => l.includes(USAGE_CREDITS_PIN_MARK) && /\^Usage credits:/.test(l)), a(`${rel}: the one line added to the proof is this change's subject filter, with the mark`))
    assert.deepEqual(lineDiff(base, now).filter(l => l.startsWith('-')), [], a(`${rel}: nothing is removed`))
  }
  for (const rel of USAGE_CREDITS_NEW_FILES) assert.doesNotMatch(readNow(rel), SECRET_SHAPE, a(`${rel}: no secret-shaped literal`))
  // .env.example: one block, after the last one, the flag off, the key's value empty
  const env = readNow('.env.example'), block = USAGE_CREDITS_ENV_BLOCK, first = block.split('\n')[0]
  assert.equal(env.split(block).length - 1, 1, a('this change\'s .env.example block is there exactly once, verbatim'))
  assert.match(env, new RegExp(`\\n\\n${escapeRe(first)}`), a('a blank line before the block'))
  const phone = registry.LATER_ENV_BLOCKS.find(b => /PHONE_SHELL_COVERAGE=/.test(b)); assert.ok(phone && env.indexOf(block) > env.indexOf(phone.split('\n')[0]), a('the block sits after the phone shell coverage\'s (the last one before it)'))
  assert.ok(block.includes(`${FLAG}="false"`), a('the flag is documented as off')); assert.match(block, new RegExp(`^${KEY_NAME}=$`, 'm'), a('the key is named with an EMPTY value')); assert.doesNotMatch(block, new RegExp(`${KEY_NAME}=\\S`), a('no value is written'))
  assert.deepEqual(block.split('\n').filter(l => l && !l.startsWith('#')), [`${FLAG}="false"`, `${KEY_NAME}=`], a('two lines of settings, no more'))
  assert.match(block, /SERVER-ONLY/, a('says the key is server-only')); assert.match(block, /read scope/, a('says it is a read-scope key')); assert.match(block, /binds the path to the session/, a('says Studio binds the path to the session')); assert.match(block, /never a NEXT_PUBLIC_ name/)
  assert.doesNotMatch(block, SECRET_SHAPE, a('no secret-shaped text in the block'))
  assert.doesNotMatch(block, /NARRATION_VIA_ROUTER|MODEL_ROUTER_URL|MODEL_ROUTER_STUDIO_KEY/, a('the block names none of the narration change\'s variables (its proof takes any later line that does for that change\'s own block left behind)'))
  assert.equal(registry.stripLaterEnvBlocks('.env.example', env), registry.stripLaterEnvBlocks('.env.example', baseText('.env.example')), a('.env.example without the registered blocks is the base\'s, byte for byte (flag off: nothing else changed)'))
  // the registry reaches this change
  for (const [list, what] of [[registry.LATER_STRIPS, stripUsageCredits], [registry.LATER_ENV_BLOCKS, USAGE_CREDITS_ENV_BLOCK]]) assert.ok(list.includes(what) && list.indexOf(what) > (list === registry.LATER_STRIPS ? registry.LATER_STRIPS.findIndex(s => s.name === 'stripPhoneShellCoverage') : list.findIndex(b => /PHONE_SHELL_COVERAGE=/.test(b))), a('the registry holds this change after the phone shell coverage'))
  assert.ok([...USAGE_CREDITS_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), a('the registry names every file'))
}
await check('the older proofs taught (deck sync truth, chat element edit): one subject-filter line each, with the registry-read mark, put back they are the base\'s byte for byte; .env.example: one block after the last, the flag "false", the key EMPTY, server-only and session-bound said; the registry holds the strip, the block and every file', () => { provePins() })
await check('the strip is plain data: nothing but the marker, the lists and the functions; it marks no line in an app file; any other file comes back untouched; the marker is a whole token', () => {
  const text = read('scripts/studio-usage-credits-strip.mjs')
  assert.doesNotMatch(text.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/`[^`]*`/g, '``').replace(/\/\/.*$/gm, ''), /^import |require\(|readFileSync|execFileSync/m, 'no imports, nothing read from disk or git')
  assert.deepEqual(USAGE_CREDITS_FILES, [], 'no existing app file carries a marked line'); assert.equal(stripUsageCredits('app/builder/page.tsx', 'x // USAGE-CREDITS\n'), 'x // USAGE-CREDITS\n'); assert.equal(stripUsageCredits('scripts/studio-later-changes.mjs', 'abc\n'), 'abc\n'); assert.equal(stripUsageCredits('scripts/test-studio-deck-sync-truth.mjs', 1), 1)
  assert.ok(USAGE_CREDITS_MARKER_RE.test('a // USAGE-CREDITS') && !USAGE_CREDITS_MARKER_RE.test('a // USAGE-CREDITS-X') && !USAGE_CREDITS_MARKER_RE.test('a // X-USAGE-CREDITS') && !USAGE_CREDITS_MARKER_RE.test('a // STUDIO_USAGE_PAGE'), 'the marker is a whole token')
  assert.deepEqual([...USAGE_CREDITS_SCOPE_FILES].sort(), [...USAGE_CREDITS_NEW_FILES, '.env.example', 'scripts/studio-later-changes.mjs', ...USAGE_CREDITS_PIN_FILES].sort())
  assert.equal(USAGE_CREDITS_SUBJECT, 'Usage credits:'); assert.equal(BASE_COMMIT, 'f36e9f8506b16cc0bb13f8f8020a2b9cd85b0f09')
})

// ===== 6. scope =========================================================================================================================================
console.log('6. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-05T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-05T00:00:00Z' }
const plumb = (args, env = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(USAGE_CREDITS_SUBJECT)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees none of them on the gate's merge. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim(), parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const OLDER_PREFIXES = /^(Phone shell coverage:|Phone landscape:|Phone hints:|Phone shell 1:|Phone shell 2:|Stage open gate:|Chat column wide:|Welcome trim:|Director mark trim:|Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:|Text set keep look:|Structural refine decline:|Strawman|Template match:|Template proof order:|Save refused notice:|Chat parity|Billing:)/
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (?:Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), OLDER_PREFIXES, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
const FOREIGN = ['app/(app)/usage/page.tsx', 'app/(app)/billing/page.tsx', 'lib/studio-billing-usage.ts', 'lib/narration/model-router.ts', 'app/api/usage/quota/route.ts', 'app/api/account/usage/route.ts', 'lib/auth-options.ts', 'lib/studio-model-choice-server.ts', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'next.config.mjs', 'next.config.js']
const registryWithout = text => text.split('\n').filter(line => !line.includes('studio-usage-credits-strip.mjs')).join('\n')
const scopeCommittedFiles = head => {
  const own = scopeOwnCommits(head), touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  assert.deepEqual([...touched].sort(), [...USAGE_CREDITS_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  assert.deepEqual([...net].sort(), [...USAGE_CREDITS_SCOPE_FILES].sort(), 'and the whole committed diff from BASE is nothing else')
  for (const rel of USAGE_CREDITS_NEW_FILES) { assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel); assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${rel}`), undefined, `${rel} is new: the base has none`) }
  for (const rel of USAGE_CREDITS_PIN_FILES) assert.equal(stripUsageCredits(rel, git('show', `${head}:${rel}`)), baseText(rel), `${rel}: an older proof taught: put back it is the base's`)
  for (const rel of FOREIGN) assert.ok(!touched.has(rel) && !net.has(rel), `${rel} is not touched by this change`)
  for (const rel of [...net]) if (!USAGE_CREDITS_NEW_FILES.includes(rel)) assert.ok(USAGE_CREDITS_OWN_ALLOWED.includes(rel), `${rel} is a file this change may edit`)
}
const USAGE_CREDITS_OWN_ALLOWED = ['.env.example', 'scripts/studio-later-changes.mjs', ...USAGE_CREDITS_PIN_FILES]
const scopeEnvAndRegistry = head => {
  const envText = git('show', `${head}:.env.example`), baseEnv = baseText('.env.example')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', envText), registry.stripLaterEnvBlocks('.env.example', baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(envText, `${baseEnv}\n${USAGE_CREDITS_ENV_BLOCK}`, '.env.example is the base plus this change\'s block, after one blank line, at the end')
  const regText = git('show', `${head}:scripts/studio-later-changes.mjs`), diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes('studio-usage-credits-strip.mjs'))
  assert.equal(own.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['USAGE_CREDITS_SCOPE_FILES', 'USAGE_CREDITS_ENV_BLOCK', 'stripUsageCredits']); assert.equal(diff.length, 3, 'and nothing else in the registry')
  assert.equal(registryWithout(regText), baseText('scripts/studio-later-changes.mjs'), 'flag off: the registry without its three lines is the base\'s, byte for byte')
  const lines = regText.split('\n'), END = '  // one line per later change, above this comment'
  for (const [name, marker] of [['LATER_CHANGE_FILES', 'USAGE_CREDITS_SCOPE_FILES'], ['LATER_ENV_BLOCKS', 'USAGE_CREDITS_ENV_BLOCK'], ['LATER_STRIPS', 'stripUsageCredits']]) {
    const at = lines.findIndex(l => l.includes(`).${marker}, // LATER-CHANGE:`)); assert.ok(at > 0, name); assert.equal(lines[at + 1], END, `${name}: the line is the true end of its list (right above the end comment)`)
    assert.ok(/PHONE_SHELL_COVERAGE|stripPhoneShellCoverage/.test(lines[at - 1]), `${name}: right after the phone shell coverage's line`)
  }
}
const scopeAll = head => { scopeOwnCommits(head); scopeCommittedFiles(head); scopeEnvAndRegistry(head) }
/** The byte-identity evidence of flag off: for every file the commits touch that the base has, sha256 of what the strip puts back, against the base's. */
const identityEvidence = head => {
  const rows = []
  for (const rel of [...USAGE_CREDITS_OWN_ALLOWED]) {
    const now = git('show', `${head}:${rel}`), back = rel === '.env.example' ? registry.stripLaterEnvBlocks(rel, now) : rel === 'scripts/studio-later-changes.mjs' ? registryWithout(now) : stripUsageCredits(rel, now)
    const base = rel === '.env.example' ? registry.stripLaterEnvBlocks(rel, baseText(rel)) : baseText(rel)
    assert.equal(sha(back), sha(base), `${rel}: flag off, it is the base's`); rows.push(`${rel} ${sha(base)}`)
  }
  return rows
}

const HEAD = scopeHead('HEAD')
/** This change's own commits on the FIRST-PARENT line of `head` from BASE. Merged into dev, its commits come in by a merge's second parent and that line has none of them: dev past the merge, a branch stacked after this change, a later change's gate merge. */
const ownOnLine = head => git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** There the committed diff from BASE holds the later changes' work too, so the scope checks stand down; the pins above (read past the later changes' strips) and every other section still run. On this change's own branch, and on its gate merge through HEAD^2, they all run. */
const ON_OWN_LINE = ownOnLine(HEAD).length > 0
const scopeCheck = (label, fn) => (ON_OWN_LINE ? check(label, fn) : undefined)
if (!ON_OWN_LINE) console.log('NOTE scope: no commit of this change on the first-parent line from BASE (merged into dev: its commits are on a second parent); the scope checks stand down, the pins above cover the files')
await scopeCheck(`this change's own commits (subject starts "${USAGE_CREDITS_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await scopeCheck('the committed files are exactly this change\'s: six new files, .env.example, the registry and the two taught proofs; no existing app file, package.json, the lockfile, the Usage page, the billing page or another router caller is touched', () => scopeCommittedFiles(HEAD))
await scopeCheck('.env.example is the base plus the block (after one blank line, at the end); the registry gains exactly its three marked lines (each the true end of its list, right after the phone shell coverage\'s) and loses none; flag off the strip puts every touched old file back to the base, byte for byte', () => { scopeEnvAndRegistry(HEAD); console.log(`     flag-off identity (sha256/16 of the base each touched old file returns to): ${identityEvidence(HEAD).join('; ')}`) })
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : null
await scopeCheck('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of USAGE_CREDITS_PIN_FILES) assert.equal(stripUsageCredits(rel, git('show', `${GATE}:${rel}`)), baseText(rel), `the merged tree, without this change's line, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await scopeCheck('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-idx-'))
  try {
    const envIdx = { GIT_INDEX_FILE: path.join(dir, 'index') }
    plumb(['read-tree', parent], envIdx)
    for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], envIdx)
    return plumb(['commit-tree', plumb(['write-tree'], envIdx), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = ON_OWN_LINE ? commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE') : null
const ADVANCED_GATE = ON_OWN_LINE ? gateMerge(unrelated, HEAD) : null
await scopeCheck('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE: the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
await scopeCheck('mutant caught: a stray file in a "Usage credits:" commit, an own commit without the co-author line, an edit to an existing app file, a touched package.json or Usage page and a second line in a taught proof fail the scope', () => {
  const stray = commitWith(HEAD, { 'stray-usage-credits.txt': 'stray\n' }, `${USAGE_CREDITS_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray)); assert.doesNotThrow(() => scopeCommittedFiles(HEAD)); assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/)
  const noTrailer = commitWith(HEAD, {}, `${USAGE_CREDITS_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  const usagePage = commitWith(HEAD, { 'app/(app)/usage/page.tsx': 'x\n' }, `${USAGE_CREDITS_SUBJECT} adds the Usage page${TRAILER}`) // FRONTEND-1's #585 owns it; it is not in dev yet
  assert.throws(() => scopeCommittedFiles(usagePage), /exactly its scope|is not touched/, 'the Usage page')
  for (const rel of ['package.json', 'app/(app)/billing/page.tsx', 'lib/narration/model-router.ts', 'components/layout/studio-rail.tsx', 'app/builder/page.tsx']) {
    const foreign = commitWith(HEAD, { [rel]: `${git('show', `${HEAD}:${rel}`)}\n` }, `${USAGE_CREDITS_SUBJECT} touches ${rel}${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched/, rel)
  }
  const sneaky = commitWith(HEAD, { [USAGE_CREDITS_PIN_FILES[0]]: `${git('show', `${HEAD}:${USAGE_CREDITS_PIN_FILES[0]}`)}\n// a second line` }, `${USAGE_CREDITS_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => provePins(rel => git('show', `${sneaky}:${rel}`)), /put back it is the base's|one line added/, 'a second line in a taught proof')
})
// a branch stacked after this change: dev's merge brings it in by its SECOND parent, then a later change adds its own subject filter beside this change's in a taught proof
const SYN = { file: 'scripts/test-studio-deck-sync-truth.mjs', mark: 'registry read (SYNTHETIC-LATER)' }
const synStrip = (rel, text) => (rel === SYN.file && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.mark)).join('\n') : text)
const stackedAfter = () => {
  const dev = gateMerge(BASE_COMMIT, HEAD), taught = git('show', `${dev}:${SYN.file}`).split('\n')
  const at = taught.findIndex(line => line.includes('registry read (USAGE-CREDITS)')); assert.ok(at > 0, 'this change\'s subject filter is in the taught proof')
  taught.splice(at + 1, 0, `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Synthetic later:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: ${SYN.mark}: a made-up change stacked after this one`)
  return commitWith(dev, { [SYN.file]: taught.join('\n') }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
await scopeCheck('ROBUST AFTER MERGE: on a branch stacked after this change (dev\'s merge brings it in by a second parent, then a later change adds its subject filter beside this one\'s in a taught proof) no own commit is on the first-parent line, so the scope checks stand down there, and the pins, read past the later change\'s strip, still pass', () => {
  const later = stackedAfter(), readAt = rel => git('show', `${later}:${rel}`)
  assert.equal(ownOf(later).length, ownOf(HEAD).length, 'this change\'s commits are all there, by the second parent'); assert.deepEqual(ownOnLine(later), [], 'none of them on the first-parent line')
  provePins(readAt, 'stacked after', (rel, text) => synStrip(rel, laterStrips(rel, text)))
  assert.throws(() => provePins(readAt, 'stacked after, not told', laterStrips), /put back it is the base's/, 'mutant caught: without the later change\'s strip, its line breaks the put-back')
})

// ===== 7. mutants (each one edit of the real sources, fed to the same checks) ===========================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const routeProof = (text, only) => proveRoute(text, undefined, only)
const comp = (from, to) => proveStates(swap(COMP_SRC, from, to))
// the flag
await mutant('the flag is read as truthy, not exactly "true"', () => proveFlag(swap(LIB_SRC, "return value === 'true'", "return value !== undefined")))
await mutant('the flag is on by default', () => proveFlag(swap(LIB_SRC, "return value === 'true'", "return value !== 'false'")))
await mutant('the flag is compared case-insensitively', () => proveFlag(swap(LIB_SRC, "return value === 'true'", "return String(value).toLowerCase() === 'true'")))
// the route
await mutant('the route answers with the flag off', () => routeProof(swap(ROUTE_SRC, "if (!STUDIO_USAGE_CREDITS_ENABLED) return respond(404, { error: 'Not found' })", ''), ['flag']))
await mutant('the flag-off 404 comes after the session read', () => routeProof(swap(ROUTE_SRC, "  if (!STUDIO_USAGE_CREDITS_ENABLED) return respond(404, { error: 'Not found' })\n  try {\n    const session = await getServerSession(authOptions)\n", "  try {\n    const session = await getServerSession(authOptions)\n    if (!STUDIO_USAGE_CREDITS_ENABLED) return respond(404, { error: 'Not found' })\n"), ['flag']))
await mutant('the id is not URL-encoded', () => routeProof(swap(ROUTE_SRC, '${encodeURIComponent(userId)}', '${userId}'), ['encoding']))
await mutant('a query string is added to the URL', () => routeProof(swap(ROUTE_SRC, '/credits`, {', '/credits?window=month`, {'), ['happy']))
await mutant('the path takes an id from a query (the route reads the request)', () => routeProof(swap(swap(ROUTE_SRC, 'export async function GET() {', 'export async function GET(request: { url: string }) {'), 'const userId = session?.user?.id', "const userId = new URL(request.url).searchParams.get('user_id') ?? session?.user?.id"), ['binding']))
await mutant('the path takes an id from a header', () => routeProof(swap(swap(ROUTE_SRC, 'export async function GET() {', 'export async function GET(request: { headers: Headers }) {'), 'const userId = session?.user?.id', "const userId = request.headers.get('x-user-id') ?? session?.user?.id"), ['binding']))
await mutant('the router\'s echoed user_id is not compared with the session\'s', () => routeProof(swap(ROUTE_SRC, 'parseUsageCredits(body, userId)', 'parseUsageCredits(body)'), ['binding']))
await mutant('the e-mail stands in for a missing session id', () => routeProof(swap(ROUTE_SRC, 'const userId = session?.user?.id', 'const userId = session?.user?.id || session?.user?.email'), ['session']))
await mutant('no session is let through', () => routeProof(swap(ROUTE_SRC, "if (typeof userId !== 'string' || userId === '') return fail(401, 'unauthorized')", ''), ['session']))
await mutant('the dot segment guard is dropped', () => routeProof(swap(ROUTE_SRC, '(?!\\.{1,2}$)', ''), ['encoding']))
await mutant('the configuration is not checked', () => routeProof(swap(ROUTE_SRC, "if (!base || !KEY_SHAPE.test(key)) return fail(503, 'usage_read_unconfigured')", ''), ['unconfigured']))
await mutant('an empty key is accepted (no key shape check)', () => routeProof(swap(ROUTE_SRC, '!KEY_SHAPE.test(key)', '!key && false'), ['unconfigured']))
await mutant('the key is read from a NEXT_PUBLIC_ name', () => routeProof(swap(ROUTE_SRC, 'process.env.MODEL_ROUTER_USAGE_READ_KEY', 'process.env.NEXT_PUBLIC_MODEL_ROUTER_USAGE_READ_KEY'), ['happy']))
await mutant('the key is sent as X-Api-Key, not Authorization: Bearer', () => routeProof(swap(ROUTE_SRC, 'Authorization: `Bearer ${key}`', "'X-API-Key': key"), ['happy']))
await mutant('the method is not GET', () => routeProof(swap(ROUTE_SRC, "method: 'GET',", "method: 'POST',"), ['happy']))
await mutant('the router call has no timeout signal', () => routeProof(swap(ROUTE_SRC, '        signal: AbortSignal.timeout(ROUTER_TIMEOUT_MS),\n', ''), ['happy']))
await mutant('a redirect is followed', () => routeProof(swap(ROUTE_SRC, "        redirect: 'error',\n", ''), ['happy']))
await mutant('the response is not no-store', () => routeProof(swap(ROUTE_SRC, "const NO_STORE = 'private, no-store'", "const NO_STORE = 'private, max-age=60'"), ['happy']))
await mutant('the raw router body is returned, not the parsed view', () => routeProof(swap(ROUTE_SRC, 'respond(200, { ok: true, view: parsed.view })', 'respond(200, { ok: true, view: body })'), ['happy']))
await mutant('the key is put in an error answer', () => routeProof(swap(ROUTE_SRC, "return fail(502, 'usage_read_network')", "return fail(502, 'usage_read_network', { detail: key })"), ['errors']))
await mutant('the router\'s body is returned in an error', () => routeProof(swap(ROUTE_SRC, "return fail(502, 'usage_read_unavailable')\n  } catch", "return fail(502, 'usage_read_unavailable', { detail: text })\n  } catch"), ['errors']))
await mutant('a failure is logged with the key', () => routeProof(swap(ROUTE_SRC, '    } catch {\n      return fail(502, \'usage_read_network\')', '    } catch (error) {\n      console.error(`usage read failed with ${key}`, error)\n      return fail(502, \'usage_read_network\')'), ['errors']))
await mutant('the 429 does not pass Retry-After through', () => routeProof(swap(ROUTE_SRC, "{ 'Retry-After': wait }", '{}'), ['errors']))
await mutant('a garbage Retry-After is passed through', () => routeProof(swap(ROUTE_SRC, 'const RETRY_AFTER = /^\\d{1,5}$/', 'const RETRY_AFTER = /^.+$/'), ['errors']))
await mutant('plans_unavailable and credit_store_unavailable share one code', () => routeProof(swap(ROUTE_SRC, "return fail(503, 'usage_credit_store_unavailable')", "return fail(503, 'usage_plans_unavailable')"), ['errors']))
await mutant('a 503 without the router\'s code is mapped as plans unavailable', () => routeProof(swap(ROUTE_SRC, "if (res.status === 503 && code === 'plans_unavailable')", 'if (res.status === 503)'), ['errors']))
await mutant('router 401 and 403 are passed through as 401/403 (Studio\'s session would look expired)', () => routeProof(swap(ROUTE_SRC, "if (res.status === 401 || res.status === 403) return fail(502, 'usage_read_refused')", "if (res.status === 401 || res.status === 403) return fail(res.status, 'usage_read_refused')"), ['errors']))
await mutant('the 422 is mapped without reading error.code', () => routeProof(swap(ROUTE_SRC, "if (res.status === 422 && code === 'invalid_user_id')", 'if (res.status === 422)'), ['errors']))
await mutant('malformed JSON is read as the contract being invalid (no own code)', () => routeProof(swap(ROUTE_SRC, "try { body = JSON.parse(text) } catch { return fail(502, 'usage_read_malformed') }", "try { body = JSON.parse(text) } catch { return fail(502, 'usage_read_invalid') }"), ['errors']))
await mutant('a network failure is read as unavailable (no own code)', () => routeProof(swap(ROUTE_SRC, "      return fail(502, 'usage_read_network')\n    }\n    if (text.length", "      return fail(502, 'usage_read_unavailable')\n    }\n    if (text.length"), ['errors']))
await mutant('an oversize body is parsed', () => routeProof(swap(ROUTE_SRC, "if (text.length > MAX_BODY_CHARS) return fail(502, 'usage_read_malformed')", ''), ['errors']))
await mutant('the route logs', () => routeProof(swap(ROUTE_SRC, "    if (!base || !KEY_SHAPE.test(key))", "    console.log('usage read', userId)\n    if (!base || !KEY_SHAPE.test(key))"), ['happy']))
await mutant('GET takes the request (an id could be read from it)', () => routeProof(swap(ROUTE_SRC, 'export async function GET() {', 'export async function GET(request?: unknown) {'), ['binding']))
await mutant('a second method is exported', () => routeProof(swap(ROUTE_SRC, 'export async function GET() {', 'export async function POST() { return respond(200, {}) }\nexport async function GET() {'), ['binding']))
// the parser
await mutant('amounts may have two places', () => proveParser(swap(LIB_SRC, '\\d{1,15}\\.\\d{6}$', '\\d{1,15}\\.\\d{2,6}$')))
await mutant('amounts may be negative', () => proveParser(swap(LIB_SRC, '/^\\d{1,15}\\.\\d{6}$/', '/^-?\\d{1,15}\\.\\d{6}$/')))
await mutant('a missing amount is read as zero', () => proveParser(swap(LIB_SRC, "if (!isUsageDecimal(body[key])) return bad(key)", "if (body[key] === undefined) body[key] = '0.000000'; else if (!isUsageDecimal(body[key])) return bad(key)")))
await mutant('more than 31 days are accepted', () => proveParser(swap(LIB_SRC, 'export const USAGE_CREDITS_MAX_DAYS = 31', 'export const USAGE_CREDITS_MAX_DAYS = 40')))
await mutant('days need not be ascending', () => proveParser(swap(LIB_SRC, 'if (at === null || at <= last) return false', 'if (at === null) return false')))
await mutant('a day is not checked to be a real calendar day', () => proveParser(swap(LIB_SRC, "if (at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d) return null\n  return at.getTime()\n}\n\n/** Millionths", "return at.getTime()\n}\n\n/** Millionths")))
await mutant('a timestamp without Z is accepted', () => proveParser(swap(LIB_SRC, "(?:\\.\\d{1,6})?Z$/", "(?:\\.\\d{1,6})?Z?$/")))
await mutant('an end before the start is accepted', () => proveParser(swap(LIB_SRC, ' && (timestampMs(v.start) as number) < (timestampMs(v.end) as number)', '')))
await mutant('a real zero month is called unavailable (zeroUsage always false)', () => proveParser(swap(LIB_SRC, "zeroUsage: micro(body.credits_used as string) === BigInt(0),", 'zeroUsage: false,')))
await mutant('another person\'s answer is accepted', () => proveParser(swap(LIB_SRC, "if (expectUserId !== undefined && body.user_id !== expectUserId) return bad('user_id is not the signed-in person')", '')))
await mutant('unknown fields are carried into the view', () => proveParser(swap(LIB_SRC, '    zeroUsage: micro(body.credits_used as string) === BigInt(0),\n  }', '    zeroUsage: micro(body.credits_used as string) === BigInt(0),\n    ...(body as object),\n  } as UsageCreditsView')))
await mutant('the meter divides as floats', () => proveParser(swap(LIB_SRC, 'const share = (micro(part) * BigInt(100)) / total\n  return share > BigInt(100) ? 100 : Number(share)', 'const share = Math.floor((Number(part) / Number(whole)) * 100)\n  return share > 100 ? 100 : share')))
await mutant('an amount is shown as a float', () => proveParser(swap(LIB_SRC, "return trimmed ? `${grouped}.${trimmed}` : grouped", 'return String(Number(amount))')))
await mutant('the browser takes any JSON for a view', () => proveParser(swap(LIB_SRC, "if (isRecord(body) && body.ok === true && isUsageCreditsView(body.view)) return { kind: 'ready', view: body.view }", "if (isRecord(body) && body.ok === true) return { kind: 'ready', view: body.view as UsageCreditsView }")))
await mutant('an unknown error code is shown as it is', () => proveParser(swap(LIB_SRC, '(USAGE_CREDITS_ERROR_CODES as readonly string[]).includes(body.code)', 'true')))
// the view
await mutant('the chart is not labelled "This UTC month"', () => comp('<h3>This UTC month</h3>', '<h3>This month</h3>'))
await mutant('the reset date is the calendar month\'s end', () => comp('formatUsageDate(view.balancePeriod.end)', 'formatUsageDate(view.month.end)'))
await mutant('the plan meter shows used of left, not of granted', () => comp('of ${formatUsageCredits(view.planCreditsGranted)}', 'of ${formatUsageCredits(view.planCreditsLeft)}'))
await mutant('top-up credits show the plan credits', () => comp('formatUsageCredits(view.topupCreditsLeft)', 'formatUsageCredits(view.planCreditsLeft)'))
await mutant('total spendable shows the plan left', () => comp('formatUsageCredits(view.creditsLeft)', 'formatUsageCredits(view.planCreditsLeft)'))
await mutant('zero usage is drawn as an error', () => comp('{view.zeroUsage ? (', '{false ? ('))
await mutant('an unavailable state draws zeros', () => comp("          <h3>{words.title}</h3>", "          <h3>{words.title}</h3><p>0 credits used</p>"))
await mutant('a month with usage and no day rows is called empty', () => comp('{view.zeroUsage ? (', '{view.zeroUsage || view.daily.length === 0 ? ('))
await mutant('Try again is offered when not switched on', () => comp("name !== 'unconfigured' && name !== 'signed-out' ? ", 'true ? '))
await mutant('the view\'s error words show the route\'s code', () => comp('<h3>{words.title}</h3>', '<h3>{words.title} {state.code}</h3>'))
await mutant('the view draws with the flag off', () => proveGate(swap(COMP_SRC, 'return STUDIO_USAGE_CREDITS_ENABLED ? <StudioUsageCreditsLoader /> : null', 'return <StudioUsageCreditsLoader />')))
await mutant('the plan name is not escaped', () => comp('{usagePlanLabel(view.plan)} plan', '<i dangerouslySetInnerHTML={{ __html: usagePlanLabel(view.plan) }} /> plan'))
// the stylesheet
await mutant('the bars use the purple accent', () => proveCss(swap(CSS_SRC, '--suc-bar: var(--ss-teal, #1f6f72);', '--suc-bar: var(--ss-accent, #6a4fc0);')))
await mutant('the fill is a gradient', () => proveCss(swap(CSS_SRC, '.suc-fill { height: 100%; border-radius: 999px; background: var(--suc-bar); }', '.suc-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--suc-bar), var(--suc-soft)); }')))
await mutant('the dark set is missing', () => proveCss(swap(CSS_SRC, '.dark [data-studio-usage-credits="true"] {', '.darkish [data-studio-usage-credits="true"] {')))
await mutant('the dark text is too dark for the panel', () => proveCss(swap(CSS_SRC, '--suc-muted: var(--ss-muted, #a0b1ad);', '--suc-muted: var(--ss-muted, #4a5a56);')))
await mutant('the root is fixed at 400 px (a 375 phone scrolls sideways)', () => proveCss(swap(CSS_SRC, '  width: 100%;\n  max-width: 100%;\n  min-width: 0;', '  width: 400px;\n  max-width: 100%;\n  min-width: 0;')))
await mutant('the balances do not stack on a phone', () => proveCss(swap(CSS_SRC, '  .suc-balances { grid-template-columns: minmax(0, 1fr); }\n', '')))
await mutant('the bars cannot shrink (no flex basis of zero)', () => proveCss(swap(CSS_SRC, '.suc-bar { display: flex; align-items: flex-end; flex: 1 1 0;', '.suc-bar { display: flex; align-items: flex-end; flex: 0 0 14px;')))
await mutant('a row may not wrap', () => proveCss(swap(CSS_SRC, '.suc-row { display: flex; flex-wrap: wrap;', '.suc-row { display: flex; flex-wrap: nowrap;')))
await mutant('a grid column cannot shrink', () => proveCss(swap(CSS_SRC, '.suc-balances { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));', '.suc-balances { display: grid; grid-template-columns: repeat(3, 1fr);')))
await mutant('an unscoped global rule is added', () => proveCss(`${CSS_SRC}\nbody { margin: 0; }\n`))
// the pins
await mutant('a second subject filter is added to a taught proof', () => provePins(rel => rel === USAGE_CREDITS_PIN_FILES[0] ? `${read(rel)}  shas.splice(0, 1) // LATER-CHANGES: registry read (USAGE-CREDITS)\n` : read(rel)))
await mutant('the taught line loses its mark', () => provePins(rel => rel === USAGE_CREDITS_PIN_FILES[0] ? swap(read(rel), '// LATER-CHANGES: registry read (USAGE-CREDITS): on a branch', '// LATER-CHANGES: reg read (USAGE-CREDITS): on a branch') : read(rel)))
await mutant('the env block names the narration router address variable', () => provePins(rel => rel === '.env.example' ? swap(read(rel), 'at the router address the narration block above sets', 'at MODEL_ROUTER_URL, the address the narration block above sets') : read(rel)))
await mutant('the env block gains a value for the key', () => provePins(rel => rel === '.env.example' ? swap(read(rel), `${KEY_NAME}=\n`, `${KEY_NAME}=abc\n`) : read(rel)))
await mutant('the env block turns the flag on', () => provePins(rel => rel === '.env.example' ? swap(read(rel), `${FLAG}="false"`, `${FLAG}="true"`) : read(rel)))
await mutant('the env block is joined to the last block without a blank line', () => provePins(rel => rel === '.env.example' ? swap(read(rel), `\n\n${USAGE_CREDITS_ENV_BLOCK.split('\n')[0]}`, `\n${USAGE_CREDITS_ENV_BLOCK.split('\n')[0]}`) : read(rel)))
await mutant('a secret-shaped literal is added to a new file', () => provePins(rel => rel === LIB ? `${read(rel)}\nconst k = '${'s' + 'k-'}${'a1'.repeat(12)}'\n` : read(rel)))

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
console.log('test-studio-usage-credits: all checks passed; no network, no router, no key.')
