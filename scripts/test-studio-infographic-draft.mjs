import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url), root = new URL('../', import.meta.url)
const file = 'components/generation-panel/forms/infographic-form.tsx'
const current = fs.readFileSync(new URL(file, root), 'utf8')
const previous = execFileSync('git', ['show', 'fe9701f:' + file], { cwd: root, encoding: 'utf8' })
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
for (const name of ['handleSubmit', 'selectDesign', 'selectOperation', 'resetOptionsToAuto', 'updateSegment']) { assert.equal(callback(current, name), callback(previous, name), name + ' is unchanged'); checks++ }
function harness({ studio = true, old = false } = {}) {
  const states = [], refs = [], effects = [], submitted = [], drafts = [], registered = [], mandatory = [], cache = new Map()
  let cursor = 0, refCursor = 0, theme = { mode: 'none', overrides: null }, themeInitialized = false
  const fakeReact = { ...React,
    useState(value) { const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(value) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: value }; return refs[i] },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  }
  const empty = () => null
  const stubs = { react: fakeReact, 'lucide-react': new Proxy({}, { get: () => empty }), '../shared/collapsible-section': { CollapsibleSection: ({ children }) => children },
    '../shared/toggle-row': { ToggleRow: empty }, '../shared/z-index-input': { ZIndexInput: empty },
    '../shared/theme-source-selector': { ThemeSourceSelector: empty },
    '../shared/use-theme-source-state': { useThemeSourceState: (_, initial) => { if (!themeInitialized) { theme = initial ?? theme; themeInitialized = true } return { themeSource: theme, updateThemeSource: value => { theme = value }, useDeckTheme: theme.mode === 'deck', themeOverrides: theme.overrides } } },
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
    return mod.InfographicForm({ prompt: 'Local diagram prompt', showAdvanced: true, panelMode: 'generate', presentationId: 'local-fixture', isGenerating: false, registerMandatoryConfig: value => mandatory.push(value), registerSubmit: fn => registered.push(fn), onSubmit: value => submitted.push(value), onDraftChange: value => drafts.push(value), ...extra })
  }
  function effect(fragment) { const fn = effects.find(fn => fn.toString().includes(fragment)); assert.ok(fn, fragment); fn() }
  function report() { effect('infographicControls:'); return drafts.at(-1) }
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
const buttons = tree => {
  const out = []
  const visit = node => { if (!node || typeof node !== 'object') return; if (node.type === 'button') out.push(node); React.Children.forEach(node.props?.children, visit) }
  visit(tree); return out
}
const words = node => typeof node === 'string' ? node : !node || typeof node !== 'object' ? '' : React.Children.toArray(node.props?.children).map(words).join('')
const button = (tree, name) => { const node = buttons(tree).find(node => words(node) === name); assert.ok(node, name); return node.props }
const input = (tree, name) => { const node = find(tree, node => node.props?.['aria-label'] === name); assert.ok(node, name); return node.props }
const structured = { panelMode: 'refine', existingTarget: { elementId: 'A', mode: 'v2', rendererType: 'diagram', generationConfig: { mode: 'v2' } } }
let h = harness(), tree = h.render(structured); h.effect('hydratedTargetRef.current'); tree = h.render(structured)
assert.equal(input(tree, 'Locked infographic design').children[0].props.children, 'Structured'); checks++
button(tree, 'Manual rows').onClick(); tree = h.render(structured)
input(tree, 'Row 1 heading').onChange({ target: { value: '  Pending decision  ' } })
input(tree, 'Row 1 short explanatory line').onChange({ target: { value: '   draft line   ' } })
h.render(structured); const draft = h.report()
assert.equal(draft.infographicControls.segmentRows[0].label, '  Pending decision  ')
assert.equal(draft.infographicControls.segmentRows[0].sublabel, '   draft line   ')
assert.equal(draft.infographicControls.segmentRows[0].icon_hint, '')
assert.equal(h.submitted.length, 0); assert.equal(draft.formData, undefined); checks += 5
h = harness(); tree = h.render({ ...structured, initialDraft: draft }); h.effect('hydratedTargetRef.current'); tree = h.render({ ...structured, initialDraft: draft })
assert.equal(input(tree, 'Row 1 heading').value, '  Pending decision  '); checks++
h.submit(); assert.equal(h.submitted.length, 0); tree = h.render({ ...structured, initialDraft: draft }); const invalid = h.report()
assert.equal(invalid.infographicControls.manualContentError, 'Segment 1 needs a supporting description.'); checks += 2
const validRows = [
 { label: 'Decide', sublabel: 'Agree a direction', description: 'Use the current evidence to select priorities.', icon_hint: 'compass' },
 { label: 'Verify', sublabel: 'Check the outcome', description: 'Review the observed result against agreed measures.', icon_hint: 'magnifier' },
]
const validDraft = { infographicControls: { ...draft.infographicControls, segmentRows: validRows, manualContentError: null, operation: 'variation', mode: 'v2', overrides: { show_icons: false }, segmentColorsInput: '  #397f72, #6e9a82  ' } }
h = harness(); h.render({ ...structured, initialDraft: validDraft }); h.effect('hydratedTargetRef.current'); h.render({ ...structured, initialDraft: validDraft }); let payload = h.submit()
assert.equal(payload.infographicConfig.operation, 'variation'); assert.equal(payload.infographicConfig.mode, 'v2')
assert.equal(payload.infographicConfig.show_icons, false); assert.deepEqual(copy(payload.infographicConfig.segment_colors), ['#397f72', '#6e9a82']); checks += 4
const ref = new File(['local synthetic SVG'], 'local-reference.svg', { type: 'image/svg+xml' })
const creative = { panelMode: 'refine', existingTarget: { elementId: 'B', mode: 'v1', rendererType: 'image', generationConfig: { mode: 'v1' } } }
const refDraft = { infographicControls: { ...validDraft.infographicControls, mode: 'v1', operation: 'edit', referenceImage: ref, contentMode: 'automatic', segmentRows: [] } }
h = harness(); h.render({ ...creative, initialDraft: refDraft }); h.effect('hydratedTargetRef.current'); h.render({ ...creative, initialDraft: refDraft })
assert.equal(h.report().infographicControls.referenceImage, ref); payload = h.submit()
assert.equal(payload.referenceImage, ref); assert.equal(payload.infographicConfig.mode, 'v1'); checks += 3
// Existing Edit path owns its renderer even if a stale local draft requests Creative.
h = harness(); h.render({ ...structured, initialDraft: refDraft }); h.effect('hydratedTargetRef.current'); h.effect('if (resolvedMode !== mode)'); h.render({ ...structured, initialDraft: refDraft })
assert.equal(h.report().infographicControls.mode, 'v2'); assert.equal(h.report().infographicControls.referenceImage, null); checks += 2
// Default-off ignores the cache bridge; native submission data matches the predecessor.
for (const extra of [{}, structured, creative, { ...structured, initialDraft: { formData: { componentType: 'INFOGRAPHIC', infographicConfig: { mode: 'v2', operation: 'variation', content_mode: 'manual', segments: validRows }, advancedModified: true } } }]) {
  const a = harness({ studio: false }), b = harness({ studio: false, old: true })
  for (const instance of [a,b]) { instance.render(extra); instance.effect('hydratedTargetRef.current'); instance.render(extra) }
  assert.deepEqual(copy(a.submit()),copy(b.submit())); checks++
}
h = harness({ studio: false }); h.render({ ...structured, initialDraft: draft }); h.effect('hydratedTargetRef.current'); h.render({ ...structured, initialDraft: draft }); h.report()
assert.equal(h.drafts.length, 0); assert.equal(h.submit().infographicConfig.content_mode, undefined); checks += 2
h = harness(); h.render({ prompt: 'Untouched target recipe prompt', showAdvanced: true }); const promptSnapshot = h.report(); assert.equal(promptSnapshot.prompt, 'Untouched target recipe prompt'); assert.equal(promptSnapshot.showAdvanced, true); checks += 2
// Execute the actual context effect before the one-shot draft hydration effect.
const ctxA = { elementId: 'blank-A', startCol: 3, startRow: 7, width: 14, height: 8 }
const customGeometry = { ...validDraft.infographicControls, positionModified: true, geometryEdited: true, geometryContext: ctxA, startCol: 9, startRow: 8, width: 10, height: 6 }
const bounds = patch => [patch.infographicControls.startCol, patch.infographicControls.startRow, patch.infographicControls.width, patch.infographicControls.height]
function mountGeometry(controls, context, studio = true) {
  const instance = harness({ studio }), props = { ...structured, initialDraft: { infographicControls: controls }, elementContext: context }
  instance.render(props); instance.effect('setStartCol(elementContext.startCol)'); instance.effect('hydratedTargetRef.current'); instance.render(props)
  return { instance, props }
}
let geo = mountGeometry(customGeometry, ctxA)
assert.deepEqual(bounds(geo.instance.report()), [9,8,10,6]); checks++
geo.instance.render({ ...geo.props, elementContext: { ...ctxA } }); geo.instance.effect('setStartCol(elementContext.startCol)'); geo.instance.render({ ...geo.props, elementContext: { ...ctxA } })
assert.deepEqual(bounds(geo.instance.report()), [9,8,10,6]); checks++
const moved = { ...ctxA, startCol: 5, startRow: 6, width: 12, height: 4 }
geo.instance.render({ ...geo.props, elementContext: moved }); geo.instance.effect('setStartCol(elementContext.startCol)'); geo.instance.render({ ...geo.props, elementContext: moved })
assert.deepEqual(bounds(geo.instance.report()), [5,6,12,4]); assert.equal(geo.instance.report().infographicControls.geometryEdited,false); checks += 2
assert.deepEqual(bounds(mountGeometry(customGeometry,{ ...ctxA, elementId:'replacement-B' }).instance.report()),[3,7,14,8]); checks++
assert.deepEqual(bounds(mountGeometry({ ...customGeometry, geometryEdited:false },ctxA).instance.report()),[3,7,14,8]); checks++
const legacyGeometry = { ...customGeometry }; delete legacyGeometry.geometryEdited; delete legacyGeometry.geometryContext
assert.deepEqual(bounds(mountGeometry(legacyGeometry,ctxA).instance.report()),[9,8,10,6]); checks++
assert.deepEqual(bounds(mountGeometry(customGeometry,moved).instance.report()),[5,6,12,4]); checks++
// Ignore stale A context during activation of cached target B, then accept B.
geo = mountGeometry(customGeometry,ctxA)
const targetBControls = { ...customGeometry, geometryContext: { ...ctxA, elementId:'blank-B' } }
const pending = harness(), pendingProps = { ...structured, targetElementId:'blank-B', initialDraft:{infographicControls:targetBControls}, elementContext:ctxA }
pending.render(pendingProps); pending.effect('setStartCol(elementContext.startCol)'); pending.effect('hydratedTargetRef.current'); pending.render(pendingProps)
assert.deepEqual(bounds(pending.report()),[9,8,10,6]); checks++
const ctxB = { ...ctxA, elementId:'blank-B' }
pending.render({ ...pendingProps,elementContext:ctxB }); pending.effect('setStartCol(elementContext.startCol)'); pending.render({ ...pendingProps,elementContext:ctxB })
assert.deepEqual(bounds(pending.report()),[9,8,10,6]); checks++
pending.render({ ...pendingProps,targetElementId:'replacement-C',elementContext:{ ...ctxA,elementId:'replacement-C' } }); pending.effect('setStartCol(elementContext.startCol)'); pending.render({ ...pendingProps,targetElementId:'replacement-C',elementContext:{ ...ctxA,elementId:'replacement-C' } })
assert.deepEqual(bounds(pending.report()),[3,7,14,8]); checks++
// Native classic still applies context bounds and reports no Studio draft.
geo = mountGeometry(customGeometry,ctxA,false); assert.equal(geo.instance.report(),undefined)
assert.equal(geo.instance.submit().infographicConfig.start_col,3); assert.equal(geo.instance.submit().infographicConfig.width,14); checks += 3
// Real geometry inputs own an override; z-index-only changes do not claim it.
h = harness(); tree = h.render(structured); h.effect('hydratedTargetRef.current'); tree = h.render(structured)
const numberLabels = []
const labels = node => { if (!node || typeof node !== 'object') return; if (node.type === 'label') numberLabels.push(node); React.Children.forEach(node.props?.children,labels) }
labels(tree)
const columnLabel = numberLabels.find(node => words(node).startsWith('Col'))
assert.ok(columnLabel); const columnInput = find(columnLabel,node => node.type==='input'); columnInput.props.onChange({ target:{value:'9'} })
h.render(structured); assert.equal(h.report().infographicControls.geometryEdited,true); assert.equal(h.report().infographicControls.startCol,9); checks += 2
h = harness(); tree = h.render(structured); h.effect('hydratedTargetRef.current'); tree = h.render(structured); const presetButton = buttons(tree).find(node => typeof node.props.onClick === 'function' && node.props.onClick.toString().includes('applyPositionPreset')); assert.ok(presetButton); presetButton.props.onClick(); h.render(structured); assert.equal(h.report().infographicControls.geometryEdited,true); checks++
const router = fs.readFileSync(new URL('components/generation-panel/index.tsx',root),'utf8')
assert.match(router, /<InfographicForm[\s\S]*initialDraft=\{initialDraft\}\s*onDraftChange=\{onDraftChange\}/); checks++
console.log(`${checks} Infographic raw-draft/path/validation/classic checks passed; connected generation and persistence remain separate.`)
