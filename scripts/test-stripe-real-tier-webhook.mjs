/**
 * Offline execution of the actual webhook POST and pure plan resolver. No credentials,
 * Stripe client, database client or network module is loaded. Only the TypeScript compiler
 * and the pinned Stripe 17.4.0 declarations are read from an existing dependency directory.
 * Set DECKSTER_TEST_DEPENDENCY_PACKAGE to that checkout's package.json if this worktree has
 * no node_modules. The exact git baseline is executed separately for OFF parity.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dependencyRequire = createRequire(process.env.DECKSTER_TEST_DEPENDENCY_PACKAGE || path.join(ROOT, 'package.json'))
const ts = dependencyRequire('typescript')
const BASE = '55cef1d29341ed9cf4bc1c1d93657e644ded4de4'
const ROUTE = 'app/api/webhooks/stripe/route.ts'
const HELPER = 'lib/stripe/subscription-plan.ts'
const FLAG = 'STRIPE_REAL_TIER_MAPPING_ENABLED'
const SECRET = 'whsec_offline_fixture_not_a_real_secret'
const SIGNATURE = 'offline-fixture-signature'
const NOW = 1792600000000
const ENV = {
  STRIPE_STARTER_MONTHLY_PRICE_ID: 'price_fixture_starter_monthly',
  STRIPE_STARTER_YEARLY_PRICE_ID: 'price_fixture_starter_yearly',
  STRIPE_PRO_MONTHLY_PRICE_ID: 'price_fixture_pro_monthly',
  STRIPE_PRO_YEARLY_PRICE_ID: 'price_fixture_pro_yearly',
  STRIPE_MAX_MONTHLY_PRICE_ID: 'price_fixture_max_monthly',
  STRIPE_MAX_YEARLY_PRICE_ID: 'price_fixture_max_yearly',
}
const PLANS = [
  ['STRIPE_STARTER_MONTHLY_PRICE_ID', 'starter', 'monthly'],
  ['STRIPE_STARTER_YEARLY_PRICE_ID', 'starter', 'yearly'],
  ['STRIPE_PRO_MONTHLY_PRICE_ID', 'pro', 'monthly'],
  ['STRIPE_PRO_YEARLY_PRICE_ID', 'pro', 'yearly'],
  ['STRIPE_MAX_MONTHLY_PRICE_ID', 'premium', 'monthly'],
  ['STRIPE_MAX_YEARLY_PRICE_ID', 'premium', 'yearly'],
]
let checks = 0
let postExecutions = 0
let networkAttempts = 0
const norm = value => JSON.parse(JSON.stringify(value))
const eq = (actual, expected, message) => { assert.deepEqual(norm(actual), norm(expected), message); checks++ }
const ok = (value, message) => { assert.ok(value, message); checks++ }
const fails = (action, message) => { assert.throws(action, undefined, message); checks++ }
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const baselineSource = execFileSync('git', ['show', `${BASE}:${ROUTE}`], { cwd: ROOT, encoding: 'utf8' })
const routeSource = read(ROUTE)

function load(source, filename, imports = {}, globals = {}) {
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  const errors = (compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `${filename}: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')}`)
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports,
    // Any unexpected import or network attempt fails; no host process/env is exposed.
    require: name => {
      if (!(name in imports)) throw new Error(`Unexpected import ${name} from ${filename}`)
      return imports[name]
    },
    fetch: () => { networkAttempts++; throw new Error('Network is blocked in the webhook fixture') },
    console: { log() {}, error() {}, warn() {} },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [NOW])) }
      static now() { return NOW }
    },
    ...globals,
  }, { filename })
  return module.exports
}

const helper = load(read(HELPER), HELPER)
const item = (priceId, product = 'prod_fixture_base') => ({ price: { id: priceId, product } })
const items = data => ({ data, has_more: false })
const subscription = (patch = {}) => ({
  id: 'sub_fixture', customer: 'cus_fixture', metadata: { userId: 'user_fixture' },
  status: 'active', items: items([item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID)]),
  current_period_start: 1790000000, current_period_end: 1792678400,
  cancel_at_period_end: false, canceled_at: null, trial_start: null, trial_end: null,
  ...patch,
})
const event = (type, object) => ({ id: `evt_fixture_${type}`, type, data: { object } })
const topup = (patch = {}) => ({
  id: 'cs_fixture_topup', metadata: { userId: 'user_fixture', kind: 'wallet_topup', amountCents: '2500', packId: 'fixture_pack' },
  payment_intent: 'pi_fixture_topup', ...patch,
})
const invoice = (patch = {}) => ({
  id: 'in_fixture', customer: 'cus_fixture', payment_intent: 'pi_fixture_invoice', subscription: 'sub_fixture',
  amount_paid: 5000, amount_due: 5500, currency: 'usd',
  hosted_invoice_url: 'https://fixture.invalid/invoice', invoice_pdf: 'https://fixture.invalid/invoice.pdf', ...patch,
})

function runtime(source = routeSource, values = {}, options = {}) {
  const calls = []
  const environmentReads = []
  let helperCalls = 0
  let signatureCalls = 0
  const users = new Map(options.noUser ? [] : [['cus_fixture', { id: 'user_fixture', tier: 'free', walletBalanceCents: 0 }]])
  const subscriptions = new Map(options.existing ? [['sub_fixture', { userId: 'user_fixture', tier: 'premium', billingCycle: 'yearly' }]] : [])
  const payments = new Map()
  const walletRefs = new Set()
  const env = new Proxy({ STRIPE_WEBHOOK_SECRET: SECRET, ...values }, {
    get(target, key) { environmentReads.push(key); return target[key] },
  })
  const record = (operation, args) => {
    calls.push({ operation, args: norm(args) })
    if (options.failOperation === operation) throw new Error('Fixture database failure')
  }
  const prisma = {
    user: {
      async findUnique(args) { record('user.findUnique', args); return users.get(args.where.stripeCustomerId) ?? null },
      async update(args) {
        record('user.update', args)
        const user = users.get(args.where.stripeCustomerId)
        if (!user) throw new Error('Fixture user missing')
        Object.assign(user, norm(args.data))
        return user
      },
    },
    subscription: {
      async upsert(args) {
        record('subscription.upsert', args)
        const id = args.where.stripeSubscriptionId
        const current = subscriptions.get(id)
        const next = current ? { ...current, ...norm(args.update) } : norm(args.create)
        subscriptions.set(id, next)
        return next
      },
      async update(args) {
        record('subscription.update', args)
        const current = subscriptions.get(args.where.stripeSubscriptionId)
        if (!current) throw new Error('Fixture subscription missing')
        Object.assign(current, norm(args.data))
        return current
      },
    },
    payment: {
      async create(args) {
        record('payment.create', args)
        if (payments.has(args.data.stripeInvoiceId)) throw new Error('Unique constraint on stripeInvoiceId')
        payments.set(args.data.stripeInvoiceId, norm(args.data))
        return args.data
      },
    },
  }
  const route = load(source, ROUTE, {
    'next/server': { NextResponse: { json: (data, init = {}) => ({ status: init.status ?? 200, data: norm(data) }) } },
    'next/headers': { headers: async () => ({ get: name => name === 'stripe-signature' ? currentSignature : null }) },
    '@/lib/stripe/stripe': { getStripe: () => ({ webhooks: {
      constructEvent(body, signature, secret) {
        signatureCalls++
        assert.equal(body, currentBody, 'Signature constructor receives the exact raw request body')
        assert.equal(secret, SECRET, 'Signature constructor receives the fixture secret')
        if (signature !== SIGNATURE) throw new Error('Fixture signature verification failed')
        return JSON.parse(body)
      },
    } }) },
    '@/lib/prisma': { prisma },
    '@/lib/wallet': { creditWallet: async args => {
      record('wallet.credit', args)
      if (options.walletError) throw new Error(options.walletError)
      if (walletRefs.has(args.sourceRef)) throw new Error('Unique constraint on wallet sourceRef')
      const user = [...users.values()].find(value => value.id === args.userId)
      if (!user) throw new Error('Fixture wallet owner missing')
      walletRefs.add(args.sourceRef)
      user.walletBalanceCents += args.amountCents
      return { balanceAfterCents: user.walletBalanceCents }
    } },
    '@/lib/stripe/subscription-plan': { resolveStripeSubscriptionPlan: (...args) => {
      helperCalls++
      return helper.resolveStripeSubscriptionPlan(...args)
    } },
  }, { process: { env } })
  let currentSignature
  let currentBody
  return {
    calls, environmentReads, users, subscriptions, payments,
    get helperCalls() { return helperCalls },
    get signatureCalls() { return signatureCalls },
    async post(payload, signature = SIGNATURE) {
      currentSignature = signature
      currentBody = JSON.stringify(payload)
      postExecutions++
      return route.POST({ text: async () => currentBody })
    },
    snapshot() { return norm({ calls, users: [...users], subscriptions: [...subscriptions], payments: [...payments] }) },
  }
}

const enabled = (extra = {}) => ({ ...ENV, [FLAG]: 'true', ...extra })
const success = { status: 200, data: { received: true } }
const retry = { status: 500, data: { error: 'Webhook processing failed' } }
const writes = runtime => runtime.calls.filter(call => !call.operation.endsWith('findUnique'))

// All six plans go through the actual created AND updated webhook path, with active/trialing
// user entitlement and both upsert payload arms checked (an existing Max plan can downgrade).
for (const [key, tier, billingCycle] of PLANS) {
  for (const kind of ['customer.subscription.created', 'customer.subscription.updated']) {
    for (const status of ['active', 'trialing']) {
      const rt = runtime(routeSource, enabled(), { existing: kind.endsWith('updated') })
      const sub = subscription({ status, items: items([item(ENV[key])]), trial_start: 1790000000, trial_end: 1790600000 })
      eq(await rt.post(event(kind, sub)), success, `${key} ${kind} ${status} response`)
      const upsert = rt.calls.find(call => call.operation === 'subscription.upsert').args
      eq([upsert.create.tier, upsert.create.billingCycle], [tier, billingCycle], 'Create payload stores mapped plan and cycle')
      eq([upsert.update.tier, upsert.update.billingCycle], [tier, billingCycle], 'Update payload stores mapped plan and cycle')
      eq([rt.subscriptions.get(sub.id).tier, rt.subscriptions.get(sub.id).billingCycle], [tier, billingCycle], 'Persisted subscription reflects the mapped plan')
      eq([rt.users.get(sub.customer).tier, rt.users.get(sub.customer).stripePriceId], [tier, ENV[key]], 'Active/trialing user receives the matching plan and price')
      eq(rt.helperCalls, 1, 'Mapping executes once per subscription event')
    }
  }
}

// A live sequence verifies upgrades, downgrades and monthly/yearly switches on one record.
{
  const rt = runtime(routeSource, enabled())
  for (const [key, tier, cycle] of [PLANS[0], PLANS[5], PLANS[2], PLANS[1], PLANS[4], PLANS[3]]) {
    eq(await rt.post(event('customer.subscription.updated', subscription({ items: items([item(ENV[key])]) }))), success, 'Plan switch succeeds')
    eq([rt.subscriptions.get('sub_fixture').tier, rt.subscriptions.get('sub_fixture').billingCycle, rt.users.get('cus_fixture').tier], [tier, cycle, tier], 'Same subscription switches tier, cycle and user entitlement together')
  }
}

for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused']) {
  const rt = runtime(routeSource, enabled(), { existing: true })
  eq(await rt.post(event('customer.subscription.updated', subscription({ status, items: items([item(ENV.STRIPE_MAX_YEARLY_PRICE_ID)]) }))), success, `${status} response`)
  eq(rt.users.get('cus_fixture').tier, 'free', `${status} retains the existing free-user behavior`)
  eq([rt.subscriptions.get('sub_fixture').tier, rt.subscriptions.get('sub_fixture').billingCycle], ['premium', 'yearly'], `${status} keeps the actual subscription plan recorded`)
}

for (const planItems of [
  [item('price_fixture_addon'), item(ENV.STRIPE_STARTER_YEARLY_PRICE_ID)],
  [item(ENV.STRIPE_STARTER_YEARLY_PRICE_ID), item('price_fixture_addon')],
  [item('price_fixture_addon_a'), item(ENV.STRIPE_STARTER_YEARLY_PRICE_ID, { id: 'prod_fixture_expanded' }), item('price_fixture_addon_b')],
]) {
  const rt = runtime(routeSource, enabled())
  eq(await rt.post(event('customer.subscription.created', subscription({ items: items(planItems) }))), success, 'Unknown add-ons may surround one recognized base plan')
  eq(rt.users.get('cus_fixture').stripePriceId, ENV.STRIPE_STARTER_YEARLY_PRICE_ID, 'The recognized base plan supplies the persisted price')
  eq(rt.subscriptions.get('sub_fixture').stripeProductId, planItems.find(i => i.price.id === ENV.STRIPE_STARTER_YEARLY_PRICE_ID).price.product.id ?? 'prod_fixture_base', 'The recognized base plan supplies the persisted product ID')
}

const invalidSelections = [
  ['empty items', items([])],
  ['unknown price', items([item('price_fixture_unknown')])],
  ['empty price', items([item('')])],
  ['two recognized prices', items([item(ENV.STRIPE_STARTER_MONTHLY_PRICE_ID), item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID)])],
  ['two copies of one recognized price', items([item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID), item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID)])],
  ['two billing cycles for one plan', items([item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID), item(ENV.STRIPE_PRO_YEARLY_PRICE_ID)])],
  ['paginated recognized plan', { data: [item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID)], has_more: true }],
  ['unknown pagination completeness', { data: [item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID)] }],
  ['missing items', null],
  ['missing item data', { has_more: false }],
  ['empty matched product', items([item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID, '')])],
  ['missing matched product', items([item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID, null)])],
]
for (const [label, selection] of invalidSelections) {
  for (const type of ['customer.subscription.created', 'customer.subscription.updated']) {
    const rt = runtime(routeSource, enabled(), { existing: true })
    eq(await rt.post(event(type, subscription({ items: selection, metadata: { userId: 'user_fixture', tier: 'pro', plan: 'pro' } }))), retry, `${label} returns retryable failure`)
    eq(writes(rt), [], `${label} causes no database or wallet writes`)
    eq(rt.users.get('cus_fixture').tier, 'free', `${label} cannot invent a paid user tier`)
  }
}

// An unknown price is never rescued by client metadata, recurring interval, amount or names.
{
  const rt = runtime(routeSource, enabled())
  const spoof = item('price_fixture_unknown', { id: 'prod_fixture', name: 'Pro', metadata: { tier: 'premium' } })
  Object.assign(spoof.price, { nickname: 'Max', unit_amount: 10000, recurring: { interval: 'year' }, metadata: { plan: 'premium' } })
  eq(await rt.post(event('customer.subscription.updated', subscription({ items: items([spoof]), metadata: { userId: 'user_fixture', tier: 'premium', plan: 'max' } }))), retry, 'Untrusted descriptors cannot select a plan')
  eq(writes(rt), [], 'Descriptor spoof causes no writes')
}

for (const key of Object.keys(ENV)) {
  for (const value of [undefined, '', ' ', ` ${ENV[key]}`, `${ENV[key]} `]) {
    const rt = runtime(routeSource, enabled({ [key]: value }))
    eq(await rt.post(event('customer.subscription.created', subscription())), retry, `Missing/blank/padded ${key} prevents processing`)
    eq(writes(rt), [], `Invalid ${key} prevents all writes`)
  }
}
for (let a = 0; a < PLANS.length; a++) for (let b = a + 1; b < PLANS.length; b++) {
  const rt = runtime(routeSource, enabled({ [PLANS[a][0]]: ENV[PLANS[b][0]] }))
  eq(await rt.post(event('customer.subscription.updated', subscription())), retry, 'Every duplicate configuration pairing fails, including unrelated plans')
  eq(writes(rt), [], 'Ambiguous configuration prevents all writes')
}

// Mapping runs before even a fallback owner lookup; valid customer lookup is unchanged.
{
  const invalid = runtime(routeSource, enabled())
  eq(await invalid.post(event('customer.subscription.updated', subscription({ items: items([]), metadata: {} }))), retry, 'Invalid plan fails without owner metadata')
  eq(invalid.calls, [], 'Invalid mapping fails before fallback database lookup')
  const rt = runtime(routeSource, enabled())
  eq(await rt.post(event('customer.subscription.updated', subscription({ metadata: {}, items: items([item(ENV.STRIPE_MAX_MONTHLY_PRICE_ID)]) }))), success, 'Known customer resolves missing user metadata')
  eq(rt.users.get('cus_fixture').tier, 'premium', 'Fallback owner gets the mapped plan')
}

// Execute the existing quota consumer with the resolver's actual Max result.
{
  const pricing = load(read('lib/marketing/homepage-v2-pricing.ts'), 'lib/marketing/homepage-v2-pricing.ts')
  const quota = load(read('lib/quota/quota.ts'), 'lib/quota/quota.ts', {
    '@/lib/prisma': { prisma: {} },
    '@/lib/marketing/homepage-v2-pricing': pricing,
    '@/lib/quota/est-time': {},
  })
  const max = helper.resolveStripeSubscriptionPlan(items([item(ENV.STRIPE_MAX_YEARLY_PRICE_ID)]), ENV)
  eq(max.tier, 'premium', 'Max maps to the existing internal premium key')
  eq(quota.TIER_LABELS[max.tier], 'Max', 'Existing quota consumer recognizes the mapped tier as Max')
  eq(quota.getQuotaCaps(max.tier), { monthlyCents: 10000, weeklyCents: 2500, dailyCents: 1250 }, 'Existing quota consumer gives mapped Max its real nonzero allowance')
}

// Pure helper is deterministic and does not mutate caller fixtures or read global config.
{
  const input = items([item(ENV.STRIPE_PRO_YEARLY_PRICE_ID)])
  const original = norm(input)
  eq(helper.resolveStripeSubscriptionPlan(input, ENV), { tier: 'pro', billingCycle: 'yearly', priceId: ENV.STRIPE_PRO_YEARLY_PRICE_ID, productId: 'prod_fixture_base' }, 'Pure resolver returns an explicit plan contract')
  eq(input, original, 'Resolver leaves subscription input untouched')
  fails(() => helper.resolveStripeSubscriptionPlan(input, {}), 'Resolver requires explicit complete configuration')
}

// Every non-subscription handler keeps its exact baseline effects, including duplicate wallet
// acknowledgements and the existing retry-on-duplicate-invoice behavior (not changed here).
const parityCases = [
  ['create', [event('customer.subscription.created', subscription())], {}],
  ['update existing', [event('customer.subscription.updated', subscription({ items: items([item(ENV.STRIPE_STARTER_YEARLY_PRICE_ID)]) }))], { existing: true }],
  ['legacy yearly', [event('customer.subscription.updated', subscription({ items: items([item(ENV.STRIPE_PRO_YEARLY_PRICE_ID)]) }))], {}],
  ['unknown legacy price', [event('customer.subscription.updated', subscription({ items: items([item('price_fixture_unknown')]) }))], {}],
  ['empty legacy items', [event('customer.subscription.updated', subscription({ items: items([]) }))], {}],
  ['legacy first item addon', [event('customer.subscription.updated', subscription({ items: items([item('price_fixture_addon'), item(ENV.STRIPE_PRO_YEARLY_PRICE_ID)]) }))], {}],
  ['legacy pagination', [event('customer.subscription.updated', subscription({ items: { ...items([item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID)]), has_more: true } }))], {}],
  ['fallback owner', [event('customer.subscription.updated', subscription({ metadata: {} }))], {}],
  ['missing owner', [event('customer.subscription.updated', subscription({ metadata: {} }))], { noUser: true }],
  ['subscription write failure', [event('customer.subscription.updated', subscription())], { failOperation: 'subscription.upsert' }],
  ['delete', [event('customer.subscription.deleted', subscription())], { existing: true }],
  ['delete absent subscription', [event('customer.subscription.deleted', subscription())], {}],
  ['checkout subscription', [event('checkout.session.completed', { id: 'cs_fixture_subscription', metadata: { userId: 'user_fixture' }, subscription: 'sub_fixture' })], {}],
  ['checkout missing metadata', [event('checkout.session.completed', { id: 'cs_fixture_no_owner' })], {}],
  ['wallet topup duplicate', [event('checkout.session.completed', topup()), event('checkout.session.completed', topup())], {}],
  ['wallet expanded payment intent', [event('checkout.session.completed', topup({ payment_intent: { id: 'pi_fixture_expanded' } }))], {}],
  ['wallet invalid amount', [event('checkout.session.completed', topup({ metadata: { userId: 'user_fixture', kind: 'wallet_topup', amountCents: '0' } }))], {}],
  ['wallet transient failure', [event('checkout.session.completed', topup())], { walletError: 'Fixture transient credit failure' }],
  ['invoice success duplicate', [event('invoice.payment_succeeded', invoice()), event('invoice.payment_succeeded', invoice())], {}],
  ['invoice failed', [event('invoice.payment_failed', invoice())], {}],
  ['invoice missing user', [event('invoice.payment_failed', invoice())], { noUser: true }],
  ['unhandled event', [event('fixture.unhandled', {})], {}],
  ...['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused'].map(status => [`legacy status ${status}`, [event('customer.subscription.updated', subscription({ status }))], {}]),
]

for (const flag of [undefined, 'false', '', '0', '1', 'TRUE', 'True', 'yes', ' true', 'true ']) {
  for (const [label, events, options] of parityCases) {
    const values = { ...ENV, ...(flag === undefined ? {} : { [FLAG]: flag }) }
    const baseline = runtime(baselineSource, values, options)
    const current = runtime(routeSource, values, options)
    for (const payload of events) eq(await current.post(payload), await baseline.post(payload), `OFF ${JSON.stringify(flag)} ${label}: exact HTTP response`)
    eq(current.snapshot(), baseline.snapshot(), `OFF ${JSON.stringify(flag)} ${label}: exact DB/wallet payloads and state`)
    eq(current.helperCalls, 0, `OFF ${JSON.stringify(flag)} ${label}: no mapping lookup`)
    eq(current.environmentReads.filter(key => key !== FLAG), baseline.environmentReads, `OFF ${JSON.stringify(flag)} ${label}: no additional price configuration reads`)
  }
}

// Missing new config is harmless while OFF, even if it would be invalid while enabled.
for (const flag of [undefined, 'false']) {
  const values = flag === undefined ? {} : { [FLAG]: flag }
  const baseline = runtime(baselineSource, values)
  const current = runtime(routeSource, values)
  const payload = event('customer.subscription.created', subscription())
  eq(await current.post(payload), await baseline.post(payload), 'OFF requires none of the six new mapping configuration values')
  eq(current.snapshot(), baseline.snapshot(), 'OFF with absent configuration preserves exact legacy payloads')
}

for (const [label, events, options] of parityCases.filter(([, events]) => !events[0].type.startsWith('customer.subscription.') || events[0].type.endsWith('deleted'))) {
  const baseline = runtime(baselineSource, enabled(), options)
  // Deliberately incomplete mapping: unrelated handlers must never consult it.
  const current = runtime(routeSource, { [FLAG]: 'true' }, options)
  for (const payload of events) eq(await current.post(payload), await baseline.post(payload), `ON ${label}: exact unaffected-handler response`)
  eq(current.snapshot(), baseline.snapshot(), `ON ${label}: exact unaffected-handler payloads`)
  eq(current.helperCalls, 0, `ON ${label}: unrelated handlers do not map plans`)
}

{
  const rt = runtime(routeSource, { [FLAG]: 'true' }, { existing: true })
  eq(await rt.post(event('checkout.session.completed', topup())), success, 'First wallet top-up is acknowledged')
  eq(await rt.post(event('checkout.session.completed', topup())), success, 'Duplicate wallet top-up is acknowledged')
  eq(rt.users.get('cus_fixture').walletBalanceCents, 2500, 'Duplicate top-up credits the wallet only once')
  const wallet = rt.calls.find(call => call.operation === 'wallet.credit').args
  eq(wallet, {
    userId: 'user_fixture', amountCents: 2500, reason: 'card_topup', sourceRef: 'stripe_topup:cs_fixture_topup',
    metadata: { stripeSessionId: 'cs_fixture_topup', stripePaymentIntent: 'pi_fixture_topup', packId: 'fixture_pack' },
  }, 'Wallet idempotency key and credit metadata remain intact')
  eq(await rt.post(event('invoice.payment_succeeded', invoice())), success, 'Successful invoice is recorded')
  eq(rt.payments.get('in_fixture'), {
    userId: 'user_fixture', stripeInvoiceId: 'in_fixture', stripePaymentIntentId: 'pi_fixture_invoice',
    stripeSubscriptionId: 'sub_fixture', amount: 5000, currency: 'usd', status: 'paid',
    invoiceUrl: 'https://fixture.invalid/invoice', invoicePdf: 'https://fixture.invalid/invoice.pdf',
  }, 'Successful invoice preserves existing payment fields')
  eq(await rt.post(event('invoice.payment_failed', invoice({ id: 'in_fixture_failed' }))), success, 'Failed invoice is recorded')
  eq([rt.payments.get('in_fixture_failed').status, rt.payments.get('in_fixture_failed').amount], ['failed', 5500], 'Failed invoice preserves amount-due semantics')
  eq(await rt.post(event('customer.subscription.deleted', subscription())), success, 'Deletion bypasses plan mapping, even with missing configuration')
  const user = rt.users.get('cus_fixture')
  eq([user.tier, user.stripeSubscriptionId, user.stripePriceId, user.stripeCurrentPeriodEnd], ['free', null, null, null], 'Deletion preserves free downgrade and clears subscription fields')
  eq(rt.helperCalls, 0, 'Wallet, invoice and deletion never consult the real-tier mapping')
}

for (const values of [{}, { [FLAG]: 'false' }, enabled()]) {
  for (const signature of [null, 'bad-signature']) {
    const rt = runtime(routeSource, values)
    eq(await rt.post(event('customer.subscription.created', subscription()), signature), {
      status: 400, data: { error: signature === null ? 'No signature' : 'Invalid signature' },
    }, 'Missing/invalid signature is rejected before event processing')
    eq(rt.signatureCalls, signature === null ? 0 : 1, 'Missing signatures never reach Stripe verification; invalid signatures reach it once')
    eq(rt.helperCalls, 0, 'Rejected signatures never reach plan mapping')
    eq(rt.calls, [], 'Rejected signatures cause no database or wallet access')
  }
}

// Compile the helper against the real pinned SDK declarations, not a guessed Stripe shape.
// This is a focused type witness; it does not compile the application or construct a client.
{
  const stripeMain = dependencyRequire.resolve('stripe')
  const stripeRoot = path.dirname(path.dirname(stripeMain))
  const stripePackage = JSON.parse(fs.readFileSync(path.join(stripeRoot, 'package.json'), 'utf8'))
  eq(stripePackage.version, '17.4.0', 'Type witness uses the target pinned Stripe SDK')
  const witnessPath = path.join(ROOT, 'scripts/__stripe_plan_type_witness__.ts')
  const witness = `
    import type Stripe from 'stripe'
    import { resolveStripeSubscriptionPlan, type StripePlanPriceEnvironment, type ResolvedSubscriptionPlan } from '../lib/stripe/subscription-plan'
    declare const subscription: Stripe.Subscription
    declare const environment: StripePlanPriceEnvironment
    const resolved: ResolvedSubscriptionPlan = resolveStripeSubscriptionPlan(subscription.items, environment)
    const tier: 'starter' | 'pro' | 'premium' = resolved.tier
    const cycle: 'monthly' | 'yearly' = resolved.billingCycle
  `
  const compilerOptions = {
    noEmit: true, strict: true, skipLibCheck: true, types: [],
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10, esModuleInterop: true,
    baseUrl: ROOT, paths: { stripe: [path.join(stripeRoot, 'types/index.d.ts')] },
  }
  const host = ts.createCompilerHost(compilerOptions)
  const originalRead = host.readFile.bind(host)
  const originalExists = host.fileExists.bind(host)
  host.readFile = file => path.resolve(file) === witnessPath ? witness : originalRead(file)
  host.fileExists = file => path.resolve(file) === witnessPath || originalExists(file)
  const program = ts.createProgram([witnessPath], compilerOptions, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  eq(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [], 'Helper type-checks against Stripe 17.4.0 Subscription.items')
}

eq(networkAttempts, 0, 'No network access was attempted')
ok(postExecutions > 700, 'Actual POST was exercised across enabled, disabled and baseline fixtures')
console.log(`Stripe real-tier offline proof passed: ${checks} assertions; ${postExecutions} actual POST executions; exact BASE/OFF parity; real SDK 17.4.0 type witness; network attempts=${networkAttempts}; Node ${process.version}, TypeScript ${ts.version}.`)
