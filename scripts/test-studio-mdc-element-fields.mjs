// FRONTEND-2 (B44; E2E-2 B1b rows 40 and 41 on Studio dev, root cause by DIRECTOR-2): proof of NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS (exact "true", default off, build-time).
//
// THE DEFECT. A chat add of a label ("Add a label saying 'Pilot stores'") built `iconLabelConfig: {}` (Text Labs defaults to mode "icon": EMPTY text) and a chat add of a shape ("Add a rectangle shape") built `shapeConfig: {}` (no shape_type:
// Text Labs takes custom-prompt mode, Illustrator rejects "A rectangle shape"). The Element panel's own forms send mode 'label' with the text as the prompt, and shape_type for a preset with prompt null.
// THE FIX (flag on). Director's new payload keys icon_label_mode ("label" | "icon"), label_text (1 to 20 characters) and shape_type (one of Illustrator's 24 presets) set the form data as the panel's forms do (lib/mdc-element-fields.ts,
// lib/mdc-element-directive.ts applyDirectiveElementFields, one marked line in app/builder/page.tsx). Anything absent, unknown or off-contract keeps today's form data. Flag off: nothing is read.
//
// THE DIRECTIVE FRAMES. DIRECTOR-2's recorded frames are not yet forwarded to FRONTEND-2, so every directive payload in this proof is BUILT FROM THE CONTRACT (DIRECTOR-2's final contract: optional snake_case keys beside element_type / prompt /
// slide_index / grid_hint). When the recorded frames land they are one more `frame(...)` source for sections 1 and 2.
//
//   1. The mapping against the REAL forms. components/generation-panel/forms/icon-label-form.tsx and shape-form.tsx are loaded, driven like the panel (generate mode, the Mode / Shape picker, Submit) and what they BUILD is compared with what the REAL
//      executor module builds for the same inputs: a label (the text as the prompt), an icon, each of the 24 preset shapes (Studio shell on and off). The executor's valid shape set is the Shape form's own preset list. The shape's panel geometry (x, y,
//      width_px, height_px, the grid start and size) is the one thing the form sends and a chat add does not: Text Labs fills it itself when absent.
//   2. Absent, invalid and off-contract fields build TODAY's form data (the base executor: this lib with the marked lines stripped), flag on and off: wrong types, empty and whitespace text, 21 characters, an unknown or case-changed shape_type,
//      mode "label" without a text, the keys on the wrong element_type, payloads that are not objects. A grid of 9 types x prompts x payloads against an independent oracle; flag off hashes as the base. Then the REAL textlabs-client wire body.
//   3. Wiring and the strip: the marked lines, the page line, import-free fields lib, the strip gives the base back byte for byte, .env.example.
//   4. Mutants: each must be caught.
//   5. Scope over the COMMITTED diff, GATE-SAFE and robust after merge: this change's commits are found by SUBJECT across `rev-list --no-merges BASE..head`; on the gate's merge (first parent dev, second parent this change) the scope head is HEAD^2;
//      the registry, .env.example and strip reads go past every other change, proved on a gate-style merge, on a merge onto an advanced dev and on a synthetic change stacked after this one. Blobs are written from a temporary FILE.
//
//   node scripts/test-studio-mdc-element-fields.mjs
//
// Offline: no socket, fetch or real timer (the host network guard is installed; the wire's fetch is a stub that records the body); git is read only for 5 (objects only, no ref, no working-tree write).
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import ts from 'typescript'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const FLAG = 'NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS'
const DIRECTIVE = 'lib/mdc-element-directive.ts'
const FIELDS = 'lib/mdc-element-fields.ts'
const PAGE = 'app/builder/page.tsx'
const ICON_FORM = 'components/generation-panel/forms/icon-label-form.tsx'
const SHAPE_FORM = 'components/generation-panel/forms/shape-form.tsx'
const CLIENT = 'lib/textlabs-client.ts'
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const copy = value => JSON.parse(JSON.stringify(value))
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-28T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-28T00:00:00Z' }
/** git, stdin ignored, a 60 second limit: a hung child ends the check, never the run. */
const runGit = (args, extraEnv = {}) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60000 })
const git = (...args) => runGit(args)
const plumb = args => runGit(args).trim()
let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}

const { installHostNetworkGuard } = await import('./studio-chat-harness/fake-env.mjs')
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-mdc-element-fields-strip.mjs')
const { stripMdcElementFields, BASE_COMMIT, MDC_ELEMENT_FIELDS_FILES, MDC_ELEMENT_FIELDS_NEW_FILES, MDC_ELEMENT_FIELDS_SCOPE_FILES, MDC_ELEMENT_FIELDS_ENV_BLOCK, MDC_ELEMENT_FIELDS_SUBJECT, MDC_ELEMENT_FIELDS_MARKER_RE, MDC_ELEMENT_FIELDS_PIN_EDITS, MDC_ELEMENT_FIELDS_PIN_FILES, MDC_ELEMENT_FIELDS_PIN_MARK } = stripModule
const release = installHostNetworkGuard(net, dns)

// The strips of the changes registered AFTER this one, applied first (a later change's marked lines in a file this change touches); and, for the scope section, every OTHER registered strip (applied to both sides of a comparison).
const strips = registry.LATER_STRIPS
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
const laterStrips = (rel, text) => { const at = strips.indexOf(stripMdcElementFields); return applyAll(at === -1 ? [] : strips.slice(at + 1), rel, text) }
const otherStrips = (rel, text) => applyAll(strips.filter(strip => strip !== stripMdcElementFields), rel, text)
/** The file as this change left it (the later changes' marked lines out), and the same without this change's lines (the base's file). */
const ownText = rel => laterStrips(rel, read(rel))
const baseText = rel => stripMdcElementFields(rel, ownText(rel))

