import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

// Count control omitted until touched (flag NEXT_PUBLIC_STUDIO_COUNT_OMIT_UNTOUCHED_ENABLED, default off).
// Mounts the REAL TextBoxForm and MetricsForm (offline stand-ins for React state, no DOM, no network) and
// runs the REAL buildApiPayload + sendMessage against a stub fetch, so the assertions are on what would
// have gone over the wire. The baseline is the same source read from the base commit, so "flag off" is
// compared with what shipped, not with a copy. No sign-in, no model call, no real service.
const BASE = '6d47cae' // studio-v4-dev-preparation-code before this change
const root = new URL('../', import.meta.url)
const nodeRequire = createRequire(import.meta.url)
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const read = path => fs.readFileSync(new URL(path, root), 'utf8')
const atBase = path => execFileSync('git', ['show', `${BASE}:${path}`], { cwd: root.pathname, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let cases = 0
const check = (name, fn) => { fn(); cases++; console.log(`PASS ${name}`) }
const acheck = async (name, fn) => { await fn(); cases++; console.log(`PASS ${name}`) }
const transpile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText

// ---------------------------------------------------------------- module loader (real files, one env per load)
function loader({ env, sourceRef, stubs = {}, globals = {} }) {
  const cache = new Map()
  const resolveAlias = id => {
    const base = id.slice(2)
    for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) if (fs.existsSync(new URL(base + suffix, root))) return new URL(base + suffix, root).pathname
    throw new Error(`cannot resolve ${id}`)
  }
  function load(path, override) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }
    cache.set(path, module.exports)
    vm.runInNewContext(transpile(override ?? fs.readFileSync(path, 'utf8')), {
      module, exports: module.exports, React, console, AbortController, DOMException, Error, TypeError, setTimeout, clearTimeout, FormData, URL,
      process: { env }, ...globals,
      require: id => id in stubs ? stubs[id] : id.endsWith('.css') ? {} : id.startsWith('@/') ? load(resolveAlias(id)) : nodeRequire(id),
    })
    cache.set(path, module.exports)
    return module.exports
  }
  return (relativePath, useBase = false) => load(new URL(relativePath, root).pathname, useBase && sourceRef ? atBase(relativePath) : undefined)
}

