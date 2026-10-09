// J2 v2: generate-first "Add slide" SIDE PANEL (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED, default off).
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
const DISABLED_ENV = 'NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_DISABLED_OPTIONS'
const ENABLED_ENV = 'NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED_OPTIONS'
// Every option on (the default hides the stage-2 ones; ENABLED=all shows them), so the suites can reach every style.
const ALL_ENV = { [ENABLED_ENV]: 'all' }
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
const REGEN = read('../lib/studio-add-slide-v2-regenerate.ts')
const REGEN_LIB = load(REGEN)
const ENVEX = read('../.env.example')
const PICKER = read('../components/slide-layout-picker.tsx')
const VIEWER = read('../components/presentation-viewer.tsx')
const AREA = read('../components/builder/presentation-area.tsx')
const PAGE = read('../app/builder/page.tsx')
const ASYNC = read('../lib/slide-compose-async.ts')
const SLIDE_PANEL = read('../components/slide-generation-panel/index.tsx')
const REFINE_ROUTE = read('../app/api/slides/refine/route.ts')
const REGEN_FLAG = 'NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED'

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
    ['auto', 'text', 'image_left', 'image_right', 'chart', 'infographic', 'table', 'diagram'], 'P11 styles, in PK order, Auto first; plain Image is gone')
  check(assert.equal, lib.ADD_SLIDE_V2_CONTENT_SUBTYPES.some(o => o.value === 'image' || /^image$/i.test(o.label)), false, 'no plain Image option')
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
  check(assert.equal, lib.reduceAddSlideV2Draft(draft, { type: 'set_content_subtype', value: 'image' }), draft, 'the removed Image sub-type is refused')
  check(assert.deepEqual, lib.reduceAddSlideV2Draft(draft, { type: 'reset' }), initial, 'reset returns to the defaults')
  const frozen = Object.freeze({ ...initial })
  check(assert.notEqual, lib.reduceAddSlideV2Draft(frozen, { type: 'set_text', value: 'x' }), frozen, 'the reducer never mutates')
  check(assert.equal, frozen.text, '')

  // blockers
  const ready = { ...initial, contentSubtype: 'chart', text: 'Why now' }
  check(assert.equal, lib.addSlideV2Blocker(initial, { sessionId: 's' }, true), 'empty-text', 'content + Auto is allowed; only the text is missing')
  check(assert.equal, lib.addSlideV2Blocker({ ...initial, text: 'Say it' }, { sessionId: 's' }, true), null, 'ruling 1a: Generate is enabled for content + Auto')
  check(assert.equal, lib.addSlideV2Blocker({ ...ready, contentSubtype: 'image' }, { sessionId: 's' }, true), 'no-options', 'the removed Image style is never generatable')
  for (const style of ['table', 'diagram', 'text', 'image_left', 'image_right', 'infographic']) {
    check(assert.equal, lib.addSlideV2Blocker({ ...ready, contentSubtype: style }, { sessionId: 's' }, true), null, `${style} generates`)
  }
  check(assert.equal, lib.addSlideV2Blocker({ ...initial, slideType: 'title' }, { sessionId: 's' }, true), 'empty-text', 'a hero type ignores the dormant Auto sub-type')
  check(assert.equal, lib.addSlideV2Blocker({ ...ready, text: '' }, { sessionId: 's' }, true), 'empty-text')
  check(assert.equal, lib.addSlideV2Blocker({ ...ready, text: '   \n ' }, { sessionId: 's' }, true), 'empty-text', 'whitespace is empty')
  // (e) text is required for every type, hero types included; DEC-P2: hero types need 2 words, Content keeps "not empty"
  check(assert.equal, lib.ADD_SLIDE_V2_HERO_MIN_WORDS, 2)
  for (const slideType of ['title', 'section', 'closing']) {
    check(assert.equal, lib.addSlideV2Blocker({ ...ready, slideType, text: ' ' }, { sessionId: 's' }, true), 'empty-text', `${slideType} needs text`)
    check(assert.equal, lib.addSlideV2Blocker({ ...ready, slideType, text: 'Agenda' }, { sessionId: 's' }, true), 'too-short', `${slideType}: one word is too short`)
    check(assert.equal, lib.addSlideV2Blocker({ ...ready, slideType, text: '  Agenda!  ' }, { sessionId: 's' }, true), 'too-short', `${slideType}: padding and punctuation are not words`)
    check(assert.equal, lib.addSlideV2Blocker({ ...ready, slideType, text: '— … ,' }, { sessionId: 's' }, true), 'too-short', `${slideType}: symbols are not words`)
    check(assert.equal, lib.addSlideV2Blocker({ ...ready, slideType, text: 'Q3 review' }, { sessionId: 's' }, true), null, `${slideType}: two words are enough`)
    check(assert.equal, lib.addSlideV2Blocker({ ...ready, slideType }, { sessionId: 's' }, true), null)
    check(assert.equal, lib.buildAddSlideV2Request({ ...ready, slideType, text: ' ' }, context()), null, `${slideType} without text builds nothing`)
    check(assert.equal, lib.buildAddSlideV2Request({ ...ready, slideType, text: 'Agenda' }, context()), null, `${slideType} with one word builds nothing`)
    check(assert.equal, lib.buildAddSlideV2Request({ ...ready, slideType, text: 'Q3 review' }, context()).slideType, slideType)
  }
  for (const style of ['auto', 'text', 'chart', 'table', 'diagram']) {
    check(assert.equal, lib.addSlideV2Blocker({ ...ready, contentSubtype: style, text: 'Agenda' }, { sessionId: 's' }, true), null, `Content / ${style} keeps its "not empty" rule: one word is fine`)
  }
  check(assert.equal, lib.countAddSlideV2Words(''), 0)
  check(assert.equal, lib.countAddSlideV2Words('  one   two\nthree\t'), 3)
  check(assert.equal, lib.countAddSlideV2Words('well-known fact'), 2, 'a hyphenated word is one word')
  check(assert.equal, lib.countAddSlideV2Words('市场分析'), 2, 'spaceless scripts: one word per two characters')
  check(assert.equal, lib.countAddSlideV2Words('标题'), 1)
  check(assert.equal, lib.countAddSlideV2Words('Q3 市场'), 2)
  check(assert.equal, lib.countAddSlideV2Words('ありがとうございます'), 5)
  check(assert.equal, lib.countAddSlideV2Words('2026 plan'), 2, 'digits count')
  check(assert.equal, lib.countAddSlideV2Words('a - b'), 2, 'a lone dash is not a word')
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
  check(assert.equal, lib.buildAddSlideV2Request({ ...ready, contentSubtype: 'image' }, context()), null, 'the removed Image style builds nothing')
  for (const style of ['table', 'diagram']) check(assert.equal, lib.buildAddSlideV2Request({ ...ready, contentSubtype: style }, context()).contentSubtype, style, `${style} builds a request`)

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
  check(assert.deepEqual, sel('content', 'table'), { canvas_type: 'C1', content_type: 'table', text_subtype: 'table' }, 'Table = the Slide panel mapping (J2-MAP: content_type table, text_subtype table)')
  check(assert.deepEqual, sel('content', 'diagram'), { canvas_type: 'C1', content_type: 'diagram_idea_board', diagram_subtype: 'idea_board' }, 'Diagram = the Slide panel default Diagram preset')
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
  // Table and Diagram: the Slide panel's own selections; an explicit Diagram forces all research off (J2-MAP + panel)
  const allResearch = research({ useUploadedDocuments: true, useWebSearch: true, useDeepResearch: true, useKnowledgeGraph: true })
  const tableBody = lib.buildAddSlideV2ComposeBody(lib.buildAddSlideV2Request({ ...initial, contentSubtype: 'table', text: 'Pricing tiers' }, { ...exampleContext, research: allResearch }), 2)
  check(assert.deepEqual, { ...tableBody, assume_on_missing: false }, {
    ...EXAMPLE_ENVELOPE, instruction: 'Pricing tiers', selections: { canvas_type: 'C1', content_type: 'table', text_subtype: 'table' },
    research: { use_uploaded_documents: true, use_web_search: true, use_deep_research: true, use_knowledge_graph: true, web_search_max_queries: 3 },
  }, 'Table body: panel selections, chat research kept')
  const diagramBody = lib.buildAddSlideV2ComposeBody(lib.buildAddSlideV2Request({ ...initial, contentSubtype: 'diagram', text: 'Release flow' }, { ...exampleContext, research: allResearch }), 2)
  check(assert.deepEqual, { ...diagramBody, assume_on_missing: false }, {
    ...EXAMPLE_ENVELOPE, instruction: 'Release flow', selections: { canvas_type: 'C1', content_type: 'diagram_idea_board', diagram_subtype: 'idea_board' },
    research: { use_uploaded_documents: false, use_web_search: false, use_deep_research: false, use_knowledge_graph: false, web_search_max_queries: 3 },
  }, 'Diagram body: panel selections, all research off like the Slide panel')
  const heroResearch = lib.buildAddSlideV2ComposeBody(lib.buildAddSlideV2Request({ ...initial, slideType: 'closing', contentSubtype: 'diagram', text: 'Thank you' }, { ...exampleContext, research: allResearch }), 2)
  check(assert.equal, heroResearch.research.use_web_search, true, 'a dormant Diagram style on a hero slide does not switch research off')
  const heroReq = lib.buildAddSlideV2Request({ ...initial, slideType: 'closing', text: 'Thank you' }, { ...exampleContext, research: allResearch })
  check(assert.equal, lib.buildAddSlideV2ComposeBody({ ...heroReq, contentSubtype: 'diagram' }, 2).research.use_web_search, true, 'even a request that carries a Diagram style on a hero slide keeps the chat research')
  check(assert.equal, lib.buildAddSlideV2ComposeBody({ ...heroReq, slideType: 'content', contentSubtype: 'table' }, 2).research.use_web_search, true, 'Table keeps the chat research')
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
  for (const raw of ['not json', '[]', 'null', '"x"', '{"slideType":"title","contentSubtype":"auto","text":5}', '{"slideType":"title","contentSubtype":"auto"}']) {
    store.map.set(keyA, raw)
    check(assert.deepEqual, lib.loadAddSlideV2Draft(store, keyA), initial, `a corrupt stored draft falls back to the defaults: ${raw}`)
  }
  // a stored CHOICE that is not on offer falls back to the default choice; the text the user wrote is kept
  store.map.set(keyA, '{"slideType":"placeholder","contentSubtype":"image","text":"Kept words"}')
  check(assert.deepEqual, lib.loadAddSlideV2Draft(store, keyA), { ...initial, text: 'Kept words' }, 'unknown choices reset, the text stays')
  store.map.set(keyA, '{"slideType":"title","contentSubtype":"diagram","text":"x y"}')
  check(assert.deepEqual, lib.loadAddSlideV2Draft(store, keyA), { slideType: 'title', contentSubtype: 'diagram', text: 'x y' }, 'a valid stored choice is restored')
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

  // ---- the option table and its kill switches (per-option env list + code config) ----
  const ids = lib.ADD_SLIDE_V2_OPTION_CONFIG.map(o => o.id)
  check(assert.deepEqual, ids, ['title', 'section', 'closing', 'content', 'auto', 'text', 'image_left', 'image_right', 'chart', 'infographic', 'table', 'diagram', 'blank', 'catalog', 'blank_theme', 'regenerate'], 'the whole option table, ids are the env vocabulary')
  check(assert.equal, new Set(ids).size, ids.length, 'ids are unique across groups')
  check(assert.deepEqual, [...lib.ADD_SLIDE_V2_STAGE2_IDS], ['chart', 'infographic', 'table', 'diagram'], 'DEC-P8: stage 2 = Chart, Infographic, Table, Diagram')
  const resolve = (disabled, enabled) => [...lib.resolveAddSlideV2Options(disabled, enabled)]
  const STAGE1 = ['title', 'section', 'closing', 'content', 'auto', 'text', 'image_left', 'image_right', 'blank', 'catalog', 'blank_theme']
  const STAGE2 = ['chart', 'infographic', 'table', 'diagram']
  const inOrder = list => [...list].sort((a, b) => ids.indexOf(a) - ids.indexOf(b))
  check(assert.deepEqual, resolve(undefined), STAGE1, 'DEC-P8: unset = stage 1 on, stage 2 hidden, the regenerate scaffold off')
  check(assert.deepEqual, resolve(null, null), STAGE1, 'null counts as unset')
  check(assert.deepEqual, resolve(''), STAGE1, 'a blank value counts as unset')
  check(assert.deepEqual, resolve('   ', '  '), STAGE1, 'whitespace only counts as blank')
  check(assert.deepEqual, resolve('  , ,'), STAGE1, 'a list of only separators is an empty list')
  // ADDITIVE: DISABLED only ever hides more
  check(assert.deepEqual, resolve('image_left'), STAGE1.filter(id => id !== 'image_left'), 'DISABLED=image_left hides image_left and STAGE 2 STAYS HIDDEN')
  for (const id of STAGE2) check(assert.equal, resolve('image_left').includes(id), false, `DISABLED=image_left does not un-hide ${id}`)
  check(assert.deepEqual, resolve('table,diagram'), STAGE1, 'DISABLED=table,diagram changes nothing by default (they are already hidden)')
  check(assert.deepEqual, resolve('none'), STAGE1, '"none" is not special any more: an unknown id, ignored')
  check(assert.deepEqual, resolve('bogus,table'), STAGE1, 'unknown ids are ignored')
  check(assert.equal, resolve(' Title , SECTION ,, ').includes('title') || resolve(' Title , SECTION ,, ').includes('section'), false, 'ids are trimmed and lower-cased, empty entries ignored')
  // ENABLED removes ids from the default-hidden set
  check(assert.deepEqual, resolve(undefined, 'chart'), inOrder([...STAGE1, 'chart']), 'ENABLED=chart shows chart ONLY')
  check(assert.deepEqual, resolve(undefined, ' Chart , TABLE ,, '), inOrder([...STAGE1, 'chart', 'table']), 'ENABLED ids are trimmed and lower-cased')
  check(assert.deepEqual, resolve(undefined, 'all'), inOrder([...STAGE1, ...STAGE2]), 'ENABLED=all shows every stage-2 id')
  check(assert.deepEqual, resolve(undefined, 'ALL'), inOrder([...STAGE1, ...STAGE2]), 'all is case-insensitive')
  check(assert.deepEqual, resolve(undefined, 'title'), STAGE1, 'ENABLED naming a stage-1 id changes nothing')
  check(assert.deepEqual, resolve('bogus', 'bogus'), STAGE1, 'unknown ids in both lists change nothing')
  check(assert.deepEqual, resolve('image_left', 'chart'), inOrder([...STAGE1.filter(id => id !== 'image_left'), 'chart']), 'both lists apply together')
  // DISABLED wins
  check(assert.equal, resolve('chart', 'chart').includes('chart'), false, 'an id in both ENABLED and DISABLED stays hidden')
  check(assert.equal, resolve('title', 'title').includes('title'), false, 'DISABLED wins for a stage-1 id too')
  check(assert.deepEqual, resolve('table', 'all'), inOrder([...STAGE1, 'chart', 'infographic', 'diagram']), 'ENABLED=all with DISABLED=table: all stage 2 but table')
  // the opt-in scaffold
  check(assert.equal, resolve(undefined, 'all').includes('regenerate'), false, 'all does not include the opt-in scaffold')
  check(assert.equal, resolve(undefined, 'regenerate').includes('regenerate'), true, 'naming the scaffold turns it on')
  check(assert.equal, resolve('regenerate', 'regenerate').includes('regenerate'), false, 'DISABLED wins over ENABLED for the scaffold')
  check(assert.equal, resolve('regenerate').includes('regenerate'), false, 'regenerate is off unless ENABLED names it')
  check(assert.equal, resolve(undefined, 'regenerate').includes('chart'), false, 'ENABLED=regenerate does not show stage 2')
  for (const id of ids.filter(i => i !== 'regenerate')) {
    check(assert.equal, resolve(undefined, 'all').includes(id), true, `${id} is on in the full set`)
    check(assert.equal, resolve(id, 'all').includes(id), false, `DISABLED=${id} hides ${id} even with ENABLED=all`)
    check(assert.equal, resolve(id).includes(id), false, `DISABLED=${id} hides ${id}`)
    check(assert.equal, resolve(`${id},${id === 'blank' ? 'catalog' : 'blank'}`, 'all').includes(id), false, `${id} hidden inside a list`)
  }
  const allOn = lib.resolveAddSlideV2Options(undefined, 'all')
  const labels = os => os.map(o => o.value)
  check(assert.deepEqual, labels(lib.availableAddSlideV2Types(allOn)), ['title', 'section', 'closing', 'content'])
  check(assert.deepEqual, labels(lib.availableAddSlideV2Subtypes(allOn)), ['auto', 'text', 'image_left', 'image_right', 'chart', 'infographic', 'table', 'diagram'])
  check(assert.deepEqual, labels(lib.availableAddSlideV2Subtypes(lib.resolveAddSlideV2Options(undefined))), ['auto', 'text', 'image_left', 'image_right'], 'stage 1 styles by default')
  for (const id of ['title', 'section', 'closing']) check(assert.equal, labels(lib.availableAddSlideV2Types(lib.resolveAddSlideV2Options(id))).includes(id), false, `${id} hidden from the types`)
  for (const id of ['auto', 'text', 'image_left', 'image_right', 'chart', 'infographic', 'table', 'diagram']) {
    check(assert.equal, labels(lib.availableAddSlideV2Subtypes(lib.resolveAddSlideV2Options(id))).includes(id), false, `${id} hidden from the styles`)
  }
  const noStyles = lib.resolveAddSlideV2Options('auto,text,image_left,image_right,chart,infographic,table,diagram')
  check(assert.equal, labels(lib.availableAddSlideV2Types(noStyles)).includes('content'), false, 'Content needs at least one style')
  check(assert.deepEqual, labels(lib.availableAddSlideV2Types(noStyles)), ['title', 'section', 'closing'])
  const contentOff = lib.resolveAddSlideV2Options('content')
  check(assert.deepEqual, lib.initialAddSlideV2Draft(contentOff), { slideType: 'title', contentSubtype: 'auto', text: '' }, 'with Content off the first available type is the default')
  const autoOff = lib.resolveAddSlideV2Options('auto')
  check(assert.deepEqual, lib.initialAddSlideV2Draft(autoOff), { slideType: 'content', contentSubtype: 'text', text: '' }, 'with Auto off the first available style is the default')
  const nothing = lib.resolveAddSlideV2Options('title,section,closing,content')
  check(assert.equal, lib.addSlideV2Blocker({ ...initial, text: 'Some words here' }, { sessionId: 's' }, true, nothing), 'no-options', 'no type at all: nothing to generate')
  check(assert.equal, lib.buildAddSlideV2Request({ ...initial, text: 'Some words here' }, context(), nothing), null)
  // a switched-off option can neither be picked nor generated, even from a stale draft
  const noChart = lib.resolveAddSlideV2Options('chart')
  check(assert.equal, lib.reduceAddSlideV2Draft(initial, { type: 'set_content_subtype', value: 'chart' }, noChart), initial, 'a hidden style cannot be selected')
  check(assert.equal, lib.reduceAddSlideV2Draft(initial, { type: 'set_slide_type', value: 'title' }, lib.resolveAddSlideV2Options('title')), initial, 'a hidden type cannot be selected')
  check(assert.equal, lib.addSlideV2Blocker({ ...initial, contentSubtype: 'chart', text: 'Some words here' }, { sessionId: 's' }, true, noChart), 'no-options', 'a stale draft on a hidden style is blocked')
  check(assert.equal, lib.buildAddSlideV2Request({ ...initial, contentSubtype: 'chart', text: 'Some words here' }, context(), noChart), null)
  check(assert.equal, lib.buildAddSlideV2Request({ ...initial, slideType: 'title', contentSubtype: 'chart', text: 'Some words here' }, context(), noChart).slideType, 'title', 'a dormant hidden style does not block a hero slide')
  check(assert.deepEqual, lib.reduceAddSlideV2Draft({ ...initial, contentSubtype: 'diagram', text: 'x' }, { type: 'reset' }, noChart), initial, 'reset follows the current options')
  check(assert.deepEqual, lib.reduceAddSlideV2Draft({ ...initial, contentSubtype: 'diagram', text: 'x' }, { type: 'reset' }, autoOff), { slideType: 'content', contentSubtype: 'text', text: '' }, 'reset lands on the current default choice, not the build default')
  store.map.set(keyA, '{"slideType":"content","contentSubtype":"table","text":"Kept words"}')
  check(assert.deepEqual, lib.loadAddSlideV2Draft(store, keyA, lib.resolveAddSlideV2Options(undefined)), { ...initial, text: 'Kept words' }, 'a stored style that is now hidden resets to the default style, the text stays')
  check(assert.deepEqual, lib.loadAddSlideV2Draft(store, keyA, allOn), { slideType: 'content', contentSubtype: 'table', text: 'Kept words' })
  check(assert.equal, lib.isPristineAddSlideV2Draft({ ...initial, contentSubtype: 'text' }, autoOff), true, 'pristine is measured against the current default')
  lib.saveAddSlideV2Draft(store, keyA, { ...initial, contentSubtype: 'text' }, autoOff)
  check(assert.equal, store.map.has(keyA), false, 'a draft equal to the current default is not stored')

  // DEC-P6: the Blank follows the deck theme through the same value Layout's other blank layouts default to
  check(assert.equal, lib.ADD_SLIDE_V2_BLANK_BACKGROUND, 'var(--theme-bg, #ffffff)')
  check(assert.deepEqual, lib.addSlideV2BlankNativeOptions(undefined, allOn), { backgroundColor: 'var(--theme-bg, #ffffff)' })
  check(assert.deepEqual, lib.addSlideV2BlankNativeOptions(3, allOn), { position: 3, backgroundColor: 'var(--theme-bg, #ffffff)' })
  check(assert.deepEqual, lib.addSlideV2BlankNativeOptions(0, allOn), { position: 0, backgroundColor: 'var(--theme-bg, #ffffff)' }, 'position 0 is a position')
  const noTheme = lib.resolveAddSlideV2Options('blank_theme')
  check(assert.equal, lib.addSlideV2BlankNativeOptions(undefined, noTheme), undefined, 'blank_theme off + no position = the old call, untouched')
  check(assert.deepEqual, lib.addSlideV2BlankNativeOptions(3, noTheme), { position: 3 }, 'blank_theme off keeps only the position')

  // DEC-P9: the page remembers which slide each job started from
  const follow = new Map()
  lib.rememberAddSlideV2Follow(follow, 'a', 2)
  check(assert.equal, follow.get('a'), 2)
  lib.rememberAddSlideV2Follow(follow, 'a', 5)
  check(assert.equal, follow.get('a'), 5, 'the latest slide wins for the same job')
  for (let i = 0; i < 40; i++) lib.rememberAddSlideV2Follow(follow, `job-${i}`, i)
  check(assert.equal, follow.size, 20, 'the map is capped')
  check(assert.equal, follow.has('a'), false, 'the oldest job is dropped first')
  check(assert.equal, follow.get('job-39'), 39)

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

