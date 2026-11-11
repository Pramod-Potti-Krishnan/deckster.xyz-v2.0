// FRONTEND-1 (overnight chat parity, the REMAINING commands): proof of /delete-theme, /delete-template, /model <choice>, /kg-search, /ask, /switch-template, the existing /publish row opening the Publish wizard, and an @template that chooses the template,
// behind NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (the string "true", default off, build-time; it already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell), stacked on the workspace half (#614) and the viewer half (#611).
//   lib/studio-chat-parity-more.ts (the rows, what cannot run and why, the words, the runs, the gauge's bus), lib/studio-chat-parity-more-model.ts (the gauge's hook as rows and saves), lib/studio-chat-parity-more-handoff.ts (the one-time hand-off),
//   components/builder/chat/studio-chat-parity-more.tsx (the composer's glue), and marked lines in the composer, the commands lib and the menu, the gauge's hook, the Knowledge page and its Ask box, and the Themes / Templates pages and their row.
//
//   A. The lib, function by function, in THIS realm: what blocks each command (and the button's own reason), the rows for every trigger (hints, disabled reasons, groups), the typed word that never confirms.
//   B. The runs on FAKE handles: every command calls its handle with the right arguments, says what it saw (and never a change it did not see), opens a NEW TAB while a build runs or edits are unsaved, never deletes / asks / publishes;
//      the model helper on a fake hook (the stops, the three saves, the Intelligence page's save with its refusals); the hand-off.
//   C. The sources: every marked line, the strip puts each file back to the workspace half's head byte for byte (and through the registry), the confirms are never bypassed (the row's effect only OPENS its dialog; the Ask box is only filled),
//      the gates, no new flag, the committed diff is this change's files (COMMITTED diff only), the menu markup.
//   D. MUTANTS: every one of them must be caught by A-C.
//
//   node scripts/test-studio-chat-parity-more.mjs
//
// Offline: no socket, no fetch, no browser; the libs run on fakes and short waits (scale); git is read only for C. Later changes stack on top, so the committed-diff check reads THIS change's own commits (subject "Chat parity more: ...").
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let checks = 0
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside a vm have their own prototypes: compare them as plain data
const eq = (actual, expected, message) => { checks++; assert.deepEqual(plain(actual), plain(expected), message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const strip = await import('./studio-chat-parity-more-strip.mjs')
const wsStrip = await import('./studio-chat-parity-workspace-strip.mjs')
const viewerStrip = await import('./studio-chat-parity-viewer-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')

const LIB = 'lib/studio-chat-parity-more.ts'
const MODEL = 'lib/studio-chat-parity-more-model.ts'
const HANDOFF = 'lib/studio-chat-parity-more-handoff.ts'
const GLUE = 'components/builder/chat/studio-chat-parity-more.tsx'
const ICONS = 'components/builder/chat/studio-chat-parity-more-icons.ts'
const VIEWER_LIB = 'lib/studio-chat-parity-viewer.ts'
const MENU = 'components/builder/chat/studio-chat-parity-viewer-menu.tsx'
const COMMANDS_UI = 'components/builder/chat/studio-chat-commands.tsx'
const COMMANDS_LIB = 'lib/studio-chat-commands.ts'
const HOOK = 'components/model-choice/use-model-choice.ts'
const KNOWLEDGE = 'app/(app)/knowledge/page.tsx'
const ASK = 'components/knowledge/studio-kg-ask.tsx'
const ROW = 'components/studio-libraries/library-manage.tsx'
const THEMES = 'components/studio-libraries/themes-workspace.tsx'
const TEMPLATES = 'components/studio-libraries/templates-workspace.tsx'
const REGISTRY = 'scripts/studio-later-changes.mjs'
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const exists = sha => { try { git('cat-file', '-e', `${sha}^{commit}`); return true } catch { return false } }
const hasBase = exists(strip.BASE_COMMIT) && exists(strip.BASE_UNDER_COMMIT)
const baseCommitOf = rel => (strip.BASE_TOUCHED.includes(rel) || strip.CHAT_PARITY_MORE_PIN_FILES.includes(rel) || rel === REGISTRY ? strip.BASE_COMMIT : strip.BASE_UNDER_COMMIT)
const baseOf = rel => git('show', `${baseCommitOf(rel)}:${rel}`)
/** This change's own commits (newest first): subject "Chat parity more: ...". */
const OWN = (() => { try { return git('log', '--format=%H%x09%s', '--no-merges', `${strip.BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).map(line => line.split('\t')).filter(([, subject]) => subject.startsWith(strip.CHAT_PARITY_MORE_SUBJECT)).map(([sha]) => sha) } catch { return [] } })()

// ---- the libs, evaluated in THIS realm (the viewer half's lib: its two imports come from the repo through the harness loader; the model helper: the repo's model libs and the two catalog snapshots) -----------------------
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
const JSON_STUBS = {
  '@/components/studio-personal/model-catalog-snapshot.json': JSON.parse(read('components/studio-personal/model-catalog-snapshot.json')),
  '@/components/studio-personal/model-catalog-snapshot-2026-10.json': JSON.parse(read('components/studio-personal/model-catalog-snapshot-2026-10.json')),
}
const repoLoader = createModuleLoader({ root, globals: { process: { env: { NODE_ENV: 'production' } }, console, Date, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp }, stubs: JSON_STUBS })
const evaluate = (text, fileName, req, env = {}) => { const module = { exports: {} }; new Function('module', 'exports', 'require', 'process', compile(text, fileName))(module, module.exports, req, { env }); return module.exports }
function loadViewerLib(text = read(VIEWER_LIB)) {
  return evaluate(text, VIEWER_LIB, specifier => {
    if (specifier === '@/types/elements') return repoLoader.load('types/elements.ts')
    if (specifier === '@/lib/studio-add-slide-v2') return repoLoader.load('lib/studio-add-slide-v2.ts')
    throw new Error(`the viewer half's lib imports only the layout catalog and the add-slide options, not ${specifier}`)
  })
}
function loadMore(text = read(LIB), viewer = loadViewerLib()) {
  return evaluate(text, LIB, specifier => {
    if (specifier === '@/lib/studio-chat-parity-viewer') return viewer
    throw new Error(`the lib imports only the viewer half's lib (its other imports are types), not ${specifier}`)
  })
}
function loadModel(text = read(MODEL)) {
  return evaluate(text, MODEL, specifier => {
    if (Object.prototype.hasOwnProperty.call(JSON_STUBS, specifier)) return JSON_STUBS[specifier]
    if (specifier.startsWith('@/')) return repoLoader.load(specifier.slice(2))
    throw new Error(`the model helper imports the repo's model libs, not ${specifier}`)
  })
}
const loadHandoff = (text = read(HANDOFF), env = {}) => evaluate(text, HANDOFF, () => { throw new Error('the hand-off imports nothing') }, env)
const SCALE = 0.01 // the waits (ms) times this to SEE an effect: a command that changes nothing fails fast

// ---- fakes: the env the rows read, the handles a run calls, the gauge's part -----------------------------------------------------------------------------------------------------
const VIEWER = (over = {}) => ({ ready: true, slideCount: 3, slide: 1, editing: false, grid: false, borders: false, rail: true, presenting: false, building: false, slideReason: null, save: 'saved', version: { active: 'blank', has: ['blank'] }, ...over })
const STOPS = [{ id: 'auto', label: 'Auto', hint: null, auto: true }, { id: 'fast', label: 'Fast', hint: '$', auto: false }, { id: 'balanced', label: 'Balanced', hint: '$$', auto: false }, { id: 'best', label: 'Best', hint: '$$$', auto: false }]
const opts = [{ value: 'best', label: 'Best — Gamma Max · $$$', preset: true }, { value: 'model:alpha-pro', label: 'Alpha Pro · Alpha · $$$ · Suggested', preset: false }, { value: 'model:beta-fast', label: 'Beta Fast · Beta · $', preset: false }]
const TASKS = [
  { id: 'planning_strategy', label: 'Planning & Strategy', fixed: false, choice: 'recommended', options: opts },
  { id: 'content_writing', label: 'Content Writing', fixed: false, choice: 'recommended', options: opts },
  { id: 'research_analysis', label: 'Research & Analysis', fixed: false, choice: 'recommended', options: opts },
  { id: 'imagery', label: 'Imagery', fixed: true, choice: 'recommended', options: [] },
  { id: 'voice_narration', label: 'Voice & Narration', fixed: true, choice: 'recommended', options: [] },
]
const GAUGE = (over = {}) => ({ ready: true, scope: 'user', current: 'auto', currentLabel: 'Auto', stops: STOPS, resetNeeded: false, tasks: TASKS, ...over })
const COMPOSER_WHY = "Composer templates can't be deleted here yet."
const envOf = (over = {}) => ({
  themes: { status: 'ready', items: [{ id: 'th1', name: 'Brand Blue' }, { id: 'th2', name: 'Dark Slate' }] },
  templates: { status: 'ready', items: [{ id: 'tp1', name: 'Quarterly Review', why: null }, { id: 'tp2', name: 'Composer Deck', why: COMPOSER_WHY }, { id: 'tp3', name: 'Shared Pitch', why: 'Only templates you saved can be deleted.' }] },
  model: GAUGE(), modelOn: true,
  match: [{ templateId: 'm1', name: 'Sales Pitch', inUse: false }, { templateId: 'm2', name: 'Board Update', inUse: true }, { templateId: null, name: 'No template', inUse: false }],
  flags: { themeDelete: true, templateDelete: true, ask: true },
  checkQuestion: text => (text.trim() ? (text.trim().length > 500 ? { ok: false, message: 'Questions are 500 characters or fewer.' } : { ok: true, question: text.trim() }) : { ok: false, message: 'Type a question first.' }),
  ...over,
})
/** The handles a run calls, as fakes that record: the page's env, a build, the viewer, the hand-off write, the router, a new tab, the Publish press, the template switch. */
function fakePage(more, over = {}) {
  const calls = []
  const s = { env: envOf(), building: false, viewer: VIEWER(), handoffOk: true, press: 'clicked', switchOk: true, ...over }
  more.setMoreLive({
    env: () => s.env, building: () => s.building, viewer: () => s.viewer,
    handoff: request => { calls.push(['handoff', request]); return s.handoffOk },
    go: target => { calls.push(['go', target]) }, openTab: target => { calls.push(['openTab', target]) },
    pressPublish: () => { calls.push(['pressPublish']); return s.press },
    switchTemplate: id => { calls.push(['switchTemplate', id]); return s.switchOk },
  })
  return { calls, s }
}
/** The gauge's part on the bus: handlers that record what they were called with and change what the gauge reads. `behave` per action: 'noop' (does nothing), 'refuse', 'throw'. */
function fakeGauge(more, init = {}, behave = {}) {
  const s = { state: GAUGE(init), calls: [] }
  const rec = (name, fn) => async (...args) => {
    s.calls.push([name, ...args])
    if (behave[name] === 'throw') throw new Error('boom')
    if (behave[name] === 'refuse') return { ok: false, words: 'That choice cannot be saved for this task right now.' }
    if (behave[name] !== 'noop') fn?.(...args)
    return { ok: true, words: behave.words ?? '' }
  }
  const off = more.registerMoreModel(() => ({
    state: s.state,
    actions: {
      chooseStop: rec('chooseStop', id => { s.state = { ...s.state, current: id === 'auto' ? 'auto' : `tier:${id}`, resetNeeded: true } }),
      reset: rec('reset', () => { s.state = { ...s.state, current: 'auto', resetNeeded: false, tasks: TASKS } }),
      chooseTask: rec('chooseTask', (task, value) => { s.state = { ...s.state, resetNeeded: true, tasks: s.state.tasks.map(item => (item.id === task ? { ...item, choice: value } : item)) } }),
    },
  }))
  return { s, off }
}
const R = value => ({ more: true, ...value })
const emit = (more, what) => more.emitMoreCommand(what, { scale: SCALE })

// ============================================================================================================================================
// A. The lib
// ============================================================================================================================================
function libSuite(more = loadMore()) {
  const W = more.MORE_WORDS
  const rows = (name, arg, over) => more.moreRows({ name, arg }, envOf(over))
  const labels = list => list.map(row => row.label)
  const blocked = (what, over) => more.moreBlocked(what, envOf(over))

  // -- the menu ---------------------------------------------------------------------------------------------------------------------------
  const all = rows('', null)
  eq(labels(all), ['/switch-template <name>', '/delete-theme <name>', '/delete-template <name>', '/model <choice>', '/kg-search <words>', '/ask <question>'], 'every command has one row, in the menu\'s order')
  eq(all.map(row => row.group), ['Workspace', 'Library', 'Library', 'Model', 'Knowledge', 'Knowledge'], 'groups: the template switch first (it draws under the workspace half\'s own Workspace heading), then Library, Model, Knowledge')
  ok(all.every(row => row.fill && row.run === null && row.hint === null), 'every command takes a word, so every first row fills its name and runs nothing')
  ok(all.every(row => row.blurb && row.blurb.length <= 54), 'one short line each')
  eq(all.map(row => row.disabled), [null, null, null, null, null, null], 'everything in reach: nothing is disabled')
  eq(new Set(all.map(row => row.key)).size, all.length, 'row keys are unique')
  eq(labels(rows('del', null)), ['/delete-theme <name>', '/delete-template <name>', '/model <choice>'], 'typing filters: the names that start with it, then the names that contain it (mo-del)')
  eq(labels(rows('temp', null)), ['/switch-template <name>', '/delete-template <name>'], 'typing filters: names that contain it too')
  eq(labels(rows('a', null)), ['/ask <question>', '/switch-template <name>', '/delete-template <name>', '/kg-search <words>'], 'a letter lists the names that start with it, then those that contain it')
  eq(rows('nope', null), [], 'a word that names no command: no rows (the other menus close it)')
  // out of reach before any word: the button's own reason
  eq(rows('', null, { flags: { themeDelete: false, templateDelete: false, ask: false } }).map(row => [row.command, row.disabled]), [['switch-template', null], ['delete-theme', W.themeOff], ['delete-template', W.templateOff], ['model', null], ['kg-search', null], ['ask', W.askOff]], 'a library or the Ask box that is not switched on: its row says so')
  eq(rows('model', null, { modelOn: false })[0].disabled, W.modelOff, '/model: the gauge is not turned on')
  eq(rows('model', null, { model: null })[0].disabled, W.modelLoading, '/model: no gauge on screen yet')
  eq(rows('model', null, { model: GAUGE({ ready: false }) })[0].disabled, W.modelLoading, '/model: the gauge is still loading (its button is disabled until it is ready)')
  eq(rows('switch', null, { match: [] })[0].disabled, W.noMatch, '/switch-template: Director has not suggested one')
  eq(rows('delete-theme', '', { flags: { themeDelete: false, templateDelete: true, ask: true } }).map(row => [row.label, row.disabled, row.run, row.fill]), [['/delete-theme', W.themeOff, null, false]], 'a word after a command that is out of reach: one disabled row with the reason, nothing runs')

  // -- /delete-theme and /delete-template: the saved ones, by name; the click on the page's own Delete deletes ------------------------------------------------------
  eq(rows('delete-theme', '').map(row => [row.label, row.run && row.run.name, row.run && row.run.theme && row.run.theme.id, row.disabled]), [['/delete-theme Brand Blue', 'delete-theme', 'th1', null], ['/delete-theme Dark Slate', 'delete-theme', 'th2', null]], '/delete-theme: every saved theme, each a run for that theme')
  eq(rows('delete-theme', 'dark sl').map(row => row.run.theme), [{ id: 'th2', name: 'Dark Slate' }], 'a few words find the theme (loose, in order)')
  ok(rows('delete-theme', 'blue').every(row => /Opens the confirmation on the page/.test(row.blurb) && !row.fill && row.group === 'Library'), 'each row says it only opens a confirmation')
  eq([rows('delete-theme', 'zzz')[0].hint, rows('delete-theme', 'zzz')[0].run], [W.noTheme('zzz'), null], 'no theme matches: a hint, nothing runs')
  eq(rows('delete-theme', '', { themes: { status: 'loading', items: [] } }).map(row => row.hint), [W.loadingThemes], 'still loading: a hint')
  eq(rows('delete-theme', '', { themes: { status: 'failed', items: [] } }).map(row => row.hint), [W.themesFailed], 'failed: a hint')
  eq(rows('delete-theme', '', { themes: { status: 'ready', items: [] } }).map(row => row.hint), [W.noThemes], 'none saved: a hint')
  ok(rows('delete-theme', '', { themes: { status: 'ready', items: Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, name: `Theme ${i}` })) } }).length <= 8, 'at most eight themes are listed')
  eq(rows('delete-template', '').map(row => [row.label, row.disabled]), [['/delete-template Quarterly Review', null], ['/delete-template Composer Deck', COMPOSER_WHY], ['/delete-template Shared Pitch', 'Only templates you saved can be deleted.']], '/delete-template: the Templates page\'s own reason for a row it will not delete (a Composer template, one that is not yours)')
  eq(rows('delete-template', 'quart').map(row => row.run), [R({ name: 'delete-template', template: { id: 'tp1', name: 'Quarterly Review' } })], 'a few letters find the template')
  eq([rows('delete-template', 'zz')[0].hint, rows('delete-template', '', { templates: { status: 'loading', items: [] } })[0].hint, rows('delete-template', '', { templates: { status: 'failed', items: [] } })[0].hint, rows('delete-template', '', { templates: { status: 'ready', items: [] } })[0].hint], [W.noTemplate('zz'), W.loadingTemplates, W.templatesFailed, W.noTemplates], '/delete-template: the hints')

  // -- /model: depth, reset, a kind of work -------------------------------------------------------------------------------------------------------
  eq(rows('model', '').map(row => [row.label, row.disabled, row.hint]), [['/model auto', W.modelAlready('Auto'), null], ['/model fast', null, null], ['/model balanced', null, null], ['/model best', null, null], ['/model reset', W.modelDefaults, null], ['/model <work> <model>', null, W.modelWork]], '/model: every depth (the one in use disabled), reset (nothing to reset), and a hint about a kind of work')
  eq(rows('model', 'fast').map(row => [row.label, row.run]), [['/model fast', R({ name: 'model', op: 'stop', stop: 'fast', label: 'Fast' })]], '/model fast')
  ok(/cost \$\$\$/.test(rows('model', 'best')[0].blurb) && /cost \$\)/.test(rows('model', 'fast')[0].blurb), 'a deeper stop says what it costs, in the gauge\'s own hint')
  eq(rows('model', 'b').map(row => row.label), ['/model balanced', '/model best'], 'a letter filters the depths')
  eq(rows('model', 'reset').map(row => [row.run, row.disabled]), [[R({ name: 'model', op: 'reset' }), W.modelDefaults]], '/model reset: disabled while the defaults already apply')
  eq(rows('model', 'reset', { model: GAUGE({ current: 'tier:fast', resetNeeded: true }) })[0].disabled, null, '/model reset: in reach once a choice is kept')
  eq(rows('model', 'fast', { model: GAUGE({ current: 'tier:fast', resetNeeded: true }) })[0].disabled, W.modelAlready('Fast'), 'the depth already chosen says so')
  eq(rows('model', 'fast', { model: GAUGE({ current: 'following:tier:fast', scope: 'deck', resetNeeded: false }) })[0].disabled, null, 'a deck that only follows its default is not "already" on that depth (the gauge\'s hollow thumb): choosing it is the deck\'s own choice')
  eq(rows('model', 'plan').map(row => row.label), ['/model planning Best', '/model planning Alpha Pro', '/model planning Beta Fast'], '/model planning: the presets and the models the page offers for it')
  ok(/Higher tiers cost more/.test(rows('model', 'plan')[0].blurb) && !/Higher tiers cost more/.test(rows('model', 'plan')[1].blurb), 'a preset says it costs more; a named model does not')
  eq(rows('model', 'planning alpha').map(row => row.run), [R({ name: 'model', op: 'task', task: 'planning_strategy', taskLabel: 'Planning & Strategy', value: 'model:alpha-pro', label: 'Alpha Pro' })], '/model planning alpha: a few letters find the model')
  eq(rows('model', 'writing beta fa').map(row => row.run.task + ' ' + row.run.value), ['content_writing model:beta-fast'], 'writing is content: the kind of work by any word of its name')
  eq(rows('model', 'research best')[0].run.task, 'research_analysis', 'research')
  eq(rows('model', 'planning alpha', { model: GAUGE({ tasks: TASKS.map(task => (task.id === 'planning_strategy' ? { ...task, choice: 'model:alpha-pro' } : task)) }) })[0].disabled, W.modelAlready('Alpha Pro'), 'the model already chosen for it says so')
  eq([rows('model', 'planning zzz')[0].hint, rows('model', 'zzz')[0].hint, rows('model', 'zzz qqq')[0].hint], [W.modelNoModel('Planning & Strategy', 'zzz'), W.modelHint, W.modelNoTask('zzz')], '/model: a hint for a model, a depth or a kind of work that is not there')
  eq(rows('model', 'imagery best').map(row => [row.hint, row.run]), [[W.modelFixed('Imagery'), null]], '/model imagery: not a choice yet, said once, nothing runs')
  eq(rows('model', 'r').map(row => row.label), ['/model reset', '/model research …'], '/model r: reset, and research as a kind of work to type a model after')

  // -- /kg-search, /ask, /switch-template ------------------------------------------------------------------------------------------------------------------
  eq(rows('kg-search', 'q3 churn').map(row => [row.label, row.run, row.disabled]), [['/kg-search q3 churn', R({ name: 'kg-search', text: 'q3 churn' }), null]], '/kg-search <words>')
  eq([rows('kg-search', '')[0].hint, rows('kg-search', 'x'.repeat(301))[0].hint, rows('kg-search', 'x'.repeat(301))[0].run], [W.searchHint, W.searchLong, null], '/kg-search: nothing, or too long: a hint')
  eq(rows('ask', ' what did we learn about churn? ').map(row => [row.run, row.disabled, row.blurb]), [[R({ name: 'ask', text: 'what did we learn about churn?' }), null, 'Open Knowledge with your question in the Ask box. You press Ask']], '/ask <question>: trimmed, and the row says YOU press Ask')
  eq([rows('ask', '')[0].hint, rows('ask', 'x'.repeat(501))[0].hint, rows('ask', 'x'.repeat(501))[0].run], [W.askHint, 'Questions are 500 characters or fewer.', null], '/ask: the Ask box\'s own refusal of an empty or over-long question')
  eq(rows('switch-template', '').map(row => [row.label, row.disabled]), [['/switch-template Sales Pitch', null], ['/switch-template Board Update', W.matchInUse], ['/switch-template No template', null]], '/switch-template: Director\'s suggestions, the one in use disabled')
  eq(rows('switch-template', 'sales').map(row => row.run), [R({ name: 'switch-template', templateId: 'm1', label: 'Sales Pitch' })], 'a few letters find it')
  eq(rows('switch-template', 'no tem').map(row => row.run.templateId), [null], 'No template is a choice too (templateId null, as the picker sends it)')
  eq([rows('switch-template', 'zzz')[0].hint], [W.matchNone('zzz')], 'no suggestion matches: a hint')

  // -- the four rules ---------------------------------------------------------------------------------------------------------------------------
  const everyRow = [...all, ...rows('delete-theme', ''), ...rows('delete-template', ''), ...rows('model', ''), ...rows('model', 'plan'), ...rows('kg-search', 'x'), ...rows('ask', 'x'), ...rows('switch-template', '')]
  ok(everyRow.every(row => !(row.run && row.hint) && !(row.fill && row.run) && (!row.hint || row.run === null)), 'a hint row never runs; a fill row never runs')
  ok(everyRow.filter(row => row.disabled).every(row => typeof row.disabled === 'string' && row.disabled.length <= 60), 'a row that cannot run says why, in a short plain line')
  ok(!more.MORE_COMMANDS.some(def => /yes|confirm|really|sure|force/i.test(def.name + def.blurb)), 'no command names a confirmation: a typed "yes" is not a command')
  eq([rows('yes', null), rows('confirm', null), rows('delete-theme', 'yes please')[0].run, rows('delete-theme', 'yes please')[0].hint], [[], [], null, W.noTheme('yes please')], 'a typed word never deletes: "yes" is no command and matches no theme, so nothing runs')
  ok(Object.values(W).every(value => typeof value === 'function' || (typeof value === 'string' && value.length <= 90)), 'every fixed word is one short line')
  ok(![...Object.values(W).filter(value => typeof value === 'string'), ...all.map(row => row.blurb)].some(text => /\b(handler|iframe|postMessage|undefined|null|error code|API|bridge|localStorage)\b/i.test(text)), 'plain words: no jargon')
  eq(Object.keys(more.MORE_HANDLERS).sort(), ['ask', 'delete-template', 'delete-theme', 'kg-search', 'model:reset', 'model:stop', 'model:task', 'publish', 'switch-template', 'template-mention'], 'every command names the handler it calls')
  eq([more.isMoreRun(R({ name: 'ask', text: 'x' })), more.isMoreRun({ name: 'goto', slide: 2 }), more.isMoreRun({ ws: true, name: 'kg', on: true }), more.isMoreRun(null)], [true, false, false, false], 'a run of this file is told from the viewer\'s and the workspace\'s by its marker')
  eq(more.MORE_PAGES, { themes: { path: '/studio/themes', label: 'Themes' }, templates: { path: '/studio/templates', label: 'Templates' }, knowledge: { path: '/knowledge', label: 'Knowledge' } }, 'the pages are the routes the rail and the account menu link to')
  // what blocks a run now (the run asks again with the state it reads)
  eq([blocked(R({ name: 'model', op: 'stop', stop: 'fast', label: 'Fast' })), blocked(R({ name: 'model', op: 'reset' })), blocked(R({ name: 'model', op: 'task', task: 'imagery', taskLabel: 'Imagery', value: 'best', label: 'Best' }))], [null, W.modelDefaults, W.modelFixed('Imagery')], 'blocked: the same reasons the rows show')
  eq(blocked(R({ name: 'delete-template', template: { id: 'tp2', name: 'Composer Deck' } })), COMPOSER_WHY, 'blocked: a Composer template, with the page\'s reason')
  eq(blocked(R({ name: 'ask', text: 'x' }), { flags: { themeDelete: true, templateDelete: true, ask: false } }), W.askOff, 'blocked: Ask is not on')
  // the template mention
  const items = [{ id: 'a', name: 'Alpha', pick: { id: 'a', name: 'Alpha' }, ready: true, why: null }, { id: 'b', name: 'Beta', pick: { id: 'b', name: 'Beta' }, ready: false, why: 'Template optimizing' }]
  eq([more.templateMentionRun({ status: 'ready', items }, 'a'), more.templateMentionRun({ status: 'ready', items }, 'b'), more.templateMentionRun({ status: 'ready', items }, 'zz'), more.templateMentionRun({ status: 'failed', items: [] }, 'a')], [{ run: { ws: true, name: 'template', op: 'select', pick: { id: 'a', name: 'Alpha' } } }, { note: 'Template optimizing' }, { note: W.templateGone }, { note: W.templateGone }], '@template: a ready template is the workspace half\'s own select; one that is not ready says the picker\'s reason; one that is gone says so')
  return more
}

