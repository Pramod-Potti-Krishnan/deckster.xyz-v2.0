// FRONTEND-2 (25 Oct: the Pass 3 polish set, PR E, stacked on #509): proof for the flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time; PR A's flag, the SAME one as B, C and D).
// PR E puts right two phone side effects of PR A's section 2 (text controls are 16px on a phone, so iOS does not zoom): (E1) the Director prompt's empty hint wrapped at 16px and the composer toolbar (48px tall since PR A's section 4)
// covered its second line: only the hint (::placeholder) is made 12px on an 18px line, the prompt's own size without the Studio type scale, which fits one line at 390px; (E2) the Intelligence page's five task selects ran their value
// under the browser's chevron: they get 24px of right padding and text-overflow: ellipsis. The typed or chosen value keeps PR A's 16px. CSS only, in a stylesheet of its own, imported by one marked line in each of the two app files
// that draw PR A's hook (the Builder page and the account layout); PR A's stylesheet, its hook and every older test are left as they are.
// Run: node scripts/test-studio-pass3-polish-e.mjs   (plain node: postcss parse, the account layout transpiled and rendered with react-dom/server, `git show` reads the base commit; no network, no browser, no model call)
//
//   1. stylesheet  exactly two rules, each inside (max-width: 640px), each selector starting with <html data-studio-pass3-polish="true"> and the Studio shell and ending with PR A's section 2 guard (read from PR A's file, not copied);
//                  the exact selectors and declarations; no !important; the hint rule styles ::placeholder only (the typed text keeps 16px), the select rule touches the right padding and the overflow only; no FRONTEND-1 area outside the guard
//   2. facts       the hooks the selectors hang on are in the code and are the composer's and the Intelligence page's own; the "before" values (PR A's 16px / 1.5, its 32px toolbar buttons, the prompt's 96px box with 12px / 56px padding,
//                  the 12px / 18px the hint goes back to, the selects' 7px 6px padding and native chevron); the arithmetic: one 18px line ends at 30px, above the toolbar at 48px; PR A's two 24px lines ended at 60px
//   3. pin         the Builder page and the account layout without this change's marked line (marker PASS3-POLISH-E, a whole token) are BASE_COMMIT's files byte for byte, also through the registry; one marked line each, in its place;
//                  PR A's stylesheet and hook are the base's, byte for byte
//   4. flag off    the account layout renders the base commit's HTML in every flag state (sha256), the stylesheet imported once; no rule matches without the attribute, which only PR A's lib sets, exact "true" with the shell
//   5. change      the strip (one rule, whole-token marker), the registry (two lines, after the prompt-text PR's), scope (the COMMITTED diff only), no secret
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
  BASE_COMMIT, PASS3_POLISH_E_BUILDER, PASS3_POLISH_E_CSS, PASS3_POLISH_E_FILES, PASS3_POLISH_E_LAYOUT, PASS3_POLISH_E_MARKER_RE, PASS3_POLISH_E_OWN_EDITS, PASS3_POLISH_E_SCOPE_FILES, stripPass3PolishE,
} from './studio-pass3-polish-e-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const BASE = process.env.PASS3_POLISH_E_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
// This change's OWN committed files: the files of the non-merge commits in BASE..HEAD whose subject is this change's ("Pass 3 polish set, PR E: ..."), wherever they sit in the history. The working tree is never consulted.
const ownCommitted = () => {
  const files = new Set()
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [subject, ...names] = block.split('\n')
    if (/^Pass 3 polish set, PR E:/.test(subject)) for (const name of names) if (name) files.add(name)
  }
  return [...files]
}
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
let overrides = {} // in-memory mutations: every proof reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const marked = line => PASS3_POLISH_E_MARKER_RE.test(line) // this change's marker, as a WHOLE token
// What this change's own checks read: the file with every OTHER registered change's lines out (innermost, as every older pin reads it) and THIS change's own left in.
const withoutOthers = (rel, text) => {
  const si = LATER_STRIPS.indexOf(stripPass3PolishE)
  const mine = si >= 0 ? LATER_STRIPS.splice(si, 1)[0] : null
  try { return stripLaterChanges(rel, text) } finally { if (mine) LATER_STRIPS.splice(si, 0, mine) }
}

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), deep = count(assert.deepEqual), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const CSS = PASS3_POLISH_E_CSS, PAGE = PASS3_POLISH_E_BUILDER, LAYOUT = PASS3_POLISH_E_LAYOUT
const A_CSS = 'components/studio-pass3-polish/studio-pass3-polish.css', A_HOOK = 'hooks/use-studio-pass3-polish.ts', A_LIB = 'lib/studio-pass3-polish.ts'
const CHAT = 'components/builder/chat-input.tsx', TEXTAREA = 'components/ui/textarea.tsx', POPUPS = 'components/builder/studio-composer-popups-v2.css'
const INTEL = 'components/studio-personal/intelligence-p2.tsx', INTEL_CSS = 'components/studio-personal/intelligence-p2.css', INTEL_PAGE = 'components/studio-personal/intelligence-workspace.tsx', PERSONAL_CSS = 'components/studio-personal/personal-workspaces.css'
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-pass3-polish-e-strip.mjs', THIS_TEST = 'scripts/test-studio-pass3-polish-e.mjs'
const FLAG = 'NEXT_PUBLIC_STUDIO_PASS3_POLISH', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', PALETTE = 'NEXT_PUBLIC_STUDIO_V4_TOKENS', ATTR = 'data-studio-pass3-polish'
const SCOPE = `html[${ATTR}="true"]`, SHELLED = `${SCOPE} [data-studio-v4-shell="true"]`, PHONE = '(max-width: 640px)'
const CSS_IMPORT = '@/components/studio-pass3-polish/studio-pass3-polish-e.css'
// FRONTEND-1's areas, by the root attribute each carries (PR A's list). The guard is READ from PR A's section 2 (below), so a drift between the two files fails here.
const ZONES = ['[data-studio-settings]', '[data-studio-billing]', '[data-studio-p2-shortcuts]', '[data-studio-personal="details"]', '[data-studio-v4-profile]', '[data-studio-publish]', '[data-studio-publish-popup]', '[data-studio-publish-wizard]', '[data-studio-qa-inbox]', '[data-studio-published-viewer]', '[data-studio-published-ask]', '[data-studio-published-qa]', '[data-studio-p2-admin]', '[data-studio-p2-docs]', '[data-studio-p2-help]', '[data-studio-help-content]']
const GUARD = `:not(:is(${ZONES.join(', ')}) *)`
const HINT_SELECTOR = `${SHELLED} [data-studio-composer-prompt="true"] > textarea[data-studio-v4-type-role="prompt"]${GUARD}::placeholder`
const SELECT_SELECTOR = `${SHELLED} main[data-studio-personal="intelligence"] .sp-p2-pick > select${GUARD}`
const HINT_DECLS = { 'font-size': '12px', 'line-height': '18px' }
const SELECT_DECLS = { 'padding-right': '24px', 'text-overflow': 'ellipsis' }

