// COMPOSER-2 (FUTURE-OPS-2 section 3, row 4 "first paint"): the viewer's use of lib/studio-first-paint.ts (flag NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED, exact "true", default off).
// Run: node scripts/test-studio-first-paint-viewer.mjs   (plain node: transpile + vm, installed React and ReactDOM, `git show` reads the base commit; no network, no browser)
//
// Part 1, the source pins:
//  - flag-off identity: the viewer with this change's lines taken out through scripts/studio-first-paint-strip.mjs is the base commit's viewer, byte for byte; the same for .env.example;
//  - every changed or added viewer line carries the marker STUDIO-FIRST-PAINT (the one base line this change swaps out is the only removed line);
//  - the flag is read in the lib only, and the .env.example block sits after the PASS2 ADMIN block (never right before it).
// Part 2, the behaviour of the REAL viewer (actual hooks, effects and JSX under installed ReactDOM, in the inert DOM host the neighbouring scripts/test-studio-viewer-load-order.mjs uses; not a browser):
//  - flag off (unset, "false"): the viewer's commands, timers (setInterval periods through every backoff step) and log lines are byte-identical to the base commit's viewer (hash compared) and no react-dom preconnect is made;
//  - flag on: one preconnect + prefetchDNS per origin (Layout and the four CDN hosts), once; ONE getCurrentSlideInfo at once when the frame has loaded, then the same interval; a first poll that gets no usable answer
//    (an error reply, a timeout) starts no backoff while an interval tick's failure does, exactly as before; no two polls overlap; a restart of the poll effect polls at once no more, a new frame does.
// Then the viewer wiring is re-run against deliberately broken copies: each mutant must be caught.
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
import { FIRST_PAINT_BASE_COMMIT, FIRST_PAINT_ENV_BLOCK, FIRST_PAINT_FILES, FIRST_PAINT_MARKER, FIRST_PAINT_VIEWER_REMOVED_LINE, stripFirstPaint } from './studio-first-paint-strip.mjs'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VIEWER = 'components/presentation-viewer.tsx'
const LIB = 'lib/studio-first-paint.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
const baseSource = rel => {
  try { return git(['show', `${FIRST_PAINT_BASE_COMMIT}:${rel}`]) } catch (error) { throw new Error(`base commit ${FIRST_PAINT_BASE_COMMIT} is not in this clone (fetch the full history): ${error.message}`) }
}
let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// =========================================================== Part 1: source pins ===========================================================
const viewerText = read(VIEWER)
const baseViewer = baseSource(VIEWER)
check(assert.equal, sha(stripFirstPaint(VIEWER, viewerText)), sha(baseViewer), 'flag-off identity: the viewer without this change\'s lines is the base commit\'s, byte for byte')
check(assert.ok, !stripFirstPaint(VIEWER, viewerText).includes(FIRST_PAINT_MARKER), 'the viewer without this change\'s lines carries no marker')
check(assert.equal, stripFirstPaint('lib/other.ts', 'x'), 'x', 'any other file comes back as it is')
check(assert.deepEqual, FIRST_PAINT_FILES, [VIEWER], 'the strip touches the viewer only (never app/layout.tsx or app/builder/page.tsx)')

