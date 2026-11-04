// FRONTEND-2 (B59; FRONTEND-1's pre-promotion UX pass of 4 Nov, finding UX-21, and F-13's two known limits in REAL-PHONE-CHECK.md): proof for "Phone polish", three small phone fixes. Flag NEXT_PUBLIC_STUDIO_PHONE_POLISH (exact "true", build-time, default off),
// only with the phone shell (NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL); the landscape fix also with NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE.
// Run: node scripts/test-studio-phone-polish.mjs   (plain node: TypeScript transpile, react-dom/server, postcss, `git show` for the base commit; no network, no browser, no model call. There is no DOM library in this checkout: the Escape chain is proved from the INSTALLED Radix source plus
// the rendered sheet, not by pressing a key; a real phone with a keyboard is the final check)
//
//   1. lib       the flags (exact "true" with the shell, read inline, nowhere else), the sheet's props (none with the flag off), the focus decision (cancels Radix's default, focuses the sheet's own box)
//   2. sheet     the tab bar's sheet rendered (react-dom/server) with the flag off (any off spelling): byte for byte the base commit's HTML; with it on: the base HTML plus one attribute and the focus handler, nothing else
//   3. escape    ONE root cause for UX-21 and for "Escape does not close the More sheet", read from the installed Radix source and the rendered sheet: Radix focuses the first control that is not a link, which is the avatar; its Tooltip opens on focus (the hint); that
//                hint is a DismissableLayer and Escape closes only the topmost layer, so Escape 1 closes the hint, Escape 2 the sheet. With the fix the avatar is not focused, no hint opens, Escape 1 closes the sheet; no capture-phase handler in the app eats Escape
//   4. landscape the stylesheet's contract, computed from both stylesheets at 844x390 and 932x430 (and with a notch's safe area): flag off, the dock sits on the page number's box (the bug); flag on, it is clear of it, and the cards, the hidden top bar and the
//                authoring row move with it; the new rules outrank the stage's own in either order and match nothing without the flag's attribute; the attribute is set only with the flag, only on the stage, and taken off again
//   5. pin       the two app files without this change's lines are the base's byte for byte (also through the registry), twice over; the one rewritten line is pinned; .env.example block (appended, default "false"); the registry's three lines; the two taught proofs
//   6. scope     the COMMITTED diff only, GATE-SAFE (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge), no `hash-object --stdin`, the co-author line, no secret
//   7. mutants   each one must make sections 1-5 fail
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
  BASE_COMMIT, PHONE_POLISH_ENV_BLOCK, PHONE_POLISH_FILES, PHONE_POLISH_LINE_EDITS, PHONE_POLISH_MARKER_RE, PHONE_POLISH_NEW_FILES, PHONE_POLISH_PIN_EDITS, PHONE_POLISH_PIN_FILES, PHONE_POLISH_PIN_MARK, PHONE_POLISH_SCOPE_FILES, PHONE_POLISH_SUBJECT, stripPhonePolish,
} from './studio-phone-polish-strip.mjs'
import { stripLaterChanges, stripLaterEnvBlocks } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const h = React.createElement
const BASE = process.env.PHONE_POLISH_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000 })
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
let overrides = {} // in-memory mutations: every section reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')

let checks = 0
const count = fn => (...args) => { checks += 1; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const eq = count(assert.equal), deep = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message)), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const LIB = 'lib/studio-phone-polish.ts', BAR = 'components/layout/studio-phone-tab-bar.tsx', LANDSCAPE = 'components/builder/studio-phone-landscape.tsx', CSS = 'components/layout/studio-phone-polish.css', STAGE_CSS = 'components/builder/studio-phone-landscape.css'
const FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_POLISH', SHELL = 'NEXT_PUBLIC_STUDIO_PHONE_SHELL', V4 = 'NEXT_PUBLIC_STUDIO_V4_SHELL', LAND = 'NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE'
const SPELLINGS = [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'true']
const ON = { [FLAG]: 'true', [SHELL]: 'true', [V4]: 'true' }
const OFFS = [{}, { [SHELL]: 'true', [V4]: 'true' }, { [FLAG]: 'true' }, { [FLAG]: 'true', [SHELL]: 'true' }, { [FLAG]: 'true', [V4]: 'true' }, { [FLAG]: 'false', [SHELL]: 'true', [V4]: 'true' }, { [FLAG]: 'TRUE', [SHELL]: 'true', [V4]: 'true' }, { [FLAG]: '1', [SHELL]: 'true', [V4]: 'true' }]

