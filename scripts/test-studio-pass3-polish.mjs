// FRONTEND-2 (PROGRAM-1 Saturday evening push, 24 Oct: the Pass 3 polish set, PR A): proof for the flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time; ONE flag for the whole set).
// PR A holds three findings of the static audit: (1) Decks / Knowledge on a phone: the 64px right gutter is 16px and the Replay-intro button sits in the flow; (2) iOS focus zoom: text controls are 16px on a phone;
// (3) the Builder root is 100dvh. All of it is one stylesheet, every rule scoped to <html data-studio-pass3-polish="true">, which a tiny client mount sets while a Studio route is on screen.
// Run: node scripts/test-studio-pass3-polish.mjs   (plain node: TypeScript transpiled and run in a vm, react-dom server render, postcss parse, `git show` reads the base commit; no network, no browser, no model call)
//
//   1. lib        the flag rule (exact "true", and only with the Studio shell); the attribute is set once, comes off with the LAST holder, and a holder that lets go twice counts once; only documentElement is read
//   2. hook+mount flag off: the effect returns before it touches the document (a document that throws on any access proves it); flag on: sets and removes the attribute; the stylesheet is imported once; the mount draws nothing
//   3. layout     flag off (and every misspelling, with the shell on and off): the account layout renders the base commit's tree byte for byte (sha256 over every state); flag on: the base tree plus the one mount
//   4. page pin   the Builder page and the layout without this change's marked lines are BASE_COMMIT's files byte for byte; every added line carries PASS3-POLISH; no base line changes; the Builder root line is the base's
//   5. stylesheet every rule starts with the attribute; the only at-rules are (max-width: 640px) and (height: 100dvh); each section's declarations are exactly the audit's (before -> after px); no rule targets
//                 FRONTEND-1's areas (they appear only inside the :not() guard, and the guard names all of them); buttons, labels and links are not in the text-control rule; the append point is last
//   6. change     the strip, the registry lines, the .env.example block, scope (the COMMITTED diff only: a polluted working tree changes nothing), a secret scan
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
import postcss from 'postcss'
import {
  BASE_COMMIT, PASS3_POLISH_BUILDER, PASS3_POLISH_ENV_BLOCK, PASS3_POLISH_FILES, PASS3_POLISH_LAYOUT, PASS3_POLISH_MARKER, PASS3_POLISH_SCOPE_FILES, stripPass3Polish,
} from './studio-pass3-polish-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const BASE = process.env.PASS3_POLISH_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
// This change's OWN committed files: the non-merge commits on the first-parent line BASE..HEAD. The working tree is never consulted (the suites of other changes write into docs/ and scripts/).
const ownCommitted = () => [...new Set(git('log', '--first-parent', '--no-merges', '--name-only', '--format=', `${BASE}..HEAD`).split('\n').filter(Boolean))]
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
let overrides = {} // in-memory mutations: every proof reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value))) // objects made inside the vm have the vm's prototypes

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), deep = count(assert.deepEqual), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const LIB = 'lib/studio-pass3-polish.ts', HOOK = 'hooks/use-studio-pass3-polish.ts', MOUNT = 'components/studio-pass3-polish/studio-pass3-polish-mount.tsx', CSS = 'components/studio-pass3-polish/studio-pass3-polish.css'
const LAYOUT = PASS3_POLISH_LAYOUT, PAGE = PASS3_POLISH_BUILDER, ENV = '.env.example', REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-pass3-polish-strip.mjs', THIS_TEST = 'scripts/test-studio-pass3-polish.mjs'
const FLAG = 'NEXT_PUBLIC_STUDIO_PASS3_POLISH', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', PALETTE = 'NEXT_PUBLIC_STUDIO_V4_TOKENS', ATTR = 'data-studio-pass3-polish'
const CSS_IMPORT = '@/components/studio-pass3-polish/studio-pass3-polish.css'
const SCOPE = `html[${ATTR}="true"]`
const PHONE = '(max-width: 640px)', DVH = '(height: 100dvh)'
// FRONTEND-1's areas, by the root attribute each carries: Settings (and the profile pages), Billing, Shortcuts, Your details, the account menu, Publish (dialog, wizard, popups, Q&A inbox), the published viewer and its
// ask panel, Admin, Docs, Help. The text-control rule keeps off them with a :not() guard; nothing else in the stylesheet may name one.
const ZONES = ['[data-studio-settings]', '[data-studio-billing]', '[data-studio-p2-shortcuts]', '[data-studio-personal="details"]', '[data-studio-v4-profile]', '[data-studio-publish]', '[data-studio-publish-popup]', '[data-studio-publish-wizard]', '[data-studio-qa-inbox]', '[data-studio-published-viewer]', '[data-studio-published-ask]', '[data-studio-published-qa]', '[data-studio-p2-admin]', '[data-studio-p2-docs]', '[data-studio-p2-help]', '[data-studio-help-content]']
const GUARD = `:not(:is(${ZONES.join(', ')}) *)`
const INPUT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="hidden"])'
const CE = '[contenteditable]:not([contenteditable="false"])'
const DECKS_KNOWLEDGE = 'main:is([data-studio-intro-surface="decks"], [data-studio-intro-surface="knowledge"])'

// ---------------------------------------------------------------- loading: the real TypeScript in a vm
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
function loadTs(rel, text, { env = {}, mocks = {}, globals = {} } = {}) {
  const module = { exports: {} }
  const req = spec => {
    if (Object.prototype.hasOwnProperty.call(mocks, spec)) return mocks[spec]
    if (spec === 'react/jsx-runtime') return jsxRuntime
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, text), { module, exports: module.exports, require: req, process: { env }, ...globals }, { filename: rel })
  return module.exports
}
const libOf = (env, text = read(LIB)) => loadTs(LIB, text, { env })

// a document stand-in: records every property read on documentElement and every attribute change
function fakeDocument() {
  const attrs = new Map(), log = [], reads = []
  const documentElement = { setAttribute(name, value) { attrs.set(name, value); log.push(['set', name, value]) }, removeAttribute(name) { attrs.delete(name); log.push(['remove', name]) } }
  const doc = new Proxy({ documentElement }, { get(target, key) { reads.push(String(key)); return target[key] } })
  return { doc, attrs, log, reads }
}
const throwingDocument = () => new Proxy({}, { get(_target, key) { throw new Error(`the document was read (${String(key)}) with the flag off`) }, has() { throw new Error('the document was probed with the flag off') } })