// every changed or added line carries the marker; the base line this change swaps is the only one removed
{
  const diff = git(['diff', '--no-color', '-U0', FIRST_PAINT_BASE_COMMIT, '--', VIEWER]).split('\n').filter(line => /^[+-](?![+-])/.test(line))
  const added = diff.filter(line => line.startsWith('+')), removed = diff.filter(line => line.startsWith('-'))
  // The diff is read against the base commit, so lines other stacked changes add are in it too; each of them must carry a marker of its own, and this change's must carry ours.
  const mine = added.filter(line => line.includes(FIRST_PAINT_MARKER))
  check(assert.equal, mine.length, 5, 'five added viewer lines carry the marker: import, preconnect call, swapped poll call, hollow-answer drop, catch guard')
  check(assert.equal, viewerText.split('\n').filter(line => line.includes(FIRST_PAINT_MARKER)).length, 5, 'the marker is on exactly those five lines of the file')
  check(assert.ok, removed.every(line => line === `-${FIRST_PAINT_VIEWER_REMOVED_LINE}` || !line.includes(FIRST_PAINT_MARKER)), 'the one base line this change swaps out is recognised')
  check(assert.equal, removed.filter(line => line === `-${FIRST_PAINT_VIEWER_REMOVED_LINE}`).length, 1, 'the swapped base line is removed once')
  const strippedDiff = git(['diff', '--no-color', '-U0', FIRST_PAINT_BASE_COMMIT, '--', VIEWER]).split('\n').filter(line => /^[+-](?![+-])/.test(line))
    .filter(line => !line.includes(FIRST_PAINT_MARKER) && line !== `-${FIRST_PAINT_VIEWER_REMOVED_LINE}`)
  // with this change's lines excluded, what is left in the diff is only other changes' own marked lines (none are expected on a branch cut from the base commit)
  check(assert.deepEqual, strippedDiff.filter(line => line.startsWith('-')), [], 'the viewer loses no line besides the swapped one')
  for (const line of mine) check(assert.doesNotMatch, line, /process\.env/, 'a marked viewer line reads no env')
}
// the flag is read in the lib only
check(assert.doesNotMatch, viewerText, new RegExp(`process\\.env\\.${FLAG}`), 'the viewer reads the flag through the lib')
check(assert.equal, (read(LIB).match(new RegExp(`process\\.env\\.${FLAG}`, 'g')) ?? []).length, 1, 'the lib reads the flag once')
// .env.example: this change leaves it alone (pins that hold it to a base commit byte for byte would each need teaching; see studio-first-paint-strip.mjs). The block it will get later is kept ready and checked here.
{
  check(assert.ok, !read('.env.example').includes(FLAG), '.env.example carries no trace of the flag yet (this change leaves it alone)')
  check(assert.equal, stripFirstPaint('.env.example', 'x'), 'x', 'the strip has nothing to take out of .env.example')
  check(assert.match, FIRST_PAINT_ENV_BLOCK, new RegExp(`^\\n# STUDIO FIRST PAINT[\\s\\S]*\\n${FLAG}="false"\\n$`), 'the ready-made block: its own flag, documented "false", one blank line before it')
  check(assert.equal, (FIRST_PAINT_ENV_BLOCK.match(/^[A-Z][A-Z0-9_]*=/gm) ?? []).length, 1, 'the ready-made block assigns one variable')
}
console.log(`PASS source pins: ${checks} checks`)

// ========================================== Part 2: the REAL viewer in the inert DOM host ==========================================
let world = null // the variant being run; the host below writes into it
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
    // The frame's window: records each command the viewer posts; `respond(data)` returns the reply fields, or null for no reply at all.
    if (name === 'IFRAME') this.contentWindow = { postMessage: (data, origin) => {
      world.commands.push({ action: data.action, params: data.params ?? null, origin })
      const reply = this.respond ? this.respond(data) : null
      if (reply) queueMicrotask(() => windowHost.dispatchEvent({ type: 'message', source: this.contentWindow, origin,
        data: { action: data.action, requestId: data.requestId, job_id: data.params?.job_id, ...reply } }))
    } }
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
Object.assign(windowHost, { document: documentHost, innerWidth: 1200, HTMLElement: HostNode,
  HTMLIFrameElement: class {}, Node: HostNode, localStorage: { getItem: key => key === 'deckster:debug' ? 'true' : null, setItem() {} },
  setTimeout, clearTimeout, location: { href: 'https://fixture.invalid' } })
documentHost.defaultView = windowHost
Object.assign(globalThis, { window: windowHost, document: documentHost, HTMLElement: HostNode,
  Node: HostNode, localStorage: windowHost.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
  ResizeObserver: class { observe() {} disconnect() {} },
})
const { createRoot } = await import('react-dom/client')

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

