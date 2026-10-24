// FRONTEND-2 (THUMBNAILS-BLANK-UAT fix 1): the Publish preview falls back to Layout's slide inventory (NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED, exact "true", default off).
// Run: node scripts/test-studio-publish-preview-inventory.mjs   (plain node: transpile + vm, a small hooks runtime, a fake fetch; no network, no browser, no writes)
//   PUBLISH_PREVIEW_INVENTORY_NO_MUTANTS=1 skips the mutants.
//
// Fixtures (Layout's inventory body, read from scripts/fixtures/f8-slide-inventory, the contract's real loopback replay output):
//   RECORDED  inventory-after-manual-add.json: slide 0 fresh (thumbnail_url set, thumbnail_stale false), slide 4 STALE (thumbnail_url null, thumbnail_stale true, thumbnail_status stale),
//             slide 5 NONE (no registered thumbnail: null, false, status none). inventory-after-edit.json: slide 0 fresh, the last slide stale.
//   DERIVED   no recorded response has slide 0 stale or none, so those are the recorded body with ONLY slide 0's three thumbnail fields (thumbnail_url, thumbnail_stale, thumbnail_status)
//             replaced by the recorded stale row's / none row's values. Each is labelled DERIVED below and in the output.
//
// What is proved: (1) the pure helpers; (2) the real hook and the real component, with the real inventory reader (lib/slide-rail-identity.ts) over a fake fetch:
//   flag on + fresh: the preview shows that URL; stale or none: the unavailable state exactly as today; a live or restored image: no read at all; another presentation's inventory is
//   not used; a failed, invalid or hung read is unavailable (never a broken image); one read per session + Final deck; (3) flag off: no read, and the component draws byte for byte
//   what BASE_COMMIT's component draws; (4) stripping this change gives back BASE_COMMIT's files; (5) mutants: every rule fails when its line is broken.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { BASE_COMMIT, PUBLISH_PREVIEW_INVENTORY_CHANGES, PUBLISH_PREVIEW_INVENTORY_FILES, PUBLISH_PREVIEW_INVENTORY_NEW_FILES, stripPublishPreviewInventory } from './studio-publish-preview-inventory-strip.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FLAG = 'NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED'
const LIB = 'lib/studio-publish-preview-inventory.ts'
const HOOK = 'hooks/use-studio-publish-preview-inventory.ts'
const COMPONENT = 'components/studio-publish-preview.tsx'
const RESOLVER = 'lib/studio-publish-preview.ts'
const STAGE_F = 'lib/stage-f-thumbnails.ts'
const RAIL = 'lib/slide-rail-identity.ts'
const LAYOUT = 'https://layout.example.test'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value))
const ser = value => JSON.stringify(value, (key, item) => key === 'ref' || key === 'dom' ? undefined : typeof item === 'function' ? 'callback' : item === undefined ? '__undefined__' : item)
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
const baseOf = rel => git('show', `${BASE_COMMIT}:${rel}`)

// ---- sources (with mutants applied through `overrides[rel] = text => text`) and a compile cache
const compiled = new Map()
function compile(rel, text) {
  const key = `${rel}\0${text}`
  if (!compiled.has(key)) compiled.set(key, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)
  return compiled.get(key)
}
function load(rel, dependencies = {}, globals = {}, overrides = {}, text = undefined) {
  const source = text ?? (overrides[rel] ? overrides[rel](fs.readFileSync(path.join(root, rel), 'utf8')) : fs.readFileSync(path.join(root, rel), 'utf8'))
  const module = { exports: {} }
  vm.runInNewContext(compile(rel, source), { module, exports: module.exports, ...globals, require: name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`Unexpected dependency ${name} in ${rel}`)
  } })
  return module.exports
}

// ---- fixtures
const readFixture = name => JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/f8-slide-inventory', `${name}.json`), 'utf8'))
const RECORDED = readFixture('inventory-after-manual-add') // RECORDED: slide 0 fresh, slide 4 stale, slide 5 none
const RECORDED_EDIT = readFixture('inventory-after-edit') // RECORDED: slide 0 fresh, last slide stale
const PID = RECORDED.presentation_id
const STALE_ROW = RECORDED.slides[4], NONE_ROW = RECORDED.slides[5]
assert.equal(STALE_ROW.thumbnail_url, null); assert.equal(STALE_ROW.thumbnail_stale, true); assert.equal(NONE_ROW.thumbnail_url, null); assert.equal(NONE_ROW.thumbnail_stale, false)
assert.ok(RECORDED.slides[0].thumbnail_url && RECORDED.slides[0].thumbnail_stale === false)
const THUMB_FIELDS = ['thumbnail_url', 'thumbnail_stale', 'thumbnail_status']
const withRow = (inventory, index, row) => ({ ...plain(inventory), slides: plain(inventory).slides.map((slide, i) => i === index ? { ...slide, ...Object.fromEntries(THUMB_FIELDS.map(field => [field, row[field]])) } : slide) })
const FRESH = RECORDED // RECORDED
const FRESH_URL = RECORDED.slides[0].thumbnail_url
const STALE_0 = withRow(RECORDED, 0, STALE_ROW) // DERIVED: slide 0's thumbnail fields from the recorded stale row; slides 1-3 stay fresh
const NONE_0 = withRow(RECORDED, 0, NONE_ROW) // DERIVED: slide 0's thumbnail fields from the recorded none row; slides 1-3 stay fresh
const NONE_ALL = { ...plain(RECORDED), slides: plain(RECORDED).slides.map(slide => ({ ...slide, ...Object.fromEntries(THUMB_FIELDS.map(field => [field, NONE_ROW[field]])) })) } // DERIVED: no registered thumbnail at all
const STALE_WITH_URL = { ...plain(RECORDED), slides: plain(RECORDED).slides.map((slide, i) => i === 0 ? { ...slide, thumbnail_stale: true, thumbnail_status: 'stale' } : slide) } // DERIVED: stale flag set but the URL still sent
const FRESH_0_STALE_1 = withRow(RECORDED, 1, STALE_ROW) // DERIVED: slide 0 fresh, slide 1 stale
const EMPTY_DECK = { ...plain(RECORDED), slide_count: 0, slides: [] } // DERIVED: a deck with no slides
const OTHER_URL = 'https://fixtures.invalid/other-first.png'
console.log(`fixtures: RECORDED ${PID} (sha256 ${sha(JSON.stringify(RECORDED)).slice(0, 12)}); DERIVED stale-0, none-0, none-all, stale-with-url, fresh-0-stale-1, empty-deck`)

