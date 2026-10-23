// PASS2B G29 + G33 (FRONTEND-2): a violet band over the header of the Add Slide and Add Element panels. Flag NEXT_PUBLIC_STUDIO_PANEL_EYEBROW (exact "true",
// Studio shell only), default off.
//
// Run: node scripts/test-studio-panel-eyebrow.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   PANEL_EYEBROW_BASE=<commit> overrides the base commit the flag-off identity is checked against (default e9503ae).
//
// Proven on the REAL sources: lib/studio-panel-eyebrow.ts, components/studio-panel-eyebrow.tsx, components/generation-panel/header.tsx (rendered, every
// element type x mode), components/studio-add-slide-v2.tsx and components/slide-generation-panel/index.tsx (very large: source-level, plus the added JSX line
// and constant evaluated for real), and components/builder/studio-panels.css:
//   1. the words: every mode, the slide number rules, the element's name; import-free;
//   2. the Add Element header: flag off (unset, "", "false", near-misses, "true" without the Studio shell) the markup is the base commit's byte for byte; on,
//      it is the band (label, then detail) immediately followed by the base's exact header markup;
//   3. the two slide panels: without the added import lines, the constant and the one JSX line each file is the base commit's; the constant reads the flag inline,
//      exact "true", Studio shell only; the JSX line draws the right words for each mode, sits right before the header, and draws nothing off;
//   4. the CSS: the base file plus one appended block (a violet band, its two spans, and the header's top rule reset when the band is its previous sibling);
//   5. mutation check: every mutant of the sources is killed by sections 1-4.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { stripLaunchWording } from './studio-launch-wording-strip.mjs' // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (launched wording): its flag-gated edits come out first, before every older change's strip

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const postcss = nodeRequire('postcss')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE_COMMIT = process.env.PANEL_EYEBROW_BASE || 'e9503ae'
const read = rel => stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count(assert.deepEqual)

const LIB = 'lib/studio-panel-eyebrow.ts'
const BAND = 'components/studio-panel-eyebrow.tsx'
const HEADER = 'components/generation-panel/header.tsx'
const ADD = 'components/studio-add-slide-v2.tsx'
const SLIDE = 'components/slide-generation-panel/index.tsx'
const CSS = 'components/builder/studio-panels.css'
const TYPES = 'types/textlabs.ts'
const SOURCES = Object.fromEntries([LIB, BAND, HEADER, ADD, SLIDE, CSS].map(file => [file, read(file)]))
const FLAG = 'NEXT_PUBLIC_STUDIO_PANEL_EYEBROW'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const compiled = new Map()
const compile = (source, fileName) => {
  const key = `${fileName}\u0000${source}`
  if (!compiled.has(key)) compiled.set(key, ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compiled.get(key)
}
function evaluate(source, fileName, table = {}, env = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(source, fileName), { module, exports: module.exports, process: { env }, require: spec => { if (!(spec in table)) throw new Error(`unexpected import ${spec}`); return table[spec] } })
  return module.exports
}
const loadLib = source => evaluate(source, LIB)

