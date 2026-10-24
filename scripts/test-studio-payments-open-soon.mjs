// FRONTEND-2: proof for "Payments open soon" (NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON, default off), the controlled-release gate while there is no Stripe account.
// Plain node, no browser, no network, no services, no paid call: the real TypeScript is transpiled and run in a vm with a small fake React (hooks keep their state, effects run on demand), and a small fake DOM
// with a small reconciler that behaves like React's (it holds the nodes it rendered, writes them on a re-render, and throws NotFoundError when a node it holds is gone), so the real pass runs on the real
// Billing page and the real account menus and the page is then re-rendered under it. Money never moves: the two checkout routes run against stubs that record every call.
//   1. the flag      exact "true" only (spelling, case, spaces, 1, yes)
//   2. flag off      the Billing page (all plans), UpgradeButton, the top-up modal, the account layout, both checkout routes and the hook are the base commit's: same output, hashed
//   3. flag on       a free user: the plan shown, every Upgrade / checkout control gated (UpgradeButton and the top-up modal natively, the rest by the pass), the checkout routes refuse; a Pro and a Max user: plan
//                    name, price, status, renewal and features identical to flag off, "Manage Subscription" untouched, only the new-checkout controls change
//   4. the pass      ATTRIBUTES ONLY: no text node changed, no node inserted or removed (same nodes, same text), no `disabled` set on a React-owned element; idempotent; follows the page; a click, Enter or
//                    Space on a gated control is stopped (and nothing else is); undone on unmount; and the page re-rendered under it (a spinner in a pack, a plan change, a cancelled subscription) never throws
//   5. invites       coupon / invite / redeem controls and files are never touched, flag on or off; the Stripe real-tier flag and its code path are not read or touched
//   6. the change    strip = BASE_COMMIT byte for byte, files held by other changes' pins unchanged, scope, .env.example, the stylesheet's scope and words, a secret scan
//   7. mutants       each one must make sections 1-6 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'
import { FIRST_PAINT_SCOPE_FILES } from './studio-first-paint-strip.mjs' // stacked: COMPOSER-2 first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED), a later change: its committed files are not this change's to answer for
import { BASE_COMMIT, PAYMENTS_OPEN_SOON_CHANGES, PAYMENTS_OPEN_SOON_FILES, PAYMENTS_OPEN_SOON_NEW_FILES, stripPaymentsOpenSoon } from './studio-payments-open-soon-strip.mjs'
import { stripPublishPreviewInventory } from './studio-publish-preview-inventory-strip.mjs' // stacked: #495, below this change in the stack (its .env.example block sits between the base's file and this change's)
import { stripDuplicateCopyTitle, DUPLICATE_COPY_TITLE_FILES, DUPLICATE_COPY_TITLE_NEW_FILES } from './studio-duplicate-copy-title-strip.mjs' // stacked: duplicate copy title, after this change in the stack
import { stripThumbnailLastGood, THUMBNAIL_LAST_GOOD_FILES, THUMBNAIL_LAST_GOOD_NEW_FILES, THUMBNAIL_LAST_GOOD_PIN_FILES } from './studio-thumbnail-last-good-strip.mjs' // stacked: thumbnail last good (the Studio half of "never blank"), after duplicate copy title in the stack
import { stripBulkEditUndo, BULK_EDIT_UNDO_FILES, BULK_EDIT_UNDO_NEW_FILES, BULK_EDIT_UNDO_PIN_FILES } from './studio-bulk-edit-undo-strip.mjs' // stacked: bulk edit + chat undo (a whole-deck edit card and an Undo chip in chat), after thumbnail last good in the stack
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { STACKED_PASS3_FILES } from './studio-library-manage-harness.mjs'
import { LATER_CHANGE_FILES, stripLaterEnvBlocks } from './studio-later-changes.mjs' // stacked: the later-changes registry (a change stacked after this one registers its files and its .env.example block there; scope checks skip its files, every read of .env.example goes through it first)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.PAYMENTS_OPEN_SOON_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
const baseCache = new Map()
const baseSource = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE}:${rel}`)); return baseCache.get(rel) }
let overrides = {} // in-memory mutations: the suite reads every source through read()
const read = rel => (rel in overrides ? overrides[rel] : stripDuplicateCopyTitle(rel, stripThumbnailLastGood(rel, stripBulkEditUndo(rel, stripLaterEnvBlocks(rel, fs.readFileSync(path.join(root, rel), 'utf8')))))) // stacked: duplicate copy title (after this change in the stack) adds its own lines to the layout, the Builder page and .env.example; this proof reads past them
const sha = value => crypto.createHash('sha256').update(value).digest('hex')

let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const ok = count(assert.ok), eq = count(assert.equal), match = count(assert.match), nomatch = count(assert.doesNotMatch)
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))

const LIB = 'lib/studio-payments-open-soon.ts', HOOK = 'hooks/use-studio-payments-open-soon.ts', MOUNT = 'components/billing/studio-payments-open-soon-mount.tsx', CSS = 'components/billing/studio-payments-open-soon.css'
const BILLING_PAGE = 'app/(app)/billing/page.tsx', UPGRADE = 'components/billing/UpgradeButton.tsx', MANAGE = 'components/billing/ManageSubscriptionButton.tsx', TOPUP = 'components/builder/topup-modal.tsx'
const LAYOUT = 'app/(app)/layout.tsx', CHECKOUT = 'app/api/stripe/create-checkout-session/route.ts', TOPUP_ROUTE = 'app/api/stripe/create-topup-session/route.ts', PORTAL = 'app/api/stripe/create-portal-session/route.ts'
const MENU_P2 = 'components/user-profile-menu-p2.tsx', MENU = 'components/user-profile-menu.tsx', MENU_LIB = 'lib/studio-profile-menu.ts', POLISH_LIB = 'lib/studio-p2-polish.ts'
const BUILDER = 'app/builder/page.tsx', ENV = '.env.example'
const FLAG = 'NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON'
const LINE = 'Payments open soon'
const GATE = 'data-studio-payments-soon-gate', RULE = 'data-studio-payments-soon-rule', KIND = 'data-studio-payments-soon-kind', GROUP = 'data-studio-payments-soon-group', HTML_ATTR = 'data-studio-payments-soon'
const OURS = [GATE, RULE, KIND, GROUP]

// ---------------------------------------------------------------- loading
const jsx = (type, props) => ({ type, props: props ?? {} })
const JSX_RUNTIME = { jsx, jsxs: jsx, Fragment: 'Fragment' }
const names = new Proxy({}, { get: (_target, key) => key })
const compileCache = new Map()
const compile = (source, fileName) => {
  const key = `${fileName}\0${source}`
  if (!compileCache.has(key)) {
    const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
    assert.equal((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${fileName} compiles`)
    compileCache.set(key, out.outputText)
  }
  return compileCache.get(key)
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
function makeReact() {
  const slots = [], effects = [], cleanups = []; let cursor = 0
  return {
    reset() { cursor = 0 },
    flushEffects() { while (effects.length) { const cleanup = effects.shift()(); if (typeof cleanup === 'function') cleanups.push(cleanup) } },
    unmount() { while (cleanups.length) cleanups.shift()() },
    api: {
      Suspense: 'Suspense',
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
      useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
      useCallback: fn => fn,
      useMemo: fn => fn(),
      useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || !deps || deps.some((x, index) => x !== previous.deps[index])) { slots[i] = { deps }; effects.push(fn) } },
    },
  }
}
const settleMicrotasks = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
const rendered = value => JSON.stringify(value, (key, item) => key === 'children' && Array.isArray(item) ? item.filter(x => x !== false && x !== undefined && x !== null) : item)
const lib = (env = {}, source = read(LIB)) => load(source, LIB, { env })
const on = { [FLAG]: 'true' }

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
  get parentElement() { return this.parentNode }
  get firstChild() { return this.childNodes[0] ?? null }
  get lastChild() { return this.childNodes.at(-1) ?? null }
  get nextSibling() { if (!this.parentNode) return null; const siblings = this.parentNode.childNodes; return siblings[siblings.indexOf(this) + 1] ?? null }
  get nextElementSibling() { let node = this.nextSibling; while (node && node.nodeType !== 1) node = node.nextSibling; return node }
}
class Txt extends Base {
  constructor(doc, value) { super(doc); this.nodeType = 3; this.value = value }
  get nodeValue() { return this.value }
  set nodeValue(value) { this.value = String(value); this.ownerDocument.mutated() }
  get textContent() { return this.value }
}
class El extends Base {
  constructor(doc, tagName) { super(doc); this.nodeType = 1; this.tagName = tagName.toUpperCase(); this.attrs = new Map(); this.props = {}; this.kids = []; this.owned = [] }
  setAttribute(key, value) { const text = String(value); if (this.attrs.get(key) !== text) { this.attrs.set(key, text); this.ownerDocument.mutated() } }
  getAttribute(key) { return this.attrs.has(key) ? this.attrs.get(key) : null }
  hasAttribute(key) { return this.attrs.has(key) }
  removeAttribute(key) { if (this.attrs.delete(key)) this.ownerDocument.mutated() }
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
  closest(selector) { for (let node = this; node && node.nodeType === 1; node = node.parentNode) if (matchesSelector(node, selector)) return node; return null }
  querySelectorAll(selector) { const out = []; const walk = node => { for (const child of node.childNodes) if (child.nodeType === 1) { if (matchesSelector(child, selector)) out.push(child); walk(child) } }; walk(this); return out }
}
class Doc {
  constructor() { this.listeners = {}; this.observers = []; this.dirty = false; this.documentElement = this.createElement('html'); this.body = this.createElement('body'); this.documentElement.appendChild(this.body); this.dirty = false }
  createElement(tag) { return new El(this, tag) }
  createTextNode(value) { return new Txt(this, String(value)) }
  mutated() { this.dirty = true }
  addEventListener(type, fn, capture) { (this.listeners[type] ||= []).push({ fn, capture: Boolean(capture) }) }
  removeEventListener(type, fn, capture) { this.listeners[type] = (this.listeners[type] || []).filter(item => !(item.fn === fn && item.capture === Boolean(capture))) }
  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector) }
  /** A MutationObserver callback is a microtask in a browser: here the test says when. True when something had changed. */
  flushMutations() { if (!this.dirty) return false; this.dirty = false; for (const observer of [...this.observers]) observer.callback([], observer); return true }
  event(type, target, extra = {}) { return { type, target, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true }, stopPropagation() { this.stopped = true }, ...extra } }
  /** A click on `target`: the capture listeners first (a stop ends it), then the nearest handler runs (a native disabled control ignores it). */
  click(target) {
    const event = this.event('click', target)
    for (const item of (this.listeners.click || []).filter(entry => entry.capture)) item.fn(event)
    if (event.stopped) return 'stopped'
    if (target.attrs.has('disabled')) return 'disabled'
    for (let node = target; node && node.nodeType === 1; node = node.parentNode) if (typeof node.props?.onClick === 'function') { node.props.onClick(event); return 'handled' }
    return 'none'
  }
  /** A key on `target`: the capture listeners first; then the control's own key handler if it has one, else Enter or Space is the click a browser makes of it. */
  press(target, key) {
    const event = this.event('keydown', target, { key })
    for (const item of (this.listeners.keydown || []).filter(entry => entry.capture)) item.fn(event)
    if (event.stopped) return 'stopped'
    for (let node = target; node && node.nodeType === 1; node = node.parentNode) if (typeof node.props?.onKeyDown === 'function') { node.props.onKeyDown(event); return 'handled' } // a control that acts on the key itself
    return key === 'Enter' || key === ' ' ? this.click(target) : 'passed'
  }
}
function makeWindow(doc, pathname) {
  const timers = []
  return {
    document: doc, location: { pathname },
    MutationObserver: class { constructor(callback) { this.callback = callback } observe() { doc.observers.push(this) } disconnect() { doc.observers = doc.observers.filter(item => item !== this) } },
    setTimeout(fn) { timers.push(fn); return timers.length },
    clearTimeout(id) { timers[id - 1] = null },
    /** Observers, then the timers they asked for, until the page is quiet; a pass that never stops changing the page fails here. */
    settle() { for (let i = 0; i < 12; i++) { const had = doc.flushMutations(); const due = timers.splice(0).filter(Boolean); due.forEach(fn => fn()); if (!had && due.length === 0) return } assert.fail('the pass never settles') },
  }
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
function stand(doc, tree) { patch(doc.body, { props: {}, kids: host(tree) }); doc.dirty = false; return doc }
const redraw = (doc, tree) => patch(doc.body, { props: {}, kids: host(tree) })

const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const serialize = node => node.nodeType === 3 ? escapeHtml(node.nodeValue) : `<${node.tagName.toLowerCase()}${[...node.attrs].map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join('')}>${node.childNodes.map(serialize).join('')}</${node.tagName.toLowerCase()}>`
const shape = node => node.nodeType === 3 ? JSON.stringify(node.nodeValue) : `${node.tagName}(${node.childNodes.map(shape).join(',')})` // tags and text only
const nodeList = node => [node, ...node.childNodes.flatMap(nodeList)] // every node, in document order
const textNodes = node => node.nodeType === 3 ? (node.nodeValue.trim() ? [node.nodeValue.trim()] : []) : node.childNodes.flatMap(textNodes)
const words = el => el.textContent.replace(/\s+/g, ' ').trim()
/** True when the page is the same nodes in the same order with the same text: nothing inserted, removed, replaced or rewritten. */
function sameNodes(before, doc, label) {
  const after = nodeList(doc.body)
  eq(after.length, before.nodes.length, `${label}: the same number of nodes`)
  ok(after.every((node, index) => node === before.nodes[index]), `${label}: the very same nodes, in the same order`)
  deepEq(after.filter(node => node.nodeType === 3).map(node => node.nodeValue), before.texts, `${label}: the same text in every text node`)
}
const snapshot = doc => { const nodes = nodeList(doc.body); return { nodes, texts: nodes.filter(node => node.nodeType === 3).map(node => node.nodeValue) } }
const gatedIn = doc => doc.querySelectorAll(`[${GATE}]`)

// ---------------------------------------------------------------- the pages and components under test
const pricingModule = load(baseSource('lib/marketing/homepage-v2-pricing.ts'), 'lib/marketing/homepage-v2-pricing.ts')
const billingLib = load(baseSource('lib/studio-billing.ts'), 'lib/studio-billing.ts')
const ICONS = new Proxy({}, { get: () => () => jsx('svg', {}) })
const SUB = (tier, billingCycle) => ({ tier, billingCycle, status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: '2027-01-15T12:00:00.000Z' })
const SCENARIOS = [
  ['free', { tier: 'free' }, null], ['starter', { tier: 'starter' }, null],
  ['pro monthly', { tier: 'pro' }, SUB('pro', 'monthly')], ['pro yearly', { tier: 'pro' }, SUB('pro', 'yearly')], ['pro, no subscription', { tier: 'pro' }, null],
  ['max', { tier: 'premium' }, null], ['max with a subscription', { tier: 'premium' }, SUB('premium', 'monthly')], ['enterprise yearly', { tier: 'enterprise' }, SUB('pro', 'yearly')],
]
const ENVS = [['plain', {}], ['shell', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }], ['shell + p2 account', { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_ACCOUNT: 'true' }]]
const MISSPELLED = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n']
const BILLING_SPELLINGS = [undefined, 'false', 'TRUE', ' true'] // the page itself is the base commit's file; four spellings across every plan and env are enough
const WALLETS = (envName, name) => envName === 'shell' && ['free', 'pro monthly', 'max'].includes(name) ? [true, false] : [true] // the Credit Balance card (with the packs) is drawn only with coupon auth on

