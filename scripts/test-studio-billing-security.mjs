/**
 * Billing security (SECURITY-AUDIT-BILLING B4-B9) on program1/billing-security-fixes. Offline: no Stripe, no database, no network.
 * The real route files run in a vm against an in-memory Prisma with transactions (undo log, a yield between operations so
 * concurrent transactions interleave). The TypeScript compiler is the only dependency read.
 *
 *   node scripts/test-studio-billing-security.mjs                  the proof
 *   node scripts/test-studio-billing-security.mjs --mutation-check every mutant below must fail it
 *
 * 1. Own commits: every non-merge commit on the branch above the studio base is PROGRAM-1's or starts "Billing security:", and touches only this change's files.
 * 2. Strip: each owned file stripped (alone, and through the later-changes registry) is the base commit's byte for byte; a stray edit is caught.
 * 3. Route rig: concurrent redeem (B4), replayed event (B7), crash then retry (claim not lost), refund + dispute (one clawback), unknown price (fail closed),
 *    missing table (500), B5 always on (coupons never grant a tier), B8 flag off = today (and on = clawback), unpaid top-up not credited, a stale subscription event ignored.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ts = createRequire(process.env.DECKSTER_TEST_DEPENDENCY_PACKAGE || path.join(ROOT, 'package.json'))('typescript')
const strip = await import('./studio-billing-security-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const BASE = '3e1ce88e'
const P1_COMMIT = '28b4d986'
const FLAG = strip.BILLING_SECURITY_FLAG
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8')
let checks = 0
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++ }
const ok = (v, m) => { assert.ok(v, m); checks++ }

const WEBHOOK = 'app/api/webhooks/stripe/route.ts', REDEEM = 'app/api/coupons/redeem/route.ts', WALLET = 'lib/wallet.ts'
const MODULE = 'lib/billing/stripe-webhook.ts', SECURITY = 'lib/billing/security.ts', PLAN = 'lib/stripe/subscription-plan.ts'

// ---------------------------------------------------------------- mutants (in memory; `from` must occur exactly once)
const MUTANTS = {
  'remove claimed.count': [[REDEEM, 'if (claimed.count !== 1) {', 'if (false) {']],
  'remove claimEvent': [[MODULE, `const claim = await tx.stripeWebhookEvent.createMany({`, `const claim = { count: 1 }; void ({`]],
  'claim outside the transaction (released only on catch)': [[MODULE, `      if (claim.count !== 1) return 'duplicate'\n      await dispatch(event, tx, deps)`, `      if (claim.count !== 1) return 'duplicate'\n      tx.__commitNow()\n      await dispatch(event, tx, deps)`]],
  'remove isTopupPaid': [[MODULE, 'if (!isTopupPaid(session)) {', 'if (false) {']],
  "re-allow tier='pro'": [[MODULE, 'if (!plan && active) {', 'if (false) {'], [MODULE, `const newTier = active && plan ? plan.tier : 'free'`, `const newTier = active ? (plan ? plan.tier : 'pro') : 'free'`]],
  'fail-open on the missing table': [[MODULE, `return { status: 500, body: { error: 'Webhook event store unavailable' } }`, `return { status: 200, body: { received: true } }`]],
  'no cap at the top-up': [[MODULE, 'const cents = Math.min(piece.cents, remaining)', 'const cents = piece.cents']],
  'one ref per payment intent (second partial refund lost)': [[MODULE, 'clawbackSourceRef(`refund:${refund.id}`)', 'clawbackSourceRef(`refund:${pi}`)']],
  'refund replay not deduped (ref per event)': [[MODULE, 'clawbackSourceRef(`refund:${refund.id}`)', 'clawbackSourceRef(`refund:${refund.id}:${event.id}`)']],
  'clawed sum not read': [[MODULE, 'let remaining = Math.max(0, topup.amountCents - (clawed._sum.amountCents ?? 0))', 'let remaining = topup.amountCents']],
  'user row not locked': [[MODULE, "await tx.user.update({ where: { id: topup.userId }, data: { walletBalanceCents: { increment: 0 } }, select: { id: true } })", 'void 0']],
  'deleted with no row fails': [[MODULE, "  if (!existing) {\n    console.log(`[stripe-webhook] subscription.deleted", "  if (false) {\n    console.log(`[stripe-webhook] subscription.deleted"]],
  'B5 re-grants the coupon tier': [[SECURITY, 'return { approved: true, approvedAt: now, approvedBy: `coupon:${couponCode}` }', 'return { approved: true, approvedAt: now, approvedBy: `coupon:${couponCode}`, tier: "pro" }']],
  'B8 ignores the flag': [[MODULE, 'if (isCouponTierHardeningOn(deps.env)) return handleClawback(event, tx, deps)', 'return handleClawback(event, tx, deps)']],
  'flag on for any value': [[SECURITY, 'return env[COUPON_TIER_HARDENING_FLAG] === "true"', 'return Boolean(env[COUPON_TIER_HARDENING_FLAG])']],
  'stale subscription event applied': [[MODULE, 'if (isStaleSubscriptionEvent(event.created, newest?.eventCreated)) {', 'if (false) {']],
}
const MUTANT = process.env.BILLING_SECURITY_MUTANT
const source = rel => {
  let text = read(rel)
  if (!MUTANT) return text
  const edits = MUTANTS[MUTANT] ?? (console.error(`Unknown mutant ${MUTANT}`), process.exit(3))
  for (const [file, from, to] of edits) {
    if (file !== rel) continue
    if (text.split(from).length !== 2) { console.error(`Mutant "${MUTANT}" is a no-op in ${rel}`); process.exit(3) }
    text = text.replace(from, () => to)
  }
  return text
}
if (process.argv.includes('--mutation-check')) {
  const run = mutant => spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...(mutant ? { BILLING_SECURITY_MUTANT: mutant } : {}) } })
  const clean = run()
  assert.equal(clean.status, 0, `the unmutated proof must pass first:\n${clean.stderr || clean.stdout}`)
  let escaped = 0
  for (const mutant of Object.keys(MUTANTS)) {
    const r = run(mutant), caught = r.status === 1
    console.log(`${caught ? 'caught ' : 'ESCAPED'}  ${mutant}${caught ? `  <- ${(r.stderr.match(/AssertionError[^\n]*\n?[^\n]*/) || [''])[0].replace(/\s+/g, ' ').slice(0, 140)}` : ` (exit ${r.status})`}`)
    if (!caught) escaped++
  }
  console.log(`Mutation check: ${Object.keys(MUTANTS).length - escaped}/${Object.keys(MUTANTS).length} mutants caught; the unmutated proof passes.`)
  process.exit(escaped ? 1 : 0)
}

