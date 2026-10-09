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
  check(assert.equal, lib.addSlideV2Blocker(initial, { sessionId: 's' }, true), 'subtype-undecided', 'content + Auto has no agreed mapping yet')
  check(assert.equal, lib.addSlideV2Blocker({ ...ready, contentSubtype: 'image' }, { sessionId: 's' }, true), 'subtype-undecided', 'Image has no agreed mapping yet')
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
  check(assert.equal, lib.buildAddSlideV2Request({ ...ready, contentSubtype: 'auto' }, context()), null, 'an unmapped sub-type builds nothing')
  check(assert.equal, lib.buildAddSlideV2Request({ ...ready, contentSubtype: 'image' }, context()), null, 'an unmapped sub-type builds nothing')

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
  check(assert.equal, sel('content', 'auto'), null, 'TODO(J2-MAP-DECISION): content + Auto stays unmapped')
  check(assert.equal, sel('content', 'image'), null, 'TODO(J2-MAP-DECISION): Image stays unmapped')
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
  check(assert.equal, lib.buildAddSlideV2ComposeBody({ ...request, contentSubtype: 'auto' }, 2), null, 'an unmapped sub-type has no body')
  check(assert.equal, JSON.stringify(Object.keys(lib.buildAddSlideV2ComposeBody(request, 2)).sort()),
    JSON.stringify(['insert_after_index', 'instruction', 'presentation_id', 'research', 'selections', 'session_id', 'theme']), 'wire keys are snake_case only')

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
  check(assert.match, unwired, /data-blocker="subtype-undecided"/, 'the default Auto style is blocked until the mapping is decided')
  const chartNoText = render({ submit: async () => ({ ok: true }), initialDraft: { slideType: 'content', contentSubtype: 'chart', text: '' } })
  check(assert.match, chartNoText, /data-blocker="empty-text"/)
  const imageTyped = render({ submit: async () => ({ ok: true }), initialDraft: { slideType: 'content', contentSubtype: 'image', text: 'Our office' } })
  check(assert.equal, /class="asv2-generate"[^>]*disabled/.test(imageTyped), true, 'Image stays blocked even with text')
  check(assert.match, imageTyped, /data-blocker="subtype-undecided"/)
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
    const unmapped = await run({ ...chart('x'), contentSubtype: 'auto' })
    refused(unmapped, /can't be generated yet/); check(assert.equal, unmapped.calls.fetch.length, 0, 'an unmapped sub-type sends nothing')
    refused(await run({ ...chart('x'), contentSubtype: 'image' }), /can't be generated yet/)

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
    refused(await run(chart('x'), { reply: { status: 'needs_input', questions: [{ slot: 's', ask: 'More?' }] } }), /needs more information/)
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
  })()
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

// ---- 3. flag-gated hooks (flag off must leave the existing Add Slide UI untouched) --------------------------------
check(assert.match, PICKER, /if \(ADD_SLIDE_V2_ENABLED && addSlideV2\) \{\s*return <AddSlideV2Entry[^\n]*onInsertBlank=\{\(\) => handleSelectLayout\('B1-blank'\)\}/,
  'the picker routes Blank slide through the existing insert path')
check(assert.ok, PICKER.indexOf('if (ADD_SLIDE_V2_ENABLED && addSlideV2)') < PICKER.indexOf('if (STUDIO_SHELL) {'), 'V2 branch precedes the two existing branches')
check(assert.match, PICKER, /Insert \$\{layout\.label\} slide/, 'existing Insert-slide cards still present')
check(assert.match, PICKER, /Hero Slides[\s\S]*Content Slides[\s\S]*Visual \+ Text[\s\S]*Image Split/, 'legacy layout picker still present')
check(assert.match, VIEWER, /addSlideV2=\{ADD_SLIDE_V2_ENABLED && addSlideV2Settings \? \{ settings: addSlideV2Settings, currentSlide, slideCount: totalSlides, theme: buildThemeSelection \} : undefined\}/,
  'the viewer passes nothing unless the flag is on and the page supplied settings')
check(assert.match, AREA, /addSlideV2Settings=\{addSlideV2Settings\}/, 'the area only forwards')
check(assert.match, PAGE, /addSlideV2Settings=\{process\.env\.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true' \? \{/, 'the page builds settings only with the flag on')
check(assert.match, PAGE, /submit: features\.slideComposerEnabled && features\.slideComposerAsyncEnabled \? request => submitAddSlideV2\(request, \{/, 'the page supplies submit only with the composer and its async mode on')
check(assert.match, PAGE, /captureSessionOwner: captureStudioSlideComposeSessionOwner,/)
check(assert.match, PAGE, /isSessionAdmitted: sessionId => !studioShell \|\| sessionId === questionSubmissionScopeRef\.current\.sessionId,/)
check(assert.match, PAGE, /visualIndex: currentSlideIndexRef\.current,\s*realSlideCount: effectiveSlideCount \?\? 0,/)
check(assert.match, PAGE, /onAccepted: handleSlideComposerAccepted,/, 'registration goes through the existing page queue')
check(assert.match, PAGE, /import \{ submitAddSlideV2 \} from '@\/lib\/studio-add-slide-v2-submit'/)
check(assert.equal, /studio-add-slide-v2-submit/.test(PICKER + VIEWER + AREA + PANEL), false, 'the submit module is only reachable from the page')
check(assert.match, LIB, /TODO\(J2-MAP-DECISION\)/, 'the undecided mappings are marked in the lib')
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
  ['auto mapped to omission', '  auto: null,', '  auto: {},'],
  ['image mapped to I1', '  image: null,', "  image: { canvas_type: 'I1', content_type: 'text_heavy_columns' },"],
  ['chart subtype dropped', ", chart_subtype: 'single' }", ' }'],
  ['infographic subtype dropped', ", infographic_subtype: 'vertical_center' }", ' }'],
  ['closing maps to H2', "closing: { canvas_type: 'H3'", "closing: { canvas_type: 'H2'"],
  ['text maps to chart content', "text: { canvas_type: 'C1', content_type: 'text_heavy_columns' },", "text: { canvas_type: 'C1', content_type: 'chart' },"],
  ['table object is shared', 'return selections ? { ...selections } : null', 'return selections'],
  ['body uses the visual index as the anchor', 'insert_after_index: insertAfterIndex,', 'insert_after_index: request.anchorVisualIndex,'],
  ['web search cap changed', 'ADD_SLIDE_V2_WEB_SEARCH_MAX_QUERIES = 3', 'ADD_SLIDE_V2_WEB_SEARCH_MAX_QUERIES = 5'],
  ['theme dropped from the body', '    instruction: request.instruction,\n    theme: request.theme,\n    selections,', '    instruction: request.instruction,\n    selections,'],
  ['research flag swapped on the wire', 'use_web_search: request.research.useWebSearch,', 'use_web_search: request.research.useDeepResearch,'],
  ['unmapped check dropped from the blocker', "if (addSlideV2Selections(draft.slideType, activeAddSlideV2Subtype(draft)) === null) return 'subtype-undecided'", ''],
  ['unmapped check dropped from the builder', "if (addSlideV2Selections(draft.slideType, activeAddSlideV2Subtype(draft)) === null) return null", ''],
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
  assert.throws(() => markupSuite(broken, realLib), undefined, `component mutant survived: ${mutant[0]}`)
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
