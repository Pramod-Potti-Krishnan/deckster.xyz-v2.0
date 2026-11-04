// FRONTEND-1 proof for L-BILLING F4 + F6 (+ audit B2/B3). Run: node scripts/test-studio-billing-f4-f6.mjs (plain node; reads git + files, no network, no env writes).
// A flag-off identity: stripping BILLING-F4F6 from each touched file gives its base byte for byte (debit route vs #575's head, the rest vs BASE_COMMIT).
// B single price source: no "$NN" plan/pack literal outside lib/marketing/homepage-v2-pricing.ts in the files this change took them from; derived strings equal the old literals.
// C switch default = today: unset / "flat" / junk -> flat; only exact "router" / "flat_strict" change behaviour. B2: under router the debit route ignores the client amount
//   (returns before any read of the body). B3 (PROGRAM-1 ruling): the post-turn debit is never refused (it logs over cap); GET /api/wallet/precheck refuses 402 wallet_capped under flat_strict when capped.
// E PK ruling (v1 caps): under flat_strict only, daily and weekly caps are ignored and the month is the UTC calendar month; the default path keeps the ET windows and all caps; mutants.
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
const loadSwitch = src => { const js = src.replace(/export type[^\n]*\n/g, '').replace(/: Record<string, string \| undefined>/g, '').replace(/\(now: Date\): Date/g, '(now)').replace(/\): (WalletDebitSource|boolean)/g, ')').replace(/export /g, ''); return new Function(`${js}; return { walletDebitSource, flatDebitEnabled, preBuildCapCheck, preBuildRefused, meterFeedDebitsWallet, monthlyOnlyCaps, startOfMonthUtc, CAPPED_STATUS, CAPPED_CODE }`)() }
const sw = readFileSync('lib/billing/wallet-debit-source.ts', 'utf8')
const checkSwitch = s => {
  for (const v of [undefined, '', 'flat', 'ROUTER', 'junk']) { assert.equal(s.walletDebitSource({ WALLET_DEBIT_SOURCE: v }), 'flat'); assert.equal(s.flatDebitEnabled({ WALLET_DEBIT_SOURCE: v }), true); assert.equal(s.preBuildCapCheck({ WALLET_DEBIT_SOURCE: v }), false); assert.equal(s.preBuildRefused(s.preBuildCapCheck({ WALLET_DEBIT_SOURCE: v }), false, 0), false); assert.equal(s.meterFeedDebitsWallet({ WALLET_DEBIT_SOURCE: v }), false) }
  assert.equal(s.flatDebitEnabled({ WALLET_DEBIT_SOURCE: 'router' }), false)
  assert.equal(s.meterFeedDebitsWallet({ WALLET_DEBIT_SOURCE: 'router' }), true)
  assert.equal(s.preBuildCapCheck({ WALLET_DEBIT_SOURCE: 'flat_strict' }), true)
  assert.equal(s.preBuildCapCheck({ WALLET_DEBIT_SOURCE: 'router' }), false)
  assert.equal(s.preBuildRefused(true, false, 0), true, 'capped, no balance -> refused')
  assert.equal(s.preBuildRefused(true, false, 1), false, 'capped but a top-up balance -> allowed')
  assert.equal(s.preBuildRefused(true, true, 0), false, 'within caps -> allowed')
  assert.equal(s.preBuildRefused(false, false, 0), false, 'check off -> allowed')
  assert.equal(s.flatDebitEnabled({ WALLET_DEBIT_SOURCE: 'flat_strict' }), true)
  for (const v of [undefined, 'flat', 'router']) assert.equal(s.monthlyOnlyCaps({ WALLET_DEBIT_SOURCE: v }), false)
  assert.equal(s.monthlyOnlyCaps({ WALLET_DEBIT_SOURCE: 'flat_strict' }), true)
  assert.equal(s.startOfMonthUtc(new Date('2026-12-01T02:30:00Z')).toISOString(), '2026-12-01T00:00:00.000Z', 'UTC month boundary (ET would still be November)')
  assert.equal(s.startOfMonthUtc(new Date('2026-11-30T23:59:59Z')).toISOString(), '2026-11-01T00:00:00.000Z')
  assert.equal(s.CAPPED_STATUS, 402); assert.equal(s.CAPPED_CODE, 'wallet_capped')
}
checkSwitch(loadSwitch(sw)); n++
const route = readFileSync('app/api/wallet/debit/route.ts', 'utf8')
ok(route.indexOf('if (!flatDebitEnabled())') < route.indexOf('await request.json()'), 'C/B2: router mode returns before the client amount is read')
ok(!/status: CAPPED_STATUS|CAPPED_CODE|status: 402/.test(route), 'C/B3: the post-turn debit is never refused')
ok(/if \(preBuildCapCheck\(\)\) console\.warn\(/.test(route) && route.indexOf('preBuildCapCheck()') > route.indexOf('instanceof InsufficientFundsError') && route.indexOf('preBuildCapCheck()') < route.indexOf('capped: true,\n'), 'C/B3: over cap is logged, then recorded as capped as today')
const pre = readFileSync('app/api/wallet/precheck/route.ts', 'utf8')
ok(pre.indexOf('if (!preBuildCapCheck()) return NextResponse.json({ ok: true, checked: false }') > 0 && pre.indexOf('if (!preBuildCapCheck())') < pre.indexOf('getQuotaStatus('), 'C/B3: precheck default reads nothing and allows')
ok(/preBuildRefused\(true, fitsWithinCaps\(quota\.caps, quota\.spent, 1\), quota\.walletBalanceCents\)\) \{\n\s+return NextResponse\.json\(\{[^\n]*code: CAPPED_CODE[^\n]*status: CAPPED_STATUS/.test(pre), 'C/B3: precheck refuses 402 wallet_capped when capped')
ok(pre.indexOf('getServerTier(') > 0, 'C/B3: precheck tier from the database')

// E PK ruling, v1 caps: under flat_strict only, the monthly cap alone and the UTC month (lib/quota/quota.ts)
const quotaSrc = readFileSync('lib/quota/quota.ts', 'utf8')
const loadFits = (src, strict) => { const body = src.slice(src.indexOf('export function fitsWithinCaps('), src.indexOf('\n}\n', src.indexOf('export function fitsWithinCaps(')) + 3).replace('export ', '').replace(/caps: QuotaCaps,|spent: \{[^}]*\},|costCents: number,|\): boolean/g, m => m.startsWith(')') ? ')' : m.split(':')[0] + ','); return new Function('monthlyOnlyCaps', `${body}; return fitsWithinCaps`)(() => strict) }
const checkFits = src => {
  const caps = { dailyCents: 100, weeklyCents: 300, monthlyCents: 1000 }
  const over = { dailyCents: 100, weeklyCents: 300, monthlyCents: 400 }
  assert.equal(loadFits(src, false)(caps, over, 1), false, 'default: the daily cap still binds')
  assert.equal(loadFits(src, true)(caps, over, 1), true, 'strict: daily and weekly caps ignored')
  assert.equal(loadFits(src, true)(caps, { ...over, monthlyCents: 1000 }, 1), false, 'strict: the monthly cap binds')
  assert.equal(loadFits(src, false)(caps, { dailyCents: 0, weeklyCents: 0, monthlyCents: 0 }, 1), true, 'default: within caps')
}
checkFits(quotaSrc); n++
ok(/const monthFrom = monthlyOnlyCaps\(\) \? startOfMonthUtc\(now\) : monthStart/.test(quotaSrc) && quotaSrc.includes('sumUsage(monthFrom),') && !quotaSrc.includes('sumUsage(monthStart)'), 'E: strict month window is UTC, default stays the ET month')
ok(/\.\.\.\(monthlyOnlyCaps\(\) \? \{ flags: \{ dailyNear: false, dailyAt: false, weeklyNear: false, weeklyAt: false \}/.test(quotaSrc), 'E: strict quota shows no daily/weekly flags; default spread is {}')
for (const [i, mut] of [
  src => src.replace('if (monthlyOnlyCaps()) return spent.monthlyCents', 'if (!monthlyOnlyCaps()) return spent.monthlyCents'),
  src => src.replace('if (monthlyOnlyCaps()) return spent.monthlyCents + costCents <= caps.monthlyCents', 'if (monthlyOnlyCaps()) return true'),
].entries()) { let killed = false; try { checkFits(mut(quotaSrc)) } catch { killed = true }; ok(killed, `E: quota mutant ${i} killed`) }

// D mutants
const mutants = [
  s => s.replace('v === "router" ? "router"', 'v ? "router"'),
  s => s.replace('=== "router"', '!== "router"'),
  s => s.replace('"flat_strict" ? "flat_strict"', '"flat_strict" ? "flat"'),
  s => s.replace('walletDebitSource(env) !== "router"', 'walletDebitSource(env) === "flat"'),
  s => s.replace('CAPPED_STATUS = 402', 'CAPPED_STATUS = 200'),
  s => s.replace('Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)', 'Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 5)'),
  s => s.replace('return walletDebitSource(env) === "flat_strict"\n}\n\n/** The first', 'return walletDebitSource(env) !== "router"\n}\n\n/** The first'),
  s => s.replace('return enabled && !fitsOneCent && !(walletBalanceCents > 0)', 'return enabled && !fitsOneCent'),
  s => s.replace('return enabled && !fitsOneCent && !(walletBalanceCents > 0)', 'return !fitsOneCent && !(walletBalanceCents > 0)'),
  s => s.replace('return walletDebitSource(env) === "flat_strict"', 'return walletDebitSource(env) !== "router"'),
]
for (const [i, mut] of mutants.entries()) { const src = mut(sw); assert.notEqual(src, sw, `mutant ${i} applies`); let killed = false; try { checkSwitch(loadSwitch(src)) } catch { killed = true }; ok(killed, `D: mutant ${i} killed`) }
const stripMutant = (rel, text) => text.split('\n').filter(l => !l.includes('BILLING-F4F6 ')).join('\n')
ok(stripMutant('app/(app)/billing/page.tsx', readFileSync('app/(app)/billing/page.tsx', 'utf8')) !== git(`show ${m.BASE_COMMIT}:"app/(app)/billing/page.tsx"`), 'D: a strip that drops replaced lines instead of restoring them is caught')
console.log(`ok ${n} checks`)
