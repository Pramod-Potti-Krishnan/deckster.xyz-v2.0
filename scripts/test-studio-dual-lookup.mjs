// FRONTEND-1 (program1/studio-flip-enablers, "Flip enablers: dual lookup"): proof of the Director dual lookup behind STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED (server, "true" only, default off).
//   lib/studio-director-email-fallback.ts (new) and the DUAL-LOOKUP marked lines in seven Director read proxies, the .env.example block and the three registry lines.
//
//   A. Behaviour, on the REAL handlers (transpile + vm; next-auth, Prisma and fetch stubbed; the secret made up at run time), for every route:
//      id-first (the first Director call names the DB id, signed sub = DB id); e-mail fallback (only on a miss, once, with the session's own e-mail, signed sub = e-mail, legacy answer served);
//      no client-supplied e-mail (a request carrying another e-mail in query / body / headers changes nothing; a session with an id, an e-mail whose DB row is another id, or no DB row: no fallback);
//      flag-off identity (one call, the raw session key exactly as before, unsigned, no DB read, no clone).
//   B. Source: every marked line is a pure insertion; stripping them gives the base's files byte for byte; .env.example is the base plus the block; the registry gains exactly its three lines;
//      the scope is this change's files. Read from this change's OWN commit (the newest "Flip enablers: dual lookup" commit), not the working tree.
//   C. MUTANTS: every one must be caught by A.
//
//   node scripts/test-studio-dual-lookup.mjs
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ts = createRequire(path.join(root, 'package.json'))('typescript')
const strip = await import('./studio-dual-lookup-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
let checks = 0
const ok = (c, m) => { checks++; assert.ok(c, m) }
const eq = (a, b, m) => { checks++; assert.deepEqual(a, b, m) }

const OWN = git('log', '-1', '--format=%H', '--grep=^Flip enablers: dual lookup', 'HEAD').trim()
ok(OWN, 'own commit: a "Flip enablers: dual lookup" commit is in HEAD')
const BASE = strip.BASE_COMMIT
const own = rel => git('show', `${OWN}:${rel}`)

// ---------- A. behaviour harness
const UID = 'cm-user-1', EMAIL = 'a@example.test', OTHER = 'victim@example.test', SECRET = crypto.randomBytes(24).toString('hex')
function harness(overrides = {}) {
  const env = { DIRECTOR_API_URL: 'https://director.test', DIRECTOR_WS_AUTH_SECRET: SECRET }
  const state = { session: null, users: new Map(), chats: new Map([['chat-1', { userId: UID, status: 'active' }]]), fetches: [], dbReads: 0, clones: 0, answer: () => ({ status: 200, body: {} }) }
  class NextResponse { constructor(body, init) { this.body = body; this.status = init?.status ?? 200 } static json(body, init) { return new NextResponse(body, init) } }
  class Resp { constructor(body, init) { this.body = body; this.status = init?.status ?? 200 } }
  const stubs = {
    'next/server': { NextResponse, NextRequest: class {} },
    'next-auth': { getServerSession: async () => state.session },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma: {
      user: { findUnique: async ({ where }) => { state.dbReads++; const k = where.id ? `id:${where.id}` : `email:${where.email}`; return state.users.has(k) ? { id: state.users.get(k) } : null } },
      chatSession: { findUnique: async ({ where }) => state.chats.get(where.id) ?? null },
    } },
    '@/lib/service-url': { requireServiceUrl: (_n, vals) => vals[0].value, ServiceUrlConfigError: class extends Error {} },
  }
  const cache = new Map()
  const response = (status, body) => {
    const text = JSON.stringify(body)
    let used = false
    const once = () => { if (used) throw new TypeError('Body has already been used'); used = true; return text }
    const r = { ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => JSON.parse(once()), text: async () => once() }
    r.clone = () => { state.clones++; return response(status, body) }
    return r
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const module = { exports: {} }
    cache.set(rel, module.exports)
    const src = overrides[rel] ?? fs.readFileSync(path.join(root, rel), 'utf8')
    const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const req = spec => stubs[spec] ?? (spec.startsWith('@/') ? load(spec.slice(2) + '.ts') : createRequire(import.meta.url)(spec))
    vm.runInNewContext(out, { module, exports: module.exports, require: req, process: { env }, Buffer, URL, URLSearchParams, console, Date, JSON, Math, Response: Resp,
      fetch: async (url, init = {}) => { state.fetches.push({ url, init }); const a = state.answer(url); return response(a.status, a.body) } })
    cache.set(rel, module.exports)
    return module.exports
  }
  return { env, state, load }
}
const subOf = init => { const h = init?.headers?.['X-Deckster-Entitlement']; if (!h) return null; const [p, s] = h.split('.'); assert.equal(s, crypto.createHmac('sha256', SECRET).update('deckster-rest-v1.' + p).digest('base64url'), 'signature'); return JSON.parse(Buffer.from(p, 'base64url')).sub }
const ctx = obj => ({ params: Promise.resolve(obj) })
const hostile = { nextUrl: new URL(`https://studio.test/x?user_id=${OTHER}&email=${OTHER}`), headers: new Map([['x-user-email', OTHER]]), json: async () => ({ email: OTHER, user_id: OTHER }) }
const enc = encodeURIComponent
// [file, call, url for a user key, primary miss body / status, legacy hit body]
const ROUTES = [
  ['app/api/templates/route.ts', m => m.GET(hostile), k => `https://director.test/api/users/${enc(k)}/templates`, { status: 200, body: { templates: [], count: 0 } }, { templates: [{ id: 't1' }], count: 1 }],
  ['app/api/templates/[id]/route.ts', m => m.GET(hostile, ctx({ id: 't1' })), k => `https://director.test/api/users/${enc(k)}/templates/t1`, { status: 404, body: { detail: 'not found' } }, { id: 't1' }],
  ['app/api/themes/route.ts', m => m.GET(hostile), k => `https://director.test/api/users/${enc(k)}/themes`, { status: 200, body: { themes: [], count: 0 } }, { themes: [{ id: 'th1' }], count: 1 }],
  ['app/api/themes/[id]/route.ts', m => m.GET(hostile, ctx({ id: 'th1' })), k => `https://director.test/api/users/${enc(k)}/themes/th1`, { status: 404, body: {} }, { id: 'th1' }],
  ['app/api/themes/standard/route.ts', m => m.GET(hostile), k => `https://director.test/api/users/${enc(k)}/themes/standard`, { status: 200, body: { theme: null } }, { theme: { id: 'th1' } }],
  ['app/api/ingest-jobs/[jobId]/route.ts', m => m.GET(hostile, ctx({ jobId: 'j1' })), k => `https://director.test/api/users/${enc(k)}/ingest-jobs/j1`, { status: 404, body: {} }, { status: 'done' }],
  ['app/api/director/sessions/[sourceSessionId]/library/route.ts', m => m.GET(hostile, ctx({ sourceSessionId: 'chat-1' })), () => 'https://director.test/sessions/chat-1/library', { status: 403, body: { detail: 'forbidden' } }, { items: [1] }],
]
const bodyOf = r => typeof r.body === 'string' ? JSON.parse(r.body) : r.body

