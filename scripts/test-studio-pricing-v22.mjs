// FRONTEND-1 (W5 P4-17): proof for the Studio Pricing page v2.2 (NEXT_PUBLIC_STUDIO_PRICING_V22). Run: node scripts/test-studio-pricing-v22.mjs
// A flag-off identity (strip = base, byte for byte; .env.example = base + block; scope), B the flag gate (exact "true"), C no provider cost / margin / tokens / Stripe / network,
// D the tier copy matches the spec (design draft section 2b, 2d, 3), E mutants: each broken variant must make the checks fail.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import * as strip from './studio-pricing-v22-strip.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 })
const BASE = strip.BASE_COMMIT
const PAGE = 'app/(marketing-v3)/pricing/page.tsx'
const LIB = 'lib/studio-pricing-v22.ts'
const VIEW = 'components/marketing/pricing-v22/pricing-v22-page.tsx'
const read = rel => readFileSync(rel, 'utf8')

let pass = 0, fail = 0
const results = []
const check = (name, ok) => { results.push([name, !!ok]); ok ? pass++ : fail++ }

// Load the lib as plain JS (PRICING_TIERS inlined from its own file) so the data is checked as it runs.
function loadLib(libText, tiersText) {
  const js = src => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const tiersMod = { exports: {} }
  new Function('module', 'exports', 'require', js(tiersText))(tiersMod, tiersMod.exports, require)
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', js(libText))(mod, mod.exports, id => (id === '@/lib/marketing/homepage-v2-pricing' ? tiersMod.exports : require(id)))
  return mod.exports
}

// ---- the checks, as functions of the texts, so the mutants can run them too
function checksA({ page, env }) {
  const out = []
  const basePage = git('show', `${BASE}:${PAGE}`)
  out.push(['A1 page stripped of PRICING-V22 lines is the base, byte for byte', strip.stripPricingV22(PAGE, page) === basePage])
  const added = page.split('\n').filter(l => !basePage.split('\n').includes(l))
  out.push(['A2 every line added to the page carries the marker', added.length > 0 && added.every(l => strip.PRICING_V22_MARKER_RE.test(l))])
  out.push(['A3 page early return is behind the flag constant', /^\s*if \(STUDIO_PRICING_V22\) return <PricingV22Page \/> \/\/ PRICING-V22$/m.test(page)])
  const baseEnv = git('show', `${BASE}:.env.example`)
  out.push(['A4 .env.example is the base plus the block', env === `${baseEnv}\n${strip.PRICING_V22_ENV_BLOCK}`])
  out.push(['A5 the env block defaults the flag off', /^NEXT_PUBLIC_STUDIO_PRICING_V22="false"$/m.test(strip.PRICING_V22_ENV_BLOCK)])
  return out
}

function checksB(lib) {
  const on = lib.studioPricingV22On
  const offs = [undefined, '', 'false', 'TRUE', 'True', ' true', 'true ', '1', 'yes']
  return [
    ['B1 "true" turns the page on', on('true') === true],
    ['B2 every other value is off', offs.every(v => on(v) === false)],
  ]
}

