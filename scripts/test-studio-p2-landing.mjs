// PASS2 Landing (FRONTEND-1): LAND-01, LAND-05, LAND-06. Flag NEXT_PUBLIC_STUDIO_P2_LANDING (exact "true"), default off; off, the landing is exactly as the base commit has it.
//   LAND-01 <html> takes the night colour (the mockup's `html{background:var(--night)}`): a marker class on <html> that exists only with the flag on, and one rule scoped to it
//   LAND-05 the Present chips: Publish & share, Viewers ask and Narration are "Live", Zoom / Meet stays "Next" (the home page's Present slide and the Narrate card on /present)
//   LAND-06 a menu on phones (900px and below) with Bring / Present / Experts / Pricing, the desktop header's own links; closes on Escape (focus back to the button), a press outside, a chosen link
//   Not touched: pricing and plan data (Builder B's shared plan list), lib/marketing/v3-content.ts (the copy stays as written; the flag changes only what is shown), the Presenter card on /experts.
//
// Run: node scripts/test-studio-p2-landing.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   P2_LANDING_BASE=<commit> overrides the base commit flag-off identity is checked against (default fbc77c0, the studio-v4-dev-preparation-code tip the work started from).
//
// Proven on the REAL sources lib/studio-p2-landing.ts, components/marketing/v3/{HeaderMenuP2,HeaderV3,home/Present}.tsx, app/(marketing-v3)/present/page.tsx, hooks/use-v3-deck.ts,
// styles/marketing-v3-p2.css, .env.example and package.json:
//   1. the helper is import-free; the flag parse, the words, the chip rules, the menu's links and its open / close rules are exact;
//   2. the real copy is unchanged (v3-content.ts still says "In build" for Narration; the flag does the change) and the menu's four links are real routes and the header's own hrefs;
//   3. the menu component (executed): closed / open markup, aria wiring, the three ways to close, Escape's focus return, listeners only while open, the current page marked;
//   4. the wiring (executed against the base commit's files): flag off, or any value but "true", renders the same tree as the base for HeaderV3, the home Present slide, /present and the
//      deck hook's <html> classes; flag on adds only the menu, the Live chips and the <html> marker;
//   5. the CSS: every rule scoped to the two markers; the html rule is --night's own value; the menu is hidden above 900px, 44px targets, [hidden] stays hidden; imported by one file only;
//   6. the env block and the package script;
//   7. mutation check: every mutant of the sources is killed by sections 1-6.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.P2_LANDING_BASE || 'fbc77c0430099ec7e11a188307ee5521b6937719'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseCache = new Map()
const baseSource = rel => {
  if (!baseCache.has(rel)) {
    try { baseCache.set(rel, execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })) }
    catch (error) { throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history): ${error.message}`) }
  }
  return baseCache.get(rel)
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm carry its realm's prototypes
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))
const attempt = fn => { try { return fn() } catch (error) { return { threw: String(error) } } } // a mutant that crashes must fail an assertion, not the run

const LIB = 'lib/studio-p2-landing.ts'
const MENU = 'components/marketing/v3/HeaderMenuP2.tsx'
const HEADER = 'components/marketing/v3/HeaderV3.tsx'
const PRESENT = 'components/marketing/v3/home/Present.tsx'
const PAGE = 'app/(marketing-v3)/present/page.tsx'
const HOOK = 'hooks/use-v3-deck.ts'
const CSS = 'styles/marketing-v3-p2.css'
const ENV = '.env.example'
const PKG = 'package.json'
const CONTENT = 'lib/marketing/v3-content.ts'
const BASE_CSS = 'styles/marketing-v3.css'
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_LANDING'
const OWN = [LIB, MENU, HEADER, PRESENT, PAGE, HOOK, CSS, ENV, PKG]
const SOURCES = Object.fromEntries(OWN.map(rel => [rel, read(rel)]))
const REAL = new Set([LIB, MENU, HEADER, PRESENT, PAGE, HOOK, CONTENT, 'lib/marketing/homepage-v2-content.ts'])

// ---------------------------------------------------------------- the vm: a small hooks runtime and a module loader
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null })
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' }
const norm = value => JSON.stringify(value, (key, item) => {
  if (key === 'children' && Array.isArray(item)) { const kept = item.filter(x => x !== false && x !== undefined && x !== null); return kept.length === 1 ? kept[0] : kept } // [x] and x are the same children
  return typeof item === 'function' ? '[fn]' : item
})
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
const text = value => Array.isArray(value) ? value.map(text).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? text(value.props?.children) : String(value)
const expand = value => Array.isArray(value) ? value.map(expand) : value && typeof value === 'object' && typeof value.type === 'function' ? expand(value.type(value.props)) : value && typeof value === 'object' ? { ...value, props: { ...value.props, ...(value.props?.children !== undefined ? { children: expand(value.props.children) } : {}) } } : value
const compile = (source, fileName) => {
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal((out.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0, `${fileName} compiles`)
  return out.outputText
}

function createRuntime() {
  const cells = []
  let cursor = 0, dirty = false, ids = 0
  const effects = []
  const changed = (old, deps) => !old || !deps || deps.some((value, index) => !Object.is(value, old.deps?.[index]))
  const react = {
    useState(init) {
      const i = cursor++
      cells[i] ??= { value: typeof init === 'function' ? init() : init }
      const cell = cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(init) { const i = cursor++; return cells[i] ??= { current: init } },
    useId() { const i = cursor++; return cells[i] ??= `:id${++ids}:` },
    useEffect(fn, deps) {
      const i = cursor++, old = cells[i]
      if (changed(old, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
    Fragment: 'Fragment',
  }
  return {
    react,
    render(Component, props) {
      for (let attempt = 0; attempt < 12; attempt++) {
        cursor = 0; dirty = false
        const tree = Component(props)
        while (effects.length) effects.shift()()
        if (!dirty) return tree
      }
      throw new Error('render did not settle')
    },
    unmount() { for (const cell of cells) if (cell && typeof cell.cleanup === 'function') { cell.cleanup(); cell.cleanup = undefined } },
  }
}

function createLoader({ sources, env, stubs = {}, globals = {}, react }) {
  const cache = new Map()
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(from), spec)
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(path.join(repoRoot, base + suffix)) || (base + suffix) in sources) return base + suffix
    return null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec === 'react') return react
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) { const rel = resolve(spec, from); if (rel && REAL.has(rel)) return run(rel) }
    return new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : String(key)) })
  }
  function run(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const mod = { exports: {} }
    cache.set(rel, mod.exports)
    vm.runInNewContext(compile(sources[rel] ?? read(rel), rel), { module: mod, exports: mod.exports, process: { env }, JSON, Math, Object, Array, Set, Map, ...globals, require: spec => requireFor(spec, rel) })
    cache.set(rel, mod.exports)
    return mod.exports
  }
  return { load: run }
}
const envFor = value => (value === undefined ? {} : { [FLAG]: value })
const lib = sources => createLoader({ sources, env: {}, react: createRuntime().react }).load(LIB)

// ---------------------------------------------------------------- 1. the helper
const NAV = [{ label: 'Build', href: '/#zoom' }, { label: 'Bring', href: '/bring' }, { label: 'Present', href: '/present' }, { label: 'Experts', href: '/experts' }, { label: 'Pricing', href: '/pricing' }]
function proveLib(sources, label = 'lib') {
  nomatch(sources[LIB], /^\s*(?:import\b|export\s+\*?\s*from\b)|require\(/m, `${label}: import-free`)
  const l = lib(sources)
  for (const [value, want] of [['true', true], ['false', false], ['', false], [undefined, false], [null, false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['1', false], ['yes', false], ['on', false]]) eq(attempt(() => l.studioP2LandingOn(value)), want, `${label}: flag value ${JSON.stringify(value)}`)
  eq(l.STUDIO_P2_NIGHT_CLASS, 'mv3-p2-night', `${label}: the <html> marker`)
  eq(l.STUDIO_P2_NIGHT_COLOR, '#0C0D13', `${label}: the night value`)
  eq(l.STUDIO_P2_MENU_ATTR, 'data-p2-landing-menu', `${label}: the menu marker`)
  deepEq(l.STUDIO_P2_MENU_LABELS, ['Bring', 'Present', 'Experts', 'Pricing'], `${label}: the four pages, in order`)
  deepEq({ ...l.STUDIO_P2_MENU_WORDS }, { open: 'Open menu', close: 'Close menu', navLabel: 'Site menu' }, `${label}: the menu's words`)
  const ladder = [
    { status: 'live', statusLabel: 'Live', text: 'Publish & share' }, { status: 'live', statusLabel: 'Live', text: 'Viewers ask' },
    { status: 'build', statusLabel: 'In build', text: 'Narration' }, { status: 'next', statusLabel: 'Next', text: 'Zoom' },
  ]
  eq(l.studioP2Ladder(ladder, false), ladder, `${label}: off, the very same array`)
  deepEq(l.studioP2Ladder(ladder, true).map(i => [i.status, i.statusLabel, i.text]), [['live', 'Live', 'Publish & share'], ['live', 'Live', 'Viewers ask'], ['live', 'Live', 'Narration'], ['next', 'Next', 'Zoom']], `${label}: on, Narration is Live, Zoom stays Next`)
  deepEq(ladder.map(i => i.statusLabel), ['Live', 'Live', 'In build', 'Next'], `${label}: the input is not changed`)
  for (const [value, on, want] of [['In build', true, 'Live'], ['In build', false, 'In build'], ['Live', true, 'Live'], ['Live', false, 'Live'], ['Next', true, 'Next'], ['Next', false, 'Next']]) eq(l.studioP2Status(value, on), want, `${label}: ${value} with ${on}`)
  deepEq(l.studioP2MenuLinks(NAV), [{ label: 'Bring', href: '/bring' }, { label: 'Present', href: '/present' }, { label: 'Experts', href: '/experts' }, { label: 'Pricing', href: '/pricing' }], `${label}: the menu's links are the header's own, Build left out`)
  deepEq(l.studioP2MenuLinks([...NAV].reverse()).map(i => i.label), ['Bring', 'Present', 'Experts', 'Pricing'], `${label}: the menu's order does not follow the header's`)
  deepEq(l.studioP2MenuLinks([{ label: 'Pricing', href: '/x' }]), [{ label: 'Pricing', href: '/x' }], `${label}: a page the header lacks is left out, an href is the header's`)
  deepEq(l.studioP2MenuLinks([]), [], `${label}: no nav, no links`)
  for (const [open, event, want] of [[false, 'toggle', true], [true, 'toggle', false], [true, 'escape', false], [false, 'escape', false], [true, 'outside', false], [false, 'outside', false], [true, 'choose', false], [false, 'choose', false], [true, 'other', true], [false, 'other', false]]) eq(l.studioP2MenuNext(open, event), want, `${label}: ${open ? 'open' : 'closed'} + ${event}`)
  for (const [event, want] of [['escape', true], ['toggle', false], ['outside', false], ['choose', false]]) eq(l.studioP2MenuRestoresFocus(event), want, `${label}: focus returns after ${event}: ${want}`)
  for (const [key, want] of [['Escape', 'escape'], ['Esc', null], ['escape', null], ['Enter', null], ['Tab', null], [' ', null], ['', null], [undefined, null], [null, null]]) eq(l.studioP2MenuKeyEvent(key), want, `${label}: key ${JSON.stringify(key)}`)
  return l
}

