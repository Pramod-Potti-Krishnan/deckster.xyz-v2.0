// FRONTEND-2 (B58; FRONTEND-1's pre-promotion UX pass of 4 Nov, blockers UX-03 and UX-04): proof of the phone shell's bottom tab bar on the two pages that drew the desktop rail without it. Flag NEXT_PUBLIC_STUDIO_PHONE_SHELL_COVERAGE (exact "true",
// build-time, default off), only active with the phone shell (NEXT_PUBLIC_STUDIO_PHONE_SHELL) and the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL). On a phone, Help (StudioHelpFrame, signed in) and the Builder's load-error screen (StudioSessionProblemView,
// studioShell) draw <StudioPhoneTabBar /> as a DIRECT child of the shell root, right after the rail; components/layout/studio-phone-shell.css (not edited) then steps the rail aside and gives the page the bar's height.
//
//   node scripts/test-studio-phone-shell-coverage.mjs        (plain node: transpile + vm of the REAL sources, react-dom/server for the markup, postcss over the REAL stylesheets; no network, no browser, no .next)
//
// What it proves:
//  1. the flag is the exact string "true" AND the phone shell AND the Studio shell (every other spelling of each is off); the environment is read inline, three values, nowhere else;
//  2. Help, server-rendered (the REAL StudioHelpFrame, the rail and the bar as stubs): flag on and signed in, the bar is a direct child of the shell root, exactly once, right after the rail; signed out, no bar and no rail; flag off (every other state) the HTML is the base's
//     (the stripped source AND the base commit's own file render the same bytes);
//  3. the load-error screen (the REAL StudioSessionProblemView, every STUDIO_SESSION_PROBLEM kind x studioShell): the same, with studioShell false meaning no rail and no bar;
//  4. the stylesheets (postcss, the REAL files): the `:has(> bar)` rules the bar relies on are still there; for BOTH screens at 375 x 812 and 390 x 844 (with and without a bottom safe area) neither the 52 x 48 brand tile nor the 56 px bar can cover the problem card or its buttons
//     (the card's box starts under the tile and ends above the bar, and scrolls inside itself), and Help's header and workspace reuse the shell attributes whose phone rules win on specificity over Help's own;
//  5. the pins: the two files without their marked lines are the base's, byte for byte (the strip is idempotent); the marked lines are three per file, pure insertions, gated on the constant and the screen's own rail condition; the older proofs taught put back to the base;
//  6. scope over the COMMITTED diff, GATE-SAFE (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, no hash-object --stdin); 7. mutants are caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'
import {
  BASE_COMMIT, PHONE_SHELL_COVERAGE_FILES, PHONE_SHELL_COVERAGE_NEW_FILES, PHONE_SHELL_COVERAGE_PIN_EDITS, PHONE_SHELL_COVERAGE_PIN_FILES, PHONE_SHELL_COVERAGE_PIN_MARK, PHONE_SHELL_COVERAGE_SCOPE_FILES,
  PHONE_SHELL_COVERAGE_ENV_BLOCK, PHONE_SHELL_COVERAGE_MARKER_RE, PHONE_SHELL_COVERAGE_SUBJECT, PHONE_SHELL_COVERAGE_FLAG, stripPhoneShellCoverage,
} from './studio-phone-shell-coverage-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
/** Every OTHER registered change's strip, in the registry's order (this change's is left out): a file is read as this change left it, whatever other changes marked in it. */
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripPhoneShellCoverage), rel, text)
/** Only the strips of the changes registered AFTER this one, in the registry's order: on a branch stacked after this change a later change's own lines (its subject filter beside this one's in a taught proof, ...) are undone first, so a file reads as this change left it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripPhoneShellCoverage); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch { caught++; console.log(`CAUGHT mutant ${label}`) }
}
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }

// ---- the real sources in a vm ---------------------------------------------------------------------------------------------------------------------
const LIB = 'lib/studio-phone-shell-coverage.ts', HELP = 'components/help/studio-help.tsx', VIEWS = 'components/builder/studio-session-hygiene.tsx'
const HYGIENE_CSS = 'components/builder/studio-session-hygiene-styles.ts', SHELL_CSS = 'components/layout/studio-phone-shell.css'
const FLAG = PHONE_SHELL_COVERAGE_FLAG, PHONE = 'NEXT_PUBLIC_STUDIO_PHONE_SHELL', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const SPELLINGS = [undefined, 'false', 'TRUE', '1', ' true', 'true']
const ON = { [FLAG]: 'true', [PHONE]: 'true', [SHELL]: 'true' }
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const h = React.createElement
const icons = new Proxy({ __esModule: true }, { get: (_, name) => name === '__esModule' ? true : (() => h('svg', { 'data-icon': String(name), 'aria-hidden': 'true' })) })
/** Real files for the small lib modules the two screens read; everything else is a stub (the rail, the bar, the tooltip, the form controls). */
const REAL = {
  '@/lib/studio-phone-shell-coverage': LIB, '@/lib/studio-session-hygiene': 'lib/studio-session-hygiene.ts', '@/lib/last-builder-session': 'lib/last-builder-session.ts',
  '@/components/builder/studio-problem-card': 'components/builder/studio-problem-card.tsx', '@/components/builder/studio-session-hygiene-style-tag': 'components/builder/studio-session-hygiene-style-tag.tsx',
  '@/components/builder/studio-session-hygiene-styles': HYGIENE_CSS,
}
const STUBS = {
  react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, 'next/link': { __esModule: true, default: ({ href, children, ...rest }) => h('a', { href, ...rest }, children) },
  '@/components/layout/studio-rail': { StudioRail: () => h('aside', { 'data-studio-v4-rail': 'true' }) },
  '@/components/layout/studio-phone-tab-bar': { StudioPhoneTabBar: () => h('nav', { 'data-studio-phone-tabbar': 'true' }) },
  '@/components/layout/studio-navigation-hint': { StudioNavigationHint: ({ children }) => children },
  '@/components/layout/app-header': { BackToBuilderButton: () => h('button', { 'data-stub': 'back' }) },
  '@/components/ui/input': { Input: props => h('input', props) }, '@/components/ui/label': { Label: props => h('label', props) }, '@/components/ui/textarea': { Textarea: props => h('textarea', props) },
}
function load(rel, { env = {}, text, overrides = {} } = {}) {
  const module = { exports: {} }
  const source = text ?? read(rel)
  const req = spec => {
    if (spec in overrides) return overrides[spec]
    if (spec in STUBS) return STUBS[spec]
    if (spec.endsWith('.css')) return {}
    if (spec in REAL) return load(REAL[spec], { env })
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, source), { module, exports: module.exports, require: req, process: { env } }, { filename: rel })
  return module.exports
}

