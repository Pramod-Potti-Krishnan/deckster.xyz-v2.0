// F9-A: live mini-preview fallback for rail cards that will never get a thumbnail
// (flag NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED, default off).
// Offline and self-contained: no network, no git, no browser. The repo root is found from this file (package.json anchor).
// It covers the none-only gate, the frame URL (view-only builder + Layout viewer allow-list), the shared slot pool (cap of 3),
// the per-card controller (mounted only while eligible AND visible), the hook (IntersectionObserver, mount/unmount, swap to a real
// image), the component markup (scaled, inert, no pointer events) and the real strip (server render; flag off = unchanged),
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

function hookWorld(overrides, { observer = true } = {}) {
  let current = null
  const fakeReact = {
    useRef: (...args) => current.useRef(...args),
    useState: (...args) => current.useState(...args),
    useEffect: (...args) => current.useEffect(...args),
  }
  const world = createWorld({ overrides, stubs: { react: fakeReact }, globals: { IntersectionObserver: observer ? FakeObserver : undefined } })
  const lib = world.load(FILES.lib)
  const { useRailLivePreview } = world.load(FILES.hook)
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
      try { api = useRailLivePreview(props.eligible) } finally { current = null }
      if (host && !api.hostRef.current) api.hostRef.current = host
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
  return { lib, instance }
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

// ---------------------------------------------------------------- component markup (hook stubbed)
function componentWorld(overrides, { mounted = true, calls = [] } = {}) {
  const world = createWorld({
    overrides,
    stubs: {
      '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: policy },
      '@/hooks/use-rail-live-preview': { useRailLivePreview: eligible => { calls.push(eligible); return { hostRef: { current: null }, mounted } } },
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
}

// ---------------------------------------------------------------- the real strip, server-rendered
function stripWorld(overrides, { flag = true, shell = true, stubLive = false } = {}) {
  const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: shell ? 'true' : 'false' }
  if (flag) env[FLAG] = 'true'
  const stubs = { '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: policy } }
  if (stubLive) {
    stubs['./rail-live-preview'] = { RailLivePreview: props => React.createElement('i', {
      'data-stub-live': 'true', 'data-url': props.viewerUrl, 'data-index': String(props.slideIndex) }) }
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
]

function stripSuite(overrides) {
  // flag on, Studio shell, viewer URL known: only the none cards without an image get the preview
  const On = stripWorld(overrides, { stubLive: true })
  const html = render(On, ROWS, { livePreviewViewerUrl: VIEWER_URL })
  const cards = cardsOf(html)
  check(assert.equal, cards.length, 7)
  const live = cards.map(card => card.includes('data-stub-live'))
  check(assert.deepEqual, live, [false, false, true, false, false, false, true], 'only status none without a thumbnail')
  check(assert.equal, (html.match(/data-stub-live/g) ?? []).length, 2)
  check(assert.match, cards[2], /data-url="https:\/\/layout\.uat\.test\/p\/pres-1" data-index="2"/, 'the approved viewer URL and the slide index')
  check(assert.match, cards[6], /data-index="6"/)
  check(assert.match, cards[0], /<img[^>]+src="https:\/\/proj\.test\/a\.png"/)
  check(assert.match, cards[5], /<img[^>]+src="https:\/\/proj\.test\/b\.png"/, 'a real thumbnail is never replaced')
  check(assert.match, cards[1], /Preview loading/)
  for (const i of [0, 1, 3, 4, 5]) check(assert.doesNotMatch, cards[i], /data-stub-live/)
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
  const offJobs = render(Off, ROWS, { livePreviewViewerUrl: VIEWER_URL, composeJobs: jobs, keyBySlideId: true })
  check(assert.equal, offJobs, render(Off, ROWS, { composeJobs: jobs, keyBySlideId: true }))

  // the real component inside the real strip: an idle overlay host, a sibling of the card's button (an iframe is not valid button content)
  const Real = stripWorld(overrides, { stubLive: false })
  const realHtml = render(Real, ROWS, { livePreviewViewerUrl: VIEWER_URL })
  const realCards = cardsOf(realHtml)
  const hosts = realCards.map(card => (card.match(/data-studio-rail-live-preview="idle"/g) ?? []).length)
  check(assert.deepEqual, hosts, [0, 0, 1, 0, 0, 0, 1], 'one preview host on each none card without an image')
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
}

// ---------------------------------------------------------------- source guards (wiring and "no extra calls")
function guardSuite(sources) {
  const viewer = sources.viewer ?? VIEWER
  check(assert.equal, (viewer.match(/livePreviewViewerUrl=\{approvedPresentationUrl\}/g) ?? []).length, 1, 'the viewer hands the strip its approved viewer URL')
  check(assert.doesNotMatch, viewer, /rail-live-preview|RAIL_LIVE_PREVIEW/, 'the viewer imports nothing of the feature')
  check(assert.match, ENVEX, /^NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED="false"$/m, 'documented in .env.example, default off')
  for (const key of ['lib', 'hook', 'component']) {
    check(assert.doesNotMatch, sources[key] ?? SRC[key], /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|setInterval|setTimeout|requestAnimationFrame/, `${key}: no backend call, no polling`)
  }
  check(assert.match, sources.component ?? SRC.component, /<LiveFrame key=\{src\} /, 'a new URL is a new frame, never a navigation inside the old one')
  check(assert.match, sources.component ?? SRC.component, /import \{ LAYOUT_VIEWER_URL_POLICY \} from '@\/lib\/layout-service-client'/, 'the Layout viewer policy')
  check(assert.match, sources.lib ?? SRC.lib, /import \{ presentFrameUrl \} from '@\/lib\/present-view-only'/, 'the existing view-only URL builder')
  check(assert.match, sources.lib ?? SRC.lib, /import \{ evaluateLayoutViewerUrl, type LayoutViewerUrlPolicy \} from '@\/lib\/layout-viewer-url-policy'/)
  const strip = sources.strip ?? SRC.strip
  check(assert.match, strip, /<RailLivePreview viewerUrl=\{livePreviewViewerUrl\} slideIndex=\{slideIndex\} \/>\n\s+\)\}\n      <\/div>\n    \)\n\n    \/\/ Wrap with context menu/,
    'the overlay is the last child of the card (a child added earlier would shift later siblings and their React ids even with the flag off)')
  check(assert.equal, (strip.match(/RailLivePreview/g) ?? []).length, 2, 'one import, one use in the strip')
  check(assert.match, strip, /\{STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED && STUDIO_THUMBNAILS && livePreviewViewerUrl && !isRefining\n\s+&& railLivePreviewApplies\(\{ thumbnailStatus: slide\.thumbnailStatus, thumbnailUrl \}\) && \(/)
}

function fullSuite(overrides = {}, only = ['lib', 'hook', 'component', 'strip', 'guard']) {
  if (only.includes('lib')) libSuite(overrides)
  if (only.includes('hook')) hookSuite(overrides)
  if (only.includes('component')) componentSuite(overrides)
  if (only.includes('strip')) stripSuite(overrides)
  if (only.includes('guard')) guardSuite(Object.fromEntries(Object.entries(FILES).filter(([, rel]) => rel in overrides).map(([key, rel]) => [key, overrides[rel]])))
}

// ---------------------------------------------------------------- the real sources
fullSuite()

// ---------------------------------------------------------------- mutation check: every mutant must be caught
// [name, file key, from, to, suites to run]
const ALL = ['lib', 'hook', 'component', 'strip', 'guard']
const mutants = [
  // flag
  ['flag: any value enables', 'lib', "=== 'true'", "!== 'false'", ['lib']],
  ['flag: on by default', 'lib', "=== 'true'", "!== 'never'", ['lib']],
  // none-only gate
  ['gate: pending also gets a frame', 'lib', "if (row.thumbnailStatus !== 'none') return false", "if (row.thumbnailStatus !== 'none' && row.thumbnailStatus !== 'pending') return false", ['lib', 'strip']],
  ['gate: stale also gets a frame', 'lib', "if (row.thumbnailStatus !== 'none') return false", "if (row.thumbnailStatus !== 'none' && row.thumbnailStatus !== 'stale') return false", ['lib', 'strip']],
  ['gate: fresh also gets a frame', 'lib', "if (row.thumbnailStatus !== 'none') return false", "if (row.thumbnailStatus !== 'none' && row.thumbnailStatus !== 'fresh') return false", ['lib', 'strip']],
  ['gate: a row without status gets a frame', 'lib', "if (row.thumbnailStatus !== 'none') return false", "if (row.thumbnailStatus !== undefined && row.thumbnailStatus !== 'none') return false", ['lib', 'strip']],
  ['gate: a real thumbnail does not block the frame', 'lib', "return !(typeof row.thumbnailUrl === 'string' && row.thumbnailUrl.trim())", 'return true', ['lib', 'strip']],
  ['gate: a blank url counts as a thumbnail', 'lib', 'row.thumbnailUrl.trim())', 'row.thumbnailUrl)', ['lib']],
  ['gate: the strip skips the gate', 'strip', '&& railLivePreviewApplies({ thumbnailStatus: slide.thumbnailStatus, thumbnailUrl }) && (', '&& (', ['strip', 'guard']],
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
  ['url: eligible although no frame URL', 'component', 'useRailLivePreview(src !== null)', 'useRailLivePreview(true)', ['component']],
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
  ['visible: the hook never tells the controller it is eligible', 'hook', 'controllerRef.current?.setEligible(eligible)', 'void eligible', ['hook']],
  ['visible: the hook uses a private pool', 'hook', 'pool: railPreviewSlots', 'pool: { request: onGrant => { onGrant(); return { granted: true, release() {} } }, active: 0, waiting: 0, max: 99 }', ['hook']],
  ['visible: polling', 'hook', 'controllerRef.current?.setEligible(eligible) }, [eligible])', 'controllerRef.current?.setEligible(eligible); setInterval(() => {}, 1000) }, [eligible])', ['guard']],
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
