// FRONTEND-2 (B63): proof that B62's credits view (#589, components/studio-usage-credits.tsx) is wired into FRONTEND-1's Usage page (#585, app/(app)/usage/page.tsx) with exactly TWO marked lines, and that flag off the page is today's page.
// No flag of its own: <StudioUsageCredits /> returns null unless #589's NEXT_PUBLIC_STUDIO_USAGE_CREDITS is exactly "true" (default off); the page itself is a 404 unless FRONTEND-1's NEXT_PUBLIC_STUDIO_USAGE_PAGE is on.
//
//   node scripts/test-studio-usage-credits-page.mjs        (plain node: transpile + vm of the REAL sources, react-dom/server for the markup; the REAL page rendered with its state hooks stubbed; no network, no browser, no .next, no Next runtime)
//
// What it proves:
//  A. the two lines are in the page once each, byte for byte as FRONTEND-1 agreed, at exactly the agreed places: the import right after the "@/lib/studio-billing-usage" import, the JSX line the LAST child of <main> in the loaded return, right after `) : null}`;
//     nothing else in the page changes (a line diff against the base shows two additions and no removal); both lines are clean against FRONTEND-1's own regex pins (copied here, their proof is not imported or edited);
//  B. flag off = today: <StudioUsageCredits className="mt-6" /> renders the empty string; the page's loaded body (ok / low / exhausted, quota screens off and on) renders byte for byte what the base page renders (sha256 shown);
//     the failed and loading screens, which the line is not in, are the base's with the flag on too; flag on, the credits view is the page's last child and the only difference; the page is a 404 without FRONTEND-1's flag, as before;
//  C. credits only (FRONTEND-1's condition 2): the markup and the text of every state of the view (loading, ok, zero usage, a 31-day month, no day detail, no plan, an unknown plan name, every one of the 12 error codes with and without Try again) and of
//     the page with the view on contain no "$", USD, cost, price, token, model or provider wording; a router answer padded with such fields comes out as the same view; FRONTEND-1's own refusal box is the one place a plan price ever shows, and is theirs;
//  D. the strip: put back = the base, byte for byte, for the page and the two older proofs it teaches; idempotent; a file it does not own comes back unchanged; every taught line carries the registry-read mark; the strip is plain data;
//  E. the registry: exactly this change's TWO lines (files, strip), each at the true end of its list right after a registered line the base already has; no .env.example block (no flag); later registered lines are left to their change;
//  F. scope over the COMMITTED diff, GATE-SAFE (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, no hash-object --stdin), each with the co-author line; the whole-diff filter leaves a later REGISTERED file to its change;
//  G. ROBUST AFTER MERGE (a branch stacked after this change through dev's merge: a second parent) and a LINEAR STACK (a later change directly on this head adds a registered-shape registry line below ours and a subject-filter line beside ours in a taught proof):
//     the scope still passes; an unregistered file in that commit still fails;
//  H. mutants are caught (each is one edit of the real sources, fed to the same checks).
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import {
  BASE_COMMIT, USAGE_CREDITS_PAGE_EDITS, USAGE_CREDITS_PAGE_FILE, USAGE_CREDITS_PAGE_FLAG, USAGE_CREDITS_PAGE_IMPORT, USAGE_CREDITS_PAGE_IMPORT_AFTER, USAGE_CREDITS_PAGE_JSX, USAGE_CREDITS_PAGE_JSX_AFTER, USAGE_CREDITS_PAGE_MARKER_RE,
  USAGE_CREDITS_PAGE_NEW_FILES, USAGE_CREDITS_PAGE_OWN_EDITS, USAGE_CREDITS_PAGE_PIN_AFTER, USAGE_CREDITS_PAGE_PIN_EDITS, USAGE_CREDITS_PAGE_PIN_FILES, USAGE_CREDITS_PAGE_PIN_MARK, USAGE_CREDITS_PAGE_SCOPE_FILES, USAGE_CREDITS_PAGE_SUBJECT,
  stripUsageCreditsPage,
} from './studio-usage-credits-page-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
/** Only the strips of the changes registered AFTER this one, in the registry's order: on a branch stacked after this change a later change's own lines are undone first, so a file reads as this change left it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripUsageCreditsPage); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const count = (text, needle) => text.split(needle).length - 1

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
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}  [${String(error.message).replace(/\s+/g, ' ').slice(0, 100)}]`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

// ---- the real sources in a vm -------------------------------------------------------------------------------------------------------------------
const PAGE = USAGE_CREDITS_PAGE_FILE, COMP = 'components/studio-usage-credits.tsx', LIB = 'lib/studio-usage-credits.ts', BILLING = 'lib/studio-billing-usage.ts', PRICING = 'lib/marketing/homepage-v2-pricing.ts', REGISTRY = 'scripts/studio-later-changes.mjs'
const FLAG = USAGE_CREDITS_PAGE_FLAG, PAGE_FLAG = 'NEXT_PUBLIC_STUDIO_USAGE_PAGE', SCREENS_FLAG = 'NEXT_PUBLIC_STUDIO_QUOTA_SCREENS'
// The two lines, byte for byte as FRONTEND-1 agreed them (owner OK, 6 Nov 16:28Z). The strip's constants must be these.
const AGREED_IMPORT = 'import { StudioUsageCredits } from "@/components/studio-usage-credits" // USAGE-CREDITS'
const AGREED_JSX = '      <StudioUsageCredits className="mt-6" />{/* USAGE-CREDITS */}'
const BILLING_IMPORT_LINE = 'import { formatCredits, isStudioQuotaScreensOn, isStudioUsagePageOn, refusalCopy, usageView, utcMonthPeriod, type UsageView } from "@/lib/studio-billing-usage"'
const COMP_SRC = read(COMP)
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const h = React.createElement
const Link = ({ href, className, children }) => h('a', { href, className }, children)
/** Load one real source in a new context. `overrides` replace any import (the page's react, the credits component); everything else the page imports is the REAL source, loaded with the same `env`. */
function load(rel, { env = {}, text, overrides = {} } = {}) {
  const module = { exports: {} }
  const req = spec => {
    if (spec in overrides) return overrides[spec]
    if (spec === 'react') return React
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    if (spec === '@/lib/studio-usage-credits') return load(LIB, { env })
    if (spec === '@/lib/studio-billing-usage') return load(BILLING, { env })
    if (spec === '@/lib/marketing/homepage-v2-pricing') return load(PRICING, { env })
    if (spec === '@/components/studio-usage-credits') return load(COMP, { env })
    if (spec === 'next/navigation') return { notFound() { throw new Error('NEXT_NOT_FOUND') } }
    if (spec === 'next/link') return { __esModule: true, default: Link }
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, text ?? read(rel)), { module, exports: module.exports, require: req, process: { env: { ...env } }, URL, AbortSignal }, { filename: rel })
  return module.exports
}
const ENV_ON = { [FLAG]: 'true' }
const lib = load(LIB, { env: ENV_ON })

// ---- the Usage page rendered with its state hooks stubbed (no Next runtime): the loaded return, the failed screen, the loading screen -----------------------
const QUOTAS = {
  ok: [{ tier: 'free', tierLabel: 'Free', caps: { monthlyCents: 1000 }, spent: { monthlyCents: 100 } }, 500],
  low: [{ tier: 'free', tierLabel: 'Free', caps: { monthlyCents: 1000 }, spent: { monthlyCents: 900 } }, 0],
  exhausted: [{ tier: 'free', tierLabel: 'Free', caps: { monthlyCents: 1000 }, spent: { monthlyCents: 1000 } }, 0],
}
/** The page's UsageBody reads three states in order (view, tier, failed): the stub hands them out, so the loaded return (or the failed / loading screen) is drawn. useEffect (the fetches) never runs in a server render. */
function renderPage({ pageText, compText, credits = false, screens = false, pageOn = true, quota = 'ok', stage = 'loaded' } = {}) {
  const env = { ...(pageOn ? { [PAGE_FLAG]: 'true' } : {}), ...(screens ? { [SCREENS_FLAG]: 'true' } : {}), ...(credits ? { [FLAG]: 'true' } : {}) }
  const [q, wallet] = QUOTAS[quota], view = stage === 'loaded' ? load(BILLING, { env }).usageView(q, wallet) : null
  let n = 0
  const stubReact = { ...React, useState: () => { const slot = n++ % 3; return [slot === 0 ? view : slot === 1 ? q.tier : stage === 'failed', () => {}] } }
  const overrides = { react: stubReact, ...(compText === undefined ? {} : { '@/components/studio-usage-credits': load(COMP, { env, text: compText }) }) }
  return renderToStaticMarkup(h(load(PAGE, { env, text: pageText, overrides }).default))
}
const creditsHtml = (compText = COMP_SRC, props = { className: 'mt-6' }, env = ENV_ON) => renderToStaticMarkup(h(load(COMP, { env, text: compText }).StudioUsageCredits, props))
const textOf = html => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()