// ---- a tiny parser for the static markup (react-dom/server output is well formed) ------------------------------------------------------------------------
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
function parseHtml(html) {
  const top = { tag: '#root', attrs: {}, children: [], parent: null }, stack = [top]
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|[^<]+/g
  let m
  while ((m = re.exec(html))) {
    if (m[2] === undefined) continue
    const [, close, tag, attrText, selfClose] = m
    if (close) { const i = stack.map(n => n.tag).lastIndexOf(tag); assert.ok(i >= 1, `unbalanced </${tag}>`); stack.length = i; continue }
    const attrs = {}; for (const a of attrText.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? ''
    const node = { tag, attrs, children: [], parent: stack[stack.length - 1] }; node.parent.children.push(node)
    if (tag === 'style') { const end = html.indexOf('</style>', re.lastIndex); assert.ok(end > 0, 'style is closed'); re.lastIndex = end + 8; continue }
    if (!VOID.has(tag) && !selfClose) stack.push(node)
  }
  assert.equal(stack.length, 1, 'every tag is closed')
  return top
}
const walk = (node, fn) => { fn(node); node.children.forEach(child => walk(child, fn)) }
const findAll = (node, pred) => { const out = []; walk(node, n => { if (n !== node && pred(n)) out.push(n) }); return out }
const BAR = n => n.attrs['data-studio-phone-tabbar'] === 'true', RAIL = n => 'data-studio-v4-rail' in n.attrs

// ---- the two screens -------------------------------------------------------------------------------------------------------------------------------------
const helpHtml = (env, props, text) => { const mod = load(HELP, { env, text }); return renderToStaticMarkup(h(mod.StudioHelpFrame, props, h('p', null, 'help body'))) }
const viewHtml = (env, props, text) => { const mod = load(VIEWS, { env, text }); return renderToStaticMarkup(h(mod.StudioSessionProblemView, props)) }
const KINDS = Object.keys(load('lib/studio-session-hygiene.ts', { env: {} }).STUDIO_SESSION_PROBLEM_COPY)
const stateEnv = (flag, phone, shell) => ({ ...(flag === undefined ? {} : { [FLAG]: flag }), ...(phone === undefined ? {} : { [PHONE]: phone }), ...(shell === undefined ? {} : { [SHELL]: shell }) })
const STATES = []; for (const flag of SPELLINGS) for (const phone of SPELLINGS) for (const shell of SPELLINGS) STATES.push([flag, phone, shell])
const isOn = (flag, phone, shell) => flag === 'true' && phone === 'true' && shell === 'true'

/** The bar next to the rail: a direct child of the shell root, exactly once in the page, the very next sibling of the rail. */
function barNextToRail(dom, rootPred, what) {
  const roots = findAll(dom, rootPred); assert.equal(roots.length, 1, `${what}: one shell root`)
  const shellRoot = roots[0], bars = findAll(dom, BAR)
  assert.equal(bars.length, 1, `${what}: exactly one bar in the page`)
  assert.equal(bars[0].parent, shellRoot, `${what}: the bar is a DIRECT child of the shell root`)
  const kids = shellRoot.children.filter(n => n.tag !== 'style'), at = kids.indexOf(bars[0])
  assert.ok(at > 0 && RAIL(kids[at - 1]), `${what}: the bar comes right after the rail`)
  assert.equal(kids.filter(RAIL).length, 1, `${what}: one rail`)
  return shellRoot
}
const noBarNoRail = (dom, what) => { assert.equal(findAll(dom, BAR).length, 0, `${what}: no bar`); assert.equal(findAll(dom, RAIL).length, 0, `${what}: no rail`) }
const helpRoot = n => n.attrs['data-studio-help'] === 'true' && n.attrs['data-studio-v4-shell'] === 'true'
const problemRoot = n => 'data-studio-session-problem' in n.attrs && n.attrs['data-studio-v4-shell'] === 'true'

function proveHelp(text = read(HELP), at = '') {
  const a = m => (at ? `${at}: ${m}` : m)
  const baseHtml = Object.fromEntries([true, false].map(signedIn => [signedIn, helpHtml({}, { signedIn }, baseText(HELP))]))
  const on = helpHtml(ON, { signedIn: true }, text), onDom = parseHtml(on)
  const shellRoot = barNextToRail(onDom, helpRoot, a('Help, flag on, signed in'))
  assert.deepEqual(shellRoot.children.map(n => n.tag), ['aside', 'nav', 'div'], a('Help: the root holds the rail, the bar, then the column'))
  assert.equal(helpHtml(ON, { signedIn: true }, stripPhoneShellCoverage(HELP, text)), baseHtml[true], a('Help: without its marked lines the page is the base\'s'))
  const loading = helpHtml(ON, { signedIn: true, accountLoading: true }, text); barNextToRail(parseHtml(loading), helpRoot, a('Help, account loading, signed in'))
  noBarNoRail(parseHtml(helpHtml(ON, { signedIn: false }, text)), a('Help, flag on, signed out'))
  assert.equal(helpHtml(ON, { signedIn: false }, text), baseHtml[false], a('Help, signed out: the base\'s HTML, flag on'))
  for (const [flag, phone, shell] of STATES) {
    if (isOn(flag, phone, shell)) continue
    const env = stateEnv(flag, phone, shell)
    for (const signedIn of [true, false]) assert.equal(helpHtml(env, { signedIn }, text), baseHtml[signedIn], a(`Help, flag off (${JSON.stringify(env)}), signedIn ${signedIn}: the base's HTML`))
  }
  // Help keeps the shell's own attributes, so the phone rules reach its top bar and workspace
  const col = shellRoot.children.find(n => n.attrs['data-studio-v4-shell-column'] === 'true'), header = col.children.find(n => n.tag === 'header'), main = col.children.find(n => n.tag === 'main')
  assert.ok(header.attrs['data-studio-v4-shell-header'] === 'true' && header.children[0]?.tag === 'div', a('Help: root > column > header > div'))
  assert.equal(main.attrs['data-studio-v4-shell-workspace'], 'true', a('Help: root > column > main[workspace]'))
  return { on, base: baseHtml[true] }
}
function proveProblem(text = read(VIEWS), at = '') {
  const a = m => (at ? `${at}: ${m}` : m)
  assert.deepEqual(KINDS, ['not_found', 'deleted', 'load_error'], a('every session problem kind'))
  for (const problem of KINDS) {
    const baseOf = studioShell => viewHtml({}, { problem, studioShell }, baseText(VIEWS))
    for (const studioShell of [true, false]) {
      const onHtml = viewHtml(ON, { problem, studioShell }, text), dom = parseHtml(onHtml)
      if (studioShell) {
        const shellRoot = barNextToRail(dom, problemRoot, a(`${problem}, flag on, studioShell`))
        assert.equal(shellRoot.attrs['data-studio-session-problem'], problem, a(`${problem}: the root carries the problem`))
        assert.equal(shellRoot.children.filter(n => n.tag === 'main').length, 1, a(`${problem}: one card area, after the bar`))
        assert.ok(shellRoot.children.indexOf(findAll(dom, BAR)[0]) < shellRoot.children.findIndex(n => n.tag === 'main'), a(`${problem}: the bar is before the card`))
      } else {
        noBarNoRail(dom, a(`${problem}, flag on, no studio shell`))
        assert.equal(onHtml, baseOf(false), a(`${problem}: no shell, the base's HTML`))
      }
      assert.equal(viewHtml(ON, { problem, studioShell }, stripPhoneShellCoverage(VIEWS, text)), baseOf(studioShell), a(`${problem}, studioShell ${studioShell}: without its marked lines the screen is the base's`))
      for (const [flag, phone, shell] of STATES) {
        if (isOn(flag, phone, shell)) continue
        const env = stateEnv(flag, phone, shell)
        assert.equal(viewHtml(env, { problem, studioShell }, text), baseOf(studioShell), a(`${problem}, flag off (${JSON.stringify(env)}), studioShell ${studioShell}: the base's HTML`))
      }
    }
  }
}

// ===== 1. the flag ==================================================================================================================================
console.log('1. flag')
await check('the flag is on only for the exact value "true" together with the phone shell and the Studio shell; the three values are read inline and nowhere else', () => {
  for (const [flag, phone, shell] of STATES) {
    const lib = load(LIB, { env: stateEnv(flag, phone, shell) })
    assert.equal(lib.STUDIO_PHONE_SHELL_COVERAGE_ENABLED, isOn(flag, phone, shell), JSON.stringify([flag, phone, shell]))
    assert.equal(lib.studioPhoneShellCoverageOn(flag, phone, shell), isOn(flag, phone, shell))
  }
  const text = read(LIB)
  assert.match(text, /export const STUDIO_PHONE_SHELL_COVERAGE_ENABLED = studioPhoneShellCoverageOn\(process\.env\.NEXT_PUBLIC_STUDIO_PHONE_SHELL_COVERAGE, process\.env\.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL\)/)
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.equal((code.match(/process\.env/g) || []).length, 3, 'the environment is read three times: the flag, the phone shell and the Studio shell, nowhere else')
  assert.equal((code.match(/process\.env\.NEXT_PUBLIC_[A-Z0-9_]+/g) || []).length, 3, 'each read is an inline NEXT_PUBLIC_ property (Next inlines them at build time)')
  assert.doesNotMatch(code, /^import /m, 'import-free')
  assert.equal(load('lib/studio-phone-shell.ts', { env: ON }).STUDIO_PHONE_SHELL_ENABLED, true, 'the phone shell\'s own flag (not edited) is on in the same state')
  assert.equal(git('diff', '--name-only', `${BASE_COMMIT}`, 'HEAD', '--', 'lib/studio-phone-shell.ts').trim(), '', 'lib/studio-phone-shell.ts (pinned) is not edited')
})

// ===== 2. Help, 3. the load-error screen ==================================================================================================================
console.log('2/3. the two screens, server-rendered')
await check('Help: flag on and signed in, the bar is a direct child of the shell root, once, right after the rail; signed out, none; flag off in every other state (216 spelling states x signed in / out) is the base\'s HTML', () => { proveHelp() })
await check('the load-error screen: for every problem kind, flag on and the Studio shell, the bar is a direct child of the shell root, once, right after the rail and before the card; no Studio shell, none; flag off in every other state is the base\'s HTML', () => { proveProblem() })

// ===== 4. the stylesheets ===============================================================================================================================
console.log('4. stylesheets')
function splitTop(selector) {
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
/** CSS specificity [ids, classes/attributes/pseudo-classes, types/pseudo-elements]; :has / :is / :not take their most specific argument, :where is 0. */
function specificity(sel) {
  const total = [0, 0, 0]; let i = 0
  const ident = () => { while (/[\w-]/.test(sel[i] || '')) i++ }
  const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  while (i < sel.length) {
    const ch = sel[i]
    if (ch === '[') { total[1]++; i = sel.indexOf(']', i) + 1 }
    else if (ch === '.') { total[1]++; i++; ident() }
    else if (ch === '#') { total[0]++; i++; ident() }
    else if (ch === ':') {
      if (sel[i + 1] === ':') { total[2]++; i += 2; ident(); continue }
      i++; const from = i; ident(); const name = sel.slice(from, i)
      if (sel[i] === '(') {
        let depth = 1, j = i + 1; while (depth) { if (sel[j] === '(') depth++; else if (sel[j] === ')') depth--; j++ }
        const inner = sel.slice(i + 1, j - 1); i = j
        if (['has', 'is', 'not', 'matches'].includes(name)) { const best = splitTop(inner).map(specificity).sort(cmp).pop(); total[0] += best[0]; total[1] += best[1]; total[2] += best[2] } else if (name !== 'where') total[1]++
      } else total[1]++
    } else if (/[a-zA-Z]/.test(ch)) { total[2]++; ident() } else i++
  }
  return total
}
const cmpSpec = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
function cssRules(text) {
  const out = []
  postcss.parse(text).walkRules(rule => {
    const media = rule.parent?.type === 'atrule' ? `${rule.parent.name} ${rule.parent.params}` : null
    out.push({ selectors: splitTop(rule.selector), media, decls: rule.nodes.filter(n => n.type === 'decl').map(d => [d.prop, d.value]) })
  })
  return out
}
/** The declarations the rules whose selector list holds `selector` give, later rules over earlier ones (one selector at a time; no cascade across different selectors). */
const declsOf = (rules, selector) => Object.fromEntries(rules.filter(r => r.selectors.includes(selector)).flatMap(r => r.decls))
const px = value => { const m = /^(-?[\d.]+)(?:px)?$/.exec(String(value).trim()); assert.ok(m, `a px value: ${value}`); return parseFloat(m[1]) }
const BARSEL = '[data-studio-phone-tabbar="true"]', ROOTSEL = `[data-studio-v4-shell="true"]:has(> ${BARSEL})`, PHONE_QUERY = 'media (max-width: 640px)'
const shellCssText = () => read(SHELL_CSS), hygieneCss = (text = read(HYGIENE_CSS)) => load(HYGIENE_CSS, { env: {}, text }).STUDIO_SESSION_HYGIENE_CSS

/** The phone shell's rules this change relies on, and the geometry of the load-error screen at one phone size (device px; `safe` is the bottom safe-area inset). Throws when the tile or the bar could cover the card. */
function proveGeometry(shellText, hygieneText, { width, height, safe }, at = '') {
  const a = m => `${at}${at ? ': ' : ''}${width}x${height} safe ${safe}: ${m}`
  const shell = cssRules(shellText), hyg = cssRules(hygieneText)
  const phone = shell.filter(r => r.media === PHONE_QUERY)
  // the rules the bar relies on exist, in the phone query, keyed to a root that holds the bar as a DIRECT child
  const rootRule = declsOf(phone, ROOTSEL), railRule = declsOf(phone, `${ROOTSEL} > [data-studio-v4-rail]`), barRule = declsOf(phone, `[data-studio-v4-shell="true"] > ${BARSEL}`)
  assert.equal(rootRule['padding-bottom'], 'calc(56px + env(safe-area-inset-bottom, 0px))', a('the root gets the bar\'s height and the safe area as bottom padding'))
  assert.equal(rootRule['--ss-rail-width'], '0px', a('the rail\'s width is 0'))
  assert.deepEqual([railRule.position, railRule.top, railRule.left, railRule.width, railRule.height], ['absolute', '0', '0', '52px', '48px'], a('the rail is a 52 x 48 tile at the top left, out of the flow'))
  assert.deepEqual([barRule.position, barRule.bottom, barRule.left, barRule.right, barRule.height], ['fixed', '0', '0', '0', 'calc(56px + env(safe-area-inset-bottom, 0px))'], a('the bar is fixed to the bottom edge, 56 px plus the safe area'))
  assert.ok(Object.keys(railRule).length && phone.every(r => r.selectors.every(s => s.includes(BARSEL) || s.includes('data-studio-phone-more'))), a('every phone rule needs the bar or the sheet (nothing matches with the flag off)'))
  // the load-error screen's own box model
  const rootBox = declsOf(hyg, '[data-studio-session-problem]'), main = declsOf(hyg, '[data-studio-problem-main="true"]'), mainTop = declsOf(hyg, '[data-studio-session-problem] > [data-studio-problem-main="true"]')
  assert.deepEqual([rootBox['box-sizing'], rootBox.height, rootBox.overflow, rootBox.display], ['border-box', '100dvh', 'hidden', 'flex'], a('the screen is a border-box 100dvh flex row: the root\'s padding comes out of its content box'))
  assert.deepEqual([main.flex, main['min-height'], main.overflow], ['1', '0', 'auto'], a('the card area fills what is left, may shrink, and scrolls inside itself'))
  const [mt, mr, mb, ml] = (() => { const v = main.margin.split(/\s+/); return [v[0], v[1] ?? v[0], v[2] ?? v[0], v[3] ?? v[1] ?? v[0]].map(px) })()
  const marginTop = mainTop['margin-top'] ? px(mainTop['margin-top']) : mt
  // device geometry
  const tile = { left: 0, top: 0, right: px(railRule.width), bottom: px(railRule.height) }
  const rootPaddingBottom = 56 + safe, barHeight = 56 + safe
  const cardArea = { left: ml, top: marginTop, right: width - mr, bottom: height - rootPaddingBottom - mb }
  const barBox = { top: height - barHeight, bottom: height }
  assert.ok(cardArea.top >= tile.bottom, a(`the card area (top ${cardArea.top}) starts at or below the brand tile (bottom ${tile.bottom})`))
  assert.ok(cardArea.bottom <= barBox.top, a(`the card area (bottom ${cardArea.bottom}) ends at or above the bar (top ${barBox.top})`))
  assert.ok(cardArea.bottom - cardArea.top > 200, a(`and keeps a usable height (${cardArea.bottom - cardArea.top} px)`))
  assert.ok(cardArea.right - cardArea.left <= width, a('and fits the width'))
  assert.equal(cardArea.left, 0, a('no rail column is reserved: the card area starts at the screen edge, so the card is centred in the full width'))
  return { tile, cardArea, barBox }
}
/** The load-error screen reserves NO rail column of its own (FRONTEND-1's UX-04 shot: the card sat right of a full rail column): its root is a flex row with no grid, padding or margin, its card area has no left margin or rail-sized padding, nothing in it names the rail's width;
 *  the only column the rail takes is the rail's own `flex: 0 0 var(--ss-rail-width)` (studio-shell.css), which the phone rule beats on specificity and takes out of the flow. */
function proveNoRailColumn(shellText, hygieneText, shellSheetText = read('components/layout/studio-shell.css'), at = '') {
  const a = m => `${at}${at ? ': ' : ''}${m}`
  const hyg = cssRules(hygieneText), mine = hyg.flatMap(r => r.selectors.map(selector => ({ selector, decls: r.decls }))).filter(({ selector }) => /^\[data-studio-session-problem\]|\[data-studio-problem-main="true"\]/.test(selector) && !/data-standalone/.test(selector))
  assert.ok(mine.length >= 3, a(`positive control: the screen's own rules are found (${mine.length})`))
  for (const { selector, decls } of mine) for (const [prop, value] of decls) {
    assert.ok(!/ss-rail-width|\b56px\b/.test(value), a(`${selector}: ${prop} does not name the rail's width`))
    assert.ok(!/^(grid-template-columns|grid-template|padding-left|padding-inline|padding-inline-start|margin-inline|margin-inline-start)$/.test(prop), a(`${selector}: no ${prop} (no column is reserved)`))
    if (selector.startsWith('[data-studio-session-problem]') && !selector.includes('>')) assert.ok(!/^(padding|margin|margin-left)/.test(prop), a(`${selector}: the root has no padding or margin of its own (${prop})`))
    if (prop === 'display') assert.equal(value, 'flex', a(`${selector}: a flex row, not a grid`))
  }
  const main = declsOf(hyg, '[data-studio-problem-main="true"]')
  assert.equal(main.margin.split(/\s+/)[3] ?? main.margin.split(/\s+/)[1], '0', a('the card area has no left margin (it starts where the rail ends: at the screen edge once the rail is out of the flow)'))
  // the rail's own column, and why the phone rule removes it
  const base = cssRules(shellSheetText).find(r => r.selectors.includes('[data-studio-v4-shell="true"] > [data-studio-v4-rail]')), phone = cssRules(shellText).filter(r => r.media === PHONE_QUERY).find(r => r.selectors.includes(`${ROOTSEL} > [data-studio-v4-rail]`))
  assert.ok(base && phone, a('both rail rules are found'))
  assert.equal(Object.fromEntries(base.decls).flex, '0 0 var(--ss-rail-width)', a('the rail takes its column with flex: 0 0 var(--ss-rail-width)'))
  assert.equal(Object.fromEntries(phone.decls).position, 'absolute', a('the phone rule takes the rail out of the flow'))
  assert.ok(cmpSpec(specificity(`${ROOTSEL} > [data-studio-v4-rail]`), specificity('[data-studio-v4-shell="true"] > [data-studio-v4-rail]')) > 0, a('and wins on specificity over the rail\'s own rule'))
  const rootDecls = declsOf(cssRules(shellText).filter(r => r.media === PHONE_QUERY), ROOTSEL); assert.equal(rootDecls['--ss-rail-width'], '0px', a('and the rail\'s width is 0 under a root that holds the bar'))
}
await check('the load-error screen reserves no rail column of its own: a flex row with no grid, padding or margin for the rail; the rail\'s own column is taken out of the flow by the phone rule, which beats it on specificity', () => { proveNoRailColumn(shellCssText(), hygieneCss()) })
await check('the phone shell\'s `:has(> bar)` rules are still there; at 375 x 812 and 390 x 844 (safe area 0 and 34) the brand tile and the bar cannot cover the load-error card or its buttons', () => {
  for (const size of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) for (const safe of [0, 34]) proveGeometry(shellCssText(), hygieneCss(), { ...size, safe })
})
await check('the card\'s buttons stay inside the card area: at 375 wide the card is narrower than the area and its actions wrap', () => {
  const hyg = cssRules(hygieneCss()), card = declsOf(hyg, '[data-studio-problem-card="true"]'), actions = declsOf(hyg, '[data-studio-problem-actions="true"]'), small = hyg.filter(r => r.media === 'media (max-width: 520px)')
  assert.equal(card['max-width'], '540px'); assert.equal(card.width, '100%'); assert.equal(card['box-sizing'], 'border-box')
  assert.equal(actions['flex-wrap'], 'wrap', 'the three actions wrap')
  assert.equal(declsOf(small, '[data-studio-problem-card="true"]').padding, '32px 22px 28px', 'a phone gets the narrow padding')
  assert.equal(declsOf(hyg, '[data-studio-problem-main="true"]').padding, '24px')
  // a button's widest label at 13 px (7 px a character is above Arial's 500 weight), its 20 px side padding and 1 px borders, against the card's inner width at 375 wide
  const widest = Math.max(...['Try again', 'Start a new presentation', 'Go to Decks'].map(label => label.length * 7 + 42)), inner = (375 - 10) - 2 - 2 * 24 - 2 * 22
  assert.ok(widest <= inner, `the widest button (${widest}) fits the card's inner width at 375 wide (${inner})`)
})
await check('Help: its header and workspace are the shell\'s own elements, and the phone rules win on specificity over every rule that sets their padding or margin', () => {
  const phoneRules = cssRules(shellCssText()).filter(r => r.media === PHONE_QUERY)
  const headerPhone = `${ROOTSEL} > [data-studio-v4-shell-column] > [data-studio-v4-shell-header] > div`, workspacePhone = `${ROOTSEL} > [data-studio-v4-shell-column] > [data-studio-v4-shell-workspace]`
  assert.equal(declsOf(phoneRules, headerPhone)['padding-left'], '52px', 'the top bar\'s content starts after the 52 px tile')
  assert.equal(declsOf(phoneRules, workspacePhone)['margin-left'], '10px', 'the workspace keeps a 10 px band on the left')
  const sheets = ['components/layout/studio-shell.css', 'components/layout/studio-p2-shell.css', 'components/help/studio-help.css', 'components/help/studio-p2-help.css'].flatMap(rel => cssRules(read(rel)).map(r => ({ ...r, rel })))
  const setting = (r, props) => r.decls.some(([prop]) => props.includes(prop))
  const headerRivals = sheets.flatMap(r => r.selectors.map(s => ({ s, r }))).filter(({ s, r }) => /(data-studio-v4-shell-header|data-studio-help-part="header")\]? > div$/.test(s) && setting(r, ['padding', 'padding-left']))
  const workspaceRivals = sheets.flatMap(r => r.selectors.map(s => ({ s, r }))).filter(({ s, r }) => /\[data-studio-v4-shell-workspace\]$/.test(s) && setting(r, ['margin', 'margin-left']))
  assert.ok(headerRivals.length >= 2, `positive control: the header's own padding rules are found (${headerRivals.length})`)
  assert.ok(workspaceRivals.length >= 1, `positive control: the workspace's own margin rule is found (${workspaceRivals.length})`)
  for (const { s, r } of headerRivals) assert.ok(cmpSpec(specificity(headerPhone), specificity(s)) > 0, `${r.rel}: ${s} (${specificity(s)}) loses to the phone rule (${specificity(headerPhone)})`)
  for (const { s, r } of workspaceRivals) assert.ok(cmpSpec(specificity(workspacePhone), specificity(s)) > 0, `${r.rel}: ${s} (${specificity(s)}) loses to the phone rule (${specificity(workspacePhone)})`)
  assert.deepEqual(specificity('[data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"])'), [0, 2, 0], 'the specificity helper: a :has() takes its argument\'s')
})

// ===== 5. pins ==========================================================================================================================================
console.log('5. pins')
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const lineDiff = (before, after) => { const b = before.split('\n'), a = after.split('\n'), out = []; let i = 0, j = 0; while (i < b.length || j < a.length) { if (b[i] === a[j]) { i++; j++ } else if (a[j] !== undefined && !b.slice(i).includes(a[j])) { out.push(`+${a[j++]}`) } else if (b[i] !== undefined && !a.slice(j).includes(b[i])) { out.push(`-${b[i++]}`) } else { out.push(`-${b[i++]}`); out.push(`+${a[j++]}`) } } return out }
function provePins(readNow = read, at = '', later = laterStrips) {
  const a = m => (at ? `${at}: ${m}` : m)
  for (const rel of PHONE_SHELL_COVERAGE_FILES) {
    const now = later(rel, readNow(rel)), base = baseText(rel), marked = now.split('\n').filter(line => PHONE_SHELL_COVERAGE_MARKER_RE.test(line))
    assert.equal(stripPhoneShellCoverage(rel, now), base, a(`${rel}: without its marked lines it is the base's, byte for byte`))
    assert.equal(stripPhoneShellCoverage(rel, stripPhoneShellCoverage(rel, now)), base, a(`${rel}: stripping twice changes nothing more`))
    assert.equal(marked.length, 3, a(`${rel}: three marked lines`))
    const diff = lineDiff(base, now); assert.deepEqual(diff.filter(l => l.startsWith('-')), [], a(`${rel}: nothing is removed or rewritten`)); assert.equal(diff.length, 3, a(`${rel}: three lines are added`))
    assert.ok(/^import \{ StudioPhoneTabBar \} from ['"]@\/components\/layout\/studio-phone-tab-bar['"]/.test(marked[0]), a(`${rel}: line 1 is the bar's import`))
    assert.ok(/^import \{ STUDIO_PHONE_SHELL_COVERAGE_ENABLED \} from ['"]@\/lib\/studio-phone-shell-coverage['"]/.test(marked[1]), a(`${rel}: line 2 is the flag's import`))
    assert.ok(/<StudioPhoneTabBar \/>/.test(marked[2]) && marked[2].includes('STUDIO_PHONE_SHELL_COVERAGE_ENABLED &&'), a(`${rel}: line 3 draws the bar only with the constant`))
    assert.doesNotMatch(marked.join('\n').replace(/\/\/.*$|\{\/\*.*?\*\/\}/gm, ''), /process\.env/, a(`${rel}: the marked lines read no environment (the lib does)`))
    const lines = now.split('\n'), at3 = lines.indexOf(marked[2]), around = { [HELP]: ['      {signedIn && <StudioRail studioEntry={<BackToBuilderButton rail />} />}', '      <div data-studio-v4-shell-column="true">'], [VIEWS]: ['      )}', '      <main data-studio-problem-main="true">'] }[rel]
    assert.deepEqual([lines[at3 - 1], lines[at3 + 1]], around, a(`${rel}: the bar is drawn right after the rail and before the column / the card area`))
  }
  const guard = { [HELP]: 'signedIn && STUDIO_PHONE_SHELL_COVERAGE_ENABLED && <StudioPhoneTabBar />', [VIEWS]: 'studioShell && STUDIO_PHONE_SHELL_COVERAGE_ENABLED && <StudioPhoneTabBar />' }
  for (const [rel, expr] of Object.entries(guard)) assert.ok(readNow(rel).includes(expr), a(`${rel}: the bar is drawn exactly where the rail is, and with the flag`))
  assert.ok(readNow(HELP).includes('{signedIn && <StudioRail '), a('Help: the rail\'s own condition is unchanged')); assert.ok(readNow(VIEWS).includes('{studioShell && ('), a('the screen: the rail\'s own condition is unchanged'))
  for (const rel of PHONE_SHELL_COVERAGE_PIN_FILES) {
    const now = later(rel, readNow(rel)), base = baseText(rel)
    assert.equal(stripPhoneShellCoverage(rel, now), base, a(`${rel}: an older proof taught: put back it is the base's, byte for byte`))
    assert.equal(stripPhoneShellCoverage(rel, stripPhoneShellCoverage(rel, now)), base, a(`${rel}: put back twice changes nothing more`))
    for (const [has, was] of PHONE_SHELL_COVERAGE_PIN_EDITS[rel]) { assert.equal(now.split(has).length - 1, 1, a(`${rel}: a taught line is there exactly once`)); for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(PHONE_SHELL_COVERAGE_PIN_MARK), a(`${rel}: a taught line carries the registry-read mark`)); assert.ok(!was.includes(PHONE_SHELL_COVERAGE_PIN_MARK)) }
    const added = lineDiff(base, now).filter(l => l.startsWith('+')); assert.ok(added.length >= 1 && added.every(l => l.includes(PHONE_SHELL_COVERAGE_PIN_MARK)), a(`${rel}: every line added to the proof carries the mark`))
  }
  for (const rel of [LIB, ...PHONE_SHELL_COVERAGE_NEW_FILES]) assert.doesNotMatch(readNow(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, `${rel}: no secret-shaped literal`)
}
await check('the two files without their marked lines are the base\'s, byte for byte (idempotent); three marked pure insertions each, gated on the constant and the screen\'s own rail condition; the older proofs taught put back to the base', () => { provePins() })
await check('the strip is plain data: nothing but the marker, the lists and the functions; any other file comes back untouched', () => {
  const text = read('scripts/studio-phone-shell-coverage-strip.mjs')
  assert.doesNotMatch(text.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/\/\/.*$/gm, ''), /^import |require\(|readFileSync|execFileSync/m, 'no imports, nothing read from disk or git') // string literals (the pin table's data) are blanked first, then comments
  assert.equal(stripPhoneShellCoverage('app/builder/page.tsx', 'x // PHONE-SHELL-COVERAGE\n'), 'x // PHONE-SHELL-COVERAGE\n', 'a file this change does not own is returned as it is')
  assert.equal(stripPhoneShellCoverage(HELP, 'a\nb // PHONE-SHELL-COVERAGE-X\nc // X-PHONE-SHELL-COVERAGE\nd // PHONE-SHELL-NAV\n'), 'a\nb // PHONE-SHELL-COVERAGE-X\nc // X-PHONE-SHELL-COVERAGE\nd // PHONE-SHELL-NAV\n', 'the marker is a whole token')
  assert.equal(stripPhoneShellCoverage(HELP, 1), 1)
  assert.ok(registry.LATER_STRIPS.includes(stripPhoneShellCoverage) && registry.LATER_ENV_BLOCKS.includes(PHONE_SHELL_COVERAGE_ENV_BLOCK) && [...PHONE_SHELL_COVERAGE_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'the registry holds the strip, the block and every file')
})

// ===== 6. scope =========================================================================================================================================
console.log('6. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-04T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-04T00:00:00Z' }
const plumb = (args, env = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpc-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(PHONE_SHELL_COVERAGE_SUBJECT)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees none of them on the gate's merge. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim(), parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const OLDER_PREFIXES = /^(Phone landscape:|Phone hints:|Phone shell 1:|Phone shell 2:|Stage open gate:|Chat column wide:|Welcome trim:|Director mark trim:|Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:|Text set keep look:|Structural refine decline:|Strawman|Template match:|Chat parity)/
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (?:Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), OLDER_PREFIXES, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
const scopeCommittedFiles = head => {
  const own = scopeOwnCommits(head), touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  assert.deepEqual([...touched].sort(), [...PHONE_SHELL_COVERAGE_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  assert.deepEqual([...net].sort(), [...PHONE_SHELL_COVERAGE_SCOPE_FILES].sort(), 'and the whole committed diff from BASE is nothing else')
  for (const rel of PHONE_SHELL_COVERAGE_FILES) {
    const now = git('show', `${head}:${rel}`), diff = lineDiff(baseText(rel), now)
    assert.ok(diff.length === 3 && diff.every(line => line.startsWith('+') && PHONE_SHELL_COVERAGE_MARKER_RE.test(line)), `${rel}: three added lines, each with the marker, none removed`)
    assert.equal(stripPhoneShellCoverage(rel, now), baseText(rel), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of PHONE_SHELL_COVERAGE_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of PHONE_SHELL_COVERAGE_PIN_FILES) assert.equal(stripPhoneShellCoverage(rel, git('show', `${head}:${rel}`)), baseText(rel), `${rel}: an older proof taught: put back it is the base's`)
  for (const rel of ['lib/studio-phone-shell.ts', 'components/layout/studio-phone-tab-bar.tsx', 'components/layout/studio-phone-shell.css', 'components/layout/studio-rail.tsx', 'components/layout/app-header.tsx', 'app/builder/page.tsx', 'app/(app)/layout.tsx', 'app/help/page.tsx',
    'components/builder/studio-session-hygiene-styles.ts', 'components/layout/studio-shell.css', 'package.json', 'scripts/studio-phone-shell-nav-strip.mjs']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = head => {
  const envText = git('show', `${head}:.env.example`), baseEnv = baseText('.env.example')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', envText), registry.stripLaterEnvBlocks('.env.example', baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(envText.split(PHONE_SHELL_COVERAGE_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(envText, new RegExp(`\\n\\n${PHONE_SHELL_COVERAGE_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  assert.ok(envText.endsWith(`${PHONE_SHELL_COVERAGE_ENV_BLOCK}`) || envText.includes(PHONE_SHELL_COVERAGE_ENV_BLOCK), 'the block sits after the last one')
  assert.ok(PHONE_SHELL_COVERAGE_ENV_BLOCK.includes(`${PHONE_SHELL_COVERAGE_FLAG}="false"`), 'the flag is documented as off')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes('studio-phone-shell-coverage-strip.mjs'))
  assert.equal(own.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['PHONE_SHELL_COVERAGE_SCOPE_FILES', 'PHONE_SHELL_COVERAGE_ENV_BLOCK', 'stripPhoneShellCoverage'])
  assert.equal(diff.length, 3, 'and nothing else in the registry')
}
const scopeAll = head => { scopeOwnCommits(head); scopeCommittedFiles(head); scopeEnvAndRegistry(head) }

const HEAD = scopeHead('HEAD')
/** This change's own commits on the FIRST-PARENT line of `head` from BASE. Merged into dev, its commits come in by a merge's second parent and that line has none of them: dev past the merge, a branch stacked after this change, a later change's gate merge. */
const ownOnLine = head => git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** There the committed diff from BASE holds the later changes' work too, so the scope checks stand down; the pins above (read past the later changes' strips) and every other section still run. On this change's own branch, and on its gate merge through HEAD^2, they all run. */
const ON_OWN_LINE = ownOnLine(HEAD).length > 0
const scopeCheck = (label, fn) => (ON_OWN_LINE ? check(label, fn) : undefined)
if (!ON_OWN_LINE) console.log('NOTE scope: no commit of this change on the first-parent line from BASE (merged into dev: its commits are on a second parent); the scope checks stand down, the pins above cover the files')
await scopeCheck(`this change's own commits (subject starts "${PHONE_SHELL_COVERAGE_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await scopeCheck('the committed files are exactly this change\'s; every line added to an app file is a marked pure insertion; the strip gives the base back byte for byte; the phone shell\'s own files, the page and the layout are not touched', () => scopeCommittedFiles(HEAD))
await scopeCheck('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none', () => scopeEnvAndRegistry(HEAD))
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await scopeCheck('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of PHONE_SHELL_COVERAGE_FILES) assert.equal(stripPhoneShellCoverage(rel, git('show', `${GATE}:${rel}`)), baseText(rel), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await scopeCheck('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpc-idx-'))
  try {
    const envIdx = { GIT_INDEX_FILE: path.join(dir, 'index') }
    plumb(['read-tree', parent], envIdx)
    for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], envIdx)
    return plumb(['commit-tree', plumb(['write-tree'], envIdx), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await scopeCheck('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE: the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
await scopeCheck('mutant caught: a stray file in a "Phone shell coverage:" commit, an own commit without the co-author line, an unmarked line added to a screen, and a touched foreign file (the bar, the phone shell\'s stylesheet) fail the scope', () => {
  const stray = commitWith(HEAD, { 'stray-phone-shell-coverage.txt': 'stray\n' }, `${PHONE_SHELL_COVERAGE_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray)); assert.doesNotThrow(() => scopeCommittedFiles(HEAD)); assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/)
  const noTrailer = commitWith(HEAD, {}, `${PHONE_SHELL_COVERAGE_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of PHONE_SHELL_COVERAGE_FILES) {
    const sneaky = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`).replace(/^(import [^\n]*\n)/m, '$1const sneaky = 1\n') }, `${PHONE_SHELL_COVERAGE_SUBJECT} a sneaky line${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(sneaky), /three added lines|exactly its scope/, rel)
  }
  for (const rel of ['components/layout/studio-phone-tab-bar.tsx', 'components/layout/studio-phone-shell.css', 'lib/studio-phone-shell.ts']) {
    const foreign = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`) + '\n' }, `${PHONE_SHELL_COVERAGE_SUBJECT} touches ${rel}${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched/, rel)
  }
})
// a branch stacked after this change: dev's merge brings it in by its SECOND parent, then a later change adds its own subject filter beside this change's in a taught proof
const SYN = { file: 'scripts/test-studio-deck-sync-truth.mjs', mark: 'registry read (SYNTHETIC-LATER)' }
const synStrip = (rel, text) => (rel === SYN.file && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.mark)).join('\n') : text)
const stackedAfter = () => {
  const dev = gateMerge(BASE_COMMIT, HEAD), taught = git('show', `${dev}:${SYN.file}`).split('\n')
  const at = taught.findIndex(line => line.includes('registry read (PHONE-SHELL-COVERAGE)')); assert.ok(at > 0, 'this change\'s subject filter is in the taught proof')
  taught.splice(at + 1, 0, `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Synthetic later:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: ${SYN.mark}: a made-up change stacked after this one`)
  return commitWith(dev, { [SYN.file]: taught.join('\n') }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
await scopeCheck('ROBUST AFTER MERGE: on a branch stacked after this change (dev\'s merge brings it in by a second parent, then a later change adds its subject filter beside this one\'s in a taught proof) no own commit is on the first-parent line, so the scope checks stand down there, and the pins, read past the later change\'s strip, still pass', () => {
  const later = stackedAfter(), readAt = rel => git('show', `${later}:${rel}`)
  assert.equal(ownOf(later).length, ownOf(HEAD).length, 'this change\'s commits are all there, by the second parent'); assert.deepEqual(ownOnLine(later), [], 'none of them on the first-parent line')
  provePins(readAt, 'stacked after', (rel, text) => synStrip(rel, laterStrips(rel, text)))
  assert.throws(() => provePins(readAt, 'stacked after, not told', laterStrips), /put back it is the base's/, 'mutant caught: without the later change\'s strip, its line breaks the put-back')
})

// ===== 7. mutants (each one edit of the real sources, fed to the same checks) ===========================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const helpSrc = read(HELP), viewsSrc = read(VIEWS), libSrc = read(LIB), shellCss = read(SHELL_CSS), hygSrc = read(HYGIENE_CSS)
const BAR_HELP = '{signedIn && STUDIO_PHONE_SHELL_COVERAGE_ENABLED && <StudioPhoneTabBar />}', BAR_VIEW = '{studioShell && STUDIO_PHONE_SHELL_COVERAGE_ENABLED && <StudioPhoneTabBar />}'
const libWith = (text, state) => { const lib = load(LIB, { env: stateEnv(...state), text }); assert.equal(lib.STUDIO_PHONE_SHELL_COVERAGE_ENABLED, isOn(...state)) }
await mutant('the flag is read as truthy, not exactly "true"', () => libWith(swap(libSrc, "flag === 'true' && phoneShell", "flag !== undefined && phoneShell"), ['false', 'true', 'true']))
await mutant('the flag no longer needs the phone shell', () => libWith(swap(libSrc, " && phoneShell === 'true'", ''), ['true', 'false', 'true']))
await mutant('the flag no longer needs the Studio shell', () => libWith(swap(libSrc, " && studioShell === 'true'", ''), ['true', 'true', 'false']))
await mutant('the flag is on by default (no flag needed)', () => libWith(swap(libSrc, "flag === 'true' && phoneShell", "phoneShell"), [undefined, 'true', 'true']))
await mutant('Help draws the bar signed out too (the rail is not drawn there)', () => proveHelp(swap(helpSrc, BAR_HELP, '{STUDIO_PHONE_SHELL_COVERAGE_ENABLED && <StudioPhoneTabBar />}')))
await mutant('Help draws the bar without the flag (flag-off HTML changes)', () => proveHelp(swap(helpSrc, BAR_HELP, '{signedIn && <StudioPhoneTabBar />}')))
await mutant('Help wraps the bar in a div (not a direct child: the stylesheet would not act)', () => proveHelp(swap(helpSrc, BAR_HELP, '{signedIn && STUDIO_PHONE_SHELL_COVERAGE_ENABLED && <div><StudioPhoneTabBar /></div>}')))
await mutant('Help draws the bar inside the column (not a child of the root)', () => proveHelp(swap(swap(helpSrc, helpSrc.split('\n').find(l => l.includes(BAR_HELP)) + '\n', ''), '<div data-studio-v4-shell-column="true">\n', `<div data-studio-v4-shell-column="true">\n        ${BAR_HELP}\n`)))
await mutant('Help draws the bar before the rail', () => proveHelp(swap(swap(helpSrc, helpSrc.split('\n').find(l => l.includes(BAR_HELP)) + '\n', ''), '      {signedIn && <StudioRail ', `      ${BAR_HELP}\n      {signedIn && <StudioRail `)))
await mutant('Help draws the bar twice', () => proveHelp(swap(helpSrc, BAR_HELP, `${BAR_HELP}${BAR_HELP}`)))
await mutant('Help\'s bar is drawn after the column (not next to the rail)', () => proveHelp(swap(swap(helpSrc, helpSrc.split('\n').find(l => l.includes(BAR_HELP)) + '\n', ''), '    </div>\n  )\n}\n\nexport function StudioSupportDraft', `      ${BAR_HELP}\n    </div>\n  )\n}\n\nexport function StudioSupportDraft`)))
await mutant('the load-error screen draws the bar without the Studio shell (no rail there)', () => proveProblem(swap(viewsSrc, BAR_VIEW, '{STUDIO_PHONE_SHELL_COVERAGE_ENABLED && <StudioPhoneTabBar />}')))
await mutant('the load-error screen draws the bar without the flag', () => proveProblem(swap(viewsSrc, BAR_VIEW, '{studioShell && <StudioPhoneTabBar />}')))
await mutant('the load-error screen wraps the bar in a div', () => proveProblem(swap(viewsSrc, BAR_VIEW, '{studioShell && STUDIO_PHONE_SHELL_COVERAGE_ENABLED && <div><StudioPhoneTabBar /></div>}')))
await mutant('the load-error screen draws the bar inside the card area (<main>)', () => proveProblem(swap(swap(viewsSrc, viewsSrc.split('\n').find(l => l.includes(BAR_VIEW)) + '\n', ''), '<main data-studio-problem-main="true">\n', `<main data-studio-problem-main="true">\n        ${BAR_VIEW}\n`)))
await mutant('the load-error screen draws the bar only for load_error', () => proveProblem(swap(viewsSrc, BAR_VIEW, "{studioShell && problem === 'load_error' && STUDIO_PHONE_SHELL_COVERAGE_ENABLED && <StudioPhoneTabBar />}")))
await mutant('a marker line is mistyped (the strip would leave it behind)', () => provePins(rel => rel === HELP ? swap(helpSrc, '@/lib/studio-phone-shell-coverage" // PHONE-SHELL-COVERAGE', '@/lib/studio-phone-shell-coverage" // PHONE-SHELL-COVERAG') : read(rel)))
await mutant('an existing line of Help is changed (not a pure insertion)', () => provePins(rel => rel === HELP ? swap(helpSrc, 'accountLoading = false', 'accountLoading = true') : read(rel)))
await mutant('a fourth marked line (a CSS import) is added to the load-error screen', () => provePins(rel => rel === VIEWS ? swap(viewsSrc, "import { Layers } from 'lucide-react'\n", "import { Layers } from 'lucide-react'\nimport './x.css' // PHONE-SHELL-COVERAGE\n") : read(rel)))
await mutant('a fourth line mentions the marker in prose', () => provePins(rel => rel === HELP ? swap(helpSrc, 'export function supportEmailDraftHref', '// the rail (PHONE-SHELL-COVERAGE) is not touched\nexport function supportEmailDraftHref') : read(rel)))
await mutant('the root rule loses its `:has(> bar)` key (it would apply to every shell root)', () => proveGeometry(swap(shellCss, '  [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) { --ss-rail-width: 0px;', '  [data-studio-v4-shell="true"] { --ss-rail-width: 0px;'), hygieneCss(), { width: 375, height: 812, safe: 0 }))
await mutant('the root loses the bar\'s height as bottom padding (the card would run under the bar)', () => proveGeometry(swap(shellCss, 'padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }\n  [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"][data-composer-focus', 'padding-bottom: 0; }\n  [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"][data-composer-focus'), hygieneCss(), { width: 375, height: 812, safe: 0 }))
await mutant('the brand tile is 64 px tall (it would cover the top of the card)', () => proveGeometry(swap(shellCss, 'width: 52px; height: 48px;', 'width: 52px; height: 64px;'), hygieneCss(), { width: 375, height: 812, safe: 0 }))
await mutant('the card area starts at 40 px (under the tile)', () => proveGeometry(shellCssText(), hygieneCss(swap(hygSrc, '{ margin-top: 48px; }', '{ margin-top: 40px; }')), { width: 375, height: 812, safe: 0 }))
await mutant('the card area keeps no bottom margin and the bar is taller (the card would reach the bar)', () => proveGeometry(swap(shellCss, 'height: calc(56px + env(safe-area-inset-bottom, 0px)); padding: 4px 6px', 'height: calc(72px + env(safe-area-inset-bottom, 0px)); padding: 4px 6px'), hygieneCss(), { width: 375, height: 812, safe: 0 }))
await mutant('the screen is not border-box (the root\'s bottom padding would push the card past 100dvh)', () => proveGeometry(shellCssText(), hygieneCss(swap(hygSrc, '  box-sizing: border-box;\n  display: flex;\n  width: 100%;', '  display: flex;\n  width: 100%;')), { width: 375, height: 812, safe: 0 }))
await mutant('the card area does not scroll inside itself', () => proveGeometry(shellCssText(), hygieneCss(swap(hygSrc, 'margin: 0 10px 10px 0; border: 1px solid var(--sk-line); border-radius: 14px; background: var(--sk-surface); overflow: auto;', 'margin: 0 10px 10px 0; border: 1px solid var(--sk-line); border-radius: 14px; background: var(--sk-surface); overflow: visible;')), { width: 375, height: 812, safe: 0 }))
await mutant('a bar of 56 px on a phone with a safe area, but a root padding without it (the card would reach under the inset)', () => proveGeometry(swap(shellCss, 'padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }\n  [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"][data-composer-focus', 'padding-bottom: 56px; }\n  [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"][data-composer-focus'), hygieneCss(), { width: 375, height: 812, safe: 34 }))

await mutant('the screen\'s root reserves a rail column with padding-left', () => proveNoRailColumn(shellCssText(), hygieneCss(swap(hygSrc, '[data-studio-skeleton="true"],\n[data-studio-session-problem] { height: 100dvh; overflow: hidden; }', '[data-studio-skeleton="true"],\n[data-studio-session-problem] { height: 100dvh; overflow: hidden; padding-left: var(--ss-rail-width, 56px); }'))))
await mutant('the screen\'s card area gets a left margin of the rail\'s width', () => proveNoRailColumn(shellCssText(), hygieneCss(swap(hygSrc, 'margin: 0 10px 10px 0; border: 1px solid var(--sk-line); border-radius: 14px; background: var(--sk-surface); overflow: auto;', 'margin: 0 10px 10px 56px; border: 1px solid var(--sk-line); border-radius: 14px; background: var(--sk-surface); overflow: auto;'))))
await mutant('the screen is a grid with a rail column', () => proveNoRailColumn(shellCssText(), hygieneCss(swap(hygSrc, '  box-sizing: border-box;\n  display: flex;\n  width: 100%;', '  box-sizing: border-box;\n  display: grid;\n  width: 100%;'))))
await mutant('the phone rule leaves the rail in the flow (no position: absolute: its column stays)', () => proveNoRailColumn(swap(shellCss, 'position: absolute; top: 0; left: 0; z-index: 46;', 'position: static; top: 0; left: 0; z-index: 46;'), hygieneCss()))
await mutant('the phone rail rule loses its `:has(> bar)` key (the rail\'s own rule would win or tie)', () => proveNoRailColumn(swap(shellCss, '  [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) > [data-studio-v4-rail] { position: absolute;', '  [data-studio-v4-shell="true"] > [data-studio-v4-rail] { position: absolute;'), hygieneCss()))

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
console.log('test-studio-phone-shell-coverage: all checks passed; no network.')
