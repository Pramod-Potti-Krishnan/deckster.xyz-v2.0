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
const OPT_IN_ENV = 'NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED_OPTIONS'
// Every option on (the default hides the stage-2 ones; "none" shows them all), so the suites can reach every style.
const ALL_ENV = { [DISABLED_ENV]: 'none' }
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
const ENVEX = read('../.env.example')
const PICKER = read('../components/slide-layout-picker.tsx')
const VIEWER = read('../components/presentation-viewer.tsx')
const AREA = read('../components/builder/presentation-area.tsx')
const PAGE = read('../app/builder/page.tsx')
const ASYNC = read('../lib/slide-compose-async.ts')

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
  const resolve = (disabled, optIn) => [...lib.resolveAddSlideV2Options(disabled, optIn)]
  const STAGE1 = ['title', 'section', 'closing', 'content', 'auto', 'text', 'image_left', 'image_right', 'blank', 'catalog', 'blank_theme']
  check(assert.deepEqual, resolve(undefined), STAGE1, 'DEC-P8: unset = stage 1 on, stage 2 hidden, the regenerate scaffold off')
  check(assert.deepEqual, resolve(null), STAGE1, 'null counts as unset')
  check(assert.deepEqual, resolve('none'), [...STAGE1, 'chart', 'infographic', 'table', 'diagram'].sort((a, b) => ids.indexOf(a) - ids.indexOf(b)), '"none" shows every stage')
  check(assert.deepEqual, resolve(''), STAGE1, 'a blank value counts as unset: stage 2 stays hidden (an emptied variable is not "show everything")')
  check(assert.deepEqual, resolve('  , ,'), resolve('none'), 'a list of only separators is an explicit list of nothing')
  check(assert.deepEqual, resolve('   '), STAGE1, 'whitespace only counts as blank')
  check(assert.equal, resolve('table,diagram').includes('chart'), true, 'an explicit list REPLACES the stage-2 default (chart is back on)')
  check(assert.equal, resolve('table,diagram').includes('table'), false)
  check(assert.equal, resolve('table,diagram').includes('diagram'), false)
  check(assert.equal, resolve(' Table , DIAGRAM ,, ').includes('table'), false, 'ids are trimmed, lower-cased, empty entries ignored')
  check(assert.equal, resolve('bogus,table').includes('chart'), true, 'unknown ids are ignored')
  check(assert.equal, resolve('regenerate').includes('regenerate'), false, 'regenerate is opt-in, not "everything not disabled"')
  check(assert.equal, resolve('none', 'regenerate').includes('regenerate'), true, 'the opt-in list turns the scaffold on')
  check(assert.equal, resolve('regenerate', 'regenerate').includes('regenerate'), false, 'the kill switch still wins over the opt-in')
  check(assert.equal, resolve('none', 'chart').includes('table'), true, 'an opt-in list does not hide anything')
  for (const id of ids.filter(i => i !== 'regenerate')) {
    check(assert.equal, resolve('none').includes(id), true, `${id} is on in the full set`)
    check(assert.equal, resolve(id).includes(id), false, `NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_DISABLED_OPTIONS=${id} hides ${id}`)
    check(assert.equal, resolve(`${id},${id === 'blank' ? 'catalog' : 'blank'}`).includes(id), false, `${id} hidden inside a list`)
  }
  const allOn = lib.resolveAddSlideV2Options('none')
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
      'lucide-react': { Layout: icon('layout'), Plus: icon('plus'), Sparkles: icon('sparkles'), Square: icon('square'), X: icon('x') },
      '@/lib/utils': { cn: (...a) => a.filter(Boolean).join(' ') },
      '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [] },
      '@/lib/studio-add-slide-v2': lib,
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
  const everyOn = lib.resolveAddSlideV2Options('none')
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
    useEffect(setup, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { slots[i] = { deps }; queued.push(setup) } },
  }
  const jsx = (type, p, key) => ({ type, props: p ?? {}, key })
  const icon = () => null
  const mod = load(panelSource, { imports: {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-dom': { createPortal: (node, host) => ({ portal: true, host, node }) },
    'lucide-react': { Layout: icon, Plus: icon, Sparkles: icon, Square: icon, X: icon },
    '@/lib/utils': { cn: (...a) => a.filter(Boolean).join(' ') }, '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [] },
    '@/lib/studio-add-slide-v2': lib, '@/components/builder/studio-panels.css': {}, './studio-add-slide-v2.css': {},
  } })
  let tree
  const focused = []
  // React attaches refs before effects run; do the same, with a fake element that records focus() and can click a button.
  const attachRefs = node => {
    if (!node || typeof node !== 'object') return
    const ref = node.props?.ref
    if (ref && typeof ref === 'object' && !ref.current) {
      ref.current = { tag: node.type, focus() { focused.push(node.type) }, querySelector: selector => (selector === 'button' ? props.catalogButton ?? null : null) }
    }
    const c = node.props?.children
    for (const child of Array.isArray(c) ? c.flat(Infinity) : [c]) attachRefs(child)
  }
  const rt = {
    closed: 0,
    focused,
    render() {
      let guard = 0
      do { cursor = 0; dirty = false; tree = mod[component]({ ...props }); attachRefs(tree); while (queued.length) queued.shift()() } while (dirty && ++guard < 30)
      return tree
    },
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

  // DEC-P1: the catalog link calls the handler; Escape closes (not while generating)
  let browsed = 0, closes = 0
  rt = mountPanel(panelSource, lib, base(mem(), { onBrowseCatalog() { browsed++ }, onClose() { closes++ } }))
  await rt.click('asv2-catalog')
  check(assert.equal, browsed, 1, 'the link opens the classic picker')
  check(assert.equal, closes, 0, 'opening the catalog does not close the panel')
  const root = () => rt.one(n => n.props?.['data-studio-add-slide-v2'] === 'true')
  root().props.onKeyDown({ key: 'Escape' })
  check(assert.equal, closes, 1, 'Escape closes the panel')
  root().props.onKeyDown({ key: 'a' })
  check(assert.equal, closes, 1, 'other keys do not')
  let release; const slow = new Promise(resolve => { release = resolve })
  rt = mountPanel(panelSource, lib, base(mem(), { onClose() { closes++ }, submit: () => slow }))
  rt.pick('chart'); rt.type('Slow slide')
  const clicking = rt.click('asv2-generate')
  await Promise.resolve()
  rt.render()
  check(assert.equal, rt.byClass('asv2-generate').props.children.at(-1), 'Generating…', 'pending label')
  root().props.onKeyDown({ key: 'Escape' })
  check(assert.equal, closes, 1, 'Escape does not close a panel that is generating')
  release({ ok: true }); await clicking
  const offCatalog = mountPanel(panelSource, lib, base(mem(), { onBrowseCatalog() {}, options: new Set([...lib.resolveAddSlideV2Options('none')].filter(x => x !== 'catalog')) }))
  check(assert.equal, offCatalog.maybeClass('asv2-catalog'), null, 'the catalog kill switch hides the link')
  const offBlank = mountPanel(panelSource, lib, base(mem(), { options: new Set([...lib.resolveAddSlideV2Options('none')].filter(x => x !== 'blank')) }))
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
  rt = mountPanel(panelSource, lib, base(s8, { options: lib.resolveAddSlideV2Options('none') }))
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

// ---- 1. the lib is import-free, the flag and the kill switches are read exactly ---------------------------------------
check(assert.equal, /^\s*import\s/m.test(LIB), false, 'the lib must stay import-free')
check(assert.equal, /^\s*import\s/m.test(REGEN), false, 'the regenerate module must stay import-free')
check(assert.match, LIB, /process\.env\.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true'/, 'literal env access so Next inlines it')
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
for (const id of ['title', 'section', 'closing', 'content', 'auto', 'text', 'image_left', 'image_right', 'chart', 'infographic', 'table', 'diagram', 'blank', 'catalog', 'blank_theme']) {
  const on = optionsFrom({ [DISABLED_ENV]: id })
  check(assert.equal, on.includes(id), false, `env ${DISABLED_ENV}=${id} hides ${id}`)
  check(assert.equal, on.length >= STAGE1_IDS.length - 1, true, 'and only that id (an explicit list replaces the stage-2 default)')
}
check(assert.deepEqual, optionsFrom({ [DISABLED_ENV]: 'table,diagram' }).filter(id => ['chart', 'infographic', 'table', 'diagram'].includes(id)), ['chart', 'infographic'], 'table,diagram hidden, chart and infographic shown')
check(assert.equal, optionsFrom({ [DISABLED_ENV]: 'none' }).length, 15, 'none = every non-opt-in option')
check(assert.equal, optionsFrom({ [DISABLED_ENV]: 'none', [OPT_IN_ENV]: 'regenerate' }).includes('regenerate'), true, 'regenerate needs the opt-in env')
check(assert.equal, optionsFrom({ [DISABLED_ENV]: 'none' }).includes('regenerate'), false, 'regenerate is off by default')
// the documentation names every id and both env vars
for (const needle of [DISABLED_ENV, OPT_IN_ENV, FLAG, ...['title', 'section', 'closing', 'content', 'auto', 'text', 'image_left', 'image_right', 'chart', 'infographic', 'table', 'diagram', 'blank', 'catalog', 'blank_theme', 'regenerate']]) {
  check(assert.equal, ENVEX.includes(needle), true, `.env.example documents ${needle}`)
}
check(assert.match, ENVEX, /\n# NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_DISABLED_OPTIONS="table,diagram"\n/, 'the example line is commented out: copying .env.example must not change the default')
check(assert.equal, /\nNEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_(DISABLED|ENABLED)_OPTIONS=/.test(ENVEX), false, 'neither list is set by the example file')

// ---- 2. behaviour on the real sources ----------------------------------------------------------------------------
const realLib = load(LIB, { env: ALL_ENV })
libSuite(realLib)
markupSuite(PANEL, realLib)
check(assert.equal, /^\s*import\s/m.test(SUBMIT), true, 'the submit module imports the page helpers it reuses')
await submitSuite(submitModule(SUBMIT, realLib), realLib)
await panelInteractionSuite(PANEL, realLib)
await entrySuite(PANEL, realLib)
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
const libMutants = [
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
  ['stage-2 options shown by default', "? new Set<string>(ADD_SLIDE_V2_STAGE2_IDS)", '? new Set<string>()'],
  ['a blank list means show everything', " || rawDisabled.trim() === ''", ''],
  ['option ids are case sensitive', '.map(part => part.trim().toLowerCase())', '.map(part => part.trim())'],
  ['option ids are not trimmed', '.map(part => part.trim().toLowerCase())', '.map(part => part.toLowerCase())'],
  ['opt-in options ignore the opt-in list', '(!option.optIn || optIn.has(option.id))', 'true'],
  ['an opt-in beats the kill switch', 'option => !disabled.has(option.id) && (!option.optIn || optIn.has(option.id))', 'option => (option.optIn ? optIn.has(option.id) : !disabled.has(option.id))'],
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
  ['Escape is ignored', "onKeyDown={event => { if (event.key === 'Escape' && !pending) onClose() }}", 'onKeyDown={() => {}}'],
  ['Escape closes a generating panel', "if (event.key === 'Escape' && !pending) onClose()", "if (event.key === 'Escape') onClose()"],
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
    out = out.replace(a, b)
  }
  return out
}
for (const mutant of libMutants) {
  const broken = mutate(LIB, mutant, 'lib')
  let lib
  try { lib = load(broken, { env: ALL_ENV }) } catch { caught++; continue }
  const seen = checks
  assert.throws(() => { libSuite(lib); if (mutant[0].startsWith('flag')) assert.equal(load(broken, { env: { [FLAG]: 'false' } }).ADD_SLIDE_V2_ENABLED, false) }, undefined, `lib mutant survived: ${mutant[0]}`)
  checks = seen
  caught++
}
for (const mutant of panelMutants) {
  const broken = mutate(PANEL, mutant, 'component')
  const seen = checks
  let survived = false
  try { markupSuite(broken, realLib); await panelInteractionSuite(broken, realLib); await entrySuite(broken, realLib); survived = true } catch { /* caught */ }
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
for (const mutant of regenMutants) {
  const broken = mutate(REGEN, mutant, 'regenerate')
  const seen = checks
  assert.throws(() => regenSuite(load(broken)), undefined, `regenerate mutant survived: ${mutant[0]}`)
  checks = seen
  caught++
}
check(assert.equal, caught, libMutants.length + panelMutants.length + submitMutants.length + regenMutants.length)

console.log(`studio-add-slide-v2: ${checks} checks passed, ${caught} mutants caught (${libMutants.length} lib, ${panelMutants.length} panel/entry, ${submitMutants.length} submit, ${regenMutants.length} regenerate)`)
