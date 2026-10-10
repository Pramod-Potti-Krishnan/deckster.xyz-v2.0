// F9-A: live mini-preview fallback for rail cards that will never get a thumbnail
// (flag NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED, default off).
// Offline and self-contained: no network, no git, no browser. The repo root is found from this file (package.json anchor).
// It covers the gate (none, or pending / stale without a thumbnail for 15 s), the frame URL (view-only builder + Layout viewer allow-list), the shared slot pool
// (cap of 3), the per-card controller (mounted only while eligible AND visible), the hook (IntersectionObserver, mount/unmount, swap
// to a real image; the on-screen stand-in for an observer that has not answered yet, so a card already in view needs no scroll), the
// pending timer, the component markup (scaled, inert, no pointer events) and the real strip (server render; flag off = unchanged),
// then re-runs every suite against deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED'
const FILES = {
  lib: 'lib/rail-live-preview.ts',
  hook: 'hooks/use-rail-live-preview.ts',
  component: 'components/rail-live-preview.tsx',
  strip: 'components/slide-thumbnail-strip.tsx',
}
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const SRC = Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, read(rel)]))
const VIEWER = read('components/presentation-viewer.tsx')
const ENVEX = read('.env.example')

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
/** `overrides`: repo-relative path -> source text; `stubs`: import specifier as written -> module object; `globals`: extra free names. */
function createWorld({ env = {}, overrides = {}, stubs = {}, globals = {} } = {}) {
  const cache = new Map()
  const names = Object.keys(globals)
  const exists = rel => rel in overrides || (fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile())
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext
    throw new Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const source = rel in overrides ? overrides[rel] : read(rel)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      return nodeRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', ...names, compile(rel, source))(
      module, module.exports, require, { env }, ...names.map(name => globals[name]))
    return module.exports
  }
  return { load }
}

const urlPolicy = createWorld().load('lib/layout-viewer-url-policy.ts')
const VIEWER_URL = 'https://layout.uat.test/p/pres-1'
const policy = urlPolicy.createLayoutViewerUrlPolicy('https://layout.uat.test', '')
const frameUrl = index => `${VIEWER_URL}?viewOnly=true#/${index}`