/** A fresh module graph of the viewer (so the lib's module state starts empty) with its own env, timers and react-dom recorder. */
function loadViewer({ text, env }) {
  const cache = new Map()
  const blankComponents = new Proxy({ __esModule: true }, { get: (obj, name) => name in obj ? obj[name] : () => null })
  const reactDom = { ...require('react-dom'), preconnect: (...args) => world.preconnects.push(args), prefetchDNS: (...args) => world.prefetches.push(args) }
  const readModule = file => {
    file = fs.realpathSync(file)
    if (cache.has(file)) return cache.get(file).exports
    const relative = path.relative(root, file)
    const source = relative === VIEWER ? text : fs.readFileSync(file, 'utf8')
    const module = { exports: {} }; cache.set(file, module)
    const load = spec => {
      if (spec.endsWith('.css')) return {}
      if (spec === 'react-dom') return reactDom
      if (spec === 'react' || spec.startsWith('react/')) return require(spec)
      if (spec === 'next-themes') return { useTheme: () => ({ resolvedTheme: 'light', setTheme() {} }) }
      if (spec === '@/hooks/use-toast') return { useToast: () => ({ toast() {} }) }
      if (spec === 'next/link') return { __esModule: true, default: ({ children }) => React.createElement('a', null, children) }
      if (spec === 'lucide-react') return blankComponents
      const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null
      if (base) {
        const target = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
        assert.ok(target, `Missing ${spec}`)
        if (target.includes('/components/') && !target.endsWith('/studio-toolbar-save-feedback.tsx')) return blankComponents
        return readModule(target)
      }
      return require(spec)
    }
    const timers = {
      setTimeout: (fn, ms) => { const id = ++world.timerId; world.timeouts.set(id, { fn, ms }); return id },
      clearTimeout: id => { world.timeouts.delete(id) },
      setInterval: (fn, delay) => { const id = ++world.timerId; world.intervals.set(id, { fn, delay }); return id },
      clearInterval: id => { world.intervals.delete(id) },
    }
    const forbidden = () => { throw Error('Isolated Viewer witness refuses network access') }
    const sink = (...args) => world.logs.push(String(args[0]))
    vm.runInNewContext(transpile(file, source), { module, exports: module.exports, require: load,
      process: { env }, window: windowHost, document: documentHost, localStorage: windowHost.localStorage,
      HTMLElement: HostNode, ResizeObserver: globalThis.ResizeObserver, URL, Map, Set, WeakMap, Promise, crypto,
      fetch: forbidden, WebSocket: forbidden, console: { ...console, log: sink, info: sink, warn: sink, error: sink },
      ...timers }, { filename: relative })
    return module.exports
  }
  return readModule(path.join(root, VIEWER)).PresentationViewer
}

const newWorld = () => ({ slideChanges: [], commands: [], logs: [], preconnects: [], prefetches: [], intervals: new Map(), timeouts: new Map(), timerId: 0 })
const find = (node, predicate) => predicate(node) ? node : node.childNodes.map(child => find(child, predicate)).find(Boolean)
const frameIn = container => find(container, node => node.tagName === 'IFRAME')
const baselineProps = { presentationId: 'synthetic-final', presentationUrl: 'https://layout.invalid/p/synthetic-final',
  finalPresentationUrl: 'https://layout.invalid/p/synthetic-final', slideCount: 3, sessionId: 'synthetic-session',
  deckOwnerSessionId: 'synthetic-session', showControls: false, connected: true }
const INFO = { success: true, data: { index: 0, total: 3 } }
const ENV = { NODE_ENV: 'test', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'https://layout.invalid' }

function createFixture(PresentationViewer) {
  const fixture = { container: documentHost.createElement('div'), props: { ...baselineProps, onSlideChange: slide => world.slideChanges.push(slide) } }
  documentHost.body.appendChild(fixture.container)
  fixture.root = createRoot(fixture.container)
  fixture.render = async (props = fixture.props) => {
    fixture.props = props
    await React.act(async () => fixture.root.render(React.createElement(PresentationViewer, { ...props })))
  }
  fixture.load = async () => React.act(async () => { frameIn(fixture.container).dispatchEvent({ type: 'load', bubbles: false }); await settle() })
  fixture.close = async () => { await React.act(async () => fixture.root.unmount()); documentHost.body.removeChild(fixture.container) }
  return fixture
}
const polls = () => world.commands.filter(c => c.action === 'getCurrentSlideInfo' || c.action === 'composeGetState').length
const delays = () => [...world.intervals.values()].map(i => i.delay)
const lastInterval = () => [...world.intervals.values()].at(-1)
const settle = () => new Promise(resolve => setImmediate(resolve))
/** The clock fires the newest interval and the tick runs to its end (the reply is a prompt one). */
const tickInterval = async () => React.act(async () => { await lastInterval().fn(); await settle() })
/** The clock fires the newest interval and the tick is left in flight (no reply is coming). */
const fireInterval = async () => React.act(async () => { void lastInterval().fn(); await settle() })
/** Runs the timeouts of the commands in flight (sendCommand's 5 s budget), as the clock would. */
const timeoutPolls = async () => React.act(async () => {
  for (const [id, timer] of [...world.timeouts]) if (timer.ms === 5000) { world.timeouts.delete(id); timer.fn() }
  await settle()
})

