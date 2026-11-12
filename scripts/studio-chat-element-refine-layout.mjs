// NEXT_PUBLIC_CHAT_ELEMENT_REFINE (FRONTEND-2 Pass 3): the REAL Layout viewer code of layout-builder-v7.5 !245 (head 8b19344c,
// LAYOUT_REQUEST_ELEMENT_REFINE_ENABLED), run in a node vm, for scripts/test-studio-chat-element-refine.mjs. No browser, no iframe,
// no server, no network: this Mac's Chromium refuses a loopback viewer in an iframe (local-network block), so the viewer's own JS is
// executed here instead, from a layout-builder checkout.
//
// What runs is Layout's, unchanged:
//  - the page Layout's server.py SERVES (scripts/fixtures/chat-element-refine/serve-layout-viewer.py renders /p/<id> in process, flag
//    off and on): its postMessage dispatcher (the `window.addEventListener('message', ...)` bridge with the case server.py adds while
//    the flag is on), its ALLOWED_PARENT_ORIGINS / isAllowedParentOrigin and VIEW_ONLY, cut out of the served text;
//  - the /src/utils scripts the served page loads that the command needs, in the page's order: grid-converter.js, auto-save.js,
//    element-manager.js and, only when the served page has it, request-element-refine.js.
// What is not Layout's: a small fake DOM (the one layout-builder's own tests/test_request_element_refine.js uses) and the element
// registry entries, which renderPresentation would make in a browser.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'

export const LAYOUT_SCRIPTS = ['src/utils/grid-converter.js', 'src/utils/auto-save.js', 'src/utils/element-manager.js', 'src/utils/request-element-refine.js']
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

