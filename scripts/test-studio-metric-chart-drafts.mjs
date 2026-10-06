import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url), root = new URL('../', import.meta.url)
const copy = value => JSON.parse(JSON.stringify(value))
let checks = 0
function check(name, fn) { fn(); checks++; console.log('PASS '+name) }
function callback(kind, name, old = false) {
 const file = `components/generation-panel/forms/${kind}-form.tsx`
 const source = old ? execFileSync('git', ['show','14122b8:'+file], {cwd:root,encoding:'utf8'}) : fs.readFileSync(new URL(file,root),'utf8')
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let node
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)node=n;ts.forEachChild(n,visit)}visit(ast);assert.ok(node)
 return ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Unspecified,node,ast)
}
function harness(kind, { flag, old = false, sourceRef } = { flag: 'true' }) {
  const file = `components/generation-panel/forms/${kind}-form.tsx`
  const current = fs.readFileSync(new URL(file, root), 'utf8')
  const previous = execFileSync('git', ['show', '14122b8:' + file], { cwd: root, encoding: 'utf8' })
  const states = [], refs = [], effects = [], submitted = [], drafts = [], registered = [], mandatory = [], cache = new Map()
  let cursor = 0, refCursor = 0, theme = { mode: 'deck', overrides: null }, themeInitialized = false
  const fakeReact = { ...React,
    useState(value) { const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(value) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: value }; return refs[i] },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  }
  const empty = () => null
  const stubs = { react: fakeReact, 'lucide-react': new Proxy({}, { get: () => empty }), '../shared/collapsible-section': { CollapsibleSection: ({ children }) => children },
    '../shared/position-presets': { PositionPresets: empty }, '../shared/toggle-row': { ToggleRow: empty }, '../shared/z-index-input': { ZIndexInput: empty },
    '../shared/theme-source-selector': { ThemeSourceSelector: empty }, '../shared/padding-control': { PaddingControl: empty }, '@/hooks/use-deck-theme-palette': { useDeckThemePalette: () => ({tokens:[]}) },
    '../shared/use-theme-source-state': { useThemeSourceState: (_, initial) => { if (!themeInitialized) { theme = initial ?? theme; themeInitialized = true } return { themeSource: theme, updateThemeSource: value => { theme = value }, useDeckTheme: theme.mode === 'deck', themeOverrides: theme.overrides } } },
  }
  function load(path, override) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }
    const result = ts.transpileModule(override ?? fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } })
    vm.runInNewContext(result.outputText, { module, exports: module.exports, React: fakeReact, console, AbortController, fetch, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, require: id => id in stubs ? stubs[id] : id.endsWith('.css') ? {} : id.startsWith('@/') ? load(new URL(id.slice(2) + '.ts', root).pathname) : require(id) })
    cache.set(path, module.exports); return module.exports
  }
  const mod = load(new URL(file, root).pathname, sourceRef ? execFileSync('git', ['show',sourceRef+':'+file], {cwd:root,encoding:'utf8'}) : old ? previous : current)
  function render(extra = {}) {
    cursor = 0; refCursor = 0; effects.length = 0
    return mod[kind === 'metrics' ? 'MetricsForm' : 'ChartForm']({ prompt: 'Local diagram prompt', showAdvanced: true, panelMode: 'refine', presentationId: 'local-fixture', isGenerating: false, registerMandatoryConfig: value => mandatory.push(value), registerSubmit: fn => registered.push(fn), onSubmit: value => submitted.push(value), onDraftChange: value => drafts.push(value), ...extra })
  }
  function effect(fragment) { const fn = effects.find(fn => fn.toString().includes(fragment)); assert.ok(fn, fragment); fn() }
  function report() { effect(kind === 'metrics' ? 'metricsControls:' : 'formData: draftFormData'); if (kind === 'chart' && !old) effect('chartSections:'); return kind === 'chart' ? Object.assign({}, ...drafts) : drafts.at(-1) }
  function submit() { effect('registerSubmit'); registered.at(-1)(); return submitted.at(-1) }
  function picker() { effect('registerMandatoryConfig'); return mandatory.at(-1) }
  return { mod, render, report, submit, picker, submitted, drafts, effect }
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return tree
  for (const child of React.Children.toArray(tree.props?.children)) { const found = find(child, predicate); if (found) return found }
  return null
}
const prop = (tree, predicate) => { const node = find(tree, predicate); assert.ok(node); return node.props }
const input = (tree, name) => prop(tree, node => node.props?.['aria-label'] === name)
const section = (tree, title) => prop(tree, node => node.props?.title === title && 'isOpen' in node.props)
const position = tree => prop(tree, node => node.props?.elementType && 'positionConfig' in node.props)
const native = { elementId: 'metric-A', startCol: 3, startRow: 7, width: 14, height: 8 }
const manual = { start_col: 6.2, start_row: 8.4, position_width: 10.6, position_height: 5.2, auto_position: false }
const saved = { elementId: 'metric-A', generationConfig: { componentType: 'METRICS', count:2, metricsLayoutChoice:'horizontal', metricsFitMode:'MANUAL', metricsConfig:{corners:'square',color_scheme:'solid'}, manualMetricsOverrides:{value_font_size:'48px'} } }
const base = { prompt: 'Metric A UNSENT', showAdvanced:true, elementContext:native, existingTextTarget:saved }
function mount(h, props){ h.render(props); if(h.mod.MetricsForm)h.effect('previousTargetIdentity');h.effect(h.mod.MetricsForm?'!elementContext':'liveStartCol ===');return h.render(props) }
for(const [kind,names] of [['metrics',['handleSubmit','generationConfig']],['chart',['handleSubmit','buildChartFormData','updatePositionConfig']]])for(const name of names)check(`${kind} original ${name} contract is unchanged`,()=>assert.equal(callback(kind,name),callback(kind,name,true)))
let h=harness('metrics'),tree=mount(h,base)
check('untouched Metric starts at actual native bounds',()=>assert.deepEqual(copy(position(tree).positionConfig), {...manual,start_col:3,start_row:7,position_width:14,position_height:8}))
input(tree,'Metric count').onChange({target:{value:'3'}});input(tree,'Metric corners').onChange({target:{value:'rounded'}})
position(tree).onChange(manual);position(tree).onAdvancedModified()
for(const n of ['Value','Positioning'])section(tree,n).onToggle()
tree=h.render(base);const patch=copy(h.report()),payload=copy(h.submit())
check('reporting caches raw local controls without constructing a request',()=>{assert.equal(patch.formData,undefined);assert.equal(patch.metricsControls.geometryEdited,true);assert.equal(patch.metricsControls.count,3)})
check('Metric unsent geometry matches original submit mapping',()=>assert.deepEqual(payload.positionConfig,manual))
check('Metric original sparse config and count reflect actual user controls',()=>{assert.equal(payload.count,3);assert.equal(payload.metricsConfig.corners,'rounded');assert.equal(payload.generationConfig.positionModified,true);assert.equal(payload.generationConfig.positionConfig,undefined)})
let restored=harness('metrics');let back=mount(restored,{...base,initialDraft:patch});const replay=copy(restored.report())
check('returning to Metric preserves every cached control/section',()=>assert.deepEqual(replay,patch))
check('restored Metric original submit is identical',()=>assert.deepEqual(copy(restored.submit()),payload))
restored.render({...base,initialDraft:patch,elementContext:{...native,width:9,height:4}});restored.effect('!elementContext');back=restored.render({...base,initialDraft:patch,elementContext:{...native,width:9,height:4}})
check('changed native bounds replace stale Metric geometry and release edit ownership',()=>{assert.deepEqual(copy(position(back).positionConfig),{...manual,start_col:3,start_row:7,position_width:9,position_height:4});assert.equal(restored.report().metricsControls.geometryEdited,false)})
let automatic=harness('metrics');let auto=mount(automatic,base);automatic.render({...base,elementContext:{...native,width:9,height:4}});automatic.effect('!elementContext');auto=automatic.render({...base,elementContext:{...native,width:9,height:4}})
check('untouched Metric tracks new native bounds',()=>{assert.equal(position(auto).positionConfig.position_width,9);assert.equal(position(auto).positionConfig.position_height,4)})
let b=harness('metrics');let bt=mount(b,{...base,existingTextTarget:{elementId:'B',generationConfig:{count:1,prompt:'B'}},elementContext:{...native,elementId:'B'}})
check('independent Metric target does not inherit A controls',()=>{assert.equal(input(bt,'Metric count').value,1);assert.equal(section(bt,'Positioning').isOpen,false)})
check('original baseline reporter is absent and native geometry overwrites the unsent edit',()=>{const old=harness('metrics',{old:true});let ot=mount(old,base);position(ot).onChange(manual);position(ot).onAdvancedModified();old.render(base);old.effect('!elementContext');ot=old.render(base);assert.equal(position(ot).positionConfig.start_col,3);assert.throws(()=>old.report())})
for(const flag of [undefined,'','false','TRUE'])check(`Metric classic behavior/reporting preserved for ${String(flag)}`,()=>{const now=harness('metrics',{flag}),old=harness('metrics',{flag,old:true});mount(now,base);mount(old,base);assert.deepEqual(copy(now.submit()),copy(old.submit()));now.report();assert.equal(now.drafts.length,0)})
const chartFormData={componentType:'CHART',prompt:'Chart A',count:1,layout:'horizontal',advancedModified:false,z_index:1000,presentationId:'local-fixture',useDeckTheme:true,themeOverrides:null,chartConfig:{chart_type:'bar_vertical',requested_data_source_mode:'custom',data:[{label:'A',value:45},{label:'B',value:70}]},positionConfig:{...manual,auto_position:true,start_col:2,start_row:4,position_width:8,position_height:5},generationConfig:{customDataInput:'[{"label":"A","value":45},{"label":"B","value":70}]'}}
const cb={prompt:'Chart A',showAdvanced:true,panelMode:'refine',elementContext:{...native,elementId:'chart-A',startCol:19,width:12},initialDraft:{formData:chartFormData}}
let c=harness('chart');let ct=mount(c,cb)
check('original Chart Auto follows supplied native bounds',()=>{assert.equal(position(ct).positionConfig.position_width,12);assert.equal(position(ct).positionConfig.start_col,19)})
for(const name of ['Chart Options','Position'])section(ct,name).onToggle();position(ct).onChange(manual);position(ct).onAdvancedModified();ct=c.render(cb);const cp=copy(c.report()),cs=copy(c.submit())
check('Chart caches both sections beside its existing formData draft',()=>assert.deepEqual(cp.chartSections,{options:true,position:true}))
let cr=harness('chart');let crt=mount(cr,{...cb,initialDraft:cp})
check('Chart remount retains sections and raw custom data',()=>{assert.equal(section(crt,'Chart Options').isOpen,true);assert.equal(section(crt,'Position').isOpen,true);assert.equal(cr.report().formData.generationConfig.customDataInput,chartFormData.generationConfig.customDataInput)})
check('Chart manual geometry survives changed native bounds',()=>{cr.render({...cb,initialDraft:cp,elementContext:{...cb.elementContext,width:9}});cr.effect('liveStartCol ===');crt=cr.render({...cb,initialDraft:cp,elementContext:{...cb.elementContext,width:9}});assert.deepEqual(copy(position(crt).positionConfig),manual)})
check('Chart restored submission retains the original request shape',()=>assert.deepEqual(copy(cr.submit()),cs))
check('Chart baseline loses sections but preserves manual geometry',()=>{const prior=harness('chart',{old:true});const t=mount(prior,{...cb,initialDraft:cp});assert.equal(section(t,'Chart Options').isOpen,false);assert.equal(section(t,'Position').isOpen,false);assert.deepEqual(copy(position(t).positionConfig),manual)})
for(const flag of [undefined,'','false','TRUE'])check(`Chart classic payload/reporting preserved for ${String(flag)}`,()=>{const now=harness('chart',{flag}),old=harness('chart',{flag,old:true});mount(now,cb);mount(old,cb);assert.deepEqual(copy(now.submit()),copy(old.submit()));assert.deepEqual(copy(now.report()),copy(old.report()))})
check('raw draft controls never enter Metric/Chart submission payloads',()=>{assert.equal(payload.metricsControls,undefined);assert.equal(cs.chartSections,undefined);assert.equal(cs.generationConfig.chartSections,undefined)})
// Normalize only the later Text Box wiring, which test-studio-textbox-drafts verifies against c2d9a7c.
check('entire Builder retains reviewed Chart admission after exact Text Box normalization',()=>{const file='app/builder/page.tsx';const now=fs.readFileSync(new URL(file,root),'utf8').replace(" && generationPanel.elementType !== 'TEXT_BOX'",'');const prior=execFileSync('git',['show','14122b8:'+file],{cwd:root,encoding:'utf8'});assert.equal(now.replace(" && generationPanel.elementType !== 'CHART'",''),prior)})
check('entire GenerationPanel retains reviewed Metrics props after exact Text Box normalization',()=>{const file='components/generation-panel/index.tsx';const now=fs.readFileSync(new URL(file,root),'utf8').replace('slotCatalogError={slotCatalogError} existingTextTarget={existingTextTarget} initialDraft={initialDraft} onDraftChange={onDraftChange} targetElementId={targetElementId} />','slotCatalogError={slotCatalogError} existingTextTarget={existingTextTarget} />');const prior=execFileSync('git',['show','14122b8:'+file],{cwd:root,encoding:'utf8'});assert.equal(now.replace('existingTextTarget={existingTextTarget} initialDraft={initialDraft} onDraftChange={onDraftChange} targetElementId={targetElementId} />','existingTextTarget={existingTextTarget} initialDraft={initialDraft} />'),prior)})
// Execute the actual leaf report, parent effective-draft expression and parent hydration.
const panelSource=fs.readFileSync(new URL('components/generation-panel/index.tsx',root),'utf8')
const panelTree=ts.createSourceFile('panel.tsx',panelSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const hookSource=fs.readFileSync(new URL('hooks/use-generation-panel.ts',root),'utf8')
const hookTree=ts.createSourceFile('hook.ts',hookSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
function astFind(tree,predicate){let result;function visit(n){if(!result&&predicate(n))result=n;ts.forEachChild(n,visit)}visit(tree);assert.ok(result);return result}
const effective=astFind(panelTree,n=>ts.isVariableDeclaration(n)&&n.name.getText(panelTree)==='effectiveDraft').initializer.getText(panelTree)
const hydration=astFind(panelTree,n=>ts.isCallExpression(n)&&n.expression.getText(panelTree)==='useEffect'&&n.arguments[0]?.getText(panelTree).includes('setPrompt(effectiveDraft?')).arguments[0].getText(panelTree)
const update=astFind(hookTree,n=>ts.isVariableDeclaration(n)&&n.name.getText(hookTree)==='updateCurrentDraft').initializer.arguments[0].getText(hookTree)
function reopenFromActualReport(patch,persisted){
 const draftsRef={current:new Map()},context={studio:true,panelIntentRevisionRef:{current:0},draftKey:'element:metric-A',draftsRef,setDraftVersion:()=>{},cloneFormDataForDraft:copy}
 vm.runInNewContext(ts.transpileModule('('+update+')(patch)',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{...context,patch})
 const draft=draftsRef.current.get('element:metric-A');let prompt,advanced
 const effectiveDraft=vm.runInNewContext(effective,{draft,persistedGenerationDraft:persisted})
 vm.runInNewContext(ts.transpileModule('('+hydration+')()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{effectiveDraft,readObject:v=>v&&typeof v==='object'?v:null,setPrompt:v=>prompt=v,setShowAdvanced:v=>advanced=v})
 return {prompt,advanced}
}
const originalPrompt='Original saved Metric prompt',untouched={...base,prompt:originalPrompt,showAdvanced:true}
let untouchedLeaf=harness('metrics');mount(untouchedLeaf,untouched);const untouchedPatch=copy(untouchedLeaf.report())
check('actual untouched leaf report / draft map / parent hydration retains saved prompt and Advanced',()=>assert.deepEqual(reopenFromActualReport(untouchedPatch,{prompt:originalPrompt,showAdvanced:true}),{prompt:originalPrompt,advanced:true}))
check('rejected checkpoint reproduces untouched-prompt loss through the same actual parent path',()=>{const prior=harness('metrics',{flag:'true',sourceRef:'b6f681b'});mount(prior,untouched);const report=prior.report();assert.deepEqual(Object.keys(report),['metricsControls']);assert.equal(reopenFromActualReport(report,{prompt:originalPrompt,showAdvanced:true}).prompt,'')})
check('deliberately empty prompt and collapsed Advanced remain deliberate',()=>{const blank=harness('metrics');mount(blank,{...base,prompt:'',showAdvanced:false});assert.deepEqual(reopenFromActualReport(blank.report(),{prompt:originalPrompt,showAdvanced:true}),{prompt:'',advanced:false})})
const geoPatch=copy(patch);geoPatch.metricsControls.geometryContext=native
function geo(props,order='reset-first'){
 const instance=harness('metrics');const all={...base,targetElementId:'metric-A',initialDraft:geoPatch,...props};instance.render(all)
 if(order==='context-first'){instance.effect('!elementContext');instance.effect('previousTargetIdentity')}else{instance.effect('previousTargetIdentity');instance.effect('!elementContext')}
 instance.render(all);return {instance,all,bounds:()=>copy(instance.report().metricsControls.positionConfig)}
}
for(const order of ['reset-first','context-first'])check(`same-owner unchanged context retains exact fractional draft with ${order}`,()=>{const g=geo({},order);assert.deepEqual(g.bounds(),manual);assert.equal(g.instance.report().metricsControls.geometryEdited,true)})
check('unchanged native object reissue preserves Metric draft and witness',()=>{const g=geo({});const next={...g.all,elementContext:{...native}};g.instance.render(next);g.instance.effect('!elementContext');g.instance.render(next);assert.deepEqual(g.bounds(),manual);assert.deepEqual(copy(g.instance.report().metricsControls.geometryContext),native)})
for(const order of ['reset-first','context-first'])check(`actual changed native bounds take authority with ${order}`,()=>{const moved={...native,startCol:5,startRow:6,width:9,height:4};const g=geo({elementContext:moved},order);assert.deepEqual(g.bounds(),{...manual,start_col:5,start_row:6,position_width:9,position_height:4});assert.equal(g.instance.report().metricsControls.geometryEdited,false);assert.deepEqual(copy(g.instance.report().metricsControls.geometryContext),moved)})
check('foreign first context does not initialize or reset active target controls',()=>{const bPatch=copy(geoPatch);bPatch.metricsControls.geometryContext={...native,elementId:'metric-B'};const bProps={targetElementId:'metric-B',elementContext:native,existingTextTarget:{elementId:'metric-B',generationConfig:{count:1}},initialDraft:bPatch};const g=geo(bProps,'context-first');assert.deepEqual(g.bounds(),manual);assert.equal(g.instance.report().metricsControls.count,3);assert.equal(g.instance.report().metricsControls.geometryContext.elementId,'metric-B');const next={...g.all,elementContext:{...native,elementId:'metric-B'}};g.instance.render(next);g.instance.effect('!elementContext');g.instance.render(next);assert.deepEqual(g.bounds(),manual)})
check('foreign context without a cached draft never initializes active Metric geometry',()=>{const g=geo({targetElementId:'metric-B',initialDraft:null,elementContext:native,existingTextTarget:{elementId:'metric-B',generationConfig:{count:1}}});assert.equal(g.bounds().start_col,2);assert.equal(g.bounds().start_row,4);assert.equal(g.instance.report().metricsControls.count,1);assert.equal(g.instance.report().metricsControls.geometryContext,null)})
check('confirmed replacement target releases stale geometry',()=>{const next={...native,elementId:'replacement-C'};const g=geo({targetElementId:'replacement-C',elementContext:next,existingTextTarget:{elementId:'replacement-C',generationConfig:{count:1}}});assert.deepEqual(g.bounds(),{...manual,start_col:3,start_row:7,position_width:14,position_height:8});assert.equal(g.instance.report().metricsControls.geometryEdited,false)})
check('Auto resets edited geometry to current native bounds and releases draft ownership',()=>{const g=geo({});const t=g.instance.render(g.all);position(t).onChange({...manual,auto_position:true,start_col:2,start_row:4,position_width:8,position_height:5});position(t).onAdvancedModified();g.instance.render(g.all);assert.deepEqual(g.bounds(),{...manual,auto_position:true,start_col:3,start_row:7,position_width:14,position_height:8});assert.equal(g.instance.report().metricsControls.geometryEdited,false)})
check('manual control edits claim geometry while original advanced marker remains separate',()=>{const g=geo({initialDraft:null});const t=g.instance.render(g.all);position(t).onChange(manual);position(t).onAdvancedModified();g.instance.render(g.all);assert.equal(g.instance.report().metricsControls.geometryEdited,true);assert.equal(g.instance.report().metricsControls.positionModified,true)})
check('rejected checkpoint ignores changed native bounds and has no owner witness',()=>{const prior=harness('metrics',{flag:'true',sourceRef:'b6f681b'});mount(prior,{...base,initialDraft:geoPatch,targetElementId:'metric-A'});const next={...base,initialDraft:geoPatch,targetElementId:'metric-A',elementContext:{...native,width:9,height:4}};prior.render(next);prior.effect('!elementContext');prior.render(next);assert.deepEqual(copy(prior.report().metricsControls.positionConfig),manual);assert.equal(prior.report().metricsControls.geometryContext,undefined)})
check('Chart source is entirely unchanged by the Metric correction',()=>assert.equal(fs.readFileSync(new URL('components/generation-panel/forms/chart-form.tsx',root),'utf8'),execFileSync('git',['show','b6f681b:components/generation-panel/forms/chart-form.tsx'],{cwd:root,encoding:'utf8'})))
console.log(`${checks} actual Metric/Chart form checks passed; offline only.`)