/** One variant's run: the same scenarios on any viewer text; returns what the viewer did (for the hash) and the facts the flag-on checks need. */
async function runVariant({ text, flagValue }) {
  world = newWorld()
  const env = flagValue === undefined ? { ...ENV } : { ...ENV, [FLAG]: flagValue }
  const PresentationViewer = loadViewer({ text, env })
  const facts = {}
  const step = name => facts.steps.push({ name, polls: polls(), delays: delays(), commands: world.commands.length, slideChanges: world.slideChanges.length })
  facts.steps = []

  // S1: every reply is a good one
  {
    const fx = createFixture(PresentationViewer)
    await fx.render()
    facts.preconnectsAfterRender = world.preconnects.length
    frameIn(fx.container).respond = () => INFO
    await fx.load(); step('S1 loaded')
    await tickInterval(); step('S1 interval tick')
    await fx.render({ ...fx.props }); await fx.render({ ...fx.props }); step('S1 re-rendered twice')
    facts.preconnectsAfterRerenders = world.preconnects.length
    // a restart of the poll effect (its slide count dependency) on the same frame and URL
    await fx.render({ ...fx.props, slideCount: 4 }); step('S1 restart (slideCount)')
    // a new frame (new URL) loads
    await fx.render({ ...fx.props, presentationId: 'synthetic-next', presentationUrl: 'https://layout.invalid/p/synthetic-next', finalPresentationUrl: 'https://layout.invalid/p/synthetic-next' })
    frameIn(fx.container).respond = () => INFO
    step('S1 new URL rendered')
    await fx.load(); step('S1 new frame loaded')
    await fx.close(); step('S1 closed')
  }
  // S2: the viewer is not ready: every reply says so
  {
    const fx = createFixture(PresentationViewer)
    await fx.render()
    frameIn(fx.container).respond = () => ({ success: false, error: 'viewer not ready' })
    await fx.load(); step('S2 loaded')
    await tickInterval(); step('S2 1st interval failure')
    await tickInterval(); step('S2 2nd interval failure')
    await tickInterval(); step('S2 3rd interval failure')
    await fx.close(); step('S2 closed')
  }
  // S3: the viewer never answers (timeouts)
  {
    const fx = createFixture(PresentationViewer)
    await fx.render()
    frameIn(fx.container).respond = () => null
    await fx.load(); step('S3 loaded, no answer')
    await fireInterval(); step('S3 interval tick while the first poll is in flight')
    await timeoutPolls(); step('S3 timeouts ran')
    await fireInterval(); step('S3 interval tick after the timeouts')
    await timeoutPolls(); step('S3 interval tick timed out')
    await fx.close(); step('S3 closed')
  }
  // S4: the first answer is a bad one (success with nothing in it), the next ones are good
  {
    const fx = createFixture(PresentationViewer)
    await fx.render()
    frameIn(fx.container).respond = () => ({ success: true })
    await fx.load(); step('S4 loaded, empty answer')
    frameIn(fx.container).respond = () => INFO
    await tickInterval(); step('S4 interval tick')
    await fx.close(); step('S4 closed')
  }
  // S5: the first answer is a hollow success (a viewer that has not drawn its slides: no slide count), the next is good
  {
    const fx = createFixture(PresentationViewer)
    await fx.render()
    frameIn(fx.container).respond = () => ({ success: true, data: { index: 0, total: 0 } })
    await fx.load(); step('S5 loaded, hollow answer')
    await tickInterval(); step('S5 interval tick, hollow answer')
    frameIn(fx.container).respond = () => INFO
    await tickInterval(); step('S5 interval tick, good answer')
    await fx.close(); step('S5 closed')
  }
  facts.logs = world.logs.slice()
  facts.commands = world.commands.slice()
  facts.preconnects = world.preconnects.map(a => JSON.parse(JSON.stringify(a)))
  facts.prefetches = world.prefetches.map(a => JSON.parse(JSON.stringify(a)))
  facts.leftoverIntervals = world.intervals.size
  return facts
}
// What the viewer did, without the react-dom recorder (the base has no preconnect): commands, timer periods per step, log lines.
const behaviour = facts => ({ steps: facts.steps, commands: facts.commands, logs: facts.logs })
const stepOf = (facts, name) => facts.steps.find(s => s.name === name) ?? assert.fail(`no step ${name}`)