// ---------------------------------------------------------------- 1. own commits
{
  const own = git('rev-list', '--no-merges', 'HEAD', `^${BASE}`).split('\n').filter(Boolean)
  ok(own.length >= 2, 'the branch carries PROGRAM-1\'s commit and this change\'s')
  for (const sha of own) {
    const subject = git('log', '-1', '--format=%s', sha).trim()
    ok(sha.startsWith(P1_COMMIT) || subject.startsWith('Billing security: '), `own commit ${sha.slice(0, 8)} is PROGRAM-1's or starts "Billing security:" (${subject})`)
    const files = git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean)
    for (const f of files) ok(strip.BILLING_SECURITY_SCOPE_FILES.has(f), `${sha.slice(0, 8)} touches only this change's files (${f})`)
  }
  ok(registry.LATER_CHANGE_FILES.has(WEBHOOK) && registry.LATER_CHANGE_FILES.has('lib/billing/stripe-webhook.ts'), 'the registry names this change\'s files')
  ok(registry.LATER_ENV_BLOCKS.includes(strip.BILLING_SECURITY_ENV_BLOCK) && registry.LATER_STRIPS.includes(strip.stripBillingSecurity), 'the registry holds the block and the strip')
}

// ---------------------------------------------------------------- 2. strip = base
{
  for (const rel of strip.BILLING_SECURITY_FILES) {
    const head = read(rel), base = git('show', `${BASE}:${rel}`)
    ok(head !== base, `${rel}: the change is there`)
    eq(strip.stripBillingSecurity(rel, head), base, `${rel}: stripped, the base byte for byte`)
    eq(registry.stripLaterChanges(rel, head), registry.stripLaterChanges(rel, base), `${rel}: through the registry, the base`)
    const lines = head.split('\n'), i = lines.findIndex(l => l.trim() && !strip.BILLING_SECURITY_MARKER_RE.test(l) && !/^\s*(\/\/|\*|$)/.test(l) && l.length > 12)
    const stray = [...lines.slice(0, i), lines[i] + ' ', ...lines.slice(i + 1)].join('\n')
    ok(strip.stripBillingSecurity(rel, stray) !== base, `${rel}: an unmarked edit is caught`)
  }
  for (const rel of strip.BILLING_SECURITY_PIN_FILES) eq(strip.stripBillingSecurity(rel, read(rel)), git('show', `${BASE}:${rel}`), `${rel}: the taught pin, put back, is the base`)
  eq(registry.stripLaterEnvBlocks('.env.example', read('.env.example')), registry.stripLaterEnvBlocks('.env.example', git('show', `${BASE}:.env.example`)), '.env.example: the base plus the block')
  ok(/^STUDIO_BILLING_COUPON_TIER_HARDENING="false"$/m.test(strip.BILLING_SECURITY_ENV_BLOCK), 'the block sets the flag off')
  eq((read(SECURITY).match(/=== "true"/g) || []).length, 1, 'the flag is read once, for an exact "true"')
}