// ---------------------------------------------------------------- 1. the stylesheet
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
  const tree = postcss.parse(text)
  const sections = [], rules = []
  let current = null
  for (const node of tree.nodes) {
    if (node.type === 'comment') {
      const m = /^={5} SECTION (E\d+): (.+?) ={5}$/.exec(node.text.trim())
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
function guardOfA(aText) { // PR A's section 2 font-size rule, as PR A's file has it: its selector's trailing :not(:is(...) *)
  let found = null
  postcss.parse(aText).walkRules(rule => { if (!found && /font-size/.test(rule.toString()) && rule.selector.includes('select, textarea')) found = rule.selector })
  assert.ok(found, 'PR A\'s section 2 font-size rule is found')
  const at = found.lastIndexOf(':not(:is(')
  return found.slice(at)
}
function proveCss(text, aText, at = '') {
  const a = message => (at ? `${at}: css: ${message}` : `css: ${message}`)
  const css = parseCss(text)
  eq(guardOfA(aText), GUARD, a('the guard is PR A\'s section 2 guard, word for word (all sixteen FRONTEND-1 roots)'))
  deep(css.sections.map(s => s.id), ['E1', 'E2'], a('two sections, E1 and E2, in order (named apart from PR A\'s numbered sections)'))
  deep(css.sections.map(s => s.title), ['the Director prompt\'s empty hint fits one line on a phone', 'the Intelligence task selects end in an ellipsis before the chevron on a phone'], a('their titles'))
  deep(css.sections.map(s => s.atRules.map(e => `@${e.name} ${e.params}`)), [[`@media ${PHONE}`], [`@media ${PHONE}`]], a('each section is one @media (max-width: 640px), PR A\'s phone breakpoint, and nothing else'))
  ok(css.sections.every(s => s.atRules.every(e => e.nested === 0)), a('no at-rule inside them'))
  eq(css.rules.length, 2, a('two rules in all, one per section'))
  for (const rule of css.rules) {
    eq(rule.selectors.length, 1, a('each rule has one selector'))
    ok(rule.selectors[0].startsWith(`${SHELLED} `), a(`every selector starts with ${SCOPE} and the Studio shell: ${rule.selectors[0].slice(0, 80)}`))
    ok(rule.decls.every(d => !d.important), a('no !important (the selectors win on specificity: PR A\'s rule sets the control, not its ::placeholder; the page\'s select rule is one class and one element)'))
    eq(rule.other, 0, a('no nested rule'))
    const bare = withoutNots(rule.selectors[0])
    nomatch(bare, /admin|settings|billing|shortcut|profile|details|publish|published|docs|help|qa-inbox|account|\/p\b/, a('no FRONTEND-1 area is named outside the :not() guard'))
  }
  const [e1, e2] = css.sections.map(s => s.atRules[0].rules[0])
  eq(e1.selectors[0], HINT_SELECTOR, a('E1: the Director prompt\'s ::placeholder, a direct child of the composer\'s prompt region, inside the shell, behind the guard'))
  ok(e1.selectors[0].endsWith(`${GUARD}::placeholder`), a('E1: the guard sits on the textarea and the pseudo-element is last'))
  deep(declMap(e1), HINT_DECLS, a('E1: the hint is 12px on an 18px line'))
  deep(e1.decls.map(d => d.prop), ['font-size', 'line-height'], a('E1 changes the hint\'s font size and line height and nothing else (no padding, height, width, overflow)'))
  eq(e2.selectors[0], SELECT_SELECTOR, a('E2: the Intelligence page\'s task selects (a direct child of .sp-p2-pick in the Intelligence main), inside the shell, behind the guard'))
  deep(declMap(e2), SELECT_DECLS, a('E2: 24px of right padding and an ellipsis'))
  deep(e2.decls.map(d => d.prop), ['padding-right', 'text-overflow'], a('E2 changes the right padding and the overflow and nothing else (no font size, height, width, left padding, appearance)'))
  nomatch(text.replace(/\/\*[\s\S]*?\*\//g, ''), /@import|@font-face|@keyframes|url\(|expression\(|behavior:|appearance|font-size:(?!\s*12px;)/, a('no import, font, animation, url(), appearance, and no font size but the hint\'s 12px'))
  for (const zone of ZONES) eq(text.replace(/\/\*[\s\S]*?\*\//g, '').split(zone).length - 1, 2, a(`${zone} appears exactly twice, once in each rule's guard`))
  return css
}

// ---------------------------------------------------------------- 2. the facts the rules hang on
function proveFacts(at = '') {
  const a = message => (at ? `${at}: facts: ${message}` : `facts: ${message}`)
  const chat = withoutOthers(CHAT, read(CHAT)), aCss = read(A_CSS), popups = read(POPUPS), intel = read(INTEL), intelCss = read(INTEL_CSS), intelPage = read(INTEL_PAGE), personalCss = read(PERSONAL_CSS)
  // E1's hook: the composer's prompt region and its one textarea
  eq((chat.match(/data-studio-v4-type-role="prompt"/g) || []).length, 1, a('one element in the composer is the prompt'))
  match(chat, /<PromptRegion \{\.\.\.\(studio \? \{ className: 'relative', 'data-studio-composer-prompt': 'true' \} : \{\}\)\}>/, a('the prompt region carries data-studio-composer-prompt="true" in the Studio'))
  match(chat, /const PromptRegion = studio \? 'div' : React\.Fragment/, a('and is a div there'))
  const open = "<PromptRegion {...(studio ? { className: 'relative', 'data-studio-composer-prompt': 'true' } : {})}>"
  eq(chat.split(open).length - 1, 1, a('one prompt region'))
  const region = chat.slice(chat.indexOf(open) + open.length, chat.indexOf('</PromptRegion>'))
  ok(region.includes('<Textarea') && region.includes('data-studio-v4-type-role="prompt"'), a('the prompt Textarea is inside the region'))
  const head = region.slice(0, region.indexOf('<Textarea')), rest = region.slice(region.indexOf('<Textarea'))
  nomatch(head, /<(div|span|label|section|form|p)[\s>]/, a('nothing is opened around it in the region (the > in the selector: it is the region\'s direct child)'))
  match(head, /\{\/\* Textarea \*\/\}\n {10}$/, a('the line before it is the region\'s own "Textarea" comment'))
  match(rest, /\n {10}\/>\n {10}$/, a('and its self-closing end is the last thing in the region'))
  match(read(TEXTAREA), /return \(\n\s+<textarea\n/, a('the Textarea component renders a bare <textarea>'))
  match(chat, /px-3 pt-3 pb-14 min-h-\[96px\] max-h-\[220px\] text-xs placeholder:text-gray-400/, a('the prompt is a 96px box with 12px of padding above and 56px below'))
  match(chat, /data-studio-v4-composer-toolbar="true"\n\s+className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 /, a('the toolbar sits in that bottom padding, absolutely, with 8px above and below its buttons'))
  match(chat, /\? \(deckOpen \? "Ask for a change, or describe a new deck…" : "What would you like to present\?"\)/, a('the hint the pictures show'))
  match(aCss, /\[data-studio-v4-composer-toolbar="true"\] button,[\s\S]*?min-height: 32px;/, a('PR A section 4: the toolbar\'s buttons are at least 32px, so the toolbar is 48px'))
  match(aCss, /:is\(textarea, \[contenteditable\]:not\(\[contenteditable="false"\]\)\)[^{]*\{\n\s+line-height: 1\.5 !important;/, a('PR A section 2: a textarea\'s line is 1.5 (24px at 16px)'))
  match(aCss, /select, textarea, \[contenteditable\][^{]*\{\n\s+font-size: 16px !important;/, a('PR A section 2: textareas and selects are 16px (on the control itself, so its ::placeholder inherits it unless a rule sets its own)'))
  match(popups, /\[data-studio-composer-popups-v2="true"\] textarea\[data-studio-v4-type-role="prompt"\] \{ font-size: 12px; line-height: 18px; \}/, a('12px / 18px is the prompt\'s own size without the Studio type scale (E1 goes back to it)'))
  match(popups, /\[data-studio-composer-popups-v2="true"\]\[data-studio-v4-type="true"\] textarea\[data-studio-v4-type-role="prompt"\] \{ font-size: 13\.6px; line-height: 20px; \}/, a('and 13.6px / 20px with the type scale (it wraps at 390px too: the PR body has the widths)'))
  // the arithmetic of E1: a one-line hint ends above the toolbar; PR A's two 24px lines did not
  const box = 96, padTop = 12, toolbar = 32 + 8 + 8
  const lineOf = decls => Number.parseFloat(decls['line-height'])
  ok(padTop + 1 * lineOf(HINT_DECLS) <= box - toolbar, a(`E1: one ${lineOf(HINT_DECLS)}px line ends at ${padTop + lineOf(HINT_DECLS)}px, above the toolbar at ${box - toolbar}px`))
  ok(padTop + 2 * 24 > box - toolbar, a(`PR A: two 24px lines ended at ${padTop + 48}px, under the toolbar from ${box - toolbar}px (the defect)`))
  // E2's hook: the Intelligence page's task selects
  match(intelPage, /<main className="sp-workspace sp-intelligence" data-studio-personal="intelligence" /, a('the Intelligence page is a main with data-studio-personal="intelligence"'))
  match(intel, /<div className="sp-p2-pick">\n\s+<label className="sr-only" htmlFor=\{`sp-p2-model-\$\{task\.id\}`\}>\{task\.label\} model<\/label>\n\s+<select id=\{`sp-p2-model-\$\{task\.id\}`\}/, a('each task select is a direct child of .sp-p2-pick (one per task)'))
  eq((intel.match(/className="sp-p2-pick"/g) || []).length, 1, a('.sp-p2-pick is drawn in one place, the task rows'))
  eq((intel.match(/<select[\s>]/g) || []).length, 2, a('the file has two selects: the task select and the comparison select'))
  match(intel, /<label className="sp-field"><span>Compare with<\/span><select value=\{comparison\}/, a('the comparison select sits in a label.sp-field, outside .sp-p2-pick: E2 leaves it (its value fits at 16px)'))
  match(intelCss, /\.sp-p2-pick select \{ width: 100%; min-height: 34px; min-width: 0; border: 1px solid var\(--sp-line\); border-radius: 7px; padding: 7px 6px; background: var\(--sp-panel\); color: var\(--sp-text\); font-size: 11px; \}/, a('before: 7px 6px of padding and 11px type'))
  for (const [rel, text] of [[INTEL_CSS, intelCss], [PERSONAL_CSS, personalCss]]) nomatch(text, /appearance|background-image/, a(`${rel}: no appearance or background image: the chevron is the browser's own, drawn over the right padding`))
  nomatch(intelCss, /text-overflow/, a('the page sets no text-overflow of its own on them'))
}

// ---------------------------------------------------------------- 3. the pin (the Builder page and the account layout), PR A's files untouched
const LINE_RE = {
  [PAGE]: /^import '@\/components\/studio-pass3-polish\/studio-pass3-polish-e\.css' \/\/ PASS3-POLISH-E \(NEXT_PUBLIC_STUDIO_PASS3_POLISH, default off\): /,
  [LAYOUT]: /^import "@\/components\/studio-pass3-polish\/studio-pass3-polish-e\.css" \/\/ PASS3-POLISH-E \(NEXT_PUBLIC_STUDIO_PASS3_POLISH, default off\): /,
}
const AFTER = {
  [PAGE]: "import { useStudioPass3Polish } from '@/hooks/use-studio-pass3-polish' // PASS3-POLISH",
  [LAYOUT]: 'import { StudioPass3PolishMount } from "@/components/studio-pass3-polish/studio-pass3-polish-mount" // PASS3-POLISH',
}
function provePin(rel, text, stripFn = stripPass3PolishE, at = '') {
  const a = message => (at ? `${at}: ${rel}: ${message}` : `${rel}: ${message}`)
  const base = withoutOthers(rel, baseOf(rel)), own = withoutOthers(rel, text)
  const stripped = stripFn(rel, own)
  eq(sha(stripped), sha(base), a('without this change\'s line it is the base commit\'s file, byte for byte'))
  eq(sha(stripFn(rel, text)), sha(baseOf(rel)), a('and the file as it is (every stacked change\'s lines in it) without this change\'s line is the base commit\'s file as it is'))
  eq(sha(stripLaterChanges(rel, text)), sha(stripLaterChanges(rel, baseOf(rel))), a('and through the registry (innermost, as every older pin reads it) it is the base commit\'s file'))
  ok(!stripped.split('\n').some(marked) && !base.split('\n').some(marked), a('neither the stripped file nor the base carries the marker'))
  const lines = text.split('\n'), mine = lines.filter(marked)
  deep(lines.filter(line => !marked(line)), baseOf(rel).split('\n'), a('every base line is there, in order, none changed'))
  eq(mine.length, 1, a('exactly one line is this change\'s'))
  ok(LINE_RE[rel].test(mine[0]), a('it is the import of this change\'s stylesheet, marked'))
  eq(lines[lines.indexOf(mine[0]) - 1], AFTER[rel], a('right after PR A\'s line that brings the polish set in'))
  nomatch(mine[0].replace(/\/\/.*$/, ''), /process\.env/, a('the line reads no environment'))
  eq(stripFn(rel, stripFn(rel, text)), stripFn(rel, text), a('stripping twice changes nothing more'))
}
function proveUntouched(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of [A_CSS, A_HOOK, A_LIB, CHAT, INTEL, INTEL_CSS, POPUPS]) eq(sha(read(rel)), sha(baseOf(rel)), a(`${rel} is the base commit's, byte for byte (PR A's stylesheet, hook and lib, and the composer and Intelligence files, are not edited)`))
  eq((read(A_HOOK).match(/^import '@\/components\/studio-pass3-polish\/studio-pass3-polish\.css'$/gm) || []).length, 1, a('PR A\'s hook still imports PR A\'s stylesheet, once'))
  nomatch(read(A_HOOK), /studio-pass3-polish-e/, a('and not this one (PR A\'s proof loads the hook with only its own imports stood in)'))
}

// ---------------------------------------------------------------- 4. flag off
const LAYOUT_STATES = []
for (const flag of [undefined, 'false', 'TRUE', '1', 'yes', ' true', 'true']) for (const shell of ['true', 'false', undefined]) for (const palette of ['true', undefined]) LAYOUT_STATES.push({ flag, shell, palette })
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
function renderLayout(text, st) {
  const env = { ...(st.flag === undefined ? {} : { [FLAG]: st.flag }), ...(st.shell === undefined ? {} : { [SHELL]: st.shell }), ...(st.palette === undefined ? {} : { [PALETTE]: st.palette }) }
  const h = React.createElement, imports = []
  const mocks = {
    './studio-v4-account.css': {}, '@/components/layout/studio-shell.css': {},
    '@/components/layout/app-header': { AppHeader: () => h('header', { id: 'header' }), BackToBuilderButton: () => h('button', { id: 'back' }) },
    '@/components/layout/studio-rail': { StudioRail: props => h('aside', { id: 'rail' }, props.studioEntry) },
    '@/lib/studio-payments-open-soon': { STUDIO_PAYMENTS_OPEN_SOON_ENABLED: false },
    '@/components/billing/studio-payments-open-soon-mount': { StudioPaymentsOpenSoonMount: () => h('i', { 'data-mount': 'payments' }) },
    '@/lib/studio-duplicate-copy-title': { STUDIO_DUPLICATE_COPY_TITLE_ENABLED: false },
    '@/components/builder/studio-duplicate-copy-title-mount': { StudioDuplicateCopyTitleMount: () => h('i', { 'data-mount': 'dup' }) },
    '@/lib/studio-pass3-polish': { STUDIO_PASS3_POLISH_ENABLED: env[FLAG] === 'true' && env[SHELL] === 'true' },
    '@/components/studio-pass3-polish/studio-pass3-polish-mount': { StudioPass3PolishMount: () => h('i', { 'data-mount': 'pass3' }) },
  }
  const module = { exports: {} }
  const req = spec => {
    if (spec === CSS_IMPORT) { imports.push(spec); return {} }
    if (Object.prototype.hasOwnProperty.call(mocks, spec)) return mocks[spec]
    if (spec === 'react/jsx-runtime') return jsxRuntime
    throw new Error(`unexpected import ${spec} in ${LAYOUT}`)
  }
  vm.runInNewContext(compile(LAYOUT, text), { module, exports: module.exports, require: req, process: { env } }, { filename: LAYOUT })
  return { html: renderToStaticMarkup(module.exports.default({ children: 'page' })), imports }
}
function proveFlagOff(layoutText, cssText, at = '') {
  const a = message => (at ? `${at}: flag off: ${message}` : `flag off: ${message}`)
  const head = [], base = []
  for (const st of LAYOUT_STATES) {
    const h = renderLayout(withoutOthers(LAYOUT, layoutText), st), b = renderLayout(withoutOthers(LAYOUT, baseOf(LAYOUT)), st) // every other change's lines out on both sides (PR A's mount too), this change's line in on the head
    eq(h.html, b.html, a(`the account layout in ${JSON.stringify(st)} renders the base commit's HTML`))
    deep(h.imports, [CSS_IMPORT], a('the layout imports this change\'s stylesheet once'))
    deep(b.imports, [], a('(the base did not)'))
    head.push(h.html); base.push(b.html)
  }
  eq(sha(head.join('\n')), sha(base.join('\n')), a(`sha256 over ${LAYOUT_STATES.length} states (flag on included: the change is CSS only) is the base commit's`))
  // no rule matches without the attribute: every selector's first compound is html[data-studio-pass3-polish="true"], followed by a descendant combinator
  const tree = postcss.parse(cssText)
  tree.walkRules(rule => { for (const s of splitTop(rule.selector)) ok(s.startsWith(`${SCOPE} `) && !/,/.test(withoutNots(s)), a('every selector needs <html data-studio-pass3-polish="true">: without it no rule of this file matches anything')) })
  match(read(A_LIB), /export const STUDIO_PASS3_POLISH_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'/, a('the attribute is PR A\'s, set only with the flag exactly "true" and the Studio shell'))
  match(read(A_HOOK), /if \(!STUDIO_PASS3_POLISH_ENABLED\) return\n\s+return installPass3Polish\(document\)/, a('and PR A\'s hook sets it only then'))
  return { states: LAYOUT_STATES.length, base: sha(base.join('\n')), head: sha(head.join('\n')) }
}

// ---------------------------------------------------------------- 5. the change: strip, registry, scope, secret scan
function proveStrip(stripFn, at = '') {
  const a = message => (at ? `${at}: strip: ${message}` : `strip: ${message}`)
  eq(stripFn('lib/other.ts', 'x // PASS3-POLISH-E'), 'x // PASS3-POLISH-E', a('any other file is returned as it is'))
  eq(stripFn(PAGE, 'a\nb // PASS3-POLISH-E (x): y\nc\n'), 'a\nc\n', a('a marked line goes, every other byte stays (trailing newline too)'))
  eq(stripFn(LAYOUT, 'a\nimport "x.css" // PASS3-POLISH-E (y)\nb'), 'a\nb', a('the layout the same'))
  const keep = 'a\nb // PASS3-POLISH\nc // PASS3-POLISH-B\nd // PASS3-POLISH-C\ne // PASS3-POLISH-D\nf // PASS3-POLISH-EE\ng // XPASS3-POLISH-E\nh // PASS3-POLISH-E-x\n'
  eq(stripFn(PAGE, keep), keep, a('only this change\'s marker, as a whole token, takes a line out: PR A\'s, B\'s, C\'s and D\'s lines stay for their own strips'))
  eq(stripFn(PAGE, 7), 7, a('a non-string comes back'))
  deep(PASS3_POLISH_E_FILES, [PAGE, LAYOUT], a('the strip touches the Builder page and the account layout only'))
  ok(!/(?<![\w-])PASS3-POLISH(?![\w-])/.test(read(PAGE).split('\n').filter(marked).join('\n')) && !/(?<![\w-])PASS3-POLISH(?![\w-])/.test(read(LAYOUT).split('\n').filter(marked).join('\n')), a('PR A\'s whole-token marker does not match this change\'s lines (PR A\'s strip leaves them)'))
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: registry: ${message}` : `registry: ${message}`)
  const lines = registryText.split('\n').filter(line => line.includes("'./studio-pass3-polish-e-strip.mjs'"))
  eq(lines.length, 2, a('exactly two lines for this change: its files and its strip (no .env.example block)'))
  ok(lines.every(line => line.includes('// LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR E (NEXT_PUBLIC_STUDIO_PASS3_POLISH')), a('each carries the LATER-CHANGE marker'))
  match(lines[0], /^ {2}\.\.\.\(await import\('\.\/studio-pass3-polish-e-strip\.mjs'\)\)\.PASS3_POLISH_E_SCOPE_FILES,/, a('line 1: the files'))
  match(lines[1], /^ {2}\(await import\('\.\/studio-pass3-polish-e-strip\.mjs'\)\)\.stripPass3PolishE,/, a('line 2: the strip'))
  const at1 = registryText.indexOf(lines[0]), at2 = registryText.indexOf(lines[1]), files = registryText.indexOf('export const LATER_CHANGE_FILES'), blocks = registryText.indexOf('export const LATER_ENV_BLOCKS'), strips = registryText.indexOf('export const LATER_STRIPS')
  ok(files < at1 && at1 < blocks && strips < at2, a('the files line is in LATER_CHANGE_FILES, the strip line in LATER_STRIPS'))
  const pFiles = registryText.indexOf("'./studio-bulk-edit-prompt-text-strip.mjs')).BULK_EDIT_PROMPT_TEXT_SCOPE_FILES"), pStrip = registryText.indexOf("'./studio-bulk-edit-prompt-text-strip.mjs')).stripBulkEditPromptText")
  ok(pFiles > 0 && pFiles < at1 && pStrip > 0 && pStrip < at2, a('each comes after the prompt-text PR\'s line in the same list (a union on merge keeps all)'))
  ok(!registryText.slice(blocks, strips).includes('studio-pass3-polish-e-strip'), a('nothing of this change is in LATER_ENV_BLOCKS'))
  ok(LATER_STRIPS.includes(stripPass3PolishE) || LATER_STRIPS.some(fn => fn.name === 'stripPass3PolishE'), a('the registry holds the strip'))
  ok([...PASS3_POLISH_E_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('the registry names every file of this change'))
  ok(!LATER_ENV_BLOCKS.some(block => /PASS3-POLISH-E/.test(String(block))), a('no env block of its own'))
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: scope: ${message}` : `scope: ${message}`)
  ok([...PASS3_POLISH_E_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
  const family = ['lib', 'hooks', 'components', 'scripts'].flatMap(dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? (/pass3-polish/.test(entry.name) ? fs.readdirSync(path.join(root, dir, entry.name)).map(name => `${dir}/${entry.name}/${name}`) : []) : [`${dir}/${entry.name}`]).filter(rel => /pass3-polish-e(?![\w])/.test(rel)) : [])
  deep(family.filter(rel => !PASS3_POLISH_E_SCOPE_FILES.has(rel)), [], a('no file of this change\'s family is missing from its list'))
  for (const rel of PASS3_POLISH_E_SCOPE_FILES) nomatch(rel, /^app\/admin|^components\/admin|^app\/docs|^components\/studio-docs|^app\/help|^components\/help|^app\/p\/|publish|published|^components\/settings|^app\/\(app\)\/settings|^app\/\(app\)\/billing|^components\/billing|user-profile-menu|^app\/\(app\)\/profile|^app\/\(app\)\/shortcuts|^components\/studio-personal\/(details|studio-p2-details|account)/, a(`${rel} is not in FRONTEND-1's areas`))
  const committed = ownCommitted()
  const stray = committed.filter(rel => !PASS3_POLISH_E_SCOPE_FILES.has(rel))
  deep(stray, [], a(`every file in this change's committed diff (${BASE.slice(0, 8)}..HEAD) is its own`))
  if (committed.length) {
    deep([...PASS3_POLISH_E_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    deep(committed.filter(rel => /^scripts\/test-/.test(rel)), [THIS_TEST], a('the only test it adds or edits is its own (no older test is edited)'))
    deep(committed.filter(rel => !/^scripts\//.test(rel)).sort(), [LAYOUT, PAGE, CSS].sort(), a('the app files it changes: the new stylesheet, the Builder page and the account layout (not PR A\'s stylesheet or hook)'))
    deep(committed.filter(rel => /^scripts\//.test(rel) && rel !== THIS_TEST).sort(), [...PASS3_POLISH_E_OWN_EDITS, STRIP_MODULE].sort(), a('the other scripts: the registry and its own strip'))
  }
}
function proveSecretScan(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [CSS, STRIP_MODULE, THIS_TEST].map(read).concat(read(PAGE).split('\n').filter(marked), read(LAYOUT).split('\n').filter(marked)).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
}

// ---------------------------------------------------------------- run everything
function proveAll(stripFn = stripPass3PolishE, at = '') {
  proveCss(read(CSS), read(A_CSS), at)
  proveFacts(at)
  provePin(PAGE, read(PAGE), stripFn, at)
  provePin(LAYOUT, read(LAYOUT), stripFn, at)
  proveUntouched(at)
  const digest = proveFlagOff(read(LAYOUT), read(CSS), at)
  proveStrip(stripFn, at)
  proveRegistry(read(REGISTRY), at)
  proveScope(at)
  proveSecretScan(at)
  return digest
}
const digest = proveAll()
console.log(`flag off: the account layout renders the base commit's HTML in ${digest.states} flag states, sha256 base ${digest.base.slice(0, 16)} == head ${digest.head.slice(0, 16)}; every rule needs <html ${ATTR}="true">`)
console.log(`PASS stylesheet, facts, pin, flag off, change: ${checks} checks`)

// =========================================================== 6. mutants
const killed = [], survived = []
async function mutant(name, edits, { strip = stripPass3PolishE } = {}) {
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
    killed.push(name); if (process.env.PASS3_POLISH_E_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
const css = (from, to, mode) => [CSS, from, to, mode]
const E1_HEAD = `  ${SHELLED} [data-studio-composer-prompt="true"] > textarea[data-studio-v4-type-role="prompt"]${GUARD}::placeholder {`
const E2_HEAD = `  ${SHELLED} main[data-studio-personal="intelligence"] .sp-p2-pick > select${GUARD} {`
const PAGE_LINE = "import '@/components/studio-pass3-polish/studio-pass3-polish-e.css' // PASS3-POLISH-E"
const LAYOUT_LINE = 'import "@/components/studio-pass3-polish/studio-pass3-polish-e.css" // PASS3-POLISH-E'
const PAGE_FULL = read(PAGE).split('\n').find(marked), LAYOUT_FULL = read(LAYOUT).split('\n').find(marked)
// the stylesheet: E1
await mutant('css E1: the hint is 13.6px (the type scale\'s size: it wraps at 390px)', [css('    font-size: 12px;\n    line-height: 18px;', '    font-size: 13.6px;\n    line-height: 20px;')])
await mutant('css E1: the hint keeps PR A\'s 24px line', [css('    line-height: 18px;', '    line-height: 24px;')])
await mutant('css E1: the textarea is shrunk, not its hint (iOS would zoom again)', [css(`${GUARD}::placeholder {`, `${GUARD} {`)])
await mutant('css E1: !important', [css('    font-size: 12px;', '    font-size: 12px !important;')])
await mutant('css E1: the hint is clipped instead', [css('    line-height: 18px;\n', '    line-height: 18px;\n    overflow: hidden;\n')])
await mutant('css E1: every textarea\'s hint', [css(E1_HEAD, `  ${SCOPE} textarea${GUARD}::placeholder {`)])
await mutant('css E1: outside the shell', [css(E1_HEAD, E1_HEAD.replace(' [data-studio-v4-shell="true"]', ''))])
await mutant('css E1: without the attribute', [css(E1_HEAD, E1_HEAD.replace(`${SCOPE} `, ''))])
await mutant('css E1: the guard is gone', [css(E1_HEAD, E1_HEAD.replace(GUARD, ''))])
await mutant('css E1: the guard drops Settings', [css(E1_HEAD, E1_HEAD.replace('[data-studio-settings], ', ''))])
await mutant('css E1: the breakpoint is 768px', [css('@media (max-width: 640px) {\n  html[data-studio-pass3-polish="true"] [data-studio-v4-shell="true"] [data-studio-composer-prompt', '@media (max-width: 768px) {\n  html[data-studio-pass3-polish="true"] [data-studio-v4-shell="true"] [data-studio-composer-prompt')])
await mutant('css E1: any descendant textarea, not the region\'s child', [css(E1_HEAD, E1_HEAD.replace('"] > textarea', '"] textarea'))])
// the stylesheet: E2
await mutant('css E2: no room for the chevron (6px)', [css('    padding-right: 24px;', '    padding-right: 6px;')])
await mutant('css E2: clipped, not ellipsized', [css('    text-overflow: ellipsis;', '    text-overflow: clip;')])
await mutant('css E2: the select is shrunk to 11px (iOS would zoom again)', [css('    text-overflow: ellipsis;\n', '    text-overflow: ellipsis;\n    font-size: 11px;\n')])
await mutant('css E2: the chevron is replaced (appearance: none)', [css('    text-overflow: ellipsis;\n', '    text-overflow: ellipsis;\n    appearance: none;\n')])
await mutant('css E2: both paddings change', [css('    padding-right: 24px;', '    padding: 7px 24px;')])
await mutant('css E2: every select in the Studio', [css(E2_HEAD, `  ${SHELLED} select${GUARD} {`)])
await mutant('css E2: the guard is gone', [css(E2_HEAD, E2_HEAD.replace(GUARD, ''))])
await mutant('css E2: the guard drops Your details', [css(E2_HEAD, E2_HEAD.replace('[data-studio-personal="details"], ', ''))])
await mutant('css E2: on Your details, not Intelligence', [css(E2_HEAD, E2_HEAD.replace('main[data-studio-personal="intelligence"]', 'main[data-studio-personal="details"]'))])
await mutant('css E2: outside the phone query', [css('@media (max-width: 640px) {\n  html[data-studio-pass3-polish="true"] [data-studio-v4-shell="true"] main', '@media (min-width: 1px) {\n  html[data-studio-pass3-polish="true"] [data-studio-v4-shell="true"] main')])
await mutant('css: a Settings rule slipped in', [css('\n/* ===== SECTION E2:', `\n@media ${PHONE} {\n  ${SHELLED} [data-studio-settings] select {\n    padding-right: 24px;\n  }\n}\n\n/* ===== SECTION E2:`)])
await mutant('css: a rule outside any query', [css('\n/* ===== SECTION E2:', `\n${SHELLED} .x { color: red; }\n\n/* ===== SECTION E2:`)])
await mutant('PR A\'s stylesheet: its guard drops Publish (this file\'s guard is checked against it)', [[A_CSS, '[data-studio-publish], [data-studio-publish-popup]', '[data-studio-publish-popup]', 'all']])
// the facts
await mutant('facts: the prompt region loses its attribute', [[CHAT, "'data-studio-composer-prompt': 'true'", "'data-studio-composer-region': 'true'"]])
await mutant('facts: the prompt is wrapped in a div inside the region', [[CHAT, '          {/* Textarea */}\n          <Textarea', '          {/* Textarea */}\n          <div><Textarea']])
await mutant('facts: the toolbar\'s padding grows', [[CHAT, 'absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 ', 'absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-4 ']])
await mutant('facts: the select is wrapped inside .sp-p2-pick', [[INTEL, '<div className="sp-p2-pick">', '<div className="sp-p2-pick"><span>']])
await mutant('facts: the page draws its own chevron', [[INTEL_CSS, 'color: var(--sp-text); font-size: 11px; }', 'color: var(--sp-text); font-size: 11px; appearance: none; }']])
await mutant('facts: the Intelligence main is renamed', [[INTEL_PAGE, 'data-studio-personal="intelligence" data-studio-intro-surface="models"', 'data-studio-personal="models" data-studio-intro-surface="models"']])
// the pins
await mutant('page: the import loses its marker', [[PAGE, PAGE_LINE, "import '@/components/studio-pass3-polish/studio-pass3-polish-e.css' //"]])
await mutant('page: the import moves above PR A\'s', [[PAGE, `${AFTER[PAGE]}\n${PAGE_FULL}\n`, `${PAGE_FULL}\n${AFTER[PAGE]}\n`]])
await mutant('page: an unmarked line added', [[PAGE, PAGE_LINE, `const unmarked = 1\n${PAGE_LINE}`]])
await mutant('page: a base line changed', [[PAGE, AFTER[PAGE], AFTER[PAGE].replace("'@/hooks/use-studio-pass3-polish'", "'@/hooks/use-studio-pass3-polish.ts'")]])
await mutant('page: the import is gone (the Builder would not get E1)', [[PAGE, `${PAGE_FULL}\n`, '']])
await mutant('layout: imports PR A\'s stylesheet again instead', [[LAYOUT, LAYOUT_LINE, 'import "@/components/studio-pass3-polish/studio-pass3-polish.css" // PASS3-POLISH-E']])
await mutant('layout: the import is gone (Intelligence would not get E2)', [[LAYOUT, `${LAYOUT_FULL}\n`, '']])
await mutant('layout: the import moves to the top', [[LAYOUT, `${LAYOUT_FULL}\n`, ''], [LAYOUT, 'import type { ReactNode } from "react"\n', `import type { ReactNode } from "react"\n${LAYOUT_FULL}\n`]])
await mutant('layout: renders something with the flag', [[LAYOUT, '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}', '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}\n      {STUDIO_PASS3_POLISH_ENABLED && <i data-e="1" />}{/* PASS3-POLISH-E */}']])
await mutant('hook: PR A\'s hook takes the import (PR A\'s proof would fail)', [[A_HOOK, "import '@/components/studio-pass3-polish/studio-pass3-polish.css'\n", "import '@/components/studio-pass3-polish/studio-pass3-polish.css'\nimport '@/components/studio-pass3-polish/studio-pass3-polish-e.css'\n"]])
await mutant('PR A\'s stylesheet: edited (a rule appended)', [[A_CSS, '/* ===== APPEND POINT:', `@media ${PHONE} {\n  ${SCOPE} textarea::placeholder {\n    font-size: 12px;\n  }\n}\n\n/* ===== APPEND POINT:`]])
await mutant('flag: PR A\'s constant no longer needs the Studio shell', [[A_LIB, " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", '']])
// the strip, the registry
await mutant('strip: leaves the marked lines', [], { strip: (rel, text) => text })
await mutant('strip: the marker is a substring (PR A\'s lines go with this one\'s)', [], { strip: (rel, text) => (PASS3_POLISH_E_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes('PASS3-POLISH')).join('\n') : text) })
await mutant('strip: drops the trailing newline', [], { strip: (rel, text) => stripPass3PolishE(rel, text).replace(/\n$/, '') })
await mutant('strip: also removes an unmarked line', [], { strip: (rel, text) => (PASS3_POLISH_E_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !marked(line) && !line.startsWith('import type { ReactNode }')).join('\n') : text) })
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-pass3-polish-e-strip.mjs')).PASS3_POLISH_E_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR E (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)\n", '']])
await mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-pass3-polish-e-strip.mjs')).stripPass3PolishE, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR E (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n", '']])
await mutant('registry: the strip line moves above the prompt-text PR\'s', [[REGISTRY, "  (await import('./studio-bulk-edit-prompt-text-strip.mjs')).stripBulkEditPromptText, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)\n  (await import('./studio-pass3-polish-e-strip.mjs')).stripPass3PolishE, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR E (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n", "  (await import('./studio-pass3-polish-e-strip.mjs')).stripPass3PolishE, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR E (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n  (await import('./studio-bulk-edit-prompt-text-strip.mjs')).stripBulkEditPromptText, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)\n"]])
await mutant('secret scan: a credential-shaped literal', [[STRIP_MODULE, "export const PASS3_POLISH_E_MARKER = 'PASS3-POLISH-E'", `export const PASS3_POLISH_E_MARKER = 'PASS3-POLISH-E'\nconst ${['api', 'Key'].join('')} = '${['AKIA', 'ABCDEFGH', '12345678'].join('')}'`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.log('SURVIVED:\n  ' + survived.join('\n  ')); process.exit(1) }
console.log(`test-studio-pass3-polish-e: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
