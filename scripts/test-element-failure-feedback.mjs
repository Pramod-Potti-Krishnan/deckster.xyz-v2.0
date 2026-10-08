// Offline actual-hook/client/GenerationInput feedback proof; no live opt-in.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

for (const name of Object.keys(process.env)) if (/KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD/i.test(name)) delete process.env[name]
let blockedSockets = 0
const denied = () => { blockedSockets++; throw new Error('Offline harness forbids network') }
net.connect = net.createConnection = net.Socket.prototype.connect = denied
http.request = http.get = https.request = https.get = denied
globalThis.fetch = denied
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = '30c9fc9e62cdb56601e6090486914ab1780c072d'
const FLAG = 'NEXT_PUBLIC_ELEMENT_FAILURE_IMMEDIATE_FEEDBACK_ENABLED'
const out = process.env.ELEMENT_FAILURE_PROOF_DIR || '/private/tmp/element3-fe-error-delay-proof-20261008'
fs.mkdirSync(out, { recursive: true })
const gitEnv = { ...process.env }; delete gitEnv.GIT_DIR; delete gitEnv.GIT_WORK_TREE
const sourceCache = new Map(), compileCache = new Map()
const read = (file, ref) => { const key = `${ref ?? 'working'}:${file}`; if (!sourceCache.has(key)) sourceCache.set(key, ref ? execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, env: gitEnv, encoding: 'utf8' }) : fs.readFileSync(path.join(root, file), 'utf8')); return sourceCache.get(key) }
const hash = text => createHash('sha256').update(text).digest('hex')
const clone = value => JSON.parse(JSON.stringify(value))
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve() }
const compile = source => { const key=hash(source); if(!compileCache.has(key)) compileCache.set(key,ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText); return compileCache.get(key) }

