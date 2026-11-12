// FRONTEND-1 UX honesty (frontend1/ux-honesty-polish, no flag): the user-facing words state only what is true.
// Run: node scripts/test-studio-ux-honesty.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   1. no Google Slides export claim on any user-facing surface (Help, Docs content, Billing, /docs/api, the Studio pages; /integrations, whose data still lists it, redirects away and that redirect is held);
//   2. no hard-coded plan price outside the pricing source (lib/marketing/homepage-v2-pricing.ts, PRICING_TIERS) on Help, Billing, the Docs content or /docs/api;
//   3. Billing's plan facts are the pricing source's: the plan always comes from PRICING_TIERS (no flag), no invented quota ("Unlimited presentations", "3 presentations", "N AI agents"), no "Enterprise";
//      Help's plan facts are the pricing source's: every capability Help says a tier adds is in that tier's own feature list, and Help states no head-count of agents;
//   4. /docs/api says "API access is not open yet" and lists no endpoint; the Docs content says "Deckster", never "deckster"; Help and Docs name the create button by its current label;
//   5. mutants: each claim put back is caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { LATER_STRIPS } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (CHAIN-TEST-FIX)
import { stripUxHonesty as stripOwnUxHonesty } from './studio-ux-honesty-strip.mjs' // LATER-CHANGES: registry read (CHAIN-TEST-FIX)

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
let checks = 0
const ok = (value, message) => { checks++; assert.ok(value, message) }

function loadPricing(source) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const sandbox = { module: { exports: {} }, exports: {} }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(js, sandbox)
  return sandbox.module.exports.PRICING_TIERS
}

const PRICING_SOURCE = 'lib/marketing/homepage-v2-pricing.ts'
const HELP = 'app/help/page.tsx', BILLING = 'app/(app)/billing/page.tsx', DOCS = 'content/docs.ts', API = 'app/docs/api/page.tsx'
const SURFACES = [HELP, BILLING, DOCS, API, 'components/help/studio-help.tsx', 'lib/studio-p2-docs.ts']

// ---- the checks, as functions of the texts, so the mutants can run them
const GOOGLE_EXPORT = /Google Slides/i
const PLAN_PRICE = /(?:Starter|Pro|Max|Premium|Free|Enterprise)\b[^\n"]{0,25}\$\d|\$\d+(?:\.\d+)?\s*(?:\/|per)\s*(?:user|month|mo\b|year)|\(\$\d+\)/
const INVENTED = /Unlimited presentations|unlimited presentations|\b\d+ presentations\b|\b(?:All )?\d+ AI agents\b|Upgrade to Enterprise|\$29\/month|\$290\/year/
const HEADCOUNT = /\b(?:four|five|six|seven|eight|nine|\d+)\s+(?:AI\s+)?(?:specialists|agents)\b/i

function checkSurfaces(files) {
  for (const [rel, text] of Object.entries(files)) {
    ok(!GOOGLE_EXPORT.test(text), `${rel}: no Google Slides claim`)
    const lines = text.split('\n').filter(line => !/id: "pack_\d+"/.test(line)) // top-up pack labels are amounts, not plan prices
    ok(!lines.some(line => PLAN_PRICE.test(line)), `${rel}: no hard-coded plan price (the pricing page states them)`)
  }
}

function checkBilling(text) {
  text = LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripOwnUxHonesty) + 1).reduce((t, f) => f('app/(app)/billing/page.tsx', t), text) // LATER-CHANGES: registry read (CHAIN-TEST-FIX): the lines changes registered AFTER this one put on Billing (F4/F6 widened the pricing import) are put back first
  ok(/import \{ PRICING_TIERS \} from "@\/lib\/marketing\/homepage-v2-pricing"/.test(text), 'Billing reads the pricing source')
  ok(/\n  const plan = studioPlanForTier\(PRICING_TIERS, user\.tier\)\n/.test(text), 'Billing: the plan always comes from the pricing source (no flag)')
  ok(/\{studioBillingPriceLine\(PRICING_TIERS, user\.tier, subscription\?\.billingCycle\)\}/.test(text), 'Billing: the price line always comes from the pricing source')
  ok(!INVENTED.test(text), 'Billing: no invented plan fact (unlimited / N presentations / N AI agents / Enterprise / $29)')
  ok(/href="\/pricing"/.test(text), 'Billing: a free account is pointed at the pricing page')
}

function checkHelp(text, tiers) {
  ok(!HEADCOUNT.test(text), 'Help: no agent head-count')
  ok(!/New Presentation/.test(text), 'Help: no stale "New Presentation" label')
  ok(/New deck/.test(text), 'Help: the current "New deck" label')
  const answer = /question: "What do the higher tiers add\?",\s*answer: "([^"]+)"/.exec(text)?.[1]
  ok(answer, 'Help: the tiers answer is there')
  for (const sentence of answer.split(/(?<=\.)\s+/)) {
    const tier = tiers.find(t => sentence.startsWith(`${t.name} `))
    if (!tier) continue
    const words = tier.features.join(' ')
    for (const capability of ['Researcher', 'Analyst', 'Knowledge Graph', 'Theme Builder', 'Visualizer']) {
      if (sentence.includes(capability)) ok(words.includes(capability), `Help: "${capability}" is in ${tier.name}'s own features`)
    }
  }
  for (const tier of tiers) ok(!text.includes(tier.price), `Help: ${tier.name}'s price (${tier.price}) is not hard-coded`)
}

