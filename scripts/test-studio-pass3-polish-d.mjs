// FRONTEND-2 (PROGRAM-1 Saturday evening push, 24 Oct: the Pass 3 polish set, PR D, accessibility, stacked on PR C on PR B on PR A): proof for the flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time; the SAME flag as the others).
// PR D holds two findings of the accessibility facts pass (scenes/facts-a11y, the run of 01:05Z): (b) the Decks tab list (data-studio-deck-tabs) has no accessible name: components/ui/tabs.tsx gives it aria-label "Deck views";
// (d) /builder has no main landmark and no h1: its workspace container gets role="main" (an effect, because it is one long base line and several older pins keep every base line as it is) and a visually hidden sr-only h1 says "Builder"
// or "Builder: <deck title>". The facts' item (a), the session-history panel, needs nothing: components/chat-history-sidebar.tsx already sets inert with aria-hidden while the panel is closed (guarded below).
// Run: node scripts/test-studio-pass3-polish-d.mjs   (plain node: TypeScript transpiled and run in a vm, the REAL components/ui/tabs.tsx over the real Radix tabs rendered with react-dom/server, `git show` reads the base commit; no network, no browser, no model call)
//
//   1. lib        the flag is PR A's constant (exact "true", and only with the Studio shell); the words, exactly; deckTabsLabel, builderHeading and the main-landmark effect
//   2. pin        components/ui/tabs.tsx and the Builder page without this change's marked lines (marker PASS3-POLISH-D, a whole token) are BASE_COMMIT's files byte for byte, also through the registry; the marked lines are exactly the ones listed
//                 here, each in its place (no base line changes, no attribute is added to a base line); the page has no other h1, main or role="main"
//   3. tabs       the REAL TabsList over the real Radix: flag off (nine states) and the base file render the same HTML for six prop sets; flag on adds aria-label="Deck views" to the Decks list and nothing else, never replaces a name the
//                 page gives, never labels another list
//   4. builder    the REAL h1 line of the page runs: flag off nothing, flag on <h1 class="sr-only">Builder</h1> or "Builder: <title>"; the REAL effect: flag off it never reads the ref, flag on it sets role="main" once, keeps a role the node has
//   5. panel      (the facts' item a) the session-history panel sets inert together with aria-hidden: nothing to do, and nothing here changes it
//   6. change     the strip (one rule, whole-token marker), the registry (two lines, after PR C's), PR B's proof (one registry-read edit), scope (the COMMITTED diff only), no secret
//   7. mutants    each one must make sections 1-6 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  BASE_COMMIT, PASS3_POLISH_D_BUILDER, PASS3_POLISH_D_FILES, PASS3_POLISH_D_MARKER_RE, PASS3_POLISH_D_OWN_EDITS, PASS3_POLISH_D_SCOPE_FILES, PASS3_POLISH_D_TABS, stripPass3PolishD,
} from './studio-pass3-polish-d-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE = process.env.PASS3_POLISH_D_BASE || BASE_COMMIT
const B_HEAD = '85b1e8a6f1fd2ae3f0bf1954c417bea7aca45935' // PR B's pushed head: PR D's edit of PR B's proof is measured against it
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
// This change's OWN committed files: the files of the non-merge commits in BASE..HEAD whose subject is this change's ("Pass 3 polish set, PR D: ..."), wherever they sit in the history. The working tree is never consulted.
const ownCommitted = () => {
  const files = new Set()
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [subject, ...names] = block.split('\n')
    if (/^Pass 3 polish set, PR D:/.test(subject)) for (const name of names) if (name) files.add(name)
  }
  return [...files]
}
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
let overrides = {} // in-memory mutations: every proof reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const marked = line => PASS3_POLISH_D_MARKER_RE.test(line) // this change's marker, as a WHOLE token
// What this change's own checks read: the file with every OTHER registered change's lines out (innermost, as every older pin reads it) and THIS change's own left in.
const withoutOthers = (rel, text) => {
  const si = LATER_STRIPS.indexOf(stripPass3PolishD)
  const mine = si >= 0 ? LATER_STRIPS.splice(si, 1)[0] : null
  try { return stripLaterChanges(rel, text) } finally { if (mine) LATER_STRIPS.splice(si, 0, mine) }
}

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), deep = count(assert.deepEqual), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), throws = count(assert.throws)

const TABS = PASS3_POLISH_D_TABS, PAGE = PASS3_POLISH_D_BUILDER, LIB = 'lib/studio-pass3-polish-d.ts', FLAG_LIB = 'lib/studio-pass3-polish.ts', SIDEBAR = 'components/chat-history-sidebar.tsx'
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-pass3-polish-d-strip.mjs', THIS_TEST = 'scripts/test-studio-pass3-polish-d.mjs', B_PROOF = 'scripts/test-studio-pass3-polish-b.mjs'
const FLAG = 'NEXT_PUBLIC_STUDIO_PASS3_POLISH', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const ON = { [FLAG]: 'true', [SHELL]: 'true' }
const OFF_STATES = [{}, { [FLAG]: 'true' }, { [SHELL]: 'true' }, { [FLAG]: 'false', [SHELL]: 'true' }, { [FLAG]: 'TRUE', [SHELL]: 'true' }, { [FLAG]: '1', [SHELL]: 'true' }, { [FLAG]: '', [SHELL]: 'true' }, { [FLAG]: ' true', [SHELL]: 'true' }, { [FLAG]: 'true', [SHELL]: 'false' }]
const WORDS = { label: 'Deck views', heading: 'Builder' }

