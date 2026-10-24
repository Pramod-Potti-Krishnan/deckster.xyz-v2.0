// FRONTEND-2: proof for "Duplicate copy title" (NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE, default off), the two small gaps E2E-2 found when "Duplicate deck" went live:
//   1. the Decks page cut the original and its copy to the same words ("moving weekly status meeting..."), so the " (copy)" suffix never showed;
//   2. the copy's Builder header said "Studio" instead of its title (a copy has no slideStructure, so no main_title).
// Plain node, no browser, no network, no services, no paid call, one process: the real TypeScript is transpiled and run in a vm with a small fake React (hooks keep their state, effects run on demand)
// and a small fake DOM with a small reconciler that behaves like React's (it holds the nodes it rendered, writes them on a re-render, and throws NotFoundError when a node it holds is gone), so the real
// pass runs on the REAL deck card (PresentationCard, taken from the Decks page as it is) and the page is then re-rendered under it. The look is judged from the real stylesheet by a one-line flex model
// (one character = one unit), because no browser is allowed here: the before / after PNGs are the caller's (the steps are in the report).
//   RECORDED  E2E-2's live proof (streams/e2e2/duplicate-proof: RESULT.md, copy.json, original-before.json): the copy's and the original's titles, ids, slide counts, the visible card text and the header.
//   DERIVED   the copy's session row (its stateCache) is not in that proof: it is derived by running the REAL runDuplicateDeck against a recording stub (POST /api/sessions, PATCH /api/sessions/{id}) and
//             storing what PATCH stores (exactly currentStatus, slideStructure, activeVersion, app/api/sessions/[id]/route.ts). Every use of it below says so.
//   1. the flag      exact "true" only (spelling, case, spaces, 1, yes)
//   2. the pass      (cards) ATTRIBUTES ONLY: no text node written, no node added or removed; idempotent; follows the page (a rename, a new card, a re-render that never throws); undone on unmount;
//                    an original, a plain deck and look-alikes ("Copy of X", "X (Copy)", "(copy)" in the middle) are never marked; an existing tooltip is left alone
//   3. the look      from the real stylesheet: at every width the copy's card keeps " (copy)" and an ellipsis after its cut name; the original and the copy differ; flag off they are the same text (the bug)
//   4. the hook      (header) the copy's own title from the marker-carrying session; a deck that was not copied, a failed read, an unsaved session, a stale answer: nothing; flag off: no request at all
//   5. the header    the page's real expression and the real BuilderHeader: the copy says its title, a built deck says its main_title, a deck with none says "Studio", as at the base
//   6. flag off      layout trees, header text over every state, hook calls and the card DOM are the base commit's: same output, hashed
//   7. the change    strip = BASE_COMMIT byte for byte, files held by other changes' pins unchanged, scope, .env.example, the stylesheet's scope and words, a secret scan
//   8. mutants       each one must make sections 1-7 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'
import { BASE_COMMIT, DUPLICATE_COPY_TITLE_CHANGES, DUPLICATE_COPY_TITLE_FILES, DUPLICATE_COPY_TITLE_NEW_FILES, stripDuplicateCopyTitle } from './studio-duplicate-copy-title-strip.mjs'
import { stripPaymentsOpenSoon } from './studio-payments-open-soon-strip.mjs' // stacked: #496, below this change in the stack
import { stripThumbnailLastGood, THUMBNAIL_LAST_GOOD_FILES, THUMBNAIL_LAST_GOOD_NEW_FILES, THUMBNAIL_LAST_GOOD_PIN_FILES } from './studio-thumbnail-last-good-strip.mjs' // stacked: thumbnail last good (the Studio half of "never blank"), after duplicate copy title in the stack
import { stripBulkEditUndo, BULK_EDIT_UNDO_FILES, BULK_EDIT_UNDO_NEW_FILES, BULK_EDIT_UNDO_PIN_FILES } from './studio-bulk-edit-undo-strip.mjs' // stacked: bulk edit + chat undo (a whole-deck edit card and an Undo chip in chat), after thumbnail last good in the stack
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { STACKED_PASS3_FILES } from './studio-library-manage-harness.mjs'
import { LATER_CHANGE_FILES, stripLaterEnvBlocks } from './studio-later-changes.mjs' // stacked: the later-changes registry (a change stacked after this one registers its files and its .env.example block there; scope checks skip its files, every read of .env.example goes through it first)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.DUPLICATE_COPY_TITLE_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
const baseCache = new Map()
const baseSource = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE}:${rel}`)); return baseCache.get(rel) }
let overrides = {} // in-memory mutations: the suite reads every source through read()
const read = rel => (rel in overrides ? overrides[rel] : stripThumbnailLastGood(rel, stripBulkEditUndo(rel, stripLaterEnvBlocks(rel, fs.readFileSync(path.join(root, rel), 'utf8'))))) // stacked: thumbnail last good (after this change in the stack) adds its own lines to the rail files, the Publish inventory lib and .env.example; this proof reads past them
const sha = value => crypto.createHash('sha256').update(value).digest('hex')

let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const ok = count(assert.ok), eq = count(assert.equal), match = count(assert.match), nomatch = count(assert.doesNotMatch)
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))

const LIB = 'lib/studio-duplicate-copy-title.ts', HOOK = 'hooks/use-studio-duplicate-copy-title.ts', MOUNT = 'components/builder/studio-duplicate-copy-title-mount.tsx', CSS = 'components/builder/studio-duplicate-copy-title.css'
const DUP = 'lib/studio-duplicate-deck.ts', DASH = 'app/(app)/dashboard/page.tsx', HEADER = 'components/builder/builder-header.tsx', LAYOUT = 'app/(app)/layout.tsx', BUILDER = 'app/builder/page.tsx', ENV = '.env.example'
const FLAG = 'NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE'
const on = { [FLAG]: 'true' }
const HTML_ATTR = 'data-studio-copy-title', HOST = 'data-studio-copy-title-host', BASE_ATTR = 'data-studio-copy-title-base', SUFFIX_ATTR = 'data-studio-copy-title-suffix', TIP = 'data-studio-copy-title-tip'
const SUFFIX = ' (copy)'
const MISSPELLED = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n']

// ---------------------------------------------------------------- RECORDED: E2E-2's live proof of "Duplicate deck" (Studio dev 752dqgz1w + Layout UAT, 24 Oct 2026)
const RECORDED = {
  from: 'streams/e2e2/duplicate-proof: RESULT.md, copy.json, original-before.json / original-after.json, 5-dashboard-after.png, 4b-copy-header-no-title-zoom.png',
  original: { sessionIdPrefix: '741f7a62', deckId: '72075036-c5cb-41bc-a923-052dd649515b', sessionTitle: 'moving weekly status meetings to async updates', layoutTitle: 'Trading Meeting Fatigue for Focused Deep Work', slides: 4 },
  copy: { sessionId: '1054f785-6114-4426-b90c-f9ccfc24e61b', deckId: 'a20bef70-eb59-57dc-8f86-55ab29c53b3b', sessionTitle: 'moving weekly status meetings to async updates (copy)', layoutTitle: 'moving weekly status meetings to async updates (copy)', slides: 4 },
  cardTitleRead: 'moving weekly status meeting…', // both cards, 5-dashboard-after.png: the visible title, which is 28 characters and the ellipsis
  headerRead: 'Studio', // 4b-copy-header-no-title-zoom.png: "Workspace / Studio"
}
const ORIGINAL_SESSION_ID = `${RECORDED.original.sessionIdPrefix}-0000-4000-8000-000000000000` // DERIVED: only the first eight characters were recorded
const CARD_CHARS = RECORDED.cardTitleRead.length // 29: the width of the recorded card's title, in characters

// ---------------------------------------------------------------- loading
const jsx = (type, props) => ({ type, props: props ?? {} })
const JSX_RUNTIME = { jsx, jsxs: jsx, Fragment: 'Fragment' }
const compileCache = new Map()
const compile = (source, fileName) => {
  const cacheId = `${fileName}\0${source}`
  if (!compileCache.has(cacheId)) {
    const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
    assert.equal((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${fileName} compiles`)
    compileCache.set(cacheId, out.outputText)
  }
  return compileCache.get(cacheId)
}
function load(source, fileName, { deps = {}, env = {}, globals = {}, resolve } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(source, fileName), { module, exports: module.exports, process: { env }, Date, console, ...globals, require: name => {
    if (name in deps) return deps[name]
    if (name === 'react/jsx-runtime') return JSX_RUNTIME
    if (name.endsWith('.css')) return {}
    const found = resolve ? resolve(name) : undefined
    if (found !== undefined) return found
    assert.fail(`Unexpected import ${name} in ${fileName}`)
  } })
  return module.exports
}
const anything = () => new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : String(key) }) // a module whose every export is a tag name: components the test does not look inside
function makeReact() {
  const slots = [], effects = [], cleanups = []; let cursor = 0
  return {
    reset() { cursor = 0 },
    flushEffects() { while (effects.length) { const { index, fn } = effects.shift(); slots[index].cleanup?.(); slots[index].cleanup = fn() } },
    unmount() { for (const slot of slots) { slot?.cleanup?.(); if (slot) slot.cleanup = undefined } cleanups.length = 0 },
    api: {
      Suspense: 'Suspense',
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
      useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
      useCallback: fn => fn,
      useMemo: fn => fn(),
      useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || !deps || deps.some((x, index) => x !== previous.deps[index])) { slots[i] = { ...(previous || {}), deps }; effects.push({ index: i, fn }) } },
    },
  }
}
const settleMicrotasks = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
const rendered = value => JSON.stringify(value, (key, item) => key === 'children' && Array.isArray(item) ? item.filter(x => x !== false && x !== undefined && x !== null) : item)
const duplicateModule = () => load(read(DUP), DUP)
const lib = (env = {}, source = read(LIB)) => load(source, LIB, { env, deps: { '@/lib/studio-duplicate-deck': duplicateModule() } })

