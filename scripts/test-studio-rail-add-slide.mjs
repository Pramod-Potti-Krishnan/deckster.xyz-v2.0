// PASS2B G21 (FRONTEND-2): a "+ Add slide" button in the footer of the Studio slide rail, as the accepted v4 mockup has it. Flag
// NEXT_PUBLIC_STUDIO_RAIL_ADD_SLIDE (exact "true", Studio shell only), default off. The button OPENS the existing Add Slide panel through the toolbar
// button's own handler and sends no Layout / viewer command of its own; it is greyed exactly when the toolbar's Add Slide is.
//
// Run: node scripts/test-studio-rail-add-slide.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   RAIL_ADD_SLIDE_BASE=<commit> overrides the base commit the flag-off identity is checked against (default bb5a89f, the head this was built on).
//
// Proven on the REAL lib/studio-rail-add-slide.ts, components/studio-rail-add-slide.tsx, components/slide-thumbnail-strip.tsx and, by AST, on the REAL
// components/presentation-viewer.tsx and app/builder/page.tsx:
//   1. the flag is exact "true" and nothing else;
//   2. the state rule over every combination of its inputs: not drawn without the panel; greyed exactly when the toolbar's Add Slide is (plus a build);
//      the words are the toolbar's (the paused-tab sentence, then loading, Template Mode, a change in flight) and never on an enabled button;
//   3. the real button: markup in each box variant, and a click calls the one handler it was given, once, with no arguments;
//   4. the real strip, server-rendered: flag off (unset, near-misses, "true" without the Studio shell, "true" with no handler, horizontal) = the base commit's
//      strip byte for byte over a matrix of cases and envs; flag on = the same markup plus exactly one footer, last in the strip;
//   5. the REAL viewer: the rail's gate and handler are cut out by AST and run over every combination of the viewer's own inputs: the button's `disabled` equals
//      the viewer's own Add Slide `disabled` expression (read from its code) or a build; its click calls `addSlideV2Settings.onPanelOpenChange(true)` and touches
//      nothing else of the settings; the toolbar button calls that same handler; the page's handler and everything it calls name no viewer command;
//   6. wiring: no added or removed line of the viewer or the strip names a Layout command, a postMessage or the iframe; the CSS gained only scoped rules;
//      the flag is documented in .env.example, default off;
//   7. mutation check: every mutant of the lib, the button, the strip, the viewer and the CSS is killed by sections 1-6.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_RAIL_ADD_SLIDE'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const REASONS = 'NEXT_PUBLIC_STUDIO_DISABLED_REASONS'
const BASE_COMMIT = process.env.RAIL_ADD_SLIDE_BASE || 'bb5a89f'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const git = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
function baseSource(rel) {
  try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]); return git(['show', `${BASE_COMMIT}:${rel}`]) } catch { return null }
}
let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

const LIB = 'lib/studio-rail-add-slide.ts'
const BUTTON = 'components/studio-rail-add-slide.tsx'
const STRIP = 'components/slide-thumbnail-strip.tsx'
const VIEWER = 'components/presentation-viewer.tsx'
const PAGE = 'app/builder/page.tsx'
const ENTRY = 'components/studio-add-slide-v2.tsx'
const CSS = 'components/studio-rail-add-slide.css'
const THUMB_CSS = 'components/studio-thumbnails.css'
const SOURCES = Object.fromEntries([LIB, BUTTON, STRIP, VIEWER, PAGE, ENTRY, CSS].map(rel => [rel, read(rel)]))

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
function compile(rel, source) {
  const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
  const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `${rel} does not transpile`)
  return out.outputText
}
function createWorld({ env = {}, overrides = {}, stubs = {} } = {}) {
  const cache = new Map()
  const exists = rel => rel in overrides || (fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile())
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext
    throw new Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const source = rel in overrides ? overrides[rel] : read(rel)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      return nodeRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', compile(rel, source))(module, module.exports, require, { env })
    return module.exports
  }
  return { load }
}

// ---------------------------------------------------------------- 1. the flag
function proveFlag(world, label = 'lib') {
  const make = env => world({ env }).load(LIB)
  assert.equal(make({}).STUDIO_RAIL_ADD_SLIDE, false, `${label}: default off`)
  for (const value of ['', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'false', 'on'])
    assert.equal(make({ [FLAG]: value }).STUDIO_RAIL_ADD_SLIDE, false, `${label}: flag "${value}" is off`)
  assert.equal(make({ [FLAG]: 'true' }).STUDIO_RAIL_ADD_SLIDE, true, `${label}: exact "true" is on`)
  assert.equal(make({}).RAIL_ADD_SLIDE_LABEL, 'Add slide', `${label}: the mockup's words`)
}
proveFlag(opts => createWorld(opts)); checks++

// ---------------------------------------------------------------- 2. the state rule
const product = axes => Object.entries(axes).reduce((cells, [key, values]) => cells.flatMap(cell => values.map(value => ({ ...cell, [key]: value }))), [{}])
const BOOLS = [false, true]
const PAUSED = 'This session is open in another tab. Changes there are live; this tab is paused.'
const STATE_MATRIX = product({ panelAvailable: BOOLS, viewerIsReady: BOOLS, templateModeOn: BOOLS, slideMutationPending: BOOLS,
  tabPausedHint: [undefined, '', PAUSED], building: BOOLS, disabledReasons: BOOLS })