// ---------------------------------------------------------------- helper module
const helperEnv = env => loader({ env })('lib/studio-count-omit.ts')
const helpers = helperEnv({})
for (const [shell, flag, expected] of [
  [undefined, undefined, false], ['true', undefined, false], ['true', 'false', false], ['true', '1', false], ['true', 'TRUE', false], ['true', ' true', false],
  ['false', 'true', false], [undefined, 'true', false], ['true', 'true', true],
]) {
  check(`flag ${shell}/${flag}`, () => {
    assert.equal(helpers.studioCountOmitUntouchedFlagOn(shell, flag), expected)
    assert.equal(helperEnv({ NEXT_PUBLIC_STUDIO_V4_SHELL: shell, NEXT_PUBLIC_STUDIO_COUNT_OMIT_UNTOUCHED_ENABLED: flag }).STUDIO_COUNT_OMIT_UNTOUCHED_ENABLED, expected)
  })
}
check('unset env is OFF', () => assert.equal(helpers.STUDIO_COUNT_OMIT_UNTOUCHED_ENABLED, false))
check('helper module is import-free', () => {
  const source = read('lib/studio-count-omit.ts')
  assert.ok(!/^\s*import\s/m.test(source) && !/\brequire\(/.test(source))
})
check('shouldOmitUntouchedCount: only flag on + eligible + untouched + count 1', () => {
  const cases = []
  for (const flagOn of [false, true]) for (const eligible of [false, true]) for (const touched of [false, true]) for (const count of [1, 2, 6]) cases.push({ flagOn, eligible, touched, count })
  assert.equal(cases.length, 24)
  for (const input of cases) assert.equal(helpers.shouldOmitUntouchedCount(input), input.flagOn && input.eligible && !input.touched && input.count === 1, JSON.stringify(input))
})
check('restoredCountTouched: an explicit mark wins, else any count above 1 was chosen', () => {
  assert.equal(helpers.restoredCountTouched(1, undefined), false)
  assert.equal(helpers.restoredCountTouched(undefined, undefined), false)
  assert.equal(helpers.restoredCountTouched(null, null), false)
  assert.equal(helpers.restoredCountTouched(2, undefined), true)
  assert.equal(helpers.restoredCountTouched(4, false), false)
  assert.equal(helpers.restoredCountTouched(1, true), true)
  assert.equal(helpers.restoredCountTouched(1, 'true'), false, 'only a real boolean is a mark')
})
check('applyCountTouchState: flag off returns the very same object', () => {
  for (const form of [{ componentType: 'METRICS', count: 1 }, { componentType: 'TEXT_BOX', count: 1, structure: 'SEQUENTIAL', generationConfig: { count: 1 } }]) {
    for (const touched of [false, true]) assert.equal(helpers.applyCountTouchState(form, false, touched), form)
  }
})
check('applyCountTouchState: marks only an untouched METRICS or structured TEXT_BOX at count 1', () => {
  const marked = form => helpers.applyCountTouchState(form, true, false).countOmitted === true
  assert.equal(marked({ componentType: 'METRICS', count: 1 }), true)
  assert.equal(marked({ componentType: 'TEXT_BOX', count: 1, structure: 'SEQUENTIAL' }), true)
  assert.equal(marked({ componentType: 'TEXT_BOX', count: 1, structure: 'classic' }), true)
  assert.equal(marked({ componentType: 'TEXT_BOX', count: 1 }), false, 'plain body box has no structure on its form')
  assert.equal(marked({ componentType: 'TEXT_BOX', count: 1, structure: 'auto' }), false)
  assert.equal(marked({ componentType: 'TEXT_BOX', count: 3, structure: 'SEQUENTIAL' }), false)
  assert.equal(marked({ componentType: 'METRICS', count: 2 }), false)
  assert.equal(marked({ componentType: 'IMAGE', count: 1, structure: 'SEQUENTIAL' }), false, 'the Logo branch is an image form')
  assert.equal(marked({ componentType: 'TABLE', count: 1 }), false)
})
check('applyCountTouchState: a touched Count is never marked omitted and writes the mark into the saved config only', () => {
  const touched = helpers.applyCountTouchState({ componentType: 'METRICS', count: 1, generationConfig: { count: 1, prompt: 'x' } }, true, true)
  assert.equal('countOmitted' in touched, false)
  assert.deepEqual(JSON.parse(JSON.stringify(touched.generationConfig)), { count: 1, prompt: 'x', countTouched: true })
  const noConfig = { componentType: 'TEXT_BOX', count: 1, structure: 'SEQUENTIAL' }
  assert.equal(helpers.applyCountTouchState(noConfig, true, true), noConfig)
  const logo = { componentType: 'IMAGE', count: 1, generationConfig: { count: 1 } }
  assert.equal(helpers.applyCountTouchState(logo, true, true), logo)
  const original = { count: 1 }
  helpers.applyCountTouchState({ componentType: 'METRICS', count: 1, generationConfig: original }, true, true)
  assert.deepEqual(original, { count: 1 }, 'the caller\'s config object is not mutated')
})
check('requestCountOmitted: flag, the form mark, never a refine', () => {
  assert.equal(helpers.requestCountOmitted(true, { countOmitted: true }), true)
  assert.equal(helpers.requestCountOmitted(false, { countOmitted: true }), false)
  assert.equal(helpers.requestCountOmitted(true, {}), false)
  assert.equal(helpers.requestCountOmitted(true, { countOmitted: false }), false)
  assert.equal(helpers.requestCountOmitted(true, { countOmitted: true, refine: true }), false)
  assert.equal(helpers.requestCountOmitted(true, { countOmitted: true, refine: false }), true)
})

// ---------------------------------------------------------------- the real forms (offline React)
function formHarness(kind, { sourceRef, shell, flag }) {
  const file = `components/generation-panel/forms/${kind === 'metrics' ? 'metrics' : 'text-box'}-form.tsx`
  const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: shell, NEXT_PUBLIC_STUDIO_COUNT_OMIT_UNTOUCHED_ENABLED: flag }
  const states = [], refs = [], effects = [], submitted = [], drafts = [], registered = [], mandatory = []
  let cursor = 0, refCursor = 0, theme = { mode: 'deck', overrides: null }, themeInitialized = false
  const fakeReact = { ...React,
    useState(value) { const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] },
    useRef(value) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: value }; return refs[i] },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  }
  const empty = () => null
  const stubs = {
    react: fakeReact, 'lucide-react': new Proxy({}, { get: () => empty }),
    '../shared/collapsible-section': { CollapsibleSection: ({ children }) => children },
    '../shared/font-override-section': { FontOverrideSection: empty }, '../shared/position-presets': { PositionPresets: empty }, '../shared/toggle-row': { ToggleRow: empty },
    '../shared/z-index-input': { ZIndexInput: empty }, '../shared/padding-control': { PaddingControl: empty }, '../shared/theme-source-selector': { ThemeSourceSelector: empty },
    '@/hooks/use-deck-theme-palette': { useDeckThemePalette: () => ({ tokens: [] }) },
    '../shared/use-theme-source-state': { useThemeSourceState: (_, initial) => { if (!themeInitialized) { theme = initial ?? theme; themeInitialized = true } return { themeSource: theme, updateThemeSource: value => { theme = value }, useDeckTheme: theme.mode === 'deck', themeOverrides: theme.overrides } } },
  }
  const mod = loader({ env, sourceRef, stubs, globals: { React: fakeReact } })(file, true)
  const component = mod[kind === 'metrics' ? 'MetricsForm' : 'TextBoxForm']
  const render = extra => {
    cursor = 0; refCursor = 0; effects.length = 0
    return component({
      slotCatalog: { slots: [] }, slotCatalogLoading: false, prompt: '', showAdvanced: true, presentationId: 'offline-deck', isGenerating: false,
      registerMandatoryConfig: value => mandatory.push(value), registerSubmit: fn => registered.push(fn), onSubmit: value => submitted.push(value), onDraftChange: value => drafts.push(value), ...extra,
    })
  }
  const effect = fragment => { const fn = effects.find(item => item.toString().includes(fragment)); assert.ok(fn, fragment); fn() }
  return {
    render, effect,
    submit() { effect('registerSubmit'); registered.at(-1)(); return submitted.at(-1) },
    report() { effect(kind === 'metrics' ? 'metricsControls:' : 'textBoxControls:'); return drafts.at(-1) ?? null },
    picker() { effect('registerMandatoryConfig({'); return mandatory.at(-1) },
  }
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return tree
  for (const child of React.Children.toArray(tree.props?.children)) { const found = find(child, predicate); if (found) return found }
  return null
}
const control = (tree, label) => { const node = find(tree, n => n.props?.['aria-label'] === label); assert.ok(node, label); return node.props }