// ---------------------------------------------------------------- 2. the real copy and routes
function proveContent(sources, label = 'content') {
  const { V3_CONTENT } = createLoader({ sources, env: {}, react: createRuntime().react }).load(CONTENT)
  deepEq(V3_CONTENT.present.ladder.map(i => [i.status, i.statusLabel]), [['live', 'Live'], ['live', 'Live'], ['build', 'In build'], ['next', 'Next']], `${label}: the copy is as written (Narration "In build"); the flag changes what is shown`)
  deepEq(V3_CONTENT.pages.present.four.cards.map(c => c.status), ['Live', 'In build', 'Live', 'Next'], `${label}: the /present cards are as written`)
  const l = lib(sources)
  const links = l.studioP2MenuLinks(V3_CONTENT.nav)
  deepEq(links.map(i => i.label), ['Bring', 'Present', 'Experts', 'Pricing'], `${label}: the real header nav has the four`)
  for (const item of links) { ok(fs.existsSync(path.join(repoRoot, 'app/(marketing-v3)', item.href.slice(1), 'page.tsx')), `${label}: ${item.href} is a real route`); eq(item.href, V3_CONTENT.nav.find(n => n.label === item.label).href, `${label}: ${item.label} goes where the desktop header goes`) }
}

// ---------------------------------------------------------------- 3. the menu (executed)
function mountMenu(sources, { pathname = '/' } = {}) {
  const runtime = createRuntime()
  const listeners = new Map()
  const added = [], removed = []
  const document = {
    addEventListener: (type, fn) => { added.push(type); listeners.set(type, [...(listeners.get(type) ?? []), fn]) },
    removeEventListener: (type, fn) => { removed.push(type); listeners.set(type, (listeners.get(type) ?? []).filter(item => item !== fn)) },
  }
  const loader = createLoader({ sources, env: envFor('true'), react: runtime.react, globals: { document }, stubs: { 'next/link': { default: 'Link' }, 'next/navigation': { usePathname: () => pathname } } })
  const { HeaderMenuP2 } = loader.load(MENU)
  const inside = new Set(), focus = []
  const wrapNode = { contains: node => node === wrapNode || inside.has(node) }
  const buttonNode = { focus: () => focus.push('button') }
  const world = {
    listeners, added, removed, focus, inside,
    view() {
      const tree = runtime.render(HeaderMenuP2, {})
      const all = nodes(tree)
      const wrap = all.find(n => n.props?.['data-p2-landing-menu'] !== undefined)
      const button = all.find(n => n.type === 'button')
      const panel = all.find(n => n.type === 'nav')
      if (wrap) wrap.props.ref.current = wrapNode
      if (button) button.props.ref.current = buttonNode
      return { tree, wrap, button, panel, links: all.filter(n => n.type === 'Link') }
    },
    fire(type, event) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event) },
    unmount() { runtime.unmount() },
  }
  return world
}
function proveMenu(sources, label = 'menu') {
  match(sources[MENU], /^import "@\/styles\/marketing-v3-p2\.css"$/m, `${label}: imports its own stylesheet`)
  let w = mountMenu(sources)
  const innerNode = { inner: true }
  w.inside.add(innerNode)
  let v = w.view()
  eq(v.wrap.props.className, 'p2-menu', `${label}: wrapper class`)
  eq(v.wrap.props['data-p2-landing-menu'], 'true', `${label}: wrapper marker`)
  eq(v.wrap.props['data-open'], 'false', `${label}: closed`)
  eq(v.button.props.type, 'button', `${label}: the button does not submit`)
  eq(v.button.props['aria-label'], 'Open menu', `${label}: closed button name`)
  eq(v.button.props['aria-expanded'], false, `${label}: aria-expanded false`)
  ok(typeof v.button.props['aria-controls'] === 'string' && v.button.props['aria-controls'].length > 0, `${label}: aria-controls names a panel`)
  eq(v.panel.props.id, v.button.props['aria-controls'], `${label}: aria-controls is the panel's id`)
  eq(v.panel.props['aria-label'], 'Site menu', `${label}: the panel is a labelled nav`)
  eq(v.panel.props.hidden, true, `${label}: the closed panel is hidden`)
  deepEq(v.links.map(n => [text(n), n.props.href]), [['Bring', '/bring'], ['Present', '/present'], ['Experts', '/experts'], ['Pricing', '/pricing']], `${label}: the four links, the header's hrefs`)
  deepEq(w.added, [], `${label}: closed, no document listener`)
  v.button.props.onClick(); v = w.view()
  eq(v.wrap.props['data-open'], 'true', `${label}: opened by the button`)
  eq(v.button.props['aria-expanded'], true, `${label}: aria-expanded true`)
  eq(v.button.props['aria-label'], 'Close menu', `${label}: open button name`)
  eq(v.panel.props.hidden, false, `${label}: the open panel is shown`)
  deepEq(w.added.slice().sort(), ['keydown', 'pointerdown'], `${label}: open, a key and a press listener on the document`)
  w.fire('pointerdown', { target: innerNode }); v = w.view()
  eq(v.wrap.props['data-open'], 'true', `${label}: a press inside the menu keeps it open`)
  w.fire('keydown', { key: 'Tab' }); w.fire('keydown', { key: 'Enter' }); v = w.view()
  eq(v.wrap.props['data-open'], 'true', `${label}: other keys keep it open`)
  w.fire('pointerdown', { target: { outside: true } }); v = w.view()
  eq(v.wrap.props['data-open'], 'false', `${label}: a press outside closes`)
  eq(v.panel.props.hidden, true, `${label}: and hides the panel`)
  deepEq(w.removed.slice().sort(), ['keydown', 'pointerdown'], `${label}: closed, both listeners are removed`)
  deepEq(w.focus, [], `${label}: a press outside does not move the focus`)
  v.button.props.onClick(); v = w.view()
  w.fire('keydown', { key: 'Escape' }); v = w.view()
  eq(v.wrap.props['data-open'], 'false', `${label}: Escape closes`)
  deepEq(w.focus, ['button'], `${label}: Escape gives the focus back to the button`)
  v.button.props.onClick(); v = w.view()
  v.links[2].props.onClick(); v = w.view()
  eq(v.wrap.props['data-open'], 'false', `${label}: choosing a link closes`)
  deepEq(w.focus, ['button'], `${label}: a chosen link does not pull the focus back`)
  v.button.props.onClick(); v = w.view(); v.button.props.onClick(); v = w.view()
  eq(v.wrap.props['data-open'], 'false', `${label}: the button toggles`)
  v.button.props.onClick(); v = w.view()
  w.unmount()
  eq((w.listeners.get('keydown') ?? []).length + (w.listeners.get('pointerdown') ?? []).length, 0, `${label}: unmounted while open, no listener is left`)
  w = mountMenu(sources, { pathname: '/present' }); v = w.view()
  deepEq(v.links.map(n => n.props.className), [undefined, 'is-here', undefined, undefined], `${label}: the current page is marked`)
}

