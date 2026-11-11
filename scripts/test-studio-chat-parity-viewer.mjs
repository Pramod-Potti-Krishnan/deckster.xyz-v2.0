// FRONTEND-1 (overnight chat parity, viewer half): proof of the viewer "/" commands behind NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (the string "true", default off, build-time; it already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell).
//   lib/studio-chat-parity-viewer.ts (the rows, what cannot run and why, the words, the bus), components/builder/chat/studio-chat-parity-viewer-menu.tsx (the three groups), marked lines in the viewer, the composer, the page and chat clean.
//
//   A. The lib, function by function, in THIS realm: slide numbers, layout matching, what blocks each command, the rows for every trigger (hints, disabled reasons, groups), the typed word that never confirms.
//   B. The bus on a FAKE VIEWER: every command calls its handler with the right arguments, says what it saw (and never a change it did not see), refuses what the buttons refuse, discard only calls the viewer's own handler.
//   C. The sources: every marked line, the strip puts each file back to the base byte for byte (and through the registry), the viewer's gate and its handlers, no new flag, the committed diff is this change's files (COMMITTED diff only), the menu markup.
//   D. MUTANTS: every one of them must be caught by A-C.
//
//   node scripts/test-studio-chat-parity-viewer.mjs
//
// Offline: no socket, no fetch, no browser; the bus runs on fake handlers and short waits (scale); git is read only for C. Later changes stack on top, so the committed-diff check reads THIS change's own commits (subject "Chat parity viewer: ...").
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
let checks = 0
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the loader's vm have their own Array / Object prototypes: compare them as plain data
const eq = (actual, expected, message) => { checks++; assert.deepEqual(plain(actual), plain(expected), message) }
const read = rel => stripWorkspace.stripChatParityWorkspace(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): every read is the file without the workspace commands' lines (stripWorkspace is bound below: a read is only made later)
const strip = await import('./studio-chat-parity-viewer-strip.mjs')
const stripWorkspace = await import('./studio-chat-parity-workspace-strip.mjs') // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): the workspace slash commands (stacked after this change) add marked lines to files this proof reads and to the viewer half's own lib and menu; it reads them as this change left them
const registry = await import('./studio-later-changes.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')

