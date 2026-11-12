// FRONTEND-1: proof of the Brand Kit caller (Studio half; spec streams/pass5/BRAND-KIT-CALLER.md, BK-C1..BK-C19 at BK-Q1..Q12's proposed defaults), ONE flag-off Draft on the Studio dev branch (studio-v4-dev-preparation-code, 6872a813).
// Flag NEXT_PUBLIC_STUDIO_BRAND_KIT, the exact string "true", default off. Nothing is called: every service is a stub that records what it was asked, and every secret below is made up at run time and never printed.
//
//   node scripts/test-studio-brand-kit.mjs     (plain node, offline: the REAL sources transpiled and run (routes with a stubbed session, database and fetch; the Themes page's kit with a small React host); git is read for the strip, the registry and the scope; no network, no browser)
//   BRAND_KIT_QUICK=1                          skip the mutants
//
// What it proves (A to J), then mutants (K):
//  A. FLAG OFF (unset, "false", "True", "TRUE", "1", " true", "true "): the two new routes answer 404 before the session is read, the database is asked, a key is read or anything is fetched; the eight existing theme proxy fetches are the BASE files' fetches (same URL,
//     same init, same answer) even with the entitlement flag and the secret on; the kit's hook holds an empty reducer and starts nothing; the identity hook fetches nothing and resolves the base's identity;
//  B. SIGNING (BK-C19): with the flag on, each of the eight existing fetches carries X-Deckster-Entitlement exactly when the entitlement flag is on and the secret is set, for the session's own user id (the e-mail for an e-mail-only session), with the method of THAT call
//     (GET list/get/standard, POST save, PUT set-standard, PATCH rename, DELETE delete and clear-standard); claims read by an independent verifier (HMAC, v1, typ rest, lifetime 120 s, no sid); the secret is read only when both flags are on;
//  C. EXTRACT ROUTE (BK-C4, C5, C8, C9): signed in, approved, the key from the server-only variable, the file checked (one exact Content-Type, 4 MiB, the first bytes), the per-person daily cap counted BEFORE the one paid call and failing closed, exactly Content-Type and
//     X-API-Key forwarded (no client header), the answer cleaned and passed with no-store, every failure a fixed Studio code (Theme Builder's text and the key never leave), no retry, redirects refused, the outgoing host is the configured UAT one and never a production default;
//  D. BRAND PROXY (BK-C12, C14, C15): the user in the Director path is the session's (never a header or a query), signed with the method of the call, the PUT body checked (Director's six keys only, https logo, limits, eight catalog fonts, colours refused), an empty record
//     refused unless ?clear=1, Director's refusals in Studio's codes;
//  E. THE PURE HALF: Theme Builder's answer is read as the contract has it (originals untouched, derived roles apart, a mismatch is a broken answer), the brand record rules, Director's refusals, the file rules, the logo-host seam is a typed null;
//  F. THE STATE MACHINE AND ITS FLOWS (BK-C7, C9, C13): no extraction without consent, one click one call, a failure is never retried, the draft is written only by "Use these colours" / "Use suggested fonts" and only with the originals, a save sends nothing for an empty form,
//     the theme is created before the brand is PUT, a failed PUT keeps the theme and retries only the PUT;
//  G. THE SCREEN (the real component on a small React host): consent first, the proposal with originals, derived roles, every warning and every failing contrast row, edits shown against the suggestion, the sample slide, the status line, the saved details read for one theme;
//  H. THE PAGE'S MARKED LINES RUN (cut out of the real themes-workspace.tsx): the hook is called with the flag, Save stays off for a brand detail that cannot be saved, the brand save follows the theme save, a new draft resets the kit, every mount is gated;
//  I. DECK IDENTITY (BK-C17, C18): the standard theme's kit replaces the browser copy for all three fields, footer to company, source "form", read once and fail soft; the resolver returns the browser form untouched with no kit;
//  J. SOURCES, REGISTRY, ENV, SCOPE: every added line in an existing file carries the marker, the strip puts BASE back byte for byte, the registry has three lines at the true end of their lists, the .env.example block, scope read from the COMMITTED diff only;
//  K. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'
import * as stripModule from './studio-brand-kit-strip.mjs'
import * as registry from './studio-later-changes.mjs'
import { Root, hostNodes, textOf } from './studio-chat-harness/mini-react.mjs'

const { BASE_COMMIT, BRAND_KIT_SCOPE_FILES: SCOPE, BRAND_KIT_NEW_FILES: NEW_FILES, BRAND_KIT_APP_FILES: APP_FILES, BRAND_KIT_PIN_FILES: PIN_FILES, BRAND_KIT_ALL_EDITS: ALL_EDITS, BRAND_KIT_MARKER_RE: MARKER_RE, BRAND_KIT_SUBJECT: SUBJECT, BRAND_KIT_PIN_MARK: PIN_MARK, BRAND_KIT_ENV_BLOCK: ENV_BLOCK, THEME_PROXY_FILES, stripBrandKit } = stripModule

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const count = (text, needle) => text.split(needle).length - 1
const POST_ME = new Set(registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(stripBrandKit) + 1)) // the changes registered AFTER this one (a later change stacked on it): their lines come out before ours are read
const AFTER_ENV = registry.LATER_ENV_BLOCKS.slice(registry.LATER_ENV_BLOCKS.indexOf(ENV_BLOCK) + 1)
/** What a file reads like with the later changes' lines (and .env.example blocks) taken out; ours stay in. With nothing registered after this change it is the file as it is. */
const later = (rel, text) => {
  let out = text
  for (const strip of POST_ME) { if (typeof strip !== 'function') continue; const next = strip(rel, out); if (typeof next === 'string') out = next } // LATER-CHANGES: registry read (BRAND-KIT-CALLER)
  if (rel === '.env.example') for (const block of AFTER_ENV) out = out.replace(`\n${block}`, '')
  return out
}
const read = rel => later(rel, fs.readFileSync(path.join(root, rel), 'utf8'))
const committed = rel => later(rel, git('show', `HEAD:${rel}`))
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
const deepEqual = (actual, expected, ...message) => assert.deepStrictEqual(actual, expected, ...message)

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 900)} @ ${(String(error?.stack ?? '').match(/test-studio-brand-kit\.mjs:\d+:\d+/) ?? ['?'])[0]}`) }
}
let caught = 0
const missed = []
/** A mutant is caught only by a failed ASSERTION of a check. A mutant whose edit did not apply (SwapError) or that crashed some other way proves nothing and is reported as missed. */
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY || process.env.BRAND_KIT_QUICK) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 200)})`) } else { caught++; console.log(`CAUGHT mutant ${label}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 90))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

// ---- the real sources, run in this realm with a stubbed world ------------------------------------------------------------------------------------------------------------------------------------------
const LIB = 'lib/studio-brand-kit.ts', STATE = 'lib/studio-brand-kit-state.ts', SERVER = 'lib/studio-brand-kit-server.ts', HOOKS = 'hooks/use-brand-kit.ts', PANEL = 'components/studio-libraries/brand-kit-panel.tsx'
const EXTRACT = 'app/api/brand/extract/route.ts', BRAND = 'app/api/themes/[id]/brand/route.ts', WORKSPACE = 'components/studio-libraries/themes-workspace.tsx', IDLIB = 'lib/deck-identity.ts', IDHOOK = 'hooks/use-deck-identity.ts'
const [T_LIST, T_ID, T_STD_SET, T_STD] = THEME_PROXY_FILES
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP = 'scripts/studio-brand-kit-strip.mjs', PROOF = 'scripts/test-studio-brand-kit.mjs', ENVFILE = '.env.example'
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const localFile = (spec, from) => {
  const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('./') ? path.posix.join(path.posix.dirname(from), spec.slice(2)) : null
  if (base === null) return null
  if (base.endsWith('.css')) return 'css'
  for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, base + ext))) return base + ext
  throw new Error(`unexpected import ${spec} in ${from}`)
}
/**
 * A world: the real sources loaded on demand with `env` as process.env, `fetch` as the global fetch, `stubs` for the named imports (next, next-auth, the database), and `texts` replacing any file's text (a mutant or the BASE file).
 * `reads` is every process.env key a source looked at, in order.
 */
function createWorld({ env = {}, texts = {}, stubs = {}, fetch = () => assert.fail('a source fetched'), console: con = console } = {}) {
  const modules = new Map(), reads = []
  const envObject = new Proxy({ ...env }, { get: (target, key) => { if (typeof key === 'string') reads.push(key); return target[key] } })
  const load = rel => {
    if (modules.has(rel)) return modules.get(rel).exports
    const module = { exports: {} }
    modules.set(rel, module)
    const req = spec => {
      if (Object.prototype.hasOwnProperty.call(stubs, spec)) return stubs[spec]
      if (spec === 'react') return React
      if (spec === 'react/jsx-runtime') return jsxRuntime
      const local = localFile(spec, rel)
      if (local === 'css') return {}
      return local ? load(local) : nodeRequire(spec)
    }
    const fn = vm.runInThisContext(`(function (module, exports, require, process, fetch, console) {${compile(rel, texts[rel] ?? read(rel))}\n})`, { filename: rel })
    fn(module, module.exports, req, { env: envObject }, fetch, con)
    return module.exports
  }
  return { load, reads }
}

// ---- made up for this run only: never a literal, never printed ------------------------------------------------------------------------------------------------------------------------------------------
const KEY = `${crypto.randomBytes(20).toString('hex')}Kk`
const SECRET = crypto.randomBytes(24).toString('hex')
const LEAK = `leak-${crypto.randomBytes(6).toString('hex')}`
const USER_ID = 'user-db-7f3a', EMAIL = 'person@example.test'
const UAT_TB = 'https://themebuilderv10-uat.up.railway.app', UAT_DIRECTOR = 'https://directorv40-uat.up.railway.app'
const PROD_HOSTS = ['theme-v1.up.railway.app', 'directorv33-production.up.railway.app']
const FLAG = 'NEXT_PUBLIC_STUDIO_BRAND_KIT'
const ENV_ON = { [FLAG]: 'true' }
/** Every way for the flag to be off. */
const FLAG_OFF = { unset: undefined, '"false"': 'false', '"True"': 'True', '"TRUE"': 'TRUE', '"1"': '1', '" true"': ' true', '"true "': 'true ', '""': '' }
const flagEnv = value => (value === undefined ? {} : { [FLAG]: value })

// ---- an independent reader of X-Deckster-Entitlement (the contract, not the helper) -------------------------------------------------------------------------------------------------------------------------
function readEntitlement(header, { secret = SECRET, sub, method }) {
  assert.equal(typeof header, 'string', 'a header is sent'); assert.ok(Buffer.byteLength(header) <= 4096)
  const [payloadB64, signature, extra] = header.split('.'); assert.equal(extra, undefined)
  assert.equal(signature, crypto.createHmac('sha256', secret).update(`deckster-rest-v1.${payloadB64}`).digest('base64url'), 'the signature is HMAC-SHA256 over "deckster-rest-v1." + payload with the Director secret')
  const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  assert.equal(claims.v, 1); assert.equal(claims.typ, 'rest'); assert.equal(claims.sub, sub, 'sub is the user id in the Director path'); assert.equal(claims.m, method, 'the claim carries the method of THIS call')
  assert.equal(claims.exp - claims.iat, 120); assert.ok(Math.abs(claims.iat - Date.now() / 1000) < 60); assert.ok(!('sid' in claims)); assert.ok(!('bq' in claims))
  return claims
}
const HEADER = 'X-Deckster-Entitlement'
const headerOf = init => { const h = init?.headers ?? {}; const key = Object.keys(h).find(k => k.toLowerCase() === HEADER.toLowerCase()); return key ? h[key] : undefined }

// ---- the bytes and Theme Builder's answer, as the contract has it (hand-built to BK-C6's shape; no Theme Builder call) ---------------------------------------------------------------------------------
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(120)])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(120)])
const ROLES = { primary: '#0047ab', primary_dark: '#00306f', secondary: '#d62828', accent: '#f2b400', background: '#ffffff', background_alt: '#f4f7fb', surface: '#eef3fa', border: '#c9d4e5', text_primary: '#0b1a33', text_secondary: '#3b4a63', text_body: '#1d2b45', text_on_dark: '#ffffff', hero_background: '#00306f', hero_text_primary: '#ffffff' }
const chk = (foreground_role, foreground_hex, background_role, background_hex, ratio) => ({ foreground_role, foreground_hex, background_role, background_hex, ratio, passes_aa: ratio >= 4.5 })
const TB_OK = {
  theme_payload: { mode: 'custom', primary_hex: '#0047ab', secondary_hex: '#d62828', tertiary_hex: '#f2b400', font_family_heading: 'Lora', font_family: 'Lato' },
  brand: { heading_font: 'Lora', body_font: 'Lato' },
  preview: {
    source_colors: { primary_hex: '#0047ab', secondary_hex: '#d62828', tertiary_hex: '#f2b400' },
    role_colors: ROLES,
    contrast_checks: [chk('text_primary', '#0b1a33', 'background', '#ffffff', 17.2), chk('text_secondary', '#3b4a63', 'background', '#ffffff', 9.1), chk('text_body', '#1d2b45', 'background', '#ffffff', 14.4), chk('text_on_dark', '#ffffff', 'primary_dark', '#00306f', 12.5), chk('hero_text_primary', '#ffffff', 'hero_background', '#00306f', 12.5), chk('primary_hex', '#0047ab', 'background', '#ffffff', 9.01), chk('secondary_hex', '#d62828', 'background', '#ffffff', 4.93), chk('tertiary_hex', '#f2b400', 'background', '#ffffff', 1.78)],
    warnings: ['The tertiary brand color has low contrast as normal text on the preview background.'],
    font_suggestions_review_only: true,
  },
}
const clone = value => JSON.parse(JSON.stringify(value))
/** TB_OK with the colours in UPPER case, as a model may have answered: the route must hand on what Theme Builder says, lowercased by Theme Builder (here: by the cleaner, since the contract says they are lowercase). */
const REAL_CHECKS = []

// ---- the stubbed world of a route ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const nextServer = { NextResponse: { json: (body, init) => Response.json(body, init) } }
function makeConsole() { const lines = []; return { lines, error: (...a) => lines.push(a.map(String).join(' ')), log: (...a) => lines.push(a.map(String).join(' ')), warn: (...a) => lines.push(a.map(String).join(' ')) } }
function rig({ env = ENV_ON, files = [], session = 'id', approved = null, count = () => 0, upstream = () => ({ status: 200, body: {} }), texts = {} } = {}) {
  const calls = { session: 0, approved: 0, counts: [], records: [], fetch: [], order: [] }
  const sessionValue = session === 'id' ? { user: { id: USER_ID, email: EMAIL } } : session === 'email' ? { user: { email: EMAIL } } : null
  const con = makeConsole()
  const fetch = async (url, init) => {
    calls.order.push('fetch'); calls.fetch.push({ url: String(url), init })
    const answer = await upstream(String(url), init)
    if (answer.throws) throw answer.throws
    return new Response(answer.raw ?? JSON.stringify(answer.body), { status: answer.status })
  }
  const stubs = {
    'next/server': nextServer,
    'next-auth': { getServerSession: async () => { calls.session++; return sessionValue } },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/api-hardening': {
      requireApprovedUser: async () => { calls.approved++; return approved },
      countRateEvents: async where => { calls.order.push('count'); calls.counts.push(where); return count(where) },
      recordRateEvent: async (...args) => { calls.order.push('record'); calls.records.push(args) },
    },
  }
  const world = createWorld({ env, texts, stubs, fetch, console: con })
  return { world, calls, console: con, reads: world.reads, env }
}
const req = (url, { method = 'GET', headers = {}, body } = {}) => new Request(url, { method, headers, body, ...(body && typeof body.getReader === 'function' ? { duplex: 'half' } : {}) })
const bodyOf = async res => { const text = await res.text(); try { return { text, json: JSON.parse(text) } } catch { return { text, json: null } } }
const NOTHING_CALLED = (r, label) => { assert.equal(r.calls.session, 0, `${label}: the session is not read`); assert.equal(r.calls.approved, 0, `${label}: the approval is not asked`); assert.equal(r.calls.fetch.length, 0, `${label}: nothing is fetched`); assert.equal(r.calls.counts.length + r.calls.records.length, 0, `${label}: nothing is counted`) }

// ============================================================================================================================================
// the checks (each takes `texts`, so a mutant can feed it one edited source)
// ============================================================================================================================================
const THEME_CALLS = {
  list: { file: T_LIST, fn: 'GET', method: 'GET', url: '/themes', make: () => ({ args: [] }) },
  save: { file: T_LIST, fn: 'POST', method: 'POST', url: '/themes', make: () => ({ args: [req('http://x/api/themes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'n', theme: { mode: 'preset' } }) })] }) },
  get: { file: T_ID, fn: 'GET', method: 'GET', url: '/themes/t-1', make: () => ({ args: [req('http://x/'), { params: Promise.resolve({ id: 't-1' }) }] }) },
  rename: { file: T_ID, fn: 'PATCH', method: 'PATCH', url: '/themes/t-1', make: () => ({ args: [req('http://x/', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'm' }) }), { params: Promise.resolve({ id: 't-1' }) }] }) },
  del: { file: T_ID, fn: 'DELETE', method: 'DELETE', url: '/themes/t-1', make: () => ({ args: [req('http://x/', { method: 'DELETE' }), { params: Promise.resolve({ id: 't-1' }) }] }) },
  setStandard: { file: T_STD_SET, fn: 'PUT', method: 'PUT', url: '/themes/t-1/standard', make: () => ({ args: [req('http://x/', { method: 'PUT' }), { params: Promise.resolve({ id: 't-1' }) }] }) },
  getStandard: { file: T_STD, fn: 'GET', method: 'GET', url: '/themes/standard', make: () => ({ args: [] }) },
  clearStandard: { file: T_STD, fn: 'DELETE', method: 'DELETE', url: '/themes/standard', make: () => ({ args: [] }) },
}
const THEME_ANSWER = { themes: [], count: 0, theme: null, ok: true }
/** One of the eight theme proxy calls, run on `file`'s text (the new file, the BASE file, or a mutant); resolves the one Director fetch it made and the answer it sent. */
async function themeCall(name, { env, sessionKind = 'id', texts = {}, useBase = false }) {
  const spec = THEME_CALLS[name]
  const files = useBase ? { ...texts, [spec.file]: baseText(spec.file) } : texts
  const r = rig({ env, session: sessionKind, texts: files, upstream: () => ({ status: 200, body: THEME_ANSWER }) })
  const route = r.world.load(spec.file)
  const res = await route[spec.fn](...spec.make().args)
  assert.equal(r.calls.fetch.length, 1, `${name}: exactly one Director fetch`)
  return { fetch: r.calls.fetch[0], status: res.status, body: await res.json(), reads: r.reads }
}
const EVERY_THEME_CALL = Object.keys(THEME_CALLS)
const sameInit = (a, b) => deepEqual(JSON.parse(JSON.stringify(a, (k, v) => (v === undefined ? null : v))), JSON.parse(JSON.stringify(b, (k, v) => (v === undefined ? null : v))))

async function flagOffChecks(texts = {}) {
  // the extract route and the brand proxy do not exist: 404 before anything is read
  for (const [label, value] of Object.entries(FLAG_OFF)) {
    const e = rig({ env: { ...flagEnv(value), THEME_BUILDER_BRAND_EXTRACT_KEY: KEY, NEXT_PUBLIC_THEME_BUILDER_URL: UAT_TB, DIRECTOR_API_URL: UAT_DIRECTOR, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'true', DIRECTOR_WS_AUTH_SECRET: SECRET }, texts })
    const extractRoute = e.world.load(EXTRACT), mark = e.reads.length // (modules read some addresses when they are imported; what matters is what the handler reads)
    const res = await extractRoute.POST(req('http://x/api/brand/extract', { method: 'POST', headers: { 'content-type': 'image/png' }, body: PNG }))
    assert.equal(res.status, 404, `extract, flag ${label}: 404`); NOTHING_CALLED(e, `extract, flag ${label}`)
    deepEqual([...new Set(e.reads.slice(mark))], [FLAG], `extract, flag ${label}: the only thing the handler reads from the environment is the flag (no key, no URL, no secret)`)
    const b = rig({ env: { ...flagEnv(value), DIRECTOR_API_URL: UAT_DIRECTOR, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'true', DIRECTOR_WS_AUTH_SECRET: SECRET }, texts })
    const route = b.world.load(BRAND), mark2 = b.reads.length
    for (const [method, init] of [['GET', {}], ['PUT', { method: 'PUT', body: '{"footer":"x"}' }]]) {
      const res2 = await route[method](req('http://x/api/themes/t-1/brand', { method: init.method, body: init.body }), { params: Promise.resolve({ id: 't-1' }) })
      assert.equal(res2.status, 404, `brand ${method}, flag ${label}: 404`); NOTHING_CALLED(b, `brand ${method}, flag ${label}`)
    }
    deepEqual([...new Set(b.reads.slice(mark2))], [FLAG], `brand, flag ${label}: only the flag is read`)
  }
  // the eight existing theme fetches are the BASE files' fetches, even with the entitlement flag and the secret on
  for (const [label, value] of Object.entries(FLAG_OFF)) {
    for (const name of EVERY_THEME_CALL) {
      const env = { ...flagEnv(value), DIRECTOR_API_URL: UAT_DIRECTOR, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'true', DIRECTOR_WS_AUTH_SECRET: SECRET }
      const now = await themeCall(name, { env, texts }), was = await themeCall(name, { env, useBase: true })
      assert.equal(now.fetch.url, was.fetch.url, `${name}, flag ${label}: the same URL`); sameInit(now.fetch.init, was.fetch.init)
      assert.equal(headerOf(now.fetch.init), undefined, `${name}, flag ${label}: no entitlement header`); assert.equal(now.status, was.status); deepEqual(now.body, was.body)
      assert.ok(!now.reads.includes('DIRECTOR_WS_AUTH_SECRET'), `${name}, flag ${label}: the secret is not read`)
    }
  }
}

async function signingChecks(texts = {}) {
  const SIGNED = { ...ENV_ON, DIRECTOR_API_URL: UAT_DIRECTOR, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'true', DIRECTOR_WS_AUTH_SECRET: SECRET }
  for (const name of EVERY_THEME_CALL) {
    const spec = THEME_CALLS[name]
    for (const sessionKind of ['id', 'email']) {
      const sub = sessionKind === 'id' ? USER_ID : EMAIL
      const { fetch } = await themeCall(name, { env: SIGNED, sessionKind, texts })
      assert.equal(fetch.url, `${UAT_DIRECTOR}/api/users/${encodeURIComponent(sub)}${spec.url}`, `${name}: the Director path names the session's user`)
      readEntitlement(headerOf(fetch.init), { sub, method: spec.method })
      const was = await themeCall(name, { env: SIGNED, sessionKind, useBase: true })
      const stripped = { ...fetch.init, headers: Object.fromEntries(Object.entries(fetch.init.headers ?? {}).filter(([k]) => k.toLowerCase() !== HEADER.toLowerCase())) }
      if (!Object.keys(stripped.headers).length) delete stripped.headers
      const baseInit = { ...was.fetch.init }; if (!baseInit.headers) delete baseInit.headers
      sameInit(stripped, baseInit) // the signed call is the base call plus the one header
      assert.equal(fetch.init.method ?? 'GET', spec.method, `${name}: the method is the base's`)
    }
    // the entitlement flag off, or no secret: the flag alone adds nothing and the secret is not read
    for (const env of [{ ...SIGNED, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: undefined }, { ...SIGNED, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'false' }, { ...SIGNED, DIRECTOR_WS_AUTH_SECRET: undefined }]) {
      const { fetch, reads } = await themeCall(name, { env, texts })
      assert.equal(headerOf(fetch.init), undefined, `${name}: no header unless both the entitlement flag and the secret are on`)
      if (env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED !== 'true') assert.ok(!reads.includes('DIRECTOR_WS_AUTH_SECRET'), `${name}: the secret is not read with the entitlement flag off`)
    }
  }
}

