// PASS2B G45 (FRONTEND-2): "<- Back to Studio" at the right of the Studio top bar on the library pages, as the accepted v4 mockup has it. Flag
// NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK (exact "true", Studio shell only), default off. It is the existing return button (components/layout/app-header.tsx
// BackToBuilderButton), so it keeps its "last builder session" behaviour; only its words are given.
//
// Run: node scripts/test-studio-library-back-link.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   LIBRARY_BACK_LINK_BASE=<commit> overrides the base commit the flag-off identity is checked against (default bb5a89f, the head this was built on).
//
// Proven on the REAL components/layout/app-header.tsx (stubbed leaves: icons, Next link / router, Button, profile menu, tooltip hint; the REAL
// lib/last-builder-session.ts and lib/studio-nav-labels.ts) and the real components/layout/studio-library-back.css:
//   1. the top bar is rendered over every route x every flag value x with and without the Studio shell: flag off (unset, empty, "false", near-misses, "true"
//      without the shell, and the account header) the markup is the base commit's, byte for byte; flag on, ONLY the library routes gain one wrapper after
//      the title, and removing it gives the off markup exactly; every other route (builder, settings, billing, sub-paths, trailing slash) is untouched;
//   2. the pages: exactly the routes the top bar titles by name, bar the "Account" fallback, and the Studio rail's six destinations;
//   3. the words are "Back to Studio" whether or not NEXT_PUBLIC_STUDIO_V4_LABELS is on, and the old uses of the button keep their words;
//   4. the click is the existing "last builder session" logic: /builder?session_id=<remembered id> when this browser remembers one for the account (by user id,
//      else email), else /builder; storage that throws, no user, and no storage fall back to /builder; nothing but one router.push happens;
//   5. wiring: only the header, its CSS, .env.example and this test changed; the CSS is scoped to the wrapper (inert without the flag); the pages' own
//      "Back to Studio" buttons are untouched;
//   6. mutation check: every mutant of the header and the CSS is killed by sections 1-5.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE_COMMIT = process.env.LIBRARY_BACK_LINK_BASE || 'bb5a89f'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const git = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
function baseSource(rel) {
  try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]); return git(['show', `${BASE_COMMIT}:${rel}`]) } catch { return null }
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count(assert.deepEqual)

const HEADER = 'components/layout/app-header.tsx'
const CSS = 'components/layout/studio-library-back.css'
const RAIL = 'components/layout/studio-rail.tsx'
const SOURCES = { [HEADER]: read(HEADER), [CSS]: read(CSS) }
const FLAG = 'NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const LABELS = 'NEXT_PUBLIC_STUDIO_V4_LABELS'

const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
function loadPure(rel) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(read(rel), rel))(module, module.exports, () => { throw new Error('unexpected import') }, { env: {} })
  return module.exports
}
const lastSession = loadPure('lib/last-builder-session.ts')
const navLabels = loadPure('lib/studio-nav-labels.ts')

// ---------------------------------------------------------------- the header, rendered
const env = {}
const pathname = { value: '/builder' }
const pushes = []
const auth = { user: { id: 'u-1', email: 'a@example.invalid' } }
const storage = { data: new Map(), throws: false, reads: [] }
const sandboxWindow = { localStorage: { getItem: key => { storage.reads.push(key); if (storage.throws) throw new Error('blocked'); return storage.data.has(key) ? storage.data.get(key) : null } } }
const windowRef = { value: sandboxWindow }
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), className: props?.className })) })
const hint = ({ enabled, label, children }) => enabled ? React.createElement('span', { 'data-hint': label }, children) : children
const stubs = {
  react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide,
  'next/link': { __esModule: true, default: ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children) },
  'next/navigation': { usePathname: () => pathname.value, useRouter: () => ({ push: target => pushes.push(target) }) },
  '@/components/user-profile-menu': { UserProfileMenu: () => React.createElement('span', { 'data-stub': 'profile' }) },
  '@/components/layout/studio-navigation-hint': { StudioNavigationHint: hint },
  '@/components/ui/button': { Button: 'button' }, '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') },
  '@/hooks/use-auth': { useAuth: () => auth }, '@/lib/last-builder-session': lastSession, '@/lib/studio-nav-labels': navLabels,
}
function loadHeader(source, fileName = HEADER) {
  const module = { exports: {} }
  const sandbox = { module, exports: module.exports, process: { env }, require: spec => { if (spec.endsWith('.css')) return {}; if (!(spec in stubs)) throw new Error(`unexpected import ${spec}`); return stubs[spec] } }
  Object.defineProperty(sandbox, 'window', { get: () => windowRef.value })
  vm.runInNewContext(compile(source, fileName), sandbox)
  return module.exports
}
const setEnv = (values = {}) => { for (const key of Object.keys(env)) delete env[key]; Object.assign(env, values) }
const renderBar = (exports, route, values) => { setEnv(values); pathname.value = route; return renderToStaticMarkup(React.createElement(exports.AppHeader)) }

