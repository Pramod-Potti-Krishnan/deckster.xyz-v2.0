// COMPOSER-2 (PROGRAM-1 "thumbnails instead of live viewers in the deck list"): the behaviour of the REAL Decks-page card with NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED
// (exact "true", default off): the real page's PresentationCard, the real hook, component and lib, run under the installed React and ReactDOM in an inert DOM host (the host
// scripts/test-studio-first-paint-viewer.mjs uses): no browser, no network (fetch is a recorder), no model call.
// Run: node scripts/test-studio-deck-card-thumbnail-cards.mjs
//
//   S0  flag off (unset, "false", "TRUE", "1", "true ", ""): every card is the base page's card, node for node (hash compared); no observer, no read.
//   S1  flag on, the card is off-screen: no read, no viewer (no iframe); an empty box is watched. An entry that is not intersecting is not "on screen".
//   S2  first visibility: exactly ONE read (the inventory route, no-store); the first-slide image, lazy and async-decoded, alt = the deck title; no cue for a fresh image;
//       no further read on a re-render or a second entry; the card's TITLE node is the same node before and after (not re-keyed, not replaced) and its markup is the base's.
//   S3  the last good image (thumbnail_url null): shown with the cue "May lag" and its accessible label by reason (content, theme, reason absent); the cue is the card's own attribute.
//   S4  every failure keeps today's card exactly (the iframe): network error, 404, 500, a body that is not JSON, another presentation's body, no slides, a row without an image, a hung read.
//   S5  an image that does not load falls back to the iframe, once and for good (a later card of the deck reads nothing and tries no image).
//   S6  one read per deck for the page's life: a card mounted again, and two cards of one deck, read once in all.
//   S7  no IntersectionObserver: today's card, no read.
//   S8  no thumbnail for an empty or blocked decision (today's placeholder), nor for an allowed URL on another origin than the configured Layout (the iframe): no observer, no read.
//   S9  the alt text is the shown title (the cleaned upload name with NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES on).
// Then the hook, the component and the page are re-run against deliberately broken copies: each mutant must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { BASE_COMMIT, DASHBOARD_PAGE, DECK_CARD_THUMBNAIL_MARKER, stripDeckCardThumbnail } from './studio-deck-card-thumbnail-strip.mjs'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
const HOOK = 'hooks/use-studio-deck-card-thumbnail.tsx'
const COMPONENT = 'components/studio-deck-card-thumbnail.tsx'
const LIB = 'lib/studio-deck-card-thumbnail.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED'
const LAYOUT = 'https://layout.example.invalid'
const OTHER = 'https://other.example.invalid'
const EXTRA = 'https://extra.example.invalid'

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), none = count((node, message) => assert.ok(node === undefined, message)), // never assert.equal on a host node: a failure would inspect the whole document graph
   match = count(assert.match), nomatch = count(assert.doesNotMatch)
