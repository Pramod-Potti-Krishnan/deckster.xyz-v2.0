// FRONTEND-2 (25 Oct: the Pass 3 polish set, PR G, cut from the Studio dev head 15e2d90f, #512): proof for the flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time; PR A's flag, the SAME one as B to F).
// PR G is PK's decision C of the phone review (25 Oct), "Original sizes, iPhone-only zoom fix": PR A's section 2 (every phone text control 16px with a 1.5 / 1.35 line, !important, so iOS Safari does not zoom the page when one takes
// focus) is taken out of PR A's stylesheet, so a phone's text controls keep the sizes and lines the Studio's own stylesheets give them, and the zoom is stopped where it happens instead: on iPhone and iPad ONLY, the viewport meta
// gets maximum-scale=1 (lib/studio-pass3-polish-g.ts). PR E's E1 (the composer's empty hint, 12px on one line, which PK likes), E2 and PR F's F1 are not touched.
// THE INTELLIGENCE "AUTO" LABEL (PK's decision D) IS NOT IN THIS CHANGE: lib/studio-intelligence-p2.ts is FRONTEND-1's and scripts/test-studio-p2-intelligence.mjs pins its two "Recommended" lines byte for byte WITHOUT the registry
// (it reads through stripP2Polish and stripLaunchWording only; line 41 reads, lines 218-230 and the mutant at line 670 pin the exact text). It waits for PK's OK of a registry-read patch to that test.
// Run: node scripts/test-studio-pass3-polish-g.mjs   (plain node: postcss parse, the helper and the account layout transpiled and run in a vm, `git show` reads the base commit; no network, no browser, no model call)
//
//   1. stylesheet  PR A's section 2 is a comment only (no rule); sections 1, 3, 4, 5 are the base's text; no font-size or line-height in A's stylesheet; the polish set sets a font size in ONE place, E1's ::placeholder (12px / 18px);
//                  PR E's and PR F's stylesheets are the base's, byte for byte; the removed text comes back through the strip (the older proofs read it); the numbers E1 stands on (96px box, 12px / 56px padding, 48px toolbar)
//   2. viewport    iosZoomViewportContent: iPhone, iPod, iPad, iPadOS in desktop mode (Macintosh + touch), and NOT Mac Safari, Mac Chrome, Android, Windows touch laptops, Linux; content kept, maximum-scale=1 added or set; pure
//   3. installer   installIosZoomFix and the hook, run in a vm with stand-ins: iOS gets the content and gives it back, every other device has the meta read and never written, strict mode, two holders, a meta that changed meanwhile;
//                  flag off the hook returns before it reads the document or the navigator (a stand-in that throws on any read)
//   4. pin         the Builder page and the account layout without this change's marked lines (marker PASS3-POLISH-G, a whole token) are BASE_COMMIT's files byte for byte, also through the registry; two lines each;
//                  the account layout renders the base commit's HTML in every flag state (sha256), and with the flag on only the one new mount is added
//   5. change      the strip (marker, restore table, pin edits), the registry (two lines), the older proofs it teaches (back to the base byte for byte), scope (the COMMITTED diff only), no secret
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
  BASE_COMMIT, PASS3_POLISH_G_A_CSS, PASS3_POLISH_G_BUILDER, PASS3_POLISH_G_FILES, PASS3_POLISH_G_LAYOUT, PASS3_POLISH_G_LIB, PASS3_POLISH_G_MARKER_RE, PASS3_POLISH_G_MOUNT, PASS3_POLISH_G_NEW_FILES,
  PASS3_POLISH_G_OWN_EDITS, PASS3_POLISH_G_PIN_EDITS, PASS3_POLISH_G_PIN_FILES, PASS3_POLISH_G_SCOPE_FILES, PASS3_POLISH_G_SECTION_2, PASS3_POLISH_G_SECTION_2_STUB, putBackPin, stripPass3PolishG,
} from './studio-pass3-polish-g-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const BASE = process.env.PASS3_POLISH_G_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
// This change's OWN committed files: the files of the non-merge commits in BASE..HEAD whose subject is this change's ("Pass 3 polish set, PR G: ..."), wherever they sit in the history. The working tree is never consulted.
const ownCommitted = () => {
  const files = new Set()
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [subject, ...names] = block.split('\n')
    if (/^Pass 3 polish set, PR G:/.test(subject)) for (const name of names) if (name) files.add(name)
  }
  return [...files]
}
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
let overrides = {} // in-memory mutations: every proof reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value))) // values made inside the vm have the vm's prototypes
const marked = line => PASS3_POLISH_G_MARKER_RE.test(line)
// What this change's own checks read: the file with every OTHER registered change's lines out (innermost, as every older pin reads it) and THIS change's own left in.
const withoutOthers = (rel, text) => {
  const si = LATER_STRIPS.indexOf(stripPass3PolishG)
  const mine = si >= 0 ? LATER_STRIPS.splice(si, 1)[0] : null
  try { return stripLaterChanges(rel, text) } finally { if (mine) LATER_STRIPS.splice(si, 0, mine) }
}

// FRONTEND-2, stack: the file with only the changes registered AFTER this one taken out (the registry's order), this change's own lines and every older change's left in.
const withoutLater = (rel, text) => LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripPass3PolishG) + 1).reduce((out, strip) => strip(rel, out), text)

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), deep = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message)), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const A_CSS = PASS3_POLISH_G_A_CSS, E_CSS = 'components/studio-pass3-polish/studio-pass3-polish-e.css', F_CSS = 'components/studio-pass3-polish/studio-pass3-polish-f.css'
const LIB = PASS3_POLISH_G_LIB, MOUNT = PASS3_POLISH_G_MOUNT, PAGE = PASS3_POLISH_G_BUILDER, LAYOUT = PASS3_POLISH_G_LAYOUT
const A_LIB = 'lib/studio-pass3-polish.ts', A_HOOK = 'hooks/use-studio-pass3-polish.ts', A_MOUNT = 'components/studio-pass3-polish/studio-pass3-polish-mount.tsx'
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-pass3-polish-g-strip.mjs', THIS_TEST = 'scripts/test-studio-pass3-polish-g.mjs'
const CHAT = 'components/builder/chat-input.tsx', POPUPS = 'components/builder/studio-composer-popups-v2.css', INTEL_P2 = 'lib/studio-intelligence-p2.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_PASS3_POLISH', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', PALETTE = 'NEXT_PUBLIC_STUDIO_V4_TOKENS', ATTR = 'data-studio-pass3-polish'
const SCOPE = `html[${ATTR}="true"]`, PHONE = '(max-width: 640px)'

