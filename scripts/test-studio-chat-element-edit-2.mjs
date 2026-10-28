// FRONTEND-2 (B32, PROGRAM-1 GO 27 Oct 17:24Z): proof of NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2 (exact "true", default off, build-time). Two defects of #522's chat element edit (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT, ON on Studio dev),
// seen by E2E-2 on Studio dev (session 57f9e99a, deck 1343a54f) after a page reload and an Undo.
//
// THE DEFECTS (root causes, read in the code):
//   1. SLIDE_CHANGED on every edit after a reload. lib/chat-element-edit.ts compares the directive's slide_id (Layout's, "slide_7f86d3817444") with deps.slideIdAt(target); app/builder/page.tsx wires that to
//      slideStructure.slides[i].slide_id, the SESSION's slide list. That list is Director's slide_update payload (hooks/use-deckster-websocket-v2.ts), restored from the session row on a reload (getInitialState / the restore
//      path: slideStructure: cached.slideStructure | sessionState.slideStructure), and its ids are Director's outline UUIDs ("9ebccd93-..."), never Layout's. Before a reload the live list had no ids to compare, so the guard passed.
//   2. A stale hidden element reference. The record behind user_message.references (chatElementSelectionRef, page.tsx) is written by two effects keyed on the selection STATE, and cleared only when that state goes null. An Undo
//      deletes the element in the viewer (the iframe reloads) but not the page's selectedTextBoxId / selectedElementId, so the record stays; and a click on an element the page already holds does not change a state, so no effect
//      runs and the record is not replaced.
//
// THE FIX (flag on): (1) the runner reads the shown deck's own slide count and ids from Layout's slide inventory (the rail's read) once per directive and checks the directive against those; a slide that really changed still answers
// SLIDE_CHANGED; ids unreadable = the index check alone. (2) every selection event writes the record, and it is dropped when the deck changes under it (slideComposerOverride / the presentation) or the shown slide is not its slide.
//
//   1. the REAL runner (lib/chat-element-edit.ts), the REAL page wiring (the runner assignment and the helper cut out of app/builder/page.tsx and run with the page's values), the REAL save watch, over a viewer that answers in
//      the recorded shapes: E2E-2's incoming frame, Layout's ids, the restored session list with outline UUIDs. Flag off: SLIDE_CHANGED (today's bug); flag on: the edit applies and is saved.
//   2. A slide that really changed still answers SLIDE_CHANGED, flag on and off; ids unreadable falls back to the index check; a deck switch during the read answers nothing.
//   3. The REAL selection code of the page (the two selection effects, the two drop effects, the two selection callbacks, cut out and run over a model of React's "an effect runs when a dependency changes"): the E2E-2 sequence
//      (select an image, select a title, Undo, click the image again) with the real chatElementReferenceFor and addChatElementRefineFields. Flag off: the stale reference and the click that does not replace it (today's bugs).
//   4. Flag off is identical to the base: the strip gives the base files back byte for byte, and the base and head code, flag off, answer a matrix of directives with the same hashes, reading nothing from Layout.
//   5. Mutants of the runner, the helper and the page are caught.
//   6. Scope over the COMMITTED diff (BASE..HEAD, the first-parent commits that start "Chat element edit 2:").
//
//   node scripts/test-studio-chat-element-edit-2.mjs
//
// Offline: no socket, fetch or real timer is used (the Layout read is a stand-in fetch, the clock is virtual); git is read only for 4 and 6.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createClock } from './studio-chat-element-edit-layout.mjs'
import { compile } from './studio-chat-harness/page-extract.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })

const FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2'
const EDIT_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT'
const REFINE_FLAG = 'NEXT_PUBLIC_CHAT_ELEMENT_REFINE'
const PAGE = 'app/builder/page.tsx', LIB = 'lib/chat-element-edit.ts', TWO = 'lib/chat-element-edit-2.ts'
const LAYOUT_ORIGIN = 'https://layout.example'