// ---------------------------------------------------------------- loading: the real TypeScript in a vm
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
/** A world: the environment its modules see as process.env, optional texts instead of the working tree's (the base file), optional stand-ins for react. */
function world(env, { texts = {}, react = null } = {}) {
  const registry = new Map()
  const textOf = rel => (rel in texts ? texts[rel] : read(rel))
  const exists = rel => rel in texts || rel in overrides || fs.existsSync(path.join(root, rel))
  function load(rel) {
    if (registry.has(rel)) return registry.get(rel).exports
    const module = { exports: {} }; registry.set(rel, module)
    const resolve = spec => { const base = spec.slice(2); for (const ext of ['.ts', '.tsx']) if (exists(base + ext)) return base + ext; throw new Error(`unresolved ${spec} from ${rel}`) }
    const req = spec => (spec === 'react' && react ? react : spec.startsWith('@/') ? load(resolve(spec)) : nodeRequire(spec))
    vm.runInThisContext(`(function(exports, require, module, __filename, process){${compile(rel, textOf(rel))}\n})`, { filename: rel })(module.exports, req, module, rel, { env: { ...env } })
    return module.exports
  }
  return { load }
}
/** The h1 line of the real page, run: a function of (flag, heading function, slideStructure) to the markup it renders inside a div. */
function h1Renderer(line) {
  const out = ts.transpileModule(`module.exports = (STUDIO_PASS3_POLISH_D_ENABLED, builderHeading, slideStructure) => (<div>\n${line}\n</div>)`, { fileName: 'h1.tsx', compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  vm.runInThisContext(`(function(exports, module, require){${out}\n})`, { filename: 'h1.tsx' })(module.exports, module, spec => nodeRequire(spec))
  return module.exports
}

// ---------------------------------------------------------------- 1. lib
function proveLib(libText, flagLibText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  match(flagLibText, /export const STUDIO_PASS3_POLISH_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'/, a('PR A\'s constant is exact "true" and needs the Studio shell'))
  match(libText, /import \{ STUDIO_PASS3_POLISH_ENABLED \} from '@\/lib\/studio-pass3-polish'/, a('this change\'s flag is PR A\'s constant'))
  match(libText, /export const STUDIO_PASS3_POLISH_D_ENABLED = STUDIO_PASS3_POLISH_ENABLED\n/, a('and nothing else (no flag of its own)'))
  nomatch(libText.replace(/\/\/.*$/gm, ''), /process\.env/, a('the lib reads no environment itself'))
  for (const env of [ON, ...OFF_STATES]) {
    const on = env === ON
    const w = world(env), lib = w.load(LIB)
    eq(lib.STUDIO_PASS3_POLISH_D_ENABLED, on, a(`the flag in ${JSON.stringify(env)} is ${on}`))
    eq(lib.DECK_VIEWS_LABEL, WORDS.label, a('the tab list is called "Deck views"'))
    eq(lib.BUILDER_HEADING, WORDS.heading, a('the h1 says "Builder"'))
    // deckTabsLabel: the Decks list gets the name, nothing else does
    deep(lib.deckTabsLabel({ 'data-studio-deck-tabs': 'true' }), on ? { 'aria-label': WORDS.label } : {}, a('the Decks list: the name on, nothing off'))
    deep(lib.deckTabsLabel({ 'data-studio-deck-tabs': true }), on ? { 'aria-label': WORDS.label } : {}, a('the attribute as a boolean true counts too'))
    for (const props of [{}, { className: 'x' }, { 'data-studio-deck-tabs': 'false' }, { 'data-studio-deck-tabs': 'true', 'aria-label': 'Mine' }, { 'data-studio-deck-tabs': 'true', 'aria-labelledby': 'heading' }, { 'data-other': 'true' }])
      deep(lib.deckTabsLabel(props), {}, a(`${JSON.stringify(props)}: no name added`))
    deep(lib.deckTabsLabel({}), {}, a('an empty prop set'))
    // builderHeading: pure, flag independent
    eq(lib.builderHeading(undefined), 'Builder', a('no title: Builder'))
    eq(lib.builderHeading(null), 'Builder', a('null: Builder'))
    eq(lib.builderHeading(''), 'Builder', a('empty: Builder'))
    eq(lib.builderHeading('   '), 'Builder', a('blank: Builder'))
    eq(lib.builderHeading(42), 'Builder', a('not a string: Builder'))
    eq(lib.builderHeading('Q4 review'), 'Builder: Q4 review', a('a title: Builder: <title>'))
    eq(lib.builderHeading('  Q4 \n  review  '), 'Builder: Q4 review', a('spaces collapsed, nothing else changed'))
  }
}

// ---------------------------------------------------------------- 2. pin
const IMPORT_RE = {
  [PAGE]: /^import \{ STUDIO_PASS3_POLISH_D_ENABLED, builderHeading, useStudioPass3PolishDMain \} from '@\/lib\/studio-pass3-polish-d' \/\/ PASS3-POLISH-D /,
  [TABS]: /^import \{ deckTabsLabel \} from "@\/lib\/studio-pass3-polish-d" \/\/ PASS3-POLISH-D /,
}
function provePin(rel, text, stripFn = stripPass3PolishD, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const base = withoutOthers(rel, baseOf(rel))
  const own = withoutOthers(rel, text)
  const stripped = stripFn(rel, own)
  eq(sha(stripped), sha(base), a(`${rel}: without this change's lines it is the base commit's file, byte for byte`))
  eq(sha(stripLaterChanges(rel, text)), sha(stripLaterChanges(rel, baseOf(rel))), a(`${rel}: and through the registry (innermost, as every older pin reads it) it is the base commit's file`))
  ok(!stripped.split('\n').some(marked), a(`${rel}: the stripped file carries no marker`))
  ok(!base.split('\n').some(marked), a(`${rel}: the base never carried the marker`))
  const lines = own.split('\n'), baseLines = base.split('\n'), kept = lines.filter(line => !marked(line)), mine = lines.filter(marked)
  deep(kept, baseLines, a(`${rel}: every base line is there in order, none changed (no attribute added to a base line)`))
  eq(lines.length - kept.length, mine.length, a(`${rel}: lines were added, none removed`))
  eq(mine.length, rel === PAGE ? 3 : 2, a(`${rel}: exactly ${rel === PAGE ? 3 : 2} lines are this change's`))
  ok(IMPORT_RE[rel].test(mine[0]), a(`${rel}: the first marked line is the import of this change's lib`))
  eq(stripFn(rel, stripFn(rel, own)), stripFn(rel, own), a(`${rel}: stripping twice changes nothing more`))
  return { lines, mine }
}
function provePage(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const lines = text.split('\n')                                  // the page as it is: PR A's and PR B's lines are what this change's lines sit next to
  const at_ = pattern => { const n = lines.findIndex(line => pattern.test(line)); ok(n >= 0, a(`found ${pattern}`)); return n }
  const importAt = at_(/^import \{ STUDIO_PASS3_POLISH_D_ENABLED, builderHeading, useStudioPass3PolishDMain \}/)
  match(lines[importAt - 1], /^import \{ STUDIO_PASS3_POLISH_B_ENABLED, STUDIO_POLISH_COPY, deckStartErrorDescription \} from '@\/lib\/studio-pass3-polish-b'/, a('the import sits right after PR B\'s import'))
  const hookAt = at_(/^ {2}useStudioPass3PolishDMain\(workspaceRef\) \/\/ PASS3-POLISH-D: /)
  match(lines[hookAt - 1], /^ {2}useStudioPass3Polish\(\) \/\/ PASS3-POLISH: /, a('the effect is called right after PR A\'s hook, unconditionally (a hook: same order every render)'))
  ok(lines.findIndex(line => /^ {2}const workspaceRef = useRef<HTMLDivElement>\(null\)$/.test(line)) < hookAt, a('workspaceRef is declared above the call'))
  const containerAt = at_(/^ {8}<div ref=\{workspaceRef\} data-studio-intro-surface=/)
  ok(/data-studio-v4-shell-workspace="true"/.test(lines[containerAt]), a('the container is the workspace of the Studio shell, its ref is the one the effect gets'))
  eq(lines[containerAt].includes('role='), false, a('and the base line gives it no role (the effect sets it)'))
  const h1At = at_(/^ {10}\{STUDIO_PASS3_POLISH_D_ENABLED && <h1 className="sr-only">\{builderHeading\(slideStructure\?\.metadata\?\.main_title\)\}<\/h1>\}\{\/\* PASS3-POLISH-D \*\/\}$/)
  eq(h1At, containerAt + 1, a('the h1 is the container\'s first child line, right after its opening line'))
  match(lines[h1At + 1], /^ {10}\{studioPopupsV2 && !workspaceLayout\.dualPane && \($/, a('and right before the base children'))
  // no other h1, main or role="main" in the page
  const rest = withoutOthers(PAGE, text).split('\n').filter(line => !marked(line)).join('\n')
  nomatch(rest, /<h1[\s>]|<main[\s>]|role=["']main["']/, a('the base page has no h1, no main element and no role="main" of its own'))
  eq(lines.filter(line => /<h1[\s>]/.test(line)).length, 1, a('with this change there is exactly one h1 line'))
  eq(lines.filter(marked).length, 3, a('three marked lines in the page: the import, the effect call, the h1'))
}
function proveTabsFile(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const lines = withoutOthers(TABS, text).split('\n')
  const importAt = lines.findIndex(line => IMPORT_RE[TABS].test(line))
  ok(importAt > 0, a('tabs.tsx imports this change\'s lib'))
  eq(lines[importAt - 1], 'import { cn } from "@/lib/utils"', a('right after the cn import'))
  const listAt = lines.findIndex(line => /^const TabsList = React\.forwardRef/.test(line)), triggerAt = lines.findIndex(line => /^const TabsTrigger = React\.forwardRef/.test(line))
  const attrAt = lines.findIndex(line => /^ {4}\{\.\.\.deckTabsLabel\(props\)\} \/\* PASS3-POLISH-D \*\/$/.test(line))
  ok(listAt < attrAt && attrAt < triggerAt, a('the attribute line is inside TabsList, not in TabsTrigger or TabsContent'))
  eq(lines[attrAt - 1], '    {...props}', a('right after the props the page gave (they can never be overridden by it, and it never overrides a name: deckTabsLabel checks)'))
  eq(lines[attrAt + 1], '  />', a('and right before the end of the element: it is an attribute of TabsPrimitive.List'))
  // TabsTrigger and TabsContent are the base's, byte for byte
  const tail = source => source.slice(source.indexOf('const TabsTrigger = React.forwardRef'))
  eq(sha(tail(lines.join('\n'))), sha(tail(withoutOthers(TABS, baseOf(TABS)))), a('TabsTrigger, TabsContent and the export are the base\'s, byte for byte'))
}

// ---------------------------------------------------------------- 3. the real TabsList over the real Radix
const TAB_CASES = [
  ['the Decks list', { 'data-studio-deck-tabs': 'true', className: 'grid w-full max-w-md grid-cols-2' }],
  ['a plain list', {}],
  ['a list the page names', { 'data-studio-deck-tabs': 'true', 'aria-label': 'Mine' }],
  ['a list the page names by reference', { 'data-studio-deck-tabs': 'true', 'aria-labelledby': 'heading-1' }],
  ['the attribute set to false', { 'data-studio-deck-tabs': 'false' }],
  ['another data attribute', { 'data-studio-other': 'true', className: 'x' }],
]
function renderTabs(w, props) {
  const { Tabs, TabsList, TabsTrigger, TabsContent } = w.load(TABS)
  const h = React.createElement
  return renderToStaticMarkup(h(Tabs, { defaultValue: 'completed' }, h(TabsList, props, h(TabsTrigger, { value: 'completed' }, 'Completed'), h(TabsTrigger, { value: 'strawman' }, 'Outline')), h(TabsContent, { value: 'completed' }, 'panel')))
}
function proveTabs(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const baseWorld = world(ON, { texts: { [TABS]: withoutOthers(TABS, baseOf(TABS)) } })      // the base file, loaded with the flag on: it knows nothing of it
  const onWorld = world(ON), offWorlds = OFF_STATES.map(env => world(env))
  for (const [name, props] of TAB_CASES) {
    const base = renderTabs(baseWorld, props)
    ok(/role="tablist"/.test(base), a(`${name}: the base markup has the tab list`))
    for (const [index, w] of offWorlds.entries()) eq(sha(renderTabs(w, props)), sha(base), a(`${name}: flag off (state ${index}) renders the base file's markup, byte for byte`))
    const on = renderTabs(onWorld, props)
    if (name === 'the Decks list') {
      eq(on.split('aria-label="Deck views"').length - 1, 1, a(`${name}: flag on: aria-label="Deck views", once`))
      eq(on.replace(' aria-label="Deck views"', ''), base, a(`${name}: and it is the ONLY difference from the base markup`))
      match(on, /<div [^>]*role="tablist"[^>]*aria-label="Deck views"|<div [^>]*aria-label="Deck views"[^>]*role="tablist"/, a(`${name}: the name is on the element that has role="tablist"`))
    } else eq(sha(on), sha(base), a(`${name}: flag on changes nothing`))
  }
  eq(renderTabs(onWorld, TAB_CASES[2][1]).split('aria-label=').length - 1, 1, a('a list the page names keeps exactly its own aria-label'))
  match(renderTabs(onWorld, TAB_CASES[2][1]), /aria-label="Mine"/, a('"Mine"'))
}

// ---------------------------------------------------------------- 4. the page's h1 and the effect
function proveBuilder(pageText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const line = withoutOthers(PAGE, pageText).split('\n').find(l => marked(l) && l.includes('<h1'))
  ok(!!line, a('the page has the h1 line'))
  const render = h1Renderer(line)
  const offLib = world({}).load(LIB), onLib = world(ON).load(LIB)
  const html = (lib, flag, title) => renderToStaticMarkup(render(flag, lib.builderHeading, title === undefined ? undefined : { metadata: { main_title: title } }))
  eq(html(offLib, offLib.STUDIO_PASS3_POLISH_D_ENABLED, 'Q4 review'), '<div></div>', a('flag off: the h1 line renders nothing (the container\'s markup is the base\'s)'))
  eq(html(offLib, false, undefined), '<div></div>', a('flag off, no deck: nothing'))
  eq(html(onLib, true, undefined), '<div><h1 class="sr-only">Builder</h1></div>', a('flag on, no deck: <h1 class="sr-only">Builder</h1>'))
  eq(html(onLib, true, ''), '<div><h1 class="sr-only">Builder</h1></div>', a('flag on, no title: Builder'))
  eq(html(onLib, true, 'Q4 review'), '<div><h1 class="sr-only">Builder: Q4 review</h1></div>', a('flag on, a title: Builder: Q4 review'))
  eq(html(onLib, true, '  A  \n B '), '<div><h1 class="sr-only">Builder: A B</h1></div>', a('flag on, a title with stray spaces: collapsed'))
  eq(html(onLib, true, '<b>x</b>'), '<div><h1 class="sr-only">Builder: &lt;b&gt;x&lt;/b&gt;</h1></div>', a('a title is text, never markup'))
  // the effect: the real hook with react's useEffect replaced by a recorder
  for (const env of [ON, ...OFF_STATES]) {
    const on = env === ON, effects = []
    const w = world(env, { react: { ...React, useEffect: fn => effects.push(fn) } }), lib = w.load(LIB)
    const reads = []
    const makeNode = (attrs = {}) => ({ attrs: { ...attrs }, sets: 0, hasAttribute(k) { return k in this.attrs }, setAttribute(k, v) { this.attrs[k] = v; this.sets++ } })
    const spy = node => ({ get current() { reads.push('read'); return node } })
    const node = makeNode(), ref = spy(node)
    lib.useStudioPass3PolishDMain(ref)
    eq(effects.length, 1, a('the hook registers exactly one effect, flag on or off (the same hooks every render)'))
    effects[0]()
    if (on) {
      eq(node.attrs.role, 'main', a('flag on: role="main" on the container'))
      eq(reads.length, 1, a('and the ref was read once'))
      effects[0]()
      eq(node.sets, 1, a('a second render sets nothing again'))
      const named = makeNode({ role: 'region' }); effects.length = 0; lib.useStudioPass3PolishDMain(spy(named)); effects[0]()
      eq(named.attrs.role, 'region', a('a role the node already has is kept'))
      effects.length = 0; lib.useStudioPass3PolishDMain(spy(null)); effects[0]()
      ok(true, a('a ref with no node yet: nothing happens, nothing throws'))
    } else {
      eq(reads.length, 0, a('flag off: the effect returns before it reads the ref'))
      eq(node.sets + Object.keys(node.attrs).length, 0, a('and sets nothing'))
    }
  }
}

// ---------------------------------------------------------------- 5. the session-history panel (the facts' item a)
function provePanel(sidebarText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const lines = sidebarText.split('\n')
  const hidden = lines.findIndex(line => /^ {8}aria-hidden=\{studio && !isOpen \? true : undefined\}$/.test(line))
  ok(hidden > 0, a('the closed panel is aria-hidden in the Studio'))
  eq(lines[hidden + 1], '        inert={studio && !isOpen ? true : undefined}', a('and inert on the very next line, under the same condition: its buttons and input cannot be reached by Tab (React 19 renders inert)'))
  ok(lines.slice(Math.max(0, hidden - 7), hidden).some(line => /^ {8}data-studio-session-history=\{studio \? "true" : undefined\}$/.test(line)), a('this is the [data-studio-session-history] panel'))
  ok(!PASS3_POLISH_D_SCOPE_FILES.has(SIDEBAR), a('and PR D does not touch it'))
}

// ---------------------------------------------------------------- 6. the change
function proveStrip(stripFn = stripPass3PolishD, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  eq(stripFn('lib/other.ts', 'x // PASS3-POLISH-D'), 'x // PASS3-POLISH-D', a('any other file is returned as it is'))
  eq(stripFn('.env.example', 'a\nb // PASS3-POLISH-D\n'), 'a\nb // PASS3-POLISH-D\n', a('.env.example is returned as it is (its block is PR A\'s)'))
  eq(stripFn(PAGE, 'a\nb // PASS3-POLISH-D: x\nc\n'), 'a\nc\n', a('a marked line goes, every other byte stays (trailing newline too)'))
  eq(stripFn(TABS, 'a\n  {...x} /* PASS3-POLISH-D */\nb'), 'a\nb', a('a block-comment marker too'))
  const keep = 'a\nb // PASS3-POLISH\nc // PASS3-POLISH-B\nd // PASS3-POLISH-C\ne // PASS3-POLISH-DD\nf // XPASS3-POLISH-D\ng // PASS3-POLISH-D-x\n'
  eq(stripFn(PAGE, keep), keep, a('only this change\'s marker, as a whole token, takes a line out: PR A\'s, PR B\'s and PR C\'s lines stay for their own strips'))
  eq(stripFn(PAGE, 'a\nb // PASS3-POLISH\nc // PASS3-POLISH-D\n'), 'a\nb // PASS3-POLISH\n', a('in a file with PR A\'s marker too it takes only its own'))
  eq(stripFn(PAGE, stripFn(PAGE, read(PAGE))), stripFn(PAGE, read(PAGE)), a('stripping twice changes nothing more'))
  eq(stripFn(PAGE, 7), 7, a('a non-string comes back'))
  deep(PASS3_POLISH_D_FILES, [TABS, PAGE], a('the strip touches tabs.tsx and the Builder page only'))
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const lines = registryText.split('\n').filter(line => line.includes("'./studio-pass3-polish-d-strip.mjs'"))
  eq(lines.length, 2, a('the registry has exactly two lines for this change: its files and its strip (no .env.example block)'))
  ok(lines.every(line => line.includes('// LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR D (NEXT_PUBLIC_STUDIO_PASS3_POLISH')), a('each carries the LATER-CHANGE marker'))
  match(lines[0], /\.\.\.\(await import\('\.\/studio-pass3-polish-d-strip\.mjs'\)\)\.PASS3_POLISH_D_SCOPE_FILES,/, a('line 1: the files'))
  match(lines[1], /\(await import\('\.\/studio-pass3-polish-d-strip\.mjs'\)\)\.stripPass3PolishD,/, a('line 2: the strip'))
  const at1 = registryText.indexOf(lines[0]), at2 = registryText.indexOf(lines[1]), files = registryText.indexOf('export const LATER_CHANGE_FILES'), blocks = registryText.indexOf('export const LATER_ENV_BLOCKS'), strips = registryText.indexOf('export const LATER_STRIPS')
  ok(files < at1 && at1 < blocks && strips < at2, a('the files line is in LATER_CHANGE_FILES, the strip line in LATER_STRIPS'))
  const cFiles = registryText.indexOf("'./studio-pass3-polish-c-strip.mjs')).PASS3_POLISH_C_SCOPE_FILES"), cStrip = registryText.indexOf("'./studio-pass3-polish-c-strip.mjs')).stripPass3PolishC")
  ok(cFiles > 0 && cFiles < at1 && cStrip > 0 && cStrip < at2, a('each comes after PR C\'s line in the same list (a union on merge keeps all)'))
  ok(!registryText.slice(blocks, strips).includes('studio-pass3-polish-d-strip'), a('and nothing of this change is in LATER_ENV_BLOCKS'))
  ok(LATER_STRIPS.includes(stripPass3PolishD) || LATER_STRIPS.some(fn => fn.name === 'stripPass3PolishD'), a('the registry holds the strip'))
  ok([...PASS3_POLISH_D_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('the registry names every file of this change'))
  ok(!LATER_ENV_BLOCKS.some(block => /PASS3-POLISH-D/.test(String(block))), a('no env block of its own'))
}
function proveBProof(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const text = read(B_PROOF)
  match(text, /const withoutPeers = \(rel, text\) => \(LATER_STRIPS\.includes\(stripPass3PolishB\)/, a('PR B\'s proof reads the two pages past later PRs\' lines (withoutPeers)'))
  match(text, /BUILDER_PAGE\]: withoutPeers\(BUILDER_PAGE, read\(BUILDER_PAGE\)\)/, a('in proveAll'))
  match(text, /proveBuilder\(withoutPeers\(BUILDER_PAGE, read\(BUILDER_PAGE\)\), name\)/, a('and in its mutants'))
  try {
    const stat = git('diff', '--numstat', B_HEAD, 'HEAD', '--', B_PROOF).trim().split('\t')
    if (stat.length === 3 && !(B_PROOF in overrides)) ok(Number(stat[0]) <= 12 && Number(stat[1]) === 2, a(`the edit of PR B's proof is the helper and two reads (+${stat[0]} -${stat[1]})`))
  } catch { /* PR B's head is not in this clone: the text checks above stand */ }
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  ok([...PASS3_POLISH_D_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
  const family = ['lib', 'hooks', 'components', 'scripts'].flatMap(dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { withFileTypes: true }).filter(entry => !entry.isDirectory() && /pass3-polish-d/.test(entry.name)).map(entry => `${dir}/${entry.name}`) : [])
  deep(family.filter(rel => !PASS3_POLISH_D_SCOPE_FILES.has(rel) && !LATER_CHANGE_FILES.has(rel)), [], a('no file of this change\'s family is missing from its list'))
  const committed = ownCommitted()
  const stray = committed.filter(rel => !PASS3_POLISH_D_SCOPE_FILES.has(rel) && !LATER_CHANGE_FILES.has(rel))
  deep(stray, [], a(`every file in the committed diff of this change (${BASE.slice(0, 8)}..HEAD) is its own or a registered later change's`))
  if (committed.length) {
    deep([...PASS3_POLISH_D_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    ok(committed.filter(rel => /^scripts\/test-/.test(rel)).every(rel => rel === THIS_TEST || PASS3_POLISH_D_OWN_EDITS.includes(rel) || LATER_CHANGE_FILES.has(rel)), a('the only tests it adds or edits are its own and PR B\'s proof (listed)'))
    deep(committed.filter(rel => !/^scripts\//.test(rel)).sort(), [TABS, PAGE, LIB].sort(), a('the app files it changes: tabs.tsx, the Builder page and its lib (not the Decks page, not the session-history panel)'))
  }
}
function proveSecretScan(pageText, tabsText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [LIB, STRIP_MODULE, THIS_TEST].map(read).concat(pageText.split('\n').filter(marked), tabsText.split('\n').filter(marked)).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
}

// ---------------------------------------------------------------- run everything
function proveAll(stripFn = stripPass3PolishD, at = '') {
  const page = read(PAGE), tabs = read(TABS)
  proveLib(read(LIB), read(FLAG_LIB), at)
  provePin(PAGE, page, stripFn, at)
  provePin(TABS, tabs, stripFn, at)
  provePage(page, at)
  proveTabsFile(tabs, at)
  proveTabs(at)
  proveBuilder(page, at)
  provePanel(read(SIDEBAR), at)
  proveStrip(stripFn, at)
  proveRegistry(read(REGISTRY), at)
  proveBProof(at)
  proveScope(at)
  proveSecretScan(page, tabs, at)
}
proveAll()
console.log(`flag off: tabs markup identical to the base file in ${OFF_STATES.length} flag-off states x ${TAB_CASES.length} prop sets; the h1 line renders nothing; the effect never reads the ref`)
console.log(`PASS lib, pin, tabs, builder, panel, change: ${checks} checks`)

// =========================================================== 7. mutants
const killed = [], survived = []
async function mutant(name, edits, { strip = stripPass3PolishD } = {}) {
  const before = overrides
  try {
    overrides = { ...before }
    for (const [rel, from, to, mode] of edits) { // mode: none = the text occurs once; 'all' = every one
      const source = read(rel), n = source.split(from).length - 1
      assert.ok(mode ? n >= 1 : n === 1, `mutant "${name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = mode === 'all' ? source.split(from).join(to) : source.replace(from, () => to)
    }
    proveAll(strip, name)
  } catch (error) {
    if (/no longer applies/.test(String(error.message))) throw error
    killed.push(name); if (process.env.PASS3_POLISH_D_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
const TABS_ATTR = '    {...deckTabsLabel(props)} /* PASS3-POLISH-D */\n'
const H1_LINE = '{STUDIO_PASS3_POLISH_D_ENABLED && <h1 className="sr-only">{builderHeading(slideStructure?.metadata?.main_title)}</h1>}{/* PASS3-POLISH-D */}'
const HOOK_LINE = '  useStudioPass3PolishDMain(workspaceRef) // PASS3-POLISH-D'
// the lib
await mutant('lib: the tab list is called "Deck view"', [[LIB, "export const DECK_VIEWS_LABEL = 'Deck views'", "export const DECK_VIEWS_LABEL = 'Deck view'"]])
await mutant('lib: every list gets the name, not only the Decks list', [[LIB, "  if (own['data-studio-deck-tabs'] !== 'true' && own['data-studio-deck-tabs'] !== true) return {}\n", '']])
await mutant('lib: a name the page gives is replaced', [[LIB, "  if (own['aria-label'] || own['aria-labelledby']) return {}\n", '']])
await mutant('lib: the label does not need the flag', [[LIB, "export function deckTabsLabel(props: object): { 'aria-label'?: string } {\n  if (!STUDIO_PASS3_POLISH_D_ENABLED) return {}\n", "export function deckTabsLabel(props: object): { 'aria-label'?: string } {\n"]])
await mutant('lib: the role is region', [[LIB, "node.setAttribute('role', 'main')", "node.setAttribute('role', 'region')"]])
await mutant('lib: an existing role is overwritten', [[LIB, "if (node && !node.hasAttribute('role')) node.setAttribute('role', 'main')", "if (node) node.setAttribute('role', 'main')"]])
await mutant('lib: the effect reads the ref before the flag', [[LIB, "  useEffect(() => {\n    if (!STUDIO_PASS3_POLISH_D_ENABLED) return\n    const node = ref.current\n", "  useEffect(() => {\n    const node = ref.current\n    if (!STUDIO_PASS3_POLISH_D_ENABLED) return\n"]])
await mutant('lib: the heading keeps stray spaces', [[LIB, "title.replace(/\\s+/g, ' ').trim()", 'title.trim()']])
await mutant('lib: the heading separator changes', [[LIB, 'return text ? `${BUILDER_HEADING}: ${text}` : BUILDER_HEADING', 'return text ? `${BUILDER_HEADING} - ${text}` : BUILDER_HEADING']])
await mutant('lib: the heading is empty without a title', [[LIB, 'return text ? `${BUILDER_HEADING}: ${text}` : BUILDER_HEADING', "return text ? `${BUILDER_HEADING}: ${text}` : ''"]])
await mutant('lib: a flag of its own, loosened', [[LIB, 'export const STUDIO_PASS3_POLISH_D_ENABLED = STUDIO_PASS3_POLISH_ENABLED', "export const STUDIO_PASS3_POLISH_D_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true'"]])
await mutant('flag: PR A\'s constant no longer needs the Studio shell', [[FLAG_LIB, " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", '']])
// the pages
await mutant('page: the h1 is an h2', [[PAGE, H1_LINE, H1_LINE.replace('<h1 ', '<h2 ').replace('</h1>', '</h2>')]])
await mutant('page: the h1 is not hidden', [[PAGE, H1_LINE, H1_LINE.replace(' className="sr-only"', '')]])
await mutant('page: the h1 is drawn with the flag off', [[PAGE, H1_LINE, H1_LINE.replace('STUDIO_PASS3_POLISH_D_ENABLED && ', '')]])
await mutant('page: the h1 line loses its marker', [[PAGE, H1_LINE, H1_LINE.replace('{/* PASS3-POLISH-D */}', '')]])
await mutant('page: the h1 says the deck title only', [[PAGE, 'builderHeading(slideStructure?.metadata?.main_title)}</h1>', 'slideStructure?.metadata?.main_title}</h1>']])
await mutant('page: a second h1', [[PAGE, HOOK_LINE, `  const second = <h1>Again</h1> // PASS3-POLISH-D\n${HOOK_LINE}`]])
await mutant('page: the effect call is gone', [[PAGE, HOOK_LINE + ': NEXT_PUBLIC_STUDIO_PASS3_POLISH (default off) sets role="main" on the workspace container; flag off, the effect returns before it reads the ref\n', '']])
await mutant('page: the effect is called conditionally', [[PAGE, HOOK_LINE, '  if (studioShell) useStudioPass3PolishDMain(workspaceRef) // PASS3-POLISH-D']])
await mutant('page: the effect gets another ref', [[PAGE, 'useStudioPass3PolishDMain(workspaceRef)', 'useStudioPass3PolishDMain(slideRef)']])
await mutant('page: a base line changed (role="main" typed on the container)', [[PAGE, 'data-studio-v4-shell-workspace="true" data-studio-workspace-welcome=', 'data-studio-v4-shell-workspace="true" role="main" data-studio-workspace-welcome=']])
await mutant('page: an unmarked line added', [[PAGE, HOOK_LINE, `  const unmarked = 1\n${HOOK_LINE}`]])
await mutant('page: the h1 moved below the base children', [[PAGE, '          ' + H1_LINE + '\n          {studioPopupsV2 && !workspaceLayout.dualPane && (', '          {studioPopupsV2 && !workspaceLayout.dualPane && (\n          ' + H1_LINE]])
await mutant('tabs: the attribute line is in TabsTrigger', [[TABS, TABS_ATTR, ''], [TABS, '    {...props}\n  />\n))\nTabsTrigger.displayName', '    {...props}\n' + TABS_ATTR + '  />\n))\nTabsTrigger.displayName']])
await mutant('tabs: the attribute is spread before the props (the page could override it)', [[TABS, '    {...props}\n' + TABS_ATTR, TABS_ATTR + '    {...props}\n']])
await mutant('tabs: an attribute line without the marker', [[TABS, TABS_ATTR, '    {...deckTabsLabel(props)}\n']])
await mutant('tabs: a base line changed', [[TABS, 'import { cn } from "@/lib/utils"\n', 'import { cn } from "@/lib/utils2"\n']])
await mutant('tabs: the label is spread on the Decks page\'s list only by a second line', [[TABS, TABS_ATTR, TABS_ATTR + '    {...deckTabsLabel(props)} /* PASS3-POLISH-D */\n']])
// the panel
await mutant('panel: inert is gone from the closed panel', [[SIDEBAR, '        inert={studio && !isOpen ? true : undefined}\n', '']])
await mutant('panel: inert follows another condition', [[SIDEBAR, 'inert={studio && !isOpen ? true : undefined}', 'inert={studio && isOpen ? true : undefined}']])
// the strip, the registry, PR B's proof
await mutant('strip: leaves the marked lines', [], { strip: (rel, text) => text })
await mutant('strip: the marker is a substring (PR A\'s, B\'s and C\'s lines go with this one\'s)', [], { strip: (rel, text) => (PASS3_POLISH_D_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes('PASS3-POLISH')).join('\n') : text) })
await mutant('strip: also removes an unmarked line', [], { strip: (rel, text) => (PASS3_POLISH_D_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !marked(line) && !line.startsWith('import { cn }')).join('\n') : text) })
await mutant('strip: drops the trailing newline', [], { strip: (rel, text) => stripPass3PolishD(rel, text).replace(/\n$/, '') })
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-pass3-polish-d-strip.mjs')).PASS3_POLISH_D_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR D (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)\n", '']])
await mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-pass3-polish-d-strip.mjs')).stripPass3PolishD, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR D (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n", '']])
await mutant('PR B\'s proof: reads the Builder page without the registry again', [[B_PROOF, 'proveBuilder(withoutPeers(BUILDER_PAGE, read(BUILDER_PAGE)), name)', 'proveBuilder(read(BUILDER_PAGE), name)']])
await mutant('secret scan: a credential-shaped literal', [[STRIP_MODULE, "export const PASS3_POLISH_D_MARKER = 'PASS3-POLISH-D'", `export const PASS3_POLISH_D_MARKER = 'PASS3-POLISH-D'\nconst ${['api', 'Key'].join('')} = '${['AKIA', 'ABCDEFGH', '12345678'].join('')}'`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.log('SURVIVED:\n  ' + survived.join('\n  ')); process.exit(1) }
console.log(`test-studio-pass3-polish-d: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
