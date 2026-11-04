// FRONTEND-1 proof for L-BILLING F4 + F6 (+ audit B2/B3). Run: node scripts/test-studio-billing-f4-f6.mjs (plain node; reads git + files, no network, no env writes).
// A flag-off identity: stripping BILLING-F4F6 from each touched file gives its base byte for byte (debit route vs #575's head, the rest vs BASE_COMMIT).
// B single price source: no "$NN" plan/pack literal outside lib/marketing/homepage-v2-pricing.ts in the files this change took them from; derived strings equal the old literals.
// C switch default = today: unset / "flat" / junk -> flat; only exact "router" / "flat_strict" change behaviour. B2: under router the debit route ignores the client amount
//   (returns before any read of the body). B3: under flat_strict an InsufficientFundsError answers 402 code wallet_capped.
// D mutants: each mutation of the switch or the strip must make a check fail.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const git = cmd => execSync(`git ${cmd}`, { encoding: 'utf8' })
const m = await import('./studio-billing-f4-f6-strip.mjs')
let n = 0
const ok = (c, msg) => { assert.ok(c, msg); n++ }

// A
const bases = { 'app/api/wallet/debit/route.ts': 'origin/frontend1/tier-update-guard' }
for (const rel of [...m.BILLING_F4F6_FILES, ...Object.keys(m.BILLING_F4F6_EDITS)]) {
  const base = git(`show ${bases[rel] || m.BASE_COMMIT}:"${rel}"`)
  ok(m.stripBillingF4F6(rel, readFileSync(rel, 'utf8')) === base, `A: ${rel} strips to its base`)
}
const env = readFileSync('.env.example', 'utf8')
ok(env === `${git(`show ${m.BASE_COMMIT}:.env.example`)}\n${m.BILLING_F4F6_ENV_BLOCK}` || env.includes(m.BILLING_F4F6_ENV_BLOCK), 'A: env block present')

// B
for (const rel of Object.keys(m.BILLING_F4F6_EDITS)) ok(!/"\$(10|20|25|50|100)(\/month)?"/.test(readFileSync(rel, 'utf8')), `B: no price literal left in ${rel}`)
const pricing = readFileSync('lib/marketing/homepage-v2-pricing.ts', 'utf8')
for (const [id, price] of [['starter', '$20'], ['pro', '$50'], ['premium', '$100']]) ok(new RegExp(`id: "${id}",\\n\\s+name: "[^"]+",\\n\\s+price: "\\${price.slice(1)}"`).test(pricing), `B: ${id} list price ${price}`)
ok(/export const TOPUP_PACKS/.test(pricing), 'B: TOPUP_PACKS lives in the price module')
ok(!/provider_cost|providerCost|margin/i.test(Object.keys(m.BILLING_F4F6_EDITS).map(f => readFileSync(f, 'utf8')).join('')), 'B: no provider cost or margin on user-facing price surfaces')

// C: evaluate the switch module (TS without types)
const loadSwitch = src => { const js = src.replace(/export type[^\n]*\n/g, '').replace(/: Record<string, string \| undefined>/g, '').replace(/\): (WalletDebitSource|boolean)/g, ')').replace(/export /g, ''); return new Function(`${js}; return { walletDebitSource, flatDebitEnabled, refuseCappedDebit, meterFeedDebitsWallet, CAPPED_STATUS, CAPPED_CODE }`)() }
const sw = readFileSync('lib/billing/wallet-debit-source.ts', 'utf8')
const checkSwitch = s => {
  for (const v of [undefined, '', 'flat', 'ROUTER', 'junk']) { assert.equal(s.walletDebitSource({ WALLET_DEBIT_SOURCE: v }), 'flat'); assert.equal(s.flatDebitEnabled({ WALLET_DEBIT_SOURCE: v }), true); assert.equal(s.refuseCappedDebit({ WALLET_DEBIT_SOURCE: v }), false); assert.equal(s.meterFeedDebitsWallet({ WALLET_DEBIT_SOURCE: v }), false) }
  assert.equal(s.flatDebitEnabled({ WALLET_DEBIT_SOURCE: 'router' }), false)
  assert.equal(s.meterFeedDebitsWallet({ WALLET_DEBIT_SOURCE: 'router' }), true)
  assert.equal(s.refuseCappedDebit({ WALLET_DEBIT_SOURCE: 'flat_strict' }), true)
  assert.equal(s.flatDebitEnabled({ WALLET_DEBIT_SOURCE: 'flat_strict' }), true)
  assert.equal(s.CAPPED_STATUS, 402); assert.equal(s.CAPPED_CODE, 'wallet_capped')
}
checkSwitch(loadSwitch(sw)); n++
const route = readFileSync('app/api/wallet/debit/route.ts', 'utf8')
ok(route.indexOf('if (!flatDebitEnabled())') < route.indexOf('await request.json()'), 'C/B2: router mode returns before the client amount is read')
ok(/if \(refuseCappedDebit\(\)\) return NextResponse\.json\(\{[^\n]*code: CAPPED_CODE[^\n]*status: CAPPED_STATUS/.test(route), 'C/B3: capped debit refused under flat_strict')
ok(route.indexOf('refuseCappedDebit()') > route.indexOf('instanceof InsufficientFundsError') && route.indexOf('refuseCappedDebit()') < route.indexOf('capped: true,\n'), 'C/B3: refusal precedes the capped record')

// D mutants
const mutants = [
  s => s.replace('v === "router" ? "router"', 'v ? "router"'),
  s => s.replace('=== "router"', '!== "router"'),
  s => s.replace('"flat_strict" ? "flat_strict"', '"flat_strict" ? "flat"'),
  s => s.replace('walletDebitSource(env) !== "router"', 'walletDebitSource(env) === "flat"'),
  s => s.replace('CAPPED_STATUS = 402', 'CAPPED_STATUS = 200'),
]
for (const [i, mut] of mutants.entries()) { const src = mut(sw); assert.notEqual(src, sw, `mutant ${i} applies`); let killed = false; try { checkSwitch(loadSwitch(src)) } catch { killed = true }; ok(killed, `D: mutant ${i} killed`) }
const stripMutant = (rel, text) => text.split('\n').filter(l => !l.includes('BILLING-F4F6 ')).join('\n')
ok(stripMutant('app/(app)/billing/page.tsx', readFileSync('app/(app)/billing/page.tsx', 'utf8')) !== git(`show ${m.BASE_COMMIT}:"app/(app)/billing/page.tsx"`), 'D: a strip that drops replaced lines instead of restoring them is caught')
console.log(`ok ${n} checks`)