/** The toolbar's Add Slide `disabled`, as the viewer writes it (checked against the viewer's own code in section 5), and the words the toolbar says. */
const toolbarDisabled = s => !s.viewerIsReady || s.templateModeOn || s.slideMutationPending || Boolean(s.tabPausedHint)
function toolbarWords(s) {
  if (s.tabPausedHint) return s.tabPausedHint
  if (!s.viewerIsReady) return 'Loading the slide…'
  if (s.templateModeOn) return 'Exit Template Mode to add slides'
  if (s.slideMutationPending) return 'Finishing your last change…'
  return null
}
function proveState(lib, label = 'lib') {
  for (const s of STATE_MATRIX) {
    const at = `${label} ${JSON.stringify(s)}`
    const out = lib.railAddSlideState(s)
    if (!s.panelAvailable) { assert.equal(out, null, `${at}: not drawn without the panel`); continue }
    assert.ok(out, `${at}: drawn`)
    assert.equal(out.disabled, toolbarDisabled(s) || s.building, `${at}: greyed exactly when the toolbar's is (or a build runs)`)
    assert.equal(out.tabPaused, Boolean(s.tabPausedHint), `${at}: tabPaused`)
    assert.equal(out.reason, s.disabledReasons ? toolbarWords(s) : (s.tabPausedHint ? s.tabPausedHint : null), `${at}: the toolbar's words`)
    if (out.reason !== null) assert.equal(out.disabled, true, `${at}: a reason only on a greyed button`)
    assert.equal(lib.toolbarAddSlideDisabled(s), toolbarDisabled(s), `${at}: toolbarAddSlideDisabled`)
  }
}
proveState(createWorld().load(LIB)); checks++
check(assert.equal, STATE_MATRIX.length, 2 * 2 * 2 * 2 * 3 * 2 * 2, 'the whole input space')

// ---------------------------------------------------------------- 3. the real button
const noop = () => {}
const findElements = (node, predicate, found = []) => {
  if (node === null || node === undefined || typeof node !== 'object') return found
  if (Array.isArray(node)) { node.forEach(child => findElements(child, predicate, found)); return found }
  if (node.props) { if (predicate(node)) found.push(node); findElements(node.props.children, predicate, found) }
  return found
}
function buttonWorld(env, overrides = {}) { return createWorld({ env, overrides }).load(BUTTON) }
const STATES = {
  enabled: { disabled: false, reason: null, tabPaused: false },
  loading: { disabled: true, reason: 'Loading the slide…', tabPaused: false },
  building: { disabled: true, reason: null, tabPaused: false },
  paused: { disabled: true, reason: PAUSED, tabPaused: true },
}
function proveButton(world, label = 'real') {
  for (const [name, state] of Object.entries(STATES)) {
    // a click calls the handler it was given, once, with no arguments, and nothing else is reachable from the button
    const calls = []
    const tree = world({}).RailAddSlideButton({ ...state, onOpen: (...args) => calls.push(args) })
    const buttons = findElements(tree, node => node.type === 'button')
    assert.equal(buttons.length, 1, `${label} ${name}: one button`)
    assert.equal(buttons[0].props.disabled, state.disabled, `${label} ${name}: disabled`)
    assert.equal(buttons[0].props.type, 'button', `${label} ${name}: not a submit`)
    buttons[0].props.onClick({ preventDefault() {} })
    assert.deepEqual(calls, [[]], `${label} ${name}: one click, one call, no arguments`)

    for (const reasons of BOOLS) {
      const env = reasons ? { [REASONS]: 'true' } : {}
      const html = renderToStaticMarkup(React.createElement(world(env).RailAddSlideButton, { ...state, onOpen: noop }))
      assert.match(html, /^<div data-studio-rail-footer="true">/, `${label} ${name}/${reasons}: the footer box`)
      assert.equal((html.match(/data-studio-rail-add-slide="true"/g) ?? []).length, 1, `${label} ${name}/${reasons}: one button`)
      assert.match(html, /<span>Add slide<\/span><\/button>/, `${label} ${name}/${reasons}: the label`)
      assert.match(html, /<svg[^>]*aria-hidden="true"/, `${label} ${name}/${reasons}: the plus icon is hidden from assistive tech`)
      assert.equal(/<button[^>]* disabled=""/.test(html), state.disabled, `${label} ${name}/${reasons}: the disabled attribute`)
      const wrapped = /data-studio-tab-paused="true"/.test(html), titled = html.includes(`title="${state.reason}"`)
      if (reasons) {
        // the toolbar's own wrapper: inert while enabled, a keyboard stop with the reason in words while greyed with one
        assert.equal(/role="button"/.test(html), Boolean(state.reason), `${label} ${name}/${reasons}: a tab stop only with a reason`)
        assert.equal(html.includes(`<span id=`) && html.includes(`>${state.reason}</span>`), Boolean(state.reason), `${label} ${name}/${reasons}: the reason in words`)
        assert.equal(wrapped, Boolean(state.reason) && state.tabPaused, `${label} ${name}/${reasons}: the paused marker`)
        assert.equal(titled, false, `${label} ${name}/${reasons}: no title mechanism`)
      } else {
        // the paused-tab title span of #396, and nothing else
        assert.equal(wrapped, state.tabPaused, `${label} ${name}/${reasons}: the paused box`)
        assert.equal(titled, state.tabPaused, `${label} ${name}/${reasons}: the paused title`)
        assert.doesNotMatch(html, /role="button"|aria-describedby/, `${label} ${name}/${reasons}: no reason box`)
        if (!state.tabPaused) assert.equal(html.replace(/<svg.*?<\/svg>/, '<svg/>'), `<div data-studio-rail-footer="true"><button type="button" data-studio-rail-add-slide="true"${state.disabled ? ' disabled=""' : ''}><svg/><span>Add slide</span></button></div>`, `${label} ${name}/${reasons}: the plain button`)
      }
    }
  }
}
proveButton(buttonWorld); checks++

