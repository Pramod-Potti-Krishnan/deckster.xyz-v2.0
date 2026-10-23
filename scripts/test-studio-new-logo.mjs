// STUDIO NEW LOGO (FRONTEND-1, Pass 3, PROGRAM-1 ask 3): the tile at the top left of the Studio rail shows the new Deckster logo mark instead of a Layers icon on a purple square. Flag
// NEXT_PUBLIC_STUDIO_NEW_LOGO (exact "true"), default off. The logo FILES themselves ship unflagged with the UAT marketing port (#483); this flag only puts one where the rail had an icon.
//
// Run: node scripts/test-studio-new-logo.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   STUDIO_NEW_LOGO_BASE=<commit> overrides the base the flag-off identity is checked against (default 6e0308e, the head of #483, the commit this change is stacked on).
//
// Proven on the REAL sources: lib/studio-new-logo.ts, components/layout/studio-rail.tsx, components/layout/studio-new-logo.css (and the shared files it must not touch):
//   1. the lib: only a real `true` is on; it is import-free; the image it names is a real, square PNG with pixels to spare for a 32px tile; the size it names is the tile's CSS size;
//   2. the rail is rendered (real component, stubbed leaves): flag off (unset, empty, "false", near-misses) the markup is the base commit's, byte for byte, on every route and for both home links;
//      on, the brand tile alone changes (one image of the right file and size, the same link, the same name, no Layers icon in it) and every other byte, every href and the Studio entry are the same;
//   3. the CSS (parsed): every selector needs the marker the rail sets only with the flag on, so it is inert without it; it beats the tile's own rules; it changes the tile's fill and shadow and the
//      image's fit and nothing about the tile's box (so the 32px tile, its link and the hairline under it stay), with a dark variant, and no media query (the 56px and the 48px rail get the same tile);
//   4. the shared files: the rail minus this change's lines is the base file; the shell and the details CSS, the logo files and the other flags' files are not touched; .env.example and the harness list
//      only gain lines; the flag is documented once, default "false"; nothing else reads it;
//   5. mutation check: every mutant of the lib, the rail, the CSS and .env.example is killed.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { sameOrTolerant, stackFileTolerant, stackScope } from './studio-stack-tolerant.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const postcss = nodeRequire('postcss')
const BASE_COMMIT = process.env.STUDIO_NEW_LOGO_BASE || '6e0308ebdc0057c33665ee86671c57a54c8daf88'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
function changedSinceBase() {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    // the working tree against the base (the same as HEAD once committed), new files included
    const run = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean)
    return [...new Set([...run(['diff', '--name-only', BASE_COMMIT]), ...run(['ls-files', '--others', '--exclude-standard'])])].sort()
  } catch { return null }
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count(assert.deepEqual)

const LIB = 'lib/studio-new-logo.ts'
const RAIL = 'components/layout/studio-rail.tsx'
const CSS = 'components/layout/studio-new-logo.css'
const ENV = '.env.example'
const HARNESS = 'scripts/studio-library-manage-harness.mjs'
const SHELL_CSS = 'components/layout/studio-shell.css'
const P2_CSS = 'components/layout/studio-p2-shell.css'
const SOURCES = { [LIB]: read(LIB), [RAIL]: read(RAIL), [CSS]: read(CSS), [ENV]: read(ENV) }
const FLAG = 'NEXT_PUBLIC_STUDIO_NEW_LOGO'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const MARK = 'data-studio-new-logo'
const LOGO_FILE = 'public/logo-icon-sm.png'
const TILE = '[data-studio-v4-rail] .studio-rail-brand[data-studio-new-logo="true"]'

