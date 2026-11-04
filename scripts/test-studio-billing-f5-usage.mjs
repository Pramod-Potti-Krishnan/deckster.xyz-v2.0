// Proof for L-BILLING F5 + Usage page (NEXT_PUBLIC_STUDIO_USAGE_PAGE). Run: node scripts/test-studio-billing-f5-usage.mjs
// A flag-off identity: every existing file outside the change's own edits is the base byte for byte; .env.example is base + the block.
// B no leakage: the new UI files never name tokens, provider cost, margin, model ids or Stripe.  C refusal copy present with a next step.
// D flag is exact "true".  E mutants: each check must fail on a planted defect.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import * as strip from './studio-billing-f5-usage-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 })
const BASE = strip.BASE_COMMIT, HEAD = 'HEAD'
let fails = 0
const ok = (cond, msg) => { if (!cond) { fails++; console.error('FAIL', msg) } else console.log('ok  ', msg) }

// A
const changed = git('diff', '--name-only', `${BASE}..${HEAD}`).split('\n').filter(Boolean)
const tierGuard = new Set(git('diff', '--name-only', `${BASE}..origin/frontend1/tier-update-guard`).split('\n').filter(Boolean))
const stray = changed.filter(f => !strip.BILLING_F5_USAGE_SCOPE_FILES.has(f) && !tierGuard.has(f))
ok(stray.length === 0, `A: only own files changed (stray: ${stray.join(', ')})`)
const env = git('show', `${HEAD}:.env.example`)
ok(env === `${git('show', `${BASE}:.env.example`)}\n${strip.BILLING_F5_USAGE_ENV_BLOCK}\n${strip.BILLING_F5_QUOTA_SCREENS_ENV_BLOCK}`, 'A: .env.example is the base plus the two blocks')
ok(/^NEXT_PUBLIC_STUDIO_QUOTA_SCREENS="false"$/m.test(strip.BILLING_F5_QUOTA_SCREENS_ENV_BLOCK), 'A: quota screens env default "false"')
ok(/^NEXT_PUBLIC_STUDIO_USAGE_PAGE="false"$/m.test(strip.BILLING_F5_USAGE_ENV_BLOCK), 'A: env default "false"')
ok(registry.LATER_CHANGE_FILES.has('lib/studio-billing-usage.ts'), 'A: registered in studio-later-changes')

