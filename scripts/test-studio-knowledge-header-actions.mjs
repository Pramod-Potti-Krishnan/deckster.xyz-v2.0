// KNOWLEDGE-HEADER-ACTIONS: the Second Brain header with one "Sources" menu and the search field (flag NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS, exact "true", Studio
// shell only, default off). Card PASS2-J6-FINDINGS finding L5 (streams/ops/PASS2/J6/RUN.md section 2); mock design/studio-v4-mockup/components/workspace.tsx (`ws-brain-bar`).
// Offline and self-contained: no network, no browser, no git. Run: node scripts/test-studio-knowledge-header-actions.mjs
//   helper     lib/studio-knowledge-sources-menu.ts on its own (import-free): the number, the menu and its busy rules, arrow-key movement;
//   component  components/knowledge/studio-knowledge-sources-menu.tsx: markup (real React) and behaviour (a small hooks runtime with fake elements): open, focus, keys,
//              outside press, choosing an item starts exactly that one thing, the busy states;
//   page       app/(app)/knowledge/page.tsx: the flag is read once (exact "true", AND the Studio shell); the menu is given the page's own handlers and numbers; the search
//              block is one piece of markup that renders in the header (flag on) or in the map header (flag off); the three old buttons are the flag-off branch, untouched;
//   css        every rule of the new stylesheet hangs on data-studio-knowledge-role="header-tools" or the menu's own attribute, which exist only with the flag on.
// Flag-off identity of the whole page is held by the render goldens of scripts/test-studio-knowledge-fixes.mjs and scripts/test-atlas-knowledge-recovery.mjs (they run the real
// page with the flag unset).
// Then every layer re-runs against deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
let root = here
while (!fs.existsSync(path.join(root, 'package.json'))) {
  const parent = path.dirname(root)
  assert.notEqual(parent, root, 'no package.json above this script')
  root = parent
}
const requireOwn = createRequire(path.join(root, 'package.json'))
const ts = requireOwn('typescript')
const React = requireOwn('react')
const { renderToStaticMarkup } = requireOwn('react-dom/server')
const realJsx = requireOwn('react/jsx-runtime')

const HELPER = 'lib/studio-knowledge-sources-menu.ts'
const COMPONENT = 'components/knowledge/studio-knowledge-sources-menu.tsx'
const CSS = 'components/knowledge/studio-knowledge-header-actions.css'
const PAGE = 'app/(app)/knowledge/page.tsx'
const FLAG = 'NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')

class MutationTargetMissing extends Error {}
const mutate = (source, edits, label) => edits.reduce((text, [from, to]) => {
  if (!text.includes(from)) throw new MutationTargetMissing(`mutation target missing in ${label}: ${from.slice(0, 70)}`)
  return text.replace(from, to)
}, source)

function transpile(source, fileName) {
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  assert.deepEqual((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [], `${fileName} transpiles`)
  return out.outputText
}
function loadHelper(source) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(source, HELPER), { module: mod, exports: mod.exports, process: { env: {} } })
  return mod.exports
}

let checks = 0
const check = (fn, ...args) => { fn(...args); checks++ }
const plain = value => JSON.parse(JSON.stringify(value))
const deq = (actual, expected, message) => check(assert.deepStrictEqual, plain(actual), plain(expected), message)