const LIBRARY = ['/dashboard', '/knowledge', '/studio/templates', '/studio/themes', '/studio/intelligence', '/studio/details', '/profile']
const OTHER = ['/builder', '/builder/x', '/settings', '/settings/profile', '/billing', '/shortcuts', '/studio', '/studio/', '/dashboard/', '/knowledge/x', '/studio/templates/new', '/', '/pricing', '/Dashboard']
const OFF_VALUES = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']
const flagEnv = (shell, value, labels) => ({ ...(shell === undefined ? {} : { [SHELL]: shell }), ...(value === undefined ? {} : { [FLAG]: value }), ...(labels === undefined ? {} : { [LABELS]: labels }) })
const WRAPPER = /<div data-studio-library-back="true">.*?<\/button><\/div>/s
const baseHeaderSource = baseSource(HEADER)

function proveBar(source, label = 'real') {
  const exports = loadHeader(source)
  const Base = baseHeaderSource ? loadHeader(baseHeaderSource, HEADER) : null
  for (const route of [...LIBRARY, ...OTHER]) {
    for (const shell of ['true', undefined, 'false']) {
      for (const value of OFF_VALUES) {
        const off = renderBar(exports, route, flagEnv(shell, value))
        if (Base) eq(off, renderBar(Base, route, flagEnv(shell, undefined)), `${label}: shell ${shell}, flag ${JSON.stringify(value)} on ${route} is the base commit's markup`)
        nomatch(off, /data-studio-library-back/, `${label}: flag ${JSON.stringify(value)} draws no back link (${route})`)
      }
      // the flag on: the Studio shell, and only the library routes
      const barOff = renderBar(exports, route, flagEnv(shell, undefined)), barOn = renderBar(exports, route, flagEnv(shell, 'true'))
      if (shell === 'true' && LIBRARY.includes(route)) {
        eq((barOn.match(/data-studio-library-back="true"/g) ?? []).length, 1, `${label}: one wrapper on ${route}`)
        eq(barOn.replace(WRAPPER, ''), barOff, `${label}: nothing but the wrapper is added on ${route}`)
        const wrapper = barOn.match(WRAPPER)[0]
        match(wrapper, /<button[^>]* aria-label="Back to Studio"/, `${label}: the accessible name on ${route}`)
        match(wrapper, /data-studio-v4-account-return="true"/, `${label}: it is the existing return button (${route})`)
        match(wrapper, /<svg[^>]*data-icon="ArrowLeft"/, `${label}: the arrow (${route})`)
        match(wrapper, /<span class="hidden sm:inline">Back to Studio<\/span><\/button>/, `${label}: the words (${route})`)
        ok(barOn.endsWith(`</span>${wrapper}</div></header>`), `${label}: at the right of the title, inside the bar (${route})`)
        ok(barOn.startsWith('<header data-studio-v4-shell-header="true"><div class="flex h-full items-center"><span class="text-sm font-semibold">'), `${label}: the title is first (${route})`)
        // the words do not depend on the naming flag
        for (const labels of [undefined, 'true', 'false']) match(renderBar(exports, route, flagEnv('true', 'true', labels)), /<span class="hidden sm:inline">Back to Studio<\/span>/, `${label}: words with labels ${labels} (${route})`)
      } else {
        eq(barOn, barOff, `${label}: ${shell === 'true' ? 'a non-library route' : 'no Studio shell'} ignores the flag (${route}, shell ${shell})`)
      }
    }
  }
  return exports
}
const exportsReal = proveBar(SOURCES[HEADER])
if (!baseHeaderSource) console.log(`  SKIP base-commit header identity: ${BASE_COMMIT} is not in this clone`)

