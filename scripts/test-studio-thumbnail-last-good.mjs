// FRONTEND-2: proof for the Studio half of the THUMBNAILS-BLANK-UAT "never blank" contract (NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD, default off).
//   Layout (COMPOSER-2, LAYOUT_THUMBNAIL_LAST_GOOD_ENABLED) adds two ADDITIVE keys to each slide-inventory row: last_good_thumbnail_url (the slide's last registered preview, fresh or stale) and
//   thumbnail_stale_reason ("content" | "theme" | null). With Layout's flag off both are ABSENT and read as null here.
//   Rail:     thumbnail_url when non-null; otherwise the slide's OWN last good image with a small "May lag" cue and an accessible label ("Preview may not show recent edits" for content, null and
//             unknown reasons; "Preview shows the previous theme" for theme); otherwise today's card (pending spinner or "No preview").
//   Publish:  with BOTH this flag and #495's (NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED) on, slide 0 with no fresh image falls back to its last good one; #495's flag alone keeps its fresh-only rule;
//             this flag alone makes no read at all.
// Plain node, no browser, no network, no services, no paid call, one process: the real TypeScript is transpiled and run in a vm; the rail is the REAL SlideThumbnailStrip server-rendered with react-dom, the
// Publish preview is the REAL hook and component over a fake fetch and a small hooks runtime. The look is judged from the real stylesheet and the rail's own colour tokens (contrast in light and dark), because no
// browser is allowed here: the before / after PNGs are the caller's (the steps are in the report).
//   RECORDED  scripts/fixtures/thumbnail-last-good/*.json: Layout's REAL inventory responses (COMPOSER-2's branch seat2/layout-thumbnail-last-good @ 52034e7, run through its real inventory code by its
//             identity replay; evidence streams: composer2-layout-lastgood-renders/identity/branch2_canon-true_lg-true.json (sha256 a5237c9d...) and branch2_canon-unset_lg-unset.json (sha256 78afac3b...)):
//             inventory-lg-nothing-registered (step 0: every row none, both keys present and null), inventory-lg-registered (step 12: every row fresh), inventory-lg-stale-content (step 15 "after an edit":
//             slides 0 and 1 stale with reason content and a last good image, the rest fresh), inventory-lg-off-registered (flag off, step 12) and inventory-lg-off-stale (flag off, step 13: slides stale, keys ABSENT).
//   DERIVED   Layout's replay has no deck-theme change, so reason "theme" is derived from the recorded stale-content body (only slide 0's thumbnail_stale_reason is replaced); the rows with no last good image, a
//             nothing-registered slide 0 beside a stale slide 1, and a fresh row whose last good differs are the recorded bodies with only the named fields replaced. Every use below says so.
//   1. flag      exact "true" only, read in the two modules that read it (and nowhere else)
//   2. parse     the two keys, absent = null, only http(s), only the two reasons
//   3. rows      fresh / stale-content / stale-theme / none / absent keys / no last good / a fresh image wins / never another slide's image
//   4. rail      the real strip: the cue, its labels, its place in the card; today's cards untouched
//   5. poll      the real controller republishes a change of only the last good image or the reason
//   6. publish   the real hook and component: both flags, one flag, the other flag, nothing
//   7. look      the stylesheet (scope, tokens, no pointer events) and its contrast in light and dark
//   8. flag off  rows, strip markup and Publish results are the base commit's: same output, hashed
//   9. change    strip = BASE_COMMIT byte for byte, the roots, .env.example, scope (the COMMITTED diff only), secret scan, no new request
//  10. mutants   each one must make sections 1-9 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { BASE_COMMIT, THUMBNAIL_LAST_GOOD_CHANGES, THUMBNAIL_LAST_GOOD_FILES, THUMBNAIL_LAST_GOOD_NEW_FILES, THUMBNAIL_LAST_GOOD_PIN_FILES, stripThumbnailLastGood } from './studio-thumbnail-last-good-strip.mjs'
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { STACKED_PASS3_FILES } from './studio-library-manage-harness.mjs'
import { stripBulkEditUndo, BULK_EDIT_UNDO_FILES, BULK_EDIT_UNDO_NEW_FILES, BULK_EDIT_UNDO_PIN_FILES } from './studio-bulk-edit-undo-strip.mjs' // stacked: bulk edit + chat undo (a whole-deck edit card and an Undo chip in chat), after this change in the stack

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const BASE = process.env.THUMBNAIL_LAST_GOOD_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const baseCache = new Map()
const baseOf = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE}:${rel}`)); return baseCache.get(rel) }
let overrides = {} // in-memory mutations: the suite reads every source through read()
const read = rel => (rel in overrides ? overrides[rel] : stripBulkEditUndo(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) // stacked: bulk edit + chat undo (after this change in the stack) adds its .env.example block and marked lines to files this proof reads; it reads past them
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))

const RAIL = 'lib/slide-rail-identity.ts', PUBLIB = 'lib/studio-publish-preview-inventory.ts', HOOK = 'hooks/use-studio-publish-preview-inventory.ts', COMPONENT = 'components/studio-publish-preview.tsx'
const RESOLVER = 'lib/studio-publish-preview.ts', STAGE_F = 'lib/stage-f-thumbnails.ts'
const STRIP = 'components/slide-thumbnail-strip.tsx', CUE = 'components/studio-thumbnail-lag-cue.tsx', LIB = 'lib/studio-thumbnail-last-good.ts', CSS = 'components/studio-thumbnail-last-good.css', THUMB_CSS = 'components/studio-thumbnails.css'
const ENV = '.env.example', HARNESS = 'scripts/studio-library-manage-harness.mjs', STRIP_MODULE = 'scripts/studio-thumbnail-last-good-strip.mjs'
const ROOTS = ['scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs']
const LG = 'NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD', PUB = 'NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED'
const MISSPELLED = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n']
const LABEL_CONTENT = 'Preview may not show recent edits', LABEL_THEME = 'Preview shows the previous theme', CUE_TEXT = 'May lag'
const LAYOUT = 'https://layout.example.test'

// ---------------------------------------------------------------- fixtures
const fixture = name => JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/thumbnail-last-good', `${name}.json`), 'utf8'))
const NOTHING = fixture('inventory-lg-nothing-registered') // RECORDED
const REGISTERED = fixture('inventory-lg-registered') // RECORDED
const STALE = fixture('inventory-lg-stale-content') // RECORDED
const OFF_REGISTERED = fixture('inventory-lg-off-registered') // RECORDED (Layout's flag off: keys absent)
const OFF_STALE = fixture('inventory-lg-off-stale') // RECORDED (Layout's flag off: keys absent)
const PID = STALE.presentation_id
const IDS = STALE.slides.map(slide => slide.slide_id)
const mapRows = (inventory, change) => ({ ...plain(inventory), slides: plain(inventory).slides.map((slide, index) => ({ ...slide, ...(change(slide, index) ?? {}) })) })
const STALE_THEME = mapRows(STALE, (_slide, index) => index === 0 ? { thumbnail_stale_reason: 'theme' } : null) // DERIVED: slide 0's reason is theme, slide 1's stays content
const NO_LAST_GOOD = mapRows(STALE, (_slide, index) => index === 0 ? { last_good_thumbnail_url: null } : null) // DERIVED: slide 0 stale, the stored URL no longer usable (Layout: last good null, reason content)
const NONE_0_STALE_1 = mapRows(STALE, (slide, index) => index === 0 ? { ...pickKeys(NOTHING.slides[0], ['thumbnail_url', 'thumbnail_stale', 'thumbnail_status', 'last_good_thumbnail_url', 'thumbnail_stale_reason']) } : null) // DERIVED: slide 0 from the recorded none row, slide 1 stays stale with a last good image
const FRESH_WINS = mapRows(REGISTERED, (_slide, index) => index === 2 ? { last_good_thumbnail_url: 'https://fixtures.invalid/not-the-fresh-one.png' } : null) // DERIVED: a fresh row whose last good differs (the contract says they are equal; a fresh image must win anyway)
const NO_REASON = mapRows(STALE, (_slide, index) => index === 0 ? { thumbnail_stale_reason: null } : null) // DERIVED: stale, last good present, reason null
const UNKNOWN_REASON = mapRows(STALE, (_slide, index) => index === 0 ? { thumbnail_stale_reason: 'palette' } : null) // DERIVED: a reason a later Layout may add
const BAD_URLS = ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://fixtures.invalid/x.png', '/relative.png', 'not a url', '', '   ', 5, {}, []] // DERIVED values for slide 0's last good image
function pickKeys(object, keys) { return Object.fromEntries(keys.map(key => [key, object[key]])) }
const ALL = { NOTHING, REGISTERED, STALE, STALE_THEME, NO_LAST_GOOD, NONE_0_STALE_1, FRESH_WINS, NO_REASON, UNKNOWN_REASON, OFF_REGISTERED, OFF_STALE }
function fixtureFacts() { // what the recorded bodies are, so a re-recorded fixture cannot slip a different shape in
  for (const inventory of [NOTHING, REGISTERED, STALE]) for (const slide of inventory.slides) assert.ok('last_good_thumbnail_url' in slide && 'thumbnail_stale_reason' in slide, 'recorded flag-on rows carry both keys')
  for (const inventory of [OFF_REGISTERED, OFF_STALE]) for (const slide of inventory.slides) assert.ok(!('last_good_thumbnail_url' in slide) && !('thumbnail_stale_reason' in slide), 'recorded flag-off rows carry neither key')
  assert.equal(STALE.slide_count, 7); assert.deepEqual(STALE.slides.map(s => s.thumbnail_status), ['stale', 'stale', 'fresh', 'fresh', 'fresh', 'fresh', 'fresh'])
  for (const index of [0, 1]) {
    const row = STALE.slides[index]
    assert.equal(row.thumbnail_url, null); assert.equal(row.thumbnail_stale, true); assert.equal(row.thumbnail_stale_reason, 'content'); assert.match(row.last_good_thumbnail_url, /^https:\/\/cdn\.test\/thumbs\/slide_[0-9a-f]{12}(-2)?\.png$/)
  }
  for (const slide of STALE.slides.slice(2)) { assert.equal(slide.thumbnail_url, slide.last_good_thumbnail_url); assert.equal(slide.thumbnail_stale_reason, null) }
  assert.ok(REGISTERED.slides.every(slide => slide.thumbnail_status === 'fresh' && slide.thumbnail_url === slide.last_good_thumbnail_url))
  assert.ok(NOTHING.slides.every(slide => slide.thumbnail_status === 'none' && slide.thumbnail_url === null && slide.last_good_thumbnail_url === null && slide.thumbnail_stale_reason === null))
  assert.equal(OFF_STALE.slides[0].thumbnail_stale, true); assert.equal(OFF_STALE.slides[0].thumbnail_url, null)
  for (const inventory of [STALE, REGISTERED, NOTHING, OFF_STALE, OFF_REGISTERED]) for (const slide of inventory.slides) if (slide.thumbnail_url || slide.last_good_thumbnail_url) assert.ok(String(slide.thumbnail_url ?? slide.last_good_thumbnail_url).includes(slide.slide_id), 'a recorded image URL names its own slide')
}

// ---------------------------------------------------------------- loading
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
function load(rel, { deps = {}, env = {}, globals = {}, text } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(rel, text ?? read(rel)), { module, exports: module.exports, process: { env }, URL, AbortController, Map, Set, JSON, Date, Number, Object, Array, Promise, Error, encodeURIComponent, setTimeout, clearTimeout, ...globals,
    require: name => { if (Object.hasOwn(deps, name)) return deps[name]; throw new Error(`Unexpected dependency ${name} in ${rel}`) } })
  return module.exports
}
const rail = (env = {}, text) => load(RAIL, { env, text }) // the inventory reader, import-free
const pub = (env = {}, text) => load(PUBLIB, { env, text }) // #495's resolver, import-free at run time (its imports are types)
const on = { [LG]: 'true' }, both = { [LG]: 'true', [PUB]: 'true' }, only495 = { [PUB]: 'true' }
// results come back as plain data (the vm has its own Array and Object), so they compare with deepEqual
const parsedOf = (lib, inventory, id = PID) => plain(lib.parseSlideInventory(plain(inventory), id))
const rowsOf = (lib, inventory) => plain(lib.buildRailRows(lib.parseSlideInventory(plain(inventory), inventory.presentation_id), new Map()))
const bareRows = rows => plain(rows)

// the real strip, server-rendered: a transpile-on-require loader for the repo's files (with `texts` overriding any of them) and node_modules as installed
process.env.NEXT_PUBLIC_STUDIO_V4_SHELL = 'true' // the strip reads it at load: the Studio rendering is the one this serves
function stripWorld(texts = {}) {
  const registry = new Map()
  const textOf = file => { const rel = path.relative(root, file); return rel in texts ? texts[rel] : rel in overrides ? overrides[rel] : fs.readFileSync(file, 'utf8') }
  function loadTs(file) {
    if (registry.has(file)) return registry.get(file).exports
    const module = { exports: {} }; registry.set(file, module)
    const resolve = (spec, from) => {
      const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec)
      for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext
      throw Error(`unresolved ${spec} from ${path.relative(root, from)}`)
    }
    const req = spec => spec.endsWith('.css') ? {} : spec.startsWith('@/') || spec.startsWith('.') ? loadTs(resolve(spec, file)) : nodeRequire(spec)
    vm.runInThisContext(`(function(exports, require, module, __filename){${compile(path.relative(root, file), textOf(file))}\n})`, { filename: file })(module.exports, req, module, file)
    return module.exports
  }
  return { ...loadTs(path.join(root, STRIP)), cue: () => loadTs(path.join(root, CUE)) }
}
const React = nodeRequire('react'), { renderToStaticMarkup } = nodeRequire('react-dom/server')
const renderStrip = (world, slides, extra = {}) => renderToStaticMarkup(React.createElement(world.SlideThumbnailStrip, { slides, currentSlide: 1, onSlideClick() {}, orientation: 'vertical', totalSlides: slides.length, keyBySlideId: true, ...extra }))
const cardsOf = html => html.split('data-studio-thumbnail-card="true"').slice(1)
const cueIn = card => card.match(/<span class="studio-thumbnail-lag-cue"[^>]*>/g) ?? []
const labelOf = card => (card.match(/<span class="studio-thumbnail-lag-cue" data-studio-thumbnail-lag="[a-z]+" role="img" aria-label="([^"]*)"/) ?? [])[1] ?? null
const srcOf = card => (card.match(/<img[^>]*\ssrc="([^"]*)"/) ?? [])[1] ?? null
const BASE_STRIP = () => stripWorld({ [STRIP]: baseOf(STRIP) }) // what the rail draws at the base commit

// ---------------------------------------------------------------- a small hooks runtime, the real Publish hook and component, and a fake Layout (as #495's proof does)
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
    lastElement = element; queue.length = 0
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
        dom.props = result.props; result.dom = dom; node.props.ref.current = dom
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
    for (let i = 0; i < 12; i++) { await new Promise(resolve => setImmediate(resolve)); if (!dirty) return tree; dirty = false; render(lastElement) }
    throw new Error('the preview never settled')
  }
  function unmount() { for (const store of stores.values()) for (const slot of store) if (typeof slot?.cleanup === 'function') slot.cleanup(); stores.clear(); attached.clear() }
  return { react, jsx, render, settle, unmount }
}
function nodes(tree, predicate) {
  const found = []
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (predicate(node)) found.push(node); visit(node.props?.children) }
  visit(tree); return found
}
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'string' ? node : node && typeof node === 'object' ? textOf(node.props?.children) : ''
const describe = tree => { const image = nodes(tree, n => n.type === 'img')[0], status = nodes(tree, n => n.props?.role === 'status')[0], caption = nodes(tree, n => n.type === 'figcaption')[0]; return { src: image?.props.src ?? null, status: status ? textOf(status) : null, caption: caption ? textOf(caption) : null } }
const UNAVAILABLE = 'Deck preview unavailableNo image is available for this deck.'
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, async json() { if (body === undefined) throw Error('bad json'); return body } })
const answers = body => url => url.includes(`/api/presentations/${encodeURIComponent(body.presentation_id)}/slides/inventory`) ? response(200, body) : response(404, { detail: 'not found' })
function buildWorld({ env = both, inventory = STALE, routes } = {}) {
  const runtime = createRuntime(), calls = []
  const fetch = (url, init) => { calls.push({ url: String(url), init }); return (routes ?? answers(inventory))(String(url), init) }
  const globals = { process: { env }, fetch, setTimeout: () => 1, clearTimeout: () => {} }
  const resolver = load(RESOLVER, { deps: { './stage-f-thumbnails': load(STAGE_F) } })
  const railLib = load(RAIL, { env, globals })
  const lib = load(PUBLIB, { env, globals })
  const hook = load(HOOK, { env, globals, deps: { react: runtime.react, '@/lib/layout-service-client': { getLayoutServiceUrl: () => LAYOUT }, '@/lib/slide-rail-identity': railLib, '@/lib/studio-publish-preview-inventory': lib } })
  const component = load(COMPONENT, { env, globals, deps: { react: runtime.react, 'react/jsx-runtime': { jsx: runtime.jsx, jsxs: runtime.jsx }, 'lucide-react': { ImageIcon: 'ImageIcon' }, '@/lib/studio-publish-preview': resolver, '@/hooks/use-studio-publish-preview-inventory': hook } })
  return { runtime, calls, mount: props => { const tree = runtime.render(runtime.jsx(component.StudioPublishPreview, props)); return { tree, settle: () => runtime.settle(), unmount: () => runtime.unmount() } } }
}
const owned = { sessionId: 'session-a', ownerSessionId: 'session-a', finalPresentationId: PID } // a deck not built in this tab: no live image, no restored one
const withLive = { ...owned, thumbnailOwnerSessionId: 'session-a', thumbnailUrlsByPresentation: { [PID]: { 0: 'https://fixtures.invalid/final-first.png?v=1' } } }
const props = (source = owned) => ({ sessionId: 'session-a', source })
async function publishShows(options, source = owned) { const world = buildWorld(options), mounted = world.mount(props(source)); const tree = await mounted.settle(); const out = { ...describe(tree), reads: world.calls.length, urls: world.calls.map(call => call.url) }; mounted.unmount(); return out }
const inventoryUrl = id => `${LAYOUT}/api/presentations/${encodeURIComponent(id)}/slides/inventory`

// ---------------------------------------------------------------- the checks. Each takes the current sources (a mutant changes them); `run` collects failures.
const checks = []
const check = (name, fn) => checks.push([name, fn])
const lastGoodOf = (inventory, index) => inventory.slides[index].last_good_thumbnail_url

check('flag: exact "true" only, in the two modules that read it', async () => {
  for (const value of MISSPELLED) {
    const env = { [LG]: value }
    const rows = parsedOf(rail(env), STALE).slides
    assert.ok(rows.every(row => !('lastGoodThumbnailUrl' in row) && !('thumbnailStaleReason' in row)), `rail module, ${JSON.stringify(value)}: rows keep their base keys`)
    assert.equal(rowsOf(rail(env), STALE)[0].thumbnailLag, undefined, `rail module, ${JSON.stringify(value)}: no cue`)
    assert.equal(rowsOf(rail(env), STALE)[0].thumbnailUrl, undefined, `rail module, ${JSON.stringify(value)}: no image`)
    const lib = pub({ ...env, [PUB]: 'true' }), parsed = rail({ [LG]: 'true' }).parseSlideInventory(plain(STALE), PID)
    assert.equal(lib.publishPreviewInventoryUrl(parsed, PID), null, `publish module, ${JSON.stringify(value)}: fresh only`)
  }
  assert.equal(rowsOf(rail(on), STALE)[0].thumbnailLag, 'content'); assert.equal(pub(both).publishPreviewInventoryUrl(rail(on).parseSlideInventory(plain(STALE), PID), PID), lastGoodOf(STALE, 0))
  for (const rel of [RAIL, PUBLIB]) assert.equal((read(rel).match(/process\.env\.NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD === 'true'/g) ?? []).length, 1, `${rel}: the flag is read once, as the exact string`)
  const readers = []
  const walk = dir => { for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const rel = `${dir}/${entry.name}`; if (entry.isDirectory()) { if (entry.name !== 'node_modules' && entry.name !== '.next') walk(rel) } else if (/\.(tsx?|css)$/.test(entry.name) && fs.readFileSync(path.join(root, rel), 'utf8').includes('process.env.NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD')) readers.push(rel) } }
  for (const dir of ['lib', 'hooks', 'components', 'app', 'types']) if (fs.existsSync(path.join(root, dir))) walk(dir)
  assert.deepEqual(readers.sort(), [PUBLIB, RAIL].sort(), 'no other module reads the flag (the cue and the strip take it from the row)')
})

check('parse (flag on): the two keys of each recorded row; absent keys are null; only http(s); only the two reasons', async () => {
  const lib = rail(on)
  const stale = parsedOf(lib, STALE).slides
  assert.deepEqual(stale.map(r => r.lastGoodThumbnailUrl), STALE.slides.map(s => s.last_good_thumbnail_url))
  assert.deepEqual(stale.map(r => r.thumbnailStaleReason), ['content', 'content', null, null, null, null, null])
  assert.deepEqual(stale.map(r => r.thumbnailUrl), STALE.slides.map(s => s.thumbnail_url), 'thumbnail_url keeps its meaning (null while stale)')
  assert.deepEqual(stale.map(r => r.thumbnailStatus), ['stale', 'stale', 'fresh', 'fresh', 'fresh', 'fresh', 'fresh'])
  for (const name of ['NOTHING']) assert.ok(parsedOf(lib, ALL[name]).slides.every(r => r.lastGoodThumbnailUrl === null && r.thumbnailStaleReason === null), name)
  for (const name of ['OFF_REGISTERED', 'OFF_STALE']) assert.ok(parsedOf(lib, ALL[name]).slides.every(r => r.lastGoodThumbnailUrl === null && r.thumbnailStaleReason === null), `${name}: absent keys are null`)
  assert.equal(parsedOf(lib, STALE_THEME).slides[0].thumbnailStaleReason, 'theme')
  assert.equal(parsedOf(lib, UNKNOWN_REASON).slides[0].thumbnailStaleReason, null, 'a reason this does not know is null')
  assert.equal(parsedOf(lib, NO_LAST_GOOD).slides[0].lastGoodThumbnailUrl, null)
  for (const bad of BAD_URLS) assert.equal(parsedOf(lib, mapRows(STALE, (_s, i) => i === 0 ? { last_good_thumbnail_url: bad } : null)).slides[0].lastGoodThumbnailUrl, null, `${JSON.stringify(bad)} is not an image URL`)
  assert.equal(parsedOf(lib, mapRows(STALE, (_s, i) => i === 0 ? { last_good_thumbnail_url: '  https://fixtures.invalid/a.png  ' } : null)).slides[0].lastGoodThumbnailUrl, 'https://fixtures.invalid/a.png', 'trimmed, as thumbnail_url is')
  assert.equal(parsedOf(lib, mapRows(STALE, (_s, i) => i === 0 ? { last_good_thumbnail_url: `https://fixtures.invalid/${'a'.repeat(9000)}` } : null)).slides[0].lastGoodThumbnailUrl, null, 'over the length bound')
})

