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
//   G. open       the Builder's backstop: the Director socket's connected ARMS a session (the row is read once; the copiedFrom marker must carry the copy's id and no receipt); the call is made ONCE, on the
//                 first of the Director's first chat_message (the greeting, which the new-session branch sends after the blank canvas's row write) or 15 s after connected; always with the MARKER's id
//                 (a drifted final slot is ignored); 200 writes the receipt and, on reused:false while that socket is live, reconnects (disconnect, then connect). Nothing is called on open alone; greeting and
//                 wait racing make one call; close or a superseded socket cancels the wait; a reconnect's own connected, greeting and wait call nothing. The hook's code is the REAL code: ws.onopen, ws.onmessage
//                 up to the chat tap, ws.onclose's tap, run with stubs. The Builder's autosave never sends currentStatus.
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

  // ---- G. the Builder-open backstop: armed on "connected", fired by the greeting or the 15 s wait --------------------------------------------------------------------------------
  const copyRow = ({ marker = { ...MARKER, presentationId: 'copy-deck-1' }, final = 'copy-deck-1', status = {}, ...extra } = {}) => ({
    id: 'new-session-1', userId: DB_USER.id, status: 'active', title: 'Q4 sales review (copy)', createdAt: 'synthetic-created', updatedAt: 'synthetic-created',
    finalPresentationId: final, finalPresentationUrl: final ? `https://layout.synthetic.invalid/p/${final}` : null, strawmanPresentationId: null,
    stateCache: { activeVersion: 'final', slideStructure: [{ id: 'slide-1' }], currentStatus: marker ? { copiedFrom: marker, ...status } : { ...status } }, ...extra,
  })
  /** A clock the proof drives: schedule() returns the cancel function, advance(ms) fires what is due. */
  const fakeClock = () => {
    let at = 0; const timers = []
    return {
      timers,
      schedule: (fn, ms) => { const timer = { fn, ms, due: at + ms, cancelled: false, fired: false }; timers.push(timer); return () => { timer.cancelled = true } },
      advance: ms => { at += ms; for (const timer of timers) if (!timer.cancelled && !timer.fired && timer.due <= at) { timer.fired = true; timer.fn() } },
    }
  }
  const within = (promise, ms = 1000) => { let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('the controller never settled')), ms) })]).finally(() => clearTimeout(timer)) }
  function openWorld({ row = copyRow(), noRow = false, directorAnswers = ['01-adopted-200'], onAdopt } = {}) {
    const log = [], director = []
    const api = sessionsApi({ rows: new Map(noRow ? [] : [[row.id, row]]) })
    const fetch = async (url, init = {}) => {
      log.push(`${init.method ?? 'GET'} ${url}`)
      if (url.startsWith('/api/sessions/')) return api.handle(url, init)
      if (url === '/api/director/sessions/new-session-1/adopt-duplicate') {
        if (onAdopt) onAdopt()
        const out = await callRoute({ body: JSON.parse(init.body), upstream: (u, i) => { director.push(JSON.parse(i.body)); return answer(directorAnswers[Math.min(director.length - 1, directorAnswers.length - 1)])() } })
        return json(out.status, out.json)
      }
      return json(500, {})
    }
    const clock = fakeClock()
    const controller = loadTs(LIB).createDuplicateAdoptOnOpen({ fetch, now: () => NOW, schedule: clock.schedule })
    const reconnects = []
    /** One socket's connected: the owner is per socket (`live` is what the hook's isCurrentSocket answers). */
    const connect = ({ sessionId = 'new-session-1', live = true, reconnect } = {}) => {
      const owner = { sessionId, live, isCurrent: () => owner.live }
      return { owner, done: controller.onSocketEvent('connected', owner, reconnect ?? (() => reconnects.push(sessionId))) }
    }
    const chat = owner => controller.onSocketEvent('chat', owner, () => {})
    const close = owner => controller.onSocketEvent('closed', owner, () => {})
    const settle = () => tick(60)
    /** connect, let the row be read, deliver the greeting, wait for the outcome */
    const go = async opts => { const c = connect(opts); await settle(); chat(c.owner); return within(c.done) }
    return { log, director, reconnects, rows: api.rows, api, fetch, clock, controller, connect, chat, close, settle, go }
  }
  const storedOf = w => w.rows.get('new-session-1').stateCache
  const RECEIPT_LOG = ['GET /api/sessions/new-session-1', 'POST /api/director/sessions/new-session-1/adopt-duplicate', 'GET /api/sessions/new-session-1', 'PATCH /api/sessions/new-session-1']
  await check('G: connected alone calls nothing: the row is read once, the wait is armed for exactly 15 s, and the call comes at 15 s (not 14.999)', async () => {
    eq(loadTs(LIB).DUPLICATE_ADOPT_GREETING_WAIT_MS, 15_000)
    const w = openWorld(); const { done } = w.connect(); await w.settle()
    deep(w.log, ['GET /api/sessions/new-session-1']); eq(w.director.length, 0); deep(w.clock.timers.map(t => [t.ms, t.cancelled]), [[15_000, false]]); deep(w.reconnects, [])
    w.clock.advance(14_999); await w.settle(); eq(w.director.length, 0, 'not yet at 14.999 s'); eq(w.log.length, 1)
    w.clock.advance(1); eq(await within(done), 'reconnected'); eq(w.director.length, 1)
    deep(w.log, RECEIPT_LOG); deep(w.director, [{ user_id: USER.id, presentation_id: 'copy-deck-1' }]); deep(w.reconnects, ['new-session-1']); eq(storedOf(w).currentStatus.copiedFrom.adoptedAt, NOW.toISOString())
  })
  await check('G: the greeting fires it once, after the row read: ONE call, the receipt, one reconnect; the wait is cancelled', async () => {
    let w, waitCancelledDuringTheCall = null; w = openWorld({ onAdopt: () => { waitCancelledDuringTheCall = w.clock.timers[0].cancelled } }); eq(await w.go(), 'reconnected')
    eq(waitCancelledDuringTheCall, true, 'the wait is cancelled the moment the call starts')
    deep(w.log, RECEIPT_LOG); deep(w.director, [{ user_id: USER.id, presentation_id: 'copy-deck-1' }]); deep(w.reconnects, ['new-session-1']); eq(w.clock.timers[0].cancelled, true, 'the wait is cancelled once the call is made')
    deep(storedOf(w).currentStatus, { copiedFrom: { ...MARKER, presentationId: 'copy-deck-1', adoptedAt: NOW.toISOString() } })
    w.clock.advance(60_000); await w.settle(); eq(w.director.length, 1, 'the cancelled wait never fires')
  })
  await check('G: a greeting that comes before the row read finishes still fires, after the read; so does a wait that elapses first', async () => {
    const a = openWorld(); const c = a.connect(); a.chat(c.owner); eq(await within(c.done), 'reconnected'); deep(a.log.slice(0, 2), ['GET /api/sessions/new-session-1', 'POST /api/director/sessions/new-session-1/adopt-duplicate'])
    const b = openWorld(); const d = b.connect(); b.clock.advance(15_000); eq(await within(d.done), 'reconnected'); deep(b.log.slice(0, 2), ['GET /api/sessions/new-session-1', 'POST /api/director/sessions/new-session-1/adopt-duplicate'])
  })
  await check('G: the greeting and the wait racing make ONE call (either order, same tick, and a later greeting or wait)', async () => {
    for (const order of ['chat first', 'wait first']) {
      const w = openWorld(); const c = w.connect(); await w.settle()
      if (order === 'chat first') { w.chat(c.owner); w.clock.advance(15_000) } else { w.clock.advance(15_000); w.chat(c.owner) }
      eq(await within(c.done), 'reconnected', order); eq(w.director.length, 1, order); w.chat(c.owner); w.clock.advance(60_000); await w.settle(); eq(w.director.length, 1, `${order}: nothing later`); eq(w.reconnects.length, 1, order)
    }
    const two = openWorld(); const a = two.connect(), b = two.connect(); await two.settle(); two.chat(a.owner); two.chat(b.owner)
    deep([await within(a.done), await within(b.done)].sort(), ['not-first', 'reconnected']); eq(two.director.length, 1, 'two sockets of one session: one call')
  })
  await check('G: the wait is cancelled when the socket closes, and nothing fires for a socket that is no longer current', async () => {
    const w = openWorld(); const c = w.connect(); await w.settle(); w.close(c.owner); eq(await within(c.done), 'cancelled'); eq(w.clock.timers[0].cancelled, true)
    w.clock.advance(60_000); w.chat(c.owner); await w.settle(); eq(w.director.length, 0); deep(w.log, ['GET /api/sessions/new-session-1'])
    const x = openWorld(); const s = x.connect(); await x.settle(); s.owner.live = false; x.clock.advance(15_000); eq(await within(s.done), 'not-current', 'superseded before the wait ended'); eq(x.director.length, 0)
    const y = openWorld(); const t = y.connect(); await y.settle(); t.owner.live = false; y.chat(t.owner); eq(await within(t.done), 'not-current', 'superseded before the greeting'); eq(y.director.length, 0)
    const z = openWorld(), first = z.connect(), second = z.connect(); await z.settle(); first.owner.live = false; z.close(first.owner); eq(await within(first.done), 'cancelled')
    eq(z.clock.timers.map(t => t.cancelled).join(), 'true,false', 'a stale socket\'s close cancels its own wait only'); z.clock.advance(15_000); eq(await within(second.done), 'reconnected'); eq(z.director.length, 1)
  })
  await check('G: a cancelled wait is armed again by the next connected; once the session\'s call is made, a reconnect\'s connected arms nothing and its greeting or wait fires nothing', async () => {
    const w = openWorld(); const one = w.connect(); await w.settle(); w.close(one.owner); eq(await within(one.done), 'cancelled')
    const two = w.connect(); await w.settle(); w.chat(two.owner); eq(await within(two.done), 'reconnected'); eq(w.director.length, 1)
    const timers = w.clock.timers.length, requests = w.log.length
    const three = w.connect(); eq(await within(three.done), 'not-first'); w.chat(three.owner); w.clock.advance(60_000); await w.settle()
    eq(w.clock.timers.length, timers, 'no wait armed for the reconnect'); eq(w.log.length, requests, 'no request at all'); eq(w.director.length, 1); eq(w.reconnects.length, 1)
    eq(await within(w.connect({ sessionId: 'new-session-1' }).done), 'not-first'); eq(w.director.length, 1)
  })
  await check('G: the call is made at most once per session per tab even when the receipt cannot be written (a repeat would only be reused:true)', async () => {
    const w = openWorld(), real = w.fetch, reconnects = []
    const controller = loadTs(LIB).createDuplicateAdoptOnOpen({ fetch: async (url, init = {}) => (init.method === 'PATCH' ? json(500, {}) : real(url, init)), now: () => NOW, schedule: w.clock.schedule })
    const arm = () => { const owner = { sessionId: 'new-session-1', isCurrent: () => true }; return { owner, done: controller.onSocketEvent('connected', owner, () => reconnects.push(1)) } }
    const a = arm(); await w.settle(); controller.onSocketEvent('chat', a.owner, () => {}); eq(await within(a.done), 'reconnected'); const calls = w.director.length
    eq(await within(arm().done), 'not-first'); eq(await within(arm().done), 'not-first'); eq(w.director.length, calls); eq(reconnects.length, 1)
  })
  await check('G: the MARKER\'s id is adopted: a final slot the Director\'s blank canvas overwrote is ignored', async () => {
    const w = openWorld({ row: copyRow({ final: 'blank-canvas-9' }) }); eq(await w.go(), 'reconnected')
    deep(w.director, [{ user_id: USER.id, presentation_id: 'copy-deck-1' }])
    const w2 = openWorld({ row: copyRow({ final: null, strawmanPresentationId: 'strawman-deck-3' }) }); eq(await w2.go(), 'reconnected'); deep(w2.director, [{ user_id: USER.id, presentation_id: 'copy-deck-1' }])
  })
  await check('G: end to end: step 4 failed at duplicate time, the Builder\'s autosave wrote the blank canvas into the final slot, the backstop still adopts the copy', async () => {
    const world = duplicateWorld({ directorAnswers: ['27-store-unavailable-503', '27-store-unavailable-503', '27-store-unavailable-503', '01-adopted-200'] })
    const result = await runDuplicate(dupText, { world, adopt: adoptVia(world) }); eq(result.adoption.ok, false); eq(result.adoption.attempts, 3)
    await world.fetch('/api/sessions/new-session-1', { method: 'PATCH', headers: {}, body: JSON.stringify({ currentStage: 6, finalPresentationUrl: 'https://layout.synthetic.invalid/p/blank-canvas-9', finalPresentationId: 'blank-canvas-9', stateCache: { activeVersion: 'final', slideStructure: [{ id: 'blank' }] } }) })
    eq(world.rows.get('new-session-1').finalPresentationId, 'blank-canvas-9')
    const reconnects = [], clock = fakeClock(); const controller = loadTs(LIB).createDuplicateAdoptOnOpen({ fetch: world.fetch, now: () => NOW, schedule: clock.schedule })
    const owner = { sessionId: 'new-session-1', isCurrent: () => true }; const done = controller.onSocketEvent('connected', owner, () => reconnects.push(1)); await tick(60); clock.advance(15_000)
    eq(await within(done), 'reconnected')
    eq(world.director.length, 4); deep(world.director[3].body, { user_id: USER.id, presentation_id: 'copy-deck-1' }); eq(reconnects.length, 1)
    eq(world.rows.get('new-session-1').stateCache.currentStatus.copiedFrom.adoptedAt, NOW.toISOString()); deep(world.rows.get('new-session-1').stateCache.slideStructure, [{ id: 'blank' }])
  })
  await check('G: a copy adopted at duplicate time has the receipt: it is never armed for a call', async () => {
    const world = duplicateWorld(); await runDuplicate(dupText, { world, adopt: adoptVia(world) }); eq(world.director.length, 1)
    const clock = fakeClock(), controller = loadTs(LIB).createDuplicateAdoptOnOpen({ fetch: world.fetch, now: () => NOW, schedule: clock.schedule }), reconnects = []
    const owner = { sessionId: 'new-session-1', isCurrent: () => true }; const done = controller.onSocketEvent('connected', owner, () => reconnects.push(1))
    eq(await within(done), 'already-adopted'); controller.onSocketEvent('chat', owner, () => {}); clock.advance(60_000); await tick(40); eq(world.director.length, 1); deep(reconnects, []); eq(clock.timers[0].cancelled, true, 'its wait is dropped')
  })
  await check('G: no presentationId in the marker (a copy made before this change, a strawman copy): no call, whatever the final slot says, at the greeting or at 15 s', async () => {
    for (const [label, row] of [['old copy', copyRow({ marker: MARKER })], ['strawman copy', copyRow({ marker: MARKER, final: null, strawmanPresentationId: 'copy-deck-1' })], ['id not plain', copyRow({ marker: { ...MARKER, presentationId: 'https://layout.synthetic.invalid/p/x' } })], ['id empty', copyRow({ marker: { ...MARKER, presentationId: '' } })], ['id a number', copyRow({ marker: { ...MARKER, presentationId: 5 } })]]) {
      const w = openWorld({ row }); const c = w.connect(); eq(await within(c.done), 'no-copy-id', label); w.chat(c.owner); w.clock.advance(60_000); await w.settle(); deep(w.log, ['GET /api/sessions/new-session-1'], label); deep(w.reconnects, [], label)
    }
  })
  await check('G: a receipt in the marker: no call (blank, or not a string, is not a receipt)', async () => {
    const w = openWorld({ row: copyRow({ marker: { ...MARKER, presentationId: 'copy-deck-1', adoptedAt: '2026-10-25T12:00:00.000Z' } }) }); const c = w.connect(); eq(await within(c.done), 'already-adopted'); w.chat(c.owner); w.clock.advance(60_000); await w.settle(); deep(w.log, ['GET /api/sessions/new-session-1'])
    for (const adoptedAt of ['', '  ', 5, null, {}]) { const x = openWorld({ row: copyRow({ marker: { ...MARKER, presentationId: 'copy-deck-1', adoptedAt } }) }); eq(await x.go(), 'reconnected', JSON.stringify(adoptedAt)) }
  })
  await check('G: 200 reused:true writes the receipt but does not reconnect', async () => {
    const w = openWorld({ directorAnswers: ['03-repeat-200-reused'] }); eq(await w.go(), 'reused'); deep(w.reconnects, []); deep(w.log, RECEIPT_LOG); eq(storedOf(w).currentStatus.copiedFrom.adoptedAt, NOW.toISOString())
  })
  for (const name of ['25-layout-unavailable-502', '27-store-unavailable-503', '20-not-owned-403', '23-session-not-fresh-409', '30-flag-off-404', '21-not-a-duplicate-422']) {
    await check(`G: ${name}: one call only (no retry on open), no receipt, no reconnect`, async () => {
      const w = openWorld({ directorAnswers: [name] }); eq(await w.go(), 'failed'); eq(w.director.length, 1); deep(w.reconnects, []); deep(w.log, RECEIPT_LOG.slice(0, 2)); ok(!('adoptedAt' in storedOf(w).currentStatus.copiedFrom))
      w.clock.advance(60_000); await w.settle(); eq(w.director.length, 1, 'and the spent wait does not call again')
    })
  }
  await check('G: not a copy (no marker), no row, an unreadable row, or an id that is not plain: no call; a row that could not be read is read again on the next connected, one that was read is not', async () => {
    const a = openWorld({ row: copyRow({ marker: null }) }); eq(await within(a.connect().done), 'not-a-copy'); deep(a.log, ['GET /api/sessions/new-session-1']); eq(await within(a.connect().done), 'not-first', 'a row that says "not a copy" is not read again'); eq(a.log.length, 1)
    const b = openWorld({ noRow: true }); eq(await within(b.connect().done), 'not-a-copy'); eq(await within(b.connect().done), 'not-a-copy'); deep(b.log, ['GET /api/sessions/new-session-1', 'GET /api/sessions/new-session-1'], 'a failed read is not a verdict')
    const c = openWorld({ row: copyRow({ marker: { sessionId: '', title: 'T', presentationId: 'copy-deck-1' } }) }); eq(await within(c.connect().done), 'not-a-copy')
    const d = openWorld(); eq(await within(d.connect({ sessionId: 'a/b' }).done), 'not-a-copy'); deep(d.log, []); deep(d.clock.timers, [])
    const e = openWorld(); eq(await within(e.connect({ sessionId: '' }).done), 'not-first'); deep(e.log, [])
  })
  await check('G: a socket that dies during the call still gets the receipt but no reconnect; a reconnect that throws is a failure, not a crash', async () => {
    let victim; const a = openWorld({ onAdopt: () => { victim.owner.live = false } }); victim = a.connect(); await a.settle(); a.chat(victim.owner)
    eq(await within(victim.done), 'not-current'); deep(a.reconnects, []); eq(storedOf(a).currentStatus.copiedFrom.adoptedAt, NOW.toISOString())
    const b = openWorld(); eq(await b.go({ reconnect: () => { throw new Error('boom') } }), 'failed')
  })
  await check('G: each session is acted on once per tab, separately', async () => {
    const w = openWorld(); eq(await within(w.connect({ sessionId: 'other-session' }).done), 'not-a-copy'); eq(await w.go(), 'reconnected'); eq(await within(w.connect().done), 'not-first')
  })

  // ---- G (continued). the hook's REAL socket handlers: the real ws.onopen block, the real ws.onmessage up to the chat tap, the real ws.onclose tap ---------------------------------------
  // The frames are built with the shape the Director builds them (Director src/handlers/websocket.py, read for this change; no recorded wire frames are kept in this repo's fixtures):
  //   the greeting     _send_greeting -> _send_chat (~5786-5815) -> create_chat_message (src/models/websocket_messages.py:941-989): { message_id "msg_<8 hex>", session_id, timestamp, type "chat_message", role "assistant",
  //                    payload { text, sub_title, list_items, format "markdown", ephemeral false } }; the text is DIRECTOR_522_INITIAL_GREETING (lib/studio-greeting-lifecycle.ts)
  //   the blank canvas _send_blank_slide_update (~5718-5760) -> create_presentation_init (websocket_messages.py:1045-1063; PresentationInit type "presentation_init" at :756-763): payload { operation "full_update",
  //                    metadata { main_title "Untitled Presentation", ... preview_url, preview_presentation_id }, slides [ blank_slide_1 ], is_blank true }
  //   the order        new-session branch (~1684-1690): _create_and_send_blank_presentation (Layout create, theme apply, THEN the row write, then theme_sync / presentation_init), then _send_greeting
  const GREETING_TEXT = loadTs('lib/studio-greeting-lifecycle.ts').DIRECTOR_522_INITIAL_GREETING
  const greetingFrame = (sessionId = 'new-session-1') => ({ message_id: 'msg_0a1b2c3d', session_id: sessionId, timestamp: '2026-10-26T00:00:03.000Z', type: 'chat_message', role: 'assistant', payload: { text: GREETING_TEXT, sub_title: null, list_items: null, format: 'markdown', ephemeral: false } })
  const blankInitFrame = (sessionId = 'new-session-1') => ({ message_id: 'msg_1b2c3d4e', session_id: sessionId, timestamp: '2026-10-26T00:00:02.500Z', type: 'presentation_init', role: 'assistant', payload: { operation: 'full_update', metadata: { main_title: 'Untitled Presentation', overall_theme: '', design_suggestions: '', target_audience: '', presentation_duration: 0, preview_url: 'https://layout.synthetic.invalid/p/blank-canvas-9', preview_presentation_id: 'blank-canvas-9' }, slides: [{ slide_id: 'blank_slide_1', slide_number: 1, slide_type: 'title_slide', title: '', subtitle: '', narrative: '', key_points: [], variant_id: 'H1s', service: 'text', purpose: 'title_slide' }], is_blank: true } })
  const themeSyncFrame = (sessionId = 'new-session-1') => ({ message_id: 'msg_2c3d4e5f', session_id: sessionId, timestamp: '2026-10-26T00:00:02.400Z', type: 'theme_sync', role: 'assistant', payload: { request_id: 'initial:blank-canvas-9', status: 'applied', presentation_id: 'blank-canvas-9' } })
  const hookText = () => read(HOOK)
  /** Runs `source` (a piece of the hook, as TypeScript) with free names taken from `table`; any other free name is a loud failure, so the real code cannot quietly reach something this proof did not supply. */
  function runScoped(source, table) {
    const scope = new Proxy(table, {
      has: (target, key) => typeof key === 'string' && (key in target || !(key in globalThis)),
      get: (target, key) => { if (key === Symbol.unscopables) return undefined; if (key in target) return target[key]; throw new Error(`the hook code reached a name this proof does not supply: ${String(key)}`) },
      set: (target, key, value) => { target[key] = value; return true },
    })
    vm.runInThisContext(`(function (__scope) { with (__scope) {\n${compile(source, 'hooks/use-deckster-websocket-v2.ts')}\n} })`, { filename: HOOK })(scope)
  }
  const sliceHook = (from, tapNeedle) => { const text = hookText(), start = text.indexOf(from), tapAt = text.indexOf(tapNeedle, start); if (start < 0 || tapAt < 0) throw new Error(`hook text not found: ${from}`); return text.slice(start, text.indexOf('\n', tapAt)) }
  const sliceHookTo = (from, to) => { const text = hookText(), start = text.indexOf(from), end = text.indexOf(to, start); if (start < 0 || end < 0) throw new Error(`hook text not found: ${from}`); return text.slice(start, end) }
  const slideCompose = loadTs('lib/slide-compose-async.ts'), themeExportWire = loadTs('lib/chat-theme-export-wire.ts'), elementRefineWire = loadTs('lib/chat-element-refine-wire.ts'), jobLedger = loadTs('lib/studio-job-ledger.ts')
  /**
   * One socket of the real hook, built the way the hook builds it: the real `duplicateAdoptOwner` line, the real ws.onopen, the real ws.onmessage (from its top to the chat tap; the frame carries on after
   * the tap, which this proof does not run), the real ws.onclose (its first statement). Its callback goes to the controller of `world`. `trace` is the world's request log, so frames and requests share one order.
   */
  function hookSocket(world, { sessionId = 'new-session-1', env = { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }, callbackPresent = true } = {}) {
    const state = { current: true }, ws = {}, events = []
    const isCurrentSocket = () => state.current
    const pending = []
    const reconnect = () => world.reconnects.push(sessionId)
    const owner = evalLine(`${lineWith(HOOK, 'const duplicateAdoptOwner =')}\nmodule.exports = duplicateAdoptOwner`, ['process', 'socketSessionId', 'isCurrentSocket'], [{ env }, sessionId, isCurrentSocket])
    const callbacks = { current: callbackPresent ? { onDuplicateAdoptSocket: (event, who) => { events.push(event); const result = world.controller.onSocketEvent(event, who, reconnect); if (event === 'connected') pending.push(result) } } : {} }
    const table = {
      process: { env }, ws, isCurrentSocket, debugLog: () => {}, duplicateAdoptOwner: owner, socketSessionId: sessionId, transportCallbacksRef: callbacks, acknowledgeHeartbeat: () => {},
      normalizeDirectorMessageFrame: raw => slideCompose.normalizeSlideComposeSocketFrame(raw), chatThemeExportDirectiveKind: themeExportWire.chatThemeExportDirectiveKind,
      CHAT_ELEMENT_REFINE_ENABLED: elementRefineWire.CHAT_ELEMENT_REFINE_ENABLED, ELEMENT_REFINE_DIRECTIVE_TYPE: elementRefineWire.ELEMENT_REFINE_DIRECTIVE_TYPE,
      STUDIO_JOB_LEDGER_ENABLED: jobLedger.STUDIO_JOB_LEDGER_ENABLED, JOB_UPDATE_TYPE: jobLedger.JOB_UPDATE_TYPE,
      // ws.onopen
      expiresInSeconds: null, scheduleAuthRefresh: () => {}, socketSessionRef: { current: null }, setConnectionGeneration: () => {}, clearReconnectTimer: () => {}, reconnectPausedForOfflineRef: { current: true }, setReconnectStatus: () => {},
      reconnectAttemptsRef: { current: 0 }, clearReconnectStabilityTimer: () => {}, reconnectStabilityTimeoutRef: { current: undefined }, DIRECTOR_RECONNECT_STABILITY_MS: 3000, wsRef: { current: ws }, WebSocket: { OPEN: 1 },
      isConnectingRef: { current: true }, hasConnectedRef: { current: false }, startHeartbeat: () => {}, setState: update => { state.last = update({ connected: false, connectionState: 'disconnected', error: new Error('old') }) },
    }
    runScoped(sliceHookTo('ws.onopen = () => {', 'ws.onmessage = (event) => {'), table)
    runScoped(`${sliceHook('ws.onmessage = (event) => {', "onDuplicateAdoptSocket?.('chat', duplicateAdoptOwner)")}\n          } catch (error) { throw error }\n        };`, table)
    runScoped(`${sliceHook('ws.onclose = (event) => {', "onDuplicateAdoptSocket?.('closed', duplicateAdoptOwner)")}\n        };`, table)
    return {
      ws, state, events, owner, pending,
      open: () => { ws.onopen(); return state.last },
      deliver: (frame, label) => { if (label) world.log.push(`frame:${label ?? frame.type}`); ws.onmessage({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) }) },
      close: () => ws.onclose({ code: 1006, reason: '', wasClean: false }),
    }
  }

  await check('G: the real hook: onopen alone calls nothing; the blank canvas frames (theme_sync, presentation_init is_blank) call nothing; the greeting that follows them fires, after them, never before', async () => {
    const w = openWorld(); const sock = hookSocket(w)
    const state = sock.open(); eq(state.connectionState, 'connected'); eq(state.connected, true); deep(sock.events, ['connected'], 'the tap runs in onopen, after the connected state is set')
    await w.settle(); eq(w.director.length, 0, 'no call on open alone'); deep(w.log, ['GET /api/sessions/new-session-1'])
    sock.deliver(themeSyncFrame(), 'theme_sync'); sock.deliver(blankInitFrame(), 'presentation_init'); await w.settle()
    eq(w.director.length, 0, 'the blank canvas is not the signal'); deep(sock.events, ['connected'])
    sock.deliver({ ...blankInitFrame(), type: 'slide_update' }, 'slide_update is_blank'); await w.settle(); eq(w.director.length, 0, 'nor is a slide_update is_blank')
    sock.deliver(greetingFrame(), 'chat_message greeting'); deep(sock.events, ['connected', 'chat'])
    eq(await within(sock.pending[0]), 'reconnected')
    const at = label => w.log.indexOf(label), post = w.log.indexOf('POST /api/director/sessions/new-session-1/adopt-duplicate')
    ok(at('frame:theme_sync') < at('frame:presentation_init') && at('frame:presentation_init') < at('frame:chat_message greeting') && at('frame:chat_message greeting') < post, `the call comes after the greeting: ${w.log.join(' | ')}`)
    deep(w.reconnects, ['new-session-1']); eq(w.director.length, 1)
  })
  await check('G: the real hook: no greeting, no frames at all: the call comes at 15 s after connected', async () => {
    const w = openWorld(); const sock = hookSocket(w); sock.open(); await w.settle(); w.clock.advance(14_999); await w.settle(); eq(w.director.length, 0)
    w.clock.advance(1); eq(await within(sock.pending[0]), 'reconnected'); eq(w.director.length, 1); deep(w.clock.timers.map(t => t.ms), [15_000])
  })
  await check('G: the real hook: only a chat_message of the socket\'s own session on a current socket counts (other sessions, other frame types, a stale socket, a pong, junk: nothing)', async () => {
    const w = openWorld(); const sock = hookSocket(w); sock.open(); await w.settle()
    sock.deliver(greetingFrame('other-session')); sock.deliver({ ...greetingFrame(), type: 'status_update' }); sock.deliver({ ...greetingFrame(), type: 'sync_response' }); sock.deliver(blankInitFrame()); sock.deliver('pong'); sock.deliver('null'); sock.deliver('[]')
    await w.settle(); deep(sock.events, ['connected']); eq(w.director.length, 0)
    sock.state.current = false; sock.deliver(greetingFrame()); await w.settle(); deep(sock.events, ['connected'], 'a superseded socket\'s frames are dropped before the tap'); eq(w.director.length, 0)
    sock.state.current = true; sock.deliver(greetingFrame()); eq(await within(sock.pending[0]), 'reconnected'); deep(sock.events, ['connected', 'chat'])
  })
  await check('G: the real hook: a socket that was superseded but has not closed yet never fires (its wait ends as not-current)', async () => {
    const w = openWorld(); const sock = hookSocket(w); sock.open(); await w.settle(); sock.state.current = false; w.clock.advance(15_000)
    eq(await within(sock.pending[0]), 'not-current'); eq(w.director.length, 0); deep(w.log, ['GET /api/sessions/new-session-1'])
  })
  await check('G: the real hook: close cancels the wait (current or stale socket, by its own owner); a stale socket\'s close leaves the newer socket\'s wait alone', async () => {
    const w = openWorld(); const sock = hookSocket(w); sock.open(); await w.settle(); sock.close(); deep(sock.events, ['connected', 'closed']); eq(await within(sock.pending[0]), 'cancelled'); eq(w.clock.timers[0].cancelled, true)
    w.clock.advance(60_000); await w.settle(); eq(w.director.length, 0)
    const x = openWorld(); const a = hookSocket(x); a.open(); await x.settle(); a.state.current = false; const b = hookSocket(x); b.open(); await x.settle()
    a.close(); eq(await within(a.pending[0]), 'cancelled'); eq(x.clock.timers.map(t => t.cancelled).join(), 'true,false'); x.clock.advance(15_000); eq(await within(b.pending[0]), 'reconnected'); eq(x.director.length, 1)
  })
  await check('G: the real hook: the reconnect after a fire (its own connected, its greeting, its wait) calls nothing', async () => {
    const w = openWorld(); const first = hookSocket(w); first.open(); await w.settle(); first.deliver(greetingFrame()); eq(await within(first.pending[0]), 'reconnected')
    first.close(); first.state.current = false
    const second = hookSocket(w); second.open(); eq(await within(second.pending[0]), 'not-first'); second.deliver(greetingFrame()); w.clock.advance(60_000); await w.settle()
    eq(w.director.length, 1); eq(w.reconnects.length, 1); deep(w.log.filter(line => line.startsWith('POST ')), ['POST /api/director/sessions/new-session-1/adopt-duplicate'])
  })
  await check('G: the real hook, flag off: no owner, no callback, no request (open, frames, close)', async () => {
    for (const env of [{}, { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'TRUE' }, { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'false' }]) {
      const w = openWorld(); const sock = hookSocket(w, { env }); eq(sock.owner, null); sock.open(); sock.deliver(greetingFrame()); sock.close(); w.clock.advance(60_000); await w.settle()
      deep(sock.events, []); deep(w.log, []); eq(w.clock.timers.length, 0)
    }
    const w = openWorld(); const sock = hookSocket(w, { callbackPresent: false }); sock.open(); sock.deliver(greetingFrame()); sock.close(); deep(sock.events, [], 'no callback given (a page without the controller): the taps are inert')
  })
  await check('G: the hook\'s marked lines: where the taps sit, and that none of them takes a frame away', () => {
    const hook = hookText(), marked = hook.split('\n').filter(MARKED); eq(marked.length, 7, 'two comment lines, the option, the owner, three taps')
    ok(hook.includes("  onDuplicateAdoptSocket?: (event: 'connected' | 'chat' | 'closed', owner: { sessionId: string; isCurrent: () => boolean }) => void; // DUPLICATE-ADOPT\n"), 'the option type')
    const connectedTap = lineWith(HOOK, "('connected', duplicateAdoptOwner)"), chatTap = lineWith(HOOK, "('chat', duplicateAdoptOwner)"), closedTap = lineWith(HOOK, "('closed', duplicateAdoptOwner)"), ownerLine = lineWith(HOOK, 'const duplicateAdoptOwner =')
    for (const line of [connectedTap, chatTap, closedTap]) ok(!/\breturn\b|\bthrow\b|\bawait\b/.test(line.split('//')[0]), `a tap only calls: ${line.trim().slice(0, 50)}`)
    const at = line => hook.indexOf(line)
    ok(at(ownerLine) > hook.indexOf('const isCurrentSocket = () => wsRef.current === ws && isCurrentAttempt();') && at(ownerLine) < hook.indexOf('ws.onopen = () => {'), 'the owner is made once per socket, before its handlers')
    const open = hook.slice(hook.indexOf('ws.onopen = () => {'), hook.indexOf('ws.onmessage = (event) => {')); ok(open.indexOf(connectedTap) > open.indexOf("connectionState: 'connected',") && open.indexOf(connectedTap) > open.indexOf('}));\n'), 'after the connected state is set'); ok(open.trimEnd().endsWith('};') && open.indexOf(connectedTap) > open.indexOf('startHeartbeat(ws);'))
    ok(at(chatTap) > at("transportCallbacksRef.current.onJobsSync?.(rows,") && at(chatTap) < hook.indexOf('if (!isKnownDirectorMessageType(parsedMessage.type)) {', at(chatTap)), 'beside the job ledger\'s sync tap, ahead of the dispatch: the frame then carries on')
    const closeAt = hook.indexOf('ws.onclose = (event) => {'); ok(hook.indexOf(closedTap) === hook.indexOf('\n', closeAt) + 1, 'the first statement of onclose'); ok(hook.indexOf(closedTap) < hook.indexOf('Ignoring close from stale WebSocket'), 'before the stale-socket guard')
    ok(!hook.includes('onDuplicateAdoptSync') && !hook.includes('onDuplicateAdoptConnected') && !read(BUILDER).includes('onDuplicateAdoptSync') && !read(BUILDER).includes('onDuplicateAdoptConnected'), 'the earlier callbacks are gone')
    eq(hook.split('\n').filter(line => /sync_response/.test(line) && MARKED(line)).length, 0, 'nothing of this change keys on sync_response')
    ok(hook.includes('export function normalizeDirectorMessageFrame(') && hook.includes('): DirectorMessage {\n  return normalizeSlideComposeSocketFrame(raw as any) as unknown as DirectorMessage;\n}'), 'the proof\'s stand-in for the one-line normalizer is that line')
  })
  await check('G: the Builder makes one controller per tab, only with both flags on, with the clock and a cancellable wait', () => {
    const line = lineWith(BUILDER, 'const studioDuplicateAdoptOnOpen =')
    const made = [], timers = []
    const run = env => evalLine(`${line}\nmodule.exports = studioDuplicateAdoptOnOpen`, ['process', 'createDuplicateAdoptOnOpen', 'fetch', 'setTimeout', 'clearTimeout'], [{ env }, deps => { made.push(deps); return { onSocketEvent: () => {} } }, async () => json(200, {}), (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length - 1 }, id => { timers[id].cleared = true }])
    ok(run({ NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true', NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }) !== null); eq(made.length, 1); eq(typeof made[0].fetch, 'function'); ok(made[0].now() instanceof Date)
    const cancel = made[0].schedule(() => {}, 15_000); eq(timers[0].ms, 15_000); eq(typeof cancel, 'function'); cancel(); eq(timers[0].cleared, true, 'the returned function clears that timer')
    for (const env of [{}, { NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true' }, { NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'true' }, { NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true', NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT: 'yes' }]) eq(run(env), null)
    eq(made.length, 1)
    ok(line.startsWith('const studioDuplicateAdoptOnOpen = '), 'module scope (not inside a component)')
  })
  await check('G: the Builder hands the socket the callback only with the controller, passing every event on; the reconnect is disconnect then connect', async () => {
    const line = lineWith(BUILDER, 'onDuplicateAdoptSocket:')
    const page = read(BUILDER), at = page.indexOf(line)
    ok(at > page.indexOf('} = useDecksterWebSocketV2({') && at < page.indexOf('onBuildPhase: (payload, ownerSessionId) =>', at), 'in the socket\'s options')
    const order = [], seen = []
    const make = controller => evalLine(`module.exports = {\n${line}\n}`, ['studioDuplicateAdoptOnOpen', 'disconnect', 'connect'], [controller, () => order.push('disconnect'), () => order.push('connect')])
    deep(Object.keys(make(null)), [])
    const options = make({ onSocketEvent: (event, owner, reconnect) => { seen.push({ event, owner }); if (event === 'connected') reconnect(); return Promise.resolve('reconnected') } })
    deep(Object.keys(options), ['onDuplicateAdoptSocket'])
    const owner = { sessionId: 'new-session-1', isCurrent: () => true }
    for (const event of ['connected', 'chat', 'closed']) eq(options.onDuplicateAdoptSocket(event, owner), undefined)
    deep(seen.map(entry => entry.event), ['connected', 'chat', 'closed']); ok(seen.every(entry => entry.owner === owner)); deep(order, ['disconnect', 'connect'])
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
  ['lib: a session already called is armed again (a reconnect calls again)', LIB, "called.has(sessionId) || settled.has(sessionId) || entries.has(owner)", "settled.has(sessionId) || entries.has(owner)"],
  ['lib: a session known not to need a call is read again', LIB, "called.has(sessionId) || settled.has(sessionId) || entries.has(owner)", "called.has(sessionId) || entries.has(owner)"],
  ['lib: the backstop retries', LIB, 'sleep: async () => {}, retryDelaysMs: [] })', 'sleep: async () => {} })'],
  ['lib: connected calls at once (no wait for the greeting)', LIB, "          entry.presentationId = marker?.presentationId ?? null\n          maybeFire()", "          entry.presentationId = marker?.presentationId ?? null\n          entry.greeted = true\n          maybeFire()"],
  ['lib: the greeting is ignored', LIB, "    entry.greeted = true\n    entry.fire()", "    entry.fire()"],
  ['lib: the wait never elapses', LIB, "entry.cancelTimer = null; entry.waited = true; maybeFire()", "entry.cancelTimer = null; maybeFire()"],
  ['lib: the wait is 5 s', LIB, 'DUPLICATE_ADOPT_GREETING_WAIT_MS = 15_000', 'DUPLICATE_ADOPT_GREETING_WAIT_MS = 5_000'],
  ['lib: the wait is 60 s', LIB, 'DUPLICATE_ADOPT_GREETING_WAIT_MS = 15_000', 'DUPLICATE_ADOPT_GREETING_WAIT_MS = 60_000'],
  ['lib: the wait is not scheduled', LIB, "entry.cancelTimer = deps.schedule(() => { entry.cancelTimer = null; entry.waited = true; maybeFire() }, DUPLICATE_ADOPT_GREETING_WAIT_MS)", "entry.cancelTimer = null"],
  ['lib: close does not cancel', LIB, "    if (!entry || entry.firing) return\n    end(owner, entry, 'cancelled')", "    if (!entry || entry.firing) return"],
  ['lib: ending an arming leaves its wait running', LIB, "    try { entry.cancelTimer?.() } catch { /* a timer that cannot be cancelled has nothing left to do */ }\n", ""],
  ['lib: the call leaves its wait running', LIB, "        try { entry.cancelTimer?.() } catch { /* nothing left to do */ }\n        entry.cancelTimer = null\n        void run()", "        void run()"],
  ['lib: a socket that is no longer current still fires', LIB, "        if (!owner.isCurrent()) return end(owner, entry, 'not-current')\n        entry.firing = true", "        entry.firing = true"],
  ['lib: the session is not marked called before the call (a racing trigger repeats it)', LIB, "        entry.firing = true\n        called.add(sessionId)\n", "        entry.firing = true\n"],
  ['lib: the greeting and the wait both fire', LIB, "if (entry.ended || entry.firing || !entry.presentationId || !(entry.greeted || entry.waited)) return", "if (entry.ended || !entry.presentationId || !(entry.greeted || entry.waited)) return"],
  ['lib: no marker needed', LIB, "const verdict: DuplicateAdoptOpenResult | null = !marker ? 'not-a-copy' : ", "const verdict: DuplicateAdoptOpenResult | null = "],
  ['lib: the backstop adopts with the row\'s final slot id (the marker\'s id is ignored)', LIB, "entry.presentationId = marker?.presentationId ?? null", "entry.presentationId = (session as any)?.finalPresentationId ?? marker?.presentationId ?? null"],
  ['lib: a marker without an id adopts with the row\'s final slot id', LIB, " : !marker.presentationId ? 'no-copy-id' : marker.adoptedAt", " : marker.adoptedAt"],
  ['lib: a marker without an id is not a verdict', LIB, " : !marker.presentationId ? 'no-copy-id' : marker.adoptedAt ? 'already-adopted' : null", " : marker.adoptedAt ? 'already-adopted' : null"],
  ['lib: a receipt does not stop the backstop', LIB, " : marker.adoptedAt ? 'already-adopted' : null", " : null"],
  ['lib: a read row that says "not a copy" is read again', LIB, "if (verdict) { if (rowRead) settled.add(sessionId); return", "if (verdict) { return"],
  ['lib: a row that could not be read is settled for good', LIB, "if (verdict) { if (rowRead) settled.add(sessionId); return", "if (verdict) { settled.add(sessionId); return"],
  ['lib: the backstop writes no receipt', LIB, "          await recordAdoptReceipt({ sessionId, presentationId: entry.presentationId as string, fetch: deps.fetch, now: deps.now })\n", ""],
  ['lib: the backstop reconnects after reused:true too', LIB, "          if (outcome.reused) return end(owner, entry, 'reused')\n", ""],
  ['lib: the backstop never reconnects', LIB, "          reconnect()\n          return end(owner, entry, 'reconnected')", "          return end(owner, entry, 'reconnected')"],
  ['lib: a socket that died during the call is reconnected', LIB, "          if (!owner.isCurrent()) return end(owner, entry, 'not-current')\n          reconnect()", "          reconnect()"],
  ['lib: a failed adoption still reconnects', LIB, "          if (!outcome.ok) return end(owner, entry, 'failed')\n", ""],
  ['lib: a non-plain session id is armed (and read)', LIB, "      if (!isPlainAdoptId(sessionId)) return settle('not-a-copy')\n", ""],
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
  ['builder: the controller gets no clock', BUILDER, 'now: () => new Date(), schedule:', 'schedule:'],
  ['builder: the controller gets no scheduler', BUILDER, ', schedule: (run, ms) => { const timer = setTimeout(run, ms); return () => clearTimeout(timer) } })', ' } as any)'],
  ['builder: the wait cannot be cancelled', BUILDER, 'return () => clearTimeout(timer) } })', 'return () => {} } })'],
  ['builder: the socket callback drops the event', BUILDER, 'onDuplicateAdoptSocket: (event: DuplicateAdoptSocketEvent, owner: DuplicateAdoptSocketOwner) => { void studioDuplicateAdoptOnOpen?.onSocketEvent(event, owner,', "onDuplicateAdoptSocket: (event: DuplicateAdoptSocketEvent, owner: DuplicateAdoptSocketOwner) => { void studioDuplicateAdoptOnOpen?.onSocketEvent('connected', owner,"],
  ['builder: the socket callback is the old connected one', BUILDER, 'onDuplicateAdoptSocket: (event', 'onDuplicateAdoptConnected: (event'],
  ['builder: the reconnect only connects', BUILDER, '() => { disconnect(); connect() }', '() => { connect() }'],
  ['hook: the owner is made with the flag off', HOOK, "const duplicateAdoptOwner = process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_ADOPT === 'true' ? {", "const duplicateAdoptOwner = true ? {"],
  ['hook: the owner names another session', HOOK, "? { sessionId: socketSessionId, isCurrent: isCurrentSocket } : null; // DUPLICATE-ADOPT: one owner per socket", "? { sessionId: '', isCurrent: isCurrentSocket } : null; // DUPLICATE-ADOPT: one owner per socket"],
  ['hook: the owner is always current', HOOK, "? { sessionId: socketSessionId, isCurrent: isCurrentSocket } : null; // DUPLICATE-ADOPT: one owner per socket", "? { sessionId: socketSessionId, isCurrent: () => true } : null; // DUPLICATE-ADOPT: one owner per socket"],
  ['hook: a superseded socket tells too', HOOK, "if (!isCurrentSocket()) {\n            debugLog('⏭️ Ignoring open from stale WebSocket');", "if (false) {\n            debugLog('⏭️ Ignoring open from stale WebSocket');"],
  ['hook: also told before the connected state is set', HOOK, "          if (expiresInSeconds) scheduleAuthRefresh(expiresInSeconds);\n", "          if (duplicateAdoptOwner) transportCallbacksRef.current.onDuplicateAdoptSocket?.('connected', duplicateAdoptOwner); // DUPLICATE-ADOPT\n          if (expiresInSeconds) scheduleAuthRefresh(expiresInSeconds);\n"],
  ['hook: the connected tap is gone', HOOK, "          if (duplicateAdoptOwner) transportCallbacksRef.current.onDuplicateAdoptSocket?.('connected', duplicateAdoptOwner); // DUPLICATE-ADOPT: told once per open (a reconnect opens again); the caller arms the session, it does not call yet\n", ""],
  ['hook: the chat tap fires for every session', HOOK, " && parsedMessage.session_id === socketSessionId) transportCallbacksRef.current.onDuplicateAdoptSocket?.('chat'", ") transportCallbacksRef.current.onDuplicateAdoptSocket?.('chat'"],
  ['hook: the chat tap fires for every frame type', HOOK, "if (duplicateAdoptOwner && parsedMessage.type === 'chat_message' && parsedMessage.session_id", "if (duplicateAdoptOwner && parsedMessage.session_id"],
  ['hook: the chat tap takes the frame away', HOOK, "onDuplicateAdoptSocket?.('chat', duplicateAdoptOwner); // DUPLICATE-ADOPT: the Director's first", "onDuplicateAdoptSocket?.('chat', duplicateAdoptOwner), parsedMessage.type === 'chat_message' && (() => { throw new Error('taken') })(); // DUPLICATE-ADOPT: the Director's first"],
  ['hook: the chat tap is gone', HOOK, "            if (duplicateAdoptOwner && parsedMessage.type === 'chat_message' && parsedMessage.session_id === socketSessionId) transportCallbacksRef.current.onDuplicateAdoptSocket?.('chat', duplicateAdoptOwner); // DUPLICATE-ADOPT: the Director's first chat_message (the greeting) is what releases the call; the frame then carries on as before\n", ""],
  ['hook: the close tap is gone', HOOK, "          if (duplicateAdoptOwner) transportCallbacksRef.current.onDuplicateAdoptSocket?.('closed', duplicateAdoptOwner); // DUPLICATE-ADOPT: before the stale-socket guard, so a superseded socket's timer is cancelled too\n", ""],
  ['hook: the close tap sits behind the stale-socket guard', HOOK, "          if (duplicateAdoptOwner) transportCallbacksRef.current.onDuplicateAdoptSocket?.('closed', duplicateAdoptOwner); // DUPLICATE-ADOPT: before the stale-socket guard, so a superseded socket's timer is cancelled too\n          if (!isCurrentSocket()) {", "          if (!isCurrentSocket()) {\n            if (duplicateAdoptOwner) transportCallbacksRef.current.onDuplicateAdoptSocket?.('closed', duplicateAdoptOwner); // DUPLICATE-ADOPT\n            return;\n          }\n          if (false) {"],
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
