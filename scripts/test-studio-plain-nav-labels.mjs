// PASS2B G43 + G54 (FRONTEND-2): plain words for the Studio navigation, as the accepted v4 mockup has them. Flag NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS
// (exact "true"), default off.
//   G43: the rail's "Decks" and "Knowledge" (tooltip and accessible name) and the top bar's title for /dashboard and /knowledge read "Your decks" and
//        "Second brain". Routes and every other label are untouched.
//   G54: the Decks page's second tab "Strawman Previews (n)" reads "Outline previews (n)" (Studio shell only).
//
// Run: node scripts/test-studio-plain-nav-labels.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   PLAIN_NAV_LABELS_BASE=<commit> overrides the base commit the flag-off identity is checked against (default 687b694).
//
// Proven on the REAL sources: lib/studio-nav-labels.ts, components/layout/studio-rail.tsx, components/layout/app-header.tsx and
// app/(app)/dashboard/page.tsx:
//   1. the words: flag off the lib's labels are the literals the base commit's files hold; only a real `true` gives the plain ones;
//   2. the rail and the top bar are rendered (real components, stubbed leaves): flag off (unset, empty, "false", near-misses) the markup is the base
//      commit's, byte for byte, for every route; on, only the two destinations' tooltip, accessible name and title change and every href stays;
//   3. the Decks page: with its G54 text removed the file is the base commit's (it imports nothing new); the tab's two branches render (renderToString,
//      text nodes included) exactly as the base's tab and the plain one; flag read inline, exact "true", Studio shell only;
//   4. mutation check: every mutant of the four sources is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup, renderToString } = nodeRequire('react-dom/server')
const BASE_COMMIT = process.env.PLAIN_NAV_LABELS_BASE || '687b694'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count(assert.deepEqual)

const LIB = 'lib/studio-nav-labels.ts'
const RAIL = 'components/layout/studio-rail.tsx'
const HEADER = 'components/layout/app-header.tsx'
const DASH = 'app/(app)/dashboard/page.tsx'
const SOURCES = { [LIB]: read(LIB), [RAIL]: read(RAIL), [HEADER]: read(HEADER), [DASH]: read(DASH) }
const FLAG = 'NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'

const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
function loadLib(source) {
  const module = { exports: {} }
  new Function('module', 'exports', compile(source, LIB))(module, module.exports)
  return module.exports
}