// ---------------------------------------------------------------- 2. the pages
function proveSource(source, label = 'real') {
  eq((source.match(/process\.env\.NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK/g) ?? []).length, 1, `${label}: the flag is read once, inline`)
  match(source, /process\.env\.NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK === "true" && STUDIO_LIBRARY_BACK_PATHS\.includes\(pathname\)/, `${label}: exact "true", and a listed path`)
  // the list is exactly the routes the top bar titles by name (everything but its "Account" fallback)
  const sf = ts.createSourceFile(HEADER, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let titled = null, list = null
  const walk = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === 'STUDIO_LIBRARY_BACK_PATHS') list = node.initializer.elements.map(e => e.text)
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === 'span' && /text-sm font-semibold/.test(node.openingElement.getText(sf))) {
      const found = new Set(); const grab = n => { if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isStringLiteral(n.right) && n.right.text.startsWith('/')) found.add(n.right.text); ts.forEachChild(n, grab) }
      grab(node); titled = [...found]
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
  ok(list && titled, `${label}: the path list and the top bar's titles are found`)
  deepEq([...list].sort(), [...titled].sort(), `${label}: the pages are exactly the routes the top bar titles by name`)
  deepEq([...list].sort(), [...LIBRARY].sort(), `${label}: the pages`)
  // ... and the Studio rail's destinations besides Studio itself
  const rail = read(RAIL)
  for (const href of ['/dashboard', '/knowledge', '/studio/templates', '/studio/themes', '/studio/intelligence', '/studio/details']) ok(rail.includes(`"${href}"`) || rail.includes(`'${href}'`), `${label}: the rail lists ${href}`)
  eq((source.match(/BackToBuilderButton label="Back to Studio"/g) ?? []).length, 1, `${label}: the top bar names the button itself, once`)
  match(source, /const returnLabel = label \?\? \(rail \? "Studio" : studioLabels \? "Back to Studio" : "Back to builder"\)/, `${label}: the old words are the fallback`)
  match(source, /import "\.\/studio-library-back\.css"/, `${label}: the CSS is imported`)
}
proveSource(SOURCES[HEADER])

