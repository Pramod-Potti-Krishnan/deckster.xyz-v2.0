// FRONTEND-2 (25 Oct: the Pass 3 polish set, PR F, stacked on PR E #510): proof for the flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time; PR A's flag, the SAME one as B to E).
// PR F puts right the one regression of the whole-site A/B sweep of 0e267a2c: on a phone the Themes page's Heading font and Body font selects (themes-workspace.tsx, FontFields) ran "Theme default" under the browser's chevron at
// PR A's 16px ("Theme defau▾"). They get PR E's E2 declarations: 24px of right padding and text-overflow: ellipsis. The chosen value keeps PR A's 16px; the two-column layout is not touched. CSS only, in a stylesheet of its own,
// brought to the Themes page by a NEW pass-through layout (app/(app)/studio/themes/layout.tsx); no existing file gets a line.
// Run: node scripts/test-studio-pass3-polish-f.mjs   (plain node: postcss parse, the new layout transpiled and rendered with react-dom/server, `git show` reads the base commit; no network, no browser, no model call)
//
//   1. stylesheet  exactly one rule, inside (max-width: 640px), starting with <html data-studio-pass3-polish="true"> and the Studio shell and ending with PR A's section 2 guard (read from PR A's file, not copied); the exact selector
//                  and declarations, which are PR E's E2 declarations (read from PR E's file); no !important, no font size, no layout change; no FRONTEND-1 area outside the guard
//   2. facts       the hooks the selector hangs on are the Themes page's own (main.studio-library[data-studio-library="themes"], .sl-two-fields[data-theme-font-fields] > label.sl-field > select, "Theme default"); the "before"
//                  values (libraries.css: 10px 11px of padding, 12px type; no appearance and no background image: the chevron is the browser's own)
//   3. layout      the new layout is exactly a pass-through: it renders its children and nothing else, in every flag state (sha256), reads no environment, is a server component; its one marked line imports this stylesheet;
//                  without the marked line it imports nothing of the polish set
//   4. untouched   every existing file this change could have used (the account layout, the Themes page and workspace, libraries.css, PR A's and PR E's files) is the base commit's, byte for byte
//   5. change      the strip (whole-token marker), the registry (two lines, after PR E's), scope (the COMMITTED diff only), no secret
//   6. mutants     each one must make sections 1-5 fail
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
  BASE_COMMIT, PASS3_POLISH_F_CSS, PASS3_POLISH_F_FILES, PASS3_POLISH_F_LAYOUT, PASS3_POLISH_F_MARKER_RE, PASS3_POLISH_F_OWN_EDITS, PASS3_POLISH_F_SCOPE_FILES, stripPass3PolishF,
} from './studio-pass3-polish-f-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const BASE = process.env.PASS3_POLISH_F_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
// This change's OWN committed files: the files of the non-merge commits in BASE..HEAD whose subject is this change's ("Pass 3 polish set, PR F: ..."). The working tree is never consulted.
const ownCommitted = () => {
  const files = new Set()
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [subject, ...names] = block.split('\n')
    if (/^Pass 3 polish set, PR F:/.test(subject)) for (const name of names) if (name) files.add(name)
  }
  return [...files]
}
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
let overrides = {} // in-memory mutations: every proof reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const marked = line => PASS3_POLISH_F_MARKER_RE.test(line)

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), deep = count(assert.deepEqual), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const CSS = PASS3_POLISH_F_CSS, LAYOUT = PASS3_POLISH_F_LAYOUT
const A_CSS = 'components/studio-pass3-polish/studio-pass3-polish.css', A_HOOK = 'hooks/use-studio-pass3-polish.ts', A_LIB = 'lib/studio-pass3-polish.ts', E_CSS = 'components/studio-pass3-polish/studio-pass3-polish-e.css'
const E_STRIP = 'scripts/studio-pass3-polish-e-strip.mjs', E_TEST = 'scripts/test-studio-pass3-polish-e.mjs'
const ACCOUNT = 'app/(app)/layout.tsx', BUILDER = 'app/builder/page.tsx', THEMES_PAGE = 'app/(app)/studio/themes/page.tsx', THEMES = 'components/studio-libraries/themes-workspace.tsx'
const CONTROLS = 'components/studio-libraries/library-controls.tsx', LIBRARIES_CSS = 'components/studio-libraries/libraries.css', THEMES_CSS = 'components/studio-libraries/themes-fidelity.css'
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-pass3-polish-f-strip.mjs', THIS_TEST = 'scripts/test-studio-pass3-polish-f.mjs'
const FLAG = 'NEXT_PUBLIC_STUDIO_PASS3_POLISH', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', ATTR = 'data-studio-pass3-polish'
const SCOPE = `html[${ATTR}="true"]`, SHELLED = `${SCOPE} [data-studio-v4-shell="true"]`, PHONE = '(max-width: 640px)'
const CSS_IMPORT = '@/components/studio-pass3-polish/studio-pass3-polish-f.css'
const ZONES = ['[data-studio-settings]', '[data-studio-billing]', '[data-studio-p2-shortcuts]', '[data-studio-personal="details"]', '[data-studio-v4-profile]', '[data-studio-publish]', '[data-studio-publish-popup]', '[data-studio-publish-wizard]', '[data-studio-qa-inbox]', '[data-studio-published-viewer]', '[data-studio-published-ask]', '[data-studio-published-qa]', '[data-studio-p2-admin]', '[data-studio-p2-docs]', '[data-studio-p2-help]', '[data-studio-help-content]']
const GUARD = `:not(:is(${ZONES.join(', ')}) *)`
const FONT_SELECTOR = `${SHELLED} main.studio-library[data-studio-library="themes"] [data-theme-font-fields="true"] > label.sl-field > select${GUARD}`
const FONT_DECLS = { 'padding-right': '24px', 'text-overflow': 'ellipsis' }

