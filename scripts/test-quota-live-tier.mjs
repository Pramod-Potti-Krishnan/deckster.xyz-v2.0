// R-20261007-frontend-19 (J8.1): Studio's quota routes read the user's tier from the LIVE database, and a
// failed wallet debit is re-sent without ever being charged twice.
//   flag DECKSTER_QUOTA_LIVE_TIER_ENABLED (server env, read at runtime, default off).
// Keyless and offline. The REAL code runs: app/api/usage/quota/route.ts, app/api/wallet/debit/route.ts,
// app/api/version/route.ts, lib/wallet.ts, lib/quota/*.ts, and hooks/use-quota.ts (on a tiny hooks stand-in).
// Only the outside world is faked: a ledger database that models what the money path depends on (one
// transaction at a time per user row, rollback, the UNIQUE `source_ref`), the session, and the network.
// No model, network, secret or real database. The flag-off baseline is the same code read from the base
// commit (`git show`), and is also pinned by hash so the check survives a repo where that commit is gone.
// QUOTA_LIVE_TIER_TEST_GIT_CWD points git at the real checkout when this file runs from a mutated copy.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const BASE = 'ec773bc' // PR 304 (ops2/studio-ws-bq-claim): the commit this change is stacked on
const ROOT = new URL('..', import.meta.url).pathname
const GIT_CWD = process.env.QUOTA_LIVE_TIER_TEST_GIT_CWD || ROOT
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value))
const readRepo = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const settle = async () => { for (let i = 0; i < 60; i++) await new Promise(resolve => setImmediate(resolve)) }
let checks = 0
const check = (name, fn) => Promise.resolve().then(fn).then(() => { checks++ }, error => { console.error(`FAILED: ${name}`); throw error })

let baseAvailable = true
function gitShow(relative) {
  try { return execFileSync('git', ['show', `${BASE}:${relative}`], { encoding: 'utf8', cwd: GIT_CWD, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }) } catch { baseAvailable = false; return null }
}

// ---------------------------------------------------------------------------------------------
// Loader: transpile the real TypeScript, resolve "@/..." to the repo, stub the externals.
// ---------------------------------------------------------------------------------------------
class FixedDate extends Date {
  constructor(...args) { if (args.length === 0) super(FixedDate.nowMs); else super(...args) }
  static now() { return FixedDate.nowMs }
}
FixedDate.nowMs = Date.UTC(2026, 9, 7, 15, 0, 0) // Wed 7 Oct 2026 11:00 EDT; the Eastern day began 04:00Z, the week on Sun 4 Oct
const DAY_MS = 86_400_000