async function behaviour(overrides = {}) {
  for (const [rel, call, urlFor, miss, hit] of ROUTES) {
    const isLib = rel.includes('/library/')
    const setup = (flag, session, rows) => { const h = harness(overrides); if (flag) h.env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED = 'true'; h.state.session = session; for (const [k, v] of rows) h.state.users.set(k, v); return h }
    const rows = [[`id:${UID}`, UID], [`email:${EMAIL}`, UID], [`email:${OTHER}`, 'cm-victim']]
    // flag-off identity: one call, raw key (the e-mail), unsigned, nothing read for the fallback, no clone
    if (isLib) { const h = setup(false, { user: { email: EMAIL } }, rows); h.state.answer = () => miss; const r = await call(h.load(rel)); eq(h.state.fetches.length, 0, `${rel}: flag off, no call`); eq(r.status, 404, `${rel}: flag off, 404`); eq(bodyOf(r).error, 'not_enabled', `${rel}: flag off, not_enabled`); eq(h.state.dbReads, 0, `${rel}: flag off, no DB read`) } else // LATER-CHANGES: registry read (FLIP-ENABLERS): "Flip enablers: library route gated behind the flag", registered after this change, answers the library route 404 not_enabled with the flag off before any read; the other routes keep the flag-off identity below
    { const h = setup(false, { user: { email: EMAIL } }, rows); h.state.answer = () => miss; const r = await call(h.load(rel))
      eq(h.state.fetches.length, 1, `${rel}: flag off, one call`); eq(h.state.fetches[0].url, urlFor(isLib ? UID : EMAIL), `${rel}: flag off, raw identity`)
      eq(subOf(h.state.fetches[0].init), null, `${rel}: flag off, unsigned`); eq(h.state.clones, 0, `${rel}: flag off, no clone`); eq(r.status, miss.status, `${rel}: flag off, Director's answer`)
      if (!isLib) eq(h.state.dbReads, 0, `${rel}: flag off, no DB read`) }
    // id-first, hit: one call, DB id, signed for the DB id
    { const h = setup(true, { user: { email: EMAIL } }, rows); h.state.answer = () => ({ status: 200, body: hit }); const r = await call(h.load(rel))
      eq(h.state.fetches.length, 1, `${rel}: DB id hit, one call`); eq(h.state.fetches[0].url, urlFor(UID), `${rel}: id first`); eq(subOf(h.state.fetches[0].init), UID, `${rel}: signed for the DB id`); eq(bodyOf(r), hit, `${rel}: DB id answer`) }
    // e-mail fallback on a miss: second call with the session's own e-mail, signed for it, legacy served
    { const h = setup(true, { user: { email: EMAIL } }, rows); h.state.answer = url => (h.state.fetches.length === 1 ? miss : { status: 200, body: hit }); const r = await call(h.load(rel))
      eq(h.state.fetches.length, 2, `${rel}: miss, one fallback`); eq(h.state.fetches[0].url, urlFor(UID), `${rel}: DB id asked first`); eq(h.state.fetches[1].url, urlFor(EMAIL), `${rel}: then the e-mail`)
      eq(subOf(h.state.fetches[1].init), EMAIL, `${rel}: fallback signed for the session e-mail`); eq(r.status, 200, `${rel}: legacy status`); eq(bodyOf(r), hit, `${rel}: legacy answer served`)
      ok(!JSON.stringify(h.state.fetches).includes(OTHER), `${rel}: the client's e-mail is never sent`) }
    // both miss: the primary answer stands
    { const h = setup(true, { user: { email: EMAIL } }, rows); h.state.answer = () => (h.state.fetches.length === 1 ? miss : { status: miss.status === 403 ? 404 : miss.status, body: { ...miss.body, legacy: 1 } }); const r = await call(h.load(rel))
      eq(h.state.fetches.length, 2, `${rel}: both miss, two calls`); eq(r.status, miss.status, `${rel}: both miss, primary status`); eq(bodyOf(r), miss.body, `${rel}: both miss, primary answer`) }
    // no fallback: a session with its own id
    { const h = setup(true, { user: { id: UID, email: EMAIL } }, rows); h.state.answer = () => miss; await call(h.load(rel))
      eq(h.state.fetches.length, 1, `${rel}: session has an id: no fallback`); ok(!JSON.stringify(h.state.fetches).includes('example.test'), `${rel}: session has an id: no e-mail sent`) }
    // no fallback: no DB row for the e-mail (not switched: the raw key goes out once, as before)
    { const h = setup(true, { user: { email: EMAIL } }, []); h.state.answer = () => miss; await call(h.load(rel))
      ok(h.state.fetches.length <= 1, `${rel}: no DB row: no fallback`); if (!isLib) eq(h.state.fetches[0].url, urlFor(EMAIL), `${rel}: no DB row: raw key`) }
  }
  // lib: the e-mail is only ever the session's own (no parameter can carry one)
  { const h = harness(overrides); h.env.STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED = 'true'; const lib = h.load('lib/studio-director-email-fallback.ts')
    h.state.users.set(`email:${EMAIL}`, UID)
    eq(await lib.legacyEmailKey(UID, { sessionUser: async () => ({ email: EMAIL }) }), EMAIL, 'lib: own e-mail')
    eq(await lib.legacyEmailKey(EMAIL, { sessionUser: async () => ({ email: EMAIL }) }), null, 'lib: not switched')
    eq(await lib.legacyEmailKey('cm-victim', { sessionUser: async () => ({ email: EMAIL }) }), null, 'lib: another id never maps to this e-mail')
    eq(await lib.legacyEmailKey(UID, { sessionUser: async () => { throw new Error('x') } }), null, 'lib: error -> null')
    eq(lib.directorEmailFallbackRead.length, 4, 'lib: no e-mail parameter') }
}