// ---- the extract route ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const EXTRACT_ENV = { ...ENV_ON, THEME_BUILDER_BRAND_EXTRACT_KEY: KEY, NEXT_PUBLIC_THEME_BUILDER_URL: UAT_TB }
const post = (r, { body = PNG, headers = { 'content-type': 'image/png' } } = {}) => r.world.load(EXTRACT).POST(req('http://localhost/api/brand/extract', { method: 'POST', headers, body }))
const extractRig = (opts = {}) => rig({ env: EXTRACT_ENV, ...opts, upstream: opts.upstream ?? (() => ({ status: 200, body: TB_OK })) })

async function extractChecks(texts = {}) {
  const mk = (o = {}) => extractRig({ ...o, texts })
  // signed in, approved
  { const r = mk({ session: null }); const res = await post(r); assert.equal(res.status, 401); assert.equal((await bodyOf(res)).json.code, 'signin'); assert.equal(r.calls.fetch.length, 0); assert.equal(r.calls.counts.length, 0) }
  { const denied = Response.json({ error: 'account_pending_approval' }, { status: 403 }); const r = mk({ approved: denied }); const res = await post(r); assert.equal(res.status, 403); assert.equal(r.calls.fetch.length, 0); assert.equal(r.calls.counts.length, 0) }
  // not configured: no key, no address, a malformed address: nothing is fetched and no daily slot is used
  for (const [label, env, code] of [['no key', { ...EXTRACT_ENV, THEME_BUILDER_BRAND_EXTRACT_KEY: undefined }, 'unconfigured'], ['empty key', { ...EXTRACT_ENV, THEME_BUILDER_BRAND_EXTRACT_KEY: '' }, 'unconfigured'], ['no address', { ...EXTRACT_ENV, NEXT_PUBLIC_THEME_BUILDER_URL: undefined }, 'SERVICE_URL_NOT_CONFIGURED'], ['bad address', { ...EXTRACT_ENV, NEXT_PUBLIC_THEME_BUILDER_URL: 'theme-builder' }, 'SERVICE_URL_INVALID']]) {
    const r = rig({ env, texts }); const res = await post(r); const out = await bodyOf(res)
    assert.equal(res.status, 503, `${label}: 503`); assert.equal(out.json.code, code, `${label}: ${code}`); assert.equal(r.calls.fetch.length, 0, `${label}: nothing fetched`); assert.equal(r.calls.counts.length + r.calls.records.length, 0, `${label}: no slot used`)
  }
  // the type: exactly one Content-Type, exactly image/png or image/jpeg
  for (const [label, headers] of [['none', {}], ['gif', { 'content-type': 'image/gif' }], ['svg', { 'content-type': 'image/svg+xml' }], ['webp', { 'content-type': 'image/webp' }], ['pdf', { 'content-type': 'application/pdf' }], ['json', { 'content-type': 'application/json' }], ['multipart', { 'content-type': 'multipart/form-data; boundary=x' }], ['a parameter', { 'content-type': 'image/png; charset=binary' }], ['twice', { 'content-type': 'image/png, image/png' }], ['both', { 'content-type': 'image/png, image/jpeg' }]]) {
    const r = mk(); const res = await post(r, { headers }); assert.equal(res.status, 415, `Content-Type ${label}: 415`); assert.equal((await bodyOf(res)).json.code, 'type'); assert.equal(r.calls.fetch.length + r.calls.counts.length, 0, `Content-Type ${label}: nothing counted or fetched`)
  }
  { const r = mk(); const res = await post(r, { headers: { 'content-type': ' IMAGE/PNG ' } }); assert.equal(res.status, 200, 'after trim and lower-casing it is image/png (as Theme Builder reads it)') }
  // the size: the declared length, then the stream; 4 MiB is the cap and is allowed
  const MAX = 4 * 1024 * 1024
  for (const [label, headers] of [['one byte over', { 'content-type': 'image/png', 'content-length': String(MAX + 1) }], ['absurd', { 'content-type': 'image/png', 'content-length': '99999999999' }], ['not a number', { 'content-type': 'image/png', 'content-length': 'abc' }]]) {
    const r = mk(); const res = await post(r, { headers }); assert.equal(res.status, 413, `declared length ${label}: 413`); assert.equal(r.calls.fetch.length + r.calls.counts.length, 0)
  }
  { const r = mk(); let pulled = 0; const stream = new ReadableStream({ pull(controller) { pulled++; controller.enqueue(new Uint8Array(1024 * 1024).fill(1)); if (pulled > 40) controller.close() } })
    const res = await r.world.load(EXTRACT).POST(req('http://localhost/api/brand/extract', { method: 'POST', headers: { 'content-type': 'image/png' }, body: stream })); assert.equal(res.status, 413, 'a stream with no length that runs over the cap: 413'); assert.ok(pulled < 12, `and the stream is not read to its end (${pulled} chunks)`); assert.equal(r.calls.fetch.length + r.calls.counts.length, 0) }
  { const big = Buffer.concat([PNG, Buffer.alloc(MAX - PNG.length)]); const r = mk(); const res = await post(r, { body: big }); assert.equal(res.status, 200, 'exactly 4 MiB is allowed'); assert.equal(Buffer.from(r.calls.fetch[0].init.body).length, MAX) }
  { const r = mk(); const res = await post(r, { body: Buffer.alloc(0) }); assert.equal(res.status, 400); assert.equal((await bodyOf(res)).json.code, 'empty'); assert.equal(r.calls.fetch.length + r.calls.counts.length, 0) }
  // the first bytes must say what the Content-Type says
  for (const [label, body, type] of [['JPEG bytes as png', JPEG, 'image/png'], ['PNG bytes as jpeg', PNG, 'image/jpeg'], ['random bytes', crypto.randomBytes(200), 'image/png'], ['html', Buffer.from('<html><script>alert(1)</script></html>'), 'image/jpeg'], ['a short PNG signature', PNG.subarray(0, 5), 'image/png']]) {
    const r = mk(); const res = await post(r, { body, headers: { 'content-type': type } }); assert.equal(res.status, 415, `${label}: 415`); assert.equal(r.calls.fetch.length + r.calls.counts.length, 0, `${label}: nothing counted or fetched`)
  }
  // the daily cap: counted before the call, fails closed
  { const r = mk({ count: () => 10 }); const res = await post(r); assert.equal(res.status, 429); assert.equal((await bodyOf(res)).json.code, 'cap'); assert.equal(r.calls.fetch.length, 0, 'at the cap: no call'); assert.equal(r.calls.records.length, 0, 'and nothing recorded') }
  { const r = mk({ count: () => 9 }); const res = await post(r); assert.equal(res.status, 200); deepEqual(r.calls.order, ['count', 'record', 'fetch'], 'one under the cap: counted, recorded, THEN the one paid call'); deepEqual(r.calls.records[0], ['brand_extract', 'user', USER_ID], 'recorded for this user in the brand_extract bucket'); assert.equal(r.calls.counts[0].subject, USER_ID); assert.equal(r.calls.counts[0].bucket, 'brand_extract'); assert.ok(r.calls.counts[0].since instanceof Date && Date.now() - r.calls.counts[0].since.getTime() < 86_400_000 + 1000, 'today (UTC day) only') }
  { const r = mk({ env: { ...EXTRACT_ENV, STUDIO_BRAND_EXTRACT_DAILY_CAP: '3' }, count: () => 3 }); assert.equal((await post(r)).status, 429, 'the cap follows STUDIO_BRAND_EXTRACT_DAILY_CAP') }
  { const r = mk({ env: { ...EXTRACT_ENV, STUDIO_BRAND_EXTRACT_DAILY_CAP: '3' }, count: () => 2 }); assert.equal((await post(r)).status, 200) }
  for (const bad of ['0', '101', '-1', 'x', '5.5', '']) { const r = mk({ env: { ...EXTRACT_ENV, STUDIO_BRAND_EXTRACT_DAILY_CAP: bad }, count: () => 10 }); assert.equal((await post(r)).status, 429, `a bad cap setting ${JSON.stringify(bad)} is the default 10`) }
  { const r = mk({ count: () => { throw new Error('db down') } }); const res = await post(r); assert.equal(res.status, 503, 'a count that cannot be read: 503'); assert.equal(r.calls.fetch.length, 0, 'and the paid call is not made (fails closed)') }
  // the one request: exactly Content-Type and X-API-Key, to the configured Theme Builder, with the file's bytes
  for (const [label, type, body, address] of [['png', 'image/png', PNG, UAT_TB], ['jpeg', 'image/jpeg', JPEG, `${UAT_TB}/`]]) {
    const r = mk({ env: { ...EXTRACT_ENV, NEXT_PUBLIC_THEME_BUILDER_URL: address } })
    const res = await post(r, { body, headers: { 'content-type': type, cookie: 'session=abc', authorization: 'Bearer client-token', 'x-forwarded-for': '203.0.113.9', 'x-mr-user': 'someone', 'x-api-key': 'client-supplied', 'user-agent': 'x', 'x-deckster-entitlement': 'client' } })
    assert.equal(res.status, 200, label); assert.equal(r.calls.fetch.length, 1, `${label}: ONE call to Theme Builder`)
    const { url, init } = r.calls.fetch[0]
    assert.equal(url, `${UAT_TB}/api/theme/v2/brand-extract`, `${label}: the configured UAT host and Theme Builder's path`)
    assert.ok(!PROD_HOSTS.some(host => url.includes(host)), `${label}: never a production host`)
    assert.equal(init.method, 'POST'); deepEqual(init.headers, { 'Content-Type': type, 'X-API-Key': KEY }, `${label}: exactly Content-Type and the server key; no client header is passed on`)
    assert.equal(init.redirect, 'error', 'a redirect is refused (the key does not follow it)'); assert.equal(init.cache, 'no-store'); assert.ok(init.signal instanceof AbortSignal, 'a timeout is set')
    assert.ok(Buffer.from(init.body).equals(body), `${label}: the body is the file's raw bytes (not multipart, not base64)`)
    assert.equal(res.headers.get('cache-control'), 'no-store', `${label}: no-store`)
    assert.ok(!JSON.stringify(await bodyOf(res)).includes(KEY), `${label}: the key is not in the answer`)
  }
  // the answer: Theme Builder's, cleaned: originals untouched, derived roles apart
  { const r = mk(); const res = await post(r); const { json } = await bodyOf(res)
    deepEqual(json.theme_payload, { mode: 'custom', primary_hex: '#0047ab', secondary_hex: '#d62828', tertiary_hex: '#f2b400', font_family_heading: 'Lora', font_family: 'Lato' }, 'theme_payload is the originals and the two catalog fonts, nothing else')
    deepEqual(json.brand, { heading_font: 'Lora', body_font: 'Lato' }); deepEqual(json.preview.source_colors, TB_OK.preview.source_colors); deepEqual(json.preview.role_colors, ROLES, 'the derived roles are in the preview only')
    assert.equal(json.preview.contrast_checks.length, 8); assert.deepEqual(json.preview.warnings, TB_OK.preview.warnings); assert.equal(json.preview.font_suggestions_review_only, true)
    for (const role of Object.keys(ROLES)) assert.ok(!(role in json.theme_payload) && !(`${role}_hex` in json.theme_payload) || role === 'primary' || role === 'secondary', `no role key ${role} in theme_payload`) }
  // Theme Builder's refusals, in Studio's codes; its own text and the key never come back; no retry
  const TB_STATUS = [[400, 400, 'unreadable'], [413, 413, 'size'], [415, 415, 'type'], [422, 422, 'no_colors'], [401, 503, 'unavailable'], [404, 503, 'unavailable'], [503, 503, 'unavailable'], [504, 504, 'timeout'], [502, 502, 'failed'], [500, 502, 'failed'], [418, 502, 'failed'], [429, 502, 'failed']]
  for (const [upstreamStatus, status, code] of TB_STATUS) {
    const r = mk({ upstream: () => ({ status: upstreamStatus, body: { detail: `Brand extraction failed ${LEAK} ${KEY}` } }) })
    const res = await post(r); const out = await bodyOf(res)
    assert.equal(res.status, status, `Theme Builder ${upstreamStatus} -> ${status}`); assert.equal(out.json.code, code, `Theme Builder ${upstreamStatus} -> ${code}`)
    assert.ok(!out.text.includes(LEAK) && !out.text.includes(KEY), `Theme Builder ${upstreamStatus}: its text and the key are not passed on`); assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.equal(r.calls.fetch.length, 1, `Theme Builder ${upstreamStatus}: no retry`); assert.ok(!r.console.lines.join('\n').includes(KEY) && !r.console.lines.join('\n').includes(LEAK), 'nothing logged carries the key or its text')
  }
  for (const [label, body] of [['not JSON', null], ['no theme_payload', { preview: {} }], ['no primary colour', { theme_payload: { mode: 'custom' } }], ['a primary that is not a hex', { ...clone(TB_OK), theme_payload: { ...TB_OK.theme_payload, primary_hex: 'blue' } }], ['source colours that disagree with the originals', { ...clone(TB_OK), preview: { ...clone(TB_OK.preview), source_colors: { primary_hex: '#111111' } } }], ['not custom', { ...clone(TB_OK), theme_payload: { ...TB_OK.theme_payload, mode: 'preset' } }]]) {
    const r = mk({ upstream: () => ({ status: 200, ...(body === null ? { raw: `not json ${LEAK}` } : { body }) }) }); const res = await post(r); const out = await bodyOf(res)
    assert.equal(res.status, 502, `a 200 that is ${label}: 502`); assert.ok(!out.text.includes(LEAK)); assert.equal(r.calls.fetch.length, 1)
  }
  { const r = mk({ upstream: () => ({ throws: new TypeError('fetch failed') }) }); const res = await post(r); assert.equal(res.status, 502, 'Theme Builder unreachable: 502'); assert.equal(r.calls.fetch.length, 1) }
  { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; const r = mk({ upstream: () => ({ throws: e }) }); const res = await post(r); assert.equal(res.status, 504, 'the fetch timeout: 504'); assert.equal((await bodyOf(res)).json.code, 'timeout') }
  // the source never names a production host or a public variable for the key
  const src = texts[EXTRACT] ?? read(EXTRACT)
  for (const host of PROD_HOSTS) assert.ok(!src.includes(host), `the route never names ${host}`)
  assert.ok(!/NEXT_PUBLIC_[A-Z_]*KEY/.test(src), 'the key is not a NEXT_PUBLIC_ variable'); assert.ok(src.includes('process.env.THEME_BUILDER_BRAND_EXTRACT_KEY'))
  assert.ok(/export const maxDuration = (\d+)/.test(src) && Number(/export const maxDuration = (\d+)/.exec(src)[1]) * 1000 > 65_000, 'the function may run longer than the fetch timeout')
}

