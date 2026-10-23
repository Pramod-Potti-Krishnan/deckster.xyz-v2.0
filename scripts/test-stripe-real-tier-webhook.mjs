/**
 * Offline execution of the actual webhook POST and pure plan resolver. No credentials,
 * Stripe client, database client or network module is loaded. Only the TypeScript compiler
 * and the pinned Stripe 17.4.0 declarations are read from an existing dependency directory.
 * Set DECKSTER_TEST_DEPENDENCY_PACKAGE to that checkout's package.json if this worktree has
 * no node_modules. The exact git baseline (the studio-v4-dev-preparation-code tip this change is stacked on, BASE below) is executed separately for OFF parity.
 *
 * With the flag on, a subscription whose plan cannot be resolved takes exactly the flag-off path
 * (tier 'pro' on create; no tier or billingCycle on update) and logs one warning; the baseline run
 * is the reference for that too. `--mutation-check` re-runs this proof against deliberately broken
 * copies of the route and resolver (in memory; the files are untouched) and requires each to fail.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { sameAsBase } from './studio-env-append-tolerant.mjs'
import { stackMutants, stackScope } from './studio-stack-tolerant.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dependencyRequire = createRequire(process.env.DECKSTER_TEST_DEPENDENCY_PACKAGE || path.join(ROOT, 'package.json'))
const ts = dependencyRequire('typescript')
// The studio-v4-dev-preparation-code tip this change is stacked on (2dade1f: #480, #476 and #477 on top of #475). Its route is byte for byte the route of #475's head c1a7378, which this test was first written against.
const BASE = '2dade1ff6b98525a1f11be00ae8b33b0ee51a9b2'
const ROUTE = 'app/api/webhooks/stripe/route.ts'
const HELPER = 'lib/stripe/subscription-plan.ts'
const FLAG = 'STRIPE_REAL_TIER_MAPPING_ENABLED'
// Built at run time (a fresh random value each run) so no key-shaped literal sits in the source.
const SECRET = ['whsec', crypto.randomBytes(16).toString('hex')].join('_')
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

// Mutation check: each mutant breaks one behaviour in an in-memory copy of the route or resolver.
// `from` must occur exactly once (otherwise the mutant is a no-op and the run exits 3, not "caught").
const MUTANTS = {
  'flag on unless exactly false': [ROUTE, `process.env.${FLAG} === 'true'`, `process.env.${FLAG} !== 'false'`],
  'flag accepts any case': [ROUTE, `process.env.${FLAG} === 'true'`, `String(process.env.${FLAG}).toLowerCase() === 'true'`],
  'Max stored as max': [HELPER, `['STRIPE_MAX_MONTHLY_PRICE_ID', 'premium', 'monthly']`, `['STRIPE_MAX_MONTHLY_PRICE_ID', 'max', 'monthly']`],
  'Starter yearly stored as monthly': [HELPER, `['STRIPE_STARTER_YEARLY_PRICE_ID', 'starter', 'yearly']`, `['STRIPE_STARTER_YEARLY_PRICE_ID', 'starter', 'monthly']`],
  'Pro yearly stored as Starter': [HELPER, `['STRIPE_PRO_YEARLY_PRICE_ID', 'pro', 'yearly']`, `['STRIPE_PRO_YEARLY_PRICE_ID', 'starter', 'yearly']`],
  'update arm never writes the tier': [ROUTE, `...(mappedPlan ? { tier, billingCycle } : {}),`, ``],
  'update arm always writes the tier': [ROUTE, `...(mappedPlan ? { tier, billingCycle } : {}),`, `tier, billingCycle,`],
  'fallback tier is not pro': [ROUTE, `let tier = 'pro'`, `let tier = 'starter'`],
  'fallback throws instead of continuing': [ROUTE, 'console.warn(`[stripe-real-tier]', 'throw new Error(`[stripe-real-tier]'],
  'fallback is silent': [ROUTE, 'console.warn(`[stripe-real-tier]', 'void (`[stripe-real-tier]'],
  'fallback warns twice': [ROUTE, `if (resolution && !resolution.ok) {`, `if (resolution && !resolution.ok) { console.warn('[stripe-real-tier] again');`],
  'warning names the user': [ROUTE, `price ids: \${resolution.priceIds.join(', ') || 'none'}`, `price ids: \${resolution.priceIds.join(', ') || 'none'} user \${subscription.metadata.userId}`],
  'warning names the customer': [ROUTE, `price ids: \${resolution.priceIds.join(', ') || 'none'}`, `price ids: \${resolution.priceIds.join(', ') || 'none'} \${subscription.customer}`],
  'warning omits the price ids': [ROUTE, `price ids: \${resolution.priceIds.join(', ') || 'none'}`, `price ids: none`],
  'duplicate price ids not detected': [HELPER, `if (prices.has(priceId)) {`, `if (false) {`],
  'blank price id not detected': [HELPER, `if (!priceId || priceId.trim() !== priceId) {`, `if (!priceId) {`],
  'pagination not detected': [HELPER, `items.has_more !== false || `, ``],
  'second base-plan item allowed': [HELPER, `if (recognizedItems.length !== 1) {`, `if (recognizedItems.length < 1) {`],
  'missing product id allowed': [HELPER, `if (!productId || productId.trim() !== productId) {`, `if (false) {`],
  'non-mapping faults swallowed': [HELPER, `if (!(error instanceof StripePlanMappingError)) throw error`, ``],
}
const MUTANT = process.env.STRIPE_TIER_TEST_MUTANT
const source = relative => {
  const text = read(relative)
  if (!MUTANT) return text
  const [file, from, to] = MUTANTS[MUTANT] ?? (console.error(`Unknown mutant ${MUTANT}`), process.exit(3))
  if (file !== relative) return text
  if (text.split(from).length !== 2) { console.error(`Mutant "${MUTANT}" is a no-op: its target text is not in ${relative} exactly once`); process.exit(3) }
  return text.replace(from, () => to)
}

if (process.argv.includes('--mutation-check')) {
  // One child at a time: the clean run must pass, every mutant must fail (exit 1, not a no-op exit 3).
  const run = mutant => spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...(mutant ? { STRIPE_TIER_TEST_MUTANT: mutant } : {}) },
  })
  const clean = run()
  assert.equal(clean.status, 0, `The unmutated proof must pass first:\n${clean.stderr || clean.stdout}`)
  let escaped = 0
  for (const mutant of Object.keys(MUTANTS)) {
    const result = run(mutant)
    const caught = result.status === 1
    const reason = (result.stderr.match(/AssertionError[^\n]*\n?[^\n]*|Error[^\n]*/) || [''])[0].replace(/\s+/g, ' ').slice(0, 150)
    console.log(`${caught ? 'caught ' : 'ESCAPED'}  ${mutant}${caught ? `  <- ${reason}` : ` (exit ${result.status})`}`)
    if (!caught) escaped++
  }
  console.log(`Mutation check: ${Object.keys(MUTANTS).length - escaped}/${Object.keys(MUTANTS).length} mutants caught; the unmutated proof passes.`)
  process.exit(escaped ? 1 : 0)
}
const baselineSource = execFileSync('git', ['show', `${BASE}:${ROUTE}`], { cwd: ROOT, encoding: 'utf8' })
const routeSource = source(ROUTE)

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