await behaviour()

// ---------- B. source, from the own commit
for (const rel of strip.DUAL_LOOKUP_FILES) {
  const head = own(rel), base = git('show', `${BASE}:${rel}`)
  eq(strip.removeDualLookupLines(rel, head), base, `${rel}: the marked lines out gives the base byte for byte`)
  const diff = git('diff', '-U0', `${BASE}..${OWN}`, '--', rel).split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l))
  ok(diff.length === 3 && diff.every(l => l.startsWith('+') && strip.DUAL_LOOKUP_MARKER_RE.test(l)), `${rel}: three marked insertions, nothing removed`)
  ok(own(rel).includes(strip.DUAL_LOOKUP_ROUTES[rel]), `${rel}: its miss rule`)
}
for (const rel of strip.DUAL_LOOKUP_PIN_FILES) {
  eq(strip.stripDualLookup(rel, own(rel)), git('show', `${BASE}:${rel}`), `${rel}: the taught proof, put back, is the base's`)
  const d = git('diff', '-U0', `${BASE}..${OWN}`, '--', rel).split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l))
  ok(d.filter(l => l.startsWith('+')).length === strip.DUAL_LOOKUP_EDITS[rel].length && d.filter(l => l.startsWith('-')).length <= strip.DUAL_LOOKUP_EDITS[rel].length && d.filter(l => l.startsWith('+')).every(l => l.includes('LATER-CHANGES: registry read (DUAL-LOOKUP)')), `${rel}: one marked line per taught edit (a whole line replaced, or one inserted)`)
}
for (const rel of strip.RESOLVE_ID_ROUTE_FILES) eq(registry.stripLaterChanges(rel, fs.readFileSync(path.join(root, rel), 'utf8')), git('show', `0357e8f7:${rel}`), `${rel}: through the registry (#577's strip, then this one), dev's route byte for byte`)
eq(registry.stripLaterEnvBlocks('.env.example', own('.env.example')), registry.stripLaterEnvBlocks('.env.example', git('show', `${BASE}:.env.example`)), '.env.example: the base plus registered blocks')
ok(own('.env.example').endsWith(`\n${strip.DUAL_LOOKUP_ENV_BLOCK}`), '.env.example: the block at the end')
const regDiff = git('diff', '-U0', `${BASE}..${OWN}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l))
const mine = regDiff.filter(l => l.includes('studio-dual-lookup-strip.mjs')), moved = regDiff.filter(l => !l.includes('studio-dual-lookup-strip.mjs'))
eq(mine.length, 3, 'registry: three lines'); ok(mine.every(l => l.startsWith('+') && l.includes('LATER-CHANGE')), 'registry: three added LATER-CHANGE lines')
eq(moved.map(l => l.slice(1)).sort(), [...new Set(moved.map(l => l.slice(1)))].flatMap(l => [l, l]).sort(), 'registry: the only other edit is the flip-enablers strip line moved to the list end (same text, removed once, added once)')
const strips = registry.LATER_STRIPS; eq(strips.slice(-2), [(await import('./studio-flip-enablers-strip.mjs')).stripFlipEnablers, strip.stripDualLookup], 'registry: the flip-enablers strip, then this one, at the list end (stacking order)')
eq(git('diff', '--name-only', `${BASE}..${OWN}`).split('\n').filter(Boolean).sort(), [...strip.DUAL_LOOKUP_SCOPE_FILES].sort(), 'scope: exactly this change\'s files')
ok(registry.LATER_STRIPS.includes(strip.stripDualLookup) && registry.LATER_ENV_BLOCKS.includes(strip.DUAL_LOOKUP_ENV_BLOCK), 'registry: strip and block registered')

// ---------- C. mutants
const LIB = 'lib/studio-director-email-fallback.ts'
const libSrc = fs.readFileSync(path.join(root, LIB), 'utf8')
const tpl = 'app/api/templates/route.ts', tplSrc = fs.readFileSync(path.join(root, tpl), 'utf8')
const MUTANTS = [
  ['flag gate dropped', LIB, libSrc, "if (!isStudioDirectorRestSignAllEnabled()) return null\n  try {\n    if (!(await isMiss", "try {\n    if (!(await isMiss"],
  ['fallback without a miss', LIB, libSrc, 'if (!(await isMiss(primary))) return null', ''],
  ['session-with-id guard dropped', LIB, libSrc, "if (!user || (typeof user.id === 'string' && user.id)) return null", 'if (!user) return null'],
  ['DB check dropped', LIB, libSrc, 'return verified && verified === sentUserId ? email : null', 'return email'],
  ['fallback signed for the DB id', LIB, libSrc, 'mintRestEntitlement({ sub: email, method })', 'mintRestEntitlement({ sub: sentUserId, method })'],
  ['empty list not a miss', LIB, libSrc, 'return value == null || (Array.isArray(value) && value.length === 0)', 'return false'],
  ['legacy miss served', LIB, libSrc, 'if (!legacy.ok || (await isMiss(legacy))) return null', ''],
  ['clone skipped (body consumed)', LIB, libSrc, 'await res.clone().json()', 'await res.json()'],
  ['id switch dropped (e-mail sent first)', tpl, tplSrc, '  return resolveDirectorUserId(uid);', '  return uid;'],
  ['legacy answer ignored', tpl, tplSrc, 'if (legacy) return NextResponse.json(await legacy.json(), { status: legacy.status })', 'if (legacy) void 0'],
  ['client e-mail used', LIB, libSrc, "const email = typeof user.email === 'string' && user.email ? user.email : null", `const email = '${OTHER}'`],
]
for (const [name, rel, src, from, to] of MUTANTS) {
  ok(src.includes(from), `mutant "${name}": anchor present`)
  let caught = false
  try { await behaviour({ [rel]: src.replace(from, to) }) } catch { caught = true }
  ok(caught, `mutant "${name}" caught`)
}
console.log(`PASS test-studio-dual-lookup: ${checks} checks, ${MUTANTS.length} mutants caught (own ${OWN.slice(0, 8)}, base ${BASE.slice(0, 8)})`)
