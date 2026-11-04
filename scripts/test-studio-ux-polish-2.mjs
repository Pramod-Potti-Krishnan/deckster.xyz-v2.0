// FRONTEND-1 UX polish 2 (NEXT_PUBLIC_STUDIO_UX_POLISH_2, default off): UX-20 one Studio accent, UX-16 Docs on it, UX-14 Intelligence overlap.
// Run: node scripts/test-studio-ux-polish-2.mjs   (plain node: transpile + vm, git show for the base; no network, no browser, no env)
//   1. flag-off identity: strip the change from app/layout.tsx and it is the base's file, byte for byte; .env.example is the base plus the block; the registry carries the three lines; the flag is exact "true";
//   2. accent mapping scoped to the flag: every rule of the stylesheet hangs on :root[data-studio-ux-polish-2="true"]; every purple accent token a Studio stylesheet defines is mapped to the shell teal;
//      no marketing stylesheet and no brand/logo rule is touched; nothing outside the flag's scope is purple-free-by-accident;
//   3. overlap rule present: the models surface gets a right gutter for the replay button, and the docked Models bar is hidden when the catalog did not load;
//   4. mutants: each property broken is caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import * as strip from './studio-ux-polish-2-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
let checks = 0
const ok = (value, message) => { checks++; assert.ok(value, message) }
let mutants = 0
const caught = (fn, message) => { checks++; mutants++; let threw = false; try { fn() } catch { threw = true }; assert.ok(threw, `mutant not caught: ${message}`) }

function load(text, env) {
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const sandbox = { module: { exports: {} }, process: { env } }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(js, sandbox)
  return sandbox.module.exports
}

const SCOPE = ':root[data-studio-ux-polish-2="true"]'
const PURPLE = /^#(6a4fc0|b4a0f2|7358ba|bca5ee|7155ac|c3abea|f1edfb|2a2540|dcd2f6|463d6b)$/i
const TEAL = new Set(['#1f6f72', '#83c4bd', '#e8f2f0', '#1d3634', '#cfe0dc', '#2f4a46'])
const CSS_REL = 'components/studio-ux-polish-2/studio-ux-polish-2.css'
const blank = css => css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
function rules(css) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m
  const body = blank(css).replace(/@media[^{]*\{([\s\S]*?\})\s*\}/g, (_, inner) => inner)
  while ((m = re.exec(body))) out.push({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] })
  return out
}
// A selector list split at its top-level commas only: the commas inside :is(...) or [...] belong to one selector.
function selectorList(sel) {
  const out = []; let depth = 0, cur = ''
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out
}