function runtime({ ref, flag, type = 'SHAPE', scenario = 'restore', backend = 'success', studio = true, refine = false, cleanupDelay = 0, sessionDelay = 0, delay = 2000 } = {}) {
  let now = 0, timerId = 0, uuid = 0, refCursor = 0, effectCursor = 0, revision = 0
  let snapshotLag=false, lagSnapshot=null,resumeAction=null,trackAction=null
  const activeBusyKeys=new Set()
  const targetKey=()=>panel.blankElementId?`blank:${panel.blankElementId}`:panel.editElementId?`element:${panel.editElementId}`:panel.elementType
  let blankDeleteCount = 0, inserted = 0, leaseCurrent = true, throwCompletion = scenario.startsWith('restore')
  const timers = new Map(), refs = [], effectStates = [], pendingEffects = [], sourceHashes = {}, cache = new Map()
  const controllers=[]
  class TrackedController extends AbortController {constructor(){super();controllers.push(this)}}
  const events = [], requests = [], commands = [], toasts = []
  const panel = { blankElementId: refine ? null : 'blank-1', editElementId: refine ? 'original-1' : null,
    isOpen: true, elementType: type, isGenerating: false, error: null, retryStrategy: null,
    mode: refine ? 'refine' : 'generate', refineContext: refine ? { elementId: 'original-1', elementType: type, slideIndex: 0, research:{},existingElement:{component_type:type,content:'<div>Offline original</div>'},gridPosition: {start_col:5,start_row:4,position_width:10,position_height:6}, element: {html:'<div>Original</div>'} } : null,
    researchMode: 'off', researchWeb: false, researchUploadedDocs: false, researchKnowledgeGraph: false }
  const blank = { elementId: 'blank-1', componentType: type, slideIndex: 0, startCol: 5, startRow: 4, width: 10, height: 6, status: 'blank' }
  const blanks = new Map([['blank-1', blank]])
  const stamp = (event, extra = {}) => events.push({ at: now, event, ...extra })
  const setTimer = (fn, ms) => { const id = ++timerId; timers.set(id, {at: now + ms, fn}); return id }
  const clearTimer = id => timers.delete(id)
  const sleep = ms => new Promise(resolve => setTimer(resolve, ms))
  class ClockDate extends Date { static now() { return now } }
  const hookReact = { ...React,
    useRef(value) { const i = refCursor++; return refs[i] ??= {current:value} },
    useCallback: fn => fn,
    useEffect(fn,deps) { const i = effectCursor++, before = effectStates[i]; if (!before || deps.some((v,j) => !Object.is(v,before.deps[j]))) pendingEffects.push(() => {before?.cleanup?.();effectStates[i]={deps,cleanup:fn()}}) },
  }
  const environment = {NEXT_PUBLIC_ELEMENTOR_URL:'https://textlabs.example.test', NEXT_PUBLIC_STUDIO_V4_SHELL:studio?'true':'false', NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED:'true'}
  if (flag !== undefined) environment[FLAG] = flag
  const component = () => ({component_type:type, html:'<div>Offline generated element</div>', image_url:'https://offline.invalid/image.svg', content:'<div>Offline generated element</div>',grid_position:{start_col:5,start_row:4,position_width:10,position_height:6}})
  function load(file, rendering = false) {
    const key = `${rendering}:${file}`; if (cache.has(key)) return cache.get(key)
    const mod = {exports:{}}; cache.set(key,mod.exports)
    const source = read(file,ref);sourceHashes[file]=hash(source)
    const componentReact = { ...React, useRef: value => ({current:value}), useEffect: () => {} }
    const jsx = id => {
      if (id === 'react') return rendering ? componentReact : hookReact
      if (id === 'react/jsx-runtime') return jsxRuntime
      if (id === 'lucide-react') return new Proxy({}, {get:() => () => null})
      if (id === '@/components/ui/popover') return {Popover:({children})=>children,PopoverContent:({children})=>children,PopoverTrigger:({children})=>children}
      if (id.endsWith('.css')) return {}
      const relative = id.startsWith('@/') ? id.slice(2) : id.startsWith('.') ? path.normalize(path.join(path.dirname(file),id)) : null
      if (relative) { const ext = ['.ts','.tsx'].find(ext => ref ? (() => {try {read(relative+ext,ref);return true}catch{return false}})() : fs.existsSync(path.join(root,relative+ext))); assert.ok(ext,`Source dependency ${relative}`); return load(relative+ext,rendering) }
      throw new Error(`Unexpected dependency ${id}`)
    }
    vm.runInNewContext(compile(source), {module:mod,exports:mod.exports,process:{env:environment},Date:ClockDate,setTimeout:setTimer,clearTimeout:clearTimer,
      AbortController:TrackedController,AbortSignal,DOMException,FormData,Blob,URL,Error,TypeError,JSON,crypto:{randomUUID:()=>`offline-${++uuid}`},
      console:{log(){},info(){},warn(){},error(label){if(label==='[TextLabs] Generation error:')stamp('failure_formed')}},
      fetch:async (url,init={})=>{
        assert.ok(url.startsWith('https://textlabs.example.test/'),'Only fake Text Labs HTTP allowed')
        requests.push({at:now,url,body:typeof init.body==='string'?init.body:null,signal:init.signal});stamp('http_dispatch')
        if(backend==='transport')throw new TypeError('Failed to fetch')
        if(backend==='abort') { await new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})) }
        const body = ['application','terminal','http','unknown_code','ambiguous_response','grounded','geometry'].includes(backend) ? {success:false,error:backend==='grounded'?'No valid source-backed chart data':backend==='geometry'?'The requested geometry could not be verified.':'Offline provider failure',error_code:backend==='unknown_code'?'UNKNOWN_CANONICAL_CODE':backend==='geometry'?'SHAPE_GEOMETRY_UNVERIFIABLE':'OFFLINE_FAILURE',retryable:!['terminal','geometry'].includes(backend),request_id:'offline-request-123456',downstream_request_id:'offline-diagram-123456',ambiguous_completion:backend==='ambiguous_response',retry_strategy:['terminal','geometry'].includes(backend)?'do_not_retry':backend==='ambiguous_response'?'resume_same_attempt':'start_fresh_attempt'} : {success:true,elements: scenario.startsWith('partial')? [component(),component()]:[component()]}
        return {ok:backend!=='http',status:backend==='http'?503:200,headers:{get:()=>null},json:async()=>body}
      },require:jsx},{filename:file})
    cache.set(key,mod.exports);return mod.exports
  }
  const methods = {
    setIsGenerating:value=>{panel.isGenerating=value;stamp('busy',{value})},
    setError:value=>{panel.error=value;panel.retryStrategy=null;stamp('error',{value})}, setRetryStrategy:value=>{panel.retryStrategy=value;stamp('retry',{value})},
    getSnapshot:()=>{stamp('panel_snapshot');return snapshotLag?lagSnapshot:({...panel})},getIntentRevision:()=>{stamp('panel_revision');return revision},
    closePanel:()=>{revision++;panel.isOpen=false;panel.error=null;stamp('close')},
    rememberDraftForElement:()=>{},openPanelForElement:()=>{},openPanelForRefine:()=>{},changeElementType:()=>{},
    resumePanelForElement:(componentType,elementId)=>{if(scenario==='restore_resume_fail')throw new Error('Offline UI resume failed');revision++;panel.isOpen=true;panel.blankElementId=elementId;panel.elementType=componentType;panel.error=null;panel.retryStrategy=null;stamp('resume_clear');resumeAction?.()},
    completeBlankReplacement:()=>{if(throwCompletion){throwCompletion=false;throw new Error('Offline replacement completion failed')}panel.mode='refine'},
  }
  const params = {presentationId:'offline-feedback',currentSlideIndex:0,researchCapabilities:{},generationPanel:null,
    blankElements:{getElement:id=>blanks.get(id),updatePosition:()=>{},updateGenerationMetadata:()=>{},
      setStatus:(id,status)=>{blank.status=status;stamp('blank_status',{id,status})},removeElement:id=>{blanks.delete(id);stamp('tracking_remove',{id})},
      addElement:info=>{blanks.set(info.elementId,info);stamp('tracking_add',{id:info.elementId})},trackElement:id=>{stamp('track',{id});trackAction?.(id)}},
    textLabsSession:{ensureSession:async signal=>{stamp('session');if(backend==='session')throw new Error('Offline session failed');if(sessionDelay)await new Promise((resolve,reject)=>{setTimer(resolve,sessionDelay);signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})});return 'offline-session'}},
    layoutServiceApis:{sendElementCommand:async(action,args)=>{
      commands.push({at:now,action,args:clone(args)});stamp('command',{action,id:args.elementId??null})
      if(action==='getElementGeometry'&&scenario==='geometry_bad')return {success:false,error:'Offline unavailable geometry'}
      if(action==='getElementGeometry')return {success:true,action,elementId:args.elementId,position:{gridRow:'4/10',gridColumn:'5/15'}}
      if(action==='setElementGenerationState'&&args.generating===true&&scenario.startsWith('overlay')){if(scenario==='overlay_late')await sleep(1000);return {success:false,error:'Offline overlay failed'}}
      if(action==='setElementGenerationState'&&args.generating===false&&(cleanupDelay||scenario==='overlay')){await sleep(cleanupDelay||5000);if(scenario==='cleanup_reject')throw new Error('Offline cleanup failed')}
      if(action.startsWith('insert')||action.startsWith('upsert')){
        if(args.elementId==='blank-1'){if(scenario.startsWith('restore'))await sleep(5000);if(scenario==='restore_insert_fail')throw new Error('Offline restore insertion failed');stamp('restore_ack');return {success:true,elementId:['restore_renamed','restore_resume_fail'].includes(scenario)?'restored-1':'blank-1'}}
        inserted++;if(scenario==='ambiguous_ack')return {success:true};if(scenario==='ambiguous_timeout')throw new Error('Command timeout');if(scenario.startsWith('partial')&&inserted===2)return {success:false,error:'Offline insertion failed'}
        stamp('insert_ack');return {success:true,elementId:`generated-${inserted}`}
      }
      if(action==='deleteElement'){
        if(args.elementId==='blank-1'){blankDeleteCount++;if(scenario.startsWith('restore')&&blankDeleteCount>1){await sleep(3000);if(scenario==='restore_delete_fail')throw new Error('Offline restore delete failed')}}
        else if(args.elementId==='original-1'&&scenario.startsWith('refine_delete')){if(scenario==='refine_delete_ambiguous')throw new Error('Command timeout');return {success:false,error:'Offline original deletion failed'}}
        else if(scenario.startsWith('restore')||scenario.startsWith('partial')||scenario.startsWith('refine_delete')){await sleep(delay);if(scenario==='partial_rollback_fail'||scenario==='refine_delete_rollback_fail')return {success:false,error:'Offline rollback failed'}}
      }
      if(action==='getElementMutationReceipt')return {status:'unknown'}
      if(action==='getElementGenerationMetadata')return {success:true,componentType:type,themeVariantSource:'manual'}
      if(action==='refreshElementThemeMetadata')return {themeVariantId:'offline-variant',themeBindings:{text:'--theme-text'}}
      return {success:true,elementId:args.elementId}
    }},getThemeSyncSnapshot:()=>({status:'applied',presentationId:'offline-feedback',requestId:'offline-theme',themeFingerprint:'offline-fingerprint'}),ensureThemeReady:async()=>({ready:true,source:'neutral'}),toast:value=>{toasts.push({at:now,...value});stamp('toast')},
  }
  params.layoutServiceApis.captureStudioElementGeneration=()=>({sendElementCommand:params.layoutServiceApis.sendElementCommand,isCurrent:()=>leaseCurrent})
  const hook=load('hooks/use-textlabs-generation.ts').useTextLabsGeneration
  let api
  const panelSource=read('hooks/use-generation-panel.ts',ref);sourceHashes['hooks/use-generation-panel.ts']=hash(panelSource)
  const ast=ts.createSourceFile('panel.ts',panelSource,ts.ScriptTarget.Latest,true)
  let busyExpression;const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='setIsGenerating')busyExpression=node.initializer.getText(ast);ts.forEachChild(node,visit)};visit(ast);assert.ok(busyExpression)
  const render=()=>{panel.isGenerating=activeBusyKeys.has(targetKey());refCursor=0;effectCursor=0
    const busyModule={exports:{}}
    vm.runInNewContext(compile(`module.exports=${busyExpression}`),{module:busyModule,useCallback:fn=>fn,generationTargetKey:targetKey(),setActiveGenerationKeys:fn=>{const next=fn(activeBusyKeys);activeBusyKeys.clear();for(const key of next)activeBusyKeys.add(key);panel.isGenerating=activeBusyKeys.has(targetKey());stamp('busy',{value:panel.isGenerating})}})
    params.generationPanel={...panel,...methods,setIsGenerating:busyModule.exports};api=hook(params);while(pendingEffects.length)pendingEffects.shift()();return api}

  render()
  const inputTree=submit=>{
    panel.isGenerating=activeBusyKeys.has(targetKey())
    if(!panel.isOpen||panel.mode==='edit')return null
    const GenerationInput=load('components/generation-panel/shared/generation-input.tsx',true).GenerationInput
    return GenerationInput({prompt:'Offline prompt',onPromptChange:()=>{},mandatoryConfig:null,showAdvanced:false,onToggleAdvanced:()=>{},onSubmit:submit??(()=>{}),isGenerating:panel.isGenerating,error:panel.error,retryStrategy:panel.retryStrategy})
  }
  const input=()=>renderToStaticMarkup(inputTree())
  const advance=async ms=>{await flush();const end=now+ms;while(true){const due=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();await flush()}now=end;await flush()}
  const form=()=>({componentType:type,prompt:'Offline authored prompt',count:1,useDeckTheme:false,structure:'SECTIONS',textboxConfig:{},imageConfig:{operation:'generate'},chartConfig:{requested_data_source_mode:'illustrative'},shapeConfig:{shape_type:null},infographicConfig:{},iconLabelConfig:{},metricsConfig:{},tableConfig:{},diagramConfig:{},codeDisplayConfig:{},kanbanConfig:{},ganttConfig:{},chevronConfig:{},ideaBoardConfig:{},cloudArchitectureConfig:{},logicalArchitectureConfig:{},dataArchitectureConfig:{},positionConfig:{start_col:5,start_row:4,position_width:10,position_height:6,auto_position:false}})
  return {panel,params,events,requests,controllers,commands,sourceHashes,form,advance,flush,input,inputTree,render,methods,get api(){return api},get now(){return now},get timeoutMs(){return load('lib/element-generation-timeout.ts').resolveElementGenerationTimeoutMs(type,panel.researchMode)},setTrackAction:fn=>{trackAction=fn},setResumeAction:fn=>{resumeAction=fn},setBackend:value=>{backend=value},setSnapshotLag:value=>{lagSnapshot={...panel};snapshotLag=value},setLease:value=>{leaseCurrent=value},switchIntent:({id='blank-2',mode='generate',open=true}={})=>{revision++;panel.blankElementId=mode==='generate'?id:null;panel.editElementId=mode==='generate'?null:id;panel.mode=mode;panel.isOpen=open;panel.error='New owner feedback';panel.retryStrategy='do_not_retry';stamp('new_intent',{id,mode});render()},unmount:()=>effectStates.forEach(x=>x?.cleanup?.()),
    isTracked:id=>blanks.has(id),summary:()=>{panel.isGenerating=activeBusyKeys.has(targetKey());return clone({events,requests:requests.map(r=>({at:r.at,url:r.url,body_sha256:hash(r.body??''),aborted:r.signal?.aborted})),commands,panel,blank:blank.status,toasts,now})}}
}