const helper = load(source(HELPER), HELPER)
const item = (priceId, product = 'prod_fixture_base') => ({ price: { id: priceId, product } })
const items = data => ({ data, has_more: false })
const PII_EMAIL = 'fixture.person@example.invalid'
const subscription = (patch = {}) => ({
  id: 'sub_fixture', customer: 'cus_fixture', metadata: { userId: 'user_fixture', email: PII_EMAIL },
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
  const warnings = []
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
    '@/lib/stripe/subscription-plan': { tryResolveStripeSubscriptionPlan: (...args) => {
      helperCalls++
      return helper.tryResolveStripeSubscriptionPlan(...args)
    } },
  }, { process: { env }, console: { log() {}, error() {}, warn: (...args) => { warnings.push(args.map(String).join(' ')) } } })
  let currentSignature
  let currentBody
  return {
    calls, environmentReads, users, subscriptions, payments, warnings,
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

// Flag ON, but the plan cannot be resolved: the webhook answers exactly as the flag-off route does
// (same response, same database/wallet payloads and final state) and logs ONE warning that names the
// reason and the subscription's price ids only. Create writes tier 'pro'; the update arm writes no
// tier and no billingCycle. The baseline run (BASE's route) is the reference.
const priceIdsOf = items => Array.isArray(items?.data) ? items.data.map(i => i?.price?.id).filter(id => typeof id === 'string' && id !== '') : []
const baselineReference = (values, options, payload) => {
  const rt = runtime(baselineSource, values, options)
  return rt.post(payload).then(response => ({ rt, response }))
}
async function expectFallback(label, values, payload, options, reason) {
  const baseline = await baselineReference(values, options, payload)
  const current = runtime(routeSource, values, options)
  const response = await current.post(payload)
  eq(response, baseline.response, `${label}: the flag-off response, exactly`)
  eq(current.snapshot(), baseline.rt.snapshot(), `${label}: the flag-off database/wallet payloads and state, exactly`)
  eq(current.warnings.length, 1, `${label}: exactly one warning line`)
  const priceIds = priceIdsOf(payload.data.object.items)
  eq(current.warnings[0], `[stripe-real-tier] plan not resolved (${reason}), keeping the legacy tier; price ids: ${priceIds.join(', ') || 'none'}`, `${label}: the warning names the reason and the price ids and nothing else`)
  for (const secret of ['user_fixture', 'cus_fixture', 'sub_fixture', PII_EMAIL, SECRET, SIGNATURE]) ok(!current.warnings[0].includes(secret), `${label}: the warning does not carry ${secret === SECRET ? 'the webhook secret' : secret}`)
  const upsert = current.calls.find(call => call.operation === 'subscription.upsert')
  if (upsert) {
    eq(response, success, `${label}: 200, as the legacy path`)
    eq(upsert.args.create.tier, 'pro', `${label}: create stores the legacy tier pro`)
    ok(!('tier' in upsert.args.update) && !('billingCycle' in upsert.args.update), `${label}: the update arm writes no tier and no billingCycle`)
  } else {
    eq(writes(current), [], `${label}: no database or wallet write (the legacy route cannot read this payload either)`)
  }
  return current
}

const SELECTION_FALLBACKS = [
  ['empty items', items([]), 'no-item'],
  ['unknown price', items([item('price_fixture_unknown')]), 'unknown-price'],
  ['unknown price with an add-on', items([item('price_fixture_unknown'), item('price_fixture_addon')]), 'unknown-price'],
  ['empty price', items([item('')]), 'unknown-price'],
  ['two recognized prices', items([item(ENV.STRIPE_STARTER_MONTHLY_PRICE_ID), item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID)]), 'multiple-base-plan-items'],
  ['two copies of one recognized price', items([item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID), item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID)]), 'multiple-base-plan-items'],
  ['two billing cycles for one plan', items([item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID), item(ENV.STRIPE_PRO_YEARLY_PRICE_ID)]), 'multiple-base-plan-items'],
  ['a Pro yearly first item with a second base plan', items([item(ENV.STRIPE_PRO_YEARLY_PRICE_ID), item(ENV.STRIPE_STARTER_MONTHLY_PRICE_ID)]), 'multiple-base-plan-items'],
  ['paginated recognized plan', { data: [item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID)], has_more: true }, 'items-incomplete'],
  ['unknown pagination completeness', { data: [item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID)] }, 'items-incomplete'],
  ['empty matched product', items([item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID, '')]), 'product-id-missing'],
  ['missing matched product', items([item(ENV.STRIPE_PRO_MONTHLY_PRICE_ID, null)]), 'product-id-missing'],
]
// The legacy route itself cannot read these (it throws on subscription.items.data), so both answer 500 and neither writes.
const MALFORMED_FALLBACKS = [
  ['missing items', null, 'items-incomplete'],
  ['missing item data', { has_more: false }, 'items-incomplete'],
]
const SUBSCRIPTION_TYPES = ['customer.subscription.created', 'customer.subscription.updated']
for (const [label, selection, reason] of [...SELECTION_FALLBACKS, ...MALFORMED_FALLBACKS]) {
  for (const type of SUBSCRIPTION_TYPES) {
    for (const options of [{}, { existing: true }]) {
      // Client metadata (a different tier or plan) never rescues an unresolvable selection.
      const payload = event(type, subscription({ items: selection, metadata: { userId: 'user_fixture', email: PII_EMAIL, tier: 'premium', plan: 'max' } }))
      await expectFallback(`${label} (${type}${options.existing ? ', existing row' : ''})`, enabled(), payload, options, reason)
    }
  }
}
// The legacy user tier follows the subscription status, exactly as the flag-off route does.
for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'paused']) {
  const rt = await expectFallback(`unknown price, status ${status}`, enabled(), event('customer.subscription.updated', subscription({ status, items: items([item('price_fixture_unknown')]) })), { existing: true }, 'unknown-price')
  eq(rt.users.get('cus_fixture').tier, status === 'active' || status === 'trialing' ? 'pro' : 'free', `unknown price, status ${status}: the user keeps today's tier rule`)
  eq([rt.subscriptions.get('sub_fixture').tier, rt.subscriptions.get('sub_fixture').billingCycle], ['premium', 'yearly'], `unknown price, status ${status}: an existing row keeps its tier and cycle`)
}