// ---- a small hooks runtime (useState, useRef, useEffect with deps and cleanup; keyed component state; DOM refs)
function createRuntime() {
  let context, cursor, dirty = false, tree = null, lastElement = null
  const stores = new Map(), attached = new Map(), queue = []
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
  const react = {
    useState(initial) {
      const store = context, slot = cursor++
      if (!(slot in store)) store[slot] = { value: typeof initial === 'function' ? initial() : initial }
      const cell = store[slot]
      return [cell.value, update => { const next = typeof update === 'function' ? update(cell.value) : update; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(initial) { const store = context, slot = cursor++; return store[slot] ??= { current: initial } },
    useEffect(effect, deps) {
      const store = context, slot = cursor++, previous = store[slot]
      const changed = !previous || !deps || !previous.deps || deps.length !== previous.deps.length || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))
      if (changed) queue.push({ store, slot, effect, deps })
    },
  }
  function render(element) {
    lastElement = element
    queue.length = 0
    const used = new Set(), mounted = new Set()
    function materialize(node, location = 'root') {
      if (Array.isArray(node)) return node.map((child, index) => materialize(child, `${location}/${index}`))
      if (!node || typeof node !== 'object') return node
      if (typeof node.type === 'function') {
        const key = `${location}:${node.type.name}:${node.key ?? ''}`
        mounted.add(key); context = stores.get(key) ?? []; stores.set(key, context); cursor = 0
        return materialize(node.type(node.props), key)
      }
      const children = materialize(node.props.children, `${location}/${node.type}`)
      const result = { ...node, props: { ...node.props, children } }
      if (node.type === 'img') {
        let dom = attached.get(location)?.dom
        if (!dom) dom = { getAttribute: name => dom.props[name] ?? null }
        dom.props = result.props; result.dom = dom
        node.props.ref.current = dom
        attached.set(location, { ref: node.props.ref, dom }); used.add(location)
      }
      return result
    }
    tree = materialize(element)
    for (const [key, store] of [...stores]) if (!mounted.has(key)) { for (const slot of store) if (typeof slot?.cleanup === 'function') slot.cleanup(); stores.delete(key) }
    for (const [location, image] of attached) if (!used.has(location)) { image.ref.current = null; attached.delete(location) }
    for (const item of queue.splice(0)) {
      const previous = item.store[item.slot]
      if (typeof previous?.cleanup === 'function') previous.cleanup()
      const cleanup = item.effect()
      item.store[item.slot] = { deps: item.deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined }
    }
    return tree
  }
  async function settle() {
    for (let i = 0; i < 12; i++) {
      await new Promise(resolve => setImmediate(resolve))
      if (!dirty) return tree
      dirty = false; render(lastElement)
    }
    throw new Error('the preview never settled')
  }
  function unmount() { for (const store of stores.values()) for (const slot of store) if (typeof slot?.cleanup === 'function') slot.cleanup(); stores.clear(); attached.clear() }
  return { react, jsx, render, settle, unmount, get tree() { return tree } }
}
function nodes(tree, predicate) {
  const found = []
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (predicate(node)) found.push(node); visit(node.props?.children) }
  visit(tree); return found
}
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'string' ? node : node && typeof node === 'object' ? textOf(node.props?.children) : ''
const imageOf = tree => nodes(tree, n => n.type === 'img')[0]
const statusOf = tree => nodes(tree, n => n.props?.role === 'status')[0]
const describe = tree => ({ src: imageOf(tree)?.props.src ?? null, status: statusOf(tree) ? textOf(statusOf(tree)) : null, busy: statusOf(tree)?.props['aria-busy'] ?? null })
const UNAVAILABLE = { src: null, status: 'Deck preview unavailableNo image is available for this deck.', busy: false }
const LOADING = { src: null, status: 'Loading deck preview…Waiting for the existing slide image.', busy: true }