// ---- Behaviour suite over the panel markup ----------------------------------------------------------------------
function panelModule(panelSource, lib) {
  const icon = name => () => React.createElement('svg', { 'data-icon': name })
  return load(panelSource, {
    imports: {
      react: React,
      'react-dom': { createPortal: (node, host) => ({ portal: true, host, node }) },
      'react/jsx-runtime': require('react/jsx-runtime'),
      'lucide-react': { Layout: icon('layout'), Plus: icon('plus'), RefreshCw: icon('refresh'), Sparkles: icon('sparkles'), Square: icon('square'), X: icon('x') },
      '@/lib/utils': { cn: (...a) => a.filter(Boolean).join(' ') },
      '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [] },
      '@/lib/studio-add-slide-v2': lib,
      '@/lib/studio-add-slide-v2-regenerate': REGEN_LIB,
      '@/components/builder/studio-panels.css': {},
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
  check(assert.equal, (wired.match(/<input /g) ?? []).length, 4 + 8, 'only the 4 slide types and 8 content styles are inputs')
  check(assert.equal, (wired.match(/type="radio"/g) ?? []).length, 12)
  for (const label of ['Title', 'Section', 'Closing', 'Content']) check(assert.match, wired, new RegExp(`<span>${label}</span>`), `type ${label}`)
  for (const label of ['Auto', 'Text', 'Image left', 'Image right', 'Chart', 'Infographic', 'Table', 'Diagram']) check(assert.match, wired, new RegExp(`<span>${label}</span>`), `style ${label}`)
  check(assert.equal, /<span>Image<\/span>/.test(wired), false, 'no plain Image')
  const order = [...wired.matchAll(/<span>(Auto|Text|Image left|Image right|Chart|Infographic|Table|Diagram)<\/span>/g)].map(m => m[1])
  check(assert.deepEqual, order, ['Auto', 'Text', 'Image left', 'Image right', 'Chart', 'Infographic', 'Table', 'Diagram'], 'PK order')
  // the same frame and markers as the Add Element generation panel (side panel, not a pop-up)
  check(assert.match, wired, /^<div class="absolute inset-0 z-20 flex pointer-events-none"><div data-studio-v4-panel="add-slide-generation" data-studio-add-slide-v2="true"/, 'drawer frame + shared panel marker')
  check(assert.match, wired, /data-studio-v4-panel-header/); check(assert.match, wired, /data-studio-v4-panel-context/); check(assert.match, wired, /data-studio-v4-panel-fields/)
  check(assert.match, wired, /<h3[^>]*>Add slide<\/h3>/); check(assert.match, wired, /aria-label="Close add slide panel"/)
  check(assert.equal, /role="dialog"|data-radix|popover/i.test(wired), false, 'not a pop-up')
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
  for (const style of ['table', 'diagram']) {
    const typedStyle = render({ submit: async () => ({ ok: true }), initialDraft: { slideType: 'content', contentSubtype: style, text: 'Quarterly numbers' } })
    check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(typedStyle), false, `${style} can Generate`)
  }
  // DEC-P2: Title / Section / Closing need 2 words, with a hint until met
  for (const slideType of ['title', 'section', 'closing']) {
    const one = render({ submit: async () => ({ ok: true }), initialDraft: { slideType, contentSubtype: 'auto', text: 'Agenda' } })
    check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(one), true, `${slideType}: one word keeps Generate disabled`)
    check(assert.match, one, /data-blocker="too-short"[^>]*>Add at least 2 words, for example a short title\.</, `${slideType}: the hint`)
    const two = render({ submit: async () => ({ ok: true }), initialDraft: { slideType, contentSubtype: 'auto', text: 'Q3 review' } })
    check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(two), false, `${slideType}: two words enable Generate`)
    check(assert.equal, /data-blocker/.test(two), false)
  }
  const contentOneWord = render({ submit: async () => ({ ok: true }), initialDraft: { slideType: 'content', contentSubtype: 'text', text: 'Agenda' } })
  check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(contentOneWord), false, 'Content keeps its "not empty" rule')
  // a diagram is built without research: the read-only block shows it
  const diagramPanel = render({ submit: async () => ({ ok: true }), context: context({ research: research({ useWebSearch: true, useDeepResearch: true }) }), initialDraft: { slideType: 'content', contentSubtype: 'diagram', text: '' } })
  check(assert.match, diagramPanel, /Web search <b>off<\/b>/, 'Diagram: research shown off')
  check(assert.match, diagramPanel, /Diagrams are built without research\./)
  check(assert.equal, /Diagrams are built without research/.test(wired), false)
  // DEC-P1: a quiet link to the classic picker, only when it can open
  check(assert.equal, /Browse layout catalog/.test(wired), false, 'no link without a handler')
  const withCatalog = render({ submit: async () => ({ ok: true }), onBrowseCatalog() {} })
  check(assert.match, withCatalog, /<button type="button" class="asv2-catalog"[^>]*>Browse layout catalog<\/button>/, 'DEC-P1: the secondary link')
  check(assert.equal, /aria-current|role="tab"|role="tablist"/.test(withCatalog), false, 'a link, not a mode')
  // the kill switches, one option at a time, on the panel
  const everyOn = lib.resolveAddSlideV2Options(undefined, 'all')
  const minus = id => new Set([...everyOn].filter(x => x !== id))
  for (const id of ['title', 'section', 'closing', 'content']) {
    const html = render({ submit: async () => ({ ok: true }), options: minus(id), onBrowseCatalog() {}, initialDraft: { slideType: id === 'title' ? 'closing' : 'title', contentSubtype: 'auto', text: '' } })
    check(assert.equal, new RegExp(`name="[^"]*-type" value="${id}"`).test(html), false, `type ${id} hidden by the env list`)
  }
  for (const id of ['auto', 'text', 'image_left', 'image_right', 'chart', 'infographic', 'table', 'diagram']) {
    const html = render({ submit: async () => ({ ok: true }), options: minus(id) })
    check(assert.equal, new RegExp(`<input[^>]*value="${id}"[^>]*>`).test(html), false, `style ${id} hidden by the env list`)
    check(assert.equal, (html.match(/type="radio"/g) ?? []).length, 11, `only ${id} is gone`)
  }
  check(assert.equal, /class="asv2-blank"/.test(render({ submit: async () => ({ ok: true }), options: minus('blank') })), false, 'Blank slide hidden by the env list')
  check(assert.equal, /Or start empty/.test(render({ submit: async () => ({ ok: true }), options: minus('blank') })), false)
  check(assert.equal, /Browse layout catalog/.test(render({ submit: async () => ({ ok: true }), options: minus('catalog'), onBrowseCatalog() {} })), false, 'the catalog link hidden by the env list')
  const bothOff = render({ submit: async () => ({ ok: true }), options: new Set([...everyOn].filter(x => x !== 'blank' && x !== 'catalog')), onBrowseCatalog() {} })
  check(assert.equal, /asv2-footer/.test(bothOff), false, 'no footer when neither Blank nor the catalog is on')
  const stage1 = lib.resolveAddSlideV2Options(undefined)
  const defaultHtml = render({ submit: async () => ({ ok: true }), options: stage1 })
  check(assert.equal, (defaultHtml.match(/type="radio"/g) ?? []).length, 8, 'DEC-P8 default: 4 types + Auto, Text, Image left, Image right')
  for (const id of ['chart', 'infographic', 'table', 'diagram']) check(assert.equal, new RegExp(`<span>${id[0].toUpperCase()}${id.slice(1)}</span>`).test(defaultHtml), false, `stage 2 ${id} hidden by default`)
  const noneHtml = render({ submit: async () => ({ ok: true }), options: lib.resolveAddSlideV2Options('title,section,closing,content') })
  check(assert.match, noneHtml, /data-blocker="no-options"/, 'with every type off: nothing to generate, and it says so')
  check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(noneHtml), true)
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
      '@/lib/element-generation-timeout': load(read('../lib/element-generation-timeout.ts')),
      '@/components/slide-generation-panel/compose-helpers': load(read('../components/slide-generation-panel/compose-helpers.ts')),
      '@/lib/studio-add-slide-v2': lib,
    },
  })
}
function submitSuite(sub, lib) {
  const chart = text => lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text }, context())
  const accepted = (jobId, over = {}) => ({ status: 'accepted', job_id: jobId, target_index: 3, session_id: 'sess-1', presentation_id: 'pres-1', ...over })
  function harness(over = {}) {
    const calls = { fetch: [], accepted: [], meta: [], order: [] }
    const deps = {
      timeoutMs: over.timeoutMs,
      fetchImpl: async (url, init) => {
        calls.order.push('fetch'); calls.fetch.push({ url, init, body: JSON.parse(init.body) })
        if (over.fetchThrows) throw new Error('socket hang up')
        if (over.hang) await new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
        if (over.hangBody) return { ok: true, json: () => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) }
        return { ok: over.ok ?? true, json: over.badJson ? async () => { throw new Error('bad json') } : async () => over.reply ?? accepted('job-1') }
      },
      newJobId: () => 'job-1',
      captureSessionOwner: () => { calls.order.push('capture'); return () => over.sessionStillCurrent ?? true },
      isSessionAdmitted: () => { calls.order.push('admit'); return over.admitted ?? true },
      selection: () => ({ visualIndex: 2, realSlideCount: 4, jobs: {}, ...(over.selection ?? {}) }),
      onAccepted: (job, meta) => { calls.order.push('accepted'); calls.accepted.push(job); calls.meta.push(meta) },
    }
    return { deps, calls }
  }
  // A submit that never settles must fail the test, not hang it.
  const run = async (request, over) => {
    const h = harness(over); let timer
    const guard = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('submit never settled')), 2500) })
    try { return { result: await Promise.race([sub.submitAddSlideV2(request, h.deps), guard]), calls: h.calls } } finally { clearTimeout(timer) }
  }
  const refused = (r, text) => { check(assert.equal, r.result.ok, false); if (text) check(assert.match, r.result.message, text); check(assert.equal, r.calls.accepted.length, 0, 'nothing is registered'); }
  const jobAt = (target, over = {}) => ({ kind: 'compose', status: 'building', target_layout_index: target, ...over })
  const blankFailed = (mod, make) => mod.resolveAddSlideV2BlankTarget({ presentationId: 'pres-1', visualIndex: 1, expectedVisualIndex: 1, realSlideCount: 4, jobs: { a: make(1, { status: 'error' }) } })

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
      ['content', 'table', { canvas_type: 'C1', content_type: 'table', text_subtype: 'table' }],
      ['content', 'diagram', { canvas_type: 'C1', content_type: 'diagram_idea_board', diagram_subtype: 'idea_board' }],
    ]) {
      const r = await run(lib.buildAddSlideV2Request({ slideType, contentSubtype: contentSubtype ?? 'auto', text: 'Say it' }, context()))
      check(assert.deepEqual, r.calls.fetch[0].body.selections, selections, `${slideType}/${contentSubtype} selections`)
      check(assert.equal, /slideType|contentSubtype|anchorVisualIndex|image_left|image_right|"image"/.test(r.calls.fetch[0].init.body), false, 'no UX vocabulary in the body')
    }
    // an explicit Diagram sends every research flag off, whatever the chat says; Table keeps the chat's
    const research4 = research({ useUploadedDocuments: true, useWebSearch: true, useDeepResearch: true, useKnowledgeGraph: true })
    const diagramRun = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'diagram', text: 'Release flow' }, context({ research: research4 })))
    check(assert.deepEqual, diagramRun.calls.fetch[0].body.research, { use_uploaded_documents: false, use_web_search: false, use_deep_research: false, use_knowledge_graph: false, web_search_max_queries: 3 }, 'Diagram: research off on the wire')
    const tableRun = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'table', text: 'Pricing tiers' }, context({ research: research4 })))
    check(assert.deepEqual, tableRun.calls.fetch[0].body.research, { use_uploaded_documents: true, use_web_search: true, use_deep_research: true, use_knowledge_graph: true, web_search_max_queries: 3 }, 'Table: the chat research goes out')
    // DEC-P9: the slide the user was on at submit travels with the accepted job
    check(assert.deepEqual, happy.calls.meta, [{ submitVisualIndex: 2 }], 'onAccepted gets the visual slide the user was on')
    const onFour = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text: 'x' }, context({ currentSlide: 4 })), { selection: { visualIndex: 3, realSlideCount: 4, jobs: { a: jobAt(1) } } })
    check(assert.deepEqual, onFour.calls.meta, [{ submitVisualIndex: 3 }], 'the VISUAL index (placeholders count), not the real one')
    const autoRun = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'auto', text: 'Say it' }, context()))
    check(assert.equal, 'selections' in autoRun.calls.fetch[0].body, false, 'ruling 1a on the wire: no selections key for Auto')
    check(assert.equal, autoRun.calls.fetch[0].init.body.includes('selections'), false)
    check(assert.equal, lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'image', text: 'Say it' }, context()), null, 'the removed Image style never reaches the wire')
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
    const failedSelected = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text: 'x' }, context({ currentSlide: 2 })),
      { selection: { visualIndex: 1, realSlideCount: 4, jobs: { a: jobAt(1, { status: 'error' }) } } })
    refused(failedSelected, /failed to generate/); check(assert.equal, failedSelected.calls.fetch.length, 0, 'a selected failed placeholder: block, and say it failed')
    check(assert.equal, /still being generated/.test(failedSelected.result.message), false)
    const failedAnchor = sub.resolveAddSlideV2Anchor({ presentationId: 'p', visualIndex: 1, realSlideCount: 4, jobs: { a: jobAt(1, { status: 'error' }) } })
    check(assert.equal, failedAnchor.reason, 'failed-placeholder-selected')
    // two placeholders: the message follows the SELECTED one, not any placeholder
    const mixed = { a: jobAt(0, { status: 'error' }), b: jobAt(2) }
    check(assert.equal, sub.resolveAddSlideV2Anchor({ presentationId: 'p', visualIndex: 0, realSlideCount: 4, jobs: mixed }).reason, 'failed-placeholder-selected', 'the failed one is selected')
    check(assert.equal, sub.resolveAddSlideV2Anchor({ presentationId: 'p', visualIndex: 3, realSlideCount: 4, jobs: mixed }).reason, 'placeholder-selected', 'the pending one is selected')
    check(assert.match, blankFailed(sub, jobAt).message, /failed to generate/, 'Blank says it failed too')
    const onPlaceholder = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text: 'x' }, context({ currentSlide: 2 })),
      { selection: { visualIndex: 1, realSlideCount: 4, jobs: { a: jobAt(1) } } })
    refused(onPlaceholder, /finished slide/); check(assert.equal, onPlaceholder.calls.fetch.length, 0, 'a selected placeholder has no anchor: block, never reuse the last real selection')
    const noSlides = await run(lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'chart', text: 'x' }, context({ currentSlide: 1 })),
      { selection: { visualIndex: 0, realSlideCount: 0, jobs: {} } })
    refused(noSlides, /Couldn't tell which slide/); check(assert.equal, noSlides.calls.fetch.length, 0)
    const moved = await run(chart('x'), { selection: { visualIndex: 3 } })
    refused(moved, /selected slide changed/); check(assert.equal, moved.calls.fetch.length, 0, 'the popup and the page must agree on the selected slide')
    const newDeck = await run(lib.buildAddSlideV2Request({ slideType: 'title', contentSubtype: 'auto', text: 'Hello there' }, context({ presentationId: null })),
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
    // (b) the backend's {detail} reaches the user; known fields still win; a dump is capped
    const detailOf = async reply => (await run(chart('x'), { ok: false, reply })).result.message
    check(assert.equal, await detailOf({ detail: 'Presentation not found' }), 'Presentation not found', 'FastAPI string detail is shown')
    check(assert.equal, await detailOf({ detail: [{ loc: ['body', 'theme'], msg: 'Field required' }, { msg: 'Value is not valid' }] }), 'Field required; Value is not valid', 'validation detail list is shown')
    check(assert.equal, await detailOf({ detail: { message: 'Session expired' } }), 'Session expired')
    check(assert.equal, await detailOf({ error: 'Unauthorized', detail: 'ignored' }), 'Unauthorized', 'the fields the panel already reads win')
    check(assert.equal, await detailOf({ errors: ['A', 'B'], detail: 'ignored' }), 'A; B')
    check(assert.equal, await detailOf({ detail: '' }), 'Slide Composer failed', 'an empty detail falls back to the generic text')
    check(assert.equal, await detailOf({ detail: 42 }), 'Slide Composer failed', 'a non-text detail falls back')
    check(assert.equal, await detailOf(null), 'Slide Composer failed')
    check(assert.equal, (await detailOf({ detail: 'x'.repeat(1000) })).length, 300, 'a long detail is capped')
    const detailOn200 = await run(chart('x'), { reply: { detail: 'Quota exceeded' } })
    refused(detailOn200, /Quota exceeded/)
    // (c) the compose POST has a browser budget and a lost reply is never retried
    const slow = await run(chart('x'), { hang: true, timeoutMs: 15 })
    refused(slow, /didn't answer in time/); check(assert.equal, slow.result.message, sub.ADD_SLIDE_V2_TIMEOUT_MESSAGE)
    check(assert.equal, slow.calls.fetch.length, 1, 'a timed-out POST is not retried')
    check(assert.equal, slow.calls.fetch[0].init.signal.aborted, true, 'the request is aborted, not just abandoned')
    const slowBody = await run(chart('x'), { hangBody: true, timeoutMs: 15 })
    refused(slowBody, /didn't answer in time/); check(assert.equal, slowBody.calls.fetch.length, 1, 'a reply that stalls while reading is also bounded')
    const fast = await run(chart('x'), { timeoutMs: 40 })
    check(assert.equal, fast.result.ok, true)
    await new Promise(resolve => setTimeout(resolve, 90))
    check(assert.equal, fast.calls.fetch[0].init.signal.aborted, false, 'a prompt reply is not aborted later: the timer is cleared')
    check(assert.equal, sub.ADD_SLIDE_V2_ACCEPT_TIMEOUT_MS, 30000, 'default budget = the existing fast element-generation timeout')
    check(assert.notEqual, sub.ADD_SLIDE_V2_TIMEOUT_MESSAGE, sub.ADD_SLIDE_V2_LOST_REPLY_MESSAGE)
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
    // DEC-P9: the factory files the slide each job started from for the page's completion handler
    const followMap = new Map(); const fh = harness()
    const followed = sub.createAddSlideV2Hooks({ ...fh.deps, generationEnabled: true, presentationId: 'pres-1', follow: followMap })
    check(assert.deepEqual, await followed.submit(chart('Via follow')), { ok: true })
    check(assert.deepEqual, [...followMap], [['job-1', 2]], 'job -> the visual slide the user was on')
    check(assert.equal, fh.calls.accepted.length, 1, 'and the page queue still gets the job')
    check(assert.deepEqual, fh.calls.meta, [{ submitVisualIndex: 2 }])
    const noFollow = harness()
    check(assert.deepEqual, await sub.createAddSlideV2Hooks({ ...noFollow.deps, generationEnabled: true, presentationId: 'pres-1' }).submit(chart('No map')), { ok: true }, 'no follow map: nothing remembered, nothing breaks')
    check(assert.equal, noFollow.calls.accepted.length, 1)
  })()
}

// A handler that rejects after `void`-ing its promise must fail the suite, not crash the process.
const unhandled = []
process.on('unhandledRejection', error => { unhandled.push(error) })
const raiseUnhandled = () => { if (unhandled.length) throw unhandled.splice(0)[0] }

// ---- Interaction suite over the pop-up: the real component under a tiny hooks runtime (draft, Discard, Blank, Generate) ----
function mountPanel(panelSource, lib, props, component = 'AddSlideV2Panel') {
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
    useEffect(setup, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { const prev = slots[i]; slots[i] = { deps }; queued.push(() => { prev?.cleanup?.(); const cleanup = setup(); if (typeof cleanup === 'function') slots[i].cleanup = cleanup }) } },
  }
  // The panel's own `window`: records its listeners so a test can press keys and see them removed.
  const listeners = []
  const fakeWindow = {
    sessionStorage: null,
    addEventListener(type, fn) { listeners.push({ type, fn }) },
    removeEventListener(type, fn) { const at = listeners.findIndex(l => l.type === type && l.fn === fn); if (at >= 0) listeners.splice(at, 1) },
  }
  // A test may install its own `window` (the sessionStorage cases); the panel's listener methods layer on top of it.
  const withWindow = fn => {
    const prev = globalThis.window
    globalThis.window = prev === undefined ? fakeWindow : Object.assign(Object.create(prev), { addEventListener: fakeWindow.addEventListener, removeEventListener: fakeWindow.removeEventListener })
    try { return fn() } finally { if (prev === undefined) delete globalThis.window; else globalThis.window = prev }
  }
  const jsx = (type, p, key) => ({ type, props: p ?? {}, key })
  const icon = () => null
  const mod = load(panelSource, { imports: {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-dom': { createPortal: (node, host) => ({ portal: true, host, node }) },
    'lucide-react': { Layout: icon, Plus: icon, RefreshCw: icon, Sparkles: icon, Square: icon, X: icon },
    '@/lib/utils': { cn: (...a) => a.filter(Boolean).join(' ') }, '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [] },
    '@/lib/studio-add-slide-v2': lib, '@/lib/studio-add-slide-v2-regenerate': REGEN_LIB, '@/components/builder/studio-panels.css': {}, './studio-add-slide-v2.css': {},
  } })
  let tree
  const focused = []
  // React attaches refs before effects run; do the same, with a fake element that records focus() and can click a button.
  const attachRefs = node => {
    if (!node || typeof node !== 'object') return
    const ref = node.props?.ref
    if (ref && typeof ref === 'object' && !ref.current) {
      ref.current = { tag: node.type, focus() { focused.push(node.type) }, closest(selector) { rt.closestSelectors.push(selector); return rt.hidden ? { hiddenDrawer: true } : null }, querySelector: selector => (selector === 'button' ? props.catalogButton ?? null : null) }
    }
    const c = node.props?.children
    for (const child of Array.isArray(c) ? c.flat(Infinity) : [c]) attachRefs(child)
  }
  const rt = {
    closed: 0,
    focused,
    hidden: false,
    closestSelectors: [],
    render() {
      let guard = 0
      withWindow(() => { do { cursor = 0; dirty = false; tree = mod[component]({ ...props }); attachRefs(tree); while (queued.length) queued.shift()() } while (dirty && ++guard < 30) })
      return tree
    },
    key(key, init = {}) {
      const event = { key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, ...init }
      for (const listener of [...listeners]) if (listener.type === 'keydown') listener.fn(event)
      return event
    },
    listenerCount: () => listeners.filter(l => l.type === 'keydown').length,
    unmount() { withWindow(() => { for (const slot of slots) slot?.cleanup?.() }) },
    get tree() { return tree },
    setProps(over) { Object.assign(props, over); rt.render() },
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
  check(assert.equal, draftIn(store), null, 'a fresh panel stores nothing')
  check(assert.deepEqual, rt.focused, ['textarea'], 'the panel lands in its one text box when it opens')
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

  // Generate: success clears the draft and the panel stays open (several slides can be queued); failure keeps
  const s2 = mem(); const submitted = []; let closed = 0
  rt = mountPanel(panelSource, lib, base(s2, { onClose() { closed++ }, submit: async request => { submitted.push(request); return { ok: true } } }))
  rt.pick('chart'); rt.type('Revenue by region')
  check(assert.notEqual, draftIn(s2), null)
  check(assert.equal, rt.maybeClass('asv2-queued'), null)
  await rt.click('asv2-generate')
  check(assert.equal, submitted.length, 1)
  check(assert.equal, submitted[0].instruction, 'Revenue by region')
  check(assert.equal, closed, 0, 'a successful Generate leaves the side panel open')
  check(assert.equal, draftIn(s2), null, 'a successful Generate clears the draft')
  check(assert.equal, rt.text(), '', 'and the box')
  check(assert.equal, rt.maybeClass('asv2-queued').props.children, 'Queued. It appears right after slide 3 when it is ready.', 'it says where the slide lands')
  rt.type('Next slide idea')
  check(assert.equal, rt.maybeClass('asv2-queued'), null, 'the note clears on the next edit')
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

  // an error or the Queued note belongs to the slide it was raised on (the panel stays open while the user moves)
  const s4b = mem()
  rt = mountPanel(panelSource, lib, base(s4b, { submit: async () => ({ ok: false, message: 'Not now' }) }))
  rt.pick('chart'); rt.type('Edge case')
  await rt.click('asv2-generate')
  check(assert.equal, rt.error(), 'Not now')
  rt.setProps({ context: context() })
  check(assert.equal, rt.error(), 'Not now', 'a re-render on the same slide keeps the error')
  rt.setProps({ context: context({ currentSlide: 4 }) })
  check(assert.equal, rt.error(), null, 'moving to another slide clears the error')
  check(assert.equal, rt.text(), 'Edge case', 'and keeps the draft')
  await rt.click('asv2-generate')
  check(assert.equal, rt.error(), 'Not now')
  rt.type('Edge case, edited')
  check(assert.equal, rt.error(), null, 'editing the text clears the error')
  const s4c = mem()
  rt = mountPanel(panelSource, lib, base(s4c))
  rt.pick('chart'); rt.type('Queue then move')
  await rt.click('asv2-generate')
  check(assert.equal, rt.maybeClass('asv2-queued').props.children, 'Queued. It appears right after slide 3 when it is ready.')
  rt.setProps({ context: context() })
  check(assert.notEqual, rt.maybeClass('asv2-queued'), null, 'the Queued note stays while the user is still on that slide')
  rt.setProps({ context: context({ currentSlide: 4 }) })
  check(assert.equal, rt.maybeClass('asv2-queued'), null, 'the Queued note clears when the viewer moves to another slide')

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

  // DEC-P2 in the real component: hero types need two words, and the hint says so
  const s7 = mem()
  rt = mountPanel(panelSource, lib, base(s7))
  rt.pick('title'); rt.type('Agenda')
  check(assert.equal, rt.byClass('asv2-generate').props.disabled, true, 'one word keeps Generate disabled on a Title slide')
  check(assert.equal, rt.byClass('asv2-blocker').props.children, 'Add at least 2 words, for example a short title.')
  rt.type('Agenda for Q3')
  check(assert.equal, rt.byClass('asv2-generate').props.disabled, false)
  check(assert.equal, rt.maybeClass('asv2-blocker'), null)
  rt.pick('content'); rt.type('Agenda')
  check(assert.equal, rt.byClass('asv2-generate').props.disabled, false, 'Content keeps its own rule')

  // DEC-P1: the catalog link calls the handler
  let browsed = 0, closes = 0
  rt = mountPanel(panelSource, lib, base(mem(), { onBrowseCatalog() { browsed++ }, onClose() { closes++ } }))
  await rt.click('asv2-catalog')
  check(assert.equal, browsed, 1, 'the link opens the classic picker')
  check(assert.equal, closes, 0, 'opening the catalog does not close the panel')
  // Escape closes the panel from anywhere, like Add Element: one window listener with the same three guards
  check(assert.equal, rt.listenerCount(), 1, 'one window keydown listener while the panel is mounted')
  rt.key('a')
  check(assert.equal, closes, 0, 'other keys do not close')
  const esc = rt.key('Escape')
  check(assert.equal, closes, 1, 'Escape closes the panel from anywhere (a window listener, not focus inside the panel)')
  check(assert.equal, esc.defaultPrevented, true, 'and the key is consumed')
  rt.key('Escape', { defaultPrevented: true })
  check(assert.equal, closes, 1, 'an Escape a Radix layer (the catalog picker) already took does not close the panel')
  rt.hidden = true
  rt.key('Escape')
  check(assert.equal, closes, 1, 'a hidden Studio drawer (still mounted) ignores Escape')
  check(assert.equal, rt.closestSelectors.at(-1), '[data-studio-v4-shell="true"] [data-studio-workspace-visible="false"]', 'the same hidden-drawer test Add Element uses')
  rt.hidden = false
  rt.unmount()
  check(assert.equal, rt.listenerCount(), 0, 'the listener is removed when the panel unmounts')
  let release; const slow = new Promise(resolve => { release = resolve })
  rt = mountPanel(panelSource, lib, base(mem(), { onClose() { closes++ }, submit: () => slow }))
  rt.pick('chart'); rt.type('Slow slide')
  const clicking = rt.click('asv2-generate')
  await Promise.resolve()
  rt.render()
  check(assert.equal, rt.byClass('asv2-generate').props.children.at(-1), 'Generating…', 'pending label')
  rt.key('Escape')
  check(assert.equal, closes, 1, 'Escape does not close a panel that is generating')
  release({ ok: true }); await clicking
  check(assert.equal, rt.listenerCount(), 1, 'one listener after the re-subscribe (the old one was removed)')
  rt.key('Escape')
  check(assert.equal, closes, 2, 'once generating is over, Escape closes again (the listener sees the current state)')
  const offCatalog = mountPanel(panelSource, lib, base(mem(), { onBrowseCatalog() {}, options: new Set([...lib.resolveAddSlideV2Options(undefined, 'all')].filter(x => x !== 'catalog')) }))
  check(assert.equal, offCatalog.maybeClass('asv2-catalog'), null, 'the catalog kill switch hides the link')
  const offBlank = mountPanel(panelSource, lib, base(mem(), { options: new Set([...lib.resolveAddSlideV2Options(undefined, 'all')].filter(x => x !== 'blank')) }))
  check(assert.equal, offBlank.maybeClass('asv2-blank'), null, 'the blank kill switch hides the button')

  // the kill switches in the real component: a hidden style is neither offered nor restored
  const stage1 = lib.resolveAddSlideV2Options(undefined)
  const s8 = mem()
  s8.map.set(key, JSON.stringify({ slideType: 'content', contentSubtype: 'table', text: 'Saved before the switch' }))
  rt = mountPanel(panelSource, lib, base(s8, { options: stage1 }))
  check(assert.equal, rt.radio('table'), undefined, 'a hidden style has no radio')
  check(assert.equal, rt.radio('chart'), undefined)
  check(assert.equal, rt.radio('auto').props.checked, true, 'the stored hidden style resets to the default style')
  check(assert.equal, rt.text(), 'Saved before the switch', 'the text is kept')
  check(assert.equal, rt.all(n => n.type === 'input' && n.props.type === 'radio').length, 8)
  s8.map.set(key, JSON.stringify({ slideType: 'content', contentSubtype: 'table', text: 'Saved before the switch' }))
  rt = mountPanel(panelSource, lib, base(s8, { options: lib.resolveAddSlideV2Options(undefined, 'all') }))
  check(assert.equal, rt.radio('table').props.checked, true, 'with the switch lifted the stored choice is back')

  // storage that throws, or none, never breaks the panel
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

// ---- Behaviour suite over the Entry: toolbar button, portal into the drawer host, classic picker, Blank ---------------
async function entrySuite(panelSource, lib) {
  const host = { id: 'element-drawer-host' }
  const events = { open: [], native: [] }
  const settings = (over = {}) => ({
    sessionId: 'sess-1', presentationId: 'pres-1', research: research({ useWebSearch: true }), themeProfileName: null,
    panelOpen: false, panelHost: host, onPanelOpenChange: open => events.open.push(open), ...over,
  })
  const props = (over = {}, settingsOver = {}) => ({
    config: { settings: settings(settingsOver), currentSlide: 3, slideCount: 7, theme: { mode: 'auto' } },
    onAddSlide: async (layout, options) => { events.native.push([layout, options]) },
    classicPicker: 'CLASSIC-PICKER', className: 'toolbar-extra', ...over,
  })
  const button = rt => rt.one(n => n.type === 'button' && String(n.props.className).includes('h-12'))
  const portals = rt => rt.all(n => n.portal === true)
  const mountEntry = (over, settingsOver) => mountPanel(panelSource, lib, props(over, settingsOver), 'AddSlideV2Entry')

  // the toolbar button toggles the page's panel state
  let rt = mountEntry()
  check(assert.equal, portals(rt).length, 0, 'closed: nothing is rendered into the drawer')
  check(assert.equal, button(rt).props['aria-expanded'], false)
  check(assert.match, button(rt).props.className, /toolbar-extra/, 'the toolbar class is kept')
  button(rt).props.onClick()
  check(assert.deepEqual, events.open, [true], 'the button asks the page to open the panel')
  rt = mountEntry({}, { panelOpen: true })
  check(assert.equal, button(rt).props['aria-expanded'], true)
  check(assert.equal, button(rt).props['aria-pressed'], true)
  button(rt).props.onClick()
  check(assert.deepEqual, events.open, [true, false], 'and to close it when it is open')

  // the panel renders into the drawer host, only while open and only when the host exists
  check(assert.equal, portals(rt).length, 1, 'open: one portal')
  check(assert.equal, portals(rt)[0].host, host, 'into the Element drawer host the page provides')
  check(assert.equal, mountEntry({}, { panelOpen: true, panelHost: null }).all(n => n.portal === true).length, 0, 'no host yet: nothing rendered')
  check(assert.equal, mountEntry({}, { panelOpen: false }).all(n => n.portal === true).length, 0, 'closed: nothing rendered')
  const panelProps = () => portals(rt)[0].node.props
  check(assert.equal, portals(rt)[0].node.key, lib.addSlideV2DraftKey('sess-1', 'pres-1'), 'the panel is keyed by session and deck, so a switch loads that deck\'s own draft')
  check(assert.equal, panelProps().context.currentSlide, 3, 'the panel sees the viewer slide')
  check(assert.equal, panelProps().context.sessionId, 'sess-1')
  check(assert.equal, panelProps().context.themeLabel, 'Auto — matches deck')
  check(assert.equal, panelProps().submit, undefined, 'no submit unless the page supplies one')
  const submitFn = async () => ({ ok: true })
  check(assert.equal, mountEntry({}, { panelOpen: true, submit: submitFn }).all(n => n.portal === true)[0].node.props.submit, submitFn, 'the page submit is handed through')
  events.open.length = 0
  panelProps().onClose()
  check(assert.deepEqual, events.open, [false], 'the panel close asks the page to close it')

  // DEC-P1: the classic picker stays mounted, invisible, and the link clicks its trigger
  const anchors = rt.all(n => n.props?.className === 'asv2-catalog-anchor')
  check(assert.equal, anchors.length, 1); check(assert.equal, anchors[0].props['aria-hidden'], 'true', 'hidden from assistive tech')
  check(assert.equal, anchors[0].props.children, 'CLASSIC-PICKER')
  let clicked = 0
  const withButton = mountPanel(panelSource, lib, { ...props({}, { panelOpen: true }), catalogButton: { click() { clicked++ } } }, 'AddSlideV2Entry')
  withButton.all(n => n.portal === true)[0].node.props.onBrowseCatalog()
  check(assert.equal, clicked, 1, 'the link clicks the classic picker trigger')
  check(assert.doesNotThrow, () => panelProps().onBrowseCatalog(), 'no trigger found: nothing happens')
  const noClassic = mountEntry({ classicPicker: undefined }, { panelOpen: true })
  check(assert.equal, noClassic.all(n => n.props?.className === 'asv2-catalog-anchor').length, 0, 'no classic picker, no anchor')
  check(assert.equal, noClassic.all(n => n.portal === true)[0].node.props.onBrowseCatalog, undefined, 'and no link')

  // Blank: resolved like Generate, passed to the native Add with the real position and the deck theme background
  const THEME_BG = 'var(--theme-bg, #ffffff)'
  rt = mountEntry({}, { panelOpen: true })
  events.native.length = 0
  check(assert.equal, await panelProps().onInsertBlank(), undefined)
  check(assert.deepEqual, events.native, [['B1-blank', { backgroundColor: THEME_BG }]], 'no resolver: the old position, plus the deck theme background')
  const seen = []
  rt = mountEntry({}, { panelOpen: true, resolveBlankTarget: expected => { seen.push(expected); return { ok: true, position: 3 } } })
  events.native.length = 0
  await portals(rt)[0].node.props.onInsertBlank()
  check(assert.deepEqual, seen, [2], 'the resolver gets the slide the panel shows (visual index 2)')
  check(assert.deepEqual, events.native, [['B1-blank', { position: 3, backgroundColor: THEME_BG }]], 'the real position and the theme background reach the native Add')
  rt = mountEntry({}, { panelOpen: true, resolveBlankTarget: () => ({ ok: true, position: undefined }) })
  events.native.length = 0
  await portals(rt)[0].node.props.onInsertBlank()
  check(assert.deepEqual, events.native, [['B1-blank', { backgroundColor: THEME_BG }]], 'no placeholders: the old position')
  rt = mountEntry({}, { panelOpen: true, resolveBlankTarget: () => ({ ok: false, message: 'Select a finished slide to add after.' }) })
  events.native.length = 0
  const refusal = await portals(rt)[0].node.props.onInsertBlank()
  check(assert.deepEqual, refusal, { ok: false, message: 'Select a finished slide to add after.' }, 'a refused Blank says why')
  check(assert.equal, events.native.length, 0, 'and sends nothing')
  const noTheme = mountEntry({ options: lib.resolveAddSlideV2Options('blank_theme') }, { panelOpen: true, resolveBlankTarget: () => ({ ok: true, position: 3 }) })
  events.native.length = 0
  await noTheme.all(n => n.portal === true)[0].node.props.onInsertBlank()
  check(assert.deepEqual, events.native, [['B1-blank', { position: 3 }]], 'blank_theme off: position only')
  const plain = mountEntry({ options: lib.resolveAddSlideV2Options('blank_theme') }, { panelOpen: true })
  events.native.length = 0
  await plain.all(n => n.portal === true)[0].node.props.onInsertBlank()
  check(assert.deepEqual, events.native, [['B1-blank', undefined]], 'blank_theme off and no position: the native Add is called exactly as before')
  // while the native Add runs the toolbar says so and is disabled
  let finish; const pending = new Promise(resolve => { finish = resolve })
  rt = mountEntry({ onAddSlide: () => pending }, { panelOpen: true })
  const blanking = portals(rt)[0].node.props.onInsertBlank()
  rt.render()
  check(assert.equal, button(rt).props.disabled, true, 'the toolbar button is disabled while a Blank is being added')
  check(assert.equal, rt.all(n => n.type === 'span' && n.props.children === 'Adding').length, 1, 'and says Adding')
  check(assert.equal, portals(rt)[0].node.props.disabled, true, 'the panel is disabled too')
  finish(); await blanking; rt.render()
  check(assert.equal, button(rt).props.disabled, false)
  check(assert.equal, rt.all(n => n.type === 'span' && n.props.children === 'Add Slide').length, 1)
  const failing = mountEntry({ onAddSlide: async () => { throw new Error('native Add failed') } }, { panelOpen: true })
  await failing.all(n => n.portal === true)[0].node.props.onInsertBlank().catch(() => {})
  failing.render()
  check(assert.equal, failing.all(n => n.type === 'button' && n.props.disabled === true).length, 0, 'a failed native Add re-enables the toolbar')
  check(assert.equal, mountEntry({ disabled: true }).one(n => n.type === 'button' && String(n.props.className).includes('h-12')).props.disabled, true, 'the viewer disabled state reaches the button')
}

// ---- Regenerate overlay (DEC-P5 scaffold): the old slide stays until the new one is ready ---------------------------
function regenSuite(regen) {
  const idle = regen.ADD_SLIDE_V2_REGENERATE_IDLE
  const reduce = regen.reduceAddSlideV2Regenerate
  check(assert.deepEqual, idle, { status: 'idle' })
  const building = reduce(idle, { type: 'start', jobId: 'j1', oldSlideId: 'B' })
  check(assert.deepEqual, building, { status: 'building', jobId: 'j1', oldSlideId: 'B' })
  check(assert.equal, regen.mayDeleteOldSlide(building), false, 'DEC-P5: nothing is deleted while the new slide builds')
  check(assert.equal, regen.overlaySlideId(building), 'B', 'the overlay sits on the old slide')
  check(assert.deepEqual, regen.planAddSlideV2RegenerateSwap(['A', 'B', 'C'], building), { order: ['A', 'B', 'C'], deleteIds: [] }, 'building: the deck is untouched')
  check(assert.equal, reduce(building, { type: 'start', jobId: 'j2', oldSlideId: 'C' }), building, 'a second start never replaces a running one')
  check(assert.equal, reduce(idle, { type: 'start', jobId: '', oldSlideId: 'B' }), idle, 'a start needs a job and a slide')
  check(assert.equal, reduce(idle, { type: 'start', jobId: 'j1', oldSlideId: '' }), idle)
  // success: swap in place, then and only then delete the old one
  const ready = reduce(building, { type: 'ready', jobId: 'j1', newSlideId: 'N' })
  check(assert.deepEqual, ready, { status: 'ready', jobId: 'j1', oldSlideId: 'B', newSlideId: 'N' })
  check(assert.equal, regen.mayDeleteOldSlide(ready), true, 'only a ready run may delete the old slide')
  check(assert.equal, regen.overlaySlideId(ready), null, 'the overlay is gone once the swap is due')
  check(assert.deepEqual, regen.planAddSlideV2RegenerateSwap(['A', 'B', 'C', 'N'], ready), { order: ['A', 'N', 'C'], deleteIds: ['B'] }, 'the new slide takes the old one\'s place; the count and the other slides stay')
  check(assert.deepEqual, regen.planAddSlideV2RegenerateSwap(['N', 'A', 'B'], ready), { order: ['A', 'N'], deleteIds: ['B'] }, 'wherever the new slide was inserted')
  check(assert.deepEqual, regen.planAddSlideV2RegenerateSwap(['A', 'placeholder-1', 'B', 'C', 'N'], ready), { order: ['A', 'placeholder-1', 'N', 'C'], deleteIds: ['B'] }, 'a placeholder beside it moves nothing: the new slide takes exactly the old slot')
  check(assert.deepEqual, regen.planAddSlideV2RegenerateSwap(['A', 'B', 'placeholder-1', 'C', 'N'], ready), { order: ['A', 'N', 'placeholder-1', 'C'], deleteIds: ['B'] })
  check(assert.deepEqual, regen.planAddSlideV2RegenerateSwap(['A', 'B', 'C'], ready), { order: ['A', 'B', 'C'], deleteIds: [] }, 'the new slide is not in the deck yet: nothing is deleted')
  check(assert.deepEqual, regen.planAddSlideV2RegenerateSwap(['A', 'C', 'N'], ready), { order: ['A', 'C', 'N'], deleteIds: [] }, 'the old slide is gone already: nothing is deleted')
  // failure: the old slide is kept exactly as it was
  const failed = reduce(building, { type: 'fail', jobId: 'j1', message: 'Slide Builder timed out' })
  check(assert.deepEqual, failed, { status: 'failed', jobId: 'j1', oldSlideId: 'B', message: 'Slide Builder timed out' })
  check(assert.equal, regen.mayDeleteOldSlide(failed), false, 'a failed run never deletes')
  check(assert.deepEqual, regen.planAddSlideV2RegenerateSwap(['A', 'B', 'C', 'N'], failed), { order: ['A', 'B', 'C', 'N'], deleteIds: [] }, 'failed: the deck is unchanged')
  check(assert.equal, reduce(building, { type: 'fail', jobId: 'j1', message: '' }).message, 'The slide could not be regenerated.', 'a failure always says something')
  // wrong job, wrong order of events, bad data
  check(assert.equal, reduce(building, { type: 'ready', jobId: 'other', newSlideId: 'N' }), building, 'another job cannot finish this run')
  check(assert.equal, reduce(building, { type: 'fail', jobId: 'other', message: 'x' }), building, 'nor fail it')
  check(assert.equal, reduce(building, { type: 'ready', jobId: 'j1', newSlideId: 'B' }), building, 'the new slide must differ from the old one')
  check(assert.equal, reduce(building, { type: 'ready', jobId: 'j1', newSlideId: '' }), building, 'and exist')
  check(assert.equal, reduce(idle, { type: 'ready', jobId: 'j1', newSlideId: 'N' }), idle, 'ready without a run is ignored')
  check(assert.equal, reduce(failed, { type: 'ready', jobId: 'j1', newSlideId: 'N' }), failed, 'a failed run cannot turn ready')
  check(assert.equal, reduce(ready, { type: 'fail', jobId: 'j1', message: 'x' }), ready, 'a ready run cannot fail')
  check(assert.equal, reduce(building, { type: 'dismiss' }), building, 'a running overlay cannot be dismissed')
  check(assert.deepEqual, reduce(ready, { type: 'dismiss' }), idle)
  check(assert.deepEqual, reduce(failed, { type: 'dismiss' }), idle)
  check(assert.deepEqual, reduce(failed, { type: 'start', jobId: 'j3', oldSlideId: 'B' }), { status: 'building', jobId: 'j3', oldSlideId: 'B' }, 'after a failure the user can try again')
  const frozenIds = Object.freeze(['A', 'B', 'N'])
  check(assert.doesNotThrow, () => regen.planAddSlideV2RegenerateSwap(frozenIds, ready), 'the deck order passed in is never mutated')
}

// ---- J2V2-REGENERATE: lib, submit, panel and Entry suites. Each runs on the real source and on every mutant. ------------
const REGEN_ON = lib => lib.resolveAddSlideV2Options(undefined, 'regenerate,all')
const withoutComments0 = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
// A real refine body from the real lib, for key comparisons (the suites below build their own).
function realLibBody() {
  const lib = load(LIB, { env: ALL_ENV })
  const target = { slideId: 's1', layoutIndex: 0, slideNumber: 1, title: 'T', kind: 'content', instruction: '', source: 'compose', busy: false }
  const req = lib.buildAddSlideV2RegenerateRequest({ contentSubtype: 'chart', text: 'Quarterly revenue' }, target, context(), lib.resolveAddSlideV2Options(undefined, 'regenerate,all'))
  return lib.buildAddSlideV2RefineBody(req, 0)
}
const regenTarget = (over = {}) => ({
  slideId: 's3', layoutIndex: 2, slideNumber: 3, title: 'Welcome', kind: 'title', instruction: 'Welcome to Acme Corp', source: 'context', busy: false, ...over,
})

function regenerateLibSuite(lib) {
  // canvas -> kind: a hero stays a hero
  for (const [canvas, kind] of [['H1', 'title'], ['H2', 'section'], ['H3', 'closing'], [' h1 ', 'title'], ['h3', 'closing'], ['C1', 'content'], ['I1', 'content'], ['', 'content'], [undefined, 'content'], [null, 'content'], [7, 'content']]) {
    check(assert.equal, lib.addSlideV2KindFromCanvas(canvas), kind, `canvas ${JSON.stringify(canvas)} is a ${kind} slide`)
  }
  check(assert.deepEqual, lib.ADD_SLIDE_V2_KIND_LABEL, { title: 'Title', section: 'Section', closing: 'Closing', content: 'Content' })
  check(assert.equal, lib.addSlideV2RegenerateIsHero('title'), true)
  check(assert.equal, lib.addSlideV2RegenerateIsHero('section'), true)
  check(assert.equal, lib.addSlideV2RegenerateIsHero('closing'), true)
  check(assert.equal, lib.addSlideV2RegenerateIsHero('content'), false)

  // the draft is pre-filled from the slide's original instruction
  const on = REGEN_ON(lib)
  check(assert.deepEqual, lib.initialAddSlideV2RegenerateDraft(regenTarget(), on), { contentSubtype: 'auto', text: 'Welcome to Acme Corp' }, 'pre-filled from the original instruction, Auto')
  check(assert.equal, lib.initialAddSlideV2RegenerateDraft(regenTarget({ instruction: '' }), on).text, '', 'no original instruction: an empty box')
  check(assert.equal, lib.initialAddSlideV2RegenerateDraft(regenTarget(), lib.resolveAddSlideV2Options('auto')).contentSubtype, 'text', 'Auto hidden: the first available style')

  // blockers, in order
  const draft = (text, contentSubtype = 'auto') => ({ contentSubtype, text })
  const blocker = (d, target, over = {}) => lib.addSlideV2RegenerateBlocker(d, target, { sessionId: 'sess-1', ...over.context }, over.hasSubmit ?? true, over.options ?? on)
  check(assert.equal, blocker(draft('Welcome to Acme'), regenTarget()), null, 'a title with three words can be regenerated')
  check(assert.equal, blocker(draft('Welcome to Acme'), regenTarget(), { options: lib.resolveAddSlideV2Options('all') }), 'no-options', 'the regenerate option off blocks')
  check(assert.equal, blocker(draft('Welcome to Acme'), regenTarget({ busy: true })), 'busy', 'a slide already being regenerated')
  check(assert.equal, lib.ADD_SLIDE_V2_BLOCKER_COPY.busy, 'This slide is already being regenerated.')
  check(assert.equal, blocker(draft('   '), regenTarget()), 'empty-text')
  check(assert.equal, blocker(draft('Welcome'), regenTarget()), 'too-short', 'a title needs two words (DEC-P2)')
  check(assert.equal, blocker(draft('Welcome'), regenTarget({ kind: 'section' })), 'too-short')
  check(assert.equal, blocker(draft('Welcome'), regenTarget({ kind: 'closing' })), 'too-short')
  check(assert.equal, blocker(draft('Welcome back'), regenTarget({ kind: 'closing' })), null)
  check(assert.equal, blocker(draft('Pipeline'), regenTarget({ kind: 'content' })), null, 'a content slide keeps "not empty"')
  check(assert.equal, blocker(draft('Pipeline', 'chart'), regenTarget({ kind: 'content' }), { options: lib.resolveAddSlideV2Options(undefined, 'regenerate') }), 'no-options', 'a hidden content style blocks a content slide')
  check(assert.equal, blocker(draft('Pipeline', 'chart'), regenTarget({ kind: 'title' }), { options: lib.resolveAddSlideV2Options(undefined, 'regenerate') }), 'too-short', 'a hero kind ignores the content style')
  check(assert.equal, blocker(draft('Welcome to Acme'), regenTarget(), { context: { sessionId: null } }), 'no-session')
  check(assert.equal, blocker(draft('Welcome to Acme'), regenTarget(), { hasSubmit: false }), 'no-submit')
  check(assert.equal, blocker(draft('Welcome to Acme'), regenTarget({ busy: true }), { hasSubmit: false }), 'busy', 'busy is reported before a missing submit')

  // the request
  const build = (d, target = regenTarget(), ctx = context(), options = on) => lib.buildAddSlideV2RegenerateRequest(d, target, ctx, options)
  const req = build(draft('  Welcome to Acme  '))
  check(assert.deepEqual, req, {
    mode: 'regenerate', target: regenTarget(), contentSubtype: null, instruction: 'Welcome to Acme', visualIndex: 2,
    sessionId: 'sess-1', presentationId: 'pres-1', research: research({ useWebSearch: true }), theme: THEME,
  }, 'a hero target sends no content style, a trimmed instruction and the VISUAL index (the page re-resolves it)')
  check(assert.equal, build(draft('Welcome')), null, 'too short: no request')
  check(assert.equal, build(draft('Welcome to Acme'), regenTarget({ busy: true })), null, 'busy: no request')
  check(assert.equal, build(draft('Welcome to Acme'), regenTarget(), context({ sessionId: null })), null, 'no session: no request')
  check(assert.equal, build(draft('Welcome to Acme'), regenTarget(), context(), lib.resolveAddSlideV2Options('all')), null, 'option off: no request')
  check(assert.equal, build(draft('Pipeline', 'chart'), regenTarget({ kind: 'content' })).contentSubtype, 'chart', 'a content target keeps the chosen style')
  check(assert.equal, build(draft('Pipeline', 'auto'), regenTarget({ kind: 'content' })).contentSubtype, 'auto')
  check(assert.equal, build(draft('Pipeline'), regenTarget({ kind: 'content' }), context({ currentSlide: 5 })).visualIndex, 4, 'the visual index is the slide on screen minus one')
  const ctxResearch = context({ research: research({ useWebSearch: true, useDeepResearch: true }) })
  const copy = build(draft('Pipeline'), regenTarget({ kind: 'content' }), ctxResearch)
  check(assert.notEqual, copy.research, ctxResearch.research, 'the research object is copied, not shared')
  check(assert.deepEqual, copy.research, ctxResearch.research)

  // the wire body: hero kinds say they are still a hero, Auto sends no selections, the index is the REAL one
  const body = (kind, subtype, layoutIndex = 2, ctx = context(), instruction = 'Say it') =>
    lib.buildAddSlideV2RefineBody({ ...build(draft(instruction, subtype ?? 'auto'), regenTarget({ kind, slideId: 'slide-xyz', layoutIndex }), ctx), instruction }, layoutIndex)
  check(assert.deepEqual, body('title'), {
    session_id: 'sess-1', presentation_id: 'pres-1', slide_id: 'slide-xyz', slide_index: 2, instruction: 'Say it', theme: THEME,
    selections: { canvas_type: 'H1', content_type: 'hero' },
    research: { use_uploaded_documents: false, use_web_search: true, use_deep_research: false, use_knowledge_graph: false, web_search_max_queries: 3 },
  }, 'a title is regenerated as H1 hero')
  check(assert.deepEqual, body('section').selections, { canvas_type: 'H2', content_type: 'hero' }, 'a section stays a section')
  check(assert.deepEqual, body('closing').selections, { canvas_type: 'H3', content_type: 'hero' }, 'a closing stays a closing')
  check(assert.equal, 'selections' in body('content', 'auto'), false, 'Auto: no selections key, so Director keeps the slide\'s own shape')
  for (const [subtype, selections] of [
    ['text', { canvas_type: 'C1', content_type: 'text_heavy_columns' }],
    ['image_left', { canvas_type: 'I1', content_type: 'text_heavy_columns' }],
    ['image_right', { canvas_type: 'I2', content_type: 'text_heavy_columns' }],
    ['chart', { canvas_type: 'C1', content_type: 'chart', chart_subtype: 'single' }],
    ['infographic', { canvas_type: 'C1', content_type: 'infographic', infographic_subtype: 'vertical_center' }],
    ['table', { canvas_type: 'C1', content_type: 'table', text_subtype: 'table' }],
    ['diagram', { canvas_type: 'C1', content_type: 'diagram_idea_board', diagram_subtype: 'idea_board' }],
  ]) check(assert.deepEqual, body('content', subtype).selections, selections, `content/${subtype} selections are the Add ones`)
  check(assert.equal, body('title', 'chart').selections.content_type, 'hero', 'the chosen style never leaks into a hero request')
  check(assert.equal, body('content', 'auto', 5).slide_index, 5, 'slide_index is the layout index handed in')
  check(assert.equal, lib.buildAddSlideV2RefineBody({ ...req, target: { ...req.target, layoutIndex: 1 } }, 6).slide_index, 6, 'the index argument wins over the stale target index')
  check(assert.equal, lib.buildAddSlideV2RefineBody(req, -3).slide_index, 0, 'never negative')
  const allResearch = context({ research: research({ useUploadedDocuments: true, useWebSearch: true, useDeepResearch: true, useKnowledgeGraph: true }) })
  check(assert.deepEqual, body('content', 'diagram', 2, allResearch).research,
    { use_uploaded_documents: false, use_web_search: false, use_deep_research: false, use_knowledge_graph: false, web_search_max_queries: 3 }, 'an explicit Diagram sends every research flag off')
  check(assert.deepEqual, body('content', 'table', 2, allResearch).research,
    { use_uploaded_documents: true, use_web_search: true, use_deep_research: true, use_knowledge_graph: true, web_search_max_queries: 3 }, 'other styles keep the chat research')
  check(assert.equal, body('title', 'diagram', 2, allResearch).research.use_web_search, true, 'Diagram only forces research off on a content slide')
  check(assert.deepEqual, Object.keys(body('title')).sort(), ['instruction', 'presentation_id', 'research', 'selections', 'session_id', 'slide_id', 'slide_index', 'theme'], 'exactly the Slide panel refine body keys, no UX vocabulary')
  check(assert.equal, lib.buildAddSlideV2RefineBody({ ...req, sessionId: null }, 2), null, 'no session: no body')
  check(assert.equal, lib.buildAddSlideV2RefineBody({ ...req, target: { ...req.target, slideId: '' } }, 2), null, 'no slide id: no body')

  // the Director's deck context is remembered by slide id, only while it lines up with the deck
  const ctxRows = ['a', 'b', 'c'].map(slideId => ({ slideId, title: slideId }))
  const ctxFull = { 0: { canvas_type: 'H1', key_message: 'Hello' }, 1: { canvas_type: 'C1', key_message: 'Body' }, 2: { canvas_type: 'H3', key_message: 'Bye' } }
  const dc = lib.createAddSlideV2GeneratedStore()
  lib.rememberAddSlideV2DeckContext(dc, ctxRows, ctxFull)
  check(assert.deepEqual, [...dc.context.keys()], ['a', 'b', 'c'], 'one entry per slide, by id')
  check(assert.deepEqual, dc.context.get('c'), { canvas_type: 'H3', key_message: 'Bye' })
  check(assert.notEqual, dc.context.get('c'), ctxFull[2], 'a copy: the frame the page keeps may change later')
  lib.rememberAddSlideV2DeckContext(dc, ctxRows, { 0: { canvas_type: 'H2' }, 1: {}, 2: {} })
  check(assert.equal, dc.context.get('a').canvas_type, 'H1', 'the first entry is kept: a later frame never rewrites a slide')
  const dc2 = lib.createAddSlideV2GeneratedStore()
  lib.rememberAddSlideV2DeckContext(dc2, ctxRows, null)
  lib.rememberAddSlideV2DeckContext(dc2, ctxRows, {})
  lib.rememberAddSlideV2DeckContext(dc2, [], ctxFull)
  lib.rememberAddSlideV2DeckContext(dc2, ctxRows, { 0: {}, 1: {} })
  lib.rememberAddSlideV2DeckContext(dc2, ctxRows, { ...ctxFull, 3: {} })
  check(assert.equal, dc2.context.size, 0, 'no frame, no slides, or a frame that does not line up (fewer or more entries): nothing is guessed')
  lib.rememberAddSlideV2DeckContext(dc2, [{ slideId: null, title: 'x' }, { slideId: '  ', title: 'y' }, { slideId: ' z ', title: 'z' }], { 0: {}, 1: {}, 2: { canvas_type: 'H2' } })
  check(assert.deepEqual, [...dc2.context.keys()], ['z'], 'rows with no stable id are skipped, ids are trimmed')
  lib.rememberAddSlideV2DeckContext(dc2, [{ slideId: 'p', title: 'p' }, { slideId: 'q', title: 'q' }], { 0: {}, 5: { canvas_type: 'H1' } })
  check(assert.deepEqual, [dc2.context.has('p'), dc2.context.has('q')], [true, false], 'a position with no entry remembers nothing for its slide')
  const bigCtx = lib.createAddSlideV2GeneratedStore()
  const bigRows = Array.from({ length: 340 }, (_, i) => ({ slideId: `s${i}`, title: '' }))
  lib.rememberAddSlideV2DeckContext(bigCtx, bigRows, Object.fromEntries(bigRows.map((_, i) => [i, { canvas_type: 'C1' }])))
  check(assert.equal, bigCtx.context.size, 300, 'the deck context is capped')
  check(assert.equal, bigCtx.context.has('s0'), false, 'oldest first')
  check(assert.equal, bigCtx.context.has('s339'), true)

  // what the page remembers about generated slides
  const store = lib.createAddSlideV2GeneratedStore()
  check(assert.deepEqual, [store.slides.size, store.context.size, store.completed.size, store.failed.size], [0, 0, 0, 0])
  lib.rememberAddSlideV2Generated(store, { jobId: 'j1', realSlideId: 's-title', request: { instruction: '  Welcome to Acme  ', selections: { canvas_type: 'H1', content_type: 'hero' } } })
  check(assert.deepEqual, store.slides.get('s-title'), { kind: 'title', instruction: 'Welcome to Acme' }, 'kind from the request canvas, trimmed instruction')
  check(assert.equal, store.completed.get('j1'), 's-title', 'the finished job id maps to the new slide')
  lib.rememberAddSlideV2Generated(store, { jobId: 'j2', realSlideId: 's-new', replacedSlideId: 's-title', request: { instruction: 'Welcome to Acme, again' } })
  check(assert.deepEqual, store.slides.get('s-new'), { kind: 'title', instruction: 'Welcome to Acme, again' }, 'no canvas in the request (Auto): the replaced slide\'s kind is kept')
  check(assert.equal, store.slides.has('s-title'), false, 'the replaced slide no longer exists')
  lib.rememberAddSlideV2Generated(store, { jobId: 'j3', realSlideId: 's-sec', request: { instruction: 'Part two', selections: { canvas_type: 'H2' } } })
  check(assert.equal, store.slides.get('s-sec').kind, 'section')
  lib.rememberAddSlideV2Generated(store, { jobId: 'j4', realSlideId: 's-c', request: { instruction: 'Pipeline', selections: { canvas_type: 'C1', content_type: 'chart' } } })
  check(assert.equal, store.slides.get('s-c').kind, 'content')
  lib.rememberAddSlideV2Generated(store, { jobId: 'j5', realSlideId: 's-n', request: null })
  check(assert.deepEqual, store.slides.get('s-n'), { kind: 'content', instruction: '' }, 'no request, nothing replaced: content, no instruction')
  lib.rememberAddSlideV2Generated(store, { jobId: 'j6', realSlideId: 's-long', request: { instruction: 'x'.repeat(5000) } })
  check(assert.equal, store.slides.get('s-long').instruction.length, 2000, 'the remembered instruction is capped')
  const before = store.slides.size
  lib.rememberAddSlideV2Generated(store, { jobId: 'j7', realSlideId: '   ', request: null })
  check(assert.equal, store.slides.size, before, 'an empty slide id records nothing')
  lib.rememberAddSlideV2Generated(store, { jobId: '', realSlideId: 's-nojob', request: null })
  check(assert.equal, store.slides.has('s-nojob'), true)
  check(assert.equal, [...store.completed.values()].includes('s-nojob'), false, 'no job id: no completed entry')
  lib.rememberAddSlideV2Generated(store, { jobId: 'j8', realSlideId: 's-same', replacedSlideId: 's-same', request: null })
  check(assert.equal, store.slides.has('s-same'), true, 'a slide that replaces itself is not forgotten')
  const big = lib.createAddSlideV2GeneratedStore()
  for (let i = 0; i < 230; i++) lib.rememberAddSlideV2Generated(big, { jobId: `job-${i}`, realSlideId: `slide-${i}`, request: null })
  check(assert.equal, big.slides.size, lib.ADD_SLIDE_V2_GENERATED_MAX, 'the slide record is capped')
  check(assert.equal, big.slides.has('slide-0'), false, 'oldest first')
  check(assert.equal, big.slides.has('slide-229'), true)
  check(assert.equal, big.completed.size, 40, 'finished jobs are capped')
  check(assert.equal, big.completed.has('job-229'), true)
  check(assert.equal, big.completed.has('job-0'), false)
  lib.rememberAddSlideV2Failed(big, 'jf', '  Research timed out  ')
  check(assert.equal, big.failed.get('jf'), 'Research timed out', 'a failure keeps its trimmed reason')
  lib.rememberAddSlideV2Failed(big, 'jg', undefined)
  check(assert.equal, big.failed.get('jg'), 'The slide could not be regenerated.', 'and never an empty one')
  lib.rememberAddSlideV2Failed(big, 'jh', 'y'.repeat(900))
  check(assert.equal, big.failed.get('jh').length, 300, 'the reason is capped')
  lib.rememberAddSlideV2Failed(big, '', 'nope')
  check(assert.equal, big.failed.has(''), false, 'no job id: nothing recorded')
  for (let i = 0; i < 60; i++) lib.rememberAddSlideV2Failed(big, `fail-${i}`, 'x')
  check(assert.equal, big.failed.size, 40, 'failures are capped')
}

async function regenerateSubmitSuite(sub, lib) {
  const accepted = (jobId, over = {}) => ({ status: 'accepted', job_id: jobId, kind: 'refine', target_index: 2, target_slide_id: 's3', session_id: 'sess-1', presentation_id: 'pres-1', ...over })
  const on = REGEN_ON(lib)
  function harness(over = {}) {
    const calls = { fetch: [], accepted: [], meta: [], order: [] }
    const deps = {
      timeoutMs: over.timeoutMs,
      fetchImpl: async (url, init) => {
        calls.order.push('fetch'); calls.fetch.push({ url, init, body: JSON.parse(init.body) })
        if (over.fetchThrows) throw new Error('socket hang up')
        if (over.hang) await new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
        return { ok: over.ok ?? true, json: async () => over.reply ?? accepted('job-1') }
      },
      newJobId: () => 'job-1',
      captureSessionOwner: () => { calls.order.push('capture'); return () => over.sessionStillCurrent ?? true },
      isSessionAdmitted: () => { calls.order.push('admit'); return over.admitted ?? true },
      selection: () => ({ visualIndex: 2, realSlideCount: 5, jobs: {}, ...(over.selection ?? {}) }),
      onAccepted: (job, meta) => { calls.order.push('accepted'); calls.accepted.push(job); calls.meta.push(meta) },
    }
    return { deps, calls }
  }
  const request = (over = {}, targetOver = {}) => ({
    ...lib.buildAddSlideV2RegenerateRequest({ contentSubtype: 'auto', text: 'Welcome to Acme' }, regenTarget(targetOver), context(), on), ...over,
  })
  const run = async (req, over) => {
    const h = harness(over); let timer
    const guard = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('regenerate never settled')), 2500) })
    try { return { result: await Promise.race([sub.submitAddSlideV2Regenerate(req, h.deps), guard]), calls: h.calls } } finally { clearTimeout(timer) }
  }
  const refused = (r, text) => {
    check(assert.equal, r.result.ok, false); if (text) check(assert.match, r.result.message, text)
    check(assert.equal, r.calls.accepted.length, 0, 'nothing is registered')
  }
  const jobAt = (target, over = {}) => ({ kind: 'compose', status: 'building', target_layout_index: target, ...over })

  // swap path: one POST to the existing Refine route, registered as the page's refine job
  const ok = await run(request())
  check(assert.deepEqual, ok.result, { ok: true, jobId: 'job-1' }, 'the job id comes back so the panel can follow it')
  check(assert.equal, ok.calls.fetch.length, 1)
  check(assert.equal, ok.calls.fetch[0].url, '/api/slides/refine', 'the existing Refine route, no new endpoint')
  check(assert.equal, sub.ADD_SLIDE_V2_REFINE_ENDPOINT, '/api/slides/refine')
  check(assert.equal, ok.calls.fetch[0].init.method, 'POST')
  const wire = {
    session_id: 'sess-1', presentation_id: 'pres-1', slide_id: 's3', slide_index: 2, instruction: 'Welcome to Acme', theme: THEME,
    selections: { canvas_type: 'H1', content_type: 'hero' },
    research: { use_uploaded_documents: false, use_web_search: true, use_deep_research: false, use_knowledge_graph: false, web_search_max_queries: 3 },
    job_id: 'job-1', async: true, assume_on_missing: true,
  }
  check(assert.deepEqual, ok.calls.fetch[0].body, wire, 'a title regenerates as an async H1 hero refine of its own slide id')
  check(assert.equal, ok.calls.accepted.length, 1)
  check(assert.equal, ok.calls.accepted[0].kind, 'refine', 'registered as a refine job: the page overlays the original and swaps on ready')
  check(assert.equal, ok.calls.accepted[0].target_slide_id, 's3')
  check(assert.equal, ok.calls.accepted[0].title, 'Welcome to Acme')
  check(assert.deepEqual, ok.calls.accepted[0].request, wire, 'the page registers the wire request')
  check(assert.deepEqual, ok.calls.meta, [{ submitVisualIndex: 2 }])
  check(assert.deepEqual, ok.calls.order, ['capture', 'fetch', 'admit', 'accepted'], 'owner captured first; admission right before registration')
  check(assert.equal, (await run(request({ instruction: 'x'.repeat(100) }))).calls.accepted[0].title.length, 72, 'the title is the first 72 characters')
  const noSlideInReply = await run(request(), { reply: accepted('job-1', { target_slide_id: null }) })
  check(assert.equal, noSlideInReply.calls.accepted[0].target_slide_id, 's3', 'the reply names no slide: the requested slide id is used')
  const otherSlideInReply = await run(request(), { reply: accepted('job-1', { target_slide_id: 'director-id' }) })
  check(assert.equal, otherSlideInReply.calls.accepted[0].target_slide_id, 'director-id', 'the backend\'s resolved slide id wins')
  const noKind = await run(request(), { reply: accepted('job-1', { kind: undefined }) })
  check(assert.equal, noKind.calls.accepted[0].kind, 'refine', 'kind is refine even when the reply omits it')

  // every hero kind keeps its hero: explicit selections on the wire
  for (const [kind, selections] of [['title', { canvas_type: 'H1', content_type: 'hero' }], ['section', { canvas_type: 'H2', content_type: 'hero' }], ['closing', { canvas_type: 'H3', content_type: 'hero' }]]) {
    const r = await run(request({}, { kind }))
    check(assert.deepEqual, r.calls.fetch[0].body.selections, selections, `${kind}: restyle-only in Director v1, so the request says hero`)
  }
  const autoContent = await run(request({}, { kind: 'content' }))
  check(assert.equal, 'selections' in autoContent.calls.fetch[0].body, false, 'a content slide on Auto sends no selections')
  const chartContent = await run(request({ contentSubtype: 'chart' }, { kind: 'content' }))
  check(assert.deepEqual, chartContent.calls.fetch[0].body.selections, { canvas_type: 'C1', content_type: 'chart', chart_subtype: 'single' })

  // index stability with placeholders: [A,B,C,D,E] + a pending placeholder before B; slide C is visual 3, real index 2
  const withPlaceholder = { selection: { visualIndex: 3, realSlideCount: 5, jobs: { a: jobAt(1) } } }
  const stable = await run(request({ visualIndex: 3 }, { layoutIndex: 2, slideNumber: 4 }), withPlaceholder)
  check(assert.equal, stable.result.ok, true)
  check(assert.equal, stable.calls.fetch[0].body.slide_index, 2, 'the wire index is the REAL Layout index (2), not the visual one (3)')
  check(assert.equal, stable.calls.fetch[0].body.slide_id, 's3', 'and the slide is addressed by its id')
  check(assert.deepEqual, stable.calls.meta, [{ submitVisualIndex: 3 }], 'the visual slide the user was on')
  const twoBefore = await run(request({ visualIndex: 4 }, { layoutIndex: 2, slideNumber: 5 }), { selection: { visualIndex: 4, realSlideCount: 5, jobs: { a: jobAt(1), b: jobAt(0, { status: 'error' }) } } })
  check(assert.equal, twoBefore.calls.fetch[0].body.slide_index, 2, 'pending and failed placeholders both occupy a visual slot')
  const afterSelection = await run(request({ visualIndex: 2 }, { layoutIndex: 2 }), { selection: { visualIndex: 2, realSlideCount: 5, jobs: { a: jobAt(4) } } })
  check(assert.equal, afterSelection.calls.fetch[0].body.slide_index, 2, 'a placeholder after the slide moves nothing')
  const finished = await run(request({ visualIndex: 2 }, { layoutIndex: 2 }), { selection: { visualIndex: 2, realSlideCount: 5, jobs: { a: jobAt(1, { status: 'built' }) } } })
  check(assert.equal, finished.calls.fetch[0].body.slide_index, 2, 'a finished job is no placeholder')

  // refusals: nothing is posted and nothing is registered
  const moved = await run(request({ visualIndex: 2 }), { selection: { visualIndex: 4 } })
  refused(moved, /selected slide changed/); check(assert.equal, moved.calls.fetch.length, 0)
  const onPlaceholder = await run(request({ visualIndex: 1 }, { layoutIndex: 1 }), { selection: { visualIndex: 1, realSlideCount: 5, jobs: { a: jobAt(1) } } })
  refused(onPlaceholder, /finished slide to regenerate/); check(assert.equal, onPlaceholder.calls.fetch.length, 0, 'a placeholder on screen cannot be regenerated')
  const onFailed = await run(request({ visualIndex: 1 }, { layoutIndex: 1 }), { selection: { visualIndex: 1, realSlideCount: 5, jobs: { a: jobAt(1, { status: 'error' }) } } })
  refused(onFailed, /finished slide to regenerate/)
  const shifted = await run(request({ visualIndex: 2 }, { layoutIndex: 2 }), { selection: { visualIndex: 2, realSlideCount: 5, jobs: { a: jobAt(0) } } })
  refused(shifted, /deck changed/); check(assert.equal, shifted.calls.fetch.length, 0, 'a placeholder arrived before the slide: it is no longer index 2')
  const dupe = await run(request(), { selection: { jobs: { r1: { kind: 'refine', status: 'building', target_slide_id: 's3', target_layout_index: 2 } } } })
  refused(dupe, /already being regenerated/); check(assert.equal, dupe.calls.fetch.length, 0, 'one refine per slide')
  const dupeByIndex = await run(request(), { selection: { jobs: { r1: { kind: 'refine', status: 'building', target_layout_index: 2 } } } })
  refused(dupeByIndex, /already being regenerated/)
  // a pending COMPOSE placeholder aimed at this very slot is not a refine of the slide: it does not block
  const placeholderAtSlot = await run(request({ visualIndex: 4 }, { layoutIndex: 3, slideNumber: 5, slideId: 's4' }), { selection: { visualIndex: 4, realSlideCount: 5, jobs: { a: jobAt(3) } } })
  check(assert.equal, placeholderAtSlot.result.ok, true, 'a compose placeholder before the slide is no refine of it')
  check(assert.equal, placeholderAtSlot.calls.fetch[0].body.slide_index, 3)
  const otherSlideBusy = await run(request(), { selection: { jobs: { r1: { kind: 'refine', status: 'building', target_slide_id: 's9', target_layout_index: 4 } } } })
  check(assert.equal, otherSlideBusy.result.ok, true, 'a refine of another slide does not block')
  const failedRefine = await run(request(), { selection: { jobs: { r1: { kind: 'refine', status: 'error', target_slide_id: 's3', target_layout_index: 2 } } } })
  check(assert.equal, failedRefine.result.ok, true, 'a finished or failed refine does not block a new one')
  const noDeck = await run(request({ presentationId: null }))
  refused(noDeck, /No active presentation/); check(assert.equal, noDeck.calls.fetch.length, 0)
  const noSession = await run(request({ sessionId: null }))
  refused(noSession, /can't be regenerated yet/); check(assert.equal, noSession.calls.fetch.length, 0)

  // failure: the original is untouched (nothing registered, so the page never overlays or swaps)
  const http = await run(request(), { ok: false, reply: { detail: 'Slide refiner is disabled' } })
  refused(http, /Slide refiner is disabled/)
  const httpErrors = await run(request(), { ok: false, reply: { errors: ['Target slide not found'] } })
  refused(httpErrors, /Target slide not found/)
  const needsInput = await run(request(), { reply: { status: 'needs_input', questions: [{ slot: 'x', ask: 'y' }] } })
  refused(needsInput, /Follow-up questions are coming in v2\.1/)
  const wrongKind = await run(request(), { reply: accepted('job-1', { kind: 'compose' }) })
  refused(wrongKind, /Unexpected reply/)
  const wrongJob = await run(request(), { reply: accepted('job-other') })
  refused(wrongJob, /Unexpected reply/)
  const wrongSession = await run(request(), { reply: accepted('job-1', { session_id: 'sess-9' }) })
  refused(wrongSession, /Unexpected reply/)
  const wrongDeck = await run(request(), { reply: accepted('job-1', { presentation_id: 'pres-9' }) })
  refused(wrongDeck, /Unexpected reply/)
  const lost = await run(request(), { fetchThrows: true })
  refused(lost, /Couldn't confirm/)
  const timeout = await run(request(), { hang: true, timeoutMs: 20 })
  refused(timeout, /didn't answer in time/)
  const sessionChanged = await run(request(), { sessionStillCurrent: false })
  refused(sessionChanged, /session changed/)
  const notAdmitted = await run(request(), { admitted: false })
  refused(notAdmitted, /session changed/)
  check(assert.equal, (await run(request(), { ok: false, reply: { detail: 'Slide refiner is disabled' } })).calls.fetch.length, 1, 'a failed POST is never retried')

  // the hooks the page builds
  const store = lib.createAddSlideV2GeneratedStore()
  const jobs = {}
  let ctx = null
  const h = harness()
  const hooks = sub.createAddSlideV2RegenerateHooks({
    ...h.deps, regenerateEnabled: true, store, contextByIndex: () => ctx, jobState: id => jobs[id],
    selection: () => ({ visualIndex: 2, realSlideCount: 5, jobs: { ...jobs } }),
  })
  check(assert.equal, typeof hooks.submit, 'function')
  check(assert.equal, sub.createAddSlideV2RegenerateHooks({ ...h.deps, regenerateEnabled: false, store, contextByIndex: () => null, jobState: () => undefined }).submit, undefined, 'no refiner / composer / async: no submit, the section is shown disabled')
  const rows = ['s1', 's2', 's3', 's4', 's5'].map((id, i) => ({ slideId: id, title: `Slide ${i + 1}` }))
  check(assert.equal, hooks.resolveTarget(2, rows), null, 'nothing known about the slide: not a target')
  ctx = { 0: { canvas_type: 'H1', key_message: 'Welcome' }, 1: {}, 2: { canvas_type: 'H2', key_message: '  Part one  ' }, 3: {}, 4: {} }
  const fromContext = hooks.resolveTarget(2, rows)
  check(assert.deepEqual, fromContext, { slideId: 's3', layoutIndex: 2, slideNumber: 3, title: 'Slide 3', kind: 'section', instruction: 'Part one', source: 'context', busy: false })
  // the deck changes after it was built: an insert shifts positions, but the context was remembered by slide id
  const inserted = [rows[0], { slideId: 'manual-1', title: 'Manual' }, ...rows.slice(1)]
  const afterInsert = hooks.resolveTarget(3, inserted)
  check(assert.deepEqual, [afterInsert.slideId, afterInsert.layoutIndex, afterInsert.kind, afterInsert.source, afterInsert.instruction], ['s3', 3, 'section', 'context', 'Part one'], 'an insert shifts positions, not the context: the slide id still carries it')
  check(assert.equal, hooks.resolveTarget(1, inserted), null, 'and the inserted manual slide is not a target')
  check(assert.equal, hooks.resolveTarget(0, inserted).kind, 'title', 'nor does it disturb the title')
  lib.rememberAddSlideV2Generated(store, { jobId: 'jx', realSlideId: 's3', request: { instruction: 'Part one, rebuilt', selections: { canvas_type: 'H2' } } })
  check(assert.equal, hooks.resolveTarget(2, rows).source, 'compose', 'the page\'s own record wins over the deck context')
  check(assert.equal, hooks.resolveTarget(2, rows).instruction, 'Part one, rebuilt')

  // jobStatus: tracked job = building (the original is still the slide on screen); then the page's records decide
  check(assert.equal, hooks.jobStatus('unknown'), null, 'a job the page never heard of')
  jobs.j1 = { status: 'building' }
  check(assert.deepEqual, hooks.jobStatus('j1'), { status: 'building' })
  store.completed.set('j1', 'new-1')
  check(assert.deepEqual, hooks.jobStatus('j1'), { status: 'building' }, 'finished but still tracked: the swap is not done, so still building')
  delete jobs.j1
  check(assert.deepEqual, hooks.jobStatus('j1'), { status: 'ready', newSlideId: 'new-1' }, 'gone from the page and recorded: ready')
  lib.rememberAddSlideV2Failed(store, 'j2', 'Research timed out')
  check(assert.deepEqual, hooks.jobStatus('j2'), { status: 'failed', message: 'Research timed out' }, 'a failed refine leaves the job map; the record says why')
  jobs.j3 = { status: 'error', errors: ['one', '', 'two'] }
  check(assert.deepEqual, hooks.jobStatus('j3'), { status: 'failed', message: 'one; two' }, 'a job that stays in the map as an error')
  jobs.j5 = { status: 'queued' }
  check(assert.deepEqual, hooks.jobStatus('j5'), { status: 'building' }, 'any job the page still tracks is still running, whatever its status word')
  jobs.j4 = { status: 'error' }
  check(assert.deepEqual, hooks.jobStatus('j4'), { status: 'failed', message: 'The slide could not be regenerated.' })

  // resolveAddSlideV2RegenerateTarget on its own
  const resolve = (over = {}) => sub.resolveAddSlideV2RegenerateTarget({
    visualIndex: 2, slides: rows, jobs: {}, store: lib.createAddSlideV2GeneratedStore(), ...over,
  })
  const known = lib.createAddSlideV2GeneratedStore()
  lib.rememberAddSlideV2Generated(known, { jobId: 'k', realSlideId: 's3', request: { instruction: 'Quarterly revenue', selections: { canvas_type: 'C1', content_type: 'chart' } } })
  check(assert.equal, resolve(), null, 'no record, no context: a manual slide is not a target')
  check(assert.deepEqual, resolve({ store: known }), { slideId: 's3', layoutIndex: 2, slideNumber: 3, title: 'Slide 3', kind: 'content', instruction: 'Quarterly revenue', source: 'compose', busy: false })
  check(assert.equal, resolve({ store: known, visualIndex: 3 }), null, 'only the slide with the record')
  check(assert.equal, resolve({ store: known, slides: [] }), null, 'no slides')
  check(assert.equal, resolve({ store: known, visualIndex: 9 }), null, 'a visual index past the deck')
  check(assert.equal, resolve({ store: known, visualIndex: -1 }), null)
  check(assert.equal, resolve({ store: known, slides: rows.map((r, i) => (i === 2 ? { ...r, slideId: null } : r)) }), null, 'no stable slide id: not a target')
  check(assert.equal, resolve({ store: known, slides: rows.map((r, i) => (i === 2 ? { ...r, slideId: '   ' } : r)) }), null, 'a blank slide id too')
  // the deck context, remembered by slide id while it lined up with the deck
  const withCtx = (ctxByIndex, slides = rows) => { const st = lib.createAddSlideV2GeneratedStore(); lib.rememberAddSlideV2DeckContext(st, slides, ctxByIndex); return st }
  const blankIdRows = rows.map((r, i) => (i === 2 ? { ...r, slideId: '   ' } : r))
  check(assert.equal, resolve({ store: withCtx({ 0: {}, 1: {}, 2: { canvas_type: 'H1' }, 3: {}, 4: {} }, blankIdRows), slides: blankIdRows }), null, 'a blank id is no id, even when the deck context knows the slide')
  check(assert.equal, resolve({ store: known, slides: rows.map((r, i) => (i === 2 ? { ...r, slideId: ' s3 ' } : r)) }).slideId, 's3', 'the id is trimmed before it is looked up')
  const fullContext = { 0: { canvas_type: 'H1' }, 1: {}, 2: { canvas_type: 'H3' }, 3: {}, 4: {} }
  check(assert.equal, resolve({ store: withCtx(fullContext) }).kind, 'closing', 'H3 on the Director context = a closing slide')
  check(assert.equal, resolve({ store: withCtx({ ...fullContext, 2: { canvas_type: 'C4' } }) }).kind, 'content')
  check(assert.equal, resolve({ store: withCtx({ 0: { canvas_type: 'H1' }, 1: {}, 2: { canvas_type: 'H3' }, 3: {} }) }), null, 'the context never matched the deck (4 entries, 5 slides): nothing remembered')
  check(assert.equal, resolve({ store: withCtx({ ...fullContext, 5: {} }) }), null, 'more entries than slides: nothing remembered')
  check(assert.equal, resolve({ store: withCtx({ 0: {}, 1: {}, 3: {}, 4: {}, 7: {} }) }), null, 'no entry for this slide')
  check(assert.equal, resolve({ store: (() => { const both = withCtx({ ...fullContext, 2: { canvas_type: 'H1' } }); lib.rememberAddSlideV2Generated(both, { jobId: 'k', realSlideId: 's3', request: { instruction: 'Quarterly revenue', selections: { canvas_type: 'C1', content_type: 'chart' } } }); return both })() }).kind, 'content', 'the page\'s record beats the context')
  check(assert.equal, resolve({ store: withCtx({ ...fullContext, 2: { canvas_type: 'H1', key_message: 7 } }) }).instruction, '', 'a non-text key message is no instruction')
  // positions shift, ids do not: insert, delete and reorder after the context was remembered
  const remembered = withCtx(fullContext)
  const insertedRows = [rows[0], { slideId: 'new-1', title: 'New' }, ...rows.slice(1)]
  check(assert.deepEqual, [resolve({ store: remembered, slides: insertedRows, visualIndex: 3 }).slideId, resolve({ store: remembered, slides: insertedRows, visualIndex: 3 }).kind], ['s3', 'closing'], 'after an insert the closing slide is found at its new position')
  check(assert.equal, resolve({ store: remembered, slides: insertedRows, visualIndex: 1 }), null, 'the inserted slide has no context')
  const reversed = [...rows].reverse()
  check(assert.equal, resolve({ store: remembered, slides: reversed, visualIndex: 2 }).kind, 'closing', 'after a reorder the id still carries it (s3 is still in the middle)')
  check(assert.equal, resolve({ store: remembered, slides: rows.filter(r => r.slideId !== 's1'), visualIndex: 1 }).kind, 'closing', 'after a delete')

  // placeholders: the target is the real slide, whatever sits before it on the rail
  const phBefore = resolve({ store: known, visualIndex: 3, jobs: { a: jobAt(1) } })
  check(assert.deepEqual, [phBefore.layoutIndex, phBefore.slideNumber, phBefore.slideId], [2, 4, 's3'], '[A,B,C,D,E] + placeholder before B: visual 3 is slide C at real index 2')
  check(assert.equal, resolve({ store: known, visualIndex: 1, jobs: { a: jobAt(1) } }), null, 'a pending placeholder on screen is not a target')
  check(assert.equal, resolve({ store: known, visualIndex: 1, jobs: { a: jobAt(1, { status: 'error' }) } }), null, 'nor a failed one')
  check(assert.equal, resolve({ store: known, visualIndex: 2, jobs: { a: jobAt(4) } }).layoutIndex, 2, 'a placeholder after it moves nothing')
  check(assert.equal, resolve({ store: known, visualIndex: 4, jobs: { a: jobAt(1), b: jobAt(0) } }).layoutIndex, 2, 'two placeholders before it')
  check(assert.equal, resolve({ store: known, jobs: { a: jobAt(1, { kind: 'refine' }) } }).layoutIndex, 2, 'a refine overlay is no placeholder: the index does not shift')

  // busy: a running refine on this slide, matched by id, else by index; not a failed one, not another slide's
  const refineJob = (over = {}) => ({ kind: 'refine', status: 'building', ...over })
  check(assert.equal, resolve({ store: known, jobs: { r: refineJob({ target_slide_id: 's3' }) } }).busy, true, 'by slide id')
  check(assert.equal, resolve({ store: known, jobs: { r: refineJob({ target_layout_index: 2 }) } }).busy, true, 'by layout index when the job has no slide id')
  check(assert.equal, resolve({ store: known, jobs: { r: refineJob({ targetLayoutIndex: 2 }) } }).busy, true)
  check(assert.equal, resolve({ store: known, jobs: { r: refineJob({ targetIndex: 2 }) } }).busy, true)
  check(assert.equal, resolve({ store: known, jobs: { r: refineJob({ target_slide_id: 's9', target_layout_index: 2 }) } }).busy, false, 'an id for another slide wins over a matching index')
  check(assert.equal, resolve({ store: known, jobs: { r: refineJob({ target_slide_id: 's3', status: 'error' }) } }).busy, false, 'a failed refine does not block')
  check(assert.equal, resolve({ store: known, jobs: { r: { kind: 'compose', status: 'built', target_slide_id: 's3', target_layout_index: 2 } } }).busy, false, 'a compose job is not a refine')
  const known4 = lib.createAddSlideV2GeneratedStore()
  lib.rememberAddSlideV2Generated(known4, { jobId: 'k4', realSlideId: 's4', request: { instruction: 'Fourth', selections: { canvas_type: 'C1' } } })
  const aimedHere = resolve({ store: known4, visualIndex: 4, jobs: { a: jobAt(3) } })
  check(assert.deepEqual, [aimedHere.layoutIndex, aimedHere.busy], [3, false], 'a compose placeholder aimed at this slot shifts the slide, it does not make it busy')
}

async function regeneratePanelSuite(panelSource, lib) {
  const mem = () => { const map = new Map(); return { map, getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => { map.set(k, String(v)) }, removeItem: k => { map.delete(k) } } }
  const on = REGEN_ON(lib)
  const calls = []
  const regenProps = (over = {}) => ({ target: regenTarget(), submit: async request => { calls.push(request); return { ok: true, jobId: 'job-9' } }, jobStatus: () => null, ...over })
  const base = (over = {}) => ({ context: context(), storage: mem(), onInsertBlank() {}, onClose() {}, submit: async () => ({ ok: true }), options: on, regenerate: regenProps(), ...over })
  const mount = over => mountPanel(panelSource, lib, base(over))
  const modeAdd = rt => rt.byClass('asv2-mode')
  const modeRegen = rt => rt.byClass('asv2-mode asv2-mode-regenerate')
  const regenButton = rt => rt.maybeClass('asv2-generate asv2-regenerate')
  const title = rt => rt.one(n => n.type === 'h3').props.children
  const goRegen = rt => { modeRegen(rt).props.onClick(); rt.render() }
  const textbox = rt => rt.one(n => n.type === 'textarea')
  const note = rt => rt.all(n => String(n.props?.className).includes('asv2-regenerate-note'))[0] ?? null
  const blockerOf = rt => rt.maybeClass('asv2-blocker')?.props['data-blocker'] ?? null
  const failedBanner = rt => rt.maybeClass('asv2-error asv2-regen-failed')
  const textOf = node => [node.props.children].flat(Infinity).filter(x => typeof x === 'string').join('')

  // flag off / option off / not a generated slide: no section at all, the Add form is untouched
  let rt = mount({ regenerate: undefined })
  check(assert.equal, rt.maybeClass('asv2-modes'), null, 'no regenerate settings: no switch')
  check(assert.equal, title(rt), 'Add slide')
  check(assert.notEqual, rt.maybeClass('asv2-generate'), null, 'the Add form is there')
  check(assert.equal, regenButton(rt), null)
  const offHtml = mount({ options: lib.resolveAddSlideV2Options(undefined, 'all') })
  check(assert.equal, offHtml.maybeClass('asv2-modes'), null, 'the regenerate option off hides the section even when the page configures it')
  check(assert.equal, mount({ regenerate: regenProps({ target: null }) }).maybeClass('asv2-modes'), null, 'not a generated slide: no switch')

  // a generated title: the switch appears, Add stays the default
  rt = mount()
  check(assert.notEqual, rt.maybeClass('asv2-modes'), null, 'a generated slide on screen: the switch')
  check(assert.equal, modeAdd(rt).props['aria-pressed'], true, 'Add is the default')
  check(assert.equal, modeRegen(rt).props['aria-pressed'], false)
  check(assert.equal, title(rt), 'Add slide')
  check(assert.equal, rt.maybeClass('asv2-kind'), null, 'the Add form shows no kept-type line')
  goRegen(rt)
  check(assert.equal, modeRegen(rt).props['aria-pressed'], true)
  check(assert.equal, modeAdd(rt).props['aria-pressed'], false)
  check(assert.equal, title(rt), 'Regenerate slide')
  check(assert.equal, textbox(rt).props.value, 'Welcome to Acme Corp', 'the box is pre-filled from the original instruction')
  check(assert.equal, rt.all(n => n.type === 'textarea').length, 1, 'still ONE box')
  check(assert.equal, rt.maybeClass('asv2-kind').props['data-kind'], 'title')
  check(assert.match, textOf(rt.maybeClass('asv2-kind')), /Slide type.*:\s*a hero slide stays a hero/s)
  check(assert.equal, rt.radio('title'), undefined, 'the type is the slide\'s own: no type picker')
  check(assert.equal, rt.radio('auto'), undefined, 'a hero has no content style')
  check(assert.equal, rt.maybeClass('asv2-generate'), null, 'no Generate (add) button')
  check(assert.equal, rt.maybeClass('asv2-footer'), null, 'Blank slide and the catalog add slides: hidden here')
  check(assert.equal, rt.maybeClass('asv2-blank'), null)
  check(assert.equal, note(rt).props.children, 'Rebuilds slide 3 in place. The current slide stays until the new one is ready.', 'the context bar says what it will do, and that the original stays (nothing is running yet)')
  check(assert.notEqual, regenButton(rt), null)
  check(assert.equal, regenButton(rt).props.disabled, false, 'a filled-in title can be regenerated')
  check(assert.notEqual, rt.maybeClass('asv2-chat'), null, 'the chat settings stay (read-only)')
  check(assert.equal, rt.focused.filter(x => x === 'textarea').length >= 2, true, 'switching to Regenerate lands in the box')
  modeAdd(rt).props.onClick(); rt.render()
  check(assert.equal, title(rt), 'Add slide', 'and back')
  check(assert.notEqual, rt.maybeClass('asv2-generate'), null)

  // the swap: submit -> building (the original stays) -> ready
  calls.length = 0
  rt = mount(); goRegen(rt)
  await rt.click('asv2-generate asv2-regenerate')
  check(assert.equal, calls.length, 1, 'one request')
  check(assert.deepEqual, { ...calls[0], research: undefined }, {
    mode: 'regenerate', target: regenTarget(), contentSubtype: null, instruction: 'Welcome to Acme Corp', visualIndex: 2,
    sessionId: 'sess-1', presentationId: 'pres-1', research: undefined, theme: THEME,
  }, 'the request carries the target, the text and the slide on screen')
  const buildingLine = rt.maybeClass('asv2-queued asv2-regenerating')
  check(assert.notEqual, buildingLine, null, 'after the page accepts the job: building')
  check(assert.equal, textOf(buildingLine), 'Regenerating slide 3. The current slide stays until the new one is ready.')
  check(assert.equal, regenButton(rt).props.disabled, true, 'one run at a time')
  check(assert.equal, textbox(rt).props.disabled, true, 'the box is locked while it runs')
  check(assert.equal, rt.error(), null)
  rt.setProps({ regenerate: regenProps({ jobStatus: () => ({ status: 'building' }), target: regenTarget({ busy: true }) }) })
  check(assert.notEqual, rt.maybeClass('asv2-queued asv2-regenerating'), null, 'still building while the page says so')
  check(assert.equal, blockerOf(rt), null, 'our own run is on screen, so no second "already being regenerated" hint (the page marks the slide busy while it runs)')
  rt.setProps({ regenerate: regenProps({ jobStatus: () => ({ status: 'building' }) }) })
  rt.setProps({ regenerate: regenProps({ jobStatus: id => (id === 'job-9' ? { status: 'ready', newSlideId: 's-new' } : null) }) })
  check(assert.equal, rt.maybeClass('asv2-queued asv2-regenerating'), null, 'ready: the building line is gone')
  const readyLine = rt.maybeClass('asv2-queued asv2-regenerated')
  check(assert.notEqual, readyLine, null, 'swapped in')
  check(assert.equal, textOf(readyLine), 'Regenerated. The new slide replaced slide 3. ')
  check(assert.equal, regenButton(rt).props.disabled, false, 'free to run again')
  check(assert.equal, textbox(rt).props.disabled, false)
  rt.byClass('asv2-discard').props.onClick(); rt.render()
  check(assert.equal, rt.maybeClass('asv2-queued asv2-regenerated'), null, 'dismissed')

  // while it runs, Cmd+Enter cannot start a second one; a "ready" that names the same slide is not a swap
  calls.length = 0
  rt = mount(); goRegen(rt)
  await rt.click('asv2-generate asv2-regenerate')
  textbox(rt).props.onKeyDown({ key: 'Enter', metaKey: true, preventDefault() {} })
  await new Promise(r => setTimeout(r, 0)); rt.render()
  check(assert.equal, calls.length, 1, 'one run at a time, from the keyboard too')
  rt.setProps({ regenerate: regenProps({ jobStatus: () => ({ status: 'ready', newSlideId: 's3' }) }) })
  check(assert.notEqual, rt.maybeClass('asv2-queued asv2-regenerating'), null, 'the same slide id back is no swap: still waiting')
  check(assert.equal, rt.maybeClass('asv2-queued asv2-regenerated'), null)

  // the run names ITS slide even after another one is selected; that slide's own hints still show
  rt = mount(); goRegen(rt)
  await rt.click('asv2-generate asv2-regenerate')
  rt.setProps({ regenerate: regenProps({ target: regenTarget({ slideId: 's4', layoutIndex: 3, slideNumber: 4, instruction: 'Short' }), jobStatus: () => ({ status: 'building' }) }) })
  check(assert.equal, textOf(rt.maybeClass('asv2-queued asv2-regenerating')), 'Regenerating slide 3. The current slide stays until the new one is ready.', 'the run is about slide 3, not the slide now on screen')
  check(assert.equal, blockerOf(rt), 'too-short', 'and the slide now shown keeps its own hint')
  check(assert.equal, regenButton(rt).props.disabled, true, 'one run at a time, whatever is selected')
  rt.setProps({ regenerate: regenProps({ target: regenTarget({ slideId: 's4', layoutIndex: 3, slideNumber: 4, instruction: 'Short' }), jobStatus: id => (id === 'job-9' ? { status: 'ready', newSlideId: 's-new' } : null) }) })
  check(assert.equal, rt.maybeClass('asv2-queued asv2-regenerated'), null, 'a finished run\'s result does not follow the user to another slide')
  rt.setProps({ regenerate: regenProps({ jobStatus: id => (id === 'job-9' ? { status: 'ready', newSlideId: 's-new' } : null) }) })
  check(assert.equal, textOf(rt.maybeClass('asv2-queued asv2-regenerated')), 'Regenerated. The new slide replaced slide 3. ', 'and it is there when the user is back on the slide it was about')
  // the same for a failure
  rt = mount(); goRegen(rt)
  await rt.click('asv2-generate asv2-regenerate')
  rt.setProps({ regenerate: regenProps({ jobStatus: () => ({ status: 'failed', message: 'Research timed out' }) }) })
  check(assert.notEqual, failedBanner(rt), null)
  rt.setProps({ regenerate: regenProps({ target: regenTarget({ slideId: 's4', layoutIndex: 3, slideNumber: 4, instruction: 'Other slide text' }), jobStatus: () => ({ status: 'failed', message: 'Research timed out' }) }) })
  check(assert.equal, failedBanner(rt), null, 'a failure is not shown on another slide')
  rt.setProps({ regenerate: regenProps({ jobStatus: () => ({ status: 'failed', message: 'Research timed out' }) }) })
  check(assert.notEqual, failedBanner(rt), null, 'but it is there on the slide it was about')

  // a job id that is not ours never finishes our run
  rt = mount({ regenerate: regenProps({ jobStatus: id => (id === 'someone-else' ? { status: 'ready', newSlideId: 'x' } : null) }) }); goRegen(rt)
  await rt.click('asv2-generate asv2-regenerate')
  check(assert.notEqual, rt.maybeClass('asv2-queued asv2-regenerating'), null, 'only our job id counts')

  // failure keeps the original and shows the error
  calls.length = 0
  rt = mount(); goRegen(rt)
  await rt.click('asv2-generate asv2-regenerate')
  rt.setProps({ regenerate: regenProps({ jobStatus: () => ({ status: 'failed', message: 'Research timed out' }) }) })
  check(assert.equal, rt.maybeClass('asv2-queued asv2-regenerating'), null)
  check(assert.notEqual, failedBanner(rt), null, 'the failure is shown')
  check(assert.equal, textOf(failedBanner(rt)), 'Research timed out. The original slide was kept. ', 'with the reason as a sentence, and that the original was kept')
  check(assert.equal, failedBanner(rt).props.role, 'alert')
  check(assert.equal, regenButton(rt).props.disabled, false, 'the user can try again')
  check(assert.equal, textbox(rt).props.value, 'Welcome to Acme Corp', 'the text is kept')
  rt.setProps({ regenerate: regenProps() })
  rt.byClass('asv2-discard').props.onClick(); rt.render()
  check(assert.equal, failedBanner(rt), null, 'dismissed')
  await rt.click('asv2-generate asv2-regenerate')
  check(assert.equal, calls.length, 2, 'a retry is a new request')
  rt.setProps({ regenerate: regenProps({ jobStatus: () => ({ status: 'failed', message: 'Research timed out.' }) }) })
  check(assert.equal, textOf(failedBanner(rt)), 'Research timed out. The original slide was kept. ', 'a reason that already ends in a full stop gets no second one')

  // the page refuses or throws: an error, no run, the draft is kept
  rt = mount({ regenerate: regenProps({ submit: async () => ({ ok: false, message: 'Select a finished slide to regenerate.' }) }) }); goRegen(rt)
  rt.type('A different title now')
  await rt.click('asv2-generate asv2-regenerate')
  check(assert.equal, rt.error(), 'Select a finished slide to regenerate.')
  check(assert.equal, rt.maybeClass('asv2-queued asv2-regenerating'), null, 'a refusal starts no run')
  check(assert.equal, textbox(rt).props.value, 'A different title now', 'the draft is kept')
  rt = mount({ regenerate: regenProps({ submit: async () => { throw new Error('boom') } }) }); goRegen(rt)
  await rt.click('asv2-generate asv2-regenerate')
  check(assert.equal, rt.error(), 'boom')
  rt.type('Edit the title')
  check(assert.equal, rt.error(), null, 'editing clears the error')

  // blockers
  rt = mount(); goRegen(rt)
  rt.type('Welcome')
  check(assert.equal, blockerOf(rt), 'too-short', 'a one-word title waits for a second word (DEC-P2)')
  check(assert.equal, regenButton(rt).props.disabled, true)
  check(assert.equal, rt.maybeClass('asv2-blocker').props.children, 'Add at least 2 words, for example a short title.')
  rt.type('Welcome all')
  check(assert.equal, blockerOf(rt), null)
  rt.type('   ')
  check(assert.equal, blockerOf(rt), 'empty-text')
  rt = mount({ regenerate: regenProps({ target: regenTarget({ busy: true }) }) }); goRegen(rt)
  check(assert.equal, blockerOf(rt), 'busy', 'a slide already being regenerated')
  check(assert.equal, regenButton(rt).props.disabled, true)
  rt = mount({ regenerate: regenProps({ submit: undefined }) }); goRegen(rt)
  check(assert.equal, blockerOf(rt), 'no-submit', 'refiner, composer or async off: the section is shown but disabled')
  check(assert.equal, regenButton(rt).props.disabled, true)
  rt = mount({ context: context({ sessionId: null }) }); goRegen(rt)
  check(assert.equal, blockerOf(rt), 'no-session')
  rt = mount({ disabled: true }); goRegen(rt)
  check(assert.equal, regenButton(rt).props.disabled, true, 'a disabled panel regenerates nothing')
  check(assert.equal, modeAdd(rt).props.disabled, true)
  calls.length = 0
  rt = mount({ regenerate: regenProps({ target: regenTarget({ busy: true }) }) }); goRegen(rt)
  rt.byClass('asv2-generate asv2-regenerate').props.onClick(); rt.render()
  check(assert.equal, calls.length, 0, 'a blocked button sends nothing even when clicked')
  // a disabled panel and a request in flight never send a second one, even when clicked
  calls.length = 0
  rt = mount({ disabled: true }); goRegen(rt)
  rt.byClass('asv2-generate asv2-regenerate').props.onClick(); rt.render()
  check(assert.equal, calls.length, 0, 'a disabled panel sends nothing even when clicked')
  let releaseSubmit; const slowSubmit = new Promise(resolve => { releaseSubmit = resolve })
  rt = mount({ regenerate: regenProps({ submit: async request => { calls.push(request); return slowSubmit } }) }); goRegen(rt)
  const first = rt.click('asv2-generate asv2-regenerate')
  await Promise.resolve(); rt.render()
  check(assert.equal, calls.length, 1)
  check(assert.equal, regenButton(rt).props.children.at(-1), 'Regenerating…', 'the button says it is working while the request is in flight')
  rt.byClass('asv2-generate asv2-regenerate').props.onClick()
  check(assert.equal, calls.length, 1, 'a second click while the request is in flight sends nothing')
  releaseSubmit({ ok: true, jobId: 'job-slow' }); await first

  // content slide: the style picker, Auto keeps the shape
  rt = mount({ regenerate: regenProps({ target: regenTarget({ kind: 'content', instruction: 'Quarterly revenue by region' }) }) }); goRegen(rt)
  check(assert.equal, rt.radio('auto').props.checked, true, 'Auto is the default style')
  check(assert.deepEqual, rt.all(n => n.type === 'input' && n.props.type === 'radio').map(n => n.props.value), ['auto', 'text', 'image_left', 'image_right', 'chart', 'infographic', 'table', 'diagram'], 'the same styles as Add (kill switches apply)')
  check(assert.equal, rt.radio('title'), undefined, 'still no type picker')
  check(assert.match, textOf(rt.maybeClass('asv2-kind')), /Auto keeps the slide as it is/)
  check(assert.equal, regenButton(rt).props.disabled, false, 'one word is enough for a content slide when it is pre-filled')
  rt.pick('chart')
  check(assert.equal, rt.radio('chart').props.checked, true)
  calls.length = 0
  await rt.click('asv2-generate asv2-regenerate')
  check(assert.equal, calls[0].contentSubtype, 'chart', 'the chosen style goes out')
  check(assert.equal, calls[0].target.kind, 'content')
  rt = mount({ regenerate: regenProps({ target: regenTarget({ kind: 'content' }) }), options: lib.resolveAddSlideV2Options(undefined, 'regenerate') }); goRegen(rt)
  check(assert.equal, rt.radio('chart'), undefined, 'stage-2 styles stay hidden by default')
  check(assert.notEqual, rt.radio('text'), undefined)
  rt = mount({ regenerate: regenProps({ target: regenTarget({ kind: 'content' }) }) }); goRegen(rt)
  rt.pick('diagram')
  check(assert.equal, rt.one(n => String(n.props?.className) === 'asv2-note').props.children, 'Diagrams are built without research.', 'a Diagram regenerate says it is built without research')
  check(assert.equal, rt.all(n => n.type === 'li').every(n => n.props['data-on'] === 'false'), true, 'and shows every research row off')

  // restore the original text
  rt = mount(); goRegen(rt)
  check(assert.equal, rt.maybeClass('asv2-discard'), null, 'nothing to restore while the text is the original')
  rt.type('Something quite different')
  check(assert.notEqual, rt.maybeClass('asv2-discard'), null)
  check(assert.equal, textOf(rt.byClass('asv2-discard')), 'Restore original text')
  rt.byClass('asv2-discard').props.onClick(); rt.render()
  check(assert.equal, textbox(rt).props.value, 'Welcome to Acme Corp', 'back to the original')
  check(assert.equal, rt.maybeClass('asv2-discard'), null)
  rt = mount({ regenerate: regenProps({ target: regenTarget({ instruction: '' }) }) }); goRegen(rt)
  rt.type('Brand new words')
  check(assert.equal, rt.maybeClass('asv2-discard'), null, 'no original instruction: nothing to restore')
  check(assert.match, textOf(rt.one(n => n.props?.className === 'asv2-hint')), /Describe what the slide should say/)

  // drafts are per slide, and independent of the Add draft
  const store = mem()
  rt = mount({ storage: store });
  rt.type('Add draft words')
  goRegen(rt)
  check(assert.equal, textbox(rt).props.value, 'Welcome to Acme Corp', 'Regenerate has its own box state')
  rt.type('Edited for slide three')
  rt.setProps({ regenerate: regenProps({ target: regenTarget({ slideId: 's4', layoutIndex: 3, slideNumber: 4, instruction: 'Other slide text' }) }) })
  check(assert.equal, textbox(rt).props.value, 'Other slide text', 'another slide starts from its own instruction')
  rt.setProps({ regenerate: regenProps() })
  check(assert.equal, textbox(rt).props.value, 'Edited for slide three', 'and the first slide keeps its edit')
  const key = lib.addSlideV2DraftKey('sess-1', 'pres-1')
  check(assert.equal, JSON.parse(store.map.get(key)).text, 'Add draft words', 'a Regenerate edit never touches the stored Add draft')
  modeAdd(rt).props.onClick(); rt.render()
  check(assert.equal, textbox(rt).props.value, 'Add draft words', 'the Add draft is still there')
  // the slide is no longer a generated one: back to the plain Add panel
  rt.setProps({ regenerate: regenProps({ target: null }) })
  check(assert.equal, rt.maybeClass('asv2-modes'), null)
  check(assert.equal, title(rt), 'Add slide')
  rt = mount(); goRegen(rt)
  rt.setProps({ regenerate: regenProps({ target: null }) })
  check(assert.equal, title(rt), 'Add slide', 'a slide that is not generated falls back to Add even in Regenerate mode')
  check(assert.equal, rt.maybeClass('asv2-regenerate-note'), null)

  // the Add flow keeps working while a regenerate runs; the run keeps its state
  calls.length = 0
  rt = mount(); goRegen(rt)
  await rt.click('asv2-generate asv2-regenerate')
  check(assert.equal, modeAdd(rt).props.disabled, false, 'the switch stays usable while a run is going')
  check(assert.equal, modeRegen(rt).props.disabled, false)
  modeAdd(rt).props.onClick(); rt.render()
  check(assert.equal, title(rt), 'Add slide', 'switching to Add while it runs is allowed')
  check(assert.notEqual, rt.maybeClass('asv2-generate'), null)
  goRegen(rt)
  check(assert.notEqual, rt.maybeClass('asv2-queued asv2-regenerating'), null, 'the run is still shown when you come back')

  // Ctrl/Cmd+Enter regenerates in Regenerate mode and adds in Add mode
  calls.length = 0
  rt = mount(); goRegen(rt)
  let prevented = 0
  textbox(rt).props.onKeyDown({ key: 'Enter', metaKey: true, preventDefault() { prevented++ } })
  await new Promise(r => setTimeout(r, 0)); rt.render()
  check(assert.equal, calls.length, 1, 'Cmd+Enter regenerates')
  check(assert.equal, prevented, 1)
  // Escape still closes the panel from Regenerate mode
  let closes = 0
  rt = mount({ onClose() { closes++ } }); goRegen(rt)
  rt.key('Escape')
  check(assert.equal, closes, 1)
}

async function regenerateEntrySuite(panelSource, lib) {
  const host = { id: 'element-drawer-host' }
  const resolved = []
  const slidesSeen = []
  const pageSubmit = async () => ({ ok: true, jobId: 'j' })
  const pageJobStatus = () => ({ status: 'building' })
  const regenerate = (over = {}) => ({
    resolveTarget: (visualIndex, slides) => { resolved.push(visualIndex); slidesSeen.push(slides); return regenTarget() },
    submit: pageSubmit, jobStatus: pageJobStatus, ...over,
  })
  const props = (cfg = {}, settingsOver = {}, over = {}) => ({
    config: { settings: { sessionId: 'sess-1', presentationId: 'pres-1', research: research({ useWebSearch: true }), themeProfileName: null, panelOpen: true, panelHost: host, onPanelOpenChange() {}, ...settingsOver }, currentSlide: 3, slideCount: 7, theme: { mode: 'auto' }, ...cfg },
    onAddSlide: async () => {}, classicPicker: 'CLASSIC', options: REGEN_ON(lib), ...over,
  })
  const mountEntry = (...args) => mountPanel(panelSource, lib, props(...args), 'AddSlideV2Entry')
  const panelProps = rt => rt.all(n => n.portal === true)[0].node.props
  const rows = [{ slideId: 's1', title: 'One' }, { slideId: 's2', title: 'Two' }, { slideId: 's3', title: 'Three' }]

  let rt = mountEntry({ slides: rows }, { regenerate: regenerate() })
  check(assert.deepEqual, resolved, [2], 'the Entry resolves the slide on screen (visual index = current slide - 1)')
  check(assert.equal, slidesSeen[0], rows, 'against the rows the viewer sent')
  const forwarded = panelProps(rt).regenerate
  check(assert.deepEqual, { ...forwarded, submit: undefined, jobStatus: undefined }, { target: regenTarget(), submit: undefined, jobStatus: undefined }, 'the panel gets the target')
  check(assert.equal, forwarded.submit, pageSubmit, 'and the page\'s submit, as is')
  check(assert.equal, forwarded.jobStatus, pageJobStatus, 'and the page\'s job status, as is')
  resolved.length = 0; slidesSeen.length = 0
  rt = mountEntry({ slides: undefined }, { regenerate: regenerate() })
  check(assert.deepEqual, slidesSeen[0], [], 'no rows: an empty list, never undefined')
  resolved.length = 0
  mountEntry({ currentSlide: 5, slides: rows }, { regenerate: regenerate() })
  check(assert.deepEqual, resolved, [4], 'the visual index follows the slide on screen')
  resolved.length = 0
  rt = mountEntry({ slides: rows }, { regenerate: regenerate(), panelOpen: false })
  check(assert.deepEqual, resolved, [2], 'a closed panel still resolves: that is when the page remembers the deck as it was built')
  check(assert.equal, rt.all(n => n.portal === true).length, 0, 'but renders nothing')
  resolved.length = 0
  rt = mountEntry({ slides: rows }, { regenerate: regenerate(), panelHost: null })
  check(assert.deepEqual, resolved, [2], 'no host yet: still resolved')
  resolved.length = 0
  rt = mountEntry({ slides: rows }, { regenerate: regenerate() }, { options: lib.resolveAddSlideV2Options(undefined, 'all') })
  check(assert.equal, resolved.length, 0, 'the regenerate option off: never resolved')
  check(assert.equal, panelProps(rt).regenerate, undefined, 'and not handed to the panel')
  rt = mountEntry({ slides: rows }, {})
  check(assert.equal, panelProps(rt).regenerate, undefined, 'no regenerate settings (flag off): nothing handed to the panel')
  rt = mountEntry({ slides: rows }, { regenerate: regenerate({ resolveTarget: () => null }) })
  check(assert.equal, panelProps(rt).regenerate.target, null, 'a slide that is not generated: a null target, so no switch')
}

// ---- 1. the lib is import-free, the flag and the kill switches are read exactly ---------------------------------------
check(assert.equal, /^\s*import\s/m.test(LIB), false, 'the lib must stay import-free')
check(assert.equal, /^\s*import\s/m.test(REGEN), false, 'the regenerate module must stay import-free')
check(assert.match, LIB, /process\.env\.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true'/, 'literal env access so Next inlines it')
// J2V2-REGENERATE: flag (literal env read, default off), no new endpoint, flag-off identity of the page
check(assert.match, LIB, /process\.env\.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true'/, 'literal env access so Next inlines it')
for (const [value, expected] of [['true', true], ['false', false], ['TRUE', false], ['1', false], ['', false], [' true', false], [undefined, false]]) {
  const env = value === undefined ? {} : { [REGEN_FLAG]: value }
  check(assert.equal, load(LIB, { env }).ADD_SLIDE_V2_REGENERATE_ENABLED, expected, `regenerate flag ${JSON.stringify(value)}`)
}
check(assert.match, SUBMIT, /export const ADD_SLIDE_V2_REFINE_ENDPOINT = '\/api\/slides\/refine'/, 'Regenerate uses the Slide panel\'s Refine route')
check(assert.equal, (withoutComments0(SUBMIT).match(/\/api\/[a-z/]+/g) ?? []).sort().join(','), '/api/slides/compose,/api/slides/refine', 'no other endpoint is named in the submit module')
check(assert.match, REFINE_ROUTE, /\/api\/v1\/slides\/refine-one/, 'the route forwards to Director refine-one')
check(assert.match, REFINE_ROUTE, /NEXT_PUBLIC_SLIDE_REFINER_ENABLED/, 'and is gated by the refiner flag')
{
  // the wire body has exactly the keys the Slide panel's own Refine sends
  const refineBlock = SLIDE_PANEL.match(/isRefineMode\s*\?\s*\{([\s\S]*?)\n\s*\}\s*:\s*\{/)
  check(assert.notEqual, refineBlock, null, 'the Slide panel refine body is findable')
  const panelKeys = [...refineBlock[1].matchAll(/^\s+(\w+)[:,]/gm)].map(m => m[1]).sort()
  check(assert.deepEqual, panelKeys, ['instruction', 'presentation_id', 'research', 'selections', 'session_id', 'slide_id', 'slide_index', 'theme'], 'the Slide panel refine keys')
  check(assert.deepEqual, panelKeys, Object.keys(realLibBody()).sort(), 'Regenerate sends the same keys')
}
function regeneratePagePins(PAGE) {
  check(assert.match, PAGE, /import \{ createAddSlideV2RegenerateHooks \} from '@\/lib\/studio-add-slide-v2-submit'/)
  check(assert.match, PAGE, /import \{ createAddSlideV2GeneratedStore, rememberAddSlideV2Failed, rememberAddSlideV2Generated \} from '@\/lib\/studio-add-slide-v2'/)
  check(assert.match, PAGE, /const \[addSlideV2Generated\] = useState\(createAddSlideV2GeneratedStore\)/, 'one store per page, created lazily')
  check(assert.match, PAGE, /regenerate: process\.env\.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true' \? createAddSlideV2RegenerateHooks\(\{/, 'the page builds Regenerate only with its flag on')
  check(assert.match, PAGE, /regenerateEnabled: features\.slideRefinerEnabled && features\.slideComposerEnabled && features\.slideComposerAsyncEnabled,/, 'submit only with the refiner, the composer and its async mode on')
  check(assert.match, PAGE, /store: addSlideV2Generated,\s*contextByIndex: \(\) => \(studioPartialMetadata \? null : slideContextByIndex\),\s*jobState: jobId => slideComposeJobsRef\.current\[jobId\],/, 'the page\'s own records feed the target and the status')
  check(assert.match, PAGE, /contextByIndex: \(\) => \(studioPartialMetadata \? null : slideContextByIndex\),[\s\S]{0,900}onAccepted: handleSlideComposerAccepted,\s*\}\) : undefined,/, 'the refine job is registered through the same page queue as every other job')
  check(assert.equal, (PAGE.match(/rememberAddSlideV2Generated\(addSlideV2Generated,/g) ?? []).length, 2, 'finished jobs are recorded at the slide_ready handler and at the refresh confirmation')
  check(assert.equal, (PAGE.match(/rememberAddSlideV2Failed\(addSlideV2Generated,/g) ?? []).length, 2, 'failed refines are recorded where the page drops the job: the WS failure and the recovery poll')
  check(assert.equal, (PAGE.match(/process\.env\.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true'/g) ?? []).length, 5, 'every use in the page sits behind the flag (settings + 4 recordings): flag off = nothing recorded, nothing built')
  check(assert.match, PAGE, /if \(process\.env\.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true' && payload\.real_slide_id\) \{\s*rememberAddSlideV2Generated\(addSlideV2Generated, \{\s*jobId: payload\.job_id,\s*realSlideId: payload\.real_slide_id,\s*replacedSlideId: readyKind === 'refine' \? \(payload\.replaced_slide_id \?\? job\?\.target_slide_id \?\? null\) : null,\s*request: job\?\.request \?\? null,/, 'slide_ready: the new slide id, the one it replaced, and the request')
  check(assert.match, PAGE, /if \(process\.env\.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true' && job\.real_slide_id\) \{\s*rememberAddSlideV2Generated\(addSlideV2Generated, \{\s*jobId,\s*realSlideId: job\.real_slide_id,\s*replacedSlideId: job\.kind === 'refine' \? \(job\.target_slide_id \?\? null\) : null,\s*request: job\.request,\s*\}\)\s*\}\s*removeSlideComposeJob\(jobId\)/, 'the refresh confirmation records before it removes the job')
  check(assert.match, PAGE, /if \(process\.env\.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true'\) rememberAddSlideV2Failed\(addSlideV2Generated, jobId, errors\[0\]\)\s*void composeViewerApiRef\.current\?\.refineOverlayClear\(jobId\)/, 'a recovered failure is recorded before the overlay is cleared')
  check(assert.match, PAGE, /rememberAddSlideV2Failed\(addSlideV2Generated, payload\.job_id, errors\[0\] \?\? \(payload\.stage \? `Failed during \$\{payload\.stage\}\.` : undefined\)\)\s*void composeViewerApiRef\.current\?\.refineOverlayClear\(payload\.job_id\)/, 'a failed refine is recorded before the overlay is cleared (the original stays)')
}
regeneratePagePins(PAGE)
check(assert.match, ENVEX, /\nNEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED="false"\n/, '.env.example documents the flag, default off')
check(assert.match, ENVEX, /ENABLED_OPTIONS="regenerate[\s\S]{0,900}\nNEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED="false"\n/, '.env.example says the option id `regenerate` is needed as well')
check(assert.match, LIB, /process\.env\.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_DISABLED_OPTIONS,\s*process\.env\.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED_OPTIONS,/, 'literal env access for both option lists')
for (const [value, expected] of [['true', true], ['false', false], ['TRUE', false], ['1', false], ['', false], [' true', false], [undefined, false]]) {
  const env = value === undefined ? {} : { [FLAG]: value }
  check(assert.equal, load(LIB, { env }).ADD_SLIDE_V2_ENABLED, expected, `flag ${JSON.stringify(value)}`)
}
// the module-level resolution from process.env, option by option
const optionsFrom = env => [...load(LIB, { env }).ADD_SLIDE_V2_OPTIONS]
const STAGE1_IDS = ['title', 'section', 'closing', 'content', 'auto', 'text', 'image_left', 'image_right', 'blank', 'catalog', 'blank_theme']
check(assert.deepEqual, optionsFrom({}), STAGE1_IDS, 'DEC-P8: with the env unset only stage 1 is offered')
check(assert.deepEqual, optionsFrom({ [DISABLED_ENV]: undefined }), STAGE1_IDS)
const STAGE2_IDS = ['chart', 'infographic', 'table', 'diagram']
for (const id of ['title', 'section', 'closing', 'content', 'auto', 'text', 'image_left', 'image_right', ...STAGE2_IDS, 'blank', 'catalog', 'blank_theme']) {
  const off = optionsFrom({ [DISABLED_ENV]: id })
  check(assert.equal, off.includes(id), false, `env ${DISABLED_ENV}=${id} hides ${id}`)
  check(assert.deepEqual, off, STAGE1_IDS.filter(x => x !== id), 'and only that id: the rest of the default is untouched')
  check(assert.equal, optionsFrom({ [DISABLED_ENV]: id, [ENABLED_ENV]: 'all' }).includes(id), false, `${id} stays hidden when ENABLED=all too`)
}
check(assert.deepEqual, optionsFrom({ [DISABLED_ENV]: 'image_left' }).filter(id => STAGE2_IDS.includes(id)), [], 'DISABLED=image_left does NOT un-hide stage 2')
check(assert.deepEqual, optionsFrom({ [ENABLED_ENV]: 'chart' }).filter(id => STAGE2_IDS.includes(id)), ['chart'], 'ENABLED=chart shows chart only')
check(assert.deepEqual, optionsFrom({ [ENABLED_ENV]: 'all' }).filter(id => STAGE2_IDS.includes(id)), STAGE2_IDS, 'ENABLED=all shows every stage-2 id')
check(assert.equal, optionsFrom({ [ENABLED_ENV]: 'all' }).length, 15, 'ENABLED=all = every non-opt-in option')
check(assert.equal, optionsFrom({ [DISABLED_ENV]: 'chart', [ENABLED_ENV]: 'chart,table' }).includes('chart'), false, 'an id in both lists stays hidden')
check(assert.equal, optionsFrom({ [DISABLED_ENV]: 'chart', [ENABLED_ENV]: 'chart,table' }).includes('table'), true, 'and the rest of ENABLED applies')
check(assert.equal, optionsFrom({ [DISABLED_ENV]: 'none' }).length, STAGE1_IDS.length, '"none" is no longer special: stage 1 only')
check(assert.equal, optionsFrom({ [ENABLED_ENV]: 'regenerate' }).includes('regenerate'), true, 'regenerate needs the enabled env')
check(assert.equal, optionsFrom({ [ENABLED_ENV]: 'all' }).includes('regenerate'), false, 'ENABLED=all does not turn the scaffold on')
check(assert.equal, optionsFrom({}).includes('regenerate'), false, 'regenerate is off by default')
// the documentation names every id and both env vars
for (const needle of [DISABLED_ENV, ENABLED_ENV, FLAG, ...['title', 'section', 'closing', 'content', 'auto', 'text', 'image_left', 'image_right', 'chart', 'infographic', 'table', 'diagram', 'blank', 'catalog', 'blank_theme', 'regenerate']]) {
  check(assert.equal, ENVEX.includes(needle), true, `.env.example documents ${needle}`)
}
check(assert.match, ENVEX, /\n# NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_DISABLED_OPTIONS="image_left"\n/, 'the example line is commented out: copying .env.example must not change the default')
check(assert.match, ENVEX, /\n# NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED_OPTIONS="chart,table"\n/, 'the enable example is commented out too')
check(assert.match, ENVEX, /ENABLED_OPTIONS[^\n]*\n[\s\S]{0,1200}\ball\b/, 'the documentation explains ENABLED=all')
check(assert.match, ENVEX, /DISABLED wins|disabled wins/i, 'the documentation states that DISABLED wins')
check(assert.equal, /"none"\s+everything shown/.test(ENVEX), false, 'the old "none" magic is gone from the documentation')
check(assert.equal, /\nNEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_(DISABLED|ENABLED)_OPTIONS=/.test(ENVEX), false, 'neither list is set by the example file')

// ---- 2. behaviour on the real sources ----------------------------------------------------------------------------
const realLib = load(LIB, { env: ALL_ENV })
libSuite(realLib)
regenerateLibSuite(realLib)
markupSuite(PANEL, realLib)
check(assert.equal, /^\s*import\s/m.test(SUBMIT), true, 'the submit module imports the page helpers it reuses')
await submitSuite(submitModule(SUBMIT, realLib), realLib)
await regenerateSubmitSuite(submitModule(SUBMIT, realLib), realLib)
await panelInteractionSuite(PANEL, realLib)
await entrySuite(PANEL, realLib)
await regeneratePanelSuite(PANEL, realLib)
await regenerateEntrySuite(PANEL, realLib)
regenSuite(load(REGEN))
// Table and Diagram are the Slide panel's own selections: pin them against compose-helpers so they cannot drift
const composeHelpers = load(read('../components/slide-generation-panel/compose-helpers.ts'))
const panelSelections = input => composeHelpers.buildSelections({ layout: 'auto', canvasType: 'C1', narrativeRole: 'auto', ...input })
check(assert.deepEqual, realLib.addSlideV2Selections('content', 'table'), panelSelections({ contentType: 'text_heavy_columns', shapeSubtype: 'table' }), 'Table = what the Slide panel builds for Text-heavy + Table')
check(assert.deepEqual, realLib.addSlideV2Selections('content', 'diagram'), panelSelections({ contentType: 'diagram_idea_board', shapeSubtype: 'auto' }), 'Diagram = what the Slide panel builds for Diagram (idea board default)')
check(assert.deepEqual, realLib.addSlideV2Selections('content', 'chart'), panelSelections({ contentType: 'chart', shapeSubtype: 'single' }) , 'Chart = the panel Chart / single')
check(assert.deepEqual, realLib.addSlideV2Selections('content', 'infographic'), panelSelections({ contentType: 'infographic', shapeSubtype: 'vertical_center' }), 'Infographic = the panel default arrangement')

// ---- 3. flag-gated hooks (flag off must leave the existing Add Slide UI untouched) --------------------------------
check(assert.match, PICKER, /if \(ADD_SLIDE_V2_ENABLED && addSlideV2\) \{\s*return <AddSlideV2Entry config=\{addSlideV2\} disabled=\{disabled \|\| isAdding\} className=\{className\} onAddSlide=\{onAddSlide\}\s*classicPicker=\{<SlideLayoutPicker onAddSlide=\{onAddSlide\} disabled=\{disabled\} className=\{className\} \/>\} \/>\s*\}/,
  'the picker hands the Entry the native Add and a classic picker (no addSlideV2 prop, no recursion into the V2 branch)')
check(assert.ok, PICKER.indexOf('if (ADD_SLIDE_V2_ENABLED && addSlideV2)') < PICKER.indexOf('if (STUDIO_SHELL) {'), 'V2 branch precedes the two existing branches')
check(assert.match, PICKER, /Insert \$\{layout\.label\} slide/, 'existing Insert-slide cards still present')
check(assert.match, PICKER, /Hero Slides[\s\S]*Content Slides[\s\S]*Visual \+ Text[\s\S]*Image Split/, 'legacy layout picker still present')
check(assert.match, VIEWER, /addSlideV2=\{ADD_SLIDE_V2_ENABLED && addSlideV2Settings \? \{ settings: addSlideV2Settings, currentSlide, slideCount: totalSlides, theme: buildThemeSelection, slides: addSlideV2Settings\.regenerate \? slideThumbnails\.map\(slide => \(\{ slideId: slide\.slideId \?\? null, title: slide\.title \?\? '' \}\)\) : undefined \} : undefined\}/,
  'the viewer passes nothing unless the flag is on and the page supplied settings, and the slide rows only when Regenerate is configured')
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
// the drawer: same frame as Add Element, flag-gated, and nothing changes while the flag is off
check(assert.match, PAGE, /const \[addSlideV2Open, setAddSlideV2Open\] = useState\(false\)/)
check(assert.match, PAGE, /const isElementDrawerOpen = generationPanel\.isOpen \|\| showTextBoxPanel \|\| showElementPanel \|\| \(studioShell && studioFormatOpen\) \|\| addSlideV2Open\n/, 'the Element drawer opens for the Add Slide panel too')
check(assert.match, PAGE, /\{process\.env\.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true' && <div ref=\{setAddSlideV2Host\} data-studio-add-slide-v2-host="true" \/>\}\n\s*<\/div>\n\n\s*\{\/\* Handle \*\/\}/, 'the host is rendered only with the flag on, inside the Element drawer panel area, after the Add Element panels')
check(assert.match, PAGE, /\{\(\(features\.useTextLabsGeneration && generationPanel\.isOpen\) \|\| addSlideV2Open\) && \(/, 'the drawer handle also shows for the Add Slide panel')
check(assert.match, PAGE, /else \{ generationPanel\.closePanel\(\); setAddSlideV2Open\(false\) \}/, 'the handle closes both')
check(assert.match, PAGE, /if \(!open\) \{ setAddSlideV2Open\(false\); return \}\n\s*generationPanel\.closePanel\(\)\n\s*setShowTextBoxPanel\(false\)\n\s*setShowElementPanel\(false\)\n\s*closeStudioFormat\(\)\n\s*bringToFront\('element'\)\n\s*setAddSlideV2Open\(true\)/, 'opening it makes the other Element panels step aside, like activateElementPanel')
check(assert.match, PAGE, /if \(addSlideV2Open && \(generationPanel\.isOpen \|\| showTextBoxPanel \|\| showElementPanel \|\| \(studioShell && studioFormatOpen\)\)\) setAddSlideV2Open\(false\)/, 'and any of them opening closes it: one panel in the drawer')
check(assert.match, PAGE, /panelOpen: addSlideV2Open,\s*panelHost: addSlideV2Host,\s*onPanelOpenChange: handleAddSlideV2PanelOpenChange,/)
// DEC-P9: the viewer follows the new slide when the user is still where they started
check(assert.match, PAGE, /follow: addSlideV2FollowRef\.current,/)
check(assert.match, PAGE, /const addSlideV2Follow = addSlideV2FollowRef\.current\.get\(payload\.job_id\) \?\? null\n\s*addSlideV2FollowRef\.current\.delete\(payload\.job_id\)/)
check(assert.equal, (PAGE.match(/followVisualIndex: addSlideV2Follow,/g) ?? []).length, 2, 'both the navigation and the selection restore see the follow slide')
check(assert.match, ASYNC, /\(options\.followVisualIndex != null && options\.currentSlideIndex === options\.followVisualIndex\)/)
check(assert.match, VIEWER, /async \(layoutId: SlideLayoutType, options\?: \{ position\?: number; backgroundColor\?: string \}\) =>/, 'the viewer Add takes optional position and background')
check(assert.match, VIEWER, /position: options\?\.position \?\? currentSlide,/, 'flag off / no options: the old position')
check(assert.match, VIEWER, /\.\.\.\(options\?\.backgroundColor \? \{ background_color: options\.backgroundColor \} : \{\}\),/, 'no background unless the Blank passes one')
check(assert.equal, (PICKER.match(/onAddSlide\(layoutId\)/g) ?? []).length, 1, 'the old handleSelectLayout call is untouched')
check(assert.match, PANEL, /settings\.resolveBlankTarget\?\.\(Math\.max\(0, currentSlide - 1\)\) \?\? \{ ok: true as const, position: undefined \}/, 'the Blank target is resolved against the slide the panel shows')
check(assert.match, PANEL, /if \(!target\.ok\) return \{ ok: false as const, message: target\.message \}\s*setAdding\(true\)/, 'a refused Blank sends nothing')
check(assert.match, PANEL, /<AddSlideV2Panel\s+key=\{addSlideV2DraftKey\(context\.sessionId, context\.presentationId\)\}/, 'the panel remounts per session and deck, so each loads its own draft')
check(assert.match, PANEL, /createPortal\(\s*<AddSlideV2Panel[\s\S]*?settings\.panelHost,\s*\)/, 'rendered into the page\'s drawer host')
const withoutComments = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
check(assert.equal, /fetch\(|\/api\/|XMLHttpRequest|sendBeacon|WebSocket/.test(withoutComments(PANEL) + withoutComments(LIB) + withoutComments(REGEN)), false, 'the panel, the lib and the regenerate module make no backend call')
check(assert.equal, /Popover|PopoverContent|role="dialog"/.test(PANEL), false, 'the panel is not a pop-up')

// ---- 4. mutation check: every mutant must be caught ---------------------------------------------------------------
const pageMutants = [
  ['regenerate is built without its flag', "regenerate: process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true' ? createAddSlideV2RegenerateHooks({", "regenerate: createAddSlideV2RegenerateHooks({"],
  ['regenerate submits without the refiner', "regenerateEnabled: features.slideRefinerEnabled && features.slideComposerEnabled && features.slideComposerAsyncEnabled,", "regenerateEnabled: features.slideComposerEnabled && features.slideComposerAsyncEnabled,"],
  ['regenerate submits without async', "regenerateEnabled: features.slideRefinerEnabled && features.slideComposerEnabled && features.slideComposerAsyncEnabled,", "regenerateEnabled: features.slideRefinerEnabled && features.slideComposerEnabled,"],
  ['finished jobs are recorded without the flag', "if (process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true' && payload.real_slide_id) {", "if (payload.real_slide_id) {"],
  ['the slide_ready record forgets the replaced slide', "replacedSlideId: readyKind === 'refine' ? (payload.replaced_slide_id ?? job?.target_slide_id ?? null) : null,", "replacedSlideId: null,"],
  ['the slide_ready record forgets the request', "            request: job?.request ?? null,\n", "            request: null,\n"],
  ['the refresh confirmation does not record', "    if (process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true' && job.real_slide_id) {\n      rememberAddSlideV2Generated(addSlideV2Generated, {\n        jobId,\n        realSlideId: job.real_slide_id,\n        replacedSlideId: job.kind === 'refine' ? (job.target_slide_id ?? null) : null,\n        request: job.request,\n      })\n    }\n", ""],
  ['the refresh confirmation records without the flag', "    if (process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true' && job.real_slide_id) {", "    if (job.real_slide_id) {"],
  ['a recovered failure is not recorded', "                  if (process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true') rememberAddSlideV2Failed(addSlideV2Generated, jobId, errors[0])\n", ""],
  ['a failed refine is not recorded', "        if (process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true') rememberAddSlideV2Failed(addSlideV2Generated, payload.job_id, errors[0] ?? (payload.stage ? `Failed during ${payload.stage}.` : undefined))\n", ""],
  ['a failed refine is recorded without the flag', "        if (process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true') rememberAddSlideV2Failed(addSlideV2Generated, payload.job_id,", "        rememberAddSlideV2Failed(addSlideV2Generated, payload.job_id,"],
  ['the refine job is registered somewhere else', "                onAccepted: handleSlideComposerAccepted,\n              }) : undefined,", "                onAccepted: () => {},\n              }) : undefined,"],
  ['the store is rebuilt on every render', "useState(createAddSlideV2GeneratedStore)", "useState(createAddSlideV2GeneratedStore())"],
  ['the deck context is used while partial', "contextByIndex: () => (studioPartialMetadata ? null : slideContextByIndex),", "contextByIndex: () => slideContextByIndex,"],
  ['the job state comes from nowhere', "jobState: jobId => slideComposeJobsRef.current[jobId],", "jobState: () => undefined,"],
  ['the regenerate store is not the page store', "                store: addSlideV2Generated,\n", "                store: createAddSlideV2GeneratedStore(),\n"],
]
const libMutants = [
  ['the deck context needs no line-up', "Object.keys(contextByIndex).length !== slides.length) return", "false) return"],
  ['the deck context ids are not trimmed', "    const slideId = row.slideId?.trim()\n    const entry = contextByIndex[index]", "    const slideId = row.slideId\n    const entry = contextByIndex[index]"],
  ['the deck context is not kept by first sight', " || store.context.has(slideId)) return", ") return"],
  ['the deck context shares the frame entry', "store.context.set(slideId, { canvas_type: entry.canvas_type, key_message: entry.key_message })", "store.context.set(slideId, entry)"],
  ['the deck context is not capped', "  capMap(store.context, ADD_SLIDE_V2_CONTEXT_MAX)\n", ""],
  ['the deck context is keyed by position', "store.context.set(slideId, {", "store.context.set(String(index), {"],
  ['regen flag on by default', "process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true'", "process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED !== 'false'"],
  ['regen flag never on', "process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true'", "process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'never'"],
  ['H1 is not a title', "case 'H1': return 'title'", "case 'H1': return 'section'"],
  ['H2 is not a section', "case 'H2': return 'section'", "case 'H2': return 'closing'"],
  ['H3 is not a closing', "case 'H3': return 'closing'", "case 'H3': return 'content'"],
  ['an unknown canvas is a title', "    default: return 'content'\n  }\n}\n\nexport function addSlideV2RegenerateBlocker", "    default: return 'title'\n  }\n}\n\nexport function addSlideV2RegenerateBlocker"],
  ['the canvas is not trimmed', "String(canvas ?? '').trim().toUpperCase()", "String(canvas ?? '').toUpperCase()"],
  ['the canvas is case sensitive', "String(canvas ?? '').trim().toUpperCase()", "String(canvas ?? '').trim()"],
  ['only a title is a hero', "return kind !== 'content'", "return kind === 'title'"],
  ['regenerate blocker ignores the option', "  if (!options.has('regenerate')) return 'no-options'\n  if (target.busy) return 'busy'", "  if (target.busy) return 'busy'"],
  ['regenerate blocker ignores a busy slide', "  if (target.busy) return 'busy'\n", ''],
  ['regenerate blocker ignores a hidden style', "  if (target.kind === 'content' && !availableAddSlideV2Subtypes(options).some(option => option.value === draft.contentSubtype)) return 'no-options'\n", ''],
  ['regenerate blocker applies the style check to heroes', "  if (target.kind === 'content' && !availableAddSlideV2Subtypes(options)", "  if (!availableAddSlideV2Subtypes(options)"],
  ['regenerate hero minimum dropped', "  if (addSlideV2RegenerateIsHero(target.kind) && countAddSlideV2Words(text) < ADD_SLIDE_V2_HERO_MIN_WORDS) return 'too-short'\n", ''],
  ['regenerate minimum applies to content too', "  if (addSlideV2RegenerateIsHero(target.kind) && countAddSlideV2Words(text) < ADD_SLIDE_V2_HERO_MIN_WORDS) return 'too-short'", "  if (countAddSlideV2Words(text) < ADD_SLIDE_V2_HERO_MIN_WORDS) return 'too-short'"],
  ['regenerate blocker allows empty text', "  const text = draft.text.trim()\n  if (!text) return 'empty-text'\n  if (addSlideV2RegenerateIsHero", "  const text = draft.text.trim()\n  if (addSlideV2RegenerateIsHero"],
  ['regenerate blocker ignores a missing session', "  if (!context.sessionId) return 'no-session'\n  if (!hasSubmit) return 'no-submit'\n  return null\n}\n\nexport function buildAddSlideV2RegenerateRequest", "  if (!hasSubmit) return 'no-submit'\n  return null\n}\n\nexport function buildAddSlideV2RegenerateRequest"],
  ['regenerate blocker ignores a missing submit', "  if (!hasSubmit) return 'no-submit'\n  return null\n}\n\nexport function buildAddSlideV2RegenerateRequest", "  return null\n}\n\nexport function buildAddSlideV2RegenerateRequest"],
  ['a hero target sends a content style', "contentSubtype: target.kind === 'content' ? draft.contentSubtype : null,", "contentSubtype: draft.contentSubtype,"],
  ['the request keeps the visual index off by one', "    visualIndex: Math.max(0, context.currentSlide - 1),\n    sessionId: context.sessionId,\n    presentationId: context.presentationId,\n    research: { ...context.research },\n    theme: context.theme,\n  }\n}\n\n/** Wire body for POST /api/slides/refine", "    visualIndex: context.currentSlide,\n    sessionId: context.sessionId,\n    presentationId: context.presentationId,\n    research: { ...context.research },\n    theme: context.theme,\n  }\n}\n\n/** Wire body for POST /api/slides/refine"],
  ['the regenerate instruction is not trimmed', "    instruction: draft.text.trim(),\n    visualIndex:", "    instruction: draft.text,\n    visualIndex:"],
  ['the research object is shared', "    research: { ...context.research },\n    theme: context.theme,\n  }\n}\n\n/** Wire body for POST /api/slides/refine", "    research: context.research,\n    theme: context.theme,\n  }\n}\n\n/** Wire body for POST /api/slides/refine"],
  ['the refine body uses the stale target index', "    slide_index: Math.max(0, layoutIndex),", "    slide_index: request.target.layoutIndex,"],
  ['the refine body index can go negative', "    slide_index: Math.max(0, layoutIndex),", "    slide_index: layoutIndex,"],
  ['the refine body drops the slide id', "    slide_id: request.target.slideId,\n", ''],
  ['the refine body loses the hero selections', "  const selections = addSlideV2Selections(request.target.kind, request.contentSubtype)\n  const researchOff = request.target.kind === 'content' && request.contentSubtype === 'diagram'\n  const body: AddSlideV2RefineBody<TTheme>", "  const selections = addSlideV2Selections('content', request.contentSubtype)\n  const researchOff = request.target.kind === 'content' && request.contentSubtype === 'diagram'\n  const body: AddSlideV2RefineBody<TTheme>"],
  ['the refine body keeps research on for a Diagram', "  const researchOff = request.target.kind === 'content' && request.contentSubtype === 'diagram'\n  const body: AddSlideV2RefineBody<TTheme>", "  const researchOff = false\n  const body: AddSlideV2RefineBody<TTheme>"],
  ['the refine body needs no session', "  if (!request.sessionId || !request.target.slideId) return null", "  if (!request.target.slideId) return null"],
  ['the refine body needs no slide id', "  if (!request.sessionId || !request.target.slideId) return null", "  if (!request.sessionId) return null"],
  ['the remembered kind ignores the request canvas', "    kind: canvas !== undefined ? addSlideV2KindFromCanvas(canvas) : (replaced?.kind ?? 'content'),", "    kind: replaced?.kind ?? 'content',"],
  ['the remembered kind ignores the replaced slide', "    kind: canvas !== undefined ? addSlideV2KindFromCanvas(canvas) : (replaced?.kind ?? 'content'),", "    kind: canvas !== undefined ? addSlideV2KindFromCanvas(canvas) : 'content',"],
  ['the replaced slide is remembered forever', "  if (input.replacedSlideId && input.replacedSlideId !== realSlideId) store.slides.delete(input.replacedSlideId)\n", ''],
  ['a slide that replaces itself is forgotten', "  if (input.replacedSlideId && input.replacedSlideId !== realSlideId) store.slides.delete(input.replacedSlideId)", "  if (input.replacedSlideId) store.slides.delete(input.replacedSlideId)"],
  ['the remembered instruction is not capped', ".slice(0, ADD_SLIDE_V2_INSTRUCTION_MAX)", ""],
  ['the remembered instruction is not trimmed', "input.request.instruction.trim()", "input.request.instruction"],
  ['an empty slide id is remembered', "  if (!realSlideId) return\n", ''],
  ['the slide id is not trimmed', "  const realSlideId = input.realSlideId.trim()", "  const realSlideId = input.realSlideId"],
  ['a finished job without an id is remembered', "  if (input.jobId) {\n    store.completed.delete(input.jobId)", "  if (true) {\n    store.completed.delete(input.jobId)"],
  ['finished jobs are not capped', "  capMap(store.completed, ADD_SLIDE_V2_COMPLETED_MAX)\n", ''],
  ['generated slides are not capped', "  capMap(store.slides, ADD_SLIDE_V2_GENERATED_MAX)\n", ''],
  ['failures are not capped', "  capMap(store.failed, ADD_SLIDE_V2_FAILED_MAX)\n", ''],
  ['capping drops the newest', "    const oldest = map.keys().next()", "    const oldest = [...map.keys()].slice(-1).map(value => ({ done: false, value }))[0]"],
  ['a failure may be empty', "|| 'The slide could not be regenerated.')", "|| '')"],
  ['a failure is not trimmed or capped', "(message ?? '').trim().slice(0, 300)", "(message ?? '')"],
  ['a failure without a job id is remembered', "  if (!jobId) return\n  store.failed.delete(jobId)", "  store.failed.delete(jobId)"],
  ['the pre-filled text is empty', "    text: target.instruction,\n  }\n}\n\nexport interface AddSlideV2RegenerateRequest", "    text: '',\n  }\n}\n\nexport interface AddSlideV2RegenerateRequest"],
  ['the regenerate draft ignores a hidden Auto', "    contentSubtype: styles.some(option => option.value === 'auto') ? 'auto' : (styles[0]?.value ?? 'auto'),\n    text: target.instruction,", "    contentSubtype: 'auto',\n    text: target.instruction,"],
  ['default slide type is title', "slideType: types.some(option => option.value === 'content') ? 'content' : (types[0]?.value ?? 'content'),", "slideType: 'title',"],
  ['default ignores a hidden Content', "slideType: types.some(option => option.value === 'content') ? 'content' : (types[0]?.value ?? 'content'),", "slideType: 'content',"],
  ['default sub-type is chart', "contentSubtype: styles.some(option => option.value === 'auto') ? 'auto' : (styles[0]?.value ?? 'auto'),", "contentSubtype: 'chart',"],
  ['default ignores a hidden Auto', "contentSubtype: styles.some(option => option.value === 'auto') ? 'auto' : (styles[0]?.value ?? 'auto'),", "contentSubtype: 'auto',"],
  ['section type dropped', "  { id: 'section', group: 'type', label: 'Section', hint: 'Chapter break', stage: 1 },\n", ''],
  ['placeholder mode added', "  { id: 'content', group: 'type', label: 'Content', hint: 'Text, charts, images', stage: 1 },\n", "  { id: 'content', group: 'type', label: 'Content', hint: 'Text, charts, images', stage: 1 },\n  { id: 'placeholder', group: 'type', label: 'Placeholder slide', hint: 'Empty layout', stage: 1 },\n"],
  ['image-right sub-type dropped', "  { id: 'image_right', group: 'style', label: 'Image right', hint: 'Image on the right, text on the left', stage: 1 },\n", ''],
  ['plain Image is back', "  { id: 'auto', group: 'style', label: 'Auto', hint: 'Let Deckster choose', stage: 1 },\n", "  { id: 'auto', group: 'style', label: 'Auto', hint: 'Let Deckster choose', stage: 1 },\n  { id: 'image', group: 'style', label: 'Image', hint: 'Image-led slide', stage: 1 },\n"],
  ['table dropped', "  { id: 'table', group: 'style', label: 'Table', hint: 'Rows and columns', stage: 2 },\n", ''],
  ['diagram dropped', "  { id: 'diagram', group: 'style', label: 'Diagram', hint: 'Structured diagram', stage: 2 },\n", ''],
  ['chart is a stage-1 option', "label: 'Chart', hint: 'Data visualization', stage: 2", "label: 'Chart', hint: 'Data visualization', stage: 1"],
  ['table is a stage-1 option', "label: 'Table', hint: 'Rows and columns', stage: 2", "label: 'Table', hint: 'Rows and columns', stage: 1"],
  ['text is a stage-2 option', "label: 'Text', hint: 'Text-led slide', stage: 1", "label: 'Text', hint: 'Text-led slide', stage: 2"],
  ['regenerate is on by default', ", stage: 1, optIn: true }", ", stage: 1 }"],
  ['sub-type leaks into non-content slides', "return draft.slideType === 'content' ? draft.contentSubtype : null", 'return draft.contentSubtype'],
  ['type change clears the text', "? { ...draft, slideType: action.value }", "? { ...draft, slideType: action.value, text: '' }"],
  ['unknown type accepted', "return availableAddSlideV2Types(options).some(option => option.value === action.value)\n        ? { ...draft, slideType: action.value }\n        : draft", 'return { ...draft, slideType: action.value }'],
  ['a hidden style can be selected', "return availableAddSlideV2Subtypes(options).some(option => option.value === action.value)\n        ? { ...draft, contentSubtype: action.value }\n        : draft", 'return { ...draft, contentSubtype: action.value }'],
  ['reset ignores the options', "    case 'reset':\n      return initialAddSlideV2Draft(options)", "    case 'reset':\n      return initialAddSlideV2Draft()"],
  ['instruction not trimmed', 'instruction: draft.text.trim(),', 'instruction: draft.text,'],
  ['off-by-one insert index', 'Math.max(0, context.currentSlide - 1)', 'Math.max(0, context.currentSlide)'],
  ['index ignores a missing deck', 'context.presentationId ? Math.max(0, context.currentSlide - 1) : null', 'Math.max(0, context.currentSlide - 1)'],
  ['empty text is allowed', "if (!text) return 'empty-text'", ''],
  ['hero minimum dropped', "if (draft.slideType !== 'content' && countAddSlideV2Words(text) < ADD_SLIDE_V2_HERO_MIN_WORDS) return 'too-short'", ''],
  ['Content gets the hero minimum', "if (draft.slideType !== 'content' && countAddSlideV2Words(text) < ADD_SLIDE_V2_HERO_MIN_WORDS)", 'if (countAddSlideV2Words(text) < ADD_SLIDE_V2_HERO_MIN_WORDS)'],
  ['hero minimum is one word', 'ADD_SLIDE_V2_HERO_MIN_WORDS = 2', 'ADD_SLIDE_V2_HERO_MIN_WORDS = 1'],
  ['hero minimum is three words', 'ADD_SLIDE_V2_HERO_MIN_WORDS = 2', 'ADD_SLIDE_V2_HERO_MIN_WORDS = 3'],
  ['punctuation counts as a word', 'if (!alnum.test(token)) continue', ''],
  ['spaceless scripts count once', 'words += cjk >= 2 ? Math.ceil(cjk / 2) : 1', 'words += 1'],
  ['spaceless scripts count per character', 'Math.ceil(cjk / 2)', 'cjk'],
  ['missing session is allowed', "if (!sessionId) return 'no-session'", ''],
  ['missing submit is allowed', "if (!hasSubmit) return 'no-submit'", ''],
  ['a hidden type is not blocked', "if (!types.some(option => option.value === draft.slideType)) return 'no-options'", ''],
  ['a hidden style is not blocked', "if (draft.slideType === 'content' && !availableAddSlideV2Subtypes(options).some(option => option.value === draft.contentSubtype)) return 'no-options'", ''],
  ['research overridden', 'research: { ...context.research },', 'research: { ...context.research, useWebSearch: false },'],
  ['theme dropped', '    theme: context.theme,\n  }\n}', '    theme: undefined as never,\n  }\n}'],
  ['backend field leaks onto the request', "    mode: 'generate',\n    slideType", "    mode: 'generate',\n    endpoint: '/api/slides/compose',\n    slideType"],
  ['auto theme label changed', "'Auto — matches deck'", "'Auto'"],
  ['placement note drifts', 'is added right after slide', 'is added at the end after slide'],
  ['image left maps to I2', "image_left: { canvas_type: 'I1'", "image_left: { canvas_type: 'I2'"],
  ['image right maps to I1', "image_right: { canvas_type: 'I2'", "image_right: { canvas_type: 'I1'"],
  ['auto sends a canvas', '  auto: {},', "  auto: { canvas_type: 'C1' },"],
  ['empty selections key sent', 'if (Object.keys(selections).length > 0) body.selections = selections', 'body.selections = selections'],
  ['chart subtype dropped', ", chart_subtype: 'single' }", ' }'],
  ['infographic subtype dropped', ", infographic_subtype: 'vertical_center' }", ' }'],
  ['closing maps to H2', "closing: { canvas_type: 'H3'", "closing: { canvas_type: 'H2'"],
  ['text maps to chart content', "text: { canvas_type: 'C1', content_type: 'text_heavy_columns' },", "text: { canvas_type: 'C1', content_type: 'chart' },"],
  ['table subtype dropped', ", text_subtype: 'table' }", ' }'],
  ['table maps to text content', "content_type: 'table', text_subtype", "content_type: 'text_heavy_columns', text_subtype"],
  ['diagram subtype dropped', ", diagram_subtype: 'idea_board' }", ' }'],
  ['diagram content type wrong', "content_type: 'diagram_idea_board'", "content_type: 'diagram'"],
  ['table selections object is shared', "return { ...CONTENT_SELECTIONS[subtype ?? 'auto'] }", "return CONTENT_SELECTIONS[subtype ?? 'auto']"],
  ['Diagram keeps research on', "const researchOff = request.slideType === 'content' && request.contentSubtype === 'diagram'", 'const researchOff = false'],
  ['a dormant Diagram switches hero research off', "const researchOff = request.slideType === 'content' && request.contentSubtype === 'diagram'", "const researchOff = request.contentSubtype === 'diagram'"],
  ['Table switches research off too', "request.contentSubtype === 'diagram'\n  const body", "(request.contentSubtype === 'diagram' || request.contentSubtype === 'table')\n  const body"],
  ['text draft stored under a wrong field', "text: draft.text }))", "text: draft.slideType }))"],
  ['body uses the visual index as the anchor', 'insert_after_index: insertAfterIndex,', 'insert_after_index: request.anchorVisualIndex,'],
  ['web search cap changed', 'ADD_SLIDE_V2_WEB_SEARCH_MAX_QUERIES = 3', 'ADD_SLIDE_V2_WEB_SEARCH_MAX_QUERIES = 5'],
  ['theme dropped from the body', '    instruction: request.instruction,\n    theme: request.theme,\n    research: {', '    instruction: request.instruction,\n    research: {'],
  ['research flag swapped on the wire', 'use_web_search: !researchOff && request.research.useWebSearch,', 'use_web_search: !researchOff && request.research.useDeepResearch,'],
  ['stage 2 is shown unless disabled', "        if (option.stage !== 2 && !option.optIn) return true\n", "        if (!option.optIn) return true\n"],
  ['DISABLED un-hides stage 2 (the old replace rule)', "        if (option.stage !== 2 && !option.optIn) return true\n", "        if (option.stage !== 2 && !option.optIn) return true\n        if (disabled.size > 0 && !option.optIn) return true\n"],
  ['ENABLED is ignored', "        return enabled.has(option.id) || (enableAllStage2 && option.stage === 2)", "        return false"],
  ['ENABLED=all is ignored', "(enableAllStage2 && option.stage === 2)", "false"],
  ['ENABLED=all also turns the scaffold on', "(enableAllStage2 && option.stage === 2)", "enableAllStage2"],
  ['ENABLED=chart shows every stage-2 id', "return enabled.has(option.id) ||", "return enabled.size > 0 ||"],
  ['ENABLED beats DISABLED', "        if (disabled.has(option.id)) return false\n", "        if (disabled.has(option.id) && !enabled.has(option.id)) return false\n"],
  ['DISABLED is ignored', "        if (disabled.has(option.id)) return false\n", ""],
  ['the enable-all word changed', "ADD_SLIDE_V2_ENABLE_ALL = 'all'", "ADD_SLIDE_V2_ENABLE_ALL = 'everything'"],
  ['the opt-in scaffold needs no name', "if (option.stage !== 2 && !option.optIn) return true", "if (option.stage !== 2) return true"],
  ['option ids are case sensitive', '.map(part => part.trim().toLowerCase())', '.map(part => part.trim())'],
  ['option ids are not trimmed', '.map(part => part.trim().toLowerCase())', '.map(part => part.toLowerCase())'],
  ['Content is offered without styles', "(option.value !== 'content' || availableAddSlideV2Subtypes(options).length > 0)", 'true'],
  ['draft key ignores the deck', "${presentationId ?? 'no-deck'}", 'x'],
  ['draft key ignores the session', "${sessionId ?? 'no-session'}", 'x'],
  ['pristine draft is stored', 'if (isPristineAddSlideV2Draft(draft, options)) storage.removeItem(key)\n    else storage.setItem', 'storage.setItem'],
  ['pristine is measured against a fixed default', 'const initial = initialAddSlideV2Draft(options)\n  return draft.slideType', 'const initial = initialAddSlideV2Draft()\n  return draft.slideType'],
  ['a stored hidden type is restored', "slideType: availableAddSlideV2Types(options).some(option => option.value === slideType) ? slideType as AddSlideV2Type : initial.slideType,", 'slideType: slideType as AddSlideV2Type,'],
  ['a stored hidden style is restored', "contentSubtype: availableAddSlideV2Subtypes(options).some(option => option.value === contentSubtype) ? contentSubtype as AddSlideV2ContentSubtype : initial.contentSubtype,", 'contentSubtype: contentSubtype as AddSlideV2ContentSubtype,'],
  ['the text is lost when a stored choice resets', '      text,\n    }\n  } catch {', "      text: '',\n    }\n  } catch {"],
  ['stored draft ignored', 'const raw = storage?.getItem(key)\n    if (!raw) return initial', 'const raw = null as string | null\n    if (!raw) return initial'],
  ['load not guarded', '} catch {\n    return initial\n  }', '} catch (error) {\n    throw error\n  }'],
  ['save not guarded', '} catch { /* storage unavailable or full: the draft just is not kept */ }', '} catch (error) { throw error }'],
  ['clear not guarded', '} catch { /* nothing to clear */ }', '} catch (error) { throw error }'],
  ['clear does nothing', 'storage?.removeItem(key)\n  } catch', 'void storage\n  } catch'],
  ['Blank always takes the theme background', "if (options.has('blank_theme')) native.backgroundColor = ADD_SLIDE_V2_BLANK_BACKGROUND", 'native.backgroundColor = ADD_SLIDE_V2_BLANK_BACKGROUND'],
  ['Blank never takes the theme background', "if (options.has('blank_theme')) native.backgroundColor = ADD_SLIDE_V2_BLANK_BACKGROUND", ''],
  ['Blank position 0 is dropped', 'if (position !== undefined) native.position = position', 'if (position) native.position = position'],
  ['Blank background is plain white', "ADD_SLIDE_V2_BLANK_BACKGROUND = 'var(--theme-bg, #ffffff)'", "ADD_SLIDE_V2_BLANK_BACKGROUND = '#ffffff'"],
  ['the follow map is unbounded', 'MAX_REMEMBERED_FOLLOWS = 20', 'MAX_REMEMBERED_FOLLOWS = 2000'],
  ['the oldest follow is kept', 'const oldest = follow.keys().next().value\n    if (oldest === undefined) break\n    follow.delete(oldest)', 'const keys = [...follow.keys()]\n    follow.delete(keys[keys.length - 1])'],
  ['flag accepts any truthy value', "process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED"],
]
const panelMutants = [
  ['regenerate ignores its option', "const regen = options.has('regenerate') ? regenerate : undefined", "const regen = regenerate"],
  ['regenerate mode without a target', "const regenerating = mode === 'regenerate' && target !== null", "const regenerating = mode === 'regenerate'"],
  ['the header never says Regenerate', "{regenerating ? 'Regenerate slide' : 'Add slide'}", "{'Add slide'}"],
  ['the context bar forgets the original stays', "in place. The current slide stays until the new one is ready.`}</p>", "in place.`}</p>"],
  ['the context bar claims a run before one starts', "{`Rebuilds slide ${target.slideNumber} in place.", "{`Regenerating slide ${target.slideNumber} in place."],
  ['the failure reason gets no full stop', "{`${withFullStop(regenRun.message)} The original slide was kept. `}", "{`${regenRun.message} The original slide was kept. `}"],
  ['the full stop is always added', "(/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`)", "`${text.trim()}.`"],
  ['the busy hint shows beside our own run', "{regenBlocker && !(regenBuilding && regenBlocker === 'busy') && <p", "{regenBlocker && <p"],
  ['a running regenerate hides every hint', "{regenBlocker && !(regenBuilding && regenBlocker === 'busy') && <p", "{regenBlocker && !regenBuilding && <p"],
  ['the switch shows without a target', "{target && (\n            <div className=\"asv2-modes\"", "{(\n            <div className=\"asv2-modes\""],
  ['the Add / Regenerate switch can be disabled by a run only', "aria-pressed={!regenerating} disabled={busy} onClick", "aria-pressed={!regenerating} disabled={busy || regenBuilding} onClick"],
  ['one box state for every slide', "const regenDraft = target ? (regenDrafts[target.slideId] ?? initialAddSlideV2RegenerateDraft(target, options)) : null", "const regenDraft = target ? initialAddSlideV2RegenerateDraft(target, options) : null"],
  ['every slide shares one draft slot', "[target.slideId]: { ...regenDraft, ...change }", "draft: { ...regenDraft, ...change }"],
  ['an edit keeps the error', "    if (!target || !regenDraft) return\n    setError(null)\n", "    if (!target || !regenDraft) return\n"],
  ['the run never finishes', "    if (runStatus.status === 'ready') dispatchRegenRun({ type: 'ready', jobId: regenRun.jobId, newSlideId: runStatus.newSlideId })\n", ""],
  ['the run never fails', "    else if (runStatus.status === 'failed') dispatchRegenRun({ type: 'fail', jobId: regenRun.jobId, message: runStatus.message })\n", ""],
  ['the run asks about another job', "regen?.jobStatus(regenRun.jobId)", "regen?.jobStatus('x')"],
  ['the run finishes the wrong job', "dispatchRegenRun({ type: 'ready', jobId: regenRun.jobId,", "dispatchRegenRun({ type: 'ready', jobId: 'x',"],
  ['the run forgets the old slide', "dispatchRegenRun({ type: 'start', jobId: result.jobId, oldSlideId: target.slideId })", "dispatchRegenRun({ type: 'start', jobId: result.jobId, oldSlideId: 'x' })"],
  ['the run does not start', "      if (result.ok) {\n        setRunSlideNumber(target.slideNumber)\n        dispatchRegenRun({ type: 'start', jobId: result.jobId, oldSlideId: target.slideId })\n      } else setError(result.message)", "      if (!result.ok) setError(result.message)"],
  ['the run forgets its slide number', "        setRunSlideNumber(target.slideNumber)\n", ""],
  ['the run names the slide on screen', "{`Regenerating slide ${runSlideNumber}. The current slide", "{`Regenerating slide ${target.slideNumber}. The current slide"],
  ['a refusal is not shown', "      } else setError(result.message)\n    } catch (err) {\n      setError(err instanceof Error ? err.message : 'Slide regeneration failed.')", "      }\n    } catch (err) {\n      setError(err instanceof Error ? err.message : 'Slide regeneration failed.')"],
  ['a second run can start while one runs', "if (busy || regenBuilding || regenBlocker || !target || !regenDraft || !regen?.submit) return", "if (busy || regenBlocker || !target || !regenDraft || !regen?.submit) return"],
  ['regenerate can be busy-clicked', "if (busy || regenBuilding || regenBlocker || !target || !regenDraft || !regen?.submit) return", "if (regenBuilding || regenBlocker || !target || !regenDraft || !regen?.submit) return"],
  ['the regenerate button ignores a run', "disabled={busy || regenBuilding || Boolean(regenBlocker)}", "disabled={busy || Boolean(regenBlocker)}"],
  ['the regenerate button ignores a blocker', "disabled={busy || regenBuilding || Boolean(regenBlocker)}", "disabled={busy || regenBuilding}"],
  ['the box stays editable during a run', "disabled={busy || regenBuilding}\n                  aria-describedby={hintId}", "disabled={busy}\n                  aria-describedby={hintId}"],
  ['the failure forgets the original', "{`${withFullStop(regenRun.message)} The original slide was kept. `}", "{`${withFullStop(regenRun.message)} `}"],
  ['the failure hides the reason', "{`${withFullStop(regenRun.message)} The original slide was kept. `}", "{`The original slide was kept. `}"],
  ['the ready line names no slide', "{`Regenerated. The new slide replaced slide ${runSlideNumber}. `}", "{`Regenerated. `}"],
  ['the building line is missing', "{regenRun.status === 'building' && (", "{false && ("],
  ['the ready line is never shown', "{regenRun.status === 'ready' && target.slideNumber === runSlideNumber && (", "{false && ("],
  ['the ready line follows the user to every slide', "{regenRun.status === 'ready' && target.slideNumber === runSlideNumber && (", "{regenRun.status === 'ready' && ("],
  ['the failure follows the user to every slide', "{regenRun.status === 'failed' && target.slideNumber === runSlideNumber && (", "{regenRun.status === 'failed' && ("],
  ['the failure is never shown', "{regenRun.status === 'failed' && target.slideNumber === runSlideNumber && (", "{false && ("],
  ['the failure cannot be dismissed', "<button type=\"button\" className=\"asv2-discard\" onClick={() => dispatchRegenRun({ type: 'dismiss' })}>Dismiss</button>", ""],
  ['the Add footer shows while regenerating', "{!regenerating && (showBlank || showCatalog) && (", "{(showBlank || showCatalog) && ("],
  ['a hero gets a style picker', "{target.kind === 'content' && styles.length > 0 && (", "{styles.length > 0 && ("],
  ['the regenerate style is not wired', "onChange={() => editRegenDraft({ contentSubtype: option.value })}", "onChange={() => {}}"],
  ['the regenerate box is not wired', "onChange={event => editRegenDraft({ text: event.target.value })}", "onChange={() => {}}"],
  ['the original text cannot be restored', "onClick={() => editRegenDraft({ text: target.instruction })}", "onClick={() => {}}"],
  ['restore shows without a change', "{target.instruction && regenDraft.text !== target.instruction && (", "{target.instruction && ("],
  ['restore shows with no original', "{target.instruction && regenDraft.text !== target.instruction && (", "{regenDraft.text !== target.instruction && ("],
  ['Cmd+Enter always adds', "void (regenerating ? regenerateSlide() : generate())", "void generate()"],
  ['the regenerate box is not focused', "useEffect(() => { if (regenerating) textRef.current?.focus() }, [regenerating])", "useEffect(() => {}, [regenerating])"],
  ['the Entry ignores the option', "const regenSettings = options.has('regenerate') ? settings.regenerate : undefined", "const regenSettings = settings.regenerate"],
  ['the Entry resolves only while open', "const regenTarget = regenSettings ? regenSettings.resolveTarget(", "const regenTarget = panelOpen && regenSettings ? regenSettings.resolveTarget("],
  ['the Entry resolves only with a host', "const regenTarget = regenSettings ? regenSettings.resolveTarget(", "const regenTarget = regenSettings && settings.panelHost ? regenSettings.resolveTarget("],
  ['the Entry resolves the wrong slide', "regenSettings.resolveTarget(Math.max(0, currentSlide - 1), slides ?? [])", "regenSettings.resolveTarget(currentSlide, slides ?? [])"],
  ['the Entry sends no rows', "regenSettings.resolveTarget(Math.max(0, currentSlide - 1), slides ?? [])", "regenSettings.resolveTarget(Math.max(0, currentSlide - 1), [])"],
  ['the Entry sends undefined rows', "regenSettings.resolveTarget(Math.max(0, currentSlide - 1), slides ?? [])", "regenSettings.resolveTarget(Math.max(0, currentSlide - 1), slides as never)"],
  ['the Entry drops the submit', "regenerate={regenSettings ? { target: regenTarget, submit: regenSettings.submit, jobStatus: regenSettings.jobStatus } : undefined}", "regenerate={regenSettings ? { target: regenTarget, jobStatus: regenSettings.jobStatus } : undefined}"],
  ['the Entry drops the job status', "regenerate={regenSettings ? { target: regenTarget, submit: regenSettings.submit, jobStatus: regenSettings.jobStatus } : undefined}", "regenerate={regenSettings ? { target: regenTarget, submit: regenSettings.submit, jobStatus: () => null } : undefined}"],
  ['slide change keeps the stale error', "    setError(null)\n    setQueued(null)\n  }, [context.currentSlide])", "    setQueued(null)\n  }, [context.currentSlide])"],
  ['slide change keeps the Queued note', "    setError(null)\n    setQueued(null)\n  }, [context.currentSlide])", "    setError(null)\n  }, [context.currentSlide])"],
  ['notes cleared on every render', "}, [context.currentSlide])", "})"],
  ['typing keeps the error', "onChange={event => { setQueued(null); setError(null); dispatch", "onChange={event => { setQueued(null); dispatch"],
  ['Generate no longer gated', 'disabled={busy || Boolean(blocker)}', 'disabled={busy}'],
  ['second free-text box', '<p id={hintId} className="asv2-hint">', '<textarea className="asv2-extra" /><p id={hintId} className="asv2-hint">'],
  ['research becomes editable', '<li key={row.key} data-on={row.on ? \'true\' : \'false\'}>', '<li key={row.key} data-on={row.on ? \'true\' : \'false\'}><input type="checkbox" />'],
  ['blank not offered', '{ADD_SLIDE_V2_BLANK_LABEL}', ''],
  ['placement note missing', '<p className="text-xs text-blue-800">{addSlideV2PlacementNote(context.currentSlide)}</p>', ''],
  ['sub-types shown for every type', "{draft.slideType === 'content' && styles.length > 0 && (", '{styles.length > 0 && ('],
  ['blank ignores the picker disabled state', 'className="asv2-blank" disabled={busy}', 'className="asv2-blank"'],
  ['draft not restored', '() => initialDraft ?? loadAddSlideV2Draft(storage, draftKey, options)', '() => initialDraft ?? initialAddSlideV2Draft(options)'],
  ['draft not kept as you type', 'useEffect(() => { saveAddSlideV2Draft(storage, draftKey, draft, options) }, [storage, draftKey, draft, options])', 'useEffect(() => {}, [storage, draftKey, draft, options])'],
  ['a successful Generate keeps the draft', "        dispatch({ type: 'reset' })\n        clearAddSlideV2Draft(storage, draftKey)\n", ''],
  ['a failed Generate clears the draft', 'setError(result.message)', 'setError(result.message); clearAddSlideV2Draft(storage, draftKey)'],
  ['Discard keeps the stored draft', "    dispatch({ type: 'reset' })\n    clearAddSlideV2Draft(storage, draftKey)\n    setError(null)\n    setQueued(null)", "    dispatch({ type: 'reset' })\n    setError(null)\n    setQueued(null)"],
  ['Discard shown on a pristine draft', '{dirty && <button', '{!dirty && <button'],
  ['Discard never shown', '{dirty && <button', '{false && <button'],
  ['a refused Blank is silent', 'if (outcome && outcome.ok === false) setError(outcome.message)', ''],
  ['Blank clears the draft', 'const outcome = await onInsertBlank()', 'const outcome = await onInsertBlank(); clearAddSlideV2Draft(storage, draftKey)'],
  ['Blank ignores the busy state', 'async function insertBlank() {\n    if (busy) return', 'async function insertBlank() {'],
  ['sessionStorage property unguarded', '} catch {\n    return null\n  }\n}', '} catch (error) {\n    throw error\n  }\n}'],
  ['layout picker mode creeps in', '<footer className="asv2-footer">', '<footer className="asv2-footer"><button type="button">Choose a layout</button>'],
  ['the catalog link ignores its option', "const showCatalog = options.has('catalog') && Boolean(onBrowseCatalog)", 'const showCatalog = Boolean(onBrowseCatalog)'],
  ['the catalog link shows without a handler', "const showCatalog = options.has('catalog') && Boolean(onBrowseCatalog)", "const showCatalog = options.has('catalog')"],
  ['Blank ignores its option', "const showBlank = options.has('blank')", 'const showBlank = true'],
  ['Escape is ignored', "if (event.key !== 'Escape' || pending || event.defaultPrevented) return\n", "return\n"],
  ['Escape closes a generating panel', "event.key !== 'Escape' || pending || event.defaultPrevented", "event.key !== 'Escape' || event.defaultPrevented"],
  ['Escape closes over a Radix layer', "event.key !== 'Escape' || pending || event.defaultPrevented", "event.key !== 'Escape' || pending"],
  ['Escape closes a hidden drawer', "      if (rootRef.current?.closest('[data-studio-v4-shell=\"true\"] [data-studio-workspace-visible=\"false\"]')) return\n", ""],
  ['Escape ignores the panel root', "        ref={rootRef}\n", ""],
  ['Escape is not consumed', "      event.preventDefault()\n      onClose()", "      onClose()"],
  ['Escape reacts to every key', "event.key !== 'Escape' || pending", "pending"],
  ['the Escape listener is never removed', "return () => window.removeEventListener('keydown', onKeyDown)", "return undefined"],
  ['the Escape listener goes stale', "  }, [pending, onClose])", "  }, [])"],
  ['a Diagram shows research on', '.map(row => diagram ? { ...row, on: false } : row)', '.map(row => row)'],
  ['the Diagram note is missing', '{diagram && <p className="asv2-note">Diagrams are built without research.</p>}', ''],
  ['the queued note is missing', "setQueued(`Queued. It appears right after slide ${context.currentSlide} when it is ready.`)", ''],
  ['a successful Generate closes the panel', "setQueued(`Queued.", "onClose(); setQueued(`Queued."],
  ['the panel does not take focus', 'useEffect(() => { textRef.current?.focus() }, [])', 'useEffect(() => {}, [])'],
  ['the hint is hidden', '{blocker && <p id={`${ids}-blocker`}', '{false && <p id={`${ids}-blocker`}'],
  ['the toolbar button never closes the panel', 'onClick={() => settings.onPanelOpenChange(!settings.panelOpen)}', 'onClick={() => settings.onPanelOpenChange(true)}'],
  ['the panel renders into the wrong place', '        settings.panelHost,\n      )}', '        { id: \'somewhere-else\' } as unknown as HTMLElement,\n      )}'],
  ['the panel renders while closed', 'const panelOpen = settings.panelOpen && Boolean(settings.panelHost)', 'const panelOpen = Boolean(settings.panelHost)'],
  ['Blank ignores the placeholder resolver', "const target = settings.resolveBlankTarget?.(Math.max(0, currentSlide - 1)) ?? { ok: true as const, position: undefined }", 'const target = { ok: true as const, position: undefined }'],
  ['the Blank resolver gets the wrong slide', 'settings.resolveBlankTarget?.(Math.max(0, currentSlide - 1))', 'settings.resolveBlankTarget?.(currentSlide)'],
  ['a refused Blank is still inserted', "if (!target.ok) return { ok: false as const, message: target.message }\n", ''],
  ['Blank loses the deck theme', 'addSlideV2BlankNativeOptions(target.position, options)', 'target.position === undefined ? undefined : { position: target.position }'],
  ['the toolbar stays disabled after a Blank', '    } finally {\n      setAdding(false)\n    }', '    } finally {\n    }'],
  ['the catalog link never clicks the picker', "catalogRef.current?.querySelector('button')?.click()", 'undefined'],
  ['the classic picker is not hidden from assistive tech', 'aria-hidden="true" className="asv2-catalog-anchor"', 'className="asv2-catalog-anchor"'],
  ['closing the panel does nothing', 'onClose={() => settings.onPanelOpenChange(false)}', 'onClose={() => {}}'],
  ['the panel is not remounted per deck', '          key={addSlideV2DraftKey(context.sessionId, context.presentationId)}\n', ''],
]
const submitMutants = [
  ['regenerate posts to compose', "export const ADD_SLIDE_V2_REFINE_ENDPOINT = '/api/slides/refine'", "export const ADD_SLIDE_V2_REFINE_ENDPOINT = '/api/slides/compose'"],
  ['regenerate needs no deck', "  if (!request.presentationId) return FAIL('No active presentation is available to regenerate.')\n", ''],
  ['regenerate ignores a changed selection', "  if (selection.visualIndex !== request.visualIndex) {\n    return FAIL('The selected slide changed. Select the slide you want to regenerate and try again.')\n  }\n", ''],
  ['regenerate accepts a placeholder', "  if (resolved?.kind !== 'slide') {\n    return FAIL('Select a finished slide to regenerate.", "  if (false) {\n    return FAIL('Select a finished slide to regenerate."],
  ['regenerate ignores a shifted deck', "  if (resolved.layoutIndex !== request.target.layoutIndex) {", "  if (false) {"],
  ['regenerate allows a second refine of one slide', "  if (isRegenerating(selection.jobs, request.target.slideId, resolved.layoutIndex)) {", "  if (false) {"],
  ['regenerate sends the visual index', "buildAddSlideV2RefineBody(request, resolved.layoutIndex)", "buildAddSlideV2RefineBody(request, selection.visualIndex)"],
  ['regenerate posts to compose too', "postAsyncSlideJob(ADD_SLIDE_V2_REFINE_ENDPOINT, body, deps, isCurrentSession)", "postAsyncSlideJob(ADD_SLIDE_V2_COMPOSE_ENDPOINT, body, deps, isCurrentSession)"],
  ['regenerate accepts a compose reply', "  if (data.kind && data.kind !== 'refine') {", "  if (false) {"],
  ['regenerate registers a compose job', "    kind: 'refine',\n    target_slide_id: data.target_slide_id ?? request.target.slideId,", "    kind: data.kind ?? 'compose',\n    target_slide_id: data.target_slide_id ?? request.target.slideId,"],
  ['regenerate forgets the requested slide', "    target_slide_id: data.target_slide_id ?? request.target.slideId,", "    target_slide_id: data.target_slide_id,"],
  ['regenerate ignores the backend slide', "    target_slide_id: data.target_slide_id ?? request.target.slideId,", "    target_slide_id: request.target.slideId,"],
  ['regenerate returns no job id', "  return { ok: true, jobId: data.job_id }", "  return { ok: true, jobId: '' }"],
  ['regenerate title is not capped', "    title: body.instruction.slice(0, 72) || 'Regenerating slide',", "    title: body.instruction || 'Regenerating slide',"],
  ['regenerate loses the visual slide', "  }, { submitVisualIndex: selection.visualIndex })\n  return { ok: true, jobId: data.job_id }", "  }, { submitVisualIndex: 0 })\n  return { ok: true, jobId: data.job_id }"],
  ['a refine on another slide blocks', "    if (job.target_slide_id) return job.target_slide_id === slideId", "    if (job.target_slide_id) return true"],
  ['a finished refine blocks', "    if (job.kind !== 'refine' || job.status !== 'building') return false", "    if (job.kind !== 'refine') return false"],
  ['a compose job blocks', "    if (job.kind !== 'refine' || job.status !== 'building') return false", "    if (job.status !== 'building') return false"],
  ['a refine with no slide id never blocks', "    return job.target_layout_index === layoutIndex || job.targetLayoutIndex === layoutIndex || job.targetIndex === layoutIndex", "    return false"],
  ['the target resolver ignores placeholders', "  const resolved = resolveSlideComposeVisualIndex(input.visualIndex, { slideCount: input.slides.length, jobs: input.jobs })\n  if (resolved?.kind !== 'slide') return null", "  const resolved = { kind: 'slide' as const, layoutIndex: input.visualIndex }"],
  ['the target slide id is not trimmed', "  const slideId = row?.slideId?.trim()", "  const slideId = row?.slideId"],
  ['the target number is the layout index', "    slideNumber: input.visualIndex + 1,", "    slideNumber: resolved.layoutIndex + 1,"],
  ['the page record is ignored', "  const generated = input.store.slides.get(slideId)", "  const generated = undefined as undefined | { kind: AddSlideV2Type; instruction: string }"],
  ['the deck context is looked up by position', "  const entry = input.store.context.get(slideId)\n", "  const entry = input.store.context.get(String(resolved.layoutIndex))\n"],
  ['the context kind is ignored', "    kind: addSlideV2KindFromCanvas(entry.canvas_type),", "    kind: 'content',"],
  ['the context message is not trimmed', "entry.key_message.trim()", "entry.key_message"],
  ['the context message may be anything', "typeof entry.key_message === 'string' ?", "entry.key_message ?"],
  ['the context source is not marked', "    source: 'context',", "    source: 'compose',"],
  ['the compose record is marked as context', "return { ...base, kind: generated.kind, instruction: generated.instruction, source: 'compose' }", "return { ...base, kind: generated.kind, instruction: generated.instruction, source: 'context' }"],
  ['the hooks offer submit without the refiner', "    submit: deps.regenerateEnabled ? request => submitAddSlideV2Regenerate(request, deps) : undefined,", "    submit: request => submitAddSlideV2Regenerate(request, deps),"],
  ['the hooks never remember the deck context', "      rememberAddSlideV2DeckContext(deps.store, slides, deps.contextByIndex())\n", ""],
  ['the hooks hide the deck context', "rememberAddSlideV2DeckContext(deps.store, slides, deps.contextByIndex())", "rememberAddSlideV2DeckContext(deps.store, slides, null)"],
  ['a tracked job is not building', "      if (job) return { status: 'building' }", "      if (job?.status === 'building') return { status: 'building' }"],
  ['the finished job is not reported', "      const newSlideId = deps.store.completed.get(jobId)\n      if (newSlideId) return { status: 'ready', newSlideId }\n", ""],
  ['the failed job is not reported', "      const failure = deps.store.failed.get(jobId)\n      return failure ? { status: 'failed', message: failure } : null", "      return null"],
  ['a failed job has no default reason', "|| 'The slide could not be regenerated.' }\n      }\n      if (job) return", "|| '' }\n      }\n      if (job) return"],
  ['a failed job keeps empty reasons', "job.errors?.filter(Boolean).join('; ')", "job.errors?.join('; ')"],
  ['a failed job in the map reads as building', "      if (job?.status === 'error') {", "      if (false) {"],
  ['session fence ignored', 'const isCurrentSession = deps.captureSessionOwner()', 'const isCurrentSession = () => true; deps.captureSessionOwner()'],
  ['owner captured after the await', [['const isCurrentSession = deps.captureSessionOwner()', 'let isCurrentSession = () => true'], ['  if (timedOut) return FAIL(ADD_SLIDE_V2_TIMEOUT_MESSAGE)\n', '  if (timedOut) return FAIL(ADD_SLIDE_V2_TIMEOUT_MESSAGE)\n  isCurrentSession = deps.captureSessionOwner()\n']]],
  ['visual index used as the anchor', 'const anchor = resolveAddSlideV2Anchor({', 'const anchor = { ok: true as const, insertAfterIndex: request.anchorVisualIndex }\n  void ({'],
  ['selected placeholder allowed through', "if (resolved?.kind === 'compose') {", 'if (false) {'],
  ['popup/page selection mismatch ignored', 'if (request.presentationId && selection.visualIndex !== request.anchorVisualIndex) {', 'if (false) {'],
  ['needs_input treated as an error shape', 'if (isNeedsInputResponse(data)) {', 'if (false) {'],
  ['minted job id not checked', 'data.job_id !== jobId || ', 'false || '],
  ['reply session not checked', 'data.session_id !== body.session_id', 'false'],
  ['reply deck not checked', 'data.presentation_id !== body.presentation_id', 'false'],
  ['admission ignored', 'if (!deps.isSessionAdmitted(body.session_id)) {', 'if (false) {'],
  ['HTTP error ignored', 'if (!response.ok) return FAIL(composeErrorMessage(data))', ''],
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
  ['a built job counts as a placeholder', "job.status === 'building' || job.status === 'error')", "job.status === 'building' || job.status === 'error' || job.status === 'built')"],
  ['submit offered without generation enabled', 'submit: deps.generationEnabled ? request => submitAddSlideV2(request, submitDeps) : undefined,', 'submit: request => submitAddSlideV2(request, submitDeps),'],
  ['the submit-time slide is wrong', '}, { submitVisualIndex: selection.visualIndex })', '}, { submitVisualIndex: selection.visualIndex + 1 })'],
  ['the follow slide is not remembered', 'if (deps.follow) rememberAddSlideV2Follow(deps.follow, job.job_id, meta.submitVisualIndex)', ''],
  ['the follow slide is filed under another job', 'rememberAddSlideV2Follow(deps.follow, job.job_id, meta.submitVisualIndex)', "rememberAddSlideV2Follow(deps.follow, 'other', meta.submitVisualIndex)"],
  ['the factory swallows onAccepted', '      deps.onAccepted(job, meta)\n    },', '    },'],
  ['Blank resolver dropped from the factory', 'resolveBlankTarget: expectedVisualIndex => resolveAddSlideV2BlankTarget({', 'resolveBlankTarget: expectedVisualIndex => (() => ({ ok: true as const, position: undefined }))({'],
  ['lost reply retried', '} catch {\n    return FAIL(timedOut', "} catch {\n    await deps.fetchImpl(ADD_SLIDE_V2_COMPOSE_ENDPOINT, { method: 'POST', headers: {}, body: '{}' })\n    return FAIL(timedOut"],
  ['failed placeholder reads as pending', "if (selected?.kind === 'compose' && selected.job.status === 'error') {", 'if (false) {'],
  ['every placeholder reads as failed', "selected?.kind === 'compose' && selected.job.status === 'error'", "selected?.kind === 'compose'"],
  ['backend detail ignored', 'const detail = known ? null : detailText(body.detail)', 'const detail = null'],
  ['backend detail beats the known fields', 'const detail = known ? null : detailText(body.detail)', 'const detail = detailText(body.detail)'],
  ['backend detail not capped', 'return text.length > 300 ? `${text.slice(0, 297)}...` : text', 'return text'],
  ['detail ignored on a refused 200', 'if (!isAcceptedResponse(data)) return FAIL(composeErrorMessage(data))', 'if (!isAcceptedResponse(data)) return FAIL(responseErrorMessage(data))'],
  ['no abort signal', '      signal: controller.signal,\n', ''],
  ['timeout never fires', 'setTimeout(() => { timedOut = true; controller.abort() }, deps.timeoutMs ?? ADD_SLIDE_V2_ACCEPT_TIMEOUT_MS)', 'setTimeout(() => {}, deps.timeoutMs ?? ADD_SLIDE_V2_ACCEPT_TIMEOUT_MS)'],
  ['timeout reported as a lost reply', 'FAIL(timedOut ? ADD_SLIDE_V2_TIMEOUT_MESSAGE : ADD_SLIDE_V2_LOST_REPLY_MESSAGE)', 'FAIL(ADD_SLIDE_V2_LOST_REPLY_MESSAGE)'],
  ['timer never cleared', '    clearTimeout(timer)\n', ''],
  ['stalled body not bounded', '  if (timedOut) return FAIL(ADD_SLIDE_V2_TIMEOUT_MESSAGE)\n  if (!isCurrentSession()) {', '  if (!isCurrentSession()) {'],
  ['budget is not the existing fast one', 'ADD_SLIDE_V2_ACCEPT_TIMEOUT_MS = FAST_ELEMENT_GENERATION_TIMEOUT_MS', 'ADD_SLIDE_V2_ACCEPT_TIMEOUT_MS = 300_000'],
  ['unmapped body still sent', 'if (!body) return FAIL("This slide can\'t be generated yet.")', ''],
]
const regenMutants = [
  ['the old slide may be deleted while building', 'return state.status === \'ready\'', 'return state.status !== \'idle\''],
  ['a second start replaces the running one', "if (state.status === 'building' || !action.jobId || !action.oldSlideId) return state", 'if (!action.jobId || !action.oldSlideId) return state'],
  ['any job can finish the run', "if (state.status !== 'building' || state.jobId !== action.jobId) return state\n      if (!action.newSlideId", "if (state.status !== 'building') return state\n      if (!action.newSlideId"],
  ['the new slide may equal the old one', ' || action.newSlideId === state.oldSlideId', ''],
  ['a failure says nothing', "message: action.message || 'The slide could not be regenerated.'", 'message: action.message'],
  ['a failed run deletes the old slide', "if (state.status !== 'ready') return unchanged", "if (state.status === 'failed') return { order: unchanged.order.filter(id => id !== state.oldSlideId), deleteIds: [state.oldSlideId] }\n  if (state.status !== 'ready') return unchanged"],
  ['the swap appends instead of replacing in place', 'order.splice(order.indexOf(state.oldSlideId), 1, state.newSlideId)', 'order.push(state.newSlideId); order.splice(order.indexOf(state.oldSlideId), 1)'],
  ['the old slide is deleted though the new one is missing', ' || !slideIds.includes(state.newSlideId)', ''],
  ['the overlay stays after the swap is due', "return state.status === 'building' ? state.oldSlideId : null", "return state.status !== 'idle' ? state.oldSlideId : null"],
  ['a running overlay can be dismissed', "return state.status === 'ready' || state.status === 'failed' ? ADD_SLIDE_V2_REGENERATE_IDLE : state", 'return ADD_SLIDE_V2_REGENERATE_IDLE'],
  ['a ready run can still fail', "case 'fail':\n      if (state.status !== 'building' || state.jobId !== action.jobId) return state", "case 'fail':\n      if (state.jobId !== action.jobId) return state"],
]
let caught = 0
function mutate(source, [name, from, to], label) {
  const pairs = Array.isArray(from) ? from : [[from, to]]
  let out = source
  for (const [a, b] of pairs) {
    assert.ok(out.includes(a), `mutant "${name}" no longer matches the ${label} source`)
    // Every occurrence: the Add and the Regenerate forms share some markup, and a mutant must break both.
    out = out.split(a).join(b)
  }
  return out
}
for (const mutant of libMutants) {
  const broken = mutate(LIB, mutant, 'lib')
  let lib
  try { lib = load(broken, { env: ALL_ENV }) } catch { caught++; continue }
  const seen = checks
  assert.throws(() => {
    libSuite(lib); regenerateLibSuite(lib)
    if (mutant[0].startsWith('flag')) assert.equal(load(broken, { env: { [FLAG]: 'false' } }).ADD_SLIDE_V2_ENABLED, false)
    if (mutant[0].startsWith('regen flag')) {
      assert.equal(load(broken, { env: {} }).ADD_SLIDE_V2_REGENERATE_ENABLED, false)
      assert.equal(load(broken, { env: { [REGEN_FLAG]: 'true' } }).ADD_SLIDE_V2_REGENERATE_ENABLED, true)
      assert.equal(load(broken, { env: { [REGEN_FLAG]: 'TRUE' } }).ADD_SLIDE_V2_REGENERATE_ENABLED, false)
    }
  }, undefined, `lib mutant survived: ${mutant[0]}`)
  checks = seen
  caught++
}
for (const mutant of panelMutants) {
  const broken = mutate(PANEL, mutant, 'component')
  const seen = checks
  let survived = false
  try { markupSuite(broken, realLib); await panelInteractionSuite(broken, realLib); await entrySuite(broken, realLib); await regeneratePanelSuite(broken, realLib); await regenerateEntrySuite(broken, realLib); survived = true } catch { /* caught */ }
  assert.equal(survived, false, `component mutant survived: ${mutant[0]}`)
  checks = seen
  caught++
}
for (const mutant of submitMutants) {
  const broken = mutate(SUBMIT, mutant, 'submit')
  const seen = checks
  let survived = false
  try { await submitSuite(submitModule(broken, realLib), realLib); await regenerateSubmitSuite(submitModule(broken, realLib), realLib); survived = true } catch { /* caught */ }
  assert.equal(survived, false, `submit mutant survived: ${mutant[0]}`)
  checks = seen
  caught++
}
for (const mutant of regenMutants) {
  const broken = mutate(REGEN, mutant, 'regenerate')
  const seen = checks
  assert.throws(() => regenSuite(load(broken)), undefined, `regenerate mutant survived: ${mutant[0]}`)
  checks = seen
  caught++
}
for (const mutant of pageMutants) {
  const broken = mutate(PAGE, mutant, 'page')
  const seen = checks
  assert.throws(() => regeneratePagePins(broken), undefined, `page mutant survived: ${mutant[0]}`)
  checks = seen
  caught++
}
check(assert.equal, caught, libMutants.length + panelMutants.length + submitMutants.length + regenMutants.length + pageMutants.length)

console.log(`studio-add-slide-v2: ${checks} checks passed, ${caught} mutants caught (${libMutants.length} lib, ${panelMutants.length} panel/entry, ${submitMutants.length} submit, ${regenMutants.length} regenerate, ${pageMutants.length} page)`)