function createWorld({ externals = {}, context = {}, overrides = {} } = {}) {
  const cache = new Map()
  const logs = []
  const baseContext = {
    Buffer, URL, URLSearchParams, Response, Headers, setTimeout, clearTimeout, Date: FixedDate, Promise, Set, Object, JSON, Error,
    console: { log: () => {}, warn: (...a) => logs.push(['warn', ...a.map(String)]), error: (...a) => logs.push(['error', ...a.map(String)]) },
    ...context,
  }
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports
    let text = relative in overrides ? overrides[relative] : null
    if (text === null) {
      const file = [`${relative}.ts`, `${relative}.tsx`, relative].map(r => path.join(ROOT, r)).find(f => fs.existsSync(f) && fs.statSync(f).isFile())
      assert.ok(file, `cannot resolve ${relative}`)
      text = fs.readFileSync(file, 'utf8')
    }
    const output = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const module = { exports: {} }
    cache.set(relative, module)
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
// The fake ledger database. It models exactly what the money path leans on:
//   - `$transaction`: writes are undone if the callback throws (or commit is made to fail);
//   - `user.update` takes the user's row lock until the transaction ends (a second one waits);
//   - `walletTransaction.source_ref` is UNIQUE: an insert of a key that another transaction has
//     inserted waits for that transaction, then fails with P2002 if it committed;
//   - reads see committed rows plus the transaction's own (read committed).
// Faults and a barrier are injected by tests; every call is traced.
// ---------------------------------------------------------------------------------------------
const pick = (object, select) => {
  if (!object) return object
  if (!select) return { ...object }
  const out = {}
  for (const key of Object.keys(select)) if (select[key]) out[key] = object[key]
  return out
}
const uniqueViolation = () => Object.assign(new Error('Unique constraint failed on the fields: (`source_ref`)'), { code: 'P2002', name: 'PrismaClientKnownRequestError' })

class LedgerDb {
  constructor({ users, ledger = [] }) {
    this.users = new Map(users.map(u => [u.id, { tier: 'free', walletBalanceCents: 0, ...u }]))
    this.rows = []
    this.nextRow = 1
    this.nextTx = 1
    this.locks = new Map()
    this.waiters = []
    this.calls = []
    this.faults = {}
    this.barrier = null
    for (const entry of ledger) {
      this.rows.push({
        id: `seed-${this.nextRow++}`, userId: users[0].id, type: 'debit', reason: 'token_usage', balanceAfterCents: 0, tokens: 0, metadata: null,
        sourceRef: null, ...entry, createdAt: new Date(FixedDate.nowMs - (entry.daysAgo ?? 0) * DAY_MS), owner: null,
      })
    }
    this.prisma = this.buildPrisma()
  }
  waitUntil(predicate) {
    if (predicate()) return Promise.resolve()
    return new Promise(resolve => this.waiters.push({ predicate, resolve }))
  }
  wake() {
    const ready = this.waiters.filter(w => w.predicate())
    this.waiters = this.waiters.filter(w => !ready.includes(w))
    ready.forEach(w => w.resolve())
  }
  async arrive() {
    const barrier = this.barrier
    if (!barrier) return
    await new Promise(resolve => {
      barrier.waiting.push(resolve)
      if (barrier.waiting.length >= barrier.parties) { this.barrier = null; barrier.waiting.forEach(r => r()) }
    })
  }
  committedRows(sourceRef) { return this.rows.filter(r => r.owner === null && r.sourceRef === sourceRef) }
  ledgerFor(sourceRef) { return this.committedRows(sourceRef) }
  state() {
    return {
      users: [...this.users.values()].map(u => ({ id: u.id, tier: u.tier, wallet: u.walletBalanceCents })),
      rows: this.rows.filter(r => r.owner === null).map(r => ({ userId: r.userId, type: r.type, amountCents: r.amountCents, reason: r.reason, balanceAfterCents: r.balanceAfterCents, sourceRef: r.sourceRef, tokens: r.tokens, metadata: r.metadata })),
    }
  }
  buildPrisma() {
    const db = this
    const readUser = (query, label, orThrow) => {
      db.calls.push([label, query.where, query.select])
      const user = db.users.get(query.where.id)
      if (!user && orThrow) throw new Error('No User found')
      return user ? pick(user, query.select) : null
    }
    const makeTx = () => {
      const tx = { id: db.nextTx++, undo: [] }
      const client = {
        user: {
          update: async query => {
            db.calls.push(['tx.user.update', query.where, query.data])
            await db.waitUntil(() => !db.locks.has(query.where.id) || db.locks.get(query.where.id) === tx.id)
            db.locks.set(query.where.id, tx.id)
            const user = db.users.get(query.where.id)
            if (!user) throw new Error('No User found')
            const delta = query.data.walletBalanceCents.increment
            user.walletBalanceCents += delta
            tx.undo.push(() => { user.walletBalanceCents -= delta })
            return pick(user, query.select)
          },
          findUniqueOrThrow: async query => readUser(query, 'tx.user.findUniqueOrThrow', true),
          findUnique: async query => readUser(query, 'tx.user.findUnique', false),
        },
        walletTransaction: {
          findUnique: async query => {
            db.calls.push(['tx.walletTransaction.findUnique', query.where])
            const row = db.rows.find(r => r.sourceRef === query.where.sourceRef && (r.owner === null || r.owner === tx.id))
            const result = row ? pick(row, query.select) : null // the query has run; only its answer waits
            if (query.where.sourceRef) await db.arrive()
            return result
          },
          create: async query => {
            const data = query.data
            db.calls.push(['tx.walletTransaction.create', { userId: data.userId, type: data.type, amountCents: data.amountCents, sourceRef: data.sourceRef ?? null }])
            if (data.sourceRef) {
              await db.waitUntil(() => !db.rows.some(r => r.sourceRef === data.sourceRef && r.owner !== null && r.owner !== tx.id))
              if (db.rows.some(r => r.sourceRef === data.sourceRef)) throw uniqueViolation()
            }
            const row = { id: `wt-${db.nextRow++}`, sourceRef: null, tokens: null, metadata: null, ...data, createdAt: new Date(FixedDate.nowMs), owner: tx.id }
            for (const key of Object.keys(row)) if (row[key] === undefined) row[key] = null
            db.rows.push(row)
            tx.undo.push(() => { db.rows.splice(db.rows.indexOf(row), 1) })
            return pick(row, query.select)
          },
        },
      }
      return { tx, client }
    }
    return {
      user: {
        findUnique: async query => {
          db.calls.push(['user.findUnique', query.where, query.select])
          if (query.select?.tier && db.faults.tierReadThrows) throw new Error('db error (user.tier)')
          if (db.faults.userThrows) throw new Error('db error (user)')
          const user = db.users.get(query.where.id)
          return user ? pick(user, query.select) : null
        },
        findUniqueOrThrow: async query => readUser(query, 'user.findUniqueOrThrow', true),
      },
      walletTransaction: {
        aggregate: async query => {
          db.calls.push(['walletTransaction.aggregate', query.where.userId, query.where.reason, query.where.createdAt?.gte ? 'windowed' : 'lifetime'])
          if (db.faults.aggregateThrows) throw new Error('db error (ledger)')
          const gte = query.where.createdAt?.gte
          const hit = db.rows.filter(r => r.owner === null && r.userId === query.where.userId && r.reason === query.where.reason && (!gte || r.createdAt >= gte))
          const sum = key => hit.length ? hit.reduce((total, r) => total + (r[key] ?? 0), 0) : null
          return { _sum: { amountCents: sum('amountCents'), tokens: sum('tokens') } }
        },
        findUnique: async query => {
          db.calls.push(['walletTransaction.findUnique', query.where])
          if (db.faults.replayReadThrows) throw new Error('db error (replay read)')
          const row = db.committedRows(query.where.sourceRef)[0]
          return row ? pick(row, query.select) : null
        },
      },
      $transaction: async fn => {
        const { tx, client } = makeTx()
        db.calls.push(['$transaction.begin', tx.id])
        const release = () => { for (const [key, holder] of db.locks) if (holder === tx.id) db.locks.delete(key); db.wake() }
        try {
          const out = await fn(client)
          if (db.faults.failCommit?.(tx)) throw new Error('db error (commit): connection reset')
          for (const row of db.rows) if (row.owner === tx.id) row.owner = null
          db.calls.push(['$transaction.commit', tx.id])
          release()
          return out
        } catch (error) {
          for (const undo of tx.undo.reverse()) undo()
          db.calls.push(['$transaction.rollback', tx.id])
          release()
          throw error
        }
      },
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The routes' world.
// ---------------------------------------------------------------------------------------------
const USER_ID = 'user-live-db'
const OTHER_ID = 'user-other'
const sessionOf = (tier, extra = {}) => ({ user: { id: USER_ID, tier, approved: true, walletBalanceCents: 0, ...extra } })

function routeWorld({ db, env = {}, session = sessionOf('free'), overrides = {}, externals = {} }) {
  const world = createWorld({
    context: { process: { env } },
    overrides,
    externals: {
      'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
      'next-auth': { getServerSession: async () => (typeof session === 'function' ? session() : session) },
      '@/lib/auth-options': { authOptions: {} },
      '@/lib/prisma': { prisma: db.prisma },
      '@/lib/build-version': { BUILD_FINGERPRINT: 'fingerprint' },
      '@/lib/diagram-catalog': { DIAGRAM_CATALOG_VERSION: 'catalog-1' },
      ...externals,
    },
  })
  const quotaRoute = world.load('app/api/usage/quota/route')
  const debitRoute = world.load('app/api/wallet/debit/route')
  const answer = async response => ({
    status: response.status,
    headers: [...response.headers.entries()].filter(([k]) => k !== 'content-type').sort(),
    text: await response.text(),
  })
  return {
    world, db, env,
    quota: async () => answer(await quotaRoute.GET()),
    debit: async body => answer(await debitRoute.POST({ json: async () => body })),
    version: async () => answer(await world.load('app/api/version/route').GET()),
  }
}
const parse = answer => JSON.parse(answer.text)
const MARKER = 'x-deckster-debit-idempotent'
const hasMarker = answer => answer.headers.some(([k, v]) => k === MARKER && v === '1')
const on = { DECKSTER_QUOTA_LIVE_TIER_ENABLED: 'true' }

// Pro caps: monthly 5000, weekly 1250, daily 625 cents. At $10 per Mtok, 3000 tokens cost 3 cents.
const turn = (messageId, tokens = 3000, actionType = 'chat') => ({ messageId, tokens, actionType })
const refOf = messageId => `token_usage:${messageId}`
const spendToday = amountCents => [{ amountCents, sourceRef: `seed:${amountCents}` }]
const makeDb = ({ tier = 'pro', wallet = 0, ledger = [], users = [] } = {}) => new LedgerDb({ users: [{ id: USER_ID, tier, walletBalanceCents: wallet }, ...users], ledger })
const ledgerCount = (db, messageId) => db.ledgerFor(refOf(messageId)).length
const takenFromWallet = (db, startWallet) => startWallet - db.users.get(USER_ID).walletBalanceCents

// =============================================================================================
// 1. The flag and its helpers
// =============================================================================================
await check('flag: only the exact string "true" turns it on; default off; /api/version reports it only when on', async () => {
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['yes', false], ['true', true]]) {
    const env = value === undefined ? {} : { DECKSTER_QUOTA_LIVE_TIER_ENABLED: value }
    const { load } = createWorld({ context: { process: { env } } })
    const flag = load('lib/quota/live-tier-flag')
    assert.equal(flag.QUOTA_LIVE_TIER_FLAG, 'DECKSTER_QUOTA_LIVE_TIER_ENABLED')
    assert.equal(flag.isQuotaLiveTierEnabled(), expected, String(value))
    assert.deepEqual(plain(flag.quotaLiveTierResponseInit() ?? null), expected ? { headers: { [MARKER]: '1' } } : null)
    const version = parse(await routeWorld({ db: makeDb(), env }).version())
    assert.deepEqual(Object.keys(version), expected ? ['build_sha', 'diagram_catalog_version', 'quota_live_tier_enabled'] : ['build_sha', 'diagram_catalog_version'])
  }
  const both = parse(await routeWorld({ db: makeDb(), env: { ...on, DECKSTER_WS_BQ_CLAIM_ENABLED: 'true' } }).version())
  assert.deepEqual(Object.keys(both), ['build_sha', 'diagram_catalog_version', 'ws_bq_claim_enabled', 'quota_live_tier_enabled'])
  assert.equal(readRepo('lib/quota/live-tier-flag.ts').includes('NEXT_PUBLIC'), false, 'a server-only flag, never a public one')
  assert.match(readRepo('.env.example'), /^DECKSTER_QUOTA_LIVE_TIER_ENABLED="false"$/m, 'documented, default off')
  assert.match(readRepo('package.json'), /"test:quota-live-tier": "node scripts\/test-quota-live-tier\.mjs"/)
})
await check('the flag helper module stays free of the database client, so /api/version can report it', async () => {
  assert.doesNotMatch(readRepo('lib/quota/live-tier-flag.ts'), /^\s*import\b/m)
})

// =============================================================================================
// 2. Flag off: the routes are the base routes, byte for byte
// =============================================================================================
const BASE_FILES = ['app/api/usage/quota/route', 'app/api/wallet/debit/route']
const baseOverrides = () => {
  const out = {}
  for (const file of BASE_FILES) { const text = gitShow(`${file}.ts`); if (text !== null) out[file] = text }
  return baseAvailable ? out : null
}
const OFF_ENVS = [{}, { DECKSTER_QUOTA_LIVE_TIER_ENABLED: 'false' }, { DECKSTER_QUOTA_LIVE_TIER_ENABLED: '' }, { DECKSTER_QUOTA_LIVE_TIER_ENABLED: 'TRUE' }, { DECKSTER_QUOTA_LIVE_TIER_ENABLED: '1' }]

// A fixed script of requests against a fixed set of database states. The trace of one run is the full
// observable behaviour: status, headers, body bytes, every database call, and the ledger afterwards.
const SESSIONS = {
  stale: sessionOf('free'),               // the JWT says free
  forgedUp: sessionOf('premium'),         // the JWT says premium, the database does not
  noTier: { user: { id: USER_ID } },       // a JWT with no tier at all
}
const DB_STATES = {
  proRoom: () => makeDb({ tier: 'pro', wallet: 0 }),
  proNearCap: () => makeDb({ tier: 'pro', wallet: 0, ledger: spendToday(624) }),
  proNearCapWithWallet: () => makeDb({ tier: 'pro', wallet: 100, ledger: spendToday(624) }),
  freeWithWallet: () => makeDb({ tier: 'free', wallet: 50 }),
  freeNoWallet: () => makeDb({ tier: 'free', wallet: 0 }),
  premiumRoom: () => makeDb({ tier: 'premium', wallet: 7, ledger: spendToday(1000) }),
}
const REQUESTS = [
  ['valid', turn('m1')], ['valid again, same turn', turn('m1')], ['second turn', turn('m2', 12000, null)],
  ['no messageId', { tokens: 100 }], ['numeric messageId', { messageId: 7, tokens: 100 }], ['zero tokens', turn('m3', 0)],
  ['string tokens', turn('m4', '300')], ['negative tokens', turn('m5', -5)], ['huge turn', turn('m6', 900000)],
]
async function traceRoutes({ overrides = {}, env }) {
  const trace = []
  for (const [sessionName, session] of Object.entries(SESSIONS)) {
    for (const [stateName, makeState] of Object.entries(DB_STATES)) {
      const db = makeState()
      const w = routeWorld({ db, env, session, overrides })
      const entry = { sessionName, stateName, steps: [] }
      entry.steps.push(['GET quota', await w.quota(), db.calls.splice(0)])
      for (const [label, body] of REQUESTS) entry.steps.push([label, await w.debit(body), db.calls.splice(0)])
      entry.steps.push(['GET quota after', await w.quota(), db.calls.splice(0)])
      entry.final = db.state()
      entry.logs = w.world.logs
      trace.push(entry)
    }
  }
  const noSession = routeWorld({ db: makeDb(), env, session: null, overrides })
  trace.push(['signed out', await noSession.quota(), await noSession.debit(turn('m1')), noSession.db.calls])
  const noId = routeWorld({ db: makeDb(), env, session: { user: {} }, overrides })
  trace.push(['no user id', await noId.quota(), await noId.debit(turn('m1')), noId.db.calls])
  const dbDown = makeDb({ tier: 'pro' }); dbDown.faults.aggregateThrows = true
  const down = routeWorld({ db: dbDown, env, session: sessionOf('pro'), overrides })
  trace.push(['ledger down', await down.quota(), await down.debit(turn('m1')), dbDown.calls, down.world.logs])
  const zero = routeWorld({ db: makeDb({ tier: 'pro' }), env, session: sessionOf('pro'), overrides, externals: { '@/lib/pricing/tokens': { tokensToUsdCents: () => 0 } } })
  trace.push(['zero cost', await zero.debit(turn('m1')), zero.db.calls])
  return trace
}
const PINNED = {
  // sha256 of the full observable behaviour (responses, headers, every database call, ledger afterwards) of the base routes / base hook
  routesOff: '6f2ee2f2052ccf25cafcf6ee2ce90b8dbf21dbad3003948a95408e1256135889',
  hookOff: 'ea6589316476705205d1a18fcef12e8b75d4358e7e8196a8705b2e64518628d0',
}
let offTraceHash
await check('flag off (unset, false, empty, "TRUE", "1"): both routes answer exactly as the base routes do, with the same database reads and writes', async () => {
  const branchTraces = []
  for (const env of OFF_ENVS) branchTraces.push(sha(await traceRoutes({ env })))
  assert.equal(new Set(branchTraces).size, 1, 'every spelling of "off" behaves the same')
  offTraceHash = branchTraces[0]
  const overrides = baseOverrides()
  if (overrides) {
    const baseTrace = sha(await traceRoutes({ env: {}, overrides }))
    assert.equal(offTraceHash, baseTrace, `flag off must equal the routes at ${BASE}`)
  }
  if (process.env.PRINT_PINNED) console.log('routesOff =', offTraceHash)
  else assert.equal(offTraceHash, PINNED.routesOff, 'flag off must equal the pinned hash of the base routes\' behaviour')
})
await check('flag off: the live tier is never read, no replay lookup is made, no marker header is sent, the response keys are the base keys', async () => {
  for (const state of Object.values(DB_STATES)) {
    const db = state()
    const w = routeWorld({ db, env: {}, session: sessionOf('pro') })
    const quota = await w.quota()
    const debit = await w.debit(turn('m1'))
    const calls = db.calls.map(c => c[0] + (c[2]?.tier ? '(tier)' : ''))
    assert.equal(calls.some(c => c.includes('(tier)')), false, 'User.tier is not read')
    assert.equal(db.calls.some(c => c[0] === 'walletTransaction.findUnique'), false, 'no replay lookup outside a transaction')
    assert.equal(hasMarker(quota) || hasMarker(debit), false)
    assert.deepEqual(quota.headers, [])
    assert.deepEqual(Object.keys(parse(debit)), ['costCents', 'deducted', 'source', 'capped', 'balanceCents', 'quota'])
  }
})

// =============================================================================================
// 3. Flag on: the tier is the database's, not the session token's
// =============================================================================================
const CAPS = { starter: [2000, 500, 250], pro: [5000, 1250, 625], premium: [10000, 2500, 1250] }
await check('flag on: GET /api/usage/quota uses the live tier, whatever the session token says, in both directions', async () => {
  for (const [dbTier, jwtTier] of [['pro', 'free'], ['free', 'premium'], ['premium', 'free'], ['starter', 'pro'], ['pro', undefined], ['pro', 'enterprise']]) {
    const db = makeDb({ tier: dbTier, wallet: 0 })
    const w = routeWorld({ db, env: on, session: jwtTier === undefined ? { user: { id: USER_ID } } : sessionOf(jwtTier) })
    const answer = await w.quota()
    const status = parse(answer)
    assert.equal(answer.status, 200)
    assert.equal(status.tier, dbTier, `db ${dbTier} / jwt ${jwtTier}`)
    assert.deepEqual([status.caps.monthlyCents, status.caps.weeklyCents, status.caps.dailyCents], CAPS[dbTier] ?? [0, 0, 0])
    assert.equal(hasMarker(answer), true)
    assert.ok(db.calls.some(c => c[0] === 'user.findUnique' && c[2]?.tier), 'User.tier was read')
    assert.ok(db.calls.filter(c => c[0] === 'user.findUnique').every(c => c[1].id === USER_ID), 'keyed by the user id only')
  }
})
await check('flag on: a stale session token no longer opens or shuts the gate; the quota picture is the Director claim\'s picture', async () => {
  const { buildQuotaClaimFromStatus, isBuildBlockedByQuota } = createWorld().load('lib/quota/build-quota')
  const scenarios = [
    { name: 'upgraded in the database, token still free', db: { tier: 'pro', wallet: 0 }, jwt: 'free', blocked: false },
    { name: 'downgraded in the database, token still premium', db: { tier: 'free', wallet: 0 }, jwt: 'premium', blocked: true },
    { name: 'pro day cap used, token says premium', db: { tier: 'pro', wallet: 0, ledger: spendToday(625) }, jwt: 'premium', blocked: true },
    { name: 'pro day cap used but a reserve covers it', db: { tier: 'pro', wallet: 40, ledger: spendToday(625) }, jwt: 'free', blocked: false },
    { name: 'starter within its day cap, token says free', db: { tier: 'starter', wallet: 0, ledger: spendToday(100) }, jwt: 'free', blocked: false },
    { name: 'a tier the pricing table does not know', db: { tier: 'enterprise', wallet: 0 }, jwt: 'premium', blocked: true },
  ]
  for (const s of scenarios) {
    const db = makeDb(s.db)
    const w = routeWorld({ db, env: on, session: sessionOf(s.jwt) })
    const status = parse(await w.quota())
    assert.equal(isBuildBlockedByQuota(status), s.blocked, s.name)
    // The signed claim, minted from the same live database, reaches the same decision.
    const claimWorld = createWorld({ context: { process: { env: on } }, externals: { '@/lib/prisma': { prisma: db.prisma } } })
    const claim = plain(await claimWorld.load('lib/quota/build-quota-claim').mintBuildQuotaClaim(USER_ID))
    assert.equal(claim.ok, !s.blocked, `${s.name}: the claim`)
    assert.equal(claim.tier, status.tier)
    assert.deepEqual(plain(buildQuotaClaimFromStatus(status)), claim, `${s.name}: the same claim from the route's picture`)
    // And with the flag off the route is still on the token (the problem this fixes).
    const off = parse(await routeWorld({ db: makeDb(s.db), env: {}, session: sessionOf(s.jwt) }).quota())
    assert.equal(off.tier, s.jwt, `${s.name}: flag off still follows the token`)
  }
})
await check('flag on: a missing user row reads as free (no allowance), like the claim', async () => {
  const db = makeDb({ tier: 'pro' }); db.users.delete(USER_ID)
  const answer = await routeWorld({ db, env: on, session: sessionOf('premium') }).quota()
  const status = parse(answer)
  assert.equal(status.tier, 'free')
  assert.equal(status.flags.dailyAt, true)
  assert.equal(status.walletBalanceCents, 0)
  const blank = makeDb({ tier: '' })
  assert.equal(parse(await routeWorld({ db: blank, env: on, session: sessionOf('premium') }).quota()).tier, 'free', 'an empty tier reads as free, as the sign-in does')
})

// --- the live read fails -------------------------------------------------------------------
await check('flag on, live tier read fails: the session tier is used and the failure is logged (fail-open, as today); never a refusal, never lost accounting', async () => {
  for (const jwtTier of ['pro', 'free']) {
    const db = makeDb({ tier: 'starter', wallet: 0 }); db.faults.tierReadThrows = true
    const w = routeWorld({ db, env: on, session: sessionOf(jwtTier) })
    const answer = await w.quota()
    assert.equal(answer.status, 200)
    assert.equal(parse(answer).tier, jwtTier, 'fell back to the session tier')
    assert.equal(hasMarker(answer), true)
    assert.ok(w.world.logs.some(l => l[0] === 'error' && /live tier read failed/.test(l[1])), 'logged')
    // The debit: the turn is still booked, under the session tier, once.
    const debit = await w.debit(turn('m1'))
    assert.equal(debit.status, 200)
    assert.equal(parse(debit).quota.tier, jwtTier)
    assert.equal(ledgerCount(db, 'm1'), 1)
  }
})
await check('flag on, the database is really down: the same 500 the base returns (the failure surfaces where it always did)', async () => {
  const mk = env => { const db = makeDb({ tier: 'pro' }); db.faults.userThrows = true; return routeWorld({ db, env, session: sessionOf('pro') }) }
  const off = mk({}), onW = mk(on)
  for (const [name, a, b] of [['quota', await off.quota(), await onW.quota()], ['debit', await off.debit(turn('m1')), await onW.debit(turn('m1'))]]) {
    assert.equal(a.status, 500, name); assert.equal(b.status, 500, name)
    assert.equal(a.text, b.text, name)
    assert.equal(hasMarker(b), false, 'an error response carries no marker')
  }
})

// =============================================================================================
// 4. The debit route books a turn at most once (proven on the real code, flag off AND on)
// =============================================================================================
const PATHS = [
  { name: 'plan-included (within caps)', tier: 'pro', make: () => makeDb({ tier: 'pro', wallet: 0 }), wallet: 0, source: 'plan', deducted: false },
  { name: 'overflow drawn from the wallet', tier: 'pro', make: () => makeDb({ tier: 'pro', wallet: 100, ledger: spendToday(624) }), wallet: 100, source: 'topup', deducted: true },
  { name: 'free tier paying from the wallet', tier: 'free', make: () => makeDb({ tier: 'free', wallet: 50 }), wallet: 50, source: 'topup', deducted: true },
  { name: 'cap hit and the wallet cannot cover it (recorded as capped)', tier: 'pro', make: () => makeDb({ tier: 'pro', wallet: 0, ledger: spendToday(624) }), wallet: 0, source: 'plan', deducted: false, capped: true },
]
for (const flag of [{}, on]) {
  await check(`one turn is booked once however many times it is delivered in a row (${Object.keys(flag).length ? 'flag on' : 'flag off'})`, async () => {
    for (const p of PATHS) {
      const db = p.make()
      const w = routeWorld({ db, env: flag, session: sessionOf(p.tier) })
      const answers = []
      for (let i = 0; i < 4; i++) answers.push(await w.debit(turn('m1')))
      assert.deepEqual(answers.map(a => a.status), [200, 200, 200, 200], p.name)
      assert.equal(ledgerCount(db, 'm1'), 1, `${p.name}: one ledger row for the turn`)
      const cost = 3
      assert.equal(takenFromWallet(db, p.wallet), p.source === 'topup' ? cost : 0, `${p.name}: the wallet is debited at most once`)
      assert.equal(db.calls.filter(c => c[0] === 'tx.walletTransaction.create').length, 1, `${p.name}: one insert`)
      // The only rollback is the capped path's own refused wallet debit, on the first delivery.
      assert.equal(db.calls.filter(c => c[0] === '$transaction.rollback').length, p.capped ? 1 : 0, `${p.name}: rollbacks`)
      // A second turn is its own booking.
      await w.debit(turn('m2'))
      assert.equal(ledgerCount(db, 'm2'), 1)
      assert.equal(db.rows.filter(r => r.sourceRef?.startsWith('token_usage:')).length, 2)
    }
  })
}
await check('the idempotency key is the messageId alone, held by a UNIQUE column and checked inside the booking transaction', async () => {
  const schema = readRepo('prisma/schema.prisma')
  assert.match(schema, /model WalletTransaction \{[\s\S]*?sourceRef\s+String\?\s+@unique @map\("source_ref"\)[\s\S]*?\}/)
  const wallet = readRepo('lib/wallet.ts')
  // both booking functions look the key up in the same transaction that writes the row
  assert.equal((wallet.match(/walletTransaction\.findUnique\(\{\s*where: \{ sourceRef \}/g) ?? []).length, 2)
  assert.match(readRepo('app/api/wallet/debit/route.ts'), /const sourceRef = `token_usage:\$\{messageId\}`/)
  // and the table was created with the same constraint in the repo's DDL
  assert.match(readRepo('prisma/sql/20260531_coupon_wallet.sql'), /"source_ref" TEXT UNIQUE/)
})

// --- replay accuracy ----------------------------------------------------------------------
await check('a re-sent turn that the first delivery booked as plan-included is answered as plan-included (flag on); flag off misreports it as drawn from the wallet', async () => {
  // First delivery: 621 spent, +3 fits the 625 day cap. Its own spend then makes a repeat "not fit".
  const mk = () => makeDb({ tier: 'pro', wallet: 100, ledger: spendToday(622) })
  const offW = routeWorld({ db: mk(), env: {}, session: sessionOf('pro') })
  const first = parse(await offW.debit(turn('m1')))
  assert.deepEqual([first.source, first.deducted], ['plan', false])
  const legacyRepeat = parse(await offW.debit(turn('m1')))
  assert.deepEqual([legacyRepeat.source, legacyRepeat.deducted], ['topup', true], 'legacy misreports the repeat (nothing was taken from the wallet)')
  assert.equal(offW.db.users.get(USER_ID).walletBalanceCents, 100, 'but it did not charge')

  const onW = routeWorld({ db: mk(), env: on, session: sessionOf('pro') })
  const a = await onW.debit(turn('m1'))
  const b = await onW.debit(turn('m1'))
  const c = await onW.debit(turn('m1'))
  assert.deepEqual([a.status, b.status, c.status], [200, 200, 200])
  for (const answer of [b, c]) {
    const body = parse(answer)
    assert.deepEqual([body.costCents, body.source, body.deducted, body.capped], [3, 'plan', false, false])
    assert.equal(body.balanceCents, 100)
    assert.equal(hasMarker(answer), true)
  }
  assert.deepEqual([parse(a).source, parse(a).deducted], ['plan', false])
  assert.equal(ledgerCount(onW.db, 'm1'), 1)
  assert.equal(onW.db.users.get(USER_ID).walletBalanceCents, 100)
})
await check('flag on: the replay of an overflow turn and of a capped turn say what was booked', async () => {
  const topup = routeWorld({ db: makeDb({ tier: 'pro', wallet: 100, ledger: spendToday(624) }), env: on, session: sessionOf('pro') })
  await topup.debit(turn('m1'))
  const again = parse(await topup.debit(turn('m1')))
  assert.deepEqual([again.source, again.deducted, again.capped, again.costCents, again.balanceCents], ['topup', true, false, 3, 97])
  const capped = routeWorld({ db: makeDb({ tier: 'pro', wallet: 0, ledger: spendToday(624) }), env: on, session: sessionOf('pro') })
  const first = parse(await capped.debit(turn('m1')))
  const second = parse(await capped.debit(turn('m1')))
  assert.deepEqual([first.capped, first.deducted, second.capped, second.deducted, second.source], [true, false, true, false, 'plan'])
})
await check('flag on: a first delivery answers exactly as the flag-off route does (same body, only the marker header is added)', async () => {
  for (const p of PATHS) {
    for (const body of [turn('m1'), turn('m2', 12000, 'chat'), turn('m3', 900000, null)]) {
      const offW = routeWorld({ db: p.make(), env: {}, session: sessionOf(p.tier) })
      const onW = routeWorld({ db: p.make(), env: on, session: sessionOf(p.tier) })
      const a = await offW.debit(body), b = await onW.debit(body)
      assert.equal(b.text, a.text, `${p.name}: body bytes`)
      assert.equal(b.status, a.status)
      assert.deepEqual(b.headers, [[MARKER, '1']])
      assert.deepEqual(plain(onW.db.state()), plain(offW.db.state()), `${p.name}: the same ledger and wallet`)
    }
  }
})

// --- the live tier decides how a turn is booked --------------------------------------------
await check('flag on: the debit books against the live tier (token free / database pro: plan-included; token premium / database free: from the wallet)', async () => {
  const up = routeWorld({ db: makeDb({ tier: 'pro', wallet: 0 }), env: on, session: sessionOf('free') })
  const upBody = parse(await up.debit(turn('m1')))
  assert.deepEqual([upBody.source, upBody.deducted, upBody.quota.tier], ['plan', false, 'pro'])
  assert.equal(up.db.users.get(USER_ID).walletBalanceCents, 0)
  const down = routeWorld({ db: makeDb({ tier: 'free', wallet: 50 }), env: on, session: sessionOf('premium') })
  const downBody = parse(await down.debit(turn('m1')))
  assert.deepEqual([downBody.source, downBody.deducted, downBody.quota.tier, downBody.balanceCents], ['topup', true, 'free', 47])
  const legacy = routeWorld({ db: makeDb({ tier: 'free', wallet: 50 }), env: {}, session: sessionOf('premium') })
  assert.equal(parse(await legacy.debit(turn('m1'))).source, 'plan', 'flag off still trusts the stale token and books the turn as plan-included')
})
await check('flag on: the zero-cost branch still answers, with the marker, books nothing and does no replay lookup', async () => {
  const db = makeDb({ tier: 'pro', wallet: 9 })
  const w = routeWorld({ db, env: on, session: sessionOf('pro'), externals: { '@/lib/pricing/tokens': { tokensToUsdCents: () => 0 } } })
  const answer = await w.debit(turn('m1'))
  assert.equal(answer.status, 200)
  assert.deepEqual(plain(parse(answer)).costCents, 0)
  assert.equal(hasMarker(answer), true)
  assert.equal(db.rows.length, 0)
  assert.equal(db.calls.some(c => c[0] === 'walletTransaction.findUnique'), false)
})
await check('flag on: refusals are unchanged and cheap (401, 400): no marker, no database work beyond what the base did', async () => {
  for (const env of [{}, on]) {
    const signedOut = routeWorld({ db: makeDb(), env, session: null })
    const a = await signedOut.debit(turn('m1')), q = await signedOut.quota()
    assert.deepEqual([a.status, q.status, a.text, q.text], [401, 401, '{"error":"Unauthorized"}', '{"error":"Unauthorized"}'])
    assert.equal(signedOut.db.calls.length, 0)
    const w = routeWorld({ db: makeDb(), env, session: sessionOf('pro') })
    for (const bad of [{ tokens: 5 }, { messageId: 5, tokens: 5 }, turn('m1', 0), turn('m1', '5'), turn('m1', -1)]) {
      const answer = await w.debit(bad)
      assert.equal(answer.status, 400)
      assert.equal(hasMarker(answer), false)
    }
    assert.equal(w.db.calls.length, 0, 'validation happens before any database read')
  }
})

// =============================================================================================
// 5. Duplicate deliveries racing each other: still one booking
// =============================================================================================
const race = async ({ env, db, bodies }) => {
  const w = routeWorld({ db, env, session: sessionOf('pro') })
  db.barrier = { parties: bodies.length, waiting: [] } // every delivery reads "not booked yet" before any of them writes
  const answers = await Promise.all(bodies.map(b => w.debit(b)))
  return { w, answers }
}
await check('racing duplicates, plan-included turn: booked once; flag off the loser is a 500 (nothing charged), flag on both answer 200 with the same booking', async () => {
  const offRace = await race({ env: {}, db: makeDb({ tier: 'pro', wallet: 40 }), bodies: [turn('m1'), turn('m1')] })
  assert.deepEqual(offRace.answers.map(a => a.status).sort(), [200, 500])
  assert.equal(ledgerCount(offRace.w.db, 'm1'), 1)
  assert.equal(offRace.w.db.users.get(USER_ID).walletBalanceCents, 40)
  assert.equal(offRace.w.db.calls.filter(c => c[0] === '$transaction.rollback').length, 1, 'the loser rolled back whole')

  const onRace = await race({ env: on, db: makeDb({ tier: 'pro', wallet: 40 }), bodies: [turn('m1'), turn('m1')] })
  assert.deepEqual(onRace.answers.map(a => a.status), [200, 200])
  assert.equal(onRace.answers[0].text, onRace.answers[1].text, 'the same answer on every delivery')
  assert.equal(ledgerCount(onRace.w.db, 'm1'), 1)
  assert.equal(onRace.w.db.users.get(USER_ID).walletBalanceCents, 40)
  assert.ok(onRace.answers.every(hasMarker))
})
await check('racing duplicates, overflow turn: the wallet is debited once, never twice (flag off and on)', async () => {
  for (const env of [{}, on]) {
    for (const copies of [2, 3, 5]) {
      const db = makeDb({ tier: 'pro', wallet: 100, ledger: spendToday(624) })
      const { w, answers } = await race({ env, db, bodies: Array.from({ length: copies }, () => turn('m1')) })
      assert.equal(ledgerCount(db, 'm1'), 1, `${copies} copies, one row`)
      assert.equal(takenFromWallet(db, 100), 3, `${copies} copies, one debit`)
      assert.ok(answers.filter(a => a.status === 200).length >= 1)
      if (env === on) assert.ok(answers.every(a => a.status === 200 && parse(a).deducted === true && parse(a).source === 'topup'))
      void w
    }
  }
})
await check('racing duplicates when the wallet only covers one: the winner took the money; flag on the loser reports that booking (flag off says "capped")', async () => {
  const mk = () => makeDb({ tier: 'pro', wallet: 3, ledger: spendToday(624) })
  const offRace = await race({ env: {}, db: mk(), bodies: [turn('m1'), turn('m1')] })
  assert.equal(takenFromWallet(offRace.w.db, 3), 3, 'charged once')
  assert.equal(ledgerCount(offRace.w.db, 'm1'), 1)
  assert.ok(offRace.answers.some(a => parse(a).capped === true), 'legacy tells one delivery "capped" although the turn was paid for from the wallet')
  const onRace = await race({ env: on, db: mk(), bodies: [turn('m1'), turn('m1')] })
  assert.equal(takenFromWallet(onRace.w.db, 3), 3, 'charged once')
  assert.equal(ledgerCount(onRace.w.db, 'm1'), 1)
  for (const answer of onRace.answers) {
    const body = parse(answer)
    assert.deepEqual([answer.status, body.source, body.deducted, body.capped, body.balanceCents], [200, 'topup', true, false, 0])
  }
  assert.equal(onRace.w.db.calls.filter(c => c[0] === '$transaction.rollback').length, 1, 'the loser\'s debit rolled back whole (balance restored)')
})
await check('different turns racing do not interfere: each booked once', async () => {
  const db = makeDb({ tier: 'pro', wallet: 100, ledger: spendToday(624) })
  const { answers } = await race({ env: on, db, bodies: [turn('mA'), turn('mB')] })
  assert.deepEqual(answers.map(a => a.status), [200, 200])
  assert.equal(ledgerCount(db, 'mA') + ledgerCount(db, 'mB'), 2)
  assert.equal(takenFromWallet(db, 100), 6)
})
await check('a key owned by another user is never replayed to this user (the legacy path handles it, flag on or off)', async () => {
  for (const env of [{}, on]) {
    const db = makeDb({ tier: 'pro', wallet: 10, users: [{ id: OTHER_ID, tier: 'pro', walletBalanceCents: 10 }] })
    db.rows.push({ id: 'theirs', userId: OTHER_ID, type: 'debit', amountCents: 3, reason: 'token_usage', balanceAfterCents: 10, sourceRef: refOf('shared'), tokens: 3000, metadata: { source: 'topup', capped: true }, createdAt: new Date(FixedDate.nowMs), owner: null })
    const w = routeWorld({ db, env, session: sessionOf('pro') })
    const answer = await w.debit(turn('shared'))
    assert.equal(answer.status, 200)
    assert.equal(parse(answer).capped, false, 'not the other user\'s "capped" booking')
    assert.equal(db.rows.filter(r => r.sourceRef === refOf('shared')).length, 1, 'nothing new written under their key')
    assert.equal(db.users.get(USER_ID).walletBalanceCents, 10)
  }
})
await check('flag on, a duplicate loses the race and the replay read itself fails: an honest 500, nothing charged twice', async () => {
  const db = makeDb({ tier: 'pro', wallet: 40 })
  const w = routeWorld({ db, env: on, session: sessionOf('pro') })
  db.barrier = { parties: 2, waiting: [] }
  const replayOnlyAfterRace = db.prisma.walletTransaction.findUnique
  let outside = 0
  db.prisma.walletTransaction.findUnique = async query => { outside++; if (outside >= 3) throw new Error('db error (replay read)'); return replayOnlyAfterRace(query) }
  const answers = await Promise.all([w.debit(turn('m1')), w.debit(turn('m1'))])
  assert.deepEqual(answers.map(a => a.status).sort(), [200, 500])
  assert.equal(ledgerCount(db, 'm1'), 1)
  assert.equal(db.users.get(USER_ID).walletBalanceCents, 40)
  assert.ok(w.world.logs.some(l => /Duplicate replay failed/.test(l[1])))
})

// =============================================================================================
// 6. The browser hook: the real hooks/use-quota.ts on a tiny hooks stand-in
// =============================================================================================
const HOOK_FILE = 'hooks/use-quota'
const hookSource = () => process.env.QUOTA_LIVE_TIER_TEST_HOOK ? fs.readFileSync(process.env.QUOTA_LIVE_TIER_TEST_HOOK, 'utf8') : readRepo(`${HOOK_FILE}.ts`)
const STATUS = (over = {}) => ({
  tier: 'pro', tierLabel: 'Pro', caps: { monthlyCents: 5000, weeklyCents: 1250, dailyCents: 625 },
  spent: { dailyCents: 0, weeklyCents: 0, monthlyCents: 0 }, remainingPct: { daily: 1, weekly: 1, monthly: 1 },
  flags: { dailyNear: false, dailyAt: false, weeklyNear: false, weeklyAt: false }, walletBalanceCents: 0,
  resetAt: { daily: '2026-10-08T04:00:00.000Z', weekly: '2026-10-11T04:00:00.000Z' },
  totals: { monthTokens: 0, monthSpendCents: 0, lifetimeTokens: 0, lifetimeSpendCents: 0 }, ...over,
})
const DEBIT_OK = (over = {}) => ({ costCents: 3, deducted: false, capped: false, source: 'plan', balanceCents: 0, quota: STATUS({ spent: { dailyCents: 3, weeklyCents: 3, monthlyCents: 3 } }), ...over })

function hookWorld({ code = hookSource(), userId = 'u1', serve } = {}) {
  const slots = []
  let cursor = 0, dirty = false
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const effects = []
  const react = {
    useState: init => { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof init === 'function' ? init() : init }; return [slots[i].value, v => { const next = typeof v === 'function' ? v(slots[i].value) : v; if (!Object.is(next, slots[i].value)) dirty = true; slots[i].value = next }] },
    useRef: init => { const i = cursor++; return slots[i] ||= { current: init } },
    useCallback: (fn, deps) => { const i = cursor++; const old = slots[i]; if (old && same(old.deps, deps)) return old.fn; slots[i] = { fn, deps }; return fn },
    useEffect: (fn, deps) => { const i = cursor++; const old = slots[i]; if (old && same(old.deps, deps)) return; slots[i] = { deps }; effects.push(fn) },
  }
  const w = { userId, calls: [], sleeps: [], timers: [], manualTimers: false, script: { quota: [], debit: [] }, serve }
  const respond = (kind, init, entry) => {
    // A scripted outcome, or the default (a plain 200), or `serve` (the real route in a world).
    const step = w.script[kind].shift()
    const done = out => {
      if (out.throws) throw new Error('offline: network down')
      const headers = Object.fromEntries(Object.entries(out.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]))
      entry.status = out.status
      return { ok: out.status >= 200 && out.status < 300, status: out.status, headers: { get: name => headers[name.toLowerCase()] ?? null }, json: async () => { if (out.jsonThrows) throw new Error('unreadable body'); return out.body ?? {} } }
    }
    if (step === undefined && w.serve) return w.serve(kind, init, entry)
    return done(step ?? { status: 200, body: kind === 'quota' ? STATUS() : DEBIT_OK() })
  }
  const fetch = (url, init) => {
    const kind = String(url).includes('/debit') ? 'debit' : 'quota'
    const entry = { kind, method: init?.method ?? 'GET', body: init?.body, order: w.calls.length }
    w.calls.push(entry)
    return new Promise((resolve, reject) => { Promise.resolve().then(async () => { try { resolve(await respond(kind, init, entry)) } catch (error) { entry.status = 'network-error'; reject(error) } }) })
  }
  const setTimeoutStub = (fn, ms) => { w.sleeps.push(ms); if (w.manualTimers) w.timers.push(fn); else Promise.resolve().then(fn) }
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: mod, exports: mod.exports, fetch, setTimeout: setTimeoutStub, Set, Promise, JSON, Object, Error,
    require: id => id === 'react' ? react : id === 'next-auth/react' ? { useSession: () => ({ data: w.userId ? { user: { id: w.userId } } : null }) } : assert.fail(`unexpected import ${id}`),
  })
  let result
  w.render = (...args) => {
    w.lastArgs = args
    let turns = 0
    do { assert.ok(turns++ < 20, 'render loop'); dirty = false; cursor = 0; effects.length = 0; result = mod.exports.useQuota(args[0], args[1]); effects.splice(0).forEach(fn => fn()) } while (dirty)
    return result
  }
  w.refresh = () => w.render(...w.lastArgs) // state set after a request settles is visible on the next render
  Object.defineProperty(w, 'result', { get: () => result })
  return w
}
const USAGE = (id, tokens = 3000) => [{ turn: { total_tokens: tokens }, action_type: 'chat' }, id]
const debitCalls = w => w.calls.filter(c => c.kind === 'debit')
const MARK = { [MARKER]: '1' }
// Mount, so the hook has read /api/usage/quota (and learned whether the server speaks the marker).
const mounted = async (options = {}) => {
  const w = hookWorld(options.world)
  if (options.marker) w.script.quota.push({ status: 200, headers: MARK, body: STATUS() })
  w.render(null, undefined); await settle()
  return w
}