// ---- helper ---------------------------------------------------------------------------------------------------------------------------------
function helperChecks(h) {
  for (const [input, count] of [[0, 0], [1, 1], [12, 12], [3.9, 3]]) check(assert.equal, h.sourcesCount(input), count, `count ${input}`)
  for (const odd of [undefined, null, -1, NaN, Infinity, '3', {}, []]) check(assert.equal, h.sourcesCount(odd), null, `no number for ${String(odd)}`)
  check(assert.equal, h.sourcesButtonLabel(undefined), 'Sources')
  check(assert.equal, h.sourcesButtonLabel(0), 'Sources, 0 sessions contribute to your knowledge')
  check(assert.equal, h.sourcesButtonLabel(1), 'Sources, 1 session contributes to your knowledge')
  check(assert.equal, h.sourcesButtonLabel(3), 'Sources, 3 sessions contribute to your knowledge')
  check(assert.equal, h.SOURCES_LABEL, 'Sources')

  // the menu: the three header buttons, in the header's order of importance (Import first), with the header's busy rules
  let items = h.sourcesMenuItems({ importing: false, loading: false })
  deq(items.map(item => [item.action, item.label, item.disabled]), [['import', 'Import past sessions', false], ['refresh', 'Refresh', false], ['settings', 'Knowledge settings', false]], 'idle')
  check(assert.ok, items.every(item => item.hint.length > 10), 'every item says what it does')
  items = h.sourcesMenuItems({ importing: true, loading: false })
  deq(items.map(item => [item.action, item.label, item.disabled]), [['import', 'Importing…', true], ['refresh', 'Refresh', true], ['settings', 'Knowledge settings', false]], 'importing: Import and Refresh off')
  items = h.sourcesMenuItems({ importing: false, loading: true })
  deq(items.map(item => [item.action, item.label, item.disabled]), [['import', 'Import past sessions', false], ['refresh', 'Refreshing…', true], ['settings', 'Knowledge settings', false]], 'loading: only Refresh off')
  items = h.sourcesMenuItems({ importing: true, loading: true })
  deq(items.map(item => [item.label, item.disabled]), [['Importing…', true], ['Refreshing…', true], ['Knowledge settings', false]], 'both')

  // arrow keys over the enabled items
  check(assert.equal, h.nextMenuIndex(0, 'ArrowDown', [0, 1, 2]), 1)
  check(assert.equal, h.nextMenuIndex(2, 'ArrowDown', [0, 1, 2]), 0, 'Down wraps')
  check(assert.equal, h.nextMenuIndex(0, 'ArrowUp', [0, 1, 2]), 2, 'Up wraps')
  check(assert.equal, h.nextMenuIndex(2, 'ArrowUp', [0, 1, 2]), 1)
  check(assert.equal, h.nextMenuIndex(1, 'Home', [0, 1, 2]), 0)
  check(assert.equal, h.nextMenuIndex(0, 'End', [0, 1, 2]), 2)
  check(assert.equal, h.nextMenuIndex(2, 'ArrowDown', [2]), 2, 'one enabled item stays')
  check(assert.equal, h.nextMenuIndex(-1, 'ArrowDown', [2]), 2, 'nothing focused: Down goes to the first')
  check(assert.equal, h.nextMenuIndex(-1, 'ArrowUp', [1, 2]), 2, 'nothing focused: Up goes to the last')
  check(assert.equal, h.nextMenuIndex(0, 'ArrowDown', [0, 2]), 2, 'a disabled item is skipped')
  check(assert.equal, h.nextMenuIndex(2, 'ArrowUp', [0, 2]), 0)
  check(assert.equal, h.nextMenuIndex(1, 'ArrowDown', [0, 2]), 0, 'focus is never on a disabled item: from one, Down starts at the first')
  check(assert.equal, h.nextMenuIndex(1, 'Home', [1, 2]), 1)
  check(assert.equal, h.nextMenuIndex(0, 'ArrowDown', []), null, 'no enabled item')
  for (const key of ['Enter', 'a', 'Tab', ' ', 'Escape']) check(assert.equal, h.nextMenuIndex(0, key, [0, 1, 2]), null, `${key} is not movement`)
}

// ---- component ------------------------------------------------------------------------------------------------------------------------------
const iconStub = new Proxy({}, { get: (_, key) => { const Icon = props => React.createElement('svg', { 'data-icon': String(key), className: props.className }); Icon.iconName = String(key); return Icon } })
const LinkStub = props => React.createElement('a', { href: props.href, role: props.role, className: props.className, ref: props.ref }, props.children)
LinkStub.isLink = true

function loadComponent(source, helper, react, jsxRuntime, doc) {
  const mod = { exports: {} }
  const req = spec => {
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec === 'react') return react
    if (spec === 'next/link') return { default: LinkStub }
    if (spec === 'lucide-react') return iconStub
    if (spec === '@/lib/studio-knowledge-sources-menu') return helper
    if (spec.endsWith('.css')) return {}
    throw new Error(`unexpected import ${spec}`)
  }
  vm.runInNewContext(transpile(source, COMPONENT), { module: mod, exports: mod.exports, require: req, Intl, document: doc })
  return mod.exports
}

/** The component with a tiny hooks runtime (state, refs, id, effects with dependency lists), plain element objects, and fake elements behind the refs. */
function harness(source, helper, props) {
  const cells = []
  let cursor = 0, dirty = false
  const effects = []
  const focusLog = []
  const doc = { handlers: {}, activeElement: null, addEventListener(type, fn) { (this.handlers[type] ??= new Set()).add(fn) }, removeEventListener(type, fn) { this.handlers[type]?.delete(fn) } }
  const react = {
    useState(init) {
      const i = cursor++
      cells[i] ??= { value: typeof init === 'function' ? init() : init }
      const cell = cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(init) { const i = cursor++; return cells[i] ??= { current: init } },
    useId() { cursor++; return ':rid:' },
    useEffect(fn, deps) {
      const i = cursor++, old = cells[i]
      if (!old || !deps || deps.some((value, index) => !Object.is(value, old.deps?.[index]))) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
  }
  const el = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null })
  const { StudioKnowledgeSourcesMenu } = loadComponent(source, helper, react, { jsx: el, jsxs: el, Fragment: 'Fragment' }, doc)
  let tree = null
  const nodes = (node, out = []) => { if (Array.isArray(node)) node.forEach(child => nodes(child, out)); else if (node && typeof node === 'object') { out.push(node); nodes(node.props?.children, out) } return out }
  const text = node => nodes(node).flatMap(item => (typeof item.props?.children === 'string' ? [item.props.children] : [])).join(' ')
  const fakes = new Map() // element identity (by role/label/class) -> fake DOM element
  const fakeFor = node => {
    const name = node.props.role === 'menuitem' ? `item:${text(node).split(' ')[0]}` : node.props.role === 'menu' ? 'menu' : node.props.className === 'sksm' ? 'root' : node.props.className === 'sksm-trigger' ? 'trigger' : 'other'
    if (!fakes.has(name)) fakes.set(name, { name, focus() { doc.activeElement = this; focusLog.push(this.name) }, contains(target) { return Boolean(target && target.inside) } })
    return fakes.get(name)
  }
  const bindRefs = () => {
    for (const node of nodes(tree)) {
      const ref = node.props?.ref
      if (ref == null) continue
      const fake = fakeFor(node)
      if (typeof ref === 'function') ref(fake); else ref.current = fake
    }
  }
  const render = (next = props) => {
    props = next
    for (let pass = 0; pass < 10; pass++) {
      cursor = 0; dirty = false
      tree = StudioKnowledgeSourcesMenu(props)
      bindRefs()
      const pending = effects.splice(0)
      pending.forEach(run => run())
      if (!dirty) return
    }
    throw new Error('render did not settle')
  }
  const find = predicate => nodes(tree).find(predicate)
  const api = {
    render, focusLog, doc, text,
    trigger: () => find(node => node.type === 'button' && node.props.className === 'sksm-trigger'),
    root: () => find(node => node.type === 'div' && node.props.className === 'sksm'),
    menu: () => find(node => node.props?.role === 'menu') ?? null,
    items: () => nodes(tree).filter(node => node.props?.role === 'menuitem'),
    iconOf: node => nodes(node).map(item => item.type?.iconName).filter(Boolean),
    activeName: () => doc.activeElement?.name ?? null,
  }
  render()
  return api
}

