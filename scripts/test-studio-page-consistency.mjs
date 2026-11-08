// FRONTEND-1 page consistency (NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY, default off): UX-07 Billing on the Studio shell tokens, UX-10 Settings / Billing top bar + rail highlight, one create label.
// Run: node scripts/test-studio-page-consistency.mjs   (plain node: transpile + vm, git show for the base; no network, no browser, no env)
//   1. flag-off identity: strip the change from each touched file and it is the base's file, byte for byte; .env.example is the base plus the block; the registry carries the three lines;
//   2. labels unified: with the flag on every create call site resolves to "Presentation" (after its + icon); off, every call site keeps its own word;
//   3. Billing and Settings use the shell top bar (title, Back to Studio, + Presentation) and mark "Your details" on the rail; other routes are untouched;
//   4. Billing's restyle is a stylesheet whose every rule is scoped to the flag's <html> attribute;
//   5. mutants: each property broken is caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import * as strip from './studio-page-consistency-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
let checks = 0
const ok = (value, message) => { checks++; assert.ok(value, message) }
const caught = (fn, message) => { checks++; let threw = false; try { fn() } catch { threw = true }; assert.ok(threw, `mutant not caught: ${message}`) }

function load(rel, env, text = read(rel)) {
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const sandbox = { module: { exports: {} }, process: { env } }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(js, sandbox)
  return sandbox.module.exports
}
const ON = { NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const OFFS = [{}, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, { NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY: 'true' }, { NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY: 'TRUE', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, { NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY: '1', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }]

// ---- 1. identity
function checkIdentity(files, stripFn) {
  for (const rel of strip.PAGE_CONSISTENCY_FILES) ok(stripFn(rel, files[rel]) === git('show', `${strip.BASE_COMMIT}:${rel}`), `${rel}: without the change it is the base's file`)
  for (const rel of strip.PAGE_CONSISTENCY_FILES) {
    const base = git('show', `${strip.BASE_COMMIT}:${rel}`).split('\n'), now = files[rel].split('\n')
    const added = now.filter(line => !base.includes(line))
    ok(added.every(line => strip.PAGE_CONSISTENCY_MARKER_RE.test(line)), `${rel}: every added or rewritten line carries the marker`)
  }
}
const files = Object.fromEntries(strip.PAGE_CONSISTENCY_FILES.map(rel => [rel, read(rel)]))
checkIdentity(files, strip.stripPageConsistency)
ok(registry.stripLaterEnvBlocks('.env.example', read('.env.example')) === registry.stripLaterEnvBlocks('.env.example', git('show', `${strip.BASE_COMMIT}:.env.example`)) && read('.env.example').includes(strip.PAGE_CONSISTENCY_ENV_BLOCK), '.env.example is the base plus the block') // LATER-CHANGES: registry read (RESTACK-UX-PC): dev's newer env blocks sit between the base and this block; they come out through the registry, the block itself must still be there
ok(/^NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY="false"$/m.test(strip.PAGE_CONSISTENCY_ENV_BLOCK), 'the block defaults the flag to "false"')
const reg = read('scripts/studio-later-changes.mjs')
ok((reg.match(/studio-page-consistency-strip\.mjs.*LATER-CHANGE/g) || []).length === 3, 'registered: three LATER-CHANGE lines')
ok(registry.LATER_CHANGE_FILES.has('components/layout/app-header.tsx') && registry.LATER_CHANGE_FILES.has('lib/studio-page-consistency.ts'), 'registry: the scope files are later-change files')
for (const rel of strip.PAGE_CONSISTENCY_FILES) ok(registry.stripLaterChanges(rel, read(rel)) === registry.stripLaterChanges(rel, git('show', `${strip.BASE_COMMIT}:${rel}`)), `${rel}: an older pin reading through the registry sees the base`)
ok(registry.stripLaterEnvBlocks('.env.example', read('.env.example')) === registry.stripLaterEnvBlocks('.env.example', git('show', `${strip.BASE_COMMIT}:.env.example`)), '.env.example: the registry takes the block out')

// ---- 2. labels
function checkLabels(createWordText, builderText) {
  const on = load('lib/studio-create-word.ts', ON, createWordText)
  for (const original of ['New Presentation', 'Create Presentation', 'Presentation']) for (const unified of [true, false]) ok(on.studioCreateLabel(unified, original) === 'Presentation', `on: "${original}" reads "Presentation"`)
  ok(on.studioCreateLabel(false, 'Add presentation') === 'New presentation', 'on: the accessible name is "New presentation"')
  for (const env of OFFS) {
    const off = load('lib/studio-create-word.ts', env, createWordText)
    ok(off.studioCreateLabel(false, 'New Presentation') === 'New Presentation' && off.studioCreateLabel(true, 'New Presentation') === 'New deck', `off (${JSON.stringify(env)}): each call site keeps its own word`)
  }
  ok(/const studioTopBarNewLabel = studioShell && STUDIO_PAGE_CONSISTENCY_ENABLED \? STUDIO_PRESENTATION_LABEL : "New deck"/.test(builderText), 'Builder top bar: "Presentation" on, "New deck" off')
  ok(!/studioTopBarV2 \? "New deck"/.test(builderText), 'Builder top bar: no hard "New deck" left on the create button')
}
checkLabels(read('lib/studio-create-word.ts'), read('components/builder/builder-header.tsx'))
const lib = load('lib/studio-page-consistency.ts', ON)
ok(lib.STUDIO_PAGE_CONSISTENCY_ENABLED === true && lib.STUDIO_PRESENTATION_LABEL === 'Presentation', 'lib on')
for (const env of OFFS) ok(load('lib/studio-page-consistency.ts', env).STUDIO_PAGE_CONSISTENCY_ENABLED === false, `lib off for ${JSON.stringify(env)}`)
ok(/<span>Presentation<\/span>/.test(read('components/layout/app-header.tsx')), 'the library top bar already says "+ Presentation" (the label chosen)')

// ---- 3. top bar + rail
function checkTopBar(headerText, railText, l) {
  ok(l.studioAccountPageTitle('/billing') === 'Billing' && l.studioAccountPageTitle('/settings') === 'Settings' && l.studioAccountPageTitle('/settings/profile') === 'Settings', 'titles: Billing, Settings')
  for (const p of ['/dashboard', '/studio/details', '/knowledge', '/billingx', '/', null]) ok(l.studioAccountPageTitle(p) === null, `no account title for ${p}`)
  ok(l.studioRailDetailsCurrent(true, '/billing') && l.studioRailDetailsCurrent(true, '/settings/security'), 'rail: Your details is current on Billing / Settings')
  ok(!l.studioRailDetailsCurrent(false, '/billing') && !l.studioRailDetailsCurrent(true, '/dashboard'), 'rail: not with the flag off, not elsewhere')
  const line = headerText.split('\n').find(x => x.includes('studioAccountPageTitle(pathname)) return'))
  ok(line && /STUDIO_PAGE_CONSISTENCY_ENABLED &&/.test(line), 'top bar: the account header is gated on the flag')
  ok(line && /data-studio-v4-shell-header="true"/.test(line) && /<BackToBuilderButton label="Back to Studio" \/>/.test(line) && /data-studio-p2-new-deck="true" href="\/builder\?session_id=new"/.test(line) && /\{STUDIO_PRESENTATION_LABEL\}/.test(line), 'top bar: shell header, Back to Studio, + Presentation')
  ok(/aria-current=\{pathname==='\/studio\/details' \|\| studioRailDetailsCurrent\(STUDIO_PAGE_CONSISTENCY_ENABLED, pathname\)/.test(railText), 'rail: Your details reads the flag')
}
checkTopBar(read('components/layout/app-header.tsx'), read('components/layout/studio-rail.tsx'), lib)

// ---- 4. CSS scoped
function checkCss(css) {
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('{').slice(0, -1).map(chunk => chunk.split('}').pop().trim()).filter(Boolean)
  ok(selectors.length > 5, 'stylesheet has rules')
  for (const sel of selectors) for (const part of sel.split(',')) ok(part.trim().startsWith('html[data-studio-page-consistency="true"]'), `scoped: ${part.trim()}`)
  ok(/\[data-studio-billing-header="true"\] > :first-child \{[^}]*font-size: 15px/.test(css), 'card titles take the Your details section heading size')
}
const CSS = read('components/studio-page-consistency/studio-page-consistency.css')
checkCss(CSS)
ok(/StudioPageConsistencyMount/.test(read('app/(app)/layout.tsx')) && /STUDIO_PAGE_CONSISTENCY_ENABLED && <StudioPageConsistencyMount/.test(read('app/(app)/layout.tsx')), 'the mount is drawn only with the flag')

// ---- 5. mutants
const h = 'components/layout/app-header.tsx'
caught(() => checkIdentity({ ...files, [h]: files[h].replace('export function AppHeader() {\n', 'export function AppHeader() {\n  const x = 1\n') }, strip.stripPageConsistency), 'an unmarked line added')
caught(() => checkIdentity(files, (rel, text) => text), 'a strip that strips nothing')
caught(() => checkLabels(read('lib/studio-create-word.ts').replace("process.env.NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY === 'true' && ", ''), read('components/builder/builder-header.tsx')), 'the label ignores the flag')
caught(() => checkLabels(read('lib/studio-create-word.ts'), read('components/builder/builder-header.tsx').replace('aria-label={studioTopBarV2 ? studioTopBarNewName', 'aria-label={studioTopBarV2 ? "New deck"')), 'a hard "New deck" put back')
caught(() => checkTopBar(read(h).replace('<BackToBuilderButton label="Back to Studio" /></div><Link data-studio-p2-new-deck', '</div><Link data-studio-p2-new-deck'), read('components/layout/studio-rail.tsx'), lib), 'Back to Studio dropped from the account bar')
caught(() => checkTopBar(read(h).replace('if (STUDIO_PAGE_CONSISTENCY_ENABLED && studioAccountPageTitle', 'if (studioAccountPageTitle'), read('components/layout/studio-rail.tsx'), lib), 'the account bar not gated')
caught(() => checkTopBar(read(h), read('components/layout/studio-rail.tsx'), { ...lib, studioRailDetailsCurrent: () => true }), 'rail current everywhere')
caught(() => checkCss(`${CSS}\n[data-studio-billing-card] { color: red; }\n`), 'an unscoped rule')
caught(() => checkCss(CSS.replace('font-size: 15px', 'font-size: 24px')), 'the old 24px card title')

console.log(`test-studio-page-consistency: ${checks} checks passed`)