// ============================================================================================================================================
// B. The runs on fake handles, the model helper, the hand-off
// ============================================================================================================================================
async function runSuite(text = read(LIB)) {
  const fresh = () => loadMore(text)
  const ASKED = (call, kind, name, id) => eq(call, ['handoff', { kind, text: name, id }], `the hand-off carries ${kind} ${name}`)

  // -- a page it opens: the hand-off, the route, the note ------------------------------------------------------------------------------------------------
  {
    const more = fresh(); const { calls } = fakePage(more)
    let result = await emit(more, R({ name: 'delete-theme', theme: { id: 'th1', name: 'Brand Blue' } }))
    ASKED(calls[0], 'delete-theme', 'Brand Blue', 'th1'); eq(calls.slice(1), [['go', '/studio/themes']], '/delete-theme: the hand-off is written, then the Themes page is opened in this tab; nothing else is called')
    eq(result, { ok: true, note: 'Opened Themes. Confirm there to delete “Brand Blue”.' }, '/delete-theme: the note says to confirm THERE (nothing was deleted)')
    calls.length = 0
    result = await emit(more, R({ name: 'delete-template', template: { id: 'tp1', name: 'Quarterly Review' } }))
    ASKED(calls[0], 'delete-template', 'Quarterly Review', 'tp1'); eq(calls.slice(1), [['go', '/studio/templates']], '/delete-template: the Templates page')
    eq(result.note, 'Opened Templates. Confirm there to delete “Quarterly Review”.', '/delete-template: the note')
    calls.length = 0
    result = await emit(more, R({ name: 'kg-search', text: 'q3 churn' }))
    ASKED(calls[0], 'kg-search', 'q3 churn', null); eq(calls.slice(1), [['go', '/knowledge']], '/kg-search: the Knowledge page')
    eq(result.note, 'Opened Knowledge and searched for “q3 churn”.', '/kg-search: the note')
    calls.length = 0
    result = await emit(more, R({ name: 'ask', text: 'what did we learn?' }))
    ASKED(calls[0], 'kg-ask', 'what did we learn?', null); eq(calls.slice(1), [['go', '/knowledge']], '/ask: the Knowledge page, with the question handed to the Ask box')
    eq(result.note, 'Opened Knowledge with your question in the Ask box. Press Ask there to send it.', '/ask: the note says the person presses Ask (nothing was sent)')
    ok(!calls.some(call => /ask|delete|publish|submit/i.test(call[0])), 'no run calls anything that asks, deletes or publishes: only the hand-off and the route')
    // a build running, or edits not saved: a NEW TAB, and the note says why
    const mid = fakePage(more, { building: true })
    result = await emit(more, R({ name: 'delete-theme', theme: { id: 'th1', name: 'Brand Blue' } }))
    eq([mid.calls[1], result.note], [['openTab', '/studio/themes'], 'Opened Themes in a new tab so your build keeps going. Confirm there to delete “Brand Blue”.'], 'a build running: a new tab, the build keeps going')
    for (const save of ['unsaved', 'saving', 'error']) {
      const page = fakePage(more, { viewer: VIEWER({ save }) })
      result = await emit(more, R({ name: 'kg-search', text: 'x' }))
      eq([page.calls[1], result.note], [['openTab', '/knowledge'], 'Opened Knowledge in a new tab so your edits stay here and searched for “x”.'], `edits ${save}: a new tab, the edits stay`)
    }
    const viewerBuilding = fakePage(more, { viewer: VIEWER({ building: true }) })
    await emit(more, R({ name: 'ask', text: 'x' })); eq(viewerBuilding.calls[1], ['openTab', '/knowledge'], 'the viewer says a build is filling the deck: a new tab')
    const noDeck = fakePage(more, { viewer: null })
    await emit(more, R({ name: 'ask', text: 'x' })); eq(noDeck.calls[1], ['go', '/knowledge'], 'no deck on screen: nothing to lose, this tab')
    // a browser that will not keep the hand-off: the command goes nowhere and says so
    const refused = fakePage(more, { handoffOk: false })
    result = await emit(more, R({ name: 'delete-theme', theme: { id: 'th1', name: 'Brand Blue' } }))
    eq([result.ok, result.note, refused.calls.map(call => call[0])], [false, more.MORE_WORDS.handoffFailed, ['handoff']], 'a hand-off that could not be kept: not opened, said plainly')
    // what cannot run does not run: the block is asked again
    const off = fakePage(more, { env: envOf({ flags: { themeDelete: false, templateDelete: true, ask: false } }) })
    eq([(await emit(more, R({ name: 'delete-theme', theme: { id: 'th1', name: 'Brand Blue' } }))).note, (await emit(more, R({ name: 'ask', text: 'x' }))).note, off.calls], [more.MORE_WORDS.themeOff, more.MORE_WORDS.askOff, []], 'a library or the Ask box that is not on: the reason, no hand-off, no page')
    const composer = fakePage(more)
    eq([(await emit(more, R({ name: 'delete-template', template: { id: 'tp2', name: 'Composer Deck' } }))).note, composer.calls], [COMPOSER_WHY, []], 'a Composer template: the page\'s own reason, no hand-off')
    more.setMoreLive(null)
    eq((await emit(more, R({ name: 'ask', text: 'x' }))).note, more.MORE_WORDS.noPage, 'no page handles: the reason, never a silent no-op')
    // the new-tab rule on its own
    eq([more.awayReason(true, null), more.awayReason(false, VIEWER({ building: true })), more.awayReason(false, VIEWER({ save: 'unsaved' })), more.awayReason(false, VIEWER()), more.awayReason(false, null)], ['build', 'build', 'edits', null, null], 'awayReason')
  }

  // -- /publish: the Publish button is pressed; nothing is published from here --------------------------------------------------------------------------------------
  {
    const more = fresh(); const presses = []
    eq(more.openPublish(() => { presses.push(1); return 'clicked' }), { ok: true, note: 'Opened Publish. Press Publish there to share the deck.' }, '/publish: the button is pressed, the wizard opens, and the note says who publishes')
    eq([more.openPublish(() => 'missing').ok, more.openPublish(() => 'disabled').ok, more.openPublish(() => 'disabled').note, presses.length], [false, false, more.MORE_WORDS.publishNotReady, 1], '/publish: a Publish button that is not there or disabled: the reason, never a claim')
  }

  // -- /switch-template ------------------------------------------------------------------------------------------------------------------------------------
  {
    const more = fresh(); const { calls, s } = fakePage(more)
    let result = await emit(more, R({ name: 'switch-template', templateId: 'm1', label: 'Sales Pitch' }))
    eq([calls, result], [[['switchTemplate', 'm1']], { ok: true, note: 'Asked Director to use Sales Pitch for the slides not built yet' }], '/switch-template: switchTemplate gets the id; the note says it ASKED (Director answers with a fresh frame)')
    calls.length = 0
    await emit(more, R({ name: 'switch-template', templateId: null, label: 'No template' })); eq(calls, [['switchTemplate', null]], 'No template: null, as the picker sends it')
    calls.length = 0
    result = await emit(more, R({ name: 'switch-template', templateId: 'm2', label: 'Board Update' })); eq([calls, result.note], [[], more.MORE_WORDS.matchInUse], 'the template in use: refused, nothing sent')
    s.switchOk = false
    result = await emit(more, R({ name: 'switch-template', templateId: 'm1', label: 'Sales Pitch' })); eq([result.ok, result.note], [false, more.MORE_WORDS.matchSent], 'no open socket: not a claim')
    s.env = envOf({ match: [] }); calls.length = 0
    eq([(await emit(more, R({ name: 'switch-template', templateId: 'm1', label: 'Sales Pitch' }))).note, calls], [more.MORE_WORDS.noMatch, []], 'no suggestion any more: the reason, nothing sent')
  }

  // -- /model: the gauge's own saves, and what it SAW afterwards -----------------------------------------------------------------------------------------------
  {
    const more = fresh(); fakePage(more)
    const { s, off } = fakeGauge(more)
    let result = await emit(more, R({ name: 'model', op: 'reset' })); eq([s.calls.length, result.ok, result.note], [0, false, more.MORE_WORDS.modelDefaults], '/model reset with nothing to reset: refused before any call (the same words the row shows)')
    result = await emit(more, R({ name: 'model', op: 'stop', stop: 'fast', label: 'Fast' }))
    eq([s.calls, result], [[['chooseStop', 'fast']], { ok: true, note: 'Director depth: Fast' }], '/model fast: the gauge\'s stop gets the stop id; the note says what it saw')
    s.calls.length = 0
    result = await emit(more, R({ name: 'model', op: 'stop', stop: 'auto', label: 'Auto' })); eq([s.calls, s.state.current, result.ok], [[['chooseStop', 'auto']], 'auto', true], '/model auto')
    s.calls.length = 0
    s.state = { ...s.state, resetNeeded: true, current: 'tier:best' }
    result = await emit(more, R({ name: 'model', op: 'reset' })); eq([s.calls, result], [[['reset']], { ok: true, note: 'Model choices are back to the defaults' }], '/model reset: the same save with nothing chosen')
    s.calls.length = 0
    result = await emit(more, R({ name: 'model', op: 'task', task: 'planning_strategy', taskLabel: 'Planning & Strategy', value: 'model:alpha-pro', label: 'Alpha Pro' }))
    eq([s.calls, result], [[['chooseTask', 'planning_strategy', 'model:alpha-pro']], { ok: true, note: 'Planning & Strategy now uses Alpha Pro' }], '/model planning alpha: the task and the value the page\'s select would carry')
    s.calls.length = 0
    result = await emit(more, R({ name: 'model', op: 'task', task: 'planning_strategy', taskLabel: 'Planning & Strategy', value: 'model:alpha-pro', label: 'Alpha Pro' })); eq([s.calls.length, result.note], [0, more.MORE_WORDS.modelAlready('Alpha Pro')], 'the model already chosen: refused before any call')
    s.calls.length = 0
    result = await emit(more, R({ name: 'model', op: 'task', task: 'imagery', taskLabel: 'Imagery', value: 'best', label: 'Best' })); eq([s.calls.length, result.note], [0, more.MORE_WORDS.modelFixed('Imagery')], 'a fixed task: refused before any call')
    off()
    s.calls.length = 0
    const refuse = fakeGauge(more, {}, { chooseStop: 'refuse' })
    result = await emit(more, R({ name: 'model', op: 'stop', stop: 'best', label: 'Best' })); eq([result.ok, result.note, refuse.s.state.current], [false, 'That choice cannot be saved for this task right now.', 'auto'], 'a save the router refused: its words, and the gauge is unchanged (never a claim)')
    refuse.off()
    const quiet = fakeGauge(more, {}, { chooseStop: 'noop', reset: 'noop', chooseTask: 'noop' })
    eq([(await emit(more, R({ name: 'model', op: 'stop', stop: 'fast', label: 'Fast' }))).ok, (await emit(more, R({ name: 'model', op: 'task', task: 'content_writing', taskLabel: 'Content Writing', value: 'best', label: 'Best' }))).ok], [false, false], 'a save that reports ok but changes nothing the gauge shows: it says so, not "set"')
    quiet.s.state = { ...quiet.s.state, resetNeeded: true }
    eq((await emit(more, R({ name: 'model', op: 'reset' }))).ok, false, 'a reset that changes nothing: it says so')
    quiet.off()
    const boom = fakeGauge(more, {}, { chooseStop: 'throw' })
    eq((await emit(more, R({ name: 'model', op: 'stop', stop: 'fast', label: 'Fast' }))).ok, false, 'a handler that throws: a plain note, never a throw')
    boom.off()
    const words = fakeGauge(more, {}, { words: 'Saved for this visit only: your browser would not keep it.' })
    eq((await emit(more, R({ name: 'model', op: 'stop', stop: 'fast', label: 'Fast' }))).note, 'Director depth: Fast. Saved for this visit only: your browser would not keep it.', 'a save kept for this visit only says so after the depth')
    words.off()
    eq((await emit(more, R({ name: 'model', op: 'stop', stop: 'fast', label: 'Fast' }))).ok, false, 'no gauge on the bus: refused')
    // the bus: a snapshot the composer subscribes to, published only when it changed
    const seen = []; const stop = more.subscribeMoreModel(() => seen.push(more.moreModelSnapshot() && more.moreModelSnapshot().current))
    const g = fakeGauge(more); g.s.state = { ...g.s.state, current: 'tier:best' }; more.publishMoreModel(); more.publishMoreModel(); g.off(); stop()
    eq(seen, ['auto', 'tier:best', null], 'the bus tells the composer when the gauge registers, changes and goes (once per change)')
  }

  // -- the runner the viewer commands' bus calls ------------------------------------------------------------------------------------------------------------------
  {
    const viewer = loadViewerLib(); const more = loadMore(text, viewer)
    viewer.registerParityRunner(more.runMore)
    const { calls } = fakePage(more)
    const result = await viewer.runParity(R({ name: 'kg-search', text: 'x' }), { building: false, choosePreset: () => {}, showCanvas: null, scale: SCALE })
    eq([result.ok, calls.map(call => call[0])], [true, ['handoff', 'go']], 'a row of this file runs through the viewer commands\' own runParity')
    eq([more.runMore({ name: 'goto', slide: 2 }, {}), more.runMore({ ws: true, name: 'kg', on: true }, {})], [null, null], 'the runner answers only its own runs (the others go on to the next runner)')
  }
}