await check('the hook spells the marker header the way the server sends it, and gains no import', async () => {
  const flagSource = readRepo('lib/quota/live-tier-flag.ts')
  assert.match(flagSource, new RegExp(`QUOTA_DEBIT_IDEMPOTENT_HEADER = '${MARKER}'`))
  assert.match(readRepo('hooks/use-quota.ts'), new RegExp(`DEBIT_IDEMPOTENT_HEADER = "${MARKER}"`))
  const imports = [...readRepo('hooks/use-quota.ts').matchAll(/^import\s+(type\s+)?[^\n]*from\s+["']([^"']+)["']/gm)].filter(m => !m[1]).map(m => m[2])
  assert.deepEqual(imports, ['react', 'next-auth/react'], 'the evidence harnesses that load this hook enumerate its imports')
})

// --- marker absent (flag off, or no answer yet): the hook is the base hook ----------------------
const OUTCOMES = {
  'network error': { throws: true }, 'HTTP 500': { status: 500 }, 'HTTP 503': { status: 503 }, 'HTTP 429': { status: 429 }, 'HTTP 408': { status: 408 },
  'HTTP 400': { status: 400 }, 'HTTP 401': { status: 401 }, 'HTTP 404': { status: 404 }, 'HTTP 409': { status: 409 },
}
async function hookTrace(code) {
  const out = []
  for (const [name, outcome] of Object.entries(OUTCOMES)) {
    for (const quotaFirst of ['ok', 'fails']) {
      const w = hookWorld({ code })
      if (quotaFirst === 'fails') w.script.quota.push({ status: 500 })
      w.render(null, undefined); await settle()
      w.script.debit.push(outcome)
      w.render(...USAGE('m1')); await settle()
      w.render(...USAGE('m1')); await settle()           // same frame again: no new request
      w.render(...USAGE('m1', 3100)); await settle()     // the same turn delivered again with new usage: sent again only if the base forgot it
      w.render(...USAGE('m2', 800)); await settle()      // the next turn books normally
      out.push([name, quotaFirst, w.calls.map(c => [c.kind, c.method, c.body ?? null, c.status]), w.sleeps, plain(w.result.status), w.result.capped, w.result.overflow, w.result.lastCostCents, w.result.isLoading])
    }
  }
  const ok = hookWorld({ code })
  ok.render(null, undefined); await settle()
  ok.render(...USAGE('m1')); await settle()
  out.push(['success', ok.calls.map(c => [c.kind, c.body ?? null, c.status]), plain(ok.result.status), ok.result.capped, ok.result.overflow, ok.result.lastCostCents])
  return out
}
await check('hook, no marker from the server: every failure class is dropped after ONE request and forgotten, exactly like the base hook (no timer, no retry)', async () => {
  const branch = await hookTrace(hookSource())
  for (const entry of branch) if (entry.length === 9) assert.equal(entry[3].length, 0, 'never sleeps without the marker')
  const branchHash = sha(branch)
  const baseText = gitShow('hooks/use-quota.ts')
  if (baseText !== null) assert.equal(branchHash, sha(await hookTrace(baseText)), `the hook with no marker behaves as the hook at ${BASE}`)
  if (process.env.PRINT_PINNED) console.log('hookOff =', branchHash)
  else assert.equal(branchHash, PINNED.hookOff, 'pinned hash of the base hook\'s behaviour')
  // and the failure really is "one request": e.g. a 500 leaves 1 debit call before the same-turn redelivery
  const w = hookWorld({}); w.render(null, undefined); await settle()
  w.script.debit.push({ status: 500 }); w.render(...USAGE('m1')); await settle()
  assert.equal(debitCalls(w).length, 1)
})