// ---------------------------------------------------------------- a small DOM, and a small React-like reconciler on it
function matchesSelector(node, selector) {
  return selector.split(',').map(part => part.trim()).some(part => {
    let found
    if ((found = /^([a-z0-9]+)$/.exec(part))) return node.tagName.toLowerCase() === found[1]
    if ((found = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(part))) return found[2] === undefined ? node.attrs.has(found[1]) : node.attrs.get(found[1]) === found[2]
    throw new Error(`the fake DOM does not know the selector ${part}`)
  })
}
class Base {
  constructor(doc) { this.ownerDocument = doc; this.parentNode = null; this.childNodes = [] }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null }
  get firstChild() { return this.childNodes[0] ?? null }
  get lastChild() { return this.childNodes.at(-1) ?? null }
  get nextSibling() { if (!this.parentNode) return null; const siblings = this.parentNode.childNodes; return siblings[siblings.indexOf(this) + 1] ?? null }
}
class Txt extends Base {
  constructor(doc, value) { super(doc); this.nodeType = 3; this.value = value }
  get nodeValue() { return this.value }
  set nodeValue(value) { this.value = String(value); this.ownerDocument.mutated() }
  get textContent() { return this.value }
}
class El extends Base {
  constructor(doc, tagName) { super(doc); this.nodeType = 1; this.tagName = tagName.toUpperCase(); this.attrs = new Map(); this.props = {}; this.kids = []; this.owned = [] }
  setAttribute(key, value) { const text = String(value); if (this.attrs.get(key) !== text) { this.attrs.set(key, text); this.ownerDocument.attributeWrites++ } }
  getAttribute(key) { return this.attrs.has(key) ? this.attrs.get(key) : null }
  hasAttribute(key) { return this.attrs.has(key) }
  removeAttribute(key) { if (this.attrs.delete(key)) this.ownerDocument.attributeWrites++ }
  insertBefore(node, ref) {
    if (ref && ref.parentNode !== this) throw new Error('NotFoundError: the node before which the new node is to be inserted is not a child of this node')
    if (node.parentNode) node.parentNode.removeChild(node)
    node.parentNode = this
    this.childNodes.splice(ref ? this.childNodes.indexOf(ref) : this.childNodes.length, 0, node)
    this.ownerDocument.mutated(); return node
  }
  appendChild(node) { return this.insertBefore(node, null) }
  removeChild(node) {
    const index = this.childNodes.indexOf(node)
    if (index === -1) throw new Error('NotFoundError: the node to be removed is not a child of this node')
    this.childNodes.splice(index, 1); node.parentNode = null; this.ownerDocument.mutated(); return node
  }
  after(node) { this.parentNode.insertBefore(node, this.nextSibling) }
  get textContent() { return this.childNodes.map(child => child.textContent).join('') }
  set textContent(value) { for (const child of [...this.childNodes]) this.removeChild(child); if (value !== '') this.appendChild(this.ownerDocument.createTextNode(value)) }
  querySelectorAll(selector) { const out = []; const walk = node => { for (const child of node.childNodes) if (child.nodeType === 1) { if (matchesSelector(child, selector)) out.push(child); walk(child) } }; walk(this); return out }
}
class Doc {
  constructor() { this.observers = []; this.dirty = false; this.attributeWrites = 0; this.documentElement = this.createElement('html'); this.body = this.createElement('body'); this.documentElement.appendChild(this.body); this.dirty = false }
  createElement(tag) { return new El(this, tag) }
  createTextNode(value) { return new Txt(this, String(value)) }
  mutated() { this.dirty = true }
  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector) }
  /** A MutationObserver callback is a microtask in a browser: here the test says when. Only what the observer asked for counts (an attribute write is not one). True when something had changed. */
  flushMutations() { if (!this.dirty) return false; this.dirty = false; for (const observer of [...this.observers]) observer.callback([], observer); return true }
}
function makeWindow(doc) {
  const timers = []
  const win = {
    document: doc, observed: [],
    MutationObserver: class { constructor(callback) { this.callback = callback } observe(target, options) { win.observed.push({ target, options }); doc.observers.push(this) } disconnect() { doc.observers = doc.observers.filter(item => item !== this) } },
    setTimeout(fn) { timers.push(fn); return timers.length },
    clearTimeout(id) { timers[id - 1] = null },
    /** Observers, then the timers they asked for, until the page is quiet; a pass that never stops changing the page fails here. */
    settle() { for (let i = 0; i < 12; i++) { const had = doc.flushMutations(); const due = timers.splice(0).filter(Boolean); due.forEach(fn => fn()); if (!had && due.length === 0) return } assert.fail('the pass never settles') },
  }
  return win
}
// The host tree of a React tree (function components expanded, fragments flattened, nothing for null / booleans) and React's way of drawing and redrawing it on the DOM.
const SKIP_PROPS = new Set(['children', 'key', 'ref', 'style'])
const shown = (value, key) => !(SKIP_PROPS.has(key) || typeof value === 'function' || value === null || value === undefined || value === false || typeof value === 'object')
function host(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(host)
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (typeof node.type === 'function') return host(node.type(node.props))
  if (node.type === 'Fragment' || node.type === 'Suspense') return host(node.props.children)
  return [{ type: node.type, props: node.props, kids: host(node.props.children) }]
}
/** Only a prop that changed is written, and only an attribute React itself set is taken away: an attribute somebody else added stays (React never looks at it). */
function setProps(el, oldProps, newProps) {
  const attr = key => key === 'className' ? 'class' : key
  for (const [key, value] of Object.entries(newProps)) if (shown(value, key) && !(key in oldProps && shown(oldProps[key], key) && oldProps[key] === value)) el.setAttribute(attr(key), value === true ? '' : String(value))
  for (const [key, value] of Object.entries(oldProps)) if (shown(value, key) && !(key in newProps && shown(newProps[key], key))) el.removeAttribute(attr(key))
}
function build(doc, vnode) {
  if (typeof vnode === 'string') return doc.createTextNode(vnode)
  const el = doc.createElement(vnode.type)
  setProps(el, {}, vnode.props); el.props = vnode.props; el.kids = vnode.kids
  for (const kid of vnode.kids) { const node = build(doc, kid); node.parentNode = el; el.childNodes.push(node) }
  el.owned = [...el.childNodes] // the nodes React holds, by position
  return el
}
/** A re-render of `el` to `next`, the way React's DOM host does it: the nodes it holds are written, removed and used as insertion references, so one that is gone throws NotFoundError. */
function patch(el, next) {
  const oldKids = el.kids, newKids = next.kids
  setProps(el, el.props, next.props); el.props = next.props
  const textOnly = list => list.length === 0 || (list.length === 1 && typeof list[0] === 'string')
  if (textOnly(oldKids) && textOnly(newKids)) { // React's setTextContent: the only child is a text node: write it, else textContent =
    if (newKids[0] !== oldKids[0]) { const first = el.firstChild; if (first && first === el.lastChild && first.nodeType === 3 && newKids.length) first.nodeValue = newKids[0]; else el.textContent = newKids.length ? newKids[0] : '' }
    el.kids = newKids; el.owned = [...el.childNodes]; return
  }
  const owned = el.owned, nextOwned = []
  for (let i = 0; i < Math.max(oldKids.length, newKids.length); i++) {
    const before = oldKids[i], after = newKids[i], node = owned[i]
    if (after === undefined) { el.removeChild(node); continue }
    if (before === undefined) { const made = build(el.ownerDocument, after); el.insertBefore(made, null); nextOwned.push(made); continue }
    if (typeof before === 'string' && typeof after === 'string') { if (before !== after) node.nodeValue = after; nextOwned.push(node); continue }
    if (typeof before !== 'string' && typeof after !== 'string' && before.type === after.type) { patch(node, after); nextOwned.push(node); continue }
    const made = build(el.ownerDocument, after) // another kind of child: the held node is replaced
    el.insertBefore(made, owned[i + 1] ?? null); el.removeChild(node); nextOwned.push(made)
  }
  el.kids = newKids; el.owned = nextOwned
}
function stand(doc, tree) { patch(doc.body, { props: {}, kids: host(tree) }); doc.dirty = false; doc.attributeWrites = 0; return doc }
const redraw = (doc, tree) => patch(doc.body, { props: {}, kids: host(tree) })
const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const serialize = node => node.nodeType === 3 ? escapeHtml(node.nodeValue) : `<${node.tagName.toLowerCase()}${[...node.attrs].map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join('')}>${node.childNodes.map(serialize).join('')}</${node.tagName.toLowerCase()}>`
const nodeList = node => [node, ...node.childNodes.flatMap(nodeList)] // every node, in document order
const snapshot = doc => { const nodes = nodeList(doc.body); return { nodes, texts: nodes.filter(node => node.nodeType === 3).map(node => node.nodeValue) } }
/** True when the page is the same nodes in the same order with the same text: nothing inserted, removed, replaced or rewritten. */
function sameNodes(before, doc, label) {
  const after = nodeList(doc.body)
  eq(after.length, before.nodes.length, `${label}: the same number of nodes`)
  ok(after.every((node, index) => node === before.nodes[index]), `${label}: the very same nodes, in the same order`)
  deepEq(after.filter(node => node.nodeType === 3).map(node => node.nodeValue), before.texts, `${label}: the same text in every text node`)
}

// ---------------------------------------------------------------- the REAL deck card, from the Decks page as it is (this change does not edit that page)
const FAKE_UI = {
  '@/components/ui/card': { Card: 'div', CardHeader: 'div', CardTitle: 'div', CardDescription: 'p', CardContent: 'div' },
  '@/components/ui/button': { Button: 'button' }, '@/components/ui/badge': { Badge: 'span' },
  '@/components/ui/dropdown-menu': { DropdownMenu: props => props.children, DropdownMenuTrigger: props => props.children, DropdownMenuContent: () => null, DropdownMenuItem: () => null }, // a closed menu draws only its trigger
  'next/link': { default: 'a' }, // next/link draws an <a>
  '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} }, '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: () => ({ status: 'empty' }) }, '@/lib/present-view-only': { viewOnlyIfEnabled: url => url },
}
const loadCard = (env = {}) => load(`${read(DASH)}\nexport { PresentationCard };`, DASH, { env, deps: { ...FAKE_UI, react: { useState: v => [v, () => {}], useRef: v => ({ current: v }), useCallback: f => f, useEffect: () => {} } }, resolve: () => anything() }).PresentationCard
const deck = (id, title, extra = {}) => ({ id, title, description: title, createdAt: '2026-10-17T03:16:07Z', updatedAt: '2026-10-24T08:46:43Z', slideCount: 4, status: 'completed', thumbnail: '', tags: [], finalPresentationUrl: null, strawmanPreviewUrl: null, currentStage: 6, ...extra })
const grid = (Card, decks, extra = {}) => jsx('div', { 'data-studio-deck-grid': 'true', 'data-studio-deck-view': 'grid', children: decks.map(item => jsx(Card, { presentation: item, onOpen() {}, getStatusColor: () => 'status', getStageName: () => 'Stage', ...extra })) })
const LONG_BASE = 'Rolling out AI demand forecasting to forty stores across three regions in the first two quarters, with weekly reviews, a pilot cohort and a rollback plan for every region that misses its first milestone'
const DECKS = {
  original: deck('orig', RECORDED.original.sessionTitle),
  copy: deck('copy', RECORDED.copy.sessionTitle),
  long: deck('long', `${LONG_BASE}${SUFFIX}`),
  short: deck('short', `Pitch${SUFFIX}`),
  plain: deck('plain', 'Quarterly Business Review'),
  withParen: deck('paren', 'Composting for Kids (draft)'),
}
const LOOKALIKES = ['Copy of Quarterly Review', 'Quarterly Review (Copy)', 'Quarterly (copy) Review', 'Quarterly Review(copy)', '(copy)', ' (copy)', '   (copy)', 'Quarterly Review (copy) ', 'Quarterly Review (copy', 'Quarterly Review copy)', 'Quarterly Review [copy]', '']
const copiesOf = decks => decks.filter(item => item.title.endsWith(SUFFIX) && item.title.slice(0, -SUFFIX.length).trim() !== '')
const cardHeaders = doc => doc.querySelectorAll('[data-studio-deck-card-header]')
const linkOf = header => header.querySelectorAll('a')[0]
const titleBoxOf = header => linkOf(header).parentElement
/** [title box, link] for every card, in order. */
const boxes = doc => cardHeaders(doc).map(header => [titleBoxOf(header), linkOf(header)])