// ---------------------------------------------------------------- 1. the words
function proveLib(lib, label = 'lib') {
  const slide = (mode, slideNumber) => ({ ...lib.slidePanelEyebrow({ mode, slideNumber }) })
  for (const [mode, label_, detail] of [['create', 'Create slide', n => `Insert after slide ${n}`], ['regenerate', 'Regenerate slide', n => `Slide ${n}`], ['refine', 'Refine slide', n => `Slide ${n}`], ['edit', 'Edit slide', n => `Slide ${n}`]]) {
    for (const n of [1, 2, 7, 38]) deepEq(slide(mode, n), { label: label_, detail: detail(n) }, `${label}: ${mode} ${n}`)
    for (const n of [null, undefined, 0, -1, -7, NaN, Infinity, '3', {}]) deepEq(slide(mode, n), { label: label_, detail: '' }, `${label}: ${mode} with slide number ${String(n)} has no detail`)
  }
  deepEq(slide('mystery', 3), { label: 'Create slide', detail: 'Insert after slide 3' }, `${label}: an unknown mode reads as create`)
  const element = (mode, name) => ({ ...lib.elementPanelEyebrow({ mode, label: name }) })
  for (const name of ['Chart', 'Text Box', 'Icon/Label']) {
    deepEq(element('generate', name), { label: 'Create element', detail: `Selected ${name}` }, `${label}: generate ${name}`)
    deepEq(element('edit', name), { label: 'Edit element', detail: `Selected ${name}` }, `${label}: edit ${name}`)
    deepEq(element('refine', name), { label: 'Refine element', detail: `Selected ${name}` }, `${label}: refine ${name}`)
  }
  for (const mode of ['generate', 'edit', 'refine']) for (const name of ['', undefined, null]) eq(element(mode, name).detail, '', `${label}: ${mode} with no element name has no detail`)
  nomatch(SOURCES[LIB].replace(/^\/\/.*$/gm, ''), /^import |require\(/m, `${label}: import-free`)
}
proveLib(loadLib(SOURCES[LIB]))

// ---------------------------------------------------------------- 2. the Add Element header
const types = evaluate(read(TYPES), TYPES)
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), className: props?.className })) })
const loaded = new Map()
function headerFor(headerSource, bandSource, libSource, env) {
  const hash = [headerSource, bandSource, libSource, JSON.stringify(env)].join('\u0000')
  if (!loaded.has(hash)) loaded.set(hash, evaluate(headerSource, HEADER, {
    'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide, '@/types/textlabs': types, '@/lib/studio-panel-eyebrow': loadLib(libSource),
    '@/components/studio-panel-eyebrow': evaluate(bandSource, BAND, { react: React, 'react/jsx-runtime': jsxRuntime }),
  }, env).GenerationPanelHeader)
  return loaded.get(hash)
}
const envOf = (shell, value) => ({ ...(shell === undefined ? {} : { [SHELL]: shell }), ...(value === undefined ? {} : { [FLAG]: value }) })
const OFF_VALUES = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']
const ELEMENT_TYPES = [...Object.keys(types.COMPONENT_TYPE_INFO), 'MYSTERY']
const bandHtml = (label, detail) => `<div data-studio-panel-eyebrow="true"><span>${label}</span>${detail ? `<span>${detail}</span>` : ''}</div>`
const ELEMENT_LABEL = { generate: 'Create element', edit: 'Edit element', refine: 'Refine element' }
function proveHeader({ headerSource = SOURCES[HEADER], bandSource = SOURCES[BAND], libSource = SOURCES[LIB], label = 'header' } = {}) {
  const baseHeader = baseSource(HEADER)
  const make = (shell, value) => headerFor(headerSource, bandSource, libSource, envOf(shell, value))
  const base = (shell, value) => headerFor(baseHeader, bandSource, libSource, envOf(shell, value))
  const html = (Component, elementType, mode) => renderToStaticMarkup(React.createElement(Component, { elementType, mode, onClose() {} }))
  for (const elementType of ELEMENT_TYPES) for (const mode of ['generate', 'edit', 'refine']) {
    const where = `${label}: ${elementType} ${mode}`, name = types.COMPONENT_TYPE_INFO[elementType]?.label ?? elementType
    const baseOn = baseHeader ? html(base('true', undefined), elementType, mode) : null
    for (const [shell, value] of [...OFF_VALUES.map(v => ['true', v]), ['false', 'true'], [undefined, 'true'], ['TRUE', 'true']]) {
      const off = html(make(shell, value), elementType, mode)
      if (baseHeader) eq(off, html(base(shell, value), elementType, mode), `${where}: shell ${shell} flag ${JSON.stringify(value)} is the base commit's markup`)
      nomatch(off, /data-studio-panel-eyebrow/, `${where}: no band off`)
      ok(off.startsWith('<div data-studio-v4-panel-header="true"'), `${where}: the header is the first element when off`)
    }
    const on = html(make('true', 'true'), elementType, mode), band = bandHtml(ELEMENT_LABEL[mode], `Selected ${name}`)
    ok(on.startsWith(band), `${where}: the band leads`)
    eq(on.slice(band.length).startsWith('<div data-studio-v4-panel-header="true"'), true, `${where}: the header follows right after`)
    if (baseOn) eq(on, band + baseOn, `${where}: band + the base's exact header markup`)
    eq(on.split('data-studio-panel-eyebrow').length - 1, 1, `${where}: one band`)
    match(on, new RegExp(`<h3[^>]*>${name.replace('/', '\\/')}</h3>`), `${where}: the header keeps its own title`)
  }
}
function proveBand(bandSource = SOURCES[BAND], label = 'band') {
  const Band = evaluate(bandSource, BAND, { react: React, 'react/jsx-runtime': jsxRuntime }).StudioPanelEyebrow
  const draw = words => renderToStaticMarkup(React.createElement(Band, words))
  eq(draw({ label: 'Create slide', detail: 'Insert after slide 1' }), bandHtml('Create slide', 'Insert after slide 1'), `${label}: label, then detail`)
  eq(draw({ label: 'Create slide', detail: '' }), '<div data-studio-panel-eyebrow="true"><span>Create slide</span></div>', `${label}: no detail, no second span`)
  eq(draw({ label: 'Edit element', detail: 'Selected <Chart>' }), '<div data-studio-panel-eyebrow="true"><span>Edit element</span><span>Selected &lt;Chart&gt;</span></div>', `${label}: text is escaped`)
}
proveBand()
proveHeader()
if (!baseSource(HEADER)) console.log(`  SKIP base-commit header identity: ${BASE_COMMIT} is not in this clone`)