check('rows: fresh shows thumbnail_url alone; stale-content shows its own last good image with the content reason (RECORDED)', async () => {
  const rows = rowsOf(rail(on), STALE)
  assert.deepEqual(rows.map(r => r.thumbnailUrl), STALE.slides.map(s => s.thumbnail_url ?? s.last_good_thumbnail_url))
  assert.deepEqual(rows.map(r => r.thumbnailLag), ['content', 'content', undefined, undefined, undefined, undefined, undefined])
  assert.deepEqual(rows.map(r => r.thumbnailStatus), ['stale', 'stale', 'fresh', 'fresh', 'fresh', 'fresh', 'fresh'], 'the status words are Layout\'s, untouched')
  assert.deepEqual(rows.map(r => r.slideId), IDS); assert.deepEqual(rows.map(r => r.slideNumber), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(bareRows(rowsOf(rail(on), REGISTERED)), bareRows(rowsOf(rail({}), REGISTERED)), 'all fresh: the rows are today\'s rows')
})
check('rows: stale-theme (DERIVED) says theme for slide 0 and content for slide 1; null and unknown reasons say content', async () => {
  assert.deepEqual(rowsOf(rail(on), STALE_THEME).map(r => r.thumbnailLag).slice(0, 3), ['theme', 'content', undefined])
  assert.equal(rowsOf(rail(on), STALE_THEME)[0].thumbnailUrl, lastGoodOf(STALE_THEME, 0))
  assert.equal(rowsOf(rail(on), NO_REASON)[0].thumbnailLag, 'content'); assert.equal(rowsOf(rail(on), UNKNOWN_REASON)[0].thumbnailLag, 'content')
})
check('rows: none (RECORDED nothing registered) is today\'s state, with no image and no cue', async () => {
  const rows = rowsOf(rail(on), NOTHING)
  assert.ok(rows.every(r => r.thumbnailUrl === undefined && r.thumbnailLag === undefined && r.thumbnailStatus === 'none'))
  assert.deepEqual(bareRows(rows), bareRows(rowsOf(rail({}), NOTHING)))
})
check('rows: keys absent (Layout\'s flag off, RECORDED) with this flag on give exactly today\'s rows', async () => {
  for (const name of ['OFF_REGISTERED', 'OFF_STALE']) assert.deepEqual(bareRows(rowsOf(rail(on), ALL[name])), bareRows(rowsOf(rail({}), ALL[name])), name)
  const stale = rowsOf(rail(on), OFF_STALE)
  assert.ok(stale.some(r => r.thumbnailStatus === 'stale') && stale.filter(r => r.thumbnailStatus === 'stale').every(r => r.thumbnailUrl === undefined && r.thumbnailLag === undefined), 'a stale row with no last good key keeps no image, no cue')
})
check('rows: stale with no usable last good image (DERIVED) and a nothing-registered slide beside a stale one keep today\'s state', async () => {
  const noLast = rowsOf(rail(on), NO_LAST_GOOD)
  assert.equal(noLast[0].thumbnailUrl, undefined); assert.equal(noLast[0].thumbnailLag, undefined); assert.equal(noLast[0].thumbnailStatus, 'stale'); assert.equal(noLast[1].thumbnailUrl, lastGoodOf(STALE, 1))
  const none0 = rowsOf(rail(on), NONE_0_STALE_1)
  assert.equal(none0[0].thumbnailUrl, undefined); assert.equal(none0[0].thumbnailLag, undefined); assert.equal(none0[0].thumbnailStatus, 'none'); assert.equal(none0[1].thumbnailUrl, lastGoodOf(STALE, 1), 'slide 1 keeps its own image, slide 0 never takes it')
})
check('rows: a fresh image wins (DERIVED: a fresh row whose last good differs) and carries no cue', async () => {
  const row = rowsOf(rail(on), FRESH_WINS)[2]
  assert.equal(row.thumbnailUrl, REGISTERED.slides[2].thumbnail_url); assert.equal(row.thumbnailLag, undefined)
})
check('rows: never another slide\'s image: each image names its own slide_id, in the recorded order and in a shuffled one, and a slide with none takes no neighbour\'s', async () => {
  const lib = rail(on)
  for (const inventory of [STALE, STALE_THEME, REGISTERED]) for (const row of rowsOf(lib, inventory)) if (row.thumbnailUrl) assert.ok(row.thumbnailUrl.includes(row.slideId), `${row.slideId} shows ${row.thumbnailUrl}`)
  const shuffled = { ...plain(STALE), slides: [6, 0, 3, 1, 5, 2, 4].map((from, to) => ({ ...plain(STALE).slides[from], slide_index: to })) }
  const rows = rowsOf(lib, shuffled)
  assert.deepEqual(rows.map(r => r.slideId), [6, 0, 3, 1, 5, 2, 4].map(i => IDS[i]))
  for (const row of rows) { assert.ok(row.thumbnailUrl.includes(row.slideId)); assert.equal(row.thumbnailUrl, STALE.slides.find(s => s.slide_id === row.slideId).thumbnail_url ?? STALE.slides.find(s => s.slide_id === row.slideId).last_good_thumbnail_url) }
  const gap = mapRows(STALE, (_s, i) => i === 3 ? { thumbnail_url: null, thumbnail_stale: true, thumbnail_status: 'stale', last_good_thumbnail_url: null, thumbnail_stale_reason: 'content' } : null) // DERIVED: slide 3 has no image of its own, its neighbours do
  const gapRows = rowsOf(lib, gap)
  assert.equal(gapRows[3].thumbnailUrl, undefined); assert.equal(gapRows[2].thumbnailUrl, gap.slides[2].thumbnail_url); assert.equal(gapRows[4].thumbnailUrl, gap.slides[4].thumbnail_url)
})

check('rail (real strip): the cue is on exactly the last-good cards, with the right label and the slide\'s own image', async () => {
  const world = stripWorld()
  const html = renderStrip(world, rowsOf(rail(on), STALE)), cards = cardsOf(html)
  assert.equal(cards.length, 7)
  for (const index of [0, 1]) {
    assert.equal(cueIn(cards[index]).length, 1, `card ${index}: one cue`)
    assert.equal(labelOf(cards[index]), LABEL_CONTENT); assert.equal(srcOf(cards[index]), lastGoodOf(STALE, index)); assert.match(cards[index], /data-has-preview="true"/)
    assert.match(cards[index], /<span class="studio-thumbnail-lag-cue" data-studio-thumbnail-lag="content" role="img" aria-label="Preview may not show recent edits"><span aria-hidden="true">May lag<\/span><\/span>/)
    assert.doesNotMatch(cards[index], /No preview|Preview loading/)
  }
  for (const index of [2, 3, 4, 5, 6]) { assert.equal(cueIn(cards[index]).length, 0, `card ${index}: fresh, no cue`); assert.equal(srcOf(cards[index]), STALE.slides[index].thumbnail_url) }
  assert.equal((html.match(/studio-thumbnail-lag-cue/g) ?? []).length, 2)
  const theme = cardsOf(renderStrip(world, rowsOf(rail(on), STALE_THEME)))
  assert.equal(labelOf(theme[0]), LABEL_THEME); assert.match(theme[0], /data-studio-thumbnail-lag="theme"/); assert.equal(labelOf(theme[1]), LABEL_CONTENT)
  for (const inventory of [NO_REASON, UNKNOWN_REASON]) assert.equal(labelOf(cardsOf(renderStrip(world, rowsOf(rail(on), inventory)))[0]), LABEL_CONTENT)
  assert.equal(labelOf(cardsOf(renderStrip(world, [{ slideNumber: 1, title: 'A', thumbnailUrl: 'https://fixtures.invalid/a.png', thumbnailStatus: 'stale', thumbnailLag: 'weird' }]))[0]), LABEL_CONTENT, 'an unknown lag value reads as content')
})
check('rail (real strip): the cue is a sibling of the card button, not inside it; a refining card, a card with no image and a row without thumbnailLag draw none', async () => {
  const world = stripWorld()
  const card = cardsOf(renderStrip(world, rowsOf(rail(on), STALE)))[0]
  const button = card.slice(card.indexOf('<button data-studio-thumbnail-navigation'), card.indexOf('</button>'))
  assert.ok(button.length > 0 && !button.includes('studio-thumbnail-lag-cue'), 'nothing of the cue inside the button (its aria-label would hide it, and a click goes to the button)')
  assert.ok(card.indexOf('</button>') < card.indexOf('studio-thumbnail-lag-cue'))
  const rows = [
    { slideNumber: 1, title: 'A', thumbnailUrl: 'https://fixtures.invalid/a.png', thumbnailStatus: 'stale' },
    { slideNumber: 2, title: 'B', thumbnailStatus: 'stale', thumbnailLag: 'content' },
    { slideNumber: 3, title: 'C', thumbnailUrl: 'https://fixtures.invalid/c.png', thumbnailStatus: 'fresh' },
  ]
  assert.equal((renderStrip(world, rows).match(/studio-thumbnail-lag-cue/g) ?? []).length, 0, 'no thumbnailLag with an image, or thumbnailLag with no image: no cue')
  const jobs = [{ jobId: 'j1', targetIndex: 0, kind: 'refine', status: 'building', targetSlideId: IDS[0] }]
  assert.equal((renderStrip(world, rowsOf(rail(on), STALE), { composeJobs: jobs }).match(/studio-thumbnail-lag-cue/g) ?? []).length, 1, 'only the refining card loses its cue (its spinner covers the preview)')
})
check('rail (real strip): none, stale-without-image, pending and legacy cards are today\'s cards', async () => {
  const world = stripWorld(), lib = rail(on)
  const none = cardsOf(renderStrip(world, rowsOf(lib, NOTHING)))
  assert.ok(none.every(card => /<span class="studio-thumbnail-placeholder-label">No preview<\/span>/.test(card) && cueIn(card).length === 0))
  const noLast = cardsOf(renderStrip(world, rowsOf(lib, NO_LAST_GOOD)))
  assert.match(noLast[0], /No preview/); assert.equal(cueIn(noLast[0]).length, 0); assert.equal(srcOf(noLast[0]), null)
  const pending = cardsOf(renderStrip(world, [{ slideNumber: 1, title: 'P', thumbnailStatus: 'pending' }]))[0]
  assert.match(pending, /data-studio-thumbnail-pending="true"/); assert.match(pending, /Preview loading/)
  const off = cardsOf(renderStrip(world, rowsOf(lib, OFF_STALE)))
  assert.ok(off.every(card => cueIn(card).length === 0), 'keys absent: no cue anywhere')
})

check('poll (real controller): a change of only the last good image or only the reason republishes the rows; an identical poll does not', async () => {
  const bodies = [STALE, mapRows(STALE, (_s, i) => i === 0 ? { thumbnail_stale_reason: 'theme' } : null), mapRows(STALE, (_s, i) => i === 0 ? { thumbnail_stale_reason: 'theme' } : null), mapRows(STALE, (_s, i) => i === 0 ? { thumbnail_stale_reason: 'theme', last_good_thumbnail_url: 'https://cdn.test/thumbs/slide_03400405ce3a-3.png' } : null)]
  let call = 0; const states = []
  const lib = rail(on)
  const controller = lib.createSlideInventoryController({ presentationId: PID, getBaseUrl: () => LAYOUT, fetchImpl: async () => response(200, bodies[call++]), onChange: state => states.push(state), setTimer: () => 1, clearTimer: () => {} })
  for (let i = 0; i < bodies.length; i++) { controller.refresh(true); for (let k = 0; k < 6; k++) await new Promise(resolve => setImmediate(resolve)) }
  controller.dispose()
  const ready = states.filter(state => state.status === 'ready')
  assert.equal(ready.length, 3, 'ready for the first read, the reason change and the image change; the identical poll adds nothing')
  assert.deepEqual(ready.map(state => state.inventory.slides[0].thumbnailStaleReason), ['content', 'theme', 'theme'])
  assert.equal(ready[2].inventory.slides[0].lastGoodThumbnailUrl, 'https://cdn.test/thumbs/slide_03400405ce3a-3.png')
})

check('publish, both flags on (real hook and component): stale slide 0 with a last good image shows it, content and theme; fresh shows thumbnail_url; one read', async () => {
  for (const [label, inventory, expected] of [['stale-content (RECORDED)', STALE, lastGoodOf(STALE, 0)], ['stale-theme (DERIVED)', STALE_THEME, lastGoodOf(STALE_THEME, 0)], ['fresh (RECORDED)', REGISTERED, REGISTERED.slides[0].thumbnail_url], ['stale, no reason (DERIVED)', NO_REASON, lastGoodOf(NO_REASON, 0)]]) {
    const shown = await publishShows({ inventory })
    assert.equal(shown.src, expected, label); assert.match(shown.caption, /Preview image can lag recent edits/, `${label}: the existing caption`)
    assert.equal(shown.reads, 1, `${label}: one read`); assert.deepEqual(shown.urls, [inventoryUrl(PID)])
  }
  assert.ok(STALE.slides[0].thumbnail_url === null && lastGoodOf(STALE, 0), 'the recorded slide 0 really has no fresh image')
})
check('publish, both flags on: "Deck preview unavailable" only when no image exists at all; slide 0 only; this presentation only', async () => {
  for (const [label, inventory] of [['nothing registered (RECORDED)', NOTHING], ['stale, no usable last good (DERIVED)', NO_LAST_GOOD], ['slide 0 none, slide 1 stale with a last good image (DERIVED)', NONE_0_STALE_1]]) {
    const shown = await publishShows({ inventory })
    assert.equal(shown.src, null, label); assert.equal(shown.status, UNAVAILABLE, label)
  }
  const other = { ...plain(STALE), presentation_id: 'someone-elses-deck' }
  const world = buildWorld({ inventory: STALE, routes: answers(other) }), mounted = world.mount(props()); const shown = describe(await mounted.settle()); mounted.unmount()
  assert.equal(shown.src, null); assert.equal(shown.status, UNAVAILABLE)
  const emptyDeck = await publishShows({ inventory: { ...plain(STALE), slide_count: 0, slides: [] } })
  assert.equal(emptyDeck.src, null)
  const failed = await publishShows({ routes: () => response(500, { detail: 'boom' }) }); assert.equal(failed.status, UNAVAILABLE)
  const live = await publishShows({ inventory: STALE }, withLive); assert.equal(live.src, 'https://fixtures.invalid/final-first.png?v=1'); assert.equal(live.reads, 0, 'a live image wins and makes no read')
})
check('publish, only #495\'s flag on: fresh only, exactly as before, even when the row carries a last good image; only this flag on: no read at all', async () => {
  const world = buildWorld({ env: only495, inventory: STALE }), mounted = world.mount(props()), shown = describe(await mounted.settle()); mounted.unmount()
  assert.equal(shown.src, null); assert.equal(shown.status, UNAVAILABLE); assert.equal(world.calls.length, 1, '#495 still makes its one read')
  const fresh = await publishShows({ env: only495, inventory: REGISTERED }); assert.equal(fresh.src, REGISTERED.slides[0].thumbnail_url)
  const rows = rail(on).parseSlideInventory(plain(STALE), PID) // rows that DO carry the last good image, read by #495's resolver alone
  assert.equal(rows.slides[0].lastGoodThumbnailUrl, lastGoodOf(STALE, 0))
  assert.equal(pub(only495).publishPreviewInventoryUrl(rows, PID), null, '#495 alone: a stale row is null whatever else the row carries')
  assert.equal(pub(only495).publishPreviewInventoryUrl(rail(on).parseSlideInventory(plain(REGISTERED), PID), PID), REGISTERED.slides[0].thumbnail_url)
  const alone = await publishShows({ env: on, inventory: STALE }); assert.equal(alone.reads, 0, 'this flag alone: no read'); assert.equal(alone.src, null)
  assert.equal(pub(on).publishPreviewInventoryUrl(rows, PID), null, 'this flag alone: the resolver is not widened')
  assert.equal(pub(on).publishPreviewInventoryRequest({ status: 'unavailable' }, 'session-a', owned), null)
  const off = await publishShows({ env: {}, inventory: STALE }); assert.equal(off.reads, 0); assert.equal(off.src, null)
})

check('look: the cue\'s sheet is scoped to the Studio rail, uses only the rail\'s tokens, takes no pointer events, and stays readable in light and dark', async () => {
  const css = read(CSS), thumbs = read(THUMB_CSS)
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)]
  assert.equal(rules.length, 1, 'one rule'); const [, selector, body] = rules[0]
  assert.equal(selector.trim(), '[data-studio-thumbnail-strip="true"] .studio-thumbnail-lag-cue', 'scoped to the rail strip')
  assert.match(body, /pointer-events:\s*none/); assert.match(body, /position:\s*absolute/); assert.match(body, /white-space:\s*nowrap/); assert.doesNotMatch(body, /!important|url\(|@import/)
  assert.deepEqual([...new Set([...body.matchAll(/var\((--[a-z-]+)\)/g)].map(m => m[1]))].sort(), ['--st-line', '--st-muted', '--st-panel'], 'only the rail\'s own tokens')
  assert.doesNotMatch(body.replace(/box-shadow:[^;]*;/, ''), /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i, 'no colour of its own (the shadow aside)')
  const tokens = block => Object.fromEntries([...block.matchAll(/(--st-[a-z]+):\s*(#[0-9a-f]{6})/g)].map(m => [m[1], m[2]]))
  const light = tokens(thumbs.slice(0, thumbs.indexOf('.dark [data-studio-v4-shell'))), dark = tokens(thumbs.slice(thumbs.indexOf('.dark [data-studio-v4-shell'), thumbs.indexOf('[data-studio-v4-shell="true"][data-studio-thumbnail-strip="true"] { display')))
  for (const name of ['--st-line', '--st-muted', '--st-panel']) { assert.ok(light[name], `${name} in light`); assert.ok(dark[name], `${name} in dark`) }
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
  const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
  const mix = (a, b, share) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * share + parseInt(b.slice(i, i + 2), 16) * (1 - share)).toString(16).padStart(2, '0')).join('')
  for (const [name, set] of [['light', light], ['dark', dark]]) for (const image of ['#ffffff', '#000000']) { // the badge is 92% panel over whatever the image is: worst cases are a white and a black image
    const ratio = contrast(set['--st-muted'], mix(set['--st-panel'], image, 0.92))
    assert.ok(ratio >= 4.5, `${name} over a ${image} image: contrast ${ratio.toFixed(2)} >= 4.5`)
  }
  assert.match(thumbs, /\.dark \[data-studio-v4-shell="true"\]\[data-studio-thumbnail-strip="true"\]/, 'the dark tokens are the rail\'s own')
  const world = stripWorld(), markup = x => renderToStaticMarkup(React.createElement(world.cue().StudioThumbnailLagCue, { reason: x }))
  assert.equal(markup('content'), `<span class="studio-thumbnail-lag-cue" data-studio-thumbnail-lag="content" role="img" aria-label="${LABEL_CONTENT}"><span aria-hidden="true">${CUE_TEXT}</span></span>`)
  assert.equal(markup('theme'), `<span class="studio-thumbnail-lag-cue" data-studio-thumbnail-lag="theme" role="img" aria-label="${LABEL_THEME}"><span aria-hidden="true">${CUE_TEXT}</span></span>`)
  for (const odd of [null, undefined, 'weird', 3]) assert.equal(markup(odd), markup('content'), `${String(odd)} reads as content`)
  assert.doesNotMatch(read(CUE), /\bon[A-Z][A-Za-z]*=|useEffect|useState|fetch\(|localStorage|sessionStorage/, 'the cue holds no handler, state or request')
})

check('flag off: parse, rows, strip markup and Publish results are the base commit\'s: same output, hashed', async () => {
  const baseRail = rail({}, baseOf(RAIL)), basePub = pub({}, baseOf(PUBLIB)), headRail = rail({}), headPub = pub({}), baseStrip = BASE_STRIP(), headStrip = stripWorld()
  const baseOut = [], headOut = []
  for (const [name, inventory] of Object.entries(ALL)) {
    for (const pubEnv of [{}, only495]) {
      baseOut.push(JSON.stringify(baseRail.parseSlideInventory(plain(inventory), PID))); headOut.push(JSON.stringify(headRail.parseSlideInventory(plain(inventory), PID)))
      const baseRows = baseRail.buildRailRows(baseRail.parseSlideInventory(plain(inventory), PID), new Map()), headRows = headRail.buildRailRows(headRail.parseSlideInventory(plain(inventory), PID), new Map())
      baseOut.push(JSON.stringify(baseRows)); headOut.push(JSON.stringify(headRows))
      baseOut.push(renderStrip(baseStrip, baseRows)); headOut.push(renderStrip(headStrip, headRows))
      const bp = pub(pubEnv, baseOf(PUBLIB)), hp = pub(pubEnv)
      baseOut.push(String(bp.publishPreviewInventoryUrl(baseRail.parseSlideInventory(plain(inventory), PID), PID))); headOut.push(String(hp.publishPreviewInventoryUrl(headRail.parseSlideInventory(plain(inventory), PID), PID)))
      baseOut.push(JSON.stringify(bp.resolvePublishPreviewWithInventory({ status: 'unavailable' }, 'session-a', owned, { [JSON.stringify(['session-a', PID])]: bp.publishPreviewInventoryUrl(baseRail.parseSlideInventory(plain(inventory), PID), PID) })))
      headOut.push(JSON.stringify(hp.resolvePublishPreviewWithInventory({ status: 'unavailable' }, 'session-a', owned, { [JSON.stringify(['session-a', PID])]: hp.publishPreviewInventoryUrl(headRail.parseSlideInventory(plain(inventory), PID), PID) })))
    }
  }
  assert.ok(baseOut.length >= 5 * Object.keys(ALL).length)
  assert.equal(sha(headOut.join('\n')), sha(baseOut.join('\n')), 'every output hashes alike')
  for (let i = 0; i < baseOut.length; i++) assert.equal(headOut[i], baseOut[i], `output ${i}`)
  flagOffDigest.base = sha(baseOut.join('\n')); flagOffDigest.head = sha(headOut.join('\n')); flagOffDigest.count = baseOut.length
  // this flag on with nothing for it to show (every fresh deck, nothing registered, Layout's flag off) draws the same strip as flag off
  for (const name of ['REGISTERED', 'NOTHING', 'OFF_REGISTERED', 'OFF_STALE', 'FRESH_WINS']) assert.equal(renderStrip(headStrip, rowsOf(rail(on), ALL[name])), renderStrip(baseStrip, rowsOf(rail({}), ALL[name])), `${name}: flag on, nothing to show: the base's markup`)
  // the strip with the flag off draws the stale cards of the recorded flag-on inventory exactly as the base does: no image, "No preview"
  assert.equal(renderStrip(headStrip, rowsOf(rail({}), STALE)), renderStrip(baseStrip, rowsOf(baseRail, STALE)))
})
const flagOffDigest = { base: '', head: '', count: 0 }

// ---------------------------------------------------------------- the change itself
const scan = (name, text) => {
  assert.doesNotMatch(text, /(?:key|secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, `${name}: no quoted literal assigned to a credential-shaped name`)
  assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{10,}\.|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|Bearer [A-Za-z0-9._-]{20,}/, `${name}: no token, key or bearer string`)
}
check('strip: stripping this change gives back BASE_COMMIT\'s files byte for byte; every pair occurs once; other files are returned as they are', async () => {
  const mod = overrides[STRIP_MODULE] ? await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(overrides[STRIP_MODULE])}`) : { stripThumbnailLastGood, THUMBNAIL_LAST_GOOD_CHANGES, THUMBNAIL_LAST_GOOD_FILES }
  assert.deepEqual(mod.THUMBNAIL_LAST_GOOD_FILES, [ENV, RAIL, STRIP, PUBLIB])
  for (const rel of mod.THUMBNAIL_LAST_GOOD_FILES) {
    const head = read(rel)
    assert.notEqual(head, baseOf(rel), `${rel} is changed`)
    assert.equal(sha(mod.stripThumbnailLastGood(rel, head)), sha(baseOf(rel)), rel)
    for (const [added] of mod.THUMBNAIL_LAST_GOOD_CHANGES[rel]) assert.equal(head.split(added).length - 1, 1, `${rel}: each pair occurs once`)
  }
  assert.equal(mod.stripThumbnailLastGood('app/builder/page.tsx', 'x'), 'x'); assert.equal(mod.stripThumbnailLastGood(RAIL, 'x'), 'x')
})
check('strip roots: the three shared roots chain it innermost, and a root gives the base file for each file it changed', async () => {
  for (const rootFile of ROOTS) {
    const text = read(rootFile)
    assert.equal((text.match(/import \{ stripThumbnailLastGood \} from '\.\/studio-thumbnail-last-good-strip\.mjs'/g) || []).length, 1, `${rootFile}: one import`)
    assert.equal((text.match(/stripDuplicateCopyTitle\(rel, stripThumbnailLastGood\(rel, (?:stripBulkEditUndo\(rel, )?text\)\)/g) || []).length, 1, `${rootFile}: chained once, innermost (applied first)`)
  }
  if (!ROOTS.some(rootFile => rootFile in overrides)) {
    // only the add-slide-status root runs the whole chain on any file (the other two act on the Builder page, and the theme restore, only): through it this change's lines are out of each file
    for (const rel of [STRIP, RAIL, PUBLIB, ENV]) {
      assert.equal(sha(stripAddSlideStatus(rel, read(rel))), sha(stripAddSlideStatus(rel, baseOf(rel))), `stripAddSlideStatus(${rel}): this change's lines are out`)
      assert.notEqual(stripAddSlideStatus(rel, read(rel)), read(rel), `${rel}: the root acts on it`)
    }
    for (const rel of [STRIP, RAIL, PUBLIB]) for (const root3 of [stripOpenReadOnly, stripDarkPersist]) assert.equal(root3(rel, read(rel)), read(rel), `${root3.name}(${rel}) leaves it as it is`)
  }
})
check('.env.example: one block, default "false", right before # PASS2 ADMIN and after the duplicate copy title block', async () => {
  const env = read(ENV), lines = env.split('\n'), at = lines.findIndex(line => line.startsWith(`${LG}=`))
  assert.ok(at > 0); assert.equal(lines[at], `${LG}="false"`); assert.equal(lines[at + 1], ''); assert.ok(lines[at + 2].startsWith('# PASS2 ADMIN'))
  assert.equal(env.split(`${LG}=`).length - 1, 1)
  assert.ok(env.indexOf('NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE="false"') < env.indexOf(`${LG}=`))
  assert.match(env, /# THUMBNAIL LAST GOOD \(FRONTEND-2, THUMBNAILS-BLANK-UAT "never blank"/)
  for (const phrase of ['May lag', LABEL_CONTENT, LABEL_THEME, 'NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED', 'NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED', 'LAYOUT_THUMBNAIL_LAST_GOOD_ENABLED']) assert.ok(env.includes(phrase), phrase)
  assert.equal(stripAddSlideStatus(ENV, env).includes(LG), false, 'a root takes the block out')
})
check('harness: STACKED_PASS3_FILES lists the new files and the two rail files this adds lines to', async () => {
  for (const rel of [LIB, CUE, CSS, RAIL, STRIP, PUBLIB]) assert.ok(STACKED_PASS3_FILES.includes(rel), rel)
})
check('no new request, storage, timer or socket: the new files and every added line', async () => {
  for (const rel of [LIB, CUE, CSS]) assert.doesNotMatch(read(rel), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|setInterval|setTimeout|postMessage|process\.env/, `${rel}: none of those`)
  for (const [rel, table] of Object.entries(THUMBNAIL_LAST_GOOD_CHANGES)) for (const [added] of table) if (rel !== ENV) assert.doesNotMatch(added.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|setInterval|setTimeout|postMessage/, `${rel}: an added line makes no call`)
  assert.equal((read(RAIL).match(/\bfetch\(|fetchImpl\(/g) ?? []).length, (baseOf(RAIL).match(/\bfetch\(|fetchImpl\(/g) ?? []).length, 'the reader makes the same requests as at the base')
  assert.equal((read(PUBLIB).match(/\bfetch\b/g) ?? []).length, 0)
})
check('scope: the COMMITTED diff (BASE..HEAD) holds this change\'s files, the roots, the harness, the fixtures and the pins taught about it, and nothing else; the working tree is never read', async () => {
  const committed = [...new Set(git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean))]
  const allowed = new Set([...THUMBNAIL_LAST_GOOD_FILES, ...THUMBNAIL_LAST_GOOD_NEW_FILES, ...THUMBNAIL_LAST_GOOD_PIN_FILES, ...BULK_EDIT_UNDO_FILES, ...BULK_EDIT_UNDO_NEW_FILES, ...BULK_EDIT_UNDO_PIN_FILES /* stacked: bulk edit + chat undo, after this change in the stack */, ...ROOTS, HARNESS])
  const stray = committed.filter(rel => !allowed.has(rel))
  assert.deepEqual(stray, [], 'no file outside this change')
  assert.deepEqual(fs.readdirSync(path.join(root, 'scripts/fixtures/thumbnail-last-good')).map(name => `scripts/fixtures/thumbnail-last-good/${name}`).sort(), THUMBNAIL_LAST_GOOD_NEW_FILES.filter(rel => rel.startsWith('scripts/fixtures/')).sort(), 'the strip module lists every fixture')
  if (committed.length > 0) for (const rel of [...THUMBNAIL_LAST_GOOD_FILES, ...THUMBNAIL_LAST_GOOD_NEW_FILES, ...ROOTS, HARNESS]) assert.ok(committed.includes(rel), `${rel} is in the committed diff`)
  assert.equal(git('diff', '--name-only', '--diff-filter=D', BASE, 'HEAD').trim(), '', 'nothing deleted')
  const added = git('diff', '-U0', BASE, 'HEAD', '--', ...committed.filter(rel => !rel.startsWith('scripts/fixtures/'))).split('\n').filter(line => /^\+(?!\+\+)/.test(line)).join('\n')
  scan('the added lines', added)
})
check('secret scan: this change\'s files and fixtures', async () => {
  for (const rel of [LIB, CUE, CSS, STRIP_MODULE, 'scripts/test-studio-thumbnail-last-good.mjs']) scan(rel, fs.readFileSync(path.join(root, rel), 'utf8'))
  for (const name of fs.readdirSync(path.join(root, 'scripts/fixtures/thumbnail-last-good'))) scan(name, fs.readFileSync(path.join(root, 'scripts/fixtures/thumbnail-last-good', name), 'utf8'))
})

async function run({ quiet }) {
  const failed = []
  for (const [name, fn] of checks) {
    try { await fn(); if (!quiet) console.log(`PASS ${name}`) } catch (error) { failed.push(name); if (!quiet) console.log(`FAIL ${name}\n  ${String(error.message).split('\n').slice(0, 4).join('\n  ')}`) }
  }
  return failed
}
fixtureFacts()
console.log(`fixtures: RECORDED ${PID} (inventory-lg-nothing-registered, -registered, -stale-content, -off-registered, -off-stale; sha256 of the stale body ${sha(JSON.stringify(STALE)).slice(0, 12)}); DERIVED stale-theme, no-last-good, none-0-stale-1, fresh-wins, no-reason, unknown-reason, bad URLs`)
const failed = await run({ quiet: false })
if (failed.length) { console.log(`\n${failed.length} of ${checks.length} checks failed`); process.exit(1) }
console.log(`\nflag-off identity: ${flagOffDigest.count} outputs (parse, rows, strip markup, Publish results) over ${Object.keys(ALL).length} inventories x 2 Publish flag states; sha256 head ${flagOffDigest.head.slice(0, 16)}… == base ${flagOffDigest.base.slice(0, 16)}…`)

// ---------------------------------------------------------------- mutants: each edits ONE source in memory and must make at least one check fail
if (!process.env.THUMBNAIL_LAST_GOOD_NO_MUTANTS) {
  const survived = []
  async function mutant(file, name, from, to, ...more) {
    const pairs = [[from, to], ...more]
    let mutated = fs.readFileSync(path.join(root, file), 'utf8')
    for (const [a, b] of pairs) { assert.ok(mutated.includes(a), `mutant "${name}" no longer applies; update the list (${a.slice(0, 50)})`); mutated = mutated.replace(a, () => b) }
    overrides = { [file]: mutated }
    let killed
    try { killed = await run({ quiet: true }) } finally { overrides = {} }
    if (killed.length === 0) survived.push(name); else console.log(`KILLED ${name}: ${killed.length} check(s), first: ${killed[0].slice(0, 80)}`)
  }
  const LG_READ = "process.env.NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD === 'true'"
  await mutant(RAIL, 'flag spelling: wrong name (rail)', LG_READ, "process.env.NEXT_PUBLIC_STUDIO_THUMBNAIL_LASTGOOD === 'true'")
  await mutant(RAIL, 'flag spelling: truthy (rail)', LG_READ, 'Boolean(process.env.NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD)')
  await mutant(PUBLIB, 'flag spelling: case-blind (publish)', LG_READ, "String(process.env.NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD).toLowerCase() === 'true'")
  await mutant(RAIL, 'last good used when thumbnail_url exists', 'THUMBNAIL_LAST_GOOD && !row.thumbnailUrl && row.lastGoodThumbnailUrl', 'THUMBNAIL_LAST_GOOD && row.lastGoodThumbnailUrl')
  await mutant(RAIL, 'cross-slide image (the next slide\'s)', 'thumbnailUrl: row.lastGoodThumbnailUrl,', 'thumbnailUrl: (inventory.slides[position + 1] ?? row).lastGoodThumbnailUrl,')
  await mutant(RAIL, 'absent keys mishandled (a missing key throws)', 'safeThumbnailUrl(slide.last_good_thumbnail_url)', '(slide.last_good_thumbnail_url as string).trim()')
  await mutant(RAIL, 'any string is an image URL (javascript: accepted)', 'safeThumbnailUrl(slide.last_good_thumbnail_url)', "(typeof slide.last_good_thumbnail_url === 'string' ? slide.last_good_thumbnail_url : null)")
  await mutant(RAIL, 'an unknown reason is kept', "reason === 'content' || reason === 'theme' ? reason : null", 'typeof reason === \'string\' ? reason as \'content\' : null')
  await mutant(RAIL, 'the reason is swapped', "row.thumbnailStaleReason === 'theme' ? 'theme' as const : 'content' as const", "row.thumbnailStaleReason === 'theme' ? 'content' as const : 'theme' as const")
  await mutant(RAIL, 'no reason reads as theme', "row.thumbnailStaleReason === 'theme' ? 'theme' as const : 'content' as const", "row.thumbnailStaleReason === 'content' ? 'content' as const : 'theme' as const")
  await mutant(RAIL, 'flag off changed: the parse adds its keys', '...(THUMBNAIL_LAST_GOOD ? lastGoodFields(slide) : {}),', '...lastGoodFields(slide),')
  await mutant(RAIL, 'flag off changed: the rows show a last good image', 'THUMBNAIL_LAST_GOOD && !row.thumbnailUrl', '!row.thumbnailUrl')
  await mutant(RAIL, 'a change of only the last good image or reason is not republished', '      && row.lastGoodThumbnailUrl === other.lastGoodThumbnailUrl && row.thumbnailStaleReason === other.thumbnailStaleReason\n', '')
  await mutant(RAIL, 'a stale row with no image gets a cue', "THUMBNAIL_LAST_GOOD && !row.thumbnailUrl && row.lastGoodThumbnailUrl ? { thumbnailUrl: row.lastGoodThumbnailUrl,", "THUMBNAIL_LAST_GOOD && !row.thumbnailUrl ? { thumbnailUrl: row.lastGoodThumbnailUrl ?? undefined,")
  await mutant(PUBLIB, 'the Publish fallback does not widen', 'return nonempty(first.lastGoodThumbnailUrl)', 'return null')
  await mutant(PUBLIB, 'widening with only #495\'s flag on', 'if (first && THUMBNAIL_LAST_GOOD && STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED &&', 'if (first && STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED &&')
  await mutant(PUBLIB, 'widening with only this flag on', 'if (first && THUMBNAIL_LAST_GOOD && STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED &&', 'if (first && THUMBNAIL_LAST_GOOD &&')
  await mutant(PUBLIB, 'the Publish fallback takes another slide\'s image', 'return nonempty(first.lastGoodThumbnailUrl)', 'return nonempty((inventory.slides.find(slide => slide.lastGoodThumbnailUrl) ?? first).lastGoodThumbnailUrl)')
  await mutant(PUBLIB, 'the Publish fallback replaces a fresh image', '(first.thumbnailStale || !first.thumbnailUrl)) return', '(first.thumbnailStale || !first.thumbnailUrl || true)) return')
  await mutant(STRIP, 'the cue is missing', '{STUDIO_THUMBNAILS && slide.thumbnailLag && thumbnailUrl && !isRefining && <StudioThumbnailLagCue reason={slide.thumbnailLag} />}', '{null}')
  await mutant(STRIP, 'the cue is on every card with an image', 'STUDIO_THUMBNAILS && slide.thumbnailLag && thumbnailUrl && !isRefining &&', 'STUDIO_THUMBNAILS && thumbnailUrl && !isRefining &&')
  await mutant(STRIP, 'the cue is inside the button', '{STUDIO_THUMBNAILS && slide.thumbnailLag && thumbnailUrl && !isRefining && <StudioThumbnailLagCue reason={slide.thumbnailLag} />}', '', ['            {isRefining && (\n              <div data-studio-thumbnail-refining', '            {STUDIO_THUMBNAILS && slide.thumbnailLag && thumbnailUrl && !isRefining && <StudioThumbnailLagCue reason={slide.thumbnailLag} />}\n            {isRefining && (\n              <div data-studio-thumbnail-refining'])
  await mutant(LIB, 'the wrong label for a reason', "content: 'Preview may not show recent edits',\n  theme: 'Preview shows the previous theme',", "content: 'Preview shows the previous theme',\n  theme: 'Preview may not show recent edits',")
  await mutant(LIB, 'null and unknown read as theme', "value === 'theme' ? 'theme' : 'content'", "value === 'content' ? 'content' : 'theme'")
  await mutant(CUE, 'the accessible label is missing', ' aria-label={thumbnailLagLabel(kind)}', '')
  await mutant(CSS, 'the cue takes pointer events', 'pointer-events: none;', 'pointer-events: auto;')
  await mutant(CSS, 'the cue is not scoped to the rail', '[data-studio-thumbnail-strip="true"] .studio-thumbnail-lag-cue', '.studio-thumbnail-lag-cue')
  await mutant(CSS, 'the cue names a colour of its own', 'color: var(--st-muted);', 'color: #9aa5a2;')
  await mutant(STRIP_MODULE, 'the strip puts the wrong text back', 'const PUBLISH_TYPE_BASE = `  slides: ReadonlyArray<{ thumbnailUrl: string | null; thumbnailStale: boolean }>', 'const PUBLISH_TYPE_BASE = `  slides: ReadonlyArray<{ thumbnailUrl: string | null; thumbnailStale: boolean; }>')
  await mutant(STRIP_MODULE, 'the strip leaves a piece behind', '    [RAIL_SAME_INVENTORY, \'\'],\n', '')
  await mutant(ROOTS[0], 'the root does not chain it innermost', 'stripDuplicateCopyTitle(rel, stripThumbnailLastGood(rel, stripBulkEditUndo(rel, text)))', 'stripThumbnailLastGood(rel, stripDuplicateCopyTitle(rel, stripBulkEditUndo(rel, text)))')
  await mutant(ENV, 'the block moves after # PASS2 ADMIN', '# THUMBNAIL LAST GOOD (FRONTEND-2', '# PASS2 ADMIN (FRONTEND-1, the internal', ['# PASS2 ADMIN (FRONTEND-1, the internal /admin/users', '# THUMBNAIL LAST GOOD (FRONTEND-2, the internal /admin/users'])
  await mutant(ENV, 'the flag defaults on', `${LG}="false"`, `${LG}="true"`)
  assert.deepEqual(survived, [], `mutants survived: ${survived.join('; ')}`)
  console.log(`\n${checks.length} checks passed; mutants: all killed`)
} else console.log(`\n${checks.length} checks passed (mutants skipped)`)
