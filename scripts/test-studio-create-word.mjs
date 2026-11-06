// PASS2B G56 (FRONTEND-2): one word for the create action, "New deck", on the Decks page, the Sessions panel and the top bar. Flag
// NEXT_PUBLIC_STUDIO_CREATE_WORD (exact "true", Studio shell only), default off.
//
// Run: node scripts/test-studio-create-word.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   CREATE_WORD_BASE=<commit> overrides the base commit the flag-off identity is checked against (default e9503ae).
//
// Proven on the REAL sources: lib/studio-create-word.ts, app/(app)/dashboard/page.tsx, components/chat-history-sidebar.tsx and
// components/builder/builder-header.tsx (each rendered with stubbed hooks and UI leaves):
//   1. the word: one constant; the helper returns it only for a real true and the caller's own word otherwise; import-free;
//   2. the Decks page ("New Presentation" at the top, "Create Presentation" in each empty state), the Sessions panel ("Presentation") and the top bar
//      (aria-label, title and text of the create button, with the top-bar flag off and on): flag off (unset, "", "false", near-misses, or "true" without the
//      Studio shell) every markup is the base commit's, byte for byte; on, the words are the constant and nothing else changes (the top bar flag already says
//      "New deck", so it is untouched);
//   3. source level: with the G56 lines reverted each file is the base commit's (the Decks page also carries this batch's G53 grid lines, reverted too so one
//      flag is proved at a time); each flag read is inline, exact "true", Studio shell only, and the helper's fallbacks are the base's literals;
//   4. mutation check: every mutant of the sources is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { stripDeckCardCount } from './studio-deck-card-count-strip.mjs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { stripDeckTitle } from './studio-deck-title-strip.mjs'
import { stripLaunchWording } from './studio-launch-wording-strip.mjs' // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (launched wording): its flag-gated edits come out first, before every older change's strip
import { stripDeckCardThumbnail } from './studio-deck-card-thumbnail-strip.mjs' // DECK-CARD-THUMBNAIL (NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED, COMPOSER-2): its marked lines on the Decks page come out first, before every older change's strip

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE_COMMIT = process.env.CREATE_WORD_BASE || 'e9503ae'
const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // DECK-CARD-THUMBNAIL: its lines out first
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const LIB = 'lib/studio-create-word.ts'
const DASH = 'app/(app)/dashboard/page.tsx'
const SIDEBAR = 'components/chat-history-sidebar.tsx'
const HEADER = 'components/builder/builder-header.tsx'
const TOP_BAR = 'lib/studio-top-bar-v2.ts'
const SOURCES = Object.fromEntries([LIB, DASH, SIDEBAR, HEADER].map(file => [file, read(file)]))
const FLAG = 'NEXT_PUBLIC_STUDIO_CREATE_WORD'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const NEW_DECK = 'New deck'
const compiled = new Map()
const compile = (source, fileName) => {
  const key = `${fileName}\u0000${source}`
  if (!compiled.has(key)) compiled.set(key, ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compiled.get(key)
}
function evaluate(source, fileName, table = {}, env = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(source, fileName), { module, exports: module.exports, process: { env }, Date, Set, Map, Array, encodeURIComponent, require: spec => { if (spec.endsWith('.css')) return {}; if (!(spec in table)) throw new Error(`unexpected import ${spec}`); return table[spec] } })
  return module.exports
}
const loadLib = source => evaluate(source, LIB)

