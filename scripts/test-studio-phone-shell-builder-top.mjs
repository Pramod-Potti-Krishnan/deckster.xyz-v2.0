// FRONTEND-2 (PK's phone review, 25 Oct, decision B): proof for "Phone shell 2", the Builder top on phones and the Director dot, stacked on "Phone shell 1". Flag NEXT_PUBLIC_STUDIO_PHONE_SHELL (exact "true", default off,
// build-time; PR 1's flag, with NEXT_PUBLIC_STUDIO_V4_SHELL). PK, quoted: "I like this broadly, but I would still like the slides director switch to be in one row below, and the today one in that second row. Slide
// director, I like better." On a phone: row 1 is the logo (PR 1), a "..." menu (the deck title as its header, then New deck, Export, Notes and the rest of what row 1 and the edge tabs did) and Publish; row 2 is today's
// Slides | Director switch, unchanged, with a status dot on its Director segment; the "Director / Connected" row and the edge pull tabs (Slide, Thumbnails, Director, Notes) go. At every width (PK: "status dot on
// desktop too") the Director panel's status line becomes a dot beside "Director", with its words only when it is not connected.
// Run: node scripts/test-studio-phone-shell-builder-top.mjs   (plain node: TypeScript transpile, react-dom/server, postcss, `git show` for the base commit; no network, no browser, no model call)
//
//   1. lib         the dot for every connection state, tied to the Director header's own states (rendered); the menu's entries (order, names, disabled, absent); the menu's targets are the page's own controls
//                  (their attributes read from the real sources); the edge-tab mapping: every tab the stylesheet hides has a home
//   2. stylesheet  outside the phone query only the two hides (menu, dot) and the desktop status line; every other rule inside (max-width: 640px); every selector needs PR 1's bar root or this change's own
//                  elements; the dot is absolute (the segment keeps its size), green / amber / red, light and dark; the row goes only once the dot is placed and while it holds no control; no !important
//   2b. row 1      the stylesheet resolved (a small selector engine) on a model of row 1 built as the real components nest it (facts read from the sources): Publish shown, at the far right, "..." just before it;
//                  the title, New deck and Export hidden, Export by its own box (never by the strip it shares with Publish), shown while the menu opens it, its menu is open or it has focus
//   3. render      the menu and the dot, portalled into the page's own row 1 and Director segment; the menu: a named trigger, the deck title, the entries; each entry runs the page's own control once the
//                  menu has closed (Export opened the way a keyboard opens it, shown for that moment; a dialog keeps its focus; the rest give focus back to "..."); the dot's name for every state
//   4. pin         the Builder page without this change's two marked lines is PR 1's head byte for byte, also through the registry; BuilderHeader, the switch, the Director header and the viewer are untouched
//   5. flag off    the page's two lines are gated on PR 1's constant; only the Builder imports the component; no rule matches without the flag's elements
//   6. change      the strip (whole-token marker), the registry (two lines, after PR 1's), no .env.example block, no older test edited, scope (the COMMITTED diff only), no secret
//   7. mutants     each one must make sections 1-6 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'
import {
  BASE_COMMIT, PHONE_SHELL_TOP_BUILDER, PHONE_SHELL_TOP_COMMIT_SUBJECT, PHONE_SHELL_TOP_FILES, PHONE_SHELL_TOP_MARKER_RE, PHONE_SHELL_TOP_NEW_FILES, PHONE_SHELL_TOP_OWN_EDITS, PHONE_SHELL_TOP_SCOPE_FILES, stripPhoneShellTop,
} from './studio-phone-shell-builder-top-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const h = React.createElement
const BASE = process.env.PHONE_SHELL_TOP_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
const ownCommitted = () => {
  const files = new Set()
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [subject, ...names] = block.split('\n')
    if (PHONE_SHELL_TOP_COMMIT_SUBJECT.test(subject)) for (const name of names) if (name) files.add(name)
  }
  return [...files]
}
let overrides = {}
// A change registered after this one comes out first, so every check sees this change's tree whatever is stacked on it.
const read = rel => (rel in overrides ? overrides[rel] : LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripPhoneShellTop) + 1).reduce((out, strip) => strip(rel, out), fs.readFileSync(path.join(root, rel), 'utf8')))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const marked = line => PHONE_SHELL_TOP_MARKER_RE.test(line)
const withoutOthers = (rel, text) => {
  const si = LATER_STRIPS.indexOf(stripPhoneShellTop)
  const mine = si >= 0 ? LATER_STRIPS.splice(si, 1)[0] : null
  try { return stripLaterChanges(rel, text) } finally { if (mine) LATER_STRIPS.splice(si, 0, mine) }
}

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const eq = count(assert.equal), deep = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message)), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const LIB = 'lib/studio-phone-builder-top.ts', COMP = 'components/builder/studio-phone-builder-top.tsx', CSS = 'components/builder/studio-phone-builder-top.css'
const PAGE = PHONE_SHELL_TOP_BUILDER, REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-phone-shell-builder-top-strip.mjs', THIS_TEST = 'scripts/test-studio-phone-shell-builder-top.mjs'
const HEADER = 'components/builder/builder-header.tsx', SWITCH = 'components/builder/studio-workspace-switch-v2.tsx', DIRECTOR = 'components/builder/chat/studio-director-header.tsx', DIRECTOR_CSS = 'components/builder/chat/studio-director-header.css'
const VIEWER = 'components/presentation-viewer.tsx', NOTES = 'components/slide-notes-panel.tsx', DOWNLOAD = 'components/presentation-download-controls.tsx', IDENTITY = 'components/builder/deck-identity-dialog.tsx'
const PR1_LIB = 'lib/studio-phone-shell.ts', PR1_BAR = 'components/layout/studio-phone-tab-bar.tsx', PR1_CSS = 'components/layout/studio-phone-shell.css'
const ROOTSEL = '[data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"])', PHONE = '(max-width: 640px)'
const CONNECTIONS = ['connected', 'connecting', 'disconnected', 'error', undefined]
const RECONNECTS = [undefined, 'idle', 'scheduled', 'paused_offline', 'exhausted', 'manual', 'superseded']