// ---------------------------------------------------------------- 3. the two slide panels
const IMPORTS = "import { slidePanelEyebrow } from '@/lib/studio-panel-eyebrow'\nimport { StudioPanelEyebrow } from '@/components/studio-panel-eyebrow'\n"
const ARGS = {
  [ADD]: "regenerating && target ? { mode: 'regenerate', slideNumber: target.slideNumber } : { mode: 'create', slideNumber: context.currentSlide }",
  [SLIDE]: "isRefineMode ? { mode: 'refine', slideNumber: refineSlideNumber } : { mode: 'create', slideNumber: presentationId ? currentSlide : null }",
}
const JSX_LINE = file => `        {panelEyebrow && <StudioPanelEyebrow {...slidePanelEyebrow(${ARGS[file]})} />}\n`
function proveSlidePanel(file, source, label = file) {
  const baseText = baseSource(file)
  const constAt = source.indexOf('  // PASS2B G29 (NEXT_PUBLIC_STUDIO_PANEL_EYEBROW')
  ok(constAt > 0, `${label}: the constant is there`)
  const constText = source.slice(constAt, source.indexOf('\n', source.indexOf('\n', constAt) + 1) + 1)
  eq(constText.split('\n').length, 3, `${label}: the constant is a comment and one line`)
  eq(source.split(IMPORTS).length - 1, 1, `${label}: the two imports, once, together`)
  eq(source.split(JSX_LINE(file)).length - 1, 1, `${label}: the band's JSX line, once, with the right words per mode`)
  eq((source.match(/process\.env\.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW/g) ?? []).length, 1, `${label}: the flag is read once, inline`)
  if (baseText) eq(stripAddSlideStatus(file, source).replace(IMPORTS, '').replace(constText, '').replace(JSX_LINE(file), ''), baseText, `${label}: without the added lines the file is ${BASE_COMMIT}'s`)
  // the line sits right before the header (a comment line may sit between them)
  const after = source.slice(source.indexOf(JSX_LINE(file)) + JSX_LINE(file).length)
  match(after, /^(?:\s*\{\/\* Header \*\/\}\n)?\s*<div data-studio-v4-panel-header /, `${label}: the band is the header's previous sibling`)
  // the constant, evaluated: only the Studio shell with a real true
  const rhs = constText.match(/const panelEyebrow = (.*)\n$/)?.[1]
  ok(rhs, `${label}: the constant has one right-hand side`)
  const decide = env => vm.runInNewContext(rhs, { process: { env } })
  eq(decide(envOf('true', 'true')), true, `${label}: shell + flag on`)
  for (const [shell, value] of [...OFF_VALUES.map(v => ['true', v]), ['false', 'true'], [undefined, 'true'], ['TRUE', 'true'], [undefined, undefined]]) eq(decide(envOf(shell, value)), false, `${label}: shell ${shell} flag ${JSON.stringify(value)} is off`)
  // the JSX expression, evaluated against the real lib and band: the words for each mode, nothing off
  const expression = JSX_LINE(file).trim().slice(1, -1)
  const bandModule = evaluate(SOURCES[BAND], BAND, { react: React, 'react/jsx-runtime': jsxRuntime }), libModule = loadLib(SOURCES[LIB])
  const run = scope => {
    const module = { exports: {} }
    vm.runInNewContext(compile(`const { StudioPanelEyebrow } = require('B'); const { slidePanelEyebrow } = require('L'); module.exports = s => { const { panelEyebrow, regenerating, target, context, isRefineMode, refineSlideNumber, presentationId, currentSlide } = s; return <div>{${expression}}</div> }`, 'expression.tsx'), {
      module, exports: module.exports, require: spec => ({ 'react/jsx-runtime': jsxRuntime, B: bandModule, L: libModule })[spec],
    })
    return renderToStaticMarkup(module.exports(scope))
  }
  const wrap = inner => `<div>${inner}</div>`
  const scopes = file === ADD
    ? [[{ regenerating: false, target: null, context: { currentSlide: 3 } }, bandHtml('Create slide', 'Insert after slide 3')],
       [{ regenerating: true, target: { slideNumber: 7 }, context: { currentSlide: 3 } }, bandHtml('Regenerate slide', 'Slide 7')],
       [{ regenerating: true, target: null, context: { currentSlide: 4 } }, bandHtml('Create slide', 'Insert after slide 4')],
       [{ regenerating: false, target: { slideNumber: 7 }, context: { currentSlide: 5 } }, bandHtml('Create slide', 'Insert after slide 5')]]
    : [[{ isRefineMode: true, refineSlideNumber: 6, presentationId: 'p', currentSlide: 2 }, bandHtml('Refine slide', 'Slide 6')],
       [{ isRefineMode: true, refineSlideNumber: 6, presentationId: null, currentSlide: 2 }, bandHtml('Refine slide', 'Slide 6')],
       [{ isRefineMode: false, refineSlideNumber: 6, presentationId: 'p', currentSlide: 2 }, bandHtml('Create slide', 'Insert after slide 2')],
       // not refining: the panel is composing a NEW slide whether or not a presentation id is known (insertAfterIndex is null without one), so the band says "Create slide";
       // it names a place to insert after only when there is a presentation to insert into
       [{ isRefineMode: false, refineSlideNumber: 6, presentationId: null, currentSlide: 2 }, bandHtml('Create slide', '')]]
  for (const [scope, band] of scopes) {
    eq(run({ ...scope, panelEyebrow: true }), wrap(band), `${label}: ${JSON.stringify(scope)} draws ${band}`)
    eq(run({ ...scope, panelEyebrow: false }), wrap(''), `${label}: off draws nothing`)
  }
}
for (const file of [ADD, SLIDE]) proveSlidePanel(file, SOURCES[file])

