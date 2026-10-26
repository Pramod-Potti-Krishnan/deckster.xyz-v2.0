// FRONTEND-2 (PK's phone review, 26 Oct, on the bottom bar: "Frame: merged into the frame", "Labels: selected tab only"): proof for "Phone tab bar frame". Flag NEXT_PUBLIC_STUDIO_PHONE_SHELL (exact "true", default off,
// build-time; it also needs NEXT_PUBLIC_STUDIO_V4_SHELL): the SAME flag as phone shell 1 and 2 (#516, #517), so there is no new env block. On a phone (640 px and narrower) the bottom tab bar sits on the frame (the frame's colour,
// opaque, no top line); the selected tab is the desktop rail's selected item (a panel tile, the teal icon and name, the rail's soft shadow; in the dark theme a --ss-soft tile with a --ss-line ring, because --ss-panel is almost the
// frame); only the selected tab shows its name, the others keep theirs for assistive tech (visually hidden, never display: none). Pure CSS: no markup changes.
// Run: node scripts/test-studio-tabbar-frame.mjs   (plain node: TypeScript transpile, react-dom/server, postcss, `git show` for the base commit; no network, no browser, no model call, nothing written)
//
// How the CSS is proved without a browser: the bar is rendered by the component itself (react-dom/server, the same stubs as phone shell 1's proof), parsed into a small element tree and put under the shell root (light, or under
// .dark); the real stylesheets (phone shell 1's, this change's) are run through a small cascade (postcss for the rules; a selector matcher for the subset the bar's rules use, with specificity, source order, the media query
// and the shell's own tokens from studio-shell.css). What it yields is the value each element ends up with. A selector or at-rule the matcher does not know is a failure for this change's sheet.
//
//   1. stylesheet  only inside @media (max-width: 640px); every selector needs the bar under the shell root; no !important; only the properties listed for the bar, the selected tab and the name; none that sizes a tab or takes a name out
//   2. cascade     per theme and route: the bar is the frame's colour, opaque, no top line, same height and safe-area padding; the selected tab is the rail's tile (light) / the --ss-soft tile with a ring (dark); the other
//                  tabs are as they were; order of the two sheets does not matter; the rules touch the bar, its tabs and their names only (a rail, the card, the More sheet and the account pages are fixtures with decoys)
//   3. names       exactly the current tab shows its name (More too, on a page under More); the others are clipped to 1 px (never display: none / visibility: hidden / opacity / font-size), and all 5 tabs keep an accessible name
//   4. targets     44 x 48 px minimum on every tab, equal cells (no tab-specific size), cell width at phone widths, the tab's height is the base's (51 px) with or without the safe area, bar height unchanged
//   5. contrast    muted icons on the frame >= 3 : 1; the selected name on its tile >= 4.5 : 1 (light and dark); the dark tile is visibly lifted off the frame as the light one is; the plain panel tile would not be
//   6. identity    flag off (no bar) and above 640 px: every element resolves to the same style with and without this sheet (sha256); the bar's render is the base's, byte for byte (sha256), in every state
//   7. change      the strip (whole-token marker; the base's file back), the one import line, the registry (two lines, no env block), the files this change must leave alone, scope (the COMMITTED diff only), no secret
//   8. mutants     each one must make sections 1-7 fail
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
  BASE_COMMIT, TABBAR_FRAME_BAR, TABBAR_FRAME_COMMIT_SUBJECT, TABBAR_FRAME_FILES, TABBAR_FRAME_MARKER_RE, TABBAR_FRAME_NEW_FILES, TABBAR_FRAME_OWN_EDITS, TABBAR_FRAME_SCOPE_FILES, stripTabbarFrame,
} from './studio-tabbar-frame-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const h = React.createElement
const BASE = process.env.TABBAR_FRAME_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
let overrides = {} // in-memory mutations: every proof reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const marked = line => TABBAR_FRAME_MARKER_RE.test(line)

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const eq = count(assert.equal), deep = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message)), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const BAR = TABBAR_FRAME_BAR, CSS = 'components/layout/studio-tabbar-frame.css', PR1_CSS = 'components/layout/studio-phone-shell.css', SHELL_CSS = 'components/layout/studio-shell.css'
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-tabbar-frame-strip.mjs', THIS_TEST = 'scripts/test-studio-tabbar-frame.mjs', ENV = '.env.example'
const FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_SHELL', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const BARSEL = '[data-studio-phone-tabbar="true"]', PHONE = '(max-width: 640px)'
const IMPORT_RE = /^import "\.\/studio-tabbar-frame\.css" \/\/ PHONE-TABBAR-FRAME \(NEXT_PUBLIC_STUDIO_PHONE_SHELL, default off\): /
const BAR_BASE_IMPORT = 'import "./studio-phone-shell.css"'

// ---------------------------------------------------------------- selector matcher, cascade (the subset the bar's rules use)
class Unsupported extends Error {}
const splitTop = (text, separator = ',') => {
  const parts = []; let depth = 0, quote = '', start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) { if (c === quote) quote = ''; continue }
    if (c === '"' || c === "'") quote = c
    else if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === separator && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1 }
  }
  parts.push(text.slice(start).trim())
  return parts
}
const closeParen = (text, open) => { let depth = 0; for (let i = open; i < text.length; i++) { if (text[i] === '(') depth++; else if (text[i] === ')' && --depth === 0) return i } throw new Unsupported(`unbalanced ( in ${text}`) }
function parseCompound(text, start) {
  let i = start
  const c = { tag: null, classes: [], attrs: [], pseudos: [] }
  const sticky = re => { re.lastIndex = i; const found = re.exec(text); if (found) i = re.lastIndex; return found }
  let m = sticky(/(\*|[A-Za-z][\w-]*)/y)
  if (m) c.tag = m[1]
  for (;;) {
    if (text[i] === '.') { i++; m = sticky(/[\w-]+/y); if (!m) throw new Unsupported(`class in ${text}`); c.classes.push(m[0]) }
    else if (text[i] === '[') { m = sticky(/\[\s*([\w-]+)\s*(?:=\s*"([^"]*)")?\s*\]/y); if (!m) throw new Unsupported(`attribute in ${text}`); c.attrs.push({ name: m[1], value: m[2] ?? null }) }
    else if (text[i] === ':') {
      if (text[i + 1] === ':') throw new Unsupported(`pseudo-element in ${text}`)
      m = sticky(/:([\w-]+)/y)
      const name = m[1]
      if (name !== 'is' && name !== 'not') throw new Unsupported(`:${name} in ${text}`)
      if (text[i] !== '(') throw new Unsupported(`:${name} without arguments`)
      const end = closeParen(text, i), inner = text.slice(i + 1, end)
      i = end + 1
      c.pseudos.push({ name, list: splitTop(inner).map(parseComplex) })
    } else break
  }
  if (i === start) throw new Unsupported(`nothing to parse at ${JSON.stringify(text.slice(start))}`)
  return [c, i]
}
function parseComplex(text) {
  const parts = []; let i = 0, comb = null
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) { i++; if (comb === null && parts.length) comb = ' ' }
    if (i >= text.length) break
    if (text[i] === '>') { if (!parts.length) throw new Unsupported(`leading combinator in ${text}`); comb = '>'; i++; continue }
    const [compound, next] = parseCompound(text, i)
    parts.push({ comb: parts.length ? (comb ?? ' ') : null, compound }); comb = null; i = next
  }
  if (!parts.length) throw new Unsupported(`empty selector ${JSON.stringify(text)}`)
  return parts
}
const attrOf = (el, name) => el.attrs[name]
function matchCompound(el, c) {
  if (c.tag && c.tag !== '*' && c.tag !== el.tag) return false
  const classes = (attrOf(el, 'class') ?? '').split(/\s+/)
  if (!c.classes.every(k => classes.includes(k))) return false
  if (!c.attrs.every(({ name, value }) => name in el.attrs && (value === null || el.attrs[name] === value))) return false
  for (const p of c.pseudos) { const any = p.list.some(cx => matchComplex(el, cx)); if (p.name === 'is' ? !any : any) return false }
  return true
}
function matchComplex(el, parts, idx = parts.length - 1) {
  if (el.tag === '#root' || !matchCompound(el, parts[idx].compound)) return false
  if (idx === 0) return true
  if (parts[idx].comb === '>') return !!el.parent && matchComplex(el.parent, parts, idx - 1)
  for (let a = el.parent; a; a = a.parent) if (matchComplex(a, parts, idx - 1)) return true
  return false
}
const specificity = parts => { // classes + attributes + pseudo-classes in the thousands, types in the units; :is / :not take their most specific argument
  let n = 0
  for (const { compound: k } of parts) {
    if (k.tag && k.tag !== '*') n += 1
    n += 1000 * (k.classes.length + k.attrs.length)
    for (const p of k.pseudos) n += Math.max(...p.list.map(specificity))
  }
  return n
}
const mediaOn = (media, width) => { const m = /^media \(max-width: (\d+)px\)$/.exec(media); if (!m) throw new Unsupported(`at-rule ${media}`); return width <= Number(m[1]) }