class FakeClassList {
  constructor(...values) { this.values = new Set(values) }
  add(...values) { values.forEach(value => this.values.add(value)) }
  remove(...values) { values.forEach(value => this.values.delete(value)) }
  contains(value) { return this.values.has(value) }
  [Symbol.iterator]() { return this.values[Symbol.iterator]() }
}
class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase(); this.id = ''; this.dataset = {}; this.style = {}; this.classList = new FakeClassList()
    this.children = []; this.parentNode = null; this.attributes = new Map(); this.innerHTML = ''; this.textContent = ''
  }
  set className(value) { this.classList = new FakeClassList(...String(value).split(/\s+/).filter(Boolean)) }
  get className() { return Array.from(this.classList).join(' ') }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child }
  setAttribute(name, value) {
    this.attributes.set(name, String(value))
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_m, letter) => letter.toUpperCase())] = String(value)
  }
  getAttribute(name) { return this.attributes.get(name) || null }
  matches(selector) { return selector === '[data-blank-element]' && this.attributes.has('data-blank-element') }
  querySelector(selector) {
    if (selector === '.textbox-content') return this.textboxContent || null
    if (selector === '.element-content') return this.elementContent || null
    return null
  }
  querySelectorAll() { return [] }
  getBoundingClientRect() { return { left: 10, top: 20, width: 320, height: 180 } }
}
function computedStyle() {
  return {
    zIndex: '100', justifyContent: 'flex-start', paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
    borderWidth: '0px', borderColor: 'transparent', borderStyle: 'solid', borderTopLeftRadius: '0px', borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px', borderBottomLeftRadius: '0px', fontFamily: 'Inter', fontSize: '24px', fontWeight: '400',
    fontStyle: 'normal', textDecoration: 'none', textTransform: 'none', color: 'rgb(0, 0, 0)', backgroundColor: 'transparent',
    textAlign: 'left', lineHeight: '1.5',
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
  const flagScript = '<script>window.LAYOUT_REQUEST_ELEMENT_REFINE_ENABLED=true;</script>'
  const scripts = [...html.matchAll(/<script src="\/(src\/utils\/[a-z-]+\.js)(?:\?[^"]*)?"><\/script>/g)].map(match => match[1])
    .filter(file => LAYOUT_SCRIPTS.includes(file))
  return {
    text: origins[0] + html.slice(allowStart, allowEnd) + viewOnly[0] + html.slice(bridgeStart, bridgeEnd) + '\n',
    flagOn: head.includes(flagScript),
    scripts: [...new Set(scripts)],
    hasRefineCase: html.includes("          case 'requestElementRefine':\n"),
    sha256: sha(html),
  }
}

/**
 * One viewer: the served page's bridge plus Layout's scripts in a vm. `parent` is what the viewer sees as window.parent (Studio's
 * window); messages from it arrive through `deliver(data, origin)`. Returns the registry helpers and an observation snapshot.
 */
export function createLayoutViewer({ layoutDir, servedHtml, parent }) {
  const bridge = bridgeFromServedPage(servedHtml)
  const elements = new Map()
  const listeners = []
  let createdNodes = 0, autoSaveCount = 0
  const context = {
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    CSS: { escape: value => value },
    Node: { ELEMENT_NODE: 1 },
    URL,
    document: {
      body: { dataset: {}, getAttribute() { return null }, classList: new FakeClassList(), appendChild() { createdNodes += 1 } },
      addEventListener() {},
      createElement(tagName) { createdNodes += 1; return new FakeElement(tagName) },
      getElementById(id) { return elements.get(id) || null },
      querySelectorAll() { return [] },
    },
    window: { addEventListener(type, listener) { if (type === 'message') listeners.push(listener) }, getComputedStyle: computedStyle },
    getComputedStyle: computedStyle,
    markContentChanged() { autoSaveCount += 1 },
    setTimeout() { return 1 },
    clearTimeout() {},
    fetch: async () => { throw new Error('the Layout viewer harness refuses network') },
  }
  context.window.window = context.window
  context.window.parent = parent
  vm.createContext(context)
  const sources = {}
  if (bridge.flagOn) vm.runInContext('window.LAYOUT_REQUEST_ELEMENT_REFINE_ENABLED=true;', context)
  for (const file of bridge.scripts) {
    const text = fs.readFileSync(path.join(layoutDir, file), 'utf8')
    sources[file] = sha(text)
    vm.runInContext(text, context, { filename: file })
  }
  vm.runInContext(bridge.text, context, { filename: 'served-page-bridge.js' })
  if (listeners.length !== 1) throw new Error(`the served bridge registered ${listeners.length} message listeners`)
  const manager = context.window.ElementManager
  if (!manager) throw new Error('element-manager.js did not define window.ElementManager')

  function registerElement(id, rendererType, componentType, html, extra = {}) {
    const element = new FakeElement()
    element.id = id
    element.className = `dynamic-element inserted-${rendererType}`
    element.dataset.componentType = componentType
    element.dataset.slideIndex = String(extra.slideIndex || 0)
    element.style.gridRow = extra.gridRow || '4/10'
    element.style.gridColumn = extra.gridColumn || '3/12'
    element.style.zIndex = '100'
    const content = new FakeElement()
    content.className = rendererType === 'textbox' ? 'textbox-content' : 'element-content'
    content.innerHTML = html
    content.textContent = html.replace(/<[^>]+>/g, '')
    if (rendererType === 'textbox') element.textboxContent = content
    else element.elementContent = content
    element.appendChild(content)
    elements.set(id, element)
    manager._registry.set(id, { id, type: rendererType, componentType, slideIndex: extra.slideIndex || 0, zIndex: 100, data: { content: html }, ...(extra.data || {}) })
  }
  function removeElement(id) { elements.delete(id); manager._registry.delete(id) }
  const snapshot = () => JSON.stringify({ selected: manager.getSelectedElement?.() ?? null, registry: Array.from(manager._registry.entries()), nodes: createdNodes, autosave: autoSaveCount })
  return {
    bridge, sources, registerElement, removeElement, snapshot,
    /** A message from the parent window, as a browser would dispatch it to the viewer. */
    deliver(data, origin) { return listeners[0]({ source: parent, origin, data }) },
    get parentDescriptorIsData() { const d = Object.getOwnPropertyDescriptor(context.window, 'parent'); return Boolean(d && 'value' in d && d.value === parent) },
  }
}

/** The deck the test uses: the recorded Director directive names el_chart_7f3a on slide index 2 (slide_id L2). */
export function registerSyntheticDeck(viewer) {
  viewer.registerElement('el_title_0', 'textbox', 'TEXT_BOX', '<p>Overview</p>')
  viewer.registerElement('el_chart_7f3a', 'chart', 'CHART', '<canvas></canvas>', {
    slideIndex: 2, gridRow: '5/18', gridColumn: '2/16',
    data: { generation_config: { prompt: 'Revenue by region', chart_type: 'line' }, themeVariantId: 'solid', themeBindings: { fill: 'primary' }, slotName: 'main' },
  })
}