// ---------------------------------------------------------------- 4. the wiring against the base commit
const SESSIONS = [{ label: 'loading', status: 'loading', data: null }, { label: 'signed out', status: 'unauthenticated', data: null }, { label: 'signed in', status: 'authenticated', data: { user: { email: 'a@example.invalid' } } }]
const OFF_VALUES = [undefined, 'false', '', 'TRUE', 'True', '1', ' true', 'true ', 'yes']
function header(source, value, session, pathname, sources) {
  const runtime = createRuntime()
  const loader = createLoader({ sources: { ...sources, [HEADER]: source }, env: envFor(value), react: runtime.react, stubs: {
    'next/link': { default: 'Link' }, 'next/navigation': { usePathname: () => pathname }, 'next-auth/react': { useSession: () => ({ data: session.data, status: session.status }) },
    '@/lib/analytics': { trackCta: () => {} }, './HeaderMenuP2': { HeaderMenuP2: 'HeaderMenuP2' },
  } })
  return runtime.render(loader.load(HEADER).HeaderV3, {})
}
function proveHeader(sources, label = 'header') {
  const base = baseSource(HEADER)
  for (const session of SESSIONS) for (const pathname of ['/', '/present']) {
    const want = norm(header(base, undefined, session, pathname, sources))
    for (const value of OFF_VALUES) eq(norm(header(sources[HEADER], value, session, pathname, sources)), want, `${label}: ${session.label}, ${pathname}, flag ${JSON.stringify(value)}: the base's tree`)
    const on = header(sources[HEADER], 'true', session, pathname, sources)
    const menus = nodes(on).filter(n => n.type === 'HeaderMenuP2')
    eq(menus.length, 1, `${label}: ${session.label}, ${pathname}: on, one menu`)
    const cta = nodes(on).find(n => n.props?.className === 'hdr__cta')
    const kids = [cta.props.children].flat().filter(x => x !== false && x !== undefined && x !== null)
    eq(kids[kids.length - 1].type, 'HeaderMenuP2', `${label}: ${session.label}: the menu is the last thing in the buttons' row, after Sign in / Build a deck`)
    const stripped = JSON.parse(norm(on))
    const strip = n => {
      if (Array.isArray(n)) { const kept = n.filter(x => x?.type !== 'HeaderMenuP2'); const out = kept.map(strip); return kept.length === 1 && n.length !== 1 ? out[0] : out }
      return n && typeof n === 'object' ? Object.fromEntries(Object.entries(n).map(([k, v]) => [k, k === 'children' || k === 'props' ? strip(v) : v])) : n
    }
    eq(JSON.stringify(strip(stripped)), want, `${label}: ${session.label}, ${pathname}: on is the base tree plus the menu and nothing else`)
  }
  match(sources[HEADER], /^import \{ HeaderMenuP2 \} from "\.\/HeaderMenuP2"$/m, `${label}: imports the menu`)
  match(sources[HEADER], /process\.env\.NEXT_PUBLIC_STUDIO_P2_LANDING\)/, `${label}: reads the flag as Next inlines it`)
}