const settle = () => new Promise(resolve => setImmediate(resolve))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// ---------------------------------------------------------------- the inert DOM host (as scripts/test-studio-first-paint-viewer.mjs)
class HostTarget {
  listeners = new Map()
  addEventListener(type, fn, options) {
    const key = type + ':' + Boolean(typeof options === 'boolean' ? options : options?.capture)
    if (!this.listeners.has(key)) this.listeners.set(key, new Set())
    this.listeners.get(key).add(fn)
  }
  removeEventListener(type, fn, options) {
    this.listeners.get(type + ':' + Boolean(typeof options === 'boolean' ? options : options?.capture))?.delete(fn)
  }
  dispatchEvent(event) {
    event.target ??= this
    event.preventDefault ??= () => { event.defaultPrevented = true }
    event.stopPropagation ??= () => { event.cancelBubble = true }
    const chain = []
    for (let current = this; current; current = current.parentNode) chain.push(current)
    const invoke = (current, capture) => {
      event.currentTarget = current
      for (const fn of [...current.listeners?.get(event.type + ':' + capture) ?? []]) fn(event)
    }
    for (const current of [...chain].reverse()) invoke(current, true)
    for (const current of chain) {
      invoke(current, false)
      if (!event.bubbles || event.cancelBubble) break
    }
    return !event.defaultPrevented
  }
}
class HostNode extends HostTarget {
  constructor(type, name, doc) {
    super(); this.nodeType = type; this.nodeName = name; this.tagName = type === 1 ? name : undefined
    this.ownerDocument = doc; this.parentNode = null; this.childNodes = []; this.attributes = new Map()
    this.namespaceURI = 'http://www.w3.org/1999/xhtml'; this.style = { setProperty() {}, removeProperty() {} }
    this.clientWidth = 0; this.clientHeight = 0; this.clientLeft = 0
  }
  appendChild(node) { return this.insertBefore(node, null) }
  insertBefore(node, before) {
    node.parentNode?.removeChild(node)
    const index = before === null ? this.childNodes.length : this.childNodes.indexOf(before)
    assert.ok(index >= 0); this.childNodes.splice(index, 0, node); node.parentNode = this; return node
  }
  removeChild(node) { const index = this.childNodes.indexOf(node); assert.ok(index >= 0); this.childNodes.splice(index, 1); node.parentNode = null; return node }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  removeAttribute(name) { this.attributes.delete(name) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  get src() { return this.getAttribute('src') ?? '' }
  set src(value) { this.setAttribute('src', value) }
  get firstChild() { return this.childNodes[0] ?? null }
  get lastChild() { return this.childNodes.at(-1) ?? null }
  get nextSibling() { return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map(n => n.textContent).join('') }
  set textContent(value) { for (const node of this.childNodes) node.parentNode = null; this.childNodes = []; if (value) this.appendChild(this.ownerDocument.createTextNode(String(value))) }
  contains(node) { return node === this || this.childNodes.some(child => child.contains(node)) }
  getBoundingClientRect() { return { width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 } }
  focus() { this.ownerDocument.activeElement = this }
}
const documentHost = new HostTarget()
Object.assign(documentHost, { nodeType: 9, nodeName: '#document', parentNode: null,
  createElement: name => new HostNode(1, name.toUpperCase(), documentHost),
  createElementNS: (namespace, name) => new HostNode(1, name.toUpperCase(), documentHost),
  createTextNode: value => Object.assign(new HostNode(3, '#text', documentHost), { nodeValue: value }),
})
documentHost.documentElement = documentHost.createElement('html')
documentHost.body = documentHost.createElement('body')
documentHost.documentElement.appendChild(documentHost.body)
documentHost.activeElement = documentHost.body
const windowHost = new HostTarget()
Object.assign(windowHost, { document: documentHost, innerWidth: 1200, HTMLElement: HostNode, HTMLIFrameElement: class {}, Node: HostNode, setTimeout, clearTimeout, location: { href: 'https://fixture.invalid' } })
documentHost.defaultView = windowHost
Object.assign(globalThis, { window: windowHost, document: documentHost, HTMLElement: HostNode, Node: HostNode, IS_REACT_ACT_ENVIRONMENT: true })
const { createRoot } = await import('react-dom/client')

// ---------------------------------------------------------------- a module graph of the real page, hook, component and lib (the rest are stubs)
const transpiled = new Map()
const transpile = (file, text) => {
  const key = file + '\0' + sha(text)
  if (!transpiled.has(key)) {
    const result = ts.transpileModule(text, { fileName: file, reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
    assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0, `${file} transpiles`)
    transpiled.set(key, result.outputText)
  }
  return transpiled.get(key)
}
const blank = new Proxy({ __esModule: true }, { get: (obj, name) => name in obj ? obj[name] : () => null })
const KEEP = /^(className|href|title|id|role|tabIndex|data-.+|aria-.+)$/
const keep = props => Object.fromEntries(Object.entries(props).filter(([key, value]) => KEEP.test(key) && typeof value !== 'function'))
const tag = name => ({ children, ...props }) => React.createElement(name, keep(props), children)
const Anchor = ({ children, ...props }) => React.createElement('a', keep(props), children)
const uiCache = new Map() // one component per name: a new function on every access would remount the card at every render
const UI = new Proxy({ __esModule: true }, { get: (obj, name) => {
  if (name in obj) return obj[name]
  if (!uiCache.has(name)) {
    const map = { Card: 'div', CardContent: 'div', CardHeader: 'div', CardTitle: 'h3', CardDescription: 'p', Button: 'button', Badge: 'span' }
    uiCache.set(name, map[name] ? tag(map[name]) : name === 'DropdownMenu' || name === 'DropdownMenuTrigger' ? ({ children }) => React.createElement(React.Fragment, null, children) : () => null)
  }
  return uiCache.get(name)
} })

/** One variant's world: its own module graph (so the lib's store starts empty), its own recorders, env and sources. */
function loadWorld({ page, env = {}, observer = true, sources = {} }) {
  const world = { fetches: [], observers: [], routes: new Map(), defaultRoute: null }
  class FakeObserver {
    constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; this.disconnected = false; world.observers.push(this) }
    observe(target) { this.targets.push(target) }
    disconnect() { this.disconnected = true }
  }
  world.fetch = (url, init) => {
    world.fetches.push({ url, init })
    const route = world.routes.get(url) ?? world.defaultRoute
    if (!route) return Promise.reject(new TypeError('no route'))
    return route(url, init)
  }
  const cache = new Map()
  const readModule = (file, text) => {
    file = fs.realpathSync(file)
    if (cache.has(file)) return cache.get(file).exports
    const relative = path.relative(root, file)
    const module = { exports: {} }; cache.set(file, module)
    const source = text ?? sources[relative] ?? fs.readFileSync(file, 'utf8')
    const load = spec => {
      if (spec.endsWith('.css')) return {}
      if (spec === 'react' || spec.startsWith('react/')) return require(spec)
      if (spec === 'next/link') return { __esModule: true, default: Anchor }
      if (spec === 'next/navigation') return { useRouter: () => ({ push() {}, replace() {}, back() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }
      if (spec === 'lucide-react') return blank
      if (spec.startsWith('@/components/ui/')) return UI
      const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null
      if (!base) throw new Error(`unexpected import ${spec} from ${relative}`)
      const target = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
      assert.ok(target, `Missing ${spec}`)
      const rel = path.relative(root, target)
      if (rel === HOOK || rel === COMPONENT || rel.startsWith('lib/') || rel.startsWith('types/')) return readModule(target)
      return blank // every other hook and component is a stub: components render nothing
    }
    vm.runInNewContext(transpile(file, source), { module, exports: module.exports, require: load, process: { env: { NODE_ENV: 'test', NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT, ...env } },
      window: windowHost, document: documentHost, URL, URLSearchParams, AbortController, console, Date, Math, JSON, encodeURIComponent, decodeURIComponent,
      fetch: world.fetch, ...(observer ? { IntersectionObserver: FakeObserver } : {}),
      setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 40)), clearTimeout }, { filename: relative })
    return module.exports
  }
  const exports = readModule(path.join(root, DASHBOARD_PAGE), page + '\nexport { PresentationCard, PresentationPreview }')
  return { world, Card: exports.PresentationCard }
}

// ---------------------------------------------------------------- helpers
const find = (node, predicate) => predicate(node) ? node : node.childNodes.map(child => find(child, predicate)).find(Boolean)
const findAll = (node, predicate, out = []) => { if (predicate(node)) out.push(node); node.childNodes.forEach(child => findAll(child, predicate, out)); return out }
const ser = node => node.nodeType === 3 ? node.nodeValue
  : `<${node.tagName.toLowerCase()}${[...node.attributes].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, value]) => ` ${key}="${value}"`).join('')}>${node.childNodes.map(ser).join('')}</${node.tagName.toLowerCase()}>`
const by = (name, value) => node => node.nodeType === 1 && node.getAttribute(name) === value
const pendingBox = container => find(container, by('data-studio-deck-card-thumbnail', 'pending'))
const imageBox = container => find(container, by('data-studio-deck-card-thumbnail', 'image'))
const imgIn = container => find(container, node => node.tagName === 'IMG')
const iframeIn = container => find(container, node => node.tagName === 'IFRAME')
const cueIn = container => find(container, node => node.nodeType === 1 && (node.attributes.has('data-studio-deck-card-lag') || (node.getAttribute('class') ?? '').includes('lag-cue'))) // by its attribute or its class
const titleIn = container => find(find(container, node => node.tagName === 'H3'), node => node.tagName === 'A')
const headerIn = container => find(container, by('data-studio-deck-card-header', 'true'))

const deck = (id, extra = {}) => ({ id, title: `Deck ${id}`, description: `About ${id}`, createdAt: '2026-10-10T09:00:00Z', updatedAt: '2026-10-10T09:30:00Z', slideCount: 4, status: 'completed',
  thumbnail: '/placeholder.svg', folder: 'general', tags: [], strawmanPreviewUrl: null, finalPresentationUrl: `${LAYOUT}/p/${id}`, currentStage: 6, ...extra })
const cardProps = presentation => ({ presentation, onOpen() {}, getStatusColor: status => `color-${status}`, getStageName: stage => `stage-${stage}` })
const inventoryUrl = id => `${LAYOUT}/api/presentations/${id}/slides/inventory`
const respond = (status, body, { badJson = false } = {}) => () => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => { if (badJson) throw new SyntaxError('bad'); return body } })
const inventory = (id, slides) => ({ presentation_id: id, slide_count: slides.length, slides })
const IMG = n => `https://cdn.example.invalid/slide-qa/${n}.png`

