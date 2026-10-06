import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url), root = new URL('../', import.meta.url)
const file = 'components/generation-panel/forms/shape-form.tsx'
const current = fs.readFileSync(new URL(file, root), 'utf8')
const previous = execFileSync('git', ['show', '4cd4a85:' + file], { cwd: root, encoding: 'utf8' })
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
for (const name of ['handleSubmit', 'clearExplicit']) { assert.equal(callback(current, name), callback(previous, name), name + ' is unchanged'); checks++ }
function harness({ studio = true, old = false } = {}) {
  const states = [], refs = [], effects = [], submitted = [], drafts = [], registered = [], mandatory = [], cache = new Map()
  let cursor = 0, refCursor = 0, theme = { mode: 'deck', overrides: null }, themeInitialized = false
  const fakeReact = { ...React,
    useState(value) { const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(value) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: value }; return refs[i] },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  }
  const empty = () => null
  const stubs = { react: fakeReact, 'lucide-react': new Proxy({}, { get: () => empty }), '../shared/collapsible-section': { CollapsibleSection: ({ children }) => children },
    '../shared/toggle-row': { ToggleRow: empty }, '../shared/z-index-input': { ZIndexInput: empty },
    '../shared/theme-source-selector': { ThemeSourceSelector: empty }, '../shared/padding-control': { PaddingControl: empty }, '@/hooks/use-deck-theme-palette': { useDeckThemePalette: () => ({tokens:[]}) },
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
    return mod.ShapeForm({ prompt: 'Local diagram prompt', showAdvanced: true, panelMode: 'refine', presentationId: 'local-fixture', isGenerating: false, registerMandatoryConfig: value => mandatory.push(value), registerSubmit: fn => registered.push(fn), onSubmit: value => submitted.push(value), onDraftChange: value => drafts.push(value), ...extra })
  }
  function effect(fragment) { const fn = effects.find(fn => fn.toString().includes(fragment)); assert.ok(fn, fragment); fn() }
  function report() { effect('shapeControls:'); return drafts.at(-1) }
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