function upgradeModule({ source, env, react, calls }) {
  const deps = { react: react.api, '@/components/ui/button': { Button: 'button' }, 'lucide-react': ICONS, '@/lib/studio-payments-open-soon': lib(env) }
  return load(source, UPGRADE, { deps, env, globals: { fetch: async (url, options) => { calls.push(['fetch', url, options]); return { ok: true, json: async () => ({ url: 'https://checkout.example.invalid/c/1' }) } }, window: { location: { href: '' } }, alert: () => {} } })
}
/** The Billing page for one account, as a DOM that can be redrawn. `base` runs the base commit's page and button, else this tree's; `state` is what the page's hooks read, so a test can change it and redraw. */
function renderBilling({ base = false, env, user, subscription, coupon = true, balanceCents = 1234 }) {
  const react = makeReact(), calls = []
  const source = rel => (base ? baseSource(rel) : read(rel))
  const state = { user: { id: 'owned', name: 'Ada Morgan', email: 'owned@example.invalid', ...user }, subscription, balanceCents, coupon }
  const deps = {
    react: react.api, '@/hooks/use-auth': { useAuth: () => ({ user: state.user, isLoading: false }) },
    '@/hooks/use-subscription': { useSubscription: () => ({ subscription: state.subscription, isLoading: false, isActive: state.subscription?.status === 'active', isPro: state.subscription?.tier === 'pro' }) },
    '@/hooks/use-wallet': { useWallet: () => ({ isLoading: false, balanceCents: state.balanceCents, transactions: [] }) }, '@/lib/config': { features: { get couponAuthEnabled() { return state.coupon } } },
    'next/navigation': { useRouter: () => ({ push: path => calls.push(['push', path]) }), useSearchParams: () => ({ get: () => null }) },
    '@/components/ui/button': { Button: 'button' }, '@/components/ui/card': { Card: 'div', CardContent: 'div', CardDescription: 'p', CardHeader: 'div', CardTitle: 'h3' }, '@/components/ui/badge': { Badge: 'span' },
    '@/components/ui/alert': { Alert: props => jsx('div', { role: 'alert', ...props }), AlertDescription: 'div' }, 'lucide-react': ICONS,
    '@/lib/marketing/homepage-v2-pricing': pricingModule, '@/lib/studio-billing': billingLib, '@/components/billing/studio-billing-capacity': { StudioBillingCapacity: () => jsx('div', { 'data-studio-billing-capacity': 'true' }) },
    '@/components/billing/UpgradeButton': upgradeModule({ source: source(UPGRADE), env, react, calls }),
    '@/components/billing/ManageSubscriptionButton': load(read(MANAGE), MANAGE, { deps: { react: react.api, '@/components/ui/button': { Button: 'button' }, 'lucide-react': ICONS }, globals: { fetch: async () => ({ json: async () => ({}) }), window: { location: { href: '' } }, alert: () => {} } }),
  }
  const page = load(source(BILLING_PAGE), BILLING_PAGE, { deps, env, globals: { fetch: async (url, options) => { calls.push(['fetch', url, options]); return { ok: false, json: async () => ({}) } } } })
  const content = page.default().props.children
  const draw = () => { react.reset(); return content.type(content.props) }
  const doc = stand(new Doc(), draw())
  return { doc, calls, react, state, rerender: () => redraw(doc, draw()) }
}
const buttonsOf = doc => doc.querySelectorAll('button')
const summaryOf = doc => doc.querySelectorAll('div').find(el => (el.getAttribute('class') || '').includes('bg-slate-50'))
const featuresOf = doc => doc.querySelectorAll('h4').find(el => words(el) === 'Included in your plan:').parentNode
const packsIn = doc => buttonsOf(doc).filter(el => /^\$\d+$/.test(words(el)))

