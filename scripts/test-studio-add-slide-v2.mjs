// J2 v2: generate-first "Add slide" pop-up (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED, default off).
// Offline and self-contained: no network, no git. Covers the pop-up state, the adapter seam
// (buildAddSlideV2Request), the compose wire bodies per type and sub-type against the J2-MAP examples, the page-side
// submit (async registration, anchor, failure paths) with fakes, the pop-up markup (server render with stubbed UI
// primitives) and the flag-gated hooks, then re-runs the suites against deliberately broken copies of the sources.
//
// Source of the expectations: workspace streams/ops/RESULT-J2-MAP.md item 8 and
// streams/ops/evidence/J2-MAP/item8-wiring-20261009 (selections-hero/REQUEST-EXAMPLES.json, insertion, async-recovery).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED'
function read(relative) { return fs.readFileSync(new URL(relative, import.meta.url), 'utf8') }
function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
}
function load(source, { env = {}, imports = {} } = {}) {
  const module = { exports: {} }
  // Same realm as the test, so deepEqual compares plain objects (a vm context would not).
  new Function('module', 'exports', 'process', 'require', compile(source))(module, module.exports, { env }, name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`)
    return imports[name]
  })
  return module.exports
}

const LIB = read('../lib/studio-add-slide-v2.ts')
const PANEL = read('../components/studio-add-slide-v2.tsx')
const SUBMIT = read('../lib/studio-add-slide-v2-submit.ts')
const PICKER = read('../components/slide-layout-picker.tsx')
const VIEWER = read('../components/presentation-viewer.tsx')
const AREA = read('../components/builder/presentation-area.tsx')
const PAGE = read('../app/builder/page.tsx')

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

const research = (over = {}) => ({ useUploadedDocuments: false, useWebSearch: false, useDeepResearch: false, useKnowledgeGraph: false, ...over })
const THEME = { mode: 'preset', preset_id: 'corporate_light' }
const context = (over = {}) => ({
  sessionId: 'sess-1', presentationId: 'pres-1', currentSlide: 3, slideCount: 7,
  research: research({ useWebSearch: true }), theme: THEME, themeLabel: 'Corporate Light', ...over,
})

// ---- Behaviour suite over the lib: runs on the real source and on every mutant ---------------------------------
function libSuite(lib) {
  // P1 / P2 / P3 defaults and option tables
  const initial = lib.initialAddSlideV2Draft()
  check(assert.deepEqual, initial, { slideType: 'content', contentSubtype: 'auto', text: '' }, 'generation is the default; content / Auto is preselected')
  check(assert.deepEqual, lib.ADD_SLIDE_V2_SLIDE_TYPES.map(o => o.value), ['title', 'section', 'closing', 'content'], 'P2 slide types')
  check(assert.deepEqual, lib.ADD_SLIDE_V2_CONTENT_SUBTYPES.map(o => o.value),
    ['auto', 'image', 'image_left', 'image_right', 'chart', 'infographic', 'text'], 'P3 sub-types, Auto first')
  check(assert.equal, lib.ADD_SLIDE_V2_PROMPT_LABEL, 'What should this slide say?', 'P4 single prompt label')
  check(assert.equal, lib.ADD_SLIDE_V2_BLANK_LABEL, 'Blank slide', 'P6 secondary option')
  const everyLabel = JSON.stringify([lib.ADD_SLIDE_V2_SLIDE_TYPES, lib.ADD_SLIDE_V2_CONTENT_SUBTYPES]).toLowerCase()
  check(assert.equal, /placeholder|layout/.test(everyLabel), false, 'no placeholder / layout-picker option (P1, P6)')

  // reducer
  let draft = lib.reduceAddSlideV2Draft(initial, { type: 'set_text', value: '  Q3 revenue by region  ' })
  check(assert.equal, draft.text, '  Q3 revenue by region  ', 'the reducer keeps the raw text; trimming happens in the seam')
  draft = lib.reduceAddSlideV2Draft(draft, { type: 'set_content_subtype', value: 'chart' })
  check(assert.equal, draft.contentSubtype, 'chart')
  draft = lib.reduceAddSlideV2Draft(draft, { type: 'set_slide_type', value: 'closing' })
  check(assert.equal, draft.slideType, 'closing')
  check(assert.equal, draft.text, '  Q3 revenue by region  ', 'changing the type keeps what the user typed')
  check(assert.equal, draft.contentSubtype, 'chart', 'the sub-type is remembered while another type is selected')
  check(assert.equal, lib.activeAddSlideV2Subtype(draft), null, 'a non-content type has no active sub-type')
  draft = lib.reduceAddSlideV2Draft(draft, { type: 'set_slide_type', value: 'content' })
  check(assert.equal, lib.activeAddSlideV2Subtype(draft), 'chart', 'back on content the remembered sub-type is active')
  check(assert.equal, lib.reduceAddSlideV2Draft(draft, { type: 'set_slide_type', value: 'placeholder' }), draft, 'unknown type is refused')
  check(assert.equal, lib.reduceAddSlideV2Draft(draft, { type: 'set_content_subtype', value: 'diagram' }), draft, 'unknown sub-type is refused')
  check(assert.deepEqual, lib.reduceAddSlideV2Draft(draft, { type: 'reset' }), initial, 'reset returns to the defaults')
  const frozen = Object.freeze({ ...initial })
  check(assert.notEqual, lib.reduceAddSlideV2Draft(frozen, { type: 'set_text', value: 'x' }), frozen, 'the reducer never mutates')
  check(assert.equal, frozen.text, '')

  // blockers
  const ready = { ...initial, contentSubtype: 'chart', text: 'Why now' }
  check(assert.equal, lib.addSlideV2Blocker(initial, { sessionId: 's' }, true), 'empty-text', 'content + Auto is allowed; only the text is missing')
  check(assert.equal, lib.addSlideV2Blocker({ ...initial, text: 'Say it' }, { sessionId: 's' }, true), null, 'ruling 1a: Generate is enabled for content + Auto')
  check(assert.equal, lib.addSlideV2Blocker({ ...ready, contentSubtype: 'image' }, { sessionId: 's' }, true), null, 'ruling 1b: Image generates')
  check(assert.equal, lib.addSlideV2Blocker({ ...initial, slideType: 'title' }, { sessionId: 's' }, true), 'empty-text', 'a hero type ignores the dormant Auto sub-type')
  check(assert.equal, lib.addSlideV2Blocker({ ...ready, text: '' }, { sessionId: 's' }, true), 'empty-text')
  check(assert.equal, lib.addSlideV2Blocker({ ...ready, text: '   \n ' }, { sessionId: 's' }, true), 'empty-text', 'whitespace is empty')
  // (e) text is required for every type, hero types included
  for (const slideType of ['title', 'section', 'closing']) {
    check(assert.equal, lib.addSlideV2Blocker({ ...ready, slideType, text: ' ' }, { sessionId: 's' }, true), 'empty-text', `${slideType} needs text`)
    check(assert.equal, lib.addSlideV2Blocker({ ...ready, slideType }, { sessionId: 's' }, true), null)
    check(assert.equal, lib.buildAddSlideV2Request({ ...ready, slideType, text: ' ' }, context()), null, `${slideType} without text builds nothing`)
  }
  check(assert.equal, lib.addSlideV2Blocker(ready, { sessionId: null }, true), 'no-session')
  check(assert.equal, lib.addSlideV2Blocker(ready, { sessionId: 's' }, false), 'no-submit', 'no adapter wired = Generate stays disabled')
  check(assert.equal, lib.addSlideV2Blocker(ready, { sessionId: 's' }, true), null)

  // the adapter seam
  const request = lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'image_left', text: '  Our team  ' }, context())
  check(assert.deepEqual, request, {
    mode: 'generate', slideType: 'content', contentSubtype: 'image_left', instruction: 'Our team',
    anchorVisualIndex: 2, sessionId: 'sess-1', presentationId: 'pres-1',
    research: research({ useWebSearch: true }), theme: THEME,
  })
  check(assert.equal, request.theme, THEME, 'the theme is passed through untouched')
  check(assert.equal, lib.buildAddSlideV2Request({ ...ready, slideType: 'title', contentSubtype: 'chart' }, context()).contentSubtype, null,
    'a title slide carries no sub-type even if one was remembered')
  for (const type of ['title', 'section', 'closing']) {
    check(assert.equal, lib.buildAddSlideV2Request({ ...ready, slideType: type, contentSubtype: 'infographic' }, context()).slideType, type)
  }
  check(assert.equal, lib.buildAddSlideV2Request(ready, context({ currentSlide: 1 })).anchorVisualIndex, 0, 'P9: after slide 1 is visual index 0')
  check(assert.equal, lib.buildAddSlideV2Request(ready, context({ currentSlide: 7, slideCount: 7 })).anchorVisualIndex, 6, 'P9: after the last slide')
  check(assert.equal, lib.buildAddSlideV2Request(ready, context({ currentSlide: 0 })).anchorVisualIndex, 0, 'never negative')
  check(assert.equal, lib.buildAddSlideV2Request(ready, context({ presentationId: null })).anchorVisualIndex, null, 'no deck yet = no index')
  check(assert.equal, lib.buildAddSlideV2Request({ ...ready, text: '  ' }, context()), null, 'empty text builds nothing')
  check(assert.equal, lib.buildAddSlideV2Request(ready, context({ sessionId: null })), null, 'no session builds nothing')
  const ctx = context({ research: research({ useWebSearch: true, useDeepResearch: true, useUploadedDocuments: true }) })
  const built = lib.buildAddSlideV2Request(ready, ctx)
  check(assert.deepEqual, built.research, ctx.research, 'P7: research is the chat setting, as given')
  check(assert.notEqual, built.research, ctx.research, 'the request owns a copy of the research flags')
  check(assert.equal, Object.keys(built).sort().join(','),
    'anchorVisualIndex,contentSubtype,instruction,mode,presentationId,research,sessionId,slideType,theme', 'no backend vocabulary on the request')
  check(assert.equal, lib.buildAddSlideV2Request({ ...ready, contentSubtype: 'auto' }, context()).contentSubtype, 'auto', 'content + Auto builds a request')
  check(assert.equal, lib.buildAddSlideV2Request({ ...ready, contentSubtype: 'image' }, context()).contentSubtype, 'image', 'Image builds a request')

  // (a) selections: the existing compose vocabulary per J2-MAP item8
  const sel = (slideType, subtype) => lib.addSlideV2Selections(slideType, subtype)
  check(assert.deepEqual, sel('title', null), { canvas_type: 'H1', content_type: 'hero' })
  check(assert.deepEqual, sel('section', null), { canvas_type: 'H2', content_type: 'hero' })
  check(assert.deepEqual, sel('closing', null), { canvas_type: 'H3', content_type: 'hero' })
  check(assert.deepEqual, sel('content', 'text'), { canvas_type: 'C1', content_type: 'text_heavy_columns' })
  check(assert.deepEqual, sel('content', 'chart'), { canvas_type: 'C1', content_type: 'chart', chart_subtype: 'single' })
  check(assert.deepEqual, sel('content', 'infographic'), { canvas_type: 'C1', content_type: 'infographic', infographic_subtype: 'vertical_center' })
  check(assert.deepEqual, sel('content', 'image_left'), { canvas_type: 'I1', content_type: 'text_heavy_columns' })
  check(assert.deepEqual, sel('content', 'image_right'), { canvas_type: 'I2', content_type: 'text_heavy_columns' })
  check(assert.deepEqual, sel('content', 'auto'), {}, 'ruling 1a: Auto sends no selections')
  check(assert.deepEqual, sel('content', 'image'), { canvas_type: 'I1', content_type: 'text_heavy_columns' }, 'ruling 1b: Image = I1 + text_heavy_columns (TEMP)')
  for (const subtype of lib.ADD_SLIDE_V2_CONTENT_SUBTYPES.map(o => o.value)) {
    const mapped = sel('content', subtype)
    if (mapped) for (const value of Object.values(mapped)) {
      check(assert.equal, /^(image_|image$|auto|V\d|H\d-)/.test(value), false, `no UX value on the wire: ${value}`)
    }
  }
  const shared = sel('content', 'chart'); shared.canvas_type = 'X'
  check(assert.equal, sel('content', 'chart').canvas_type, 'C1', 'callers never mutate the table')
  check(assert.equal, sel('title', null).narrative_role, undefined, 'no narrative_role / hero_variant extras')

  // (a) wire bodies against the map's REQUEST-EXAMPLES.json (sync form: assume_on_missing false, anchor 2)
  const EXAMPLE_ENVELOPE = {
    session_id: 'example-session-not-live', presentation_id: 'example-presentation-not-live', insert_after_index: 2,
    theme: { mode: 'auto' },
    research: { use_uploaded_documents: false, use_web_search: false, use_deep_research: false, use_knowledge_graph: false, web_search_max_queries: 3 },
    assume_on_missing: false,
  }
  const exampleContext = { sessionId: 'example-session-not-live', presentationId: 'example-presentation-not-live', currentSlide: 3, slideCount: 5,
    research: research(), theme: { mode: 'auto' }, themeLabel: 'Auto — matches deck' }
  for (const [name, draftOver, instruction, selections] of [
    ['title', { slideType: 'title' }, 'Open the deck with a clear title about safe migration planning.', { canvas_type: 'H1', content_type: 'hero' }],
    ['section', { slideType: 'section' }, 'Introduce the chapter about phased implementation.', { canvas_type: 'H2', content_type: 'hero' }],
    ['closing', { slideType: 'closing' }, 'Close with the next step: approve the pilot migration.', { canvas_type: 'H3', content_type: 'hero' }],
    ['image-left', { slideType: 'content', contentSubtype: 'image_left' }, 'Show a rollout illustration on the left and three milestones on the right.', { canvas_type: 'I1', content_type: 'text_heavy_columns' }],
    ['image-right', { slideType: 'content', contentSubtype: 'image_right' }, 'Show three milestones on the left and a rollout illustration on the right.', { canvas_type: 'I2', content_type: 'text_heavy_columns' }],
  ]) {
    const req = lib.buildAddSlideV2Request({ ...initial, ...draftOver, text: instruction }, exampleContext)
    check(assert.deepEqual, { ...lib.buildAddSlideV2ComposeBody(req, 2), assume_on_missing: false }, { ...EXAMPLE_ENVELOPE, instruction, selections }, `map example ${name}`)
  }
  const researchBody = lib.buildAddSlideV2ComposeBody(
    lib.buildAddSlideV2Request({ ...ready, text: 'x' }, context({ research: research({ useWebSearch: true, useUploadedDocuments: true }) })), 5)
  check(assert.deepEqual, researchBody.research,
    { use_uploaded_documents: true, use_web_search: true, use_deep_research: false, use_knowledge_graph: false, web_search_max_queries: 3 }, 'P7: chat research on the wire, cap = panel default')
  const researchBody2 = lib.buildAddSlideV2ComposeBody(
    lib.buildAddSlideV2Request({ ...ready, text: 'x' }, context({ research: research({ useDeepResearch: true, useKnowledgeGraph: true }) })), 5)
  check(assert.deepEqual, researchBody2.research,
    { use_uploaded_documents: false, use_web_search: false, use_deep_research: true, use_knowledge_graph: true, web_search_max_queries: 3 })
  check(assert.equal, researchBody.insert_after_index, 5, 'the body carries the anchor it is given, not the visual index')
  check(assert.equal, lib.buildAddSlideV2ComposeBody(lib.buildAddSlideV2Request({ ...ready, text: 'x' }, context({ presentationId: null })), null).insert_after_index, null, 'new deck: null anchor')
  const autoBody = lib.buildAddSlideV2ComposeBody({ ...request, contentSubtype: 'auto' }, 2)
  check(assert.equal, 'selections' in autoBody, false, 'ruling 1a: the selections key is omitted entirely, not sent empty')
  check(assert.equal, JSON.stringify(autoBody).includes('selections'), false)
  check(assert.equal, lib.buildAddSlideV2ComposeBody({ ...request, sessionId: null }, 2), null, 'no session, no body')
  check(assert.deepEqual, { ...lib.buildAddSlideV2ComposeBody(lib.buildAddSlideV2Request({ ...initial, text: 'Explain why a phased rollout reduces migration risk.' }, exampleContext), 2), assume_on_missing: false },
    { ...EXAMPLE_ENVELOPE, instruction: 'Explain why a phased rollout reduces migration risk.' }, 'map example global-auto: no selections key')
  check(assert.deepEqual, { ...lib.buildAddSlideV2ComposeBody(lib.buildAddSlideV2Request({ ...initial, contentSubtype: 'image', text: 'Our office' }, exampleContext), 2), assume_on_missing: false },
    { ...EXAMPLE_ENVELOPE, instruction: 'Our office', selections: { canvas_type: 'I1', content_type: 'text_heavy_columns' } }, 'Image body = the map I1 + text_heavy_columns shape')
  check(assert.equal, JSON.stringify(Object.keys(lib.buildAddSlideV2ComposeBody(request, 2)).sort()),
    JSON.stringify(['insert_after_index', 'instruction', 'presentation_id', 'research', 'selections', 'session_id', 'theme']), 'wire keys are snake_case only')

  // the draft survives closing the pop-up: sessionStorage, keyed per session + deck, every access guarded
  const memory = () => { const map = new Map(); return { map, getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => { map.set(k, String(v)) }, removeItem: k => { map.delete(k) } } }
  const thrower = () => ({ getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') }, removeItem() { throw new Error('blocked') } })
  const keyA = lib.addSlideV2DraftKey('sess-1', 'pres-1')
  check(assert.notEqual, keyA, lib.addSlideV2DraftKey('sess-2', 'pres-1'), 'the key names the session')
  check(assert.notEqual, keyA, lib.addSlideV2DraftKey('sess-1', 'pres-2'), 'the key names the deck')
  check(assert.notEqual, lib.addSlideV2DraftKey('sess-1', null), lib.addSlideV2DraftKey(null, 'sess-1'), 'null session and null deck never collide')
  check(assert.equal, keyA, lib.addSlideV2DraftKey('sess-1', 'pres-1'), 'the key is stable')
  const store = memory()
  const typed = { slideType: 'closing', contentSubtype: 'infographic', text: '  Thanks, and next steps  ' }
  lib.saveAddSlideV2Draft(store, keyA, typed)
  check(assert.deepEqual, lib.loadAddSlideV2Draft(store, keyA), typed, 'type, sub-type and the raw text round-trip')
  check(assert.deepEqual, lib.loadAddSlideV2Draft(store, lib.addSlideV2DraftKey('sess-1', 'pres-2')), initial, 'another deck has its own draft')
  check(assert.equal, store.map.size, 1)
  check(assert.deepEqual, JSON.parse(store.map.get(keyA)), typed, 'only type, sub-type and text are stored')
  lib.saveAddSlideV2Draft(store, keyA, initial)
  check(assert.equal, store.map.size, 0, 'a pristine draft keeps nothing')
  lib.saveAddSlideV2Draft(store, keyA, typed); lib.clearAddSlideV2Draft(store, keyA)
  check(assert.equal, store.map.size, 0, 'clear removes it')
  for (const raw of ['not json', '[]', 'null', '"x"', '{"slideType":"placeholder","contentSubtype":"auto","text":"x"}',
    '{"slideType":"title","contentSubtype":"diagram","text":"x"}', '{"slideType":"title","contentSubtype":"auto","text":5}', '{"slideType":"title","contentSubtype":"auto"}']) {
    store.map.set(keyA, raw)
    check(assert.deepEqual, lib.loadAddSlideV2Draft(store, keyA), initial, `a corrupt stored draft falls back to the defaults: ${raw}`)
  }
  check(assert.deepEqual, lib.loadAddSlideV2Draft(null, keyA), initial, 'no storage = defaults')
  check(assert.doesNotThrow, () => lib.saveAddSlideV2Draft(null, keyA, typed))
  check(assert.doesNotThrow, () => lib.clearAddSlideV2Draft(null, keyA))
  check(assert.deepEqual, lib.loadAddSlideV2Draft(thrower(), keyA), initial, 'a throwing getItem is guarded')
  check(assert.doesNotThrow, () => lib.saveAddSlideV2Draft(thrower(), keyA, typed), 'a throwing setItem is guarded')
  check(assert.doesNotThrow, () => lib.saveAddSlideV2Draft(thrower(), keyA, initial), 'a throwing removeItem is guarded')
  check(assert.doesNotThrow, () => lib.clearAddSlideV2Draft(thrower(), keyA), 'a throwing removeItem is guarded on clear')
  check(assert.equal, lib.isPristineAddSlideV2Draft(initial), true)
  check(assert.equal, lib.isPristineAddSlideV2Draft({ ...initial, text: ' ' }), false, 'whitespace is a draft')
  check(assert.equal, lib.isPristineAddSlideV2Draft({ ...initial, contentSubtype: 'chart' }), false)
  check(assert.equal, lib.isPristineAddSlideV2Draft({ ...initial, slideType: 'title' }), false)

  // P7 display helpers
  const rows = lib.describeAddSlideV2Research(research({ useWebSearch: true, useKnowledgeGraph: true }))
  check(assert.deepEqual, rows.map(r => [r.label, r.on]),
    [['Web search', true], ['Deep research', false], ['Your documents', false], ['Knowledge graph', true]])
  const presets = [{ preset_id: 'corporate_light', name: 'Corporate Light' }]
  check(assert.equal, lib.describeAddSlideV2Theme({ mode: 'auto' }, 'Ignored', presets), 'Auto — matches deck')
  check(assert.equal, lib.describeAddSlideV2Theme({ mode: 'preset', preset_id: 'corporate_light' }, null, presets), 'Corporate Light')
  check(assert.equal, lib.describeAddSlideV2Theme({ mode: 'preset', preset_id: 'unknown_one' }, null, presets), 'unknown_one')
  check(assert.equal, lib.describeAddSlideV2Theme({ mode: 'preset', preset_id: 'corporate_light' }, 'My Brand', presets), 'My Brand', 'a named profile wins')
  check(assert.equal, lib.describeAddSlideV2Theme({ mode: 'custom', primary_hex: '#112233' }, null, presets), 'Brand #112233')
  check(assert.equal, lib.describeAddSlideV2Theme({ mode: 'custom' }, null, presets), 'Custom theme')
  check(assert.equal, lib.describeAddSlideV2Theme({}, null, presets), 'Deck default')
  check(assert.equal, lib.addSlideV2PlacementNote(3), 'The new slide is added right after slide 3.', 'P9 note')
}

// ---- Behaviour suite over the pop-up markup ---------------------------------------------------------------------
function panelModule(panelSource, lib) {
  const icon = name => () => React.createElement('svg', { 'data-icon': name })
  return load(panelSource, {
    imports: {
      react: React,
      'react/jsx-runtime': require('react/jsx-runtime'),
      'lucide-react': { Plus: icon('plus'), Sparkles: icon('sparkles'), Square: icon('square'), X: icon('x') },
      '@/components/ui/popover': { Popover: () => null, PopoverTrigger: () => null, PopoverContent: () => null },
      '@/lib/utils': { cn: (...a) => a.filter(Boolean).join(' ') },
      '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [] },
      '@/lib/studio-add-slide-v2': lib,
      './studio-add-slide-v2.css': {},
    },
  })
}
const radioChecked = (html, value) => {
  const tag = (html.match(/<input[^>]*>/g) ?? []).find(item => item.includes(`value="${value}"`))
  assert.ok(tag, `radio ${value} is rendered`)
  return tag.includes('checked=""')
}
function markupSuite(panelSource, lib) {
  const { AddSlideV2Panel } = panelModule(panelSource, lib)
  const render = props => renderToStaticMarkup(React.createElement(AddSlideV2Panel, { context: context(), onInsertBlank() {}, onClose() {}, ...props }))
  const wired = render({ submit: async () => ({ ok: true }) })
  const unwired = render({})

  check(assert.match, wired, /What should this slide say\?/, 'P4 label')
  check(assert.equal, (wired.match(/<textarea/g) ?? []).length, 1, 'P4: exactly one free-text box')
  check(assert.equal, (wired.match(/<input /g) ?? []).length, 4 + 7, 'only the 4 slide types and 7 sub-types are inputs')
  check(assert.equal, (wired.match(/type="radio"/g) ?? []).length, 11)
  for (const label of ['Title', 'Section', 'Closing', 'Content']) check(assert.match, wired, new RegExp(`<span>${label}</span>`), `type ${label}`)
  for (const label of ['Auto', 'Image', 'Image left', 'Image right', 'Chart', 'Infographic', 'Text']) check(assert.match, wired, new RegExp(`<span>${label}</span>`), `sub-type ${label}`)
  check(assert.equal, radioChecked(wired, 'content'), true, 'content is preselected')
  check(assert.equal, radioChecked(wired, 'title'), false)
  check(assert.equal, radioChecked(wired, 'auto'), true, 'Auto is preselected')
  check(assert.equal, radioChecked(wired, 'chart'), false)
  check(assert.match, wired, /Generate slide/)
  check(assert.match, wired, /Blank slide/, 'P6')
  check(assert.equal, (wired.match(/Blank slide/g) ?? []).length, 1, 'one secondary option')
  check(assert.match, wired, /The new slide is added right after slide 3\./, 'P9 note')
  check(assert.equal, /placeholder slide|choose a layout|layout picker/i.test(wired), false, 'no placeholder / layout mode (P1, P6)')
  // P7: read-only echo of the chat settings
  check(assert.match, wired, /Follows your chat settings/)
  check(assert.match, wired, /Web search <b>on<\/b>/)
  check(assert.match, wired, /Deep research <b>off<\/b>/)
  check(assert.match, wired, /Corporate Light/, 'theme label')
  const settingsBlock = wired.slice(wired.indexOf('asv2-chat'), wired.indexOf('asv2-actions'))
  check(assert.equal, /<input|<select|<textarea|<button/.test(settingsBlock), false, 'the chat settings block has no controls')
  // gating
  check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(wired), true, 'empty text keeps Generate disabled')
  check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(unwired), true, 'no submit keeps Generate disabled')
  check(assert.match, unwired, /data-blocker="empty-text"/)
  const chartNoText = render({ submit: async () => ({ ok: true }), initialDraft: { slideType: 'content', contentSubtype: 'chart', text: '' } })
  check(assert.match, chartNoText, /data-blocker="empty-text"/)
  const autoTyped = render({ submit: async () => ({ ok: true }), initialDraft: { slideType: 'content', contentSubtype: 'auto', text: 'Why a phased rollout' } })
  check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(autoTyped), false, 'ruling 1a: content + Auto can Generate')
  const imageTyped = render({ submit: async () => ({ ok: true }), initialDraft: { slideType: 'content', contentSubtype: 'image', text: 'Our office' } })
  check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(imageTyped), false, 'ruling 1b: Image can Generate')
  check(assert.equal, /class="asv2-blank"[^>]*disabled/.test(wired), false, 'blank stays available')
  // sub-types belong to content slides only
  for (const slideType of ['title', 'section', 'closing']) {
    const other = render({ submit: async () => ({ ok: true }), initialDraft: { slideType, contentSubtype: 'chart', text: '' } })
    check(assert.equal, /Content style/.test(other), false, `no sub-type row on a ${slideType} slide`)
    check(assert.equal, /<span>Infographic<\/span>/.test(other), false)
    check(assert.equal, (other.match(/type="radio"/g) ?? []).length, 4)
  }
  const typed = render({ submit: async () => ({ ok: true }), initialDraft: { slideType: 'content', contentSubtype: 'chart', text: 'Revenue by region' } })
  check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(typed), false, 'text + session + submit enables Generate')
  check(assert.equal, radioChecked(typed, 'chart'), true)
  check(assert.equal, radioChecked(typed, 'auto'), false)
  check(assert.match, typed, />Revenue by region<\/textarea>/)
  const busy = render({ submit: async () => ({ ok: true }), disabled: true })
  check(assert.equal, /class="asv2-blank"[^>]*disabled/.test(busy), true, 'blank follows the picker disabled state')
}

// ---- Behaviour suite over the page-side submit (fakes for fetch, the page's owner capture and its job queue) --------
function submitModule(submitSource, lib) {
  return load(submitSource, {
    imports: {
      '@/lib/slide-compose-async': load(read('../lib/slide-compose-async.ts')),
      '@/components/slide-generation-panel/compose-helpers': load(read('../components/slide-generation-panel/compose-helpers.ts')),
      '@/lib/studio-add-slide-v2': lib,
    },
  })
}
function submitSuite(sub, lib) {
  const chart = text => lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text }, context())
  const accepted = (jobId, over = {}) => ({ status: 'accepted', job_id: jobId, target_index: 3, session_id: 'sess-1', presentation_id: 'pres-1', ...over })
  function harness(over = {}) {
    const calls = { fetch: [], accepted: [], order: [] }
    const deps = {
      fetchImpl: async (url, init) => {
        calls.order.push('fetch'); calls.fetch.push({ url, init, body: JSON.parse(init.body) })
        if (over.fetchThrows) throw new Error('socket hang up')
        return { ok: over.ok ?? true, json: over.badJson ? async () => { throw new Error('bad json') } : async () => over.reply ?? accepted('job-1') }
      },
      newJobId: () => 'job-1',
      captureSessionOwner: () => { calls.order.push('capture'); return () => over.sessionStillCurrent ?? true },
      isSessionAdmitted: () => { calls.order.push('admit'); return over.admitted ?? true },
      selection: () => ({ visualIndex: 2, realSlideCount: 4, jobs: {}, ...(over.selection ?? {}) }),
      onAccepted: job => { calls.order.push('accepted'); calls.accepted.push(job) },
    }
    return { deps, calls }
  }
  const run = async (request, over) => { const h = harness(over); return { result: await sub.submitAddSlideV2(request, h.deps), calls: h.calls } }
  const refused = (r, text) => { check(assert.equal, r.result.ok, false); if (text) check(assert.match, r.result.message, text); check(assert.equal, r.calls.accepted.length, 0, 'nothing is registered'); }
  const jobAt = (target, over = {}) => ({ kind: 'compose', status: 'building', target_layout_index: target, ...over })

  return (async () => {
    // (b) happy path: one POST, the page's queue gets the accepted job with the WIRE request
    const happy = await run(chart('  Q3 revenue  '))
    check(assert.deepEqual, happy.result, { ok: true })
    check(assert.equal, happy.calls.fetch.length, 1)
    check(assert.equal, happy.calls.fetch[0].url, '/api/slides/compose')
    check(assert.equal, happy.calls.fetch[0].init.method, 'POST')
    check(assert.equal, happy.calls.fetch[0].init.headers['Content-Type'], 'application/json')
    const wire = {
      session_id: 'sess-1', presentation_id: 'pres-1', insert_after_index: 2, instruction: 'Q3 revenue', theme: THEME,
      selections: { canvas_type: 'C1', content_type: 'chart', chart_subtype: 'single' },
      research: { use_uploaded_documents: false, use_web_search: true, use_deep_research: false, use_knowledge_graph: false, web_search_max_queries: 3 },
      job_id: 'job-1', async: true, assume_on_missing: true,
    }
    check(assert.deepEqual, happy.calls.fetch[0].body, wire, 'async wire body: minted job id, async true, assume_on_missing true (the backend forces it)')
    check(assert.equal, happy.calls.accepted.length, 1)
    const job = happy.calls.accepted[0]
    check(assert.deepEqual, { ...job, request: undefined, target_slide_id: undefined },
      { status: 'accepted', job_id: 'job-1', target_index: 3, session_id: 'sess-1', presentation_id: 'pres-1', kind: 'compose', title: 'Q3 revenue', request: undefined, target_slide_id: undefined })
    check(assert.deepEqual, job.request, wire, 'the page registers the wire request, not the popup camelCase request')
    check(assert.deepEqual, happy.calls.order, ['capture', 'fetch', 'admit', 'accepted'], 'owner captured before the request; admission tested right before registration')
    check(assert.equal, (await run(chart('x'.repeat(100)))).calls.accepted[0].title.length, 72, 'title is the first 72 characters, like the Slide panel')
    check(assert.equal, (await run(chart('x'), { reply: accepted('job-1', { kind: 'compose', target_slide_id: null }) })).calls.accepted[0].kind, 'compose')
    const noKind = (await run(chart('x'))).calls.accepted[0]
    check(assert.equal, noKind.kind, 'compose', 'kind defaults to compose')

    // (a) every type and sub-type goes out with its mapped selections, and nothing UX-only
    for (const [slideType, contentSubtype, selections] of [
      ['title', null, { canvas_type: 'H1', content_type: 'hero' }], ['section', null, { canvas_type: 'H2', content_type: 'hero' }],
      ['closing', null, { canvas_type: 'H3', content_type: 'hero' }],
      ['content', 'text', { canvas_type: 'C1', content_type: 'text_heavy_columns' }],
      ['content', 'chart', { canvas_type: 'C1', content_type: 'chart', chart_subtype: 'single' }],
      ['content', 'infographic', { canvas_type: 'C1', content_type: 'infographic', infographic_subtype: 'vertical_center' }],
      ['content', 'image_left', { canvas_type: 'I1', content_type: 'text_heavy_columns' }],
      ['content', 'image_right', { canvas_type: 'I2', content_type: 'text_heavy_columns' }],
    ]) {
      const r = await run(lib.buildAddSlideV2Request({ slideType, contentSubtype: contentSubtype ?? 'auto', text: 'Say it' }, context()))
      check(assert.deepEqual, r.calls.fetch[0].body.selections, selections, `${slideType}/${contentSubtype} selections`)
      check(assert.equal, /slideType|contentSubtype|anchorVisualIndex|image_left|image_right|"image"/.test(r.calls.fetch[0].init.body), false, 'no UX vocabulary in the body')
    }
    const autoRun = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'auto', text: 'Say it' }, context()))
    check(assert.equal, 'selections' in autoRun.calls.fetch[0].body, false, 'ruling 1a on the wire: no selections key for Auto')
    check(assert.equal, autoRun.calls.fetch[0].init.body.includes('selections'), false)
    check(assert.deepEqual, (await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'image', text: 'Say it' }, context()))).calls.fetch[0].body.selections,
      { canvas_type: 'I1', content_type: 'text_heavy_columns' }, 'ruling 1b on the wire')
    const noSession = await run({ ...chart('x'), sessionId: null })
    refused(noSession, /can't be generated yet/); check(assert.equal, noSession.calls.fetch.length, 0, 'no session sends nothing')

    // (d) the wire anchor is the REAL Layout index, resolved at submit
    const placeholderBefore = { selection: { visualIndex: 3, realSlideCount: 4, jobs: { a: jobAt(1) } } }
    const onC = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text: 'x' }, context({ currentSlide: 4 })), placeholderBefore)
    check(assert.equal, onC.calls.fetch[0].body.insert_after_index, 2, '[A,B,C,D] + placeholder before B: slide C (visual 3) anchors at real index 2, not 3')
    const errorJob = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text: 'x' }, context({ currentSlide: 4 })),
      { selection: { visualIndex: 3, realSlideCount: 4, jobs: { a: jobAt(1, { status: 'error' }) } } })
    check(assert.equal, errorJob.calls.fetch[0].body.insert_after_index, 2, 'a failed placeholder still occupies a visual slot')
    const builtJob = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text: 'x' }, context({ currentSlide: 4 })),
      { selection: { visualIndex: 3, realSlideCount: 4, jobs: { a: jobAt(1, { status: 'built' }) } } })
    check(assert.equal, builtJob.calls.fetch[0].body.insert_after_index, 3, 'a finished job is no placeholder')
    const refineJob = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text: 'x' }, context({ currentSlide: 4 })),
      { selection: { visualIndex: 3, realSlideCount: 4, jobs: { a: jobAt(1, { kind: 'refine' }) } } })
    check(assert.equal, refineJob.calls.fetch[0].body.insert_after_index, 3, 'a refine overlay is no placeholder')
    const onPlaceholder = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text: 'x' }, context({ currentSlide: 2 })),
      { selection: { visualIndex: 1, realSlideCount: 4, jobs: { a: jobAt(1) } } })
    refused(onPlaceholder, /finished slide/); check(assert.equal, onPlaceholder.calls.fetch.length, 0, 'a selected placeholder has no anchor: block, never reuse the last real selection')
    const noSlides = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text: 'x' }, context({ currentSlide: 1 })),
      { selection: { visualIndex: 0, realSlideCount: 0, jobs: {} } })
    refused(noSlides, /Couldn't tell which slide/); check(assert.equal, noSlides.calls.fetch.length, 0)
    const moved = await run(chart('x'), { selection: { visualIndex: 3 } })
    refused(moved, /selected slide changed/); check(assert.equal, moved.calls.fetch.length, 0, 'the popup and the page must agree on the selected slide')
    const newDeck = await run(lib.buildAddSlideV2Request({ slideType: 'title', contentSubtype: 'auto', text: 'Hello' }, context({ presentationId: null })),
      { reply: accepted('job-1', { presentation_id: null, target_index: 0 }) })
    check(assert.equal, newDeck.calls.fetch[0].body.insert_after_index, null, 'no deck yet: null anchor')
    check(assert.equal, newDeck.calls.fetch[0].body.presentation_id, null)
    check(assert.equal, newDeck.result.ok, true)
    const direct = sub.resolveAddSlideV2Anchor({ presentationId: 'p', visualIndex: 1, realSlideCount: 4, jobs: { a: jobAt(1) } })
    check(assert.deepEqual, { ok: direct.ok, reason: direct.reason }, { ok: false, reason: 'placeholder-selected' })
    check(assert.deepEqual, sub.resolveAddSlideV2Anchor({ presentationId: 'p', visualIndex: 0, realSlideCount: 0, jobs: {} }).reason, 'unresolved')
    check(assert.deepEqual, sub.resolveAddSlideV2Anchor({ presentationId: 'p', visualIndex: 2, realSlideCount: 4, jobs: {} }), { ok: true, insertAfterIndex: 2 })

    // (c) no questions on the async path; failures keep the draft (ok:false) and never register a job
    const asked = await run(chart('x'), { reply: { status: 'needs_input', questions: [{ slot: 's', ask: 'More?' }] } })
    refused(asked, /Follow-up questions are coming in v2\.1/)
    check(assert.equal, /needs_input|assume|async|slot/i.test(asked.result.message), false, 'plain words, no jargon')
    check(assert.equal, asked.result.message, sub.ADD_SLIDE_V2_NEEDS_INPUT_MESSAGE)
    refused(await run(chart('x'), { ok: false, reply: { error: 'Slide Composer is disabled' } }), /Slide Composer is disabled/)
    refused(await run(chart('x'), { ok: false, reply: accepted('job-1') }), undefined)
    refused(await run(chart('x'), { reply: { status: 'accepted' } }), undefined)
    refused(await run(chart('x'), { badJson: true }), undefined)
    const threw = await run(chart('x'), { fetchThrows: true })
    refused(threw, /Couldn't confirm the slide was queued/); check(assert.equal, threw.calls.fetch.length, 1, 'no blind retry after a lost reply')
    // fences tied to the minted job and the request
    refused(await run(chart('x'), { reply: accepted('other-job') }), /Unexpected reply/)
    refused(await run(chart('x'), { reply: accepted('job-1', { session_id: 'sess-2' }) }), /Unexpected reply/)
    refused(await run(chart('x'), { reply: accepted('job-1', { presentation_id: 'pres-2' }) }), /Unexpected reply/)
    check(assert.equal, (await run(chart('x'), { reply: accepted('job-1', { presentation_id: null }) })).result.ok, true, 'a reply without a deck id is tolerated')
    refused(await run(chart('x'), { sessionStillCurrent: false }), /session changed/)
    refused(await run(chart('x'), { admitted: false }), /session changed/)

    // Blank: the same real-index resolution as Generate, only while a placeholder is in play (flag on only)
    const blank = (over = {}) => sub.resolveAddSlideV2BlankTarget({ presentationId: 'pres-1', visualIndex: 3, expectedVisualIndex: 3, realSlideCount: 4, jobs: {}, ...over })
    check(assert.deepEqual, blank(), { ok: true, position: undefined }, 'no placeholders: the old native position is kept')
    check(assert.deepEqual, blank({ jobs: { a: jobAt(1) } }), { ok: true, position: 3 },
      '[A,B,C,D] + placeholder before B, C selected (visual 3): position 3 = after real index 2, not the visual 4 the old path sends')
    check(assert.deepEqual, blank({ jobs: { a: jobAt(1, { status: 'error' }) } }), { ok: true, position: 3 }, 'a failed placeholder counts too')
    check(assert.deepEqual, blank({ jobs: { a: jobAt(1, { status: 'built' }) } }), { ok: true, position: undefined }, 'a built job is no placeholder')
    check(assert.deepEqual, blank({ jobs: { a: jobAt(1, { kind: 'refine' }) } }), { ok: true, position: undefined }, 'a refine overlay is no placeholder')
    check(assert.deepEqual, blank({ visualIndex: 2, expectedVisualIndex: 2, jobs: { a: jobAt(4) } }), { ok: true, position: 3 }, 'a placeholder after the selection changes nothing')
    const blankOnPlaceholder = blank({ visualIndex: 1, expectedVisualIndex: 1, jobs: { a: jobAt(1) } })
    check(assert.equal, blankOnPlaceholder.ok, false); check(assert.match, blankOnPlaceholder.message, /finished slide/, 'a selected placeholder has no real position: refuse')
    const blankMoved = blank({ expectedVisualIndex: 2, jobs: { a: jobAt(1) } })
    check(assert.equal, blankMoved.ok, false); check(assert.match, blankMoved.message, /selected slide changed/)
    check(assert.deepEqual, blank({ expectedVisualIndex: 2 }), { ok: true, position: undefined }, 'without placeholders nothing is compared')
    check(assert.deepEqual, blank({ presentationId: null, jobs: { a: jobAt(1) } }), { ok: true, position: undefined }, 'no deck: old path')
    check(assert.equal, blank({ realSlideCount: 0, visualIndex: 0, expectedVisualIndex: 0, jobs: { a: jobAt(0) } }).ok, false, 'only a placeholder on screen: refuse')
    // the page factory: submit only with generation on, the Blank resolver always
    const factoryDeps = (generationEnabled, over = {}) => { const h = harness(over); return { h, hooks: sub.createAddSlideV2Hooks({ ...h.deps, generationEnabled, presentationId: 'pres-1' }) } }
    const off = factoryDeps(false)
    check(assert.equal, off.hooks.submit, undefined, 'no submit without the composer and its async mode')
    check(assert.deepEqual, off.hooks.resolveBlankTarget(2), { ok: true, position: undefined }, 'the Blank resolver is always there')
    const withJobs = factoryDeps(false, { selection: { visualIndex: 3, jobs: { a: jobAt(1) } } })
    check(assert.deepEqual, withJobs.hooks.resolveBlankTarget(3), { ok: true, position: 3 }, 'the factory feeds the page selection into the resolver')
    const on = factoryDeps(true)
    check(assert.equal, typeof on.hooks.submit, 'function')
    check(assert.deepEqual, await on.hooks.submit(chart('Via the factory')), { ok: true })
    check(assert.equal, on.h.calls.accepted.length, 1, 'the factory submit registers through onAccepted')
  })()
}

// A handler that rejects after `void`-ing its promise must fail the suite, not crash the process.
const unhandled = []
process.on('unhandledRejection', error => { unhandled.push(error) })
const raiseUnhandled = () => { if (unhandled.length) throw unhandled.splice(0)[0] }

// ---- Interaction suite over the pop-up: the real component under a tiny hooks runtime (draft, Discard, Blank, Generate) ----
function mountPanel(panelSource, lib, props) {
  const slots = []
  let cursor = 0, dirty = false, dead = false
  const queued = []
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const hooks = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof init === 'function' ? init() : init }; return [slots[i].value, v => { const next = typeof v === 'function' ? v(slots[i].value) : v; if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true } }] },
    useReducer(reducer, arg, init) { const i = cursor++; if (!(i in slots)) slots[i] = { value: init ? init(arg) : arg }; return [slots[i].value, action => { const next = reducer(slots[i].value, action); if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true } }] },
    useRef(init) { const i = cursor++; if (!(i in slots)) slots[i] = { current: init }; return slots[i] },
    useMemo(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value },
    useId() { const i = cursor++; return `:r${i}:` },
    useEffect(setup, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { slots[i] = { deps }; queued.push(setup) } },
  }
  const jsx = (type, p) => ({ type, props: p ?? {} })
  const icon = () => null
  const mod = load(panelSource, { imports: {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'lucide-react': { Plus: icon, Sparkles: icon, Square: icon, X: icon },
    '@/components/ui/popover': { Popover: icon, PopoverTrigger: icon, PopoverContent: icon },
    '@/lib/utils': { cn: (...a) => a.filter(Boolean).join(' ') }, '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [] },
    '@/lib/studio-add-slide-v2': lib, './studio-add-slide-v2.css': {},
  } })
  let tree
  const rt = {
    closed: 0,
    render() {
      let guard = 0
      do { cursor = 0; dirty = false; tree = mod.AddSlideV2Panel({ ...props }); while (queued.length) queued.shift()() } while (dirty && ++guard < 30)
      return tree
    },
    get tree() { return tree },
    all(pred) {
      const out = []
      const walk = node => { if (!node || typeof node !== 'object') return; if (pred(node)) out.push(node); const c = node.props?.children; for (const child of Array.isArray(c) ? c.flat(Infinity) : [c]) walk(child) }
      walk(tree)
      return out
    },
    one(pred) { const hits = rt.all(pred); assert.equal(hits.length, 1, `exactly one node (got ${hits.length})`); return hits[0] },
    byClass: name => rt.one(n => n.props?.className === name),
    maybeClass: name => rt.all(n => n.props?.className === name)[0] ?? null,
    text: () => rt.one(n => n.type === 'textarea').props.value,
    radio: value => rt.all(n => n.type === 'input' && n.props.value === value)[0],
    type(value) { rt.one(n => n.type === 'textarea').props.onChange({ target: { value } }); rt.render() },
    pick(value) { rt.radio(value).props.onChange(); rt.render() },
    async click(name) { rt.byClass(name).props.onClick(); for (let i = 0; i < 4; i++) await Promise.resolve(); await new Promise(r => setTimeout(r, 0)); raiseUnhandled(); rt.render() },
    error: () => rt.maybeClass('asv2-error')?.props.children ?? null,
  }
  rt.render()
  return rt
}
async function panelInteractionSuite(panelSource, lib) {
  const mem = () => { const map = new Map(); return { map, getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => { map.set(k, String(v)) }, removeItem: k => { map.delete(k) } } }
  const key = lib.addSlideV2DraftKey('sess-1', 'pres-1')
  const base = (storage, over = {}) => ({ context: context(), storage, onInsertBlank() {}, onClose() {}, submit: async () => ({ ok: true }), ...over })
  const draftIn = store => (store.map.has(key) ? JSON.parse(store.map.get(key)) : null)

  // typing is kept, pristine is not
  const store = mem()
  let rt = mountPanel(panelSource, lib, base(store))
  check(assert.equal, draftIn(store), null, 'a fresh pop-up stores nothing')
  check(assert.equal, rt.maybeClass('asv2-discard'), null, 'no Discard on a pristine draft')
  rt.pick('chart'); rt.type('Q3 revenue by region')
  check(assert.deepEqual, draftIn(store), { slideType: 'content', contentSubtype: 'chart', text: 'Q3 revenue by region' }, 'type, sub-type and text are kept as you go')
  check(assert.ok, rt.maybeClass('asv2-discard'), 'Discard appears once there is a draft')
  // close and reopen: a new mount over the same storage restores it
  rt = mountPanel(panelSource, lib, base(store))
  check(assert.equal, rt.text(), 'Q3 revenue by region', 'reopen restores the text')
  check(assert.equal, rt.radio('chart').props.checked, true, 'reopen restores the sub-type')
  check(assert.equal, rt.radio('content').props.checked, true)
  check(assert.equal, rt.byClass('asv2-generate').props.disabled, false, 'a restored draft can Generate')
  rt.pick('title'); rt.render()
  check(assert.equal, draftIn(store).slideType, 'title', 'a change of type is kept too')
  rt = mountPanel(panelSource, lib, base(store))
  check(assert.equal, rt.radio('title').props.checked, true, 'restored type')
  check(assert.equal, rt.all(n => n.type === 'input' && n.props.type === 'radio').length, 4, 'title: no sub-type row')
  // another deck or session has its own draft
  const other = mountPanel(panelSource, lib, base(store, { context: context({ presentationId: 'pres-2' }) }))
  check(assert.equal, other.text(), '', 'a different deck does not see this draft')
  const otherSession = mountPanel(panelSource, lib, base(store, { context: context({ sessionId: 'sess-9' }) }))
  check(assert.equal, otherSession.text(), '', 'a different session does not see this draft')
  // a draft passed in wins over the stored one
  const seeded = mountPanel(panelSource, lib, base(store, { initialDraft: { slideType: 'section', contentSubtype: 'auto', text: 'Seed' } }))
  check(assert.equal, seeded.text(), 'Seed')

  // Discard
  rt = mountPanel(panelSource, lib, base(store))
  rt.byClass('asv2-discard').props.onClick()
  check(assert.equal, draftIn(store), null, 'Discard clears the stored draft at once')
  rt.render()
  check(assert.equal, rt.text(), '', 'Discard empties the text')
  check(assert.equal, rt.radio('content').props.checked, true, 'Discard returns to the defaults')
  check(assert.equal, rt.radio('auto').props.checked, true)
  check(assert.equal, rt.maybeClass('asv2-discard'), null)

  // Generate: success clears (the pop-up closes, so only the explicit clear counts); failure keeps
  const s2 = mem(); const submitted = []; let closed = 0
  rt = mountPanel(panelSource, lib, base(s2, { onClose() { closed++ }, submit: async request => { submitted.push(request); return { ok: true } } }))
  rt.pick('chart'); rt.type('Revenue by region')
  check(assert.notEqual, draftIn(s2), null)
  await rt.click('asv2-generate')
  check(assert.equal, submitted.length, 1)
  check(assert.equal, submitted[0].instruction, 'Revenue by region')
  check(assert.equal, closed, 1, 'a successful Generate closes the pop-up')
  check(assert.equal, draftIn(s2), null, 'a successful Generate clears the draft')
  const s3 = mem()
  rt = mountPanel(panelSource, lib, base(s3, { submit: async () => ({ ok: false, message: 'Nope, try later' }) }))
  rt.pick('chart'); rt.type('Keep me')
  await rt.click('asv2-generate')
  check(assert.equal, rt.error(), 'Nope, try later')
  check(assert.equal, draftIn(s3).text, 'Keep me', 'a failed Generate keeps the draft')
  check(assert.equal, rt.text(), 'Keep me')
  const s4 = mem()
  rt = mountPanel(panelSource, lib, base(s4, { submit: async () => { throw new Error('boom') } }))
  rt.pick('chart'); rt.type('Still here')
  await rt.click('asv2-generate')
  check(assert.equal, rt.error(), 'boom')
  check(assert.equal, draftIn(s4).text, 'Still here', 'a thrown submit keeps the draft')

  // Blank: its own outcome, never touches the draft
  const s5 = mem(); const blankCalls = []
  rt = mountPanel(panelSource, lib, base(s5, { onInsertBlank: () => { blankCalls.push(1); return { ok: false, message: 'Select a finished slide to add after.' } } }))
  rt.pick('chart'); rt.type('Do not lose me')
  await rt.click('asv2-blank')
  check(assert.equal, blankCalls.length, 1)
  check(assert.equal, rt.error(), 'Select a finished slide to add after.', 'a refused Blank says why and stays open')
  check(assert.equal, draftIn(s5).text, 'Do not lose me', 'Blank keeps the draft')
  const s6 = mem()
  rt = mountPanel(panelSource, lib, base(s6, { onInsertBlank: async () => {} }))
  rt.type('Also kept')
  await rt.click('asv2-blank')
  check(assert.equal, rt.error(), null, 'an accepted Blank shows no error')
  check(assert.equal, draftIn(s6).text, 'Also kept', 'an accepted Blank keeps the draft')
  rt = mountPanel(panelSource, lib, base(s6, { disabled: true, onInsertBlank: () => { throw new Error('must not run') } }))
  await rt.click('asv2-blank')

  // storage that throws, or none, never breaks the pop-up
  const thrower = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') }, removeItem() { throw new Error('blocked') } }
  rt = mountPanel(panelSource, lib, base(thrower))
  check(assert.equal, rt.text(), '')
  rt.pick('chart'); rt.type('Works without storage')
  check(assert.equal, rt.text(), 'Works without storage')
  rt.byClass('asv2-discard').props.onClick(); rt.render()
  check(assert.equal, rt.text(), '')
  rt = mountPanel(panelSource, lib, base(null))
  rt.type('No storage at all'); check(assert.equal, rt.text(), 'No storage at all')
  // the default is the browser's sessionStorage, and even reading that property is guarded
  const sessionStore = mem()
  globalThis.window = { sessionStorage: sessionStore }
  try {
    const { storage: _omit, ...noStorage } = base(null)
    rt = mountPanel(panelSource, lib, noStorage)
    rt.pick('chart'); rt.type('In session storage')
    check(assert.equal, draftIn(sessionStore).text, 'In session storage', 'default storage = window.sessionStorage')
    globalThis.window = { get sessionStorage() { throw new Error('SecurityError') } }
    rt = mountPanel(panelSource, lib, noStorage)
    rt.type('Blocked site data'); check(assert.equal, rt.text(), 'Blocked site data', 'a blocked sessionStorage property is guarded')
  } finally { delete globalThis.window }
}

// ---- 1. the lib is import-free, the flag is exact ---------------------------------------------------------------
check(assert.equal, /^\s*import\s/m.test(LIB), false, 'the lib must stay import-free')
check(assert.match, LIB, /process\.env\.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true'/, 'literal env access so Next inlines it')
for (const [value, expected] of [['true', true], ['false', false], ['TRUE', false], ['1', false], ['', false], [' true', false], [undefined, false]]) {
  const env = value === undefined ? {} : { [FLAG]: value }
  check(assert.equal, load(LIB, { env }).ADD_SLIDE_V2_ENABLED, expected, `flag ${JSON.stringify(value)}`)
}

// ---- 2. behaviour on the real sources ----------------------------------------------------------------------------
const realLib = load(LIB)
libSuite(realLib)
markupSuite(PANEL, realLib)
check(assert.equal, /^\s*import\s/m.test(SUBMIT), true, 'the submit module imports the page helpers it reuses')
await submitSuite(submitModule(SUBMIT, realLib), realLib)
await panelInteractionSuite(PANEL, realLib)

// ---- 3. flag-gated hooks (flag off must leave the existing Add Slide UI untouched) --------------------------------
check(assert.match, PICKER, /if \(ADD_SLIDE_V2_ENABLED && addSlideV2\) \{\s*return <AddSlideV2Entry[^\n]*onInsertBlank=\{async position => \{/,
  'the picker routes Blank slide through the existing native Add')
check(assert.ok, PICKER.indexOf('if (ADD_SLIDE_V2_ENABLED && addSlideV2)') < PICKER.indexOf('if (STUDIO_SHELL) {'), 'V2 branch precedes the two existing branches')
check(assert.match, PICKER, /Insert \$\{layout\.label\} slide/, 'existing Insert-slide cards still present')
check(assert.match, PICKER, /Hero Slides[\s\S]*Content Slides[\s\S]*Visual \+ Text[\s\S]*Image Split/, 'legacy layout picker still present')
check(assert.match, VIEWER, /addSlideV2=\{ADD_SLIDE_V2_ENABLED && addSlideV2Settings \? \{ settings: addSlideV2Settings, currentSlide, slideCount: totalSlides, theme: buildThemeSelection \} : undefined\}/,
  'the viewer passes nothing unless the flag is on and the page supplied settings')
check(assert.match, AREA, /addSlideV2Settings=\{addSlideV2Settings\}/, 'the area only forwards')
check(assert.match, PAGE, /addSlideV2Settings=\{process\.env\.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true' \? \{/, 'the page builds settings only with the flag on')
check(assert.match, PAGE, /\.\.\.createAddSlideV2Hooks\(\{/, 'one factory call supplies submit and the Blank target resolver')
check(assert.match, PAGE, /generationEnabled: features\.slideComposerEnabled && features\.slideComposerAsyncEnabled,/, 'submit only with the composer and its async mode on')
check(assert.match, PAGE, /presentationId: effectivePresentationId,\s*fetchImpl:/)
check(assert.match, PAGE, /captureSessionOwner: captureStudioSlideComposeSessionOwner,/)
check(assert.match, PAGE, /isSessionAdmitted: sessionId => !studioShell \|\| sessionId === questionSubmissionScopeRef\.current\.sessionId,/)
check(assert.match, PAGE, /visualIndex: currentSlideIndexRef\.current,\s*realSlideCount: effectiveSlideCount \?\? 0,/)
check(assert.match, PAGE, /onAccepted: handleSlideComposerAccepted,/, 'registration goes through the existing page queue')
check(assert.match, PAGE, /import \{ createAddSlideV2Hooks \} from '@\/lib\/studio-add-slide-v2-submit'/)
check(assert.equal, /studio-add-slide-v2-submit/.test(PICKER + VIEWER + AREA + PANEL), false, 'the submit module is only reachable from the page')
check(assert.match, PANEL, /settings\.resolveBlankTarget\?\.\(Math\.max\(0, currentSlide - 1\)\) \?\? \{ ok: true as const, position: undefined \}/, 'the Blank target is resolved against the slide the pop-up shows')
check(assert.match, PANEL, /if \(!target\.ok\) return \{ ok: false as const, message: target\.message \}\s*setOpen\(false\)\s*await onInsertBlank\(target\.position\)/, 'a refused Blank keeps the pop-up open; an accepted one closes it first')
check(assert.match, PANEL, /<AddSlideV2Panel\s+key=\{addSlideV2DraftKey\(context\.sessionId, context\.presentationId\)\}/, 'the pop-up remounts per session and deck, so each loads its own draft')
check(assert.match, LIB, /\/\/ TEMP default \(awaiting ELEMENT-3 full-image key\)\n(\s*\/\/[^\n]*\n)?\s*image: \{ canvas_type: 'I1', content_type: 'text_heavy_columns' \}/, 'the Image default is marked TEMP')
check(assert.match, VIEWER, /async \(layoutId: SlideLayoutType, options\?: \{ position\?: number \}\) =>/, 'the viewer Add takes an optional position')
check(assert.match, VIEWER, /position: options\?\.position \?\? currentSlide,/, 'flag off / no options: the old position')
check(assert.match, PICKER, /position === undefined \? onAddSlide\('B1-blank'\) : onAddSlide\('B1-blank', \{ position \}\)/, 'only the pop-up passes a position')
check(assert.equal, (PICKER.match(/onAddSlide\(layoutId\)/g) ?? []).length, 1, 'the old handleSelectLayout call is untouched')
const withoutComments = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
check(assert.equal, /fetch\(|\/api\/|XMLHttpRequest|sendBeacon|WebSocket/.test(withoutComments(PANEL) + withoutComments(LIB)), false, 'the scaffold makes no backend call')

// ---- 4. mutation check: every mutant must be caught ---------------------------------------------------------------
const libMutants = [
  ['default slide type is title', "return { slideType: 'content', contentSubtype: 'auto', text: '' }", "return { slideType: 'title', contentSubtype: 'auto', text: '' }"],
  ['default sub-type is chart', "return { slideType: 'content', contentSubtype: 'auto', text: '' }", "return { slideType: 'content', contentSubtype: 'chart', text: '' }"],
  ['section type dropped', "{ value: 'section', label: 'Section', hint: 'Chapter break' },\n", ''],
  ['placeholder mode added', "{ value: 'content', label: 'Content', hint: 'Text, charts, images' },", "{ value: 'content', label: 'Content', hint: 'Text, charts, images' },\n  { value: 'placeholder', label: 'Placeholder slide', hint: 'Empty layout' },"],
  ['image-right sub-type dropped', "  { value: 'image_right', label: 'Image right', hint: 'Image on the right, text on the left' },\n", ''],
  ['sub-type leaks into non-content slides', "return draft.slideType === 'content' ? draft.contentSubtype : null", 'return draft.contentSubtype'],
  ['type change clears the text', "? { ...draft, slideType: action.value }", "? { ...draft, slideType: action.value, text: '' }"],
  ['unknown type accepted', "return ADD_SLIDE_V2_SLIDE_TYPES.some(option => option.value === action.value)\n        ? { ...draft, slideType: action.value }\n        : draft", 'return { ...draft, slideType: action.value }'],
  ['instruction not trimmed', 'const instruction = draft.text.trim()\n  if (!instruction', 'const instruction = draft.text\n  if (!draft.text.trim()'],
  ['off-by-one insert index', 'Math.max(0, context.currentSlide - 1)', 'Math.max(0, context.currentSlide)'],
  ['index ignores a missing deck', 'context.presentationId ? Math.max(0, context.currentSlide - 1) : null', 'Math.max(0, context.currentSlide - 1)'],
  ['empty text is allowed', "if (!draft.text.trim()) return 'empty-text'", ''],
  ['missing session is allowed', "if (!context.sessionId) return 'no-session'", ''],
  ['missing submit is allowed', "if (!hasSubmit) return 'no-submit'", ''],
  ['research overridden', 'research: { ...context.research },', 'research: { ...context.research, useWebSearch: false },'],
  ['theme dropped', '    theme: context.theme,\n  }\n}', '    theme: undefined as never,\n  }\n}'],
  ['backend field leaks onto the request', "    mode: 'generate',\n    slideType", "    mode: 'generate',\n    endpoint: '/api/slides/compose',\n    slideType"],
  ['auto theme label changed', "'Auto — matches deck'", "'Auto'"],
  ['placement note drifts', 'is added right after slide', 'is added at the end after slide'],
  ['image left maps to I2', "image_left: { canvas_type: 'I1'", "image_left: { canvas_type: 'I2'"],
  ['image right maps to I1', "image_right: { canvas_type: 'I2'", "image_right: { canvas_type: 'I1'"],
  ['auto sends a canvas', '  auto: {},', "  auto: { canvas_type: 'C1' },"],
  ['image maps to I2', "image: { canvas_type: 'I1'", "image: { canvas_type: 'I2'"],
  ['image maps to nothing', "  image: { canvas_type: 'I1', content_type: 'text_heavy_columns' },\n  image_left", '  image: {},\n  image_left'],
  ['empty selections key sent', 'if (Object.keys(selections).length > 0) body.selections = selections', 'body.selections = selections'],
  ['chart subtype dropped', ", chart_subtype: 'single' }", ' }'],
  ['infographic subtype dropped', ", infographic_subtype: 'vertical_center' }", ' }'],
  ['closing maps to H2', "closing: { canvas_type: 'H3'", "closing: { canvas_type: 'H2'"],
  ['text maps to chart content', "text: { canvas_type: 'C1', content_type: 'text_heavy_columns' },", "text: { canvas_type: 'C1', content_type: 'chart' },"],
  ['table object is shared', "return { ...CONTENT_SELECTIONS[subtype ?? 'auto'] }", "return CONTENT_SELECTIONS[subtype ?? 'auto']"],
  ['text draft stored under a wrong field', "text: draft.text }))", "text: draft.slideType }))"],
  ['body uses the visual index as the anchor', 'insert_after_index: insertAfterIndex,', 'insert_after_index: request.anchorVisualIndex,'],
  ['web search cap changed', 'ADD_SLIDE_V2_WEB_SEARCH_MAX_QUERIES = 3', 'ADD_SLIDE_V2_WEB_SEARCH_MAX_QUERIES = 5'],
  ['theme dropped from the body', '    instruction: request.instruction,\n    theme: request.theme,\n    research: {', '    instruction: request.instruction,\n    research: {'],
  ['research flag swapped on the wire', 'use_web_search: request.research.useWebSearch,', 'use_web_search: request.research.useDeepResearch,'],
  ['draft key ignores the deck', "${presentationId ?? 'no-deck'}", 'x'],
  ['draft key ignores the session', "${sessionId ?? 'no-session'}", 'x'],
  ['pristine draft is stored', 'if (isPristineAddSlideV2Draft(draft)) storage.removeItem(key)\n    else storage.setItem', 'storage.setItem'],
  ['stored draft not validated', "if (typeof text !== 'string'\n      || !ADD_SLIDE_V2_SLIDE_TYPES.some(option => option.value === slideType)\n      || !ADD_SLIDE_V2_CONTENT_SUBTYPES.some(option => option.value === contentSubtype)) return initialAddSlideV2Draft()", ''],
  ['stored draft ignored', 'const raw = storage?.getItem(key)\n    if (!raw) return initialAddSlideV2Draft()', 'const raw = null as string | null\n    if (!raw) return initialAddSlideV2Draft()'],
  ['load not guarded', '} catch {\n    return initialAddSlideV2Draft()\n  }', '} catch (error) {\n    throw error\n  }'],
  ['save not guarded', '} catch { /* storage unavailable or full: the draft just is not kept */ }', '} catch (error) { throw error }'],
  ['clear not guarded', '} catch { /* nothing to clear */ }', '} catch (error) { throw error }'],
  ['clear does nothing', 'storage?.removeItem(key)\n  } catch', 'void storage\n  } catch'],
  ['hero types exempt from the text rule', "if (!draft.text.trim()) return 'empty-text'", "if (draft.slideType === 'content' && !draft.text.trim()) return 'empty-text'"],
  ['flag accepts any truthy value', "process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED"],
]
const panelMutants = [
  ['Generate no longer gated', 'disabled={busy || Boolean(blocker)}', 'disabled={busy}'],
  ['second free-text box', '<p id={hintId} className="asv2-hint">', '<textarea className="asv2-extra" /><p id={hintId} className="asv2-hint">'],
  ['research becomes editable', '<li key={row.key} data-on={row.on ? \'true\' : \'false\'}>', '<li key={row.key} data-on={row.on ? \'true\' : \'false\'}><input type="checkbox" />'],
  ['blank not offered', '{ADD_SLIDE_V2_BLANK_LABEL}', ''],
  ['placement note missing', '<p>{addSlideV2PlacementNote(context.currentSlide)}</p>', ''],
  ['sub-types shown for every type', "{draft.slideType === 'content' && (", '{true && ('],
  ['blank ignores the picker disabled state', 'className="asv2-blank" disabled={busy}', 'className="asv2-blank"'],
  ['draft not restored', '() => initialDraft ?? loadAddSlideV2Draft(storage, draftKey)', '() => initialDraft ?? initialAddSlideV2Draft()'],
  ['draft not kept as you type', 'useEffect(() => { saveAddSlideV2Draft(storage, draftKey, draft) }, [storage, draftKey, draft])', 'useEffect(() => {}, [storage, draftKey, draft])'],
  ['a successful Generate keeps the draft', "dispatch({ type: 'reset' })\n        clearAddSlideV2Draft(storage, draftKey)\n        onClose()", 'onClose()'],
  ['a failed Generate clears the draft', 'setError(result.message)', 'setError(result.message); clearAddSlideV2Draft(storage, draftKey)'],
  ['Discard keeps the stored draft', "dispatch({ type: 'reset' })\n    clearAddSlideV2Draft(storage, draftKey)\n    setError(null)", "dispatch({ type: 'reset' })\n    setError(null)"],
  ['Discard shown on a pristine draft', '{dirty && <button', '{!dirty && <button'],
  ['Discard never shown', '{dirty && <button', '{false && <button'],
  ['a refused Blank is silent', 'if (outcome && outcome.ok === false) setError(outcome.message)', ''],
  ['Blank clears the draft', 'const outcome = await onInsertBlank()', 'const outcome = await onInsertBlank(); clearAddSlideV2Draft(storage, draftKey)'],
  ['Blank ignores the busy state', 'async function insertBlank() {\n    if (busy) return', 'async function insertBlank() {'],
  ['sessionStorage property unguarded', '} catch {\n    return null\n  }\n}', '} catch (error) {\n    throw error\n  }\n}'],
  ['layout picker mode creeps in', '<footer className="asv2-footer">', '<footer className="asv2-footer"><button type="button">Choose a layout</button>'],
]
const submitMutants = [
  ['session fence ignored', 'const isCurrentSession = deps.captureSessionOwner()', 'const isCurrentSession = () => true; deps.captureSessionOwner()'],
  ['owner captured after the await', [['const isCurrentSession = deps.captureSessionOwner()', 'let isCurrentSession = () => true'], ['const data: unknown = await response.json().catch(() => null)\n', 'const data: unknown = await response.json().catch(() => null)\n  isCurrentSession = deps.captureSessionOwner()\n']]],
  ['visual index used as the anchor', 'const anchor = resolveAddSlideV2Anchor({', 'const anchor = { ok: true as const, insertAfterIndex: request.anchorVisualIndex }\n  void ({'],
  ['selected placeholder allowed through', "if (resolved?.kind === 'compose') {", 'if (false) {'],
  ['popup/page selection mismatch ignored', 'if (request.presentationId && selection.visualIndex !== request.anchorVisualIndex) {', 'if (false) {'],
  ['needs_input treated as an error shape', 'if (isNeedsInputResponse(data)) {', 'if (false) {'],
  ['minted job id not checked', 'data.job_id !== jobId || ', 'false || '],
  ['reply session not checked', 'data.session_id !== body.session_id', 'false'],
  ['reply deck not checked', 'data.presentation_id !== body.presentation_id', 'false'],
  ['admission ignored', 'if (!deps.isSessionAdmitted(body.session_id)) {', 'if (false) {'],
  ['HTTP error ignored', 'if (!response.ok) return FAIL(responseErrorMessage(data))', ''],
  ['popup request registered instead of the wire body', 'request: asyncRequest,', 'request: request as never,'],
  ['accepted job never registered', 'deps.onAccepted({', 'void ({'],
  ['sync assumption sent', 'withAsyncSlideComposeFields(body as unknown as Record<string, unknown>, jobId)', '({ ...body, job_id: jobId, assume_on_missing: false } as never)'],
  ['kind not defaulted', "kind: data.kind ?? 'compose',", 'kind: data.kind,'],
  ['title not truncated', 'body.instruction.slice(0, 72)', 'body.instruction'],
  ['Blank resolves even without placeholders', 'if (!input.presentationId || !placeholders) return', 'if (!input.presentationId) return'],
  ['Blank position off by one', '(anchor.insertAfterIndex ?? -1) + 1', '(anchor.insertAfterIndex ?? -1) + 0'],
  ['Blank uses the visual index', 'position: (anchor.insertAfterIndex ?? -1) + 1', 'position: input.visualIndex + 1'],
  ['Blank selection mismatch ignored', 'if (input.visualIndex !== input.expectedVisualIndex) {', 'if (false) {'],
  ['Blank allowed on a placeholder', 'if (!anchor.ok) return { ok: false, message: anchor.message }', "if (!anchor.ok) return { ok: true, position: undefined }"],
  ['a refine overlay counts as a placeholder', "job.kind !== 'refine' && (job.status === 'building'", "(job.status === 'building'"],
  ['submit offered without generation enabled', 'submit: deps.generationEnabled ? request => submitAddSlideV2(request, deps) : undefined,', 'submit: request => submitAddSlideV2(request, deps),'],
  ['Blank resolver dropped from the factory', 'resolveBlankTarget: expectedVisualIndex => resolveAddSlideV2BlankTarget({', 'resolveBlankTarget: expectedVisualIndex => (() => ({ ok: true as const, position: undefined }))({'],
  ['lost reply retried', "} catch {\n    // No reply: the job may exist.", "} catch {\n    if (!deps.fetchImpl) return FAIL('')\n    await deps.fetchImpl(ADD_SLIDE_V2_COMPOSE_ENDPOINT, { method: 'POST', headers: {}, body: '{}' })\n    // No reply: the job may exist."],
  ['unmapped body still sent', 'if (!body) return FAIL("This slide can\'t be generated yet.")', ''],
]
let caught = 0
function mutate(source, [name, from, to], label) {
  const pairs = Array.isArray(from) ? from : [[from, to]]
  let out = source
  for (const [a, b] of pairs) {
    assert.ok(out.includes(a), `mutant "${name}" no longer matches the ${label} source`)
    out = out.replace(a, b)
  }
  return out
}
for (const mutant of libMutants) {
  const broken = mutate(LIB, mutant, 'lib')
  let lib
  try { lib = load(broken) } catch { caught++; continue }
  const seen = checks
  assert.throws(() => { libSuite(lib); if (mutant[0].startsWith('flag')) assert.equal(load(broken, { env: { [FLAG]: 'false' } }).ADD_SLIDE_V2_ENABLED, false) }, undefined, `lib mutant survived: ${mutant[0]}`)
  checks = seen
  caught++
}
for (const mutant of panelMutants) {
  const broken = mutate(PANEL, mutant, 'component')
  const seen = checks
  let survived = false
  try { markupSuite(broken, realLib); await panelInteractionSuite(broken, realLib); survived = true } catch { /* caught */ }
  assert.equal(survived, false, `component mutant survived: ${mutant[0]}`)
  checks = seen
  caught++
}
for (const mutant of submitMutants) {
  const broken = mutate(SUBMIT, mutant, 'submit')
  const seen = checks
  let survived = false
  try { await submitSuite(submitModule(broken, realLib), realLib); survived = true } catch { /* caught */ }
  assert.equal(survived, false, `submit mutant survived: ${mutant[0]}`)
  checks = seen
  caught++
}
check(assert.equal, caught, libMutants.length + panelMutants.length + submitMutants.length)

console.log(`studio-add-slide-v2: ${checks} checks passed, ${caught} mutants caught (${libMutants.length} lib, ${panelMutants.length} component, ${submitMutants.length} submit)`)