function present(source, value, sources) {
  const runtime = createRuntime()
  const loader = createLoader({ sources: { ...sources, [PRESENT]: source }, env: envFor(value), react: runtime.react })
  const { V3_CONTENT } = loader.load(CONTENT)
  return runtime.render(loader.load(PRESENT).Present, { copy: V3_CONTENT.present })
}
const pills = tree => nodes(tree).filter(n => typeof n.props?.className === 'string' && /^pill pill--/.test(n.props.className)).map(n => [n.props.className, text(n)])
function provePresent(sources, label = 'present') {
  const base = baseSource(PRESENT)
  const want = norm(present(base, undefined, sources))
  for (const value of OFF_VALUES) eq(norm(present(sources[PRESENT], value, sources)), want, `${label}: home Present, flag ${JSON.stringify(value)}: the base's tree`)
  deepEq(pills(present(base, undefined, sources)), [['pill pill--live', 'Live'], ['pill pill--live', 'Live'], ['pill pill--build', 'In build'], ['pill pill--next', 'Next']], `${label}: the base's chips`)
  const on = present(sources[PRESENT], 'true', sources)
  deepEq(pills(on), [['pill pill--live', 'Live'], ['pill pill--live', 'Live'], ['pill pill--live', 'Live'], ['pill pill--next', 'Next']], `${label}: home Present on: three Live, Zoom / Meet Next, the Live styling`)
  const texts = nodes(on).filter(n => n.props?.className === undefined && n.type === 'div').map(text).filter(t => /^(Live|Next)/.test(t))
  ok(texts.some(t => /^Live.*Narration/.test(t)) && texts.some(t => /^Next.*Zoom/.test(t)), `${label}: the Narration row says Live and the Zoom row says Next`)

  const pageSource = sources[PAGE]
  const run = (source, value) => {
    const runtime = createRuntime()
    const loader = createLoader({ sources: { ...sources, [PAGE]: source }, env: envFor(value), react: runtime.react })
    return expand(loader.load(PAGE).default())
  }
  const pageWant = norm(run(baseSource(PAGE), undefined))
  for (const value of OFF_VALUES) eq(norm(run(pageSource, value)), pageWant, `${label}: /present, flag ${JSON.stringify(value)}: the base's tree`)
  deepEq(pills(run(baseSource(PAGE), undefined)), [['pill pill--live', 'Live'], ['pill pill--build', 'In build'], ['pill pill--live', 'Live'], ['pill pill--next', 'Next']], `${label}: /present base chips`)
  deepEq(pills(run(pageSource, 'true')), [['pill pill--live', 'Live'], ['pill pill--live', 'Live'], ['pill pill--live', 'Live'], ['pill pill--next', 'Next']], `${label}: /present on: Narrate is Live, Multiply stays Next`)
}