// ---- FRONTEND-1's own regex pins on the page (scripts/test-studio-billing-f5-usage.mjs, B, D, I, J, K), copied here: that proof is theirs, it is not imported or edited ----------------
const F5_LEAK = /\btokens?\b|provider[_ ]?cost|margin|\bstripe\b|\b(gpt|claude|gemini|llama|sonnet|opus|haiku)\b|model[_ ]?id|_usd\b|monthTokens|lifetimeSpend/i
const F5_SHORT = /daily|weekly|today|cap_reached"|"cap_reached/i
const codeOnly = t => t.split('\n').filter(l => !/^\s*(\/\/|\/\*\*.*\*\/\s*$|\*)/.test(l)).join('\n') // comments (// and one-line /** */) are not UI
const f5PageOk = src => !F5_LEAK.test(codeOnly(src)) && !/api\/wallet\/debit|stripe/i.test(codeOnly(src)) && /\/api\/usage\/quota/.test(src) && /\/api\/wallet\/balance/.test(src)
  && /if \(!isStudioUsagePageOn\(\)\) notFound\(\)/.test(src) && !/isStudioQuotaScreensOn\(\)\) notFound/.test(src) && /const out = isStudioQuotaScreensOn\(\) && view\.state === "exhausted"/.test(src) && /utcMonthPeriod\(\)\.label/.test(src)
  && !F5_SHORT.test(codeOnly(src).replace(/image_cap_reached/g, ''))
/** CREDITS ONLY: no dollar sign, USD, cost, price, token, model or provider wording, in markup or text. */
const CREDITS_ONLY_LEAK = /\$|\busd\b|_usd\b|dollar|\bcosts?\b|\bprices?\b|per[ -]token|\btokens?\b|\bmodels?\b|provider|openrouter|margin|\bcents?\b|\b(gpt|claude|gemini|llama|sonnet|opus|haiku)\b/i

// ===== A. the two lines ============================================================================================================================
console.log('A. the two lines in the Usage page')
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const lineDiff = (before, after) => { const b = before.split('\n'), a = after.split('\n'), out = []; let i = 0, j = 0; while (i < b.length || j < a.length) { if (b[i] === a[j]) { i++; j++ } else if (a[j] !== undefined && !b.slice(i).includes(a[j])) { out.push(`+${a[j++]}`) } else if (b[i] !== undefined && !a.slice(j).includes(b[i])) { out.push(`-${b[i++]}`) } else { out.push(`-${b[i++]}`); out.push(`+${a[j++]}`) } } return out }
/** `now` is the page as this change leaves it (a later change's lines already taken out). */
function provePage(now, at = '') {
  const a = m => (at ? `${at}: ${m}` : m), base = baseText(PAGE), lines = now.split('\n')
  assert.equal(USAGE_CREDITS_PAGE_IMPORT, AGREED_IMPORT, a('the strip carries the agreed import line, byte for byte')); assert.equal(USAGE_CREDITS_PAGE_JSX, AGREED_JSX, a('the strip carries the agreed JSX line, byte for byte'))
  assert.equal(USAGE_CREDITS_PAGE_IMPORT_AFTER, BILLING_IMPORT_LINE); assert.equal(USAGE_CREDITS_PAGE_JSX_AFTER, '      ) : null}')
  assert.equal(count(`\n${now}`, `\n${AGREED_IMPORT}\n`), 1, a('the import line is there exactly once, as a whole line')); assert.equal(count(`\n${now}`, `\n${AGREED_JSX}\n`), 1, a('the JSX line is there exactly once, as a whole line'))
  assert.equal(lines.filter(line => USAGE_CREDITS_PAGE_MARKER_RE.test(line)).length, 2, a('two marked lines and no other'))
  // the import: right after the one import of "@/lib/studio-billing-usage"
  const importAt = lines.indexOf(AGREED_IMPORT)
  assert.equal(lines.filter(line => /^import .* from "@\/lib\/studio-billing-usage"/.test(line)).length, 1, a('the page has one studio-billing-usage import'))
  assert.equal(lines[importAt - 1], BILLING_IMPORT_LINE, a('the import is right after the line that imports "@/lib/studio-billing-usage"')); assert.equal(lines[importAt - 1].includes('from "@/lib/studio-billing-usage"'), true)
  // the JSX line: the last child of the LOADED <main>, right after `) : null}`
  const jsxAt = lines.indexOf(AGREED_JSX), open = lines.findIndex(line => line.trimStart().startsWith('<main') && line.includes('data-testid="studio-usage-page"'))
  assert.equal(lines[jsxAt - 1], '      ) : null}', a('the JSX line is right after `) : null}`')); assert.equal(lines[jsxAt + 1], '    </main>', a('and right before </main>'))
  assert.ok(open > 0 && open < jsxAt, a('inside the loaded return\'s <main data-testid="studio-usage-page">')); assert.equal(lines.findIndex((line, i) => i > open && line.trim() === '</main>'), jsxAt + 1, a('the first </main> after that <main> closes right after the line: it is the last child'))
  assert.equal(lines.filter((line, i) => i > open && i < jsxAt && /<main\b/.test(line)).length, 0, a('no other <main> opens in between'))
  assert.equal(AGREED_JSX.split('<').length - 1, 1, a('one JSX element and a comment: nothing wraps it')); assert.match(AGREED_JSX, /^ {6}<StudioUsageCredits className="mt-6" \/>\{\/\* USAGE-CREDITS \*\/\}$/)
  // no other byte changes
  const diff = lineDiff(base, now); assert.deepEqual(diff.filter(line => line.startsWith('-')), [], a('nothing is removed or rewritten')); assert.deepEqual(diff, [`+${AGREED_IMPORT}`, `+${AGREED_JSX}`], a('exactly the two lines are added, import first'))
  assert.equal(stripUsageCreditsPage(PAGE, now), base, a('without its two lines the page is the base\'s, byte for byte'))
  // clean against FRONTEND-1's own pins
  for (const line of [AGREED_IMPORT, AGREED_JSX]) { assert.doesNotMatch(line, F5_LEAK, a('clean against FRONTEND-1\'s leak pin')); assert.doesNotMatch(line, F5_SHORT, a('clean against FRONTEND-1\'s daily / weekly pin')) }
  assert.equal(f5PageOk(base), true, a('positive control: the base page passes the copied pins')); assert.equal(f5PageOk(now), true, a('the page with the two lines passes FRONTEND-1\'s pins B, D, I, J and K, copied'))
  assert.match(now, /^"use client"\n/, a('"use client" stays first'))
}
await check('the page has the two lines once each, byte for byte as agreed: the import right after the studio-billing-usage import, the JSX line the last child of the loaded <main>, right after `) : null}`; a line diff against dev shows two additions and nothing else; both clean against FRONTEND-1\'s own regex pins', () => provePage(laterStrips(PAGE, read(PAGE))))