// ---------------------------------------------------------------- 4. the real strip, server-rendered
const STRIP_ENV = { [SHELL]: 'true' }
function stripWorld({ env = {}, overrides = {} } = {}) {
  const policy = createWorld().load('lib/layout-viewer-url-policy.ts').createLayoutViewerUrlPolicy('https://layout.uat.test', '')
  const stubs = {
    '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: policy },
    './rail-live-preview': { RailLivePreview: props => React.createElement('i', { 'data-stub-live': 'true', 'data-index': String(props.slideIndex) }) },
  }
  return createWorld({ env, overrides, stubs }).load(STRIP).SlideThumbnailStrip
}
const ROWS = [
  { slideNumber: 1, slideId: 's1', title: 'A real title', thumbnailStatus: 'none' },
  { slideNumber: 2, slideId: 's2', title: 'Slide 2', thumbnailStatus: 'none' },
  { slideNumber: 3, slideId: 's3', title: 'Titled <b>', thumbnailUrl: 'https://proj.test/g.png', thumbnailStatus: 'fresh' },
]
const asyncNoop = async () => {}
const ADD = { disabled: false, reason: null, tabPaused: false, onOpen: noop }
const CASES = [
  ['plain', {}],
  ['current 2, selection', { currentSlide: 2, selectedSlides: [1, 2] }],
  ['crud + refine', { onDuplicateSlide: asyncNoop, onDeleteSlide: noop, onDeleteSlides: noop, onChangeLayout: asyncNoop, onReorderSlides: asyncNoop,
    enableDragDrop: true, onRefineSlide: noop, keyBySlideId: true }],
  ['horizontal', { orientation: 'horizontal' }],
]
const render = (Strip, extra, rows = ROWS) => renderToStaticMarkup(React.createElement(Strip, {
  slides: rows, currentSlide: 1, onSlideClick: noop, orientation: 'vertical', totalSlides: rows.length, ...extra }))
const ENVS = [
  ['studio', STRIP_ENV],
  ['studio + rail v2 + identity', { ...STRIP_ENV, NEXT_PUBLIC_STUDIO_SLIDE_RAIL_V2: 'true', NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED: 'true' }],
  ['classic', {}],
]
const baseStrip = baseSource(STRIP)
if (baseStrip) {
  let compared = 0
  for (const [envName, env] of ENVS) {
    const Base = stripWorld({ env, overrides: { [STRIP]: baseStrip } })
    for (const [flagName, flagEnv] of [['unset', env], ['"false"', { ...env, [FLAG]: 'false' }], ['"TRUE"', { ...env, [FLAG]: 'TRUE' }], ['"1"', { ...env, [FLAG]: '1' }],
      ...(env[SHELL] === 'true' ? [] : [['"true" without the Studio shell', { ...env, [FLAG]: 'true' }]])]) {
      const Work = stripWorld({ env: flagEnv })
      for (const [caseName, extra] of CASES) for (const given of [{}, { addSlide: ADD }]) {
        check(assert.equal, render(Work, { ...extra, ...given }), render(Base, { ...extra, ...given }), `${envName}, flag ${flagName}, ${caseName}, ${given.addSlide ? 'handler given' : 'no handler'}: identical to ${BASE_COMMIT}`)
        compared++
      }
    }
    // flag on, shell on, but nothing to open (the viewer gives no handler) or a horizontal strip: the base strip too
    if (env[SHELL] === 'true') {
      const On = stripWorld({ env: { ...env, [FLAG]: 'true' } })
      for (const [caseName, extra] of CASES) {
        check(assert.equal, render(On, extra), render(Base, extra), `${envName}, flag on, ${caseName}, no handler: identical to ${BASE_COMMIT}`); compared++
      }
      check(assert.equal, render(On, { orientation: 'horizontal', addSlide: ADD }), render(Base, { orientation: 'horizontal' }), `${envName}, flag on, horizontal: no footer`); compared++
    }
  }
  console.log(`  flag-off strip == ${BASE_COMMIT} strip in ${compared} renders`)
} else console.log(`  SKIP base-commit strip identity: ${BASE_COMMIT} is not in this clone (the flag-off checks below still run)`)

