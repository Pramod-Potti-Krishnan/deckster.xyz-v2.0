// NEXT_PUBLIC_STUDIO_ARRANGE (FRONTEND-2, B21): the REAL Layout viewer code of layout-builder-v7.5 !260 (LAYOUT_ARRANGE_COMMANDS_ENABLED), run in a node vm, for scripts/test-studio-arrange.mjs. No browser, no iframe,
// no server, no network (this Mac's Chromium refuses a loopback viewer in an iframe), so the viewer's own JS is executed here, from a layout-builder checkout, the way scripts/studio-chat-element-refine-layout.mjs
// does for requestElementRefine.
//
// What runs is Layout's, unchanged:
//  - the page Layout's server.py SERVES (scripts/fixtures/studio-arrange/serve-layout-viewer.py renders /p/<id> in process, flag off and on): its postMessage dispatcher (the bridge, with the case group
//    arrange_commands.py adds while the flag is on), ALLOWED_PARENT_ORIGINS / isAllowedParentOrigin and VIEW_ONLY, cut out of the served text by exact anchors; the flag script the served head carries;
//  - the /src/utils scripts the served page loads that these commands need, in the page's order: grid-converter.js, auto-save.js, element-manager.js and, only when the served page loads it, arrange-commands.js.
// What is not Layout's: a small fake DOM (slides as <section>s, elements with inline grid lines and z-index, document order, computed style), the element registry entries renderPresentation would make in a
// browser, a setTimeout that never fires (so auto-save's debounce never PUTs: hasPendingChanges() is the proof a change was marked for saving), and a fetch that refuses.
// The viewer's window IS the vm's global (as in a browser: window.markContentChanged and a bare markContentChanged are one function).
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'

export const LAYOUT_SCRIPTS = ['src/utils/grid-converter.js', 'src/utils/auto-save.js', 'src/utils/element-manager.js', 'src/utils/arrange-commands.js']
export const LAYOUT_FLAG = 'LAYOUT_ARRANGE_COMMANDS_ENABLED'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

let order = 0
class FakeClassList {
  constructor() { this.values = new Set() }
  add(...values) { values.forEach(value => value && this.values.add(value)) }
  remove(...values) { values.forEach(value => this.values.delete(value)) }
  contains(value) { return this.values.has(value) }
  toggle(value, force) { const on = force === undefined ? !this.values.has(value) : Boolean(force); if (on) this.values.add(value); else this.values.delete(value); return on }
  [Symbol.iterator]() { return this.values[Symbol.iterator]() }
  get length() { return this.values.size }
}
class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase(); this.nodeType = 1; this.id = ''; this.dataset = {}; this.style = {}; this.classList = new FakeClassList()
    this.children = []; this.parentNode = null; this.attributes = new Map(); this.innerHTML = ''; this.textContent = ''; this.order = order++
  }
  set className(value) { this.classList = new FakeClassList(); this.classList.add(...String(value).split(/\s+/).filter(Boolean)) }
  get className() { return Array.from(this.classList).join(' ') }
  get parentElement() { return this.parentNode }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null }
  hasAttribute(name) { return this.attributes.has(name) }
  removeAttribute(name) { this.attributes.delete(name) }
  matches(selector) { return selector === '[data-blank-element]' ? this.attributes.has('data-blank-element') : false }
  /** Only the selector arrange-commands.js asks: the slide <section> the element sits in. */
  closest(selector) {
    if (selector !== '.reveal .slides > section') return null
    for (let node = this; node; node = node.parentNode) if (node.isSlide) return node
    return null
  }
  /** Document order by creation (the slide builds its elements in order). */
  compareDocumentPosition(other) { return other.order > this.order ? 4 : other.order < this.order ? 2 : 0 }
  contains(other) { for (let node = other; node; node = node.parentNode) if (node === this) return true; return false }
  querySelector(selector) {
    if (selector === '.textbox-content') return this.textboxContent || null
    if (selector === '.element-content') return this.elementContent || null
    return null
  }
  querySelectorAll() { return [] }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 37.5, top: 81.25, width: 412.5, height: 232.5, right: 450, bottom: 313.75 } } // viewport pixels of a scaled slide: never slide pixels
}
function computedStyle(element) {
  return {
    zIndex: element?.style?.zIndex || 'auto', justifyContent: 'flex-start', paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
    borderWidth: '0px', borderColor: 'transparent', borderStyle: 'solid', borderTopLeftRadius: '0px', borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px', borderBottomLeftRadius: '0px', fontFamily: 'Inter', fontSize: '24px', fontWeight: '400',
    fontStyle: 'normal', textDecoration: 'none', textTransform: 'none', color: 'rgb(0, 0, 0)', backgroundColor: 'transparent',
    textAlign: 'left', lineHeight: '1.5', getPropertyValue: () => '',
  }
}

