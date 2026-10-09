// Offline diagnostic replay. Source-pinned form interactions -> actual client JSON.
// Reconstructed UI choices, never claimed to be the missing live network capture.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const here=path.dirname(new URL(import.meta.url).pathname)
const repo=path.resolve(here,'../..')
const require=createRequire(import.meta.url)
const deps='/Users/pk1980/Software/Deckster/frontend/node_modules'
const ts=require(deps+'/typescript/lib/typescript.js')
const React=require(deps+'/react')
const refs=['ee532fab4b84a6883f8a5b50675ccab692b62240','6d47cae43fa406c31b2c5da21c9d2ce7de3b7872','18e0446073d62b042a9470fd4524994d3dd82e8e']
function loader(ref,flag,hooks=React){
 const cache=new Map(),requests=[]
 const empty=()=>null
 const stubs={react:hooks,'lucide-react':new Proxy({},{get:()=>empty}),
  '../shared/collapsible-section':{CollapsibleSection:empty},
  '../shared/font-override-section':{FontOverrideSection:empty},
  '../shared/position-presets':{PositionPresets:empty},
  '../shared/toggle-row':{ToggleRow:empty},'../shared/z-index-input':{ZIndexInput:empty},
  '../shared/padding-control':{PaddingControl:empty},
  '@/hooks/use-deck-theme-palette':{useDeckThemePalette:()=>({tokens:[],loading:false,error:null})}}
 function load(file){
  if(cache.has(file))return cache.get(file)
  const source=execFileSync('git',['show',`${ref}:${file}`],{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','ignore']})
  const module={exports:{}};cache.set(file,module.exports)
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText
  vm.runInNewContext(output,{module,exports:module.exports,React:hooks,console,AbortController,DOMException,crypto:globalThis.crypto,URL,setTimeout,clearTimeout,
   process:{env:{NEXT_PUBLIC_ELEMENTOR_URL:'https://textlabs.example.test',NEXT_PUBLIC_STUDIO_V4_SHELL:'true',NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED:flag}},
   fetch:async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return{ok:true,headers:{get:()=>null},json:async()=>({success:true,elements:[]})}},
   require:id=>id in stubs?stubs[id]:id.endsWith('.css')?{}:id.startsWith('@/')?load(id.slice(2)+'.ts'):require(id)}, {filename:`${ref}:${file}`})
  cache.set(file,module.exports);return module.exports
 }
 return{load,requests}
}
function find(tree,predicate){
 if(!tree||typeof tree!=='object')return null
 if(predicate(tree))return tree
 for(const child of React.Children.toArray(tree.props?.children)){const n=find(child,predicate);if(n)return n}
 return null
}
function harness(ref,flag,prompt){
 const states=[],refs=[],effects=[],submits=[],registered=[];let cursor=0,refCursor=0
 const hooks={...React,useState(value){const i=cursor++;if(!(i in states))states[i]=typeof value==='function'?value():value;return[states[i],next=>states[i]=typeof next==='function'?next(states[i]):next]},
 useRef(value){const i=refCursor++;if(!(i in refs))refs[i]={current:value};return refs[i]},useMemo:fn=>fn(),useCallback:fn=>fn,useEffect:fn=>effects.push(fn)}
 const l=loader(ref,flag,hooks),Form=l.load('components/generation-panel/forms/text-box-form.tsx').TextBoxForm
 const props={prompt,showAdvanced:true,presentationId:'synthetic-deck',slotCatalog:{slots:[]},slotCatalogLoading:false,registerMandatoryConfig:()=>{},registerSubmit:fn=>registered.push(fn),onSubmit:data=>submits.push(data),onDraftChange:()=>{},elementContext:{startCol:2,startRow:4,width:10,height:6}}
 function render(){cursor=0;refCursor=0;effects.length=0;return Form(props)}
 function choose(match,value){const node=find(render(),match);assert.ok(node,'control exists');node.props.onChange({target:{value}})}
 function structure(value){choose(n=>n.type==='select'&&React.Children.toArray(n.props.children).some(c=>c?.props?.value==='SEQUENTIAL'),value)}
 function submit(){render();const effect=effects.find(fn=>fn.toString().includes('registerSubmit'));assert.ok(effect);effect();registered.at(-1)();return submits.at(-1)}
 return{render,choose,structure,submit}
}
const cases=[{id:'word',prompt:'Forecast',structure:'simple',subtype:'word'},
 {id:'sections',prompt:'three adoption-risk sections',structure:'SECTIONS'},
 {id:'numbered-auto',prompt:'Five rollout steps, one line each.',structure:'NUMBERED_LIST'},
 {id:'compare-two',prompt:"Today's process vs AI process",structure:'COMPARISON',count:2}]
const rows=[]
for(const ref of refs){
 for(const flag of ['false','true']){
  for(const c of cases){
   const h=harness(ref,flag,c.prompt);h.structure(c.structure)
   if(c.subtype)h.choose(n=>n.type==='select'&&React.Children.toArray(n.props.children).some(x=>x?.props?.value==='word'),c.subtype)
   if(c.count)h.choose(n=>n.props?.['aria-label']==='Text box count',String(c.count))
   const form=h.submit(),l=loader(ref,flag),client=l.load('lib/textlabs-client.ts')
   const {message,options}=client.buildApiPayload('synthetic-session',form)
   await client.sendMessage('synthetic-session',message,options)
   const body=l.requests[0].body
   assert.equal(body.message,c.prompt);assert.equal(body.component_type,'TEXT_BOX')
   rows.push({source_ref:ref,flag_literal:flag,case:c.id,component_type:body.component_type,prompt_preserved:body.message===c.prompt,structure:body.structure,
    count:body.count??null,count_present:Object.hasOwn(body,'count'),compose:body.compose??null,child_geometry_count:body.elements?.length??0,
    cards_in_one_element:form.cardsInOneElement??null,count_auto_form:form.countAuto??null,textbox_config:body.textbox_config??null,
    items_per_instance:body.items_per_instance??body.itemsPerInstance??null,manual_geometry:body.manual_geometry_overrides??null,geometry_mode:body.geometry_mode})
  }
 }
}
const themeRows=[]
for(const ref of refs){
 const l=loader(ref,'true'),budget=l.load('lib/element-generation-timeout.ts'),theme=l.load('lib/theme-sync.ts')
 const state={status:'syncing',requestId:'synthetic-request',presentationId:'synthetic-deck',themeFingerprint:'same-theme',error:null}
 let clock=0,requests=0
 const timeout=await theme.waitForAuthoritativeTheme({presentationId:'synthetic-deck',themeFingerprint:'same-theme',getSyncState:()=>state,isConnected:()=>true,requestSync:()=>{requests++;return{ok:true,requestId:'synthetic-request'}},now:()=>clock,delay:async(ms)=>{clock+=ms}})
 assert.equal(timeout.ready,false);assert.equal(timeout.code,'timeout');assert.equal(clock,20000)
 let ackClock=0
 const ready=await theme.waitForAuthoritativeTheme({presentationId:'synthetic-deck',themeFingerprint:'same-theme',getSyncState:()=>({...state,status:ackClock>=1000?'applied':'syncing'}),isConnected:()=>true,requestSync:()=>({ok:true,requestId:'synthetic-request'}),now:()=>ackClock,delay:async(ms)=>{ackClock+=ms}})
 assert.equal(ready.ready,true)
 let inheritedClock=0,inheritedRequests=0
 const inherited=await theme.waitForAuthoritativeTheme({presentationId:'synthetic-deck',themeFingerprint:'same-theme',getSyncState:()=>({...state,status:inheritedClock>=3000?'failed':'syncing',error:inheritedClock>=3000?'Synthetic earlier request timer expired':null}),isConnected:()=>true,requestSync:()=>{inheritedRequests++;return{ok:true,requestId:'synthetic-request'}},now:()=>inheritedClock,delay:async(ms)=>{inheritedClock+=ms}})
 assert.equal(inherited.code,'failed');assert.equal(inheritedClock,3000);assert.equal(inheritedRequests,0)
 const failedState={...state,status:'failed',error:'Synthetic earlier request timer expired'}
 const lateApplied=theme.applyThemeSyncResponse(failedState,{request_id:'synthetic-request',status:'applied',presentation_id:'synthetic-deck'})
 assert.equal(lateApplied.status,'applied')
 assert.equal(theme.applyThemeSyncResponse(failedState,{request_id:'different-request',status:'applied',presentation_id:'synthetic-deck'}),failedState)
 assert.equal(theme.applyThemeSyncResponse(lateApplied,{request_id:'synthetic-request',status:'syncing',presentation_id:'synthetic-deck'}),lateApplied)
 themeRows.push({source_ref:ref,text_box_research_off_timeout_ms:budget.resolveElementGenerationTimeoutMs('TEXT_BOX','off'),text_box_research_on_timeout_ms:budget.resolveElementGenerationTimeoutMs('TEXT_BOX','on'),missing_ack_outcome:timeout.code,missing_ack_elapsed_ms:clock,duplicate_request_count:requests,matching_ack_releases_generation:ready.ready,matching_ack_elapsed_ms:ackClock,inherited_request_failure_outcome:inherited.code,inherited_request_failure_elapsed_ms:inheritedClock,inherited_duplicate_request_count:inheritedRequests,late_same_request_applied_accepted:lateApplied.status==='applied',unrelated_request_ignored:true,late_syncing_cannot_downgrade_applied:true})
}
fs.writeFileSync(path.join(here,'request-replay-results.json'),JSON.stringify({proof_kind:'offline reconstructed form interactions through actual pinned form/client; not exact captured live network',requests:rows,theme_timeout:themeRows},null,2)+'\n')
console.log(`Completed ${rows.length} source-pinned request replays and ${themeRows.length} virtual-clock theme/budget comparisons; no live requests.`)