const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
function loadLib(source) {
  const module = { exports: {} }
  new Function('module', 'exports', compile(source, LIB))(module, module.exports)
  return module.exports
}
const pngSize = rel => {
  const bytes = fs.readFileSync(path.join(repoRoot, rel))
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${rel} is a PNG`)
  assert.equal(bytes.subarray(12, 16).toString('latin1'), 'IHDR', `${rel} starts with its header`)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}
const declsOf = rule => Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]))
const rulesOf = source => { const found = []; postcss.parse(source).walkRules(rule => found.push({ selector: rule.selector, decls: declsOf(rule), inMedia: rule.parent?.type === 'atrule' })); return found }
const lastRule = (css, selector) => { const list = rulesOf(css).filter(rule => rule.selector === selector); return list.at(-1)?.decls }
// the tile's size in the shell's CSS (the last `.studio-rail-brand` rule wins: 32px)
const SHELL_BRAND = lastRule(read(SHELL_CSS), '[data-studio-v4-rail] .studio-rail-brand')

// ---------------------------------------------------------------- 1. the lib
const OFF_VALUES = [undefined, null, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on', '0']
function proveLib(lib, label = 'lib', source = SOURCES[LIB]) {
  eq(lib.studioNewLogoOn('true'), true, `${label}: a real true is on`)
  for (const value of OFF_VALUES) eq(lib.studioNewLogoOn(value), false, `${label}: ${JSON.stringify(value) ?? String(value)} is off`)
  for (const notString of [true, 1, {}, []]) eq(lib.studioNewLogoOn(notString), false, `${label}: ${JSON.stringify(notString)} (not the string) is off`)
  eq(lib.STUDIO_NEW_LOGO_SRC, '/logo-icon-sm.png', `${label}: the mark is the small logo file`)
  eq(lib.STUDIO_NEW_LOGO_SIZE, 32, `${label}: the image is drawn at the tile's size`)
  eq(typeof lib.studioNewLogoOn, 'function', `${label}: one function`)
  deepEq(Object.keys(lib).sort(), ['STUDIO_NEW_LOGO_SIZE', 'STUDIO_NEW_LOGO_SRC', 'studioNewLogoOn'], `${label}: three exports and nothing else`)
  nomatch(source.replace(/^\/\/.*$/gm, '').replace(/\/\*\*[\s\S]*?\*\//g, ''), /^import |require\(|fetch\(|localStorage|document\.|window\./m, `${label}: import-free, no I/O`)
}
proveLib(loadLib(SOURCES[LIB]))
function proveAssets(label = 'assets') {
  const lib = loadLib(SOURCES[LIB])
  ok(fs.existsSync(path.join(repoRoot, 'public', lib.STUDIO_NEW_LOGO_SRC.slice(1))), `${label}: the file the lib names exists in public/`)
  const { width, height } = pngSize(path.join('public', lib.STUDIO_NEW_LOGO_SRC.slice(1)))
  eq(width, height, `${label}: the mark is square`)
  ok(width >= lib.STUDIO_NEW_LOGO_SIZE * 2, `${label}: at least two pixels per CSS pixel (${width} for ${lib.STUDIO_NEW_LOGO_SIZE})`)
  eq(`${width}x${height}`, '160x160', `${label}: the small logo's pixel size (the port keeps the old files' sizes)`)
  eq(SHELL_BRAND?.height, `${lib.STUDIO_NEW_LOGO_SIZE}px`, `${label}: the tile is as tall as the image`)
  eq(SHELL_BRAND?.width, `${lib.STUDIO_NEW_LOGO_SIZE}px`, `${label}: the tile is as wide as the image`)
  const shell = read(SHELL_CSS)
  match(shell, /--ss-rail-width: 56px;/, `${label}: the rail is 56px wide`)
  match(shell, /@media \(max-width: 780px\) \{\s*\[data-studio-v4-shell="true"\] \{ --ss-rail-width: 48px; \}/, `${label}: and 48px wide on a phone`)
  ok(lib.STUDIO_NEW_LOGO_SIZE <= 48, `${label}: the tile fits the narrow rail`)
}
proveAssets()

// ---------------------------------------------------------------- 2. the rail, rendered
const env = {}
const pathname = { value: '/builder' }
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), className: props?.className })) })
const hint = ({ enabled, label, children }) => enabled ? React.createElement('span', { 'data-hint': label }, children) : children
function stubs(lib) {
  return {
    react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide,
    'next/link': { __esModule: true, default: ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children) },
    'next/navigation': { usePathname: () => pathname.value },
    '@/components/user-profile-menu': { UserProfileMenu: () => React.createElement('span', { 'data-stub': 'profile' }) },
    '@/components/layout/studio-navigation-hint': { StudioNavigationHint: hint },
    '@/lib/studio-nav-labels': { studioNavLabels: plain => plain === true ? { decks: 'Your decks', knowledge: 'Second brain' } : { decks: 'Decks', knowledge: 'Knowledge' } },
    '@/lib/studio-new-logo': lib,
  }
}
function component(source, lib) {
  const module = { exports: {} }
  const table = stubs(lib)
  vm.runInNewContext(compile(source, RAIL), { module, exports: module.exports, process: { env }, require: spec => { if (spec.endsWith('.css')) return {}; if (!(spec in table)) throw new Error(`unexpected import ${spec}`); return table[spec] } })
  return module.exports.StudioRail
}
const setEnv = (values = {}) => { for (const key of Object.keys(env)) delete env[key]; Object.assign(env, values) }
const render = (Component, route, values, props = {}) => { setEnv(values); pathname.value = route; return renderToStaticMarkup(React.createElement(Component, props)) }
const ROUTES = ['/builder', '/builder/x', '/dashboard', '/knowledge', '/studio/templates', '/studio/themes', '/studio/intelligence', '/studio/details', '/help']
const HOMES = [undefined, 'https://deckster.xyz', '/']
const hrefs = html => [...html.matchAll(/href="([^"]*)"/g)].map(m => m[1])
const BRAND = /<a [^>]*class="studio-rail-brand"[^>]*>[\s\S]*?<\/a>/g
const homeOf = home => home === undefined ? '/' : home
const IMG = (size = 32) => `<img src="/logo-icon-sm.png" width="${size}" height="${size}" alt="" aria-hidden="true" draggable="false"/>`
// React 19 hoists a preload for an image it renders (into the head, once): the only markup the flag adds outside the tile, and wanted (the mark loads early)
const PRELOAD = '<link rel="preload" as="image" href="/logo-icon-sm.png"/>'
const ON_BRAND = home => `<a href="${homeOf(home)}" class="studio-rail-brand" aria-label="Deckster home" ${MARK}="true">${IMG()}</a>`
function proveRail(railSource, lib, label = 'rail') {
  const Rail = component(railSource, lib)
  const baseRailSource = baseSource(RAIL)
  const BaseRail = baseRailSource ? component(baseRailSource, lib) : null
  const flagEnv = value => ({ [SHELL]: 'true', ...(value === undefined ? {} : { [FLAG]: value }) })
  for (const route of ROUTES) {
    for (const home of HOMES) {
      const props = home === undefined ? {} : { homeHref: home }
      for (const value of OFF_VALUES) {
        const off = render(Rail, route, flagEnv(value === null ? undefined : value), props)
        if (BaseRail) eq(off, render(BaseRail, route, flagEnv(undefined), props), `${label}: flag ${JSON.stringify(value)} on ${route} (home ${home}) is the base commit's markup`)
        nomatch(off, /<img|<link|data-studio-new-logo/, `${label}: flag ${JSON.stringify(value)} on ${route}: no image, no preload, no marker`)
        eq(off.split('data-icon="Layers"').length - 1, 2, `${label}: flag ${JSON.stringify(value)} on ${route}: the brand's Layers icon and the Studio entry's are both there`)
      }
      const off = render(Rail, route, flagEnv(undefined), props), onRaw = render(Rail, route, flagEnv('true'), props)
      ok((onRaw.split(PRELOAD).length - 1) <= 1, `${label}: at most one preload of the mark on ${route}`)
      const on = onRaw.replace(PRELOAD, '')
      const offBrand = off.match(BRAND), onBrand = on.match(BRAND)
      eq(offBrand?.length, 1, `${label}: one brand tile (flag off, ${route})`)
      eq(onBrand?.length, 1, `${label}: one brand tile (flag on, ${route})`)
      eq(onBrand[0], ON_BRAND(home), `${label}: the brand tile on ${route} (home ${home}) is the link, its name, the marker and one image`)
      eq(offBrand[0], `<a href="${homeOf(home)}" class="studio-rail-brand" aria-label="Deckster home"><svg data-icon="Layers" class="h-5 w-5"></svg></a>`, `${label}: and off it is the Layers icon`)
      eq(on.replace(BRAND, '<BRAND/>'), off.replace(BRAND, '<BRAND/>'), `${label}: nothing outside the brand tile differs on ${route} (home ${home})`)
      deepEq(hrefs(on), hrefs(off), `${label}: every href is the same on ${route} (home ${home})`)
      eq(on.split('<img').length - 1, 1, `${label}: one image in the whole rail on ${route}`)
      eq(on.split('data-icon="Layers"').length - 1, 1, `${label}: the Studio entry keeps its Layers icon on ${route}`)
      nomatch(onBrand[0], /<svg/, `${label}: no icon inside the brand tile on ${route}`)
    }
  }
  // the shell flag does not gate the rail: it only exists in the shell, so the logo flag alone decides
  eq(render(Rail, '/builder', { [FLAG]: 'true' }).includes(`${MARK}="true"`), true, `${label}: the rail reads only its own flag`)
  eq(render(Rail, '/builder', { [FLAG]: 'true', [SHELL]: 'false' }).includes(`${MARK}="true"`), true, `${label}: whatever the shell flag says`)
  // a given Studio entry and the usage slot still pass through
  const entry = React.createElement('button', { 'data-given': 'entry' })
  const given = render(Rail, '/builder', flagEnv('true'), { studioEntry: entry })
  ok(given.includes('<button data-given="entry"></button>') && !given.includes('aria-label="Studio"'), `${label}: a given Studio entry replaces the default one`)
  eq(given.match(BRAND).length, 1, `${label}: with the logo on`)
}
proveRail(SOURCES[RAIL], loadLib(SOURCES[LIB]))
if (!baseSource(RAIL)) console.log(`  SKIP base-commit rail identity: ${BASE_COMMIT} is not in this clone`)