// ---- a small module loader: TypeScript transpiled, run in a fresh realm with a fake process -------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
const resolveRel = base => { const rel = ['.ts', '.tsx'].map(ext => base + ext).find(item => fs.existsSync(path.join(repo, item))); if (!rel) throw new Error(`unresolved import @/${base}`); return rel }
function makeLoader({ env = {}, texts = {}, stubs = {}, react = React, fetchStub } = {}) {
  const cache = new Map()
  const load = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    vm.runInNewContext(compile(texts[rel] ?? read(rel), rel), {
      module, exports: module.exports, process: { env }, console, URL, AbortController, DOMException, crypto: globalThis.crypto, React: react,
      ...(fetchStub ? { fetch: fetchStub } : {}),
      require: spec => spec === 'react' ? react : spec in stubs ? stubs[spec] : spec.startsWith('@/') ? load(resolveRel(spec.slice(2))) : spec.endsWith('.css') ? {} : require(spec),
    }, { filename: rel })
    return module.exports
  }
  return load
}
const flagEnv = flag => (flag === undefined ? {} : { [FLAG]: flag })
/** The executor module with `flag` ('true', 'false', undefined ...); `texts` replaces files (a mutant, or the base executor). */
const executor = (flag, texts = {}) => makeLoader({ env: flagEnv(flag), texts })(DIRECTIVE)
/** TODAY's executor: the base lib (this lib with the marked lines stripped). It has no applyDirectiveElementFields. */
const baseExecutor = () => makeLoader({ texts: { [DIRECTIVE]: baseText(DIRECTIVE) } })(DIRECTIVE)
/** What the page does with a directive: build the form data, then (if there is one) apply the new fields. Without `exe.applyDirectiveElementFields` (the base) it is only the build. */
function chatAdd(exe, payload) {
  const formData = exe.buildFormDataForDirective(payload.element_type, payload.prompt)
  if (formData && exe.applyDirectiveElementFields) exe.applyDirectiveElementFields(formData, payload)
  return formData
}
/** A directive payload built from DIRECTOR-2's contract (no recorded frame is available yet). */
const frame = (element_type, prompt, extra = {}) => ({ directive_id: 'directive-1', element_type, prompt, slide_index: 1, grid_hint: null, ...extra })

