// Actual native upload hook + pure validation/status helpers. Explicit supplied
// responses only: no browser, account, network, DB, storage or service ACK proof.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
const root=fileURLToPath(new URL('../',import.meta.url)),file='hooks/use-file-upload.ts',baseline='4894987188d9146fb51e7aa97e98815588ac4b96'
const source=fs.readFileSync(path.join(root,file),'utf8'),original=execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8'})
const witness=process.argv.includes('--baseline-witness')
const priorLifetime=execFileSync('git',['show',`7c1d48f:${file}`],{cwd:root,encoding:'utf8'})
// Reverse only explicitly known Studio ownership additions. Every remaining
// source byte (including classic requests, progress, retry/poll and callbacks)
// must match the complete reviewed baseline, with no broad suppression.
let restored=source
const drop=block=>{assert.equal(restored.split(block).length,2,block);restored=restored.replace(block,'')}
restored=restored.replace("import { useState, useCallback, useEffect, useRef } from 'react'","import { useState, useCallback, useRef } from 'react'")
// NEXT_PUBLIC_UPLOAD_OWNER_ID_ENABLED (R-20261007-frontend-23), default off: the owner-id import, the classic-path
// owner id and the refusal guard. The owner-scoped ensure branch carries the same helper and is removed whole below.
drop("import {\n  UPLOAD_OWNER_REQUIRED_MESSAGE,\n  UploadOwnerRequiredError,\n  isUploadOwnerId,\n  isUploadOwnerIdEnabled,\n  researcherUploadOwnerId,\n} from '@/lib/upload-owner'\n")
restored=restored.replace("          // Flag off: `userId || 'anonymous'` as always. Flag on: the account id,\n          // or the upload is refused (R-20261007-frontend-23).\n          user_id: researcherUploadOwnerId(userId),","          user_id: userId || 'anonymous',")
drop("    // R-20261007-frontend-23: with NEXT_PUBLIC_UPLOAD_OWNER_ID_ENABLED on, an upload\n    // whose owner is not an account id (missing, an e-mail, a placeholder) is\n    // refused here, before any chip or request exists. Flag off: skipped.\n    if (isUploadOwnerIdEnabled() && !isUploadOwnerId(userId)) {\n      toast({\n        title: 'Upload blocked',\n        description: UPLOAD_OWNER_REQUIRED_MESSAGE,\n        variant: 'destructive'\n      })\n      throw new UploadOwnerRequiredError()\n    }\n\n")
const helpersStart=restored.indexOf('// Studio upload ownership is local only;'),helpersEnd=restored.indexOf('// End Studio upload ownership helpers.\n\n')
assert.ok(helpersStart>=0&&helpersEnd>helpersStart)
restored=restored.slice(0,helpersStart)+restored.slice(helpersEnd+'// End Studio upload ownership helpers.\n\n'.length)
drop('  const studio = useStudioUploadOwner(sessionId, userId, onUploadComplete)\n  const uploadAdmissionLifetime = studio.admissionLifetime\n  const visibleFiles = STUDIO_UPLOAD_OWNERSHIP ? files.filter(file => studio.ownerRef.current.fileIds.has(file.id)) : files\n')
drop('  if (STUDIO_UPLOAD_OWNERSHIP) sessionIdRef.current = sessionId\n')
restored=restored.replace('updates: Partial<UploadedFile>, owner?: UploadOwner','updates: Partial<UploadedFile>')
drop('    if (STUDIO_UPLOAD_OWNERSHIP && !studio.isCurrent(owner, fileId)) return\n')
// The one new ensure-session branch precedes an untouched classic branch.
const ast=ts.createSourceFile(file,restored,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
let ensure
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='ensureResearcherSession')ensure=node;ts.forEachChild(node,visit)}visit(ast)
const scopedEnsure=ensure.initializer.arguments[0].body.statements[0]
assert.ok(ts.isIfStatement(scopedEnsure)&&scopedEnsure.expression.getText(ast)==='STUDIO_UPLOAD_OWNERSHIP')
const scopedText=restored.slice(scopedEnsure.getStart(ast)-4,scopedEnsure.end)+'\n';drop(scopedText)
restored=restored.replace('async (owner?: UploadOwner): Promise<string>','async (): Promise<string>')
assert.equal(restored.split('    owner?: UploadOwner,\n').length,3);restored=restored.replaceAll('    owner?: UploadOwner,\n','')
assert.equal(restored.split('}, owner)').length,6);restored=restored.replaceAll('}, owner)','})')
restored=restored.replace('    const currentSessionId = STUDIO_UPLOAD_OWNERSHIP ? owner?.sessionId : sessionIdRef.current','    const currentSessionId = sessionIdRef.current')
drop('      if (STUDIO_UPLOAD_OWNERSHIP) studio.requireLinkIdentity(owner)\n')
drop("    if (STUDIO_UPLOAD_OWNERSHIP && !studio.canAdmit(uploadAdmissionLifetime, userId)) throw new Error('Uploader is no longer active')\n")
drop('    const owner = STUDIO_UPLOAD_OWNERSHIP ? studio.ownerRef.current : undefined\n')
restored=restored.replace('    const currentSessionId = STUDIO_UPLOAD_OWNERSHIP ? owner?.sessionId : sessionIdRef.current','    const currentSessionId = sessionIdRef.current')
drop("    if (STUDIO_UPLOAD_OWNERSHIP) owner?.fileIds.add(fileId)\n    const setUploadFiles: typeof setFiles = next => {\n      if (!STUDIO_UPLOAD_OWNERSHIP || studio.isCurrent(owner, fileId)) setFiles(next)\n    }\n    const uploadToast = (options: Parameters<typeof toast>[0]) => {\n      if (!STUDIO_UPLOAD_OWNERSHIP || studio.isCurrent(owner, fileId)) toast(options)\n    }\n")
restored=restored.replaceAll('setUploadFiles(', 'setFiles(').replaceAll('uploadToast(', 'toast(')
restored=restored.replace('setFiles(prev => [...(STUDIO_UPLOAD_OWNERSHIP ? prev.filter(file => owner?.fileIds.has(file.id)) : prev), uploadedFile])','setFiles(prev => [...prev, uploadedFile])')
restored=restored.replace('await ensureResearcherSession(owner)','await ensureResearcherSession()')
drop('        owner,\n')
restored=restored.replace('        if (STUDIO_UPLOAD_OWNERSHIP) {\n          if (studio.isCurrent(owner, fileId)) studio.callbackRef.current?.([storedFile])\n        } else onUploadComplete?.([storedFile])','        onUploadComplete?.([storedFile])')
restored=restored.replace('pollIngestStatus(processResult.job_id, fileId, owner)','pollIngestStatus(processResult.job_id, fileId)')
drop('    if (STUDIO_UPLOAD_OWNERSHIP && !studio.canAdmit(uploadAdmissionLifetime, userId)) return\n')
drop('    const batchOwner = STUDIO_UPLOAD_OWNERSHIP ? studio.ownerRef.current : undefined\n    const priorIds = STUDIO_UPLOAD_OWNERSHIP ? new Set(batchOwner?.fileIds) : null\n')
restored=restored.replace('if (visibleFiles.length + selectedFiles.length > MAX_FILES)','if (files.length + selectedFiles.length > MAX_FILES)')
drop('    const batchIds = STUDIO_UPLOAD_OWNERSHIP ? Array.from(batchOwner?.fileIds ?? []).filter(id => !priorIds?.has(id)) : []\n')
drop('      if (STUDIO_UPLOAD_OWNERSHIP && (!studio.isCurrent(batchOwner) || batchIds.some(id => !batchOwner?.fileIds.has(id)))) return\n')
drop('    uploadAdmissionLifetime,\n')
restored=restored.replace('[visibleFiles.length, uploadFile, toast, uploadAdmissionLifetime]','[files.length, uploadFile, toast]')
drop('    if (STUDIO_UPLOAD_OWNERSHIP) studio.ownerRef.current.fileIds.delete(fileId)\n')
drop('    if (STUDIO_UPLOAD_OWNERSHIP) studio.ownerRef.current.fileIds.clear()\n')
restored=restored.replace('    files: visibleFiles,\n    handleFilesSelected,','    files,\n    handleFilesSelected,')
assert.equal(restored,original,'Known Studio additions reverse to the complete original hook byte-for-byte')
const plain=value=>JSON.parse(JSON.stringify(value)),compile=(value,fileName=file)=>{const out=ts.transpileModule(value,{fileName,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});assert.deepEqual((out.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);return out.outputText}
const pure=filename=>{const m={exports:{}};vm.runInNewContext(compile(fs.readFileSync(path.join(root,filename),'utf8'),filename),{module:m,exports:m.exports});return m.exports}
const validation=pure('lib/file-validation.ts'),status=pure('lib/upload-status.ts')
const response=(body={},status=200)=>({ok:status>=200&&status<300,status,statusText:status===200?'OK':'Refused',text:async()=>JSON.stringify(body)})
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve()}
const nativeFile=(name='source.pdf')=>({name,size:20,type:'application/pdf'})
let checks=1
function harness(options={}){
 const {code=witness?original:source,onRequest,processBody={status:'ready',readiness:{fully_ready:true,semantic_query_verified:true}}}=options
 const flag=Object.hasOwn(options,'flag')?options.flag:'true'
 const slots=[],effects=[],requests=[],adoptions=[],toasts=[],delays=[],states=[],timeouts=[],diagnostics=[];let cursor=0,serial=0,clock=1000,unmounted=false,lateWrites=0,props={sessionId:'session-A',userId:'user-A'}
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,next=>{if(unmounted)lateWrites++;slots[i].value=typeof next==='function'?next(slots[i].value):next;if(i===0)states.push(plain(slots[i].value))}]},useRef(initial){const i=cursor++;return slots[i]??={current:initial}},useCallback(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))slots[i]={deps,callback:fn};return slots[i].callback},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,setup:fn,cleanup:fn()}})}}
 const dependencies={react,'@/hooks/use-toast':{useToast:()=>({toast:value=>toasts.push(plain(value))})},'@/lib/file-validation':validation,'@/lib/config':{apiConfig:{knowledgeServiceUrl:'https://researcher.audit.invalid/'},uploadConfig:{maxFiles:5}},'@/lib/upload-status':status}
 const m={exports:{}};vm.runInNewContext(compile(code),{module:m,exports:m.exports,Error,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},Date:{now:()=>clock},Promise,crypto:{randomUUID:()=>`file-${++serial}`},AbortSignal:{timeout:ms=>{timeouts.push(ms);return{timeout:ms}}},console:{log(){},warn(){},error(...values){diagnostics.push(values.map(value=>value instanceof Error?value.message:String(value)).join(" "))}},setTimeout:(fn,ms)=>{delays.push(ms);clock+=ms;queueMicrotask(fn);return delays.length},clearTimeout(){},require:id=>{assert.ok(id in dependencies,`Unexpected dependency ${id}`);return dependencies[id]},fetch:(url,options={})=>{
  const body=typeof options.body==='string'?JSON.parse(options.body):options.body
  const stage=url.endsWith('/sessions/create')?'create':url.endsWith('/storage-upload-url')?'prepare':options.method==='PUT'?'put':url.startsWith('/api/sessions/')?'link':url.includes('/ingest-status/')?'poll':'process'
  const entry={url,stage,options:{...options},body};requests.push(entry)
  const supplied=onRequest?.(entry,requests);if(supplied!==undefined)return supplied instanceof Error?Promise.reject(supplied):Promise.resolve(supplied)
  return Promise.resolve(response(stage==='create'?{session_id:`researcher-${body.session_id}`}:stage==='prepare'?{signed_url:`https://storage.audit.invalid/${body.filename}`,storage_path:`${body.session_id}/${body.filename}`}:stage==='process'?processBody:stage==='poll'?{status:'ready',readiness:{fully_ready:true,semantic_query_verified:true}}:{}))
 }})
 const render=(next={})=>{cursor=0;Object.assign(props,next);const api=m.exports.useFileUpload({...props,onUploadComplete:files=>adoptions.push({active:props.sessionId,user:props.userId,files:plain(files)})});while(effects.length)effects.shift()();return api}
 return{render,requests,adoptions,toasts,delays,states,timeouts,diagnostics,props,unmount(){unmounted=true;for(const slot of slots)slot?.cleanup?.()},remount(){unmounted=false;for(const slot of slots)if(slot?.setup)slot.cleanup=slot.setup()},get lateWrites(){return lateWrites}}
}
const expectOwner=(actual,healthy,broken)=>assert.deepEqual(actual,witness?broken:healthy)
// Original single-owner pipeline, source strings/fields/options/status cadence.
{
 const h=harness();await h.render().handleFilesSelected([nativeFile()]);assert.deepEqual(h.requests.map(r=>r.stage),['create','prepare','put','link','process'])
 assert.deepEqual(plain(h.requests[0].body),{user_id:'user-A',session_id:'session-A',session_name:'Session_session-',metadata:{frontend_session_id:'session-A',upload_path:'direct_supabase'}})
 assert.deepEqual(plain(h.requests[1].body),{session_id:'researcher-session-A',filename:'source.pdf',content_type:'application/pdf'})
 assert.equal(h.requests[2].options.method,'PUT');assert.equal(h.requests[2].body.name,'source.pdf');assert.equal(h.requests[2].options.headers['Content-Type'],'application/pdf')
 assert.equal(h.requests[3].url,'/api/sessions/session-A/files');assert.deepEqual(plain(h.requests[3].body),{fileName:'source.pdf',fileSize:20,fileType:'application/pdf',geminiFileUri:'researcher-session-A/source.pdf',geminiFileName:'source.pdf',geminiStoreName:'researcher-session-A'})
 assert.deepEqual(plain(h.requests[4].body),{session_id:'researcher-session-A',storage_path:'researcher-session-A/source.pdf',original_filename:'source.pdf',content_type:'application/pdf',display_name:'source.pdf',respond_async:true})
 assert.equal(h.adoptions.length,1);assert.equal(h.adoptions[0].files[0].status,'stored');assert.equal(h.render().files[0].status,'success');assert.deepEqual(h.states.map(s=>s[0]?.uploadProgress),[0,10,25,65,100,100,100]);checks++
}
// Same-owner concurrent files share one pending Researcher session, retaining
// original per-file PUT/link/process callbacks and no invented batch protocol.
{
 const create=deferred(),h=harness({onRequest:r=>r.stage==='create'?create.promise:undefined});const pending=h.render().handleFilesSelected([nativeFile('first.pdf'),nativeFile('second.pdf')]);await settle();assert.equal(h.requests.length,1);create.resolve(response({session_id:'researcher-session-A'}));await pending;assert.equal(h.requests.filter(r=>r.stage==='create').length,1);for(const stage of['prepare','put','link','process'])assert.equal(h.requests.filter(r=>r.stage===stage).length,2);assert.equal(h.adoptions.length,2);assert.equal(h.render().files.length,2);checks++
}
// Deferred A can complete its original linkage, but not retarget to B/adopt
// into B; a late session-create cannot poison B's researcher cache.
for(const stage of['create','put','link','process']){
 let held=false;const wait=deferred(),h=harness({onRequest:r=>r.stage===stage&&!held?(held=true,wait.promise):undefined}),a=h.render().handleFilesSelected([nativeFile()]);await settle();h.render({sessionId:'session-B'});const beforeAdoptions=h.adoptions.length
 wait.resolve(response(stage==='create'?{session_id:'researcher-session-A'}:stage==='process'?{status:'ready'}:{}));await a
 assert.equal(h.requests.filter(r=>r.stage==='link').length,1);expectOwner(h.requests.find(r=>r.stage==='link').url,'/api/sessions/session-A/files',stage==='create'||stage==='put'?'/api/sessions/session-B/files':'/api/sessions/session-A/files')
 expectOwner(h.adoptions.length-beforeAdoptions,0,stage==='process'?0:1)
 if(!witness){assert.equal(h.render().files.length,0);assert.equal(h.toasts.length,0)}
 if(stage==='create'){await h.render().handleFilesSelected([nativeFile('B.pdf')]);expectOwner(h.requests.filter(r=>r.stage==='create').length,2,1);expectOwner(h.requests.filter(r=>r.stage==='prepare').at(-1).body.session_id,'researcher-session-B','researcher-session-A')}
 checks++
}
// New owner gets its own pending cache. Late A's finally must not clear B's
// promise; concurrent second B file must join B, not create another session.
{
 const aWait=deferred(),bWait=deferred(),h=harness({onRequest:r=>r.stage==='create'?(r.body.session_id==='session-A'?aWait.promise:bWait.promise):undefined});const a=h.render().handleFilesSelected([nativeFile('A.pdf')]);await settle();const b=h.render({sessionId:'session-B'}).handleFilesSelected([nativeFile('B.pdf')]);await settle();aWait.resolve(response({session_id:'researcher-session-A'}));await a;const b2=h.render().handleFilesSelected([nativeFile('B2.pdf')]);await settle();expectOwner(h.requests.filter(r=>r.stage==='create').length,2,2);bWait.resolve(response({session_id:'researcher-session-B'}));await Promise.all([b,b2]);expectOwner(h.requests.filter(r=>r.stage==='prepare'&&r.body.filename.startsWith('B')).map(r=>r.body.session_id).sort(),['researcher-session-B','researcher-session-B'],['researcher-session-A','researcher-session-B']);if(!witness)assert.equal(h.adoptions.filter(a=>a.active==='session-B').length,2);checks++
}
for(const target of['','session-A']){
 const wait=deferred(),h=harness({onRequest:r=>r.stage==='put'?wait.promise:undefined}),a=h.render().handleFilesSelected([nativeFile()]);await settle();h.render().clearAllFiles();h.render({sessionId:'session-B'});h.render({sessionId:target});wait.resolve(response());await a;expectOwner(h.requests.find(r=>r.stage==='link').url,'/api/sessions/session-A/files',target===''?'/api/sessions/session-B/files':'/api/sessions/session-A/files');expectOwner(h.adoptions.length,0,1);assert.equal(h.render().files.length,0);checks++
}
// Empty new-chat must not admit another file against retained old A identity.
{
 const h=harness();h.render();await h.render({sessionId:''}).handleFilesSelected([nativeFile()]);expectOwner(h.requests.length,0,5);checks++
}
{
 const wait=deferred(),h=harness({onRequest:r=>r.stage==='put'?wait.promise:undefined}),pending=h.render().handleFilesSelected([nativeFile()]);await settle();h.unmount();wait.resolve(response());await pending;expectOwner(h.requests.filter(r=>r.stage==='link').length,0,1);expectOwner(h.adoptions.length,0,1);if(!witness)assert.equal(h.lateWrites,0);checks++
}
// File removal/clear retires current UI intent without cancelling its already
// dispatched same-account transfer or deleting original-session linkage.
for(const all of[false,true]){
 const wait=deferred(),h=harness({onRequest:r=>r.stage==='put'?wait.promise:undefined}),pending=h.render().handleFilesSelected([nativeFile()]);await settle();const api=h.render();if(all)api.clearAllFiles();else api.removeFile(api.files[0].id);wait.resolve(response());await pending;assert.equal(h.requests.find(r=>r.stage==='link').url,'/api/sessions/session-A/files');assert.equal(h.render().files.length,0);expectOwner(h.adoptions.length,0,1);expectOwner(h.toasts.length,0,1);checks++
}
// Current identity is required before every authenticated link attempt. A new
// account or unmount cannot initiate linking/retries for the retired upload.
for(const close of[false,true]){
 const wait=deferred(),h=harness({onRequest:r=>r.stage==='put'?wait.promise:undefined}),pending=h.render().handleFilesSelected([nativeFile()]);await settle();if(close)h.unmount();else h.render({userId:'user-B'});wait.resolve(response());await pending;expectOwner(h.requests.filter(r=>r.stage==='link').length,0,1);if(!witness){assert.equal(h.requests.filter(r=>r.stage==='process').length,0);assert.ok(h.diagnostics.some(value=>value.includes('session link was not confirmed')));assert.equal(h.toasts.length,0)}checks++
}
for(const close of[false,true]){
 const wait=deferred(),h=harness({onRequest:(r,requests)=>r.stage==='link'&&requests.filter(r=>r.stage==='link').length===1?wait.promise:undefined}),pending=h.render().handleFilesSelected([nativeFile()]);await settle();if(close)h.unmount();else h.render({userId:'user-B'});wait.resolve(response({error:'First link refused'},503));await pending;expectOwner(h.requests.filter(r=>r.stage==='link').length,1,2);if(!witness){assert.equal(h.adoptions.length,0);assert.ok(h.diagnostics.some(value=>value.includes('session link was not confirmed')))}checks++
}
// Initial session creation can complete before an already-held file callback
// fires; upload admission snapshots the latest actual owner, not a render's
// earlier empty session. Same-owner files still share the native cache.
{
 const h=harness(),old=h.render({sessionId:''});h.render({sessionId:'fresh-session'});await old.handleFilesSelected([nativeFile()]);assert.equal(h.requests[0].body.session_id,'fresh-session');assert.equal(h.requests.find(r=>r.stage==='link').url,'/api/sessions/fresh-session/files');assert.equal(h.adoptions[0].active,'fresh-session');checks++
}
// A queued background job remains native, but late failure after removal or
// owner retirement cannot paint a chip or toast into the current composer.
for(const remove of[false,true]){
 const wait=deferred(),h=harness({processBody:{status:'processing',job_id:'stable-local-job'},onRequest:r=>r.stage==='poll'?wait.promise:undefined});await h.render().handleFilesSelected([nativeFile()]);await settle();const before=h.toasts.length;if(remove)h.render().removeFile(h.render().files[0].id);else h.render({sessionId:'session-B'});wait.resolve(response({error:'Full background refusal END'},400));await settle();expectOwner(h.toasts.length-before,0,1);if(!witness)assert.equal(h.render().files.length,0);checks++
}
// Old-target refusals must not report a failure into the new owner. They still
// return normally through the original batch allSettled handling.
for(const stage of['create','put','process']){
 const wait=deferred(),h=harness({onRequest:r=>r.stage===stage?wait.promise:undefined}),pending=h.render().handleFilesSelected([nativeFile()]);await settle();h.render({sessionId:'session-B'});wait.resolve(response({error:'Full stale A refusal END'},400));await pending
 expectOwner(h.toasts.length,0,2);if(!witness)assert.equal(h.render().files.length,0);assert.equal(h.adoptions.length,stage==='process'?1:0);checks++
}
// Native retry/error/enrichment behavior remains observable on a current owner.
for(const refusedStatus of[400,503]){
 let count=0;const h=harness({onRequest:r=>r.stage==='link'&&++count<(refusedStatus===400?99:3)?response({error:'Exact linkage refusal'},refusedStatus):undefined});await h.render().handleFilesSelected([nativeFile()]);assert.equal(count,refusedStatus===400?1:3);assert.deepEqual(h.delays,refusedStatus===400?[]:[500,1000]);assert.equal(h.render().files[0].status,refusedStatus===400?'error':'success');if(refusedStatus===400){assert.equal(h.adoptions.length,0);assert.ok(h.toasts.some(t=>t.description?.includes('Exact linkage refusal')))}checks++
}
{
 let count=0;const h=harness({onRequest:r=>r.stage==='link'?(count++,response({error:'Full persistent link refusal END'},503)):undefined});await h.render().handleFilesSelected([nativeFile()]);assert.equal(count,3);assert.deepEqual(h.delays,[500,1000]);assert.equal(h.adoptions.length,0);assert.equal(h.render().files[0].status,'error');assert.ok(h.toasts.some(t=>t.description?.includes('Full persistent link refusal END')));checks++
}
{
 const h=harness({onRequest:r=>r.stage==='process'?response({error:'Full enrichment refusal END'},503):undefined});await h.render().handleFilesSelected([nativeFile()]);assert.equal(h.adoptions[0].files[0].status,'stored');assert.equal(h.render().files[0].status,'degraded');assert.equal(h.render().files[0].errorMessage,'Full enrichment refusal END');assert.ok(h.toasts.some(t=>t.description?.includes('Full enrichment refusal END')));checks++
}
for(const processBody of[{status:'degraded',degraded_reason:'Exact partial enrichment'},{status:'ready',readiness:{semantic_query_verified:false}}]){const h=harness({processBody});await h.render().handleFilesSelected([nativeFile()]);assert.equal(h.render().files[0].status,'degraded');assert.equal(h.adoptions[0].files[0].status,'stored');checks++}
{
 let polls=0;const h=harness({processBody:{status:'processing',job_id:'stable-local-job'},onRequest:r=>r.stage==='poll'?response(++polls===1?{status:'processing',readiness:{text_extracted:true}}:{status:'ready',readiness:{semantic_query_verified:true}}):undefined});await h.render().handleFilesSelected([nativeFile()]);await settle();assert.equal(polls,2);assert.deepEqual(h.delays,[2000,5000]);assert.deepEqual(h.timeouts,[10000,10000]);assert.equal(h.render().files[0].status,'success');assert.ok(h.states.some(s=>s[0]?.uploadProgress===75));assert.equal(h.adoptions.length,1);checks++
}
for(const bad of[{...nativeFile(),size:0},{...nativeFile(),size:100*1024*1024+1}]){const h=harness();await h.render().handleFilesSelected([bad]);assert.equal(h.requests.length,0);assert.equal(h.toasts[0].title,'Invalid files');checks++}
{const h=harness();await h.render().handleFilesSelected(Array.from({length:6},(_,i)=>nativeFile(`${i}.pdf`)));assert.equal(h.requests.length,0);assert.equal(h.toasts[0].title,'Too many files');checks++}
// Nonliteral Studio flags keep complete classic callback/request/state behavior.
for(const flag of[undefined,'false','TRUE','1'])for(const changed of[false,true]){
 const wait=deferred(),options={flag,onRequest:r=>r.stage==='put'?wait.promise:undefined};const current=harness(options),prior=harness({...options,code:original});const a=current.render().handleFilesSelected([nativeFile()]),b=prior.render().handleFilesSelected([nativeFile()]);await settle();if(changed){current.render({sessionId:'session-B'});prior.render({sessionId:'session-B'})}wait.resolve(response());await Promise.all([a,b]);assert.deepEqual(plain(current.requests),plain(prior.requests));assert.deepEqual(current.adoptions,prior.adoptions);assert.deepEqual(current.toasts,prior.toasts);assert.deepEqual(plain(current.render().files),plain(prior.render().files));checks++
}
// Permanent generation fence: a captured callback cannot admit work after
// cleanup, including native Drop's real await-onRequestSession continuation.
if(!witness){
 for(const code of[priorLifetime,source]){
  const h=harness({code}),api=h.render();h.unmount();await api.handleFilesSelected([nativeFile()]);await settle();assert.deepEqual(h.requests.map(r=>r.stage),code===source?[]:['create','prepare','put']);assert.equal(h.lateWrites,0);assert.equal(h.toasts.length,0);checks++
 }
 const inputSource=fs.readFileSync(path.join(root,'components/builder/chat-input.tsx'),'utf8'),inputAst=ts.createSourceFile('chat-input.tsx',inputSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),drops=[]
 function findDrop(node){if(ts.isJsxAttribute(node)&&node.name.getText(inputAst)==='onDrop')drops.push(node.initializer.expression.getText(inputAst));ts.forEachChild(node,findDrop)}findDrop(inputAst);assert.equal(drops.length,1)
 const dropFor=(handler,session)=>{const m={exports:{}};vm.runInNewContext(compile('exports.drop = '+drops[0]),{module:m,exports:m.exports,features:{enableFileUploads:true},setIsDraggingFiles(){},onRequestSession:()=>session.promise,onFilesSelected:handler,Array,console:{error(){}}});return m.exports.drop}
 for(const code of[priorLifetime,source]){
  const session=deferred(),h=harness({code}),api=h.render();dropFor(api.handleFilesSelected,session)({preventDefault(){},dataTransfer:{files:[nativeFile()]}});h.unmount();session.resolve();await settle();assert.deepEqual(h.requests.map(r=>r.stage),code===source?[]:['create','prepare','put']);checks++
 }
 // A queued Drop's rendered account identity cannot be repurposed as B,
 // even when the hook stays mounted; B's fresh callback remains usable.
 for(const code of[priorLifetime,source]){
  const session=deferred(),h=harness({code}),api=h.render();dropFor(api.handleFilesSelected,session)({preventDefault(){},dataTransfer:{files:[nativeFile()]}});const fresh=h.render({userId:'user-B'});session.resolve();await settle();assert.equal(h.requests.length,code===source?0:5);if(code===source){assert.equal(h.toasts.length,0);assert.equal(h.render().files.length,0);await fresh.handleFilesSelected([nativeFile('B.pdf')]);assert.equal(h.requests[0].body.user_id,'user-B');assert.equal(h.adoptions.length,1)}checks++
 }
 // Account A→B→A before a queued admission again has the originally captured
 // current account, but no old transfer/cache/result is revived by that fact.
 {
  const session=deferred(),h=harness(),api=h.render();dropFor(api.handleFilesSelected,session)({preventDefault(){},dataTransfer:{files:[nativeFile()]}});h.render({userId:'user-B'});h.render({userId:'user-A'});session.resolve();await settle();assert.equal(h.requests[0].body.user_id,'user-A');assert.equal(h.adoptions.length,1);checks++
 }
 // Held initial-empty callback still works when its own live session request
 // resolves, without freezing that empty target or requiring another action.
 {
  const session=deferred(),h=harness(),api=h.render({sessionId:''});dropFor(api.handleFilesSelected,session)({preventDefault(){},dataTransfer:{files:[nativeFile()]}});h.render({sessionId:'initial-created'});session.resolve();await settle();assert.equal(h.requests[0].body.session_id,'initial-created');assert.equal(h.requests.find(r=>r.stage==='link').url,'/api/sessions/initial-created/files');assert.equal(h.adoptions.length,1);checks++
 }
 // Cleanup→setup of retained refs is a NEW lifetime. Old PUT cannot regain
 // authenticated linking, adoption, cache or toast; a fresh callback works.
 for(const stage of['create','put','link','process']){
  for(const code of[priorLifetime,source]){
   let held=false;const wait=deferred(),h=harness({code,onRequest:r=>r.stage===stage&&!held?(held=true,wait.promise):undefined}),api=h.render(),pending=api.handleFilesSelected([nativeFile()]);await settle();const priorAdoptions=h.adoptions.length,priorLinks=h.requests.filter(r=>r.stage==='link').length;h.unmount();h.remount();const fresh=h.render();wait.resolve(response(stage==='create'?{session_id:'researcher-session-A'}:stage==='process'?{status:'ready'}:{}));await pending
   if(code===source){assert.equal(h.requests.filter(r=>r.stage==='link').length,priorLinks);assert.equal(h.adoptions.length,priorAdoptions);assert.equal(h.toasts.length,0);assert.equal(h.render().files.length,0);await api.handleFilesSelected([nativeFile('retired.pdf')]);assert.equal(h.requests.filter(r=>r.stage==='prepare'&&r.body.filename==='retired.pdf').length,0);await fresh.handleFilesSelected([nativeFile('fresh.pdf')]);assert.equal(h.requests.filter(r=>r.stage==='create').length,2);assert.equal(h.adoptions.at(-1).files[0].name,'fresh.pdf')}
   else {assert.equal(h.requests.filter(r=>r.stage==='link').length,1);assert.equal(h.adoptions.length,1);assert.ok(h.toasts.length>0)}checks++
  }
 }
 // Background polling/UI callbacks also retain their originating lifetime.
 {
  const wait=deferred(),h=harness({processBody:{status:'processing',job_id:'stable-local-job'},onRequest:r=>r.stage==='poll'?wait.promise:undefined});await h.render().handleFilesSelected([nativeFile()]);await settle();h.unmount();h.remount();h.render();const priorToasts=h.toasts.length;wait.resolve(response({error:'Retired lifetime background reason END'},400));await settle();assert.equal(h.toasts.length,priorToasts);assert.equal(h.render().files.length,0);checks++
 }
 // Classic teardown/re-setup preserves original callback/request behavior.
 for(const flag of[undefined,'false','TRUE','1']){
  const current=harness({flag}),prior=harness({flag,code:original}),a=current.render(),b=prior.render();current.unmount();prior.unmount();current.remount();prior.remount();await a.handleFilesSelected([nativeFile()]);await b.handleFilesSelected([nativeFile()]);assert.deepEqual(plain(current.requests),plain(prior.requests));assert.deepEqual(current.adoptions,prior.adoptions);assert.deepEqual(current.toasts,prior.toasts);checks++
 }
}
// Focused actual-source semantic check resolves only the existing task client;
// no full build, dependency install or generated schema/client changes.
const configFile=path.join(root,'.env.studio-v4-runtime/tsconfig.json'),loaded=ts.readConfigFile(configFile,ts.sys.readFile),parsed=ts.parseJsonConfigFileContent(loaded.config,ts.sys,path.dirname(configFile))
const program=ts.createProgram([path.join(root,file)],{...parsed.options,incremental:false,noEmit:true});assert.deepEqual(ts.getPreEmitDiagnostics(program).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);checks++
console.log(`Upload ownership: ${checks} actual-hook local checks pass (${witness?'BASELINE SOURCE DEFECT WITNESSES; not correction proof':'REGRESSION EXPECTATIONS'}). No service, account, browser, storage or connected persistence ACK.`)