// ---------------------------------------------------------------- 1. the words
const ORIGINAL = { decks: 'Decks', knowledge: 'Knowledge' }
const PLAIN = { decks: 'Your decks', knowledge: 'Second brain' }
function proveLib(lib, label = 'lib') {
  deepEq({ ...lib.studioNavLabels(false) }, ORIGINAL, `${label}: off`)
  deepEq({ ...lib.studioNavLabels(true) }, PLAIN, `${label}: on`)
  for (const notTrue of [undefined, null, 0, 1, '', 'true', 'false', {}, [], NaN]) deepEq({ ...lib.studioNavLabels(notTrue) }, ORIGINAL, `${label}: ${JSON.stringify(notTrue) ?? String(notTrue)} is not a real true`)
  deepEq(Object.keys(lib.studioNavLabels(true)).sort(), Object.keys(ORIGINAL).sort(), `${label}: the same keys either way`)
  nomatch(SOURCES[LIB].replace(/^\/\/.*$/gm, ''), /^import |require\(/m, `${label}: import-free`)
  // the original words are the literals the base commit's files hold
  const baseRail = baseSource(RAIL), baseHeader = baseSource(HEADER), baseDash = baseSource(DASH)
  if (baseRail && baseHeader && baseDash) {
    match(baseRail, /label="Decks"><Link href="\/dashboard" aria-label="Decks"/, `${label}: base rail Decks`)
    match(baseRail, /label="Knowledge"><Link href="\/knowledge" aria-label="Knowledge"/, `${label}: base rail Knowledge`)
    match(baseHeader, /pathname === "\/dashboard" \? "Decks" : pathname === "\/knowledge" \? "Knowledge" :/, `${label}: base top bar`)
    match(baseDash, /^ {14}Strawman Previews \(\{strawmanPresentations\.length\}\)$/m, `${label}: base tab`)
    eq(lib.studioNavLabels(false).decks, 'Decks'); eq(lib.studioNavLabels(false).knowledge, 'Knowledge')
  }
}
proveLib(loadLib(SOURCES[LIB]))

// ---------------------------------------------------------------- 2. the rail and the top bar
const env = {}
const pathname = { value: '/builder' }
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), className: props?.className })) })
const hint = ({ enabled, label, children }) => enabled ? React.createElement('span', { 'data-hint': label }, children) : children
function stubs(lib) {
  return {
    react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide,
    'next/link': { __esModule: true, default: ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children) },
    'next/navigation': { usePathname: () => pathname.value, useRouter: () => ({ push() {} }) },
    '@/components/user-profile-menu': { UserProfileMenu: () => React.createElement('span', { 'data-stub': 'profile' }) },
    '@/components/layout/studio-navigation-hint': { StudioNavigationHint: hint },
    '@/components/ui/button': { Button: 'button' }, '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') },
    '@/hooks/use-auth': { useAuth: () => ({ user: null }) }, '@/lib/last-builder-session': { lastBuilderSessionKey: () => 'last-session' },
    '@/lib/studio-nav-labels': lib,
  }
}
function component(source, fileName, lib, name) {
  const module = { exports: {} }
  const table = stubs(lib)
  vm.runInNewContext(compile(source, fileName), { module, exports: module.exports, process: { env }, require: spec => { if (spec.endsWith('.css')) return {}; if (!(spec in table)) throw new Error(`unexpected import ${spec}`); return table[spec] } })
  return module.exports[name]
}
const setEnv = (values = {}) => { for (const key of Object.keys(env)) delete env[key]; Object.assign(env, values) }
const render = (Component, route, values) => { setEnv(values); pathname.value = route; return renderToStaticMarkup(React.createElement(Component)) }
const ROUTES = ['/builder', '/builder/x', '/dashboard', '/knowledge', '/studio/templates', '/studio/themes', '/studio/intelligence', '/studio/details', '/profile', '/settings']
const OFF_VALUES = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']
const flagEnv = (shell, value) => ({ ...(shell === undefined ? {} : { [SHELL]: shell }), ...(value === undefined ? {} : { [FLAG]: value }) })
const hrefs = html => [...html.matchAll(/href="([^"]*)"/g)].map(m => m[1])
function proveChrome(railSource, headerSource, lib, label = 'chrome') {
  const Rail = component(railSource, RAIL, lib, 'StudioRail'), Header = component(headerSource, HEADER, lib, 'AppHeader')
  const baseRailSource = baseSource(RAIL), baseHeaderSource = baseSource(HEADER)
  const BaseRail = baseRailSource ? component(baseRailSource, RAIL, { studioNavLabels: () => ORIGINAL }, 'StudioRail') : null
  const BaseHeader = baseHeaderSource ? component(baseHeaderSource, HEADER, { studioNavLabels: () => ORIGINAL }, 'AppHeader') : null
  for (const route of ROUTES) {
    for (const value of OFF_VALUES) {
      for (const [name, Component, Base, shell] of [['rail', Rail, BaseRail, 'true'], ['top bar', Header, BaseHeader, 'true'], ['account header', Header, BaseHeader, undefined]]) {
        const off = render(Component, route, flagEnv(shell, value))
        if (Base) eq(off, render(Base, route, flagEnv(shell, undefined)), `${label}: ${name}, flag ${JSON.stringify(value)} on ${route} is the base commit's markup`)
        nomatch(off, /Your decks|Second brain|Outline previews/, `${label}: ${name} flag ${JSON.stringify(value)} says none of the plain words`)
      }
    }
    // rail, on: the two destinations' tooltip and accessible name, nothing else
    const railOff = render(Rail, route, flagEnv('true', undefined)), railOn = render(Rail, route, flagEnv('true', 'true'))
    eq(railOn.split('data-hint="Your decks"').length - 1, 1, `${label}: rail tooltip Your decks (${route})`)
    eq(railOn.split('aria-label="Your decks"').length - 1, 1, `${label}: rail name Your decks (${route})`)
    eq(railOn.split('data-hint="Second brain"').length - 1, 1, `${label}: rail tooltip Second brain (${route})`)
    eq(railOn.split('aria-label="Second brain"').length - 1, 1, `${label}: rail name Second brain (${route})`)
    nomatch(railOn, /data-hint="(?:Decks|Knowledge)"|aria-label="(?:Decks|Knowledge)"/, `${label}: the old words are gone (${route})`)
    eq(railOn.replaceAll('Your decks', 'Decks').replaceAll('Second brain', 'Knowledge'), railOff, `${label}: nothing but those two labels differs (${route})`)
    deepEq(hrefs(railOn), hrefs(railOff), `${label}: every route is the same (${route})`)
    // top bar, on: the title of the two pages; the shell only
    const barOff = render(Header, route, flagEnv('true', undefined)), barOn = render(Header, route, flagEnv('true', 'true'))
    const want = route === '/dashboard' ? 'Your decks' : route === '/knowledge' ? 'Second brain' : null
    if (want) eq(barOn, barOff.replace(route === '/dashboard' ? '>Decks<' : '>Knowledge<', `>${want}<`), `${label}: top bar title on ${route}`)
    else eq(barOn, barOff, `${label}: top bar is untouched on ${route}`)
    // the account header (no Studio shell) keeps its own words, flag on or off
    eq(render(Header, route, flagEnv(undefined, 'true')), render(Header, route, flagEnv(undefined, undefined)), `${label}: the account header ignores the flag (${route})`)
    eq(render(Header, route, flagEnv('false', 'true')), render(Header, route, flagEnv('false', undefined)), `${label}: shell "false" ignores the flag (${route})`)
  }
  eq(render(Header, '/dashboard', flagEnv('true', 'true')).includes('>Your decks<'), true, `${label}: the title is drawn`)
  eq(render(Header, '/knowledge', flagEnv('true', 'true')).includes('>Second brain<'), true, `${label}: the title is drawn`)
}
proveChrome(SOURCES[RAIL], SOURCES[HEADER], loadLib(SOURCES[LIB]))
if (!baseSource(RAIL)) console.log(`  SKIP base-commit chrome identity: ${BASE_COMMIT} is not in this clone`)