// ---------------------------------------------------------------- 3. the rig
const tick = () => new Promise(r => setImmediate(r))
const P2002 = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
function makeDb({ missingTable = false } = {}) {
  const t = { users: new Map(), coupons: new Map(), redemptions: [], wallet: [], events: new Map(), subs: new Map(), payments: new Map() }
  let fail = null
  const db = { t, failOnce: name => { fail = name } }
  const matchUser = w => [...t.users.values()].find(u => (w.id && u.id === w.id) || (w.stripeCustomerId && u.stripeCustomerId === w.stripeCustomerId))
  const apply = (row, data, undo) => { const before = { ...row }; undo.push(() => { for (const k of Object.keys(row)) delete row[k]; Object.assign(row, before) }); for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === 'object' && 'increment' in v ? row[k] + v.increment : v }
  const client = undo => {
    const step = async name => { await tick(); if (fail === name) { fail = null; throw new Error(`crash in ${name}`) } }
    const c = {
      __commitNow: () => { undo.length = 0 },
      coupon: {
        async findUnique({ where }) { await step('coupon.findUnique'); const c = t.coupons.get(where.code); return c ? { ...c } : null },
        async update({ where, data }) { await step('coupon.update'); const c = [...t.coupons.values()].find(x => x.id === where.id); apply(c, data, undo); return { ...c } },
        async updateMany({ where, data }) {
          await step('coupon.updateMany')
          const c = [...t.coupons.values()].find(x => x.id === where.id && (!where.timesRedeemed || x.timesRedeemed < where.timesRedeemed.lt))
          if (!c) return { count: 0 }
          apply(c, data, undo); return { count: 1 }
        },
      },
      couponRedemption: {
        async findUnique({ where }) { await step('cr.findUnique'); const k = where.couponId_userId; return t.redemptions.find(r => r.couponId === k.couponId && r.userId === k.userId) ?? null },
        async create({ data }) { await step('cr.create'); if (t.redemptions.some(r => r.couponId === data.couponId && r.userId === data.userId)) throw P2002(); t.redemptions.push(data); undo.push(() => t.redemptions.splice(t.redemptions.indexOf(data), 1)); return data },
      },
      user: {
        async findUnique({ where }) { await step('user.findUnique'); const u = matchUser(where); return u ? { ...u } : null },
        async findUniqueOrThrow({ where }) { const u = await c.user.findUnique({ where }); if (!u) throw new Error('no user'); return u },
        async update({ where, data }) { await step('user.update'); const u = matchUser(where); if (!u) throw new Error('no user'); if (data.walletBalanceCents?.increment === 0) db.locks = (db.locks || 0) + 1; apply(u, data, undo); return { ...u } },
      },
      walletTransaction: {
        async findUnique({ where }) { await step('wt.findUnique'); return t.wallet.find(w => w.sourceRef === where.sourceRef) ?? null },
        async aggregate({ where }) { await step('wt.aggregate'); const rows = t.wallet.filter(w => w.reason === where.reason && w.metadata?.[where.metadata.path[0]] === where.metadata.equals); return { _sum: { amountCents: rows.length ? rows.reduce((n, w) => n + w.amountCents, 0) : null } } },
        async findFirst({ where }) { await step('wt.findFirst'); return t.wallet.find(w => w.reason === where.reason && w.metadata?.[where.metadata.path[0]] === where.metadata.equals) ?? null },
        async create({ data }) { await step('wt.create'); if (data.sourceRef && t.wallet.some(w => w.sourceRef === data.sourceRef)) throw P2002(); const row = { id: `wt_${t.wallet.length + 1}`, ...data }; t.wallet.push(row); undo.push(() => t.wallet.splice(t.wallet.indexOf(row), 1)); return row },
      },
      stripeWebhookEvent: {
        async createMany({ data, skipDuplicates }) {
          await step('event.claim'); if (missingTable) throw Object.assign(new Error('table does not exist'), { code: 'P2021' })
          let count = 0
          for (const row of data) { if (t.events.has(row.id)) { if (!skipDuplicates) throw P2002(); continue } ok(typeof row.eventCreated === 'bigint', 'eventCreated is stored as a BigInt'); t.events.set(row.id, row); undo.push(() => t.events.delete(row.id)); count++ }
          return { count }
        },
        async findFirst({ where }) { await step('event.findFirst'); if (missingTable) throw Object.assign(new Error('missing'), { code: 'P2021' }); const rows = [...t.events.values()].filter(e => e.objectId === where.objectId && e.id !== where.id.not && e.type.startsWith(where.type.startsWith)).sort((a, b) => Number(b.eventCreated - a.eventCreated)); return rows[0] ?? null },
      },
      subscription: {
        async findUnique({ where }) { await step('sub.findUnique'); return t.subs.get(where.stripeSubscriptionId) ?? null },
        async upsert({ where, update, create }) { await step('sub.upsert'); const cur = t.subs.get(where.stripeSubscriptionId); if (cur) apply(cur, update, undo); else { t.subs.set(where.stripeSubscriptionId, { ...create }); undo.push(() => t.subs.delete(where.stripeSubscriptionId)) } return t.subs.get(where.stripeSubscriptionId) },
        async update({ where, data }) { await step('sub.update'); const cur = t.subs.get(where.stripeSubscriptionId); if (!cur) throw new Error('P2025'); apply(cur, data, undo); return cur },
      },
      payment: {
        async findUnique({ where }) { await step('pay.findUnique'); return t.payments.get(where.stripeInvoiceId) ?? null },
        async upsert({ where, update, create }) { await step('pay.upsert'); const cur = t.payments.get(where.stripeInvoiceId); if (cur) apply(cur, update, undo); else { t.payments.set(where.stripeInvoiceId, { ...create }); undo.push(() => t.payments.delete(where.stripeInvoiceId)) } return t.payments.get(where.stripeInvoiceId) },
        async create({ data }) { await step('pay.create'); if (t.payments.has(data.stripeInvoiceId)) throw P2002(); t.payments.set(data.stripeInvoiceId, data); undo.push(() => t.payments.delete(data.stripeInvoiceId)); return data },
      },
    }
    return c
  }
  const outer = []
  db.prisma = {
    ...client(outer),
    async $transaction(fn) {
      const undo = [], tx = client(undo)
      try { return await fn(tx) } catch (error) { for (const u of undo.reverse()) u(); throw error }
    },
  }
  return db
}

