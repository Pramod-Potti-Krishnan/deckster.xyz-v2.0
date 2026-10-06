import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url), root = new URL('../', import.meta.url)
const copy = value => JSON.parse(JSON.stringify(value))
let checks=0
function check(name,fn){fn();checks++;console.log('PASS '+name)}
function declaration(file,name,old=false){const source=old?execFileSync('git',['show','c2d9a7c:'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(new URL(file,root),'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let result;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)result=n;ts.forEachChild(n,visit)}visit(ast);assert.ok(result,name);return ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Unspecified,result,ast)}
function effectSource(file,fragment,old=false){const source=old?execFileSync('git',['show','c2d9a7c:'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(new URL(file,root),'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let result;function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes(fragment))result=n.arguments[0];ts.forEachChild(n,visit)}visit(ast);assert.ok(result,fragment);return ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Unspecified,result,ast)}
function harness( { flag, old = false, sourceRef } = { flag: 'true' }) {
  const file = 'components/generation-panel/forms/text-box-form.tsx'
  const current = fs.readFileSync(new URL(file, root), 'utf8')
  const previous = execFileSync('git', ['show', 'c2d9a7c:' + file], { cwd: root, encoding: 'utf8' })
  const states = [], refs = [], effects = [], submitted = [], drafts = [], registered = [], mandatory = [], cache = new Map()
  let cursor = 0, refCursor = 0, theme = { mode: 'deck', overrides: null }, themeInitialized = false
  const fakeReact = { ...React,
    useState(value) { const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(value) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: value }; return refs[i] },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  }
  const empty = () => null
  const stubs = { react: fakeReact, 'lucide-react': new Proxy({}, { get: () => empty }), '../shared/collapsible-section': { CollapsibleSection: ({ children }) => children },
    '../shared/font-override-section': { FontOverrideSection: empty }, '../shared/position-presets': { PositionPresets: empty }, '../shared/toggle-row': { ToggleRow: empty }, '../shared/z-index-input': { ZIndexInput: empty },
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
    return mod.TextBoxForm({ slotCatalog: { slots: [] }, slotCatalogLoading: false, prompt: 'Text untouched original prompt', showAdvanced: true, panelMode: 'refine', presentationId: 'local-fixture', isGenerating: false, registerMandatoryConfig: value => mandatory.push(value), registerSubmit: fn => registered.push(fn), onSubmit: value => submitted.push(value), onDraftChange: value => drafts.push(value), ...extra })
  }
  function effect(fragment) { const fn = effects.find(fn => fn.toString().includes(fragment)); assert.ok(fn, fragment); fn() }
  function report() { effect('textBoxControls:'); return drafts.at(-1) }
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
const file='components/generation-panel/forms/text-box-form.tsx'
for(const name of ['handleSubmit','generationConfig','effectiveCatalog','selectedSlot','roleOptions','resolvedLayout','feasibleCounts','viableGridDimensions','effectiveGeometry','updateDetailedTextboxOverride','updateManualOverride','updateExplicitManualOverride'])check(`original ${name} mapping/constraint unchanged`,()=>assert.equal(declaration(file,name),declaration(file,name,true)))
check('original mandatory Role callback/options remain exact',()=>assert.equal(effectSource(file,'registerMandatoryConfig({'),effectSource(file,'registerMandatoryConfig({',true)))
function select(tree,name){const label=find(tree,n=>n.type==='label'&&React.Children.toArray(n.props.children).some(c=>c?.type==='span'&&c.props.children===name));assert.ok(label,name);return prop(label,n=>n.type==='select')}
const font=(tree,prefix)=>prop(tree,n=>n.props?.prefix===prefix&&typeof n.props.onChange==='function')
const padding=tree=>prop(tree,n=>'paddingConfig' in n.props&&typeof n.props.onAdvancedModified==='function')
const native={elementId:'text-A',startCol:3,startRow:7,width:24,height:12}
const saved={elementId:'text-A',generationConfig:{prompt:'Original untouched A prompt',count:2,structure:'classic',textboxOverrides:{corners:'square',content_font_family:'Inter'}}}
const catalog={slots:[{slot_name:'body',role:'BODY_TEXT',kind:'body',label:'Body',supported:true},{slot_name:'slide_title',role:'SLIDE_TITLE',kind:'structural',label:'Title',supported:true},{slot_name:'slide_subtitle',role:'SLIDE_SUBTITLE',kind:'structural',label:'Subtitle',supported:true},{slot_name:'footer',role:'FOOTER',kind:'structural',label:'Footer',supported:true},{slot_name:'sources',role:'SOURCES',kind:'system',label:'Sources',system_managed:true,supported:true},{slot_name:'logo',role:null,kind:'accessory',accessory_type:'LOGO',label:'Logo',supported:true}]}
const base={prompt:'Original untouched A prompt',showAdvanced:true,elementContext:native,targetElementId:'text-A',existingTextTarget:saved,slotCatalog:catalog,slotCatalogLoading:false}
function mount(h,props,order='reset-first'){h.render(props);if(order==='context-first'){h.effect('!elementContext');h.effect('previousTargetIdentity')}else{h.effect('previousTargetIdentity');h.effect('!elementContext')}h.render(props);h.effect('selectionForExistingTarget');return h.render(props)}
let h=harness(),tree=mount(h,base)
check('native Text Box geometry initializes from exact owner bounds',()=>assert.deepEqual(copy(position(tree).positionConfig),{start_col:3,start_row:7,position_width:24,position_height:12,auto_position:false}))
check('generic native record retains accepted Body default',()=>assert.equal(prop(tree,n=>n.props?.id==='textbox-role').value,'__body_text_auto__'))
input(tree,'Body structure').onChange({target:{value:'SECTIONS'}});for(const name of ['Instances','Box Design','Heading','Content','Positioning','Container Padding'])section(tree,name).onToggle();tree=h.render(base)
input(tree,'Text box count').onChange({target:{value:'4'}});tree=h.render(base);select(tree,'Arrangement').onChange({target:{value:'grid'}});tree=h.render(base);select(tree,'Grid columns').onChange({target:{value:'2'}});select(tree,'Multi-box color style').onChange({target:{value:'THEME_SEQUENCE'}})
font(tree,'content').onChange('content_font_size','40px');font(tree,'content').onChange('content_font_family','Roboto');font(tree,'heading').onChange('heading_bold',true);select(tree,'Corners').onChange({target:{value:'rounded'}});select(tree,'Box').onChange({target:{value:'colored'}});tree=h.render(base);select(tree,'Color').onChange({target:{value:'teal'}})
input(tree,'Items per box').onChange({target:{value:'6'}});padding(tree).onChange({top:3,right:4,bottom:5,left:6})
const manual={start_col:6.2,start_row:8.4,position_width:16.6,position_height:10.2,auto_position:false};position(tree).onChange(manual);position(tree).onAdvancedModified();tree=h.render(base);h.effect('!feasibleCounts.includes(count)');h.effect('gridDimensions.some');tree=h.render(base);const patch=copy(h.report()),payload=copy(h.submit())
check('raw Text Box cache carries untouched prompt and Advanced without submission normalization',()=>{assert.equal(patch.prompt,base.prompt);assert.equal(patch.showAdvanced,true);assert.equal(patch.formData,undefined);assert.equal(patch.textBoxControls.count,4);assert.equal(patch.textBoxControls.gridCols,2)})
check('raw typography/structure/color/manual/padding match original submission',()=>{assert.equal(payload.structure,'SECTIONS');assert.equal(payload.count,4);assert.equal(payload.layout,'grid');assert.equal(payload.textboxConfig.content_font_family,'Roboto');assert.equal(payload.textboxConfig.color_variant,'teal');assert.equal(payload.manualGeometryOverrides.content_font_size_px,40);assert.deepEqual(payload.manualGeometryOverrides.padding_px,{top:3,right:4,bottom:5,left:6});assert.deepEqual(payload.positionConfig,manual)})
check('all six Text Box section states are retained',()=>assert.ok(Object.values(patch.textBoxControls.sections).every(Boolean)))
let restored=harness(),rt=mount(restored,{...base,initialDraft:patch})
check('target return preserves every raw control and section',()=>assert.deepEqual(copy(restored.report()),patch))
check('target return original submit shape is identical',()=>assert.deepEqual(copy(restored.submit()),payload))
check('raw draft fields never enter generation requests or metadata',()=>{assert.equal(payload.textBoxControls,undefined);assert.equal(payload.generationConfig.geometryContext,undefined);assert.equal(payload.generationConfig.positionConfig,undefined)})
check('original source lacks reporter and resets raw controls on remount',()=>{const old=harness({flag:'true',old:true});let ot=mount(old,{...base,initialDraft:patch});assert.equal(input(ot,'Body structure').value,'classic');assert.throws(()=>old.report())})
for(const flag of [undefined,'','false','TRUE'])check(`classic/default-off original payload remains exact for ${String(flag)}`,()=>{const now=harness({flag}),old=harness({flag,old:true});mount(now,base);mount(old,base);assert.deepEqual(copy(now.submit()),copy(old.submit()));now.report();assert.equal(now.drafts.length,0)})
function nativeGeometry(props={},order='reset-first'){const instance=harness(),all={...base,initialDraft:patch,...props};mount(instance,all,order);return{instance,all,report:()=>copy(instance.report()),bounds:()=>copy(instance.report().textBoxControls.positionConfig)}}
for(const order of ['reset-first','context-first'])check(`unchanged same-owner Text Box context preserves draft with ${order}`,()=>assert.deepEqual(nativeGeometry({},order).bounds(),manual))
check('same-owner identical-object context refresh preserves override and native witness',()=>{const g=nativeGeometry();const next={...g.all,elementContext:{...native}};g.instance.render(next);g.instance.effect('!elementContext');g.instance.render(next);assert.deepEqual(g.bounds(),manual);assert.deepEqual(g.report().textBoxControls.geometryContext,native)})
for(const order of ['reset-first','context-first'])check(`actual native geometry move takes authority with ${order}`,()=>{const moved={...native,startCol:5,startRow:6,width:20,height:10};const g=nativeGeometry({elementContext:moved},order);assert.deepEqual(g.bounds(),{...manual,start_col:5,start_row:6,position_width:20,position_height:10});assert.equal(g.report().textBoxControls.geometryEdited,false)})
check('foreign first handoff cannot initialize/reset cached active-owner controls',()=>{const b=copy(patch);b.textBoxControls.geometryContext={...native,elementId:'text-B'};b.textBoxControls.roleContext=JSON.stringify(['text-B',null,null,null,null]);const g=nativeGeometry({targetElementId:'text-B',initialDraft:b,existingTextTarget:{elementId:'text-B',generationConfig:{count:1}},elementContext:native},'context-first');assert.deepEqual(g.bounds(),manual);assert.equal(g.report().textBoxControls.count,4);assert.equal(g.report().textBoxControls.geometryContext.elementId,'text-B')})
check('foreign first handoff without cache uses defaults until own bounds arrive',()=>{const g=nativeGeometry({targetElementId:'text-B',initialDraft:null,existingTextTarget:{elementId:'text-B',generationConfig:{count:1}},elementContext:native});assert.equal(g.bounds().start_col,2);assert.equal(g.report().textBoxControls.geometryContext,null);const next={...g.all,elementContext:{...native,elementId:'text-B',startCol:19,width:10}};g.instance.render(next);g.instance.effect('!elementContext');g.instance.render(next);assert.equal(g.bounds().start_col,19);assert.equal(g.bounds().position_width,10)})
check('confirmed native replacement releases stale explicit geometry',()=>{const g=nativeGeometry({targetElementId:'replacement-C',elementContext:{...native,elementId:'replacement-C'},existingTextTarget:{elementId:'replacement-C',generationConfig:{count:1}}});assert.equal(g.bounds().start_col,3);assert.equal(g.report().textBoxControls.geometryEdited,false)})
check('position Auto uses current native bounds and Manual starts there',()=>{const g=nativeGeometry();let t=g.instance.render(g.all);position(t).onChange({...manual,auto_position:true,start_col:2,start_row:4,position_width:10,position_height:6});position(t).onAdvancedModified();g.instance.render(g.all);assert.deepEqual(g.bounds(),{...manual,auto_position:true,start_col:3,start_row:7,position_width:24,position_height:12});assert.equal(g.report().textBoxControls.geometryEdited,false);t=g.instance.render(g.all);position(t).onChange({...position(t).positionConfig,auto_position:false});g.instance.render(g.all);assert.equal(g.bounds().start_col,3)})
// Actual role callback and catalog effects; valid choices survive refresh, unavailable choices do not.
function role(h,props,value){h.render(props);h.effect('registerMandatoryConfig({');const mandatory=h.picker();mandatory.onChange(value);return h.render(props)}
let roles=harness(),roleTree=mount(roles,base);roleTree=role(roles,base,'slot:logo');const logoPatch=copy(roles.report())
check('Logo routing/count/placeholder contract is the original Image branch',()=>{const result=roles.submit();assert.equal(result.componentType,'IMAGE');assert.equal(result.count,1);assert.equal(result.slotName,'logo');assert.equal(result.imageConfig.placeholder_mode,false);assert.equal(result.advancedModified,false)})
check('Logo raw role survives cached target mount and loading/refresh',()=>{const next={...base,initialDraft:logoPatch,slotCatalogLoading:true};const inst=harness();let t=mount(inst,next);assert.equal(prop(t,n=>n.props?.id==='textbox-role').value,'slot:logo');const ready={...next,slotCatalogLoading:false,slotCatalog:{...catalog,slots:[...catalog.slots].reverse()}};inst.render(ready);inst.effect('selectionForExistingTarget');t=inst.render(ready);assert.equal(prop(t,n=>n.props?.id==='textbox-role').value,'slot:logo')})
check('removed user-chosen role falls back through the original selection helper',()=>{const inst=harness();const props={...base,initialDraft:logoPatch,slotCatalog:{slots:catalog.slots.filter(s=>s.slot_name!=='logo')}};const t=mount(inst,props);assert.equal(prop(t,n=>n.props?.id==='textbox-role').value,'__body_text_auto__')})
check('real target role metadata change invalidates prior choice',()=>{const inst=harness();const props={...base,initialDraft:logoPatch,existingTextTarget:{...saved,semanticRole:'SLIDE_TITLE',slotName:'slide_title',slotKind:'structural'}};const t=mount(inst,props);assert.equal(prop(t,n=>n.props?.id==='textbox-role').value,'slot:slide_title')})
check('catalog refresh does not reset explicit Body Auto for a structural target',()=>{const props={...base,existingTextTarget:{...saved,semanticRole:'SLIDE_TITLE',slotName:'slide_title',slotKind:'structural'}};const inst=harness();mount(inst,props);role(inst,props,'__body_text_auto__');const next={...props,slotCatalog:{...catalog}};inst.render(next);inst.effect('selectionForExistingTarget');const t=inst.render(next);assert.equal(prop(t,n=>n.props?.id==='textbox-role').value,'__body_text_auto__')})
for(const [value,semantic,kind] of [['slot:slide_title','SLIDE_TITLE','structural'],['slot:slide_subtitle','SLIDE_SUBTITLE','structural'],['slot:footer','FOOTER','structural'],['slot:sources','SOURCES','system'],['slot:body','BODY_TEXT','body']])check(`${semantic} role retains original count/position/semantic restrictions`,()=>{const inst=harness();mount(inst,{...base,initialDraft:patch});role(inst,{...base,initialDraft:patch},value);const result=inst.submit();assert.equal(result.componentType,'TEXT_BOX');assert.equal(result.semanticRole,semantic);assert.equal(result.slotKind,kind);assert.equal(result.count,kind==='body'?4:1);assert.equal(result.compose,kind==='body');assert.equal(result.positionConfig===undefined,kind!=='body')})
check('wrong-owner target metadata cannot reset a cached active role',()=>{const b=copy(logoPatch);b.textBoxControls.roleContext=JSON.stringify(['text-B',null,null,null,null]);const props={...base,targetElementId:'text-B',existingTextTarget:saved,initialDraft:b};const inst=harness();const t=mount(inst,props);assert.equal(prop(t,n=>n.props?.id==='textbox-role').value,'slot:logo')})
check('inherited layout feasibility still clamps impossible count and arrangement',()=>{const inst=harness();let t=mount(inst,{...base,initialDraft:patch,elementContext:{...native,width:4,height:3}});inst.effect('!feasibleCounts.includes(count)');t=inst.render({...base,initialDraft:patch,elementContext:{...native,width:4,height:3}});assert.equal(inst.report().textBoxControls.count,1);assert.equal(inst.report().textBoxControls.layoutChoice,'auto')})
check('raw zero manual typography survives cache before original effective mapping',()=>{const inst=harness();let t=mount(inst,base);font(t,'content').onChange('content_font_size','0px');inst.render(base);assert.equal(inst.report().textBoxControls.manualGeometryOverrides.content_font_size_px,0)})
check('Auto font deletes sparse override without changing the original Manual UI mode',()=>{const inst=harness();let t=mount(inst,{...base,initialDraft:patch});font(t,'content').onChange('content_font_size',null);inst.render({...base,initialDraft:patch});assert.equal(inst.report().textBoxControls.manualGeometryOverrides.content_font_size_px,undefined);assert.equal(inst.report().textBoxControls.geometryMode,'MANUAL')})
// Parent hydration expressions and actual target-owned map are unchanged; execute them with leaf reports.
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
 const draftsRef={current:new Map()},context={studio:true,panelIntentRevisionRef:{current:0},draftKey:'element:text-A',draftsRef,setDraftVersion:()=>{},cloneFormDataForDraft:copy}
 vm.runInNewContext(ts.transpileModule('('+update+')(patch)',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{...context,patch})
 const draft=draftsRef.current.get('element:text-A');let prompt,advanced
 const effectiveDraft=vm.runInNewContext(effective,{draft,persistedGenerationDraft:persisted})
 vm.runInNewContext(ts.transpileModule('('+hydration+')()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{effectiveDraft,readObject:v=>v&&typeof v==='object'?v:null,setPrompt:v=>prompt=v,setShowAdvanced:v=>advanced=v})
 return {prompt,advanced}
}
check('untouched prompt/Advanced actual leaf-map-parent hydration survives',()=>assert.deepEqual(reopenFromActualReport(patch,{prompt:base.prompt,showAdvanced:true}),{prompt:base.prompt,advanced:true}))
check('deliberately blank prompt/collapsed Advanced survives actual parent hydration',()=>{const inst=harness();mount(inst,{...base,prompt:'',showAdvanced:false});assert.deepEqual(reopenFromActualReport(inst.report(),{prompt:base.prompt,showAdvanced:true}),{prompt:'',advanced:false})})
check('full Builder differs only by reviewed Text Box native-context admission',()=>{const f='app/builder/page.tsx';assert.equal(fs.readFileSync(new URL(f,root),'utf8').replace(" && generationPanel.elementType !== 'TEXT_BOX'",''),execFileSync('git',['show','c2d9a7c:'+f],{cwd:root,encoding:'utf8'}))})
check('full GenerationPanel differs only by forwarding Text Box draft/owner props',()=>{const f='components/generation-panel/index.tsx';assert.equal(fs.readFileSync(new URL(f,root),'utf8').replace('slotCatalogError={slotCatalogError} existingTextTarget={existingTextTarget} initialDraft={initialDraft} onDraftChange={onDraftChange} targetElementId={targetElementId} />','slotCatalogError={slotCatalogError} existingTextTarget={existingTextTarget} />'),execFileSync('git',['show','c2d9a7c:'+f],{cwd:root,encoding:'utf8'}))})
console.log(`${checks} actual Text Box form/parent/catalog checks passed; offline only.`)