const LIB = 'lib/studio-chat-parity-viewer.ts'
const MENU = 'components/builder/chat/studio-chat-parity-viewer-menu.tsx'
const CSS = 'components/builder/studio-chat-parity-viewer.css'
const VIEWER = 'components/presentation-viewer.tsx'
const COMPOSER = 'components/builder/chat-input.tsx'
const COMMANDS_UI = 'components/builder/chat/studio-chat-commands.tsx'
const COMMANDS_LIB = 'lib/studio-chat-commands.ts'
const CLEAN_UI = 'components/builder/chat/studio-chat-clean.tsx'
const CLEAN_LIB = 'lib/studio-chat-clean.ts'
const PAGE = 'app/builder/page.tsx'
const REGISTRY = 'scripts/studio-later-changes.mjs'
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const hasBase = (() => { try { git('cat-file', '-e', `${strip.BASE_COMMIT}^{commit}`); return true } catch { return false } })()
const baseOf = rel => git('show', `${strip.BASE_COMMIT}:${rel}`)
/** This change's own commits (newest first): subject "Chat parity viewer: ...". */
const OWN = (() => { try { return git('log', '--format=%H%x09%s', '--no-merges', `${strip.BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).map(line => line.split('\t')).filter(([, subject]) => strip.CHAT_PARITY_VIEWER_SUBJECT && subject.startsWith(strip.CHAT_PARITY_VIEWER_SUBJECT)).map(([sha]) => sha) } catch { return [] } })()

// ---- the lib, evaluated in THIS realm (its two imports come from the repo through the harness loader) ----------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
const repoLoader = createModuleLoader({ root, globals: { process: { env: { NODE_ENV: 'production' } }, console, Date, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp } })
function loadLib(text = read(LIB)) {
  const module = { exports: {} }
  const req = specifier => {
    if (specifier === '@/types/elements') return repoLoader.load('types/elements.ts')
    if (specifier === '@/lib/studio-add-slide-v2') return repoLoader.load('lib/studio-add-slide-v2.ts')
    throw new Error(`the lib imports only the layout catalog and the add-slide options, not ${specifier}`)
  }
  new Function('module', 'exports', 'require', 'process', compile(text, LIB))(module, module.exports, req, { env: {} })
  return module.exports
}
const SCALE = 0.01 // the bus waits (ms) times this to SEE an effect: a command that changes nothing fails fast

// ---- a fake viewer: state a button reads, and handlers that record what they were called with -------------------------------------------------
function fakeViewer(lib, init = {}, behave = {}) {
  const calls = []
  const state = { ready: true, slideCount: 8, slide: 3, editing: false, grid: false, borders: false, rail: true, presenting: false, building: false, slideReason: null, save: 'saved', version: { active: 'blank', has: ['blank', 'strawman', 'final'] }, ...init }
  const rec = (name, fn) => (...args) => { calls.push([name, ...args]); if (behave[name] === 'throw') throw new Error('boom'); return behave[name] === 'noop' ? undefined : fn?.(...args) }
  const confirm = { answer: false, asked: 0 }
  const actions = {
    goTo: rec('goTo', i => { state.slide = i + 1 }),
    next: rec('next', () => { state.slide = Math.min(state.slideCount, state.slide + 1) }),
    prev: rec('prev', () => { state.slide = Math.max(1, state.slide - 1) }),
    addBlank: rec('addBlank', position => { state.slideCount += 1; state.slide = position + 1 }),
    changeLayout: rec('changeLayout', () => (behave.layoutConfirmed ?? true)),
    present: rec('present', () => { state.presenting = true }),
    setEditing: rec('setEditing', editing => { state.editing = editing }),
    setRail: rec('setRail', show => { state.rail = show }),
    toggleGrid: rec('toggleGrid', () => { state.grid = !state.grid }),
    toggleBorders: rec('toggleBorders', () => { state.borders = !state.borders }),
    save: rec('save', () => { state.save = behave.saveEnds ?? 'saved'; if (state.save === 'saved') state.editing = false }),
    // the viewer's own handleCancelEdits: its confirm box answers; only a click on OK discards. The fake box is answered by the test, never by a typed word.
    discard: rec('discard', () => { confirm.asked++; if (confirm.answer) state.editing = false }),
    setVersion: rec('setVersion', version => { state.version = { ...state.version, active: version } }),
  }
  const off = lib.registerViewer(() => ({ state: { ...state, version: { ...state.version, has: [...state.version.has] } }, actions }))
  return { calls, state, confirm, off, actions }
}
const emit = (lib, run, options = {}) => lib.emitViewerCommand(run, { scale: SCALE, ...options })

const slideState = over => ({ ready: true, slideCount: 8, slide: 3, editing: false, grid: false, borders: false, rail: true, presenting: false, building: false, slideReason: null, save: 'saved', version: { active: 'blank', has: ['blank', 'strawman', 'final'] }, ...over })
const envOf = (over = {}) => ({ viewer: slideState(), building: false, themeBlocked: null, presets: [{ id: 'midnight', name: 'Midnight' }, { id: 'corporate_light', name: 'Corporate Light' }, { id: 'sunrise', name: 'Sunrise' }], canvasClosed: true, ...over })
const ALL_VIEWER_RUNS = [
  { name: 'goto', slide: 2 }, { name: 'next' }, { name: 'prev' }, { name: 'blank-slide' }, { name: 'layout', layout: 'C3-chart', label: 'Chart' }, { name: 'present' }, { name: 'edit' }, { name: 'view' },
  { name: 'rail', show: false }, { name: 'grid', on: null }, { name: 'borders', on: null }, { name: 'save' }, { name: 'discard' }, { name: 'version', version: 'strawman' },
]

// ============================================================================================================================================
// A. The lib
// ============================================================================================================================================
function libSuite(lib = loadLib()) {
  const W = lib.PARITY_WORDS
  // -- slide numbers --------------------------------------------------------------------------------------------------------------------------
  eq([lib.parseSlideNumber('3', 8), lib.parseSlideNumber(' 12 ', 8), lib.parseSlideNumber('slide 3', 8), lib.parseSlideNumber('Slide3', 8), lib.parseSlideNumber('first', 8), lib.parseSlideNumber('LAST', 8)], [3, 12, 3, 3, 1, 8], 'a slide number as typed: 3, slide 3, first, last')
  eq([lib.parseSlideNumber('', 8), lib.parseSlideNumber('abc', 8), lib.parseSlideNumber('3x', 8), lib.parseSlideNumber('-1', 8), lib.parseSlideNumber('2.5', 8), lib.parseSlideNumber('first', 0), lib.parseSlideNumber('last', 0)], [null, null, null, null, null, null, null], 'anything else is no number (and first / last need a deck)')

  // -- layouts: the catalog, matched loosely --------------------------------------------------------------------------------------------------
  const catalog = repoLoader.load('types/elements.ts').SLIDE_LAYOUTS
  eq(plain(lib.layoutChoices()), catalog.map(item => ({ id: item.layout, label: item.label })), 'the layout list IS the rail menu\'s catalog (SLIDE_LAYOUTS), in its order')
  eq(lib.matchLayouts('').map(item => item.id), catalog.map(item => item.layout), 'no word: every layout, catalog order')
  const first = query => lib.matchLayouts(query)[0]?.id
  eq([first('closing'), first('Image + Text'), first('image text'), first('chart'), first('compar'), first('cmp'), first('thank you'), first('section'), first('blank'), first('two visuals')],
    ['H3-closing', 'V1-image-text', 'V1-image-text', 'C3-chart', 'S4-comparison', 'S4-comparison', 'H3-closing', 'H2-section', 'B1-blank', 'S3-two-visuals'], 'loose matching: the same words, an unsigned plus, a prefix, the letters in order, a word of the description')
  eq(lib.matchLayouts('title').map(item => item.id).slice(0, 2), ['H1-generated', 'H1-structured'], 'a word both Title layouts share lists both, catalog order')
  eq(lib.matchLayouts('zzzz'), [], 'nothing it could mean: no layout')
  ok(lib.matchLayouts('e').every(item => catalog.some(entry => entry.layout === item.id)) && lib.matchLayouts('text').every(item => catalog.some(entry => entry.layout === item.id)), 'never a layout that is not in the catalog')
  eq(lib.matchThemes([{ name: 'Midnight' }, { name: 'Corporate Light' }], 'corp'), [{ name: 'Corporate Light' }], 'themes match loosely too')

  // -- what blocks each command ---------------------------------------------------------------------------------------------------------------
  for (const run of ALL_VIEWER_RUNS) eq(lib.blockedReason(run, null, false), W.noDeck, `no deck yet blocks /${run.name}`)
  for (const run of ALL_VIEWER_RUNS) eq(lib.blockedReason(run, slideState({ ready: false }), false), W.loading, `the slide still loading blocks /${run.name}`)
  for (const run of ALL_VIEWER_RUNS) eq(lib.blockedReason(run, slideState({ slideCount: 0 }), false), W.noSlides, `a deck with no slides blocks /${run.name}`)
  const MUTATING = ['blank-slide', 'layout', 'edit', 'save', 'discard']
  for (const run of ALL_VIEWER_RUNS) {
    const during = lib.blockedReason(run, slideState({ editing: true, save: 'unsaved' }), true)
    eq(during === W.building, MUTATING.includes(run.name), `a build running holds the mutations (and only them): /${run.name}`)
    eq(lib.blockedReason(run, slideState({ editing: true, save: 'unsaved', building: true }), false) === W.building, MUTATING.includes(run.name), `the viewer's own isGenerating holds them too: /${run.name}`)
  }
  eq([lib.blockedReason({ name: 'goto', slide: 5 }, slideState(), true), lib.blockedReason({ name: 'next' }, slideState(), true)], [null, null], 'going to a slide is read-only: allowed while a build runs')
  eq([lib.blockedReason({ name: 'blank-slide' }, slideState({ slideReason: 'Finishing your last change…' }), false), lib.blockedReason({ name: 'layout', layout: 'C3-chart', label: 'Chart' }, slideState({ slideReason: 'Exit Template Mode to add slides' }), false)],
    ['Finishing your last change…', 'Exit Template Mode to add slides'], 'a slide change in flight / Template Mode / a paused tab: the Add Slide button\'s own reason, word for word')
  eq([lib.blockedReason({ name: 'goto', slide: 2 }, slideState({ slideReason: 'This tab is paused' }), false), lib.blockedReason({ name: 'present' }, slideState({ slideReason: 'This tab is paused' }), false)], [null, null], 'a paused tab is view-only: moving between slides and presenting stay available')
  eq([lib.blockedReason({ name: 'next' }, slideState({ slide: 8 }), false), lib.blockedReason({ name: 'prev' }, slideState({ slide: 1 }), false), lib.blockedReason({ name: 'next' }, slideState({ slide: 7 }), false)], [W.lastSlide, W.firstSlide, null], 'next stops at the last slide, prev at the first')
  eq([lib.blockedReason({ name: 'edit' }, slideState({ editing: true }), false), lib.blockedReason({ name: 'view' }, slideState({ editing: false }), false), lib.blockedReason({ name: 'edit' }, slideState(), false), lib.blockedReason({ name: 'view' }, slideState({ editing: true }), false)],
    [W.alreadyEditing, W.alreadyViewing, null, null], 'edit and view say when it already is')
  eq(['saved', 'saving', 'unsaved', 'error'].map(save => lib.blockedReason({ name: 'save' }, slideState({ save }), false)), [W.nothingToSave, W.saving, null, null], 'save follows the Save button: only when there is something unsaved')
  eq([lib.blockedReason({ name: 'discard' }, slideState({ editing: false }), false), lib.blockedReason({ name: 'discard' }, slideState({ editing: true }), false)], [W.notEditing, null], 'discard needs Edit mode')
  eq([lib.blockedReason({ name: 'rail', show: true }, slideState({ rail: true }), false), lib.blockedReason({ name: 'rail', show: false }, slideState({ rail: true }), false), lib.blockedReason({ name: 'rail', show: false }, slideState({ rail: false }), false)], [W.railAlready(true), null, W.railAlready(false)], 'rail: the requested state, never a blind toggle')
  eq([lib.blockedReason({ name: 'grid', on: true }, slideState({ grid: true }), false), lib.blockedReason({ name: 'grid', on: false }, slideState({ grid: true }), false), lib.blockedReason({ name: 'grid', on: null }, slideState({ grid: true }), false), lib.blockedReason({ name: 'borders', on: false }, slideState({ borders: false }), false)],
    [W.onOffAlready('Grid', true), null, null, W.onOffAlready('Borders', false)], 'grid and borders: on / off say when already so; with no word they toggle')
  eq([lib.blockedReason({ name: 'version', version: 'final' }, slideState({ version: { active: 'blank', has: ['blank'] } }), false), lib.blockedReason({ name: 'version', version: 'blank' }, slideState(), false), lib.blockedReason({ name: 'version', version: 'strawman' }, slideState(), false)],
    [W.noVersion('Final'), W.alreadyShowing, null], 'a version that does not exist yet, the one already showing, a real switch')

  // -- the rows ------------------------------------------------------------------------------------------------------------------------------
  const rows = (name, arg, over) => lib.parityRows({ name, arg }, envOf(over))
  const labels = list => list.map(row => row.label)
  const all = rows('', null)
  eq(labels(all), ['/goto', '/next', '/prev', '/blank-slide', '/layout', '/present', '/edit', '/view', '/rail', '/grid', '/borders', '/save', '/discard', '/version', '/theme <name>', '/canvas'], 'every command has one row, in the three groups\' order')
  eq([...new Set(all.map(row => row.group))], ['Slides', 'View', 'Deck'], 'three groups in this order: Slides, View, Deck')
  eq(all.map(row => row.group), ['Slides', 'Slides', 'Slides', 'Slides', 'Slides', 'View', 'View', 'View', 'View', 'View', 'View', 'Deck', 'Deck', 'Deck', 'Deck', 'Deck'], 'rows of a group sit together (one heading each)')
  eq(all.filter(row => row.fill).map(row => row.command), ['goto', 'layout', 'rail', 'version', 'theme'], 'a command that takes a word fills its name so the choices show; the rest run')
  ok(all.every(row => row.blurb && row.blurb.length <= 48), 'one short line each')
  ok(all.filter(row => !row.fill).every(row => row.run && row.run.name === row.command), 'a row that runs carries exactly its command')
  eq(all.filter(row => row.disabled).map(row => row.command), ['view', 'save', 'discard'], 'a deck is open, not editing, all saved: only what has nothing to do is disabled (view, save, discard), each with its reason')
  eq(lib.parityRows({ name: '', arg: null }, envOf({ viewer: slideState({ editing: true, save: 'unsaved' }) })).filter(row => row.disabled).map(row => row.command), ['edit'], 'editing with unsaved edits: only /edit is disabled')
  eq(labels(rows('go', null)), ['/goto'], 'typing filters: names that start with it')
  eq(labels(rows('b', null)), ['/blank-slide', '/borders'], 'typing filters: the same, in menu order')
  eq(labels(rows('ed', null)), ['/edit'], 'ed finds edit')
  eq(labels(rows('rail', null)).concat(labels(rows('ail', null))), ['/rail', '/rail'], 'names that contain it come too')
  eq(rows('nope', null), [], 'a word that names no command: no rows (the existing menu closes)')
  eq(labels(rows('theme', null)), ['/theme <name>'], 'the preset picker has its own row next to the existing /theme')
  // no deck: every viewer row is disabled with the reason
  const noDeck = lib.parityRows({ name: '', arg: null }, envOf({ viewer: null }))
  ok(noDeck.filter(row => row.command !== 'canvas' && row.command !== 'theme').every(row => row.disabled === W.noDeck), 'no deck yet: every viewer row is disabled with that reason')
  eq([noDeck.find(row => row.command === 'canvas').disabled, lib.parityRows({ name: 'canvas', arg: null }, envOf({ canvasClosed: false }))[0].disabled], [null, W.canvasOpen], '/canvas is enabled only while the canvas is held closed; else it says it is open')
  eq(lib.parityRows({ name: 'theme', arg: null }, envOf({ themeBlocked: 'Build theme selection is locked for this deck.' }))[0].disabled, 'Build theme selection is locked for this deck.', 'the theme button\'s own reason')
  // goto
  eq(plain(rows('goto', '3')), [{ ...plain(rows('goto', '3'))[0], label: '/goto 3', blurb: 'Go to slide 3 of 8', disabled: null, hint: null, fill: false, run: { name: 'goto', slide: 3 } }], '/goto 3 runs goto 3')
  eq(rows('goto', 'last')[0].run, { name: 'goto', slide: 8 }, '/goto last')
  eq([rows('goto', '')[0].hint, rows('goto', '12')[0].hint, rows('goto', '0')[0].hint, rows('goto', 'abc')[0].hint], [W.gotoHint(8), W.gotoRange(8), W.gotoRange(8), W.gotoHint(8)], 'a missing or impossible slide: an inline hint (This deck has 8 slides.), never a run')
  ok(['', '12', '0', 'abc'].every(arg => rows('goto', arg)[0].run === null), 'a hint row runs nothing')
  eq(rows('goto', '3', { viewer: slideState({ ready: false }) })[0].disabled, W.loading, 'a slide still loading disables /goto 3 with that reason')
  // layout
  eq(rows('layout', '').length, 19, '/layout with no word lists the whole catalog')
  eq(rows('layout', 'chart')[0].run, { name: 'layout', layout: 'C3-chart', label: 'Chart' }, '/layout chart runs the Chart layout')
  eq(rows('layout', 'image text')[0].label, '/layout Image + Text', 'several words work')
  eq([rows('layout', 'xyzzy')[0].hint, rows('layout', 'xyzzy')[0].run], [W.noLayout('xyzzy'), null], 'no layout matches: a hint, nothing runs')
  ok(rows('layout', 'chart', { viewer: slideState({ slideReason: 'Finishing your last change…' }) }).every(row => row.disabled === 'Finishing your last change…'), 'a slide change in flight disables every layout row with its reason')
  ok(rows('layout', 'chart', { building: true }).every(row => row.disabled === W.building), 'a build running disables every layout row')
  eq(rows('layout', '', { viewer: null }).map(row => row.disabled), [W.noDeck], 'no deck: one disabled row with the reason')
  // rail, grid, borders, version
  eq(rows('rail', '').map(row => [row.label, row.run]), [['/rail show', { name: 'rail', show: true }], ['/rail hide', { name: 'rail', show: false }]], '/rail: show and hide')
  eq([rows('rail', 'h')[0].label, rows('rail', 'x')[0].hint], ['/rail hide', W.railHint], 'a letter filters; anything else is a hint')
  eq(rows('grid', '').map(row => row.run), [{ name: 'grid', on: null }], '/grid alone toggles')
  eq(rows('grid', 'off').map(row => row.run), [{ name: 'grid', on: false }], '/grid off')
  eq(rows('borders', 'on').map(row => row.run), [{ name: 'borders', on: true }], '/borders on')
  eq([rows('grid', 'maybe')[0].hint, rows('borders', 'maybe')[0].run], [W.onOffHint('grid'), null], 'a word that is neither on nor off: a hint')
  eq(rows('version', '').map(row => [row.label, row.run.version, row.disabled]), [['/version custom', 'blank', W.alreadyShowing], ['/version strawman', 'strawman', null], ['/version final', 'final', null]], '/version: the three versions, the one showing disabled')
  eq(rows('version', '', { viewer: slideState({ version: { active: 'blank', has: ['blank'] } }) }).map(row => row.disabled), [W.alreadyShowing, W.noVersion('Strawman'), W.noVersion('Final')], 'a version that does not exist yet is disabled with that reason')
  eq(rows('version', 'zzz')[0].hint, W.versionHint, 'no such version: a hint')
  // theme presets
  eq(rows('theme', '').map(row => row.run.preset.id), ['midnight', 'corporate_light', 'sunrise'], '/theme <word>: the presets')
  eq(rows('theme', 'corp').map(row => row.run), [{ name: 'theme', preset: { id: 'corporate_light', name: 'Corporate Light' } }], '/theme corp finds Corporate Light')
  eq([rows('theme', 'zzz')[0].hint, rows('theme', '', { presets: [] })[0].hint], [W.noTheme('zzz'), W.noThemes], 'no match / no presets: a hint')
  ok(rows('theme', 'mid', { themeBlocked: 'Build theme selection is locked for this deck.' }).every(row => row.disabled === 'Build theme selection is locked for this deck.'), 'a locked theme disables its rows with the button\'s reason')
  // a command that takes nothing, given something
  eq([rows('next', 'now')[0].hint, rows('next', 'now')[0].run, rows('next', '  ')[0].run], [W.nothingAfter('next'), null, { name: 'next' }], 'a word after a command that takes none: a hint, not a run; trailing spaces are nothing')
  // a typed word never confirms a discard
  eq([rows('discard', 'yes')[0].hint, rows('discard', 'yes')[0].run, rows('yes', null), rows('confirm', null), rows('discard', 'y es please')[0].run], [W.nothingAfter('discard'), null, [], [], null], 'a typed "yes" is not a command and gives /discard no run')
  ok(!lib.PARITY_COMMANDS.some(def => /yes|confirm|really|sure/i.test(def.name + def.blurb)), 'no command or description names a confirmation')
  eq(rows('discard', null)[0].run, { name: 'discard' }, '/discard itself runs the viewer\'s discard (and the box is the viewer\'s)')
  // the words
  ok(Object.values(W).every(value => typeof value === 'function' || (typeof value === 'string' && value.length <= 60)), 'every fixed word is short')
  ok(![...Object.values(W).filter(value => typeof value === 'string'), ...all.map(row => row.blurb)].some(text => /\b(handler|iframe|postMessage|undefined|null|error code|API)\b/i.test(text)), 'plain words: no jargon')
  eq(Object.keys(lib.PARITY_HANDLERS).sort(), [...lib.PARITY_COMMANDS.map(def => def.name)].sort(), 'every command names the handler it calls')
  return lib
}

// ============================================================================================================================================
// B. The bus on a fake viewer
// ============================================================================================================================================
async function busSuite(text = read(LIB)) {
  const W = loadLib(text).PARITY_WORDS
  const fresh = () => loadLib(text)
  // goto, next, prev
  { const lib = fresh(), v = fakeViewer(lib); const r = await emit(lib, { name: 'goto', slide: 5 }); eq([v.calls, r], [[['goTo', 4]], { ok: true, note: 'Went to slide 5' }], '/goto 5 calls goTo(4) (0-based) and says what it saw'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib); const a = await emit(lib, { name: 'next' }); const b = await emit(lib, { name: 'prev' }); const c = await emit(lib, { name: 'prev' }); eq([v.calls, a.note, b.note, c.note, v.state.slide], [[['next'], ['prev'], ['prev']], 'Went to slide 4', 'Went to slide 3', 'Went to slide 2', 2], '/next and /prev call their handlers and name the slide they landed on'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, { slide: 8 }); const r = await emit(lib, { name: 'next' }); eq([v.calls, r], [[], { ok: false, note: W.lastSlide }], 'on the last slide /next calls nothing and says so'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, {}, { goTo: 'noop' }); const r = await emit(lib, { name: 'goto', slide: 5 }); eq([r.ok, r.note], [false, "Couldn't go to slide 5."], 'a move the viewer did not make is not reported as made'); v.off() }
  // blank slide
  { const lib = fresh(), v = fakeViewer(lib); const r = await emit(lib, { name: 'blank-slide' }); eq([v.calls, r, v.state.slideCount], [[['addBlank', 3]], { ok: true, note: 'Added a blank slide after slide 3' }, 9], '/blank-slide adds after the current slide (position = the current slide) and says so once the count grew'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, {}, { addBlank: 'noop' }); const r = await emit(lib, { name: 'blank-slide' }); eq([r.ok, /confirm/.test(r.note), /^Added/.test(r.note)], [false, true, false], 'a blank slide that never showed up is not claimed'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, {}, { addBlank: 'noop' }); v.actions.addBlank = () => 'A slide is still being generated here.'; const r = await emit(lib, { name: 'blank-slide' }); eq([r.ok, r.note], [false, 'A slide is still being generated here.'], 'the page\'s own refusal is the note'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, { slideReason: 'Finishing your last change…' }); const r = await emit(lib, { name: 'blank-slide' }); eq([v.calls, r], [[], { ok: false, note: 'Finishing your last change…' }], 'a change still in flight: nothing is called (isSlideMutationPending), the button\'s reason is the note'); v.off() }
  // layout
  { const lib = fresh(), v = fakeViewer(lib); const r = await emit(lib, { name: 'layout', layout: 'C3-chart', label: 'Chart' }); eq([v.calls, r], [[['changeLayout', 2, 'C3-chart']], { ok: true, note: 'Changed slide 3 to Chart' }], '/layout chart calls changeLayout(this slide 0-based, the catalog id)'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, {}, { layoutConfirmed: false }); const r = await emit(lib, { name: 'layout', layout: 'C3-chart', label: 'Chart' }); eq([r.ok, /^Changed/.test(r.note)], [false, false], 'a layout the viewer did not confirm is not claimed'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, {}, { changeLayout: 'noop' }); const r = await emit(lib, { name: 'layout', layout: 'C3-chart', label: 'Chart' }); eq(r.ok, false, 'a handler that answers nothing is not a confirmation'); v.off() }
  // present, edit, view, rail, grid, borders
  { const lib = fresh(), v = fakeViewer(lib); const r = await emit(lib, { name: 'present' }); eq([v.calls, r], [[['present']], { ok: true, note: 'Presenting. Press Esc to leave.' }], '/present calls handleFullscreen and says so only when the viewer is presenting'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, {}, { present: 'noop' }); const r = await emit(lib, { name: 'present' }); eq([r.ok, /full screen/.test(r.note), /^Presenting/.test(r.note)], [false, true, false], 'full screen refused by the browser: said, never claimed'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib); const a = await emit(lib, { name: 'edit' }); const b = await emit(lib, { name: 'view' }); eq([v.calls, a.note, b.note], [[['setEditing', true], ['setEditing', false]], 'Edit mode on', 'View mode on'], '/edit and /view pass the requested mode, never a blind toggle'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, { editing: true }); const r = await emit(lib, { name: 'edit' }); eq([v.calls, r.ok], [[], false], 'already editing: not toggled off by /edit'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib); const a = await emit(lib, { name: 'rail', show: false }); const b = await emit(lib, { name: 'rail', show: true }); eq([v.calls, a.note, b.note], [[['setRail', false], ['setRail', true]], 'Slide rail hidden', 'Slide rail shown'], '/rail hide and show set the requested boolean'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib); const a = await emit(lib, { name: 'grid', on: null }); const b = await emit(lib, { name: 'grid', on: null }); const c = await emit(lib, { name: 'borders', on: true }); eq([v.calls, [a.note, b.note, c.note]], [[['toggleGrid'], ['toggleGrid'], ['toggleBorders']], ['Grid on', 'Grid off', 'Borders on']], '/grid and /borders call the toggles and name the state they saw'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, { grid: true }); const a = await emit(lib, { name: 'grid', on: true }); const b = await emit(lib, { name: 'grid', on: false }); eq([v.calls, a.ok, b.note], [[['toggleGrid']], false, 'Grid off'], '/grid on while on toggles nothing; /grid off while on toggles once'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, {}, { toggleGrid: 'noop' }); const r = await emit(lib, { name: 'grid', on: null }); eq(r.ok, false, 'a toggle the viewer did not make is not claimed'); v.off() }
  // save
  { const lib = fresh(), v = fakeViewer(lib, { editing: true, save: 'unsaved' }); const r = await emit(lib, { name: 'save' }); eq([v.calls, r], [[['save']], { ok: true, note: 'Saved your edits' }], '/save calls handleSaveChanges and says saved only when the viewer reads saved'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, { editing: true, save: 'unsaved' }, { saveEnds: 'error' }); const r = await emit(lib, { name: 'save' }); eq([r.ok, r.note], [false, "Couldn't save. Try again."], 'a save that ended in error says so'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, { editing: true, save: 'unsaved' }, { saveEnds: 'unsaved' }); const r = await emit(lib, { name: 'save' }); eq([r.ok, /^Saved/.test(r.note)], [false, false], 'a save that has not confirmed is not claimed'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib); const r = await emit(lib, { name: 'save' }); eq([v.calls, r], [[], { ok: false, note: W.nothingToSave }], 'nothing unsaved: nothing is called'); v.off() }
  // discard: only the viewer's own handler, once; the box answers
  { const lib = fresh(), v = fakeViewer(lib, { editing: true, save: 'unsaved' }); v.confirm.answer = false; const r = await emit(lib, { name: 'discard' }); eq([v.calls, v.confirm.asked, r, v.state.editing], [[['discard']], 1, { ok: true, note: 'Kept your edits' }, true], '/discard calls ONLY the viewer\'s own handler; the box said no: edits kept, said so'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, { editing: true, save: 'unsaved' }); v.confirm.answer = true; const r = await emit(lib, { name: 'discard' }); eq([v.calls, r, v.state.editing], [[['discard']], { ok: true, note: 'Discarded your edits' }, false], 'the box said yes (a click): discarded, said so; no save, no mode call from the command'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib); const r = await emit(lib, { name: 'discard' }); eq([v.calls, r.ok], [[], false], 'not editing: nothing to discard, nothing called'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, { editing: true }); const r = await emit(lib, { name: 'discard' }, { building: true }); eq([v.calls, r.note], [[], W.building], 'a build running holds /discard'); v.off() }
  // version
  { const lib = fresh(), v = fakeViewer(lib); const r = await emit(lib, { name: 'version', version: 'strawman' }); eq([v.calls, r], [[['setVersion', 'strawman']], { ok: true, note: 'Showing the Strawman version' }], '/version strawman calls the Version menu\'s handler'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, { version: { active: 'blank', has: ['blank'] } }); const r = await emit(lib, { name: 'version', version: 'final' }); eq([v.calls, r.note], [[], W.noVersion('Final')], 'a version that is not there: nothing called'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib, {}, { setVersion: 'noop' }); const r = await emit(lib, { name: 'version', version: 'final' }); eq(r.ok, false, 'a switch the page did not make is not claimed'); v.off() }
  // build running: mutations wait, going to a slide does not
  { const lib = fresh(), v = fakeViewer(lib); const results = []; for (const run of ALL_VIEWER_RUNS.filter(item => ['blank-slide', 'layout', 'edit', 'save', 'discard'].includes(item.name))) results.push(await emit(lib, run, { building: true })); eq([v.calls, results.map(r => r.note)], [[], results.map(() => W.building)], 'a build running: every mutation calls nothing and says why'); const g = await emit(lib, { name: 'goto', slide: 2 }, { building: true }); eq([g.ok, v.calls], [true, [['goTo', 1]]], '...while going to a slide still works'); v.off() }
  // no viewer, throwing viewer, a viewer that goes away
  { const lib = fresh(); for (const run of ALL_VIEWER_RUNS) { const r = await emit(lib, run); if (r.ok || r.note !== W.noDeck) throw new Error(`no viewer: /${run.name} said ${JSON.stringify(r)}`) } checks++ }
  { const lib = fresh(), v = fakeViewer(lib, {}, { goTo: 'throw' }); const r = await emit(lib, { name: 'goto', slide: 4 }); eq([r.ok, /^Went/.test(r.note)], [false, false], 'a handler that throws: said, not claimed, nothing thrown'); v.off() }
  { const lib = fresh(), v = fakeViewer(lib); v.off(); const r = await emit(lib, { name: 'next' }); eq([r.ok, r.note], [false, W.noDeck], 'a viewer that unregistered: no deck'); }
  // the state the composer reads: published only when it changed
  { const lib = fresh(); let heard = 0; const stop = lib.subscribeViewerState(() => { heard++ }); const v = fakeViewer(lib); eq([heard, lib.viewerStateSnapshot().slide], [1, 3], 'registering publishes the state'); lib.publishViewerState(); lib.publishViewerState(); eq(heard, 1, 'the same state again: nothing is heard'); v.state.slide = 4; lib.publishViewerState(); eq([heard, lib.viewerStateSnapshot().slide], [2, 4], 'a changed state is heard once'); const snap = lib.viewerStateSnapshot(); lib.publishViewerState(); ok(lib.viewerStateSnapshot() === snap, 'the snapshot is the same object until it changes (useSyncExternalStore)'); v.off(); eq([heard, lib.viewerStateSnapshot()], [3, null], 'unregistering publishes "no deck"'); stop() }
  // /theme and /canvas
  { const lib = fresh(); const picked = []; const r = await lib.runParity({ name: 'theme', preset: { id: 'midnight', name: 'Midnight' } }, { building: false, choosePreset: id => picked.push(id), showCanvas: null }); eq([picked, r], [['midnight'], { ok: true, note: 'Theme set to Midnight for your next build' }], '/theme midnight calls the preset chip with the preset id, once') }
  { const lib = fresh(); let shown = 0; const a = await lib.runParity({ name: 'canvas' }, { building: false, choosePreset: () => {}, showCanvas: () => { shown++ } }); const b = await lib.runParity({ name: 'canvas' }, { building: false, choosePreset: () => {}, showCanvas: null }); eq([shown, a, b.ok], [1, { ok: true, note: 'Showing the canvas' }, false], '/canvas calls the Show canvas function; with none (the canvas is open) it says so') }
  { const lib = fresh(), v = fakeViewer(lib); const r = await lib.runParity({ name: 'goto', slide: 2 }, { building: false, choosePreset: () => {}, showCanvas: null, scale: SCALE }); eq([r.ok, v.calls], [true, [['goTo', 1]]], 'runParity routes a viewer command through the bus'); v.off() }
  // /blank-slide's call into the viewer's add handler
  { const lib = fresh(); const log = []; const add = async (layout, options) => { log.push([layout, options]) }
    eq([await lib.addBlankSlide(add, 3, undefined, 3), log], [undefined, [['B1-blank', { position: 3 }]]], 'no J2 panel: the plain add after this slide (position = current slide)')
    log.length = 0; eq([await lib.addBlankSlide(add, 3, { resolveBlankTarget: () => ({ ok: true, position: 5 }) }, 3), log.map(([layout, options]) => [layout, options?.position])], [undefined, [['B1-blank', 5]]], 'the J2 Blank choice\'s own insert point')
    log.length = 0; eq([await lib.addBlankSlide(add, 3, { resolveBlankTarget: () => ({ ok: false, message: 'A slide is still being generated here.' }) }, 3), log], ['A slide is still being generated here.', []], 'the page\'s refusal is returned and nothing is added')
    log.length = 0; eq([await lib.addBlankSlide(add, 3, { resolveBlankTarget: index => ({ ok: true, position: index }) }, 4), log.map(([, options]) => options?.position)], [undefined, [3]], 'the page is asked about the slide on screen (0-based)') }
}

// ============================================================================================================================================
// C. The sources
// ============================================================================================================================================
const MARK = strip.CHAT_PARITY_VIEWER_MARKER_RE
const importLines = text => text.split('\n').filter(line => /^import\s/.test(line))
const addedLines = (rel, from = strip.BASE_COMMIT) => git('diff', '--no-color', '-U0', from, '--', rel).split('\n').filter(line => /^\+(?!\+\+)/.test(line)).map(line => line.slice(1)).filter(line => !stripWorkspace.CHAT_PARITY_WORKSPACE_MARKER_RE.test(line)) // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): the workspace commands' marked lines are a later change's
const removedLines = (rel, from = strip.BASE_COMMIT) => git('diff', '--no-color', '-U0', from, '--', rel).split('\n').filter(line => /^-(?!--)/.test(line)).map(line => line.slice(1))

/** The viewer's added lines: the gate, the handlers, the effects (a pure function of the viewer's text: the mutants run it). */
function viewerChecks(text, label = 'viewer') {
  const lines = text.split('\n')
  const marked = lines.filter(line => MARK.test(line))
  const block = marked.join('\n')
  ok(/studioShell && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_COMMANDS === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true'/.test(block), `${label}: the gate reads the flags inline (the same shape as the Master opener's)`)
  ok(/chatParityViewerLive\.current = !chatParityViewerOn \? null : \{/.test(block), `${label}: flag off, the live handle is null`)
  ok(/useEffect\(\(\) => \{ if \(!chatParityViewerOn\) return; let off/.test(block), `${label}: the registering effect returns first with the flag off`)
  ok(/useEffect\(\(\) => \{ if \(chatParityViewerOn\) chatParityViewerMod\.current\?\.publishViewerState\(\) \}\)/.test(block), `${label}: the publishing effect does nothing with the flag off`)
  ok(/import\('@\/lib\/studio-chat-parity-viewer'\)\.then/.test(block), `${label}: the bus module is loaded dynamically, in the gated effect only`)
  eq(importLines(text).filter(line => /studio-chat-parity-viewer/.test(line)), [], `${label}: no new import line (the viewer's proofs see no new import)`)
  // each action is the existing handler, named as the lib says
  const handlers = {
    goTo: 'handleGoToSlide', next: 'handleNextSlide', prev: 'handlePrevSlide', present: 'handleFullscreen', toggleGrid: 'handleToggleGrid', toggleBorders: 'handleToggleBorders', save: 'handleSaveChanges', discard: 'handleCancelEdits',
  }
  for (const [action, handler] of Object.entries(handlers)) ok(new RegExp(`(?:\\{ |, )${action}: ${handler}[,\\s]`).test(block), `${label}: ${action} is ${handler}`)
  ok(/addBlank: \(position: number\) => chatParityViewerMod\.current\?\.addBlankSlide\(handleAddSlide, position, ADD_SLIDE_V2_ENABLED \? addSlideV2Settings : undefined, currentSlide\)/.test(block), `${label}: /blank-slide is handleAddSlide through addBlankSlide, after the current slide`)
  ok(/await handleChangeLayout\(index, layout as SlideLayoutType\); return chatParityLayoutDone\.current/.test(block), `${label}: /layout is handleChangeLayout, answered by its own success flag`)
  ok(/setEditing: \(editing: boolean\) => handleToggleEditModeButton\(editing\)/.test(block), `${label}: /edit and /view pass the requested mode to handleToggleEditModeButton`)
  ok(/setVersion: \(version: 'blank' \| 'strawman' \| 'final'\) => onVersionSwitch\?\.\(version\)/.test(block), `${label}: /version is the Version menu's onVersionSwitch`)
  ok(/setRail: \(show: boolean\) => \{ if \(show && railFocusHidden\) onStudioRailReveal\?\.\(\); else setShowThumbnails\(show\) \}/.test(block), `${label}: /rail is setShowThumbnails (the rail's own reveal when a panel folded it)`)
  ok(/slideReason: studioToolbarDisabledReason\('add-slide', \{ tabPausedHint: studioTabPausedHint, viewerIsReady, templateModeOn, slideMutationPending: isSlideMutationPending \}\)/.test(block), `${label}: the Add Slide button's own reason (isSlideMutationPending, Template Mode, a paused tab)`)
  ok(/chatParityLayoutDone\.current = true/.test(text.slice(text.indexOf('const handleChangeLayout'), text.indexOf('// Reorder slides handler'))), `${label}: handleChangeLayout raises the flag only on its success path`)
  ok(/chatParityLayoutDone\.current = true.*\n\s+toast\(\{\n\s+title: 'Layout Changed'/.test(text), `${label}: ...right before its success toast`)
  // every handler the actions name exists as a real handler of the viewer (a base line)
  for (const handler of Object.values(handlers).concat(['handleAddSlide', 'handleChangeLayout', 'handleToggleEditModeButton'])) ok(new RegExp(`const ${handler} = useCallback`).test(text), `${label}: ${handler} is a real handler`)
  ok(lines.filter(line => MARK.test(line)).length === marked.length, `${label}: stable`)
}

function sourceChecks() {
  // the strip: each file back to the base, byte for byte
  if (hasBase) {
    for (const rel of strip.CHAT_PARITY_VIEWER_FILES) {
      const now = read(rel), base = baseOf(rel)
      ok(now !== base, `${rel}: it is changed`)
      ok(strip.stripChatParityViewer(rel, now) === base, `${rel}: the strip puts it back to the base, byte for byte`)
      ok(registry.stripLaterChanges(rel, now) === registry.stripLaterChanges(rel, base), `${rel}: ...and through the registry (both sides: every registered change strips its own lines)`)
      const marked = addedLines(rel).filter(line => MARK.test(line)), unmarked = addedLines(rel).filter(line => !MARK.test(line))
      eq(unmarked, [], `${rel}: every line added to it carries the marker`)
      const was = removedLines(rel), pairs = (strip.CHAT_PARITY_VIEWER_EDITS[rel] || []).map(([, before]) => before)
      eq(was.slice().sort(), pairs.slice().sort(), `${rel}: the only base lines gone are the recorded changed lines`)
      for (const [has, before] of strip.CHAT_PARITY_VIEWER_EDITS[rel] || []) { ok(MARK.test(has) && now.split('\n').filter(line => line === has).length === 1, `${rel}: a changed line carries the marker and occurs once`); ok(!MARK.test(before), `${rel}: the line before is the base's`) }
      ok(marked.length > 0, `${rel}: has marked lines`)
    }
    // untouched files stay untouched
    for (const rel of [REGISTRY]) ok(strip.stripChatParityViewer(rel, read(rel)).split('\n').length === read(rel).split('\n').length - 2, `${rel}: the strip takes this change's two registry lines out`)
    for (const rel of ['hooks/use-deckster-websocket-v2.ts', '.env.example', 'package.json', 'lib/studio-chat-commands-wire.ts', 'components/builder/studio-chat-commands.css']) ok(read(rel) === baseOf(rel), `${rel}: not touched by this change`)
  } else console.log(`NOTE C  git has no ${strip.BASE_COMMIT.slice(0, 8)}: the base-identity checks were skipped`)
  viewerChecks(read(VIEWER))
  // the registry: two lines, last in their lists, naming this change's files and strip
  const reg = read(REGISTRY)
  const regLines = reg.split('\n').filter(line => line.includes(strip.CHAT_PARITY_VIEWER_REGISTRY_MARK))
  eq(regLines.length, 2, 'registry: two lines')
  ok(regLines.every(line => line.includes('// LATER-CHANGE: ')), 'registry: both marked LATER-CHANGE')
  for (const rel of strip.CHAT_PARITY_VIEWER_SCOPE_FILES) ok(registry.LATER_CHANGE_FILES.has(rel), `registry: ${rel} is registered`)
  ok(registry.LATER_STRIPS.includes(strip.stripChatParityViewer) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(strip.stripChatParityViewer) + 1).every(later => /^stripChatParity/.test(later.name)), 'registry: the strip is registered, last but for the chat parity changes stacked on it') // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE)
  eq(registry.LATER_ENV_BLOCKS.some(block => /STUDIO_CHAT_PARITY_VIEWER/.test(String(block))), false, 'registry: no .env.example block (no flag of its own)')
  const lastFilesLine = reg.split('\n').filter(line => /^  \.\.\.\(await import\(/.test(line)).pop()
  ok(/studio-chat-parity-viewer-strip\.mjs/.test(lastFilesLine) && reg.indexOf(lastFilesLine) < reg.indexOf('// one line per later change, above this comment'), 'registry: appended at the end of the files list, above the marker comment')
  // no new flag: the only flags this change reads are the three the commands already need
  const flagNames = new Set()
  const scan = (text) => { for (const match of text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) flagNames.add(match[0]) }
  for (const rel of [LIB, MENU, CSS]) scan(read(rel))
  if (hasBase) for (const rel of strip.CHAT_PARITY_VIEWER_FILES) scan(addedLines(rel).join('\n'))
  eq([...flagNames].sort(), ['NEXT_PUBLIC_STUDIO_CHAT_CLEAN', 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS'], 'no new flag: the only env names this change names are the existing commands flag and the chat clean one it needs (the viewer also reads the shell flag it already reads)')
  // flag off: the composer and the page do nothing new
  const hook = read(COMMANDS_UI).split('\n').filter(line => MARK.test(line)).join('\n')
  ok(/const parity: ParityRow\[\] = enabled && trigger\?\.kind === 'command' \? parityRows\(trigger, parityEnv\) : \[\]/.test(hook), 'composer: flag off (enabled false) there are no viewer rows')
  ok(/if \(row\.disabled \|\| row\.hint\) return/.test(hook) && hook.indexOf('if (row.disabled || row.hint) return') < hook.indexOf('void runParity('), 'composer: a disabled row or a hint row returns before anything runs (the menu stays open)')
  ok(/runParity\(row\.run, \{ building: input\.stop\.visible, choosePreset: input\.choosePreset \?\? \(\(\) => \{\}\), showCanvas \}\)\.then\(postNote\)/.test(hook), 'composer: a run is announced with what the bus saw')
  ok(/const add = page\?\.parity\?\.addNote; if \(add\) add\(result\.note\); else show\(/.test(hook), 'composer: the note goes into the thread, the card above the composer when the page gave none')
  ok(/choosePreset: presetId => handlePresetChange\(presetId\)/.test(read(COMPOSER)) && /const handlePresetChange = \(presetId: string\)/.test(read(COMPOSER)), 'composer: /theme <preset> is the popup\'s own handlePresetChange')
  ok(/if \(chatCommandsPage\) chatCommandsPage\.parity = \{ addNote: text => \{ chatCleanNotes\.addNote\(text\)/.test(read(PAGE)), 'page: the note function is given only with the commands flag on (chatCommandsPage is undefined with it off)')
  ok(/const chatCommandsPage: ChatCommandsPageProps \| undefined = chatCommandsOn \?/.test(read(PAGE)), 'page: chatCommandsPage exists only with the flag on (base line)')
  // the legacy detection of the existing commands is unchanged; two words are allowed only after /layout and /theme
  const commandsLib = read(COMMANDS_LIB)
  ok(commandsLib.includes('const COMMAND_RE = /(^|\\s)\\/([\\w-]*)(?: ([\\w-]*))?$/'), 'commands lib: the one-word rule of the existing commands is untouched')
  ok(commandsLib.includes('const COMMAND_WORDS_RE = /(^|\\s)\\/(layout|theme) ([^\\n]*)$/i'), 'commands lib: several words only after /layout and /theme')
  // the thread's note kind
  const cleanLib = read(CLEAN_LIB)
  ok(/export type ChatCleanNoteKind = .*'directions' \| 'command'/.test(cleanLib), 'chat clean: one more note kind')
  ok(/export const chatCleanCommandNote = /.test(cleanLib), 'chat clean: the note function lives with the others')
  ok(/const addNote = useCallback\(\(text: string\) => \{ \/\/ CHAT-PARITY-VIEWER\n\s+if \(!latestRef\.current\.enabled\) return/.test(read(CLEAN_UI)), 'chat clean: addNote does nothing with chat clean off')
  // the lib: pure, nothing from the browser, no network, no confirm, no secrets
  const libText = read(LIB)
  const code = libText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const [pattern, why] of [[/\bconfirm\s*\(/, 'no confirm box of its own'], [/\bwindow\b|\bdocument\b|\blocalStorage\b/, 'no browser globals'], [/\bfetch\s*\(|XMLHttpRequest|WebSocket/, 'no network'], [/process\.env/, 'no flag read (the viewer and the composer gate it)'], [/\bimport\s+React|from 'react'/, 'no React']]) ok(!pattern.test(code), `lib: ${why}`)
  eq(importLines(libText).map(line => line.replace(/^import .* from /, '')), ["'@/types/elements'", "'@/lib/studio-add-slide-v2'"], 'lib: imports only the layout catalog and the add-slide options')
  ok(!/(sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[:=]|Bearer\s+[A-Za-z0-9]|-----BEGIN)/i.test([LIB, MENU, CSS].map(read).join('\n')), 'no secrets in this change\'s new files')
  // the committed diff is this change's files (the COMMITTED diff only: a working-tree edit is not read here)
  if (OWN.length && hasBase) {
    const touched = new Set()
    for (const sha of OWN) for (const rel of git('diff-tree', '--no-commit-id', '--name-only', '-r', '-m', '--first-parent', sha).split('\n').filter(Boolean)) touched.add(rel)
    const stray = [...touched].filter(rel => !strip.CHAT_PARITY_VIEWER_SCOPE_FILES.has(rel))
    eq(stray, [], 'the committed diff of this change\'s commits is its own files (strays: none)')
    ok(OWN.every(sha => /Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>/.test(git('log', '-1', '--format=%B', sha))), 'every commit of this change carries the Co-Authored-By line')
  } else console.log(`NOTE C  no own commit yet (subject "${strip.CHAT_PARITY_VIEWER_SUBJECT} ..."): the committed-diff check was skipped`)
}

/** The three groups' markup, rendered on the real component. */
function menuChecks(text = read(MENU)) {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const module = { exports: {} }
  const req = specifier => {
    if (specifier === 'react') return React
    if (specifier === 'lucide-react') return require('lucide-react')
    if (/\.css$/.test(specifier)) return {}
    if (specifier === '@/lib/studio-chat-parity-viewer') return {}
    throw new Error(`the menu imports ${specifier}`)
  }
  new Function('module', 'exports', 'require', compile(text, MENU))(module, module.exports, req)
  const lib = loadLib()
  const rowProps = index => ({ id: `opt-${index}`, role: 'option', type: 'button', 'aria-selected': index === 4, className: 'row' })
  const html = renderToStaticMarkup(React.createElement(module.exports.ChatParityRows, { rows: lib.parityRows({ name: '', arg: null }, envOf({ viewer: null })), offset: 12, rowProps, headingClass: 'heading' }))
  eq([...html.matchAll(/data-studio-chat-commands-heading="(\w+)"/g)].map(match => match[1]), ['slides', 'view', 'deck'], 'menu: three headings, Slides, View, Deck')
  eq([...html.matchAll(/id="opt-(\d+)"/g)].map(match => Number(match[1])), Array.from({ length: 16 }, (_, i) => 12 + i), 'menu: one index list after the existing rows (arrows and ARIA ids work through it)')
  eq((html.match(/aria-disabled="true"/g) || []).length, 14, 'menu: a row that cannot run is aria-disabled (the 14 viewer rows with no deck; /theme and /canvas can run)')
  ok(html.includes('Open or build a deck first.') && html.includes('data-studio-chat-parity="true"'), 'menu: the reason is on the row')
  ok(/aria-label="\/goto: Open or build a deck first\."/.test(html), 'menu: the label for assistive technology says the reason')
  const hint = renderToStaticMarkup(React.createElement(module.exports.ChatParityRows, { rows: lib.parityRows({ name: 'goto', arg: '12' }, envOf()), offset: 0, rowProps, headingClass: 'heading' }))
  ok(hint.includes('This deck has 8 slides.') && hint.includes('data-studio-chat-parity-hint="true"') && hint.includes('aria-disabled="true"'), 'menu: a hint row says it inline and cannot be picked')
  const css = read(CSS)
  ok(!/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(css), 'css: no colour of its own (chat clean tokens only)')
  ok(css.split('\n').filter(line => /^\[/.test(line)).every(line => line.startsWith('[data-studio-v4-shell="true"] [data-studio-chat-clean] [data-studio-chat-commands-menu]')), 'css: every rule is scoped to the flagged menu')
}

/** chat clean's note function, evaluated bare (its lib is import-free by design). */
function noteChecks(text = read(CLEAN_LIB)) {
  const module = { exports: {} }
  new Function('module', 'exports', 'process', compile(text, CLEAN_LIB))(module, module.exports, { env: {} })
  const { chatCleanCommandNote } = module.exports
  const a = chatCleanCommandNote([], '  Went to slide 3  ', 1000)
  eq(plain(a), [{ id: 'command:1000:0', kind: 'command', text: 'Went to slide 3', at: 1000, buildId: null }], 'note: one command note, trimmed')
  eq(chatCleanCommandNote(a, '   ', 5), a, 'note: an empty note adds nothing')
  let notes = []
  for (let i = 0; i < 60; i++) notes = chatCleanCommandNote(notes, `n${i}`, i)
  eq([notes.length, notes[0].text, notes[notes.length - 1].text], [40, 'n20', 'n59'], 'note: the thread keeps the newest 40, like the others')
  ok(chatCleanCommandNote(a, 'x', 2) !== a, 'note: the list is never mutated')
}

// ============================================================================================================================================
// D. Mutants: each must be caught by A-C
// ============================================================================================================================================
async function mutantsSuite() {
  const libText = read(LIB)
  let mutantsCaught = 0
  const hit = (condition, message) => { mutantsCaught++; ok(condition, message) }
  const caught = async (name, mutate, run) => {
    const mutated = mutate(libText)
    assert.notEqual(mutated, libText, `mutant applies: ${name}`)
    let threw = false
    try { await run(mutated) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  const both = async mutated => { libSuite(loadLib(mutated)); await busSuite(mutated) }
  const m = (from, to) => text => { if (!text.includes(from)) throw new Error(`mutant anchor missing: ${from}`); return text.replace(from, to) }
  await caught('/goto off by one (1-based index sent)', m('await a.goTo(run.slide - 1)', 'await a.goTo(run.slide)'), both)
  await caught('/next and /prev swapped', m("await (run.name === 'next' ? a.next() : a.prev())", "await (run.name === 'next' ? a.prev() : a.next())"), both)
  await caught('a move claimed without looking (settle returns at once)', m('if (state && test(state)) return state', 'if (state) return state'), both)
  await caught('the block check is skipped at run time', m('if (blocked || !handle || !before) return failed(blocked ?? PARITY_WORDS.noDeck)', 'if (!handle || !before) return failed(PARITY_WORDS.noDeck)'), both)
  await caught('/discard also saves', m("await a.discard() //", "await a.save(); await a.discard() //"), both)
  await caught('/discard also switches mode (a second way to drop edits)', m("await a.discard() //", "await a.setEditing(false); await a.discard() //"), both)
  await caught('/discard claims it discarded without looking', m("return fresh()?.editing === false ? done('Discarded your edits') : done('Kept your edits')", "return done('Discarded your edits')"), both)
  await caught('/rail show and hide inverted', m('await a.setRail(run.show)', 'await a.setRail(!run.show)'), both)
  await caught('a build no longer holds the mutations', m("const MUTATIONS: ReadonlySet<string> = new Set(['blank-slide', 'layout', 'edit', 'save', 'discard'])", 'const MUTATIONS: ReadonlySet<string> = new Set([])'), both)
  await caught('/goto is held by a build too (read-only commands must not be)', m("const MUTATIONS: ReadonlySet<string> = new Set(['blank-slide', 'layout', 'edit', 'save', 'discard'])", "const MUTATIONS: ReadonlySet<string> = new Set(['blank-slide', 'layout', 'edit', 'save', 'discard', 'goto'])"), both)
  await caught('the blank slide goes before the current slide', m('const refused = await a.addBlank(before.slide)', 'const refused = await a.addBlank(before.slide - 1)'), both)
  await caught('a layout is claimed on any answer', m('return confirmed === true ? done(', 'return confirmed !== undefined ? done('), both)
  await caught('the Add Slide button\'s reason is dropped for /layout', m("case 'layout': return state.slideReason", "case 'layout': return null"), both)
  await caught('an impossible slide number is runnable', m('if (slide < 1 || slide > count) return [problem(', 'if (slide < 1 || slide > count + 99) return [problem('), both)
  await caught('/theme calls the chip with the name, not the id', m('deps.choosePreset(run.preset.id)', 'deps.choosePreset(run.preset.name)'), both)
  await caught('/grid on while on still toggles', m("case 'grid': return run.on !== null && state.grid === run.on ? PARITY_WORDS.onOffAlready('Grid', run.on) : null", "case 'grid': return null"), both)
  await caught('groups out of order', m("Object.freeze(['Slides', 'View', 'Deck'] as ParityGroup[])", "Object.freeze(['Deck', 'View', 'Slides'] as ParityGroup[])"), both)
  await caught('a typed word reaches discard as a run', m('if (!def.takes && def.name !== \'grid\' && def.name !== \'borders\') return arg ? [problem(def.name, `/${def.name}`, PARITY_WORDS.nothingAfter(def.name), env)] : [firstLevel(def, env)]', 'if (!def.takes && def.name !== \'grid\' && def.name !== \'borders\') return [firstLevel(def, env)]'), both)
  await caught('no deck is not a reason', m("if (!state) return PARITY_WORDS.noDeck", "if (!state) return null"), both)
  await caught('the published state is announced every time', m('if (text === signature) return', 'if (false) return'), both)
  await caught('/version switches to the wrong version', m('await a.setVersion(run.version)', "await a.setVersion('final')"), both)
  await caught('the layout list is not the catalog', m('SLIDE_LAYOUTS.map(item => ({ id: item.layout as string, label: item.label }))', 'SLIDE_LAYOUTS.slice(1).map(item => ({ id: item.layout as string, label: item.label }))'), both)
  await caught('the lib gains a confirm box', t => `${t}\nexport const askFirst = () => confirm('sure?')\n`, async mutated => { sourceLibOnly(mutated) })
  // the strip and the sources
  const stripText = fs.readFileSync(path.join(root, 'scripts/studio-chat-parity-viewer-strip.mjs'), 'utf8')
  const loadStrip = text => import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
  const identity = async mod => { if (!hasBase) throw new Error('no base: the mutant cannot be judged here (treated as caught)'); for (const rel of strip.CHAT_PARITY_VIEWER_FILES) if (mod.stripChatParityViewer(rel, read(rel)) !== baseOf(rel)) throw new Error(`${rel}: not the base`) }
  for (const [name, from, to] of [
    ['the strip forgets the marker', 'CHAT_PARITY_VIEWER_MARKER_RE = /(?<![\\w-])CHAT-PARITY-VIEWER(?![\\w-])/', 'CHAT_PARITY_VIEWER_MARKER_RE = /(?<![\\w-])CHAT-PARITY-VIEWER-NOT(?![\\w-])/'],
    ['the strip does not put changed lines back', 'const swapped = (CHAT_PARITY_VIEWER_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)', 'const swapped = text'],
    ['the strip drops a file', '  "components/presentation-viewer.tsx",\n', ''],
  ]) {
    const mutated = stripText.replace(from, to)
    assert.notEqual(mutated, stripText, `mutant applies: ${name}`)
    let threw = false
    try { await identity(await loadStrip(mutated)) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  const viewerText = read(VIEWER)
  for (const [name, from, to] of [
    ['the gate loses a flag', "process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true' // CHAT-PARITY-VIEWER", "true // CHAT-PARITY-VIEWER"],
    ['the registering effect runs with the flag off', 'useEffect(() => { if (!chatParityViewerOn) return; let off', 'useEffect(() => { let off'],
    ['the viewer imports the bus statically', "import { SlideLayoutPicker, SlideLayoutType } from './slide-layout-picker'", "import { SlideLayoutPicker, SlideLayoutType } from './slide-layout-picker'\nimport { registerViewer } from '@/lib/studio-chat-parity-viewer'"],
    ['goTo is not handleGoToSlide', 'goTo: handleGoToSlide,', 'goTo: handleNextSlide,'],
    ['/discard calls something else', 'discard: handleCancelEdits,', 'discard: handleSaveChanges,'],
    ['/edit sends a blind toggle', 'setEditing: (editing: boolean) => handleToggleEditModeButton(editing)', 'setEditing: (editing: boolean) => handleToggleEditModeButton()'],
    ['/layout is confirmed before the change', "chatParityLayoutDone.current = true // CHAT-PARITY-VIEWER\n        toast({\n          title: 'Layout Changed',", "toast({\n          title: 'Layout Changed',"],
    ['the Add Slide reason is not the button\'s', "studioToolbarDisabledReason('add-slide', {", "studioToolbarDisabledReason('theme', {"],
  ]) {
    const mutated = viewerText.replace(from, to)
    assert.notEqual(mutated, viewerText, `mutant applies: ${name}`)
    let threw = false
    try { viewerChecks(mutated, 'mutant') } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  // an unmarked line left in a stripped file
  if (hasBase) {
    const stripMod = strip
    const unmarked = read(COMMANDS_UI).replace('const parityViewer = useSyncExternalStore', 'const parityViewer = /* x */ useSyncExternalStore').replace(' // CHAT-PARITY-VIEWER: the viewer\'s own state', ' // the viewer\'s own state')
    hit(stripMod.stripChatParityViewer(COMMANDS_UI, unmarked) !== baseOf(COMMANDS_UI), 'mutant caught: an unmarked line stays in the stripped file')
  }
  // the note function and the menu
  for (const [name, from, to] of [['the note is not trimmed', "kind: 'command' as const, text: text.trim(),", "kind: 'command' as const, text: text,"], ['the thread keeps everything', "at: now, buildId: null }].slice(-CHAT_CLEAN_NOTES_MAX)", 'at: now, buildId: null }]'], ['an empty note is added', '(text.trim() ? [...notes,', '(true ? [...notes,']]) {
    const cleanText = read(CLEAN_LIB)
    const mutated = cleanText.replace(from, to)
    assert.notEqual(mutated, cleanText, `mutant applies: ${name}`)
    let threw = false
    try { noteChecks(mutated) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  for (const [name, from, to] of [['the menu forgets aria-disabled', "aria-disabled={off ? 'true' : undefined}", ''], ['the menu starts its indexes at zero', 'rowProps(offset + index)', 'rowProps(index)'], ['the menu shows the blurb in place of the reason', 'const said = row.hint ?? row.disabled ?? row.blurb', 'const said = row.blurb']]) {
    const menuText = read(MENU)
    const mutated = menuText.replace(from, to)
    assert.notEqual(mutated, menuText, `mutant applies: ${name}`)
    let threw = false
    try { menuChecks(mutated) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  return mutantsCaught
}

/** The lib-only source rules (also run on a mutated lib). */
function sourceLibOnly(text) {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  if (/\bconfirm\s*\(/.test(code)) throw new Error('the lib has a confirm box of its own')
}

// ============================================================================================================================================
// Run
// ============================================================================================================================================
libSuite()
console.log(`PASS A  the lib: slide numbers, layout matching, what blocks each command, every row, the typed word that never confirms (${checks} checks)`)
const afterA = checks
await busSuite()
console.log(`PASS B  the bus on a fake viewer: every command's handler and arguments, what it saw, refusals, discard, the published state (${checks - afterA} checks)`)
const afterB = checks
sourceChecks()
menuChecks()
noteChecks()
sourceLibOnly(read(LIB))
console.log(`PASS C  the sources: markers, the strip back to the base, the viewer's gate and handlers, the registry, no new flag, the committed diff, the menu markup, the note (${checks - afterB} checks)`)
const mutants = await mutantsSuite()
console.log(`test-studio-chat-parity-viewer: ${checks} checks, ${mutants} mutants caught (${OWN.length ? `own commits ${OWN.map(sha => sha.slice(0, 8)).join(', ')}` : 'no own commit yet'})${hasBase ? '' : ' (base commit not in this clone: some checks skipped)'}`)
