// FRONTEND-1 (overnight chat parity, workspace half): proof of the workspace "/" commands behind NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (the string "true", default off, build-time; it already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell), stacked on the viewer half (#611).
//   lib/studio-chat-parity-workspace.ts (the rows, what cannot run and why, the words, the bus in parts), components/builder/chat/studio-chat-parity-workspace.tsx (the composer's glue), marked lines in the Builder page, the viewer, the notes panel, the introduction,
//   the composer's hook and the commands lib, and two marked lines in the viewer half's own lib and menu.
//
//   A. The lib, function by function, in THIS realm: what blocks each command (and the button's own reason), the rows for every trigger (hints, disabled reasons, one group), the saved templates, the typed word that never confirms.
//   B. The bus on FAKE PARTS: every command calls its handler with the right arguments, says what it saw (and never a change it did not see), refuses what the buttons refuse, restore stays a click; the viewer half's runParity hands a workspace run on.
//   C. The sources: every marked line, the strip puts each file back to the viewer half's head byte for byte (and through the registry), the gates and the handlers of the page, the viewer, the notes panel and the introduction, the glue, the trigger,
//      no new flag, the committed diff is this change's files (COMMITTED diff only), the menu markup.
//   D. MUTANTS: every one of them must be caught by A-C.
//
//   node scripts/test-studio-chat-parity-workspace.mjs
//
// Offline: no socket, no fetch, no browser; the bus runs on fake parts and short waits (scale); git is read only for C. Later changes stack on top, so the committed-diff check reads THIS change's own commits (subject "Chat parity workspace: ...").
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
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside a vm have their own prototypes: compare them as plain data
const eq = (actual, expected, message) => { checks++; assert.deepEqual(plain(actual), plain(expected), message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const strip = await import('./studio-chat-parity-workspace-strip.mjs')
const viewerStrip = await import('./studio-chat-parity-viewer-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')

const LIB = 'lib/studio-chat-parity-workspace.ts'
const GLUE = 'components/builder/chat/studio-chat-parity-workspace.tsx'
const ICONS = 'components/builder/chat/studio-chat-parity-workspace-icons.ts'
const VIEWER_LIB = 'lib/studio-chat-parity-viewer.ts'
const MENU = 'components/builder/chat/studio-chat-parity-viewer-menu.tsx'
const PAGE = 'app/builder/page.tsx'
const VIEWER = 'components/presentation-viewer.tsx'
const NOTES = 'components/slide-notes-panel.tsx'
const INTRO = 'components/builder/studio-introduction.tsx'
const COMMANDS_UI = 'components/builder/chat/studio-chat-commands.tsx'
const COMMANDS_LIB = 'lib/studio-chat-commands.ts'
const PICKER = 'components/builder/template-picker.tsx'
const REGISTRY = 'scripts/studio-later-changes.mjs'
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const exists = sha => { try { git('cat-file', '-e', `${sha}^{commit}`); return true } catch { return false } }
const hasBase = exists(strip.BASE_COMMIT) && exists(strip.BASE_UNDER_COMMIT)
const baseCommitOf = rel => (strip.BASE_TOUCHED.includes(rel) ? strip.BASE_COMMIT : strip.BASE_UNDER_COMMIT)
const baseOf = rel => git('show', `${baseCommitOf(rel)}:${rel}`)
/** This change's own commits (newest first): subject "Chat parity workspace: ...". */
const OWN = (() => { try { return git('log', '--format=%H%x09%s', '--no-merges', `${strip.BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).map(line => line.split('\t')).filter(([, subject]) => subject.startsWith(strip.CHAT_PARITY_WORKSPACE_SUBJECT)).map(([sha]) => sha) } catch { return [] } })()

// ---- the libs, evaluated in THIS realm (the viewer half's lib: its two imports come from the repo through the harness loader; this lib: the viewer half's lib) -----------------------
const compiled = new Map()
function compile(text, fileName) {
  const key = `${fileName}\n${text}`
  if (compiled.has(key)) return compiled.get(key)
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  compiled.set(key, out.outputText)
  return out.outputText
}
const repoLoader = createModuleLoader({ root, globals: { process: { env: { NODE_ENV: 'production' } }, console, Date, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp } })
const evaluate = (text, fileName, req) => { const module = { exports: {} }; new Function('module', 'exports', 'require', 'process', compile(text, fileName))(module, module.exports, req, { env: {} }); return module.exports }
function loadViewerLib(text = read(VIEWER_LIB)) {
  return evaluate(text, VIEWER_LIB, specifier => {
    if (specifier === '@/types/elements') return repoLoader.load('types/elements.ts')
    if (specifier === '@/lib/studio-add-slide-v2') return repoLoader.load('lib/studio-add-slide-v2.ts')
    throw new Error(`the viewer half's lib imports only the layout catalog and the add-slide options, not ${specifier}`)
  })
}
function loadWs(text = read(LIB), viewer = loadViewerLib()) {
  return evaluate(text, LIB, specifier => {
    if (specifier === '@/lib/studio-chat-parity-viewer') return viewer
    throw new Error(`the workspace lib imports only the viewer half's lib, not ${specifier}`)
  })
}
const SCALE = 0.01 // the bus waits (ms) times this to SEE an effect: a command that changes nothing fails fast

// ---- fakes: the state each part reads, the handlers each part calls, and a template list ---------------------------------------------------------------------------------
const pickOf = (id, name, over = {}) => ({ id, name, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', blueprint_enrichment_error: null, template_purity_status: 'clean', template_purity_error: null, ...over })
const choice = (id, name, over = {}) => ({ id, name, pick: pickOf(id, name), ready: true, why: null, ...over })
const TEMPLATES = [choice('t1', 'Quarterly Review'), choice('t2', 'Sales Pitch'), choice('t3', 'Board Update', { ready: false, why: 'Template optimizing' })]
const baseState = (over = {}) => ({
  kg: { access: 'ready', on: false, locked: false }, template: { builder: true, active: null, locked: false, running: false }, mode: { builder: true, on: false, available: false, blocked: null },
  pane: { dual: false, overlay: true, showing: 'chat', inspector: true }, introReady: true, intro: { active: false }, notes: { shown: false }, theme: { choice: 'light' }, history: { enabled: true, available: true }, ...over,
})
const envOf = (over = {}) => ({ state: baseState(), draft: false, templates: { status: 'ready', items: TEMPLATES }, templateBlocked: null, ...over })
const R = value => ({ ws: true, ...value })

/** Five fake parts (page, viewer, notes, intro, composer): handlers that record what they were called with and change what the buttons would read. `behave` per handler: 'noop' (does nothing), 'throw'. */
function fakeApp(ws, init = {}, behave = {}, omit = []) {
  const calls = []
  const s = baseState(init)
  const rec = (name, fn) => (...args) => { calls.push([name, ...args]); if (behave[name] === 'throw') throw new Error('boom'); return behave[name] === 'noop' ? undefined : fn?.(...args) }
  const parts = {
    page: {
      state: () => ({ kg: s.kg, template: s.template, pane: s.pane, introReady: s.introReady }),
      actions: {
        setKg: rec('setKg', on => { s.kg = { ...s.kg, on } }),
        selectTemplate: rec('selectTemplate', pick => { s.template = { ...s.template, active: { id: pick.id, name: pick.name } } }),
        clearTemplate: rec('clearTemplate', () => { s.template = { ...s.template, active: null } }),
        stopTemplateReuse: rec('stopTemplateReuse', () => { s.template = { ...s.template, running: false } }),
        selectPane: rec('selectPane', pane => { s.pane = { ...s.pane, showing: pane } }),
      },
    },
    viewer: { state: () => ({ mode: s.mode }), actions: { setTemplateMode: rec('setTemplateMode', on => { s.mode = { ...s.mode, on } }) } },
    notes: { state: () => ({ notes: s.notes }), actions: { toggleNotes: rec('toggleNotes', () => { s.notes = { shown: !s.notes.shown } }) } },
    intro: { state: () => ({ intro: s.intro }), actions: { replayIntro: rec('replayIntro', () => { s.intro = { active: true } }) } },
    composer: {
      state: () => ({ theme: s.theme, history: s.history }),
      actions: { setTheme: rec('setTheme', choiceNow => { s.theme = { choice: choiceNow } }), openHistory: rec('openHistory', () => behave.historyOpens ?? true) },
    },
  }
  const offs = Object.entries(parts).filter(([key]) => !omit.includes(key)).map(([key, part]) => ws.registerWorkspacePart(key, () => ({ state: part.state(), actions: part.actions })))
  return { calls, s, off: () => offs.forEach(off => off()) }
}
const emit = (ws, what) => ws.emitWorkspaceCommand(what, { scale: SCALE })

// ============================================================================================================================================
// A. The lib
// ============================================================================================================================================
function libSuite(ws = loadWs()) {
  const W = ws.WORKSPACE_WORDS
  const rows = (name, arg, over) => ws.workspaceRows({ name, arg }, envOf(over))
  const labels = list => list.map(row => row.label)
  const blocked = (what, over) => ws.workspaceBlocked(what, baseState(over))

  // -- what blocks each command, and the button's own reason ------------------------------------------------------------------------------------
  const KG_ON = R({ name: 'kg', on: true }), KG_OFF = R({ name: 'kg', on: false })
  eq([blocked(KG_ON), blocked(KG_OFF)], [null, W.kgAlready(false)], 'kg: ready and unlocked: on can run, off says it already is')
  eq([blocked(KG_ON, { kg: { access: 'ready', on: true, locked: false } }), blocked(KG_OFF, { kg: { access: 'ready', on: true, locked: false } })], [W.kgAlready(true), null], 'kg: on while on says so')
  eq(['locked', 'unavailable', 'loading', 'setup'].map(access => blocked(KG_ON, { kg: { access, on: false, locked: false } })), [W.kgPro, W.kgOffline, W.kgLoading, W.kgSetup], 'kg: no switch is drawn until access is ready: the remedy button\'s own words (Pro, Offline, loading, Enable)')
  eq([blocked(KG_ON, { kg: { access: 'ready', on: false, locked: true } }), blocked(KG_OFF, { kg: { access: 'ready', on: true, locked: true } })], [W.kgLocked, W.kgLocked], 'kg: locked once research ran, in either direction (like the other two switches)')
  eq(blocked(KG_ON, { kg: { access: 'locked', on: false, locked: true } }), W.kgPro, 'kg: with no access the switch is not drawn, so the access reason comes before the lock')
  eq(blocked(KG_ON, { kg: null }), W.noPage, 'kg: no page part: the reason, never a silent no-op')
  const CLEAR = R({ name: 'template', op: 'clear' }), STOP = R({ name: 'template', op: 'stop' }), SELECT = R({ name: 'template', op: 'select', pick: pickOf('t1', 'Quarterly Review') })
  const chosen = { id: 't1', name: 'Quarterly Review' }
  eq([blocked(CLEAR), blocked(CLEAR, { template: { builder: true, active: chosen, locked: false, running: false } }), blocked(CLEAR, { template: { builder: true, active: chosen, locked: true, running: false } })], [W.noTemplateChosen, null, W.templateLocked], 'template clear: needs a chosen template, and the chip\'s X is not drawn once the selection is locked')
  eq([blocked(STOP), blocked(STOP, { template: { builder: true, active: chosen, locked: true, running: true } })], [W.reuseNotRunning, null], 'template stop: only while a reuse runs (the Stop template reuse button), even though a reuse running locks the selection')
  eq([blocked(SELECT), blocked(SELECT, { template: { builder: true, active: null, locked: true, running: false } }), blocked(SELECT, { template: { builder: true, active: chosen, locked: false, running: false } })], [null, W.templateLocked, W.templateAlready], 'template select: not once the selection is locked; the one already chosen says so')
  eq([blocked(SELECT, { template: { builder: false, active: null, locked: false, running: false } }), blocked(CLEAR, { template: { builder: false, active: null, locked: false, running: false } }), blocked(STOP, { template: { builder: false, active: null, locked: false, running: false } })], [W.templateOff, W.templateOff, W.templateOff], 'templates not turned on in this build: every template command says so')
  eq(blocked(SELECT, { template: null }), W.noPage, 'template: no page part')
  const MODE_ON = R({ name: 'template-mode', on: true }), MODE_OFF = R({ name: 'template-mode', on: false })
  const MODE = (over = {}) => ({ mode: { builder: true, on: false, available: true, blocked: null, ...over } })
  eq([blocked(MODE_ON, MODE()), blocked(MODE_OFF, MODE()), blocked(MODE_ON, MODE({ on: true })), blocked(MODE_OFF, MODE({ on: true }))], [null, W.modeAlready(false), W.modeAlready(true), null], 'template mode: on / off say when already so')
  eq([blocked(MODE_ON, MODE({ available: false })), blocked(MODE_OFF, MODE({ on: true, available: false }))], [W.modeNeedsTemplate, null], 'template mode: entering needs a chosen template ("Select template"); leaving never does')
  eq([blocked(MODE_ON, MODE({ blocked: 'Loading the slide…' })), blocked(MODE_ON, MODE({ blocked: 'This tab is paused' })), blocked(MODE_ON, MODE({ builder: false })), blocked(MODE_ON, { mode: null })], ['Loading the slide…', 'This tab is paused', W.templateOff, W.noDeck], 'template mode: the Template button\'s own reason (loading, a paused tab), templates off, no deck')
  eq([blocked(R({ name: 'notes', show: true })), blocked(R({ name: 'notes', show: false })), blocked(R({ name: 'notes', show: true }), { notes: { shown: true } }), blocked(R({ name: 'notes', show: false }), { notes: null })], [null, W.notesAlready(false), W.notesAlready(true), W.noDeck], 'notes: show / hide say when already; no panel on screen: no deck')
  eq([blocked(R({ name: 'dark' })), blocked(R({ name: 'light' })), blocked(R({ name: 'system' })), blocked(R({ name: 'light' }), { theme: { choice: 'light' } }), blocked(R({ name: 'dark' }), { theme: { choice: null } })], [null, W.themeAlready('Light'), null, W.themeAlready('Light'), null], 'appearance: the one in use says so; before the browser has said, any can run')
  eq([blocked(R({ name: 'intro' })), blocked(R({ name: 'intro' }), { intro: null }), blocked(R({ name: 'intro' }), { introReady: false }), blocked(R({ name: 'intro' }), { introReady: null }), blocked(R({ name: 'intro' }), { intro: { active: true } })], [null, W.introNone, W.introBusy, W.introBusy, W.introPlaying], 'intro: not mounted, not eligible (the page says), already playing')
  const PANE = (over = {}) => ({ pane: { dual: false, overlay: true, showing: 'chat', inspector: true, ...over } })
  eq(['chat', 'slides', 'inspector'].map(pane => blocked(R({ name: 'pane', pane }), PANE())), [W.paneAlready('Chat'), null, null], 'pane: the one showing says so')
  eq(['chat', 'slides', 'inspector'].map(pane => blocked(R({ name: 'pane', pane }), PANE({ dual: true }))), [W.paneDual, W.paneDual, W.paneDual], 'pane: wide enough for chat and slides together there is no switcher')
  eq([blocked(R({ name: 'pane', pane: 'slides' }), PANE({ overlay: false })), blocked(R({ name: 'pane', pane: 'inspector' }), PANE({ inspector: false })), blocked(R({ name: 'pane', pane: 'chat' }), { pane: null })], [W.paneSlidesShown, W.paneNoInspector, W.noPage], 'pane: the Slides button only on narrow widths; the Inspector button needs an inspector')
  eq([blocked(R({ name: 'history' })), blocked(R({ name: 'history' }), { history: { enabled: false, available: false } }), blocked(R({ name: 'history' }), { history: { enabled: true, available: false } }), blocked(R({ name: 'history' }), { history: null })], [null, W.historyOff, W.noDeck, W.noPage], 'history: its flag, and a deck on screen (the menu row\'s own rule)')

  // -- the rows ------------------------------------------------------------------------------------------------------------------------------
  const all = rows('', null)
  eq(labels(all), ['/kg', '/template <name>', '/template-mode', '/notes', '/dark', '/light', '/system', '/intro', '/pane', '/history'], 'every command has one row, in the menu\'s order')
  eq([...new Set(all.map(row => row.group))], ['Workspace'], 'one group, Workspace')
  eq(all.filter(row => row.fill).map(row => row.command), ['kg', 'template', 'template-mode', 'notes', 'pane'], 'a command that takes a word fills its name so the choices show; the rest run')
  ok(all.every(row => row.blurb && row.blurb.length <= 48), 'one short line each')
  ok(all.filter(row => !row.fill).every(row => row.run && row.run.ws === true && row.run.name === row.command), 'a row that runs carries exactly its command, marked as a workspace run')
  eq(all.filter(row => row.disabled).map(row => [row.command, row.disabled]), [['light', W.themeAlready('Light')]], 'everything in reach, a button for each: only the appearance already in use is disabled, with its reason')
  eq(new Set(all.map(row => row.key)).size, all.length, 'row keys are unique')
  eq(labels(rows('k', null)), ['/kg', '/dark'], 'typing filters: names that start with it, then the names that contain it')
  eq(labels(rows('tem', null)), ['/template <name>', '/template-mode', '/system'], 'typing filters: template and template-mode, then system (it contains "tem")')
  eq(labels(rows('mode', null)), ['/template-mode'], 'names that contain it come too')
  eq(labels(rows('s', null)), ['/system', '/notes', '/history'], 'typing a letter lists the names that start with it first, then the names that contain it')
  eq(rows('nope', null), [], 'a word that names no command: no rows (the other menus close it)')
  // no page part, no deck: every row says why
  const nothing = ws.workspaceRows({ name: '', arg: null }, envOf({ state: ws.EMPTY_WORKSPACE_STATE }))
  eq(nothing.map(row => [row.command, row.disabled]), [['kg', W.noPage], ['template', W.noPage], ['template-mode', W.noDeck], ['notes', W.noDeck], ['dark', W.noPage], ['light', W.noPage], ['system', W.noPage], ['intro', W.introNone], ['pane', W.noPage], ['history', W.noPage]], 'no part mounted: each row is disabled with its reason')
  // kg
  eq(rows('kg', 'on').map(row => [row.label, row.run, row.disabled]), [['/kg on', R({ name: 'kg', on: true }), null]], '/kg on')
  eq(rows('kg', '').map(row => [row.label, row.disabled]), [['/kg on', null], ['/kg off', W.kgAlready(false)]], '/kg with no word: on and off, the one that is already so disabled with its reason')
  eq(rows('kg', 'of').map(row => row.label), ['/kg off'], 'a letter filters')
  eq([rows('kg', 'maybe')[0].hint, rows('kg', 'maybe')[0].run], [W.onOffHint('kg'), null], 'a word that is neither on nor off: a hint, nothing runs')
  ok(rows('kg', 'on', { state: baseState({ kg: { access: 'ready', on: false, locked: true } }) }).every(row => row.disabled === W.kgLocked && !row.run), 'kg locked: one disabled row with the reason')
  eq(ws.workspaceRows({ name: 'kg', arg: null }, envOf({ state: baseState({ kg: { access: 'locked', on: false, locked: false } }) }))[0].disabled, W.kgPro, '/kg alone says why it is out of reach')
  // template: clear, stop, a saved template by name
  eq(rows('template', '').map(row => [row.label, row.disabled]), [['/template clear', W.noTemplateChosen], ['/template stop', W.reuseNotRunning], ['/template Quarterly Review', null], ['/template Sales Pitch', null], ['/template Board Update', 'Template optimizing']], '/template with no word: clear, stop and every saved template, each with its reason when it cannot run')
  eq(rows('template', 'quart').map(row => [row.label, row.run && row.run.op, row.run && row.run.pick && row.run.pick.id]), [['/template Quarterly Review', 'select', 't1']], '/template quart finds Quarterly Review (the pick is the record the picker hands over)')
  eq(rows('template', 'sales pit')[0].run, R({ name: 'template', op: 'select', pick: pickOf('t2', 'Sales Pitch') }), 'several words work')
  eq(rows('template', 'cl').map(row => row.label), ['/template clear'], 'cl is clear')
  eq(rows('template', 'st').map(row => row.label), ['/template stop'], 'st is stop')
  eq([rows('template', 'zzz')[0].hint, rows('template', 'zzz')[0].run], [W.noTemplate('zzz'), null], 'no template matches: a hint, nothing runs')
  ok(rows('template', 'sales', { state: baseState({ template: { builder: true, active: null, locked: true, running: false } }) }).every(row => row.disabled === W.templateLocked), 'a locked selection disables the saved templates with the reason')
  eq(rows('template', 'sales', { state: baseState({ template: { builder: true, active: { id: 't2', name: 'Sales Pitch' }, locked: false, running: false } }) })[0].disabled, W.templateAlready, 'the template already chosen says so')
  eq(rows('template', 'board')[0].disabled, 'Template optimizing', 'a template that is not ready: the picker\'s own short reason (it toasts instead of choosing it)')
  eq(rows('template', '', { state: baseState({ template: { builder: false, active: null, locked: false, running: false } }) }).map(row => [row.disabled, row.run]), [[W.templateOff, null]], 'templates not turned on: one disabled row with the reason')
  eq(rows('template', 'x', { templateBlocked: 'Templates open once your conversation has loaded.' }).map(row => row.disabled), ['Templates open once your conversation has loaded.'], 'the composer\'s own "conversation not loaded" reason')
  eq(rows('template', '', { templates: { status: 'loading', items: [] } }).map(row => [row.label, row.hint]), [['/template clear', null], ['/template stop', null], ['/template …', W.templatesLoading]], 'the list still loading: clear and stop are there, and a hint says it is loading')
  eq(rows('template', 'qu', { templates: { status: 'failed', items: [] } }).map(row => row.hint), [W.templatesFailed], 'the list failed: a hint, nothing runs')
  eq(rows('template', '', { templates: { status: 'ready', items: [] } }).map(row => [row.label, row.hint]), [['/template clear', null], ['/template stop', null], ['/template …', W.noTemplates]], 'no saved templates: clear and stop, and a hint')
  ok(rows('template', '', { templates: { status: 'ready', items: Array.from({ length: 20 }, (_, i) => choice(`x${i}`, `Template ${i}`)) } }).length <= 10, 'at most eight templates are listed, after clear and stop')
  // template mode, notes, pane, appearance, intro, history
  eq(rows('template-mode', '').map(row => [row.label, row.run, row.disabled]), [['/template-mode on', R({ name: 'template-mode', on: true }), W.modeNeedsTemplate], ['/template-mode off', R({ name: 'template-mode', on: false }), W.modeAlready(false)]], '/template-mode with no word: on needs a template, off says it is already off')
  eq(rows('template-mode', 'zz')[0].hint, W.onOffHint('template-mode'), '/template-mode: a hint for any other word')
  eq(rows('notes', '').map(row => [row.label, row.run, row.disabled]), [['/notes show', R({ name: 'notes', show: true }), null], ['/notes hide', R({ name: 'notes', show: false }), W.notesAlready(false)]], '/notes: show and hide')
  eq([rows('notes', 'sh')[0].label, rows('notes', 'x')[0].hint], ['/notes show', W.notesHint], '/notes: a letter filters; anything else is a hint')
  eq(rows('notes', '', { state: baseState({ notes: null }) }).map(row => row.disabled), [W.noDeck], '/notes with no panel on screen: no deck')
  eq(rows('pane', '').map(row => [row.label, row.disabled]), [['/pane chat', W.paneAlready('Chat')], ['/pane slides', null], ['/pane inspector', null]], '/pane: the three buttons, the one showing disabled')
  eq([rows('pane', 'x')[0].hint, rows('pane', 'ins')[0].label], [W.paneHint, '/pane inspector'], '/pane: a letter filters; anything else is a hint')
  eq(rows('pane', '', { state: baseState({ pane: { dual: true, overlay: false, showing: 'chat', inspector: true } }) }).map(row => row.disabled), [W.paneDual], '/pane at a wide width: one disabled row with the reason')
  eq(rows('dark', null).map(row => [row.run, row.disabled]), [[R({ name: 'dark' }), null]], '/dark runs')
  eq(rows('light', null, { state: baseState({ theme: { choice: 'light' } }) })[0].disabled, W.themeAlready('Light'), '/light while light: says so')
  eq(rows('intro', null).map(row => row.disabled), [null], '/intro: runs when the page says the introduction could start')
  eq(rows('intro', null, { draft: true })[0].disabled, W.introDraft, '/intro: a typed draft in the message box stays, so the introduction would not start over it')
  eq(rows('intro', null, { state: baseState({ introReady: false }) })[0].disabled, W.introBusy, '/intro: not eligible')
  eq(rows('history', null, { state: baseState({ history: { enabled: false, available: false } }) })[0].disabled, W.historyOff, '/history: the flag')
  // a command that takes nothing, given something; a typed word never confirms
  eq([rows('dark', 'now')[0].hint, rows('dark', 'now')[0].run, rows('history', '  ')[0].run], ['Nothing goes after /dark.', null, R({ name: 'history' })], 'a word after a command that takes none: a hint, not a run; trailing spaces are nothing')
  eq([rows('template', 'clear yes').map(row => row.run), rows('kg', 'on please')[0].run, rows('yes', null), rows('confirm', null), rows('notes', 'hide yes')[0].run], [[null], null, [], [], null], 'a typed "yes" is not a command and gives nothing a run')
  ok(!ws.WORKSPACE_COMMANDS.some(def => /yes|confirm|really|sure|restore/i.test(def.name + def.blurb)), 'no command or description names a confirmation or a restore (restoring a version stays a click in the History panel, with its own confirm)')
  // the words
  ok(Object.values(W).every(value => typeof value === 'function' || (typeof value === 'string' && value.length <= 60)), 'every fixed word is short')
  ok(![...Object.values(W).filter(value => typeof value === 'string'), ...all.map(row => row.blurb)].some(text => /\b(handler|iframe|postMessage|undefined|null|error code|API|bridge)\b/i.test(text)), 'plain words: no jargon')
  eq(Object.keys(ws.WORKSPACE_HANDLERS).sort(), ['history', 'intro', 'kg', 'notes', 'pane', 'template-mode', 'template:clear', 'template:select', 'template:stop', 'theme'], 'every command names the handler it calls')
  eq([ws.isWorkspaceRun(R({ name: 'kg', on: true })), ws.isWorkspaceRun({ name: 'goto', slide: 2 }), ws.isWorkspaceRun(null), ws.isWorkspaceRun('kg')], [true, false, false, false], 'a workspace run is told from the viewer half\'s by its marker')
  return ws
}

/** The saved templates, read the way the toolbar's picker reads them. */
async function templatesSuite(ws = loadWs()) {
  const rules = { composerLibrary: false, ready: template => template.blueprint_enrichment_status === 'complete', why: () => 'Template optimizing' }
  const listed = [{ id: 'a', name: 'Alpha', blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean', extra: 'x' }, { id: 'b', name: 'Beta', blueprint_enrichment_status: 'running' }, { id: 'c', name: 'Gamma', stage_template_summary: {} }]
  let state = await ws.loadWorkspaceTemplates(async () => ({ templates: listed }), rules)
  eq([state.status, state.items.map(item => [item.id, item.name, item.ready, item.why])], ['ready', [['a', 'Alpha', true, null], ['b', 'Beta', false, 'Template optimizing'], ['c', 'Gamma', false, 'Template optimizing']]], 'the saved templates, each with its readiness and the reason it is not')
  eq(Object.keys(state.items[0].pick).sort(), ['blueprint_enrichment_error', 'blueprint_enrichment_status', 'blueprint_generation_method', 'id', 'name', 'template_purity_error', 'template_purity_status'], 'the pick has the fields the picker hands over, and no others (extra is dropped)')
  eq(state.items[0].pick, { id: 'a', name: 'Alpha', blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' }, 'the pick carries the template\'s own values')
  state = await ws.loadWorkspaceTemplates(async () => ({ templates: listed }), { ...rules, composerLibrary: true })
  eq(state.items.map(item => item.id), ['a', 'b'], 'with the composer library on, its own templates (stage_template_summary) are not saved ones: the toolbar leaves them out')
  eq((await ws.loadWorkspaceTemplates(async () => null, rules)).status, 'failed', 'no answer: failed')
  eq((await ws.loadWorkspaceTemplates(async () => { throw new Error('boom') }, rules)).status, 'failed', 'a throwing list call: failed, never thrown')
  eq((await ws.loadWorkspaceTemplates(async () => ({ templates: [{ id: 1, name: 'x' }, { id: 'ok', name: 'Fine' }] }), rules)).items.map(item => item.id), ['ok'], 'a record with no usable id or name is dropped')
}

// ============================================================================================================================================
// B. The bus on fake parts
// ============================================================================================================================================
async function busSuite(text = read(LIB)) {
  const fresh = () => loadWs(text)
  const W = fresh().WORKSPACE_WORDS
  // kg
  { const ws = fresh(), app = fakeApp(ws); const a = await emit(ws, R({ name: 'kg', on: true })); eq([app.calls, a, app.s.kg.on], [[['setKg', true]], { ok: true, note: 'Knowledge graph on' }, true], '/kg on calls setKnowledgeGraphEnabled(true) and says so after it SAW the switch on'); const b = await emit(ws, R({ name: 'kg', on: false })); eq([app.calls[1], b.note], [['setKg', false], 'Knowledge graph off'], '/kg off calls it with false'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { kg: { access: 'ready', on: false, locked: true } }); const r = await emit(ws, R({ name: 'kg', on: true })); eq([app.calls, r], [[], { ok: false, note: W.kgLocked }], 'locked once research ran: nothing is called, the reason is the note'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { kg: { access: 'setup', on: false, locked: false } }); const r = await emit(ws, R({ name: 'kg', on: true })); eq([app.calls, r.note], [[], W.kgSetup], 'no access yet: subscribing is an account change and stays a click; nothing is called'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, {}, { setKg: 'noop' }); const r = await emit(ws, R({ name: 'kg', on: true })); eq([r.ok, /^Knowledge graph on/.test(r.note)], [false, false], 'a switch that did not move is not reported as moved'); app.off() }
  // template
  { const ws = fresh(), app = fakeApp(ws); const pick = pickOf('t2', 'Sales Pitch'); const r = await emit(ws, R({ name: 'template', op: 'select', pick })); eq([app.calls, r], [[['selectTemplate', pick]], { ok: true, note: 'Template set to Sales Pitch' }], '/template Sales Pitch calls handleSelectTemplate with the record the picker hands over'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { template: { builder: true, active: null, locked: true, running: false } }); const r = await emit(ws, R({ name: 'template', op: 'select', pick: pickOf('t2', 'Sales Pitch') })); eq([app.calls, r.note], [[], W.templateLocked], 'a locked selection: nothing is called (the handler would only toast)'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, {}, { selectTemplate: 'noop' }); const r = await emit(ws, R({ name: 'template', op: 'select', pick: pickOf('t2', 'Sales Pitch') })); eq([r.ok, /^Template set/.test(r.note)], [false, false], 'a template that was not chosen is not reported as chosen'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { template: { builder: true, active: { id: 't1', name: 'Quarterly Review' }, locked: false, running: false } }, { selectTemplate: 'noop' }); const r = await emit(ws, R({ name: 'template', op: 'select', pick: pickOf('t2', 'Sales Pitch') })); eq([r.ok, /^Template set/.test(r.note)], [false, false], 'another template still chosen after the call is not reported as the one asked for'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { template: { builder: true, active: { id: 't1', name: 'Quarterly Review' }, locked: false, running: false } }); const r = await emit(ws, R({ name: 'template', op: 'clear' })); eq([app.calls, r, app.s.template.active], [[['clearTemplate']], { ok: true, note: 'Template cleared' }, null], '/template clear calls handleClearTemplate and says cleared after it saw the chip go'); app.off() }
  { const ws = fresh(), app = fakeApp(ws); const r = await emit(ws, R({ name: 'template', op: 'clear' })); eq([app.calls, r.note], [[], W.noTemplateChosen], 'nothing chosen: nothing is called'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { template: { builder: true, active: { id: 't1', name: 'Quarterly Review' }, locked: true, running: true } }); const r = await emit(ws, R({ name: 'template', op: 'stop' })); eq([app.calls, r], [[['stopTemplateReuse']], { ok: true, note: 'Asked Director to stop the template reuse' }], '/template stop calls handleCancelTemplateReuse (the Stop button\'s own click: it has no confirm, so none is added) and says it ASKED'); app.off() }
  { const ws = fresh(), app = fakeApp(ws); const r = await emit(ws, R({ name: 'template', op: 'stop' })); eq([app.calls, r.note], [[], W.reuseNotRunning], 'no reuse running: nothing is called'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { template: { builder: true, active: { id: 't1', name: 'Quarterly Review' }, locked: true, running: true } }, { stopTemplateReuse: 'noop' }); const r = await emit(ws, R({ name: 'template', op: 'stop' })); eq(r.ok, false, 'a reuse still running is not reported as stopped'); app.off() }
  // template mode
  { const ws = fresh(), app = fakeApp(ws, { mode: { builder: true, on: false, available: true, blocked: null } }); const a = await emit(ws, R({ name: 'template-mode', on: true })); const b = await emit(ws, R({ name: 'template-mode', on: false })); eq([app.calls, a.note, b.note], [[['setTemplateMode', true], ['setTemplateMode', false]], 'Template Mode on', 'Template Mode off'], '/template-mode on / off pass the mode wanted, never a blind toggle'); app.off() }
  { const ws = fresh(), app = fakeApp(ws); const r = await emit(ws, R({ name: 'template-mode', on: true })); eq([app.calls, r.note], [[], W.modeNeedsTemplate], 'no template chosen: nothing is called'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { mode: { builder: true, on: false, available: true, blocked: 'This tab is paused' } }); const r = await emit(ws, R({ name: 'template-mode', on: true })); eq([app.calls, r.note], [[], 'This tab is paused'], 'a paused tab: the Template button\'s own reason'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { mode: { builder: true, on: false, available: true, blocked: null } }, { setTemplateMode: 'noop' }); const r = await emit(ws, R({ name: 'template-mode', on: true })); eq([r.ok, /^Template Mode on/.test(r.note)], [false, false], 'a mode that did not change is not reported'); app.off() }
  // notes
  { const ws = fresh(), app = fakeApp(ws); const a = await emit(ws, R({ name: 'notes', show: true })); const b = await emit(ws, R({ name: 'notes', show: false })); const c = await emit(ws, R({ name: 'notes', show: false })); eq([app.calls, a.note, b.note, c.note], [[['toggleNotes'], ['toggleNotes']], 'Notes shown', 'Notes hidden', W.notesAlready(false)], '/notes show and hide call the bar\'s own toggle ONLY when the bar is not already as asked'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, {}, { toggleNotes: 'noop' }); const r = await emit(ws, R({ name: 'notes', show: true })); eq(r.ok, false, 'a bar that did not open is not reported as open'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, {}, {}, ['notes']); const r = await emit(ws, R({ name: 'notes', show: true })); eq([app.calls, r.note], [[], W.noDeck], 'no panel on screen: nothing is called'); app.off() }
  // appearance
  { const ws = fresh(), app = fakeApp(ws); const a = await emit(ws, R({ name: 'dark' })); const b = await emit(ws, R({ name: 'system' })); const c = await emit(ws, R({ name: 'light' })); eq([app.calls, a.note, b.note, c.note, app.s.theme.choice], [[['setTheme', 'dark'], ['setTheme', 'system'], ['setTheme', 'light']], 'Dark appearance on', 'Following your device appearance', 'Light appearance on', 'light'], '/dark, /system, /light call setTheme with the choice and say what they saw'); app.off() }
  { const ws = fresh(), app = fakeApp(ws); const r = await emit(ws, R({ name: 'light' })); eq([app.calls, r.ok], [[], false], 'already light: nothing is called'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, {}, { setTheme: 'noop' }); const r = await emit(ws, R({ name: 'dark' })); eq([r.ok, /^Dark/.test(r.note)], [false, false], 'an appearance that did not change is not reported'); app.off() }
  // intro: the typed command leaves the message box first; says it only when the owner reports it playing
  { const ws = fresh(), app = fakeApp(ws); const r = await emit(ws, R({ name: 'intro' })); eq([app.calls, r], [[['replayIntro']], { ok: true, note: 'Replaying the introduction' }], '/intro calls the Replay intro button\'s requestReplay and says so when the owner reports it playing'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, {}, { replayIntro: 'noop' }); const r = await emit(ws, R({ name: 'intro' })); eq([r.ok, /^Replaying/.test(r.note)], [false, false], 'a request the introduction dropped (its own eligibility) is not reported as playing'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { introReady: false }); const r = await emit(ws, R({ name: 'intro' })); eq([app.calls, r.note], [[], W.introBusy], 'not eligible: nothing is called'); app.off() }
  { const ws = fresh(), app = fakeApp(ws); const before = Date.now(); const wait = emit(ws, R({ name: 'intro' })); eq(app.calls, [], '/intro waits for the typed command to leave the message box before it asks'); await wait; ok(app.calls.length === 1 && Date.now() >= before, '...then asks once'); app.off() }
  // pane
  { const ws = fresh(), app = fakeApp(ws); const a = await emit(ws, R({ name: 'pane', pane: 'slides' })); const b = await emit(ws, R({ name: 'pane', pane: 'inspector' })); const c = await emit(ws, R({ name: 'pane', pane: 'chat' })); eq([app.calls, a.note, b.note, c.note], [[['selectPane', 'slides'], ['selectPane', 'inspector'], ['selectPane', 'chat']], 'Showing Slides', 'Showing Inspector', 'Showing Chat'], '/pane calls the switcher\'s handler with the pane and says what it saw'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { pane: { dual: true, overlay: false, showing: 'chat', inspector: true } }); const r = await emit(ws, R({ name: 'pane', pane: 'inspector' })); eq([app.calls, r.note], [[], W.paneDual], 'at a wide width there is no switcher: nothing is called'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, {}, { selectPane: 'noop' }); const r = await emit(ws, R({ name: 'pane', pane: 'slides' })); eq(r.ok, false, 'a pane that did not change is not reported'); app.off() }
  // history: opens the panel; restoring stays a click in it
  { const ws = fresh(), app = fakeApp(ws); const r = await emit(ws, R({ name: 'history' })); eq([app.calls, r], [[['openHistory']], { ok: true, note: 'Opened the version history. Pick a version in History to restore it.' }], '/history opens the panel through the bridge and says restoring is a click in it'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, {}, { historyOpens: false }); const r = await emit(ws, R({ name: 'history' })); eq([r.ok, /^Opened/.test(r.note)], [false, false], 'a panel that did not open (the bridge said false) is not reported as open'); app.off() }
  { const ws = fresh(), app = fakeApp(ws, { history: { enabled: true, available: false } }); const r = await emit(ws, R({ name: 'history' })); eq([app.calls, r.note], [[], W.noDeck], 'no deck on screen: nothing is called'); app.off() }
  // no part, a throwing part, a part that goes away
  { const ws = fresh(); for (const what of [R({ name: 'kg', on: true }), R({ name: 'notes', show: true }), R({ name: 'history' }), R({ name: 'intro' }), R({ name: 'pane', pane: 'slides' }), R({ name: 'dark' }), R({ name: 'template', op: 'clear' }), R({ name: 'template-mode', on: true })]) { const r = await emit(ws, what); if (r.ok || !r.note) throw new Error(`no part: ${what.name} said ${JSON.stringify(r)}`) } checks++ }
  { const ws = fresh(), app = fakeApp(ws, {}, { setKg: 'throw' }); const r = await emit(ws, R({ name: 'kg', on: true })); eq([r.ok, /^Knowledge graph on/.test(r.note)], [false, false], 'a handler that throws: said, not claimed, nothing thrown'); app.off() }
  { const ws = fresh(), app = fakeApp(ws); app.off(); const r = await emit(ws, R({ name: 'kg', on: true })); eq(r.ok, false, 'parts that unregistered: nothing to run'); }
  // the bus: a part that throws says nothing; the state is merged by key; published only when it changed; unregister only if still current
  { const ws = fresh(); const off = ws.registerWorkspacePart('page', () => { throw new Error('x') }); eq(ws.workspaceHandle().state, ws.EMPTY_WORKSPACE_STATE, 'a part that throws says nothing'); off() }
  { const ws = fresh(); const a = ws.registerWorkspacePart('a', () => ({ state: { notes: { shown: true } }, actions: {} })); const b = ws.registerWorkspacePart('b', () => ({ state: { kg: { access: 'ready', on: true, locked: false }, notes: undefined } })); const merged = ws.workspaceHandle().state; eq([merged.notes, merged.kg.on, merged.template], [{ shown: true }, true, null], 'parts are merged by key; a key a part leaves undefined keeps the other part\'s'); a(); b() }
  { const ws = fresh(); let heard = 0; const stop = ws.subscribeWorkspaceState(() => { heard++ }); const app = fakeApp(ws); ok(heard >= 1, 'registering publishes'); const seen = heard; ws.publishWorkspaceState(); ws.publishWorkspaceState(); eq(heard, seen, 'the same state again is not announced'); app.s.notes = { shown: true }; ws.publishWorkspaceState(); eq([heard, ws.workspaceStateSnapshot().notes], [seen + 1, { shown: true }], 'a changed state is announced once'); stop(); app.off() }
  { const ws = fresh(); const mine = () => ({ state: { notes: { shown: true } } }); const first = ws.registerWorkspacePart('notes', mine); const second = ws.registerWorkspacePart('notes', () => ({ state: { notes: { shown: false } } })); first(); eq(ws.workspaceHandle().state.notes, { shown: false }, 'an old registration does not unregister the newer one'); second(); eq(ws.workspaceHandle().state.notes, null, '...and the newer one does') }
  // the viewer half's runParity hands a workspace run on, and refuses one nobody owns
  { const viewer = loadViewerLib(), ws = loadWs(text, viewer); const app = fakeApp(ws); const deps = { building: false, choosePreset: () => {}, showCanvas: null, scale: SCALE }
    const none = await viewer.runParity(R({ name: 'kg', on: true }), deps); eq([none.ok, app.calls], [false, []], 'no runner registered: a workspace run says it is not available and calls nothing')
    const off = viewer.registerParityRunner(ws.runWorkspace); const r = await viewer.runParity(R({ name: 'kg', on: true }), deps); eq([r, app.calls], [{ ok: true, note: 'Knowledge graph on' }, [['setKg', true]]], 'runParity hands a workspace run to the registered runner')
    eq(ws.runWorkspace({ name: 'canvas' }, deps), null, 'the runner answers only its own runs (the viewer half\'s canvas run is not its)')
    eq([viewer.runBlocked(R({ name: 'kg', on: true }), { viewer: null, building: false, themeBlocked: null, presets: [], canvasClosed: true }), viewer.runBlocked({ name: 'next' }, { viewer: null, building: false, themeBlocked: null, presets: [], canvasClosed: true })], [null, viewer.PARITY_WORDS.noDeck], 'the viewer half\'s runBlocked leaves a workspace run to its own reason, and still blocks its own')
    off(); const again = await viewer.runParity(R({ name: 'kg', on: false }), deps); eq(again.ok, false, 'a runner that unregistered answers no more'); app.off() }
}

// ============================================================================================================================================
// C. The sources
// ============================================================================================================================================
const MARK = strip.CHAT_PARITY_WORKSPACE_MARKER_RE
const VIEWER_MARK = viewerStrip.CHAT_PARITY_VIEWER_MARKER_RE
const importLines = text => text.split('\n').filter(line => /^import\s/.test(line))
const markedOf = text => text.split('\n').filter(line => MARK.test(line)).join('\n')
const norm = value => value.replace(/\s+/g, ' ').trim()
const diffLines = (rel, sign) => git('diff', '--no-color', '-U0', baseCommitOf(rel), '--', rel).split('\n').filter(line => (sign === '+' ? /^\+(?!\+\+)/ : /^-(?!--)/).test(line)).map(line => line.slice(1))

/** The Builder page's part: the gate, the handlers, the effects (a pure function of the page's text: the mutants run it). */
function pageChecks(text, label = 'page') {
  const block = markedOf(text)
  ok(/chatParityWorkspaceLive\.current = !chatCommandsOn \? null : \{/.test(block), `${label}: flag off (chatCommandsOn is the commands flag with chat clean and the shell), the live part is null`)
  ok(/if \(chatCommandsPage\?\.parity\) \{ const thread = chatCommandsPage\.parity\.addNote; chatCommandsPage\.parity = \{ addNote: text => \{ if \(chatParityThreadOn\.current\) thread\?\.\(text\); else toast\(\{ title: text \}\) \} \} \}/.test(block) && /const chatParityThreadOn = useRef\(false\)/.test(block) && /chatParityThreadOn\.current = chatCleanOn/.test(block) && /const chatCleanOn = chatCleanShell && effectiveBuildNarrationEnabled/.test(text) && /effectiveBuildNarrationEnabled = effectiveNarrationEnabled\(\s*features\.buildNarrationEnabled,\s*Boolean\(activeTemplate\),/.test(text), `${label}: with the thread's notes off (a chosen template turns the build narration off) a note is not dropped: it goes to a toast, decided when the note is made`)
  ok(/useEffect\(\(\) => \{ if \(!chatCommandsOn\) return; let off/.test(block), `${label}: the registering effect returns first with the flag off`)
  ok(/useEffect\(\(\) => \{ if \(chatCommandsOn\) chatParityWorkspaceMod\.current\?\.publishWorkspaceState\(\) \}\)/.test(block), `${label}: the publishing effect does nothing with the flag off`)
  ok(/import\('@\/lib\/studio-chat-parity-workspace'\)\.then/.test(block) && /registerWorkspacePart\('page', \(\) => chatParityWorkspaceLive\.current\)/.test(block), `${label}: the bus module is loaded dynamically, in the gated effect only, and registers the page's part`)
  eq(importLines(text).filter(line => /studio-chat-parity-workspace/.test(line)), [], `${label}: no static import of the bus (the page's proofs see no new import of it)`)
  ok(/const chatCommandsOn = STUDIO_CHAT_COMMANDS_ENABLED && chatCleanShell/.test(text), `${label}: chatCommandsOn is the base's own gate (commands flag with chat clean and the shell)`)
  for (const [action, handler] of Object.entries({ setKg: 'setKnowledgeGraphEnabled', selectTemplate: 'handleSelectTemplate', clearTemplate: 'handleClearTemplate', stopTemplateReuse: 'handleCancelTemplateReuse' })) ok(new RegExp(`(?:\\{ |, )${action}: ${handler}[,\\s]`).test(block), `${label}: ${action} is ${handler}`)
  // each handler is the one the button gets (a base prop of the composer)
  ok(/onKnowledgeGraphEnabledChange=\{setKnowledgeGraphEnabled\}/.test(text) && /onSelectTemplate=\{handleSelectTemplate\}/.test(text) && /onClearTemplate=\{handleClearTemplate\}/.test(text) && /onCancelTemplateReuse=\{handleCancelTemplateReuse\}/.test(text), `${label}: those four are the very handlers the composer's switch, picker, chip and Stop button get`)
  ok(/const \[knowledgeGraphEnabled, setKnowledgeGraphEnabled\] = useState/.test(text) && /const handleSelectTemplate = useCallback/.test(text) && /const handleClearTemplate = useCallback/.test(text) && /const handleCancelTemplateReuse = useCallback/.test(text) && /const selectWorkspacePane = useCallback/.test(text), `${label}: every handler named is a real one`)
  // the state the buttons read
  ok(/kg: \{ access: knowledgeGraphAccess, on: knowledgeGraphEnabled, locked: researchSettingsLocked \}/.test(block), `${label}: kg is the switch's access, value and the research lock`)
  ok(/isTemplateReuseRunning=\{Boolean\(activeTemplate && isGeneratingFinal\)\}/.test(text) && /running: Boolean\(activeTemplate && isGeneratingFinal\)/.test(block), `${label}: a template reuse running is the Stop button's own rule`)
  ok(/const templateSelectionLocked = generationSelectionsLocked/.test(text) && /locked: templateSelectionLocked/.test(block) && /builder: templateBuilderEnabled/.test(block), `${label}: the template lock is the selection lock; the templates feature is templateBuilderEnabled`)
  ok(/active: activeTemplate \? \{ id: activeTemplate\.id, name: activeTemplate\.name \} : null/.test(block), `${label}: the chosen template`)
  // the switcher: the three onClicks, and its pressed rules
  ok(/selectPane: \(pane: 'chat' \| 'slides' \| 'inspector'\) => \{ if \(pane === 'slides'\) \{ retireStudioVoiceOwner\(\); setStudioStageSelected\(true\) \} else if \(pane === 'chat'\) \{ selectWorkspacePane\('chat'\); if \(!showChat\) setShowChat\(true\) \} else selectWorkspacePane\('inspector'\) \}/.test(block), `${label}: /pane is the switcher's three onClicks`)
  ok(text.includes("onSlides={() => { retireStudioVoiceOwner(); setStudioStageSelected(true) }}") && text.includes("onDirector={() => { selectWorkspacePane('chat'); if (!showChat) setShowChat(true) }}") && text.includes("onEdit={() => selectWorkspacePane('inspector')}"), `${label}: ...which are the switcher's own (base lines)`)
  ok(/showing: studioOverlayWorkspace && \(studioStageSelected \|\| \(!workspaceLayout\.chatVisible && !workspaceLayout\.inspectorVisible\)\) \? 'slides' : \(studioOverlayWorkspace \? workspaceLayout\.inspectorVisible : workspaceLayout\.presentedPane === 'inspector'\) \? 'inspector' : 'chat'/.test(block), `${label}: the pane showing follows the switcher's pressed rules`)
  ok(text.includes('slidesPressed={studioStageSelected || (!workspaceLayout.chatVisible && !workspaceLayout.inspectorVisible)}') && text.includes("editPressed={studioOverlayWorkspace ? workspaceLayout.inspectorVisible : workspaceLayout.presentedPane === 'inspector'}") && text.includes('showSlides={studioOverlayWorkspace}') && text.includes('showEdit={Boolean(activeInspector)}'), `${label}: ...which are the switcher's own pressed rules (base lines)`)
  ok(/dual: workspaceLayout\.dualPane, overlay: studioOverlayWorkspace, inspector: Boolean\(activeInspector\)/.test(block) && text.includes('{studioPopupsV2 && !workspaceLayout.dualPane && ('), `${label}: the switcher is drawn only when chat and the stage do not both fit`)
  // the Replay intro rule with the typed command left out: the base's own draft terms, minus the composer text
  const baseDirty = /dirtyDraft: !!inputMessage\.trim\(\) \|\| ([\s\S]*?),\n\s+workInFlight:/.exec(text)
  const mineDirty = /dirtyDraft: ([^}]*?) \}\)\.manual/.exec(block)
  ok(baseDirty && mineDirty && norm(baseDirty[1]) === norm(mineDirty[1]), `${label}: /intro reads the page's own draft rule with its first term (the composer's text) taken out`)
  ok(/introReady: studioShell && studioIntroEligibility\(\{ \.\.\.studioIntroInputs, dirtyDraft:/.test(block) && importLines(text).some(line => /import \{ studioIntroEligibility \} from '@\/lib\/studio-intro-eligibility'/.test(line)), `${label}: ...through the replay's own eligibility function`)
}

function viewerChecks(text, label = 'viewer') {
  const block = markedOf(text)
  ok(/chatParityWorkspaceLive\.current = !chatParityViewerOn \? null : \{/.test(block), `${label}: flag off, the live part is null (the viewer half's own gate)`)
  ok(/useEffect\(\(\) => \{ if \(!chatParityViewerOn\) return; let off/.test(block) && /useEffect\(\(\) => \{ if \(chatParityViewerOn\) chatParityWorkspaceMod\.current\?\.publishWorkspaceState\(\) \}\)/.test(block), `${label}: both effects do nothing with the flag off`)
  ok(/import\('@\/lib\/studio-chat-parity-workspace'\)\.then/.test(block) && /registerWorkspacePart\('viewer', \(\) => chatParityWorkspaceLive\.current\)/.test(block), `${label}: the bus module is loaded dynamically, in the gated effect only`)
  eq(importLines(text).filter(line => /studio-chat-parity-workspace/.test(line)), [], `${label}: no new import line`)
  ok(/mode: \{ builder: Boolean\(templateBuilderEnabled\), on: templateModeOn, available: templateModeAvailable, blocked: studioToolbarDisabledReason\('template', \{ tabPausedHint: studioTabPausedHint, viewerIsReady, templateModeOn, slideMutationPending: isSlideMutationPending \}\) \}/.test(block), `${label}: the Template menu's Template Mode item: drawn with the templates feature, a template chosen, and the Template button's own reason`)
  ok(/setTemplateMode: \(on: boolean\) => \{ if \(studioShell\) viewerInteractionIntentRef\.current \+= 1; onTemplateModeChange\?\.\(on\) \}/.test(block), `${label}: /template-mode is the item's own click (the intent bump, then the page callback) with the mode wanted`)
  ok(text.includes('viewerInteractionIntentRef.current += 1;') && /onTemplateModeChange\?\.\(!templateModeOn\)/.test(text) && text.includes('disabled={!viewerIsReady || tabPaused}') && text.includes('disabled={!templateModeAvailable && !templateModeOn}'), `${label}: ...which is what the toolbar does (base lines): the same bump, the same callback, the same two disabled rules`)
  ok(/templateModeAvailable = false/.test(text) && /templateModeOn/.test(text), `${label}: the props it reads are the toolbar's`)
}

function notesChecks(text, label = 'notes panel') {
  const block = markedOf(text)
  ok(/const chatParityWorkspaceOn = studioShell && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_COMMANDS === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true'/.test(block), `${label}: the gate reads the flags inline, with the shell`)
  ok(/chatParityWorkspaceLive\.current = !chatParityWorkspaceOn \? null : \{ state: \{ notes: \{ shown: expanded \} \}, actions: \{ toggleNotes: handleToggleExpanded \} \}/.test(block), `${label}: flag off null; else the bar's open state and the bar's own handler`)
  ok(/useEffect\(\(\) => \{ if \(!chatParityWorkspaceOn\) return; let off/.test(block) && /useEffect\(\(\) => \{ if \(chatParityWorkspaceOn\) chatParityWorkspaceMod\.current\?\.publishWorkspaceState\(\) \}\)/.test(block), `${label}: both effects do nothing with the flag off`)
  ok(/import\('@\/lib\/studio-chat-parity-workspace'\)\.then/.test(block) && /registerWorkspacePart\('notes', /.test(block), `${label}: dynamic import in the gated effect, registers the notes part`)
  eq(importLines(text).filter(line => /studio-chat-parity-workspace/.test(line)), [], `${label}: no new import line`)
  ok(/onClick=\{handleToggleExpanded\}/.test(text) && /aria-expanded=\{expanded\}/.test(text) && /const handleToggleExpanded = useCallback/.test(text), `${label}: handleToggleExpanded is the Notes bar's own onClick (base lines)`)
}

function introChecks(text, label = 'introduction') {
  const block = markedOf(text)
  ok(/const chatParityWorkspaceOn = enabled && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_COMMANDS === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true'/.test(block), `${label}: the gate reads the flags inline, with the owner's own enabled (the Studio shell)`)
  ok(/chatParityWorkspaceLive\.current = !chatParityWorkspaceOn \? null : \{ state: \{ intro: \{ active \} \}, actions: \{ replayIntro: requestReplay \} \}/.test(block), `${label}: flag off null; else whether it is playing and the button's own requestReplay`)
  ok(/useEffect\(\(\) => \{ if \(!chatParityWorkspaceOn\) return; let off/.test(block) && /useEffect\(\(\) => \{ if \(chatParityWorkspaceOn\) chatParityWorkspaceMod\.current\?\.publishWorkspaceState\(\) \}\)/.test(block), `${label}: both effects do nothing with the flag off`)
  ok(/registerWorkspacePart\('intro', /.test(block) && /import\('@\/lib\/studio-chat-parity-workspace'\)\.then/.test(block), `${label}: dynamic import in the gated effect, registers the intro part`)
  eq(importLines(text).filter(line => /studio-chat-parity-workspace/.test(line)), [], `${label}: no new import line`)
  ok(/onClick=\{intro\.requestReplay\}/.test(text) && /const requestReplay = useCallback/.test(text) && /const \[active, setActive\] = useState\(false\)/.test(text), `${label}: requestReplay is the Replay intro button's own onClick, active is the owner's own state (base lines)`)
  ok(read(PAGE).includes('studioIntroReplay={studioShell ? <StudioIntroductionButton className="studio-canvas-intro-replay" /> : undefined}') && read(PAGE).includes('<StudioIntroductionProvider enabled={studioShell}'), `${label}: this owner (not components/studio-intro-replay.tsx, the library pages' copy) is the Builder's replay control`)
}

/** The composer's glue and its call line. */
function glueChecks(glue, commandsUi, label = 'composer') {
  const hook = markedOf(commandsUi)
  ok(/const workspaceRows = useChatParityWorkspace\(\{ enabled, trigger: trigger\?\.kind === 'command' \? trigger : null, text: input\.text, template: input\.template, listTemplates, menuOpen: dismissed !== key \}\)/.test(hook), `${label}: the hook gets the composer's own enabled (the flag, the page's props, not disabled), only a command trigger, the template gate and the template popup's own list call`)
  ok(/parity\.push\(\.\.\.workspaceRows\)/.test(hook) && hook.indexOf('useChatParityWorkspace({') < hook.indexOf('parity.push('), `${label}: its rows go after the viewer half's, so Workspace is the last group`)
  ok(/const \{ listTemplates \} = useTemplates\(\)/.test(commandsUi) && /const dismissed|const \[dismissed, setDismissed\]/.test(commandsUi), `${label}: listTemplates is the template popup's own call (base line)`)
  const code = glue.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  ok(/^registerParityRunner\(runWorkspace\)/m.test(code), `${label}: the workspace runner is registered on the viewer half's bus, once, when the glue loads`)
  ok(/useEffect\(\(\) => \{\s*if \(!input\.enabled\) return\s*const off = registerWorkspacePart\('composer'/.test(code), `${label}: the composer's part is registered only with the commands on`)
  ok(/useEffect\(\(\) => \{ if \(input\.enabled\) publishWorkspaceState\(\) \}\)/.test(code), `${label}: publishing does nothing with the commands off`)
  ok(/const trigger = input\.enabled \? input\.trigger : null/.test(code) && /if \(!trigger\) return \[\]/.test(code), `${label}: with the flag off (enabled false) there are no rows`)
  ok(/setTheme: \(choice: ThemeChoice\) => live\.current\.setTheme\(choice\), openHistory: \(\) => versionHistoryBridge\.open\(\)/.test(code), `${label}: /dark /light /system are next-themes' setTheme and /history is the bridge's open`)
  ok(/history: \{ enabled: STUDIO_VERSION_HISTORY_V2_ENABLED, available: versionHistoryBridge\.isAvailable\(\) \}/.test(code) && /versionHistoryBridge\.subscribe\(\(\) => publishWorkspaceState\(\)\)/.test(code), `${label}: the Version history row's own flag and availability, and it follows the bridge`)
  ok(/value === 'light' \|\| value === 'dark' \|\| value === 'system'/.test(code), `${label}: only the three Appearance choices are read`)
  ok(/trigger\.name\.toLowerCase\(\) === 'template' && trigger\.arg !== null/.test(code) && /setState\(current => \(\{ \.\.\.current, status: 'loading' \}\)\)/.test(code), `${label}: the saved templates are read only while "/template " is on screen`)
  ok(!/\bconfirm\s*\(|window\.|document\.|localStorage|fetch\s*\(|XMLHttpRequest|WebSocket/.test(code), `${label}: the glue has no confirm box, no browser global, no network`)
  // the picker's own rules
  const picker = read(PICKER)
  const toSelection = /const toSelection = \(template: SavedTemplate\): TemplateSelection => \(\{([\s\S]*?)\}\)/.exec(picker)
  eq([...(toSelection?.[1] ?? '').matchAll(/(\w+): template\.\1/g)].map(match => match[1]), ['id', 'name', 'blueprint_generation_method', 'blueprint_enrichment_status', 'blueprint_enrichment_error', 'template_purity_status', 'template_purity_error'], `${label}: the picker's own toSelection fields (the list the lib hands handleSelectTemplate)`)
  ok(picker.includes("filter((template) => !('stage_template_summary' in template))") && picker.includes("process.env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED === 'true'") && /composerLibrary: process\.env\.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED === 'true'/.test(code), `${label}: the composer library's own templates are left out exactly as the picker leaves them out`)
  for (const [status, title] of [['failed', 'Template not ready'], ['optimizing', 'Template optimizing'], ['needs_cleanup', 'Template needs cleanup'], ['needs_optimization', 'Template needs optimization']]) ok(code.includes(`${status}: '${title}'`) && picker.includes(`'${title}'`), `${label}: "${title}" is the picker's own toast title for ${status}`)
  ok(/ready: template => isTemplateGenerationReady\(template\)/.test(code) && /why: template => NOT_READY_WHY\[templateGenerationStatus\(template\)\]/.test(code), `${label}: a template is ready by the picker's own rule`)
}

function sourceChecks() {
  // the strip: each file back to the viewer half's head, byte for byte
  if (hasBase) {
    const touchedByViewer = git('diff', '--name-only', strip.BASE_UNDER_COMMIT, strip.BASE_COMMIT).split('\n').filter(Boolean)
    eq(strip.CHAT_PARITY_WORKSPACE_FILES.filter(rel => touchedByViewer.includes(rel)).sort(), strip.BASE_TOUCHED.slice().sort(), 'BASE_TOUCHED is exactly the files of this change the viewer half touched (git says so)')
    for (const rel of strip.CHAT_PARITY_WORKSPACE_FILES) {
      const now = read(rel), base = baseOf(rel)
      ok(now !== base, `${rel}: it is changed`)
      ok(strip.stripChatParityWorkspace(rel, now) === base, `${rel}: the strip puts it back to the viewer half's head, byte for byte`)
      ok(registry.stripLaterChanges(rel, now) === registry.stripLaterChanges(rel, base), `${rel}: ...and through the registry (both sides: every registered change strips its own lines)`)
      const added = diffLines(rel, '+'), removed = diffLines(rel, '-')
      eq(added.filter(line => !MARK.test(line)), [], `${rel}: every line added to it carries the marker`)
      eq(removed.slice().sort(), (strip.CHAT_PARITY_WORKSPACE_EDITS[rel] || []).map(([, before]) => before).sort(), `${rel}: no line of the viewer half's file is changed or gone (every line this change adds is a pure insertion)`)
      eq(Object.keys(strip.CHAT_PARITY_WORKSPACE_EDITS), [], `${rel}: ...so there are no recorded changed lines`)
      for (const [has, before] of strip.CHAT_PARITY_WORKSPACE_EDITS[rel] || []) { ok(MARK.test(has) && now.split('\n').filter(line => line === has).length === 1, `${rel}: a changed line carries the marker and occurs once`); ok(!MARK.test(before), `${rel}: the line before is the viewer half's`) }
      ok(added.length > 0, `${rel}: has marked lines`)
      // the viewer half's own strip still works on it: none of its lines is changed or gone
      const nowLines = new Set(now.split('\n'))
      ok(base.split('\n').filter(line => VIEWER_MARK.test(line)).every(line => nowLines.has(line)), `${rel}: every marked line of the viewer half is still there, as it was (its strip is untouched)`)
    }
    ok(strip.stripChatParityWorkspace(REGISTRY, read(REGISTRY)).split('\n').length === read(REGISTRY).split('\n').length - 2, `${REGISTRY}: the strip takes this change's two registry lines out`)
    for (const rel of strip.CHAT_PARITY_WORKSPACE_PIN_FILES) ok(strip.stripChatParityWorkspace(rel, read(rel)) !== read(rel), `${rel}: the strip gives the older proof its previous lines back`)
    for (const rel of ['hooks/use-deckster-websocket-v2.ts', '.env.example', 'package.json', 'lib/studio-chat-commands-wire.ts', 'components/builder/studio-chat-commands.css', 'components/builder/studio-chat-parity-viewer.css', 'components/builder/chat-input.tsx', 'components/builder/chat/studio-chat-clean.tsx', 'lib/studio-chat-clean.ts', 'lib/studio-version-history-v2.ts', 'components/builder/template-picker.tsx']) ok(read(rel) === git('show', `${strip.BASE_COMMIT}:${rel}`), `${rel}: not touched by this change`)
    // the base files of a file the viewer half left alone: the two commits agree
    for (const rel of strip.CHAT_PARITY_WORKSPACE_FILES.filter(rel => !strip.BASE_TOUCHED.includes(rel))) ok(git('show', `${strip.BASE_COMMIT}:${rel}`) === git('show', `${strip.BASE_UNDER_COMMIT}:${rel}`), `${rel}: the viewer half left it alone (its head and the commit under it agree)`)
  } else console.log(`NOTE C  git has no ${strip.BASE_COMMIT.slice(0, 8)} or ${strip.BASE_UNDER_COMMIT.slice(0, 8)}: the base-identity checks were skipped`)
  pageChecks(read(PAGE)); viewerChecks(read(VIEWER)); notesChecks(read(NOTES)); introChecks(read(INTRO)); glueChecks(read(GLUE), read(COMMANDS_UI))
  // the registry: two lines, in their lists, naming this change's files and strip
  const reg = read(REGISTRY)
  const regLines = reg.split('\n').filter(line => line.includes(strip.CHAT_PARITY_WORKSPACE_REGISTRY_MARK))
  eq(regLines.length, 2, 'registry: two lines')
  ok(regLines.every(line => line.includes('// LATER-CHANGE: ')), 'registry: both marked LATER-CHANGE')
  for (const rel of strip.CHAT_PARITY_WORKSPACE_SCOPE_FILES) ok(registry.LATER_CHANGE_FILES.has(rel), `registry: ${rel} is registered`)
  ok(registry.LATER_STRIPS.includes(strip.stripChatParityWorkspace) && registry.LATER_STRIPS.indexOf(strip.stripChatParityWorkspace) > registry.LATER_STRIPS.indexOf(viewerStrip.stripChatParityViewer), 'registry: the strip is registered, after the viewer half\'s')
  eq(registry.LATER_ENV_BLOCKS.some(block => /STUDIO_CHAT_PARITY_WORKSPACE/.test(String(block))), false, 'registry: no .env.example block (no flag of its own)')
  const lastFilesLine = regLines.find(line => /^  \.\.\.\(await import\(/.test(line))
  ok(lastFilesLine && reg.indexOf(lastFilesLine) < reg.indexOf('// one line per later change, above this comment'), 'registry: appended in the files list above the marker comment')
  // no new flag: the only env names this change reads are the commands flag, chat clean (its gate) and the composer library flag the picker reads
  const flagNames = new Set()
  const scan = text => { for (const match of text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) flagNames.add(match[0]) }
  for (const rel of [LIB, GLUE, ICONS]) scan(read(rel))
  if (hasBase) for (const rel of strip.CHAT_PARITY_WORKSPACE_FILES) scan(diffLines(rel, '+').join('\n'))
  eq([...flagNames].sort(), ['NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED', 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN', 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS'], 'no new flag: the only env names this change names are the commands flag, chat clean, and the composer library flag the template picker reads')
  // the trigger: "/template" takes several words; every other trigger is what it was
  const commandsLib = read(COMMANDS_LIB)
  ok(commandsLib.includes('const COMMAND_RE = /(^|\\s)\\/([\\w-]*)(?: ([\\w-]*))?$/') && commandsLib.includes('const COMMAND_WORDS_RE = /(^|\\s)\\/(layout|theme) ([^\\n]*)$/i'), 'commands lib: the existing rules are untouched')
  ok(commandsLib.includes('const COMMAND_TEMPLATE_RE = /(^|\\s)\\/(template) ([^\\n]*)$/i'), 'commands lib: several words only after /template (a space after the name: /template-mode keeps the one-word rule)')
  triggerChecks()
  // the lib: pure, nothing from the browser, no network, no confirm, no secrets
  const libText = read(LIB)
  const code = libText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const [pattern, why] of [[/\bconfirm\s*\(/, 'no confirm box of its own'], [/\bwindow\b|\bdocument\b|\blocalStorage\b/, 'no browser globals'], [/\bfetch\s*\(|XMLHttpRequest|WebSocket/, 'no network'], [/process\.env/, 'no flag read (the hosts gate it)'], [/\bimport\s+React|from 'react'/, 'no React']]) ok(!pattern.test(code), `lib: ${why}`)
  eq(importLines(libText).map(line => line.replace(/^import (?:type )?.* from /, '')), ["'@/lib/studio-chat-parity-viewer'", "'@/lib/studio-chat-parity-viewer'"], 'lib: imports only the viewer half\'s lib (values and types)')
  ok(!/(sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[:=]|Bearer\s+[A-Za-z0-9]|-----BEGIN)/i.test([LIB, GLUE, ICONS].map(read).join('\n')), 'no secrets in this change\'s new files')
  // the committed diff is this change's files (the COMMITTED diff only: a working-tree edit is not read here)
  if (OWN.length && hasBase) {
    const touched = new Set()
    for (const sha of OWN) for (const rel of git('diff-tree', '--no-commit-id', '--name-only', '-r', '-m', '--first-parent', sha).split('\n').filter(Boolean)) touched.add(rel)
    const stray = [...touched].filter(rel => !strip.CHAT_PARITY_WORKSPACE_SCOPE_FILES.has(rel))
    eq(stray, [], 'the committed diff of this change\'s commits is its own files (strays: none)')
    ok(OWN.every(sha => /Co-Authored-By: Claude (?:Opus|Sonnet) 5\.5 <noreply@anthropic\.com>/.test(git('log', '-1', '--format=%B', sha))), 'every commit of this change carries the Co-Authored-By line')
  } else console.log(`NOTE C  no own commit yet (subject "${strip.CHAT_PARITY_WORKSPACE_SUBJECT} ..."): the committed-diff check was skipped`)
}

/** detectTrigger of the commands lib, now and as the viewer half had it: the same for every text but "/template" followed by several words. */
function triggerChecks(nowText = read(COMMANDS_LIB)) {
  const load = text => evaluate(text, COMMANDS_LIB, specifier => repoLoader.load(specifier.replace(/^@\//, '')))
  const now = load(nowText)
  const headText = strip.stripChatParityWorkspace(COMMANDS_LIB, nowText)
  const head = load(headText)
  eq(now.detectTrigger('please /template Quarterly Review'), { kind: 'command', start: 7, name: 'template', arg: 'Quarterly Review' }, 'trigger: "/template Quarterly Review" is the command with the whole name')
  eq([now.detectTrigger('/template'), now.detectTrigger('/template '), now.detectTrigger('/templat'), now.detectTrigger('/template-mode on'), now.detectTrigger('/kg off'), now.detectTrigger('/notes sh')],
    [{ kind: 'command', start: 0, name: 'template', arg: null }, { kind: 'command', start: 0, name: 'template', arg: '' }, { kind: 'command', start: 0, name: 'templat', arg: null }, { kind: 'command', start: 0, name: 'template-mode', arg: 'on' }, { kind: 'command', start: 0, name: 'kg', arg: 'off' }, { kind: 'command', start: 0, name: 'notes', arg: 'sh' }], 'trigger: /template alone, with a space, a prefix, /template-mode on, /kg off, /notes sh')
  for (const text of ['', '/', '/e', '/export p', '/theme dark blue', '/layout image text', '/kg on', '@abc', 'hi /notes show', 'say hi', '/template-mode', '/template-mode o', 'a /pane slides', '/history', 'x @slide 3 /template', '/template-mode on please', '/kg on please', '/notes show me', '/templatemode a b']) eq(now.detectTrigger(text), head.detectTrigger(text), `trigger: ${JSON.stringify(text)} is what the viewer half had`)
}

/** The group's markup, rendered on the viewer half's real menu component with this change's icons. */
function menuChecks(text = read(MENU), icons = read(ICONS)) {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const iconModule = evaluate(icons, ICONS, specifier => { if (specifier === 'react') return React; if (specifier === 'lucide-react') return require('lucide-react'); throw new Error(`the icons import ${specifier}`) })
  const module = evaluate(text, MENU, specifier => {
    if (specifier === 'react') return React
    if (specifier === 'lucide-react') return require('lucide-react')
    if (/\.css$/.test(specifier)) return {}
    if (specifier === '@/lib/studio-chat-parity-viewer') return {}
    if (specifier === '@/components/builder/chat/studio-chat-parity-workspace-icons') return iconModule
    throw new Error(`the menu imports ${specifier}`)
  })
  const ws = loadWs()
  const rowProps = index => ({ id: `opt-${index}`, role: 'option', type: 'button', 'aria-selected': index === 4, className: 'row' })
  const html = renderToStaticMarkup(React.createElement(module.ChatParityRows, { rows: ws.workspaceRows({ name: '', arg: null }, envOf({ state: ws.EMPTY_WORKSPACE_STATE })), offset: 28, rowProps, headingClass: 'heading' }))
  eq([...html.matchAll(/data-studio-chat-commands-heading="(\w+)"/g)].map(match => match[1]), ['workspace'], 'menu: one heading, Workspace')
  eq([...html.matchAll(/id="opt-(\d+)"/g)].map(match => Number(match[1])), Array.from({ length: 10 }, (_, i) => 28 + i), 'menu: one index list after the existing and the viewer rows (arrows and ARIA ids work through it)')
  eq((html.match(/aria-disabled="true"/g) || []).length, 10, 'menu: a row that cannot run is aria-disabled (all ten with no part mounted)')
  ok(html.includes('Open the builder first.') && html.includes('data-studio-chat-parity="true"'), 'menu: the reason is on the row')
  ok(/aria-label="\/kg: Open the builder first\."/.test(html), 'menu: the label for assistive technology says the reason')
  eq((html.match(/<svg/g) || []).length, 10, 'menu: every row has its icon (no row crashes on a missing one)')
  const hint = renderToStaticMarkup(React.createElement(module.ChatParityRows, { rows: ws.workspaceRows({ name: 'kg', arg: 'maybe' }, envOf()), offset: 0, rowProps, headingClass: 'heading' }))
  ok(hint.includes('Say /kg on or /kg off.') && hint.includes('data-studio-chat-parity-hint="true"') && hint.includes('aria-disabled="true"'), 'menu: a hint row says it inline and cannot be picked')
  eq(Object.keys(iconModule.WORKSPACE_ICONS).sort(), ws.WORKSPACE_COMMANDS.map(def => def.name).sort(), 'icons: one for every command')
  ok(!/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(icons), 'icons: no colour')
  ok(!fs.existsSync(path.join(root, 'components/builder/studio-chat-parity-workspace.css')), 'css: none of its own (the viewer half\'s rows and tokens style these: no new colour)')
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
  const both = async mutated => { libSuite(loadWs(mutated)); await templatesSuite(loadWs(mutated)); await busSuite(mutated) }
  const m = (from, to) => text => { if (!text.includes(from)) throw new Error(`mutant anchor missing: ${from}`); return text.replace(from, to) }
  await caught('/kg sends the other direction', m('await a.setKg(what.on)', 'await a.setKg(!what.on)'), both)
  await caught('/kg is allowed once research ran', m("return kg.locked ? W.kgLocked : null", 'return null'), both)
  await caught('/kg ignores the access reasons', m("if (kg.access === 'locked') return W.kgPro", 'if (false) return W.kgPro'), both)
  await caught('/kg claimed without looking (settle returns at once)', m('if (test(fresh())) return true', 'if (fresh()) return true'), both)
  await caught('the block check is skipped at run time', m('if (blocked) return failed(blocked)', 'if (false) return failed(blocked)'), both)
  await caught('/template clear and stop swapped', m("if (run.op === 'stop') return template.running ? null : W.reuseNotRunning", "if (run.op === 'clear') return template.running ? null : W.reuseNotRunning"), both)
  await caught('/template stop is allowed with nothing running', m('return template.running ? null : W.reuseNotRunning', 'return null'), both)
  await caught('a locked selection can still be changed', m("if (template.locked) return W.templateLocked\n      return template.active?.id", 'return template.active?.id'), both)
  await caught('/template select hands over the wrong record', m('await a.selectTemplate(what.pick)', 'await a.selectTemplate({ id: what.pick.id, name: what.pick.name })'), both)
  await caught('/template select is claimed on any change', m("s.template?.active?.id === what.pick.id", 's.template?.active != null'), both)
  await caught('a template that is not ready is runnable', m('(item.ready ? null : item.why)', 'null'), both)
  await caught('the template pick loses a field', m("'blueprint_enrichment_error', ", ''), both)
  await caught('the composer library carriers are listed', m('rules.composerLibrary ? res.templates.filter', 'false ? res.templates.filter'), both)
  await caught('/template-mode toggles blind (sends the other mode)', m('await a.setTemplateMode(what.on)', 'await a.setTemplateMode(!what.on)'), both)
  await caught('Template Mode can be entered with no template chosen', m('return run.on && !mode.available ? W.modeNeedsTemplate : null', 'return null'), both)
  await caught('the Template button\'s reason is dropped', m('return state.mode.blocked', 'return null'), both)
  await caught('/notes toggles even when already as asked', m('return state.notes.shown === run.show ? W.notesAlready(run.show) : null', 'return null'), both)
  await caught('/notes claims without looking', m('s.notes?.shown === what.show', 's.notes != null'), both)
  await caught('/dark sets the wrong appearance', m('await a.setTheme(what.name)', "await a.setTheme('light')"), both)
  await caught('/system is not a choice', m("case 'system':\n      if (!state.theme) return W.noPage", "case 'sys':\n      if (!state.theme) return W.noPage"), both)
  await caught('/intro does not wait for the typed command to leave', m('await sleep(wait(WORKSPACE_WAIT.cleared))', ''), both)
  await caught('/intro claims playing without looking', m('s.intro?.active === true', 's.intro != null'), both)
  await caught('/intro runs over a typed draft', m('def.name === \'intro\' && env.draft ? W.introDraft : null', 'null'), both)
  await caught('/pane calls the wrong pane', m('await a.selectPane(what.pane)', "await a.selectPane('chat')"), both)
  await caught('/pane works at a width with no switcher', m("return state.pane.dual ? W.paneDual : null", 'return null'), both)
  await caught('/pane slides is offered where the Slides button is not drawn', m("if (run.pane === 'slides' && !pane.overlay) return W.paneSlidesShown", 'if (false) return W.paneSlidesShown'), both)
  await caught('/history claims it opened on any answer', m("(await a.openHistory()) === true ? done(", '(await a.openHistory()) !== undefined ? done('), both)
  await caught('/history forgets that restoring is a click', m(" Pick a version in History to restore it.", ''), both)
  await caught('/history ignores its flag', m('if (!state.history.enabled) return W.historyOff', 'if (false) return W.historyOff'), both)
  await caught('the published state is announced every time', m('if (text === signature) return', 'if (false) return'), both)
  await caught('an old registration unregisters the newer one', m('if (parts.get(key) === get) { parts.delete(key); publishWorkspaceState() }', 'parts.delete(key); publishWorkspaceState()'), both)
  await caught('a part that throws breaks the bus', m('try { part = get() } catch { part = null }', 'part = get()'), both)
  await caught('a workspace run is not marked', m('({ ws: true, ...value }) as WorkspaceRun', '({ ...value }) as WorkspaceRun'), both)
  await caught('the group is named otherwise', m("export const WORKSPACE_GROUP = 'Workspace' as const", "export const WORKSPACE_GROUP = 'Deck' as const"), both)
  await caught('a typed word reaches a command that takes none as a run', m("if (!def.takes) return arg ? [problem(def.name, `/${def.name}`, PARITY_WORDS.nothingAfter(def.name))] : [firstLevel(def, env)]", 'if (!def.takes) return [firstLevel(def, env)]'), both)
  await caught('a hint row carries a run', m("({ ...mk(command, label, '', null, null, key), hint: text })", "({ ...mk(command, label, '', FIRST_LEVEL_RUN.dark, null, key), hint: text })"), both)
  await caught('no part is a reason', m("if (!state.notes) return W.noDeck", 'if (!state.notes) return null'), both)
  await caught('the lib gains a confirm box', t => `${t}\nexport const askFirst = () => confirm('sure?')\n`, async mutated => { sourceLibOnly(mutated) })
  await caught('the lib reads a flag', t => `${t}\nexport const on = process.env.NEXT_PUBLIC_X === 'true'\n`, async mutated => { sourceLibOnly(mutated) })
  // the strip and the sources
  const stripText = fs.readFileSync(path.join(root, 'scripts/studio-chat-parity-workspace-strip.mjs'), 'utf8')
  const loadStrip = text => import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
  const identity = async mod => { if (!hasBase) throw new Error('no base: the mutant cannot be judged here (treated as caught)'); for (const rel of strip.CHAT_PARITY_WORKSPACE_FILES) if (mod.stripChatParityWorkspace(rel, read(rel)) !== baseOf(rel)) throw new Error(`${rel}: not the base`) }
  for (const [name, from, to] of [
    ['the strip forgets the marker', 'CHAT_PARITY_WORKSPACE_MARKER_RE = /(?<![\\w-])CHAT-PARITY-WORKSPACE(?![\\w-])/', 'CHAT_PARITY_WORKSPACE_MARKER_RE = /(?<![\\w-])CHAT-PARITY-WORKSPACE-NOT(?![\\w-])/'],
    ['the strip drops a file', '  "components/slide-notes-panel.tsx",\n', ''],
    ['the strip drops the viewer half\'s menu', '  "components/builder/chat/studio-chat-parity-viewer-menu.tsx",\n]', ']'],
  ]) {
    const mutated = stripText.replace(from, to)
    assert.notEqual(mutated, stripText, `mutant applies: ${name}`)
    let threw = false
    try { await identity(await loadStrip(mutated)) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  const mutateSource = (rel, check, label, cases) => {
    const text = read(rel)
    for (const [name, from, to] of cases) {
      const mutated = text.replace(from, to)
      assert.notEqual(mutated, text, `mutant applies: ${name}`)
      let threw = false
      try { check(mutated, label) } catch { threw = true }
      hit(threw, `mutant caught: ${name}`)
    }
  }
  mutateSource(PAGE, pageChecks, 'mutant', [
    ['the page part runs with the flag off', 'chatParityWorkspaceLive.current = !chatCommandsOn ? null : {', 'chatParityWorkspaceLive.current = false ? null : {'],
    ['the registering effect runs with the flag off', 'useEffect(() => { if (!chatCommandsOn) return; let off', 'useEffect(() => { let off'],
    ['the page imports the bus statically', "import { studioIntroEligibility } from '@/lib/studio-intro-eligibility' // CHAT-PARITY-WORKSPACE", "import { studioIntroEligibility } from '@/lib/studio-intro-eligibility' // CHAT-PARITY-WORKSPACE\nimport { registerWorkspacePart } from '@/lib/studio-chat-parity-workspace'"],
    ['a note is dropped when the thread is off', 'if (chatParityThreadOn.current) thread?.(text); else toast({ title: text })', 'thread?.(text)'],
    ['the thread state is read when the command was picked, not when the note is made', 'chatParityThreadOn.current = chatCleanOn', 'chatParityThreadOn.current = true'],
    ['/kg calls something else', 'setKg: setKnowledgeGraphEnabled,', 'setKg: setActiveTemplate,'],
    ['/template clear calls something else', 'clearTemplate: handleClearTemplate,', 'clearTemplate: handleCancelTemplateReuse,'],
    ['/template stop calls something else', 'stopTemplateReuse: handleCancelTemplateReuse,', 'stopTemplateReuse: handleClearTemplate,'],
    ['/template <name> calls something else', 'selectTemplate: handleSelectTemplate,', 'selectTemplate: handleTemplateBlueprintSave,'],
    ['the kg lock is not the research lock', 'locked: researchSettingsLocked }', 'locked: false }'],
    ['a reuse running is not the Stop button\'s rule', 'running: Boolean(activeTemplate && isGeneratingFinal) }', 'running: Boolean(isGeneratingFinal) }'],
    ['the template lock is not the selection lock', 'locked: templateSelectionLocked, running', 'locked: false, running'],
    ['/pane slides does not take the stage', 'if (pane === \'slides\') { retireStudioVoiceOwner(); setStudioStageSelected(true) }', 'if (pane === \'slides\') { retireStudioVoiceOwner() }'],
    ['/pane chat forgets to reopen the chat', "selectWorkspacePane('chat'); if (!showChat) setShowChat(true) } else selectWorkspacePane('inspector')", "selectWorkspacePane('chat') } else selectWorkspacePane('inspector')"],
    ['the pane showing ignores the stage', 'studioOverlayWorkspace && (studioStageSelected || (!workspaceLayout.chatVisible', 'studioOverlayWorkspace && ((!workspaceLayout.chatVisible'],
    ['/intro counts the typed command as a draft term it should not (a term dropped)', ' || isTemplateParamsDrawerOpen || !!studioViewerSafety?.dirty }).manual', ' || isTemplateParamsDrawerOpen }).manual'],
    ['/intro ignores the replay rule', 'introReady: studioShell && studioIntroEligibility({ ...studioIntroInputs, dirtyDraft:', 'introReady: studioShell && Boolean({ ...studioIntroInputs, dirtyDraft:'],
  ])
  mutateSource(VIEWER, viewerChecks, 'mutant', [
    ['the viewer part runs with the flag off', 'chatParityWorkspaceLive.current = !chatParityViewerOn ? null : {', 'chatParityWorkspaceLive.current = false ? null : {'],
    ['the viewer\'s effect runs with the flag off', "useEffect(() => { if (!chatParityViewerOn) return; let off: (() => void) | null = null; let live = true; void import('@/lib/studio-chat-parity-workspace')", "useEffect(() => { let off: (() => void) | null = null; let live = true; void import('@/lib/studio-chat-parity-workspace')"],
    ['/template-mode skips the intent bump', 'setTemplateMode: (on: boolean) => { if (studioShell) viewerInteractionIntentRef.current += 1; onTemplateModeChange?.(on) }', 'setTemplateMode: (on: boolean) => { onTemplateModeChange?.(on) }'],
    ['/template-mode sends a blind toggle', 'onTemplateModeChange?.(on) } } }', 'onTemplateModeChange?.(!templateModeOn) } } }'],
    ['the Template button\'s reason is not its own', "studioToolbarDisabledReason('template', {", "studioToolbarDisabledReason('add-slide', {"],
    ['a template chosen is not what unlocks Template Mode', 'available: templateModeAvailable, blocked:', 'available: true, blocked:'],
  ])
  mutateSource(NOTES, notesChecks, 'mutant', [
    ['the notes gate loses a flag', "process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true' // CHAT-PARITY-WORKSPACE", "true // CHAT-PARITY-WORKSPACE"],
    ['the notes part is not the bar\'s handler', 'toggleNotes: handleToggleExpanded }', 'toggleNotes: () => {} }'],
    ['the notes part reads something else', 'notes: { shown: expanded }', 'notes: { shown: !expanded }'],
    ['the notes effect runs with the flag off', 'useEffect(() => { if (!chatParityWorkspaceOn) return; let off', 'useEffect(() => { let off'],
  ])
  mutateSource(INTRO, introChecks, 'mutant', [
    ['the intro gate loses the owner\'s enabled', 'const chatParityWorkspaceOn = enabled && ', 'const chatParityWorkspaceOn = '],
    ['the intro part is not the button\'s handler', 'replayIntro: requestReplay }', 'replayIntro: () => setReplay(value => value + 1) }'],
    ['the intro part does not say it is playing', 'intro: { active } }', 'intro: { active: true } }'],
  ])
  const glueText = read(GLUE), uiText = read(COMMANDS_UI)
  for (const [name, from, to] of [
    ['the glue forgets to register its runner', 'registerParityRunner(runWorkspace)', 'void runWorkspace'],
    ['the composer part is registered with the flag off', "if (!input.enabled) return\n    const off = registerWorkspacePart('composer'", "const off = registerWorkspacePart('composer'"],
    ['the glue returns rows with the flag off', 'const trigger = input.enabled ? input.trigger : null', 'const trigger = input.trigger'],
    ['/dark calls the wrong setter', 'setTheme: (choice: ThemeChoice) => live.current.setTheme(choice)', 'setTheme: (choice: ThemeChoice) => live.current.setTheme("light")'],
    ['/history does not call the bridge', 'openHistory: () => versionHistoryBridge.open()', 'openHistory: () => true'],
    ['the glue gains a confirm box', "const themeChoice = ", "const askFirst = () => confirm('sure?')\nconst themeChoice = "],
    ['the picker\'s ready rule is replaced', 'ready: template => isTemplateGenerationReady(template)', 'ready: template => Boolean(template)'],
    ['a toast title is mistyped', "optimizing: 'Template optimizing'", "optimizing: 'Template optimising'"],
  ]) {
    const mutated = glueText.replace(from, to)
    assert.notEqual(mutated, glueText, `mutant applies: ${name}`)
    let threw = false
    try { glueChecks(mutated, uiText, 'mutant') } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  for (const [name, from, to] of [
    ['the composer rows are placed before the viewer half\'s', 'parity.push(...workspaceRows)', 'parity.unshift(...workspaceRows)'],
    ['the composer hands the hook a trigger of any kind', "trigger: trigger?.kind === 'command' ? trigger : null,", 'trigger: trigger as never,'],
    ['the composer drops the template gate', 'template: input.template, listTemplates', 'template: { saved: true, blocked: null }, listTemplates'],
  ]) {
    const mutated = uiText.replace(from, to)
    assert.notEqual(mutated, uiText, `mutant applies: ${name}`)
    let threw = false
    try { glueChecks(glueText, mutated, 'mutant') } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  // the trigger
  for (const [name, from, to] of [
    ['/template takes only one word', 'const COMMAND_TEMPLATE_RE = /(^|\\s)\\/(template) ([^\\n]*)$/i // CHAT-PARITY-WORKSPACE', 'const COMMAND_TEMPLATE_RE = /(^|\\s)\\/(template) ([\\w-]*)$/i // CHAT-PARITY-WORKSPACE'],
    ['/template-mode takes several words', 'const COMMAND_TEMPLATE_RE = /(^|\\s)\\/(template) ([^\\n]*)$/i // CHAT-PARITY-WORKSPACE', 'const COMMAND_TEMPLATE_RE = /(^|\\s)\\/(template[\\w-]*) ([^\\n]*)$/i // CHAT-PARITY-WORKSPACE'],
    ['every command takes several words', 'const COMMAND_TEMPLATE_RE = /(^|\\s)\\/(template) ([^\\n]*)$/i // CHAT-PARITY-WORKSPACE', 'const COMMAND_TEMPLATE_RE = /(^|\\s)\\/([\\w-]+) ([^\\n]*)$/i // CHAT-PARITY-WORKSPACE'],
  ]) {
    const text = read(COMMANDS_LIB)
    const mutated = text.replace(from, to)
    assert.notEqual(mutated, text, `mutant applies: ${name}`)
    let threw = false
    try { triggerChecks(mutated) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  // an unmarked line left in a stripped file
  if (hasBase) {
    const unmarked = read(COMMANDS_UI).replace('const workspaceRows = useChatParityWorkspace', 'const workspaceRows = /* x */ useChatParityWorkspace').replace(" // CHAT-PARITY-WORKSPACE: the Workspace group's rows", " // the Workspace group's rows")
    hit(strip.stripChatParityWorkspace(COMMANDS_UI, unmarked) !== baseOf(COMMANDS_UI), 'mutant caught: an unmarked line stays in the stripped file')
  }
  // the menu
  for (const [name, from, to] of [['the menu forgets the workspace icons', '  ...WORKSPACE_ICONS, // CHAT-PARITY-WORKSPACE', '  // none'], ['the menu forgets aria-disabled', "aria-disabled={off ? 'true' : undefined}", '']]) {
    const menuText = read(MENU)
    const mutated = menuText.replace(from, to)
    assert.notEqual(mutated, menuText, `mutant applies: ${name}`)
    let threw = false
    try { menuChecks(mutated) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  { const icons = read(ICONS); const mutated = icons.replace(' history: History,', ''); assert.notEqual(mutated, icons); let threw = false; try { menuChecks(read(MENU), mutated) } catch { threw = true } hit(threw, 'mutant caught: a command has no icon') }
  return mutantsCaught
}

/** The lib-only source rules (also run on a mutated lib). */
function sourceLibOnly(text) {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  if (/\bconfirm\s*\(/.test(code)) throw new Error('the lib has a confirm box of its own')
  if (/process\.env/.test(code)) throw new Error('the lib reads a flag')
}

// ============================================================================================================================================
// Run
// ============================================================================================================================================
libSuite()
console.log(`PASS A  the lib: what blocks each command, the button's own reasons, every row, the saved templates, the typed word that never confirms (${checks} checks)`)
const afterLib = checks
await templatesSuite()
console.log(`PASS A2 the saved templates, read the way the toolbar's picker reads them (${checks - afterLib} checks)`)
const afterA = checks
await busSuite()
console.log(`PASS B  the bus on fake parts: every command's handler and arguments, what it saw, refusals, the viewer half's runParity (${checks - afterA} checks)`)
const afterB = checks
sourceChecks()
menuChecks()
sourceLibOnly(read(LIB))
console.log(`PASS C  the sources: markers, the strip back to the viewer half's head, the gates and handlers of the page, viewer, notes panel and introduction, the glue, the trigger, the registry, no new flag, the committed diff, the menu markup (${checks - afterB} checks)`)
const mutants = await mutantsSuite()
console.log(`test-studio-chat-parity-workspace: ${checks} checks, ${mutants} mutants caught (${OWN.length ? `own commits ${OWN.map(sha => sha.slice(0, 8)).join(', ')}` : 'no own commit yet'})${hasBase ? '' : ' (base commit not in this clone: some checks skipped)'}`)
