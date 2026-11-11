// FRONTEND-1 (overnight chat parity, navigation half): proof of the "Go to" slash commands behind NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (the string "true", default off, build-time; it already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell).
//   lib/studio-chat-parity-nav.ts (the rows, what cannot run and why, the words, the run), lib/studio-duplicate-deck-deps.ts (the deps the Decks page builds inline, copied), components/builder/chat/studio-chat-parity-nav-decks.ts (the deck list),
//   components/builder/chat/studio-chat-parity-nav-about.tsx (the About dialog), marked lines in the composer hook, the Builder page and the viewer half's lib and menu; the Decks page is left alone.
//
//   A. The lib, function by function, in THIS realm: the rows for every trigger (collapsed group, More, search, deck matches, hints, disabled reasons), the unsaved-edits rule, the build rule.
//   B. The run on FAKE page handles: every command calls its handler / route with the right arguments, says what it SAW (never a change it did not see), opens a NEW TAB while a build runs or edits are unsaved,
//      /open is disabled while the viewer is dirty, /duplicate-deck never switches to the copy, the viewer half's runParity routes a Go to command here.
//   C. The deck-list hook (the real hook on the harness's mini React) and the copy through the shared deps (the real runDuplicateDeck on a fake network).
//   D. The sources: every marked line, the strip puts every file back to the viewer half's head byte for byte, the registry, the taught older proofs read through their marked lines, the routes exist, the Decks page is
//      untouched and the helper's deps equal its inline ones member by member, no new flag, the COMMITTED diff is this change's files.
//   E. MUTANTS: every one of them must be caught by A-D.
//
//   node scripts/test-studio-chat-parity-nav.mjs
//
// Offline: no socket, no fetch to anywhere (the copy runs on a recorder), no browser; git is read only for D. Later changes stack on top, so the committed-diff check reads THIS change's own commits (subject "Chat parity nav: ...").
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
let checks = 0
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside a loader's vm have their own prototypes: compare them as plain data
const eq = (actual, expected, message) => { checks++; assert.deepEqual(plain(actual), plain(expected), message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const strip = await import('./studio-chat-parity-nav-strip.mjs')
const viewerStrip = await import('./studio-chat-parity-viewer-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')

const NAV = 'lib/studio-chat-parity-nav.ts'
const VIEWER_LIB = 'lib/studio-chat-parity-viewer.ts'
const DEPS = 'lib/studio-duplicate-deck-deps.ts'
const DECKS = 'components/builder/chat/studio-chat-parity-nav-decks.ts'
const ABOUT = 'components/builder/chat/studio-chat-parity-nav-about.tsx'
const MENU = 'components/builder/chat/studio-chat-parity-viewer-menu.tsx'
const COMMANDS_UI = 'components/builder/chat/studio-chat-commands.tsx'
const COMMANDS_LIB = 'lib/studio-chat-commands.ts'
const PAGE = 'app/builder/page.tsx'
const DASHBOARD = 'app/(app)/dashboard/page.tsx'
const REGISTRY = 'scripts/studio-later-changes.mjs'
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const has = rev => { try { git('cat-file', '-e', `${rev}^{commit}`); return true } catch { return false } }
const hasHead = has(strip.VIEWER_HEAD), hasBase = has(strip.BASE_COMMIT)
const showAt = (rev, rel) => git('show', `${rev}:${rel}`)
/** This change's own commits (newest first): subject "Chat parity nav: ...". */
const OWN = (() => { try { return git('log', '--format=%H%x09%s', '--no-merges', `${strip.VIEWER_HEAD}..HEAD`).split('\n').filter(Boolean).map(line => line.split('\t')).filter(([, subject]) => subject.startsWith(strip.CHAT_PARITY_NAV_SUBJECT)).map(([sha]) => sha) } catch { return [] } })()

// ---- the libs, evaluated in THIS realm (the nav lib and the viewer half's, wired to each other as the build does) --------------------------------
const compiled = new Map()
function compile(text, fileName) {
  const key = `${fileName}\0${text}`
  if (compiled.has(key)) return compiled.get(key)
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  compiled.set(key, out.outputText)
  return out.outputText
}
const repoLoader = createModuleLoader({ root, globals: { process: { env: { NODE_ENV: 'production' } }, console, Date, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp } })
function loadPair({ viewerText = read(VIEWER_LIB), navText = read(NAV) } = {}) {
  const modules = {}
  const requireFor = specifier => {
    if (specifier === '@/types/elements') return repoLoader.load('types/elements.ts')
    if (specifier === '@/lib/studio-add-slide-v2') return repoLoader.load('lib/studio-add-slide-v2.ts')
    if (specifier === '@/lib/studio-chat-parity-nav') return modules.nav
    throw new Error(`the libs import only the layout catalog, the add-slide options and each other, not ${specifier}`)
  }
  const run = (text, fileName) => { const module = { exports: {} }; new Function('module', 'exports', 'require', 'process', compile(text, fileName))(module, module.exports, requireFor, { env: {} }); return module.exports }
  modules.nav = run(navText, NAV)
  modules.viewer = run(viewerText, VIEWER_LIB)
  return { nav: modules.nav, viewer: modules.viewer }
}
const SCALE = 0.01 // the run waits (ms) times this to SEE an effect: a command that changes nothing fails fast

// ---- fakes: a viewer state, an env, the page's handles -------------------------------------------------------------------------------------------
const slideState = over => ({ ready: true, slideCount: 8, slide: 3, editing: false, grid: false, borders: false, rail: true, presenting: false, building: false, slideReason: null, save: 'saved', version: { active: 'blank', has: ['blank', 'strawman', 'final'] }, ...over })
const envOf = (over = {}) => ({ viewer: slideState(), building: false, themeBlocked: null, presets: [{ id: 'midnight', name: 'Midnight' }], canvasClosed: true, ...over })
const ago = ms => new Date(Date.now() - ms).toISOString()
const DAY = 86400000
const SESSIONS = [
  { id: 'd1', title: 'Q3 product review', slideCount: 12, lastMessageAt: ago(2 * DAY) },
  { id: 'cur', title: 'Board update, November', slideCount: 9, lastMessageAt: ago(3600000) },
  { id: 'd3', title: 'Quarterly review for the board', slideCount: 1, lastMessageAt: ago(5 * DAY) },
  { id: 'd4', title: 'Onboarding playbook', slideCount: null, lastMessageAt: ago(20 * DAY) },
  { id: 'd5', title: 'Product roadmap 2027', slideCount: 14, lastMessageAt: ago(30 * 60000) },
  { id: 'd6', title: 'Product launch plan', slideCount: 8, lastMessageAt: ago(9 * DAY) },
  { id: 'd7', title: 'Product pricing review', slideCount: 5, lastMessageAt: ago(40 * DAY) },
  { id: 'd8', title: '  ', slideCount: 3, lastMessageAt: null },
]
/** The page's handles as fakes: each records its call and changes the page the way the real one does (unless told to do nothing). */
function fakePage(nav, init = {}, behave = {}) {
  const calls = []
  const page = {
    sessionId: 'cur', decksOpen: false, loadSessions: async () => ({ sessions: SESSIONS }), duplicate: null,
    openDeck: id => { calls.push(['openDeck', id]); if (behave.openDeck === 'throw') throw new Error('boom'); if (behave.openDeck !== 'noop') page.sessionId = id },
    toggleDecks: () => { calls.push(['toggleDecks']); if (behave.toggleDecks !== 'noop') page.decksOpen = !page.decksOpen },
    go: path => { calls.push(['go', path]) },
    openTab: path => { calls.push(['openTab', path]) },
    ...init,
  }
  return { page, calls }
}
const READY = nav => ({ status: 'ready', items: nav.decksFromSessions(SESSIONS) })
/** A fresh pair of libs with a fake page and the deck list loaded, the way the composer sets them while rendering. */
function world({ pageInit, behave, decks, pairText } = {}) {
  const libs = loadPair(pairText)
  const fake = fakePage(libs.nav, pageInit, behave)
  libs.nav.setNavLive(fake.page, decks ?? READY(libs.nav))
  return { ...libs, ...fake }
}
const runNav = (w, run, ctx = {}) => w.nav.runNav(run, { building: false, viewer: slideState(), scale: SCALE, ...ctx })
const rowsOf = (w, name, arg, over) => w.viewer.parityRows({ name, arg }, envOf(over))
const labels = list => list.map(row => row.label)

// ============================================================================================================================================
// A. The lib
// ============================================================================================================================================
function libSuite(pairText) {
  const w = world({ pairText })
  const { nav } = w
  const W = nav.NAV_WORDS
  const VW = w.viewer.PARITY_WORDS
  const rows = (name, arg, over) => rowsOf(w, name, arg, over)
  const navOnly = list => list.filter(row => row.group === 'Go to')

  // -- the group: collapsed with nothing typed, all of it behind More, search ----------------------------------------------------------------------
  const all = rows('', null)
  eq(labels(all.filter(row => row.group !== 'Go to')).length, 16, 'the viewer half\'s sixteen rows are still there, untouched')
  eq([...new Set(all.map(row => row.group))], ['Slides', 'View', 'Deck', 'Go to'], 'the group comes after the viewer half\'s three')
  eq(labels(navOnly(all)), ['/open <title>', '/decks', '/dashboard', '/settings', 'More…'], 'nothing typed: the four most used rows and More…')
  eq(all.slice(-5).map(row => row.group), Array(5).fill('Go to'), 'the Go to rows sit together at the end (one heading)')
  eq(navOnly(all).map(row => [row.command, row.fill, row.run]), [['open', true, null], ['decks', false, { name: 'decks' }], ['dashboard', false, { name: 'dashboard' }], ['settings', false, { name: 'settings' }], ['more', true, null]], '/open and More… fill; the others run')
  ok(navOnly(all).every(row => row.disabled === null && row.hint === null), 'with a deck open and nothing unsaved, no Go to row is disabled')
  eq(navOnly(rows('more', null)).map(row => row.command), ['open', 'decks', 'duplicate-deck', 'dashboard', 'themes', 'templates', 'intelligence', 'knowledge', 'settings', 'help', 'shortcuts', 'about'], '/more: every Go to command, in the group\'s order (no More… row)')
  eq(navOnly(rows('more', '')).map(row => row.command).length, 12, 'the filled "/more " shows them all too')
  eq(rows('more', null).filter(row => row.group !== 'Go to'), [], '/more shows nothing of the viewer half')
  eq(labels(rows('dash', null)), ['/dashboard'], 'typing searches all of them: dash')
  eq(labels(rows('sett', null)), ['/settings'], 'typing searches all of them: sett')
  eq(labels(rows('know', null)), ['/knowledge'], 'typing searches all of them: know')
  eq(labels(rows('abou', null)), ['/about'], 'typing searches all of them: abou')
  eq(labels(rows('dup', null)), ['/duplicate-deck'], '/dup finds /duplicate-deck (the slide commands are the existing menu\'s)')
  eq(labels(navOnly(rows('the', null))), ['/themes'], '/the finds /themes next to the viewer half\'s /theme <name>')
  eq(labels(navOnly(rows('temp', null))), ['/templates'], '/temp finds /templates')
  eq(labels(navOnly(rows('s', null))).slice(0, 2), ['/settings', '/shortcuts'], '/s: the names that start with it come first')
  eq(navOnly(rows('nope', null)), [], 'a word that names no Go to command: no rows')
  eq(rows('open', null).map(row => row.label), ['/open <title>'], '/open alone: its one row')
  ok(rows('open', null)[0].fill && rows('open', null)[0].blurb === 'Open one of your decks by name', '/open takes a word: picking it fills "/open "')
  eq(rows('Open', null).map(row => row.command), ['open'], 'the name is not case sensitive')

  // -- no page handles (the flag off, no Builder page): no rows at all ------------------------------------------------------------------------------
  nav.setNavLive(null, nav.NO_DECKS)
  eq(rows('', null).length, 16, 'no page handles: exactly the viewer half\'s sixteen rows')
  eq(rows('open', null), [], 'no page handles: /open has no rows')
  eq(rows('more', null), [], 'no page handles: /more has no rows')
  nav.setNavLive(w.page, READY(nav))

  // -- /open <words>: the deck list ----------------------------------------------------------------------------------------------------------------
  const open = (arg, over, decks) => { if (decks) nav.setNavLive(w.page, decks); const out = rows('open', arg, over); nav.setNavLive(w.page, READY(nav)); return out }
  const ready = open('', undefined)
  eq(ready.length, 5, '/open with no word: five decks, no more')
  eq(ready.map(row => row.run.deck.id), ['d1', 'cur', 'd3', 'd4', 'd5'], '/open with no word: the list\'s own order (the Sessions panel\'s)')
  ok(ready.every(row => row.group === 'Go to' && row.command === 'open' && row.fill === false && row.hint === null), 'every deck row is a Go to row that runs')
  eq(ready.map(row => row.key), ['open:d1', 'open:cur', 'open:d3', 'open:d4', 'open:d5'], 'every deck row has its own key (the deck\'s id)')
  eq(ready.map(row => row.disabled), [null, W.alreadyOpen, null, null, null], 'the deck already on screen is disabled, with its reason')
  eq(ready[0].label, '/open Q3 product review', 'a deck row reads /open <its title>')
  eq(ready[0].blurb, '12 slides · 2 days ago', 'a deck row says how many slides and when')
  eq(ready[2].blurb, '1 slide · 5 days ago', 'one slide is singular')
  eq(ready[3].blurb, '2 wk ago', 'no slide count: only when')
  eq(ready[1].blurb, '9 slides · 1 h ago', 'an hour ago')
  eq(ready[4].blurb, '14 slides · 30 min ago', 'minutes ago')
  eq(plain(ready[0].run), { name: 'open', deck: { id: 'd1', title: 'Q3 product review' } }, 'a deck row runs open with that deck\'s id and title')
  eq(labels(open('review')), ['/open Q3 product review', '/open Quarterly review…the board', '/open Product pricing review'], '/open review: the decks it names, the best match first (exact word before the rest, the list\'s order after)')
  eq(open('quarterly review')[0].run.deck.id, 'd3', '/open quarterly review: the deck with those words')
  eq(open('product').map(row => row.run.deck.id), ['d1', 'd5', 'd6', 'd7'], '/open product: all four, the list\'s order')
  eq(open('prod', undefined).length, 4, 'a prefix matches')
  ok(open('o').length <= 5, 'never more than five')
  eq(open('board').map(row => row.run.deck.id), ['cur', 'd3', 'd4'], '/open board: the two decks that name it, then the one that only has its letters in order (Onboarding), last')
  eq(open('untitled').map(row => row.run.deck.id), ['d8'], 'a deck with no title is "Untitled"')
  eq(open('zzzz').map(row => [row.hint, row.run, row.disabled]), [[W.noDeckMatch('zzzz'), null, null]], 'no deck matches: a hint row that runs nothing')
  eq(open('', undefined, { status: 'ready', items: [] }).map(row => [row.hint, row.run]), [[W.noDecks, null]], 'no decks at all: a hint')
  eq(open('x', undefined, { status: 'loading', items: [] }).map(row => [row.disabled, row.hint, row.run]), [[W.loadingDecks, null, null]], 'still reading the list: one disabled row says so')
  eq(open('x', undefined, { status: 'idle', items: [] }).map(row => [row.disabled, row.run]), [[W.loadingDecks, null]], 'not read yet: the same row')
  eq(open('x', undefined, { status: 'failed', items: [] }).map(row => [row.hint, row.run]), [[W.decksFailed, null]], 'the read failed: a hint')
  // the unsaved-edits rule
  const dirtyRows = open('', { viewer: slideState({ editing: true, save: 'unsaved' }) })
  eq(dirtyRows.map(row => [row.label, row.disabled, row.run]), [['/open', W.dirty, null]], '/open with unsaved edits: ONE disabled row, "Save or discard your edits first." (its label short, so the reason fits the menu)')
  eq(open('x', undefined, { status: 'loading', items: [] }).map(row => row.label), ['/open'], 'the loading row keeps its label short too')
  eq(rows('open', 'a very long thing that somebody typed into the menu').map(row => row.label)[0].length <= 40, true, 'a typed word is cut in a hint row\'s label')
  { const x = world({ pairText, decks: { status: 'ready', items: [{ id: 'orig', title: 'Q3 product review and roadmap', slides: 8, when: null }, { id: 'copy', title: 'Q3 product review and roadmap (copy)', slides: 8, when: null }] } })
    const both = x.viewer.parityRows({ name: 'open', arg: 'q3 product' }, envOf())
    eq(both.map(row => row.label), ['/open Q3 product review…nd roadmap', '/open Q3 product review…map (copy)'], 'a deck and its copy keep different labels (the middle of a long title is cut, not its end)')
    eq(both.map(row => row.run.deck.id), ['orig', 'copy'], '...and each runs its own deck')
    eq(nav.clipMiddle('short', 28), 'short', 'a short title is not cut')
    eq(nav.clipMiddle('x'.repeat(40), 28).length, 28, 'a long title is cut to the limit, whatever it holds') }
  eq(W.dirty, 'Save or discard your edits first.', 'the words the brief names')
  eq(rows('open', null, { viewer: slideState({ save: 'unsaved' }) }).map(row => row.disabled), [W.dirty], 'the /open row itself is disabled while the viewer is dirty')
  eq(rows('open', null, { viewer: slideState({ save: 'error' }) }).map(row => row.disabled), [W.dirty], 'a save that failed is still unsaved')
  eq(rows('open', null, { viewer: slideState({ save: 'saving' }) }).map(row => row.disabled), [W.dirty], 'a save still going is not saved yet')
  eq(rows('open', null, { viewer: slideState({ editing: true, save: 'saved' }) }).map(row => row.disabled), [null], 'Edit mode with nothing changed: nothing to lose')
  eq(rows('open', null, { viewer: null }).map(row => row.disabled), [null], 'no deck on screen: nothing to lose')
  eq(rows('decks', 'prod', { viewer: slideState({ save: 'unsaved' }) }).map(row => row.disabled), [W.dirty], '/decks <words> (which opens a deck) is held the same way')
  eq(rows('decks', null, { viewer: slideState({ save: 'unsaved' }) }).map(row => row.disabled), [null], '...but the deck list panel itself may open (it discards nothing)')
  // /open while a build runs: a new tab, said on the row
  ok(open('', { building: true }).every(row => /^Opens in a new tab/.test(row.blurb)), 'a build running: each deck row says it opens in a new tab')
  ok(open('', { viewer: slideState({ building: true }) }).every(row => /^Opens in a new tab/.test(row.blurb)), '...the viewer\'s own isGenerating counts too')

  // -- /decks ---------------------------------------------------------------------------------------------------------------------------------------
  eq(rows('decks', null).map(row => [row.label, row.run, row.fill]), [['/decks', { name: 'decks' }, false]], '/decks alone toggles the deck list')
  eq(rows('decks', '').map(row => row.run), [{ name: 'decks' }], '/decks with a trailing space: the same row')
  eq(rows('decks', '   ').map(row => row.run), [{ name: 'decks' }], '/decks with only spaces: the same row')
  eq(rows('decks', 'board').map(row => row.run.deck.id), ['cur', 'd3', 'd4'], '/decks board: the matches as rows (the panel has no outside filter)')
  eq(rows('decks', '').length, 1, '/decks with no word is the toggle, not eight decks')
  eq(rows('decks', 'o').length <= 8, true, '/decks <words>: up to eight')
  eq(rows('decks', 'prod').map(row => row.command), ['decks', 'decks', 'decks', 'decks'], '/decks rows keep their own command')
  eq(rows('decks', 'zzz').map(row => row.hint), [W.noDeckMatch('zzz')], '/decks <nothing it names>: a hint')

  // -- the page commands --------------------------------------------------------------------------------------------------------------------------
  for (const name of ['dashboard', 'themes', 'templates', 'intelligence', 'knowledge', 'settings', 'help', 'shortcuts', 'about', 'duplicate-deck']) {
    const hint = rows(name, 'now')
    eq([hint.length, hint[0].hint, hint[0].run], [1, W.nothingAfter(name), null], `a word after /${name}: a hint, not a run`)
  }
  for (const name of ['dashboard', 'themes', 'templates', 'intelligence', 'knowledge', 'settings', 'help', 'shortcuts', 'about']) {
    eq(rows(name, '').map(row => row.run), [{ name }], `/${name} with a trailing space is still the one row`)
    eq(rows(name, null).map(row => row.disabled), [null], `/${name} is never disabled for a build or unsaved edits (it opens a new tab then)`)
  }
  ok(rows('dashboard', null, { building: true })[0].blurb.endsWith('in a new tab') && rows('dashboard', null, { viewer: slideState({ save: 'unsaved' }) })[0].blurb.endsWith('in a new tab') && !rows('dashboard', null)[0].blurb.includes('new tab'), 'the row says "in a new tab" while a build runs or edits are unsaved, and only then')
  ok(!rows('about', null, { building: true })[0].blurb.includes('new tab'), '/about is a dialog: never a new tab')
  eq(nav.isNavName('open') && nav.isNavName('more') && !nav.isNavName('theme') && !nav.isNavName('goto') && !nav.isNavName('layout'), true, 'the viewer half\'s own names are never nav names')
  eq(w.viewer.PARITY_COMMANDS.filter(def => nav.isNavName(def.name)).length, 0, '...so no command name is in both groups')
  eq(nav.NAV_COMMANDS.map(def => def.name).filter(name => w.viewer.PARITY_COMMANDS.some(def => def.name === name)), [], '...and the groups share no name')

  // -- /duplicate-deck: when it cannot run ----------------------------------------------------------------------------------------------------------
  const dup = (init, over) => { const x = world({ pageInit: init, pairText }); return x.viewer.parityRows({ name: 'duplicate-deck', arg: null }, envOf(over))[0] }
  eq(dup({ duplicate: null }).disabled, W.noCopy, 'copying off (NEXT_PUBLIC_STUDIO_DUPLICATE_DECK): disabled, with that reason')
  const copier = { run: async () => ({ ok: true, title: 'x' }) }
  eq(dup({ duplicate: copier }).disabled, null, 'copying on, a saved deck on screen, nothing unsaved: enabled')
  eq(dup({ duplicate: copier }, { viewer: null }).disabled, VW.noDeck, 'no deck on screen: the viewer half\'s own words')
  eq(dup({ duplicate: copier, sessionId: null }).disabled, VW.noDeck, 'a deck with no saved session yet: the same')
  eq(dup({ duplicate: copier }, { building: true }).disabled, VW.building, 'a build running: the viewer half\'s own words')
  eq(dup({ duplicate: copier }, { viewer: slideState({ building: true }) }).disabled, VW.building, '...the viewer\'s own isGenerating too')
  eq(dup({ duplicate: copier }, { viewer: slideState({ save: 'unsaved' }) }).disabled, W.copyEdits, 'unsaved edits: the copy would miss them, so it says so')
  eq(dup({ duplicate: copier }).run, { name: 'duplicate-deck' }, 'the row runs duplicate-deck')

  // -- words and shape ------------------------------------------------------------------------------------------------------------------------------
  const navAll = navOnly(rows('more', null))
  ok(navAll.every(row => row.blurb && row.blurb.length <= 48), 'one short line each (48 characters at most)')
  ok(Object.values(W).every(value => typeof value === 'function' || (typeof value === 'string' && value.length <= 60)), 'every fixed word is short')
  ok(![...Object.values(W).filter(value => typeof value === 'string'), ...navAll.map(row => row.blurb)].some(text => /\b(handler|iframe|postMessage|undefined|null|error code|API|router|session)\b/i.test(text)), 'plain words: no jargon')
  eq(Object.keys(nav.NAV_HANDLERS).sort(), nav.NAV_COMMANDS.map(def => def.name).sort(), 'every command names the handler or route it uses')
  eq(Object.entries(nav.NAV_PAGES).map(([name, page]) => [name, page.path]), [['dashboard', '/dashboard'], ['themes', '/studio/themes'], ['templates', '/studio/templates'], ['intelligence', '/studio/intelligence'], ['knowledge', '/knowledge'], ['settings', '/settings'], ['help', '/help'], ['shortcuts', '/shortcuts']], 'the routes')
  eq(Object.values(nav.NAV_PAGES).map(page => page.label), ['Decks', 'Themes', 'Templates', 'Intelligence', 'Knowledge', 'Settings', 'Help', 'Shortcuts'], 'the names a note uses')
  eq(nav.NAV_COMMANDS.filter(def => def.common).map(def => def.name), ['open', 'decks', 'dashboard', 'settings'], 'the four most used rows are /open, /decks, /dashboard, /settings')
  eq([nav.NAV_DECK_ROWS.open, nav.NAV_DECK_ROWS.decks], [5, 8], '/open shows up to five, /decks <words> up to eight')

  // -- matching, time, sessions -------------------------------------------------------------------------------------------------------------------
  const score = w.viewer.looseScore
  const decks = nav.decksFromSessions(SESSIONS)
  eq(nav.matchDecks(decks, '', score, 3).map(deck => deck.id), ['d1', 'cur', 'd3'], 'matchDecks: an empty word is every deck in the list\'s order, cut at the limit')
  eq(nav.matchDecks(decks, 'Q3 product review', score, 5).map(deck => deck.id)[0], 'd1', 'the same words come first')
  eq(nav.matchDecks([{ id: 'a', title: 'Onboarding playbook', slides: null, when: null }, { id: 'b', title: 'Board update', slides: null, when: null }], 'board', score, 5).map(deck => deck.id), ['b', 'a'], 'matchDecks: a better match listed later comes before a weaker one listed earlier (the word itself before its letters inside another word)')
  eq(nav.matchDecks([], 'x', score, 5), [], 'no decks, no matches')
  eq(nav.decksFromSessions([{ id: '' }, { id: 'a', title: 'T', slideCount: 0, createdAt: '2026-01-01T00:00:00Z' }, null, { id: 'b', title: null, updatedAt: '2026-02-02T00:00:00Z', slideCount: 3 }]).map(deck => [deck.id, deck.title, deck.slides, deck.when]),
    [['a', 'T', null, '2026-01-01T00:00:00Z'], ['b', 'Untitled', 3, '2026-02-02T00:00:00Z']], 'sessions to decks: a missing id is dropped, no title is Untitled, no slides is null, the newest stamp is the time')
  const now = Date.parse('2026-11-11T12:00:00Z')
  eq([nav.ago('2026-11-11T11:59:50Z', now), nav.ago('2026-11-11T11:55:00Z', now), nav.ago('2026-11-11T09:00:00Z', now), nav.ago('2026-11-10T11:00:00Z', now), nav.ago('2026-11-09T11:00:00Z', now), nav.ago('2026-10-20T12:00:00Z', now), nav.ago('2026-08-01T12:00:00Z', now), nav.ago(null, now), nav.ago('not a date', now), nav.ago('2026-11-11T13:00:00Z', now)],
    ['just now', '5 min ago', '3 h ago', '1 day ago', '2 days ago', '3 wk ago', '2026-08-01', null, null, 'just now'], 'ago: just now, minutes, hours, a day, days, weeks, a date; never a thing it cannot read; never a negative time')
  eq(nav.viewerDirty(null), false, 'no viewer: not dirty')
  eq(['saved', 'saving', 'unsaved', 'error'].map(save => nav.viewerDirty(slideState({ save }))), [false, true, true, true], 'dirty is anything but saved')
  eq([nav.awayReason(false, null), nav.awayReason(true, null), nav.awayReason(false, slideState({ building: true })), nav.awayReason(false, slideState({ save: 'unsaved' })), nav.awayReason(true, slideState({ save: 'unsaved' }))], [null, 'build', 'build', 'edits', 'build'], 'away: a build first, then unsaved edits')
  eq([nav.navWantsDecks({ kind: 'command', name: 'open' }), nav.navWantsDecks({ kind: 'command', name: 'Decks' }), nav.navWantsDecks({ kind: 'command', name: 'dashboard' }), nav.navWantsDecks({ kind: 'mention' }), nav.navWantsDecks(null)], [true, true, false, false, false], 'the deck list is read only for /open and /decks')
  return w
}

// ============================================================================================================================================
// B. The run on fake page handles
// ============================================================================================================================================
async function runSuite(pairText) {
  const W = loadPair(pairText).nav.NAV_WORDS
  const fresh = (opts = {}) => world({ pairText, ...opts })
  const PAGES = [['dashboard', '/dashboard', 'Decks'], ['themes', '/studio/themes', 'Themes'], ['templates', '/studio/templates', 'Templates'], ['intelligence', '/studio/intelligence', 'Intelligence'], ['knowledge', '/knowledge', 'Knowledge'], ['settings', '/settings', 'Settings'], ['help', '/help', 'Help'], ['shortcuts', '/shortcuts', 'Shortcuts']]
  // -- the page commands: in place, or a NEW TAB -------------------------------------------------------------------------------------------------
  for (const [name, route, label] of PAGES) {
    { const w = fresh(); const r = await runNav(w, { name }); eq([w.calls, r], [[['go', route]], { ok: true, note: `Opened ${label}` }], `/${name}: router.push(${route}), nothing else, one note`) }
    { const w = fresh(); const r = await runNav(w, { name }, { building: true }); eq([w.calls, r], [[['openTab', route]], { ok: true, note: `Opened ${label} in a new tab so your build keeps going` }], `/${name} while a build runs: a NEW TAB (${route}), never router.push`) }
    { const w = fresh(); const r = await runNav(w, { name }, { viewer: slideState({ building: true }) }); eq([w.calls, r.ok], [[['openTab', route]], true], `/${name}: the viewer's own isGenerating is a build too`) }
    { const w = fresh(); const r = await runNav(w, { name }, { viewer: slideState({ editing: true, save: 'unsaved' }) }); eq([w.calls, r], [[['openTab', route]], { ok: true, note: `Opened ${label} in a new tab so your edits stay here` }], `/${name} with unsaved edits: a new tab, and the note says the edits stay`) }
    { const w = fresh(); const r = await runNav(w, { name }, { building: true, viewer: slideState({ save: 'unsaved' }) }); eq([w.calls.length, /build keeps going/.test(r.note)], [1, true], `/${name}, a build and unsaved edits: one new tab, the build's reason`) }
  }
  { const w = fresh(); const r = await runNav(w, { name: 'dashboard' }, { viewer: null }); eq([w.calls, r.ok], [[['go', '/dashboard']], true], 'no deck on screen (no viewer): opens in place') }
  // the call into the page happens before any wait: a new tab opens inside the key press that chose it
  { const w = fresh(); const pending = runNav(w, { name: 'themes' }, { building: true }); eq(w.calls, [['openTab', '/studio/themes']], 'the new tab is opened SYNCHRONOUSLY (before the first await), so the browser sees the key press as its cause'); await pending }
  { const w = fresh(); const pending = runNav(w, { name: 'dashboard' }); eq(w.calls, [['go', '/dashboard']], 'router.push is called synchronously too'); await pending }
  { const w = fresh({ pageInit: {} }); w.nav.setNavLive(null, w.nav.NO_DECKS); const r = await runNav(w, { name: 'dashboard' }); eq([w.calls, r.ok, r.note], [[], false, W.noPage], 'no page handles: nothing called, said so') }
  { const w = fresh({ behave: {} }); w.page.go = () => { throw new Error('boom') }; const r = await runNav(w, { name: 'help' }); eq([r.ok, /^Opened/.test(r.note)], [false, false], 'a handle that throws: said, not claimed, nothing thrown') }

  // -- /open --------------------------------------------------------------------------------------------------------------------------------------
  { const w = fresh(); const r = await runNav(w, { name: 'open', deck: { id: 'd3', title: 'Quarterly review for the board' } }); eq([w.calls, r], [[['openDeck', 'd3']], { ok: true, note: 'Opened “Quarterly review for the board”' }], '/open: handleSessionSelectWrapped(id), once; said after the page shows that deck') }
  { const w = fresh(); const r = await runNav(w, { name: 'open', deck: { id: 'd3', title: 'T' } }, { building: true }); eq([w.calls, r], [[['openTab', '/builder?session_id=d3']], { ok: true, note: 'Opened “T” in a new tab so your build keeps going' }], '/open while a build runs: a NEW TAB at /builder?session_id=<id>; the Sessions pick is never called') }
  { const w = fresh(); const r = await runNav(w, { name: 'open', deck: { id: 'a b/c', title: 'T' } }, { building: true }); eq(w.calls, [['openTab', '/builder?session_id=a%20b%2Fc']], 'the id is encoded in the new tab\'s address') }
  { const w = fresh(); const r = await runNav(w, { name: 'open', deck: { id: 'd3', title: 'T' } }, { viewer: slideState({ editing: true, save: 'unsaved' }) }); eq([w.calls, r], [[], { ok: false, note: W.dirty }], '/open with unsaved edits: NOTHING is called (no pick, no tab), "Save or discard your edits first."') }
  { const w = fresh(); const r = await runNav(w, { name: 'open', deck: { id: 'd3', title: 'T' } }, { viewer: slideState({ save: 'error' }) }); eq([w.calls, r.note], [[], W.dirty], 'a save that failed is still unsaved: nothing is called') }
  { const w = fresh(); const r = await runNav(w, { name: 'open', deck: { id: 'd3', title: 'T' } }, { building: true, viewer: slideState({ save: 'unsaved' }) }); eq([w.calls, r.note], [[], W.dirty], 'unsaved edits win over a build: still nothing is opened (not even in a tab)') }
  { const w = fresh(); const r = await runNav(w, { name: 'open', deck: { id: 'cur', title: 'T' } }); eq([w.calls, r], [[], { ok: false, note: W.alreadyOpen }], 'the deck already on screen: nothing is called') }
  { const w = fresh({ behave: { openDeck: 'noop' } }); const r = await runNav(w, { name: 'open', deck: { id: 'd3', title: 'T' } }); eq([w.calls, r.ok, /^Opened/.test(r.note), /Couldn't confirm/.test(r.note)], [[['openDeck', 'd3']], false, false, true], 'a pick the page did not make is not claimed') }
  { const w = fresh({ behave: { openDeck: 'throw' } }); const r = await runNav(w, { name: 'open', deck: { id: 'd3', title: 'T' } }); eq([r.ok, /^Opened/.test(r.note)], [false, false], 'a pick that throws: said, not claimed') }
  { const w = fresh(); const long = 'A'.repeat(90); const r = await runNav(w, { name: 'open', deck: { id: 'd9', title: long } }); ok(r.ok && r.note.length < 80 && r.note.includes('…'), 'a long title is cut in the note') }

  // -- /decks ---------------------------------------------------------------------------------------------------------------------------------------
  { const w = fresh(); const a = await runNav(w, { name: 'decks' }); const b = await runNav(w, { name: 'decks' }); eq([w.calls, a.note, b.note, w.page.decksOpen], [[['toggleDecks'], ['toggleDecks']], 'Deck list opened', 'Deck list closed', false], '/decks toggles the Sessions panel and says which way it went (it looked)') }
  { const w = fresh({ pageInit: { decksOpen: true } }); const r = await runNav(w, { name: 'decks' }); eq([r.note, w.page.decksOpen], ['Deck list closed', false], 'open before: it closes, and says closed') }
  { const w = fresh({ behave: { toggleDecks: 'noop' } }); const r = await runNav(w, { name: 'decks' }); eq([r.ok, /opened|closed/.test(r.note)], [false, false], 'a toggle the page did not make is not claimed') }
  { const w = fresh(); const r = await runNav(w, { name: 'decks' }, { building: true, viewer: slideState({ save: 'unsaved', building: true }) }); eq([r.ok, w.calls], [true, [['toggleDecks']]], 'the deck list is a panel: it opens during a build and with unsaved edits') }

  // -- /about ---------------------------------------------------------------------------------------------------------------------------------------
  { const w = fresh(); let heard = 0; const stop = w.nav.subscribeAbout(() => { heard++ }); eq(w.nav.aboutSnapshot(), false, 'About starts closed'); const r = await runNav(w, { name: 'about' }, { building: true }); eq([r, w.nav.aboutSnapshot(), heard, w.calls], [{ ok: true, note: 'About Deckster Studio is open' }, true, 1, []], '/about opens the dialog (also during a build: it is a dialog, not a page), tells the dialog once, touches no page handle'); w.nav.setAboutOpen(true); eq(heard, 1, 'the same state again tells nobody'); w.nav.setAboutOpen(false); eq([w.nav.aboutSnapshot(), heard], [false, 2], 'the dialog closing is heard'); stop(); w.nav.setAboutOpen(true); eq(heard, 2, 'a stopped listener hears nothing') }

  // -- /duplicate-deck ------------------------------------------------------------------------------------------------------------------------------
  { const ran = []; const w = fresh({ pageInit: { duplicate: { run: async () => { ran.push('run'); return { ok: true, title: 'Board update, November (copy)' } } } } })
    const before = w.nav.decksEpoch(); const r = await runNav(w, { name: 'duplicate-deck' })
    eq([ran, r.ok, w.calls], [['run'], true, []], '/duplicate-deck runs the copy once and calls NO page handle: it never switches to the copy, never opens a tab')
    eq(r.note, 'Copied as “Board update, November (copy)”. It stays closed: say /open Board update, November (copy) to switch to it.', 'the note has the copy\'s title and offers /open <that title>')
    eq([w.nav.decksEpoch() - before, w.page.sessionId], [1, 'cur'], 'the deck list is read again next time (the copy is in it); this deck is still on screen') }
  { const w = fresh({ pageInit: { duplicate: { run: async () => ({ ok: false, message: 'Duplicating decks is not available in this environment yet. Nothing was created.' }) } } }); const before = w.nav.decksEpoch(); const r = await runNav(w, { name: 'duplicate-deck' }); eq([r.ok, r.note, w.nav.decksEpoch() - before, w.calls], [false, 'Duplicating decks is not available in this environment yet. Nothing was created.', 0, []], 'a copy that failed says why, word for word, and the list is not marked stale') }
  { const w = fresh({ pageInit: { duplicate: { run: async () => { throw new Error('boom') } } } }); const r = await runNav(w, { name: 'duplicate-deck' }); eq([r.ok, /^Copied/.test(r.note)], [false, false], 'a copy that throws: said, not claimed') }
  { let release; const w = fresh({ pageInit: { duplicate: { run: () => new Promise(resolve => { release = () => resolve({ ok: true, title: 'T (copy)' }) }) } } })
    const first = runNav(w, { name: 'duplicate-deck' }); await new Promise(resolve => setTimeout(resolve, 5)); const second = await Promise.race([runNav(w, { name: 'duplicate-deck' }), new Promise(resolve => setTimeout(() => resolve({ ok: 'hung', note: 'a second copy started and never answered' }), 60))]); eq([second.ok, second.note], [false, W.copying], 'a second /duplicate-deck while one is copying: refused, said'); release(); eq((await first).ok, true, 'the first one still finishes') }
  for (const [label, init, ctx, note] of [['the flag off', { duplicate: null }, {}, W.noCopy], ['a build running', { duplicate: { run: async () => ({ ok: true, title: 'x' }) } }, { building: true }, 'A build is running. Wait for it, or stop it first.'], ['unsaved edits', { duplicate: { run: async () => ({ ok: true, title: 'x' }) } }, { viewer: slideState({ save: 'unsaved' }) }, W.copyEdits], ['no deck', { duplicate: { run: async () => ({ ok: true, title: 'x' }) } }, { viewer: null }, 'Open or build a deck first.']]) {
    let called = 0
    const w = fresh({ pageInit: { ...init, duplicate: init.duplicate ? { run: async () => { called++; return { ok: true, title: 'x' } } } : null } }); const r = await runNav(w, { name: 'duplicate-deck' }, ctx); eq([called, r.ok, r.note], [0, false, note], `/duplicate-deck with ${label}: the copy is NOT started, and it says why`)
  }

  // -- the viewer half's runParity routes a Go to command here, with the viewer's own state --------------------------------------------------------
  { const w = fresh(); const state = slideState({ editing: true, save: 'unsaved' }); const off = w.viewer.registerViewer(() => ({ state, actions: {} }))
    const r = await w.viewer.runParity({ name: 'open', deck: { id: 'd3', title: 'T' } }, { building: false, choosePreset: () => {}, showCanvas: null, scale: SCALE }); eq([r, w.calls], [{ ok: false, note: W.dirty }, []], 'runParity reads the viewer\'s own published state: a dirty viewer holds /open')
    state.save = 'saved'; w.viewer.publishViewerState()
    const r2 = await w.viewer.runParity({ name: 'dashboard' }, { building: true, choosePreset: () => {}, showCanvas: null, scale: SCALE }); eq([r2.ok, w.calls], [true, [['openTab', '/dashboard']]], 'runParity passes the composer\'s "a build is running": a new tab')
    const r3 = await w.viewer.runParity({ name: 'goto', slide: 2 }, { building: false, choosePreset: () => {}, showCanvas: null, scale: SCALE }); eq(r3.ok, false, 'a viewer command still goes to the viewer half (here no handler)')
    off() }
}

// ============================================================================================================================================
// C. The deck-list hook, and the copy through the shared deps
// ============================================================================================================================================
async function hookSuite(navText = read(NAV), hookText = read(DECKS)) {
  // the real hook and the real nav lib on the harness's mini React; the clock is the test's
  const React = require('react')
  const { Root } = await import('./studio-chat-harness/mini-react.mjs')
  const realNow = Date.now
  let clock = 1_000_000
  Date.now = () => clock
  try {
    const loader = createModuleLoader({ root, globals: { process: { env: { NODE_ENV: 'production' } }, console, Date, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp }, fileStubs: {} })
    const nav = loader.load(NAV)
    // a hook module from the given text (for the mutants), wired to the loader's nav lib and the repo's React
    const hookModule = (() => {
      if (hookText === read(DECKS)) return loader.load(DECKS)
      const module = { exports: {} }
      new Function('module', 'exports', 'require', compile(hookText, DECKS))(module, module.exports, specifier => (specifier === 'react' ? React : specifier === '@/lib/studio-chat-parity-nav' ? nav : (() => { throw new Error(`the hook imports ${specifier}`) })()))
      return module.exports
    })()
    const { useChatNavDecks, NAV_DECKS_FRESH_MS } = hookModule
    const out = { current: null }
    const Probe = ({ want, load }) => { out.current = useChatNavDecks(want, load); return null }
    const settleAll = async root => { for (let i = 0; i < 6; i++) { await new Promise(resolve => setTimeout(resolve, 0)); root.flush() } }
    const reads = []
    const loadGood = () => { reads.push('read'); return Promise.resolve({ sessions: SESSIONS }) }
    const r = new Root()
    r.setElement(React.createElement(Probe, { want: false, load: loadGood })); r.flush(); await settleAll(r)
    eq([reads.length, out.current.status], [0, 'idle'], 'hook: nothing is read until the text is /open or /decks')
    r.setElement(React.createElement(Probe, { want: true, load: loadGood })); r.flush()
    eq([reads.length, out.current.status], [1, 'loading'], 'hook: the read starts when the text becomes /open ..., and the rows can say so')
    await settleAll(r)
    eq([out.current.status, out.current.items.length, out.current.items[0]], ['ready', 8, { id: 'd1', title: 'Q3 product review', slides: 12, when: SESSIONS[0].lastMessageAt }], 'hook: the sessions become decks')
    r.setElement(React.createElement(Probe, { want: true, load: loadGood })); r.flush(); await settleAll(r)
    eq(reads.length, 1, 'hook: typing more of the same command reads nothing again')
    r.setElement(React.createElement(Probe, { want: false, load: loadGood })); r.flush(); r.setElement(React.createElement(Probe, { want: true, load: loadGood })); r.flush(); await settleAll(r)
    eq(reads.length, 1, 'hook: the menu closing and opening again within the fresh window reads nothing again')
    clock += NAV_DECKS_FRESH_MS + 1
    r.setElement(React.createElement(Probe, { want: true, load: loadGood })); r.flush(); await settleAll(r)
    eq(reads.length, 1, 'hook: one read per opening: while the text stays /open ... nothing is read again, however long it takes')
    r.setElement(React.createElement(Probe, { want: false, load: loadGood })); r.flush(); r.setElement(React.createElement(Probe, { want: true, load: loadGood })); r.flush()
    eq([reads.length, out.current.status, out.current.items.length], [2, 'ready', 8], 'hook: a stale list is read again, and the old list stays on screen while it is')
    await settleAll(r)
    // a copy was made: the list is stale at once
    r.setElement(React.createElement(Probe, { want: false, load: loadGood })); r.flush()
    { const page = { sessionId: 'cur', decksOpen: false, openDeck() {}, toggleDecks() {}, go() {}, openTab() {}, loadSessions: loadGood, duplicate: { run: async () => ({ ok: true, title: 'x (copy)' }) } }
      nav.setNavLive(page, nav.NO_DECKS); const res = await nav.runNav({ name: 'duplicate-deck' }, { building: false, viewer: { ...slideState(), save: 'saved' }, scale: SCALE }); eq(res.ok, true, 'hook: (setup) a copy was made') }
    r.setElement(React.createElement(Probe, { want: true, load: loadGood })); r.flush(); await settleAll(r)
    eq(reads.length, 3, 'hook: after a copy the list is read again at once, though it was fresh')
    // a failed read
    clock += NAV_DECKS_FRESH_MS + 1
    const failing = []
    const loadBad = () => { failing.push('read'); return Promise.resolve(null) }
    const f = new Root(); f.setElement(React.createElement(Probe, { want: true, load: loadBad })); f.flush(); await settleAll(f)
    eq([out.current.status, out.current.items], ['failed', []], 'hook: a read that fails is "failed" with no decks')
    f.setElement(React.createElement(Probe, { want: false, load: loadBad })); f.flush(); f.setElement(React.createElement(Probe, { want: true, load: loadBad })); f.flush(); await settleAll(f)
    eq(failing.length, 2, 'hook: a failed read is tried again the next time')
    const loadThrow = () => Promise.reject(new Error('offline'))
    const t = new Root(); t.setElement(React.createElement(Probe, { want: true, load: loadThrow })); t.flush(); await settleAll(t)
    eq(out.current.status, 'failed', 'hook: a read that throws is "failed" too')
    // a failed refresh keeps the old list
    clock += NAV_DECKS_FRESH_MS + 1
    const k = new Root(); k.setElement(React.createElement(Probe, { want: true, load: loadGood })); k.flush(); await settleAll(k)
    clock += NAV_DECKS_FRESH_MS + 1
    k.setElement(React.createElement(Probe, { want: false, load: loadBad })); k.flush(); k.setElement(React.createElement(Probe, { want: true, load: loadBad })); k.flush(); await settleAll(k)
    eq([out.current.status, out.current.items.length], ['ready', 8], 'hook: a refresh that fails keeps the list it had')
    // unmounted before the read ends: nothing throws
    let settleRead; const late = new Root()
    late.setElement(React.createElement(Probe, { want: true, load: () => new Promise(resolve => { settleRead = resolve }) })); late.flush(); late.unmount()
    settleRead({ sessions: SESSIONS }); await new Promise(resolve => setTimeout(resolve, 5)); checks++
    // a read still going when the text is typed again: one read, not two
    { const slow = []; const s = new Root()
      const loadSlow = () => { slow.push('read'); return new Promise(() => {}) }
      s.setElement(React.createElement(Probe, { want: true, load: loadSlow })); s.flush()
      s.setElement(React.createElement(Probe, { want: false, load: loadSlow })); s.flush(); s.setElement(React.createElement(Probe, { want: true, load: loadSlow })); s.flush(); await settleAll(s)
      eq(slow.length, 1, 'hook: a read that is still going is not started twice') }
    // no loader given: nothing happens
    const none = new Root(); none.setElement(React.createElement(Probe, { want: true, load: undefined })); none.flush(); await settleAll(none)
    eq(out.current.status, 'idle', 'hook: no loader (no page handles): nothing is read')
  } finally { Date.now = realNow }
}

/** The copy through the shared deps: the real runDuplicateDeck and the real target rule on a recorder (no network). */
async function depsSuite(text = read(DEPS)) {
  const calls = []
  const bodies = []
  const respond = (url, init) => {
    calls.push([init?.method || 'GET', url])
    bodies.push([init?.method || 'GET', url, init?.body ?? null])
    if (/\/duplicate$/.test(url)) return { ok: true, status: 200, json: async () => ({ success: true, presentation_id: 'copy-1', slide_count: 9, url: '/p/copy-1', presentation_url: '/p/copy-1' }) }
    if (url === '/api/sessions') return { ok: true, status: 200, json: async () => ({ session: { id: 'new' } }) }
    return { ok: true, status: 200, json: async () => ({ session: { id: 'new', createdAt: 'x', updatedAt: 'y' } }) }
  }
  const recorder = async (url, init) => respond(url, init)
  const loader = createModuleLoader({
    root,
    globals: { process: { env: { NODE_ENV: 'production' } }, console, Date, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp, setTimeout, URL, encodeURIComponent, decodeURIComponent, fetch: recorder, crypto: { randomUUID: () => crypto.randomUUID() } },
    fileStubs: {
      'lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: { fixture: true }, getLayoutServiceUrl: () => 'https://layout.example.test' },
      'lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: (url) => (/^https:\/\/layout\.example\.test\//.test(url) ? { status: 'allowed', url } : { status: 'blocked' }) },
    },
  })
  const module = { exports: {} }
  // fetch and crypto are PARAMETERS of the module's function, so the helper's `fetch(...)` is the recorder and never the machine's network
  const real = new Function('module', 'exports', 'require', 'fetch', 'crypto', compile(text, DEPS))
  real(module, module.exports, specifier => (specifier === '@/lib/studio-duplicate-deck' ? loader.load('lib/studio-duplicate-deck.ts') : loader.load(`${specifier.slice(2)}.ts`)), recorder, { randomUUID: () => crypto.randomUUID() })
  const { studioDuplicateDeckDeps, duplicateSessionDeck } = module.exports
  const deps = studioDuplicateDeckDeps()
  eq(Object.keys(deps).sort(), ['fetch', 'layoutBaseUrl', 'newId', 'now', 'sleep'], 'deps: the five members the Decks page built inline, no more')
  eq([deps.layoutBaseUrl(), typeof deps.newId(), deps.now() instanceof Date], ['https://layout.example.test', 'string', true], 'deps: Layout\'s base URL (read when asked), a fresh id, the clock')
  ok(deps.newId() !== deps.newId(), 'deps: a fresh id each time')
  await deps.sleep(1); checks++
  const good = { id: 'src', title: 'Board update, November', currentStage: 6, slideCount: 9, finalPresentationUrl: 'https://layout.example.test/p/abc-123', strawmanPreviewUrl: null }
  const done = await duplicateSessionDeck(good)
  eq(done, { ok: true, title: 'Board update, November (copy)' }, 'copy: a title for the new deck, the Decks page\'s own rule (<title> (copy))')
  eq(calls.map(([method, url]) => `${method} ${url.replace('https://layout.example.test', '')}`), ['POST /api/presentations/abc-123/duplicate', 'POST /api/sessions', 'PATCH /api/sessions/' + calls[2][1].split('/').pop()], 'copy: Layout copies the deck, then the new session row, then its patch: three steps in the Decks page\'s order, nothing else')
  eq(await duplicateSessionDeck({ ...good, finalPresentationUrl: null, strawmanPreviewUrl: null }), { ok: false, message: 'Duplicate needs a saved deck; this session has none yet.' }, 'copy: no deck yet: the library\'s own words, nothing is sent')
  eq((await duplicateSessionDeck({ ...good, finalPresentationUrl: 'https://elsewhere.example.test/p/zzz' })).message, 'Duplicate is unavailable: this deck is stored in another environment.', 'copy: another environment\'s Layout: the library\'s own words')
  eq((await duplicateSessionDeck({ ...good, title: '   ' })).title, 'Untitled Presentation (copy)', 'copy: no title is "Untitled Presentation"')
  eq(JSON.parse(bodies.filter(entry => entry[0] === 'PATCH').pop()[2]).stateCache.currentStatus.copiedFrom, { sessionId: 'src', title: 'Untitled Presentation' }, 'copy: the marker on the new session names the source by the same shown title')
  eq(JSON.parse(bodies.filter(entry => entry[0] === 'PATCH')[0][2]).stateCache.currentStatus.copiedFrom, { sessionId: 'src', title: 'Board update, November' }, 'copy: ...and by the deck\'s own title when it has one')
  eq(calls.filter(([, url]) => !/layout\.example\.test|^\/api\/sessions/.test(url)), [], 'copy: no request went anywhere else')
}

// ============================================================================================================================================
// D. The sources
// ============================================================================================================================================
const MARK = strip.CHAT_PARITY_NAV_MARKER_RE
const importLines = text => text.split('\n').filter(line => /^import\s/.test(line))
const addedLines = (rel, from = strip.VIEWER_HEAD) => git('diff', '--no-color', '-U0', from, '--', rel).split('\n').filter(line => /^\+(?!\+\+)/.test(line)).map(line => line.slice(1))
const removedLines = (rel, from = strip.VIEWER_HEAD) => git('diff', '--no-color', '-U0', from, '--', rel).split('\n').filter(line => /^-(?!--)/.test(line)).map(line => line.slice(1))
const routeExists = route => [`app${route}/page.tsx`, `app/(app)${route}/page.tsx`].some(rel => fs.existsSync(path.join(root, rel)))
/** The older proof's registry-read line, run on a fake `fs` that returns the real file: what that proof sees when it reads `rel`. */
function readThrough(pinRel, rel) {
  const lines = read(pinRel).split('\n').filter(line => /^\{ const realRead = fs\.readFileSync/.test(line))
  ok(lines.length >= 1 && lines.some(line => /registry read \(CHAT-PARITY-NAV\)/.test(line)), `${pinRel}: this change's registry-read line is there`)
  const fake = { readFileSync: (file, enc) => fs.readFileSync(file, enc) }
  for (const line of lines) new Function('fs', 'path', 'root', 'stripChatParityViewer', 'CHAT_PARITY_VIEWER_FILES', 'stripChatParityNav', 'CHAT_PARITY_NAV_READ_FILES', line)(fake, path, root, viewerStrip.stripChatParityViewer, viewerStrip.CHAT_PARITY_VIEWER_FILES, strip.stripChatParityNav, strip.CHAT_PARITY_NAV_READ_FILES)
  return fake.readFileSync(path.join(root, rel), 'utf8')
}

function pageChecks(text, label = 'page') {
  const lines = text.split('\n')
  const marked = lines.filter(line => MARK.test(line)), block = marked.join('\n')
  ok(/if \(chatCommandsPage\) chatCommandsPage\.nav = \{ sessionId: currentSessionId, decksOpen: showChatHistory,/.test(block), `${label}: the handles exist only with the commands flag on (chatCommandsPage is undefined with it off) and carry the deck on screen and the panel's state`)
  ok(/openDeck: id => handleSessionSelectWrapped\(id\)/.test(block), `${label}: /open is handleSessionSelectWrapped`)
  ok(/toggleDecks: \(\) => setShowChatHistory\(prev => !prev\)/.test(block), `${label}: /decks is the Sessions panel's own toggle (setShowChatHistory)`)
  ok(/go: path => router\.push\(path\)/.test(block), `${label}: pages open with router.push`)
  ok(/openTab: path => \{ window\.open\(path, '_blank', 'noopener'\) \}/.test(block), `${label}: a new tab is window.open with noopener`)
  ok(/loadSessions: \(\) => chatNavLoadSessions\(\{ limit: 50, status: 'active' \}\)/.test(block), `${label}: the deck list is the Sessions panel's own loadSessions call, same arguments`)
  ok(/duplicate: process\.env\.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK === 'true' \? \{ run: async \(\) => \{ if \(!currentSessionId\) return/.test(block), `${label}: /duplicate-deck exists only with the Decks page's own flag`)
  ok(/await loadSession\(currentSessionId\)/.test(block) && /\(await import\('@\/lib\/studio-duplicate-deck-deps'\)\)\.duplicateSessionDeck\(row\)/.test(block), `${label}: the copy reads the saved deck, then runs the shared deps (loaded when asked, not imported)`)
  ok(/const \{ loadSessions: chatNavLoadSessions \} = useChatSessions\(\)/.test(block) && /\n  const \{ loadSession, loadSessionResult, createSession \} = useChatSessions\(\)\n  const \{ loadSessions: chatNavLoadSessions \} = useChatSessions\(\)/.test(text), `${label}: loadSessions comes from the hook the page already uses, on its own line right after the page's own destructuring (which is untouched: the session-hygiene proof pins it)`)
  eq(importLines(text).filter(line => /studio-chat-parity-nav|studio-duplicate-deck-deps/.test(line)), [], `${label}: no new import line (the Builder page's many proofs see no new import)`)
  ok(/const handleSessionSelectWrapped = useCallback\(\(sessionId: string\) => \{/.test(text) && /session\.handleSessionSelect\(sessionId\)/.test(text), `${label}: handleSessionSelectWrapped is a real handler (a base line)`)
  ok(/onSessionSelect=\{handleSessionSelectWrapped\}/.test(text) && /onOpenChatHistory=\{\(\) => setShowChatHistory\(\(prev\) => !prev\)\}/.test(text), `${label}: ...the one the Sessions panel's pick and the header's toggle use (base lines)`)
  ok(/const router = useRouter\(\)/.test(text) && /const \[showChatHistory, setShowChatHistory\] = useState\(false\)/.test(text), `${label}: router and the panel's state are real (base lines)`)
  ok(/const \[currentSessionId, setCurrentSessionId\] = useState<string \| null>/.test(text), `${label}: the deck on screen is currentSessionId (a base line)`)
  ok(text.indexOf('chatCommandsPage.parity = ') < text.indexOf('chatCommandsPage.nav = '), `${label}: the handles follow the viewer half's note line`)
}

function hookChecks(text, label = 'hook') {
  const lines = text.split('\n')
  const block = lines.filter(line => MARK.test(line)).join('\n')
  ok(/useChatNavDecks\(Boolean\(enabled && page\?\.nav && navWantsDecks\(trigger\)\), page\?\.nav\?\.loadSessions\)/.test(block), `${label}: the deck list is read only with the flag on, a page handle, and a /open or /decks trigger`)
  ok(/setNavLive\(enabled \? page\?\.nav \?\? null : null, navDecks\)/.test(block), `${label}: with the flag off the live handle is null (no Go to row, nothing to run)`)
  ok(text.indexOf('useChatNavDecks(') < text.indexOf('const parity: ParityRow[]') && text.indexOf('setNavLive(') < text.indexOf('const parity: ParityRow[]') && text.indexOf('const parityEnv') < text.indexOf('useChatNavDecks('), `${label}: the live handle is set before the rows are built (after the viewer half's env)`)
  ok(/menu: <>\{menu\}<ChatNavAbout \/><\/>/.test(block), `${label}: the existing About dialog is mounted with the menu (closed, it draws nothing)`)
  ok(/if \(!STUDIO_CHAT_COMMANDS_ENABLED \|\| input\.page === null\) return INERT/.test(text) && text.indexOf('useChatNavDecks(') < text.indexOf('return INERT'), `${label}: the hooks are all called before the inert return (a stable hook order), which is unchanged`)
  eq(importLines(text).filter(line => /parity-nav/.test(line)).length, 3, `${label}: three import lines, all marked`)
  ok(importLines(text).filter(line => /parity-nav/.test(line)).every(line => MARK.test(line)), `${label}: ...every one carries the marker`)
  ok(/const pickAt = \(index: number\) => \{\n    if \(trigger\?\.kind === 'command'\) \{ if \(rows\[index\]\) pickCommand\(rows\[index\]\); else if \(parity\[index - rows\.length\]\) pickParity\(parity\[index - rows\.length\]\)/.test(text), `${label}: the Go to rows are picked through the viewer half's own path (same index, same hint / disabled rule: nothing of it is edited)`)
}

async function sourceChecks() {
  // the strip: every file back to the viewer half's head, byte for byte
  if (hasHead) {
    for (const rel of [...strip.CHAT_PARITY_NAV_FILES, ...strip.CHAT_PARITY_NAV_VIEWER_NEW_EDITED]) {
      const now = read(rel), head = showAt(strip.VIEWER_HEAD, rel)
      ok(now !== head, `${rel}: it is changed`)
      ok(strip.stripChatParityNav(rel, now) === head, `${rel}: the strip puts it back to the viewer half's head, byte for byte`)
      ok(strip.stripChatParityNav(rel, head) === head, `${rel}: the strip leaves the viewer half's head alone`)
      ok(strip.stripChatParityNav(rel, strip.stripChatParityNav(rel, now)) === head, `${rel}: ...and stripping twice changes nothing more`)
      const marked = addedLines(rel).filter(line => MARK.test(line)), unmarked = addedLines(rel).filter(line => !MARK.test(line))
      eq(unmarked, [], `${rel}: every line added to it carries the marker`)
      const was = removedLines(rel), pairs = (strip.CHAT_PARITY_NAV_EDITS[rel] || []).flatMap(([, before]) => before.split('\n'))
      eq(was.slice().sort(), pairs.slice().sort(), `${rel}: the only viewer-head lines gone are the recorded changed lines`)
      for (const [line, before] of strip.CHAT_PARITY_NAV_EDITS[rel] || []) { ok(MARK.test(line) && now.split('\n').filter(item => item === line).length === 1, `${rel}: a changed line carries the marker and occurs once`); ok(!MARK.test(before), `${rel}: the line before is the viewer half's`) }
      ok(marked.length > 0, `${rel}: has marked lines`)
    }
    // through the registry, both sides: the registry's own order (the viewer half's strip, then this one) reaches the base for the existing files
    if (hasBase) for (const rel of strip.CHAT_PARITY_NAV_FILES) {
      ok(registry.stripLaterChanges(rel, read(rel)) === registry.stripLaterChanges(rel, showAt(strip.BASE_COMMIT, rel)), `${rel}: through the registry (every registered change strips its own lines) it is the base's`)
      ok(viewerStrip.stripChatParityViewer(rel, strip.stripChatParityNav(rel, read(rel))) === showAt(strip.BASE_COMMIT, rel), `${rel}: this strip, then the viewer half's, is the base's`)
    }
    // the older proofs this change teaches: each puts back to the viewer half's head, and (composite) to the text before the viewer half
    for (const rel of strip.CHAT_PARITY_NAV_PIN_FILES) {
      ok(strip.stripChatParityNav(rel, read(rel)) === showAt(strip.VIEWER_HEAD, rel), `${rel}: the taught lines put back to the viewer half's head`)
      if (hasBase && viewerStrip.CHAT_PARITY_VIEWER_PIN_FILES.includes(rel)) ok(strip.stripChatParityNavAfterViewer(rel, read(rel)) === showAt(strip.BASE_COMMIT, rel), `${rel}: ...and through the registry's strip, the text before the viewer half`)
      const lines = read(rel).split('\n').filter(line => MARK.test(line))
      ok(lines.length > 0 && lines.every(line => /registry read \(CHAT-PARITY-NAV\)/.test(line)), `${rel}: every line of this change in it says "registry read (CHAT-PARITY-NAV)"`)
      for (const [line, before] of strip.CHAT_PARITY_NAV_PIN_EDITS[rel]) { ok(read(rel).split('\n').filter(item => item === line.replace(/\n$/, '')).length === 1, `${rel}: a taught line occurs once`); ok(!MARK.test(before), `${rel}: the line before is not this change's`) }
    }
    // the registry-read lines in the older proofs, run: what each proof sees when it reads a file this change touched
    if (hasBase) for (const rel of strip.CHAT_PARITY_NAV_FILES) eq(readThrough('scripts/test-studio-chat-commands.mjs', rel) === showAt(strip.BASE_COMMIT, rel), true, `the chat commands proof reads ${rel} through its registry-read lines (the viewer half's, then this one's) as the base had it`)
    for (const rel of [...strip.CHAT_PARITY_NAV_FILES, ...strip.CHAT_PARITY_NAV_VIEWER_NEW_EDITED, REGISTRY]) ok(readThrough('scripts/test-studio-chat-parity-viewer.mjs', rel) === showAt(strip.VIEWER_HEAD, rel), `the viewer half's proof reads ${rel} as the viewer half had it (its registry-read line)`)
    for (const rel of ['hooks/use-deckster-websocket-v2.ts', '.env.example', 'package.json', 'lib/studio-chat-commands-wire.ts', 'components/builder/studio-chat-commands.css', 'components/presentation-viewer.tsx', 'components/builder/chat-input.tsx', 'components/builder/chat/studio-chat-clean.tsx', 'lib/studio-chat-clean.ts', 'components/chat-history-sidebar.tsx', 'components/studio-about-dialog.tsx', 'lib/studio-duplicate-deck.ts', 'components/builder/studio-chat-parity-viewer.css', DASHBOARD]) ok(read(rel) === showAt(strip.VIEWER_HEAD, rel), `${rel}: not touched by this change`)
  } else console.log(`NOTE D  git has no ${strip.VIEWER_HEAD.slice(0, 8)}: the head-identity checks were skipped`)
  pageChecks(read(PAGE))
  hookChecks(read(COMMANDS_UI))
  // the registry: two lines, last in their lists, naming this change's files and strip
  const reg = read(REGISTRY)
  const regLines = reg.split('\n').filter(line => line.includes(strip.CHAT_PARITY_NAV_REGISTRY_MARK))
  eq(regLines.length, 2, 'registry: two lines')
  ok(regLines.every(line => line.includes('// LATER-CHANGE: ')), 'registry: both marked LATER-CHANGE')
  for (const rel of strip.CHAT_PARITY_NAV_SCOPE_FILES) ok(registry.LATER_CHANGE_FILES.has(rel), `registry: ${rel} is registered`)
  ok(registry.LATER_STRIPS[registry.LATER_STRIPS.length - 1] === strip.stripChatParityNavAfterViewer && registry.LATER_STRIPS.includes(viewerStrip.stripChatParityViewer) && registry.LATER_STRIPS.indexOf(viewerStrip.stripChatParityViewer) < registry.LATER_STRIPS.length - 1, 'registry: the strip is registered, last, after the viewer half\'s')
  eq(registry.LATER_ENV_BLOCKS.some(block => /STUDIO_CHAT_PARITY_NAV/.test(String(block))), false, 'registry: no .env.example block (no flag of its own)')
  const lastFilesLine = reg.split('\n').filter(line => /^  \.\.\.\(await import\(/.test(line)).pop()
  ok(/studio-chat-parity-nav-strip\.mjs/.test(lastFilesLine) && reg.indexOf(lastFilesLine) < reg.indexOf('// one line per later change, above this comment'), 'registry: appended at the end of the files list, above the marker comment')
  const lastStripLine = reg.split('\n').filter(line => /^  \(await import\(.*Strip|^  \(await import\(.*strip/.test(line)).pop()
  ok(/studio-chat-parity-nav-strip\.mjs/.test(lastStripLine), 'registry: appended at the end of the strips list')
  eq(registry.stripLaterChanges(REGISTRY, reg).split('\n').filter(line => line.includes('studio-chat-parity-nav-strip')).length, 0, 'registry: the registry\'s own strip leaves none of this change\'s lines')
  // the files this change adds are not in the registry's strip of any other file
  eq(strip.stripChatParityNav('lib/studio-chat-parity-nav.ts', read(NAV)), read(NAV), 'a new file of this change is returned as it is')
  // no new flag: the only flags this change names are the commands flag it is behind, the ones that commands flag needs, and the Decks page's own
  const flagNames = new Set()
  const scan = text => { for (const match of text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) flagNames.add(match[0]) }
  for (const rel of [NAV, DEPS, DECKS, ABOUT]) scan(read(rel))
  if (hasHead) for (const rel of [...strip.CHAT_PARITY_NAV_FILES, ...strip.CHAT_PARITY_NAV_VIEWER_NEW_EDITED]) scan(addedLines(rel).join('\n'))
  eq([...flagNames].sort(), ['NEXT_PUBLIC_STUDIO_CHAT_CLEAN', 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS', 'NEXT_PUBLIC_STUDIO_DUPLICATE_DECK'], 'no new flag: the commands flag it sits behind, the chat clean flag that needs, and the Decks page\'s own copy flag (set only by the page line)')
  // the routes exist, and each is one the rail or the account menu already links to
  const { NAV_PAGES } = loadPair().nav
  for (const [name, page] of Object.entries(NAV_PAGES)) {
    ok(routeExists(page.path), `/${name}: the route ${page.path} exists on this branch`)
    const linkers = ['components/layout/studio-rail.tsx', 'components/builder/builder-header.tsx', 'components/user-profile-menu.tsx', 'components/user-profile-menu-p2.tsx', 'lib/studio-profile-menu.ts', 'components/layout/app-header.tsx', 'components/studio-about-dialog.tsx', 'components/layout/studio-phone-tab-bar.tsx', 'app/(app)/layout.tsx'].filter(rel => fs.existsSync(path.join(root, rel)) && [`'${page.path}'`, `"${page.path}"`, `\`${page.path}`].some(quoted => read(rel).includes(quoted)))
    ok(linkers.length > 0, `/${name}: ${page.path} is a route the app already links to (${linkers.join(', ')})`)
  }
  ok(routeExists('/settings/profile'), '/settings: the page it redirects to exists')
  ok(/redirect\("\/settings\/profile"\)/.test(read('app/(app)/settings/page.tsx')), '/settings: the settings index redirects to Profile')
  // the Decks page: NOT touched (older proofs hold its duplicateSession by exact text, through strips of their own), and the helper's deps are its inline deps, member by member
  const dashboard = read(DASHBOARD)
  ok(!MARK.test(dashboard) && !/studio-duplicate-deck-deps/.test(dashboard), 'Decks page: no line of this change, no import of the helper')
  if (hasHead) ok(dashboard === showAt(strip.VIEWER_HEAD, DASHBOARD), 'Decks page: byte for byte the viewer half\'s head (it is not touched)')
  if (hasBase) ok(dashboard === showAt(strip.BASE_COMMIT, DASHBOARD), 'Decks page: ...which is the base\'s file')
  const inline = /deps: \{\n((?:\s+\w+: .*\n){5})\s+\},\n/.exec(dashboard)
  ok(Boolean(inline), 'Decks page: the inline deps object (five members) is where it was')
  const depsText = read(DEPS)
  const members = (inline ? inline[1] : '').split('\n').map(line => line.trim().replace(/,$/, '')).filter(Boolean)
  eq(members.length, 5, 'Decks page: five inline members')
  for (const member of members) ok(depsText.includes(`  ${member},`) || depsText.includes(`  ${member}\n`), `helper: the Decks page's member "${member}" is in the helper, the same text`)
  ok(dashboard.includes('const target = duplicateTargetFor(presentation, url => evaluateLayoutViewerUrl(url, LAYOUT_VIEWER_URL_POLICY))') && /runDuplicateDeck\(\{\n\s+source: \{ sessionId: presentation\.id, shownTitle, currentStage: presentation\.currentStage, slideCount: presentation\.slideCount \},\n\s+target,/.test(dashboard), 'Decks page: the target rule and the call the helper mirrors (the helper\'s duplicateSessionDeck)')
  // the text detection: several words after /open and /decks only; the older rules are untouched
  const cmdLib = read(COMMANDS_LIB)
  ok(cmdLib.includes('const COMMAND_RE = /(^|\\s)\\/([\\w-]*)(?: ([\\w-]*))?$/') && cmdLib.includes('const COMMAND_WORDS_RE = /(^|\\s)\\/(layout|theme) ([^\\n]*)$/i'), 'commands lib: the one-word rule and the viewer half\'s two-name rule are untouched')
  ok(cmdLib.includes('const NAV_WORDS_RE = /(^|\\s)\\/(open|decks) ([^\\n]*)$/i') && cmdLib.indexOf('NAV_WORDS_RE.exec(text)') > cmdLib.indexOf('COMMAND_WORDS_RE.exec(text)') && cmdLib.indexOf('NAV_WORDS_RE.exec(text)') < cmdLib.indexOf('COMMAND_RE.exec(text)'), 'commands lib: several words only after /open and /decks, tried after the viewer half\'s and before the one-word rule')
  ok(/nav\?: import\('@\/lib\/studio-chat-parity-nav'\)\.ChatParityNavPage \/\/ CHAT-PARITY-NAV/.test(cmdLib), 'commands lib: the page props carry the handles, typed by the nav lib')
  const loaded = repoLoader.load(COMMANDS_LIB)
  const detect = text => plain(loaded.detectTrigger(text))
  eq([detect('/open'), detect('/open '), detect('/open q3 board review'), detect('say /decks board'), detect('/duplicate-deck'), detect('/dashboard'), detect('/more '), detect('/layout image text')],
    [{ kind: 'command', start: 0, name: 'open', arg: null }, { kind: 'command', start: 0, name: 'open', arg: '' }, { kind: 'command', start: 0, name: 'open', arg: 'q3 board review' }, { kind: 'command', start: 4, name: 'decks', arg: 'board' }, { kind: 'command', start: 0, name: 'duplicate-deck', arg: null }, { kind: 'command', start: 0, name: 'dashboard', arg: null }, { kind: 'command', start: 0, name: 'more', arg: '' }, { kind: 'command', start: 0, name: 'layout', arg: 'image text' }],
    'detectTrigger: /open and /decks take several words; /duplicate-deck is one name; the viewer half\'s rule is as it was')
  eq([detect('/dashboard now'), detect('hello'), detect('/theme dark')], [{ kind: 'command', start: 0, name: 'dashboard', arg: 'now' }, null, { kind: 'command', start: 0, name: 'theme', arg: 'dark' }], 'detectTrigger: another name keeps the one-word rule')
  // the libs: no browser, no network, no router, no flag read, no secrets
  for (const [rel, extra] of [[NAV, [[/\bwindow\b|\bdocument\b|\blocalStorage\b/, 'no browser globals'], [/\bfetch\s*\(|XMLHttpRequest|WebSocket/, 'no network'], [/useRouter|next\/navigation/, 'no router (the page hands it over)'], [/process\.env/, 'no flag read (the page and the composer gate it)'], [/\bimport\s+React|from 'react'/, 'no React'], [/\bconfirm\s*\(/, 'no confirm box']]], [DEPS, [[/\bconfirm\s*\(/, 'no confirm box'], [/localStorage|sessionStorage/, 'no storage']]]]) {
    const code = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const [pattern, why] of extra) ok(!pattern.test(code), `${rel}: ${why}`)
  }
  eq(importLines(read(NAV)).map(line => line.replace(/^import .* from /, '')), ["'@/lib/studio-chat-parity-viewer'"], 'nav lib: imports only types from the viewer half\'s lib (nothing at run time: no cycle)')
  ok(/^import type /.test(importLines(read(NAV))[0]), 'nav lib: ...and that import is type-only')
  eq(importLines(read(DEPS)).map(line => line.replace(/^import .* from /, '')), ["'@/lib/layout-service-client'", "'@/lib/layout-viewer-url-policy'", "'@/lib/studio-duplicate-deck'"], 'deps helper: imports exactly what the Decks page used for it')
  ok(!/(sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[:=]|Bearer\s+[A-Za-z0-9]|-----BEGIN)/i.test([NAV, DEPS, DECKS, ABOUT].map(read).join('\n')), 'no secrets in this change\'s new files')
  // the About dialog: the existing component, driven by the nav lib's own state
  const aboutText = read(ABOUT)
  ok(/<StudioAboutDialog open=\{open\} onOpenChange=\{setAboutOpen\} \/>/.test(aboutText) && /useSyncExternalStore\(subscribeAbout, aboutSnapshot, \(\) => false\)/.test(aboutText), 'about: the existing StudioAboutDialog, open from the nav lib\'s state (false on the server)')
  ok(/export function StudioAboutDialog\(\{ open, onOpenChange/.test(read('components/studio-about-dialog.tsx')), 'about: the dialog\'s real signature (a base file)')
  // the committed diff is this change's files (the COMMITTED diff only: a working-tree edit is not read here)
  if (OWN.length && hasHead) {
    // the COMMITTED diff of the whole change (the viewer half's head to this branch's head): a commit that touched a file and a later one that put it back leave it out, as they leave the tree
    const touched = new Set(git('diff', '--name-only', strip.VIEWER_HEAD, 'HEAD').split('\n').filter(Boolean))
    const stray = [...touched].filter(rel => !strip.CHAT_PARITY_NAV_SCOPE_FILES.has(rel))
    eq(stray, [], 'the committed diff of this change (viewer half\'s head to HEAD) is its own files (strays: none)')
    ok(!touched.has(DASHBOARD), 'the Decks page is not in the committed diff (the move into the helper was put back: see the strip\'s head)')
    eq([...strip.CHAT_PARITY_NAV_SCOPE_FILES].filter(rel => !touched.has(rel)), [], 'every file the registry names for this change is in that diff (nothing is named that was not touched)')
    for (const sha of OWN) ok(git('diff-tree', '--no-commit-id', '--name-only', '-r', '-m', '--first-parent', sha).split('\n').filter(Boolean).every(rel => strip.CHAT_PARITY_NAV_SCOPE_FILES.has(rel) || rel === DASHBOARD), `commit ${sha.slice(0, 8)} touches only this change's files (or the Decks page it put back)`)
    ok(OWN.every(sha => /Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>/.test(git('log', '-1', '--format=%B', sha))), 'every commit of this change carries the Co-Authored-By line')
    ok(OWN.every(sha => git('log', '-1', '--format=%s', sha).startsWith(strip.CHAT_PARITY_NAV_SUBJECT)), 'every commit of this change has the "Chat parity nav:" subject')
    const parents = git('rev-list', '--parents', '-n', '1', OWN[OWN.length - 1]).trim().split(' ')
    ok(parents.length === 2, 'this change\'s oldest commit has one parent (no merge, no rewrite of the viewer half)')
    eq(git('merge-base', '--is-ancestor', strip.VIEWER_HEAD, 'HEAD') === '' ? 'ancestor' : 'not', 'ancestor', 'the viewer half\'s head is an ancestor of this branch (stacked, never rebased)')
  } else console.log(`NOTE D  no own commit yet (subject "${strip.CHAT_PARITY_NAV_SUBJECT} ..."): the committed-diff check was skipped`)
}

/** The menu markup with the Go to group: the viewer half's real component, given real nav rows. */
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
  const w = world()
  const rowProps = index => ({ id: `opt-${index}`, role: 'option', type: 'button', 'aria-selected': index === 18, className: 'row' })
  const html = renderToStaticMarkup(React.createElement(module.exports.ChatParityRows, { rows: rowsOf(w, '', null), offset: 12, rowProps, headingClass: 'heading' }))
  eq([...html.matchAll(/data-studio-chat-commands-heading="([\w ]+)"/g)].map(match => match[1]), ['slides', 'view', 'deck', 'go to'], 'menu: four headings, Slides, View, Deck, Go to')
  eq([...html.matchAll(/id="opt-(\d+)"/g)].map(match => Number(match[1])), Array.from({ length: 21 }, (_, i) => 12 + i), 'menu: one index list after the existing rows, through the Go to rows (arrows and ARIA ids work through it)')
  ok(['open', 'decks', 'dashboard', 'settings', 'more'].every(command => html.includes(`data-studio-chat-command="${command}"`)), 'menu: the four rows and More… are drawn, each with an icon')
  ok(/aria-label="\/open &lt;title&gt;: Open one of your decks by name"/.test(html) && /aria-label="More…: Show every Go to command"/.test(html), 'menu: the labels for assistive technology')
  const more = renderToStaticMarkup(React.createElement(module.exports.ChatParityRows, { rows: rowsOf(w, 'more', null), offset: 0, rowProps, headingClass: 'heading' }))
  eq([...more.matchAll(/data-studio-chat-command="([\w-]+)"/g)].map(match => match[1]), ['open', 'decks', 'duplicate-deck', 'dashboard', 'themes', 'templates', 'intelligence', 'knowledge', 'settings', 'help', 'shortcuts', 'about'], 'menu: /more draws all twelve under one heading')
  eq((more.match(/data-studio-chat-commands-heading/g) || []).length, 1, 'menu: ...under one heading')
  const dirty = renderToStaticMarkup(React.createElement(module.exports.ChatParityRows, { rows: rowsOf(w, 'open', '', { viewer: slideState({ save: 'unsaved' }) }), offset: 0, rowProps, headingClass: 'heading' }))
  ok(dirty.includes('Save or discard your edits first.') && dirty.includes('aria-disabled="true"'), 'menu: the unsaved-edits reason is on the row, and the row is aria-disabled')
  const decks = renderToStaticMarkup(React.createElement(module.exports.ChatParityRows, { rows: rowsOf(w, 'open', 'board'), offset: 0, rowProps, headingClass: 'heading' }))
  ok(decks.includes('/open Board update, November') && decks.includes('This deck is already open.') && decks.includes('/open Quarterly review…the board'), 'menu: deck rows read /open <title>; the open deck says so')
  const hint = renderToStaticMarkup(React.createElement(module.exports.ChatParityRows, { rows: rowsOf(w, 'open', 'zzzz'), offset: 0, rowProps, headingClass: 'heading' }))
  ok(hint.includes('No deck matches &quot;zzzz&quot;.') && hint.includes('data-studio-chat-parity-hint="true"') && hint.includes('aria-disabled="true"'), 'menu: a hint row says it inline and cannot be picked')
}

// ============================================================================================================================================
// E. Mutants: each must be caught by A-D
// ============================================================================================================================================
async function mutantsSuite() {
  const navText = read(NAV)
  let mutantsCaught = 0
  const hit = (condition, message) => { mutantsCaught++; ok(condition, message) }
  const caught = async (name, from, to, suites) => {
    const mutated = navText.replace(from, () => to)
    assert.notEqual(mutated, navText, `mutant applies: ${name}`)
    let threw = false
    try { libSuite({ navText: mutated }); await runSuite({ navText: mutated }) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  await caught('/open never checks unsaved edits (rows)', "case 'open': return viewerDirty(viewer) ? NAV_WORDS.dirty : null", "case 'open': return null")
  await caught('/open never checks unsaved edits (deck rows)', "  if (dirty) return [{ ...rowOf(name, bare, '', null), disabled: NAV_WORDS.dirty }]\n", '')
  await caught('a build no longer sends a page to a new tab', "if (building || Boolean(viewer?.building)) return 'build'", "if (Boolean(viewer?.building)) return 'build'")
  await caught('unsaved edits no longer send a page to a new tab', "return viewerDirty(viewer) ? 'edits' : null", 'return null')
  await caught('/open claims the deck opened without looking', 'return (await settle(current => current.sessionId === id, wait(NAV_WAIT.open))) ? done', 'return (await settle(() => true, wait(NAV_WAIT.open))) ? done')
  await caught('/decks claims the toggle without looking', 'return (await settle(current => current.decksOpen === want, wait(NAV_WAIT.decks))) ? done', 'return (await settle(() => true, wait(NAV_WAIT.decks))) ? done')
  await caught('/decks toggles blind (the note reads the old state)', 'const want = !page.decksOpen', 'const want = page.decksOpen')
  await caught('/open in a new tab uses the wrong address', 'page.openTab(`/builder?session_id=${encodeURIComponent(id)}`)', 'page.openTab(`/builder?session=${id}`)')
  await caught('/open in a new tab also picks the deck here', 'if (away) { page.openTab(`/builder?session_id=${encodeURIComponent(id)}`); return', 'if (away) { page.openTab(`/builder?session_id=${encodeURIComponent(id)}`); page.openDeck(id); return')
  await caught('/open does not tell the deck already open', "        if (page.sessionId === id) return failed(NAV_WORDS.alreadyOpen)\n", '')
  await caught('a page opens in place while a build runs', "if (away) { page.openTab(target.path); return", 'if (false) { page.openTab(target.path); return')
  await caught('a page is pushed twice', "page.go(target.path)\n        return done(`Opened ${target.label}`)", "page.go(target.path); page.go(target.path)\n        return done(`Opened ${target.label}`)")
  await caught('the themes route is wrong', "themes: { path: '/studio/themes', label: 'Themes' }", "themes: { path: '/themes', label: 'Themes' }")
  await caught('the Decks route is wrong', "dashboard: { path: '/dashboard', label: 'Decks' }", "dashboard: { path: '/decks', label: 'Decks' }")
  await caught('the new-tab reason is not said', "return done(`Opened ${target.label} in a new tab ${newTabWhy(away)}`)", 'return done(`Opened ${target.label} in a new tab`)')
  await caught('/duplicate-deck switches to the copy', "if (outcome.ok) decksEpochNow += 1", 'if (outcome.ok) { decksEpochNow += 1; page.openDeck(outcome.title) }')
  await caught('/duplicate-deck does not offer /open', ' It stays closed: say /open ${clip(outcome.title, 60)} to switch to it.', '')
  await caught('/duplicate-deck starts a second copy while one is running', "if (copying) return failed(NAV_WORDS.copying)", '')
  await caught('/duplicate-deck ignores unsaved edits', "return viewerDirty(viewer) ? NAV_WORDS.copyEdits : null", 'return null')
  await caught('/duplicate-deck ignores a build', "if (state.building || viewer.building) return words.building", '')
  await caught('/duplicate-deck runs with the flag off', "if (!page.duplicate) return NAV_WORDS.noCopy\n      if (!viewer", "if (!viewer")
  await caught('the deck list is not read again after a copy', 'if (outcome.ok) decksEpochNow += 1', '')
  await caught('the collapsed group shows five rows', "{ name: 'settings', blurb: 'Open Settings', takes: false, common: true }", "{ name: 'settings', blurb: 'Open Settings', takes: false, common: true },\n  { name: 'help', blurb: 'Open Help', takes: false, common: true }")
  await caught('More… is missing', "if (name === '') return [...NAV_COMMANDS.filter(def => def.common).map(def => firstLevel(def, env, page, helpers)), moreRow()]", "if (name === '') return NAV_COMMANDS.filter(def => def.common).map(def => firstLevel(def, env, page, helpers))")
  await caught('typing no longer searches all of them', "const starts = NAV_COMMANDS.filter(def => def.name.startsWith(name))", "const starts = NAV_COMMANDS.filter(def => def.common && def.name.startsWith(name))")
  await caught('/open shows more than five decks', 'export const NAV_DECK_ROWS = Object.freeze({ open: 5, decks: 8 })', 'export const NAV_DECK_ROWS = Object.freeze({ open: 6, decks: 8 })')
  await caught('the deck matches are not ranked', ".sort((a, b) => b.score - a.score || a.order - b.order)", ".sort((a, b) => a.order - b.order)")
  await caught('a word after a page command runs it', "return arg ? [problem(def.name, `/${def.name}`, NAV_WORDS.nothingAfter(def.name))] : [firstLevel(def, env, page, helpers)]", 'return [firstLevel(def, env, page, helpers)]')
  await caught('no deck matches is no hint', "if (!hits.length) return [problem(name, label, NAV_WORDS.noDeckMatch(arg))]", '')
  await caught('a failed list read is silent', "if (status === 'failed') return [problem(name, label, NAV_WORDS.decksFailed)]", '')
  await caught('the list not loaded yet shows decks anyway', "if (status === 'idle' || status === 'loading') return [{ ...rowOf(name, bare, '', null), disabled: NAV_WORDS.loadingDecks }]", '')
  await caught('the open deck is not marked', "disabled: deck.id === page.sessionId ? NAV_WORDS.alreadyOpen : null", 'disabled: null')
  await caught('/decks <words> does not search', "if (def.name === 'open' || (def.name === 'decks' && arg)) return deckRows", "if (def.name === 'open') return deckRows")
  await caught('the About dialog does not open', 'setAboutOpen(true)\n        return aboutSnapshot()', 'return aboutSnapshot()')
  await caught('the dialog state is announced every time', "if (aboutOpen === open) return", '')
  await caught('the page handles are used with the flag off', "const page = live.page\n  if (!page) return []", "const page = live.page ?? ({} )\n  if (!page) return []")
  await caught('the viewer half\'s words are not used', "if (!viewer || !page.sessionId) return words.noDeck", "if (!viewer || !page.sessionId) return 'x'")
  await caught('the end of a long deck title is lost in its row', 'const head = Math.ceil((max - 1) * 0.6), tail = max - 1 - head\n  return `${flat.slice(0, head).trimEnd()}…${flat.slice(flat.length - tail).trimStart()}`', 'return `${flat.slice(0, max - 1).trimEnd()}…`')
  await caught('a row that only says why keeps a long label', "const bare = `/${name}`", "const bare = label")
  await caught('the title is not cut in a note', "const title = clip(run.deck.title, 60)", 'const title = run.deck.title')
  await caught('ago tries to read a time it cannot read', 'if (!Number.isFinite(time)) return null', '')
  await caught('ago counts days as hours', 'const hours = Math.floor(mins / 60)', 'const hours = Math.floor(mins / 6)')
  await caught('a deck with no title is not Untitled', "|| 'Untitled',", "|| '',")
  await caught('a throwing handle escapes', "  } catch {\n    return failed(\"That didn't work.", "  } catch (error) {\n    throw error\n    return failed(\"That didn't work.")
  // the deck-list hook
  const hookText = read(DECKS)
  for (const [name, from, to] of [
    ['the list is read on every render', '}, [want]) // eslint-disable-line', '}) // eslint-disable-line'],
    ['a stale list is never read again', 'Date.now() - began.current.at < NAV_DECKS_FRESH_MS', 'true'],
    ['a copy does not make the list stale', 'began.current.epoch === epoch &&', ''],
    ['a failed read is not shown', "{ status: 'failed', items: [] }", "{ status: 'ready', items: [] }"],
    ['nothing is read without a loader', 'if (!want || !load || reading.current) return', 'if (!want || reading.current) return'],
    ['two reads at once', 'if (!want || !load || reading.current) return', 'if (!want || !load) return'],
  ]) {
    const mutated = hookText.replace(from, () => to)
    assert.notEqual(mutated, hookText, `mutant applies: ${name}`)
    let threw = false
    try { await hookSuite(navText, mutated) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  // the shared deps
  const depsText = read(DEPS)
  for (const [name, from, to] of [
    ['the deps lose a member', "  now: () => new Date(),\n", ''],
    ['the id is not fresh', 'newId: () => crypto.randomUUID(),', "newId: () => 'same',"],
    ['the target rule is skipped', 'if (!target.ok) return { ok: false, message: target.reason }', ''],
    ['the title is not the library\'s', "(typeof row.title === 'string' && row.title.trim()) || 'Untitled Presentation'", "row.title || ''"],
  ]) {
    const mutated = depsText.replace(from, () => to)
    assert.notEqual(mutated, depsText, `mutant applies: ${name}`)
    let threw = false
    try { await depsSuite(mutated) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  // the strip and the sources
  const stripText = fs.readFileSync(path.join(root, 'scripts/studio-chat-parity-nav-strip.mjs'), 'utf8')
  const loadStrip = text => import(`data:text/javascript;base64,${Buffer.from(text.replace("from './studio-chat-parity-viewer-strip.mjs'", `from '${new URL('./studio-chat-parity-viewer-strip.mjs', import.meta.url).href}'`)).toString('base64')}`)
  const identity = async mod => { if (!hasHead) throw new Error('no head: the mutant cannot be judged here (treated as caught)'); for (const rel of [...strip.CHAT_PARITY_NAV_FILES, ...strip.CHAT_PARITY_NAV_VIEWER_NEW_EDITED]) if (mod.stripChatParityNav(rel, read(rel)) !== showAt(strip.VIEWER_HEAD, rel)) throw new Error(`${rel}: not the head`) }
  for (const [name, from, to] of [
    ['the strip forgets the marker', 'CHAT_PARITY_NAV_MARKER_RE = /(?<![\\w-])CHAT-PARITY-NAV(?![\\w-])/', 'CHAT_PARITY_NAV_MARKER_RE = /(?<![\\w-])CHAT-PARITY-NAV-NOT(?![\\w-])/'],
    ['the strip does not put changed lines back', 'const swapped = (CHAT_PARITY_NAV_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)', 'const swapped = text'],
    ['the strip drops the Builder page', '  "app/builder/page.tsx",\n', ''],
    ['the strip drops a viewer half file', '  "lib/studio-chat-parity-viewer.ts",\n', ''],
  ]) {
    const mutated = stripText.replace(from, () => to)
    assert.notEqual(mutated, stripText, `mutant applies: ${name}`)
    let threw = false
    try { await identity(await loadStrip(mutated)) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  const pageText = read(PAGE)
  for (const [name, from, to] of [
    ['a new tab without noopener', "window.open(path, '_blank', 'noopener')", "window.open(path, '_blank')"],
    ['the handles exist with the flag off', 'if (chatCommandsPage) chatCommandsPage.nav = {', 'chatCommandsPage!.nav = {'],
    ['/open is not the Sessions pick', 'openDeck: id => handleSessionSelectWrapped(id)', 'openDeck: id => session.handleSessionSelect(id)'],
    ['pages are not pushed with the router', 'go: path => router.push(path)', 'go: path => window.location.assign(path)'],
    ['/decks is a blind set', 'toggleDecks: () => setShowChatHistory(prev => !prev)', 'toggleDecks: () => setShowChatHistory(true)'],
    ['the copy runs with its flag off', "duplicate: process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK === 'true' ? {", 'duplicate: true ? {'],
    ['the deck list is another call', "chatNavLoadSessions({ limit: 50, status: 'active' })", "chatNavLoadSessions({ limit: 5 })"],
    ['the page imports the nav lib', "import { useRouter, useSearchParams } from \"next/navigation\"", "import { useRouter, useSearchParams } from \"next/navigation\"\nimport { setNavLive } from '@/lib/studio-chat-parity-nav'"],
  ]) {
    const mutated = pageText.replace(from, () => to)
    assert.notEqual(mutated, pageText, `mutant applies: ${name}`)
    let threw = false
    try { pageChecks(mutated, 'mutant') } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  const hookTextC = read(COMMANDS_UI)
  for (const [name, from, to] of [
    ['the live handle is set even with the flag off', 'setNavLive(enabled ? page?.nav ?? null : null, navDecks)', 'setNavLive(page?.nav ?? null, navDecks)'],
    ['the deck list is read with the flag off', 'useChatNavDecks(Boolean(enabled && page?.nav && navWantsDecks(trigger))', 'useChatNavDecks(Boolean(page?.nav && navWantsDecks(trigger))'],
    ['the deck list is read for every trigger', 'navWantsDecks(trigger)), page?.nav?.loadSessions', 'true), page?.nav?.loadSessions'],
    ['the About dialog is not mounted', 'menu: <>{menu}<ChatNavAbout /></>, // CHAT-PARITY-NAV', 'menu, // CHAT-PARITY-NAV'],
    ['the rows are built before the live handle', 'setNavLive(enabled ? page?.nav ?? null : null, navDecks) // CHAT-PARITY-NAV', '// CHAT-PARITY-NAV'],
  ]) {
    const mutated = hookTextC.replace(from, () => to)
    assert.notEqual(mutated, hookTextC, `mutant applies: ${name}`)
    let threw = false
    try { hookChecks(mutated, 'mutant') } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  // an unmarked line left in a stripped file
  if (hasHead) {
    const unmarked = read(COMMANDS_UI).replace('const navDecks = useChatNavDecks', 'const navDecks = /* x */ useChatNavDecks').replace(' // CHAT-PARITY-NAV: the deck list, read once', ' // the deck list, read once')
    hit(strip.stripChatParityNav(COMMANDS_UI, unmarked) !== showAt(strip.VIEWER_HEAD, COMMANDS_UI), 'mutant caught: an unmarked line stays in the stripped file')
    const wrongPin = read('scripts/test-studio-chat-parity-viewer.mjs').replace('registry read (CHAT-PARITY-NAV): this change\'s lines are the diff', 'registry read (CHAT-PARITY-NAV): changed: this change\'s lines are the diff')
    hit(strip.stripChatParityNav('scripts/test-studio-chat-parity-viewer.mjs', wrongPin) !== showAt(strip.VIEWER_HEAD, 'scripts/test-studio-chat-parity-viewer.mjs'), 'mutant caught: a taught line edited after the fact does not put back')
  }
  // the menu
  for (const [name, from, to] of [['the menu forgets its icons for the group', 'open: FolderOpen,', ''], ['the menu starts its indexes at zero', 'rowProps(offset + index)', 'rowProps(index)']]) {
    const menuText = read(MENU)
    const mutated = menuText.replace(from, () => to)
    assert.notEqual(mutated, menuText, `mutant applies: ${name}`)
    let threw = false
    try { menuChecks(mutated) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  // the viewer half's lib: the three lines this change added
  const viewerText = read(VIEWER_LIB)
  for (const [name, from, to] of [
    ['the Go to rows are not appended', '...navRows(trigger, env, NAV_HELPERS)] // CHAT-PARITY-NAV', '] // CHAT-PARITY-NAV'],
    ['a Go to name is not handled', "if (isNavName(name)) return navRows(trigger, env, NAV_HELPERS) // CHAT-PARITY-NAV", '// CHAT-PARITY-NAV'],
    ['a Go to run does not reach the nav lib', "if (isNavRun(run)) return runNav(run, { building: deps.building, viewer: viewerStateSnapshot(), words: PARITY_WORDS, scale: deps.scale }) // CHAT-PARITY-NAV", '// CHAT-PARITY-NAV'],
    ['the run is not given the viewer\'s state', 'viewer: viewerStateSnapshot(), words: PARITY_WORDS', 'viewer: null, words: PARITY_WORDS'],
    ['the run is not given the build state', 'runNav(run, { building: deps.building,', 'runNav(run, { building: false,'],
  ]) {
    const mutated = viewerText.replace(from, () => to)
    assert.notEqual(mutated, viewerText, `mutant applies: ${name}`)
    let threw = false
    try { libSuite({ viewerText: mutated }); await runSuite({ viewerText: mutated }) } catch { threw = true }
    hit(threw, `mutant caught: ${name}`)
  }
  return mutantsCaught
}

// ============================================================================================================================================
// Run
// ============================================================================================================================================
libSuite()
console.log(`PASS A  the lib: the collapsed group, More, search, the deck matches, hints, disabled reasons, the unsaved-edits and build rules (${checks} checks)`)
const afterA = checks
await runSuite()
console.log(`PASS B  the run on fake page handles: every command's handler and route, a new tab while a build runs or edits are unsaved, /open held while dirty, the copy never switches (${checks - afterA} checks)`)
const afterB = checks
await hookSuite()
await depsSuite()
console.log(`PASS C  the deck-list hook on the harness's React, and the copy through the shared deps on a recorder (${checks - afterB} checks)`)
const afterC = checks
await sourceChecks()
menuChecks()
console.log(`PASS D  the sources: markers, the strip back to the viewer half's head, the Decks page untouched, the registry, the taught proofs, the routes, no new flag, the committed diff, the menu markup (${checks - afterC} checks)`)
const mutants = await mutantsSuite()
console.log(`test-studio-chat-parity-nav: ${checks} checks, ${mutants} mutants caught (${OWN.length ? `own commits ${OWN.map(sha => sha.slice(0, 8)).join(', ')}` : 'no own commit yet'})${hasHead ? '' : ' (viewer head not in this clone: some checks skipped)'}`)
