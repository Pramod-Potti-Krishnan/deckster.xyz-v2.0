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
ok(env === `${git('show', `${BASE}:.env.example`)}\n${strip.BILLING_F5_USAGE_ENV_BLOCK}` || env.endsWith(strip.BILLING_F5_USAGE_ENV_BLOCK), 'A: .env.example ends with the block')
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
ok(/if \(!isStudioUsagePageOn\(\)\) return null/.test(readFileSync('components/billing/quota-refusal.tsx', 'utf8')), 'D: refusal renders nothing when off')

// E mutants
ok(leaks(lib + '\nconst x = q.totals.monthTokens'), 'E: leak check catches monthTokens')
ok(leaks(lib + '\nconst m = "gpt-4o"'), 'E: leak check catches a model id')
ok(!copyOk(lib.replace('Top up credits', 'Buy more')), 'E: copy check catches a missing Top up step')
ok(!flagOk(lib.replace('value === "true"', 'Boolean(value)')), 'E: flag check catches a truthy flag')

console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exit(fails ? 1 : 0)
