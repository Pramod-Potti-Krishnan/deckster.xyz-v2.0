// PASS2D W (FRONTEND-1): the first-run welcome column is 560 px (PK decision #6, 16 Oct). Flag NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560 (exact "true"), default off.
//   The head, Director's greeting and the starters were 620 px and the composer element 668 px (a visible box of 644); with the flag on every block is min(560px, 100%) and the
//   composer element is 560 px + its 12 px padding each side, so its visible box is 560 px as well.
//
// Run: node scripts/test-studio-welcome-width.mjs   (plain node: transpile + vm, no network, no browser, no env)
//
// Proven on the REAL sources: lib/studio-welcome-width.ts, components/builder/chat/studio-welcome.tsx, components/builder/studio-first-run.css:
//   1. the helper: only the exact boolean `true` adds the marker (an object with one key, 560); everything else is an object with no key at all; the
//      constant is 560;
//   2. the component: flag off, the first-run head has no width attribute and its markup is the flag-on markup minus that attribute; flag on, the head
//      carries data-studio-first-run-width="560"; the continuing and plain welcomes never carry it; the flag is read once, as the exact "true";
//   3. the stylesheet: the appended block is the only place that mentions the marker; each of its rules is keyed to the marker (so flag off it matches
//      nothing), sets 560px (the helper's constant; the composer element 560px + 24px, its own padding, which the composer source is checked to carry as p-3), and covers
//      the column's children, the composer and the head; the old 620/668 rules stay as they were;
//   4. mutation check: every mutant of the three sources is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')

const LIB = 'lib/studio-welcome-width.ts'
const WELCOME = 'components/builder/chat/studio-welcome.tsx'
const CSS = 'components/builder/studio-first-run.css'
const POLISH = 'lib/studio-welcome-polish.ts'
const CHAT_INPUT = 'components/builder/chat-input.tsx'
const SOURCES = { [LIB]: read(LIB), [WELCOME]: read(WELCOME), [CSS]: read(CSS) }
const POLISH_SOURCE = read(POLISH)
const CHAT_INPUT_SOURCE = read(CHAT_INPUT)
const ATTR = 'data-studio-first-run-width'

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)
const json = count((a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m))

const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
function load(source, fileName, stubs = {}, env = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(source, fileName), {
    module, exports: module.exports, process: { env },
    require: spec => { if (!(spec in stubs)) throw new Error(`unexpected import ${spec}`); return stubs[spec] },
  })
  return module.exports
}
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), width: props?.size })) })