const FORBIDDEN = [
  [/stripe/i, 'Stripe'], [/\bfetch\s*\(/, 'fetch('], [/axios|XMLHttpRequest|WebSocket|EventSource/, 'network client'], [/\buse client\b/, 'client component'],
  [/provider cost|provider_cost|margin|multiplier/i, 'provider cost / margin'], [/\btokens?\b/i, 'tokens'], [/openrouter|gemini|gpt-|claude-|sonnet 5|opus 5/i, 'provider model id'],
]
const ALLOWED_DOLLARS = new Set(['$0', '$10', '$25', '$50'])
function checksC({ lib, view, page }) {
  const basePage = git('show', `${BASE}:${PAGE}`)
  const addedPage = page.split('\n').filter(l => !basePage.split('\n').includes(l)).join('\n')
  const code = [lib, view, addedPage].map(t => t.replace(/^\s*\/\/.*$/gm, '')).join('\n') // comments may name what is NOT done
  const out = FORBIDDEN.map(([re, what]) => [`C no ${what} in the change's code`, !re.test(code)])
  const dollars = code.match(/\$\d[\d,.]*/g) || []
  out.push(['C every $ amount in the copy is a plan or pack price (no per-deck or per-call cost)', dollars.every(d => ALLOWED_DOLLARS.has(d))])
  return out
}

const SPEC_TIERS = [
  ['free', 'Free', '$0', '150 credits a month', '2 decks a month'],
  ['starter', 'Starter', '$20', '2,000 credits a month', 'about 20 decks a month'],
  ['pro', 'Pro', '$50', '5,000 credits a month', 'about 25 research decks a month'],
  ['premium', 'Max', '$100', '10,000 credits a month', 'about 30 full-research decks a month'],
]
const SPEC_MATRIX = {
  'Generated images': ['4 a month', '40 a month', '120 a month', '300 a month'],
  'Web research': ['—', '—', 'Included', 'Included'],
  'Deep research': ['—', '—', '10 runs a month', '40 runs a month'],
  'Uploads (your files)': ['—', '—', '50 files a month', '200 files a month'],
  'Knowledge graph': ['—', '—', '—', 'Included'],
  'Template from your deck': ['—', '2 a month', '10 a month', '30 a month'],
  'Companion voice': ['—', '30 min a month', '120 min a month', '400 min a month'],
  'Author mode': ['—', '—', '5 decks a month, Sonnet', '20 decks a month, Sonnet or Opus'],
  'Publish and audience Q&A': ['View-only publish', '100 questions a month', '500 a month', '2,000 a month'],
  'Priority queue': ['—', '—', '—', 'Included'],
}
function checksD(lib, tiersText) {
  const tiers = lib.PRICING_V22_TIERS, matrix = lib.PRICING_V22_MATRIX, copy = lib.PRICING_V22_COPY
  const out = []
  out.push(['D1 four tiers in order Free, Starter, Pro, Max', JSON.stringify(tiers.map(t => t.id)) === JSON.stringify(SPEC_TIERS.map(t => t[0]))])
  for (const [id, name, price, credits, decks] of SPEC_TIERS) {
    const t = tiers.find(x => x.id === id) || {}
    out.push([`D2 ${name}: name, price, credits and deck count match the spec`, t.name === name && t.price === price && t.credits === credits && t.decks === decks])
  }
  out.push(['D3 paid names, prices and links are read from PRICING_TIERS', /PRICING_TIERS\.find/.test(read(LIB)) && !/name: "(Starter|Pro|Max)"/.test(read(LIB))])
  for (const [name, values] of Object.entries(SPEC_MATRIX)) {
    const row = matrix.find(r => r.name === name)
    out.push([`D4 matrix "${name}" matches the spec`, !!row && JSON.stringify(row.values) === JSON.stringify(values)])
  }
  out.push(['D5 top-ups are 1:1 ($10/1,000, $25/2,500, $50/5,000), no $100 pack', JSON.stringify(copy.topUps) === JSON.stringify([{ price: '$10', credits: '1,000 credits' }, { price: '$25', credits: '2,500 credits' }, { price: '$50', credits: '5,000 credits' }])])
  out.push(['D6 top-up credits never expire; plan credits reset', copy.credits.some(l => /Top-up credits never expire/.test(l)) && copy.credits.some(l => /Plan credits reset each month/.test(l))])
  return out
}

function runAll(t) {
  const lib = loadLib(t.lib, t.tiers)
  return [...checksA(t), ...checksB(lib), ...checksC(t), ...checksD(lib, t.tiers)]
}

const real = { page: read(PAGE), env: read('.env.example'), lib: read(LIB), view: read(VIEW), tiers: read('lib/marketing/homepage-v2-pricing.ts') }
for (const [name, ok] of runAll(real)) check(name, ok)

// scope: the committed + working changes touch only this change's files
const changed = git('diff', '--name-only', BASE).split('\n').filter(Boolean)
const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)
check('A6 only this change\'s files differ from the base', [...changed, ...untracked].every(f => strip.PRICING_V22_SCOPE_FILES.has(f)))
check('A7 registry: exactly three added lines, all this change\'s', (() => {
  const d = git('diff', '-U0', BASE, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l))
  return d.length === 3 && d.every(l => l.startsWith('+') && l.includes('studio-pricing-v22-strip.mjs'))
})())

// ---- mutants: each must make at least one check fail
const MUTANTS = [
  ['flag reads anything but "false"', t => ({ ...t, lib: t.lib.replace('return value === "true"', 'return value !== "false"') })],
  ['flag on by default (no gate)', t => ({ ...t, page: t.page.replace('if (STUDIO_PRICING_V22) return', 'if (true) return') })],
  ['unmarked line added to the page', t => ({ ...t, page: t.page.replace('const copy = V3_CONTENT', 'const extra = 1\nconst copy = V3_CONTENT') })],
  ['base line rewritten', t => ({ ...t, page: t.page.replace('const tierEvent = {', 'const tierEvent  = {') })],
  ['env block default on', t => ({ ...t, env: t.env.replace('NEXT_PUBLIC_STUDIO_PRICING_V22="false"', 'NEXT_PUBLIC_STUDIO_PRICING_V22="true"') })],
  ['Stripe call added', t => ({ ...t, view: t.view.replace('export function PricingV22Page() {', 'export function PricingV22Page() {\n  void fetch("/api/stripe/prices")') })],
  ['provider cost shown', t => ({ ...t, lib: t.lib.replace('"2 decks a month"', '"2 decks a month ($0.35 provider cost each)"') })],
  ['tokens shown', t => ({ ...t, lib: t.lib.replace('"150 credits a month"', '"150,000 tokens a month"') })],
  ['wrong Starter grant', t => ({ ...t, lib: t.lib.replace('"2,000 credits a month"', '"2,500 credits a month"') })],
  ['wrong Pro deck count', t => ({ ...t, lib: t.lib.replace('about 25 research decks', 'about 35 research decks') })],
  ['Max image cap changed', t => ({ ...t, lib: t.lib.replace('"300 a month"]', '"500 a month"]') })],
  ['$100 top-up pack added', t => ({ ...t, lib: t.lib.replace('{ price: "$50", credits: "5,000 credits" },', '{ price: "$50", credits: "5,000 credits" },\n    { price: "$100", credits: "10,000 credits" },') })],
  ['Free tier dropped', t => ({ ...t, lib: t.lib.replace(/  \{\n    id: "free"[\s\S]*?highlighted: false,\n  \},\n/, '') })],
]
for (const [name, mutate] of MUTANTS) {
  const m = mutate(real)
  const changedText = Object.keys(real).some(k => m[k] !== real[k])
  let killed
  try { killed = runAll(m).some(([, ok]) => !ok) } catch { killed = true }
  check(`E mutant killed: ${name}`, changedText && killed)
}

for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