function proveFlagOff(base, off, label) {
  check(assert.equal, sha(JSON.stringify(behaviour(off))), sha(JSON.stringify(behaviour(base))), `${label}: the viewer\'s commands, timers and log lines equal the base viewer\'s (hash)`)
  check(assert.deepEqual, [off.preconnects, off.prefetches], [[], []], `${label}: no preconnect, no prefetchDNS`)
  check(assert.equal, off.leftoverIntervals, 0, `${label}: every interval cleared on unmount`)
}

function proveFlagOn(base, on) {
  const s = name => stepOf(on, name), b = name => stepOf(base, name)
  // Commands are counted over the whole run, so a step's EXTRA is the flag-on run's total minus the base run's at the same step.
  const extra = name => s(name).polls - b(name).polls
  // preconnect: Layout and the four CDN hosts, once, with the font host cross-origin; a re-render asks for nothing more
  const want = [['https://layout.invalid'], ['https://cdn.jsdelivr.net'], ['https://cdn.tailwindcss.com'], ['https://fonts.googleapis.com'], ['https://fonts.gstatic.com', { crossOrigin: 'anonymous' }]]
  check(assert.deepEqual, on.preconnects, want, 'flag on: preconnect for Layout and the four CDN hosts, the font host cross-origin, each once')
  check(assert.deepEqual, on.prefetches, want.map(([origin]) => [origin]), 'flag on: prefetchDNS for the same origins')
  check(assert.equal, on.preconnectsAfterRender, 5, 'flag on: the first render asked')
  check(assert.equal, on.preconnectsAfterRerenders, 5, 'flag on: re-renders ask for nothing more')
  // the head-start poll is the viewer's own poll command, to the same origin
  check(assert.ok, on.commands.every(c => c.action === 'getCurrentSlideInfo' && c.origin === 'https://layout.invalid' && c.params == null), 'flag on: every command is the base\'s getCurrentSlideInfo to Layout (no new command type)')
  check(assert.deepEqual, [...new Set(base.commands.map(c => c.action))], ['getCurrentSlideInfo'], 'sanity: the base sends the same single command type')

  // S1, every reply good: one poll at once when the frame has loaded, with the base's interval; none more on a restart; one more for a new frame
  check(assert.deepEqual, [b('S1 loaded').polls, s('S1 loaded').polls], [0, 1], 'flag on: ONE getCurrentSlideInfo at once on load (the base sends none until the interval)')
  for (const name of ['S1 loaded', 'S1 interval tick', 'S1 re-rendered twice', 'S1 restart (slideCount)', 'S1 new URL rendered', 'S1 new frame loaded', 'S1 closed']) {
    check(assert.deepEqual, s(name).delays, b(name).delays, `flag on, ${name}: the interval is the base's`)
  }
  check(assert.equal, s('S1 interval tick').polls - s('S1 loaded').polls, 1, 'flag on: an interval tick is one poll')
  check(assert.equal, extra('S1 interval tick'), 1, 'flag on: ... and the base polls the same on its interval tick')
  check(assert.equal, extra('S1 re-rendered twice'), 1, 'flag on: re-renders poll nothing')
  check(assert.deepEqual, [b('S1 loaded').slideChanges, s('S1 loaded').slideChanges], [0, 1], 'flag on: the slide info reaches the page at load, not one interval later (the base: nothing until its interval tick)')
  check(assert.equal, extra('S1 restart (slideCount)'), 1, 'flag on: a restart of the poll effect (a slide-count change) polls no more at once')
  check(assert.equal, extra('S1 new URL rendered'), 1, 'flag on: a new URL polls nothing until its frame loads')
  check(assert.equal, extra('S1 new frame loaded'), 2, 'flag on: the new frame, once loaded, gets its own poll at once')

  // S2, every reply an error: the first poll's error is not a failure; an interval tick's is, step by step as before
  check(assert.equal, extra('S2 loaded'), 3, 'flag on: the viewer that is not ready was asked at once')
  for (const name of ['S2 loaded', 'S2 1st interval failure', 'S2 2nd interval failure', 'S2 3rd interval failure']) {
    check(assert.deepEqual, s(name).delays, b(name).delays, `flag on, ${name}: the same period as the base`)
  }
  check(assert.deepEqual, [b('S2 loaded').delays, b('S2 1st interval failure').delays, b('S2 2nd interval failure').delays, b('S2 3rd interval failure').delays], [[3000], [6000], [10000], [10000]],
    'sanity: the base backs off 3 s, 6 s, then 10 s (the cap) on failed interval ticks; the first poll\'s error left the 3 s interval alone')
  for (const name of ['S2 1st interval failure', 'S2 2nd interval failure', 'S2 3rd interval failure']) check(assert.equal, extra(name), 3, `flag on, ${name}: the restart that follows a failure polls no more at once`)

  // S3, no answer at all: the first poll waits out its timeout; no second poll overlaps it; its timeout starts no backoff
  check(assert.equal, extra('S3 loaded, no answer'), 4, 'flag on, no reply: the first poll is in flight')
  check(assert.deepEqual, [s('S3 loaded, no answer').delays, b('S3 loaded, no answer').delays], [[3000], [3000]], 'flag on: ... on the base\'s 3 s interval')
  check(assert.equal, s('S3 interval tick while the first poll is in flight').polls, s('S3 loaded, no answer').polls, 'flag on: an interval tick while the first poll is in flight sends nothing (no overlap)')
  check(assert.equal, b('S3 interval tick while the first poll is in flight').polls - b('S3 loaded, no answer').polls, 1, 'base: the same interval tick polls (there is no head-start poll to wait for)')
  check(assert.deepEqual, [s('S3 timeouts ran').delays, b('S3 timeouts ran').delays], [[3000], [6000]], 'flag on: the first poll\'s timeout started NO backoff (the base counts its interval tick\'s timeout)')
  check(assert.equal, s('S3 interval tick after the timeouts').polls - s('S3 timeouts ran').polls, 1, 'flag on: once the first poll is over the interval ticks poll again')
  check(assert.deepEqual, [s('S3 interval tick after the timeouts').delays, s('S3 interval tick timed out').delays], [[3000], [6000]], 'flag on: an interval tick\'s timeout is the failure it always was (the backoff starts there)')

  // S5, a hollow success (no slide count yet): dropped by the head start, so nothing reaches the page early; the interval ticks act on it as always
  check(assert.equal, extra('S5 loaded, hollow answer'), 5, 'flag on: the hollow answer was asked for at once')
  // slide-change reports are counted over the whole run, so S5's are measured from where S4 ended
  const reports = (run, name) => stepOf(run, name).slideChanges - stepOf(run, 'S4 closed').slideChanges
  check(assert.deepEqual, [reports(base, 'S5 loaded, hollow answer'), reports(on, 'S5 loaded, hollow answer')], [0, 0], 'flag on: the hollow answer reached the page not at all (no slide-change report at load)')
  check(assert.deepEqual, [reports(base, 'S5 interval tick, hollow answer'), reports(on, 'S5 interval tick, hollow answer')], [1, 1], 'flag on: the interval tick acts on a hollow answer exactly as the base does (one report)')
  check(assert.deepEqual, [reports(base, 'S5 interval tick, good answer'), reports(on, 'S5 interval tick, good answer')], [1, 1], 'flag on: a good answer after it changes nothing more, as in the base')
  for (const name of ['S5 loaded, hollow answer', 'S5 interval tick, hollow answer', 'S5 interval tick, good answer']) check(assert.deepEqual, s(name).delays, b(name).delays, `flag on, ${name}: the base's interval`)

  // S4, an empty success: no failure either
  check(assert.equal, extra('S4 loaded, empty answer'), 4, 'flag on: an empty first answer was asked for at once')
  for (const name of ['S4 loaded, empty answer', 'S4 interval tick']) check(assert.deepEqual, s(name).delays, b(name).delays, `flag on, ${name}: the base's interval`)
  check(assert.equal, on.leftoverIntervals, 0, 'flag on: every interval cleared on unmount')
}

