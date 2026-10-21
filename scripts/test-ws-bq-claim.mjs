// R-20261007-frontend-15 / contract F-quota-bq-claim v1: the signed build-quota claim `bq`
// carried in the Director WS token (flag DECKSTER_WS_BQ_CLAIM_ENABLED, server env, default off).
// Keyless and offline: the real route + quota code run against a stubbed database, the real
// WS hook's refresh function runs against a stubbed socket and fetch. No model, network or secret.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import nodeCrypto from 'node:crypto'
import ts from 'typescript'

const ROOT = new URL('..', import.meta.url).pathname
const plain = value => JSON.parse(JSON.stringify(value))
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)) }
let checks = 0
const check = (name, fn) => Promise.resolve(fn()).then(() => { checks++ }, error => { console.error(`FAILED: ${name}`); throw error })

// ---------------------------------------------------------------------------------------------
// A tiny loader: transpile the real TypeScript, resolve "@/..." to the repo, stub the externals.
// ---------------------------------------------------------------------------------------------
class FixedDate extends Date {
  constructor(...args) { if (args.length === 0) super(FixedDate.nowMs); else super(...args) }
  static now() { return FixedDate.nowMs }
}
FixedDate.nowMs = Date.UTC(2026, 9, 7, 15, 0, 0) // Wed 7 Oct 2026 11:00 EDT
const DAILY_RESET = '2026-10-08T04:00:00.000Z'  // next 00:00 Eastern
const WEEKLY_RESET = '2026-10-11T04:00:00.000Z' // next Sunday 00:00 Eastern

function createWorld({ externals = {}, context = {} } = {}) {
  const cache = new Map()
  const logs = []
  const baseContext = {
    Buffer, URL, URLSearchParams, Response, setTimeout, clearTimeout, Date: FixedDate,
    console: { log: () => {}, warn: (...a) => logs.push(['warn', ...a]), error: (...a) => logs.push(['error', ...a]) },
    ...context,
  }
  function load(relative) {
    const file = [`${relative}.ts`, `${relative}.tsx`, relative].map(r => path.join(ROOT, r)).find(f => fs.existsSync(f) && fs.statSync(f).isFile())
    assert.ok(file, `cannot resolve ${relative}`)
    if (cache.has(file)) return cache.get(file).exports
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const module = { exports: {} }
    cache.set(file, module)
    vm.runInNewContext(output, {
      ...baseContext, module, exports: module.exports,
      require: spec => {
        if (spec in externals) return externals[spec]
        if (spec.startsWith('@/')) return load(spec.slice(2))
        throw new Error(`Unexpected import ${spec}`)
      },
    })
    return module.exports
  }
  return { load, logs }
}

// ---------------------------------------------------------------------------------------------
// The route's world: a stubbed database whose answers each scenario controls.
// ---------------------------------------------------------------------------------------------
const SIGNING = ['unit', 'test', 'only', 'hmac', 'material'].join('-') // never a real secret
const USER_ID = 'user-live-db'
const SESSION_ID = 'session-1'

function makeDb(db = {}) {
  const calls = []
  const spent = { day: 0, week: 0, month: 0, life: 0, ...db.spent }
  let windows = null // [dayStart, weekStart, monthStart] as epoch ms, filled in by `windows`
  return {
    calls, setWindows: w => { windows = w },
    prisma: {
      chatSession: { findUnique: async query => { calls.push(['chatSession.findUnique', query]); return { userId: USER_ID, status: 'active' } } },
      user: {
        findUnique: async query => {
          calls.push(['user.findUnique', query])
          if (db.userThrows) throw new Error('db down (user)')
          if (query.select.tier) return db.noUserRow ? null : { tier: db.tier }
          if (query.select.walletBalanceCents) return db.noUserRow ? null : { walletBalanceCents: db.wallet }
          throw new Error(`unexpected select ${JSON.stringify(query.select)}`)
        },
      },
      walletTransaction: {
        aggregate: async query => {
          calls.push(['walletTransaction.aggregate', query])
          if (db.aggregateThrows) throw new Error('db down (ledger)')
          if (db.aggregateHangs) return new Promise(() => {})
          assert.equal(query.where.userId, USER_ID)
          assert.equal(query.where.reason, 'token_usage')
          const gte = query.where.createdAt?.gte?.getTime()
          const bucket = gte === undefined ? 'life' : gte === windows[0] ? 'day' : gte === windows[1] ? 'week' : gte === windows[2] ? 'month' : null
          assert.ok(bucket, 'ledger queried with an unknown window start')
          return { _sum: { amountCents: spent[bucket], tokens: 0 } }
        },
      },
    },
  }
}