// ---------------------------------------------------------------- 3. the CSS
function proveCss(css, label = 'css') {
  const rules = rulesOf(css)
  eq(rules.length, 3, `${label}: three rules: the tile, the image, the image in the dark`)
  for (const rule of rules) {
    ok(rule.selector.includes('[data-studio-new-logo="true"]'), `${label}: needs the marker the rail sets only with the flag on: ${rule.selector}`)
    ok(rule.selector.includes('[data-studio-v4-rail] .studio-rail-brand[data-studio-new-logo="true"]'), `${label}: names the rail's own tile: ${rule.selector}`)
    eq(rule.inMedia, false, `${label}: no media query, so the 56px and the 48px rail get the same tile: ${rule.selector}`)
  }
  const tile = rules.find(rule => rule.selector === TILE), img = rules.find(rule => rule.selector === `${TILE} > img`), dark = rules.find(rule => rule.selector === `.dark ${TILE} > img`)
  ok(tile && img && dark, `${label}: the three selectors`)
  deepEq(tile.decls, { background: 'transparent', 'box-shadow': 'none' }, `${label}: the tile loses only its purple fill and its square shadow`)
  deepEq(img.decls, { display: 'block', width: '100%', height: '100%', 'object-fit': 'contain', filter: 'drop-shadow(0 2px 5px rgb(68 51 230 / 22%))', 'user-select': 'none' }, `${label}: the image fills the tile, contained, with a shadow that follows its shape`)
  deepEq(Object.keys(dark.decls), ['filter'], `${label}: the dark variant changes only the shadow`)
  match(dark.decls.filter, /^drop-shadow\(0 2px 5px rgb\(0 0 0 \/ 40%\)\)$/, `${label}: a dark shadow on the dark frame`)
  // it beats the tile's own rules (the shell's `[data-studio-v4-rail] .studio-rail-brand`, specificity 0-2-0): marker + class + attribute is 0-3-0
  const spec = selector => ({ attrs: (selector.match(/\[[^\]]+\]/g) ?? []).length, classes: (selector.match(/\.[A-Za-z_-]+/g) ?? []).length })
  const tileSpec = spec(TILE), baseSpec = spec('[data-studio-v4-rail] .studio-rail-brand')
  ok(tileSpec.attrs + tileSpec.classes > baseSpec.attrs + baseSpec.classes, `${label}: more specific than the shell's tile rule, whatever the order`)
  // nothing about the tile's box
  for (const prop of ['height', 'width', 'min-width', 'min-height', 'padding', 'margin', 'position', 'display', 'flex', 'flex-shrink', 'border-radius', 'outline', 'order', 'visibility', 'pointer-events', 'opacity', 'transform', 'overflow', 'color', 'content'])
    ok(!(prop in tile.decls), `${label}: the tile's ${prop} is not touched (its 32px box, its link and the hairline under it stay)`)
  nomatch(css, /display:\s*none|visibility:|pointer-events:|::after|::before|!important/, `${label}: nothing hidden, inert or forced`)
  nomatch(css, /@media/, `${label}: no media query`)
  match(css, /^\/\* STUDIO NEW LOGO \(flag NEXT_PUBLIC_STUDIO_NEW_LOGO, default off;/, `${label}: names its flag`)
}
proveCss(SOURCES[CSS])
function proveCssWiring(railSource, label = 'css wiring') {
  match(railSource, /^import "\.\/studio-new-logo\.css"$/m, `${label}: the rail imports the CSS`)
  match(railSource, /^import "\.\/studio-p2-shell\.css"\nimport "\.\/studio-new-logo\.css"$/m, `${label}: after the shell's own sheets`)
}
proveCssWiring(SOURCES[RAIL])