// ---------------------------------------------------------------- module loader (TypeScript transpiled, run in a vm with the given stubs; real files for the lib modules this change reads)
const compileCache = new Map()
function compile(rel, text) {
  const id = `${rel}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const REAL_LIBS = { '@/lib/studio-phone-shell': 'lib/studio-phone-shell.ts', '@/lib/studio-nav-labels': 'lib/studio-nav-labels.ts', '@/lib/last-builder-session': 'lib/last-builder-session.ts', '@/lib/studio-phone-polish': LIB }
function load(rel, { env = {}, stubs = {}, globals = {}, text = read(rel) } = {}) {
  const module = { exports: {} }
  const req = spec => {
    if (Object.prototype.hasOwnProperty.call(stubs, spec)) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec in REAL_LIBS) return load(REAL_LIBS[spec], { env, globals })
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, text), { module, exports: module.exports, require: req, process: { env }, ...globals }, { filename: rel })
  return module.exports
}

// ---------------------------------------------------------------- 1. lib
function proveLib(at = '') {
  const a = message => (at ? `${at}: lib: ${message}` : `lib: ${message}`)
  const lib = env => load(LIB, { env })
  for (const flag of SPELLINGS) for (const shell of SPELLINGS) {
    const env = { ...(flag === undefined ? {} : { [FLAG]: flag }), ...(shell === undefined ? {} : { [SHELL]: shell, [V4]: shell }) }
    eq(lib(env).STUDIO_PHONE_POLISH_ENABLED, flag === 'true' && shell === 'true', a(`on only for the exact value "true" with the shell (${JSON.stringify(env)})`))
  }
  for (const [name, env, want] of [['no Studio shell', { [FLAG]: 'true', [SHELL]: 'true' }, false], ['no phone shell', { [FLAG]: 'true', [V4]: 'true' }, false], ['the flag alone', { [FLAG]: 'true' }, false], ['all three', ON, true]]) eq(lib(env).STUDIO_PHONE_POLISH_ENABLED, want, a(`${name}: ${want}`))
  for (const flag of SPELLINGS) for (const land of SPELLINGS) {
    const env = { ...ON, ...(flag === undefined ? { [FLAG]: undefined } : { [FLAG]: flag }), ...(land === undefined ? {} : { [LAND]: land }) }
    eq(lib(env).STUDIO_PHONE_POLISH_LANDSCAPE_ENABLED, flag === 'true' && land === 'true', a(`the landscape fix needs the flag AND the landscape stage, both exact "true" (${JSON.stringify(env)})`))
  }
  const text = read(LIB)
  match(text, /process\.env\.NEXT_PUBLIC_STUDIO_PHONE_POLISH, process\.env\.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL\)/, a('the three values are read inline (Next inlines NEXT_PUBLIC_ values at build time)'))
  match(text, /process\.env\.NEXT_PUBLIC_STUDIO_PHONE_POLISH, process\.env\.NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE, process\.env\.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL\)/, a('the landscape flag too'))
  eq((text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').match(/process\.env/g) || []).length, 7, a('the environment is read for the flags only (3 + 4 values), nowhere else'))
  eq((text.match(/^import /gm) || []).length, 0, a('no import: the pinned phone libs are neither edited nor needed'))
  // the sheet's props and the focus decision
  const on = lib(ON), off = lib({})
  deep(off.STUDIO_PHONE_MORE_PROPS, {}, a('flag off: no prop at all (an empty spread draws nothing)'))
  deep(Object.keys(on.STUDIO_PHONE_MORE_PROPS).sort(), ['data-studio-phone-polish', 'onOpenAutoFocus'], a('flag on: the focus decision and the attribute the stylesheet\'s focus rule needs, nothing else'))
  eq(on.STUDIO_PHONE_MORE_PROPS['data-studio-phone-polish'], 'true', a('the attribute\'s value'))
  eq(on.STUDIO_PHONE_MORE_PROPS.onOpenAutoFocus, on.studioPhoneMoreOpenFocus, a('the prop is the exported decision'))
  eq(on.STUDIO_PHONE_POLISH_ATTRIBUTE, 'data-studio-phone-polish', a('the attribute\'s name'))
  const calls = []
  const sheet = { focus: options => calls.push(['focus', options]) }
  on.studioPhoneMoreOpenFocus({ preventDefault: () => calls.push(['preventDefault']), currentTarget: sheet })
  deep(calls, [['preventDefault'], ['focus', { preventScroll: true }]], a('the decision cancels Radix\'s default initial focus FIRST, then focuses the sheet\'s own box without scrolling'))
  const edge = []
  on.studioPhoneMoreOpenFocus({ preventDefault: () => edge.push('p'), currentTarget: null }); on.studioPhoneMoreOpenFocus({ preventDefault: () => edge.push('p'), currentTarget: {} })
  deep(edge, ['p', 'p'], a('no box, or a box that cannot take focus: still cancelled, nothing thrown'))
  deep(plain(on.STUDIO_PHONE_PAGE_NUMBER_BOX), { right: 8, bottom: 8, width: 88, height: 28 }, a('the page number\'s reserved box (Reveal puts it 8 px from the bottom and right edges)'))
  eq(on.STUDIO_PHONE_DOCK_LIFT, 34, a('the dock\'s lift'))
  // Reveal's slide number, where the Layout viewer draws it (the repo's own layout code, when this checkout has it)
  const reveal = path.join(root, '..', '..', 'backend', 'layout-builder', 'src', 'core', 'reveal-config.js')
  if (fs.existsSync(reveal)) match(fs.readFileSync(reveal, 'utf8'), /slideNumber: 'c\/t'/, a('the page number is Reveal\'s slide number, "current / total", drawn in the viewer\'s frame'))
}

// ---------------------------------------------------------------- 2. the sheet, rendered
const ICON = name => props => h('svg', { 'data-icon': name, 'aria-hidden': props['aria-hidden'] })
const lucide = new Proxy({ __esModule: true }, { get: (t, name) => (name === '__esModule' ? true : ICON(String(name))) })
function barStubs(state) {
  const dialog = {
    __esModule: true,
    Root: props => { state.root.push(props); return h(React.Fragment, null, props.children) },
    Trigger: props => { state.trigger.push(props); return React.cloneElement(props.children, { 'data-dialog-trigger': 'true' }) },
    Portal: props => h('div', { 'data-portal': 'true' }, props.children),
    Overlay: props => h('div', { ...props, 'data-overlay': 'true' }),
    Content: props => { state.content.push(props); const { children, ...rest } = props; for (const key of Object.keys(rest)) if (typeof rest[key] === 'function') delete rest[key]; return h('div', { role: 'dialog', 'aria-modal': 'true', ...rest }, children) },
    Title: props => { const { children, ...rest } = props; return h('h2', rest, children) },
  }
  return {
    react: React,
    'next/link': { __esModule: true, default: ({ href, children, ...rest }) => h('a', { href, ...rest }, children) },
    'next/navigation': { usePathname: () => state.pathname, useRouter: () => ({ push: target => state.pushed.push(target) }) },
    '@radix-ui/react-dialog': dialog,
    'lucide-react': lucide,
    '@/components/user-profile-menu': { UserProfileMenu: props => { state.profile.push(props); return h('button', { type: 'button', 'data-profile-stub': 'true', 'aria-label': 'Open account menu' }) } },
    '@/hooks/use-auth': { useAuth: () => ({ user: state.user }) },
  }
}
const newState = pathname => ({ pathname, pushed: [], root: [], trigger: [], content: [], profile: [], user: { id: 'u-1', email: 'u@example.test' } })
function renderBar(pathname, env, { text } = {}) {
  const state = newState(pathname)
  const { StudioPhoneTabBar } = load(BAR, { env, stubs: barStubs(state), ...(text === undefined ? {} : { text }) })
  return { html: renderToStaticMarkup(h(StudioPhoneTabBar, {})), state }
}
const ROUTES = ['/builder', '/dashboard', '/studio/templates', '/knowledge', '/settings']
const POLISH_ATTR = ' data-studio-phone-polish="true"'
function proveSheet(at = '') {
  const a = message => (at ? `${at}: sheet: ${message}` : `sheet: ${message}`)
  for (const route of ROUTES) {
    const base = renderBar(route, ON, { text: baseOf(BAR) })
    nomatch(base.html, /data-studio-phone-polish/, a(`${route}: the base commit's sheet has no polish attribute (the control)`))
    for (const env of OFFS) {
      const now = renderBar(route, env)
      eq(sha(now.html), sha(renderBar(route, env, { text: baseOf(BAR) }).html), a(`${route}: flag off (${JSON.stringify(env)}): the sheet's HTML is the base commit's, byte for byte (sha256)`))
      deep(now.state.content.map(props => Object.keys(props).sort()), base.state.content.map(props => Object.keys(props).sort()), a(`${route}: flag off: the same props reach Radix's Dialog.Content as at the base commit`))
      ok(!('onOpenAutoFocus' in now.state.content[0]), a(`${route}: flag off: Radix keeps its own initial focus`))
    }
    const now = renderBar(route, ON)
    eq(now.html.split(POLISH_ATTR).length - 1, 1, a(`${route}: flag on: one attribute, on the sheet`))
    eq(now.html.replace(POLISH_ATTR, ''), base.html, a(`${route}: flag on: without that attribute the HTML is the base commit's, byte for byte (nothing is added, moved or removed)`))
    match(now.html, /<div role="dialog" aria-modal="true" data-studio-v4-shell="true" data-studio-phone-more="true" data-studio-phone-polish="true">/, a(`${route}: flag on: the attribute is on the sheet's own box (the dialog)`))
    const content = now.state.content[0]
    eq(typeof content.onOpenAutoFocus, 'function', a(`${route}: flag on: the sheet takes the initial focus itself`))
    for (const prop of ['onEscapeKeyDown', 'onPointerDownOutside', 'onInteractOutside', 'onCloseAutoFocus', 'forceMount']) ok(!(prop in content), a(`${route}: flag on: the sheet still keeps Radix's ${prop} (Escape, a tap outside and the way back to More are Radix's)`))
    deep(now.state.profile.map(props => [props.studioLabels, props.studioPalette]), [[true, false]], a(`${route}: flag on: the account menu gets the props it had`))
    eq(now.state.root[0].open, false, a(`${route}: flag on: closed at first`)); ok(!('modal' in now.state.root[0]), a(`${route}: flag on: still modal (the Radix default)`))
  }
}