async function mount(Card, presentation, container = documentHost.createElement('div')) {
  documentHost.body.appendChild(container)
  const rootHandle = createRoot(container)
  const fixture = { container, root: rootHandle, presentation }
  fixture.render = async (next = presentation) => { fixture.presentation = next; await React.act(async () => { rootHandle.render(React.createElement(Card, cardProps(next))); await settle() }) }
  fixture.unmount = async () => { await React.act(async () => rootHandle.unmount()); documentHost.body.removeChild(container) }
  await fixture.render(presentation)
  return fixture
}
/** The first observer that watches `box`; a card scrolled into view. */
const intersect = async (world, box, isIntersecting = true) => {
  const observer = world.observers.find(candidate => candidate.targets.includes(box) && !candidate.disconnected)
  assert.ok(observer, 'a live observer watches the box')
  await React.act(async () => { observer.callback([{ isIntersecting }]); await settle(); await delay(5); await settle() })
}
const FLAG_OFF_VALUES = [undefined, 'false', 'TRUE', 'True', '1', 'true ', ' true', '']

// ---------------------------------------------------------------- the scenarios
async function proveCards({ page, sources = {} }, label = 'cards') {
  const at = text => `${label}: ${text}`
  const basePage = stripDeckCardThumbnail(DASHBOARD_PAGE, page)
  const on = { [FLAG]: 'true' }
  const load = (env, extra = {}) => loadWorld({ page, env, sources, ...extra })

  // S0: flag off is the base page's card, node for node
  {
    const FIXTURES = [
      ['an allowed final deck', deck('f1')],
      ['an unfinished deck with a strawman', deck('s1', { status: 'in-progress', currentStage: 4, finalPresentationUrl: null, strawmanPreviewUrl: `${LAYOUT}/p/s1` })],
      ['no preview URL', deck('e1', { finalPresentationUrl: null })],
      ['a blocked origin', deck('b1', { finalPresentationUrl: `${OTHER}/p/b1` })],
      ['a URL without /p/', deck('n1', { finalPresentationUrl: `${LAYOUT}/viewer` })],
    ]
    const baseWorld = loadWorld({ page: basePage, env: {}, sources })
    const digests = []
    for (const [name, presentation] of FIXTURES) {
      const baseFixture = await mount(baseWorld.Card, presentation)
      const base = ser(baseFixture.container)
      await baseFixture.unmount()
      for (const value of FLAG_OFF_VALUES) {
        const { world, Card } = load(value === undefined ? {} : { [FLAG]: value })
        const fixture = await mount(Card, presentation)
        eq(ser(fixture.container), base, at(`flag ${JSON.stringify(value)}, ${name}: the base page's card, node for node`))
        eq(world.fetches.length, 0, at(`flag ${JSON.stringify(value)}, ${name}: no read`))
        eq(world.observers.length, 0, at(`flag ${JSON.stringify(value)}, ${name}: no observer`))
        await fixture.unmount()
      }
      digests.push(base)
    }
    s0Digest = sha(digests.join('\n'))
  }

  // S1 + S2: off-screen, then first visibility
  let titleNodeBefore
  {
    const { world, Card } = load(on)
    world.routes.set(inventoryUrl('d1'), respond(200, inventory('d1', [{ slide_id: 'a', thumbnail_url: IMG(1) }, { slide_id: 'b', thumbnail_url: IMG(2) }])))
    const fixture = await mount(Card, deck('d1'))
    eq(world.fetches.length, 0, at('S1 an off-screen card makes no read'))
    none(iframeIn(fixture.container), at('S1 and loads no viewer'))
    none(imgIn(fixture.container), at('S1 and shows no image yet'))
    const box = pendingBox(fixture.container)
    ok(box, at('S1 an empty box stands in the preview area'))
    eq(box.getAttribute('aria-hidden'), 'true', at('S1 the empty box is hidden from assistive technology'))
    eq(box.childNodes.length, 0, at('S1 and is empty'))
    eq(world.observers.length, 1, at('S1 one observer'))
    ok(world.observers[0].targets.length === 1 && world.observers[0].targets[0] === box, at('S1 watching that box'))
    eq(world.observers[0].options.rootMargin, '0px', at('S1 no look-ahead margin: off-screen means off-screen'))
    ok(find(fixture.container, by('data-studio-deck-preview', 'true')), at('S1 the preview link keeps its attribute'))
    titleNodeBefore = titleIn(fixture.container)
    const titleMarkupBefore = ser(titleNodeBefore)
    const headerBefore = ser(headerIn(fixture.container))
    await fixture.render(); await fixture.render()
    eq(world.fetches.length, 0, at('S1 re-renders make no read either'))
    await intersect(world, box, false)
    eq(world.fetches.length, 0, at('S1 an entry that is not intersecting is not on screen: no read'))
    ok(pendingBox(fixture.container), at('S1 still the empty box'))
    await intersect(world, box, true)
    eq(world.fetches.length, 1, at('S2 first visibility: exactly one read'))
    eq(world.fetches[0].url, inventoryUrl('d1'), at('S2 the deck\'s inventory route on the configured Layout'))
    eq(world.fetches[0].init.cache, 'no-store', at('S2 read as the rail reads'))
    const img = imgIn(fixture.container)
    ok(img, at('S2 the first-slide image is drawn'))
    eq(img.getAttribute('src'), IMG(1), at('S2 slide 1\'s image, as given'))
    eq(img.getAttribute('alt'), 'Deck d1', at('S2 alt is the deck\'s title'))
    eq(img.getAttribute('loading'), 'lazy', at('S2 lazy'))
    eq(img.getAttribute('decoding'), 'async', at('S2 async-decoded'))
    none(iframeIn(fixture.container), at('S2 and no viewer'))
    none(pendingBox(fixture.container), at('S2 the empty box is gone'))
    none(cueIn(fixture.container), at('S2 a fresh image carries no cue'))
    ok(world.observers[0].disconnected, at('S2 the observer stops watching'))
    ok(titleIn(fixture.container) === titleNodeBefore, at('S2 the title node is the very same node (not re-keyed, not replaced)'))
    eq(ser(titleIn(fixture.container)), titleMarkupBefore, at('S2 and its markup is unchanged'))
    eq(ser(headerIn(fixture.container)), headerBefore, at('S2 so is the whole header'))
    await fixture.render(); await fixture.render()
    await React.act(async () => { world.observers[0].callback([{ isIntersecting: true }]); await settle() })
    eq(world.fetches.length, 1, at('S2 no second read on a re-render or a late entry'))
    // the rest of the card is the base card's: header and content subtrees are the flag-off page's
    const baseWorld = loadWorld({ page: basePage, env: {}, sources })
    const baseFixture = await mount(baseWorld.Card, deck('d1'))
    eq(ser(headerIn(fixture.container)), ser(headerIn(baseFixture.container)), at('S2 the header is the base page\'s header'))
    eq(ser(find(fixture.container, by('data-studio-deck-card-content', 'true'))), ser(find(baseFixture.container, by('data-studio-deck-card-content', 'true'))), at('S2 the content is the base page\'s content'))
    eq(find(fixture.container, by('data-studio-deck-preview', 'true')).getAttribute('class'), find(baseFixture.container, by('data-studio-deck-preview', 'true')).getAttribute('class'), at('S2 the preview link keeps its classes'))
    eq(find(fixture.container, by('data-studio-deck-preview', 'true')).getAttribute('aria-label'), 'Open Deck d1 in Studio', at('S2 and its label'))
    await baseFixture.unmount()
    await fixture.unmount()
  }

  // S3: the last good image, with the cue
  for (const [name, row, wantLabel, wantKind] of [
    ['reason absent', { thumbnail_url: null, last_good_thumbnail_url: IMG(7) }, 'Preview may not show recent edits', 'content'],
    ['reason null', { thumbnail_url: null, last_good_thumbnail_url: IMG(7), thumbnail_stale_reason: null }, 'Preview may not show recent edits', 'content'],
    ['reason content', { thumbnail_url: null, thumbnail_stale: true, last_good_thumbnail_url: IMG(7), thumbnail_stale_reason: 'content' }, 'Preview may not show recent edits', 'content'],
    ['reason theme', { thumbnail_url: null, thumbnail_stale: true, last_good_thumbnail_url: IMG(7), thumbnail_stale_reason: 'theme' }, 'Preview shows the previous theme', 'theme'],
  ]) {
    const { world, Card } = load(on)
    world.routes.set(inventoryUrl('g1'), respond(200, inventory('g1', [{ slide_id: 'a', ...row }, { slide_id: 'b', thumbnail_url: IMG(8) }])))
    const fixture = await mount(Card, deck('g1'))
    await intersect(world, pendingBox(fixture.container))
    eq(world.fetches.length, 1, at(`S3 ${name}: one read`))
    eq(imgIn(fixture.container)?.getAttribute('src'), IMG(7), at(`S3 ${name}: the last good image of slide 1`))
    const cue = cueIn(fixture.container)
    ok(cue, at(`S3 ${name}: the cue`))
    eq(cue.getAttribute('role'), 'img', at(`S3 ${name}: an image role`))
    eq(cue.getAttribute('aria-label'), wantLabel, at(`S3 ${name}: the accessible label`))
    eq(cue.getAttribute('data-studio-deck-card-lag'), wantKind, at(`S3 ${name}: the kind`))
    eq(cue.textContent, 'May lag', at(`S3 ${name}: the visible text`))
    eq(cue.childNodes[0].getAttribute('aria-hidden'), 'true', at(`S3 ${name}: the visible text is hidden from the label`))
    eq(cue.getAttribute('class'), 'studio-deck-card-lag-cue', at(`S3 ${name}: the card's own class`))
    ok(!cue.attributes.has('data-studio-thumbnail-lag'), at(`S3 ${name}: not the rail's attribute`))
    ok(imageBox(fixture.container).contains(cue), at(`S3 ${name}: inside the image box (over the corner of the preview)`))
    none(iframeIn(fixture.container), at(`S3 ${name}: no viewer`))
    await fixture.unmount()
  }

  // S4: every failure keeps today's card exactly (the base page's card, node for node)
  {
    const baseWorld = loadWorld({ page: basePage, env: {}, sources })
    const baseFixture = await mount(baseWorld.Card, deck('x1'))
    const base = ser(baseFixture.container)
    ok(iframeIn(baseFixture.container), at('control: today\'s card has the iframe'))
    await baseFixture.unmount()
    for (const [name, route] of [
      ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
      ['a 404', respond(404, {})],
      ['a 500', respond(500, {})],
      ['a 500 that carries a good inventory body', respond(500, inventory('x1', [{ thumbnail_url: IMG(1) }]))],
      ['a 404 that carries a good inventory body', respond(404, inventory('x1', [{ thumbnail_url: IMG(1) }]))],
      ['a body that is not JSON', respond(200, null, { badJson: true })],
      ['another presentation\'s body', respond(200, inventory('other', [{ thumbnail_url: IMG(1) }]))],
      ['no slides', respond(200, inventory('x1', []))],
      ['a row without an image', respond(200, inventory('x1', [{ thumbnail_url: null }, { thumbnail_url: IMG(2) }]))],
      ['a row with a non-http image', respond(200, inventory('x1', [{ thumbnail_url: 'javascript:alert(1)' }]))],
      ['a hung read', () => new Promise(() => {})],
    ]) {
      const { world, Card } = load(on)
      world.routes.set(inventoryUrl('x1'), route)
      const fixture = await mount(Card, deck('x1'))
      eq(world.fetches.length, 0, at(`S4 ${name}: no read before the card is seen`))
      await intersect(world, pendingBox(fixture.container))
      await React.act(async () => { await delay(80); await settle() }) // the read's time limit (scaled to 40 ms here) for the hung one
      eq(world.fetches.length, 1, at(`S4 ${name}: exactly one read`))
      const frame = iframeIn(fixture.container)
      ok(frame, at(`S4 ${name}: today's viewer frame`))
      eq(frame.getAttribute('src'), `${LAYOUT}/p/x1`, at(`S4 ${name}: the frame's address`))
      eq(frame.getAttribute('class'), 'w-full h-full pointer-events-none', at(`S4 ${name}: its classes`))
      eq(frame.getAttribute('title'), 'Deck x1', at(`S4 ${name}: its title`))
      eq(frame.getAttribute('loading'), 'lazy', at(`S4 ${name}: lazy`))
      none(imgIn(fixture.container), at(`S4 ${name}: no image`))
      eq(ser(fixture.container), base, at(`S4 ${name}: the base page's card, node for node`))
      await fixture.unmount()
    }
  }

  // S5: an image that does not load
  {
    const { world, Card } = load(on)
    world.routes.set(inventoryUrl('i1'), respond(200, inventory('i1', [{ thumbnail_url: IMG(1) }])))
    const fixture = await mount(Card, deck('i1'))
    await intersect(world, pendingBox(fixture.container))
    const img = imgIn(fixture.container)
    ok(img, at('S5 the image is drawn first'))
    await React.act(async () => { img.dispatchEvent({ type: 'error', bubbles: false }); await settle() })
    none(imgIn(fixture.container), at('S5 the failed image is gone'))
    ok(iframeIn(fixture.container), at('S5 today\'s viewer frame instead'))
    eq(iframeIn(fixture.container).getAttribute('src'), `${LAYOUT}/p/i1`, at('S5 at the deck\'s address'))
    await fixture.unmount()
    const observersBefore = world.observers.length
    const again = await mount(Card, deck('i1'))
    ok(iframeIn(again.container), at('S5 a card of the same deck goes straight to the frame'))
    none(imgIn(again.container), at('S5 and tries no image'))
    eq(world.fetches.length, 1, at('S5 and reads nothing'))
    eq(world.observers.length, observersBefore, at('S5 and watches nothing'))
    await again.unmount()
  }

  // S6: one read per deck for the page's life
  {
    const { world, Card } = load(on)
    world.routes.set(inventoryUrl('c1'), respond(200, inventory('c1', [{ thumbnail_url: IMG(1) }])))
    world.routes.set(inventoryUrl('c2'), respond(500, {}))
    const first = await mount(Card, deck('c1'))
    const twin = await mount(Card, deck('c1'))
    await intersect(world, pendingBox(first.container))
    await intersect(world, pendingBox(twin.container))
    eq(world.fetches.length, 1, at('S6 two cards of one deck, one read'))
    ok(imgIn(first.container) && imgIn(twin.container), at('S6 both draw the image'))
    await first.unmount(); await twin.unmount()
    const observersBefore = world.observers.length
    const remounted = await mount(Card, deck('c1'))
    eq(world.fetches.length, 1, at('S6 a card mounted again reads nothing'))
    eq(imgIn(remounted.container)?.getAttribute('src'), IMG(1), at('S6 and draws the image at once'))
    eq(world.observers.length, observersBefore, at('S6 without watching'))
    await remounted.unmount()
    const failing = await mount(Card, deck('c2'))
    await intersect(world, pendingBox(failing.container))
    eq(world.fetches.length, 2, at('S6 another deck is another read'))
    await failing.unmount()
    const failedAgain = await mount(Card, deck('c2'))
    eq(world.fetches.length, 2, at('S6 a FAILED read is not retried'))
    ok(iframeIn(failedAgain.container), at('S6 the failed deck keeps its frame'))
    await failedAgain.unmount()
  }

  // S7: no IntersectionObserver in this browser
  {
    const { world, Card } = load(on, { observer: false })
    world.routes.set(inventoryUrl('o1'), respond(200, inventory('o1', [{ thumbnail_url: IMG(1) }])))
    const fixture = await mount(Card, deck('o1'))
    ok(iframeIn(fixture.container), at('S7 today\'s viewer frame'))
    none(pendingBox(fixture.container), at('S7 not left waiting'))
    eq(world.fetches.length, 0, at('S7 no read: a card whose visibility is unknown does not read'))
    await fixture.unmount()
  }

  // S8: nothing to read for an empty or blocked decision, nor for another origin than the configured Layout
  {
    const baseWorld = loadWorld({ page: basePage, env: { NEXT_PUBLIC_LAYOUT_VIEWER_ALLOWED_ORIGINS: EXTRA }, sources })
    for (const [name, presentation, want] of [
      ['no preview URL', deck('p1', { finalPresentationUrl: null }), 'placeholder'],
      ['a blocked origin', deck('p2', { finalPresentationUrl: `${OTHER}/p/p2` }), 'placeholder'],
      ['an allowed extra origin', deck('p3', { finalPresentationUrl: `${EXTRA}/p/p3` }), 'frame'],
      ['an allowed URL without /p/', deck('p4', { finalPresentationUrl: `${LAYOUT}/viewer` }), 'frame'],
    ]) {
      const baseFixture = await mount(baseWorld.Card, presentation)
      const base = ser(baseFixture.container)
      await baseFixture.unmount()
      const { world, Card } = load({ ...on, NEXT_PUBLIC_LAYOUT_VIEWER_ALLOWED_ORIGINS: EXTRA })
      const fixture = await mount(Card, presentation)
      eq(ser(fixture.container), base, at(`S8 ${name}: the base page's card, node for node`))
      eq(world.observers.length, 0, at(`S8 ${name}: nothing watched`))
      eq(world.fetches.length, 0, at(`S8 ${name}: nothing read`))
      if (want === 'frame') ok(iframeIn(fixture.container), at(`S8 ${name}: today's frame`))
      else eq(imgIn(fixture.container)?.getAttribute('src'), '/placeholder.svg', at(`S8 ${name}: today's placeholder`))
      await fixture.unmount()
    }
  }

  // S9: the alt text is the shown title
  {
    const upload = 'Deck03_Northwind_QBR.pptx — upload 2026-10-12 22:53 UTC [f1x7]'
    const { world, Card } = load({ ...on, NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES: 'true' })
    world.routes.set(inventoryUrl('t1'), respond(200, inventory('t1', [{ thumbnail_url: IMG(1) }])))
    const fixture = await mount(Card, deck('t1', { title: upload }))
    await intersect(world, pendingBox(fixture.container))
    eq(imgIn(fixture.container)?.getAttribute('alt'), 'Deck03 Northwind QBR', at('S9 alt is the cleaned upload name, as the frame\'s title is'))
    await fixture.unmount()
  }
}
let s0Digest = ''