// --- marker present: bounded, classified, same key ---------------------------------------------
const RETRY_CLASSES = [
  ['network error', { throws: true }, true], ['HTTP 500', { status: 500 }, true], ['HTTP 502', { status: 502 }, true], ['HTTP 503', { status: 503 }, true], ['HTTP 504', { status: 504 }, true],
  ['HTTP 408', { status: 408 }, true], ['HTTP 429', { status: 429 }, true],
  ['HTTP 400', { status: 400 }, false], ['HTTP 401', { status: 401 }, false], ['HTTP 403', { status: 403 }, false], ['HTTP 404', { status: 404 }, false],
  ['HTTP 409', { status: 409 }, false], ['HTTP 413', { status: 413 }, false], ['HTTP 422', { status: 422 }, false], ['HTTP 451', { status: 451 }, false],
]
await check('hook, marker seen: network errors, 5xx, 408 and 429 are re-sent at most twice (3 requests), every other failure exactly once', async () => {
  for (const [name, outcome, retried] of RETRY_CLASSES) {
    const w = await mounted({ marker: true })
    w.script.debit.push(outcome, outcome, outcome, outcome, outcome)
    w.render(...USAGE('m1')); await settle()
    assert.equal(debitCalls(w).length, retried ? 3 : 1, name)
    assert.deepEqual(w.sleeps, retried ? [400, 1200] : [], `${name}: short backoff, bounded`)
    // failed for good: the turn is forgotten so a later delivery (next frame / reconnect) may try again
    w.render(...USAGE('m1', 3100)); await settle()
    assert.equal(debitCalls(w).length, retried ? 6 : 2, `${name}: a later delivery of the same turn is tried again`)
  }
})
await check('hook, marker seen: every attempt carries the identical request (same URL, method and body: the same messageId, tokens and action)', async () => {
  const w = await mounted({ marker: true })
  w.script.debit.push({ throws: true }, { status: 503 }, { status: 200, headers: MARK, body: DEBIT_OK() })
  w.render(...USAGE('m1', 4321)); await settle()
  const calls = debitCalls(w)
  assert.equal(calls.length, 3)
  assert.equal(new Set(calls.map(c => c.body)).size, 1, 'one body, three times')
  assert.deepEqual(JSON.parse(calls[0].body), { messageId: 'm1', tokens: 4321, actionType: 'chat' })
  assert.deepEqual(calls.map(c => c.method), ['POST', 'POST', 'POST'])
})
await check('hook, marker seen: success on a retry applies the booking once and stops; success at any attempt', async () => {
  for (const succeedAt of [0, 1, 2]) {
    const w = await mounted({ marker: true })
    for (let i = 0; i < succeedAt; i++) w.script.debit.push({ status: 503 })
    w.script.debit.push({ status: 200, headers: MARK, body: DEBIT_OK({ deducted: true, costCents: 7, capped: false }) })
    w.render(...USAGE('m1')); await settle()
    assert.equal(debitCalls(w).length, succeedAt + 1)
    w.refresh()
    assert.equal(w.result.lastCostCents, 7)
    assert.equal(w.result.overflow, true)
    assert.equal(w.result.status.spent.dailyCents, 3)
    // booked: a repeat of the same frame (same payload) and the same turn with new usage are ignored
    w.render(...USAGE('m1')); await settle()
    w.render(...USAGE('m1', 3100)); await settle()
    assert.equal(debitCalls(w).length, succeedAt + 1, 'never sent again once booked')
  }
})
await check('hook, marker seen: while a debit is being retried the same turn is not sent in parallel (a re-delivered frame is ignored)', async () => {
  const w = await mounted({ marker: true })
  w.manualTimers = true
  w.script.debit.push({ status: 503 }, { status: 200, headers: MARK, body: DEBIT_OK() })
  w.render(...USAGE('m1')); await settle()
  assert.equal(debitCalls(w).length, 1, 'waiting out the backoff')
  w.render(...USAGE('m1', 3100)); await settle()
  w.render(...USAGE('m1', 3200)); await settle()
  assert.equal(debitCalls(w).length, 1, 'still one request in flight for this turn')
  w.timers.shift()(); await settle()
  assert.equal(debitCalls(w).length, 2)
  w.refresh()
  assert.equal(w.result.lastCostCents, 3)
})
await check('hook, marker seen: a retry never lands in a different account (sign-out or switch during the backoff drops it)', async () => {
  for (const next of ['u2', null]) {
    const w = await mounted({ marker: true })
    w.manualTimers = true
    w.script.debit.push({ status: 503 })
    w.render(...USAGE('m1')); await settle()
    assert.equal(debitCalls(w).length, 1)
    w.userId = next
    w.render(...USAGE('m1')); await settle()
    w.timers.shift()(); await settle()
    assert.equal(debitCalls(w).length, 1, 'the retry was not sent')
  }
})
await check('hook: the server\'s marker is learned from the quota read and from debit responses, and unlearned when a later answer lacks it', async () => {
  // learned from the debit response itself
  const a = await mounted({ marker: false })
  a.script.debit.push({ status: 200, headers: MARK, body: DEBIT_OK() })
  a.render(...USAGE('m1')); await settle()
  a.script.debit.push({ status: 503 }, { status: 200, headers: MARK, body: DEBIT_OK() })
  a.render(...USAGE('m2', 900)); await settle()
  assert.equal(debitCalls(a).length, 3, 'm1 once, m2 twice (retried because the first debit answer carried the marker)')
  // learned from a later quota read
  const b = await mounted({ marker: false })
  b.script.quota.push({ status: 200, headers: MARK, body: STATUS() })
  await b.result.refetch(); await settle()
  b.script.debit.push({ status: 500 }, { status: 200, headers: MARK, body: DEBIT_OK() })
  b.render(...USAGE('m1')); await settle()
  assert.equal(debitCalls(b).length, 2)
  // unlearned: the server (flag turned off) answers without the marker
  const c = await mounted({ marker: true })
  c.script.debit.push({ status: 200, body: DEBIT_OK() })
  c.render(...USAGE('m1')); await settle()
  c.script.debit.push({ status: 500 }, { status: 200, body: DEBIT_OK() })
  c.render(...USAGE('m2', 900)); await settle()
  assert.equal(debitCalls(c).length, 2, 'm1 once, m2 once: no retry after an answer without the marker')
  // a failed quota read or a non-2xx answer does not change what was learned
  const d = await mounted({ marker: true })
  d.script.quota.push({ status: 500 }); await d.result.refetch(); await settle()
  d.script.debit.push({ status: 503 }, { status: 200, headers: MARK, body: DEBIT_OK() })
  d.render(...USAGE('m1')); await settle()
  assert.equal(debitCalls(d).length, 2)
})
await check('hook, marker seen: an unreadable 2xx is not re-sent (the server already booked it), and a refused request leaves the quota picture alone', async () => {
  const w = await mounted({ marker: true })
  w.script.debit.push({ status: 200, headers: MARK, jsonThrows: true })
  w.render(...USAGE('m1')); await settle()
  assert.equal(debitCalls(w).length, 1)
  const q = await mounted({ marker: true })
  q.script.debit.push({ status: 403 }); q.render(...USAGE('m1')); await settle(); q.refresh()
  assert.deepEqual(plain(q.result.status), STATUS())
  assert.equal(q.result.lastCostCents, null)
})