const compileCache = new Map()
function compile(rel, text) {
  const id = `${rel}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
function load(rel, { env = {}, stubs = {}, globals = {}, text = read(rel) } = {}) {
  const module = { exports: {} }
  const req = spec => {
    if (Object.prototype.hasOwnProperty.call(stubs, spec)) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec === '@/lib/studio-phone-builder-top') return load(LIB, { env, globals })
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, text), { module, exports: module.exports, require: req, process: { env }, ...globals }, { filename: rel })
  return module.exports
}
const lib = () => load(LIB)

// ---------------------------------------------------------------- 1. lib
function directorHeaderTone(connectionState, reconnectStatus) { // the Director header's own state for the same inputs, rendered from its real source with its chat-header flag on
  const { StudioDirectorHeader } = load(DIRECTOR, { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_CHAT_HEADER: 'true' }, stubs: { react: React, 'lucide-react': { Sparkles: () => h('svg') } } })
  const html = renderToStaticMarkup(h(StudioDirectorHeader, { connectionState, reconnectStatus }))
  return { tone: html.match(/data-studio-chat-header-state="([a-z]+)"/)[1], text: html.match(/data-studio-chat-header-state="[a-z]+">([^<]*)</)[1].replace(/&#x27;/g, "'") }
}
const TONE_OF = { ready: 'green', connecting: 'amber', reconnecting: 'amber', offline: 'red', failed: 'red', superseded: 'red', error: 'red', disconnected: 'red' }
function proveLib(at = '') {
  const a = message => (at ? `${at}: lib: ${message}` : `lib: ${message}`)
  const { studioDirectorDot, studioPhoneDeckMenuItems, STUDIO_PHONE_DECK_MENU_ORDER, STUDIO_PHONE_DECK_MENU_TARGETS, STUDIO_PHONE_EDGE_TAB_HOMES } = lib()
  nomatch(read(LIB).replace(/\/\/.*$/gm, ''), /process\.env|import /, a('import-free and reads no environment'))
  let combos = 0
  for (const c of CONNECTIONS) for (const r of RECONNECTS) {
    if (c === undefined) continue
    const dot = studioDirectorDot(c, r), header = directorHeaderTone(c, r)
    eq(dot.tone, TONE_OF[header.tone], a(`${c} / ${r}: the dot is ${TONE_OF[header.tone]} where the Director header says "${header.text}" (${header.tone})`))
    eq(dot.state, header.text.replace(/…$/, '').toLowerCase(), a(`${c} / ${r}: its word is the header's, "${header.text}"`))
    combos++
  }
  eq(combos, 28, a('every connection state against every reconnect status'))
  deep([studioDirectorDot('connected').tone, studioDirectorDot('connecting').tone, studioDirectorDot('connecting', 'scheduled').tone, studioDirectorDot('disconnected', 'scheduled').tone, studioDirectorDot('disconnected').tone, studioDirectorDot(undefined).tone],
    ['green', 'amber', 'amber', 'amber', 'red', 'red'], a('green connected, amber connecting or reconnecting, red disconnected (and an unknown state is not called connected)'))
  deep(STUDIO_PHONE_DECK_MENU_ORDER, ['newDeck', 'export', 'notes', 'thumbnails', 'slide', 'deckList', 'presenter'], a('the menu: New deck, Export, Notes (the brief\'s order), then Thumbnails, the slide panel, the deck list, Presenter details'))
  const all = Object.fromEntries(STUDIO_PHONE_DECK_MENU_ORDER.map(key => [key, { label: `  ${key} label `, disabled: false }]))
  deep(studioPhoneDeckMenuItems(all).map(i => [i.key, i.label]), STUDIO_PHONE_DECK_MENU_ORDER.map(key => [key, `${key} label`]), a('every control found: one entry each, in order, named as the control is'))
  deep(studioPhoneDeckMenuItems({ notes: { label: null, disabled: false }, export: { label: '', disabled: true }, newDeck: null }).map(i => [i.key, i.label, i.disabled]), [['export', 'Export', true], ['notes', 'Notes', false]], a('a missing control has no entry; no name falls back to the plain word; disabled stays disabled'))
  deep(studioPhoneDeckMenuItems({}), [], a('nothing on the page: no entries'))
  // the targets are the page's own controls, by the attributes the real sources give them
  const T = STUDIO_PHONE_DECK_MENU_TARGETS, header = read(HEADER)
  eq(T.title, '[data-studio-v4-shell-header] .studio-shell-heading > span[title]', a('title: the top bar\'s deck title'))
  ok(/<span title=\{deckTitle\}/.test(header) && /className="studio-shell-heading"/.test(header), a('(BuilderHeader: the heading holds the deck title in a span with title={deckTitle})'))
  ok(T.newDeck.endsWith('.studio-shell-header-actions > .studio-shell-new') && /<Button className="studio-shell-new" onClick=\{onNewPresentation\} aria-label=/.test(header), a('New deck: the top bar\'s own New button, its own name and handler'))
  ok(T.deckList.endsWith('.studio-shell-heading > button') && /<div className="studio-shell-heading">\n\s+<StudioNavigationHint enabled label=\{isChatHistoryOpen \? "Close sessions" : "Sessions"\}>\n\s+<Button variant="ghost" size="icon" onClick=\{onOpenChatHistory\}/.test(header), a('the deck list: the heading\'s first button, the Sessions toggle'))
  ok(T.export.includes('[data-studio-v4-toolbar-target] [data-studio-download-control] button[aria-haspopup="menu"]') && /data-studio-download-control=\{STUDIO_DELIVERY\}/.test(read(DOWNLOAD)) && /<DropdownMenuTrigger asChild>\n\s+<button/.test(read(DOWNLOAD)), a('Export: the delivery control\'s own menu trigger (a Radix trigger: aria-haspopup="menu")'))
  ok(T.notes.endsWith('[data-studio-notes-handle="true"] > button') && /<div data-studio-notes-handle=\{studioShell \? 'true' : undefined\}[^>]*>\n\s+<button\n\s+type="button"\n\s+aria-expanded=\{expanded\}\n\s+aria-label=\{expanded \? 'Hide script and notes' : 'Show script and notes'\}\n\s+onClick=\{handleToggleExpanded\}/.test(read(NOTES)), a('Notes: the NOTES edge tab itself (its name, its handler)'))
  ok(T.thumbnails.endsWith('[data-studio-v4-thumbnail-toggle="true"]') && /data-studio-v4-thumbnail-toggle=\{studioShell \? "true" : undefined\}\n\s+onClick=\{handleToggleOverview\}/.test(read(VIEWER)) && /aria-label=\{railShown \? "Hide thumbnails" : "Show thumbnails"\}/.test(read(VIEWER)), a('Thumbnails: the THUMBNAILS edge tab itself'))
  ok(T.slide.endsWith('[data-studio-drawer-handle="slide"]') && /data-studio-drawer-handle=\{studioShell \? 'slide' : undefined\}/.test(read(PAGE)) && /title=\{studioShell && isSlideDrawerOpen && !studioSlideVisible \? 'Show slide panel' : showFormatPanel \? 'Close slide panel' : 'Open slide panel'\}/.test(read(PAGE)), a('the slide panel: the SLIDE edge tab itself (named by its title)'))
  ok(T.presenter.endsWith('[data-studio-deck-identity-trigger="true"]') && /data-studio-deck-identity-trigger=\{studioShell \? "true" : undefined\}/.test(read(IDENTITY)) && /onClick=\{\(\) => setOpen\(true\)\}/.test(read(IDENTITY)), a('Presenter details: the heading\'s deck identity button'))
  // the edge-tab mapping: Director is the switch (the same handler); the other three are menu entries
  deep(Object.keys(STUDIO_PHONE_EDGE_TAB_HOMES), ['director', 'notes', 'thumbnails', 'slide'], a('the four edge tabs PK named each have a home'))
  match(read(PAGE), /onDirector=\{\(\) => \{ selectWorkspacePane\('chat'\); if \(!showChat\) setShowChat\(true\) \}\}/, a('Director: the switch\'s Director segment opens the chat pane, as the DIRECTOR tab does'))
  match(read(PAGE), /if \(studioShell && isDeckDrawerOpen && !workspaceLayout\.chatVisible\) \{ selectWorkspacePane\('chat'\); return \}/, a('(the DIRECTOR tab: selectWorkspacePane(\'chat\'))'))
  for (const key of ['notes', 'thumbnails', 'slide']) ok(STUDIO_PHONE_DECK_MENU_ORDER.includes(key), a(`${key}: a menu entry`))
}