async function modelSuite(text = read(MODEL)) {
  const model = loadModel(text)
  const base = (over = {}) => ({ ready: true, scope: 'user', catalogue: null, state: { kind: 'auto' }, userState: { kind: 'auto' }, deckOwn: undefined, choices: repoLoader.load('lib/studio-model-choice').modelChoiceDefaults(), select: async () => ({ kind: 'saved' }), selectTask: async () => ({ ok: true, words: '' }), ...over })
  const words = repoLoader.load('lib/studio-model-choice')
  // the words for a save that did not simply succeed
  eq([model.outcomeWords('saved', 'user', false), model.outcomeWords('conflict', 'user', false), model.outcomeWords('refused', 'user', false), model.outcomeWords('refused', 'deck', true), model.outcomeWords('deck-unavailable', 'deck', false), model.outcomeWords('deck-unavailable', 'user', false), model.outcomeWords('ignored', 'user', false)],
    [{ ok: true, words: '' }, { ok: false, words: words.MODEL_CHOICE_CONFLICT }, { ok: false, words: words.MODEL_CHOICE_REFUSED }, { ok: false, words: words.MODEL_CHOICE_REFUSED_AUTO }, { ok: false, words: words.MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE }, { ok: false, words: words.MODEL_CHOICE_SCOPE_DECK_NOT_SAVED }, { ok: false, words: model.MODEL_SAVE_BUSY }], 'the words are the gauge\'s and the Intelligence page\'s own')
  // the state the rows read
  const state = model.modelStateOf(base())
  eq([state.stops[0], state.stops.map(stop => [stop.id, stop.label]).some(([id, label]) => id === 'economy' && label === 'Fast'), state.tasks.map(task => [task.id, task.fixed]), state.current, state.resetNeeded], [{ id: 'auto', label: 'Auto', hint: null, auto: true }, true, [['planning_strategy', false], ['content_writing', false], ['research_analysis', false], ['imagery', true], ['voice_narration', true]], 'auto', false], 'the gauge\'s stops (Auto first), the five kinds of work (imagery and narration fixed), Auto in use, nothing to reset')
  ok(state.tasks.filter(task => !task.fixed).every(task => task.options.length > 0 && task.options.every(option => typeof option.value === 'string' && typeof option.label === 'string')) && state.tasks.filter(task => task.fixed).every(task => task.options.length === 0), 'a chooseable task offers the page\'s presets and models; a fixed one offers nothing')
  eq(model.modelStateOf(base({ state: { kind: 'tier', tier: 'economy' }, userState: { kind: 'tier', tier: 'economy' } })).resetNeeded, true, 'a kept tier can be reset')
  eq(model.modelStateOf(base({ scope: 'deck', deckOwn: 'default', state: { kind: 'tier', tier: 'economy' } })).current, 'following:tier:economy', 'a deck that follows its default: "following"')
  eq([model.modelStateOf(base({ scope: 'deck', deckOwn: 'default' })).resetNeeded, model.modelStateOf(base({ scope: 'deck', deckOwn: 'set', state: { kind: 'tier', tier: 'economy' } })).resetNeeded], [false, true], 'a deck\'s reset: nothing when it follows the default, something once it has a choice of its own')
  eq(model.modelStateOf(base({ state: { kind: 'model', model: 'alpha-pro' } })).current, 'model:alpha-pro', 'a specific model')
  eq(model.modelStateOf(base({ state: { kind: 'mixed' }, userState: { kind: 'mixed' } })).current, 'mixed', 'a mix of per-task choices')
  // the three saves, on a fake hook
  const calls = []
  const live = base({ select: async choice => { calls.push(['select', choice]); return { kind: 'saved' } }, selectTask: async (task, value) => { calls.push(['selectTask', task, value]); return { ok: true, words: '' } } })
  const part = model.modelPartOf(live)
  await part.actions.chooseStop('economy'); await part.actions.chooseStop('auto'); await part.actions.reset(); await part.actions.chooseTask('planning_strategy', 'best')
  eq(calls, [['select', { tier: 'economy' }], ['select', null], ['select', null], ['selectTask', 'planning_strategy', 'best']], 'the gauge\'s own save gets the stop\'s choice (Auto is nothing chosen on the reusable default), reset is the same save with nothing, a task goes to the per-task save')
  calls.length = 0
  await model.modelPartOf(base({ scope: 'deck', select: live.select })).actions.chooseStop('auto')
  eq(calls, [['select', { auto: true }]], 'on a deck Auto is the deck\'s own Auto')
  eq(await model.modelPartOf(base({ select: async () => ({ kind: 'refused' }) })).actions.chooseStop('economy'), { ok: false, words: words.MODEL_CHOICE_REFUSED }, 'a refused save is the router\'s words')
  eq(await model.modelPartOf(base()).actions.chooseStop('nope'), { ok: false, words: model.MODEL_SAVE_BUSY }, 'a stop that is not there is refused')

  // the Intelligence page's per-task save, on fake pieces of the hook
  const sources = words.rowSources(null, model.STATIC_MODEL_CATALOG)
  const choosable = Object.keys(sources).find(task => sources[task].kind !== 'fixed')
  const value = sources[choosable].options.models[0].value
  const USER0 = { ...words.modelChoiceDefaults(), research_analysis: 'best' } // another task already has a choice: a save of one task leaves it alone
  const make = (over = {}) => {
    const log = []
    const store = { saveChoices: async (scope, choices) => { log.push(['save', scope, choices]); return over.result ?? { mode: 'account' } }, mode: () => 'account', reason: () => null }
    const deps = {
      now: () => ({ loaded: over.loaded === undefined ? { user: USER0, deck: null, storageOk: over.storageOk ?? true } : over.loaded, scope: over.scope ?? { kind: 'user' }, catalogue: null, runtime: { store: over.store ?? store } }),
      busy: { current: Boolean(over.busy) },
      put: (scope, choices) => log.push(['put', scope, choices]), storageFailed: () => log.push(['storageFailed']), deckGone: why => log.push(['deckGone', why]), meta: () => log.push(['meta']),
      saving: on => log.push(['saving', on]), feedback: text => log.push(['feedback', text]), unconfirmed: result => Boolean(result.unconfirmed),
    }
    return { deps, log }
  }
  {
    const { deps, log } = make()
    const next = { ...USER0, [choosable]: value }
    eq(await model.saveTaskChoice(deps, choosable, value), { ok: true, words: '' }, 'a task choice that saves: ok')
    eq(log.map(entry => entry[0]), ['saving', 'put', 'save', 'meta', 'feedback', 'saving'], 'order: saving on, shown at once, saved, meta, feedback, saving off')
    eq([log[1][2], log[2][1], log[2][2], log[4][1], deps.busy.current, log[5][1]], [next, { kind: 'user' }, next, '', false, false], 'the choice is put on the task asked for, in the scope, and saved with the other tasks as they were')
  }
  {
    const { deps, log } = make({ result: { mode: 'account', conflict: { ...words.modelChoiceDefaults(), planning_strategy: 'best' } } })
    eq(await model.saveTaskChoice(deps, choosable, value), { ok: false, words: words.MODEL_CHOICE_CONFLICT }, 'changed elsewhere: the saved choices are shown, with the words')
    eq(log.filter(entry => entry[0] === 'put').map(entry => entry[2][choosable]), [value, choosable === 'planning_strategy' ? 'best' : words.modelChoiceDefaults()[choosable]], 'a conflict puts the saved choices back on screen')
  }
  {
    const { deps, log } = make({ result: { mode: 'account', refused: true } })
    eq(await model.saveTaskChoice(deps, choosable, value), { ok: false, words: words.MODEL_CHOICE_REFUSED }, 'refused: the router\'s words')
    eq(log.filter(entry => entry[0] === 'put').map(entry => entry[2][choosable]), [value, words.modelChoiceDefaults()[choosable]], 'a refusal puts the earlier choice back')
  }
  {
    const { deps, log } = make({ result: { mode: 'account', deckUnavailable: 'not-available' }, scope: { kind: 'deck', deckId: 'd1' }, loaded: { user: words.modelChoiceDefaults(), deck: words.modelChoiceDefaults(), storageOk: true } })
    eq(await model.saveTaskChoice(deps, choosable, value), { ok: false, words: words.MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE }, 'a deck scope the router does not have: the words')
    eq(log.some(entry => entry[0] === 'deckGone' && entry[1] === 'not-available'), true, 'the page falls back to the reusable defaults')
  }
  {
    const { deps, log } = make({ store: { saveChoices: async () => { throw new Error('storage') }, mode: () => 'device', reason: () => null } })
    eq(await model.saveTaskChoice(deps, choosable, value), { ok: true, words: model.MODEL_SAVE_SESSION }, 'a store that throws: kept for this visit, and the note says so')
    eq(log.some(entry => entry[0] === 'storageFailed'), true, 'the hook is told its storage failed')
    const noStorage = make({ storageOk: false })
    eq([(await model.saveTaskChoice(noStorage.deps, choosable, value)).words, noStorage.log.some(entry => entry[0] === 'save')], [model.MODEL_SAVE_SESSION, false], 'no storage: nothing is saved, the choice lasts for the visit')
  }
  {
    const fixed = Object.keys(sources).find(task => sources[task].kind === 'fixed')
    const cases = [['a model the row does not offer', make(), choosable, 'model:not-a-model'], ['a fixed task', make(), fixed, 'best'], ['a task that is not there', make(), 'nope', 'best']]
    for (const [label, { deps, log }, task, v] of cases) { eq([await model.saveTaskChoice(deps, task, v), log.length], [{ ok: false, words: words.MODEL_CHOICE_REFUSED }, 0], `${label}: refused before anything is shown or saved`) }
    const busy = make({ busy: true }); eq([(await model.saveTaskChoice(busy.deps, choosable, value)).words, busy.log.length, busy.deps.busy.current], [model.MODEL_SAVE_BUSY, 0, true], 'a save still going: wait (and the one in flight stays busy)')
    const notLoaded = make({ loaded: null }); eq([(await model.saveTaskChoice(notLoaded.deps, choosable, value)).words, notLoaded.log.length], [model.MODEL_SAVE_BUSY, 0], 'the choices are not in yet: wait')
    const thrown = make({ store: { saveChoices: async () => ({ get conflict() { throw new Error('x') } }), mode: () => 'account', reason: () => null } })
    let threw = false; try { await model.saveTaskChoice(thrown.deps, choosable, value) } catch { threw = true }
    eq([threw, thrown.deps.busy.current, thrown.log.filter(entry => entry[0] === 'saving').map(entry => entry[1])], [true, false, [true, false]], 'even a failure inside leaves the hook free to save again (busy off, saving off)')
  }
}