// ---------------------------------------------------------------- 1. the flag
function proveFlag() {
  const source = read(LIB)
  match(source, /^export const STUDIO_PAYMENTS_OPEN_SOON_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON === 'true'$/m, 'the flag is read inline from the exact string')
  for (const value of MISSPELLED) {
    const env = value === undefined ? {} : { [FLAG]: value }
    eq(lib(env).STUDIO_PAYMENTS_OPEN_SOON_ENABLED, false, `${JSON.stringify(value)} is off`)
  }
  eq(lib(on).STUDIO_PAYMENTS_OPEN_SOON_ENABLED, true, '"true" is on')
  // every other file takes the flag from the lib: the variable name is read in one place only
  for (const rel of [HOOK, MOUNT, UPGRADE, TOPUP, LAYOUT, CHECKOUT, TOPUP_ROUTE, BUILDER]) nomatch(read(rel).replace(/^\s*\/\/.*$/gm, '').replace(/\/\/ .*$/gm, ''), /process\.env\.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON/, `${rel} does not read the variable itself`)
  const exported = lib(on)
  eq(exported.PAYMENTS_OPEN_SOON_LINE, LINE, 'the one line')
  eq(exported.PAYMENTS_OPEN_SOON_STATUS, 503, 'the refusal is a 503')
  deepEq(exported.PAYMENTS_OPEN_SOON_BODY, { error: LINE, code: 'payments_open_soon' }, 'the refusal says the line')
  deepEq([exported.PAYMENTS_OPEN_SOON_HTML_ATTR, exported.PAYMENTS_OPEN_SOON_GATE_ATTR, exported.PAYMENTS_OPEN_SOON_RULE_ATTR, exported.PAYMENTS_OPEN_SOON_KIND_ATTR, exported.PAYMENTS_OPEN_SOON_GROUP_ATTR], [HTML_ATTR, GATE, RULE, KIND, GROUP], 'the attribute names the stylesheet and this proof use')
}

// ---------------------------------------------------------------- 2 + 3. the Billing page
const digest = { base: [], head: [] }
function proveBillingOff() {
  for (const [envName, envBase] of ENVS) {
    for (const [name, user, subscription] of SCENARIOS) for (const coupon of WALLETS(envName, name)) {
      const tag = `billing ${envName} / ${name}${coupon ? ' + wallet' : ''}`
      const before = serialize(renderBilling({ base: true, env: envBase, user, subscription, coupon }).doc.body)
      for (const value of BILLING_SPELLINGS) {
        const env = value === undefined ? envBase : { ...envBase, [FLAG]: value }
        const after = serialize(renderBilling({ env, user, subscription, coupon }).doc.body)
        eq(after, before, `${tag}: flag ${JSON.stringify(value)} is the base commit's page`)
      }
      digest.base.push(before); digest.head.push(serialize(renderBilling({ env: envBase, user, subscription, coupon }).doc.body))
    }
  }
}
function installOn(doc, pathname) { const win = makeWindow(doc, pathname); const stop = lib(on).installPaymentsOpenSoon(win); win.settle(); return { win, stop } }
const LABEL_CONTROL = /^(Upgrade to .+|View Plans)$/
function proveBillingOn() {
  const seen = { upgradeNow: 0, upgradeTo: 0, viewPlans: 0, packs: 0, manage: 0 }
  for (const [envName, envBase] of ENVS) {
    for (const [name, user, subscription] of SCENARIOS) for (const coupon of WALLETS(envName, name)) {
      const tag = `billing ${envName} / ${name}${coupon ? ' + wallet' : ''}`
      const off = renderBilling({ env: envBase, user, subscription, coupon })
      const onPage = renderBilling({ env: { ...envBase, ...on }, user, subscription, coupon })
      const html = onPage.doc.documentElement
      const before = snapshot(onPage.doc)
      const { stop } = installOn(onPage.doc, '/billing')
      eq(html.getAttribute(HTML_ATTR), 'true', `${tag}: <html> carries the scope`)
      // the pass changes attributes and nothing else
      sameNodes(before, onPage.doc, tag)
      // the plan: name, price, status, renewal and features are the flag-off page's, and no part of them is a gated control
      const planOff = summaryOf(off.doc), planOn = summaryOf(onPage.doc)
      eq(words(planOn.childNodes[0]), words(planOff.childNodes[0]), `${tag}: the plan name and price line are unchanged`)
      if (user.tier !== 'free') eq(words(planOn.childNodes[1]), words(planOff.childNodes[1]), `${tag}: the status and renewal are unchanged`)
      eq(words(featuresOf(onPage.doc)), words(featuresOf(off.doc)), `${tag}: the included features are unchanged`)
      for (const part of [planOn.childNodes[0], featuresOf(onPage.doc)]) ok(nodeList(part).filter(node => node.nodeType === 1).every(node => !OURS.some(attr => node.hasAttribute(attr)) && !node.hasAttribute('aria-disabled') && !node.hasAttribute('aria-label')), `${tag}: nothing in the plan or its features is marked`)
      deepEq(onPage.doc.querySelectorAll('span').filter(el => el.hasAttribute('data-studio-billing-plan-status')).map(el => [el.getAttribute('data-studio-billing-plan-status'), words(el)]), off.doc.querySelectorAll('span').filter(el => el.hasAttribute('data-studio-billing-plan-status')).map(el => [el.getAttribute('data-studio-billing-plan-status'), words(el)]), `${tag}: the status badge is unchanged`)
      // every control: the new-checkout ones are gated, nothing else is
      const offButtons = buttonsOf(off.doc), onButtons = buttonsOf(onPage.doc)
      eq(onButtons.length, offButtons.length, `${tag}: no button added or removed`)
      offButtons.forEach((button, index) => {
        const label = words(button), now = onButtons[index]
        if (label === 'Upgrade Now') { // UpgradeButton gates itself in JSX: a real disabled button that says the line, and the pass has nothing to do with it
          seen.upgradeNow++; ok(now.hasAttribute('disabled') && now.getAttribute('aria-disabled') === 'true', `${tag}: Upgrade Now is disabled`); eq(words(now), LINE, `${tag}: Upgrade Now says the line`); ok(now.props.onClick === undefined, `${tag}: it has no click handler`); ok(!now.hasAttribute(GATE), `${tag}: the pass leaves it alone`)
        } else if (LABEL_CONTROL.test(label)) {
          seen[label === 'View Plans' ? 'viewPlans' : 'upgradeTo']++
          eq(now.getAttribute(GATE), '1', `${tag}: ${label} is gated`); eq(now.getAttribute('aria-disabled'), 'true', `${tag}: ${label} is aria-disabled`); eq(now.getAttribute('aria-label'), LINE, `${tag}: ${label} is named by the line`)
          eq(now.getAttribute(KIND), 'label', `${tag}: ${label} is a label control`); eq(now.getAttribute(RULE), label === 'View Plans' ? 'billing-view-plans' : 'billing-upgrade-to', `${tag}: ${label} carries its rule`)
          ok(!now.hasAttribute('disabled'), `${tag}: ${label} has no disabled property set on it`); eq(words(now), label, `${tag}: ${label} still has its own text (the stylesheet draws the line)`)
        } else if (/^\$\d+$/.test(label)) {
          seen.packs++
          eq(now.getAttribute(GATE), '1', `${tag}: ${label} is gated`); eq(now.getAttribute('aria-disabled'), 'true', `${tag}: ${label} is aria-disabled`); eq(now.getAttribute('aria-label'), `${label}, ${LINE}`, `${tag}: ${label} keeps its price in its name`)
          eq(now.getAttribute(KIND), 'price', `${tag}: ${label} is a price control`); eq(now.getAttribute(RULE), 'billing-credit-pack', `${tag}: ${label} carries its rule`); ok(!now.hasAttribute('disabled'), `${tag}: ${label} has no disabled property set on it`); eq(words(now), label, `${tag}: ${label} keeps its price`)
        } else {
          if (label === 'Manage Subscription') seen.manage++
          ok(![...OURS, 'aria-disabled', 'aria-label', 'disabled'].some(attr => now.hasAttribute(attr)), `${tag}: ${label} is untouched`); eq(words(now), label, `${tag}: ${label} keeps its label`)
        }
      })
      // the packs: their grid carries the group marker (the stylesheet draws the one line after it), and nothing else does; no node was added for a line
      const groups = onPage.doc.querySelectorAll('div').filter(el => el.hasAttribute(GROUP))
      eq(groups.length, coupon ? 1 : 0, `${tag}: ${coupon ? 'the grid of packs is marked' : 'no packs, no group'}`)
      if (coupon) { eq(groups[0].getAttribute(GROUP), '1', `${tag}: the group marker`); deepEq(groups[0].childNodes.map(words), ['$10', '$25', '$50', '$100'], `${tag}: it holds the four packs and nothing else`); eq(gatedIn(onPage.doc).filter(el => el.getAttribute(RULE) === 'billing-credit-pack').length, 4, `${tag}: all four packs are gated`) }
      ok(gatedIn(onPage.doc).every(el => el.tagName === 'BUTTON'), `${tag}: only buttons are gated on this page`)
      // the whole page: the same words but the one native label
      const wordsOff = textNodes(off.doc.body), wordsOn = textNodes(onPage.doc.body)
      eq(wordsOn.length, wordsOff.length, `${tag}: the page has the same text nodes`)
      wordsOff.forEach((text, index) => { if (wordsOn[index] !== text) ok(text === 'Upgrade Now' && wordsOn[index] === LINE, `${tag}: only UpgradeButton's own label changed (${JSON.stringify(text)} -> ${JSON.stringify(wordsOn[index])})`) })
      // a gated control swallows a click and Enter and Space; an ungated one does not
      for (const gated of gatedIn(onPage.doc)) { eq(onPage.doc.click(gated), 'stopped', `${tag}: a click on a gated control is stopped`); eq(onPage.doc.press(gated, 'Enter'), 'stopped', `${tag}: Enter is stopped`); eq(onPage.doc.press(gated, ' '), 'stopped', `${tag}: Space is stopped`); eq(onPage.doc.press(gated, 'Tab'), 'passed', `${tag}: Tab is not`) }
      deepEq(onPage.calls, [], `${tag}: no request and no navigation came of it`)
      stop()
      eq(html.getAttribute(HTML_ATTR), null, `${tag}: undone on unmount`)
      ok(nodeList(onPage.doc.body).filter(node => node.nodeType === 1).every(node => ![...OURS, 'aria-disabled', 'aria-label'].some(attr => node.hasAttribute(attr) && !(node.tagName === 'BUTTON' && node.hasAttribute('disabled')))), `${tag}: every attribute the pass set is taken off again`)
      sameNodes(before, onPage.doc, `${tag} after the undo`)
    }
  }
  ok(seen.upgradeNow > 0 && seen.upgradeTo > 0 && seen.viewPlans > 0 && seen.packs > 0 && seen.manage > 0, 'the scenarios cover every entry point and the untouched manage button')
  // the billing rules apply on /billing only
  const elsewhere = renderBilling({ env: { ...on }, user: { tier: 'free' }, subscription: null })
  installOn(elsewhere.doc, '/dashboard')
  eq(gatedIn(elsewhere.doc).length, 0, 'the billing rules do not apply on other routes')
}