// An unknown price is never rescued by client metadata, recurring interval, amount or names.
{
  const spoof = item('price_fixture_unknown', { id: 'prod_fixture', name: 'Pro', metadata: { tier: 'premium' } })
  Object.assign(spoof.price, { nickname: 'Max', unit_amount: 10000, recurring: { interval: 'year' }, metadata: { plan: 'premium' } })
  const rt = await expectFallback('Descriptor spoof', enabled(), event('customer.subscription.updated', subscription({ items: items([spoof]), metadata: { userId: 'user_fixture', email: PII_EMAIL, tier: 'premium', plan: 'max' } })), {}, 'unknown-price')
  eq(rt.users.get('cus_fixture').tier, 'pro', 'Untrusted descriptors cannot select a paid plan; today\'s tier is stored')
}

// A missing, blank or padded price-id setting, or one id under two plans, is a configuration problem:
// the same legacy fallback, never a 500 (every one of the six settings, both events).
for (const key of Object.keys(ENV)) {
  for (const value of [undefined, '', ' ', ` ${ENV[key]}`, `${ENV[key]} `]) {
    for (const type of SUBSCRIPTION_TYPES) {
      await expectFallback(`Missing/blank/padded ${key} (${type})`, enabled({ [key]: value }), event(type, subscription()), { existing: type.endsWith('updated') }, 'price-config-missing')
    }
  }
}
for (let a = 0; a < PLANS.length; a++) for (let b = a + 1; b < PLANS.length; b++) {
  for (const type of SUBSCRIPTION_TYPES) {
    await expectFallback(`${PLANS[a][0]} duplicated by ${PLANS[b][0]} (${type})`, enabled({ [PLANS[a][0]]: ENV[PLANS[b][0]] }), event(type, subscription()), { existing: type.endsWith('updated') }, 'price-config-ambiguous')
  }
}
// The mapping is decided before any database access (and before even the fallback owner lookup);
// an unresolvable plan then goes through the legacy owner lookup exactly.
{
  const noOwner = event('customer.subscription.updated', subscription({ items: items([]), metadata: {} }))
  const lookup = await expectFallback('Unresolvable plan, owner found by customer', enabled(), noOwner, {}, 'no-item')
  eq(lookup.calls.map(call => call.operation), ['user.findUnique', 'subscription.upsert', 'user.update'], 'The legacy owner lookup runs, then the legacy writes')
  const missing = await expectFallback('Unresolvable plan, no owner at all', enabled(), noOwner, { noUser: true }, 'no-item')
  eq(missing.calls.map(call => call.operation), ['user.findUnique'], 'No owner: the legacy route stops after the lookup, with a 200')
  const rt = runtime(routeSource, enabled())
  eq(await rt.post(event('customer.subscription.updated', subscription({ metadata: {}, items: items([item(ENV.STRIPE_MAX_MONTHLY_PRICE_ID)]) }))), success, 'Known customer resolves missing user metadata')
  eq(rt.users.get('cus_fixture').tier, 'premium', 'Fallback owner gets the mapped plan')
  eq(rt.warnings, [], 'A resolved plan logs no warning')
}

