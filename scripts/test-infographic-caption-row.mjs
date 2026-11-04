// R14 Studio half: the stage-name caption row under a Creative infographic (flag NEXT_PUBLIC_INFOGRAPHIC_CAPTION_ROW_ENABLED).
// Offline: Text Labs and Layout are fakes, no network, no git. The real useTextLabsGeneration hook, the real Text Labs client and
// the real lib/infographic-caption-row.ts run in a vm; the fake Layout records every command.
//
// Contract: workspace streams/element/contracts/R14-caption-row.md (Text Labs MR !93, TL_INFOGRAPHIC_CAPTION_ROW_ENABLED).
// Anchor: this file finds the tree it tests from its own location (the nearest package.json, which must be this app's).
// Flag-off identity: the digests below were recorded by running this same script against the base tree
// (studio-v4-dev-preparation-code @ 922ce14) with R14_TREE=<that tree> R14_PRINT_DIGESTS=1; they cover the exact Text Labs
// request bytes and the whole Layout command sequence of six scenarios, with a caption_row in the responses.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
let ownRoot = here
while (!fs.existsSync(path.join(ownRoot, 'package.json'))) {
  const parent = path.dirname(ownRoot)
  assert.notEqual(parent, ownRoot, 'no package.json above this script')
  ownRoot = parent
}
const ownPackage = JSON.parse(fs.readFileSync(path.join(ownRoot, 'package.json'), 'utf8'))
assert.equal(ownPackage.name, 'deckster', 'the anchor package.json must be the Deckster frontend')
const requireOwn = createRequire(path.join(ownRoot, 'package.json'))
const ts = requireOwn('typescript')
const React = requireOwn('react')
const TREE = process.env.R14_TREE ? path.resolve(process.env.R14_TREE) : ownRoot
const PRINT = process.env.R14_PRINT_DIGESTS === '1'
const FLAG = 'NEXT_PUBLIC_INFOGRAPHIC_CAPTION_ROW_ENABLED'

// Recorded from the base tree (see header).
const BASE_DIGESTS = {
  generate_applied_response:
    'dd65edbdac7d8112c15be3d477c9677d74eabdc9bc2dcc574a64d5f7d8518a73',
  generate_skipped_response:
    '20030bd8940905354fe4bdd3432cd600a447dedaf4225d5ccf965ecf0ee112cf',
  generate_no_caption_row:
    '08ce272b1f357d9d45274cfed718257b8ce1f3dd96a98a55c0b0c3a92f2f832e',
  variation_of_captioned_pair:
    '7845bcf55c9dc084baaf980aaca514508464e46a3ce1f2f1223ac024bc2c08c9',
  variation_no_caption_row:
    '6fd6dbbb1ffae4186f937cf54f75089e372a4a12f673dfdbd4926fc17a642019',
  edit_of_captioned_pair:
    'b769e9985766161cfa9d3d3efd5fc653f959a1ab19b917c94ca840080d8b5288',
}

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }
const copy = value => JSON.parse(JSON.stringify(value))
const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const flush = async () => { for (let i = 0; i < 200; i++) await Promise.resolve() }

// ---- Fixtures: the contract's real example (section 7), default 16 x 9 area ----------------------------------------------
const AREA = { grid_row: '4/13', grid_column: '2/18', start_col: 2, start_row: 4, width: 16, height: 9 }
const IMAGE_POSITION = { grid_row: '5/10.6', grid_column: '2/18', start_col: 2, start_row: 5, width: 16, height: 5.6 }
const CAPTION_POSITION = { grid_row: '10.8/11.8', grid_column: '2/18', start_col: 2, start_row: 10.8, width: 16, height: 1 }
const CAPTION_HTML = '<div data-infographic-caption-row data-stage-count="3" data-layout="equal" style="box-sizing:border-box;width:100%;height:100%;display:flex;align-items:flex-start;overflow:hidden;margin:0;padding:0;color:var(--theme-text-primary,#1f2937);font-family:var(--theme-font-family,\'Poppins\',sans-serif);font-weight:600;font-size:28px;line-height:1.25;"><div data-caption-label data-stage-index="1" style="flex:1 1 0;min-width:0;box-sizing:border-box;padding:4px 8px;text-align:center;overflow:hidden;">Pilot</div><div data-caption-label data-stage-index="2" style="flex:1 1 0;min-width:0;box-sizing:border-box;padding:4px 8px;text-align:center;overflow:hidden;">Regional rollout</div><div data-caption-label data-stage-index="3" style="flex:1 1 0;min-width:0;box-sizing:border-box;padding:4px 8px;text-align:center;overflow:hidden;">National launch</div></div>'
const CAPTION_ROW = {
  version: 1, status: 'applied', labels: ['Pilot', 'Regional rollout', 'National launch'], label_source: 'colon_list', segment_count: 3,
  layout: 'equal', layout_basis: 'equal_columns_no_segment_geometry',
  columns: [
    { index: 1, label: 'Pilot', x_pct: 0, width_pct: 33.3333 },
    { index: 2, label: 'Regional rollout', x_pct: 33.3333, width_pct: 33.3333 },
    { index: 3, label: 'National launch', x_pct: 66.6667, width_pct: 33.3333 },
  ],
  area: AREA, image_position: IMAGE_POSITION, caption_position: CAPTION_POSITION, image_aspect: 2.8799,
  font: { size_px: 28, weight: 600, line_height: 1.25, lines_max: 1, family: 'var(--theme-font-family)' },
  component_type: 'TEXT_BOX', html: CAPTION_HTML,
}
const { html: _html, columns: _columns, ...SUMMARY } = CAPTION_ROW
const SKIPPED_ROW = {
  version: 1, status: 'skipped', reason: 'unsupported_geometry', detail: 'this picture is not a wide, left-to-right row of stages',
  labels: ['Pilot', 'Regional rollout', 'National launch'], label_source: 'colon_list',
}
const SKIP_WARNING = 'infographic_caption_row_skipped: stage names were not added under the picture (this picture is not a wide, left-to-right row of stages).'
const PROMPT = 'AI demand forecasting rollout: pilot, regional rollout, national launch'