/** The pieces of the served page this harness runs, cut out by exact anchors (a viewer edit that moves them fails loudly here). */
export function bridgeFromServedPage(html) {
  const once = (text, label) => { if (html.split(text).length !== 2) throw new Error(`served page: expected exactly one ${label}`); return text }
  const origins = html.match(/\n    const ALLOWED_PARENT_ORIGINS = Object\.freeze\([^\n]*\);\n/)
  if (!origins) throw new Error('served page: ALLOWED_PARENT_ORIGINS not found')
  const allowStart = html.indexOf(once('\n    function isAllowedParentOrigin(origin) {\n', 'isAllowedParentOrigin'))
  const allowEnd = html.indexOf('\n    }\n', allowStart) + '\n    }\n'.length
  const viewOnly = html.match(/\n    const VIEW_ONLY = (true|false);\n    window\.VIEW_ONLY = VIEW_ONLY;\n/)
  if (!viewOnly) throw new Error('served page: VIEW_ONLY not found')
  const bridgeStart = html.indexOf(once('\n    const idempotentElementMutationActions = new Set([\n', 'bridge start'))
  const bridgeEnd = html.indexOf(once("\n    console.log('✅ postMessage bridge initialized - ready for cross-origin commands');\n", 'bridge end'))
  if (!(bridgeStart < bridgeEnd)) throw new Error('served page: bridge anchors out of order')
  const head = html.slice(0, html.indexOf('</head>'))
  const flagScript = `<script>window.${LAYOUT_FLAG}=true;</script>`
  const scripts = [...html.matchAll(/<script src="\/(src\/utils\/[a-z-]+\.js)(?:\?[^"]*)?"><\/script>/g)].map(match => match[1])
  const loaded = new Set(scripts)
  return {
    text: origins[0] + html.slice(allowStart, allowEnd) + viewOnly[0] + html.slice(bridgeStart, bridgeEnd) + '\n',
    flagOn: head.includes(flagScript),
    scripts: LAYOUT_SCRIPTS.filter(file => loaded.has(file)), // the page's order for these four: grid-converter, auto-save, element-manager; arrange-commands.js is in the head, before them, and only defines
    arrangeCases: (html.match(/          case '(?:bringToFront|sendToBack|bringForward|sendBackward|alignElement|resizeElement|positionElement|rotateElement|flipElement|lockElement|setElementClasses)':\n/g) || []).length,
    sha256: sha(html),
  }
}

/**
 * One viewer: the served page's bridge plus Layout's scripts in a vm. `parent` is what the viewer sees as window.parent (Studio's window); messages from it arrive through deliver(data, origin).
 * slides: [{ elements: [{ id, type, componentType, gridRow, gridColumn (physical lines), zIndex?, locked?, classes? }] }]
 */