function proveHook(sources, label = 'hook') {
  const run = (source, value) => {
    const runtime = createRuntime()
    const classes = new Set(), log = []
    const html = { classList: { add: c => { classes.add(c); log.push(`+${c}`) }, remove: c => { classes.delete(c); log.push(`-${c}`) } } }
    const globals = {
      document: { documentElement: html, querySelector: () => null, querySelectorAll: () => [] },
      window: { scrollY: 0, addEventListener() {}, removeEventListener() {} }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    }
    const loader = createLoader({ sources: { ...sources, [HOOK]: source }, env: envFor(value), react: runtime.react, globals, stubs: { 'next/navigation': { usePathname: () => '/' }, './use-reveal': { useReveal: () => {} } } })
    runtime.render(loader.load(HOOK).useV3Deck, undefined)
    const mounted = [...classes]
    runtime.unmount()
    return { mounted, left: [...classes], log }
  }
  const base = run(baseSource(HOOK), undefined)
  deepEq(base.mounted, ['mv3-page'], `${label}: base adds mv3-page`)
  for (const value of OFF_VALUES) deepEq(run(sources[HOOK], value), base, `${label}: flag ${JSON.stringify(value)}: the base's <html> classes, added and removed`)
  const on = run(sources[HOOK], 'true')
  deepEq(on.mounted, ['mv3-page', 'mv3-p2-night'], `${label}: on adds the night marker beside mv3-page`)
  deepEq(on.left, [], `${label}: on, both are removed when the page unmounts`)
}