// =========================================================== the real card
const pageText = read(DASHBOARD_PAGE)
await proveCards({ page: pageText }, 'cards')
console.log(`flag-off card sha256 ${s0Digest.slice(0, 16)} (5 decks; every flag spelling except the exact "true" renders these bytes)`)
console.log(`PASS the real card: ${checks} checks`)

// =========================================================== mutants
const killed = [], survived = []
const swapIn = (source, from, to) => { ok(source.includes(from), `mutant text exists: ${from.slice(0, 70)}`); return source.replace(from, () => to) }
async function mutant(name, run) {
  if (process.env.MUTANT_ONLY && !name.includes(process.env.MUTANT_ONLY)) return // debugging aid: run one mutant
  if (process.env.MUTANT_TRACE) console.log(`mutant: ${name}`)
  try { await run() } catch (error) { killed.push(name); return }
  survived.push(name)
}
const hookText = read(HOOK), componentText = read(COMPONENT), libText = read(LIB)
const hookMutant = (name, from, to) => mutant(`hook: ${name}`, () => proveCards({ page: pageText, sources: { [HOOK]: swapIn(hookText, from, to) } }, name))
const componentMutant = (name, from, to) => mutant(`component: ${name}`, () => proveCards({ page: pageText, sources: { [COMPONENT]: swapIn(componentText, from, to) } }, name))
const libMutant = (name, from, to) => mutant(`lib: ${name}`, () => proveCards({ page: pageText, sources: { [LIB]: swapIn(libText, from, to) } }, name))
const pageMutant = (name, from, to) => mutant(`page: ${name}`, () => proveCards({ page: swapIn(pageText, from, to) }, name))

