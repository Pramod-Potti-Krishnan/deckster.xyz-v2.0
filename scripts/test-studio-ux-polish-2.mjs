// FRONTEND-1 UX polish 2 (NEXT_PUBLIC_STUDIO_UX_POLISH_2, default off): UX-20 one Studio accent, UX-16 Docs on it, UX-14 Intelligence overlap.
// Run: node scripts/test-studio-ux-polish-2.mjs   (plain node: transpile + vm, git show for the base; no network, no browser, no env)
//   1. flag-off identity: strip the change from app/layout.tsx and it is the base's file, byte for byte; .env.example is the base plus the block; the registry carries the three lines; the flag is exact "true";
//   2. accent mapping scoped to the flag: every rule of the stylesheet hangs on :root[data-studio-ux-polish-2="true"]; every accent / violet token a Studio stylesheet defines with a PURPLE HUE (read from the colour, pale tints and
//      rgb() included, not from a closed list of hex values, so a token added later is caught) is mapped to the shell teal on its own selector, light and dark, and so is the dialogs' literal purple primary button;
//      no marketing stylesheet and no brand/logo rule is touched; nothing outside the flag's scope is purple-free-by-accident;
//   3. overlap rule present: the models surface gets a right gutter for the replay button, and the docked Models bar is hidden when the catalog is unavailable or not available; a load error keeps its bar
//      (its message, "Try again" and role="alert");
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
const applyAll = (list, rel, text) => list.reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, text) // LATER-CHANGES: registry read (UX-POLISH-2)
/** Only the strips of the changes registered AFTER this one, in the registry's order: a later change's own lines come out first, so a file reads as this change left it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(strip.stripUxPolish2); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) } // LATER-CHANGES: registry read (UX-POLISH-2)
const readLater = rel => laterStrips(rel, read(rel)) // LATER-CHANGES: registry read (UX-POLISH-2)
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
// Purple is read from the colour itself: a hue of 245-300 degrees with a visible chroma (8 of 255 or more, so the pale tints like #f1edf8 count and the greys do not). #rgb, #rrggbb, #rrggbbaa and rgb() / rgba().
function rgbOf(value) {
  const v = String(value).trim().toLowerCase()
  let m = v.match(/^#([0-9a-f]{3,8})$/)
  if (m) { let h = m[1]; if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join(''); return h.length === 6 || h.length === 8 ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) : null }
  m = v.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/)
  return m ? [+m[1], +m[2], +m[3]] : null
}
function isPurple(value) {
  const rgb = rgbOf(value)
  if (!rgb) return false
  const [r, g, b] = rgb, max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d < 8) return false
  const hue = (((max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60) + 360) % 360
  return hue >= 245 && hue <= 300
}
const PURPLE_LITERAL = /#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{3,4}\b|rgba?\([^)]*\)/gi
const hasPurpleLiteral = text => (blank(text).match(PURPLE_LITERAL) || []).some(isPurple)
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
  ok(registry.stripLaterEnvBlocks('.env.example', files['.env.example']) === registry.stripLaterEnvBlocks('.env.example', git('show', `${strip.BASE_COMMIT}:.env.example`)) && files['.env.example'].includes(strip.UX_POLISH_2_ENV_BLOCK), '.env.example is the base plus the block') // LATER-CHANGES: registry read (RESTACK-UX-POLISH2): the blocks of the changes stacked under this one sit between the base and this block; they come out through the registry, the block itself must still be there
  const regDiff = git('diff', '-U0', `${strip.BASE_COMMIT}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line) && line.includes('studio-ux-polish-2-strip.mjs')) // LATER-CHANGES: registry read (RESTACK-UX-POLISH2): only this change's own registry lines count; the restack strips are registered after it
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
const studioStylesheets = () => [...new Set(execFileSync('git', ['ls-files', 'components/*.css', 'components/**/*.css', 'app/builder/*.css', 'app/(app)/*.css'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).filter(rel => rel !== CSS_REL))]
function studioPurpleTokens(readFile, files = studioStylesheets()) {
  const need = []
  for (const rel of files) for (const { sel, body } of rules(readFile(rel))) {
    if (sel.startsWith('@')) continue
    for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)) if (/(accent|violet)/.test(name) && !/on-accent/.test(name) && isPurple(value.trim())) need.push({ rel, sel, name })
  }
  return need
}
// A utility class that names purple (.bg-purple-600 ...) and sets a literal purple on a property (not a token): the dialogs' primary button.
function studioPurpleLiterals(readFile, files = studioStylesheets()) {
  const need = []
  for (const rel of files) for (const { sel, body } of rules(readFile(rel))) {
    if (sel.startsWith('@') || !/\.(?:bg|text|border|ring|from|to|via)-(?:purple|violet)-\d+/.test(sel)) continue
    for (const [, prop, value] of body.matchAll(/(?:^|;)\s*([a-z-]+)\s*:\s*([^;]+)/gi)) if (!prop.startsWith('--') && isPurple(value.trim())) need.push({ rel, sel, prop })
  }
  return need
}
// A rule of the polish sheet is the base rule's own selector under the flag (light: scope + selector; dark: scope.dark + selector and scope .dark + selector), not a selector that merely contains it.
function mappedOn(own, sel, declares) {
  const dark = /(^|\s)\.dark\s/.test(sel)
  return selectorList(sel).map(s => s.trim().replace(/^\.dark /, '')).every(p => own.some(r => declares(r.body) && (dark ? [`${SCOPE}.dark ${p}`, `${SCOPE} .dark ${p}`] : [`${SCOPE} ${p}`]).every(want => selectorList(r.sel).map(x => x.trim()).includes(want))))
}
function checkAccent(css, need, literals = []) {
  const own = rules(css)
  ok(own.length > 0 && own.every(r => selectorList(r.sel).every(s => s.trim().startsWith(SCOPE))), 'every rule is scoped to the flag attribute on :root')
  ok(!hasPurpleLiteral(css), 'the stylesheet sets no purple (read from the hue of every colour in it)')
  for (const r of own) for (const [, name, value] of r.body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)) if (/accent|violet/.test(name)) ok(TEAL.has(value.trim().toLowerCase()), `${name} maps to the shell teal`)
  ok(need.length > 20, 'the Studio stylesheets define purple accents to map')
  for (const { rel, sel, name } of need) ok(mappedOn(own, sel, body => new RegExp(`(?:^|[;\\s])${name}\\s*:`).test(body)), `${rel}: ${name} on ${sel} is mapped on that selector`)
  ok(literals.length >= 2, 'the dialogs keep a literal purple primary button (and its hover) to map')
  for (const { rel, sel, prop } of literals) ok(mappedOn(own, sel, body => { const m = body.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`)); return !!m && TEAL.has(m[1].trim().toLowerCase()) }), `${rel}: ${prop} on ${sel} is the shell teal`)
  ok(own.some(r => r.sel.includes('[data-studio-v4-shell="true"]') && /--ss-accent:\s*#1f6f72/.test(r.body)), 'the shell accent token is the shell teal')
  ok(own.some(r => r.sel.includes('[data-studio-p2-docs]') && /--sd-accent:/.test(r.body)), 'Docs in the Studio frame take the accent (UX-16)')
  ok(!own.some(r => /marketing|studio-rail-brand|logo/i.test(r.sel)), 'no marketing or brand-logo rule')
}

// ---- 3. overlap
function checkOverlap(css) {
  const own = rules(css)
  ok(own.some(r => r.sel.includes('main[data-studio-intro-surface="models"]') && /padding-inline-end:\s*(4[4-9]|[5-9]\d)px/.test(r.body)), 'the models surface reserves a right gutter for the replay button')
  ok(own.some(r => /\[data-studio-model-catalog-frame\] > \.sp-mc/.test(r.sel) && r.sel.includes('[data-model-catalog="unavailable"]') && r.sel.includes('[data-model-catalog="not-available"]') && /display:\s*none/.test(r.body)), 'the Models bar is hidden when the catalog is unavailable or not available')
  ok(!own.some(r => r.sel.includes('[data-model-catalog="error"]')), 'a load error keeps its bar: no rule of the sheet touches the error state')
  ok(!own.some(r => r.sel.includes('[data-model-catalog="ready"]')), 'a loaded catalog keeps its bar')
}
// the rule's states are the component's: the bar carries data-model-catalog = the result kind, and the error state is the one with the message, "Try again" and role="alert"
function checkCatalogMarkup(tsx) {
  ok(/<section className="sp-mc"[^>]*data-model-catalog=\{result \? result\.kind : "loading"\}/.test(tsx), 'the bar carries data-model-catalog = the result kind')
  ok(/result\?\.kind === "not-available" && <div[^>]*data-mc-state="not-available"/.test(tsx) && /result\?\.kind === "unavailable" && <div[^>]*data-mc-state="unavailable"/.test(tsx), 'the not-available and unavailable states are the ones the sheet hides')
  ok(/result\?\.kind === "error" && <div[^>]*data-mc-state="error" role="alert">/.test(tsx) && /could not be loaded right now/.test(tsx) && /onClick=\{onRetry\}>Try again<\/button>/.test(tsx), 'the error state keeps its message, "Try again" and role="alert"')
}

const files = { 'app/layout.tsx': readLater('app/layout.tsx'), '.env.example': read('.env.example') } // LATER-CHANGES: registry read (UX-POLISH-2)
const libText = read('lib/studio-ux-polish-2.ts'), css = read(CSS_REL)
const STYLESHEETS = studioStylesheets()
const need = studioPurpleTokens(readLater, STYLESHEETS), literals = studioPurpleLiterals(readLater, STYLESHEETS) // LATER-CHANGES: registry read (UX-POLISH-2)
const modelsTsx = read('components/studio-personal/intelligence-models.tsx')
checkIdentity(files); checkFlag(libText); checkMount(files['app/layout.tsx']); checkAccent(css, need, literals); checkOverlap(css); checkCatalogMarkup(modelsTsx)
ok(registry.LATER_CHANGE_FILES.has('app/layout.tsx') && registry.LATER_CHANGE_FILES.has(CSS_REL), 'the registry names the files')

// ---- 4. mutants
caught(() => checkIdentity({ ...files, 'app/layout.tsx': files['app/layout.tsx'].replace('        <Analytics />\n', '        <Analytics />\n        <span />\n') }), 'an unmarked line in the layout')
caught(() => checkIdentity({ ...files, 'app/layout.tsx': files['app/layout.tsx'].replace("import { Toaster } from '@/components/ui/toaster'", "import { Toaster } from '@/components/ui/toaster' ") }), 'a rewritten base line')
caught(() => checkIdentity({ ...files, '.env.example': files['.env.example'].replace('NEXT_PUBLIC_STUDIO_UX_POLISH_2="false"', 'NEXT_PUBLIC_STUDIO_UX_POLISH_2="true"') }), 'the env default flipped on')
caught(() => checkFlag(libText.replace("=== 'true'", "!== 'false'")), 'flag read loosely')
caught(() => checkMount(files['app/layout.tsx'].replace('{STUDIO_UX_POLISH_2_ENABLED && <StudioUxPolish2Mount />}', '<StudioUxPolish2Mount />')), 'mount drawn without the flag')
caught(() => checkAccent(css.replace(`${SCOPE} [data-studio-v4-shell="true"] {`, '[data-studio-v4-shell="true"] {'), need, literals), 'a rule outside the flag scope')
caught(() => checkAccent(css.replace('--ss-accent: #1f6f72', '--ss-accent: #6a4fc0'), need, literals), 'the shell accent left purple')
caught(() => checkAccent(css.split('\n').filter(line => !line.includes('[data-studio-p2-docs]')).join('\n'), need, literals), 'Docs not mapped')
caught(() => checkAccent(css.split('\n').filter(line => !line.includes('[data-studio-v4-chrome="true"]')).join('\n'), need, literals), 'Builder chrome accent not mapped')
caught(() => checkAccent(css, [...need, { rel: 'x.css', sel: '[data-new-purple]', name: '--x-accent' }], literals), 'a new purple accent token unmapped')
caught(() => checkAccent(`${css}\n${SCOPE} .marketing-hero { --mk-accent: #1f6f72; }\n`, need, literals), 'a marketing rule')
caught(() => checkAccent(`${css}\n${SCOPE} .studio-rail-brand { --b-accent: #1f6f72; }\n`, need, literals), 'the brand logo restyled')
caught(() => checkOverlap(css.replace(/padding-inline-end: 56px/, 'padding-inline-end: 0px')), 'no gutter for the replay button')
caught(() => checkOverlap(css.replace('[data-model-catalog="unavailable"], ', '')), 'an unavailable catalog keeps its bar')
caught(() => checkOverlap(css.replace('[data-model-catalog="not-available"])', ')').replace('[data-model-catalog="unavailable"], ', '[data-model-catalog="unavailable"]')), 'a not-available catalog keeps its bar')
caught(() => checkOverlap(css.replace('.sp-mc:is([data-model-catalog="unavailable"], ', '.sp-mc:is([data-model-catalog="error"], [data-model-catalog="unavailable"], ')), 'the error state hides its bar (and the only Try again)')
caught(() => checkOverlap(`${css}\n${SCOPE} [data-studio-model-catalog-frame] > .sp-mc[data-model-catalog="error"] { display: none; }\n`), 'a rule that hides the error bar')
caught(() => checkCatalogMarkup(modelsTsx.replace('data-mc-state="error" role="alert"', 'data-mc-state="error"')), 'the error state loses role="alert"')
caught(() => checkCatalogMarkup(modelsTsx.replace('onClick={onRetry}>Try again</button>', 'onClick={onRetry}>Retry</button>')), 'the error state loses "Try again"')
caught(() => checkCatalogMarkup(modelsTsx.replace('data-model-catalog={result ? result.kind : "loading"}', 'data-catalog={result ? result.kind : "loading"}')), 'the bar stops carrying the state the sheet hangs on')
caught(() => checkOverlap(`${css}\n${SCOPE} [data-studio-model-catalog-frame] > .sp-mc[data-model-catalog="ready"] { display: none; }\n`), 'a loaded catalog bar hidden')


// ---- 5. the purple set is derived, not listed: a token the sheets add later, whatever its hex, must be caught
const FAKE = 'components/studio-fake-new.css'
const withToken = (declaration, sel = '[data-fake-new]') => {
  const fakeNeed = studioPurpleTokens(rel => rel === FAKE ? `${sel} { ${declaration} }` : readLater(rel), [...STYLESHEETS, FAKE])
  ok(fakeNeed.some(n => n.rel === FAKE), `the scan finds ${declaration}`)
  return fakeNeed
}
ok(isPurple('#7b68ad') && isPurple('#f1edf8') && isPurple('rgb(123, 104, 173)') && isPurple('#abc') === false && isPurple('#1f6f72') === false && isPurple('#83c4bd') === false && isPurple('#f4f4f4') === false && isPurple('#2563eb') === false, 'hue: purple tints and rgb() are purple; teal, grey and blue are not')
for (const declaration of ['--fk-accent: #7b68ad', '--fk-violet-soft: #f1edf8', '--fk-accent-hover: rgb(113, 85, 172)', '--fk-accent: #0e0a1f40']) { const fakeNeed = withToken(declaration); caught(() => checkAccent(css, fakeNeed, literals), `a new token ${declaration}, outside any closed list of hexes`) }
ok(studioPurpleTokens(rel => rel === FAKE ? '[data-fake-new] { --fk-accent: #1f6f72; --fk-on-accent: #ffffff; --fk-line: #7b68ad; }' : readLater(rel), [...STYLESHEETS, FAKE]).every(n => n.rel !== FAKE), 'a teal accent, an on-accent token and a purple token not named accent / violet are not asked for')
// the loose match the first pass had: a rule that only CONTAINS the base selector, or the dark rule standing in for the light one, is not a mapping
const without = (predicate) => css.split('\n').filter(line => !predicate(line)).join('\n')
const declaresToken = (line, name) => new RegExp(`(?:^|[;{\\s])${name}\\s*:`).test(line)
caught(() => checkAccent(without(line => declaresToken(line, '--sl-accent') && !line.includes(':has(')), need, literals), '--sl-accent only under the fidelity :has() selectors (base and dark)')
caught(() => checkAccent(without(line => declaresToken(line, '--sl-accent') && !line.includes(':has(') && line.includes('.dark')), need, literals), '--sl-accent dark unmapped')
for (const name of ['--scf-accent', '--ssf-accent', '--sgc-accent', '--sgl-accent', '--spv-accent', '--sdi-accent-hover']) caught(() => checkAccent(without(line => declaresToken(line, name)), need, literals), `${name} unmapped`)
for (const name of ['--scf-accent', '--ssf-accent', '--sgc-accent', '--sgl-accent', '--spv-accent', '--sdi-accent-hover']) caught(() => checkAccent(without(line => declaresToken(line, name) && line.includes('.dark')), need, literals), `${name} dark unmapped`)
caught(() => checkAccent(without(line => declaresToken(line, '--sqi-accent') && !line.includes('.dark')), need, literals), '--sqi-accent: only its dark rule (the light one missing)')
caught(() => checkAccent(css.replace('; --se-violet-soft: #e8f2f0;', ';'), need, literals), '--se-violet-soft light unmapped')
caught(() => checkAccent(css.replace('; --se-violet-soft: #1d3634;', ';'), need, literals), '--se-violet-soft dark unmapped')
caught(() => checkAccent(css.replace('; --sp-accent-soft: #1d3634; }', '; }'), need, literals), '--sp-accent-soft dark unmapped')
caught(() => checkAccent(without(line => line.includes('.bg-purple-600') && !line.includes(':hover')), need, literals), 'the dialogs primary button stays purple')
caught(() => checkAccent(without(line => line.includes('.bg-purple-600') && line.includes(':hover')), need, literals), 'the dialogs primary button turns purple on hover')
caught(() => checkAccent(without(line => line.includes('data-studio-v4-panel$="generation"')), need, literals), 'the generation panel\'s primary button keeps its purple ink in dark mode')
caught(() => checkAccent(css.replace('--scf-accent: #1f6f72', '--scf-accent: #7b68ad'), need, literals), 'a mapped token left on its purple')
caught(() => checkAccent(css.replace('{ background: #1f6f72; }', '{ background: #7155ac; }'), need, literals), 'the primary button mapped to its own purple')

console.log(`test-studio-ux-polish-2: ${checks} checks passed (${mutants} mutants caught)`)