// ---- 1. identity
function checkIdentity(files) {
  for (const rel of strip.UX_POLISH_2_FILES) {
    ok(strip.stripUxPolish2(rel, files[rel]) === git('show', `${strip.BASE_COMMIT}:${rel}`), `${rel}: without the change it is the base's file`)
    const base = git('show', `${strip.BASE_COMMIT}:${rel}`).split('\n')
    ok(files[rel].split('\n').filter(line => !base.includes(line)).every(line => strip.UX_POLISH_2_MARKER_RE.test(line)), `${rel}: every added line carries the marker`)
  }
  ok(files['.env.example'] === `${git('show', `${strip.BASE_COMMIT}:.env.example`)}\n${strip.UX_POLISH_2_ENV_BLOCK}`, '.env.example is the base plus the block')
  const regDiff = git('diff', '-U0', `${strip.BASE_COMMIT}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
  ok(regDiff.length === 3 && regDiff.every(line => line.startsWith('+') && line.includes('studio-ux-polish-2-strip.mjs') && line.includes('LATER-CHANGE')), 'the registry gains exactly three lines')
}
function checkFlag(text) {
  ok(load(text, { NEXT_PUBLIC_STUDIO_UX_POLISH_2: 'true' }).STUDIO_UX_POLISH_2_ENABLED === true, 'flag on with exact "true"')
  for (const env of [{}, { NEXT_PUBLIC_STUDIO_UX_POLISH_2: 'TRUE' }, { NEXT_PUBLIC_STUDIO_UX_POLISH_2: '1' }, { NEXT_PUBLIC_STUDIO_UX_POLISH_2: 'false' }]) ok(load(text, env).STUDIO_UX_POLISH_2_ENABLED === false, `flag off for ${JSON.stringify(env)}`)
}
function checkMount(layout) {
  ok(/\{STUDIO_UX_POLISH_2_ENABLED && <StudioUxPolish2Mount \/>\}/.test(layout), 'the mount is drawn only with the flag on')
}

// ---- 2. accent mapping
function studioPurpleTokens(readFile) {
  const files = execFileSync('git', ['ls-files', 'components/*.css', 'components/**/*.css', 'app/builder/*.css', 'app/(app)/*.css'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).filter(rel => rel !== CSS_REL)
  const need = []
  for (const rel of [...new Set(files)]) for (const { sel, body } of rules(readFile(rel))) {
    if (sel.startsWith('@')) continue
    for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)) if (/(accent|violet)/.test(name) && !/on-accent/.test(name) && PURPLE.test(value.trim())) need.push({ rel, sel, name })
  }
  return need
}
function checkAccent(css, need) {
  const own = rules(css)
  ok(own.length > 0 && own.every(r => selectorList(r.sel).every(s => s.trim().startsWith(SCOPE))), 'every rule is scoped to the flag attribute on :root')
  ok(!/#(6a4fc0|b4a0f2|7358ba|bca5ee|7155ac|c3abea)\b/i.test(blank(css)), 'the stylesheet sets no purple')
  for (const r of own) for (const [, name, value] of r.body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)) if (/accent|violet/.test(name)) ok(TEAL.has(value.trim().toLowerCase()), `${name} maps to the shell teal`)
  ok(need.length > 20, 'the Studio stylesheets define purple accents to map')
  for (const { rel, sel, name } of need) {
    const dark = /(^|\s|,)\.dark\b/.test(sel)
    const plain = sel.split(',').map(s => s.trim().replace(/^\.dark /, ''))
    const hit = own.some(r => r.body.includes(`${name}:`) && plain.every(p => r.sel.includes(` ${p}`)) && (!dark || r.sel.includes('.dark')))
    ok(hit, `${rel}: ${name} on ${sel} is mapped`)
  }
  ok(own.some(r => r.sel.includes('[data-studio-v4-shell="true"]') && /--ss-accent:\s*#1f6f72/.test(r.body)), 'the shell accent token is the shell teal')
  ok(own.some(r => r.sel.includes('[data-studio-p2-docs]') && /--sd-accent:/.test(r.body)), 'Docs in the Studio frame take the accent (UX-16)')
  ok(!own.some(r => /marketing|studio-rail-brand|logo/i.test(r.sel)), 'no marketing or brand-logo rule')
}

// ---- 3. overlap
function checkOverlap(css) {
  const own = rules(css)
  ok(own.some(r => r.sel.includes('main[data-studio-intro-surface="models"]') && /padding-inline-end:\s*(4[4-9]|[5-9]\d)px/.test(r.body)), 'the models surface reserves a right gutter for the replay button')
  ok(own.some(r => /\[data-studio-model-catalog-frame\] > \.sp-mc/.test(r.sel) && r.sel.includes('[data-model-catalog="error"]') && /display:\s*none/.test(r.body)), 'the Models bar is hidden when the catalog could not load')
  ok(!own.some(r => r.sel.includes('[data-model-catalog="ready"]')), 'a loaded catalog keeps its bar')
}

const files = { 'app/layout.tsx': read('app/layout.tsx'), '.env.example': read('.env.example') }
const libText = read('lib/studio-ux-polish-2.ts'), css = read(CSS_REL)
const need = studioPurpleTokens(read)
checkIdentity(files); checkFlag(libText); checkMount(files['app/layout.tsx']); checkAccent(css, need); checkOverlap(css)
ok(registry.LATER_CHANGE_FILES.has('app/layout.tsx') && registry.LATER_CHANGE_FILES.has(CSS_REL), 'the registry names the files')

// ---- 4. mutants
caught(() => checkIdentity({ ...files, 'app/layout.tsx': files['app/layout.tsx'].replace('        <Analytics />\n', '        <Analytics />\n        <span />\n') }), 'an unmarked line in the layout')
caught(() => checkIdentity({ ...files, 'app/layout.tsx': files['app/layout.tsx'].replace("import { Toaster } from '@/components/ui/toaster'", "import { Toaster } from '@/components/ui/toaster' ") }), 'a rewritten base line')
caught(() => checkIdentity({ ...files, '.env.example': files['.env.example'].replace('NEXT_PUBLIC_STUDIO_UX_POLISH_2="false"', 'NEXT_PUBLIC_STUDIO_UX_POLISH_2="true"') }), 'the env default flipped on')
caught(() => checkFlag(libText.replace("=== 'true'", "!== 'false'")), 'flag read loosely')
caught(() => checkMount(files['app/layout.tsx'].replace('{STUDIO_UX_POLISH_2_ENABLED && <StudioUxPolish2Mount />}', '<StudioUxPolish2Mount />')), 'mount drawn without the flag')
caught(() => checkAccent(css.replace(`${SCOPE} [data-studio-v4-shell="true"] {`, '[data-studio-v4-shell="true"] {'), need), 'a rule outside the flag scope')
caught(() => checkAccent(css.replace('--ss-accent: #1f6f72', '--ss-accent: #6a4fc0'), need), 'the shell accent left purple')
caught(() => checkAccent(css.split('\n').filter(line => !line.includes('[data-studio-p2-docs]')).join('\n'), need), 'Docs not mapped')
caught(() => checkAccent(css.split('\n').filter(line => !line.includes('[data-studio-v4-chrome="true"]')).join('\n'), need), 'Builder chrome accent not mapped')
caught(() => checkAccent(css, [...need, { rel: 'x.css', sel: '[data-new-purple]', name: '--x-accent' }]), 'a new purple accent token unmapped')
caught(() => checkAccent(`${css}\n${SCOPE} .marketing-hero { --mk-accent: #1f6f72; }\n`, need), 'a marketing rule')
caught(() => checkAccent(`${css}\n${SCOPE} .studio-rail-brand { --b-accent: #1f6f72; }\n`, need), 'the brand logo restyled')
caught(() => checkOverlap(css.replace(/padding-inline-end: 56px/, 'padding-inline-end: 0px')), 'no gutter for the replay button')
caught(() => checkOverlap(css.replace('[data-model-catalog="error"], ', '')), 'Models bar shown on error')
caught(() => checkOverlap(`${css}\n${SCOPE} [data-studio-model-catalog-frame] > .sp-mc[data-model-catalog="ready"] { display: none; }\n`), 'a loaded catalog bar hidden')

console.log(`test-studio-ux-polish-2: ${checks} checks passed (${mutants} mutants caught)`)
