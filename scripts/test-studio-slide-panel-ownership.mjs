// Execute the actual native panel, hooks, UI callbacks and pure compose helpers.
// All requests/responses are supplied local inputs; no browser/services/ACK proof.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { normalizeClarificationSuccessor } from '../docs/studio-v4/twenty-four-hour-parity-20261005/builder1/selection-lane-successor/normalize-lane.mjs'
const root=new URL('../',import.meta.url),file='components/slide-generation-panel/index.tsx',baseline='a30109490bccc03bb125c06993797197243edb3f'
const panelInput=process.argv.includes('--selection-snapshot')?'docs/studio-v4/twenty-four-hour-parity-20261005/builder1/sync-selection-review/FINAL-panel.tsx.txt':process.argv.includes('--clarification-snapshot')?'docs/studio-v4/twenty-four-hour-parity-20261005/builder1/clarification-integration/FINAL-index.tsx.txt':file
const source=fs.readFileSync(new URL(panelInput,root),'utf8'),before=execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8'})
const plain=x=>JSON.parse(JSON.stringify(x)),deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}}
const response=(body,status=200)=>({ok:status>=200&&status<300,json:async()=>body})
const accepted=(request)=>({status:'accepted',job_id:request.body.job_id,session_id:request.body.session_id,presentation_id:request.body.presentation_id,target_index:1})
const built={status:'built',presentation_id:'presentation-A',slide_index:1,presentation_url:'https://readonly.invalid/A',slides_built:3}
const needs={status:'needs_input',questions:[{slot:'audience',ask:'Who is the audience?'}]}
const compile=text=>{const out=ts.transpileModule(text,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});assert.equal((out.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);return out.outputText}
const loadPure=path=>{const m={exports:{}};vm.runInNewContext(compile(fs.readFileSync(new URL(path,root),'utf8')),{module:m,exports:m.exports});return m.exports}
const compose=loadPure('components/slide-generation-panel/compose-helpers.ts'),asyncCompose=loadPure('lib/slide-compose-async.ts')
const jsx=(type,props)=>({type,props:props||{}}),nodes=t=>Array.isArray(t)?t.flatMap(nodes):!t||typeof t!=='object'?[]:[t,...nodes(t.props?.children)]
const one=(t,p)=>{const found=nodes(t).filter(p);assert.equal(found.length,1,'One actual native control');return found[0]},text=t=>Array.isArray(t)?t.map(text).join(''):t&&typeof t==='object'?text(t.props?.children):String(t??'')
const equalDeps=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]))
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
let checks=0
function harness(options={}){
 const {async=true,original=false,onRequest,onAccepted,onBuilt,override={}}=options,flag=Object.hasOwn(options,'flag')?options.flag:'true'
 const slots=[],effects=[],requests=[],events=[],listeners=new Map();let cursor=0,dirty=false,dead=false,lateWrites=0,tree,api,id=0
 const props={isOpen:true,onClose:()=>events.push(['close']),mode:'compose',refineTarget:null,currentSlide:2,sessionId:'session-A',presentationId:'presentation-A',research:{useUploadedDocuments:true,useWebSearch:true,useDeepResearch:false,useKnowledgeGraph:false},buildThemeSelection:{mode:'auto'},enabled:true,onAccepted:job=>{events.push(['accepted',plain(job)]);onAccepted?.(job,h)},onBuilt:result=>{events.push(['built',plain(result)]);onBuilt?.(result,h)},...override}
 const hook={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,value=>{if(dead)lateWrites++;const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(slots[i].value,next)){slots[i].value=next;dirty=true}}]},
  useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},
  useMemo(fn,deps){const i=cursor++;if(!equalDeps(slots[i]?.deps,deps))slots[i]={deps,value:fn()};return slots[i].value},
  useCallback(fn,deps){return hook.useMemo(()=>fn,deps)},
  useEffect(setup,deps){scheduleEffect(setup,deps,false)},
  useLayoutEffect(setup,deps){scheduleEffect(setup,deps,true)},
 }
 function scheduleEffect(setup,deps,layout){const i=cursor++;if(!equalDeps(slots[i]?.deps,deps)){const old=slots[i];slots[i]={deps,setup,cleanup:old?.cleanup};effects.push({layout,run:()=>{slots[i].cleanup?.();slots[i].cleanup=setup()}})}}
 const imports={react:hook,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},'./compose-helpers':compose,'@/lib/slide-compose-async':asyncCompose,'@/lib/config':{features:{slideComposerAsyncEnabled:async,slideComposerTraceEnabled:false}},'@/lib/utils':{cn:(...x)=>x.filter(Boolean).join(' ')},'@/lib/theme-builder':{FALLBACK_THEME_PRESETS:[]},'@/hooks/use-knowledge-graph':{useKnowledgeGraph:()=>({isEntitled:true,isSubscribed:true})},'@/lib/studio-slide-shortcuts':{shouldYieldStudioSlidePanelShortcut:()=>false}}
 const m={exports:{}},context={Error,module:m,exports:m.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},window:{localStorage:{getItem:()=>null},addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:(key,fn)=>{if(listeners.get(key)===fn)listeners.delete(key)}},crypto:{randomUUID:()=>`supplied-job-${++id}`},console,fetch:(url,options)=>{const entry={url,method:options.method,headers:plain(options.headers),body:JSON.parse(options.body)};requests.push(entry);const result=onRequest?.(entry,requests);return result instanceof Error?Promise.reject(result):result??Promise.resolve(response(async?accepted(entry):built))},require:name=>{if(name in imports)return imports[name];if(name.endsWith('.css'))return{};if(name==='lucide-react'||name.startsWith('@/components/'))return new Proxy({}, {get:(_target,key)=>key});throw new Error(`Refused unexpected offline dependency ${name}`)}}
 const instrument=(original?before:source).replace('  return (\n    <div className="absolute inset-0 z-20 flex pointer-events-none">',`  globalThis.__panel = {handleGenerate, prompt, keyMessage, answers, needsInput, error, successMessage, acceptedJobId, isGenerating};\n  return (\n    <div className="absolute inset-0 z-20 flex pointer-events-none">`)
 assert.notEqual(instrument,original?before:source,'Instrument only actual panel return to observe native local state/await callback')
 vm.runInNewContext(compile(instrument),context)
 const render=(extra={})=>{Object.assign(props,extra);let n=0;do{assert.ok(++n<20,'Bounded native effect settling');cursor=0;dirty=false;tree=m.exports.SlideGenerationPanel({...props});api=context.__panel;const pending=effects.splice(0);for(const layout of[true,false])for(const effect of pending.filter(x=>x.layout===layout))effect.run()}while(dirty);return tree}
 const prompt=value=>{one(render(),n=>n.type==='GenerationInput').props.onPromptChange(value);render()}
 const key=value=>{let t=render();if(!nodes(t).some(n=>n.type==='Input'&&n.props.value===api.keyMessage)){one(t,n=>n.type==='button'&&text(n)==='More options').props.onClick();t=render()}const parent=one(t,n=>n.type==='label'&&text(n).startsWith('Key message'));one(parent,n=>n.type==='Input').props.onChange({target:{value}});render()}
 const answer=value=>{one(render(),n=>n.type==='Textarea'&&n.props.rows===2).props.onChange({target:{value}});render()}
 const generate=()=>{render();const result=api.handleGenerate();render();return result}
 const h={render,prompt,key,answer,generate,props,requests,events,listeners,get state(){if(!dead)render();return plain(api)},get lateWrites(){return lateWrites},unmount(){dead=true;for(const slot of slots)slot?.cleanup?.()},setupAgain(){dead=false;for(const slot of slots)if(slot?.setup)slot.cleanup=slot.setup();render()}}
 render();return h
}
// The original exact failure is witnessed separately: a real response clears a
// newer local prompt/key, while the dispatched request always correctly stays A.
for(const original of[true,false]){
 const wait=deferred(),h=harness({original,onRequest:()=>wait.promise});h.prompt('Original A');h.key('Original key A');const p=h.generate();h.prompt('Newer draft');h.key('Newer key');wait.resolve(response(accepted(h.requests[0])));await p;assert.equal(h.state.prompt,original?'':'Newer draft');assert.equal(h.state.keyMessage,original?'':'Newer key');assert.equal(h.events[0][0],'accepted');assert.match(h.events[0][1].request.instruction,/Original A/);assert.equal(h.events[0][1].request.presentation_id,'presentation-A');assert.equal(h.state.acceptedJobId,original?'supplied-job-1':null);checks++
}
// Unchanged async/sync success and needs-input retain native payloads, feedback,
// answer clearing and callbacks. No new field, timer, retry or service protocol.
for(const async of[true,false])for(const result of[async?'accepted':'built',...(async?[]:['needs'])]){
 const h=harness({async,onRequest:r=>Promise.resolve(response(result==='accepted'?accepted(r):result==='needs'?needs:built))});h.prompt('Original instruction');h.key('Original key');await h.generate();const r=h.requests[0];assert.equal(r.url,'/api/slides/compose');assert.equal(r.method,'POST');assert.deepEqual(r.headers,{'Content-Type':'application/json'});assert.equal(r.body.session_id,'session-A');assert.equal(r.body.presentation_id,'presentation-A');assert.equal(r.body.insert_after_index,1);assert.equal(r.body.assume_on_missing,async);assert.deepEqual(r.body.theme,{mode:'auto'});assert.deepEqual(r.body.research,{use_uploaded_documents:true,use_web_search:true,use_deep_research:false,use_knowledge_graph:false,web_search_max_queries:3});assert.match(r.body.instruction,/Original instruction/);assert.match(r.body.instruction,/Original key/);assert.equal(h.state.isGenerating,false)
 if(result==='needs'){assert.deepEqual(h.state.needsInput,needs);h.answer('Leaders');assert.deepEqual(h.state.answers,{audience:'Leaders'});assert.equal(h.events.length,0)}else{assert.equal(h.state.prompt,'');assert.equal(h.state.keyMessage,'');assert.equal(h.events.length,1);assert.equal(h.events[0][0],async?'accepted':'built');assert.match(h.state.successMessage,async?/Building slide 2/:/Built slide 2/)}checks++
}
// Same-context key/answer edits, restored values, options and theme changes
// retire only local result ownership; legitimate original jobs still report.
for(const async of[true,false])for(const edit of['prompt','key',...(async?[]:['answer']),'restore','layout','theme']){
 let pending;const h=harness({async,onRequest:r=>pending?pending.promise:Promise.resolve(response(needs))});h.key('Original key');if(edit==='answer'){h.prompt('Ask first');await h.generate();h.answer('Original answer')}
 h.prompt(edit==='answer'?'Same prompt':'Original prompt');if(edit==='answer'){/* Native prompt clears questions, so restore with another supplied needs-input response. */await h.generate();h.answer('Original answer')}
 pending=deferred();const p=h.generate();const body=plain(h.requests.at(-1).body)
 if(edit==='prompt')h.prompt('Newer prompt');if(edit==='key')h.key('Newer key');if(edit==='answer')h.answer('Newer answer');if(edit==='restore'){h.key('Changed then restored');h.key('Original key')};if(edit==='layout'){one(h.render(),n=>n.props?.label==='Slide type'&&typeof n.props.onChange==='function').props.onChange('content_text');h.render()};if(edit==='theme')h.render({buildThemeSelection:{mode:'custom',primary_hex:'#123456'}})
 const snapshot=h.state;pending.resolve(response(async?accepted(h.requests.at(-1)):built));await p;assert.equal(h.state.prompt,snapshot.prompt);assert.equal(h.state.keyMessage,snapshot.keyMessage);assert.deepEqual(h.state.answers,snapshot.answers);assert.deepEqual(h.state.needsInput,snapshot.needsInput);assert.equal(h.state.successMessage,snapshot.successMessage);assert.equal(h.state.acceptedJobId,snapshot.acceptedJobId);assert.equal(h.state.isGenerating,false);const reported=h.events.at(-1);assert.equal(reported[0],async?'accepted':'built');if(async)assert.deepEqual(reported[1].request,body);checks++
}
// Input handlers also retire pending draft ownership synchronously, before a
// React repaint, so the same-tick response cannot replace a queued user edit.
for(const async of[true,false])for(const field of['prompt','key',...(async?[]:['answer'])]){
 let pending;const h=harness({async,onRequest:()=>pending?pending.promise:Promise.resolve(response(needs))});h.prompt('A');h.key('A key');if(field==='answer'){await h.generate();h.answer('A answer')};pending=deferred();const p=h.generate(),t=h.render()
 if(field==='prompt')one(t,n=>n.type==='GenerationInput').props.onPromptChange('New queued prompt')
 if(field==='key')one(one(t,n=>n.type==='label'&&text(n).startsWith('Key message')),n=>n.type==='Input').props.onChange({target:{value:'New queued key'}})
 if(field==='answer')one(t,n=>n.type==='Textarea'&&n.props.rows===2).props.onChange({target:{value:'New queued answer'}})
 // No render/flush between native edit callback and supplied response.
 pending.resolve(response(async?accepted(h.requests.at(-1)):built));await p
 assert.equal(field==='prompt'?h.state.prompt:field==='key'?h.state.keyMessage:h.state.answers.audience,field==='prompt'?'New queued prompt':field==='key'?'New queued key':'New queued answer');assert.equal(h.state.acceptedJobId,null);assert.equal(h.events.at(-1)[0],async?'accepted':'built');checks++
}
// Current context changes and A→B→A retirement: no old draft/error/busy/needs
// result adoption. The existing parent still receives the original ACK.
const changes={refine:{mode:'refine',refineTarget:{slide_id:'slide-B',slide_index:0,title:'B'},currentSlide:1},version:{presentationId:'presentation-B'},slide:{currentSlide:4},session:{sessionId:'session-B',presentationId:'presentation-B'},closed:{isOpen:false},reopened:{isOpen:false},roundtrip:{sessionId:'session-B'}}
for(const async of[true,false])for(const [name,change]of Object.entries(changes))for(const kind of['success','needs','refusal','throw']){
 const wait=deferred(),h=harness({async,onRequest:()=>wait.promise});h.prompt('Original A');h.key('Key A');const p=h.generate();h.render(change);if(name==='reopened')h.render({isOpen:true});if(name==='roundtrip')h.render({sessionId:'session-A'});h.prompt('Current B draft');h.key('Current B key');const snapshot=h.state
 if(kind==='throw')wait.reject(new Error('Full old-target failure END'));else wait.resolve(response(kind==='refusal'?{error:'Full old-target failure END'}:kind==='needs'?needs:async?accepted(h.requests[0]):built,kind==='refusal'?503:200));await p
 assert.equal(h.state.prompt,snapshot.prompt);assert.equal(h.state.keyMessage,snapshot.keyMessage);assert.deepEqual(h.state.answers,snapshot.answers);assert.deepEqual(h.state.needsInput,snapshot.needsInput);assert.equal(h.state.error,snapshot.error);assert.equal(h.state.successMessage,snapshot.successMessage);assert.equal(h.state.acceptedJobId,snapshot.acceptedJobId);assert.equal(h.state.isGenerating,false);assert.equal(h.events.length,kind==='success'?1:0);if(async&&kind==='success'){assert.equal(h.events[0][1].request.session_id,'session-A');assert.equal(h.events[0][1].request.presentation_id,'presentation-A')};checks++
}
// Retired mount can't revive after retained-ref effect cleanup/setup; queued
// old handlers cannot dispatch new requests. Legitimate in-flight ACK survives.
for(const async of[true,false])for(const replay of[false,true]){
 const wait=deferred(),h=harness({async,onRequest:()=>wait.promise});h.prompt('Original A');const old=one(h.render(),n=>n.type==='GenerationInput').props.onSubmit,p=h.generate();h.unmount();if(replay){h.setupAgain();h.prompt('New mount draft');h.key('New mount key')};const beforeWrites=h.lateWrites;old();assert.equal(h.requests.length,1);wait.resolve(response(async?accepted(h.requests[0]):built));await p;assert.equal(h.lateWrites,beforeWrites);assert.equal(h.events.length,1);if(replay){assert.equal(h.state.prompt,'New mount draft');assert.equal(h.state.keyMessage,'New mount key');assert.equal(h.state.isGenerating,false)}checks++
}
// Current failures retain full reason, normal retry and old-result isolation
// when another same-draft request starts before the first response resolves.
for(const async of[true,false])for(const failure of['http','throw','invalid']){
 let attempt=0;const h=harness({async,onRequest:r=>++attempt===1?(failure==='throw'?Promise.reject(new Error('Complete native failure END')):Promise.resolve(response(failure==='invalid'?{status:'unknown'}:{error:'Complete native failure END'},failure==='http'?503:200))):Promise.resolve(response(async?accepted(r):built))});h.prompt('Retry this instruction');await h.generate();assert.equal(h.state.prompt,'Retry this instruction');assert.ok(h.state.error);if(failure!=='invalid')assert.match(h.state.error,/Complete native failure END/);assert.equal(h.events.length,0);await h.generate();assert.equal(h.events.length,1);assert.equal(h.state.error,null);assert.equal(h.state.prompt,'');checks++
}
for(const async of[true,false]){
 const a=deferred(),b=deferred(),h=harness({async,onRequest:(_r,rs)=>rs.length===1?a.promise:b.promise});h.prompt('Same pending draft');const p=h.generate(),q=h.generate();a.resolve(response(async?accepted(h.requests[0]):built));await p;assert.equal(h.state.prompt,'Same pending draft');assert.equal(h.state.successMessage,null);assert.equal(h.state.isGenerating,!async);b.resolve(response(async?accepted(h.requests[1]):built));await q;assert.equal(h.state.prompt,'');assert.equal(h.state.isGenerating,false);assert.equal(h.events.length,2);checks++
}
// A callback can synchronously retire/navigate the panel; sync finally cannot
// repaint busy into the new context, and asynchronous result still reports once.
for(const async of[true,false]){
 const h=harness({async,[async?'onAccepted':'onBuilt']:(_result,h)=>{h.render({sessionId:'session-B',presentationId:'presentation-B'});h.prompt('B callback draft');h.unmount()}});h.prompt('Original A');await h.generate();assert.equal(h.events.length,1);assert.equal(h.lateWrites,0);checks++
}
// All original native validation guards and refine payload/current needs-input
// continuation remain exact. Actual UI answer/key callbacks feed instruction.
for(const async of[true,false]){
 for(const [override,prompt,reason]of[[{enabled:false},'text','disabled'],[{sessionId:''},'text','session'],[{mode:'refine',presentationId:null},'text','presentation'],[{mode:'refine'},'text','Choose a slide'],[{mode:'refine',refineTarget:{slide_id:'s',slide_index:2}},'','Describe what'],[{},'','Describe the slide']]){const h=harness({async,override});if(prompt)h.prompt(prompt);await h.generate();assert.equal(h.requests.length,0);assert.match(h.state.error,new RegExp(reason));checks++}
 const h=harness({async,override:{mode:'refine',refineTarget:{slide_id:'native-slide',slide_index:3,title:'Current slide'}}});h.prompt('Keep full native refinement');await h.generate();const body=h.requests[0].body;assert.equal(h.requests[0].url,'/api/slides/refine');assert.equal(body.slide_id,'native-slide');assert.equal(body.slide_index,3);assert.equal(body.insert_after_index,undefined);assert.equal(body.assume_on_missing,async);assert.equal(h.events[0][0],async?'accepted':'built');if(async){assert.equal(h.events[0][1].kind,'refine');assert.equal(h.events[0][1].target_slide_id,'native-slide')};checks++
}
// Existing synchronous needs-input Continue feeds the native normalized ask,
// answer and key message into the next exact request, with assume=false.
{
 const h=harness({async:false,onRequest:(_r,rs)=>Promise.resolve(response(rs.length===1?needs:built))});h.prompt('Original question prompt');h.key('Native key message');await h.generate();h.answer('Executive audience');one(h.render(),n=>n.type==='button'&&text(n)==='Continue').props.onClick();await settle();assert.equal(h.requests.length,2);assert.match(h.requests[1].body.instruction,/Executive audience/);assert.match(h.requests[1].body.instruction,/Native key message/);assert.equal(h.requests[1].body.assume_on_missing,false);assert.equal(h.events[0][0],'built');assert.deepEqual(h.state.answers,{});assert.equal(h.state.needsInput,null);checks++
}
// Changed base key retires its obsolete clarification; answer edits alone do not.
{
 const h=harness({async:false,onRequest:()=>Promise.resolve(response(needs))});h.prompt('Question base');h.key('Original base key');await h.generate();h.answer('Original audience');assert.deepEqual(h.state.needsInput,needs);h.key('Different base key');assert.equal(h.state.needsInput,null);assert.deepEqual(h.state.answers,{});checks++
}
// Retry/refine current draft payload remains native; real UI optional structure
// selections and diagram research exclusions are identical to the old panel.
for(const type of['content_text','hero_title','hero_section','hero_closing']){
 const h=harness(),old=harness({original:true});for(const x of[h,old]){one(x.render(),n=>n.props?.label==='Slide type').props.onChange(type);x.render();x.prompt('Native options instruction');await x.generate()};assert.deepEqual(h.requests,old.requests);assert.deepEqual(h.events,old.events);checks++
}
// Literal-flag/classic equality: same callbacks/options/DOM and native old result
// adoption outside Studio, not a broad promise that baseline races are fixed.
for(const flag of[undefined,'false','TRUE','1'])for(const async of[true,false]){
 const wait=deferred(),h=harness({flag,async,onRequest:()=>wait.promise}),oldWait=deferred(),old=harness({flag,async,original:true,onRequest:()=>oldWait.promise});for(const x of[h,old]){x.prompt('A');x.key('A key')};const p=h.generate(),q=old.generate();for(const x of[h,old]){x.prompt('B');x.key('B key')};wait.resolve(response(async?accepted(h.requests[0]):built));oldWait.resolve(response(async?accepted(old.requests[0]):built));await Promise.all([p,q]);assert.deepEqual(h.state,old.state);assert.deepEqual(h.requests,old.requests);assert.deepEqual(h.events,old.events);checks++
}
// Reverse only exact reviewed additions/wrappers against the complete native
// pre-edit file. Every option/default/request/callback/reset/JSX stays exact.
const ownershipSetup = "  // Studio keeps a pending request attached to its original draft/context.\n  // A legitimate result still reaches the parent; it cannot clear a newer draft.\n  const studioPanel = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\n  const [studioLifetime, setStudioLifetime] = useState(() => ({ active: false, retired: false }))\n  const studioLifetimeRef = useRef(studioLifetime)\n  const studioContextKey = studioPanel ? JSON.stringify([isOpen, mode, sessionId, presentationId, currentSlide, refineTarget?.slide_id, refineTarget?.slide_index]) : ''\n  const studioContextRef = useRef({ key: studioContextKey })\n  if (studioPanel && studioContextRef.current.key !== studioContextKey) {\n    studioContextRef.current = { key: studioContextKey }\n  }\n  const studioContext = studioContextRef.current\n  const studioDraftKey = studioPanel ? JSON.stringify([prompt, keyMessage, questions, answers, selections, buildThemeSelection, enabled, hasUploadedFiles, kgCardVisible, useUploadedDocuments, useWebSearch, useDeepResearch, useKnowledgeGraph, webSearchMaxQueries]) : ''\n  const studioDraftRef = useRef({ key: studioDraftKey, context: studioContext, lifetime: studioLifetime })\n  if (studioPanel && (studioDraftRef.current.key !== studioDraftKey || studioDraftRef.current.context !== studioContext || studioDraftRef.current.lifetime !== studioLifetime)) {\n    studioDraftRef.current = { key: studioDraftKey, context: studioContext, lifetime: studioLifetime }\n  }\n  const studioDraft = studioDraftRef.current\n  const studioRequestRef = useRef<symbol | null>(null)\n  function retireStudioDraft() {\n    if (studioPanel) studioDraftRef.current = { ...studioDraftRef.current }\n  }\n\n  useEffect(() => {\n    if (!studioPanel) return\n    let lifetime = studioLifetimeRef.current\n    if (lifetime.retired) {\n      lifetime = { active: false, retired: false }\n      studioLifetimeRef.current = lifetime\n      setStudioLifetime(lifetime)\n    }\n    lifetime.active = true\n    return () => {\n      lifetime.active = false\n      lifetime.retired = true\n    }\n  }, [studioPanel])\n\n  useEffect(() => {\n    if (!studioPanel) return\n    studioRequestRef.current = null\n    setIsGenerating(false)\n  }, [studioPanel, studioContext, studioLifetime])\n\n"
const admission = "    if (studioPanel && (!isOpen || !studioLifetime.active || studioLifetime.retired || studioLifetimeRef.current !== studioLifetime || studioDraftRef.current !== studioDraft)) return\n    const request = Symbol('slide-panel-request')\n    if (studioPanel) studioRequestRef.current = request\n    const ownsControls = () => !studioPanel || (studioLifetime.active && !studioLifetime.retired && studioLifetimeRef.current === studioLifetime && studioContextRef.current === studioContext && studioRequestRef.current === request)\n    const ownsDraft = () => ownsControls() && (!studioPanel || studioDraftRef.current === studioDraft)\n"
// Reverse only the 18 option callbacks accepted for this parity slice. The
// actual behavioral cases above continue to execute the unnormalized component.
function reverseSlideOptionDraftGuards(candidate) {
  const pairs = [
  [
    "  function handleLayoutChange(layout: LayoutChoice) {\n    retireStudioDraft()\n",
    "  function handleLayoutChange(layout: LayoutChoice) {\n"
  ],
  [
    "  function handleContentTypeChange(value: OptionalChoice<ContentType>) {\n    retireStudioDraft()\n",
    "  function handleContentTypeChange(value: OptionalChoice<ContentType>) {\n"
  ],
  [
    "  function handleShapeChange(value: OptionalChoice<ShapeSubtype>) {\n    retireStudioDraft()\n",
    "  function handleShapeChange(value: OptionalChoice<ShapeSubtype>) {\n"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setCanvasType(value) }}",
    "onChange={setCanvasType}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setHeroStyle(value) }}",
    "onChange={setHeroStyle}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setContactEmail(value) }}",
    "onChange={setContactEmail}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setContactPhone(value) }}",
    "onChange={setContactPhone}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setContactWebsite(value) }}",
    "onChange={setContactWebsite}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setContactLinkedin(value) }}",
    "onChange={setContactLinkedin}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setAttribution(value) }}",
    "onChange={setAttribution}"
  ],
  [
    "onChange={(event) => { retireStudioDraft(); setEyebrow(event.target.value) }}",
    "onChange={(event) => setEyebrow(event.target.value)}"
  ],
  [
    "onValueChange={(value) => { retireStudioDraft(); setHeroBackground(value) }}",
    "onValueChange={setHeroBackground}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setUseWebSearch(prev => !prev) }}",
    "onClick={() => setUseWebSearch(prev => !prev)}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setUseDeepResearch(prev => !prev) }}",
    "onClick={() => setUseDeepResearch(prev => !prev)}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setUseUploadedDocuments(prev => !prev) }}",
    "onClick={() => setUseUploadedDocuments(prev => !prev)}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setUseKnowledgeGraph(prev => !prev) }}",
    "onClick={() => setUseKnowledgeGraph(prev => !prev)}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setWebSearchMaxQueries(prev => Math.max(1, prev - 1)) }}",
    "onClick={() => setWebSearchMaxQueries(prev => Math.max(1, prev - 1))}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setWebSearchMaxQueries(prev => Math.min(10, prev + 1)) }}",
    "onClick={() => setWebSearchMaxQueries(prev => Math.min(10, prev + 1))}"
  ]
]
  for (const [addition, original] of pairs) {
    assert.equal(candidate.split(addition).length, 2, 'One exact accepted option-retirement addition')
    candidate = candidate.replace(addition, original)
  }
  return candidate
}
let restored=reverseSlideOptionDraftGuards(normalizeClarificationSuccessor(source))
// The separate draft-context test executes these exact Studio reset additions;
// reverse only their reviewed bytes before the original whole-file comparison.
for(const [known,original] of [
 ["      if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'true') lastPanelContextKeyRef.current = null", "      lastPanelContextKeyRef.current = null"],
 ["    const panelContextKey = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\n      ? JSON.stringify([mode, sessionId, presentationId, isRefineMode ? refineTarget?.slide_id ?? 'index' : 'compose', isRefineMode ? refineTarget?.slide_index ?? currentSlide - 1 : currentSlide])\n      : isRefineMode", "    const panelContextKey = isRefineMode"],
 ["    isRefineMode,\n    mode,\n    sessionId,\n    presentationId,", "    isRefineMode,"],
]){assert.equal(restored.split(known).length,2);restored=restored.replace(known,original)}
for(const addition of[ownershipSetup,admission,"    studioPanel,\n    isOpen,\n    studioLifetime,\n    studioContext,\n    studioDraft,\n","            retireStudioDraft()\n"]){assert.equal(restored.split(addition).length,2);restored=restored.replace(addition,'')}
for(const setter of[
 "        setNeedsInput(null)\n        setAnswers({})\n        setPrompt('')\n        setKeyMessage('')\n        setSuccessMessage(isRefineMode\n          ? `Refining slide ${refineSlideNumber} in the background.`\n          : `Building slide ${data.target_index + 1} in the background.`\n        )\n        setAcceptedJobId(data.job_id)\n",
 "        setNeedsInput(data)\n        setAnswers({})\n",
 "        setNeedsInput(null)\n        setAnswers({})\n        setPrompt('')\n        setKeyMessage('')\n        setSuccessMessage(isRefineMode ? `Updated slide ${data.slide_index + 1}.` : `Built slide ${data.slide_index + 1}.`)\n",
]){const wrapped="        if (ownsDraft()) {\n"+setter.split('\n').filter((_,i,a)=>i<a.length-1).map(line=>'  '+line+'\n').join('')+"        }\n";assert.equal(restored.split(wrapped).length,2);restored=restored.replace(wrapped,setter)}
assert.equal(restored.split("if (ownsDraft()) setError(err instanceof Error ? err.message : 'Slide Composer failed')").length,3)
restored=restored.replaceAll("if (ownsDraft()) setError(err instanceof Error ? err.message : 'Slide Composer failed')","setError(err instanceof Error ? err.message : 'Slide Composer failed')")
for(const [known,original]of[
 ["if (ownsControls()) setIsGenerating(false)","setIsGenerating(false)"],
 ["onChange={(event) => { retireStudioDraft(); setKeyMessage(event.target.value) }}","onChange={(event) => setKeyMessage(event.target.value)}"],
 ["onChange={(event) => { retireStudioDraft(); setAnswers(prev => ({ ...prev, [question.slot]: event.target.value })) }}","onChange={(event) => setAnswers(prev => ({ ...prev, [question.slot]: event.target.value }))}"],
]){assert.equal(restored.split(known).length,2);restored=restored.replace(known,original)}
assert.equal(restored,before,'Entire native panel reverses byte-for-byte: options, payloads, classic DOM, callbacks, research/entitlement gates and reset/keyboard policy remain exact');checks++
console.log(`PASS ${checks} actual native slide-panel ownership/option/payload/guard/classic checks. Supplied responses only, no connected ACK or persistence claim.`)

export { harness as panelHarness }