const sheetCache = new Map()
function sheet(text, { strict = false } = {}) {
  const key = `${strict}\0${text}`
  if (!sheetCache.has(key)) {
    const rules = []
    postcss.parse(text).walkRules(rule => {
      const parent = rule.parent
      const media = parent?.type === 'atrule' ? `${parent.name} ${parent.params}` : null
      const nested = parent?.type === 'atrule' && parent.parent?.type !== 'root'
      const decls = rule.nodes.filter(n => n.type === 'decl').map(d => ({ prop: d.prop, value: d.value, important: !!d.important }))
      const selectors = splitTop(rule.selector)
      const parsed = selectors.map(s => { try { return parseComplex(s) } catch (error) { if (error instanceof Unsupported && !strict) return null; throw error } })
      rules.push({ selector: rule.selector, selectors, parsed, media, nested, decls })
    })
    sheetCache.set(key, rules)
  }
  return sheetCache.get(key)
}

const splitValue = value => splitTop(value, ' ').filter(Boolean)
function expand(prop, value) {
  const sides = name => { const [a, b = a, c = a, d = b] = splitValue(value); return [[`${name}-top`, a], [`${name}-right`, b], [`${name}-bottom`, c], [`${name}-left`, d]] }
  if (prop === 'padding' || prop === 'margin') return sides(prop)
  if (prop === 'border' || prop === 'border-top') {
    const edges = prop === 'border' ? ['top', 'right', 'bottom', 'left'] : ['top']
    const tokens = splitValue(value)
    const off = value === '0' || value === 'none'
    const width = off ? '0' : tokens.find(t => /^[\d.]+(px)?$/.test(t)) ?? 'medium', style = off ? 'none' : tokens.find(t => /^(solid|dashed|dotted|none)$/.test(t)) ?? 'none'
    const color = off ? 'currentcolor' : tokens.filter(t => t !== width && t !== style).join(' ') || 'currentcolor'
    return edges.flatMap(e => [[`border-${e}-width`, width], [`border-${e}-style`, style], [`border-${e}-color`, color]])
  }
  if (prop === 'background') return [['background-color', value]]
  return [[prop, value]]
}
const paletteCache = { text: null, light: null, dark: null }
function palette(theme) { // the shell's own tokens, read from studio-shell.css (the dark block over the light one)
  const text = read(SHELL_CSS)
  if (paletteCache.text !== text) {
    const rules = sheet(text)
    const tokens = selector => Object.fromEntries(rules.find(r => r.selectors.includes(selector)).decls.filter(d => d.prop.startsWith('--ss-')).map(d => [d.prop, d.value]))
    Object.assign(paletteCache, { text, light: tokens('[data-studio-v4-shell="true"]') })
    paletteCache.dark = { ...paletteCache.light, ...tokens('.dark [data-studio-v4-shell="true"]') }
  }
  return paletteCache[theme]
}
/** The value each property of `el` ends up with: the sheets in the given order, the media query for `width`, specificity then source order, then the shell's tokens for the theme. */
function resolve(el, sheets, { width, colors }) {
  const hits = []
  sheets.forEach((rules, si) => rules.forEach((rule, ri) => {
    if (rule.media !== null && !mediaOn(rule.media, width)) return
    rule.parsed.forEach(sel => { if (sel && matchComplex(el, sel)) hits.push({ spec: specificity(sel), order: si * 10000 + ri, rule }) })
  }))
  hits.sort((a, b) => a.spec - b.spec || a.order - b.order)
  const out = new Map()
  for (const { rule } of hits) for (const d of rule.decls) { if (d.important) throw new Error('!important is not part of what this cascade resolves'); for (const [p, v] of expand(d.prop, d.value)) out.set(p, v) }
  return Object.fromEntries([...out].map(([p, v]) => [p, v.replace(/var\((--[\w-]+)\)/g, (_, name) => { if (!(name in colors)) throw new Error(`unknown token ${name}`); return colors[name] })]).sort(([a], [b]) => (a < b ? -1 : 1)))
}