// ===== B. flag off = today =========================================================================================================================
console.log('B. flag off is today\'s page')
const COMBOS = [['ok', false], ['ok', true], ['low', false], ['low', true], ['exhausted', false], ['exhausted', true]]
/** Flag off: the component draws nothing, and the page (with the two lines) renders byte for byte what the base page renders, in every loaded state; flag on: the view is the page's last child and the only difference. Returns the sha256 evidence rows. */
function proveFlagOff(pageNow, compText = COMP_SRC) {
  const base = baseText(PAGE), rows = []
  assert.equal(creditsHtml(compText, { className: 'mt-6' }, {}), '', 'flag off: <StudioUsageCredits className="mt-6" /> renders the empty string'); assert.equal(creditsHtml(compText, undefined, {}), '')
  for (const value of ['false', 'TRUE', '1', 'yes', ' true', 'true ', '']) assert.equal(creditsHtml(compText, { className: 'mt-6' }, { [FLAG]: value }), '', `${JSON.stringify(value)} is off`)
  const on = creditsHtml(compText); assert.match(on, /^<section class="suc mt-6" data-studio-usage-credits="true" data-state="loading"/, 'flag on: the loading state first, the className on its own root')
  for (const [quota, screens] of COMBOS) {
    const off = renderPage({ pageText: pageNow, compText, credits: false, screens, quota }), today = renderPage({ pageText: base, credits: false, screens, quota })
    assert.equal(off, today, `${quota}, quota screens ${screens ? 'on' : 'off'}: flag off, the page with the two lines renders byte for byte what dev's page renders`); assert.equal(sha(off), sha(today))
    assert.match(off, /data-testid="studio-usage-page"/, 'the loaded body is what is drawn'); assert.equal(count(off, 'data-studio-usage-credits'), 0, 'no credits view with the flag off'); assert.ok(off.endsWith('</main>'))
    const withView = renderPage({ pageText: pageNow, compText, credits: true, screens, quota })
    assert.equal(withView, `${off.slice(0, -'</main>'.length)}${on}</main>`, `${quota}, screens ${screens ? 'on' : 'off'}: flag on, the credits view is the last child of <main> and the only difference`); assert.equal(count(withView, 'data-studio-usage-credits="true"'), 1)
    assert.equal(renderPage({ pageText: base, credits: true, screens, quota }), today, 'dev\'s page does not look at the credits flag'); rows.push(`${quota}/${screens ? 'screens' : 'plain'} ${sha(off)}`)
  }
  for (const stage of ['failed', 'loading']) { // the line is in the loaded return only: these screens are the base's even with the view on
    const today = renderPage({ pageText: base, stage }); assert.match(today, stage === 'failed' ? /couldn&#x27;t load your usage/ : /Loading…/)
    for (const credits of [false, true]) assert.equal(renderPage({ pageText: pageNow, compText, credits, stage }), today, `${stage} screen, credits ${credits ? 'on' : 'off'}: the base's, byte for byte`)
  }
  for (const credits of [false, true]) { assert.throws(() => renderPage({ pageText: base, pageOn: false, credits }), /NEXT_NOT_FOUND/, 'the base page is a 404 without FRONTEND-1\'s flag'); assert.throws(() => renderPage({ pageText: pageNow, compText, pageOn: false, credits }), /NEXT_NOT_FOUND/, 'and so is the page with the two lines, credits flag on or off') }
  return rows
}
await check('flag off: <StudioUsageCredits className="mt-6" /> renders the empty string (also for every mis-spelled flag); the REAL page\'s loaded body (ok / low / exhausted, quota screens off and on) renders byte for byte what dev\'s page renders (sha256); flag on the view is the last child of <main> and the only difference; the failed and loading screens and the 404 are the base\'s', () => {
  const rows = proveFlagOff(laterStrips(PAGE, read(PAGE))); console.log(`     flag-off page markup sha256/16 (with the two lines = dev's page): ${rows.join('; ')}`)
})

// ===== C. credits only =============================================================================================================================
console.log('C. credits only')
const EXAMPLE = {
  user_id: 'user_123', as_of: '2026-11-02T12:00:00Z', month: { start: '2026-11-01T00:00:00Z', end: '2026-12-01T00:00:00Z' }, credits_used: '3.000000', credits_left: '4502.500000',
  balance_period: { key: '2026-10-15T07:00:00Z', start: '2026-10-15T07:00:00Z', end: '2026-11-15T07:00:00Z' }, plan: 'pro', plan_source: 'fresh',
  plan_credits_granted: '5000.000000', plan_credits_used: '510.000000', plan_credits_left: '4490.000000', topup_credits_left: '12.500000',
  daily: [{ date: '2026-11-01', credits_used: '2.250000' }, { date: '2026-11-02', credits_used: '0.750000' }],
}
const days = (from, n, amount = '1.000000') => Array.from({ length: n }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, from + i)).toISOString().slice(0, 10), credits_used: amount }))
const viewOf = (over = {}) => { const parsed = lib.parseUsageCredits({ ...EXAMPLE, ...over }, 'user_123'); assert.equal(parsed.ok, true, JSON.stringify(parsed)); return parsed.view }
const GOOD = viewOf(), ZERO = viewOf({ credits_used: '0.000000', daily: EXAMPLE.daily.map(d => ({ ...d, credits_used: '0.000000' })) })
const ready = view => ({ kind: 'ready', view }), errorState = (code, retryAfterSeconds = null) => ({ kind: 'error', code, retryAfterSeconds })
const STATES = [
  ['loading', { kind: 'loading' }], ['ok', ready(GOOD)], ['zero usage', ready(ZERO)], ['a 31-day month', ready(viewOf({ daily: days(1, 31, '1.500000') }))], ['no day detail', ready({ ...GOOD, daily: [] })],
  ['no plan', ready({ ...GOOD, planCreditsGranted: '0.000000', planCreditsUsed: '0.000000', planCreditsLeft: '0.000000' })], ['one credit', ready({ ...GOOD, creditsUsed: '1.000000', daily: [{ date: '2026-11-01', creditsUsed: '1.000000' }] })],
  ['an unknown plan name', ready({ ...GOOD, plan: 'team' })], ['over the grant', ready({ ...GOOD, planCreditsUsed: '9000.000000' })],
  ...lib.USAGE_CREDITS_ERROR_CODES.flatMap(code => [[`error ${code}`, errorState(code, code === 'usage_read_rate_limited' ? 30 : null)]]), ['error rate limited, one second', errorState('usage_read_rate_limited', 1)],
]
const FOREIGN_FIELDS = { cost_usd: '9.990000', provider_cost: '1.230000', usd: '1.00', margin: '0.5', tokens: 123, total_tokens: 456, model: 'a-model', provider: 'a-provider', model_id: 'a-model-id', credit_limit_usd: '10.000000', by_model: [{ model: 'm', tokens: 7, cost_usd: '1.000000' }] }
const viewMarkup = (state, compText, retry) => renderToStaticMarkup(h(load(COMP, { env: ENV_ON, text: compText }).StudioUsageCreditsView, { state: plain(state), ...(retry ? { onRetry: () => {} } : {}) }))
/** Every state of the view, with and without Try again, and the page with the view on, say credits and nothing else. */
function proveCreditsOnly(compText = COMP_SRC, pageNow = laterStrips(PAGE, read(PAGE))) {
  assert.ok(STATES.length >= 21, 'every state is listed (loading, ok, zero, 31 days, no days, no plan, one credit, unknown plan, over the grant, 12 error codes, a one-second wait)')
  for (const [name, state] of STATES) for (const retry of [true, false]) {
    const html = viewMarkup(state, compText, retry); assert.ok(html.length > 40, `${name}: something is drawn`)
    assert.doesNotMatch(html, CREDITS_ONLY_LEAK, `${name}: no $, USD, cost, price, token, model or provider wording in the markup`); assert.doesNotMatch(textOf(html), CREDITS_ONLY_LEAK, `${name}: ... nor in the text`)
  }
  // a router answer padded with cost, token and model fields comes out as the same view, and the view draws none of them
  const padded = { ...EXAMPLE, ...FOREIGN_FIELDS, month: { ...EXAMPLE.month, ...FOREIGN_FIELDS }, balance_period: { ...EXAMPLE.balance_period, ...FOREIGN_FIELDS }, daily: EXAMPLE.daily.map(day => ({ ...day, ...FOREIGN_FIELDS })) }
  const parsed = lib.parseUsageCredits(padded, 'user_123'); assert.equal(parsed.ok, true); assert.equal(JSON.stringify(parsed.view), JSON.stringify(GOOD), 'a padded answer is the same view')
  for (const key of Object.keys(FOREIGN_FIELDS)) assert.equal(JSON.stringify(parsed.view).includes(`"${key}"`), false, `the view carries no ${key}`)
  assert.doesNotMatch(viewMarkup(ready(parsed.view), compText, true), CREDITS_ONLY_LEAK, 'the padded answer draws no cost, token or model')
  // the page: the loaded body with the view on, plain and with quota screens on
  for (const [quota, screens] of COMBOS) {
    const html = renderPage({ pageText: pageNow, compText, credits: true, screens, quota })
    // FRONTEND-1's own refusal box (quota screens on, exhausted) carries the next plan's price in its upgrade button: theirs, unchanged; everything else is held to the rule
    const rest = html.replace(/<section class="mt-6 rounded-lg border p-5" data-testid="quota-refusal">[\s\S]*?<\/section>/, '')
    assert.equal(rest === html, !(screens && quota === 'exhausted'), `${quota}/${screens}: the refusal box is there only when FRONTEND-1's screens flag is on and the plan is exhausted`)
    assert.doesNotMatch(rest, CREDITS_ONLY_LEAK, `${quota}/${screens}: the page's markup without FRONTEND-1's refusal box has no $, USD, cost, price, token, model or provider wording`); assert.doesNotMatch(textOf(rest), CREDITS_ONLY_LEAK)
    const off = renderPage({ pageText: pageNow, compText, credits: false, screens, quota }), added = html.slice(off.length - '</main>'.length, html.length - '</main>'.length)
    assert.match(added, /^<section class="suc mt-6"/); assert.doesNotMatch(textOf(added), CREDITS_ONLY_LEAK, `${quota}/${screens}: what the two lines add to the page is credits only`)
  }
}
await check('credits only (FRONTEND-1\'s condition 2): the markup and the text of every state of the view (21+ states, with and without Try again), of a padded router answer, and of the real page with the view on (plain and with quota screens on) have no $, USD, cost, price, token, model or provider wording; FRONTEND-1\'s own refusal box is the only place a plan price shows', () => proveCreditsOnly())
await check('positive controls: the leak pattern catches each kind of word it is for, and the view really draws credits (so "no leak" is not "nothing drawn")', () => {
  for (const word of ['$5', '5 USD', 'cost_usd', 'the cost', 'a price', 'per token', '3 tokens', 'the model', 'provider', 'openrouter', 'margin', '500 cents', 'gpt', 'Sonnet']) assert.match(word, CREDITS_ONLY_LEAK, word)
  for (const word of ['credits', 'Plan credits used', 'Top-up credits left (never expire)', 'This UTC month', 'Total you can spend']) assert.doesNotMatch(word, CREDITS_ONLY_LEAK, word)
  const okText = textOf(viewMarkup(ready(GOOD), COMP_SRC, true)); assert.match(okText, /Plan credits used 510 of 5,000/); assert.match(okText, /Total you can spend 4,502\.5/); assert.match(okText, /This UTC month 3 credits used/)
  assert.match(textOf(renderPage({ pageText: laterStrips(PAGE, read(PAGE)), compText: COMP_SRC, credits: true })), /Plan credits used \S+ of \S+ Plan credits left .*Loading your credits…$/)
})

