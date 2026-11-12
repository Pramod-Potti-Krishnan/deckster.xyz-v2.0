// R-20261007-frontend-15 / contract F-quota-bq-claim v1: the signed build-quota claim `bq`
// carried in the Director WS token (flag DECKSTER_WS_BQ_CLAIM_ENABLED, server env, default off).
// Keyless and offline: the real route + quota code run against a stubbed database, the real
// WS hook's refresh function runs against a stubbed socket and fetch. No model, network or secret.
// Restacked onto Studio dev 9aedba04 (12 Nov): the files this change edits are read through the registry's strips of the changes registered AFTER it (none today), and the last checks prove its
// strip, its .env.example block and its registry lines (scripts/studio-ws-bq-claim-strip.mjs). The behavioural checks are unchanged; one position check on the hook is now an order check.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import nodeCrypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import * as registry from './studio-later-changes.mjs'
import { BASE_COMMIT, WS_BQ_CLAIM_EDITS, WS_BQ_CLAIM_ENV_BLOCK, WS_BQ_CLAIM_FLAGS, WS_BQ_CLAIM_MARKED_FILES, WS_BQ_CLAIM_MARKER_RE, WS_BQ_CLAIM_SCOPE_FILES, stripWsBqClaim } from './studio-ws-bq-claim-strip.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const plain = value => JSON.parse(JSON.stringify(value))
const readRaw = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
/** Only the strips of the changes registered AFTER this one, in the registry's order: on a branch stacked after this change a later change's own lines are undone first, so a file reads as this change left it. Nothing while this change is the last registered. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripWsBqClaim); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const read = relative => laterStrips(relative, readRaw(relative))
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

function createWorld({ externals = {}, context = {}, sources = {} } = {}) {
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
    const output = ts.transpileModule(sources[relative] ?? fs.readFileSync(file, 'utf8'), {
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

function makeRoute({ db, env, session, sources }) {
  const world = createWorld({
    sources,
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

async function mint({ dbSpec, flag, session, secret = SIGNING, query = `session_id=${SESSION_ID}`, sources }) {
  const db = makeDb(dbSpec)
  const env = { ...(secret ? { DIRECTOR_WS_AUTH_SECRET: secret } : {}), ...(flag === undefined ? {} : { DECKSTER_WS_BQ_CLAIM_ENABLED: flag }) }
  const world = makeRoute({ db, env, session: session ?? { user: { id: USER_ID } }, sources })
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
  { name: 'a tier value outside the four plans is read as free (never echoed) and has no allowance', db: { tier: 'enterprise', wallet: 0 }, claim: { ok: false, r: 'plan_required', tier: 'free', reset: null } },
  { name: 'a stored tier in another case is read as free, not as the paid tier it spells', db: { tier: 'PREMIUM', wallet: 0 }, claim: { ok: false, r: 'plan_required', tier: 'free', reset: null } },
  { name: 'an unknown stored tier with prepaid credit builds as free, as the browser gate lets it', db: { tier: 'admin', wallet: 500 }, claim: { ok: true, r: null, tier: 'free', reset: null } },
  { name: 'no user row reads as free', db: { noUserRow: true }, claim: { ok: false, r: 'plan_required', tier: 'free', reset: null } },
]
const UNVERIFIED_UNKNOWN_TIER = { ok: null, r: 'unverified', tier: null, reset: null }
const FAILURES = [
  { name: 'user lookup fails', db: { userThrows: true }, claim: UNVERIFIED_UNKNOWN_TIER },
  { name: 'ledger lookup fails after the tier was read', db: { tier: 'pro', wallet: 0, aggregateThrows: true }, claim: { ok: null, r: 'unverified', tier: 'pro', reset: null } },
  { name: 'ledger lookup fails after an unknown tier was read: the unverified claim carries free, never the stored value', db: { tier: 'Premium', wallet: 0, aggregateThrows: true }, claim: { ok: null, r: 'unverified', tier: 'free', reset: null } },
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

// --- the tier is checked against the four plans BEFORE it is signed (PK-approved, FRONTEND-1) ----------------------------
// Director trusts the signed tier: Agent mode admits exactly "pro" / "premium", Opus needs "premium", author mode's limit reads it (lower-cased). So a stored value outside the
// four must never reach the claim as stored, and never as pro / premium: it reads as free (getServerTier, the quota and wallet routes' rule), which keeps the quota gate and Studio's browser gate on one plan.
const VALID_TIERS = ['free', 'starter', 'pro', 'premium']
const JUNK_TIERS = [
  ['upper case PRO', 'PRO'], ['capitalised Premium', 'Premium'], ['upper case PREMIUM', 'PREMIUM'], ['padded " premium"', ' premium'], ['padded "pro "', 'pro '], ['trailing newline "premium\\n"', 'premium\n'],
  ['admin', 'admin'], ['enterprise', 'enterprise'], ['a list "pro,premium"', 'pro,premium'], ['__proto__', '__proto__'], ['empty string', ''],
  ['null', null], ['undefined', undefined], ['an object', { tier: 'premium' }], ['an array', ['premium']], ['a number', 7], ['true', true],
]
/** Mint through the real route (so the SIGNED bytes are what is judged) for every valid and every junk stored tier, wallet empty and funded. Returns what broke, empty when every rule holds. */
async function tierProbe(sources) {
  const broke = []
  const note = (what, cond) => { if (!cond) broke.push(what) }
  for (const wallet of [0, 500]) {
    for (const tier of VALID_TIERS) {
      const result = await mint({ dbSpec: { tier, wallet }, flag: 'true', sources })
      const bq = result.payload?.bq
      note(`valid ${tier}/${wallet}: signed as stored`, result.status === 200 && bq?.tier === tier && result.signatureOk === true)
      note(`valid ${tier}/${wallet}: ok follows the plan`, bq?.ok === (tier !== 'free' || wallet > 0))
    }
    for (const [label, value] of JUNK_TIERS) {
      const result = await mint({ dbSpec: { tier: value, wallet }, flag: 'true', sources })
      const bq = result.payload?.bq
      note(`${label}/${wallet}: still a signed 200 claim`, result.status === 200 && result.signatureOk === true && bq !== undefined)
      note(`${label}/${wallet}: never signed as pro or premium`, bq !== undefined && bq.tier !== 'pro' && bq.tier !== 'premium' && !/pro|premium/i.test(String(bq.tier)))
      note(`${label}/${wallet}: signed as free`, bq?.tier === 'free')
      note(`${label}/${wallet}: the quota answer is free's`, bq?.ok === (wallet > 0) && bq?.r === (wallet > 0 ? null : 'plan_required'))
      if (typeof value === 'string' && value !== '') note(`${label}/${wallet}: the stored text is not in the signed bytes`, !String(result.payloadJson).includes(JSON.stringify(value).slice(1, -1)))
    }
  }
  const missing = await mint({ dbSpec: { noUserRow: true }, flag: 'true', sources })
  note('no user row: signed as free', missing.payload?.bq?.tier === 'free' && missing.payload.bq.ok === false)
  const hung = await mint({ dbSpec: { tier: 'PRO', wallet: 0, aggregateThrows: true }, flag: 'true', sources })
  note('an unverified claim after a junk read: carries free, not the stored value', hung.payload?.bq?.ok === null && hung.payload.bq.tier === 'free')
  return broke
}

