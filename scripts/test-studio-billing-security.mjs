// SECURITY-AUDIT-BILLING B4/B5/B7/B8/B9 regression checks.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const compiled = ts.transpileModule(read('lib/billing/security.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, require })
const sec = mod.exports

// B9: P2002 by code, not message
assert.equal(sec.isUniqueViolation({ code: 'P2002' }), true)
assert.equal(sec.isUniqueViolation(new Error('Unique constraint failed')), false)
assert.equal(sec.isUniqueViolation(null), false)
assert.equal(sec.isMissingTable({ code: 'P2021' }), true)

// B9: billingCycle derived server-side
const prices = { monthly: 'price_m', yearly: 'price_y' }
assert.equal(sec.billingCycleForPrice('price_m', prices), 'monthly')
assert.equal(sec.billingCycleForPrice('price_y', prices), 'yearly')
assert.equal(sec.billingCycleForPrice('price_evil', prices), null)
assert.equal(sec.billingCycleForPrice(undefined, prices), null)
assert.equal(sec.billingCycleForPrice('', { monthly: '', yearly: '' }), null)

// B5: coupon user update never carries tier
const upd = sec.couponUserUpdate('PROMO', new Date(0))
assert.equal(upd.approved, true)
assert.equal(upd.approvedBy, 'coupon:PROMO')
assert.equal('tier' in upd, false)

// B8: paid-only top-ups
assert.equal(sec.isTopupPaid({ payment_status: 'paid' }), true)
assert.equal(sec.isTopupPaid({ payment_status: 'unpaid' }), false)
assert.equal(sec.isTopupPaid({ payment_status: 'no_payment_required' }), false)

// B8: refund / dispute clawback arithmetic
assert.equal(sec.refundClawbackCents({ creditedCents: 10000, chargeAmount: 10000, amountRefunded: 10000, alreadyDebitedCents: 0 }), 10000)
assert.equal(sec.refundClawbackCents({ creditedCents: 10000, chargeAmount: 10000, amountRefunded: 2500, alreadyDebitedCents: 0 }), 2500)
assert.equal(sec.refundClawbackCents({ creditedCents: 10000, chargeAmount: 10000, amountRefunded: 5000, alreadyDebitedCents: 2500 }), 2500)
assert.equal(sec.refundClawbackCents({ creditedCents: 10000, chargeAmount: 10000, amountRefunded: 5000, alreadyDebitedCents: 10000 }), 0)
assert.equal(sec.refundClawbackCents({ creditedCents: 12000, chargeAmount: 10000, amountRefunded: 99999, alreadyDebitedCents: 0 }), 12000)
assert.equal(sec.disputeClawbackCents(10000, 2500), 7500)
assert.equal(sec.disputeClawbackCents(10000, 10000), 0)

// B7: ordering
assert.equal(sec.isStaleSubscriptionEvent(100, null), false)
assert.equal(sec.isStaleSubscriptionEvent(100, 200), true)
assert.equal(sec.isStaleSubscriptionEvent(200, 100), false)

// Wiring checks on the routes
const redeem = read('app/api/coupons/redeem/route.ts')
assert.match(redeem, /updateMany\(\{[\s\S]*timesRedeemed: \{ lt: coupon\.maxRedemptions \}/, 'B4 conditional updateMany')
assert.match(redeem, /claimed\.count !== 1/, 'B4 aborts when not claimed')
assert.doesNotMatch(redeem, /tier: coupon\.tier/, 'B5 coupon must not set tier')
assert.doesNotMatch(redeem, /\$transaction\([^)]*\)[\s\S]*\$transaction/, 'single transaction')

const hook = read('app/api/webhooks/stripe/route.ts')
assert.match(hook, /claimEvent\(event\)/, 'B7 dedupe by event.id')
assert.match(hook, /releaseEvent\(event\.id\)/, 'B7 release claim on failure')
assert.match(hook, /isStaleSubscriptionEvent\(event\.created/, 'B7 ordering')
assert.match(hook, /existingSub\?\.status === 'canceled'/, 'B7 no resurrection after delete')
assert.match(hook, /payment\.upsert\(/, 'B7 invoice upsert')
assert.doesNotMatch(hook, /payment\.create\(/, 'B7 no bare payment.create')
assert.match(hook, /isTopupPaid\(session\)/, 'B8 paid-only top-ups')
assert.match(hook, /'checkout\.session\.async_payment_succeeded'/, 'B8 async paid top-ups')
assert.match(hook, /'charge\.refunded'/, 'B8 refunds')
assert.match(hook, /'charge\.dispute\.created'/, 'B8 disputes')
assert.doesNotMatch(hook, /Unique constraint/, 'B9 no string match')

const wallet = read('lib/wallet.ts')
assert.match(wallet, /isUniqueViolation\(error\)/, 'B9 wallet P2002')
assert.match(wallet, /allowNegative/, 'clawback may go negative')

const checkout = read('app/api/stripe/create-checkout-session/route.ts')
assert.match(checkout, /billingCycleForPrice\(priceId/, 'B9 server-side billingCycle')
assert.doesNotMatch(checkout, /const \{ priceId, billingCycle \}/, 'B9 client billingCycle ignored')

const schema = read('prisma/schema.prisma')
assert.match(schema, /model StripeWebhookEvent[\s\S]*@@map\("fe_stripe_webhook_events"\)/)
assert.match(read('migrations/add-stripe-webhook-events.sql'), /CREATE TABLE IF NOT EXISTS fe_stripe_webhook_events/)

console.log('test-studio-billing-security: all assertions passed')