// ---------------------------------------------------------------- 5. the CSS
const MARKERS = ['html.mv3-p2-night', '.mv3 [data-p2-landing-menu]']
function proveCss(sources, label = 'css') {
  const root = postcss.parse(sources[CSS])
  const rules = []
  root.walkRules(rule => rules.push(rule))
  ok(rules.length >= 8, `${label}: the rules are there`)
  for (const rule of rules) for (const selector of rule.selectors) ok(MARKERS.some(m => selector === m || selector.startsWith(`${m} `) || selector.startsWith(`${m}[`) || selector.startsWith(`${m}:`)), `${label}: "${selector}" is scoped to a marker`)
  const find = (selector, within) => { let found = null; (within ?? root).walkRules(rule => { if (rule.parent === (within ?? root) && rule.selectors.includes(selector)) found = rule }); return found }
  const decl = (rule, prop) => { let v = null; rule?.walkDecls(prop, d => { v = d.value }); return v }
  const night = (() => { let v = null; postcss.parse(read(BASE_CSS)).walkRules('.mv3', rule => rule.walkDecls('--night', d => { v ??= d.value })); return v })()
  ok(night, `${label}: --night is declared on .mv3`)
  const html = find('html.mv3-p2-night')
  eq(decl(html, 'background')?.toLowerCase(), night.toLowerCase(), `${label}: <html>'s night colour is --night's own value (the token is not visible on <html>)`)
  eq(rules.filter(r => r.selectors.includes('html.mv3-p2-night')).length, 1, `${label}: one html rule`)
  eq(decl(find('.mv3 [data-p2-landing-menu]'), 'display'), 'none', `${label}: the menu is hidden by default (above 900px the header's own links show)`)
  let media = null
  root.walkAtRules('media', at => { if (/max-width:\s*900px/.test(at.params)) media = at })
  ok(media, `${label}: a 900px media rule (the width at which the header's links go)`)
  eq(decl(find('.mv3 [data-p2-landing-menu]', media), 'display'), 'block', `${label}: shown at 900px and below`)
  eq(root.nodes.filter(n => n.type === 'atrule' && n.name === 'media').length, 1, `${label}: one media rule`)
  const btn = find('.mv3 [data-p2-landing-menu] .p2-menu__btn')
  eq(decl(btn, 'width'), '44px', `${label}: 44px target wide`)
  eq(decl(btn, 'height'), '44px', `${label}: 44px target high`)
  const panel = find('.mv3 [data-p2-landing-menu] .p2-menu__panel')
  eq(decl(panel, 'position'), 'absolute', `${label}: the panel floats under the button`)
  eq(decl(panel, 'right'), '0', `${label}: right-aligned to the button`)
  match(decl(panel, 'background'), /--night-2/, `${label}: the dark panel uses the page's night surface`)
  eq(decl(find('.mv3 [data-p2-landing-menu] .p2-menu__panel[hidden]'), 'display'), 'none', `${label}: a hidden panel stays hidden (the flex rule would show it)`)
  eq(decl(find('.mv3 [data-p2-landing-menu] .p2-menu__panel a'), 'min-height'), '44px', `${label}: 44px links`)
  ok(find('.mv3 [data-p2-landing-menu] .p2-menu__btn:focus-visible') && find('.mv3 [data-p2-landing-menu] .p2-menu__panel a:focus-visible'), `${label}: focus rings`)
  const baseCss = read(BASE_CSS)
  nomatch(baseCss, /mv3-p2|p2-menu|data-p2-landing/, `${label}: the landing's own stylesheet has none of it`)
  match(baseCss, /html\.snap-deck\.mv3-page\{scroll-padding-top:56px\}/, `${label}: the existing html rule is still there`)
  // imported by exactly one file
  const users = []
  const walk = dir => { for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) { const rel = path.posix.join(dir, entry.name); if (entry.isDirectory()) { if (!['node_modules', '.next', '.git'].includes(entry.name)) walk(rel) } else if (/\.(tsx?|css)$/.test(entry.name) && /^\s*(?:import\s+)?["'][^"']*marketing-v3-p2\.css["']/m.test(fs.readFileSync(path.join(repoRoot, rel), 'utf8')) && rel !== CSS) users.push(rel) } }
  for (const dir of ['app', 'components', 'hooks', 'lib', 'styles']) walk(dir)
  deepEq(users, [MENU], `${label}: only the menu imports the stylesheet`)
}