// ---- the REAL forms, driven like the panel (fake hooks, as the Studio form proofs do) ---------------------------------------------------------------
function formHarness(rel, exportName, studio) {
  const states = [], refs = [], effects = [], submitted = [], registered = [], mandatory = []
  let cursor = 0, refCursor = 0, theme = { mode: 'deck', overrides: null }, themeInitialized = false
  const fakeReact = { ...React,
    useState(value) { const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] },
    useRef(value) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: value }; return refs[i] },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => { effects.push(fn) },
  }
  const empty = () => null
  const stubs = { 'lucide-react': new Proxy({}, { get: () => empty }), '../shared/collapsible-section': { CollapsibleSection: ({ children }) => children },
    '../shared/toggle-row': { ToggleRow: empty }, '../shared/z-index-input': { ZIndexInput: empty }, '../shared/theme-source-selector': { ThemeSourceSelector: empty }, '../shared/padding-control': { PaddingControl: empty },
    '@/hooks/use-deck-theme-palette': { useDeckThemePalette: () => ({ tokens: [] }) },
    '../shared/use-theme-source-state': { useThemeSourceState: (_, initial) => { if (!themeInitialized) { theme = initial ?? theme; themeInitialized = true } return { themeSource: theme, updateThemeSource: value => { theme = value }, useDeckTheme: theme.mode === 'deck', themeOverrides: theme.overrides } } },
  }
  const mod = makeLoader({ env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' }, stubs, react: fakeReact })(rel)
  const render = props => { cursor = 0; refCursor = 0; effects.length = 0; return mod[exportName]({ showAdvanced: true, panelMode: 'generate', presentationId: 'local-fixture', isGenerating: false, registerMandatoryConfig: value => mandatory.push(value), registerSubmit: fn => registered.push(fn), onSubmit: value => submitted.push(value), ...props }) }
  const effect = fragment => { const fn = effects.find(item => item.toString().includes(fragment)); assert.ok(fn, fragment); fn() }
  return { render, picker: () => { effect('registerMandatoryConfig'); return mandatory.at(-1) }, submit: () => { effect('registerSubmit'); registered.at(-1)(); return submitted.at(-1) }, effect }
}
/** What the Icon/Label form builds in generate mode when the user picks `mode` ('label' | 'icon') and types `prompt`. */
function iconLabelFormData(studio, prompt, mode) {
  const h = formHarness(ICON_FORM, 'IconLabelForm', studio), props = { prompt }
  h.render(props); h.effect('setOperation(previous'); h.render(props)
  h.picker().find(item => item.fieldLabel === 'Mode').onChange(mode); h.render(props)
  return h.submit()
}
/** What the Shape form builds in generate mode when the user picks `shapeType` and types `prompt`; also the form's own list of shape types. */
function shapeFormData(studio, prompt, shapeType) {
  const h = formHarness(SHAPE_FORM, 'ShapeForm', studio), props = { prompt }
  h.render(props)
  const field = h.picker().find(item => item.fieldLabel === 'Shape')
  const options = field.optionGroups.flatMap(group => group.options.map(option => option.value))
  field.onChange(shapeType); h.render(props)
  return { formData: h.submit(), options }
}
/** The panel geometry of a shape: sent by the form from its own defaults and the canvas, absent in a chat add (Text Labs fills it). */
const SHAPE_GEOMETRY = ['x', 'y', 'width_px', 'height_px', 'start_col', 'start_row', 'position_width', 'position_height']
const sansGeometry = config => Object.fromEntries(Object.entries(config).filter(([key]) => !SHAPE_GEOMETRY.includes(key)))

// ---- the contract, written out here (not read from the lib) ------------------------------------------------------------------------------------------
const CONTRACT_SHAPES = ['circle', 'ellipse', 'square', 'rectangle', 'triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'rhombus', 'parallelogram', 'trapezoid', 'kite', 'line-horizontal', 'line-vertical', 'line-diagonal', 'star', 'cross', 'arrow', 'doughnut', 'cloud', 'heart', 'crescent', 'polygon']
const ALL_TYPES = ['TEXT_BOX', 'METRICS', 'TABLE', 'CHART', 'IMAGE', 'ICON_LABEL', 'SHAPE']
const REAL_PROMPTS = { ICON_LABEL: "Add a label saying 'Pilot stores'", SHAPE: 'Add a rectangle shape', TEXT_BOX: 'Add a text box about pilots', METRICS: 'Four KPIs', TABLE: 'A table of stores', CHART: 'A bar chart', IMAGE: 'A photo of a store' }
const VALID_LABELS = ['Pilot stores', 'A', 'x'.repeat(20), 'Q3 -> 40%', ' padded ', 'a'.repeat(19) + '\u{1F600}', 'two  spaces', 'éèê']
const TOO_LONG = ['x'.repeat(21), 'a'.repeat(20) + '\u{1F600}', '\u{1F600}'.repeat(21), 'Pilot stores in the north west region']
const NOT_LABELS = ['', ' ', '   ', '\n', '\t ', 123, null, undefined, true, ['Pilot'], { text: 'Pilot' }]
const BAD_SHAPES = ['custom', 'auto', 'Rectangle', 'RECTANGLE', ' rectangle', 'rectangle ', 'rect', 'line', 'rounded-rectangle', 'rectangle,circle', '', ' ', 7, null, undefined, true, ['rectangle'], { shape_type: 'rectangle' }, '__proto__', 'constructor', 'toString', 'hasOwnProperty']
/** The independent oracle: does the contract make this payload change this element type? */
const oracleLabelOk = text => typeof text === 'string' && text.trim() !== '' && [...text].length <= 20
const oracleChanges = (type, fields) => Boolean(fields) && typeof fields === 'object' && !Array.isArray(fields) && (
  (type === 'ICON_LABEL' && (fields.icon_label_mode === 'icon' || (fields.icon_label_mode === 'label' && oracleLabelOk(fields.label_text))))
  || (type === 'SHAPE' && typeof fields.shape_type === 'string' && CONTRACT_SHAPES.includes(fields.shape_type)))

/** The payload extras of the grid: valid, invalid, off-contract, on the wrong type, not an object. */
function extrasGrid() {
  const extras = [{}, { icon_label_mode: 'icon' }, { icon_label_mode: 'label', label_text: 'Pilot stores' }, { icon_label_mode: 'icon', label_text: 'Pilot stores' }, { shape_type: 'rectangle' }, { shape_type: 'polygon' }, { shape_type: 'line-diagonal' }, { icon_label_mode: 'label', label_text: 'x'.repeat(20) },
    { icon_label_mode: 'label', label_text: 'x'.repeat(21) }, { icon_label_mode: 'label' }, { label_text: 'Pilot stores' }, { icon_label_mode: 'Label', label_text: 'Pilot' }, { icon_label_mode: 'both', label_text: 'Pilot' }, { icon_label_mode: '', label_text: 'Pilot' },
    { icon_label_mode: null, shape_type: null, label_text: null }, { icon_label_mode: 'label', label_text: 'Pilot', shape_type: 'rectangle' }, { icon_label_mode: 'icon', shape_type: 'circle', label_text: 'Pilot' }, { grid_hint: 'left', directive_id: 'x' }]
  for (const text of NOT_LABELS) extras.push({ icon_label_mode: 'label', label_text: text })
  for (const text of TOO_LONG) extras.push({ icon_label_mode: 'label', label_text: text })
  for (const shape of BAD_SHAPES) extras.push({ shape_type: shape })
  for (const shape of CONTRACT_SHAPES) extras.push({ shape_type: shape })
  return extras
}

// ============================================================================================================================================
// 1 and 2. The mapping against the real forms; today's form data for everything else. One function, so that a mutant of the lib can be run through all of it.
// ============================================================================================================================================
const tally = { labels: 0, icons: 0, shapes: 0, today: 0, grid: 0 }
function mappingSuite(fieldsText = read(FIELDS), directiveText = ownText(DIRECTIVE)) {
  const texts = { [FIELDS]: fieldsText, [DIRECTIVE]: directiveText }
  const base = baseExecutor(), on = executor('true', texts), off = executor(undefined, texts), offFalse = executor('false', texts)
  const fieldsOn = makeLoader({ env: flagEnv('true'), texts })(FIELDS)
  // -- the flag: exact "true", build-time ------------------------------------------------------------------------------------------------------
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['True', false], ['1', false], [' true', false], ['true ', false], ['yes', false], ['', false], ['true', true]]) {
    assert.equal(makeLoader({ env: flagEnv(value), texts })(FIELDS).STUDIO_MDC_ELEMENT_FIELDS_ENABLED, want, `flag ${JSON.stringify(value)}`)
    const out = chatAdd(executor(value, texts), frame('SHAPE', 'A rectangle shape', { shape_type: 'rectangle' }))
    assert.equal(out.shapeConfig.shape_type === 'rectangle', want, `the flag value ${JSON.stringify(value)} decides the shape`)
  }
  // -- the contract's shape set is the Shape form's own preset list (every option but custom) ---------------------------------------------------------
  assert.equal(new Set(CONTRACT_SHAPES).size, 24); assert.deepEqual([...fieldsOn.MDC_PRESET_SHAPE_TYPES], CONTRACT_SHAPES, 'the lib lists the 24 contract shapes, in order')
  const formOptions = shapeFormData(true, 'x', 'rectangle').options
  assert.deepEqual(copy(formOptions).filter(value => value !== 'custom').sort(), [...CONTRACT_SHAPES].sort(), 'the Shape form offers exactly the 24 presets and custom')
  assert.equal(formOptions.length, 25); assert.ok(formOptions.includes('custom'))
  assert.equal(fieldsOn.MDC_LABEL_TEXT_MAX_CHARS, 20)
  // -- a label: the text as the prompt, mode 'label' (the form, Studio shell on and off) ------------------------------------------------------------
  for (const studio of [true, false]) for (const text of VALID_LABELS) {
    const form = iconLabelFormData(studio, text, 'label')
    const exec = chatAdd(on, frame('ICON_LABEL', REAL_PROMPTS.ICON_LABEL, { icon_label_mode: 'label', label_text: text }))
    assert.equal(exec.prompt, form.prompt, `label ${JSON.stringify(text)}: the prompt is the label text`)
    assert.equal(exec.prompt, text)
    assert.deepEqual(copy(exec.iconLabelConfig), copy(form.iconLabelConfig), `label ${JSON.stringify(text)}: iconLabelConfig equals the form's (studio ${studio})`)
    assert.deepEqual(copy(exec.iconLabelConfig), { operation: 'generate', mode: 'label' })
    assert.deepEqual(copy(exec), copy({ ...chatAdd(base, frame('ICON_LABEL', REAL_PROMPTS.ICON_LABEL)), prompt: text, iconLabelConfig: form.iconLabelConfig }), 'nothing else in the form data changes')
    tally.labels++
  }
  // -- an icon: the directive's own prompt, mode 'icon' ---------------------------------------------------------------------------------------------
  for (const studio of [true, false]) for (const extra of [{ icon_label_mode: 'icon' }, { icon_label_mode: 'icon', label_text: 'Pilot stores' }]) {
    const prompt = 'A shopping cart icon'
    const form = iconLabelFormData(studio, prompt, 'icon')
    const exec = chatAdd(on, frame('ICON_LABEL', prompt, extra))
    assert.equal(exec.prompt, form.prompt); assert.equal(exec.prompt, prompt)
    assert.deepEqual(copy(exec.iconLabelConfig), copy(form.iconLabelConfig), `icon: iconLabelConfig equals the form's (studio ${studio})`)
    assert.deepEqual(copy(exec.iconLabelConfig), { operation: 'generate', mode: 'icon' })
    assert.deepEqual(copy(exec), copy({ ...chatAdd(base, frame('ICON_LABEL', prompt)), iconLabelConfig: form.iconLabelConfig }))
    tally.icons++
  }
  // -- every preset shape: shape_type + prompt null, the form's routing intent ------------------------------------------------------------------------
  for (const studio of [true, false]) for (const shapeType of CONTRACT_SHAPES) {
    const prompt = `A ${shapeType} shape`
    const { formData: form } = shapeFormData(studio, prompt, shapeType)
    const exec = chatAdd(on, frame('SHAPE', prompt, { shape_type: shapeType }))
    for (const key of SHAPE_GEOMETRY) assert.ok(key in form.shapeConfig, `the form's shape config still carries ${key}`)
    assert.deepEqual(Object.keys(sansGeometry(form.shapeConfig)).sort(), ['prompt', 'shape_type'], 'the form sends nothing else for a preset with no explicit override')
    assert.deepEqual(copy(exec.shapeConfig), copy(sansGeometry(form.shapeConfig)), `${shapeType}: shapeConfig equals the form's without the panel geometry (studio ${studio})`)
    assert.deepEqual(copy(exec.shapeConfig), { shape_type: shapeType, prompt: null })
    assert.equal(exec.prompt, form.prompt, `${shapeType}: the top-level prompt is the directive's, as the form's`)
    assert.deepEqual(copy(exec), copy({ ...chatAdd(base, frame('SHAPE', prompt)), shapeConfig: sansGeometry(form.shapeConfig) }))
    tally.shapes++
  }
  // -- absent, invalid and off-contract fields: today's form data, flag on and off; and the grid against the oracle -------------------------------------------
  const extras = extrasGrid(), types = [...ALL_TYPES, 'INFOGRAPHIC', '']
  const prompts = [REAL_PROMPTS.ICON_LABEL, 'A rectangle shape', '']
  const rows = { base: [], off: [], offFalse: [], on: [] }
  for (const type of types) for (const prompt of prompts) for (const extra of [undefined, null, 'rectangle', 42, [], ...extras]) {
    const payload = extra === undefined ? { directive_id: 'd', element_type: type, prompt, slide_index: 1 } : extra && typeof extra === 'object' && !Array.isArray(extra) ? frame(type, prompt, extra) : null
    const todayOut = JSON.stringify(chatAdd(base, { element_type: type, prompt }) ?? null)
    const fields = payload ?? extra
    // the page passes the whole payload; a non-object stands for any other value of it
    const run = exe => { const formData = exe.buildFormDataForDirective(type, prompt); if (formData && exe.applyDirectiveElementFields) exe.applyDirectiveElementFields(formData, fields); return JSON.stringify(formData ?? null) }
    rows.base.push(todayOut); rows.off.push(run(off)); rows.offFalse.push(run(offFalse))
    const onOut = run(on); rows.on.push(onOut)
    const changes = payload ? oracleChanges(type, payload) : false
    assert.equal(onOut !== todayOut, changes, `${type} ${JSON.stringify(prompt)} ${JSON.stringify(fields)}: flag on changes the form data exactly when the contract says (${changes})`)
    if (!changes) assert.equal(onOut, todayOut, `${type} ${JSON.stringify(fields)}: today's form data`)
    tally.grid++; if (!changes) tally.today++
  }
  assert.equal(sha(rows.off.join('\n')), sha(rows.base.join('\n')), 'flag unset: every output hashes as the base')
  assert.equal(sha(rows.offFalse.join('\n')), sha(rows.base.join('\n')), 'flag "false": every output hashes as the base')
  assert.notEqual(sha(rows.on.join('\n')), sha(rows.base.join('\n')), 'flag on differs from the base (the valid payloads)')
  // -- boundaries ---------------------------------------------------------------------------------------------------------------------------------
  for (const [text, ok] of [['x'.repeat(19), true], ['x'.repeat(20), true], ['x'.repeat(21), false], ['\u{1F600}'.repeat(20), true], ['\u{1F600}'.repeat(21), false], ['a', true], ['', false], ['  ', false]]) {
    const exec = chatAdd(on, frame('ICON_LABEL', 'P', { icon_label_mode: 'label', label_text: text }))
    assert.equal(exec.iconLabelConfig.mode === 'label', ok, `label_text of ${[...text].length} characters (${text.length} UTF-16 units)`)
    if (ok) assert.equal(exec.prompt, text); else assert.deepEqual(copy(exec), copy(chatAdd(base, frame('ICON_LABEL', 'P'))))
  }
  assert.equal(chatAdd(on, frame('ICON_LABEL', 'P', { icon_label_mode: 'label', label_text: 'Q' })).iconLabelConfig.operation, 'generate')
  // -- the executor's own contract is untouched --------------------------------------------------------------------------------------------------
  assert.equal(on.buildFormDataForDirective('INFOGRAPHIC', 'x'), null); assert.deepEqual([...on.DIRECTIVE_TYPES], ALL_TYPES)
  for (const type of ALL_TYPES) assert.deepEqual(copy(on.buildFormDataForDirective(type, 'p')), copy(base.buildFormDataForDirective(type, 'p')), `${type}: buildFormDataForDirective is the base's with two arguments`)
  return { grid: rows.base.length }
}

