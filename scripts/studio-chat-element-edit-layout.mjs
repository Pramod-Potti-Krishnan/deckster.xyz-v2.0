// NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT (FRONTEND-2 Pass 3, P3-1 A): the REAL Layout viewer code, run in a node vm, for scripts/test-studio-chat-element-edit.mjs.
// No browser, no iframe, no server, no network (this Mac's Chromium refuses a loopback viewer in an iframe), so the viewer's own JS is executed here, from a
// layout-builder checkout (the uat head the Studio stack is built against), the way scripts/studio-chat-element-refine-layout.mjs does for requestElementRefine.
//
// What runs is Layout's, unchanged:
//  - viewer/presentation-viewer.html: the postMessage dispatcher (the `window.addEventListener('message', ...)` bridge with every command case), its
//    ALLOWED_PARENT_ORIGINS / isAllowedParentOrigin and VIEW_ONLY, cut out by exact anchors (the two constants Layout's server fills in are set here);
//  - the /src/utils scripts the page loads that the commands need, in the page's order: edit-mode.js, grid-converter.js, auto-save.js, element-manager.js.
// What is not Layout's: a small fake DOM (nodes, a selector matcher for the selectors these scripts use, computed style), a virtual clock shared with the
// Studio side (Layout's setTimeout is the clock's), a window.fetch the test controls (the autosave PUT), and the registry entries renderPresentation would
// make in a browser (registerElement). Reveal.js is absent, as it is for every command that does not navigate.
//
// A world is recordable: every request the viewer receives and every frame it posts to the parent (replies, saveStatusChanged, elementDeleted ...) is logged
// with the virtual time, so the proof can replay the transcript offline (replayViewer) and, when the checkout is there, check that the live code still says
// exactly what was recorded.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'

export const LAYOUT_SCRIPTS = ['src/utils/edit-mode.js', 'src/utils/grid-converter.js', 'src/utils/auto-save.js', 'src/utils/element-manager.js']
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

// ---- a virtual clock, shared by the Studio side and the viewer -------------------------------------------------------------------------------
export function createClock() {
  let now = 0, nextId = 1
  const timers = new Map()
  const turn = () => new Promise(resolve => setImmediate(resolve))
  let guard = null
  return {
    now: () => now,
    /** `fn` runs when time has been advanced; it throws to fail the test that is driving the clock (a replay that diverged from its recording). */
    setGuard(fn) { guard = fn },
    setTimeout(fn, ms = 0) { const id = nextId++; timers.set(id, { at: now + Math.max(0, Number(ms) || 0), id, fn }); return id },
    clearTimeout(id) { timers.delete(id) },
    pending: () => timers.size,
    turn,
    /** Runs every timer due within `ms` of virtual time, in order, letting promise chains settle between them. */
    async advance(ms) {
      const target = now + ms
      for (let guard = 0; guard < 10_000; guard++) {
        await turn()
        const due = [...timers.values()].filter(timer => timer.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0]
        if (!due) break
        timers.delete(due.id)
        now = Math.max(now, due.at)
        due.fn()
      }
      now = target
      await turn()
      guard?.()
    },
    /** Advances in `stepMs` steps until `promise` settles (or `maxMs` of virtual time pass); returns the promise's value. */
    async drive(promise, { stepMs = 50, maxMs = 120_000 } = {}) {
      let settled = false, value, error, failed = false
      promise.then(v => { settled = true; value = v }, e => { settled = true; failed = true; error = e })
      for (let spent = 0; !settled && spent <= maxMs; spent += stepMs) await this.advance(stepMs)
      await turn()
      if (!settled) throw new Error(`still pending after ${maxMs} ms of virtual time`)
      if (failed) throw error
      return value
    },
  }
}

// ---- a fake DOM: just what these scripts touch ------------------------------------------------------------------------------------------
class ClassList {
  constructor(node) { this.node = node; this.values = new Set() }
  add(...names) { names.forEach(name => name && this.values.add(name)) }
  remove(...names) { names.forEach(name => this.values.delete(name)) }
  contains(name) { return this.values.has(name) }
  toggle(name, force) { const on = force === undefined ? !this.values.has(name) : Boolean(force); if (on) this.values.add(name); else this.values.delete(name); return on }
  [Symbol.iterator]() { return this.values[Symbol.iterator]() }
  get length() { return this.values.size }
  toString() { return [...this.values].join(' ') }
}
const camel = name => name.replace(/-([a-z])/g, (_m, letter) => letter.toUpperCase())