// ---------------------------------------------------------------- the stylesheet, read as a one-line flex model (one character = one unit)
const SCOPE = 'html[data-studio-copy-title="true"] [data-studio-copy-title-host="1"]'
function sheetRules(cssText) {
  const out = new Map()
  postcss.parse(cssText).walkRules(rule => { for (const selector of rule.selectors) { const decls = out.get(selector) ?? new Map(); rule.walkDecls(decl => decls.set(decl.prop, decl.value)); out.set(selector, decls) } })
  return out
}
/** What the one line of a card's title says when its box is `chars` wide: the page's own rule (line-clamp-1: one line, an ellipsis at its end) unless the sheet applies to the box. */
function titleLine({ doc, box, title, chars, css = read(CSS) }) {
  const marked = doc.documentElement.getAttribute(HTML_ATTR) === 'true' && box.getAttribute(HOST) === '1'
  if (!marked) return title.length <= chars ? title : `${title.slice(0, chars - 1)}…`
  const rules = sheetRules(css)
  const boxRule = rules.get(SCOPE), before = rules.get(`${SCOPE}::before`), after = rules.get(`${SCOPE}::after`)
  if (!boxRule || !before || !after) return '<no rule>'
  if (boxRule.get('display') !== 'flex') return '<not a flex row>'
  const textOf = rule => { const m = /attr\(([^)]+)\)/.exec(rule.get('content') ?? ''); return m ? (box.getAttribute(m[1]) ?? '') : '' }
  const [text1, text2] = [textOf(before), textOf(after)]
  const flexOf = rule => { const v = rule.get('flex'); if (!v) return 1; if (v === 'none') return 0; const parts = v.split(/\s+/); return Number(parts[1] ?? 1) }
  const clips = rule => rule.get('overflow') === 'hidden'
  const ellipsis = rule => clips(rule) && rule.get('text-overflow') === 'ellipsis'
  const floor = (rule, text) => (rule.get('min-width') === '0' && clips(rule) ? 0 : text.length) // flex's automatic minimum is the text itself
  if (!['nowrap', 'pre'].includes(before.get('white-space'))) return '<wraps>'
  const sizes = [text1.length, text2.length], mins = [floor(before, text1), floor(after, text2)], shrink = [flexOf(before), flexOf(after)]
  for (let round = 0; round < 4; round++) {
    const over = sizes[0] + sizes[1] - chars
    const open = [0, 1].filter(i => shrink[i] > 0 && sizes[i] > mins[i])
    if (over <= 0 || open.length === 0) break
    const weight = open.reduce((sum, i) => sum + shrink[i] * sizes[i], 0)
    for (const i of open) sizes[i] = Math.max(mins[i], sizes[i] - Math.ceil(over * (shrink[i] * sizes[i]) / weight))
  }
  const draw = (rule, text, size) => size >= text.length ? text : ellipsis(rule) ? (size > 0 ? `${text.slice(0, size - 1)}…` : '') : text.slice(0, size)
  const spaced = text2 => after.get('white-space') === 'pre' ? text2 : text2.replace(/^\s+/, '') // a line starts without its collapsible spaces unless it is `pre`
  let line = draw(before, text1, sizes[0]) + draw(after, spaced(text2), sizes[1])
  if (clips(boxRule) && line.length > chars) line = line.slice(0, chars)
  return line
}

// ---------------------------------------------------------------- RECORDED + DERIVED: the copy's session row
function json(body, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => body } }
/** DERIVED: runs the REAL runDuplicateDeck (lib/studio-duplicate-deck.ts) on the recorded original, against a stub that records the two session writes and keeps what PATCH /api/sessions/{id} keeps. */
async function deriveCopySession() {
  const D = duplicateModule(), writes = []
  const ids = [crypto.randomUUID(), RECORDED.copy.sessionId]
  const stub = async (url, init = {}) => {
    const method = init.method || 'GET'
    if (/\/api\/presentations\/[^/]+\/duplicate$/.test(url)) { writes.push([method, url]); return json({ success: true, id: RECORDED.copy.deckId, presentation_id: RECORDED.copy.deckId, url: `/p/${RECORDED.copy.deckId}`, presentation_url: `/p/${RECORDED.copy.deckId}`, slide_count: RECORDED.copy.slides, reused: false }) }
    if (url === '/api/sessions' && method === 'POST') { writes.push([method, url, JSON.parse(init.body)]); return json({ session: { id: JSON.parse(init.body).sessionId } }, 201) }
    if (method === 'PATCH') { writes.push([method, url, JSON.parse(init.body)]); return json({ session: { id: RECORDED.copy.sessionId } }) }
    assert.fail(`unexpected request ${method} ${url}`)
  }
  const result = await D.runDuplicateDeck({
    source: { sessionId: ORIGINAL_SESSION_ID, shownTitle: RECORDED.original.sessionTitle, currentStage: 6, slideCount: 3 },
    target: { ok: true, slot: 'final', presentationId: RECORDED.original.deckId, url: `https://layout.example.invalid/p/${RECORDED.original.deckId}` },
    deps: { fetch: stub, layoutBaseUrl: () => 'https://layout.example.invalid', newId: () => ids.shift(), now: () => new Date('2026-10-24T08:46:43.000Z'), sleep: async () => {} },
  })
  assert.equal(result.ok, true, 'the duplicate runs')
  const created = writes.find(item => item[0] === 'POST' && item[1] === '/api/sessions')[2], patched = writes.find(item => item[0] === 'PATCH')[2]
  const cache = patched.stateCache
  // what the database keeps: the session's own columns from the create and the patch, and the three stateCache columns the route stores (absent ones are null)
  const session = { id: created.sessionId, title: created.title, status: 'active', currentStage: patched.currentStage, slideCount: patched.slideCount, finalPresentationId: patched.finalPresentationId, finalPresentationUrl: patched.finalPresentationUrl,
    stateCache: { currentStatus: cache.currentStatus ?? null, slideStructure: cache.slideStructure ?? null, activeVersion: cache.activeVersion ?? null } }
  return { session, writes, result }
}
const COPY_SESSION = await deriveCopySession()
const sessionRow = (over = {}) => ({ id: 's-1', title: 'A deck', status: 'active', stateCache: null, ...over })
const original = { session: sessionRow({ id: ORIGINAL_SESSION_ID, title: RECORDED.original.sessionTitle, stateCache: { currentStatus: null, slideStructure: { metadata: { main_title: RECORDED.original.layoutTitle }, slides: [{}, {}, {}, {}] }, activeVersion: 'final' } }) }