const base={prompt:'Untouched shape source',showAdvanced:true}
let h=harness(),tree=h.render(base),patch=h.report()
assert.equal(patch.prompt,base.prompt);assert.equal(patch.showAdvanced,true);assert.equal(h.submitted.length,0);assert.equal(patch.formData,undefined);checks+=4
const shapeOptions=h.picker()[0].optionGroups.flatMap(group=>group.options);assert.equal(shapeOptions.length,25);checks++
for(const option of shapeOptions){h.picker()[0].onChange(option.value);h.render(base);const payload=h.submit();assert.equal(payload.shapeConfig.shape_type,option.value==='custom'?null:option.value);checks++}
h=harness();tree=h.render(base);h.picker()[0].onChange('polygon');tree=h.render(base)
for(const [name,value] of [['Number of Sides','9'],['Count','3'],['Target Background','dark'],['X (px)','481'],['Y (px)','421'],['Width (px)','605'],['Height (px)','365'],['Opacity','73'],['Rotation','71']])input(tree,name).onChange({target:{value}})
h.render(base);patch=h.report();const controls=patch.shapeControls
assert.equal(controls.sides,9);assert.equal(controls.opacity,.73);assert.equal(controls.rotation,71);assert.equal(controls.widthPx,605);assert.equal(controls.geometryEdited,true);checks+=5
h=harness();tree=h.render({...base,initialDraft:patch});const restored=h.report().shapeControls;assert.deepEqual(copy(restored),copy(controls));checks++
let payload=h.submit();assert.equal(payload.componentType,'SHAPE');assert.equal(payload.count,3);assert.equal(payload.shapeConfig.sides,9);assert.equal(payload.shapeConfig.x,481);assert.equal(payload.shapeConfig.width_px,605);assert.equal(payload.positionConfig.start_col,9);assert.equal(payload.positionConfig.start_row,8);assert.equal(payload.positionConfig.position_width,10);assert.equal(payload.positionConfig.position_height,6);checks+=9
// Submit alone derives no-border semantics and resolves whether a deck theme is needed.
h=harness();h.render({prompt:'  three rings without a border  ',showAdvanced:true});h.picker()[1].onChange('none');h.render({prompt:'  three rings without a border  ',showAdvanced:true});const custom=h.report();assert.equal(custom.shapeControls.shapeType,'custom');assert.equal(custom.shapeControls.fillColor,'none');assert.equal(custom.shapeControls.strokeWidth,2);checks+=3
h=harness();h.render({prompt:'  three rings without a border  ',showAdvanced:true,initialDraft:custom});payload=h.submit();assert.equal(payload.shapeConfig.shape_type,null);assert.equal(payload.shapeConfig.prompt,'  three rings without a border  ');assert.equal(payload.shapeConfig.stroke_width,0);assert.equal(payload.useDeckTheme,false);checks+=4
h.picker()[2].onChange('#334155');h.render({prompt:'without a border',showAdvanced:true,initialDraft:custom});payload=h.submit();assert.equal(payload.shapeConfig.stroke_color,'#334155');assert.equal(payload.shapeConfig.stroke_width,undefined);checks+=2
h.picker()[2].onChange('none');h.render(base);payload=h.submit();assert.equal(payload.shapeConfig.stroke_width,0);assert.equal(payload.shapeConfig.stroke_color,undefined);checks+=2
h.picker()[1].onChange('theme');h.picker()[2].onChange('theme');h.render(base);const auto=h.report();h=harness();h.render({...base,initialDraft:auto});payload=h.submit();assert.equal(payload.shapeConfig.fill_color,undefined);assert.equal(payload.shapeConfig.stroke_color,undefined);assert.equal(payload.shapeConfig.stroke_width,undefined);assert.equal(payload.useDeckTheme,true);checks+=4
// Reporting preserves the actual input callback's raw0 state; it does not clamp/submit.
tree=h.render(base);input(tree,'Width (px)').onChange({target:{value:''}});h.render(base);const incomplete=h.report();assert.equal(incomplete.shapeControls.widthPx,0);assert.equal(incomplete.formData,undefined);checks+=2
const ctx={elementId:'A',startCol:3,startRow:7,width:6,height:4};const geometry={...patch,shapeControls:{...controls,geometryEdited:true,geometryContext:ctx}};const props={...base,targetElementId:'A',elementContext:ctx,initialDraft:geometry}
h=harness();h.render(props);h.effect('setX((elementContext.startCol');h.render(props);assert.equal(h.report().shapeControls.x,481);checks++
h.render({...props,elementContext:{...ctx}});h.effect('setX((elementContext.startCol');h.render(props);assert.equal(h.report().shapeControls.widthPx,605);checks++
const moved={...ctx,startCol:5,width:8};h.render({...props,elementContext:moved});h.effect('setX((elementContext.startCol');h.render({...props,elementContext:moved});assert.equal(h.report().shapeControls.x,240);assert.equal(h.report().shapeControls.widthPx,480);assert.equal(h.report().shapeControls.geometryEdited,false);checks+=3
h=harness();h.render({...props,targetElementId:'B',elementContext:{...ctx,elementId:'B'}});h.effect('setX((elementContext.startCol');h.render({...props,targetElementId:'B',elementContext:{...ctx,elementId:'B'}});assert.equal(h.report().shapeControls.x,120);checks++
h=harness();h.render({...props,targetElementId:'B'});h.effect('setX((elementContext.startCol');h.render({...props,targetElementId:'B'});assert.equal(h.report().shapeControls.x,481);checks++
h=harness();const untouched={...geometry,shapeControls:{...geometry.shapeControls,geometryEdited:false}};h.render({...props,initialDraft:untouched});h.effect('setX((elementContext.startCol');h.render({...props,initialDraft:untouched});assert.equal(h.report().shapeControls.x,120);checks++
// Grid input and Size presets claim geometry, while Reset releases it.
h=harness();tree=h.render(base);input(tree,'Col (grid)').onChange({target:{value:'8.4'}});tree=h.render(base);assert.equal(h.report().shapeControls.x,444);assert.equal(h.report().shapeControls.geometryEdited,true);button(tree,'large').onClick();tree=h.render(base);assert.equal(h.report().shapeControls.widthPx,480);button(tree,'Reset to Auto').onClick();h.render(base);assert.equal(h.report().shapeControls.geometryEdited,false);checks+=4
for(const extra of [{},{prompt:'without a border'},{initialDraft:{formData:{componentType:'SHAPE',count:2,shapeConfig:{shape_type:null,prompt:'saved',fill_color:'none',stroke_width:0,x:481,width_px:605}}}},{elementContext:ctx,initialDraft:geometry}]){
 const a=harness({studio:false}),b=harness({studio:false,old:true});for(const x of[a,b]){x.render({...base,...extra});if(extra.elementContext)x.effect('setX((elementContext.startCol');x.render({...base,...extra})}
 assert.deepEqual(copy(a.submit()),copy(b.submit()));assert.equal(a.report(),undefined);checks+=2
}
console.log(`${checks} Shape choice/raw-draft/border/theme/geometry/classic checks passed; connected proof remains separate.`)