function load(text, filename, imports, env) {
  const out = ts.transpileModule(text, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  const module = { exports: {} }
  vm.runInNewContext(out.outputText, {
    module, exports: module.exports, BigInt, Promise, setImmediate,
    require: name => { if (!(name in imports)) throw new Error(`Unexpected import ${name} from ${filename}`); return imports[name] },
    console: { log() {}, error() {}, warn() {} }, process: { env },
  }, { filename })
  return module.exports
}
const NextResponse = { json: (body, init = {}) => ({ status: init.status ?? 200, body: JSON.parse(JSON.stringify(body, (k, v) => typeof v === 'bigint' ? Number(v) : v)) }) }
const PRICES = { STRIPE_STARTER_MONTHLY_PRICE_ID: 'price_s_m', STRIPE_STARTER_YEARLY_PRICE_ID: 'price_s_y', STRIPE_PRO_MONTHLY_PRICE_ID: 'price_p_m', STRIPE_PRO_YEARLY_PRICE_ID: 'price_p_y', STRIPE_MAX_MONTHLY_PRICE_ID: 'price_m_m', STRIPE_MAX_YEARLY_PRICE_ID: 'price_m_y' }

function app(db, env, { base = false } = {}) {
  const src = rel => (base ? git('show', `${BASE}:${rel}`) : source(rel))
  const security = load(source(SECURITY), SECURITY, {}, env)
  const plan = load(read(PLAN), PLAN, {}, env)
  const prismaMod = { prisma: db.prisma }
  const wallet = load(src(WALLET), WALLET, { '@/lib/prisma': prismaMod, '@/lib/billing/security': security }, env)
  const hook = base ? null : load(source(MODULE), MODULE, { '@/lib/stripe/subscription-plan': plan, '@/lib/billing/security': security }, env)
  let current = null
  const stripeMod = { getStripe: () => ({ webhooks: { constructEvent: () => current } }) }
  const webhook = load(src(WEBHOOK), WEBHOOK, { 'next/server': { NextResponse }, 'next/headers': { headers: async () => ({ get: () => 'sig' }) }, '@/lib/stripe/stripe': stripeMod, '@/lib/prisma': prismaMod, '@/lib/wallet': wallet, '@/lib/billing/stripe-webhook': hook, '@/lib/stripe/subscription-plan': plan, stripe: {} }, env)
  const redeem = load(src(REDEEM), REDEEM, { 'next/server': { NextResponse }, 'next-auth': { getServerSession: async () => ({ user: { id: app.user } }) }, '@/lib/auth-options': { authOptions: {} }, '@/lib/prisma': prismaMod, '@/lib/wallet': wallet, '@/lib/billing/security': security }, env)
  return {
    post: async event => { current = event; return webhook.POST({ text: async () => '{}' }) },
    redeem: async (user, code) => { app.user = user; return redeem.POST({ json: async () => ({ code }) }) },
  }
}
const seed = db => {
  for (const id of ['u1', 'u2', 'u3']) db.t.users.set(id, { id, tier: 'free', walletBalanceCents: 0, stripeCustomerId: `cus_${id}` })
  db.t.coupons.set('ONE', { id: 'c1', code: 'ONE', active: true, expiresAt: null, maxRedemptions: 1, timesRedeemed: 0, valueCents: 500, tier: 'pro' })
}
const ENV = flag => ({ COUPON_AUTH_ENABLED: 'true', ...PRICES, ...(flag === undefined ? {} : { [FLAG]: flag }) })
const ev = (id, type, object, created = 1800000000) => ({ id, type, created, data: { object } })
const topupSession = (patch = {}) => ({ id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', metadata: { userId: 'u1', kind: 'wallet_topup', amountCents: '1000', packId: 'p10' }, ...patch })
const sub = (patch = {}) => ({ id: 'sub_1', customer: 'cus_u1', status: 'active', metadata: { userId: 'u1' }, items: { has_more: false, data: [{ price: { id: 'price_s_m', product: 'prod_s' } }] }, current_period_start: 1, current_period_end: 2, cancel_at_period_end: false, canceled_at: null, trial_start: null, trial_end: null, ...patch })
const balance = (db, u = 'u1') => db.t.users.get(u).walletBalanceCents

// B4: concurrent redeem of a one-use coupon
{
  const db = makeDb(); seed(db); const a = app(db, ENV())
  const results = await Promise.all(['u1', 'u2', 'u3'].map(u => a.redeem(u, 'one')))
  eq(results.filter(r => r.status === 200).length, 1, 'B4: three concurrent redeems of a one-use coupon: exactly one succeeds')
  eq(results.filter(r => r.status === 422).map(r => r.body.error), ['This coupon has been fully redeemed', 'This coupon has been fully redeemed'], 'B4: the others are told it is fully redeemed')
  eq(db.t.coupons.get('ONE').timesRedeemed, 1, 'B4: timesRedeemed never passes the limit')
  eq(db.t.wallet.length, 1, 'B4: one credit')
  // the base shows the race is real in this rig
  const db0 = makeDb(); seed(db0); const b = app(db0, ENV(), { base: true })
  const r0 = await Promise.all(['u1', 'u2', 'u3'].map(u => b.redeem(u, 'one')))
  ok(r0.filter(r => r.status === 200).length > 1, 'B4: (the base over-redeems in the same rig)')
}
// B5 always on, whatever the flag says: credits + approval, never a tier (a paying user's tier is kept)
for (const value of [undefined, 'false', 'true', 'TRUE', '1']) {
  const db = makeDb(); seed(db); const r = await app(db, ENV(value)).redeem('u1', 'ONE')
  eq([r.status, r.body.tier, db.t.users.get('u1').tier, db.t.users.get('u1').approved, balance(db)], [200, 'free', 'free', true, 500], `B5 (flag ${JSON.stringify(value)}): credit + approval, no tier`)
  const db2 = makeDb(); seed(db2); db2.t.users.get('u2').tier = 'premium'; const r2 = await app(db2, ENV(value)).redeem('u2', 'ONE')
  eq([r2.body.tier, db2.t.users.get('u2').tier], ['premium', 'premium'], `B5 (flag ${JSON.stringify(value)}): a paying user's tier is kept`)
  const db0 = makeDb(); seed(db0); await app(db0, ENV(value), { base: true }).redeem('u1', 'ONE')
  eq(db0.t.users.get('u1').tier, 'pro', `B5 (flag ${JSON.stringify(value)}): (the base granted the tier in the same rig)`)
}
// B8: an unpaid top-up is not credited; async success credits once
{
  const db = makeDb(); seed(db); const a = app(db, ENV())
  eq((await a.post(ev('evt_u', 'checkout.session.completed', topupSession({ payment_status: 'unpaid' })))).status, 200, 'B8: unpaid top-up acked')
  eq(balance(db), 0, 'B8: an unpaid top-up is not credited')
  await a.post(ev('evt_a', 'checkout.session.async_payment_succeeded', topupSession()))
  eq(balance(db), 1000, 'B8: async_payment_succeeded credits it')
}
// B7: replayed event credits once
{
  const db = makeDb(); seed(db); const a = app(db, ENV())
  const first = await a.post(ev('evt_1', 'checkout.session.completed', topupSession({ id: 'cs_x' })))
  db.t.wallet.length = 0 // a replay must not lean on the wallet's sourceRef: the event claim alone answers it
  const again = await a.post(ev('evt_1', 'checkout.session.completed', topupSession({ id: 'cs_x' })))
  eq([first.status, again.status, again.body.duplicate], [200, 200, true], 'B7: a replayed event is acked as a duplicate')
  eq(balance(db), 1000, 'B7: and credited once')
}
// crash then retry: the claim is not lost
{
  const db = makeDb(); seed(db); const a = app(db, ENV())
  db.failOnce('user.update')
  const crashed = await a.post(ev('evt_c', 'checkout.session.completed', topupSession({ id: 'cs_c' })))
  eq([crashed.status, balance(db), db.t.events.has('evt_c')], [500, 0, false], 'crash: 500, nothing written, the claim rolled back with the writes')
  const retry = await a.post(ev('evt_c', 'checkout.session.completed', topupSession({ id: 'cs_c' })))
  eq([retry.status, retry.body.duplicate, balance(db), db.t.events.has('evt_c')], [200, undefined, 1000, true], 'retry: processed, credited once, claimed')
}
// refunds and disputes (flag on): per refund id / dispute id, capped at the top-up; flag off: today (no clawback)
const refundEv = (id, refunds, amount_refunded) => ev(id, 'charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', amount: 1000, amount_refunded, refunds: { data: refunds } })
for (const value of ['true', undefined, 'false', 'TRUE', '1']) {
  const db = makeDb(); seed(db); const a = app(db, ENV(value))
  await a.post(ev('evt_t', 'checkout.session.completed', topupSession()))
  db.t.users.get('u1').walletBalanceCents = 200 // spent 800 since
  const r1 = await a.post(refundEv('evt_r1', [{ id: 're_1', amount: 300, status: 'succeeded' }], 300))
  if (value === 'true') {
    const early = await a.post(refundEv('evt_r1b', [{ id: 're_1', amount: 300, status: 'succeeded' }], 300))
    eq([early.status, db.t.wallet.filter(w => w.reason === 'refund_clawback').reduce((n, w) => n + w.amountCents, 0)], [200, 300], 'a replayed refund (same refund id, under the cap) dedupes')
  }
  const r2 = await a.post(refundEv('evt_r2', [{ id: 're_1', amount: 300, status: 'succeeded' }, { id: 're_2', amount: 200, status: 'succeeded' }], 500))
  eq([r1.status, r2.status], [200, 200], `two partial refunds (flag ${value}): acked`)
  if (value === 'true') {
    eq(db.t.wallet.filter(w => w.reason === 'refund_clawback').map(w => [w.sourceRef, w.amountCents]), [['stripe_clawback:refund:re_1', 300], ['stripe_clawback:refund:re_2', 200]], 'two partial refunds claw both shares, one row per refund id')
    ok(db.locks >= 2, 'each clawback locks the user row first')
    const replay = await a.post(refundEv('evt_r3', [{ id: 're_1', amount: 300, status: 'succeeded' }, { id: 're_2', amount: 200, status: 'succeeded' }], 500))
    eq([replay.status, db.t.wallet.filter(w => w.reason === 'refund_clawback').length], [200, 2], 'a replayed refund (new event, same refund ids) dedupes')
    const d = await a.post(ev('evt_d', 'charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_1' }))
    eq([d.status, db.t.wallet.filter(w => w.reason === 'refund_clawback').reduce((n, w) => n + w.amountCents, 0)], [200, 1000], 'refund + dispute total is capped at the top-up')
    eq(balance(db), -800, 'B8 flag on: the balance may go negative, never past the top-up')
  } else {
    await a.post(ev('evt_d', 'charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_1' }))
    eq([db.t.wallet.filter(w => w.reason === 'refund_clawback').length, balance(db)], [0, 200], 'B8 flag off: no clawback, as today')
  }
}
// a dispute first, then a refund: still capped
{
  const db = makeDb(); seed(db); const a = app(db, ENV('true'))
  await a.post(ev('evt_t', 'checkout.session.completed', topupSession()))
  await a.post(ev('evt_d', 'charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_1' }))
  await a.post(refundEv('evt_r', [{ id: 're_9', amount: 1000, status: 'succeeded' }], 1000))
  eq(db.t.wallet.filter(w => w.reason === 'refund_clawback').reduce((n, w) => n + w.amountCents, 0), 1000, 'dispute then refund: capped at the top-up')
}
// subscription.deleted with no local row: 200, nothing to cancel
{
  const db = makeDb(); seed(db); const a = app(db, ENV())
  const r = await a.post(ev('evt_del', 'customer.subscription.deleted', sub({ id: 'sub_none' })))
  eq([r.status, db.t.users.get('u1').tier], [200, 'free'], 'subscription.deleted with no local row: 200, nothing changed')
}
// unknown price: fail closed
{
  const db = makeDb(); seed(db); const a = app(db, ENV())
  const r = await a.post(ev('evt_up', 'customer.subscription.created', sub({ items: { has_more: false, data: [{ price: { id: 'price_unknown', product: 'prod_x' } }] } })))
  eq([r.status, db.t.users.get('u1').tier, db.t.subs.size, db.t.events.has('evt_up')], [500, 'free', 0, false], 'B6: an unknown price grants nothing, writes nothing, 500 so Stripe retries')
  const k = await a.post(ev('evt_ok', 'customer.subscription.created', sub()))
  eq([k.status, db.t.users.get('u1').tier, db.t.subs.get('sub_1').tier], [200, 'starter', 'starter'], 'B6: a Starter price grants starter, not pro')
  const stale = await a.post(ev('evt_old', 'customer.subscription.updated', sub({ items: { has_more: false, data: [{ price: { id: 'price_m_m', product: 'prod_m' } }] } }), 1700000000))
  eq([stale.status, db.t.users.get('u1').tier], [200, 'starter'], 'B7: an older subscription event after a newer one is ignored')
  await a.post(ev('evt_new', 'customer.subscription.updated', sub({ items: { has_more: false, data: [{ price: { id: 'price_m_m', product: 'prod_m' } }] } }), 1900000000))
  eq(db.t.users.get('u1').tier, 'premium', 'B6: Max maps to premium')
}
// missing table: 500
{
  const db = makeDb({ missingTable: true }); seed(db); const a = app(db, ENV())
  const r = await a.post(ev('evt_m', 'checkout.session.completed', topupSession()))
  eq([r.status, balance(db)], [500, 0], 'missing fe_stripe_webhook_events: 500 (Stripe retries), nothing credited')
}
// B9: a duplicate redeem by the same user (P2002 by code) is a 422
{
  const db = makeDb(); seed(db); db.t.coupons.get('ONE').maxRedemptions = null
  const a = app(db, ENV()); const rs = await Promise.all([a.redeem('u1', 'ONE'), a.redeem('u1', 'ONE')])
  eq(rs.map(r => r.status).sort(), [200, 422], 'B9: a concurrent double submit is one success and one 422')
  eq(balance(db), 500, 'B9: credited once')
}
console.log(`billing security: ${checks} checks passed${MUTANT ? ` (mutant ${MUTANT})` : ''}`)