function checkDocs(text) {
  ok(!/\bdeckster\b(?![.@/])/.test(text.replace(/[\w.-]*deckster\.[a-z]+/g, '')), 'Docs: "Deckster", never "deckster"')
  ok(!/New Presentation/.test(text), 'Docs: no stale "New Presentation" label')
  ok(/Choose your format \(PDF or PowerPoint\)/.test(text), 'Docs: the export formats are PDF and PowerPoint')
}

function checkApi(text) {
  ok(/API access is not open yet/.test(text), '/docs/api: says API access is not open yet')
  ok(!/\/v1\/|Bearer|Core Endpoints|Rate Limits|requests per minute/.test(text), '/docs/api: no endpoint, auth scheme or rate limit')
}

const tiers = loadPricing(read(PRICING_SOURCE))
ok(Array.isArray(tiers) && tiers.map(t => t.id).join() === 'starter,pro,premium', 'the pricing source: Starter, Pro, Max')

function all(files) {
  checkSurfaces(Object.fromEntries(SURFACES.map(rel => [rel, files[rel]])))
  checkBilling(files[BILLING]); checkHelp(files[HELP], tiers); checkDocs(files[DOCS]); checkApi(files[API])
}
const real = Object.fromEntries(SURFACES.map(rel => [rel, read(rel)]))
all(real)
ok(/source: '\/integrations', destination: '\/bring#inout'/.test(read('next.config.mjs')), '/integrations (whose data still lists Google Slides) redirects away: not user-facing')
const realChecks = checks