// ---------------------------------------------------------------- the page re-rendered under the pass: React must find every node it holds
async function proveRerender() {
  const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', ...on }
  const fresh = (user, subscription, extra = {}) => renderBilling({ env, user, subscription, ...extra }) // drawn once, in the final state: the page the re-rendered one must equal
  // 1. a spinner in a pack (the page's own loading state), and back
  const spin = renderBilling({ env, user: { tier: 'pro' }, subscription: SUB('pro', 'monthly') })
  const { win } = installOn(spin.doc, '/billing')
  const pack = packsIn(spin.doc)[0]
  const request = pack.props.onClick() // a stale handler: it asks the (refusing) route and sets the page's loading state
  spin.rerender()
  eq(words(buttonsOf(spin.doc).filter(el => el.getAttribute(RULE) === 'billing-credit-pack')[0]), '', 'the pack shows a spinner while loading')
  eq(gatedIn(spin.doc).filter(el => el.getAttribute(RULE) === 'billing-credit-pack').length, 4, 'the gate is still on every pack')
  await request; await settleMicrotasks(); spin.rerender(); win.settle()
  deepEq(packsIn(spin.doc).map(words), ['$10', '$25', '$50', '$100'], 'the packs have their prices back')
  eq(gatedIn(spin.doc).filter(el => el.getAttribute(RULE) === 'billing-credit-pack').length, 4, 'and are still gated')
  eq(shape(spin.doc.body), shape(fresh({ tier: 'pro' }, SUB('pro', 'monthly')).doc.body), 'the page after the round trip is the page drawn fresh')
  // 2. a plan change: a cancelled subscription (text), Pro to Max (a block goes), Max to Pro (a block comes back and is gated)
  const plan = renderBilling({ env, user: { tier: 'pro' }, subscription: SUB('pro', 'monthly') })
  const pass = installOn(plan.doc, '/billing')
  plan.state.subscription = { ...SUB('pro', 'monthly'), cancelAtPeriodEnd: true }; plan.rerender(); pass.win.settle()
  match(words(summaryOf(plan.doc)), /Cancels/, 'the renewal line says Cancels'); eq(shape(plan.doc.body), shape(fresh({ tier: 'pro' }, { ...SUB('pro', 'monthly'), cancelAtPeriodEnd: true }).doc.body), 'a cancelled subscription is drawn as fresh')
  ok(buttonsOf(plan.doc).some(el => /^Upgrade to/.test(words(el)) && el.getAttribute(GATE) === '1'), 'the upgrade button is still gated')
  plan.state.user = { ...plan.state.user, tier: 'premium' }; plan.state.subscription = SUB('premium', 'monthly'); plan.rerender(); pass.win.settle()
  eq(shape(plan.doc.body), shape(fresh({ tier: 'premium' }, SUB('premium', 'monthly')).doc.body), 'Pro to Max is drawn as fresh (the actions block went)')
  ok(buttonsOf(plan.doc).every(el => el.getAttribute(GATE) !== '1' || /^\$\d+$/.test(words(el))), 'only the packs are gated for a Max user')
  plan.state.user = { ...plan.state.user, tier: 'pro' }; plan.state.subscription = SUB('pro', 'monthly'); plan.rerender(); pass.win.settle()
  eq(shape(plan.doc.body), shape(fresh({ tier: 'pro' }, SUB('pro', 'monthly')).doc.body), 'Max back to Pro is drawn as fresh')
  ok(buttonsOf(plan.doc).some(el => /^Upgrade to/.test(words(el)) && el.getAttribute(GATE) === '1'), 'the upgrade button that came back is gated')
  ok(buttonsOf(plan.doc).filter(el => words(el) === 'Manage Subscription').every(el => !el.hasAttribute(GATE) && !el.hasAttribute('aria-disabled')), 'Manage Subscription is never gated')
  // 3. a free user: the balance changes under the gated View Plans and the gated packs
  const free = renderBilling({ env, user: { tier: 'free' }, subscription: null })
  const gate = installOn(free.doc, '/billing')
  free.state.balanceCents = 99999; free.rerender(); gate.win.settle()
  eq(shape(free.doc.body), shape(fresh({ tier: 'free' }, null, { balanceCents: 99999 }).doc.body), 'the free page with a new balance is drawn as fresh')
  deepEq(gatedIn(free.doc).map(words), ['$10', '$25', '$50', '$100', 'View Plans'], 'the packs and View Plans are still gated, and nothing else is')
  eq(free.doc.querySelectorAll('div').filter(el => el.hasAttribute(GROUP)).length, 1, 'and the grid of packs is still marked')
  ok(buttonsOf(free.doc).some(el => words(el) === LINE && el.hasAttribute('disabled')), 'UpgradeButton still says the line')
}

