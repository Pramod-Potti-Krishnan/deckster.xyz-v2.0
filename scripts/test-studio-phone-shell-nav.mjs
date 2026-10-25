// FRONTEND-2 (PK's phone review, 25 Oct, decision A): proof for "Phone shell 1", the bottom tab bar on phones. Flag NEXT_PUBLIC_STUDIO_PHONE_SHELL (exact "true", default off, build-time; it also needs
// NEXT_PUBLIC_STUDIO_V4_SHELL). PK chose: a bottom tab bar on phones only (640 px and narrower) with Studio, Decks, Templates, Themes and More; More holds Second brain, Intelligence and the rest. Tablets and
// desktops keep the rail. The rail, its brand tile and the account header are not edited (FRONTEND-1's test-studio-p2-details holds them byte for byte): the account layout and the Builder draw the bar next to
// the rail, and the bar's stylesheet restyles the rail on a phone (only its brand tile is left, at the top left of the top bar).
// Run: node scripts/test-studio-phone-shell-nav.mjs   (plain node: TypeScript transpile, react-dom/server, postcss, `git show` for the base commit; no network, no browser, no model call)
//
//   1. lib         the flag (exact "true" with the shell, read once), the active tab of every route, the tabs' and More's routes and words are the rail's (read from the rail, not copied)
//   2. stylesheet  one rule outside the phone query (the bar hidden); every other rule inside (max-width: 640px); every selector needs the bar or the More sheet (elements that exist only with the flag);
//                  the root rules need a root that holds the bar; safe area, bottom padding, 44 x 48 px targets, the accent on the current tab, the bar and its padding gone while the prompt has focus; no !important
//   3. render      the bar on every route (react-dom/server): 4 tabs + More in PK's order, each with a name, the current one marked; the More sheet: a titled modal dialog with Second brain, Intelligence,
//                  Your details, Help and the account menu; the Radix defaults are kept (focus in, Escape and a tap outside close it, focus back to More); the Studio entry, the composer focus and the
//                  sheet's close on navigation, run with the component's own handlers
//   4. pin         the Builder page and the account layout without this change's marked lines are the base commit's files byte for byte, also through the registry; three marked lines each, in place
//   5. flag off    the account layout renders the base commit's HTML in every state with the flag off (sha256); with it on, the bar is the only difference; the Builder's lines are all gated on the constant
//   6. change      the strip (whole-token marker; the taught proofs put back), the registry (three lines), the .env.example block (appended, default "false"), the taught proofs (FRONTEND-2's own; no FRONTEND-1
//                  test), scope (the COMMITTED diff only), no secret
//   7. mutants     each one must make sections 1-6 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'
import {
  BASE_COMMIT, PHONE_SHELL_NAV_BUILDER, PHONE_SHELL_NAV_COMMIT_SUBJECT, PHONE_SHELL_NAV_ENV_BLOCK, PHONE_SHELL_NAV_FILES, PHONE_SHELL_NAV_LAYOUT, PHONE_SHELL_NAV_MARKER_RE, PHONE_SHELL_NAV_NEW_FILES,
  PHONE_SHELL_NAV_OWN_EDITS, PHONE_SHELL_NAV_PIN_EDITS, PHONE_SHELL_NAV_PIN_FILES, PHONE_SHELL_NAV_PIN_MARK, PHONE_SHELL_NAV_SCOPE_FILES, putBackPin, stripPhoneShellNav,
} from './studio-phone-shell-nav-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'
import { stripPass3PolishF } from './studio-pass3-polish-f-strip.mjs' // STACK: the last registry entry the base commit has (see read)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const h = React.createElement
const BASE = process.env.PHONE_SHELL_NAV_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
// This change's OWN committed files: the non-merge commits in BASE..HEAD whose subject is "Phone shell 1: ...". The working tree is never consulted.
const ownCommitted = () => {
  const files = new Set()
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [subject, ...names] = block.split('\n')
    if (PHONE_SHELL_NAV_COMMIT_SUBJECT.test(subject)) for (const name of names) if (name) files.add(name)
  }
  return [...files]
}
let overrides = {} // in-memory mutations: every proof reads its sources through read()
// A change registered after this one (PR 2, "Phone shell 2", and any later one) comes out first, so every check below sees this change's tree whatever is stacked on it.
// STACK: and the changes registered between the base commit's last entry (Pass 3 polish F) and this one (D1, Pass 3 polish G) are in the tree but not in the base commit's files either, so they come out too: every check below sees the base commit plus this change.
const read = rel => (rel in overrides ? overrides[rel] : LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripPass3PolishF) + 1).filter(strip => strip !== stripPhoneShellNav).reduce((out, strip) => strip(rel, out), fs.readFileSync(path.join(root, rel), 'utf8')))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const marked = line => PHONE_SHELL_NAV_MARKER_RE.test(line)
// What this change's own checks read: the file with every OTHER registered change's lines out (innermost, as every older pin reads it) and THIS change's own left in.
const withoutOthers = (rel, text) => {
  const si = LATER_STRIPS.indexOf(stripPhoneShellNav)
  const mine = si >= 0 ? LATER_STRIPS.splice(si, 1)[0] : null
  try { return stripLaterChanges(rel, text) } finally { if (mine) LATER_STRIPS.splice(si, 0, mine) }
}

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm carry its realm's prototypes
const eq = count(assert.equal), deep = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message)), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const LIB = 'lib/studio-phone-shell.ts', BAR = 'components/layout/studio-phone-tab-bar.tsx', CSS = 'components/layout/studio-phone-shell.css'
const PAGE = PHONE_SHELL_NAV_BUILDER, LAYOUT = PHONE_SHELL_NAV_LAYOUT, ENV = '.env.example'
const RAIL = 'components/layout/studio-rail.tsx', HEADER = 'components/layout/app-header.tsx', PROFILE = 'components/user-profile-menu.tsx', SHELL_CSS = 'components/layout/studio-shell.css'
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-phone-shell-nav-strip.mjs', THIS_TEST = 'scripts/test-studio-phone-shell-nav.mjs'
const FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_SHELL', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const BARSEL = '[data-studio-phone-tabbar="true"]', ROOTSEL = `[data-studio-v4-shell="true"]:has(> ${BARSEL})`, PHONE = '(max-width: 640px)'
const SPELLINGS = [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'true']

