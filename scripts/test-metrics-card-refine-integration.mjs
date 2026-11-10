// New current-source successor; prior chat-add accepted evidence is untouched.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = path.resolve(new URL('../',import.meta.url).pathname)
const outputDir = path.join(root,'docs/studio-v4/eight-hour-parity-20261005/builder1/metrics-refine/evidence/integrated')
const require = createRequire(import.meta.url), cache=new Map(),hashes={},diagnostics=[]
const hash=source=>crypto.createHash('sha256').update(source).digest('hex')
let activeScope, activeFetch
const runtimeProcess={env:{NEXT_PUBLIC_STUDIO_V4_SHELL:'true'}}
const equalDeps=(left,right)=>left?.length===right?.length&&left.every((value,index)=>Object.is(value,right[index]))
// Explicit isolated binding adapter, not React scheduling. State/ref/effect slots
// exercise the complete actual hooks and their own callbacks across requested renders.
const hooks={
  useRef(value){const scope=activeScope,index=scope.cursor++;return scope.slots[index]??=( {current:value} )},
  useState(value){const scope=activeScope,index=scope.cursor++;if(!(index in scope.slots))scope.slots[index]=typeof value==='function'?value():value;return[scope.slots[index],next=>{const old=scope.slots[index],resolved=typeof next==='function'?next(old):next;if(!Object.is(old,resolved)){scope.slots[index]=resolved;scope.dirty=true}}]},
  useCallback(callback,deps){const scope=activeScope,index=scope.cursor++,old=scope.slots[index];if(!old||!equalDeps(deps,old.deps))scope.slots[index]={value:callback,deps};return scope.slots[index].value},
  useMemo(callback,deps){const scope=activeScope,index=scope.cursor++,old=scope.slots[index];if(!old||!equalDeps(deps,old.deps))scope.slots[index]={value:callback(),deps};return scope.slots[index].value},
  useEffect(callback,deps){const scope=activeScope,index=scope.cursor++,old=scope.slots[index];if(!old||!equalDeps(deps,old.deps)){scope.pending.push(()=>{old?.cleanup?.();scope.slots[index]={deps,cleanup:callback()}})}},
}
const createScope=()=>({slots:[],cursor:0,pending:[],dirty:false})
function render(scope,callback){const previous=activeScope;let result,iterations=0;do{scope.cursor=0;scope.pending=[];scope.dirty=false;activeScope=scope;result=callback();scope.pending.forEach(effect=>effect());assert.ok(++iterations<20,'Isolated render settles')}while(scope.dirty);activeScope=previous;return result}
function load(file){
  if(cache.has(file))return cache.get(file).exports
  const source=fs.readFileSync(file,'utf8'),module={exports:{}};cache.set(file,module);hashes[path.relative(root,file)]=hash(source)
  const snapshot=path.join(outputDir,'sources',path.relative(root,file));fs.mkdirSync(path.dirname(snapshot),{recursive:true});fs.writeFileSync(snapshot,source)
  const output=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}})
  assert.equal(output.diagnostics?.filter(item=>item.category===ts.DiagnosticCategory.Error).length??0,0)
  vm.runInNewContext(output.outputText,{module,exports:module.exports,process:runtimeProcess,Error,TypeError,DOMException,AbortController,crypto,URL,Date,Map,Set,setTimeout,clearTimeout,
    fetch:(...args)=>activeFetch(...args),WebSocket:()=>{throw Error('Witness refuses network')},console:{...console,log(){},info(){},warn:(...values)=>diagnostics.push(values.map(String)),error:(...values)=>diagnostics.push(values.map(String))},
    require:spec=>spec==='react'?hooks:spec.startsWith('@/')?load(path.join(root,spec.slice(2)+'.ts')):require(spec)}, {filename:path.relative(root,file)})
  return module.exports
}
const {useTextLabsGeneration}=load(path.join(root,'hooks/use-textlabs-generation.ts'))
const {useGenerationPanel}=load(path.join(root,'hooks/use-generation-panel.ts'))
const {buildFormDataForDirective}=load(path.join(root,'lib/mdc-element-directive.ts'))
const clone=value=>JSON.parse(JSON.stringify(value))
const retained=panel=>clone({isOpen:panel.isOpen,blankElementId:panel.blankElementId,editElementId:panel.editElementId,mode:panel.mode,refineContext:panel.refineContext,draftKey:panel.draftKey,currentDraft:panel.currentDraft})
const observations=[]
async function exercise(name,options={}){
  const panelScope=createScope(),generationScope=createScope(),commands=[],payloads=[],errors=[],generating=[],panelCalls=[],blankCalls=[],toasts=[]
  const renderPanel=()=>render(panelScope,useGenerationPanel)
  let panel=renderPanel()
  const refineContext={elementId:'synthetic-original-id',elementType:'TEXT_BOX',slideIndex:1,existingElement:{html:'<p>Original retained</p>'},research:{session_id:null,store_name:null},prompt:'Synthetic original prompt',startCol:2,startRow:2,width:10,height:5}
  if(options.refine){panel.openPanelForRefine('TEXT_BOX',refineContext);panel=renderPanel()}
  if(options.blank){panel.openPanelForElement('TEXT_BOX','synthetic-original-id');panel=renderPanel()}
  if(options.refine||options.blank){panel.updateCurrentDraft({prompt:'Original closed prompt',showAdvanced:true,formData:buildFormDataForDirective('TEXT_BOX','Original draft form')});panel=renderPanel();if(!options.openPanel){panel.closePanel();panel=renderPanel()}}
  const before=retained(panel)
  const target=options.target??2,currentSlide=options.currentSlide??0
  const generationPanel={...panel,setError:value=>{errors.push(value);panel.setError(value)},setIsGenerating:value=>{generating.push(value);panel.setIsGenerating(value)}}
  for(const method of ['rememberDraftForElement','openPanelForRefine','completeBlankReplacement','resumePanelForElement','openPanelForElement','closePanel'])generationPanel[method]=(...args)=>{panelCalls.push({method,args:clone(args)});return panel[method](...args)}
  const blankElements={}
  for(const method of ['getElement','updatePosition','setStatus','updateGenerationMetadata','removeElement','addElement','trackElement'])blankElements[method]=(...args)=>{blankCalls.push({method,args:clone(args)});return method==='getElement'&&options.blank?{elementId:'synthetic-original-id',componentType:'TEXT_BOX',slideIndex:1,startCol:2,startRow:2,width:10,height:5,status:'blank'}:undefined}
  let sessionCalls=0
  const api=options.noViewer?null:{sendElementCommand:async(action,params)=>{
    commands.push({action,params:clone(params)})
    if(action==='getSlideGenerationContext')return{success:true,slide_index:params.slideIndex,elements:[]}
    if(action==='getElementGeometry')return{success:true,action,elementId:params.elementId,position:{gridRow:'2/7',gridColumn:'2/12'},componentType:'TEXT_BOX'}
    if(action==='deleteElement'&&params.elementId==='synthetic-original-id'){
      if(options.deleteAmbiguous){const error=new Error('Synthetic ambiguous original deletion');error.code='LAYOUT_MUTATION_AMBIGUOUS';throw error}
      if(options.deleteRefused)return{success:false,error:'Synthetic original deletion refusal'}
    }
    if(action.startsWith('insert')||action.startsWith('upsert'))return options.insertRefused?{success:false,error:'Synthetic native insertion refusal'}:options.missingId?{success:true}:{success:true,elementId:'synthetic-native-id'}
    return{success:true}
  }}
  const params={generationPanel,blankElements,textLabsSession:{ensureSession:async()=>{sessionCalls++;if(options.sessionFailure)throw Error('Synthetic session setup failure');return'synthetic-session'}},layoutServiceApis:api,
    presentationId:'synthetic-owned-presentation',currentSlideIndex:currentSlide,getCurrentSlideIndex:()=>currentSlide,researchCapabilities:{web:false,uploadedDocuments:false,knowledgeGraph:false},
    getThemeSyncSnapshot:()=>({status:'idle'}),ensureThemeReady:async()=>({ready:false,error:'Synthetic missing theme'}),toast:value=>toasts.push(value)}
  const renderGeneration=()=>render(generationScope,()=>useTextLabsGeneration(params))
  const driver=renderGeneration()
  activeFetch=async(url,init)=>{
    assert.ok(String(url).endsWith('/api/chat/message'));assert.equal(init.method,'POST');payloads.push(JSON.parse(init.body))
    if(options.ownerChange||options.ownerABA){params.presentationId='synthetic-other-presentation';renderGeneration();if(options.ownerABA){params.presentationId='synthetic-owned-presentation';renderGeneration()}}
    if(options.unmount)generationScope.slots.forEach(value=>value?.cleanup?.())
    return{ok:true,status:200,headers:{get:()=>null},json:async()=>options.emptyResponse?{elements:[]}:{elements:[{element_id:'synthetic-generator-id',component_type:'TEXT_BOX',html:'<p>Synthetic new</p>',content:'<p>Synthetic new</p>'}]}}
  }
  const form=buildFormDataForDirective('TEXT_BOX','Synthetic chat add prompt');form.slideIndex=8
  const invocation=options.panelInvocation?undefined:{kind:'chat-add',slideIndex:target}
  const result=await driver.handleGenerate(form,'generate',invocation)
  panel=renderPanel()
  const after=retained(panel),deletes=commands.filter(item=>item.action==='deleteElement').map(item=>item.params.elementId),inserts=commands.filter(item=>item.action.startsWith('insert')||item.action.startsWith('upsert'))
  assert.equal(result.status,options.failure?'failed':'inserted',name)
  assert.equal(generating.at(-1),false);assert.equal(panel.hasActiveGenerations,false,'Actual panel active generation registry cleared')
  if(!options.panelInvocation){assert.deepEqual(after,before,'Actual closed retained mode/target/draft unchanged');assert.equal(panelCalls.length,0,'Chat add must not remember or activate any element panel');assert.equal(blankCalls.length,0,'Chat add must not touch retained placeholder tracking');assert.deepEqual(deletes,[]);assert.equal(commands.some(item=>item.action==='getElementGeometry'||item.action==='setElementGenerationState'),false)}
  if(!options.failure){assert.equal(result.slideIndex,options.panelInvocation?1:target);assert.deepEqual(Array.from(result.elementIds),['synthetic-native-id']);assert.ok(inserts.length===1);assert.equal(inserts[0].params.slideIndex,options.panelInvocation?1:target)}
  if(payloads.length&&!options.panelInvocation){assert.equal(payloads[0].slide_index,target);assert.equal(payloads[0].refine,undefined,'Chat add payload cannot inherit old refine request');assert.equal(payloads[0].existing_element,undefined)}
  if(options.ownerChange||options.ownerABA||options.unmount)assert.equal(inserts.length,0,'Actual epoch/mounted authority prevents stale native insertion')
  if(options.panelInvocation&&options.deleteRefused)assert.deepEqual(deletes,['synthetic-original-id','synthetic-native-id'])
  if(options.panelInvocation&&options.deleteAmbiguous)assert.deepEqual(deletes,['synthetic-original-id'])
  observations.push({name,result,sessionCalls,commands,payloads,panelCalls,blankCalls,beforePanel:before,afterPanel:after,panelError:panel.error,retryStrategy:panel.retryStrategy,generating,toasts,cleanupCompleted:true})
}
for(const[name,options]of[
  ['chat_add_ack_direct_explicit_target_overrides_form_and_current_slide',{}],
  ['chat_add_closed_refine_target_and_draft_preserved',{refine:true}],
  ['chat_add_closed_blank_tracking_and_draft_preserved',{blank:true}],
  ['chat_add_closed_refine_session_failure_recovery_preserves_draft',{refine:true,sessionFailure:true,failure:true}],
  ['chat_add_closed_blank_empty_response_recovery_preserves_draft',{blank:true,emptyResponse:true,failure:true}],
  ['chat_add_closed_refine_native_refusal_preserves_original',{refine:true,insertRefused:true,failure:true}],
  ['chat_add_closed_blank_missing_native_id_no_guessed_cleanup',{blank:true,missingId:true,failure:true}],
  ['chat_add_missing_viewer_cleanup',{blank:true,noViewer:true,failure:true}],
  ['chat_add_presentation_change_before_native_insert',{refine:true,ownerChange:true,failure:true}],
  ['chat_add_presentation_ABA_epoch_refuses_before_native_insert',{blank:true,ownerABA:true,failure:true}],
  ['chat_add_hook_unmount_refuses_before_native_insert',{refine:true,unmount:true,failure:true}],
  ['panel_refine_without_invocation_keeps_existing_replacement_contract',{refine:true,panelInvocation:true}],
  ['panel_refine_delete_refusal_rolls_back_native_ack_copy',{refine:true,panelInvocation:true,deleteRefused:true,failure:true}],
  ['panel_refine_ambiguous_delete_retains_native_ack_copy',{refine:true,panelInvocation:true,deleteAmbiguous:true,failure:true}],
])await exercise(name,options)
// Extracted current MetricsForm initialization/target effects (same bounded
// witness as pure-helper packet) added to complete actual generation+panel run.
const source=(_ref,file)=>fs.readFileSync(path.join(root,file),'utf8')
const pure=file=>load(path.join(root,file))
const parse=text=>ts.createSourceFile('actual.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const compile=text=>ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
function state(){const cells=[];let cursor=0,effects=[];return {react:{useState(initial){const i=cursor++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return[cells[i],next=>{cells[i]=typeof next==='function'?next(cells[i]):next}]},useRef(initial){const i=cursor++;if(!(i in cells))cells[i]={current:initial};return cells[i]},useCallback:fn=>fn,useMemo:fn=>fn(),useEffect:fn=>effects.push(fn)},start(){cursor=0;effects=[]},flush(){effects.forEach(fn=>fn())}}}
function form(draft,card){const text=source('current','components/generation-panel/forms/metrics-form.tsx');hashes['components/generation-panel/forms/metrics-form.tsx']=hash(text);const snapshot=path.join(outputDir,'sources/components/generation-panel/forms/metrics-form.tsx');fs.mkdirSync(path.dirname(snapshot),{recursive:true});fs.writeFileSync(snapshot,text);const ast=parse(text),fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='MetricsForm');assert.ok(fn)
 const setup=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&['asRecord','stringValue','numberValue','booleanValue','sanitizeSavedMetricsConfig','readSavedMetricsGenerationConfig'].includes(node.name?.text)).map(node=>node.getText(ast)).join('\n')
 const constants=ast.statements.filter(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>['TYPOGRAPHY_VISUAL_FIELDS','LAYOUT_CHOICE_VALUES','MULTI_BOX_COLOR_VALUES'].includes(d.name.getText(ast)))).map(node=>node.getText(ast)).join('\n')
 const cut=fn.body.statements.findIndex(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(ast)==='updateVisualOverride'));assert.ok(cut>0)
 const prefix=fn.body.statements.slice(0,cut).map(node=>node.getText(ast)).join('\n')
 const h=state(),context={...h.react,...pure('lib/metrics-layout.ts'),DEFAULTS:pure('types/textlabs.ts').TEXT_LABS_ELEMENT_DEFAULTS.METRICS,STUDIO_SPECIALIST_FORMS:runtimeProcess.env.NEXT_PUBLIC_STUDIO_V4_SHELL==='true'};vm.runInNewContext(compile(`${setup}\n${constants}\nglobalThis.renderForm=(${fn.parameters[0].getText(ast)})=>{${prefix};return {count,layoutChoice,positionConfig,resolvedLayout,fitMode,manualOverrides,visualOverrides,paddingConfig,zIndex,multiBoxColorMode};}`),context)
 const props={initialDraft:draft,elementContext:{elementId:card.elementId,startCol:card.position.start_col,startRow:card.position.start_row,width:card.position.position_width,height:card.position.position_height},targetElementId:card.elementId,existingTextTarget:{elementId:card.elementId,generationConfig:draft.formData?.generationConfig},registerMandatoryConfig:()=>{},prompt:draft.prompt,showAdvanced:draft.showAdvanced};let result
 for(let i=0;i<3;i++){h.start();result=context.renderForm(props);h.flush()}
 return result
}
async function metrics(studio,cited=false,returned=true,missingId=false){
 runtimeProcess.env.NEXT_PUBLIC_STUDIO_V4_SHELL=studio?'true':'false'
 const panelScope=createScope(),generationScope=createScope(),commands=[],payloads=[],panelCalls=[],toasts=[];const renderPanel=()=>render(panelScope,useGenerationPanel);let panel=renderPanel()
 // A new generation target, deliberately not a tracked blank: no source
 // geometry inference is needed and the panel remains open for auto-refine.
 panel.openPanelForEdit('METRICS','synthetic-generation-target');panel=renderPanel()
 const parent={start_col:2,start_row:4,position_width:8,position_height:5,auto_position:false},boxes=pure('lib/metrics-layout.ts').resolveMetricsLayout(parent,3,'horizontal').boxes
 const submittedConfig={version:1,componentType:'METRICS',count:3,metricsLayoutChoice:'horizontal',layout:'horizontal',metricsFitMode:'MANUAL',manualMetricsOverrides:{value_font_size:'20px'},metricsConfig:{color_scheme:'accent',color_variant:'blue',value_bold:false,layout:'horizontal'},multiBoxColorMode:'THEME_SEQUENCE',unknown_generator_state:{submitted:true}}
 const submitted={componentType:'METRICS',prompt:'Synthetic three-card metrics',count:3,layout:'horizontal',metricsLayoutChoice:'horizontal',compose:true,elements:boxes.map(grid_position=>({grid_position})),metricsConfig:submittedConfig.metricsConfig,metricsFitMode:'MANUAL',manualMetricsOverrides:submittedConfig.manualMetricsOverrides,generationConfig:submittedConfig,positionConfig:parent,useDeckTheme:false,themeOverrides:{primary:'#123456'},multiBoxColorMode:'THEME_SEQUENCE',paddingConfig:{top:0.2,right:0,bottom:0,left:0},z_index:1050}
 const controls={count:3,layoutChoice:'horizontal',positionConfig:parent,geometryContext:{elementId:'synthetic-generation-target',startCol:2,startRow:4,width:8,height:5},geometryEdited:false,multiBoxColorMode:'THEME_SEQUENCE',visualOverrides:submittedConfig.metricsConfig,fitMode:'MANUAL',manualOverrides:submittedConfig.manualMetricsOverrides,positionModified:true,paddingModified:true,paddingConfig:submitted.paddingConfig,zIndex:1050,sections:{instances:true,cardDesign:true,value:true,label:false,description:false,spacing:false,positioning:true,padding:true}}
 panel.updateCurrentDraft({formData:submitted,metricsControls:controls,prompt:submitted.prompt,showAdvanced:true});panel=renderPanel();const originalDraft=clone(panel.currentDraft),originalConfig=clone(submitted.generationConfig),originalElements=clone(submitted.elements),intent=panel.getIntentRevision()
 let insertion=0;const api={sendElementCommand:async(action,params)=>{commands.push({action,params:clone(params)});if(action==='getSlideGenerationContext')return{success:true,slide_index:params.slideIndex,elements:[]};if(action==='getElementGeometry'){const i=Number(params.elementId.split('-').at(-1));const p=boxes[i];return{success:true,action,elementId:params.elementId,position:{gridRow:`${p.start_row}/${p.start_row+p.position_height}`,gridColumn:`${p.start_col}/${p.start_col+p.position_width}`},componentType:'METRICS'}};if(action.startsWith('insert')||action.startsWith('upsert')){const i=insertion++;return missingId?{success:true}:{success:true,elementId:`synthetic-ack-metric-${i}`}};return{success:true}}}
 const generationPanel={...panel};for(const method of ['rememberDraftForElement','openPanelForRefine'])generationPanel[method]=(...args)=>{panelCalls.push({method,args:clone(args)});return panel[method](...args)}
 const params={generationPanel,blankElements:{getElement:()=>undefined},textLabsSession:{ensureSession:async()=> 'synthetic-session'},layoutServiceApis:api,presentationId:'synthetic-metrics-presentation',currentSlideIndex:1,getCurrentSlideIndex:()=>1,researchCapabilities:{web:false,uploadedDocuments:false,knowledgeGraph:false},getThemeSyncSnapshot:()=>({status:'idle'}),ensureThemeReady:async()=>({ready:false,error:'must not be used'}),toast:value=>toasts.push(value)}
 const driver=render(generationScope,()=>useTextLabsGeneration(params));activeFetch=async(url,init)=>{assert.ok(String(url).endsWith('/api/chat/message'));payloads.push(JSON.parse(init.body));return{ok:true,status:200,headers:{get:()=>null},json:async()=>({elements:boxes.map((grid_position,i)=>({element_id:`synthetic-service-metric-${i}`,component_type:'METRICS',html:`<p>Synthetic value ${i}</p>`,grid_position,style_owner:'text_service',theme_variant_id:`synthetic-card-theme-${i}`,theme_bindings:{value:`synthetic-value-binding-${i}`},metrics_color_variant:['blue','yellow','red'][i],research_provenance:{source:`synthetic-card-source-${i}`},citations_used:cited?[{key:`synthetic-citation-${i}`}]:[],generation_config:returned?{...submittedConfig,unknown_generator_state:{returned_card:i},resolved_metrics_profile:{authored_card:i}}:undefined}))})}}
 const result=await driver.handleGenerate(submitted,'generate');panel=renderPanel()
 assert.equal(result.status,missingId?'failed':'inserted');assert.equal(payloads.length,1);assert.equal(payloads[0].count,3);assert.equal(payloads[0].compose,true);assert.equal(payloads[0].metrics_config.layout,'horizontal');assert.deepEqual(clone(submitted.generationConfig),originalConfig);assert.deepEqual(clone(submitted.elements),originalElements)
 const inserts=commands.filter(x=>x.action.startsWith('insert')||x.action.startsWith('upsert'))
 if(missingId){assert.equal(panelCalls.length,0,'No new per-card draft/context from missing native identity');assert.equal(panel.editElementId,'synthetic-generation-target');assert.deepEqual(clone(panel.currentDraft),originalDraft)}else{
  assert.equal(inserts.length,3);assert.equal(panel.editElementId,'synthetic-ack-metric-0');assert.equal(panel.mode,'refine');assert.deepEqual(Array.from(result.elementIds),['synthetic-ack-metric-0','synthetic-ack-metric-1','synthetic-ack-metric-2'])
  const expectedCount=studio?1:3;assert.equal(panel.refineContext.generationConfig.count,expectedCount);assert.equal(panel.refineContext.existingElement.generation_config.count,expectedCount)
  for(let i=0;i<3;i++){const request=inserts[i],persisted=request.action==='upsertCitedElement'?request.params.metadata.generationConfig:request.params.generationConfig;assert.equal(persisted.count,expectedCount);assert.equal(persisted.metricsLayoutChoice,studio?'auto':'horizontal');assert.deepEqual(clone(persisted.unknown_generator_state),returned?{returned_card:i}:{submitted:true});assert.equal(request.params.componentType,'METRICS');assert.deepEqual(clone(request.params.citationsUsed),cited?[{key:`synthetic-citation-${i}`}]:[]);const perCardMetadata=request.params.metadata??request.params;assert.equal(perCardMetadata.themeVariantId,`synthetic-card-theme-${i}`);assert.deepEqual(clone(perCardMetadata.themeBindings),{value:`synthetic-value-binding-${i}`});assert.deepEqual(clone(perCardMetadata.researchProvenance),{source:`synthetic-card-source-${i}`});assert.equal(perCardMetadata.metricsColorVariant,['blue','yellow','red'][i]);assert.equal(persisted.metricsFitMode,'MANUAL');assert.deepEqual(clone(persisted.manualMetricsOverrides),{value_font_size:'20px'})
   const remembered=panelCalls.filter(x=>x.method==='rememberDraftForElement')[i];assert.equal(remembered.args[0],`synthetic-ack-metric-${i}`);assert.equal(remembered.args[1].count,3);if(studio){assert.deepEqual(remembered.args[2],{elementId:`synthetic-ack-metric-${i}`,elementType:'METRICS'});assert.equal(remembered.args[2].position,undefined)}else assert.equal(remembered.args[2],null)
   panel.openPanelForRefine('METRICS',{...panel.refineContext,elementId:`synthetic-ack-metric-${i}`,researchProvenance:{}});panel=renderPanel();assert.equal(panel.currentDraft.formData.count,expectedCount);assert.equal(panel.currentDraft.metricsControls.count,expectedCount);if(studio){assert.equal(panel.currentDraft.metricsControls.positionConfig,undefined);assert.equal(panel.currentDraft.metricsControls.geometryContext,undefined)}
   // Independent synthetic native geometry read after identity ACK: no sent
   // insertion bounds are copied into the per-card draft.
   const native=await api.sendElementCommand('getElementGeometry',{elementId:`synthetic-ack-metric-${i}`});const parsed=pure('lib/element-geometry.ts').parseGetElementGeometryResponse(native,`synthetic-ack-metric-${i}`);const evaluated=form(panel.currentDraft,{elementId:`synthetic-ack-metric-${i}`,position:{start_col:parsed.startCol,start_row:parsed.startRow,position_width:parsed.width,position_height:parsed.height}});assert.equal(evaluated.count,expectedCount);assert.equal(evaluated.layoutChoice,studio?'auto':'horizontal');assert.equal(evaluated.resolvedLayout.viable,studio)
  }
  panel.openPanelForEdit('METRICS','synthetic-generation-target');panel=renderPanel();assert.deepEqual(clone(panel.currentDraft),originalDraft);assert.equal(panel.currentDraft.formData.count,3)
  // Every automatic completion call consists only of remembering each card and
  // one openPanelForRefine; remember calls never claim a new user intent.
  assert.equal(panelCalls.filter(x=>x.method==='openPanelForRefine').length,1);assert.equal(panelCalls.filter(x=>x.method==='rememberDraftForElement').length,3)
 }
 assert.equal(panel.hasActiveGenerations,false);observations.push({name:`metrics_${studio?'studio':'classic'}_${cited?'cited':'plain'}_${returned?'returned':'submitted'}_${missingId?'missing_identity':'ack'}`,result,commands,payloads,panelCalls,originalDraft,retainedGenerationDraft:clone(panel.currentDraft),intentAtStart:intent,limitation:'Synthetic request/native responses; current actual complete hooks and extracted form effects; no browser/services/persistence'})
}
for(const scenario of [[true,false,true],[true,true,true],[true,false,false],[false,false,true],[false,true,true],[true,false,true,true]])await metrics(...scenario)
const receipt={timestamp:new Date().toISOString(),level:'Current complete useTextLabsGeneration + useGenerationPanel and actual request/insertion/metadata libraries; isolated explicit hook bindings and extracted Metrics form initialization/target effects. Synthetic service/native identity/geometry only; no React DOM, browser, socket, network or connected persistence proof.',observations,sourceHashes:hashes,scriptSha256:hash(fs.readFileSync(new URL(import.meta.url))),diagnostics}
fs.mkdirSync(outputDir,{recursive:true});fs.writeFileSync(path.join(outputDir,'whole-hook-receipt.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(`Integrated whole generation/panel hooks: ${observations.length} scenarios pass (14 chat-add/retained/owner/replacement + 6 Metrics Studio/classic/metadata/identity); no connected claim.`)