// ===== D. the strip ================================================================================================================================
console.log('D. the strip')
const LEGACY_FILES = ['app/builder/page.tsx', 'app/(app)/billing/page.tsx', 'lib/studio-billing-usage.ts', 'components/studio-usage-credits.tsx', REGISTRY, 'scripts/test-studio-usage-credits.mjs', 'scripts/test-studio-billing-f5-usage.mjs', '.env.example']
function proveStrip(strip, readNow = read, later = laterStrips, at = '') {
  const a = m => (at ? `${at}: ${m}` : m)
  assert.deepEqual(Object.keys(USAGE_CREDITS_PAGE_EDITS).sort(), [PAGE, ...USAGE_CREDITS_PAGE_PIN_FILES].sort(), a('the strip edits the page and the two older proofs, nothing else'))
  assert.deepEqual(USAGE_CREDITS_PAGE_EDITS[PAGE], [[`${AGREED_IMPORT}\n`, ''], [`${AGREED_JSX}\n`, '']], a('the page pairs are the two agreed lines, was = ""'))
  for (const [rel, edits] of Object.entries(USAGE_CREDITS_PAGE_EDITS)) {
    const now = later(rel, readNow(rel)), base = baseText(rel)
    assert.equal(strip(rel, now), base, a(`${rel}: put back it is the base's, byte for byte`)); assert.equal(strip(rel, strip(rel, now)), base, a(`${rel}: put back twice changes nothing more`))
    for (const [has, was] of edits) assert.equal(count(`\n${now}`, `\n${has}`), 1, a(`${rel}: an edited line is there exactly once`))
    const diff = lineDiff(base, now), has = edits.flatMap(([hasText]) => hasText.split('\n').filter(Boolean)), was = edits.flatMap(([, wasText]) => wasText.split('\n').filter(Boolean))
    assert.deepEqual(diff.filter(line => line.startsWith('+')), has.map(line => `+${line}`), a(`${rel}: exactly the edited lines are added`)); assert.deepEqual(diff.filter(line => line.startsWith('-')), was.map(line => `-${line}`), a(`${rel}: nothing of the base is gone`))
  }
  for (const rel of USAGE_CREDITS_PAGE_PIN_FILES) {
    const now = later(rel, readNow(rel)), lines = now.split('\n'), marked = lines.filter(line => line.includes(USAGE_CREDITS_PAGE_PIN_MARK))
    assert.equal(marked.length, 1, a(`${rel}: one taught line, carrying the registry-read mark`)); assert.equal(`${marked[0]}\n`, USAGE_CREDITS_PAGE_PIN_EDITS[rel][0][0])
    assert.ok(/^ {2}shas\.splice\(0, shas\.length, \.\.\.shas\.filter\(sha => !\/\^Usage credits page:\/\.test\(git\('log', '-1', '--format=%s', sha\)\)\)\) \/\/ LATER-CHANGES: registry read \(USAGE-CREDITS-PAGE\): /.test(marked[0]), a(`${rel}: the taught line is a subject filter for "Usage credits page:"`))
    assert.ok(USAGE_CREDITS_PAGE_PIN_EDITS[rel].every(([, was]) => !was.includes(USAGE_CREDITS_PAGE_PIN_MARK)), a('the put-back text has no mark'))
    const at0 = lines.indexOf(marked[0]); assert.ok(/shas\.filter\(sha => !\/\^/.test(lines[at0 - 1]) && baseText(rel).split('\n').includes(lines[at0 - 1]), a(`${rel}: an insertion right after a subject filter its base already has (the last one before it, whichever change that is)`))
    assert.equal(lines.filter(line => /shas\.filter\(sha => !\/\^Usage credits page:\//.test(line)).length, 1, a(`${rel}: no second filter for this subject`))
  }
  // a file it does not own comes back unchanged (also with the lines in it); a longer line that merely ends with a line is not a line; a non-string is returned as it is
  for (const rel of LEGACY_FILES) { const text = readNow(rel); assert.equal(strip(rel, text), text, a(`${rel}: not this change's: returned as it is`)) }
  assert.equal(strip('app/builder/page.tsx', `${AGREED_IMPORT}\n${AGREED_JSX}\n`), `${AGREED_IMPORT}\n${AGREED_JSX}\n`, a('the lines in another file stay')); assert.equal(strip(PAGE, 1), 1); assert.equal(strip(PAGE, undefined), undefined)
  assert.equal(strip(PAGE, `x${AGREED_JSX}\n`), `x${AGREED_JSX}\n`, a('a line that merely ends with it is not it')); assert.equal(strip(PAGE, `${AGREED_JSX}x\n`), `${AGREED_JSX}x\n`)
  assert.equal(strip(PAGE, `a\n${AGREED_IMPORT}\n${AGREED_IMPORT}\nb\n`), `a\n${AGREED_IMPORT}\nb\n`, a('a line that is there twice is a merge mistake: only the first goes, the older pins still see the second'))
  assert.equal(strip(PAGE, 'a\nb\n'), 'a\nb\n', a('a page without the lines is returned as it is'))
}
await check('the strip: the page and the two taught proofs put back are the base\'s, byte for byte, idempotent; every taught line is one subject filter with the registry-read mark, right after a filter the base has; a file it does not own (also with the lines in it), a longer line, a non-string and a page without the lines come back as they are; a doubled line is not hidden', () => proveStrip(stripUsageCreditsPage))
await check('the strip is plain data: no imports, nothing read from disk or git; its marker is a whole token; the page lines are clean of credential-shaped text; the subject is not #589\'s', () => {
  const text = read('scripts/studio-usage-credits-page-strip.mjs')
  assert.doesNotMatch(text.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/`[^`]*`/g, '``').replace(/\/\/.*$/gm, ''), /^import |require\(|readFileSync|execFileSync/m, 'no imports, nothing read from disk or git')
  assert.ok(USAGE_CREDITS_PAGE_MARKER_RE.test('a // USAGE-CREDITS') && !USAGE_CREDITS_PAGE_MARKER_RE.test('a // USAGE-CREDITS-X') && !USAGE_CREDITS_PAGE_MARKER_RE.test('a // X-USAGE-CREDITS') && !USAGE_CREDITS_PAGE_MARKER_RE.test('a // STUDIO_USAGE_PAGE'), 'the marker is a whole token')
  assert.equal(USAGE_CREDITS_PAGE_SUBJECT, 'Usage credits page:'); assert.equal(USAGE_CREDITS_PAGE_SUBJECT.startsWith('Usage credits:'), false, 'not #589\'s subject (its proof names the page as a foreign file for commits with that subject)')
  assert.equal(FLAG, 'NEXT_PUBLIC_STUDIO_USAGE_CREDITS', 'no new flag: #589\'s'); assert.match(BASE_COMMIT, /^[0-9a-f]{40}$/); git('merge-tree', '--write-tree', BASE_COMMIT, 'HEAD') // the base is a full sha this branch is built on
  assert.equal(USAGE_CREDITS_PAGE_PIN_AFTER.includes('Chat caps:'), true)
  for (const rel of [...USAGE_CREDITS_PAGE_NEW_FILES]) assert.doesNotMatch(read(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, `${rel}: no secret-shaped literal`)
  for (const rel of USAGE_CREDITS_PAGE_NEW_FILES) assert.doesNotMatch(read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, ''), new RegExp(`-{2}std${'in'}`), `${rel}: no stdin pipe into git (hash-object reads a temporary file)`)
})

// ===== E. the registry =============================================================================================================================
console.log('E. the registry')
const END = '  // one line per later change, above this comment'
const OWN_NAME = 'studio-usage-credits-page-strip.mjs'
/** The list a registry line sits in (the nearest `export const LATER_...` above it). */
const sectionOf = (lines, at) => { for (let i = at; i >= 0; i--) { const m = /^export const (LATER_\w+)/.exec(lines[i]); if (m) return m[1] } return null }
function proveRegistryText(regText) {
  const reg = regText.split('\n'), baseReg = baseText(REGISTRY).split('\n')
  /** Registry lines a change registered AFTER this one added (in each list, below this change's line, in the registered shape): that change's, not this one's. A stray line is still counted. */
  const laterRegistry = (() => { const later = new Set(); let after = false; for (const line of reg) { if (/^export const LATER_/.test(line)) after = false; else if (line.includes(OWN_NAME)) after = true; else if (after && line.includes('// LATER-CHANGE:') && /-strip\.mjs/.test(line)) later.add(line) } return later })()
  const diff = lineDiff(baseText(REGISTRY), regText).filter(line => !(line.startsWith('+') && laterRegistry.has(line.slice(1))))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes(OWN_NAME)); assert.equal(own.length, 2, 'the registry gains exactly this change\'s TWO lines')
  for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE: FRONTEND-2, '), line.slice(0, 140))
  assert.deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['USAGE_CREDITS_PAGE_SCOPE_FILES', 'stripUsageCreditsPage'], 'one files line, one strip line')
  assert.equal(diff.length, 2, 'and nothing else in the registry')
  assert.deepEqual(own.map(line => sectionOf(reg, reg.indexOf(line.slice(1)))), ['LATER_CHANGE_FILES', 'LATER_STRIPS'], 'one in the files list, one in the strips list, none in the env list (no flag, no block)')
  for (const line of own) {
    const at = reg.indexOf(line.slice(1)); assert.ok(at > 0, line.slice(1, 80))
    assert.ok(baseReg.includes(reg[at - 1]) && reg[at - 1].includes('// LATER-CHANGE:') && reg[at - 1].includes('studio-chain-test-fix-strip.mjs'), `right after studio-chain-test-fix-strip.mjs's line, a registered line dev already has: ${line.slice(1, 80)}`)
    assert.ok(reg[at + 1].startsWith('  // one line per later change') || laterRegistry.has(reg[at + 1]), 'the true end of its list (or followed only by a later change\'s registered line)')
  }
}
function proveRegistryAt(head) {
  proveRegistryText(git('show', `${head}:${REGISTRY}`))
  const envText = git('show', `${head}:.env.example`); assert.equal(registry.stripLaterEnvBlocks('.env.example', envText), registry.stripLaterEnvBlocks('.env.example', baseText('.env.example')), '.env.example is dev\'s plus the registered blocks and nothing else: this change adds no block (no flag)')
}
await check('the registry file at HEAD: this change\'s files, its strip and nothing in the env list; every scope file is registered, the strip comes after every older strip', () => {
  assert.ok(registry.LATER_STRIPS.includes(stripUsageCreditsPage), 'the registry holds the strip'); assert.ok([...USAGE_CREDITS_PAGE_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'and every file')
  const ownAt = registry.LATER_STRIPS.indexOf(stripUsageCreditsPage), chainAt = registry.LATER_STRIPS.findIndex(fn => typeof fn === 'function' && fn.name === 'stripChainTestFix'); assert.ok(chainAt > 0 && ownAt > chainAt, 'the strip comes after studio-chain-test-fix-strip.mjs\'s')
  const regLines = read(REGISTRY).split('\n'); assert.equal(regLines.filter(line => line.includes(OWN_NAME)).length, 2, 'two lines name this change\'s strip module')
  assert.deepEqual(regLines.map((line, i) => (line.includes(OWN_NAME) ? sectionOf(regLines, i) : null)).filter(Boolean), ['LATER_CHANGE_FILES', 'LATER_STRIPS'], 'in the files list and the strips list, not the env list')
})

// ===== F. scope ====================================================================================================================================
console.log('F. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-06T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-06T00:00:00Z' }
const plumb = (args, env = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ucp-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(USAGE_CREDITS_PAGE_SUBJECT)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees none of them on the gate's merge. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query: on the gate's merge (dev first, this change's head second) the scope runs against HEAD^2; elsewhere HEAD itself. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim(), parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
/** No older change's subject filter (the taught proofs' own `shas.filter(sha => !/^…/` lines at dev) matches this change's subject, and #589's "Usage credits:" does not either; this change's own filter is the one that does. */
const subjectFilters = text => text.split('\n').filter(line => /shas\.filter\(sha => !\//.test(line)).map(line => new RegExp(/shas\.filter\(sha => !\/(.+?)\/\.test\(git\(/.exec(line)[1]))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (?:Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  const olderFilters = USAGE_CREDITS_PAGE_PIN_FILES.flatMap(rel => subjectFilters(baseText(rel)))
  assert.ok(olderFilters.length >= 20, 'the older subject filters are read from the taught proofs at dev')
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) { const subject = subjectOf(c); if (isOwnSubject(subject)) assert.ok(!subject.startsWith('Usage credits:') && !olderFilters.some(re => re.test(subject)), `${c.slice(0, 8)} would be taken for an older change's own commit`) }
  return own
}
/** Lanes this change must not touch (FRONTEND-1's, COMPOSER-2's, the reconnect proof): the page's two lines are the only thing of theirs. */
const LANES = /^(scripts\/test-studio-(p2-|billing-|launch-wording|env-append-tolerant|route-params|admin-email-guard|uat-marketing|deck-title|flow-control)|scripts\/test-atlas-help-recovery|scripts\/test-director-websocket-reconnect|scripts\/test-(deck-card-thumbnail|first-paint)|lib\/studio-flow-control\.ts|hooks\/use-studio-flow-control\.ts|lib\/studio-billing-usage\.ts)/
const UNTOUCHED = ['components/studio-usage-credits.tsx', 'components/studio-usage-credits.css', 'lib/studio-usage-credits.ts', 'app/api/usage/credits/route.ts', 'app/api/usage/quota/route.ts', 'app/(app)/billing/page.tsx', 'components/billing/quota-refusal.tsx', 'components/billing/builder-quota-refusal.tsx', 'hooks/use-deckster-websocket-v2.ts', 'app/builder/page.tsx', '.env.example', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'next.config.mjs']
const scopeCommittedFiles = (head, { later = laterStrips, registered = registry.LATER_CHANGE_FILES } = {}) => {
  const own = scopeOwnCommits(head), touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  assert.deepEqual([...touched].sort(), [...USAGE_CREDITS_PAGE_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  assert.deepEqual([...net].filter(rel => USAGE_CREDITS_PAGE_SCOPE_FILES.has(rel) || !registered.has(rel)).sort(), [...USAGE_CREDITS_PAGE_SCOPE_FILES].sort(), 'and the whole committed diff from BASE is nothing else (a file the registry names for a later change, stacked on this head, is left to that change; an unregistered file still fails)')
  provePage(later(PAGE, git('show', `${head}:${PAGE}`)), 'committed')
  for (const rel of USAGE_CREDITS_PAGE_NEW_FILES) { assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel); assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${rel}`), undefined, `${rel} is new: dev has none`) }
  for (const rel of USAGE_CREDITS_PAGE_PIN_FILES) assert.equal(stripUsageCreditsPage(rel, later(rel, git('show', `${head}:${rel}`))), baseText(rel), `${rel}: an older proof taught: put back it is the base's (a later change's registered lines out first)`)
  for (const rel of UNTOUCHED) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
  for (const rel of touched) assert.ok(!LANES.test(rel), `${rel} is in FRONTEND-1's, COMPOSER-2's or the reconnect proof's lane: only the page's two lines may be`)
}
const scopeAll = (head, opts) => { scopeOwnCommits(head); scopeCommittedFiles(head, opts); proveRegistryAt(head) }

const HEAD = scopeHead('HEAD')
/** This change's own commits on the FIRST-PARENT line of `head` from BASE. Merged into dev, its commits come in by a merge's second parent and that line has none of them. */
const ownOnLine = head => git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** There the committed diff from BASE holds the later changes' work too, so the scope checks stand down; the pins (read past the later changes' strips) and every other section still run. */
const ON_OWN_LINE = ownOnLine(HEAD).length > 0
const scopeCheck = (label, fn) => (ON_OWN_LINE ? check(label, fn) : undefined)
const scopeMutant = (label, fn) => (ON_OWN_LINE ? mutant(label, fn) : undefined)
if (!ON_OWN_LINE) console.log('NOTE scope: no commit of this change on the first-parent line from BASE (merged into dev: its commits are on a second parent); the scope checks stand down, the pins above cover the files')
await scopeCheck(`this change's own commits (subject starts "${USAGE_CREDITS_PAGE_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's (the taught proofs' filters at dev do not match, #589's "Usage credits:" does not)`, () => { scopeOwnCommits(HEAD) })
await scopeCheck('the committed files are exactly this change\'s: the page, the strip, this proof, the registry and the two taught proofs; the view, its lib and route, FRONTEND-1\'s lib, proofs and pages, the Builder, .env.example, package.json and the lockfile are not touched', () => scopeCommittedFiles(HEAD))
await scopeCheck('the registry gains exactly this change\'s two marked lines (files, strip) at the true end of each list, right after studio-chain-test-fix-strip.mjs\'s, none in the env list, and loses none; .env.example is dev\'s plus the registered blocks', () => proveRegistryAt(HEAD))
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : null
await scopeCheck('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); proveRegistryAt(GATE)
  assert.equal(stripUsageCreditsPage(PAGE, git('show', `${GATE}:${PAGE}`)), baseText(PAGE), 'the merged tree, without this change\'s two lines, is dev\'s page'); provePage(laterStrips(PAGE, git('show', `${GATE}:${PAGE}`)), 'merged tree')
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await scopeCheck('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ucp-idx-'))
  try {
    const envIdx = { GIT_INDEX_FILE: path.join(dir, 'index') }
    plumb(['read-tree', parent], envIdx)
    for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], envIdx)
    return plumb(['commit-tree', plumb(['write-tree'], envIdx), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = ON_OWN_LINE ? commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE') : null
const ADVANCED_GATE = ON_OWN_LINE ? gateMerge(unrelated, HEAD) : null
await scopeCheck('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE: the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); proveRegistryAt(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
const scopeBreakers = {
  'a stray file in an own commit': () => { const stray = commitWith(HEAD, { 'stray-usage-credits-page.txt': 'stray\n' }, `${USAGE_CREDITS_PAGE_SUBJECT} a stray file${TRAILER}`); assert.ok(ownOf(stray).includes(stray)); assert.doesNotThrow(() => scopeCommittedFiles(HEAD)); scopeCommittedFiles(stray) },
  'an own commit without the co-author line': () => { const c = commitWith(HEAD, {}, `${USAGE_CREDITS_PAGE_SUBJECT} no trailer`); assert.throws(() => scopeOwnCommits(c), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named'); scopeOwnCommits(c) },
}
await scopeCheck('scope: a stray file in an own commit fails the files check, an own commit without the co-author line is named, a touched foreign file of the Usage / billing lane (FRONTEND-1\'s proof, lib, billing page) or the view itself fails it, and a real own commit set still passes', () => {
  assert.throws(scopeBreakers['a stray file in an own commit'], /exactly its scope/); assert.throws(scopeBreakers['an own commit without the co-author line'], error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of ['scripts/test-studio-billing-f5-usage.mjs', 'lib/studio-billing-usage.ts', 'components/studio-usage-credits.tsx', 'app/(app)/billing/page.tsx']) {
    const foreign = commitWith(HEAD, { [rel]: `${git('show', `${HEAD}:${rel}`)}\n` }, `${USAGE_CREDITS_PAGE_SUBJECT} touches ${rel}${TRAILER}`)
    assert.notEqual(git('show', `${foreign}:${rel}`), git('show', `${HEAD}:${rel}`), `positive control: ${rel} is changed`); assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched|lane/, rel)
  }
  scopeAll(HEAD)
})

// ===== G. robust after merge, and a linear stack ===================================================================================================
console.log('G. robust after merge; a linear stack')
const SYN = { file: 'scripts/test-studio-deck-sync-truth.mjs', mark: 'registry read (SYNTHETIC-LATER)' }
const synStrip = (rel, text) => (rel === SYN.file && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.mark)).join('\n') : text)
const SYN_FILTER = `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Synthetic later:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: ${SYN.mark}: a made-up change stacked after this one`
const SYN_FILES = "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_LATER_SCOPE_FILES, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"
const SYN_STRIP = "  (await import('./studio-synthetic-later-strip.mjs')).stripSyntheticLater, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"
const after = (lines, needle, line) => { const at = lines.findIndex(l => l.includes(needle)); assert.ok(at > 0, `${needle} is there`); lines.splice(at + 1, 0, line); return lines }
/** A later change stacked after this one: its subject filter beside this one's in a taught proof (and, with `registryLines`, its two registered-shape lines below ours in the registry). */
const laterCommit = (onto, { registryLines = false, extra = {} } = {}) => {
  const edits = { [SYN.file]: after(git('show', `${onto}:${SYN.file}`).split('\n'), 'registry read (USAGE-CREDITS-PAGE)', SYN_FILTER).join('\n'), ...extra }
  if (registryLines) edits[REGISTRY] = after(after(git('show', `${onto}:${REGISTRY}`).split('\n'), ').USAGE_CREDITS_PAGE_SCOPE_FILES, // LATER-CHANGE:', SYN_FILES), ').stripUsageCreditsPage, // LATER-CHANGE:', SYN_STRIP).join('\n')
  return commitWith(onto, edits, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const synLater = (rel, text) => synStrip(rel, laterStrips(rel, text))
function provePins(readAt, at, later) {
  provePage(later(PAGE, readAt(PAGE)), at); proveStrip(stripUsageCreditsPage, readAt, later, at)
}
await check('ROBUST AFTER MERGE: on a branch stacked after this change (dev\'s merge brings it in by a second parent, then a later change adds its subject filter beside this one\'s in a taught proof) no own commit is on the first-parent line, the scope stands down there, and the pins, read past the later change\'s strip, still pass', () => {
  const dev = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : HEAD, later = laterCommit(dev), readAt = rel => git('show', `${later}:${rel}`)
  assert.equal(ownOf(later).length, ownOf(HEAD).length, 'this change\'s commits are all there (by the second parent)'); if (ON_OWN_LINE) assert.deepEqual(ownOnLine(later), [], 'none of them on the first-parent line: the scope checks stand down there')
  provePins(readAt, 'stacked after', synLater)
  assert.throws(() => provePins(readAt, 'stacked after, not told', laterStrips), /put back it is the base's|exactly the edited lines|exactly once|one taught line|no second filter/, 'mutant caught: without the later change\'s strip, its line breaks the put-back')
})
await scopeCheck('LINEAR STACK: a later change directly on this head (a registered-shape registry line below ours in each list, a subject-filter line beside ours in a taught proof, removed by its own strip passed into laterStrips): this change\'s own commits are still on the first-parent line, the scope still passes, the registry check leaves its lines to it, and the pins pass', () => {
  const later = laterCommit(HEAD, { registryLines: true }), readAt = rel => git('show', `${later}:${rel}`)
  assert.deepEqual(parentsOf(later), [HEAD]); assert.equal(ownOnLine(later).length, ownOnLine(HEAD).length, 'this change\'s commits are on the first-parent line of the later head: the scope checks RUN there')
  assert.equal(scopeHead(later), later); scopeAll(later, { later: synLater }); provePins(readAt, 'linear stack', synLater)
  assert.throws(() => proveRegistryText(after(git('show', `${later}:${REGISTRY}`).split('\n'), ').stripSyntheticLater, // LATER-CHANGE:', "  (await import('./studio-synthetic-later-strip.mjs')).stripSyntheticLaterToo, // stray: not in the registered shape").join('\n')), /nothing else in the registry/, 'a registry line that is not in the registered shape is still counted')
  // the same on a gate-style merge of that stack
  const gate = gateMerge(BASE_COMMIT, later); assert.equal(scopeHead(gate), later); scopeAll(scopeHead(gate), { later: synLater })
})
await scopeCheck('LINEAR STACK: an unregistered file in the later commit still fails the whole-diff check; the same file once the registry names it (a later change\'s own file) is left to its change', () => {
  const stray = laterCommit(HEAD, { registryLines: true, extra: { 'stray-later-change.txt': 'stray\n' } })
  assert.throws(() => scopeCommittedFiles(stray, { later: synLater }), /nothing else/, 'an unregistered file fails')
  assert.doesNotThrow(() => scopeCommittedFiles(stray, { later: synLater, registered: new Set([...registry.LATER_CHANGE_FILES, 'stray-later-change.txt']) }), 'a registered one is that change\'s')
  const straySubject = commitWith(HEAD, { 'stray-later-change.txt': 'stray\n' }, `Proofs after merge: an unregistered file${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(straySubject), /nothing else/, 'a later commit with another subject that touches a file the registry does not name still fails')
})

// ===== H. mutants (each one edit of the real sources, fed to the same checks) ===================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const PAGE_SRC = laterStrips(PAGE, read(PAGE))
const withoutLine = (text, line) => { const lines = text.split('\n'), at = lines.indexOf(line); assert.ok(at >= 0, 'the line is there'); lines.splice(at, 1); return lines }
const pageMutant = edit => { const out = edit(PAGE_SRC); if (out === PAGE_SRC) throw new SwapError('the edit did not change the page'); return out }
const everyPage = text => { provePage(text, 'mutant'); assert.equal(stripUsageCreditsPage(PAGE, text), baseText(PAGE)) }
await mutant('A: the JSX line moved above `) : null}` (into the ternary)', () => everyPage(pageMutant(text => { const lines = withoutLine(text, AGREED_JSX); lines.splice(lines.indexOf('      ) : null}'), 0, AGREED_JSX); return lines.join('\n') })))
await mutant('A: the JSX line moved to the top of <main> (right after the heading)', () => { const text = pageMutant(t => { const lines = withoutLine(t, AGREED_JSX); lines.splice(lines.findIndex(l => l.includes('<h1 className="text-2xl font-semibold">Usage</h1>') && l.startsWith('      ')) + 1, 0, AGREED_JSX); return lines.join('\n') }); everyPage(text) })
await mutant('B: the JSX line moved to the top of <main> renders the view first (the last-child check of flag on fails)', () => { const text = pageMutant(t => { const lines = withoutLine(t, AGREED_JSX); lines.splice(lines.findIndex(l => l.includes('<h1 className="text-2xl font-semibold">Usage</h1>') && l.startsWith('      ')) + 1, 0, AGREED_JSX); return lines.join('\n') }); proveFlagOff(text) })
await mutant('A: the import moved (to the top, above the react import)', () => everyPage(pageMutant(text => { const lines = withoutLine(text, AGREED_IMPORT); lines.splice(1, 0, AGREED_IMPORT); return lines.join('\n') })))
await mutant('A: the import moved (below the component, after the first function)', () => everyPage(pageMutant(text => { const lines = withoutLine(text, AGREED_IMPORT); lines.splice(lines.indexOf('function UsageBody() {'), 0, AGREED_IMPORT); return lines.join('\n') })))
await mutant('A: the import is not marked', () => everyPage(pageMutant(text => swap(text, AGREED_IMPORT, AGREED_IMPORT.replace(' // USAGE-CREDITS', '')))))
await mutant('A: the JSX line is not marked', () => everyPage(pageMutant(text => swap(text, AGREED_JSX, AGREED_JSX.replace('{/* USAGE-CREDITS */}', '')))))
await mutant('A: an extra unmarked page line (a constant above the return)', () => everyPage(pageMutant(text => swap(text, '  const out = isStudioQuotaScreensOn()', '  const sneaky = 1\n  const out = isStudioQuotaScreensOn()'))))
await mutant('A: an extra marked page line (a second use of the view)', () => everyPage(pageMutant(text => swap(text, AGREED_JSX, `${AGREED_JSX}\n      <StudioUsageCredits />{/* USAGE-CREDITS */}`))))
await mutant('A: the page wraps the view in a div', () => everyPage(pageMutant(text => swap(text, AGREED_JSX, '      <div className="mt-6"><StudioUsageCredits /></div>{/* USAGE-CREDITS */}'))))
await mutant('A: a base line of the page rewritten', () => everyPage(pageMutant(text => swap(text, '<h1 className="text-2xl font-semibold">Usage</h1>\n      <p className="mt-1', '<h1 className="text-3xl font-semibold">Usage</h1>\n      <p className="mt-1'))))
await mutant('A: the page leaks a word FRONTEND-1\'s pins refuse (a token line in the page)', () => everyPage(pageMutant(text => swap(text, '<span>Plan credits used</span>', '<span>Plan tokens used</span>'))))
await mutant('B: the dispatch wraps the view in a div (flag off would leave an empty spaced box)', () => proveFlagOff(pageMutant(text => swap(text, AGREED_JSX, '      <div className="mt-6"><StudioUsageCredits /></div>{/* USAGE-CREDITS */}'))))
await mutant('B: the view draws with the flag off', () => proveFlagOff(laterStrips(PAGE, read(PAGE)), swap(COMP_SRC, 'return STUDIO_USAGE_CREDITS_ENABLED ? <StudioUsageCreditsLoader className={className} /> : null', 'return <StudioUsageCreditsLoader className={className} />')))
await mutant('B: the view draws a wrapper with the flag off', () => proveFlagOff(laterStrips(PAGE, read(PAGE)), swap(COMP_SRC, 'return STUDIO_USAGE_CREDITS_ENABLED ? <StudioUsageCreditsLoader className={className} /> : null', "return STUDIO_USAGE_CREDITS_ENABLED ? <StudioUsageCreditsLoader className={className} /> : <div className={className} />")))
await mutant('B: the flag is read as truthy ("TRUE", "yes")', () => proveFlagOff(laterStrips(PAGE, read(PAGE)), swap(COMP_SRC, 'return STUDIO_USAGE_CREDITS_ENABLED ? <StudioUsageCreditsLoader', 'return (STUDIO_USAGE_CREDITS_ENABLED || process.env.NEXT_PUBLIC_STUDIO_USAGE_CREDITS) ? <StudioUsageCreditsLoader')))
await mutant('B: the page body differs with the flag off (the page loses a base line)', () => proveFlagOff(pageMutant(text => swap(text, '<h1 className="text-2xl font-semibold">Usage</h1>\n      <p className="mt-1', '<h1 className="text-2xl font-semibold">Usage</h1>\n      <p className="mt-2'))))
await mutant('C: a leak word in a state (the sign-in state says "$5 cost")', () => proveCreditsOnly(swap(COMP_SRC, "title: 'Sign in to see your credits'", "title: 'Sign in to see your $5 cost'")))
await mutant('C: a leak word in the ok state ("tokens" in the chart heading)', () => proveCreditsOnly(swap(COMP_SRC, '<h3>This UTC month</h3>', '<h3>This UTC month, tokens</h3>')))
await mutant('C: a leak word in the loading state ("model")', () => proveCreditsOnly(swap(COMP_SRC, 'Loading your credits…', 'Loading your model credits…')))
await mutant('C: the page text leaks (the page says "price per token")', () => proveCreditsOnly(COMP_SRC, pageMutant(text => swap(text, '<span>Top-up credits (never expire)</span>', '<span>Top-up price per token</span>'))))
await mutant('D: a strip that leaves a line (the JSX line stays)', () => proveStrip((rel, text) => (rel === PAGE ? text.split('\n').filter(line => line !== AGREED_IMPORT).join('\n') : stripUsageCreditsPage(rel, text))))
await mutant('D: a strip that leaves a line (the import stays)', () => proveStrip((rel, text) => (rel === PAGE ? text.split('\n').filter(line => line !== AGREED_JSX).join('\n') : stripUsageCreditsPage(rel, text))))
await mutant('D: a strip that does not put a taught proof back', () => proveStrip((rel, text) => (USAGE_CREDITS_PAGE_PIN_FILES.includes(rel) ? text : stripUsageCreditsPage(rel, text))))
await mutant('D: a strip that is not idempotent (it takes one more line away each time)', () => proveStrip((rel, text) => { const out = stripUsageCreditsPage(rel, text); return rel === PAGE && out === text ? out.replace(/^"use client"\n/, '') : out }))
await mutant('D: a strip that edits a file it does not own', () => proveStrip((rel, text) => (rel === 'app/builder/page.tsx' ? `${text}x` : stripUsageCreditsPage(rel, text))))
await mutant('D: a taught proof keeps a second, unmarked line', () => proveStrip(stripUsageCreditsPage, rel => (rel === USAGE_CREDITS_PAGE_PIN_FILES[0] ? read(rel).replace(USAGE_CREDITS_PAGE_PIN_EDITS[rel][0][0], `${USAGE_CREDITS_PAGE_PIN_EDITS[rel][0][0]}  // stray\n`) : read(rel))))
await mutant('D: a taught line without the registry-read mark', () => proveStrip(stripUsageCreditsPage, rel => (rel === USAGE_CREDITS_PAGE_PIN_FILES[1] ? swap(read(rel), 'registry read (USAGE-CREDITS-PAGE): on a branch', 'on a branch') : read(rel))))
await mutant('D: a taught line put somewhere that is not after a subject filter', () => proveStrip(stripUsageCreditsPage, rel => {
  if (rel !== USAGE_CREDITS_PAGE_PIN_FILES[0]) return read(rel)
  const lines = read(rel).split('\n'), at = lines.findIndex(l => l.includes(USAGE_CREDITS_PAGE_PIN_MARK)), [line] = lines.splice(at, 1); lines.splice(lines.findIndex(l => l.startsWith('import ')), 0, line); return lines.join('\n')
}))
const REG_NOW = read(REGISTRY)
const regLinesOf = text => text.split('\n')
await mutant('E: a registry line in the env list too (a block this change does not have)', () => { const reg = regLinesOf(REG_NOW); reg.splice(reg.findIndex(l => l.includes(').CHAT_CAPS_ENV_BLOCK, // LATER-CHANGE:')) + 1, 0, "  (await import('./studio-usage-credits-page-strip.mjs')).USAGE_CREDITS_PAGE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B63 mutant"); proveRegistryText(reg.join('\n')) })
await mutant('E: the files line above dev\'s last line (not the true end of its list)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('SCOPE_FILES')), [line] = reg.splice(at, 1); reg.splice(reg.findIndex(l => l.includes('studio-chain-test-fix-strip.mjs') && l.includes('SCOPE_FILES')), 0, line); proveRegistryText(reg.join('\n')) })
await mutant('E: the strip line missing (a files line without its strip)', () => proveRegistryText(regLinesOf(REG_NOW).filter(l => !(l.includes(OWN_NAME) && l.includes('stripUsageCreditsPage'))).join('\n')))
await mutant('E: the files line missing', () => proveRegistryText(regLinesOf(REG_NOW).filter(l => !(l.includes(OWN_NAME) && l.includes('SCOPE_FILES'))).join('\n')))
await mutant('E: a line of dev\'s registry lost', () => { const reg = regLinesOf(REG_NOW); reg.splice(reg.findIndex(l => l.includes('studio-chat-caps-strip.mjs') && l.includes('stripChatCaps')), 1); proveRegistryText(reg.join('\n')) })
await mutant('E: a second files line (two lines in one list)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('SCOPE_FILES')); reg.splice(at + 1, 0, reg[at]); proveRegistryText(reg.join('\n')) })
await mutant('E: a registry line that is not in the registered shape below ours', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('stripUsageCreditsPage')); reg.splice(at + 1, 0, "  (await import('./studio-x-strip.mjs')).stripX, // not registered"); proveRegistryText(reg.join('\n')) })
await mutant('E: .env.example gains a block', () => { assert.equal(registry.stripLaterEnvBlocks('.env.example', `${baseText('.env.example')}\n# a block\nNEXT_PUBLIC_X="false"\n`), registry.stripLaterEnvBlocks('.env.example', baseText('.env.example')), '.env.example is dev\'s plus the registered blocks') })
if (ON_OWN_LINE) {
  await mutant('F: a stray file in an own commit', () => scopeBreakers['a stray file in an own commit']())
  await mutant('F: an own commit without the co-author line', () => scopeBreakers['an own commit without the co-author line']())
  await mutant('F: the old first-parent query (finds no own commit on the gate-style merge)', () => scopeOwnCommits(GATE, { firstParentOnly: true }))
  await mutant('F: the HEAD^2 rule dropped (the scope runs against the merge itself)', () => { assert.equal(scopeHead(GATE, { gateRule: false }), HEAD, 'the scope head is the change\'s head') })
  await mutant('F: a touched file of FRONTEND-1\'s proofs (an own commit edits their usage proof)', () => scopeCommittedFiles(commitWith(HEAD, { 'scripts/test-studio-billing-f5-usage.mjs': `${git('show', `${HEAD}:scripts/test-studio-billing-f5-usage.mjs`)}\n` }, `${USAGE_CREDITS_PAGE_SUBJECT} edits their proof${TRAILER}`)))
  await mutant('F: an unmarked line added to the page in an own commit', () => scopeCommittedFiles(commitWith(HEAD, { [PAGE]: swap(git('show', `${HEAD}:${PAGE}`), '  const out = isStudioQuotaScreensOn()', '  const sneaky = 1\n  const out = isStudioQuotaScreensOn()') }, `${USAGE_CREDITS_PAGE_SUBJECT} a sneaky line${TRAILER}`)))
  await mutant('G: a later commit with an unregistered file stacked on this head', () => scopeCommittedFiles(laterCommit(HEAD, { registryLines: true, extra: { 'stray-later-change.txt': 'stray\n' } }), { later: synLater }))
  await mutant('G: the later change\'s strip not told to the pins (its line breaks the put-back)', () => provePins(rel => git('show', `${laterCommit(HEAD, { registryLines: true })}:${rel}`), 'linear stack, not told', laterStrips))
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { for (const label of failed) console.error(`  failed: ${label}`); for (const label of missed) console.error(`  missed: ${label}`); process.exit(1) }