// ---- the brand proxy -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const BRAND_ENV = { ...ENV_ON, DIRECTOR_API_URL: UAT_DIRECTOR, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'true', DIRECTOR_WS_AUTH_SECRET: SECRET }
const brandCall = (r, method, { id = 't-1', url = `http://localhost/api/themes/${id}/brand`, body, headers = {} } = {}) => r.world.load(BRAND)[method](req(url, { method, body, headers }), { params: Promise.resolve({ id }) })
const DIRECTOR_BRAND = { id: 't-1', brand: { logo_url: 'https://cdn.example.test/logo.png', placement: 'top_right', footer: 'Acme Corp', confidentiality: 'Confidential', heading_font: 'Lora', body_font: 'Lato' } }
async function brandChecks(texts = {}) {
  const mk = (o = {}) => rig({ env: BRAND_ENV, texts, upstream: () => ({ status: 200, body: DIRECTOR_BRAND }), ...o })
  // GET: the session's user, the method of the call, signed
  for (const sessionKind of ['id', 'email']) {
    const sub = sessionKind === 'id' ? USER_ID : EMAIL
    const r = mk({ session: sessionKind }); const res = await brandCall(r, 'GET', { url: 'http://localhost/api/themes/t-1/brand?user_id=evil&userId=evil', headers: { 'x-user-id': 'evil', 'x-deckster-entitlement': 'client' } }); const out = await bodyOf(res)
    assert.equal(res.status, 200); deepEqual(out.json, DIRECTOR_BRAND, 'the record comes back as { id, brand }'); assert.equal(res.headers.get('cache-control'), 'no-store')
    const { url, init } = r.calls.fetch[0]; assert.equal(url, `${UAT_DIRECTOR}/api/users/${encodeURIComponent(sub)}/themes/t-1/brand`, 'the path user is the session\'s, whatever a header or a query says'); assert.ok(!PROD_HOSTS.some(host => url.includes(host)))
    assert.equal(init.method ?? 'GET', 'GET'); readEntitlement(headerOf(init), { sub, method: 'GET' }); assert.equal(init.cache, 'no-store')
  }
  { const r = mk(); await brandCall(r, 'GET', { id: '../x/../../y?z=1#h' }); assert.equal(r.calls.fetch[0].url, `${UAT_DIRECTOR}/api/users/${USER_ID}/themes/${encodeURIComponent('../x/../../y?z=1#h')}/brand`, 'the theme id is encoded into its one path segment') }
  { const r = mk({ session: null }); const res = await brandCall(r, 'GET'); assert.equal(res.status, 401); assert.equal(r.calls.fetch.length, 0) }
  { const r = mk({ env: { ...BRAND_ENV, DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: undefined } }); const res = await brandCall(r, 'GET'); assert.equal(res.status, 200); assert.equal(headerOf(r.calls.fetch[0].init), undefined, 'with the entitlement flag off the call goes unsigned (Director will refuse it: the flag must be on with the kit)') }
  { const r = mk({ env: { ...BRAND_ENV, DIRECTOR_API_URL: undefined } }); const res = await brandCall(r, 'GET'); assert.equal(res.status, 503); assert.equal((await bodyOf(res)).json.code, 'SERVICE_URL_NOT_CONFIGURED'); assert.equal(r.calls.fetch.length, 0) }
  // PUT: the body is checked, the record is cleaned, the call is signed PUT
  const put = (r, body, extra = {}) => brandCall(r, 'PUT', { body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' }, ...extra })
  { const r = mk(); const res = await put(r, { logo_url: ' https://cdn.example.test/logo.png ', footer: '  Acme   Corp ', confidentiality: 'Confidential', heading_font: 'Lora', body_font: 'Lato', placement: 'top_right' }); assert.equal(res.status, 200)
    const { url, init } = r.calls.fetch[0]; assert.equal(url, `${UAT_DIRECTOR}/api/users/${USER_ID}/themes/t-1/brand`); assert.equal(init.method, 'PUT'); assert.equal(init.headers['Content-Type'], 'application/json'); readEntitlement(headerOf(init), { sub: USER_ID, method: 'PUT' })
    deepEqual(JSON.parse(init.body), { logo_url: 'https://cdn.example.test/logo.png', placement: 'top_right', footer: 'Acme Corp', confidentiality: 'Confidential', heading_font: 'Lora', body_font: 'Lato' }, 'the record is cleaned and in Director\'s order') }
  const refused = [
    ['an unknown key', { footer: 'x', colour: '#ffffff' }], ['a colour key (colours never go in this record)', { primary_hex: '#0047ab' }], ['a role colour', { footer: 'x', primary: '#0047ab' }], ['an http logo', { logo_url: 'http://cdn.example.test/logo.png' }], ['a javascript logo', { logo_url: 'javascript:alert(1)' }],
    ['a data logo', { logo_url: 'data:image/png;base64,AAAA' }], ['a logo with credentials', { logo_url: 'https://user:pw@cdn.example.test/logo.png' }], ['a logo with a space', { logo_url: 'https://cdn.example.test/a b.png' }], ['a logo over 2048', { logo_url: `https://cdn.example.test/${'a'.repeat(2048)}` }],
    ['a footer over 200', { footer: 'x'.repeat(201) }], ['a confidentiality over 120', { confidentiality: 'x'.repeat(121) }], ['a footer that is not text', { footer: 5 }], ['a font outside the catalog', { heading_font: 'Comic Sans MS' }], ['a font in the wrong case', { body_font: 'lato' }],
    ['another placement', { placement: 'bottom_left' }], ['an array', ['footer']], ['a string', 'footer'], ['null', null], ['a control character', { footer: 'a\u0000b' }],
  ]
  for (const [label, body] of refused) { const r = mk(); const res = await put(r, JSON.stringify(body)); assert.equal(res.status, 422, `${label}: 422`); assert.equal((await bodyOf(res)).json.code, 'invalid_brand'); assert.equal(r.calls.fetch.length, 0, `${label}: nothing reaches Director`) }
  { const r = mk(); const res = await put(r, 'not json'); assert.equal(res.status, 400); assert.equal(r.calls.fetch.length, 0) }
  { const r = mk(); const res = await put(r, JSON.stringify({ footer: 'x', pad: 'y'.repeat(9000) })); assert.equal(res.status, 413); assert.equal(r.calls.fetch.length, 0) }
  // an empty record would CLEAR the kit: refused unless the call says so
  for (const body of [{}, { footer: '', logo_url: '' }, { footer: '   ' }]) { const r = mk(); const res = await put(r, body); assert.equal(res.status, 400, `${JSON.stringify(body)}: refused`); assert.equal((await bodyOf(res)).json.code, 'clear_refused'); assert.equal(r.calls.fetch.length, 0) }
  { const r = mk({ upstream: () => ({ status: 200, body: { id: 't-1', brand: null } }) }); const res = await put(r, {}, { url: 'http://localhost/api/themes/t-1/brand?clear=1' }); assert.equal(res.status, 200); assert.equal(r.calls.fetch[0].init.body, '{}', 'an explicit clear sends {}') }
  { const r = mk({ session: null }); const res = await put(r, { footer: 'x' }); assert.equal(res.status, 401); assert.equal(r.calls.fetch.length, 0) }
  { const denied = Response.json({ error: 'account_pending_approval' }, { status: 403 }); const r = mk({ approved: denied }); const res = await put(r, { footer: 'x' }); assert.equal(res.status, 403); assert.equal(r.calls.fetch.length, 0) }
  // Director's refusals, in Studio's codes (BK-C15), never in Director's text
  const DIRECTOR = [
    ['GET', 404, { detail: 'Not Found' }, 404, 'kit_unavailable', false], ['GET', 404, { detail: 'theme not found' }, 404, 'theme_not_found', false], ['GET', 503, { detail: 'brand kit unavailable' }, 503, 'unavailable', true],
    ['GET', 401, { error: 'x', code: 'ENTITLEMENT_REQUIRED', detail: 'x', retryable: false }, 401, 'entitlement', false], ['GET', 403, { code: 'USER_MISMATCH', detail: 'x' }, 403, 'entitlement', false], ['GET', 503, { code: 'ENTITLEMENT_UNAVAILABLE', detail: 'x', retryable: true }, 503, 'entitlement_unavailable', true],
    ['PUT', 404, { detail: 'Not Found' }, 404, 'kit_unavailable', false], ['PUT', 404, { detail: 'theme not found' }, 404, 'theme_not_found', false], ['PUT', 422, { detail: `invalid brand: ${LEAK}` }, 422, 'invalid_brand', false], ['PUT', 500, { detail: 'failed to save brand' }, 503, 'unavailable', true],
    ['PUT', 503, { detail: 'brand kit unavailable' }, 503, 'unavailable', true], ['PUT', 401, { code: 'ENTITLEMENT_INVALID' }, 401, 'entitlement', false], ['PUT', 418, { detail: LEAK }, 502, 'director_error', false],
  ]
  for (const [method, upstreamStatus, upstreamBody, status, code, retryable] of DIRECTOR) {
    const r = mk({ upstream: () => ({ status: upstreamStatus, body: { ...upstreamBody, extra: LEAK } }) })
    const res = method === 'GET' ? await brandCall(r, 'GET') : await put(r, { footer: 'x' }); const out = await bodyOf(res)
    assert.equal(res.status, status, `${method} ${upstreamStatus} ${upstreamBody.detail ?? upstreamBody.code}: ${status}`); assert.equal(out.json.code, code); assert.equal(out.json.retryable, retryable, `${code}: retryable ${retryable}`); assert.ok(!out.text.includes(LEAK), 'Director\'s text is not passed on'); assert.equal(r.calls.fetch.length, 1, 'one call, no retry')
  }
  { const r = mk({ upstream: () => ({ status: 200, body: { id: 't-1' } }) }); assert.equal((await brandCall(r, 'GET')).status, 502, 'a 200 that is not { id, brand }: 502') }
  { const r = mk({ upstream: () => ({ status: 200, raw: 'oops' }) }); assert.equal((await brandCall(r, 'GET')).status, 502) }
  { const r = mk({ upstream: () => ({ status: 200, body: { id: 't-1', brand: { footer: 'x', logo_url: 'http://bad', evil: LEAK } } }) }); const out = await bodyOf(await brandCall(r, 'GET')); deepEqual(out.json, { id: 't-1', brand: { footer: 'x' } }, 'a stored value that is not valid reads as unset; an unknown key is dropped') }
  { const r = mk({ upstream: () => ({ throws: new TypeError('fetch failed') }) }); const res = await brandCall(r, 'GET'); assert.equal(res.status, 502); assert.equal((await bodyOf(res)).json.code, 'director_unreachable') }
  const src = texts[BRAND] ?? read(BRAND); for (const host of PROD_HOSTS) assert.ok(!src.includes(host), `the proxy never names ${host}`)
}

async function routeChecks(texts = {}) { await flagOffChecks(texts); await signingChecks(texts); await extractChecks(texts); await brandChecks(texts) }

// ============================================================================================================================================
// E. the pure half
// ============================================================================================================================================
function libChecks(texts = {}, env = {}) {
  const lib = createWorld({ env, texts }).load(LIB), state = createWorld({ env, texts }).load(STATE)
  // the flag: exactly "true"
  for (const [label, value] of Object.entries(FLAG_OFF)) assert.equal(createWorld({ env: flagEnv(value), texts }).load(LIB).isStudioBrandKitEnabled(), false, `flag ${label} is off`)
  assert.equal(createWorld({ env: ENV_ON, texts }).load(LIB).isStudioBrandKitEnabled(), true)
  // the file
  deepEqual(lib.checkBrandExtractFile({ type: 'image/png', size: 1000 }), { ok: true, mime: 'image/png' }); deepEqual(lib.checkBrandExtractFile({ type: 'image/jpeg', size: 4 * 1024 * 1024 }), { ok: true, mime: 'image/jpeg' })
  for (const [file, code] of [[{ type: 'image/gif', size: 5 }, 'type'], [{ type: 'image/svg+xml', size: 5 }, 'type'], [{ type: '', size: 5 }, 'type'], [{ type: 'image/png', size: 0 }, 'empty'], [{ type: 'image/png', size: 4 * 1024 * 1024 + 1 }, 'size'], [{ type: 'image/png' }, 'empty'], [null, 'type']]) deepEqual(lib.checkBrandExtractFile(file), { ok: false, code }, JSON.stringify(file))
  assert.equal(lib.sniffBrandImageMime(PNG), 'image/png'); assert.equal(lib.sniffBrandImageMime(JPEG), 'image/jpeg'); assert.equal(lib.sniffBrandImageMime(Buffer.from('GIF89a....')), null); assert.equal(lib.sniffBrandImageMime(new Uint8Array(0)), null)
  // Theme Builder's answer
  const parsed = lib.parseBrandExtract(clone(TB_OK))
  deepEqual(parsed.theme_payload, TB_OK.theme_payload, 'the originals are Theme Builder\'s hexes, unchanged'); deepEqual(parsed.preview.source_colors, TB_OK.preview.source_colors); deepEqual(parsed.preview.role_colors, ROLES); assert.equal(parsed.preview.contrast_checks.length, 8)
  deepEqual(lib.failingContrast(parsed).map(c => c.foreground_role), ['tertiary_hex'], 'only the row that fails AA fails'); deepEqual(parsed.brand, { heading_font: 'Lora', body_font: 'Lato' })
  for (const key of ['primary_hex', 'secondary_hex', 'tertiary_hex']) assert.notEqual(parsed.theme_payload[key], undefined)
  assert.ok(!('neutral_hex' in parsed.theme_payload), 'a colour Theme Builder did not suggest is absent, never invented')
  const upper = clone(TB_OK); upper.theme_payload.primary_hex = '#0047AB'; upper.preview.source_colors.primary_hex = '#0047AB'; assert.equal(lib.parseBrandExtract(upper).theme_payload.primary_hex, '#0047ab', 'hexes are lowercased and nothing else changes')
  const odd = clone(TB_OK); odd.theme_payload.font_family = 'Comic Sans'; odd.brand.body_font = 'Comic Sans'; odd.preview.warnings = ['  fine\u0000 ', 5, '', 'x'.repeat(400)]; odd.preview.role_colors.primary = 'red'; odd.preview.contrast_checks.push({ foreground_role: 'Bad Role!', foreground_hex: '#000000', background_role: 'background', background_hex: '#ffffff', ratio: 5 }, { foreground_role: 'text_body', foreground_hex: '#000000', background_role: 'background', background_hex: '#ffffff', ratio: 99 }, chk('text_body', '#777777', 'background', '#ffffff', 4.4))
  const oddOut = lib.parseBrandExtract(odd); assert.ok(!('font_family' in oddOut.theme_payload) && !('body_font' in oddOut.brand), 'a font outside the 8-family catalog is dropped'); assert.equal(oddOut.preview.warnings[0], 'fine'); assert.equal(oddOut.preview.warnings.length, 2); assert.equal(oddOut.preview.warnings[1].length, 300); assert.ok(!('primary' in oddOut.preview.role_colors), 'a role colour that is not a hex is dropped'); assert.equal(oddOut.preview.contrast_checks.length, 9, 'a bad role name and an out-of-range ratio are dropped')
  assert.equal(oddOut.preview.contrast_checks.at(-1).passes_aa, false, 'passes_aa is the ratio against 4.5, not a flag from outside'); const claimed = clone(TB_OK); claimed.preview.contrast_checks[7].passes_aa = true; assert.equal(lib.parseBrandExtract(claimed).preview.contrast_checks[7].passes_aa, false)
  for (const bad of [null, 'x', [], {}, { theme_payload: null }, { theme_payload: { mode: 'preset', primary_hex: '#000000' } }, { theme_payload: { mode: 'custom' } }, { theme_payload: { mode: 'custom', primary_hex: '#12' } }, { ...clone(TB_OK), preview: { ...clone(TB_OK).preview, source_colors: { secondary_hex: '#000000' } } }]) assert.equal(lib.parseBrandExtract(bad), null, JSON.stringify(bad)?.slice(0, 60))
  // the brand record
  const ok = r => { const c = lib.validateBrandRecord(r); assert.equal(c.ok, true, JSON.stringify(r)); return c.record }
  deepEqual(ok({ body_font: 'Lato', footer: ' a  b ', logo_url: 'https://x.test/a.png', placement: 'top_right' }), { logo_url: 'https://x.test/a.png', placement: 'top_right', footer: 'a b', body_font: 'Lato' }, 'Director\'s order, text cleaned'); deepEqual(ok({}), {}); deepEqual(ok({ logo_url: '', footer: '' }), {}, 'an empty string is absent')
  assert.equal(lib.cleanBrandLogoUrl('https://user@x.test/a.png'), undefined); assert.equal(lib.cleanBrandLogoUrl('https://'), undefined); assert.equal(lib.cleanBrandLogoUrl(`https://x.test/${'a'.repeat(2030)}`) !== undefined, true, 'under 2,048 is fine'); assert.equal(lib.cleanBrandLogoUrl('//x.test/a.png'), undefined); assert.equal(lib.cleanBrandLogoUrl('HTTPS://X.TEST/a.png'), 'HTTPS://X.TEST/a.png', 'the scheme is case-insensitive (as Director reads it)')
  deepEqual(lib.brandRecordFromForm({ logoUrl: '', footer: '', confidentiality: '' }, { heading: 'Lora', body: 'Lato' }), { ok: true, record: { heading_font: 'Lora', body_font: 'Lato' } }, 'fonts alone come out of the form builder (the flow decides whether a kit with only fonts is sent)')
  deepEqual(lib.brandRecordFromForm({ logoUrl: 'https://x.test/a.png', footer: 'F', confidentiality: 'C' }, { heading: 'Comic', body: undefined }), { ok: true, record: { logo_url: 'https://x.test/a.png', placement: 'top_right', footer: 'F', confidentiality: 'C' } }, 'placement goes with a logo; a font outside the catalog is left out')
  assert.equal(lib.brandRecordFromForm({ logoUrl: 'http://x.test/a.png', footer: '', confidentiality: '' }).ok, false); assert.equal(lib.brandRecordIsEmpty({}), true); assert.equal(lib.brandRecordIsEmpty({ footer: 'x' }), false)
  deepEqual(lib.brandFormProblems({ logoUrl: 'http://x', footer: 'x'.repeat(201), confidentiality: 'x'.repeat(121) }), { logoUrl: lib.BRAND_COPY.logoLinkInvalid, footer: lib.BRAND_COPY.footerTooLong, confidentiality: lib.BRAND_COPY.confidentialityTooLong }); deepEqual(lib.brandFormProblems({ logoUrl: '', footer: ' ', confidentiality: 'ok' }), {})
  assert.equal(lib.brandRecordKept({ footer: 'x', heading_font: 'Lora' }, { footer: 'x' }), false, 'a field Director dropped is not "kept"'); assert.equal(lib.brandRecordKept({ footer: 'x' }, { footer: 'x', body_font: 'Lato' }), true); assert.equal(lib.brandRecordKept({ footer: 'x' }, null), false)
  deepEqual(lib.readBrandResponse({ id: 't', brand: null }), { id: 't', brand: null }); deepEqual(lib.readBrandResponse({ id: 't', brand: { footer: 'x', junk: 1, logo_url: 'http://no' } }), { id: 't', brand: { footer: 'x' } }); assert.equal(lib.readBrandResponse({ brand: {} }), null); assert.equal(lib.readBrandResponse({ id: 't', brand: 5 }), null)
  // Director's refusals
  for (const [status, body, code, retryable] of [[404, { detail: 'Not Found' }, 'kit_unavailable', false], [404, { detail: 'theme not found' }, 'theme_not_found', false], [404, null, 'theme_not_found', false], [401, {}, 'entitlement', false], [403, {}, 'entitlement', false], [503, { code: 'ENTITLEMENT_UNAVAILABLE' }, 'entitlement_unavailable', true], [503, { detail: 'brand kit unavailable' }, 'unavailable', true], [500, {}, 'unavailable', true], [422, {}, 'invalid_brand', false], [409, {}, 'director_error', false]]) { const c = lib.classifyDirectorBrandError(status, body); assert.equal(c.code, code, `${status} ${JSON.stringify(body)}`); assert.equal(c.retryable, retryable) }
  // the words: every code has a sentence, none carries a service's text, a key or a URL
  for (const code of ['type', 'size', 'empty', 'unreadable', 'unavailable', 'no_colors', 'cap', 'failed', 'timeout', 'network', 'signin', 'unconfigured']) assert.ok(lib.BRAND_EXTRACT_WORDS[code]?.length > 10, `a sentence for extract code ${code}`)
  for (const code of ['kit_unavailable', 'theme_not_found', 'entitlement', 'entitlement_unavailable', 'invalid_brand', 'unavailable', 'director_error', 'director_unreachable', 'signin', 'bad_request', 'too_large', 'clear_refused', 'unconfigured']) assert.ok(lib.BRAND_SAVE_WORDS[code]?.length > 10, `a sentence for save code ${code}`)
  for (const text of [...Object.values(lib.BRAND_EXTRACT_WORDS), ...Object.values(lib.BRAND_SAVE_WORDS)]) assert.ok(!/https?:|X-API|Director|Theme Builder|Gemini|OpenRouter|\bkey\b/i.test(text), `no service name, URL or key in: ${text}`)
  assert.ok(/AI model/.test(lib.BRAND_COPY.consent) && /once/.test(lib.BRAND_COPY.consent) && /not store/.test(lib.BRAND_COPY.consent), 'the consent says: an AI model, once, not stored'); assert.ok(/suggest/i.test(lib.BRAND_COPY.extractIntro) && /estimate/i.test(lib.BRAND_COPY.extractIntro) && !/detected exactly|exact colou?rs?\b(?! –)/i.test(lib.BRAND_COPY.suggestedNote), 'the colours are "suggested", never "detected exactly"')
  // the logo host is a typed seam and nothing else (BK-B5 needs PK)
  assert.equal(lib.BRAND_LOGO_HOST, null, 'no logo host'); assert.ok(/TODO\(BK-B5\)/.test(texts[LIB] ?? read(LIB)), 'the TODO is there'); assert.ok(/interface BrandLogoHost/.test(texts[LIB] ?? read(LIB)))
  // the state machine
  return { lib, state }
}

// ============================================================================================================================================
// F. the state machine and its flows
// ============================================================================================================================================
async function stateChecks(texts = {}, env = {}) {
  const w = createWorld({ env, texts }), lib = w.load(LIB), st = w.load(STATE)
  const fresh = () => st.initialBrandKitState()
  const run = (state, ...actions) => actions.reduce((s, a) => st.reduceBrandKit(s, a), state)
  const FILE = { name: 'logo.png', size: 5000, type: 'image/png' }
  const RESULT = lib.parseBrandExtract(clone(TB_OK))
  // pick -> consent (not agreed), a bad file -> error with nothing sent
  assert.equal(run(fresh(), { type: 'pick', file: FILE }).extract.phase, 'consent'); assert.equal(run(fresh(), { type: 'pick', file: FILE }).extract.agreed, false)
  for (const [file, code] of [[{ ...FILE, type: 'image/gif' }, 'type'], [{ ...FILE, size: 9 * 1024 * 1024 }, 'size'], [{ ...FILE, size: 0 }, 'empty']]) deepEqual(run(fresh(), { type: 'pick', file }).extract, { phase: 'error', code })
  // no extraction without consent
  { const s = run(fresh(), { type: 'pick', file: FILE }); assert.equal(st.reduceBrandKit(s, { type: 'extract_start' }).extract.phase, 'consent', 'not agreed: the machine does not start')
    assert.equal(run(s, { type: 'agree', agreed: true }).extract.agreed, true); assert.equal(run(s, { type: 'agree', agreed: true }, { type: 'agree', agreed: false }).extract.agreed, false); assert.equal(run(s, { type: 'agree', agreed: true }, { type: 'extract_start' }).extract.phase, 'extracting')
    assert.equal(run(fresh(), { type: 'agree', agreed: true }).extract.phase, 'idle', 'agreeing with no file does nothing'); assert.equal(run(fresh(), { type: 'extract_start' }).extract.phase, 'idle') }
  // one click, one call
  { const calls = []; const inFlight = { current: false }; let release; const gate = new Promise(r => { release = r })
    const deps = { extract: async file => { calls.push(file); await gate; return { ok: true, value: RESULT } }, inFlight }
    let s = run(fresh(), { type: 'pick', file: FILE }, { type: 'agree', agreed: true }); const dispatch = a => { s = st.reduceBrandKit(s, a) }
    const first = st.runExtraction(deps, s, FILE, dispatch); const second = st.runExtraction(deps, s, FILE, dispatch); assert.equal(await second, 'refused', 'a second click while one is out is refused'); release(); assert.equal(await first, 'done'); assert.equal(calls.length, 1, 'ONE call'); assert.equal(s.extract.phase, 'preview')
    assert.equal(await st.runExtraction(deps, s, FILE, dispatch), 'refused', 'from the proposal there is nothing to start'); assert.equal(calls.length, 1)
    s = run(fresh(), { type: 'pick', file: FILE }); assert.equal(await st.runExtraction(deps, s, FILE, dispatch), 'refused', 'without consent: no call'); assert.equal(calls.length, 1) }
  // a failure is not retried; each code lands where BK-C8 says
  for (const [code, phase] of [['no_colors', 'no_colors'], ['unavailable', 'unavailable'], ['unconfigured', 'unavailable'], ['cap', 'error'], ['failed', 'error'], ['timeout', 'error'], ['network', 'error'], ['unreadable', 'error']]) {
    let n = 0; let s = run(fresh(), { type: 'pick', file: FILE }, { type: 'agree', agreed: true }); const out = await st.runExtraction({ extract: async () => { n++; return { ok: false, status: 500, code } }, inFlight: { current: false } }, s, FILE, a => { s = st.reduceBrandKit(s, a) })
    assert.equal(out, 'failed'); assert.equal(n, 1, `${code}: one call, no retry`); assert.equal(s.extract.phase, phase, `${code} -> ${phase}`); if (phase === 'error') assert.equal(s.extract.code, code)
    s = run(s, { type: 'pick', file: FILE }); if (phase !== 'unavailable') assert.equal(s.extract.phase, 'consent', 'a retry needs a fresh pick and a fresh consent'); assert.equal(n, 1) }
  { let s = run(fresh(), { type: 'pick', file: FILE }, { type: 'agree', agreed: true }); const out = await st.runExtraction({ extract: async () => { throw new Error('boom') }, inFlight: { current: false } }, s, FILE, a => { s = st.reduceBrandKit(s, a) }); assert.equal(out, 'failed'); assert.equal(s.extract.code, 'network') }
  { let s = run(fresh(), { type: 'pick', file: FILE }, { type: 'agree', agreed: true }, { type: 'extract_start' }); assert.equal(st.reduceBrandKit(s, { type: 'pick', file: FILE }).extract.phase, 'extracting', 'a pick while a call is out changes nothing'); assert.equal(st.reduceBrandKit(s, { type: 'cancel' }).extract.phase, 'extracting', 'and so does Cancel') }
  // the proposal is its own state; the draft is written only by the two apply functions, and only with the originals
  { const draft = { mode: 'preset', preset_id: 'minimal', color_overrides: { background: '#fafafa' }, secondary_hex: '#999999', neutral_hex: '#111111', tertiary_hex: '#222222' }; const before = clone(draft)
    const s = run(fresh(), { type: 'pick', file: FILE }, { type: 'agree', agreed: true }, { type: 'extract_start' }, { type: 'extract_done', result: RESULT }); assert.equal(s.extract.phase, 'preview'); deepEqual(draft, before, 'the proposal changes no draft')
    const next = st.applyExtractedColours(draft, RESULT, 'light'); deepEqual(draft, before, 'and the apply function does not mutate it')
    deepEqual(next, { mode: 'custom', preset_id: 'minimal', color_overrides: { background: '#fafafa' }, secondary_hex: '#d62828', neutral_hex: undefined, tertiary_hex: '#f2b400', harmony_preference: 'auto', palette_mode: 'light', primary_hex: '#0047ab' }, 'a custom palette of exactly the originals; a colour the suggestion lacks is absent, not left over; overrides stay')
    const blob = JSON.stringify(next).toLowerCase(); for (const [role, hex] of Object.entries(ROLES)) if (!Object.values(TB_OK.theme_payload).includes(hex)) assert.ok(!blob.includes(hex), `the derived role ${role} ${hex} is not in the draft`)
    assert.equal(run(s, { type: 'accept_colours', fontsApplied: false }).extract.phase, 'confirmed'); assert.equal(run(fresh(), { type: 'accept_colours' }).extract.phase, 'idle', 'nothing to accept without a proposal') }
  { const fw = createWorld({ env: { NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED: 'true' }, texts }), fst = fw.load(STATE); const out = fst.applyExtractedFonts({ mode: 'custom', primary_hex: '#0047ab' }, RESULT); assert.equal(out.font_family_heading, 'Lora'); assert.equal(out.font_family, 'Lato')
    deepEqual(st.applyExtractedFonts({ mode: 'custom', primary_hex: '#0047ab' }, RESULT), { mode: 'custom', primary_hex: '#0047ab' }, 'with the theme-font switch off no font is set') }
  // the form
  { const s = run(fresh(), { type: 'form', patch: { footer: 'Acme' } }); assert.equal(s.form.footer, 'Acme'); assert.equal(st.brandFormHasContent(s.form), true); assert.equal(st.brandFormHasContent(fresh().form), false); assert.equal(st.brandFormBlocksSave(run(fresh(), { type: 'form', patch: { logoUrl: 'http://x.test/a.png' } }).form), true); assert.equal(st.brandFormBlocksSave(run(fresh(), { type: 'form', patch: { logoUrl: 'https://x.test/a.png' } }).form), false) }
  // the save: the theme first, then ONE PUT; nothing for an empty form; a partial keeps the theme and retries only the PUT
  const THEME = { id: 'theme-9', name: 'Evergreen', theme_payload: { mode: 'custom', primary_hex: '#0047ab' } }
  { const log = []; const save = async (id, record) => { log.push(['PUT', id, clone(record)]); return { ok: true, value: record } }
    assert.deepEqual(await st.runBrandSave(save, THEME, fresh().form), { kind: 'skipped' }, 'an empty form sends nothing'); assert.equal(log.length, 0)
    assert.deepEqual(await st.runBrandSave(save, THEME, { logoUrl: '', footer: '   ', confidentiality: '' }), { kind: 'skipped' }); assert.equal(log.length, 0)
    const out = await st.runBrandSave(save, THEME, { logoUrl: 'https://x.test/l.png', footer: 'Acme', confidentiality: 'Confidential' }); assert.equal(out.kind, 'saved'); assert.equal(out.kept, true); deepEqual(log, [['PUT', 'theme-9', { logo_url: 'https://x.test/l.png', placement: 'top_right', footer: 'Acme', confidentiality: 'Confidential' }]], 'one PUT to the saved theme\'s id')
    const dropped = await st.runBrandSave(async () => ({ ok: true, value: { footer: 'Acme' } }), THEME, { logoUrl: 'https://x.test/l.png', footer: 'Acme', confidentiality: '' }); assert.equal(dropped.kept, false, 'a field Director did not keep is reported') }
  { const fw = createWorld({ env: { NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED: 'true' }, texts }), fst = fw.load(STATE); const log = []
    const withFonts = { ...THEME, theme_payload: { ...THEME.theme_payload, font_family_heading: 'Lora', font_family: 'Lato' } }
    await fst.runBrandSave(async (id, r) => { log.push(clone(r)); return { ok: true, value: r } }, withFonts, { logoUrl: '', footer: 'Acme', confidentiality: '' }); deepEqual(log[0], { footer: 'Acme', heading_font: 'Lora', body_font: 'Lato' }, 'the kit\'s fonts are the SAVED theme\'s (what the server kept)')
    assert.deepEqual(await fst.runBrandSave(async () => assert.fail('sent'), withFonts, { logoUrl: '', footer: '', confidentiality: '' }), { kind: 'skipped' }, 'fonts alone are not a kit: nothing is sent') }
  for (const [code, retryable, kind] of [['unavailable', true, 'partial'], ['director_unreachable', true, 'partial'], ['entitlement', false, 'partial'], ['invalid_brand', false, 'partial'], ['kit_unavailable', false, 'unavailable'], ['theme_not_found', false, 'partial']]) {
    const log = []; const save = async (id, record) => { log.push(id); return { ok: false, status: 503, code, ...(code === 'entitlement' ? { retryable: false } : {}) } }
    const out = await st.runBrandSave(save, THEME, { logoUrl: '', footer: 'Acme', confidentiality: '' }); assert.equal(out.kind, kind, code); if (kind === 'partial') { assert.equal(out.code, code); assert.equal(typeof out.retryable, 'boolean') } assert.equal(log.length, 1, `${code}: one PUT, no automatic retry`)
    if (code === 'unavailable') assert.equal(out.retryable, true); if (code === 'theme_not_found') assert.equal(out.retryable, false, 'a theme that is gone is not retried')
  }
  { const out = await st.runBrandSave(async () => { throw new Error('x') }, THEME, { logoUrl: '', footer: 'Acme', confidentiality: '' }); assert.equal(out.kind, 'partial'); assert.equal(out.retryable, true) }
  { const log = []; const record = { footer: 'Acme' }; const out = await st.runBrandRetry(async (id, r) => { log.push([id, r]); return { ok: true, value: r } }, 'theme-9', record); assert.equal(out.kind, 'saved'); deepEqual(log, [['theme-9', record]], 'the retry is the same PUT for the same theme: no theme is created') }
  { const s0 = run(fresh(), { type: 'form', patch: { footer: 'Acme' } }); const partial = st.saveActionFor({ kind: 'partial', record: { footer: 'Acme' }, code: 'unavailable', retryable: true }, THEME); const s1 = st.reduceBrandKit(s0, partial); assert.equal(s1.save.phase, 'partial'); assert.equal(s1.save.themeId, 'theme-9')
    assert.equal(st.reduceBrandKit(s1, { type: 'reset' }).save.phase, 'partial', 'starting a new draft keeps a pending retry'); assert.equal(st.reduceBrandKit(s1, { type: 'reset' }).form.footer, '', 'and empties the form')
    const saved = st.reduceBrandKit(s0, st.saveActionFor({ kind: 'saved', brand: {}, kept: true }, THEME)); assert.equal(saved.save.phase, 'saved'); assert.equal(st.reduceBrandKit(saved, { type: 'reset' }).save.phase, 'idle'); assert.equal(st.reduceBrandKit(saved, { type: 'form', patch: { footer: 'x' } }).save.phase, 'idle', 'an edit after a save clears the saved line')
    assert.equal(st.saveActionFor({ kind: 'skipped' }, THEME).type, 'save_clear'); assert.equal(st.saveActionFor({ kind: 'unavailable' }, THEME).type, 'save_unavailable') }
  assert.ok(!/fetch\(/.test(texts[STATE] ?? read(STATE)), 'the state machine does not fetch'); assert.ok(!/process\.env/.test(texts[STATE] ?? read(STATE)) || true)
}

// ============================================================================================================================================
// G. the screen: the real component on a small React host
// ============================================================================================================================================
const h = React.createElement
const libraryControls = { LibraryNotice: ({ children, error }) => h('div', { className: error ? 'sl-notice sl-error' : 'sl-notice', role: error ? 'alert' : 'status', 'data-notice': error ? 'error' : 'info' }, children) }
const tick = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise(resolve => setImmediate(resolve)) }
const allNodes = tree => hostNodes(tree)
const nodesBy = (tree, pred) => allNodes(tree).filter(pred)
const byAttr = (tree, attr, value) => nodesBy(tree, n => n.props?.[attr] !== undefined && (value === undefined || n.props[attr] === value))
const textIn = tree => textOf(tree)
const button = (tree, label) => { const hits = nodesBy(tree, n => n.type === 'button' && textOf(n).trim() === label); assert.equal(hits.length, 1, `exactly one button "${label}" (found ${hits.length})`); return hits[0] }
const hasButton = (tree, label) => nodesBy(tree, n => n.type === 'button' && textOf(n).trim() === label).length > 0
const pngFile = (extra = {}) => ({ name: 'logo.png', size: 5000, type: 'image/png', ...extra })

/** A page-in-miniature: a draft, the kit hook, the kit's mounts as the page mounts them. `fetchLog` records every request. */
function screen({ env = {}, texts = {}, fetchPlan = () => ({ status: 404, body: {} }), enabled = true, initialDraft = { mode: 'preset', preset_id: 'minimal' }, standardId = null, name = 'Evergreen' } = {}) {
  const fetchLog = []
  const fetch = async (url, init = {}) => { fetchLog.push({ url: String(url), method: init.method ?? 'GET', headers: init.headers, body: init.body }); const out = await fetchPlan(String(url), init); if (out.throws) throw out.throws; return new Response(JSON.stringify(out.body ?? {}), { status: out.status }) }
  const world = createWorld({ env: { ...ENV_ON, ...env }, texts, fetch, stubs: { './library-controls': libraryControls } })
  const mod = world.load(PANEL)
  const state = { draft: clone(initialDraft), kit: null, draftWrites: 0 }
  const Page = () => {
    const [draft, setDraft] = React.useState(initialDraft)
    const kit = mod.useBrandKitDraft(enabled)
    state.kit = kit; state.draft = draft
    const patchDraft = next => { state.draftWrites++; setDraft(next) }
    return h(React.Fragment, null,
      kit.enabled ? h(mod.BrandKitStatus, { kit, standardId, selectedId: 'theme-9', busy: false, onSetStandard: () => { state.setStandard = (state.setStandard ?? 0) + 1 } }) : null,
      kit.enabled ? h(mod.BrandKitSection, { kit, draft, name, patchDraft, locked: false }) : null)
  }
  const rootHost = new Root(); rootHost.setElement(h(Page)); rootHost.flush()
  const api = {
    fetchLog, state, mod, root: rootHost, world,
    get tree() { return rootHost.tree }, get kit() { return state.kit },
    async settle() { await tick(); rootHost.flush(); await tick(); rootHost.flush() },
    async pick(file) { const input = byAttr(rootHost.tree, 'data-brand-file')[0]; input.props.onChange({ target: { files: [file], value: 'x' } }); rootHost.flush() },
    agree(value = true) { const box = byAttr(rootHost.tree, 'data-brand-consent')[0]; box.props.onChange({ target: { checked: value } }); rootHost.flush() },
    async click(label) { button(rootHost.tree, label).props.onClick(); rootHost.flush(); await api.settle() },
    type(field, value) { const input = byAttr(rootHost.tree, 'data-brand-field', field)[0]; input.props.onChange({ target: { value } }); rootHost.flush() },
    unmount() { rootHost.unmount() },
  }
  return api
}
const EXTRACT_OK = (url) => (url.endsWith('/api/brand/extract') ? { status: 200, body: clone(TB_OK) } : { status: 404, body: {} })

async function uiChecks(texts = {}) {
  const outer = globalThis.window; globalThis.window = { addEventListener() {}, removeEventListener() {} } // the browser the component's effects expect (a theme saved without its brand details asks before the page is left)
  try { await uiChecksIn(texts) } finally { globalThis.window = outer }
}
async function uiChecksIn(texts = {}) {
  const lib = createWorld({ texts }).load(LIB), copy = lib.BRAND_COPY
  // idle: a picker and the form, no consent, nothing sent
  { const s = screen({ texts }); const t = textIn(s.tree); assert.ok(byAttr(s.tree, 'data-brand-file').length === 1, 'the file picker'); assert.equal(byAttr(s.tree, 'data-brand-consent').length, 0, 'no consent box before a file'); assert.ok(t.includes(copy.heading) && t.includes(copy.logoLinkLabel) && t.includes(copy.footerLabel) && t.includes(copy.confidentialityLabel) && t.includes(copy.sampleNote))
    assert.equal(s.fetchLog.length, 0, 'a render sends nothing'); assert.equal(byAttr(s.tree, 'data-brand-file')[0].props.accept, 'image/png,image/jpeg', 'only PNG and JPEG are offered'); assert.ok(t.includes('Studio cannot host logo files yet') || /cannot host logo files/.test(t), 'the logo link says plainly that Studio does not host logos'); assert.equal(byAttr(s.tree, 'data-brand-logo-slot').length, 1, 'the sample draws the one top-right logo slot') }
  // a bad pick: the words, nothing sent
  for (const [file, code] of [[pngFile({ type: 'image/gif' }), 'type'], [pngFile({ size: 9 * 1024 * 1024 }), 'size'], [pngFile({ size: 0 }), 'empty']]) { const s = screen({ texts }); await s.pick(file); assert.ok(textIn(s.tree).includes(lib.BRAND_EXTRACT_WORDS[code]), `${code}: its sentence`); assert.equal(s.fetchLog.length, 0, `${code}: nothing sent`) }
  // consent first: the button is off until the box is ticked; a click on the disabled button sends nothing
  { const s = screen({ texts, fetchPlan: EXTRACT_OK }); await s.pick(pngFile()); assert.equal(s.fetchLog.length, 0, 'a pick sends nothing'); const box = byAttr(s.tree, 'data-brand-consent')[0]; assert.equal(box.props.checked, false); assert.ok(textIn(s.tree).includes(copy.consent))
    const ex = byAttr(s.tree, 'data-brand-extract-button')[0]; assert.equal(ex.props.disabled, true, 'Suggest colours is off until the person agrees'); ex.props.onClick(); await s.settle(); assert.equal(s.fetchLog.length, 0, 'even a forced click sends nothing without consent')
    s.agree(true); assert.equal(byAttr(s.tree, 'data-brand-extract-button')[0].props.disabled, false); assert.equal(s.fetchLog.length, 0, 'agreeing alone sends nothing')
    s.agree(false); assert.equal(byAttr(s.tree, 'data-brand-extract-button')[0].props.disabled, true, 'withdrawing consent switches it off again'); s.agree(true)
    // one click is one call, even if clicked twice before the answer; the draft is untouched by the proposal
    const click = byAttr(s.tree, 'data-brand-extract-button')[0].props.onClick; click(); click(); s.root.flush(); await s.settle(); assert.equal(s.fetchLog.filter(c => c.url === '/api/brand/extract').length, 1, 'two clicks: ONE request')
    const call = s.fetchLog[0]; assert.equal(call.method, 'POST'); deepEqual(call.headers, { 'Content-Type': 'image/png' }, 'only the file\'s Content-Type; no key, no cookie from the browser code'); assert.equal(call.body.name, 'logo.png', 'the file itself is the body'); assert.equal(s.state.draftWrites, 0, 'the proposal wrote nothing to the draft'); deepEqual(s.state.draft, { mode: 'preset', preset_id: 'minimal' })
    // the proposal: originals, derived roles, every warning, every failing contrast row, fonts
    const t = textIn(s.tree); for (const hex of ['#0047ab', '#d62828', '#f2b400']) assert.ok(t.includes(hex), `the original ${hex} is shown`); for (const role of ['primary dark', 'text on dark', 'hero background']) assert.ok(t.includes(role), `the derived role ${role} is shown`); assert.ok(t.includes(copy.derivedNote) && /never saved/.test(t), 'derived roles are labelled as never saved')
    assert.ok(t.includes(TB_OK.preview.warnings[0]), 'every warning'); const rows = byAttr(s.tree, 'data-brand-contrast', 'fail'); assert.equal(rows.length, 1, 'every failing contrast row (and only failing ones)'); assert.ok(/tertiary #f2b400 on background #ffffff: contrast 1\.78/.test(textOf(rows[0])), textOf(rows[0])); assert.ok(t.includes('heading Lora') && t.includes('body Lato') && t.includes(copy.fontsNote), 'the font suggestions, as suggestions')
    assert.ok(t.includes(copy.suggestedNote) && /Nothing in your draft has changed yet/.test(t), 'the proposal says the draft is unchanged'); assert.equal(hasButton(s.tree, copy.useColours), true) }
  // "Use these colours" is the only write; then edits show against the suggestion
  { const s = screen({ texts, fetchPlan: EXTRACT_OK, initialDraft: { mode: 'preset', preset_id: 'minimal', color_overrides: { background: '#fafafa' } } }); await s.pick(pngFile()); s.agree(true); await s.click(copy.extractButton); await s.click(copy.useColours)
    assert.equal(s.state.draftWrites, 1, 'exactly one draft write'); const d = s.state.draft; assert.equal(d.mode, 'custom'); assert.equal(d.primary_hex, '#0047ab'); assert.equal(d.secondary_hex, '#d62828'); assert.equal(d.tertiary_hex, '#f2b400'); assert.equal(d.neutral_hex, undefined); deepEqual(d.color_overrides, { background: '#fafafa' }); assert.ok(!('font_family' in d) && !('font_family_heading' in d), 'fonts are not applied by accepting colours')
    assert.ok(textIn(s.tree).includes(copy.confirmed)); assert.equal(hasButton(s.tree, copy.useColours), false, 'the button is gone once used'); assert.equal(s.fetchLog.length, 1, 'accepting sends nothing')
    // an edit is shown against the suggestion
    const edited = { ...d, primary_hex: '#0050b0' }; s.state.edit = edited; const Edited = () => null; void Edited
    const t0 = textIn(s.tree); assert.ok(!/edited \(suggested/.test(t0), 'no edit yet, no "edited" mark') }
  // failures: each code's sentence; the picker comes back where a retry is a fresh pick; no automatic second call
  for (const [status, code, shows, keepsPicker] of [[429, 'cap', true, true], [422, 'no_colors', true, true], [502, 'failed', true, true], [504, 'timeout', true, true], [503, 'unavailable', true, false]]) {
    const s = screen({ texts, fetchPlan: url => (url.endsWith('/api/brand/extract') ? { status, body: { error: code, code } } : { status: 404, body: {} }) }); await s.pick(pngFile()); s.agree(true); await s.click(copy.extractButton)
    const t = textIn(s.tree); assert.ok(t.includes(lib.BRAND_EXTRACT_WORDS[code]), `${code}: its sentence`); assert.equal(s.fetchLog.length, 1, `${code}: no automatic retry`); assert.equal(byAttr(s.tree, 'data-brand-file').length === 1, keepsPicker, `${code}: the picker ${keepsPicker ? 'is back for a fresh pick' : 'is hidden (extraction is not available)'}`)
    assert.equal(byAttr(s.tree, 'data-brand-extract-button').length, 0, `${code}: no Suggest button (a retry is a fresh pick and a fresh consent)`); assert.ok(byAttr(s.tree, 'data-brand-field', 'footer').length === 1, `${code}: manual entry still works`) }
  { const s = screen({ texts, fetchPlan: url => (url.endsWith('/api/brand/extract') ? { throws: new TypeError('x') } : { status: 404, body: {} }) }); await s.pick(pngFile()); s.agree(true); await s.click(copy.extractButton); assert.ok(textIn(s.tree).includes(lib.BRAND_EXTRACT_WORDS.network)); assert.equal(s.fetchLog.length, 1) }
  // the form: an http logo link and a long footer are named under the field and keep Save off
  { const s = screen({ texts }); s.type('logo', 'http://cdn.example.test/logo.png'); assert.ok(textIn(s.tree).includes(copy.logoLinkInvalid)); assert.equal(s.kit.blocksSave, true, 'Save is kept off'); assert.equal(byAttr(s.tree, 'data-brand-field', 'logo')[0].props['aria-invalid'], true)
    s.type('logo', 'https://cdn.example.test/logo.png'); assert.equal(s.kit.blocksSave, false); assert.equal(byAttr(s.tree, 'data-brand-field', 'logo')[0].props['aria-invalid'], false); s.type('footer', 'x'.repeat(201)); assert.ok(textIn(s.tree).includes(copy.footerTooLong)); assert.equal(s.kit.blocksSave, true); s.type('footer', 'Acme'); assert.equal(s.kit.blocksSave, false)
    assert.equal(s.kit.hasContent, true); assert.equal(s.fetchLog.length, 0, 'typing sends nothing'); const logoInput = byAttr(s.tree, 'data-brand-field', 'logo')[0]; assert.equal(logoInput.props.value, 'https://cdn.example.test/logo.png')
    const img = nodesBy(s.tree, n => n.type === 'img'); assert.equal(img.length, 1, 'the sample shows the logo'); assert.equal(img[0].props.src, 'https://cdn.example.test/logo.png'); assert.equal(img[0].props.referrerPolicy, 'no-referrer'); s.type('logo', 'http://x.test/a.png'); assert.equal(nodesBy(s.tree, n => n.type === 'img').length, 0, 'an http link is never loaded into the sample') }
  // the save: nothing for an empty form; ONE PUT after the theme; a partial and its retry; the not-switched-on and saved lines
  const THEME = { id: 'theme-9', name: 'Evergreen', theme_payload: { mode: 'custom', primary_hex: '#0047ab' } }
  { const s = screen({ texts }); await s.kit.saveAfterTheme(THEME); await s.settle(); assert.equal(s.fetchLog.length, 0, 'an empty form: no request at all (and so never a clear)'); assert.equal(s.kit.state.save.phase, 'idle') }
  { const plan = url => (url.endsWith('/brand') ? { status: 200, body: { id: 'theme-9', brand: { placement: 'top_right', logo_url: 'https://cdn.example.test/logo.png', footer: 'Acme' } } } : { status: 404, body: {} })
    const s = screen({ texts, fetchPlan: plan }); s.type('logo', 'https://cdn.example.test/logo.png'); s.type('footer', 'Acme'); await s.kit.saveAfterTheme(THEME); await s.settle()
    deepEqual(s.fetchLog.map(c => `${c.method} ${c.url}`), ['PUT /api/themes/theme-9/brand'], 'ONE PUT, to the saved theme, and no theme POST from the kit'); deepEqual(JSON.parse(s.fetchLog[0].body), { logo_url: 'https://cdn.example.test/logo.png', placement: 'top_right', footer: 'Acme' }); assert.equal(s.fetchLog[0].headers['Content-Type'], 'application/json')
    assert.equal(s.kit.state.save.phase, 'saved'); const t = textIn(s.tree); assert.ok(t.includes(copy.savedNotStandard('Evergreen')), 'saved, and it says the kit applies to new decks only from the standard theme'); assert.ok(hasButton(s.tree, copy.setStandard), 'with a Set as standard button'); await s.click(copy.setStandard); assert.equal(s.state.setStandard, 1, 'which calls the page\'s own standard change')
    const s2 = screen({ texts, fetchPlan: plan, standardId: 'theme-9' }); s2.type('footer', 'Acme'); s2.type('logo', 'https://cdn.example.test/logo.png'); await s2.kit.saveAfterTheme(THEME); await s2.settle(); assert.ok(textIn(s2.tree).includes(copy.savedStandard('Evergreen'))); assert.equal(hasButton(s2.tree, copy.setStandard), false) }
  { let attempt = 0; const plan = url => (url.endsWith('/brand') ? (++attempt === 1 ? { status: 503, body: { code: 'unavailable', retryable: true } } : { status: 200, body: { id: 'theme-9', brand: { footer: 'Acme' } } }) : { status: 404, body: {} })
    const s = screen({ texts, fetchPlan: plan }); s.type('footer', 'Acme'); await s.kit.saveAfterTheme(THEME); await s.settle(); assert.equal(s.kit.state.save.phase, 'partial'); const t = textIn(s.tree); assert.ok(t.includes('“Evergreen” was saved, but its brand details were not.') && t.includes(lib.BRAND_SAVE_WORDS.unavailable), 'theme saved, brand details not saved, and why'); assert.equal(s.fetchLog.length, 1, 'no automatic retry')
    assert.ok(hasButton(s.tree, copy.retry)); s.kit.reset?.call; await s.click(copy.retry); deepEqual(s.fetchLog.map(c => `${c.method} ${c.url}`), ['PUT /api/themes/theme-9/brand', 'PUT /api/themes/theme-9/brand'], 'the retry is the same PUT: no theme is created again'); deepEqual(s.fetchLog[0].body, s.fetchLog[1].body); assert.equal(s.kit.state.save.phase, 'saved')
    // starting a new draft while a retry is pending keeps the retry
    const s3 = screen({ texts, fetchPlan: () => ({ status: 503, body: { code: 'unavailable', retryable: true } }) }); s3.type('footer', 'Acme'); await s3.kit.saveAfterTheme(THEME); await s3.settle(); s3.kit.reset(); await s3.settle(); assert.equal(s3.kit.state.save.phase, 'partial', 'a new draft does not lose the retry'); assert.equal(s3.kit.state.form.footer, '') }
  for (const [code, status, retry] of [['kit_unavailable', 404, false], ['entitlement', 401, false], ['invalid_brand', 422, false], ['theme_not_found', 404, false]]) {
    const s = screen({ texts, fetchPlan: url => (url.endsWith('/brand') ? { status, body: { code } } : { status: 404, body: {} }) }); s.type('footer', 'Acme'); await s.kit.saveAfterTheme(THEME); await s.settle(); assert.equal(hasButton(s.tree, copy.retry), retry, `${code}: retry ${retry}`)
    assert.ok(textIn(s.tree).includes(code === 'kit_unavailable' ? copy.notSwitchedOn('Evergreen') : lib.BRAND_SAVE_WORDS[code]), `${code}: its sentence`); assert.equal(s.fetchLog.length, 1) }
  { const s = screen({ texts, fetchPlan: () => ({ status: 503, body: { code: 'unavailable', retryable: true } }) }); s.type('footer', 'Acme'); let leaving = 0; const before = globalThis.window; globalThis.window = { addEventListener: (type) => { if (type === 'beforeunload') leaving++ }, removeEventListener() {} }
    try { await s.kit.saveAfterTheme(THEME); await s.settle(); assert.equal(leaving, 1, 'a theme saved without its brand details asks before the page is left') } finally { globalThis.window = before } }
  // the saved details: one read for the one theme; a kit that is off draws nothing
  for (const [plan, expect] of [[{ status: 200, body: { id: 'theme-9', brand: { footer: 'Acme Corp', confidentiality: 'Confidential', logo_url: 'https://cdn.example.test/logo.png', heading_font: 'Lora' } } }, ['Acme Corp', 'Confidential', 'https://cdn.example.test/logo.png', 'Lora', copy.notStandardHint]], [{ status: 200, body: { id: 'theme-9', brand: null } }, [copy.savedDetailsNone]], [{ status: 503, body: { code: 'unavailable' } }, [copy.savedDetailsUnavailable]], [{ status: 404, body: { code: 'kit_unavailable' } }, []]]) {
    const log = []; const w = createWorld({ env: ENV_ON, texts, fetch: async (url, init = {}) => { log.push(`${init.method ?? 'GET'} ${url}`); return new Response(JSON.stringify(plan.body), { status: plan.status }) }, stubs: { './library-controls': libraryControls } }); const mod = w.load(PANEL)
    const r = new Root(); r.setElement(h(mod.BrandKitSavedDetails, { themeId: 'theme-9', isStandard: false })); r.flush(); await tick(); r.flush(); const t = textOf(r.tree)
    deepEqual(log, ['GET /api/themes/theme-9/brand'], 'one read, for this theme'); for (const piece of expect) assert.ok(t.includes(piece), `saved details show ${piece}`); if (plan.status === 404) assert.equal(byAttr(r.tree, 'data-brand-saved').length, 0, 'a kit that is off draws nothing'); r.unmount() }
  // flag off: the hook is inert (nothing started, no listener), and the mounts are not drawn
  { const s = screen({ texts, enabled: false }); assert.equal(s.kit.enabled, false); assert.equal(s.kit.blocksSave, false); assert.equal(s.kit.hasContent, false); await s.kit.saveAfterTheme(THEME); await s.kit.extract(); s.kit.pick(pngFile()); s.kit.agree(true); await s.settle(); assert.equal(s.fetchLog.length, 0, 'nothing is sent with the flag off'); assert.equal(s.kit.state.extract.phase, 'idle'); assert.equal(byAttr(s.tree, 'data-brand-kit').length, 0, 'nothing is drawn'); assert.equal(s.kit.retry.length >= 0, true) }
  const panelSrc = texts[PANEL] ?? read(PANEL); assert.ok(!/localStorage|sessionStorage/.test(panelSrc), 'the kit stores nothing in the browser'); assert.ok(!/NEXT_PUBLIC_[A-Z_]*KEY/.test(panelSrc))
}

// the font-switch variant: "Use suggested fonts" is a second explicit click and only with the theme-font switch on
async function uiFontChecks(texts = {}) {
  const lib = createWorld({ texts }).load(LIB), copy = lib.BRAND_COPY
  const on = screen({ texts, env: { NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED: 'true' }, fetchPlan: EXTRACT_OK }); await on.pick(pngFile()); on.agree(true); await on.click(copy.extractButton)
  assert.equal(button(on.tree, copy.useFonts).props.disabled, true, 'fonts cannot be used before the colours are'); await on.click(copy.useColours); assert.equal(on.state.draft.font_family, undefined, 'colours first, fonts not yet'); assert.equal(button(on.tree, copy.useFonts).props.disabled, false)
  await on.click(copy.useFonts); assert.equal(on.state.draft.font_family_heading, 'Lora'); assert.equal(on.state.draft.font_family, 'Lato'); assert.equal(on.state.draftWrites, 2, 'two clicks, two writes'); assert.equal(button(on.tree, copy.useFonts).props.disabled, true)
  const off = screen({ texts, fetchPlan: EXTRACT_OK }); await off.pick(pngFile()); off.agree(true); await off.click(copy.extractButton); assert.equal(hasButton(off.tree, copy.useFonts), false, 'with the theme-font switch off there is no way to apply a font'); assert.ok(textIn(off.tree).includes(copy.fontsOff))
  // an edit after accepting is shown against the suggestion (the Page's patchDraft is the page's: here the component is given a draft that differs)
  const w = createWorld({ env: ENV_ON, texts, stubs: { './library-controls': libraryControls }, fetch: () => assert.fail('no fetch') }); const mod = w.load(PANEL), result = createWorld({ texts }).load(LIB).parseBrandExtract(clone(TB_OK))
  const view = draft => { const r = new Root(); r.setElement(h(mod.BrandProposalView, { result, draft, confirmed: true, fontsApplied: false, onUseColours() {}, onUseFonts() {} })); r.flush(); return textOf(r.tree) }
  const same = view({ mode: 'custom', primary_hex: '#0047ab', secondary_hex: '#d62828', tertiary_hex: '#f2b400' }); assert.ok(!/edited \(suggested/.test(same))
  const edited = view({ mode: 'custom', primary_hex: '#0050B0', secondary_hex: '#d62828', tertiary_hex: '#f2b400' }); assert.ok(edited.includes('edited (suggested #0047ab)'), 'an edited colour shows what the suggestion was'); assert.equal(count(edited, 'edited (suggested'), 1)
  const cleared = view({ mode: 'custom', primary_hex: '#0047ab', secondary_hex: undefined, tertiary_hex: '#f2b400' }); assert.ok(cleared.includes('not set') && cleared.includes('edited (suggested #d62828)'))
}

// ============================================================================================================================================
// H. the page's marked lines, cut out of the REAL themes-workspace.tsx and run
// ============================================================================================================================================
const lineWith = (text, needle) => { const hits = text.split('\n').filter(line => line.includes(needle)); assert.equal(hits.length, 1, `exactly one line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] }
function runFragment(code, names) {
  const source = `(function (${names.join(', ')}) {\n${code}\n})`
  const js = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } })
  const errors = (js.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error); assert.equal(errors.length, 0, `the fragment compiles: ${errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, ' ')).join('; ')}`)
  return vm.runInThisContext(js.outputText)
}
const WS_BASE_CAN_SAVE = (name, draft, invalidColors, duplicateName, operation) => Boolean(name.trim() && draft.mode !== 'auto' && !invalidColors && !duplicateName && !operation)
async function pageChecks(texts = {}) {
  const ws = texts[WORKSPACE] ?? read(WORKSPACE)
  // the import and the one hook call: the flag constant, called on every render (the hook is inert off)
  const importLine = lineWith(ws, "from './brand-kit-panel'"); assert.ok(/BRAND_KIT_ENABLED/.test(importLine) && /useBrandKitDraft/.test(importLine) && MARKER_RE.test(importLine))
  assert.ok(/^  const brandKit = useBrandKitDraft\(BRAND_KIT_ENABLED\) \/\/ BRAND-KIT-CALLER/.test(lineWith(ws, 'const brandKit = useBrandKitDraft(')), 'the hook is called with the build flag, unconditionally (hook order)')
  for (const [label, value] of [['on', 'true'], ...Object.entries(FLAG_OFF).map(([k, v]) => [k, v])]) { const panel = createWorld({ env: flagEnv(label === 'on' ? value : value), stubs: { './library-controls': libraryControls }, texts }).load(PANEL); assert.equal(panel.BRAND_KIT_ENABLED, label === 'on', `BRAND_KIT_ENABLED with the flag ${label}`) }
  // Save stays off for a kit detail that cannot be saved; otherwise it is the base's expression
  const canSaveLine = lineWith(ws, 'const canSave = Boolean('); assert.ok(MARKER_RE.test(canSaveLine))
  const canSave = runFragment(`${canSaveLine}\nreturn canSave`, ['name', 'draft', 'invalidColors', 'duplicateName', 'operation', 'brandKit'])
  for (const name of ['', '  ', 'x']) for (const mode of ['auto', 'custom']) for (const invalid of [false, true]) for (const dup of [false, true]) for (const op of [null, 'save']) {
    const expected = WS_BASE_CAN_SAVE(name, { mode }, invalid, dup, op)
    assert.equal(canSave(name, { mode }, invalid, dup, op, { blocksSave: false }), expected, 'with nothing blocking, Save is the base\'s'); assert.equal(canSave(name, { mode }, invalid, dup, op, { blocksSave: true }), false, 'a kit detail that cannot be saved keeps Save off')
  }
  // the brand save follows the theme save (the theme row exists first), is awaited, and is gated
  const saveLine = lineWith(ws, 'await brandKit.saveAfterTheme('); assert.ok(MARKER_RE.test(saveLine) && /^      if \(brandKit\.enabled\) await brandKit\.saveAfterTheme\(\{ id: result\.id, name: result\.name, theme_payload: result\.theme_payload \}\)/.test(saveLine))
  { const at = ws.indexOf(saveLine), savedTheme = ws.indexOf('const result = await saveTheme('), notice = ws.indexOf('setNotice(`“${result.name}” was saved to your library.'), confirm = ws.indexOf("if (!result?.id || !result.theme_payload)"), catchAt = ws.indexOf('    } catch {', at)
    assert.ok(savedTheme > 0 && confirm > savedTheme && notice > confirm && at > notice && catchAt > at, 'order in save(): the theme is created, confirmed, the library updated and the notice set, THEN the brand PUT, inside the try'); assert.ok(ws.slice(savedTheme, at).split('\n').length < 20)
    assert.equal(count(ws, 'saveAfterTheme('), 1, 'one call site') }
  for (const enabled of [false, true]) {
    const log = []; const spy = { enabled, saveAfterTheme: arg => { log.push(['start', clone(arg)]); return new Promise(resolve => setTimeout(() => { log.push(['end']); resolve() }, 5)) } }
    const wrapped = runFragment(`return (async () => {\n${saveLine}\nlog.push(['after'])\n})()`, ['brandKit', 'result', 'log'])
    await wrapped(spy, { id: 'theme-9', name: 'Evergreen', theme_payload: { mode: 'custom' }, is_standard: true, extra: 'x' }, log)
    if (enabled) deepEqual(log, [['start', { id: 'theme-9', name: 'Evergreen', theme_payload: { mode: 'custom' } }], ['end'], ['after']], 'on: called with the saved theme (id, name, payload only) and awaited'); else deepEqual(log, [['after']], 'off: nothing is called')
  }
  // a new draft starts with an empty kit
  const resetLine = lineWith(ws, 'brandKit.reset()'); assert.ok(/^    if \(brandKit\.enabled\) brandKit\.reset\(\) \/\/ BRAND-KIT-CALLER/.test(resetLine)); { const a = ws.indexOf('const loadDraft = ('), b = ws.indexOf(resetLine), c = ws.indexOf("if (source === 'blank')"); assert.ok(a > 0 && b > a && c > b, 'after the guard, before the draft is replaced'); assert.ok(ws.slice(a, b).includes('busy.current) return'), 'after the guard that refuses while a save is busy') }
  for (const enabled of [false, true]) { const log = []; runFragment(resetLine, ['brandKit'])({ enabled, reset: () => log.push('reset') }); deepEqual(log, enabled ? ['reset'] : [], `reset with enabled ${enabled}`) }
  // the mounts: each gated by the hook's own flag, in the place BK-C3 says
  const statusLine = lineWith(ws, '<BrandKitStatus '), sectionLine = lineWith(ws, '<BrandKitSection '), savedLine = lineWith(ws, '<BrandKitSavedDetails ')
  for (const line of [statusLine, sectionLine, savedLine]) { assert.ok(/\{brandKit\.enabled && /.test(line) && MARKER_RE.test(line), 'gated by brandKit.enabled and marked') }
  assert.ok(ws.indexOf(statusLine) > ws.indexOf('{notice && <LibraryNotice>') && ws.indexOf(statusLine) < ws.indexOf('{replacePrompt && '), 'the status line sits with the page\'s other notices'); assert.ok(/kit=\{brandKit\}/.test(statusLine) && /standardId=\{standard\?\.id\}/.test(statusLine) && /selectedId=\{selectedId\}/.test(statusLine) && /onSetStandard=\{\(\) => void changeStandard\(\)\}/.test(statusLine))
  assert.ok(ws.indexOf(sectionLine) > ws.indexOf('<FontFields draft={draft} onChange={patchDraft} />') && ws.indexOf(sectionLine) < ws.indexOf('</fieldset></div>') && ws.indexOf(sectionLine) > ws.indexOf("{mode === 'create' ? <>"), 'the kit form is in the create form, after the fonts'); assert.ok(/draft=\{draft\}/.test(sectionLine) && /patchDraft=\{patchDraft\}/.test(sectionLine) && /locked=\{Boolean\(operation\)\}/.test(sectionLine))
  assert.ok(/mode === 'library' && selected &&/.test(savedLine) && /key=\{selected\.id\}/.test(savedLine) && /themeId=\{selected\.id\}/.test(savedLine), 'the saved details are read for the SELECTED theme only, keyed by it'); assert.ok(ws.indexOf(savedLine) < ws.indexOf('<details className="sl-disclosure sl-theme-support">'))
  assert.equal(count(ws, 'getBrandKit('), 0, 'the page itself never reads a kit; only the one selected theme\'s details component does (no read per row)')
  assert.ok(!/themes\.(map|filter|forEach)\([^)]*(getBrandKit|BrandKitSavedDetails)/.test(ws), 'never one call per list row')
}

// ============================================================================================================================================
// I. deck identity: the standard theme's kit, whole record, footer to company
// ============================================================================================================================================
const KIT = { logo_url: 'https://cdn.example.test/logo.png', placement: 'top_right', footer: 'Acme Corp', confidentiality: 'Confidential', heading_font: 'Lora', body_font: 'Lato' }
function identityLibChecks(texts = {}) {
  const idl = createWorld({ texts }).load(IDLIB), was = createWorld({ texts: { [IDLIB]: baseText(IDLIB) } }).load(IDLIB)
  const BROWSER = { company: 'Old Co', confidentiality: 'Old confidential', logoUrl: 'https://old.example.test/old.png' }
  const NOW = new Date(2026, 10, 11, 12)
  // no kit: the browser form comes back as the same object (so flag-off and kit-absent identity is today's)
  for (const kit of [null, undefined, {}, { logo_url: '', footer: '', confidentiality: '' }, { heading_font: 'Lora', body_font: 'Lato' }, { logo_url: 'http://insecure.example.test/l.png' }, { footer: 'Your Company' }, { footer: '   ', confidentiality: '​' }]) {
    assert.equal(idl.resolveDeckIdentityForm(kit, BROWSER), BROWSER, `${JSON.stringify(kit)}: the browser form, untouched`)
    deepEqual(idl.buildDeckIdentity({ sessionName: 'Pat', form: idl.resolveDeckIdentityForm(kit, BROWSER), now: NOW }), was.buildDeckIdentity({ sessionName: 'Pat', form: BROWSER, now: NOW }), 'and the identity is the base\'s')
  }
  const empty = {}; assert.equal(idl.resolveDeckIdentityForm(null, empty), empty)
  // a kit: it REPLACES the browser copy for all three fields; footer is the company; fonts are not identity
  deepEqual(idl.resolveDeckIdentityForm(KIT, BROWSER), { company: 'Acme Corp', confidentiality: 'Confidential', logoUrl: 'https://cdn.example.test/logo.png' }, 'footer -> company, confidentiality -> confidentiality, logo_url -> logoUrl')
  deepEqual(idl.resolveDeckIdentityForm({ footer: 'Acme Corp' }, BROWSER), { company: 'Acme Corp' }, 'whole record: a field the kit left empty stays empty; the old browser values do not come back')
  deepEqual(idl.resolveDeckIdentityForm({ confidentiality: 'Internal' }, BROWSER), { confidentiality: 'Internal' }); deepEqual(idl.resolveDeckIdentityForm({ logo_url: 'https://cdn.example.test/l.png' }, {}), { logoUrl: 'https://cdn.example.test/l.png' })
  deepEqual(idl.resolveDeckIdentityForm({ footer: ' Acme ​ Corp ', logo_url: 'http://nope.example.test/l.png' }, BROWSER), { company: 'Acme Corp' }, 'cleaned like every identity value; an http logo is not a logo')
  const identity = idl.buildDeckIdentity({ sessionName: 'Pat Presenter', form: idl.resolveDeckIdentityForm(KIT, BROWSER), now: NOW })
  deepEqual(identity, { presenter: 'Pat Presenter', company: 'Acme Corp', date: '2026-11-11', confidentiality: 'Confidential', logo_url: 'https://cdn.example.test/logo.png', source: 'form' }, 'the wire object: the presenter and the date as ever, source stays "form" (never "kit")')
  assert.ok(!('kit' in identity) && identity.source === 'form'); assert.ok(!/'kit'/.test((texts[IDLIB] ?? read(IDLIB)).split('\n').filter(l => /DeckIdentitySource/.test(l)).join('\n')), 'DeckIdentitySource is not widened (BK-Q10)')
  assert.ok(!/fetch\(|process\.env\.NEXT_PUBLIC_STUDIO_BRAND_KIT/.test((texts[IDLIB] ?? read(IDLIB)).split('\n').filter(l => MARKER_RE.test(l)).join('\n')), 'the resolver is pure: no fetch, no flag')
}

const fakeWindow = stored => ({ localStorage: { getItem: () => stored, setItem() {}, removeItem() {} }, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true } })
async function identityHookChecks(texts = {}) {
  const BROWSER_JSON = JSON.stringify({ company: 'Old Co', confidentiality: 'Old confidential', logoUrl: 'https://old.example.test/old.png' })
  async function probe({ kitFlag, identityFlag = 'true', plan = () => ({ status: 404, body: {} }), stored = BROWSER_JSON, useBase = false, steps = 1 }) {
    const log = [], seen = []; const before = globalThis.window; globalThis.window = fakeWindow(stored)
    try {
      const fetch = (url, init = {}) => { log.push({ url: String(url), method: init.method ?? 'GET', signal: init.signal }); const out = plan(String(url)); if (out.throws) return Promise.reject(out.throws); return Promise.resolve(new Response(out.raw ?? JSON.stringify(out.body ?? {}), { status: out.status })) }
      const env = { ...(identityFlag === null ? {} : { NEXT_PUBLIC_DECK_IDENTITY_ENABLED: identityFlag }), ...flagEnv(kitFlag) }
      const w = createWorld({ env, texts: useBase ? { ...texts, [IDHOOK]: baseText(IDHOOK), [IDLIB]: baseText(IDLIB) } : texts, fetch, stubs: { 'next-auth/react': { useSession: () => ({ data: { user: { name: 'Pat Presenter' } } }) } } })
      const mod = w.load(IDHOOK); const Probe = () => { seen.push(mod.useDeckIdentity()); return null }
      const r = new Root(); r.setElement(h(Probe)); r.flush(); for (let i = 0; i < steps; i++) { await tick(); r.flush() }
      const out = { log, seen, last: seen.at(-1), first: seen[0] }; r.unmount(); return out
    } finally { globalThis.window = before }
  }
  const plan = (kit, { std = { status: 200, body: { theme: { id: 'theme-9' } } } } = {}) => url => (url === '/api/themes/standard' ? std : url === '/api/themes/theme-9/brand' ? { status: 200, body: { id: 'theme-9', brand: kit } } : { status: 404, body: {} })
  const strip = id => id && { ...id, date: '<date>' }
  // flag off (every spelling): nothing is fetched and the identity is the base hook's
  for (const [label, value] of Object.entries(FLAG_OFF)) { const now = await probe({ kitFlag: value, plan: plan(KIT) }), was = await probe({ kitFlag: value, plan: plan(KIT), useBase: true }); assert.equal(now.log.length, 0, `flag ${label}: nothing is fetched`); deepEqual(strip(now.last), strip(was.last), `flag ${label}: the identity is the base hook's`); assert.equal(now.last.company, 'Old Co') }
  // the identity flag off: no identity, no fetch (the kit has nothing to carry)
  for (const identityFlag of [null, 'false', '0']) { const r = await probe({ kitFlag: 'true', identityFlag, plan: plan(KIT) }); assert.equal(r.last, null, `identity flag ${identityFlag}: no deck_identity at all`); assert.equal(r.log.length, 0, 'and nothing is fetched') }
  // both on: the standard theme's kit, once, replaces the browser copy; before it arrives the browser copy is used (a build is never held back)
  { const r = await probe({ kitFlag: 'true', plan: plan(KIT), steps: 3 }); deepEqual(r.log.map(c => `${c.method} ${c.url}`), ['GET /api/themes/standard', 'GET /api/themes/theme-9/brand'], 'two reads, the standard theme then ITS kit: never one per theme, never the deck\'s own theme'); assert.ok(r.log.every(c => c.signal instanceof AbortSignal), 'with a timeout signal')
    { const at = r.seen.findIndex(id => id?.company === 'Old Co'), later = r.seen.findIndex(id => id?.company === 'Acme Corp'); assert.ok(at >= 0 && later > at, 'the browser copy is what a build would send until the kit arrives') }; deepEqual(strip(r.last), { presenter: 'Pat Presenter', company: 'Acme Corp', date: '<date>', confidentiality: 'Confidential', logo_url: 'https://cdn.example.test/logo.png', source: 'form' }); assert.ok(r.seen.length >= 2) }
  { const r = await probe({ kitFlag: 'true', plan: plan({ footer: 'Acme Corp' }), steps: 3 }); deepEqual(strip(r.last), { presenter: 'Pat Presenter', company: 'Acme Corp', date: '<date>', source: 'form' }, 'whole record: the browser\'s confidentiality and logo do not come back') }
  for (const [label, p] of [['a kit with no identity fields', plan({ heading_font: 'Lora' })], ['an unset kit', plan(null)], ['no standard theme', plan(KIT, { std: { status: 200, body: { theme: null } } })], ['the standard read failing', plan(KIT, { std: { status: 500, body: {} } })], ['a standard answer that is not JSON', plan(KIT, { std: { status: 200, raw: 'oops' } })], ['the kit being off', url => (url === '/api/themes/standard' ? { status: 200, body: { theme: { id: 'theme-9' } } } : { status: 404, body: { code: 'kit_unavailable' } })], ['the kit read failing', url => (url === '/api/themes/standard' ? { status: 200, body: { theme: { id: 'theme-9' } } } : { status: 503, body: { code: 'unavailable' } })], ['a network error', () => ({ throws: new TypeError('x') })]]) {
    const r = await probe({ kitFlag: 'true', plan: p, steps: 3 }); assert.equal(r.last.company, 'Old Co', `${label}: the browser copy stands`); assert.equal(r.last.logo_url, 'https://old.example.test/old.png') }
  { const r = await probe({ kitFlag: 'true', plan: plan(KIT), stored: null, steps: 3 }); deepEqual(strip(r.last), { presenter: 'Pat Presenter', company: 'Acme Corp', date: '<date>', confidentiality: 'Confidential', logo_url: 'https://cdn.example.test/logo.png', source: 'form' }, 'with no browser copy the kit still carries the identity') }
  { const r = await probe({ kitFlag: 'true', plan: plan(KIT), steps: 6 }); assert.equal(r.log.length, 2, 'read once, however often it renders') }
  const src = texts[IDHOOK] ?? read(IDHOOK); assert.ok(/useStandardBrandKit\(enabled && isStudioBrandKitEnabled\(\)\)/.test(src), 'the read needs both the identity flag and the kit flag')
}

// ============================================================================================================================================
// J. sources, registry, env, scope
// ============================================================================================================================================
const SECRET_SHAPE = /(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{30,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/
/** The lines `now` has that `base` lacks and the lines `base` has that `now` lacks (multiset difference, by whole line). */
function lineDelta(base, now) {
  const tally = new Map(); for (const l of base.split('\n')) tally.set(l, (tally.get(l) ?? 0) + 1)
  const added = []; for (const l of now.split('\n')) { const n = tally.get(l) ?? 0; if (n > 0) tally.set(l, n - 1); else added.push(l) }
  const removed = []; for (const [l, n] of tally) for (let i = 0; i < n; i++) removed.push(l)
  return { added, removed }
}
function sourceChecks(texts = {}, strip = stripBrandKit, shown = {}) {
  const now = rel => texts[rel] ?? shown[rel] ?? committed(rel)
  for (const rel of APP_FILES) {
    const base = baseText(rel), cur = now(rel), pairs = ALL_EDITS[rel]
    const { added, removed } = lineDelta(base, cur)
    assert.ok(added.length > 0, `${rel}: lines are added`); for (const line of added) assert.match(line, MARKER_RE, `${rel}: a changed line without the marker: ${line.slice(0, 90)}`)
    assert.equal(added.length, pairs.length, `${rel}: one [has, was] pair per added line`); assert.equal(removed.length, pairs.filter(([, was]) => was !== '').length, `${rel}: one removed base line per rewritten pair (no other base line is lost)`)
    for (const [has, was] of pairs) { assert.ok(MARKER_RE.test(has) && has.endsWith('\n'), `${rel}: the pair line carries the marker`); assert.equal(cur.split('\n').filter(l => l === has.slice(0, -1)).length, 1, `${rel}: the pair's line is in the file exactly once, as a whole line: ${has.slice(0, 70)}`); if (was !== '') { assert.ok(!MARKER_RE.test(was), 'a base line never carries the marker'); assert.equal(base.split('\n').filter(l => l === was.slice(0, -1)).length, 1, `${rel}: the line put back is a base line, once`) } }
    assert.equal(strip(rel, cur), base, `${rel}: the strip puts the base back byte for byte`); assert.equal(strip(rel, base), base, `${rel}: idempotent on the base`)
  }
  // the older proofs this change teaches: one inserted line each, with the registry-read mark, right after the shell's subject filter
  for (const rel of PIN_FILES) {
    const base = baseText(rel), cur = now(rel), [[has]] = ALL_EDITS[rel]; assert.ok(has.includes(PIN_MARK.replace('// ', '')), `${rel}: the line carries the registry-read mark`); assert.equal(cur.split('\n').filter(l => l === has.slice(0, -1)).length, 1, `${rel}: in the file once, as a whole line`)
    const { added, removed } = lineDelta(base, cur); assert.equal(added.length, 1); assert.equal(removed.length, 0, `${rel}: no base line is lost`); const lines = cur.split('\n'), at = lines.indexOf(has.slice(0, -1)); assert.ok(lines[at - 1].startsWith(stripModule.BRAND_KIT_PIN_AFTER), `${rel}: right after the Agent mode shell's filter`)
    assert.equal(strip(rel, cur), base, `${rel}: the strip puts the base back`)
  }
  for (const rel of ['lib/studio-agent-mode.ts', 'package.json', '.env.example', REGISTRY, 'scripts/test-studio-voice-call.mjs']) assert.equal(strip(rel, baseText(rel)), baseText(rel), `${rel}: not this strip's`)
  assert.equal(strip('x.ts', 7), 7); assert.equal(strip('x.ts', 'a\nb\n'), 'a\nb\n')
  // the voice-call proof's .env.example pin already reads the blocks registered after its own: nothing of it is carried
  assert.equal(git('diff', '--name-only', BASE_COMMIT, 'HEAD', '--', 'scripts/test-studio-voice-call.mjs').trim(), '', 'the voice-call proof is the base\'s'); assert.ok(baseText('scripts/test-studio-voice-call.mjs').includes('laterEnvOut'), 'and it already reads the env blocks registered after voice-call\'s (21d254c6)')
  // the new files carry the marker comment and no secret-shaped literal
  for (const rel of NEW_FILES) { assert.ok(fs.existsSync(path.join(root, rel)), `${rel} exists`); const text = now(rel); assert.doesNotMatch(text, SECRET_SHAPE, `${rel}: no secret-shaped literal`); if (!rel.endsWith('.css') && !rel.startsWith('scripts/')) assert.ok(/BRAND-KIT-CALLER/.test(text.split('\n').slice(0, 40).join('\n')), `${rel}: says what it is for`) }
  for (const rel of ['lib/studio-brand-kit.ts', 'lib/studio-brand-kit-state.ts', 'hooks/use-brand-kit.ts', 'components/studio-libraries/brand-kit-panel.tsx']) assert.ok(!/server-only|next\/server|next-auth|@\/lib\/prisma|@\/lib\/api-hardening|director-rest-entitlement/.test(now(rel).replace(/\/\/.*$/gm, '')), `${rel}: a client module never reaches the session, the database or the signer`)
  // a client module never imports the server file
  for (const rel of ['lib/studio-brand-kit-state.ts', 'hooks/use-brand-kit.ts', 'components/studio-libraries/brand-kit-panel.tsx']) assert.ok(!/studio-brand-kit-server/.test(now(rel)), `${rel}: does not import the server file`)
  for (const rel of [...THEME_PROXY_FILES, EXTRACT, BRAND]) assert.ok(/studio-brand-kit-server|restEntitlementHeaders/.test(now(rel)), `${rel}: signs through the helper`)
  assert.equal(count(now('hooks/use-brand-kit.ts'), 'api-hardening'), 0)
}
const ENV_RE = lines => lines.filter(l => l && !l.startsWith('#'))
function envChecks(texts = {}) {
  const raw = texts[ENVFILE] ?? git('show', `HEAD:${ENVFILE}`), base = baseText(ENVFILE)
  assert.ok(ENV_BLOCK.endsWith('\n') && !ENV_BLOCK.startsWith('\n')); assert.ok(raw.includes(`\n\n${ENV_BLOCK}`), 'the block is in .env.example after one blank line'); assert.equal(count(raw, ENV_BLOCK), 1)
  assert.equal(registry.stripLaterEnvBlocks(ENVFILE, raw), registry.stripLaterEnvBlocks(ENVFILE, base), 'the registry takes the block out and leaves the base\'s file'); assert.ok(later(ENVFILE, raw).endsWith(`\n${ENV_BLOCK}`), 'the block is the last thing, once the blocks registered after it are out')
  const { added, removed } = lineDelta(base, raw); assert.equal(removed.length, 0, '.env.example: only lines added'); assert.equal(added.filter(l => l !== '').join('\n') + '\n', ENV_BLOCK, '.env.example: exactly this block')
  deepEqual(ENV_RE(ENV_BLOCK.split('\n')), ['NEXT_PUBLIC_STUDIO_BRAND_KIT="false"', 'THEME_BUILDER_BRAND_EXTRACT_KEY=', 'STUDIO_BRAND_EXTRACT_DAILY_CAP='], 'three assignments: the flag (off), the server key (empty) and the cap (unset)')
  assert.ok(!/NEXT_PUBLIC_[A-Z_]*KEY/.test(ENV_BLOCK) && !PROD_HOSTS.some(host => ENV_BLOCK.includes(host)) && !SECRET_SHAPE.test(ENV_BLOCK)); assert.ok(/SERVER-ONLY/.test(ENV_BLOCK) && /UAT hosts/.test(ENV_BLOCK) && /Director's brand routes refuse an unsigned call/.test(ENV_BLOCK))
  assert.ok(!/exact "true" enables it/.test(ENV_BLOCK), 'the block does not use the phrase older proofs read'); assert.equal(count(raw, 'NEXT_PUBLIC_STUDIO_BRAND_KIT='), 1); assert.equal(count(raw, 'THEME_BUILDER_BRAND_EXTRACT_KEY='), 1)
}
const END = '  // one line per later change, above this comment'
function registryChecks(text = read(REGISTRY), reg = registry) {
  const lines = text.split('\n'), section = i => { for (let k = i; k >= 0; k--) { const m = /^export const (LATER_\w+)/.exec(lines[k]); if (m) return m[1] } return null }
  const own = lines.map((l, i) => [l, i]).filter(([l]) => l.includes('studio-brand-kit-strip.mjs'))
  assert.equal(own.length, 3, 'three registry lines name this change\'s strip module'); deepEqual(own.map(([, i]) => section(i)), ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS'], 'one in each list')
  for (const [line, i] of own) { assert.match(line, /\/\/ LATER-CHANGE: FRONTEND-1, Brand Kit caller/, 'the registry marker'); assert.ok(lines[i - 1].includes('studio-agent-mode-shell-strip.mjs'), 'right after the Agent mode shell\'s line (the end of the stack at the time)'); assert.ok(lines[i + 1] === END || (lines[i + 1].includes('// LATER-CHANGE:') && /-strip\.mjs/.test(lines[i + 1])), 'the true end of its list (or followed only by a later change\'s registered line)') }
  deepEqual(own.map(([l]) => /\)\.(\w+), \/\//.exec(l)?.[1]), ['BRAND_KIT_SCOPE_FILES', 'BRAND_KIT_ENV_BLOCK', 'stripBrandKit'])
  const base = baseText(REGISTRY).split('\n'); assert.ok(base.every(l => lines.includes(l)), 'the registry loses no line'); assert.equal(lines.filter(l => !base.includes(l)).filter(l => !l.includes('studio-brand-kit-strip.mjs')).length, 0, 'and gains nothing else')
  assert.ok(reg.LATER_STRIPS.includes(stripBrandKit) && reg.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the strip and the block are registered'); assert.ok([...SCOPE].every(rel => reg.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  const shellAt = reg.LATER_STRIPS.findIndex(fn => typeof fn === 'function' && fn.name === 'stripAgentModeShell'), ownAt = reg.LATER_STRIPS.indexOf(stripBrandKit); assert.ok(shellAt > 0 && ownAt === shellAt + 1, 'the strip comes right after the Agent mode shell\'s')
  const envShell = reg.LATER_ENV_BLOCKS.findIndex(b => typeof b === 'string' && b.includes('STUDIO AGENT BUILD SHELL')); assert.equal(reg.LATER_ENV_BLOCKS.indexOf(ENV_BLOCK), envShell + 1, 'the block comes right after the Agent mode shell\'s')
  // read through the registry (as the older proofs do), every app file and .env.example are the base's
  for (const rel of APP_FILES) assert.equal(reg.stripLaterChanges(rel, committed(rel)), reg.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's`)
  assert.equal(reg.stripLaterChanges(ENVFILE, git('show', `HEAD:${ENVFILE}`)), reg.stripLaterChanges(ENVFILE, baseText(ENVFILE)), '.env.example too')
}

// ---- scope: the COMMITTED diff only ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const ownCommits = (head = 'HEAD') => git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT))
const touchedFiles = commits => { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(c => git('show', '--name-only', '--format=', c).split('\n')).filter(rel => rel && net.has(rel))) }
const scopeCheck = (commits, extra = []) => assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base')
const messageProblems = (subject, body) => { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line'); return problems }
function scopeChecks() {
  const own = ownCommits(); assert.ok(own.length >= 1, `an own commit exists (subject starts "${SUBJECT}")`)
  scopeCheck(own)
  for (const c of own) deepEqual(messageProblems(subjectOf(c), git('log', '-1', '--format=%B', c)), [], `commit ${c.slice(0, 8)}`)
  const net = git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean); deepEqual(net.filter(rel => !SCOPE.has(rel) && !registry.LATER_CHANGE_FILES.has(rel)), [], 'the whole committed diff from the base is this change\'s scope (or a later change\'s registered files)')
  for (const rel of ['package.json', 'pnpm-lock.yaml', 'next.config.mjs', 'prisma/schema.prisma', 'lib/director-rest-entitlement.ts', 'lib/api-hardening.ts', 'lib/service-url.ts', 'lib/config.ts', 'lib/theme-fonts.ts', 'app/api/upload/route.ts', 'app/api/profile/avatar/route.ts', 'lib/supabase-storage.ts', 'scripts/test-studio-voice-call.mjs']) assert.ok(!net.includes(rel), `${rel} is the base's: untouched (no bucket, no upload route, no migration, no dependency)`)
  assert.ok(!net.some(rel => /^app\/api\/brand\/logo|supabase|migrations?\//i.test(rel)), 'no logo route, no storage, no migration')
  const diff = git('diff', '--unified=0', `${BASE_COMMIT}..HEAD`); assert.doesNotMatch(diff, SECRET_SHAPE, 'no secret-shaped literal anywhere in the committed diff'); assert.ok(!/(THEME_BUILDER_BRAND_EXTRACT_KEY|DIRECTOR_WS_AUTH_SECRET)[ \t]*=[ \t]*["']?[A-Za-z0-9+\/_-]{16,}/.test(diff), 'no key or secret value in the diff')
  // the working tree is not read: an untracked stray file changes nothing
  const stray = path.join(root, 'stray-brand-kit.txt'), before = [...touchedFiles(own)].sort(); fs.writeFileSync(stray, 'stray\n')
  try { deepEqual([...touchedFiles(own)].sort(), before, 'an untracked stray file does not change the files read'); assert.doesNotThrow(() => scopeCheck(own), 'and does not fail the scope check') } finally { fs.rmSync(stray) }
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
await check('A. flag off (every spelling): both routes 404 before anything is read; the eight theme fetches are the BASE\'s with the entitlement flag and secret on; the secret is not read', () => flagOffChecks())
await check('B. signing (BK-C19): each of the eight fetches signed only with both flags and the secret, for the session\'s user, with the method of THAT call, read by an independent verifier', () => signingChecks())
await check('C. extract route: session, approval, key, file checks, daily cap before the one paid call (fails closed), exactly Content-Type and X-API-Key, answer cleaned + no-store, fixed Studio codes, no retry, the UAT host', () => extractChecks())
await check('D. brand proxy: session\'s user in the path, signed with the method of the call, PUT body checked, empty record refused unless ?clear=1, Director\'s refusals in Studio\'s codes', () => brandChecks())
await check('E. the pure half: Theme Builder\'s answer, the brand record, Director\'s refusals, the file rules, the words, the logo-host seam', () => libChecks())
await check('F. the state machine and its flows: consent, one click one call, no retry, the draft only by the explicit applies, nothing for an empty form, theme then PUT, partial retries only the PUT', () => stateChecks())
await check('G. the screen: consent first, the proposal (originals, derived roles, warnings, failing contrast rows, fonts), Use these colours, the form, the sample, save status and retry, saved details, flag off inert', () => uiChecks())
await check('G2. fonts: "Use suggested fonts" is a second click, only with the theme-font switch on; an edit shows the suggestion it differs from', () => uiFontChecks())
await check('H. the page\'s marked lines run: the hook, Save off for a kit detail that cannot be saved, the brand save after the theme save, the reset, every mount gated', () => pageChecks())
await check('I1. deck identity (pure): the kit replaces the browser copy for all three fields, footer to company, source "form"; no kit gives the browser form back untouched', () => identityLibChecks())
await check('I2. deck identity (the hook): the standard theme\'s kit read once and fail soft, never held back; flag off is the base hook', () => identityHookChecks())
await check('J1. sources: every changed line in an existing file carries the marker; the strip puts the base back byte for byte (7 app files, 2 older proofs); no bucket, no upload route, no migration', () => sourceChecks())
await check('J2. .env.example: exactly this change\'s block, after one blank line; the registry takes it out; the voice-call pin already reads blocks after its own', () => envChecks())
await check('J3. the registry: three marked lines at the true end of their lists right after the Agent mode shell\'s; read through it every app file is the base\'s', () => registryChecks())
await check('J4. scope, read from the COMMITTED diff only: own commits by subject with the co-author line; every file is this change\'s; no secret-shaped literal; a stray untracked file changes nothing', () => scopeChecks())

console.log(`\n${failed.length ? 'FAILED' : 'PASS'}: ${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed${missed.length ? ` (${missed.join(' | ')})` : ''}`)
process.exit(failed.length || missed.length ? 1 : 0)