// ---------------------------------------------------------------- 3 and 4. the words and the click
function elementsOf(node, predicate, found = []) {
  if (node === null || node === undefined || typeof node !== 'object') return found
  if (Array.isArray(node)) { node.forEach(child => elementsOf(child, predicate, found)); return found }
  if (node.props) { if (predicate(node)) found.push(node); elementsOf(node.props.children, predicate, found) }
  return found
}
function proveButton(exports, label = 'real') {
  const button = props => { setEnv(props.env ?? {}); const tree = exports.BackToBuilderButton(props.props); const buttons = elementsOf(tree, n => n.type === 'button'); eq(buttons.length, 1, `${label}: one button`); return buttons[0] }
  // the old uses keep their words
  eq(button({ env: {}, props: {} }).props['aria-label'], 'Back to builder', `${label}: plain account header, labels off`)
  eq(button({ env: { [LABELS]: 'true' }, props: {} }).props['aria-label'], 'Back to Studio', `${label}: labels on`)
  eq(button({ env: { [LABELS]: 'true' }, props: { rail: true } }).props['aria-label'], 'Studio', `${label}: the rail's Studio icon`)
  eq(button({ env: {}, props: { rail: true } }).props['aria-label'], 'Studio', `${label}: the rail's Studio icon, labels off`)
  eq(button({ env: {}, props: { label: 'Back to Studio' } }).props['aria-label'], 'Back to Studio', `${label}: the top bar names it itself, labels off`)
  eq(button({ env: { [LABELS]: 'true' }, props: { label: 'Back to Studio' } }).props['aria-label'], 'Back to Studio', `${label}: ... and with labels on`)
  eq(exports.BackToBuilderButton.length <= 1, true, `${label}: still one props argument`)
  // the click: the existing last-session logic, nothing else
  const click = (props = { label: 'Back to Studio' }, { user = auth.user, data = [], throws = false, noWindow = false } = {}) => {
    pushes.length = 0; storage.reads.length = 0; storage.data = new Map(data); storage.throws = throws
    windowRef.value = noWindow ? undefined : sandboxWindow
    const saved = auth.user; auth.user = user
    try { const target = button({ env: { [SHELL]: 'true' }, props }); try { target.props.onClick({ preventDefault() { assert.fail('the click must not need the event') } }) } catch (error) { if (error?.code === 'ERR_ASSERTION') throw error; assert.fail(`the click threw: ${error}`) } } finally { auth.user = saved; windowRef.value = sandboxWindow }
    return { pushes: [...pushes], reads: [...storage.reads] }
  }
  deepEq(click(undefined, { data: [[lastSession.lastBuilderSessionKey('u-1'), 'sess-9']] }), { pushes: ['/builder?session_id=sess-9'], reads: ['deckster:last_session_id:u-1'] }, `${label}: the remembered session`)
  deepEq(click(undefined, { data: [] }), { pushes: ['/builder'], reads: ['deckster:last_session_id:u-1'] }, `${label}: nothing remembered, a fresh builder`)
  deepEq(click(undefined, { data: [[lastSession.lastBuilderSessionKey('someone-else'), 'sess-1']] }).pushes, ['/builder'], `${label}: another account's session is not used`)
  deepEq(click(undefined, { user: { email: 'a@example.invalid' }, data: [[lastSession.lastBuilderSessionKey('a@example.invalid'), 'sess-e']] }).pushes, ['/builder?session_id=sess-e'], `${label}: by email when there is no id`)
  deepEq(click(undefined, { user: null, data: [[lastSession.lastBuilderSessionKey('u-1'), 'sess-9']] }), { pushes: ['/builder'], reads: [] }, `${label}: no user, a fresh builder, nothing read`)
  deepEq(click(undefined, { throws: true, data: [[lastSession.lastBuilderSessionKey('u-1'), 'sess-9']] }).pushes, ['/builder'], `${label}: storage that throws falls back`)
  deepEq(click(undefined, { noWindow: true }), { pushes: ['/builder'], reads: [] }, `${label}: no window, a fresh builder`)
  // the same click for the rail's icon (unchanged)
  deepEq(click({ rail: true }, { data: [[lastSession.lastBuilderSessionKey('u-1'), 'sess-9']] }).pushes, ['/builder?session_id=sess-9'], `${label}: the rail's Studio icon is the same logic`)
  // the key is the existing per-account key
  eq(lastSession.lastBuilderSessionKey('u-1'), 'deckster:last_session_id:u-1', `${label}: the per-account key`)
}
proveButton(exportsReal)