// ---------------------------------------------------------------- 3. the Decks page
const DASH_CONST = `  // PASS2B G54 (NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS, default off, Studio shell only): the second tab reads "Outline previews".
  const plainNavLabels = studioShell && process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === "true"
`
const DASH_TAB = '              {plainNavLabels ? <>Outline previews ({strawmanPresentations.length})</> : <>Strawman Previews ({strawmanPresentations.length})</>}\n'
const DASH_TAB_BASE = '              Strawman Previews ({strawmanPresentations.length})\n'
const stripDash = text => text.replace(DASH_CONST, '').replace(DASH_TAB, DASH_TAB_BASE)
function tabComponent(snippet) {
  const source = `module.exports = ({ studioShell, flag, strawmanPresentations }) => {\n  const plainNavLabels = studioShell && flag === 'true'\n  return <span>\n${snippet}</span>\n}\n`
  const module = { exports: {} }
  vm.runInNewContext(compile(source, 'tab.tsx'), { module, exports: module.exports, require: () => jsxRuntime })
  return module.exports
}
function proveDash(page, label = 'dashboard') {
  eq(page.split(DASH_CONST).length - 1, 1, `${label}: the exact-flag, Studio-shell decision, once`)
  eq(page.split(DASH_TAB).length - 1, 1, `${label}: the tab, once`)
  eq((page.match(/process\.env\.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS/g) ?? []).length, 1, `${label}: the flag is read once, inline`)
  eq((page.match(/Strawman Previews \(/g) ?? []).length, 1, `${label}: the original tab words are kept, once`)
  const tabAt = page.indexOf(DASH_TAB), triggerAt = page.lastIndexOf('<TabsTrigger value="strawman">', tabAt)
  ok(triggerAt > 0 && tabAt - triggerAt < 60, `${label}: it is the strawman tab's trigger`)
  const basePage = baseSource(DASH)
  if (basePage) eq(stripDash(page), basePage, `${label}: without the G54 text the page is ${BASE_COMMIT}'s`)
  // the tab's text nodes: off exactly the base's (renderToString keeps the node boundaries), on the plain words
  const Work = tabComponent(DASH_TAB), Base = tabComponent(DASH_TAB_BASE)
  for (const count of [0, 1, 7, 12]) {
    const props = { strawmanPresentations: { length: count } }
    for (const [shell, flag] of [[false, undefined], [false, 'true'], [true, undefined], [true, 'false'], [true, 'TRUE'], [true, '1'], [true, '']]) {
      eq(renderToString(React.createElement(Work, { ...props, studioShell: shell, flag })), renderToString(React.createElement(Base, { ...props, studioShell: shell, flag })), `${label}: tab off (shell ${shell}, flag ${JSON.stringify(flag)}, ${count}) is the base's markup`)
    }
    eq(renderToStaticMarkup(React.createElement(Work, { ...props, studioShell: true, flag: 'true' })), `<span>Outline previews (${count})</span>`, `${label}: tab on (${count})`)
  }
}
proveDash(SOURCES[DASH])

// ---------------------------------------------------------------- 4. mutation check
const MUTANTS = [
  [LIB, 'decks word', "decks: 'Your decks', knowledge", "decks: 'Decks', knowledge"],
  [LIB, 'decks word changed', "decks: 'Your decks'", "decks: 'My decks'"],
  [LIB, 'knowledge word', "knowledge: 'Second brain'", "knowledge: 'Second Brain'"],
  [LIB, 'original decks changed', "decks: 'Decks', knowledge: 'Knowledge'", "decks: 'Your decks', knowledge: 'Knowledge'"],
  [LIB, 'flag read loosely', 'return plain === true ? PLAIN : ORIGINAL', 'return plain ? PLAIN : ORIGINAL'],
  [LIB, 'always plain', 'return plain === true ? PLAIN : ORIGINAL', 'return PLAIN'],
  [LIB, 'never plain', 'return plain === true ? PLAIN : ORIGINAL', 'return ORIGINAL'],
  [LIB, 'inverted', 'return plain === true ? PLAIN : ORIGINAL', 'return plain === true ? ORIGINAL : PLAIN'],
  [LIB, 'a key dropped', "const PLAIN: StudioNavLabels = { decks: 'Your decks', knowledge: 'Second brain' }", "const PLAIN = { decks: 'Your decks' } as StudioNavLabels"],
  [RAIL, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === 'true'", "process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS !== 'false'"],
  [RAIL, 'flag ignored', "studioNavLabels(process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === 'true')", 'studioNavLabels(true)'],
  [RAIL, 'decks tooltip not changed', 'label={navLabels.decks}><Link href="/dashboard"', 'label="Decks"><Link href="/dashboard"'],
  [RAIL, 'decks name not changed', 'aria-label={navLabels.decks}', 'aria-label="Decks"'],
  [RAIL, 'knowledge tooltip not changed', 'label={navLabels.knowledge}><Link href="/knowledge"', 'label="Knowledge"><Link href="/knowledge"'],
  [RAIL, 'knowledge name not changed', 'aria-label={navLabels.knowledge}', 'aria-label="Knowledge"'],
  [RAIL, 'labels swapped', 'label={navLabels.decks}><Link href="/dashboard" aria-label={navLabels.decks}', 'label={navLabels.knowledge}><Link href="/dashboard" aria-label={navLabels.knowledge}'],
  [RAIL, 'decks route changed', '<Link href="/dashboard" aria-label={navLabels.decks}', '<Link href="/decks" aria-label={navLabels.decks}'],
  [RAIL, 'knowledge route changed', '<Link href="/knowledge" aria-label={navLabels.knowledge}', '<Link href="/second-brain" aria-label={navLabels.knowledge}'],
  [RAIL, 'another label changed', "{label:'Templates',href:'/studio/templates',Icon:LayoutTemplate}", "{label:'My templates',href:'/studio/templates',Icon:LayoutTemplate}"],
  [RAIL, 'intelligence relabelled', '<StudioNavigationHint enabled label="Intelligence">', '<StudioNavigationHint enabled label="Models">'],
  [HEADER, 'flag read loosely', 'studioNavLabels(process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === "true")', 'studioNavLabels(process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS !== "false")'],
  [HEADER, 'flag ignored', 'studioNavLabels(process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === "true")', 'studioNavLabels(true)'],
  [HEADER, 'decks title not changed', 'pathname === "/dashboard" ? navLabels.decks :', 'pathname === "/dashboard" ? "Decks" :'],
  [HEADER, 'knowledge title not changed', 'pathname === "/knowledge" ? navLabels.knowledge :', 'pathname === "/knowledge" ? "Knowledge" :'],
  [HEADER, 'titles swapped', 'pathname === "/dashboard" ? navLabels.decks : pathname === "/knowledge" ? navLabels.knowledge :', 'pathname === "/dashboard" ? navLabels.knowledge : pathname === "/knowledge" ? navLabels.decks :'],
  [HEADER, 'account header relabelled', '{ href: "/knowledge", label: "Knowledge", icon: Brain }', '{ href: "/knowledge", label: navLabels.knowledge, icon: Brain }'],
  [HEADER, 'account decks relabelled', '{ href: "/dashboard", label: "Decks", icon: LayoutDashboard }', '{ href: "/dashboard", label: navLabels.decks, icon: LayoutDashboard }'],
  [HEADER, 'another title changed', 'pathname === "/studio/templates" ? "Templates"', 'pathname === "/studio/templates" ? "Your templates"'],
  [DASH, 'flag read loosely', 'process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === "true"', 'process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS !== "false"'],
  [DASH, 'outside the Studio shell', 'const plainNavLabels = studioShell && process', 'const plainNavLabels = process'],
  [DASH, 'flag ignored', 'const plainNavLabels = studioShell && process.env.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === "true"', 'const plainNavLabels = studioShell'],
  [DASH, 'always plain', '{plainNavLabels ? <>Outline previews', '{true ? <>Outline previews'],
  [DASH, 'never plain', '{plainNavLabels ? <>Outline previews', '{false ? <>Outline previews'],
  [DASH, 'count dropped', '<>Outline previews ({strawmanPresentations.length})</>', '<>Outline previews</>'],
  [DASH, 'wrong count', '<>Outline previews ({strawmanPresentations.length})</>', '<>Outline previews ({completedPresentations.length})</>'],
  [DASH, 'word changed', '<>Outline previews (', '<>Outline preview ('],
  [DASH, 'word capitalised', '<>Outline previews (', '<>Outline Previews ('],
  [DASH, 'original tab changed', ': <>Strawman Previews ({strawmanPresentations.length})</>}', ': <>Outline previews ({strawmanPresentations.length})</>}'],
  [DASH, 'original tab flattened', ': <>Strawman Previews ({strawmanPresentations.length})</>}', ': `Strawman Previews (${strawmanPresentations.length})`}'],
  [DASH, 'the completed tab changed', 'Completed Presentations ({completedPresentations.length})', 'Completed ({completedPresentations.length})'],
  [DASH, 'stat tile changed', "{studioShell ? 'Outline previews' : 'AI Collaborations'}", "{studioShell ? 'Strawman previews' : 'AI Collaborations'}"],
]
let killed = 0
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    const lib = file === LIB ? loadLib(mutated) : loadLib(SOURCES[LIB])
    if (file === LIB) { proveLib(lib, name); proveChrome(SOURCES[RAIL], SOURCES[HEADER], lib, name) }
    if (file === RAIL) proveChrome(mutated, SOURCES[HEADER], lib, name)
    if (file === HEADER) proveChrome(SOURCES[RAIL], mutated, lib, name)
    if (file === DASH) proveDash(mutated, name)
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

// ---------------------------------------------------------------- .env.example
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS="false"$/m, 'documented in .env.example, default off')

console.log(`Studio plain nav labels (G43 rail and top bar, G54 tab): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