function checkAll(src) {
  // ------------------------------------------------------------ 1. the helper
  const lib = load(src[LIB], LIB)
  eq(lib.STUDIO_WELCOME_WIDTH_PX, 560, 'the column is 560 px')
  eq(lib.STUDIO_WELCOME_COMPOSER_INSET_PX, 24, 'the composer element is 24 px (12 + 12) wider than its visible box')
  eq(lib.STUDIO_WELCOME_WIDTH_ATTRIBUTE, ATTR, 'the attribute name')
  json(lib.studioWelcomeWidthProps(true), { [ATTR]: '560' }, 'on: the marker')
  eq(Object.keys(lib.studioWelcomeWidthProps(true)).length, 1, 'on: exactly one key')
  for (const off of [false, undefined, null, 0, 1, 'true', 'false', '', {}, [], NaN, 'on'])
    eq(Object.keys(lib.studioWelcomeWidthProps(off)).length, 0, `not exactly true (${JSON.stringify(off)}): no key at all`)

  // ------------------------------------------------------------ 2. the component
  const mount = env => load(src[WELCOME], WELCOME, {
    react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide,
    '@/lib/studio-welcome-polish': load(POLISH_SOURCE, POLISH),
    '@/lib/studio-welcome-width': lib,
  }, env)
  const off = mount({}), offFalse = mount({ NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560: 'false' }), offOne = mount({ NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560: '1' }), on = mount({ NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560: 'true' })
  const html = (C, props) => renderToStaticMarkup(React.createElement(C.StudioWelcome, props))
  const noop = () => {}
  const first = { firstRun: true, onDraftPrompt: noop }
  const firstOff = html(off, first)
  nomatch(firstOff, new RegExp(ATTR), 'flag unset: the first-run head has no width attribute')
  eq(html(offFalse, first), firstOff, 'flag "false": same markup as unset')
  eq(html(offOne, first), firstOff, 'flag "1" is not "true": same markup as unset')
  const firstOn = html(on, first)
  match(firstOn, new RegExp(`data-studio-first-run="true" ${ATTR}="560"`), 'flag on: the head carries the marker')
  eq(firstOn.replace(` ${ATTR}="560"`, ''), firstOff, 'flag on: the marker is the only difference')
  eq((firstOn.match(new RegExp(ATTR, 'g')) || []).length, 1, 'flag on: one marker')
  for (const props of [{}, { onDraftPrompt: noop }, { presentationContext: { title: 'Q3', slideCount: 3 } }, { firstRun: true, presentationContext: { title: 'Q3', slideCount: 3 } }]) {
    eq(html(on, props), html(off, props), `flag on: ${JSON.stringify(Object.keys(props))} (not the first-run head) is untouched`)
    nomatch(html(on, props), new RegExp(ATTR), 'no marker outside the first-run head')
  }
  eq(src[WELCOME].match(/process\.env\.NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560 === "true"/g)?.length, 1, 'the flag is read once, as the exact "true"')
  eq((src[WELCOME].match(/NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560/g) || []).length >= 2, true, 'the flag name is spelled the same everywhere')
  match(src[WELCOME], /\{\.\.\.studioWelcomeWidthProps\(WELCOME_WIDTH_560\)\}/, 'the head spreads the helper')
  eq((src[WELCOME].match(/studioWelcomeWidthProps\(/g) || []).length, 1, 'the helper is used at one place')

  // ------------------------------------------------------------ 3. the stylesheet
  const css = src[CSS]
  const at = css.indexOf('/* PASS2D W')
  ok(at > 0, 'the PASS2D W block exists')
  const base = css.slice(0, at), block = css.slice(at)
  nomatch(base, new RegExp(ATTR), 'nothing before the block mentions the marker')
  match(base, /width: min\(620px, 100%\)/, 'the old 620 px column rule is still there')
  match(base, /width: min\(668px, 100%\)/, 'the old 668 px composer rule is still there')
  match(base, /max-width: 620px;/, 'the old 620 px head rule is still there')
  const rules = [...block.matchAll(/(^\[data-studio-v4-shell="true"\][^{]*)\{([^}]*)\}/gm)].map(m => ({ selector: m[1].trim(), body: m[2].trim() }))
  eq(rules.length, 3, 'three rules: the column children, the composer, the head')
  for (const rule of rules) {
    match(rule.selector, new RegExp(`\\[data-studio-first-run\\]\\[${ATTR}="560"\\]\\)`), `rule keyed to the marker: ${rule.selector.slice(-60)}`)
    match(rule.selector, /\[data-studio-first-run-stage="true"\]/, 'and to the first-run stage')
    for (const px of rule.body.match(/\d+px/g) || []) ok(px === '560px' || px === '24px', 'the block has no other pixel width than 560px (and the composer\'s 24px inset)')
  }
  const byTail = tail => rules.find(rule => rule.selector.endsWith(tail))
  match(byTail('div:has(> [data-studio-first-run]) > *')?.body ?? '', /^width: min\(560px, 100%\);$/, 'the column children are min(560px, 100%)')
  match(byTail('[data-studio-v4-composer]')?.body ?? '', /^width: min\(calc\(560px \+ 24px\), 100%\);$/, 'the composer element is min(560px + its 24px padding, 100%): its visible box is 560px')
  match(CHAT_INPUT_SOURCE, /data-studio-v4-composer="true"[\s\S]{0,400}?className=\{`p-3 /, 'the composer element carries p-3 (12 px each side), which the 24px inset stands for')
  match(byTail('[data-studio-director-welcome][data-studio-first-run]')?.body ?? '', /^max-width: 560px;$/, 'the head is at most 560px')
  eq((block.match(/560px/g) || []).length, 3, 'three 560px widths in the block')
  eq((block.match(/24px/g) || []).length, 1, 'one 24px inset, on the composer')
  eq(lib.STUDIO_WELCOME_WIDTH_PX + 'px', '560px', 'the stylesheet width equals the constant')
  eq(`calc(${lib.STUDIO_WELCOME_WIDTH_PX}px + ${lib.STUDIO_WELCOME_COMPOSER_INSET_PX}px)`, 'calc(560px + 24px)', 'the composer width equals the constants')
}

checkAll(SOURCES)
const realChecks = checks

// ---------------------------------------------------------------- 4. mutants
const mutants = [
  [LIB, 'inset constant drifts', s => s.replace('STUDIO_WELCOME_COMPOSER_INSET_PX = 24', 'STUDIO_WELCOME_COMPOSER_INSET_PX = 12')],
  [LIB, 'constant 560 -> 600', s => s.replace('STUDIO_WELCOME_WIDTH_PX = 560', 'STUDIO_WELCOME_WIDTH_PX = 600')],
  [LIB, 'truthy enables', s => s.replace('enabled === true ?', 'enabled ?')],
  [LIB, 'always on', s => s.replace('enabled === true ?', 'true ?')],
  [LIB, 'always off', s => s.replace('enabled === true ?', 'false ?')],
  [LIB, 'marker value drifts', s => s.replace("{ 'data-studio-first-run-width': String(STUDIO_WELCOME_WIDTH_PX) }", "{ 'data-studio-first-run-width': '600' }")],
  [LIB, 'marker name drifts', s => s.replace("{ 'data-studio-first-run-width': String", "{ 'data-studio-first-run-wide': String")],
  [LIB, 'attribute constant drifts', s => s.replace("= 'data-studio-first-run-width'", "= 'data-studio-first-run-wide'")],
  [WELCOME, 'flag read loosened', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560 === "true"', 'process.env.NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560 !== undefined')],
  [WELCOME, 'flag read inverted', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560 === "true"', 'process.env.NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560 !== "true"')],
  [WELCOME, 'flag read wrong name', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560', 'process.env.NEXT_PUBLIC_STUDIO_WELCOME_WIDTH')],
  [WELCOME, 'spread dropped', s => s.replace(' {...studioWelcomeWidthProps(WELCOME_WIDTH_560)}', '')],
  [WELCOME, 'spread always on', s => s.replace('studioWelcomeWidthProps(WELCOME_WIDTH_560)', 'studioWelcomeWidthProps(true)')],
  [WELCOME, 'marker on the continuing welcome too', s => s.replace('<section data-studio-director-welcome="true" data-studio-director-welcome-context=', '<section {...studioWelcomeWidthProps(WELCOME_WIDTH_560)} data-studio-director-welcome="true" data-studio-director-welcome-context=')],
  [WELCOME, 'literal marker', s => s.replace(' {...studioWelcomeWidthProps(WELCOME_WIDTH_560)}', ' data-studio-first-run-width="560"')],
  [CSS, 'column children 560 -> 620', s => s.replace('div:has(> [data-studio-first-run]) > * {\n  width: min(560px, 100%);', 'div:has(> [data-studio-first-run]) > * {\n  width: min(620px, 100%);')],
  [CSS, 'composer back to 668', s => s.replace('[data-studio-v4-composer] {\n  width: min(calc(560px + 24px), 100%);', '[data-studio-v4-composer] {\n  width: min(668px, 100%);')],
  [CSS, 'composer without its inset', s => s.replace('width: min(calc(560px + 24px), 100%);', 'width: min(560px, 100%);')],
  [CSS, 'composer inset 24 -> 12', s => s.replace('calc(560px + 24px)', 'calc(560px + 12px)')],
  [CSS, 'head 560 -> 620', s => s.replace('max-width: 560px;\n}', 'max-width: 620px;\n}')],
  [CSS, 'composer rule dropped', s => s.replace(/\[data-studio-v4-shell="true"\][^{\n]*\[data-studio-first-run\]\[data-studio-first-run-width="560"\]\) \[data-studio-v4-composer\] \{\n  width: min\(calc\(560px \+ 24px\), 100%\);\n\}\n/, '')],
  [CSS, 'column rule loses the marker (applies flag off)', s => s.replace(/(PASS2D W[\s\S]*?)\[data-studio-first-run\]\[data-studio-first-run-width="560"\]\) div:has/, '$1[data-studio-first-run]) div:has')],
  [CSS, 'head rule loses the marker', s => s.replace(/\[data-studio-first-run\]\[data-studio-first-run-width="560"\]\) \[data-studio-director-welcome\]\[data-studio-first-run\] \{/, '[data-studio-first-run]) [data-studio-director-welcome][data-studio-first-run] {')],
  [CSS, 'composer rule loses the stage key', s => s.replace(/(PASS2D W[\s\S]*?)\[data-studio-v4-shell-presentation\]\[data-studio-first-run-stage="true"\](\):has\(\[data-studio-workspace-drawer="deck"\]\[data-studio-workspace-visible="true"\] \[data-studio-first-run\]\[data-studio-first-run-width="560"\]\) \[data-studio-v4-composer\])/, '$1[data-studio-v4-shell-presentation]$2')],
  [CSS, 'old column rule changed', s => s.replace('width: min(620px, 100%);\n}', 'width: min(560px, 100%);\n}')],
  [CSS, 'old composer rule changed', s => s.replace('width: min(668px, 100%); margin-inline', 'width: min(560px, 100%); margin-inline')],
  [CSS, 'extra width in block', s => s + '\n[data-studio-v4-shell="true"] [data-studio-first-run-width="560"] x { width: 700px; }\n'],
  [CSS, 'marker used before the block', s => '[data-studio-first-run-width="560"] y { color: red; }\n' + s],
]
let killed = 0
const survivors = []
for (const [file, name, mutate] of mutants) {
  const mutated = mutate(SOURCES[file])
  if (mutated === SOURCES[file]) { survivors.push(`${name} (mutation did not apply)`); continue }
  let died = false
  const before = checks
  try { checkAll({ ...SOURCES, [file]: mutated }) } catch { died = true }
  checks = before
  if (died) killed++; else survivors.push(name)
}
eq(survivors.length, 0, `surviving mutants: ${survivors.join('; ')}`)
console.log(`welcome width: ${realChecks} checks, ${killed}/${mutants.length} mutants killed`)