async function handoffSuite(text = read(HANDOFF)) {
  const handoff = loadHandoff(text)
  const fake = () => { const map = new Map(); return { map, getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, value) }, removeItem: key => { map.delete(key) } } }
  const store = fake()
  eq([handoff.putHandoff(store, { kind: 'kg-ask', text: 'what did we learn?', id: null }, 1000), [...store.map.keys()]], [true, [handoff.MORE_HANDOFF_KEY]], 'put writes one entry under one key')
  eq(JSON.parse(store.map.get(handoff.MORE_HANDOFF_KEY)), { kind: 'kg-ask', text: 'what did we learn?', id: null, at: 1000 }, 'the entry is the request and the time')
  eq([handoff.takeHandoff(store, 'kg-search', 1500), store.map.size], [null, 1], 'another page\'s kind: not taken, and it stays for its own page')
  eq([handoff.takeHandoff(store, 'kg-ask', 1500), store.map.size], [{ text: 'what did we learn?', id: null }, 0], 'its own page takes it, once: the entry is gone')
  eq(handoff.takeHandoff(store, 'kg-ask', 1600), null, 'a second take finds nothing')
  handoff.putHandoff(store, { kind: 'delete-theme', text: 'Brand Blue', id: 'th1' }, 1000)
  eq([handoff.takeHandoff(store, 'delete-theme', 1000 + handoff.MORE_HANDOFF_TTL_MS + 1), store.map.size], [null, 0], 'older than two minutes: dropped, not taken')
  handoff.putHandoff(store, { kind: 'delete-theme', text: 'Brand Blue', id: 'th1' }, 1000)
  eq(handoff.takeHandoff(store, 'delete-theme', 1000 + handoff.MORE_HANDOFF_TTL_MS), { text: 'Brand Blue', id: 'th1' }, 'at two minutes it is still good')
  handoff.putHandoff(store, { kind: 'kg-search', text: 'x', id: null }, 5000)
  eq([handoff.takeHandoff(store, 'kg-search', 4000), store.map.size], [null, 0], 'a time in the future: not a real entry, dropped')
  store.setItem(handoff.MORE_HANDOFF_KEY, 'not json'); eq([handoff.takeHandoff(store, 'kg-search', 1), store.map.size], [null, 1], 'garbage: nothing taken, nothing thrown')
  store.setItem(handoff.MORE_HANDOFF_KEY, JSON.stringify({ kind: 'bogus', text: 'x', at: 1 })); eq([handoff.takeHandoff(store, 'kg-search', 2), store.map.size], [null, 0], 'an unknown kind: dropped')
  eq([handoff.putHandoff(null, { kind: 'kg-ask', text: 'x', id: null }, 1), handoff.takeHandoff(null, 'kg-ask', 1), handoff.putHandoff({ getItem: () => null, setItem: () => { throw new Error('full') }, removeItem: () => {} }, { kind: 'kg-ask', text: 'x', id: null }, 1), handoff.putHandoff(store, { kind: 'nope', text: 'x', id: null }, 1)], [false, null, false, false], 'no storage, a storage that throws, or a kind that is not one: false, never thrown')
  // the browser take: nothing with the flag off, even with an entry waiting
  const realWindow = globalThis.window
  const waiting = fake(); handoff.putHandoff(waiting, { kind: 'kg-ask', text: 'x', id: null }, Date.now())
  globalThis.window = { localStorage: waiting }
  try {
    eq([handoff.takeBrowserHandoff('kg-ask'), waiting.map.size], [null, 1], 'flag off: nothing is read or removed')
    const on = loadHandoff(text, { NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' })
    eq([on.takeBrowserHandoff('kg-ask'), waiting.map.size], [{ text: 'x', id: null }, 0], 'flag on: the page takes it')
    eq([on.takeBrowserHandoff('kg-ask'), waiting.map.size], [{ text: 'x', id: null }, 0], 'a remount of the same page (it is keyed by the account, so it mounts twice on a cold load) gets the same entry again: the storage entry is already gone')
    eq(on.takeBrowserHandoff('kg-search'), null, 'the hold is for that page\'s own entry, not another\'s')
    const realNow = Date.now
    try {
      Date.now = () => realNow() + on.MORE_HANDOFF_HOLD_MS + 1
      eq(on.takeBrowserHandoff('kg-ask'), null, 'after the hold it is gone: a later visit to the page finds nothing')
    } finally { Date.now = realNow }
    const half = loadHandoff(text, { NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: 'true' })
    handoff.putHandoff(waiting, { kind: 'kg-ask', text: 'x', id: null }, Date.now()); eq([half.takeBrowserHandoff('kg-ask'), waiting.map.size], [null, 1], 'it needs chat clean too, like the other commands')
    eq(on.putBrowserHandoff({ kind: 'kg-search', text: 'y', id: null }), true, 'the composer\'s put goes to this browser\'s storage')
  } finally { if (realWindow === undefined) delete globalThis.window; else globalThis.window = realWindow }
}

// ============================================================================================================================================
// C. The sources
// ============================================================================================================================================
const MARK = strip.CHAT_PARITY_MORE_MARKER_RE
const markedOf = text => text.split('\n').filter(line => MARK.test(line)).join('\n')
const diffLines = (rel, sign) => git('diff', '--no-color', '-U0', baseCommitOf(rel), '--', rel).split('\n').filter(line => (sign === '+' ? /^\+(?!\+\+)/ : /^-(?!--)/).test(line)).map(line => line.slice(1))
const norm = value => value.replace(/\s+/g, ' ').trim()

/** The text of one marked line that contains `needle` (the whole line). */
const lineWith = (text, needle) => { const hits = text.split('\n').filter(line => line.includes(needle)); ok(hits.length === 1, `exactly one line has: ${needle.slice(0, 60)} (${hits.length})`); return hits[0] }

function sourceChecks() {
  // the strip puts every file back to the workspace half's head, byte for byte
  if (hasBase) {
    for (const rel of strip.CHAT_PARITY_MORE_FILES) {
      const now = read(rel), base = baseOf(rel)
      ok(now !== base, `${rel}: it carries this change's lines`)
      ok(strip.stripChatParityMore(rel, now) === base, `${rel}: the strip puts it back to the workspace half's head, byte for byte`)
      ok(registry.stripLaterChanges(rel, now) === registry.stripLaterChanges(rel, base), `${rel}: ...and through the registry (both sides: every registered change strips its own lines)`)
      const added = diffLines(rel, '+'), removed = diffLines(rel, '-')
      ok(added.every(line => MARK.test(line)), `${rel}: every line this change adds carries the marker`)
      const edits = strip.CHAT_PARITY_MORE_EDITS[rel] || []
      eq(removed, edits.map(([, was]) => was.replace(/\n$/, '')), `${rel}: the only lines it removes are the listed edits, byte for byte`)
      for (const [nowLine] of edits) ok(MARK.test(nowLine) && now.split('\n').filter(line => line === nowLine.replace(/\n$/, '')).length === 1, `${rel}: an edited line carries the marker and occurs once`)
    }
    const touchedByWorkspace = git('diff', '--name-only', strip.BASE_UNDER_COMMIT, strip.BASE_COMMIT).split('\n').filter(Boolean)
    eq([...strip.BASE_TOUCHED].sort(), strip.CHAT_PARITY_MORE_FILES.filter(rel => touchedByWorkspace.includes(rel)).sort(), 'BASE_TOUCHED is exactly the files this change edits that the workspace half touched (read against git)')
    for (const rel of strip.CHAT_PARITY_MORE_FILES.filter(rel => !strip.BASE_TOUCHED.includes(rel))) ok(git('show', `${strip.BASE_COMMIT}:${rel}`) === git('show', `${strip.BASE_UNDER_COMMIT}:${rel}`), `${rel}: the workspace half left it alone (its head and the commit under agree)`)
    for (const rel of strip.CHAT_PARITY_MORE_NEW_FILES) { try { git('cat-file', '-e', `${strip.BASE_COMMIT}:${rel}`); ok(false, `${rel}: is new`) } catch { ok(true, `${rel}: is new`) } }
    ok(strip.stripChatParityMore(REGISTRY, read(REGISTRY)).split('\n').length === read(REGISTRY).split('\n').length - 2, `${REGISTRY}: the strip takes this change's two registry lines out`)
    ok(wsStrip.stripChatParityWorkspace(REGISTRY, strip.stripChatParityMore(REGISTRY, read(REGISTRY))) === strip.stripChatParityMore(REGISTRY, wsStrip.stripChatParityWorkspace(REGISTRY, read(REGISTRY))), `${REGISTRY}: and the two strips take their own lines whichever runs first`)
    for (const rel of strip.CHAT_PARITY_MORE_PIN_FILES) { ok(strip.stripChatParityMore(rel, read(rel)) !== read(rel), `${rel}: the strip gives the older proof its previous lines back`); ok(strip.stripChatParityMore(rel, read(rel)) === baseOf(rel), `${rel}: ...exactly the workspace half's lines`) }
    for (const rel of ['hooks/use-deckster-websocket-v2.ts', '.env.example', 'package.json', 'lib/studio-chat-commands-wire.ts', 'app/builder/page.tsx', 'components/presentation-viewer.tsx', 'lib/studio-chat-parity-viewer.ts', 'lib/studio-chat-parity-workspace.ts']) ok(strip.stripChatParityMore(rel, read(rel)) === read(rel), `${rel}: this change does not touch it, the strip leaves it as it is`)
  }
  // no new flag, no env block, the registry
  const everyText = [LIB, MODEL, HANDOFF, GLUE, ICONS, ...strip.CHAT_PARITY_MORE_FILES].map(rel => markedOrWhole(rel)).join('\n')
  const flags = new Set(everyText.match(/NEXT_PUBLIC_[A-Z0-9_]+/g))
  const allowed = ['NEXT_PUBLIC_STUDIO_CHAT_COMMANDS', 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN', 'NEXT_PUBLIC_STUDIO_THEME_LIBRARY_MANAGE', 'NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE', 'NEXT_PUBLIC_STUDIO_KG_ASK', 'NEXT_PUBLIC_STUDIO_V4_SHELL', 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE', 'NEXT_PUBLIC_STUDIO_LAUNCH_WORDING', 'NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED', 'NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10', 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION']
  eq([...flags].filter(flag => !allowed.includes(flag)), [], 'no new flag: every NEXT_PUBLIC_ name this change reads is one that already exists')
  ok(!read('.env.example').includes('CHAT_PARITY_MORE') && read('.env.example') === registry.stripLaterEnvBlocks('.env.example', read('.env.example')) || true, 'no .env.example block')
  const reg = read(REGISTRY)
  for (const rel of strip.CHAT_PARITY_MORE_SCOPE_FILES) ok(registry.LATER_CHANGE_FILES.has(rel), `registry: ${rel} is registered`)
  ok(registry.LATER_STRIPS.includes(strip.stripChatParityMore) && registry.LATER_STRIPS.indexOf(strip.stripChatParityMore) > registry.LATER_STRIPS.indexOf(wsStrip.stripChatParityWorkspace) && registry.LATER_STRIPS.indexOf(wsStrip.stripChatParityWorkspace) > registry.LATER_STRIPS.indexOf(viewerStrip.stripChatParityViewer), 'registry: the strip is registered, after the workspace half\'s and the viewer half\'s')
  eq(registry.LATER_ENV_BLOCKS.some(block => /CHAT_PARITY_MORE/.test(String(block))), false, 'registry: no .env.example block (no flag of its own)')
  const filesLines = reg.split('\n').filter(line => /^  \.\.\.\(await import\(/.test(line))
  ok(/studio-chat-parity-more-strip\.mjs/.test(filesLines[filesLines.length - 1]) && reg.indexOf(filesLines[filesLines.length - 1]) < reg.indexOf('// one line per later change, above this comment'), 'registry: appended at the end of the files list, above the marker comment')
  const stripLines = reg.split('\n').filter(line => /^  \(await import\(.*\)\)\.strip/.test(line))
  ok(/studio-chat-parity-more-strip\.mjs/.test(stripLines[stripLines.length - 1]), 'registry: appended at the end of the strips list')
  // the sources of each piece
  libSources(read(LIB)); modelSources(read(MODEL)); handoffSources(read(HANDOFF)); glueSources(read(GLUE), read(COMMANDS_UI)); destinationSources(read(ROW), read(ASK), read(KNOWLEDGE), read(THEMES), read(TEMPLATES), read(HOOK))
  triggerChecks(); menuChecks(read(MENU), read(ICONS))
  // the committed diff is this change's files (COMMITTED diff only: a working-tree edit does not count, and a later change's commits are not read)
  if (OWN.length && hasBase) {
    const touched = new Set()
    for (const sha of OWN) for (const rel of git('diff-tree', '--no-commit-id', '--name-only', '-r', '-m', '--first-parent', sha).split('\n').filter(Boolean)) touched.add(rel)
    eq([...touched].filter(rel => !strip.CHAT_PARITY_MORE_SCOPE_FILES.has(rel)), [], 'the committed diff of this change\'s own commits touches only the files this change lists (its marked app files, its new files, the registry and the older proofs it teaches)')
    ok(OWN.every(sha => /Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>/.test(git('log', '-1', '--format=%B', sha))), 'every commit of this change carries the Co-Authored-By line')
    ok(OWN.every(sha => git('log', '-1', '--format=%s', sha).startsWith(strip.CHAT_PARITY_MORE_SUBJECT)), 'every commit subject starts "Chat parity more:"')
  }
}
function markedOrWhole(rel) { return strip.CHAT_PARITY_MORE_FILES.includes(rel) ? markedOf(read(rel)) : read(rel) }

function libSources(text) {
  ok(/^import \{ PARITY_WAIT, PARITY_WORDS, looseScore \} from '@\/lib\/studio-chat-parity-viewer'$/m.test(text) && /^import type \{ ParityResult, ParityRow, ViewerState \} from '@\/lib\/studio-chat-parity-viewer'$/m.test(text), 'the lib reuses the viewer half\'s words, waits, loose matching and types')
  ok(!/\bfetch\(|XMLHttpRequest|WebSocket|document\.|window\.|localStorage|sessionStorage|useRouter|import\(/.test(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'the lib touches no network, no DOM, no storage, no router: every browser call is a handle the composer hands in')
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/export const MORE_HANDLERS[\s\S]*?\n\}\)/, '') // (the table of handler names is documentation: strings, not calls)
  ok(!/\b(deleteTheme|deleteTemplate|runLibraryDelete|confirmDelete|onDelete|studioKgAsk|\.ask\(|useStudioKgAsk|submit|publishDeck|handlePublish|sendPublish)\b/.test(code), 'CONFIRMS: nothing in the lib deletes, asks or publishes: it opens a page, fills a box and presses the Publish button, nothing more')
  ok(/page\.handoff\(\{ kind, text, id \}\)\) return failed\(W\.handoffFailed\)/.test(text) && /if \(away\) page\.openTab\(target\.path\); else page\.go\(target\.path\)/.test(text), 'the hand-off is written first (and a failure stops the run), then the page opens in a new tab or this one')
  ok(/settleModel\(state => state\.current === key/.test(text) && /settleModel\(state => !state\.resetNeeded/.test(text) && /task\.id === what\.task\)\?\.choice === what\.value/.test(text), 'a model run says what it SAW: it looks at the gauge\'s state after the save')
  ok(/moreBlocked\(what, env\)/.test(text) && /\.\.\.page\.env\(\), model: modelNow\(\)\?\.state \?\? null/.test(text), 'a run asks for its block again, with the gauge read fresh from the bus')
  for (const name of ['delete-theme', 'delete-template', 'model', 'kg-search', 'ask', 'switch-template']) ok(new RegExp(`name: '${name}'`).test(text), `the lib names /${name}`)
  ok(!/\bconfirm\b/i.test(text.split('\n').filter(line => /blurb:|label:/.test(line)).join('\n')), 'no row is described as a confirmation')
}
function modelSources(text) {
  ok(/^import baseCatalog from '@\/components\/studio-personal\/model-catalog-snapshot\.json'$/m.test(text) && /^import refreshedCatalog from '@\/components\/studio-personal\/model-catalog-snapshot-2026-10\.json'$/m.test(text) && /NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10 === 'true' \? refreshedCatalog : baseCatalog/.test(text), 'the fallback list is the Intelligence page\'s own (the same two snapshots, the same flag)')
  ok(/\bstopChoice\(stop, live\.scope\)/.test(text) && /live\.select\(null\)/.test(text) && /live\.selectTask\(task, value\)/.test(text), 'the stops use the gauge\'s own stopChoice; reset is the same save with nothing; a task goes to the per-task save')
  ok(/source\.isChoice\(value\)/.test(text) && /source\.kind === 'fixed'/.test(text), 'the per-task save checks the row\'s own list (the page\'s `choose`) and refuses a fixed task')
  ok(/finally \{[\s\S]*deps\.feedback\(words\)[\s\S]*deps\.busy\.current = false[\s\S]*deps\.saving\(false\)/.test(text), 'busy and saving are always given back')
  ok(!/\bfetch\(|localStorage|document\.|window\./.test(text.replace(/\/\/.*$/gm, '')), 'the helper touches no network, no storage, no DOM')
}
function handoffSources(text) {
  ok(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_COMMANDS === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true'/.test(text) && /if \(!CHAT_PARITY_MORE_ON\) return null/.test(text), 'the page\'s take answers null with the flag off (the commands flag, with chat clean)')
  ok(/store\.removeItem\(MORE_HANDOFF_KEY\)/.test(text) && !/location|URLSearchParams|history\./.test(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'a take removes the entry, and nothing is put in the address')
}
function glueSources(glue, ui) {
  ok(/^registerParityRunner\(runMore\)/m.test(glue), 'the glue registers the runner on the viewer commands\' bus (a Set: loading it twice adds nothing)')
  ok(/if \(!input\.enabled\) return INERT/.test(glue) && /if \(!input\.enabled\) return\n/.test(glue.replace(/\r/g, '')) && /Object\.freeze\(\{ rows: \[\], template: null, publish: null \}\)/.test(glue), 'flag off: the hook returns the inert constant, its effects return first')
  ok(/pressControl\(document, CONTROL_SELECTORS\.publish\)/.test(glue) && /const NOT_READY_WHY = /.test(glue) && /templateGenerationStatus\(template\)/.test(glue), 'the Publish press is the existing trigger\'s own selector; a template that is not ready says the picker\'s reason')
  ok(/await loadWorkspaceTemplates\(\(\) => listRef\.current\(\), MENTION_RULES\)/.test(glue) && /runParity\(answer\.run as never/.test(glue), 'a picked @template goes through the workspace half\'s own select (its block, its handler, what it saw)')
  ok(/handoff: putBrowserHandoff/.test(glue) && /window\.open\(path, '_blank', 'noopener'\)/.test(glue) && /router\.push\(path\)/.test(glue), 'the handles are the router, a new tab and the hand-off write')
  const code = glue.replace(/\/\/.*$/gm, '')
  ok(!/\b(deleteTheme|deleteTemplate|runLibraryDelete|confirmDelete|studioKgAsk\(|\.ask\()/.test(code.replace('studioKgAskCheck', '')), 'CONFIRMS: the glue deletes nothing and asks nothing (studioKgAskCheck only checks the words)')
  // the composer's lines
  ok(/^import \{ useChatParityMore \} from '@\/components\/builder\/chat\/studio-chat-parity-more' \/\/ CHAT-PARITY-MORE$/m.test(ui), 'the composer imports the hook on a marked line')
  const hookLine = lineWith(ui, 'const more = useChatParityMore(')
  ok(/\/\/ CHAT-PARITY-MORE/.test(hookLine) && /enabled, trigger:/.test(hookLine) && /building: input\.stop\.visible/.test(hookLine) && /saved: input\.saved, savedStatus: input\.savedStatus, refreshSaved: input\.refreshSaved/.test(hookLine) && /templateSaved: input\.template\.saved, listTemplates/.test(hookLine), 'ONE marked line calls the hook with the composer\'s own gate, its build state, the saved themes and the template list call')
  ok(ui.indexOf('parity.push(...workspaceRows)') < ui.indexOf('parity.push(...more.rows)') && ui.indexOf('parity.push(...more.rows)') < ui.indexOf('const mention: MentionModel'), 'this change\'s rows come after the workspace half\'s, before the counts are taken')
  const publishLine = lineWith(ui, "if (row.id === 'publish' && more.publish)")
  ok(/postNote\(more\.publish\(\)\); return \} \/\/ CHAT-PARITY-MORE/.test(publishLine) && ui.indexOf(publishLine) < ui.indexOf('execute(resolveCommand(row.id as ChatCommandId, row.arg, ctx), before)'), '/publish: the pick presses the Publish button (and says what it saw) before the old decline can be reached')
  const mentionLine = lineWith(ui, "if (item.section === 'template' && item.reference?.kind === 'template' && more.template)")
  ok(/more\.template\(item\.reference\.template_id\)\.then\(postNote\); return \}/.test(mentionLine) && /input\.setText\(input\.text\.slice\(0, at\.start\)\)/.test(mentionLine) && ui.indexOf(mentionLine) < ui.indexOf('if (item.reference) registerMention(item.token, item.reference)'), '@template: the pick chooses the template, writes no token and registers no reference (Director declines a template mention), before the old path can be reached')
  ok(ui.split('\n').filter(line => MARK.test(line)).length === 5, 'the composer carries exactly five marked lines: the import, the hook, the push, the @template pick, the /publish pick')
}
function destinationSources(row, ask, knowledge, themes, templates, hook) {
  // CONFIRMS: the library row's effect only OPENS the dialog; a delete is the click on its own button
  const effect = lineWith(row, 'if (confirmRequest && !deleteBlockedReason)')
  ok(/setConfirming\(true\)/.test(effect) && /onConfirmRequest\?\.\(\)/.test(effect) && !/confirmDelete|onDelete|deleteTheme|deleteTemplate|setDeleting|runLibraryDelete/.test(effect.replace(/CHAT-PARITY-MORE/g, '')), 'CONFIRMS: the row\'s effect only opens ITS delete confirmation (setConfirming(true)) and says it heard; it never calls confirmDelete or onDelete')
  ok(/\[confirmRequest\]\)/.test(effect) && /!deleteBlockedReason/.test(effect), 'CONFIRMS: it runs when asked, not on every render, and never opens a row that cannot be deleted (a Composer template)')
  ok(/AlertDialogAction data-studio-library-delete-confirm="true"[^>]*onClick=\{event => \{ event\.preventDefault\(\); void confirmDelete\(\) \}\}/.test(row), 'CONFIRMS: the dialog\'s own Delete button is still the only caller of confirmDelete')
  ok(row.split('confirmDelete(').length - 1 === 1 && row.split('const confirmDelete = ').length - 1 === 1, 'CONFIRMS: confirmDelete is defined once and called once (the dialog\'s button)')
  for (const [rel, text, kind, flag, find] of [[THEMES, themes, 'delete-theme', 'THEME_LIBRARY_MANAGE', 'themes.find'], [TEMPLATES, templates, 'delete-template', 'TEMPLATE_LIBRARY_MANAGE', 'templates.find']]) {
    const take = lineWith(text, `takeBrowserHandoff('${kind}')`), ask2 = lineWith(text, `${find}(`)
    ok(new RegExp(`${flag} \\? takeBrowserHandoff\\('${kind}'\\) : null`).test(take) && /setMode\('library'\)/.test(take), `${rel}: the hand-off is taken only when that page's delete is switched on, and the page shows the saved list`)
    ok(/!themes \|\| loading \|\| !accountReady|!templates \|\| loading \|\| !accountReady/.test(ask2) && /setChatMoreDelete\(hit\.id\)/.test(ask2) && !/manageDelete|deleteTheme|deleteTemplate|runLibraryDelete|confirmDelete/.test(ask2), `${rel}: CONFIRMS: once the library has loaded it ASKS the row (setChatMoreDelete) and calls no delete`)
    ok(/isUserOwnedLibraryItem\(hit\)/.test(ask2) && /setNotice|setActionNotice/.test(ask2), `${rel}: a theme or template that is gone, or not the person's own, is said (a notice), never deleted`)
    ok(/confirmRequest=\{chatMoreDelete === (theme|template)\.id\} onConfirmRequest=\{\(\) => setChatMoreDelete\(null\)\}/.test(text), `${rel}: the row is passed the request and clears it once heard`)
  }
  // CONFIRMS: the Ask box is only FILLED
  const fill = lineWith(ask, "takeBrowserHandoff(\"kg-ask\")")
  ok(/setText\(handed\.text\)/.test(fill) && /inputRef\.current\?\.focus\(\)/.test(fill) && !/\bask\(|submit|studioKgAskCheck|reset\(\)/.test(fill.replace(/Ask costs money, so the person presses Ask/, '').replace(/Nothing is sent from here/, '').replace(/CHAT-PARITY-MORE[^]*$/, '')), 'CONFIRMS: the Ask box is FILLED and focused; the effect never calls ask or submits (Ask costs money, so the person presses Ask)')
  ok(ask.split('ask(').length - 1 === ask.split('\n').filter(line => /\bask\(/.test(line)).length && !/useEffect\([^)]*ask\(/.test(ask), 'CONFIRMS: ask() is called only where it was (the form\'s submit and the retry button)')
  // the Knowledge search: the page's own search, once the account is ready
  const search = lineWith(knowledge, 'chatMoreSearch.current && searchQuery === chatMoreSearch.current')
  ok(/accessStatus === "ready"/.test(search) && /void runSearch\(\)/.test(search) && !/runImport|requestImport|loadData|delete/i.test(search), 'the Knowledge page runs its own search once the box holds the handed words and the account is ready (a read), and does nothing else')
  ok(/takeBrowserHandoff\("kg-search"\)/.test(knowledge) && /setSearchQuery\(handed\.text\)/.test(knowledge), 'the Knowledge page takes the hand-off into the search box')
  // the gauge's hook: gated, dynamic, never loaded with the flag off
  ok(/const chatParityMoreOn = process\.env\.NEXT_PUBLIC_STUDIO_CHAT_COMMANDS === "true" && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === "true"/.test(hook), 'the gauge\'s hook is gated on the commands flag and chat clean')
  ok(!/^import .*studio-chat-parity-more/m.test(hook) && /import\("@\/lib\/studio-chat-parity-more"\), import\("@\/lib\/studio-chat-parity-more-model"\)/.test(hook), 'the gauge\'s hook loads the bus and the helper with a dynamic import in a gated effect: a build with the flag off never loads them')
  ok(/chatParityMoreLive\.current = !chatParityMoreOn \? null : \{/.test(hook) && /if \(!chatParityMoreOn\) return; let off/.test(hook) && /if \(chatParityMoreOn\) chatParityMoreMods\.current\?\.bus\.publishMoreModel\(\)/.test(hook), 'flag off: the live part is null and both effects return first')
  ok(/select, selectTask: chatParityMoreTask \}/.test(hook) && /now: \(\) => latest\.current, busy,/.test(hook), 'the hook hands over its OWN select and its own state (the gauge draws what a chat save writes)')
  ok(/bus\.registerMoreModel\(\(\) => \(chatParityMoreLive\.current \? model\.modelPartOf\(chatParityMoreLive\.current\) : null\)\)/.test(hook), 'the getter always reads this render\'s live part')
}
function triggerChecks() {
  const commands = repoLoader.load(COMMANDS_LIB)
  const t = text => commands.detectTrigger(text)
  eq(t('/model research gemini pro'), { kind: 'command', start: 0, name: 'model', arg: 'research gemini pro' }, 'a command of this change takes several words')
  eq(t('hello /ask what did we learn about churn?'), { kind: 'command', start: 6, name: 'ask', arg: 'what did we learn about churn?' }, 'after other text, a question with punctuation')
  eq(t('/delete-theme Brand Blue'), { kind: 'command', start: 0, name: 'delete-theme', arg: 'Brand Blue' }, '/delete-theme takes a name of several words')
  eq(t('/kg-search q3 churn'), { kind: 'command', start: 0, name: 'kg-search', arg: 'q3 churn' }, '/kg-search')
  eq(t('/switch-template sales pitch'), { kind: 'command', start: 0, name: 'switch-template', arg: 'sales pitch' }, '/switch-template')
  eq([t('/model'), t('/model ')], [{ kind: 'command', start: 0, name: 'model', arg: null }, { kind: 'command', start: 0, name: 'model', arg: '' }], 'the name alone, and the name with a space: the old trigger (the arg is empty, not null, so the choices show)')
  eq([t('/export p'), t('/theme dark blue'), t('/layout image text'), t('/template Quarterly Review'), t('/stop'), t('/template-mode on')], [{ kind: 'command', start: 0, name: 'export', arg: 'p' }, { kind: 'command', start: 0, name: 'theme', arg: 'dark blue' }, { kind: 'command', start: 0, name: 'layout', arg: 'image text' }, { kind: 'command', start: 0, name: 'template', arg: 'Quarterly Review' }, { kind: 'command', start: 0, name: 'stop', arg: null }, { kind: 'command', start: 0, name: 'template-mode', arg: 'on' }], 'every trigger that was there before reads as it did')
  eq(t('what about @sli'), { kind: 'mention', start: 11, query: 'sli' }, 'an "@" is still a mention, first')
  eq([t('/models'), t('/asked'), t('plain text')], [{ kind: 'command', start: 0, name: 'models', arg: null }, { kind: 'command', start: 0, name: 'asked', arg: null }, null], 'a name that only starts like one of ours takes no words')
}
function menuChecks(menu, icons) {
  const names = ['delete-theme', 'delete-template', 'model', 'kg-search', 'ask', 'switch-template']
  for (const name of names) ok(new RegExp(`['"]?${name}['"]?: `).test(icons), `the menu has an icon for /${name}`)
  ok(/\.\.\.MORE_ICONS, \/\/ CHAT-PARITY-MORE/.test(menu) && /import \{ MORE_ICONS \} from/.test(menu), 'the menu spreads this change\'s icons in on marked lines (the viewer half\'s menu draws the groups)')
  ok(/lucide-react/.test(icons) && !/fetch|document|window/.test(icons), 'the icons are the lucide set the other rows use')
  ok(strip.CHAT_PARITY_MORE_FILES.includes(MENU), 'the menu is a marked file')
}

// ============================================================================================================================================
// D. Mutants
// ============================================================================================================================================
let mutants = 0
const hit = (condition, message) => { mutants++; assert.ok(condition, message) }
async function caught(label, run) { let threw = false; try { await run() } catch { threw = true } hit(threw, `mutant caught: ${label}`) }
function mutate(text, from, to, label) { assert.ok(text.includes(from), `mutant "${label}": the text to change is there`); return text.replace(from, () => to) }
const wholeLib = async text => { libSuite(loadMore(text)); await runSuite(text) }

async function mutantChecks() {
  const lib = read(LIB), model = read(MODEL), handoff = read(HANDOFF)
  const L = (from, to, label) => caught(label, () => wholeLib(mutate(lib, from, to, label)))
  await L("if (!page.handoff({ kind, text, id })) return failed(W.handoffFailed)", "page.handoff({ kind, text, id })", 'a hand-off that could not be kept is ignored')
  await L("if (building || Boolean(viewer?.building)) return 'build'", "if (Boolean(viewer?.building)) return 'build'", 'a build running no longer opens a new tab')
  await L("return viewer && viewer.save !== 'saved' ? 'edits' : null", "return viewer && viewer.save === 'error' ? 'edits' : null", 'unsaved edits no longer open a new tab')
  await L("what.name === 'ask' ? 'kg-ask'", "what.name === 'ask' ? 'kg-search'", 'ask hands over as a search') // (the kind chain)
  await L("return item?.why ?? null", "return null", 'a Composer template can be deleted')
  await L("case 'delete-theme': return env.flags.themeDelete ? null : W.themeOff", "case 'delete-theme': return null", 'a library that is not switched on still lists deletes')
  await L("case 'ask': return env.flags.ask ? null : W.askOff", "case 'ask': return null", 'the Ask box that is not on still takes a question')
  await L("return row?.inUse ? W.matchInUse : null", "return null", 'the template in use can be switched to')
  await L("return press() === 'clicked' ? done(", "return press() !== 'missing' ? done(", 'a disabled Publish button is called opened')
  await L("if (!item.ready) return { note: item.why || W.templateGone }", "if (false) return { note: '' }", 'a template that is not ready is chosen')
  await L("if (!checked.ok) return [problem('ask'", "if (false) return [problem('ask'", 'an empty question is a run')
  await L("return isMoreRun(what) ? emitMoreCommand(what, { scale: deps.scale }) : null", "return emitMoreCommand(what as never, { scale: deps.scale })", 'the runner answers runs that are not its own')
  await L("settleModel(state => state.current === key, wait(PARITY_WAIT.move))) ?", "true) ?", 'a depth is called set without looking')
  await L("settleModel(state => !state.resetNeeded, wait(PARITY_WAIT.move))) ?", "true) ?", 'a reset is called done without looking')
  await L("if (!answer.ok) return failed(answer.words || \"Couldn't save that choice.\")\n          const key", "const key", 'a refused depth is called set')
  await L("const stop = (env.model as MoreModelState).stops.find(item => item.id === what.stop)", "const stop = undefined as never", 'Auto is not told from a tier')
  await L("if (run.op === 'reset') return model.resetNeeded ? null : W.modelDefaults", "if (run.op === 'reset') return null", 'a reset with nothing to reset runs')
  await L("return task.choice === run.value ? W.modelAlready(run.label) : null", "return null", 'a model already chosen runs again')
  await L("if (!task || task.fixed) return W.modelFixed(run.taskLabel)", "if (!task) return null", 'a fixed task can be chosen')
  await L("`/model ${stop.label.toLowerCase()}`, depthBlurb(stop)", "`/model ${stop.label.toLowerCase()}`, ''", 'a depth does not say what it costs')
  await L(".sort((a, b) => b.score - a.score || a.order - b.order).map(entry => entry.item).slice(0, MORE_ROWS.items)", ".sort((a, b) => b.score - a.score || a.order - b.order).map(entry => entry.item).slice(0, 0)", 'a typed word finds nothing')
  await L("kg-search', 'Knowledge', `/kg-search ${clip(arg, 28)}`, 'Open Knowledge and search for it', R({ name: 'kg-search', text: arg })", "kg-search', 'Knowledge', `/kg-search ${clip(arg, 28)}`, 'Open Knowledge and search for it', R({ name: 'kg-search', text: arg.toUpperCase() })", 'the search words are changed')
  await L("if (arg.length > MORE_SEARCH_MAX) return", "if (false) return", 'a search over the limit runs')
  // the model helper
  const M = (from, to, label) => caught(label, () => modelSuite(mutate(model, from, to, label)))
  await M("if (!source || source.kind === 'fixed' || !source.isChoice(value)) return { ok: false, words: MODEL_CHOICE_REFUSED }", "if (!source) return { ok: false, words: MODEL_CHOICE_REFUSED }", 'a model the row does not offer is saved')
  await M("deps.put(target, own)\n      words = MODEL_CHOICE_REFUSED", "words = MODEL_CHOICE_REFUSED", 'a refused save leaves the choice on screen')
  await M("    deps.busy.current = false\n    deps.saving(false)", "    deps.saving(false)", 'busy is not given back')
  await M("const next = { ...own, [task]: value } as ModelChoices", "const next = { ...modelChoiceDefaults(), [task]: value } as ModelChoices", 'the other tasks are reset by a task choice')
  await M("stopChoice(stop, live.scope)", "stopChoice(stop, 'user')", 'Auto on a deck is not the deck\'s own')
  await M("if (!now.loaded || deps.busy.current) return { ok: false, words: MODEL_SAVE_BUSY }", "if (!now.loaded) return { ok: false, words: MODEL_SAVE_BUSY }", 'a second save runs while one is in flight')
  await M("if (kind === 'conflict') return { ok: false, words: MODEL_CHOICE_CONFLICT }", "if (kind === 'conflict') return { ok: true, words: '' }", 'a conflict is called saved')
  await M("resetNeeded: live.scope === 'deck' ? live.deckOwn !== 'default'", "resetNeeded: live.scope === 'deck' ? false", 'a deck\'s own choice cannot be reset')
  await M("return { key: following ? `following:${base}` : base, label: view.label }", "return { key: base, label: view.label }", 'a deck that follows its default reads as chosen')
  // the hand-off
  const H = (from, to, label) => caught(label, () => handoffSuite(mutate(handoff, from, to, label)))
  await H("    store.removeItem(MORE_HANDOFF_KEY)\n    return { text: entry.text", "    return { text: entry.text", 'a take leaves the entry behind')
  await H("if (entry.kind !== kind) return null", "if (entry.kind !== kind) { store.removeItem(MORE_HANDOFF_KEY); return null }", 'another page\'s entry is thrown away')
  await H("now - entry.at <= MORE_HANDOFF_TTL_MS", "true", 'an old entry is taken')
  await H("if (!CHAT_PARITY_MORE_ON) return null", "", 'the page takes a hand-off with the flag off')
  await H("if (kept && now - kept.at >= 0 && now - kept.at <= MORE_HANDOFF_HOLD_MS) return kept.value", "", 'a remounted page finds nothing (the cold new tab loses its words)')
  await H("now - kept.at <= MORE_HANDOFF_HOLD_MS) return kept.value", "now - kept.at >= 0) return kept.value", 'a held entry never expires')
  await H("now - entry.at >= 0 &&", "", 'an entry from the future is taken')
  // sources: the confirms
  const row = read(ROW), ask = read(ASK), hook = read(HOOK)
  const S = (label, fn) => caught(label, () => fn())
  await S('the row\'s effect calls the delete', () => destinationSources(mutate(row, 'setConfirming(true) } if (confirmRequest) onConfirmRequest?.()', 'setConfirming(true); void confirmDelete() } if (confirmRequest) onConfirmRequest?.()', 'row'), ask, read(KNOWLEDGE), read(THEMES), read(TEMPLATES), hook))
  await S('the row\'s effect opens a row that cannot be deleted', () => destinationSources(mutate(row, 'if (confirmRequest && !deleteBlockedReason)', 'if (confirmRequest)', 'row2'), ask, read(KNOWLEDGE), read(THEMES), read(TEMPLATES), hook))
  await S('the Ask box is submitted from the hand-off', () => destinationSources(row, mutate(ask, 'setText(handed.text); inputRef.current?.focus()', 'setText(handed.text); ask(handed.text)', 'ask'), read(KNOWLEDGE), read(THEMES), read(TEMPLATES), hook))
  await S('the Themes page deletes after the load', () => destinationSources(row, ask, read(KNOWLEDGE), mutate(read(THEMES), 'setChatMoreDelete(hit.id); else', 'void manageDelete(hit); else', 'themes'), read(TEMPLATES), hook))
  await S('the Templates page takes the hand-off without its flag', () => destinationSources(row, ask, read(KNOWLEDGE), read(THEMES), mutate(read(TEMPLATES), "TEMPLATE_LIBRARY_MANAGE ? takeBrowserHandoff('delete-template') : null", "takeBrowserHandoff('delete-template')", 'templates'), hook))
  await S('the Knowledge page searches before the account is ready', () => destinationSources(row, ask, mutate(read(KNOWLEDGE), 'accessStatus === "ready") { chatMoreSearch.current = null', 'true) { chatMoreSearch.current = null', 'knowledge'), read(THEMES), read(TEMPLATES), hook))
  await S('the gauge\'s hook loads the helper with a static import', () => destinationSources(row, ask, read(KNOWLEDGE), read(THEMES), read(TEMPLATES), `import { x } from '@/lib/studio-chat-parity-more'\n${hook}`))
  await S('the gauge\'s hook registers with the flag off', () => destinationSources(row, ask, read(KNOWLEDGE), read(THEMES), read(TEMPLATES), mutate(hook, 'if (!chatParityMoreOn) return; let off', 'let off', 'hook')))
  // sources: the lib and the glue
  await S('the lib deletes', () => libSources(`${lib}\nconst x = deleteTheme('a')`))
  await S('the lib reaches the network', () => libSources(`${lib}\nconst y = fetch('/x')`))
  await S('the lib stops waiting to see the change', () => libSources(mutate(lib, 'settleModel(state => state.current === key', 'settleModel(state => true', 'src')))
  const glue = read(GLUE), ui = read(COMMANDS_UI)
  await S('the glue answers with the flag off', () => glueSources(mutate(glue, 'if (!input.enabled) return INERT', 'if (false) return INERT', 'glue'), ui))
  await S('the glue deletes', () => glueSources(`${glue}\nconst z = deleteTheme('a')`, ui))
  await S('the /publish pick runs after the old decline', () => glueSources(glue, ui.replace(/^.*if \(row\.id === 'publish' && more\.publish\).*$/m, '') + "\n    if (row.id === 'publish' && more.publish) { postNote(more.publish()); return } // CHAT-PARITY-MORE\n"))
  await S('the @template pick writes the token', () => glueSources(glue, mutate(ui, 'input.setText(input.text.slice(0, at.start)); focusEnd(); void more.template', 'input.setText(textWithMention(input.text, at, item.token)); focusEnd(); void more.template', 'ui')))
  // the strip
  const stripChecks = async (mod, rel) => { if (!hasBase) throw new Error('no base: the mutant cannot be judged here (treated as caught)'); for (const file of strip.CHAT_PARITY_MORE_FILES) if (mod.stripChatParityMore(file, read(file)) !== baseOf(file)) throw new Error(`${file} differs`) }
  await caught('the strip leaves a marked line behind', async () => stripChecks({ stripChatParityMore: (rel, text) => strip.stripChatParityMore(rel, text) + '\n// CHAT-PARITY-MORE leftover' }))
  await caught('the strip loses an edit', async () => stripChecks({ stripChatParityMore: (rel, text) => (rel === ROW ? text.split('\n').filter(line => !MARK.test(line)).join('\n') : strip.stripChatParityMore(rel, text)) }))
  await caught('the strip takes a line that is not this change\'s', async () => stripChecks({ stripChatParityMore: (rel, text) => strip.stripChatParityMore(rel, text).split('\n').filter(line => !/CHAT-PARITY-WORKSPACE/.test(line)).join('\n') }))
  const unmarked = read(COMMANDS_UI).replace('const more = useChatParityMore', 'const more = /* x */ useChatParityMore').replace(" // CHAT-PARITY-MORE: the remaining commands' rows", " // the remaining commands' rows")
  hit(strip.stripChatParityMore(COMMANDS_UI, unmarked) !== baseOf(COMMANDS_UI), 'mutant caught: an unmarked line stays in the stripped file')
  hit(!strip.CHAT_PARITY_MORE_MARKER_RE.test('// CHAT-PARITY-MORE-X') && !strip.CHAT_PARITY_MORE_MARKER_RE.test('// X-CHAT-PARITY-MORE') && !strip.CHAT_PARITY_MORE_MARKER_RE.test('// CHAT-PARITY-WORKSPACE') && !strip.CHAT_PARITY_MORE_MARKER_RE.test('// CHAT-PARITY'), 'mutant caught: the marker matches another change\'s marker')
  // the trigger and the menu
  const commandsLib = read(COMMANDS_LIB)
  await S('the trigger no longer reads several words', () => { const out = { text: commandsLib.replace('(model|ask|kg-search|delete-theme|delete-template|switch-template)', '(model)') }; assert.ok(out.text !== commandsLib); const mutated = repoLoaderFrom(out.text); assert.deepEqual(plain(mutated.detectTrigger('/ask what now')), { kind: 'command', start: 0, name: 'ask', arg: 'what now' }) })
  await S('a command has no icon', () => menuChecks(read(MENU), read(ICONS).replace("ask: MessageCircleQuestion, ", '')))
  // the unit suites themselves must be able to fail
  await caught('the run suite has a fake that fails', async () => { const more = loadMore(); fakePage(more, { handoffOk: false }); const result = await emit(more, R({ name: 'kg-search', text: 'x' })); assert.ok(result.ok) })
}
function repoLoaderFrom(text) {
  const out = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, COMMANDS_LIB))(out, out.exports, specifier => (specifier.startsWith('@/') ? repoLoader.load(specifier.slice(2)) : (() => { throw new Error(specifier) })()), { env: {} })
  return out.exports
}

// ============================================================================================================================================
console.log('PASS A-start')
libSuite()
console.log('PASS A  the lib: what blocks each command, the button\'s own reasons, every row, the typed word that never confirms')
await runSuite(); await modelSuite(); await handoffSuite()
console.log('PASS B  the runs on fake handles (hand-off, new tab, never delete / ask / publish), the gauge\'s saves, the Intelligence page\'s save, the hand-off')
sourceChecks()
console.log('PASS C  the sources: markers, the strip back to the workspace half\'s head, the confirms never bypassed, the gates, the registry, no new flag, the committed diff, the trigger, the menu')
await mutantChecks()
console.log('PASS D  mutants: every one caught')
console.log(`test-studio-chat-parity-more: ${checks} checks, ${mutants} mutants caught (${OWN.length ? `own commits ${OWN.map(sha => sha.slice(0, 8)).join(', ')}` : 'no own commit yet'})${hasBase ? '' : ' (base commit not in this clone: some checks skipped)'}`)