// B
const UI = ['lib/studio-billing-usage.ts', 'components/billing/quota-refusal.tsx', 'app/(app)/usage/page.tsx']
const LEAK = /\btokens?\b|provider[_ ]?cost|margin|\bstripe\b|\b(gpt|claude|gemini|llama|sonnet|opus|haiku)\b|model[_ ]?id|_usd\b|monthTokens|lifetimeSpend/i
const codeOnly = t => t.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')
const leaks = src => LEAK.test(codeOnly(src))
for (const f of UI) ok(!leaks(readFileSync(f, 'utf8')), `B: no cost/token/model leakage in ${f}`)
const lib = readFileSync('lib/studio-billing-usage.ts', 'utf8')
ok(!/fetch\(/.test(lib) && !/api\/wallet\/debit|stripe/i.test(readFileSync('app/(app)/usage/page.tsx', 'utf8')), 'B: page reads quota + wallet balance only')
ok(/\/api\/usage\/quota/.test(readFileSync('app/(app)/usage/page.tsx', 'utf8')) && /\/api\/wallet\/balance/.test(readFileSync('app/(app)/usage/page.tsx', 'utf8')), 'B: page reads both routes')
ok(/PRICING_TIERS/.test(lib) && !/\$\d/.test(codeOnly(lib).replace(/\$\{/g, '')), 'B: prices only from PRICING_TIERS (no price literal)')

// C
const copyOk = src => ['out of credits', 'Top up credits', 'Upgrade to', 'image limit', 'higher plan'].every(w => src.includes(w))
ok(copyOk(lib), 'C: refusal copy present with Top up / Upgrade next steps')
for (const code of ['credits_exhausted', 'QUOTA_EXCEEDED', 'image_cap_reached', 'model_not_in_plan', 'PLAN_REQUIRED']) ok(lib.includes(`"${code}"`), `C: maps ${code}`)

// D
const flagOk = src => /value === "true"/.test(src) && !/value == "true"|Boolean\(value\)|!!value/.test(src)
ok(flagOk(lib), 'D: flag is exact "true"')
ok(/if \(!isStudioUsagePageOn\(\)\) notFound\(\)/.test(readFileSync('app/(app)/usage/page.tsx', 'utf8')), 'D: page 404s when off')
ok(/if \(!isStudioQuotaScreensOn\(\)\) return null/.test(readFileSync('components/billing/quota-refusal.tsx', 'utf8')), 'D: refusal renders nothing when QUOTA_SCREENS off')

// E mutants
ok(leaks(lib + '\nconst x = q.totals.monthTokens'), 'E: leak check catches monthTokens')
ok(leaks(lib + '\nconst m = "gpt-4o"'), 'E: leak check catches a model id')
ok(!copyOk(lib.replace('Top up credits', 'Buy more')), 'E: copy check catches a missing Top up step')
ok(!flagOk(lib.replace('value === "true"', 'Boolean(value)')), 'E: flag check catches a truthy flag')

// F follow-up: Builder wiring
const BASE2 = 'origin/studio-v4-dev-preparation-code'
for (const rel of strip.BILLING_F5_USAGE_FILES) {
  const head = registry.stripLaterChanges(rel, git('show', `${HEAD}:${rel}`)), base = registry.stripLaterChanges(rel, git('show', `${BASE2}:${rel}`))
  ok(strip.stripBillingF5Usage(rel, git('show', `${HEAD}:${rel}`)) === git('show', `${BASE2}:${rel}`) || head === base, `F: ${rel} minus marked lines is the base (flag-off identity)`)
  const added = git('diff', '-U0', `${BASE2}..${HEAD}`, '--', rel).split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l))
  ok(added.every(l => l.startsWith('+') && strip.BILLING_F5_USAGE_MARKER_RE.test(l)), `F: ${rel} changes are marked insertions only`)
}
const hook = readFileSync('hooks/use-deckster-websocket-v2.ts', 'utf8')
ok(/if \(rawMessage\.type === 'error'\) announceQuotaRefusal\(payload\.code\)/.test(hook), 'F: error frame code goes to the refusal screen')
ok(/if \(isStudioQuotaScreensOn\(\) && !\(await walletPrecheckAllows\(\)\)\) return false/.test(hook), 'F: send path prechecks only when on')
// G code -> screen (mirror of refusalKind, read from the source so a drift fails)
const map = { QUOTA_EXCEEDED: 'credits_exhausted', credits_exhausted: 'credits_exhausted', PLAN_REQUIRED: 'plan_required', model_not_in_plan: 'plan_required', image_cap_reached: 'image_cap_reached', wallet_capped: 'wallet_capped' }
const kindOf = (src, code) => { const sw = src.slice(src.indexOf('export function refusalKind')); const m = sw.slice(0, sw.indexOf('default:')).split('\n').find(l => l.includes(`"${code}"`)); return m && (m.match(/return "(\w+)"/) || [])[1] }
const mapOk = src => Object.entries(map).every(([c, k]) => kindOf(src, c) === k)
ok(mapOk(lib), 'G: each code maps to the right screen')
ok(lib.includes('case "wallet_capped":') && lib.includes('Not enough credits to start'), 'G: wallet_capped has its own screen')
// H precheck: 404 allowed
const preOk = src => { const f = src.slice(src.indexOf('export function precheckAllows')); const body = f.slice(0, f.indexOf('\n}\n')); return /status === 402 \|\| status === 403/.test(body) && /return \{ ok: true \}/.test(body) && !/404/.test(body) }
ok(preOk(lib), 'H: a precheck 404 (or any non-402/403) counts as allowed')
ok(/catch \{\s*return true/.test(lib), 'H: a precheck network failure counts as allowed')
// I two independent flags (PK ruling 4 Nov)
const page = readFileSync('app/(app)/usage/page.tsx', 'utf8'), overlay = readFileSync('components/billing/builder-quota-refusal.tsx', 'utf8'), refusal = readFileSync('components/billing/quota-refusal.tsx', 'utf8')
const flagsOk = ({ lib: l, page: p, overlay: o, refusal: r, hook: h }) =>
  /process\.env\.NEXT_PUBLIC_STUDIO_USAGE_PAGE\)/.test(l) && /process\.env\.NEXT_PUBLIC_STUDIO_QUOTA_SCREENS\)/.test(l)
  && /export function isStudioQuotaScreensOn\(value[^\n]*\n\s*return value === "true"/.test(l)
  && /if \(!isStudioUsagePageOn\(\)\) notFound\(\)/.test(p) && !/isStudioQuotaScreensOn\(\)\) notFound/.test(p)
  && /const out = isStudioQuotaScreensOn\(\) && view\.state === "exhausted"/.test(p)
  && !/isStudioUsagePageOn/.test(o + r + h)
  && /announceQuotaRefusal[\s\S]*?if \(!isStudioQuotaScreensOn\(\)/.test(l) && /walletPrecheckAllows[\s\S]*?if \(!isStudioQuotaScreensOn\(\)\) return true/.test(l)
const parts = { lib, page, overlay, refusal, hook }
ok(flagsOk(parts), 'I: Usage page on USAGE_PAGE; screens, overlay, hook lines and precheck on QUOTA_SCREENS; each independent')
// J UTC month boundaries
const fnSrc = lib.slice(lib.indexOf('export function utcMonthPeriod'), lib.indexOf('\n}\n', lib.indexOf('export function utcMonthPeriod')) + 2)
const loadPeriod = src => new Function(`${src.replace('export function', 'function').replace('(now: Date = new Date()): { start: Date; end: Date; label: string }', '(now = new Date())').replace('(d: Date)', '(d)')}; return utcMonthPeriod`)()
const periodOk = fn => {
  const a = fn(new Date('2026-11-30T23:59:00Z')), b = fn(new Date('2026-12-01T00:00:00Z')), c = fn(new Date('2026-12-31T23:59:59Z'))
  return a.start.toISOString() === '2026-11-01T00:00:00.000Z' && a.end.toISOString() === '2026-12-01T00:00:00.000Z'
    && b.start.toISOString() === '2026-12-01T00:00:00.000Z' && b.end.toISOString() === '2027-01-01T00:00:00.000Z'
    && c.start.getTime() === b.start.getTime() && /Nov 30, 2026 \(UTC\)$/.test(a.label) && /^Dec 1, 2026/.test(b.label)
}
ok(periodOk(loadPeriod(fnSrc)), 'J: UTC month: 2026-11-30T23:59Z is November, 2026-12-01T00:00Z is December; label in UTC')
ok(/utcMonthPeriod\(\)\.label/.test(page), 'J: the Usage page labels the period')
// K monthly caps only
const noShortCaps = src => !/daily|weekly|today|cap_reached"|"cap_reached/i.test(codeOnly(src).replace(/image_cap_reached/g, ''))
ok(noShortCaps(lib) && noShortCaps(page) && noShortCaps(refusal) && noShortCaps(overlay), 'K: no daily/weekly refusal copy or mapping')
// mutants
ok(!flagsOk({ ...parts, overlay: overlay.replace(/isStudioQuotaScreensOn/g, 'isStudioUsagePageOn') }), 'E: flag check catches the overlay on the wrong flag')
ok(!flagsOk({ ...parts, page: page.replace('const out = isStudioQuotaScreensOn() && ', 'const out = ') }), 'E: flag check catches an ungated Usage refusal box')
ok(!periodOk(loadPeriod(fnSrc.replace(/Date\.UTC\((now\.getUTCFullYear\(\), now\.getUTCMonth\(\)(?: \+ 1)?, 1)\)/g, '$1').replace(/getUTC(FullYear|Month)/g, 'get$1'))) || process.env.TZ === 'UTC', 'E: period check catches local-time months (skipped under TZ=UTC)')
ok(!periodOk(loadPeriod(fnSrc.replace('now.getUTCMonth() + 1, 1', 'now.getUTCMonth() + 1, 0'))), 'E: period check catches a wrong end boundary')
ok(!noShortCaps(lib + '\n    case "daily_cap_reached": return "cap_reached"'), 'E: monthly-only check catches a daily mapping')
ok(!mapOk(lib.replace('case "wallet_capped": return "wallet_capped"', 'case "wallet_capped": return "plan_required"')), 'E: map check catches a wrong screen')
ok(!preOk(lib.replace('status === 402 || status === 403', 'status === 402 || status === 403 || status === 404')), 'E: precheck check catches 404 as a refusal')
ok(strip.stripBillingF5Usage('app/builder/page.tsx', 'a\nb // BILLING-F5-USAGE\n') === 'a\n', 'E: strip removes a marked line')
ok(strip.stripBillingF5Usage('app/builder/page.tsx', 'b // BILLING-F5-USAGE-X\n') !== '', 'E: strip keeps a non-token marker')

console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exit(fails ? 1 : 0)