// ---------------------------------------------------------------- the account menus
const QUOTA = { tierLabel: 'Pro', remainingPct: { daily: 0.5, weekly: 0.8 }, resetAt: { daily: '2030-01-01T10:00:00.000Z', weekly: '2030-01-04T10:00:00.000Z' } }
function menuP2Dom() {
  const pass = tag => props => jsx(tag, props)
  const item = props => jsx('div', { role: 'menuitem', ...props, onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') props.onClick?.(event) } }) // a menu row acts on Enter and Space itself
  const react = makeReact(), navigated = []
  const deps = {
    react: react.api, '@/components/ui/dropdown-menu': { DropdownMenuContent: pass('div'), DropdownMenuItem: item, DropdownMenuLabel: pass('div'), DropdownMenuRadioGroup: pass('div'), DropdownMenuRadioItem: item, DropdownMenuSeparator: pass('hr') },
    '@/components/ui/avatar': { Avatar: pass('span'), AvatarFallback: pass('span'), AvatarImage: pass('img') }, '@/components/ui/badge': { Badge: pass('span') }, 'lucide-react': ICONS,
    '@/lib/studio-profile-menu': load(read(MENU_LIB), MENU_LIB), '@/lib/studio-p2-polish': load(read(POLISH_LIB), POLISH_LIB, { env: {} }),
  }
  const mod = load(read(MENU_P2), MENU_P2, { deps })
  const tree = mod.StudioProfileMenuP2({ name: 'Ada', email: 'owned@example.invalid', initials: 'AM', tierLabel: 'Pro', quota: QUOTA, theme: 'light', onTheme() {}, onNavigate: target => navigated.push(target), onAbout() {}, onLogout() {} })
  return { doc: stand(new Doc(), tree), navigated }
}
function menuOldDom() {
  const react = makeReact()
  const resolve = name => name === '@/lib/utils' ? { cn: (...parts) => parts.filter(part => typeof part === 'string').join(' ') } : name === '@/lib/studio-p2-polish' ? load(read(POLISH_LIB), POLISH_LIB, { env: {} }) : name === '@/components/user-profile-menu-p2' ? { StudioProfileMenuP2: 'StudioProfileMenuP2' } : /^@\/|^lucide-react$|^next\/|^next-themes$/.test(name) ? names : undefined
  const mod = load(`${read(MENU)}\nexports.__UsageRemaining = UsageRemaining\n`, MENU, { deps: { react: react.api }, resolve })
  return stand(new Doc(), mod.__UsageRemaining({ data: QUOTA, isExpanded: true, onToggle() {} }))
}
const UPGRADE_ROW = '[data-studio-v4-profile-role="upgrade"]'
function proveMenus() {
  // Pass 2 menu
  const off = menuP2Dom()
  const rowOff = off.doc.querySelectorAll(UPGRADE_ROW)
  eq(rowOff.length, 1, 'the Pass 2 menu has one upgrade row'); eq(words(rowOff[0]), 'Upgrade for more usage', 'flag off: its words')
  const menu = menuP2Dom()
  const before = snapshot(menu.doc)
  const { stop } = installOn(menu.doc, '/dashboard')
  sameNodes(before, menu.doc, 'the Pass 2 menu')
  const row = menu.doc.querySelectorAll(UPGRADE_ROW)[0]
  eq(row.getAttribute(GATE), '1', 'flag on: the Pass 2 row is gated'); eq(row.getAttribute('aria-disabled'), 'true', 'aria-disabled'); eq(row.getAttribute('aria-label'), LINE, 'its name is the line'); eq(row.getAttribute(RULE), 'profile-upgrade', 'its rule'); eq(row.getAttribute(KIND), 'label', 'a label control')
  eq(words(row), 'Upgrade for more usage', 'its own words are still in the tree (the stylesheet draws the line)')
  for (const attr of ['disabled', 'tabindex', 'data-disabled']) ok(!row.hasAttribute(attr), `no ${attr} set on a Radix-owned row`)
  eq(menu.doc.click(row), 'stopped', 'a click that reaches the row is stopped'); eq(menu.doc.press(row, 'Enter'), 'stopped', 'Enter on it is stopped'); eq(menu.doc.press(row, ' '), 'stopped', 'Space on it is stopped'); deepEq(menu.navigated, [], 'and nothing navigates')
  const others = menu.doc.querySelectorAll('div').filter(el => el.getAttribute('role') === 'menuitem' && el !== row)
  ok(others.length >= 4, 'the other rows are there')
  for (const other of others) ok(![...OURS, 'aria-disabled', 'aria-label'].some(attr => other.hasAttribute(attr)), `row "${words(other)}" is untouched`)
  const billing = others.find(el => /Workspace & billing/.test(words(el)))
  eq(menu.doc.press(billing, 'Enter'), 'handled', 'Enter on Workspace & billing still opens it'); eq(menu.doc.click(billing), 'handled', 'and so does a click'); deepEq(menu.navigated, ['/billing', '/billing'], 'to /billing')
  eq(words(menu.doc.querySelectorAll('span').find(el => el.getAttribute('data-studio-v4-profile-role') === 'tier')), 'Pro', 'the plan badge is unchanged')
  stop()
  ok(![...OURS, 'aria-disabled', 'aria-label'].some(attr => row.hasAttribute(attr)), 'undone on unmount')
  // original menu
  const oldOff = menuOldDom()
  eq(words(oldOff.querySelectorAll(UPGRADE_ROW)[0]), 'Upgrade for more usage', 'flag off: the original menu\'s words')
  const oldDoc = menuOldDom()
  const oldBefore = snapshot(oldDoc)
  installOn(oldDoc, '/builder')
  sameNodes(oldBefore, oldDoc, 'the original menu')
  const link = oldDoc.querySelectorAll(UPGRADE_ROW)[0]
  eq(link.tagName, 'A', 'the original menu\'s row is a link'); eq(link.getAttribute(GATE), '1', 'flag on: it is gated'); eq(link.getAttribute('aria-label'), LINE, 'named by the line'); eq(words(link), 'Upgrade for more usage', 'its words are still in the tree')
  eq(oldDoc.click(link), 'stopped', 'a click is stopped'); eq(oldDoc.press(link, 'Enter'), 'stopped', 'Enter is stopped'); ok(link.getAttribute('href') === '/billing', 'its href is as it was')
}

// ---------------------------------------------------------------- the pass itself
function provePass() {
  const L = lib(on)
  const build = () => stand(new Doc(), jsx('main', { children: [
    jsx('div', { children: [jsx('button', { children: 'Manage Subscription' }), jsx('button', { children: 'Upgrade to Max' })] }),
    jsx('div', { children: [jsx('button', { children: [jsx('svg', {}), jsx('span', { children: '$10' })] }), jsx('button', { children: '$25' })] }),
    jsx('div', { role: 'alert', children: [jsx('div', { children: 'Unlock all features' }), jsx('button', { children: 'View Plans' })] }),
  ] }))
  const doc = build(), original = snapshot(doc)
  eq(L.applyPaymentsOpenSoon(doc, '/billing'), 4, 'the first pass gates the upgrade, the two packs and View Plans')
  eq(L.applyPaymentsOpenSoon(doc, '/billing'), 0, 'a second pass gates nothing more (idempotent)'); eq(L.applyPaymentsOpenSoon(doc, '/billing/'), 0, 'a trailing slash is the same route')
  sameNodes(original, doc, 'the pass'); eq(doc.querySelectorAll('div').filter(el => el.hasAttribute(GROUP)).length, 1, 'one marked group for the two packs')
  // follows the page
  const live = build(); const win = makeWindow(live, '/billing'); const stop = L.installPaymentsOpenSoon(win); win.settle()
  const grid = live.querySelectorAll('div')[1]
  const late = live.createElement('button'); late.appendChild(live.createTextNode('$50')); grid.appendChild(late); win.settle()
  ok(late.getAttribute(GATE) === '1' && late.getAttribute('aria-label') === '$50, Payments open soon', 'a control that appears later is gated')
  const menu = menuP2Dom(); live.body.appendChild(menu.doc.body.childNodes[0]); win.settle()
  eq(live.querySelectorAll(UPGRADE_ROW)[0].getAttribute(GATE), '1', 'a menu that opens later is gated')
  win.location.pathname = '/dashboard'
  const stray = live.createElement('button'); stray.appendChild(live.createTextNode('Upgrade to Pro')); live.body.appendChild(stray); win.settle()
  ok(!stray.hasAttribute(GATE), 'a billing control on another route is left alone')
  const manage = live.querySelectorAll('button').find(el => words(el) === 'Manage Subscription')
  eq(live.click(manage), 'none', 'a click on an ungated control is not stopped'); eq(live.press(manage, 'Enter'), 'none', 'neither is Enter')
  stop(); eq(live.observers.length, 0, 'the observer is disconnected'); eq((live.listeners.click || []).length, 0, 'the click guard is removed'); eq((live.listeners.keydown || []).length, 0, 'the key guard is removed')
  ok(live.querySelectorAll('button').every(el => ![...OURS, 'aria-disabled', 'aria-label'].some(attr => el.hasAttribute(attr))), 'every attribute is taken off again')
  // invites and coupons are never matched, on any route
  for (const pathname of ['/billing', '/redeem', '/auth/signup', '/admin/coupons', '/dashboard', '/builder']) {
    const coupon = stand(new Doc(), jsx('main', { children: [
      jsx('button', { children: 'Redeem' }), jsx('button', { children: 'Redeem coupon' }), jsx('button', { children: 'Apply code' }), jsx('button', { children: 'Have a coupon?' }), jsx('button', { children: 'Request access' }),
      jsx('button', { children: 'Join with invite code' }), jsx('a', { href: '/redeem', children: 'Redeem an invite' }), jsx('button', { children: 'Create coupon' }), jsx('button', { children: 'Sign in' }), jsx('button', { children: 'Continue' }), jsx('button', { children: 'Add credits' }),
    ] }))
    const w = makeWindow(coupon, pathname); const s = L.installPaymentsOpenSoon(w); w.settle()
    eq(coupon.querySelectorAll('button, a').filter(el => [...OURS, 'aria-disabled', 'aria-label', 'disabled'].some(attr => el.hasAttribute(attr))).length, 0, `${pathname}: no coupon or invite control is touched`)
    for (const el of coupon.querySelectorAll('button, a')) ok(coupon.click(el) !== 'stopped' && coupon.press(el, 'Enter') !== 'stopped', `${pathname}: a click on "${words(el)}" is not stopped`)
    s()
  }
}

// ---------------------------------------------------------------- UpgradeButton, the top-up modal, the layout, the hook
async function proveUpgradeButton() {
  const run = async (source, env, props) => {
    const react = makeReact(), calls = []
    const mod = upgradeModule({ source, env, react, calls })
    react.reset(); const element = mod.UpgradeButton(props); return { element, calls, react }
  }
  const PROPS = [{ priceId: 'price_test_monthly', billingCycle: 'monthly' }, { priceId: 'price_test_yearly', billingCycle: 'yearly', label: 'Go yearly', className: 'ml-2' }]
  for (const props of PROPS) {
    const before = await run(baseSource(UPGRADE), {}, props)
    for (const value of MISSPELLED) {
      const after = await run(read(UPGRADE), value === undefined ? {} : { [FLAG]: value }, props)
      eq(rendered(after.element), rendered(before.element), `UpgradeButton flag ${JSON.stringify(value)}: the base commit's element`)
    }
    await before.element.props.onClick(); const flagOff = await run(read(UPGRADE), {}, props); await flagOff.element.props.onClick()
    deepEq(flagOff.calls, before.calls, 'flag off: the click asks the same route with the same body'); eq(flagOff.calls[0][1], '/api/stripe/create-checkout-session', 'the checkout route')
    digest.base.push(rendered(before.element)); digest.head.push(rendered(flagOff.element))
    const flagOn = await run(read(UPGRADE), on, props)
    const p = flagOn.element.props
    eq(flagOn.element.type, 'button', 'flag on: a button'); ok(p.disabled === true && p['aria-disabled'] === 'true', 'flag on: disabled'); eq(p.children, LINE, 'flag on: it says the line'); eq(p.title, LINE, 'flag on: its title'); ok(p.onClick === undefined, 'flag on: no click handler'); eq(p.className, props.className ?? '', 'flag on: its class')
    deepEq(flagOn.calls, [], 'flag on: nothing was requested')
  }
}
async function proveTopUp() {
  const dialog = { Dialog: props => props.open ? props.children : null, DialogContent: 'div', DialogHeader: 'div', DialogTitle: 'h2', DialogDescription: 'p' }
  const build = async (source, env) => {
    const react = makeReact(), calls = []
    const mod = load(source, TOPUP, { env, deps: { react: react.api, '@/components/ui/dialog': dialog, 'lucide-react': ICONS, '@/lib/utils': { cn: (...parts) => parts.filter(part => typeof part === 'string').join(' ') }, '@/lib/studio-payments-open-soon': lib(env) },
      globals: { fetch: async (url, options) => { calls.push(['fetch', url, options]); return { ok: false, json: async () => ({ error: 'refused' }) } } } })
    const draw = () => { react.reset(); return mod.TopUpModal({ open: true, onOpenChange() {}, reason: 'You hit your daily limit.' }) }
    return { draw, calls, react }
  }
  for (const shell of [undefined, 'true']) {
    const envBase = shell ? { NEXT_PUBLIC_STUDIO_V4_SHELL: shell } : {}
    const before = await build(baseSource(TOPUP), envBase)
    for (const value of MISSPELLED) {
      const after = await build(read(TOPUP), value === undefined ? envBase : { ...envBase, [FLAG]: value })
      eq(rendered(after.draw()), rendered(before.draw()), `top-up modal, shell ${shell}, flag ${JSON.stringify(value)}: the base commit's tree`)
    }
    const flagOff = await build(read(TOPUP), envBase)
    digest.base.push(rendered(before.draw())); digest.head.push(rendered(flagOff.draw()))
    const packsOff = stand(new Doc(), flagOff.draw()).querySelectorAll('button')
    eq(packsOff.length, 4, 'four packs'); ok(packsOff.every(el => !el.hasAttribute('disabled')), 'flag off: enabled')
    const baseButtons = stand(new Doc(), before.draw()).querySelectorAll('button'); await baseButtons[0].props.onClick(); await settleMicrotasks()
    await packsOff[0].props.onClick(); await settleMicrotasks()
    deepEq(flagOff.calls, before.calls, 'flag off: the pack asks the same route with the same body'); eq(flagOff.calls[0][1], '/api/stripe/create-topup-session', 'the top-up route')
    // on: the modal gates itself in JSX (React owns it; no pass is involved)
    const flagOn = await build(read(TOPUP), { ...envBase, ...on })
    const doc = stand(new Doc(), flagOn.draw())
    const packs = doc.querySelectorAll('button')
    eq(packs.length, 4, 'flag on: four packs'); ok(packs.every(el => el.hasAttribute('disabled')), 'flag on: every pack is disabled'); deepEq(packs.map(words), ['$10', '$25', '$50', '$100'], 'flag on: the packs keep their prices')
    deepEq(doc.querySelectorAll('p').filter(el => el.hasAttribute('data-studio-payments-soon-note')).map(words), [LINE], 'flag on: one line says so')
    for (const pack of packs) { await pack.props.onClick(); await settleMicrotasks() }
    deepEq(flagOn.calls, [], 'flag on: no pack makes a request, even by a handler called directly')
    eq(words(doc.querySelectorAll('h2')[0]), 'Add reserve credits', 'flag on: the title is unchanged')
  }
}
function proveLayout() {
  const build = (source, env) => {
    const deps = { '@/components/layout/app-header': { AppHeader: 'AppHeader', BackToBuilderButton: 'BackToBuilderButton' }, '@/components/layout/studio-rail': { StudioRail: 'StudioRail' },
      '@/lib/studio-payments-open-soon': lib(env), '@/components/billing/studio-payments-open-soon-mount': { StudioPaymentsOpenSoonMount: 'StudioPaymentsOpenSoonMount' } }
    return load(source, LAYOUT, { deps, env }).default({ children: 'page' })
  }
  for (const shell of [undefined, 'true']) {
    const envBase = shell ? { NEXT_PUBLIC_STUDIO_V4_SHELL: shell, NEXT_PUBLIC_STUDIO_V4_TOKENS: 'true' } : {}
    const before = build(baseSource(LAYOUT), envBase)
    for (const value of MISSPELLED) eq(rendered(build(read(LAYOUT), value === undefined ? envBase : { ...envBase, [FLAG]: value })), rendered(before), `layout, shell ${shell}, flag ${JSON.stringify(value)}: the base commit's tree`)
    digest.base.push(rendered(before)); digest.head.push(rendered(build(read(LAYOUT), envBase)))
    const withFlag = build(read(LAYOUT), { ...envBase, ...on })
    const mounts = JSON.stringify(withFlag).split('"StudioPaymentsOpenSoonMount"').length - 1
    eq(mounts, 1, 'flag on: the mount is drawn once')
    eq(rendered(withFlag).replace(/,?\{"type":"StudioPaymentsOpenSoonMount","props":\{\}\}/, ''), rendered(before), 'flag on: nothing else in the layout changes')
  }
}
function proveHook() {
  const run = (env, win) => {
    const react = makeReact(), L = lib(env)
    const mod = load(read(HOOK), HOOK, { deps: { react: react.api, '@/lib/studio-payments-open-soon': L }, globals: { window: win } })
    react.reset(); mod.useStudioPaymentsOpenSoon(); react.flushEffects()
    return react
  }
  // off: the effect never reads window or the document
  const trap = new Proxy({}, { get() { throw new Error('the page was touched with the flag off') } })
  for (const value of MISSPELLED) run(value === undefined ? {} : { [FLAG]: value }, trap)
  ok(true, 'flag off: the hook returns before it reads the window')
  // on
  const doc = stand(new Doc(), jsx('main', { children: [jsx('button', { children: 'View Plans' })] }))
  const win = makeWindow(doc, '/billing')
  const react = run(on, win); win.settle()
  eq(doc.documentElement.getAttribute(HTML_ATTR), 'true', 'flag on: <html> carries the scope'); eq(buttonsOf(doc)[0].getAttribute(GATE), '1', 'flag on: the page is gated')
  react.unmount(); eq(doc.documentElement.getAttribute(HTML_ATTR), null, 'unmount: the scope is taken off'); eq(doc.observers.length, 0, 'unmount: no observer left'); ok(!buttonsOf(doc)[0].hasAttribute(GATE), 'unmount: the control is released')
  // the mount draws nothing and calls the hook once
  let calls = 0
  const mount = load(read(MOUNT), MOUNT, { deps: { '@/hooks/use-studio-payments-open-soon': { useStudioPaymentsOpenSoon: () => { calls++ } } } })
  eq(mount.StudioPaymentsOpenSoonMount(), null, 'the mount draws nothing'); eq(calls, 1, 'and calls the hook once')
  // the Builder page: one import, one call
  const page = read(BUILDER)
  eq((page.match(/^import \{ useStudioPaymentsOpenSoon \} from '@\/hooks\/use-studio-payments-open-soon'$/gm) || []).length, 1, 'the Builder page imports the hook once')
  eq((page.match(/^ {2}useStudioPaymentsOpenSoon\(\)$/gm) || []).length, 1, 'and calls it once, unconditionally')
}

// ---------------------------------------------------------------- the two checkout routes (and the portal, which is left alone)
async function proveRoutes() {
  const env = { STRIPE_PRO_MONTHLY_PRICE_ID: 'price_test_monthly', STRIPE_PRO_YEARLY_PRICE_ID: 'price_test_yearly', NEXT_PUBLIC_APP_URL: 'https://app.example.invalid' }
  const run = async (source, file, extra, { session, body }) => {
    const calls = []
    const stripe = { checkout: { sessions: { create: async args => { calls.push(['stripe.checkout.sessions.create', args]); return { id: 'cs_test_1', url: 'https://checkout.example.invalid/c/1' } } } } }
    const deps = {
      'next/server': { NextResponse: { json: (payload, init) => ({ body: payload, status: init?.status ?? 200, headers: init?.headers ?? null }) } },
      'next-auth': { getServerSession: async () => { calls.push(['getServerSession']); return session } }, '@/lib/auth-options': { authOptions: {} },
      '@/lib/stripe/stripe': { getStripe: () => { calls.push(['getStripe']); return stripe } }, '@/lib/stripe/stripe-utils': { getOrCreateStripeCustomer: async (...args) => { calls.push(['getOrCreateStripeCustomer', ...args]); return 'cus_test_1' } },
      '@/lib/studio-payments-open-soon': lib({ ...env, ...extra }),
    }
    const mod = load(source, file, { deps, env: { ...env, ...extra } })
    return plain({ response: await mod.POST({ json: async () => body }), calls })
  }
  const signedIn = { user: { id: 'user-1', email: 'owned@example.invalid', name: 'Ada' } }
  const CASES = {
    [CHECKOUT]: [['signed out', { session: null, body: { priceId: 'price_test_monthly', billingCycle: 'monthly' } }], ['a price that is not ours', { session: signedIn, body: { priceId: 'price_other', billingCycle: 'monthly' } }],
      ['monthly', { session: signedIn, body: { priceId: 'price_test_monthly', billingCycle: 'monthly' } }], ['yearly', { session: signedIn, body: { priceId: 'price_test_yearly', billingCycle: 'yearly' } }]],
    [TOPUP_ROUTE]: [['signed out', { session: null, body: { packId: 'pack_10' } }], ['a pack that is not ours', { session: signedIn, body: { packId: 'pack_7' } }], ['$10', { session: signedIn, body: { packId: 'pack_10' } }], ['$100', { session: signedIn, body: { packId: 'pack_100' } }]],
  }
  for (const file of [CHECKOUT, TOPUP_ROUTE]) {
    for (const [name, input] of CASES[file]) {
      const before = await run(baseSource(file), file, {}, input)
      for (const value of MISSPELLED) eq(JSON.stringify(await run(read(file), file, value === undefined ? {} : { [FLAG]: value }, input)), JSON.stringify(before), `${file} / ${name} / flag ${JSON.stringify(value)}: the base commit's answer and calls`)
      digest.base.push(JSON.stringify(before)); digest.head.push(JSON.stringify(await run(read(file), file, {}, input)))
      const refused = await run(read(file), file, on, input)
      eq(refused.response.status, 503, `${file} / ${name}: flag on: 503`); deepEq(refused.response.body, { error: LINE, code: 'payments_open_soon' }, `${file} / ${name}: it says the line`); deepEq(refused.response.headers, { 'Cache-Control': 'no-store' }, `${file} / ${name}: not cached`)
      deepEq(refused.calls, [], `${file} / ${name}: flag on: no session read, no Stripe customer, no Stripe`)
    }
  }
  eq(sha(read(PORTAL)), sha(baseSource(PORTAL)), 'the Stripe portal route (an existing subscriber\'s Manage Subscription) is the base commit\'s')
  eq(sha(read(MANAGE)), sha(baseSource(MANAGE)), 'Manage Subscription is the base commit\'s')
}

// ---------------------------------------------------------------- 5 + 6. the change itself
const HELD = [ // files other changes' pins hold, the plan display and every coupon / invite / Stripe tier path: byte for byte the base commit's
  BILLING_PAGE, MANAGE, 'components/billing/studio-billing.css', 'components/billing/studio-billing-capacity.tsx', 'lib/studio-billing.ts', MENU, MENU_P2, 'components/user-profile-menu-p2.css', 'components/user-profile-studio-v4.css', MENU_LIB, POLISH_LIB, PORTAL,
  'app/api/webhooks/stripe/route.ts', 'lib/stripe/subscription-plan.ts', 'lib/stripe/stripe-utils.ts', 'lib/stripe/stripe.ts', 'app/api/account/route.ts', 'app/api/subscription/route.ts', 'app/api/billing/invoices/route.ts',
  'app/(auth)/redeem/page.tsx', 'app/api/coupons/redeem/route.ts', 'lib/wallet.ts', 'lib/config.ts', 'app/auth/signup/page.tsx', 'app/admin/coupons/page.tsx', 'app/api/admin/coupons/route.ts', 'app/api/admin/coupons/[id]/route.ts', 'lib/studio-p2-admin.ts',
  'app/(marketing-v3)/pricing/page.tsx', 'lib/marketing/homepage-v2-pricing.ts', 'components/settings/studio-p2-account.css', 'app/(app)/settings/profile/page.tsx', 'hooks/use-subscription.ts',
]
const lineCounts = text => { const map = new Map(); for (const line of text.split('\n')) map.set(line, (map.get(line) ?? 0) + 1); return map }
/** The lines of `text` that the base text does not have (as a multiset): what this change added. */
function addedLines(text, baseText) { const have = lineCounts(baseText), out = []; for (const line of text.split('\n')) { const n = have.get(line) ?? 0; if (n > 0) have.set(line, n - 1); else out.push(line) } return out }
const STACK_BASE = process.env.PAYMENTS_OPEN_SOON_STACK_BASE || '419be9804bcdd7a39a2bb114a78700c8e1fdd55f' // #495's head: this change is stacked on it, so its own diff is what lies over that commit
// The COMMITTED change only (STACK_BASE..HEAD): files other tests write into the working tree while a suite runs (evidence JSON, copied
// sources under docs/) are not this change's, so neither the working tree nor untracked files are read here (stack gate 24 Oct).
const allChanged = () => [...new Set(git('diff', '--name-only', STACK_BASE, 'HEAD').split('\n').filter(Boolean))].filter(rel => !FIRST_PAINT_SCOPE_FILES.has(rel))
function proveChange() {
  for (const rel of HELD) { let base; try { base = baseSource(rel) } catch { continue } eq(sha(read(rel)), sha(base), `${rel} is the base commit's file`) }
  // strip = base
  for (const rel of PAYMENTS_OPEN_SOON_FILES) {
    const text = read(rel), stripped = stripPaymentsOpenSoon(rel, text)
    const stripped495 = stripPublishPreviewInventory(rel, stripped) // stacked: #495's .env.example block is in this tree too, and is not this change's
    eq(stripped495, baseSource(rel), `${rel}: with this change's lines out (and #495's block, for .env.example) it is ${BASE.slice(0, 8)} byte for byte`)
    if (rel !== ENV) eq(stripped, baseSource(rel), `${rel}: with this change's lines out it is ${BASE.slice(0, 8)} byte for byte, with nothing else to take out`)
    ok(stripped !== text, `${rel}: the change is there to strip`)
    eq(stripPaymentsOpenSoon(rel, stripped), stripped, `${rel}: stripping twice changes nothing more`)
    for (const [added] of PAYMENTS_OPEN_SOON_CHANGES[rel]) eq(text.split(added).length - 1, 1, `${rel}: each added piece occurs once`)
  }
  eq(stripPaymentsOpenSoon(LIB, read(LIB)), read(LIB), 'a new file has nothing to strip')
  // the three shared strip roots chain it
  for (const [name, strip] of [['open-read-only', stripOpenReadOnly], ['dark-persist', stripDarkPersist], ['add-slide-status', stripAddSlideStatus]]) {
    const out = strip(BUILDER, read(BUILDER))
    nomatch(out, /useStudioPaymentsOpenSoon|studio-payments-open-soon/, `the ${name} root takes this change's page lines out`)
  }
  nomatch(stripAddSlideStatus(ENV, read(ENV)), /PAYMENTS_OPEN_SOON/, 'a root takes the .env.example block out')
  // scope
  const allowed = new Set([...PAYMENTS_OPEN_SOON_FILES, ...PAYMENTS_OPEN_SOON_NEW_FILES, ...DUPLICATE_COPY_TITLE_FILES, ...DUPLICATE_COPY_TITLE_NEW_FILES, // stacked: duplicate copy title's own files (it is after this change in the stack)
    ...THUMBNAIL_LAST_GOOD_FILES, ...THUMBNAIL_LAST_GOOD_NEW_FILES, ...THUMBNAIL_LAST_GOOD_PIN_FILES, // stacked: thumbnail last good's own files and the pins it teaches (after duplicate copy title in the stack)
    ...BULK_EDIT_UNDO_FILES, ...BULK_EDIT_UNDO_NEW_FILES, ...BULK_EDIT_UNDO_PIN_FILES, // stacked: bulk edit + chat undo's own files and the pins it teaches (after thumbnail last good in the stack)
    'scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs', 'scripts/studio-library-manage-harness.mjs',
    'scripts/test-studio-job-ledger.mjs', 'scripts/test-studio-chat-theme-export.mjs', 'scripts/test-studio-new-deck-handoff-send.mjs',
    'scripts/test-studio-publish-review-fit.mjs', 'scripts/test-studio-version-history-deck-only.mjs', 'scripts/test-studio-compose-entitlement.mjs', 'scripts/test-studio-publish-preview-inventory.mjs', 'scripts/test-studio-chat-element-refine.mjs'])
  deepEq(allChanged().filter(rel => !allowed.has(rel) && !LATER_CHANGE_FILES.has(rel)), [], 'no file outside this change\'s own, the three strip roots, the harness list and the three pins that read through the strip (or a later change\'s, which registers its files in scripts/studio-later-changes.mjs)')
  for (const rel of [...PAYMENTS_OPEN_SOON_FILES, LIB, HOOK, MOUNT, CSS].filter(file => !file.startsWith('scripts/') && file !== ENV)) ok(STACKED_PASS3_FILES.includes(rel), `${rel} is in STACKED_PASS3_FILES`)
  // .env.example
  const env = read(ENV), start = env.indexOf('# PAYMENTS OPEN SOON (')
  ok(start !== -1, '.env.example: the block is introduced'); eq((env.match(/^NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON="false"$/gm) || []).length, 1, '.env.example: documented once, default "false"')
  const block = env.slice(start, env.indexOf('NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON="false"\n', start) + 'NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON="false"\n\n'.length)
  match(block, /exact value "true"/, '.env.example: the block says how the flag is read'); match(block, /Build-time/, '.env.example: build-time'); match(block, /503/, '.env.example: the route refusal'); match(block, /Manage Subscription/, '.env.example: the subscriber\'s link is named as left alone')
  ok(env.slice(0, start).trimEnd().endsWith('NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED="false"'), '.env.example: right after the last FRONTEND-2 block below it in the stack (#495, publish preview inventory)')
  ok(env.slice(start + block.length).startsWith('# PASS2 ADMIN'), '.env.example: right before # PASS2 ADMIN')
  // the stylesheet: scoped to the flag's attribute, reaches only the attributes the pass sets, draws the line and nothing else
  const sheet = postcss.parse(read(CSS)); const contents = []; let rules = 0
  sheet.walkRules(rule => { rules++; for (const selector of rule.selectors) { ok(selector.startsWith('html[data-studio-payments-soon="true"] '), `stylesheet: "${selector}" is scoped to the flag's attribute`); match(selector, /\[data-studio-payments-soon-(gate|group)="1"\]/, `stylesheet: "${selector}" starts from an attribute the pass sets, so no plan text is reachable`) } })
  sheet.walkDecls(decl => {
    ok(!['visibility', 'height', 'width', 'position', 'color', 'background', 'background-color', 'transform', 'overflow'].includes(decl.prop), `stylesheet: ${decl.prop} is not set (the control keeps its own colours, in either theme)`)
    nomatch(decl.value, /var\(--sp-|url\(|transparent/, 'stylesheet: no colour or image of its own')
    if (decl.prop === 'display') { ok(decl.value === 'none' && /> \*$/.test(decl.parent.selector) && /kind="label"/.test(decl.parent.selector), 'stylesheet: display only hides the children of a label control'); }
    if (decl.prop === 'content') contents.push(decl.value)
  })
  deepEq(contents, [`"${LINE}"`, `"${LINE}"`], 'stylesheet: the line it draws is the lib\'s, for a label control and for the packs\' grid')
  ok(rules >= 5, 'stylesheet: the rules are there')
  // the Stripe real-tier flag and its code path, and the portal / webhook files are not read or touched
  const baseOf = rel => { try { return baseSource(rel) } catch { return '' } }
  const addedAll = [...PAYMENTS_OPEN_SOON_FILES, LIB, HOOK, MOUNT, CSS].flatMap(rel => addedLines(read(rel), baseOf(rel)))
  nomatch(addedAll.join('\n'), /STRIPE_REAL_TIER|subscription-plan|api\/webhooks\/stripe|create-portal-session/, 'the Stripe real-tier flag, the price-to-plan table, the webhook and the portal are not named by any added line')
  nomatch(addedAll.filter(line => !/^\s*(\/\/|#|\*)/.test(line)).join('\n'), /prisma|stripeCustomerId|stripe\.billingPortal|\.subscriptions\./, 'no added code reads the subscription records')
  // the pass writes no text and moves no node: nothing in the lib assigns text or touches the tree
  const code = read(LIB).replace(/^\s*\/\/.*$/gm, '').replace(/\/\/ .*$/gm, '')
  nomatch(code, /\.(textContent|nodeValue|innerHTML|outerHTML|innerText)\s*=[^=]|\.(appendChild|insertBefore|removeChild|replaceChild|replaceWith|insertAdjacentElement|insertAdjacentHTML|prepend|append|after|before|remove)\(|createElement|createTextNode|setAttribute\('disabled'|\.disabled\s*=/, 'the lib never writes text, creates or moves a node, or sets disabled')
  // a secret scan: nothing Stripe-key shaped (the patterns are built here, not written out)
  const shapes = [['s', 'k'], ['r', 'k'], ['p', 'k']].map(([a, b]) => new RegExp(`\\b${a}${b}_(live|test)_[A-Za-z0-9]{8,}`)).concat([new RegExp(`\\bwh${'sec'}_[A-Za-z0-9]{8,}`), new RegExp(`\\b(acct|cus|pi|cs|price|prod|sub)_(live|test)?_?[A-Za-z0-9]{14,}`), new RegExp(`Bearer\\s+[A-Za-z0-9._-]{16,}`)])
  for (const line of addedAll) for (const shapeRe of shapes) nomatch(line, shapeRe, `no key-shaped literal in an added line: ${line.slice(0, 80)}`)
}

// ---------------------------------------------------------------- run
async function sourceChecks() {
  proveFlag()
  proveBillingOff(); proveBillingOn(); await proveRerender()
  proveMenus(); provePass()
  await proveUpgradeButton(); await proveTopUp(); proveLayout(); proveHook(); await proveRoutes()
  proveChange()
}

await sourceChecks()
const flagOffHashes = { base: sha(digest.base.join('\n')), head: sha(digest.head.join('\n')) }
eq(flagOffHashes.head, flagOffHashes.base, 'flag off: the hash of every output equals the base commit\'s')
console.log(`flag off: ${digest.base.length} outputs (Billing pages for every plan and env, UpgradeButton, top-up modal, account layout, both checkout routes), sha256 base ${flagOffHashes.base.slice(0, 16)} = this tree ${flagOffHashes.head.slice(0, 16)}`)
const total = checks

// ---------------------------------------------------------------- 7. mutants: a wrong version of one source line must fail the suite above
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
  try { await sourceChecks() } catch { failed = true } finally { overrides = {} }
  assert.ok(failed, `mutant survived: ${name}`)
  caught++
}
const RULE_UPGRADE_TO = "el.tagName === 'BUTTON' && /^Upgrade to\\b/.test(text)"
const GATE_SITE = "el.setAttribute('aria-disabled', 'true')"
await mutant(LIB, 'flag spelling: loose', "process.env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON === 'true'", "process.env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON !== 'false'")
await mutant(LIB, 'flag spelling: truthy', "process.env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON === 'true'", 'Boolean(process.env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON)')
await mutant(LIB, 'flag spelling: case-blind', "process.env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON === 'true'", "String(process.env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON).toLowerCase() === 'true'")
await mutant(LIB, "a paid user's plan name is gated", "const CANDIDATES = 'button, [data-studio-v4-profile-role=\"upgrade\"]'", "const CANDIDATES = 'button, h3, [data-studio-v4-profile-role=\"upgrade\"]'", [RULE_UPGRADE_TO, "/Plan$|^Upgrade to\\b/.test(text)"])
await mutant(LIB, "a subscriber's Manage Subscription is gated", RULE_UPGRADE_TO, "el.tagName === 'BUTTON' && /^(Upgrade to|Manage)\\b/.test(text)")
await mutant(LIB, 'one entry missed: the credit packs', "/^\\$\\d+$/.test(text)", "/^\\$\\d+\\.00$/.test(text)")
await mutant(LIB, 'one entry missed: View Plans', "text === 'View Plans'", "text === 'View plans'")
await mutant(LIB, 'one entry missed: the account menu row', "el.getAttribute('data-studio-v4-profile-role') === 'upgrade'", "el.getAttribute('data-studio-v4-profile-role') === 'upgrad'")
await mutant(LIB, 'the copy is missing', "export const PAYMENTS_OPEN_SOON_LINE = 'Payments open soon'", "export const PAYMENTS_OPEN_SOON_LINE = 'Coming soon'")
await mutant(LIB, 'coupon path disabled: Redeem', RULE_UPGRADE_TO, "el.tagName === 'BUTTON' && /^(Upgrade to|Redeem)\\b/.test(text)")
await mutant(LIB, 'coupon path disabled: any route', "path: '/billing', match: (el, text) => el.tagName === 'BUTTON' && text === 'View Plans'", "match: (el, text) => el.tagName === 'BUTTON' && /^(View Plans|Redeem|Apply)/.test(text)")
await mutant(LIB, 'the real-tier flag is read', "export const STUDIO_PAYMENTS_OPEN_SOON_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON === 'true'", "export const STUDIO_PAYMENTS_OPEN_SOON_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON === 'true' && process.env.STRIPE_REAL_TIER_MAPPING_ENABLED !== 'true'")
await mutant(LIB, 'the status is not a refusal', 'export const PAYMENTS_OPEN_SOON_STATUS = 503', 'export const PAYMENTS_OPEN_SOON_STATUS = 200')
await mutant(LIB, 'pass mutates textContent', GATE_SITE, `${GATE_SITE}; el.textContent = PAYMENTS_OPEN_SOON_LINE`)
await mutant(LIB, 'pass writes a text node', GATE_SITE, `${GATE_SITE}; if (el.firstChild) el.firstChild.nodeValue = PAYMENTS_OPEN_SOON_LINE`)
await mutant(LIB, 'pass inserts a node', GATE_SITE, `${GATE_SITE}; el.after(el.ownerDocument.createElement('p'))`)
await mutant(LIB, 'pass sets disabled on a React-owned element', GATE_SITE, `${GATE_SITE}; el.setAttribute('disabled', '')`)
await mutant(LIB, 'a gated control is not aria-disabled', GATE_SITE, 'void 0')
await mutant(LIB, 'a gated control keeps no accessible name', "el.setAttribute('aria-label', rule.kind === 'price' ? `${text}, ${PAYMENTS_OPEN_SOON_LINE}` : PAYMENTS_OPEN_SOON_LINE)", 'void text')
await mutant(LIB, 'the pass does not follow the page', 'observer.observe(doc.body, { childList: true, subtree: true, characterData: true })', 'void observer')
await mutant(LIB, 'listener missing: click', "doc.addEventListener('click', guard, true)", 'void guard')
await mutant(LIB, 'listener missing: keydown', "doc.addEventListener('keydown', guard, true)", 'void guard')
await mutant(LIB, 'the key guard lets Space through', "if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return", "if (key !== 'Enter') return")
await mutant(LIB, 'the guard stops every key', "if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return", 'void key')
await mutant(LIB, 'the listeners are left on the document', "doc.removeEventListener('keydown', guard, true)", 'void guard')
await mutant(LIB, 'the scope is left on <html>', 'html.removeAttribute(PAYMENTS_OPEN_SOON_HTML_ATTR)', 'void html')
await mutant(LIB, 'the attributes are left on the page', 'release(doc)', 'void doc')
await mutant(LIB, 'the pass is not idempotent', "if (el.getAttribute(PAYMENTS_OPEN_SOON_GATE_ATTR) === '1') continue", 'void 0')
await mutant(LIB, 'the packs have no group marker', "if (rule.kind === 'price' && el.parentElement) el.parentElement.setAttribute(PAYMENTS_OPEN_SOON_GROUP_ATTR, '1')", 'void 0')
await mutant(UPGRADE, 'flag off changed: the button always says so', 'if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) {', 'if (true) {')
await mutant(UPGRADE, 'the button still has its handler', '<Button disabled aria-disabled="true"', '<Button onClick={handleUpgrade} disabled aria-disabled="true"')
await mutant(UPGRADE, 'the button is not disabled', '<Button disabled aria-disabled="true"', '<Button aria-disabled="true"')
await mutant(HOOK, 'flag off changed: the hook ignores the flag', 'if (!STUDIO_PAYMENTS_OPEN_SOON_ENABLED) return', 'void 0')
await mutant(TOPUP, 'one entry missed: the top-up packs', 'disabled={loadingPack !== null || STUDIO_PAYMENTS_OPEN_SOON_ENABLED}', 'disabled={loadingPack !== null}')
await mutant(TOPUP, 'the top-up still asks the route', 'if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) return // NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON: no request is made (the route refuses too)\n', '')
await mutant(TOPUP, 'flag off changed: the top-up line always shows', '{STUDIO_PAYMENTS_OPEN_SOON_ENABLED && <p className="pt-1 text-xs text-muted-foreground"', '{<p className="pt-1 text-xs text-muted-foreground"')
await mutant(CHECKOUT, 'the checkout route does not refuse', 'if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) return', 'if (false) return')
await mutant(TOPUP_ROUTE, 'the top-up route does not refuse', 'if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) return', 'if (false) return')
await mutant(CHECKOUT, 'the checkout route refuses with the wrong status', 'status: PAYMENTS_OPEN_SOON_STATUS', 'status: 400')
await mutant(TOPUP_ROUTE, 'the top-up route refuses only after the session', 'if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) return NextResponse.json({ ...PAYMENTS_OPEN_SOON_BODY }, { status: PAYMENTS_OPEN_SOON_STATUS, headers: { "Cache-Control": "no-store" } })\n  try {\n    const session = await getServerSession(authOptions)', '  try {\n    const session = await getServerSession(authOptions)\n    if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) return NextResponse.json({ ...PAYMENTS_OPEN_SOON_BODY }, { status: PAYMENTS_OPEN_SOON_STATUS })')
await mutant(PORTAL, "the subscriber's portal link refuses", 'try {', "if (true) return NextResponse.json({ error: 'x' }, { status: 503 })\n  try {")
await mutant(LAYOUT, 'flag off changed: the mount is always drawn', '{STUDIO_PAYMENTS_OPEN_SOON_ENABLED && <StudioPaymentsOpenSoonMount />}', '{<StudioPaymentsOpenSoonMount />}')
await mutant(CSS, 'the stylesheet is not scoped', 'html[data-studio-payments-soon="true"] [data-studio-payments-soon-group="1"]::after', '[data-studio-payments-soon-group="1"]::after')
await mutant(CSS, 'the stylesheet says something else', '::after { content: "Payments open soon"; font-size: 11px; line-height: 16px; font-weight: 500;', '::after { content: "Coming soon"; font-size: 11px; line-height: 16px; font-weight: 500;')
await mutant(CSS, 'the stylesheet hides the label with a colour', '{ font-size: 0 !important; line-height: 0 !important; }', '{ font-size: 0 !important; line-height: 0 !important; color: transparent; }')
await mutant(BILLING_PAGE, 'the plan display is edited', '<h3 className="text-lg font-semibold">', '<h3 className="text-lg font-bold">')
await mutant('lib/stripe/subscription-plan.ts', 'the real-tier path is touched', 'export', 'export /* touched */')
console.log(`payments-open-soon: ${total} checks, ${caught} mutants caught`)