// ---- mutants: each dishonest claim put back must be caught
const MUTANTS = [
  [DOCS, 'Choose your format (PDF or PowerPoint)', 'Choose your format (PDF, PowerPoint, Google Slides)'],
  [DOCS, '### Images (PNG/JPEG)', '### Google Slides\nExport to Google Slides\n\n### Images (PNG/JPEG)'],
  [DOCS, 'Welcome to Deckster!', 'Welcome to deckster!'],
  [DOCS, 'click "New deck"', 'click "New Presentation"'],
  [HELP, 'See the pricing page for the current plans and prices.', 'Starter is $20/user/mo.'],
  [HELP, 'or see the pricing page for the current plans and prices.', 'Choose Starter ($20), Pro ($50), or Max ($100) per user / month.'],
  [HELP, 'You talk to the Director in plain English.', 'Deckster runs as eight specialists.'],
  [HELP, 'Pro adds the Researcher', 'Pro adds the Knowledge Graph and the Researcher'],
  [HELP, 'Click \\"New deck\\"', "Click the 'New Presentation'"],
  [BILLING, '  const plan = studioPlanForTier(PRICING_TIERS, user.tier)', '  const plan = STUDIO_P2_ACCOUNT ? studioPlanForTier(PRICING_TIERS, user.tier) : null'],
  [BILLING, '{studioBillingPriceLine(PRICING_TIERS, user.tier, subscription?.billingCycle)}', '{user.tier === "pro" ? "$50/month" : "No charge"}'],
  [BILLING, 'No paid plan yet.', 'Unlimited presentations.'],
  [BILLING, 'No paid plan yet.', '3 presentations, 2 AI agents.'],
  [BILLING, '{`Upgrade to ${nextPlan.name}`}', '"Upgrade to Enterprise"'],
  [API, 'There is no public API today', 'Core Endpoints: there is no public API today'],
  [API, 'subtitle="API access is not open yet."', 'subtitle="POST /v1/presentations/generate"'],
]
let killed = 0
for (const [rel, from, to] of MUTANTS) {
  assert.ok(real[rel].includes(from), `mutant anchor present in ${rel}: ${from}`)
  const files = { ...real, [rel]: real[rel].replace(from, to) }
  let caught = false
  try { all(files) } catch { caught = true }
  assert.ok(caught, `mutant survived in ${rel}: ${to}`)
  killed++
}
// ---- UX-09 (NEXT_PUBLIC_STUDIO_PAGE_HEADINGS, exact "true", default off): one page container and heading style
const { execFileSync } = await import('node:child_process')
const strip = await import('./studio-ux-honesty-strip.mjs')
const pageConsistency = await import('./studio-page-consistency-strip.mjs') // PAGE-CONSISTENCY is a later change on the same layout: it comes out first
const registry = await import('./studio-later-changes.mjs')
const LAYOUT = 'app/(app)/layout.tsx', LIB_PH = 'lib/studio-page-headings.ts', CSS_PH = 'components/studio-page-headings/studio-page-headings.css'
function loadTs(source) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const sandbox = { module: { exports: {} }, process: { env: {} } }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(js, sandbox)
  return sandbox.module.exports
}
function checkHeadings(files) {
  const lib = files[LIB_PH], layout = files[LAYOUT], css = files[CSS_PH]
  ok(lib.includes("process.env.NEXT_PUBLIC_STUDIO_PAGE_HEADINGS === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'"), 'UX-09: the flag is exact "true", with the Studio shell')
  const L = loadTs(lib)
  ok(L.STUDIO_PAGE_HEADINGS_ENABLED === false, 'UX-09: default off')
  const box = (maxWidth, ml = '0px', mr = ml) => ({ maxWidth, marginLeft: ml, marginRight: mr })
  ok(JSON.stringify(L.studioPageContainerRoles([box('none'), box('896px', '40px'), box('none', '12px', '12px'), box('none', '0px', '8px')])) === '[null,"outer","inner",null]', 'UX-09: the first centring box is outer, a later one inner, others left alone')
  ok(JSON.stringify(L.studioPageContainerRoles([box('none'), box('none', '0px', '0px')])) === '[null,null]', 'UX-09: no centring box: nothing marked')
  ok(/STUDIO_PAGE_HEADINGS_ENABLED && <StudioPageHeadingsMount \/>/.test(layout), 'UX-09: the layout draws the mount only with the flag on')
  ok(strip.stripUxHonesty(LAYOUT, pageConsistency.stripPageConsistency(LAYOUT, layout)) === execFileSync('git', ['show', `${strip.BASE_COMMIT}:${LAYOUT}`], { cwd: root, encoding: 'utf8' }), 'UX-09: the layout without its PAGE-HEADINGS lines is the base, byte for byte')
  const rules = css.split('\n').filter(line => line.includes('{') && !line.startsWith('@media') && !line.startsWith('/*'))
  ok(rules.length >= 5 && rules.every(line => line.trim().startsWith('html[data-studio-page-headings="true"]')), 'UX-09: every rule is scoped to the flag attribute')
  ok(/h1\[data-studio-page-heading="true"\] \{ font-size: 28px/.test(css), 'UX-09: one heading size')
  ok(/\[data-studio-page-container="outer"\] \{[^}]*max-width: 1152px[^}]*padding-left: 32px/.test(css), 'UX-09: one container width and gutter')
}
const phFiles = { [LIB_PH]: read(LIB_PH), [LAYOUT]: read(LAYOUT), [CSS_PH]: read(CSS_PH) }
const before = checks
checkHeadings(phFiles)
ok(registry.LATER_CHANGE_FILES.has(LAYOUT) && registry.LATER_STRIPS.includes(strip.stripUxHonesty) && registry.LATER_ENV_BLOCKS.includes(strip.PAGE_HEADINGS_ENV_BLOCK), 'UX-09: registered in scripts/studio-later-changes.mjs')
ok(read('.env.example').includes(strip.PAGE_HEADINGS_ENV_BLOCK) && /NEXT_PUBLIC_STUDIO_PAGE_HEADINGS="false"/.test(strip.PAGE_HEADINGS_ENV_BLOCK), 'UX-09: .env.example carries the block, off')
const PH_MUTANTS = [
  [LIB_PH, "NEXT_PUBLIC_STUDIO_PAGE_HEADINGS === 'true'", "NEXT_PUBLIC_STUDIO_PAGE_HEADINGS !== 'false'"],
  [LIB_PH, 'if (seen) return \'inner\'', 'if (seen) return \'outer\''],
  [LIB_PH, "if (box.maxWidth && box.maxWidth !== 'none') return true", 'if (box.maxWidth) return true'],
  [LAYOUT, '{STUDIO_PAGE_HEADINGS_ENABLED && <StudioPageHeadingsMount />}', '<StudioPageHeadingsMount />'],
  [LAYOUT, ' // PAGE-HEADINGS\n', '\n'],
  [CSS_PH, 'html[data-studio-page-headings="true"] [data-studio-v4-shell-workspace="true"] h1', '[data-studio-v4-shell-workspace="true"] h1'],
  [CSS_PH, 'font-size: 28px', 'font-size: 32px'],
]
for (const [rel, from, to] of PH_MUTANTS) {
  assert.ok(phFiles[rel].includes(from), `UX-09 mutant anchor present in ${rel}: ${from}`)
  let caught = false
  try { checkHeadings({ ...phFiles, [rel]: phFiles[rel].replace(from, to) }) } catch { caught = true }
  assert.ok(caught, `UX-09 mutant survived in ${rel}: ${to}`)
  killed++
}
console.log(`Studio UX honesty: ${realChecks + checks - before} checks passed, ${killed}/${MUTANTS.length + PH_MUTANTS.length} mutants killed; no network.`)
