// FRONTEND-2 (B67; L-BILLING, the Studio half): proof of the Plan & credits UI, the F3 entitlement push (with its dry-run backfill) and the F4 meter receiver. Three switches, each exact "true" and off by default:
// NEXT_PUBLIC_STUDIO_BILLING_PLANS (UI, build-time), STUDIO_ROUTER_ENTITLEMENTS_PUSH (F3, server runtime), STUDIO_METER_RECEIVER_ENABLED (F4, server runtime; METER_RECEIVER_MODE "receipt_only" unless exactly "apply").
// New files only (scripts/studio-billing-l5-strip.mjs lists them); FRONTEND-1's files get DRAFT lines that are NOT applied.
//
//   node scripts/test-studio-billing-l5.mjs        (plain node: transpile + vm of the REAL sources, react-dom/server for the markup; no network, no router, no Stripe, no database, no browser; made-up short test words, never a real key)
//
// What it proves:
//  1. the flags: each is the exact string "true" (every other spelling is off);
//  2. UI: flag off the component draws nothing and the preview route calls notFound; on, Free and the three paid plans with the spec's exact numbers (150 / 2,000 / 5,000 / 10,000 credits a month, images 40 / 120 / 300,
//     about 3 / 20 / 25 / 30 decks), three packs "1,000 credits for $10", "2,500 credits for $25", "5,000 credits for $50" (no $100 pack), the spend-order line; a price only on an Upgrade or pack button; the usage section
//     (the EXISTING credits view) and the rest of the page carry no $, token, cost, price, margin, model or provider word; the payments-open-soon state is respected (UpgradeButton's own state, packs disabled with the line);
//     the Upgrade button IS the existing UpgradeButton with each plan's price id (its click is the existing checkout POST) and a pack button makes the Billing page's own top-up POST;
//  3. F3: all 7 stored Stripe statuses (and Stripe's paused) map, in a table; source_version = updatedAt in ms; the body is the router's (no plan_credits, no extra key); flag off: skipped before ANY other environment
//     value is read (a Proxy on process.env), no database read, no fetch; the URL comes from requireServiceUrl with no production fallback; the key goes only into Authorization; every router answer maps to a typed
//     outcome and nothing throws; the key name appears in no client file ("use client" files, components/, NEXT_PUBLIC_ names); the backfill is a dry run that reads no environment and sends nothing unless --apply AND the flag;
//  4. F4: flag off 404 before the body, a header or another variable is read; bad and missing signatures 401; the right signature over the same bytes 200 and one changed byte 401; a re-timestamped payload 401; receipt_only
//     never loads or calls the wallet; apply debits once per event (sourceRef meter:<event_id>) only while the debit source is router; the comparison is crypto.timingSafeEqual; the logs carry no body, amount, user or secret;
//  5. the DRAFT lines for FRONTEND-1's files: each anchor is dev's line, at its number, once; each new line carries the marker and is not applied; patched in memory the files still parse;
//  6. the pins: .env.example (one block at the true end, flags "false", keys EMPTY), the registry (three lines at the true end), the two older proofs taught (put back they are the base's, byte for byte), the strip is plain data;
//  7. scope over the COMMITTED diff, GATE-SAFE (HEAD^2) and ROBUST AFTER MERGE, plus a LINEAR STACK check; 8. mutants are caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import * as S from './studio-billing-l5-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const { BASE_COMMIT, stripBillingL5 } = S
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
/** Strips of the changes registered AFTER this one only, in the registry's order: on a branch stacked after this change a later change's own lines are undone first, so a file reads as this change left it. */
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripBillingL5); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const h = React.createElement

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
/** A mutant is caught only by a failed ASSERTION of a check. A mutant whose edit did not apply (SwapError) or that crashed some other way proves nothing and is reported as missed. */
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }
/** The code of a source without its comments (line and block). */
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')
const textOf = html => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
const count = (text, needle) => text.split(needle).length - 1