// ---------------------------------------------------------------- 4. the CSS
function proveCss(css, label = 'css') {
  const baseCss = baseSource(CSS)
  const at = css.indexOf('\n/* PASS2B G29 + G33 (NEXT_PUBLIC_STUDIO_PANEL_EYEBROW)')
  ok(at > 0, `${label}: the block is appended`)
  const block = css.slice(at), head = css.slice(0, at)
  if (baseCss) eq(head, baseCss, `${label}: without the appended block the file is ${BASE_COMMIT}'s`)
  const rules = new Map()
  postcss.parse(block).walkRules(rule => { const props = {}; rule.walkDecls(d => { props[d.prop] = d.value }); rules.set(rule.selector.replace(/\s+/g, ' '), props) })
  deepEq([...rules.keys()], [
    '[data-studio-v4-shell="true"] [data-studio-panel-eyebrow]',
    '[data-studio-v4-shell="true"] [data-studio-panel-eyebrow] > span:first-child',
    '[data-studio-v4-shell="true"] [data-studio-panel-eyebrow] > span:last-child:not(:first-child)',
    '[data-studio-v4-shell="true"] [data-studio-panel-eyebrow] + [data-studio-v4-panel-header]',
  ], `${label}: four rules, all inside the Studio shell`)
  const [band, first, last, header] = [...rules.values()]
  eq(band.background, 'var(--sp-violet)', `${label}: the band is violet (the panel's own token)`)
  eq(band.display, 'flex', `${label}: label left, detail right`); eq(band['justify-content'], 'space-between', `${label}: spread`)
  eq(band['min-height'], '30px', `${label}: height`); eq(band.color, '#fff', `${label}: white text`); eq(band['flex-shrink'], '0', `${label}: does not shrink`)
  eq(first['text-transform'], 'uppercase', `${label}: the label is capitals`); eq(first['font-weight'], '600', `${label}: label weight`)
  eq(last['text-overflow'], 'ellipsis', `${label}: a long detail is cut, not wrapped`); eq(last['white-space'], 'nowrap', `${label}: one line`)
  eq(header['border-top'], '0', `${label}: the header's thin violet top rule is reset next to the band`)
  // the reset beats the base rule that draws the thin rule: same specificity and later in the file (all selectors are attribute-only)
  const baseRuleAt = css.indexOf('[data-studio-v4-panel$="generation"] [data-studio-v4-panel-header] {')
  ok(baseRuleAt > 0 && baseRuleAt < at, `${label}: the thin top rule it replaces is earlier in the file`)
  match(css.slice(baseRuleAt, baseRuleAt + 200), /border-top: 3px solid var\(--sp-violet\)/, `${label}: that rule is the 3px violet one`)
  const weight = selector => (selector.match(/\[[^\]]*\]/g) ?? []).length
  ok(weight('[data-studio-v4-shell="true"] [data-studio-panel-eyebrow] + [data-studio-v4-panel-header]') >= weight('[data-studio-v4-shell="true"] [data-studio-v4-panel$="generation"] [data-studio-v4-panel-header]'), `${label}: and is at least as specific`)
  match(css, /--sp-violet: var\(--ss-accent, #6a4fc0\);/, `${label}: the token exists`)
}
proveCss(SOURCES[CSS])

// ---------------------------------------------------------------- 5. mutation check
const ADD_HEADER = '        <div data-studio-v4-panel-header className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">\n'
const MUTANTS = [
  [LIB, 'create word', "label: 'Create slide'", "label: 'Add slide'"],
  [LIB, 'create detail', '`Insert after slide ${n}`', '`After slide ${n}`'],
  [LIB, 'regenerate word', "label: 'Regenerate slide'", "label: 'Redo slide'"],
  [LIB, 'refine word', "label: 'Refine slide'", "label: 'Refine'"],
  [LIB, 'edit word', "label: 'Edit slide'", "label: 'Change slide'"],
  [LIB, 'regenerate detail', "case 'regenerate': return { label: 'Regenerate slide', detail: n ? `Slide ${n}` : '' }", "case 'regenerate': return { label: 'Regenerate slide', detail: '' }"],
  [LIB, 'refine detail', "case 'refine': return { label: 'Refine slide', detail: n ? `Slide ${n}` : '' }", "case 'refine': return { label: 'Refine slide', detail: n ? `Slide ${n + 1}` : '' }"],
  [LIB, 'negative allowed', 'input.slideNumber > 0', 'input.slideNumber !== 0'],
  [LIB, 'Infinity allowed', 'Number.isFinite(input.slideNumber) &&', ''],
  [LIB, 'element create word', "'Create element'", "'Add element'"],
  [LIB, 'element edit word', "'Edit element'", "'Change element'"],
  [LIB, 'element refine word', "'Refine element'", "'Refine'"],
  [LIB, 'element edit and refine swapped', "input.mode === 'edit' ? 'Edit element' : input.mode === 'refine' ? 'Refine element'", "input.mode === 'edit' ? 'Refine element' : input.mode === 'refine' ? 'Edit element'"],
  [LIB, 'element detail word', '`Selected ${input.label}`', '`${input.label}`'],
  [LIB, 'element detail always', "input.label ? `Selected ${input.label}` : ''", '`Selected ${input.label}`'],
  [BAND, 'detail always drawn', '{detail ? <span>{detail}</span> : null}', '<span>{detail}</span>'],
  [BAND, 'detail first', '<span>{label}</span>\n      {detail ? <span>{detail}</span> : null}', '{detail ? <span>{detail}</span> : null}\n      <span>{label}</span>'],
  [BAND, 'marker dropped', '<div data-studio-panel-eyebrow="true">', '<div>'],
  [BAND, 'detail dropped', '{detail ? <span>{detail}</span> : null}', ''],
  [HEADER, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW === 'true'", "process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW !== 'false'"],
  [HEADER, 'outside the Studio shell', "STUDIO_GENERATION_HEADER && process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW === 'true'", "process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW === 'true'"],
  [HEADER, 'flag ignored', "STUDIO_GENERATION_HEADER && process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW === 'true'", 'STUDIO_GENERATION_HEADER'],
  [HEADER, 'band after the header', '<><StudioPanelEyebrow {...elementPanelEyebrow({ mode, label: info.label })} />{header}</>', '<>{header}<StudioPanelEyebrow {...elementPanelEyebrow({ mode, label: info.label })} /></>'],
  [HEADER, 'band without the header', '<><StudioPanelEyebrow {...elementPanelEyebrow({ mode, label: info.label })} />{header}</>', '<StudioPanelEyebrow {...elementPanelEyebrow({ mode, label: info.label })} />'],
  [HEADER, 'mode ignored', 'elementPanelEyebrow({ mode, label: info.label })', "elementPanelEyebrow({ mode: 'generate', label: info.label })"],
  [HEADER, 'name ignored', 'elementPanelEyebrow({ mode, label: info.label })', "elementPanelEyebrow({ mode, label: '' })"],
  [HEADER, 'header changed', 'aria-label={STUDIO_GENERATION_HEADER ? \'Close element panel\' : undefined}', "aria-label={STUDIO_GENERATION_HEADER ? 'Close panel' : undefined}"],
  [HEADER, 'header title changed', '<h3 className="text-xs font-semibold text-gray-900 dark:text-slate-100">{info.label}</h3>', '<h3 className="text-xs font-semibold text-gray-900 dark:text-slate-100">{info.label}!</h3>'],
  [ADD, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW === 'true'", "process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW !== 'false'"],
  [ADD, 'outside the Studio shell', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW", 'process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW'],
  [ADD, 'flag ignored', "const panelEyebrow = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW === 'true'", "const panelEyebrow = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'"],
  [ADD, 'always drawn', '{panelEyebrow && <StudioPanelEyebrow', '{true && <StudioPanelEyebrow'],
  [ADD, 'regenerate mode lost', "regenerating && target ? { mode: 'regenerate', slideNumber: target.slideNumber }", "regenerating && target ? { mode: 'create', slideNumber: target.slideNumber }"],
  [ADD, 'wrong slide when regenerating', 'slideNumber: target.slideNumber }', 'slideNumber: context.currentSlide }'],
  [ADD, 'wrong slide when creating', "{ mode: 'create', slideNumber: context.currentSlide })", "{ mode: 'create', slideNumber: context.currentSlide + 1 })"],
  [ADD, 'band removed', JSX_LINE(ADD), ''],
  [ADD, 'band moved into the header', JSX_LINE(ADD) + ADD_HEADER, ADD_HEADER + JSX_LINE(ADD)],
  [ADD, 'the base header changed', '<div data-studio-v4-panel-header className="flex items-center justify-between px-3 py-2 border-b', '<div data-studio-v4-panel-header className="flex items-center justify-between px-4 py-2 border-b'],
  [SLIDE, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW === 'true'", "process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW !== 'false'"],
  [SLIDE, 'outside the Studio shell', "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW", 'process.env.NEXT_PUBLIC_STUDIO_PANEL_EYEBROW'],
  [SLIDE, 'always drawn', '{panelEyebrow && <StudioPanelEyebrow', '{true && <StudioPanelEyebrow'],
  [SLIDE, 'refine mode lost', "isRefineMode ? { mode: 'refine', slideNumber: refineSlideNumber }", "isRefineMode ? { mode: 'edit', slideNumber: refineSlideNumber }"],
  [SLIDE, 'wrong refine slide', "{ mode: 'refine', slideNumber: refineSlideNumber }", "{ mode: 'refine', slideNumber: currentSlide }"],
  [SLIDE, 'the old condition: no presentation id says Edit slide', "{ mode: 'create', slideNumber: presentationId ? currentSlide : null }", "{ mode: presentationId ? 'create' : 'edit', slideNumber: currentSlide }"],
  [SLIDE, 'create and edit swapped', "{ mode: 'create', slideNumber: presentationId ? currentSlide : null }", "{ mode: 'edit', slideNumber: presentationId ? currentSlide : null }"],
  [SLIDE, 'insert-after named with no presentation id', "slideNumber: presentationId ? currentSlide : null }", "slideNumber: currentSlide }"],
  [SLIDE, 'insert-after dropped with a presentation id', "slideNumber: presentationId ? currentSlide : null }", "slideNumber: null }"],
  [SLIDE, 'band below the header comment', JSX_LINE(SLIDE) + '        {/* Header */}\n', '        {/* Header */}\n'],
  [SLIDE, 'the base header changed', '<div data-studio-v4-panel-header className="flex items-center justify-between px-3 py-2 border-b', '<div data-studio-v4-panel-header className="flex items-center justify-between px-4 py-2 border-b'],
  [CSS, 'band not violet', 'background: var(--sp-violet);\n  color: #fff;', 'background: var(--sp-ink);\n  color: #fff;'],
  [CSS, 'band colour hard-coded', 'background: var(--sp-violet);\n  color: #fff;', 'background: #6a4fc0;\n  color: #fff;'],
  [CSS, 'band outside the shell', '[data-studio-v4-shell="true"] [data-studio-panel-eyebrow] {', '[data-studio-panel-eyebrow] {'],
  [CSS, 'no space-between', 'justify-content: space-between;', 'justify-content: flex-start;'],
  [CSS, 'label not capitals', 'text-transform: uppercase;', 'text-transform: none;'],
  [CSS, 'detail wraps', 'white-space: nowrap;', 'white-space: normal;'],
  [CSS, 'header rule not reset', '[data-studio-panel-eyebrow] + [data-studio-v4-panel-header] {\n  border-top: 0;', '[data-studio-panel-eyebrow] + [data-studio-v4-panel-header] {\n  border-top: 3px solid var(--sp-violet);'],
  [CSS, 'reset on every header', '[data-studio-panel-eyebrow] + [data-studio-v4-panel-header] {', '[data-studio-v4-panel-header] {'],
  [CSS, 'base rule changed', 'border-top: 3px solid var(--sp-violet);\n}', 'border-top: 3px solid var(--sp-ink);\n}'],
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
    if (file === LIB) { proveLib(loadLib(mutated), name); proveHeader({ libSource: mutated, label: name }) }
    if (file === BAND) { proveBand(mutated, name); proveHeader({ bandSource: mutated, label: name }) }
    if (file === HEADER) proveHeader({ headerSource: mutated, label: name })
    if (file === ADD || file === SLIDE) proveSlidePanel(file, mutated, name)
    if (file === CSS) proveCss(mutated, name)
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

// ---------------------------------------------------------------- .env.example
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_PANEL_EYEBROW="false"$/m, 'documented in .env.example, default off')

console.log(`Studio panel eyebrow (G29 + G33): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