let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.stack ?? error).split('\n').slice(0, 6).join('\n       ')}`) }
}

const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-chat-element-edit-2-strip.mjs')
const {
  stripChatElementEdit2, BASE_COMMIT, CHAT_ELEMENT_EDIT_2_FILES, CHAT_ELEMENT_EDIT_2_SCOPE_FILES, CHAT_ELEMENT_EDIT_2_ENV_BLOCK, CHAT_ELEMENT_EDIT_2_SUBJECT, CHAT_ELEMENT_EDIT_2_MARKER_RE, CHAT_ELEMENT_EDIT_2_NEW_FILES,
} = stripModule

// ---- the recorded repro (E2E-2, 27 Oct 17:25Z) and the world built on it -------------------------------------------------------------------------------------------------------------------
const FIXTURE = JSON.parse(read('scripts/fixtures/chat-element-edit-2/e2e2-repro-element-edit.json'))
const DECK_ID = FIXTURE.deck.presentation_id
const SESSION = FIXTURE.session_id
const FRAME = FIXTURE.incoming_frame
const LAYOUT_IDS = ['slide_53be7c850f85', 'slide_7f86d3817444', 'slide_f9db90aa0e93', ...FIXTURE.synthetic_slide_ids_for_slides_4_and_5] // 1..3 observed, 4 and 5 synthetic
const OUTLINE_IDS = FIXTURE.synthetic_session_slide_ids_for_the_other_slides // slide 2's is the observed one
assert.equal(OUTLINE_IDS[1], FIXTURE.studio_session_slide_id_for_slide_2)
const frame = (payload = {}) => ({ type: 'element_edit', payload: { ...FRAME.payload, ...payload } })
const inventoryBody = (ids, presentationId = DECK_ID) => ({ presentation_id: presentationId, slide_count: ids.length, slides: ids.map((slide_id, slide_index) => ({ slide_id, slide_index, layout: 'content', content_version: 'v1', thumbnail_url: null, title: null })) })

/** The viewer's slide 2, as getSlideGenerationContext reports it (the recorded shape of scripts/fixtures/chat-element-edit/layout-transcripts.json). */
const slideElements = () => [
  { element_id: 'image_95d79040', renderer_type: 'image', component_type: 'IMAGE', position: { gridRow: '6/14', gridColumn: '18/31' }, summary: 'Hello', properties: { is_placeholder: false, locked: false, visible: true } },
  { element_id: 'el_text_a', renderer_type: 'textbox', component_type: 'TEXT_BOX', position: { gridRow: '4/6', gridColumn: '3/16' }, summary: 'Hello', properties: { is_placeholder: false, locked: false, visible: true } },
]

// ---- the real modules in a vm (the code under test, or a mutant of it) -------------------------------------------------------------------------------------------------------------------
const transpiled = new Map()
const transpile = (file, text) => { const key = `${file}\0${sha(text)}`; if (!transpiled.has(key)) transpiled.set(key, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText); return transpiled.get(key) }
function makeLibs({ env = {}, overrides = {}, clock = null } = {}) {
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const out = transpile(file, overrides[file] ?? read(file))
    const sandbox = { module, exports: module.exports, process: { env }, console, URL, Promise, Error, JSON, Math, Set, Map, Object, Array, Number, String, Boolean, RegExp, Symbol, parseFloat, isFinite,
      setTimeout: clock ? clock.setTimeout : setTimeout, clearTimeout: clock ? clock.clearTimeout : clearTimeout,
      require(spec) {
        if (spec.startsWith('@/')) {
          const base = spec.slice(2)
          for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(repo, base + ext))) return load(base + ext)
        }
        throw new Error(`unexpected dependency ${spec} of ${file}`)
      } }
    vm.runInNewContext(out, sandbox, { filename: file })
    return module.exports
  }
  const libs = { lib: load(LIB), wire: load('lib/chat-element-edit-wire.ts'), save: load('lib/chat-element-edit-save.ts'), two: load(TWO), inventory: load('lib/slide-rail-identity.ts') }
  // the refine libs are loaded when a selection proof asks for them
  Object.defineProperty(libs, 'refine', { get: () => load('lib/chat-element-refine.ts') }); Object.defineProperty(libs, 'refineWire', { get: () => load('lib/chat-element-refine-wire.ts') })
  return libs
}

// ---- the page: the runner assignment and the helper, cut out of app/builder/page.tsx and run with the page's values -----------------------------------------------------------------
const parsePage = text => ts.createSourceFile(PAGE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function walk(node, visit) {
  const hit = visit(node)
  if (hit) return hit
  let found = null
  ts.forEachChild(node, child => { if (!found) found = walk(child, visit) })
  return found
}
const assignmentRight = (source, left) => walk(source, node => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(source) === left ? node.right : null)
const declarationInitializer = (source, name) => walk(source, node => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer ? node.initializer : null)

/**
 * One window: a viewer showing the deck (stand-in that answers in the recorded shapes), the page's runner over it, Layout's inventory behind a stand-in fetch, and the session's slide list.
 * `layout`: 'ok' | 'changed' | 'shorter' | 'unavailable' (404) | 'failed' (network) | 'hold' (the read waits for release()); `session`: the page's slideStructure.
 */
async function world({ flag = true, pageText = read(PAGE), libOverrides = {}, layout = 'ok', layoutIds = LAYOUT_IDS, session = 'restored', viewerSlides = 5, current = 1, owner = {}, editMode = true } = {}) {
  const clock = createClock()
  const env = { [EDIT_FLAG]: 'true', ...(flag ? { [FLAG]: 'true' } : {}) }
  const libs = makeLibs({ env, overrides: libOverrides, clock })
  const fetchLog = []
  let release = () => {}
  const fakeFetch = async (url, init) => {
    fetchLog.push({ url: String(url), cache: init?.cache ?? null, method: init?.method ?? 'GET' })
    const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
    if (layout === 'hold') await new Promise(resolve => { release = resolve })
    if (layout === 'failed') throw new TypeError('network')
    if (layout === 'unavailable') return answer(404, {})
    if (layout === 'shorter') return answer(200, inventoryBody(layoutIds.slice(0, 1)))
    if (layout === 'changed') return answer(200, inventoryBody([layoutIds[0], 'slide_aaaaaaaaaaaa', ...layoutIds.slice(1, 4)])) // a slide was added before the target: slide 2's id is now slide 3's
    return answer(200, inventoryBody(layoutIds))
  }
  // the viewer: slide `current` is shown; slide 2 (index 1) holds the image and a text box
  const calls = []
  const slides = Array.from({ length: viewerSlides }, (_, index) => ({ elements: index === 1 ? slideElements() : [] }))
  const shown = { current }
  const save = libs.save
  const unsaved = () => save.publishViewerSaveEvent({ status: 'unsaved', hasPendingChanges: true })
  const edit = (action, params) => {
    const element = slides[shown.current].elements.find(item => item.element_id === params.elementId)
    if (!element) throw new Error(`Element ${params.elementId} not found`)
    if (action === 'deleteElement') slides[shown.current].elements = slides[shown.current].elements.filter(item => item !== element)
    unsaved()
    return { success: true, action }
  }
  const sendElementCommand = async (action, params) => {
    calls.push({ route: 'element', action, params: plain(params) })
    if (action === 'getSlideGenerationContext') {
      const slide = slides[params.slideIndex]
      if (!slide) throw new Error(`Slide ${params.slideIndex} not found`)
      return { success: true, action, slide_index: params.slideIndex, slide_title: null, target_element_id: params.targetElementId, elements: slide.elements }
    }
    return edit(action, params)
  }
  const sendTextBoxCommand = async (action, params) => {
    calls.push({ route: 'textbox', action, params: plain(params) })
    if (action === 'saveAllChanges') { unsaved(); clock.setTimeout(() => save.publishViewerSaveEvent({ status: 'saved', hasPendingChanges: false }), 120); return { success: true } }
    return edit(action, params)
  }
  const unregister = save.registerChatEditViewer({ ensureEditMode: async () => editMode })
  const ownerRef = { current: { sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: DECK_ID, epoch: 0, ...owner } }
  const slideStructure = session === 'live' ? null : { slides: (session === 'layout-ids' ? LAYOUT_IDS : OUTLINE_IDS).map((slide_id, index) => ({ slide_id, slide_number: index + 1, title: `Slide ${index + 1}` })), metadata: { main_title: 'Deck' } }
  const gate = libs.lib.createElementEditGate()
  const sent = []
  const source = parsePage(pageText)
  const values = {
    CHAT_ELEMENT_EDIT_ENABLED: libs.wire.CHAT_ELEMENT_EDIT_ENABLED, runElementEditDirective: libs.lib.runElementEditDirective, chatElementEditGateRef: { current: gate },
    elementDirectiveGenerationOwnerRef: ownerRef, oneLiveTabSuperseded: false, templateModeOn: false, slideStructure, currentSlideIndexRef: shown,
    layoutServiceApis: { sendElementCommand, sendTextBoxCommand, goToSlide: async index => { shown.current = index } }, getChatEditViewer: save.getChatEditViewer, subscribeViewerSaveEvents: save.subscribeViewerSaveEvents,
    sendElementEditResult: result => { sent.push({ at: clock.now(), result: plain(result) }); return true }, setTimeout: clock.setTimeout, Promise,
    // the helper's own free names: the real inventory read and the real conversion (lib/chat-element-edit-2.ts), a stand-in for the network
    fetchSlideInventory: libs.inventory.fetchSlideInventory, getLayoutServiceUrl: () => LAYOUT_ORIGIN, fetch: fakeFetch, shownSlidesFromInventory: libs.two.shownSlidesFromInventory,
  }
  const helperNode = declarationInitializer(source, 'chatElementEdit2ShownSlides')
  if (helperNode) values.chatElementEdit2ShownSlides = compile(helperNode, source, 'chatElementEdit2ShownSlides')(values)
  const runnerNode = assignmentRight(source, 'elementEditDirectiveRunnerRef.current')
  assert.ok(runnerNode, 'the page assigns the element edit runner')
  const runner = compile(runnerNode, source, 'elementEditDirectiveRunnerRef.current')(values)
  const ownerHandle = { sessionId: SESSION, current: true, isCurrent() { return this.current } }
  return {
    clock, libs, calls, sent, fetchLog, ownerRef, ownerHandle, shown, slides, unregister, gate,
    release: () => release(),
    /** Delivers an element_edit frame to the page's runner and drives the virtual clock until a result is sent (or `forMs` pass). Returns the result, or null when none was sent. */
    async send(message, { forMs = 30_000 } = {}) {
      const before = sent.length
      runner(plain(message), ownerHandle)
      for (let spent = 0; sent.length === before && spent < forMs; spent += 50) await clock.advance(50)
      return sent.length > before ? sent.at(-1).result : null
    },
    /** Hands a frame to the page's runner without driving the clock (several in flight, or a switch in the middle). */
    start(message) { runner(plain(message), ownerHandle) },
    switchDeck() { ownerRef.current = { ...ownerRef.current, epoch: ownerRef.current.epoch + 1 } },
    actions: () => calls.map(call => call.action),
  }
}
const run = async (options, message = frame()) => { const w = await world(options); try { return { w, result: await w.send(message) } } finally { w.unregister() } }

// ---- 1. the repro --------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('1. E2E-2\'s repro through the real runner and the real page wiring')
await check('the repro is what the finding says: a restored session list of outline UUIDs, Layout\'s "slide_..." ids, the directive carrying Layout\'s id, slide 2 open', () => {
  assert.equal(FRAME.payload.slide_id, LAYOUT_IDS[1]); assert.match(FRAME.payload.slide_id, /^slide_[0-9a-f]{12}$/); assert.match(OUTLINE_IDS[1], /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  assert.equal(FRAME.payload.slide_index, 1); assert.equal(FRAME.payload.presentation_id, DECK_ID)
  assert.deepEqual(FIXTURE.studio_answer_recorded, { ok: false, error_code: 'SLIDE_CHANGED', same_millisecond: true })
})
await check('flag OFF (today): the edit on the shown slide answers SLIDE_CHANGED at once and the viewer is never touched (the bug)', async () => {
  const { w, result } = await run({ flag: false })
  assert.deepEqual(result, { directive_id: FRAME.payload.directive_id, ok: false, error_code: 'SLIDE_CHANGED' })
  assert.deepEqual(w.calls, []); assert.deepEqual(w.fetchLog, [])
})
await check('flag ON: the same frame applies (order back on the image, Layout\'s Arrange intent) and answers ok:true only after the save ack; one inventory read, a plain GET of the shown deck', async () => {
  const { w, result } = await run({ flag: true })
  assert.deepEqual(result, { directive_id: FRAME.payload.directive_id, ok: true })
  assert.deepEqual(w.actions(), ['getSlideGenerationContext', 'sendToBack', 'saveAllChanges'])
  assert.deepEqual(w.calls[1].params, { elementId: 'image_95d79040', intent: 'arrange' })
  assert.equal(w.fetchLog.length, 1); assert.equal(w.fetchLog[0].url, `${LAYOUT_ORIGIN}/api/presentations/${DECK_ID}/slides/inventory`); assert.equal(w.fetchLog[0].method, 'GET'); assert.equal(w.fetchLog[0].cache, 'no-store')
  assert.ok(w.sent[0].at >= 120, 'not before the viewer\'s save ack')
})
await check('flag ON: E2E-2\'s two earlier edits ("move the image to the top right", "delete the image") apply too, built on the recorded frame\'s shape', async () => {
  for (const [directive, extra, action] of [['ele_8f402bf8305f', { op: 'place', place: { h: 'right', v: 'top' } }, 'alignElement'], ['ele_98c0edeb96f2', { op: 'delete' }, 'deleteElement']]) {
    const message = frame({ directive_id: directive, ...extra }); delete message.payload.order
    const off = await run({ flag: false }, message), on = await run({ flag: true }, message)
    assert.equal(off.result.error_code, 'SLIDE_CHANGED', `${directive} flag off`); assert.deepEqual(on.result, { directive_id: directive, ok: true }, `${directive} flag on`); assert.ok(on.w.actions().includes(action), action)
  }
})
await check('before a reload (no session list) and with a list that carries Layout\'s own ids, the edit applies with the flag off and on, with the same viewer traffic', async () => {
  for (const session of ['live', 'layout-ids']) {
    const off = await run({ flag: false, session }), on = await run({ flag: true, session })
    assert.deepEqual(off.result, { directive_id: FRAME.payload.directive_id, ok: true }, `${session} off`); assert.deepEqual(on.result, off.result, `${session} on`)
    assert.deepEqual(on.w.calls, off.w.calls, `${session}: the viewer sees the same commands`)
  }
})
await check('the slide not shown yet: the runner goes to it, waits, and the second id check reads the same snapshot (flag on)', async () => {
  const { w, result } = await run({ flag: true, current: 0 })
  assert.deepEqual(result, { directive_id: FRAME.payload.directive_id, ok: true }); assert.equal(w.shown.current, 1); assert.equal(w.fetchLog.length, 1)
})

// ---- 2. a slide that really changed still answers SLIDE_CHANGED -----------------------------------------------------------------------------------------------------------------------
console.log('2. A slide that really changed, ids unreadable, a deck switch')
await check('Layout\'s slide at the index is another slide (one inserted before it): SLIDE_CHANGED, flag on and off, and the viewer is never touched', async () => {
  for (const flag of [false, true]) {
    const { w, result } = await run({ flag, layout: 'changed' })
    assert.deepEqual(result, { directive_id: FRAME.payload.directive_id, ok: false, error_code: 'SLIDE_CHANGED' }, `flag ${flag}`); assert.deepEqual(w.calls, [], `flag ${flag}`)
  }
})
await check('the deck has fewer slides now than the directive\'s index: SLIDE_CHANGED, flag on and off', async () => {
  for (const flag of [false, true]) { const { w, result } = await run({ flag, layout: 'shorter' }); assert.equal(result.error_code, 'SLIDE_CHANGED', `flag ${flag}`); assert.deepEqual(w.calls, []) }
})
await check('a directive for another deck than the one shown: SLIDE_CHANGED, flag on and off, and Layout is not read', async () => {
  for (const flag of [false, true]) {
    const { w, result } = await run({ flag }, frame({ presentation_id: 'ffffffff-0000-4000-8000-000000000000' }))
    assert.equal(result.error_code, 'SLIDE_CHANGED', `flag ${flag}`); assert.deepEqual(w.fetchLog, []); assert.deepEqual(w.calls, [])
  }
})
await check('a directive whose slide_id is not the shown slide\'s (the user reordered): SLIDE_CHANGED, flag on', async () => {
  const { w, result } = await run({ flag: true }, frame({ slide_id: 'slide_f9db90aa0e93' }))
  assert.equal(result.error_code, 'SLIDE_CHANGED'); assert.deepEqual(w.calls, [])
})
await check('Layout\'s ids unreadable (inventory 404, or the network fails): the index check stands alone, the edit applies; a slide that is gone is still SLIDE_CHANGED (the viewer says "Slide N not found")', async () => {
  for (const layout of ['unavailable', 'failed']) {
    const ok = await run({ flag: true, layout }); assert.deepEqual(ok.result, { directive_id: FRAME.payload.directive_id, ok: true }, layout)
    const gone = await run({ flag: true, layout, viewerSlides: 1 }, frame()); assert.equal(gone.result.error_code, 'SLIDE_CHANGED', `${layout}: slide gone`)
    const missing = await run({ flag: true, layout }, frame({ element_id: 'image_deleted' })); assert.equal(missing.result.error_code, 'ELEMENT_NOT_FOUND', `${layout}: element gone`)
  }
})
await check('the deck is switched while the inventory is being read: nothing is answered and the viewer is untouched (flag on)', async () => {
  const w = await world({ flag: true, layout: 'hold' })
  try {
    w.start(frame()); await w.clock.advance(200); assert.equal(w.fetchLog.length, 1, 'the read is waiting'); w.switchDeck(); w.release(); await w.clock.advance(5_000)
    assert.equal(w.sent.length, 0); assert.deepEqual(w.calls, [])
  } finally { w.unregister() }
})
await check('a repeated directive is not read or answered twice, and a second edit while one runs is BUSY (the gate is the base\'s)', async () => {
  const w = await world({ flag: true })
  try {
    w.start(frame()); w.start(frame({ directive_id: 'ele_000000000002' })); await w.clock.advance(3_000)
    assert.deepEqual(w.sent.map(item => item.result), [{ directive_id: 'ele_000000000002', ok: false, error_code: 'BUSY' }, { directive_id: FRAME.payload.directive_id, ok: true }])
    w.start(frame()); await w.clock.advance(3_000); assert.equal(w.sent.length, 2, 'the same directive_id again sends nothing'); assert.equal(w.fetchLog.length, 1, 'and reads nothing')
  } finally { w.unregister() }
})
/** The pure rules of lib/chat-element-edit-2.ts (`overrides`: a mutant of it). */
function unitRules(overrides = {}) {
  const { two } = makeLibs({ env: { [FLAG]: 'true' }, overrides })
  assert.deepEqual(plain(two.shownSlidesFromInventory({ slideCount: 2, slides: [{ slideId: 'a' }, { slideId: 'b' }] })), { slideCount: 2, slideIds: ['a', 'b'] })
  for (const bad of [null, undefined, {}, { slideCount: 0, slides: [] }, { slideCount: 1.5, slides: [{ slideId: 'a' }] }, { slideCount: 1 }]) assert.equal(two.shownSlidesFromInventory(bad), null)
  const deps = { slideCount: () => 9, slideIdAt: () => 'old' }
  return Promise.all([two.withShownSlides({ ...deps, shownSlides: async () => ({ slideCount: 3, slideIds: ['x', null, 'z'] }) }, 'p'), two.withShownSlides({ ...deps, shownSlides: async () => { throw new Error('x') } }, 'p'), two.withShownSlides({ ...deps, shownSlides: async () => null }, 'p')]).then(([ok, thrown, none]) => {
    assert.deepEqual([ok.slideCount(), ok.slideIdAt(0), ok.slideIdAt(1), ok.slideIdAt(5), ok.slideIdAt(-1)], [3, 'x', null, null, null])
    for (const unreadable of [thrown, none]) assert.deepEqual([unreadable.slideCount(), unreadable.slideIdAt(0)], [0, null])
  })
}
await check('the unit rules: a usable inventory gives its count and ids; anything else gives none; a read that throws gives none', () => unitRules())

// ---- 3. the selection code ---------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('3. The stale element reference, through the page\'s own selection code')
/**
 * The page's selection code, cut out of app/builder/page.tsx and run: the selection effects (those that write chatElementSelectionRef, in source order, with their dependency lists), the two selection callbacks of the
 * presentation area, the `getChatElementReference` option and the '@' Element entry's getElement. React is modelled by its one relevant rule: an effect runs after a commit in which one of its dependencies changed (Object.is).
 */
function selectionWorld({ flag = true, refine = true, pageText = read(PAGE), libOverrides = {} } = {}) {
  const libs = makeLibs({ env: { [EDIT_FLAG]: 'true', [REFINE_FLAG]: refine ? 'true' : 'false', ...(flag ? { [FLAG]: 'true' } : {}) }, overrides: libOverrides })
  const source = parsePage(pageText)
  const effectNodes = []
  walk(source, node => { if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('chatElementSelectionRef')) effectNodes.push(node); return null })
  const attr = (name, needle) => walk(source, node => ts.isJsxAttribute(node) && node.name.getText(source) === name && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && node.initializer.expression.getText(source).includes(needle) ? node.initializer.expression : null)
  const textBoxCallback = attr('onTextBoxSelected', 'setSelectedTextBoxId(elementId)'), elementCallback = attr('onElementSelected', 'setSelectedElementId(elementId)')
  const state = {
    selectedTextBoxId: null, selectedElementId: null, selectedElementType: null, selectedElementProperties: null, currentSlideIndex: 1, slideComposerOverride: null, effectivePresentationId: DECK_ID,
    slideStructure: { slides: OUTLINE_IDS.map(slide_id => ({ slide_id })) },
  }
  const ref = { current: null }, slideRef = { current: state.currentSlideIndex }
  const pending = {}
  const values = () => ({
    ...state, CHAT_ELEMENT_REFINE_ENABLED: libs.refineWire.CHAT_ELEMENT_REFINE_ENABLED, CHAT_ELEMENT_EDIT_2_ENABLED: libs.two.CHAT_ELEMENT_EDIT_2_ENABLED, chatElementSelectionRef: ref, currentSlideIndexRef: slideRef,
    chatElementSelectionFor: libs.two.chatElementSelectionFor, dropChatElementSelection: libs.two.dropChatElementSelection, dropChatElementSelectionOffSlide: libs.two.dropChatElementSelectionOffSlide,
    // the callbacks' other names (the page's panel state), as stand-ins that record what they would set
    studioShell: false, closeStudioFormat() {}, features: { useTextLabsGeneration: true }, bringToFront() {}, isTextLabsMappable: () => true,
    setSelectedTextBoxId: v => { pending.selectedTextBoxId = v }, setSelectedTextBoxFormatting() {}, setShowTextBoxPanel() {}, setShowElementPanel() {}, setShowFormatPanel() {},
    setSelectedElementId: v => { pending.selectedElementId = v }, setSelectedElementType: v => { pending.selectedElementType = v }, setSelectedElementProperties() {},
  })
  const effects = effectNodes.map(node => {
    const depsNode = node.arguments[1]
    return { callback: compile(node.arguments[0], source, 'effect'), deps: depsNode.elements.map(element => compile(element, source, 'dep')), last: null }
  })
  const onTextBoxSelected = textBoxCallback ? compile(textBoxCallback, source, 'onTextBoxSelected') : null
  const onElementSelected = elementCallback ? compile(elementCallback, source, 'onElementSelected') : null
  /** One commit: state takes the changes, the ref the page keeps in step with currentSlideIndex follows, and every effect whose dependencies changed runs, in source order. */
  const commit = (changes = {}) => {
    Object.assign(state, changes); slideRef.current = state.currentSlideIndex
    const v = values()
    for (const effect of effects) {
      const now = effect.deps.map(dep => dep(v))
      if (!effect.last || now.some((item, index) => !Object.is(item, effect.last[index]))) { effect.last = now; effect.callback(v)() }
    }
  }
  const event = (callback, ...args) => { for (const key of Object.keys(pending)) delete pending[key]; callback(values())(...args); commit({ ...pending }) }
  // the reference the page hands the hook (the refine option, then any later option that overrides it) and the "@" Element entry (chatCommandsPage's property, then any statement that replaces it), the page's own code
  const refValues = { ...values(), chatElementReferenceFor: libs.refine.chatElementReferenceFor, referenceWithoutOutlineId: libs.two.referenceWithoutOutlineId }
  const helperNode = declarationInitializer(source, 'chatElementEdit2Reference')
  if (helperNode) refValues.chatElementEdit2Reference = compile(helperNode, source, 'chatElementEdit2Reference')(refValues)
  const hookCall = walk(source, node => ts.isCallExpression(node) && node.expression.getText(source) === 'useDecksterWebSocketV2' ? node : null)
  const hookOptions = Object.assign({}, ...hookCall.arguments[0].properties.filter(item => ts.isSpreadAssignment(item) && item.expression.getText(source).includes('getChatElementReference')).map(item => compile(item.expression, source, 'hook option')(refValues)))
  const getElementNode = walk(source, node => ts.isPropertyAssignment(node) && node.name.getText(source) === 'getElement' && node.initializer.getText(source).includes('chatElementSelectionRef') ? node.initializer : null)
  const commandsPage = { getElement: compile(getElementNode, source, 'getElement')(refValues) }
  const getElementOverride = walk(source, node => ts.isIfStatement(node) && node.getText(source).includes('chatCommandsPage.getElement =') ? node : null)
  if (getElementOverride) compile(`() => { ${getElementOverride.getText(source)} }`, source, 'getElement override')({ ...refValues, chatCommandsPage: commandsPage })()
  const reference = () => commandsPage.getElement()
  const hookReference = () => (hookOptions.getChatElementReference ? hookOptions.getChatElementReference() : null)
  /** What a send carries: the real wire function over the reference the page hands the hook (the hook's call site is pinned below). */
  const send = () => plain(libs.refineWire.addChatElementRefineFields({ text: 'x', client_caps: ['mdc1'], references: [] }, flagRefine() ? hookReference() : null).references)
  const flagRefine = () => libs.refineWire.CHAT_ELEMENT_REFINE_ENABLED
  commit()
  return {
    effects: effects.length, libs, state, ref, send, reference, commit,
    hasCallbacks: Boolean(onTextBoxSelected && onElementSelected),
    selectTextBox: (id, slide) => { if (slide !== undefined) { state.currentSlideIndex = slide; slideRef.current = slide } event(onTextBoxSelected, id, null, 'TEXT_BOX') },
    selectElement: (id, type, slide) => { if (slide !== undefined) { state.currentSlideIndex = slide; slideRef.current = slide } event(onElementSelected, id, type, {}) },
    undo: () => commit({ slideComposerOverride: { presentationId: DECK_ID, refreshToken: (state.slideComposerOverride?.refreshToken ?? 0) + 1 } }),
    goToSlide: index => commit({ currentSlideIndex: index }),
  }
}
const TITLE = FIXTURE.stale_reference.element_id, IMAGE = 'image_95d79040'
await check('the page has the two selection effects and, with this change, two drop effects and the two marked callback lines; the hook\'s call site reads the page\'s reference', () => {
  assert.equal(selectionWorld({ flag: false }).effects, 4); assert.ok(selectionWorld({ flag: false }).hasCallbacks)
  assert.match(read('hooks/use-deckster-websocket-v2.ts'), /if \(CHAT_ELEMENT_REFINE_ENABLED\) addChatElementRefineFields\(message\.data as unknown as Record<string, unknown>, transportCallbacksRef\.current\.getChatElementReference\?\.\(\) \?\? null\);/)
  assert.match(read(PAGE), /getChatElementReference: \(\) => chatElementReferenceFor\(chatElementSelectionRef\.current\)/)
})
await check('flag OFF (today): after the E2E-2 sequence (select the image, select the title, Undo) the title is still sent, hidden; clicking the image does not replace it; the "@" entry names it too (the bugs)', () => {
  const s = selectionWorld({ flag: false })
  s.selectElement(IMAGE, 'image'); assert.equal(s.send()[0].element_id, IMAGE)
  s.selectTextBox(TITLE); assert.equal(s.send()[0].element_id, TITLE, 'the last selection wins while the states change')
  s.undo(); assert.equal(s.send()[0].element_id, TITLE, 'Undo removed the title; it is still sent'); assert.equal(s.reference().element_id, TITLE, 'and the "@" Element entry reads the same record')
  s.selectElement(IMAGE, 'image'); assert.equal(s.send()[0].element_id, TITLE, 'the image was already the page\'s selectedElementId: no state changed, no effect ran, the record stays the title')
})
await check('flag ON: Undo drops the reference (nothing is sent, the "@" entry is empty); clicking the image afterwards records the image; selecting another element replaces it', () => {
  const s = selectionWorld({ flag: true })
  s.selectElement(IMAGE, 'image'); s.selectTextBox(TITLE); assert.equal(s.send()[0].element_id, TITLE)
  s.undo(); assert.deepEqual(s.send(), [], 'no reference after the Undo'); assert.equal(s.reference(), null, 'nor in the "@" entry')
  s.selectElement(IMAGE, 'image'); const [now] = s.send(); assert.deepEqual([now.element_id, now.element_type, now.slide_index, now.label], [IMAGE, 'IMAGE', 1, 'Image · slide 2'])
  s.selectElement('chart_7f3a', 'chart'); assert.equal(s.send()[0].element_id, 'chart_7f3a', 'another element replaces it'); assert.equal(s.send()[0].element_type, 'CHART')
  s.selectTextBox('el_text_a'); assert.deepEqual([s.send()[0].element_id, s.send()[0].element_type], ['el_text_a', 'TEXT_BOX'])
})
await check('flag ON: the shown slide is not the selection\'s slide: dropped (flag off keeps it); a selection on the new slide is kept; unrelated renders keep it', () => {
  for (const flag of [false, true]) {
    const s = selectionWorld({ flag })
    s.selectElement(IMAGE, 'image'); s.commit({ selectedElementProperties: { x: 1 } }); assert.equal(s.send().length, 1, 'an unrelated render keeps it')
    s.goToSlide(2); assert.equal(s.send().length, flag ? 0 : 1, `flag ${flag}: moved to slide 3`)
    s.selectElement('chart_7f3a', 'chart', 2); assert.equal(s.send()[0].slide_index, 2, 'selected on the new slide'); s.commit({ selectedElementProperties: { y: 1 } }); assert.equal(s.send().length, 1, 'kept on its own slide')
  }
})
await check('flag ON: another deck on screen (the presentation changes) drops it; the record carries the page\'s slide id as the flag-off effect does', () => {
  const s = selectionWorld({ flag: true })
  s.selectElement(IMAGE, 'image'); assert.equal(s.ref.current.slideId, OUTLINE_IDS[1]); s.commit({ effectivePresentationId: 'other-deck' }); assert.deepEqual(s.send(), [])
  const effectRecord = selectionWorld({ flag: false }); effectRecord.selectElement(IMAGE, 'image'); assert.deepEqual(plain(effectRecord.ref.current), plain(selectionWorld({ flag: true }).libs.two.chatElementSelectionFor(IMAGE, 'image', 1, effectRecord.state.slideStructure.slides)), 'the same record either way')
})
await check('flag ON with the refine flag OFF: the callbacks and effects write and drop nothing (no reference is ever sent)', () => {
  const s = selectionWorld({ flag: true, refine: false })
  s.selectElement(IMAGE, 'image'); assert.equal(s.ref.current, null); assert.deepEqual(s.send(), [])
})
await check('a text box and a non-text element deselected still clear the record, as before (the base effects are untouched), flag on and off', () => {
  for (const flag of [false, true]) {
    const s = selectionWorld({ flag }); s.selectTextBox(TITLE); s.commit({ selectedTextBoxId: null }); assert.deepEqual(s.send(), [], `text box, flag ${flag}`)
    s.selectElement(IMAGE, 'image'); s.commit({ selectedElementId: null, selectedElementType: null }); assert.deepEqual(s.send(), [], `element, flag ${flag}`)
  }
})

await check('the reference names no slide id with the flag on (the refine path and the "@" Element entry), the outline UUID with it off; Director\'s echo (ref.slide_id or Layout\'s id) applies after a reload with the flag on, and the old UUID reference would be refused', async () => {
  const echo = reference => reference.slide_id || LAYOUT_IDS[reference.slide_index] // DIRECTOR-2: element edit uses `ref.slide_id or layout_slide_id` (mdc_actions.py on uat)
  const edit = (reference, extra = {}) => frame({ slide_id: echo(reference), slide_index: reference.slide_index, element_id: reference.element_id, directive_id: 'ele_000000000021', ...extra })
  for (const flag of [false, true]) {
    const s = selectionWorld({ flag }); s.selectElement(IMAGE, 'image')
    const [sent] = s.send(), mention = s.reference()
    assert.deepEqual([sent.slide_id, mention.slide_id], flag ? [null, null] : [OUTLINE_IDS[1], OUTLINE_IDS[1]], `flag ${flag}`)
    assert.equal(sent.element_id, IMAGE); assert.equal(sent.slide_index, 1)
    const applied = await run({ flag, session: 'restored' }, edit(sent)); assert.deepEqual(applied.result, { directive_id: 'ele_000000000021', ok: true }, `the echoed directive applies after a reload, flag ${flag}`)
    const viaMention = await run({ flag, session: 'restored' }, edit(mention)); assert.equal(viaMention.result.ok, true, `and for the "@" token, flag ${flag}`)
  }
  const old = await run({ flag: true, session: 'restored' }, edit({ slide_id: OUTLINE_IDS[1], slide_index: 1, element_id: IMAGE })); assert.equal(old.result.error_code, 'SLIDE_CHANGED', 'a reference that still carried the UUID would come back refused with the flag on')
})

// ---- 4. flag off is the base ------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('4. Flag off is identical to the base')
const baseFile = rel => git('show', `${BASE_COMMIT}:${rel}`)
await check('the strip gives each edited file its base back, byte for byte; the new lib is not in the base; the flag is named in no other source file', () => {
  for (const rel of CHAT_ELEMENT_EDIT_2_FILES) assert.equal(stripChatElementEdit2(rel, read(rel)), baseFile(rel), `${rel}: without its marked lines the file is the base's`)
  assert.equal(stripChatElementEdit2('hooks/use-deckster-websocket-v2.ts', 'x'), 'x', 'a file the change does not own comes back untouched')
  assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${TWO}`))
  const readers = git('grep', '-l', `process.env.${FLAG}`, '--', 'app', 'lib', 'hooks', 'components', 'types').split('\n').filter(Boolean).sort()
  assert.deepEqual(readers, [TWO], 'the one place the flag is read')
  for (const rel of CHAT_ELEMENT_EDIT_2_FILES) assert.ok(!stripChatElementEdit2(rel, read(rel)).includes(FLAG), `${rel}: names the flag only on marked lines`)
})
const MATRIX = [
  ['restored list, delete', { session: 'restored' }, frame({ op: 'delete', directive_id: 'ele_000000000011' })],
  ['restored list, order back', { session: 'restored' }, frame()],
  ['restored list, place', { session: 'restored' }, frame({ op: 'place', place: { h: 'right', v: 'top' }, directive_id: 'ele_000000000012' })],
  ['no list (before a reload), order', { session: 'live' }, frame({ directive_id: 'ele_000000000013' })],
  ['list with Layout ids, order', { session: 'layout-ids' }, frame({ directive_id: 'ele_000000000014' })],
  ['another deck', { session: 'restored' }, frame({ presentation_id: 'ffffffff-0000-4000-8000-000000000000', directive_id: 'ele_000000000015' })],
  ['another slide id, list with Layout ids', { session: 'layout-ids' }, frame({ slide_id: 'slide_f9db90aa0e93', directive_id: 'ele_000000000016' })],
  ['slide gone', { session: 'live', viewerSlides: 1 }, frame({ directive_id: 'ele_000000000017' })],
  ['element gone', { session: 'live' }, frame({ element_id: 'image_deleted', directive_id: 'ele_000000000018' })],
  ['navigated first', { session: 'layout-ids', current: 0 }, frame({ directive_id: 'ele_000000000019' })],
  ['bad op', { session: 'live' }, frame({ op: 'rotate', directive_id: 'ele_00000000001a' })],
]
async function matrixOf({ pageText, libText }) {
  const out = {}, fetches = []
  for (const [name, options, message] of MATRIX) {
    const w = await world({ flag: false, pageText, libOverrides: libText === null ? {} : { [LIB]: libText }, ...options })
    try { out[name] = { result: await w.send(message), calls: w.calls, sent: w.sent.map(item => item.result) } } finally { w.unregister() }
    fetches.push(...w.fetchLog)
  }
  return { out, fetches }
}
await check('flag off, the base code and this tree answer a matrix of directives with the same results and the same viewer traffic (hashed), and this tree reads nothing from Layout', async () => {
  const base = await matrixOf({ pageText: baseFile(PAGE), libText: baseFile(LIB) }), head = await matrixOf({ pageText: read(PAGE), libText: null })
  assert.equal(sha(JSON.stringify(head.out)), sha(JSON.stringify(base.out))); assert.deepEqual(head.fetches, []); assert.deepEqual(base.fetches, [])
  assert.equal(Object.keys(head.out).length, MATRIX.length)
  assert.deepEqual(head.out['restored list, order back'].result, { directive_id: FRAME.payload.directive_id, ok: false, error_code: 'SLIDE_CHANGED' }, 'the matrix holds the bug: it is today\'s answer')
  assert.equal(head.out['no list (before a reload), order'].result.ok, true)
  console.log(`       flag-off hash ${sha(JSON.stringify(head.out)).slice(0, 16)} over ${MATRIX.length} directives (base ${sha(JSON.stringify(base.out)).slice(0, 16)})`)
})
await check('flag off, the selection code behaves as the base\'s: the same records and references for the E2E-2 sequence (hashed against the base page)', () => {
  const sequence = pageText => { const s = selectionWorld({ flag: false, pageText }); const log = []; const step = f => { f(); log.push(plain(s.ref.current)) }
    step(() => s.selectElement(IMAGE, 'image')); step(() => s.selectTextBox(TITLE)); step(() => s.undo()); step(() => s.selectElement(IMAGE, 'image')); step(() => s.goToSlide(2)); step(() => s.commit({ selectedTextBoxId: null })); return log }
  assert.equal(sha(JSON.stringify(sequence(read(PAGE)))), sha(JSON.stringify(sequence(baseFile(PAGE)))))
})

// ---- 5. mutants -------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('5. Mutants')
const mutate = (text, from, to, label) => { const at = text.indexOf(from); if (at === -1 || text.indexOf(from, at + 1) !== -1) throw new Error(`mutant "${label}": target ${JSON.stringify(from.slice(0, 70))} not found exactly once`); return text.replace(from, () => to) }
/** The expectations of 1-3 on one mutant (the runner, the helper or the page's wiring changed): must throw. */
async function expectations({ pageText = read(PAGE), libOverrides = {} } = {}) {
  const on = await run({ flag: true, pageText, libOverrides }); assert.deepEqual(on.result, { directive_id: FRAME.payload.directive_id, ok: true }, 'the repro applies'); assert.equal(on.w.fetchLog.length, 1)
  const off = await run({ flag: false, pageText, libOverrides }); assert.equal(off.result.error_code, 'SLIDE_CHANGED', 'flag off is today\'s'); assert.deepEqual(off.w.fetchLog, [], 'flag off reads nothing'); assert.deepEqual(off.w.calls, [])
  for (const flag of [false, true]) {
    assert.equal((await run({ flag, pageText, libOverrides, layout: 'changed' })).result.error_code, 'SLIDE_CHANGED', `another slide, flag ${flag}`)
    assert.equal((await run({ flag, pageText, libOverrides, layout: 'shorter' })).result.error_code, 'SLIDE_CHANGED', `fewer slides, flag ${flag}`)
  }
  const unreadable = await run({ flag: true, pageText, libOverrides, layout: 'unavailable' }); assert.equal(unreadable.result.ok, true, 'unreadable ids fall back to the index check')
  const elsewhere = await run({ flag: true, pageText, libOverrides }, frame({ presentation_id: 'ffffffff-0000-4000-8000-000000000000' })); assert.equal(elsewhere.result.error_code, 'SLIDE_CHANGED'); assert.deepEqual(elsewhere.w.fetchLog, [], 'another deck is refused before Layout is read')
  await unitRules(libOverrides)
  assert.equal((await run({ flag: true, pageText, libOverrides }, frame({ slide_id: 'slide_f9db90aa0e93' }))).result.error_code, 'SLIDE_CHANGED', 'a different slide id is refused')
  const w = await world({ flag: true, layout: 'hold', pageText, libOverrides })
  try { w.start(frame()); await w.clock.advance(200); w.switchDeck(); w.release(); await w.clock.advance(5_000); assert.equal(w.sent.length, 0, 'a deck switch during the read answers nothing'); assert.deepEqual(w.calls, []) } finally { w.unregister() }
}
async function selectionExpectations(options) {
  const off = selectionWorld({ flag: false, ...options }), on = selectionWorld({ flag: true, ...options })
  off.selectElement(IMAGE, 'image'); assert.equal(off.send()[0].slide_id, OUTLINE_IDS[1], 'flag off: the outline UUID, as today'); assert.equal(off.reference().slide_id, OUTLINE_IDS[1], 'in the "@" entry too'); off.selectTextBox(TITLE); off.undo(); assert.equal(off.send()[0].element_id, TITLE, 'flag off is today\'s'); off.selectElement(IMAGE, 'image'); assert.equal(off.send()[0].element_id, TITLE, 'and a click on the held image does not replace it')
  off.selectElement(IMAGE, 'image'); off.selectTextBox('el_text_a'); off.selectElement(IMAGE, 'image'); off.commit({ selectedTextBoxId: TITLE }); off.selectTextBox(TITLE); assert.equal(off.send()[0].element_id, TITLE, 'the state effect records a changed selection')
  const held = selectionWorld({ flag: false, ...options }); held.selectTextBox(TITLE); held.selectElement(IMAGE, 'image'); held.selectTextBox(TITLE); assert.equal(held.send()[0].element_id, IMAGE, 'flag off: a click on the held text box does not replace the record')
  on.selectElement(IMAGE, 'image'); on.selectTextBox(TITLE); assert.equal(on.send()[0].element_id, TITLE)
  on.undo(); assert.deepEqual(on.send(), [], 'dropped by the Undo'); on.selectTextBox(TITLE); assert.equal(on.send()[0].element_id, TITLE, 'a click on the held text box records it')
  on.undo(); on.selectElement(IMAGE, 'image'); assert.deepEqual([on.send()[0].element_id, on.send()[0].element_type, on.send()[0].slide_index, on.send()[0].slide_id], [IMAGE, 'IMAGE', 1, null], 'a click on the held element records it, on its slide, naming no slide id'); assert.equal(on.reference().slide_id, null, 'nor does the "@" entry'); on.selectElement('chart_7f3a', 'chart'); assert.equal(on.send()[0].element_id, 'chart_7f3a')
  on.commit({ selectedElementProperties: {} }); assert.equal(on.send().length, 1, 'kept on an unrelated render'); on.goToSlide(2); assert.deepEqual(on.send(), [], 'dropped on another slide')
  on.selectElement(IMAGE, 'image', 2); on.commit({ effectivePresentationId: 'other-deck' }); assert.deepEqual(on.send(), [], 'dropped on another deck')
  const noRefine = selectionWorld({ flag: true, refine: false, ...options }); noRefine.selectElement(IMAGE, 'image'); noRefine.selectTextBox(TITLE); assert.equal(noRefine.ref.current, null)
}
const libText = read(LIB), pageText = read(PAGE), twoText = read(TWO)
await check('the unmutated code passes the expectations the mutants run against (the expectations can pass)', async () => { await expectations(); await selectionExpectations() })
const runnerMutants = [
  ['the shown deck\'s ids are never read (the old slideStructure check stands)', LIB, "if (CHAT_ELEMENT_EDIT_2_ENABLED && deps.shownSlides) {", "if (false && deps.shownSlides) {"],
  ['the flag is ignored (always on)', TWO, "process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2 === 'true'", 'true'],
  ['the flag is read loosely (unset is on)', TWO, "process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2 === 'true'", "process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2 !== 'false'"],
  ['unreadable ids refuse the edit (the old list stays in place)', TWO, "if (!shown) return { ...deps, slideCount: () => 0, slideIdAt: () => null }", 'if (!shown) return deps'],
  ['the ids are never compared (a different slide is accepted)', TWO, "slideIdAt: (slideIndex: number) => (Number.isInteger(slideIndex) && slideIndex >= 0 ? known.slideIds[slideIndex] ?? null : null) }", 'slideIdAt: () => null }'],
  ['the count is never used (a deck with fewer slides is accepted)', TWO, "return { ...deps, slideCount: () => known.slideCount,", 'return { ...deps, slideCount: () => 0,'],
  ['the id at the wrong index (off by one)', TWO, 'known.slideIds[slideIndex] ?? null : null) }', 'known.slideIds[slideIndex + 1] ?? null : null) }'],
  ['a failed read throws out of the runner instead of falling back', TWO, "  } catch {\n    shown = null\n  }", "  } finally {\n  }"],
  ['the deck switch during the read is not noticed', LIB, "      if (!owns()) return null // CHAT-ELEMENT-EDIT-2\n", ''],
]
for (const [label, rel, from, to] of runnerMutants) await check(`mutant caught: ${label}`, async () => {
  const text = rel === LIB ? libText : twoText
  const overrides = { [rel]: mutate(text, from, to, label) }
  await assert.rejects(() => expectations({ libOverrides: overrides }), undefined, 'the expectations must fail on this mutant')
})
const pageMutants = [
  ['the page hands the runner no shownSlides', PAGE, "      shownSlides: presentationId => chatElementEdit2ShownSlides(presentationId), // CHAT-ELEMENT-EDIT-2: Layout's own ids and count for the shown deck (used only with the flag on)\n", '', 'runner'],
  ['the page reads the inventory of another deck', PAGE, "fetchSlideInventory({ baseUrl: getLayoutServiceUrl(), presentationId,", "fetchSlideInventory({ baseUrl: getLayoutServiceUrl(), presentationId: 'other',", 'runner'],
  ['the Undo drop is gone', PAGE, "    if (CHAT_ELEMENT_EDIT_2_ENABLED) dropChatElementSelection(chatElementSelectionRef) // CHAT-ELEMENT-EDIT-2\n", '', 'selection'],
  ['the deck drop ignores the presentation (only the override)', PAGE, "}, [slideComposerOverride, effectivePresentationId]) // CHAT-ELEMENT-EDIT-2", "}, [slideComposerOverride]) // CHAT-ELEMENT-EDIT-2", 'selection'],
  ['the deck drop ignores the override (only the presentation)', PAGE, "}, [slideComposerOverride, effectivePresentationId]) // CHAT-ELEMENT-EDIT-2", "}, [effectivePresentationId]) // CHAT-ELEMENT-EDIT-2", 'selection'],
  ['the slide drop is gone', PAGE, "    if (CHAT_ELEMENT_EDIT_2_ENABLED) dropChatElementSelectionOffSlide(chatElementSelectionRef, currentSlideIndex) // CHAT-ELEMENT-EDIT-2\n", '', 'selection'],
  ['the text box callback does not record', PAGE, "chatElementSelectionRef.current = chatElementSelectionFor(elementId, 'TEXT_BOX', currentSlideIndexRef.current, slideStructure?.slides) // CHAT-ELEMENT-EDIT-2: every selection event records the selection (the state-keyed effect above misses a re-click of the element the page already holds)", 'void 0 // CHAT-ELEMENT-EDIT-2', 'selection'],
  ['the element callback does not record', PAGE, "chatElementSelectionRef.current = chatElementSelectionFor(elementId, elementType, currentSlideIndexRef.current, slideStructure?.slides) // CHAT-ELEMENT-EDIT-2", 'void 0 // CHAT-ELEMENT-EDIT-2', 'selection'],
  ['the element callback records with this change\'s flag off', PAGE, "if (CHAT_ELEMENT_EDIT_2_ENABLED && CHAT_ELEMENT_REFINE_ENABLED) chatElementSelectionRef.current = chatElementSelectionFor(elementId, elementType,", "if (CHAT_ELEMENT_REFINE_ENABLED) chatElementSelectionRef.current = chatElementSelectionFor(elementId, elementType,", 'selection'],
  ['the text box callback records with this change\'s flag off', PAGE, "if (CHAT_ELEMENT_EDIT_2_ENABLED && CHAT_ELEMENT_REFINE_ENABLED) chatElementSelectionRef.current = chatElementSelectionFor(elementId, 'TEXT_BOX',", "if (CHAT_ELEMENT_REFINE_ENABLED) chatElementSelectionRef.current = chatElementSelectionFor(elementId, 'TEXT_BOX',", 'selection'],
  ['the element callback records without the refine flag', PAGE, "if (CHAT_ELEMENT_EDIT_2_ENABLED && CHAT_ELEMENT_REFINE_ENABLED) chatElementSelectionRef.current = chatElementSelectionFor(elementId, elementType,", "if (CHAT_ELEMENT_EDIT_2_ENABLED) chatElementSelectionRef.current = chatElementSelectionFor(elementId, elementType,", 'selection'],
  ['the text box callback records without the refine flag', PAGE, "if (CHAT_ELEMENT_EDIT_2_ENABLED && CHAT_ELEMENT_REFINE_ENABLED) chatElementSelectionRef.current = chatElementSelectionFor(elementId, 'TEXT_BOX',", "if (CHAT_ELEMENT_EDIT_2_ENABLED) chatElementSelectionRef.current = chatElementSelectionFor(elementId, 'TEXT_BOX',", 'selection'],
  ['the refine path keeps the outline UUID (the hook option override is gone)', PAGE, "    ...(CHAT_ELEMENT_EDIT_2_ENABLED && CHAT_ELEMENT_REFINE_ENABLED ? { getChatElementReference: () => chatElementEdit2Reference() } : {}), // CHAT-ELEMENT-EDIT-2: the reference of a send names the slide by no id (Director fills Layout's), overriding the refine option above\n", '', 'selection'],
  ['the refine path override runs with the flag off', PAGE, "...(CHAT_ELEMENT_EDIT_2_ENABLED && CHAT_ELEMENT_REFINE_ENABLED ? { getChatElementReference:", "...(CHAT_ELEMENT_REFINE_ENABLED ? { getChatElementReference:", 'selection'],
  ['the "@" entry keeps the outline UUID (the getElement override is gone)', PAGE, "  if (CHAT_ELEMENT_EDIT_2_ENABLED && chatCommandsPage) chatCommandsPage.getElement = () => (CHAT_ELEMENT_REFINE_ENABLED ? chatElementEdit2Reference() : null) // CHAT-ELEMENT-EDIT-2: a picked @Element token carries the same reference (slide_id null)\n", '', 'selection'],
  ['the "@" entry override runs with the flag off', PAGE, "if (CHAT_ELEMENT_EDIT_2_ENABLED && chatCommandsPage) chatCommandsPage.getElement =", "if (chatCommandsPage) chatCommandsPage.getElement =", 'selection'],
  ['the helper reads the record unchanged (the UUID goes out)', PAGE, "referenceWithoutOutlineId(chatElementReferenceFor(chatElementSelectionRef.current)) // CHAT-ELEMENT-EDIT-2", "chatElementReferenceFor(chatElementSelectionRef.current) // CHAT-ELEMENT-EDIT-2", 'selection'],
]
for (const [label, rel, from, to, kind] of pageMutants) await check(`mutant caught: ${label}`, async () => {
  const mutated = mutate(pageText, from, to, label)
  await assert.rejects(() => (kind === 'runner' ? expectations({ pageText: mutated }) : selectionExpectations({ pageText: mutated })), undefined, 'the expectations must fail on this mutant')
})
const selectionLibMutants = [
  ['the reference keeps the outline UUID with the flag on (a mutant that sends the UUID)', TWO, 'return reference ? { ...reference, slide_id: null } : null', 'return reference ? { ...reference } : null'],
  ['the reference drops more than the slide id', TWO, 'return reference ? { ...reference, slide_id: null } : null', 'return reference ? { ...reference, slide_id: null, slide_index: 0 } : null'],
  ['the slide drop compares the wrong way', TWO, 'ref.current.slideIndex !== shownSlideIndex', 'ref.current.slideIndex === shownSlideIndex'],
  ['the deck drop keeps the record', TWO, 'ref.current = null\n}\n\n/** Forgets the selection record when the shown slide', 'void 0\n}\n\n/** Forgets the selection record when the shown slide'],
  ['the record loses the element type', TWO, 'return { elementId, elementType, slideIndex,', 'return { elementId, elementType: null, slideIndex,'],
  ['the record has the wrong slide', TWO, 'return { elementId, elementType, slideIndex,', 'return { elementId, elementType, slideIndex: slideIndex + 1,'],
]
for (const [label, rel, from, to] of selectionLibMutants) await check(`mutant caught: ${label}`, async () => {
  await assert.rejects(() => selectionExpectations({ libOverrides: { [rel]: mutate(twoText, from, to, label) } }), undefined, 'the expectations must fail on this mutant')
})
await check('mutant caught: an unmarked line added to the page or the runner is not stripped (the strip gives the base back only for marked lines)', () => {
  for (const [rel, text, anchor] of [[PAGE, pageText, "import { NOTES_UPDATED_EVENT }"], [LIB, libText, "import { watchViewerSave }"]]) {
    const mutated = mutate(text, anchor, `import { extra } from './extra'\n${anchor}`, 'unmarked')
    assert.notEqual(stripChatElementEdit2(rel, mutated), stripChatElementEdit2(rel, text))
  }
})
await check('mutant caught: #522\'s marker is not this one (a CHAT-ELEMENT-EDIT line is not stripped by this strip, and a CHAT-ELEMENT-EDIT-2 line is not matched by #522\'s)', async () => {
  const { CHAT_ELEMENT_EDIT_MARKER_RE } = await import('./studio-chat-element-edit-strip.mjs')
  assert.equal(CHAT_ELEMENT_EDIT_2_MARKER_RE.test('x // CHAT-ELEMENT-EDIT'), false); assert.equal(CHAT_ELEMENT_EDIT_MARKER_RE.test('x // CHAT-ELEMENT-EDIT-2'), false)
  assert.equal(CHAT_ELEMENT_EDIT_2_MARKER_RE.test('x // CHAT-ELEMENT-EDIT-2'), true); assert.equal(CHAT_ELEMENT_EDIT_2_MARKER_RE.test('x // CHAT-ELEMENT-EDIT-2-X'), false)
})

// ---- 6. scope over the committed diff ---------------------------------------------------------------------------------------------------------------------------------------------
console.log('6. Scope over the committed diff (BASE..HEAD)')
const ownOf = head => git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => git('log', '-1', '--format=%s', c).startsWith(CHAT_ELEMENT_EDIT_2_SUBJECT)) // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2: this change's commits are found by subject across the line, so a later change's commits (and the gate's merge, whose first parent is dev) do not hide them
let own = ownOf('HEAD') // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
const scope6 = [] // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2: the checks of this section, kept so the mutant at the end can run them over a stray commit
const check6 = (label, fn) => { scope6.push(fn); return check(label, fn) } // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
await check6(`this change's own commits (first-parent, no merges, subject starts "${CHAT_ELEMENT_EDIT_2_SUBJECT}") exist, every commit on that line is one, with the co-author line`, () => { // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) {
    assert.ok(git('log', '-1', '--format=%s', c).startsWith(CHAT_ELEMENT_EDIT_2_SUBJECT), `subject of ${c.slice(0, 8)}`)
    assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  }
})
await check6('the files the own commits touch are exactly this change\'s; every line added to an existing file is a pure insertion that carries the marker; the strip gives each its base back', () => { // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
  const touched = new Set(); for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].filter(rel => CHAT_ELEMENT_EDIT_2_SCOPE_FILES.has(rel) || !registry.LATER_CHANGE_FILES.has(rel)).sort(), [...CHAT_ELEMENT_EDIT_2_SCOPE_FILES].sort())
  const expected = { [PAGE]: 19, [LIB]: 8 }
  for (const rel of CHAT_ELEMENT_EDIT_2_FILES) {
    const diff = git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, CHAT_ELEMENT_EDIT_2_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.equal(diff.length, expected[rel], `${rel}: the marked lines`)
    assert.equal(stripChatElementEdit2(rel, git('show', `HEAD:${rel}`)), baseFile(rel), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of CHAT_ELEMENT_EDIT_2_NEW_FILES) assert.ok(git('cat-file', '-t', `HEAD:${rel}`).trim() === 'blob', rel)
})
await check6('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => { // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
  assert.equal(registry.stripLaterEnvBlocks('.env.example', read('.env.example')), registry.stripLaterEnvBlocks('.env.example', `${baseFile('.env.example')}\n${CHAT_ELEMENT_EDIT_2_ENV_BLOCK}`))
  assert.ok(read('.env.example').includes(`\n\n${CHAT_ELEMENT_EDIT_2_ENV_BLOCK}`), 'a blank line before the block')
  const laterRegistry = (() => { const later = new Set(); let after = false; for (const line of git('show', 'HEAD:scripts/studio-later-changes.mjs').split('\n')) { if (/^export const LATER_/.test(line)) after = false; else if (line.includes('studio-chat-element-edit-2-strip.mjs')) after = true; else if (after && line.includes('// LATER-CHANGE:') && /-strip\.mjs/.test(line)) later.add(line) } return later })() // LATER-CHANGES: registry read (MODEL-CHOICE-DECK-SAVE), stacked after chat element edit 2: the registry lines of every change registered after this one (below this change's own line in each list, in the registered shape) are theirs, not this change's, so the count of three below reads past them
  const diff = git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line) && !(line.startsWith('+') && laterRegistry.has(line.slice(1)))) // LATER-CHANGES: registry read (MODEL-CHOICE-DECK-SAVE), stacked after chat element edit 2: a line a later change added to the registry is its own
  assert.equal(diff.length, 3); for (const line of diff) assert.ok(line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-chat-element-edit-2-strip.mjs'), line.slice(0, 140))
  for (const rel of ['scripts/test-studio-chat-element-edit-2.mjs', 'scripts/studio-chat-element-edit-2-strip.mjs', 'scripts/fixtures/chat-element-edit-2/e2e2-repro-element-edit.json', TWO]) assert.doesNotMatch(read(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/, rel)
})
await check('mutant caught: a stray non-#538 file in a "Chat element edit 2:" commit fails the files check (the own commits are found by subject across the whole line)', () => { // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
  const run = (args, input, env = {}) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', input, env: { ...process.env, ...env } }).trim() // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
  const blob = run(['hash-object', '-w', '--stdin'], 'stray\n') // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
  const tree = run(['mktree'], `${git('ls-tree', 'HEAD')}100644 blob ${blob}\tstray-chat-element-edit-2.txt\n`) // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
  const ident = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-27T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-27T00:00:00Z' } // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
  const stray = run(['commit-tree', tree, '-p', 'HEAD', '-m', `${CHAT_ELEMENT_EDIT_2_SUBJECT} a stray file\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`], undefined, ident) // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
  const real = own // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
  try { own = ownOf(stray); assert.ok(own.includes(stray), 'the stray commit is found by its subject'); scope6[0](); assert.throws(() => scope6[1](), undefined, 'the files check must fail on a stray file') } finally { own = real } // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2
}) // LATER-CHANGES: registry read (CHAT-CLEAN-ORDER), stacked after chat element edit 2

console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