// ---------------------------------------------------------------- 3. Escape and the hint: one root cause (the installed Radix source and the rendered sheet)
const radixDir = (pkg, from) => fs.realpathSync(path.dirname(nodeRequire.resolve(pkg, { paths: [from] })))
const radixText = dir => fs.readFileSync(path.join(dir, 'index.mjs'), 'utf8')
const dialogDir = radixDir('@radix-ui/react-dialog', path.join(root, 'components')) // the installed Radix, and the packages it is built from (resolved from each one's own place in the store)
const layerDir = radixDir('@radix-ui/react-dismissable-layer', dialogDir)
/** Radix's rule for "which control gets the focus when a modal opens": the first candidate that is not a link, unless the open-focus event was cancelled. Run on the sheet as rendered. */
function initialFocus(sheetHtml, prevented) {
  if (prevented) return 'the sheet'
  const tabbable = [...sheetHtml.matchAll(/<(a|button)\b[^>]*>/g)].map(m => ({ tag: m[1].toUpperCase(), el: m[0] }))
  const first = tabbable.filter(item => item.tag !== 'A')[0]
  return first ? (/data-profile-stub/.test(first.el) ? 'the avatar' : 'a button') : 'the sheet'
}
/** Radix's rule for Escape: it closes the TOPMOST layer only. `layers` is the stack, the sheet first. */
function escapePresses(layers) { let presses = 0; const stack = [...layers]; while (stack.includes('the sheet')) { stack.pop(); presses += 1 } return presses }
function proveEscape(at = '') {
  const a = message => (at ? `${at}: escape: ${message}` : `escape: ${message}`)
  // the installed Radix
  const scope = radixText(radixDir('@radix-ui/react-focus-scope', dialogDir)), layer = radixText(layerDir), tooltip = radixText(radixDir('@radix-ui/react-tooltip', path.join(root, 'components'))), escapeKey = radixText(radixDir('@radix-ui/react-use-escape-keydown', layerDir))
  match(scope, /const mountEvent = new CustomEvent\(AUTOFOCUS_ON_MOUNT, EVENT_OPTIONS\);[\s\S]*?if \(!mountEvent\.defaultPrevented\) \{\s*focusFirst\(removeLinks\(getTabbableCandidates\(container\)\), \{ select: true \}\);/, a('Radix FocusScope: on mount the first candidate that is NOT a link takes the focus, unless the open-focus event was cancelled'))
  match(scope, /Primitive\.div, \{ tabIndex: -1, \.\.\.scopeProps/, a('Radix FocusScope: the sheet\'s own box is focusable (tabIndex -1), so the fix has somewhere to put the focus'))
  match(scope, /function removeLinks\(items\) \{\s*return items\.filter\(\(item\) => item\.tagName !== "A"\);/, a('Radix FocusScope: links are skipped'))
  match(tooltip, /onFocus: composeEventHandlers\(props\.onFocus, \(\) => \{\s*if \(!isPointerDownRef\.current\) context\.onOpen\(\);/, a('Radix Tooltip: the trigger opens on focus (unless a pointer is down)'))
  match(tooltip, /onPointerMove: composeEventHandlers\(props\.onPointerMove, \(event\) => \{\s*if \(event\.pointerType === "touch"\) return;/, a('Radix Tooltip: touch movement never opens it (so on a phone only focus does)'))
  match(tooltip, /DismissableLayer,\s*\{\s*asChild: true,[\s\S]*?onEscapeKeyDown,[\s\S]*?onDismiss: onClose,/, a('Radix Tooltip: its content is a DismissableLayer'))
  match(layer, /useEscapeKeydown\(\(event\) => \{\s*const isHighestLayer = index === context\.layers\.size - 1;\s*if \(!isHighestLayer\) return;/, a('Radix DismissableLayer: Escape is for the TOPMOST layer only'))
  match(escapeKey, /ownerDocument\.addEventListener\("keydown", handleKeyDown, \{ capture: true \}\)/, a('Radix: the Escape listener is on the document, capture phase (focus anywhere in the page reaches it; the Layout frame\'s own keys do not)'))
  // the app: the hint on the account menu, and the sheet's account row
  const profile = stripLaterChanges('components/user-profile-menu.tsx', read('components/user-profile-menu.tsx')), hint = stripLaterChanges('components/layout/studio-navigation-hint.tsx', read('components/layout/studio-navigation-hint.tsx'))
  match(profile, /<StudioNavigationHint enabled=\{studioLabels\} label="Account menu">\s*<DropdownMenuTrigger asChild>/, a('the account menu\'s trigger is inside the "Account menu" hint (UX-21), which is on when studioLabels is'))
  match(hint, /<TooltipTrigger asChild>\{children\}<\/TooltipTrigger>/, a('the hint is a Radix Tooltip around the trigger itself'))
  // the sheet, rendered with the flag off (the base) and on
  for (const route of ['/builder', '/knowledge']) {
    const base = renderBar(route, {}), now = renderBar(route, ON)
    const sheetOf = html => html.slice(html.indexOf('<div data-portal'))
    deep(base.state.profile.map(props => props.studioLabels), [true], a(`${route}: the sheet\'s account menu has its hint on (studioLabels)`))
    // what each press of Escape closes, from what the sheet does on open
    const events = flagged => { const cancelled = { value: false }; const fn = flagged.state.content[0].onOpenAutoFocus; if (fn) fn({ preventDefault: () => { cancelled.value = true }, currentTarget: { focus() {} } }); return cancelled.value }
    const baseFocus = initialFocus(sheetOf(base.html), events(base)), nowFocus = initialFocus(sheetOf(now.html), events(now))
    eq(baseFocus, 'the avatar', a(`${route}: without the flag the sheet's first non-link control, the avatar, takes the focus on open`))
    eq(nowFocus, 'the sheet', a(`${route}: with the flag the sheet's own box takes it, not the avatar`))
    const layersOf = focus => ['the sheet', ...(focus === 'the avatar' ? ['the account hint'] : [])]
    eq(escapePresses(layersOf(baseFocus)), 2, a(`${route}: without the flag Escape closes the hint first and the sheet on the second press (the F-13 limit)`))
    eq(escapePresses(layersOf(nowFocus)), 1, a(`${route}: with the flag the first Escape closes the sheet, and no hint opens over the Help row (UX-21)`))
  }
  eq([...renderBar('/builder', {}).html.matchAll(/data-studio-phone-more-link="/g)].length, 4, a('the four links in the sheet are the ones Radix skips (the account menu is the only button)'))
  // the landscape hamburger's own card closes on Escape by its own capture listener; its More entry opens this same sheet
  const land = stripPhonePolish(LANDSCAPE, read(LANDSCAPE))
  match(land, /document\.addEventListener\("keydown", onKey, true\)/, a('the landscape cards: a capture-phase keydown listener'))
  match(land, /if \(event\.key === "Escape"\) \{ event\.stopPropagation\(\); closeMenu\(\) \}/, a('the landscape cards: Escape closes the open card'))
  match(land, /const control = find\(studioPhoneNavSelector\(key\)\)\s*\n\s*if \(control\) requestAnimationFrame\(\(\) => control\.click\(\)\)/, a('the hamburger\'s More entry clicks the tab bar\'s own More control: the same Radix sheet'))
  // nothing in the app eats Escape before Radix: every capture-phase keydown listener is known, and none of them ends the key for a sheet
  const hits = []
  const scan = dir => { for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const rel = `${dir}/${entry.name}`; if (entry.isDirectory()) { if (entry.name !== 'node_modules' && entry.name !== '.next') scan(rel) } else if (/\.tsx?$/.test(entry.name)) { const text = read(rel); if (/addEventListener\((['"])keydown\1[^)]*(true|capture)/.test(text)) hits.push(rel) } } }
  for (const dir of ['app', 'components', 'hooks', 'lib']) scan(dir)
  deep(hits.sort(), ['components/builder/studio-phone-landscape.tsx', 'components/workspace-intro/workspace-intro.tsx', 'lib/studio-payments-open-soon.ts'], a('the only capture-phase keydown listeners: the landscape cards (closed before More opens), the workspace intro (only for keys inside its own surface) and the payments guard (Enter and Space only)'))
  match(read('components/workspace-intro/workspace-intro.tsx'), /if \(!surfaceNode\?\.contains\(event\.target as Node\)\) return;/, a('the workspace intro ignores keys outside its own surface'))
  match(read('lib/studio-payments-open-soon.ts'), /if \(key !== 'Enter' && key !== ' ' && key !== 'Spacebar'\) return/, a('the payments guard ignores Escape'))
}

// ---------------------------------------------------------------- 4. the landscape stylesheet's contract, computed
const parseSheet = (rel, text) => {
  const rules = []
  let order = 0
  postcss.parse(text).walkRules(rule => {
    const media = []
    for (let node = rule.parent; node && node.type !== 'root'; node = node.parent) if (node.type === 'atrule' && node.name === 'media') media.push(node.params.replace(/\s+/g, ' '))
    const decls = {}
    rule.walkDecls(decl => { decls[decl.prop] = decl.value.replace(/\s+/g, ' ').trim() })
    for (const selector of rule.selectors) rules.push({ rel, selector: selector.replace(/\s+/g, ' ').trim(), decls, media, order: order++ })
  })
  return rules
}
/** compounds and combinators of a selector with attributes, tags and :is(...) only; anything else (:has, :focus, ::after ...) makes the compound unmatchable here */
function parseSelector(selector) {
  const parts = []
  let depth = 0, current = '', pending = ' '
  const flush = () => { if (current !== '') { parts.push({ combinator: parts.length ? pending : ' ', compound: current }); current = ''; pending = ' ' } }
  for (const ch of selector) {
    if (ch === '(' || ch === '[') depth += 1
    if (ch === ')' || ch === ']') depth -= 1
    if (depth === 0 && ch === '>') { flush(); pending = '>'; continue }
    if (depth === 0 && /\s/.test(ch)) { flush(); continue }
    current += ch
  }
  flush()
  return parts
}
function parseCompound(compound) {
  const out = { tag: null, attrs: [], any: [], bad: false }
  let rest = compound
  const tag = /^[a-z][a-z0-9]*/i.exec(rest); if (tag) { out.tag = tag[0]; rest = rest.slice(tag[0].length) }
  while (rest !== '') {
    let m
    if ((m = /^\[([\w-]+)(?:="([^"]*)")?\]/.exec(rest))) { out.attrs.push([m[1], m[2] ?? null]); rest = rest.slice(m[0].length) }
    else if (rest.startsWith(':is(')) { let depth = 0, end = -1; for (let i = 3; i < rest.length; i++) { if (rest[i] === '(') depth++; if (rest[i] === ')') { depth--; if (depth === 0) { end = i; break } } } out.any.push(splitTop(rest.slice(4, end)).map(parseCompound)); rest = rest.slice(end + 1) }
    else { out.bad = true; break }
  }
  return out
}
const splitTop = text => { const items = []; let depth = 0, cur = ''; for (const ch of text) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && depth === 0) { items.push(cur.trim()); cur = '' } else cur += ch } items.push(cur.trim()); return items }
const matchesCompound = (c, node) => !c.bad && (c.tag === null || c.tag === node.tag) && c.attrs.every(([name, value]) => name in node.attrs && (value === null || node.attrs[name] === value)) && c.any.every(options => options.some(option => matchesCompound(option, node)))
function matchesSelector(selector, chain) { // chain: ancestors first, the element last
  const parts = parseSelector(selector).map(part => ({ ...part, compound: parseCompound(part.compound) }))
  const go = (partIndex, nodeIndex) => {
    if (!matchesCompound(parts[partIndex].compound, chain[nodeIndex])) return false
    if (partIndex === 0) return true
    if (parts[partIndex].combinator === '>') return nodeIndex > 0 && go(partIndex - 1, nodeIndex - 1)
    for (let i = nodeIndex - 1; i >= 0; i--) if (go(partIndex - 1, i)) return true
    return false
  }
  return go(parts.length - 1, chain.length - 1)
}
function specificity(selector) {
  const sum = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  const ofCompound = c => c.any.reduce((acc, options) => { const best = options.map(ofCompound).sort((x, y) => y[0] - x[0] || y[1] - x[1] || y[2] - x[2])[0]; return sum(acc, best) }, [0, c.attrs.length, c.tag ? 1 : 0])
  return parseSelector(selector).map(part => ofCompound(parseCompound(part.compound))).reduce(sum, [0, 0, 0])
}
const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
const html = state => ({ tag: 'html', attrs: state })
const shell = { tag: 'div', attrs: { 'data-studio-v4-shell': 'true' } }, column = { tag: 'div', attrs: { 'data-studio-v4-shell-column': '' } }
const ELEMENTS = {
  dock: [{ tag: 'div', attrs: { 'data-studio-phone-dock': 'true' } }],
  fanCard: [{ tag: 'div', attrs: { 'data-studio-phone-fan-card': 'true' } }],
  navCard: [{ tag: 'div', attrs: { 'data-studio-phone-nav-card': 'true' } }],
  header: [shell, column, { tag: 'header', attrs: { 'data-studio-v4-shell-header': '' } }],
  slot: [shell, { tag: 'div', attrs: { 'data-studio-authoring-slot': '' } }],
  sheet: [{ tag: 'div', attrs: { 'data-studio-v4-shell': 'true', 'data-studio-phone-more': 'true' } }],
}
/** the winning value of `prop` for an element: highest specificity, then the later rule (sheets in the order given) */
function cascade(rules, state, element, prop, query) {
  let best = null
  for (const rule of rules) {
    if (!(prop in rule.decls) || rule.media.length !== 1 || rule.media[0] !== query) continue
    if (!matchesSelector(rule.selector, [html(state), ...ELEMENTS[element]])) continue
    const spec = specificity(rule.selector)
    if (!best || cmp(spec, best.spec) > 0 || (cmp(spec, best.spec) === 0 && rule.order > best.order)) best = { spec, order: rule.order, value: rule.decls[prop] }
  }
  return best && best.value
}
function evalPx(value, ctx) {
  const expr = value.replace(/env\(safe-area-inset-(top|right|bottom|left), 0px\)/g, (_, side) => `${ctx.inset[side]}px`).replace(/100dvh/g, `${ctx.H}px`).replace(/100vw/g, `${ctx.W}px`).replace(/calc\(/g, '(')
  assert.match(expr, /^[0-9+\-*/().\spx]+$/, `a value this proof can compute: ${value}`)
  return Function(`"use strict"; return (${expr.replace(/(\d)px/g, '$1')})`)()
}
const overlap = (p, q) => p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1
const grow = (r, by) => ({ x0: r.x0 - by, y0: r.y0 - by, x1: r.x1 + by, y1: r.y1 + by })
function proveLandscape(at = '') {
  const a = message => (at ? `${at}: landscape: ${message}` : `landscape: ${message}`)
  const lib = load(LIB, { env: ON }), stageLib = load('lib/studio-phone-landscape.ts', { env: {} })
  const QUERY = stageLib.STUDIO_PHONE_LANDSCAPE_QUERY.replace(/\s+/g, ' ')
  const stage = parseSheet(STAGE_CSS, read(STAGE_CSS)), polish = parseSheet(CSS, read(CSS))
  const sheets = { 'stage then polish': [...stage, ...polish.map(rule => ({ ...rule, order: rule.order + 10_000 }))], 'polish then stage': [...polish, ...stage.map(rule => ({ ...rule, order: rule.order + 10_000 }))] }
  const queryRules = polish.filter(rule => rule.media.length > 0)
  ok(queryRules.length >= 4 && queryRules.every(rule => rule.media.length === 1 && rule.media[0] === QUERY), a('every landscape rule sits in the stage\'s own media query, the one the component reads (a phone turned sideways)'))
  ok(polish.every(rule => /\[data-studio-phone-polish="(stage|true)"\]/.test(rule.selector)), a('EVERY selector of the new stylesheet needs the flag\'s attribute (data-studio-phone-polish), which exists only with the flag on'))
  ok(polish.filter(rule => rule.media.length > 0).every(rule => /^html\[data-studio-phone-polish="stage"\]\[data-studio-phone-landscape="stage"\] /.test(rule.selector)), a('the landscape rules need the stage\'s html attribute AND the flag\'s, so they outrank the stage\'s own rules'))
  // the stage's own numbers, read from its stylesheet
  const stageDecl = (selector, prop) => { const rule = stage.find(r => r.selector === selector && prop in r.decls); assert.ok(rule, `${selector} { ${prop} }`); return rule.decls[prop] }
  const size = Number.parseFloat(stageDecl('[data-studio-phone-nav-button="true"]', 'width')), sizeH = Number.parseFloat(stageDecl('[data-studio-phone-nav-button="true"]', 'height')), gap = Number.parseFloat(stageDecl('[data-studio-phone-dock="true"]', 'gap')), ring = -Number.parseFloat(stageDecl('[data-studio-phone-nav-button="true"]::after', 'inset'))
  deep([size, sizeH, gap, ring], [40, 40, 8, 2], a('the stage\'s buttons: 40 x 40 px, 8 px apart, a 2 px hit-area ring'))
  const insets = [{ top: 0, right: 0, bottom: 0, left: 0 }, { top: 0, right: 47, bottom: 21, left: 47 }]
  const OFFSTATE = { 'data-studio-phone-landscape': 'stage' }, ONSTATE = { 'data-studio-phone-landscape': 'stage', 'data-studio-phone-polish': 'stage' }
  const box = lib.STUDIO_PHONE_PAGE_NUMBER_BOX, LIFT = lib.STUDIO_PHONE_DOCK_LIFT
  for (const [W, H] of [[844, 390], [932, 430]]) for (const inset of insets) {
    const ctx = { W, H, inset }, where = `${W}x${H}${inset.bottom ? ' with a notch\'s safe area' : ''}`
    const number = { x0: W - box.right - box.width, x1: W - box.right, y0: H - box.bottom - box.height, y1: H - box.bottom }
    const measure = (state, order) => {
      const rules = sheets[order], value = (element, prop) => evalPx(cascade(rules, state, element, prop, QUERY), ctx)
      const right = value('dock', 'right'), bottom = value('dock', 'bottom'), width = 2 * size + gap
      const dock = { x0: W - right - width, x1: W - right, y0: H - bottom - sizeH, y1: H - bottom }
      return { dock, bottom, fanBottom: value('fanCard', 'bottom'), navBottom: value('navCard', 'bottom'), fanTop: value('fanCard', 'bottom') + value('fanCard', 'max-height'), navTop: value('navCard', 'bottom') + value('navCard', 'max-height'), headerBottom: value('header', 'bottom'), slotBottom: value('slot', 'bottom'), headerRight: value('header', 'right') }
    }
    for (const order of Object.keys(sheets)) {
      const off = measure(OFFSTATE, order), on = measure(ONSTATE, order)
      const label = `${where}, ${order}`
      deep([off.bottom, off.fanBottom, off.navBottom, off.headerBottom, off.slotBottom], [10 + inset.bottom, 58 + inset.bottom, 58 + inset.bottom, 8, 8], a(`${label}: flag off, the stage's own numbers (10 px dock, 58 px cards, 8 px hidden bar)`))
      ok(overlap(grow(off.dock, ring), number), a(`${label}: flag off, the dock's hit area sits on the page number's box (the bug)`))
      ok(overlap(off.dock, number), a(`${label}: flag off, the visible buttons cover the page number too`))
      ok(!overlap(grow(on.dock, ring), number), a(`${label}: flag on, the dock's hit area is clear of the page number's box`))
      ok(number.y0 - (on.dock.y1 + ring) >= 4, a(`${label}: flag on, at least 4 px of air between the hit area and the page number (${number.y0 - (on.dock.y1 + ring)} px)`))
      ok(on.dock.y0 >= 0 && on.dock.x0 >= 0 && on.dock.y1 <= H && on.dock.x1 <= W, a(`${label}: flag on, the dock is on the screen`))
      ok(on.dock.y0 > 8 + 30 + 7 + 8, a(`${label}: flag on, clear of the Chat button at the top right`))
      eq(on.bottom - off.bottom, LIFT, a(`${label}: the dock is lifted by exactly the lift (${LIFT} px), the safe area cancelling out`))
      eq(on.fanBottom - off.fanBottom, LIFT, a(`${label}: the action card goes up with it`)); eq(on.navBottom - off.navBottom, LIFT, a(`${label}: the destinations card goes up with it`))
      eq(on.fanTop, off.fanTop, a(`${label}: the action card's top edge is where it was (it is shorter by the lift)`)); eq(on.navTop, off.navTop, a(`${label}: the destinations card's top edge is where it was`))
      eq(on.fanBottom - (H - on.dock.y0), off.fanBottom - (H - off.dock.y0), a(`${label}: the card keeps its gap above the dock (${on.fanBottom - (H - on.dock.y0)} px)`))
      eq(on.headerBottom - off.headerBottom, LIFT, a(`${label}: the page's hidden top bar (whose Export menu opens beside the plus) follows by the same`)); eq(on.slotBottom - off.slotBottom, LIFT, a(`${label}: so does the authoring row (Add Element's menu)`))
      eq(on.headerRight, off.headerRight, a(`${label}: sideways nothing moved`))
      eq(on.dock.x1, off.dock.x1, a(`${label}: the dock keeps its right edge`))
    }
    const forward = measure(ONSTATE, 'stage then polish'), backward = measure(ONSTATE, 'polish then stage')
    deep(forward, backward, a(`${where}: the new rules win in either stylesheet order`))
    deep(measure({ 'data-studio-phone-landscape': 'stage' }, 'stage then polish'), measure({ 'data-studio-phone-landscape': 'stage' }, 'polish then stage'), a(`${where}: flag off, the order of the two stylesheets changes nothing`))
    for (const element of ['dock', 'fanCard', 'navCard', 'header', 'slot']) for (const prop of ['bottom', 'max-height', 'right']) eq(cascade(sheets['stage then polish'], { 'data-studio-phone-polish': 'stage' }, element, prop, QUERY), cascade(stage, {}, element, prop, QUERY), a(`${where}: the flag's attribute without the stage changes nothing (${element} ${prop}): the new rules match nothing without the stage`))
  }
  // the sheet's focus rule
  const polishRules = polish.filter(rule => rule.media.length === 0)
  deep(polishRules.map(rule => [rule.selector, rule.decls.outline]), [['[data-studio-phone-more="true"][data-studio-phone-polish="true"]:focus', 'none']], a('outside the query: one rule, no outline on the focused sheet, only on a sheet that has the flag\'s attribute'))
  ok(!matchesSelector('[data-studio-phone-more="true"][data-studio-phone-polish="true"]', [html({}), ...ELEMENTS.sheet]), a('flag off: the sheet does not have the attribute, the rule matches nothing'))
}

// ---------------------------------------------------------------- 4b. the stage's attribute (the component's marked effect, run)
function proveStageAttribute(at = '') {
  const a = message => (at ? `${at}: stage attribute: ${message}` : `stage attribute: ${message}`)
  const lines = read(LANDSCAPE).split('\n')
  const start = lines.findIndex(line => /useEffect\(\(\) => \{ \/\/ PHONE-POLISH/.test(line)), end = lines.findIndex(line => /\}, \[stage\]\) \/\/ PHONE-POLISH/.test(line))
  ok(start >= 0 && end > start, a('the marked effect is there'))
  const block = lines.slice(start, end + 1)
  ok(block.every(line => PHONE_POLISH_MARKER_RE.test(line)), a('every line of it carries the marker'))
  const run = (enabled, stage) => {
    const attrs = {}, log = []
    const document = { documentElement: { setAttribute: (name, value) => { attrs[name] = value; log.push(['set', name, value]) }, removeAttribute: name => { delete attrs[name]; log.push(['remove', name]) } } }
    const effects = []
    vm.runInNewContext(block.join('\n'), { useEffect: (fn, deps) => effects.push({ fn, deps }), STUDIO_PHONE_POLISH_LANDSCAPE_ENABLED: enabled, STUDIO_PHONE_POLISH_ATTRIBUTE: 'data-studio-phone-polish', stage, document })
    eq(effects.length, 1, a('one effect')); deep(effects[0].deps, [stage], a('it runs when the stage changes'))
    const cleanup = effects[0].fn()
    return { attrs: { ...attrs }, log, cleanup: typeof cleanup === 'function' ? () => { cleanup(); return { ...attrs } } : null }
  }
  deep(run(false, true).log, [], a('flag off, on the stage: nothing is set'))
  deep(run(true, false).log, [], a('flag on, off the stage: nothing is set'))
  const set = run(true, true)
  deep(set.attrs, { 'data-studio-phone-polish': 'stage' }, a('flag on, on the stage: the html attribute the stylesheet is keyed to'))
  deep(set.cleanup(), {}, a('and it is taken off again when the stage goes (or the page leaves)'))
  const component = read(LANDSCAPE)
  match(component, /import \{ STUDIO_PHONE_POLISH_ATTRIBUTE, STUDIO_PHONE_POLISH_LANDSCAPE_ENABLED \} from "@\/lib\/studio-phone-polish" \/\/ PHONE-POLISH/, a('the flag is the landscape one (the polish flag with the landscape stage)'))
}

// ---------------------------------------------------------------- 5. pins: flag off, the files are the base's
function provePin(strip = stripPhonePolish, at = '') {
  const a = message => (at ? `${at}: pin: ${message}` : `pin: ${message}`)
  for (const rel of PHONE_POLISH_FILES) {
    const now = read(rel), base = baseOf(rel)
    ok(now !== base, a(`${rel}: this change edits it`))
    eq(strip(rel, now), base, a(`${rel}: without this change's lines it is the base commit's file, byte for byte`))
    eq(strip(rel, strip(rel, now)), base, a(`${rel}: stripping twice changes nothing more (idempotent)`))
    eq(strip(rel, base), base, a(`${rel}: the base file comes back as it is`))
    eq(stripLaterChanges(rel, now), stripLaterChanges(rel, base), a(`${rel}: through the registry (what the older pins read) it is the base's`))
    const marked = now.split('\n').filter(line => PHONE_POLISH_MARKER_RE.test(line))
    ok(marked.length >= 3, a(`${rel}: ${marked.length} marked lines`))
  }
  const edits = PHONE_POLISH_LINE_EDITS[BAR]
  eq(edits.length, 1, a('one rewritten app line'))
  const [now, was] = edits[0]
  ok(read(BAR).includes(now) && !read(BAR).includes(was), a('the sheet has the new line and not the base line'))
  ok(baseOf(BAR).includes(was) && !baseOf(BAR).includes(now), a('the base commit has the old line'))
  ok(PHONE_POLISH_MARKER_RE.test(now) && now.replace(/\s*\{\.\.\.STUDIO_PHONE_MORE_PROPS \/\* PHONE-POLISH \*\/\}/, '') === was, a('the rewritten line is the base line plus one marked spread, nothing else'))
  // .env.example, registry, taught proofs
  const env = read('.env.example'), baseEnv = baseOf('.env.example')
  eq(env.split(PHONE_POLISH_ENV_BLOCK).length - 1, 1, a('.env.example: the block is there exactly once, verbatim'))
  ok(env.startsWith(baseEnv) && env === `${baseEnv}\n${PHONE_POLISH_ENV_BLOCK}`, a('.env.example: appended after the last block, with one blank line before it, and nothing else changed'))
  match(PHONE_POLISH_ENV_BLOCK, /\nNEXT_PUBLIC_STUDIO_PHONE_POLISH="false"\n$/, a('.env.example: default "false"'))
  eq(stripLaterEnvBlocks('.env.example', env), stripLaterEnvBlocks('.env.example', baseEnv), a('.env.example: through the registry the block is out and the file is the base\'s'))
  const registry = read('scripts/studio-later-changes.mjs')
  const own = registry.split('\n').filter(line => line.includes('studio-phone-polish-strip.mjs'))
  eq(own.length, 3, a('the registry has exactly this change\'s three lines'))
  deep(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['PHONE_POLISH_SCOPE_FILES', 'PHONE_POLISH_ENV_BLOCK', 'stripPhonePolish'], a('its files, its block, its strip'))
  ok(own.every(line => line.includes('// LATER-CHANGE:')), a('each carries the registry marker'))
  for (const rel of PHONE_POLISH_PIN_FILES) {
    const taught = read(rel)
    eq(strip(rel, taught), baseOf(rel), a(`${rel}: an older proof taught one line: putting it back gives the base commit's proof byte for byte`))
    for (const [has, was2] of PHONE_POLISH_PIN_EDITS[rel]) {
      eq(taught.split(has).length - 1, 1, a(`${rel}: the taught line is there exactly once`)); eq(was2, '', a(`${rel}: a pure insertion`))
      for (const line of has.split('\n').filter(Boolean)) ok(line.includes(PHONE_POLISH_PIN_MARK), a(`${rel}: the taught line carries the registry-read mark`))
    }
  }
  eq(strip('scripts/test-studio-phone-hints.mjs', 'anything'), 'anything', a('any other file is returned as it is'))
  eq(strip('app/builder/page.tsx', 'x // PHONE-POLISH\n'), 'x // PHONE-POLISH\n', a('a file that is not this change\'s is never stripped'))
  eq(strip(LANDSCAPE, 'a\nb // PHONE-POLISH-X\nc // X-PHONE-POLISH\nd // PHONE-POLISH\n'), 'a\nb // PHONE-POLISH-X\nc // X-PHONE-POLISH\n', a('the marker is a whole token'))
}

function proveAll() { proveLib(); proveSheet(); proveEscape(); proveLandscape(); proveStageAttribute(); provePin() }

// ---------------------------------------------------------------- 6. scope: the COMMITTED diff, gate-safe
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-04T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-04T00:00:00Z' }
const plumb = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(PHONE_POLISH_SUBJECT)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head` (a first-parent walk sees none of them on the gate's merge). */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query: the gate's merge has dev as its FIRST parent (none of this change's commits) and this change's head as its SECOND: the scope runs against HEAD^2. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const OLDER_PREFIXES = /^(Phone landscape:|Phone hints:|Phone shell|Stage open gate:|Chat column wide:|Welcome trim:|Director mark trim:|Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:|Text set keep look:|Structural refine decline:|Template match:|Pass 3 polish)/
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  for (const c of git('rev-list', '--no-merges', `${BASE}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), OLDER_PREFIXES, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
const REGISTRY_NORM = (rel, text) => stripLaterChanges(rel, text)
const scopeCommittedFiles = head => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  assert.deepEqual([...touched].sort(), [...PHONE_POLISH_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  assert.deepEqual([...net].sort(), [...PHONE_POLISH_SCOPE_FILES].sort(), 'and the whole diff from the base has no other file')
  for (const rel of PHONE_POLISH_FILES) {
    const diff = diffLines(git('diff', '-U0', `${BASE}..${head}`, '--', rel))
    for (const line of diff.filter(line => line.startsWith('+'))) assert.match(line, PHONE_POLISH_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`)
    const removed = diff.filter(line => line.startsWith('-')).map(line => line.slice(1).trim())
    assert.deepEqual(removed, (PHONE_POLISH_LINE_EDITS[rel] || []).map(([, was]) => was), `${rel}: the only line removed is the one pinned rewrite`)
    assert.ok(diff.filter(line => line.startsWith('+')).length > 0, `${rel}: the number of added lines`)
    assert.equal(stripPhonePolish(rel, git('show', `${head}:${rel}`)), git('show', `${BASE}:${rel}`), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of PHONE_POLISH_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of PHONE_POLISH_PIN_FILES) {
    const added = diffLines(git('diff', '-U0', `${BASE}..${head}`, '--', rel))
    assert.ok(added.length >= 1 && added.every(line => line.startsWith('+') && line.includes(PHONE_POLISH_PIN_MARK)), `${rel}: every line this change added to the proof carries the mark and none is removed`)
  }
  for (const rel of ['lib/studio-phone-shell.ts', 'lib/studio-phone-landscape.ts', 'lib/studio-phone-hints.ts', 'components/layout/studio-phone-shell.css', 'components/builder/studio-phone-landscape.css', 'components/help/studio-help.tsx', 'components/builder/studio-session-hygiene.tsx', 'components/user-profile-menu.tsx', 'components/layout/studio-navigation-hint.tsx', 'app/builder/page.tsx', 'package.json', 'pnpm-lock.yaml']) assert.ok(!net.has(rel), `${rel} is not touched by this change`)
  void REGISTRY_NORM
}
const scopeEnvAndRegistry = head => {
  const envText = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE}:.env.example`)
  assert.equal(stripLaterEnvBlocks('.env.example', envText), stripLaterEnvBlocks('.env.example', baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(envText.split(PHONE_POLISH_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.ok(envText.includes(`\n\n${PHONE_POLISH_ENV_BLOCK}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes('studio-phone-polish-strip.mjs'))
  assert.equal(own.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['PHONE_POLISH_SCOPE_FILES', 'PHONE_POLISH_ENV_BLOCK', 'stripPhonePolish'])
}
const scopeAll = head => { scopeOwnCommits(head); scopeCommittedFiles(head); scopeEnvAndRegistry(head) }

let failures = 0
async function check(name, fn) { try { await fn(); console.log(`  ok  ${name}`) } catch (error) { failures += 1; console.error(`  FAIL ${name}\n       ${String(error && error.message || error).split('\n').slice(0, 6).join('\n       ')}`) } }

console.log('sections 1-5: lib, sheet, escape, landscape, pin')
await check('1. lib: the flags, the sheet\'s props, the focus decision', () => proveLib())
await check('2. sheet: flag off the base commit\'s HTML byte for byte; flag on one attribute and the focus handler', () => proveSheet())
await check('3. escape: one root cause for the hint over the Help row and for Escape needing two presses; the fix removes both', () => proveEscape())
await check('4. landscape: the dock clear of the page number at 844x390 and 932x430; the cards, hidden bar and authoring row follow; the rules match nothing without the attribute', () => { proveLandscape(); proveStageAttribute() })
await check('5. pin: the app files without this change\'s lines are the base\'s; .env.example; the registry; the taught proofs', () => provePin())

console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate\'s merge)')
const HEAD = scopeHead('HEAD')
await check(`6a. this change's own commits (subject starts "${PHONE_POLISH_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await check('6b. the committed files are exactly this change\'s; every line added to an app file carries the marker; the one rewritten line is pinned; the strip gives the base back byte for byte; the pinned libs, the stage\'s stylesheet and the profile menu are not touched', () => scopeCommittedFiles(HEAD))
await check('6c. .env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of PHONE_POLISH_NEW_FILES) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = ownOf(HEAD).length ? gateMerge(BASE, HEAD) : null
await check('6d. GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it', () => {
  assert.ok(GATE, 'no own commit yet')
  assert.deepEqual(parentsOf(GATE), [BASE, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of PHONE_POLISH_FILES) assert.equal(stripPhonePolish(rel, git('show', `${GATE}:${rel}`)), git('show', `${BASE}:${rel}`), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE), BASE, 'BASE itself is used as it is')
})
await check('6e. mutant caught: the first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  assert.ok(GATE, 'no own commit yet')
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})

// ---------------------------------------------------------------- 7. mutants: each must make sections 1-5 fail
console.log('mutants (each must be caught)')
const edit = (rel, from, to) => { const text = overrides[rel] ?? fs.readFileSync(path.join(root, rel), 'utf8'); assert.ok(text.includes(from), `mutant anchor missing in ${rel}: ${from.slice(0, 80)}`); return text.replace(from, () => to) }
async function mutant(name, edits, { strip } = {}) {
  overrides = {}
  for (const [rel, [from, to]] of Object.entries(edits)) overrides[rel] = edit(rel, from, to)
  try {
    let caught = false
    try { if (strip) { provePin(strip) } else { proveAll() } } catch { caught = true }
    if (!caught) throw new Error('survived')
    console.log(`  ok  mutant caught: ${name}`)
  } catch (error) { failures += 1; console.error(`  FAIL mutant ${name}: ${error.message}`) } finally { overrides = {} }
}
const lib = (from, to) => ({ [LIB]: [from, to] }), bar = (from, to) => ({ [BAR]: [from, to] }), css = (from, to) => ({ [CSS]: [from, to] }), land = (from, to) => ({ [LANDSCAPE]: [from, to] })
await mutant('lib: the flag also accepts "1"', lib("return flag === 'true' && phoneShell === 'true' && studioShell === 'true'", "return (flag === 'true' || flag === '1') && phoneShell === 'true' && studioShell === 'true'"))
await mutant('lib: the flag does not need the phone shell', lib("return flag === 'true' && phoneShell === 'true' && studioShell === 'true'", "return flag === 'true' && studioShell === 'true'"))
await mutant('lib: the landscape fix does not need the landscape stage', lib("&& landscape === 'true'", ''))
await mutant('lib: the sheet keeps Radix\'s default focus (no preventDefault)', lib('  event.preventDefault()\n  const sheet', '  const sheet'))
await mutant('lib: the sheet\'s box is not focused', lib("sheet.focus({ preventScroll: true })", 'void sheet'))
await mutant('lib: the props are there with the flag off', lib('= STUDIO_PHONE_POLISH_ENABLED\n  ?', '= true\n  ?'))
await mutant('lib: the lift is not the stylesheet\'s', lib('export const STUDIO_PHONE_DOCK_LIFT = 34', 'export const STUDIO_PHONE_DOCK_LIFT = 20'))
await mutant('sheet: the spread is gone (Radix\'s own focus, the avatar, the hint)', bar(' {...STUDIO_PHONE_MORE_PROPS /* PHONE-POLISH */}', ''))
await mutant('sheet: the focus decision is not Radix\'s onOpenAutoFocus prop', lib('onOpenAutoFocus: studioPhoneMoreOpenFocus,', 'onFocus: studioPhoneMoreOpenFocus,'))
await mutant('sheet: Escape is overridden by the sheet (the base keeps Radix\'s)', bar(' {...STUDIO_PHONE_MORE_PROPS /* PHONE-POLISH */}', ' {...STUDIO_PHONE_MORE_PROPS /* PHONE-POLISH */} onEscapeKeyDown={event => event.preventDefault()}'))
await mutant('css: the dock is lifted less (still on the page number)', css('bottom: calc(44px + env(safe-area-inset-bottom, 0px)); }\n  html[data-studio-phone-polish="stage"][data-studio-phone-landscape="stage"] :is(', 'bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }\n  html[data-studio-phone-polish="stage"][data-studio-phone-landscape="stage"] :is('))
await mutant('css: the cards stay where they were (under the lifted dock)', css('bottom: calc(92px + env(safe-area-inset-bottom, 0px)); max-height', 'bottom: calc(58px + env(safe-area-inset-bottom, 0px)); max-height'))
await mutant('css: the cards go up but keep their height (their top edge leaves the screen)', css('max-height: calc(100dvh - 106px - env(safe-area-inset-bottom, 0px))', 'max-height: calc(100dvh - 72px - env(safe-area-inset-bottom, 0px))'))
await mutant('css: the hidden top bar and authoring row stay (their menus open beside the old place)', css('{ bottom: 42px; }', '{ bottom: 8px; }'))
await mutant('css: a rule without the flag\'s attribute (matches with the flag off)', css('html[data-studio-phone-polish="stage"][data-studio-phone-landscape="stage"] [data-studio-phone-dock="true"] {', 'html[data-studio-phone-landscape="stage"] [data-studio-phone-dock="true"] {'))
await mutant('css: the hidden-bar rule loses the stage\'s attribute (ties the stage\'s own rule: the order decides)', css('html[data-studio-phone-polish="stage"][data-studio-phone-landscape="stage"] [data-studio-v4-shell="true"] > [data-studio-v4-shell-column] > [data-studio-v4-shell-header],\n  html[data-studio-phone-polish="stage"][data-studio-phone-landscape="stage"] [data-studio-v4-shell="true"] [data-studio-authoring-slot] {', 'html[data-studio-phone-polish="stage"] [data-studio-v4-shell="true"] > [data-studio-v4-shell-column] > [data-studio-v4-shell-header],\n  html[data-studio-phone-polish="stage"] [data-studio-v4-shell="true"] [data-studio-authoring-slot] {'))
await mutant('css: the query is not the stage\'s', css('@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse) {', '@media (orientation: landscape) and (max-height: 600px) and (pointer: coarse) {'))
await mutant('css: the sheet\'s focus rule is not scoped to the flag\'s attribute', css('[data-studio-phone-more="true"][data-studio-phone-polish="true"]:focus { outline: none; }', '[data-studio-phone-more="true"]:focus { outline: none; }'))
await mutant('stage: the attribute is set without the flag', land('if (!STUDIO_PHONE_POLISH_LANDSCAPE_ENABLED || !stage) return // PHONE-POLISH', 'if (!stage) return // PHONE-POLISH'))
await mutant('stage: the attribute is never taken off', land('return () => root.removeAttribute(STUDIO_PHONE_POLISH_ATTRIBUTE) // PHONE-POLISH', 'return () => {} // PHONE-POLISH'))
await mutant('stage: the attribute is set off the stage', land('if (!STUDIO_PHONE_POLISH_LANDSCAPE_ENABLED || !stage) return // PHONE-POLISH', 'if (!STUDIO_PHONE_POLISH_LANDSCAPE_ENABLED) return // PHONE-POLISH'))
await mutant('stage: a line without the marker is added to the landscape component', land('    const root = document.documentElement // PHONE-POLISH', '    const root = document.documentElement'))
await mutant('pin: the strip puts nothing back', {}, { strip: (rel, text) => (PHONE_POLISH_FILES.includes(rel) ? text.split('\n').filter(line => !PHONE_POLISH_MARKER_RE.test(line)).join('\n') : stripPhonePolish(rel, text)) })
await mutant('pin: the strip is not idempotent (puts the line back twice)', {}, { strip: (rel, text) => stripPhonePolish(rel, text) + (rel === BAR ? '\n' : '') })
await mutant('pin: the strip leaves the marked lines', {}, { strip: (rel, text) => text })
await mutant('pin: the env block default is true', { '.env.example': ['NEXT_PUBLIC_STUDIO_PHONE_POLISH="false"', 'NEXT_PUBLIC_STUDIO_PHONE_POLISH="true"'] })
await mutant('pin: the registry loses its strip line', { 'scripts/studio-later-changes.mjs': ["  (await import('./studio-phone-polish-strip.mjs')).stripPhonePolish, // LATER-CHANGE: FRONTEND-2, B59 phone polish (NEXT_PUBLIC_STUDIO_PHONE_POLISH)\n", ''] })
await mutant('escape: the account menu loses its hint (the premise of the chain is gone)', { 'components/user-profile-menu.tsx': ['label="Account menu"', 'label="Account"'] })
await mutant('escape: the landscape cards lose their Escape handler', { [LANDSCAPE]: ['if (event.key === "Escape") { event.stopPropagation(); closeMenu() }', 'if (event.key === "Enter") { event.stopPropagation(); closeMenu() }'] })

console.log(failures === 0 ? `PASS lib, sheet, escape, landscape, pin, scope, mutants: ${checks} checks` : `FAILED: ${failures} failure(s) (${checks} checks)`)
process.exit(failures === 0 ? 0 : 1)
