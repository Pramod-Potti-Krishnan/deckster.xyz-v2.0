import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'

// Actual transpiled native leaf. Internal handlers are exposed only for awaiting
// the existing async callback; no body, validation or native JSX is replaced.
const root=new URL('../',import.meta.url),file='components/template-ingest-dialog.tsx'
const source=fs.readFileSync(new URL(file,root),'utf8'),baseline=readAtlasBaseline(`014d716:${file}`)
const jsx=(type,props,key)=>({type,props,...(key===undefined?{}:{key})})
const flat=value=>Array.isArray(value)?value.flatMap(flat):!value||typeof value!=='object'?[]:[value,...flat(value.props?.children)]
const text=value=>Array.isArray(value)?value.map(text).join(''):value==null||typeof value==='boolean'?'':typeof value==='object'?text(value.props?.children):String(value)
const compile=source=>{const out=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});assert.equal((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);return out.outputText}
const canonical=source=>ts.createPrinter({removeComments:true}).printFile(ts.createSourceFile('leaf.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX))
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve()}
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}}
const nativeFile={name:'Original source.PPTX',size:2048,type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}
const uploadResult={storagePath:'offline/source.pptx',researcherSessionId:'offline-new-1',jobId:null,fileName:nativeFile.name}
let checks=0
function harness(code=source,flag){
 if(arguments.length<2)flag='true'
 const slots=[],effects=[],events=[],requests=[]
 let cursor=0,writes=0,lateWrites=0,closed=false,serial=0,props,tree,scheduled=false,renders=0
 const api={user:{id:'offline-owner'},upload:async()=>uploadResult,create:async id=>({id}),storageFail:false,selfUnmount:false}
 const react={Fragment:'Fragment',
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:initial};return[slots[i].value,value=>{writes++;if(closed)lateWrites++;const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value))scheduled=true;slots[i].value=next}]},
  useRef(initial){const i=cursor++;return slots[i]||={current:initial}},
  useCallback(callback,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))slots[i]={deps,callback};return slots[i].callback},
  useLayoutEffect(callback,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,effect:callback,cleanup:callback()}})},
 }
 const createSession=(...args)=>{events.push(['create',...args]);return api.create(...args)}
 const dependencies={react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{usePathname:()=>context.window.location.pathname},
  '@/hooks/use-auth':{useAuth:()=>({user:api.user})},'@/hooks/use-chat-sessions':{useChatSessions:()=>({createSession})},
  '@/lib/researcher-upload':{uploadFileToResearcher:options=>{requests.push(options);events.push(['upload',{sessionId:options.sessionId,userId:options.userId,file:options.file,intent:options.intent}]);return api.upload(options)}},
  '@/hooks/use-deckster-websocket-v2':{INGEST_INTENT_KEY_PREFIX:'deckster_ingest_intent_'},'@/lib/utils':{cn:(...values)=>values.filter(Boolean).join(' ')},
  './studio-editor-dialogs.css':{},'./studio-template-flows.css':{},
 }
 for(const[id,names]of[['lucide-react',['AlertTriangle','FileUp','Loader2','Upload']],['@/components/ui/dialog',['Dialog','DialogContent','DialogDescription','DialogFooter','DialogHeader','DialogTitle']],['@/components/ui/button',['Button']]])dependencies[id]=Object.fromEntries(names.map(n=>[n,n]))
 const mod={exports:{}},context={module:mod,exports:mod.exports,Error,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},crypto:{randomUUID:()=>`offline-new-${++serial}`},console:{error:(...args)=>events.push(['error-log',...args])},
  sessionStorage:{setItem:(key,value)=>{if(api.storageFail)throw new Error('Offline storage unavailable');api.onStorage?.();events.push(['intent',key,JSON.parse(value)])}},
  window:{location:{pathname:'/studio/templates',search:'',assign:url=>events.push(['navigate',url])}},fetch:()=>assert.fail('No network permitted'),
  require:id=>{assert.ok(id in dependencies,id);return dependencies[id]},
 }
 const point='\n  const phaseLabel = phase'
 assert.equal(code.split(point).length,2)
 vm.runInNewContext(compile(code.replace(point,'\n  globalThis.__handlers = { handleStart, handleOpenChange, acceptFile }\n'+point)),context)
 const h={api,events,requests,context,
  render(next=props||{open:true,onOpenChange:open=>{events.push(['open',open]);if(api.selfUnmount)h.unmount()}}){props=next;let turns=0;do{assert.ok(turns++<10,'No layout render loop');scheduled=false;cursor=0;renders++;tree=mod.exports.TemplateIngestDialog(props);while(effects.length)effects.shift()()}while(scheduled);return tree},
  choose(file=nativeFile){const input=flat(tree).find(n=>n.type==='input');const target={files:[file],value:'chosen'};input.props.onChange({target});assert.equal(target.value,'');if(scheduled)h.render();return h},
  start:()=>context.__handlers.handleStart(),get startHandler(){return context.__handlers.handleStart},get acceptHandler(){return context.__handlers.acceptFile},
  get tree(){return tree},get props(){return props},get writes(){return writes},get lateWrites(){return lateWrites},get renders(){return renders},
  unmount(){closed=true;for(const slot of slots)slot?.cleanup?.()},
  remountEffects(){closed=false;for(const slot of slots)if(slot?.effect)slot.cleanup=slot.effect();if(scheduled)h.render()},
 }
 h.render();return h
}
const snapshot=tree=>JSON.stringify(tree,(k,v)=>typeof v==='function'?'[native callback]':v)
const mutation=h=>h.events.filter(e=>['create','intent','navigate','open'].includes(e[0]))