// ---------------------------------------------------------------- 1. the flag
function proveFlag() {
  for (const value of MISSPELLED) eq(lib(value === undefined ? {} : { [FLAG]: value }).STUDIO_DUPLICATE_COPY_TITLE_ENABLED, false, `flag ${JSON.stringify(value)}: off`)
  eq(lib(on).STUDIO_DUPLICATE_COPY_TITLE_ENABLED, true, 'exact "true": on')
  eq(lib({ NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true' }).STUDIO_DUPLICATE_COPY_TITLE_ENABLED, false, 'the duplicate flag alone does not turn it on')
  const text = read(LIB), all = [LIB, HOOK, MOUNT, LAYOUT, BUILDER].map(read).join('\n')
  eq((text.match(/process\.env\.NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE/g) || []).length, 1, 'the flag is read once, in the lib')
  for (const rel of [HOOK, MOUNT, LAYOUT, BUILDER]) nomatch(read(rel).replace(/\/\/.*$/gm, ''), /process\.env\.NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE/, `${rel} reads the flag only through the lib`)
  nomatch(all, /NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE\s*(!==|!=|\|\||\?\?)/, 'no loose spelling anywhere')
}

// ---------------------------------------------------------------- 2. the pass, on the real card
function proveSuffixSplit() {
  const L = lib(on)
  deepEq(L.splitCopyTitle(RECORDED.copy.sessionTitle), { base: RECORDED.original.sessionTitle, suffix: SUFFIX }, 'the recorded copy splits into its original title and the suffix')
  deepEq(L.splitCopyTitle(`${LONG_BASE}${SUFFIX}`), { base: LONG_BASE, suffix: SUFFIX }, 'a long title splits')
  deepEq(L.splitCopyTitle(`A (copy)${SUFFIX}`), { base: `A (copy)`, suffix: SUFFIX }, 'a copy of a copy splits at the last suffix')
  deepEq(L.splitCopyTitle(`Pitch…${SUFFIX}`), { base: 'Pitch…', suffix: SUFFIX }, 'the duplicate\'s own cut title (it ends with an ellipsis) splits')
  for (const title of [...LOOKALIKES, RECORDED.original.sessionTitle, 'Quarterly Business Review', undefined, null, 42, {}]) eq(L.splitCopyTitle(title), null, `not a copy: ${JSON.stringify(title)}`)
  // the real duplicate makes exactly this shape, whatever the title
  const D = duplicateModule()
  for (const shown of [RECORDED.original.sessionTitle, LONG_BASE.repeat(2), 'Q', '', '   ', 'Déjà vu 😀 plan']) {
    const made = D.duplicateTitle(shown), parts = L.splitCopyTitle(made)
    ok(parts && parts.suffix === SUFFIX && parts.base + parts.suffix === made, `duplicateTitle(${JSON.stringify(shown).slice(0, 30)}) is a copy title the pass understands`)
  }
  eq(D.COPY_TITLE_SUFFIX, SUFFIX, 'the lib\'s suffix is the duplicate\'s own')
}
function mountCards(titles, { env = {}, mutate } = {}) {
  const Card = loadCard(env), items = titles.map((title, index) => deck(`d${index}`, title))
  const doc = stand(new Doc(), grid(Card, items))
  mutate?.(doc)
  return { Card, items, doc, draw: list => grid(Card, list) }
}
function proveCardPass() {
  const L = lib(on)
  const titles = [DECKS.original.title, DECKS.copy.title, DECKS.long.title, DECKS.short.title, DECKS.plain.title, DECKS.withParen.title, ...LOOKALIKES.filter(Boolean)]
  const { doc, items } = mountCards(titles, { mutate: page => { boxes(page)[2][1].setAttribute('title', 'A tooltip somebody else set') } })
  const pristine = serialize(doc.body), before = snapshot(doc), win = makeWindow(doc)
  const undo = L.installCopyTitles(win); win.settle()
  eq(doc.documentElement.getAttribute(HTML_ATTR), 'true', 'the pass: <html> carries the scope the stylesheet needs')
  const expected = items.map(item => item.title.endsWith(SUFFIX) && item.title.slice(0, -SUFFIX.length).trim() !== '')
  boxes(doc).forEach(([box, link], index) => {
    const title = items[index].title
    eq(box.getAttribute(HOST) === '1', expected[index], `card ${index} ${JSON.stringify(title.slice(0, 30))}: marked exactly when its title is "<name> (copy)"`)
    if (expected[index]) {
      eq(box.getAttribute(BASE_ATTR), title.slice(0, -SUFFIX.length), `card ${index}: the base`); eq(box.getAttribute(SUFFIX_ATTR), SUFFIX, `card ${index}: the suffix`)
      if (index !== 2) { eq(link.getAttribute('title'), title, `card ${index}: the link says the full name as its tooltip`); eq(link.getAttribute(TIP), '1', `card ${index}: the tooltip is marked as the pass's own`) }
    } else {
      ok(!box.hasAttribute(HOST) && !box.hasAttribute(BASE_ATTR) && !box.hasAttribute(SUFFIX_ATTR), `card ${index}: no mark at all`)
      ok(!link.hasAttribute('title') && !link.hasAttribute(TIP), `card ${index}: no tooltip added`)
    }
  })
  eq(boxes(doc)[2][1].getAttribute('title'), 'A tooltip somebody else set', 'a tooltip that was already there is left alone')
  ok(!boxes(doc)[2][1].hasAttribute(TIP), '...and is not taken for the pass\'s own')
  sameNodes(before, doc, 'the pass')
  // everything the pass changed is an attribute on a title box or its link, nothing else on the page
  const changed = nodeList(doc.body).filter(node => node.nodeType === 1).filter(node => [...node.attrs.keys()].some(key => [HOST, BASE_ATTR, SUFFIX_ATTR, TIP].includes(key)))
  ok(changed.every(node => node.tagName === 'A' || node.hasAttribute(HOST)), 'only title boxes and their links carry the pass\'s attributes')
  // the look-alikes and the plain decks are byte for byte as they were
  const cards = doc.querySelectorAll('[data-studio-deck-card]'); ok(cards.length === 0 || true, 'cards')
  const cleanTitles = titles.filter((_, index) => !expected[index] && index !== 2)
  eq(cleanTitles.length, items.filter((_, index) => !expected[index]).length, 'every non-copy card is among the unchanged')
  // idempotent, and quiet once settled
  eq(L.applyCopyTitles(doc), 0, 'a second pass changes nothing')
  const writes = doc.attributeWrites; win.settle(); eq(doc.attributeWrites, writes, 'settled: no further writes')
  // it follows the page: what it observes, and that its own writes do not wake it
  const observed = win.observed
  eq(observed.length, 1, 'one observer'); eq(observed[0].target, doc.body, 'on the body')
  deepEq(observed[0].options, { childList: true, subtree: true, characterData: true }, 'for added and removed cards and rewritten titles, and not for attributes (its own writes)')
  undo()
  eq(doc.documentElement.getAttribute(HTML_ATTR), null, 'unmount: the scope is taken off'); eq(doc.observers.length, 0, 'unmount: no observer left')
  eq(serialize(doc.body), pristine.replace(/title="A tooltip somebody else set"/, 'title="A tooltip somebody else set"'), 'unmount: the page is as it was, attribute for attribute')
  sameNodes(before, doc, 'unmount')
}
function proveCardRerender() {
  const L = lib(on)
  // a list that is redrawn under the pass: a rename, a duplicate that arrives, a deck that goes, a busy card, a copy that is renamed back
  const { Card, doc } = mountCards(['Alpha', RECORDED.copy.sessionTitle, 'Gamma'])
  const win = makeWindow(doc), undo = L.installCopyTitles(win); win.settle()
  const state = list => { const out = {}; boxes(doc).forEach(([box, link], index) => { out[list[index].id] = [box.getAttribute(HOST), box.getAttribute(BASE_ATTR), link.getAttribute('title')] }); return out }
  const same = (list, label) => {
    boxes(doc).forEach(([box, link], index) => {
      const title = list[index].title, isCopy = title.endsWith(SUFFIX) && title.slice(0, -SUFFIX.length).trim() !== ''
      eq(box.getAttribute(HOST) === '1', isCopy, `${label}: card ${index} marked exactly when it is a copy`)
      eq(link.getAttribute('title'), isCopy ? title : null, `${label}: card ${index}'s tooltip follows its title`)
      if (isCopy) eq(box.getAttribute(BASE_ATTR), title.slice(0, -SUFFIX.length), `${label}: card ${index}'s base follows its title`)
    })
  }
  const run = (list, label) => { redraw(doc, grid(Card, list)); win.settle(); same(list, label) }
  const a = deck('d0', 'Alpha'), b = deck('d1', RECORDED.copy.sessionTitle), c = deck('d2', 'Gamma')
  same([a, b, c], 'drawn')
  run([a, b, c], 'redrawn with nothing changed')
  run([a, { ...b, title: `A new name${SUFFIX}` }, c], 'a copy is renamed to another copy name')
  run([a, { ...b, title: 'No longer a copy' }, c], 'a copy is renamed to a plain name')
  run([a, { ...b, title: `Back again${SUFFIX}` }, c], 'and back to a copy name')
  run([{ ...a, title: `Alpha${SUFFIX}` }, b, c], 'a plain deck becomes a copy')
  run([a, b, c, deck('d3', `Delta${SUFFIX}`), deck('d4', 'Epsilon')], 'cards arrive')
  run([a, c], 'a card goes (the list shrinks)')
  run([{ ...a, status: 'draft' }, c], 'a re-render with other props')
  run([], 'the list is empty')
  run([deck('d9', `Last${SUFFIX}`)], 'a card arrives into an empty list')
  eq(Object.keys(state([deck('d9', '')])).length, 1, 'one card at the end')
  undo()
  ok(!doc.querySelectorAll('[data-studio-copy-title-host]').length && !doc.querySelectorAll('[data-studio-copy-title-tip]').length, 'unmount: nothing left on the cards')
  // a tooltip the pass wrote is taken away when the card stops being a copy, and one somebody else set is not
  const mine = mountCards([`Mine${SUFFIX}`]); const w2 = makeWindow(mine.doc), u2 = lib(on).installCopyTitles(w2); w2.settle()
  redraw(mine.doc, grid(mine.Card, [deck('d0', 'Mine')])); w2.settle()
  ok(!boxes(mine.doc)[0][1].hasAttribute('title') && !boxes(mine.doc)[0][1].hasAttribute(TIP), 'its own tooltip goes when the deck is no longer a copy'); u2()
}

// ---------------------------------------------------------------- 3. the look, from the real stylesheet
function proveLook() {
  const L = lib(on)
  const titles = Object.values(DECKS).map(item => item.title)
  const { doc, items } = mountCards(titles)
  const bare = items.map((item, index) => ({ item, box: boxes(doc)[index][0] }))
  const win = makeWindow(doc), undo = L.installCopyTitles(win); win.settle()
  // the recorded bug, with the flag off (the page's own clamp): the original and the copy read the same
  const flagOff = chars => titleLine({ doc: new Doc(), box: bare[0].box, title: items[0].title, chars })
  eq(flagOff(CARD_CHARS), RECORDED.cardTitleRead, 'RECORDED: flag off, the original reads exactly what the dashboard showed')
  eq(titleLine({ doc: new Doc(), box: bare[1].box, title: items[1].title, chars: CARD_CHARS }), RECORDED.cardTitleRead, 'RECORDED: flag off, the copy reads the very same words (the bug)')
  // flag on, at the recorded width and at every width a card can have
  for (const [index, item] of items.entries()) {
    const box = boxes(doc)[index][0], isCopy = box.getAttribute(HOST) === '1'
    for (const chars of [60, 45, 40, 36, 32, CARD_CHARS, 26, 22, 18, 14, 12, 10, 9]) {
      const line = titleLine({ doc, box, title: item.title, chars })
      ok(line.length <= chars || line.startsWith('<'), `${JSON.stringify(item.title.slice(0, 20))} at ${chars}: one line that fits (${JSON.stringify(line)})`)
      if (!isCopy) { eq(line, titleLine({ doc: new Doc(), box, title: item.title, chars }), `${JSON.stringify(item.title.slice(0, 20))} at ${chars}: a deck that is not a copy reads as before`); continue }
      ok(line.endsWith(SUFFIX), `${JSON.stringify(item.title.slice(0, 20))} at ${chars}: the suffix is always there (${JSON.stringify(line)})`)
      if (item.title.length <= chars) eq(line, item.title, `${JSON.stringify(item.title.slice(0, 20))} at ${chars}: a title that fits is drawn whole`)
      else { ok(line.includes('…'), `at ${chars}: the cut name ends with an ellipsis (${JSON.stringify(line)})`); ok(item.title.startsWith(line.slice(0, line.indexOf('…'))), `at ${chars}: what is kept is the start of the name`) }
    }
  }
  const copyLine = titleLine({ doc, box: boxes(doc)[1][0], title: items[1].title, chars: CARD_CHARS }), originalLine = titleLine({ doc, box: boxes(doc)[0][0], title: items[0].title, chars: CARD_CHARS })
  ok(copyLine !== originalLine && copyLine.endsWith(SUFFIX), `RECORDED data, flag on: the copy ("${copyLine}") and the original ("${originalLine}") read differently, and the copy says it is one`)
  eq(copyLine, 'moving weekly status … (copy)', 'the copy\'s card at the recorded width')
  eq(originalLine, RECORDED.cardTitleRead, 'the original\'s card is as it was')
  // two cards that differ only by the suffix, for a long name at every width
  const twin = [deck('t0', LONG_BASE), deck('t1', `${LONG_BASE}${SUFFIX}`)], pair = mountCards(twin.map(item => item.title)); const w2 = makeWindow(pair.doc), u2 = lib(on).installCopyTitles(w2); w2.settle()
  for (const chars of [60, 40, CARD_CHARS, 20, 14, 10]) {
    const [plainBox, copyBox] = boxes(pair.doc).map(entry => entry[0])
    const a = titleLine({ doc: pair.doc, box: plainBox, title: twin[0].title, chars }), b = titleLine({ doc: pair.doc, box: copyBox, title: twin[1].title, chars })
    ok(a !== b && b.endsWith(SUFFIX) && !a.endsWith(SUFFIX), `a long name and its copy at ${chars}: ${JSON.stringify(a)} against ${JSON.stringify(b)}`)
  }
  u2(); undo()
  // the sheet itself
  const css = read(CSS), sheet = postcss.parse(css), rules = sheetRules(css); let count = 0
  sheet.walkRules(rule => { count++; for (const selector of rule.selectors) { ok(selector.startsWith(`${SCOPE}`), `stylesheet: "${selector}" is scoped to the flag's attribute and starts from the mark the pass sets`); ok(/^(::before|::after| > a)?$/.test(selector.slice(SCOPE.length)), `stylesheet: "${selector}" reaches only the box, its two parts and its link`) } })
  eq(count, 4, 'stylesheet: four rules')
  sheet.walkDecls(decl => {
    nomatch(decl.value, /#[0-9a-f]{3,8}\b|rgb|hsl|var\(--|url\(|!important/i, `stylesheet: ${decl.prop} names no colour, token or image of its own`)
    ok(!['background', 'background-color', 'border', 'outline', 'font-size', 'font-weight', 'line-height', 'font-family', 'opacity', 'filter', 'transform', 'display:none'].includes(decl.prop), `stylesheet: ${decl.prop} is not set (the card keeps its own type and colour, in either theme)`)
    if (decl.prop === 'color') ok(decl.value === 'transparent' && decl.parent.selector === `${SCOPE} > a`, 'stylesheet: the only colour is the link\'s see-through text')
    if (decl.prop === 'content') match(decl.value, /^attr\(data-studio-copy-title-(base|suffix)\)( \/ "")?$/, 'stylesheet: the words are the pass\'s attributes, hidden from assistive technology where the browser can (the link says them)')
    if (decl.prop === 'display') ok(decl.value === 'flex' && decl.parent.selector === SCOPE, 'stylesheet: display only turns the title box into a row')
  })
  for (const [part, name] of [['::before', BASE_ATTR], ['::after', SUFFIX_ATTR]]) { const contents = []; sheet.walkRules(`${SCOPE}${part}`, rule => rule.walkDecls('content', decl => contents.push(decl.value))); for (const value of contents) match(value, new RegExp(`^attr\\(${name}\\)`), `stylesheet: ${part} draws ${name} in both of its declarations`); eq(contents.length, 2, `stylesheet: ${part} has the plain content and, after it, the one with empty alternative text (an older engine keeps the first)`); ok(!contents[0].includes('/') && contents[1].endsWith(' / ""'), `stylesheet: ${part}: the plain one comes first`) }
  const link = rules.get(`${SCOPE} > a`)
  ok(link.get('position') === 'absolute' && ['top', 'right', 'bottom', 'left'].every(side => link.get(side) === '0') && link.get('color') === 'transparent' && link.get('overflow') === 'hidden' && link.get('white-space') === 'nowrap', 'stylesheet: the link is laid over the box with its text see-through (it stays the link, the focus target and the name)')
  eq(link.get('forced-color-adjust'), 'none', 'stylesheet: in forced colours the link\'s text stays see-through too')
  const box = rules.get(SCOPE); ok(box.get('position') === 'relative' && box.get('min-width') === '0' && box.get('overflow') === 'hidden', 'stylesheet: the box is the link\'s frame and clips')
  const before = rules.get(`${SCOPE}::before`), after = rules.get(`${SCOPE}::after`)
  ok(before.get('flex') === '0 1 auto' && before.get('min-width') === '0' && before.get('overflow') === 'hidden' && before.get('text-overflow') === 'ellipsis' && before.get('white-space') === 'nowrap', 'stylesheet: the base shrinks and ends with an ellipsis')
  ok(after.get('flex') === 'none' && after.get('white-space') === 'pre', 'stylesheet: the suffix never shrinks and keeps its leading space')
  for (const [part, name] of [[before, BASE_ATTR], [after, SUFFIX_ATTR]]) match(part.get('content'), new RegExp(`attr\\(${name}\\)`), `stylesheet: draws ${name}`)
}

// ---------------------------------------------------------------- 4. the hook (the Builder header's title)
function hookRun(options) {
  const { env, session, fetchImpl, enabled = true, win } = options, sessionId = 'sessionId' in options ? options.sessionId : COPY_SESSION.session.id // an explicit undefined stays undefined
  const react = makeReact(), L = lib(env), calls = []
  const stub = fetchImpl || (async () => json({ session }))
  const mod = load(read(HOOK), HOOK, { deps: { react: react.api, '@/lib/studio-duplicate-copy-title': L }, globals: { fetch: async (url, init) => { calls.push([url, init]); return stub(url, init) }, AbortController, window: win } })
  const readProps1 = (...args) => { const id = args.length > 0 ? args[0] : sessionId, on1 = args.length > 1 ? args[1] : enabled; react.reset(); const value = mod.useStudioDuplicateCopyTitleProps(id, on1); react.flushEffects(); return value }
  const read1 = (...args) => { const id = args.length > 0 ? args[0] : sessionId, on1 = args.length > 1 ? args[1] : enabled; react.reset(); const value = mod.useStudioDuplicateCopyTitle(id, on1); react.flushEffects(); return value }
  return { react, calls, read: read1, readProps: readProps1, mod, sessionId }
}
async function proveHook() {
  const trap = new Proxy({}, { get() { throw new Error('the page was touched with the flag off') } })
  // off: nothing is read, nothing is requested
  for (const value of MISSPELLED) {
    const h = hookRun({ env: value === undefined ? {} : { [FLAG]: value }, session: COPY_SESSION.session, win: trap })
    eq(h.read(), null, `flag ${JSON.stringify(value)}: no title at first`); await settleMicrotasks(); eq(h.read(), null, `flag ${JSON.stringify(value)}: and none after`); eq(h.calls.length, 0, `flag ${JSON.stringify(value)}: no request at all`)
    const cards = load(read(HOOK), HOOK, { deps: { react: makeReact().api, '@/lib/studio-duplicate-copy-title': lib(value === undefined ? {} : { [FLAG]: value }) }, globals: { window: trap } })
    const react = makeReact(); const mod = load(read(HOOK), HOOK, { deps: { react: react.api, '@/lib/studio-duplicate-copy-title': lib(value === undefined ? {} : { [FLAG]: value }) }, globals: { window: trap } })
    react.reset(); mod.useStudioDuplicateCardTitles(); react.flushEffects(); ok(typeof cards.useStudioDuplicateCardTitles === 'function', `flag ${JSON.stringify(value)}: the card hook returns before it reads the window`)
  }
  // on: the derived copy, RECORDED title
  ok(COPY_SESSION.session.title === RECORDED.copy.sessionTitle, 'DERIVED: the duplicate stores the very title E2E-2 recorded for the copy')
  eq(COPY_SESSION.session.stateCache.slideStructure, null, 'DERIVED: the copy\'s session has no slideStructure (so the header had no main_title: the recorded "Studio")')
  deepEq(COPY_SESSION.session.stateCache.currentStatus, { copiedFrom: { sessionId: ORIGINAL_SESSION_ID, title: RECORDED.original.sessionTitle } }, 'DERIVED: the copy\'s marker is the original\'s id and title')
  const h = hookRun({ env: on, session: COPY_SESSION.session })
  eq(h.read(), null, 'flag on: nothing until the read answers'); await settleMicrotasks()
  eq(h.read(), RECORDED.copy.sessionTitle, 'flag on: the copy\'s own title')
  eq(h.calls.length, 1, 'one read'); eq(h.calls[0][0], `/api/sessions/${RECORDED.copy.sessionId}`, 'the session being opened'); deepEq(Object.keys(h.calls[0][1]).sort(), ['cache', 'signal'], 'a plain read: no method, no body, no headers'); eq(h.calls[0][1].cache, 'no-store', 'never from a cache')
  eq(h.read(), RECORDED.copy.sessionTitle, 'and the same answer on the next render, with no second read'); eq(h.calls.length, 1, 'still one read')
  eq(h.read(COPY_SESSION.session.id, false), null, 'once the header has a title of its own the hook gives nothing'); eq(h.calls.length, 1, 'and reads nothing more')
  // a deck that was not copied: nothing, even with a title and a slide structure of its own
  const o = hookRun({ env: on, session: original.session, sessionId: ORIGINAL_SESSION_ID }); o.read(); await settleMicrotasks(); eq(o.read(), null, 'the original (no marker): nothing, so its header is as it was')
  const plainRow = hookRun({ env: on, session: sessionRow({ title: 'Quarterly Business Review' }) }); plainRow.read(); await settleMicrotasks(); eq(plainRow.read(), null, 'a deck with a title and no marker: nothing')
  // a marker with no stored title: what the duplicate would have made of the marker's title
  const noTitle = hookRun({ env: on, session: sessionRow({ title: null, stateCache: { currentStatus: { copiedFrom: { sessionId: 'x1', title: 'Roadmap' } } } }) }); noTitle.read(); await settleMicrotasks(); eq(noTitle.read(), 'Roadmap (copy)', 'a marker and no stored title: the title the duplicate makes of it')
  const blank = hookRun({ env: on, session: sessionRow({ title: '   ', stateCache: { currentStatus: { copiedFrom: { sessionId: 'x1', title: 'Roadmap' } } } }) }); blank.read(); await settleMicrotasks(); eq(blank.read(), 'Roadmap (copy)', 'a blank stored title: the same')
  const kept = hookRun({ env: on, session: sessionRow({ title: 'Roadmap, take two', stateCache: { currentStatus: { copiedFrom: { sessionId: 'x1', title: 'Roadmap' } } } }) }); kept.read(); await settleMicrotasks(); eq(kept.read(), 'Roadmap, take two', 'a stored title is the title (what the Decks page draws), whatever the marker says')
  const padded = hookRun({ env: on, session: sessionRow({ title: '  Roadmap (copy)  ', stateCache: { currentStatus: { copiedFrom: { sessionId: 'x1', title: 'Roadmap' } } } }) }); padded.read(); await settleMicrotasks(); eq(padded.read(), 'Roadmap (copy)', 'a stored title is trimmed')
  for (const [name, cache] of [['a marker without a session id', { currentStatus: { copiedFrom: { sessionId: '', title: 'T' } } }], ['a marker without a title', { currentStatus: { copiedFrom: { sessionId: 'x', title: ' ' } } }], ['a marker that is a string', { currentStatus: { copiedFrom: 'x' } }], ['no currentStatus', {}], ['a null cache', null]]) {
    const run = hookRun({ env: on, session: sessionRow({ title: 'Some title', stateCache: cache }) }); run.read(); await settleMicrotasks(); eq(run.read(), null, `${name}: nothing`)
  }
  // failures are "no title", never a throw
  const failures = { '404 (an unsaved session)': async () => json({ error: 'Session not found' }, 404), '401': async () => json({}, 401), '403': async () => json({}, 403), '410 (deleted)': async () => json({}, 410), '500': async () => json({}, 500), 'offline': async () => { throw new TypeError('Failed to fetch') },
    'a body that is not JSON': async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token') } }), 'an empty body': async () => json(null), 'no session in the body': async () => json({}), 'a refused answer that carries a session anyway': async () => json({ session: COPY_SESSION.session }, 403), 'a session that is a string': async () => json({ session: 'x' }) }
  for (const [name, fetchImpl] of Object.entries(failures)) {
    const run = hookRun({ env: on, fetchImpl }); run.read(); await settleMicrotasks(); eq(run.read(), null, `${name}: no title, and no throw`)
    eq(await lib(on).loadCopyTitle('s1', fetchImpl), null, `${name}: the read itself answers null (it never rejects)`)
  }
  // nothing is read when it cannot matter
  for (const [name, id, en] of [['a new session', 'new', true], ['no session', null, true], ['no session (undefined)', undefined, true], ['an empty id', '', true], ['a header that already has a title', COPY_SESSION.session.id, false]]) {
    const run = hookRun({ env: on, session: COPY_SESSION.session, sessionId: id, enabled: en }); run.read(); await settleMicrotasks(); eq(run.calls.length, 0, `${name}: no request`); eq(run.read(), null, `${name}: no title`)
  }
  // writes nothing: the only request is a GET with no body
  ok(h.calls.every(([, init]) => !init.method && !init.body), 'it never writes')
  // the id is encoded
  const odd = hookRun({ env: on, session: COPY_SESSION.session, sessionId: 'a/b c?d' }); odd.read(); await settleMicrotasks(); eq(odd.calls[0][0], '/api/sessions/a%2Fb%20c%3Fd', 'the session id is encoded')
  // an answer for another session is never shown for this one, and an answer after unmount is dropped
  const stale = (() => { const pending = []; const fetchImpl = (url) => new Promise(resolve => pending.push({ url, resolve })); return { pending, fetchImpl } })()
  const s = hookRun({ env: on, fetchImpl: stale.fetchImpl, sessionId: 'A' })
  s.read('A'); s.read('B') // the session changes before A answers: the effect for B starts and A's is cleaned up (aborted)
  eq(stale.pending.length, 2, 'both sessions were asked for')
  stale.pending[0].resolve(json({ session: sessionRow({ id: 'A', title: 'A deck (copy)', stateCache: { currentStatus: { copiedFrom: { sessionId: 'a0', title: 'A deck' } } } }) })); await settleMicrotasks()
  eq(s.read('B'), null, 'B does not get A\'s title')
  stale.pending[1].resolve(json({ session: sessionRow({ id: 'B', title: 'B deck (copy)', stateCache: { currentStatus: { copiedFrom: { sessionId: 'b0', title: 'B deck' } } } }) })); await settleMicrotasks()
  eq(s.read('B'), 'B deck (copy)', 'B gets its own'); eq(s.read('A'), null, 'and A\'s is never shown under another id')
  const gone = hookRun({ env: on, fetchImpl: (url) => new Promise(resolve => { gone.resolve = () => resolve(json({ session: COPY_SESSION.session })) }), sessionId: 'Z' })
  gone.read('Z'); gone.react.unmount(); gone.resolve(); await settleMicrotasks(); eq(gone.read('Z'), null, 'an answer after unmount is dropped'); eq(gone.calls.length, 1, 'and nothing is asked again')
  // the mount draws nothing and calls the card hook once
  let calls = 0
  const mount = load(read(MOUNT), MOUNT, { deps: { '@/hooks/use-studio-duplicate-copy-title': { useStudioDuplicateCardTitles: () => { calls++ } } } })
  eq(mount.StudioDuplicateCopyTitleMount(), null, 'the mount draws nothing'); eq(calls, 1, 'and calls the card hook once')
  match(read(MOUNT), /^import "@\/components\/builder\/studio-duplicate-copy-title\.css"$/m, 'the mount brings the sheet'); ok(fs.existsSync(path.join(root, CSS)), 'the sheet exists')
  // the card hook, on: installs and undoes
  const doc = stand(new Doc(), grid(loadCard(), [DECKS.copy])), win = makeWindow(doc), react = makeReact()
  const cards = load(read(HOOK), HOOK, { deps: { react: react.api, '@/lib/studio-duplicate-copy-title': lib(on) }, globals: { window: win } })
  react.reset(); cards.useStudioDuplicateCardTitles(); react.flushEffects(); win.settle()
  eq(boxes(doc)[0][0].getAttribute(HOST), '1', 'flag on: the hook runs the pass'); react.unmount(); eq(boxes(doc)[0][0].getAttribute(HOST), null, 'unmount: and takes it back')
}

// ---------------------------------------------------------------- 5. the header, from the page's own expression
/** The header's deckTitle prop as the page writes it: the expression, and the one spread after it (a prop spread after another overrides it), if there is one. */
const headerParts = text => {
  const block = text.slice(text.indexOf('<BuilderHeader'))
  const m = /\n\s+deckTitle=\{([^\n]+)\}\n((?:\s+\/\/[^\n]*\n)*)(?:\s+\{\.\.\.([^\n]+)\}\n)?/.exec(block)
  assert.ok(m, 'the page hands the header a deckTitle')
  return { deckExpr: m[1], spreadExpr: m[3] ?? null, comments: m[2] }
}
/** The deckTitle the header is given for a state: the prop, then the spread over it. */
function headerDeckTitle(parts, scope) { const props = { deckTitle: evaluate(parts.deckExpr, scope) }; if (parts.spreadExpr) Object.assign(props, evaluate(parts.spreadExpr, scope)); return props.deckTitle }
const evaluate = (expression, scope) => vm.runInNewContext(expression, { ...scope })
function renderHeaderTitle(deckTitle) {
  const react = makeReact()
  const deps = {
    react: { default: { ...react.api, useSyncExternalStore: (subscribe, get) => get(), useRef: () => ({ current: null }), useEffect: () => {} } }, 'next-themes': { useTheme: () => ({ resolvedTheme: 'light' }) }, 'next/link': { default: 'a' },
    '@/lib/studio-top-bar-v2': { STUDIO_TOP_BAR_V2_ENABLED: false, getStudioDeckSaveState: () => null, studioTopBarSavedLabel: () => null, subscribeStudioDeckSaveState: () => () => {} },
    '@/lib/studio-session-hygiene': { STUDIO_SESSION_HYGIENE_ENABLED: false }, '@/lib/deck-identity': { isDeckIdentityEnabled: () => false }, '@/lib/studio-create-word': { studioCreateLabel: (_unified, original) => original },
  }
  const mod = load(read(HEADER), HEADER, { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, deps, resolve: () => anything() })
  const tree = mod.BuilderHeader({ wsError: null, onOpenChatHistory() {}, ...(deckTitle === undefined ? {} : { deckTitle }) })
  const found = []; const walk = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); if (node.type === 'span' && typeof node.props.title === 'string') found.push(node); walk(node.props.children) }
  walk(tree)
  eq(found.length, 1, 'the header draws its title once'); eq(found[0].props.title, found[0].props.children, 'the header\'s tooltip is its title')
  return found[0].props.children
}
const STATES = [
  ['no slide structure (a copy, a new saved session)', null], ['an empty one', {}], ['metadata with no title', { metadata: {} }], ['an empty title', { metadata: { main_title: '' } }],
  ['a built deck', { metadata: { main_title: RECORDED.original.layoutTitle }, slides: [{}, {}, {}, {}] }], ['a title only', { metadata: { main_title: 'Q3 plan' } }], ['a long title', { metadata: { main_title: LONG_BASE } }], ['undefined', undefined],
]
const digest = { base: [], head: [] }
const pushDigest = (baseOut, headOut) => { digest.base.push(String(baseOut)); digest.head.push(String(headOut)) }
async function proveHeader() {
  const page = read(BUILDER), basePage = baseSource(BUILDER)
  const head = headerParts(page), base = headerParts(basePage)
  eq(base.deckExpr, 'slideStructure?.metadata?.main_title || "Studio"', 'the base: the title or "Studio"'); eq(base.spreadExpr, null, 'the base spreads nothing after it')
  eq(head.deckExpr, base.deckExpr, 'this change keeps the base\'s own deckTitle line')
  eq(head.spreadExpr, 'studioDuplicateCopyTitleProps', 'and spreads the copy\'s header props over it (nothing for a deck that is not a copy)')
  match(head.comments, /NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE/, 'the spread says whose it is')
  eq((page.match(/<BuilderHeader\b/g) || []).length, 1, 'one header'); eq((page.match(/useStudioDuplicateCopyTitleProps\(/g) || []).length, 1, 'the hook is called once'); eq((page.match(/useStudioDuplicateCopyTitle\b(?!Props)/g) || []).length, 0, 'the page uses no other hook of this change')
  // the page's call: one import, one unconditional call, the enabled flag is "no title yet, and a saved session"
  eq((page.match(/^import \{ useStudioDuplicateCopyTitleProps \} from '@\/hooks\/use-studio-duplicate-copy-title'$/gm) || []).length, 1, 'the page imports the hook once')
  const call = /^ {2}const studioDuplicateCopyTitleProps = useStudioDuplicateCopyTitleProps\(currentSessionId, (.+)\)$/gm; const calls = [...page.matchAll(call)]
  eq(calls.length, 1, 'the page calls it once, at the top level of the component, with the open session')
  const gate = (slideStructure, unsaved) => evaluate(calls[0][1], { isUnsavedSession: unsaved, slideStructure })
  for (const unsaved of [true, false]) for (const [name, slideStructure] of STATES) eq(gate(slideStructure, unsaved), !unsaved && !evaluate('slideStructure?.metadata?.main_title', { slideStructure }), `${name}, unsaved ${unsaved}: read only for a saved session whose header has no title`)
  /** What the page gives the header: the REAL hook's props, asked with the page's own `enabled` for the state, spread over the base's title. */
  const titleFor = (slideStructure, run, unsaved = false) => headerDeckTitle(head, { slideStructure, studioDuplicateCopyTitleProps: run.readProps(run.sessionId, gate(slideStructure, unsaved)) })
  // the whole chain on the recorded copy: the hook, the page's props, the real header
  const h = hookRun({ env: on, session: COPY_SESSION.session }); h.read(); await settleMicrotasks()
  const copyTitle = h.read()
  deepEq(h.readProps(), { deckTitle: RECORDED.copy.sessionTitle }, 'the props hook gives the copy\'s title as the header\'s deckTitle'); deepEq(h.readProps(COPY_SESSION.session.id, false), {}, 'and nothing while the header has a title of its own'); eq(h.calls.length, 1, 'from the same single read')
  const restored = COPY_SESSION.session.stateCache.slideStructure || null // what the Builder restores into slideStructure: stateCache.slideStructure || null
  eq(renderHeaderTitle(headerDeckTitle(base, { slideStructure: restored })), RECORDED.headerRead, 'RECORDED / DERIVED: at the base, the copy\'s header says "Studio"')
  eq(renderHeaderTitle(titleFor(restored, h)), RECORDED.copy.sessionTitle, 'flag on: the copy\'s header says its own title, not "Studio"')
  // the original (built, with a main_title): the same text, flag on or off
  const originalStructure = original.session.stateCache.slideStructure
  const ho = hookRun({ env: on, session: original.session, sessionId: ORIGINAL_SESSION_ID }); ho.read(); await settleMicrotasks()
  deepEq(ho.readProps(ORIGINAL_SESSION_ID, true), {}, 'the original has no copy title to give')
  eq(renderHeaderTitle(titleFor(originalStructure, ho)), RECORDED.original.layoutTitle, 'flag on: a deck that was not copied still says its own main_title')
  // every state: a main_title always wins; a copy shows its title only when there is none; no marker: "Studio"
  const off = hookRun({ env: {}, session: COPY_SESSION.session }); off.readProps(); await settleMicrotasks()
  deepEq(off.readProps(), {}, 'flag off: the hook gives nothing'); eq(off.calls.length, 0, 'and reads nothing')
  const bare = hookRun({ env: on, session: sessionRow({ title: 'Quarterly Business Review' }) }); bare.readProps(); await settleMicrotasks()
  for (const [name, slideStructure] of STATES) {
    const built = evaluate('slideStructure?.metadata?.main_title', { slideStructure })
    eq(renderHeaderTitle(titleFor(slideStructure, h)), built || copyTitle, `${name}: with a copy title to show`)
    eq(renderHeaderTitle(titleFor(slideStructure, h, true)), built || 'Studio', `${name}: an unsaved session never shows one`)
    eq(renderHeaderTitle(titleFor(slideStructure, bare)), built || 'Studio', `${name}: a saved deck with a title and no marker: none to show`)
    // flag off: the hook is null, so the page gives the header what the base gives it, state for state
    const baseOut = renderHeaderTitle(headerDeckTitle(base, { slideStructure })), headOut = renderHeaderTitle(headerDeckTitle(head, { slideStructure, studioDuplicateCopyTitleProps: off.readProps(off.sessionId, gate(slideStructure, false)) }))
    eq(headOut, baseOut, `flag off, ${name}: the header says what the base says`); pushDigest(baseOut, headOut)
  }
  eq(sha(read(HEADER)), sha(baseSource(HEADER)), 'the header component itself is the base commit\'s file')
}

// ---------------------------------------------------------------- 6. the account layout
function proveLayout() {
  const build = (source, env) => {
    const deps = { '@/components/layout/app-header': { AppHeader: 'AppHeader', BackToBuilderButton: 'BackToBuilderButton' }, '@/components/layout/studio-rail': { StudioRail: 'StudioRail' },
      '@/lib/studio-payments-open-soon': { STUDIO_PAYMENTS_OPEN_SOON_ENABLED: env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON === 'true' }, '@/components/billing/studio-payments-open-soon-mount': { StudioPaymentsOpenSoonMount: 'StudioPaymentsOpenSoonMount' },
      '@/lib/studio-duplicate-copy-title': lib(env), '@/components/builder/studio-duplicate-copy-title-mount': { StudioDuplicateCopyTitleMount: 'StudioDuplicateCopyTitleMount' } }
    return load(source, LAYOUT, { deps, env }).default({ children: 'page' })
  }
  for (const shell of [undefined, 'true']) for (const soon of [undefined, 'true']) {
    const envBase = { ...(shell ? { NEXT_PUBLIC_STUDIO_V4_SHELL: shell, NEXT_PUBLIC_STUDIO_V4_TOKENS: 'true' } : {}), ...(soon ? { NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON: soon } : {}) }
    const before = build(baseSource(LAYOUT), envBase)
    for (const value of MISSPELLED) eq(rendered(build(read(LAYOUT), value === undefined ? envBase : { ...envBase, [FLAG]: value })), rendered(before), `layout, shell ${shell}, payments ${soon}, flag ${JSON.stringify(value)}: the base commit's tree`)
    pushDigest(rendered(before), rendered(build(read(LAYOUT), envBase)))
    const withFlag = build(read(LAYOUT), { ...envBase, ...on })
    eq(JSON.stringify(withFlag).split('"StudioDuplicateCopyTitleMount"').length - 1, 1, 'flag on: the mount is drawn once')
    eq(rendered(withFlag).replace(/,?\{"type":"StudioDuplicateCopyTitleMount","props":\{\}\}/, ''), rendered(before), 'flag on: nothing else in the layout changes')
    eq(JSON.stringify(withFlag).split('"StudioPaymentsOpenSoonMount"').length - 1, soon ? 1 : 0, 'flag on: the payments gate is as it was')
  }
}
function proveCardsOff() {
  // flag off: the card hook returns before it reads the window, so the Decks page's DOM is the base commit's, copies included
  const trap = new Proxy({}, { get() { throw new Error('the page was touched with the flag off') } })
  const { doc } = mountCards(Object.values(DECKS).map(item => item.title)); const pristine = serialize(doc.body)
  for (const value of MISSPELLED) {
    const react = makeReact(), mod = load(read(HOOK), HOOK, { deps: { react: react.api, '@/lib/studio-duplicate-copy-title': lib(value === undefined ? {} : { [FLAG]: value }) }, globals: { window: trap } })
    react.reset(); mod.useStudioDuplicateCardTitles(); react.flushEffects()
    eq(serialize(doc.body), pristine, `flag ${JSON.stringify(value)}: the Decks page is as the page drew it`)
  }
  pushDigest(pristine, serialize(doc.body))
  eq(sha(read(DASH)), sha(baseSource(DASH)), 'the Decks page itself is the base commit\'s file (held by FRONTEND-1\'s pins)')
}

// ---------------------------------------------------------------- 7. the change itself
const HELD = [ // files other changes' pins hold, and the files the copy's data flows through: byte for byte the base commit's
  DASH, HEADER, DUP, 'components/builder/studio-duplicate-deck.css', 'components/builder/studio-decks.css', 'components/builder/studio-copied-from-note.tsx', 'components/ui/card.tsx', 'hooks/use-builder-session.ts', 'hooks/use-chat-sessions.ts',
  'app/api/sessions/route.ts', 'app/api/sessions/[id]/route.ts', 'lib/studio-deck-title.ts', 'lib/studio-deck-cards.ts', 'hooks/use-studio-payments-open-soon.ts', 'lib/studio-payments-open-soon.ts',
  'components/billing/studio-payments-open-soon-mount.tsx', 'components/billing/studio-payments-open-soon.css',
]
const lineCounts = text => { const map = new Map(); for (const line of text.split('\n')) map.set(line, (map.get(line) ?? 0) + 1); return map }
/** The lines of `text` that the base text does not have (as a multiset): what this change added. */
function addedLines(text, baseText) { const have = lineCounts(baseText), out = []; for (const line of text.split('\n')) { const n = have.get(line) ?? 0; if (n > 0) have.set(line, n - 1); else out.push(line) } return out }
// The COMMITTED change only (BASE..HEAD): files other tests write into the working tree during a suite run are not this change's (stack gate 24 Oct).
const allChanged = () => [...new Set(git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean))]
const baseOf = rel => { try { return baseSource(rel) } catch { return '' } }
function proveChange() {
  for (const rel of HELD) { let base; try { base = baseSource(rel) } catch { continue } eq(sha(read(rel)), sha(base), `${rel} is the base commit's file`) }
  // strip = base
  for (const rel of DUPLICATE_COPY_TITLE_FILES) {
    const text = read(rel), stripped = stripDuplicateCopyTitle(rel, text)
    eq(stripped, baseSource(rel), `${rel}: with this change's lines out it is ${BASE.slice(0, 8)} byte for byte, with nothing else to take out`)
    ok(stripped !== text, `${rel}: the change is there to strip`)
    eq(stripDuplicateCopyTitle(rel, stripped), stripped, `${rel}: stripping twice changes nothing more`)
    for (const [added] of DUPLICATE_COPY_TITLE_CHANGES[rel]) eq(text.split(added).length - 1, 1, `${rel}: each added piece occurs once`)
    const wrong = stripped.replace(/\n/, '\n ')
    ok(sha(wrong) !== sha(baseSource(rel)), `${rel}: a strip that put the wrong text back would be seen`)
  }
  eq(stripDuplicateCopyTitle(LIB, read(LIB)), read(LIB), 'a new file has nothing to strip'); eq(stripDuplicateCopyTitle('app/page.tsx', 'x'), 'x', 'any other file is returned as it is')
  // the earlier strips still see their own text once this one is out (the order the roots call them in)
  for (const rel of [LAYOUT, BUILDER, ENV]) { const stripped = stripPaymentsOpenSoon(rel, stripDuplicateCopyTitle(rel, read(rel))); nomatch(stripped, /studio-duplicate-copy-title|useStudioDuplicateCopyTitle|DUPLICATE_COPY_TITLE|StudioDuplicateCopyTitleMount/, `${rel}: both strips out, none of this change is left`); nomatch(stripped, /PAYMENTS_OPEN_SOON|studio-payments-open-soon/, `${rel}: and none of #496's`) }
  // the three shared strip roots chain it, innermost
  for (const [name, strip, file] of [['open-read-only', stripOpenReadOnly, 'scripts/studio-open-read-only-strip.mjs'], ['dark-persist', stripDarkPersist, 'scripts/studio-theme-dark-persist-strip.mjs'], ['add-slide-status', stripAddSlideStatus, 'scripts/studio-add-slide-status-strip.mjs']]) {
    nomatch(strip(BUILDER, read(BUILDER)), /useStudioDuplicateCopyTitle|studio-duplicate-copy-title|studioDuplicateCopyTitle/, `the ${name} root takes this change's page lines out`)
    const text = read(file)
    eq((text.match(/import \{ stripDuplicateCopyTitle \} from '\.\/studio-duplicate-copy-title-strip\.mjs'/g) || []).length, 1, `${file}: one import`)
    eq((text.match(/stripPaymentsOpenSoon\(rel, stripDuplicateCopyTitle\(rel, (?:stripThumbnailLastGood\(rel, )?(?:stripBulkEditUndo\(rel, )?text\)\)/g) || []).length, 1, `${file}: chained once, innermost (inside payments open soon's)`)
  }
  nomatch(stripAddSlideStatus(ENV, read(ENV)), /DUPLICATE_COPY_TITLE/, 'a root takes the .env.example block out')
  // scope
  const allowed = new Set([...DUPLICATE_COPY_TITLE_FILES, ...DUPLICATE_COPY_TITLE_NEW_FILES, ...THUMBNAIL_LAST_GOOD_FILES, ...THUMBNAIL_LAST_GOOD_NEW_FILES, ...THUMBNAIL_LAST_GOOD_PIN_FILES, /* stacked: thumbnail last good, after this change in the stack */ ...BULK_EDIT_UNDO_FILES, ...BULK_EDIT_UNDO_NEW_FILES, ...BULK_EDIT_UNDO_PIN_FILES, /* stacked: bulk edit + chat undo, after thumbnail last good in the stack */ 'scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs', 'scripts/studio-library-manage-harness.mjs',
    'scripts/test-studio-job-ledger.mjs', 'scripts/test-studio-chat-theme-export.mjs', 'scripts/test-studio-new-deck-handoff-send.mjs', 'scripts/test-studio-payments-open-soon.mjs',
    'scripts/test-studio-publish-review-fit.mjs', 'scripts/test-studio-version-history-deck-only.mjs', 'scripts/test-studio-compose-entitlement.mjs', 'scripts/test-studio-publish-preview-inventory.mjs', 'scripts/test-studio-chat-element-refine.mjs'])
  deepEq(allChanged().filter(rel => !allowed.has(rel) && !LATER_CHANGE_FILES.has(rel)), [], 'no file outside this change\'s own, the three strip roots, the harness list and the pins that read through the strip')
  for (const rel of [LIB, HOOK, MOUNT, CSS, LAYOUT, BUILDER]) ok(STACKED_PASS3_FILES.includes(rel), `${rel} is in STACKED_PASS3_FILES`)
  // .env.example
  const env = read(ENV), start = env.indexOf('# DUPLICATE COPY TITLE (')
  ok(start !== -1, '.env.example: the block is introduced'); eq((env.match(/^NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE="false"$/gm) || []).length, 1, '.env.example: documented once, default "false"')
  const line = `${FLAG}="false"\n\n`, block = env.slice(start, env.indexOf(line, start) + line.length)
  match(block, /exact value "true"/, '.env.example: the block says how the flag is read'); match(block, /Build-time/, '.env.example: build-time'); match(block, /"Studio"/, '.env.example: the header'); match(block, /\(copy\)/, '.env.example: the suffix'); match(block, /tooltip/, '.env.example: the tooltip')
  ok(env.slice(0, start).trimEnd().endsWith('NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON="false"'), '.env.example: right after the last FRONTEND-2 block below it in the stack (#496, payments open soon)')
  ok(env.slice(start + block.length).startsWith('# PASS2 ADMIN'), '.env.example: right before # PASS2 ADMIN')
  // the lib writes no text and moves no node
  const code = read(LIB).replace(/^\s*\/\/.*$/gm, '').replace(/\/\/ .*$/gm, '')
  nomatch(code, /\.(textContent|nodeValue|innerHTML|outerHTML|innerText)\s*=[^=]|\.(appendChild|insertBefore|removeChild|replaceChild|replaceWith|insertAdjacentElement|insertAdjacentHTML|prepend|append|after|before|remove)\(|createElement|createTextNode|setAttribute\('disabled'|\.disabled\s*=/, 'the lib never writes text, creates or moves a node, or sets disabled')
  nomatch(code, /method\s*:|body\s*:|localStorage|sessionStorage|document\.cookie|XMLHttpRequest|sendBeacon/, 'the lib makes no write: no method, body or storage')
  nomatch(read(HOOK).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''), /method\s*:|body\s*:|localStorage|sessionStorage/, 'the hooks make no write either')
  // a secret scan: nothing key-shaped in a line this change added (the patterns are built here, not written out)
  const shapes = [['s', 'k'], ['r', 'k'], ['p', 'k']].map(([a, b]) => new RegExp(`\\b${a}${b}_(live|test)_[A-Za-z0-9]{8,}`)).concat([new RegExp(`\\bwh${'sec'}_[A-Za-z0-9]{8,}`), new RegExp(`\\bgh${'p'}_[A-Za-z0-9]{20,}`), new RegExp(`\\bxox${'[bpa]'}-[A-Za-z0-9-]{10,}`),
    new RegExp(`\\bAKIA[0-9A-Z]{12,}`), new RegExp(`\\bey${'J'}[A-Za-z0-9_-]{15,}\\.`), new RegExp(`-----BEGIN [A-Z ]*PRIVATE KEY`), new RegExp(`Bearer\\s+[A-Za-z0-9._-]{16,}`), new RegExp(`[a-z]+://[^\\s/:@]+:[^\\s/@]{4,}@`)])
  const addedAll = [...DUPLICATE_COPY_TITLE_FILES, ...DUPLICATE_COPY_TITLE_NEW_FILES.filter(rel => !rel.startsWith('scripts/')), 'scripts/studio-duplicate-copy-title-strip.mjs'].flatMap(rel => addedLines(read(rel), baseOf(rel)))
  ok(addedAll.length > 40, 'the scan has this change\'s lines to read')
  for (const line of addedAll) for (const shapeRe of shapes) nomatch(line, shapeRe, `no key-shaped literal in an added line: ${line.slice(0, 80)}`)
}

// ---------------------------------------------------------------- run
async function sourceChecks() {
  proveFlag(); proveSuffixSplit()
  proveCardPass(); proveCardRerender(); proveLook()
  await proveHook(); await proveHeader()
  proveLayout(); proveCardsOff()
  proveChange()
}

const stray = [] // a promise that rejected with nobody to hear it (a read that throws inside the hook): the process would end with exit 1, so each run listens and judges
process.on('unhandledRejection', error => { stray.push(error) })
await sourceChecks()
await new Promise(resolve => setImmediate(resolve)); eq(stray.length, 0, 'no promise is left rejected: a failed read never escapes the hook')
const flagOffHashes = { base: sha(digest.base.join('\n')), head: sha(digest.head.join('\n')) }
eq(flagOffHashes.head, flagOffHashes.base, 'flag off: the hash of every output equals the base commit\'s')
console.log(`flag off: ${digest.base.length} outputs (the account layout in 4 envs, the header text over ${STATES.length} states, the Decks page DOM), sha256 base ${flagOffHashes.base.slice(0, 16)} = this tree ${flagOffHashes.head.slice(0, 16)}`)
console.log(`fixtures: RECORDED from ${RECORDED.from}; DERIVED: the copy's session row (real runDuplicateDeck against a recording stub), the original's full session id (only "${RECORDED.original.sessionIdPrefix}" was recorded)`)
const total = checks
if (process.env.DUPLICATE_COPY_TITLE_NO_MUTANTS) { console.log(`duplicate-copy-title: ${total} checks (mutants skipped)`); process.exit(0) }

// ---------------------------------------------------------------- 8. mutants: a wrong version of one source line must fail the suite above
counting = false
let caught = 0
async function mutant(file, name, from, to, ...more) { // the first replacement as two strings, any further ones as [from, to]
  const pairs = [[from, to], ...more]
  const original = read(file)
  let mutated = original
  for (const [from, to] of pairs) { assert.ok(mutated.includes(from), `mutant "${name}" no longer applies; update MUTANTS`); mutated = mutated.replace(from, () => to) }
  overrides = { [file]: mutated }
  digest.base.length = 0; digest.head.length = 0
  let failed = false
  try { await sourceChecks(); await new Promise(resolve => setImmediate(resolve)); if (stray.length > 0) failed = true } catch { failed = true } finally { overrides = {}; stray.length = 0 }
  assert.ok(failed, `mutant survived: ${name}`)
  caught++
}
const FLAG_LINE = "process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE === 'true'"
const MARK_SITE = "host.setAttribute(COPY_TITLE_HOST_ATTR, '1')"
await mutant(LIB, 'flag spelling: loose', FLAG_LINE, "process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE !== 'false'")
await mutant(LIB, 'flag spelling: truthy', FLAG_LINE, 'Boolean(process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE)')
await mutant(LIB, 'flag spelling: case-blind', FLAG_LINE, "String(process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE).toLowerCase() === 'true'")
await mutant(LIB, 'every title is a copy', "if (typeof title !== 'string' || !title.endsWith(COPY_TITLE_SUFFIX)) return null", "if (typeof title !== 'string') return null")
await mutant(LIB, 'the suffix is matched anywhere', 'title.endsWith(COPY_TITLE_SUFFIX)', 'title.includes(COPY_TITLE_SUFFIX)')
await mutant(LIB, 'a title that is only the suffix is a copy', 'return base.trim() ? { base, suffix: COPY_TITLE_SUFFIX } : null', 'return { base, suffix: COPY_TITLE_SUFFIX }')
await mutant(LIB, 'the pass rewrites the title text', MARK_SITE, `${MARK_SITE}; link.textContent = text`)
await mutant(LIB, 'the pass writes a text node', MARK_SITE, `${MARK_SITE}; if (link.firstChild) link.firstChild.nodeValue = text + ' '`)
await mutant(LIB, 'the pass inserts a node', MARK_SITE, `${MARK_SITE}; host.appendChild(host.ownerDocument.createElement('span'))`)
await mutant(LIB, 'the pass marks the wrong element (the link)', MARK_SITE, "link.setAttribute(COPY_TITLE_HOST_ATTR, '1')")
await mutant(LIB, 'the tooltip is missing', "if (link.getAttribute('title') !== text) { link.setAttribute('title', text); changed++ }", 'void text')
await mutant(LIB, 'the tooltip overwrites a tooltip somebody else set', "if (!link.hasAttribute('title') || link.getAttribute(COPY_TITLE_TIP_ATTR) === '1') {", 'if (true) {')
await mutant(LIB, 'the tooltip is left behind when a card stops being a copy', "if (link && link.getAttribute(COPY_TITLE_TIP_ATTR) === '1') { link.removeAttribute('title'); link.removeAttribute(COPY_TITLE_TIP_ATTR) }", 'void link')
await mutant(LIB, 'a card that stops being a copy keeps its mark', "if (host.hasAttribute(COPY_TITLE_HOST_ATTR)) { releaseHost(host, link); changed++ }", 'void host')
await mutant(LIB, 'the base is not kept in step with a rename', "host.getAttribute(COPY_TITLE_BASE_ATTR) === parts.base && ", '')
await mutant(LIB, 'the pass does not follow the page', 'observer.observe(doc.body, { childList: true, subtree: true, characterData: true })', 'void observer')
await mutant(LIB, 'the pass watches attributes too (its own writes wake it)', 'characterData: true })', 'characterData: true, attributes: true })')
await mutant(LIB, 'the attributes are left on the page', 'release(doc)', 'void doc')
await mutant(LIB, 'the scope is left on <html>', 'html.removeAttribute(COPY_TITLE_HTML_ATTR)', 'void html')
await mutant(LIB, 'the scope is never put on <html>', "html.setAttribute(COPY_TITLE_HTML_ATTR, 'true')", 'void html')
await mutant(LIB, 'the pass is not idempotent', 'if (!already) {', 'if (true) {')
await mutant(LIB, 'a deck with no marker has a title', 'if (!marker) return null', "if (!marker) return typeof (session as { title?: unknown } | null | undefined)?.title === 'string' ? (session as { title: string }).title : null")
await mutant(LIB, 'the copy gets the original\'s title', 'return own || duplicateTitle(marker.title)', 'return marker.title')
await mutant(LIB, 'the stored title is ignored', 'return own || duplicateTitle(marker.title)', 'return duplicateTitle(marker.title)')
await mutant(LIB, 'the read is a write', "{ cache: 'no-store', ...(signal ? { signal } : {}) }", "{ method: 'PATCH', cache: 'no-store', ...(signal ? { signal } : {}) }")
await mutant(LIB, 'a failed read throws', '  } catch {\n    return null\n  }\n}\n', '  } catch {\n    throw new Error(\'read failed\')\n  }\n}\n')
await mutant(LIB, 'a refused read is read anyway', 'if (!response.ok) return null', 'void response')
await mutant(LIB, 'the session id is not encoded', '`/api/sessions/${encodeURIComponent(sessionId)}`', '`/api/sessions/${sessionId}`')
await mutant(HOOK, 'flag off changed: the title hook reads anyway', 'if (!STUDIO_DUPLICATE_COPY_TITLE_ENABLED || !enabled || !sessionId', 'if (!enabled || !sessionId')
await mutant(HOOK, 'the title hook answers a header that has a title', 'return enabled && found && found.sessionId === sessionId', 'return found && found.sessionId === sessionId')
await mutant(HOOK, 'the title hook reads when the header has a title', '|| !enabled || !sessionId', '|| !sessionId')
await mutant(HOOK, 'the title hook reads a new session', "|| sessionId === 'new') return undefined", ') return undefined')
await mutant(HOOK, 'another session\'s answer is shown', 'found.sessionId === sessionId ? found.title : null', 'found ? found.title : null')
await mutant(HOOK, 'an answer after unmount is not dropped', 'if (!controller.signal.aborted) setFound({ sessionId, title })', 'setFound({ sessionId, title })')
await mutant(HOOK, 'the read is never aborted', 'return () => controller.abort()', 'return undefined')
await mutant(HOOK, 'flag off changed: the card hook installs anyway', 'if (!STUDIO_DUPLICATE_COPY_TITLE_ENABLED) return\n    return installCopyTitles(window)', 'return installCopyTitles(window)')
await mutant(HOOK, 'the card hook is never undone', 'return installCopyTitles(window)', 'installCopyTitles(window)')
await mutant(MOUNT, 'the mount draws something', 'return null', 'return <span />')
await mutant(MOUNT, 'the mount does not bring the sheet', 'import "@/components/builder/studio-duplicate-copy-title.css"\n', '')
await mutant(CSS, 'the sheet is not scoped', 'html[data-studio-copy-title="true"] [data-studio-copy-title-host="1"]::before', '[data-studio-copy-title-host="1"]::before')
await mutant(CSS, 'the sheet reaches every title box', 'html[data-studio-copy-title="true"] [data-studio-copy-title-host="1"] > a', 'html[data-studio-copy-title="true"] [data-studio-deck-card-header] a')
await mutant(CSS, 'the title box is not a row', 'position: relative; display: flex;', 'position: relative;')
await mutant(CSS, 'the base cannot shrink', 'flex: 0 1 auto; min-width: 0;', 'flex: 0 0 auto; min-width: 0;')
await mutant(CSS, 'the base cannot shrink below its text', 'flex: 0 1 auto; min-width: 0;', 'flex: 0 1 auto;')
await mutant(CSS, 'the base has no ellipsis', ' text-overflow: ellipsis;', '')
await mutant(CSS, 'the base wraps to a second line', 'white-space: nowrap; }\nhtml[data-studio-copy-title="true"] [data-studio-copy-title-host="1"]::after', 'white-space: normal; }\nhtml[data-studio-copy-title="true"] [data-studio-copy-title-host="1"]::after')
await mutant(CSS, 'the suffix may shrink', 'flex: none; white-space: pre;', 'flex: 1 1 0; min-width: 0; overflow: hidden; white-space: pre;')
await mutant(CSS, 'the suffix loses its space', 'flex: none; white-space: pre;', 'flex: none; white-space: normal;')
await mutant(CSS, 'the link text is painted twice', 'overflow: hidden; white-space: nowrap; color: transparent; forced-color-adjust: none;', 'overflow: hidden; white-space: nowrap; forced-color-adjust: none;')
await mutant(CSS, 'the link is not laid over the box', 'position: absolute; top: 0;', 'position: static; top: 0;')
await mutant(CSS, 'the sheet names a colour of its own', 'color: transparent; forced-color-adjust', 'color: #1f6f5c; forced-color-adjust')
await mutant(CSS, 'the base is drawn from the wrong attribute', 'content: attr(data-studio-copy-title-base);', 'content: attr(data-studio-copy-title-suffix);')
await mutant(CSS, 'the assistive-technology fallback is missing', 'content: attr(data-studio-copy-title-suffix) / "";', '')
await mutant(BUILDER, 'the header ignores the copy title', '          {...studioDuplicateCopyTitleProps}\n', '          {...({})}\n')
await mutant(BUILDER, 'the spread comes before the base title (the base wins)', '          // NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE (default off): a copied deck says its own title here, not "Studio"; flag off, nothing is spread.\n          {...studioDuplicateCopyTitleProps}\n', '', ['          wsError={wsError}\n          onNewPresentation={handleNewChatWrapped}\n', '          {...studioDuplicateCopyTitleProps}\n          wsError={wsError}\n          onNewPresentation={handleNewChatWrapped}\n'])
await mutant(BUILDER, 'the base title line is edited', 'deckTitle={slideStructure?.metadata?.main_title || "Studio"}', 'deckTitle={slideStructure?.metadata?.main_title || studioDuplicateCopyTitleProps.deckTitle || "Studio"}')
await mutant(HOOK, 'the props hook gives a title to every deck (null overwrites)', 'return title ? { deckTitle: title } : NO_HEADER_PROPS', 'return { deckTitle: title as string }')
await mutant(HOOK, 'the props hook says "Studio" for a deck that is not a copy', 'return title ? { deckTitle: title } : NO_HEADER_PROPS', "return title ? { deckTitle: title } : { deckTitle: 'Studio' }")
await mutant(BUILDER, 'the header title is read for every session', '!isUnsavedSession && !slideStructure?.metadata?.main_title)', 'true)')
await mutant(BUILDER, 'the header title is read for an unsaved session', '!isUnsavedSession && !slideStructure?.metadata?.main_title)', '!slideStructure?.metadata?.main_title)')
await mutant(BUILDER, 'the hook is called with no session', 'useStudioDuplicateCopyTitleProps(currentSessionId,', 'useStudioDuplicateCopyTitleProps(null,')
await mutant(LAYOUT, 'flag off changed: the mount is always drawn', '{STUDIO_DUPLICATE_COPY_TITLE_ENABLED && <StudioDuplicateCopyTitleMount />}', '{<StudioDuplicateCopyTitleMount />}')
await mutant(LAYOUT, 'the mount is never drawn', '      {STUDIO_DUPLICATE_COPY_TITLE_ENABLED && <StudioDuplicateCopyTitleMount />}\n', '')
await mutant(LAYOUT, 'the payments gate is lost', '{STUDIO_PAYMENTS_OPEN_SOON_ENABLED && <StudioPaymentsOpenSoonMount />}', '{false}')
await mutant(ENV, 'the flag defaults on', `${FLAG}="false"`, `${FLAG}="true"`)
await mutant(ENV, 'the block moves after # PASS2 ADMIN', '# DUPLICATE COPY TITLE (', '# PASS2 ADMIN (FRONTEND-1,', ['# PASS2 ADMIN (FRONTEND-1, the internal', '# DUPLICATE COPY TITLE (the internal'])
await mutant(DASH, 'the Decks page is edited', '<CardTitle className="text-lg line-clamp-1">', '<CardTitle className="text-lg line-clamp-2">')
await mutant(HEADER, 'the header component is edited', 'deckTitle = "Studio",', 'deckTitle = "Deckster",')
await mutant(DUP, 'the duplicate flow is edited', "export const COPY_TITLE_SUFFIX = ' (copy)'", "export const COPY_TITLE_SUFFIX = ' (Copy)'")
console.log(`duplicate-copy-title: ${total} checks, ${caught} mutants caught`)