const catalog = { slots: [
  { slot_name: 'body', role: 'BODY_TEXT', kind: 'body', label: 'Body', supported: true },
  { slot_name: 'slide_title', role: 'SLIDE_TITLE', kind: 'structural', label: 'Title', supported: true },
] }
const draftWith = (controls, kind = 'text') => ({ prompt: 'Five rollout steps', showAdvanced: true, [kind === 'text' ? 'textBoxControls' : 'metricsControls']: controls })

// A scenario drives the form the way a user does: set the prompt, touch controls, press Generate.
const textBoxScenarios = {
  'plain body, untouched': { prompt: 'Three key adoption risks, one sentence each' },
  'structured (Sequential), untouched': { prompt: 'Five rollout steps for the migration', steps: [t => control(t, 'Body structure').onChange({ target: { value: 'SEQUENTIAL' } })] },
  'structured (Classic), untouched': { prompt: 'Four customer benefits', steps: [t => control(t, 'Body structure').onChange({ target: { value: 'classic' } })] },
  'structured, Count touched to 1': { prompt: 'Five rollout steps', steps: [t => control(t, 'Body structure').onChange({ target: { value: 'SEQUENTIAL' } }), t => control(t, 'Text box count').onChange({ target: { value: '1' } })] },
  'structured, Count touched to 3': { prompt: 'Five rollout steps', steps: [t => control(t, 'Body structure').onChange({ target: { value: 'SEQUENTIAL' } }), t => control(t, 'Text box count').onChange({ target: { value: '3' } })] },
  'structured, Count raised to 3 and put back to 1': { prompt: 'Five rollout steps', steps: [t => control(t, 'Body structure').onChange({ target: { value: 'SEQUENTIAL' } }), t => control(t, 'Text box count').onChange({ target: { value: '3' } }), t => control(t, 'Text box count').onChange({ target: { value: '1' } })] },
  'plain body, Count touched to 3': { prompt: 'Four customer benefits', steps: [t => control(t, 'Text box count').onChange({ target: { value: '3' } })] },
  'structured, Count touched before the structure is chosen': { prompt: 'Five rollout steps', steps: [t => control(t, 'Text box count').onChange({ target: { value: '1' } }), t => control(t, 'Body structure').onChange({ target: { value: 'SEQUENTIAL' } })] },
  'title slot (not a body box), untouched': { prompt: 'Rollout', props: { slotCatalog: catalog }, role: 'slot:slide_title' },
  'title slot after a structure was chosen, untouched': { prompt: 'Rollout', props: { slotCatalog: catalog }, steps: [t => control(t, 'Body structure').onChange({ target: { value: 'SEQUENTIAL' } })], roleAfterSteps: 'slot:slide_title' },
  'structured, restored from a draft with Count 3 (no mark)': { prompt: 'Five rollout steps', props: { initialDraft: draftWith({ targetValue: '__body_text_auto__', structure: 'SEQUENTIAL', count: 3, layoutChoice: 'auto', gridCols: 2, multiBoxColorMode: 'SAME', textboxOverrides: {}, geometryMode: 'AUTO', manualGeometryOverrides: {}, zIndex: 1000, positionModified: false, paddingModified: false, paddingConfig: { top: 0, right: 0, bottom: 0, left: 0 }, sections: {} }) } },
  'structured, restored from a draft with Count 1 (no mark)': { prompt: 'Five rollout steps', props: { initialDraft: draftWith({ targetValue: '__body_text_auto__', structure: 'SEQUENTIAL', count: 1, layoutChoice: 'auto', gridCols: 2, multiBoxColorMode: 'SAME', textboxOverrides: {}, geometryMode: 'AUTO', manualGeometryOverrides: {}, zIndex: 1000, positionModified: false, paddingModified: false, paddingConfig: { top: 0, right: 0, bottom: 0, left: 0 }, sections: {} }) } },
  'structured, restored from a draft with Count 1 marked touched': { prompt: 'Five rollout steps', props: { initialDraft: draftWith({ targetValue: '__body_text_auto__', structure: 'SEQUENTIAL', count: 1, countTouched: true, layoutChoice: 'auto', gridCols: 2, multiBoxColorMode: 'SAME', textboxOverrides: {}, geometryMode: 'AUTO', manualGeometryOverrides: {}, zIndex: 1000, positionModified: false, paddingModified: false, paddingConfig: { top: 0, right: 0, bottom: 0, left: 0 }, sections: {} }) } },
  'structured, restored from a saved config with count 2': { prompt: 'Five rollout steps', props: { existingTextTarget: { elementId: 'text-A', generationConfig: { prompt: 'Five rollout steps', structure: 'classic', count: 2 } } } },
  'structured, restored from a saved config with count 1': { prompt: 'Five rollout steps', props: { existingTextTarget: { elementId: 'text-A', generationConfig: { prompt: 'Five rollout steps', structure: 'SEQUENTIAL', count: 1 } } } },
  'structured, restored from a saved config with count 1 marked touched': { prompt: 'Five rollout steps', props: { existingTextTarget: { elementId: 'text-A', generationConfig: { prompt: 'Five rollout steps', structure: 'SEQUENTIAL', count: 1, countTouched: true } } } },
}
const metricsScenarios = {
  'metrics, untouched': { prompt: '4 KPIs: +15 pts, -30%, -12%, -8%' },
  'metrics, Count touched to 1': { prompt: '4 KPIs', steps: [t => control(t, 'Metric count').onChange({ target: { value: '1' } })] },
  'metrics, Count touched to 3': { prompt: '4 KPIs', steps: [t => control(t, 'Metric count').onChange({ target: { value: '3' } })] },
  'metrics, Count raised to 4 and put back to 1': { prompt: '4 KPIs', steps: [t => control(t, 'Metric count').onChange({ target: { value: '4' } }), t => control(t, 'Metric count').onChange({ target: { value: '1' } })] },
  'metrics, advanced Count touched to 2': { prompt: '4 KPIs', steps: [t => control(t, 'Advanced metric count').onChange({ target: { value: '2' } })] },
  'metrics, restored from a draft with Count 3 (no mark)': { prompt: '4 KPIs', props: { initialDraft: draftWith({ count: 3, layoutChoice: 'auto', multiBoxColorMode: 'SAME', visualOverrides: {}, fitMode: 'AUTO', manualOverrides: {}, positionModified: false, geometryEdited: false, geometryContext: null, paddingModified: false, zIndex: 1000, positionConfig: { start_col: 2, start_row: 4, position_width: 20, position_height: 8, auto_position: false }, paddingConfig: { top: 0, right: 0, bottom: 0, left: 0 }, sections: {} }, 'metrics') } },
  'metrics, restored from a draft with Count 1 (no mark)': { prompt: '4 KPIs', props: { initialDraft: draftWith({ count: 1, layoutChoice: 'auto', multiBoxColorMode: 'SAME', visualOverrides: {}, fitMode: 'AUTO', manualOverrides: {}, positionModified: false, geometryEdited: false, geometryContext: null, paddingModified: false, zIndex: 1000, positionConfig: { start_col: 2, start_row: 4, position_width: 20, position_height: 8, auto_position: false }, paddingConfig: { top: 0, right: 0, bottom: 0, left: 0 }, sections: {} }, 'metrics') } },
  'metrics, restored from a draft with Count 1 marked touched': { prompt: '4 KPIs', props: { initialDraft: draftWith({ count: 1, countTouched: true, layoutChoice: 'auto', multiBoxColorMode: 'SAME', visualOverrides: {}, fitMode: 'AUTO', manualOverrides: {}, positionModified: false, geometryEdited: false, geometryContext: null, paddingModified: false, zIndex: 1000, positionConfig: { start_col: 2, start_row: 4, position_width: 20, position_height: 8, auto_position: false }, paddingConfig: { top: 0, right: 0, bottom: 0, left: 0 }, sections: {} }, 'metrics') } },
  'metrics, restored from a saved config with count 2': { prompt: '4 KPIs', props: { existingTextTarget: { elementId: 'metric-A', generationConfig: { componentType: 'METRICS', count: 2 } } } },
  'metrics, restored from a saved config with count 1': { prompt: '4 KPIs', props: { existingTextTarget: { elementId: 'metric-A', generationConfig: { componentType: 'METRICS', count: 1 } } } },
  'metrics, restored from a saved config with count 1 marked touched': { prompt: '4 KPIs', props: { existingTextTarget: { elementId: 'metric-A', generationConfig: { componentType: 'METRICS', count: 1, countTouched: true } } } },
}