// ---------------------------------------------------------------- module loader (TypeScript transpiled, run in a vm with the given stubs; real files for the lib modules this change reads)
const compileCache = new Map()
function compile(rel, text) {
  const id = `${rel}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const REAL_LIBS = { '@/lib/studio-phone-shell': LIB, '@/lib/studio-nav-labels': 'lib/studio-nav-labels.ts', '@/lib/last-builder-session': 'lib/last-builder-session.ts' }
function load(rel, { env = {}, stubs = {}, globals = {}, text = read(rel) } = {}) {
  const module = { exports: {} }
  const req = spec => {
    if (Object.prototype.hasOwnProperty.call(stubs, spec)) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec in REAL_LIBS) return load(REAL_LIBS[spec], { env, globals })
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, text), { module, exports: module.exports, require: req, process: { env }, ...globals }, { filename: rel })
  return module.exports
}

// ---------------------------------------------------------------- 1. lib
function proveLib(at = '') {
  const a = message => (at ? `${at}: lib: ${message}` : `lib: ${message}`)
  const lib = env => load(LIB, { env })
  for (const flag of SPELLINGS) for (const shell of SPELLINGS) {
    const env = { ...(flag === undefined ? {} : { [FLAG]: flag }), ...(shell === undefined ? {} : { [SHELL]: shell }) }
    eq(lib(env).STUDIO_PHONE_SHELL_ENABLED, flag === 'true' && shell === 'true', a(`on only for the exact value "true" with the shell (${JSON.stringify(env)})`))
  }
  const text = read(LIB)
  match(text, /export const STUDIO_PHONE_SHELL_ENABLED = studioPhoneShellOn\(process\.env\.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL\)/, a('the two values are read inline (Next inlines NEXT_PUBLIC_ values at build time)'))
  eq((text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').match(/process\.env/g) || []).length, 2, a('the environment is read twice: the flag and the shell, nowhere else'))
  const { studioPhoneActiveTab, STUDIO_PHONE_TABS, STUDIO_PHONE_MORE_LINKS, STUDIO_PHONE_COMPOSER_SELECTOR } = lib({})
  const want = { '/builder': 'studio', '/builder/x': 'studio', '/builderx': 'more', '/dashboard': 'decks', '/dashboard/x': 'more', '/studio/templates': 'templates', '/studio/themes': 'themes', '/knowledge': 'more', '/studio/intelligence': 'more', '/studio/details': 'more', '/profile': 'more', '/settings': 'more', '/billing': 'more', '': 'more' }
  for (const [route, tab] of Object.entries(want)) eq(studioPhoneActiveTab(route), tab, a(`${JSON.stringify(route)} highlights ${tab}`))
  eq(studioPhoneActiveTab(null), 'more', a('no route: More'))
  deep(STUDIO_PHONE_TABS.map(t => t.tab), ['studio', 'decks', 'templates', 'themes'], a('the four tabs PK chose, in his order'))
  // the rail's own routes and words, read from the rail (it is not edited)
  const rail = read(RAIL)
  for (const { tab, href } of STUDIO_PHONE_TABS) ok(tab === 'studio' ? /href="\/builder"/.test(rail) : rail.includes(`'${href}'`) || rail.includes(`"${href}"`), a(`${tab}: ${href} is the rail's route`))
  deep(STUDIO_PHONE_MORE_LINKS.map(l => l.key), ['knowledge', 'intelligence', 'details', 'help'], a('More: Second brain, Intelligence, Your details, then Help'))
  for (const { key, label, href } of STUDIO_PHONE_MORE_LINKS.filter(l => l.key !== 'help')) {
    ok(rail.includes(`<Link href="${href}"`), a(`More: ${key}: ${href} is the rail's route`))
    if (label !== null) ok(rail.includes(`label="${label}"`) && rail.includes(`aria-label="${label}"`), a(`More: ${key}: "${label}" is the rail's word`))
  }
  eq(STUDIO_PHONE_MORE_LINKS[0].label, null, a('More: Second brain takes the rail\'s label (studioNavLabels), not a copy'))
  match(rail, /navLabels\.knowledge/, a('(the rail names it through studioNavLabels)'))
  const help = STUDIO_PHONE_MORE_LINKS.find(l => l.key === 'help')
  ok(read(PROFILE).includes(`handleNavigation("${help.href}")`) && read(PROFILE).includes('<span>Help</span>'), a('More: Help is the account menu\'s Help: its route and its word'))
  // every rail destination has a home: the four tabs, More, and the brand tile (left in place)
  const railHrefs = [...rail.matchAll(/href[=:]\{?['"]([^'"]+)['"]/g)].map(m => m[1]).filter(href => href.startsWith('/'))
  const homes = new Set([...STUDIO_PHONE_TABS.map(t => t.href), ...STUDIO_PHONE_MORE_LINKS.map(l => l.href)])
  deep(railHrefs.filter(href => !homes.has(href)), [], a(`every route of the rail is a tab or a More link (${railHrefs.join(', ')})`))
  match(rail, /<UserProfileMenu sessionUsage=\{sessionUsage\} studioLabels studioPalette=\{process\.env\.NEXT_PUBLIC_STUDIO_V4_TOKENS === 'true'\} \/>/, a('the rail\'s account menu: the sheet draws the same component with the same props'))
  eq(STUDIO_PHONE_COMPOSER_SELECTOR, '[data-studio-composer-prompt="true"] textarea', a('the composer: the Director prompt\'s textarea'))
  ok(read('components/builder/chat-input.tsx').includes("'data-studio-composer-prompt': 'true'"), a('(the prompt region carries that attribute in the Studio shell)'))
}

// ---------------------------------------------------------------- 2. the stylesheet
const splitTop = selector => {
  const parts = []; let depth = 0, quote = '', start = 0
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i]
    if (quote) { if (c === quote) quote = ''; continue }
    if (c === '"' || c === "'") quote = c
    else if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) { parts.push(selector.slice(start, i).trim()); start = i + 1 }
  }
  parts.push(selector.slice(start).trim())
  return parts
}
function cssRules(text) {
  const out = []
  postcss.parse(text).walkRules(rule => {
    const media = rule.parent?.type === 'atrule' ? `${rule.parent.name} ${rule.parent.params}` : null
    const nestedMedia = rule.parent?.type === 'atrule' && rule.parent.parent?.type !== 'root'
    out.push({ selector: rule.selector, selectors: splitTop(rule.selector), media, nestedMedia, decls: Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(d => [d.prop, d.value + (d.important ? ' !important' : '')])) })
  })
  return out
}
function proveCss(text, at = '') {
  const a = message => (at ? `${at}: stylesheet: ${message}` : `stylesheet: ${message}`)
  const rules = cssRules(text)
  nomatch(text, /!important/, a('no !important'))
  const outside = rules.filter(r => r.media === null)
  deep(outside.map(r => [r.selector, r.decls]), [[BARSEL, { display: 'none' }]], a('exactly one rule outside the phone query: the bar is hidden at every other width'))
  ok(rules.filter(r => r.media !== null).every(r => r.media === `media ${PHONE}` && !r.nestedMedia), a('every other rule is inside @media (max-width: 640px), one level deep'))
  const atRules = []; postcss.parse(text).walkAtRules(r => atRules.push(`${r.name} ${r.params}`))
  deep(atRules, [`media ${PHONE}`], a('one at-rule: the phone query'))
  for (const r of rules) for (const s of r.selectors) {
    ok(s.includes(BARSEL) || s.startsWith('[data-studio-phone-more="true"]') || s.startsWith('[data-studio-v4-shell="true"][data-studio-phone-more="true"]') || s === '[data-studio-phone-more-overlay="true"]',
      a(`${s}: needs the bar or the More sheet, which exist only with the flag`))
    if (/\[data-studio-v4-rail\]|\[data-studio-v4-shell-(column|header|workspace)\]/.test(s)) ok(s.startsWith(`${ROOTSEL} > `), a(`${s}: the rail, the top bar and the workspace are restyled only under a root that holds the bar`))
    nomatch(s, /\[data-studio-(settings|billing|publish|p2-admin|help)/, a(`${s}: no FRONTEND-1 area`))
  }
  const rule = sel => rules.find(r => r.selectors.includes(sel))?.decls ?? {}
  const rootDecls = rule(ROOTSEL)
  eq(rootDecls['padding-bottom'], 'calc(56px + env(safe-area-inset-bottom, 0px))', a('the page gets the bar\'s height and the safe area as bottom padding'))
  eq(rootDecls['--ss-rail-width'], '0px', a('the rail\'s width is 0 (the Sessions drawer starts at the edge)'))
  eq(rule(`[data-studio-v4-shell="true"]:has(> ${BARSEL}[data-composer-focus="true"])`)['padding-bottom'], '0', a('while the prompt has focus the padding goes'))
  const bar = rule(`[data-studio-v4-shell="true"] > ${BARSEL}`)
  deep([bar.position, bar.bottom, bar.left, bar.right, bar.display], ['fixed', '0', '0', '0', 'flex'], a('the bar is fixed to the bottom edge, full width'))
  eq(bar.height, 'calc(56px + env(safe-area-inset-bottom, 0px))', a('its height takes the safe area'))
  match(bar.padding, /env\(safe-area-inset-bottom, 0px\)$/, a('and its bottom padding is the safe area'))
  eq(rule(`[data-studio-v4-shell="true"] > ${BARSEL}[data-composer-focus="true"]`).display, 'none', a('the bar steps aside while the prompt has focus'))
  const tab = rule(`[data-studio-v4-shell="true"] > ${BARSEL} > :is(a, button)`)
  ok(parseFloat(tab['min-width']) >= 44 && parseFloat(tab['min-height']) >= 32, a(`every tab is at least 44 x 32 px (${tab['min-width']} x ${tab['min-height']})`))
  eq(rule(`[data-studio-v4-shell="true"] > ${BARSEL} > [aria-current="page"]`).color, 'var(--ss-accent)', a('the current tab is drawn in the accent'))
  const railRule = rule(`${ROOTSEL} > [data-studio-v4-rail]`)
  deep([railRule.position, railRule.top, railRule.left, railRule.height], ['absolute', '0', '0', '48px'], a('the rail leaves the flow and sits over the top left of the 48 px top bar'))
  eq(rule(`${ROOTSEL} > [data-studio-v4-rail] > :is(nav, .studio-rail-profile)`).display, 'none', a('its destinations and account menu step aside (they are in the bar and in More)'))
  ok(!rules.some(r => r.selectors.some(s => /\.studio-rail-brand(?!::after)/.test(s))), a('the brand tile itself is not restyled (the new logo or today\'s tile, as the rail draws it)'))
  match(read(SHELL_CSS), /\[data-studio-v4-shell-header\] \{\n\s+height: 48px; min-height: 48px;/, a('(the top bar is 48 px tall)'))
  eq(rule(`${ROOTSEL} > [data-studio-v4-shell-column] > [data-studio-v4-shell-header] > div`)['padding-left'], '52px', a('the top bar\'s content starts after the tile'))
}

// ---------------------------------------------------------------- 3. the bar and the sheet, rendered
const ICON = name => props => h('svg', { 'data-icon': name, 'aria-hidden': props['aria-hidden'] })
const lucide = new Proxy({ __esModule: true }, { get: (t, name) => (name === '__esModule' ? true : ICON(String(name))) })
function barStubs(state, reactStub = React) {
  const dialog = {
    __esModule: true,
    Root: props => { state.root.push(props); return h(React.Fragment, null, props.children) },
    Trigger: props => { state.trigger.push(props); return React.cloneElement(props.children, { 'data-dialog-trigger': 'true' }) },
    Portal: props => h('div', { 'data-portal': 'true' }, props.children),
    Overlay: props => h('div', { ...props, 'data-overlay': 'true' }),
    Content: props => { state.content.push(props); const { children, ...rest } = props; return h('div', { role: 'dialog', 'aria-modal': 'true', ...rest }, children) },
    Title: props => { const { children, ...rest } = props; return h('h2', rest, children) },
  }
  return {
    react: reactStub,
    'next/link': { __esModule: true, default: ({ href, children, ...rest }) => h('a', { href, ...rest }, children) },
    'next/navigation': { usePathname: () => state.pathname, useRouter: () => ({ push: target => state.pushed.push(target) }) },
    '@radix-ui/react-dialog': dialog,
    'lucide-react': lucide,
    '@/components/user-profile-menu': { UserProfileMenu: props => { state.profile.push(props); return h('button', { type: 'button', 'data-profile-stub': 'true', 'aria-label': 'Open account menu' }) } },
    '@/hooks/use-auth': { useAuth: () => ({ user: state.user }) },
  }
}
const newState = pathname => ({ pathname, pushed: [], root: [], trigger: [], content: [], profile: [], user: { id: 'u-1', email: 'u@example.test' } })
const attrs = (html, tag, attr) => [...html.matchAll(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`, 'g'))].map(m => m[0])
function renderBar(pathname, env = { [FLAG]: 'true', [SHELL]: 'true' }, props = {}) {
  const state = newState(pathname)
  const { StudioPhoneTabBar } = load(BAR, { env, stubs: barStubs(state) })
  return { html: renderToStaticMarkup(h(StudioPhoneTabBar, props)), state }
}
function proveRender(at = '') {
  const a = message => (at ? `${at}: render: ${message}` : `render: ${message}`)
  const routes = { '/builder': 'studio', '/dashboard': 'decks', '/studio/templates': 'templates', '/studio/themes': 'themes', '/knowledge': 'more', '/studio/intelligence': 'more', '/studio/details': 'more', '/settings': 'more' }
  for (const [route, current] of Object.entries(routes)) {
    const usage = h('i', { 'data-usage': 'true' })
    const { html, state } = renderBar(route, undefined, { sessionUsage: usage })
    const nav = html.slice(0, html.indexOf('<div data-portal'))
    match(nav, /^<nav data-studio-phone-tabbar="true" aria-label="Studio destinations">/, a(`${route}: the bar is a named navigation landmark, the composer not focused`))
    const tabs = [...nav.matchAll(/<(a|button)\b[^>]*data-studio-phone-tab="([a-z]+)"[^>]*>(.*?)<\/\1>/g)].map(m => ({ tag: m[1], tab: m[2], el: m[0], text: m[3].replace(/<[^>]+>/g, '') }))
    deep(tabs.map(t => t.tab), ['studio', 'decks', 'templates', 'themes', 'more'], a(`${route}: four tabs and More, in PK's order`))
    deep(tabs.map(t => t.text), ['Studio', 'Decks', 'Templates', 'Themes', 'More'], a(`${route}: each has its word on screen`))
    ok(tabs.every(t => t.text.trim() !== '' && /<svg data-icon="[A-Za-z]+" aria-hidden="true">/.test(t.el)), a(`${route}: each has a visible name; the icon is hidden from assistive tech`))
    eq(/aria-label="Themes &amp; brand"/.test(tabs[3].el), true, a(`${route}: Themes keeps the rail's name, "Themes & brand" (it contains the visible word)`))
    deep(tabs.filter(t => /aria-current="page"/.test(t.el)).map(t => t.tab), [current], a(`${route}: ${current} is the current tab, and only it`))
    deep(tabs.map(t => (t.tag === 'a' ? t.el.match(/href="([^"]+)"/)[1] : null)), [null, '/dashboard', '/studio/templates', '/studio/themes', null], a(`${route}: the tabs' routes`))
    ok(/^<button type="button" data-studio-phone-tab="studio"/.test(tabs[0].el) && /^<button type="button" data-studio-phone-tab="more"/.test(tabs[4].el), a(`${route}: Studio and More are buttons`))
    ok(/data-dialog-trigger="true"/.test(tabs[4].el), a(`${route}: More is the sheet's trigger (focus comes back to it when the sheet closes)`))
    eq(state.root.length, 1, a(`${route}: one sheet`))
    eq(state.root[0].open, false, a(`${route}: closed at first`))
    eq(typeof state.root[0].onOpenChange, 'function', a(`${route}: its open state follows the dialog (Escape, a tap outside, the trigger)`))
    ok(!('modal' in state.root[0]), a(`${route}: modal (the Radix default): focus is trapped inside, the page behind is inert`))
    eq(state.trigger[0].asChild, true, a(`${route}: the trigger is the More button itself`))
    const content = state.content[0]
    for (const prop of ['onEscapeKeyDown', 'onPointerDownOutside', 'onInteractOutside', 'onOpenAutoFocus', 'onCloseAutoFocus', 'forceMount']) ok(!(prop in content), a(`${route}: the sheet keeps Radix's ${prop} (no override)`))
    const sheet = html.slice(html.indexOf('<div data-portal'))
    match(sheet, /<div role="dialog" aria-modal="true" data-studio-v4-shell="true" data-studio-phone-more="true">/, a(`${route}: the sheet is a dialog with the Studio tokens and its own marker`))
    match(sheet, /<h2 data-studio-phone-more-title="true">More<\/h2>/, a(`${route}: titled "More"`))
    const links = [...sheet.matchAll(/<a href="([^"]+)" data-studio-phone-more-link="([a-z]+)"([^>]*)>(.*?)<\/a>/g)].map(m => ({ href: m[1], key: m[2], rest: m[3], text: m[4].replace(/<[^>]+>/g, '') }))
    deep(links.map(l => [l.key, l.href, l.text]), [['knowledge', '/knowledge', 'Knowledge'], ['intelligence', '/studio/intelligence', 'Intelligence'], ['details', '/studio/details', 'Your details'], ['help', '/help', 'Help']], a(`${route}: More: Second brain (the rail's word), Intelligence, Your details, Help`))
    deep(links.filter(l => /aria-current="page"/.test(l.rest)).map(l => l.href), Object.keys(routes).includes(route) && links.some(l => l.href === route) ? [route] : [], a(`${route}: the current More destination is marked`))
    match(sheet, /<li data-studio-phone-more-account="true"><button type="button" data-profile-stub="true" aria-label="Open account menu"><\/button><span aria-hidden="true">Account<\/span><\/li><\/ul>/, a(`${route}: the account menu is the sheet's last row`))
    eq(state.profile.length, 1, a(`${route}: one account menu in the sheet`))
    eq(state.profile[0].sessionUsage, usage, a(`${route}: it gets the session usage the host passes (the Builder's counter, as the rail's)`))
    deep([state.profile[0].studioLabels, state.profile[0].studioPalette], [true, false], a(`${route}: and the rail's props (labels on; the palette with NEXT_PUBLIC_STUDIO_V4_TOKENS)`))
  }
  // the plain words (NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS) reach the bar and the sheet, as the rail
  const plain = renderBar('/dashboard', { [FLAG]: 'true', [SHELL]: 'true', NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS: 'true', NEXT_PUBLIC_STUDIO_V4_TOKENS: 'true' })
  ok(plain.html.includes('<span>Your decks</span>') && plain.html.includes('<span>Second brain</span>'), a('plain words: "Your decks" and "Second brain"'))
  eq(plain.state.profile[0].studioPalette, true, a('the palette follows NEXT_PUBLIC_STUDIO_V4_TOKENS'))

  // the component's own handlers, run with hooks recorded (no renderer)
  const run = (pathname, storage, given = []) => {
    const state = newState(pathname), effects = [], sets = []
    const reactStub = { ...React, useState: initial => { const i = sets.length; sets.push([]); return [given[i] ?? initial, value => sets[i].push(value)] }, useEffect: fn => { effects.push(fn) } }
    const listeners = {}
    class FakeElement { constructor(composer) { this.composer = composer } matches(selector) { return this.composer && selector === '[data-studio-composer-prompt="true"] textarea' } }
    const globals = {
      Element: FakeElement,
      document: { addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn) }, removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter(f => f !== fn) } },
      window: { localStorage: { getItem: key => { state.read = key; if (storage === 'throws') throw new Error('private mode'); return storage ?? null } } },
    }
    const { StudioPhoneTabBar } = load(BAR, { env: { [FLAG]: 'true', [SHELL]: 'true' }, stubs: barStubs(state, reactStub), globals })
    const tree = StudioPhoneTabBar({})
    return { state, effects, sets, listeners, tree, FakeElement }
  }
  // Studio on an account page: the last Builder deck of this account, else a fresh Builder (BackToBuilderButton's rule)
  for (const [storage, target] of [['s-42', '/builder?session_id=s-42'], [null, '/builder'], ['throws', '/builder']]) {
    const r = run('/dashboard', storage)
    const studio = r.tree.props.children[0]
    eq(studio.props['data-studio-phone-tab'], 'studio', a('the first child is Studio'))
    studio.props.onClick()
    deep(r.state.pushed, [target], a(`Studio from Decks with ${JSON.stringify(storage)} stored opens ${target}`))
    eq(r.state.read, 'deckster:last_session_id:u-1', a('the key is the account\'s last-session key'))
  }
  const inBuilder = run('/builder')
  eq(inBuilder.tree.props.children[0].props.onClick, undefined, a('in the Builder, Studio is the current page: no handler (as the rail)'))
  eq(inBuilder.tree.props.children[0].props['aria-current'], 'page', a('and it is marked current'))
  // the effects: the sheet closes with the old page; the composer focus hides the bar and blur brings it back
  eq(inBuilder.effects.length, 2, a('two effects'))
  inBuilder.effects[0]()
  deep(inBuilder.sets[0], [false], a('a new route closes the sheet'))
  const cleanup = inBuilder.effects[1]()
  deep(Object.keys(inBuilder.listeners).sort(), ['focusin', 'focusout'], a('the bar listens to focus moving on the document'))
  const composer = new inBuilder.FakeElement(true), other = new inBuilder.FakeElement(false)
  inBuilder.listeners.focusin[0]({ target: composer })
  inBuilder.listeners.focusout[0]({ target: composer, relatedTarget: other })
  inBuilder.listeners.focusin[0]({ target: other })
  inBuilder.listeners.focusin[0]({ target: composer })
  inBuilder.listeners.focusout[0]({ target: composer, relatedTarget: null })
  inBuilder.listeners.focusin[0]({ target: composer })
  inBuilder.listeners.focusout[0]({ target: composer, relatedTarget: composer })
  deep(inBuilder.sets[1], [true, false, false, true, false, true], a('focus in the prompt hides the bar; leaving it (to another control or to nothing) brings it back; a refocus of the prompt keeps it hidden'))
  cleanup()
  deep([inBuilder.listeners.focusin.length, inBuilder.listeners.focusout.length], [0, 0], a('the listeners go with the bar'))
  eq(inBuilder.tree.props['data-composer-focus'], undefined, a('the prompt not focused: the bar carries no composer mark'))
  eq(run('/builder', null, [false, true]).tree.props['data-composer-focus'], 'true', a('the prompt focused: the bar is marked, which the stylesheet hides it by'))
  eq(run('/builder', null, [true, false]).tree.props.children[4].props.open, true, a('an open sheet is the state the dialog is given'))
  const more = inBuilder.tree.props.children[4]
  eq(more.props.open, false, a('the sheet\'s open state is the component\'s'))
  more.props.onOpenChange(true)
  deep(inBuilder.sets[0], [false, true], a('the trigger opens it through the same state'))
  // the More links close the sheet when tapped
  const sheetLinks = []
  const walk = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) { node.forEach(walk); return } if (node.props?.['data-studio-phone-more-link']) sheetLinks.push(node); walk(node.props?.children) }
  walk(more)
  eq(sheetLinks.length, 4, a('four links in the sheet'))
  ok(sheetLinks.every(link => typeof link.props.onClick === 'function'), a('each has a click handler'))
  for (const link of sheetLinks) link.props.onClick()
  deep(inBuilder.sets[0], [false, true, false, false, false, false], a('each link closes the sheet'))
  // Radix itself (the installed version): modal content traps focus, Escape and a tap outside close it, and focus goes back to the trigger
  const radix = fs.readFileSync(fs.realpathSync(path.join(path.dirname(nodeRequire.resolve('@radix-ui/react-dialog', { paths: [path.join(root, 'components')] })), 'index.mjs')), 'utf8')
  ok(/modal = true/.test(radix) && /context\.triggerRef\.current\?\.focus\(\)/.test(radix) && /trapped: trapFocus/.test(radix) && /DismissableLayer/.test(radix) && /onDismiss: \(\) => context\.onOpenChange\(false\)/.test(radix) && /onPointerDownOutside/.test(radix), a('the installed @radix-ui/react-dialog: modal by default, focus trapped, its dismissable layer (Escape, a tap outside) closes it, focus back to the trigger'))
}

