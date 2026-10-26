// PASS2B G53 (FRONTEND-2): four deck cards per row on the Decks page from 1280 px. Flag NEXT_PUBLIC_STUDIO_DECK_GRID_4 (exact "true", Studio shell only),
// default off.
//
// Run: node scripts/test-studio-deck-grid-4.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   DECK_GRID_4_BASE=<commit> overrides the base commit the flag-off identity is checked against (default e9503ae).
//
// Proven on the REAL app/(app)/dashboard/page.tsx (the account Decks page, rendered with stubbed hooks and UI leaves), components/builder/studio-decks.css and
// tailwind.config.ts:
//   1. the page is rendered over flag x shell x view x cards: flag off (unset, "", "false", near-misses, or "true" without the Studio shell) every markup is the
//      base commit's byte for byte and the grid's class attribute is exactly the base's; on, the class is the base's plus " xl:grid-cols-4" before gap-6 and
//      nothing else in the page changes (grid and list view, with and without cards, both tabs);
//   2. source level: with the constant and the one className expression reverted the file is the base commit's (the page also carries this batch's G56 words,
//      reverted too so one flag is proved at a time); the flag is read once, inline, exact "true", Studio shell only; the Tailwind utility is a literal in the
//      source and tailwind.config.ts scans app/**;
//   3. list view: studio-decks.css is the base commit's and keeps its one-column rule, more specific than a utility, so the list stays one column;
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
const postcss = nodeRequire('postcss')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE_COMMIT = process.env.DECK_GRID_4_BASE || 'e9503ae'
const { stripLaterChanges } = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (DUPLICATE-ADOPT): every registered later change's lines come out first, innermost, as the newer pins read (stripping one twice changes nothing)
const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // DECK-CARD-THUMBNAIL: its lines out first // LATER-CHANGES: registry read (DUPLICATE-ADOPT)
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

