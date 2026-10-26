// FRONTEND-2: proof for duplicate-deck adoption, the Studio half (flag NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT, exact "true", default off; it acts only while NEXT_PUBLIC_STUDIO_DUPLICATE_DECK is on too).
// Director half: Director !561 (DIRECTOR_DUPLICATE_ADOPT_ENABLED), contract streams/director2/dup-adopt/CONTRACT.md; its 17 recorded answers (plus the persisted row, the sync_response and index.json) are
// copied byte for byte into scripts/fixtures/duplicate-adopt/ and pinned here by sha256. Every Director answer below is one of those recordings: no network, no services, no browser, nothing written.
//
// Run: node scripts/test-studio-duplicate-adopt.mjs      (plain node: the real TypeScript transpiled and run in this process with injected fetch, login and env; the signing secret is made up at run time)
//
//   A. fixtures   the 20 files are pinned (sha256) and equal the contract's own examples when that folder is present; index.json lists the 17 answers with their statuses
//   B. route      app/api/director/sessions/[sourceSessionId]/adopt-duplicate/route.ts for every recorded answer: the Director's status and body come back as they came; a Director that cannot be reached
//                 is 502 retryable; an answer that is not JSON keeps its status (retryable when 5xx); a missing Director URL is 503
//   C. header     X-Deckster-Entitlement is minted on every call, whatever DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED says: v 1, typ rest, sub = the login's user, m POST, exp - iat <= 120, no sid, the HMAC verifies
//   D. body       the Director gets exactly { user_id, presentation_id }; the user id is the login's (id, else email), never the browser's; the browser may send { presentation_id } only, a plain id
//   E. flag off   either flag off: 404 { error: "Not found" } before the login is read or the Director is called (the house answer of a flag-off route)
//   F. step 4     runDuplicateDeck: Layout copy, POST /api/sessions, PATCH, THEN the adoption, and the copy is handed back only after it; final slot only; retried at most twice and only while retryable;
//                 a failure (or a throwing step) never deletes the copy or the session; the Decks page shows the plain note instead of the usual toast
//   G. open       the Builder's fallback: the first sync_response of a session that names no deck, on a copy (copiedFrom marker) of the final slot, calls the route ONCE; 200 reused:false reconnects
//                 (disconnect, then connect) while that socket is live; reused:true, a refusal, another session's frame or a later frame do nothing; the hook passes the payload of its own session only
//   H. identity   flag off is the base: each existing file without its DUPLICATE-ADOPT lines is the base commit's, byte for byte (and through the registry); the base lib and this lib without the step give
//                 the same requests and result, hashed
//   I. scope      the committed diff of this change's own commits (subject "Duplicate adopt: ...") holds exactly its files; marked insertions only; the registry gains three lines
//   J. safety     no credential-shaped literal in its new files or marked lines; the browser code never names the secret, the header or the minter; the route is server code, the only new importer of the minter
//   K. mutants    each one must make A-J fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as strip from './studio-duplicate-adopt-strip.mjs'
import { LATER_STRIPS, LATER_CHANGE_FILES, LATER_ENV_BLOCKS, stripLaterChanges, stripLaterEnvBlocks } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const { NextResponse } = nodeRequire('next/server')
const BASE = process.env.DUPLICATE_ADOPT_BASE || strip.BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }

const ROUTE = strip.DUPLICATE_ADOPT_ROUTE, LIB = 'lib/studio-duplicate-adopt.ts', DUP = 'lib/studio-duplicate-deck.ts'
const DASH = 'app/(app)/dashboard/page.tsx', BUILDER = 'app/builder/page.tsx', HOOK = 'hooks/use-deckster-websocket-v2.ts', MINTER = 'lib/director-rest-entitlement.ts'
const FIXTURES = strip.DUPLICATE_ADOPT_FIXTURE_DIR, CONTRACT_EXAMPLES = path.join(root, '..', 'frontend2-ws', 'streams', 'director2', 'dup-adopt', 'examples')
const FIXTURE_SHA256 = {
  '01-adopted-200.json': '3e9ed75a61f185dd9ddb553659378bd1bb7b033bd05c529216835a2980ea82fe',
  '02-persisted-row.json': 'ef40de9c350f03e63896819b7aea56bd69df226d147c4372c7d0e9222113101d',
  '03-repeat-200-reused.json': 'a9c1c802460712fdfea2b49100e8165d19eb1a233d37da0b17a846b1501f588d',
  '04-sync-response-after-adoption.json': '872301847b7c67c2ea19e1ae0a06e172f8aab4512d40a3aaa7f959608a5c1c93',
  '10-no-header-401.json': 'c7cffbe397d42cd5389952b3c32bbac6d16494e2160bc2f9eee7c5a4fd228b80',
  '11-claim-for-another-user-403.json': '9e925deb0aeef9b120a49c63aaa2dd39761158261bf4ba3bdbbaad8a9f3865f4',
  '12-claim-invalid-401.json': 'a23a9f61d8cb1a66c072daa36a88930bdf113ffbe7417d3d5a56d52e4dd887c1',
  '13-secret-unset-503.json': 'f5ea330ceafc36b3603c8e6aa02dc2b25431b3f9075647ca2d07d0796232a73d',
  '14-request-invalid-422.json': '179b7dcf642a65347449d3ec52713e0590e7542a5c0e66eef8b08b87b0d8b4e1',
  '20-not-owned-403.json': 'e509c730722e35b20afff74534116a8fc7dc1dcd3a6954bd57840b36acd79c97',
  '21-not-a-duplicate-422.json': 'ac658d5dde8f345a165258106131f557a994d2695f4b0c2a32f058ea78bf0169',
  '22-in-use-409.json': 'efad4b067c036c411c263cca355086c0a965fe24b296f3dd7d45437ddbddf124',
  '23-session-not-fresh-409.json': 'e27fc72567bb768522d908747d50773ffb342d3fb879f054e3438c1e9ea379af',
  '24-presentation-not-found-404.json': '08a1f9b2fff9936d08b010125e5a235986020d6ce900ca6b5085ac252fcddf4d',
  '25-layout-unavailable-502.json': 'b82aa33d4ee5ec81e3a51fe171c75770329997ed477b36203b59bcac61c62dc5',
  '26-deck-empty-422.json': 'e3ca9e4ceb5f749e92a068a134169c1c2567ce69d83ffd7a68999bbd307f6e91',
  '27-store-unavailable-503.json': 'ec94a84df8527ade99db2835b8d53e9d654a1e590a2e9a65c53d723384d9cc82',
  '28-not-durable-500.json': '54d62f0cbea2077e399b98279db5fd79e55833912ef9f95ab10e2b418421e09e',
  '30-flag-off-404.json': 'a362474ea16adabf83845d29cdd1441fce89d56cb40a8936c9c29c6b56461002',
  'index.json': '74806017599bf2c126b3fcf8780aacc36b4dcb2bd874dd46f60ca411bb4bc25d',
}

let overrides = {} // in-memory mutations (section K): every source is read through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const fixture = name => JSON.parse(read(`${FIXTURES}/${name.endsWith('.json') ? name : `${name}.json`}`))
const SECRET = `placeholder-${crypto.randomBytes(9).toString('base64url')}` // made up per run; never a real secret
const AUTH_OPTIONS = { synthetic: 'auth-options' }
const DIRECTOR = 'https://director.synthetic.invalid'
const ENV_ON = (extra = {}) => ({ NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true', NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true', DIRECTOR_API_URL: `${DIRECTOR}/`, DIRECTOR_WS_AUTH_SECRET: SECRET, ...extra })
const USER = { id: 'u1', email: 'person@synthetic.invalid' }
const MARKED = line => strip.DUPLICATE_ADOPT_MARKER_RE.test(line)