function makeRoute({ db, env, session }) {
  const world = createWorld({
    context: { process: { env } },
    externals: {
      'crypto': nodeCrypto,
      'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
      'next-auth': { getServerSession: async () => session },
      '@/lib/auth-options': { authOptions: {} },
      '@/lib/prisma': { prisma: db.prisma },
      '@/lib/stripe/stripe-utils': { getUserSubscription: async () => null },
      '@/lib/build-version': { BUILD_FINGERPRINT: 'fingerprint' },
      '@/lib/diagram-catalog': { DIAGRAM_CATALOG_VERSION: 'catalog-1' },
    },
  })
  const est = world.load('lib/quota/est-time')
  const at = new Date(FixedDate.nowMs)
  db.setWindows([est.startOfDayEastUtc(at).getTime(), est.startOfWeekEastUtc(at).getTime(), est.startOfMonthEastUtc(at).getTime()])
  return world
}

async function mint({ dbSpec, flag, session, secret = SIGNING, query = `session_id=${SESSION_ID}` }) {
  const db = makeDb(dbSpec)
  const env = { ...(secret ? { DIRECTOR_WS_AUTH_SECRET: secret } : {}), ...(flag === undefined ? {} : { DECKSTER_WS_BQ_CLAIM_ENABLED: flag }) }
  const world = makeRoute({ db, env, session: session ?? { user: { id: USER_ID } } })
  const route = world.load('app/api/director/ws-token/route')
  const response = await route.GET({ nextUrl: new URL(`http://localhost/api/director/ws-token?${query}`) })
  const body = await response.json()
  const result = { db, world, status: response.status, body }
  if (typeof body.auth_token === 'string') {
    const [payloadB64, signature] = body.auth_token.split('.')
    result.payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8')
    result.payload = JSON.parse(result.payloadJson)
    result.signatureOk = nodeCrypto.createHmac('sha256', SIGNING).update(payloadB64).digest('base64url') === signature
    result.authToken = body.auth_token
  }
  return result
}

const NOW_S = FixedDate.nowMs / 1000
const LEGACY_PAYLOAD = tier => JSON.stringify({ sub: USER_ID, sid: SESSION_ID, iat: NOW_S, exp: NOW_S + 900, kg_entitled: tier === 'premium' })

// tier x wallet x ledger windows -> the claim an independent reading of the contract expects.
const SCENARIOS = [
  { name: 'free tier, $0 wallet', db: { tier: 'free', wallet: 0 }, claim: { ok: false, r: 'plan_required', tier: 'free', reset: null } },
  { name: 'free tier with prepaid credit', db: { tier: 'free', wallet: 500 }, claim: { ok: true, r: null, tier: 'free', reset: null } },
  { name: 'starter, daily cap used, $0 wallet', db: { tier: 'starter', wallet: 0, spent: { day: 250, week: 250, month: 250 } }, claim: { ok: false, r: 'daily_limit', tier: 'starter', reset: DAILY_RESET } },
  { name: 'pro, weekly cap used while the day is still open', db: { tier: 'pro', wallet: 0, spent: { day: 100, week: 1250, month: 1250 } }, claim: { ok: false, r: 'weekly_limit', tier: 'pro', reset: WEEKLY_RESET } },
  { name: 'pro, daily and weekly both used: daily wins', db: { tier: 'pro', wallet: 0, spent: { day: 625, week: 1250, month: 1250 } }, claim: { ok: false, r: 'daily_limit', tier: 'pro', reset: DAILY_RESET } },
  { name: 'pro, cap used but a $0.01 reserve covers it', db: { tier: 'pro', wallet: 1, spent: { day: 625, week: 1250, month: 1250 } }, claim: { ok: true, r: null, tier: 'pro', reset: null } },
  { name: 'pro, a negative wallet does not cover a used cap', db: { tier: 'pro', wallet: -50, spent: { day: 625, week: 1250, month: 1250 } }, claim: { ok: false, r: 'daily_limit', tier: 'pro', reset: DAILY_RESET } },
  { name: 'pro within both caps', db: { tier: 'pro', wallet: 0, spent: { day: 100, week: 200, month: 300 } }, claim: { ok: true, r: null, tier: 'pro', reset: null } },
  { name: 'premium within caps', db: { tier: 'premium', wallet: 0, spent: { day: 1249, week: 2499, month: 2499 } }, claim: { ok: true, r: null, tier: 'premium', reset: null } },
  { name: 'premium, daily cap used, $0 wallet', db: { tier: 'premium', wallet: 0, spent: { day: 1250, week: 1250, month: 1250 } }, claim: { ok: false, r: 'daily_limit', tier: 'premium', reset: DAILY_RESET } },
  { name: 'a tier value the pricing table does not know has no allowance', db: { tier: 'enterprise', wallet: 0 }, claim: { ok: false, r: 'plan_required', tier: 'enterprise', reset: null } },
  { name: 'no user row reads as free', db: { noUserRow: true }, claim: { ok: false, r: 'plan_required', tier: 'free', reset: null } },
]
const UNVERIFIED_UNKNOWN_TIER = { ok: null, r: 'unverified', tier: null, reset: null }
const FAILURES = [
  { name: 'user lookup fails', db: { userThrows: true }, claim: UNVERIFIED_UNKNOWN_TIER },
  { name: 'ledger lookup fails after the tier was read', db: { tier: 'pro', wallet: 0, aggregateThrows: true }, claim: { ok: null, r: 'unverified', tier: 'pro', reset: null } },
]