const FOOTER = /<div data-studio-rail-footer="true">.*?<\/div>/s
function proveStrip(world, label = 'real') {
  for (const [envName, env] of ENVS.filter(([, e]) => e[SHELL] === 'true')) {
    for (const reasons of BOOLS) {
      const onEnv = { ...env, [FLAG]: 'true', ...(reasons ? { [REASONS]: 'true' } : {}) }
      const Off = world({ env: { ...env, ...(reasons ? { [REASONS]: 'true' } : {}) } }), On = world({ env: onEnv })
      for (const [caseName, extra] of CASES.filter(([name]) => name !== 'horizontal')) for (const [stateName, state] of Object.entries(STATES)) {
        const at = `${label} ${envName}, reasons ${reasons}, ${caseName}, ${stateName}`
        const withState = { ...extra, addSlide: { ...state, onOpen: noop } }
        const off = render(Off, withState), on = render(On, withState)
        assert.equal((on.match(/data-studio-rail-footer="true"/g) ?? []).length, 1, `${at}: one footer`)
        assert.equal((on.match(/data-studio-rail-add-slide="true"/g) ?? []).length, 1, `${at}: one button`)
        assert.equal(on.replace(FOOTER, ''), off, `${at}: nothing but the footer is added`)
        assert.ok(on.endsWith(`${on.match(FOOTER)[0]}</div>`), `${at}: the footer is the strip's last child, after the list`)
        assert.ok(on.indexOf('data-studio-thumbnail-list') < on.indexOf('data-studio-rail-footer'), `${at}: after the list`)
        assert.doesNotMatch(off, /data-studio-rail-(footer|add-slide)/, `${at}: flag off draws none of it`)
        assert.match(on, /<span>Add slide<\/span>/, `${at}: the mockup's words`)
      }
      // the horizontal strip has no footer; no handler, no footer
      assert.doesNotMatch(render(On, { orientation: 'horizontal', addSlide: ADD }), /data-studio-rail-footer/, `${label} ${envName}: horizontal`)
      assert.doesNotMatch(render(On, {}), /data-studio-rail-footer/, `${label} ${envName}: no handler, no footer`)
    }
  }
  // the classic (non-Studio) rail never takes it
  assert.equal(render(world({ env: { [FLAG]: 'true' } }), { addSlide: ADD }), render(world({ env: {} }), { addSlide: ADD }), `${label}: classic rail unchanged with the flag on`)
}
proveStrip(opts => stripWorld(opts)); checks++