// ---------------------------------------------------------------- a small element tree
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
function parseHtml(html) {
  const top = { tag: '#root', attrs: {}, children: [], parent: null }
  let cur = top
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s"'=<>/]+(?:="[^"]*")?)*)\s*>|([^<]+)/g)) {
    if (m[4] !== undefined) { cur.children.push(decode(m[4])); continue }
    const [, close, tag, rawAttrs] = m
    if (close) { assert.equal(cur.tag, tag, `unbalanced </${tag}>`); cur = cur.parent; continue }
    const attrs = {}
    for (const a of rawAttrs.matchAll(/([^\s"'=<>/]+)(?:="([^"]*)")?/g)) attrs[a[1]] = decode(a[2] ?? '')
    const el = { tag, attrs, children: [], parent: cur }
    cur.children.push(el); cur = el
  }
  assert.equal(cur, top, 'the markup is balanced')
  return top
}
const walkEls = (node, out = []) => { for (const c of node.children) if (typeof c !== 'string') { out.push(c); walkEls(c, out) } return out }
const textOf = el => el.children.map(c => (typeof c === 'string' ? c : textOf(c))).join('')

// ---------------------------------------------------------------- the bar, rendered by the component itself (TypeScript transpiled, run in a vm with stubs)
const compileCache = new Map()
function compile(rel, text) {
  const id = `${rel}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const REAL_LIBS = { '@/lib/studio-phone-shell': 'lib/studio-phone-shell.ts', '@/lib/studio-nav-labels': 'lib/studio-nav-labels.ts', '@/lib/last-builder-session': 'lib/last-builder-session.ts' }
function load(rel, { env = {}, stubs = {}, text = read(rel) } = {}) {
  const module = { exports: {} }
  const req = spec => {
    if (Object.prototype.hasOwnProperty.call(stubs, spec)) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec in REAL_LIBS) return load(REAL_LIBS[spec], { env })
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, text), { module, exports: module.exports, require: req, process: { env } }, { filename: rel })
  return module.exports
}
const ICON = name => props => h('svg', { 'data-icon': name, 'aria-hidden': props['aria-hidden'] })
const lucide = new Proxy({ __esModule: true }, { get: (t, name) => (name === '__esModule' ? true : ICON(String(name))) })
function barStubs(pathname) {
  const dialog = {
    __esModule: true,
    Root: props => h(React.Fragment, null, props.children),
    Trigger: props => React.cloneElement(props.children, { 'data-dialog-trigger': 'true' }),
    Portal: props => h('div', { 'data-portal': 'true' }, props.children),
    Overlay: props => h('div', { ...props, 'data-overlay': 'true' }),
    Content: props => { const { children, ...rest } = props; return h('div', { role: 'dialog', 'aria-modal': 'true', ...rest }, children) },
    Title: props => { const { children, ...rest } = props; return h('h2', rest, children) },
  }
  return {
    react: React,
    'next/link': { __esModule: true, default: ({ href, children, ...rest }) => h('a', { href, ...rest }, children) },
    'next/navigation': { usePathname: () => pathname, useRouter: () => ({ push: () => {} }) },
    '@radix-ui/react-dialog': dialog,
    'lucide-react': lucide,
    '@/components/user-profile-menu': { UserProfileMenu: () => h('button', { type: 'button', 'aria-label': 'Open account menu' }) },
    '@/hooks/use-auth': { useAuth: () => ({ user: { id: 'u-1', email: 'u@example.test' } }) },
  }
}
const ROUTES = { '/builder': 'studio', '/dashboard': 'decks', '/studio/templates': 'templates', '/studio/themes': 'themes', '/knowledge': 'more', '/studio/intelligence': 'more', '/studio/details': 'more', '/settings': 'more' }
const CASCADE_ROUTES = ['/builder', '/dashboard', '/studio/templates', '/studio/themes', '/knowledge'] // one per tab, and a page under More
const TABS = ['studio', 'decks', 'templates', 'themes', 'more']
const navCache = new Map()
function renderNav(pathname, { plainLabels = false, text = read(BAR) } = {}) {
  const key = `${pathname}\0${plainLabels}\0${text}`
  if (!navCache.has(key)) navCache.set(key, renderNavNow(pathname, plainLabels, text))
  return navCache.get(key)
}
function renderNavNow(pathname, plainLabels, text) {
  const env = { [FLAG]: 'true', [SHELL]: 'true', ...(plainLabels ? { NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS: 'true' } : {}) }
  const { StudioPhoneTabBar } = load(BAR, { env, stubs: barStubs(pathname), text })
  const html = renderToStaticMarkup(h(StudioPhoneTabBar, {}))
  return html.slice(0, html.indexOf('<div data-portal')) + '</nav>' // the portal (the More sheet) is rendered inside the nav by the stub; the bar is what comes before it
}
const ICON_TAG = '<svg aria-hidden="true"></svg>'
/** The shell root with a rail, the bar (or none), the page column and card, and a More sheet portalled to the body: decoys with the same attributes the bar's rules look at. */
function pageHtml(bar, theme) {
  const body = `<div data-studio-v4-shell="true"><aside data-studio-v4-rail="true"><a class="studio-rail-brand" href="/">${ICON_TAG}</a><nav><a href="/builder" aria-current="page">${ICON_TAG}</a><a href="/dashboard">${ICON_TAG}<span>Decks</span></a><button type="button">${ICON_TAG}</button></nav><div class="studio-rail-profile"><button type="button"><span>Me</span></button></div></aside>${bar}<div data-studio-v4-shell-column="true"><header data-studio-v4-shell-header="true"><div><span>Title</span><nav aria-label="Breadcrumb"><a href="/" aria-current="page"><span>Home</span></a></nav></div></header><main data-studio-v4-shell-workspace="true"><span>Card</span><button type="button" aria-current="page">${ICON_TAG}<span>Selected</span></button><a href="/x">${ICON_TAG}<span>Link</span></a></main></div></div><div data-studio-v4-shell="true" data-studio-phone-more="true" role="dialog"><ul><li><a href="/knowledge" aria-current="page">${ICON_TAG}<span>Knowledge</span></a></li><li><a href="/help">${ICON_TAG}<span>Help</span></a></li></ul></div>`
  return theme === 'dark' ? `<div class="dark">${body}</div>` : `<div>${body}</div>`
}
const findBar = top => walkEls(top).find(el => el.tag === 'nav' && el.attrs['data-studio-phone-tabbar'] === 'true')
const tabsOf = nav => nav.children.filter(c => typeof c !== 'string')

// ---------------------------------------------------------------- shared helpers for the sections
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const lum = hex => { assert.match(hex, /^#[0-9a-f]{6}$/i, `${hex} is an opaque six-digit colour`); const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const px = (value, safe = 0) => { const v = String(value).replace(/env\(safe-area-inset-bottom, 0px\)/g, `${safe}px`); const sum = /^calc\(([\d.]+)px \+ ([\d.]+)px\)$/.exec(v); return sum ? Number(sum[1]) + Number(sum[2]) : parseFloat(v) }
const clipped = s => s.position === 'absolute' && s.width === '1px' && s.height === '1px' && s.overflow === 'hidden' && s.clip === 'rect(0 0 0 0)' && s['clip-path'] === 'inset(50%)' && s['margin-top'] === '-1px'
const hiddenByCss = s => s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse'
const LAYOUT_PROPS = ['flex', 'min-width', 'min-height', 'width', 'height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-left', 'display', 'flex-direction', 'align-items', 'justify-content', 'gap', 'border-radius', 'font-size', 'line-height']

/** One state of the bar: theme x route, with the styles of the bar, each tab and each name under the given sheets. */
function barState({ theme, route, plainLabels = false, sheets, width = 375, text = read(BAR) }) {
  const top = parseHtml(pageHtml(renderNav(route, { plainLabels, text }), theme))
  const nav = findBar(top), colors = palette(theme), ctx = { width, colors }
  const styleOf = el => resolve(el, sheets, ctx)
  const tabs = tabsOf(nav).map(el => {
    const span = el.children.find(c => typeof c !== 'string' && c.tag === 'span'), icon = el.children.find(c => typeof c !== 'string' && c.tag === 'svg')
    assert.ok(span && icon, `the ${el.attrs['data-studio-phone-tab']} tab has an icon and a name in its markup`)
    return { el, tab: el.attrs['data-studio-phone-tab'], current: el.attrs['aria-current'] === 'page', style: styleOf(el), span, spanStyle: styleOf(span), icon, iconStyle: styleOf(icon) }
  })
  const name = t => (t.el.attrs['aria-label'] ? t.el.attrs['aria-label'] : hiddenByCss(t.spanStyle) ? '' : textOf(t.span).trim())
  return { top, nav, navStyle: styleOf(nav), tabs, names: tabs.map(name), styleOf, palette: colors }
}
const sheetsOf = (cssText, pr1Text, order = 'later') => {
  const pr1 = sheet(pr1Text), mine = sheet(cssText, { strict: true })
  return order === 'later' ? [pr1, mine] : [mine, pr1]
}

const rail = () => sheet(read(SHELL_CSS)).find(r => r.selectors.includes('[data-studio-v4-rail] nav [aria-current="page"]')) // the desktop rail's selected item, read from the rail (not copied)

// ---------------------------------------------------------------- 1. the stylesheet
function proveCss(text, at = '') {
  const a = message => (at ? `${at}: stylesheet: ${message}` : `stylesheet: ${message}`)
  const rules = sheet(text, { strict: true })
  nomatch(text, /!important/, a('no !important'))
  nomatch(text, /@import|url\(|@(?!media)/, a('no import, no url(), no at-rule but the one phone query'))
  const atRules = []; postcss.parse(text).walkAtRules(r => atRules.push(`${r.name} ${r.params}`))
  deep(atRules, [`media ${PHONE}`], a('one at-rule: the phone query'))
  deep(rules.filter(r => r.media === null).map(r => r.selector), [], a('no rule outside the phone query: nothing here can match at 641 px and wider'))
  ok(rules.length > 0 && rules.every(r => r.media === `media ${PHONE}` && !r.nested), a('every rule is inside @media (max-width: 640px), one level deep'))
  const kinds = { bar: new Set(), current: new Set(), name: new Set(), other: new Set() }
  for (const r of rules) for (const s of r.selectors) {
    ok(s.includes(BARSEL), a(`${s}: needs the bar, which exists only with the flag`))
    match(s, /^(\.dark )?\[data-studio-v4-shell="true"\] > nav\[data-studio-phone-tabbar="true"\]( > .+)?$/, a(`${s}: the bar is a direct child of the shell root, and the selector is one step above phone shell 1's (nav[...])`))
    nomatch(s, /rail|workspace|column|header|phone-more|settings|billing|publish|admin|help|:hover|:focus|:has|::/, a(`${s}: not the rail, the card, the page, the More sheet or a FRONTEND-1 area; no state, no pseudo-element`))
    const kind = /> span$/.test(s) ? 'name' : / > \[aria-current="page"\]$/.test(s) ? 'current' : /nav\[data-studio-phone-tabbar="true"\]$/.test(s) ? 'bar' : 'other'
    for (const d of r.decls) kinds[kind].add(d.prop)
  }
  deep([...kinds.bar].sort(), ['background', 'border-top', 'padding-top'], a('the bar: its colour, its top line and one px of top padding, nothing else (its height, its safe-area padding, its position stay)'))
  deep([...kinds.current].sort(), ['background', 'box-shadow', 'color'], a('the selected tab: the tile and the teal, nothing that sizes it'))
  deep([...kinds.name].sort(), ['border', 'clip', 'clip-path', 'height', 'margin', 'overflow', 'padding', 'position', 'white-space', 'width'], a('a name: the visually-hidden technique and nothing else'))
  deep([...kinds.other], [], a('no rule for anything but the bar, the selected tab and the unselected names'))
  const declText = rules.flatMap(r => r.decls.map(d => `${d.prop}: ${d.value}`)).join('\n')
  nomatch(declText, /display\s*:|visibility\s*:|opacity\s*:|font-size\s*:|content-visibility|text-indent|backdrop-filter|transparent|min-width|min-height|\bflex\b|\bgap\b/, a('no declaration that takes a name out of the accessibility tree, makes the bar see-through or sizes a tab'))
  nomatch(declText, /#[0-9a-f]{3,8}\b/i, a('every colour is a token of the shell (no copied hex value)'))
  const only = test => rules.filter(r => r.selectors.length === 1 && test(r.selectors[0]))
  const declOf = (rule, prop) => rule?.decls.find(d => d.prop === prop)?.value
  const [frame] = only(s => s.endsWith(`nav${BARSEL}`)), [light] = only(s => !s.startsWith('.dark ') && / > \[aria-current="page"\]$/.test(s)), [dark] = only(s => s.startsWith('.dark ') && / > \[aria-current="page"\]$/.test(s))
  eq(declOf(frame, 'background'), 'var(--ss-frame)', a('the bar takes the frame colour (the token, not a copy)'))
  eq(declOf(frame, 'border-top'), '0', a('and has no top line'))
  eq(declOf(frame, 'padding-top'), '5px', a('and one px more top padding than phone shell 1\'s 4 px, in place of the 1 px line'))
  for (const prop of ['background', 'color', 'box-shadow']) eq(declOf(light, prop), rail()?.decls.find(d => d.prop === prop)?.value, a(`the selected tab's ${prop} is the desktop rail's selected item's, as written`))
  deep(dark?.decls.map(d => [d.prop, d.value]), [['background', 'var(--ss-soft)'], ['box-shadow', 'inset 0 0 0 1px var(--ss-line)']], a('in the dark theme: the --ss-soft tile with a --ss-line ring, both tokens of the shell\'s own dark palette'))
  eq(rules.filter(r => r.selectors.some(s => s.startsWith('.dark '))).length, 1, a('and the dark theme has no other rule'))
}

// ---------------------------------------------------------------- 2-5. the cascade: the bar, the tile, the names, the targets, the contrast
function proveCascade(cssText, pr1Text, at = '') {
  const a = (area, message) => (at ? `${at}: ${area}: ${message}` : `${area}: ${message}`)
  const without = [sheet(pr1Text)], later = sheetsOf(cssText, pr1Text), earlier = sheetsOf(cssText, pr1Text, 'earlier')
  const numbers = { contrast: {}, cells: {}, tile: {} }
  // the rail's selected item, read from the rail (not copied): the light tile is its panel, teal and soft shadow
  const railDecl = prop => rail()?.decls.find(d => d.prop === prop)?.value
  for (const theme of ['light', 'dark']) {
    const states = [...CASCADE_ROUTES.map(route => ({ route, plainLabels: false })), { route: '/dashboard', plainLabels: true }]
    for (const { route, plainLabels } of states) {
      const here = message => a('cascade', `${theme} ${route}${plainLabels ? ' (plain labels)' : ''}: ${message}`)
      const s = barState({ theme, route, plainLabels, sheets: later }), p = s.palette
      const base = barState({ theme, route, plainLabels, sheets: without }), swapped = barState({ theme, route, plainLabels, sheets: earlier })
      const everything = state => JSON.stringify([state.navStyle, ...state.tabs.flatMap(t => [t.style, t.spanStyle, t.iconStyle])])
      eq(everything(swapped), everything(s), here('the order of the two sheets does not matter (this sheet is one specificity step above phone shell 1\'s)'))
      deep(s.tabs.map(t => t.tab), TABS, here('four tabs and More, in PK\'s order'))
      // the bar
      eq(s.navStyle['background-color'], p['--ss-frame'], here('the bar is the frame\'s colour'))
      match(s.navStyle['background-color'], /^#[0-9a-f]{6}$/i, here('opaque: a plain six-digit colour, no alpha, so the content never shows through the fixed bar'))
      for (const prop of ['opacity', 'backdrop-filter', 'mix-blend-mode', 'filter']) eq(s.navStyle[prop], undefined, here(`the bar has no ${prop}`))
      deep([s.navStyle['border-top-width'], s.navStyle['border-top-style']], ['0', 'none'], here('no top line'))
      for (const prop of ['height', 'padding-bottom', 'padding-left', 'padding-right', 'position', 'bottom', 'left', 'right', 'z-index', 'display', 'justify-content', 'gap', 'color']) eq(s.navStyle[prop], base.navStyle[prop], here(`the bar's ${prop} is phone shell 1's (${base.navStyle[prop]})`))
      eq(s.navStyle['padding-bottom'], 'env(safe-area-inset-bottom, 0px)', here('the safe-area padding is left as it is'))
      eq(s.navStyle['padding-top'], '5px', here('one px of top padding stands in for the line'))
      // the tabs
      deep(s.tabs.filter(t => t.current).map(t => t.tab), [ROUTES[route]], here(`${ROUTES[route]} is the current tab, and only it`))
      for (const t of s.tabs) {
        const bt = base.tabs.find(x => x.tab === t.tab)
        if (t.current) {
          eq(t.style['background-color'], theme === 'dark' ? p['--ss-soft'] : p['--ss-panel'], here(`${t.tab}: the selected tile is ${theme === 'dark' ? '--ss-soft' : 'the panel'}`))
          eq(t.style.color, p['--ss-teal'], here(`${t.tab}: its icon and name are the rail's teal`))
          eq(t.style['border-radius'], '10px', here(`${t.tab}: radius 10 px (phone shell 1's)`))
          eq(t.style['font-weight'], '600', here(`${t.tab}: semibold`))
          if (theme === 'light') {
            eq(rail()?.decls.find(d => d.prop === 'background')?.value, 'var(--ss-panel)', here('(the rail\'s selected item: a panel tile)'))
            eq(t.style['box-shadow'], railDecl('box-shadow'), here(`${t.tab}: the rail's soft shadow, exactly`))
            eq(railDecl('color'), 'var(--ss-teal)', here('(the rail\'s selected item: teal)'))
          } else eq(t.style['box-shadow'], `inset 0 0 0 1px ${p['--ss-line']}`, here(`${t.tab}: the dark tile has a ring in the shell's own hairline colour`))
        } else {
          eq(t.style['background-color'], 'transparent', here(`${t.tab}: an unselected tab has no tile`))
          eq(t.style.color, p['--ss-muted'], here(`${t.tab}: its icon is muted`))
          eq(t.style['box-shadow'], undefined, here(`${t.tab}: no shadow`))
          deep([t.style, t.iconStyle], [bt.style, bt.iconStyle], here(`${t.tab}: an unselected tab and its icon are phone shell 1's`))
        }
        for (const prop of LAYOUT_PROPS) eq(t.style[prop], bt.style[prop], here(`${t.tab}: ${prop} is phone shell 1's (${bt.style[prop]})`))
        deep(t.iconStyle, bt.iconStyle, here(`${t.tab}: the icon is phone shell 1's (visible, 20 px)`))
        eq(t.iconStyle.display, undefined, here(`${t.tab}: the icon is not hidden`))
        deep([t.style.display, t.style['flex-direction'], t.style['align-items'], t.style['justify-content']], ['flex', 'column', 'center', 'center'], here(`${t.tab}: centred in its cell`))
      }
      // equal cells: nothing in a tab's size depends on the tab or on its state
      const sig = t => JSON.stringify(LAYOUT_PROPS.map(prop => t.style[prop]))
      eq(new Set(s.tabs.map(sig)).size, 1, here('equal cells: all five tabs have the same size rules'))
      // the names
      deep(s.tabs.filter(t => !clipped(t.spanStyle) && !hiddenByCss(t.spanStyle)).map(t => t.tab), [ROUTES[route]], here('exactly the current tab shows its name'))
      for (const t of s.tabs) {
        if (t.current) {
          ok(!clipped(t.spanStyle), here(`${t.tab}: the current name is not clipped`))
          deep([t.spanStyle.position, t.spanStyle.clip, t.spanStyle['clip-path'], t.spanStyle.width, t.spanStyle.height, t.spanStyle['margin-top']], [undefined, undefined, undefined, undefined, undefined, undefined], here(`${t.tab}: and none of the technique reaches it`))
        } else {
          ok(clipped(t.spanStyle), here(`${t.tab}: the name is clipped to 1 px (position, 1 x 1, overflow, clip, clip-path, -1 px margin)`))
          eq(t.spanStyle['white-space'], 'nowrap', here(`${t.tab}: the clipped name does not wrap`))
        }
        for (const prop of ['display', 'visibility', 'opacity', 'font-size', 'content-visibility', 'text-indent']) eq(t.spanStyle[prop], undefined, here(`${t.tab}: the name has no ${prop} (it stays in the accessibility tree)`))
      }
      const want = plainLabels ? ['Studio', 'Your decks', 'Templates', 'Themes & brand', 'More'] : ['Studio', 'Decks', 'Templates', 'Themes & brand', 'More']
      deep(s.names, want, here('all five tabs keep their accessible name (Themes its aria-label)'))
      ok(s.tabs.every(t => !hiddenByCss(t.spanStyle)), here('no name is removed from the accessibility tree'))
      if (ROUTES[route] === 'more') ok(!clipped(s.tabs[4].spanStyle) && textOf(s.tabs[4].span) === 'More', here('on a page under More, "More" shows its name'))
      // targets
      for (const t of s.tabs) {
        ok(px(t.style['min-width']) >= 44 && px(t.style['min-height']) >= 48, here(`${t.tab}: at least 44 x 48 px (${t.style['min-width']} x ${t.style['min-height']})`))
        eq(t.style['flex'], '1 1 0', here(`${t.tab}: an equal share of the bar`))
      }
      if (theme === 'light' && route === '/builder') {
        for (const vw of [320, 360, 375, 390, 414, 430]) {
          const cell = (vw - px(s.navStyle['padding-left']) - px(s.navStyle['padding-right']) - 4 * px(s.navStyle.gap)) / 5
          ok(cell >= 44, here(`a cell is ${cell} px wide at ${vw} px (>= 44)`))
          numbers.cells[vw] = cell
        }
        for (const safe of [0, 34]) {
          const tile = px(s.navStyle.height, safe) - px(s.navStyle['padding-top']) - px(s.navStyle['padding-bottom'], safe) - px(s.navStyle['border-top-width'])
          const was = px(base.navStyle.height, safe) - px(base.navStyle['padding-top']) - px(base.navStyle['padding-bottom'], safe) - px(base.navStyle['border-top-width'])
          eq(tile, was, here(`the tabs' height is the base's with a ${safe} px safe area (${was} px)`))
          ok(tile >= 48, here(`and at least 48 px (${tile})`))
          numbers.tile[safe] = tile
        }
        eq(px(s.navStyle.height, 34), px(base.navStyle.height, 34), here('the bar\'s own height is unchanged'))
      }
      // contrast
      const cur = s.tabs.find(t => t.current), muted = s.tabs.find(t => !t.current)
      const frame = s.navStyle['background-color']
      const iconOnFrame = contrast(muted.style.color, frame), nameOnTile = contrast(cur.style.color, cur.style['background-color'])
      ok(iconOnFrame >= 3, here(`muted icons on the frame: ${iconOnFrame.toFixed(2)} : 1 (>= 3)`))
      ok(nameOnTile >= 4.5, here(`the selected name on its tile: ${nameOnTile.toFixed(2)} : 1 (>= 4.5)`))
      numbers.contrast[theme] = { iconOnFrame, nameOnTile }
    }
  }
  // the dark tile: visibly lifted off the frame the way the light tile is, with a ring; the plain panel tile would not be
  const L = barState({ theme: 'light', route: '/builder', sheets: later }), D = barState({ theme: 'dark', route: '/builder', sheets: later })
  const lift = state => contrast(state.tabs[0].style['background-color'], state.navStyle['background-color'])
  const ring = contrast(D.palette['--ss-line'], D.navStyle['background-color']), plainPanel = contrast(D.palette['--ss-panel'], D.navStyle['background-color'])
  ok(plainPanel < 1.05, a('dark', `(--ss-panel on the frame would be ${plainPanel.toFixed(2)} : 1, a tile that vanishes)`))
  ok(D.tabs[0].style['background-color'] !== D.palette['--ss-panel'] && D.tabs[0].style['background-color'] !== D.navStyle['background-color'], a('dark', 'the dark tile is neither the panel nor the frame'))
  ok(lift(D) >= lift(L) - 0.03 && lift(D) >= 1.14, a('dark', `the dark tile is lifted off the frame ${lift(D).toFixed(2)} : 1, as the light tile's ${lift(L).toFixed(2)} : 1`))
  ok(ring >= 1.4, a('dark', `and its ring reads against the frame ${ring.toFixed(2)} : 1 (>= 1.4)`))
  ok(contrast(D.palette['--ss-teal'], D.navStyle['background-color']) >= 3, a('dark', 'the teal icon reads against the frame (>= 3 : 1)'))
  numbers.contrast.lift = { light: lift(L), dark: lift(D), ring, plainPanel }
  return numbers
}

// ---------------------------------------------------------------- 6. flag off and wide screens: the same styles with and without this sheet; the render is the base's
function proveIdentity(cssText, pr1Text, at = '') {
  const a = message => (at ? `${at}: identity: ${message}` : `identity: ${message}`)
  const mine = sheet(cssText, { strict: true }), withMine = [sheet(pr1Text), mine], withoutMine = [sheet(pr1Text)]
  const digest = { with: [], without: [], elements: 0 }
  const bar = renderNav('/builder')
  for (const theme of ['light', 'dark']) for (const [label, html] of [['flag off: no bar', ''], ['bar', bar]]) for (const width of [375, 641, 768, 1024, 1440]) {
    if (html !== '' && width <= 640) continue // below: the sheet is meant to apply, section 2
    const top = parseHtml(pageHtml(html, theme)), els = walkEls(top), ctx = { width, colors: palette(theme) }
    const a1 = els.map(el => resolve(el, withMine, ctx)), a2 = els.map(el => resolve(el, withoutMine, ctx))
    deep(a1, a2, a(`${theme}, ${label}, ${width} px: every element resolves to the same style with and without this sheet`))
    digest.with.push(JSON.stringify(a1)); digest.without.push(JSON.stringify(a2)); digest.elements += els.length
  }
  // the rules are live (so the identity above is not an empty claim) and reach the bar's own elements only
  const top = parseHtml(pageHtml(bar, 'dark')), els = walkEls(top), nav = findBar(top), noBar = walkEls(parseHtml(pageHtml('', 'dark')))
  const inBar = el => el.parent === nav || el === nav || el.parent?.parent === nav
  mine.forEach(rule => rule.parsed.forEach((sel, i) => {
    const hits = els.filter(el => matchComplex(el, sel))
    ok(hits.length > 0, a(`${rule.selectors[i]} matches the bar's elements when the bar is there (dark)`))
    ok(hits.every(inBar), a(`${rule.selectors[i]} matches the bar, a tab or a name only`))
    eq(noBar.filter(el => matchComplex(el, sel)).length, 0, a(`${rule.selectors[i]} matches nothing without the bar (flag off): not the rail, the card, the page or the More sheet`))
  }))
  const lightEls = walkEls(parseHtml(pageHtml(bar, 'light')))
  const darkRule = mine.find(r => r.selectors.some(s => s.startsWith('.dark ')))
  eq(lightEls.filter(el => darkRule.parsed.some(sel => matchComplex(el, sel))).length, 0, a('the dark tile rule matches nothing in the light theme'))
  // the render of the bar: this change's component against the base's, in every state
  const own = [], was = []
  for (const route of Object.keys(ROUTES)) for (const plainLabels of [false, true]) {
    own.push(renderNav(route, { plainLabels })); was.push(renderNav(route, { plainLabels, text: baseOf(BAR) }))
  }
  deep(own, was, a('the bar renders the base\'s markup in every state (8 routes, both label sets): no markup changed'))
  digest.render = { own: sha(own.join('\n')), base: sha(was.join('\n')), states: own.length }
  eq(digest.render.own, digest.render.base, a(`sha256 over the ${own.length} renders is the base's`))
  return { states: digest.with.length, elements: digest.elements, with: sha(digest.with.join('\n')), without: sha(digest.without.join('\n')), render: digest.render }
}

// ---------------------------------------------------------------- 7. the change: strip, import, registry, files left alone, scope, secret scan
function proveStrip(stripFn, at = '') {
  const a = message => (at ? `${at}: strip: ${message}` : `strip: ${message}`)
  const own = read(BAR)
  eq(stripFn('lib/other.ts', 'x // PHONE-TABBAR-FRAME'), 'x // PHONE-TABBAR-FRAME', a('any other file is returned as it is'))
  eq(stripFn('app/builder/page.tsx', 'a // PHONE-TABBAR-FRAME\nb'), 'a // PHONE-TABBAR-FRAME\nb', a('the Builder page is not this change\'s to strip'))
  eq(stripFn(BAR, 'a\nb // PHONE-TABBAR-FRAME (x): y\nc\n'), 'a\nc\n', a('a marked line goes, every other byte stays (trailing newline too)'))
  const keep = 'a\nb // PHONE-SHELL-NAV\nc // PHONE-TABBAR-FRAMEX\nd // XPHONE-TABBAR-FRAME\ne // PHONE-TABBAR-FRAME-2\nf // PHONE-SHELL-TOP\n'
  eq(stripFn(BAR, keep), keep, a('only this change\'s marker, as a whole token, takes a line out: phone shell 1 and 2\'s lines and every other change\'s stay'))
  eq(stripFn(BAR, 7), 7, a('a non-string comes back'))
  deep(TABBAR_FRAME_FILES, [BAR], a('the strip takes a line out of the bar\'s component only'))
  eq(sha(stripFn(BAR, own)), sha(baseOf(BAR)), a('the bar\'s component without this change\'s line is the base commit\'s file, byte for byte'))
  eq(sha(stripFn(BAR, stripFn(BAR, own))), sha(stripFn(BAR, own)), a('stripping twice changes nothing more'))
  eq(sha(stripLaterChanges(BAR, own)), sha(stripLaterChanges(BAR, baseOf(BAR))), a('and through the registry (innermost, as phone shell 1 and 2\'s proofs read it) it is the base commit\'s file'))
}
const sourceCache = new Map()
const sourceFiles = () => {
  if (!sourceCache.size) for (const dir of ['app', 'components', 'hooks', 'lib']) for (const name of fs.readdirSync(path.join(root, dir), { recursive: true })) {
    const rel = `${dir}/${name}`
    if (/\.(tsx?|css)$/.test(rel)) sourceCache.set(rel, fs.readFileSync(path.join(root, rel), 'utf8'))
  }
  return [...sourceCache.keys()]
}
function proveImport(at = '') {
  const a = message => (at ? `${at}: import: ${message}` : `import: ${message}`)
  const lines = read(BAR).split('\n'), mine = lines.filter(marked)
  deep(lines.filter(line => !marked(line)), baseOf(BAR).split('\n'), a('every base line of the bar\'s component is there, in order, none changed'))
  eq(mine.length, 1, a('exactly one line is this change\'s'))
  match(mine[0] ?? '', IMPORT_RE, a('it is the stylesheet\'s import, with the flag in its comment'))
  eq(lines[lines.indexOf(mine[0]) - 1], BAR_BASE_IMPORT, a('right after phone shell 1\'s stylesheet import (this sheet is the later one)'))
  nomatch((mine[0] ?? '').replace(/\/\/.*$/, ''), /process\.env/, a('the line reads no environment'))
  nomatch(read(CSS), /@import/, a('the stylesheet imports nothing'))
  const importers = sourceFiles().filter(rel => /studio-tabbar-frame\.css/.test(rel in overrides ? overrides[rel] : sourceCache.get(rel))).sort()
  deep(importers, [BAR], a('only the bar\'s component imports the sheet'))
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: registry: ${message}` : `registry: ${message}`)
  const lines = registryText.split('\n').filter(line => line.includes("'./studio-tabbar-frame-strip.mjs'"))
  eq(lines.length, 2, a('exactly two lines for this change: its files and its strip (no .env.example block: the flag\'s block is phone shell 1\'s)'))
  ok(lines.every(line => line.endsWith("// LATER-CHANGE: FRONTEND-2, phone tab bar on the frame, the name on the selected tab only (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)")), a('each carries the LATER-CHANGE marker'))
  match(lines[0] ?? '', /^ {2}\.\.\.\(await import\('\.\/studio-tabbar-frame-strip\.mjs'\)\)\.TABBAR_FRAME_SCOPE_FILES,/, a('line 1: the files'))
  match(lines[1] ?? '', /^ {2}\(await import\('\.\/studio-tabbar-frame-strip\.mjs'\)\)\.stripTabbarFrame,/, a('line 2: the strip'))
  const at1 = registryText.indexOf(lines[0]), at2 = registryText.indexOf(lines[1])
  const files = registryText.indexOf('export const LATER_CHANGE_FILES'), blocks = registryText.indexOf('export const LATER_ENV_BLOCKS'), strips = registryText.indexOf('export const LATER_STRIPS')
  ok(files < at1 && at1 < blocks && strips < at2, a('each in its list (the files, the strips; none in the env blocks)'))
  const speedFiles = registryText.indexOf("'./studio-speed-perceived-strip.mjs')).SPEED_PERCEIVED_SCOPE_FILES"), speedStrip = registryText.indexOf("'./studio-speed-perceived-strip.mjs')).stripSpeedPerceived")
  ok(speedFiles > 0 && speedFiles < at1 && speedStrip > 0 && speedStrip < at2, a('each comes after the last change before it in the same list (a union on merge keeps all)'))
  ok(LATER_STRIPS.includes(stripTabbarFrame), a('the registry holds the strip'))
  ok([...TABBAR_FRAME_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('the registry names every file of this change'))
  ok(LATER_ENV_BLOCKS.every(block => !String(block).includes('PHONE-TABBAR-FRAME')), a('and no .env.example block'))
  eq(sha(read(ENV)), sha(baseOf(ENV)), a('.env.example is the base commit\'s, byte for byte (the flag is phone shell 1\'s, already there)'))
  match(read(ENV), /^NEXT_PUBLIC_STUDIO_PHONE_SHELL="false"$/m, a('(the flag\'s block is there, default "false")'))
}
function proveUntouched(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of [PR1_CSS, 'lib/studio-phone-shell.ts', 'components/layout/studio-rail.tsx', 'components/layout/app-header.tsx', SHELL_CSS, 'components/layout/studio-p2-shell.css', 'app/(app)/layout.tsx', 'app/builder/page.tsx',
    'scripts/test-studio-phone-shell-nav.mjs', 'scripts/test-studio-phone-shell-builder-top.mjs', 'scripts/studio-phone-shell-nav-strip.mjs', 'scripts/studio-phone-shell-builder-top-strip.mjs'])
    eq(sha(read(rel)), sha(baseOf(rel)), a(`${rel} is the base commit's, byte for byte (phone shell 1's sheet and proof, the rail, the card's shell, the pages)`))
}
const committedFiles = () => git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean)
const committedSubjects = () => git('log', '--no-merges', '--format=%s', `${BASE}..HEAD`).split('\n').filter(Boolean)
function proveScope(committed = committedFiles(), subjects = committedSubjects(), at = '') {
  const a = message => (at ? `${at}: scope: ${message}` : `scope: ${message}`)
  ok([...TABBAR_FRAME_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
  eq(TABBAR_FRAME_SCOPE_FILES.size, TABBAR_FRAME_FILES.length + TABBAR_FRAME_NEW_FILES.length + TABBAR_FRAME_OWN_EDITS.length, a('the lists do not overlap'))
  deep(TABBAR_FRAME_NEW_FILES.filter(rel => /phone-shell|phone-tab/.test(rel)), [], a('no new file name has "phone-shell" or "phone-tab" in it (phone shell 1\'s proof counts those as its own)'))
  for (const rel of TABBAR_FRAME_SCOPE_FILES) nomatch(rel, /^components\/layout\/(studio-rail|app-header)\.tsx$|^components\/user-profile-menu|test-studio-p2-|launch-wording|env-append-tolerant|^app\/\(app\)\/settings|^components\/settings|publish|^app\/admin|docs|\.env/, a(`${rel}: not the rail, the account header, the account menu or a FRONTEND-1 file`))
  deep(committed.filter(rel => !TABBAR_FRAME_SCOPE_FILES.has(rel)), [], a(`every file in this change's committed diff (${BASE.slice(0, 8)}..HEAD) is its own`))
  deep(subjects.filter(subject => !TABBAR_FRAME_COMMIT_SUBJECT.test(subject)), [], a('and every commit in it is this change\'s ("Phone tab bar frame: ...")'))
  if (committed.length) {
    deep([...TABBAR_FRAME_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    deep(committed.filter(rel => /^(app|components|lib|hooks)\//.test(rel)).sort(), [BAR, CSS].sort(), a('the app files: the bar\'s component (one marked line) and the new sheet'))
    deep(committed.filter(rel => /^scripts\/test-/.test(rel)), [THIS_TEST], a('the tests it adds or edits: its own, and no older test is edited'))
  }
}
function proveSecretScan(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [CSS, STRIP_MODULE, THIS_TEST].map(read).concat(read(BAR).split('\n').filter(marked)).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
  nomatch(added, /(?:secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no quoted literal assigned to a credential-shaped name (the thumbnail proof\'s names)'))
  nomatch(added, /eyJ[A-Za-z0-9_-]{10,}\.|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|Bearer [A-Za-z0-9._-]{20,}/, a('no token, key or bearer string'))
}

// ---------------------------------------------------------------- run everything
function proveAll(stripFn = stripTabbarFrame, at = '') {
  proveCss(read(CSS), at)
  const numbers = proveCascade(read(CSS), read(PR1_CSS), at)
  const identity = proveIdentity(read(CSS), read(PR1_CSS), at)
  proveStrip(stripFn, at)
  proveImport(at)
  proveRegistry(read(REGISTRY), at)
  proveUntouched(at)
  proveScope(undefined, undefined, at)
  proveSecretScan(at)
  return { numbers, identity }
}
const { numbers, identity } = proveAll()
const f2 = n => n.toFixed(2)
console.log(`contrast (computed from the shell's tokens): muted icon on the frame light ${f2(numbers.contrast.light.iconOnFrame)} / dark ${f2(numbers.contrast.dark.iconOnFrame)} (>= 3); selected name on its tile light ${f2(numbers.contrast.light.nameOnTile)} / dark ${f2(numbers.contrast.dark.nameOnTile)} (>= 4.5)`)
console.log(`dark tile: --ss-soft ${f2(numbers.contrast.lift.dark)} : 1 above the frame (the light tile ${f2(numbers.contrast.lift.light)} : 1), ring --ss-line ${f2(numbers.contrast.lift.ring)} : 1; a plain --ss-panel tile would be ${f2(numbers.contrast.lift.plainPanel)} : 1`)
console.log(`targets: 44 x 48 px minimum on every tab; a cell is ${numbers.cells[320]} px wide at 320 px and ${numbers.cells[375]} px at 375 px; the tabs are ${numbers.tile[0]} px tall with or without the safe area (the base's)`)
console.log(`flag off / wide screens: ${identity.elements} element styles over ${identity.states} states, sha256 with ${identity.with.slice(0, 16)} == without ${identity.without.slice(0, 16)}; the bar's ${identity.render.states} renders, sha256 ${identity.render.own.slice(0, 16)} == base ${identity.render.base.slice(0, 16)}`)
console.log(`PASS stylesheet, cascade, names, targets, contrast, identity, change: ${checks} checks`)

// =========================================================== 8. mutants
const killed = [], survived = []
async function mutant(name, edits, { strip = stripTabbarFrame, scope = null } = {}) {
  const before = overrides
  try {
    overrides = { ...before }
    for (const [rel, from, to, mode] of edits) {
      const source = read(rel), n = source.split(from).length - 1
      assert.ok(mode ? n >= 1 : n === 1, `mutant "${name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = mode === 'all' ? source.split(from).join(to) : source.replace(from, () => to)
    }
    proveAll(strip, name)
    if (scope) proveScope(scope.files, scope.subjects ?? [], name)
  } catch (error) {
    if (/no longer applies/.test(String(error.message))) throw error
    killed.push(name); if (process.env.TABBAR_FRAME_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
const css = (from, to, mode) => [CSS, from, to, mode], bar = (from, to, mode) => [BAR, from, to, mode]
const HIDE = 'position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap;'
const LIGHT_TILE = '> [aria-current="page"] { background: var(--ss-panel); color: var(--ss-teal); box-shadow: 0 1px 4px rgb(36 52 56 / 8%); }'
const DARK_TILE = '.dark [data-studio-v4-shell="true"] > nav[data-studio-phone-tabbar="true"] > [aria-current="page"] { background: var(--ss-soft); box-shadow: inset 0 0 0 1px var(--ss-line); }'
const NAME_RULE = '> :is(a, button):not([aria-current="page"]) > span'
const IMPORT_LINE = read(BAR).split('\n').find(marked)
const SELECTOR = '[data-studio-v4-shell="true"] > nav[data-studio-phone-tabbar="true"]'
// the bar
await mutant('css: the bar is the panel colour', [css('background: var(--ss-frame); }', 'background: var(--ss-panel); }')])
await mutant('css: the bar is see-through', [css('background: var(--ss-frame); }', 'background: transparent; }')])
await mutant('css: the bar is translucent', [css('background: var(--ss-frame); }', 'background: rgb(232 240 237 / 80%); }')])
await mutant('css: the bar has a blur behind it', [css('background: var(--ss-frame); }', 'background: var(--ss-frame); backdrop-filter: blur(8px); }')])
await mutant('css: the bar is faded', [css('background: var(--ss-frame); }', 'background: var(--ss-frame); opacity: .9; }')])
await mutant('css: the bar is a copied colour, not the token', [css('background: var(--ss-frame); }', 'background: #e8f0ed; }')])
await mutant('css: the top line stays', [css('border-top: 0;', 'border-top: 1px solid var(--ss-line);')])
await mutant('css: the top line rule is gone', [css(' border-top: 0;', '')])
await mutant('css: no top padding in place of the line (the tabs grow by 1 px)', [css('padding-top: 5px;', 'padding-top: 4px;')])
await mutant('css: the safe-area padding is dropped', [css('padding-top: 5px;', 'padding-top: 5px; padding-bottom: 0;')])
await mutant('css: the bar is taller', [css('padding-top: 5px;', 'padding-top: 5px; height: 60px;')])
await mutant('css: the bar is not fixed any more', [css('padding-top: 5px;', 'padding-top: 5px; position: sticky;')])
// the selected tile
await mutant('css: the selected tab stays in the accent', [css('color: var(--ss-teal);', 'color: var(--ss-accent);')])
await mutant('css: the selected tile is the soft accent', [css('{ background: var(--ss-panel); color', '{ background: var(--ss-accent-soft); color')])
await mutant('css: no soft shadow', [css(' box-shadow: 0 1px 4px rgb(36 52 56 / 8%); }', ' }')])
await mutant('css: another shadow than the rail\'s', [css('0 1px 4px rgb(36 52 56 / 8%)', '0 2px 8px rgb(36 52 56 / 20%)')])
await mutant('css: the dark tile is the panel (it vanishes)', [css('background: var(--ss-soft); box-shadow', 'background: var(--ss-panel); box-shadow')])
await mutant('css: the dark tile has no ring', [css(' box-shadow: inset 0 0 0 1px var(--ss-line); }', ' }')])
await mutant('css: the dark rule is gone', [css(`  ${DARK_TILE}\n`, '')])
await mutant('css: the dark rule applies in the light theme too', [css('  .dark [data-studio-v4-shell="true"] > nav', '  [data-studio-v4-shell="true"] > nav')])
await mutant('css: the dark ring in a copied colour', [css('inset 0 0 0 1px var(--ss-line)', 'inset 0 0 0 1px #334245')])
await mutant('css: the tile rule has no nav (one step lower than phone shell 1\'s)', [css('  [data-studio-v4-shell="true"] > nav[data-studio-phone-tabbar="true"] > [aria-current="page"] { background: var(--ss-panel)', '  [data-studio-v4-shell="true"] > [data-studio-phone-tabbar="true"] > [aria-current="page"] { background: var(--ss-panel)')])
await mutant('css: the selected tab grows a size', [css(LIGHT_TILE, '> [aria-current="page"] { background: var(--ss-panel); color: var(--ss-teal); box-shadow: 0 1px 4px rgb(36 52 56 / 8%); min-width: 60px; }')])
// the names
await mutant('css: the names are display: none', [css(HIDE, 'display: none;')])
await mutant('css: the names are visibility: hidden', [css(HIDE, 'visibility: hidden;')])
await mutant('css: the names are clipped and also display: none on top', [css('white-space: nowrap; }', 'white-space: nowrap; display: none; }')])
await mutant('css: the names are font-size: 0', [css(HIDE, 'font-size: 0;')])
await mutant('css: the names are opacity: 0', [css(HIDE, 'opacity: 0;')])
await mutant('css: the names are not taken out of the flow', [css('position: absolute; width: 1px', 'width: 1px')])
await mutant('css: the names are not clipped', [css(' clip: rect(0 0 0 0); clip-path: inset(50%);', '')])
await mutant('css: the names are 2 px', [css('width: 1px; height: 1px;', 'width: 2px; height: 2px;')])
await mutant('css: every name is hidden, the selected one too', [css(NAME_RULE, '> :is(a, button) > span')])
await mutant('css: More keeps its name when it is not current', [css(NAME_RULE, '> :is(a, button):not([aria-current="page"]):not([data-studio-phone-tab="more"]) > span')])
await mutant('css: the Studio name is always hidden, current or not', [css('\n}\n', `\n  ${SELECTOR} > [data-studio-phone-tab="studio"] > span { ${HIDE} }\n}\n`)])
await mutant('css: the hidden-name rule has no nav (one step lower)', [css('  [data-studio-v4-shell="true"] > nav[data-studio-phone-tabbar="true"] > :is(a, button)', '  [data-studio-v4-shell="true"] > [data-studio-phone-tabbar="true"] > :is(a, button)')])
// the targets
await mutant('css: the tabs get 40 px wide', [css('\n}\n', `\n  ${SELECTOR} > :is(a, button) { min-width: 40px; }\n}\n`)])
await mutant('css: the tabs get 44 px tall', [css('\n}\n', `\n  ${SELECTOR} > :is(a, button) { min-height: 44px; }\n}\n`)])
await mutant('css: an unselected tab is narrower', [css('\n}\n', `\n  ${SELECTOR} > :is(a, button):not([aria-current="page"]) { flex: 0 0 44px; }\n}\n`)])
await mutant('css: a hover rule is added', [css('\n}\n', `\n  ${SELECTOR} > :is(a, button):hover { background: var(--ss-active); }\n}\n`)])
// the scope of the rules
await mutant('css: the sheet is not in the phone query (the bar rules apply at every width)', [css('@media (max-width: 640px) {\n', '@media (max-width: 1200px) {\n')])
await mutant('css: the tablet width', [css('@media (max-width: 640px) {', '@media (max-width: 768px) {')])
await mutant('css: a rule outside the query', [css('\n}\n', `\n}\n${SELECTOR} > :is(a, button) { color: red; }\n`)])
await mutant('css: a rule for every selected thing, not only the bar\'s', [css('\n}\n', '\n  [aria-current="page"] { color: var(--ss-teal); }\n}\n')])
await mutant('css: the rail\'s selected item is restyled', [css('\n}\n', '\n  [data-studio-v4-shell="true"] > [data-studio-v4-rail] nav [aria-current="page"] { background: var(--ss-soft); }\n}\n')])
await mutant('css: the card is restyled', [css('\n}\n', '\n  [data-studio-v4-shell="true"] [data-studio-v4-shell-workspace] { margin-bottom: 0; }\n}\n')])
await mutant('css: the More sheet is restyled', [css('\n}\n', '\n  [data-studio-phone-more="true"] > ul > li > a[aria-current="page"] { background: var(--ss-soft); }\n}\n')])
await mutant('css: the bar rule matches without the shell root', [css('  [data-studio-v4-shell="true"] > nav[data-studio-phone-tabbar="true"] { padding-top: 5px;', '  nav[data-studio-phone-tabbar="true"] { padding-top: 5px;')])
await mutant('css: !important', [css('border-top: 0;', 'border-top: 0 !important;')])
await mutant('css: an import', [css('@media (max-width: 640px) {', '@import url("x.css");\n@media (max-width: 640px) {')])
// the component, the strip, the registry
await mutant('bar: the import loses its marker', [bar(' // PHONE-TABBAR-FRAME (', ' // (')])
await mutant('bar: the import comes before phone shell 1\'s', [bar(`${IMPORT_LINE}\n`, ''), bar(`${BAR_BASE_IMPORT}\n`, `${IMPORT_LINE}\n${BAR_BASE_IMPORT}\n`)])
await mutant('bar: the import is of another file', [bar('import "./studio-tabbar-frame.css"', 'import "./studio-phone-tabbar-frame.css"')])
await mutant('bar: the import is gone', [bar(`${IMPORT_LINE}\n`, '')])
await mutant('bar: a second marked line', [bar(`${IMPORT_LINE}\n`, `${IMPORT_LINE}\n// PHONE-TABBAR-FRAME: a second line\n`)])
await mutant('bar: an unmarked line added', [bar(`${IMPORT_LINE}\n`, `${IMPORT_LINE}\nimport "./other.css"\n`)])
await mutant('bar: the markup gets a class', [bar('<nav data-studio-phone-tabbar="true"', '<nav className="x" data-studio-phone-tabbar="true"')])
await mutant('bar: a tab loses its word', [bar('<LayoutTemplate aria-hidden="true" /><span>Templates</span>', '<LayoutTemplate aria-hidden="true" />')])
await mutant('bar: the names get a class (a hook for the css, a markup change)', [bar('<span>Templates</span>', '<span className="n">Templates</span>')])
await mutant('bar: Themes loses its aria-label', [bar(' aria-label="Themes & brand"', '')])
await mutant('strip: leaves the marked line', [], { strip: (rel, text) => text })
await mutant('strip: the marker is a substring (phone shell 1 and 2\'s lines go too)', [], { strip: (rel, text) => (TABBAR_FRAME_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes('PHONE-')).join('\n') : stripTabbarFrame(rel, text)) })
await mutant('strip: drops the trailing newline', [], { strip: (rel, text) => { const out = stripTabbarFrame(rel, text); return TABBAR_FRAME_FILES.includes(rel) && typeof out === 'string' ? out.replace(/\n$/, '') : out } })
await mutant('strip: also strips the Builder page', [], { strip: (rel, text) => (rel === 'app/builder/page.tsx' && typeof text === 'string' ? text.split('\n').filter(line => !TABBAR_FRAME_MARKER_RE.test(line)).join('\n') : stripTabbarFrame(rel, text)) })
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-tabbar-frame-strip.mjs')).TABBAR_FRAME_SCOPE_FILES,", "  // ...(await import('./studio-tabbar-frame-strip.mjs')).TABBAR_FRAME_SCOPE_FILES,"]])
await mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-tabbar-frame-strip.mjs')).stripTabbarFrame,", "  // (await import('./studio-tabbar-frame-strip.mjs')).stripTabbarFrame,"]])
await mutant('registry: an env block line is added', [[REGISTRY, "  // one line per later change, above this comment\n]\n\n/** One strip", "  (await import('./studio-tabbar-frame-strip.mjs')).TABBAR_FRAME_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, phone tab bar on the frame, the name on the selected tab only (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)\n  // one line per later change, above this comment\n]\n\n/** One strip"]])
await mutant('registry: the strip line moves above speed perceived\'s', [[REGISTRY, "  (await import('./studio-tabbar-frame-strip.mjs')).stripTabbarFrame, // LATER-CHANGE: FRONTEND-2, phone tab bar on the frame, the name on the selected tab only (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)\n", ''], [REGISTRY, "  (await import('./studio-speed-perceived-strip.mjs')).stripSpeedPerceived,", "  (await import('./studio-tabbar-frame-strip.mjs')).stripTabbarFrame, // LATER-CHANGE: FRONTEND-2, phone tab bar on the frame, the name on the selected tab only (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)\n  (await import('./studio-speed-perceived-strip.mjs')).stripSpeedPerceived,"]])
// what must stay as it is
await mutant('untouched: phone shell 1\'s sheet is edited', [[PR1_CSS, '[data-studio-phone-tabbar="true"] { display: none; }', '[data-studio-phone-tabbar="true"] { display: none; visibility: hidden; }']])
await mutant('untouched: phone shell 1\'s tab size is edited', [[PR1_CSS, 'flex: 1 1 0; min-width: 44px; min-height: 48px;', 'flex: 1 1 0; min-width: 44px; min-height: 40px;']])
await mutant('untouched: the shell\'s tokens are edited', [[SHELL_CSS, '--ss-soft: #243034;', '--ss-soft: #1b2426;']])
await mutant('untouched: phone shell 1\'s proof is edited', [['scripts/test-studio-phone-shell-nav.mjs', "const SPELLINGS = [undefined, '', 'false'", "const SPELLINGS = [undefined, 'false'"]])
await mutant('untouched: the rail is edited', [['components/layout/studio-rail.tsx', '<aside data-studio-v4-rail="true"', '<aside data-studio-v4-rail="true" data-x="1"']])
await mutant('untouched: .env.example gets a block', [[ENV, 'NEXT_PUBLIC_STUDIO_PHONE_SHELL="false"', 'NEXT_PUBLIC_STUDIO_PHONE_SHELL="false"\nNEXT_PUBLIC_STUDIO_TABBAR_FRAME="false"']])
// the scope of the committed diff
await mutant('scope: a stray file in the committed diff', [], { scope: { files: [...TABBAR_FRAME_SCOPE_FILES, 'app/page.tsx'] } })
await mutant('scope: phone shell 1\'s sheet in the committed diff', [], { scope: { files: [...TABBAR_FRAME_SCOPE_FILES, PR1_CSS] } })
await mutant('scope: phone shell 1\'s proof in the committed diff', [], { scope: { files: [...TABBAR_FRAME_SCOPE_FILES, 'scripts/test-studio-phone-shell-nav.mjs'] } })
await mutant('scope: a commit of another change in BASE..HEAD', [], { scope: { files: [...TABBAR_FRAME_SCOPE_FILES], subjects: ['Phone tab bar frame: ok', 'Something else: x'] } })
await mutant('scope: the committed diff misses a file of this change', [], { scope: { files: [BAR] } })
// the secret scan
await mutant('secret scan: a bearer string in an ordinary name', [[STRIP_MODULE, "export const TABBAR_FRAME_MARKER = 'PHONE-TABBAR-FRAME'", `export const TABBAR_FRAME_MARKER = 'PHONE-TABBAR-FRAME'\nconst note = '${['Bearer ', 'a'.repeat(24)].join('')}'`]])
await mutant('secret scan: a credential-named literal', [[STRIP_MODULE, "export const TABBAR_FRAME_MARKER = 'PHONE-TABBAR-FRAME'", `export const TABBAR_FRAME_MARKER = 'PHONE-TABBAR-FRAME'\nconst ${['user', 'Credential'].join('')} = '${['abcdefgh', '12345678'].join('')}'`]])
await mutant('secret scan: a credential-shaped literal', [[STRIP_MODULE, "export const TABBAR_FRAME_MARKER = 'PHONE-TABBAR-FRAME'", `export const TABBAR_FRAME_MARKER = 'PHONE-TABBAR-FRAME'\nconst ${['api', 'Key'].join('')} = '${['AKIA', 'ABCDEFGH', '12345678'].join('')}'`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.log('SURVIVED:\n  ' + survived.join('\n  ')); process.exit(1) }
console.log(`test-studio-tabbar-frame: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
