// PASS2B G16 (FRONTEND-2): Export stays disabled, with a reason, while the open deck is only an outline. Flag NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD
// (exact "true", Studio shell only), default off.
//
// Run: node scripts/test-studio-export-after-build.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   EXPORT_AFTER_BUILD_BASE=<commit> overrides the base commit the flag-off identity is checked against (default e9503ae).
//
// Proven on the REAL sources: lib/studio-export-gate.ts, components/presentation-download-controls.tsx, components/studio-disabled-reason.tsx (with the real
// @radix-ui/react-tooltip) and components/builder/presentation-area.tsx:
//   1. the rule: blocked only for enabled === true at stage 4 with no real-true hasFinalDeck; every other stage, and a built deck, is never blocked;
//   2. the control is rendered (real component, stubbed menu/icons/services) over stage x URL x final deck x flag x shell: flag off (unset, "", "false",
//      near-misses, or "true" without the Studio shell) the markup is the base commit's byte for byte, with no wrapper and no reason attribute; on, the box is
//      always there, inert (same children, byte for byte the base's) unless the deck is the outline, then the trigger is disabled and the box says why;
//   3. presentation-area.tsx is the base commit's plus the one `hasFinalDeck={hasFinalDeck}` line;
//   4. mutation check: every mutant of the sources is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { stripRailBuildCount } from './studio-rail-build-count-strip.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const tooltip = nodeRequire('@radix-ui/react-tooltip')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE_COMMIT = process.env.EXPORT_AFTER_BUILD_BASE || 'e9503ae'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const LIB = 'lib/studio-export-gate.ts'
const CONTROLS = 'components/presentation-download-controls.tsx'
const BOX = 'components/studio-disabled-reason.tsx'
const AREA = 'components/builder/presentation-area.tsx'
const TOP_BAR = 'lib/studio-top-bar-v2.ts'
const SOURCES = { [LIB]: read(LIB), [CONTROLS]: read(CONTROLS), [BOX]: read(BOX), [AREA]: read(AREA) }
const FLAG = 'NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const REASON = 'Export unlocks once your deck is built.'
const WAITING = 'Waiting for presentation...'
const BASE_STATUS = 'Download unlocks when a presentation is available at stage four.'
const compiled = new Map()
const compile = (source, fileName) => {
  const key = `${fileName}\u0000${source}`
  if (!compiled.has(key)) compiled.set(key, ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compiled.get(key)
}
function loadLib(source) {
  const module = { exports: {} }
  new Function('module', 'exports', compile(source, LIB))(module, module.exports)
  return module.exports
}

// ---------------------------------------------------------------- 1. the rule
function proveLib(lib, label = 'lib') {
  eq(lib.REASON_EXPORT_NEEDS_DECK, REASON, `${label}: the sentence`)
  const blocked = (enabled, stage, hasFinalDeck) => lib.studioExportBlockedReason({ enabled, stage, hasFinalDeck })
  eq(blocked(true, 4, false), REASON, `${label}: outline, no final deck`)
  eq(blocked(true, 4, undefined), REASON, `${label}: outline, deck state unknown counts as no deck`)
  eq(blocked(true, 4, 'true'), REASON, `${label}: only a real true counts as a final deck`)
  eq(blocked(true, 4, 1), REASON, `${label}: 1 is not a final deck`)
  eq(blocked(true, 4, true), null, `${label}: outline with a final deck`)
  for (const stage of [-1, 0, 1, 2, 3, 5, 6, 7, 40]) for (const deck of [true, false, undefined]) eq(blocked(true, stage, deck), null, `${label}: stage ${stage} never blocked`)
  for (const notTrue of [false, undefined, null, 0, 1, '', 'true', 'false', {}, [], NaN]) for (const deck of [true, false]) eq(blocked(notTrue, 4, deck), null, `${label}: ${JSON.stringify(notTrue) ?? String(notTrue)} is not a real true`)
  nomatch(SOURCES[LIB].replace(/^\/\/.*$/gm, ''), /^import |require\(/m, `${label}: import-free`)
}
proveLib(loadLib(SOURCES[LIB]))

// ---------------------------------------------------------------- 2. the control
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), className: props?.className })) })
const pass = ({ children }) => children ?? null
const menu = {
  DropdownMenu: pass, DropdownMenuTrigger: pass, DropdownMenuPortal: pass,
  DropdownMenuContent: ({ children, ...rest }) => React.createElement('div', { 'data-menu': 'content', ...rest }, children),
  DropdownMenuItem: ({ children, title, disabled }) => React.createElement('div', { 'data-menu': 'item', title, 'data-disabled': disabled ? 'true' : undefined }, children),
  DropdownMenuLabel: ({ children }) => React.createElement('div', { 'data-menu': 'label' }, children),
  DropdownMenuSeparator: () => React.createElement('hr'),
}
function evaluate(source, fileName, table, processEnv) {
  const module = { exports: {} }
  vm.runInNewContext(compile(source, fileName), { module, exports: module.exports, process: { env: processEnv }, document: {}, require: spec => { if (spec.endsWith('.css')) return {}; if (!(spec in table)) throw new Error(`unexpected import ${spec}`); return table[spec] } })
  return module.exports
}
// One module per (sources, env): the component reads the shell and the top-bar flag at load, the export flag at render.
const loadedAs = new Map()
function controlsFor(controlsSource, boxSource, libSource, processEnv) {
  const hash = [controlsSource, boxSource, libSource, JSON.stringify(processEnv)].join('\u0000')
  if (loadedAs.has(hash)) return loadedAs.get(hash)
  const common = { react: React, 'react/jsx-runtime': jsxRuntime }
  const box = evaluate(boxSource, BOX, { ...common, '@radix-ui/react-tooltip': tooltip, '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') } }, processEnv)
  const component = evaluate(controlsSource, CONTROLS, {
    ...common, 'lucide-react': lucide, '@/components/ui/dropdown-menu': menu, '@/lib/api/download-service': { downloadPDF: async () => ({ success: true }), downloadPPTX: async () => ({ success: true }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) }, '@/lib/studio-top-bar-v2': evaluate(read(TOP_BAR), TOP_BAR, {}, processEnv), '@/lib/studio-export-gate': loadLib(libSource), '@/components/studio-disabled-reason': box,
  }, processEnv).PresentationDownloadControls
  loadedAs.set(hash, component)
  return component
}
const URL_OK = 'https://layout.example.invalid/p/abc'
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, { presentationId: 'abc', slideCount: 6, ...props }))
const envOf = (shell, value, topBar) => ({ ...(shell === undefined ? {} : { [SHELL]: shell }), ...(value === undefined ? {} : { [FLAG]: value }), ...(topBar === undefined ? {} : { NEXT_PUBLIC_STUDIO_TOP_BAR_V2: topBar }) })
const OFF_VALUES = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']
const STAGES = [0, 3, 4, 5, 6]
const DECKS = [true, false, undefined]
const blockedAt = (stage, deck) => stage === 4 && deck !== true
const attrOf = (attrs, name) => attrs.match(new RegExp(`(?:^| )${name}="([^"]*)"`))?.[1]
const norm = html => html.replaceAll(REASON, '@@').replaceAll(WAITING, '@@').replaceAll(BASE_STATUS, '@@')
function parts(markup) {
  const desc = markup.match(/<span id="([^"]*)" class="sr-only">([^<]*)<\/span>$/)
  const wrapper = (desc ? markup.slice(0, desc.index) : markup).match(/^<span ([^>]*)>([\s\S]*)<\/span>$/)
  return { desc, wrapper, attrs: wrapper?.[1], inner: wrapper?.[2] }
}
function proveControls({ controlsSource, boxSource, libSource, label = 'controls' }) {
  const baseControls = baseSource(CONTROLS)
  const make = (shell, value, topBar) => controlsFor(controlsSource, boxSource, libSource, envOf(shell, value, topBar))
  const base = (shell, value, topBar) => controlsFor(baseControls, boxSource, libSource, envOf(shell, value, topBar))
  const props = (stage, url, deck) => ({ stage, presentationUrl: url, ...(deck === undefined ? {} : { hasFinalDeck: deck }) })
  for (const stage of STAGES) for (const url of [null, URL_OK]) for (const deck of DECKS) {
    const p = props(stage, url, deck), where = `${label}: stage ${stage}, ${url ? 'url' : 'no url'}, deck ${deck}`
    // flag off: the base commit's markup, no wrapper, no reason attribute
    for (const [shell, value] of [...OFF_VALUES.map(v => ['true', v]), ['false', 'true'], [undefined, 'true'], ['TRUE', 'true']]) {
      const off = render(make(shell, value), p)
      if (baseControls) eq(off, render(base(shell, value), p), `${where}: shell ${shell} flag ${JSON.stringify(value)} is the base commit's markup`)
      nomatch(off, /data-studio-disabled-reason|role="button"|aria-disabled|tabindex|Export unlocks/, `${where}: no wrapper, no reason off`)
      ok(off.startsWith('<div class="flex items-center '), `${where}: the control is the outer element when off`)
    }
    // flag + shell on
    const on = render(make('true', 'true'), p), { desc, wrapper, attrs, inner } = parts(on)
    ok(wrapper, `${where}: the box wraps the control when on`)
    ok(attrOf(attrs, 'class').startsWith('inline-flex rounded-md'), `${where}: it is the disabled-reason box`)
    const baseOn = baseControls ? render(base('true', 'true'), p) : null
    if (!blockedAt(stage, deck)) {
      // inert: the same children, byte for byte, in the same place; the box carries no role, no tab stop, no marker, no description
      nomatch(attrs, /data-studio-disabled-reason|role=|tabindex|aria-/, `${where}: the box is inert`)
      eq(desc, null, `${where}: no description span`)
      if (baseOn) eq(inner, baseOn, `${where}: the children are the base's markup`)
      eq(inner.includes('<button disabled=""'), !(url !== null && stage >= 4), `${where}: the trigger is enabled exactly as in the base`)
      if (stage < 4) match(inner, /title="Waiting for presentation\.\.\."/, `${where}: the base's own words below stage 4`)
      continue
    }
    eq(attrOf(attrs, 'data-studio-disabled-reason'), 'true', `${where}: marker`)
    eq(attrOf(attrs, 'role'), 'button', `${where}: role`); eq(attrOf(attrs, 'aria-disabled'), 'true', `${where}: aria-disabled`)
    eq(attrOf(attrs, 'tabindex'), '0', `${where}: a tab stop`); eq(attrOf(attrs, 'aria-label'), 'Export', `${where}: the control's name`)
    ok(desc, `${where}: the description span`); eq(desc[2], REASON, `${where}: it holds the reason`); eq(attrOf(attrs, 'aria-describedby'), desc[1], `${where}: aria-describedby points at it`)
    match(inner, /^<div class="flex items-center [^"]*"[^>]*><button disabled=""/, `${where}: the trigger is disabled`)
    eq(inner.split(`title="${REASON}"`).length - 1, 1, `${where}: the trigger's title is the reason`)
    match(inner, new RegExp(`<span class="sr-only" role="status" aria-live="polite">${REASON.replaceAll('.', '\\.')}</span>`), `${where}: the status line is the reason`)
    // only the title and the status line differ from a deck that is simply not ready (the base with no URL, which is disabled too)
    if (baseControls) eq(norm(inner), norm(render(base('true', 'true'), { ...p, presentationUrl: null })), `${where}: nothing but the title and the status line differs from the base's disabled control`)
  }
  // the top-bar label variant keeps the same gate (Export wording, same box)
  const blocked = render(make('true', 'true', 'true'), props(4, URL_OK, false)), built = render(make('true', 'true', 'true'), props(4, URL_OK, true))
  match(blocked, /data-studio-disabled-reason="true"/, `${label}: top bar v2 on, outline: blocked`)
  match(parts(blocked).inner, /aria-label="Export unavailable until presentation is ready"/, `${label}: top bar v2 on, outline: unavailable`)
  nomatch(built, /data-studio-disabled-reason/, `${label}: top bar v2 on, built: inert`)
  match(parts(built).inner, /aria-label="Export presentation"/, `${label}: top bar v2 on, built: Export presentation`)
}
const run = (overrides = {}, label) => proveControls({ controlsSource: SOURCES[CONTROLS], boxSource: SOURCES[BOX], libSource: SOURCES[LIB], ...overrides, label })
run({}, 'controls')
if (!baseSource(CONTROLS)) console.log(`  SKIP base-commit identity: ${BASE_COMMIT} is not in this clone`)