// ---- the world: real lib, real hook, real component over a fake fetch and a fake Layout URL
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, async json() { if (body === undefined) throw Error('bad json'); return body } })
const answers = body => (url) => url.includes(`/api/presentations/${encodeURIComponent(PID)}/slides/inventory`) ? response(200, body) : response(404, { detail: 'not found' })
function buildWorld({ env = { [FLAG]: 'true' }, overrides = {}, routes = answers(FRESH), layoutUrl = () => LAYOUT } = {}) {
  const runtime = createRuntime()
  const calls = [], timers = [], layoutUrlCalls = []
  const fetch = (url, init) => { calls.push({ url: String(url), init }); return routes(String(url), init) }
  const globals = { process: { env }, URL, AbortController, fetch, setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length }, clearTimeout: () => {} }
  const stageF = load(STAGE_F, {}, {}, overrides)
  const resolver = load(RESOLVER, { './stage-f-thumbnails': stageF }, {}, overrides)
  const rail = load(RAIL, {}, globals, overrides)
  const lib = load(LIB, {}, globals, overrides)
  const hook = load(HOOK, {
    react: runtime.react,
    '@/lib/layout-service-client': { getLayoutServiceUrl: () => { layoutUrlCalls.push(1); return layoutUrl() } },
    '@/lib/slide-rail-identity': rail,
    '@/lib/studio-publish-preview-inventory': lib,
  }, globals, overrides)
  const component = load(COMPONENT, {
    react: runtime.react, 'react/jsx-runtime': { jsx: runtime.jsx, jsxs: runtime.jsx }, 'lucide-react': { ImageIcon: 'ImageIcon' },
    '@/lib/studio-publish-preview': resolver, '@/hooks/use-studio-publish-preview-inventory': hook,
  }, globals, overrides)
  const element = props => runtime.jsx(component.StudioPublishPreview, props)
  return { runtime, calls, timers, layoutUrlCalls, lib, hook, rail, resolver, component, element, mount: props => ({ tree: runtime.render(element(props)), rerender: next => runtime.render(element(next)), settle: () => runtime.settle(), unmount: () => runtime.unmount() }) }
}
// The base component (BASE_COMMIT) over the same resolver and runtime: what "as today" draws.
function buildBase() {
  const runtime = createRuntime()
  const stageF = load(STAGE_F), resolver = load(RESOLVER, { './stage-f-thumbnails': stageF })
  const component = load(COMPONENT, { react: runtime.react, 'react/jsx-runtime': { jsx: runtime.jsx, jsxs: runtime.jsx }, 'lucide-react': { ImageIcon: 'ImageIcon' }, '@/lib/studio-publish-preview': resolver }, {}, {}, baseOf(COMPONENT))
  return { runtime, element: props => runtime.jsx(component.StudioPublishPreview, props), mount: props => ({ tree: runtime.render(runtime.jsx(component.StudioPublishPreview, props)), rerender: next => runtime.render(runtime.jsx(component.StudioPublishPreview, next)), unmount: () => runtime.unmount() }) }
}

// ---- sources for the scenarios
const live = 'https://fixtures.invalid/final-first.png?v=1'
const restored = 'https://fixtures.invalid/restored-first.png'
const owned = { sessionId: 'session-a', ownerSessionId: 'session-a', finalPresentationId: PID } // a deck not built in this tab: no live image, no restored one
const withLive = { ...owned, thumbnailOwnerSessionId: 'session-a', thumbnailUrlsByPresentation: { [PID]: { 0: live } } }
const withRestored = { ...owned, firstSlide: { thumbnail_presentation_id: PID, thumbnail_url: restored, slide_index: 0 } }
const props = (source = owned, sessionId = 'session-a') => ({ sessionId, source })
const inventoryUrl = id => `${LAYOUT}/api/presentations/${encodeURIComponent(id)}/slides/inventory`

// ---- the checks. Each takes a fresh world; `quiet` runs (mutants) collect failures instead of throwing.
const checks = []
const check = (name, fn) => checks.push([name, fn])

check('flag: only the exact string "true" turns it on (unset, "", false, 0, 1, TRUE, " true", "true ", yes)', async ({ overrides }) => {
  for (const value of [undefined, '', 'false', '0', '1', 'TRUE', 'True', ' true', 'true ', 'yes']) {
    const w = buildWorld({ env: value === undefined ? {} : { [FLAG]: value }, overrides })
    assert.equal(w.lib.STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED, false, `flag ${JSON.stringify(value)}`)
    const view = w.mount(props(owned)); await view.settle()
    assert.equal(w.calls.length, 0, `no read for ${JSON.stringify(value)}`)
  }
  assert.equal(buildWorld({ overrides }).lib.STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED, true)
})

check('pure: slide 0 only, and only when fresh, non-null and this presentation\'s own inventory', ({ overrides }) => {
  const { lib } = buildWorld({ overrides })
  const row = (thumbnailUrl, thumbnailStale = false) => ({ thumbnailUrl, thumbnailStale })
  const inv = (presentationId, ...slides) => ({ presentationId, slides })
  assert.equal(lib.publishPreviewInventoryUrl(inv('p', row('https://x.test/a.png')), 'p'), 'https://x.test/a.png')
  assert.equal(lib.publishPreviewInventoryUrl(inv('p', row('https://x.test/a.png', true)), 'p'), null, 'a stale row with its URL still sent')
  assert.equal(lib.publishPreviewInventoryUrl(inv('p', row(null, true)), 'p'), null)
  assert.equal(lib.publishPreviewInventoryUrl(inv('p', row(null)), 'p'), null)
  assert.equal(lib.publishPreviewInventoryUrl(inv('p', row('')), 'p'), null)
  assert.equal(lib.publishPreviewInventoryUrl(inv('p', row('   ')), 'p'), null)
  assert.equal(lib.publishPreviewInventoryUrl(inv('other', row('https://x.test/a.png')), 'p'), null, 'another presentation\'s inventory')
  assert.equal(lib.publishPreviewInventoryUrl(inv('p', row(null, true), row('https://x.test/b.png')), 'p'), null, 'never slide 2\'s image')
  assert.equal(lib.publishPreviewInventoryUrl(inv('p', row(null), row('https://x.test/b.png')), 'p'), null, 'never the first fresh slide')
  assert.equal(lib.publishPreviewInventoryUrl(inv('p'), 'p'), null)
  assert.equal(lib.publishPreviewInventoryUrl(null, 'p'), null); assert.equal(lib.publishPreviewInventoryUrl(undefined, 'p'), null)
})