// ---------------------------------------------------------------- 6. env, package, scope
function proveEnv(sources, label = 'env') {
  const lines = sources[ENV].split('\n')
  eq(lines.filter(l => l === `${FLAG}="false"`).length, 1, `${label}: the flag is documented once, off`)
  eq(lines.filter(l => l.trim() !== '').at(-1), `${FLAG}="false"`, `${label}: at the end of the file`)
  const block = lines.slice(lines.lastIndexOf(`${FLAG}="false"`) - 5, lines.lastIndexOf(`${FLAG}="false"`)).join('\n')
  for (const word of ['LAND-01', 'LAND-05', 'LAND-06', 'READ AT BUILD TIME', 'exact "true"', 'default off']) ok(block.includes(word), `${label}: the block says "${word}"`)
  eq(JSON.parse(sources[PKG]).scripts['test:studio-p2-landing'], 'node scripts/test-studio-p2-landing.mjs', `${label}: the package script`)
  ok(fs.existsSync(path.join(repoRoot, 'scripts/test-studio-p2-landing.mjs')), `${label}: the script exists`)
}
function proveScope(sources, label = 'scope') {
  for (const rel of [LIB, MENU, HEADER, PRESENT, PAGE, HOOK]) nomatch(sources[rel], /homepage-v2-pricing|home\/Pricing|PRICING_TIERS|pricingHome|studio-billing/, `${label}: ${rel} does not touch pricing or plan data`)
  for (const rel of [LIB, MENU, HEADER, PRESENT, PAGE, HOOK]) nomatch(sources[rel], /NEXT_PUBLIC_(?!STUDIO_P2_LANDING)\w+/, `${label}: ${rel} reads no other flag`)
}

function proveAll(sources) {
  proveLib(sources); proveContent(sources); proveMenu(sources); proveHeader(sources); proveHook(sources); provePresent(sources); proveCss(sources); proveEnv(sources); proveScope(sources)
}
proveAll(SOURCES)