// Exact native validation, accepted extensions/limit, payload type and body
// wrapper remain unchanged. The optional ownership/pause pipeline is exercised
// below against real native callbacks, including default-off whole-render/event
// parity; it no longer has a truthful whole-component equality witness.
const nodeSource=code=>ts.createSourceFile('ingest.tsx',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const find=(node,predicate)=>{if(predicate(node))return node;let value;ts.forEachChild(node,n=>{if(!value)value=find(n,predicate)});return value}
for(const name of['MAX_INGEST_FILE_BYTES','ACCEPTED_EXTENSIONS','IngestIntentPayload','fileKind','validateIngestFile','TemplateFlowBody']){
 const predicate=n=>n.name?.getText()===name
 const currentAst=nodeSource(source),originalAst=nodeSource(baseline)
 const current=find(currentAst,predicate),original=find(originalAst,predicate)
 assert.ok(current&&original,name)
 const print=(node,ast)=>ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Unspecified,node,ast)
 assert.equal(print(current,currentAst),print(original,originalAst),`${name}: exact native contract`);checks++
}

// Confirm original actual leaf defect beyond unmount cleanup's reach.
{
 const h=harness(baseline),d=deferred();h.api.upload=()=>d.promise;h.choose();const task=h.start();h.unmount();d.resolve(uploadResult);await task
 assert.ok(mutation(h).some(e=>e[0]==='create'));assert.ok(mutation(h).some(e=>e[0]==='intent'));assert.ok(mutation(h).some(e=>e[0]==='navigate'));assert.ok(h.lateWrites>0);checks++
}
for(const flag of[undefined,'false','TRUE','1']){
 const a=harness(source,flag),b=harness(baseline,flag)
 a.choose();b.choose();assert.equal(snapshot(a.tree),snapshot(b.tree));await a.start();await b.start();a.render();b.render()
 assert.deepEqual(a.events,b.events);assert.equal(snapshot(a.tree),snapshot(b.tree));checks++
 const old=harness(source,flag),d=deferred();old.api.upload=()=>d.promise;old.choose();const task=old.start();old.unmount();d.resolve(uploadResult);await task
 assert.ok(old.events.some(e=>e[0]==='navigate'),'Classic asynchronous lifetime stays unchanged');checks++
}
for(const extension of['pptx','PPT','pdf']){
 const h=harness();h.choose({...nativeFile,name:`Source.${extension}`});await h.start();h.render()
 assert.deepEqual(h.events.find(e=>e[0]==='intent'),['intent','deckster_ingest_intent_offline-new-1',{storage_path:'offline/source.pptx',file_name:`Source.${extension}`,kind:extension.toLowerCase()}])
 assert.equal(h.requests[0].sessionId,'offline-new-1');assert.equal(h.requests[0].userId,'offline-owner');assert.equal(h.requests[0].intent,'template_ingest')
 assert.deepEqual(h.events.filter(e=>e[0]==='create')[0],['create','offline-new-1',`Template: Source.${extension}`]);assert.deepEqual(h.events.slice(-2),[['open',false],['navigate','/builder?session_id=offline-new-1']]);checks++
}
for(const[file,reason]of[[{...nativeFile,name:'source.txt'},'Unsupported file type'],[{...nativeFile,size:0},'File is empty'],[{...nativeFile,size:100*1024*1024+1},'File is larger']]){
 const h=harness();h.choose(file);await h.start();assert.match(text(h.tree),new RegExp(reason));assert.equal(h.requests.length,0);checks++
}
{
 const h=harness();h.choose({...nativeFile,size:100*1024*1024});await h.start();assert.equal(h.requests.length,1);checks++
}
for(const pause of['upload','create'])for(const change of['route','query','account','open','unmount','roundtrip','strict'])for(const result of['true','false','throw']){
 const h=harness(),d=deferred();if(pause==='upload')h.api.upload=()=>d.promise;else h.api.create=()=>d.promise
 h.choose();const captured=h.startHandler,task=captured();await flush();assert.equal(h.requests.length,1);assert.equal(h.events.filter(e=>e[0]==='create').length,pause==='create'?1:0,'Native requested await boundary reached')
 const original=h.context.window.location.pathname
 if(change==='unmount'||change==='strict'){h.unmount();if(change==='strict'){h.remountEffects();h.render()}}
 else{
  if(change==='account')h.api.user={id:'other-account'}
  else if(change==='open')h.render({...h.props,open:false})
  else if(change==='query')h.context.window.location.search='?session_id=other-session'
  else h.context.window.location.pathname='/dashboard'
  h.render()
  if(change==='roundtrip'){h.context.window.location.pathname=original;h.render()}
 }
 const before=JSON.stringify(h.events),writes=h.writes
 h.requests[0].onProgress({percent:88})
 result==='throw'?d.reject(new Error('Late local rejection')):d.resolve(result==='false'?null:pause==='upload'?uploadResult:{id:'offline-new-1'})
 await task;assert.equal(JSON.stringify(h.events),before,`${pause}/${change}/${result}: no old continuation`);assert.equal(h.writes,writes)
 if(change!=='unmount'){await captured();assert.equal(h.requests.length,1,'Old handler cannot restart in changed ownership')}
 checks++
}
// A URL change is checked even before React/Next delivers a rerender.
{
 const h=harness(),d=deferred();h.api.upload=()=>d.promise;h.choose();const task=h.start();h.context.window.location.search='?session_id=destination-B'
 const writes=h.writes;h.requests[0].onProgress({percent:95});d.resolve(uploadResult);await task;assert.equal(h.writes,writes);assert.equal(mutation(h).length,0);checks++
}
// Immediate duplicate Start, close and queued file change use the ref guard
// before phase/busy render. Actual normal cancel works again after failure.
{
 const h=harness(),d=deferred();h.api.upload=()=>d.promise;h.choose();const start=h.startHandler,accept=h.acceptHandler,task=start()
 await start();h.context.__handlers.handleOpenChange(false);accept({...nativeFile,name:'Wrong replacement.pdf'});assert.equal(h.requests.length,1);assert.equal(mutation(h).length,0)
 h.render();assert.match(text(h.tree),/Original source.PPTX/);assert.equal(flat(h.tree).find(n=>n.type==='input').props.disabled,true)
 h.requests[0].onProgress({percent:500});h.render();assert.equal(flat(h.tree).find(n=>n.props?.role==='progressbar').props['aria-valuenow'],90)
 h.requests[0].onProgress({percent:-10});h.render();assert.equal(flat(h.tree).find(n=>n.props?.role==='progressbar').props['aria-valuenow'],2)
 d.reject(new Error('Offline upload refusal END'));await task;h.render();assert.match(text(h.tree),/Offline upload refusal END/);assert.equal(flat(h.tree).find(n=>n.type==='input').props.disabled,false)
 h.context.__handlers.handleOpenChange(false);assert.ok(h.events.some(e=>e[0]==='open'&&e[1]===false));checks++
}
for(const failure of['upload','create-null','create-throw','storage']){
 const h=harness();h.choose();if(failure==='upload')h.api.upload=async()=>{throw 'Unexpected non-Error'}
 if(failure==='create-null')h.api.create=async()=>null
 if(failure==='create-throw')h.api.create=async()=>{throw new Error('Offline row refusal END')}
 if(failure==='storage')h.api.storageFail=true
 await h.start();h.render();assert.equal(h.events.filter(e=>e[0]==='navigate').length,0);assert.equal(flat(h.tree).find(n=>n.type==='input').props.disabled,false)
 assert.match(text(h.tree),failure==='upload'?/Upload failed/:failure==='storage'?/storage unavailable/:failure==='create-null'?/Failed to create/:/Offline row refusal END/)
 h.api.upload=async()=>uploadResult;h.api.create=async id=>({id});h.api.storageFail=false;await h.start();assert.equal(h.events.filter(e=>e[0]==='navigate').length,1);checks++
}
// Valid successful parent close intentionally unmounts the library leaf. The
// owned handoff is committed before close; HARD navigation must still follow.
{
 const h=harness();h.api.selfUnmount=true;h.choose();await h.start();assert.deepEqual(h.events.slice(-2),[['open',false],['navigate','/builder?session_id=offline-new-1']]);assert.equal(h.lateWrites,0)
 const writes=h.writes;h.requests[0].onProgress({percent:100});assert.equal(h.writes,writes);checks++
}
// A replacement request owns its own pending state; a rejected/true old
// completion and progress cannot release or clear that newer request.
for(const pause of['upload','create'])for(const outcome of['true','throw']){
 const h=harness(),a=deferred(),b=deferred();if(pause==='upload')h.api.upload=()=>a.promise;else h.api.create=()=>a.promise
 h.choose();const first=h.start();await flush();h.context.window.location.search='?session_id=B';h.render();h.render()
 h.choose({...nativeFile,name:'B retained.pdf'});h.api.upload=()=>b.promise;h.api.create=async id=>({id});const second=h.start();await flush()
 assert.equal(h.requests.length,2);const before=JSON.stringify(h.events),writes=h.writes
 h.requests[0].onProgress({percent:100});outcome==='throw'?a.reject(new Error('Obsolete A failure')):a.resolve(pause==='upload'?uploadResult:{id:'offline-new-1'});await first
 assert.equal(JSON.stringify(h.events),before);assert.equal(h.writes,writes);await h.start();assert.equal(h.requests.length,2)
 h.render();assert.match(text(h.tree),/B retained.pdf/);assert.equal(flat(h.tree).find(n=>n.type==='input').props.disabled,true)
 b.reject(new Error('Current B refusal'));await second;h.render();assert.match(text(h.tree),/Current B refusal/);assert.match(text(h.tree),/B retained.pdf/);checks++
}
for(const user of[{email:'offline-email@example.invalid'},null]){
 const h=harness();h.api.user=user;h.render();h.choose();await h.start();assert.equal(h.requests[0].userId,user?.email??'anonymous');checks++
}
// Same-owner callback replacement uses the current native close handler.
{
 const h=harness(),d=deferred();h.api.upload=()=>d.promise;h.choose();const task=h.start()
 h.render({...h.props,onOpenChange:open=>h.events.push(['latest-open',open])});d.resolve(uploadResult);await task
 assert.equal(h.events.filter(e=>e[0]==='open').length,0);assert.deepEqual(h.events.slice(-2),[['latest-open',false],['navigate','/builder?session_id=offline-new-1']]);checks++
}
// Initial Strict Mode setup → cleanup → setup, before any file selection.
// The harness rerenders ONLY when an actual state setter schedules it, including
// layout settlement; choose likewise settles only its actual selection writes.
// No test-side unrelated render is injected between replay and first input.
const removeStartupRefresh=value=>value
 .replace('  const [, refreshStudioMountHandlers] = useState(0)\n','')
 .replace(/    \/\/ Strict Mode replays setup after cleanup\.[\s\S]*?    if \(studioMountEpochRef.current !== studioMountEpoch\) refreshStudioMountHandlers\(value => value \+ 1\)\n/,'')
{
 const broken=harness(removeStartupRefresh(source));broken.unmount();broken.remountEffects();const before=broken.writes
 broken.choose();await broken.start();assert.equal(broken.requests.length,0);assert.equal(broken.writes,before);checks++
}
for(const code of[baseline,source]){
 const h=harness(code),heldOldAccept=h.acceptHandler,heldOldStart=h.startHandler
 h.unmount();const rendersBefore=h.renders;h.remountEffects()
 if(code===source)assert.ok(h.renders>rendersBefore,'The real layout setup schedules handler refresh')
 h.choose();await h.start();assert.equal(h.requests.length,1,'First native selection/start works after initial replay');checks++
 if(code===source){const before=JSON.stringify(h.events),writes=h.writes;heldOldAccept({...nativeFile,name:'Retired first-render.pdf'});await heldOldStart();assert.equal(JSON.stringify(h.events),before);assert.equal(h.writes,writes);checks++}
}
// Optional outer predicates: account identity retires continuations even before
// a child rerender/cleanup; same-owner verification pauses retain real completed
// stages and resume without repeating their upload/session/staging operations.
function guardedHarness(){
 const identity={owner:'A',ready:true}
 const h=harness();const props={open:true,onOpenChange:open=>{h.events.push(['open',open]);if(h.api.selfUnmount)h.unmount()},isCurrent:()=>identity.owner==='A',canStart:()=>identity.owner==='A'&&identity.ready}
 h.render(props);return{h,identity,props}
}
for(const boundary of['upload','create','intent']){
 const{h,identity}=guardedHarness(),d=deferred();
 if(boundary==='upload')h.api.upload=()=>d.promise
 if(boundary==='create')h.api.create=()=>d.promise
 if(boundary==='intent')h.api.onStorage=()=>{identity.ready=false}
 h.choose();const task=h.start();await flush()
 identity.ready=false
 if(boundary==='upload')d.resolve(uploadResult)
 if(boundary==='create')d.resolve({id:'offline-new-1'})
 await task;h.render()
 assert.match(text(h.tree),/Verification paused this handoff/)
 assert.match(text(h.tree),/Continue handoff/)
 assert.equal(h.events.filter(e=>e[0]==='navigate').length,0)
 assert.equal(h.requests.length,1)
 assert.equal(h.events.filter(e=>e[0]==='create').length,boundary==='upload'?0:1)
 const before=h.events.length;await h.start();assert.equal(h.events.length,before,'Unready continuation starts no stage')
 identity.ready=true;h.api.onStorage=undefined;h.render();await h.start()
 assert.equal(h.requests.length,1,'Completed upload not repeated')
 assert.equal(h.events.filter(e=>e[0]==='create').length,1,'Completed session creation not repeated')
 assert.equal(h.events.filter(e=>e[0]==='intent').length,1,'Completed intent staging not repeated')
 assert.deepEqual(h.events.slice(-2),[['open',false],['navigate','/builder?session_id=offline-new-1']]);checks++
}
for(const boundary of['upload','create'])for(const result of['true','throw']){
 const{h,identity}=guardedHarness(),d=deferred();if(boundary==='upload')h.api.upload=()=>d.promise;else h.api.create=()=>d.promise
 h.choose();const held=h.startHandler,task=held();await flush();identity.owner='B'
 const before=JSON.stringify(h.events),writes=h.writes
 h.requests[0].onProgress({percent:77})
 result==='throw'?d.reject(new Error('Old A failure')):d.resolve(boundary==='upload'?uploadResult:{id:'offline-new-1'})
 await task;await held();assert.equal(JSON.stringify(h.events),before);assert.equal(h.writes,writes);checks++
}
for(const retire of['B',null]){
 const{h,identity}=guardedHarness();h.choose();const heldStart=h.startHandler,heldAccept=h.acceptHandler;identity.owner=retire
 const writes=h.writes;await heldStart();heldAccept({...nativeFile,name:'Blocked.pdf'});h.context.__handlers.handleOpenChange(false)
 assert.equal(h.requests.length,0);assert.equal(h.writes,writes);assert.equal(mutation(h).length,0);checks++
}
{
 const{h,identity,props}=guardedHarness();h.choose();const oldStart=h.startHandler,oldAccept=h.acceptHandler
 h.render({...props,isCurrent:()=>true,canStart:()=>true});identity.owner='B'
 await oldStart();oldAccept({...nativeFile,name:'Wrong.pdf'});assert.equal(h.requests.length,0);assert.equal(mutation(h).length,0);checks++
}
for(const change of['owner','readiness']){
 const{h,identity,props}=guardedHarness();h.api.selfUnmount=true
 h.render({...props,onOpenChange:open=>{h.events.push(['open',open]);if(change==='owner')identity.owner='B';else identity.ready=false;h.unmount()}})
 h.choose();await h.start();assert.equal(h.events.filter(e=>e[0]==='navigate').length,change==='owner'?0:1,'After intentional close only outer identity vetoes navigation');assert.equal(h.lateWrites,0);checks++
}
{
 const{h,identity}=guardedHarness(),d=deferred();h.api.upload=()=>d.promise;h.choose();const task=h.start();identity.ready=false
 h.requests[0].onProgress({percent:40});h.render();assert.equal(flat(h.tree).find(n=>n.props?.role==='progressbar').props['aria-valuenow'],36,'Same-owner pending progress retained')
 d.resolve(uploadResult);await task;h.render();h.context.__handlers.handleOpenChange(false)
 assert.deepEqual(h.events.slice(-1),[['open',false]],'Paused handoff can be closed without pretending completed work was undone');checks++
}
{
 const h=harness();h.choose();const heldStart=h.startHandler,heldAccept=h.acceptHandler;h.context.__handlers.handleOpenChange(false)
 const before=JSON.stringify(h.events),writes=h.writes;await heldStart();heldAccept({...nativeFile,name:'Queued after cancel.pdf'})
 assert.equal(h.requests.length,0);assert.equal(JSON.stringify(h.events),before);assert.equal(h.writes,writes,'Accepted Cancel synchronously retires captured local handlers');checks++
}
for(const boundary of['upload','create']){
 const{h,identity}=guardedHarness(),d=deferred();if(boundary==='upload')h.api.upload=()=>d.promise;else h.api.create=()=>d.promise
 h.choose();const task=h.start();await flush();identity.ready=false;d.resolve(boundary==='upload'?uploadResult:{id:'offline-new-1'});await task;h.render()
 h.unmount();h.remountEffects();identity.ready=true;h.render();await h.start()
 assert.equal(h.requests.length,1,'Paused acknowledged upload survives same-owner effect replay')
 assert.equal(h.events.filter(e=>e[0]==='create').length,1,'Paused acknowledged session survives replay')
 assert.equal(h.events.filter(e=>e[0]==='navigate').length,1);checks++
}
for(const retirement of['cancel','unmount']){
 const h=harness();h.choose();const dropzone=flat(h.tree).find(n=>n.props?.role==='button')
 if(retirement==='cancel')h.context.__handlers.handleOpenChange(false);else h.unmount()
 const writes=h.writes;const event={preventDefault(){},stopPropagation(){},dataTransfer:{files:[nativeFile]}}
 dropzone.props.onDragOver(event);dropzone.props.onDragLeave(event);dropzone.props.onDrop(event)
 assert.equal(h.writes,writes,'Retired drag handlers cannot write local state');checks++
}
// Replacing/invalidating a paused checkpoint is a fresh handoff; retaining the
// same File keeps Continue and its completed upload facts. No native defaults
// are normalized or waived for this focused transition.
for(const replacement of['different','invalid','same']){
 const{h,identity}=guardedHarness(),d=deferred();h.api.upload=()=>d.promise;h.choose();const task=h.start();identity.ready=false;d.resolve(uploadResult);await task;h.render()
 assert.match(text(h.tree),/Continue handoff/);identity.ready=true;h.render()
 const candidate=replacement==='same'?nativeFile:{...nativeFile,name:replacement==='invalid'?'Invalid.txt':'Replacement.pdf'}
 h.choose(candidate);assert.match(text(h.tree),replacement==='same'?/Continue handoff/:/Upload & convert/)
 if(replacement!=='same')assert.doesNotMatch(text(h.tree),/Verification paused/)
 if(replacement==='invalid'){await h.start();assert.equal(h.requests.length,1)}
 else{h.api.upload=async()=>uploadResult;await h.start();assert.equal(h.requests.length,replacement==='same'?1:2);assert.equal(h.events.filter(e=>e[0]==='create').length,1);assert.equal(h.events.filter(e=>e[0]==='navigate').length,1);assert.match(h.events.at(-1)[1],new RegExp(replacement==='same'?'offline-new-1':'offline-new-2'))}
 checks++
}
console.log(`Template ingest ownership: ${checks} actual-leaf checks passed; native baseline defect reproduced, exact classic parity, guarded continuations/progress, preserved success-close-hard-navigation. No network/service ACK.`)