check('pure: a read is asked for only with the flag, no live or restored image, and this session\'s own Final deck', ({ overrides }) => {
  const w = buildWorld({ overrides }), off = buildWorld({ env: {}, overrides })
  const unavailable = { status: 'unavailable' }
  assert.deepEqual(plain(w.lib.publishPreviewInventoryRequest(unavailable, 'session-a', owned)), { key: JSON.stringify(['session-a', PID]), session: 'session-a', presentationId: PID })
  assert.equal(off.lib.publishPreviewInventoryRequest(unavailable, 'session-a', owned), null)
  for (const base of [{ status: 'loading' }, { status: 'ready', ownerKey: 'k', thumbnailUrl: 'u' }]) assert.equal(w.lib.publishPreviewInventoryRequest(base, 'session-a', owned), null)
  for (const [session, source] of [['session-a', null], ['session-a', {}], [null, owned], ['other', owned], ['session-a', { ...owned, sessionId: 'other' }], ['session-a', { ...owned, ownerSessionId: 'other' }],
    ['session-a', { ...owned, ownerSessionId: null }], ['session-a', { ...owned, finalPresentationId: null }], ['session-a', { ...owned, finalPresentationId: '  ' }]]) {
    assert.equal(w.lib.publishPreviewInventoryRequest(unavailable, session, source), null, JSON.stringify([session, source]))
  }
})

check('pure: the resolved preview: loading while no result, ready with the image, unavailable for null; the base otherwise', ({ overrides }) => {
  const { lib } = buildWorld({ overrides })
  const unavailable = { status: 'unavailable' }, key = JSON.stringify(['session-a', PID])
  assert.deepEqual(plain(lib.resolvePublishPreviewWithInventory(unavailable, 'session-a', owned, {})), { status: 'loading' })
  assert.deepEqual(plain(lib.resolvePublishPreviewWithInventory(unavailable, 'session-a', owned, { [key]: null })), { status: 'unavailable' })
  assert.deepEqual(plain(lib.resolvePublishPreviewWithInventory(unavailable, 'session-a', owned, { [key]: 'https://x.test/a.png' })), { status: 'ready', ownerKey: JSON.stringify(['session-a', PID, 'final', 'https://x.test/a.png']), thumbnailUrl: 'https://x.test/a.png' })
  assert.deepEqual(plain(lib.resolvePublishPreviewWithInventory(unavailable, 'session-a', owned, { [JSON.stringify(['session-a', 'other'])]: 'https://x.test/a.png' })), { status: 'loading' }, 'another deck\'s result is not this deck\'s')
  const ready = { status: 'ready', ownerKey: 'k', thumbnailUrl: 'https://x.test/live.png' }
  assert.equal(lib.resolvePublishPreviewWithInventory(ready, 'session-a', owned, { [key]: 'https://x.test/a.png' }), ready, 'a live or restored image wins')
  assert.equal(lib.resolvePublishPreviewWithInventory(unavailable, 'session-a', null, { [key]: 'https://x.test/a.png' }), unavailable)
})

check('flag on + fresh (RECORDED): one read of the Final deck\'s inventory, loading meanwhile, then slide 1\'s image (src asserted)', async ({ overrides }) => {
  const w = buildWorld({ overrides })
  const view = w.mount(props(owned))
  assert.deepEqual(describe(view.tree), LOADING, 'the existing loading state while the read is in flight')
  assert.equal(w.calls.length, 1)
  assert.equal(w.calls[0].url, inventoryUrl(PID))
  assert.deepEqual(Object.keys(w.calls[0].init).sort(), ['cache', 'signal']); assert.equal(w.calls[0].init.cache, 'no-store')
  const tree = await view.settle()
  assert.equal(imageOf(tree).props.src, FRESH_URL)
  assert.equal(imageOf(tree).props['data-studio-preview-owner'], JSON.stringify(['session-a', PID, 'final', FRESH_URL]))
  assert.equal(imageOf(tree).props.alt, 'First slide of the current Final deck')
  assert.ok(ser(tree).includes('Preview image can lag recent edits.'))
  assert.equal(w.calls.length, 1)
})

check('flag on + fresh: the image loads and fails like any other preview image; no further read', async ({ overrides }) => {
  const w = buildWorld({ overrides })
  const view = w.mount(props(owned)); let tree = await view.settle()
  const img = imageOf(tree); img.props.onLoad({ currentTarget: img.dom })
  tree = view.rerender(props(owned)); assert.ok(nodes(tree, n => n.props['data-preview-status'] === 'ready').length)
  const w2 = buildWorld({ overrides }); const view2 = w2.mount(props(owned)); tree = await view2.settle()
  const img2 = imageOf(tree); img2.props.onError({ currentTarget: img2.dom })
  tree = view2.rerender(props(owned)); assert.equal(imageOf(tree), undefined); assert.ok(ser(tree).includes('The slide image could not be loaded.'))
  assert.equal(w.calls.length, 1); assert.equal(w2.calls.length, 1)
})

check('flag on + slide 0 stale (DERIVED): "Deck preview unavailable" exactly as today, no image', async ({ overrides }) => {
  for (const body of [STALE_0, STALE_WITH_URL]) {
    const w = buildWorld({ overrides, routes: answers(body) }), off = buildWorld({ env: {}, overrides })
    const view = w.mount(props(owned)); const tree = await view.settle()
    assert.deepEqual(describe(tree), UNAVAILABLE); assert.equal(imageOf(tree), undefined)
    assert.equal(ser(tree), ser(off.mount(props(owned)).tree), 'the same tree as the flag-off preview')
    assert.equal(w.calls.length, 1)
  }
})