function componentChecks(helper, source) {
  const { StudioKnowledgeSourcesMenu } = loadComponent(source, helper, React, realJsx, { addEventListener() {}, removeEventListener() {} })
  const props = { sessions: 3, importing: false, loading: false, onImport() {}, onRefresh() {}, settingsHref: '/settings/knowledge-graph' }
  const html = overrides => renderToStaticMarkup(React.createElement(StudioKnowledgeSourcesMenu, { ...props, ...overrides }))

  // closed: one button, no menu
  let markup = html({})
  check(assert.match, markup, /^<div data-studio-knowledge-sources="true" class="sksm">/, 'the wrapper')
  check(assert.match, markup, /<button type="button" class="sksm-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="Sources, 3 sessions contribute to your knowledge">/, 'the button')
  check(assert.match, markup, /<svg data-icon="Database"[^>]*><\/svg><span>Sources<\/span><span class="sksm-count">3<\/span><svg data-icon="ChevronDown"/, 'icon, name, number, chevron')
  check(assert.doesNotMatch, markup, /role="menu"/, 'closed: no menu')
  check(assert.doesNotMatch, markup, /aria-controls/, 'closed: nothing to control')
  check(assert.doesNotMatch, html({}), /aria-busy/)
  check(assert.doesNotMatch, html({ sessions: undefined }), /sksm-count/, 'no number until the stats are loaded')
  check(assert.match, html({ sessions: undefined }), /aria-label="Sources">/)
  check(assert.match, html({ sessions: 12345 }), /<span class="sksm-count">12,345<\/span>/, 'grouped')
  check(assert.match, html({ sessions: 0 }), /<span class="sksm-count">0<\/span>/, 'zero is a number')
  markup = html({ importing: true })
  check(assert.match, markup, /aria-busy="true"/, 'importing: busy')
  check(assert.match, markup, /<svg data-icon="Loader2" class="sksm-spin"/, 'importing: the spinner replaces the icon')
  check(assert.doesNotMatch, markup, /data-icon="Database"/)

  // behaviour
  const calls = []
  const make = overrides => harness(source, helper, { ...props, onImport: () => calls.push('import'), onRefresh: () => calls.push('refresh'), ...overrides })
  let h = make({})
  check(assert.equal, h.menu(), null, 'closed at first')
  h.trigger().props.onClick()
  h.render()
  check(assert.ok, h.menu(), 'a click opens it')
  check(assert.equal, h.trigger().props['aria-expanded'], true)
  check(assert.equal, h.trigger().props['aria-controls'], h.menu().props.id, 'the button controls the menu')
  deq(h.items().map(item => [item.props.role, h.text(item)]), [['menuitem', 'Import past sessions Add eligible past sessions to your knowledge'], ['menuitem', 'Refresh Reload the map and the counts'], ['menuitem', 'Knowledge settings Turn Knowledge on or off, or delete what it holds']].map(([role, label]) => [role, label.replace(/^(Import past sessions|Refresh|Knowledge settings) /, '$1 ')]), 'three items')
  deq(h.items().map(item => h.iconOf(item)), [['Import'], ['RefreshCw'], ['Settings']], 'their icons')
  check(assert.equal, h.items()[2].type.isLink, true, 'Knowledge settings is a link')
  check(assert.equal, h.items()[2].props.href, '/settings/knowledge-graph')
  check(assert.equal, h.items()[0].type, 'button')
  check(assert.equal, h.activeName(), 'item:Import', 'opening focuses the first item')
  deq(calls, [], 'opening starts nothing')
  h.trigger().props.onClick()
  h.render()
  check(assert.equal, h.menu(), null, 'a second click closes it')

  // keys
  h = make({})
  h.trigger().props.onKeyDown({ key: 'ArrowDown', preventDefault() { calls.push('prevented') } })
  h.render()
  check(assert.ok, h.menu(), 'ArrowDown on the button opens it')
  check(assert.equal, calls.pop(), 'prevented')
  const press = key => { let stopped = false; h.menu().props.onKeyDown({ key, preventDefault() { stopped = true } }); h.render(); return stopped }
  check(assert.equal, press('ArrowDown'), true)
  check(assert.equal, h.activeName(), 'item:Refresh')
  press('ArrowDown'); check(assert.equal, h.activeName(), 'item:Knowledge')
  press('ArrowDown'); check(assert.equal, h.activeName(), 'item:Import', 'wraps')
  press('ArrowUp'); check(assert.equal, h.activeName(), 'item:Knowledge')
  press('Home'); check(assert.equal, h.activeName(), 'item:Import')
  press('End'); check(assert.equal, h.activeName(), 'item:Knowledge')
  check(assert.equal, press('a'), false, 'other keys are left alone')
  check(assert.equal, press('Escape'), true)
  check(assert.equal, h.menu(), null, 'Escape closes')
  check(assert.equal, h.activeName(), 'trigger', 'and returns to the button')
  h.trigger().props.onKeyDown({ key: 'ArrowDown', preventDefault() {} }); h.render()
  h.trigger().props.onKeyDown({ key: 'ArrowDown', preventDefault() {} }); h.render()
  check(assert.ok, h.menu(), 'ArrowDown on the button of an open menu does not close it')
  h.trigger().props.onKeyDown({ key: 'Enter', preventDefault() {} }); h.render()
  check(assert.ok, h.menu(), 'another key on the button does nothing')

  // outside press and focus leaving
  h = make({}); h.trigger().props.onClick(); h.render()
  check(assert.equal, h.doc.handlers.pointerdown?.size, 1, 'a press listener while open')
  for (const fn of h.doc.handlers.pointerdown) fn({ target: { inside: true } })
  h.render(); check(assert.ok, h.menu(), 'a press inside does not close')
  for (const fn of h.doc.handlers.pointerdown) fn({ target: { inside: false } })
  h.render(); check(assert.equal, h.menu(), null, 'a press outside closes')
  check(assert.equal, h.doc.handlers.pointerdown?.size ?? 0, 0, 'and the listener is gone')
  h = make({}); h.trigger().props.onClick(); h.render()
  h.root().props.onBlur({ relatedTarget: { inside: true } }); h.render(); check(assert.ok, h.menu(), 'focus moving inside keeps it open')
  h.root().props.onBlur({ relatedTarget: { inside: false } }); h.render(); check(assert.equal, h.menu(), null, 'focus leaving closes it')
  h = make({}); h.trigger().props.onClick(); h.render()
  h.root().props.onBlur({ relatedTarget: null }); h.render(); check(assert.ok, h.menu(), 'a blur with no target (a click on a button that takes no focus, as in Safari) does not close it before the click lands')
  h = make({}); h.root().props.onBlur({ relatedTarget: null }); h.render(); check(assert.equal, h.menu(), null, 'a blur while closed is nothing')

  // choosing
  h = make({}); h.trigger().props.onClick(); h.render()
  h.items()[0].props.onClick(); h.render()
  deq(calls.splice(0), ['import'], 'Import past sessions starts the import (the page decides how)')
  check(assert.equal, h.menu(), null, 'and closes the menu')
  h.trigger().props.onClick(); h.render(); h.items()[1].props.onClick(); h.render()
  deq(calls.splice(0), ['refresh'], 'Refresh reloads')
  check(assert.equal, h.menu(), null)
  h.trigger().props.onClick(); h.render(); h.items()[2].props.onClick(); h.render()
  deq(calls, [], 'Knowledge settings is a link: nothing is called')
  check(assert.equal, h.menu(), null, 'and the menu closes')

  // busy
  h = make({ importing: true }); h.trigger().props.onClick(); h.render()
  deq(h.items().map(item => Boolean(item.props.disabled)), [true, true, false], 'importing: Import and Refresh are off')
  check(assert.equal, h.activeName(), 'item:Knowledge', 'focus goes to the first enabled item')
  check(assert.equal, h.trigger().props['aria-busy'], true)
  check(assert.equal, h.text(h.items()[0]).startsWith('Importing…'), true)
  h = make({ loading: true }); h.trigger().props.onClick(); h.render()
  deq(h.items().map(item => Boolean(item.props.disabled)), [false, true, false], 'loading: only Refresh is off')
  check(assert.equal, h.text(h.items()[1]).startsWith('Refreshing…'), true)
  press('ArrowDown'); check(assert.equal, h.activeName(), 'item:Knowledge', 'a disabled item is skipped')
  h = make({ importing: true }); h.trigger().props.onClick(); h.render(); press('Home')
  check(assert.equal, h.activeName(), 'item:Knowledge')
  // the state the props give follows a re-render
  h = make({}); h.trigger().props.onClick(); h.render()
  h.render({ ...props, importing: true, onImport: () => calls.push('import'), onRefresh: () => calls.push('refresh') })
  deq(h.items().map(item => Boolean(item.props.disabled)), [true, true, false], 'a menu left open follows the page')
}

// ---- page -----------------------------------------------------------------------------------------------------------------------------------
function selectorsOf(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { const head = text.slice(start, i).trim(); if (!head.startsWith('@')) out.push(head); start = i + 1 } else if (text[i] === '}') start = i + 1
  }
  return out
}