export function createLayoutViewer({ layoutDir, servedHtml, parent, slides, mode = 'edit' }) {
  const bridge = bridgeFromServedPage(servedHtml)
  const elements = new Map()
  const sections = []
  const listeners = []
  const body = new FakeElement('body')
  body.setAttribute('data-mode', mode)
  const context = {
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    CSS: { escape: value => value },
    Node: { ELEMENT_NODE: 1, DOCUMENT_POSITION_FOLLOWING: 4, DOCUMENT_POSITION_PRECEDING: 2 },
    URL, Date, Math, JSON, Promise, Set, Map, WeakMap, Array, Object, Number, String, Boolean, Error, RegExp, Symbol, parseInt, parseFloat, isNaN, isFinite,
    document: {
      body, documentElement: new FakeElement('html'), readyState: 'complete',
      addEventListener() {}, removeEventListener() {},
      createElement(tagName) { return new FakeElement(tagName) },
      getElementById(id) { return elements.get(id) || null },
      querySelector() { return null },
      querySelectorAll(selector) { return selector === '.reveal .slides > section' ? sections.slice() : [] }, // the slides, as getSlideElement asks
    },
    addEventListener(type, listener) { if (type === 'message') listeners.push(listener) },
    removeEventListener() {},
    getComputedStyle: computedStyle,
    setTimeout() { return 1 }, clearTimeout() {}, setInterval() { return 1 }, clearInterval() {},
    requestAnimationFrame() { return 1 },
    fetch: async () => { throw new Error('the Layout viewer harness refuses network') },
    location: { href: 'https://layout.synthetic.test/p/pres-e2e', pathname: '/p/pres-e2e', search: '', origin: 'https://layout.synthetic.test' },
    navigator: { userAgent: 'node' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  }
  context.window = context
  context.self = context
  context.parent = parent
  vm.createContext(context)
  const sources = {}
  if (bridge.flagOn) vm.runInContext(`window.${LAYOUT_FLAG}=true;`, context)
  // The served head loads arrange-commands.js before the body's utils; it only defines window.LayoutArrangeCommands, so its place does not matter. The rest run in the page's order.
  const files = bridge.scripts.includes('src/utils/arrange-commands.js') ? ['src/utils/arrange-commands.js', ...bridge.scripts.filter(file => file !== 'src/utils/arrange-commands.js')] : bridge.scripts
  for (const file of files) {
    const text = fs.readFileSync(path.join(layoutDir, file), 'utf8')
    sources[file] = sha(text)
    vm.runInContext(text, context, { filename: file })
  }
  vm.runInContext(bridge.text, context, { filename: 'served-page-bridge.js' })
  if (listeners.length !== 1) throw new Error(`the served bridge registered ${listeners.length} message listeners`)
  const manager = context.ElementManager
  if (!manager) throw new Error('element-manager.js did not define window.ElementManager')

  const reveal = new FakeElement('div'); reveal.className = 'reveal'
  const slideBox = reveal.appendChild(new FakeElement('div')); slideBox.className = 'slides'
  ;(slides || []).forEach((slide, slideIndex) => {
    const section = slideBox.appendChild(new FakeElement('section'))
    section.isSlide = true
    sections.push(section)
    for (const spec of slide.elements) {
      const element = section.appendChild(new FakeElement())
      element.id = spec.id
      element.className = `dynamic-element inserted-${spec.type} draggable resizable ${spec.classes || ''}`
      if (spec.locked) element.classList.add(spec.type === 'textbox' ? 'textbox-locked' : 'element-locked')
      element.dataset.componentType = spec.componentType
      element.dataset.slideIndex = String(slideIndex)
      element.style.gridRow = spec.gridRow
      element.style.gridColumn = spec.gridColumn
      if (spec.zIndex !== undefined) element.style.zIndex = String(spec.zIndex)
      const content = new FakeElement()
      content.className = spec.type === 'textbox' ? 'textbox-content' : 'element-content'
      if (spec.type === 'textbox') element.textboxContent = content
      else element.elementContent = content
      element.appendChild(content)
      elements.set(spec.id, element)
      manager._registry.set(spec.id, { id: spec.id, type: spec.type, componentType: spec.componentType, slideIndex, zIndex: spec.zIndex, data: { locked: Boolean(spec.locked) } })
    }
  })

  /** Every element's observable state: grid lines, z-index, lock classes; the registry's zIndex and data.locked. */
  const state = () => Object.fromEntries([...elements.entries()].map(([id, element]) => {
    const data = manager._registry.get(id)
    return [id, { gridRow: element.style.gridRow, gridColumn: element.style.gridColumn, zIndex: element.style.zIndex ?? null,
      locked: element.classList.contains('textbox-locked') || element.classList.contains('element-locked'), registryZ: data?.zIndex ?? null, registryLocked: data?.data?.locked ?? null }]
  }))
  return {
    bridge, sources, state, manager,
    pending: () => typeof context.hasPendingChanges === 'function' ? context.hasPendingChanges() : null,
    setMode(value) { body.setAttribute('data-mode', value) },
    /** A message from the parent window, as a browser would dispatch it to the viewer. */
    deliver(data, origin) { return listeners[0]({ source: parent, origin, data }) },
    /** Layout's own selection: ElementManager.selectElement (emitSelectionEvent posts textBoxSelected / elementSelected to the parent). */
    select(id) { return manager.selectElement(id) },
    /** The slide-pixel geometry arrange-commands.js reports for an element (what elementSelected's properties carry while the flag is on). */
    slideGeometry(id) { return context.LayoutArrangeCommands?.slideGeometry ? JSON.parse(JSON.stringify(context.LayoutArrangeCommands.slideGeometry(elements.get(id)))) : null },
    gridConverter: () => context.GridConverter,
  }
}