// --- flag OFF: the token is today's token, byte for byte -------------------------------------
await check('flag off (unset, false, empty): the signed payload is exactly the legacy payload and nothing extra is read', async () => {
  for (const flag of [undefined, 'false', '']) {
    for (const scenario of [...SCENARIOS, ...FAILURES]) {
      const result = await mint({ dbSpec: scenario.db, flag })
      assert.equal(result.status, 200, scenario.name)
      assert.equal(result.payloadJson, LEGACY_PAYLOAD(scenario.db.tier), `${scenario.name}: payload bytes`)
      assert.deepEqual(Object.keys(result.body), ['auth_enabled', 'auth_token', 'expires_in'], `${scenario.name}: response keys`)
      assert.equal(result.signatureOk, true)
      assert.equal(result.payload.bq, undefined)
      assert.equal(result.db.calls.some(c => c[0] === 'walletTransaction.aggregate'), false, 'no ledger read with the flag off')
      assert.deepEqual(result.db.calls.map(c => c[0]), ['chatSession.findUnique', 'user.findUnique'], 'exactly the reads the route made before this change')
    }
  }
})

// --- flag ON: bq is present, correct, signed with the same secret and shares the token's exp --
await check('flag on: bq carries the right ok / r / tier / reset for every tier x wallet x window case', async () => {
  for (const scenario of SCENARIOS) {
    const result = await mint({ dbSpec: scenario.db, flag: 'true' })
    assert.equal(result.status, 200, scenario.name)
    assert.deepEqual(plain(result.payload.bq), { v: 1, ...scenario.claim }, scenario.name)
    assert.equal(result.signatureOk, true, `${scenario.name}: HMAC over the payload that includes bq`)
    assert.deepEqual(Object.keys(result.payload), ['sub', 'sid', 'iat', 'exp', 'kg_entitled', 'bq'])
    assert.equal(result.payload.exp - result.payload.iat, 900, 'bq lives exactly as long as the token')
    assert.equal(result.body.bq_claim, true)
    assert.equal(result.body.expires_in, 900)
    assert.equal(result.payload.sub, USER_ID)
  }
})
await check('flag on: only the bq key is added to the legacy payload and the response gains only bq_claim', async () => {
  for (const scenario of SCENARIOS) {
    const off = await mint({ dbSpec: scenario.db, flag: 'false' })
    const on = await mint({ dbSpec: scenario.db, flag: 'true' })
    const { bq, ...rest } = on.payload
    assert.ok(bq)
    assert.equal(JSON.stringify(rest), off.payloadJson, 'every other field is unchanged, in order')
    const { bq_claim, ...restBody } = on.body
    assert.equal(bq_claim, true)
    assert.deepEqual(Object.keys(restBody), Object.keys(off.body))
  }
})
await check('flag on: a database failure mints ok:null / unverified and never fails the mint', async () => {
  for (const scenario of FAILURES) {
    const result = await mint({ dbSpec: scenario.db, flag: 'true' })
    assert.equal(result.status, 200, scenario.name)
    assert.deepEqual(plain(result.payload.bq), { v: 1, ...scenario.claim }, scenario.name)
    assert.equal(result.signatureOk, true)
    assert.equal(result.payload.sub, USER_ID)
    assert.equal(result.body.bq_claim, true)
    assert.ok(result.world.logs.some(l => l[0] === 'error' && /build-quota lookup failed/.test(String(l[1]))), 'the failure is logged, not thrown')
  }
})
await check('flag on: a lookup that never answers is cut off at the timeout as ok:null', async () => {
  const db = makeDb({ tier: 'pro', wallet: 0, aggregateHangs: true })
  const world = makeRoute({ db, env: { DECKSTER_WS_BQ_CLAIM_ENABLED: 'true' }, session: { user: { id: USER_ID } } })
  const { mintBuildQuotaClaim, BQ_LOOKUP_TIMEOUT_MS } = createWorld({
    context: { process: { env: {} } },
    externals: { '@/lib/prisma': { prisma: db.prisma } },
  }).load('lib/quota/build-quota-claim')
  assert.equal(BQ_LOOKUP_TIMEOUT_MS, 4000)
  const started = Date.now()
  const claim = plain(await mintBuildQuotaClaim(USER_ID, { timeoutMs: 25 }))
  assert.deepEqual(claim, { v: 1, ok: null, r: 'unverified', tier: 'pro', reset: null })
  assert.ok(Date.now() - started < 2000)
  void world
})