function pageChecks(page, css) {
  const occurrences = (text, needle) => text.split(needle).length - 1
  check(assert.equal, occurrences(page, FLAG), 1, 'the flag is named once in the page')
  check(assert.ok, page.includes(`const KNOWLEDGE_HEADER_ACTIONS = STUDIO_SHELL && process.env.${FLAG} === "true"\n`), 'read once, exact "true", AND the Studio shell')
  check(assert.ok, page.indexOf('const STUDIO_SHELL =') < page.indexOf('const KNOWLEDGE_HEADER_ACTIONS ='), 'STUDIO_SHELL is defined first')
  check(assert.equal, (page.match(/\bKNOWLEDGE_HEADER_ACTIONS\b/g) ?? []).length, 8, 'defined, then used: the row\'s role, the menu, the search, the three old buttons, the old search place')
  check(assert.equal, occurrences(page, 'StudioKnowledgeSourcesMenu'), 2, 'imported and used once')
  check(assert.ok, page.includes('import { StudioKnowledgeSourcesMenu } from "@/components/knowledge/studio-knowledge-sources-menu"\n'), 'the import')
  check(assert.ok, !page.includes('@/lib/studio-knowledge-sources-menu'), 'the page does not import the helper (the component does); the sibling page tests stub every import but their own four modules')
  // the action row: its role says header-tools only with the flag on; the menu gets the page's own handlers and numbers
  check(assert.ok, page.includes('<div data-studio-knowledge-role={KNOWLEDGE_HEADER_ACTIONS ? "header-tools" : "actions"} className="flex flex-wrap gap-2">'), 'the row')
  const menu = /\{KNOWLEDGE_HEADER_ACTIONS && \(\n {12}<StudioKnowledgeSourcesMenu\n {14}sessions=\{stats\?\.sessions_consolidated\}\n {14}importing=\{importing\}\n {14}loading=\{dataLoading\}\n {14}onImport=\{KNOWLEDGE_FIXES \? requestImport : runImport\}\n {14}onRefresh=\{\(\) => void loadData\(\)\}\n {14}settingsHref="\/settings\/knowledge-graph"\n {12}\/>\n {10}\)\}\n {10}\{KNOWLEDGE_HEADER_ACTIONS && knowledgeSearch\}\n/
  check(assert.match, page, menu, 'the menu and the search, with the page\'s own handlers')
  // flag off: the three old buttons are still the row's own children, each only guarded (no wrapper: the sibling page tests hash the element tree)
  const row = page.slice(page.indexOf('<div data-studio-knowledge-role={KNOWLEDGE_HEADER_ACTIONS ?'), page.indexOf('        </div>\n      </header>'))
  check(assert.ok, !row.includes('<>') && !row.includes('Fragment'), 'no fragment in the row')
  const oldButtons = [
    '{!KNOWLEDGE_HEADER_ACTIONS && STUDIO_SHELL && <Button variant="outline" disabled={dataLoading || importing} onClick={() => void loadData()}><RefreshCw className={cn("mr-2 h-4 w-4", dataLoading && "animate-spin")} />{dataLoading ? "Refreshing…" : "Refresh"}</Button>}',
    '{!KNOWLEDGE_HEADER_ACTIONS && (\n            <Button variant="outline" onClick={KNOWLEDGE_FIXES ? requestImport : runImport} disabled={importing}>\n              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Import className="mr-2 h-4 w-4" />}\n              {importing ? "Importing…" : "Import past sessions"}\n            </Button>\n          )}',
    '{!KNOWLEDGE_HEADER_ACTIONS && (\n            <Button asChild variant="ghost" size="icon">\n              <Link href="/settings/knowledge-graph" aria-label="Knowledge Graph settings" title="Knowledge settings">\n                <Settings className="h-4 w-4" />\n              </Link>\n            </Button>\n          )}',
  ]
  for (const line of oldButtons) check(assert.ok, row.includes(line), `flag off, the header still has: ${line.slice(0, 70)}`)
  check(assert.equal, occurrences(page, '{KNOWLEDGE_HEADER_ACTIONS && knowledgeSearch}'), 1, 'the search block in the header')
  check(assert.equal, occurrences(page, 'knowledgeSearch'), 3, 'defined, the header, the map header')
  check(assert.equal, occurrences(page, '{KNOWLEDGE_HEADER_ACTIONS ? null : knowledgeSearch}'), 1, 'and, flag off, where it was: in the map header')
  check(assert.ok, page.indexOf('{KNOWLEDGE_HEADER_ACTIONS ? null : knowledgeSearch}') > page.indexOf('data-studio-knowledge-role="map-header"'), 'inside the map header')
  // the search block itself is the one it was: same field, same handlers
  const block = page.slice(page.indexOf('const knowledgeSearch = ('), page.indexOf('  return (\n    <main data-studio-knowledge="true"'))
  for (const part of ['<div data-studio-knowledge-role="search" className="relative w-full lg:max-w-sm">', 'onSubmit={(event) => { event.preventDefault(); void runSearch() }}', 'role="search"',
    'placeholder="Search your knowledge…"', 'aria-label="Search your knowledge graph"', 'aria-label="Run search"', 'aria-label="Clear search"', 'ref={STUDIO_SHELL ? searchInputRef : undefined}',
    'data-studio-knowledge-role={STUDIO_SHELL ? "search-results" : undefined}', 'onClick={() => { setSelectedId(node.node_id); clearSearchResults() }}', 'No matching entities found.']) {
    check(assert.ok, block.includes(part), `the search block keeps: ${part.slice(0, 60)}`)
  }
  check(assert.equal, occurrences(page, 'data-studio-knowledge-role="search"'), 1, 'one search field in the page')
  // css: every rule hangs on an attribute that exists only with the flag on
  const selectors = selectorsOf(css).filter(selector => !/^(from|to|\d+%)$/.test(selector)) // keyframe stops are not selectors
  check(assert.ok, selectors.length >= 15, 'the stylesheet has rules')
  for (const [, name] of css.matchAll(/@keyframes ([\w-]+)/g)) check(assert.match, name, /^sksm-/, `the keyframes are named for this menu: ${name}`)
  for (const selector of selectors) for (const part of selector.split(',')) check(assert.match, part.trim(), /^\[data-studio-v4-shell="true"\] \[data-studio-knowledge-role="header-tools"\]/, `scoped: ${part.trim()}`)
  check(assert.ok, css.includes('var(--ss-line)') && css.includes('var(--ss-accent)') && css.includes('var(--ss-active)'), 'on the shell tokens')
  check(assert.doesNotMatch, css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b/, 'no colour of its own: tokens only')
}