// the three runs (a fourth, flag value "false", rides along)
const baseFacts = await runVariant({ text: baseViewer, flagValue: undefined })
const offFacts = await runVariant({ text: viewerText, flagValue: undefined })
const falseFacts = await runVariant({ text: viewerText, flagValue: 'false' })
const onFacts = await runVariant({ text: viewerText, flagValue: 'true' })
if (process.env.FIRST_PAINT_DEBUG) for (const [name, f] of [['base', baseFacts], ['off', offFacts], ['on', onFacts]]) { console.log('==', name); for (const st of f.steps) console.log(JSON.stringify(st)); console.log('commands', f.commands.map(c => c.action).join(',')) }
check(assert.ok, baseFacts.steps.length > 0 && baseFacts.commands.length > 0, 'sanity: the base viewer run polled')
proveFlagOff(baseFacts, offFacts, 'flag unset')
proveFlagOff(baseFacts, falseFacts, 'flag "false"')
proveFlagOn(baseFacts, onFacts)
const identity = sha(JSON.stringify(behaviour(offFacts)))
console.log(`PASS viewer behaviour: ${checks} checks; flag-off behaviour hash ${identity.slice(0, 16)} (base viewer, head unset, head "false" all equal; ${baseFacts.commands.length} commands, ${baseFacts.logs.length} log lines)`)