// A fault that is not a mapping failure is not turned into the legacy fallback: the route still answers 500.
{
  const rt = runtime(routeSource, enabled(), { failOperation: 'subscription.upsert' })
  eq(await rt.post(event('customer.subscription.created', subscription())), retry, 'A database failure on a mapped subscription is still retried')
  eq(rt.warnings, [], 'A database failure is not a mapping fallback and logs no mapping warning')
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

// The resolver still throws (typed, with the reason); the webhook's entry point turns that into a result.
{
  const unknown = items([item('price_fixture_unknown'), item('price_fixture_addon')])
  let thrown
  try { helper.resolveStripeSubscriptionPlan(unknown, ENV) } catch (error) { thrown = error }
  eq([thrown?.name, thrown?.reason], ['StripePlanMappingError', 'unknown-price'], 'The resolver throws a typed mapping error with its reason')
  eq(helper.tryResolveStripeSubscriptionPlan(unknown, ENV), { ok: false, plan: null, reason: 'unknown-price', priceIds: ['price_fixture_unknown', 'price_fixture_addon'] }, 'The entry point returns the reason and the price ids, not an exception')
  eq(helper.tryResolveStripeSubscriptionPlan(items([item(ENV.STRIPE_PRO_YEARLY_PRICE_ID)]), ENV), { ok: true, plan: { tier: 'pro', billingCycle: 'yearly', priceId: ENV.STRIPE_PRO_YEARLY_PRICE_ID, productId: 'prod_fixture_base' } }, 'The entry point returns the resolved plan')
  eq(helper.tryResolveStripeSubscriptionPlan(unknown, {}).reason, 'price-config-missing', 'Missing configuration is reported as such')
  eq(helper.tryResolveStripeSubscriptionPlan(null, ENV), { ok: false, plan: null, reason: 'items-incomplete', priceIds: [] }, 'Missing items are reported without reading them')
  // The fault happens on the first read only, so swallowing it (and reading again to build a result) would not throw a second time.
  let reads = 0
  fails(() => helper.tryResolveStripeSubscriptionPlan({ has_more: false, get data() { if (reads++ === 0) throw new TypeError('fixture fault'); return [] } }, ENV), 'A fault that is not a mapping failure still throws')
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

// Every spelling other than the exact string "true" is OFF. The outputs (every response, every database/wallet
// payload, the final state and the log warnings) are hashed per side; the two digests must be identical.
const OFF_SPELLINGS = [undefined, 'false', '', '0', '1', 'TRUE', 'True', 'tRuE', 'yes', 'on', 'enabled', 'tru', 'truee', '2', 'null', 'undefined', '"true"', "'true'", ' true', 'true ', 'true\n', '\ttrue', 'TRUE ']
const outputHash = { baseline: crypto.createHash('sha256'), current: crypto.createHash('sha256') }
for (const flag of OFF_SPELLINGS) {
  for (const [label, events, options] of parityCases) {
    const values = { ...ENV, ...(flag === undefined ? {} : { [FLAG]: flag }) }
    const baseline = runtime(baselineSource, values, options)
    const current = runtime(routeSource, values, options)
    const responses = { baseline: [], current: [] }
    for (const payload of events) {
      const currentResponse = await current.post(payload)
      const baselineResponse = await baseline.post(payload)
      responses.current.push(currentResponse)
      responses.baseline.push(baselineResponse)
      eq(currentResponse, baselineResponse, `OFF ${JSON.stringify(flag)} ${label}: exact HTTP response`)
    }
    eq(current.snapshot(), baseline.snapshot(), `OFF ${JSON.stringify(flag)} ${label}: exact DB/wallet payloads and state`)
    eq(current.warnings, [], `OFF ${JSON.stringify(flag)} ${label}: no warning is logged`)
    outputHash.current.update(JSON.stringify([flag, label, responses.current, current.snapshot(), current.warnings]))
    outputHash.baseline.update(JSON.stringify([flag, label, responses.baseline, baseline.snapshot(), baseline.warnings]))
    eq(current.helperCalls, 0, `OFF ${JSON.stringify(flag)} ${label}: no mapping lookup`)
    eq(current.environmentReads.filter(key => key !== FLAG), baseline.environmentReads, `OFF ${JSON.stringify(flag)} ${label}: no additional price configuration reads`)
  }
}

const offDigest = { baseline: outputHash.baseline.digest('hex'), current: outputHash.current.digest('hex') }
eq(offDigest.current, offDigest.baseline, 'OFF: the sha256 of every output (responses, payloads, final state, warnings) is identical to the base route')

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
    import { resolveStripeSubscriptionPlan, tryResolveStripeSubscriptionPlan, type StripePlanPriceEnvironment, type ResolvedSubscriptionPlan, type StripePlanMappingFailure } from '../lib/stripe/subscription-plan'
    declare const subscription: Stripe.Subscription
    declare const environment: StripePlanPriceEnvironment
    declare const flagOn: boolean
    const resolved: ResolvedSubscriptionPlan = resolveStripeSubscriptionPlan(subscription.items, environment)
    const tier: 'starter' | 'pro' | 'premium' = resolved.tier
    const cycle: 'monthly' | 'yearly' = resolved.billingCycle
    // The webhook's own use of the entry point (route.ts): the same narrowing, so a type slip shows here.
    const resolution = flagOn ? tryResolveStripeSubscriptionPlan(subscription.items, environment) : null
    const mappedPlan: ResolvedSubscriptionPlan | null = resolution?.ok ? resolution.plan : null
    if (resolution && !resolution.ok) {
      const reason: StripePlanMappingFailure = resolution.reason
      const line: string = reason + resolution.priceIds.join(', ')
    }
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

// Scope, stack-tolerant (scripts/studio-stack-tolerant.mjs, the rules of FRONTEND-2's Pass 3 pins): this change answers for its own frozen files and the files of its own path family; a file of any LATER PR
// (FRONTEND-1's deck import, and so on) is ignored and counted on one printed line, never a failure. Nothing here compares the whole tree with the base. Every frozen file must still be changed against the base
// (the committed tree, not the working tree), and a file of this path family that is not frozen is a stray. The shared files it edits are held to their rules below (.env.example) and by the library-manage pins
// (scripts/studio-library-manage-harness.mjs: two STACKED_PASS3_FILES lines, which those pins need for this change's two library-free files).
const OWN_CHANGE = {
  pr: 479, stray: 'lib/stripe/subscription-plan-later.ts',
  family: /^(lib\/stripe\/subscription-plan[^/]*|docs\/stripe-real-tier[^/]*|scripts\/(test-|studio-)?stripe-real-tier[^/]*)$/,
  files: ['.env.example', ROUTE, 'docs/stripe-real-tier-mapping.md', HELPER, 'scripts/studio-library-manage-harness.mjs', 'scripts/studio-stripe-real-tier-strip.mjs', 'scripts/test-stripe-real-tier-webhook.mjs'],
}
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
{
  const changed = git(['diff', '--name-only', BASE, 'HEAD']).split('\n').filter(Boolean)
  const scope = stackScope(changed, OWN_CHANGE)
  console.log(scope.line)
  eq(scope.missing, [], 'Every frozen file of this change is changed against the base')
  eq(scope.stray, [], 'No file of this change\'s path family is outside its frozen list')
  ok(changed.includes(ROUTE) && changed.includes(HELPER), 'The route and the resolver are changed')
  ok(!/stripe[-_]real[-_]tier/i.test(read('package.json')), 'package.json registers nothing of this change (the suite finds this test by its name); what a later PR adds to it is not this test\'s to judge')
  eq(scope.checked.slice().sort(), OWN_CHANGE.files.slice().sort(), 'The files this change answers for are exactly its frozen files')
  for (const [label, verdict] of stackMutants({ change: OWN_CHANGE, changed, shared: [], kept: [] })) ok(verdict, `scope rules: ${label}`)
}

// .env.example: this change's only edit is one block, after #475's narration block and before # PASS2 ADMIN (a pure insertion; the existing STRIPE_* lines stay as they are). With the block taken out
// (scripts/studio-stripe-real-tier-strip.mjs) the file is the base's under sameAsBase (scripts/studio-env-append-tolerant.mjs, #480): every base line still there, in order, and whatever a later PR appended
// to the file (a comment or an env line of another flag) tolerated; a byte-for-byte compare would refuse every later PR's block.
{
  const { stripStripeRealTier, STRIPE_REAL_TIER_FILES } = await import('./studio-stripe-real-tier-strip.mjs')
  eq(STRIPE_REAL_TIER_FILES, ['.env.example'], 'The strip module names the one shared file')
  const OWN_FLAGS = /STRIPE_REAL_TIER|real-tier webhook mapping|STRIPE_(?:STARTER|MAX)_(?:MONTHLY|YEARLY)_PRICE_ID/
  const env = read('.env.example')
  const baseEnv = git(['show', `${BASE}:.env.example`])
  const own = stripStripeRealTier('.env.example', env)
  ok(env !== baseEnv, 'The Stripe real tier block is in .env.example')
  ok(sameAsBase('.env.example', own, baseEnv, OWN_FLAGS), 'Without its block .env.example is the base\'s file: every base line in order, only a later PR\'s comments and env lines of other flags added')
  ok(!OWN_FLAGS.test(own), 'Without its block no line of this change is left in .env.example')
  ok(stripStripeRealTier('.env.example', own) === own, 'Stripping twice changes nothing more')
  ok(stripStripeRealTier('.env.example', baseEnv) === baseEnv, 'A file without the block comes back as it is')
  for (const other of ['package.json', ROUTE, 'README.md']) eq(stripStripeRealTier(other, 'some text'), 'some text', `${other} comes back as it is`)
  // the rule is not a rubber stamp: a later PR's block after the last one is taken, a base line edited or dropped, or a second value for a base variable, is not
  const later = '\n# A LATER CHANGE (a made-up flag, for this check)\nNEXT_PUBLIC_SOME_LATER_FLAG="false"\n'
  ok(sameAsBase('.env.example', own + later, baseEnv, OWN_FLAGS), 'A later PR\'s block appended to .env.example is taken')
  ok(!sameAsBase('.env.example', env, baseEnv, OWN_FLAGS), 'This change\'s block left in the file is refused')
  ok(!sameAsBase('.env.example', own.replace('# PASS2 ADMIN', '# PASS2 ADMIN (edited)'), baseEnv, OWN_FLAGS), 'A base line edited is refused')
  ok(!sameAsBase('.env.example', own.replace('MODEL_ROUTER_URL=\n', ''), baseEnv, OWN_FLAGS), 'A base line dropped is refused')
  const at = env.indexOf('STRIPE_REAL_TIER_MAPPING_ENABLED="false"\n')
  ok(env.split('STRIPE_REAL_TIER_MAPPING_ENABLED=').length === 2, 'The flag is documented once, default "false"')
  ok(at > env.indexOf('MODEL_ROUTER_STUDIO_KEY=\n') && env.indexOf('MODEL_ROUTER_STUDIO_KEY=\n') > 0 && at < env.indexOf('# PASS2 ADMIN'), 'The block sits after the narration block, before # PASS2 ADMIN')
  ok(env.includes('STRIPE_PRO_YEARLY_PRICE_ID="price_your_yearly_price_id"\n\n# Note: NEXT_PUBLIC_APP_URL'), 'The existing STRIPE_* lines are exactly where and as they were')
  // # PASS2 ADMIN then # PASS2 Docs still follow the block, in that order; after the Docs flag only a later PR's comments, blanks and env lines (the template rename's comment block, #477) may stand
  const docs = env.indexOf('NEXT_PUBLIC_STUDIO_P2_DOCS="false"\n')
  ok(at < env.indexOf('# PASS2 ADMIN') && env.indexOf('# PASS2 ADMIN') < env.indexOf('# PASS2 Docs') && env.indexOf('# PASS2 Docs') < docs, '# PASS2 ADMIN then # PASS2 Docs still follow the block, in that order')
  ok(env.slice(docs).split('\n').slice(1).every(line => /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/.test(line) && !OWN_FLAGS.test(line)), 'After the Docs flag only later PRs\' comments and env lines stand, none of this change\'s')
  for (const name of Object.keys(ENV).filter(key => !key.startsWith('STRIPE_PRO_'))) ok(env.split(`\n${name}="price_your_`).length === 2, `${name} is a placeholder, once`)
  for (const name of Object.keys(ENV)) ok(!new RegExp(`^NEXT_PUBLIC_${name}`, 'm').test(env), `${name} has no NEXT_PUBLIC_ alias`)
}

// No key-shaped literal in what this change adds (the workspace secret scan reads added lines): the test builds its signing secret at run time.
for (const rel of ['scripts/test-stripe-real-tier-webhook.mjs', 'scripts/studio-stripe-real-tier-strip.mjs', 'lib/stripe/subscription-plan.ts', ROUTE, 'docs/stripe-real-tier-mapping.md']) {
  ok(!/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{4,}|whsec_[A-Za-z0-9]{8,}|(secret|token)['"]?\s*[=:]\s*['"][A-Za-z0-9_./+-]{20,}/i.test(read(rel)), `${rel}: no key-shaped literal`)
}

eq(networkAttempts, 0, 'No network access was attempted')
ok(postExecutions > 1500, 'Actual POST was exercised across enabled, disabled and baseline fixtures')
console.log(`Stripe real-tier offline proof passed: ${checks} assertions; ${postExecutions} actual POST executions; exact BASE/OFF parity (output sha256 ${offDigest.current.slice(0, 16)} on both sides, ${OFF_SPELLINGS.length} flag spellings); real SDK 17.4.0 type witness; network attempts=${networkAttempts}; Node ${process.version}, TypeScript ${ts.version}.`)