// ---------------------------------------------------------------- 4. the shared files
const RAIL_CHANGES = [
  ['import { studioNavLabels } from "@/lib/studio-nav-labels"\nimport { STUDIO_NEW_LOGO_SIZE, STUDIO_NEW_LOGO_SRC, studioNewLogoOn } from "@/lib/studio-new-logo"\n', 'import { studioNavLabels } from "@/lib/studio-nav-labels"\n'],
  ['import "./studio-p2-shell.css"\nimport "./studio-new-logo.css"\n', 'import "./studio-p2-shell.css"\n'],
  ["  // NEXT_PUBLIC_STUDIO_NEW_LOGO (default off): the brand tile shows the new logo mark in place of the Layers icon; the link, its name and its box are the same.\n  const newLogo = studioNewLogoOn(process.env.NEXT_PUBLIC_STUDIO_NEW_LOGO)\n", ''],
  ['<Link href={homeHref} className="studio-rail-brand" aria-label="Deckster home" data-studio-new-logo={newLogo ? "true" : undefined}>{newLogo ? <img src={STUDIO_NEW_LOGO_SRC} width={STUDIO_NEW_LOGO_SIZE} height={STUDIO_NEW_LOGO_SIZE} alt="" aria-hidden="true" draggable={false} /> : <Layers className="h-5 w-5" />}</Link>', '<Link href={homeHref} className="studio-rail-brand" aria-label="Deckster home"><Layers className="h-5 w-5" /></Link>'],
]
const stripRail = text => RAIL_CHANGES.reduce((out, [from, to]) => { assert.ok(out.includes(from), `own text present: ${from.slice(0, 70)}`); return out.replace(from, () => to) }, text)
function proveShared(railSource, envSource, harnessSource, label = 'shared') {
  const baseRail = baseSource(RAIL), baseEnv = baseSource(ENV), baseHarness = baseSource(HARNESS)
  if (baseRail) {
    const verdict = sameOrTolerant(RAIL, railSource, stripRail(railSource), baseRail, RAIL_CHANGES)
    ok(verdict.ok, `${label}: studio-rail.tsx minus this change's lines is the base file: ${verdict.reason}`)
  }
  if (baseEnv) { const verdict = stackFileTolerant(baseEnv, envSource); ok(verdict.ok, `${label}: .env.example only gains lines: ${verdict.reason}`) }
  if (baseHarness) { const verdict = stackFileTolerant(baseHarness, harnessSource); ok(verdict.ok, `${label}: the harness list only gains lines: ${verdict.reason}`) }
  eq((envSource.match(/^NEXT_PUBLIC_STUDIO_NEW_LOGO="false"$/gm) ?? []).length, 1, `${label}: documented once in .env.example, default off`)
  eq((envSource.match(/NEXT_PUBLIC_STUDIO_NEW_LOGO/g) ?? []).length, 1, `${label}: the flag's name appears only as the assignment (the block says "the flag" in words)`)
  const block = envSource.slice(envSource.indexOf('# STUDIO NEW LOGO ('), envSource.indexOf('NEXT_PUBLIC_STUDIO_NEW_LOGO="false"'))
  ok(block.length > 100, `${label}: the block is above its flag`)
  nomatch(block, /exact "true" enables it/, `${label}: without the phrase the onboarding test keys on`)
  nomatch(block, /READ AT BUILD TIME|Only the value true turns it on|Needs the Studio shell \(|PASS2|P2_/, `${label}: reuses no other block's phrases (other tests mutate the first place a phrase occurs)`)
  match(block, /Set it to the string true to turn it on; any other value, or none, leaves the tile exactly as before\./, `${label}: says what turns it on`)
  match(block, /baked into the bundle when Vercel builds, so change it there and redeploy\./, `${label}: says it is read at build time`)
  match(block, /It matters only inside the Studio shell \(NEXT_PUBLIC_STUDIO_V4_SHELL\)/, `${label}: says it needs the shell`)
  match(block, /logo and app icon FILES are not behind this flag/, `${label}: says the files are not behind it`)
  // the library-manage tests allow, among the files under app/components/lib/hooks, only the ones this list names
  for (const rel of [LIB, CSS, RAIL]) eq((harnessSource.match(new RegExp(`'${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')) ?? []).length, 1, `${label}: the diff-scope harness lists ${rel} once`)
}
proveShared(SOURCES[RAIL], SOURCES[ENV], read(HARNESS))

// what changed since the base: this change's files, and not the shell's CSS, the logo files or the other flags' files
const OWN = ['.env.example', 'components/layout/studio-new-logo.css', 'components/layout/studio-rail.tsx', 'lib/studio-new-logo.ts', 'scripts/studio-library-manage-harness.mjs', 'scripts/test-studio-new-logo.mjs', 'scripts/test-studio-p2-details.mjs', 'scripts/test-studio-plain-nav-labels.mjs']
const OWN_EXTRA = [] // other registrations (package.json) are checked by their own tests
const CHANGE = { pr: 'studio-new-logo', files: [...OWN, ...OWN_EXTRA], family: /^(lib\/studio-new-logo[^/]*|components\/layout\/studio-new-logo[^/]*|scripts\/(test-)?studio-new-logo[^/]*)$/, stray: 'lib/studio-new-logo-later.ts' }
function proveScope(changed, label = 'scope') {
  const scope = stackScope(changed, CHANGE, rel => CHANGE.files.includes(rel) || rel === 'package.json')
  deepEq(scope.stray, [], `${label}: no stray file in this change's path family`)
  for (const rel of OWN.filter(rel => rel !== 'scripts/studio-library-manage-harness.mjs')) ok(changed.includes(rel), `${label}: ${rel} is changed against the base`)
  for (const rel of [SHELL_CSS, P2_CSS, 'components/layout/app-header.tsx', 'components/layout/Header.tsx', 'components/builder/builder-header.tsx', 'app/builder/page.tsx', LOGO_FILE, 'public/logo-icon.png', 'public/logo-wordmark.png', 'public/logo-wordmark-sm.png', 'app/icon.png'])
    ok(!changed.includes(rel), `${label}: ${rel} is not touched`)
  if (counting) console.log(`  ${scope.line}`)
}
const changed = changedSinceBase()
if (changed) proveScope(changed)
else console.log(`  SKIP diff scope: ${BASE_COMMIT} is not in this clone`)
// the flag is read in one place: the rail
{
  const readers = []
  const walk = dir => { for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) { if (['node_modules', '.next', '.git'].includes(entry.name)) continue; const rel = path.posix.join(dir, entry.name); if (entry.isDirectory()) walk(rel); else if (/\.(tsx?|css|mjs)$/.test(entry.name) && !rel.startsWith('scripts/')) { if (read(rel).includes('NEXT_PUBLIC_STUDIO_NEW_LOGO') || read(rel).includes('studio-new-logo')) readers.push(rel) } } }
  for (const dir of ['app', 'components', 'lib', 'hooks']) walk(dir)
  deepEq(readers.sort(), [CSS, LIB, RAIL].sort(), 'only the rail, the lib and the CSS name the flag, the lib or the sheet')
}

// ---------------------------------------------------------------- 5. mutation check
const sh = read(HARNESS)
const MUTANTS = [
  [LIB, 'flag read loosely', "return value === 'true'", 'return Boolean(value)'],
  [LIB, 'flag read case-insensitively', "return value === 'true'", "return String(value).toLowerCase() === 'true'"],
  [LIB, 'always on', "return value === 'true'", 'return true'],
  [LIB, 'never on', "return value === 'true'", 'return false'],
  [LIB, 'inverted', "return value === 'true'", "return value !== 'true'"],
  [LIB, 'trimmed', "return value === 'true'", "return value?.trim() === 'true'"],
  [LIB, 'mark is the big file', "STUDIO_NEW_LOGO_SRC = '/logo-icon-sm.png'", "STUDIO_NEW_LOGO_SRC = '/logo-icon.png'"],
  [LIB, 'mark is the wordmark', "STUDIO_NEW_LOGO_SRC = '/logo-icon-sm.png'", "STUDIO_NEW_LOGO_SRC = '/logo-wordmark-sm.png'"],
  [LIB, 'mark is a file that is not there', "STUDIO_NEW_LOGO_SRC = '/logo-icon-sm.png'", "STUDIO_NEW_LOGO_SRC = '/logo-new.png'"],
  [LIB, 'size is not the tile', 'STUDIO_NEW_LOGO_SIZE = 32', 'STUDIO_NEW_LOGO_SIZE = 40'],
  [LIB, 'size is smaller than the tile', 'STUDIO_NEW_LOGO_SIZE = 32', 'STUDIO_NEW_LOGO_SIZE = 20'],
  [LIB, 'an import appears', "export function studioNewLogoOn", "import { x } from './x'\nexport function studioNewLogoOn"],
  [LIB, 'a request appears', "return value === 'true'", "if (value === 'never') fetch('/x'); return value === 'true'"],
  [LIB, 'an export appears', "export const STUDIO_NEW_LOGO_SIZE = 32", "export const STUDIO_NEW_LOGO_SIZE = 32\nexport const EXTRA = 1"],
  [RAIL, 'flag read loosely', 'studioNewLogoOn(process.env.NEXT_PUBLIC_STUDIO_NEW_LOGO)', 'studioNewLogoOn(process.env.NEXT_PUBLIC_STUDIO_NEW_LOGO || process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)'],
  [RAIL, 'another flag read', 'studioNewLogoOn(process.env.NEXT_PUBLIC_STUDIO_NEW_LOGO)', 'studioNewLogoOn(process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS)'],
  [RAIL, 'flag ignored (always on)', 'studioNewLogoOn(process.env.NEXT_PUBLIC_STUDIO_NEW_LOGO)', 'studioNewLogoOn("true")'],
  [RAIL, 'flag ignored (never on)', 'studioNewLogoOn(process.env.NEXT_PUBLIC_STUDIO_NEW_LOGO)', 'studioNewLogoOn("false")'],
  [RAIL, 'gated on the shell flag too', 'studioNewLogoOn(process.env.NEXT_PUBLIC_STUDIO_NEW_LOGO)', 'studioNewLogoOn(process.env.NEXT_PUBLIC_STUDIO_NEW_LOGO) && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"'],
  [RAIL, 'marker always', 'data-studio-new-logo={newLogo ? "true" : undefined}', 'data-studio-new-logo="true"'],
  [RAIL, 'marker never', 'data-studio-new-logo={newLogo ? "true" : undefined}', 'data-studio-new-logo={undefined}'],
  [RAIL, 'marker value wrong', 'data-studio-new-logo={newLogo ? "true" : undefined}', 'data-studio-new-logo={newLogo ? "on" : undefined}'],
  [RAIL, 'marker renamed', 'data-studio-new-logo={newLogo ? "true" : undefined}', 'data-studio-logo={newLogo ? "true" : undefined}'],
  [RAIL, 'marker set with the flag off', 'data-studio-new-logo={newLogo ? "true" : undefined}', 'data-studio-new-logo={newLogo ? "true" : "false"}'],
  [RAIL, 'image always', '{newLogo ? <img', '{true ? <img'],
  [RAIL, 'image never', '{newLogo ? <img', '{false ? <img'],
  [RAIL, 'image inverted', '{newLogo ? <img', '{!newLogo ? <img'],
  [RAIL, 'image source is a literal', 'src={STUDIO_NEW_LOGO_SRC}', 'src="/logo-icon.png"'],
  [RAIL, 'image width is not the size', 'width={STUDIO_NEW_LOGO_SIZE}', 'width={40}'],
  [RAIL, 'image height is not the size', 'height={STUDIO_NEW_LOGO_SIZE}', 'height={40}'],
  [RAIL, 'image has a name', 'alt="" aria-hidden="true"', 'alt="Deckster" aria-hidden="true"'],
  [RAIL, 'image is not hidden', 'alt="" aria-hidden="true"', 'alt=""'],
  [RAIL, 'image can be dragged', 'draggable={false}', 'draggable'],
  [RAIL, 'icon kept inside the logo', '{newLogo ? <img src={STUDIO_NEW_LOGO_SRC}', '{newLogo ? <><Layers className="h-5 w-5" /><img src={STUDIO_NEW_LOGO_SRC}'],
  [RAIL, 'icon changed with the flag off', ': <Layers className="h-5 w-5" />}</Link>', ': <Layers className="h-6 w-6" />}</Link>'],
  [RAIL, 'icon dropped with the flag off', ': <Layers className="h-5 w-5" />}</Link>', ': null}</Link>'],
  [RAIL, 'home link dropped', 'href={homeHref} className="studio-rail-brand"', 'href="/" className="studio-rail-brand"'],
  [RAIL, 'tile name changed', 'aria-label="Deckster home" data-studio-new-logo', 'aria-label="Home" data-studio-new-logo'],
  [RAIL, 'tile class changed', 'className="studio-rail-brand" aria-label="Deckster home" data-studio', 'className="studio-rail-logo" aria-label="Deckster home" data-studio'],
  [RAIL, 'studio entry becomes an image', '<button type="button" aria-label="Studio" aria-current="page"><Layers className="h-5 w-5" /></button>', '<button type="button" aria-label="Studio" aria-current="page"><img src="/logo-icon-sm.png" alt="" /></button>'],
  [RAIL, 'a nav label changed', '{label:\'Templates\',href:\'/studio/templates\',Icon:LayoutTemplate}', '{label:\'My templates\',href:\'/studio/templates\',Icon:LayoutTemplate}'],
  [RAIL, 'css not imported', 'import "./studio-new-logo.css"\n', ''],
  [RAIL, 'css imported before the shell sheets', 'import "./studio-shell.css"\nimport "./studio-p2-shell.css"\nimport "./studio-new-logo.css"\n', 'import "./studio-new-logo.css"\nimport "./studio-shell.css"\nimport "./studio-p2-shell.css"\n'],
  [CSS, 'tile fill kept', '{ background: transparent; box-shadow: none; }', '{ box-shadow: none; }'],
  [CSS, 'tile fill purple', '{ background: transparent; box-shadow: none; }', '{ background: #6a4fc0; box-shadow: none; }'],
  [CSS, 'tile shadow kept', '{ background: transparent; box-shadow: none; }', '{ background: transparent; }'],
  [CSS, 'tile resized', '{ background: transparent; box-shadow: none; }', '{ background: transparent; box-shadow: none; width: 40px; height: 40px; }'],
  [CSS, 'tile padded', '{ background: transparent; box-shadow: none; }', '{ background: transparent; box-shadow: none; padding: 4px; }'],
  [CSS, 'tile hidden', '{ background: transparent; box-shadow: none; }', '{ background: transparent; box-shadow: none; display: none; }'],
  [CSS, 'tile rule unscoped (no marker)', '.studio-rail-brand[data-studio-new-logo="true"] { background', '.studio-rail-brand { background'],
  [CSS, 'image rule unscoped (no marker)', '.studio-rail-brand[data-studio-new-logo="true"] > img { display', '.studio-rail-brand > img { display'],
  [CSS, 'dark rule unscoped (no marker)', '.dark [data-studio-v4-rail] .studio-rail-brand[data-studio-new-logo="true"] > img', '.dark [data-studio-v4-rail] .studio-rail-brand > img'],
  [CSS, 'tile rule not in the rail', '[data-studio-v4-rail] .studio-rail-brand[data-studio-new-logo="true"] { background', '.studio-rail-brand[data-studio-new-logo="true"] { background'],
  [CSS, 'image smaller than the tile', 'width: 100%; height: 100%;', 'width: 20px; height: 20px;'],
  [CSS, 'image narrower than the tile', 'display: block; width: 100%;', 'display: block; width: 80%;'],
  [CSS, 'image stretched', 'object-fit: contain;', 'object-fit: fill;'],
  [CSS, 'image cropped', 'object-fit: contain;', 'object-fit: cover;'],
  [CSS, 'image inline', 'display: block;', 'display: inline;'],
  [CSS, 'image shadow gone', 'filter: drop-shadow(0 2px 5px rgb(68 51 230 / 22%)); user-select', 'user-select'],
  [CSS, 'dark rule dropped', '\n.dark [data-studio-v4-rail] .studio-rail-brand[data-studio-new-logo="true"] > img { filter: drop-shadow(0 2px 5px rgb(0 0 0 / 40%)); }', ''],
  [CSS, 'dark shadow is the light one', '.dark [data-studio-v4-rail] .studio-rail-brand[data-studio-new-logo="true"] > img { filter: drop-shadow(0 2px 5px rgb(0 0 0 / 40%)); }', '.dark [data-studio-v4-rail] .studio-rail-brand[data-studio-new-logo="true"] > img { filter: drop-shadow(0 2px 5px rgb(68 51 230 / 22%)); }'],
  [CSS, 'a media query appears', '/* STUDIO NEW LOGO', '@media (max-width: 780px) { [data-studio-v4-rail] .studio-rail-brand[data-studio-new-logo="true"] { background: red; } }\n/* STUDIO NEW LOGO'],
  [CSS, 'a hairline rule appears', '/* STUDIO NEW LOGO', '[data-studio-v4-rail] .studio-rail-brand[data-studio-new-logo="true"]::after { display: none; }\n/* STUDIO NEW LOGO'],
  [CSS, 'important forced', 'background: transparent; box-shadow: none; }', 'background: transparent !important; box-shadow: none; }'],
  [ENV, 'flag line removed', 'NEXT_PUBLIC_STUDIO_NEW_LOGO="false"\n', ''],
  [ENV, 'default on', 'NEXT_PUBLIC_STUDIO_NEW_LOGO="false"', 'NEXT_PUBLIC_STUDIO_NEW_LOGO="true"'],
  [ENV, 'default empty', 'NEXT_PUBLIC_STUDIO_NEW_LOGO="false"', 'NEXT_PUBLIC_STUDIO_NEW_LOGO=""'],
  [ENV, 'flag documented twice', 'NEXT_PUBLIC_STUDIO_NEW_LOGO="false"', 'NEXT_PUBLIC_STUDIO_NEW_LOGO="false"\nNEXT_PUBLIC_STUDIO_NEW_LOGO="false"'],
  [ENV, 'the phrase onboarding keys on', 'Set it to the string true to turn it on;', 'exact "true" enables it;'],
  [ENV, 'another block\'s phrase borrowed', 'so change it there and redeploy.', 'READ AT BUILD TIME: set it on Vercel, then redeploy.'],
  [ENV, 'turn-on sentence dropped', 'Set it to the string true to turn it on; any other value, or none, leaves the tile exactly as before.', ''],
  [ENV, 'build-time note dropped', 'The value is baked into the bundle when Vercel builds, so change it there and redeploy. ', ''],
  [ENV, 'shell note dropped', 'It matters only inside the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL), because the rail exists only there. ', ''],
  [ENV, 'files note dropped', 'The logo and app icon FILES are not behind this flag', 'The logo files are not behind this flag'],
  [ENV, 'an earlier line of the file edited', '# UAT MARKETING PORT (FRONTEND-1, Pass 3)', '# UAT MARKETING PORT (FRONTEND-2, Pass 3)'],
]
let killed = 0, byThrow = 0
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    const lib = file === LIB ? loadLib(mutated) : loadLib(SOURCES[LIB])
    if (file === LIB) { proveLib(lib, name, mutated); proveAssets(name); proveRail(SOURCES[RAIL], lib, name) }
    if (file === RAIL) { proveRail(mutated, lib, name); proveCssWiring(mutated, name); proveShared(mutated, SOURCES[ENV], sh, name) }
    if (file === CSS) proveCss(mutated, name)
    if (file === ENV) proveShared(SOURCES[RAIL], mutated, sh, name)
    survived = true
  } catch (error) {
    if (error?.code === 'ERR_ASSERTION') killed++
    else { killed++; byThrow++ }
  }
  assert.ok(!survived, `mutant survived: ${name}`)
}
// the harness list: each of this change's files taken out is refused
for (const rel of [LIB, CSS, RAIL]) {
  const mutated = sh.replace(`'${rel}', `, '').replace(`, '${rel}'`, '')
  assert.notEqual(mutated, sh, `harness mutant for ${rel} changes the list`)
  let survived = false
  try { proveShared(SOURCES[RAIL], SOURCES[ENV], mutated, `harness without ${rel}`); survived = true } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION'); killed++ }
  assert.ok(!survived, `mutant survived: harness without ${rel}`)
}
// the scope: a later PR's stray file in this change's family and an own file missing are refused
{
  const refused = fn => { try { fn(); return false } catch (error) { return error?.code === 'ERR_ASSERTION' } }
  const clean = changed ?? CHANGE.files
  assert.ok(refused(() => proveScope([...clean, CHANGE.stray], 'stray')), 'mutant: a stray file in this change\'s family is refused'); killed++
  assert.ok(refused(() => proveScope(clean.filter(rel => rel !== CSS), 'own file missing')), 'mutant: an own file missing is refused'); killed++
  assert.ok(refused(() => proveScope([...clean, SHELL_CSS], 'shell css touched')), 'mutant: the shell CSS touched is refused'); killed++
  assert.ok(refused(() => proveScope([...clean, LOGO_FILE], 'logo file touched')), 'mutant: the logo file touched is refused'); killed++
  assert.ok(!refused(() => proveScope([...clean, 'app/later-pr/page.tsx'], 'later pr')), 'control: a later PR\'s file elsewhere is ignored');
}
counting = true
const TOTAL = MUTANTS.length + 3 + 4
eq(killed, TOTAL)

console.log(`Studio new logo (rail brand tile): ${checks} checks passed, ${killed}/${TOTAL} mutants killed (${killed - byThrow} by an assertion, ${byThrow} by the code throwing); no network.`)