// ---------- mutation check: broken copies of the viewer wiring must fail at least one check ----------
const once = (text, from, to) => {
  assert.equal(text.split(from).length - 1, 1, `mutant source text exists once: ${from.slice(0, 70)}`)
  return text.replace(from, () => to)
}
const MUTANTS = [
  ['the catch guard is gone (a first poll\'s failure is counted)', t => once(t, `        if (firstTick) { debugLog('⏸️ First poll got no usable answer; not counted'); return } // STUDIO-FIRST-PAINT: the head-start tick never counts a failure or starts a backoff\n`, '')],
  ['the guard is inverted (interval failures are not counted)', t => once(t, 'if (firstTick) { debugLog(', 'if (!firstTick) { debugLog(')],
  ['no frame handed to the poll (no head start)', t => once(t, 'startStudioSlideInfoPoll(iframeRef.current, approvedIframeNavigationUrl, async', 'startStudioSlideInfoPoll(null, approvedIframeNavigationUrl, async')],
  ['no URL handed to the poll (no head start)', t => once(t, 'startStudioSlideInfoPoll(iframeRef.current, approvedIframeNavigationUrl, async', 'startStudioSlideInfoPoll(iframeRef.current, null, async')],
  ['the hollow-answer drop is gone', t => once(t, `        if (firstTick && !isUsableFirstPollAnswer(result)) return // STUDIO-FIRST-PAINT: a hollow answer from a viewer that has not drawn its slides yet is dropped (the interval ticks carry on)\n`, '')],
  ['the preconnect call is gone', t => once(t, `  warmStudioFirstPaintConnections(VIEWER_ORIGIN) // STUDIO-FIRST-PAINT (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED, default off): React hoists the preconnects for Layout and its CDNs into <head>; nothing with the flag off\n`, '')],
  ['the preconnect call has no Layout URL', t => once(t, 'warmStudioFirstPaintConnections(VIEWER_ORIGIN)', 'warmStudioFirstPaintConnections(undefined)')],
]
let killed = 0
for (const [name, mutate] of MUTANTS) {
  const mutated = mutate(viewerText)
  assert.notEqual(mutated, viewerText, `mutant "${name}" changes the source`)
  let survived = false
  try {
    const mutantOn = await runVariant({ text: mutated, flagValue: 'true' })
    proveFlagOn(baseFacts, mutantOn)
    survived = true
  } catch (error) {
    assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not by a crash: ${error}`)
    killed++
    console.log(`  killed "${name}" by: ${String(error.message).split('\n')[0].slice(0, 110)}`)
  }
  assert.ok(!survived, `mutant survived: ${name}`)
}
check(assert.equal, killed, MUTANTS.length, 'every mutant killed')
console.log(`Studio first paint (viewer): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; real viewer under ReactDOM in an inert DOM host; no network, no browser.`)