check('flag on + slide 0 has no registered thumbnail (DERIVED): unavailable exactly as today; so does a deck with none at all, and an empty deck', async ({ overrides }) => {
  for (const body of [NONE_0, NONE_ALL, EMPTY_DECK]) {
    const w = buildWorld({ overrides, routes: answers(body) }), off = buildWorld({ env: {}, overrides })
    const tree = await w.mount(props(owned)).settle()
    assert.deepEqual(describe(tree), UNAVAILABLE)
    assert.equal(ser(tree), ser(off.mount(props(owned)).tree))
  }
})

check('flag on: only slide 0 counts. Stale slide 0 with fresh slides after it (DERIVED) is unavailable; fresh slide 0 with a stale slide 1 shows slide 0\'s own image', async ({ overrides }) => {
  assert.equal(STALE_0.slides.filter(slide => slide.thumbnail_url).length, 3, 'slides 1-3 are fresh in the derived deck')
  const stale = buildWorld({ overrides, routes: answers(STALE_0) })
  assert.deepEqual(describe(await stale.mount(props(owned)).settle()), UNAVAILABLE)
  const fresh = buildWorld({ overrides, routes: answers(FRESH_0_STALE_1) })
  assert.equal(describe(await fresh.mount(props(owned)).settle()).src, FRESH_URL)
  const second = buildWorld({ overrides, routes: answers(RECORDED_EDIT) })
  assert.equal(describe(await second.mount(props(owned)).settle()).src, RECORDED_EDIT.slides[0].thumbnail_url)
  assert.notEqual(RECORDED.slides[1].thumbnail_url, FRESH_URL)
})

check('flag on + a live Stage F image: no read at all, and the preview is the flag-off one', async ({ overrides }) => {
  const w = buildWorld({ overrides }), off = buildWorld({ env: {}, overrides })
  const view = w.mount(props(withLive)); const tree = await view.settle()
  assert.equal(w.calls.length, 0); assert.equal(imageOf(tree).props.src, live)
  assert.equal(ser(tree), ser(off.mount(props(withLive)).tree))
})

check('flag on + a restored thumbnail (thumbnail_url + matching thumbnail_presentation_id): no read at all', async ({ overrides }) => {
  const w = buildWorld({ overrides }), off = buildWorld({ env: {}, overrides })
  const tree = await w.mount(props(withRestored)).settle()
  assert.equal(w.calls.length, 0); assert.equal(imageOf(tree).props.src, restored)
  assert.equal(ser(tree), ser(off.mount(props(withRestored)).tree))
})

check('precedence: live, then restored, then inventory. Live and restored together show live; the inventory\'s image never replaces either', async ({ overrides }) => {
  const w = buildWorld({ overrides })
  assert.equal(imageOf(await w.mount(props({ ...withLive, firstSlide: withRestored.firstSlide })).settle()).props.src, live)
  const w2 = buildWorld({ overrides, routes: answers(FRESH) })
  assert.equal(imageOf(await w2.mount(props(withRestored)).settle()).props.src, restored)
  assert.equal(w.calls.length + w2.calls.length, 0)
  const w3 = buildWorld({ overrides })
  assert.equal(imageOf(await w3.mount(props(owned)).settle()).props.src, FRESH_URL, 'the inventory is the last resort')
})

check('a live image that lands while the read is in flight wins, and the late inventory answer does not replace it', async ({ overrides }) => {
  let release
  const w = buildWorld({ overrides, routes: () => new Promise(resolve => { release = () => resolve(response(200, FRESH)) }) })
  const view = w.mount(props(owned)); assert.deepEqual(describe(view.tree), LOADING)
  let tree = view.rerender(props(withLive)); assert.equal(imageOf(tree).props.src, live)
  release(); tree = await view.settle()
  assert.equal(imageOf(tree).props.src, live); assert.equal(w.calls.length, 1)
})

check('inventory for ANOTHER presentation id is not used (the reader\'s own check, and a body that names a different deck)', async ({ overrides }) => {
  const w = buildWorld({ overrides, routes: () => response(200, FRESH) }) // whatever deck is asked, the body says it belongs to PID
  const tree = await w.mount(props({ ...owned, finalPresentationId: 'another-final' })).settle()
  assert.deepEqual(describe(tree), UNAVAILABLE); assert.equal(imageOf(tree), undefined)
  assert.equal(w.calls[0].url, inventoryUrl('another-final'))
})

check('failed reads are the unavailable state, never a broken image: network error, HTTP 500/401/404/405, invalid JSON, invalid body, a hung read', async ({ overrides }) => {
  const cases = {
    network: () => { throw new Error('offline') }, rejected: () => Promise.reject(new Error('offline')),
    http500: () => response(500, { detail: 'x' }), http401: () => response(401, {}), http404: () => response(404, {}), http405: () => response(405, {}),
    badJson: () => response(200, undefined), notInventory: () => response(200, { hello: 'world' }), wrongCount: () => response(200, { ...plain(FRESH), slide_count: 99 }),
  }
  for (const [name, routes] of Object.entries(cases)) {
    const w = buildWorld({ overrides, routes })
    const tree = await w.mount(props(owned)).settle()
    assert.deepEqual(describe(tree), UNAVAILABLE, name); assert.equal(imageOf(tree), undefined, `${name}: no image element`)
    assert.equal(w.calls.length, 1, name)
  }
  const hung = buildWorld({ overrides, routes: (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) })
  const view = hung.mount(props(owned)); await view.settle(); assert.deepEqual(describe(hung.runtime.tree), LOADING)
  const timer = hung.timers.find(item => item.ms === 8000); assert.ok(timer, 'the read ends after 8 s')
  timer.fn(); const tree = await view.settle()
  assert.deepEqual(describe(tree), UNAVAILABLE); assert.equal(imageOf(tree), undefined)
  const misconfigured = buildWorld({ overrides, layoutUrl: () => { throw new Error('NEXT_PUBLIC_LAYOUT_SERVICE_URL is not set') } })
  const t2 = await misconfigured.mount(props(owned)).settle()
  assert.deepEqual(describe(t2), UNAVAILABLE); assert.equal(misconfigured.calls.length, 0, 'no request without a Layout URL')
})

