import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url), root = new URL('../', import.meta.url)
const file = 'components/generation-panel/forms/icon-label-form.tsx'
const current = fs.readFileSync(new URL(file, root), 'utf8')
const previous = execFileSync('git', ['show', 'a8957d6:' + file], { cwd: root, encoding: 'utf8' })
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
for (const name of ['handleSubmit', 'clearExplicit']) {
  let actual = callback(current, name)
  if (name === 'handleSubmit') {
    const studioLabelOperation = "operation: STUDIO_VISUAL_FORMS && mode === 'label' ? 'generate' : operation,"
    assert.equal(actual.split(studioLabelOperation).length, 2,
      'Exactly one explicit Studio Label-only operation serialization')
    actual = actual.replace(studioLabelOperation, 'operation,')
  }
  assert.equal(actual, callback(previous, name), name + ' preserves classic and all other submission fields'); checks++
}
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
    '../shared/theme-source-selector': { ThemeSourceSelector: empty }, '../shared/padding-control': { PaddingControl: empty },
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
    return mod.IconLabelForm({ prompt: 'Local diagram prompt', showAdvanced: true, panelMode: 'refine', presentationId: 'local-fixture', isGenerating: false, registerMandatoryConfig: value => mandatory.push(value), registerSubmit: fn => registered.push(fn), onSubmit: value => submitted.push(value), onDraftChange: value => drafts.push(value), ...extra })
  }
  function effect(fragment) { const fn = effects.find(fn => fn.toString().includes(fragment)); assert.ok(fn, fragment); fn() }
  function report() { effect('iconLabelControls:'); return drafts.at(-1) }
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