// ---------------------------------------------------------------- 1. the word
function proveLib(lib, label = 'lib') {
  eq(lib.STUDIO_NEW_DECK_LABEL, NEW_DECK, `${label}: the word`)
  for (const original of ['New Presentation', 'Create Presentation', 'Presentation', 'Add presentation', '']) {
    eq(lib.studioCreateLabel(true, original), NEW_DECK, `${label}: on gives the one word for "${original}"`)
    eq(lib.studioCreateLabel(false, original), original, `${label}: off gives the caller's word "${original}"`)
  }
  for (const notTrue of [undefined, null, 0, 1, '', 'true', 'false', {}, [], NaN]) eq(lib.studioCreateLabel(notTrue, 'Presentation'), 'Presentation', `${label}: ${JSON.stringify(notTrue) ?? String(notTrue)} is not a real true`)
  nomatch(SOURCES[LIB].replace(/^\/\/.*$/gm, ''), /^import |require\(/m, `${label}: import-free`)
}
proveLib(loadLib(SOURCES[LIB]))

// ---------------------------------------------------------------- 2. the three components, rendered
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), className: props?.className })) })
const pick = props => Object.fromEntries(Object.entries(props ?? {}).filter(([key, value]) => typeof value !== 'function' && (/^(data-|aria-)/.test(key) || ['className', 'href', 'role', 'id', 'type', 'title'].includes(key))))
const part = name => ({ children, ...rest }) => React.createElement('div', { 'data-stub': name, ...pick(rest) }, children)
const UI = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : part(String(name)) })
const Button = ({ asChild, children, ...rest }) => asChild ? React.cloneElement(React.Children.only(children), pick(rest)) : React.createElement('button', pick(rest), children)
const Link = ({ href, children, ...rest }) => React.createElement('a', { href, ...pick(rest) }, children)
const envOf = (shell, value, topBar) => ({ ...(shell === undefined ? {} : { [SHELL]: shell }), ...(value === undefined ? {} : { [FLAG]: value }), ...(topBar === undefined ? {} : { NEXT_PUBLIC_STUDIO_TOP_BAR_V2: topBar }) })
const OFF_VALUES = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']
const OFF_COMBOS = [...OFF_VALUES.map(v => ['true', v]), ['false', 'true'], [undefined, 'true'], ['TRUE', 'true'], [undefined, undefined]]
const auth = { user: { id: 'owner-a', name: 'Ada', tier: 'pro' }, isLoading: false }
const CARD = n => ({ id: `deck-${n}`, title: `Deck ${n}`, description: `About ${n}`, createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z', slideCount: 5, status: 'completed', thumbnail: '/placeholder.svg', folder: 'general', tags: [], strawmanPreviewUrl: null, finalPresentationUrl: `https://layout.example.invalid/p/${n}`, currentStage: 6 })

// the Decks page
const pageModules = lib => ({
  'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide, 'next/link': { __esModule: true, default: Link }, 'next/navigation': { useRouter: () => ({ push() {} }) },
  '@/components/ui/button': { Button }, '@/hooks/use-auth': { useAuth: () => auth },
  '@/hooks/use-chat-sessions': { useChatSessions: () => ({ loadSessions: async () => null, deleteSession: async () => false }) },
  '@/hooks/use-session-cache': { sessionCacheKey: (o, s) => `${o}:${s}`, sessionMetadataCacheKey: (o, s) => `${o}:meta:${s}` }, '@/lib/last-builder-session': { lastBuilderSessionKey: o => `last:${o}` },
  '@/components/studio-intro-replay': { StudioIntroReplay: () => null }, '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} },
  '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: () => ({ status: 'empty' }) }, '@/lib/present-view-only': { viewOnlyIfEnabled: url => url },
  '@/lib/studio-deck-title': { studioDeckShownTitle: title => title, studioDeckTitleProps: () => ({}) }, '@/lib/studio-template-display-name': { studioTemplateDisplayName: name => name }, // PASS2D T: flag NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES is off here, so the stored title is drawn
  '@/lib/studio-deck-cards': { deckCardDescription: (title, description) => description, deckCardStatusLabel: deck => deck.status }, '@/lib/studio-create-word': lib,
  '@/lib/studio-deck-card-count': { studioDeckCardCountLabel: () => { throw new Error('flag off: not called') } }, // PASS2D R5: flag NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT is off here, so the label helper is never called
  '@/hooks/use-toast': { toast: () => { throw new Error('flag off: not called') } }, '@/lib/studio-duplicate-deck': { duplicateTargetFor: () => { throw new Error('flag off: not called') }, runDuplicateDeck: () => { throw new Error('flag off: not called') } }, // FRONTEND-2 Pass 3: flag NEXT_PUBLIC_STUDIO_DUPLICATE_DECK is off here, so neither is ever called
})
function renderPage(source, env, lib, overrides = {}) {
  const names = [...source.matchAll(/const \[(\w+),\s*\w+\]\s*=\s*useState/g)].map(match => match[1])
  let cursor = 0
  const state = { loadedOwner: 'owner-a', isLoadingSessions: false, ...overrides }
  const react = { useState(initial) { const name = names[cursor++]; return [name in state ? state[name] : typeof initial === 'function' ? initial() : initial, () => {}] }, useRef: initial => ({ current: initial }), useCallback: fn => fn, useEffect() {} }
  const table = pageModules(lib)
  const module = { exports: {} }
  vm.runInNewContext(compile(`${source}\nexport { DashboardForAccount };`, DASH), {
    module, exports: module.exports, process: { env }, Date, Set, Map, Array, encodeURIComponent,
    require: spec => { if (spec.endsWith('.css')) return {}; if (spec === 'react') return react; if (spec.startsWith('@/components/ui/')) return UI; if (!(spec in table)) throw new Error(`unexpected import ${spec}`); return table[spec] },
  })
  return renderToStaticMarkup(module.exports.DashboardForAccount(auth))
}
const PAGE_CASES = [['no cards', { presentations: [] }], ['two cards', { presentations: [CARD(1), CARD(2)] }], ['filtered to nothing', { presentations: [CARD(1)], searchQuery: 'zzz' }]]
const times = (text, word) => text.split(word).length - 1
function provePage(source, lib, label = 'page') {
  const basePage = baseSource(DASH)
  for (const [name, overrides] of PAGE_CASES) {
    const where = `${label}: ${name}`
    const offHtml = renderPage(source, envOf('true', undefined), lib, overrides)
    eq(times(offHtml, 'New Presentation'), 1, `${where}: the top button says New Presentation once`)
    eq(times(offHtml, 'Create Presentation'), overrides.presentations.length === 0 ? 2 : 0, `${where}: the empty state (both tabs) says Create Presentation only when there is nothing to show`)
    for (const [shell, value] of OFF_COMBOS) {
      const off = renderPage(source, envOf(shell, value), lib, overrides)
      eq(off, renderPage(source, envOf(shell, undefined), lib, overrides), `${where}: shell ${shell} flag ${JSON.stringify(value)} is the flag-less markup`)
      if (basePage) eq(off, renderPage(basePage, envOf(shell, value), lib, overrides), `${where}: shell ${shell} flag ${JSON.stringify(value)} is the base commit's markup`)
    }
    const on = renderPage(source, envOf('true', 'true'), lib, overrides)
    eq(times(on, 'New Presentation') + times(on, 'Create Presentation'), 0, `${where}: the old words are gone`)
    eq(times(on, `>${NEW_DECK}<`), times(offHtml, 'New Presentation') + times(offHtml, 'Create Presentation'), `${where}: each create button says New deck`)
    eq(on, offHtml.replaceAll('New Presentation', NEW_DECK).replaceAll('Create Presentation', NEW_DECK), `${where}: nothing but those words changes`)
  }
}
provePage(SOURCES[DASH], loadLib(SOURCES[LIB]))
if (!baseSource(DASH)) console.log(`  SKIP base-commit identity: ${BASE_COMMIT} is not in this clone`)

// the Sessions panel
function renderSidebar(source, env, lib) {
  const Sidebar = evaluate(source, SIDEBAR, {
    react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide,
    '@/hooks/use-chat-sessions': { useChatSessions: () => ({ loadSessions: async () => null, deleteSession: async () => false, loading: false }) },
    './session-list-item': { SessionListItem: part('SessionListItem') }, './ui/button': { Button }, './ui/input': { Input: part('Input') }, './ui/checkbox': { Checkbox: part('Checkbox') },
    './delete-confirm-modal': { DeleteConfirmModal: part('DeleteConfirmModal') }, '@/hooks/use-toast': { useToast: () => ({ toast() {} }) }, '@/hooks/use-auth': { useAuth: () => auth },
    '@/hooks/use-session-cache': { sessionCacheKey: (o, s) => `${o}:${s}`, sessionMetadataCacheKey: (o, s) => `${o}:meta:${s}` }, './ui/alert-dialog': UI, '@/lib/studio-create-word': lib,
  }, env).ChatHistorySidebar
  return renderToStaticMarkup(React.createElement(Sidebar, { isOpen: true, currentSessionId: 'x', onClose() {}, onSessionSelect() {}, onNewChat() {} }))
}
function proveSidebar(source, lib, label = 'sidebar') {
  const baseText = baseSource(SIDEBAR)
  const button = html => html.match(/<div data-studio-session-part="new"[^>]*>(<button[^>]*>.*?<\/button>)/)?.[1]
  const offHtml = renderSidebar(source, envOf('true', undefined), lib)
  match(button(offHtml), /<svg data-icon="Plus"[^>]*><\/svg>Presentation<\/button>$/, `${label}: the Sessions panel's button says Presentation`)
  for (const [shell, value] of OFF_COMBOS) {
    const off = renderSidebar(source, envOf(shell, value), lib)
    if (baseText) eq(off, renderSidebar(baseText, envOf(shell, value), lib), `${label}: shell ${shell} flag ${JSON.stringify(value)} is the base commit's markup`)
    if (shell !== 'true') match(button(off) ?? '', /^$|New Chat<\/button>$/, `${label}: outside the shell the button says New Chat`)
  }
  const on = renderSidebar(source, envOf('true', 'true'), lib)
  match(button(on), /<svg data-icon="Plus"[^>]*><\/svg>New deck<\/button>$/, `${label}: on, the button says New deck`)
  eq(on, offHtml.replace('Presentation</button>', 'New deck</button>'), `${label}: nothing but that word changes`)
  eq(times(offHtml, 'Presentation</button>'), 1, `${label}: the word appears once`)
  // outside the Studio shell the classic words stay, flag on or off
  eq(renderSidebar(source, envOf(undefined, 'true'), lib), renderSidebar(source, envOf(undefined, undefined), lib), `${label}: the flag is ignored outside the Studio shell`)
  match(renderSidebar(source, envOf(undefined, 'true'), lib), /New Chat<\/button>/, `${label}: classic keeps New Chat`)
}
proveSidebar(SOURCES[SIDEBAR], loadLib(SOURCES[LIB]))

// the top bar
function renderHeader(source, env, libSource) {
  const topBar = evaluate(read(TOP_BAR), TOP_BAR, {}, env)
  const Header = evaluate(source, HEADER, {
    react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide, 'next/link': { __esModule: true, default: Link }, 'next-themes': { useTheme: () => ({ resolvedTheme: 'light' }) },
    '@/components/ui/button': { Button }, '@/components/user-profile-menu': { UserProfileMenu: () => null }, '@/components/connection-error': { ConnectionError: () => null },
    '@/components/build-version-guard': { BuildFingerprintBadge: () => null, BuildVersionGuard: () => null }, '@/components/builder/deck-identity-dialog': { DeckIdentityDialog: () => null },
    '@/lib/deck-identity': { isDeckIdentityEnabled: () => false }, '@/lib/studio-session-hygiene': { STUDIO_SESSION_HYGIENE_ENABLED: false },
    '@/components/layout/studio-navigation-hint': { StudioNavigationHint: ({ children }) => children }, '@/lib/studio-top-bar-v2': topBar,
    '@/components/studio-template-workspace/entry': { StudioTemplateWorkspaceHeaderActions: () => null, StudioTemplateWorkspaceHeading: () => null }, '@/lib/studio-create-word': loadLib(libSource),
  }, env).BuilderHeader
  return renderToStaticMarkup(React.createElement(Header, { deckTitle: 'My deck', wsError: null, onOpenChatHistory() {}, onNewPresentation() {} }))
}
const createButton = html => html.match(/<button class="studio-shell-new"[^>]*>.*?<\/button>/)?.[0]
function proveHeader(source, libSource, label = 'header') {
  const baseText = baseSource(HEADER)
  for (const topBar of [undefined, 'true']) {
    const flagless = renderHeader(source, envOf('true', undefined, topBar), libSource)
    const want = topBar === 'true'
      ? ['New deck', 'New deck', 'New deck'] : ['Add presentation', 'Add presentation', 'Presentation']
    eq(createButton(flagless), `<button class="studio-shell-new" aria-label="${want[0]}" title="${want[1]}"><svg data-icon="Plus" class="h-4 w-4"></svg><span>${want[2]}</span></button>`, `${label}: top bar ${topBar ?? 'off'}, flag unset: the button is the base's`)
    for (const [shell, value] of OFF_COMBOS) {
      const off = renderHeader(source, envOf(shell, value, topBar), libSource)
      if (baseText) eq(off, renderHeader(baseText, envOf(shell, value, topBar), libSource), `${label}: top bar ${topBar ?? 'off'}, shell ${shell}, flag ${JSON.stringify(value)} is the base commit's markup`)
    }
    const on = renderHeader(source, envOf('true', 'true', topBar), libSource)
    eq(createButton(on), `<button class="studio-shell-new" aria-label="New deck" title="New deck"><svg data-icon="Plus" class="h-4 w-4"></svg><span>New deck</span></button>`, `${label}: top bar ${topBar ?? 'off'}, flag on: the button says New deck three times`)
    eq(on.replace(createButton(on), ''), flagless.replace(createButton(flagless), ''), `${label}: top bar ${topBar ?? 'off'}, flag on: nothing outside the button changes`)
    if (topBar === 'true') eq(on, flagless, `${label}: the top-bar flag already says New deck, so the whole markup is the same`)
  }
  // outside the Studio shell there is no create button to relabel
  eq(renderHeader(source, envOf(undefined, 'true'), libSource), renderHeader(source, envOf(undefined, undefined), libSource), `${label}: classic header ignores the flag`)
  eq(createButton(renderHeader(source, envOf(undefined, 'true'), libSource)), undefined, `${label}: classic header has no create button`)
}
proveHeader(SOURCES[HEADER], SOURCES[LIB])

// ---------------------------------------------------------------- 3. source level
const IMPORT_PAGE = 'import { studioCreateLabel } from "@/lib/studio-create-word"\n'
const IMPORT_SIDEBAR = "import { studioCreateLabel } from '@/lib/studio-create-word';\n"
const IMPORT_HEADER = 'import { studioCreateLabel } from "@/lib/studio-create-word"\n'
const CONST_PAGE = `  // PASS2B G56 (NEXT_PUBLIC_STUDIO_CREATE_WORD, default off, Studio shell only): the create buttons say "New deck", as the top bar does.
  const createWord = studioShell && process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === "true"
`
const CONST_SIDEBAR = `  // PASS2B G56 (NEXT_PUBLIC_STUDIO_CREATE_WORD, default off, Studio shell only): the create button says "New deck".
  const createWord = studio && process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === 'true';
`
const CONST_HEADER = `  // PASS2B G56 (NEXT_PUBLIC_STUDIO_CREATE_WORD, default off): with the top-bar flag off, the create button says "New deck" too.
  const studioCreateWord = studioShell && process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === "true"
`
// this batch's G53 lines on the Decks page, reverted too
const G53_CONST = `  // PASS2B G53 (NEXT_PUBLIC_STUDIO_DECK_GRID_4, default off, Studio shell only): four cards per row from the xl breakpoint (1280 px), as in the mockup.
  const deckGrid4 = studioShell && process.env.NEXT_PUBLIC_STUDIO_DECK_GRID_4 === "true"
`
const G53_EXPR = 'className={deckGrid4 ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}'
const revertPage = text => stripDeckTitle(text).replace(IMPORT_PAGE, '').replace(CONST_PAGE, '').replace(G53_CONST, '').replace(G53_EXPR, 'className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"')
  .replace('{studioCreateLabel(createWord, "New Presentation")}', 'New Presentation').replace('{studioCreateLabel(createWord, "Create Presentation")}', 'Create Presentation')
const revertSidebar = text => text.replace(IMPORT_SIDEBAR, '').replace(CONST_SIDEBAR, '').replace("studioCreateLabel(createWord, 'Presentation')", "'Presentation'")
const revertHeader = text => text.replace(IMPORT_HEADER, '').replace(CONST_HEADER, '').replaceAll('studioCreateLabel(studioCreateWord, "Add presentation")', '"Add presentation"').replace('studioCreateLabel(studioCreateWord, "Presentation")', '"Presentation"')
function proveSource(file, source, label = file) {
  const [importLine, constText, revert] = file === DASH ? [IMPORT_PAGE, CONST_PAGE, revertPage] : file === SIDEBAR ? [IMPORT_SIDEBAR, CONST_SIDEBAR, revertSidebar] : [IMPORT_HEADER, CONST_HEADER, revertHeader]
  eq(times(source, importLine), 1, `${label}: the helper is imported once`)
  eq(times(source, constText), 1, `${label}: the exact-flag, Studio-shell decision, once`)
  eq((source.match(/process\.env\.NEXT_PUBLIC_STUDIO_CREATE_WORD/g) ?? []).length, 1, `${label}: the flag is read once, inline`)
  const calls = [...source.matchAll(/studioCreateLabel\((\w+), (["'])([^"']*)\2\)/g)].map(m => [m[1], m[3]])
  const wanted = file === DASH ? [['createWord', 'New Presentation'], ['createWord', 'Create Presentation']] : file === SIDEBAR ? [['createWord', 'Presentation']] : [['studioCreateWord', 'Add presentation'], ['studioCreateWord', 'Add presentation'], ['studioCreateWord', 'Presentation']]
  assert.deepEqual(calls, wanted, `${label}: the helper's fallbacks are the base's own literals, in place`); checks++
  const baseText = baseSource(file)
  if (baseText) eq(revert(stripDeckCardCount(source)), baseText, `${label}: without the G56 lines the file is ${BASE_COMMIT}'s`)
  if (baseText) for (const [, literal] of wanted) ok(baseText.includes(literal), `${label}: "${literal}" is a literal of the base`)
}
for (const file of [DASH, SIDEBAR, HEADER]) proveSource(file, SOURCES[file])

// ---------------------------------------------------------------- 4. mutation check
const MUTANTS = [
  [LIB, 'word changed', "STUDIO_NEW_DECK_LABEL = 'New deck'", "STUDIO_NEW_DECK_LABEL = 'New Deck'"],
  [LIB, 'word is the mockup\'s', "STUDIO_NEW_DECK_LABEL = 'New deck'", "STUDIO_NEW_DECK_LABEL = 'Presentation'"],
  [LIB, 'flag read loosely', 'return unified === true ? STUDIO_NEW_DECK_LABEL : original', 'return unified ? STUDIO_NEW_DECK_LABEL : original'],
  [LIB, 'always new deck', 'return unified === true ? STUDIO_NEW_DECK_LABEL : original', 'return STUDIO_NEW_DECK_LABEL'],
  [LIB, 'never new deck', 'return unified === true ? STUDIO_NEW_DECK_LABEL : original', 'return original'],
  [LIB, 'inverted', 'return unified === true ? STUDIO_NEW_DECK_LABEL : original', 'return unified === true ? original : STUDIO_NEW_DECK_LABEL'],
  [DASH, 'flag read loosely', 'process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === "true"', 'process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD !== "false"'],
  [DASH, 'outside the Studio shell', 'const createWord = studioShell && process', 'const createWord = process'],
  [DASH, 'flag ignored', 'const createWord = studioShell && process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === "true"', 'const createWord = studioShell'],
  [DASH, 'top button not relabelled', '{studioCreateLabel(createWord, "New Presentation")}', 'New Presentation'],
  [DASH, 'empty-state button not relabelled', '{studioCreateLabel(createWord, "Create Presentation")}', 'Create Presentation'],
  [DASH, 'top fallback changed', 'studioCreateLabel(createWord, "New Presentation")', 'studioCreateLabel(createWord, "New presentation")'],
  [DASH, 'empty-state fallback changed', 'studioCreateLabel(createWord, "Create Presentation")', 'studioCreateLabel(createWord, "New Presentation")'],
  [DASH, 'flag ignored by the top button', 'studioCreateLabel(createWord, "New Presentation")', 'studioCreateLabel(true, "New Presentation")'],
  [DASH, 'flag ignored by the empty state', 'studioCreateLabel(createWord, "Create Presentation")', 'studioCreateLabel(false, "Create Presentation")'],
  [DASH, 'another button relabelled', '<X className="mr-2 h-4 w-4" />Clear search and filters', '<X className="mr-2 h-4 w-4" />Clear filters'],
  [DASH, 'route changed', '<Link href="/builder">\n            <Plus className="mr-2 h-4 w-4" />', '<Link href="/builder?new=1">\n            <Plus className="mr-2 h-4 w-4" />'],
  [SIDEBAR, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === 'true'", "process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD !== 'false'"],
  [SIDEBAR, 'outside the Studio shell', 'const createWord = studio && process', 'const createWord = process'],
  [SIDEBAR, 'flag ignored', "const createWord = studio && process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === 'true'", 'const createWord = studio'],
  [SIDEBAR, 'button not relabelled', "studioCreateLabel(createWord, 'Presentation')", "'Presentation'"],
  [SIDEBAR, 'classic word relabelled', ": 'New Chat'}", ": studioCreateLabel(createWord, 'New Chat')}"],
  [SIDEBAR, 'fallback changed', "studioCreateLabel(createWord, 'Presentation')", "studioCreateLabel(createWord, 'New presentation')"],
  [SIDEBAR, 'heading relabelled', "{studio ? 'Sessions' : 'Your decks'}", "{studio ? studioCreateLabel(createWord, 'Sessions') : 'Your decks'}"],
  [HEADER, 'flag read loosely', 'process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === "true"', 'process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD !== "false"'],
  [HEADER, 'outside the Studio shell', 'const studioCreateWord = studioShell && process', 'const studioCreateWord = process'],
  [HEADER, 'flag ignored', 'const studioCreateWord = studioShell && process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === "true"', 'const studioCreateWord = studioShell'],
  [HEADER, 'aria-label not relabelled', 'aria-label={studioTopBarV2 ? "New deck" : studioCreateLabel(studioCreateWord, "Add presentation")}', 'aria-label={studioTopBarV2 ? "New deck" : "Add presentation"}'],
  [HEADER, 'title not relabelled', 'title={studioTopBarV2 ? "New deck" : studioCreateLabel(studioCreateWord, "Add presentation")}', 'title={studioTopBarV2 ? "New deck" : "Add presentation"}'],
  [HEADER, 'text not relabelled', '<span>{studioTopBarV2 ? "New deck" : studioCreateLabel(studioCreateWord, "Presentation")}</span>', '<span>{studioTopBarV2 ? "New deck" : "Presentation"}</span>'],
  [HEADER, 'top-bar word changed', '<span>{studioTopBarV2 ? "New deck" : studioCreateLabel(studioCreateWord, "Presentation")}</span>', '<span>{studioTopBarV2 ? "New Deck" : studioCreateLabel(studioCreateWord, "Presentation")}</span>'],
  [HEADER, 'top-bar flag ignored', '<span>{studioTopBarV2 ? "New deck" : studioCreateLabel(studioCreateWord, "Presentation")}</span>', '<span>{studioCreateLabel(studioCreateWord, "Presentation")}</span>'],
  [HEADER, 'fallback changed', 'studioCreateLabel(studioCreateWord, "Presentation")}</span>', 'studioCreateLabel(studioCreateWord, "Create")}</span>'],
  [HEADER, 'sessions toggle relabelled', "label={isChatHistoryOpen ? \"Close sessions\" : \"Sessions\"}", "label={isChatHistoryOpen ? \"Close sessions\" : studioCreateLabel(studioCreateWord, \"Sessions\")}"],
]
let killed = 0
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === LIB) { const lib = loadLib(mutated); proveLib(lib, name); provePage(SOURCES[DASH], lib, name); proveSidebar(SOURCES[SIDEBAR], lib, name); proveHeader(SOURCES[HEADER], mutated, name) }
    if (file === DASH) { provePage(mutated, loadLib(SOURCES[LIB]), name); proveSource(DASH, mutated, name) }
    if (file === SIDEBAR) { proveSidebar(mutated, loadLib(SOURCES[LIB]), name); proveSource(SIDEBAR, mutated, name) }
    if (file === HEADER) { proveHeader(mutated, SOURCES[LIB], name); proveSource(HEADER, mutated, name) }
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

// ---------------------------------------------------------------- .env.example
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_CREATE_WORD="false"$/m, 'documented in .env.example, default off')

console.log(`Studio create word (G56): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