await check('tier check: each of the four plans is signed as stored; anything else (case, padding, admin, null, undefined, an object, a list, a number) is signed as free and never as pro or premium', async () => {
  const broke = await tierProbe(undefined)
  assert.deepEqual(broke, [], `the tier check before signing: ${broke.slice(0, 3).join(' | ')}`)
})

await check('tier check: the claim reads the plan through the four-plan check, and the session is still not consulted', () => {
  const claim = read('lib/quota/build-quota-claim.ts')
  assert.match(claim, /import \{ getServerTier \} from '@\/lib\/quota\/server-tier'/)
  assert.match(claim, /return getServerTier\(userId\)/)
  assert.doesNotMatch(claim, /prisma/, 'the claim module has no raw read of the stored tier of its own')
  const tierRule = read('lib/quota/server-tier.ts')
  assert.match(tierRule, /\["free", "starter", "pro", "premium"\]/, 'the rule is exactly the four plans')
  assert.match(tierRule, /typeof tier === "string" && TIERS\.includes\(tier\) \? tier : "free"/, 'exact match, anything else is free')
})

await check('tier check mutants: removing the check, inverting it, letting an extra tier through, folding case, failing open, or signing the stored value raw each fail the probe', async () => {
  const swap = (rel, from, to) => {
    const text = read(rel)
    assert.ok(text.includes(from), `${rel}: the mutant's target text is there: ${from.slice(0, 50)}`)
    const mutated = text.replace(from, to)
    assert.notEqual(mutated, text, 'the mutant changes the file')
    return { [rel.replace(/\.ts$/, '')]: mutated }
  }
  const TIER_FILE = 'lib/quota/server-tier.ts'
  const CHECK = 'typeof tier === "string" && TIERS.includes(tier) ? tier : "free"'
  const mutants = [
    ['validation removed', swap(TIER_FILE, CHECK, 'tier ?? "free"')],
    ['validation reduced to "is a string"', swap(TIER_FILE, CHECK, 'typeof tier === "string" ? tier : "free"')],
    ['check inverted', swap(TIER_FILE, CHECK, 'typeof tier === "string" && !TIERS.includes(tier) ? tier : "free"')],
    ['an extra tier allowed (admin)', swap(TIER_FILE, '["free", "starter", "pro", "premium"]', '["free", "starter", "pro", "premium", "admin"]')],
    ['an extra tier allowed (enterprise)', swap(TIER_FILE, '["free", "starter", "pro", "premium"]', '["free", "starter", "pro", "premium", "enterprise"]')],
    ['case folded before the check, the stored text signed', swap(TIER_FILE, CHECK, 'typeof tier === "string" && TIERS.includes(tier.trim().toLowerCase()) ? tier : "free"')],
    ['fails open to pro', swap(TIER_FILE, CHECK, 'typeof tier === "string" && TIERS.includes(tier) ? tier : "pro"')],
    ['fails open to premium for a non-string', swap(TIER_FILE, CHECK, 'typeof tier === "string" ? (TIERS.includes(tier) ? tier : "free") : "premium"')],
    ['a plan dropped from the rule (premium)', swap(TIER_FILE, '["free", "starter", "pro", "premium"]', '["free", "starter", "pro"]')],
    ['the claim reads the stored tier raw (the code before this fix)', swap('lib/quota/build-quota-claim.ts', 'return getServerTier(userId)', "const row = await require('@/lib/prisma').prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }); return (row?.tier ?? 'free') as Tier")],
  ]
  for (const [name, sources] of mutants) {
    const broke = await tierProbe(sources)
    assert.ok(broke.length > 0, `mutant not caught: ${name}`)
  }
  assert.deepEqual(await tierProbe(undefined), [], 'and the real files pass the same probe')
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
  assert.ok(connectBranch > 0 && setActive > connectBranch, 'set after the token is accepted (an order check: a later change may add lines between the two)')
  assert.equal(source.split('bqClaimActiveRef.current = body.bq_claim === true;').length, 3, 'set from each refresh response: the timer callback\'s and forceRefreshNow\'s')
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

// --- the registry: this change on a newer Studio dev (the restack), so that the older proofs can still read dev's files ---------
// The strip puts back, by whole-line runs, every line this change adds to an existing file (scripts/studio-ws-bq-claim-strip.mjs); no line of this change's code is marked or edited for it.
const baseText = rel => execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const countAtLineStart = (text, needle) => { let n = 0; for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) if (at === 0 || text[at - 1] === '\n') n++; return n }
/** The block out of .env.example the way the registry takes one out: whole lines, the one blank line that separated it goes too. */
function removeBlock(text, registered) {
  const block = String(registered).replace(/^\n+/, '').replace(/\n+$/, ''); let at = text.indexOf(block)
  while (at !== -1 && !((at === 0 || text[at - 1] === '\n') && (at + block.length === text.length || text[at + block.length] === '\n'))) at = text.indexOf(block, at + 1)
  if (at === -1) return text
  const before = text.slice(0, at), after = text.slice(at + block.length)
  return /^\n*$/.test(after) ? (before.endsWith('\n\n') ? before.slice(0, -1) : before) : after.startsWith('\n\n') ? before + after.slice(2) : before + after.slice(1)
}

await check('registry strip: every file this change edits goes back to Studio dev\'s text byte for byte and idempotently, and each run it puts back is there exactly once', () => {
  const edited = ['app/(app)/billing/page.tsx', 'app/(auth)/redeem/page.tsx', 'app/api/director/ws-token/route.ts', 'app/api/version/route.ts', 'package.json', 'scripts/test-studio-billing-f4-f6.mjs', 'scripts/test-studio-billing-l5.mjs', 'scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs', 'scripts/test-studio-avatar-spawn.mjs', 'scripts/test-studio-legal-short-links.mjs']
  for (const rel of edited) assert.ok(Object.prototype.hasOwnProperty.call(WS_BQ_CLAIM_EDITS, rel), `${rel} is taught to the strip by pair`)
  assert.deepEqual([...WS_BQ_CLAIM_MARKED_FILES], ['hooks/use-deckster-websocket-v2.ts'], 'the socket hook is taught by marker, and it is the only file that is')
  assert.ok(!Object.prototype.hasOwnProperty.call(WS_BQ_CLAIM_EDITS, 'hooks/use-deckster-websocket-v2.ts'), 'no pair for the hook')
  for (const [rel, pairs] of [...Object.entries(WS_BQ_CLAIM_EDITS), ...WS_BQ_CLAIM_MARKED_FILES.map(rel => [rel, []])]) {
    const mine = laterStrips(rel, readRaw(rel)) // the file as this change left it
    const base = baseText(rel)
    for (const [has] of pairs) {
      assert.equal(countAtLineStart(mine, has), 1, `${rel}: a run of this change's lines is there exactly once: ${JSON.stringify(has.slice(0, 60))}`)
      assert.equal(countAtLineStart(base, has), 0, `${rel}: and is not in dev's file: ${JSON.stringify(has.slice(0, 60))}`)
    }
    const back = stripWsBqClaim(rel, mine)
    assert.ok(back === base, `${rel}: with this change's lines put back it is ${BASE_COMMIT.slice(0, 8)}'s text, byte for byte`)
    assert.ok(stripWsBqClaim(rel, back) === back, `${rel}: stripping twice changes nothing more`)
    assert.ok(stripWsBqClaim(rel, base) === base, `${rel}: dev's own text comes back as it is`)
  }
  assert.equal(stripWsBqClaim('lib/ws-bq-refresh.ts', 'x\n'), 'x\n', 'a file this change only adds is returned as it is')
  assert.equal(stripWsBqClaim('app/(app)/billing/page.tsx', undefined), undefined)
})

const HOOK = 'hooks/use-deckster-websocket-v2.ts'
await check('hook: this change only inserts into the socket hook (no base line removed or changed), every added line carries the marker WS-BQ-CLAIM, none is blank, and the strip takes each out even on its own', () => {
  const gitDiff = execFileSync('git', ['diff', '-U0', BASE_COMMIT, '--', HOOK], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).split('\n')
  const removed = gitDiff.filter(line => line.startsWith('-') && !line.startsWith('---'))
  assert.equal(removed.length, 0, `no line of dev's hook is removed or changed: ${removed.slice(0, 2).join(' | ')}`)
  const added = gitDiff.filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)).filter(line => laterStrips(HOOK, `${line}\n`) !== '') // a line a change registered after this one owns is that change's
  assert.ok(added.length >= 60, `this change's added hook lines: ${added.length}`)
  for (const line of added) {
    assert.notEqual(line.trim(), '', 'no added line is blank')
    assert.match(line, WS_BQ_CLAIM_MARKER_RE, `an added line carries the marker: ${line.slice(0, 80)}`)
    assert.equal(stripWsBqClaim(HOOK, `${line}\n`), '', `the strip takes the line out on its own: ${line.slice(0, 80)}`)
  }
  assert.equal(baseText(HOOK).split('\n').filter(line => WS_BQ_CLAIM_MARKER_RE.test(line)).length, 0, 'dev\'s hook has no marked line')
  assert.equal(stripWsBqClaim(HOOK, 'const ordinary = 1\n'), 'const ordinary = 1\n', 'an unmarked line stays')
  assert.equal(stripWsBqClaim('app/(app)/billing/page.tsx', '// WS-BQ-CLAIM\n'), '// WS-BQ-CLAIM\n', 'the marker strip is for the hook only')
  assert.ok(WS_BQ_CLAIM_MARKER_RE.test('x // WS-BQ-CLAIM') && WS_BQ_CLAIM_MARKER_RE.test('// WS-BQ-CLAIM: y') && !WS_BQ_CLAIM_MARKER_RE.test('WS-BQ-CLAIM-X') && !WS_BQ_CLAIM_MARKER_RE.test('X-WS-BQ-CLAIM') && !WS_BQ_CLAIM_MARKER_RE.test('DECKSTER_WS_BQ_CLAIM_ENABLED'), 'the marker is a whole token')
})