// ---------------------------------------------------------------- 1. the lib
const FLAG_VALUES = [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'truee', 'tru']
function proveLib(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  // the flag rule: exact "true", with the shell exactly "true"
  for (const flag of FLAG_VALUES) for (const shell of ['true', 'false', undefined, 'TRUE', '1']) {
    const lib = libOf({ ...(flag === undefined ? {} : { [FLAG]: flag }), ...(shell === undefined ? {} : { [SHELL]: shell }) }, text)
    eq(lib.STUDIO_PASS3_POLISH_ENABLED, flag === 'true' && shell === 'true', a(`flag ${JSON.stringify(flag)}, shell ${JSON.stringify(shell)}`))
  }
  eq(libOf({}, text).STUDIO_PASS3_POLISH_ATTR, ATTR, a('the attribute'))
  eq(libOf({ [FLAG]: 'true', [SHELL]: 'true' }, text).STUDIO_PASS3_POLISH_ENABLED, true, a('on'))
  // the attribute: set once; off with the LAST holder; a holder that lets go twice counts once; only documentElement is read
  {
    const lib = libOf({ [FLAG]: 'true', [SHELL]: 'true' }, text), d = fakeDocument()
    const first = lib.installPass3Polish(d.doc)
    deep([...d.attrs], [[ATTR, 'true']], a('install sets data-studio-pass3-polish="true"'))
    const second = lib.installPass3Polish(d.doc)
    first(); first()
    deep([...d.attrs], [[ATTR, 'true']], a('a holder that lets go twice does not take the attribute from the other'))
    second()
    deep([...d.attrs], [], a('the last holder takes it off'))
    second()
    eq(d.log.filter(entry => entry[0] === 'remove').length, 1, a('and it is removed once'))
    const third = lib.installPass3Polish(d.doc); third()
    deep([...d.attrs], [], a('a new install after a full release works and releases'))
    deep([...new Set(d.reads)], ['documentElement'], a('only documentElement is read'))
  }
  eq((text.match(/process\.env\./g) || []).length, 2, a('the lib reads exactly two variables'))
  match(text, new RegExp(`process\\.env\\.${FLAG} === 'true' && process\\.env\\.${SHELL} === 'true'`), a('exact "true" for both'))
  nomatch(text.replace(/^\s*(\/\/|\*|\/\*).*$/gm, ''), /\bimport\b|\brequire\(/, a('import-free'))
  nomatch(text.replace(/^\s*(\/\/|\*|\/\*).*$/gm, ''), /innerHTML|textContent|appendChild|removeChild|insertBefore|replaceChild|createElement|MutationObserver|addEventListener|setTimeout/, a('it only sets an attribute: no node, no text, no observer, no listener, no timer'))
}

// ---------------------------------------------------------------- 2. hook and mount
function proveHook(hookText, mountText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const run = (env, documentValue) => {
    const effects = [], imports = []
    const mocks = { react: { useEffect: (fn, deps) => { effects.push({ fn, deps }) } }, '@/lib/studio-pass3-polish': libOf(env) }
    Object.defineProperty(mocks, CSS_IMPORT, { enumerable: true, get() { imports.push(CSS_IMPORT); return {} } }) // recorded when the hook REQUIRES it
    const mod = loadTs(HOOK, hookText, { env, mocks, globals: { document: documentValue } })
    mod.useStudioPass3Polish()
    return { effects, imports }
  }
  for (const flag of FLAG_VALUES) for (const shell of ['true', 'false', undefined]) {
    const env = { ...(flag === undefined ? {} : { [FLAG]: flag }), ...(shell === undefined ? {} : { [SHELL]: shell }) }
    if (flag === 'true' && shell === 'true') continue
    const { effects } = run(env, throwingDocument())
    eq(effects.length, 1, a('one effect'))
    eq(effects[0].fn(), undefined, a(`flag ${JSON.stringify(flag)}, shell ${JSON.stringify(shell)}: the effect returns before it reads the document, and gives back no cleanup`))
  }
  {
    const d = fakeDocument()
    const { effects, imports } = run({ [FLAG]: 'true', [SHELL]: 'true' }, d.doc)
    deep(plain(effects[0].deps), [], a('an effect that runs once, on mount'))
    const cleanup = effects[0].fn()
    eq(typeof cleanup, 'function', a('flag on: the effect gives back its cleanup'))
    deep([...d.attrs], [[ATTR, 'true']], a('flag on: the attribute is set'))
    cleanup()
    deep([...d.attrs], [], a('and the cleanup takes it off'))
    deep(imports, [CSS_IMPORT], a('the stylesheet is imported once, by the hook'))
  }
  // the mount draws nothing and calls the hook once
  {
    let calls = 0
    const mod = loadTs(MOUNT, mountText, { mocks: { '@/hooks/use-studio-pass3-polish': { useStudioPass3Polish: () => { calls++ } } } })
    eq(mod.StudioPass3PolishMount(), null, a('the mount draws nothing'))
    eq(calls, 1, a('and calls the hook once'))
    match(mountText, /^"use client"/, a('the mount is a client component'))
    nomatch(mountText, /process\.env/, a('the mount reads no environment'))
  }
  nomatch(hookText, /process\.env/, a('the hook reads no environment (the flag is the lib\'s)'))
  eq((hookText.match(/^import '@\/components\/studio-pass3-polish\/studio-pass3-polish\.css'$/gm) || []).length, 1, a('the stylesheet import line'))
}

// ---------------------------------------------------------------- 3. the account layout
const LAYOUT_STATES = []
for (const flag of [undefined, 'false', 'TRUE', '1', 'yes', ' true', 'true']) for (const shell of ['true', 'false', undefined]) for (const palette of ['true', undefined]) LAYOUT_STATES.push({ flag, shell, palette, payments: undefined })
for (const flag of [undefined, 'true']) LAYOUT_STATES.push({ flag, shell: 'true', palette: 'true', payments: 'true' }) // and with the payments gate on (its mount sits beside this one)
function renderLayout(text, st, withMounts = true) {
  const env = { ...(st.flag === undefined ? {} : { [FLAG]: st.flag }), ...(st.shell === undefined ? {} : { [SHELL]: st.shell }), ...(st.palette === undefined ? {} : { [PALETTE]: st.palette }), ...(st.payments === undefined ? {} : { NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON: st.payments }) }
  const h = React.createElement
  const mocks = {
    './studio-v4-account.css': {}, '@/components/layout/studio-shell.css': {},
    '@/components/layout/app-header': { AppHeader: () => h('header', { id: 'header' }), BackToBuilderButton: () => h('button', { id: 'back' }) },
    '@/components/layout/studio-rail': { StudioRail: props => h('aside', { id: 'rail' }, props.studioEntry) },
    '@/lib/studio-payments-open-soon': { STUDIO_PAYMENTS_OPEN_SOON_ENABLED: env.NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON === 'true' },
    '@/components/billing/studio-payments-open-soon-mount': { StudioPaymentsOpenSoonMount: () => h('i', { 'data-mount': 'payments' }) },
    '@/lib/studio-duplicate-copy-title': { STUDIO_DUPLICATE_COPY_TITLE_ENABLED: env.NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE === 'true' },
    '@/components/builder/studio-duplicate-copy-title-mount': { StudioDuplicateCopyTitleMount: () => h('i', { 'data-mount': 'dup' }) },
    '@/lib/studio-pass3-polish': libOf(env),
    '@/components/studio-pass3-polish/studio-pass3-polish-mount': { StudioPass3PolishMount: () => h('i', { 'data-mount': 'pass3' }) },
  }
  const mod = loadTs(LAYOUT, text, { env, mocks })
  return renderToStaticMarkup(mod.default({ children: 'page' }))
}
const baseRenders = new Map()
function proveLayout(layoutText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const base = baseOf(LAYOUT)
  const baseOut = [], headOut = []
  for (const st of LAYOUT_STATES) {
    const key = JSON.stringify(st)
    if (!baseRenders.has(key)) baseRenders.set(key, renderLayout(base, st))
    const baseHtml = baseRenders.get(key), headHtml = renderLayout(layoutText, st)
    const on = st.flag === 'true' && st.shell === 'true'
    if (!on) eq(headHtml, baseHtml, a(`layout, ${JSON.stringify(st)}: the base commit's tree`))
    else {
      eq((headHtml.match(/data-mount="pass3"/g) || []).length, 1, a(`layout, ${JSON.stringify(st)}: the mount is drawn once`))
      eq(headHtml.replace('<i data-mount="pass3"></i>', ''), baseHtml, a(`layout, ${JSON.stringify(st)}: the base tree plus the one mount`))
      ok(headHtml.indexOf('data-mount="pass3"') > headHtml.indexOf('id="header"'), a('the mount sits after the shell column'))
    }
    baseOut.push(baseHtml); if (!on) headOut.push(headHtml)
  }
  const baseOff = LAYOUT_STATES.map((st, i) => (st.flag === 'true' && st.shell === 'true' ? null : baseOut[i])).filter(value => value !== null)
  eq(sha(headOut.join('\n')), sha(baseOff.join('\n')), a('flag off: sha256 over every state is the base commit\'s'))
  return { base: sha(baseOff.join('\n')), head: sha(headOut.join('\n')), states: headOut.length }
}

// ---------------------------------------------------------------- 4. the page pin (the Builder page and the account layout)
function provePin(rel, text, expectedMarked, at = '', stripFn = stripPass3Polish) {
  const a = message => (at ? `${at}: ${rel}: ${message}` : `${rel}: ${message}`)
  const base = baseOf(rel)
  const stripped = stripFn(rel, text)
  eq(sha(stripped), sha(base), a('without this change\'s lines it is the base commit\'s file, byte for byte'))
  ok(!stripped.includes(PASS3_POLISH_MARKER), a('the stripped file carries no marker'))
  ok(!base.includes(PASS3_POLISH_MARKER), a('the base never carried the marker'))
  const lines = text.split('\n'), baseLines = base.split('\n')
  const marked = lines.filter(line => line.includes(PASS3_POLISH_MARKER))
  eq(marked.length, expectedMarked, a(`exactly ${expectedMarked} lines are this change's`))
  const have = new Map()
  for (const line of baseLines) have.set(line, (have.get(line) ?? 0) + 1)
  const added = []
  for (const line of lines) { const n = have.get(line) ?? 0; if (n > 0) have.set(line, n - 1); else added.push(line) }
  ok(added.every(line => line.includes(PASS3_POLISH_MARKER)), a(`every added line carries the marker (unmarked: ${JSON.stringify(added.filter(line => !line.includes(PASS3_POLISH_MARKER)))})`))
  eq(added.length, marked.length, a('and every marked line is an added one'))
  eq([...have.values()].reduce((sum, n) => sum + n, 0), 0, a('no base line is changed or removed'))
  let next = 0
  for (const line of lines) if (next < baseLines.length && line === baseLines[next]) next++
  eq(next, baseLines.length, a('the base lines are all there, in order'))
  nomatch(text.replace(/^\s*\/\/.*$/gm, '').replace(/\/\/ .*$/gm, ''), new RegExp(`process\\.env\\.${FLAG}`), a('the file does not read the flag itself (the lib does)'))
  return { lines, marked }
}
function provePage(text, at = '', stripFn = stripPass3Polish) {
  const { lines, marked } = provePin(PAGE, text, 3, at, stripFn)
  const a = message => (at ? `${at}: ${PAGE}: ${message}` : `${PAGE}: ${message}`)
  match(marked[0], /^\/\/ NEXT_PUBLIC_STUDIO_PASS3_POLISH \(default off\): .* \/\/ PASS3-POLISH$/, a('the import\'s comment'))
  eq(marked[1], "import { useStudioPass3Polish } from '@/hooks/use-studio-pass3-polish' // PASS3-POLISH", a('the import'))
  match(marked[2], /^ {2}useStudioPass3Polish\(\) \/\/ PASS3-POLISH: /, a('the hook call, two spaces in: at the top level of the component'))
  // the hook runs straight after the payments hook (the same pattern), unconditionally
  const at2 = lines.indexOf(marked[2])
  eq(lines[at2 - 1], '  useStudioPaymentsOpenSoon()', a('the call sits straight after the payments hook'))
  match(lines[at2 - 2], /^ {2}\/\/ NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON \(default off\): /, a('and that hook keeps its own comment above it'))
  // the Builder root line, byte for byte the base's, and the only element carrying both the shell attribute and h-screen (what the stylesheet's section 3 hangs on)
  const baseLines = baseOf(PAGE).split('\n')
  const rootsHead = lines.filter(line => line.includes('data-studio-v4-shell={studioShell ? "true" : undefined}') && /\bh-screen\b/.test(line))
  const rootsBase = baseLines.filter(line => line.includes('data-studio-v4-shell={studioShell ? "true" : undefined}') && /\bh-screen\b/.test(line))
  eq(rootsHead.length, 1, a('one element carries the shell attribute and h-screen'))
  deep(rootsHead, rootsBase, a('and it is the base commit\'s line, untouched'))
  match(rootsHead[0], /className="flex h-screen w-screen overflow-hidden /, a('the root is `flex h-screen w-screen overflow-hidden`'))
  eq(lines.filter(line => /\bh-screen\b/.test(line) && !/min-h-screen|max-h-screen/.test(line)).length, 1, a('and no other plain h-screen in the page'))
}
function proveLayoutPin(text, at = '', stripFn = stripPass3Polish) {
  const { marked } = provePin(LAYOUT, text, 4, at, stripFn)
  const a = message => (at ? `${at}: ${LAYOUT}: ${message}` : `${LAYOUT}: ${message}`)
  match(marked[0], /^\/\/ NEXT_PUBLIC_STUDIO_PASS3_POLISH \(default off\): .* \/\/ PASS3-POLISH$/, a('the comment'))
  eq(marked[1], 'import { STUDIO_PASS3_POLISH_ENABLED } from "@/lib/studio-pass3-polish" // PASS3-POLISH', a('the flag import'))
  eq(marked[2], 'import { StudioPass3PolishMount } from "@/components/studio-pass3-polish/studio-pass3-polish-mount" // PASS3-POLISH', a('the mount import'))
  eq(marked[3], '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}', a('the mount line: drawn only with the flag on, and no whitespace text node beside the comment'))
}

// ---------------------------------------------------------------- 5. the stylesheet
const splitTop = (selector) => { // a selector list split at top-level commas
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
const withoutNots = (selector) => { // every :not(...) group taken out (balanced)
  let out = '', i = 0
  while (i < selector.length) {
    if (selector.startsWith(':not(', i)) { let depth = 0, j = i + 4; for (; j < selector.length; j++) { if (selector[j] === '(') depth++; else if (selector[j] === ')') { depth--; if (depth === 0) break } } i = j + 1; continue }
    out += selector[i]; i++
  }
  return out
}
function parseCss(text) {
  const root = postcss.parse(text)
  const sections = [], rules = []
  let current = null, appendPointAt = -1, order = 0
  for (const node of root.nodes) {
    if (node.type === 'comment') {
      const m = /^={5} SECTION (\d+): (.+?) ={5}$/.exec(node.text.trim())
      if (m) { current = { n: Number(m[1]), title: m[2], atRules: [] }; sections.push(current) }
      if (/^={5} APPEND POINT: /.test(node.text.trim())) appendPointAt = order
    } else if (node.type === 'atrule') {
      if (!current) throw new Error('an at-rule before the first section')
      const entry = { name: node.name, params: node.params, rules: [] }
      node.walkRules(rule => entry.rules.push({ selectors: splitTop(rule.selector), selector: rule.selector, decls: rule.nodes.filter(n => n.type === 'decl').map(d => ({ prop: d.prop, value: d.value, important: Boolean(d.important) })) }))
      current.atRules.push(entry); rules.push(...entry.rules)
    } else if (node.type === 'rule') throw new Error(`a rule outside any at-rule: ${node.selector.slice(0, 80)}`)
    order++
  }
  return { sections, rules, appendPointAt, nodeCount: root.nodes.length, root }
}
const declMap = (rule) => Object.fromEntries(rule.decls.map(d => [d.prop, `${d.value}${d.important ? ' !important' : ''}`]))
function proveCss(text, at = '') {
  const a = message => (at ? `${at}: css: ${message}` : `css: ${message}`)
  const css = parseCss(text)
  // sections 1 to 3 in order, then the append point as the last node
  deep(css.sections.map(section => section.n), [1, 2, 3], a('sections 1, 2, 3, in order'))
  deep(css.sections.map(section => section.title), ['destination intros (Decks, Knowledge) on a phone', 'iOS focus zoom (text controls are 16px on a phone)', 'the Builder root is 100dvh'], a('their titles'))
  eq(css.appendPointAt, css.nodeCount - 1, a('the APPEND POINT comment is the last node of the file: later sections go above it'))
  eq(css.rules.length, 6, a('six rules in all: two in section 1, three in 2, one in 3'))
  // the scope rule: every selector of every rule starts with the attribute, and the only at-rules are the phone query and the dvh support query
  for (const rule of css.rules) for (const selector of rule.selectors) ok(selector.startsWith(`${SCOPE} `), a(`every selector starts with ${SCOPE}: ${selector.slice(0, 90)}`))
  deep(css.sections.map(section => section.atRules.map(entry => `@${entry.name} ${entry.params}`)), [[`@media ${PHONE}`], [`@media ${PHONE}`], [`@supports ${DVH}`]], a('the media query values: (max-width: 640px) twice, @supports (height: 100dvh) once, nothing else'))
  nomatch(text.replace(/\/\*[\s\S]*?\*\//g, ''), /@import|@font-face|@keyframes|url\(|expression\(|behavior:/, a('no import, font, animation or url()'))
  const [s1, s2, s3] = css.sections
  // section 1: Decks / Knowledge on a phone
  eq(s1.atRules[0].rules.length, 2, a('section 1: two rules'))
  deep(s1.atRules[0].rules[0].selectors, [`${SCOPE} [data-studio-v4-shell="true"] ${DECKS_KNOWLEDGE}`], a('section 1: the gutter rule is for the Decks and Knowledge pages\' main only, inside the shell'))
  deep(declMap(s1.atRules[0].rules[0]), { 'padding-inline-end': '16px', 'padding-bottom': '28px' }, a('section 1: the gutter 64px -> 16px, the bottom padding 52px -> 28px'))
  deep(s1.atRules[0].rules[1].selectors, [`${SCOPE} [data-studio-v4-shell="true"] ${DECKS_KNOWLEDGE} > [data-studio-intro-replay="true"].studio-destination-intro-replay`], a('section 1: the button rule is for the Replay-intro button, a direct child of those pages\' main'))
  deep(declMap(s1.atRules[0].rules[1]), { position: 'static', margin: '12px 0 0 auto' }, a('section 1: the Replay-intro button fixed -> in the flow, right-aligned'))
  // section 2: the text controls
  const rules2 = s2.atRules[0].rules
  eq(rules2.length, 3, a('section 2: three rules'))
  deep(rules2[0].selectors, [`${SCOPE} :is(${INPUT}, select, textarea, ${CE})${GUARD}`], a('section 2: the font-size rule: text inputs, native selects, textareas, contenteditable, behind the guard'))
  deep(declMap(rules2[0]), { 'font-size': '16px !important' }, a('section 2: font size 16px'))
  deep(rules2[1].selectors, [`${SCOPE} :is(textarea, ${CE})${GUARD}`], a('section 2: the textarea line-height rule'))
  deep(declMap(rules2[1]), { 'line-height': '1.5 !important' }, a('section 2: textareas keep a 1.5 line'))
  deep(rules2[2].selectors, [`${SCOPE} ${INPUT}${GUARD}`], a('section 2: the input line-height rule'))
  deep(declMap(rules2[2]), { 'line-height': '1.35 !important' }, a('section 2: inputs get a 1.35 line'))
  for (const rule of rules2) {
    const props = rule.decls.map(d => d.prop)
    ok(props.every(prop => prop === 'font-size' || prop === 'line-height'), a('section 2 changes the font size and the line height and nothing else (no padding, height, width)'))
    const bare = withoutNots(rule.selectors[0])
    nomatch(bare, /button|label|\ba\b|svg|summary|\[role|\[href|\bimg\b|\bicon\b|option|\bli\b|\[class|\.[a-z]/, a(`the control list names no button, label, link, icon or class: ${bare.slice(0, 80)}`))
    nomatch(bare, /admin|settings|billing|shortcut|profile|details|publish|published|docs|help|qa-inbox|\/p\b|account/, a('no FRONTEND-1 area is named outside the :not() guard'))
    ok(rule.selectors[0].endsWith(GUARD), a('every section 2 rule ends with the guard that names all sixteen FRONTEND-1 roots'))
  }
  // the guard names every FRONTEND-1 root, and nothing else in the stylesheet (outside comments) names one
  for (const zone of ZONES) ok(text.replace(/\/\*[\s\S]*?\*\//g, '').includes(zone), a(`the guard names ${zone}`))
  for (const rule of css.rules.filter(r => !rules2.includes(r))) nomatch(rule.selector, /admin|settings|billing|shortcut|profile|details|publish|published|docs|help|qa-inbox|account/, a('a rule outside section 2 names no FRONTEND-1 area'))
  // section 3: the Builder root
  eq(s3.atRules[0].rules.length, 1, a('section 3: one rule'))
  deep(s3.atRules[0].rules[0].selectors, [`${SCOPE} [data-studio-v4-shell="true"].h-screen`], a('section 3: the Builder root: the shell attribute and h-screen on one element'))
  deep(declMap(s3.atRules[0].rules[0]), { height: '100dvh' }, a('section 3: 100vh -> 100dvh'))
  // !important lives in section 2 only
  for (const section of [s1, s3]) for (const entry of section.atRules) for (const rule of entry.rules) ok(rule.decls.every(d => !d.important), a('no !important outside section 2'))
  ok(!/<html[^>]*data-studio-pass3-polish/.test(text), a('(the stylesheet sets no attribute)'))
  return css
}
// what the stylesheet's "before" values are in the base commit (the report's before -> after table is true)
function proveBefore() {
  const intros = baseOf('components/studio-libraries/destination-intros.css'), decks = baseOf('components/builder/studio-decks.css'), popups = baseOf('components/builder/studio-composer-popups-v2.css'), shell = baseOf('components/layout/studio-shell.css')
  match(intros, /main:is\(\[data-studio-intro-surface="decks"\], \[data-studio-intro-surface="knowledge"\]\) \{\n  padding-inline-end: 64px;\n\}/, 'before: the base gutter is 64px')
  match(intros, /> \[data-studio-intro-replay="true"\]\.studio-destination-intro-replay \{\n  position: fixed;\n  right: 22px;\n  bottom: 20px;\n\}/, 'before: the base Replay-intro button is fixed, 22px from the right and 20px from the bottom')
  match(intros, /padding-bottom: 52px;/, 'before: the base reserves 52px of bottom padding for the corner')
  match(decks, /@media \(max-width: 640px\) \{\n  \[data-studio-v4-shell="true"\] \[data-studio-decks\] \{ padding: 20px 16px 28px; \}/, 'before: the Decks page\'s own phone padding is 20px 16px 28px')
  match(popups, /textarea\[data-studio-v4-type-role="prompt"\] \{ font-size: 12px; line-height: 18px; \}/, 'before: the Director prompt is 12px / 18px')
  match(popups, /textarea\[data-studio-v4-type-role="prompt"\] \{ font-size: 13\.6px; line-height: 20px; \}/, 'before: and 13.6px / 20px with the Studio type scale')
  match(baseOf('components/builder/studio-director.css'), /\[data-studio-composer-menu\] :is\(input,select\) \{[^}]*font-size: 11\.5px;/, 'before: the composer menus\' inputs are 11.5px')
  match(decks, /\[data-studio-deck-search\] input \{[^}]*font-size: 13px;/, 'before: the Decks search is 13px')
  match(shell, /\[data-studio-v4-rail\] \{[^}]*height: 100dvh;/, 'before: the rail is already 100dvh')
}

// ---------------------------------------------------------------- 6. the change: strip, registry, env block, scope, secret scan
function proveChange(stripFn, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  eq(stripFn('lib/other.ts', 'x // PASS3-POLISH'), 'x // PASS3-POLISH', a('any other file is returned as it is'))
  eq(stripFn(ENV, 'a\nb // PASS3-POLISH\n'), 'a\nb // PASS3-POLISH\n', a('.env.example is returned as it is (its block is the registry\'s)'))
  eq(stripFn(PAGE, 'a\nb // PASS3-POLISH\nc\n'), 'a\nc\n', a('a marked line goes, every other byte stays (trailing newline too)'))
  eq(stripFn(LAYOUT, 'a\n{x}{/* PASS3-POLISH */}\nc'), 'a\nc', a('the layout the same'))
  eq(stripFn(PAGE, stripFn(PAGE, read(PAGE))), stripFn(PAGE, read(PAGE)), a('stripping twice changes nothing more'))
  eq(stripFn(PAGE, 7), 7, a('a non-string comes back'))
  deep(PASS3_POLISH_FILES, [LAYOUT, PAGE], a('the strip touches the account layout and the Builder page only'))
  for (const rel of PASS3_POLISH_FILES) eq(sha(stripFn(rel, read(rel))), sha(baseOf(rel)), a(`${rel}: the strip gives the base commit's file`))
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const lines = registryText.split('\n').filter(line => line.includes("'./studio-pass3-polish-strip.mjs'"))
  eq(lines.length, 3, a('the registry has exactly three lines for this change: its files, its block, its strip'))
  ok(lines.every(line => line.includes('// LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR A (NEXT_PUBLIC_STUDIO_PASS3_POLISH)')), a('each carries the LATER-CHANGE marker'))
  match(lines[0], /\.\.\.\(await import\('\.\/studio-pass3-polish-strip\.mjs'\)\)\.PASS3_POLISH_SCOPE_FILES,/, a('line 1: the files'))
  match(lines[1], /\(await import\('\.\/studio-pass3-polish-strip\.mjs'\)\)\.PASS3_POLISH_ENV_BLOCK,/, a('line 2: the env block'))
  match(lines[2], /\(await import\('\.\/studio-pass3-polish-strip\.mjs'\)\)\.stripPass3Polish,/, a('line 3: the strip'))
  eq(registryText.indexOf(lines[0]) < registryText.indexOf('export const LATER_ENV_BLOCKS') && registryText.indexOf(lines[1]) > registryText.indexOf('export const LATER_ENV_BLOCKS') && registryText.indexOf(lines[1]) < registryText.indexOf('export const LATER_STRIPS') && registryText.indexOf(lines[2]) > registryText.indexOf('export const LATER_STRIPS'), true, a('each line is in its own list'))
}
function proveEnv(envText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const block = PASS3_POLISH_ENV_BLOCK
  match(block, new RegExp(`^# STUDIO PASS 3 POLISH [\\s\\S]*\\n${FLAG}="false"\\n\\n$`), a('the block: its own flag documented "false", a blank line after it'))
  eq((block.match(/^[A-Z][A-Z0-9_]*=/gm) ?? []).length, 1, a('it assigns one variable'))
  ok(block.split('\n').filter(line => line.startsWith('#')).every(line => line.length <= 200), a('its comment lines are of the usual width'))
  for (const word of ['default off', 'Build-time', 'Vercel', 'NEXT_PUBLIC_STUDIO_V4_SHELL', 'data-studio-pass3-polish="true"', '640 px', '64 px', '16 px', '52 px', '28 px', '13.6 px', '11.5 px', '1.5', '1.35', '100dvh', 'Settings and profile pages', 'Billing', 'Publish', 'Admin', 'Docs and Help']) ok(block.includes(word), a(`the block says "${word}"`))
  const trimmed = block.replace(/\n+$/, '\n')
  eq(envText.split(trimmed).length - 1, 1, a('.env.example has the block exactly once'))
  ok(envText.indexOf(trimmed) > envText.indexOf('# DECK CARD THUMBNAILS'), a('after the last block that was there'))
  const without = envText.replace(`\n${trimmed}`, '')
  eq(sha(without), sha(baseOf(ENV)), a('.env.example without the block (and its separating blank line) is the base commit\'s, byte for byte'))
  eq(sha(stripLaterChanges(ENV, envText)), sha(stripLaterChanges(ENV, baseOf(ENV))), a('and the registry takes it out the same way'))
}
function proveRegistryStripsToBase(texts, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of [LAYOUT, PAGE, ENV]) eq(sha(stripLaterChanges(rel, texts[rel])), sha(stripLaterChanges(rel, baseOf(rel))), a(`${rel}: through the registry (innermost, as every older pin reads it) it is the base commit's file`))
  ok(LATER_STRIPS.includes(stripPass3Polish) || LATER_STRIPS.some(fn => fn.name === 'stripPass3Polish'), a('the registry holds the strip'))
  ok(LATER_ENV_BLOCKS.includes(PASS3_POLISH_ENV_BLOCK), a('the registry holds the env block'))
  ok([...PASS3_POLISH_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('the registry names every file of this change'))
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  ok([...PASS3_POLISH_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
  const family = ['lib', 'hooks', 'components', 'scripts'].flatMap(dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? (/pass3-polish/.test(entry.name) ? fs.readdirSync(path.join(root, dir, entry.name)).map(name => `${dir}/${entry.name}/${name}`) : []) : (/pass3-polish/.test(entry.name) ? [`${dir}/${entry.name}`] : [])) : [])
  deep(family.filter(rel => !PASS3_POLISH_SCOPE_FILES.has(rel)), [], a('no file of this change\'s family is missing from its list'))
  // FRONTEND-1's areas: not one file of this change is in them
  for (const rel of PASS3_POLISH_SCOPE_FILES) nomatch(rel, /^app\/admin|^components\/admin|^app\/docs|^components\/studio-docs|^app\/help|^components\/help|^app\/p\/|publish|published|^components\/settings|^app\/\(app\)\/settings|^app\/\(app\)\/billing|^components\/billing|user-profile-menu|^app\/\(app\)\/profile|^app\/\(app\)\/shortcuts|^components\/studio-personal\/(details|studio-p2-details|account)/, a(`${rel} is not in FRONTEND-1's areas`))
  // the committed diff only
  const committed = ownCommitted()
  const stray = committed.filter(rel => !PASS3_POLISH_SCOPE_FILES.has(rel) && !LATER_CHANGE_FILES.has(rel))
  deep(stray, [], a(`every file in the committed diff ${BASE.slice(0, 8)}..HEAD is this change's or a registered later change's (no older test is edited)`))
  if (committed.length) {
    deep([...PASS3_POLISH_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    ok(committed.filter(rel => /^scripts\/test-/.test(rel)).every(rel => rel === THIS_TEST || LATER_CHANGE_FILES.has(rel)), a('the only test it adds or edits is its own'))
  }
}
function proveSecretScan(texts, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [LIB, HOOK, MOUNT, CSS, STRIP_MODULE, THIS_TEST].map(rel => (rel in texts ? texts[rel] : read(rel))).concat(texts[PAGE].split('\n').filter(line => line.includes(PASS3_POLISH_MARKER)), texts[LAYOUT].split('\n').filter(line => line.includes(PASS3_POLISH_MARKER))).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
}

// ---------------------------------------------------------------- run everything
function proveAll(stripFn = stripPass3Polish, at = '') {
  const texts = { [LAYOUT]: read(LAYOUT), [PAGE]: read(PAGE), [ENV]: read(ENV) }
  proveLib(read(LIB), at)
  proveHook(read(HOOK), read(MOUNT), at)
  const digest = proveLayout(texts[LAYOUT], at)
  provePage(texts[PAGE], at, stripFn)
  proveLayoutPin(texts[LAYOUT], at, stripFn)
  proveCss(read(CSS), at)
  proveChange(stripFn, at)
  proveRegistry(read(REGISTRY), at)
  proveEnv(texts[ENV], at)
  proveRegistryStripsToBase(texts, at)
  proveScope(at)
  proveSecretScan(texts, at)
  return digest
}
proveBefore()
const digest = proveAll()
console.log(`flag off: ${digest.states} layout states, sha256 base ${digest.base.slice(0, 16)} == head ${digest.head.slice(0, 16)}`)
console.log(`PASS lib, hook, layout, page pin, stylesheet, change: ${checks} checks`)

// =========================================================== 7. mutants
const killed = [], survived = []
async function mutant(name, edits, { strip = stripPass3Polish } = {}) {
  const before = overrides
  try {
    overrides = { ...before }
    for (const [rel, from, to, mode] of edits) { // mode: none = the text occurs once; 'first' = the first of several; 'all' = every one
      const source = read(rel), n = source.split(from).length - 1
      assert.ok(mode ? n >= 1 : n === 1, `mutant "${name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = mode === 'all' ? source.split(from).join(to) : source.replace(from, () => to)
    }
    proveAll(strip, name)
  } catch (error) {
    if (/no longer applies/.test(String(error.message))) throw error
    killed.push(name); if (process.env.PASS3_POLISH_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
const sel = (from, to, mode) => [CSS, from, to, mode]

// the stylesheet
await mutant('css: the phone breakpoint of section 1 is 641px', [sel(`@media ${PHONE} {\n  html[${ATTR}="true"] [data-studio-v4-shell="true"] main:is(`, `@media (max-width: 641px) {\n  html[${ATTR}="true"] [data-studio-v4-shell="true"] main:is(`)])
await mutant('css: the phone breakpoint of section 2 is 768px', [sel(`@media ${PHONE} {\n  html[${ATTR}="true"] :is(input`, `@media (max-width: 768px) {\n  html[${ATTR}="true"] :is(input`)])
await mutant('css: a rule outside the attribute scope', [sel('  html[data-studio-pass3-polish="true"] [data-studio-v4-shell="true"].h-screen {', '  [data-studio-v4-shell="true"].h-screen {')])
await mutant('css: the gutter is 24px', [sel('padding-inline-end: 16px;', 'padding-inline-end: 24px;')])
await mutant('css: the gutter is left at 64px', [sel('padding-inline-end: 16px;', 'padding-inline-end: 64px;')])
await mutant('css: the Replay-intro button stays fixed', [sel('    position: static;', '    position: fixed;')])
await mutant('css: the controls are 15px', [sel('font-size: 16px !important;', 'font-size: 15px !important;')])
await mutant('css: the font size loses its !important', [sel('font-size: 16px !important;', 'font-size: 16px;')])
await mutant('css: the first rule\'s guard drops Settings', [sel('[data-studio-settings], [data-studio-billing]', '[data-studio-billing]', 'first')])
await mutant('css: the last rule\'s guard drops Settings', [sel(`${INPUT}${GUARD} {`, `${INPUT}${GUARD.replace('[data-studio-settings], ', '')} {`)])
await mutant('css: every guard drops Publish', [sel('[data-studio-publish], [data-studio-publish-popup]', '[data-studio-publish-popup]', 'all')])
await mutant('css: every guard drops Admin, Docs and Help', [sel('[data-studio-p2-admin], [data-studio-p2-docs], [data-studio-p2-help], [data-studio-help-content]', '[data-studio-help-content]', 'all')])
await mutant('css: the input line-height rule loses its guard', [sel(`${INPUT}${GUARD} {\n    line-height: 1.35 !important;`, `${INPUT} {\n    line-height: 1.35 !important;`)])
await mutant('css: buttons are in the control list', [sel(`select, textarea, ${CE})${GUARD} {\n    font-size`, `select, textarea, button, ${CE})${GUARD} {\n    font-size`)])
await mutant('css: labels are in the control list', [sel(`select, textarea, ${CE})${GUARD} {\n    font-size`, `select, textarea, label, ${CE})${GUARD} {\n    font-size`)])
await mutant('css: section 2 changes the padding too', [sel('    line-height: 1.5 !important;\n', '    line-height: 1.5 !important;\n    padding: 12px !important;\n')])
await mutant('css: the textarea line is 1.25', [sel('line-height: 1.5 !important;', 'line-height: 1.25 !important;')])
await mutant('css: the Builder root is 100vh again', [sel('    height: 100dvh;', '    height: 100vh;')])
await mutant('css: the Builder rule is not under @supports', [sel('@supports (height: 100dvh) {', '@media (min-width: 1px) {')])
await mutant('css: the Builder rule hits w-screen, not h-screen', [sel('[data-studio-v4-shell="true"].h-screen {', '[data-studio-v4-shell="true"].w-screen {')])
await mutant('css: the Builder rule hits every h-screen, shell or not', [sel('[data-studio-v4-shell="true"].h-screen {', '.h-screen {')])
await mutant('css: a Settings rule slipped in', [sel('/* ===== APPEND POINT:', `@media ${PHONE} {\n  html[${ATTR}="true"] [data-studio-settings] input {\n    font-size: 16px;\n  }\n}\n\n/* ===== APPEND POINT:`)])
await mutant('css: the append point is not last', [sel('every rule starts with html[data-studio-pass3-polish="true"] ===== */\n', 'every rule starts with html[data-studio-pass3-polish="true"] ===== */\n.x { }\n')])
await mutant('css: section 1 uses !important', [sel('padding-bottom: 28px;', 'padding-bottom: 28px !important;')])

// the lib, the hook, the mount
await mutant('lib: the flag rule loosened to anything set', [[LIB, `process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true'`, `Boolean(process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH)`]])
await mutant('lib: the Studio shell is not required', [[LIB, ` && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'`, '']])
await mutant('lib: the attribute is renamed', [[LIB, `export const STUDIO_PASS3_POLISH_ATTR = 'data-studio-pass3-polish'`, `export const STUDIO_PASS3_POLISH_ATTR = 'data-studio-polish'`]])
await mutant('lib: a holder that lets go twice counts twice', [[LIB, '    if (released) return\n    released = true\n', '']])
await mutant('lib: the attribute comes off with the first holder', [[LIB, '    if (holders <= 0) {\n      holders = 0\n      root.removeAttribute(STUDIO_PASS3_POLISH_ATTR)\n    }', '    root.removeAttribute(STUDIO_PASS3_POLISH_ATTR)']])
await mutant('lib: a node is appended', [[LIB, '  root.setAttribute(STUDIO_PASS3_POLISH_ATTR, \'true\')\n', '  root.setAttribute(STUDIO_PASS3_POLISH_ATTR, \'true\')\n  void (root as any).appendChild\n']])
await mutant('hook: the effect reads the document before the flag', [[HOOK, '    if (!STUDIO_PASS3_POLISH_ENABLED) return\n    return installPass3Polish(document)', '    const root = document.documentElement\n    if (!STUDIO_PASS3_POLISH_ENABLED) return\n    return installPass3Polish(document)']])
await mutant('hook: the flag check is gone', [[HOOK, '    if (!STUDIO_PASS3_POLISH_ENABLED) return\n', '']])
await mutant('hook: the cleanup is not returned', [[HOOK, '    return installPass3Polish(document)', '    installPass3Polish(document)']])
await mutant('hook: the stylesheet import is gone', [[HOOK, "import '@/components/studio-pass3-polish/studio-pass3-polish.css'\n", '']])
await mutant('hook: the effect runs on every render', [[HOOK, '  }, [])', '  })']])
await mutant('mount: it draws a node', [[MOUNT, '  return null', '  return <i />']])

// the layout and the Builder page
await mutant('layout: the mount is drawn with the flag off', [[LAYOUT, '{STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}', '{<StudioPass3PolishMount />}{/* PASS3-POLISH */}']])
await mutant('layout: the mount is never drawn', [[LAYOUT, '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}\n', '']])
await mutant('layout: a whitespace text node beside the comment', [[LAYOUT, '<StudioPass3PolishMount />}{/* PASS3-POLISH */}', '<StudioPass3PolishMount />} {/* PASS3-POLISH */}']])
await mutant('layout: a marker taken off the flag import', [[LAYOUT, 'from "@/lib/studio-pass3-polish" // PASS3-POLISH', 'from "@/lib/studio-pass3-polish"']])
await mutant('layout: an unmarked line added', [[LAYOUT, '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}\n', '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}\n      <span />\n']])
await mutant('layout: a base line changed', [[LAYOUT, 'className="min-h-screen bg-slate-50 dark:bg-slate-950"', 'className="min-h-screen bg-slate-100 dark:bg-slate-950"']])
await mutant('page: the marker taken off the hook call', [[PAGE, '  useStudioPass3Polish() // PASS3-POLISH: NEXT_PUBLIC', '  useStudioPass3Polish() // NEXT_PUBLIC']])
await mutant('page: an unmarked line added', [[PAGE, "import { useStudioPass3Polish } from '@/hooks/use-studio-pass3-polish' // PASS3-POLISH\n", "import { useStudioPass3Polish } from '@/hooks/use-studio-pass3-polish' // PASS3-POLISH\nconst unmarked = 1\n"]])
await mutant('page: the hook called conditionally', [[PAGE, '  useStudioPass3Polish() // PASS3-POLISH:', '  if (studioShell) useStudioPass3Polish() // PASS3-POLISH:']])
await mutant('page: the page reads the flag itself', [[PAGE, '  useStudioPass3Polish() // PASS3-POLISH: NEXT_PUBLIC', '  void process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH // PASS3-POLISH\n  useStudioPass3Polish() // PASS3-POLISH: NEXT_PUBLIC']])
await mutant('page: the Builder root line changed (h-screen -> h-dvh)', [[PAGE, 'className="flex h-screen w-screen overflow-hidden ', 'className="flex h-dvh w-screen overflow-hidden ']])
await mutant('page: a second h-screen element', [[PAGE, '  useStudioPass3Polish() // PASS3-POLISH: NEXT_PUBLIC', '  const extra = <div className="h-screen" /> // PASS3-POLISH\n  useStudioPass3Polish() // PASS3-POLISH: NEXT_PUBLIC']])

// the strip, the registry, the env block
const stripBase = stripPass3Polish
await mutant('strip: leaves the marked lines', [], { strip: (rel, text) => text })
await mutant('strip: also removes an unmarked line', [], { strip: (rel, text) => (PASS3_POLISH_FILES.includes(rel) ? text.split('\n').filter(line => !line.includes('PASS3-POLISH') && !line.includes('useStudioPaymentsOpenSoon()')).join('\n') : text) })
await mutant('strip: drops the trailing newline', [], { strip: (rel, text) => stripBase(rel, text).replace(/\n$/, '') })
await mutant('strip: also strips .env.example', [], { strip: (rel, text) => (rel === ENV ? text.split('\n').filter(line => !line.includes('PASS3')).join('\n') : stripBase(rel, text)) })
await mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-pass3-polish-strip.mjs')).stripPass3Polish, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR A (NEXT_PUBLIC_STUDIO_PASS3_POLISH)\n", '']])
await mutant('registry: the env block line is gone', [[REGISTRY, "  (await import('./studio-pass3-polish-strip.mjs')).PASS3_POLISH_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR A (NEXT_PUBLIC_STUDIO_PASS3_POLISH)\n", '']])
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-pass3-polish-strip.mjs')).PASS3_POLISH_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR A (NEXT_PUBLIC_STUDIO_PASS3_POLISH)\n", '']])
await mutant('env: the flag documented "true"', [[ENV, 'NEXT_PUBLIC_STUDIO_PASS3_POLISH="false"', 'NEXT_PUBLIC_STUDIO_PASS3_POLISH="true"']])
await mutant('env: a base line of .env.example changed', [[ENV, 'NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED="false"', 'NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED="true"']])
const FAKE_NAME = ['api', 'Key', 'Value'].join(''), FAKE_VALUE = ['abcdef', '1234567890'].join('') // built here so that this file carries no credential-shaped literal itself
await mutant('secret scan: a credential-shaped literal', [[LIB, 'let holders = 0\n', `let holders = 0\nconst ${FAKE_NAME} = '${FAKE_VALUE}'\n`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.error(`SURVIVED:\n  ${survived.join('\n  ')}`); process.exit(1) }
console.log(`test-studio-pass3-polish: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
