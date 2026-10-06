import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url), root = new URL('../', import.meta.url)
const file = 'components/generation-panel/forms/diagram-form.tsx'
const current = fs.readFileSync(new URL(file, root), 'utf8')
const previous = execFileSync('git', ['show', '3734f0f:' + file], { cwd: root, encoding: 'utf8' })
const copy = value => JSON.parse(JSON.stringify(value))
let checks = 0
function callback(source, name) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node; ts.forEachChild(node, visit) }
  visit(ast)
  assert.ok(found)
  return ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, found, ast)
}
for (const name of ['handleSubmit', 'buildDiagramConfig', 'selectSubtype']) {
  assert.equal(callback(current, name), callback(previous, name), `${name} remains exact, including guards/tombstones/strict envelope`); checks++
}
function harness({ studio = true, old = false } = {}) {
  const states = [], refs = [], effects = [], submitted = [], drafts = [], registered = [], mandatory = [], cache = new Map()
  let cursor = 0, refCursor = 0, theme = { mode: 'none', overrides: null }
  const fakeReact = { ...React,
    useState(value) { const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(value) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: value }; return refs[i] },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  }
  const empty = () => null
  const stubs = { react: fakeReact,
    '../shared/toggle-row': { ToggleRow: empty }, '../shared/z-index-input': { ZIndexInput: empty },
    '../shared/theme-source-selector': { ThemeSourceSelector: empty },
    '../shared/use-theme-source-state': { useThemeSourceState: (_, initial) => { if (initial && !refs.length) theme = initial; return { themeSource: theme, updateThemeSource: value => { theme = value }, useDeckTheme: theme.mode === 'deck', themeOverrides: theme.overrides } } },
  }
  function load(path, override) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }
    const result = ts.transpileModule(override ?? fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } })
    vm.runInNewContext(result.outputText, { module, exports: module.exports, React: fakeReact, console, AbortController, fetch, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } }, require: id => id in stubs ? stubs[id] : id.endsWith('.css') ? {} : id.startsWith('@/') ? load(new URL(id.slice(2) + '.ts', root).pathname) : require(id) })
    cache.set(path, module.exports); return module.exports
  }
  const mod = load(new URL(file, root).pathname, old ? previous : current)
  const catalog = load(new URL('lib/diagram-catalog.ts', root).pathname).DIAGRAM_CATALOG_FALLBACK
  function render(extra = {}) {
    cursor = 0; refCursor = 0; effects.length = 0
    return mod.DiagramForm({ prompt: 'Local diagram prompt', showAdvanced: true, presentationId: 'local-fixture', isGenerating: false, registerMandatoryConfig: value => mandatory.push(value), registerSubmit: fn => registered.push(fn), onSubmit: value => submitted.push(copy(value)), onDraftChange: value => drafts.push(copy(value)), ...extra })
  }
  function effect(fragment) { const fn = effects.find(fn => fn.toString().includes(fragment)); assert.ok(fn, fragment); fn() }
  function report() { effect('diagramControls:'); return drafts.at(-1) }
  function submit() { effect('registerSubmit'); registered.at(-1)(); return submitted.at(-1) }
  function picker() { effect('registerMandatoryConfig'); return mandatory.at(-1) }
  return { mod, catalog, render, report, submit, picker, submitted, drafts, effect }
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return tree
  for (const child of React.Children.toArray(tree.props?.children)) { const found = find(child, predicate); if (found) return found }
  return null
}
const field = (tree, label) => { const found = find(tree, node => node.props?.label === label); assert.ok(found, label); return found.props }
const saved = { subtype: 'KANBAN_BOARD', zIndex: 1000, generationConfig: { version: 'diagram_generation_config_v1', diagram_type: 'KANBAN_BOARD', selection_mode: 'manual', settings: { column_count: 3, theme: 'minimal' }, theme_source: 'none' } }
let h = harness(), tree = h.render({ existingDiagramTarget: saved })
field(tree, 'Columns').onChange('5'); field(tree, 'Named renderer theme').onChange('dark')
h.render({ existingDiagramTarget: saved }); const draft = h.report()
assert.equal(draft.diagramControls.columnCount, 5); assert.equal(draft.diagramControls.leafTheme, 'dark')
assert.equal(h.submitted.length, 0); assert.equal(draft.formData, undefined); checks += 4
h = harness(); tree = h.render({ existingDiagramTarget: saved, initialDraft: draft })
assert.equal(field(tree, 'Columns').value, '5'); assert.equal(field(tree, 'Named renderer theme').value, 'dark'); checks += 2
field(tree, 'Columns').onChange('auto'); field(tree, 'Named renderer theme').onChange('auto')
h.render({ existingDiagramTarget: saved, initialDraft: draft }); const autoDraft = h.report()
assert.equal(autoDraft.diagramControls.columnCount, null); assert.equal(autoDraft.diagramControls.leafTheme, 'auto'); checks += 2
h = harness(); h.render({ existingDiagramTarget: saved, initialDraft: autoDraft }); let payload = h.submit()
assert.equal(payload.generationConfig.version, 'diagram_generation_config_v1')
assert.equal(payload.generationConfig.settings.column_count, undefined); assert.equal(payload.generationConfig.settings.theme, undefined)
assert.ok(payload.generationConfig.cleared_settings.includes('column_count')); assert.ok(payload.generationConfig.cleared_settings.includes('theme')); checks += 5
h = harness({ studio: false }); tree = h.render({ existingDiagramTarget: saved, initialDraft: draft }); h.report()
assert.equal(field(tree, 'Columns').value, '3'); assert.equal(h.drafts.length, 0); checks += 2
const cloud = { subtype: 'CLOUD_ARCHITECTURE', generationConfig: { version: 'diagram_generation_config_v1', diagram_type: 'CLOUD_ARCHITECTURE', selection_mode: 'manual', settings: { provider: 'gcp' }, provider_selection: { mode: 'manual', provider: 'gcp', conflict_confirmed: false }, theme_source: 'none' } }
h = harness(); tree = h.render({ existingDiagramTarget: cloud, prompt: 'AWS local draft' }); const conflict = h.report()
assert.equal(conflict.diagramControls.provider, 'gcp'); assert.equal(conflict.diagramControls.providerConflictConfirmationKey, null)
h.submit(); assert.equal(h.submitted.length, 0); checks += 3
const checkbox = find(tree, node => node.type === 'input' && node.props.type === 'checkbox'); assert.ok(checkbox)
checkbox.props.onChange({ target: { checked: true } }); h.render({ existingDiagramTarget: cloud, prompt: 'AWS local draft' })
const confirmed = h.report(); assert.equal(confirmed.diagramControls.providerConflictConfirmationKey, 'gcp:aws'); payload = h.submit()
assert.equal(payload.generationConfig.provider_selection.conflict_confirmed, true); checks += 2
h = harness(); h.render({ existingDiagramTarget: cloud, initialDraft: confirmed, prompt: 'AWS local draft' }); h.effect('setPersistedSourceCode'); h.render({ existingDiagramTarget: cloud, initialDraft: confirmed, prompt: 'AWS local draft' }); assert.equal(h.report().diagramControls.providerConflictConfirmationKey, 'gcp:aws'); assert.equal(h.submit().generationConfig.provider_selection.conflict_confirmed, true); checks += 2
h = harness(); h.render({ existingDiagramTarget: cloud, initialDraft: confirmed, prompt: 'Azure local draft' }); const changed = h.report(); h.submit()
assert.equal(changed.diagramControls.providerConflictConfirmed, false); assert.equal(h.submitted.length, 0); checks += 2
h = harness(); h.render({ existingDiagramTarget: saved, prompt: 'x'.repeat(1201) }); h.picker().onChange('CUSTOM')
tree = h.render({ existingDiagramTarget: saved, prompt: 'x'.repeat(1201) }); field(tree, 'Layout').onChange('network')
h.render({ existingDiagramTarget: saved, prompt: 'x'.repeat(1201) }); const incomplete = h.report(); h.submit()
assert.equal(incomplete.diagramControls.layoutHint, 'network'); assert.equal(h.submitted.length, 0); checks += 2
h = harness(); tree = h.render({ existingDiagramTarget: saved, initialDraft: incomplete, prompt: 'x'.repeat(1201) })
assert.equal(field(tree, 'Layout').value, 'network'); h.submit(); assert.equal(h.submitted.length, 0); checks += 2
h.render({ existingDiagramTarget: saved, initialDraft: incomplete, prompt: 'Valid local draft' }); payload = h.submit()
assert.equal(payload.componentType, 'CUSTOM'); assert.equal(payload.generationConfig.settings.layout_hint, 'network'); checks += 2
// Each existing family and Auto has exactly the prior classic submission data.
for (const subtype of ['DIAGRAM_AUTO', ...h.catalog.types.map(item => item.type)]) {
  const a = harness({ studio: false }), b = harness({ studio: false, old: true })
  for (const instance of [a, b]) { instance.render(); instance.picker().onChange(subtype); instance.render() }
  assert.deepEqual(a.submit(), b.submit(), subtype); checks++
}
const code = { subtype: 'CODE_DISPLAY', generationConfig: { version: 'diagram_generation_config_v1', diagram_type: 'CODE_DISPLAY', selection_mode: 'manual', settings: { language: 'python' }, language_selection: { mode: 'manual', language: 'python' }, source_code: 'print("before")' } }
h = harness(); tree = h.render({ existingDiagramTarget: code }); field(tree, 'Language').onChange('typescript')
h.render({ existingDiagramTarget: { ...code, generationConfig: { ...code.generationConfig, source_code: 'print("latest")' } } }); h.effect('setPersistedSourceCode')
h.render({ existingDiagramTarget: code }); payload = h.submit()
assert.equal(payload.generationConfig.source_code, 'print("latest")'); assert.equal(payload.generationConfig.language_selection.language, 'typescript'); checks += 2
h = harness(); h.render({ prompt: 'Untouched target recipe prompt', showAdvanced: true }); const promptSnapshot = h.report(); assert.equal(promptSnapshot.prompt, 'Untouched target recipe prompt'); assert.equal(promptSnapshot.showAdvanced, true); checks += 2
const router = fs.readFileSync(new URL('components/generation-panel/index.tsx', root), 'utf8')
assert.match(router, /<DiagramForm[\s\S]*initialDraft=\{initialDraft\}\s*onDraftChange=\{onDraftChange\}/); checks++
console.log(`${checks} Diagram draft/guard/classic checks passed; native interaction and connected services require separate proof.`)