// ---------------------------------------------------------------- 1. the stylesheet
const splitTop = (selector) => {
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
const withoutNots = (selector) => {
  let out = '', i = 0
  while (i < selector.length) {
    if (selector.startsWith(':not(', i)) { let depth = 0, j = i + 4; for (; j < selector.length; j++) { if (selector[j] === '(') depth++; else if (selector[j] === ')') { depth--; if (depth === 0) break } } i = j + 1; continue }
    out += selector[i]; i++
  }
  return out
}
function parseCss(text) {
  const tree = postcss.parse(text)
  const sections = [], rules = []
  let current = null
  for (const node of tree.nodes) {
    if (node.type === 'comment') {
      const m = /^={5} SECTION (F\d+): (.+?) ={5}$/.exec(node.text.trim())
      if (m) { current = { id: m[1], title: m[2], atRules: [] }; sections.push(current) }
    } else if (node.type === 'atrule') {
      if (!current) throw new Error('an at-rule before the first section')
      const entry = { name: node.name, params: node.params, rules: [], nested: 0 }
      node.walkAtRules(() => { entry.nested++ })
      node.walkRules(rule => entry.rules.push({ selectors: splitTop(rule.selector), selector: rule.selector, decls: rule.nodes.filter(n => n.type === 'decl').map(d => ({ prop: d.prop, value: d.value, important: Boolean(d.important) })), other: rule.nodes.filter(n => n.type !== 'decl' && n.type !== 'comment').length }))
      current.atRules.push(entry); rules.push(...entry.rules)
    } else if (node.type === 'rule') throw new Error(`a rule outside any at-rule: ${node.selector.slice(0, 80)}`)
  }
  return { sections, rules }
}
const declMap = rule => Object.fromEntries(rule.decls.map(d => [d.prop, `${d.value}${d.important ? ' !important' : ''}`]))
function guardOfA(aText) {
  let found = null
  postcss.parse(aText).walkRules(rule => { if (!found && /font-size/.test(rule.toString()) && rule.selector.includes('select, textarea')) found = rule.selector })
  assert.ok(found, 'PR A\'s section 2 font-size rule is found')
  return found.slice(found.lastIndexOf(':not(:is('))
}
function e2DeclsOf(eText) { // PR E's E2 declarations, as PR E's file has them
  let found = null
  postcss.parse(eText).walkRules(rule => { if (!found && rule.selector.includes('.sp-p2-pick > select')) found = rule })
  assert.ok(found, 'PR E\'s E2 rule is found')
  return Object.fromEntries(found.nodes.filter(n => n.type === 'decl').map(d => [d.prop, d.value]))
}
function proveCss(text, at = '') {
  const a = message => (at ? `${at}: css: ${message}` : `css: ${message}`)
  const css = parseCss(text)
  eq(guardOfA(read(A_CSS)), GUARD, a('the guard is PR A\'s section 2 guard, word for word (all sixteen FRONTEND-1 roots)'))
  deep(e2DeclsOf(read(E_CSS)), FONT_DECLS, a('the declarations are PR E\'s E2 declarations, word for word'))
  deep(css.sections.map(s => s.id), ['F1'], a('one section, F1 (named apart from PR A\'s numbered sections and PR E\'s E1, E2)'))
  deep(css.sections.map(s => s.title), ['the Themes font selects end in an ellipsis before the chevron on a phone'], a('its title'))
  deep(css.sections.map(s => s.atRules.map(e => `@${e.name} ${e.params}`)), [[`@media ${PHONE}`]], a('one @media (max-width: 640px), PR A\'s phone breakpoint, and nothing else'))
  ok(css.sections.every(s => s.atRules.every(e => e.nested === 0)), a('no at-rule inside it'))
  eq(css.rules.length, 1, a('one rule in all'))
  const [f1] = css.rules
  eq(f1.selectors.length, 1, a('one selector'))
  eq(f1.selectors[0], FONT_SELECTOR, a('F1: the Themes page\'s two font selects (a select directly in a label.sl-field directly in .sl-two-fields[data-theme-font-fields]), inside the Themes main, the shell, behind the guard'))
  ok(f1.selectors[0].startsWith(`${SHELLED} `), a('it starts with the attribute and the Studio shell'))
  ok(f1.selectors[0].endsWith(GUARD), a('and ends with the guard'))
  deep(declMap(f1), FONT_DECLS, a('F1: 24px of right padding and an ellipsis'))
  deep(f1.decls.map(d => d.prop), ['padding-right', 'text-overflow'], a('F1 changes the right padding and the overflow and nothing else (no font size, height, width, left padding, grid, appearance)'))
  ok(f1.decls.every(d => !d.important), a('no !important'))
  eq(f1.other, 0, a('no nested rule'))
  nomatch(withoutNots(f1.selectors[0]), /admin|settings|billing|shortcut|profile|details|publish|published|docs|help|qa-inbox|account|\/p\b/, a('no FRONTEND-1 area is named outside the :not() guard'))
  nomatch(text.replace(/\/\*[\s\S]*?\*\//g, ''), /@import|@font-face|@keyframes|url\(|expression\(|behavior:|appearance/, a('no import, font, animation, url() or appearance'))
  postcss.parse(text).walkDecls(d => ok(['padding-right', 'text-overflow'].includes(d.prop), a(`no other declaration anywhere in the file (font size, grid, display, width, flex ...): ${d.prop}`)))
  for (const zone of ZONES) eq(text.replace(/\/\*[\s\S]*?\*\//g, '').split(zone).length - 1, 1, a(`${zone} appears exactly once, in the guard`))
}

// ---------------------------------------------------------------- 2. the facts the rule hangs on
function proveFacts(at = '') {
  const a = message => (at ? `${at}: facts: ${message}` : `facts: ${message}`)
  const themes = read(THEMES), controls = read(CONTROLS), libs = read(LIBRARIES_CSS)
  match(controls, /return <main className="studio-library" data-studio-library=\{workspaceId \?\? title\.toLowerCase\(\)\} /, a('a library page is main.studio-library with data-studio-library = its workspace id'))
  match(themes, /<LibraryWorkspace [^>]*workspaceId="themes" /, a('the Themes workspace\'s id is "themes"'))
  eq((themes.match(/data-theme-font-fields="true"/g) || []).length, 1, a('one font-fields group'))
  match(themes, /return <><div className="sl-two-fields" data-theme-font-fields="true">\{picker\('font_family_heading', 'Heading font'\)\}\{picker\('font_family', 'Body font'\)\}<\/div>/, a('the group holds the Heading font and Body font pickers, side by side (.sl-two-fields)'))
  match(themes, /return <label className="sl-field">\{label\}<select value=\{chosen \?\? ''\} /, a('each picker is a select directly in a label.sl-field (the > in the selector)'))
  match(themes, /<option value="">Theme default<\/option>/, a('its empty value reads "Theme default" (the text that was cut)'))
  match(libs, /\.studio-library \.sl-field :is\(input, textarea, select\) \{ width: 100%; border: 1px solid var\(--sl-line\); background: var\(--sl-panel\); padding: 10px 11px; border-radius: 7px; font-size: 12px;/, a('before: 10px 11px of padding and 12px type'))
  match(libs, /\.studio-library \.sl-two-fields \{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; \}/, a('the two pickers share the row, half the card each (left as it is: no restacking)'))
  for (const [rel, text] of [[LIBRARIES_CSS, libs], [THEMES_CSS, read(THEMES_CSS)]]) {
    const bad = []
    postcss.parse(text).walkRules(rule => { if (/\bselect\b/.test(rule.selector)) rule.walkDecls(d => { if (/appearance|background-image|^background$/.test(d.prop) && (d.prop !== 'background' || /url\(|gradient/.test(d.value))) bad.push(`${rule.selector} { ${d.prop}: ${d.value} }`) }) })
    deep(bad, [], a(`${rel}: no appearance and no background image on a select: the chevron is the browser's own, drawn over the right padding`))
  }
  match(read(A_CSS), /select, textarea, \[contenteditable\][^{]*\{\n\s+font-size: 16px !important;/, a('PR A section 2: selects are 16px on a phone (the cause; F keeps it)'))
}

// ---------------------------------------------------------------- 3. the new layout
const EXPECTED_LAYOUT_CODE = [
  'import type { ReactNode } from "react"',
  'export default function StudioThemesLayout({ children }: { children: ReactNode }) {',
  '  return <>{children}</>',
  '}',
]
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
function loadLayout(text, env) {
  const module = { exports: {} }, imports = []
  const req = spec => {
    if (spec === CSS_IMPORT) { imports.push(spec); return {} }
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec === 'react') return React
    throw new Error(`unexpected import ${spec} in ${LAYOUT}`)
  }
  vm.runInNewContext(compile(LAYOUT, text), { module, exports: module.exports, require: req, process: { env } }, { filename: LAYOUT })
  return { mod: module.exports, imports }
}
const STATES = []
for (const flag of [undefined, 'false', 'TRUE', '1', ' true', 'true']) for (const shell of ['true', 'false', undefined]) STATES.push({ ...(flag === undefined ? {} : { [FLAG]: flag }), ...(shell === undefined ? {} : { [SHELL]: shell }) })
function proveLayout(text, at = '') {
  const a = message => (at ? `${at}: layout: ${message}` : `layout: ${message}`)
  const lines = text.split('\n'), mine = lines.filter(marked)
  eq(mine.length, 1, a('one marked line'))
  match(mine[0], /^import "@\/components\/studio-pass3-polish\/studio-pass3-polish-f\.css" \/\/ PASS3-POLISH-F \(NEXT_PUBLIC_STUDIO_PASS3_POLISH, default off\): /, a('it imports this change\'s stylesheet, marked'))
  eq(lines.indexOf(mine[0]), 1, a('right after the ReactNode type import'))
  const code = stripPass3PolishF(LAYOUT, text).split('\n').filter(line => line.trim() && !/^\s*(\/\*\*|\*|\*\/|\/\/)/.test(line))
  deep(code, EXPECTED_LAYOUT_CODE, a('without the marked line and its comment, the layout is a pure pass-through: one type import, one function that returns its children'))
  nomatch(text, /process\.env|"use client"|'use client'|useEffect|useState|fetch\(|<div|<main|<section|className/, a('it reads no environment, is a server component, has no effect, state, request, element or class'))
  const page = React.createElement('main', { className: 'studio-library', 'data-studio-library': 'themes' }, React.createElement('p', null, 'the Themes page'))
  const alone = renderToStaticMarkup(page), outs = []
  for (const env of STATES) {
    const { mod, imports } = loadLayout(text, env)
    const html = renderToStaticMarkup(React.createElement(mod.default, null, page))
    eq(html, alone, a(`${JSON.stringify(env)}: the page renders exactly as without the layout`))
    deep(imports, [CSS_IMPORT], a('and the stylesheet is imported once'))
    outs.push(html)
  }
  eq(sha(outs.join('\n')), sha(STATES.map(() => alone).join('\n')), a(`sha256 over ${STATES.length} flag states equals the page alone (flag on included: the change is CSS only)`))
  return { states: STATES.length, sha: sha(outs.join('\n')) }
}

// ---------------------------------------------------------------- 4. untouched
function proveUntouched(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of [ACCOUNT, BUILDER, THEMES_PAGE, THEMES, CONTROLS, LIBRARIES_CSS, THEMES_CSS, A_CSS, A_HOOK, A_LIB, E_CSS, E_STRIP, E_TEST]) eq(sha(LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripPass3PolishF) + 1).reduce((text, strip) => (typeof strip === 'function' ? strip(rel, text) : text), read(rel))), sha(baseOf(rel)), a(`${rel} is the base commit's, byte for byte (the marked lines of changes registered after this one out: LATER-CHANGES, SPEED-PERCEIVED)`))
  nomatch(read(ACCOUNT) + read(BUILDER) + read(THEMES_PAGE), /studio-pass3-polish-f|PASS3-POLISH-F/, a('no existing entry imports this change\'s stylesheet (only the new layout does)'))
  let found = false
  try { git('cat-file', '-e', `${BASE}:${LAYOUT}`); found = true } catch { found = false }
  eq(found, false, a('the Themes layout is new: the base commit has none'))
  // no rule matches without the attribute, which only PR A's lib sets (exact "true", with the shell) and only PR A's hook installs
  postcss.parse(read(CSS)).walkRules(rule => { for (const s of splitTop(rule.selector)) ok(s.startsWith(`${SCOPE} `), a('every selector needs <html data-studio-pass3-polish="true">: without it no rule of this file matches anything')) })
  match(read(A_LIB), /export const STUDIO_PASS3_POLISH_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'/, a('the attribute is PR A\'s, set only with the flag exactly "true" and the Studio shell'))
}

// ---------------------------------------------------------------- 5. the change: strip, registry, scope, secret scan
function proveStrip(stripFn, at = '') {
  const a = message => (at ? `${at}: strip: ${message}` : `strip: ${message}`)
  eq(stripFn('app/(app)/layout.tsx', 'x // PASS3-POLISH-F'), 'x // PASS3-POLISH-F', a('any other file is returned as it is'))
  eq(stripFn(LAYOUT, 'a\nimport "x.css" // PASS3-POLISH-F (y)\nb\n'), 'a\nb\n', a('a marked line goes, every other byte stays (trailing newline too)'))
  const keep = 'a\nb // PASS3-POLISH\nc // PASS3-POLISH-B\nd // PASS3-POLISH-D\ne // PASS3-POLISH-E\nf // PASS3-POLISH-FF\ng // XPASS3-POLISH-F\nh // PASS3-POLISH-F-x\n'
  eq(stripFn(LAYOUT, keep), keep, a('only this change\'s marker, as a whole token, takes a line out'))
  eq(stripFn(LAYOUT, 7), 7, a('a non-string comes back'))
  deep(PASS3_POLISH_F_FILES, [LAYOUT], a('the strip touches the new Themes layout only'))
  const mine = read(LAYOUT).split('\n').filter(marked).join('\n')
  for (const [name, re] of [['PR A', /(?<![\w-])PASS3-POLISH(?![\w-])/], ['PR B', /PASS3-POLISH-B/], ['PR C', /(?<![\w-])PASS3-POLISH-C(?![\w-])/], ['PR D', /(?<![\w-])PASS3-POLISH-D(?![\w-])/], ['PR E', /(?<![\w-])PASS3-POLISH-E(?![\w-])/]]) nomatch(mine, re, a(`${name}'s marker does not match this change's line`))
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: registry: ${message}` : `registry: ${message}`)
  const lines = registryText.split('\n').filter(line => line.includes("'./studio-pass3-polish-f-strip.mjs'"))
  eq(lines.length, 2, a('exactly two lines for this change: its files and its strip (no .env.example block)'))
  ok(lines.every(line => line.includes('// LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR F (NEXT_PUBLIC_STUDIO_PASS3_POLISH')), a('each carries the LATER-CHANGE marker'))
  match(lines[0], /^ {2}\.\.\.\(await import\('\.\/studio-pass3-polish-f-strip\.mjs'\)\)\.PASS3_POLISH_F_SCOPE_FILES,/, a('line 1: the files'))
  match(lines[1], /^ {2}\(await import\('\.\/studio-pass3-polish-f-strip\.mjs'\)\)\.stripPass3PolishF,/, a('line 2: the strip'))
  const at1 = registryText.indexOf(lines[0]), at2 = registryText.indexOf(lines[1]), files = registryText.indexOf('export const LATER_CHANGE_FILES'), blocks = registryText.indexOf('export const LATER_ENV_BLOCKS'), strips = registryText.indexOf('export const LATER_STRIPS')
  ok(files < at1 && at1 < blocks && strips < at2, a('the files line is in LATER_CHANGE_FILES, the strip line in LATER_STRIPS'))
  const eFiles = registryText.indexOf("'./studio-pass3-polish-e-strip.mjs')).PASS3_POLISH_E_SCOPE_FILES"), eStrip = registryText.indexOf("'./studio-pass3-polish-e-strip.mjs')).stripPass3PolishE")
  ok(eFiles > 0 && eFiles < at1 && eStrip > 0 && eStrip < at2, a('each comes after PR E\'s line in the same list'))
  ok(!registryText.slice(blocks, strips).includes('studio-pass3-polish-f-strip'), a('nothing of this change is in LATER_ENV_BLOCKS'))
  ok(LATER_STRIPS.includes(stripPass3PolishF) || LATER_STRIPS.some(fn => fn.name === 'stripPass3PolishF'), a('the registry holds the strip'))
  ok([...PASS3_POLISH_F_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('the registry names every file of this change'))
  ok(!LATER_ENV_BLOCKS.some(block => /PASS3-POLISH-F/.test(String(block))), a('no env block of its own'))
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: scope: ${message}` : `scope: ${message}`)
  ok([...PASS3_POLISH_F_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
  const family = ['lib', 'hooks', 'components', 'scripts'].flatMap(dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? (/pass3-polish/.test(entry.name) ? fs.readdirSync(path.join(root, dir, entry.name)).map(name => `${dir}/${entry.name}/${name}`) : []) : [`${dir}/${entry.name}`]).filter(rel => /pass3-polish-f(?![\w])/.test(rel)) : [])
  deep(family.filter(rel => !PASS3_POLISH_F_SCOPE_FILES.has(rel)), [], a('no file of this change\'s family is missing from its list'))
  for (const rel of PASS3_POLISH_F_SCOPE_FILES) nomatch(rel, /^app\/admin|^components\/admin|^app\/docs|^components\/studio-docs|^app\/help|^components\/help|^app\/p\/|publish|published|^components\/settings|^app\/\(app\)\/settings|^app\/\(app\)\/billing|^components\/billing|user-profile-menu|^app\/\(app\)\/profile|^app\/\(app\)\/shortcuts|^components\/studio-personal\/(details|studio-p2-details|account)/, a(`${rel} is not in FRONTEND-1's areas`))
  const committed = ownCommitted()
  deep(committed.filter(rel => !PASS3_POLISH_F_SCOPE_FILES.has(rel)), [], a(`every file in this change's committed diff (${BASE.slice(0, 8)}..HEAD) is its own`))
  if (committed.length) {
    deep([...PASS3_POLISH_F_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    deep(committed.filter(rel => /^scripts\/test-/.test(rel)), [THIS_TEST], a('the only test it adds or edits is its own (no older test is edited)'))
    deep(committed.filter(rel => !/^scripts\//.test(rel)).sort(), [LAYOUT, CSS].sort(), a('the app files: the new stylesheet and the new Themes layout (no existing app file)'))
    deep(committed.filter(rel => /^scripts\//.test(rel) && rel !== THIS_TEST).sort(), [...PASS3_POLISH_F_OWN_EDITS, STRIP_MODULE].sort(), a('the other scripts: the registry and its own strip'))
    // a change registered after this one (LATER_CHANGE_FILES, other than this change's own files) may modify existing files of its own; this change's own commits modify the registry only
    const modified = git('diff', '--name-status', `${BASE}..HEAD`).split('\n').filter(line => /^[MDR]\t/.test(line)).map(line => line.split('\t').pop()).filter(rel => rel !== REGISTRY && !(LATER_CHANGE_FILES.has(rel) && !PASS3_POLISH_F_SCOPE_FILES.has(rel)))
    deep(modified, [], a('the committed diff modifies no existing file but the registry and the files of changes registered after this one (everything else is new)'))
  }
}
function proveSecretScan(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [CSS, LAYOUT, STRIP_MODULE, THIS_TEST].map(read).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added files'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
}

// ---------------------------------------------------------------- run everything
function proveAll(stripFn = stripPass3PolishF, at = '') {
  proveCss(read(CSS), at)
  proveFacts(at)
  const digest = proveLayout(read(LAYOUT), at)
  proveUntouched(at)
  proveStrip(stripFn, at)
  proveRegistry(read(REGISTRY), at)
  proveScope(at)
  proveSecretScan(at)
  return digest
}
const digest = proveAll()
console.log(`flag off (and on): the Themes page renders exactly as without the new layout in ${digest.states} flag states (sha256 ${digest.sha.slice(0, 16)}); every rule needs <html ${ATTR}="true">`)
console.log(`PASS stylesheet, facts, layout, untouched, change: ${checks} checks`)

// =========================================================== 6. mutants
const killed = [], survived = []
async function mutant(name, edits, { strip = stripPass3PolishF } = {}) {
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
    killed.push(name); if (process.env.PASS3_POLISH_F_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
const css = (from, to, mode) => [CSS, from, to, mode]
const HEAD = `  ${FONT_SELECTOR} {`
const LINE = read(LAYOUT).split('\n').find(marked)
// the stylesheet
await mutant('css: no room for the chevron (11px)', [css('    padding-right: 24px;', '    padding-right: 11px;')])
await mutant('css: clipped, not ellipsized', [css('    text-overflow: ellipsis;', '    text-overflow: clip;')])
await mutant('css: the selects are shrunk back to 12px (iOS would zoom again)', [css('    text-overflow: ellipsis;\n', '    text-overflow: ellipsis;\n    font-size: 12px;\n')])
await mutant('css: the fields are restacked (a redesign)', [css('    text-overflow: ellipsis;\n', '    text-overflow: ellipsis;\n    grid-column: 1 / -1;\n')])
await mutant('css: the chevron is replaced (appearance: none)', [css('    text-overflow: ellipsis;\n', '    text-overflow: ellipsis;\n    appearance: none;\n')])
await mutant('css: both paddings change', [css('    padding-right: 24px;', '    padding: 10px 24px;')])
await mutant('css: !important', [css('    padding-right: 24px;', '    padding-right: 24px !important;')])
await mutant('css: every select in the Studio', [css(HEAD, `  ${SHELLED} select${GUARD} {`)])
await mutant('css: every library select (Templates too)', [css(HEAD, HEAD.replace('[data-studio-library="themes"]', ''))])
await mutant('css: any descendant select of the group', [css(HEAD, HEAD.replace(' > label.sl-field > select', ' select'))])
await mutant('css: outside the shell', [css(HEAD, HEAD.replace(' [data-studio-v4-shell="true"]', ''))])
await mutant('css: without the attribute', [css(HEAD, HEAD.replace(`${SCOPE} `, ''))])
await mutant('css: the guard is gone', [css(HEAD, HEAD.replace(GUARD, ''))])
await mutant('css: the guard drops Settings', [css(HEAD, HEAD.replace('[data-studio-settings], ', ''))])
await mutant('css: the breakpoint is 768px', [css('@media (max-width: 640px) {', '@media (max-width: 768px) {')])
await mutant('css: a Settings rule slipped in', [css('  }\n}\n', `  }\n  ${SHELLED} [data-studio-settings] select {\n    padding-right: 24px;\n  }\n}\n`)])
await mutant('css: a rule outside any query', [css('/* ===== SECTION F1:', `${SHELLED} .x { color: red; }\n\n/* ===== SECTION F1:`)])
await mutant('PR E\'s E2 declarations drift (24px -> 20px)', [[E_CSS, '    padding-right: 24px;', '    padding-right: 20px;']])
await mutant('PR A\'s guard drifts (drops Publish)', [[A_CSS, '[data-studio-publish], [data-studio-publish-popup]', '[data-studio-publish-popup]', 'all']])
// the facts
await mutant('facts: the font group loses its attribute', [[THEMES, 'data-theme-font-fields="true"', 'data-theme-fonts="true"']])
await mutant('facts: the select is wrapped inside the label', [[THEMES, 'return <label className="sl-field">{label}<select value', 'return <label className="sl-field">{label}<span><select value']])
await mutant('facts: the Themes workspace id changes', [[THEMES, 'workspaceId="themes"', 'workspaceId="brand"']])
await mutant('facts: the page draws its own chevron', [[LIBRARIES_CSS, 'padding: 10px 11px; border-radius: 7px; font-size: 12px;', 'padding: 10px 11px; border-radius: 7px; font-size: 12px; appearance: none;']])
// the layout
await mutant('layout: the import loses its marker', [[LAYOUT, LINE, 'import "@/components/studio-pass3-polish/studio-pass3-polish-f.css"']])
await mutant('layout: the import is gone (Themes would not get F1)', [[LAYOUT, `${LINE}\n`, '']])
await mutant('layout: imports PR E\'s stylesheet instead', [[LAYOUT, 'studio-pass3-polish-f.css" // PASS3-POLISH-F', 'studio-pass3-polish-e.css" // PASS3-POLISH-F']])
await mutant('layout: wraps the page in a div', [[LAYOUT, '  return <>{children}</>', '  return <div>{children}</div>']])
await mutant('layout: reads the flag', [[LAYOUT, '  return <>{children}</>', "  if (process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH !== 'true') return <>{children}</>\n  return <>{children}</>"]])
await mutant('layout: becomes a client component', [[LAYOUT, 'import type { ReactNode } from "react"\n', '"use client"\nimport type { ReactNode } from "react"\n']])
await mutant('layout: draws something after the page', [[LAYOUT, '  return <>{children}</>', '  return <>{children}<i /></>']])
// the existing files
await mutant('account layout: takes the import too (PR E\'s proof would fail)', [[ACCOUNT, 'import { StudioPass3PolishMount } from "@/components/studio-pass3-polish/studio-pass3-polish-mount" // PASS3-POLISH\n', 'import { StudioPass3PolishMount } from "@/components/studio-pass3-polish/studio-pass3-polish-mount" // PASS3-POLISH\nimport "@/components/studio-pass3-polish/studio-pass3-polish-f.css" // PASS3-POLISH-F\n']])
await mutant('Themes page: takes the import (the library-manage pin would fail)', [[THEMES_PAGE, "import { ThemesWorkspace } from '@/components/studio-libraries/themes-workspace'\n", "import { ThemesWorkspace } from '@/components/studio-libraries/themes-workspace'\nimport '@/components/studio-pass3-polish/studio-pass3-polish-f.css' // PASS3-POLISH-F\n"]])
await mutant('PR E\'s stylesheet: edited instead', [[E_CSS, '    text-overflow: ellipsis;\n  }\n}\n', '    text-overflow: ellipsis;\n  }\n}\n.x { }\n']])
await mutant('flag: PR A\'s constant no longer needs the Studio shell', [[A_LIB, " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", '']])
// the strip, the registry
await mutant('strip: leaves the marked line', [], { strip: (rel, text) => text })
await mutant('strip: the marker is a substring', [], { strip: (rel, text) => (PASS3_POLISH_F_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes('PASS3-POLISH')).join('\n') : text) })
await mutant('strip: drops the trailing newline', [], { strip: (rel, text) => stripPass3PolishF(rel, text).replace(/\n$/, '') })
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-pass3-polish-f-strip.mjs')).PASS3_POLISH_F_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR F (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)\n", '']])
await mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-pass3-polish-f-strip.mjs')).stripPass3PolishF, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR F (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n", '']])
await mutant('secret scan: a credential-shaped literal', [[STRIP_MODULE, "export const PASS3_POLISH_F_MARKER = 'PASS3-POLISH-F'", `export const PASS3_POLISH_F_MARKER = 'PASS3-POLISH-F'\nconst ${['api', 'Key'].join('')} = '${['AKIA', 'ABCDEFGH', '12345678'].join('')}'`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.log('SURVIVED:\n  ' + survived.join('\n  ')); process.exit(1) }
console.log(`test-studio-pass3-polish-f: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
