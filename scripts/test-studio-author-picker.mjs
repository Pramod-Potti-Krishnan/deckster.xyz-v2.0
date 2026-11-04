// Proof for FRONTEND-1 Pass 5 author lane F-1 (NEXT_PUBLIC_STUDIO_AUTHOR_PICKER). Run: node scripts/test-studio-author-picker.mjs (needs tsx-free TS: reads the lib through a tiny transpile via typescript).
// A flag-off identity: each marked file, stripped, is its base byte for byte; .env.example is base + "\n" + the block; no other file outside scope changed.
// B hidden for non-premium: free/starter/pro claims (verified) hide it; the wire carries no build_mode.
// C signed-claim-only: null, unverified, plain strings, a session-shaped {tier:"premium"} without verified:true all hide it; today's signedAuthorTierClaim() is null.
// D wire: build_mode:"author" only when flag on + verified premium/internal + outline accept + chosen author.
// E mutants: each broken variant of the decisions must fail at least one check above.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import * as strip from './studio-author-picker-strip.mjs'

const require = createRequire(import.meta.url)
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 })
let fails = 0
const ok = (cond, name) => { if (cond) console.log(`ok   ${name}`); else { fails++; console.log(`FAIL ${name}`) } }

// A
const BASE = strip.BASE_COMMIT
for (const rel of strip.AUTHOR_PICKER_FILES) ok(strip.stripAuthorPicker(rel, readFileSync(rel, 'utf8')) === git('show', `${BASE}:${rel}`), `A: ${rel} stripped is its base`)
ok(readFileSync('.env.example', 'utf8') === `${git('show', `${BASE}:.env.example`)}\n${strip.AUTHOR_PICKER_ENV_BLOCK}`, 'A: .env.example is base plus block')
ok(/NEXT_PUBLIC_STUDIO_AUTHOR_PICKER="false"/.test(strip.AUTHOR_PICKER_ENV_BLOCK), 'A: block default off')
const changed = git('diff', '--name-only', BASE).split('\n').filter(Boolean).concat(git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean))
ok(changed.every(f => strip.AUTHOR_PICKER_SCOPE_FILES.has(f)), `A: scope ${changed.filter(f => !strip.AUTHOR_PICKER_SCOPE_FILES.has(f)).join(',') || 'clean'}`)

// load the lib
const ts = require('typescript')
const load = src => { const m = { exports: {} }; new Function('module', 'exports', 'process', ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(m, m.exports, { env: {} }); return m.exports }
const SRC = readFileSync('lib/studio-author-picker.ts', 'utf8')

function suite(lib, tag) {
  let f = 0; const t = (c) => { if (!c) f++ }
  const prem = { verified: true, tier: 'premium' }
  t(lib.authorPickerFlagOn('true') && !lib.authorPickerFlagOn('TRUE') && !lib.authorPickerFlagOn('1') && !lib.authorPickerFlagOn(undefined))
  t(!lib.authorPickerVisible(false, prem))
  for (const tier of ['free', 'starter', 'pro']) t(!lib.authorPickerVisible(true, { verified: true, tier }))
  for (const c of [null, undefined, 'premium', { tier: 'premium' }, { verified: 'true', tier: 'premium' }, { internal: true }]) t(!lib.authorPickerVisible(true, c))
  t(lib.signedAuthorTierClaim() === null)
  t(lib.authorPickerVisible(true, prem) && lib.authorPickerVisible(true, { verified: true, tier: 'pro', internal: true }))
  t(JSON.stringify(lib.authorBuildModeField('accept_strawman', true, prem, 'author')) === '{"build_mode":"author"}')
  t(JSON.stringify(lib.authorBuildModeField('accept_strawman:x', true, prem, 'author')) === '{"build_mode":"author"}')
  t(JSON.stringify(lib.authorBuildModeField('accept_strawman', true, prem, 'standard')) === '{}')
  t(JSON.stringify(lib.authorBuildModeField('accept_plan', true, prem, 'author')) === '{}')
  t(JSON.stringify(lib.authorBuildModeField('accept_strawman', false, prem, 'author')) === '{}')
  t(JSON.stringify(lib.authorBuildModeField('accept_strawman', true, { verified: true, tier: 'pro' }, 'author')) === '{}')
  t(JSON.stringify(lib.authorBuildModeField('accept_strawman', true, { tier: 'premium' }, 'author')) === '{}')
  t(JSON.stringify(lib.authorBuildModeField('accept_strawman')) === '{}') // defaults: flag unset, claim null
  t(lib.setAuthorBuildChoice('author', false) === 'standard' && lib.setAuthorBuildChoice('author', true) === 'author' && lib.setAuthorBuildChoice('x', true) === 'standard')
  return f
}
ok(suite(load(SRC), 'real') === 0, 'B-D: decisions')

// E mutants
const mutants = [
  ["c.verified !== true", "false"],
  ["AUTHOR_PICKER_TIERS = new Set(['premium'])", "AUTHOR_PICKER_TIERS = new Set(['premium','pro'])"],
  ["value === 'true'", "Boolean(value)"],
  ["return null\n}", "return { verified: true, tier: 'premium' }\n}"],
  ["chosen === 'author' ?", "true ?"],
  ["isOutlineAcceptAction(actionValue) &&", ""],
  ["if (!flag ||", "if ("],
  ["visible && next === 'author'", "next === 'author'"],
]
for (const [from, to] of mutants) { ok(SRC.includes(from), `E: mutant anchor ${from}`); ok(suite(load(SRC.replace(from, to)), from) > 0, `E: mutant killed ${from}`) }

// component reads only the lib's signed claim
const comp = readFileSync('components/builder/chat/author-build-picker.tsx', 'utf8')
ok(comp.includes('signedAuthorTierClaim()') && !/useSession|session\.user|localStorage|tier\s*===/.test(comp), 'C: picker reads only the signed claim')
const card = readFileSync('components/builder/chat/question-card.tsx', 'utf8')
ok(card.includes('isOutlineApproval && process.env.NEXT_PUBLIC_STUDIO_AUTHOR_PICKER === "true" && <AuthorBuildPicker />'), 'B: picker only on outline approval behind the flag')

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0)