// --- the identity rules of the base route are untouched with the flag on ----------------------
await check('flag on: auth_enabled:false without a signing secret, 401 without a session, 400 without a session id; no claim work', async () => {
  const noSecret = await mint({ dbSpec: { tier: 'free', wallet: 0 }, flag: 'true', secret: '' })
  assert.deepEqual(plain(noSecret.body), { auth_enabled: false, auth_token: null })
  assert.equal(noSecret.db.calls.length, 0)
  const anon = await (async () => {
    const db = makeDb({ tier: 'free', wallet: 0 })
    const world = makeRoute({ db, env: { DIRECTOR_WS_AUTH_SECRET: SIGNING, DECKSTER_WS_BQ_CLAIM_ENABLED: 'true' }, session: null })
    const response = await world.load('app/api/director/ws-token/route').GET({ nextUrl: new URL('http://localhost/api/director/ws-token?session_id=x') })
    return { status: response.status, calls: db.calls }
  })()
  assert.equal(anon.status, 401)
  assert.equal(anon.calls.length, 0)
  const noSid = await mint({ dbSpec: { tier: 'free', wallet: 0 }, flag: 'true', query: '' })
  assert.equal(noSid.status, 400)
  assert.equal(noSid.db.calls.length, 0)
})

// --- the session JWT never decides ------------------------------------------------------------
await check('a forged session JWT (tier, approval, wallet) has no effect on the claim in either direction', async () => {
  const forgedUp = { user: { id: USER_ID, tier: 'premium', approved: true, walletBalanceCents: 999999, subscription: { status: 'active', tier: 'premium' } } }
  const upResult = await mint({ dbSpec: { tier: 'free', wallet: 0 }, flag: 'true', session: forgedUp })
  assert.deepEqual(plain(upResult.payload.bq), { v: 1, ok: false, r: 'plan_required', tier: 'free', reset: null })
  const forgedDown = { user: { id: USER_ID, tier: 'free', approved: false, walletBalanceCents: 0 } }
  const downResult = await mint({ dbSpec: { tier: 'pro', wallet: 0, spent: { day: 100, week: 100, month: 100 } }, flag: 'true', session: forgedDown })
  assert.deepEqual(plain(downResult.payload.bq), { v: 1, ok: true, r: null, tier: 'pro', reset: null })
  // Every read is keyed by the user id and nothing else.
  for (const call of [...upResult.db.calls, ...downResult.db.calls].filter(c => c[0] !== 'chatSession.findUnique')) {
    const where = call[1].where
    assert.ok(where.id === USER_ID || where.userId === USER_ID, `${call[0]} is keyed by the user id`)
  }
})
await check('the claim modules cannot see the session: no next-auth, no session, no JWT in their code', () => {
  for (const file of ['lib/quota/build-quota.ts', 'lib/quota/build-quota-claim.ts']) {
    const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, removeComments: true } }).outputText
    assert.doesNotMatch(code, /next-auth|getServerSession|authOptions|session|jwt/i, file)
  }
  assert.match(read('app/api/director/ws-token/route.ts'), /mintBuildQuotaClaim\(session\.user\.id\)/, 'only the id is handed over')
})