// The two paths that re-mint the Director token (the ~9 minute timer callback and the forced refresh after a top-up / redeem) are one request and one frame.
// forceRefreshNow mirrors the timer callback (the hook is FRONTEND-1's, so this change's lines there are pure insertions): a later hardening of one path that skips the other must fail here.
function remintPaths(source) {
  const file = ts.createSourceFile('hook.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const found = (node, visit, out = []) => { if (visit(node)) out.push(node); ts.forEachChild(node, child => { found(child, visit, out) }); return out } // the callback returns nothing: forEachChild stops at a truthy return
  const timers = found(file, n => ts.isCallExpression(n) && n.expression.getText(file) === 'setTimeout' && n.arguments[0] && ts.isArrowFunction(n.arguments[0]) && /ws-token/.test(n.arguments[0].getText(file)))
  assert.equal(timers.length, 1, 'one setTimeout whose callback re-mints the token')
  const forced = found(file, n => ts.isVariableDeclaration(n) && n.name.getText(file) === 'forceRefreshNow' && n.initializer && ts.isArrowFunction(n.initializer))
  assert.equal(forced.length, 1, 'forceRefreshNow exists once')
  const squash = text => text.replace(/\s+/g, ' ').trim()
  const props = object => Object.fromEntries(object.properties.map(prop => [prop.name.getText(file), squash(prop.initializer.getText(file))]))
  const describe = fn => {
    const fetches = found(fn, n => ts.isCallExpression(n) && n.expression.getText(file) === 'fetch')
    assert.equal(fetches.length, 1, 'one fetch per path')
    const sends = found(fn, n => ts.isCallExpression(n) && /\.send$/.test(n.expression.getText(file)) && n.arguments[0] && /^JSON\.stringify\(/.test(n.arguments[0].getText(file)))
    assert.equal(sends.length, 1, 'one auth frame per path')
    const frame = sends[0].arguments[0].arguments[0]
    assert.ok(ts.isObjectLiteralExpression(frame), 'the frame is an object literal')
    const frameProps = props(frame), payload = frame.properties.find(prop => prop.name.getText(file) === 'payload').initializer
    const emitted = ts.transpileModule(`const f = ${fn.getText(file)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, removeComments: true } }).outputText
    return { url: squash(fetches[0].arguments[0].getText(file)), init: props(fetches[0].arguments[1]), frameType: frameProps.type, payloadKeys: payload.properties.map(prop => prop.name.getText(file)), emitted: squash(emitted) }
  }
  return { timer: describe(timers[0].arguments[0]), forced: describe(forced[0].initializer) }
}
await check('hook: the timer callback and forceRefreshNow call the same ws-token URL with the same init and send the same auth_refresh frame, and mirror each other statement for statement (and a change to one path alone is caught)', () => {
  const same = source => { const { timer, forced } = remintPaths(source); assert.deepEqual(plain(forced.url), plain(timer.url), 'the same ws-token URL'); assert.deepEqual(plain(forced.init), plain(timer.init), 'the same init keys and values'); assert.equal(forced.frameType, timer.frameType, 'the same frame type'); assert.deepEqual(plain(forced.payloadKeys), plain(timer.payloadKeys), 'the same payload keys'); assert.equal(forced.emitted, timer.emitted, 'the same statements') }
  const source = read(HOOK)
  const { timer } = remintPaths(source)
  assert.equal(timer.url, '`/api/director/ws-token?session_id=${encodeURIComponent(refreshSessionId)}`', 'the ws-token URL carries the session id')
  assert.deepEqual(plain(timer.init), { cache: "'no-store'" }, 'the init is today\'s')
  assert.equal(timer.frameType, "'auth_refresh'")
  assert.deepEqual(plain(timer.payloadKeys), ['token'], 'the frame carries the token and nothing else')
  same(source)
  const at = source.indexOf('const forceRefreshNow')
  assert.ok(at > 0)
  assert.throws(() => same(source.slice(0, at) + source.slice(at).replace("{ cache: 'no-store' }", "{ cache: 'no-store', credentials: 'include' }")), /init/, 'a hardening of the forced path alone is caught (init)')
  assert.throws(() => same(source.slice(0, at).replace("type: 'auth_refresh',", "type: 'auth_refresh_v2',") + source.slice(at)), /frame type|statements/, 'a change of the timer path alone is caught (frame)')
  assert.throws(() => same(source.slice(0, at) + source.slice(at).replace('/api/director/ws-token?session_id=', '/api/director/ws-token-v2?session_id=')), /URL/, 'a change of the forced path\'s URL is caught')
})

await check('registry env block: at the true end of .env.example after one blank line, once, the flag documented as "false"; .env.example is dev\'s plus the registered blocks', () => {
  const env = readRaw('.env.example')
  const at = registry.LATER_ENV_BLOCKS.indexOf(WS_BQ_CLAIM_ENV_BLOCK)
  assert.ok(at >= 0, 'the registry holds the block')
  const mine = registry.LATER_ENV_BLOCKS.slice(at + 1).reduce(removeBlock, env) // a block registered after this one is that change's
  assert.equal(mine.split(WS_BQ_CLAIM_ENV_BLOCK).length - 1, 1, 'the block is there exactly once, verbatim')
  assert.ok(mine.includes(`\n\n${WS_BQ_CLAIM_ENV_BLOCK}`), 'after a blank line')
  assert.ok(mine.endsWith(WS_BQ_CLAIM_ENV_BLOCK), 'the block is the last one (the true end of the file)')
  assert.ok(WS_BQ_CLAIM_ENV_BLOCK.endsWith('\n') && !WS_BQ_CLAIM_ENV_BLOCK.endsWith('\n\n'))
  assert.equal(registry.stripLaterEnvBlocks('.env.example', env), registry.stripLaterEnvBlocks('.env.example', baseText('.env.example')), '.env.example is dev\'s plus the registered blocks and nothing else')
  for (const flag of WS_BQ_CLAIM_FLAGS) {
    assert.equal(env.split(`\n${flag}="false"\n`).length - 1, 1, `${flag} is documented as off, once`)
    assert.equal(new RegExp(`^${flag}=(?!"false"$)`, 'm').test(env), false, `${flag} is never set on`)
  }
})

await check('registry: this change\'s files, block and strip are registered once each, one line in each of the three lists', () => {
  assert.equal(registry.LATER_STRIPS.filter(fn => fn === stripWsBqClaim).length, 1, 'the strip, once')
  assert.equal(registry.LATER_ENV_BLOCKS.filter(block => block === WS_BQ_CLAIM_ENV_BLOCK).length, 1, 'the block, once')
  for (const rel of WS_BQ_CLAIM_SCOPE_FILES) assert.ok(registry.LATER_CHANGE_FILES.has(rel), `${rel} is in the registry's file list`)
  const lines = readRaw('scripts/studio-later-changes.mjs').split('\n').filter(line => line.includes("./studio-ws-bq-claim-strip.mjs"))
  assert.equal(lines.length, 3, 'one registry line in each of the three lists')
  assert.ok(lines.every(line => line.includes('// LATER-CHANGE: OPS-2, J8.1 WS token bq claim (DECKSTER_WS_BQ_CLAIM_ENABLED)')))
})

console.log(`${checks} ws bq-claim checks passed`)