if(process.argv.includes('--baseline')) {
  const h=runtime({ref:BASE,scenario:'restore'})
  const promise=h.api.handleGenerate(h.form())
  await h.advance(0)
  assert.equal(h.events.find(e=>e.event==='failure_formed')?.at,0)
  assert.equal(h.panel.error,null)
  assert.ok(!h.input().includes('role="alert"'))
  await h.advance(9999)
  assert.equal(h.panel.error,null)
  assert.ok(!h.input().includes('role="alert"'))
  await h.advance(1);const outcome=await promise
  assert.match(h.panel.error,/Offline replacement completion failed/)
  assert.ok(h.input().includes('role="alert"'))
  const receipt={baseline_head:BASE,source_sha256:h.sourceHashes,scenario:'actual hook completion failure with slow generated rollback + blank delete + blank restore',failure_formed_at_ms:0,first_visible_feedback_at_ms:h.events.find(e=>e.event==='error'&&e.value)?.at,visible_feedback_delay_ms:10000,expected_immediate_feedback_met:false,outcome,trace:h.summary(),external_socket_attempts:blockedSockets,proof:'Synthetic fake HTTP/Layout, virtual time, static GenerationInput; no connected/runtime proof.'}
  fs.writeFileSync(path.join(out,'FIRST-VERDICT.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({baseline_head:BASE,failure_formed_at_ms:0,visible_feedback_delay_ms:10000,scenario_count:1,external_socket_attempts:blockedSockets}))
 } else {
  const types=['TEXT_BOX','METRICS','TABLE','CHART','IMAGE','ICON_LABEL','SHAPE','INFOGRAPHIC','DIAGRAM','CODE_DISPLAY','KANBAN_BOARD','GANTT_CHART','CHEVRON_MATURITY','IDEA_BOARD','CLOUD_ARCHITECTURE','LOGICAL_ARCHITECTURE','DATA_ARCHITECTURE','CUSTOM','DIAGRAM_AUTO']
  const cases=[],sourceHashes={},timingSamples=[]
  let failures=0,currentCase='setup'
  const unhandled=[]
  const observeUnhandled=reason=>unhandled.push({name:reason?.name??typeof reason})
  process.on('unhandledRejection',observeUnhandled)
  const check=async(name,fn)=>{currentCase=name;try{await fn();cases.push({name,status:'passed'})}catch(error){failures++;cases.push({name,status:'failed',failure_name:error.name});throw error}}
  const done=async h=>{await h.advance(400000);await new Promise(setImmediate);Object.assign(sourceHashes,h.sourceHashes);assert.equal(unhandled.length,0,'No unhandled restoration or cleanup rejection')}
  const start=h=>h.api.handleGenerate(h.form())
  const alert=h=>{assert.ok(h.input().includes('role="alert"'),'actual GenerationInput renders failure while busy');assert.ok(h.panel.error);assert.equal(h.panel.isGenerating,true);assert.ok(h.input().includes('disabled=""'),'Retry remains disabled during old recovery')}
  try {
    for(const type of types) for(const flag of [undefined,'false','1','TRUE','']) {
      await check(`off-wire-state:${type}:${flag??'unset'}`,async()=>{
        const a=runtime({ref:BASE,type,backend:'application',scenario:'none',cleanupDelay:2000}),b=runtime({flag,type,backend:'application',scenario:'none',cleanupDelay:2000})
        const pa=start(a),pb=start(b);await done(a);await done(b)
        assert.deepEqual(clone(await pb),clone(await pa));assert.deepEqual(b.summary(),a.summary());assert.equal(b.input(),a.input());assert.equal(b.requests.length,1)
      })
    }
    for(const fixture of [
      {scenario:'restore'},{scenario:'restore_delete_fail'},{scenario:'restore_insert_fail'},{scenario:'partial'},{scenario:'partial_rollback_fail'},
      {scenario:'overlay',cleanupDelay:5000},{scenario:'overlay',cleanupDelay:5000,refine:true},
      {scenario:'refine_delete',refine:true},{scenario:'refine_delete_rollback_fail',refine:true},
      {scenario:'none',backend:'transport',cleanupDelay:5000},{scenario:'none',backend:'abort',cleanupDelay:5000},{scenario:'none',backend:'session'},
    ]) for(const flag of [undefined,'false','1','TRUE']) {
      await check(`off-recovery-parity:${JSON.stringify(fixture)}:${flag??'unset'}`,async()=>{
        const a=runtime({ref:BASE,...fixture}),b=runtime({flag,...fixture});const pa=start(a),pb=start(b);await done(a);await done(b)
        assert.deepEqual(clone(await pb),clone(await pa));assert.deepEqual(b.summary(),a.summary());assert.equal(b.input(),a.input())
      })
    }
    for(const type of types) for(const backend of ['application','terminal','http','transport','abort']) {
      await check(`on-direct-failure:${type}:${backend}`,async()=>{
        const h=runtime({flag:'true',type,backend,scenario:'none',cleanupDelay:2000}),p=start(h)
        await h.advance(backend==='abort'?h.timeoutMs:0);alert(h)
        assert.equal(h.requests.length,1,'No automatic service resend')
        if(['application','terminal','http'].includes(backend)){assert.match(h.panel.error,/Offline provider failure/);assert.match(h.panel.error,/Request reference: offline-requ/);assert.match(h.panel.error,/Diagram reference: offline-diag/)}
        if(backend==='terminal')assert.equal(h.panel.retryStrategy,'do_not_retry')
        await done(h);assert.equal((await p).status,'failed');assert.equal(h.requests.length,1);assert.equal(h.panel.isGenerating,false);assert.ok(h.isTracked('blank-1'));assert.equal(h.commands.some(x=>x.action==='deleteElement'),false)
      })
    }
    for(const fixture of [
      {scenario:'restore'},{scenario:'restore_delete_fail'},{scenario:'restore_insert_fail'},{scenario:'partial'},{scenario:'partial_rollback_fail'},
      {scenario:'overlay',cleanupDelay:5000},{scenario:'overlay',cleanupDelay:5000,refine:true},
      {scenario:'refine_delete',refine:true},{scenario:'refine_delete_rollback_fail',refine:true},
    ]) await check(`on-await-boundary:${JSON.stringify(fixture)}`,async()=>{
      const h=runtime({flag:'true',...fixture}),p=start(h);await h.advance(0);alert(h)
      const reason=h.panel.error,firstHTML=h.input();assert.ok(firstHTML.includes(reason.replaceAll('&','&amp;').replaceAll('<','&lt;')),'Rendered error text matches formed failure');await h.advance(1999);assert.equal(h.panel.error,reason)
      await done(h);assert.equal((await p).status,'failed');assert.equal(h.panel.isGenerating,false)
      const clears=h.events.filter(x=>x.event==='resume_clear')
      for(const clear of clears){const index=h.events.indexOf(clear);assert.ok(h.events.slice(index+1).some(e=>e.at===clear.at&&e.event==='error'&&e.value),'owned resume republishes without a visible lost-feedback interval')}
      if(fixture.scenario==='partial_rollback_fail')assert.match(h.panel.error,/Some generated elements could not be removed/)
      if(fixture.scenario==='restore_insert_fail')assert.equal(h.isTracked('blank-1'),false,'No fabricated restored tracking after rejected insert')
      if(['restore','overlay','refine_delete','partial_rollback_fail'].includes(fixture.scenario)&&!fixture.refine)timingSamples.push({fixture,first_feedback_at_ms:h.events.find(e=>e.event==='error'&&e.value)?.at,busy_released_at_ms:h.events.find(e=>e.event==='busy'&&e.value===false)?.at,rendered_role_alert: firstHTML.includes('role="alert"'),rendered_error_sha256:hash(firstHTML),events:h.events.filter(e=>['error','retry','busy','resume_clear','failure_formed'].includes(e.event))})
    })
    for(const type of types) await check(`on-success-preservation:${type}`,async()=>{
      const a=runtime({ref:BASE,type,scenario:'none'}),b=runtime({flag:'true',type,scenario:'none'}),pa=start(a),pb=start(b);await done(a);await done(b)
      assert.equal((await pa).status,'inserted');assert.deepEqual(clone(await pb),clone(await pa));assert.deepEqual(b.summary().requests,a.summary().requests);assert.deepEqual(b.commands,a.commands);assert.deepEqual(clone(b.panel),clone(a.panel))
      const insert=b.events.findIndex(e=>e.event==='insert_ack'),retire=b.events.findIndex(e=>e.event==='tracking_remove');assert.ok(insert>=0&&retire>insert,'original placeholder retires only after generated ACK')
    })
    for(const scenario of ['partial','restore']) for(const transition of ['different_target','same_id_reopen','close','edit','snapshot_lag','unmount','lease_retired','deck_epoch']) {
      await check(`on-retired-owner:${scenario}:${transition}`,async()=>{
        const h=runtime({flag:'true',scenario}),p=start(h);await h.advance(0);alert(h)
        if(transition==='unmount')h.unmount()
        else if(transition==='lease_retired')h.setLease(false)
        else if(transition==='deck_epoch'){h.params.presentationId='offline-other';h.render();h.params.presentationId='offline-feedback';h.render()}
        else {if(transition==='snapshot_lag')h.setSnapshotLag(true);h.switchIntent({id:transition==='same_id_reopen'||transition==='snapshot_lag'?'blank-1':'blank-2',open:transition!=='close',mode:transition==='edit'?'edit':'generate'})}
        const boundary=h.events.length,commandBoundary=h.commands.length
        await done(h);await p
        assert.equal(h.events.slice(boundary).some(e=>['tracking_add','tracking_remove','track','resume_clear'].includes(e.event)),false,'No stale tracking/resume mutation')
        assert.equal(h.commands.slice(commandBoundary).some(c=>c.action==='deleteElement'||c.action.startsWith('insert')),false,'No stale compensating command after await')
        if(!['unmount','lease_retired','deck_epoch'].includes(transition)){assert.equal(h.panel.error,'New owner feedback');assert.equal(h.panel.retryStrategy,'do_not_retry');assert.equal(h.panel.isOpen,transition!=='close')}
      })
    }
    await check('on-newer-attempt-different-target',async()=>{
      const h=runtime({flag:'true',scenario:'partial'}),first=start(h);await h.advance(0);h.switchIntent({id:'blank-2'});h.params.blankElements.addElement({elementId:'blank-2',componentType:'SHAPE',slideIndex:0,startCol:5,startRow:4,width:10,height:6,status:'blank'})
      h.setBackend('application');h.render();const next=start(h);await h.advance(0);const newerError=h.panel.error
      await done(h);await first;await next;assert.equal(h.panel.error,newerError);assert.equal(h.requests.length,2);assert.equal(h.panel.isGenerating,false)
    })
    await check('on-renamed-placeholder-recovery',async()=>{
      const h=runtime({flag:'true',scenario:'restore_renamed'}),first=start(h);await h.advance(0);alert(h)
      let attempted
      h.setResumeAction(()=>{attempted=start(h)})
      await h.advance(9999);assert.match(h.panel.error,/Offline replacement completion failed/);assert.equal(h.panel.isGenerating,true)
      await done(h);await first
      assert.ok(h.isTracked('restored-1'));assert.equal(h.isTracked('blank-1'),false);assert.match(h.panel.error,/Offline replacement completion failed/)
      if(attempted){await done(h);await attempted;assert.ok(h.requests.length<=2,'only explicit new user retry can issue second send after old lease release')}
    })
    await check('on-explicit-retry-after-recovery',async()=>{
      const h=runtime({flag:'true',scenario:'partial'}),first=start(h);await done(h);await first;assert.equal(h.requests.length,1)
      const second=h.api.handleGenerate(h.form(),'retry');await done(h);assert.equal((await second).status,'inserted');assert.equal(h.requests.length,2)
    })
    await check('on-session-deadline-before-provider',async()=>{
      const h=runtime({flag:'true',backend:'application',scenario:'none',sessionDelay:40000,cleanupDelay:2000}),p=start(h);await h.advance(30000);alert(h);assert.match(h.panel.error,/timed out after 30 seconds/);assert.equal(h.requests.length,0);await done(h);await p
    })
    await check('on-grounded-chart-recovery',async()=>{
      const h=runtime({flag:'true',type:'CHART',backend:'grounded',scenario:'none',cleanupDelay:2000});h.panel.researchMode='on';h.panel.researchWeb=true;h.params.researchCapabilities={web:{available:true},uploaded_documents:{available:false},knowledge_graph:{available:false}};h.render();const f=h.form();f.chartConfig.requested_data_source_mode='auto';const p=h.api.handleGenerate(f);await h.advance(0);alert(h);assert.match(h.panel.error,/Data Source → Illustrative/);await done(h);await p;assert.equal(h.requests.length,1)
    })
    for(const backend of ['application','transport','session','abort']) await check(`on-failure-preserves-pristine-reason:${backend}`,async()=>{
      const a=runtime({ref:BASE,backend,scenario:'none',cleanupDelay:2000}),b=runtime({flag:'true',backend,scenario:'none',cleanupDelay:2000}),pa=start(a),pb=start(b);await done(a);await done(b)
      assert.deepEqual(clone(await pb),clone(await pa));assert.equal(b.panel.error,a.panel.error);assert.equal(b.panel.retryStrategy,a.panel.retryStrategy);assert.deepEqual(b.summary().requests,a.summary().requests);assert.deepEqual(b.commands,a.commands)
    })
    for(const backend of ['application','terminal','transport','abort']) await check(`classic-true-exact-parity:${backend}`,async()=>{
      const a=runtime({ref:BASE,studio:false,backend,scenario:'none',cleanupDelay:2000}),b=runtime({flag:'true',studio:false,backend,scenario:'none',cleanupDelay:2000}),pa=start(a),pb=start(b);await done(a);await done(b)
      assert.deepEqual(clone(await pb),clone(await pa));assert.deepEqual(b.summary(),a.summary());assert.equal(b.input(),a.input())
    })
    for(const fixture of [{backend:'application',scenario:'none'},{backend:'success',scenario:'partial'}]) await check(`on-closed-chat-add:${JSON.stringify(fixture)}`,async()=>{
      const h=runtime({flag:'true',...fixture});h.switchIntent({id:null,open:false});const p=h.api.handleGenerate(h.form(),'generate',{kind:'chat-add',slideIndex:0});let settled=false;p.then(()=>{settled=true})
      await h.advance(0);assert.equal(h.panel.isOpen,false);assert.equal(h.input(),'');assert.equal(h.summary().toasts.length,1);assert.equal(h.summary().toasts[0].at,0)
      if(fixture.scenario==='partial')assert.equal(settled,false,'toast precedes delayed rollback')
      await done(h);assert.equal((await p).status,'failed');assert.equal(h.summary().toasts.length,1);assert.equal(h.panel.isOpen,false);assert.equal(h.requests.length,1)
    })
    for(const kind of ['no_native_lease','custom_limit']) await check(`on-direct-preflight-toast:${kind}`,async()=>{
      const h=runtime({flag:'true',type:kind==='custom_limit'?'CUSTOM':'SHAPE',scenario:'none'});h.switchIntent({id:null,open:false});if(kind==='no_native_lease')h.params.layoutServiceApis.captureStudioElementGeneration=()=>null
      const form=h.form();if(kind==='custom_limit')form.prompt='x'.repeat(20001)
      const p=h.api.handleGenerate(form,'generate',{kind:'chat-add',slideIndex:0});await h.advance(0);assert.equal(h.summary().toasts.length,1);assert.equal(h.summary().toasts[0].at,0);await done(h);assert.equal((await p).status,'failed');assert.equal(h.requests.length,0);assert.equal(h.panel.isOpen,false)
    })
    await check('on-stale-overlay-failed-ACK',async()=>{
      const h=runtime({flag:'true',scenario:'overlay_late'}),p=start(h);await h.advance(0);h.switchIntent({id:'blank-2'});const boundary=h.events.length,commandBoundary=h.commands.length
      await done(h);await p;assert.equal(h.events.slice(boundary).some(e=>e.event==='blank_status'),false);assert.equal(h.commands.slice(commandBoundary).some(c=>c.action==='setElementGenerationState'),false);assert.equal(h.panel.error,'New owner feedback')
    })
    await check('on-renamed-alias-new-user-attempt-held',async()=>{
      const h=runtime({flag:'true',scenario:'restore_renamed'}),p=start(h);let attempt
      h.setTrackAction(id=>{if(id==='restored-1'){h.switchIntent({id});attempt=start(h)}})
      await done(h);await p;assert.ok(attempt);assert.equal((await attempt).status,'failed');assert.equal(h.requests.length,1,'renamed alias lease blocks overlap until old recovery ends');assert.equal(h.panel.error,'New owner feedback')
      h.setTrackAction(null);h.setResumeAction(null);h.setBackend('application');const retry=start(h);await done(h);await retry;assert.equal(h.requests.length,2,'alias lease released for later explicit action')
    })
    await check('on-renamed-deferred-resume-reject-contained',async()=>{
      const h=runtime({flag:'true',scenario:'restore_resume_fail'}),p=start(h);await h.advance(0);alert(h);await done(h);assert.equal((await p).status,'failed');assert.match(h.panel.error,/Offline replacement completion failed/);assert.equal(unhandled.length,0)
    })
    await check('on-manual-chart-invalid-preflight',async()=>{
      const h=runtime({flag:'true',type:'CHART',scenario:'none'}),form=h.form();form.positionConfig.start_col=99;const p=h.api.handleGenerate(form);await h.advance(0);assert.match(h.panel.error,/Manual chart position/);assert.ok(h.input().includes('role="alert"'));await done(h);await p;assert.equal(h.requests.length,0)
    })
    await check('on-image-edit-preflight-through-slow-cleanup',async()=>{
      const h=runtime({flag:'true',type:'IMAGE',scenario:'none',cleanupDelay:2000}),form=h.form();form.imageConfig.operation='edit';const p=h.api.handleGenerate(form);await h.advance(0);assert.ok(h.panel.error);assert.ok(h.input().includes('role="alert"'));assert.equal(h.requests.length,0);await done(h);assert.equal((await p).status,'failed')
    })
    await check('on-session-preprovider-failure-busy-feedback',async()=>{
      const h=runtime({flag:'true',backend:'session',scenario:'none',cleanupDelay:2000}),p=start(h);await h.advance(0);alert(h);assert.equal(h.requests.length,0);await done(h);await p
    })
    await check('on-controller-cancel-does-not-overwrite-new-owner',async()=>{
      const h=runtime({flag:'true',backend:'abort',scenario:'none',cleanupDelay:2000}),p=start(h);await h.advance(0);h.switchIntent({id:'blank-2'});h.controllers[0].abort();await done(h);await p;assert.equal(h.panel.error,'New owner feedback');assert.equal(h.requests.length,1)
    })
    await check('on-hidden-edit-pane-state-toast-only',async()=>{
      const h=runtime({flag:'true',backend:'application',scenario:'none'});h.switchIntent({id:'original-1',mode:'edit'});const p=start(h);await h.advance(0);assert.equal(h.input(),'');assert.equal(h.summary().toasts.length,1);await done(h);await p;assert.equal(h.panel.mode,'edit')
    })
    for(const scenario of ['partial','restore']) await check(`on-same-target-overlap-held:${scenario}`,async()=>{
      const h=runtime({flag:'true',scenario}),p=start(h);await h.advance(0);const reason=h.panel.error;const blocked=await start(h);assert.equal(blocked.status,'failed');assert.equal(h.panel.error,reason);assert.equal(h.requests.length,1);await done(h);await p
    })
    for(const fixture of [{scenario:'ambiguous_ack',delayAt:0},{scenario:'ambiguous_timeout',delayAt:1750},{scenario:'refine_delete_ambiguous',refine:true,delayAt:1750}]) await check(`on-layout-ambiguity:${JSON.stringify(fixture)}`,async()=>{
      const h=runtime({flag:'true',...fixture,cleanupDelay:2000}),p=start(h);await h.advance(fixture.delayAt);alert(h);assert.equal(h.panel.retryStrategy,'do_not_retry');assert.equal(h.requests.length,1)
      assert.equal(h.commands.some(c=>c.action==='deleteElement'&&String(c.args.elementId).startsWith('generated')),false,'Do not guess rollback for missing ACK or unknown original deletion')
      await done(h);assert.equal((await p).status,'failed');assert.equal(h.requests.length,1)
    })
    await check('on-cleanup-rejection-keeps-visible-original-failure',async()=>{
      const h=runtime({flag:'true',backend:'application',scenario:'cleanup_reject',cleanupDelay:2000}),p=start(h);await h.advance(0);alert(h);const reason=h.panel.error;await done(h);assert.equal((await p).status,'failed');assert.equal(h.panel.error,reason);assert.equal(h.panel.isGenerating,false);assert.equal(unhandled.length,0)
    })
    for(const backend of ['unknown_code','ambiguous_response','geometry']) await check(`on-real-client-canonical-policy:${backend}`,async()=>{
      const h=runtime({flag:'true',type:backend==='ambiguous_response'?'CUSTOM':'SHAPE',backend,scenario:'none',cleanupDelay:2000}),p=start(h);await h.advance(0);alert(h)
      if(backend==='ambiguous_response')assert.equal(h.panel.retryStrategy,'resume_same_attempt')
      if(backend==='geometry'){assert.equal(h.panel.retryStrategy,'do_not_retry');assert.match(h.panel.error,/requested geometry could not be verified/)}
      await done(h);await p;assert.equal(h.requests.length,1)
    })
    await check('on-geometry-preflight-retry-limit-feedback-before-cleanup',async()=>{
      const h=runtime({flag:'true',type:'TABLE',scenario:'geometry_bad',cleanupDelay:2000}),p=start(h);await h.advance(200);alert(h);assert.equal(h.requests.length,0);assert.match(h.panel.error,/current size and position/);await done(h);await p
    })
    await check('on-theme-readiness-preflight-kept-no-provider',async()=>{
      const h=runtime({flag:'true',type:'TEXT_BOX',scenario:'none',cleanupDelay:2000});h.params.ensureThemeReady=async()=>({ready:false,error:'Offline theme not ready'});h.render();const f=h.form();f.useDeckTheme=true;const p=h.api.handleGenerate(f);await h.advance(0);alert(h);assert.match(h.panel.error,/Offline theme not ready/);assert.equal(h.requests.length,0);await done(h);await p
    })
    for(const type of types) for(const flag of [undefined,'false','1','TRUE','']) await check(`off-success-byte-order-state:${type}:${flag??'unset'}`,async()=>{
      const a=runtime({ref:BASE,type,scenario:'none'}),b=runtime({flag,type,scenario:'none'}),pa=start(a),pb=start(b);await done(a);await done(b);assert.equal((await pa).status,'inserted');assert.deepEqual(clone(await pb),clone(await pa));assert.deepEqual(b.summary(),a.summary());assert.equal(b.input(),a.input())
    })
    await check('actual-rendered-retry-disabled-then-explicit-send-after-recovery',async()=>{
      const h=runtime({flag:'true',scenario:'restore'}),p=start(h);await h.advance(0);let retryPromise
      const submit=()=>{retryPromise=h.api.handleGenerate(h.form(),'retry')}
      const find=tree=>{if(!tree||typeof tree!=='object')return null;if(tree.type==='button'&&tree.props?.['data-studio-generation-feedback-guidance']==='true')return tree;for(const child of React.Children.toArray(tree.props?.children)){const result=find(child);if(result)return result}return null}
      const busyButton=find(h.inputTree(submit));assert.ok(busyButton);assert.equal(busyButton.props.disabled,true);busyButton.props.onClick();assert.equal(retryPromise,undefined);assert.equal(h.requests.length,1)
      await done(h);await p;const readyButton=find(h.inputTree(submit));assert.ok(readyButton);assert.equal(readyButton.props.disabled,false);readyButton.props.onClick();assert.ok(retryPromise);await done(h);assert.equal((await retryPromise).status,'inserted');assert.equal(h.requests.length,2)
    })
    await new Promise(setImmediate);assert.equal(unhandled.length,0);assert.equal(blockedSockets,0)
    const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,env:gitEnv,encoding:'utf8'}).trim()
    fs.writeFileSync(path.join(out,'CANDIDATE-TIMING.json'),JSON.stringify({source_sha256:sourceHashes,timingSamples,proof:'Synthetic virtual time plus actual static GenerationInput; no browser/connected proof.'},null,2)+'\n')
    fs.writeFileSync(path.join(out,'MATRIX-RESULT.json'),JSON.stringify({source_head_at_execution:head,source_sha256:sourceHashes,script_sha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),baseline_head:BASE,flag:FLAG,cases,passed:cases.length,failed:0,unhandled_rejections:unhandled,external_socket_attempts:blockedSockets,limitations:'Actual VM hook/client/helpers and static input; fake Layout/HTTP/clock/panel snapshots+intent and actual extracted per-target busy callback. No live/browser/connected persistence proof.'},null,2)+'\n')
    console.log(JSON.stringify({passed:cases.length,failed:0,unhandled_rejections:0,external_socket_attempts:blockedSockets}))
  } catch(error) {
    fs.writeFileSync(path.join(out,'MATRIX-FAILURE.json'),JSON.stringify({case:currentCase,cases,source_sha256:sourceHashes,script_sha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),failed:failures,name:error.name,message:error.message,unhandled_rejections:unhandled,external_socket_attempts:blockedSockets},null,2)+'\n')
    console.error(`Failed focused scenario: ${currentCase}: ${error.message}`);process.exitCode=1
  } finally {process.off('unhandledRejection',observeUnhandled)}
}