function runScenario(kind, config, scenario) {
  const h = formHarness(kind, config)
  const props = { prompt: scenario.prompt, ...scenario.props }
  let tree = h.render(props)
  if (scenario.role) { h.render(props); h.picker().onChange(scenario.role); tree = h.render(props) }
  for (const step of scenario.steps ?? []) { step(tree); tree = h.render(props) }
  if (scenario.roleAfterSteps) { h.render(props); h.picker().onChange(scenario.roleAfterSteps); tree = h.render(props) }
  return { formData: copy(h.submit()), draft: copy(h.report()) }
}
const CONFIGS = {
  base: { sourceRef: BASE, shell: 'true', flag: undefined },
  off: { shell: 'true', flag: undefined },
  offFalse: { shell: 'true', flag: 'false' },
  on: { shell: 'true', flag: 'true' },
}
const run = {}
for (const [kind, scenarios] of [['text', textBoxScenarios], ['metrics', metricsScenarios]]) {
  for (const [name, scenario] of Object.entries(scenarios)) {
    run[name] = { kind }
    for (const [label, config] of Object.entries(CONFIGS)) run[name][label] = runScenario(kind, config, scenario)
  }
}
const stripMarks = value => {
  const out = copy(value)
  if (out.formData) {
    delete out.formData.countOmitted
    if (out.formData.generationConfig) delete out.formData.generationConfig.countTouched
  }
  if (out.draft?.textBoxControls) delete out.draft.textBoxControls.countTouched
  if (out.draft?.metricsControls) delete out.draft.metricsControls.countTouched
  return out
}