/** An element's inline style: camelCase properties, plus the three methods the scripts call (non-enumerable, so a style lists only what was set). */
function styleObject() {
  const style = {}
  const define = (name, fn) => Object.defineProperty(style, name, { value: fn, enumerable: false })
  define('getPropertyValue', name => { const value = style[camel(String(name))]; return value === undefined ? '' : String(value) })
  define('getPropertyPriority', () => '')
  define('setProperty', (name, value) => { style[camel(String(name))] = String(value) })
  define('removeProperty', name => { const key = camel(String(name)); const old = style[key]; delete style[key]; return old === undefined ? '' : String(old) })
  return style
}

class FakeNode {
  constructor(tagName = 'div', doc = null) {
    this.tagName = String(tagName).toUpperCase(); this.doc = doc
    this.attributes = new Map(); this.children = []; this.parentNode = null
    this.classList = new ClassList(this); this.style = styleObject(); this.innerHTML = ''; this.textContent = ''
    this._id = ''; this.nodeType = 1; this.isContentEditable = false; this.listeners = new Map()
    this.dataset = new Proxy({}, {
      set: (target, key, value) => { target[key] = String(value); this.attributes.set(`data-${String(key).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, String(value)); return true },
      deleteProperty: (target, key) => { delete target[key]; this.attributes.delete(`data-${String(key).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`); return true },
    })
  }
  get id() { return this._id }
  set id(value) { this._id = String(value) }
  get className() { return String(this.classList) }
  set className(value) { this.classList = new ClassList(this); this.classList.add(...String(value).split(/\s+/).filter(Boolean)) }
  get firstChild() { return this.children[0] || null }
  get parentElement() { return this.parentNode }
  get ownerDocument() { return this.doc }
  appendChild(child) { child.parentNode?.removeChild?.(child); child.parentNode = this; this.children.push(child); return child }
  insertBefore(child, ref) { child.parentNode?.removeChild?.(child); child.parentNode = this; const at = ref ? this.children.indexOf(ref) : -1; if (at < 0) this.children.push(child); else this.children.splice(at, 0, child); return child }
  removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; return child }
  remove() { this.parentNode?.removeChild(this) }
  setAttribute(name, value) {
    this.attributes.set(name, String(value))
    if (name === 'id') this._id = String(value)
    if (name === 'class') this.className = value
    if (name.startsWith('data-')) this.dataset[camel(name.slice(5))] = String(value)
  }
  getAttribute(name) { return name === 'id' ? (this._id || null) : this.attributes.has(name) ? this.attributes.get(name) : null }
  hasAttribute(name) { return this.attributes.has(name) || (name === 'id' && Boolean(this._id)) }
  removeAttribute(name) { this.attributes.delete(name); if (name.startsWith('data-')) delete this.dataset[camel(name.slice(5))] }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener) }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener) }
  dispatchEvent() { return true }
  focus() {}
  blur() {}
  click() {}
  contains(node) { for (let at = node; at; at = at.parentNode) if (at === this) return true; return false }
  cloneNode(deep) {
    const copy = new FakeNode(this.tagName, this.doc)
    copy.innerHTML = this.innerHTML; copy.textContent = this.textContent; copy.className = this.className
    if (deep) this.children.forEach(child => copy.appendChild(child.cloneNode(true)))
    return copy
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 } }
  closest(selector) { for (let at = this; at; at = at.parentNode) if (at.matches?.(selector)) return at; return null }
  matches(selector) { return String(selector).split(',').some(part => matchCompound(this, part.trim().split(/[\s>+~]+/).filter(Boolean).pop() || '')) }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
  querySelectorAll(selector) {
    const parts = String(selector).split(',').map(part => part.trim().split(/[\s>+~]+/).filter(Boolean).pop() || '')
    const found = []
    const visit = node => { for (const child of node.children) { if (parts.some(part => matchCompound(child, part))) found.push(child); visit(child) } }
    visit(this)
    return found
  }
  getElementsByClassName(name) { return this.querySelectorAll(`.${name}`) }
  getElementsByTagName(name) { return this.querySelectorAll(name) }
}

/** One compound selector: tag, #id, .class, [attr], [attr="value"], in any order and number. Combinators are not interpreted (the last compound decides). */
function matchCompound(node, compound) {
  if (!compound) return false
  const re = /([#.]?)([A-Za-z0-9_*:-]+)|\[([^\]=\s]+)(?:=["']?([^"'\]]*)["']?)?\]/g
  let match, any = false
  while ((match = re.exec(compound))) {
    any = true
    if (match[3] !== undefined) {
      if (!node.hasAttribute(match[3])) return false
      if (match[4] !== undefined && node.getAttribute(match[3]) !== match[4]) return false
    } else if (match[1] === '#') { if (node.id !== match[2]) return false }
    else if (match[1] === '.') { if (!node.classList.contains(match[2])) return false }
    else if (match[2] !== '*' && node.tagName !== match[2].toUpperCase()) return false
  }
  return any
}

function computedStyleOf(node) {
  const base = { zIndex: '100', justifyContent: 'flex-start', fontFamily: 'Inter', fontSize: '24px', fontWeight: '400', fontStyle: 'normal', textDecoration: 'none',
    textTransform: 'none', color: 'rgb(0, 0, 0)', backgroundColor: 'transparent', textAlign: 'left', lineHeight: '1.5', letterSpacing: 'normal', borderWidth: '0px',
    borderColor: 'transparent', borderStyle: 'solid', paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px', opacity: '1' }
  const out = { ...base }
  for (const [key, value] of Object.entries(node?.style || {})) if (typeof value === 'string' && value !== '') out[key] = value
  return out
}

/**
 * One viewer: the page's bridge plus Layout's scripts in a vm. `parent` is what the viewer sees as window.parent (Studio's window): it receives the replies
 * and every unsolicited frame. Messages from Studio arrive through `deliver(data, origin)`.
 */
export function createLayoutViewer({ layoutDir, studioOrigin, parent, clock, viewOnly = false, fetchImpl = null, presentationId = 'pres-chat-edit' }) {
  const html = fs.readFileSync(path.join(layoutDir, 'viewer/presentation-viewer.html'), 'utf8')
  const bridge = bridgeFromViewerHtml(html, studioOrigin, viewOnly)
  const log = { requests: [], frames: [] }
  let lastRequest = -1
  const listeners = []

  const doc = { nodes: new Set() }
  const body = new FakeNode('body', doc)
  body.setAttribute('data-mode', 'view')
  const revealRoot = new FakeNode('div', doc); revealRoot.className = 'reveal'
  const slidesRoot = new FakeNode('div', doc); slidesRoot.className = 'slides'
  body.appendChild(revealRoot); revealRoot.appendChild(slidesRoot)
  // The page chrome the edit-mode and autosave scripts write to (the ids viewer/presentation-viewer.html has).
  for (const [tag, id] of [['button', 'toggle-edit-mode'], ['div', 'edit-controls'], ['div', 'auto-save-indicator']]) { const chrome = new FakeNode(tag, doc); chrome.id = id; body.appendChild(chrome) }
  const walk = (node, fn) => { fn(node); node.children.forEach(child => walk(child, fn)) }
  const documentListeners = new Map()
  const document = {
    body, head: new FakeNode('head', doc), documentElement: new FakeNode('html', doc), visibilityState: 'visible', fullscreenElement: null, activeElement: null,
    createElement: tag => new FakeNode(tag, doc),
    createTextNode: text => { const node = new FakeNode('#text', doc); node.textContent = String(text); return node },
    createRange: () => ({ selectNodeContents() {}, collapse() {}, setStart() {}, setEnd() {} }),
    getElementById(id) { let found = null; walk(body, node => { if (!found && node.id === id) found = node }); return found },
    querySelector(selector) { return body.querySelector(selector) },
    querySelectorAll(selector) { return body.querySelectorAll(selector) },
    addEventListener(type, listener) { if (!documentListeners.has(type)) documentListeners.set(type, []); documentListeners.get(type).push(listener) },
    removeEventListener() {},
    execCommand() { return true },
    queryCommandState() { return false },
    queryCommandValue() { return '' },
    hasFocus: () => true,
    getSelection: () => null,
  }
  const post = (payload, targetOrigin) => {
    // `lastSaveTime` is Date.now() in auto-save.js: the virtual time instead, so that a run is the same bytes every time.
    const data = JSON.parse(JSON.stringify(payload))
    if (typeof data.lastSaveTime === 'number') data.lastSaveTime = clock.now()
    log.frames.push({ at: clock.now(), afterRequest: lastRequest, data })
    parent.postMessage(JSON.parse(JSON.stringify(data)), targetOrigin)
  }
  const context = {
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    document, CSS: { escape: value => value }, Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }, URL, URLSearchParams, JSON, Math, Date, Object, Array, Map, Set, Promise, Error, TypeError,
    Number, String, Boolean, RegExp, Symbol, parseInt, parseFloat, isNaN, Reflect, Proxy, WeakMap, WeakSet, Intl, encodeURIComponent, decodeURIComponent,
    structuredClone: value => JSON.parse(JSON.stringify(value)),
    setTimeout: (fn, ms) => clock.setTimeout(fn, ms), clearTimeout: id => clock.clearTimeout(id), setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: fn => clock.setTimeout(() => fn(clock.now()), 16), cancelAnimationFrame: id => clock.clearTimeout(id),
    queueMicrotask, MutationObserver: class { observe() {} disconnect() {} }, ResizeObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail } }, Event: class { constructor(type) { this.type = type } },
    getComputedStyle: computedStyleOf, getSelection: () => null,
    fetch: async (url, init) => { if (!fetchImpl) throw new Error('the Layout viewer harness refuses network'); return fetchImpl(url, init) },
    crypto: { randomUUID: () => 'abcdef12-0000-4000-8000-000000000000' },
    location: { pathname: `/p/${presentationId}`, origin: 'https://layout.example', href: `https://layout.example/p/${presentationId}` },
    navigator: { userAgent: 'node', clipboard: null }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener(type, listener) { if (type === 'message') listeners.push(listener) },
    removeEventListener() {},
    parent: { postMessage: post },
    postMessage: post,
    innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1,
    currentPresentationData: { slides: [] },
  }
  context.window = context
  context.self = context
  context.globalThis = context
  vm.createContext(context)
  context.window.parent = { postMessage: post }
  const sources = {}
  for (const file of LAYOUT_SCRIPTS) {
    const text = fs.readFileSync(path.join(layoutDir, file), 'utf8')
    sources[file] = sha(text)
    vm.runInContext(text, context, { filename: file })
  }
  vm.runInContext(bridge.text, context, { filename: 'viewer-bridge.js' })
  if (listeners.length !== 1) throw new Error(`the viewer bridge registered ${listeners.length} message listeners`)
  for (const listener of documentListeners.get('DOMContentLoaded') || []) listener()
  const manager = context.ElementManager
  if (!manager) throw new Error('element-manager.js did not define window.ElementManager')

  const slides = []
  function slide(index) {
    while (slides.length <= index) {
      const section = new FakeNode('section', doc)
      section.setAttribute('data-slide-id', `L${slides.length}`)
      slidesRoot.appendChild(section); slides.push(section)
    }
    return slides[index]
  }
  /** What renderPresentation / insertTextBox would register for an element: its node under its slide, and its ElementManager registry entry. */
  function registerElement(id, { type = 'textbox', componentType = 'TEXT_BOX', slideIndex = 0, gridRow = '4/10', gridColumn = '2/16', fontSize = '24px', locked = false, text = 'Hello' } = {}) {
    const GC = context.GridConverter
    const node = new FakeNode('div', doc)
    node.id = id
    node.className = `dynamic-element inserted-${type}`
    node.setAttribute('data-component-type', componentType)
    node.setAttribute('data-slide-index', String(slideIndex))
    node.style.gridRow = GC.toPhysical(gridRow); node.style.gridColumn = GC.toPhysical(gridColumn); node.style.zIndex = '100'
    const content = new FakeNode('div', doc)
    content.className = type === 'textbox' ? 'textbox-content' : 'element-content'
    content.innerHTML = `<p>${text}</p>`; content.textContent = text
    if (type === 'textbox') content.style.fontSize = fontSize
    node.appendChild(content)
    slide(slideIndex).appendChild(node)
    manager._registry.set(id, { id, type, componentType, slideIndex, zIndex: 100, position: { gridRow, gridColumn }, data: { content: text, locked } })
    return node
  }
  slide(2) // the deck has three slides (L0, L1, L2); registerElement puts an element under its slide

  return {
    bridge, sources, registerElement, slide, log, context,
    document, manager, body,
    registryHas: id => manager._registry.has(id),
    nodeById: id => document.getElementById(id),
    editMode: () => body.getAttribute('data-mode'),
    /** Edit mode as the viewer's own enterEditMode makes it (edit-mode.js: its flag, the body attribute, the autosave init); a harness step, not a request. */
    enterEditMode: () => { vm.runInContext('enterEditMode()', context) },
    /** A message from the parent window, as a browser would dispatch it to the viewer. */
    async deliver(data, origin) {
      lastRequest = log.requests.length
      log.requests.push({ at: clock.now(), action: data?.action, params: JSON.parse(JSON.stringify(data?.params ?? null)), requestId: data?.requestId ?? null })
      await listeners[0]({ source: context.window.parent, origin, data })
    },
  }
}

/** The pieces of the viewer page this harness runs, cut out by exact anchors (a viewer edit that moves them fails loudly here). */
export function bridgeFromViewerHtml(html, studioOrigin, viewOnly = false) {
  const once = (text, label) => { if (html.split(text).length !== 2) throw new Error(`viewer html: expected exactly one ${label}`); return text }
  const origins = html.match(/\n    const ALLOWED_PARENT_ORIGINS = Object\.freeze\([^\n]*\);\n/)
  if (!origins) throw new Error('viewer html: ALLOWED_PARENT_ORIGINS not found')
  const allowStart = html.indexOf(once('\n    function isAllowedParentOrigin(origin) {\n', 'isAllowedParentOrigin'))
  const allowEnd = html.indexOf('\n    }\n', allowStart) + '\n    }\n'.length
  const viewOnlyMatch = html.match(/\n    const VIEW_ONLY = (true|false);\n    window\.VIEW_ONLY = VIEW_ONLY;\n/)
  if (!viewOnlyMatch) throw new Error('viewer html: VIEW_ONLY not found')
  const bridgeStart = html.indexOf(once('\n    const idempotentElementMutationActions = new Set([\n', 'bridge start'))
  const bridgeEnd = html.indexOf(once("\n    console.log('✅ postMessage bridge initialized - ready for cross-origin commands');\n", 'bridge end'))
  if (!(bridgeStart < bridgeEnd)) throw new Error('viewer html: bridge anchors out of order')
  const origin = origins[0].replace('Object.freeze([])', `Object.freeze([${JSON.stringify(studioOrigin)}])`)
  const flags = viewOnlyMatch[0].replace(/(true|false);/, `${viewOnly};`)
  const commands = [...html.slice(bridgeStart, bridgeEnd).matchAll(/^          case '([A-Za-z]+)':/gm)].map(match => match[1])
  return {
    text: origin + html.slice(allowStart, allowEnd) + flags + html.slice(bridgeStart, bridgeEnd) + '\n',
    commands: new Set(commands),
    sha256: sha(html),
  }
}

/**
 * A viewer that answers from a recorded transcript (offline). Same surface as createLayoutViewer's deliver(); frames go to `parent` at their recorded times.
 * A request that is not the recorded one is answered with an error reply and noted in log.divergence, which fails the test driving the clock (clock.setGuard).
 */
export function replayViewer({ transcript, parent, clock }) {
  let next = 0
  const log = { requests: [], frames: [], divergence: null }
  const emitAll = (frames, origin, requestId, base) => {
    for (const frame of frames) {
      const delay = Math.max(0, frame.at - base)
      const payload = JSON.parse(JSON.stringify(frame.data))
      if (payload.requestId !== undefined) payload.requestId = requestId
      const emit = () => { log.frames.push({ at: clock.now(), afterRequest: frame.afterRequest, data: JSON.parse(JSON.stringify(payload)) }); parent.postMessage(payload, origin) }
      if (delay === 0) emit() // synchronously, as the live viewer posts while it handles the request: the same number of microtask hops to Studio
      else clock.setTimeout(emit, delay)
    }
  }
  // Frames the harness itself caused before any request (a scenario that starts in edit mode).
  emitAll(transcript.frames.filter(item => item.afterRequest === -1), '*', undefined, 0)
  return {
    log,
    async deliver(data, origin) {
      const index = next++
      const recorded = transcript.requests[index]
      log.requests.push({ at: clock.now(), action: data?.action, params: JSON.parse(JSON.stringify(data?.params ?? null)), requestId: data?.requestId ?? null })
      if (!recorded || recorded.action !== data?.action || JSON.stringify(recorded.params) !== JSON.stringify(data?.params ?? null)) {
        log.divergence = log.divergence ?? new Error(`replay: request #${index} is ${data?.action} ${JSON.stringify(data?.params)}, ${recorded ? `recorded ${recorded.action} ${JSON.stringify(recorded.params)}` : 'never recorded'}`)
        parent.postMessage({ success: false, action: data?.action, requestId: data?.requestId, error: 'replay divergence' }, origin)
        return
      }
      emitAll(transcript.frames.filter(item => item.afterRequest === index), origin, data.requestId, recorded.at)
    },
  }
}