check('the read goes through the rail\'s reader and Layout URL only: one GET of /slides/inventory, nothing else leaves', async ({ overrides }) => {
  const w = buildWorld({ overrides, layoutUrl: () => `${LAYOUT}/` })
  const view = w.mount(props({ ...owned, finalPresentationId: PID })); await view.settle(); view.rerender(props(owned)); await view.settle()
  assert.equal(w.layoutUrlCalls.length, 1)
  assert.deepEqual(plain(w.calls.map(call => call.url)), [inventoryUrl(PID)])
  assert.equal(Object.hasOwn(w.calls[0].init, 'method'), false); assert.equal(Object.hasOwn(w.calls[0].init, 'headers'), false); assert.equal(Object.hasOwn(w.calls[0].init, 'body'), false)
  const odd = buildWorld({ overrides, routes: () => response(404, {}) }); await odd.mount(props({ ...owned, finalPresentationId: 'a/b c' })).settle()
  assert.equal(odd.calls[0].url, `${LAYOUT}/api/presentations/a%2Fb%20c/slides/inventory`)
})

check('one read per session + Final deck: re-renders, the same source rebuilt, the image\'s load and a settled result never read again', async ({ overrides }) => {
  const w = buildWorld({ overrides })
  const view = w.mount(props(owned)); view.rerender(props({ ...owned })); view.rerender(props({ ...owned, firstSlide: null }))
  await view.settle(); view.rerender(props({ ...owned })); await view.settle()
  const img = imageOf(view.rerender(props(owned))); img.props.onLoad({ currentTarget: img.dom }); view.rerender(props(owned)); await view.settle()
  assert.equal(w.calls.length, 1)
  const stale = buildWorld({ overrides, routes: answers(STALE_0) }); const sv = stale.mount(props(owned)); await sv.settle(); sv.rerender(props(owned)); await sv.settle(); sv.rerender(props({ ...owned })); await sv.settle()
  assert.equal(stale.calls.length, 1, 'a stale answer is not asked again either')
  const failed = buildWorld({ overrides, routes: () => response(500, {}) }); const fv = failed.mount(props(owned)); await fv.settle(); fv.rerender(props(owned)); await fv.settle()
  assert.equal(failed.calls.length, 1, 'a failed read is not retried')
})

check('a result for one deck is never shown for another: the read in flight when the Final deck changes lands on its own deck only', async ({ overrides }) => {
  const pending = new Map()
  const w = buildWorld({ overrides, routes: url => new Promise(resolve => pending.set(url, () => resolve(response(200, url.includes(PID) ? FRESH : { ...plain(FRESH), presentation_id: 'deck-b', slides: plain(FRESH).slides.map(s => ({ ...s, thumbnail_url: OTHER_URL })) })))) })
  const view = w.mount(props(owned)); assert.deepEqual(describe(view.tree), LOADING)
  let tree = view.rerender(props({ ...owned, finalPresentationId: 'deck-b' })); assert.deepEqual(describe(tree), LOADING, 'deck B waits for its own read')
  assert.equal(w.calls.length, 2)
  pending.get(inventoryUrl(PID))(); tree = await view.settle()
  assert.deepEqual(describe(tree), LOADING, 'deck A\'s answer does not stand in for deck B')
  pending.get(inventoryUrl('deck-b'))(); tree = await view.settle()
  assert.equal(describe(tree).src, OTHER_URL)
  tree = view.rerender(props({ ...owned, finalPresentationId: 'deck-b' })); assert.equal(describe(tree).src, OTHER_URL)
})

check('the session\'s gates hold before any read: another session, another held-deck owner, no Final id, no source, generating Final', async ({ overrides }) => {
  for (const [name, p] of Object.entries({
    noSource: props(null), emptySource: props({}), otherSession: props(owned, 'other'), otherSourceSession: props({ ...owned, sessionId: 'other' }), otherOwner: props({ ...owned, ownerSessionId: 'other' }),
    noOwner: props({ ...owned, ownerSessionId: null }), noFinalId: props({ ...owned, finalPresentationId: null }), generating: props({ ...owned, loading: true }),
  })) {
    const w = buildWorld({ overrides }), off = buildWorld({ env: {}, overrides })
    const tree = await w.mount(p).settle()
    assert.equal(w.calls.length, 0, name)
    assert.equal(ser(tree), ser(off.mount(p).tree), `${name}: the flag-off tree`)
  }
  assert.deepEqual(describe(buildWorld({ overrides }).mount(props({ ...owned, loading: true })).tree), LOADING, 'generating Final keeps its own loading state')
})