const base={prompt:'Untouched icon source',showAdvanced:true}
let h=harness(), tree=h.render(base), patch=h.report()
assert.equal(patch.prompt,base.prompt);assert.equal(patch.showAdvanced,true);assert.equal(h.submitted.length,0);assert.equal(patch.formData,undefined);checks+=4
input(tree,'Count').onChange({target:{value:'4'}});input(tree,'Style').onChange({target:{value:'square-outline'}});input(tree,'Stroke Width').onChange({target:{value:'4'}});input(tree,'Exclude Icons').onChange({target:{value:'  star , circle-dot,   '}})
h.render(base);patch=h.report();const controls=patch.iconLabelControls
assert.equal(controls.count,4);assert.equal(controls.style,'square-outline');assert.equal(controls.strokeWidth,4);assert.equal(controls.excludeIconsInput,'  star , circle-dot,   ');checks+=4
h=harness();tree=h.render({...base,initialDraft:patch});let restored=h.report().iconLabelControls
assert.equal(restored.excludeIconsInput,controls.excludeIconsInput);assert.equal(input(tree,'Count').value,4);checks+=2
let payload=h.submit();assert.equal(payload.componentType,'ICON_LABEL');assert.equal(payload.count,4);assert.equal(payload.iconLabelConfig.style,'square-outline');assert.deepEqual(copy(payload.iconLabelConfig.exclude_icons),['star','circle-dot']);checks+=4
input(tree,'Style').onChange({target:{value:''}});input(tree,'Stroke Width').onChange({target:{value:''}});h.render(base);const auto=h.report()
h=harness();h.render({...base,initialDraft:auto});payload=h.submit();assert.equal(payload.iconLabelConfig.style,undefined);assert.equal(payload.iconLabelConfig.stroke_width,undefined);assert.equal(payload.iconLabelConfig.color,undefined);checks+=3
// Explicit null and a raw incomplete exclusion are stored separately from normalization.
const nullable={...patch,iconLabelControls:{...controls,color:null,excludeIconsInput:'  , incomplete , ',explicitFields:[...controls.explicitFields,'color'],operation:'replace',showPosition:true,showPadding:true,themeSource:{mode:'none',overrides:null}}}
h=harness();tree=h.render({...base,initialDraft:nullable});h.effect('setOperation(previous');h.render({...base,initialDraft:nullable});payload=h.submit()
assert.equal(payload.iconLabelConfig.color,null);assert.equal(payload.iconLabelConfig.operation,'replace');assert.equal(payload.useDeckTheme,false);assert.equal(h.report().iconLabelControls.showPosition,true);assert.equal(h.report().iconLabelControls.showPadding,true);assert.equal(h.report().iconLabelControls.excludeIconsInput,'  , incomplete , ');checks+=6
// Native Label mode still clears only explicit style; other raw options survive.
h=harness();tree=h.render({...base,initialDraft:patch});h.picker()[0].onChange('label');tree=h.render(base);input(tree,'Font').onChange({target:{value:'roboto_mono'}});h.render(base);const label=h.report()
h=harness();h.render({...base,initialDraft:label});payload=h.submit();assert.equal(payload.iconLabelConfig.mode,'label');assert.equal(payload.iconLabelConfig.font,'roboto_mono');assert.equal(payload.iconLabelConfig.style,undefined);assert.equal(payload.iconLabelConfig.stroke_width,undefined);checks+=4
h=harness();h.render({...base,panelMode:'generate',initialDraft:nullable});h.effect('setOperation(previous');h.render({...base,panelMode:'generate',initialDraft:nullable});assert.equal(h.submit().iconLabelConfig.operation,'generate');checks++
const ctx={elementId:'A',startCol:3,startRow:7,width:6,height:4};const bounds=p=>copy(p.iconLabelControls.positionConfig)
const geometry={...patch,iconLabelControls:{...controls,geometryEdited:true,geometryContext:ctx,positionConfig:{start_col:9,start_row:8,position_width:6,position_height:4,auto_position:false}}}
const props={...base,targetElementId:'A',initialDraft:geometry,elementContext:ctx}
h=harness();h.render(props);h.effect('setPositionConfig({');h.render(props);assert.equal(bounds(h.report()).start_col,9);checks++
h.render({...props,elementContext:{...ctx}});h.effect('setPositionConfig({');h.render(props);assert.equal(bounds(h.report()).start_col,9);checks++
const moved={...ctx,startCol:5,width:8};h.render({...props,elementContext:moved});h.effect('setPositionConfig({');h.render({...props,elementContext:moved});assert.equal(bounds(h.report()).start_col,5);assert.equal(bounds(h.report()).position_width,8);assert.equal(h.report().iconLabelControls.geometryEdited,false);checks+=3
h=harness();h.render({...props,targetElementId:'B',elementContext:{...ctx,elementId:'B'}});h.effect('setPositionConfig({');h.render({...props,targetElementId:'B',elementContext:{...ctx,elementId:'B'}});assert.equal(bounds(h.report()).start_col,3);checks++
h=harness();h.render({...props,targetElementId:'B'});h.effect('setPositionConfig({');h.render({...props,targetElementId:'B'});assert.equal(bounds(h.report()).start_col,9);checks++
h=harness();const untouched={...geometry,iconLabelControls:{...geometry.iconLabelControls,geometryEdited:false}};h.render({...props,initialDraft:untouched});h.effect('setPositionConfig({');h.render({...props,initialDraft:untouched});assert.equal(bounds(h.report()).start_col,3);checks++
// Actual position callback owns the override; Reset to Auto releases it.
h=harness();tree=h.render(base);const labels=[];const visit=n=>{if(!n||typeof n!=='object')return;if(n.type==='label')labels.push(n);React.Children.forEach(n.props?.children,visit)};visit(tree);const col=labels.find(n=>words(n)==='Col');assert.ok(col);find(col,n=>n.type==='input').props.onChange({target:{value:'11'}});tree=h.render(base);assert.equal(h.report().iconLabelControls.geometryEdited,true);button(tree,'Reset to Auto').onClick();h.render(base);assert.equal(h.report().iconLabelControls.geometryEdited,false);assert.equal(h.report().iconLabelControls.excludeIconsInput,'');checks+=3
for(const extra of [{},{panelMode:'generate'},{initialDraft:{formData:{componentType:'ICON_LABEL',prompt:'saved',count:2,iconLabelConfig:{mode:'label',font:'inter',color:null,exclude_icons:['star']}}}},{elementContext:ctx,initialDraft:geometry}]){
 const a=harness({studio:false}),b=harness({studio:false,old:true});for(const x of[a,b]){x.render({...base,...extra});x.effect('setOperation(previous');if(extra.elementContext)x.effect('setPositionConfig({');x.render({...base,...extra})}
 assert.deepEqual(copy(a.submit()),copy(b.submit()));assert.equal(a.report(),undefined);checks+=2
}
console.log(`${checks} Icon/Label raw-draft, geometry, operation and classic checks passed; connected proof remains separate.`)