// ---------------------------------------------------------------- 5. wiring
function wiringChecks() {
  // what the commits since the base changed (committed history only: a test run elsewhere may rewrite tracked docs or leave untracked files in the tree)
  const changed = git(['diff', '--name-only', BASE_COMMIT, 'HEAD']).split('\n').filter(Boolean)
  const allowed = new Set(['.env.example', HEADER, CSS, 'scripts/test-studio-library-back-link.mjs'])
  // other batch commits on this branch (G21, with the pins it had to adjust) changed their own files; this change touches only these
  // + PASS2B J2-04 (NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS, also on this branch): its own files and the sibling pins it had to adjust; in the page and package.json
  // only its own lines (the page is checked below: without them it is the base's).
  const J2_04 = /add-slide-status|studio-add-slide-v2|test-studio-(toolbar-template-list|first-run-poster-hide|welcome-polish|panel-eyebrow)/
  const mine = changed.filter(file => !/rail-add-slide|slide-thumbnail-strip|presentation-viewer|test-stage-f-thumbnail-recovery/.test(file) && !J2_04.test(file) && file !== 'package.json' && file !== 'app/builder/page.tsx')
  for (const file of mine) ok(allowed.has(file), `${file} is not part of G45`)
  const basePage = baseSource('app/builder/page.tsx'), basePackage = baseSource('package.json')
  if (basePage !== null) eq(stripAddSlideStatus('app/builder/page.tsx', read('app/builder/page.tsx')), basePage, 'app/builder/page.tsx is not part of G45')
  if (basePackage !== null) eq(read('package.json').replace('    "test:studio-add-slide-status": "node scripts/test-studio-add-slide-status.mjs",\n', ''), basePackage, 'package.json is not part of G45')
  const css = SOURCES[CSS]
  const rules = css.split('\n').filter(line => /\{/.test(line) && !line.trim().startsWith('/*'))
  ok(rules.length >= 4, 'the rules exist')
  for (const line of rules) match(line, /^\[data-studio-v4-shell="true"\] \[data-studio-library-back="true"\]/, `a CSS rule outside the wrapper's scope: ${line}`)
  // the pages' own "Back to Studio" buttons stay where they are
  for (const rel of ['app/(app)/knowledge/page.tsx', 'components/studio-template-workspace/workspace.tsx', 'components/studio-template-workspace/header.tsx', 'components/studio-not-found.tsx']) {
    const base = baseSource(rel)
    if (base !== null) eq(read(rel), base, `${rel} is untouched`)
  }
  match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK="false"$/m, 'documented in .env.example, default off')
  // the layout and the rail still wire the same return button
  match(read('app/(app)/layout.tsx'), /<StudioRail studioEntry=\{<BackToBuilderButton rail \/>\} \/>/, 'the rail\'s Studio entry is the same button')
}
wiringChecks()