// ---------------------------------------------------------------- 3. the area passes the prop through
const PROP = '                    hasFinalDeck={hasFinalDeck}\n'
function proveArea(area, label = 'area') {
  const basePage = baseSource(AREA)
  const at = area.indexOf(PROP)
  ok(at > 0, `${label}: the prop is passed`)
  const open = area.lastIndexOf('<PresentationDownloadControls', at)
  ok(open > 0 && at - open < 300 && !area.slice(open, at).includes('/>'), `${label}: it is on <PresentationDownloadControls>`)
  match(area.slice(open, at), /stage=\{currentStage\}\n\s*$/, `${label}: after the stage prop`)
  eq(area.split('hasFinalDeck={hasFinalDeck}').length - 1, 2, `${label}: the Publish control already had it; the Export control is the second`)
  // + RAIL-SLIDES-1-MIDBUILD (NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT): its marked lines come out first (scripts/studio-rail-build-count-strip.mjs).
  if (basePage) eq(stripRailBuildCount(area).replace(PROP, ''), basePage, `${label}: without that one line the file is ${BASE_COMMIT}'s`)
}
proveArea(SOURCES[AREA])

// ---------------------------------------------------------------- 4. mutation check
const WIRE = 'studioExportBlockedReason({ enabled: exportAfterBuild, stage, hasFinalDeck })'
const BOXED = 'return exportAfterBuild ? <StudioDisabledReason reason={exportBlockedReason} label="Export">{controls}</StudioDisabledReason> : controls'
const MUTANTS = [
  [LIB, 'sentence changed', "'Export unlocks once your deck is built.'", "'Export unlocks when your deck is built.'"],
  [LIB, 'flag read loosely', 'if (input.enabled !== true) return null', 'if (!input.enabled) return null'],
  [LIB, 'flag ignored', 'if (input.enabled !== true) return null', ''],
  [LIB, 'every stage from 4', 'input.stage === 4 &&', 'input.stage >= 4 &&'],
  [LIB, 'stage 3 too', 'input.stage === 4 &&', 'input.stage >= 3 &&'],
  [LIB, 'final deck read loosely', 'input.hasFinalDeck !== true ? REASON', 'input.hasFinalDeck === false ? REASON'],
  [LIB, 'final deck ignored', 'input.stage === 4 && input.hasFinalDeck !== true ? REASON_EXPORT_NEEDS_DECK : null', 'input.stage === 4 ? REASON_EXPORT_NEEDS_DECK : null'],
  [LIB, 'inverted', 'REASON_EXPORT_NEEDS_DECK : null', 'null : REASON_EXPORT_NEEDS_DECK'],
  [CONTROLS, 'flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD === 'true'", "process.env.NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD !== 'false'"],
  [CONTROLS, 'outside the Studio shell', 'STUDIO_DELIVERY && process.env.NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD', 'process.env.NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD'],
  [CONTROLS, 'flag ignored', "const exportAfterBuild = STUDIO_DELIVERY && process.env.NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD === 'true'", 'const exportAfterBuild = STUDIO_DELIVERY'],
  [CONTROLS, 'gate dropped from the rule', 'stage >= 4 && exportBlockedReason === null', 'stage >= 4'],
  [CONTROLS, 'url rule changed', 'presentationUrl !== null && stage >= 4 &&', 'stage >= 4 &&'],
  [CONTROLS, 'default deck true', 'hasFinalDeck = false,', 'hasFinalDeck = true,'],
  [CONTROLS, 'deck not passed', WIRE, 'studioExportBlockedReason({ enabled: exportAfterBuild, stage, hasFinalDeck: false })'],
  [CONTROLS, 'stage not passed', WIRE, 'studioExportBlockedReason({ enabled: exportAfterBuild, stage: 4, hasFinalDeck })'],
  [CONTROLS, 'title without the reason', `(exportBlockedReason ?? '${WAITING}')`, `'${WAITING}'`],
  [CONTROLS, 'base title changed', `?? '${WAITING}'`, "?? 'Waiting for the deck...'"],
  [CONTROLS, 'status line without the reason', `(exportBlockedReason ?? '${BASE_STATUS}')`, `'${BASE_STATUS}'`],
  [CONTROLS, 'base status line changed', `'${BASE_STATUS}'`, "'Download unlocks once a deck is available.'"],
  [CONTROLS, 'no box', BOXED, 'return controls'],
  [CONTROLS, 'box in the shell always', 'return exportAfterBuild ? <StudioDisabledReason', 'return STUDIO_DELIVERY ? <StudioDisabledReason'],
  [CONTROLS, 'box only while blocked', 'return exportAfterBuild ? <StudioDisabledReason', 'return exportBlockedReason ? <StudioDisabledReason'],
  [CONTROLS, 'box blocked for any disabled state', 'reason={exportBlockedReason}', `reason={isDownloadEnabled ? null : '${WAITING}'}`],
  [CONTROLS, 'box without a reason', 'reason={exportBlockedReason}', 'reason={null}'],
  [CONTROLS, 'box named Download', 'label="Export">{controls}', 'label="Download">{controls}'],
  [CONTROLS, 'box around nothing', '{controls}</StudioDisabledReason>', '{null}</StudioDisabledReason>'],
  [CONTROLS, 'trigger never disabled', 'disabled={!isDownloadEnabled || isDownloading}', 'disabled={isDownloading}'],
  [BOX, 'always blocked', "const blocked = typeof reason === 'string' && reason !== ''", 'const blocked = true'],
  [BOX, 'never blocked', "const blocked = typeof reason === 'string' && reason !== ''", 'const blocked = false'],
  [AREA, 'prop dropped', PROP, ''],
  [AREA, 'prop false', 'stage={currentStage}\n                    hasFinalDeck={hasFinalDeck}', 'stage={currentStage}\n                    hasFinalDeck={false}'],
  [AREA, 'prop inverted', 'stage={currentStage}\n                    hasFinalDeck={hasFinalDeck}', 'stage={currentStage}\n                    hasFinalDeck={!hasFinalDeck}'],
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
    if (file === LIB) { proveLib(loadLib(mutated), name); run({ libSource: mutated }, name) }
    if (file === CONTROLS) run({ controlsSource: mutated }, name)
    if (file === BOX) run({ boxSource: mutated }, name)
    if (file === AREA) proveArea(mutated, name)
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

// ---------------------------------------------------------------- .env.example
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD="false"$/m, 'documented in .env.example, default off')

console.log(`Studio export after build (G16): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