// The untouched structured or metrics cases, by name: these are the ones the flag changes on the wire.
const OMITTED = new Set([
  'structured (Sequential), untouched', 'structured (Classic), untouched', 'structured, restored from a draft with Count 1 (no mark)',
  'structured, restored from a saved config with count 1', 'metrics, untouched', 'metrics, restored from a draft with Count 1 (no mark)', 'metrics, restored from a saved config with count 1',
])
const TOUCHED_BUT_ONE = ['structured, Count touched to 1', 'structured, Count raised to 3 and put back to 1', 'structured, Count touched before the structure is chosen',
  'structured, restored from a draft with Count 1 marked touched', 'structured, restored from a saved config with count 1 marked touched',
  'metrics, Count touched to 1', 'metrics, Count raised to 4 and put back to 1', 'metrics, restored from a draft with Count 1 marked touched', 'metrics, restored from a saved config with count 1 marked touched']

check('every scenario is classified: omitted, touched-at-1, or sends a count above 1 / a non-eligible box', () => {
  assert.equal(Object.keys(run).length, Object.keys(textBoxScenarios).length + Object.keys(metricsScenarios).length)
  for (const name of OMITTED) assert.ok(run[name], name)
  for (const name of TOUCHED_BUT_ONE) assert.ok(run[name], name)
})
for (const name of Object.keys(run)) {
  check(`flag off = base, byte for byte (form data and cached draft): ${name}`, () => {
    for (const label of ['off', 'offFalse']) {
      assert.deepEqual(run[name][label], run[name].base, `${label}: ${name}`)
      assert.equal(sha(run[name][label]), sha(run[name].base))
      assert.ok(!('countOmitted' in run[name][label].formData), 'flag off never marks the form')
      assert.ok(!JSON.stringify(run[name][label]).includes('countTouched'), 'flag off never writes the touched mark')
    }
  })
  check(`flag on changes nothing else (form data and draft, apart from the count marks): ${name}`, () => {
    assert.deepEqual(stripMarks(run[name].on), stripMarks(run[name].base), name)
    assert.equal(run[name].on.formData.count, run[name].base.formData.count, 'the local count (compose, elements, layout) is what it was')
    assert.equal(run[name].on.formData.compose, run[name].base.formData.compose)
    assert.deepEqual(run[name].on.formData.elements, run[name].base.formData.elements)
    assert.equal(run[name].on.formData.layout, run[name].base.formData.layout)
  })
  check(`flag on marks the form exactly when the Count was untouched and the box can take the prompt's count: ${name}`, () => {
    assert.equal(run[name].on.formData.countOmitted === true, OMITTED.has(name), name)
    if (!OMITTED.has(name)) assert.ok(!('countOmitted' in run[name].on.formData))
  })
}
check('an omitted form still carries count 1 locally and never composes', () => {
  for (const name of OMITTED) {
    const { formData } = run[name].on
    assert.equal(formData.count, 1)
    assert.ok(!formData.compose && formData.elements === undefined, name)
  }
})
check('plain body text box keeps sending count 1 (Text Labs reads its bullet count from the prompt)', () => {
  assert.equal(run['plain body, untouched'].on.formData.count, 1)
  assert.ok(!('countOmitted' in run['plain body, untouched'].on.formData))
})
check('a title slot is never omitted, even with a structure chosen before the role changed', () => {
  for (const name of ['title slot (not a body box), untouched', 'title slot after a structure was chosen, untouched']) {
    assert.ok(!('countOmitted' in run[name].on.formData), name)
    assert.equal(run[name].on.formData.semanticRole, 'SLIDE_TITLE')
    assert.equal(run[name].on.formData.count, 1)
  }
})
check('touched Counts above 1 are sent exactly as before, and compose as before', () => {
  for (const [name, count] of [['structured, Count touched to 3', 3], ['plain body, Count touched to 3', 3], ['structured, restored from a draft with Count 3 (no mark)', 3],
    ['structured, restored from a saved config with count 2', 2], ['metrics, Count touched to 3', 3], ['metrics, advanced Count touched to 2', 2],
    ['metrics, restored from a draft with Count 3 (no mark)', 3], ['metrics, restored from a saved config with count 2', 2]]) {
    const { formData } = run[name].on
    assert.equal(formData.count, count, name)
    assert.equal(formData.compose, true, name)
    assert.equal(formData.elements.length, count, name)
    assert.ok(!('countOmitted' in formData), name)
  }
})
check('the touched mark rides along when flag on: cached draft and saved generation config', () => {
  assert.equal(run['structured (Sequential), untouched'].on.draft.textBoxControls.countTouched, false)
  assert.equal(run['structured, Count touched to 1'].on.draft.textBoxControls.countTouched, true)
  assert.equal(run['structured, Count touched to 1'].on.formData.generationConfig.countTouched, true)
  assert.ok(!('countTouched' in run['structured (Sequential), untouched'].on.formData.generationConfig), 'untouched writes no mark')
  assert.equal(run['metrics, Count touched to 1'].on.draft.metricsControls.countTouched, true)
  assert.equal(run['metrics, Count touched to 1'].on.formData.generationConfig.countTouched, true)
  assert.ok(!('countTouched' in run['metrics, untouched'].on.formData.generationConfig))
})
check('a draft written by the flagged form and restored by it keeps the Count touched (round trip)', () => {
  for (const [kind, name] of [['text', 'structured, Count touched to 1'], ['metrics', 'metrics, Count touched to 1']]) {
    const key = kind === 'text' ? 'textBoxControls' : 'metricsControls'
    const written = run[name].on.draft
    const h = formHarness(kind, CONFIGS.on)
    h.render({ prompt: written.prompt, initialDraft: written })
    assert.equal(h.submit().countOmitted, undefined, `${name}: restored touched Count stays sent`)
    assert.equal(written[key].countTouched, true)
  }
})
check('without Studio shell the count flag is inert (default render equals base)', () => {
  for (const [kind, scenario] of [['text', { prompt: 'Five rollout steps' }], ['metrics', { prompt: '4 KPIs' }]]) {
    const base = runScenario(kind, { sourceRef: BASE, shell: undefined, flag: undefined }, scenario)
    const on = runScenario(kind, { shell: undefined, flag: 'true' }, scenario)
    assert.deepEqual(on, base)
    assert.ok(!('countOmitted' in on.formData))
  }
})

