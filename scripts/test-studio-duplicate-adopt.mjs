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
//                 a failure (or a throwing step) never deletes the copy or the session; the Decks page shows the plain note instead of the usual toast. The PATCH's marker carries the copy's own id
//                 (final slot, adopt on only), and a 200 writes the one-time receipt into it (read-modify-write through the REAL /api/sessions/[id] route, a fake Prisma that skips undefined columns)
//   G. open       the Builder's backstop on "connected": the first connected of a session whose marker has the copy's id and no receipt calls the route ONCE, always with the MARKER's id (a drifted final slot
//                 is ignored); 200 writes the receipt and, on reused:false while that socket is live, reconnects (disconnect, then connect); the reconnect's own connected never calls again; no id in the
//                 marker, or a receipt: no call. The hook's ws.onopen block is the real one, run with stubs (flag, own session, stale socket). The Builder's autosave never sends currentStatus.
//   H. identity   flag off is the base: each existing file without its DUPLICATE-ADOPT lines is the base commit's, byte for byte (and through the registry); the base lib and this lib without the step give
//                 the same requests and result, hashed
//   I. scope      the committed diff of this change's own commits (subject "Duplicate adopt: ...") holds exactly its files; marked insertions only; the registry gains three lines
//   J. safety     no credential-shaped literal in its new files or marked lines; the browser code never names the secret, the header or the minter; the route is server code, the only new importer of the minter;
//                 its only log is one console.warn on PRESENTATION_NOT_OWNED (code, new session id, presentation id; never the user, the header or an env value)
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

/** The Studio route, called as Next calls it. `upstream(url, init, attempt)` is the Director. Every console call and every AbortSignal.timeout(ms) the route makes is recorded;
 *  `fireTimeout` makes that timeout fire (as the timer would after the wait) so an upstream that never answers is cut off. */
async function callRoute({ env = ENV_ON(), user = USER, sessionId = 'new-session-1', body = { presentation_id: 'copy-deck-1' }, raw, contentLength, upstream = answer('01-adopted-200'), fireTimeout = false } = {}) {
  const log = { sessions: 0, fetches: [], console: [], timeouts: [] }
  const stubs = {
    'next/server': { NextResponse },
    'next-auth': { getServerSession: async options => { log.sessions++; if (options !== AUTH_OPTIONS) throw new Error('auth options'); return user ? { user } : null } },
    '@/lib/auth-options': { authOptions: AUTH_OPTIONS },
  }
  const fetch = async (url, init) => { log.fetches.push({ url, init }); return upstream(url, init, log.fetches.length) }
  const fakeConsole = new Proxy({}, { get: (_, method) => (...args) => { log.console.push({ method: String(method), args }) } })
  const fakeSignal = { timeout: ms => { log.timeouts.push(ms); if (!fireTimeout) return AbortSignal.timeout(ms); const controller = new AbortController(); setImmediate(() => controller.abort(new Error('timed out'))); return controller.signal } }
  const route = loadTs(ROUTE, { env, stubs, globals: { fetch, console: fakeConsole, AbortSignal: fakeSignal } })
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

const SESSIONS_ROUTE = 'app/api/sessions/[id]/route.ts'
const DB_USER = { id: 'db-user-1', email: 'person@synthetic.invalid' }
/**
 * The sessions API: GET / PATCH / DELETE /api/sessions/{id} are the REAL route handlers (app/api/sessions/[id]/route.ts) over a fake Prisma that keeps rows in memory and applies a write the way Prisma does:
 * a column given as `undefined` is left as it is (that is how a PATCH without slideStructure leaves slideStructure alone). POST /api/sessions makes a row (stateCache null) the way the page does.
 */
function sessionsApi({ rows = new Map() } = {}) {
  const prisma = {
    user: { findUnique: async () => ({ id: DB_USER.id }) },
    chatSession: {
      findUnique: async ({ where, include }) => { const row = rows.get(where.id); return row ? { ...structuredClone(row), ...(include ? { messages: [] } : {}) } : null },
      update: async ({ where, data }) => {
        const row = rows.get(where.id), { stateCache, updatedAt, ...scalars } = data
        for (const [key, value] of Object.entries(scalars)) if (value !== undefined) row[key] = value
        if (stateCache?.upsert) {
          if (row.stateCache) { for (const [key, value] of Object.entries(stateCache.upsert.update)) if (value !== undefined) row.stateCache[key] = structuredClone(value) }
          else row.stateCache = Object.fromEntries(Object.entries(stateCache.upsert.create).map(([key, value]) => [key, value === undefined ? null : structuredClone(value)]))
        }
        row.updatedAt = 'synthetic-updated'
        const { stateCache: _cache, messages: _messages, ...scalar } = structuredClone(row)
        return scalar
      },
    },
  }
  const stubs = {
    'next/server': { NextResponse },
    'next-auth': { getServerSession: async () => ({ user: { email: DB_USER.email } }) },
    '@/lib/auth-options': { authOptions: AUTH_OPTIONS },
    '@/lib/prisma': { prisma },
  }
  const route = loadTs(SESSIONS_ROUTE, { stubs })
  const requestOf = init => ({ json: async () => JSON.parse(init.body) })
  const handle = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    if (url === '/api/sessions' && method === 'POST') {
      const body = JSON.parse(init.body)
      rows.set(body.sessionId, { id: body.sessionId, userId: DB_USER.id, status: 'active', title: body.title ?? null, createdAt: 'synthetic-created', updatedAt: 'synthetic-created', stateCache: null })
      return json(200, { session: { id: body.sessionId } })
    }
    const id = decodeURIComponent(url.slice('/api/sessions/'.length))
    const ctx = { params: Promise.resolve({ id }) }
    if (method === 'GET') return route.GET(requestOf(init), ctx)
    if (method === 'PATCH') return route.PATCH(requestOf(init), ctx)
    if (method === 'DELETE') return route.DELETE(requestOf(init), ctx)
    return json(405, {})
  }
  return { rows, handle }
}