// ---------------------------------------------------------------- lib: flag, gate, URL, scale, pool, controller
function libSuite(overrides) {
  const make = (env = {}, stubs) => createWorld({ env, overrides, stubs }).load(FILES.lib)
  const lib = make()

  // flag: exact 'true' only, default off
  check(assert.equal, lib.STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED, false, 'default off')
  for (const value of ['', 'TRUE', 'True', '1', 'yes', ' true', 'false', 'on'])
    check(assert.equal, make({ [FLAG]: value }).STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED, false, `flag "${value}"`)
  check(assert.equal, make({ [FLAG]: 'true' }).STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED, true)
  check(assert.equal, lib.RAIL_LIVE_PREVIEW_MAX_FRAMES, 3, 'hard cap of three frames')
  check(assert.deepEqual, { ...lib.RAIL_LIVE_PREVIEW_STAGE }, { width: 1920, height: 1080 })

  // the none-only gate
  const applies = row => lib.railLivePreviewApplies(row)
  check(assert.equal, applies({ thumbnailStatus: 'none' }), true, 'none, no url')
  check(assert.equal, applies({ thumbnailStatus: 'none', thumbnailUrl: null }), true)
  check(assert.equal, applies({ thumbnailStatus: 'none', thumbnailUrl: undefined }), true)
  check(assert.equal, applies({ thumbnailStatus: 'none', thumbnailUrl: '' }), true)
  check(assert.equal, applies({ thumbnailStatus: 'none', thumbnailUrl: '   ' }), true, 'a blank url is no thumbnail (the card trims it the same way)')
  check(assert.equal, applies({ thumbnailStatus: 'none', thumbnailUrl: 'https://proj.test/a.png' }), false, 'never replace a real thumbnail')
  check(assert.equal, applies({ thumbnailStatus: 'none', thumbnailUrl: ' https://proj.test/a.png ' }), false)
  for (const status of ['fresh', 'stale', 'pending', undefined, null, '', 'NONE', 'None', 'unknown']) {
    check(assert.equal, applies({ thumbnailStatus: status }), false, `status ${String(status)} keeps today's card`)
    check(assert.equal, applies({ thumbnailStatus: status, thumbnailUrl: 'https://proj.test/a.png' }), false)
  }
  check(assert.equal, applies({}), false, 'a legacy row (no status) is not none')

  // pending: a preview is expected, so a card qualifies only after the grace period
  check(assert.equal, lib.RAIL_LIVE_PREVIEW_PENDING_GRACE_MS, 15000, 'a pending card waits fifteen seconds')
  const pendingRow = row => lib.railLivePreviewPending(row)
  check(assert.equal, pendingRow({ thumbnailStatus: 'pending' }), true, 'pending, no url')
  check(assert.equal, pendingRow({ thumbnailStatus: 'pending', thumbnailUrl: null }), true)
  check(assert.equal, pendingRow({ thumbnailStatus: 'pending', thumbnailUrl: '  ' }), true, 'a blank url is no thumbnail')
  check(assert.equal, pendingRow({ thumbnailStatus: 'pending', thumbnailUrl: 'https://proj.test/a.png' }), false, 'never replace a real thumbnail')
  // stale: no thumbnail URL is a card whose image is gone, and waits like a pending one; with a URL it keeps its image
  check(assert.equal, pendingRow({ thumbnailStatus: 'stale' }), true, 'stale, no url')
  check(assert.equal, pendingRow({ thumbnailStatus: 'stale', thumbnailUrl: null }), true)
  check(assert.equal, pendingRow({ thumbnailStatus: 'stale', thumbnailUrl: undefined }), true)
  check(assert.equal, pendingRow({ thumbnailStatus: 'stale', thumbnailUrl: '' }), true)
  check(assert.equal, pendingRow({ thumbnailStatus: 'stale', thumbnailUrl: '  ' }), true, 'a blank url is no thumbnail')
  check(assert.equal, pendingRow({ thumbnailStatus: 'stale', thumbnailUrl: 'https://proj.test/a.png' }), false, 'stale with a url keeps showing it')
  check(assert.equal, pendingRow({ thumbnailStatus: 'stale', thumbnailUrl: ' https://proj.test/a.png ' }), false)
  for (const status of ['none', 'fresh', undefined, null, '', 'PENDING', 'STALE', 'Stale', 'unknown'])
    check(assert.equal, pendingRow({ thumbnailStatus: status }), false, `status ${String(status)} does not wait`)
  const candidate = row => lib.railLivePreviewCandidate(row)
  check(assert.equal, candidate({ thumbnailStatus: 'none' }), true, 'none is a candidate')
  check(assert.equal, candidate({ thumbnailStatus: 'pending' }), true, 'pending is a candidate')
  check(assert.equal, candidate({ thumbnailStatus: 'none', thumbnailUrl: 'https://proj.test/a.png' }), false)
  check(assert.equal, candidate({ thumbnailStatus: 'pending', thumbnailUrl: 'https://proj.test/a.png' }), false, 'a real thumbnail is never a candidate')
  check(assert.equal, candidate({ thumbnailStatus: 'stale' }), true, 'stale without a url is a candidate')
  check(assert.equal, candidate({ thumbnailStatus: 'stale', thumbnailUrl: 'https://proj.test/a.png' }), false, 'stale with a url never is: its image stays')
  for (const status of ['fresh', undefined, null, 'NONE']) check(assert.equal, candidate({ thumbnailStatus: status }), false, `status ${String(status)}`)
  for (const status of ['fresh', 'stale']) check(assert.equal, lib.railLivePreviewApplies({ thumbnailStatus: status }), false, `${status} is never the none gate`)
  check(assert.equal, lib.railLivePreviewEligible('none', false), true, 'none: eligible at once')
  check(assert.equal, lib.railLivePreviewEligible('none', true), true)
  check(assert.equal, lib.railLivePreviewEligible('pending', false), false, 'pending: not before the grace period')
  check(assert.equal, lib.railLivePreviewEligible('pending', true), true, 'pending: after it')

  // on screen without the observer: the viewport and every clipping ancestor must show the box
  const box = (left, top, right, bottom) => ({ left, top, right, bottom })
  const viewport = box(0, 0, 1000, 800)
  const visible = (target, clips) => lib.railBoxVisible(target, clips)
  check(assert.equal, visible(box(10, 10, 120, 70), [viewport]), true, 'inside the viewport')
  check(assert.equal, visible(box(10, 10, 120, 70), []), true, 'nothing clips it')
  check(assert.equal, visible(box(10, 790, 120, 850), [viewport]), true, 'partly in view is in view')
  check(assert.equal, visible(box(10, 800, 120, 860), [viewport]), false, 'touching the bottom edge is not in view')
  check(assert.equal, visible(box(10, 900, 120, 960), [viewport]), false, 'below the viewport')
  check(assert.equal, visible(box(-200, 10, 0, 70), [viewport]), false, 'left of the viewport (touching)')
  check(assert.equal, visible(box(1000, 10, 1100, 70), [viewport]), false, 'right of the viewport (touching)')
  check(assert.equal, visible(box(10, -80, 120, 0), [viewport]), false, 'above the viewport (touching)')
  check(assert.equal, visible(box(10, 10, 10, 70), [viewport]), false, 'no width')
  check(assert.equal, visible(box(10, 10, 120, 10), [viewport]), false, 'no height')
  check(assert.equal, visible(box(120, 70, 10, 10), [viewport]), false, 'an inverted box')
  check(assert.equal, visible(box(10, 10, 10, 70), []), false, 'no width, nothing clips it')
  check(assert.equal, visible(box(10, 10, 120, 10), []), false, 'no height, nothing clips it')
  check(assert.equal, visible(box(NaN, 10, 120, 70), [viewport]), false, 'not a number')
  const scroller = box(0, 0, 140, 300)
  check(assert.equal, visible(box(10, 250, 120, 310), [viewport, scroller]), true, 'partly inside the scroll container')
  check(assert.equal, visible(box(10, 400, 120, 460), [viewport, scroller]), false, 'inside the viewport but clipped out by the scroll container')
  check(assert.equal, visible(box(10, 400, 120, 460), [scroller, viewport]), false, 'the order of the clips does not matter')
  check(assert.equal, visible(box(200, 10, 320, 70), [viewport, scroller]), false, 'clipped on the right')
  check(assert.equal, visible(box(-300, 10, -20, 70), [viewport, scroller]), false, 'clipped on the left')
  check(assert.equal, visible(box(10, -300, 120, -20), [viewport, scroller]), false, 'clipped at the top')
  check(assert.equal, visible(box(10, 10, 120, 70), [viewport, scroller, box(500, 500, 600, 600)]), false, 'every clip counts')

  // the frame URL: the existing view-only builder, through the allow-list
  const src = (url, index, p = policy) => lib.railLivePreviewSrc(url, index, p)
  check(assert.equal, src(VIEWER_URL, 3), frameUrl(3))
  check(assert.equal, src(VIEWER_URL, 0), frameUrl(0))
  check(assert.equal, src(VIEWER_URL, 27), frameUrl(27))
  check(assert.equal, src(`${VIEWER_URL}?studio_build_snapshot=2`, 5), `${VIEWER_URL}?studio_build_snapshot=2&viewOnly=true#/5`, 'other query parameters are kept')
  check(assert.equal, src(`${VIEWER_URL}#/9`, 2), frameUrl(2), 'an existing hash is replaced by the card index')
  check(assert.equal, src(`${VIEWER_URL}?viewOnly=false`, 1), frameUrl(1), 'always view only')
  const parsed = new URL(src(VIEWER_URL, 3))
  check(assert.equal, parsed.searchParams.get('viewOnly'), 'true')
  check(assert.equal, parsed.hash, '#/3')
  check(assert.equal, parsed.origin, 'https://layout.uat.test')
  for (const bad of ['https://layout-prod.test/p/x', 'http://layout.uat.test/p/x', 'https://layout.uat.test:8443/p/x', 'https://user:pw@layout.uat.test/p/x',
    'https://layout.uat.test.evil.test/p/x', 'javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'not a url', '', null, undefined])
    check(assert.equal, src(bad, 1), null, `blocked: ${String(bad)}`)
  const widened = urlPolicy.createLayoutViewerUrlPolicy('https://layout.uat.test', 'https://layout2.uat.test')
  check(assert.equal, src('https://layout2.uat.test/p/x', 1, widened), 'https://layout2.uat.test/p/x?viewOnly=true#/1', 'an explicitly allowed extra origin works')
  check(assert.equal, src('https://layout2.uat.test/p/x', 1), null, 'and only through the policy')
  check(assert.equal, src(VIEWER_URL, 1, urlPolicy.createLayoutViewerUrlPolicy('', '')), null, 'no configured origin: nothing is approved')
  for (const bad of [-1, 1.5, NaN, Infinity, -Infinity, '3', null, undefined, 2 ** 60])
    check(assert.equal, src(VIEWER_URL, bad), null, `index ${String(bad)}`)
  // It is the URL that gets built that is checked: a builder that left the approved origin yields no frame.
  const evil = make({}, { '@/lib/present-view-only': { presentFrameUrl: () => 'https://evil.test/p/x?viewOnly=true#/1' } })
  check(assert.equal, evil.railLivePreviewSrc(VIEWER_URL, 1, policy), null, 'the built URL goes through the allow-list')

  // scale
  check(assert.equal, lib.railLivePreviewScale(108), 108 / 1920)
  check(assert.equal, lib.railLivePreviewScale(1920), 1)
  check(assert.equal, lib.railLivePreviewScale(960), 0.5)
  for (const bad of [0, -5, NaN, Infinity, undefined, null, '108']) check(assert.equal, lib.railLivePreviewScale(bad), 0, `scale of ${String(bad)}`)

  // the slot pool
  const pool = lib.createRailPreviewSlotPool(3)
  const grants = []
  const tickets = Array.from({ length: 5 }, (_, i) => pool.request(() => grants.push(i)))
  check(assert.deepEqual, grants, [0, 1, 2], 'three granted at once, in order')
  check(assert.equal, pool.active, 3)
  check(assert.equal, pool.waiting, 2)
  check(assert.equal, pool.max, 3)
  check(assert.deepEqual, tickets.map(t => t.granted), [true, true, true, false, false])
  tickets[1].release()
  check(assert.deepEqual, grants, [0, 1, 2, 3], 'a freed slot goes to the oldest waiter')
  check(assert.equal, pool.active, 3)
  check(assert.equal, pool.waiting, 1)
  check(assert.equal, tickets[3].granted, true)
  check(assert.equal, tickets[1].granted, false)
  tickets[1].release()
  check(assert.equal, pool.active, 3, 'a second release frees nothing more')
  check(assert.equal, pool.waiting, 1)
  check(assert.deepEqual, grants, [0, 1, 2, 3])
  tickets[4].release()
  check(assert.equal, pool.waiting, 0, 'a waiter that leaves the queue is gone')
  check(assert.equal, pool.active, 3)
  tickets[0].release(); tickets[2].release(); tickets[3].release()
  check(assert.equal, pool.active, 0)
  check(assert.equal, pool.waiting, 0)
  check(assert.deepEqual, grants, [0, 1, 2, 3], 'a released waiter is never granted later')
  const one = lib.createRailPreviewSlotPool(1)
  const order = []
  const [first, second, third, fourth] = [0, 1, 2, 3].map(i => one.request(() => order.push(i)))
  check(assert.deepEqual, order, [0])
  second.release()
  first.release()
  check(assert.deepEqual, order, [0, 2], 'first in, first granted; a cancelled waiter is skipped')
  third.release()
  check(assert.deepEqual, order, [0, 2, 3])
  fourth.release()
  check(assert.equal, one.active, 0)
  const zero = lib.createRailPreviewSlotPool(0)
  zero.request(() => assert.fail('a pool of zero grants nothing'))
  check(assert.equal, zero.active, 0)
  check(assert.equal, lib.createRailPreviewSlotPool(-4).max, 0)
  check(assert.equal, lib.railPreviewSlots.max, 3, 'the rail shares one pool of three')
  check(assert.equal, lib.railPreviewSlots.active, 0)

  // the per-card controller
  const card = shared => {
    const log = []
    const controller = lib.createRailLivePreviewController({ pool: shared, onChange: value => log.push(value) })
    return { controller, log }
  }
  const p1 = lib.createRailPreviewSlotPool(3)
  const a = card(p1)
  a.controller.setVisible(true)
  check(assert.equal, a.controller.mounted, false, 'visible but not eligible')
  check(assert.equal, p1.active, 0, 'and no slot taken')
  a.controller.setVisible(false); a.controller.setEligible(true)
  check(assert.equal, a.controller.mounted, false, 'eligible but not visible')
  check(assert.equal, p1.active, 0)
  a.controller.setVisible(true)
  check(assert.equal, a.controller.mounted, true, 'eligible and visible')
  check(assert.equal, p1.active, 1)
  a.controller.setVisible(true); a.controller.setEligible(true)
  check(assert.deepEqual, a.log, [true], 'no repeated notifications')
  a.controller.setVisible(false)
  check(assert.equal, a.controller.mounted, false, 'off screen: unmounted')
  check(assert.equal, p1.active, 0, 'and its slot is free')
  a.controller.setVisible(true)
  check(assert.equal, a.controller.mounted, true, 'back on screen: mounted again')
  a.controller.setEligible(false)
  check(assert.equal, a.controller.mounted, false, 'no longer eligible (a real thumbnail arrived): dropped')
  check(assert.equal, p1.active, 0)
  check(assert.deepEqual, a.log, [true, false, true, false])
  a.controller.dispose()
  a.controller.setEligible(true); a.controller.setVisible(true)
  check(assert.equal, a.controller.mounted, false, 'a disposed controller stays inert')
  check(assert.equal, p1.active, 0)

  // six visible cards, three slots
  const p2 = lib.createRailPreviewSlotPool(3)
  const cards = Array.from({ length: 6 }, () => card(p2))
  for (const c of cards) { c.controller.setEligible(true); c.controller.setVisible(true) }
  const mountedIds = () => cards.map((c, i) => (c.controller.mounted ? i : -1)).filter(i => i >= 0)
  check(assert.deepEqual, mountedIds(), [0, 1, 2], 'at most three frames across the rail')
  check(assert.equal, p2.active, 3)
  check(assert.equal, p2.waiting, 3)
  cards[0].controller.setVisible(false)
  check(assert.deepEqual, mountedIds(), [1, 2, 3], 'a card scrolls off, the oldest waiter gets the slot')
  check(assert.equal, p2.waiting, 2)
  cards[4].controller.setVisible(false)
  check(assert.equal, p2.waiting, 1, 'a waiting card that scrolls off leaves the queue: only card 5 still waits')
  cards[1].controller.setEligible(false)
  check(assert.deepEqual, mountedIds(), [2, 3, 5], 'a card that stops being eligible hands its slot on; the hidden waiter is skipped')
  cards[2].controller.dispose()
  cards[0].controller.setVisible(true)
  check(assert.deepEqual, mountedIds(), [0, 3, 5], 'a disposed card hands its slot on')
  check(assert.equal, p2.waiting, 0)
  for (const c of cards) c.controller.dispose()
  check(assert.equal, p2.active, 0, 'no slot leaks')
  check(assert.equal, p2.waiting, 0)
  const p3 = lib.createRailPreviewSlotPool(3)
  const churn = Array.from({ length: 8 }, () => card(p3))
  let peak = 0
  for (let round = 0; round < 60; round++) {
    const c = churn[round % 8]
    c.controller.setEligible(true)
    c.controller.setVisible(round % 3 !== 0)
    peak = Math.max(peak, p3.active)
    if (round % 5 === 0) churn[(round + 3) % 8].controller.setVisible(false)
  }
  check(assert.ok, peak <= 3, `peak concurrent frames ${peak} stays within the cap`)
  for (const c of churn) c.controller.dispose()
  check(assert.equal, p3.active, 0)
  return lib
}

// ---------------------------------------------------------------- hook: IntersectionObserver, mount/unmount, swap
class FakeObserver {
  constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; FakeObserver.all.push(this) }
  observe(target) { this.targets.push(target) }
  disconnect() { this.disconnected = true }
  fire(isIntersecting) { this.callback([{ isIntersecting }]) }
}
FakeObserver.all = []

function hookWorld(overrides, { observer = true, globals = {}, stubs = {}, call = (hooks, props) => hooks.useRailLivePreview(props.eligible) } = {}) {
  let current = null
  const fakeReact = {
    useRef: (...args) => current.useRef(...args),
    useState: (...args) => current.useState(...args),
    useEffect: (...args) => current.useEffect(...args),
  }
  const world = createWorld({ overrides, stubs: { react: fakeReact, ...stubs }, globals: { IntersectionObserver: observer ? FakeObserver : undefined, ...globals } })
  const lib = world.load(FILES.lib)
  const hooks = world.load(FILES.hook)
  function instance(host) {
    let cursor = 0, dirty = false, pending = [], slots = [], props, api
    const impl = {
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
      useState(initial) {
        const i = cursor++
        slots[i] ??= { value: initial }
        return [slots[i].value, next => { const value = typeof next === 'function' ? next(slots[i].value) : next; if (value !== slots[i].value) { slots[i].value = value; dirty = true } }]
      },
      useEffect(callback, deps) {
        const i = cursor++, old = slots[i]
        if (!old || !deps || deps.length !== old.deps?.length || deps.some((dep, n) => dep !== old.deps[n])) {
          const next = { deps, cleanup: old?.cleanup }
          slots[i] = next
          pending.push(() => { next.cleanup?.(); next.cleanup = callback() })
        }
      },
    }
    const once = () => {
      current = impl; cursor = 0; dirty = false
      try { api = call(hooks, props) } finally { current = null }
      const hostRef = api?.hostRef ?? api?.props?.ref // the hook's result, or a rendered element that carries the ref
      if (host && hostRef && !hostRef.current) hostRef.current = host
    }
    const flush = () => {
      for (let turn = 0; turn < 20; turn++) {
        while (pending.length) pending.shift()()
        if (dirty) once()
        if (!dirty && !pending.length) break
      }
      return api
    }
    return {
      render(next) { props = next; once(); return flush() },
      renderOnly(next) { props = next; once(); return api },
      flush,
      unmount() { for (const slot of slots) slot?.cleanup?.() },
      get api() { return api },
    }
  }
  return { lib, instance, load: world.load }
}

function hookSuite(overrides) {
  FakeObserver.all = []
  const { lib, instance } = hookWorld(overrides)
  const host = { tag: 'span' }
  const h = instance(host)

  let api = h.render({ eligible: true })
  check(assert.equal, FakeObserver.all.length, 1, 'one observer per card')
  check(assert.deepEqual, FakeObserver.all[0].targets, [host], 'it observes the card preview element')
  check(assert.equal, api.mounted, false, 'nothing is mounted before the card is seen')
  check(assert.equal, lib.railPreviewSlots.active, 0)
  FakeObserver.all[0].fire(true); api = h.flush()
  check(assert.equal, api.mounted, true, 'on screen: the frame mounts')
  check(assert.equal, lib.railPreviewSlots.active, 1)
  FakeObserver.all[0].fire(false); api = h.flush()
  check(assert.equal, api.mounted, false, 'off screen: the frame is unmounted')
  check(assert.equal, lib.railPreviewSlots.active, 0, 'and its slot is free')
  FakeObserver.all[0].fire(true); api = h.flush()
  check(assert.equal, api.mounted, true, 'back on screen: mounted again')

  // swap to the real thumbnail: eligibility ends, the frame is gone in that very render
  api = h.renderOnly({ eligible: false })
  check(assert.equal, api.mounted, false, 'eligibility lost: dropped in the same render, before any effect runs')
  api = h.flush()
  check(assert.equal, api.mounted, false)
  check(assert.equal, lib.railPreviewSlots.active, 0, 'the slot is freed once effects ran')
  api = h.render({ eligible: true })
  check(assert.equal, api.mounted, true, 'eligible again while still on screen')
  check(assert.equal, FakeObserver.all.length, 1, 'the same observer is kept')

  h.unmount()
  check(assert.equal, FakeObserver.all[0].disconnected, true, 'unmount disconnects the observer')
  check(assert.equal, lib.railPreviewSlots.active, 0, 'and frees the slot')
  check(assert.equal, lib.railPreviewSlots.waiting, 0)

  // not eligible: visible takes nothing
  FakeObserver.all = []
  const idle = instance(host)
  idle.render({ eligible: false })
  FakeObserver.all[0].fire(true)
  check(assert.equal, idle.flush().mounted, false, 'visible but not eligible')
  check(assert.equal, lib.railPreviewSlots.active, 0)
  idle.unmount()

  // five cards on screen share three slots
  FakeObserver.all = []
  const cards = Array.from({ length: 5 }, (_, i) => instance({ tag: 'span', i }))
  cards.forEach(c => c.render({ eligible: true }))
  FakeObserver.all.forEach(o => o.fire(true))
  const mounted = () => cards.map(c => c.flush().mounted)
  check(assert.deepEqual, mounted(), [true, true, true, false, false], 'at most three frames across the rail')
  check(assert.equal, lib.railPreviewSlots.active, 3)
  FakeObserver.all[1].fire(false)
  check(assert.deepEqual, mounted(), [true, false, true, true, false], 'the freed slot goes to the next card waiting')
  cards[0].unmount()
  check(assert.deepEqual, mounted().slice(1), [false, true, true, true], 'a card that leaves the rail frees its slot')
  cards.forEach(c => c.unmount())
  check(assert.equal, lib.railPreviewSlots.active, 0)
  check(assert.equal, lib.railPreviewSlots.waiting, 0)

  // no IntersectionObserver: never mounted, never throws
  const bare = hookWorld(overrides, { observer: false })
  const noObserver = bare.instance(host)
  const bareApi = noObserver.render({ eligible: true })
  check(assert.equal, bareApi.mounted, false, 'without an IntersectionObserver nothing is mounted')
  check(assert.equal, bare.lib.railPreviewSlots.active, 0)
  noObserver.unmount()
}

// The first answer: an already-eligible card that is on screen mounts on the observer's FIRST callback, whichever of
// "eligible" and "first callback" comes first, and the latest of several entries wins.
function initialCallbackSuite(overrides) {
  FakeObserver.all = []
  const { lib, instance } = hookWorld(overrides)
  const cardsOnScreen = Array.from({ length: 7 }, (_, i) => instance({ tag: 'span', i }))
  const eligible = [true, false, false, true, false, true, false]
  const apis = cardsOnScreen.map((c, i) => c.render({ eligible: eligible[i] }))
  check(assert.deepEqual, apis.map(a => a.mounted), eligible.map(() => false), 'before the first callback nothing is mounted')
  // every card reports "on screen" in its very first callback; no later callback ever comes (nobody scrolls)
  FakeObserver.all.forEach(o => o.fire(true))
  check(assert.deepEqual, cardsOnScreen.map(c => c.flush().mounted), eligible, 'the first callback mounts each eligible card, with no scroll')
  check(assert.equal, lib.railPreviewSlots.active, 3)
  cardsOnScreen.forEach(c => c.unmount())
  check(assert.equal, lib.railPreviewSlots.active, 0)

  // the first callback comes before the card is eligible (the pending timer, the status): mounts the moment it is
  FakeObserver.all = []
  const early = instance({ tag: 'span' })
  early.render({ eligible: false })
  FakeObserver.all[0].fire(true)
  check(assert.equal, early.flush().mounted, false, 'on screen but not eligible yet')
  check(assert.equal, lib.railPreviewSlots.active, 0)
  check(assert.equal, early.render({ eligible: true }).mounted, true, 'eligible later, still on screen: mounted without another callback')
  early.unmount()

  // several entries in one callback: the latest wins
  FakeObserver.all = []
  const batch = instance({ tag: 'span' })
  batch.render({ eligible: true })
  FakeObserver.all[0].callback([{ isIntersecting: false }, { isIntersecting: true }])
  check(assert.equal, batch.flush().mounted, true, 'false then true: on screen')
  FakeObserver.all[0].callback([{ isIntersecting: true }, { isIntersecting: false }])
  check(assert.equal, batch.flush().mounted, false, 'true then false: off screen')
  FakeObserver.all[0].callback([])
  check(assert.equal, batch.flush().mounted, false, 'an empty callback changes nothing')
  batch.unmount()
}

// The stand-in for the first answer: until the observer has said anything, the card's own geometry decides.
function geometrySuite(overrides) {
  const box = (left, top, right, bottom) => ({ left, top, right, bottom })
  const documentElement = { tag: 'html' }
  const node = (rect, { parent = null, overflowX = 'visible', overflowY = 'visible' } = {}) => ({
    rect, parentElement: parent, style: { overflowX, overflowY }, getBoundingClientRect() { return this.rect } })
  const page = node(box(0, 0, 1000, 800), { parent: documentElement })
  const rail = node(box(860, 0, 1000, 800), { parent: page })
  const list = node(box(860, 0, 1000, 800), { parent: rail, overflowY: 'auto' })
  const globals = { window: { innerWidth: 1000, innerHeight: 800 }, document: { documentElement }, getComputedStyle: el => el.style }
  const card = (top, bottom = top + 62) => node(box(866, top, 994, bottom), { parent: list })
  const world = (opts = {}) => hookWorld(overrides, { globals, ...opts })

  // 1. NO-SCROLL: seven cards all fit; the observer says nothing (a page that has not rendered a frame yet) -> every eligible card is mounted
  FakeObserver.all = []
  let w = world()
  const eligible = [true, false, false, true, false, true, false]
  const seven = Array.from({ length: 7 }, (_, i) => w.instance(card(10 + i * 110)))
  const silent = seven.map((c, i) => c.render({ eligible: eligible[i] }))
  check(assert.deepEqual, silent.map(a => a.mounted), eligible, 'all cards on screen at mount: the eligible ones get frames without a scroll and without an observer answer')
  check(assert.equal, w.lib.railPreviewSlots.active, 3)
  // and the observer agrees when it finally speaks
  FakeObserver.all.forEach(o => o.fire(true))
  check(assert.deepEqual, seven.map(c => c.flush().mounted), eligible, 'the observer confirming changes nothing')
  // or disagrees: it has the last word
  FakeObserver.all[3].fire(false)
  check(assert.deepEqual, seven.map(c => c.flush().mounted), [true, false, false, false, false, true, false], 'the observer says off screen: unmounted')
  check(assert.equal, w.lib.railPreviewSlots.active, 2)
  seven.forEach(c => c.unmount())
  check(assert.equal, w.lib.railPreviewSlots.active, 0)

  // 2. five eligible cards on screen: the stand-in respects the cap of three too
  FakeObserver.all = []
  w = world()
  const five = Array.from({ length: 5 }, (_, i) => w.instance(card(10 + i * 70)))
  check(assert.deepEqual, five.map(c => c.render({ eligible: true }).mounted), [true, true, true, false, false], 'at most three frames')
  five.forEach(c => c.unmount())

  // 3. a card clipped out by its scroll container, or below the viewport, is not on screen
  FakeObserver.all = []
  w = world()
  const shortList = node(box(860, 0, 1000, 300), { parent: rail, overflowY: 'auto' })
  const inList = top => node(box(866, top, 994, top + 62), { parent: shortList })
  const clipped = [inList(10), inList(150), inList(400), inList(700)].map(h => w.instance(h))
  check(assert.deepEqual, clipped.map(c => c.render({ eligible: true }).mounted), [true, true, false, false], 'inside the viewport but scrolled out of the container: not mounted')
  clipped.forEach(c => c.unmount())
  FakeObserver.all = []
  w = world()
  const longList = node(box(860, 0, 1000, 2000), { parent: rail, overflowY: 'auto' })
  const below = w.instance(node(box(866, 900, 994, 962), { parent: longList }))
  const above = w.instance(node(box(866, 700, 994, 762), { parent: longList }))
  check(assert.equal, below.render({ eligible: true }).mounted, false, 'below the viewport: not mounted')
  check(assert.equal, above.render({ eligible: true }).mounted, true, 'but a card inside both is')
  below.unmount(); above.unmount()
  // each edge of the viewport counts (the container is huge, so only the viewport clips)
  FakeObserver.all = []
  w = world()
  const huge = node(box(-3000, -3000, 3000, 3000), { parent: rail, overflowY: 'auto' })
  const edges = [
    ['inside', box(300, 300, 412, 362), true], ['right of the viewport', box(1100, 300, 1212, 362), false],
    ['left of the viewport', box(-300, 300, -188, 362), false], ['above the viewport', box(300, -200, 412, -138), false],
    ['below the viewport', box(300, 900, 412, 962), false],
  ].map(([name, rect, expected]) => [name, w.instance(node(rect, { parent: huge })), expected])
  for (const [name, h, expected] of edges) check(assert.equal, h.render({ eligible: true }).mounted, expected, name)
  edges.forEach(([, h]) => h.unmount())

  // a clipping ancestor that only clips one axis
  FakeObserver.all = []
  w = world()
  const xOnly = node(box(0, 0, 100, 800), { parent: rail, overflowX: 'hidden' })
  const sideways = w.instance(node(box(300, 10, 400, 70), { parent: xOnly }))
  check(assert.equal, sideways.render({ eligible: true }).mounted, false, 'clipped on the x axis only')
  sideways.unmount()
  FakeObserver.all = []
  w = world()
  const yOnly = node(box(0, 0, 1000, 100), { parent: rail, overflowY: 'hidden' })
  const lower = w.instance(node(box(300, 300, 400, 360), { parent: yOnly }))
  check(assert.equal, lower.render({ eligible: true }).mounted, false, 'clipped on the y axis only')
  lower.unmount()
  // a collapsed rail (width 0, overflow hidden) shows nothing
  FakeObserver.all = []
  w = world()
  const collapsed = node(box(500, 0, 500, 800), { parent: page, overflowX: 'hidden', overflowY: 'hidden' })
  const hidden = w.instance(node(box(500, 10, 612, 70), { parent: collapsed }))
  check(assert.equal, hidden.render({ eligible: true }).mounted, false, 'a collapsed rail')
  hidden.unmount()

  // 4. the observer answered first: the stand-in is never consulted again
  FakeObserver.all = []
  w = world()
  const answered = w.instance(card(10))
  answered.render({ eligible: false })
  FakeObserver.all[0].fire(false)
  answered.flush()
  check(assert.equal, answered.render({ eligible: true }).mounted, false, 'the observer said off screen: the geometry does not overrule it')
  FakeObserver.all[0].fire(true)
  check(assert.equal, answered.flush().mounted, true, 'it says on screen: mounted')
  check(assert.equal, answered.render({ eligible: false }).mounted, false)
  check(assert.equal, answered.render({ eligible: true }).mounted, true, 'eligible again: the observer\'s last answer (on screen) stands')
  answered.unmount()

  // 5. eligibility arrives later with the observer still silent: the stand-in runs then
  FakeObserver.all = []
  w = world()
  const late = w.instance(card(10))
  check(assert.equal, late.render({ eligible: false }).mounted, false)
  check(assert.equal, late.render({ eligible: true }).mounted, true, 'eligible later (the pending timer ran out): mounted at once')
  check(assert.equal, late.render({ eligible: false }).mounted, false, 'and dropped when eligibility goes')
  check(assert.equal, w.lib.railPreviewSlots.active, 0)
  late.unmount()

  // 5b. the stand-in is read when the card becomes eligible, not earlier: a card that was in view while it was not eligible, and has since moved out of view, stays out
  FakeObserver.all = []
  w = world()
  const moved = card(10)
  const drifted = w.instance(moved)
  drifted.render({ eligible: false })
  moved.rect = box(866, 1400, 994, 1462)
  check(assert.equal, drifted.render({ eligible: true }).mounted, false, 'out of view by the time it is eligible: not mounted')
  moved.rect = box(866, 10, 994, 72)
  check(assert.equal, drifted.render({ eligible: false }).mounted, false)
  check(assert.equal, drifted.render({ eligible: true }).mounted, true, 'back in view and eligible again: the geometry is read again')
  drifted.unmount()

  // 6. without an IntersectionObserver nothing is ever mounted, geometry or not
  w = world({ observer: false })
  const bare = w.instance(card(10))
  check(assert.equal, bare.render({ eligible: true }).mounted, false, 'no observer: no frame, even on screen')
  check(assert.equal, w.lib.railPreviewSlots.active, 0)
  bare.unmount()

  // 7. a layout read that throws never throws out of the hook and never mounts
  FakeObserver.all = []
  w = world()
  const broken = w.instance({ parentElement: list, getBoundingClientRect() { throw new Error('detached') } })
  check(assert.equal, broken.render({ eligible: true }).mounted, false, 'a failing layout read is a no')
  broken.unmount()
  FakeObserver.all = []
  w = hookWorld(overrides, { globals: { ...globals, getComputedStyle: () => { throw new Error('no style') } } })
  const noStyle = w.instance(card(10))
  check(assert.equal, noStyle.render({ eligible: true }).mounted, false, 'a failing style read is a no')
  noStyle.unmount()
}

// ---------------------------------------------------------------- the 15 s pending timer
function fakeTimers() {
  let now = 0, seq = 0
  const timers = new Map()
  return {
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id },
    clearTimeout: id => { timers.delete(id) },
    advance(ms) {
      const end = now + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        now = due[1].at
        timers.delete(due[0])
        due[1].fn()
      }
      now = end
    },
    get active() { return timers.size },
  }
}
function graceSuite(overrides) {
  const make = () => {
    const clock = fakeTimers()
    const world = hookWorld(overrides, { globals: { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout },
      call: (hooks, props) => hooks.useRailPendingGrace(props.pending, props.graceMs) })
    return { clock, ...world }
  }
  let { clock, instance } = make()
  let h = instance(null)
  check(assert.equal, h.render({ pending: true }), false, 'just seen pending: not yet')
  check(assert.equal, clock.active, 1, 'one client-side timer')
  clock.advance(14999)
  check(assert.equal, h.flush(), false, 'fourteen seconds and a bit: still not')
  clock.advance(1)
  check(assert.equal, h.flush(), true, 'fifteen seconds: eligible')
  clock.advance(60000)
  check(assert.equal, h.flush(), true, 'and stays eligible')
  check(assert.equal, clock.active, 0)
  // a status change resets it, and the same pending episode does not restart it
  check(assert.equal, h.render({ pending: true }), true, 'a re-render in the same pending episode keeps it')
  check(assert.equal, h.renderOnly({ pending: false }), false, 'no longer pending: false in that very render')
  check(assert.equal, h.flush(), false)
  check(assert.equal, h.render({ pending: true }), false, 'pending again: the full wait again')
  clock.advance(14999)
  check(assert.equal, h.flush(), false)
  clock.advance(1)
  check(assert.equal, h.flush(), true)
  h.unmount()
  check(assert.equal, clock.active, 0, 'unmount clears the timer')

  ;({ clock, instance } = make())
  h = instance(null)
  check(assert.equal, h.render({ pending: false }), false)
  check(assert.equal, clock.active, 0, 'not pending: no timer at all')
  clock.advance(60000)
  check(assert.equal, h.flush(), false)
  h.unmount()

  // pending for a while, then the status settles before the period is over: the timer is gone and never fires late
  ;({ clock, instance } = make())
  h = instance(null)
  h.render({ pending: true })
  clock.advance(10000)
  h.render({ pending: false })
  check(assert.equal, clock.active, 0, 'the status left pending: the timer is cleared')
  clock.advance(60000)
  check(assert.equal, h.flush(), false, 'and it never fires late')
  h.unmount()

  // a different period
  ;({ clock, instance } = make())
  h = instance(null)
  h.render({ pending: true, graceMs: 100 })
  clock.advance(99)
  check(assert.equal, h.flush(), false)
  clock.advance(1)
  check(assert.equal, h.flush(), true, 'the period is a parameter')
  h.unmount()
}