check('flag off: no read at all, and the component draws byte for byte what BASE_COMMIT\'s draws (hashed), in every state', async ({ overrides }) => {
  const scenarios = [['live', withLive], ['restored', withRestored], ['live+restored', { ...withLive, firstSlide: withRestored.firstSlide }], ['no image, owned deck', owned], ['no source', null], ['generating', { ...owned, loading: true }], ['other session', { ...owned, sessionId: 'x' }]]
  const baseHash = [], headHash = []
  for (const [name, source] of scenarios) {
    for (const env of [{}, { [FLAG]: 'false' }, { [FLAG]: 'TRUE' }, { [FLAG]: '1' }]) {
      const base = buildBase(), w = buildWorld({ env, overrides })
      const a = base.mount(props(source)), b = w.mount(props(source))
      const bTree = await b.settle()
      assert.equal(ser(b.tree), ser(a.tree), `${name}: first draw`)
      assert.equal(ser(bTree), ser(a.tree), `${name}: settled`)
      const imgA = imageOf(a.tree), imgB = imageOf(bTree)
      if (imgA) { imgA.props.onLoad({ currentTarget: imgA.dom }); imgB.props.onLoad({ currentTarget: imgB.dom }) }
      assert.equal(ser(b.rerender(props(source))), ser(a.rerender(props(source))), `${name}: after the image loads`)
      assert.equal(w.calls.length, 0, `${name}: no read with the flag off`); assert.equal(w.layoutUrlCalls.length, 0)
      if (env === undefined || Object.keys(env).length === 0) { baseHash.push(sha(ser(a.tree))); headHash.push(sha(ser(bTree))) }
    }
  }
  assert.deepEqual(headHash, baseHash)
  if (!overrides.__quiet) console.log(`  flag off, ${scenarios.length} states: sha256 of the drawn trees, base ${sha(baseHash.join()).slice(0, 16)} == head ${sha(headHash.join()).slice(0, 16)}`)
})

check('the new files make no other kind of call: one fetch (inside the rail\'s reader), no other transport, storage or generation; the component and resolver still make none', () => {
  const callsOf = (rel, pattern) => {
    const ast = ts.createSourceFile(rel, fs.readFileSync(path.join(root, rel), 'utf8'), ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const found = []
    const visit = node => { if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && pattern.test(node.expression.getText(ast))) found.push(node.expression.getText(ast)); ts.forEachChild(node, visit) }
    visit(ast); return found
  }
  assert.deepEqual(callsOf(HOOK, /^fetch$/), ['fetch'])
  for (const rel of [LIB, COMPONENT, RESOLVER]) assert.deepEqual(callsOf(rel, /fetch|postMessage|localStorage|sessionStorage|generate|createObjectURL/i), [], rel)
  for (const rel of [HOOK, LIB]) assert.deepEqual(callsOf(rel, /XMLHttpRequest|sendBeacon|EventSource|WebSocket|^Image$|localStorage|sessionStorage|indexedDB|BroadcastChannel|postMessage/), [], rel)
  const hook = fs.readFileSync(path.join(root, HOOK), 'utf8')
  assert.ok(hook.includes("from '@/lib/slide-rail-identity'") && hook.includes('fetchSlideInventory(') && hook.includes("from '@/lib/layout-service-client'") && hook.includes('getLayoutServiceUrl()'))
  assert.equal((hook.match(/fetchImpl:/g) ?? []).length, 1)
})

// ---- the strip and the scope (run once, on the working tree)
function stripChecks() {
  const out = []
  const test = (name, fn) => { fn(); out.push(name) }
  test('stripping this change gives back BASE_COMMIT\'s .env.example and component byte for byte', () => {
    for (const rel of PUBLISH_PREVIEW_INVENTORY_FILES) {
      const head = fs.readFileSync(path.join(root, rel), 'utf8')
      assert.notEqual(head, baseOf(rel), `${rel} is changed`)
      assert.equal(sha(stripPublishPreviewInventory(rel, head)), sha(baseOf(rel)), rel)
      for (const [added] of PUBLISH_PREVIEW_INVENTORY_CHANGES[rel]) assert.equal(head.split(added).length - 1, 1, `${rel}: each pair occurs once`)
    }
    assert.equal(stripPublishPreviewInventory('app/builder/page.tsx', 'x'), 'x')
  })
  test('the .env.example block sits right before "# PASS2 ADMIN", after the last FRONTEND-2 block, and defaults the flag to "false"', () => {
    const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8'), lines = env.split('\n')
    const at = lines.findIndex(line => line.startsWith(`${FLAG}=`))
    assert.ok(at > 0); assert.equal(lines[at], `${FLAG}="false"`); assert.equal(lines[at + 1], ''); assert.ok(lines[at + 2].startsWith('# PASS2 ADMIN'))
    assert.equal(env.split(`${FLAG}=`).length - 1, 1)
    const handoff = lines.findIndex(line => line.startsWith('NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND='))
    assert.ok(handoff > 0 && handoff < at, 'after the new-deck handoff block')
    assert.equal(lines.slice(handoff + 1, at).findIndex(line => /^[A-Z][A-Z0-9_]*=/.test(line)), -1, 'no other flag between them')
  })
  test('the new files are new, and the resolver, the inventory reader, the Layout client and the Publish call sites (FRONTEND-1\'s code) are untouched', () => {
    for (const rel of [HOOK, LIB]) { assert.throws(() => baseOf(rel)); assert.ok(PUBLISH_PREVIEW_INVENTORY_NEW_FILES.includes(rel)) }
    for (const rel of [RESOLVER, RAIL, 'lib/layout-service-client.ts', STAGE_F, 'components/publish-wizard.tsx', 'components/publish-dialog.tsx', 'components/studio-publish-viewer-summary.tsx', 'components/builder/presentation-area.tsx']) {
      assert.equal(fs.readFileSync(path.join(root, rel), 'utf8'), baseOf(rel), rel)
    }
  })
  test('the base component is the only part of it that changed: the diff is one import and one call', () => {
    const head = fs.readFileSync(path.join(root, COMPONENT), 'utf8').split('\n'), base = baseOf(COMPONENT).split('\n')
    assert.equal(head.length - base.length, 3)
    assert.equal(head.filter(line => !base.includes(line)).length, 4) // the import, `resolved`, the comment, the hook call
  })
  return out
}