// ---------------------------------------------------------------- 7. mutation check
const MUTANTS = [
  // the helper
  [LIB, 'flag: anything but "false" turns it on', "return value === 'true'", "return value !== 'false'"],
  [LIB, 'flag: any truthy value turns it on', "return value === 'true'", 'return Boolean(value)'],
  [LIB, 'night colour is not --night', "'#0C0D13'", "'#0C0D14'"],
  [LIB, 'the <html> marker is renamed', "'mv3-p2-night'", "'mv3-night'"],
  [LIB, 'the menu marker is renamed', "'data-p2-landing-menu'", "'data-landing-menu'"],
  [LIB, 'ladder: flag off still rewrites', 'if (!on) return ladder\n', ''],
  [LIB, 'ladder: the wrong chip becomes Live', "item.status === 'build' ?", "item.status === 'next' ?"],
  [LIB, 'ladder: the label is lower case', "statusLabel: 'Live' }", "statusLabel: 'live' }"],
  [LIB, 'status: flag off still rewrites', "return on && value === 'In build' ? 'Live' : value", "return value === 'In build' ? 'Live' : value"],
  [LIB, 'status: Next becomes Live too', "value === 'In build' ? 'Live' : value", "value !== 'Live' ? 'Live' : value"],
  [LIB, 'menu: Build joins the links', "['Bring', 'Present', 'Experts', 'Pricing'] as const", "['Build', 'Bring', 'Present', 'Experts', 'Pricing'] as const"],
  [LIB, 'menu: order follows the header', "['Bring', 'Present', 'Experts', 'Pricing'] as const", "['Present', 'Bring', 'Experts', 'Pricing'] as const"],
  [LIB, 'menu: an href is invented', 'return item ? [{ label: item.label, href: item.href }] : []', "return item ? [{ label: item.label, href: '#' }] : []"],
  [LIB, 'menu: the button no longer toggles', "if (event === 'toggle') return !open", "if (event === 'toggle') return true"],
  [LIB, 'menu: Escape does not close', "if (event === 'escape' || event === 'outside' || event === 'choose') return false", "if (event === 'outside' || event === 'choose') return false"],
  [LIB, 'menu: a press outside does not close', "if (event === 'escape' || event === 'outside' || event === 'choose') return false", "if (event === 'escape' || event === 'choose') return false"],
  [LIB, 'menu: a chosen link does not close', "if (event === 'escape' || event === 'outside' || event === 'choose') return false", "if (event === 'escape' || event === 'outside') return false"],
  [LIB, 'menu: focus always returns', "return event === 'escape'\n}", 'return true\n}'],
  [LIB, 'menu: Escape is spelled Esc', "key === 'Escape' ? 'escape' : null", "key === 'Esc' ? 'escape' : null"],
  // the menu component
  [MENU, 'menu: aria-expanded is dropped', '        aria-expanded={open}\n', ''],
  [MENU, 'menu: aria-controls is dropped', '        aria-controls={panelId}\n', ''],
  [MENU, 'menu: the panel id differs', 'id={panelId}', 'id="menu"'],
  [MENU, 'menu: the panel is never hidden', 'hidden={!open}', 'hidden={false}'],
  [MENU, 'menu: the key listener is gone', '    document.addEventListener("keydown", onKey)\n', ''],
  [MENU, 'menu: the cleanup keeps the press listener', '      document.removeEventListener("pointerdown", onPress)\n', ''],
  [MENU, 'menu: a press inside closes too', 'if (target && wrapRef.current?.contains(target)) return', ''],
  [MENU, 'menu: a chosen link leaves it open', 'onClick={() => send("choose")}', 'onClick={() => {}}'],
  [MENU, 'menu: Escape does not return the focus', 'if (studioP2MenuRestoresFocus(event)) buttonRef.current?.focus()', ''],
  [MENU, 'menu: the links are a fixed list', 'const links = studioP2MenuLinks(V3_CONTENT.nav)', 'const links = [{ label: "Bring", href: "/bring" }, { label: "Present", href: "/present" }, { label: "Experts", href: "/experts" }, { label: "Pricing", href: "/pricing#x" }]'],
  [MENU, 'menu: the current page is never marked', 'className={pathname === item.href.split("#")[0] ? "is-here" : undefined}', 'className={undefined}'],
  [MENU, 'menu: listeners are added while closed', '    if (!open) return\n', ''],
  [MENU, 'menu: the stylesheet is not imported', 'import "@/styles/marketing-v3-p2.css"\n', ''],
  // the wiring
  [HEADER, 'header: the menu shows with the flag off', '{STUDIO_P2_LANDING && <HeaderMenuP2 />}', '{<HeaderMenuP2 />}'],
  [HEADER, 'header: the menu leads the buttons', '          {STUDIO_P2_LANDING && <HeaderMenuP2 />}\n', ''],
  [HEADER, 'header: another flag name', 'process.env.NEXT_PUBLIC_STUDIO_P2_LANDING)', 'process.env.NEXT_PUBLIC_STUDIO_P2_LANDING2)'],
  [HOOK, 'hook: the marker is added with the flag off', 'if (STUDIO_P2_LANDING) html.classList.add(STUDIO_P2_NIGHT_CLASS)', 'html.classList.add(STUDIO_P2_NIGHT_CLASS)'],
  [HOOK, 'hook: the marker is never removed', '      if (STUDIO_P2_LANDING) html.classList.remove(STUDIO_P2_NIGHT_CLASS)\n', ''],
  [HOOK, 'hook: mv3-page is replaced', 'html.classList.add("mv3-page")', 'html.classList.add("mv3-page-x")'],
  [PRESENT, 'present: the chips ignore the flag', 'const ladder = studioP2Ladder(copy.ladder, STUDIO_P2_LANDING)', 'const ladder = copy.ladder'],
  [PRESENT, 'present: the chips always change', 'const ladder = studioP2Ladder(copy.ladder, STUDIO_P2_LANDING)', 'const ladder = studioP2Ladder(copy.ladder, true)'],
  [PAGE, 'page: the cards ignore the flag', 'studioP2Status(card.status, STUDIO_P2_LANDING)', 'card.status'],
  [PAGE, 'page: the cards always change', 'studioP2Status(card.status, STUDIO_P2_LANDING)', 'studioP2Status(card.status, true)'],
  // the CSS
  [CSS, 'css: the night rule is not scoped to the marker', 'html.mv3-p2-night { background: #0C0D13; }', 'html.mv3-page { background: #0C0D13; }'],
  [CSS, 'css: the night rule is another colour', 'html.mv3-p2-night { background: #0C0D13; }', 'html.mv3-p2-night { background: #000000; }'],
  [CSS, 'css: the menu shows above 900px', '.mv3 [data-p2-landing-menu] { position: relative; display: none; }', '.mv3 [data-p2-landing-menu] { position: relative; display: block; }'],
  [CSS, 'css: the media query is 600px', '@media (max-width: 900px)', '@media (max-width: 600px)'],
  [CSS, 'css: the button is 40px', 'width: 44px; height: 44px;', 'width: 40px; height: 44px;'],
  [CSS, 'css: a hidden panel shows', '.mv3 [data-p2-landing-menu] .p2-menu__panel[hidden] { display: none; }\n', ''],
  [CSS, 'css: a link is 30px', 'display: flex; align-items: center; min-height: 44px;', 'display: flex; align-items: center; min-height: 30px;'],
  [CSS, 'css: a rule leaks to every page', '.mv3 [data-p2-landing-menu] .p2-menu__panel a:hover,', '.mv3 a:hover,'],
  [CSS, 'css: the panel is light', 'background: var(--night-2); color: var(--snow);', 'background: #fff; color: var(--snow);'],
  // the env block, the package script
  [ENV, 'env: the flag defaults on', `${FLAG}="false"`, `${FLAG}="true"`],
  [ENV, 'env: the flag is not documented', `${FLAG}="false"`, ''],
  [PKG, 'package: the script is gone', '"test:studio-p2-landing": "node scripts/test-studio-p2-landing.mjs"', '"test:studio-p2-landing-x": "node scripts/test-studio-p2-landing.mjs"'],
]
counting = false
let killed = 0
const survivors = []
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  try { proveAll({ ...SOURCES, [file]: mutated }); survivors.push(name) }
  catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
}
counting = true
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
eq(killed, MUTANTS.length)

console.log(`Studio P2 landing (LAND-01/05/06): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