// The real card (component + hooks + slot pool) under fake React, a fake clock and a fake observer: a card that is waiting (the strip
// hands a pending card, and a stale card with no thumbnail, to the component as status `pending`) is not eligible before 15 s and
// gets its frame at 15 s; a none card gets it at once.
function chainSuite(overrides) {
  const clock = fakeTimers()
  const box = (left, top, right, bottom) => ({ left, top, right, bottom })
  const documentElement = { tag: 'html' }
  const node = (rect, parent) => ({ rect, parentElement: parent, style: { overflowX: 'visible', overflowY: 'visible' }, getBoundingClientRect() { return this.rect } })
  const page = node(box(0, 0, 1000, 800), documentElement)
  const globals = { window: { innerWidth: 1000, innerHeight: 800 }, document: { documentElement }, getComputedStyle: el => el.style,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout }
  let w
  w = hookWorld(overrides, { globals, stubs: { '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: policy } },
    call: (hooks, props) => w.load(FILES.component).RailLivePreview(props) })
  const state = el => el.props['data-studio-rail-live-preview']
  const frame = el => el.props.children
  const props = status => ({ viewerUrl: VIEWER_URL, slideIndex: 3, status })

  // waiting card, observer answers "on screen" at once
  FakeObserver.all = []
  let card = w.instance(node(box(866, 10, 994, 72), page))
  let el = card.render(props('pending'))
  check(assert.equal, state(el), 'idle', 'a waiting card starts idle')
  FakeObserver.all[0].fire(true)
  check(assert.equal, state(card.flush()), 'idle', 'on screen, but not yet seen waiting for 15 s')
  check(assert.equal, clock.active, 1, 'one browser timer')
  clock.advance(14999)
  el = card.flush()
  check(assert.equal, state(el), 'idle', 'not before 15 s')
  check(assert.equal, frame(el), null)
  check(assert.equal, w.lib.railPreviewSlots.active, 0)
  clock.advance(1)
  el = card.flush()
  check(assert.equal, state(el), 'live', 'at 15 s the frame mounts')
  check(assert.equal, frame(el)?.props.src, frameUrl(3), 'view-only viewer on the slide index')
  check(assert.equal, w.lib.railPreviewSlots.active, 1)
  card.unmount()
  check(assert.equal, w.lib.railPreviewSlots.active, 0, 'the card leaves (a real thumbnail arrived): slot free')
  check(assert.equal, clock.active, 0, 'and no timer is left')

  // the observer never answers (a page that has not rendered a frame): the 15 s mark mounts it, from its own geometry
  FakeObserver.all = []
  card = w.instance(node(box(866, 10, 994, 72), page))
  check(assert.equal, state(card.render(props('pending'))), 'idle')
  clock.advance(15000)
  check(assert.equal, state(card.flush()), 'live', 'on screen at 15 s without any observer answer')
  card.unmount()

  // a none card needs no wait and starts no timer
  FakeObserver.all = []
  card = w.instance(node(box(866, 10, 994, 72), page))
  card.render(props('none'))
  FakeObserver.all[0].fire(true)
  check(assert.equal, state(card.flush()), 'live', 'none: at once')
  check(assert.equal, clock.active, 0, 'no timer for a none card')
  card.unmount()

  // a waiting card that becomes none (the inventory says nothing is coming) is eligible at once; the timer is gone
  FakeObserver.all = []
  card = w.instance(node(box(866, 10, 994, 72), page))
  card.render(props('pending'))
  FakeObserver.all[0].fire(true)
  clock.advance(5000)
  check(assert.equal, state(card.flush()), 'idle')
  check(assert.equal, state(card.render(props('none'))), 'live', 'waiting 5 s, then none: eligible at once')
  check(assert.equal, clock.active, 0)
  card.unmount()

  // a waiting card that is off screen never mounts, however long it waits
  FakeObserver.all = []
  card = w.instance(node(box(866, 900, 994, 962), page))
  card.render(props('pending'))
  FakeObserver.all[0].fire(false)
  clock.advance(60000)
  check(assert.equal, state(card.flush()), 'idle', 'off screen at 15 s: no frame')
  card.unmount()
}

// ---------------------------------------------------------------- component markup (hook stubbed)
function componentWorld(overrides, { mounted = true, calls = [], elapsed = false, graceCalls = [] } = {}) {
  const world = createWorld({
    overrides,
    stubs: {
      '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: policy },
      '@/hooks/use-rail-live-preview': {
        useRailLivePreview: eligible => { calls.push(eligible); return { hostRef: { current: null }, mounted } },
        useRailPendingGrace: pending => { graceCalls.push(pending); return elapsed },
      },
    },
  })
  return world.load(FILES.component)
}
function componentSuite(overrides) {
  const calls = []
  const { RailLivePreview } = componentWorld(overrides, { mounted: true, calls })
  const html = renderToStaticMarkup(React.createElement(RailLivePreview, { viewerUrl: VIEWER_URL, slideIndex: 3 }))
  check(assert.deepEqual, calls, [true], 'eligible exactly when an approved frame URL exists')
  const frame = html.match(/<iframe[^>]*>/)?.[0]
  check(assert.ok, frame, 'a mounted preview renders an iframe')
  check(assert.equal, (html.match(/<iframe/g) ?? []).length, 1)
  check(assert.match, frame, new RegExp(`src="${frameUrl(3).replace(/[.?]/g, '\\$&')}"`), 'view-only viewer on the card index')
  check(assert.match, frame, /tabindex="-1"/, 'not focusable')
  check(assert.match, frame, /aria-hidden="true"/, 'hidden from assistive technology')
  check(assert.match, frame, /pointer-events:none/, 'no pointer events')
  check(assert.match, frame, /width:1920px;height:1080px/, 'laid out at the stage size')
  check(assert.match, frame, /transform-origin:0 0;transform:scale\(0\.05625\)/, 'scaled down to the 108 px card')
  check(assert.match, frame, /opacity:0/, 'hidden until the viewer has loaded')
  check(assert.match, frame, /data-studio-rail-live-frame="loading"/)
  check(assert.doesNotMatch, frame, /sandbox|allow=/, 'same frame attributes as the canvas viewer')
  const host = html.match(/^<div[^>]*>/)?.[0]
  check(assert.ok, host, 'the host is the overlay div')
  check(assert.match, host, /aria-hidden="true"/)
  check(assert.match, host, /inert=""/)
  check(assert.match, host, /data-studio-rail-live-preview="live"/)
  check(assert.match, host, /class="pointer-events-none absolute inset-x-0 top-0 aspect-\[16\/9\] overflow-hidden"/, 'an overlay on the card\'s 16:9 preview area')

  const idleCalls = []
  const idle = componentWorld(overrides, { mounted: false, calls: idleCalls })
  const idleHtml = renderToStaticMarkup(React.createElement(idle.RailLivePreview, { viewerUrl: VIEWER_URL, slideIndex: 3 }))
  check(assert.doesNotMatch, idleHtml, /<iframe/, 'not mounted: no frame')
  check(assert.match, idleHtml, /data-studio-rail-live-preview="idle"/)

  for (const viewerUrl of ['https://layout-prod.test/p/pres-1', 'javascript:alert(1)', '']) {
    const blockedCalls = []
    const blocked = componentWorld(overrides, { mounted: true, calls: blockedCalls })
    const blockedHtml = renderToStaticMarkup(React.createElement(blocked.RailLivePreview, { viewerUrl, slideIndex: 3 }))
    check(assert.deepEqual, blockedCalls, [false], `not eligible for ${viewerUrl || 'an empty URL'}`)
    check(assert.doesNotMatch, blockedHtml, /<iframe/, 'an unapproved origin never gets a frame, whatever the hook says')
  }
  const sharedCalls = []
  const other = componentWorld(overrides, { mounted: true, calls: sharedCalls })
  const second = renderToStaticMarkup(React.createElement(other.RailLivePreview, { viewerUrl: `${VIEWER_URL}?studio_build_snapshot=4`, slideIndex: 0 }))
  check(assert.match, second.match(/<iframe[^>]*>/)[0], /src="https:\/\/layout\.uat\.test\/p\/pres-1\?studio_build_snapshot=4&amp;viewOnly=true#\/0"/)

  // status: a none card is eligible at once; a pending card only once its 15 s timer has run out
  check(assert.deepEqual, calls, [true], 'status defaults to none')
  for (const [status, elapsed, expected] of [['none', false, true], ['none', true, true], ['pending', false, false], ['pending', true, true]]) {
    const eligibleCalls = [], graceCalls = []
    const world = componentWorld(overrides, { mounted: true, calls: eligibleCalls, elapsed, graceCalls })
    renderToStaticMarkup(React.createElement(world.RailLivePreview, { viewerUrl: VIEWER_URL, slideIndex: 3, status }))
    check(assert.deepEqual, eligibleCalls, [expected], `${status}, timer ${elapsed ? 'elapsed' : 'running'}: eligible ${expected}`)
    check(assert.deepEqual, graceCalls, [status === 'pending'], `the timer runs for a pending card only (${status})`)
  }
  // a pending card past its timer still needs an approved frame URL
  const pendingBlocked = [], pendingGrace = []
  const blockedPending = componentWorld(overrides, { mounted: true, calls: pendingBlocked, elapsed: true, graceCalls: pendingGrace })
  const blockedPendingHtml = renderToStaticMarkup(React.createElement(blockedPending.RailLivePreview, { viewerUrl: 'https://layout-prod.test/p/pres-1', slideIndex: 3, status: 'pending' }))
  check(assert.deepEqual, pendingBlocked, [false], 'pending past its timer: an unapproved origin still gets nothing')
  check(assert.doesNotMatch, blockedPendingHtml, /<iframe/)
}

// ---------------------------------------------------------------- the real strip, server-rendered
function stripWorld(overrides, { flag = true, shell = true, stubLive = false } = {}) {
  const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: shell ? 'true' : 'false' }
  if (flag) env[FLAG] = 'true'
  const stubs = { '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: policy } }
  if (stubLive) {
    stubs['./rail-live-preview'] = { RailLivePreview: props => React.createElement('i', {
      'data-stub-live': 'true', 'data-url': props.viewerUrl, 'data-index': String(props.slideIndex), 'data-status': props.status }) }
  }
  return createWorld({ env, overrides, stubs }).load(FILES.strip).SlideThumbnailStrip
}
const render = (Strip, slides, extra = {}) => renderToStaticMarkup(React.createElement(Strip, {
  slides, currentSlide: 1, onSlideClick() {}, orientation: 'vertical', totalSlides: slides.length, ...extra }))
const cardsOf = html => html.split('data-studio-thumbnail-card="true"').slice(1)
const ROWS = [
  { slideNumber: 1, slideId: 's1', title: 'Fresh', thumbnailUrl: 'https://proj.test/a.png', thumbnailStatus: 'fresh' },
  { slideNumber: 2, slideId: 's2', title: 'Pending', thumbnailStatus: 'pending' },
  { slideNumber: 3, slideId: 's3', title: 'Manual one', thumbnailStatus: 'none' },
  { slideNumber: 4, slideId: 's4', title: 'Stale', thumbnailStatus: 'stale' },
  { slideNumber: 5, slideId: 's5', title: 'Legacy' },
  { slideNumber: 6, slideId: 's6', title: 'None but an image', thumbnailUrl: 'https://proj.test/b.png', thumbnailStatus: 'none' },
  { slideNumber: 7, slideId: 's7', title: 'Manual two', thumbnailStatus: 'none' },
  { slideNumber: 8, slideId: 's8', title: 'Pending but an image', thumbnailUrl: 'https://proj.test/c.png', thumbnailStatus: 'pending' },
  { slideNumber: 9, slideId: 's9', title: 'Pending two', thumbnailStatus: 'pending' },
  { slideNumber: 10, slideId: 's10', title: 'Stale but an image', thumbnailUrl: 'https://proj.test/d.png', thumbnailStatus: 'stale' },
]

function stripSuite(overrides) {
  // flag on, Studio shell, viewer URL known: only the none and pending cards without an image get the preview host
  const On = stripWorld(overrides, { stubLive: true })
  const html = render(On, ROWS, { livePreviewViewerUrl: VIEWER_URL })
  const cards = cardsOf(html)
  check(assert.equal, cards.length, 10)
  const live = cards.map(card => card.includes('data-stub-live'))
  check(assert.deepEqual, live, [false, true, true, true, false, false, true, false, true, false], 'status none, pending or stale, without a thumbnail')
  check(assert.equal, (html.match(/data-stub-live/g) ?? []).length, 5)
  check(assert.match, cards[2], /data-url="https:\/\/layout\.uat\.test\/p\/pres-1" data-index="2" data-status="none"/, 'the approved viewer URL, the slide index and the status')
  check(assert.match, cards[6], /data-index="6" data-status="none"/)
  check(assert.match, cards[1], /data-index="1" data-status="pending"/, 'a pending card is told it is pending (its own timer decides)')
  check(assert.match, cards[8], /data-index="8" data-status="pending"/)
  check(assert.match, cards[7], /<img[^>]+src="https:\/\/proj\.test\/c\.png"/, 'a pending card that holds a real image keeps it')
  check(assert.match, cards[3], /data-index="3" data-status="pending"/, 'a stale card with no thumbnail waits like a pending one (its own timer decides), it is never shown at once')
  check(assert.match, cards[3], /No preview/, 'and keeps its own label until a frame shows')
  check(assert.match, cards[9], /<img[^>]+src="https:\/\/proj\.test\/d\.png"/, 'a stale card that holds an image keeps showing it')
  check(assert.match, cards[0], /<img[^>]+src="https:\/\/proj\.test\/a\.png"/)
  check(assert.match, cards[5], /<img[^>]+src="https:\/\/proj\.test\/b\.png"/, 'a real thumbnail is never replaced')
  check(assert.match, cards[1], /Preview loading/, 'a pending card keeps its own label until a frame shows')
  for (const i of [0, 4, 5, 7, 9]) check(assert.doesNotMatch, cards[i], /data-stub-live/, `card ${i + 1}: never a frame`)
  check(assert.match, cards[2], /No preview/, 'the card keeps its own label')
  check(assert.match, cards[2], /aria-label="Go to slide 3: Manual one"/, 'and its own button')

  // a placeholder in front of a card moves its visual number but not its place in the saved deck
  const jobs = [{ jobId: 'j1', targetIndex: 0, targetLayoutIndex: 0, status: 'building' }]
  const withJob = render(On, ROWS.slice(2, 3), { livePreviewViewerUrl: VIEWER_URL, composeJobs: jobs })
  check(assert.match, withJob, /aria-label="Go to slide 2: Manual one"/, 'the card is the second item in the rail')
  check(assert.match, withJob, /data-index="2"/, 'but the saved deck holds it at its own index (a fresh load has no placeholders)')

  for (const url of [null, undefined, '']) {
    const none = render(On, ROWS, { livePreviewViewerUrl: url })
    check(assert.doesNotMatch, none, /data-stub-live/, `no viewer URL (${String(url)}): no preview`)
  }
  check(assert.doesNotMatch, render(On, ROWS), /data-stub-live/, 'prop absent: no preview')

  // Studio shell off: the card never says "No preview" either, and gets no preview
  const classic = render(stripWorld(overrides, { stubLive: true, shell: false }), ROWS, { livePreviewViewerUrl: VIEWER_URL })
  check(assert.doesNotMatch, classic, /data-stub-live/, 'no Studio shell: no preview')

  // flag off: the strip is exactly what it was
  const Off = stripWorld(overrides, { flag: false, stubLive: true })
  const off = render(Off, ROWS, { livePreviewViewerUrl: VIEWER_URL })
  check(assert.doesNotMatch, off, /data-stub-live|data-studio-rail-live/, 'flag off: nothing of this feature in the markup')
  check(assert.equal, off, render(Off, ROWS), 'flag off ignores the viewer URL')
  check(assert.equal, off, render(On, ROWS), 'and equals the flag-on strip that has no viewer URL')
  check(assert.equal, (off.match(/No preview/g) ?? []).length, 4, 'every settled card without an image still says No preview')
  check(assert.equal, (off.match(/data-studio-thumbnail-pending/g) ?? []).length, 2, 'and every pending card without an image its spinner')
  const offJobs = render(Off, ROWS, { livePreviewViewerUrl: VIEWER_URL, composeJobs: jobs, keyBySlideId: true })
  check(assert.equal, offJobs, render(Off, ROWS, { composeJobs: jobs, keyBySlideId: true }))

  // the real component inside the real strip: an idle overlay host, a sibling of the card's button (an iframe is not valid button content)
  const Real = stripWorld(overrides, { stubLive: false })
  const realHtml = render(Real, ROWS, { livePreviewViewerUrl: VIEWER_URL })
  const realCards = cardsOf(realHtml)
  const hosts = realCards.map(card => (card.match(/data-studio-rail-live-preview="idle"/g) ?? []).length)
  check(assert.deepEqual, hosts, [0, 1, 1, 1, 0, 0, 1, 0, 1, 0], 'one preview host on each none, pending or stale card without an image')
  const hostRe = /<div aria-hidden="true" inert="" data-studio-rail-live-preview="idle" class="pointer-events-none absolute inset-x-0 top-0 aspect-\[16\/9\] overflow-hidden"><\/div>/
  check(assert.match, realCards[2], hostRe)
  check(assert.match, realCards[2], new RegExp(`</button><div data-studio-thumbnail-caption="true"[\\s\\S]*${hostRe.source}</div><div `), 'the last child of the card: after the button and the title row, so no existing sibling changes position')
  for (const card of realCards) {
    const button = card.slice(card.indexOf('<button data-studio-thumbnail-navigation'), card.indexOf('</button>'))
    check(assert.ok, button.length > 0 && !button.includes('data-studio-rail-live-preview') && !button.includes('<iframe'), 'nothing of the preview inside the card button')
  }
  check(assert.doesNotMatch, realHtml, /<iframe/, 'nothing is mounted without a visible card')
  check(assert.equal, render(Real, ROWS, { livePreviewViewerUrl: VIEWER_URL }).replace(new RegExp(hostRe.source, 'g'), ''),
    render(Off, ROWS), 'apart from the hosts, the markup is the flag-off markup')

  // a card that is being refined keeps its own spinner: no preview over it
  const refining = [{ jobId: 'r1', kind: 'refine', status: 'building', targetSlideId: 's3', targetIndex: 2, targetLayoutIndex: 2, lastProgressText: 'Refining slide' }]
  const refined = render(On, ROWS, { livePreviewViewerUrl: VIEWER_URL, composeJobs: refining })
  const refinedCards = cardsOf(refined)
  check(assert.doesNotMatch, refinedCards[2], /data-stub-live/, 'a refining card shows no live preview over its spinner')
  check(assert.match, refinedCards[2], /data-studio-thumbnail-refining/)
  check(assert.match, refinedCards[6], /data-stub-live/, 'other none cards still do')
  const refiningPending = [{ jobId: 'r2', kind: 'refine', status: 'building', targetSlideId: 's9', targetIndex: 8, targetLayoutIndex: 8, lastProgressText: 'Refining slide' }]
  check(assert.doesNotMatch, cardsOf(render(On, ROWS, { livePreviewViewerUrl: VIEWER_URL, composeJobs: refiningPending }))[8], /data-stub-live/, 'nor over a refining pending card')
}

// ---------------------------------------------------------------- source guards (wiring and "no extra calls")
function guardSuite(sources) {
  const viewer = sources.viewer ?? VIEWER
  check(assert.equal, (viewer.match(/livePreviewViewerUrl=\{approvedPresentationUrl\}/g) ?? []).length, 1, 'the viewer hands the strip its approved viewer URL')
  check(assert.doesNotMatch, viewer, /rail-live-preview|RAIL_LIVE_PREVIEW/, 'the viewer imports nothing of the feature')
  check(assert.match, ENVEX, /^NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED="false"$/m, 'documented in .env.example, default off')
  for (const key of ['lib', 'hook', 'component']) {
    check(assert.doesNotMatch, sources[key] ?? SRC[key], /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|setInterval|requestAnimationFrame/, `${key}: no backend call, no polling`)
  }
  for (const key of ['lib', 'component']) check(assert.doesNotMatch, sources[key] ?? SRC[key], /setTimeout/, `${key}: no timer`)
  const hookSource = sources.hook ?? SRC.hook
  check(assert.equal, (hookSource.match(/\bsetTimeout\(/g) ?? []).length, 1, 'the one timer is the 15 s pending timer, a single timeout and no repeat')
  check(assert.equal, (hookSource.match(/\bclearTimeout\(/g) ?? []).length, 1, 'and it is cleared')
  check(assert.match, sources.component ?? SRC.component, /<LiveFrame key=\{src\} /, 'a new URL is a new frame, never a navigation inside the old one')
  check(assert.match, sources.component ?? SRC.component, /import \{ LAYOUT_VIEWER_URL_POLICY \} from '@\/lib\/layout-service-client'/, 'the Layout viewer policy')
  check(assert.match, sources.lib ?? SRC.lib, /import \{ presentFrameUrl \} from '@\/lib\/present-view-only'/, 'the existing view-only URL builder')
  check(assert.match, sources.lib ?? SRC.lib, /import \{ evaluateLayoutViewerUrl, type LayoutViewerUrlPolicy \} from '@\/lib\/layout-viewer-url-policy'/)
  const strip = sources.strip ?? SRC.strip
  check(assert.match, strip, /<RailLivePreview viewerUrl=\{livePreviewViewerUrl\} slideIndex=\{slideIndex\} status=\{slide\.thumbnailStatus === 'none' \? 'none' : 'pending'\} \/>\n\s+\)\}\n      <\/div>\n    \)\n\n    \/\/ Wrap with context menu/,
    'the overlay is the last child of the card (a child added earlier would shift later siblings and their React ids even with the flag off)')
  check(assert.equal, (strip.match(/RailLivePreview/g) ?? []).length, 2, 'one import, one use in the strip')
  check(assert.match, strip, /\{STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED && STUDIO_THUMBNAILS && livePreviewViewerUrl && !isRefining\n\s+&& railLivePreviewCandidate\(\{ thumbnailStatus: slide\.thumbnailStatus, thumbnailUrl \}\) && \(/)
}

function fullSuite(overrides = {}, only = ['lib', 'hook', 'chain', 'component', 'strip', 'guard']) {
  if (only.includes('lib')) libSuite(overrides)
  if (only.includes('hook')) { hookSuite(overrides); initialCallbackSuite(overrides); geometrySuite(overrides); graceSuite(overrides) }
  if (only.includes('chain')) chainSuite(overrides)
  if (only.includes('component')) componentSuite(overrides)
  if (only.includes('strip')) stripSuite(overrides)
  if (only.includes('guard')) guardSuite(Object.fromEntries(Object.entries(FILES).filter(([, rel]) => rel in overrides).map(([key, rel]) => [key, overrides[rel]])))
}

// ---------------------------------------------------------------- the real sources
fullSuite()

// ---------------------------------------------------------------- mutation check: every mutant must be caught
// [name, file key, from, to, suites to run]
const ALL = ['lib', 'hook', 'chain', 'component', 'strip', 'guard']
const mutants = [
  // flag
  ['flag: any value enables', 'lib', "=== 'true'", "!== 'false'", ['lib']],
  ['flag: on by default', 'lib', "=== 'true'", "!== 'never'", ['lib']],
  // none-only gate
  ['gate: pending also gets a frame', 'lib', "if (row.thumbnailStatus !== 'none') return false", "if (row.thumbnailStatus !== 'none' && row.thumbnailStatus !== 'pending') return false", ['lib', 'strip']],
  ['gate: stale also gets a frame', 'lib', "if (row.thumbnailStatus !== 'none') return false", "if (row.thumbnailStatus !== 'none' && row.thumbnailStatus !== 'stale') return false", ['lib', 'strip']],
  ['gate: fresh also gets a frame', 'lib', "if (row.thumbnailStatus !== 'none') return false", "if (row.thumbnailStatus !== 'none' && row.thumbnailStatus !== 'fresh') return false", ['lib', 'strip']],
  ['gate: a row without status gets a frame', 'lib', "if (row.thumbnailStatus !== 'none') return false", "if (row.thumbnailStatus !== undefined && row.thumbnailStatus !== 'none') return false", ['lib', 'strip']],
  ['gate: a real thumbnail does not block the frame', 'lib', "typeof row.thumbnailUrl === 'string' && Boolean(row.thumbnailUrl.trim())", 'false', ['lib', 'strip']],
  ['gate: a blank url counts as a thumbnail', 'lib', 'row.thumbnailUrl.trim())', 'row.thumbnailUrl)', ['lib']],
  ['gate: the strip skips the gate', 'strip', '&& railLivePreviewCandidate({ thumbnailStatus: slide.thumbnailStatus, thumbnailUrl }) && (', '&& (', ['strip', 'guard']],
  ['gate: the strip does not tell the gate about the thumbnail', 'strip', 'thumbnailStatus: slide.thumbnailStatus, thumbnailUrl })', 'thumbnailStatus: slide.thumbnailStatus })', ['strip', 'guard']],
  ['gate: a refining card gets a preview over its spinner', 'strip', 'livePreviewViewerUrl && !isRefining\n', 'livePreviewViewerUrl\n', ['strip', 'guard']],
  ['gate: the strip ignores the flag', 'strip', '{STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED && STUDIO_THUMBNAILS && livePreviewViewerUrl', '{STUDIO_THUMBNAILS && livePreviewViewerUrl', ['strip', 'guard']],
  ['gate: the strip ignores the Studio shell', 'strip', '{STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED && STUDIO_THUMBNAILS && livePreviewViewerUrl', '{STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED && livePreviewViewerUrl', ['strip', 'guard']],
  ['gate: the strip renders without a viewer URL', 'strip', 'STUDIO_THUMBNAILS && livePreviewViewerUrl && !isRefining', 'STUDIO_THUMBNAILS && !isRefining', ['strip', 'guard']],
  ['gate: the strip passes the wrong URL', 'strip', 'viewerUrl={livePreviewViewerUrl}', "viewerUrl={'https://layout.uat.test/p/other'}", ['strip']],
  ['index: the strip uses the visual number', 'strip', 'slideIndex={slideIndex}', 'slideIndex={visualNumber - 1}', ['strip']],
  ['index: the strip uses a 1-based number', 'strip', 'slideIndex={slideIndex}', 'slideIndex={realSlideNumber}', ['strip']],
  // URL
  ['url: the allow-list is skipped', 'lib', "return decision.status === 'allowed' ? decision.url : null", 'return built', ['lib']],
  ['url: no view-only', 'lib', 'built = presentFrameUrl(viewerUrl, slideIndex)', "built = viewerUrl + '#/' + slideIndex", ['lib', 'component']],
  ['url: the index is ignored', 'lib', 'built = presentFrameUrl(viewerUrl, slideIndex)', 'built = presentFrameUrl(viewerUrl, 0)', ['lib', 'component']],
  ['url: the index is off by one', 'lib', 'built = presentFrameUrl(viewerUrl, slideIndex)', 'built = presentFrameUrl(viewerUrl, slideIndex + 1)', ['lib', 'component']],
  ['url: a negative index is accepted', 'lib', '|| slideIndex < 0', '', ['lib']],
  ['url: a fractional index is accepted', 'lib', '!Number.isSafeInteger(slideIndex)', '!Number.isFinite(slideIndex)', ['lib']],
  ['url: the component skips the policy', 'component', 'railLivePreviewSrc(viewerUrl, slideIndex, LAYOUT_VIEWER_URL_POLICY)', 'viewerUrl', ['component']],
  ['url: the component uses its own index', 'component', 'railLivePreviewSrc(viewerUrl, slideIndex, LAYOUT_VIEWER_URL_POLICY)', 'railLivePreviewSrc(viewerUrl, 0, LAYOUT_VIEWER_URL_POLICY)', ['component']],
  ['url: eligible although no frame URL', 'component', 'useRailLivePreview(src !== null && railLivePreviewEligible(status, pendingElapsed))', 'useRailLivePreview(railLivePreviewEligible(status, pendingElapsed))', ['component']],
  ['url: a frame without a URL', 'component', '{mounted && src ? <LiveFrame', '{mounted ? <LiveFrame', ['component']],
  // scale
  ['scale: wrong stage width', 'lib', 'width / RAIL_LIVE_PREVIEW_STAGE.width', 'width / 1080', ['lib', 'component']],
  ['scale: a bad width scales', 'lib', 'Number.isFinite(width) && width > 0 ? ', 'true ? ', ['lib']],
  // slot cap and pool
  ['cap: four frames', 'lib', 'RAIL_LIVE_PREVIEW_MAX_FRAMES = 3', 'RAIL_LIVE_PREVIEW_MAX_FRAMES = 4', ['lib', 'hook']],
  ['cap: the pool ignores its limit', 'lib', 'while (active < limit && queue.length > 0)', 'while (queue.length > 0)', ['lib', 'hook']],
  ['cap: off by one', 'lib', 'while (active < limit && queue.length > 0)', 'while (active <= limit && queue.length > 0)', ['lib', 'hook']],
  ['cap: a freed slot is not handed on', 'lib', 'active -= 1\n            drain()', 'active -= 1', ['lib', 'hook']],
  ['cap: a second release frees another slot', 'lib', "if (state === 'granted') {\n            state = 'released'", "if (state === 'granted') {", ['lib']],
  ['cap: a waiter that left is still granted', 'lib', 'if (at >= 0) queue.splice(at, 1)', '', ['lib']],
  ['cap: newest waiter first', 'lib', 'queue.shift()!.grant()', 'queue.pop()!.grant()', ['lib']],
  ['cap: a waiting card counts as mounted', 'lib', 'Boolean(ticket?.granted)', 'Boolean(ticket)', ['lib', 'hook']],
  ['cap: the pool is not shared', 'lib', 'export const railPreviewSlots: RailPreviewSlotPool = createRailPreviewSlotPool(RAIL_LIVE_PREVIEW_MAX_FRAMES)', 'export const railPreviewSlots: RailPreviewSlotPool = createRailPreviewSlotPool(99)', ['lib', 'hook']],
  // visibility mount/unmount
  ['visible: eligibility alone mounts', 'lib', 'const want = !disposed && eligible && visible', 'const want = !disposed && eligible', ['lib', 'hook']],
  ['visible: visibility alone mounts', 'lib', 'const want = !disposed && eligible && visible', 'const want = !disposed && visible', ['lib', 'hook']],
  ['visible: going off screen keeps the frame', 'lib', 'else if (!want && ticket) {', 'else if (false && ticket) {', ['lib', 'hook']],
  ['visible: dispose keeps the slot', 'lib', 'disposed = true\n      reconcile()', 'disposed = true', ['lib', 'hook']],
  ['visible: repeated notifications', 'lib', 'if (next === mounted) return\n    mounted = next', 'mounted = next', ['lib']],
  ['visible: the hook ignores the observer result', 'hook', 'controller.setVisible(latest.isIntersecting)', 'controller.setVisible(true)', ['hook']],
  ['visible: the observer is never disconnected', 'hook', 'observer?.disconnect()', '', ['hook']],
  ['visible: no observer, mounts anyway', 'hook', "if (host && typeof IntersectionObserver !== 'undefined')", 'if (host)', ['hook']],
  ['visible: the controller is never disposed', 'hook', 'controller.dispose()', '', ['hook']],
  ['visible: the hook never tells the controller it is eligible', 'hook', 'controller.setEligible(eligible)', 'void eligible', ['hook']],
  ['visible: the hook uses a private pool', 'hook', 'pool: railPreviewSlots', 'pool: { request: onGrant => { onGrant(); return { granted: true, release() {} } }, active: 0, waiting: 0, max: 99 }', ['hook']],
  ['visible: polling', 'hook', '  }, [eligible])', '    setInterval(() => {}, 1000)\n  }, [eligible])', ['guard']],
  // swap to the real thumbnail
  ['swap: the frame outlives its eligibility', 'hook', 'mounted: mounted && eligible', 'mounted', ['hook']],
  // component markup
  ['markup: the frame can be focused', 'component', '      tabIndex={-1}\n', '', ['component']],
  ['markup: the frame is exposed to assistive technology', 'component', '      aria-hidden="true"\n      tabIndex={-1}', '      tabIndex={-1}', ['component']],
  ['markup: the frame takes pointer events', 'component', "pointerEvents: 'none',", '', ['component']],
  ['markup: the host takes pointer events', 'component', 'className="pointer-events-none absolute', 'className="absolute', ['component']],
  ['markup: the host is exposed to assistive technology', 'component', '      aria-hidden="true"\n      inert', '      inert', ['component']],
  ['markup: the host is not inert', 'component', '      inert\n', '', ['component']],
  ['markup: the host does not cover the preview area', 'component', 'absolute inset-x-0 top-0 aspect-[16/9] overflow-hidden', 'absolute inset-0 overflow-hidden', ['component']],
  ['markup: not scaled', 'component', 'transform: `scale(${scale})`', "transform: 'none'", ['component']],
  ['markup: not laid out at the stage size', 'component', 'width: RAIL_LIVE_PREVIEW_STAGE.width,', 'width: 100,', ['component']],
  ['markup: shown before it has loaded', 'component', 'opacity: loaded ? 1 : 0', 'opacity: 1', ['component']],
  ['markup: a frame while idle', 'component', '{mounted && src ? <LiveFrame', '{src ? <LiveFrame', ['component']],
  ['markup: a new URL navigates the old frame', 'component', '<LiveFrame key={src} ', '<LiveFrame ', ['guard']],
  ['wiring: the viewer never passes the URL', 'viewer', 'livePreviewViewerUrl={approvedPresentationUrl}', '', ['guard']],
  ['url: the allow-list is bypassed', 'lib', "import { evaluateLayoutViewerUrl, type LayoutViewerUrlPolicy } from '@/lib/layout-viewer-url-policy'", "import { type LayoutViewerUrlPolicy } from '@/lib/layout-viewer-url-policy'\nconst evaluateLayoutViewerUrl = (value: string) => ({ status: 'allowed', url: value })", ['lib', 'guard']],
  // pending: eligible only after the 15 s timer
  ['pending: no wait (the grace is zero)', 'lib', 'RAIL_LIVE_PREVIEW_PENDING_GRACE_MS = 15_000', 'RAIL_LIVE_PREVIEW_PENDING_GRACE_MS = 0', ['lib', 'hook']],
  ['pending: a wait of one second', 'lib', 'RAIL_LIVE_PREVIEW_PENDING_GRACE_MS = 15_000', 'RAIL_LIVE_PREVIEW_PENDING_GRACE_MS = 1_000', ['lib', 'hook']],
  ['pending: a wait of a minute', 'lib', 'RAIL_LIVE_PREVIEW_PENDING_GRACE_MS = 15_000', 'RAIL_LIVE_PREVIEW_PENDING_GRACE_MS = 60_000', ['lib', 'hook']],
  ['pending: a pending card is eligible at once', 'lib', "status === 'none' || (status === 'pending' && pendingElapsed)", "status === 'none' || status === 'pending'", ['lib', 'component']],
  ['pending: eligible whatever the timer says', 'lib', "status === 'none' || (status === 'pending' && pendingElapsed)", 'true', ['lib', 'component']],
  ['pending: a none card has to wait too', 'lib', "return status === 'none' || (status === 'pending' && pendingElapsed)", "return pendingElapsed", ['lib', 'component']],
  ['pending: the waiting gate lets any status through', 'lib', "if (row.thumbnailStatus !== 'pending' && row.thumbnailStatus !== 'stale') return false", 'if (false) return false', ['lib']],
  ['pending: a pending or stale card with an image qualifies', 'lib', "if (row.thumbnailStatus !== 'pending' && row.thumbnailStatus !== 'stale') return false\n  return !hasThumbnailUrl(row)", "if (row.thumbnailStatus !== 'pending' && row.thumbnailStatus !== 'stale') return false\n  return true", ['lib', 'strip']],
  ['stale: a stale card without a thumbnail is not a candidate', 'lib', "row.thumbnailStatus !== 'pending' && row.thumbnailStatus !== 'stale'", "row.thumbnailStatus !== 'pending'", ['lib', 'strip']],
  ['stale: only stale waits', 'lib', "row.thumbnailStatus !== 'pending' && row.thumbnailStatus !== 'stale'", "row.thumbnailStatus !== 'stale'", ['lib', 'strip']],
  ['stale: fresh waits too', 'lib', "row.thumbnailStatus !== 'pending' && row.thumbnailStatus !== 'stale'", "row.thumbnailStatus !== 'pending' && row.thumbnailStatus !== 'stale' && row.thumbnailStatus !== 'fresh'", ['lib', 'strip']],
  ['stale: a stale card is a none card (a frame at once)', 'lib', "if (row.thumbnailStatus !== 'none') return false", "if (row.thumbnailStatus !== 'none' && row.thumbnailStatus !== 'stale') return false", ['lib']],
  ['stale: the strip shows a stale card at once', 'strip', "status={slide.thumbnailStatus === 'none' ? 'none' : 'pending'}", "status={slide.thumbnailStatus === 'pending' ? 'pending' : 'none'}", ['strip', 'guard']],
  ['pending: pending is not a candidate', 'lib', 'return railLivePreviewApplies(row) || railLivePreviewPending(row)', 'return railLivePreviewApplies(row)', ['lib', 'strip']],
  ['pending: every row is a candidate', 'lib', 'return railLivePreviewApplies(row) || railLivePreviewPending(row)', 'return true', ['lib', 'strip']],
  ['pending: the timer fires at once', 'hook', 'setTimeout(() => setElapsed(true), graceMs)', 'setTimeout(() => setElapsed(true), 0)', ['hook']],
  ['pending: no timer, elapsed from the start', 'hook', 'const [elapsed, setElapsed] = useState(false)', 'const [elapsed, setElapsed] = useState(true)', ['hook']],
  ['pending: the timer is never cleared', 'hook', 'return () => clearTimeout(timer)', 'return undefined', ['hook', 'guard']],
  ['pending: leaving pending does not reset it', 'hook', '    if (!pending) {\n      setElapsed(false)\n      return\n    }', '    if (!pending) return', ['hook']],
  ['pending: elapsed counts for a card that is not pending', 'hook', 'return pending && elapsed', 'return elapsed', ['hook']],
  ['pending: the timer runs for a card that is not pending', 'hook', '    if (!pending) {\n      setElapsed(false)\n      return\n    }', '    if (false) {\n      return\n    }', ['hook']],
  ['pending: the default period is ignored', 'hook', 'graceMs: number = RAIL_LIVE_PREVIEW_PENDING_GRACE_MS', 'graceMs: number = 0', ['hook']],
  ['pending: a custom period is ignored', 'hook', 'setTimeout(() => setElapsed(true), graceMs)', 'setTimeout(() => setElapsed(true), RAIL_LIVE_PREVIEW_PENDING_GRACE_MS)', ['hook']],
  ['pending: the component never starts the timer', 'component', 'useRailPendingGrace(status === \'pending\')', 'useRailPendingGrace(false)', ['component']],
  ['pending: the component runs the timer for every card', 'component', 'useRailPendingGrace(status === \'pending\')', 'useRailPendingGrace(true)', ['component']],
  ['pending: the component ignores the timer', 'component', 'railLivePreviewEligible(status, pendingElapsed)', 'railLivePreviewEligible(status, true)', ['component']],
  ['pending: the component ignores the status', 'component', 'railLivePreviewEligible(status, pendingElapsed)', "railLivePreviewEligible('none', pendingElapsed)", ['component']],
  ['chain: the card ignores the timer', 'component', 'railLivePreviewEligible(status, pendingElapsed)', 'railLivePreviewEligible(status, true)', ['chain']],
  ['chain: the card never starts the timer', 'component', "useRailPendingGrace(status === 'pending')", 'useRailPendingGrace(false)', ['chain']],
  ['chain: the timer is one second', 'lib', 'RAIL_LIVE_PREVIEW_PENDING_GRACE_MS = 15_000', 'RAIL_LIVE_PREVIEW_PENDING_GRACE_MS = 1_000', ['chain']],
  ['chain: the stand-in is never asked, so a silent observer shows nothing', 'hook', 'if (eligible && host && observingRef.current && !answeredRef.current && hostOnScreen(host)) controller.setVisible(true)', 'void host', ['chain']],
  ['chain: an off-screen card mounts', 'lib', 'const want = !disposed && eligible && visible', 'const want = !disposed && eligible', ['chain']],
  ['pending: the strip never says pending', 'strip', "status={slide.thumbnailStatus === 'none' ? 'none' : 'pending'}", "status={'none'}", ['strip', 'guard']],
  ['pending: the strip always says pending', 'strip', "status={slide.thumbnailStatus === 'none' ? 'none' : 'pending'}", "status={'pending'}", ['strip', 'guard']],
  // on screen without the observer
  ['geometry: the stand-in is never asked', 'hook', 'if (eligible && host && observingRef.current && !answeredRef.current && hostOnScreen(host)) controller.setVisible(true)', 'void host', ['hook']],
  ['geometry: asked without an observer', 'hook', 'if (eligible && host && observingRef.current && !answeredRef.current && hostOnScreen(host))', 'if (eligible && host && !answeredRef.current && hostOnScreen(host))', ['hook']],
  ['geometry: overrules an observer that has answered', 'hook', 'if (eligible && host && observingRef.current && !answeredRef.current && hostOnScreen(host))', 'if (eligible && host && observingRef.current && hostOnScreen(host))', ['hook']],
  ['geometry: the observer answer is not remembered', 'hook', '        answeredRef.current = true\n', '', ['hook']],
  ['geometry: asked when not eligible', 'hook', 'if (eligible && host && observingRef.current', 'if (host && observingRef.current', ['hook']],
  ['geometry: the viewport is ignored', 'hook', '[{ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }]', '[]', ['hook']],
  ['geometry: the viewport width is ignored', 'hook', 'right: window.innerWidth,', 'right: 1e9,', ['hook']],
  ['geometry: the viewport height is ignored', 'hook', 'bottom: window.innerHeight }', 'bottom: 1e9 }', ['hook']],
  ['geometry: the viewport left edge is ignored', 'hook', '{ left: 0, top: 0, right: window.innerWidth', '{ left: -1e9, top: 0, right: window.innerWidth', ['hook']],
  ['geometry: the viewport top edge is ignored', 'hook', '{ left: 0, top: 0, right: window.innerWidth', '{ left: 0, top: -1e9, right: window.innerWidth', ['hook']],
  ['geometry: no ancestor clips', 'hook', "style.overflowX !== 'visible' || style.overflowY !== 'visible'", 'false', ['hook']],
  ['geometry: only the x axis clips', 'hook', " || style.overflowY !== 'visible'", '', ['hook']],
  ['geometry: only the y axis clips', 'hook', "style.overflowX !== 'visible' || ", '', ['hook']],
  ['geometry: the card itself is not measured', 'hook', 'return railBoxVisible(host.getBoundingClientRect(), clips)', 'return railBoxVisible({ left: 0, top: 0, right: 1, bottom: 1 }, clips)', ['hook']],
  ['geometry: a failing read escapes', 'hook', '  } catch {\n    return false\n  }', '  } catch (error) {\n    throw error\n  }', ['hook']],
  ['geometry: a failing read means yes', 'hook', '  } catch {\n    return false\n  }', '  } catch {\n    return true\n  }', ['hook']],
  ['geometry: every card is on screen', 'hook', 'return railBoxVisible(host.getBoundingClientRect(), clips)', 'return true', ['hook']],
  ['geometry: touching edges count', 'lib', 'if (!(right > left && bottom > top)) return false\n  for', 'if (!(right >= left && bottom >= top)) return false\n  for', ['lib']],
  ['geometry: touching edges count after a clip', 'lib', '    if (!(right > left && bottom > top)) return false\n  }', '    if (!(right >= left && bottom >= top)) return false\n  }', ['lib']],
  ['geometry: a box with no area counts', 'lib', '  if (!(right > left && bottom > top)) return false\n  for', '  for', ['lib']],
  ['geometry: the clips are ignored', 'lib', 'for (const clip of clips) {', 'for (const clip of []) {', ['lib', 'hook']],
  ['geometry: the left clip is ignored', 'lib', 'left = Math.max(left, clip.left)', 'left = left', ['lib']],
  ['geometry: the top clip is ignored', 'lib', 'top = Math.max(top, clip.top)', 'top = top', ['lib']],
  ['geometry: the right clip is ignored', 'lib', 'right = Math.min(right, clip.right)', 'right = right', ['lib']],
  ['geometry: the bottom clip is ignored', 'lib', 'bottom = Math.min(bottom, clip.bottom)', 'bottom = bottom', ['lib']],
  ['geometry: only the last clip counts', 'lib', 'left = Math.max(left, clip.left)\n    top = Math.max(top, clip.top)\n    right = Math.min(right, clip.right)\n    bottom = Math.min(bottom, clip.bottom)', 'left = clip.left\n    top = clip.top\n    right = clip.right\n    bottom = clip.bottom', ['lib']],
  ['first answer: the observer result is dropped', 'hook', '        const latest = entries[entries.length - 1]\n        if (!latest) return', '        const latest = entries[0]\n        if (!latest) return', ['hook']],
  ['first answer: the first entry wins', 'hook', 'const latest = entries[entries.length - 1]', 'const latest = entries[0]', ['hook']],
  ['first answer: a callback without entries throws', 'hook', '        if (!latest) return\n', '', ['hook']],
  ['first answer: visibility is forgotten until eligible', 'lib', "setVisible(next) { if (next !== visible) { visible = next; reconcile() } },", "setVisible(next) { if (next !== visible) { visible = eligible && next; reconcile() } },", ['lib', 'hook']],
]

const OVERLAY_START = SRC.strip.indexOf('        {/* F9-A: live mini-preview for a card')
const OVERLAY_END = SRC.strip.indexOf('        )}\n      </div>\n', OVERLAY_START) + '        )}\n'.length
const OVERLAY_BLOCK = SRC.strip.slice(OVERLAY_START, OVERLAY_END)
const TITLE_ROW = '        {/* Title row below the preview: [number] [title…] [⋯] */}\n'
const BUTTON_END = '        </button>\n\n'
mutants.push(['gate: the preview sits inside the card button', 'strip', [OVERLAY_BLOCK, BUTTON_END + TITLE_ROW], ['', OVERLAY_BLOCK + BUTTON_END + TITLE_ROW], ['strip', 'guard']])
mutants.push(['gate: the overlay is a child before the title row', 'strip', [OVERLAY_BLOCK, TITLE_ROW], ['', OVERLAY_BLOCK + TITLE_ROW], ['strip', 'guard']])

let caught = 0
for (const [name, key, from, to, suites] of mutants) {
  const rel = key === 'viewer' ? 'components/presentation-viewer.tsx' : FILES[key]
  const original = key === 'viewer' ? VIEWER : SRC[key]
  const pairs = Array.isArray(from) ? from.map((f, i) => [f, to[i]]) : [[from, to]]
  let broken = original
  for (const [a, b] of pairs) {
    assert.ok(broken.includes(a), `mutant "${name}" no longer matches the ${key} source`)
    broken = broken.replace(a, () => b)
  }
  assert.notEqual(broken, original, `mutant "${name}" changes nothing`)
  compile(rel, broken) // a mutant must be valid code: it is caught by behaviour, not by a syntax error
  const seen = checks
  let survived = false
  try {
    if (key === 'viewer') guardSuite({ viewer: broken })
    else fullSuite({ [rel]: broken }, suites)
    survived = true
  } catch { /* caught */ }
  assert.equal(survived, false, `mutant survived: ${name}`)
  checks = seen
  caught++
}
check(assert.equal, caught, mutants.length)

console.log(`studio-rail-live-preview: ${checks} checks passed, ${caught} mutants caught`)