// ---------------------------------------------------------------- 4. the pin (the Builder page and the account layout)
const LINE_RE = {
  [PAGE]: [
    /^import \{ StudioPhoneTabBar \} from '@\/components\/layout\/studio-phone-tab-bar' \/\/ PHONE-SHELL-NAV \(NEXT_PUBLIC_STUDIO_PHONE_SHELL, default off\): /,
    /^import \{ STUDIO_PHONE_SHELL_ENABLED \} from '@\/lib\/studio-phone-shell' \/\/ PHONE-SHELL-NAV$/,
    /^ {6}\{STUDIO_PHONE_SHELL_ENABLED && <StudioPhoneTabBar sessionUsage=\{<TokenUsageStrip tokenUsage=\{tokenUsage\} displayMode="counter" \/>\} \/>\}\{\/\* PHONE-SHELL-NAV: [^*]+\*\/\}$/,
  ],
  [LAYOUT]: [
    /^import \{ StudioPhoneTabBar \} from "@\/components\/layout\/studio-phone-tab-bar" \/\/ PHONE-SHELL-NAV \(NEXT_PUBLIC_STUDIO_PHONE_SHELL, default off\): /,
    /^import \{ STUDIO_PHONE_SHELL_ENABLED \} from "@\/lib\/studio-phone-shell" \/\/ PHONE-SHELL-NAV$/,
    /^ {6}\{STUDIO_PHONE_SHELL_ENABLED && <StudioPhoneTabBar \/>\}\{\/\* PHONE-SHELL-NAV: [^*]+\*\/\}$/,
  ],
}
const AFTER = {
  [PAGE]: ["import { StudioRail } from '@/components/layout/studio-rail'", '      {studioShell && <StudioRail homeHref="https://deckster.xyz" sessionUsage={<TokenUsageStrip tokenUsage={tokenUsage} displayMode="counter" />} />}'],
  [LAYOUT]: ['import "@/components/layout/studio-shell.css"', '      {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" && <StudioRail studioEntry={<BackToBuilderButton rail />} />}'],
}
function provePin(rel, text, stripFn = stripPhoneShellNav, at = '') {
  const a = message => (at ? `${at}: ${rel}: ${message}` : `${rel}: ${message}`)
  const base = withoutOthers(rel, baseOf(rel)), own = withoutOthers(rel, text)
  eq(sha(stripFn(rel, own)), sha(base), a('without this change\'s lines it is the base commit\'s file, byte for byte'))
  eq(sha(stripFn(rel, text)), sha(baseOf(rel)), a('and the file as it is (every stacked change\'s lines in it) without this change\'s lines is the base commit\'s file as it is'))
  eq(sha(stripLaterChanges(rel, text)), sha(stripLaterChanges(rel, baseOf(rel))), a('and through the registry (innermost, as every older pin reads it) it is the base commit\'s file'))
  const lines = text.split('\n'), mine = lines.filter(marked)
  deep(lines.filter(line => !marked(line)), baseOf(rel).split('\n'), a('every base line is there, in order, none changed'))
  eq(mine.length, 3, a('exactly three lines are this change\'s'))
  LINE_RE[rel].forEach((re, i) => ok(re.test(mine[i] ?? ''), a(`line ${i + 1} is ${['the bar\'s import', 'the flag\'s import', 'the bar, drawn only with the flag'][i]}`)))
  eq(lines[lines.indexOf(mine[0]) - 1], AFTER[rel][0], a('the imports come right after the rail\'s (the layout: after the shell\'s sheet)'))
  eq(lines[lines.indexOf(mine[0]) + 1], mine[1], a('the two imports together'))
  eq(lines[lines.indexOf(mine[2]) - 1], AFTER[rel][1], a('the bar is drawn right after the rail, a sibling of it under the shell root'))
  nomatch(mine.join('\n').replace(/\/\/.*$|\{\/\*.*?\*\/\}/gm, ''), /process\.env/, a('the lines read no environment (the lib does)'))
  eq(stripFn(rel, stripFn(rel, text)), stripFn(rel, text), a('stripping twice changes nothing more'))
}
function proveUntouched(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of [RAIL, HEADER, PROFILE, SHELL_CSS, 'components/layout/studio-p2-shell.css', 'components/layout/studio-new-logo.css', 'components/help/studio-help.tsx', 'components/builder/studio-session-hygiene.tsx', 'components/builder/builder-header.tsx'])
    eq(sha(read(rel)), sha(baseOf(rel)), a(`${rel} is the base commit's, byte for byte (FRONTEND-1's p2-details proof holds the rail and the account header)`))
}