// ---------------------------------------------------------------- the real wire (buildApiPayload + sendMessage, stub fetch)
function client({ sourceRef, shell, flag }) {
  const calls = []
  const fetchStub = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200, json: async () => ({ success: true }) } }
  const mod = loader({
    env: { NEXT_PUBLIC_STUDIO_V4_SHELL: shell, NEXT_PUBLIC_STUDIO_COUNT_OMIT_UNTOUCHED_ENABLED: flag, NEXT_PUBLIC_ELEMENTOR_URL: 'http://127.0.0.1:9' },
    sourceRef, globals: { fetch: fetchStub },
  })('lib/textlabs-client.ts', true)
  return {
    async wire(formData) {
      calls.length = 0
      const { sessionId, message, options } = mod.buildApiPayload('offline-session', formData)
      await mod.sendMessage(sessionId, message, options)
      assert.equal(calls.length, 1)
      assert.equal(calls[0].url, 'http://127.0.0.1:9/api/chat/message')
      return calls[0].body
    },
  }
}
const clients = { base: client(CONFIGS.base), off: client(CONFIGS.off), on: client(CONFIGS.on) }
const wires = {}
await (async () => {
  for (const name of Object.keys(run)) {
    wires[name] = {
      base: await clients.base.wire(copy(run[name].base.formData)),
      off: await clients.off.wire(copy(run[name].off.formData)),
      on: await clients.on.wire(copy(run[name].on.formData)),
    }
  }
})()
for (const name of Object.keys(run)) {
  await acheck(`wire, flag off: request body is byte-identical to base: ${name}`, async () => {
    assert.deepEqual(wires[name].off, wires[name].base)
    assert.equal(sha(wires[name].off), sha(wires[name].base))
    assert.ok('count' in wires[name].off, 'flag off always sends count')
  })
  await acheck(`wire, flag on: count is left out exactly when untouched; everything else is unchanged: ${name}`, async () => {
    const on = wires[name].on, base = wires[name].base
    if (OMITTED.has(name)) {
      assert.equal(base.count, 1)
      assert.ok(!('count' in on), 'untouched Count must not be on the wire')
      const { count, ...rest } = base
      assert.deepEqual(on, rest, 'every other field of the request is identical to base')
    } else {
      assert.deepEqual(on, base, 'a touched Count (or a box that cannot take the prompt count) is sent exactly as before')
      assert.ok('count' in on)
    }
  })
}
await acheck('wire: the stated count then reaches Text Labs as no `count` key at all (not 0, null or undefined text)', async () => {
  const body = await clients.on.wire(copy(run['structured (Sequential), untouched'].on.formData))
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'count'), false)
  assert.equal(body.component_type ?? body.componentType, 'TEXT_BOX')
  assert.equal(body.message, 'Five rollout steps for the migration')
  const metrics = await clients.on.wire(copy(run['metrics, untouched'].on.formData))
  assert.equal(Object.prototype.hasOwnProperty.call(metrics, 'count'), false)
  assert.equal(metrics.message, '4 KPIs: +15 pts, -30%, -12%, -8%')
})
await acheck('wire: a refine always keeps count 1, even if a form were marked', async () => {
  const marked = { ...copy(run['metrics, untouched'].on.formData), refine: true }
  assert.equal(marked.countOmitted, true)
  assert.equal((await clients.on.wire(marked)).count, 1)
  const markedText = { ...copy(run['structured (Sequential), untouched'].on.formData), refine: true }
  assert.equal((await clients.on.wire(markedText)).count, 1)
})
await acheck('wire: with the flag off, a stray mark on the form (stale draft, other build) cannot drop count', async () => {
  const stray = { ...copy(run['metrics, untouched'].base.formData), countOmitted: true }
  const body = await clients.off.wire(stray)
  assert.equal(body.count, 1)
  assert.deepEqual(body, wires['metrics, untouched'].base)
})
await acheck('wire: other component types never carry the mark and keep their count', async () => {
  const table = { componentType: 'TABLE', prompt: 'Roadmap', count: 1, layout: 'horizontal', advancedModified: false, tableConfig: { structure_mode: 'AUTO' } }
  const a = await clients.base.wire(copy(table)), b = await clients.on.wire(copy(table))
  assert.deepEqual(b, a)
  assert.equal(b.count, 1)
})