// --- /api/version reports the flag only when it is on -----------------------------------------
await check('/api/version: byte-identical with the flag off, one extra key with it on', async () => {
  const get = async flag => {
    const world = createWorld({
      context: { process: { env: flag === undefined ? {} : { DECKSTER_WS_BQ_CLAIM_ENABLED: flag } } },
      externals: { 'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } }, '@/lib/build-version': { BUILD_FINGERPRINT: 'fingerprint' }, '@/lib/diagram-catalog': { DIAGRAM_CATALOG_VERSION: 'catalog-1' } },
    })
    return (await world.load('app/api/version/route').GET()).text()
  }
  const legacy = JSON.stringify({ build_sha: 'fingerprint', diagram_catalog_version: 'catalog-1' })
  for (const flag of [undefined, 'false', '']) assert.equal(await get(flag), legacy)
  assert.equal(await get('true'), JSON.stringify({ build_sha: 'fingerprint', diagram_catalog_version: 'catalog-1', ws_bq_claim_enabled: true }))
})

// --- one predicate: the shared function equals Studio's browser gate on the same fixtures -----
await check('the shared predicate equals the browser gate in app/builder/page.tsx on a full tier x wallet x window matrix', () => {
  const pageSource = read('app/builder/page.tsx')
  const page = ts.createSourceFile('page.tsx', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let preflight = null
  const find = (node, visit) => { if (visit(node)) return node; let found = null; ts.forEachChild(node, child => { found ??= find(child, visit) }); return found }
  preflight = find(page, n => ts.isVariableDeclaration(n) && n.name.getText(page) === 'preflightDirectorTurn')
  assert.ok(preflight, 'preflightDirectorTurn exists')
  const gate = find(preflight, n => ts.isIfStatement(n) && /walletBalanceCents/.test(n.expression.getText(page)))
  assert.ok(gate, 'the quota branch of preflightDirectorTurn exists')
  const condition = gate.expression.getText(page)
  const isDailyDeclaration = find(gate.thenStatement, n => ts.isVariableDeclaration(n) && n.name.getText(page) === 'isDaily')
  assert.ok(isDailyDeclaration, 'the browser gate names the daily window first')
  assert.equal(condition.replace(/\s+/g, ' '), 'q && (q.flags.dailyAt || q.flags.weeklyAt) && q.walletBalanceCents <= 0', 'the browser predicate is the one the contract names')
  const browserBlocks = new Function('q', `return Boolean(${condition})`)
  const browserIsDaily = new Function('q', `return Boolean(${isDailyDeclaration.initializer.getText(page)})`)

  const world = createWorld({ externals: {} })
  const { isBuildBlockedByQuota, buildQuotaClaimFromStatus } = world.load('lib/quota/build-quota')
  const reset = { daily: DAILY_RESET, weekly: WEEKLY_RESET }
  let cases = 0
  for (const tier of ['free', 'starter', 'pro', 'premium', 'enterprise']) {
    const monthlyCents = { free: 0, starter: 2000, pro: 5000, premium: 10000, enterprise: 0 }[tier]
    for (const walletBalanceCents of [-100, 0, 1, 2500]) {
      for (const dailyAt of [false, true]) {
        for (const weeklyAt of [false, true]) {
          const q = { tier, caps: { monthlyCents }, flags: { dailyNear: false, dailyAt, weeklyNear: false, weeklyAt }, walletBalanceCents, resetAt: reset }
          const blocked = browserBlocks(q)
          assert.equal(isBuildBlockedByQuota(q), blocked, JSON.stringify(q))
          const claim = plain(buildQuotaClaimFromStatus(q))
          assert.equal(claim.ok, !blocked, JSON.stringify(q))
          if (!blocked) assert.deepEqual(claim, { v: 1, ok: true, r: null, tier, reset: null })
          else if (monthlyCents <= 0) assert.deepEqual(claim, { v: 1, ok: false, r: 'plan_required', tier, reset: null })
          else if (browserIsDaily(q)) assert.deepEqual(claim, { v: 1, ok: false, r: 'daily_limit', tier, reset: reset.daily })
          else assert.deepEqual(claim, { v: 1, ok: false, r: 'weekly_limit', tier, reset: reset.weekly })
          cases++
        }
      }
    }
  }
  assert.equal(cases, 80)
  // The browser gate lets a send through while the quota fetch is still unanswered (q is null);
  // the claim has no such state: it is either decided or ok:null.
  assert.equal(browserBlocks(null), false)
})

// --- the forced refresh, run from the REAL scheduleAuthRefresh in the WS hook ------------------
function loadScheduleAuthRefresh() {
  const source = read('hooks/use-deckster-websocket-v2.ts')
  const file = ts.createSourceFile('hook.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const find = (node, visit) => { if (visit(node)) return node; let found = null; ts.forEachChild(node, child => { found ??= find(child, visit) }); return found }
  const declaration = find(file, n => ts.isVariableDeclaration(n) && n.name.getText(file) === 'scheduleAuthRefresh')
  assert.ok(declaration, 'scheduleAuthRefresh exists')
  const fn = declaration.initializer.arguments[0]
  const script = `globalThis.scheduleAuthRefresh = ${fn.getText(file)};`
  return ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
}
const SCHEDULE_SOURCE = loadScheduleAuthRefresh()

function hookHarness({ responses } = {}) {
  let nextId = 0
  const timers = new Map()
  const fetches = []
  const logs = []
  const socket = { readyState: 1, sent: [], send(frame) { this.sent.push(JSON.parse(frame)) } }
  const refs = {
    authRefreshTimerRef: { current: undefined }, wsRef: { current: socket }, connectionAttemptGenerationRef: { current: 1 },
    sessionIdRef: { current: SESSION_ID }, userIdRef: { current: USER_ID }, turnSubmissionLifecycleRef: { current: { active: true, generation: 1 } },
    configurationErrorRef: { current: null }, connectionDesiredRef: { current: true }, manualDisconnectRef: { current: false },
    bqClaimActiveRef: { current: false }, forceAuthRefreshRef: { current: null }, forcedAuthRefreshInFlightRef: { current: false },
  }
  const queue = [...(responses ?? [])]
  const context = {
    ...refs,
    WebSocket: { OPEN: 1 },
    debugLog: () => {},
    encodeURIComponent,
    console: { warn: (...a) => logs.push(a), error: (...a) => logs.push(a), log: () => {} },
    setTimeout: (fn, ms) => { const id = ++nextId; timers.set(id, { fn, ms }); return id },
    clearTimeout: id => { timers.delete(id) },
    clearAuthRefreshTimer: () => { if (refs.authRefreshTimerRef.current) { context.clearTimeout(refs.authRefreshTimerRef.current); refs.authRefreshTimerRef.current = undefined } },
    fetch: async url => {
      fetches.push(url)
      const next = queue.length ? queue.shift() : { ok: true, status: 200, body: {} }
      const value = typeof next === 'function' ? await next() : next
      return { ok: value.ok !== false, status: value.status ?? 200, json: async () => value.body }
    },
  }
  vm.runInNewContext(SCHEDULE_SOURCE, context)
  return { ...refs, context, socket, timers, fetches, logs, schedule: () => context.scheduleAuthRefresh(900) }
}
const minted = (n, extra = {}) => ({ body: { auth_enabled: true, auth_token: ['minted', n].join('-'), expires_in: 900, ...extra } })

await check('hook, flag off: the forced refresh is inert and the ~9 minute timer behaves exactly as before', async () => {
  const h = hookHarness({ responses: [minted(1)] })
  h.schedule()
  assert.equal(h.timers.size, 1)
  assert.equal([...h.timers.values()][0].ms, 540_000)
  assert.equal(typeof h.forceAuthRefreshRef.current, 'function')
  h.forceAuthRefreshRef.current() // bqClaimActiveRef is false: the token has no claim
  await settle()
  assert.equal(h.fetches.length, 0)
  assert.equal(h.socket.sent.length, 0)
  assert.equal(h.timers.size, 1)
  // The ordinary timer still refreshes and re-arms, and the response (no bq_claim) leaves the claim inactive.
  ;[...h.timers.values()][0].fn()
  await settle()
  assert.deepEqual(h.fetches, [`/api/director/ws-token?session_id=${SESSION_ID}`])
  assert.deepEqual(plain(h.socket.sent), [{ type: 'auth_refresh', payload: { token: 'minted-1' } }])
  assert.equal(h.bqClaimActiveRef.current, false)
  assert.equal(h.timers.size, 1)
})
await check('hook, flag on: a forced refresh re-mints now, sends auth_refresh, re-arms and keeps the claim active', async () => {
  const h = hookHarness({ responses: [minted(1, { bq_claim: true }), minted(2, { bq_claim: true })] })
  h.schedule()
  const firstTimer = [...h.timers.keys()][0]
  h.bqClaimActiveRef.current = true // set at connect from the ws-token response
  const firstForce = h.forceAuthRefreshRef.current
  firstForce()
  await settle()
  assert.deepEqual(h.fetches, [`/api/director/ws-token?session_id=${SESSION_ID}`])
  assert.deepEqual(plain(h.socket.sent), [{ type: 'auth_refresh', payload: { token: 'minted-1' } }])
  assert.equal(h.timers.has(firstTimer), false, 'the pending timer was cancelled, not left to double-refresh')
  assert.equal(h.timers.size, 1)
  assert.equal([...h.timers.values()][0].ms, 540_000, 're-armed at 60% of the token lifetime')
  assert.equal(h.bqClaimActiveRef.current, true)
  assert.notEqual(h.forceAuthRefreshRef.current, firstForce, 'the next refresh closure is installed')
  h.forceAuthRefreshRef.current()
  await settle()
  assert.equal(h.socket.sent.length, 2)
  assert.deepEqual(plain(h.socket.sent[1]), { type: 'auth_refresh', payload: { token: 'minted-2' } })
})
await check('hook: a refresh that comes back without a claim deactivates the forced path', async () => {
  const h = hookHarness({ responses: [minted(1)] })
  h.schedule()
  h.bqClaimActiveRef.current = true
  h.forceAuthRefreshRef.current()
  await settle()
  assert.equal(h.socket.sent.length, 1)
  assert.equal(h.bqClaimActiveRef.current, false)
  h.forceAuthRefreshRef.current()
  await settle()
  assert.equal(h.fetches.length, 1)
})
await check('hook: simultaneous requests (redeem + top-up + follow-up) coalesce into one mint', async () => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const h = hookHarness({ responses: [async () => { await gate; return minted(1, { bq_claim: true }) }] })
  h.schedule()
  h.bqClaimActiveRef.current = true
  const force = h.forceAuthRefreshRef.current
  force(); force(); force()
  await settle()
  assert.equal(h.fetches.length, 1)
  release()
  await settle()
  assert.equal(h.socket.sent.length, 1)
  h.forceAuthRefreshRef.current()
  await settle()
  assert.equal(h.fetches.length, 2, 'a later request is served once the first has finished')
})
await check('hook: a stale socket (replaced, closed, other session, manual disconnect) is never refreshed', async () => {
  const mutations = [
    h => { h.wsRef.current = { readyState: 1, send() { throw new Error('stale socket used') } } },
    h => { h.socket.readyState = 3 },
    h => { h.sessionIdRef.current = 'another-session' },
    h => { h.userIdRef.current = 'another-user' },
    h => { h.manualDisconnectRef.current = true },
    h => { h.connectionAttemptGenerationRef.current = 2 },
  ]
  for (const mutate of mutations) {
    const h = hookHarness({ responses: [minted(1, { bq_claim: true })] })
    h.schedule()
    h.bqClaimActiveRef.current = true
    mutate(h)
    h.forceAuthRefreshRef.current()
    await settle()
    assert.equal(h.fetches.length, 0)
    assert.equal(h.socket.sent.length, 0)
  }
})
await check('hook: a failed forced mint sends nothing and falls back to the existing retry; a tokenless answer sends nothing', async () => {
  const failed = hookHarness({ responses: [{ ok: false, status: 503, body: {} }] })
  failed.schedule()
  failed.bqClaimActiveRef.current = true
  failed.forceAuthRefreshRef.current()
  await settle()
  assert.equal(failed.socket.sent.length, 0)
  assert.equal(failed.logs.length, 1)
  assert.equal([...failed.timers.values()].at(-1).ms, 30_000, 'the existing quick-retry timer is armed')
  assert.equal(failed.timers.size, 1, 'the superseded ~9 minute timer is gone, so no duplicate refresh fires later')
  const tokenless = hookHarness({ responses: [{ body: { auth_enabled: false, auth_token: null } }] })
  tokenless.schedule()
  tokenless.bqClaimActiveRef.current = true
  tokenless.forceAuthRefreshRef.current()
  await settle()
  assert.equal(tokenless.socket.sent.length, 0)
})
await check('hook source: the connect-time response sets the claim state and the socket subscribes to refresh requests', () => {
  const source = read('hooks/use-deckster-websocket-v2.ts')
  const connectBranch = source.indexOf("protocols = ['deckster.v1', `deckster-auth.${tokenBody.auth_token}`];")
  const setActive = source.indexOf('bqClaimActiveRef.current = tokenBody.bq_claim === true;')
  assert.ok(connectBranch > 0 && setActive > connectBranch && setActive - connectBranch < 200, 'set right where the token is accepted')
  assert.equal(source.split('bqClaimActiveRef.current = body.bq_claim === true;').length, 2, 'set from each refresh response')
  // The hook's import list is unchanged (the evidence harnesses that load the real hook enumerate it).
  assert.doesNotMatch(source, /from '@\/lib\/ws-bq-refresh'/)
})

// --- the triggers: how a redeem / top-up / checkout reaches the open builder -------------------
function bqEnv() {
  const timers = new Map()
  let id = 0
  const channels = new Map()
  class FakeBroadcastChannel {
    constructor(name) { this.name = name; this.onmessage = null; this.closed = false; if (!channels.has(name)) channels.set(name, new Set()); channels.get(name).add(this) }
    postMessage(data) { for (const other of channels.get(this.name)) if (other !== this && !other.closed && other.onmessage) other.onmessage({ data: plain(data) }) }
    close() { this.closed = true; channels.get(this.name).delete(this) }
  }
  const listeners = new Map()
  const window = {
    dispatchEvent: event => { for (const l of listeners.get(event.type) ?? []) l(event); return true },
    addEventListener: (type, l) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(l) },
    removeEventListener: (type, l) => listeners.get(type)?.delete(l),
  }
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail } }
  const context = {
    window, CustomEvent,
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id }, clearTimeout: t => { timers.delete(t) },
  }
  return { context, timers, withChannel: () => ({ ...context, BroadcastChannel: FakeBroadcastChannel }), channels }
}

