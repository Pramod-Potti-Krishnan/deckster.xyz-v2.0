// J2 v2: generate-first "Add slide" pop-up scaffold (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED, default off).
// Offline and self-contained: no network, no git. Covers the pop-up state, the adapter seam
// (buildAddSlideV2Request), the pop-up markup (server render with stubbed UI primitives) and the flag-gated hooks,
// then re-runs the behaviour suites against deliberately broken copies of the sources (mutation check).
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
  const ready = { ...initial, text: 'Why now' }
  check(assert.equal, lib.addSlideV2Blocker(initial, { sessionId: 's' }, true), 'empty-text')
  check(assert.equal, lib.addSlideV2Blocker({ ...initial, text: '   \n ' }, { sessionId: 's' }, true), 'empty-text', 'whitespace is empty')
  check(assert.equal, lib.addSlideV2Blocker(ready, { sessionId: null }, true), 'no-session')
  check(assert.equal, lib.addSlideV2Blocker(ready, { sessionId: 's' }, false), 'no-submit', 'no adapter wired = Generate stays disabled')
  check(assert.equal, lib.addSlideV2Blocker(ready, { sessionId: 's' }, true), null)

  // the adapter seam
  const request = lib.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'image_left', text: '  Our team  ' }, context())
  check(assert.deepEqual, request, {
    mode: 'generate', slideType: 'content', contentSubtype: 'image_left', instruction: 'Our team',
    insertAfterIndex: 2, sessionId: 'sess-1', presentationId: 'pres-1',
    research: research({ useWebSearch: true }), theme: THEME,
  })
  check(assert.equal, request.theme, THEME, 'the theme is passed through untouched')
  check(assert.equal, lib.buildAddSlideV2Request({ ...ready, slideType: 'title', contentSubtype: 'chart' }, context()).contentSubtype, null,
    'a title slide carries no sub-type even if one was remembered')
  for (const type of ['title', 'section', 'closing']) {
    check(assert.equal, lib.buildAddSlideV2Request({ ...ready, slideType: type, contentSubtype: 'infographic' }, context()).slideType, type)
  }
  check(assert.equal, lib.buildAddSlideV2Request(ready, context({ currentSlide: 1 })).insertAfterIndex, 0, 'P9: after slide 1 is index 0')
  check(assert.equal, lib.buildAddSlideV2Request(ready, context({ currentSlide: 7, slideCount: 7 })).insertAfterIndex, 6, 'P9: after the last slide')
  check(assert.equal, lib.buildAddSlideV2Request(ready, context({ currentSlide: 0 })).insertAfterIndex, 0, 'never negative')
  check(assert.equal, lib.buildAddSlideV2Request(ready, context({ presentationId: null })).insertAfterIndex, null, 'no deck yet = no index')
  check(assert.equal, lib.buildAddSlideV2Request({ ...ready, text: '  ' }, context()), null, 'empty text builds nothing')
  check(assert.equal, lib.buildAddSlideV2Request(ready, context({ sessionId: null })), null, 'no session builds nothing')
  const ctx = context({ research: research({ useWebSearch: true, useDeepResearch: true, useUploadedDocuments: true }) })
  const built = lib.buildAddSlideV2Request(ready, ctx)
  check(assert.deepEqual, built.research, ctx.research, 'P7: research is the chat setting, as given')
  check(assert.notEqual, built.research, ctx.research, 'the request owns a copy of the research flags')
  check(assert.equal, Object.keys(built).sort().join(','),
    'contentSubtype,insertAfterIndex,instruction,mode,presentationId,research,sessionId,slideType,theme', 'no backend vocabulary on the request')

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
check(assert.match, PAGE, /TODO\(J2-MAP\): add `submit` here/, 'the wiring seam is marked on the page')
check(assert.match, LIB, /TODO\(J2-MAP\)/, 'the adapter seam is marked in the lib')
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
let caught = 0
function mutate(source, [name, from, to], label) {
  assert.ok(source.includes(from), `mutant "${name}" no longer matches the ${label} source`)
  return source.replace(from, to)
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
check(assert.equal, caught, libMutants.length + panelMutants.length)

console.log(`studio-add-slide-v2: ${checks} checks passed, ${caught} mutants caught (${libMutants.length} lib, ${panelMutants.length} component)`)