// ---------------------------------------------------------------- what is NOT touched
function printedDeclaration(source, name) {
  const ast = ts.createSourceFile('form.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node; ts.forEachChild(node, visit) }
  visit(ast)
  assert.ok(found, name)
  return ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, found, ast)
}
check('handleSubmit and generationConfig of both forms are textually identical to base (their mapping is untouched)', () => {
  for (const file of ['components/generation-panel/forms/text-box-form.tsx', 'components/generation-panel/forms/metrics-form.tsx']) {
    for (const name of ['handleSubmit', 'generationConfig', 'resolvedLayout']) {
      assert.equal(printedDeclaration(read(file), name), printedDeclaration(atBase(file), name), `${file} ${name}`)
    }
  }
})
check('the generation hook, Builder page and Text Labs transport are byte-identical to base (local count 1 drives every client rule)', () => {
  for (const path of ['hooks/use-textlabs-generation.ts', 'app/builder/page.tsx', 'lib/metrics-layout.ts', 'lib/textbox-layout.ts', 'components/generation-panel/index.tsx']) {
    assert.equal(sha(read(path)), sha(atBase(path)), `${path} must not change`)
  }
})
check('buildApiPayload differs from base only by the count line (flag-gated, import-free helper)', () => {
  const now = read('lib/textlabs-client.ts').split('\n'), was = atBase('lib/textlabs-client.ts').split('\n')
  const added = now.filter(line => !was.includes(line)), removed = was.filter(line => !now.includes(line))
  assert.deepEqual(removed, ['    count,'])
  assert.ok(added.some(line => line.includes("import { STUDIO_COUNT_OMIT_UNTOUCHED_ENABLED, requestCountOmitted } from '@/lib/studio-count-omit'")))
  assert.ok(added.some(line => line.includes('count: requestCountOmitted(STUDIO_COUNT_OMIT_UNTOUCHED_ENABLED, formData) ? undefined : count,')))
  assert.equal(added.filter(line => !line.trim().startsWith('//') && !line.includes('studio-count-omit') && !line.includes('requestCountOmitted(')).length, 0, added.join('\n'))
})
check('the Count controls keep their visible default and options (no new UI)', () => {
  const text = read('components/generation-panel/forms/text-box-form.tsx'), metrics = read('components/generation-panel/forms/metrics-form.tsx')
  assert.ok(text.includes('Array.from({ length: 6 }, (_, index) => index + 1).map(value => ('))
  assert.ok(metrics.includes('{[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}'))
  for (const [file, source] of [['text-box-form', text], ['metrics-form', metrics]]) {
    assert.ok(!/\bAuto\b.*count/i.test(source.split('\n').filter(l => l.includes('Count')).join('\n')), `${file}: no "Auto" Count option added`)
  }
})

const digest = label => sha(Object.keys(run).map(name => wires[name][label]))
console.log(`\nrequest-body digest over ${Object.keys(run).length} scenarios: base ${digest('base').slice(0, 16)}  flag off ${digest('off').slice(0, 16)}  flag on ${digest('on').slice(0, 16)}`)
assert.equal(digest('off'), digest('base'))
assert.notEqual(digest('on'), digest('base'), 'flag on must differ from base (only the omitted counts)')
console.log(`${cases} cases passed`)