// ---------------------------------------------------------------- 5. the real viewer and page, by AST
function parse(file, source) { return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }
function find(node, predicate) {
  if (predicate(node)) return node
  let match
  ts.forEachChild(node, child => { if (!match) match = find(child, predicate) })
  return match
}
function findAllNodes(node, predicate, found = []) {
  if (predicate(node)) found.push(node)
  ts.forEachChild(node, child => { findAllNodes(child, predicate, found) })
  return found
}
const evaluate = (text, names, values) => {
  const js = ts.transpileModule(`(function (${names.join(', ')}) { ${text} })`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  return vm.runInNewContext(js)(...values)
}
const VIEWER_NAMES = ['railAddSlideState', 'STUDIO_RAIL_ADD_SLIDE', 'studioShell', 'ADD_SLIDE_V2_ENABLED', 'addSlideV2Settings', 'studioAuthoringPortalTarget', 'viewerIsReady',
  'templateModeOn', 'isSlideMutationPending', 'studioTabPausedHint', 'isGenerating', 'STUDIO_DISABLED_REASONS_ENABLED']
const VIEWER_MATRIX = product({ STUDIO_RAIL_ADD_SLIDE: BOOLS, studioShell: BOOLS, ADD_SLIDE_V2_ENABLED: BOOLS, hasSettings: BOOLS, hasPortal: BOOLS, viewerIsReady: BOOLS,
  templateModeOn: BOOLS, isSlideMutationPending: BOOLS, studioTabPausedHint: [undefined, PAUSED], isGenerating: [undefined, false, true], STUDIO_DISABLED_REASONS_ENABLED: BOOLS })
function proveViewer(viewerText, libWorld, label = 'real') {
  const source = parse(VIEWER, viewerText)
  const declared = name => { const node = find(source, n => ts.isVariableDeclaration(n) && n.name.getText(source) === name); assert.ok(node?.initializer, `${label}: the viewer declares ${name}`); return node.initializer.getText(source) }
  // the toolbar's Add Slide `disabled`, exactly as the viewer writes it
  const picker = find(source, n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(source) === 'SlideLayoutPicker')
  assert.ok(picker, `${label}: the toolbar's SlideLayoutPicker`)
  const disabledAttribute = picker.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'disabled')
  assert.ok(disabledAttribute?.initializer, `${label}: the toolbar's Add Slide has a disabled expression`)
  const toolbarExpression = disabledAttribute.initializer.expression.getText(source)
  const tabPausedExpression = declared('tabPaused')
  const toolbarIsDisabled = s => evaluate(`const tabPaused = ${tabPausedExpression}; return Boolean(${toolbarExpression})`, ['viewerIsReady', 'templateModeOn', 'isSlideMutationPending', 'studioTabPausedHint'],
    [s.viewerIsReady, s.templateModeOn, s.isSlideMutationPending, s.studioTabPausedHint])
  // the rail's gate and handler, cut out of the viewer and run
  const gate = declared('railAddSlideGate'), rail = declared('railAddSlide')
  assert.doesNotMatch(`${gate}\n${rail}`, /postMessage|sendCommand|sendLayout|contentWindow|iframe|createViewerRequestId|fetch\(|WebSocket|sendMessage/, `${label}: the rail's gate and click name no viewer command`)
  const body = `const railAddSlideGate = ${gate}; const railAddSlide = ${rail}; return railAddSlide`
  const lib = libWorld()
  let drawn = 0, absent = 0
  for (const s of VIEWER_MATRIX) {
    const at = `${label} ${JSON.stringify(s)}`
    const touched = []
    const settings = new Proxy({ onPanelOpenChange: (...args) => touched.push(['call', ...args]) }, { get: (target, key) => { touched.push(['get', String(key)]); return target[key] } })
    const values = [lib.railAddSlideState, s.STUDIO_RAIL_ADD_SLIDE, s.studioShell, s.ADD_SLIDE_V2_ENABLED, s.hasSettings ? settings : undefined, s.hasPortal ? { tag: 'authoring-slot' } : null,
      s.viewerIsReady, s.templateModeOn, s.isSlideMutationPending, s.studioTabPausedHint, s.isGenerating, s.STUDIO_DISABLED_REASONS_ENABLED]
    const out = evaluate(body, VIEWER_NAMES, values)
    const wanted = s.STUDIO_RAIL_ADD_SLIDE && s.studioShell && s.ADD_SLIDE_V2_ENABLED && s.hasSettings && s.hasPortal
    if (!wanted) { assert.equal(out, undefined, `${at}: no rail button`); absent++; continue }
    assert.ok(out, `${at}: the rail button`); drawn++
    assert.equal(out.disabled, toolbarIsDisabled(s) || Boolean(s.isGenerating), `${at}: greyed exactly when the toolbar's Add Slide is (or a build runs)`)
    assert.equal(out.tabPaused, Boolean(s.studioTabPausedHint), `${at}: tabPaused`)
    assert.equal(out.reason, s.STUDIO_DISABLED_REASONS_ENABLED ? toolbarWords({ ...s, tabPausedHint: s.studioTabPausedHint, slideMutationPending: s.isSlideMutationPending }) : (s.studioTabPausedHint ?? null), `${at}: the toolbar's words`)
    // the click: the toolbar's handler, once, with `true`, and nothing else of the settings is read or called
    assert.deepEqual(touched, [], `${at}: building the state touches no setting`)
    out.onOpen()
    assert.deepEqual(touched, [['get', 'onPanelOpenChange'], ['call', true]], `${at}: the click calls onPanelOpenChange(true), once, and nothing else`)
    assert.deepEqual(Object.keys(out).sort(), ['disabled', 'onOpen', 'reason', 'tabPaused'], `${at}: the strip gets exactly these`)
  }
  assert.ok(drawn === 96 && absent === VIEWER_MATRIX.length - 96, `${label}: both outcomes are exercised (${drawn} drawn, ${absent} not)`)
  // handed to the strip only when it exists, so flag off the strip's props are the base's
  assert.match(viewerText, /\{\.\.\.\(railAddSlide \? \{ addSlide: railAddSlide \} : \{\}\)\}/, `${label}: the strip prop is spread only when the rail button exists`)
  assert.equal((viewerText.match(/addSlide=\{/g) ?? []).length, 0, `${label}: never passed unconditionally`)
  // the build state is the viewer's own fade-and-inert wrapper of the authoring strip
  assert.match(viewerText, /<div data-studio-v4-authoring="true" className=\{cn\(isGenerating && "pointer-events-none opacity-50"\)\}>/, `${label}: isGenerating is what fades and disables the toolbar`)
  assert.match(gate, /building: Boolean\(isGenerating\)/, `${label}: the rail is greyed with it`)
}
const libWorld = () => createWorld({ env: {} }).load(LIB)
proveViewer(SOURCES[VIEWER], libWorld); checks++

function provePanelHandler(entryText, pageText, label = 'real') {
  // the toolbar's button calls the settings' onPanelOpenChange; the page wires that to handleAddSlideV2PanelOpenChange; the rail calls the same property
  assert.match(entryText, /onClick=\{\(\) => settings\.onPanelOpenChange\(!settings\.panelOpen\)\}/, `${label}: the toolbar's Add Slide calls settings.onPanelOpenChange`)
  assert.match(pageText, /onPanelOpenChange: handleAddSlideV2PanelOpenChange,/, `${label}: the page's handler is that property`)
  const page = parse(PAGE, pageText)
  const handler = find(page, n => ts.isVariableDeclaration(n) && n.name.getText(page) === 'handleAddSlideV2PanelOpenChange')
  assert.ok(handler?.initializer, `${label}: the page's handler`)
  const calls = findAllNodes(handler.initializer, ts.isCallExpression).map(call => call.expression.getText(page))
  const allowed = new Set(['useCallback', 'setAddSlideV2Open', 'generationPanel.closePanel', 'setShowTextBoxPanel', 'setShowElementPanel', 'closeStudioFormat', 'bringToFront'])
  for (const name of calls) assert.ok(allowed.has(name), `${label}: the handler calls ${name}, which is not on the list of panel-state calls`)
  assert.ok(calls.includes('setAddSlideV2Open'), `${label}: and it opens the panel`)
  // none of the things it calls (in this file) sends a viewer command
  const close = find(page, n => ts.isVariableDeclaration(n) && n.name.getText(page) === 'closeStudioFormat')
  assert.ok(close?.initializer, `${label}: closeStudioFormat`)
  for (const text of [handler.initializer.getText(page), close.initializer.getText(page)]) assert.doesNotMatch(text, /postMessage|sendCommand|sendLayout|contentWindow|iframe|fetch\(|sendMessage|send\(/, `${label}: panel-state code sends no command`)
}
provePanelHandler(SOURCES[ENTRY], SOURCES[PAGE]); checks++

// ---------------------------------------------------------------- 6. wiring
function wiringChecks() {
  const COMMAND = /postMessage|sendCommand|sendLayout|contentWindow|iframeRef|createViewerRequestId|layout-service-client|fetch\(|action:|WebSocket|sendMessage/
  for (const rel of [LIB, BUTTON]) assert.doesNotMatch(SOURCES[rel].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''), COMMAND, `${rel} names no Layout command, no network, no socket`)
  // the lib stays small: its only import is the disabled-reasons words
  assert.deepEqual([...SOURCES[LIB].matchAll(/^import .* from '(.*)'$/gm)].map(m => m[1]), ['./studio-disabled-reasons'], 'the lib\'s only import')
  // the flag is read in one place each, exact "true"
  assert.equal((SOURCES[LIB].match(/process\.env\.NEXT_PUBLIC_STUDIO_RAIL_ADD_SLIDE/g) ?? []).length, 1, 'the flag is read once, in the lib')
  for (const rel of [VIEWER, STRIP, BUTTON, PAGE]) assert.doesNotMatch(SOURCES[rel], /process\.env\.NEXT_PUBLIC_STUDIO_RAIL_ADD_SLIDE/, `${rel} reads the flag through the lib`)
  const baseViewer = baseSource(VIEWER), baseStripText = baseSource(STRIP)
  if (baseViewer && baseStripText) {
    const changed = (rel, base) => git(['diff', '--no-color', '-U0', BASE_COMMIT, '--', rel]).split('\n').filter(line => /^[+-](?![+-])/.test(line))
    for (const [rel, base] of [[VIEWER, baseViewer], [STRIP, baseStripText]]) {
      for (const line of changed(rel)) assert.doesNotMatch(line, COMMAND, `${rel} diff touches a Layout command: ${line}`)
    }
    // the viewer diff is one import, the gate and the strip prop; the strip diff is the imports, the prop and the footer line
    assert.deepEqual(changed(VIEWER).filter(line => line.startsWith('-')), [], 'the viewer loses no line')
    assert.deepEqual(changed(STRIP).filter(line => line.startsWith('-')), [], 'the strip loses no line')
    assert.equal(changed(VIEWER).filter(line => line.startsWith('+')).length, 1 + 13 + 1, 'the viewer gains an import, the gate and the prop')
    assert.equal(changed(STRIP).filter(line => line.startsWith('+')).length, 2 + 3 + 1 + 1, 'the strip gains two imports, the prop, its destructuring and the footer')
    assert.equal(git(['diff', '--no-color', BASE_COMMIT, '--', PAGE, ENTRY]), '', 'the page and the Add Slide entry are untouched')
    // the toolbar's own Add Slide block is untouched
    const block = text => text.slice(text.indexOf('{/* Add Slide */}'), text.indexOf("'add-slide', 'Add Slide')}"))
    assert.equal(block(SOURCES[VIEWER]), block(baseViewer), 'the toolbar\'s Add Slide block is the base\'s')
    // the rail's own CSS is untouched; the footer's rules live in their own file, scoped to the footer's own attributes (inert without the flag)
    assert.equal(git(['diff', '--no-color', BASE_COMMIT, '--', THUMB_CSS]), '', 'studio-thumbnails.css is the base\'s')
    assert.match(SOURCES[BUTTON], /^import '\.\/studio-rail-add-slide\.css'$/m, 'the button imports its CSS')
    const rules = SOURCES[CSS].split('\n').filter(line => /\{/.test(line) && !line.trim().startsWith('/*'))
    assert.ok(rules.length >= 6, 'the footer\'s rules exist')
    for (const line of rules) assert.match(line, /^\[data-studio-thumbnail-strip="true"\] \[data-studio-rail-(footer|add-slide)="true"\]/, `a CSS rule outside the footer's scope: ${line}`)
    assert.ok(rules.some(line => /data-studio-rail-add-slide="true"\]:disabled/.test(line)), 'the disabled look exists')
  } else console.log(`  SKIP base-commit diff checks: ${BASE_COMMIT} is not in this clone`)
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_RAIL_ADD_SLIDE="false"$/m, 'documented in .env.example, default off')
}
check(wiringChecks)

// ---------------------------------------------------------------- 7. mutation check
const MUTANTS = [
  // lib
  [LIB, 'flag read loosely', "=== 'true'", "!== 'false'"],
  [LIB, 'drawn without the panel', 'if (!input.panelAvailable) return null', 'if (false) return null'],
  [LIB, 'greyed never by the viewer not being ready', '!input.viewerIsReady || input.templateModeOn', 'input.templateModeOn'],
  [LIB, 'greyed never by Template Mode', '!input.viewerIsReady || input.templateModeOn || input.slideMutationPending', '!input.viewerIsReady || input.slideMutationPending'],
  [LIB, 'greyed never by a change in flight', 'input.templateModeOn || input.slideMutationPending || Boolean(input.tabPausedHint)', 'input.templateModeOn || Boolean(input.tabPausedHint)'],
  [LIB, 'greyed never by a paused tab', 'input.slideMutationPending || Boolean(input.tabPausedHint)', 'input.slideMutationPending'],
  [LIB, 'a build does not grey it', 'toolbarAddSlideDisabled(input) || input.building', 'toolbarAddSlideDisabled(input)'],
  [LIB, 'a build is the only reason', 'toolbarAddSlideDisabled(input) || input.building', 'input.building'],
  [LIB, 'reasons ignore the flag', 'const reason = input.disabledReasons\n', 'const reason = true\n'],
  [LIB, 'the wrong control\'s words', "studioToolbarDisabledReason('add-slide'", "studioToolbarDisabledReason('add-element'"],
  [LIB, 'no paused sentence without the reasons flag', 'tabPaused ? (input.tabPausedHint as string) : null', 'null'],
  [LIB, 'tabPaused wrong', 'const tabPaused = Boolean(input.tabPausedHint)', 'const tabPaused = false'],
  [LIB, 'the label is changed', "RAIL_ADD_SLIDE_LABEL = 'Add slide'", "RAIL_ADD_SLIDE_LABEL = 'Add Slide'"],
  // button
  [BUTTON, 'the click passes the event on', 'onClick={() => onOpen()}', 'onClick={onOpen}'],
  [BUTTON, 'the click does nothing', 'onClick={() => onOpen()}', 'onClick={() => undefined}'],
  [BUTTON, 'never disabled', 'disabled={disabled}', 'disabled={false}'],
  [BUTTON, 'a submit button', 'type="button"', 'type="submit"'],
  [BUTTON, 'no reasons box', 'STUDIO_DISABLED_REASONS_ENABLED\n        ?', 'false\n        ?'],
  [BUTTON, 'no paused title', 'tabPaused && reason\n        ?', 'false\n        ?'],
  [BUTTON, 'the icon is announced', '<Plus aria-hidden="true" />', '<Plus />'],
  [BUTTON, 'the CSS import is dropped', "import './studio-rail-add-slide.css'\n", ''],
  [BUTTON, 'no footer marker', 'data-studio-rail-footer="true"', 'data-studio-rail-footer="false"'],
  // strip
  [STRIP, 'strip ignores the flag', 'STUDIO_RAIL_ADD_SLIDE && STUDIO_THUMBNAILS && isVertical && addSlide', 'STUDIO_THUMBNAILS && isVertical && addSlide'],
  [STRIP, 'strip ignores the Studio shell', 'STUDIO_RAIL_ADD_SLIDE && STUDIO_THUMBNAILS && isVertical && addSlide', 'STUDIO_RAIL_ADD_SLIDE && isVertical && addSlide'],
  [STRIP, 'strip draws it horizontally too', 'STUDIO_RAIL_ADD_SLIDE && STUDIO_THUMBNAILS && isVertical && addSlide', 'STUDIO_RAIL_ADD_SLIDE && STUDIO_THUMBNAILS && addSlide'],
  [STRIP, 'strip draws it without a handler', 'STUDIO_RAIL_ADD_SLIDE && STUDIO_THUMBNAILS && isVertical && addSlide ?', 'STUDIO_RAIL_ADD_SLIDE && STUDIO_THUMBNAILS && isVertical ?'],
  [STRIP, 'the footer is inside the scrolling list', '      </div>\n      {STUDIO_RAIL_ADD_SLIDE && STUDIO_THUMBNAILS && isVertical && addSlide ? <RailAddSlideButton {...addSlide} /> : null}\n    </div>', '      {STUDIO_RAIL_ADD_SLIDE && STUDIO_THUMBNAILS && isVertical && addSlide ? <RailAddSlideButton {...addSlide} /> : null}\n      </div>\n    </div>'],
  // viewer
  [VIEWER, 'viewer ignores the flag', 'panelAvailable: STUDIO_RAIL_ADD_SLIDE && studioShell', 'panelAvailable: studioShell'],
  [VIEWER, 'viewer ignores the Studio shell', 'STUDIO_RAIL_ADD_SLIDE && studioShell && ADD_SLIDE_V2_ENABLED', 'STUDIO_RAIL_ADD_SLIDE && ADD_SLIDE_V2_ENABLED'],
  [VIEWER, 'viewer ignores Add Slide v2', 'studioShell && ADD_SLIDE_V2_ENABLED && Boolean(studioAuthoringPortalTarget)', 'studioShell && Boolean(studioAuthoringPortalTarget)'],
  [VIEWER, 'viewer ignores the settings', 'const railAddSlide = railAddSlideGate && addSlideV2Settings ?', 'const railAddSlide = railAddSlideGate ?'],
  [VIEWER, 'viewer ignores the toolbar slot', 'ADD_SLIDE_V2_ENABLED && Boolean(studioAuthoringPortalTarget)', 'ADD_SLIDE_V2_ENABLED'],
  [VIEWER, 'viewer drops viewerIsReady', '    viewerIsReady,\n    templateModeOn,\n    slideMutationPending', '    viewerIsReady: true,\n    templateModeOn,\n    slideMutationPending'],
  [VIEWER, 'viewer drops Template Mode', '    templateModeOn,\n    slideMutationPending', '    templateModeOn: false,\n    slideMutationPending'],
  [VIEWER, 'viewer drops the change in flight', 'slideMutationPending: isSlideMutationPending,', 'slideMutationPending: false,'],
  [VIEWER, 'viewer drops the paused tab', 'tabPausedHint: studioTabPausedHint,\n    building', 'tabPausedHint: undefined,\n    building'],
  [VIEWER, 'viewer drops the build', 'building: Boolean(isGenerating),', 'building: false,'],
  [VIEWER, 'viewer ignores the reasons flag', 'disabledReasons: STUDIO_DISABLED_REASONS_ENABLED,\n  })\n  const railAddSlide', 'disabledReasons: true,\n  })\n  const railAddSlide'],
  [VIEWER, 'the click closes the panel', 'addSlideV2Settings.onPanelOpenChange(true) }', 'addSlideV2Settings.onPanelOpenChange(false) }'],
  [VIEWER, 'the click toggles like the toolbar', 'addSlideV2Settings.onPanelOpenChange(true) }', 'addSlideV2Settings.onPanelOpenChange(!addSlideV2Settings.panelOpen) }'],
  [VIEWER, 'the click also reads the settings', 'onOpen: () => addSlideV2Settings.onPanelOpenChange(true) }', 'onOpen: () => { void addSlideV2Settings.submit; addSlideV2Settings.onPanelOpenChange(true) } }'],
  [VIEWER, 'the click sends a command', 'onOpen: () => addSlideV2Settings.onPanelOpenChange(true) }', 'onOpen: () => { iframeRef.current?.contentWindow?.postMessage({}, "*"); addSlideV2Settings.onPanelOpenChange(true) } }'],
  [VIEWER, 'the prop is always passed', '{...(railAddSlide ? { addSlide: railAddSlide } : {})}', 'addSlide={railAddSlide}'],
  [VIEWER, 'the toolbar Add Slide expression drifts', "disabled={!viewerIsReady || templateModeOn || isSlideMutationPending || tabPaused}\n                className=\"min-w-[80px] justify-center\"", "disabled={!viewerIsReady || templateModeOn || tabPaused}\n                className=\"min-w-[80px] justify-center\""],
  // page / entry
  [ENTRY, 'the toolbar calls another handler', 'settings.onPanelOpenChange(!settings.panelOpen)', 'settings.onPanelToggle(!settings.panelOpen)'],
  [PAGE, 'the page\'s handler sends a command', '    closeStudioFormat()\n    bringToFront(\'element\')\n    setAddSlideV2Open(true)', '    closeStudioFormat()\n    iframeRef.current?.contentWindow?.postMessage({}, "*")\n    bringToFront(\'element\')\n    setAddSlideV2Open(true)'],
  // css
  [CSS, 'the footer rule loses its scope', '[data-studio-thumbnail-strip="true"] [data-studio-rail-footer="true"] { display: flex;', '[data-studio-rail-footer="true"] { display: flex;'],
  [CSS, 'a rule leaks outside the footer', '[data-studio-thumbnail-strip="true"] [data-studio-rail-add-slide="true"]:disabled {', '[data-studio-thumbnail-strip="true"] button:disabled {'],
]
let killed = 0
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.equal(source.split(from).length - 1, 1, `mutant "${name}": the text it replaces exists once in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    const overrides = { [file]: mutated }
    const world = (extra = {}) => createWorld({ ...extra, overrides })
    if (file === LIB) { proveState(world().load(LIB), name); proveFlag(opts => world(opts), name) }
    if (file === BUTTON || file === LIB) proveButton(extraEnv => world({ env: extraEnv }).load(BUTTON), name)
    if (file === STRIP || file === BUTTON || file === LIB) proveStrip(opts => stripWorld({ ...opts, overrides }), name)
    if (file === VIEWER) proveViewer(mutated, () => libWorld(), name)
    if (file === ENTRY || file === PAGE) provePanelHandler(file === ENTRY ? mutated : SOURCES[ENTRY], file === PAGE ? mutated : SOURCES[PAGE], name)
    if (file === CSS || file === VIEWER || file === STRIP || file === PAGE || file === ENTRY || file === LIB || file === BUTTON) {
      // wiring checks read the files from disk; run them against the mutated text for this one source
      const original = SOURCES[file]
      SOURCES[file] = mutated
      try { wiringChecksFor(file, mutated) } finally { SOURCES[file] = original }
    }
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
check(assert.equal, killed, MUTANTS.length)

/** The wiring checks that read one source from the working tree, re-run on a mutated copy of it (the git-diff checks use the tree, so they are mirrored on text here). */
function wiringChecksFor(file, text) {
  if (file === CSS) {
    const rules = text.split('\n').filter(line => /\{/.test(line) && !line.trim().startsWith('/*'))
    for (const line of rules) assert.match(line, /^\[data-studio-thumbnail-strip="true"\] \[data-studio-rail-(footer|add-slide)="true"\]/, `a CSS rule outside the footer's scope: ${line}`)
    return
  }
  if (file === BUTTON) assert.match(text, /^import '\.\/studio-rail-add-slide\.css'$/m, 'the button imports its CSS')
  const baseText = baseSource(file)
  if (!baseText) return
  const COMMAND = /postMessage|sendCommand|sendLayout|contentWindow|iframeRef|createViewerRequestId|layout-service-client|fetch\(|action:|WebSocket|sendMessage/
  const baseLines = new Set(baseText.split('\n'))
  const added = text.split('\n').filter(line => !baseLines.has(line))
  if (file === VIEWER || file === STRIP || file === PAGE || file === ENTRY) for (const line of added) assert.doesNotMatch(line, COMMAND, `${file} gained a Layout command line: ${line}`)
  if (file === PAGE || file === ENTRY) assert.equal(text, baseText, `${file} is untouched`)
  if (file === VIEWER) {
    const block = t => t.slice(t.indexOf('{/* Add Slide */}'), t.indexOf("'add-slide', 'Add Slide')}"))
    assert.equal(block(text), block(baseText), 'the toolbar\'s Add Slide block is the base\'s')
  }
}

console.log(`Studio rail add slide: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