await hookMutant('the flag is not honoured (always on)', 'const id = STUDIO_DECK_CARD_THUMBNAILS_ENABLED ? deckCardThumbnailTarget(', 'const id = true ? deckCardThumbnailTarget(')
await hookMutant('reads before the card is seen', 'if (!id || !seen || store.peek(id)) return', 'if (!id || store.peek(id)) return')
await hookMutant('never watches the card', 'if (!id || answer || seen) return', 'return')
await hookMutant('the box is not handed to the observer', 'observeFirstVisibility(box.current, () => setSeen(true)', 'observeFirstVisibility({}, () => setSeen(true)')
await hookMutant('a card is "seen" at once', 'const [seen, setSeen] = useState(false)', 'const [seen, setSeen] = useState(true)')
await mutant('hook: each card has its own store', () => proveCards({ page: pageText, sources: { [HOOK]: swapIn(swapIn(hookText, 'const store = createDeckCardThumbnailStore()', 'const makeStore = createDeckCardThumbnailStore'), 'export function useStudioDeckCardThumbnail(decision: LayoutViewerUrlDecision, title: string): ReactNode | null {', 'export function useStudioDeckCardThumbnail(decision: LayoutViewerUrlDecision, title: string): ReactNode | null {\n  const store = useRef(makeStore()).current') } }, 'own store'))
await hookMutant('a failed answer draws an image', "if (answer.kind !== 'image') return null", '')
await hookMutant('an image error does nothing', 'onError={() => { store.markImageFailed(id); refresh() }}', 'onError={() => {}}')
await hookMutant('an image error is not remembered', 'onError={() => { store.markImageFailed(id); refresh() }}', 'onError={() => { refresh() }}')
await hookMutant('no observer leaves the card waiting', 'if (unobservable) return null\n', '')
await hookMutant('an unobservable card is not marked', 'if (!stop) { setUnobservable(true); return }', 'if (!stop) return')
await hookMutant('the read goes to a fixed address', 'getBaseUrl: getLayoutServiceUrl,', "getBaseUrl: () => 'https://layout.example.invalid/x',")
await hookMutant('the title is not passed to the image', 'title={title}', 'title=""')
await hookMutant('the cue reason is dropped', 'lag={answer.thumbnail.lag}', 'lag={null}')
await hookMutant('the pending box is not drawn', 'return <StudioDeckCardThumbnailPending boxRef={box} />', 'return null')
await hookMutant('the origin of the configured Layout is not passed', 'LAYOUT_VIEWER_URL_POLICY.configuredOrigin', 'decision.status === \'allowed\' ? decision.origin : null')
await componentMutant('the image is not lazy', ' loading="lazy"', '')
await componentMutant('the image is not async-decoded', ' decoding="async"', '')
await componentMutant('the alt is dropped', 'alt={title} ', '')
await componentMutant('the URL is rewritten', 'src={url}', 'src={url + "?w=300"}')
await componentMutant('the cue is always drawn', '{lag ? (', '{true ? (')
await componentMutant('the cue is never drawn', '{lag ? (', '{false ? (')
await componentMutant('the cue has no accessible label', 'aria-label={thumbnailLagLabel(lag)}', '')
await componentMutant('the cue label is always the content one', 'aria-label={thumbnailLagLabel(lag)}', 'aria-label={thumbnailLagLabel(null)}')
await componentMutant('the cue wears the rail\'s attribute', 'data-studio-deck-card-lag={lag}', 'data-studio-thumbnail-lag={lag}')
await componentMutant('the cue text is announced twice', '<span aria-hidden="true">', '<span>')
await componentMutant('the pending box is not hidden', ' aria-hidden="true" />', ' />')
await componentMutant('the pending box is not the observed element', 'ref={boxRef} ', '')
await componentMutant('the image has no error handler', ' onError={onError}', '')
await libMutant('another origin gets a thumbnail', 'if (!configuredOrigin || decision.origin !== configuredOrigin) return null', 'if (!configuredOrigin) return null')
await libMutant('an unseen card is "visible"', 'if (done || !entries.some(entry => entry.isIntersecting)) return', 'if (done) return')
await libMutant('the second slide is read', 'const thumbnail = deckCardThumbnailFromRow(slides[0])', 'const thumbnail = deckCardThumbnailFromRow(slides[1] ?? slides[0])')
await libMutant('last good wins over a fresh image', "if (fresh) return { url: fresh, lag: null }", "const early = safeUrl(row.last_good_thumbnail_url); if (early) return { url: early, lag: null }; if (fresh) return { url: fresh, lag: null }")
await libMutant('no last good image', 'const lastGood = safeUrl(row.last_good_thumbnail_url)', 'const lastGood = null')
await libMutant('the time limit is dropped', 'return await Promise.race([read, limit])', 'return await read')
await libMutant('a failure is not a fallback', "if (!response.ok) return fallback(`http_${response.status}`)", '')
await libMutant('the store forgets', "settled.set(presentationId, result)", '')
await pageMutant('the early return is dropped', '  if (deckCardThumbnail) return deckCardThumbnail // DECK-CARD-THUMBNAIL\n', '')
await pageMutant('the hook gets the stored title', 'useStudioDeckCardThumbnail(decision, deckTitle(presentation))', 'useStudioDeckCardThumbnail(decision, presentation.title)')
await pageMutant('the hook gets an empty decision', 'useStudioDeckCardThumbnail(decision, deckTitle(presentation))', 'useStudioDeckCardThumbnail({ status: "empty", url: null, origin: null }, deckTitle(presentation))')
await pageMutant('the title is re-keyed (a new key at every render)', '<CardTitle className="text-lg line-clamp-1"><Link href={href}', '<CardTitle key={Math.random()} className="text-lg line-clamp-1"><Link href={href}')

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.error(`SURVIVED:\n  ${survived.join('\n  ')}`); process.exit(1) }
ok(DECK_CARD_THUMBNAIL_MARKER.length > 0 && BASE_COMMIT.length === 40 && git('cat-file', '-t', BASE_COMMIT).trim() === 'commit', 'the base commit is in this clone')
console.log(`test-studio-deck-card-thumbnail-cards: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