const DASH = 'app/(app)/dashboard/page.tsx'
const CSS = 'components/builder/studio-decks.css'
const TAILWIND = 'tailwind.config.ts'
const CREATE_WORD_LIB = 'lib/studio-create-word.ts'
const SOURCES = { [DASH]: read(DASH), [CSS]: read(CSS), [TAILWIND]: read(TAILWIND) }
const FLAG = 'NEXT_PUBLIC_STUDIO_DECK_GRID_4'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const BASE_GRID = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
const WIDE_GRID = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
const compiled = new Map()
const compile = (source, fileName) => {
  const key = `${fileName}\u0000${source}`
  if (!compiled.has(key)) compiled.set(key, ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compiled.get(key)
}
const createWordLib = (() => { const module = { exports: {} }; new Function('module', 'exports', compile(read(CREATE_WORD_LIB), CREATE_WORD_LIB))(module, module.exports); return module.exports })()

// ---------------------------------------------------------------- 1. the page, rendered
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), className: props?.className })) })
const pick = props => Object.fromEntries(Object.entries(props ?? {}).filter(([key]) => /^(data-|aria-)/.test(key) || ['className', 'href', 'role', 'id', 'type'].includes(key)))
const part = name => ({ children, ...rest }) => React.createElement('div', { 'data-stub': name, ...pick(rest) }, children)
const UI = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : part(String(name)) })
const Button = ({ asChild, children, ...rest }) => asChild ? React.cloneElement(React.Children.only(children), pick(rest)) : React.createElement('button', pick(rest), children)
const Link = ({ href, children, ...rest }) => React.createElement('a', { href, ...pick(rest) }, children)
const auth = { user: { id: 'owner-a', name: 'Ada', tier: 'pro' }, isLoading: false }
const CARD = n => ({ id: `deck-${n}`, title: `Deck ${n}`, description: `About ${n}`, createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z', slideCount: 5, status: 'completed', thumbnail: '/placeholder.svg', folder: 'general', tags: [], strawmanPreviewUrl: null, finalPresentationUrl: `https://layout.example.invalid/p/${n}`, currentStage: 6 })
const modules = {
  'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide, 'next/link': { __esModule: true, default: Link }, 'next/navigation': { useRouter: () => ({ push() {} }) },
  '@/components/ui/button': { Button }, '@/hooks/use-auth': { useAuth: () => auth },
  '@/hooks/use-chat-sessions': { useChatSessions: () => ({ loadSessions: async () => null, deleteSession: async () => false }) },
  '@/hooks/use-session-cache': { sessionCacheKey: (o, s) => `${o}:${s}`, sessionMetadataCacheKey: (o, s) => `${o}:meta:${s}` }, '@/lib/last-builder-session': { lastBuilderSessionKey: o => `last:${o}` },
  '@/components/studio-intro-replay': { StudioIntroReplay: () => null }, '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} },
  '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: () => ({ status: 'empty' }) }, '@/lib/present-view-only': { viewOnlyIfEnabled: url => url },
  '@/lib/studio-deck-title': { studioDeckShownTitle: title => title, studioDeckTitleProps: () => ({}) }, '@/lib/studio-template-display-name': { studioTemplateDisplayName: name => name }, // PASS2D T: flag NEXT_PUBLIC_STUDIO_DECK_TITLE_NAMES is off here, so the stored title is drawn
  '@/lib/studio-deck-cards': { deckCardDescription: (title, description) => description, deckCardStatusLabel: deck => deck.status }, '@/lib/studio-create-word': createWordLib,
  '@/lib/studio-deck-card-count': { studioDeckCardCountLabel: () => { throw new Error('flag off: not called') } }, // PASS2D R5: flag NEXT_PUBLIC_STUDIO_DECK_CARD_SLIDE_COUNT is off here, so the label helper is never called
  '@/hooks/use-toast': { toast: () => { throw new Error('flag off: not called') } }, '@/lib/studio-duplicate-deck': { duplicateTargetFor: () => { throw new Error('flag off: not called') }, runDuplicateDeck: () => { throw new Error('flag off: not called') } }, // FRONTEND-2 Pass 3: flag NEXT_PUBLIC_STUDIO_DUPLICATE_DECK is off here, so neither is ever called
}
function renderPage(source, env, overrides = {}) {
  const names = [...source.matchAll(/const \[(\w+),\s*\w+\]\s*=\s*useState/g)].map(match => match[1])
  let cursor = 0
  const state = { loadedOwner: 'owner-a', isLoadingSessions: false, ...overrides }
  const react = {
    useState(initial) { const name = names[cursor++]; return [name in state ? state[name] : typeof initial === 'function' ? initial() : initial, () => {}] },
    useRef: initial => ({ current: initial }), useCallback: fn => fn, useEffect() {},
  }
  const module = { exports: {} }
  vm.runInNewContext(compile(`${source}\nexport { DashboardForAccount };`, DASH), {
    module, exports: module.exports, process: { env }, Date, Set, Map, Array, encodeURIComponent,
    require: spec => { if (spec.endsWith('.css')) return {}; if (spec === 'react') return react; if (spec.startsWith('@/components/ui/')) return UI; if (!(spec in modules)) throw new Error(`unexpected import ${spec}`); return modules[spec] },
  })
  return renderToStaticMarkup(module.exports.DashboardForAccount(auth))
}
const envOf = (shell, value) => ({ ...(shell === undefined ? {} : { [SHELL]: shell }), ...(value === undefined ? {} : { [FLAG]: value }) })
const OFF_VALUES = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']
const CASES = [
  ['no cards', { presentations: [] }], ['two cards', { presentations: [CARD(1), CARD(2)] }], ['list view, two cards', { presentations: [CARD(1), CARD(2)], view: 'list' }],
  ['list view, no cards', { presentations: [], view: 'list' }], ['filtered to nothing', { presentations: [CARD(1)], searchQuery: 'zzz' }],
]
const grids = html => [...html.matchAll(/<div data-studio-deck-grid="true" data-studio-deck-view="(grid|list)" class="([^"]*)">/g)].map(m => ({ view: m[1], className: m[2] }))
function provePage(source, label = 'page') {
  const basePage = baseSource(DASH)
  for (const [name, overrides] of CASES) {
    const where = `${label}: ${name}`
    for (const [shell, value] of [...OFF_VALUES.map(v => ['true', v]), ['false', 'true'], [undefined, 'true'], ['TRUE', 'true'], [undefined, undefined]]) {
      const off = renderPage(source, envOf(shell, value), overrides), seen = grids(off)
      eq(seen.length, 2, `${where}: one grid per tab`)
      for (const grid of seen) eq(grid.className, BASE_GRID, `${where}: shell ${shell} flag ${JSON.stringify(value)} keeps the base's class`)
      if (basePage) eq(off, renderPage(basePage, envOf(shell, value), overrides), `${where}: shell ${shell} flag ${JSON.stringify(value)} is the base commit's markup`)
    }
    const on = renderPage(source, envOf('true', 'true'), overrides), seen = grids(on)
    eq(seen.length, 2, `${where}: one grid per tab when on`)
    for (const grid of seen) { eq(grid.className, WIDE_GRID, `${where}: on adds xl:grid-cols-4 before gap-6`); eq(grid.view, overrides.view ?? 'grid', `${where}: the view attribute is kept`) }
    eq(on.replaceAll(WIDE_GRID, BASE_GRID), renderPage(source, envOf('true', undefined), overrides), `${where}: nothing but the class changes`)
    for (const keep of ['grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'gap-6']) ok(seen[0].className.split(' ').includes(keep), `${where}: ${keep} is kept`)
    eq(seen[0].className.split(' ').filter(c => c.startsWith('xl:')).join(), 'xl:grid-cols-4', `${where}: exactly one xl utility`)
  }
}
provePage(SOURCES[DASH])
if (!baseSource(DASH)) console.log(`  SKIP base-commit page identity: ${BASE_COMMIT} is not in this clone`)

// ---------------------------------------------------------------- 2. source level
const CONST = `  // PASS2B G53 (NEXT_PUBLIC_STUDIO_DECK_GRID_4, default off, Studio shell only): four cards per row from the xl breakpoint (1280 px), as in the mockup.
  const deckGrid4 = studioShell && process.env.NEXT_PUBLIC_STUDIO_DECK_GRID_4 === "true"
`
const EXPR = `className={deckGrid4 ? "${WIDE_GRID}" : "${BASE_GRID}"}`
const PLAIN = `className="${BASE_GRID}"`
// this batch's G56 lines, reverted too so the file can be compared with the base
const G56_IMPORT = 'import { studioCreateLabel } from "@/lib/studio-create-word"\n'
const G56_CONST = `  // PASS2B G56 (NEXT_PUBLIC_STUDIO_CREATE_WORD, default off, Studio shell only): the create buttons say "New deck", as the top bar does.
  const createWord = studioShell && process.env.NEXT_PUBLIC_STUDIO_CREATE_WORD === "true"
`
const revertG56 = text => stripDeckTitle(text).replace(G56_IMPORT, '').replace(G56_CONST, '').replace('{studioCreateLabel(createWord, "New Presentation")}', 'New Presentation').replace('{studioCreateLabel(createWord, "Create Presentation")}', 'Create Presentation')
function proveSource(source, tailwind, label = 'source') {
  eq(source.split(CONST).length - 1, 1, `${label}: the exact-flag, Studio-shell decision, once`)
  eq(source.split(EXPR).length - 1, 1, `${label}: the one className expression, once`)
  eq((source.match(/process\.env\.NEXT_PUBLIC_STUDIO_DECK_GRID_4/g) ?? []).length, 1, `${label}: the flag is read once, inline`)
  eq((source.match(/xl:grid-cols-4/g) ?? []).length, 1, `${label}: the Tailwind utility is a literal in the source (the JIT scan sees it)`)
  eq((source.match(/data-studio-deck-grid="true"/g) ?? []).length, 1, `${label}: it is the deck grid's class`)
  match(source, new RegExp(`<div data-studio-deck-grid="true" data-studio-deck-view=\\{view\\} ${EXPR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>`), `${label}: on the grid div`)
  const basePage = baseSource(DASH)
  if (basePage) eq(revertG56(stripDeckCardCount(source).replace(CONST, '').replace(EXPR, PLAIN)), basePage, `${label}: without the G53 text the page is ${BASE_COMMIT}'s`)
  if (basePage) eq(basePage.split(`<div data-studio-deck-grid="true" data-studio-deck-view={view} ${PLAIN}>`).length - 1, 1, `${label}: the base's grid is the plain class`)
  // the config scans the page
  const content = tailwind.match(/content:\s*\[([\s\S]*?)\]/)?.[1] ?? ''
  match(content, /"\.\/app\/\*\*\/\*\.\{[^}]*tsx[^}]*\}"/, `${label}: tailwind.config.ts content covers app/** (.tsx)`)
}
proveSource(SOURCES[DASH], SOURCES[TAILWIND])

// ---------------------------------------------------------------- 3. the list view
const LIST_RULE = '[data-studio-v4-shell="true"] [data-studio-deck-grid][data-studio-deck-view="list"] { grid-template-columns: minmax(0,1fr); gap: 12px; }'
const specificity = selector => (selector.match(/\[[^\]]*\]|\.[\w-]+|:[\w-]+/g) ?? []).length
function proveList(css, label = 'css') {
  const baseCss = baseSource(CSS)
  if (baseCss) eq(css, baseCss, `${label}: studio-decks.css is the base commit's`)
  eq(css.split(LIST_RULE).length - 1, 1, `${label}: the list view's one-column rule is there, once`)
  let found = null
  postcss.parse(css).walkRules(rule => { if (rule.selector.replace(/\s+/g, ' ') === '[data-studio-v4-shell="true"] [data-studio-deck-grid][data-studio-deck-view="list"]') found = rule })
  ok(found, `${label}: parsed`)
  eq(found.nodes.find(node => node.prop === 'grid-template-columns')?.value, 'minmax(0,1fr)', `${label}: one column`)
  ok(specificity(found.selector) > specificity('.xl\\:grid-cols-4'), `${label}: more specific than the Tailwind utility (a class), so it wins at xl too`)
  ok(!/@media[^{]*\{[^}]*\[data-studio-deck-view="list"\][^}]*grid-template-columns:\s*repeat/.test(css), `${label}: no wider list rule`)
}
proveList(SOURCES[CSS])

// ---------------------------------------------------------------- 4. mutation check
const MUTANTS = [
  [DASH, 'flag read loosely', 'process.env.NEXT_PUBLIC_STUDIO_DECK_GRID_4 === "true"', 'process.env.NEXT_PUBLIC_STUDIO_DECK_GRID_4 !== "false"'],
  [DASH, 'outside the Studio shell', 'const deckGrid4 = studioShell && process', 'const deckGrid4 = process'],
  [DASH, 'flag ignored', 'const deckGrid4 = studioShell && process.env.NEXT_PUBLIC_STUDIO_DECK_GRID_4 === "true"', 'const deckGrid4 = studioShell'],
  [DASH, 'always wide', 'className={deckGrid4 ?', 'className={true ?'],
  [DASH, 'never wide', 'className={deckGrid4 ?', 'className={false ?'],
  [DASH, 'inverted', 'className={deckGrid4 ?', 'className={!deckGrid4 ?'],
  [DASH, 'wrong breakpoint', 'lg:grid-cols-3 xl:grid-cols-4 gap-6', 'lg:grid-cols-3 2xl:grid-cols-4 gap-6'],
  [DASH, 'wrong column count', 'xl:grid-cols-4', 'xl:grid-cols-5'],
  [DASH, 'utility built at runtime', '"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"', '"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-" + 4 + " gap-6"'],
  [DASH, 'utility last', 'lg:grid-cols-3 xl:grid-cols-4 gap-6"', 'lg:grid-cols-3 gap-6 xl:grid-cols-4"'],
  [DASH, 'md dropped when wide', 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', 'grid-cols-1 lg:grid-cols-3 xl:grid-cols-4'],
  [DASH, 'lg dropped when wide', 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', 'md:grid-cols-2 xl:grid-cols-4'],
  [DASH, 'base class changed', ': "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}', ': "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"}'],
  [DASH, 'base class loses a breakpoint', ': "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}', ': "grid grid-cols-1 lg:grid-cols-3 gap-6"}'],
  [DASH, 'gap changed', 'xl:grid-cols-4 gap-6"', 'xl:grid-cols-4 gap-4"'],
  [DASH, 'view attribute dropped', 'data-studio-deck-view={view} className={deckGrid4', 'className={deckGrid4'],
  [DASH, 'view attribute fixed', 'data-studio-deck-view={view} className={deckGrid4', 'data-studio-deck-view="grid" className={deckGrid4'],
  [DASH, 'another class changed', 'className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground"', 'className="flex items-center justify-center gap-4 py-12 text-sm text-muted-foreground"'],
  [CSS, 'list rule dropped', LIST_RULE, ''],
  [CSS, 'list rule widened', 'grid-template-columns: minmax(0,1fr); gap: 12px; }', 'grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }'],
  [CSS, 'list rule applies to the grid view', '[data-studio-deck-grid][data-studio-deck-view="list"] { grid-template-columns', '[data-studio-deck-grid] { grid-template-columns'],
  [TAILWIND, 'app not scanned', '    "./app/**/*.{js,ts,jsx,tsx,mdx}",\n', ''],
  [TAILWIND, 'tsx not scanned', '"./app/**/*.{js,ts,jsx,tsx,mdx}"', '"./app/**/*.{js,ts,jsx,mdx}"'],
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
    if (file === DASH) { provePage(mutated, name); proveSource(mutated, SOURCES[TAILWIND], name) }
    if (file === CSS) proveList(mutated, name)
    if (file === TAILWIND) proveSource(SOURCES[DASH], mutated, name)
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

// ---------------------------------------------------------------- .env.example
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_DECK_GRID_4="false"$/m, 'documented in .env.example, default off')

console.log(`Studio deck grid 4 (G53): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