// ---------------------------------------------------------------- 1. the stylesheets
function splitTop(selector) { // a selector list split on top-level commas
  const out = []; let depth = 0, from = 0
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) { out.push(selector.slice(from, i).trim()); from = i + 1 }
  }
  out.push(selector.slice(from).trim())
  return out
}
function parseCss(text) {
  const tree = postcss.parse(text)
  const sections = [], rules = []
  let current = null, appendPointAt = -1, order = 0
  for (const node of tree.nodes) {
    if (node.type === 'comment') {
      const m = /^={5} SECTION (\d+): (.+?) ={5}$/.exec(node.text.trim())
      if (m) { current = { n: Number(m[1]), title: m[2], rules: [] }; sections.push(current) }
      if (/^={5} APPEND POINT: /.test(node.text.trim())) appendPointAt = order
    } else if (node.type === 'atrule') {
      if (!current) throw new Error('an at-rule before the first section')
      node.walkRules(rule => { const entry = { selector: rule.selector, decls: rule.nodes.filter(n => n.type === 'decl').map(d => ({ prop: d.prop, value: d.value, important: Boolean(d.important) })) }; current.rules.push(entry); rules.push(entry) })
    } else if (node.type === 'rule') throw new Error(`a rule outside any at-rule: ${node.selector.slice(0, 80)}`)
    order++
  }
  return { sections, rules, appendPointAt, nodeCount: tree.nodes.length, tree }
}
function proveCss(aText, eText, fText, at = '') {
  const a = message => (at ? `${at}: css: ${message}` : `css: ${message}`)
  const css = parseCss(aText)
  deep(css.sections.map(section => section.n), [1, 2, 3, 4, 5], a('sections 1 to 5, in order'))
  deep(css.sections.map(section => section.title), ['destination intros (Decks, Knowledge) on a phone', "(removed by PR G) a phone's text controls keep their own sizes", 'the Builder root is 100dvh', 'phone tap targets (32px minimum) in the Studio shell', 'phone tap targets: the Decks view toggle and the Templates / Themes library buttons'], a('their titles: section 2 is the one PR G renamed'))
  deep(css.sections.map(section => section.rules.length), [2, 0, 1, 3, 3], a('rules per section: section 2 has none (two, none, one, three, three)'))
  eq(css.rules.length, 9, a('nine rules in all (it was twelve)'))
  eq(css.appendPointAt, css.nodeCount - 1, a('the APPEND POINT comment is still the last node of the file'))
  for (const rule of css.rules) for (const selector of splitTop(rule.selector)) ok(selector.startsWith(`${SCOPE} `), a(`every selector starts with the attribute: ${selector.slice(0, 80)}`))
  for (const rule of css.rules) for (const decl of rule.decls) {
    ok(!/^(font-size|line-height)$/.test(decl.prop), a(`PR A's stylesheet sets no font size or line height any more (${decl.prop})`))
    ok(!decl.important, a(`and no !important is left in it (${decl.prop})`))
  }
  // sections 1, 3, 4 and 5 are the base's text, byte for byte: the file without the stub is the base without section 2
  eq(aText.split(PASS3_POLISH_G_SECTION_2_STUB).length, 2, a('the stub is in the file once'))
  eq(aText.replace(PASS3_POLISH_G_SECTION_2_STUB, () => ''), baseOf(A_CSS).replace(PASS3_POLISH_G_SECTION_2, () => ''), a("and the rest of the file is the base's: sections 1, 3, 4, 5, the header and the append point, byte for byte"))
  eq(stripPass3PolishG(A_CSS, aText), baseOf(A_CSS), a("the strip puts section 2 back: the base commit's stylesheet, byte for byte (the older proofs read it that way)"))
  match(baseOf(A_CSS), /select, textarea, \[contenteditable\][^{]*\{\n\s+font-size: 16px !important;/, a('(the removed section is the 16px !important rule of the base)'))
  ok(postcss.parse(PASS3_POLISH_G_SECTION_2_STUB).nodes.length === 2 && postcss.parse(PASS3_POLISH_G_SECTION_2_STUB).nodes.every(node => node.type === 'comment'), a('the stub is two comments and no rule'))
  // PR E's and PR F's stylesheets are not edited; E1 (the hint) is there; the polish set sets a font size in ONE place
  eq(sha(eText), sha(baseOf(E_CSS)), a("PR E's stylesheet is the base's, byte for byte (E1 and E2 stay)"))
  eq(sha(fText), sha(baseOf(F_CSS)), a("PR F's stylesheet is the base's, byte for byte (F1 stays)"))
  const sizes = []
  for (const [name, text] of [['A', aText], ['E', eText], ['F', fText]]) parseCss0(text).walkRules(rule => rule.walkDecls(/^(font-size|line-height)$/, decl => sizes.push(`${name}|${rule.selector.replace(/\s+/g, ' ').slice(-60)}|${decl.prop}: ${decl.value}`)))
  eq(sizes.length, 2, a("the polish set sets a font size or line height in ONE rule: E1's hint (two declarations)"))
  ok(sizes.every(entry => entry.startsWith('E|') && entry.includes('::placeholder')), a("and it is E1's ::placeholder rule, so the text a person types is never resized"))
  deep(sizes.map(entry => entry.split('|')[2]).sort(), ['font-size: 12px', 'line-height: 18px'], a('the hint stays 12px on an 18px line'))
  const e1 = parseCss0(eText); let hint = null
  e1.walkRules(rule => { if (rule.selector.includes('::placeholder')) hint = rule })
  ok(hint && hint.parent.name === 'media' && hint.parent.params === PHONE, a('E1 is inside the phone query'))
}
function parseCss0(text) { return postcss.parse(text) }
function proveFacts(at = '') {
  const a = message => (at ? `${at}: facts: ${message}` : `facts: ${message}`)
  // what a phone's prompt goes back to, and the arithmetic E1's hint stands on
  match(read(POPUPS), /\[data-studio-composer-popups-v2="true"\]\[data-studio-v4-type="true"\] textarea\[data-studio-v4-type-role="prompt"\] \{ font-size: 13\.6px; line-height: 20px; \}/, a("the Studio's own rule gives the prompt 13.6px on a 20px line (the size it goes back to)"))
  match(read(POPUPS), /\[data-studio-composer-popups-v2="true"\] textarea\[data-studio-v4-type-role="prompt"\] \{ font-size: 12px; line-height: 18px; \}/, a('and 12px on an 18px line without the type scale (the size E1 gives the hint)'))
  const chat = read(CHAT)
  match(chat, /className="w-full resize-none [^"]*px-3 pt-3 pb-14 min-h-\[96px\]/, a('the prompt: 12px above (pt-3), 56px below (pb-14), a 96px box'))
  match(chat, /data-studio-v4-composer-toolbar="true"\n\s+className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 /, a('the toolbar sits at the bottom of the box with 8px above and below (py-2)'))
  const sec4 = parseCss(read(A_CSS)).sections[3].rules.find(rule => rule.selector.includes('[data-studio-v4-composer-toolbar="true"] button'))
  ok(sec4 && sec4.decls.some(d => d.prop === 'min-height' && d.value === '32px'), a("PR A's section 4 keeps the toolbar buttons at 32px: 8 + 32 + 8 = a 48px toolbar"))
  const box = 96, toolbar = 8 + 32 + 8, top = box - toolbar
  eq(top, 48, a('the toolbar starts 48px below the top of the 96px box'))
  eq(12 + 18, 30, a("E1's one 18px line ends at 12 + 18 = 30px")); ok(12 + 18 <= top, a('which is above the toolbar (18px clear)'))
  ok(12 + 2 * 20 > top, a('while a hint wrapped onto two 20px lines (13.6px, the original size) would end at 52px, under the toolbar: why E1 stays (the hint is a placeholder: it does not size the box)'))
  // TYPED text is a different case: the prompt is resized to its own scrollHeight (padding included), between 96px and 220px, on every change of the text, and the toolbar is absolute at the bottom of that box,
  // so the last typed line is always (56px padding - 48px toolbar) = 8px above the toolbar, at the original 13.6px / 20px line and at #505's 16px / 24px alike. Nothing needs more padding.
  match(chat, /const TEXTAREA_MIN_HEIGHT = 96\nconst TEXTAREA_MAX_HEIGHT = 220\n/, a('the prompt\'s box is 96px at least and 220px at most'))
  eq(chat.split("const newHeight = Math.min(Math.max(textarea.scrollHeight, TEXTAREA_MIN_HEIGHT), TEXTAREA_MAX_HEIGHT)\n      textarea.style.height = `${newHeight}px`").length - 1, 2, a('and it is resized to its scrollHeight, padding included, when the text changes and when the pane is resized'))
  match(chat, /useEffect\(\(\) => \{\n    const textarea = textareaRef\.current\n    if \(textarea\) \{\n      textarea\.style\.height = 'auto'\n[^\n]*\n[^\n]*\n    \}\n  \}, \[inputMessage\]\)/, a('on every change of the text'))
  const clearance = (line, n) => { const height = Math.min(Math.max(12 + n * line + 56, box), 220); return (height - toolbar) - Math.min(12 + n * line, height - 56) }
  for (const line of [20, 24]) for (let n = 1; n <= 12; n++) ok(clearance(line, n) >= 8, a(`${n} typed line(s) of ${line}px: the last one ends at least 8px above the 48px toolbar (${clearance(line, n)}px)`))
  eq(clearance(20, 2), 8, a('two typed lines at the original 13.6px / 20px: the box grows to 108px, the toolbar starts at 60px, the second line ends at 52px: 8px clear'))
  eq(12 + 2 * 20 + 56, 108, a('(108 = 12 + 2 x 20 + 56)'))
}

// ---------------------------------------------------------------- 2 and 3. the helper, the installer and the hook
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
/** A fresh instance of the helper (its holder state is the instance's): { lib, effects } with the flag stood in as `enabled`; `globals` are the document and navigator the hook reads. */
function loadLib(text, enabled = true, globals = {}) {
  const effects = [], module = { exports: {} }
  const req = spec => {
    if (spec === 'react') return { useEffect: fn => { effects.push(fn) } }
    if (spec === '@/lib/studio-pass3-polish') return { STUDIO_PASS3_POLISH_ENABLED: enabled }
    throw new Error(`unexpected import ${spec} in ${LIB}`)
  }
  const sandbox = { module, exports: module.exports, require: req, process: { env: {} } } // a helper that reads its own env var would see nothing
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(sandbox, name, typeof value === 'function' && value.isGetter ? { get: value, enumerable: true } : { value, enumerable: true })
  vm.runInNewContext(compile(LIB, text), sandbox, { filename: LIB })
  return { lib: module.exports, effects }
}
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  ipod: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
  ipodOld: 'Mozilla/5.0 (iPod; U; CPU like Mac OS X; en) AppleWebKit/420.1 (KHTML, like Gecko) Version/3.0 Mobile/3A101a Safari/419.3', // an iPod UA with no "iPhone" in it
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', // also what an iPad sends in desktop mode
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
}
const DEFAULT = 'width=device-width, initial-scale=1' // what Next's viewport export renders (app/layout.tsx)
function proveHelper(text, at = '') {
  const a = message => (at ? `${at}: viewport: ${message}` : `viewport: ${message}`)
  const { lib } = loadLib(text)
  const f = lib.iosZoomViewportContent, isIos = lib.isIosDevice
  const MAX = `${DEFAULT}, maximum-scale=1`
  // who is on iOS: [name, user agent, maxTouchPoints, expected]
  const devices = [
    ['iPhone Safari', UA.iphone, 5, true], ['iPhone Safari, touch points not reported', UA.iphone, undefined, true], ['iPhone Chrome (CriOS)', UA.iphoneChrome, 5, true], ['iPod touch', UA.ipod, 5, true], ['iPod (older user agent, no "iPhone" in it)', UA.ipodOld, 5, true],
    ['iPad (iPadOS 12 and earlier UA)', UA.ipad, 5, true], ['iPadOS 13+ in desktop mode: Macintosh with touch', UA.macSafari, 5, true], ['iPadOS desktop mode, two touch points', UA.macSafari, 2, true],
    ['Mac Safari (no touch screen)', UA.macSafari, 0, false], ['Mac Safari, one touch point', UA.macSafari, 1, false], ['Mac Safari, touch points not reported', UA.macSafari, undefined, false], ['Mac Chrome', UA.macChrome, 0, false],
    ['Mac with touch points given as text', UA.macSafari, '5', false],
    ['Android phone', UA.android, 5, false], ['Android tablet', UA.androidTablet, 10, false], ['Windows touch laptop', UA.windowsChrome, 10, false], ['Windows desktop', UA.windowsChrome, 0, false], ['Linux Firefox', UA.linuxFirefox, 0, false],
    ['no user agent', undefined, 5, false], ['empty user agent', '', 5, false], ['a user agent that is not text', 42, 5, false],
  ]
  for (const [name, ua, touch, expected] of devices) {
    eq(isIos(ua, touch), expected, a(`${name}: ${expected ? 'iOS' : 'not iOS'}`))
    eq(f(ua, touch, DEFAULT), expected ? MAX : DEFAULT, a(`${name}: the viewport content ${expected ? 'gets maximum-scale=1 (width and initial-scale stay)' : 'is left exactly as it is'}`))
  }
  // the content forms, on an iPhone
  const on = content => f(UA.iphone, 5, content)
  eq(on(DEFAULT), MAX, a('Next\'s content: maximum-scale=1 is added at the end after ", "'))
  eq(on(MAX), MAX, a('already there: unchanged (and applying it twice changes nothing more)'))
  eq(on('width=device-width, initial-scale=1, maximum-scale=1.0'), 'width=device-width, initial-scale=1, maximum-scale=1.0', a('maximum-scale=1.0 is 1: unchanged'))
  eq(on('width=device-width, initial-scale=1, maximum-scale=5'), 'width=device-width, initial-scale=1, maximum-scale=1', a('an existing maximum-scale=5 is set to 1'))
  eq(on('maximum-scale=2,width=device-width'), 'maximum-scale=1,width=device-width', a('and in first place; the other directive and its separator stay'))
  eq(on('width=device-width, Maximum-Scale = 3, initial-scale=1'), 'width=device-width, Maximum-Scale = 1, initial-scale=1', a('whatever its case or spacing'))
  eq(on('width=device-width, initial-scale=1,'), `${DEFAULT}, maximum-scale=1`, a('a trailing comma does not double'))
  eq(on('width=device-width, initial-scale=1, user-scalable=no'), 'width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1', a('user-scalable and every other directive stay'))
  eq(on('width=device-width, x-maximum-scale=3'), 'width=device-width, x-maximum-scale=3, maximum-scale=1', a('only a directive named maximum-scale is one'))
  eq(on('width=device-width, minimum-scale=0.5'), 'width=device-width, minimum-scale=0.5, maximum-scale=1', a('minimum-scale is not touched'))
  eq(on(''), '', a('an empty content has no directive to keep: left alone')); eq(on('   '), '   ', a('and so is a blank one'))
  eq(on(undefined), '', a('no content gives an empty text')); eq(on(null), '', a('so does null')); eq(on(7), '', a('and a number'))
  eq(f(UA.android, 5, undefined), '', a('not iOS: a non-text content gives an empty text, nothing else'))
  eq(on(on('width=device-width, initial-scale=1, maximum-scale=4')), 'width=device-width, initial-scale=1, maximum-scale=1', a('applying it twice is applying it once'))
  eq(lib.IOS_MAX_SCALE_DIRECTIVE, 'maximum-scale=1', a('the directive is maximum-scale=1'))
  eq(Object.keys(lib).sort().join(','), 'IOS_MAX_SCALE_DIRECTIVE,STUDIO_PASS3_POLISH_G_ENABLED,installIosZoomFix,iosZoomViewportContent,isIosDevice,useStudioPass3PolishGViewport', a('the helper exports these and nothing else'))
}
function standIn(content, { present = true } = {}) {
  const log = []
  const meta = { content, connected: true, getAttribute(name) { log.push(`get ${name}`); return name === 'content' ? meta.content : null }, setAttribute(name, value) { log.push(`set ${name}=${value}`); if (name === 'content') meta.content = value }, get isConnected() { return meta.connected } }
  const doc = { querySelector(selector) { log.push(`query ${selector}`); return present && selector === 'meta[name="viewport"]' ? meta : null } }
  return { doc, meta, log, sets: () => log.filter(entry => entry.startsWith('set ')).length }
}
function proveInstaller(text, at = '') {
  const a = message => (at ? `${at}: installer: ${message}` : `installer: ${message}`)
  const MAX = `${DEFAULT}, maximum-scale=1`
  const fresh = () => loadLib(text).lib
  // iPhone and iPad: set, then give back
  for (const [name, ua, touch] of [['iPhone', UA.iphone, 5], ['iPad', UA.ipad, 5], ['iPadOS in desktop mode', UA.macSafari, 5]]) {
    const s = standIn(DEFAULT), release = fresh().installIosZoomFix(s.doc, { userAgent: ua, maxTouchPoints: touch })
    eq(s.meta.content, MAX, a(`${name}: the meta holds maximum-scale=1 while the route is on screen`)); eq(s.sets(), 1, a(`${name}: one write`))
    release(); eq(s.meta.content, DEFAULT, a(`${name}: the original content comes back on release`)); eq(s.sets(), 2, a(`${name}: and that was the second write`))
    deep(s.log.filter(entry => entry.startsWith('query')), ['query meta[name="viewport"]'], a(`${name}: the document is asked for the viewport meta only`))
    release(); eq(s.sets(), 2, a(`${name}: a second release writes nothing`))
  }
  // everything else: read, never written
  for (const [name, ua, touch] of [['Android phone', UA.android, 5], ['Android tablet', UA.androidTablet, 10], ['Mac Safari', UA.macSafari, 0], ['Mac Chrome', UA.macChrome, 0], ['Windows touch laptop', UA.windowsChrome, 10], ['Linux Firefox', UA.linuxFirefox, 0]]) {
    const s = standIn(DEFAULT), release = fresh().installIosZoomFix(s.doc, { userAgent: ua, maxTouchPoints: touch })
    eq(s.meta.content, DEFAULT, a(`${name}: the meta is untouched`)); eq(s.sets(), 0, a(`${name}: nothing is ever written`))
    release(); eq(s.sets(), 0, a(`${name}: nor on release`))
  }
  { const s = standIn(DEFAULT, { present: false }), release = fresh().installIosZoomFix(s.doc, { userAgent: UA.iphone, maxTouchPoints: 5 }); release(); eq(s.sets(), 0, a('no viewport meta on the page: nothing to change, nothing thrown')) }
  { const s = standIn(MAX), release = fresh().installIosZoomFix(s.doc, { userAgent: UA.iphone, maxTouchPoints: 5 }); eq(s.sets(), 0, a('maximum-scale=1 already there: no write')); release(); eq(s.sets(), 0, a('and none on release')) }
  { const s = standIn(null), release = fresh().installIosZoomFix(s.doc, { userAgent: UA.iphone, maxTouchPoints: 5 }); release(); eq(s.sets(), 0, a('a meta with no content attribute: left alone')) }
  // strict mode: effect, cleanup, effect again
  { const lib = fresh(), s = standIn(DEFAULT), nav = { userAgent: UA.iphone, maxTouchPoints: 5 }
    const r1 = lib.installIosZoomFix(s.doc, nav); r1(); eq(s.meta.content, DEFAULT, a('strict mode: the cleanup gives the original back'))
    const r2 = lib.installIosZoomFix(s.doc, nav); eq(s.meta.content, MAX, a('and the second effect sets it again')); r2(); eq(s.meta.content, DEFAULT, a('and its cleanup gives the original back, not the changed content')) }
  // two holders: the original is the first one's, the content comes back with the LAST holder, a double release counts once
  { const lib = fresh(), s = standIn(DEFAULT), nav = { userAgent: UA.iphone, maxTouchPoints: 5 }
    const r1 = lib.installIosZoomFix(s.doc, nav), r2 = lib.installIosZoomFix(s.doc, nav); eq(s.sets(), 1, a('two holders: one write'))
    r2(); r2(); eq(s.meta.content, MAX, a('one of them lets go (twice): the other still holds')); r1(); eq(s.meta.content, DEFAULT, a('the last one lets go: the ORIGINAL comes back, not maximum-scale=1')) }
  // the meta changed meanwhile, or went away: the release does not overwrite it
  { const lib = fresh(), s = standIn(DEFAULT), r = lib.installIosZoomFix(s.doc, { userAgent: UA.iphone, maxTouchPoints: 5 }); s.meta.content = 'width=1024'; r(); eq(s.meta.content, 'width=1024', a("a content somebody else wrote meanwhile is left as it is")) }
  { const lib = fresh(), s = standIn(DEFAULT), r = lib.installIosZoomFix(s.doc, { userAgent: UA.iphone, maxTouchPoints: 5 }); s.meta.connected = false; const before = s.sets(); r(); eq(s.sets(), before, a('a meta that is no longer in the document is not written')) }
  // the hook: flag off it returns before it reads the document or the navigator
  const trap = () => { throw new Error('the document or the navigator was read') }
  trap.isGetter = true
  { const { lib, effects } = loadLib(text, false, { document: trap, navigator: trap }); lib.useStudioPass3PolishGViewport(); eq(effects.length, 1, a('the hook registers one effect')); eq(effects[0](), undefined, a('flag off: the effect returns before it reads the document or the navigator (both would throw)')) }
  { const s = standIn(DEFAULT), { lib, effects } = loadLib(text, true, { document: s.doc, navigator: { userAgent: UA.iphone, maxTouchPoints: 5 } }); lib.useStudioPass3PolishGViewport()
    const cleanup = effects[0](); eq(typeof cleanup, 'function', a('flag on: the effect returns its cleanup')); eq(s.meta.content, MAX, a('and an iPhone gets maximum-scale=1')); cleanup(); eq(s.meta.content, DEFAULT, a('and gives it back')) }
  { const s = standIn(DEFAULT), { lib, effects } = loadLib(text, true, { document: s.doc, navigator: { userAgent: UA.android, maxTouchPoints: 5 } }); lib.useStudioPass3PolishGViewport(); effects[0]()(); eq(s.sets(), 0, a('flag on, Android: the page is not touched')) }
  match(text, /export const STUDIO_PASS3_POLISH_G_ENABLED = STUDIO_PASS3_POLISH_ENABLED\n/, a("the flag is PR A's (exact \"true\" and the Studio shell), not a flag of its own"))
  match(text, /useEffect\(\(\) => \{\n\s+if \(!STUDIO_PASS3_POLISH_G_ENABLED\) return\n\s+return installIosZoomFix\(document, navigator\)\n\s+\}, \[\]\)/, a('the hook checks the flag first, then installs, once per mount'))
  deep([...text.matchAll(/^import .* from '([^']+)'$/gm)].map(m => m[1]), ['react', '@/lib/studio-pass3-polish'], a("it imports react and PR A's lib, nothing else"))
  nomatch(text, /\bfetch\b|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|\/api\//, a('no request, no stored value'))
  const mount = read(MOUNT)
  match(mount, /^"use client"\n\nimport \{ useStudioPass3PolishGViewport \} from "@\/lib\/studio-pass3-polish-g"\n/, a('the mount is a client component that imports the hook'))
  match(mount, /export function StudioPass3PolishGMount\(\) \{\n  useStudioPass3PolishGViewport\(\)\n  return null\n\}/, a('and only calls it and draws nothing'))
}

// ---------------------------------------------------------------- 4. the pins and the flag-off identity
function provePin(rel, text, stripFn = stripPass3PolishG, at = '') {
  const a = message => (at ? `${at}: ${rel}: ${message}` : `${rel}: ${message}`)
  const base = withoutOthers(rel, baseOf(rel)), own = withoutOthers(rel, text)
  const stripped = stripFn(rel, own)
  eq(sha(stripped), sha(base), a("without this change's lines it is the base commit's file, byte for byte (every other change's lines out on both sides)"))
  eq(sha(stripLaterChanges(rel, text)), sha(stripLaterChanges(rel, baseOf(rel))), a("and through the registry (innermost, as every older pin reads it) it is the base commit's file"))
  eq(own.split('\n').filter(marked).length, 2, a('two marked lines: the import and the call (the mount)'))
  ok(!stripped.split('\n').some(marked) && !base.split('\n').some(marked), a('neither the stripped file nor the base carries the marker'))
  ok(!/(?<![\w-])PASS3-POLISH(?![\w-])/.test(own.split('\n').filter(marked).join('\n')), a("PR A's whole-token marker does not match this change's lines (PR A's strip leaves them)"))
  const lines = text.split('\n'), at1 = lines.findIndex(marked) // the file as it is, every stacked change's lines in it: the position is checked against PR E's and PR D's lines
  match(lines[at1 - 1] || '', rel === PAGE ? /PASS3-POLISH-E \(NEXT_PUBLIC_STUDIO_PASS3_POLISH/ : /studio-pass3-polish-e\.css" \/\/ PASS3-POLISH-E/, a("the import sits right after PR E's stylesheet import"))
  if (rel === PAGE) {
    ok(lines.some(line => /^import \{ useStudioPass3PolishGViewport \} from '@\/lib\/studio-pass3-polish-g' \/\/ PASS3-POLISH-G/.test(line)), a('the import of the hook'))
    const call = lines.findIndex(line => /^ {2}useStudioPass3PolishGViewport\(\) \/\/ PASS3-POLISH-G:/.test(line))
    ok(call > 0 && /^ {2}useStudioPass3PolishDMain\(workspaceRef\) \/\/ PASS3-POLISH-D/.test(lines[call - 1]), a("the call sits right after PR D's, with the Builder's other hooks"))
  } else {
    ok(lines.some(line => /^import \{ StudioPass3PolishGMount \} from "@\/components\/studio-pass3-polish\/studio-pass3-polish-g-mount" \/\/ PASS3-POLISH-G/.test(line)), a('the import of the mount'))
    const draw = lines.findIndex(line => line === '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishGMount />}{/* PASS3-POLISH-G */}')
    ok(draw > 0 && lines[draw - 1] === '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}', a("the mount is drawn right after PR A's, only with the flag"))
  }
}
const LAYOUT_STATES = []
for (const flag of [undefined, 'false', 'TRUE', '1', 'yes', ' true', 'true']) for (const shell of ['true', 'false', undefined]) for (const palette of ['true', undefined]) LAYOUT_STATES.push({ flag, shell, palette })
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
    '@/components/studio-pass3-polish/studio-pass3-polish-g-mount': { StudioPass3PolishGMount: () => { imports.push('g-mount drawn'); return h('i', { 'data-mount': 'g' }) } },
  }
  const module = { exports: {} }
  const req = spec => {
    if (/^@\/components\/studio-pass3-polish\/studio-pass3-polish-e\.css$/.test(spec)) return {}
    if (Object.prototype.hasOwnProperty.call(mocks, spec)) return mocks[spec]
    if (spec === 'react/jsx-runtime') return jsxRuntime
    throw new Error(`unexpected import ${spec} in ${LAYOUT}`)
  }
  vm.runInNewContext(compile(LAYOUT, text), { module, exports: module.exports, require: req, process: { env } }, { filename: LAYOUT })
  return { html: renderToStaticMarkup(module.exports.default({ children: 'page' })), drawn: imports.length, on: env[FLAG] === 'true' && env[SHELL] === 'true' }
}
function proveFlagOff(layoutText, at = '') {
  const a = message => (at ? `${at}: flag off: ${message}` : `flag off: ${message}`)
  const head = [], base = []
  for (const st of LAYOUT_STATES) {
    const h = renderLayout(layoutText, st), b = renderLayout(baseOf(LAYOUT), st)
    if (h.on) {
      eq(h.html, b.html.replace('<i data-mount="pass3"></i>', '<i data-mount="pass3"></i><i data-mount="g"></i>'), a(`the account layout in ${JSON.stringify(st)} (flag on) is the base commit's HTML plus the one new mount`))
    } else {
      eq(h.html, b.html, a(`the account layout in ${JSON.stringify(st)} renders the base commit's HTML`)); eq(h.drawn, 0, a('and the mount is not drawn'))
    }
    head.push(h.on ? b.html : h.html); base.push(b.html)
  }
  eq(sha(head.join('\n')), sha(base.join('\n')), a(`sha256 over ${LAYOUT_STATES.length} states (flag-on states compared without the new mount) is the base commit's`))
  match(read(A_LIB), /export const STUDIO_PASS3_POLISH_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'/, a("the flag is PR A's: exact \"true\" and the Studio shell"))
  eq(sha(read(A_LIB)), sha(baseOf(A_LIB)), a("PR A's lib is the base's, byte for byte (the attribute is set the same way)")); eq(sha(read(A_HOOK)), sha(baseOf(A_HOOK)), a("PR A's hook is the base's, byte for byte")); eq(sha(read(A_MOUNT)), sha(baseOf(A_MOUNT)), a("PR A's mount is the base's, byte for byte"))
  // every rule of PR A's stylesheet still needs the attribute; with the flag off nothing sets it
  parseCss0(read(A_CSS)).walkRules(rule => { for (const s of splitTop(rule.selector)) ok(s.startsWith(`${SCOPE} `), a('every selector needs <html data-studio-pass3-polish="true">: without it no rule of the stylesheet matches anything')) })
  return { states: LAYOUT_STATES.length, base: sha(base.join('\n')), head: sha(head.join('\n')) }
}
function proveIntelligenceUntouched(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  eq(sha(read(INTEL_P2)), sha(baseOf(INTEL_P2)), a("lib/studio-intelligence-p2.ts (FRONTEND-1's, decision D, the \"Auto\" label) is the base's, byte for byte: it is NOT in this change"))
  eq(sha(read('scripts/test-studio-p2-intelligence.mjs')), sha(baseOf('scripts/test-studio-p2-intelligence.mjs')), a("and FRONTEND-1's test that pins it is not edited"))
}

// ---------------------------------------------------------------- 5. the change: strip, registry, taught proofs, scope, secret scan
function proveStrip(stripFn, at = '') {
  const a = message => (at ? `${at}: strip: ${message}` : `strip: ${message}`)
  eq(stripFn('lib/other.ts', 'x // PASS3-POLISH-G'), 'x // PASS3-POLISH-G', a('any other file is returned as it is'))
  eq(stripFn(PAGE, 'a\nb // PASS3-POLISH-G (x): y\nc\n'), 'a\nc\n', a('a marked line goes, every other byte stays (trailing newline too)'))
  eq(stripFn(LAYOUT, 'a\nimport "x" // PASS3-POLISH-G (y)\nb'), 'a\nb', a('the layout the same'))
  const keep = 'a\nb // PASS3-POLISH\nc // PASS3-POLISH-B\nd // PASS3-POLISH-C\ne // PASS3-POLISH-D\nf // PASS3-POLISH-E\ng // PASS3-POLISH-F\nh // PASS3-POLISH-GG\ni // XPASS3-POLISH-G\nj // PASS3-POLISH-G-x\n'
  eq(stripFn(PAGE, keep), keep, a("only this change's marker, as a whole token, takes a line out: the lines of PR A to F stay for their own strips"))
  eq(stripFn(PAGE, 7), 7, a('a non-string comes back'))
  deep(PASS3_POLISH_G_FILES, [PAGE, LAYOUT], a('the marker strip touches the Builder page and the account layout only'))
  eq(stripFn(A_CSS, `x${PASS3_POLISH_G_SECTION_2_STUB}y`), `x${PASS3_POLISH_G_SECTION_2}y`, a("PR A's stylesheet gets section 2 back in place of the stub"))
  eq(stripFn(A_CSS, 'no stub here'), 'no stub here', a('a stylesheet without the stub is returned as it is'))
  const twice = `${PASS3_POLISH_G_SECTION_2_STUB}\n${PASS3_POLISH_G_SECTION_2_STUB}`
  eq(stripFn(A_CSS, twice), twice, a('a stub that is there twice is a merge mistake: left alone'))
  eq(stripFn(E_CSS, PASS3_POLISH_G_SECTION_2_STUB), PASS3_POLISH_G_SECTION_2_STUB, a("PR E's stylesheet is never changed by it"))
  for (const rel of PASS3_POLISH_G_PIN_FILES) eq(stripFn(rel, baseOf(rel)), baseOf(rel), a(`${rel}: the base's proof has nothing to put back`))
}
// FRONTEND-2, stack: PR E's and PR F's proofs are taught the SAME reading line by a later change (phone shell 1, LATER_STRIPS.slice(indexOf(self) + 1)), the most general form: it strips every change registered after the proof's own entry, this one included. Where two stacked changes teach one line, that form stays and this change's narrower line and import go.
const TAUGHT_LATER = ['scripts/test-studio-pass3-polish-e.mjs', 'scripts/test-studio-pass3-polish-f.mjs']
function proveTaughtProofs(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  deep(PASS3_POLISH_G_PIN_FILES, ['scripts/test-studio-pass3-polish.mjs', 'scripts/test-studio-pass3-polish-e.mjs', 'scripts/test-studio-pass3-polish-f.mjs'], a("the older proofs it teaches: PR A's, PR E's and PR F's (the ones that read PR A's stylesheet)"))
  for (const rel of PASS3_POLISH_G_PIN_FILES) {
    const text = read(rel)
    if (TAUGHT_LATER.includes(rel)) { // STACK: a later change teaches this proof the general registry read, which already strips this change's lines (its own import and reading line are not there)
      eq(sha(stripLaterChanges(rel, text)), sha(baseOf(rel)), a(`${rel}: taught by a later change: through the registry it is the base commit's proof, byte for byte`))
      match(text, /LATER_STRIPS\.slice\(LATER_STRIPS\.indexOf\(stripPass3Polish[EF]\) \+ 1\)\.reduce\(\(out, strip\) => strip\(rel, out\), fs\.readFileSync\(path\.join\(root, rel\), 'utf8'\)\)\)/, a(`${rel}: it reads through the registry: every change registered after its own entry comes out, this one's too`))
      nomatch(text, /stripPass3PolishG/, a(`${rel}: this change's narrower reading line and its import are gone`))
      continue
    }
    eq(sha(putBackPin(rel, text)), sha(baseOf(rel)), a(`${rel}: with its registry-read lines put back it is the base commit's proof, byte for byte`))
    eq(sha(stripLaterChanges(rel, text)), sha(stripLaterChanges(rel, baseOf(rel))), a(`${rel}: and through the registry too`))
    const edited = text.split('\n').filter(line => line.includes('LATER-CHANGES: registry read (PASS3-POLISH-G)'))
    ok(edited.length === 2, a(`${rel}: two edited lines (the import and the reading line), each marked`))
    ok(text.split('\n').length === baseOf(rel).split('\n').length + 1, a(`${rel}: one line longer than the base's, nothing else`))
    match(text, /stripPass3PolishG/, a(`${rel}: it reads through this change's strip`))
  }
  eq(PASS3_POLISH_G_PIN_EDITS['scripts/test-studio-pass3-polish.mjs'].length, 2, a("PR A's proof: two edits, and its reading line is conditional on the stylesheet (it compares the Builder page raw)"))
  match(read('scripts/test-studio-pass3-polish.mjs'), /rel === 'components\/studio-pass3-polish\/studio-pass3-polish\.css' \? stripPass3PolishG/, a("PR A's proof restores only PR A's stylesheet"))
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: registry: ${message}` : `registry: ${message}`)
  const lines = registryText.split('\n').filter(line => line.includes("'./studio-pass3-polish-g-strip.mjs'"))
  eq(lines.length, 2, a('exactly two lines for this change: its files and its strip (no .env.example block)'))
  ok(lines.every(line => line.includes('// LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR G (NEXT_PUBLIC_STUDIO_PASS3_POLISH')), a('each carries the LATER-CHANGE marker'))
  match(lines[0], /^ {2}\.\.\.\(await import\('\.\/studio-pass3-polish-g-strip\.mjs'\)\)\.PASS3_POLISH_G_SCOPE_FILES,/, a('line 1: the files'))
  match(lines[1], /^ {2}\(await import\('\.\/studio-pass3-polish-g-strip\.mjs'\)\)\.stripPass3PolishG,/, a('line 2: the strip'))
  const at1 = registryText.indexOf(lines[0]), at2 = registryText.indexOf(lines[1]), files = registryText.indexOf('export const LATER_CHANGE_FILES'), blocks = registryText.indexOf('export const LATER_ENV_BLOCKS'), strips = registryText.indexOf('export const LATER_STRIPS')
  ok(files < at1 && at1 < blocks && strips < at2, a('the files line is in LATER_CHANGE_FILES, the strip line in LATER_STRIPS'))
  const fFiles = registryText.indexOf("'./studio-pass3-polish-f-strip.mjs')).PASS3_POLISH_F_SCOPE_FILES"), fStrip = registryText.indexOf("'./studio-pass3-polish-f-strip.mjs')).stripPass3PolishF")
  ok(fFiles > 0 && fFiles < at1 && fStrip > 0 && fStrip < at2, a("each comes after PR F's line in the same list (a union on merge keeps all)"))
  ok(!registryText.slice(blocks, strips).includes('studio-pass3-polish-g-strip'), a('nothing of this change is in LATER_ENV_BLOCKS'))
  ok(LATER_STRIPS.includes(stripPass3PolishG) || LATER_STRIPS.some(fn => fn.name === 'stripPass3PolishG'), a('the registry holds the strip'))
  ok([...PASS3_POLISH_G_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('the registry names every file of this change'))
  ok(!LATER_ENV_BLOCKS.some(block => /PASS3-POLISH-G/.test(String(block))), a('no env block of its own'))
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: scope: ${message}` : `scope: ${message}`)
  ok([...PASS3_POLISH_G_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
  const family = ['lib', 'hooks', 'components', 'scripts'].flatMap(dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? (/pass3-polish/.test(entry.name) ? fs.readdirSync(path.join(root, dir, entry.name)).map(name => `${dir}/${entry.name}/${name}`) : []) : (/pass3-polish/.test(entry.name) ? [`${dir}/${entry.name}`] : [])) : [])
  deep(family.filter(rel => !LATER_CHANGE_FILES.has(rel)), [], a('every file of the polish family belongs to a registered change'))
  for (const rel of PASS3_POLISH_G_SCOPE_FILES) nomatch(rel, /^app\/admin|^components\/admin|^app\/docs|^components\/studio-docs|^app\/help|^components\/help|^app\/p\/|publish|published|^components\/settings|^app\/\(app\)\/settings|^app\/\(app\)\/billing|^components\/billing|user-profile-menu|^app\/\(app\)\/profile|^app\/\(app\)\/shortcuts|studio-intelligence|studio-personal/, a(`${rel}: not one of FRONTEND-1's files`))
  const committed = ownCommitted()
  deep(committed.filter(rel => !PASS3_POLISH_G_SCOPE_FILES.has(rel)), [], a(`every file in this change's committed diff (${BASE.slice(0, 8)}..HEAD) is its own`))
  if (committed.length) {
    deep([...PASS3_POLISH_G_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    deep(committed.filter(rel => /^scripts\/test-/.test(rel)).sort(), [THIS_TEST, ...PASS3_POLISH_G_PIN_FILES].sort(), a("the tests it adds or edits: its own and the three older polish proofs it teaches (no FRONTEND-1 test is edited)"))
    deep(committed.filter(rel => !/^scripts\//.test(rel)).sort(), [LAYOUT, PAGE, A_CSS, LIB, MOUNT].sort(), a("the app files: PR A's stylesheet (section 2), the Builder page and the account layout (two lines each), the new helper and mount"))
    deep(committed.filter(rel => /^scripts\//.test(rel) && !/^scripts\/test-/.test(rel)).sort(), [REGISTRY, STRIP_MODULE].sort(), a('the other scripts: the registry and its own strip'))
  }
}
function proveSecretScan(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [LIB, MOUNT, STRIP_MODULE, THIS_TEST].map(read).concat(read(PAGE).split('\n').filter(marked), read(LAYOUT).split('\n').filter(marked), PASS3_POLISH_G_SECTION_2_STUB).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
}

// ---------------------------------------------------------------- run everything
function proveAll(stripFn = stripPass3PolishG, at = '') {
  proveCss(read(A_CSS), read(E_CSS), read(F_CSS), at)
  proveFacts(at)
  proveHelper(read(LIB), at)
  proveInstaller(read(LIB), at)
  provePin(PAGE, read(PAGE), stripFn, at)
  provePin(LAYOUT, read(LAYOUT), stripFn, at)
  const digest = proveFlagOff(withoutLater(LAYOUT, read(LAYOUT)), at) // STACK: the layout is rendered without the lines of the changes registered after this one (phone shell 1 ...), as PR E's and PR F's proofs read theirs
  proveIntelligenceUntouched(at)
  proveStrip(stripFn, at)
  proveTaughtProofs(at)
  proveRegistry(read(REGISTRY), at)
  proveScope(at)
  proveSecretScan(at)
  return digest
}
const digest = proveAll()
console.log(`flag off: the account layout renders the base commit's HTML in ${digest.states} flag states, sha256 base ${digest.base.slice(0, 16)} == head ${digest.head.slice(0, 16)}; the hook never reads the document or the navigator`)
console.log(`PASS stylesheet, viewport, installer, pin, change: ${checks} checks`)

// =========================================================== 6. mutants
const killed = [], survived = []
async function mutant(name, edits, { strip = stripPass3PolishG } = {}) {
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
    killed.push(name); if (process.env.PASS3_POLISH_G_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
const css = (from, to, mode) => [A_CSS, from, to, mode]
const lib = (from, to, mode) => [LIB, from, to, mode]
const FONT_RULE = `@media ${PHONE} {\n  ${SCOPE} :is(input, select, textarea, [contenteditable]) {\n    font-size: 16px !important;\n  }\n}`
// the stylesheet
await mutant('css: section 2 still has the 16px rule', [css(PASS3_POLISH_G_SECTION_2_STUB, `${PASS3_POLISH_G_SECTION_2_STUB}\n${FONT_RULE}`)])
await mutant('css: section 2 still has the line-height rule', [css(PASS3_POLISH_G_SECTION_2_STUB, `${PASS3_POLISH_G_SECTION_2_STUB}\n@media ${PHONE} {\n  ${SCOPE} textarea {\n    line-height: 1.5 !important;\n  }\n}`)])
await mutant('css: a font size in another section', [css('    min-width: 32px;\n    min-height: 32px;', '    min-width: 32px;\n    min-height: 32px;\n    font-size: 14px;')])
await mutant('css: the stub is gone (section 2 vanishes)', [css(`${PASS3_POLISH_G_SECTION_2_STUB}\n\n`, '')])
await mutant('css: the stub is edited', [css('keep the sizes and lines the Studio', 'keep the sizes and the lines the Studio')])
await mutant('css: section 1 changes (gutter 24px)', [css('padding-inline-end: 16px;', 'padding-inline-end: 24px;')])
await mutant('css: section 3 changes (100vh again)', [css('    height: 100dvh;', '    height: 100vh;')])
await mutant('css: section 4 changes (28px minimum)', [css('    min-width: 32px;\n    min-height: 32px;', '    min-width: 28px;\n    min-height: 28px;')])
await mutant('css: section 5 changes (summary padding 4px)', [css('padding-block: 8px;', 'padding-block: 4px;')])
await mutant('css: the append point is not last', [css('every rule starts with html[data-studio-pass3-polish="true"] ===== */\n', 'every rule starts with html[data-studio-pass3-polish="true"] ===== */\n.x { }\n')])
await mutant('css: a rule without the attribute', [css('  html[data-studio-pass3-polish="true"] [data-studio-v4-shell="true"].h-screen {', '  [data-studio-v4-shell="true"].h-screen {')])
await mutant("PR E's stylesheet: the hint is 13.6px", [[E_CSS, '    font-size: 12px;\n    line-height: 18px;', '    font-size: 13.6px;\n    line-height: 20px;']])
await mutant("PR E's stylesheet: E1 is gone", [[E_CSS, '::placeholder {\n    font-size: 12px;\n    line-height: 18px;\n  }', '::placeholder {\n  }']])
await mutant("PR E's stylesheet: a text control is resized", [[E_CSS, '    padding-right: 24px;\n    text-overflow: ellipsis;', '    padding-right: 24px;\n    text-overflow: ellipsis;\n    font-size: 16px;']])
await mutant("PR F's stylesheet: the padding drifts", [[F_CSS, '    padding-right: 24px;', '    padding-right: 20px;']])
await mutant('facts: the Studio resizes the prompt', [[POPUPS, 'textarea[data-studio-v4-type-role="prompt"] { font-size: 13.6px; line-height: 20px; }', 'textarea[data-studio-v4-type-role="prompt"] { font-size: 14px; line-height: 20px; }']])
await mutant('facts: the toolbar grows', [[CHAT, 'absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 ', 'absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-4 ']])
await mutant('facts: the prompt stops resizing to its text', [[CHAT, 'Math.max(textarea.scrollHeight, TEXTAREA_MIN_HEIGHT)', 'Math.max(0, TEXTAREA_MIN_HEIGHT)', 'all']])
await mutant('facts: the prompt\'s bottom padding shrinks below the toolbar (pb-12)', [[CHAT, 'px-3 pt-3 pb-14 min-h-[96px]', 'px-3 pt-3 pb-12 min-h-[96px]']])
await mutant('facts: the resize on a text change is gone', [[CHAT, '  }, [inputMessage])\n\n  // A resized Studio pane', '  }, [])\n\n  // A resized Studio pane']])
await mutant('facts: the prompt box shrinks', [[CHAT, 'px-3 pt-3 pb-14 min-h-[96px]', 'px-3 pt-3 pb-14 min-h-[80px]']])
// the helper
await mutant('helper: Android is iOS', [lib("return /Macintosh/.test(ua) && typeof maxTouchPoints === 'number' && maxTouchPoints > 1", "return /Macintosh|Android/.test(ua) && typeof maxTouchPoints === 'number' && maxTouchPoints > 1")])
await mutant('helper: iPadOS desktop mode is not iOS (no Macintosh test)', [lib("return /Macintosh/.test(ua) && typeof maxTouchPoints === 'number' && maxTouchPoints > 1", 'return false')])
await mutant('helper: a Mac with one touch point is iPadOS', [lib('maxTouchPoints > 1', 'maxTouchPoints > 0')])
await mutant('helper: a Mac with no touch check at all', [lib("return /Macintosh/.test(ua) && typeof maxTouchPoints === 'number' && maxTouchPoints > 1", "return /Macintosh/.test(ua)")])
await mutant('helper: touch points as text count', [lib("typeof maxTouchPoints === 'number' && maxTouchPoints > 1", 'Number(maxTouchPoints) > 1')])
await mutant('helper: iPod is not iOS', [lib('iP(hone|od|ad)', 'iP(hone|ad)')])
await mutant('helper: iPad is not iOS', [lib('iP(hone|od|ad)', 'iP(hone|od)')])
await mutant('helper: any touch device is iOS', [lib('  if (/iP(hone|od|ad)/.test(ua)) return true\n', "  if (/iP(hone|od|ad)/.test(ua) || (typeof maxTouchPoints === 'number' && maxTouchPoints > 1)) return true\n")])
await mutant('helper: the directive is maximum-scale=2', [lib("export const IOS_MAX_SCALE_DIRECTIVE = 'maximum-scale=1'", "export const IOS_MAX_SCALE_DIRECTIVE = 'maximum-scale=2'")])
await mutant('helper: user-scalable=no instead (pinch zoom would go)', [lib("export const IOS_MAX_SCALE_DIRECTIVE = 'maximum-scale=1'", "export const IOS_MAX_SCALE_DIRECTIVE = 'user-scalable=no'")])
await mutant('helper: the content is replaced, not kept', [lib("return `${current.replace(/[\\s,;]+$/, '')}, ${IOS_MAX_SCALE_DIRECTIVE}`", 'return IOS_MAX_SCALE_DIRECTIVE')])
await mutant('helper: no separator before the directive', [lib("return `${current.replace(/[\\s,;]+$/, '')}, ${IOS_MAX_SCALE_DIRECTIVE}`", "return `${current.replace(/[\\s,;]+$/, '')},${IOS_MAX_SCALE_DIRECTIVE}`")])
await mutant('helper: a trailing comma is kept', [lib("return `${current.replace(/[\\s,;]+$/, '')}, ${IOS_MAX_SCALE_DIRECTIVE}`", 'return `${current}, ${IOS_MAX_SCALE_DIRECTIVE}`')])
await mutant('helper: an existing maximum-scale is added to, not set', [lib('    if (Number(existing[2]) === 1) return current\n    return current.replace(', '    if (Number(existing[2]) === 1) return current\n    return `${current}, ${IOS_MAX_SCALE_DIRECTIVE}`.replace(')])
await mutant('helper: maximum-scale=1.0 is rewritten', [lib('    if (Number(existing[2]) === 1) return current\n', '')])
await mutant('helper: an x-maximum-scale counts', [lib('/(^|[,;\\s])maximum-scale\\s*=\\s*([^,;\\s]*)/i.exec(current)', '/(^|[,;\\s-])maximum-scale\\s*=\\s*([^,;\\s]*)/i.exec(current)')])
await mutant('helper: an empty content gets a directive', [lib('  if (!/\\S/.test(current)) return current\n', '')])
// the installer and the hook
await mutant('installer: writes on every device', [lib("    if (next === original) return () => {}\n", '')])
await mutant('installer: never gives the original back', [lib("if (meta.isConnected !== false && meta.getAttribute('content') === applied) meta.setAttribute('content', original)", '')])
await mutant('installer: gives back even a content somebody else wrote', [lib("meta.isConnected !== false && meta.getAttribute('content') === applied", 'meta.isConnected !== false')])
await mutant('installer: writes to a meta that left the document', [lib("meta.isConnected !== false && meta.getAttribute('content') === applied", "meta.getAttribute('content') === applied")])
await mutant('installer: the second holder takes the changed content as the original', [lib('    held = { meta, original, applied: next }\n  }\n  holders += 1', '    held = { meta, original, applied: next }\n  } else { held.original = held.meta.getAttribute(\'content\') ?? \'\' }\n  holders += 1')])
await mutant('installer: the first release gives it back (holders not counted)', [lib('    if (holders > 0 || held === null) return', '    if (held === null) return')])
await mutant('installer: a release counts twice', [lib('    if (released) return\n    released = true\n', '')])
await mutant('installer: the query asks for any meta', [lib("doc.querySelector('meta[name=\"viewport\"]')", "doc.querySelector('meta')")])
await mutant('hook: no flag check (the document is read with the flag off)', [lib('    if (!STUDIO_PASS3_POLISH_G_ENABLED) return\n', '')])
await mutant('hook: its own flag, not PR A\'s', [lib('export const STUDIO_PASS3_POLISH_G_ENABLED = STUDIO_PASS3_POLISH_ENABLED\n', "export const STUDIO_PASS3_POLISH_G_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH_G === 'true'\n")])
await mutant('hook: runs after every render', [lib("    return installIosZoomFix(document, navigator)\n  }, [])", "    return installIosZoomFix(document, navigator)\n  })")])
await mutant('hook: no cleanup', [lib('    return installIosZoomFix(document, navigator)\n', '    installIosZoomFix(document, navigator)\n')])
await mutant('helper: a request', [lib('export function isIosDevice', "const ping = () => fetch('/api/x')\nexport function isIosDevice")])
await mutant('helper: a third import', [lib("import { STUDIO_PASS3_POLISH_ENABLED } from '@/lib/studio-pass3-polish'\n", "import { STUDIO_PASS3_POLISH_ENABLED } from '@/lib/studio-pass3-polish'\nimport { x } from '@/lib/x'\n")])
await mutant('mount: draws something', [[MOUNT, '  return null\n', '  return <i />\n']])
await mutant('mount: calls the hook twice', [[MOUNT, '  useStudioPass3PolishGViewport()\n  return null', '  useStudioPass3PolishGViewport()\n  useStudioPass3PolishGViewport()\n  return null']])
// the pins
const PAGE_GIMPORT = read(PAGE).split('\n').find(line => /^import \{ useStudioPass3PolishGViewport \}/.test(line))
const PAGE_GCALL = read(PAGE).split('\n').find(line => /^ {2}useStudioPass3PolishGViewport\(\)/.test(line))
const LAYOUT_GIMPORT = read(LAYOUT).split('\n').find(line => /^import \{ StudioPass3PolishGMount \}/.test(line))
const LAYOUT_GDRAW = '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishGMount />}{/* PASS3-POLISH-G */}'
await mutant('page: the call loses its marker', [[PAGE, PAGE_GCALL, PAGE_GCALL.replace('// PASS3-POLISH-G:', '//')]])
await mutant('page: the call is gone (the Builder would not get the fix)', [[PAGE, `${PAGE_GCALL}\n`, '']])
await mutant('page: the import is gone', [[PAGE, `${PAGE_GIMPORT}\n`, '']])
await mutant('page: an unmarked line added', [[PAGE, PAGE_GCALL, `${PAGE_GCALL}\n  const unmarked = 1`]])
await mutant('page: a base line changed', [[PAGE, "import { useStudioDuplicateCopyTitleProps } from '@/hooks/use-studio-duplicate-copy-title'", "import { useStudioDuplicateCopyTitleProps } from '@/hooks/use-studio-duplicate-copy-title.ts'"]])
await mutant("page: the call moves above PR D's", [[PAGE, `${PAGE_GCALL}\n`, ''], [PAGE, '  useStudioPass3PolishDMain(workspaceRef) // PASS3-POLISH-D', `${PAGE_GCALL}\n  useStudioPass3PolishDMain(workspaceRef) // PASS3-POLISH-D`]])
await mutant('layout: the mount is drawn without the flag', [[LAYOUT, LAYOUT_GDRAW, '      <StudioPass3PolishGMount />{/* PASS3-POLISH-G */}']])
await mutant('layout: the mount is gone (the account pages would not get the fix)', [[LAYOUT, `${LAYOUT_GDRAW}\n`, '']])
await mutant('layout: the import is gone', [[LAYOUT, `${LAYOUT_GIMPORT}\n`, '']])
await mutant('layout: the mount is drawn first', [[LAYOUT, `${LAYOUT_GDRAW}\n`, ''], [LAYOUT, '      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}', `${LAYOUT_GDRAW}\n      {STUDIO_PASS3_POLISH_ENABLED && <StudioPass3PolishMount />}{/* PASS3-POLISH */}`]])
await mutant('layout: draws something else with the flag', [[LAYOUT, LAYOUT_GDRAW, `${LAYOUT_GDRAW}\n      {STUDIO_PASS3_POLISH_ENABLED && <i data-g="1" />}{/* PASS3-POLISH-G */}`]])
await mutant('PR A: its hook takes the new import', [[A_HOOK, "import '@/components/studio-pass3-polish/studio-pass3-polish.css'\n", "import '@/components/studio-pass3-polish/studio-pass3-polish.css'\nimport '@/lib/studio-pass3-polish-g'\n"]])
await mutant("PR A: its lib's flag no longer needs the Studio shell", [[A_LIB, " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", '']])
await mutant("PR A: its mount is edited", [[A_MOUNT, '  return null\n', '  useStudioPass3PolishGViewportX()\n  return null\n']])
// decision D is not in this change
await mutant("FRONTEND-1's lib: the label is Auto", [[INTEL_P2, 'label: `Recommended — ${recommended.name}` }', "label: 'Auto' }"]])
// the strip, the registry, the taught proofs
await mutant('strip: leaves the marked lines', [], { strip: (rel, text) => (rel === PAGE || rel === LAYOUT ? text : stripPass3PolishG(rel, text)) })
await mutant("strip: the marker is a substring (PR A's lines go with this one's)", [], { strip: (rel, text) => (PASS3_POLISH_G_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes('PASS3-POLISH')).join('\n') : stripPass3PolishG(rel, text)) })
await mutant('strip: drops the trailing newline', [], { strip: (rel, text) => stripPass3PolishG(rel, text).replace(/\n$/, '') })
await mutant('strip: also removes an unmarked line', [], { strip: (rel, text) => (PASS3_POLISH_G_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !marked(line) && !line.startsWith('import type { ReactNode }')).join('\n') : stripPass3PolishG(rel, text)) })
await mutant("strip: does not put PR A's section 2 back", [], { strip: (rel, text) => (rel === A_CSS ? text : stripPass3PolishG(rel, text)) })
await mutant("strip: puts section 2 back into PR E's stylesheet too", [], { strip: (rel, text) => (rel === E_CSS ? text.split(PASS3_POLISH_G_SECTION_2_STUB).join(PASS3_POLISH_G_SECTION_2) : stripPass3PolishG(rel, text)) })
await mutant('taught proofs: PR E (taught by a later change) reads raw again, the registry read is gone', [['scripts/test-studio-pass3-polish-e.mjs', 'LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripPass3PolishE) + 1).reduce((out, strip) => strip(rel, out), fs.readFileSync(path.join(root, rel), \'utf8\'))', 'fs.readFileSync(path.join(root, rel), \'utf8\')']])
await mutant('taught proofs: PR E\'s registry read loses the later change\'s mark', [['scripts/test-studio-pass3-polish-e.mjs', ' // LATER-CHANGES: registry read (PHONE-SHELL-NAV)', ' //']])
await mutant('taught proofs: PR F\'s registry read skips the first later change (+ 2)', [['scripts/test-studio-pass3-polish-f.mjs', 'indexOf(stripPass3PolishF) + 1', 'indexOf(stripPass3PolishF) + 2']])
await mutant('taught proofs: PR F brings this change\'s narrower reading line back', [['scripts/test-studio-pass3-polish-f.mjs', 'LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripPass3PolishF) + 1).reduce((out, strip) => strip(rel, out), fs.readFileSync(path.join(root, rel), \'utf8\'))', 'stripPass3PolishG(rel, fs.readFileSync(path.join(root, rel), \'utf8\'))']])
await mutant("taught proofs: PR A's proof restores every file", [['scripts/test-studio-pass3-polish.mjs', "rel === 'components/studio-pass3-polish/studio-pass3-polish.css' ? stripPass3PolishG(rel, fs.readFileSync(path.join(root, rel), 'utf8')) : fs.readFileSync(path.join(root, rel), 'utf8')) // LATER", "stripPass3PolishG(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) // LATER"]])
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-pass3-polish-g-strip.mjs')).PASS3_POLISH_G_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR G (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)\n", '']])
await mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-pass3-polish-g-strip.mjs')).stripPass3PolishG, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR G (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n", '']])
await mutant('registry: the strip line moves above PR F\'s', [[REGISTRY, "  (await import('./studio-pass3-polish-g-strip.mjs')).stripPass3PolishG, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR G (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n", ''], [REGISTRY, "  (await import('./studio-pass3-polish-f-strip.mjs')).stripPass3PolishF, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR F (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n", "  (await import('./studio-pass3-polish-g-strip.mjs')).stripPass3PolishG, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR G (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n  (await import('./studio-pass3-polish-f-strip.mjs')).stripPass3PolishF, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR F (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n"]]) // two edits: the registry has other changes' lines between PR F's and this one's (D1), so the pair is not adjacent
await mutant('secret scan: a credential-shaped literal', [[LIB, "export const IOS_MAX_SCALE_DIRECTIVE = 'maximum-scale=1'", `export const IOS_MAX_SCALE_DIRECTIVE = 'maximum-scale=1'\nconst ${['api', 'Key'].join('')} = '${['AKIA', 'ABCDEFGH', '12345678'].join('')}'`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.log('SURVIVED:\n  ' + survived.join('\n  ')); process.exit(1) }
console.log(`test-studio-pass3-polish-g: ${checks} checks passed, ${killed.length}/${killed.length + survived.length} mutants killed; no network.`)