console.log('1 and 2. the mapping against the real forms; today\'s form data for everything else (directive frames built from the contract: no recorded frame yet)')
let realTally
await check('label, icon and 24 preset shapes equal what the real forms build; invalid, absent and off-contract fields build today\'s form data; flag off and "false" hash as the base', () => { mappingSuite(); realTally = { ...tally } })
await check('the wire: the REAL textlabs-client sends the same icon_label_config / shape_config / message for a chat add as for the form (shape without the panel geometry); flag off sends today\'s empty configs', async () => {
  const bodies = []
  const fetchStub = async (_url, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, response: 'ok' }) } }
  const client = makeLoader({ env: { NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.example.test' }, fetchStub })(CLIENT)
  const wire = async formData => { bodies.length = 0; const payload = client.buildApiPayload('synthetic-session', copy(formData)); await client.sendMessage(payload.sessionId, payload.message, payload.options); assert.equal(bodies.length, 1); return bodies[0] }
  const on = executor('true'), off = executor(undefined)
  const labelForm = await wire(iconLabelFormData(true, 'Pilot stores', 'label')), labelChat = await wire(chatAdd(on, frame('ICON_LABEL', REAL_PROMPTS.ICON_LABEL, { icon_label_mode: 'label', label_text: 'Pilot stores' })))
  assert.equal(labelChat.message, 'Pilot stores'); assert.equal(labelChat.message, labelForm.message)
  assert.deepEqual(labelChat.icon_label_config, { operation: 'generate', mode: 'label' }); assert.deepEqual(labelChat.icon_label_config, labelForm.icon_label_config)
  const iconForm = await wire(iconLabelFormData(true, 'A shopping cart icon', 'icon')), iconChat = await wire(chatAdd(on, frame('ICON_LABEL', 'A shopping cart icon', { icon_label_mode: 'icon' })))
  assert.deepEqual(iconChat.icon_label_config, iconForm.icon_label_config); assert.equal(iconChat.message, iconForm.message)
  const shapeForm = await wire(shapeFormData(true, 'A rectangle shape', 'rectangle').formData), shapeChat = await wire(chatAdd(on, frame('SHAPE', 'A rectangle shape', { shape_type: 'rectangle' })))
  assert.deepEqual(shapeChat.shape_config, { shape_type: 'rectangle', prompt: null }); assert.deepEqual(shapeChat.shape_config, sansGeometry(shapeForm.shape_config)); assert.equal(shapeChat.message, shapeForm.message)
  for (const key of SHAPE_GEOMETRY) assert.ok(key in shapeForm.shape_config, key)
  const today = await wire(chatAdd(executor(undefined), frame('ICON_LABEL', REAL_PROMPTS.ICON_LABEL, { icon_label_mode: 'label', label_text: 'Pilot stores' })))
  assert.deepEqual(today.icon_label_config, {}); assert.equal(today.message, REAL_PROMPTS.ICON_LABEL)
  const todayShape = await wire(chatAdd(off, frame('SHAPE', 'A rectangle shape', { shape_type: 'rectangle' })))
  assert.deepEqual(todayShape.shape_config, {}); assert.equal(todayShape.message, 'A rectangle shape')
  const offBody = await wire(chatAdd(off, frame('SHAPE', 'A rectangle shape', {}))); assert.deepEqual(offBody, todayShape, 'flag off: the field does not change the request')
})

// ============================================================================================================================================
// 3. Wiring and the strip
// ============================================================================================================================================
console.log('3. wiring and the strip')
const markedLines = text => text.split('\n').filter(line => MDC_ELEMENT_FIELDS_MARKER_RE.test(line))
function wiringSuite({ directive = ownText(DIRECTIVE), page = ownText(PAGE), fields = read(FIELDS) } = {}) {
  const lib = markedLines(directive), pageLines = markedLines(page)
  assert.equal(lib.length, 3, 'three marked lines in the executor: the import, the comment, the function')
  assert.match(lib[0], /^import \{ mdcElementFieldsPatch \} from '@\/lib\/mdc-element-fields' \/\/ /)
  assert.match(lib[1], /^\/\/ MDC-ELEMENT-FIELDS: /); assert.match(lib[2], /^export function applyDirectiveElementFields\(formData: TextLabsFormData, fields: unknown\): TextLabsFormData \{ .* \} \/\/ MDC-ELEMENT-FIELDS$/)
  assert.ok(lib[2].includes('mdcElementFieldsPatch(formData.componentType, fields)'), 'the executor asks the patch for the form data\'s own component type and the payload')
  const afterBuild = directive.indexOf('\nexport function buildFormDataForDirective('); assert.ok(afterBuild > 0)
  assert.ok(directive.indexOf(lib[2]) > directive.indexOf('\n}\n', afterBuild), 'the new function sits after buildFormDataForDirective')
  assert.equal(pageLines.length, 1, 'one marked line in the page')
  const rows = page.split('\n'), at = rows.findIndex(line => MDC_ELEMENT_FIELDS_MARKER_RE.test(line))
  assert.equal(rows[at - 1], '        const formData = buildFormDataForDirective(payload.element_type, payload.prompt)', 'right after the form data is built')
  assert.equal(rows[at + 1], '        if (!formData) {', 'right before the unsupported-type exit')
  assert.match(rows[at], /^ {8}if \(formData\) \(await import\('@\/lib\/mdc-element-directive'\)\)\.applyDirectiveElementFields\(formData, payload\) \/\/ MDC-ELEMENT-FIELDS: /, 'the whole payload goes in, guarded by the form data')
  assert.equal(page.split('applyDirectiveElementFields').length - 1, 1, 'the page calls it once')
  // the fields lib: type-only imports, one flag read, the exact "true"
  assert.deepEqual(fields.split('\n').filter(line => /^import /.test(line)), ["import type { IconLabelConfig, ShapeConfig, TextLabsShapeType } from '@/types/textlabs'"], 'only a type import: nothing at run time')
  const reads = fields.split('\n').filter(line => /process\.env/.test(line) && !/^\s*(\*|\/\/)/.test(line)); assert.equal(reads.length, 1); assert.match(reads[0], /process\.env\.NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS === 'true'/)
  assert.ok(!/process\.env/.test(directive), 'the executor reads no environment of its own')
  // the strip: the marked lines out is the base
  assert.equal(stripMdcElementFields(DIRECTIVE, directive).split('\n').some(line => MDC_ELEMENT_FIELDS_MARKER_RE.test(line)), false)
  assert.equal(stripMdcElementFields(PAGE, page).split('\n').some(line => MDC_ELEMENT_FIELDS_MARKER_RE.test(line)), false)
  assert.equal(stripMdcElementFields(DIRECTIVE, directive).length, directive.length - lib.reduce((n, line) => n + line.length + 1, 0), 'only whole marked lines come out')
  assert.equal(stripMdcElementFields(PAGE, page).length, page.length - pageLines[0].length - 1)
  for (const rel of ['lib/chat-element-refine.ts', 'types/textlabs.ts', ICON_FORM, SHAPE_FORM, 'package.json']) assert.equal(stripMdcElementFields(rel, `${rel}\nMDC-ELEMENT-FIELDS`), `${rel}\nMDC-ELEMENT-FIELDS`, `${rel}: a file that is not this change's is returned as it is`)
  assert.equal(stripMdcElementFields(DIRECTIVE, stripMdcElementFields(DIRECTIVE, directive)), stripMdcElementFields(DIRECTIVE, directive), 'idempotent')
  assert.equal(stripMdcElementFields(DIRECTIVE, 5), 5)
}
await check('the marked lines (import, comment, function; one page line after the form data is built), the type-only fields lib with one exact-"true" flag read, the strip takes whole marked lines only and is idempotent', () => wiringSuite())
await check('the executor is the only caller: build/apply names appear only in the page, the executor and the refine lib\'s two-argument build', () => {
  const hits = execFileSync('git', ['grep', '-l', '-e', 'applyDirectiveElementFields', '-e', 'mdcElementFieldsPatch', '--', 'app', 'lib', 'hooks', 'components'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).split('\n').filter(Boolean).sort()
  assert.deepEqual(hits, [PAGE, DIRECTIVE, FIELDS].sort())
  assert.match(read('lib/chat-element-refine.ts'), /buildFormDataForDirective\(componentType, instruction\)/, 'the refine path still builds with two arguments')
})
await check('.env.example: the flag is there once, "false", in its block', () => {
  const env = read('.env.example')
  assert.equal(env.split(MDC_ELEMENT_FIELDS_ENV_BLOCK).length - 1, 1); assert.equal(env.split(`${FLAG}=`).length - 1, 1); assert.ok(MDC_ELEMENT_FIELDS_ENV_BLOCK.trimEnd().endsWith(`${FLAG}="false"`))
  assert.ok(MDC_ELEMENT_FIELDS_ENV_BLOCK.includes('default off') && MDC_ELEMENT_FIELDS_ENV_BLOCK.includes('"true"'))
})

/** The older proofs this change teaches, put back: dev's file byte for byte, through the strips of the changes registered after this one first. */
const pinsSuite = (edits = MDC_ELEMENT_FIELDS_PIN_EDITS, ctx = { later: laterStrips, headText: rel => read(rel), baseOf: rel => git('show', `${BASE_COMMIT}:${rel}`) }) => {
  assert.deepEqual(Object.keys(edits), ['scripts/test-studio-chat-element-edit-2.mjs', 'scripts/studio-chat-add-targeted-world.mjs'], 'two older files are taught: #538\'s chat element edit 2 (it strips the page of its own lines and holds it to its base) and #546\'s world (it cuts the page\'s runner out and counts its dynamic imports)')
  for (const rel of Object.keys(edits)) {
    const back = text => stripModule.putBackPin(rel, text, edits)
    const now = ctx.later(rel, ctx.headText(rel))
    assert.equal(sha(back(now)), sha(ctx.baseOf(rel)), `${rel}: the taught proof, put back, is dev's file byte for byte`)
    assert.equal(back(back(now)), back(now), `${rel}: put back twice is put back once`)
    for (const [has, was] of edits[rel]) {
      assert.equal(now.split(has).length - 1, 1, `${rel}: each taught text is in the proof exactly once`)
      for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(MDC_ELEMENT_FIELDS_PIN_MARK), `${rel}: a taught line carries the pin mark`)
      assert.ok(has !== was)
    }
    if (edits === MDC_ELEMENT_FIELDS_PIN_EDITS) { // every consumer's position in the registry: the strips after it, in registry order, leave this proof and dev's file indistinguishable (theme own choice swapped the same line before this change)
      const at = strips.indexOf(stripMdcElementFields), dev = ctx.baseOf(rel)
      assert.ok(at > 0)
      for (let k = 0; k <= at; k++) assert.equal(sha(applyAll(strips.slice(k), rel, read(rel))), sha(applyAll(strips.slice(k), rel, dev)), `${rel}: from registry position ${k} (${k === 0 ? 'the first' : String(strips[k - 1]).slice(0, 40).replace(/\s+/g, ' ')}) the strips after it leave the taught proof and dev's file the same`)
    }
  }
}
await check('the taught proof (chat element edit 2): put back through the strip it is dev\'s file byte for byte and idempotent; every taught line carries the pin mark; the strip returns another proof as it is', () => {
  pinsSuite()
  assert.deepEqual([...MDC_ELEMENT_FIELDS_PIN_FILES], ['scripts/test-studio-chat-element-edit-2.mjs', 'scripts/studio-chat-add-targeted-world.mjs'])
  assert.match(read('scripts/studio-chat-add-targeted-world.mjs'), /replaceAll\("await import\('@\/lib\/mdc-element-directive'\)", '__mdc'\)/, 'the world substitutes every occurrence of the executor import')
  assert.equal(stripMdcElementFields('scripts/test-studio-chat-edit-targeted.mjs', 'x'), 'x')
  const proof = read('scripts/test-studio-chat-element-edit-2.mjs')
  assert.ok(proof.includes('strippedPastLater(rel, read(rel))'), 'the check reads past the strips registered after #538\'s')
})

// ============================================================================================================================================
// 4. Mutants
// ============================================================================================================================================
console.log('4. mutants')
const caughtBy = []
const fieldsSource = read(FIELDS)
/** `source` with the first occurrence of `from` replaced by `to` (a mutant must really change the text). */
const mutate = (source, from, to) => { assert.equal(source.split(from).length - 1, 1, `mutant anchor, exactly once: ${from}`); return source.replace(from, () => to) }
const FIELD_MUTANTS = [
  ['the label text is not the prompt (the directive prompt stays)', "return { prompt: bag.label_text, iconLabelConfig", 'return { iconLabelConfig'],
  ['label mode without operation', "iconLabelConfig: { operation: 'generate', mode: 'label' } }", "iconLabelConfig: { mode: 'label' } }"],
  ['icon mode sends no mode', "iconLabelConfig: { operation: 'generate', mode: 'icon' } }", "iconLabelConfig: { operation: 'generate' } }"],
  ['the label limit is 21', 'Array.from(value).length <= MDC_LABEL_TEXT_MAX_CHARS', 'Array.from(value).length <= MDC_LABEL_TEXT_MAX_CHARS + 1'],
  ['the label limit is 19', 'Array.from(value).length <= MDC_LABEL_TEXT_MAX_CHARS', 'Array.from(value).length < MDC_LABEL_TEXT_MAX_CHARS'],
  ['the length is counted in UTF-16 units', 'Array.from(value).length <= MDC_LABEL_TEXT_MAX_CHARS', 'value.length <= MDC_LABEL_TEXT_MAX_CHARS'],
  ['an empty or whitespace-only text is accepted', "typeof value === 'string' && value.trim() !== '' && ", "typeof value === 'string' && "],
  ['the label text is trimmed', 'return { prompt: bag.label_text, iconLabelConfig', 'return { prompt: bag.label_text.trim(), iconLabelConfig'],
  ['custom is accepted as a shape', "export const MDC_PRESET_SHAPE_TYPES: readonly Exclude<TextLabsShapeType, 'custom'>[] = [\n  'circle',", "export const MDC_PRESET_SHAPE_TYPES: readonly Exclude<TextLabsShapeType, 'custom'>[] = [\n  'custom', 'circle',"],
  ['polygon is missing from the set', "'crescent', 'polygon',", "'crescent',"],
  ['the shape type is case-folded', "typeof value === 'string' && (MDC_PRESET_SHAPE_TYPES as readonly string[]).includes(value)", "typeof value === 'string' && (MDC_PRESET_SHAPE_TYPES as readonly string[]).includes(value.toLowerCase())"],
  ['the shape type is trimmed', "typeof value === 'string' && (MDC_PRESET_SHAPE_TYPES as readonly string[]).includes(value)", "typeof value === 'string' && (MDC_PRESET_SHAPE_TYPES as readonly string[]).includes(value.trim())"],
  ['the preset shape keeps a prompt', '{ shape_type: bag.shape_type, prompt: null }', '{ shape_type: bag.shape_type }'],
  ['the shape config carries the panel geometry', '{ shape_type: bag.shape_type, prompt: null }', '{ shape_type: bag.shape_type, prompt: null, x: 60, y: 180 }'],
  ['an icon label with a stray shape_type loses its label', "if (componentType === 'ICON_LABEL') {", "if (componentType === 'ICON_LABEL' && !isMdcPresetShapeType(bag.shape_type)) {"],
  ['the shape type acts on a text box too', "if (componentType === 'SHAPE') {", "if (componentType === 'SHAPE' || componentType === 'TEXT_BOX') {"],
  ['the icon fields act on a shape too', "if (componentType === 'ICON_LABEL') {", "if (componentType === 'ICON_LABEL' || componentType === 'SHAPE') {"],
  ['the flag is ignored', 'if (!enabled || !fields', 'if (!fields'],
  ['the flag is any non-empty value', "process.env.NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS"],
  ['a mode "label" without a text sends the label anyway', "bag.icon_label_mode === 'label' && isValidMdcLabelText(bag.label_text)", "bag.icon_label_mode === 'label'"],
  ['any other mode counts as icon', "if (bag.icon_label_mode === 'icon')", "if (bag.icon_label_mode !== 'label')"],
]
let mutantNumber = 0
for (const [name, from, to] of FIELD_MUTANTS) {
  mutantNumber++
  await check(`mutant caught: ${name}`, () => {
    const mutant = mutate(fieldsSource, from, to)
    assert.notEqual(mutant, fieldsSource)
    assert.throws(() => mappingSuite(mutant), undefined, 'the mapping suite must fail')
    caughtBy.push(`  ${String(mutantNumber).padStart(2)}. ${name}`)
  })
}
await check('mutant caught: an executor apply that ignores the patch, one that returns a patched copy instead of mutating in place, and one that reads a fixed component type', () => {
  const directive = ownText(DIRECTIVE)
  const lineOf = directive.split('\n').find(line => line.startsWith('export function applyDirectiveElementFields'))
  assert.ok(lineOf)
  for (const [name, replacement] of [
    ['ignores the patch', lineOf.replace('if (patch) Object.assign(formData, patch); ', '')],
    ['returns a patched copy and leaves the form data alone (the page ignores the return)', lineOf.replace('if (patch) Object.assign(formData, patch); return formData }', 'if (patch) return { ...formData, ...patch }; return formData }')],
    ['uses a fixed component type', lineOf.replace('formData.componentType', "'SHAPE'")],
  ]) {
    assert.notEqual(replacement, lineOf)
    assert.throws(() => mappingSuite(read(FIELDS), directive.replace(lineOf, replacement)), undefined, name)
    caughtBy.push(`  ${String(++mutantNumber).padStart(2)}. the executor's apply ${name}`)
  }
})
await check('mutant caught: a page line that passes payload.prompt, a missing page line, a second page line, an executor function without its marker, an import added to the fields lib', () => {
  const page = ownText(PAGE), directive = ownText(DIRECTIVE), fields = read(FIELDS)
  const line = page.split('\n').find(item => MDC_ELEMENT_FIELDS_MARKER_RE.test(item))
  assert.doesNotThrow(() => wiringSuite())
  const bad = [
    ['the page passes payload.prompt', { page: page.replace('applyDirectiveElementFields(formData, payload)', 'applyDirectiveElementFields(formData, payload.prompt)') }],
    ['the page line is missing', { page: page.replace(`${line}\n`, '') }],
    ['the page calls it twice', { page: page.replace(line, `${line}\n${line}`) }],
    ['the page line is before the build', { page: page.replace(`${line}\n`, '').replace('        const formData = buildFormDataForDirective(payload.element_type, payload.prompt)\n', `${line}\n        const formData = buildFormDataForDirective(payload.element_type, payload.prompt)\n`) }],
    ['the executor function lost its marker', { directive: directive.replace('return formData } // MDC-ELEMENT-FIELDS', 'return formData }') }],
    ['the fields lib imports a module', { fields: `import { x } from '@/lib/x'\n${fields}` }],
    ['the fields lib reads a second env', { fields: `${fields}\nconst second = process.env.OTHER_FLAG\n` }],
    ['the fields lib reads the flag loosely', { fields: fields.replace("=== 'true'", "!== 'false'") }],
  ]
  for (const [name, parts] of bad) { assert.throws(() => wiringSuite(parts), undefined, name); caughtBy.push(`  ${String(++mutantNumber).padStart(2)}. wiring: ${name}`) }
})
await check('mutant caught: a taught text that was not the proof\'s previous text, a taught line without the pin mark, a table that teaches a second proof, a put-back without the theme clause', async () => {
  const rel = 'scripts/test-studio-chat-element-edit-2.mjs', edits = copy(MDC_ELEMENT_FIELDS_PIN_EDITS)
  assert.doesNotThrow(() => pinsSuite(edits))
  const wrongWas = copy(edits); wrongWas[rel][1][1] = wrongWas[rel][1][1].replace('stripThemeOwnChoice', 'stripThemeOwnChoicE')
  assert.throws(() => pinsSuite(wrongWas), /dev's file byte for byte/)
  // the order-aware put-back: without its theme clause a consumer registered before theme own choice sees a different proof
  const real = read('scripts/studio-mdc-element-fields-strip.mjs')
  const noClause = real.replace('&& !out.includes(PIN_THEME_IMPORT)) out = out.replace(PIN_THEME_LINE[0], () => PIN_THEME_LINE[1])', '&& false) out = out')
  assert.notEqual(noClause, real)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mef-strip-'))
  try {
    fs.writeFileSync(path.join(tmp, 'strip.mjs'), noClause)
    const mutantStrip = await import(`${path.join(tmp, 'strip.mjs')}?m=1`)
    const k = strips.indexOf(stripMdcElementFields), early = strips.findIndex(fn => /stripChatCleanOrder/.test(String(fn.name)) || fn.name === 'stripChatCleanOrder')
    assert.ok(early >= 0 && early < k, 'clean chat order is registered before this change')
    const swapped = strips.map(fn => fn === stripMdcElementFields ? mutantStrip.stripMdcElementFields : fn)
    assert.notEqual(sha(applyAll(swapped.slice(early + 1), rel, read(rel))), sha(applyAll(swapped.slice(early + 1), rel, git('show', `${BASE_COMMIT}:${rel}`))), 'without the clause a consumer before theme sees the taught proof differ from dev\'s')
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
  const noMark = copy(edits); noMark[rel][0][0] = noMark[rel][0][0].replace(MDC_ELEMENT_FIELDS_PIN_MARK, 'LATER-CHANGES: registry read')
  assert.throws(() => pinsSuite(noMark), undefined)
  assert.throws(() => pinsSuite({ ...edits, 'scripts/test-studio-theme-own-choice.mjs': [['a', 'b']] }), /two older files are taught/)
  caughtBy.push(`  ${String(++mutantNumber).padStart(2)}. pins: a wrong previous text, a taught line without the mark, a second proof`)
})
await check('mutant caught: with the executor stripped to the base (no apply) the mapping suite fails, and the base has no apply function', () => {
  const base = baseExecutor()
  assert.equal(base.applyDirectiveElementFields, undefined)
  assert.throws(() => mappingSuite(read(FIELDS), baseText(DIRECTIVE)), undefined, 'a base executor cannot map the fields')
  caughtBy.push(`  ${String(++mutantNumber).padStart(2)}. the fix removed (base executor): the mapping fails`)
})

// ============================================================================================================================================
// 5. Scope over the COMMITTED diff (BASE..head), gate-safe and robust after merge
// ============================================================================================================================================
console.log('5. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
/** A blob object for `text`, written from a temporary FILE with `--no-filters` (never read from standard input: a large input through a pipe once left a git child waiting for ever in another proof's run). */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mef-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = sha1 => git('rev-list', '--parents', '-n', '1', sha1).trim().split(/\s+/).slice(1)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(MDC_ELEMENT_FIELDS_SUBJECT))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits, whether or not dev has moved past BASE) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it, whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const sha1 = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(sha1)
  if (!gateRule || parents.length !== 2) return sha1
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : sha1
}
const REAL = { // what a head is read through: every other registered change (both sides of a comparison), the registered .env.example blocks
  norm: otherStrips, later: laterStrips,
  env: text => registry.stripLaterEnvBlocks('.env.example', text),
}
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
/** `git diff -U0` of the base file against the file at `head`, both read through ctx.norm (every other change's lines out). */
const normDiff = (ctx, rel, head) => git('diff', '-U0', blobOf(ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`))))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  return own
}
const ADDED = { [DIRECTIVE]: 3, [PAGE]: 1 }
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].sort(), [...MDC_ELEMENT_FIELDS_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of MDC_ELEMENT_FIELDS_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, MDC_ELEMENT_FIELDS_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.equal(diff.length, ADDED[rel], `${rel}: the number of added lines`)
    assert.equal(stripMdcElementFields(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of stripModule.MDC_ELEMENT_FIELDS_PIN_FILES) assert.equal(sha(stripMdcElementFields(rel, ctx.later(rel, git('show', `${head}:${rel}`)))), sha(git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: the proof this change taught, put back, is dev's`)
  for (const rel of MDC_ELEMENT_FIELDS_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of [ICON_FORM, SHAPE_FORM, 'lib/chat-element-refine.ts', 'types/textlabs.ts', CLIENT, 'hooks/use-textlabs-generation.ts']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(MDC_ELEMENT_FIELDS_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${MDC_ELEMENT_FIELDS_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-mdc-element-fields-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['MDC_ELEMENT_FIELDS_SCOPE_FILES', 'MDC_ELEMENT_FIELDS_ENV_BLOCK', 'stripMdcElementFields'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${MDC_ELEMENT_FIELDS_SUBJECT}", found across the whole line, no merges) exist, with the co-author line`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to the executor and the page is a pure insertion that carries the marker; the strip gives the base back byte for byte (other changes\' lines out of both sides)', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of ['scripts/test-studio-mdc-element-fields.mjs', 'scripts/studio-mdc-element-fields-strip.mjs', FIELDS, DIRECTIVE]) assert.doesNotMatch(read(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
// GATE-SAFE: the gate's merge (first parent dev, second parent this change's head; the tree is `git merge-tree --write-tree dev head`) and the whole scope section against it
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE))
  scopeEnvAndRegistry(GATE)
  for (const rel of MDC_ELEMENT_FIELDS_FILES) assert.equal(stripMdcElementFields(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await check('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mef-idx-'))
  try {
    const env = { GIT_INDEX_FILE: path.join(dir, 'index') }
    runGit(['read-tree', parent], env)
    for (const [rel, text] of Object.entries(edits)) runGit(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], env)
    return plumb(['commit-tree', runGit(['write-tree'], env).trim(), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
// a merge onto an ADVANCED dev: a commit on dev after BASE that touches an unrelated file; the gate's first parent is no longer BASE
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await check('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE (an unrelated commit): the scope head is still this change\'s head and the scope section passes; the unrelated commit is not this change\'s concern', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
// a SYNTHETIC change stacked after this one: marked lines in the executor (beside this change's own) and in the page, a registry trio below this change's, an .env.example block, a new file
const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
const syntheticStrip = (rel, text) => (rel === DIRECTIVE || rel === PAGE) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const directive = at(DIRECTIVE).split('\n').flatMap(line => {
    if (line.startsWith('import { mdcElementFieldsPatch }')) return [line, `import { syntheticLater } from '@/lib/synthetic-later' // ${SYN.marker}`]
    if (line.startsWith('export function applyDirectiveElementFields')) return [line, `export const SYNTHETIC_LATER = 1 // ${SYN.marker}`]
    return [line]
  }).join('\n')
  const page = at(PAGE).split('\n').flatMap(line => MDC_ELEMENT_FIELDS_MARKER_RE.test(line) ? [line, `        const syntheticLater = 1 // ${SYN.marker}`] : [line]).join('\n')
  const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('MDC_ELEMENT_FIELDS_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('MDC_ELEMENT_FIELDS_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripMdcElementFields')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  return commitWith(parent, { [DIRECTIVE]: directive, [PAGE]: page, 'scripts/studio-later-changes.mjs': reg, '.env.example': `${at('.env.example')}\n${SYN.block}`, [SYN.file]: 'export const SYNTHETIC_SCOPE_FILES = new Set()\n' }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC = syntheticCommit(HEAD)
const SYN_CTX = {
  norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)), later: (rel, text) => syntheticStrip(rel, laterStrips(rel, text)),
  env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''),
}
await check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked lines beside this change\'s in the executor and the page, a registry trio, an .env.example block, a new file; its own commit has another subject) leaves this change\'s scope section passing, on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  assert.ok(ownOf(SYNTHETIC).length === ownOf(HEAD).length && !ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  for (const rel of MDC_ELEMENT_FIELDS_FILES) assert.equal(stripMdcElementFields(rel, SYN_CTX.norm(rel, git('show', `${gate}:${rel}`))), SYN_CTX.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree is the base's ${rel} without this change's and the later change's lines`)
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its executor lines are unmarked additions, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|number of added lines/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray file in a "MDC element fields:" commit fails the committed-files check (the own commits are found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-mdc-element-fields.txt': 'stray\n' }, `${MDC_ELEMENT_FIELDS_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, and an unmarked line added to the executor or the page in an own commit, fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${MDC_ELEMENT_FIELDS_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  const sneaky = commitWith(HEAD, { [DIRECTIVE]: git('show', `${HEAD}:${DIRECTIVE}`).replace('const BASE = {', 'const sneaky = 1\nconst BASE = {') }, `${MDC_ELEMENT_FIELDS_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/)
  const sneakyPage = commitWith(HEAD, { [PAGE]: git('show', `${HEAD}:${PAGE}`).replace("        if (!formData) {\n          report('failed', `unsupported", "        const sneaky = 1\n        if (!formData) {\n          report('failed', `unsupported") }, `${MDC_ELEMENT_FIELDS_SUBJECT} a sneaky page line${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(sneakyPage), /unmarked added line/)
})

release()
console.log('mutants (each caught by):'); for (const line of caughtBy) console.log(line)
if (realTally) console.log(`mapping equalities (the real run, not the mutants'): ${realTally.labels} labels, ${realTally.icons} icons, ${realTally.shapes} shapes against the real forms; grid ${realTally.grid} rows (${realTally.today} are today's form data, ${realTally.grid - realTally.today} change exactly as the oracle says)`)
console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