// ---------------------------------------------------------------- 5. flag off
const STATES = []
for (const flag of SPELLINGS) for (const shell of ['true', 'false', undefined]) STATES.push({ flag, shell })
function renderLayout(text, st) {
  const env = { ...(st.flag === undefined ? {} : { [FLAG]: st.flag }), ...(st.shell === undefined ? {} : { [SHELL]: st.shell }) }
  const stubs = {
    react: React,
    '@/components/layout/app-header': { AppHeader: () => h('header', { id: 'header' }), BackToBuilderButton: () => h('button', { id: 'back' }) },
    '@/components/layout/studio-rail': { StudioRail: props => h('aside', { id: 'rail' }, props.studioEntry) },
    '@/lib/studio-payments-open-soon': { STUDIO_PAYMENTS_OPEN_SOON_ENABLED: false },
    '@/components/billing/studio-payments-open-soon-mount': { StudioPaymentsOpenSoonMount: () => h('i', { 'data-mount': 'payments' }) },
    '@/lib/studio-duplicate-copy-title': { STUDIO_DUPLICATE_COPY_TITLE_ENABLED: false },
    '@/components/builder/studio-duplicate-copy-title-mount': { StudioDuplicateCopyTitleMount: () => h('i', { 'data-mount': 'dup' }) },
    '@/lib/studio-pass3-polish': { STUDIO_PASS3_POLISH_ENABLED: false },
    '@/components/studio-pass3-polish/studio-pass3-polish-mount': { StudioPass3PolishMount: () => h('i', { 'data-mount': 'pass3' }) },
    '@/components/layout/studio-phone-tab-bar': { StudioPhoneTabBar: props => h('nav', { 'data-bar-stub': 'true', 'data-props': JSON.stringify(props) }) },
  }
  return renderToStaticMarkup(load(LAYOUT, { env, stubs, text }).default({ children: 'page' }))
}
const BAR_STUB = '<nav data-bar-stub="true" data-props="{}"></nav>'
function proveFlagOff(layoutText, at = '') {
  const a = message => (at ? `${at}: flag off: ${message}` : `flag off: ${message}`)
  const head = [], base = []
  for (const st of STATES) {
    const on = st.flag === 'true' && st.shell === 'true'
    const hh = renderLayout(withoutOthers(LAYOUT, layoutText), st), bb = renderLayout(withoutOthers(LAYOUT, baseOf(LAYOUT)), st)
    if (on) {
      ok(hh.includes(`<aside id="rail"><button id="back"></button></aside>${BAR_STUB}<div data-studio-v4-shell-column="true">`), a('flag on: the bar is drawn right after the rail, with no props'))
      eq(hh.replace(BAR_STUB, ''), bb, a('flag on: and it is the only difference'))
    } else {
      eq(hh, bb, a(`the account layout in ${JSON.stringify(st)} renders the base commit's HTML`))
      head.push(hh); base.push(bb)
    }
  }
  eq(sha(head.join('\n')), sha(base.join('\n')), a(`sha256 over the ${head.length} flag-off states is the base commit's`))
  // the Builder: the three marked lines are two imports and one element gated on the constant (proved false off by section 1); nothing else imports the bar
  const page = read(PAGE).split('\n').filter(marked)
  ok(page[2].trimStart().startsWith('{STUDIO_PHONE_SHELL_ENABLED && <StudioPhoneTabBar '), a('the Builder draws the bar only when the constant is true'))
  const importers = ['app', 'components', 'hooks', 'lib'].flatMap(dir => fs.readdirSync(path.join(root, dir), { recursive: true }).map(name => `${dir}/${name}`)).filter(rel => /\.tsx?$/.test(rel) && rel !== BAR && read(rel).includes('studio-phone-tab-bar')).sort()
  deep(importers, [LAYOUT, PAGE].sort(), a('only the two hosts import the bar'))
  return { states: head.length, base: sha(base.join('\n')), head: sha(head.join('\n')) }
}