// ---------------------------------------------------------------- 2. the stylesheet
const splitTop = selector => {
  const parts = []; let depth = 0, quote = '', start = 0
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i]
    if (quote) { if (c === quote) quote = ''; continue }
    if (c === '"' || c === "'") quote = c
    else if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) { parts.push(selector.slice(start, i).trim()); start = i + 1 }
  }
  parts.push(selector.slice(start).trim())
  return parts
}
function cssRules(text) {
  const out = []
  postcss.parse(text).walkRules(rule => {
    const media = rule.parent?.type === 'atrule' ? `${rule.parent.name} ${rule.parent.params}` : null
    out.push({ selector: rule.selector, selectors: splitTop(rule.selector), media, decls: Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(d => [d.prop, d.value + (d.important ? ' !important' : '')])) })
  })
  return out
}
const HEAD_DESKTOP = `${ROOTSEL} [data-studio-director-header="true"][data-studio-chat-header]`
function proveCss(text, at = '') {
  const a = message => (at ? `${at}: stylesheet: ${message}` : `stylesheet: ${message}`)
  const rules = cssRules(text)
  nomatch(text, /!important/, a('no !important'))
  const atRules = []; postcss.parse(text).walkAtRules(r => atRules.push(`${r.name} ${r.params}`))
  deep(atRules, [`media ${PHONE}`], a('one at-rule: the phone query'))
  deep(rules.filter(r => r.media === null).map(r => [r.selector, r.decls]), [
    ['[data-studio-phone-deck-menu="true"]', { display: 'none' }],
    ['[data-studio-phone-director-dot]', { display: 'none' }],
    [HEAD_DESKTOP, { display: 'flex' }],
    [`${HEAD_DESKTOP} > [role="status"]`, { 'margin-left': '0' }],
    [`${HEAD_DESKTOP} > [data-studio-chat-header-state="ready"]`, { gap: '0', 'font-size': '0' }],
    [`${HEAD_DESKTOP} > :nth-child(n+4)`, { 'margin-left': 'auto' }],
  ], a('outside the phone query: the menu and the dot hidden, and the Director status line as a dot beside "Director" (one row; the words of "Connected" take no room, every other state keeps them), nothing else'))
  ok(rules.filter(r => r.media !== null).every(r => r.media === `media ${PHONE}`), a('every other rule is inside @media (max-width: 640px)'))
  for (const r of rules) for (const s of r.selectors) {
    ok(s.startsWith(ROOTSEL) || s.startsWith(`.dark ${ROOTSEL}`) || /^\[data-studio-phone-deck-menu="true"\]|^\[data-studio-phone-director-dot\]$|^\[data-studio-v4-shell="true"\]\[data-studio-phone-deck-menu-content="true"\]|^\[data-studio-phone-deck-menu-content="true"\]/.test(s),
      a(`${s}: needs PR 1's bar root or this change's own elements, which exist only with the flag`))
    nomatch(s, /\[data-studio-(settings|billing|publish|p2-admin|help)|user-profile|\[data-studio-v4-rail\]/, a(`${s}: no FRONTEND-1 area, not the rail`))
  }
  const rule = sel => rules.find(r => r.selectors.includes(sel))?.decls ?? {}
  const ACTIONS = `${ROOTSEL} > [data-studio-v4-shell-column] > [data-studio-v4-shell-header] .studio-shell-header-actions`
  eq(rule(`${ROOTSEL} > [data-studio-v4-shell-column] > [data-studio-v4-shell-header] .studio-shell-heading`).display, 'none', a('row 1: the title and the deck list button go (into the menu)'))
  eq(rule(`${ACTIONS} > .studio-shell-new`).display, 'none', a('row 1: New deck goes (into the menu)'))
  eq(rule(`${ACTIONS}:not(:has(> [data-studio-phone-deck-menu="true"][data-export-open="true"])) [data-studio-v4-toolbar-target] :is([data-studio-download-control], [data-studio-disabled-reason]:has(> [data-studio-download-control])):not(:focus-within):not(:has([aria-expanded="true"]))`).display, 'none',
    a('row 1: Export goes (into the menu), by its own box or the blocked disabled-reason box around it, except while the menu opens it, while its own menu is open and while it has focus'))
  deep(rule(`${ACTIONS} > [data-studio-phone-deck-menu="true"]`), { display: 'inline-flex', order: '-1', 'flex-shrink': '0' }, a('row 1: "..." first in the action group, so Publish keeps its place at the right'))
  const trigger = rule('[data-studio-phone-deck-menu="true"] > button')
  ok(parseFloat(trigger.width) >= 44 && parseFloat(trigger.height) >= 32, a(`"..." is at least 44 x 32 px (${trigger.width} x ${trigger.height})`))
  const switchSelectors = rules.flatMap(r => r.selectors).filter(s => /data-studio-workspace-switch|swsv2/.test(s))
  deep(switchSelectors.filter(s => !s.endsWith('[data-studio-workspace-switch-v2="true"] .swsv2-segments > button:has(> [data-studio-phone-director-dot])') && !s.includes(':has(> [data-studio-workspace-switch]) [data-studio-drawer-handle="director"]')), [], a('row 2: the switch is not restyled (only the Director segment becomes the dot\'s box; the switch is read to hide the Director tab)'))
  deep(rule(`${ROOTSEL} [data-studio-workspace-switch-v2="true"] .swsv2-segments > button:has(> [data-studio-phone-director-dot])`), { position: 'relative' }, a('the Director segment only becomes the dot\'s positioning box (position only: its size is the same)'))
  const dot = rule(`${ROOTSEL} [data-studio-phone-director-dot]`)
  deep([dot.display, dot.position, dot.width, dot.height, dot['border-radius']], ['block', 'absolute', '6px', '6px', '50%'], a('the dot: 6 px, round, absolute (out of the segment\'s flow, so the segment keeps its size)'))
  ok(parseFloat(dot.right) <= 4, a('it sits in the segment\'s own right padding (10 px), clear of the word'))
  deep(['green', 'amber', 'red'].map(t => rule(`${ROOTSEL} [data-studio-phone-director-dot="${t}"]`).background), ['#16a34a', '#d97706', '#dc2626'], a('green, amber, red (light)'))
  deep(['green', 'amber', 'red'].map(t => rule(`.dark ${ROOTSEL} [data-studio-phone-director-dot="${t}"]`).background), ['#4ade80', '#fbbf24', '#f87171'], a('green, amber, red (dark)'))
  eq(rule(`${ROOTSEL} [data-studio-v4-shell-workspace]:has([data-studio-phone-director-dot]) [data-studio-director-header="true"]:not(:has(> :nth-child(4)))`).display, 'none', a('the "Director / Connected" row goes once the dot is on the switch, unless it holds a control (Reconnect, a Director call)'))
  eq(rule(`${ROOTSEL} [data-studio-v4-shell-workspace] :is([data-studio-drawer-handle="slide"], [data-studio-v4-thumbnail-toggle="true"], [data-studio-notes-handle="true"])`).display, 'none', a('the Slide, Thumbnails and Notes edge tabs go (their controls stay on the page, for the menu)'))
  eq(rule(`${ROOTSEL} [data-studio-v4-shell-workspace]:has(> [data-studio-workspace-switch]) [data-studio-drawer-handle="director"]`).display, 'none', a('the Director edge tab goes where the switch is'))
  ok(!rules.some(r => r.selectors.some(s => /data-studio-drawer-handle="element"/.test(s))), a('the Element tab (not one PK named) is left as it is'))
  // the edge tabs hidden are exactly the ones with a home
  const hidden = text.match(/\[data-studio-drawer-handle="(slide|director)"\]|\[data-studio-v4-thumbnail-toggle="true"\]|\[data-studio-notes-handle="true"\]/g).map(s => s.includes('slide') ? 'slide' : s.includes('director') ? 'director' : s.includes('thumbnail') ? 'thumbnails' : 'notes')
  deep([...new Set(hidden)].sort(), Object.keys(lib().STUDIO_PHONE_EDGE_TAB_HOMES).sort(), a('every edge tab the stylesheet hides has a home, and every one with a home is hidden'))
  match(read(DIRECTOR_CSS), /\[data-studio-chat-header\] > \[role="status"\]::before \{ content: ""; flex: none; width: 6px; height: 6px; border-radius: 50%;/, a('(desktop: the dot is the Director header\'s own status dot, 6 px, which keeps its colours)'))
}

// ---------------------------------------------------------------- 2b. row 1 at 640 px and narrower, flag on: the stylesheet resolved on a model of the real markup (Publish stays, at the far right)
// A small selector engine (postcss-selector-parser, the one Tailwind ships, resolved from it) over a tree built the way the real components nest row 1. The facts the tree stands on are read from the sources
// first, so a change of that markup fails here rather than passing on a stale model. Unsupported selector syntax throws (never a silent match).
const selectorParser = createRequire(nodeRequire.resolve('tailwindcss/package.json'))('postcss-selector-parser')
const el = (tag, attrs = {}, children = []) => { const node = { tag, attrs, classes: String(attrs.class || '').split(/\s+/).filter(Boolean), children, parent: null, focusWithin: false }; children.forEach(c => { c.parent = node }); return node }
const parseCache = new Map()
const parseSel = text => { if (!parseCache.has(text)) parseCache.set(text, selectorParser().astSync(text)); return parseCache.get(text) }
const descendants = node => node.children.flatMap(c => [c, ...descendants(c)])
function matchSimple(node, n) {
  if (n.type === 'tag') return n.value === '*' || node.tag === n.value
  if (n.type === 'universal') return true
  if (n.type === 'class') return node.classes.includes(n.value)
  if (n.type === 'attribute') { if (!(n.attribute in node.attrs)) return false; return n.operator ? (n.operator === '=' && String(node.attrs[n.attribute]) === n.value) : true }
  if (n.type === 'pseudo') {
    if (n.value === ':is') return n.nodes.some(s => matchComplex(node, s.nodes))
    if (n.value === ':not') return !n.nodes.some(s => matchComplex(node, s.nodes))
    if (n.value === ':has') return n.nodes.some(s => { const parts = s.nodes.filter(x => x.type !== 'comment'); const child = parts[0]?.type === 'combinator' && parts[0].value === '>'; const rest = child ? parts.slice(1) : parts; return (child ? node.children : descendants(node)).some(d => matchComplex(d, rest, child ? node : null, node)) })
    if (n.value === ':focus-within') return node.focusWithin
    if (n.value === ':first-child') return !!node.parent && node.parent.children[0] === node
    throw new Error(`row-1 model: unsupported pseudo ${n.value}`)
  }
  throw new Error(`row-1 model: unsupported selector part ${n.type}`)
}
// parts: one complex selector's nodes; matched right to left. `childOf` / `inside`: a relative :has() anchor (the leftmost compound must be that node's child / descendant).
function matchComplex(node, parts, childOf = null, inside = null) {
  const seq = [[]]
  for (const p of parts) { if (p.type === 'combinator') seq.push(p.value.trim() === '>' ? '>' : ' ', []); else if (p.type !== 'comment') seq[seq.length - 1].push(p) }
  const go = (cur, i) => {
    if (!seq[i].every(s => matchSimple(cur, s))) return false
    if (i === 0) return childOf ? cur.parent === childOf : inside ? (() => { for (let p = cur.parent; p; p = p.parent) if (p === inside) return true; return false })() : true
    const comb = seq[i - 1]
    if (comb === '>') return !!cur.parent && go(cur.parent, i - 2)
    for (let p = cur.parent; p; p = p.parent) if (go(p, i - 2)) return true
    return false
  }
  return go(node, seq.length - 1)
}
const matches = (node, selector) => parseSel(selector).nodes.some(s => matchComplex(node, s.nodes))
function specificity(nodes) {
  let b = 0, c = 0
  for (const n of nodes) {
    if (n.type === 'class' || n.type === 'attribute') b++
    else if (n.type === 'tag' && n.value !== '*') c++
    else if (n.type === 'pseudo') {
      if ([':is', ':not', ':has'].includes(n.value)) { const best = n.nodes.map(s => specificity(s.nodes)).sort((x, y) => y[0] - x[0] || y[1] - x[1])[0] || [0, 0]; b += best[0]; c += best[1] }
      else if (!n.value.startsWith('::')) b++
    }
  }
  return [b, c]
}
// the display this stylesheet gives a node at 640 px and narrower (null: none of its rules sets one)
function displayOf(node, rules) {
  let best = null
  rules.forEach((r, order) => {
    if (!('display' in r.decls) || !(r.media === null || r.media === `media ${PHONE}`)) return
    for (const sel of parseSel(r.selector).nodes) {
      if (!matchComplex(node, sel.nodes)) continue
      const sp = specificity(sel.nodes)
      if (!best || sp[0] > best.sp[0] || (sp[0] === best.sp[0] && (sp[1] > best.sp[1] || (sp[1] === best.sp[1] && order >= best.order)))) best = { sp, order, value: r.decls.display }
    }
  })
  return best ? best.value : null
}
const hiddenBy = (node, rules) => { for (let p = node; p; p = p.parent) if (displayOf(p, rules) === 'none') return p; return null }
// row 1 as the real components nest it: BuilderHeader's actions (New, the toolbar target, then the portalled "..."), the viewer's delivery strip in the target, and in it the Export control and PublishControls
function row1Model({ exportWrap = null, exportOpen = false, expanded = false, focusExport = false } = {}) {
  const exportTrigger = el('button', { 'aria-haspopup': 'menu', ...(expanded ? { 'aria-expanded': 'true' } : {}) })
  const exportBox = el('div', { 'data-studio-v4-shell': 'true', 'data-studio-download-control': 'true', class: 'flex items-center' }, [exportTrigger])
  if (focusExport) { exportBox.focusWithin = true }
  const exportNode = exportWrap === 'allowed' ? el('span', { 'data-state': 'closed', class: 'inline-flex rounded-md' }, [exportBox])
    : exportWrap === 'blocked' ? el('span', { 'data-studio-disabled-reason': 'true', 'data-state': 'closed', role: 'button', tabindex: '0', class: 'inline-flex rounded-md' }, [exportBox]) : exportBox
  if (focusExport && exportNode !== exportBox) exportNode.focusWithin = true
  const publishButton = el('button', { 'data-studio-publish-trigger': 'true' })
  const publishBox = el('div', { class: 'flex items-center' }, [publishButton])
  const strip = el('div', { class: 'flex flex-shrink-0 items-center gap-1' }, [exportNode, publishBox])
  const delivery = el('div', { 'data-studio-v4-delivery': 'true' }, [strip])
  const target = el('div', { 'data-studio-v4-toolbar-target': 'true', class: 'min-w-0 h-full overflow-hidden' }, [delivery])
  if (focusExport) { strip.focusWithin = delivery.focusWithin = target.focusWithin = true }
  const menuButton = el('button', { type: 'button', 'aria-label': 'Deck menu' })
  const menuRoot = el('span', { 'data-studio-phone-deck-menu': 'true', ...(exportOpen ? { 'data-export-open': 'true' } : {}) }, [menuButton])
  const newButton = el('button', { class: 'studio-shell-new' })
  const actions = el('div', { class: 'studio-shell-header-actions' }, [newButton, target, menuRoot])
  if (focusExport) actions.focusWithin = true
  const deckList = el('button', {}), title = el('span', { title: 'Q4 sales review' })
  const heading = el('div', { class: 'studio-shell-heading' }, [deckList, title])
  const header = el('header', { 'data-studio-v4-shell-header': 'true' }, [el('div', { class: 'h-full px-4 flex items-center' }, [heading, actions])])
  const column = el('div', { 'data-studio-v4-shell-column': 'true' }, [header])
  const rail = el('aside', { 'data-studio-v4-rail': 'true' }), bar = el('nav', { 'data-studio-phone-tabbar': 'true' })
  el('div', { 'data-studio-v4-shell': 'true' }, [rail, bar, column])
  return { heading, newButton, exportNode, exportBox, exportTrigger, publishBox, publishButton, strip, menuRoot, menuButton, actions, target }
}
function proveRow1(text, at = '') {
  const a = message => (at ? `${at}: row 1: ${message}` : `row 1: ${message}`)
  // the markup the model stands on, read from the real sources
  const viewer = read(VIEWER), area = read('components/builder/presentation-area.tsx'), download = read(DOWNLOAD), publish = read('components/publish-dialog.tsx'), reason = read('components/studio-disabled-reason.tsx'), header = read(HEADER)
  ok(viewer.includes('studioShell ? <div data-studio-v4-delivery="true" className={cn(isGenerating && "pointer-events-none opacity-50")}>{deliveryControls}</div> : toolbarContent') && /const deliveryControls = \(\n\s+<div className="flex flex-shrink-0 items-center gap-1">/.test(viewer) && /\{viewerIsReady \? downloadControls : null\}\n\s+<\/div>\n\s+\)/.test(viewer),
    a('(the viewer portals one delivery strip into the toolbar target; the download controls come last in it)'))
  ok(/<>\n\s+<PresentationDownloadControls\n[\s\S]*?\/>\n\s+<PublishControls\n/.test(area) && /<div className="flex flex-shrink-0 items-center gap-1">\n\s+<PresentationDownloadControls presentationUrl=\{null\}[^\n]*\/>\n\s+<PublishControls /.test(area), a('(Export and Publish are siblings in that strip, Publish after Export, in both the deck and the deferred-start paths)'))
  ok(/<div className=\{`flex items-center \$\{className\}`\} data-studio-v4-shell=\{STUDIO_DELIVERY\} data-studio-download-control=\{STUDIO_DELIVERY\}>/.test(download) && /return exportAfterBuild \? <StudioDisabledReason reason=\{exportBlockedReason\} label="Export">\{controls\}<\/StudioDisabledReason> : controls;/.test(download), a('(Export\'s own box, wrapped in the disabled-reason box only with the export-after-build flag)'))
  ok(/return \(\n\s+<div className=\{`flex items-center \$\{className\}`\}>\n\s+<button\n\s+ref=\{publishTriggerRef\}\n\s+data-studio-publish-trigger=/.test(publish), a('(PublishControls: a plain box around the Publish button)'))
  ok(/<span\n\s+data-studio-disabled-reason=\{blocked \? 'true' : undefined\}/.test(reason), a('(the disabled-reason box is marked only while Export is blocked)'))
  ok(/<div className="studio-shell-header-actions">\n\s+<Button className="studio-shell-new"[^\n]*\n[^\n]*\n\s+<div data-studio-v4-toolbar-target="true" ref=\{toolbarSlotRef\}/.test(header), a('(BuilderHeader\'s actions: New, then the toolbar target; the "..." is portalled in after them)'))
  const rules = cssRules(text)
  for (const variant of [null, 'allowed', 'blocked']) {
    const m = row1Model({ exportWrap: variant }), v = variant ?? 'no export-after-build'
    eq(hiddenBy(m.publishButton, rules), null, a(`${v}: Publish is not hidden (nor any box around it)`))
    eq(hiddenBy(m.menuButton, rules), null, a(`${v}: "..." is shown`))
    eq(displayOf(m.menuRoot, rules), 'inline-flex', a(`${v}: as an inline-flex item`))
    ok(hiddenBy(m.heading, rules) === m.heading && hiddenBy(m.newButton, rules) === m.newButton, a(`${v}: the title, the deck list button and New deck are hidden (into the menu)`))
    ok(hiddenBy(m.exportTrigger, rules) !== null, a(`${v}: Export is hidden (into the menu)`))
    ok(hiddenBy(m.exportTrigger, rules) === m.exportNode || hiddenBy(m.exportTrigger, rules) === m.exportBox, a(`${v}: by its own box (or the disabled-reason box around it), not by a box that also holds Publish`))
    eq(hiddenBy(m.strip, rules), null, a(`${v}: the delivery strip (Export + Publish) itself is not hidden`))
    for (const [label, opts] of [['the menu opening it', { exportOpen: true }], ['its own menu open', { expanded: true }], ['it has focus', { focusExport: true }]]) {
      const o = row1Model({ exportWrap: variant === 'blocked' ? 'allowed' : variant, ...opts })
      eq(hiddenBy(o.exportTrigger, rules), null, a(`${v}: Export shows while ${label}`))
      eq(hiddenBy(o.publishButton, rules), null, a(`${v}: and Publish still shows`))
    }
  }
  // the order on screen: "..." first in the action group (order -1), then the toolbar target, whose strip ends with Publish: Publish is the right-most control of row 1
  const m = row1Model()
  const orderOf = node => Number(rules.filter(r => r.media === `media ${PHONE}` && 'order' in r.decls && matches(node, r.selector)).map(r => r.decls.order).pop() ?? 0)
  const shownActions = m.actions.children.filter(c => !hiddenBy(c, rules)).sort((x, y) => orderOf(x) - orderOf(y))
  deep(shownActions.map(c => c === m.menuRoot ? 'menu' : c === m.target ? 'toolbar target' : 'other'), ['menu', 'toolbar target'], a('the shown action items, in order: "..." then the toolbar target'))
  deep(m.strip.children.filter(c => !hiddenBy(c, rules)).map(c => c === m.publishBox ? 'publish' : 'other'), ['publish'], a('the strip shows Publish only, so Publish is the far-right control, "..." just before it'))
}

// ---------------------------------------------------------------- 3. the menu and the dot, rendered
function compStubs(state, reactStub = React) {
  const passthrough = name => props => { state.calls.push([name, props]); const { children, asChild, ...rest } = props; return asChild ? children : h('div', { 'data-stub': name, ...Object.fromEntries(Object.entries(rest).filter(([k, v]) => typeof v !== 'function' && typeof v !== 'object').map(([k, v]) => [k === 'sideOffset' ? 'data-side-offset' : k, v])) }, children) }
  return {
    react: reactStub,
    'react-dom': { createPortal: (children, host) => ({ portal: children, host }) },
    'lucide-react': { MoreHorizontal: props => h('svg', { 'data-icon': 'MoreHorizontal', 'aria-hidden': props['aria-hidden'] }) },
    '@/components/ui/dropdown-menu': Object.fromEntries(['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuItem'].map(n => [n, passthrough(n)])),
  }
}
class FakeControl {
  constructor(attrs = {}, { disabled = false } = {}) { this.attrs = attrs; this.disabled = disabled; this.log = [] }
  getAttribute(name) { return name in this.attrs ? this.attrs[name] : null }
  setAttribute(name, value) { this.log.push(['set', name, value]) }
  removeAttribute(name) { this.log.push(['remove', name]) }
  matches(sel) { return sel === ':disabled' ? this.disabled : false }
  focus() { this.log.push(['focus']) }
  click() { this.log.push(['click']) }
  dispatchEvent(event) { this.log.push(['dispatch', event.type, event.key, event.bubbles]) ; return true }
}
function mount(found, { connectionState = 'connected', reconnectStatus, given = [] } = {}) {
  const state = { calls: [], effects: [], sets: [], refs: [] }
  const reactStub = {
    ...React,
    useState: initial => { const i = state.sets.length; state.sets.push([]); return [given[i] ?? initial, value => state.sets[i].push(value)] },
    useEffect: fn => { state.effects.push(fn) },
    useRef: initial => { const ref = { current: initial }; state.refs.push(ref); return ref },
  }
  const frames = []
  const globals = {
    document: { querySelector: sel => { if (found === 'throws') throw new SyntaxError(`'${sel}' is not a valid selector`); return found[sel] ?? null } },
    KeyboardEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init) } },
    requestAnimationFrame: fn => { frames.push(fn); return frames.length },
  }
  const { StudioPhoneBuilderTop, STUDIO_PHONE_DECK_MENU_HOST, STUDIO_PHONE_DIRECTOR_SEGMENT } = load(COMP, { stubs: compStubs(state, reactStub), globals })
  const tree = StudioPhoneBuilderTop({ connectionState, reconnectStatus })
  return { state, tree, frames, STUDIO_PHONE_DECK_MENU_HOST, STUDIO_PHONE_DIRECTOR_SEGMENT }
}
const findAll = (node, test, out = []) => { if (!node || typeof node !== 'object') return out; if (Array.isArray(node)) { node.forEach(n => findAll(n, test, out)); return out } if (node.portal) { findAll(node.portal, test, out); return out } if (test(node)) out.push(node); findAll(node.props?.children, test, out); return out }
function proveRender(at = '') {
  const a = message => (at ? `${at}: render: ${message}` : `render: ${message}`)
  const { STUDIO_PHONE_DECK_MENU_TARGETS: T } = lib()
  const first = mount({})
  eq(first.STUDIO_PHONE_DECK_MENU_HOST, '[data-studio-v4-shell-column] > [data-studio-v4-shell-header] .studio-shell-header-actions', a('row 1\'s host: the Builder top bar\'s action group'))
  eq(first.STUDIO_PHONE_DIRECTOR_SEGMENT, '[data-studio-v4-shell-workspace] > [data-studio-workspace-switch-v2="true"] .swsv2-segments > button:has(> svg.lucide-message-square)', a('row 2\'s host: the switch\'s Director segment (the one with the Director icon)'))
  ok(/<button type="button" aria-pressed=\{p\.directorPressed\} onClick=\{p\.onDirector\}><MessageSquare aria-hidden="true" \/>Director<\/button>/.test(read(SWITCH)), a('(the switch draws Director with the MessageSquare icon, which lucide classes lucide-message-square)'))
  deep(first.tree.props.children, [null, null], a('before the hosts are found nothing is drawn'))
  // the effect finds both hosts on the page and keeps them
  const menuHost = { id: 'actions' }, dotHost = { id: 'director' }
  const withHosts = mount({ [first.STUDIO_PHONE_DECK_MENU_HOST]: menuHost, [first.STUDIO_PHONE_DIRECTOR_SEGMENT]: dotHost })
  eq(withHosts.state.effects.length, 1, a('one effect, after every render (no dependency list: the switch comes and goes)'))
  match(read(COMP), /useEffect\(\(\) => \{\n\s+const nextMenu = [^\n]+\n\s+const nextDot = [^\n]+\n\s+setMenuHost\(current => \(current === nextMenu \? current : nextMenu\)\)\n\s+setDotHost\(current => \(current === nextDot \? current : nextDot\)\)\n\s+\}\)\n/, a('(and it sets a host only when it changed)'))
  withHosts.state.effects[0]()
  const pick = (i, current) => withHosts.state.sets[i].map(fn => (typeof fn === 'function' ? fn(current) : fn))
  deep([pick(0, null)[0] === menuHost, pick(1, null)[0] === dotHost, pick(0, menuHost)[0] === menuHost], [true, true, true], a('it finds the action group and the Director segment'))
  const oldBrowser = mount('throws')
  oldBrowser.state.effects[0]()
  deep([oldBrowser.state.sets[0].map(fn => fn(undefined)), oldBrowser.state.sets[1].map(fn => fn(undefined))], [[null], [null]], a('a browser without :has(): no host, no error (the old rows stay)'))
  // drawn into them
  const drawn = mount({}, { given: [menuHost, dotHost, 'Q4 sales review', [{ key: 'newDeck', label: 'New deck', disabled: false }, { key: 'export', label: 'Export presentation', disabled: true }]] })
  const [menuPortal, dotPortal] = drawn.tree.props.children
  ok(menuPortal.host === menuHost && dotPortal.host === dotHost, a('the menu is portalled into row 1, the dot into the Director segment'))
  const menuHtml = renderToStaticMarkup(menuPortal.portal)
  match(menuHtml, /^<span data-studio-phone-deck-menu="true"><div data-stub="DropdownMenu"><button type="button" aria-label="Deck menu"><svg data-icon="MoreHorizontal" aria-hidden="true"><\/svg><\/button>/, a('"...": a button named "Deck menu", the icon hidden, the dropdown\'s own trigger'))
  match(menuHtml, /<div data-stub="DropdownMenuContent" data-studio-v4-shell="true" data-studio-phone-deck-menu-content="true" align="end" data-side-offset="6"><div data-stub="DropdownMenuLabel" data-studio-phone-deck-menu-title="true">Q4 sales review<\/div><div data-stub="DropdownMenuSeparator"><\/div><div data-stub="DropdownMenuItem" data-studio-phone-deck-menu-item="newDeck">New deck<\/div><div data-stub="DropdownMenuItem" data-studio-phone-deck-menu-item="export" disabled="">Export presentation<\/div><\/div>/,
    a('the menu: the deck title as its header, then the entries, a disabled one disabled'))
  const trigger = findAll(menuPortal, n => n.props?.asChild === true)
  eq(trigger.length, 1, a('the Radix trigger wraps the "..." button (focus comes back to it when the menu closes)'))
  // opening reads the page: the deck title and the controls
  const controls = {
    [T.title]: new FakeControl({ title: 'Q4 sales review' }),
    [T.newDeck]: new FakeControl({ 'aria-label': 'New deck' }),
    [T.export]: new FakeControl({ 'aria-label': 'Export presentation' }),
    [T.notes]: new FakeControl({ 'aria-label': 'Show script and notes' }),
    [T.thumbnails]: new FakeControl({ 'aria-label': 'Show thumbnails' }),
    [T.slide]: new FakeControl({ title: 'Open slide panel' }),
    [T.deckList]: new FakeControl({ 'aria-label': 'Open deck list' }),
  }
  const live = mount(controls, { given: [menuHost, dotHost] })
  const menu = findAll(live.tree.props.children[0], n => n.props && 'onOpenChange' in n.props)[0]
  menu.props.onOpenChange(false)
  deep([live.state.sets[2], live.state.sets[3]], [[], []], a('closing reads nothing'))
  menu.props.onOpenChange(true)
  deep(live.state.sets[2], ['Q4 sales review'], a('opening reads the deck title from the top bar'))
  deep(live.state.sets[3][0].map(i => [i.key, i.label, i.disabled]), [['newDeck', 'New deck', false], ['export', 'Export presentation', false], ['notes', 'Show script and notes', false], ['thumbnails', 'Show thumbnails', false], ['slide', 'Open slide panel', false], ['deckList', 'Open deck list', false]],
    a('and an entry for each control on the page, named as it is (Presenter details is not on this page: no entry)'))
  controls[T.export].disabled = true
  menu.props.onOpenChange(true)
  eq(live.state.sets[3][1][1].disabled, true, a('Export disabled on the page: disabled in the menu'))
  // each entry runs the page's own control once the menu has closed
  const items = [{ key: 'notes', label: 'n', disabled: false }, { key: 'export', label: 'e', disabled: false }, { key: 'presenter', label: 'p', disabled: false }, { key: 'slide', label: 's', disabled: false }]
  const run = (key, found) => {
    const r = mount(found, { given: [menuHost, dotHost, 't', items] })
    const rootEl = new FakeControl()
    r.state.refs[1].current = rootEl
    const entry = findAll(r.tree.props.children[0], n => n.props?.['data-studio-phone-deck-menu-item'] === key)[0]
    const content = findAll(r.tree.props.children[0], n => n.props && 'onCloseAutoFocus' in n.props)[0]
    entry.props.onSelect()
    let prevented = false
    content.props.onCloseAutoFocus({ preventDefault: () => { prevented = true } })
    return { r, rootEl, prevented, content }
  }
  for (const key of ['notes', 'slide']) {
    const control = new FakeControl()
    const { prevented } = run(key, { [T[key]]: control })
    deep(control.log, [['click']], a(`${key}: its own control is clicked, once`))
    eq(prevented, false, a(`${key}: focus goes back to "..." (Radix's default)`))
  }
  const identity = new FakeControl()
  const p = run('presenter', { [T.presenter]: identity })
  deep(identity.log, [['click']], a('Presenter details: its button is clicked'))
  eq(p.prevented, true, a('Presenter details: its dialog keeps the focus'))
  const exportButton = new FakeControl()
  const e = run('export', { [T.export]: exportButton })
  eq(e.prevented, true, a('Export: its menu keeps the focus'))
  deep(e.rootEl.log, [['set', 'data-export-open', 'true']], a('Export: shown in row 1 for the moment it takes to open'))
  deep(exportButton.log, [['focus'], ['dispatch', 'keydown', 'Enter', true]], a('Export: focused and opened with Enter, the way a keyboard opens a Radix menu (its own menu, its own PDF / PPTX handlers)'))
  eq(e.r.frames.length, 1, a('one frame later'))
  e.r.frames[0]()
  deep(e.rootEl.log, [['set', 'data-export-open', 'true'], ['remove', 'data-export-open']], a('the mark comes off (the control stays while its menu is open or it has focus: the stylesheet)'))
  const gone = run('notes', {})
  eq(gone.prevented, false, a('a control that went away meanwhile: nothing happens'))
  // closing without a choice runs nothing
  const idle = mount({}, { given: [menuHost, dotHost, 't', items] })
  const idleContent = findAll(idle.tree.props.children[0], n => n.props && 'onCloseAutoFocus' in n.props)[0]
  let idlePrevented = false
  idleContent.props.onCloseAutoFocus({ preventDefault: () => { idlePrevented = true } })
  eq(idlePrevented, false, a('closed with no choice: focus back to "...", nothing run'))
  ok(!/onEscapeKeyDown|onPointerDownOutside|onInteractOutside|modal=\{false\}/.test(read(COMP)), a('the menu keeps Radix\'s Escape, outside tap and modal defaults'))
  // the dot, for every state: its tone and the word that completes the segment's name ("Director connected")
  for (const c of CONNECTIONS.filter(Boolean)) for (const r of RECONNECTS) {
    const m = mount({}, { connectionState: c, reconnectStatus: r, given: [menuHost, dotHost] })
    const want = lib().studioDirectorDot(c, r)
    const html = renderToStaticMarkup(m.tree.props.children[1].portal)
    eq(html.replace(/&#x27;/g, "'"), `<span data-studio-phone-director-dot="${want.tone}"><span class="sr-only"> ${want.state}</span></span>`, a(`${c} / ${r}: the dot is ${want.tone}; the segment reads "Director ${want.state}"`))
  }
}

// ---------------------------------------------------------------- 4. the pin
const LINE_RE = [
  /^import \{ StudioPhoneBuilderTop \} from '@\/components\/builder\/studio-phone-builder-top' \/\/ PHONE-SHELL-TOP \(NEXT_PUBLIC_STUDIO_PHONE_SHELL, default off\): /,
  /^ {6}\{STUDIO_PHONE_SHELL_ENABLED && <StudioPhoneBuilderTop connectionState=\{connectionState\} reconnectStatus=\{reconnectStatus\} \/>\}\{\/\* PHONE-SHELL-TOP: [^*]+\*\/\}$/,
]
const AFTER = ["import { STUDIO_PHONE_SHELL_ENABLED } from '@/lib/studio-phone-shell' // PHONE-SHELL-NAV", /^ {6}\{STUDIO_PHONE_SHELL_ENABLED && <StudioPhoneTabBar /]
function provePin(text, stripFn = stripPhoneShellTop, at = '') {
  const a = message => (at ? `${at}: ${PAGE}: ${message}` : `${PAGE}: ${message}`)
  eq(sha(stripFn(PAGE, withoutOthers(PAGE, text))), sha(withoutOthers(PAGE, baseOf(PAGE))), a('without this change\'s lines it is the base commit\'s (PR 1\'s head) file, byte for byte'))
  eq(sha(stripFn(PAGE, text)), sha(baseOf(PAGE)), a('and the file as it is, without this change\'s lines, is PR 1\'s head file as it is'))
  eq(sha(stripLaterChanges(PAGE, text)), sha(stripLaterChanges(PAGE, baseOf(PAGE))), a('and through the registry (innermost, as every older pin reads it) it is the studio base\'s file'))
  const lines = text.split('\n'), mine = lines.filter(marked)
  deep(lines.filter(line => !marked(line)), baseOf(PAGE).split('\n'), a('every base line is there, in order, none changed'))
  eq(mine.length, 2, a('exactly two lines are this change\'s'))
  LINE_RE.forEach((re, i) => ok(re.test(mine[i] ?? ''), a(`line ${i + 1} is ${['the import', 'the element, drawn only with the flag'][i]}`)))
  eq(lines[lines.indexOf(mine[0]) - 1], AFTER[0], a('the import comes right after PR 1\'s flag import'))
  ok(AFTER[1].test(lines[lines.indexOf(mine[1]) - 1] ?? ''), a('the element right after PR 1\'s bar'))
  nomatch(mine.join('\n').replace(/\/\/.*$|\{\/\*.*?\*\/\}/gm, ''), /process\.env/, a('the lines read no environment'))
  eq(stripFn(PAGE, stripFn(PAGE, text)), stripFn(PAGE, text), a('stripping twice changes nothing more'))
}
function proveUntouched(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of [HEADER, SWITCH, 'components/builder/studio-workspace-switch-v2.css', DIRECTOR, DIRECTOR_CSS, VIEWER, NOTES, DOWNLOAD, IDENTITY, 'components/layout/studio-rail.tsx', 'components/layout/app-header.tsx', PR1_LIB, PR1_BAR, PR1_CSS, 'app/(app)/layout.tsx'])
    eq(sha(read(rel)), sha(baseOf(rel)), a(`${rel} is the base commit's, byte for byte`))
  // STACK: a change registered after this one (perceived speed) appends its own .env.example block; both sides are read through the registry, which takes every registered block out
  eq(sha(stripLaterChanges('.env.example', read('.env.example'))), sha(stripLaterChanges('.env.example', baseOf('.env.example'))), a(".env.example is the base commit's, byte for byte (through the registry)"))
}

// ---------------------------------------------------------------- 5. flag off
function proveFlagOff(at = '') {
  const a = message => (at ? `${at}: flag off: ${message}` : `flag off: ${message}`)
  const mine = read(PAGE).split('\n').filter(marked)
  ok(mine[1].trimStart().startsWith('{STUDIO_PHONE_SHELL_ENABLED && <StudioPhoneBuilderTop '), a('the Builder draws the component only when PR 1\'s constant is true (exact "true" with the shell; PR 1\'s proof holds it false in every other state)'))
  match(read(PR1_LIB), /export const STUDIO_PHONE_SHELL_ENABLED = studioPhoneShellOn\(process\.env\.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL\)/, a('(PR 1\'s constant)'))
  const importers = ['app', 'components', 'hooks', 'lib'].flatMap(dir => fs.readdirSync(path.join(root, dir), { recursive: true }).map(name => `${dir}/${name}`)).filter(rel => /\.tsx?$/.test(rel) && rel !== COMP && /from ['"]@\/components\/builder\/studio-phone-builder-top['"]/.test(read(rel))).sort()
  deep(importers, [PAGE], a('only the Builder imports the component'))
  // every rule needs the bar root or this change's own elements (section 2): without the flag none of them is on the page
  const flagOnly = ['data-studio-phone-tabbar', 'data-studio-phone-deck-menu', 'data-studio-phone-director-dot', 'data-studio-phone-deck-menu-content']
  for (const name of flagOnly) {
    const owners = ['app', 'components'].flatMap(dir => fs.readdirSync(path.join(root, dir), { recursive: true }).map(n => `${dir}/${n}`)).filter(rel => /\.tsx$/.test(rel) && new RegExp(`${name}=`).test(read(rel)))
    deep(owners.sort(), (name === 'data-studio-phone-tabbar' ? [PR1_BAR] : [COMP]).sort(), a(`${name} is drawn only by ${name === 'data-studio-phone-tabbar' ? 'PR 1\'s bar' : 'this change\'s component'}, which only the flag draws`))
  }
}

// ---------------------------------------------------------------- 6. the change
function proveStrip(stripFn, at = '') {
  const a = message => (at ? `${at}: strip: ${message}` : `strip: ${message}`)
  eq(stripFn('lib/other.ts', 'x // PHONE-SHELL-TOP'), 'x // PHONE-SHELL-TOP', a('any other file is returned as it is'))
  eq(stripFn(PAGE, 'a\n{x}{/* PHONE-SHELL-TOP: y */}\nc\n'), 'a\nc\n', a('a marked line goes, every other byte stays (trailing newline too)'))
  const keep = 'a\nb // PHONE-SHELL-NAV\nc // PHONE-SHELL-TOPX\nd // XPHONE-SHELL-TOP\ne // PHONE-SHELL-TOP-2\n'
  eq(stripFn(PAGE, keep), keep, a('only this change\'s marker, as a whole token: PR 1\'s lines stay'))
  eq(stripFn(PAGE, 7), 7, a('a non-string comes back'))
  deep(PHONE_SHELL_TOP_FILES, [PAGE], a('the strip takes lines out of the Builder page only'))
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: registry: ${message}` : `registry: ${message}`)
  const lines = registryText.split('\n').filter(line => line.includes("'./studio-phone-shell-builder-top-strip.mjs'"))
  eq(lines.length, 2, a('exactly two lines for this change: its files and its strip (no .env.example block: the flag\'s block is PR 1\'s)'))
  ok(lines.every(line => line.endsWith("// LATER-CHANGE: FRONTEND-2, phone shell 2, the Builder top on phones and the Director dot (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)")), a('each carries the LATER-CHANGE marker'))
  match(lines[0], /^ {2}\.\.\.\(await import\('\.\/studio-phone-shell-builder-top-strip\.mjs'\)\)\.PHONE_SHELL_TOP_SCOPE_FILES,/, a('line 1: the files'))
  match(lines[1], /^ {2}\(await import\('\.\/studio-phone-shell-builder-top-strip\.mjs'\)\)\.stripPhoneShellTop,/, a('line 2: the strip'))
  const at1 = registryText.indexOf(lines[0]), at2 = registryText.indexOf(lines[1])
  const files = registryText.indexOf('export const LATER_CHANGE_FILES'), blocks = registryText.indexOf('export const LATER_ENV_BLOCKS'), strips = registryText.indexOf('export const LATER_STRIPS')
  ok(files < at1 && at1 < blocks && strips < at2, a('each in its list'))
  const navFiles = registryText.indexOf("'./studio-phone-shell-nav-strip.mjs')).PHONE_SHELL_NAV_SCOPE_FILES"), navStrip = registryText.indexOf("'./studio-phone-shell-nav-strip.mjs')).stripPhoneShellNav")
  ok(navFiles > 0 && navFiles < at1 && navStrip > 0 && navStrip < at2, a('each right after PR 1\'s in the same list'))
  ok(!registryText.slice(blocks, strips).includes('studio-phone-shell-builder-top-strip'), a('nothing of this change in LATER_ENV_BLOCKS'))
  ok(LATER_STRIPS.includes(stripPhoneShellTop), a('the registry holds the strip'))
  ok([...PHONE_SHELL_TOP_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('the registry names every file of this change'))
  ok(!LATER_ENV_BLOCKS.some(block => /PHONE-SHELL-TOP|phone shell 2/i.test(String(block))), a('no env block of its own'))
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: scope: ${message}` : `scope: ${message}`)
  ok([...PHONE_SHELL_TOP_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
  eq(PHONE_SHELL_TOP_SCOPE_FILES.size, PHONE_SHELL_TOP_FILES.length + PHONE_SHELL_TOP_NEW_FILES.length + PHONE_SHELL_TOP_OWN_EDITS.length, a('the lists do not overlap'))
  const family = ['lib', 'components/builder', 'scripts'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(name => /builder-top/.test(name)).map(name => `${dir}/${name}`))
  deep(family.filter(rel => !PHONE_SHELL_TOP_SCOPE_FILES.has(rel)), [], a('no file of this change\'s family is missing from its list'))
  const committed = ownCommitted()
  deep(committed.filter(rel => !PHONE_SHELL_TOP_SCOPE_FILES.has(rel)), [], a(`every file in this change's committed diff (${BASE.slice(0, 8)}..HEAD) is its own`))
  if (committed.length) {
    deep([...PHONE_SHELL_TOP_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    deep(committed.filter(rel => /^scripts\/test-/.test(rel)), [THIS_TEST], a('the only test it adds or edits is its own (no older test is edited)'))
    deep(committed.filter(rel => /^(app|components|lib|hooks)\//.test(rel)).sort(), [PAGE, LIB, COMP, CSS].sort(), a('the app files: the Builder page (two marked lines) and the new lib, component and sheet'))
  }
}
function proveSecretScan(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [LIB, COMP, CSS, STRIP_MODULE, THIS_TEST].map(read).concat(read(PAGE).split('\n').filter(marked)).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
  // the patterns of scripts/test-studio-thumbnail-last-good.mjs, whose added-lines scan leaves a registered later change's new files to their own proofs; its bare "key" name is left out (phone shell 1's link table is { key: 'knowledge', ... })
  nomatch(added, /(?:secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no quoted literal assigned to a credential-shaped name (the thumbnail proof\'s names)'))
  nomatch(added, /eyJ[A-Za-z0-9_-]{10,}\.|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|Bearer [A-Za-z0-9._-]{20,}/, a('no token, key or bearer string'))
}

function proveAll(stripFn = stripPhoneShellTop, at = '') {
  proveLib(at)
  proveCss(read(CSS), at)
  proveRow1(read(CSS), at)
  proveRender(at)
  provePin(read(PAGE), stripFn, at)
  proveUntouched(at)
  proveFlagOff(at)
  proveStrip(stripFn, at)
  proveRegistry(read(REGISTRY), at)
  proveScope(at)
  proveSecretScan(at)
}
proveAll()
console.log(`flag off: the Builder page without this change's two lines is PR 1's head byte for byte (sha256 ${sha(stripPhoneShellTop(PAGE, read(PAGE))).slice(0, 16)} == ${sha(baseOf(PAGE)).slice(0, 16)}), and through the registry the studio base's; both lines gated on the flag`)
console.log(`PASS lib, stylesheet, render, pin, flag off, change: ${checks} checks`)

{ // the row-1 model alone (not only the selector-text check of section 2) catches the #517 defect: Export hidden through the strip it shares with Publish
  const buggy = read(CSS).replace('[data-studio-disabled-reason]:has(> [data-studio-download-control])', ':has(> [data-studio-download-control])')
  let caught = null
  try { proveRow1(buggy, 'defect') } catch (error) { caught = String(error.message).split('\n')[0] }
  if (buggy === read(CSS) || !caught || !/Publish is not hidden/.test(caught)) { console.log(`row 1: the structural check did NOT catch the #517 defect (${caught})`); process.exit(1) }
  console.log(`row 1: the structural check alone catches the #517 defect: ${caught.slice(0, 140)}`)
}

// =========================================================== 7. mutants
const killed = [], survived = []
async function mutant(name, edits, { strip = stripPhoneShellTop } = {}) {
  const before = overrides
  try {
    overrides = { ...before }
    for (const [rel, from, to, mode] of edits) {
      const source = read(rel), n = source.split(from).length - 1
      assert.ok(mode ? n >= 1 : n === 1, `mutant "${name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = mode === 'all' ? source.split(from).join(to) : source.replace(from, () => to)
    }
    proveAll(strip, name)
  } catch (error) {
    if (/no longer applies/.test(String(error.message))) throw error
    killed.push(name); if (process.env.PHONE_SHELL_TOP_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
const lb = (from, to) => [LIB, from, to], cp = (from, to) => [COMP, from, to], css = (from, to, mode) => [CSS, from, to, mode]
// the lib
await mutant('lib: reconnecting is red', [lb("if (reconnectStatus === 'scheduled') return { tone: 'amber', state: 'reconnecting' }", "if (reconnectStatus === 'scheduled') return { tone: 'red', state: 'reconnecting' }")])
await mutant('lib: offline is amber', [lb("return { tone: 'red', state: 'offline, will retry' }", "return { tone: 'amber', state: 'offline, will retry' }")])
await mutant('lib: connecting is green', [lb("if (connectionState === 'connecting') return { tone: 'amber', state: 'connecting' }", "if (connectionState === 'connecting') return { tone: 'green', state: 'connecting' }")])
await mutant('lib: the reconnect status wins over connected', [lb("  if (connectionState === 'connected') return { tone: 'green', state: 'connected' }\n", ''), lb("  if (connectionState === 'connecting') return", "  if (connectionState === 'connected') return { tone: 'green', state: 'connected' }\n  if (connectionState === 'connecting') return")])
await mutant('lib: an unknown state is green', [lb("  return { tone: 'red', state: 'disconnected' }\n}", "  return { tone: 'green', state: 'connected' }\n}")])
await mutant('lib: the word differs from the header\'s', [lb("state: 'connection error'", "state: 'error'")])
await mutant('lib: Notes before Export', [lb("['newDeck', 'export', 'notes',", "['newDeck', 'notes', 'export',")])
await mutant('lib: the slide panel has no entry', [lb("'thumbnails', 'slide', 'deckList'", "'thumbnails', 'deckList'")])
await mutant('lib: a disabled control is enabled in the menu', [lb('disabled: probe.disabled === true', 'disabled: false')])
await mutant('lib: the menu names its own words, not the control\'s', [lb("const label = typeof probe.label === 'string' && probe.label.trim() !== '' ? probe.label.trim() : FALLBACK[key]", 'const label = FALLBACK[key]')])
await mutant('lib: Notes targets the notes panel, not its tab', [lb('[data-studio-v4-shell-workspace] [data-studio-notes-handle="true"] > button', '[data-studio-v4-shell-workspace] [data-studio-slide-notes="true"] button')])
await mutant('lib: Export targets the whole delivery strip', [lb('[data-studio-download-control] button[aria-haspopup="menu"]', '[data-studio-v4-delivery] button')])
await mutant('lib: the Director tab has no home', [lb("  director: 'the Director segment of the Slides | Director switch (row 2)',\n", '')])
// the stylesheet
await mutant('css: the switch moves into row 1 (the proposal PK changed)', [css('\n@media (max-width: 640px) {', `\n@media (max-width: 640px) {\n  ${ROOTSEL} [data-studio-workspace-switch-v2="true"] { position: absolute; top: 0; }`)])
await mutant('css: the dot grows the segment (in the flow)', [css('display: block; position: absolute; top: calc(50% - 3px); right: 2px;', 'display: inline-block; margin-left: 4px;')])
await mutant('css: the dot over the word', [css('right: 2px; width: 6px;', 'right: 12px; width: 6px;')])
await mutant('css: amber is purple', [css('[data-studio-phone-director-dot="amber"] { background: #d97706; }', '[data-studio-phone-director-dot="amber"] { background: var(--ss-accent); }')])
await mutant('css: no dark colours', [css('  .dark [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) [data-studio-phone-director-dot="red"] { background: #f87171; }\n', '')])
await mutant('css: the dot shows on tablets', [css('[data-studio-phone-director-dot] { display: none; }\n', '')])
await mutant('css: the Director row goes even without the dot', [css('[data-studio-v4-shell-workspace]:has([data-studio-phone-director-dot]) [data-studio-director-header="true"]:not', '[data-studio-v4-shell-workspace] [data-studio-director-header="true"]:not')])
await mutant('css: the Director row goes even with Reconnect in it', [css('[data-studio-director-header="true"]:not(:has(> :nth-child(4))) { display: none; }', '[data-studio-director-header="true"] { display: none; }')])
await mutant('css: the Director tab goes without the switch', [css('[data-studio-v4-shell-workspace]:has(> [data-studio-workspace-switch]) [data-studio-drawer-handle="director"]', '[data-studio-v4-shell-workspace] [data-studio-drawer-handle="director"]')])
await mutant('css: the Notes tab stays', [css(', [data-studio-notes-handle="true"]) { display: none; }', ') { display: none; }')])
await mutant('css: the Element tab goes too', [css('[data-studio-drawer-handle="slide"], [data-studio-v4-thumbnail-toggle="true"]', '[data-studio-drawer-handle="slide"], [data-studio-drawer-handle="element"], [data-studio-v4-thumbnail-toggle="true"]')])
await mutant('css: Export stays in row 1', [css('[data-studio-v4-toolbar-target] :is([data-studio-download-control], [data-studio-disabled-reason]:has(> [data-studio-download-control])):not(:focus-within):not(:has([aria-expanded="true"])) { display: none; }', '[data-studio-v4-toolbar-target] .never { display: none; }')])
await mutant('css: Export hidden even while its menu is open', [css(':not(:focus-within):not(:has([aria-expanded="true"])) { display: none; }', ':not(:focus-within) { display: none; }')])
await mutant('css: Export hidden with the box that also holds Publish (the #517 defect: no Publish on a phone)', [css('[data-studio-disabled-reason]:has(> [data-studio-download-control])', ':has(> [data-studio-download-control])')])
await mutant('css: the whole toolbar target hidden', [css('\n  /* the menu (portalled', `\n  ${ROOTSEL} > [data-studio-v4-shell-column] > [data-studio-v4-shell-header] [data-studio-v4-toolbar-target] { display: none; }\n  /* the menu (portalled`)])
await mutant('css: the blocked Export box stays (a focusable empty box in row 1)', [css('[data-studio-disabled-reason]:has(> [data-studio-download-control])', '[data-never]:has(> [data-studio-download-control])')])
await mutant('css: "..." after Publish', [css('display: inline-flex; order: -1; flex-shrink: 0;', 'display: inline-flex; order: 9; flex-shrink: 0;')])
await mutant('css: "..." is 28 px', [css('width: 44px; height: 34px;', 'width: 28px; height: 28px;')])
await mutant('css: the title stays in row 1', [css(' .studio-shell-heading { display: none; }', ' .studio-shell-heading { display: flex; }')])
await mutant('css: desktop: "Connected" keeps its words', [css('> [data-studio-chat-header-state="ready"] { gap: 0; font-size: 0; }', '> [data-studio-chat-header-state="ready"] { gap: 5px; }')])
await mutant('css: desktop: every state loses its words', [css('> [data-studio-chat-header-state="ready"] { gap: 0; font-size: 0; }', '> [role="status"] { gap: 0; font-size: 0; }')])
await mutant('css: desktop: the status line stays under the name', [css(`${HEAD_DESKTOP} { display: flex; }\n`, '')])
await mutant('css: desktop rule for every studio header', [css(`${HEAD_DESKTOP} { display: flex; }`, '[data-studio-v4-shell="true"] [data-studio-director-header="true"] { display: flex; }')])
await mutant('css: !important', [css('{ display: inline-flex; order: -1;', '{ display: inline-flex !important; order: -1;')])
await mutant('css: the rail touched', [css('\n  /* the menu (portalled', `\n  ${ROOTSEL} > [data-studio-v4-rail] { display: none; }\n  /* the menu (portalled`)])
// the component
await mutant('component: the dot replaces the segment\'s word', [cp('<span className="sr-only">{` ${dot.state}`}</span>', '<span>{dot.state}</span>')])
await mutant('component: the dot has no words', [cp('<span className="sr-only">{` ${dot.state}`}</span>', '')])
await mutant('component: the trigger has no name', [cp('<button type="button" aria-label="Deck menu">', '<button type="button">')])
await mutant('component: no deck title in the menu', [cp('{title ?? "Studio"}', '"Menu"')])
await mutant('component: Export is clicked (a Radix trigger ignores a click)', [cp('      control.focus()\n      control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))\n', '      control.click()\n')])
await mutant('component: Export is never shown', [cp('      root.current?.setAttribute("data-export-open", "true")\n', '')])
await mutant('component: Export stays shown', [cp('      requestAnimationFrame(() => root.current?.removeAttribute("data-export-open"))\n', '')])
await mutant('component: focus is pulled back to "..." over the Presenter dialog', [cp('    if (key === "presenter") event.preventDefault()\n', '')])
await mutant('component: the entry runs before the menu has closed', [cp('onSelect={() => { pending.current = item.key }}', 'onSelect={() => { document.querySelector(STUDIO_PHONE_DECK_MENU_TARGETS[item.key])?.click() }}')])
await mutant('component: the entries are read once, not at each opening', [cp('    if (!open) return\n', '    if (open) return\n')])
await mutant('component: the hosts are looked up once', [cp('    setDotHost(current => (current === nextDot ? current : nextDot))\n  })', '    setDotHost(current => (current === nextDot ? current : nextDot))\n  }, [])')])
await mutant('component: the dot goes into the whole switch', [cp(".swsv2-segments > button:has(> svg.lucide-message-square)'", ".swsv2-segments'")])
await mutant('component: a browser without :has() throws', [cp('const find = (selector: string): Element | null => { try { return document.querySelector(selector) } catch { return null } }', 'const find = (selector: string): Element | null => document.querySelector(selector)')])
await mutant('component: the menu is drawn in place, not in row 1', [cp('        menuHost,\n      )}', '        document.body,\n      )}')])
// the pin
const PAGE_EL = read(PAGE).split('\n').filter(marked)[1]
await mutant('page: the element loses its marker', [[PAGE, PAGE_EL, PAGE_EL.replace(/\{\/\*.*\*\/\}$/, '')]])
await mutant('page: drawn without the flag', [[PAGE, '      {STUDIO_PHONE_SHELL_ENABLED && <StudioPhoneBuilderTop', '      {studioShell && <StudioPhoneBuilderTop']])
await mutant('page: the dot reads the wrong state', [[PAGE, '<StudioPhoneBuilderTop connectionState={connectionState} reconnectStatus={reconnectStatus} />', '<StudioPhoneBuilderTop connectionState="connected" />']])
await mutant('page: an unmarked line added', [[PAGE, PAGE_EL, `${PAGE_EL}\n      {null}`]])
await mutant('page: a base line changed', [[PAGE, AFTER[0], `${AFTER[0]};`]])
await mutant('BuilderHeader: edited', [[HEADER, '<div className="studio-shell-header-actions">', '<div className="studio-shell-header-actions" data-phone="true">']])
await mutant('switch: edited', [[SWITCH, '<MessageSquare aria-hidden="true" />Director</button>', '<MessageSquare aria-hidden="true" />Director<i /></button>']])
await mutant('Director header: edited', [[DIRECTOR, '<strong>Director</strong>', '<strong>Director</strong><i />']])
await mutant('PR 1\'s sheet: edited', [[PR1_CSS, '[data-studio-phone-tabbar="true"] { display: none; }', '[data-studio-phone-tabbar="true"] { display: none; visibility: hidden; }']])
// the strip, the registry
await mutant('strip: leaves the marked lines', [], { strip: (rel, text) => text })
await mutant('strip: the marker is a substring (PR 1\'s lines go too)', [], { strip: (rel, text) => (PHONE_SHELL_TOP_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes('PHONE-SHELL')).join('\n') : text) })
await mutant('strip: drops the trailing newline', [], { strip: (rel, text) => { const out = stripPhoneShellTop(rel, text); return PHONE_SHELL_TOP_FILES.includes(rel) && typeof out === 'string' ? out.replace(/\n$/, '') : out } })
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-phone-shell-builder-top-strip.mjs')).PHONE_SHELL_TOP_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, phone shell 2, the Builder top on phones and the Director dot (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)\n", '']])
await mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-phone-shell-builder-top-strip.mjs')).stripPhoneShellTop, // LATER-CHANGE: FRONTEND-2, phone shell 2, the Builder top on phones and the Director dot (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)\n", '']])
await mutant('secret scan: a bearer string in an ordinary name', [[STRIP_MODULE, "export const PHONE_SHELL_TOP_MARKER = 'PHONE-SHELL-TOP'", `export const PHONE_SHELL_TOP_MARKER = 'PHONE-SHELL-TOP'\nconst note = '${['Bearer ', 'a'.repeat(24)].join('')}'`]])
await mutant('secret scan: a credential-named literal', [[STRIP_MODULE, "export const PHONE_SHELL_TOP_MARKER = 'PHONE-SHELL-TOP'", `export const PHONE_SHELL_TOP_MARKER = 'PHONE-SHELL-TOP'\nconst ${['user', 'Credential'].join('')} = '${['abcdefgh', '12345678'].join('')}'`]])
await mutant('secret scan: a credential-shaped literal', [[STRIP_MODULE, "export const PHONE_SHELL_TOP_MARKER = 'PHONE-SHELL-TOP'", `export const PHONE_SHELL_TOP_MARKER = 'PHONE-SHELL-TOP'\nconst ${['api', 'Key'].join('')} = '${['AKIA', 'ABCDEFGH', '12345678'].join('')}'`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.log('SURVIVED:\n  ' + survived.join('\n  ')); process.exit(1) }
console.log(`test-studio-phone-shell-builder-top: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