// ---------------------------------------------------------------- 6. mutation check
const MUTANTS = [
  [HEADER, 'flag read loosely', 'process.env.NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK === "true" &&', 'process.env.NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK !== "false" &&'],
  [HEADER, 'flag ignored', 'process.env.NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK === "true" &&', 'true &&'],
  [HEADER, 'flag read from another name', 'NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK === "true" &&', 'NEXT_PUBLIC_STUDIO_LIBRARY_BACK === "true" &&'],
  [HEADER, 'every route', 'STUDIO_LIBRARY_BACK_PATHS.includes(pathname) ?', 'true ?'],
  [HEADER, 'knowledge dropped', '"/dashboard", "/knowledge", "/studio/templates"', '"/dashboard", "/studio/templates"'],
  [HEADER, 'decks dropped', '["/dashboard", "/knowledge"', '["/knowledge"'],
  [HEADER, 'templates dropped', '"/studio/templates", "/studio/themes"', '"/studio/themes"'],
  [HEADER, 'themes dropped', '"/studio/themes", "/studio/intelligence"', '"/studio/intelligence"'],
  [HEADER, 'intelligence dropped', '"/studio/intelligence", "/studio/details"', '"/studio/details"'],
  [HEADER, 'details dropped', '"/studio/details", "/profile"]', '"/profile"]'],
  [HEADER, 'profile dropped', '"/studio/details", "/profile"]', '"/studio/details"]'],
  [HEADER, 'settings added', '"/studio/details", "/profile"]', '"/studio/details", "/profile", "/settings"]'],
  [HEADER, 'the builder added', '"/studio/details", "/profile"]', '"/studio/details", "/profile", "/builder"]'],
  [HEADER, 'prefix match', 'STUDIO_LIBRARY_BACK_PATHS.includes(pathname) ?', 'STUDIO_LIBRARY_BACK_PATHS.some(path => pathname.startsWith(path)) ?'],
  [HEADER, 'wrapper marker changed', 'data-studio-library-back="true"', 'data-studio-library-bar="true"'],
  [HEADER, 'back link outside the bar', '</span>{libraryBack}</div></header>', '</span></div>{libraryBack}</header>'],
  [HEADER, 'back link before the title', '<div className="flex h-full items-center"><span className="text-sm font-semibold">{pathname === "/dashboard"', '<div className="flex h-full items-center">{libraryBack}<span className="text-sm font-semibold">{pathname === "/dashboard"'],
  [HEADER, 'back link dropped', '</span>{libraryBack}</div></header>', '</span></div></header>'],
  [HEADER, 'rail variant', '<BackToBuilderButton label="Back to Studio" /></div>', '<BackToBuilderButton rail /></div>'],
  [HEADER, 'words not given', '<BackToBuilderButton label="Back to Studio" /></div>', '<BackToBuilderButton /></div>'],
  [HEADER, 'other words', '<BackToBuilderButton label="Back to Studio" /></div>', '<BackToBuilderButton label="Back to builder" /></div>'],
  [HEADER, 'label ignored', 'const returnLabel = label ?? (rail', 'const returnLabel = (rail'],
  [HEADER, 'label beats the rail', 'const returnLabel = label ?? (rail ? "Studio" : studioLabels ? "Back to Studio" : "Back to builder")', 'const returnLabel = rail ? "Studio" : label ?? (studioLabels ? "Back to Studio" : "Back to builder")'],
  [HEADER, 'old words changed', 'studioLabels ? "Back to Studio" : "Back to builder"', 'studioLabels ? "Back to Studio" : "Back to the builder"'],
  [HEADER, 'rail words changed', 'rail ? "Studio" : studioLabels', 'rail ? "Studios" : studioLabels'],
  [HEADER, 'the click navigates elsewhere', 'let target = "/builder"', 'let target = "/dashboard"'],
  [HEADER, 'the click ignores the remembered session', 'if (last) target = `/builder?session_id=${last}`', 'if (last) target = "/builder"'],
  [HEADER, 'the click reads the wrong key', 'window.localStorage.getItem(lastBuilderSessionKey(userId))', 'window.localStorage.getItem(lastBuilderSessionKey("x"))'],
  [HEADER, 'the click drops the email fallback', 'const userId = user?.id ?? user?.email', 'const userId = user?.id'],
  [HEADER, 'the click does not guard storage', '} catch {\n        // localStorage can throw', '} catch (error) { throw error\n        // localStorage can throw'],
  [HEADER, 'the css import is dropped', 'import "./studio-library-back.css"\n', ''],
  [HEADER, 'the arrow is dropped', '<ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{returnLabel}</span>', '<span className="hidden sm:inline">{returnLabel}</span>'],
  [HEADER, 'the account header gets it too', '    { href: "/dashboard", label: "Decks", icon: LayoutDashboard },', '    { href: "/dashboard", label: "Decks", icon: LayoutDashboard },\n    ...(process.env.NEXT_PUBLIC_STUDIO_LIBRARY_BACK_LINK === "true" ? [{ href: "/builder", label: "Back to Studio", icon: Layers }] : []),'],
  [CSS, 'the wrapper rule loses its scope', '[data-studio-v4-shell="true"] [data-studio-library-back="true"] { display: flex;', '[data-studio-library-back="true"] { display: flex;'],
  [CSS, 'a rule leaks to every return button', '[data-studio-v4-shell="true"] [data-studio-library-back="true"] [data-studio-v4-account-return]:hover {', '[data-studio-v4-shell="true"] [data-studio-v4-account-return]:hover {'],
]
let killed = 0
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.equal(source.split(from).length - 1, 1, `mutant "${name}": the text it replaces exists once in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === HEADER) {
      const exports = proveBar(mutated, name)
      proveSource(mutated, name)
      proveButton(exports, name)
    } else {
      const rules = mutated.split('\n').filter(line => /\{/.test(line) && !line.trim().startsWith('/*'))
      for (const line of rules) assert.match(line, /^\[data-studio-v4-shell="true"\] \[data-studio-library-back="true"\]/, `a CSS rule outside the wrapper's scope: ${line}`)
    }
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length, 'every mutant is killed')

console.log(`Studio library back link: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