function infographicElement({ captionRow, summary, image = true } = {}) {
  const persisted = summary ?? (captionRow && captionRow.status === 'applied' ? SUMMARY : captionRow ? { ...captionRow } : undefined)
  return {
    component_type: 'INFOGRAPHIC',
    ...(image ? { image_data_url: 'data:image/png;base64,iVBORw0KGgo=' } : { html: '<div>structured</div>' }),
    grid_position: { ...AREA },
    metadata: { mode: 'v1', generation_mode: 'prompt_only', ...(persisted ? { caption_row: persisted } : {}) },
    generation_config: { infographic: { mode: 'v1', ...(persisted ? { caption_row: persisted } : {}) } },
    ...(captionRow ? { caption_row: captionRow } : {}),
  }
}
const respond = (element, warnings) => ({ success: true, element, ...(warnings ? { warnings } : {}) })

// ---- Runtime: the real hook in a vm with fake React hooks, fake Text Labs and fake Layout ----------------------------------
function runtime({ flag, studio = 'true', tree = TREE, config = {}, clock = 0 } = {}) {
  let now = clock, timerId = 0, uuid = 0, refCursor = 0, effectCursor = 0
  const timers = new Map(), refs = [], effectStates = [], pendingEffects = []
  const requests = [], commands = [], toasts = [], layoutIds = []
  let layoutSeq = 0
  const panel = { blankElementId: 'blank-1', isOpen: true, elementType: 'INFOGRAPHIC', isGenerating: false, error: null, mode: 'generate',
    refineContext: null, researchMode: 'off', researchWeb: false, researchUploadedDocs: false, researchKnowledgeGraph: false }
  const blank = { elementId: 'blank-1', componentType: 'INFOGRAPHIC', slideIndex: 0, startCol: 2, startRow: 4, width: 16, height: 9, status: 'blank' }
  const theme = { status: 'applied', requestId: 'theme-1', presentationId: 'deck-1', themeFingerprint: 'theme-a', error: null }
  const setTimer = (fn, ms) => { const id = ++timerId; timers.set(id, { at: now + ms, fn }); return id }
  const clearTimer = id => timers.delete(id)
  class ClockDate extends Date { static now() { return now } }
  const hookReact = {
    useRef(value) { const i = refCursor++; return refs[i] ??= { current: value } },
    useCallback: fn => fn,
    useEffect(fn, deps) {
      const i = effectCursor++, previous = effectStates[i]
      if (!previous || deps.some((v, j) => !Object.is(v, previous.deps[j]))) {
        pendingEffects.push(() => { previous?.cleanup?.(); effectStates[i] = { deps, cleanup: fn() } })
      }
    },
  }
  const env = { NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.example.test', NEXT_PUBLIC_STUDIO_V4_SHELL: studio }
  if (flag !== undefined) env[FLAG] = flag
  const cache = new Map()
  let reply = { success: true, elements: [] }
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }; cache.set(file, mod.exports)
    const source = fs.readFileSync(path.join(tree, file), 'utf8')
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText
    vm.runInNewContext(compiled, {
      module: mod, exports: mod.exports, React: hookReact, process: { env }, Date: ClockDate, setTimeout: setTimer, clearTimeout: clearTimer,
      AbortController, AbortSignal, DOMException, FormData, Blob, URL, crypto: { randomUUID: () => `synthetic-${++uuid}` },
      console: { log() {}, warn() {}, error() {}, info() {} }, Error,
      fetch: async (url, init = {}) => {
        if (!String(url).includes('textlabs.example.test')) return { ok: true, json: async () => ({}) }
        requests.push({ url: String(url), body: init.body })
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => copy(reply) }
      },
      require: id => {
        if (id === 'react') return hookReact
        if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`)
        if (id.startsWith('.')) return load(`${path.normalize(path.join(path.dirname(file), id))}.ts`)
        throw new Error(`Unexpected non-source dependency: ${id}`)
      },
    }, { filename: file })
    cache.set(file, mod.exports); return mod.exports
  }
  // What the fake Layout holds for an existing element (refine), and what it refuses.
  const geometry = {
    'blank-1': { gridRow: '4/13', gridColumn: '2/18' },
    'img-1': { gridRow: IMAGE_POSITION.grid_row, gridColumn: IMAGE_POSITION.grid_column, generationConfig: config.imageConfig ?? null },
  }
  const failures = config.fail ?? {}   // { insertTextBox: 'message', insertImage: 'message' }
  const missing = new Set(config.missing ?? [])
  const sendElementCommand = async (action, args) => {
    commands.push({ action, args: copy(args) })
    if (action === 'getElementGeometry') {
      const g = geometry[args.elementId]
      if (!g) return { success: false, error: 'Element not found' }
      return { success: true, action, elementId: args.elementId, position: { gridRow: g.gridRow, gridColumn: g.gridColumn },
        componentType: 'INFOGRAPHIC', zIndex: 1000, ...(g.generationConfig ? { generationConfig: copy(g.generationConfig) } : {}) }
    }
    if (failures[action]) return { success: false, error: failures[action] }
    if (action === 'deleteElement' && missing.has(args.elementId)) return { success: false, error: 'Element not found' }
    if (action === 'deleteElement' && (config.failDeleteIds ?? []).includes(args.elementId)) return { success: false, error: 'viewer busy' }
    // The real Layout viewer names an inserted image / text box after `id` and ignores `elementId` (probed on Layout uat 839d95b).
    if (action === 'insertImage' || action === 'insertTextBox') {
      const elementId = args.id ?? `layout-${action === 'insertImage' ? 'image' : 'textbox'}-${++layoutSeq}`
      layoutIds.push({ action, requested: args.elementId, assigned: elementId })
      return { success: true, elementId }
    }
    return { success: true, elementId: args.elementId }
  }
  const methods = {
    setIsGenerating: value => { panel.isGenerating = value }, setError: value => { panel.error = value; panel.retryStrategy = null },
    setRetryStrategy: value => { panel.retryStrategy = value }, getSnapshot: () => ({ ...panel }), closePanel: () => { panel.isOpen = false },
    rememberDraftForElement: () => {}, openPanelForElement: () => {}, resumePanelForElement: () => {}, openPanelForRefine: () => {},
    completeBlankReplacement: () => { panel.mode = 'refine' }, changeElementType: () => {},
  }
  const params = {
    presentationId: 'deck-1', currentSlideIndex: 0, researchCapabilities: {}, generationPanel: null,
    blankElements: { getElement: id => id === blank.elementId ? blank : undefined, updatePosition: () => {}, updateGenerationMetadata: () => {},
      setStatus: (_id, status) => { blank.status = status }, removeElement: () => { blank.status = 'removed' }, addElement: () => {}, trackElement: () => {} },
    textLabsSession: { ensureSession: async () => 'synthetic-session' },
    layoutServiceApis: { sendElementCommand },
    getThemeSyncSnapshot: () => theme, ensureThemeReady: async () => ({ ready: true, source: 'director', sync: theme }),
    toast: opts => toasts.push(opts),
  }
  params.layoutServiceApis.captureStudioElementGeneration = () => ({ sendElementCommand, isCurrent: () => params.presentationId === 'deck-1' })
  const hook = load('hooks/use-textlabs-generation.ts').useTextLabsGeneration
  let api
  function render() {
    refCursor = 0; effectCursor = 0
    params.generationPanel = { ...panel, ...methods }
    api = hook(params)
    while (pendingEffects.length) pendingEffects.shift()()
    return api
  }
  render()
  async function settle() {
    await flush()
    while (timers.size) {
      const [id, timer] = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      now = timer.at; timers.delete(id); timer.fn(); await flush()
    }
  }
  return { load, render, panel, blank, requests, commands, toasts, layoutIds, settle, setReply: value => { reply = value }, get api() { return api } }
}

const baseForm = () => ({
  componentType: 'INFOGRAPHIC', prompt: PROMPT, count: 1, layout: 'horizontal', advancedModified: false, z_index: 1000, presentationId: 'deck-1', useDeckTheme: false,
  infographicConfig: { mode: 'v1', start_col: 2, start_row: 4, width: 16, height: 9, grid_row: '4/13', grid_column: '2/18' },
  positionConfig: { start_col: 2, start_row: 4, position_width: 16, position_height: 9, auto_position: false },
})
const refineForm = operation => ({
  ...baseForm(),
  infographicConfig: { mode: 'v1', operation, start_col: 2, start_row: 5, width: 16, height: 5.6, grid_row: '5/10.6', grid_column: '2/18' },
  positionConfig: { start_col: 2, start_row: 5, position_width: 16, position_height: 5.6, auto_position: false },
})

// A persisted pair as Layout would hand it back on reload: the picture's generationConfig with the link and the row's summary.
const PERSISTED_PAIR = { captionElementId: 'cap-1', infographic: { mode: 'v1', caption_row: copy(SUMMARY) } }

/**
 * kind: 'generate' (into the blank placeholder), 'variation' or 'edit' (refine of img-1, whose caption row is cap-1).
 * Returns what a test needs to see: the exact request bytes, every Layout command in order, the toast, the outcome.
 */
async function scenario({ kind, response, flag, studio, config, clock, imageConfig = PERSISTED_PAIR }) {
  const run = runtime({ flag, studio, clock, config: { imageConfig, ...config } })
  run.setReply(response)
  let form = baseForm()
  if (kind !== 'generate') {
    form = refineForm(kind)
    run.panel.mode = 'refine'; run.panel.blankElementId = null; run.panel.editElementId = 'img-1'
    run.panel.refineContext = { elementId: 'img-1', elementType: 'INFOGRAPHIC', slideIndex: 0, generationConfig: copy(imageConfig ?? {}),
      existingElement: { element_id: 'img-1', component_type: 'INFOGRAPHIC' }, research: {}, citationsUsed: [] }
    run.render()
  }
  const promise = run.api.handleGenerate(form)
  await run.settle()
  const outcome = await promise
  const mutating = run.commands.filter(c => /^(insert|upsert|delete)/.test(c.action))
  return {
    run, outcome, mutating, actions: mutating.map(c => c.action),
    request: run.requests.length === 1 ? JSON.parse(run.requests[0].body) : null,
    toast: run.toasts.at(-1) ?? null,
    summary: copy({ requests: run.requests.map(r => ({ url: r.url, body: r.body })), commands: run.commands, toasts: run.toasts, error: run.panel.error, outcome }),
  }
}
const insertOf = (result, action, nth = 0) => result.mutating.filter(c => c.action === action)[nth]?.args

// ---- 1. The helper, on its own -----------------------------------------------------------------------------------------------
const hasHelper = fs.existsSync(path.join(TREE, 'lib/infographic-caption-row.ts'))
const helperSource = hasHelper ? fs.readFileSync(path.join(TREE, 'lib/infographic-caption-row.ts'), 'utf8') : ''
const helperAt = flagValue => {
  const mod = { exports: {} }
  const out = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  vm.runInNewContext(out, { module: mod, exports: mod.exports, process: { env: flagValue === undefined ? {} : { [FLAG]: flagValue } }, Number, Math, JSON, Array, Object, String })
  return mod.exports
}
if (!PRINT || hasHelper) {
  if (hasHelper) {
    check(assert.equal, /^\s*import\s/m.test(helperSource), false, 'the helper stays import-free')
    check(assert.equal, helperAt(undefined).INFOGRAPHIC_CAPTION_ROW_ENABLED, false, 'default off')
    for (const value of ['', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true']) check(assert.equal, helperAt(value).INFOGRAPHIC_CAPTION_ROW_ENABLED, false, `"${value}" is off`)
    check(assert.equal, helperAt('true').INFOGRAPHIC_CAPTION_ROW_ENABLED, true, 'the literal "true" is on')

    const lib = helperAt('true')
    const applied = lib.readCaptionRow({ caption_row: copy(CAPTION_ROW) })
    check(assert.equal, applied.kind, 'applied')
    check(assert.deepEqual, copy(applied.plan.imagePosition), { start_col: 2, start_row: 5, position_width: 16, position_height: 5.6 })
    check(assert.deepEqual, copy(applied.plan.captionPosition), { start_col: 2, start_row: 10.8, position_width: 16, position_height: 1 })
    check(assert.deepEqual, copy(applied.plan.area), { start_col: 2, start_row: 4, position_width: 16, position_height: 9 })
    check(assert.equal, applied.plan.html, CAPTION_HTML)
    check(assert.deepEqual, copy(applied.plan.summary), copy(SUMMARY), 'the persisted summary has no html and no columns')
    check(assert.equal, 'html' in applied.plan.summary || 'columns' in applied.plan.summary, false)
    // Not a caption row, or one this build does not understand: nothing to do (the picture is inserted as today).
    for (const element of [null, undefined, {}, { caption_row: null }, { caption_row: 'x' }, { caption_row: [] }, { caption_row: { status: 'applied', version: 2 } },
      { caption_row: { ...CAPTION_ROW, version: 2 } }, { caption_row: { ...CAPTION_ROW, version: '1' } }, { caption_row: { status: 'pending' } }]) {
      check(assert.equal, lib.readCaptionRow(element), null, JSON.stringify(element)?.slice(0, 60))
    }
    // Applied but not trustworthy: it reads as skipped, so the picture keeps its own box and no caption is inserted.
    const broken = {
      'no html': { html: undefined }, 'blank html': { html: '   ' }, 'wrong component': { component_type: 'TABLE' },
      'no area': { area: undefined }, 'no image position': { image_position: undefined }, 'no caption position': { caption_position: undefined },
      'nan': { image_position: { ...IMAGE_POSITION, height: Number.NaN } }, 'string width': { caption_position: { ...CAPTION_POSITION, width: '16' } },
      'off the grid': { area: { ...AREA, start_col: 20 } }, 'zero height': { caption_position: { ...CAPTION_POSITION, height: 0 } },
      'image outside the area': { image_position: { ...IMAGE_POSITION, start_row: 12 } },
      'caption outside the area': { caption_position: { ...CAPTION_POSITION, start_row: 12.5 } },
      'caption wider than the picture': { caption_position: { ...CAPTION_POSITION, width: 15 } },
    }
    for (const [name, patch] of Object.entries(broken)) {
      const read = lib.readCaptionRow({ caption_row: { ...copy(CAPTION_ROW), ...patch } })
      check(assert.equal, read?.kind, 'skipped', name)
    }
    const skipped = lib.readCaptionRow({ caption_row: copy(SKIPPED_ROW) })
    check(assert.deepEqual, copy(skipped), { kind: 'skipped', reason: 'unsupported_geometry', detail: 'this picture is not a wide, left-to-right row of stages' })

    // The link and the area travel with the picture's generationConfig.
    const linked = lib.withCaptionLink({ infographic: { mode: 'v1' }, keep: 1 }, 'cap-9', SUMMARY)
    check(assert.equal, linked.captionElementId, 'cap-9')
    check(assert.equal, linked.keep, 1)
    check(assert.deepEqual, copy(linked.infographic.caption_row), copy(SUMMARY), 'the summary is added when the response did not carry it')
    const keepsOwn = lib.withCaptionLink({ infographic: { caption_row: { status: 'applied', own: true } } }, 'cap-9', SUMMARY)
    check(assert.deepEqual, copy(keepsOwn.infographic.caption_row), { status: 'applied', own: true }, 'the backend summary wins when present')
    check(assert.deepEqual, copy(lib.withCaptionLink(null, 'cap-9', SUMMARY)), { captionElementId: 'cap-9', infographic: { caption_row: copy(SUMMARY) } })
    const original = { infographic: { mode: 'v1' } }
    lib.withCaptionLink(original, 'cap-9', SUMMARY)
    check(assert.deepEqual, original, { infographic: { mode: 'v1' } }, 'never mutates its input')

    const variation = lib.captionRowRefineState('variation', copy(PERSISTED_PAIR))
    check(assert.equal, variation.captionElementId, 'cap-1')
    check(assert.deepEqual, copy(variation.area), { start_col: 2, start_row: 4, position_width: 16, position_height: 9 }, 'the ORIGINAL area, not the picture box')
    check(assert.equal, lib.captionRowRefineState('generate', copy(PERSISTED_PAIR)), null)
    check(assert.equal, lib.captionRowRefineState(undefined, copy(PERSISTED_PAIR)), null)
    check(assert.equal, lib.captionRowRefineState('variation', null), null)
    check(assert.equal, lib.captionRowRefineState('variation', { infographic: { mode: 'v1' } }), null, 'a picture that never had a caption row')
    const skippedConfig = { infographic: { caption_row: copy(SKIPPED_ROW) } }
    check(assert.equal, lib.captionRowRefineState('variation', skippedConfig).area, null, 'a skipped summary has no area')
    check(assert.equal, lib.captionRowRefineState('variation', { infographic: { caption_row: { ...copy(SKIPPED_ROW), area: AREA } } }).area, null, 'an area is only believed on an applied summary')
    check(assert.equal, lib.captionRowRefineState('variation', { captionElementId: 'cap-1' }).area, null)
    check(assert.equal, lib.captionRowRefineState('variation', { captionElementId: '  ' }), null)

    const carried = lib.carryCaptionLink({ infographic: { mode: 'v1' } }, lib.captionRowRefineState('edit', copy(PERSISTED_PAIR)))
    check(assert.equal, carried.captionElementId, 'cap-1')
    check(assert.deepEqual, copy(carried.infographic.caption_row), copy(SUMMARY))
    check(assert.deepEqual, lib.carryCaptionLink({ a: 1 }, lib.captionRowRefineState('variation', copy(PERSISTED_PAIR))), { a: 1 }, 'a variation does not carry the old link')
    check(assert.deepEqual, lib.carryCaptionLink({ a: 1 }, null), { a: 1 })

    check(assert.equal, lib.captionRowSkipNotice(null, []), '')
    check(assert.equal, lib.captionRowSkipNotice(applied, []), '')
    check(assert.equal, lib.captionRowSkipNotice(skipped, [SKIP_WARNING, 'other warning']),
      'Stage names were not added under the picture (this picture is not a wide, left-to-right row of stages).')
    check(assert.equal, lib.captionRowSkipNotice(skipped, ['infographic_caption_row_skipped: stage names were not added under the picture (the backend\'s own words).']),
      'Stage names were not added under the picture (the backend\'s own words).', 'the backend\'s warning is shown as sent')
    check(assert.equal, lib.captionRowSkipNotice(skipped, undefined),
      'Stage names were not added under the picture (this picture is not a wide, left-to-right row of stages).', 'falls back to the row\'s own detail')
    check(assert.equal, lib.captionRowSkipNotice(skipped, ['unrelated']), lib.captionRowSkipNotice(skipped, undefined))

    const plan = applied.plan
    const element = lib.captionRowElementForInsertion(plan)
    check(assert.equal, element.html, CAPTION_HTML)
    check(assert.equal, element.semantic_role, 'BODY_TEXT')
    check(assert.deepEqual, copy(element.grid_position), copy(plan.captionPosition))
    check(assert.deepEqual, copy(lib.CAPTION_ROW_PADDING), { top: 0, right: 0, bottom: 0, left: 0 })
  }
}

// ---- 2. Flag off: identical to the base ------------------------------------------------------------------------------------------
const SCENARIOS = {
  generate_applied_response: () => ({ kind: 'generate', response: respond(infographicElement({ captionRow: copy(CAPTION_ROW) })) }),
  generate_skipped_response: () => ({ kind: 'generate', response: respond(infographicElement({ captionRow: copy(SKIPPED_ROW) }), [SKIP_WARNING]) }),
  generate_no_caption_row: () => ({ kind: 'generate', response: respond(infographicElement()) }),
  variation_of_captioned_pair: () => ({ kind: 'variation', response: respond(infographicElement({ captionRow: copy(CAPTION_ROW) })) }),
  variation_no_caption_row: () => ({ kind: 'variation', response: respond(infographicElement()) }),
  edit_of_captioned_pair: () => ({ kind: 'edit', response: respond(infographicElement()) }),
}
const recorded = {}
for (const [name, build] of Object.entries(SCENARIOS)) {
  const off = await scenario({ ...build(), flag: undefined })
  recorded[name] = digest(off.summary)
  if (PRINT) continue
  check(assert.equal, recorded[name], BASE_DIGESTS[name], `${name}: flag off is byte-identical to the base (request bytes + every Layout command + toast)`)
  for (const value of ['false', '', 'TRUE', '1', 'yes']) {
    const other = await scenario({ ...build(), flag: value })
    check(assert.equal, digest(other.summary), recorded[name], `${name}: flag "${value}" is still off`)
  }
  // Flag off with the studio shell off takes the other branch of the same code; it must not diverge either.
  const legacyOff = await scenario({ ...build(), flag: undefined, studio: 'false' })
  const legacyFalse = await scenario({ ...build(), flag: 'false', studio: 'false' })
  check(assert.equal, digest(legacyFalse.summary), digest(legacyOff.summary), `${name}: studio shell off, flag off`)
}
if (PRINT) {
  console.log(JSON.stringify(recorded, null, 2))
  process.exit(0)
}
// Flag off ignores caption_row entirely: one picture in its own response position, no text box, no link.
{
  const off = await scenario({ ...SCENARIOS.generate_applied_response(), flag: undefined })
  check(assert.deepEqual, off.actions, ['insertImage', 'deleteElement'])
  check(assert.equal, insertOf(off, 'insertImage').gridRow, '4/13')
  check(assert.equal, 'captionElementId' in insertOf(off, 'insertImage'), false)
  check(assert.equal, JSON.stringify(insertOf(off, 'insertImage').generationConfig).includes('captionElementId'), false)
}

// ---- 3. Flag on: generate -----------------------------------------------------------------------------------------------------------
const ON = 'true'
const generated = await scenario({ ...SCENARIOS.generate_applied_response(), flag: ON })
check(assert.deepEqual, generated.actions, ['insertImage', 'insertTextBox', 'deleteElement'], 'picture first, then the caption row, then the placeholder goes')
check(assert.equal, generated.outcome.status, 'inserted')
const image = insertOf(generated, 'insertImage')
const caption = insertOf(generated, 'insertTextBox')
check(assert.equal, image.gridRow, '5/10.6', 'the picture goes to image_position, not to the area')
check(assert.equal, image.gridColumn, '2/18')
check(assert.equal, image.positionWidth, 16)
check(assert.equal, image.positionHeight, 5.6)
check(assert.equal, image.imageUrl, 'data:image/png;base64,iVBORw0KGgo=')
check(assert.equal, image.componentType, 'INFOGRAPHIC')
check(assert.equal, image.zIndex, 1000)
check(assert.equal, caption.content, CAPTION_HTML, 'the caption row is the response html, untouched')
check(assert.equal, caption.gridRow, '10.8/11.8', 'directly under the picture')
check(assert.equal, caption.gridColumn, '2/18')
check(assert.equal, caption.positionWidth, 16)
check(assert.equal, caption.positionHeight, 1)
check(assert.equal, caption.zIndex, image.zIndex + 1, 'one above the picture')
check(assert.equal, caption.componentType, 'TEXT_BOX')
check(assert.equal, caption.semanticRole, 'BODY_TEXT')
check(assert.equal, caption.skipAutoSize, true)
check(assert.equal, caption.draggable, true)
check(assert.equal, caption.resizable, true)
check(assert.deepEqual, caption.style, { padding_top: 0, padding_right: 0, padding_bottom: 0, padding_left: 0 }, 'no padding of its own')
check(assert.match, caption.elementId, /^text_box_/)
check(assert.notEqual, caption.elementId, image.elementId, 'a new element id')
check(assert.equal, caption.slideIndex, 0)
// Persist: the link rides on the picture next to its generationConfig; the area and the labels are in generationConfig.infographic.caption_row.
check(assert.equal, image.captionElementId, caption.elementId)
check(assert.equal, caption.id, caption.elementId, 'Layout names a text box after `id` (and ignores `elementId`), so the row is given its id up front')
check(assert.equal, generated.run.layoutIds.find(c => c.action === 'insertTextBox').assigned, image.captionElementId, 'the link saved with the picture is the id Layout really assigned to the row')
check(assert.notEqual, generated.run.layoutIds.find(c => c.action === 'insertImage').assigned, image.elementId, 'the picture is known by the id Layout assigned, not the one Studio proposed')
check(assert.equal, generated.outcome.elementIds[0], generated.run.layoutIds.find(c => c.action === 'insertImage').assigned, 'the first id of the outcome is the picture')
check(assert.equal, image.generationConfig.captionElementId, caption.elementId)
check(assert.deepEqual, image.generationConfig.infographic.caption_row.area, AREA)
check(assert.deepEqual, image.generationConfig.infographic.caption_row.labels, ['Pilot', 'Regional rollout', 'National launch'])
check(assert.equal, JSON.stringify(image.generationConfig).includes('data-caption-label'), false, 'no html in the persisted picture config')
check(assert.equal, generated.request.infographic_config.grid_row, '4/13', 'the request still asks for the whole area')
check(assert.equal, generated.request.infographic_config.grid_column, '2/18')
check(assert.deepEqual, generated.run.commands.filter(c => c.action === 'deleteElement').map(c => c.args.elementId), ['blank-1'])
check(assert.equal, generated.toast.description, 'INFOGRAPHIC added to slide')
// Same, with the studio shell off (the other branch of the same code).
{
  const legacy = await scenario({ ...SCENARIOS.generate_applied_response(), flag: ON, studio: 'false' })
  check(assert.deepEqual, legacy.actions, ['insertImage', 'insertTextBox', 'deleteElement'])
  check(assert.equal, insertOf(legacy, 'insertTextBox').gridRow, '10.8/11.8')
}
// Absent caption_row: identical to the flag off.
{
  const absentOn = await scenario({ ...SCENARIOS.generate_no_caption_row(), flag: ON })
  check(assert.equal, digest(absentOn.summary), recorded.generate_no_caption_row, 'no caption_row: flag on == flag off')
  const sameOn = await scenario({ ...SCENARIOS.variation_no_caption_row(), flag: ON, imageConfig: { infographic: { mode: 'v1' } } })
  const sameOff = await scenario({ ...SCENARIOS.variation_no_caption_row(), flag: undefined, imageConfig: { infographic: { mode: 'v1' } } })
  check(assert.equal, digest(sameOn.summary), digest(sameOff.summary), 'a picture that never had a caption row: variation unchanged')
  const editOn = await scenario({ ...SCENARIOS.edit_of_captioned_pair(), flag: ON, imageConfig: { infographic: { mode: 'v1' } } })
  const editOff = await scenario({ ...SCENARIOS.edit_of_captioned_pair(), flag: undefined, imageConfig: { infographic: { mode: 'v1' } } })
  check(assert.equal, digest(editOn.summary), digest(editOff.summary), 'a picture that never had a caption row: edit unchanged')
}
// A skipped row: the picture is inserted at grid_position exactly as today, no caption, and the reason is shown.
{
  const skipped = await scenario({ ...SCENARIOS.generate_skipped_response(), flag: ON })
  check(assert.deepEqual, skipped.actions, ['insertImage', 'deleteElement'])
  check(assert.equal, insertOf(skipped, 'insertImage').gridRow, '4/13')
  check(assert.equal, 'captionElementId' in insertOf(skipped, 'insertImage'), false)
  check(assert.equal, skipped.toast.description,
    'INFOGRAPHIC added to slide. Stage names were not added under the picture (this picture is not a wide, left-to-right row of stages).')
  const noWarning = await scenario({ kind: 'generate', response: respond(infographicElement({ captionRow: copy(SKIPPED_ROW) })), flag: ON })
  check(assert.match, noWarning.toast.description, /Stage names were not added under the picture \(this picture is not/, 'the row detail when the warning is missing')
}
// A row that cannot be trusted reads as skipped: the picture keeps the whole area, nothing is inserted twice.
for (const patch of [{ html: '' }, { image_position: { ...IMAGE_POSITION, height: 99 } }, { caption_position: { ...CAPTION_POSITION, width: 3 } }, { component_type: 'IMAGE' }]) {
  const result = await scenario({ kind: 'generate', response: respond(infographicElement({ captionRow: { ...copy(CAPTION_ROW), ...patch } })), flag: ON })
  check(assert.deepEqual, result.actions, ['insertImage', 'deleteElement'])
  check(assert.equal, insertOf(result, 'insertImage').gridRow, '4/13')
  check(assert.match, result.toast.description, /Stage names were not added under the picture/)
}
// Not a version this build knows: ignored, as today.
{
  const future = await scenario({ kind: 'generate', response: respond(infographicElement({ captionRow: { ...copy(CAPTION_ROW), version: 2 } })), flag: ON })
  check(assert.equal, digest(future.summary), recorded.generate_applied_response, 'an unknown version is ignored')
}
// Structured (V2): its names are already text inside the HTML; a stray caption_row changes nothing.
{
  const structured = infographicElement({ captionRow: copy(CAPTION_ROW), image: false })
  structured.metadata.mode = 'v2'; structured.generation_config.infographic.mode = 'v2'
  const on = await scenario({ kind: 'generate', response: respond(structured), flag: ON })
  const off = await scenario({ kind: 'generate', response: respond(structured), flag: undefined })
  check(assert.equal, digest(on.summary), digest(off.summary), 'Structured is unchanged')
  check(assert.deepEqual, on.actions, ['insertDiagram', 'deleteElement'])
}

// A response that carries a picture but is routed as Structured (inconsistent: Text Labs only sends caption_row with a raster picture):
// no caption row is inserted next to a diagram.
{
  const odd = infographicElement({ captionRow: copy(CAPTION_ROW) })
  odd.metadata.mode = 'v2'; odd.generation_config.infographic.mode = 'v2'
  const on = await scenario({ kind: 'generate', response: respond(odd), flag: ON })
  check(assert.equal, on.actions.includes('insertTextBox'), false)
  check(assert.equal, on.actions.includes('insertDiagram'), true)
}

// ---- 4. Flag on: the caption row cannot be added / the picture cannot be inserted ---------------------------------------------------------
{
  const captionFails = await scenario({ ...SCENARIOS.generate_applied_response(), flag: ON, config: { fail: { insertTextBox: 'layout refused' } } })
  check(assert.deepEqual, captionFails.actions, ['insertImage', 'insertTextBox', 'deleteElement'], 'the picture stays: no rollback of it, the placeholder is still replaced')
  check(assert.deepEqual, captionFails.run.commands.filter(c => c.action === 'deleteElement').map(c => c.args.elementId), ['blank-1'])
  check(assert.equal, captionFails.outcome.status, 'inserted')
  check(assert.equal, captionFails.outcome.elementIds.length, 1)
  check(assert.match, captionFails.toast.description, /The stage-name row could not be added under the picture: insertTextBox failed: layout refused/)
  const imageFails = await scenario({ ...SCENARIOS.generate_applied_response(), flag: ON, config: { fail: { insertImage: 'no room' } } })
  check(assert.deepEqual, imageFails.actions, ['insertImage'], 'the picture failed: no caption row, nothing else is touched')
  check(assert.equal, imageFails.outcome.status, 'failed')
  check(assert.equal, imageFails.run.blank.status, 'blank', 'the placeholder is kept')
}

// ---- 5. Flag on: variation and edit, with the pair as Layout persists it ----------------------------------------------------------------
{
  // The persisted payload of the first generation is what Layout hands back on reload; feed that, not a hand-made copy.
  const reloaded = copy(image.generationConfig)
  const oldCaption = reloaded.captionElementId
  check(assert.equal, oldCaption, caption.elementId, 'what Layout persisted is the link to the caption row that was inserted')
  const variation = await scenario({ ...SCENARIOS.variation_of_captioned_pair(), flag: ON, imageConfig: reloaded, clock: 1000 })
  check(assert.equal, variation.request.infographic_config.grid_row, '4/13', 'the variation is asked for the ORIGINAL area ...')
  check(assert.equal, variation.request.infographic_config.grid_column, '2/18')
  check(assert.equal, variation.request.infographic_config.start_row, 4)
  check(assert.equal, variation.request.infographic_config.height, 9)
  check(assert.deepEqual, variation.request.position_config, { start_col: 2, start_row: 4, position_width: 16, position_height: 9, auto_position: false })
  check(assert.equal, variation.request.existing_element.grid_position.position_height, 5.6, '... while the existing element is described as it is')
  check(assert.equal, variation.request.infographic_config.operation, 'variation')
  check(assert.deepEqual, variation.actions, ['insertImage', 'insertTextBox', 'deleteElement', 'deleteElement'])
  const deletes = variation.run.commands.filter(c => c.action === 'deleteElement').map(c => c.args.elementId)
  check(assert.deepEqual, deletes, ['img-1', oldCaption], 'both old elements go, the picture first')
  check(assert.equal, insertOf(variation, 'insertImage').gridRow, '5/10.6', 'the new pair lands in the area, not in the old picture box')
  check(assert.equal, insertOf(variation, 'insertTextBox').gridRow, '10.8/11.8')
  check(assert.notEqual, insertOf(variation, 'insertTextBox').id, oldCaption, 'a new caption element')
  check(assert.equal, insertOf(variation, 'insertImage').captionElementId, insertOf(variation, 'insertTextBox').id)
  check(assert.equal, variation.toast.description, 'INFOGRAPHIC updated on slide', 'a replaced pair needs no notice')

  // Without the flag the same variation is asked for the shrunk box (the bug the flag fixes) and nothing is linked.
  const off = await scenario({ ...SCENARIOS.variation_of_captioned_pair(), flag: undefined, imageConfig: reloaded })
  check(assert.equal, off.request.infographic_config.grid_row, '5/10.6')
  check(assert.deepEqual, off.actions, ['insertImage', 'deleteElement'])

  // The new response has no usable row (no list in the prompt, or skipped): the picture takes the whole area and the old row goes.
  const noRow = await scenario({ ...SCENARIOS.variation_no_caption_row(), flag: ON, imageConfig: reloaded })
  check(assert.equal, noRow.request.infographic_config.grid_row, '4/13')
  check(assert.deepEqual, noRow.actions, ['insertImage', 'deleteElement', 'deleteElement'])
  check(assert.equal, insertOf(noRow, 'insertImage').gridRow, '4/13', 'no shrunk box: the area')
  check(assert.deepEqual, noRow.run.commands.filter(c => c.action === 'deleteElement').map(c => c.args.elementId), ['img-1', oldCaption])
  check(assert.equal, 'captionElementId' in insertOf(noRow, 'insertImage'), false)
  check(assert.match, noRow.toast.description, /The previous stage-name row was removed because this variation has no stage names for it\./)
  const skippedVariation = await scenario({ kind: 'variation', response: respond(infographicElement({ captionRow: copy(SKIPPED_ROW) }), [SKIP_WARNING]), flag: ON, imageConfig: reloaded })
  check(assert.deepEqual, skippedVariation.actions, ['insertImage', 'deleteElement', 'deleteElement'])
  check(assert.match, skippedVariation.toast.description, /Stage names were not added under the picture \(this picture is not.*previous stage-name row was removed/)

  // The new row cannot be added: the picture stays and the OLD row is kept (never delete the only copy of the names).
  const failing = await scenario({ ...SCENARIOS.variation_of_captioned_pair(), flag: ON, imageConfig: reloaded, config: { fail: { insertTextBox: 'layout refused' } } })
  check(assert.deepEqual, failing.run.commands.filter(c => c.action === 'deleteElement').map(c => c.args.elementId), ['img-1'])
  check(assert.match, failing.toast.description, /could not be added under the picture/)
  // The old row is already gone (the user deleted it): silent. Any other failure to remove it is said.
  const gone = await scenario({ ...SCENARIOS.variation_of_captioned_pair(), flag: ON, imageConfig: reloaded, config: { missing: [oldCaption] } })
  check(assert.equal, gone.toast.description, 'INFOGRAPHIC updated on slide')
  check(assert.equal, gone.outcome.status, 'inserted')
  // A picture whose config lost its area: the live box is all there is, but the old row is still replaced.
  const noArea = await scenario({ ...SCENARIOS.variation_of_captioned_pair(), flag: ON, imageConfig: { captionElementId: 'cap-1' } })
  check(assert.equal, noArea.request.infographic_config.grid_row, '5/10.6')
  check(assert.deepEqual, noArea.run.commands.filter(c => c.action === 'deleteElement').map(c => c.args.elementId), ['img-1', 'cap-1'])

  // The old picture cannot be removed: the new pair is rolled back together and the old caption row is not touched.
  const stuck = await scenario({ ...SCENARIOS.variation_of_captioned_pair(), flag: ON, imageConfig: reloaded, clock: 1000, config: { failDeleteIds: ['img-1'] } })
  const inserted = stuck.run.layoutIds.map(c => c.assigned)
  check(assert.deepEqual, stuck.run.commands.filter(c => c.action === 'deleteElement').map(c => c.args.elementId), ['img-1', ...inserted], 'the new picture and the new caption row go together')
  check(assert.equal, stuck.run.commands.some(c => c.action === 'deleteElement' && c.args.elementId === oldCaption), false, 'the old caption row stays')
  check(assert.equal, stuck.outcome.status, 'failed')

  // Edit: the picture is replaced in its own box, the caption row stays, and the new picture still points at it.
  const edit = await scenario({ ...SCENARIOS.edit_of_captioned_pair(), flag: ON, imageConfig: reloaded })
  check(assert.equal, edit.request.infographic_config.grid_row, '5/10.6', 'an edit works in the picture\'s own box')
  check(assert.deepEqual, edit.actions, ['insertImage', 'deleteElement'])
  check(assert.deepEqual, edit.run.commands.filter(c => c.action === 'deleteElement').map(c => c.args.elementId), ['img-1'], 'the caption row stays')
  check(assert.equal, insertOf(edit, 'insertImage').gridRow, '5/10.6')
  check(assert.equal, insertOf(edit, 'insertImage').captionElementId, oldCaption)
  check(assert.equal, insertOf(edit, 'insertImage').generationConfig.captionElementId, oldCaption)
  check(assert.deepEqual, insertOf(edit, 'insertImage').generationConfig.infographic.caption_row.area, AREA, 'so a later variation still knows the area')
  const chain = await scenario({ ...SCENARIOS.variation_of_captioned_pair(), flag: ON, imageConfig: copy(insertOf(edit, 'insertImage').generationConfig) })
  check(assert.equal, chain.request.infographic_config.grid_row, '4/13', 'edit, then variation: still the original area')
  check(assert.deepEqual, chain.run.commands.filter(c => c.action === 'deleteElement').map(c => c.args.elementId), ['img-1', oldCaption])
}

if (!PRINT) {
  // The test is wired into the app: its own package.json registers it, and the flag is documented.
  check(assert.equal, ownPackage.scripts['test:infographic-caption-row'], 'node scripts/test-infographic-caption-row.mjs')
  if (TREE === ownRoot) {
    const example = fs.readFileSync(path.join(ownRoot, '.env.example'), 'utf8')
    check(assert.match, example, /^NEXT_PUBLIC_INFOGRAPHIC_CAPTION_ROW_ENABLED="false"$/m, 'listed in .env.example, default off')
  }
  console.log(`infographic caption row: ${checks} checks passed`)
}