// ---------------------------------------------------------------- 6. the change: strip, registry, env block, taught proofs, scope, secret scan
function proveStrip(stripFn, at = '') {
  const a = message => (at ? `${at}: strip: ${message}` : `strip: ${message}`)
  eq(stripFn('lib/other.ts', 'x // PHONE-SHELL-NAV'), 'x // PHONE-SHELL-NAV', a('any other file is returned as it is'))
  eq(stripFn(PAGE, 'a\nb // PHONE-SHELL-NAV (x): y\nc\n'), 'a\nc\n', a('a marked line goes, every other byte stays (trailing newline too)'))
  eq(stripFn(LAYOUT, 'a\n{x}{/* PHONE-SHELL-NAV: y */}\nb'), 'a\nb', a('the layout the same, a JSX comment marker too'))
  const keep = 'a\nb // PHONE-SHELL-TOP\nc // PHONE-SHELL-NAVX\nd // XPHONE-SHELL-NAV\ne // PHONE-SHELL-NAV-2\nf // PASS3-POLISH\n'
  eq(stripFn(PAGE, keep), keep, a('only this change\'s marker, as a whole token, takes a line out: PR 2\'s and every other change\'s lines stay'))
  eq(stripFn(PAGE, 7), 7, a('a non-string comes back'))
  deep(PHONE_SHELL_NAV_FILES, [PAGE, LAYOUT], a('the strip takes lines out of the Builder page and the account layout only'))
  for (const rel of PHONE_SHELL_NAV_PIN_FILES) {
    eq(sha(stripFn(rel, read(rel))), sha(baseOf(rel)), a(`${rel}: a proof this change taught reads as the base commit's file`))
    eq(sha(putBackPin(rel, read(rel))), sha(baseOf(rel)), a(`${rel}: putBackPin gives the base commit's file byte for byte`))
  }
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: registry: ${message}` : `registry: ${message}`)
  const lines = registryText.split('\n').filter(line => line.includes("'./studio-phone-shell-nav-strip.mjs'"))
  eq(lines.length, 3, a('exactly three lines for this change: its files, its block and its strip'))
  ok(lines.every(line => line.endsWith('// LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)')), a('each carries the LATER-CHANGE marker'))
  match(lines[0], /^ {2}\.\.\.\(await import\('\.\/studio-phone-shell-nav-strip\.mjs'\)\)\.PHONE_SHELL_NAV_SCOPE_FILES,/, a('line 1: the files'))
  match(lines[1], /^ {2}\(await import\('\.\/studio-phone-shell-nav-strip\.mjs'\)\)\.PHONE_SHELL_NAV_ENV_BLOCK,/, a('line 2: the block'))
  match(lines[2], /^ {2}\(await import\('\.\/studio-phone-shell-nav-strip\.mjs'\)\)\.stripPhoneShellNav,/, a('line 3: the strip'))
  const at1 = registryText.indexOf(lines[0]), at2 = registryText.indexOf(lines[1]), at3 = registryText.indexOf(lines[2])
  const files = registryText.indexOf('export const LATER_CHANGE_FILES'), blocks = registryText.indexOf('export const LATER_ENV_BLOCKS'), strips = registryText.indexOf('export const LATER_STRIPS')
  ok(files < at1 && at1 < blocks && blocks < at2 && at2 < strips && strips < at3, a('each in its list'))
  const legalFiles = registryText.indexOf("'./studio-legal-short-links-strip.mjs')).LEGAL_SHORT_LINKS_SCOPE_FILES"), legalBlock = registryText.indexOf("'./studio-legal-short-links-strip.mjs')).LEGAL_SHORT_LINKS_ENV_BLOCK"), polishF = registryText.indexOf("'./studio-pass3-polish-f-strip.mjs')).stripPass3PolishF")
  ok(legalFiles > 0 && legalFiles < at1 && legalBlock > 0 && legalBlock < at2 && polishF > 0 && polishF < at3, a('each comes after the last change before it in the same list (a union on merge keeps all)'))
  ok(LATER_STRIPS.includes(stripPhoneShellNav), a('the registry holds the strip'))
  ok([...PHONE_SHELL_NAV_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('the registry names every file of this change'))
  ok(LATER_ENV_BLOCKS.includes(PHONE_SHELL_NAV_ENV_BLOCK), a('and its block'))
}
// STACK: a block registered after this one (perceived speed) is appended after it; it comes out first, so this change's block is the last one of its own tree.
const withoutLaterEnvBlocks = text => LATER_ENV_BLOCKS.slice(LATER_ENV_BLOCKS.indexOf(PHONE_SHELL_NAV_ENV_BLOCK) + 1).reverse().reduce((out, block) => (out.endsWith(`\n${block}`) ? out.slice(0, out.length - block.length - 1) : out), text)
function proveEnv(envText0, at = '') {
  const envText = withoutLaterEnvBlocks(envText0)
  const a = message => (at ? `${at}: env: ${message}` : `env: ${message}`)
  ok(envText.endsWith(`\n\n${PHONE_SHELL_NAV_ENV_BLOCK}`), a('the block is appended at the end of the file, after one blank line'))
  eq(envText.slice(0, envText.length - PHONE_SHELL_NAV_ENV_BLOCK.length - 1), baseOf(ENV), a('and the file before it is the base commit\'s, byte for byte'))
  eq(envText.split(PHONE_SHELL_NAV_ENV_BLOCK).length - 1, 1, a('the block is there once'))
  const lines = PHONE_SHELL_NAV_ENV_BLOCK.trimEnd().split('\n')
  eq(lines.at(-1), `${FLAG}="false"`, a('its one assignment: the flag, default "false"'))
  ok(lines.slice(0, -1).every(line => line.startsWith('# ')), a('everything else is comment'))
  match(PHONE_SHELL_NAV_ENV_BLOCK, /exact value "true" together with NEXT_PUBLIC_STUDIO_V4_SHELL; default off/, a('it says on for exact "true" with the shell, default off'))
  eq(stripLaterChanges(ENV, envText), stripLaterChanges(ENV, baseOf(ENV)), a('through the registry .env.example is the base commit\'s'))
}
function provePins(at = '') {
  const a = message => (at ? `${at}: taught proofs: ${message}` : `taught proofs: ${message}`)
  deep(PHONE_SHELL_NAV_PIN_FILES, ['scripts/test-studio-pass3-polish-e.mjs', 'scripts/test-studio-pass3-polish-f.mjs', 'scripts/test-studio-legal-short-links.mjs', 'scripts/test-studio-thumbnail-last-good.mjs'], a('four older proofs, all FRONTEND-2\'s own: Pass 3 polish E and F, legal short links and thumbnail last good'))
  for (const rel of PHONE_SHELL_NAV_PIN_FILES) {
    nomatch(rel, /test-studio-p2-|launch-wording|env-append-tolerant|route-params|admin-email-guard|uat-marketing|docs|landing/, a(`${rel}: not a FRONTEND-1 test`))
    const text = read(rel), edits = PHONE_SHELL_NAV_PIN_EDITS[rel]
    eq(edits.length, 1, a(`${rel}: one edit`))
    for (const [has, was] of edits) {
      eq(text.split(has).length - 1, 1, a(`${rel}: the taught line is there once`))
      ok(has.endsWith('\n') && was.endsWith('\n') && has.split('\n').length === 2 && was.split('\n').length === 2, a(`${rel}: one whole line for one whole line`))
      ok(has.includes(PHONE_SHELL_NAV_PIN_MARK), a(`${rel}: the taught line carries the mark`))
      ok(baseOf(rel).includes(was), a(`${rel}: the line it replaces is the base commit's`))
    }
    match(edits[0][0], /LATER_STRIPS\.slice\(LATER_STRIPS\.indexOf\(stripPass3Polish[EF]\) \+ 1\)|--grep=\^Legal short links:|!LATER_CHANGE_FILES\.has\(rel\)/, a(`${rel}: the edit reads through the registry (the changes after it) or this change's own commit, nothing of this change named`))
  }
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: scope: ${message}` : `scope: ${message}`)
  ok([...PHONE_SHELL_NAV_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
  eq(PHONE_SHELL_NAV_SCOPE_FILES.size, PHONE_SHELL_NAV_FILES.length + PHONE_SHELL_NAV_NEW_FILES.length + PHONE_SHELL_NAV_OWN_EDITS.length, a('the lists do not overlap'))
  const family = ['lib', 'components/layout', 'scripts'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(name => /phone-shell|phone-tab/.test(name) && !/builder-top/.test(name)).map(name => `${dir}/${name}`))
  deep(family.filter(rel => !PHONE_SHELL_NAV_SCOPE_FILES.has(rel)), [], a('no file of this change\'s family is missing from its list'))
  for (const rel of PHONE_SHELL_NAV_SCOPE_FILES) nomatch(rel, /^components\/layout\/(studio-rail|app-header)\.tsx$|^components\/user-profile-menu|test-studio-p2-|launch-wording|env-append-tolerant|^app\/\(app\)\/settings|^components\/settings|publish|^app\/admin|docs/, a(`${rel}: not the rail, the account header, the account menu or a FRONTEND-1 file`))
  const committed = ownCommitted()
  deep(committed.filter(rel => !PHONE_SHELL_NAV_SCOPE_FILES.has(rel)), [], a(`every file in this change's committed diff (${BASE.slice(0, 8)}..HEAD) is its own`))
  if (committed.length) {
    deep([...PHONE_SHELL_NAV_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    deep(committed.filter(rel => /^scripts\/test-/.test(rel)).sort(), [...PHONE_SHELL_NAV_PIN_FILES, THIS_TEST].sort(), a('the tests it adds or edits: its own and the four it teaches'))
    deep(committed.filter(rel => /^(app|components|lib|hooks)\//.test(rel)).sort(), [...PHONE_SHELL_NAV_FILES, ...PHONE_SHELL_NAV_NEW_FILES.filter(rel => !rel.startsWith('scripts/'))].sort(), a('the app files: the two hosts (marked lines) and the new lib, bar and sheet'))
  }
}
function proveSecretScan(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [LIB, BAR, CSS, STRIP_MODULE, THIS_TEST].map(read).concat(read(PAGE).split('\n').filter(marked), read(LAYOUT).split('\n').filter(marked), [PHONE_SHELL_NAV_ENV_BLOCK]).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
  // the patterns of scripts/test-studio-thumbnail-last-good.mjs, whose added-lines scan leaves a registered later change's new files to their own proofs; its bare "key" name is left out: this change's link table is { key: 'knowledge', ... }
  nomatch(added, /(?:secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no quoted literal assigned to a credential-shaped name (the thumbnail proof\'s names)'))
  nomatch(added, /eyJ[A-Za-z0-9_-]{10,}\.|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|Bearer [A-Za-z0-9._-]{20,}/, a('no token, key or bearer string'))
}

// ---------------------------------------------------------------- run everything
function proveAll(stripFn = stripPhoneShellNav, at = '') {
  proveLib(at)
  proveCss(read(CSS), at)
  proveRender(at)
  provePin(PAGE, read(PAGE), stripFn, at)
  provePin(LAYOUT, read(LAYOUT), stripFn, at)
  proveUntouched(at)
  const digest = proveFlagOff(read(LAYOUT), at)
  proveStrip(stripFn, at)
  proveRegistry(read(REGISTRY), at)
  proveEnv(read(ENV), at)
  provePins(at)
  proveScope(at)
  proveSecretScan(at)
  return digest
}
const digest = proveAll()
console.log(`flag off: the account layout renders the base commit's HTML in ${digest.states} flag-off states, sha256 base ${digest.base.slice(0, 16)} == head ${digest.head.slice(0, 16)}; the Builder's three lines are the base's without them`)
console.log(`PASS lib, stylesheet, render, pin, flag off, change: ${checks} checks`)

// =========================================================== 7. mutants
const killed = [], survived = []
async function mutant(name, edits, { strip = stripPhoneShellNav } = {}) {
  const before = overrides
  try {
    overrides = { ...before }
    for (const [rel, from, to, mode] of edits) {
      const source = read(rel), n = source.split(from).length - 1
      assert.ok(mode ? n >= 1 : n === 1, `mutant "${name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = mode === 'all' ? source.split(from).join(to) : source.replace(from, () => to)
    }
    proveAll(strip, name)
  } catch (error) {
    if (/no longer applies/.test(String(error.message))) throw error
    killed.push(name); if (process.env.PHONE_SHELL_NAV_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
const lib = (from, to) => [LIB, from, to], bar = (from, to, mode) => [BAR, from, to, mode], css = (from, to, mode) => [CSS, from, to, mode]
// the lib
await mutant('lib: the flag alone (no shell)', [lib("return flag === 'true' && shell === 'true'", "return flag === 'true'")])
await mutant('lib: any truthy value', [lib("return flag === 'true' && shell === 'true'", "return Boolean(flag) && shell === 'true'")])
await mutant('lib: /dashboard/x is Decks too', [lib("if (route === '/dashboard') return 'decks'", "if (route.startsWith('/dashboard')) return 'decks'")])
await mutant('lib: Themes before Templates', [lib("  { tab: 'templates', href: '/studio/templates' },\n  { tab: 'themes', href: '/studio/themes' },", "  { tab: 'themes', href: '/studio/themes' },\n  { tab: 'templates', href: '/studio/templates' },")])
await mutant('lib: Intelligence is a tab, not under More', [lib("  { tab: 'themes', href: '/studio/themes' },\n]", "  { tab: 'themes', href: '/studio/themes' },\n  { tab: 'intelligence' as 'themes', href: '/studio/intelligence' },\n]")])
await mutant('lib: Your details is left out of More', [lib("  { key: 'details', label: 'Your details', href: '/studio/details' },\n", '')])
await mutant('lib: Intelligence renamed', [lib("label: 'Intelligence'", "label: 'Models'")])
await mutant('lib: Second brain copied, not the rail\'s label', [lib("{ key: 'knowledge', label: null,", "{ key: 'knowledge', label: 'Second brain',")])
await mutant('lib: Help goes to /support', [lib("href: '/help'", "href: '/support'")])
await mutant('lib: the composer is any textarea', [lib("'[data-studio-composer-prompt=\"true\"] textarea'", "'textarea'")])
// the stylesheet
await mutant('css: the bar is shown on tablets too (768px)', [css('@media (max-width: 640px) {', '@media (max-width: 768px) {')])
await mutant('css: the bar is not hidden outside the query', [css('[data-studio-phone-tabbar="true"] { display: none; }\n\n', '')])
await mutant('css: !important', [css('padding-left: 52px;', 'padding-left: 52px !important;')])
await mutant('css: the rail is hidden on every page, not only where the bar is', [css('[data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) > [data-studio-v4-rail] > :is(nav, .studio-rail-profile)', '[data-studio-v4-shell="true"] > [data-studio-v4-rail] > :is(nav, .studio-rail-profile)')])
await mutant('css: the brand tile is hidden too', [css('> :is(nav, .studio-rail-profile) { display: none; }', '> :is(nav, .studio-rail-profile, .studio-rail-brand) { display: none; }')])
await mutant('css: no safe area under the bar', [css('height: calc(56px + env(safe-area-inset-bottom, 0px)); padding: 4px 6px env(safe-area-inset-bottom, 0px);', 'height: 56px; padding: 4px 6px;')])
await mutant('css: no bottom padding for the page', [css('position: relative; padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }', 'position: relative; }')])
await mutant('css: the bar stays while the prompt has focus', [css('  [data-studio-v4-shell="true"] > [data-studio-phone-tabbar="true"][data-composer-focus="true"] { display: none; }\n', '')])
await mutant('css: the padding stays while the prompt has focus', [css('  [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"][data-composer-focus="true"]) { padding-bottom: 0; }\n', '')])
await mutant('css: 40 px tabs', [css('flex: 1 1 0; min-width: 44px;', 'flex: 1 1 0; min-width: 40px;')])
await mutant('css: the current tab in teal, not the accent', [css('> [aria-current="page"] { color: var(--ss-accent);', '> [aria-current="page"] { color: var(--ss-teal);')])
await mutant('css: a rule for every studio button', [css('\n  /* the bar */', '\n  [data-studio-v4-shell="true"] button { min-height: 44px; }\n  /* the bar */')])
await mutant('css: a Settings rule slipped in', [css('\n  /* the bar */', '\n  [data-studio-phone-more="true"] [data-studio-settings] a { color: red; }\n  /* the bar */')])
await mutant('css: the top bar keeps no room for the tile', [css('> [data-studio-v4-shell-header] > div { padding-left: 52px; }', '> [data-studio-v4-shell-header] > div { padding-left: 10px; }')])
// the bar
await mutant('bar: More before Themes', [bar('      <Link href="/studio/themes"', '      <Dialog.Root open={false} onOpenChange={() => {}}><Dialog.Trigger asChild><button type="button" data-studio-phone-tab="more"><span>More</span></button></Dialog.Trigger></Dialog.Root>\n      <Link href="/studio/themes"')])
await mutant('bar: Decks loses its word', [bar('<FolderOpen aria-hidden="true" /><span>{navLabels.decks}</span>', '<FolderOpen aria-hidden="true" />')])
await mutant('bar: the current tab is not marked', [bar('data-studio-phone-tab="templates" aria-current={current("templates")}', 'data-studio-phone-tab="templates"')])
await mutant('bar: Themes loses the rail\'s name', [bar(' aria-label="Themes & brand"', '')])
await mutant('bar: the sheet is not modal', [bar('<Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>', '<Dialog.Root open={moreOpen} onOpenChange={setMoreOpen} modal={false}>')])
await mutant('bar: Escape does not close the sheet', [bar('aria-describedby={undefined}>', 'aria-describedby={undefined} onEscapeKeyDown={event => event.preventDefault()}>')])
await mutant('bar: focus does not go back to More', [bar('aria-describedby={undefined}>', 'aria-describedby={undefined} onCloseAutoFocus={event => event.preventDefault()}>')])
await mutant('bar: More is not the trigger', [bar('<Dialog.Trigger asChild>\n          <button type="button" data-studio-phone-tab="more" aria-current={current("more")}><MoreHorizontal aria-hidden="true" /><span>More</span></button>\n        </Dialog.Trigger>', '<button type="button" data-studio-phone-tab="more" aria-current={current("more")} onClick={() => setMoreOpen(true)}><MoreHorizontal aria-hidden="true" /><span>More</span></button>')])
await mutant('bar: the sheet has no title', [bar('<Dialog.Title data-studio-phone-more-title="true">More</Dialog.Title>', '')])
await mutant('bar: the account menu is left out', [bar('              <li data-studio-phone-more-account="true"><UserProfileMenu sessionUsage={sessionUsage} studioLabels studioPalette={process.env.NEXT_PUBLIC_STUDIO_V4_TOKENS === "true"} /><span aria-hidden="true">Account</span></li>\n', '')])
await mutant('bar: the account menu without the session usage', [bar('<UserProfileMenu sessionUsage={sessionUsage} studioLabels', '<UserProfileMenu studioLabels')])
await mutant('bar: a link does not close the sheet', [bar(' onClick={() => setMoreOpen(false)}>', '>')])
await mutant('bar: the sheet stays open on a new page', [bar('useEffect(() => { setMoreOpen(false) }, [pathname])', 'useEffect(() => {}, [pathname])')])
await mutant('bar: Studio always opens a fresh Builder', [bar('      if (last) target = `/builder?session_id=${last}`\n', '')])
await mutant('bar: Studio reads another key', [bar('window.localStorage.getItem(lastBuilderSessionKey(userId))', 'window.localStorage.getItem("last_session")')])
await mutant('bar: blur does not bring the bar back', [bar('const onFocusOut = (event: FocusEvent) => { if (!isComposer(event.relatedTarget)) setComposerFocus(false) }', 'const onFocusOut = (_event: FocusEvent) => {}')])
await mutant('bar: the listeners are never removed', [bar('      document.removeEventListener("focusin", onFocusIn)\n      document.removeEventListener("focusout", onFocusOut)\n', '')])
await mutant('bar: the composer state is not on the bar', [bar(' data-composer-focus={composerFocus ? "true" : undefined}', '')])
await mutant('bar: in the Builder Studio navigates away', [bar('<button type="button" data-studio-phone-tab="studio" aria-current="page">', '<button type="button" data-studio-phone-tab="studio" aria-current="page" onClick={openStudio}>')])
// the pins
const PAGE_BAR = read(PAGE).split('\n').filter(marked)[2], LAYOUT_BAR = read(LAYOUT).split('\n').filter(marked)[2]
await mutant('page: the bar line loses its marker', [[PAGE, PAGE_BAR, PAGE_BAR.replace(/\{\/\*.*\*\/\}$/, '')]])
await mutant('page: the bar is drawn without the flag', [[PAGE, '      {STUDIO_PHONE_SHELL_ENABLED && <StudioPhoneTabBar sessionUsage', '      {studioShell && <StudioPhoneTabBar sessionUsage']])
await mutant('page: the bar moves above the rail', [[PAGE, `${AFTER[PAGE][1]}\n${PAGE_BAR}\n`, `${PAGE_BAR}\n${AFTER[PAGE][1]}\n`]])
await mutant('page: an unmarked line added', [[PAGE, PAGE_BAR, `${PAGE_BAR}\n      {null}`]])
await mutant('page: a base line changed', [[PAGE, AFTER[PAGE][0], `${AFTER[PAGE][0]};`]])
await mutant('layout: the bar is drawn without the flag', [[LAYOUT, '      {STUDIO_PHONE_SHELL_ENABLED && <StudioPhoneTabBar />}', '      {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" && <StudioPhoneTabBar />}']])
await mutant('layout: the bar gets a prop', [[LAYOUT, '<StudioPhoneTabBar />}', '<StudioPhoneTabBar sessionUsage={null} />}']])
await mutant('layout: the bar line is gone', [[LAYOUT, `${LAYOUT_BAR}\n`, '']])
await mutant('layout: the bar is drawn inside the column', [[LAYOUT, `${LAYOUT_BAR}\n`, ''], [LAYOUT, '        <AppHeader />\n', `        <AppHeader />\n${LAYOUT_BAR}\n`]])
await mutant('rail: edited (FRONTEND-1\'s p2-details would fail)', [[RAIL, '<aside data-studio-v4-rail="true"', '<aside data-studio-v4-rail="true" data-studio-phone-shell="true"']])
await mutant('account header: edited', [[HEADER, '<header data-studio-v4-shell-header="true">', '<header data-studio-v4-shell-header="true" data-phone="true">']])
// the strip, the registry, the env block, the taught proofs
await mutant('strip: leaves the marked lines', [], { strip: (rel, text) => text })
await mutant('strip: the marker is a substring (PR 2\'s lines go too)', [], { strip: (rel, text) => (PHONE_SHELL_NAV_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes('PHONE-SHELL')).join('\n') : stripPhoneShellNav(rel, text)) })
await mutant('strip: drops the trailing newline', [], { strip: (rel, text) => { const out = stripPhoneShellNav(rel, text); return PHONE_SHELL_NAV_FILES.includes(rel) && typeof out === 'string' ? out.replace(/\n$/, '') : out } })
await mutant('strip: does not put the taught proofs back', [], { strip: (rel, text) => (rel in PHONE_SHELL_NAV_PIN_EDITS ? text : stripPhoneShellNav(rel, text)) })
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-phone-shell-nav-strip.mjs')).PHONE_SHELL_NAV_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)\n", '']])
await mutant('registry: the block line is gone', [[REGISTRY, "  (await import('./studio-phone-shell-nav-strip.mjs')).PHONE_SHELL_NAV_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)\n", '']])
await mutant('registry: the strip line moves above polish F\'s', [[REGISTRY, "  (await import('./studio-phone-shell-nav-strip.mjs')).stripPhoneShellNav, // LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)\n", ''], [REGISTRY, "  (await import('./studio-pass3-polish-f-strip.mjs')).stripPass3PolishF,", "  (await import('./studio-phone-shell-nav-strip.mjs')).stripPhoneShellNav, // LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)\n  (await import('./studio-pass3-polish-f-strip.mjs')).stripPass3PolishF,"]])
await mutant('env: the default is "true"', [[ENV, `${FLAG}="false"`, `${FLAG}="true"`]])
await mutant('env: the block is in the middle of the file', [[ENV, `\n\n${PHONE_SHELL_NAV_ENV_BLOCK}`, ''], [ENV, 'NEXT_PUBLIC_STUDIO_PASS3_POLISH="false"\n', `NEXT_PUBLIC_STUDIO_PASS3_POLISH="false"\n\n${PHONE_SHELL_NAV_ENV_BLOCK}`]])
await mutant('env: a base line changed', [[ENV, 'NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS="false"', 'NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS="true"']])
await mutant('taught proof: polish E reads its files raw again (the edit is not there)', [['scripts/test-studio-pass3-polish-e.mjs', PHONE_SHELL_NAV_PIN_EDITS['scripts/test-studio-pass3-polish-e.mjs'][0][0], PHONE_SHELL_NAV_PIN_EDITS['scripts/test-studio-pass3-polish-e.mjs'][0][1]]])
await mutant('taught proof: thumbnail last good scans a later change\'s new files again (the edit is not there)', [['scripts/test-studio-thumbnail-last-good.mjs', PHONE_SHELL_NAV_PIN_EDITS['scripts/test-studio-thumbnail-last-good.mjs'][0][0], PHONE_SHELL_NAV_PIN_EDITS['scripts/test-studio-thumbnail-last-good.mjs'][0][1]]])
await mutant('taught proof: thumbnail last good loses the mark', [['scripts/test-studio-thumbnail-last-good.mjs', ` ${PHONE_SHELL_NAV_PIN_MARK}`, '']])
await mutant('taught proof: polish F loses the mark', [['scripts/test-studio-pass3-polish-f.mjs', ` ${PHONE_SHELL_NAV_PIN_MARK}`, '']])
await mutant('secret scan: a bearer string in an ordinary name', [[STRIP_MODULE, "export const PHONE_SHELL_NAV_MARKER = 'PHONE-SHELL-NAV'", `export const PHONE_SHELL_NAV_MARKER = 'PHONE-SHELL-NAV'\nconst note = '${['Bearer ', 'a'.repeat(24)].join('')}'`]])
await mutant('secret scan: a credential-named literal', [[STRIP_MODULE, "export const PHONE_SHELL_NAV_MARKER = 'PHONE-SHELL-NAV'", `export const PHONE_SHELL_NAV_MARKER = 'PHONE-SHELL-NAV'\nconst ${['user', 'Credential'].join('')} = '${['abcdefgh', '12345678'].join('')}'`]])
await mutant('secret scan: a credential-shaped literal', [[STRIP_MODULE, "export const PHONE_SHELL_NAV_MARKER = 'PHONE-SHELL-NAV'", `export const PHONE_SHELL_NAV_MARKER = 'PHONE-SHELL-NAV'\nconst ${['api', 'Key'].join('')} = '${['AKIA', 'ABCDEFGH', '12345678'].join('')}'`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.log('SURVIVED:\n  ' + survived.join('\n  ')); process.exit(1) }
console.log(`test-studio-phone-shell-nav: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