/** A browser fetch for the duplicate flow: Layout, the sessions API (the real routes over a fake Prisma), and the Studio route (the real one, its Director answering from `directorAnswers` in turn). */
function duplicateWorld({ directorAnswers = ['01-adopted-200'], routeEnv = ENV_ON(), patchStatus = 200, rows } = {}) {
  const log = [], director = [], sleeps = [], patches = []
  const api = sessionsApi({ rows })
  const fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    log.push(`${method} ${url}`)
    if (url.endsWith('/duplicate')) return json(200, { success: true, id: 'copy-deck-1', presentation_id: 'copy-deck-1', url: '/p/copy-deck-1', presentation_url: '/p/copy-deck-1', slide_count: 5, reused: false })
    if (url === '/api/sessions/new-session-1' && method === 'PATCH' && patches.length === 0 && patchStatus !== 200) { patches.push(JSON.parse(init.body)); return json(patchStatus, { error: 'synthetic' }) }
    if (url.startsWith('/api/sessions') && method === 'PATCH') patches.push(JSON.parse(init.body))
    if (url.startsWith('/api/sessions')) return api.handle(url, init)
    if (url === '/api/director/sessions/new-session-1/adopt-duplicate' && method === 'POST') {
      const body = JSON.parse(init.body)
      const out = await callRoute({ env: routeEnv, body, upstream: (u, i) => { director.push({ url: u, body: JSON.parse(i.body) }); const name = directorAnswers[Math.min(director.length - 1, directorAnswers.length - 1)]; if (name === 'THROW') throw new Error('offline'); return answer(name)() } })
      return json(out.status, out.json)
    }
    return json(500, { error: 'unexpected' })
  }
  return { log, director, sleeps, patches, rows: api.rows, fetch, sleep: async ms => { sleeps.push(ms) } }
}
const TARGET = slot => ({ ok: true, slot, presentationId: 'source-deck-1', url: 'https://layout.synthetic.invalid/p/source-deck-1' })
const SOURCE = { sessionId: 'source-session-1', shownTitle: 'Q4 sales review', currentStage: 6, slideCount: 5 }
function runDuplicate(libText, { slot = 'final', world = duplicateWorld(), adopt } = {}) {
  const lib = loadTs(DUP, { text: libText })
  const ids = ['op-1', 'new-session-1']
  const deps = { fetch: world.fetch, layoutBaseUrl: () => 'https://layout.synthetic.invalid', newId: () => ids.shift(), now: () => new Date('2026-10-26T00:00:00.000Z'), sleep: world.sleep, ...(adopt ? { adopt } : {}) }
  return lib.runDuplicateDeck({ source: SOURCE, target: TARGET(slot), deps })
}
const NOW = new Date('2026-10-26T01:02:03.000Z')
const adoptVia = world => (sessionId, presentationId) => loadTs(LIB).adoptDuplicateCopyAndRecord({ sessionId, presentationId, fetch: world.fetch, sleep: world.sleep, now: () => NOW })

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
      ok(out.log.fetches[0].init.signal instanceof AbortSignal, 'a bounded wait'); deep(out.log.timeouts, [10_000], 'ten seconds a call')
      deep(out.log.console.map(entry => entry.method), name.startsWith('20-') ? ['warn'] : [], 'the route logs only PRESENTATION_NOT_OWNED')
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

  await check('B: the wait for the Director is 10 s a call (the constant and what the route passes); retries are two, at 1 s and 2 s', async () => {
    const lib = loadTs(LIB)
    eq(lib.DUPLICATE_ADOPT_UPSTREAM_TIMEOUT_MS, 10_000); deep([...lib.DUPLICATE_ADOPT_RETRY_DELAYS_MS], [1000, 2000])
    deep((await callRoute()).log.timeouts, [10_000]); ok(!/30_000|30000/.test(read(ROUTE)), 'no other wait in the route')
  })
  await check('B: a Director that does not answer in time is cut off: 502 DIRECTOR_UNREACHABLE, retryable (the repeat is safe: reused:true), and nothing is logged', async () => {
    const out = await callRoute({ fireTimeout: true, upstream: (u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))) })
    eq(out.status, 502); eq(out.json.code, 'DIRECTOR_UNREACHABLE'); eq(out.json.retryable, true); deep(out.log.timeouts, [10_000]); deep(out.log.console, [])
    ok(!/timed out/.test(JSON.stringify(out.json)), 'the internal error is not shown')
  })
  await check('B: PRESENTATION_NOT_OWNED logs ONE warn: the code, the new session id and the presentation id sent; never the user id or email, the header, the secret or the Director\'s host', async () => {
    const who = { id: 'user-id-ZZ9', email: 'zz9@synthetic.invalid' }
    const out = await callRoute({ user: who, sessionId: 'new-session-7', body: { presentation_id: 'copy-deck-7' }, upstream: answer('20-not-owned-403') })
    eq(out.status, 403); eq(out.json.code, 'PRESENTATION_NOT_OWNED')
    eq(out.log.console.length, 1); eq(out.log.console[0].method, 'warn'); eq(out.log.console[0].args.length, 1); const line = out.log.console[0].args[0]
    eq(line, '[DUPLICATE_ADOPT] PRESENTATION_NOT_OWNED session=new-session-7 presentation=copy-deck-7')
    const header = out.log.fetches[0].init.headers['X-Deckster-Entitlement']
    for (const secret of [who.id, who.email, header, header.split('.')[0], header.split('.')[1], SECRET, DIRECTOR, 'synthetic.invalid']) ok(!line.includes(secret), `no ${String(secret).slice(0, 12)}...`)
    const emailKeyed = await callRoute({ user: { email: who.email }, upstream: answer('20-not-owned-403') }); ok(!emailKeyed.log.console[0].args[0].includes(who.email))
    const many = await callRoute({ upstream: answer('20-not-owned-403') }); eq(many.log.console.length, 1, 'once per answer')
  })
  await check('B: no other answer logs, and neither does a refusal before the Director (bad body, no login, flag off, unreachable, not JSON)', async () => {
    for (const name of Object.keys(index).filter(n => !n.startsWith('20-'))) deep((await callRoute({ upstream: answer(name) })).log.console, [], name)
    for (const opts of [{ body: {} }, { user: null }, { env: ENV_ON({ NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'false' }) }, { upstream: () => { throw new Error('refused') } }, { upstream: () => new Response('<html>', { status: 503 }) }]) deep((await callRoute(opts)).log.console, [])
    const bad = await callRoute({ sessionId: 'bad/id', upstream: answer('20-not-owned-403') }); eq(bad.status, 400); deep(bad.log.console, [], 'an id that is not plain is refused before it could reach a log')
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
    deep(world.log, ['POST https://layout.synthetic.invalid/api/presentations/source-deck-1/duplicate', 'POST /api/sessions', 'PATCH /api/sessions/new-session-1', 'POST /api/director/sessions/new-session-1/adopt-duplicate', 'GET /api/sessions/new-session-1', 'PATCH /api/sessions/new-session-1'])
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
      ok(!('adoptedAt' in world.rows.get('new-session-1').stateCache.currentStatus.copiedFrom), 'a refusal writes no receipt'); eq(world.log.filter(line => line.startsWith('GET ')).length, 0)
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
  // the marker carries the copy's id; a 200 writes the receipt
  const MARKER = { sessionId: 'source-session-1', title: 'Q4 sales review' }
  await check('F: the step-3 PATCH marker carries the copy\'s own id (final slot, adopt on): exactly { sessionId, title, presentationId }', async () => {
    const world = duplicateWorld()
    await runDuplicate(dupText, { world, adopt: async () => ({ ok: false, status: 0, code: null, retryable: false, attempts: 0 }) })
    deep(world.patches[0].stateCache, { activeVersion: 'final', currentStatus: { copiedFrom: { ...MARKER, presentationId: 'copy-deck-1' } } })
    deep(Object.keys(world.patches[0].stateCache.currentStatus.copiedFrom), ['sessionId', 'title', 'presentationId'])
    eq(world.rows.get('new-session-1').finalPresentationId, 'copy-deck-1')
  })
  await check('F: no step 4 (flag off), or a strawman-slot copy: the marker is the base\'s { sessionId, title } and nothing more', async () => {
    const off = duplicateWorld(); await runDuplicate(dupText, { world: off })
    deep(off.patches[0].stateCache, { activeVersion: 'final', currentStatus: { copiedFrom: MARKER } })
    const straw = duplicateWorld(); await runDuplicate(dupText, { slot: 'strawman', world: straw, adopt: adoptVia(straw) })
    deep(straw.patches[0].stateCache, { activeVersion: 'strawman', currentStatus: { copiedFrom: MARKER } })
    ok(!JSON.stringify(straw.patches[0].stateCache).includes('presentationId'), 'no id in a strawman copy\'s marker')
  })
  await check('F: a 200 writes the one-time receipt (adoptedAt, ISO) into the marker; the rest of the marker and of currentStatus is kept', async () => {
    const world = duplicateWorld()
    const adopt = async (sessionId, presentationId) => { world.rows.get(sessionId).stateCache.currentStatus.keep = { me: true }; return adoptVia(world)(sessionId, presentationId) }
    const result = await runDuplicate(dupText, { world, adopt })
    deep(result.adoption, { ok: true, reused: false, attempts: 1 })
    const stored = world.rows.get('new-session-1').stateCache
    deep(stored.currentStatus, { copiedFrom: { ...MARKER, presentationId: 'copy-deck-1', adoptedAt: NOW.toISOString() }, keep: { me: true } }); eq(stored.activeVersion, 'final')
    deep(JSON.parse(JSON.stringify(world.patches.at(-1))), { stateCache: { currentStatus: stored.currentStatus } }); ok(!('slideStructure' in world.patches.at(-1).stateCache) && !('activeVersion' in world.patches.at(-1).stateCache), 'the receipt PATCH sends currentStatus only')
  })
  await check('F: a reused:true answer writes the receipt too; a receipt already there is not rewritten', async () => {
    const world = duplicateWorld({ directorAnswers: ['03-repeat-200-reused'] })
    const result = await runDuplicate(dupText, { world, adopt: adoptVia(world) }); deep(result.adoption, { ok: true, reused: true, attempts: 1 })
    eq(world.rows.get('new-session-1').stateCache.currentStatus.copiedFrom.adoptedAt, NOW.toISOString())
    const lib = loadTs(LIB), before = JSON.stringify([...world.rows]), patches = world.patches.length
    eq(await lib.recordAdoptReceipt({ sessionId: 'new-session-1', presentationId: 'copy-deck-1', fetch: world.fetch, now: () => new Date('2030-01-01T00:00:00.000Z') }), 'already')
    eq(JSON.stringify([...world.rows]), before); eq(world.patches.length, patches)
  })
  await check('F: no receipt is written for another id, a row that is not a copy, a failed read, or a failed write; the adoption\'s outcome never changes', async () => {
    const lib = loadTs(LIB), world = duplicateWorld(); await runDuplicate(dupText, { world, adopt: async () => ({ ok: false, status: 0, code: null, retryable: false, attempts: 0 }) })
    const write = (id, fetch = world.fetch) => lib.recordAdoptReceipt({ sessionId: id, presentationId: 'copy-deck-1', fetch, now: () => NOW })
    eq(await lib.recordAdoptReceipt({ sessionId: 'new-session-1', presentationId: 'another-deck', fetch: world.fetch, now: () => NOW }), 'skipped')
    world.rows.set('plain-session', { id: 'plain-session', userId: DB_USER.id, status: 'active', stateCache: { currentStatus: { status: 'idle' }, activeVersion: 'final', slideStructure: null } }); eq(await write('plain-session'), 'skipped')
    eq(await write('missing-session'), 'failed'); eq(await write('new-session-1', async (url, init) => (init?.method === 'PATCH' ? json(500, {}) : world.fetch(url, init))), 'failed')
    eq(await write('new-session-1', async () => { throw new Error('offline') }), 'failed')
    ok(!('adoptedAt' in world.rows.get('new-session-1').stateCache.currentStatus.copiedFrom), 'nothing was written')
    const flaky = duplicateWorld(); const out = await runDuplicate(dupText, { world: flaky, adopt: (sessionId, presentationId) => loadTs(LIB).adoptDuplicateCopyAndRecord({ sessionId, presentationId, sleep: flaky.sleep, now: () => NOW, fetch: async (url, init) => (init?.method === 'PATCH' ? json(500, {}) : flaky.fetch(url, init)) }) })
    deep(out.adoption, { ok: true, reused: false, attempts: 1 }); ok(!('adoptedAt' in flaky.rows.get('new-session-1').stateCache.currentStatus.copiedFrom))
  })
  await check('F: a Builder autosave between the receipt\'s read and write is not undone (the receipt PATCH leaves slideStructure and activeVersion alone)', async () => {
    const world = duplicateWorld(); await runDuplicate(dupText, { world, adopt: async () => ({ ok: false, status: 0, code: null, retryable: false, attempts: 0 }) })
    const autosave = { currentStage: 6, slideCount: 7, lastMessageAt: '2026-10-26T00:00:09.000Z', finalPresentationUrl: 'https://layout.synthetic.invalid/p/copy-deck-1', finalPresentationId: 'copy-deck-1', stateCache: { activeVersion: 'final', slideStructure: [{ id: 'slide-9' }] } }
    let raced = false
    const fetch = async (url, init = {}) => { if (init.method === 'PATCH' && !raced) { raced = true; await world.fetch(url, { method: 'PATCH', headers: init.headers, body: JSON.stringify(autosave) }) } return world.fetch(url, init) }
    eq(await loadTs(LIB).recordAdoptReceipt({ sessionId: 'new-session-1', presentationId: 'copy-deck-1', fetch, now: () => NOW }), 'written')
    const stored = world.rows.get('new-session-1').stateCache
    deep(stored.slideStructure, [{ id: 'slide-9' }]); eq(stored.activeVersion, 'final'); eq(stored.currentStatus.copiedFrom.adoptedAt, NOW.toISOString()); eq(world.rows.get('new-session-1').slideCount, 7)
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
    const make = enabled => evalLine(`module.exports = {\n${line}\n}`, ['duplicateAdoptEnabled', 'adoptDuplicateCopyAndRecord', 'fetch', 'setTimeout'], [enabled, stub, async () => json(200, {}), (fn) => fn()])
    deep(Object.keys(make(false)), [])
    const deps = make(true); deep(Object.keys(deps), ['adopt'])
    await deps.adopt('new-session-1', 'copy-deck-1')
    eq(seen[0].sessionId, 'new-session-1'); eq(seen[0].presentationId, 'copy-deck-1'); eq(typeof seen[0].fetch, 'function'); ok(seen[0].now() instanceof Date, 'with the clock for the receipt'); await seen[0].sleep(5)
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

  // ---- G. the Builder-open backstop, on "connected" -----------------------------------------------------------------------------------------------------------------------
  const copyRow = ({ marker = { ...MARKER, presentationId: 'copy-deck-1' }, final = 'copy-deck-1', status = {}, ...extra } = {}) => ({
    id: 'new-session-1', userId: DB_USER.id, status: 'active', title: 'Q4 sales review (copy)', createdAt: 'synthetic-created', updatedAt: 'synthetic-created',
    finalPresentationId: final, finalPresentationUrl: final ? `https://layout.synthetic.invalid/p/${final}` : null, strawmanPresentationId: null,
    stateCache: { activeVersion: 'final', slideStructure: [{ id: 'slide-1' }], currentStatus: marker ? { copiedFrom: marker, ...status } : { ...status } }, ...extra,
  })
  function openWorld({ row = copyRow(), noRow = false, directorAnswers = ['01-adopted-200'] } = {}) {
    const log = [], director = []
    const api = sessionsApi({ rows: new Map(noRow ? [] : [[row.id, row]]) })
    const fetch = async (url, init = {}) => {
      log.push(`${init.method ?? 'GET'} ${url}`)
      if (url.startsWith('/api/sessions/')) return api.handle(url, init)
      if (url === '/api/director/sessions/new-session-1/adopt-duplicate') {
        const out = await callRoute({ body: JSON.parse(init.body), upstream: (u, i) => { director.push(JSON.parse(i.body)); return answer(directorAnswers[Math.min(director.length - 1, directorAnswers.length - 1)])() } })
        return json(out.status, out.json)
      }
      return json(500, {})
    }
    const controller = loadTs(LIB).createDuplicateAdoptOnOpen({ fetch, now: () => NOW })
    const reconnects = []
    const connected = ({ sessionId = 'new-session-1', current = true, reconnect = () => reconnects.push(sessionId) } = {}) => controller.onConnected({ sessionId, isCurrent: () => current }, reconnect)
    return { log, director, reconnects, connected, rows: api.rows, api, fetch }
  }
  const storedOf = w => w.rows.get('new-session-1').stateCache
  const RECEIPT_LOG = ['GET /api/sessions/new-session-1', 'POST /api/director/sessions/new-session-1/adopt-duplicate', 'GET /api/sessions/new-session-1', 'PATCH /api/sessions/new-session-1']
  await check('G: a copy with the marker\'s id and no receipt: ONE call on the first connected, the receipt is written, then one reconnect (disconnect, connect is the Builder\'s)', async () => {
    const w = openWorld(); eq(await w.connected(), 'reconnected')
    deep(w.log, RECEIPT_LOG); deep(w.director, [{ user_id: USER.id, presentation_id: 'copy-deck-1' }]); deep(w.reconnects, ['new-session-1'])
    deep(storedOf(w).currentStatus, { copiedFrom: { ...MARKER, presentationId: 'copy-deck-1', adoptedAt: NOW.toISOString() } })
  })
  await check('G: the reconnect\'s own connected, and every later one, never calls again (no loop), even though the receipt is already written', async () => {
    const w = openWorld(); eq(await w.connected(), 'reconnected')
    for (let i = 0; i < 3; i++) { eq(await w.connected(), 'not-first'); eq(w.log.length, RECEIPT_LOG.length); eq(w.director.length, 1) }
    deep(w.reconnects, ['new-session-1'])
  })
  await check('G: the call is made at most once per session per tab even when the receipt cannot be written (a repeat would only be reused:true)', async () => {
    const w = openWorld(), real = w.fetch
    const lib = loadTs(LIB), log = []
    const controller = lib.createDuplicateAdoptOnOpen({ fetch: async (url, init = {}) => { log.push(`${init.method ?? 'GET'} ${url}`); return init.method === 'PATCH' ? json(500, {}) : real(url, init) }, now: () => NOW })
    const reconnects = []; const open = () => controller.onConnected({ sessionId: 'new-session-1', isCurrent: () => true }, () => reconnects.push(1))
    eq(await open(), 'reconnected'); const calls = w.director.length; eq(await open(), 'not-first'); eq(await open(), 'not-first'); eq(w.director.length, calls); eq(reconnects.length, 1)
  })
  await check('G: the MARKER\'s id is adopted: a final slot the Director\'s blank canvas overwrote is ignored', async () => {
    const w = openWorld({ row: copyRow({ final: 'blank-canvas-9' }) }); eq(await w.connected(), 'reconnected')
    deep(w.director, [{ user_id: USER.id, presentation_id: 'copy-deck-1' }])
    const w2 = openWorld({ row: copyRow({ final: null, strawmanPresentationId: 'strawman-deck-3' }) }); eq(await w2.connected(), 'reconnected'); deep(w2.director, [{ user_id: USER.id, presentation_id: 'copy-deck-1' }])
  })
  await check('G: end to end: step 4 failed at duplicate time, the Builder\'s autosave wrote the blank canvas into the final slot, the backstop still adopts the copy', async () => {
    const world = duplicateWorld({ directorAnswers: ['27-store-unavailable-503', '27-store-unavailable-503', '27-store-unavailable-503', '01-adopted-200'] })
    const result = await runDuplicate(dupText, { world, adopt: adoptVia(world) }); eq(result.adoption.ok, false); eq(result.adoption.attempts, 3)
    await world.fetch('/api/sessions/new-session-1', { method: 'PATCH', headers: {}, body: JSON.stringify({ currentStage: 6, finalPresentationUrl: 'https://layout.synthetic.invalid/p/blank-canvas-9', finalPresentationId: 'blank-canvas-9', stateCache: { activeVersion: 'final', slideStructure: [{ id: 'blank' }] } }) })
    eq(world.rows.get('new-session-1').finalPresentationId, 'blank-canvas-9')
    const reconnects = []; const controller = loadTs(LIB).createDuplicateAdoptOnOpen({ fetch: world.fetch, now: () => NOW })
    eq(await controller.onConnected({ sessionId: 'new-session-1', isCurrent: () => true }, () => reconnects.push(1)), 'reconnected')
    eq(world.director.length, 4); deep(world.director[3].body, { user_id: USER.id, presentation_id: 'copy-deck-1' }); eq(reconnects.length, 1)
    eq(world.rows.get('new-session-1').stateCache.currentStatus.copiedFrom.adoptedAt, NOW.toISOString()); deep(world.rows.get('new-session-1').stateCache.slideStructure, [{ id: 'blank' }])
  })
  await check('G: a copy adopted at duplicate time has the receipt: nothing is called on open', async () => {
    const world = duplicateWorld(); await runDuplicate(dupText, { world, adopt: adoptVia(world) }); eq(world.director.length, 1)
    const controller = loadTs(LIB).createDuplicateAdoptOnOpen({ fetch: world.fetch, now: () => NOW }), reconnects = []
    eq(await controller.onConnected({ sessionId: 'new-session-1', isCurrent: () => true }, () => reconnects.push(1)), 'already-adopted'); eq(world.director.length, 1); deep(reconnects, [])
  })
  await check('G: no presentationId in the marker (a copy made before this change, a strawman copy): no call, whatever the final slot says', async () => {
    for (const [label, row] of [['old copy', copyRow({ marker: MARKER })], ['strawman copy', copyRow({ marker: MARKER, final: null, strawmanPresentationId: 'copy-deck-1' })], ['id not plain', copyRow({ marker: { ...MARKER, presentationId: 'https://layout.synthetic.invalid/p/x' } })], ['id empty', copyRow({ marker: { ...MARKER, presentationId: '' } })], ['id a number', copyRow({ marker: { ...MARKER, presentationId: 5 } })]]) {
      const w = openWorld({ row }); eq(await w.connected(), 'no-copy-id', label); deep(w.log, ['GET /api/sessions/new-session-1'], label); deep(w.reconnects, [], label)
    }
  })
  await check('G: a receipt in the marker: no call (blank, or not a string, is not a receipt)', async () => {
    const w = openWorld({ row: copyRow({ marker: { ...MARKER, presentationId: 'copy-deck-1', adoptedAt: '2026-10-25T12:00:00.000Z' } }) }); eq(await w.connected(), 'already-adopted'); deep(w.log, ['GET /api/sessions/new-session-1'])
    for (const adoptedAt of ['', '  ', 5, null, {}]) { const x = openWorld({ row: copyRow({ marker: { ...MARKER, presentationId: 'copy-deck-1', adoptedAt } }) }); eq(await x.connected(), 'reconnected', JSON.stringify(adoptedAt)) }
  })
  await check('G: 200 reused:true writes the receipt but does not reconnect', async () => {
    const w = openWorld({ directorAnswers: ['03-repeat-200-reused'] }); eq(await w.connected(), 'reused'); deep(w.reconnects, []); deep(w.log, RECEIPT_LOG); eq(storedOf(w).currentStatus.copiedFrom.adoptedAt, NOW.toISOString())
  })
  for (const name of ['25-layout-unavailable-502', '27-store-unavailable-503', '20-not-owned-403', '23-session-not-fresh-409', '30-flag-off-404', '21-not-a-duplicate-422']) {
    await check(`G: ${name}: one call only (no retry on open), no receipt, no reconnect`, async () => {
      const w = openWorld({ directorAnswers: [name] }); eq(await w.connected(), 'failed'); eq(w.director.length, 1); deep(w.reconnects, []); deep(w.log, RECEIPT_LOG.slice(0, 2)); ok(!('adoptedAt' in storedOf(w).currentStatus.copiedFrom))
    })
  }
  await check('G: not a copy (no marker), no row, an unreadable row, or an id that is not plain: no call', async () => {
    const a = openWorld({ row: copyRow({ marker: null }) }); eq(await a.connected(), 'not-a-copy'); deep(a.log, ['GET /api/sessions/new-session-1'])
    const b = openWorld({ noRow: true }); eq(await b.connected(), 'not-a-copy'); deep(b.log, ['GET /api/sessions/new-session-1'])
    const c = openWorld({ row: copyRow({ marker: { sessionId: '', title: 'T', presentationId: 'copy-deck-1' } }) }); eq(await c.connected(), 'not-a-copy')
    const d = openWorld(); eq(await d.connected({ sessionId: 'a/b' }), 'not-a-copy'); deep(d.log, [])
    const e = openWorld(); eq(await e.connected({ sessionId: '' }), 'not-first'); deep(e.log, [])
  })
  await check('G: a socket that is no longer live is not reconnected (the receipt is still written); a reconnect that throws is a failure, not a crash', async () => {
    const a = openWorld(); eq(await a.connected({ current: false }), 'not-current'); deep(a.reconnects, []); eq(storedOf(a).currentStatus.copiedFrom.adoptedAt, NOW.toISOString())
    const b = openWorld(); eq(await b.connected({ reconnect: () => { throw new Error('boom') } }), 'failed')
  })
  await check('G: each session is acted on once per tab, separately', async () => {
    const w = openWorld(); eq(await w.connected({ sessionId: 'other-session' }), 'not-a-copy'); eq(await w.connected(), 'reconnected'); eq(await w.connected({ sessionId: 'other-session' }), 'not-first')
  })
  await check('G: the hook\'s real ws.onopen block tells the caller once per open: after the connected state is set, for its own session, current sockets only, flag on only', () => {
    const hook = read(HOOK), from = hook.indexOf('ws.onopen = () => {'), to = hook.indexOf('ws.onmessage = (event) => {', from)
    ok(from > 0 && to > from, 'the onopen block is there'); const block = hook.slice(from, to)
    eq(block.split('\n').filter(MARKED).length, 1, 'one marked line in the block'); ok(hook.includes('const isCurrentSocket = () => wsRef.current === ws && isCurrentAttempt();'))
    const NAMES = ['process', 'ws', 'isCurrentSocket', 'debugLog', 'expiresInSeconds', 'scheduleAuthRefresh', 'socketSessionRef', 'socketSessionId', 'setConnectionGeneration', 'clearReconnectTimer', 'reconnectPausedForOfflineRef', 'setReconnectStatus', 'reconnectAttemptsRef', 'clearReconnectStabilityTimer', 'reconnectStabilityTimeoutRef', 'DIRECTOR_RECONNECT_STABILITY_MS', 'wsRef', 'WebSocket', 'isConnectingRef', 'hasConnectedRef', 'startHeartbeat', 'setState', 'transportCallbacksRef']
    const open = ({ env, current = true, withCallback = true, sessionId = 'new-session-1' } = {}) => {
      const order = [], told = []; let state = { connected: false, connectionState: 'disconnected', error: new Error('old') }
      const ws = { close: () => order.push('close') }
      const values = [{ env }, ws, () => current, () => {}, null, () => {}, { current: null }, sessionId, () => order.push('generation'), () => {}, { current: true }, () => {}, { current: 0 }, () => {}, { current: undefined }, 3000, { current: ws }, { OPEN: 1 }, { current: true }, { current: false }, () => {}, update => { order.push('setState'); state = update(state) }, { current: withCallback ? { onDuplicateAdoptConnected: owner => { order.push('told'); told.push({ sessionId: owner.sessionId, current: owner.isCurrent() }) } } : {} }]
      evalLine(`${block}\nmodule.exports = ws.onopen`, NAMES, values)(); return { order, told, state }
    }
    const on = open({ env: { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' } })
    deep(on.told, [{ sessionId: 'new-session-1', current: true }]); eq(on.state.connectionState, 'connected'); eq(on.state.connected, true); ok(on.order.indexOf('told') > on.order.indexOf('setState'), 'after the connected state is set'); eq(on.order.at(-1), 'told')
    deep(open({ env: { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }, sessionId: 'other-session' }).told, [{ sessionId: 'other-session', current: true }], 'it is told the socket\'s own session')
    deep(open({ env: {} }).told, []); deep(open({ env: { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'TRUE' } }).told, []); deep(open({ env: { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }, withCallback: false }).told, [])
    const stale = open({ env: { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }, current: false }); deep(stale.told, [], 'a superseded socket tells no one'); deep(stale.order, ['close'])
    const first = open({ env: { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' } }), second = open({ env: { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' } }); deep(first.told, second.told, 'every open tells (a reconnect opens again): the caller acts on a session\'s first only')
    ok(!read(HOOK).includes('onDuplicateAdoptSync') && !read(BUILDER).includes('onDuplicateAdoptSync') && !read(BUILDER).includes('DuplicateAdoptSyncOwner'), 'nothing keys on sync_response any more')
    eq(read(HOOK).split('\n').filter(MARKED).length, 3, 'three marked lines in the hook (a comment, the option, the call)')
    ok(read(HOOK).includes("  onDuplicateAdoptConnected?: (owner: { sessionId: string; isCurrent: () => boolean }) => void; // DUPLICATE-ADOPT\n"), 'the option type')
  })
  await check('G: the Builder makes one controller per tab, only with both flags on, and gives it the clock', () => {
    const line = lineWith(BUILDER, 'const studioDuplicateAdoptOnOpen =')
    const made = []
    const run = env => evalLine(`${line}\nmodule.exports = studioDuplicateAdoptOnOpen`, ['process', 'createDuplicateAdoptOnOpen', 'fetch'], [{ env }, deps => { made.push(deps); return { onConnected: () => {} } }, async () => json(200, {})])
    ok(run({ NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true', NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }) !== null); eq(made.length, 1); eq(typeof made[0].fetch, 'function'); ok(made[0].now() instanceof Date)
    for (const env of [{}, { NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true' }, { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }, { NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true', NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'yes' }]) eq(run(env), null)
    eq(made.length, 1)
    ok(line.startsWith('const studioDuplicateAdoptOnOpen = '), 'module scope (not inside a component)')
  })
  await check('G: the Builder hands the socket the callback only with the controller; the reconnect is disconnect then connect', async () => {
    const line = lineWith(BUILDER, 'onDuplicateAdoptConnected:')
    const page = read(BUILDER), at = page.indexOf(line)
    ok(at > page.indexOf('} = useDecksterWebSocketV2({') && at < page.indexOf('onBuildPhase: (payload, ownerSessionId) =>', at), 'in the socket\'s options')
    const order = [], seen = []
    const make = controller => evalLine(`module.exports = {\n${line}\n}`, ['studioDuplicateAdoptOnOpen', 'disconnect', 'connect'], [controller, () => order.push('disconnect'), () => order.push('connect')])
    deep(Object.keys(make(null)), [])
    const options = make({ onConnected: (owner, reconnect) => { seen.push(owner); reconnect(); return Promise.resolve('reconnected') } })
    deep(Object.keys(options), ['onDuplicateAdoptConnected'])
    const owner = { sessionId: 'new-session-1', isCurrent: () => true }
    eq(options.onDuplicateAdoptConnected(owner), undefined); eq(seen[0], owner); deep(order, ['disconnect', 'connect'])
  })
  await check('G: Builder autosave cannot drop the marker or the receipt: it sends stateCache { activeVersion, slideStructure } and never currentStatus; the real PATCH route leaves currentStatus alone', async () => {
    const page = read(BUILDER), start = page.indexOf('onSessionStateChange: (state) => {'), end = page.indexOf('    onMessage: (message) => {', start)
    ok(start > 0 && end > start); const region = page.slice(start, end)
    ok(!/currentStatus/.test(region), 'the autosave never names currentStatus')
    const literal = region.match(/const updates: any = \{[\s\S]*?\n        \}\n/)?.[0]; ok(literal, 'the autosave body')
    const updates = evalLine(`${literal}\nmodule.exports = updates`, ['state', 'nextSlideCount'], [{ currentStage: 6, activeVersion: 'final', slideStructure: [{ id: 'slide-2' }], presentationUrl: 'https://layout.synthetic.invalid/p/blank-canvas-9', presentationId: 'blank-canvas-9' }, 5])
    deep(Object.keys(updates.stateCache), ['activeVersion', 'slideStructure'])
    const w = openWorld({ row: copyRow({ marker: { ...MARKER, presentationId: 'copy-deck-1', adoptedAt: NOW.toISOString() }, status: { keep: 1 } }) })
    const before = JSON.stringify(storedOf(w).currentStatus)
    const res = await w.fetch('/api/sessions/new-session-1', { method: 'PATCH', headers: {}, body: JSON.stringify({ ...updates, lastMessageAt: new Date('2026-10-26T00:00:00.000Z').toISOString(), finalPresentationId: 'blank-canvas-9' }) })
    eq(res.status, 200); eq(JSON.stringify(storedOf(w).currentStatus), before, 'marker, receipt and the rest of currentStatus survive'); deep(storedOf(w).slideStructure, [{ id: 'slide-2' }])
    const create = await sessionsApi({ rows: new Map([['fresh', { id: 'fresh', userId: DB_USER.id, status: 'active', stateCache: null }]]) }).handle('/api/sessions/fresh', { method: 'PATCH', body: JSON.stringify({ stateCache: { activeVersion: 'final' } }) }); eq(create.status, 200)
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
      const hashed = (world, result) => sha(JSON.stringify({ log: world.log, bodies: world.patches, rows: [...world.rows], result }))
      eq(hashed(a, baseResult), hashed(b, headResult), slot)
    }
    const c = duplicateWorld(), d = duplicateWorld()
    const base = await runDuplicate(baseOf(DUP), { world: c }), on = await runDuplicate(dupText, { world: d, adopt: adoptVia(d) })
    const { adoption, ...rest } = on
    eq(sha(JSON.stringify(rest)), sha(JSON.stringify(base)), 'with the step on, the result is the base\'s plus `adoption`'); deep(d.log.slice(0, c.log.length), c.log)
    deep(d.log.slice(c.log.length), ['POST /api/director/sessions/new-session-1/adopt-duplicate', 'GET /api/sessions/new-session-1', 'PATCH /api/sessions/new-session-1'], 'then the adoption and its receipt')
    const [basePatch, onPatch] = [c.patches[0], d.patches[0]]
    deep({ ...onPatch, stateCache: { ...onPatch.stateCache, currentStatus: { copiedFrom: { sessionId: onPatch.stateCache.currentStatus.copiedFrom.sessionId, title: onPatch.stateCache.currentStatus.copiedFrom.title } } } }, basePatch, 'the step-3 body is the base\'s except the marker\'s id')
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
      const added = rel => git('diff', '-U0', BASE, own[0].commit, '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line)) // the net committed diff, base to this change's newest commit (a line it added and later reworded is one added line)
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
    ok(!/['"]use client['"]/.test(route)); deep(route.split('\n').filter(line => !line.trim().startsWith('//')).join('\n').match(/\bconsole\.\w+/g), ['console.warn'], 'its only log is one console.warn'); ok(!/\bconsole\./.test(read(LIB)), 'the lib never logs'); eq((route.match(/mintRestEntitlement\(/g) ?? []).length, 1); eq((route.match(/\bfetch\(/g) ?? []).length, 1)
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
  ['lib: the open backstop acts on every connected', LIB, " || seen.has(sessionId)) return 'not-first'", ") return 'not-first'"],
  ['lib: the open fallback retries', LIB, ', retryDelaysMs: [] })', ' })'],
  ['lib: reused:true reconnects too', LIB, "      if (outcome.reused) return 'reused'\n", ''],
  ['lib: no marker needed', LIB, "      if (!marker) return 'not-a-copy'\n", ''],
  ['lib: the backstop adopts with the row\'s final slot id (the marker\'s id is ignored)', LIB, 'presentationId: marker.presentationId, fetch: deps.fetch, sleep: async () => {}', 'presentationId: String((session as any).finalPresentationId ?? marker.presentationId), fetch: deps.fetch, sleep: async () => {}'],
  ['lib: the backstop adopts with the row\'s final slot id when the marker has none', LIB, "      if (!marker.presentationId) return 'no-copy-id'\n", "      if (!marker.presentationId) marker.presentationId = (session as any).finalPresentationId ?? null\n"],
  ['lib: the backstop calls without a marker id', LIB, "      if (!marker.presentationId) return 'no-copy-id'\n", ''],
  ['lib: a receipt does not stop the backstop', LIB, "      if (marker.adoptedAt) return 'already-adopted'\n", ''],
  ['lib: the backstop writes no receipt', LIB, "      await recordAdoptReceipt({ sessionId, presentationId: marker.presentationId, fetch: deps.fetch, now: deps.now })\n", ''],
  ['lib: the backstop reconnects after reused:true too', LIB, "      if (outcome.reused) return 'reused'\n", ''],
  ['lib: the backstop never reconnects', LIB, "      reconnect()\n      return 'reconnected'", "      return 'reconnected'"],
  ['lib: a marker with a blank receipt counts as adopted', LIB, "adoptedAt: typeof marker.adoptedAt === 'string' && marker.adoptedAt.trim() ? marker.adoptedAt : null", 'adoptedAt: marker.adoptedAt === undefined ? null : (marker.adoptedAt as string | null)'],
  ['lib: the receipt PATCH sends the stale slideStructure and activeVersion too', LIB, 'body: JSON.stringify({ stateCache: { currentStatus:', 'body: JSON.stringify({ stateCache: { activeVersion: session.stateCache.activeVersion, slideStructure: session.stateCache.slideStructure, currentStatus:'],
  ['lib: the receipt drops the rest of currentStatus', LIB, '{ currentStatus: { ...status, copiedFrom:', '{ currentStatus: { copiedFrom:'],
  ['lib: the receipt drops the rest of the marker', LIB, 'copiedFrom: { ...status.copiedFrom, [DUPLICATE_ADOPT_RECEIPT_KEY]', 'copiedFrom: { [DUPLICATE_ADOPT_RECEIPT_KEY]'],
  ['lib: the receipt is rewritten when there already is one', LIB, "    if (marker.adoptedAt) return 'already'\n", ''],
  ['lib: the receipt is written for another id', LIB, "if (!marker || marker.presentationId !== presentationId) return 'skipped'", "if (!marker) return 'skipped'"],
  ['lib: the receipt is not an ISO time', LIB, '[DUPLICATE_ADOPT_RECEIPT_KEY]: now().toISOString()', '[DUPLICATE_ADOPT_RECEIPT_KEY]: String(now().getTime())'],
  ['lib: step 4 writes no receipt', LIB, "  if (outcome.ok) await recordAdoptReceipt({ sessionId: input.sessionId, presentationId: input.presentationId, fetch: input.fetch, now })\n", ''],
  ['lib: step 4 writes the receipt after a refusal too', LIB, '  if (outcome.ok) await recordAdoptReceipt({', '  if (true) await recordAdoptReceipt({'],
  ['lib: step 4 fails when the receipt cannot be written', LIB, "  if (outcome.ok) await recordAdoptReceipt({ sessionId: input.sessionId, presentationId: input.presentationId, fetch: input.fetch, now })\n", "  if (outcome.ok && (await recordAdoptReceipt({ sessionId: input.sessionId, presentationId: input.presentationId, fetch: input.fetch, now })) === 'failed') return { ok: false, status: 0, code: null, retryable: false, attempts: outcome.attempts }\n"],
  ['lib: the wait for the Director is 30 s', LIB, 'DUPLICATE_ADOPT_UPSTREAM_TIMEOUT_MS = 10_000', 'DUPLICATE_ADOPT_UPSTREAM_TIMEOUT_MS = 30_000'],
  ['lib: the log line leaves out the presentation id', LIB, ' presentation=${presentationId}`', '`'],
  ['lib: the log line names the wrong code', LIB, '`[DUPLICATE_ADOPT] ${DUPLICATE_ADOPT_NOT_OWNED_CODE} session=', '`[DUPLICATE_ADOPT] ADOPT_FAILED session='],
  ['route: the wait for the Director is hard-coded to 30 s', ROUTE, 'AbortSignal.timeout(DUPLICATE_ADOPT_UPSTREAM_TIMEOUT_MS)', 'AbortSignal.timeout(30_000)'],
  ['route: no timeout at all', ROUTE, '        signal: AbortSignal.timeout(DUPLICATE_ADOPT_UPSTREAM_TIMEOUT_MS),\n', ''],
  ['route: it logs every Director answer', ROUTE, "if ((data as { code?: unknown }).code === DUPLICATE_ADOPT_NOT_OWNED_CODE) console.warn(", 'if (true) console.warn('],
  ['route: it never logs PRESENTATION_NOT_OWNED', ROUTE, "if ((data as { code?: unknown }).code === DUPLICATE_ADOPT_NOT_OWNED_CODE) console.warn(duplicateAdoptNotOwnedLine(sessionId, presentationId))\n", ''],
  ['route: it logs the user id', ROUTE, 'console.warn(duplicateAdoptNotOwnedLine(sessionId, presentationId))', 'console.warn(duplicateAdoptNotOwnedLine(sessionId, presentationId), userId)'],
  ['route: it logs the header', ROUTE, 'console.warn(duplicateAdoptNotOwnedLine(sessionId, presentationId))', 'console.warn(duplicateAdoptNotOwnedLine(sessionId, presentationId), entitlement)'],
  ['route: it logs twice', ROUTE, 'console.warn(duplicateAdoptNotOwnedLine(sessionId, presentationId))', 'console.warn(duplicateAdoptNotOwnedLine(sessionId, presentationId)); console.warn(duplicateAdoptNotOwnedLine(sessionId, presentationId))'],
  ['route: it logs the unreachable Director', ROUTE, "    if (error instanceof ServiceUrlConfigError) return", "    console.warn(String(error))\n    if (error instanceof ServiceUrlConfigError) return"],
  ['dup lib: the marker\'s id is not written', DUP, "        ...(deps.adopt && target.slot === 'final' ? { currentStatus: { copiedFrom: { sessionId: source.sessionId, title: source.shownTitle, presentationId: copyId } } } : {}), // DUPLICATE-ADOPT\n", ''],
  ['dup lib: the marker\'s id is written with the flag off', DUP, "...(deps.adopt && target.slot === 'final' ? { currentStatus", "...(target.slot === 'final' ? { currentStatus"],
  ['dup lib: the marker\'s id is written for a strawman copy', DUP, "...(deps.adopt && target.slot === 'final' ? { currentStatus", '...(deps.adopt ? { currentStatus'],
  ['dup lib: the marker carries the source deck\'s id', DUP, 'title: source.shownTitle, presentationId: copyId }', 'title: source.shownTitle, presentationId: target.presentationId }'],
  ['dup lib: the marker loses its title', DUP, 'title: source.shownTitle, presentationId: copyId }', 'presentationId: copyId }'],
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
  ['dashboard: an unmarked line rides along', DASH, 'import { adoptDuplicateCopyAndRecord, DUPLICATE_ADOPT_PENDING_NOTE } from "@/lib/studio-duplicate-adopt"', 'const stray = 1\nimport { adoptDuplicateCopyAndRecord, DUPLICATE_ADOPT_PENDING_NOTE } from "@/lib/studio-duplicate-adopt"'],
  ['dashboard: step 4 gets no clock for the receipt', DASH, ', now: () => new Date() }) } : {}), // DUPLICATE-ADOPT', ' }) } : {}), // DUPLICATE-ADOPT'],
  ['builder: the controller needs only the adopt flag', BUILDER, "const studioDuplicateAdoptOnOpen = process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK === 'true' && ", 'const studioDuplicateAdoptOnOpen = '],
  ['builder: the controller gets no clock', BUILDER, 'createDuplicateAdoptOnOpen({ fetch: (input, init) => fetch(input, init), now: () => new Date() })', 'createDuplicateAdoptOnOpen({ fetch: (input, init) => fetch(input, init) } as any)'],
  ['builder: the socket callback is the old sync one', BUILDER, 'onDuplicateAdoptConnected: (owner', 'onDuplicateAdoptSync: (owner'],
  ['builder: the reconnect only connects', BUILDER, '() => { disconnect(); connect() }', '() => { connect() }'],
  ['hook: the connected tap ignores the flag', HOOK, "if (process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT === 'true') transportCallbacksRef.current.onDuplicateAdoptConnected", 'transportCallbacksRef.current.onDuplicateAdoptConnected'],
  ['hook: the connected tap names another session', HOOK, 'onDuplicateAdoptConnected?.({ sessionId: socketSessionId,', "onDuplicateAdoptConnected?.({ sessionId: '',"],
  ['hook: a superseded socket tells too', HOOK, "if (!isCurrentSocket()) {\n            debugLog('⏭️ Ignoring open from stale WebSocket');", "if (false) {\n            debugLog('⏭️ Ignoring open from stale WebSocket');"],
  ['hook: the tap is told before the connected state is set', HOOK, "          if (process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT === 'true') transportCallbacksRef.current.onDuplicateAdoptConnected?.({ sessionId: socketSessionId, isCurrent: isCurrentSocket }); // DUPLICATE-ADOPT: told once per open (a reconnect opens again); the caller acts on a session's first only\n", ''],
  ['hook: the old sync_response tap is still there', HOOK, "        ws.onmessage = (event) => {", "        const syncTap = (m: any) => transportCallbacksRef.current.onDuplicateAdoptSync?.(m.payload) // DUPLICATE-ADOPT\n        ws.onmessage = (event) => {"],
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