// ---- the loader: real TypeScript compiled to CommonJS and run in THIS realm with a chosen env, imports and globals ------------------------------------------------
function compile(source, rel) {
  const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } })
  const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${rel}: ${errors.length} transpile error(s)`)
  return out.outputText
}
const compiled = new Map() // (file, names, source) -> the compiled wrapper: the suite runs once per mutant, so the same text is never compiled twice
function wrapper(rel, source, names) {
  const key = `${rel}\0${names.join(',')}\0${sha(source)}`
  if (!compiled.has(key)) compiled.set(key, vm.runInThisContext(`(function (${names.join(', ')}) {\n${compile(source, rel)}\n})`, { filename: rel }))
  return compiled.get(key)
}
function loadTs(rel, { env = {}, stubs = {}, globals = {}, text } = {}) {
  const mod = { exports: {} }
  const req = id => {
    if (id in stubs) return stubs[id]
    if (id === 'crypto') return crypto
    if (id.startsWith('@/lib/')) return loadTs(`${id.slice(2)}.ts`, { env, stubs, globals })
    throw new Error(`${rel}: unexpected import ${id}`)
  }
  const names = ['module', 'exports', 'require', 'process', ...Object.keys(globals)]
  wrapper(rel, text ?? read(rel), names)(mod, mod.exports, req, { env }, ...Object.values(globals))
  return mod.exports
}
/** One line of an app file, run as TypeScript with the names it uses supplied. */
function evalLine(code, names, values) {
  const mod = { exports: {} }
  wrapper('snippet.ts', `${code}\n`, ['module', ...names])(mod, ...values)
  return mod.exports
}
const lineWith = (rel, needle) => {
  const lines = read(rel).split('\n').filter(line => line.includes(needle) && MARKED(line))
  if (lines.length !== 1) throw new Error(`${rel}: ${lines.length} marked lines with ${needle}`)
  return lines[0]
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const answer = name => { const fx = fixture(name); return () => json(fx.status, fx.body) }
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(resolve => setImmediate(resolve)) }

/** The Studio route, called as Next calls it. `upstream(url, init, attempt)` is the Director. */
async function callRoute({ env = ENV_ON(), user = USER, sessionId = 'new-session-1', body = { presentation_id: 'copy-deck-1' }, raw, contentLength, upstream = answer('01-adopted-200') } = {}) {
  const log = { sessions: 0, fetches: [] }
  const stubs = {
    'next/server': { NextResponse },
    'next-auth': { getServerSession: async options => { log.sessions++; if (options !== AUTH_OPTIONS) throw new Error('auth options'); return user ? { user } : null } },
    '@/lib/auth-options': { authOptions: AUTH_OPTIONS },
  }
  const fetch = async (url, init) => { log.fetches.push({ url, init }); return upstream(url, init, log.fetches.length) }
  const route = loadTs(ROUTE, { env, stubs, globals: { fetch } })
  const text = raw ?? JSON.stringify(body)
  const headers = { 'content-type': 'application/json', ...(contentLength ? { 'content-length': String(contentLength) } : {}) }
  const req = { headers: { get: name => headers[name.toLowerCase()] ?? null }, text: async () => text }
  const res = await route.POST(req, { params: Promise.resolve({ sourceSessionId: sessionId }) })
  const resText = await res.text()
  let parsed = null
  try { parsed = JSON.parse(resText) } catch { parsed = null }
  return { status: res.status, json: parsed, log, route }
}
const claimsOf = value => {
  const [payload, signature] = String(value).split('.')
  const expected = crypto.createHmac('sha256', SECRET).update(`deckster-rest-v1.${payload}`).digest('base64url')
  return { claims: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')), verifies: signature === expected }
}

/** A browser fetch for the duplicate flow: Layout, the sessions API, and the Studio route (the real one, its Director answering from `directorAnswers` in turn). */
function duplicateWorld({ directorAnswers = ['01-adopted-200'], routeEnv = ENV_ON(), patchStatus = 200 } = {}) {
  const log = [], director = [], sleeps = []
  const fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    log.push(`${method} ${url}`)
    if (url.endsWith('/duplicate')) return json(200, { success: true, id: 'copy-deck-1', presentation_id: 'copy-deck-1', url: '/p/copy-deck-1', presentation_url: '/p/copy-deck-1', slide_count: 5, reused: false })
    if (url === '/api/sessions' && method === 'POST') return json(200, { session: { id: 'new-session-1' } })
    if (url === '/api/sessions/new-session-1' && method === 'PATCH') return json(patchStatus, { session: { id: 'new-session-1', createdAt: 'synthetic-created', updatedAt: 'synthetic-updated' } })
    if (method === 'DELETE') return json(200, {})
    if (url === '/api/director/sessions/new-session-1/adopt-duplicate' && method === 'POST') {
      const body = JSON.parse(init.body)
      const out = await callRoute({ env: routeEnv, body, upstream: (u, i) => { director.push({ url: u, body: JSON.parse(i.body) }); const name = directorAnswers[Math.min(director.length - 1, directorAnswers.length - 1)]; if (name === 'THROW') throw new Error('offline'); return answer(name)() } })
      return json(out.status, out.json)
    }
    return json(500, { error: 'unexpected' })
  }
  return { log, director, sleeps, fetch, sleep: async ms => { sleeps.push(ms) } }
}
const TARGET = slot => ({ ok: true, slot, presentationId: 'source-deck-1', url: 'https://layout.synthetic.invalid/p/source-deck-1' })
const SOURCE = { sessionId: 'source-session-1', shownTitle: 'Q4 sales review', currentStage: 6, slideCount: 5 }
function runDuplicate(libText, { slot = 'final', world = duplicateWorld(), adopt } = {}) {
  const lib = loadTs(DUP, { text: libText })
  const ids = ['op-1', 'new-session-1']
  const deps = { fetch: world.fetch, layoutBaseUrl: () => 'https://layout.synthetic.invalid', newId: () => ids.shift(), now: () => new Date('2026-10-26T00:00:00.000Z'), sleep: world.sleep, ...(adopt ? { adopt } : {}) }
  return lib.runDuplicateDeck({ source: SOURCE, target: TARGET(slot), deps })
}
const adoptVia = world => (sessionId, presentationId) => loadTs(LIB).adoptDuplicateCopy({ sessionId, presentationId, fetch: world.fetch, sleep: world.sleep })

// ---- the suite (sections A-J): every check records its failure instead of throwing, so a mutant can count what it broke ----------------------------------------------
async function suite({ quiet = false, extraCommitted = [] } = {}) {
  let checks = 0
  const failures = []
  const check = async (name, fn) => { checks++; try { await fn() } catch (error) { failures.push(`${name}: ${String(error?.message ?? error).split('\n')[0]}`); if (process.env.DUPLICATE_ADOPT_DEBUG && !quiet) console.error(error) } }
  const eq = (a, b, m) => assert.equal(a, b, ...(m === undefined ? [] : [m])), deep = (a, b, m) => assert.deepStrictEqual(plain(a), plain(b), ...(m === undefined ? [] : [m])), ok = (v, m) => assert.ok(v, ...(m === undefined ? [] : [m]))

  // ---- A. fixtures -------------------------------------------------------------------------------------------------------------------------------------------------
  await check('A: 20 fixture files, pinned', () => {
    deep(fs.readdirSync(path.join(root, FIXTURES)).sort(), [...strip.DUPLICATE_ADOPT_FIXTURES].sort())
    deep(Object.keys(FIXTURE_SHA256).sort(), [...strip.DUPLICATE_ADOPT_FIXTURES].sort())
    for (const name of strip.DUPLICATE_ADOPT_FIXTURES) eq(sha(read(`${FIXTURES}/${name}`)), FIXTURE_SHA256[name], name)
  })
  await check('A: byte for byte the contract\'s examples (when that folder is on this machine)', () => {
    if (!fs.existsSync(CONTRACT_EXAMPLES)) return
    for (const name of strip.DUPLICATE_ADOPT_FIXTURES) eq(read(`${FIXTURES}/${name}`), fs.readFileSync(path.join(CONTRACT_EXAMPLES, name), 'utf8'), name)
  })
  const index = fixture('index')
  await check('A: index.json lists the 17 answers, each file\'s status is its entry', () => {
    eq(Object.keys(index).length, 17)
    for (const [name, status] of Object.entries(index)) eq(fixture(name).status, status, name)
    for (const [name, value] of Object.entries(index)) if (name.startsWith('0')) eq(value, 200, name); else ok(value >= 400, name)
  })

  // ---- B. the route passes every recorded Director answer through -------------------------------------------------------------------------------------------------
  for (const name of Object.keys(index)) {
    await check(`B: ${name} comes back as the Director sent it`, async () => {
      const fx = fixture(name)
      const out = await callRoute({ upstream: answer(name) })
      eq(out.status, fx.status); deep(out.json, fx.body); eq(out.log.fetches.length, 1, 'one Director call')
      eq(out.log.fetches[0].url, `${DIRECTOR}/api/sessions/new-session-1/adopt-duplicate`); eq(out.log.fetches[0].init.method, 'POST'); eq(out.log.fetches[0].init.cache, 'no-store')
      ok(out.log.fetches[0].init.signal instanceof AbortSignal, 'a bounded wait')
      if (fx.status !== 200) { eq(typeof fx.body.detail, 'string'); if ('retryable' in fx.body) eq(out.json.retryable, fx.body.retryable) }
    })
  }
  await check('B: a Director that cannot be reached is 502, retryable, in the refusal shape', async () => {
    const out = await callRoute({ upstream: () => { throw new Error('connect ECONNREFUSED') } })
    eq(out.status, 502); deep(Object.keys(out.json).sort(), ['code', 'detail', 'error', 'retryable']); eq(out.json.code, 'DIRECTOR_UNREACHABLE'); eq(out.json.retryable, true); eq(out.json.error, out.json.detail)
    ok(!/ECONNREFUSED/.test(JSON.stringify(out.json)), 'the internal error is not shown')
  })
  await check('B: an answer that is not JSON keeps its status; retryable only when 5xx', async () => {
    const html = status => () => new Response('<html>bad gateway</html>', { status })
    const a = await callRoute({ upstream: html(503) }); eq(a.status, 503); eq(a.json.code, 'DIRECTOR_BAD_RESPONSE'); eq(a.json.retryable, true)
    const b = await callRoute({ upstream: html(400) }); eq(b.status, 400); eq(b.json.retryable, false)
  })
  await check('B: no Director URL configured is 503 (not retryable) and nothing is called', async () => {
    const env = ENV_ON(); delete env.DIRECTOR_API_URL
    const out = await callRoute({ env }); eq(out.status, 503); eq(out.json.code, 'SERVICE_URL_NOT_CONFIGURED'); eq(out.json.retryable, false); eq(out.log.fetches.length, 0)
  })

  // ---- C. the minted header -------------------------------------------------------------------------------------------------------------------------------------------
  for (const [label, extra] of [['header flag unset', {}], ['header flag "false"', { DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'false' }], ['header flag "true"', { DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'true' }]]) {
    await check(`C: minted unconditionally (${label}): v1, rest, sub = the login, POST, <= 120 s, no sid, verifies`, async () => {
      const out = await callRoute({ env: ENV_ON(extra) })
      const headers = out.log.fetches[0].init.headers
      deep(Object.keys(headers).sort(), ['Content-Type', 'X-Deckster-Entitlement']); eq(headers['Content-Type'], 'application/json')
      const { claims, verifies } = claimsOf(headers['X-Deckster-Entitlement'])
      ok(verifies, 'the signature verifies with the shared secret')
      deep(Object.keys(claims).sort(), ['exp', 'iat', 'm', 'sub', 'typ', 'v']); eq(claims.v, 1); eq(claims.typ, 'rest'); eq(claims.sub, USER.id); eq(claims.m, 'POST')
      ok(Number.isInteger(claims.iat) && claims.exp > claims.iat && claims.exp - claims.iat <= 120, 'a short life'); ok(!('sid' in claims))
      ok(Math.abs(claims.iat - Math.floor(Date.now() / 1000)) <= 5, 'minted now, per request')
    })
  }
  await check('C: an email-keyed login signs the email (the same string the body carries)', async () => {
    const out = await callRoute({ user: { email: USER.email } })
    eq(claimsOf(out.log.fetches[0].init.headers['X-Deckster-Entitlement']).claims.sub, USER.email); eq(JSON.parse(out.log.fetches[0].init.body).user_id, USER.email)
  })
  await check('C: no signing secret: no header, and the Director\'s 401 comes back', async () => {
    const env = ENV_ON(); delete env.DIRECTOR_WS_AUTH_SECRET
    const out = await callRoute({ env, upstream: (u, init) => (init.headers['X-Deckster-Entitlement'] ? answer('01-adopted-200')() : answer('10-no-header-401')()) })
    deep(Object.keys(out.log.fetches[0].init.headers), ['Content-Type']); eq(out.status, 401); deep(out.json, fixture('10-no-header-401').body)
  })
  await check('C: each call mints its own header', async () => {
    const a = await callRoute(), b = await callRoute({ user: { id: 'u2' } })
    eq(claimsOf(b.log.fetches[0].init.headers['X-Deckster-Entitlement']).claims.sub, 'u2'); ok(a.log.fetches[0].init.headers['X-Deckster-Entitlement'] !== b.log.fetches[0].init.headers['X-Deckster-Entitlement'])
  })

  // ---- D. the body and where the user id comes from --------------------------------------------------------------------------------------------------------------
  await check('D: the Director gets exactly { user_id, presentation_id }, the user id from the login', async () => {
    const out = await callRoute()
    const body = JSON.parse(out.log.fetches[0].init.body)
    deep(Object.keys(body).sort(), ['presentation_id', 'user_id']); eq(body.user_id, USER.id); eq(body.presentation_id, 'copy-deck-1')
    eq(out.log.fetches[0].init.body, JSON.stringify({ user_id: USER.id, presentation_id: 'copy-deck-1' }))
  })
  for (const [label, opts] of [
    ['a browser user_id', { body: { presentation_id: 'copy-deck-1', user_id: 'someone-else' } }],
    ['another key', { body: { presentation_id: 'copy-deck-1', presentation_url: 'https://layout.synthetic.invalid/p/x' } }],
    ['no presentation_id', { body: {} }], ['a number', { body: { presentation_id: 5 } }], ['a URL', { body: { presentation_id: 'https://layout.synthetic.invalid/p/x' } }],
    ['an id too long', { body: { presentation_id: `a${'b'.repeat(200)}` } }], ['a list', { raw: '["copy-deck-1"]' }], ['null', { raw: 'null' }], ['not JSON', { raw: '{presentation_id' }],
    ['a valid body over 4 KB (padded with spaces)', { raw: `${JSON.stringify({ presentation_id: 'copy-deck-1' })}${' '.repeat(5000)}` }], ['a declared length over 4 KB', { contentLength: 5000 }],
    ['an empty session id', { sessionId: '' }], ['a session id with a slash', { sessionId: 'a/b' }], ['a session id starting with a dot', { sessionId: '.hidden' }], ['a session id too long', { sessionId: `s${'1'.repeat(200)}` }],
  ]) {
    await check(`D: ${label} is refused (400) after the login and before the Director`, async () => {
      const out = await callRoute(opts)
      eq(out.status, 400); eq(out.json.code, 'REQUEST_INVALID'); eq(out.json.retryable, false); eq(out.log.sessions, 1); eq(out.log.fetches.length, 0)
    })
  }
  await check('D: no login is 401 and the Director is never called', async () => {
    const out = await callRoute({ user: null }); eq(out.status, 401); eq(out.log.fetches.length, 0)
    const blank = await callRoute({ user: { id: '', email: '' } }); eq(blank.status, 401); eq(blank.log.fetches.length, 0)
  })
  await check('D: a plain 200-character id and the uuid shape are accepted', async () => {
    eq((await callRoute({ sessionId: `s${'1'.repeat(199)}` })).status, 200)
    eq((await callRoute({ sessionId: '1f0c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f', body: { presentation_id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d' } })).status, 200)
  })

  // ---- E. flag off -------------------------------------------------------------------------------------------------------------------------------------------------
  for (const [label, env] of [
    ['both off', { NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: undefined, NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: undefined }], ['adopt off', { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'false' }],
    ['duplicate off', { NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'false' }], ['adopt "TRUE"', { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'TRUE' }], ['adopt "1"', { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: '1' }],
  ]) {
    await check(`E: ${label}: 404 { error: "Not found" }, no login read, no Director call`, async () => {
      const merged = ENV_ON(); for (const [k, v] of Object.entries(env)) { if (v === undefined) delete merged[k]; else merged[k] = v }
      const out = await callRoute({ env: merged })
      eq(out.status, 404); deep(out.json, { error: 'Not found' }); eq(out.log.sessions, 0); eq(out.log.fetches.length, 0)
    })
  }

  // ---- F. step 4 in the duplicate flow -------------------------------------------------------------------------------------------------------------------------------
  const dupText = read(DUP)
  await check('F: Layout copy, POST /api/sessions, PATCH, then the adoption; the result carries it; nothing deleted', async () => {
    const world = duplicateWorld()
    const result = await runDuplicate(dupText, { world, adopt: adoptVia(world) })
    deep(world.log, ['POST https://layout.synthetic.invalid/api/presentations/source-deck-1/duplicate', 'POST /api/sessions', 'PATCH /api/sessions/new-session-1', 'POST /api/director/sessions/new-session-1/adopt-duplicate'])
    eq(result.ok, true); deep(result.adoption, { ok: true, reused: false, attempts: 1 }); eq(result.presentationId, 'copy-deck-1'); eq(result.slot, 'final')
    deep(world.director, [{ url: `${DIRECTOR}/api/sessions/new-session-1/adopt-duplicate`, body: { user_id: USER.id, presentation_id: 'copy-deck-1' } }])
  })
  await check('F: the copy is handed back only after the adoption settles (before that, nobody can open it)', async () => {
    let release
    const world = duplicateWorld()
    let settled = false, called = 0
    const pending = runDuplicate(dupText, { world, adopt: () => { called++; return new Promise(resolve => { release = resolve }) } }).then(value => { settled = true; return value })
    await tick(20)
    eq(called, 1); eq(settled, false, 'still running while step 4 runs'); deep(world.log.slice(-1), ['PATCH /api/sessions/new-session-1'])
    release({ ok: true, reused: true, attempts: 1 }); const result = await pending
    eq(settled, true); deep(result.adoption, { ok: true, reused: true, attempts: 1 })
  })
  await check('F: step 4 is never reached when the PATCH failed (the old unwinding is unchanged)', async () => {
    const world = duplicateWorld({ patchStatus: 500 }); let called = 0
    const result = await runDuplicate(dupText, { world, adopt: async () => { called++; return { ok: true, reused: false, attempts: 1 } } })
    eq(result.ok, false); eq(called, 0); ok(world.log.includes('DELETE /api/sessions/new-session-1'))
  })
  for (const name of Object.keys(index).filter(n => fixture(n).status !== 200)) {
    await check(`F: ${name}: the copy stands, nothing deleted, retried only while retryable`, async () => {
      const fx = fixture(name), world = duplicateWorld({ directorAnswers: [name] })
      const result = await runDuplicate(dupText, { world, adopt: adoptVia(world) })
      eq(result.ok, true); eq(result.sessionId, 'new-session-1'); ok(!world.log.some(line => line.startsWith('DELETE')), 'never deleted')
      const retryable = fx.body.retryable === true
      deep(result.adoption, { ok: false, status: fx.status, code: fx.body.code ?? null, retryable, attempts: retryable ? 3 : 1 })
      eq(world.director.length, retryable ? 3 : 1); deep(world.sleeps, retryable ? [1000, 2000] : [])
    })
  }
  await check('F: a retryable answer then 200: two calls, adopted', async () => {
    const world = duplicateWorld({ directorAnswers: ['27-store-unavailable-503', '01-adopted-200'] })
    const result = await runDuplicate(dupText, { world, adopt: adoptVia(world) })
    deep(result.adoption, { ok: true, reused: false, attempts: 2 }); deep(world.sleeps, [1000])
  })
  await check('F: an unreachable Director (502 from the route) is retried twice, then reported', async () => {
    const world = duplicateWorld({ directorAnswers: ['THROW'] })
    const result = await runDuplicate(dupText, { world, adopt: adoptVia(world) })
    deep(result.adoption, { ok: false, status: 502, code: 'DIRECTOR_UNREACHABLE', retryable: true, attempts: 3 }); ok(!world.log.some(line => line.startsWith('DELETE')))
  })
  await check('F: the browser call itself failing (offline) is retried the same way', async () => {
    const lib = loadTs(LIB), sleeps = []
    const out = await lib.adoptDuplicateCopy({ sessionId: 'new-session-1', presentationId: 'copy-deck-1', fetch: async () => { throw new Error('offline') }, sleep: async ms => { sleeps.push(ms) } })
    deep(out, { ok: false, status: 0, code: null, retryable: true, attempts: 3 }); deep(sleeps, [1000, 2000])
  })
  await check('F: the browser sends { presentation_id } only, to its own route', async () => {
    const calls = []
    await loadTs(LIB).adoptDuplicateCopy({ sessionId: 'new session/1', presentationId: 'copy-deck-1', fetch: async (url, init) => { calls.push({ url, init }); return json(200, fixture('01-adopted-200').body) }, sleep: async () => {} })
    eq(calls[0].url, '/api/director/sessions/new%20session%2F1/adopt-duplicate'); eq(calls[0].init.body, '{"presentation_id":"copy-deck-1"}'); eq(calls[0].init.method, 'POST')
    deep(Object.keys(calls[0].init.headers), ['Content-Type'])
  })
  await check('F: a throwing step 4 is a failure on the result; nothing is deleted', async () => {
    const world = duplicateWorld()
    for (const adopt of [() => { throw new Error('sync') }, async () => { throw new Error('async') }]) {
      const result = await runDuplicate(dupText, { world, adopt })
      eq(result.ok, true); eq(result.adoption.ok, false); ok(!world.log.some(line => line.startsWith('DELETE')))
    }
  })
  await check('F: a strawman-slot copy is never adopted (no call, no adoption key)', async () => {
    const world = duplicateWorld(); let called = 0
    const result = await runDuplicate(dupText, { slot: 'strawman', world, adopt: async () => { called++; return { ok: true, reused: false, attempts: 1 } } })
    eq(called, 0); eq(result.ok, true); ok(!('adoption' in result)); ok(!world.log.some(line => line.includes('adopt-duplicate')))
  })
  // the Decks page wiring: the flag, the dependency, the note
  await check('F: the Decks page reads its flag exactly ("true", and only with Duplicate on)', () => {
    const line = lineWith(DASH, 'const duplicateAdoptEnabled')
    const run = (deck, adopt) => evalLine(`${line}\nmodule.exports = duplicateAdoptEnabled`, ['process', 'duplicateDeckEnabled'], [{ env: { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: adopt } }, deck])
    eq(run(true, 'true'), true); eq(run(false, 'true'), false); eq(run(true, 'false'), false); eq(run(true, undefined), false); eq(run(true, 'TRUE'), false); eq(run(true, '1'), false)
  })
  await check('F: the Decks page passes step 4 to runDuplicateDeck only with the flag on', async () => {
    const line = lineWith(DASH, 'adopt: (sessionId: string, presentationId: string) =>')
    const page = read(DASH), at = page.indexOf(line), call = page.indexOf('const result = await runDuplicateDeck({')
    ok(call >= 0 && at > call && at < page.indexOf('if (currentOwner.current !== copyOwner) return', call), 'inside the runDuplicateDeck call')
    const seen = []
    const stub = input => { seen.push(input); return Promise.resolve({ ok: true, reused: false, attempts: 1 }) }
    const make = enabled => evalLine(`module.exports = {\n${line}\n}`, ['duplicateAdoptEnabled', 'adoptDuplicateCopy', 'fetch', 'setTimeout'], [enabled, stub, async () => json(200, {}), (fn) => fn()])
    deep(Object.keys(make(false)), [])
    const deps = make(true); deep(Object.keys(deps), ['adopt'])
    await deps.adopt('new-session-1', 'copy-deck-1')
    eq(seen[0].sessionId, 'new-session-1'); eq(seen[0].presentationId, 'copy-deck-1'); eq(typeof seen[0].fetch, 'function'); await seen[0].sleep(5)
  })
  await check('F: a failed step 4 shows the plain note instead of the usual toast; the card is already added; a success says what it always said', () => {
    const line = lineWith(DASH, 'DUPLICATE_ADOPT_PENDING_NOTE });')
    const page = read(DASH), at = page.indexOf(line)
    ok(at > page.indexOf('setPresentations(items => [copy, ...items.filter(item => item.id !== copy.id)])') && at < page.indexOf('toast({ title: "Deck copied", description: `“${result.title}” is in your decks. Chat history stays with the original.` })'), 'after the card, before the usual toast')
    const run = (enabled, adoption) => { const toasts = []; const out = evalLine(`module.exports = (() => {\n${line}\nreturn 'usual toast'\n})()`, ['duplicateAdoptEnabled', 'result', 'toast', 'DUPLICATE_ADOPT_PENDING_NOTE'], [enabled, { ok: true, ...(adoption ? { adoption } : {}) }, t => toasts.push(t), loadTs(LIB).DUPLICATE_ADOPT_PENDING_NOTE]); return { out: out === undefined ? 'returned early' : out, toasts } }
    deep(run(true, { ok: false, status: 503, code: 'SESSION_STORE_UNAVAILABLE', retryable: true, attempts: 3 }), { out: 'returned early', toasts: [{ title: 'Deck copied', description: "The copy is ready. Chat can't edit it yet; open it again in a moment." }] })
    deep(run(true, { ok: true, reused: false, attempts: 1 }), { out: 'usual toast', toasts: [] }); deep(run(true, null), { out: 'usual toast', toasts: [] })
    deep(run(false, { ok: false, status: 0, code: null, retryable: true, attempts: 3 }), { out: 'usual toast', toasts: [] })
  })
  await check('F: no marked line deletes anything', () => {
    for (const rel of [DUP, DASH]) for (const line of read(rel).split('\n').filter(MARKED)) ok(!/DELETE|removeSession|unfinished\(/.test(line), `${rel}: ${line.trim().slice(0, 60)}`)
  })

  // ---- G. the Builder-open fallback ----------------------------------------------------------------------------------------------------------------------------------
  const copiedSession = (extra = {}) => ({ id: 'new-session-1', finalPresentationId: 'copy-deck-1', finalPresentationUrl: 'https://layout.synthetic.invalid/p/copy-deck-1', stateCache: { activeVersion: 'final', currentStatus: { copiedFrom: { sessionId: 'source-session-1', title: 'Q4 sales review' } } }, ...extra })
  const NO_DECK = { action: 'skip_history', current_state: 'PROVIDE_GREETING', has_strawman: false, message_count: 0 }
  function openWorld({ session = copiedSession(), getStatus = 200, directorAnswers = ['01-adopted-200'] } = {}) {
    const log = [], director = []
    const fetch = async (url, init = {}) => {
      log.push(`${init.method ?? 'GET'} ${url}`)
      if (url === '/api/sessions/new-session-1' && !init.method) return json(getStatus, { session })
      if (url === '/api/director/sessions/new-session-1/adopt-duplicate') {
        const out = await callRoute({ body: JSON.parse(init.body), upstream: (u, i) => { director.push(JSON.parse(i.body)); return answer(directorAnswers[Math.min(director.length - 1, directorAnswers.length - 1)])() } })
        return json(out.status, out.json)
      }
      return json(500, {})
    }
    const controller = loadTs(LIB).createDuplicateAdoptOnOpen({ fetch })
    const reconnects = []
    const sync = (payload, { sessionId = 'new-session-1', current = true, reconnect = () => reconnects.push(sessionId) } = {}) => controller.onSync(payload, { sessionId, isCurrent: () => current }, reconnect)
    return { log, director, reconnects, sync }
  }
  await check('G: the recorded sync_response after adoption (04) names the deck: nothing is called', async () => {
    const w = openWorld(); eq(await w.sync(fixture('04-sync-response-after-adoption').frame.payload), 'has-deck'); deep(w.log, []); deep(w.reconnects, [])
  })
  await check('G: no deck on the first sync_response of a copy: one call, reconnect on 200 reused:false', async () => {
    const w = openWorld()
    eq(await w.sync(NO_DECK), 'reconnected')
    deep(w.log, ['GET /api/sessions/new-session-1', 'POST /api/director/sessions/new-session-1/adopt-duplicate']); deep(w.director, [{ user_id: USER.id, presentation_id: 'copy-deck-1' }]); deep(w.reconnects, ['new-session-1'])
    eq(await w.sync(fixture('04-sync-response-after-adoption').frame.payload), 'not-first', 'the reconnect\'s own sync_response is never acted on'); eq(w.log.length, 2)
    eq(await w.sync(NO_DECK), 'not-first', 'nor any later one'); eq(w.log.length, 2)
  })
  await check('G: has_strawman false with an id (the blank canvas) also counts as no deck', async () => {
    const w = openWorld(); eq(await w.sync({ ...NO_DECK, presentation_id: 'blank-canvas-1' }), 'reconnected')
  })
  await check('G: 200 reused:true does not reconnect', async () => {
    const w = openWorld({ directorAnswers: ['03-repeat-200-reused'] }); eq(await w.sync(NO_DECK), 'reused'); deep(w.reconnects, [])
  })
  for (const name of ['25-layout-unavailable-502', '27-store-unavailable-503', '20-not-owned-403', '23-session-not-fresh-409', '30-flag-off-404']) {
    await check(`G: ${name}: one call only (no retry on open), no reconnect`, async () => {
      const w = openWorld({ directorAnswers: [name] }); eq(await w.sync(NO_DECK), 'failed'); eq(w.director.length, 1); deep(w.reconnects, [])
    })
  }
  await check('G: no copiedFrom marker, a strawman-slot copy, an unreadable session: no call', async () => {
    const a = openWorld({ session: copiedSession({ stateCache: { currentStatus: {} } }) }); eq(await a.sync(NO_DECK), 'not-a-copy'); deep(a.log, ['GET /api/sessions/new-session-1'])
    const b = openWorld({ session: copiedSession({ finalPresentationId: null, strawmanPresentationId: 'copy-deck-1' }) }); eq(await b.sync(NO_DECK), 'not-final'); deep(b.log, ['GET /api/sessions/new-session-1'])
    const c = openWorld({ getStatus: 404 }); eq(await c.sync(NO_DECK), 'not-a-copy'); deep(c.log, ['GET /api/sessions/new-session-1'])
  })
  await check('G: a socket that is no longer live is not reconnected; a reconnect that throws is a failure, not a crash', async () => {
    const a = openWorld(); eq(await a.sync(NO_DECK, { current: false }), 'not-current'); deep(a.reconnects, [])
    const b = openWorld(); eq(await b.sync(NO_DECK, { reconnect: () => { throw new Error('boom') } }), 'failed')
    const c = openWorld(); eq(await c.sync(NO_DECK, { sessionId: '' }), 'not-first'); deep(c.log, [])
  })
  await check('G: each session is acted on once per tab, separately', async () => {
    const w = openWorld(); eq(await w.sync(NO_DECK, { sessionId: 'other-session' }), 'not-a-copy'); eq(await w.sync(NO_DECK), 'reconnected')
  })
  await check('G: the hook passes its own session\'s sync_response payload only, with the flag on only', () => {
    const line = lineWith(HOOK, 'onDuplicateAdoptSync?.(')
    ok(read(HOOK).split('\n').filter(MARKED).length === 3, 'three marked lines in the hook (a comment, the option, the call)')
    ok(read(HOOK).includes("  onDuplicateAdoptSync?: (payload: unknown, owner: { sessionId: string; isCurrent: () => boolean }) => void; // DUPLICATE-ADOPT\n"), 'the option type')
    const run = (env, message) => { const calls = []; const isCurrentSocket = () => true; evalLine(line, ['process', 'parsedMessage', 'socketSessionId', 'transportCallbacksRef', 'isCurrentSocket'], [{ env }, message, 'new-session-1', { current: { onDuplicateAdoptSync: (p, o) => calls.push({ p, sessionId: o.sessionId, current: o.isCurrent() }) } }, isCurrentSocket]); return calls }
    const frame = fixture('04-sync-response-after-adoption').frame
    deep(run({ NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }, { ...frame, session_id: 'new-session-1' }), [{ p: frame.payload, sessionId: 'new-session-1', current: true }])
    deep(run({}, frame), []); deep(run({ NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'TRUE' }, frame), [])
    deep(run({ NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }, { ...frame, session_id: 'other-session' }), []); deep(run({ NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }, { ...frame, type: 'chat_message' }), [])
    const at = read(HOOK).indexOf(line); ok(at > read(HOOK).indexOf('transportCallbacksRef.current.onJobsSync?.(rows') && at < read(HOOK).indexOf('if (!isKnownDirectorMessageType(parsedMessage.type)) {', at), 'beside the job ledger\'s sync tap, before the frame is dispatched')
  })
  await check('G: the Builder makes one controller per tab, only with both flags on', () => {
    const line = lineWith(BUILDER, 'const studioDuplicateAdoptOnOpen =')
    const made = []
    const run = env => evalLine(`${line}\nmodule.exports = studioDuplicateAdoptOnOpen`, ['process', 'createDuplicateAdoptOnOpen', 'fetch'], [{ env }, deps => { made.push(deps); return { onSync: () => {} } }, async () => json(200, {})])
    ok(run({ NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true', NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }) !== null); eq(made.length, 1); eq(typeof made[0].fetch, 'function')
    for (const env of [{}, { NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true' }, { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }, { NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true', NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'yes' }]) eq(run(env), null)
    eq(made.length, 1)
    ok(line.startsWith('const studioDuplicateAdoptOnOpen = '), 'module scope (not inside a component)')
  })
  await check('G: the Builder hands the socket the callback only with the controller; the reconnect is disconnect then connect', async () => {
    const line = lineWith(BUILDER, 'onDuplicateAdoptSync:')
    const page = read(BUILDER), at = page.indexOf(line)
    ok(at > page.indexOf('} = useDecksterWebSocketV2({') && at < page.indexOf('onBuildPhase: (payload, ownerSessionId) =>', at), 'in the socket\'s options')
    const order = [], seen = []
    const make = controller => evalLine(`module.exports = {\n${line}\n}`, ['studioDuplicateAdoptOnOpen', 'disconnect', 'connect'], [controller, () => order.push('disconnect'), () => order.push('connect')])
    deep(Object.keys(make(null)), [])
    const options = make({ onSync: (payload, owner, reconnect) => { seen.push({ payload, owner }); reconnect(); return Promise.resolve('reconnected') } })
    deep(Object.keys(options), ['onDuplicateAdoptSync'])
    const owner = { sessionId: 'new-session-1', isCurrent: () => true }
    eq(options.onDuplicateAdoptSync(NO_DECK, owner), undefined); eq(seen[0].payload, NO_DECK); eq(seen[0].owner, owner); deep(order, ['disconnect', 'connect'])
  })

  // ---- H. flag-off identity --------------------------------------------------------------------------------------------------------------------------------------------
  const mine = LATER_STRIPS.indexOf(strip.stripDuplicateAdopt)
  const withoutOthers = (rel, text) => LATER_STRIPS.filter((s, i) => i > mine).reduce((out, s) => (typeof s === 'function' ? s(rel, out) : out), text) // a change registered after this one comes out first
  await check('H: the strip is registered (files, block, strip), once each', () => {
    ok(mine >= 0); eq(LATER_STRIPS.filter(s => s === strip.stripDuplicateAdopt).length, 1); ok(LATER_ENV_BLOCKS.includes(strip.DUPLICATE_ADOPT_ENV_BLOCK))
    ok([...strip.DUPLICATE_ADOPT_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)))
  })
  for (const rel of strip.DUPLICATE_ADOPT_FILES) {
    await check(`H: ${rel} without its DUPLICATE-ADOPT lines is the base, byte for byte`, () => {
      const head = withoutOthers(rel, read(rel)), base = withoutOthers(rel, baseOf(rel))
      ok(!strip.DUPLICATE_ADOPT_MARKER_RE.test(baseOf(rel)), 'the base has no line with the marker')
      ok(head.split('\n').filter(MARKED).length > 0, 'it has marked lines')
      eq(sha(strip.stripDuplicateAdopt(rel, head)), sha(base))
      eq(sha(stripLaterChanges(rel, read(rel))), sha(stripLaterChanges(rel, baseOf(rel))), 'and through the registry, as every older pin reads it')
    })
  }
  await check('H: .env.example is the base plus the block (once, at a line start); through the registry it is the base', () => {
    const head = read('.env.example'), block = strip.DUPLICATE_ADOPT_ENV_BLOCK
    eq(head.split(block).length - 1, 1); ok(head.includes(`\n\n${block}`))
    eq(sha(stripLaterEnvBlocks('.env.example', head)), sha(stripLaterEnvBlocks('.env.example', baseOf('.env.example'))))
    const lines = block.trimEnd().split('\n'); ok(lines.slice(0, -1).every(line => line.startsWith('# ')) && lines.at(-1) === 'NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT="false"', 'comments, then the line, default "false"')
    ok(!/DUPLICATE_DECK|duplicate-deck/.test(block), 'the block never names the older flag literally (its own pins read for that name)')
  })
  await check('H: flag off, the duplicate flow is the base\'s: same requests, same result (hashed), final and strawman', async () => {
    for (const slot of ['final', 'strawman']) {
      const a = duplicateWorld(), b = duplicateWorld()
      const baseResult = await runDuplicate(baseOf(DUP), { slot, world: a })
      const headResult = await runDuplicate(dupText, { slot, world: b })
      eq(sha(JSON.stringify({ log: a.log, result: baseResult })), sha(JSON.stringify({ log: b.log, result: headResult })), slot)
    }
    const c = duplicateWorld(), d = duplicateWorld()
    const base = await runDuplicate(baseOf(DUP), { world: c }), on = await runDuplicate(dupText, { world: d, adopt: adoptVia(d) })
    const { adoption, ...rest } = on
    eq(sha(JSON.stringify(rest)), sha(JSON.stringify(base)), 'with the step on, the result is the base\'s plus `adoption`'); deep(d.log.slice(0, -1), c.log)
  })

  // ---- I. scope over this change's committed diff ------------------------------------------------------------------------------------------------------------------
  const own = []
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%H %s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [head, ...names] = block.split('\n')
    if (/^[0-9a-f]{40} Duplicate adopt: /.test(head)) own.push({ commit: head.slice(0, 40), names: names.filter(Boolean) })
  }
  if (own.length === 0 && extraCommitted.length === 0) {
    if (!quiet) console.log('SKIP I  nothing of this change committed on top of the base yet (the scope check reads BASE..HEAD only)')
  } else {
    await check('I: the committed diff of its own commits holds exactly its files', () => {
      const files = [...new Set([...own.flatMap(entry => entry.names), ...extraCommitted])].sort()
      deep(files, [...strip.DUPLICATE_ADOPT_SCOPE_FILES].sort())
      ok(!files.some(rel => /test-studio-p2-|launch-wording|env-append-tolerant|route-params|admin-email-guard|uat-marketing|test-studio-p2-docs|landing/.test(rel)), 'no FRONTEND-1 test')
    })
    await check('I: marked insertions only in the existing app files; the registry gains three LATER-CHANGE lines; .env.example only gains its block', () => {
      const added = rel => own.flatMap(entry => git('show', '-U0', '--format=', entry.commit, '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line)))
      for (const rel of strip.DUPLICATE_ADOPT_FILES) { const lines = added(rel); ok(lines.length > 0 && lines.every(line => line.startsWith('+') && MARKED(line)), rel) }
      const registry = added('scripts/studio-later-changes.mjs'); eq(registry.length, 3); ok(registry.every(line => line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-duplicate-adopt-strip.mjs')))
      const env = added('.env.example'); eq(env.filter(line => line.startsWith('-')).length, 0); eq(env.map(line => line.slice(1)).join('\n'), ['', ...strip.DUPLICATE_ADOPT_ENV_BLOCK.trimEnd().split('\n')].join('\n'))
    })
    for (const rel of strip.DUPLICATE_ADOPT_PIN_FILES) {
      await check(`I: ${rel} with its registry-read lines put back is its previous file`, () => {
        const head = read(rel), prev = git('show', `${BASE}:${rel}`)
        eq(sha(strip.putBackPin(rel, head)), sha(prev))
        for (const [has, was] of strip.DUPLICATE_ADOPT_PIN_EDITS[rel]) { eq(head.split(has).length - 1, 1); ok(has.endsWith('\n') && has.includes(strip.DUPLICATE_ADOPT_PIN_MARK) && has.split('\n').length === 2); ok(was === '' || prev.includes(was)) }
      })
    }
  }

  // ---- J. safety -------------------------------------------------------------------------------------------------------------------------------------------------------
  await check('J: no credential-shaped literal in the new files or the marked lines', () => {
    const CRED = /Bearer [A-Za-z0-9._-]{16,}|\bsk-[A-Za-z0-9]{16,}|\beyJ[A-Za-z0-9_-]{20,}|(?:api[_-]?key|secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s$]{8,}['"`]/i
    const texts = [...strip.DUPLICATE_ADOPT_NEW_FILES.map(rel => [rel, read(rel)]), ...strip.DUPLICATE_ADOPT_FILES.map(rel => [rel, read(rel).split('\n').filter(MARKED).join('\n')])]
    for (const [rel, text] of texts) { ok(!CRED.test(text), rel); if (rel !== 'scripts/test-studio-duplicate-adopt.mjs') ok(!/[A-Fa-f0-9]{40,}/.test(text) || rel === 'scripts/studio-duplicate-adopt-strip.mjs', `${rel}: no long hex`) }
  })
  await check('J: browser code never names the secret, the header or the minter; the route is server code and the only new importer of the minter', () => {
    const NAMES = /DIRECTOR_WS_AUTH_SECRET|X-Deckster-Entitlement|director-rest-entitlement|DECKSTER_REST_ENTITLEMENT|mintRestEntitlement/
    ok(!NAMES.test(read(LIB)), LIB)
    for (const rel of [DASH, BUILDER, HOOK, DUP]) ok(!NAMES.test(read(rel).split('\n').filter(MARKED).join('\n')), rel)
    const route = read(ROUTE)
    ok(!/['"]use client['"]/.test(route)); ok(!/\bconsole\./.test(route), 'never logs'); eq((route.match(/mintRestEntitlement\(/g) ?? []).length, 1); eq((route.match(/\bfetch\(/g) ?? []).length, 1)
    ok(/from '@\/lib\/director-rest-entitlement'/.test(route)); ok(!/process\.env\.DIRECTOR_WS_AUTH_SECRET/.test(route), 'the route never reads the secret itself')
    ok(route.indexOf("NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT !== 'true'") < route.indexOf('getServerSession('), 'the flag before the login')
    ok(route.indexOf('getServerSession(') < route.indexOf('mintRestEntitlement('), 'the login before the header')
    const importers = strip.DUPLICATE_ADOPT_NEW_FILES.filter(rel => /\.tsx?$/.test(rel) && /director-rest-entitlement/.test(read(rel))); deep(importers, [ROUTE])
  })
  await check('J: the folder keeps the sibling\'s slug name (Next allows one per level) and the route set grows by one', () => {
    const dir = path.join(root, 'app/api/director/sessions')
    deep(fs.readdirSync(dir).sort(), ['[sourceSessionId]']); deep(fs.readdirSync(path.join(dir, '[sourceSessionId]')).sort(), ['adopt-duplicate', 'handoff'])
    deep(fs.readdirSync(path.join(dir, '[sourceSessionId]', 'adopt-duplicate')), ['route.ts'])
    ok(/export async function POST\(/.test(read(ROUTE)) && !/export async function (GET|PUT|PATCH|DELETE)\(/.test(read(ROUTE)), 'POST only')
  })

  return { checks, failures }
}

// ---- run -------------------------------------------------------------------------------------------------------------------------------------------------------------
const main = await suite()
if (main.failures.length) {
  for (const failure of main.failures) console.error(`FAIL ${failure}`)
  console.error(`${main.failures.length} of ${main.checks} checks failed`)
  process.exit(1)
}
console.log(`PASS A-J  ${main.checks} checks`)

// ---- K. mutants: each must make the suite fail -------------------------------------------------------------------------------------------------------------------------
const MUTANTS = [
  ['route: the flag-off answer ignores the adopt flag', ROUTE, " || process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT !== 'true'", ''],
  ['route: the user id prefers the email', ROUTE, 'sessionUser?.id || sessionUser?.email', 'sessionUser?.email || sessionUser?.id'],
  ['route: the header waits for DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED', ROUTE, "entitlement = mintRestEntitlement({ sub: userId, method: 'POST' })", "entitlement = process.env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED === 'true' ? mintRestEntitlement({ sub: userId, method: 'POST' }) : null"],
  ['route: the claim is bound to GET', ROUTE, "mintRestEntitlement({ sub: userId, method: 'POST' })", "mintRestEntitlement({ sub: userId, method: 'GET' })"],
  ['route: the claim carries an extra (session) claim', ROUTE, "mintRestEntitlement({ sub: userId, method: 'POST' })", "mintRestEntitlement({ sub: userId, method: 'POST', bq: { sid: sessionId } })"],
  ['route: the Director\'s status is not passed through', ROUTE, 'return NextResponse.json(data, { status: response.status })', 'return NextResponse.json(data, { status: response.ok ? 200 : 500 })'],
  ['route: an unreachable Director is not retryable', ROUTE, "duplicateAdoptRefusal('DIRECTOR_UNREACHABLE', true)", "duplicateAdoptRefusal('DIRECTOR_UNREACHABLE', false)"],
  ['route: the session id is not checked', ROUTE, "  if (!isPlainAdoptId(sessionId)) {\n", "  if (false) {\n"],
  ['route: the login is read after the body', ROUTE, "  if (!userId) {\n    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })\n  }\n", '  if (false) {\n  }\n'],
  ['route: the body size is not capped', ROUTE, "    if (Buffer.byteLength(text, 'utf8') > DUPLICATE_ADOPT_BODY_MAX_BYTES) throw new Error('too large')\n", ''],
  ['lib: the browser body may carry more keys', LIB, "if (keys.length !== 1 || keys[0] !== 'presentation_id') return { ok: false }", "if (!keys.includes('presentation_id')) return { ok: false }"],
  ['lib: the Director body gains a key', LIB, 'return JSON.stringify({ user_id: userId, presentation_id: presentationId })', "return JSON.stringify({ user_id: userId, presentation_id: presentationId, source: 'studio' })"],
  ['lib: a non-retryable answer is retried', LIB, 'if (!outcome.retryable || delay === undefined) return outcome', 'if (delay === undefined) return outcome'],
  ['lib: an offline call is not retried', LIB, 'outcome = { ok: false, status: 0, code: null, retryable: true, attempts }', 'outcome = { ok: false, status: 0, code: null, retryable: false, attempts }'],
  ['lib: three retries', LIB, 'export const DUPLICATE_ADOPT_RETRY_DELAYS_MS = [1000, 2000] as const', 'export const DUPLICATE_ADOPT_RETRY_DELAYS_MS = [1000, 2000, 4000] as const'],
  ['lib: the open fallback acts on every sync_response', LIB, " || seen.has(sessionId)) return 'not-first'", ") return 'not-first'"],
  ['lib: the open fallback retries', LIB, ', retryDelaysMs: [] })', ' })'],
  ['lib: reused:true reconnects too', LIB, "      if (outcome.reused) return 'reused'\n", ''],
  ['lib: no marker needed', LIB, "      if (!readCopiedFrom(session)) return 'not-a-copy'\n", ''],
  ['lib: a strawman copy is adopted on open', LIB, 'return isPlainAdoptId(id) ? id : null', "return isPlainAdoptId(id) ? id : isPlainAdoptId((session as any)?.strawmanPresentationId) ? (session as any).strawmanPresentationId : null"],
  ['lib: has_strawman false with an id is "has a deck"', LIB, ' || hasStrawman === false', ''],
  ['lib: a dead socket is reconnected', LIB, "      if (!owner.isCurrent()) return 'not-current'\n", ''],
  ['dup lib: strawman copies are adopted', DUP, "const adopt = target.slot === 'final' ? deps.adopt : undefined", 'const adopt = deps.adopt'],
  ['dup lib: a throwing step 4 unwinds (deletes)', DUP, 'await Promise.resolve().then(() => adopt(newSessionId, copyId)).catch(() => ({ ok: false as const, status: 0, code: null, retryable: false, attempts: 0 }))', 'await adopt(newSessionId, copyId)'],
  ['dup lib: a failed adoption deletes the session', DUP, '    const patchedBody = await readBody(patched)\n', '    if (adoption && !adoption.ok) return await unfinished()\n    const patchedBody = await readBody(patched)\n'],
  ['dup lib: step 4 runs before the PATCH', DUP, '    const patched = await patchWithRetry(', "    if (deps.adopt && target.slot === 'final') await deps.adopt(newSessionId, copyId)\n    const patched = await patchWithRetry("],
  ['dup lib: step 4 does not wait (fire and forget)', DUP, '    const adoption = adopt ? await Promise', '    const adoption = adopt ? void Promise'],
  ['dup lib: the outcome is dropped from the result', DUP, '      ...(adoption ? { adoption } : {}), // DUPLICATE-ADOPT\n', ''],
  ['dashboard: the flag is read loosely', DASH, 'process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT === "true"', 'Boolean(process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT)'],
  ['dashboard: step 4 is passed with the flag off', DASH, '...(duplicateAdoptEnabled ? { adopt:', '...(true ? { adopt:'],
  ['dashboard: the note and the usual toast both show', DASH, 'description: DUPLICATE_ADOPT_PENDING_NOTE }); return } // DUPLICATE-ADOPT', 'description: DUPLICATE_ADOPT_PENDING_NOTE }) } // DUPLICATE-ADOPT'],
  ['dashboard: an unmarked line rides along', DASH, 'import { adoptDuplicateCopy, DUPLICATE_ADOPT_PENDING_NOTE } from "@/lib/studio-duplicate-adopt"', 'const stray = 1\nimport { adoptDuplicateCopy, DUPLICATE_ADOPT_PENDING_NOTE } from "@/lib/studio-duplicate-adopt"'],
  ['builder: the controller needs only the adopt flag', BUILDER, "const studioDuplicateAdoptOnOpen = process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK === 'true' && ", 'const studioDuplicateAdoptOnOpen = '],
  ['builder: the reconnect only connects', BUILDER, '() => { disconnect(); connect() }', '() => { connect() }'],
  ['hook: the tap ignores the flag', HOOK, "if (process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT === 'true' && parsedMessage.type === 'sync_response'", "if (parsedMessage.type === 'sync_response'"],
  ['hook: another session\'s frame is passed', HOOK, " && parsedMessage.session_id === socketSessionId) transportCallbacksRef.current.onDuplicateAdoptSync", ') transportCallbacksRef.current.onDuplicateAdoptSync'],
  ['env: the block says "true"', '.env.example', 'NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT="false"', 'NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT="true"'],
  ['fixture: one byte of a recorded answer changes', `${FIXTURES}/22-in-use-409.json`, '"retryable": false', '"retryable": true'],
  ['safety: a bearer literal in the route', ROUTE, "export const dynamic = 'force-dynamic'", `export const dynamic = 'force-dynamic'\n// ${['Bearer', 'x'.repeat(24)].join(' ')}`], // the literal is built at run time, so this file carries none
  ['safety: the browser lib names the minter', LIB, "import { readCopiedFrom } from '@/lib/studio-duplicate-deck'", "import { readCopiedFrom } from '@/lib/studio-duplicate-deck'\n// see director-rest-entitlement"],
]
let caught = 0
const missed = []
for (const [name, rel, from, to] of MUTANTS) {
  const text = read(rel)
  if (!text.includes(from)) { missed.push(`${name} (target text not found)`); continue }
  overrides = { [rel]: text.replace(from, () => to) }
  let outcome
  try { outcome = await suite({ quiet: true }) } catch (error) { outcome = { failures: [String(error)] } } finally { overrides = {} }
  if (outcome.failures.length > 0) caught++; else missed.push(name)
}
const scopeMutant = await suite({ quiet: true, extraCommitted: ['lib/some-other-change.ts'] })
if (scopeMutant.failures.length > 0) caught++; else missed.push('scope: a stray committed file')
if (missed.length) {
  for (const name of missed) console.error(`MUTANT NOT CAUGHT: ${name}`)
  process.exit(1)
}
console.log(`PASS K  ${caught} of ${MUTANTS.length + 1} mutants caught`)
console.log(`test-studio-duplicate-adopt: ${main.checks} checks, ${caught} mutants, all passed`)