// =============================================================================================
// 7. The whole chain: hook -> real routes -> fake ledger, with faults. Nobody is charged twice.
// =============================================================================================
function chain({ db, env = on, session = sessionOf('pro'), userId = USER_ID }) {
  const routes = routeWorld({ db, env, session })
  const routeCalls = { debit: 0 }
  const serve = (kind, init, entry) => {
    return (async () => {
      const plan = chain.plan.shift() ?? {}
      entry.fault = plan.fault ?? null
      if (kind === 'quota') { const a = await routes.quota(); return respondFrom(a, entry) }
      if (plan.fault === 'drop-before-server') throw new Error('offline: connection reset before the request left')
      if (plan.fault === 'edge-503') { entry.status = 503; return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) } }
      if (plan.fault === 'commit-fails') db.faults.failCommit = () => { db.faults.failCommit = null; return true }
      routeCalls.debit++
      const answer = await routes.debit(JSON.parse(init.body))
      if (plan.fault === 'drop-after-server') { entry.status = `server ${answer.status}, response lost`; throw new Error('offline: response lost') }
      return respondFrom(answer, entry)
    })()
  }
  const respondFrom = (answer, entry) => {
    entry.status = answer.status
    const headers = Object.fromEntries(answer.headers)
    return { ok: answer.status < 400, status: answer.status, headers: { get: n => headers[n.toLowerCase()] ?? null }, json: async () => JSON.parse(answer.text) }
  }
  const w = hookWorld({ userId, serve })
  return { w, routes, routeCalls, db }
}
chain.plan = []
const planFaults = (...faults) => { chain.plan = faults.map(f => (f ? { fault: f } : {})) }
const invariant = (db, messageId, startWallet, expectedTaken) => {
  assert.ok(ledgerCount(db, messageId) <= 1, 'the turn has at most one ledger row')
  assert.equal(takenFromWallet(db, startWallet), expectedTaken, 'the wallet was debited at most once for the turn')
}
const FAULT_RUNS = [
  { name: 'response lost after the server booked it, then recovered', faults: [null, 'drop-after-server', null], debitCalls: 2 },
  { name: 'response lost twice, third answer arrives', faults: [null, 'drop-after-server', 'drop-after-server', null], debitCalls: 3 },
  { name: 'request lost before it reached the server', faults: [null, 'drop-before-server', null], debitCalls: 2 },
  { name: 'edge 503 before the server, then ok', faults: [null, 'edge-503', null], debitCalls: 2 },
  { name: 'database commit fails (500), the retry books it', faults: [null, 'commit-fails', null], debitCalls: 2 },
  { name: 'every attempt lost after the server booked the first', faults: [null, 'drop-after-server', 'drop-after-server', 'drop-after-server'], debitCalls: 3, reaches: false },
]
for (const p of PATHS) {
  await check(`chain (${p.name}): the browser retries lost responses and failures; the turn is booked once, the wallet debited at most once`, async () => {
    for (const run of FAULT_RUNS) {
      const db = p.make()
      const { w } = chain({ db })
      planFaults(...run.faults)
      w.render(null, undefined); await settle()
      w.render(...USAGE('m1', 3000)); await settle()
      assert.equal(debitCalls(w).length, run.debitCalls, `${run.name}: attempts`)
      invariant(db, 'm1', p.wallet, p.source === 'topup' ? 3 : 0)
      assert.equal(ledgerCount(db, 'm1'), 1, `${run.name}: booked`)
      w.refresh()
      if (run.reaches === false) {
        assert.equal(w.result.lastCostCents, null, `${run.name}: the page never heard`)
        planFaults()
        w.render(...USAGE('m1', 3100)); await settle()   // the turn is delivered again later: answered from the ledger, booked nowhere new
        invariant(db, 'm1', p.wallet, p.source === 'topup' ? 3 : 0)
        w.refresh()
      }
      assert.equal(w.result.lastCostCents, 3, `${run.name}: the booking reached the page`)
      assert.equal(w.result.overflow, p.deducted, `${run.name}: the page is told what really happened (plan vs wallet)`)
    }
  })
}
await check('chain: when every attempt fails before reaching the server nothing is booked, and the next delivery of the same turn books it once', async () => {
  const db = makeDb({ tier: 'pro', wallet: 100, ledger: spendToday(624) })
  const { w } = chain({ db })
  planFaults(null, 'edge-503', 'drop-before-server', 'edge-503')
  w.render(null, undefined); await settle()
  w.render(...USAGE('m1')); await settle()
  assert.equal(debitCalls(w).length, 3)
  assert.equal(ledgerCount(db, 'm1'), 0)
  assert.equal(takenFromWallet(db, 100), 0)
  planFaults()
  w.render(...USAGE('m1', 3100)); await settle()  // the same turn, delivered again: this delivery is the one that books (3100 tokens = 4 cents)
  w.render(...USAGE('m1', 3200)); await settle()  // and again: answered from the ledger, nothing more is taken
  invariant(db, 'm1', 100, 4)
  assert.equal(ledgerCount(db, 'm1'), 1)
})
await check('chain: a user never charged for the same turn across many frames, reloads (fresh hook) and retries', async () => {
  const db = makeDb({ tier: 'pro', wallet: 100, ledger: spendToday(624) })
  for (let reload = 0; reload < 4; reload++) {
    const { w } = chain({ db })
    planFaults(null, reload % 2 ? 'drop-after-server' : null)
    w.render(null, undefined); await settle()
    w.render(...USAGE('m1')); await settle()
    w.render(...USAGE('m1', 3100)); await settle()
  }
  invariant(db, 'm1', 100, 3)
  assert.equal(ledgerCount(db, 'm1'), 1)
})
await check('chain, flag off: a lost response is NOT retried (the base behaviour), and a later delivery is still safe', async () => {
  const db = makeDb({ tier: 'pro', wallet: 100, ledger: spendToday(624) })
  const { w } = chain({ db, env: {} })
  planFaults(null, 'drop-after-server')
  w.render(null, undefined); await settle()
  w.render(...USAGE('m1')); await settle()
  assert.equal(debitCalls(w).length, 1, 'one request, no retry, no timer')
  assert.deepEqual(w.sleeps, [])
  assert.equal(ledgerCount(db, 'm1'), 1, 'the server had booked it')
  w.render(...USAGE('m1', 3100)); await settle()
  invariant(db, 'm1', 100, 3)
})
await check('chain: two tabs (two hooks) delivering the same turn at the same moment, each retrying: one booking', async () => {
  const db = makeDb({ tier: 'pro', wallet: 100, ledger: spendToday(624) })
  chain.plan = []
  const tabA = chain({ db }), tabB = chain({ db })
  tabA.w.render(null, undefined); tabB.w.render(null, undefined); await settle()
  chain.plan = [{}, { fault: 'drop-after-server' }, { fault: 'drop-after-server' }, {}, {}, {}, {}, {}]
  db.barrier = { parties: 2, waiting: [] }
  tabA.w.render(...USAGE('m1')); tabB.w.render(...USAGE('m1')); await settle()
  invariant(db, 'm1', 100, 3)
  assert.equal(ledgerCount(db, 'm1'), 1)
  assert.ok(debitCalls(tabA.w).length + debitCalls(tabB.w).length >= 2)
})

// =============================================================================================
// 8. Where else the JWT tier is read for quota: nowhere in the gate
// =============================================================================================
await check('the Builder gate takes its picture only from useQuota (the two routes); it never reads a tier from the session itself', async () => {
  const page = readRepo('app/builder/page.tsx')
  assert.match(page, /const q = quota\.status\n/)
  assert.doesNotMatch(page, /session\??\.user\??\.tier|user\??\.tier/, 'no tier read in the Builder page')
  assert.match(page, /const quota = useQuota\(/)
})

console.log(`Quota live tier + idempotent debit: ${checks} checks passed (${baseAvailable ? `flag-off compared with the code at ${BASE} and with its pinned hashes` : `base commit ${BASE} unavailable: flag-off compared with pinned hashes only`})`)