// ---- the real sources in a vm ---------------------------------------------------------------------------------------------------------------------------------------------------
const PLANS_LIB = 'lib/studio-billing-plans.ts', COMP = 'components/billing/studio-plan-credits.tsx', PAGE = 'app/(app)/billing/plans/page.tsx'
const ENT_LIB = 'lib/billing/router-entitlements.ts', BACKFILL = 'scripts/billing-entitlement-backfill.mjs', ROUTE = 'app/api/internal/meter/route.ts'
const SRC = { [PLANS_LIB]: read(PLANS_LIB), [COMP]: read(COMP), [PAGE]: read(PAGE), [ENT_LIB]: read(ENT_LIB), [ROUTE]: read(ROUTE) }
const SPELLINGS = [undefined, 'false', 'TRUE', '1', ' true', 'true ', 'yes', '', 'on', 'true']
const ALIAS = {
  '@/lib/studio-billing-plans': PLANS_LIB, '@/lib/marketing/homepage-v2-pricing': 'lib/marketing/homepage-v2-pricing.ts', '@/lib/studio-billing': 'lib/studio-billing.ts',
  '@/lib/studio-usage-credits': 'lib/studio-usage-credits.ts', '@/lib/studio-payments-open-soon': 'lib/studio-payments-open-soon.ts', '@/components/billing/UpgradeButton': 'components/billing/UpgradeButton.tsx',
  '@/components/studio-usage-credits': 'components/studio-usage-credits.tsx', '@/components/billing/studio-plan-credits': COMP, '@/lib/service-url': 'lib/service-url.ts',
  '@/lib/billing/router-entitlements': ENT_LIB, '@/lib/billing/wallet-debit-source': 'lib/billing/wallet-debit-source.ts',
}
const compileCache = new Map()
const compile = (rel, text) => {
  const id = `${rel}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: rel, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
/** One module world: real sources (ALIAS) with `texts` in place of any file, `overrides` for any import, `globals` in every context. `required` collects every import asked for. */
function makeLoader({ env = {}, texts = {}, overrides = {}, globals = {}, required = [] } = {}) {
  const cache = new Map()
  const load = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const req = spec => {
      required.push(spec)
      if (Object.prototype.hasOwnProperty.call(overrides, spec)) return overrides[spec]
      if (spec === 'react') return React
      if (spec === 'react/jsx-runtime') return jsxRuntime
      if (spec.endsWith('.css')) return {}
      if (spec === 'node:crypto' || spec === 'crypto') return crypto
      if (Object.prototype.hasOwnProperty.call(ALIAS, spec)) return load(ALIAS[spec])
      throw new Error(`unexpected import ${spec} in ${rel}`)
    }
    vm.runInNewContext(compile(rel, texts[rel] ?? SRC[rel] ?? read(rel)), { module, exports: module.exports, require: req, process: { env }, URL, AbortSignal, Buffer, console, ...globals }, { filename: rel })
    return module.exports
  }
  return load
}
const recorder = logs => ({ log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), info: (...a) => logs.push(a.join(' ')) })

// ===== 1. the flags =================================================================================================================================================================
console.log('1. flags')
function proveUiFlag(libText) {
  for (const spelling of SPELLINGS) {
    const mod = makeLoader({ env: spelling === undefined ? {} : { NEXT_PUBLIC_STUDIO_BILLING_PLANS: spelling }, texts: { [PLANS_LIB]: libText } })(PLANS_LIB)
    assert.equal(mod.STUDIO_BILLING_PLANS_ENABLED, spelling === 'true', `UI constant for ${JSON.stringify(spelling)}`); assert.equal(mod.studioBillingPlansOn(spelling), spelling === 'true', `UI reader for ${JSON.stringify(spelling)}`)
  }
}
function provePushFlag(libText) {
  const mod = makeLoader({ texts: { [ENT_LIB]: libText }, overrides: { '@/lib/prisma': { prisma: {} } } })(ENT_LIB)
  for (const spelling of SPELLINGS) assert.equal(mod.routerEntitlementsPushOn(spelling), spelling === 'true', `F3 reader for ${JSON.stringify(spelling)}`)
}
await check('the flags are the exact string "true": every other spelling (unset, false, TRUE, 1, a padded true, yes, on) is off, for the UI constant and reader and for the F3 reader (F4 is proven through its route below)', () => { proveUiFlag(SRC[PLANS_LIB]); provePushFlag(SRC[ENT_LIB]) })

// ===== 2. the UI ====================================================================================================================================================================
console.log('2. UI')
const NOT_FOUND = new Error('NEXT_NOT_FOUND')
const BUTTON = { Button: ({ variant, size, asChild, children, ...rest }) => h('button', rest, children) }
const sessionReads = []
const UI_OVERRIDES = {
  '@/components/ui/button': BUTTON, 'lucide-react': { Loader2: () => null }, 'next/navigation': { notFound: () => { throw NOT_FOUND } },
  'next-auth': { getServerSession: async options => { sessionReads.push(options); return sessionReads.tier === undefined ? null : { user: { tier: sessionReads.tier } } } }, '@/lib/auth-options': { authOptions: { stub: true } },
}
const PRICE_IDS = { NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID: 'price_st_m', NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID: 'price_pr_m', NEXT_PUBLIC_STRIPE_MAX_MONTHLY_PRICE_ID: 'price_mx_m' }
const UI_ON = extra => ({ NEXT_PUBLIC_STUDIO_BILLING_PLANS: 'true', ...PRICE_IDS, ...extra })
const uiLoader = (env, texts = {}, overrides = {}) => makeLoader({ env, texts, overrides: { ...UI_OVERRIDES, ...overrides }, globals: { Date } })
const renderPlans = ({ env = UI_ON(), props = { currentTier: 'free' }, texts = {} } = {}) => renderToStaticMarkup(h(uiLoader(env, texts)(COMP).StudioPlanCredits, props))
/** The preview route, awaited (an async server component); `tier` is what the session says (undefined: no session). */
async function renderPage({ env = UI_ON(), texts = {}, tier } = {}) {
  sessionReads.length = 0; sessionReads.tier = tier
  const page = uiLoader(env, texts)(PAGE).default
  let element
  try { element = await page() } catch (error) { if (error === NOT_FOUND) return { notFound: true, sessionReads: sessionReads.length }; throw error }
  return { notFound: false, html: renderToStaticMarkup(element), sessionReads: sessionReads.length }
}
// the usage contract's own example (streams/router/USAGE-READ-API.md), parsed by the REAL usage lib into the state the existing view draws
const USAGE_EXAMPLE = {
  user_id: 'user_123', as_of: '2026-11-02T12:00:00Z', month: { start: '2026-11-01T00:00:00Z', end: '2026-12-01T00:00:00Z' }, credits_used: '3.000000', credits_left: '4502.500000',
  balance_period: { key: '2026-10-15T07:00:00Z', start: '2026-10-15T07:00:00Z', end: '2026-11-15T07:00:00Z' }, plan: 'pro', plan_source: 'fresh', plan_credits_granted: '5000.000000', plan_credits_used: '510.000000',
  plan_credits_left: '4490.000000', topup_credits_left: '12.500000', daily: [{ date: '2026-11-01', credits_used: '2.250000' }, { date: '2026-11-02', credits_used: '0.750000' }],
}
const usageView = makeLoader()('lib/studio-usage-credits.ts').parseUsageCredits(USAGE_EXAMPLE).view
const READY = { kind: 'ready', view: usageView }
/** The leak words of the usage-credits page proof: $, USD, cost, price, token, model, provider, margin, cents, model names. */
const CREDITS_ONLY_LEAK = /\$|\busd\b|_usd\b|dollar|\bcosts?\b|\bprices?\b|per[ -]token|\btokens?\b|\bmodels?\b|provider|openrouter|margin|\bcents?\b|\b(gpt|claude|gemini|llama|sonnet|opus|haiku)\b/i
const BUTTON_LEAK = /\busd\b|dollar|\bcosts?\b|\bprices?\b|\btokens?\b|\bmodels?\b|provider|margin|\bcents?\b/i
/** A plan or pack "button": a <button>, or the /pricing link a paid account gets in place of checkout. */
const BUTTON_RE = /<button\b[^>]*>([\s\S]*?)<\/button>|<a\b[^>]*data-studio-plan-value="pricing"[^>]*>([\s\S]*?)<\/a>/g
const buttonsOf = html => [...html.matchAll(BUTTON_RE)].map(m => ({ tag: m[0].slice(0, m[0].indexOf('>') + 1), text: textOf(m[1] ?? m[2]) }))
const withoutButtons = html => html.replace(BUTTON_RE, '')
const cardsOf = html => [...html.matchAll(/<li\b[^>]*data-studio-plan="(\w+)"[^>]*>([\s\S]*?)<\/li>/g)].map(m => ({ id: m[1], tag: m[0].slice(0, m[0].indexOf('>') + 1), html: m[2], text: textOf(m[2]) }))
const usagePartOf = html => { const at = html.indexOf('<div data-studio-plan-credits-part="usage">'); return at === -1 ? null : html.slice(at) }
/** What each card offers: checkout (the existing UpgradeButton), pricing (the /pricing link, or its disabled open-soon form), coming-soon, current, or none. */
const actionOf = card => {
  if (/aria-current="true"/.test(card.tag) && card.html.includes('data-studio-plan-value="current"')) return 'current'
  if (card.html.includes('data-studio-plan-value="pricing"')) return 'pricing'
  if (card.html.includes('data-studio-plan-value="coming-soon"')) return 'coming-soon'
  return buttonsOf(card.html).length === 1 ? 'checkout' : buttonsOf(card.html).length === 0 ? 'none' : 'several'
}
const actions = (props, env = UI_ON(), compText = SRC[COMP]) => Object.fromEntries(cardsOf(renderPlans({ env, props, texts: { [COMP]: compText } })).map(c => [c.id, actionOf(c)]))
const PLAN_ROWS = [
  ['free', 'Free', '150 credits a month', null, 'About 3 decks a month', null],
  ['starter', 'Starter', '2,000 credits a month', 'Up to 40 images a month', 'About 20 decks a month', 'Upgrade · $20/month'],
  ['pro', 'Pro', '5,000 credits a month', 'Up to 120 images a month', 'About 25 decks a month', 'Upgrade · $50/month'],
  ['premium', 'Max', '10,000 credits a month', 'Up to 300 images a month', 'About 30 decks a month', 'Upgrade · $100/month'],
]
const PACK_ROWS = [['pack_10', '1,000 credits for $10'], ['pack_25', '2,500 credits for $25'], ['pack_50', '5,000 credits for $50']]

async function proveGate(compText = SRC[COMP], pageText = SRC[PAGE]) {
  for (const spelling of SPELLINGS.filter(s => s !== 'true')) {
    const env = { ...PRICE_IDS, NEXT_PUBLIC_STUDIO_USAGE_CREDITS: 'true', ...(spelling === undefined ? {} : { NEXT_PUBLIC_STUDIO_BILLING_PLANS: spelling }) }
    assert.equal(renderPlans({ env, props: { currentTier: 'pro', usageState: READY }, texts: { [COMP]: compText } }), '', `flag ${JSON.stringify(spelling)}: the component draws nothing (no wrapper)`)
    const page = await renderPage({ env, texts: { [COMP]: compText, [PAGE]: pageText }, tier: 'free' })
    assert.equal(page.notFound, true, `flag ${JSON.stringify(spelling)}: the preview route calls notFound`); assert.equal(page.sessionReads, 0, 'before the session is read')
  }
  const on = await renderPage({ texts: { [COMP]: compText, [PAGE]: pageText }, tier: 'free' })
  assert.equal(on.notFound, false, 'flag on: the route renders'); assert.match(on.html, /^<main [^>]*data-studio-billing-plans-page="true"><section [^>]*data-studio-plan-credits="true"/, 'flag on: the page holds the section')
  assert.equal(on.sessionReads, 1, 'the route reads the session once, for the tier')
  assert.equal(count(on.html, 'Upgrade · $'), 3, 'a Free session: checkout on the three paid plans')
  const paid = await renderPage({ texts: { [COMP]: compText, [PAGE]: pageText }, tier: 'pro' }); assert.ok(!/<button[^>]*>Upgrade ·/.test(paid.html) && paid.html.includes('href="/pricing"'), 'a Pro session: no checkout button, the /pricing link')
  const none = await renderPage({ texts: { [COMP]: compText, [PAGE]: pageText } }); assert.ok(!/<button[^>]*>Upgrade ·/.test(none.html), 'no session tier: no checkout button')
}
function proveNumbers(compText = SRC[COMP], libText = SRC[PLANS_LIB]) {
  const html = renderPlans({ texts: { [COMP]: compText, [PLANS_LIB]: libText } }), cards = cardsOf(html)
  assert.deepEqual(cards.map(c => c.id), PLAN_ROWS.map(r => r[0]), 'Free, Starter, Pro, Max, in that order')
  for (const [id, name, credits, images, decks, button] of PLAN_ROWS) {
    const card = cards.find(c => c.id === id)
    assert.match(card.html, new RegExp(`^<h3[^>]*>${escapeRe(name)}</h3>`), `${id}: named ${name}`)
    assert.ok(card.html.includes(`data-studio-plan-value="credits">${credits}</p>`), `${id}: ${credits}`)
    if (images) assert.ok(card.html.includes(`data-studio-plan-value="images">${images}</p>`), `${id}: ${images}`); else assert.ok(!card.html.includes('data-studio-plan-value="images"'), `${id}: no image line (the spec gives Free none)`)
    assert.ok(card.html.includes(`data-studio-plan-value="decks">${decks}</p>`), `${id}: ${decks} (copy only)`)
    assert.deepEqual(buttonsOf(card.html).map(b => b.text), button ? [button] : [], `${id} (a Free account): ${button ?? 'no button'}`)
  }
  const packs = [...html.matchAll(/<button\b[^>]*data-studio-plan-pack="(\w+)"[^>]*>([\s\S]*?)<\/button>/g)].map(m => [m[1], textOf(m[2])])
  assert.deepEqual(packs, PACK_ROWS, 'three packs as credits, exactly; no $100 pack')
  assert.ok(!html.includes('pack_100'), 'the $100 pack is gone')
  assert.ok(textOf(html).includes('Your plan credits are used first, then your top-up credits. Plan credits reset each month; top-up credits never expire.'), 'the spend-order line')
  assert.ok(textOf(html).includes('Deck counts are estimates.'), 'the deck counts are said to be estimates')
}
function proveCreditsOnly(compText = SRC[COMP], libText = SRC[PLANS_LIB]) {
  const texts = { [COMP]: compText, [PLANS_LIB]: libText }
  for (const [soon, tier] of [[undefined, undefined], ['true', 'pro'], [undefined, 'free'], [undefined, 'starter'], ['true', 'free']]) {
    const html = renderPlans({ env: UI_ON(soon ? { NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON: soon } : {}), props: { currentTier: tier, usageState: READY }, texts })
    const usage = usagePartOf(html)
    assert.ok(usage && usage.includes('data-studio-usage-credits="true" data-state="ok"'), 'the usage section is the existing credits view, drawn (so "no leak" is not "nothing drawn")')
    assert.ok(textOf(usage).includes('4,490') && textOf(usage).includes('12.5'), 'it shows plan credits left and top-up credits left')
    assert.doesNotMatch(usage, CREDITS_ONLY_LEAK, 'the usage section: no $, USD, cost, price, token, model or provider word in its markup'); assert.doesNotMatch(textOf(usage), CREDITS_ONLY_LEAK)
    assert.doesNotMatch(withoutButtons(html), CREDITS_ONLY_LEAK, 'outside the plan and pack buttons nothing in the section says $, cost, price, token, margin, model or provider')
    for (const button of buttonsOf(html)) assert.doesNotMatch(button.text, BUTTON_LEAK, `a button says no cost, token, margin, model or provider word: ${button.text}`)
  }
}
function provePaymentsSoon(compText = SRC[COMP]) {
  const soon = renderPlans({ env: UI_ON({ NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON: 'true' }), texts: { [COMP]: compText } })
  const ups = cardsOf(soon).flatMap(c => buttonsOf(c.html))
  assert.equal(ups.length, 3, 'three plan buttons'); for (const b of ups) { assert.equal(b.text, 'Payments open soon', 'UpgradeButton\'s own open-soon state'); assert.match(b.tag, /\bdisabled=""/); assert.match(b.tag, /aria-disabled="true"/) }
  const packs = buttonsOf(soon).filter(b => /data-studio-plan-pack=/.test(b.tag))
  assert.equal(packs.length, 3); for (const b of packs) { assert.match(b.tag, /\bdisabled=""/, `${b.text}: disabled`); assert.match(b.tag, /aria-disabled="true"/); assert.match(b.tag, /title="Payments open soon"/) }
  assert.equal(count(soon, 'data-studio-plan-credits-part="packs-soon"'), 1, 'the line is said once, under the packs'); assert.ok(!/Upgrade ·/.test(soon), 'no live Upgrade label')
  const paidSoon = renderPlans({ env: UI_ON({ NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON: 'true' }), props: { currentTier: 'starter' }, texts: { [COMP]: compText } })
  const links = cardsOf(paidSoon).flatMap(c => buttonsOf(c.html)); assert.equal(links.length, 2, 'a Starter account: Pro and Max upgrades')
  for (const b of links) { assert.equal(b.text, 'Payments open soon'); assert.match(b.tag, /^<button\b[^>]*\bdisabled=""/, 'the /pricing upgrade is a disabled button while payments open soon') }
  assert.ok(!paidSoon.includes('href="/pricing"'))
  const open = renderPlans({ texts: { [COMP]: compText } })
  assert.ok(!open.includes('Payments open soon'), 'off: no open-soon words'); for (const b of buttonsOf(open)) assert.doesNotMatch(b.tag, /\bdisabled=""/, `off: ${b.text} is live`)
}
function proveCurrentTier(compText = SRC[COMP]) {
  const C = 'checkout', PR = 'pricing', N = 'none', ME = 'current'
  assert.deepEqual(actions({ currentTier: 'free' }, UI_ON(), compText), { free: ME, starter: C, pro: C, premium: C }, 'a Free account: checkout on the three paid plans (the Billing page\'s rule)')
  for (const tier of [undefined, null, 'enterprise', '']) assert.deepEqual(actions({ currentTier: tier }, UI_ON(), compText), { free: N, starter: PR, pro: PR, premium: PR }, `tier ${JSON.stringify(tier)}: never checkout, the /pricing link`)
  assert.deepEqual(actions({ currentTier: 'starter' }, UI_ON(), compText), { free: N, starter: ME, pro: PR, premium: PR }, 'Starter: no second subscription, the /pricing link above')
  assert.deepEqual(actions({ currentTier: 'pro' }, UI_ON(), compText), { free: N, starter: N, pro: ME, premium: PR }, 'Pro: only Max, by /pricing')
  for (const tier of ['max', 'premium']) assert.deepEqual(actions({ currentTier: tier }, UI_ON(), compText), { free: N, starter: N, pro: N, premium: ME }, `${tier}: nothing above it`)
  const noIds = UI_ON({ NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID: undefined, NEXT_PUBLIC_STRIPE_MAX_MONTHLY_PRICE_ID: '' })
  assert.deepEqual(actions({ currentTier: 'free' }, noIds, compText), { free: ME, starter: 'coming-soon', pro: C, premium: 'coming-soon' }, 'a plan with no public price id: a disabled "Coming soon", never a dead checkout')
  assert.deepEqual(actions({ currentTier: 'free' }, { ...noIds, NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON: 'true' }, compText), { free: ME, starter: C, pro: C, premium: C }, 'while payments open soon every plan shows UpgradeButton\'s own disabled state')
  const pricing = renderPlans({ props: { currentTier: 'pro' }, texts: { [COMP]: compText } }); assert.match(pricing, /<a href="\/pricing"[^>]*data-studio-plan-value="pricing">Upgrade · \$100\/month<\/a>/, 'the paid upgrade is a plain link to /pricing')
  const soonCard = cardsOf(renderPlans({ env: noIds, texts: { [COMP]: compText } })).find(c => c.id === 'starter'); assert.match(buttonsOf(soonCard.html)[0].tag, /\bdisabled=""/); assert.equal(buttonsOf(soonCard.html)[0].text, 'Coming soon')
}
function proveNoOwnUsageFetch(compText = SRC[COMP]) { assert.doesNotMatch(code(compText), /\/api\/usage\/credits|\/api\/usage\/quota|\/api\/account\/usage|\/api\/wallet\/balance/, 'the component makes no usage request of its own') }
/** The click paths, without a browser: the element tree is walked with a useState that keeps its first value, and each onClick is called with a recording fetch. */
async function proveClicks(compText = SRC[COMP], env = UI_ON(), libText = SRC[PLANS_LIB]) {
  const fetches = [], win = { location: { href: '' } }
  const fetchStub = async (url, init) => { fetches.push({ url, init: JSON.parse(JSON.stringify(init)) }); return { json: async () => ({ url: 'https://checkout.example.test/s' }) } }
  const reactShim = { ...React, useState: init => [typeof init === 'function' ? init() : init, () => {}] }
  const load = makeLoader({ env, texts: { [COMP]: compText, [PLANS_LIB]: libText }, overrides: { ...UI_OVERRIDES, react: reactShim }, globals: { fetch: fetchStub, window: win, alert: () => {} } })
  const comp = load(COMP), upgrade = load('components/billing/UpgradeButton.tsx').UpgradeButton
  const tree = props => {
    const found = []
    const walk = node => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!node || typeof node !== 'object') return
      if (node.type === upgrade) { found.push({ kind: 'upgrade', props: node.props }); return walk(upgrade(node.props)) }
      if (typeof node.type === 'function' && node.type.name === 'PackButtons') return walk(node.type(node.props))
      if (node.props?.['data-studio-plan-pack']) found.push({ kind: 'pack', props: node.props })
      if (node.type === 'a') found.push({ kind: 'link', props: node.props })
      if (node.type === 'button' || node.type === BUTTON.Button) found.push({ kind: 'button', props: node.props })
      walk(node.props?.children)
    }
    walk(comp.StudioPlanCreditsView(props))
    return found
  }
  const found = tree({ currentTier: 'free' })
  const ups = found.filter(f => f.kind === 'upgrade').map(f => f.props)
  assert.deepEqual(ups.map(p => [p.priceId, p.billingCycle]), [['price_st_m', 'monthly'], ['price_pr_m', 'monthly'], ['price_mx_m', 'monthly']], 'each Upgrade of a Free account is the existing UpgradeButton with its plan\'s monthly price id (Pro\'s is the one the Billing page sends)')
  const upClicks = found.filter(f => f.kind === 'button' && typeof f.props.onClick === 'function' && /Upgrade ·/.test(String(f.props.children)))
  assert.equal(upClicks.length, 3)
  await upClicks[1].props.onClick()
  assert.deepEqual(fetches.splice(0), [{ url: '/api/stripe/create-checkout-session', init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId: 'price_pr_m', billingCycle: 'monthly' }) } }], 'Upgrade on Pro is the existing checkout request, unchanged')
  const packs = found.filter(f => f.kind === 'pack')
  assert.deepEqual(packs.map(p => p.props['data-studio-plan-pack']), ['pack_10', 'pack_25', 'pack_50'])
  await packs[1].props.onClick()
  assert.deepEqual(fetches.splice(0), [{ url: '/api/stripe/create-topup-session', init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packId: 'pack_25' }) } }], 'a pack button is the Billing page\'s own top-up request')
  assert.equal(win.location.href, 'https://checkout.example.test/s', 'and goes where that route says')
  for (const tier of ['starter', 'pro', null]) {
    const paid = tree({ currentTier: tier })
    assert.deepEqual(paid.filter(f => f.kind === 'upgrade'), [], `${tier}: no UpgradeButton, so no checkout POST can start a second subscription`)
    for (const link of paid.filter(f => f.kind === 'link')) { assert.equal(link.props.href, '/pricing'); assert.equal(link.props.onClick, undefined) }
    assert.ok(paid.filter(f => f.kind === 'link').length >= 1)
  }
  return { packs, fetches }
}
await check('UI flag off: <StudioPlanCredits /> draws nothing (no wrapper) for every non-"true" spelling and the preview route /billing/plans calls notFound before reading the session; on, the route draws the section with the session\'s tier', () => proveGate())
await check('UI numbers (the spec\'s, exactly): Free 150, Starter 2,000, Pro 5,000, Max 10,000 credits a month; images 40 / 120 / 300 (none stated for Free); about 3 / 20 / 25 / 30 decks; three packs "1,000 credits for $10", "2,500 credits for $25", "5,000 credits for $50", no $100 pack; the spend-order line', () => proveNumbers())
await check('UI credits only: the usage section is the EXISTING credits view (drawn) with no $, token, cost, price, margin, model or provider word; outside the plan and pack buttons the section has none either', () => proveCreditsOnly())
await check('UI payments open soon: on, each Upgrade of a Free account is UpgradeButton\'s own disabled "Payments open soon", a paid account\'s /pricing upgrades and every pack button are disabled with that line; off, every button is live', () => provePaymentsSoon())
await check('UI no second subscription (review MAJOR 1): ONLY a Free account gets checkout; paid, unknown or no tier gets the /pricing link; the own plan is "Your plan"; a plan with no public price id is a disabled "Coming soon"', () => proveCurrentTier())
await check('UI checkout unchanged: each Upgrade of a Free account is the existing UpgradeButton (its click is the existing POST /api/stripe/create-checkout-session with the plan\'s price id); a paid account has no UpgradeButton at all; a pack button is the Billing page\'s POST /api/stripe/create-topup-session', () => proveClicks())
await check('UI with payments open soon the pack buttons have no click handler at all, and without a usage state the section draws the existing credits view (which fetches /api/usage/credits itself) only when its own flag is on: no new fetch', async () => {
  const html = renderPlans({ env: UI_ON({ NEXT_PUBLIC_STUDIO_USAGE_CREDITS: 'true' }) }); assert.ok(usagePartOf(html).startsWith('<div data-studio-plan-credits-part="usage"><section class="suc" data-studio-usage-credits="true" data-state="loading"'), 'the existing loader, in its loading state')
  assert.equal(usagePartOf(renderPlans()), null, 'its flag off: no usage part at all')
  proveNoOwnUsageFetch()
  const reactShim = { ...React, useState: init => [init, () => {}] }
  const load = makeLoader({ env: UI_ON({ NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON: 'true' }), overrides: { ...UI_OVERRIDES, react: reactShim } })
  const tree = load(COMP).StudioPlanCreditsView({ currentTier: 'free' }), packs = []
  const walk = n => { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; if (typeof n.type === 'function' && n.type.name === 'PackButtons') return walk(n.type(n.props)); if (n.props?.['data-studio-plan-pack']) packs.push(n.props); walk(n.props?.children) }
  walk(tree); assert.equal(packs.length, 3); for (const p of packs) { assert.equal(p.onClick, undefined, 'no handler'); assert.equal(p.disabled, true) }
})

// ===== 3. F3: the entitlement push ==================================================================================================================================================
console.log('3. F3 entitlement push')
const RK = 'rk-test-01' // a made-up router key word: never a real one
const ROUTER = 'https://router.example.test'
const F3_ON = { STUDIO_ROUTER_ENTITLEMENTS_PUSH: 'true', MODEL_ROUTER_URL: ROUTER, MODEL_ROUTER_BILLING_KEY: RK, STRIPE_REAL_TIER_MAPPING_ENABLED: 'true' }
const USER = { id: 'ckuser01', tier: 'pro', updatedAt: new Date('2026-11-01T10:00:00.000Z') }
const SUB = (status, extra = {}) => ({ status, tier: 'pro', currentPeriodStart: new Date('2026-11-01T00:00:00.000Z'), currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z'), updatedAt: new Date('2026-11-03T14:22:05.123Z'), ...extra })
const answer = (status, body) => ({ status, headers: { get: () => null }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })
/** The library in a world with `env`, a recording fetch answering `reply` and a fake database; `logs` collects every console line. */
function entWorld({ env = F3_ON, text = SRC[ENT_LIB], reply = () => answer(200, { applied: true, stored_version: 1 }), db } = {}) {
  const fetches = [], logs = [], dbCalls = []
  const fake = db ?? {
    user: { findUnique: async args => { dbCalls.push(['user.findUnique', args]); return args.where.id === USER.id ? { id: USER.id, tier: USER.tier, updatedAt: USER.updatedAt } : null } },
    subscription: {
      findMany: async args => { dbCalls.push(['subscription.findMany', args]); return args.where.userId === USER.id ? [SUB('canceled', { updatedAt: new Date('2026-11-05T00:00:00.000Z') }), SUB('active')] : [] },
      findUnique: async args => { dbCalls.push(['subscription.findUnique', args]); return args.where.stripeSubscriptionId === 'sub_A1' ? { userId: USER.id } : null },
    },
  }
  const fetchStub = async (url, init) => { fetches.push({ url, init }); return reply(url, init) }
  const lib = makeLoader({ env, texts: { [ENT_LIB]: text }, overrides: { '@/lib/prisma': { prisma: fake } }, globals: { fetch: fetchStub, console: recorder(logs), Date } })(ENT_LIB)
  return { lib, fetches, logs, dbCalls }
}
/** A process.env that records every name read (get, has, keys). */
const recordingEnv = (values = {}) => { const reads = []; return { reads, env: new Proxy({ ...values }, { get: (t, k) => { reads.push(String(k)); return t[k] }, has: (t, k) => { reads.push(`has:${String(k)}`); return k in t }, ownKeys: t => { reads.push('ownKeys'); return Reflect.ownKeys(t) } }) } }

function proveStatusTable(text = SRC[ENT_LIB]) {
  const { lib } = entWorld({ text })
  assert.deepEqual([...lib.STRIPE_SUBSCRIPTION_STATUSES], ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired'], 'the 7 statuses Studio stores')
  const TABLE = [['active', 'plan'], ['trialing', 'plan'], ['past_due', 'plan_until_grace'], ['canceled', 'free'], ['unpaid', 'free'], ['incomplete', 'free'], ['incomplete_expired', 'free'], ['paused', 'free']]
  assert.deepEqual(Object.entries(lib.ROUTER_EFFECT_OF_STATUS), TABLE, 'what the router makes of each (its A6 table)')
  for (const [status] of TABLE) {
    const built = lib.buildEntitlement(USER, SUB(status), 'stripe')
    assert.deepEqual(JSON.parse(JSON.stringify(built)), { ok: true, userId: 'ckuser01', body: { plan: 'pro', status, period_start: '2026-11-01T00:00:00.000Z', period_end: '2026-12-01T00:00:00.000Z', source: 'stripe', source_version: Date.UTC(2026, 10, 3, 14, 22, 5, 123) } }, `${status}: mapped`)
    assert.deepEqual(Object.keys(built.body), ['plan', 'status', 'period_start', 'period_end', 'source', 'source_version'], `${status}: the router's fields only (no plan_credits: D3 / P5)`)
  }
  assert.equal(lib.buildEntitlement(USER, SUB('active', { updatedAt: '2026-11-05T01:02:03.004Z' })).body.source_version, Date.parse('2026-11-05T01:02:03.004Z'), 'source_version is Subscription.updatedAt in ms (a string too)')
  for (const [tier, plan] of [['starter', 'starter'], ['pro', 'pro'], ['premium', 'premium'], ['max', 'premium']]) assert.equal(lib.buildEntitlement(USER, SUB('active', { tier })).body.plan, plan, `tier ${tier}`)
  const fail = (sub, user = USER) => lib.buildEntitlement(user, sub).reason
  assert.equal(fail(SUB('active', { tier: 'enterprise' })), 'unknown_plan'); assert.equal(fail(SUB('weird')), 'unknown_status'); assert.equal(fail(SUB('Active')), 'unknown_status')
  assert.equal(fail(SUB('active', { currentPeriodEnd: new Date('2027-11-01T00:00:00.000Z') })), 'period_too_long', 'a yearly period is not pushed (P3 monthly only; the router refuses > 32 days)')
  assert.equal(lib.buildEntitlement(USER, SUB('active', { currentPeriodStart: new Date(0 + Date.UTC(2026, 10, 1)), currentPeriodEnd: new Date(Date.UTC(2026, 10, 1) + 32 * 86400000) })).ok, true, '32 days exactly is pushed')
  assert.equal(fail(SUB('active', { currentPeriodEnd: new Date(Date.UTC(2026, 10, 1) + 32 * 86400000 + 1) })), 'period_too_long')
  assert.equal(fail(SUB('active', { currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z') })), 'invalid_period'); assert.equal(fail(SUB('active', { updatedAt: 'not a date' })), 'invalid_version')
  for (const id of ['', 'a b', 'é1', '-x', 'x'.repeat(256), null]) assert.equal(lib.buildEntitlement({ ...USER, id }, SUB('active')).reason, 'invalid_user_id', `user id ${JSON.stringify(id)?.slice(0, 20)}`)
  // Free and no subscription
  for (const tier of ['free', null, undefined]) assert.deepEqual(JSON.parse(JSON.stringify(lib.buildEntitlement({ id: 'ckfree1', tier, updatedAt: new Date('2026-11-02T00:00:00.000Z') }, null, 'signup'))), { ok: true, userId: 'ckfree1', body: { plan: 'free', status: 'active', source: 'signup', source_version: Date.UTC(2026, 10, 2) } }, `no subscription, tier ${tier}: Free at User.updatedAt ms, no period (the router's UTC month)`)
  assert.equal(lib.buildEntitlement({ id: 'ckcoupon', tier: 'starter', updatedAt: new Date() }, null).reason, 'tier_without_subscription', 'a paid account tier with no subscription (a coupon) is not pushed as Free')
}
async function provePushFlagOff(text = SRC[ENT_LIB]) {
  for (const spelling of SPELLINGS.filter(s => s !== 'true')) {
    const { reads, env } = recordingEnv({ ...(spelling === undefined ? {} : { STUDIO_ROUTER_ENTITLEMENTS_PUSH: spelling }), MODEL_ROUTER_URL: ROUTER, MODEL_ROUTER_BILLING_KEY: RK })
    const w = entWorld({ env, text })
    const built = w.lib.buildEntitlement(USER, SUB('active'))
    assert.deepEqual(reads, [], 'building reads no environment value')
    for (const run of [() => w.lib.pushEntitlement(built), () => w.lib.pushEntitlementForUser(USER.id, 'signup'), () => w.lib.pushEntitlementAfterStripeEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_A1' } } })]) {
      reads.length = 0
      assert.deepEqual(JSON.parse(JSON.stringify(await run())), { skipped: true, reason: 'flag_off' }, `flag ${JSON.stringify(spelling)}: skipped`)
      assert.deepEqual(reads, ['STUDIO_ROUTER_ENTITLEMENTS_PUSH'], `flag ${JSON.stringify(spelling)}: the flag is the only environment value read`)
    }
    assert.equal(w.fetches.length, 0, 'no request'); assert.equal(w.dbCalls.length, 0, 'no database read'); assert.deepEqual(w.logs, [], 'nothing logged (the caller behaves as today)')
  }
}
async function provePushHappy(text = SRC[ENT_LIB]) {
  const w = entWorld({ text }), built = w.lib.buildEntitlement({ ...USER, id: 'ck:u.1_2-3' }, SUB('past_due'))
  const out = await w.lib.pushEntitlement(built)
  assert.deepEqual(JSON.parse(JSON.stringify(out)), { skipped: false, ok: true, applied: true, reason: null, storedVersion: 1 })
  assert.equal(w.fetches.length, 1); const { url, init } = w.fetches[0]
  assert.equal(url, `${ROUTER}/v1/entitlements/ck%3Au.1_2-3`, 'PUT {router}/v1/entitlements/{encoded id}, no query')
  assert.equal(init.method, 'PUT'); assert.deepEqual(JSON.parse(JSON.stringify(init.headers)), { Authorization: `Bearer ${RK}`, 'Content-Type': 'application/json', Accept: 'application/json' }, 'the key only in Authorization: Bearer')
  assert.equal(init.body, JSON.stringify(built.body)); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error', 'a redirect is never followed'); assert.ok(init.signal instanceof AbortSignal, 'a timeout signal')
  assert.equal(w.lib.PUSH_TIMEOUT_MS, 5000)
  for (const base of [`${ROUTER}/`, `${ROUTER}/v1`, `${ROUTER}/v1/`]) { const v = entWorld({ env: { ...F3_ON, MODEL_ROUTER_URL: base }, text }); await v.lib.pushEntitlement(built); assert.equal(v.fetches[0].url, `${ROUTER}/v1/entitlements/ck%3Au.1_2-3`, `base ${base}`) }
}
async function provePushAnswers(text = SRC[ENT_LIB]) {
  const built = entWorld({ text }).lib.buildEntitlement(USER, SUB('active'))
  const CASES = [
    [answer(200, { applied: false, reason: 'stale', stored_version: 9 }), { skipped: false, ok: true, applied: false, reason: 'stale', storedVersion: 9 }],
    [answer(200, { applied: false, reason: 'replay', stored_version: 9 }), { skipped: false, ok: true, applied: false, reason: 'replay', storedVersion: 9 }],
    [answer(200, 'not json'), { skipped: false, ok: false, error: 'malformed', status: 200, code: null }],
    [answer(200, { applied: 'yes' }), { skipped: false, ok: false, error: 'malformed', status: 200, code: null }],
    [answer(409, { error: { code: 'version_conflict', message: 'x' } }), { skipped: false, ok: false, error: 'version_conflict', status: 409, code: 'version_conflict' }],
    [answer(413, { error: { code: 'request_too_large' } }), { skipped: false, ok: false, error: 'too_large', status: 413, code: 'request_too_large' }],
    [answer(422, { error: { code: 'future_version' } }), { skipped: false, ok: false, error: 'refused', status: 422, code: 'future_version' }],
    [answer(422, { error: { code: 'Bad Code With Spaces' } }), { skipped: false, ok: false, error: 'refused', status: 422, code: null }],
    [answer(401, {}), { skipped: false, ok: false, error: 'unauthorized', status: 401, code: null }],
    [answer(404, {}), { skipped: false, ok: false, error: 'not_ready', status: 404, code: null }],
    [answer(403, {}), { skipped: false, ok: false, error: 'unauthorized', status: 403, code: null }],
    [answer(503, { error: { code: 'entitlement_store_unavailable' } }), { skipped: false, ok: false, error: 'unavailable', status: 503, code: 'entitlement_store_unavailable' }],
    [answer(500, 'boom'), { skipped: false, ok: false, error: 'unexpected', status: 500, code: null }],
    [answer(200, 'x'.repeat(70000)), { skipped: false, ok: false, error: 'malformed', status: 200, code: null }],
    [() => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }) }, { skipped: false, ok: false, error: 'timeout', status: null, code: null }],
    [() => { throw new TypeError('fetch failed') }, { skipped: false, ok: false, error: 'network', status: null, code: null }],
  ]
  for (const [reply, want] of CASES) {
    const w = entWorld({ text, reply: typeof reply === 'function' ? reply : () => reply })
    const out = await w.lib.pushEntitlement(built)
    assert.deepEqual(JSON.parse(JSON.stringify(out)), want, JSON.stringify(want))
    assert.ok(!JSON.stringify(out).includes(RK) && !w.logs.join('\n').includes(RK), 'the key is in no outcome and no log')
  }
  // unconfigured: no default, no production host
  for (const env of [{ STUDIO_ROUTER_ENTITLEMENTS_PUSH: 'true', MODEL_ROUTER_BILLING_KEY: RK, STRIPE_REAL_TIER_MAPPING_ENABLED: 'true' }, { ...F3_ON, MODEL_ROUTER_URL: '' }, { ...F3_ON, MODEL_ROUTER_URL: '   ' }, { ...F3_ON, MODEL_ROUTER_URL: 'router.example.test' }, { ...F3_ON, MODEL_ROUTER_URL: 'ftp://router.example.test' }, { ...F3_ON, MODEL_ROUTER_BILLING_KEY: '' }, { ...F3_ON, MODEL_ROUTER_BILLING_KEY: 'short' }]) {
    const w = entWorld({ env, text })
    assert.deepEqual(JSON.parse(JSON.stringify(await w.lib.pushEntitlement(built))), { skipped: false, ok: false, error: 'unconfigured', status: null, code: null }, `unconfigured: ${JSON.stringify(Object.keys(env))} ${JSON.stringify(env.MODEL_ROUTER_URL ?? null)}`)
    assert.equal(w.fetches.length, 0, 'nothing is sent anywhere: no production fallback')
  }
  const w = entWorld({ text }); assert.deepEqual(JSON.parse(JSON.stringify(await w.lib.pushEntitlement({ ok: false, reason: 'unknown_plan' }))), { skipped: true, reason: 'unknown_plan' }, 'a build failure is skipped, not sent'); assert.equal(w.fetches.length, 0)
  const src = code(text)
  assert.match(src, /import \{ requireServiceUrl, ServiceUrlConfigError \} from '@\/lib\/service-url'/, 'the no-fallback helper'); assert.match(src, /requireServiceUrl\('Model Router', \[\{ name: 'MODEL_ROUTER_URL', value: process\.env\.MODEL_ROUTER_URL \}\]/, 'one candidate, the router address, no alias')
  assert.doesNotMatch(src, /https?:\/\/|railway\.app|\|\|\s*['"`]|\?\?\s*['"`]https?/, 'no host literal and no fallback anywhere in the library')
  assert.doesNotMatch(src, /NEXT_PUBLIC_/, 'the library reads no NEXT_PUBLIC_ name'); assert.equal(count(src, 'process.env.MODEL_ROUTER_BILLING_KEY'), 1, 'the key is read once, by its server-only name (MODEL_ROUTER_BILLING_KEY, ROUTER-2\'s)'); assert.doesNotMatch(src, new RegExp(['ROUTER', 'ENTITLEMENTS', 'API', 'KEY'].join('_')), 'the old name is gone')
}
async function proveCancelPickAndMapping(text = SRC[ENT_LIB]) {
  const { lib } = entWorld({ text })
  const at = new Date('2026-11-08T07:00:00.000Z')
  assert.deepEqual(JSON.parse(JSON.stringify(lib.buildCancelEntitlement('ckuser01', at))), { ok: true, userId: 'ckuser01', body: { plan: 'free', status: 'canceled', source: 'cancel', source_version: at.getTime() } }, 'a cancel is status canceled, source cancel, stamped with the moment in ms (a JSON integer)')
  assert.equal(Number.isInteger(lib.buildCancelEntitlement('ckuser01', at).body.source_version), true)
  assert.equal(lib.buildCancelEntitlement('bad id', at).reason, 'invalid_user_id'); assert.equal(lib.buildCancelEntitlement('ckuser01', new Date('nope')).reason, 'invalid_version')
  assert.equal(lib.buildEntitlement(USER, SUB('active'), 'backfill').body.source, 'backfill', 'backfill is a source value')
  const row = (status, day) => ({ status, updatedAt: new Date(Date.UTC(2026, 10, day)) })
  const pick = rows => { const got = lib.pickSubscription(rows); return got ? `${got.status}@${got.updatedAt.getUTCDate()}` : null }
  assert.equal(pick([row('canceled', 9), row('active', 3)]), 'active@3', 'a newer canceled row (a late deletion of an OLD subscription) does not hide the live one')
  assert.equal(pick([row('active', 3), row('trialing', 5)]), 'trialing@5', 'the newest live row'); assert.equal(pick([row('past_due', 2), row('incomplete', 8)]), 'past_due@2', 'past_due is live')
  assert.equal(pick([row('canceled', 2), row('incomplete_expired', 8)]), 'incomplete_expired@8', 'no live row: the newest of any status'); assert.equal(pick([]), null); assert.equal(pick(null), null)
  // the real-tier mapping guard: while the webhook writes "pro" for everyone, a live paid plan is not pushed
  const off = { ...F3_ON, STRIPE_REAL_TIER_MAPPING_ENABLED: 'false' }
  for (const status of ['active', 'trialing', 'past_due']) { const w = entWorld({ env: off, text }); assert.deepEqual(JSON.parse(JSON.stringify(await w.lib.pushEntitlement(w.lib.buildEntitlement(USER, SUB(status))))), { skipped: true, reason: 'tier_mapping_off' }, `${status}: skipped`); assert.equal(w.fetches.length, 0) }
  for (const built of [lib.buildEntitlement({ id: 'ckfree1', tier: 'free', updatedAt: at }, null), lib.buildEntitlement(USER, SUB('canceled')), lib.buildCancelEntitlement('ckuser01', at)]) { const w = entWorld({ env: off, text }); assert.equal((await w.lib.pushEntitlement(built)).ok, true, `${built.body.plan}/${built.body.status}: still pushed (the router reads it as Free)`); assert.equal(w.fetches.length, 1) }
  const { reads, env } = recordingEnv({ STUDIO_ROUTER_ENTITLEMENTS_PUSH: 'false', STRIPE_REAL_TIER_MAPPING_ENABLED: 'false' }); const w = entWorld({ env, text }); await w.lib.pushEntitlement(lib.buildEntitlement(USER, SUB('active'))); assert.deepEqual(reads, ['STUDIO_ROUTER_ENTITLEMENTS_PUSH'], 'the guard is read only after the flag')
  assert.match(text, /TODO \(no job exists yet\)/, 'the nightly re-push is marked as a TODO, not claimed'); assert.doesNotMatch(text, /the nightly re-push and the reconcile repair a missed one/)
  assert.match(text, /Yearly subscriptions are NOT pushed \(P3/, 'yearly is documented')
}
async function proveWrappers(text = SRC[ENT_LIB]) {
  const w = entWorld({ text })
  const out = await w.lib.pushEntitlementForUser(USER.id, 'signup')
  assert.equal(out.ok, true); assert.deepEqual(w.dbCalls.map(c => c[0]), ['user.findUnique', 'subscription.findMany'], 'reads the person, then their subscriptions'); assert.equal(JSON.parse(w.fetches[0].init.body).status, 'active', 'the live row is pushed, not a newer canceled one (review MINOR 6)')
  assert.deepEqual(JSON.parse(JSON.stringify(w.dbCalls[1][1])), { where: { userId: USER.id }, orderBy: { updatedAt: 'desc' }, take: 20, select: { status: true, tier: true, currentPeriodStart: true, currentPeriodEnd: true, updatedAt: true } })
  assert.equal(JSON.parse(w.fetches[0].init.body).source, 'signup'); assert.deepEqual(w.logs, ['[router-entitlements] user=ckuser01 source=signup outcome=applied'], 'one log line: the id, the source, the outcome')
  const unknown = entWorld({ text }); assert.equal((await unknown.lib.pushEntitlementForUser('nobody1', 'signup')).reason, 'unknown_user'); assert.equal(unknown.fetches.length, 0); assert.deepEqual(unknown.logs, ['[router-entitlements] user=nobody1 source=signup outcome=skipped:unknown_user'])
  const bad = entWorld({ text }); assert.equal((await bad.lib.pushEntitlementForUser('bad id', 'signup')).reason, 'invalid_user_id'); assert.equal(bad.dbCalls.length, 0, 'an invalid id is not looked up'); assert.match(bad.logs[0], /user=invalid /)
  const down = entWorld({ text, db: { user: { findUnique: async () => { throw new Error('db down: a driver message') } }, subscription: {} } })
  assert.deepEqual(JSON.parse(JSON.stringify(await down.lib.pushEntitlementForUser(USER.id, 'stripe'))), { skipped: false, ok: false, error: 'failed', status: null, code: null }, 'a database failure is an outcome, never a throw'); assert.doesNotMatch(down.logs.join('\n'), /driver message/, 'and its text is not logged')
  // the webhook helper
  const ev = (type, object) => ({ type, data: { object } })
  const EVENTS = [
    [ev('customer.subscription.created', { id: 'sub_A1' }), 'sub_A1'], [ev('customer.subscription.updated', { id: 'sub_A1' }), 'sub_A1'], [ev('customer.subscription.deleted', { id: 'sub_A1' }), 'sub_A1'],
    [ev('invoice.payment_succeeded', { subscription: 'sub_A1' }), 'sub_A1'], [ev('invoice.payment_failed', { subscription: { id: 'sub_A1' } }), 'sub_A1'],
    [ev('checkout.session.completed', { mode: 'subscription', subscription: 'sub_A1' }), 'sub_A1'], [ev('checkout.session.completed', { mode: 'payment', metadata: { kind: 'wallet_topup' } }), null],
    [ev('charge.refunded', { id: 'ch_1' }), null], [ev('customer.subscription.updated', { id: 'not-a-sub' }), null],
  ]
  for (const [event, id] of EVENTS) assert.equal(w.lib.stripeSubscriptionIdOf(event), id, event.type)
  const s = entWorld({ text }); const sOut = await s.lib.pushEntitlementAfterStripeEvent(EVENTS[2][0])
  assert.equal(sOut.ok, true); assert.deepEqual(s.dbCalls.map(c => c[0]), ['subscription.findUnique', 'user.findUnique', 'subscription.findMany']); assert.equal(JSON.parse(s.fetches[0].init.body).source, 'stripe')
  for (const [event, reason] of [[EVENTS[7][0], 'not_an_entitlement_event'], [EVENTS[6][0], 'no_subscription'], [ev('customer.subscription.updated', { id: 'sub_ZZ' }), 'unknown_subscription']]) {
    const x = entWorld({ text }); assert.equal((await x.lib.pushEntitlementAfterStripeEvent(event)).reason, reason, reason); assert.equal(x.fetches.length, 0)
  }
}
/** Every app file a browser bundle can hold: components/, and any file whose first statement is "use client". None may name a server key, import the push library or the meter route, or use a NEXT_PUBLIC_ name for a key. */
const CLIENT_DIRECTIVE = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*['"]use client['"]/
function appFiles() {
  const files = new Map()
  for (const rel of git('ls-files', '-z', '--', 'app', 'components', 'lib', 'hooks').split('\0').filter(Boolean).concat(S.BILLING_L5_NEW_FILES.filter(rel => /^(app|components|lib|hooks)\//.test(rel)))) {
    if (!/\.(tsx?|jsx?|mjs)$/.test(rel) || files.has(rel)) continue
    try { files.set(rel, read(rel)) } catch { /* deleted in the tree */ }
  }
  return files
}
const APP_FILES = appFiles()
function proveNoKeyInClient(files = APP_FILES) {
  let clients = 0
  for (const [rel, text] of files) {
    for (const name of S.BILLING_L5_KEY_NAMES) assert.ok(!text.includes(`NEXT_PUBLIC_${name}`), `${rel}: no NEXT_PUBLIC_ form of ${name}`)
    if (!(rel.startsWith('components/') || CLIENT_DIRECTIVE.test(text))) continue
    clients++
    for (const name of S.BILLING_L5_KEY_NAMES) assert.ok(!text.includes(name), `${rel} (a client file) does not name ${name}`)
    assert.ok(!/router-entitlements|api\/internal\/meter|['"]@\/lib\/wallet['"]/.test(text), `${rel} (a client file) imports neither the push library, the meter route nor the wallet`)
  }
  assert.ok(clients > 50, `a real sweep (${clients} client files)`)
  assert.ok(!CLIENT_DIRECTIVE.test(files.get(ENT_LIB)) && !CLIENT_DIRECTIVE.test(files.get(ROUTE)), 'the push library and the meter route are not client files')
  assert.match(files.get(ENT_LIB), /from '@\/lib\/prisma'/, 'the push library imports the database client (it cannot be bundled for a browser)')
}
async function proveBackfill(text = read(BACKFILL), libText = SRC[ENT_LIB]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl5-backfill-')), file = path.join(dir, 'b.mjs'), link = path.join(dir, 'node_modules')
  try {
    fs.symlinkSync(path.join(root, 'node_modules'), link) // so the copy resolves typescript as the real script does
    fs.writeFileSync(file, text)
    const mod = await import(`${pathToFileURL(file).href}?v=${sha(text + libText)}`)
    const ACCOUNTS = [
      { cohort: 'qa', user: { id: 'ckqa1', tier: 'pro', updatedAt: '2026-11-01T00:00:00Z' }, subscription: { status: 'active', tier: 'pro', currentPeriodStart: '2026-11-01T00:00:00Z', currentPeriodEnd: '2026-12-01T00:00:00Z', updatedAt: '2026-11-03T00:00:00Z' } },
      { cohort: 'qa', user: { id: 'ckqa2', tier: 'free', updatedAt: '2026-11-02T00:00:00Z' }, subscription: null },
      { cohort: 'qa', user: { id: 'ckqa3', tier: 'pro', updatedAt: '2026-11-02T00:00:00Z' }, subscription: { status: 'active', tier: 'pro', currentPeriodStart: '2026-11-01T00:00:00Z', currentPeriodEnd: '2027-11-01T00:00:00Z', updatedAt: '2026-11-03T00:00:00Z' } },
      { cohort: 'real', user: { id: 'ckreal', tier: 'pro', updatedAt: '2026-11-02T00:00:00Z' }, subscription: null },
      { user: { id: 'cknocohort', tier: 'free', updatedAt: '2026-11-02T00:00:00Z' } },
      null,
    ]
    const readSource = rel => (rel === ENT_LIB ? libText : read(rel))
    const run = async (argv, envValues) => {
      const out = [], err = [], fetches = [], rec = recordingEnv(envValues)
      let rc
      try { rc = await mod.main(argv, { env: rec.env, fetchImpl: async (u, i) => { fetches.push({ u, i }); return answer(200, { applied: true, stored_version: 1 }) }, readFile: () => JSON.stringify(ACCOUNTS), out: l => out.push(l), err: l => err.push(l), readSource }) } catch (error) { rc = `threw: ${error?.message}` }
      return { rc, out, err, fetches, reads: rec.reads }
    }
    const dry = await run(['--accounts', 'qa.json'], { STUDIO_ROUTER_ENTITLEMENTS_PUSH: 'true', MODEL_ROUTER_URL: ROUTER, MODEL_ROUTER_BILLING_KEY: RK })
    assert.equal(dry.rc, 0)
    assert.deepEqual(dry.out, [
      `PLAN PUT /v1/entitlements/ckqa1 {"plan":"pro","status":"active","period_start":"2026-11-01T00:00:00.000Z","period_end":"2026-12-01T00:00:00.000Z","source":"backfill","source_version":${Date.parse('2026-11-03T00:00:00Z')}}`,
      `PLAN PUT /v1/entitlements/ckqa2 {"plan":"free","status":"active","source":"backfill","source_version":${Date.parse('2026-11-02T00:00:00Z')}}`,
      'SKIP ckqa3 period_too_long',
      'DRY RUN: 2 planned, 1 skipped, 3 not in cohort qa; nothing was sent',
    ], 'the dry run prints the planned PUTs for cohort qa only')
    assert.deepEqual(dry.reads, [], 'the dry run reads NO environment value (not even the flag)'); assert.equal(dry.fetches.length, 0, 'and sends nothing'); assert.ok(!dry.out.join('\n').includes(RK))
    const noFlag = await run(['--accounts', 'qa.json', '--apply'], { MODEL_ROUTER_URL: ROUTER, MODEL_ROUTER_BILLING_KEY: RK })
    assert.equal(noFlag.rc, 3, '--apply without the flag is refused'); assert.equal(noFlag.fetches.length, 0); assert.deepEqual(noFlag.out, []); assert.deepEqual(noFlag.reads, ['STUDIO_ROUTER_ENTITLEMENTS_PUSH'])
    const flagOnly = await run(['--accounts', 'qa.json'], { STUDIO_ROUTER_ENTITLEMENTS_PUSH: 'true' }); assert.equal(flagOnly.fetches.length, 0, 'the flag without --apply sends nothing')
    const apply = await run(['--accounts', 'qa.json', '--apply'], { STUDIO_ROUTER_ENTITLEMENTS_PUSH: 'true', MODEL_ROUTER_URL: ROUTER, MODEL_ROUTER_BILLING_KEY: RK, STRIPE_REAL_TIER_MAPPING_ENABLED: 'true' })
    assert.equal(apply.rc, 0); assert.equal(apply.fetches.length, 2, 'with --apply AND the flag: one PUT per planned entitlement'); assert.deepEqual(apply.fetches.map(f => f.u), [`${ROUTER}/v1/entitlements/ckqa1`, `${ROUTER}/v1/entitlements/ckqa2`])
    assert.equal(apply.out.at(-1), 'APPLIED: 2 planned, 1 skipped, 3 not in cohort qa, 2 pushed, 0 not pushed'); assert.ok(!apply.out.join('\n').includes(RK), 'the key is never printed')
    assert.equal((await run([], {})).rc, 2, 'no accounts file: usage'); assert.equal((await run(['--accounts', 'x', '--bogus'], {})).rc, 2)
    assert.doesNotMatch(code(text), /prisma\.|PrismaClient|@prisma\/client|DATABASE_URL/, 'the script never reaches a database')
  } finally { try { fs.unlinkSync(link) } catch { /* not made */ } fs.rmSync(dir, { recursive: true, force: true }) }
}
await check('F3 the 7 stored Stripe statuses (and Stripe\'s paused) map in a table; source_version is Subscription.updatedAt in ms; the body is the router\'s (no plan_credits); yearly, unknown plan or status, a bad id, a coupon tier with no subscription are not pushed; Free has no period', () => proveStatusTable())
await check('F3 flag off: pushEntitlement, pushEntitlementForUser and pushEntitlementAfterStripeEvent return { skipped: true } having read ONLY the flag (a Proxy on process.env), with no database read, no request and no log', () => provePushFlagOff())
await check('F3 flag on: PUT {router}/v1/entitlements/{encoded id}, Bearer key only in Authorization, the body as built, no-store, no redirect, a 5 s timeout; a /v1 or trailing slash on the address is not doubled', () => provePushHappy())
await check('F3 every router answer is a typed outcome and nothing throws (stale, replay, malformed, 409, 413, 422 with its code, 401/403, 503, 500, oversize, timeout, network); unconfigured or unusable address or key sends nothing (no production fallback); the source uses requireServiceUrl with one candidate', () => provePushAnswers())
await check('F3 the wrappers: one person and their most relevant subscription are read, pushed and logged in one line (id, source, outcome); unknown and invalid ids, a database failure; the webhook helper finds the subscription id of each plan event and skips top-ups and other events', () => proveWrappers())
await check('F3 ROUTER-2\'s answers and the review: a cancel is status canceled in `source` cancel (epoch-ms integer); backfill is a source value; the live subscription row wins over a newer canceled one; a router 404 is "not ready"; a live paid plan is not pushed while the real-tier mapping is off (read after the flag); the nightly re-push is a TODO; yearly documented', () => proveCancelPickAndMapping())
await check('F3 the key names appear in no client file ("use client" files and components/), nowhere as a NEXT_PUBLIC_ name, and no client file imports the push library, the meter route or the wallet', () => proveNoKeyInClient())
await check('F3 the backfill: a dry run prints the planned PUTs for cohort qa only and reads no environment value and sends nothing; --apply without the flag is refused; only --apply AND the flag push; the key is never printed; no database code', () => proveBackfill())

// ===== 4. F4: the meter receiver ====================================================================================================================================================
console.log('4. F4 meter receiver')
const MW = 'mw-test-01' // a made-up signing word: never a real one
const NEXT_SERVER = { NextResponse: { json: (body, init = {}) => ({ status: init.status ?? 200, body: JSON.parse(JSON.stringify(body)), headers: JSON.parse(JSON.stringify(init.headers ?? {})) }) } }
class InsufficientFundsError extends Error {}
function walletStub(behaviour = 'ok') {
  const calls = [], ledger = new Map(), charged = [], credited = []
  const module = {
    InsufficientFundsError,
    creditWallet: async params => { credited.push(JSON.parse(JSON.stringify(params))); return { transactionId: 'c1', balanceAfterCents: 1000 + params.amountCents } },
    debitWallet: async params => {
      calls.push(JSON.parse(JSON.stringify(params)))
      if (behaviour === 'insufficient') throw new InsufficientFundsError('x')
      if (behaviour === 'missing') throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' })
      if (behaviour === 'down') throw new Error('db down')
      if (ledger.has(params.sourceRef)) return ledger.get(params.sourceRef) // the helper's own idempotency: an existing sourceRef is returned, nothing is charged again
      charged.push(params.amountCents)
      const row = { transactionId: `t${ledger.size + 1}`, balanceAfterCents: 1000 - params.amountCents }
      ledger.set(params.sourceRef, row)
      return row
    },
  }
  return { calls, ledger, charged, credited, module }
}
const EVENT = { event_id: '0b9c2f3e-1d2c-4a5b-9e8f-7a6b5c4d3e2f', generation_id: 'gen-1', user_id: 'ckuser01', session_id: 's-1', service: 'text-service', task: 'slide_content', model_served: 'some-model', status: 'success', ts: '2026-11-08T00:00:00Z', tokens_in: 10, tokens_out: 5, provider_cost_usd: '0.0001230000', margin_multiplier: '2.0', billable_usd: '0.0002460000', deckster_tokens: '24.600000', from_topup: '12.000000', future_key: { nested: true } }
const nowS = () => Math.floor(Date.now() / 1000)
const sign = (raw, stamp, word = MW) => `sha256=${crypto.createHmac('sha256', word).update(`${stamp}.`).update(raw).digest('hex')}`
const M_ON = extra => ({ STUDIO_METER_RECEIVER_ENABLED: 'true', METER_WEBHOOK_SECRET: MW, ...extra })
const APPLY = extra => M_ON({ METER_RECEIVER_MODE: 'apply', WALLET_DEBIT_SOURCE: 'router', ...extra })
const signed = (event = EVENT, { stamp = String(nowS()), word = MW, raw } = {}) => { const body = raw ?? JSON.stringify(event); return { body, headers: { 'content-type': 'application/json', 'x-mr-timestamp': stamp, 'x-mr-signature': sign(body, stamp, word) } } }
async function runRoute({ env = M_ON(), text = SRC[ROUTE], wallet = walletStub(), body, headers = {}, request, globals = {} } = {}) {
  const required = [], logs = []
  const route = makeLoader({ env, texts: { [ROUTE]: text }, overrides: { 'next/server': NEXT_SERVER, '@/lib/wallet': wallet.module }, globals: { console: recorder(logs), ...globals }, required })(ROUTE)
  const req = request ?? new Request('https://studio.example.test/api/internal/meter', { method: 'POST', headers, body })
  const res = await route.POST(req)
  return { res, required, logs, wallet, exports: Object.keys(route).sort() }
}
const LOG_LINE = /^\[meter-receiver\] event=(?:-|[A-Za-z0-9][A-Za-z0-9._:-]{0,127}) mode=(?:receipt_only|apply) outcome=[a-z_:]+$/
const allLogs = []
const keepLogs = r => { allLogs.push(...r.logs); return r }

async function proveFlagOff(text = SRC[ROUTE]) {
  for (const spelling of SPELLINGS.filter(s => s !== 'true')) {
    const touched = [], rec = recordingEnv({ ...(spelling === undefined ? {} : { STUDIO_METER_RECEIVER_ENABLED: spelling }), METER_WEBHOOK_SECRET: MW, METER_RECEIVER_MODE: 'apply', WALLET_DEBIT_SOURCE: 'router' })
    const request = { headers: { get: name => { touched.push(`header:${name}`); return null } }, arrayBuffer: async () => { touched.push('body'); return new ArrayBuffer(0) } }
    const r = keepLogs(await runRoute({ env: rec.env, text, request }))
    assert.deepEqual(r.res, { status: 404, body: { error: 'Not found' }, headers: { 'Cache-Control': 'no-store' } }, `flag ${JSON.stringify(spelling)}: 404`)
    assert.deepEqual(touched, [], 'no header and no body is read'); assert.deepEqual(rec.reads, ['STUDIO_METER_RECEIVER_ENABLED'], 'the flag is the only environment value read')
    assert.ok(!r.required.includes('@/lib/wallet'), 'the wallet module is not loaded'); assert.deepEqual(r.logs, [], 'nothing is logged')
  }
  const r = await runRoute({ text }); assert.deepEqual(r.exports, ['POST', 'dynamic'], 'POST only (and dynamic): no GET, no other method, no helper export a Next route would refuse')
}
async function proveSignatures(text = SRC[ROUTE]) {
  const good = signed()
  const ok = keepLogs(await runRoute({ text, ...good }))
  assert.deepEqual(ok.res.body, { received: true, applied: false }, 'the right signature over the same bytes: 200, receipt only'); assert.equal(ok.res.status, 200)
  const caps = keepLogs(await runRoute({ text, body: good.body, headers: { 'Content-Type': 'application/json', 'X-MR-Timestamp': good.headers['x-mr-timestamp'], 'X-MR-Signature': good.headers['x-mr-signature'] } }))
  assert.equal(caps.res.status, 200, 'the router\'s spelling, X-MR-Timestamp and X-MR-Signature (header names are case-insensitive)')
  const flipped = good.body.replace('"12.000000"', '"13.000000"'); assert.equal(flipped.length, good.body.length); assert.equal([...flipped].filter((c, i) => c !== good.body[i]).length, 1, 'exactly one byte differs')
  const sig = good.headers['x-mr-signature'], stamp = good.headers['x-mr-timestamp']
  const BAD = [
    ['one changed byte, same signature', { body: flipped, headers: good.headers }],
    ['one extra space, same signature', { body: `${good.body} `, headers: good.headers }],
    ['missing signature', { body: good.body, headers: { 'x-mr-timestamp': stamp } }],
    ['missing timestamp', { body: good.body, headers: { 'x-mr-signature': sig } }],
    ['no headers at all', { body: good.body, headers: {} }],
    ['the signature under another header name (X-Signature)', { body: good.body, headers: { 'x-mr-timestamp': stamp, 'x-signature': sig } }],
    ['the timestamp under another header name (X-Timestamp)', { body: good.body, headers: { 'x-timestamp': stamp, 'x-mr-signature': sig } }],
    ['a random signature', { body: good.body, headers: { ...good.headers, 'x-mr-signature': `sha256=${'ab'.repeat(32)}` } }],
    ['the hex in capitals', { body: good.body, headers: { ...good.headers, 'x-mr-signature': `sha256=${sig.slice(7).toUpperCase()}` } }],
    ['no sha256= prefix', { body: good.body, headers: { ...good.headers, 'x-mr-signature': sig.slice(7) } }],
    ['an upper-case SHA256= prefix', { body: good.body, headers: { ...good.headers, 'x-mr-signature': `SHA256=${sig.slice(7)}` } }],
    ['a sha1= prefix', { body: good.body, headers: { ...good.headers, 'x-mr-signature': `sha1=${sig.slice(7)}` } }],
    ['a short signature', { body: good.body, headers: { ...good.headers, 'x-mr-signature': sig.slice(0, -2) } }],
    ['signed with another word', signed(EVENT, { word: 'other-word' })],
    ['re-timestamped (same body and signature, another time)', { body: good.body, headers: { ...good.headers, 'x-mr-timestamp': String(Number(stamp) + 1) } }],
    ['signed 320 s ago', signed(EVENT, { stamp: String(nowS() - 320) })],
    ['signed 320 s ahead', signed(EVENT, { stamp: String(nowS() + 320) })],
    ['a timestamp that is not seconds', signed(EVENT, { stamp: `${nowS()}.5` })],
  ]
  for (const [label, req] of BAD) {
    const wallet = walletStub(), r = keepLogs(await runRoute({ text, env: APPLY(), wallet, ...req }))
    assert.deepEqual(r.res, { status: 401, body: { error: 'invalid_signature' }, headers: { 'Cache-Control': 'no-store' } }, `${label}: 401`)
    assert.equal(wallet.calls.length, 0, `${label}: nothing applied`); assert.ok(!r.required.includes('@/lib/wallet'), `${label}: the wallet is not even loaded`)
  }
  for (const s of [String(nowS() - 280), String(nowS() + 280)]) assert.equal((await runRoute({ text, ...signed(EVENT, { stamp: s }) })).res.status, 200, 'inside the 300 s window: accepted')
  const unset = await runRoute({ text, env: { STUDIO_METER_RECEIVER_ENABLED: 'true' }, ...good }); assert.deepEqual(unset.res.body, { error: 'meter_receiver_unconfigured' }); assert.equal(unset.res.status, 503, 'no secret: 503 (the router retries; nothing is dead-lettered)')
  const big = signed(EVENT, { raw: JSON.stringify({ ...EVENT, pad: 'x'.repeat(17000) }) }); assert.equal((await runRoute({ text, ...big })).res.status, 413, 'an oversize body (before any signature is known valid): 413')
  const src = code(text)
  assert.match(src, /const TIMESTAMP_HEADER = 'x-mr-timestamp'/); assert.match(src, /const SIGNATURE_HEADER = 'x-mr-signature'/); assert.match(src, /const SIGNATURE_PREFIX = 'sha256='/); assert.match(src, /const SIGNATURE = \/\^sha256=\[0-9a-f\]\{64\}\$\//, 'exactly the router\'s header names and the sha256= prefix with lowercase hex')
  assert.match(src, /request\.headers\.get\(TIMESTAMP_HEADER\), request\.headers\.get\(SIGNATURE_HEADER\)/)
  assert.match(src, /import \{ createHmac, timingSafeEqual \} from 'node:crypto'/); assert.match(src, /given\.length === expected\.length && timingSafeEqual\(given, expected\)/, 'the comparison is crypto.timingSafeEqual over equal-length digests')
  assert.doesNotMatch(src, /signature\s*===|===\s*signature|expected\s*===|===\s*expected\b(?!\.length)|\.equals\(|toString\('hex'\)\s*===/, 'no plain === or Buffer.equals comparison of a signature')
  assert.match(src, /\.update\(`\$\{timestamp\}\.`\)\.update\(raw\)/, 'the HMAC covers the timestamp and the RAW bytes, as received')
}
/**
 * A KNOWN-ANSWER vector, so the check does not only sign with the code it checks: HMAC-SHA256 over "1762560000." + KAT_BODY with the signing word MW gives the hex below. It was computed
 * once with Node (crypto.createHmac('sha256', word).update(ts + '.').update(raw).digest('hex')) and once with Python's hmac.new(word, ts + b'.' + raw, hashlib.sha256).hexdigest() (the router's
 * language), which agree: 375a69b48004033ed8139a17bfab86d15eea678c336ed12fe5ef3bdfc000f596. The route runs with its clock fixed at that second.
 */
const KAT_STAMP = '1762560000'
const KAT_BODY = '{"event_id":"kat-1","generation_id":null,"user_id":null,"status":"success"}'
const KAT_DIGEST = '375a69b48004033ed8139a17bfab86d15eea678c336ed12fe5ef3bdfc000f596'
class KatDate extends Date { static now() { return Number(KAT_STAMP) * 1000 + 1500 } }
async function proveKnownAnswer(text = SRC[ROUTE]) {
  assert.equal(crypto.createHmac('sha256', MW).update(`${KAT_STAMP}.`).update(KAT_BODY).digest('hex'), KAT_DIGEST, 'this Node agrees with the recorded vector')
  const headers = { 'x-mr-timestamp': KAT_STAMP, 'x-mr-signature': `sha256=${KAT_DIGEST}` }
  const r = keepLogs(await runRoute({ text, body: KAT_BODY, headers, globals: { Date: KatDate } }))
  assert.deepEqual(r.res.body, { received: true, applied: false }, 'the route accepts the recorded vector'); assert.equal(r.res.status, 200)
  assert.equal((await runRoute({ text, body: KAT_BODY.replace('kat-1', 'kat-2'), headers, globals: { Date: KatDate } })).res.status, 401, 'one byte off the recorded body: 401')
  assert.equal((await runRoute({ text, body: KAT_BODY, headers: { ...headers, 'x-mr-signature': `sha256=${KAT_DIGEST.slice(0, -1)}0` } , globals: { Date: KatDate } })).res.status, 401, 'one nibble off the recorded digest: 401')
}
/** ROUTER-2: once the signature is valid, no 4xx, ever (any 4xx dead-letters the event). Every mode x event x wallet behaviour answers 2xx or 503. */
const EVENT_TODAY = (() => { const { from_topup, ...today } = EVENT; return today })() // the router's payload today: no from_topup
const VARIANTS = [
  ['today\'s event (no from_topup)', EVENT_TODAY], ['from_topup null', { ...EVENT, from_topup: null }], ['zero', { ...EVENT, from_topup: '0.000000' }], ['sub-cent', { ...EVENT, from_topup: '0.018450' }],
  ['12.5 credits', { ...EVENT, from_topup: '12.500000' }], ['12 credits', EVENT], ['negative', { ...EVENT, from_topup: '-1.000000' }], ['an exponent', { ...EVENT, from_topup: '1E+3' }], ['a number', { ...EVENT, from_topup: 12 }],
  ['finer than six places', { ...EVENT, from_topup: '1.0000001' }], ['absurd', { ...EVENT, from_topup: '1000001.000000' }], ['no user', { ...EVENT, user_id: null }], ['a bad user id', { ...EVENT, user_id: 'a b' }],
  ['no generation id', { ...EVENT, generation_id: undefined }], ['unknown keys', { ...EVENT, future_key: [1, 2], another: 'x' }], ['no status or ts', { ...EVENT, status: undefined, ts: undefined }],
]
const MALFORMED = [['not JSON', '{nope'], ['an array', '[]'], ['no event_id', JSON.stringify({ ...EVENT, event_id: undefined })], ['a bad event_id', JSON.stringify({ ...EVENT, event_id: 'a b' })], ['null', 'null']]
async function proveNoFourXx(text = SRC[ROUTE]) {
  let runs = 0
  for (const [modeLabel, env] of [['receipt_only', M_ON()], ['apply, router', APPLY()], ['apply, flat', APPLY({ WALLET_DEBIT_SOURCE: 'flat' })]]) {
    for (const [label, event] of VARIANTS) for (const behaviour of ['ok', 'insufficient', 'missing', 'down']) {
      const r = keepLogs(await runRoute({ text, env, wallet: walletStub(behaviour), ...signed(event) })); runs++
      assert.ok(r.res.status === 200 || r.res.status === 503, `${modeLabel} / ${label} / wallet ${behaviour}: ${r.res.status} is 2xx or 503, never a 4xx`)
    }
    for (const [label, raw] of MALFORMED) {
      const r = keepLogs(await runRoute({ text, env, ...signed(EVENT, { raw }) })); runs++
      assert.deepEqual(r.res, { status: 503, body: { error: 'invalid_meter_event' }, headers: { 'Cache-Control': 'no-store' } }, `${modeLabel} / a signed body that is not an event (${label}): 503, not a 4xx`)
    }
  }
  assert.ok(runs > 200, `${runs} validly signed requests`)
}
async function proveReceiptOnly(text = SRC[ROUTE]) {
  for (const mode of [undefined, 'receipt_only', 'APPLY', 'apply ', ' apply', '1', 'true', 'applied']) {
    for (const source of [undefined, 'router']) {
      const wallet = walletStub(), r = keepLogs(await runRoute({ text, env: M_ON({ ...(mode === undefined ? {} : { METER_RECEIVER_MODE: mode }), ...(source ? { WALLET_DEBIT_SOURCE: source } : {}) }), wallet, ...signed() }))
      assert.deepEqual(r.res, { status: 200, body: { received: true, applied: false }, headers: { 'Cache-Control': 'no-store' } }, `mode ${JSON.stringify(mode)}: receipt only`)
      assert.equal(wallet.calls.length, 0, 'the wallet helper is never called'); assert.ok(!r.required.includes('@/lib/wallet'), 'the wallet module is never even loaded: receipt_only writes NOTHING')
      assert.deepEqual(r.logs, [`[meter-receiver] event=${EVENT.event_id} mode=receipt_only outcome=received`])
    }
  }
  for (const [label, event] of VARIANTS) {
    const wallet = walletStub(), r = keepLogs(await runRoute({ text, wallet, ...signed(event) }))
    assert.deepEqual(r.res.body, { received: true, applied: false }, `receipt_only, ${label}: 200 (an absent or odd optional field is fine)`); assert.equal(wallet.calls.length, 0)
  }
  const twice = walletStub(); for (let i = 0; i < 2; i++) assert.deepEqual((await runRoute({ text, wallet: twice, ...signed() })).res.body, { received: true, applied: false }, 'a duplicate is acknowledged too'); assert.equal(twice.calls.length, 0)
  assert.doesNotMatch(code(text), /^import .*@\/lib\/wallet/m, 'no static import of the wallet module'); assert.doesNotMatch(code(text), /prisma|\$transaction|CREATE |ALTER |INSERT |migration/i, 'no database client, no SQL, no migration in the route')
  assert.match(text, /Do NOT enable STUDIO_METER_RECEIVER_ENABLED until durable storage or apply exists/, 'the runbook says receipt_only must not be enabled before durable storage'); assert.match(text, /Do NOT set METER_RECEIVER_MODE=apply before the router's post-Sunday from_topup change/); assert.match(text, /OPS-2 runs the router's admin replay/)
}
async function proveApply(text = SRC[ROUTE]) {
  const wallet = walletStub()
  const first = keepLogs(await runRoute({ text, env: APPLY(), wallet, ...signed() })), again = keepLogs(await runRoute({ text, env: APPLY(), wallet, ...signed() }))
  for (const r of [first, again]) assert.deepEqual(r.res.body, { received: true, applied: true }, 'applied (and the replay is acknowledged as applied)')
  assert.deepEqual(wallet.calls, [0, 1].map(() => ({ userId: 'ckuser01', amountCents: 12, reason: 'token_usage', sourceRef: 'meter:gen-1', metadata: { source: 'meter', eventId: EVENT.event_id } })), 'the existing idempotent debitWallet, from_topup in cents (1 credit = 1 cent), sourceRef meter:<generation_id>, both times')
  assert.deepEqual(wallet.charged, [12], 'the same event twice charges ONCE (the helper\'s unique sourceRef)'); assert.deepEqual(wallet.credited, [], 'nothing is ever CREDITED: the top-up part is taken off the wallet')
  // dedupe: generation_id when present, otherwise event_id
  const sameGen = walletStub(); await runRoute({ text, env: APPLY(), wallet: sameGen, ...signed() }); await runRoute({ text, env: APPLY(), wallet: sameGen, ...signed({ ...EVENT, event_id: 'evt-other' }) })
  assert.deepEqual(sameGen.calls.map(c => c.sourceRef), ['meter:gen-1', 'meter:gen-1'], 'two event ids of one generation share the key'); assert.deepEqual(sameGen.charged, [12], 'and charge once')
  for (const [label, gen] of [['no generation_id', undefined], ['generation_id null', null], ['an empty generation_id', ''], ['a generation_id with a space', 'gen 1'], ['a generation_id of 256 characters', 'g'.repeat(256)], ['a number', 7]]) {
    const w = walletStub(); await runRoute({ text, env: APPLY(), wallet: w, ...signed({ ...EVENT, generation_id: gen }) }); assert.equal(w.calls[0].sourceRef, `meter:${EVENT.event_id}`, `${label}: falls back to event_id`)
  }
  const odd = walletStub(); await runRoute({ text, env: APPLY(), wallet: odd, ...signed({ ...EVENT, generation_id: 'gen-2026/11:x' }) }); assert.equal(odd.calls[0].sourceRef, 'meter:gen-2026/11:x', 'any visible generation id is the key')
  const CASES = [
    ['the debit source is not router (flat already charged)', APPLY({ WALLET_DEBIT_SOURCE: 'flat' }), EVENT, 200, { received: true, applied: false, reason: 'debit_source_not_router' }],
    ['no debit source set', APPLY({ WALLET_DEBIT_SOURCE: undefined }), EVENT, 200, { received: true, applied: false, reason: 'debit_source_not_router' }],
    ['flat_strict', APPLY({ WALLET_DEBIT_SOURCE: 'flat_strict' }), EVENT, 200, { received: true, applied: false, reason: 'debit_source_not_router' }],
    ['today\'s event: no from_topup (a 503, never a 200 that drops the debit)', APPLY(), EVENT_TODAY, 503, { error: 'from_topup_absent' }],
    ['from_topup null', APPLY(), { ...EVENT, from_topup: null }, 503, { error: 'from_topup_absent' }],
    ['no from_topup and no user', APPLY(), { ...EVENT_TODAY, user_id: null }, 503, { error: 'from_topup_absent' }],
    ['a negative from_topup', APPLY(), { ...EVENT, from_topup: '-1.000000' }, 503, { error: 'from_topup_invalid' }],
    ['an exponent', APPLY(), { ...EVENT, from_topup: '1E+3' }, 503, { error: 'from_topup_invalid' }],
    ['a number, not a string', APPLY(), { ...EVENT, from_topup: 12 }, 503, { error: 'from_topup_invalid' }],
    ['finer than six places', APPLY(), { ...EVENT, from_topup: '1.0000001' }, 503, { error: 'from_topup_invalid' }],
    ['no user (unattributed)', APPLY(), { ...EVENT, user_id: null }, 200, { received: true, applied: false, reason: 'unattributed' }],
    ['a user id the router would not send', APPLY(), { ...EVENT, user_id: 'a b' }, 200, { received: true, applied: false, reason: 'unattributed' }],
    ['an explicit zero top-up part', APPLY(), { ...EVENT, from_topup: '0.000000' }, 200, { received: true, applied: false, reason: 'no_topup_part' }],
    ['a sub-cent amount (no ruling yet: retried, not dead-lettered)', APPLY(), { ...EVENT, from_topup: '0.018450' }, 503, { error: 'sub_cent_unruled' }],
    ['12.5 credits', APPLY(), { ...EVENT, from_topup: '12.500000' }, 503, { error: 'sub_cent_unruled' }],
    ['an absurd amount', APPLY(), { ...EVENT, from_topup: '1000001.000000' }, 503, { error: 'amount_out_of_range' }],
  ]
  for (const [label, env, event, status, body] of CASES) {
    const w = walletStub(), r = keepLogs(await runRoute({ text, env, wallet: w, ...signed(event) }))
    assert.equal(r.res.status, status, label); assert.deepEqual(r.res.body, body, label); assert.equal(w.calls.length, 0, `${label}: the wallet helper is not called`)
  }
  const absent = await runRoute({ text, env: APPLY(), ...signed(EVENT_TODAY) }); assert.deepEqual(absent.logs, [`[meter-receiver] event=${EVENT.event_id} mode=apply outcome=config_error:from_topup_absent`], 'logged as a configuration error')
  for (const [behaviour, word] of [['insufficient', 'insufficient_balance'], ['missing', 'unknown_user'], ['down', 'apply_failed']]) {
    const w = walletStub(behaviour), r = keepLogs(await runRoute({ text, env: APPLY(), wallet: w, ...signed() }))
    assert.deepEqual(r.res, { status: 503, body: { error: 'meter_apply_failed' }, headers: { 'Cache-Control': 'no-store' } }, `the wallet helper throws (${behaviour}): 503, retried`); assert.equal(w.calls.length, 1)
    assert.deepEqual(r.logs, [`[meter-receiver] event=${EVENT.event_id} mode=apply outcome=error:${word}`])
  }
  const whole = walletStub(); await runRoute({ text, env: APPLY(), wallet: whole, ...signed({ ...EVENT, from_topup: '7' }) }); assert.equal(whole.calls[0].amountCents, 7, 'a whole number with no fraction')
}
function proveLogs(logs = allLogs) {
  assert.ok(logs.length > 40, `the runs above logged (${logs.length} lines)`)
  for (const line of logs) {
    assert.match(line, LOG_LINE, `a log line is the event id, the mode and an outcome word only: ${line.slice(0, 160)}`)
    for (const leak of [MW, 'ckuser01', '12.000000', '0.0002460000', 'some-model', 'slide_content', '"event_id"', 'sha256=', 'other-word', 'gen-1']) assert.ok(!line.includes(leak), `no body, user, amount, header, generation id or signing word in a log line (${leak})`)
  }
}
await check('F4 flag off: 404 for every non-"true" spelling, before a header, the body or any other variable is read (a Proxy on process.env), the wallet not loaded, nothing logged; the route exports POST only', () => proveFlagOff())
await check('F4 signatures: exactly X-MR-Timestamp and X-MR-Signature: sha256=<lowercase hex>; the right one over the same bytes is 200; one changed byte, an extra space, a missing, misnamed or mis-prefixed signature or timestamp, another signing word, a re-timestamped payload and a stale or future stamp are all 401 with nothing applied; no secret 503; oversize 413; timingSafeEqual', () => proveSignatures())
await check('F4 a known-answer vector (Node and Python agree on the hex): the route accepts it with its clock fixed; one byte or one nibble off is 401', () => proveKnownAnswer())
await check('F4 never a 4xx on a validly signed request (ROUTER-2): every mode x 16 event variants (today\'s event without from_topup, sub-cent, malformed splits, odd ids, unknown keys) x 4 wallet behaviours is 200 or 503; a signed body that is not an event is 503', () => proveNoFourXx())
await check('F4 receipt_only (the default, and every mode but exactly "apply"): 200 { received: true, applied: false } for every event variant, today\'s included; the wallet module never loaded; no database, SQL or migration; the runbook lines are in the route', () => proveReceiptOnly())
await check('F4 apply: only while the debit source is router; dedupe on generation_id, else event_id (sourceRef meter:<key>; one generation charges once); no from_topup or a malformed one: 503 (a config error, retried, never a lossy 200); sub-cent and absurd: 503; unattributed and zero: 200; every wallet-helper failure: 503', () => proveApply())
await check('F4 logs: every line is "[meter-receiver] event=<id> mode=<mode> outcome=<word>": no body, user, amount, header, generation id or signing word', () => proveLogs())

// ===== 5. the DRAFT lines for FRONTEND-1's files ====================================================================================================================================
console.log('5. drafts')
function proveDrafts(drafts = S.BILLING_L5_DRAFTS, readNow = read) {
  const byFile = new Map()
  for (const d of drafts) {
    const base = baseText(d.file), lines = base.split('\n'), anchor = d.after ?? d.before
    assert.equal(lines[d.line - 1], anchor, `${d.file}:${d.line} is the anchor, as dev has it`)
    assert.equal(lines.filter(l => l === anchor).length, 1, `${d.file}: the anchor is one whole line, once`)
    assert.ok(S.BILLING_L5_MARKER_RE.test(d.add), `${d.file}: the new line carries the marker`); assert.ok(!base.includes(d.add), `${d.file}: the line is not in dev`)
    assert.equal(readNow(d.file), base, `${d.file}: NOT applied (the working tree is dev's file, byte for byte)`)
    assert.doesNotMatch(d.add, /MODEL_ROUTER_BILLING_KEY|METER_WEBHOOK_SECRET/, 'a draft names no key')
    if (!byFile.has(d.file)) byFile.set(d.file, [])
    byFile.get(d.file).push(d)
  }
  assert.deepEqual([...byFile.keys()].sort(), ['app/(app)/billing/page.tsx', 'app/api/account/route.ts', 'app/api/stripe/create-checkout-session/route.ts', 'app/api/webhooks/stripe/route.ts', 'lib/auth-options.ts'], 'drafts for the billing page, the checkout route, the webhook, sign-up and the cancel path')
  assert.equal(read(S.BILLING_L5_WALLET_DEBIT_ALREADY.file).split('\n')[S.BILLING_L5_WALLET_DEBIT_ALREADY.line - 1].includes(S.BILLING_L5_WALLET_DEBIT_ALREADY.has), true, 'no wallet-debit draft is needed: dev already switches on WALLET_DEBIT_SOURCE there')
  for (const [file, list] of byFile) {
    const base = baseText(file), lines = base.split('\n')
    for (const d of [...list].sort((a, b) => b.line - a.line)) lines.splice(d.after !== undefined ? d.line : d.line - 1, 0, d.add)
    const patched = lines.join('\n')
    const out = ts.transpileModule(patched, { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
    assert.deepEqual((out.diagnostics ?? []).map(x => ts.flattenDiagnosticMessageText(x.messageText, ' ')), [], `${file}: patched with its drafts it still parses`)
    assert.equal(patched.split('\n').filter(l => !S.BILLING_L5_MARKER_RE.test(l)).join('\n'), base, `${file}: the marked lines out, it is dev's file byte for byte`)
  }
}
await check('the DRAFT lines (billing page, checkout route, webhook, sign-up, cancel): each anchor is dev\'s line at its number, once; each new line carries BILLING-L5, names no key and is NOT applied; patched in memory each file still parses and without the marked lines is dev\'s; the wallet debit route needs none', () => proveDrafts())

// ===== 6. the pins ==================================================================================================================================================================
console.log('6. pins')
const lineDiff = (before, after) => { const b = before.split('\n'), a = after.split('\n'), out = []; let i = 0, j = 0; while (i < b.length || j < a.length) { if (b[i] === a[j]) { i++; j++ } else if (a[j] !== undefined && !b.slice(i).includes(a[j])) { out.push(`+${a[j++]}`) } else if (b[i] !== undefined && !a.slice(j).includes(b[i])) { out.push(`-${b[i++]}`) } else { out.push(`-${b[i++]}`); out.push(`+${a[j++]}`) } } return out }
/** Credential shapes (built from parts so this file carries none of them literally): provider key prefixes, a JWT head, a private-key armour line, a quoted 12+ character value after a credential word, credentials in a URL, the system password file. */
const SECRET_SHAPE = new RegExp(['sk-[A-Za-z0-9]{16,}', 'AKIA[0-9A-Z]{12,}', 'eyJ[A-Za-z0-9_-]{20,}\\.', '-----BEGIN [A-Z ]*PRIV' + 'ATE KEY', 'xox[bap]-[A-Za-z0-9-]{10,}', `(?<![A-Za-z_])(?:pass${'word'}|secret|token|api[_-]?key)\\s*[:=]\\s*['"][^'"\\s]{12,}['"]`, '[a-z]+:\\/\\/[^\\s/:@]+:[^\\s/@]+@', `\\/etc\\/pass${'wd'}`].join('|'), 'i')
const BLOCK = S.BILLING_L5_ENV_BLOCK
function provePins(readNow = read, at = '', later = laterStrips, strip = stripBillingL5) {
  const a = m => (at ? `${at}: ${m}` : m)
  for (const rel of S.BILLING_L5_PIN_FILES) {
    const now = later(rel, readNow(rel)), base = baseText(rel)
    assert.equal(strip(rel, now), base, a(`${rel}: an older proof taught: put back it is the base's, byte for byte`)); assert.equal(strip(rel, strip(rel, now)), base, a(`${rel}: put back twice changes nothing more`))
    for (const [has, was] of S.BILLING_L5_PIN_EDITS[rel]) { assert.equal(now.split(has).length - 1, 1, a(`${rel}: the taught line is there exactly once`)); for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(S.BILLING_L5_PIN_MARK), a(`${rel}: it carries the registry-read mark`)); assert.equal(was, '') }
    const diff = lineDiff(base, now); assert.ok(diff.length === 1 && diff[0].startsWith('+') && diff[0].includes(S.BILLING_L5_PIN_MARK) && /\^Billing L5:/.test(diff[0]), a(`${rel}: the one line added is this change's subject filter, with the mark`))
    const lines = now.split('\n'), mine = lines.findIndex(l => l.includes(S.BILLING_L5_PIN_MARK)); assert.ok(mine > lines.findIndex(l => l.startsWith(S.BILLING_L5_PIN_AFTER)) && lines.findIndex(l => l.startsWith(S.BILLING_L5_PIN_AFTER)) > 0, a(`${rel}: after the last subject filter dev has (B63's)`))
  }
  for (const rel of S.BILLING_L5_NEW_FILES) assert.doesNotMatch(readNow(rel), SECRET_SHAPE, a(`${rel}: no credential-shaped literal, no credentials in a URL, no system file path`))
  const env = readNow('.env.example'), first = BLOCK.split('\n')[0]
  assert.equal(env.split(BLOCK).length - 1, 1, a('the .env.example block is there exactly once, verbatim')); assert.match(env, new RegExp(`\\n\\n${escapeRe(first)}`), a('a blank line before it'))
  for (const other of registry.LATER_ENV_BLOCKS) if (other !== BLOCK && baseText('.env.example').includes(String(other).trim())) assert.ok(env.indexOf(String(other).trim()) < env.indexOf(first), a('every block dev already has comes before it'))
  assert.deepEqual(BLOCK.split('\n').filter(l => l && !l.startsWith('#')), ['NEXT_PUBLIC_STUDIO_BILLING_PLANS="false"', 'STUDIO_ROUTER_ENTITLEMENTS_PUSH="false"', 'STUDIO_METER_RECEIVER_ENABLED="false"', 'METER_RECEIVER_MODE="receipt_only"', 'MODEL_ROUTER_BILLING_KEY=', 'METER_WEBHOOK_SECRET='], a('the three flags off, the mode receipt_only, the two keys EMPTY'))
  assert.match(BLOCK, /SERVER-ONLY \(never a NEXT_PUBLIC_ name/); assert.match(BLOCK, /entitlements scope only/); assert.match(BLOCK, /writes nothing/)
  assert.match(BLOCK, /Do NOT enable it until durable storage or apply exists/); assert.match(BLOCK, /do NOT set it before the router sends from_topup/); assert.match(BLOCK, /OPS-2 runs the router's admin replay/); assert.doesNotMatch(BLOCK, new RegExp(['ROUTER', 'ENTITLEMENTS', 'API', 'KEY'].join('_')), a('the old key name is gone'))
  assert.doesNotMatch(BLOCK, /NARRATION_VIA_ROUTER|MODEL_ROUTER_URL|MODEL_ROUTER_STUDIO_KEY|WALLET_DEBIT_SOURCE|STRIPE_(?:STARTER|PRO|MAX)_|STRIPE_REAL_TIER/, a('the block names no variable another change\'s proof owns (narration, wallet debit source, Stripe price ids)'))
  const baseNames = new Set(baseText('.env.example').split('\n').filter(l => /^[A-Z][A-Z0-9_]*=/.test(l)).map(l => l.slice(0, l.indexOf('='))))
  for (const line of BLOCK.split('\n').filter(l => /^[A-Z]/.test(l))) assert.ok(!baseNames.has(line.slice(0, line.indexOf('='))), a(`${line}: not a second value for a variable dev already has`))
  assert.equal(registry.stripLaterEnvBlocks('.env.example', env), registry.stripLaterEnvBlocks('.env.example', baseText('.env.example')), a('.env.example without the registered blocks is the base\'s, byte for byte'))
  assert.ok(registry.LATER_STRIPS.includes(stripBillingL5) && registry.LATER_ENV_BLOCKS.includes(BLOCK) && [...S.BILLING_L5_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), a('the registry holds the strip, the block and every file'))
}
await check('the pins: the two older proofs taught get one subject-filter line each, after B63\'s, with the mark (put back they are the base\'s, byte for byte); .env.example has the block once at the end, flags off, keys empty, no foreign variable; no credential shape in a new file; the registry holds it all', () => provePins())
await check('the strip is plain data: no import, nothing read; it marks no app file; any other file comes back untouched; the marker is a whole token; the scope is the new files, .env.example, the registry, the two taught proofs and the voice-call carry', () => {
  const text = read('scripts/studio-billing-l5-strip.mjs')
  assert.doesNotMatch(text.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/`[^`]*`/g, '``').replace(/\/\/.*$/gm, ''), /^import |require\(|readFileSync|execFileSync/m, 'no imports, nothing read from disk or git')
  assert.deepEqual(S.BILLING_L5_FILES, []); assert.equal(stripBillingL5('app/(app)/billing/page.tsx', 'x // BILLING-L5\n'), 'x // BILLING-L5\n'); assert.equal(stripBillingL5('scripts/studio-later-changes.mjs', 'abc\n'), 'abc\n'); assert.equal(stripBillingL5(S.BILLING_L5_PIN_FILES[0], 7), 7)
  assert.ok(S.BILLING_L5_MARKER_RE.test('a // BILLING-L5') && !S.BILLING_L5_MARKER_RE.test('a // BILLING-L50') && !S.BILLING_L5_MARKER_RE.test('a // BILLING-L5X') && !S.BILLING_L5_MARKER_RE.test('a // X-BILLING-L5') && !S.BILLING_L5_MARKER_RE.test('a // BILLING-F4F6'))
  assert.deepEqual([...S.BILLING_L5_SCOPE_FILES].sort(), [...S.BILLING_L5_NEW_FILES, '.env.example', 'scripts/studio-later-changes.mjs', ...S.BILLING_L5_PIN_FILES, 'scripts/test-studio-voice-call.mjs'].sort())
  assert.equal(S.BILLING_L5_SUBJECT, 'Billing L5:'); assert.match(BASE_COMMIT, /^[0-9a-f]{40}$/); git('merge-base', '--is-ancestor', BASE_COMMIT, 'HEAD')
})
// FRONTEND-1's OK'd voice-call pin edit, carried byte for byte from #603 (21d254c6): its ".env.example block is the last thing in the file" pins read past the blocks registered after theirs.
const VC = 'scripts/test-studio-voice-call.mjs', REF_603 = '21d254c63537776be851ca96dee30d88f34c174d'
const vcStrip = await import('./studio-voice-call-strip.mjs')
/** The two predicates of the voice-call proof (L1543, L1634 on dev), evaluated here on this tree's .env.example: never by running that proof (OPS-2 runs it). */
function voiceCallPredicates(env, envDiffAdded) {
  const laterEnvOut = text => registry.LATER_ENV_BLOCKS.slice(registry.LATER_ENV_BLOCKS.indexOf(vcStrip.VOICE_CALL_ENV_BLOCK) + 1).reduce((out, block) => out.replace(`\n${block}`, ''), text) // the carried line's own logic
  return {
    oldL1543: env.endsWith(`\n${vcStrip.VOICE_CALL_ENV_BLOCK}`) && vcStrip.VOICE_CALL_ENV_BLOCK.endsWith('\n'),
    newL1543: laterEnvOut(env).endsWith(`\n${vcStrip.VOICE_CALL_ENV_BLOCK}`) && vcStrip.VOICE_CALL_ENV_BLOCK.endsWith('\n'),
    newL1634: laterEnvOut(`${envDiffAdded.join('\n')}\n`).trimEnd().endsWith(vcStrip.VOICE_CALL_ENV_BLOCK.trimEnd()),
  }
}
function proveVoiceCallCarry(readNow = read, head = 'HEAD') {
  const now = readNow(VC), base = baseText(VC), pairs = S.BILLING_L5_FE1_PROOF_OK[VC]
  assert.deepEqual(S.BILLING_L5_FE1_PROOF_FILES, [VC], 'exactly one FRONTEND-1 file, the voice-call proof')
  assert.equal(stripBillingL5(VC, now), base, 'put back, the voice-call proof is dev\'s, byte for byte')
  const diff = lineDiff(base, now), added = diff.filter(l => l.startsWith('+')).map(l => l.slice(1)), removed = diff.filter(l => l.startsWith('-')).map(l => l.slice(1))
  assert.deepEqual(added, pairs.map(([has]) => has.replace(/\n$/, '')), 'the four lines added are exactly the OK\'d ones, in order')
  assert.deepEqual(removed, pairs.filter(([, was]) => was).map(([, was]) => was.replace(/\n$/, '')), 'the two lines replaced are exactly the OK\'d ones')
  for (const line of added) { assert.ok(line.endsWith('// LATER-CHANGES: registry read (UX-FINDINGS-E)'), 'each keeps #603\'s own mark'); assert.ok(!S.BILLING_L5_MARKER_RE.test(line), 'and is not re-marked') }
  const lines = now.split('\n'); assert.equal(lines[lines.indexOf(S.BILLING_L5_FE1_PROOF_ANCHOR) + 1], added[0], 'the inserted lines sit right after the anchor'); assert.equal(lines[lines.indexOf(S.BILLING_L5_FE1_PROOF_ANCHOR) + 2], added[1])
  let ref = null; try { ref = git('show', `${REF_603}:${VC}`) } catch { /* #603's commit is not in this clone */ }
  if (ref !== null) assert.ok(Buffer.from(now).equals(Buffer.from(ref)), 'BYTE-IDENTICAL to the voice-call proof at 21d254c6 (#603)'); else console.log('NOTE voice-call carry: 21d254c6 is not in this clone; checked against the strip\'s pairs only')
  const env = readNow('.env.example'), envDiff = git('diff', '--unified=0', vcStrip.BASE_COMMIT, head, '--', '.env.example').split('\n').filter(l => /^[-+]/.test(l) && !/^(---|\+\+\+)/.test(l))
  const p = voiceCallPredicates(env, envDiff.map(l => l.slice(1)))
  assert.equal(p.oldL1543, false, 'dev\'s L1543 predicate is false with this change\'s block (why the carry is needed)')
  assert.equal(p.newL1543, true, 'the carried L1543 predicate holds on this tree\'s .env.example'); assert.equal(p.newL1634, true, 'the carried L1634 predicate holds on the committed .env.example diff')
}
await check('the voice-call pin carry: the four OK\'d lines of #603, byte for byte (put back, dev\'s file; vs 21d254c6, Buffer-equal); their own mark kept; L1543 and L1634 evaluated on this .env.example: false before the carry, true after', () => proveVoiceCallCarry())
/** The byte-identity evidence of flag off, as sha256 prefixes: what each switch-off path returns or draws. */
await check('flag-off evidence (sha256/16): the UI draws the empty string, the route answers the same 404 body for every off spelling, the push returns the same skipped outcome', async () => {
  const ui = new Set(SPELLINGS.filter(s => s !== 'true').map(s => sha(renderPlans({ env: s === undefined ? PRICE_IDS : { ...PRICE_IDS, NEXT_PUBLIC_STUDIO_BILLING_PLANS: s }, props: { usageState: READY } }))))
  const route = new Set(), push = new Set()
  for (const s of SPELLINGS.filter(x => x !== 'true')) {
    route.add(sha(JSON.stringify((await runRoute({ env: s === undefined ? {} : { STUDIO_METER_RECEIVER_ENABLED: s }, ...signed() })).res)))
    push.add(sha(JSON.stringify(await entWorld({ env: s === undefined ? {} : { STUDIO_ROUTER_ENTITLEMENTS_PUSH: s } }).lib.pushEntitlement(entWorld().lib.buildEntitlement(USER, SUB('active'))))))
  }
  assert.deepEqual([ui.size, route.size, push.size], [1, 1, 1]); assert.deepEqual([...ui], [sha('')])
  console.log(`     flag off: UI ${[...ui][0]} (= sha of ""), route 404 ${[...route][0]}, push skipped ${[...push][0]}`)
})

// ===== 7. scope =====================================================================================================================================================================
console.log('7. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-08T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-08T00:00:00Z' }
const plumb = (args, env = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl5-blob-')); try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) } }
const show = (head, rel) => git('show', `${head}:${rel}`)
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(S.BILLING_L5_SUBJECT)
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head: the gate's merge has dev as its FIRST parent and this change's head as its SECOND; the scope runs against HEAD^2. A branch head is used as it is. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim(), parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const OLDER_PREFIXES = /^(Phone shell coverage:|Phone landscape:|Phone hints:|Phone shell 1:|Phone shell 2:|Stage open gate:|Chat column wide:|Welcome trim:|Director mark trim:|Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:|Text set keep look:|Structural refine decline:|Strawman|Template match:|Template proof order:|Save refused notice:|Chat parity|Billing:|Billing security:|Usage credits|Chat caps:)/
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (?:Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), OLDER_PREFIXES, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
const FOREIGN = ['app/(app)/billing/page.tsx', 'app/api/stripe/create-checkout-session/route.ts', 'app/api/stripe/create-topup-session/route.ts', 'app/api/webhooks/stripe/route.ts', 'app/api/wallet/debit/route.ts', 'lib/wallet.ts', 'lib/billing/wallet-debit-source.ts', 'lib/billing/stripe-webhook.ts', 'lib/auth-options.ts', 'app/api/account/route.ts', 'lib/studio-billing.ts', 'components/billing/UpgradeButton.tsx', 'lib/studio-usage-credits.ts', 'components/studio-usage-credits.tsx', 'app/api/usage/credits/route.ts', 'lib/marketing/homepage-v2-pricing.ts', 'lib/service-url.ts', 'middleware.ts', 'prisma/schema.prisma', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'next.config.mjs']
const NO_LATER = { files: new Set(), strip: (rel, text) => text }
const REG = 'scripts/studio-later-changes.mjs', END = '  // one line per later change, above this comment'
const isMine = line => line.includes('studio-billing-l5-strip.mjs')
const registryWithout = text => text.split('\n').filter(line => !isMine(line)).join('\n')
/** The later env blocks (registered after this change's) taken out, so a change stacked on this branch reads as this change left it. */
function removeEnvBlock(out, registered) {
  const block = String(registered).replace(/^\n+/, '').replace(/\n+$/, '')
  let at = out.indexOf(block)
  while (at !== -1 && !((at === 0 || out[at - 1] === '\n') && (at + block.length === out.length || out[at + block.length] === '\n'))) at = out.indexOf(block, at + 1)
  if (at === -1 || block === '') return out
  const before = out.slice(0, at), after = out.slice(at + block.length)
  if (/^\n*$/.test(after)) return before.endsWith('\n\n') ? before.slice(0, -1) : before
  return after.startsWith('\n\n') ? before + after.slice(2) : before + after.slice(1)
}
function withoutLaterEnv(text) {
  const at = registry.LATER_ENV_BLOCKS.indexOf(BLOCK)
  return (at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1)).reduce(removeEnvBlock, text)
}
const scopeCommittedFiles = (head, later = NO_LATER) => {
  const own = scopeOwnCommits(head), touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  assert.deepEqual([...touched].sort(), [...S.BILLING_L5_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  const judged = [...net].filter(rel => S.BILLING_L5_SCOPE_FILES.has(rel) || !(registry.LATER_CHANGE_FILES.has(rel) || later.files.has(rel)))
  assert.deepEqual(judged.sort(), [...S.BILLING_L5_SCOPE_FILES].sort(), 'the whole committed diff from BASE, less the files of later registered changes, is exactly this change\'s scope')
  for (const rel of S.BILLING_L5_NEW_FILES) { assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel); assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${rel}`), undefined, `${rel} is new: the base has none`) }
  for (const rel of S.BILLING_L5_PIN_FILES) assert.equal(stripBillingL5(rel, later.strip(rel, laterStrips(rel, show(head, rel)))), baseText(rel), `${rel}: an older proof taught: put back it is the base's`)
  for (const rel of FOREIGN) assert.ok(!touched.has(rel) && !judged.includes(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, later = NO_LATER) => {
  const envText = withoutLaterEnv(later.strip('.env.example', show(head, '.env.example')))
  assert.equal(envText, `${baseText('.env.example')}\n${BLOCK}`, '.env.example is the base plus this change\'s block, after one blank line, at the end')
  const regText = later.strip(REG, show(head, REG)), regBase = baseText(REG), baseLines = new Set(regBase.split('\n'))
  const lines = regText.split('\n')
  assert.equal(lines.filter(isMine).length, 3, 'the registry has exactly this change\'s three lines')
  for (const [name, marker] of [['LATER_CHANGE_FILES', 'BILLING_L5_SCOPE_FILES'], ['LATER_ENV_BLOCKS', 'BILLING_L5_ENV_BLOCK'], ['LATER_STRIPS', 'stripBillingL5']]) {
    const at = lines.findIndex(l => l.includes(`).${marker}, // LATER-CHANGE:`)); assert.ok(at > 0, name)
    let next = at + 1; while (lines[next] !== END && lines[next]?.includes('// LATER-CHANGE:') && !isMine(lines[next]) && !baseLines.has(lines[next])) next++
    assert.equal(lines[next], END, `${name}: the line is the true end of its list (only later changes' registered lines may follow it)`)
    assert.ok(regBase.split('\n').includes(lines[at - 1]) && lines[at - 1].includes('// LATER-CHANGE:'), `${name}: right after a registered line its base already has`)
  }
  const tailOnly = registryWithout(regText).split('\n').filter((l, i, all) => !(l.includes('// LATER-CHANGE:') && !regBase.split('\n').includes(l)))
  assert.equal(tailOnly.join('\n'), regBase.split('\n').join('\n'), 'flag off: the registry without its three lines (and any later change\'s) is the base\'s, byte for byte')
  assert.equal(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', REG).split('\n').filter(l => /^-(?!--)/.test(l)).length, 0, 'the registry loses no line')
}
const scopeAll = (head, later) => { scopeOwnCommits(head); scopeCommittedFiles(head, later); scopeEnvAndRegistry(head, later) }
const identityEvidence = head => S.BILLING_L5_OWN_EDITS.map(rel => {
  const now = show(head, rel), back = rel === '.env.example' ? registry.stripLaterEnvBlocks(rel, now) : rel === REG ? registryWithout(now) : stripBillingL5(rel, now)
  const base = rel === '.env.example' ? registry.stripLaterEnvBlocks(rel, baseText(rel)) : baseText(rel)
  assert.equal(sha(back), sha(base), `${rel}: with this change out it is the base's`); return `${rel} ${sha(base)}`
})
const HEAD = scopeHead('HEAD')
const ownOnLine = head => git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
const ON_OWN_LINE = ownOnLine(HEAD).length > 0
const scopeCheck = (label, fn) => (ON_OWN_LINE ? check(label, fn) : undefined)
if (!ON_OWN_LINE) console.log('NOTE scope: no commit of this change on the first-parent line from BASE (merged into dev: its commits are on a second parent); the scope checks stand down, the pins above cover the files')
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl5-idx-'))
  try {
    const envIdx = { GIT_INDEX_FILE: path.join(dir, 'index') }
    plumb(['read-tree', parent], envIdx)
    for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], envIdx)
    return plumb(['commit-tree', plumb(['write-tree'], envIdx), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
await scopeCheck(`this change's own commits (subject "${S.BILLING_L5_SUBJECT}", found across the line, no merges) exist with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await scopeCheck('the committed files are exactly this change\'s: the eight new files, .env.example, the registry, the two taught proofs and the voice-call carry; none of FRONTEND-1\'s billing files, the wallet, the schema, package.json or the lockfile', () => scopeCommittedFiles(HEAD))
await scopeCheck('.env.example is the base plus the block at the end; the registry gains exactly its three lines, each the true end of its list, and loses none; flag off every touched old file goes back to the base (sha256/16 printed)', () => { scopeEnvAndRegistry(HEAD); console.log(`     flag-off identity: ${identityEvidence(HEAD).join('; ')}`) })
const GATE = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : null
await scopeCheck('GATE-SAFE: on a gate-style merge (first parent BASE, second this change\'s head) the scope head is HEAD^2 and the whole scope passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD]); assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent line has none of this change\'s commits')
  assert.equal(scopeHead(GATE), HEAD); scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of S.BILLING_L5_PIN_FILES) assert.equal(stripBillingL5(rel, show(GATE, rel)), baseText(rel))
  assert.equal(scopeHead(HEAD), HEAD); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT)
})
await scopeCheck('mutant caught: the old first-parent own-commit query finds nothing on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false }); assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/); assert.doesNotThrow(() => scopeOwnCommits(head))
})
const unrelated = ON_OWN_LINE ? commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE') : null
await scopeCheck('GATE-SAFE after dev moved on: a gate merge whose first parent is past BASE still scopes to this change\'s head and passes', () => {
  const g = gateMerge(unrelated, HEAD); assert.deepEqual(parentsOf(g), [unrelated, HEAD]); assert.equal(scopeHead(g), HEAD); scopeAll(scopeHead(g)); scopeEnvAndRegistry(g); assert.equal(ownOf(g).length, ownOf(HEAD).length)
})
await scopeCheck('mutant caught: a stray file in a "Billing L5:" commit, an own commit without the co-author line, an edit to FRONTEND-1\'s billing files, the wallet, the schema or package.json, and a second line in a taught proof fail the scope', () => {
  const stray = commitWith(HEAD, { 'stray-billing-l5.txt': 'stray\n' }, `${S.BILLING_L5_SUBJECT} a stray file${TRAILER}`); assert.doesNotThrow(() => scopeCommittedFiles(HEAD)); assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/)
  const noTrailer = commitWith(HEAD, {}, `${S.BILLING_L5_SUBJECT} no trailer`); assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of ['app/(app)/billing/page.tsx', 'app/api/webhooks/stripe/route.ts', 'app/api/wallet/debit/route.ts', 'lib/wallet.ts', 'lib/auth-options.ts', 'prisma/schema.prisma', 'package.json']) {
    const foreign = commitWith(HEAD, { [rel]: `${show(HEAD, rel)}\n` }, `${S.BILLING_L5_SUBJECT} touches ${rel}${TRAILER}`); assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched/, rel)
  }
  const sneaky = commitWith(HEAD, { [S.BILLING_L5_PIN_FILES[0]]: `${show(HEAD, S.BILLING_L5_PIN_FILES[0])}\n// a second line` }, `${S.BILLING_L5_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => provePins(rel => show(sneaky, rel)), /put back it is the base's|one line added/, 'a second line in a taught proof')
})
// LINEAR STACK: a later change committed straight on top of this branch (no merge): its registry line sits below this change's, its strip (passed in) takes it out; registered files pass, an unregistered one fails
const LIN = { mark: 'SYNTHETIC-LATER-LINEAR', file: 'lib/synthetic-later-linear.ts' }
const linStrip = (rel, text) => (rel === REG && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(LIN.mark)).join('\n') : text)
const linearAfter = (extra = {}) => {
  const lines = show(HEAD, REG).split('\n'), at = lines.findIndex(l => l.includes(').BILLING_L5_SCOPE_FILES, // LATER-CHANGE:'))
  lines.splice(at + 1, 0, `  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, a made-up later change (${LIN.mark})`)
  return commitWith(HEAD, { [REG]: lines.join('\n'), [LIN.file]: 'export const x = 1\n', ...extra }, `Synthetic later: a change stacked straight on this one${TRAILER}`)
}
await scopeCheck('LINEAR STACK: a later change committed on top of this branch adds a registered-shape registry line below this one and a file of its own; read through its strip (and with its file registered) the whole scope still passes; an UNREGISTERED file in that commit still fails', () => {
  const later = { files: new Set([LIN.file]), strip: linStrip }, lin = linearAfter()
  assert.ok(ownOnLine(lin).length > 0, 'this change\'s commits are still on the first-parent line: the scope checks run')
  scopeAll(lin, later)
  assert.throws(() => scopeCommittedFiles(lin, NO_LATER), /less the files of later registered changes/, 'mutant caught: without its registration the later file is a stray')
  assert.doesNotThrow(() => scopeEnvAndRegistry(lin, NO_LATER), 'a registered-shape line below this one is tolerated even unstripped')
  const strayLin = linearAfter({ 'lib/unregistered-stray.ts': 'export const y = 2\n' }); assert.throws(() => scopeCommittedFiles(strayLin, later), /less the files of later registered changes/, 'an unregistered file in the later commit fails')
})
// ROBUST AFTER MERGE: dev's merge brings this change in by its SECOND parent, then a later change adds its subject filter beside this one's in a taught proof
const SYN = { file: 'scripts/test-studio-deck-sync-truth.mjs', mark: 'registry read (SYNTHETIC-LATER)' }
const synStrip = (rel, text) => (rel === SYN.file && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.mark)).join('\n') : text)
const stackedAfter = () => {
  const dev = gateMerge(BASE_COMMIT, HEAD), taught = show(dev, SYN.file).split('\n')
  const at = taught.findIndex(line => line.includes('registry read (BILLING-L5)')); assert.ok(at > 0)
  taught.splice(at + 1, 0, `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Synthetic later:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: ${SYN.mark}: a made-up change stacked after this one`)
  return commitWith(dev, { [SYN.file]: taught.join('\n') }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
await scopeCheck('ROBUST AFTER MERGE: on a branch stacked after this change (merged by a second parent, then a later subject filter beside this one\'s) no own commit is on the first-parent line, so the scope stands down, and the pins, read past the later strip, still pass', () => {
  const later = stackedAfter(), readAt = rel => show(later, rel)
  assert.equal(ownOf(later).length, ownOf(HEAD).length); assert.deepEqual(ownOnLine(later), [], 'none on the first-parent line')
  provePins(readAt, 'stacked after', (rel, text) => synStrip(rel, laterStrips(rel, text)))
  assert.throws(() => provePins(readAt, 'stacked after, not told', laterStrips), /put back it is the base's/, 'mutant caught: without the later strip its line breaks the put-back')
})

// ===== 8. mutants (each one edit of the real sources, fed to the same checks) =======================================================================================================
if (!process.env.CHECK_ONLY) console.log('8. mutants')
const P = SRC[PLANS_LIB], C = SRC[COMP], E = SRC[ENT_LIB], R = SRC[ROUTE]
// flags
await mutant('the UI flag reads "1" (truthy) as on', () => proveUiFlag(swap(P, "return value === 'true'", "return value !== undefined && value !== 'false' && value !== ''")))
await mutant('the UI flag is case-insensitive', () => proveUiFlag(swap(P, "return value === 'true'", "return String(value).toLowerCase() === 'true'")))
await mutant('the F3 flag reads "1" as on', () => provePushFlag(swap(E, "export function routerEntitlementsPushOn(value: string | null | undefined): boolean {\n  return value === 'true'", "export function routerEntitlementsPushOn(value: string | null | undefined): boolean {\n  return value === 'true' || value === '1'")))
await mutant('the F4 flag reads "1" as on', () => proveFlagOff(swap(R, "if (process.env.STUDIO_METER_RECEIVER_ENABLED !== 'true')", "if (process.env.STUDIO_METER_RECEIVER_ENABLED !== 'true' && process.env.STUDIO_METER_RECEIVER_ENABLED !== '1')")))
// UI
await mutant('the component draws with the flag off', () => proveGate(swap(C, 'return STUDIO_BILLING_PLANS_ENABLED ? <StudioPlanCreditsView {...props} /> : null', 'return <StudioPlanCreditsView {...props} />')))
await mutant('the preview route renders with the flag off', () => proveGate(C, swap(SRC[PAGE], '  if (!STUDIO_BILLING_PLANS_ENABLED) notFound()\n', '')))
await mutant('a leak word in the UI (the spend-order line says tokens)', () => proveCreditsOnly(C, swap(P, "spendOrder: 'Your plan credits are used first", "spendOrder: 'Your plan tokens are used first")))
await mutant('a "$" next to a usage number (monthly credits with a price)', () => proveCreditsOnly(C, swap(P, "monthlyCredits: (credits: number) => `${groupCredits(credits)} credits a month`", "monthlyCredits: (credits: number) => `${groupCredits(credits)} credits a month ($${credits / 100})`")))
await mutant('the usage section draws a cost word', () => proveCreditsOnly(swap(C, '<div data-studio-plan-credits-part="usage">', '<div data-studio-plan-credits-part="usage"><p>Provider cost</p>')))
await mutant('Pro shows 4,000 credits', () => proveNumbers(C, swap(P, 'pro: { monthlyCredits: 5000,', 'pro: { monthlyCredits: 4000,')))
await mutant('the $100 pack is sold again', () => proveNumbers(C, swap(P, "['pack_10', 'pack_25', 'pack_50']", "['pack_10', 'pack_25', 'pack_50', 'pack_100']")))
await mutant('a pack is shown as dollars, not credits', () => proveNumbers(C, swap(P, 'return `${groupCredits(pack.credits)} credits for ${pack.price}`', 'return pack.price')))
await mutant('the spend-order line is dropped', () => proveNumbers(swap(C, '      <p className="text-sm" data-studio-plan-credits-part="spend-order">{WORDS.spendOrder}</p>\n', '')))
await mutant('a paid account gets checkout (a second subscription)', () => proveCurrentTier(swap(C, ") : !offer ? null : current === 'free' ? (", ") : !offer ? null : true ? (")))
await mutant('a plan with no price id gets a live (dead-end) checkout', () => proveCurrentTier(swap(C, 'STUDIO_PAYMENTS_OPEN_SOON_ENABLED || card.checkoutPriceId ? (', 'true ? (')))
await mutant('the paid /pricing upgrade ignores payments open soon', () => provePaymentsSoon(swap(C, ') : STUDIO_PAYMENTS_OPEN_SOON_ENABLED ? (', ') : false ? (')))
await mutant('the preview route reads the session before the flag', () => proveGate(C, swap(SRC[PAGE], '  if (!STUDIO_BILLING_PLANS_ENABLED) notFound()\n  const session = await getServerSession(authOptions)\n', '  const session = await getServerSession(authOptions)\n  if (!STUDIO_BILLING_PLANS_ENABLED) notFound()\n')))
await mutant('the packs ignore payments open soon', () => provePaymentsSoon(swap(C, '        {packs.map(pack =>\n          soon ? (', '        {packs.map(pack =>\n          false ? (')))
await mutant('the Upgrade button is a home-made one that ignores payments open soon', () => provePaymentsSoon(swap(C, '<UpgradeButton priceId={card.checkoutPriceId ?? \'\'} billingCycle="monthly" label={label} className="w-full" />', '<Button className="w-full">{label}</Button>')))
await mutant('Upgrade is offered on the person\'s own plan', () => proveCurrentTier(swap(C, '{mine ? (', '{false ? (')))
await mutant('Starter\'s Upgrade sends Pro\'s price id', () => proveClicks(C, UI_ON(), swap(P, "if (id === 'starter') return process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID", "if (id === 'starter') return process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID")))
await mutant('a pack button posts somewhere new', () => proveClicks(swap(C, "fetch('/api/stripe/create-topup-session'", "fetch('/api/billing/new-topup'")))
await mutant('the component fetches usage itself', () => proveNoOwnUsageFetch(swap(C, '  const cards = studioBillingPlanCards()\n', "  const cards = studioBillingPlanCards()\n  if (typeof window !== 'undefined') void fetch('/api/usage/credits')\n")))
// F3
await mutant('flag off still pushes', () => provePushFlagOff(swap(E, "export async function pushEntitlement(built: BuiltEntitlement): Promise<PushOutcome> {\n  if (!routerEntitlementsPushOn(process.env.STUDIO_ROUTER_ENTITLEMENTS_PUSH)) return { skipped: true, reason: 'flag_off' }", 'export async function pushEntitlement(built: BuiltEntitlement): Promise<PushOutcome> {')))
await mutant('flag off reads the key before the flag', () => provePushFlagOff(swap(E, "export async function pushEntitlement(built: BuiltEntitlement): Promise<PushOutcome> {\n  if (!routerEntitlementsPushOn(", "export async function pushEntitlement(built: BuiltEntitlement): Promise<PushOutcome> {\n  void process.env.MODEL_ROUTER_BILLING_KEY\n  if (!routerEntitlementsPushOn(")))
await mutant('the user wrapper reads the database with the flag off', () => provePushFlagOff(swap(E, "export async function pushEntitlementForUser(userId: string, source: EntitlementSource): Promise<PushOutcome> {\n  if (!routerEntitlementsPushOn(process.env.STUDIO_ROUTER_ENTITLEMENTS_PUSH)) return { skipped: true, reason: 'flag_off' }", 'export async function pushEntitlementForUser(userId: string, source: EntitlementSource): Promise<PushOutcome> {\n  await prisma.user.findUnique({ where: { id: userId } })\n  if (!routerEntitlementsPushOn(process.env.STUDIO_ROUTER_ENTITLEMENTS_PUSH)) return { skipped: true, reason: \'flag_off\' }')))
await mutant('source_version is Date.now(), not updatedAt', () => proveStatusTable(swap(E, '  const version = ms(subscription.updatedAt)\n', '  const version = Date.now()\n')))
await mutant('a status is dropped from the mapping (unpaid)', () => proveStatusTable(swap(E, "'canceled', 'unpaid', 'incomplete'", "'canceled', 'incomplete'")))
await mutant('canceled is pushed as active', () => proveStatusTable(swap(E, 'body: { plan, status: subscription.status, period_start', "body: { plan, status: subscription.status === 'canceled' ? 'active' : subscription.status, period_start")))
await mutant('plan_credits is added to the body', () => proveStatusTable(swap(E, "period_end: new Date(end).toISOString(), source, source_version: version }", "period_end: new Date(end).toISOString(), source, source_version: version, plan_credits: '5000' } as RouterEntitlementBody")))
await mutant('a yearly period is pushed', () => proveStatusTable(swap(E, "  if (end - start > MAX_PERIOD_MS) return { ok: false, reason: 'period_too_long' }\n", '')))
await mutant('a coupon tier with no subscription is pushed as Free', () => proveStatusTable(swap(E, "    if (user.tier !== undefined && user.tier !== null && user.tier !== 'free') return { ok: false, reason: 'tier_without_subscription' }\n", '')))
await mutant('the base address gets a production fallback', () => provePushAnswers(swap(E, "value: process.env.MODEL_ROUTER_URL }", "value: process.env.MODEL_ROUTER_URL || 'https://router.example.test' }")))
await mutant('the key is read from a NEXT_PUBLIC_ name', () => provePushHappy(swap(E, 'process.env.MODEL_ROUTER_BILLING_KEY', 'process.env.NEXT_PUBLIC_MODEL_ROUTER_BILLING_KEY')))
await mutant('the key is sent as X-Api-Key', () => provePushHappy(swap(E, 'Authorization: `Bearer ${key}`', "'X-API-Key': key")))
await mutant('a redirect is followed', () => provePushHappy(swap(E, "        redirect: 'error',\n", '')))
await mutant('no timeout signal', () => provePushHappy(swap(E, '        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),\n', '')))
await mutant('a network failure throws out of the push', () => provePushAnswers(swap(E, "      return fail(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network')", '      throw error')))
await mutant('409 is read as applied', () => provePushAnswers(swap(E, "if (res.status === 409) return fail('version_conflict', 409, code)", "if (res.status === 409) return { skipped: false, ok: true, applied: true, reason: null, storedVersion: null }")))
await mutant('the key is put in an outcome', () => provePushAnswers(swap(E, "if (res.status === 503) return fail('unavailable', 503, code)", "if (res.status === 503) return fail('unavailable', 503, key)")))
await mutant('the push logs the key', () => proveWrappers(swap(E, '  console.log(entitlementPushLogLine(userId, source, outcome))', "  console.log(entitlementPushLogLine(userId, source, outcome), process.env.MODEL_ROUTER_BILLING_KEY)")))
await mutant('the real-tier mapping guard is dropped (a Starter buyer pushed as pro)', () => proveCancelPickAndMapping(swap(E, "  if (built.body.plan !== 'free' && LIVE_STATUSES.includes(built.body.status) && process.env.STRIPE_REAL_TIER_MAPPING_ENABLED !== 'true') return { skipped: true, reason: 'tier_mapping_off' }\n", '')))
await mutant('the newest row wins over a live one', () => proveCancelPickAndMapping(swap(E, 'return newest(live.length > 0 ? live : rows)', 'return newest(rows)')))
await mutant('a cancel is pushed as active', () => proveCancelPickAndMapping(swap(E, "body: { plan: 'free', status: 'canceled', source: 'cancel', source_version: version }", "body: { plan: 'free', status: 'active', source: 'cancel', source_version: version }")))
await mutant('a router 404 is not read as "not ready"', () => provePushAnswers(swap(E, "    if (res.status === 404) return fail('not_ready', 404, code)\n", '')))
await mutant('a key name in a client file', () => proveNoKeyInClient(new Map([...APP_FILES, ['components/billing/leaky.tsx', "'use client'\nconst k = process.env.MODEL_ROUTER_BILLING_KEY\n"]])))
await mutant('the push library becomes a client file', () => proveNoKeyInClient(new Map([...APP_FILES, [ENT_LIB, `'use client'\n${E}`]])))
await mutant('a NEXT_PUBLIC_ meter secret anywhere', () => proveNoKeyInClient(new Map([...APP_FILES, ['lib/x.ts', 'export const s = process.env.NEXT_PUBLIC_METER_WEBHOOK_SECRET\n']])))
await mutant('the backfill applies without the flag', () => proveBackfill(swap(read(BACKFILL), "if (args.apply && env.STUDIO_ROUTER_ENTITLEMENTS_PUSH !== 'true')", 'if (false)')))
await mutant('the backfill dry run sends', () => proveBackfill(swap(read(BACKFILL), "    if (args.apply) {\n      const outcome", "    if (true) {\n      const outcome")))
await mutant('the backfill plans real users too', () => proveBackfill(swap(read(BACKFILL), "entry.cohort !== 'qa'", "entry.cohort === 'nobody'")))
// F4
await mutant('a non-timing-safe comparison (===)', () => proveSignatures(swap(R, 'return given.length === expected.length && timingSafeEqual(given, expected)', "return given.toString('hex') === expected.toString('hex')")))
await mutant('the signature is not checked', () => proveSignatures(swap(R, '    if (!signatureValid(secret, request.headers.get(TIMESTAMP_HEADER), request.headers.get(SIGNATURE_HEADER), raw, Math.floor(Date.now() / 1000))) {', '    if (false) {')))
await mutant('the timestamp header is not X-MR-Timestamp', () => proveSignatures(swap(R, "const TIMESTAMP_HEADER = 'x-mr-timestamp'", "const TIMESTAMP_HEADER = 'x-timestamp'")))
await mutant('the signature header is not X-MR-Signature', () => proveSignatures(swap(R, "const SIGNATURE_HEADER = 'x-mr-signature'", "const SIGNATURE_HEADER = 'x-signature'")))
await mutant('the sha256= prefix is optional', () => proveSignatures(swap(swap(R, 'const SIGNATURE = /^sha256=[0-9a-f]{64}$/', 'const SIGNATURE = /^(?:sha256=)?[0-9a-f]{64}$/'), 'signature.slice(SIGNATURE_PREFIX.length)', "signature.replace(/^sha256=/, '')")))
await mutant('the known-answer vector no longer verifies (the scheme drifted: no dot)', () => proveKnownAnswer(swap(R, '.update(`${timestamp}.`).update(raw)', '.update(timestamp).update(raw)')))
await mutant('the HMAC leaves the timestamp out (a re-timestamped payload passes)', () => proveSignatures(swap(R, ".update(`${timestamp}.`).update(raw)", '.update(raw)')))
await mutant('the HMAC is over re-serialised JSON, not the raw bytes', () => proveSignatures(swap(R, ".update(`${timestamp}.`).update(raw)", ".update(`${timestamp}.`).update(JSON.stringify(JSON.parse(raw.toString('utf8'))))")))
await mutant('no clock-skew window', () => proveSignatures(swap(R, '  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_SKEW_SECONDS) return false\n', '')))
await mutant('the 404 comes after the body is read', () => proveFlagOff(swap(swap(R, "  if (process.env.STUDIO_METER_RECEIVER_ENABLED !== 'true') return respond(404, { error: 'Not found' })\n", ''), '    const raw = Buffer.from(await request.arrayBuffer())\n', "    const raw = Buffer.from(await request.arrayBuffer())\n    if (process.env.STUDIO_METER_RECEIVER_ENABLED !== 'true') return respond(404, { error: 'Not found' })\n")))
await mutant('receipt_only writes (it debits the wallet)', () => proveReceiptOnly(swap(R, "      log(event.eventId, mode, 'received')\n", "      if (event.userId) await (await import('@/lib/wallet')).debitWallet({ userId: event.userId, amountCents: 1, reason: 'token_usage', sourceRef })\n      log(event.eventId, mode, 'received')\n")))
await mutant('the wallet is imported statically (loaded in receipt_only)', () => proveReceiptOnly(swap(R, "import { meterFeedDebitsWallet } from '@/lib/billing/wallet-debit-source'\n", "import { meterFeedDebitsWallet } from '@/lib/billing/wallet-debit-source'\nimport '@/lib/wallet'\n")))
await mutant('"APPLY" turns apply mode on', () => proveReceiptOnly(swap(R, "process.env.METER_RECEIVER_MODE === 'apply'", "process.env.METER_RECEIVER_MODE?.trim().toLowerCase() === 'apply'")))
await mutant('apply ignores the debit source (flat and router would both debit)', () => proveApply(swap(R, '    if (!meterFeedDebitsWallet()) {', '    if (false) {')))
await mutant('the dedupe key is random (a replay charges twice)', () => proveApply(swap(R, 'const sourceRef = `meter:${event.dedupeKey}`', 'const sourceRef = `meter:${event.dedupeKey}:${Date.now()}:${Math.random()}`')))
await mutant('dedupe ignores generation_id (event_id only)', () => proveApply(swap(R, 'dedupeKey: generation ?? event.event_id', 'dedupeKey: event.event_id')))
await mutant('apply acknowledges an event with no from_topup (200: the debit is lost)', () => proveApply(swap(R, "      return respond(503, { error: 'from_topup_absent' })", "      return respond(200, { received: true, applied: false, reason: 'no_topup_part' })")))
await mutant('a missing from_topup is a 4xx (dead-lettered)', () => proveNoFourXx(swap(R, "      return respond(503, { error: 'from_topup_absent' })", "      return respond(422, { error: 'from_topup_absent' })")))
await mutant('a sub-cent amount is a 4xx', () => proveNoFourXx(swap(R, "      return respond(503, { error: 'sub_cent_unruled' })", "      return respond(422, { error: 'sub_cent_unruled' })")))
await mutant('a wallet-helper failure is a 4xx', () => proveNoFourXx(swap(R, "      return respond(503, { error: 'meter_apply_failed' })", "      return respond(409, { error: 'meter_apply_failed' })")))
await mutant('a signed body that is not an event is a 4xx', () => proveNoFourXx(swap(R, "      return respond(503, { error: 'invalid_meter_event' })", "      return respond(422, { error: 'invalid_meter_event' })")))
await mutant('a bad user id is refused in receipt_only', () => proveReceiptOnly(swap(R, "  if (typeof event.event_id !== 'string' || !EVENT_ID.test(event.event_id)) return null\n", "  if (typeof event.event_id !== 'string' || !EVENT_ID.test(event.event_id)) return null\n  if (typeof event.user_id === 'string' && !USER_ID.test(event.user_id)) return null\n")))
await mutant('apply CREDITS the wallet instead of debiting it', () => proveApply(swap(R, "const { debitWallet, InsufficientFundsError } = await import('@/lib/wallet')", "const { creditWallet: debitWallet, InsufficientFundsError } = await import('@/lib/wallet')")))
await mutant('a sub-cent credit is rounded up and applied', () => proveApply(swap(R, "    if (event.topup.micro % BigInt(1000000) !== BigInt(0)) {\n      log(event.eventId, mode, 'config_error:sub_cent_unruled')\n      return respond(503, { error: 'sub_cent_unruled' }) // a cents wallet cannot hold it until PK / ROUTER-2 rule; retried, not dead-lettered\n    }\n    const cents = event.topup.micro / BigInt(1000000)", '    const cents = (event.topup.micro + BigInt(999999)) / BigInt(1000000)')))
await mutant('an unattributed event is debited from someone', () => proveApply(swap(R, "    if (event.userId === null) {\n      log(event.eventId, mode, 'not_applied:unattributed')\n      return respond(200, { received: true, applied: false, reason: 'unattributed' })\n    }\n", '')))
await mutant('a wallet-helper failure is acknowledged as applied (the debit is lost)', () => proveApply(swap(R, "      return respond(503, { error: 'meter_apply_failed' })", '      return respond(200, { received: true, applied: true })')))
await mutant('the body is logged', () => { allLogs.length = 0; return proveSignatures(swap(R, "      log(null, mode, 'bad_signature')", "      log(null, mode, `bad_signature body=${raw.toString('utf8')}`)")).then(() => proveLogs()) })
await mutant('the user and amount are logged', () => { allLogs.length = 0; return proveApply(swap(R, "    log(event.eventId, mode, 'applied')", "    log(event.eventId, mode, `applied:${event.userId}:${String(cents)}`)")).then(() => proveLogs()) })
await mutant('a second method is exported', () => proveFlagOff(swap(R, 'export async function POST(request: Request) {', "export async function GET() { return respond(200, {}) }\nexport async function POST(request: Request) {")))
// drafts, pins, strip, registry, scope
await mutant('a draft anchor at the wrong line', () => proveDrafts(S.BILLING_L5_DRAFTS.map((d, i) => (i === 0 ? { ...d, line: d.line + 1 } : d))))
await mutant('a draft is applied to the owner\'s file', () => proveDrafts(S.BILLING_L5_DRAFTS, rel => (rel === 'app/api/webhooks/stripe/route.ts' ? read(rel).replace("import Stripe from 'stripe'\n", `import Stripe from 'stripe'\n${S.BILLING_L5_DRAFTS[3].add}\n`) : read(rel))))
await mutant('a draft line has no marker', () => proveDrafts(S.BILLING_L5_DRAFTS.map((d, i) => (i === 2 ? { ...d, add: d.add.replace(' // BILLING-L5:', ' //') } : d))))
await mutant('a draft breaks the owner\'s file', () => proveDrafts(S.BILLING_L5_DRAFTS.map((d, i) => (i === 4 ? { ...d, add: '  if (outcome.status === 200 { // BILLING-L5' } : d))))
await mutant('a strip that leaves its line in a taught proof', () => provePins(read, '', laterStrips, (rel, text) => (rel === S.BILLING_L5_PIN_FILES[1] ? text : stripBillingL5(rel, text))))
await mutant('a second subject filter is added to a taught proof', () => provePins(rel => (rel === S.BILLING_L5_PIN_FILES[0] ? `${read(rel)}  shas.splice(0, 1) // LATER-CHANGES: registry read (BILLING-L5)\n` : read(rel))))
await mutant('the env block turns a flag on', () => provePins(rel => (rel === '.env.example' ? swap(read(rel), 'STUDIO_METER_RECEIVER_ENABLED="false"', 'STUDIO_METER_RECEIVER_ENABLED="true"') : read(rel))))
await mutant('the env block gains a value for a key', () => provePins(rel => (rel === '.env.example' ? swap(read(rel), 'METER_WEBHOOK_SECRET=\n', 'METER_WEBHOOK_SECRET=abc\n') : read(rel))))
await mutant('the env block is joined to the last block without a blank line', () => provePins(rel => (rel === '.env.example' ? swap(read(rel), `\n\n${BLOCK.split('\n')[0]}`, `\n${BLOCK.split('\n')[0]}`) : read(rel))))
await mutant('a secret-shaped literal in a new file', () => provePins(rel => (rel === ROUTE ? `${read(rel)}\nconst k = '${'s' + 'k-'}${'a1'.repeat(12)}'\n` : read(rel))))
await mutant('the voice-call carry is missing (dev\'s pin left as it was)', () => proveVoiceCallCarry(rel => (rel === VC ? baseText(VC) : read(rel))))
await mutant('a carried voice-call line differs by one byte', () => proveVoiceCallCarry(rel => (rel === VC ? read(rel).replace('registry read (UX-FINDINGS-E)\n', 'registry read (UX-FINDINGS-E) \n') : read(rel))))
await mutant('the carry is re-marked BILLING-L5', () => proveVoiceCallCarry(rel => (rel === VC ? read(rel).replace("const laterRegistry = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (UX-FINDINGS-E)", "const laterRegistry = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (BILLING-L5)") : read(rel))))
await mutant('credentials in a URL in a test', () => provePins(rel => (rel === 'scripts/test-studio-billing-l5.mjs' ? `${read(rel)}\n// ${'https'}://${'u'}:${'p'}@router.example.test\n` : read(rel))))
if (ON_OWN_LINE) {
  await mutant('a registry line moved off the true end (a line of its own below it that is not a later change\'s)', () => scopeEnvAndRegistry(HEAD, { files: new Set(), strip: (rel, text) => (rel === REG ? text.replace(`  (await import('./studio-billing-l5-strip.mjs')).stripBillingL5,`, `  (await import('./studio-billing-l5-strip.mjs')).stripBillingL5,\n  'not a registration',`) : text) }))
  await mutant('a registry line moved above a line dev already has', () => scopeEnvAndRegistry(HEAD, { files: new Set(), strip: (rel, text) => { if (rel !== REG) return text; const lines = text.split('\n'), at = lines.findIndex(l => l.includes(').stripBillingL5, // LATER-CHANGE:')); [lines[at - 1], lines[at]] = [lines[at], lines[at - 1]]; return lines.join('\n') } }))
  await mutant('a stray file in an own commit', () => scopeCommittedFiles(commitWith(HEAD, { 'lib/stray-l5.ts': 'x\n' }, `${S.BILLING_L5_SUBJECT} stray${TRAILER}`)))
  await mutant('an own commit without the trailer', () => scopeOwnCommits(commitWith(HEAD, {}, `${S.BILLING_L5_SUBJECT} no trailer`)))
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
console.log('test-studio-billing-l5: all checks passed; no network, no router, no Stripe, no database, no key.')