function loadHookRefreshEffect() {
  const source = read('hooks/use-deckster-websocket-v2.ts')
  const file = ts.createSourceFile('hook.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const find = (node, visit) => { if (visit(node)) return node; let found = null; ts.forEachChild(node, child => { found ??= find(child, visit) }); return found }
  const effect = find(file, n => ts.isCallExpression(n) && n.expression.getText(file) === 'useEffect' && /ws-bq-refresh/.test(n.arguments[0]?.getText(file) ?? ''))
  assert.ok(effect, 'the hook has an effect that listens for refresh requests')
  const callback = effect.arguments[0].getText(file)
  const literals = [...new Set([...callback.matchAll(/'([^']+)'/g)].map(m => m[1]))].filter(text => text !== 'undefined')
  return { literals, deps: effect.arguments[1].getText(file), script: ts.transpileModule(`globalThis.effect = ${callback};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText }
}

await check('refresh requests (sender): redeem fires once; top-up and checkout ask once more after 10 s; cancel stops it; SSR is harmless', () => {
  const env = bqEnv()
  const world = createWorld({ context: env.withChannel() })
  const { requestBqClaimRefresh, BQ_REFRESH_FOLLOW_UP_MS, BQ_REFRESH_CHANNEL } = world.load('lib/ws-bq-refresh')
  assert.equal(BQ_REFRESH_FOLLOW_UP_MS, 10_000)
  const heard = []
  const listener = new (env.withChannel().BroadcastChannel)(BQ_REFRESH_CHANNEL)
  listener.onmessage = event => heard.push(event.data.reason)
  requestBqClaimRefresh('redeem')
  assert.deepEqual(heard, ['redeem'])
  assert.equal(env.timers.size, 0, 'a redeem credits inside its own request: no follow-up')
  requestBqClaimRefresh('topup')
  assert.deepEqual(heard, ['redeem', 'topup'])
  assert.equal(env.timers.size, 1)
  const [followUpId, followUp] = [...env.timers.entries()][0]
  assert.equal(followUp.ms, 10_000)
  followUp.fn()
  env.timers.delete(followUpId)
  assert.deepEqual(heard, ['redeem', 'topup', 'topup'], 'the webhook-lag follow-up')
  const cancelCheckout = requestBqClaimRefresh('checkout')
  assert.equal(env.timers.size, 1)
  cancelCheckout() // the billing page unmounted before the follow-up
  assert.equal(env.timers.size, 0)
  assert.deepEqual(heard, ['redeem', 'topup', 'topup', 'checkout'])
  const ssr = createWorld({ context: {} }).load('lib/ws-bq-refresh')
  assert.doesNotThrow(() => { ssr.requestBqClaimRefresh('redeem')(); ssr.requestBqClaimRefresh('topup')() })
})

await check('refresh requests reach the real hook effect: another tab by channel, window event as fallback, cleanup unsubscribes', () => {
  const { literals, deps, script } = loadHookRefreshEffect()
  const lib = createWorld({ context: bqEnv().context }).load('lib/ws-bq-refresh')
  assert.deepEqual(literals, [lib.BQ_REFRESH_CHANNEL, lib.BQ_REFRESH_EVENT], 'the hook spells the same channel and event names as the sender')
  assert.equal(deps, '[]', 'subscribed once per mount')

  // (a) BroadcastChannel browser; the sender is another tab's world sharing the same channel registry.
  const env = bqEnv()
  const senderTab = createWorld({ context: env.withChannel() }).load('lib/ws-bq-refresh')
  let refreshes = 0
  const hookContext = { ...env.withChannel(), forceAuthRefreshRef: { current: () => { refreshes++ } } }
  vm.runInNewContext(script, hookContext)
  const cleanup = hookContext.effect()
  assert.equal(typeof cleanup, 'function')
  senderTab.requestBqClaimRefresh('redeem')
  assert.equal(refreshes, 1)
  senderTab.requestBqClaimRefresh('topup')
  assert.equal(refreshes, 2)
  hookContext.forceAuthRefreshRef.current = null // no socket scheduled yet: nothing to do, nothing thrown
  assert.doesNotThrow(() => senderTab.requestBqClaimRefresh('redeem'))
  hookContext.forceAuthRefreshRef.current = () => { refreshes++ }
  cleanup()
  senderTab.requestBqClaimRefresh('redeem')
  assert.equal(refreshes, 2, 'an unmounted builder hears nothing')

  // (b) no BroadcastChannel: the window event.
  const fallback = bqEnv()
  const fallbackLib = createWorld({ context: fallback.context }).load('lib/ws-bq-refresh')
  let eventRefreshes = 0
  const eventContext = { ...fallback.context, forceAuthRefreshRef: { current: () => { eventRefreshes++ } } }
  vm.runInNewContext(script, eventContext)
  const stop = eventContext.effect()
  fallbackLib.requestBqClaimRefresh('redeem')
  assert.equal(eventRefreshes, 1)
  stop()
  fallbackLib.requestBqClaimRefresh('redeem')
  assert.equal(eventRefreshes, 1)

  // (c) server render / test harness without a window or channel: the effect is inert.
  const bare = { forceAuthRefreshRef: { current: () => assert.fail('never') } }
  vm.runInNewContext(script, bare)
  assert.equal(bare.effect(), undefined)
})

await check('triggers are wired to the real return paths: /redeem after the coupon is credited, /billing on the Stripe success URLs', () => {
  const redeem = read('app/(auth)/redeem/page.tsx')
  const credited = redeem.indexOf('setSuccess({ creditedCents')
  const requested = redeem.indexOf("requestBqClaimRefresh('redeem')")
  const sessionWrite = redeem.indexOf('await update({')
  assert.ok(credited > 0 && requested > credited && sessionWrite > requested, "refresh is requested after a successful redeem and before the JWT update that can throw")
  assert.match(redeem, /import \{ requestBqClaimRefresh \} from '@\/lib\/ws-bq-refresh'/)

  const billing = read('app/(app)/billing/page.tsx')
  assert.match(billing, /searchParams\?\.get\("topup"\)/)
  assert.match(billing, /searchParams\?\.get\("success"\)/)
  assert.match(billing, /if \(topUpResult === "success"\) return requestBqClaimRefresh\("topup"\)/)
  assert.match(billing, /if \(checkoutResult === "true"\) return requestBqClaimRefresh\("checkout"\)/)
  // The query strings the billing page reacts to are the ones Stripe is actually sent back with.
  assert.match(read('app/api/stripe/create-topup-session/route.ts'), /success_url: `\$\{baseUrl\}\/billing\?topup=success/)
  assert.match(read('app/api/stripe/create-checkout-session/route.ts'), /\/billing\?success=true/)
  // The effect sits before the billing page's early returns, so it is a legal, unconditional hook.
  assert.ok(billing.indexOf('requestBqClaimRefresh("topup")') < billing.indexOf('if (isLoading || isLoadingSubscription)'))
})

console.log(`${checks} ws bq-claim checks passed`)