// ---- mutants: [name, [[file, from, to], ...]]; each `from` occurs once; every mutant must fail at least one check
const MUTANTS = [
  ['flag defaults on', [[LIB, "=== 'true'", "!== 'false'"]]],
  ['flag spelling: TRUE / True also turns it on', [[LIB, "=== 'true'", ".toLowerCase() === 'true'"]]],
  ['flag spelling: any non-empty value turns it on', [[LIB, "process.env.NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED === 'true'", "Boolean(process.env.NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED)"]]],
  ['the stale guard dropped', [[LIB, 'first.thumbnailStale || ', '']]],
  ['the ownership check dropped (another presentation\'s inventory is used)', [[LIB, 'if (!inventory || inventory.presentationId !== presentationId) return null', 'if (!inventory) return null']]],
  ['precedence reversed: the inventory is asked for even with a live or restored image', [[LIB, "if (base.status !== 'unavailable') return null\n", '']]],
  ['a read made with the flag off', [[LIB, 'if (!STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED) return null\n', '']]],
  ['the deck is read more than once (no dedupe, the effect runs every render)', [[HOOK, 'if (!request || askedRef.current === request.key) return', 'if (!request) return'], [HOOK, '}, [key])', '})']]],
  ['slide index is not 0 (the first fresh slide of the deck)', [[LIB, 'const first = inventory.slides[0]', 'const first = inventory.slides.find(slide => slide.thumbnailUrl && !slide.thumbnailStale) ?? inventory.slides[0]']]],
  ['slide index is not 0 (slide 2)', [[LIB, 'const first = inventory.slides[0]', 'const first = inventory.slides[1]']]],
  ['the error path shows a broken image', [[LIB, "if (!thumbnailUrl) return { status: 'unavailable' }", "if (!thumbnailUrl) return { status: 'ready', ownerKey: request.key, thumbnailUrl: 'about:blank' }"]]],
  ['the loading state is dropped (the unavailable state shows while the read is in flight)', [[LIB, "return { status: 'loading' }", "return { status: 'unavailable' }"]]],
  ['the request key ignores the Final deck (one deck\'s answer serves another)', [[LIB, 'key: JSON.stringify([session, presentationId])', 'key: JSON.stringify([session])']]],
  ['the held-deck owner is not checked before a read', [[LIB, "nonempty(source?.ownerSessionId) !== session || ", '']]],
  ['the session is not checked before a read', [[LIB, "nonempty(source?.sessionId) !== session || ", '']]],
  ['the read has no time limit', [[HOOK, 'const timer = abort ? setTimeout(() => abort.abort(), INVENTORY_TIMEOUT_MS) : null', 'const timer = null']]],
  ['a second transport: the reader is bypassed for a bare fetch', [[HOOK, 'const result = await fetchSlideInventory({', 'await fetch(`/x/${presentationId}`); const result = await fetchSlideInventory({']]],
  ['the component ignores the hook (the inventory is never used)', [[COMPONENT, 'const preview = useStudioPublishPreviewInventory(sessionId, source, resolved)', 'const preview = resolved']]],
]
function applyMutant(replacements) {
  const overrides = { __quiet: true }
  for (const [rel, from, to] of replacements) {
    const previous = overrides[rel]
    overrides[rel] = text => {
      const base = previous ? previous(text) : text
      assert.equal(base.split(from).length - 1, 1, `mutant target occurs once in ${rel}: ${from.slice(0, 60)}`)
      return base.replace(from, () => to)
    }
  }
  return overrides
}

async function runAll(overrides, { quiet }) {
  const failures = []
  for (const [name, fn] of checks) {
    try { await fn({ overrides }); if (!quiet) console.log(`PASS ${name}`) } catch (error) { failures.push([name, error]); if (!quiet) console.error(`FAIL ${name}\n  ${String(error?.stack ?? error).split('\n').slice(0, 4).join('\n  ')}`) }
  }
  return failures
}

const failures = await runAll({}, { quiet: false })
let passed = checks.length - failures.length
for (const name of stripChecks()) { console.log(`PASS ${name}`); passed++ }
if (failures.length) { console.error(`${failures.length} failed`); process.exit(1) }

// the mutants must each be killed (and each target must exist: applyMutant asserts it)
if (!process.env.PUBLISH_PREVIEW_INVENTORY_NO_MUTANTS) {
  const survived = []
  for (const [name, replacements] of MUTANTS) {
    const killed = await runAll(applyMutant(replacements), { quiet: true })
    if (!killed.length) survived.push(name)
    else console.log(`KILLED ${name}: ${killed.length} check(s), first: ${killed[0][0].slice(0, 70)}`)
  }
  // strip mutants: a strip that puts the wrong text back, and an env block moved after "# PASS2 ADMIN"
  const envHead = fs.readFileSync(path.join(root, '.env.example'), 'utf8')
  const wrong = stripPublishPreviewInventory('.env.example', envHead).replace('# PASS2 ADMIN', '# PASS2 ADMIN ')
  if (sha(wrong) === sha(baseOf('.env.example'))) survived.push('strip puts the wrong text back')
  else console.log('KILLED strip puts the wrong text back')
  const componentHead = fs.readFileSync(path.join(root, COMPONENT), 'utf8')
  const brokenStrip = componentHead.replace('const resolved = resolveStudioPublishPreview(sessionId, source)', 'const resolved = resolveStudioPublishPreview(sessionId, source) ')
  if (sha(stripPublishPreviewInventory(COMPONENT, brokenStrip)) === sha(baseOf(COMPONENT))) survived.push('strip ignores an edited pair')
  else console.log('KILLED strip ignores an edited pair')
  if (survived.length) { console.error(`SURVIVED mutants: ${survived.join('; ')}`); process.exit(1) }
  console.log(`${MUTANTS.length + 2} mutants killed`)
}
console.log(`${passed} Publish-preview inventory checks passed${process.env.PUBLISH_PREVIEW_INVENTORY_NO_MUTANTS ? ' (mutants skipped)' : ''}; no browser, network or write.`)