// ---- run, then break things ------------------------------------------------------------------------------------------------------------------
const sources = { helper: read(HELPER), component: read(COMPONENT), page: read(PAGE), css: read(CSS) }
const runAll = ({ helper, component, page, css }) => {
  const h = loadHelper(helper)
  helperChecks(h)
  componentChecks(h, component)
  pageChecks(page, css)
}
runAll(sources)
const real = checks

const MUTANTS = [
  // helper
  ['helper', 'return typeof sessions === \'number\' && Number.isFinite(sessions) && sessions >= 0 ? Math.floor(sessions) : null', 'return typeof sessions === \'number\' && Number.isFinite(sessions) ? Math.floor(sessions) : null', 'a negative number is shown'],
  ['helper', 'Number.isFinite(sessions) && sessions >= 0', 'sessions >= 0', 'an infinite number is shown'],
  ['helper', 'Math.floor(sessions) : null', 'sessions : null', 'a fraction is shown'],
  ['helper', "count === 1 ? 'session contributes' : 'sessions contribute'", "'sessions contribute'", 'no singular'],
  ['helper', 'if (count === null) return SOURCES_LABEL', 'if (count === null) return `${SOURCES_LABEL}, 0 sessions`', 'a number made up'],
  ['helper', "label: importing ? 'Importing…' : 'Import past sessions', hint: 'Add eligible past sessions to your knowledge', disabled: importing", "label: 'Import past sessions', hint: 'Add eligible past sessions to your knowledge', disabled: importing", 'Import never says it is running'],
  ['helper', "hint: 'Add eligible past sessions to your knowledge', disabled: importing", "hint: 'Add eligible past sessions to your knowledge', disabled: false", 'Import can start twice'],
  ['helper', 'disabled: loading || importing }', 'disabled: loading }', 'Refresh while importing'],
  ['helper', 'disabled: loading || importing }', 'disabled: importing }', 'Refresh while loading'],
  ['helper', "label: loading ? 'Refreshing…' : 'Refresh'", "label: 'Refresh'", 'Refresh never says it is running'],
  ['helper', "action: 'settings', label: 'Knowledge settings', hint: 'Turn Knowledge on or off, or delete what it holds', disabled: false", "action: 'settings', label: 'Knowledge settings', hint: 'Turn Knowledge on or off, or delete what it holds', disabled: importing", 'settings off while importing'],
  ['helper', "{ action: 'import', label", "{ action: 'refresh', label", 'two refreshes'],
  ['helper', 'if (key === \'Home\') return enabled[0]', 'if (key === \'Home\') return enabled[enabled.length - 1]', 'Home goes to the end'],
  ['helper', 'if (key === \'End\') return enabled[enabled.length - 1]', 'if (key === \'End\') return enabled[0]', 'End goes to the start'],
  ['helper', 'enabled[at < 0 || at === enabled.length - 1 ? 0 : at + 1]', 'enabled[at < 0 ? 0 : Math.min(at + 1, enabled.length - 1)]', 'Down does not wrap'],
  ['helper', 'enabled[at <= 0 ? enabled.length - 1 : at - 1]', 'enabled[Math.max(at - 1, 0)]', 'Up does not wrap'],
  ['helper', 'enabled[at <= 0 ? enabled.length - 1 : at - 1]', 'enabled[at < 0 ? 0 : at - 1 < 0 ? enabled.length - 1 : at - 1]', 'Up with nothing focused goes to the first'],
  ['helper', 'if (enabled.length === 0) return null', 'if (enabled.length === 0) return 0', 'movement with no enabled item'],
  ['helper', "if (key === 'ArrowDown')", "if (key === 'ArrowDown' || key === 'Tab')", 'Tab moves focus inside the menu'],
  // component
  ['component', 'aria-expanded={open}', 'aria-expanded={!open}', 'aria-expanded inverted'],
  ['component', 'aria-controls={open ? menuId : undefined}', 'aria-controls={menuId}', 'controls a menu that is not there'],
  ['component', 'aria-haspopup="menu"', 'aria-haspopup="true"', 'haspopup'],
  ['component', 'aria-busy={importing || undefined}', 'aria-busy={loading || undefined}', 'busy follows loading'],
  ['component', 'aria-label={sourcesButtonLabel(sessions)}', 'aria-label={SOURCES_LABEL}', 'the number is not announced'],
  ['component', '{count !== null && <span className="sksm-count">', '{<span className="sksm-count">', 'a number that is not there'],
  ['component', 'onClick={() => setOpen(current => !current)}', 'onClick={() => setOpen(true)}', 'a second click does not close'],
  ['component', 'if (event.key === "ArrowDown" && !open) { event.preventDefault(); setOpen(true) }', 'if (event.key === "ArrowDown" && !open) { setOpen(true) }', 'ArrowDown scrolls the page'],
  ['component', 'if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); return }', 'if (event.key === "Escape") { event.preventDefault(); setOpen(false); return }', 'Escape loses focus'],
  ['component', 'if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); return }', 'if (event.key === "Escape") { event.preventDefault(); trigger.current?.focus(); return }', 'Escape does not close'],
  ['component', 'const next = nextMenuIndex(at, event.key, enabled)', 'const next = nextMenuIndex(at, event.key, items.map((_, index) => index))', 'a disabled item takes focus'],
  ['component', 'itemRefs.current[enabled[0]]?.focus()', 'itemRefs.current[0]?.focus()', 'focus goes to a disabled first item'],
  ['component', 'itemRefs.current[enabled[0]]?.focus()\n', '\n', 'opening does not move focus'],
  ['component', 'if (!root.current?.contains(event.target as Node)) setOpen(false)', 'if (root.current?.contains(event.target as Node)) setOpen(false)', 'a press inside closes'],
  ['component', 'document.addEventListener("pointerdown", outside)', 'document.addEventListener("click", outside)', 'listens to the wrong event'],
  ['component', 'return () => document.removeEventListener("pointerdown", outside)', 'return () => {}', 'the listener leaks'],
  ['component', 'if (open && next && !root.current?.contains(next)) setOpen(false)', 'if (open) setOpen(false)', 'focus moving inside closes'],
  ['component', 'if (open && next && !root.current?.contains(next)) setOpen(false)', 'if (open && !root.current?.contains(next)) setOpen(false)', 'a blur with no target closes before the click lands'],
  ['component', 'if (open && next && !root.current?.contains(next)) setOpen(false)', 'if (open && next && !root.current?.contains(next)) {}', 'focus leaving keeps it open'],
  ['component', 'const choose = (action: SourcesAction) => { setOpen(false); if (action === "import") onImport(); else if (action === "refresh") onRefresh() }', 'const choose = (action: SourcesAction) => { if (action === "import") onImport(); else if (action === "refresh") onRefresh() }', 'choosing leaves the menu open'],
  ['component', 'if (action === "import") onImport(); else if (action === "refresh") onRefresh() }', 'onImport(); onRefresh() }', 'choosing starts both'],
  ['component', 'if (action === "import") onImport(); else if (action === "refresh") onRefresh() }', 'if (action === "import") onRefresh(); else if (action === "refresh") onImport() }', 'the actions are swapped'],
  ['component', 'onClick={() => setOpen(false)}>{body}</Link>', 'onClick={() => onImport()}>{body}</Link>', 'settings starts an import'],
  ['component', 'href={settingsHref} role="menuitem"', 'href="/settings" role="menuitem"', 'settings goes elsewhere'],
  ['component', 'disabled={item.disabled}', 'disabled={false}', 'a busy item can be pressed'],
  ['component', 'role="menuitem"\n                className="sksm-item"', 'className="sksm-item"', 'a button that is not a menu item'],
  ['component', 'role="menu"', 'role="listbox"', 'the menu role'],
  ['component', 'const ICONS = { import: Import, refresh: RefreshCw, settings: Settings } as const', 'const ICONS = { import: Settings, refresh: RefreshCw, settings: Import } as const', 'icons swapped'],
  ['component', '{importing ? <Loader2 size={15} className="sksm-spin" aria-hidden="true" /> : <Database size={15} aria-hidden="true" />}', '<Database size={15} aria-hidden="true" />', 'no spinner while importing'],
  ['component', 'data-studio-knowledge-sources="true"', 'data-studio-knowledge-menu="true"', 'the attribute is renamed'],
  // page
  ['page', 'const KNOWLEDGE_HEADER_ACTIONS = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS === "true"', 'const KNOWLEDGE_HEADER_ACTIONS = process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS === "true"', 'not tied to the Studio shell'],
  ['page', 'const KNOWLEDGE_HEADER_ACTIONS = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS === "true"', 'const KNOWLEDGE_HEADER_ACTIONS = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS !== "false"', 'on unless "false"'],
  ['page', 'data-studio-knowledge-role={KNOWLEDGE_HEADER_ACTIONS ? "header-tools" : "actions"}', 'data-studio-knowledge-role="header-tools"', 'the row is header-tools flag off too'],
  ['page', 'data-studio-knowledge-role={KNOWLEDGE_HEADER_ACTIONS ? "header-tools" : "actions"}', 'data-studio-knowledge-role="actions"', 'the row never says header-tools'],
  ['page', 'sessions={stats?.sessions_consolidated}', 'sessions={stats?.node_count}', 'the number is the entity count'],
  ['page', 'importing={importing}\n              loading={dataLoading}', 'importing={dataLoading}\n              loading={importing}', 'busy states swapped'],
  ['page', 'onImport={KNOWLEDGE_FIXES ? requestImport : runImport}', 'onImport={runImport}', 'Import skips the confirm dialog'],
  ['page', 'onImport={KNOWLEDGE_FIXES ? requestImport : runImport}', 'onImport={requestImport}', 'Import asks even when the page does not'],
  ['page', 'onRefresh={() => void loadData()}', 'onRefresh={() => void runImport()}', 'Refresh imports'],
  ['page', 'settingsHref="/settings/knowledge-graph"', 'settingsHref="/settings"', 'settings goes elsewhere'],
  ['page', '          {KNOWLEDGE_HEADER_ACTIONS && knowledgeSearch}\n', '', 'no search in the header'],
  ['page', '          {KNOWLEDGE_HEADER_ACTIONS && knowledgeSearch}\n', '          <>{KNOWLEDGE_HEADER_ACTIONS && knowledgeSearch}</>\n', 'a fragment around the search'],
  ['page', '          {KNOWLEDGE_HEADER_ACTIONS && knowledgeSearch}\n', '          {knowledgeSearch}\n', 'the search is in the header flag off too'],
  ['page', '{!KNOWLEDGE_HEADER_ACTIONS && (\n            <Button variant="outline" onClick={KNOWLEDGE_FIXES', '{(\n            <Button variant="outline" onClick={KNOWLEDGE_FIXES', 'the old Import is also shown flag on'],
  ['page', '{!KNOWLEDGE_HEADER_ACTIONS && (\n            <Button asChild variant="ghost" size="icon">', '{(\n            <Button asChild variant="ghost" size="icon">', 'the old gear is also shown flag on'],
  ['page', '{!KNOWLEDGE_HEADER_ACTIONS && STUDIO_SHELL && <Button', '{STUDIO_SHELL && <Button', 'the old Refresh is also shown flag on'],
  ['page', '{!KNOWLEDGE_HEADER_ACTIONS && (\n            <Button variant="outline" onClick={KNOWLEDGE_FIXES', '{KNOWLEDGE_HEADER_ACTIONS && (\n            <Button variant="outline" onClick={KNOWLEDGE_FIXES', 'the old Import is shown flag on only'],
  ['page', '{KNOWLEDGE_HEADER_ACTIONS ? null : knowledgeSearch}', '{knowledgeSearch}', 'the search is in both places'],
  ['page', '{KNOWLEDGE_HEADER_ACTIONS ? null : knowledgeSearch}', '{null}', 'flag off the search is gone from the map header'],
  ['page', 'placeholder="Search your knowledge…"', 'placeholder="Search sources, decks, topics"', 'the placeholder promises what the search does not do'],
  ['page', 'onSubmit={(event) => { event.preventDefault(); void runSearch() }}', 'onSubmit={(event) => { void runSearch() }}', 'search submit reloads the page'],
  ['page', 'STUDIO_SHELL && <Button variant="outline" disabled={dataLoading || importing} onClick={() => void loadData()}>', 'STUDIO_SHELL && <Button variant="outline" disabled={dataLoading} onClick={() => void loadData()}>', 'the old Refresh is changed'],
  ['page', '<Link href="/settings/knowledge-graph" aria-label="Knowledge Graph settings" title="Knowledge settings">', '<Link href="/settings/knowledge-graph" aria-label="Knowledge Graph settings">', 'the old gear is changed'],
  ['page', 'import { StudioKnowledgeSourcesMenu } from "@/components/knowledge/studio-knowledge-sources-menu"\n', 'import { StudioKnowledgeSourcesMenu } from "@/components/knowledge/studio-knowledge-sources-menu"\nimport { sourcesMenuItems } from "@/lib/studio-knowledge-sources-menu"\n', 'the page imports the helper'],
  // css
  ['css', '[data-studio-v4-shell="true"] [data-studio-knowledge-role="header-tools"] .sksm-spin {', '.sksm-spin {', 'a rule that is not scoped'],
  ['css', '[data-studio-v4-shell="true"] [data-studio-knowledge-role="header-tools"] .sksm-count {', '[data-studio-knowledge-role="header-tools"] .sksm-count {', 'a rule without the shell'],
  ['css', '[data-studio-v4-shell="true"] [data-studio-knowledge-role="header-tools"] .sksm-panel {', '[data-studio-v4-shell="true"] [data-studio-knowledge-role="actions"] .sksm-panel {', 'a rule on the flag-off row'],
  ['css', 'var(--ss-accent)', '#6a4fc0', 'a colour that is not a token'],
]
let caught = 0
for (const [file, from, to, name] of MUTANTS) {
  const before = checks
  const broken = { ...sources, [file]: mutate(sources[file], [[from, to]], `${file} (${name})`) }
  let failed = false
  try { runAll(broken) } catch (error) { if (error instanceof MutationTargetMissing) throw error; failed = true }
  checks = before
  assert.ok(failed, `mutant not caught: ${file}: ${name}`)
  caught++
}
checks = real
console.log(`PASS: studio knowledge header actions (${checks} checks, ${caught}/${MUTANTS.length} mutants caught)`)
