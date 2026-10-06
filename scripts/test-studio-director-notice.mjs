import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'

const root=path.resolve(new URL('..',import.meta.url).pathname),require=createRequire(import.meta.url)
// Inert host only: actual installed ReactDOM owns render/reconciliation.
// No browser layout, CSS pixels, socket, backend or synthetic hook model.
class HostTarget {
  listeners=new Map()
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn)}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn)}
}
class HostNode extends HostTarget {
  constructor(type,name,doc){super();this.nodeType=type;this.nodeName=name;this.tagName=type===1?name:undefined;this.ownerDocument=doc;this.parentNode=null;this.childNodes=[];this.attributes=new Map();this.namespaceURI='http://www.w3.org/1999/xhtml';this.style={setProperty(){},removeProperty(){}}}
  appendChild(node){return this.insertBefore(node,null)}
  insertBefore(node,before){node.parentNode?.removeChild(node);const index=before===null?this.childNodes.length:this.childNodes.indexOf(before);assert.ok(index>=0);this.childNodes.splice(index,0,node);node.parentNode=this;return node}
  removeChild(node){const index=this.childNodes.indexOf(node);assert.ok(index>=0);this.childNodes.splice(index,1);node.parentNode=null;return node}
  setAttribute(name,value){this.attributes.set(name,String(value))}
  removeAttribute(name){this.attributes.delete(name)}
  getAttribute(name){return this.attributes.get(name)??null}
  get firstChild(){return this.childNodes[0]??null}
  get lastChild(){return this.childNodes.at(-1)??null}
  get nextSibling(){return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this)+1]??null}
  get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(node=>node.textContent).join('')}
  set textContent(value){for(const node of this.childNodes)node.parentNode=null;this.childNodes=[];if(value)this.appendChild(this.ownerDocument.createTextNode(String(value)))}
  contains(node){return this===node||this.childNodes.some(child=>child.contains(node))}
}
const documentHost=new HostTarget()
Object.assign(documentHost,{nodeType:9,nodeName:'#document',createElement:name=>new HostNode(1,name.toUpperCase(),documentHost),createElementNS:(_ns,name)=>new HostNode(1,name.toUpperCase(),documentHost),createTextNode:value=>Object.assign(new HostNode(3,'#text',documentHost),{nodeValue:value})})
documentHost.documentElement=documentHost.createElement('html');documentHost.body=documentHost.createElement('body');documentHost.documentElement.appendChild(documentHost.body);documentHost.activeElement=documentHost.body
const windowHost=new HostTarget();Object.assign(windowHost,{document:documentHost,HTMLElement:HostNode,HTMLIFrameElement:class{},Node:HostNode});documentHost.defaultView=windowHost
Object.assign(globalThis,{window:windowHost,document:documentHost,HTMLElement:HostNode,Node:HostNode,IS_REACT_ACT_ENVIRONMENT:true})
const{createRoot}=await import('react-dom/client')
const file='components/builder/studio-director-notice.tsx',source=fs.readFileSync(path.join(root,file),'utf8'),hash=source=>crypto.createHash('sha256').update(source).digest('hex')
const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const imports=tree.statements.filter(ts.isImportDeclaration);assert.equal(imports.length,1);assert.equal(imports[0].importClause.isTypeOnly,true,'Hook dependency must be erased from runtime')
const compiled=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}})
assert.equal(compiled.diagnostics?.filter(item=>item.category===ts.DiagnosticCategory.Error).length??0,0)
const module={exports:{}},forbidden=()=>{throw Error('Director notice witness refuses side effects')},runtimeImports=[]
vm.runInNewContext(compiled.outputText,{module,exports:module.exports,require:spec=>{runtimeImports.push(spec);assert.equal(spec,'react/jsx-runtime');return require(spec)},fetch:forbidden,WebSocket:forbidden,setTimeout:forbidden,setInterval:forbidden,window:{location:{assign:forbidden}},console},{filename:file})
const{StudioDirectorNotice}=module.exports
const container=documentHost.createElement('div');documentHost.body.appendChild(container);const renderRoot=createRoot(container)
const durableText='Retained durable chat — unchanged by transport metadata.'
const collect=(node,predicate,result=[])=>{if(predicate(node))result.push(node);for(const child of node.childNodes)collect(child,predicate,result);return result}
const attr=(name,value)=>collect(container,node=>node.getAttribute?.(name)===value)
const part=name=>attr('data-studio-director-notice-part',name)
const notice=(type,extra={})=>({type,sessionId:'synthetic-private-session',message:'Synthetic transport reason',requiresResend:false,...extra})
const handoff=(status,extra={})=>({status,sessionId:'synthetic-private-session',idempotencyKey:'synthetic-private-idempotency',...extra})
const observations=[]
async function render(name,props,check){
 await React.act(async()=>renderRoot.render(React.createElement('div',{'data-studio-v4-shell':'true',className:props.dark?'dark':'',style:{width:props.narrow?'320px':'1024px'}},React.createElement('p',{'data-fixture-durable-chat':'true'},durableText),React.createElement(StudioDirectorNotice,props))))
 assert.equal(attr('data-fixture-durable-chat','true')[0].textContent,durableText)
 assert.equal(collect(container,node=>['BUTTON','INPUT','FORM','A','IFRAME','SCRIPT','IMG'].includes(node.tagName)).length,0,'Metadata cannot introduce resend/retry/native/gate controls or interpret reason HTML')
 assert.ok(!container.textContent.includes('synthetic-private-'),'Session/idempotency/expiry metadata must not appear in product copy')
 for(const node of collect(container,node=>node.getAttribute?.('role')==='alert'||node.getAttribute?.('role')==='status')){assert.equal(node.getAttribute('aria-atomic'),'true');assert.equal(node.style.overflowWrap,'anywhere');assert.equal(node.style.whiteSpace,'pre-wrap');assert.equal(node.style.maxWidth,'100%');assert.ok(node.style.background.includes('var(--ss-panel'),'Dark/light must inherit current Studio palette')}
 check()
 observations.push({name,text:container.textContent,roles:collect(container,node=>node.getAttribute?.('role')).map(node=>({role:node.getAttribute('role'),text:node.textContent})),reasonText:part('message').map(node=>node.textContent),detailText:part('detail').map(node=>node.textContent),theme:props.dark?'dark-parent':'light-parent',hostWidth:props.narrow?320:1024,wrapContract:'actualDOM styles anywhere/pre-wrap/maxWidth100%; no browser pixel claim'})
}
await render('empty_metadata_mounts_no_notice',{},()=>assert.equal(attr('data-studio-director-notice','true').length,0))
await render('explicit_null_metadata_mounts_no_notice',{notice:null,handoffStatus:null},()=>assert.equal(attr('data-studio-director-notice','true').length,0))
await render('auth_expired_exact_reason_and_manual_resend',{notice:notice('auth_expired',{requiresResend:true,message:'Your token expired',discardedMessageType:'user_message'})},()=>{assert.equal(attr('role','alert').length,1);assert.ok(container.textContent.includes('Your last input was discarded'));assert.ok(container.textContent.includes('resend it yourself'));assert.equal(part('message')[0].textContent,'Your token expired')})
await render('auth_expired_requires_manual_resend_even_inconsistent_flag',{notice:notice('auth_expired')},()=>assert.equal(part('resend-guidance').length,1))
await render('auth_refresh_failed_conservative_reason',{notice:notice('auth_refresh_failed',{message:'Refresh token rejected',code:'AUTH_REFRESH_FAILED'})},()=>{assert.equal(attr('role','alert').length,1);assert.equal(part('resend-guidance').length,0);assert.ok(!container.textContent.includes('discarded'));assert.equal(part('message')[0].textContent,'Refresh token rejected')})
await render('structured_error_preserves_detail_without_invented_auth_cause',{notice:notice('error',{message:'Unsupported action',detail:'The server did not recognize this request.'})},()=>{assert.equal(attr('role','alert').length,1);assert.equal(part('detail')[0].textContent,'The server did not recognize this request.');assert.ok(!container.textContent.includes('expired'))})
await render('auth_refreshed_quiet_status_no_unnecessary_resend',{notice:notice('auth_refreshed',{message:'Secure connection refreshed.',expiresAt:1_800_000_000})},()=>{assert.equal(attr('role','status').length,1);assert.equal(attr('role','alert').length,0);assert.equal(part('resend-guidance').length,0);assert.ok(!container.textContent.includes('1800000000'))})
await render('auth_refreshed_preserves_sticky_discarded_input_resend_requirement',{notice:notice('auth_refreshed',{requiresResend:true,message:'Secure connection refreshed. Please resend your last action.'})},()=>{assert.equal(part('resend-guidance').length,1);assert.ok(container.textContent.includes('Your earlier input was discarded'));assert.equal(attr('role','status').length,1)})
await render('auth_refreshed_empty_reason_has_quiet_fallback',{notice:notice('auth_refreshed',{message:'   '})},()=>assert.ok(container.textContent.includes('Secure connection refreshed.')))
for(const status of['processing','already_processing','already_completed','failed'])await render(`handoff_${status}_exact_metadata_only`,{handoffStatus:handoff(status)},()=>{assert.equal(attr('data-studio-director-handoff-status',status).length,1);assert.equal(attr('role',status==='failed'?'alert':'status').length,1);assert.ok(!/your deck is ready|presentation complete|saved successfully/i.test(container.textContent));if(status==='already_completed')assert.ok(container.textContent.includes('The canvas reports deck readiness separately.'))})
const rawReason='  Unsafe-looking text <script>alert("x")</script> & <img src=x onerror=x>\nSecond line 💡  '
await render('raw_message_and_detail_are_exact_inert_text',{notice:notice('error',{message:rawReason,detail:rawReason})},()=>{assert.equal(part('message')[0].textContent,rawReason);assert.equal(part('detail')[0].textContent,rawReason)})
await render('handoff_failed_raw_reason_exact_inert_text',{handoffStatus:handoff('failed',{error:rawReason})},()=>assert.equal(part('handoff-error')[0].textContent,rawReason))
await render('mixed_transport_alert_and_processing_status_separate_slots',{notice:notice('auth_expired',{requiresResend:true}),handoffStatus:handoff('processing')},()=>{assert.equal(attr('role','alert').length,1);assert.equal(attr('role','status').length,1);assert.equal(attr('data-studio-director-handoff-status','processing').length,1)})
await render('mixed_quiet_refresh_and_completed_receipt_no_native_completion',{notice:notice('auth_refreshed',{message:'Secure connection refreshed.'}),handoffStatus:handoff('already_completed')},()=>{assert.equal(attr('role','status').length,2);assert.ok(container.textContent.includes('canvas reports deck readiness separately'))})
for(const dark of[false,true])await render(`long_unbroken_reason_${dark?'dark':'light'}_narrow_wrap_contract`,{dark,narrow:true,notice:notice('error',{message:'SyntheticReason'.repeat(150),detail:'line1\nline2\n'+rawReason}),handoffStatus:handoff('failed',{error:'SyntheticHandoffReason'.repeat(100)})},()=>{assert.equal(part('message')[0].textContent,'SyntheticReason'.repeat(150));assert.equal(part('detail')[0].style.overflowWrap,'anywhere')})
await render('clearing_metadata_removes_old_alert_and_retains_durable_chat',{notice:null,handoffStatus:null},()=>{assert.equal(attr('role','alert').length,0);assert.equal(attr('data-studio-director-notice','true').length,0)})
await React.act(async()=>renderRoot.unmount());documentHost.body.removeChild(container)
const out=path.join(root,'docs/studio-v4/eight-hour-parity-20261005/builder1/director-notice/evidence');fs.mkdirSync(out,{recursive:true})
const hookFile='hooks/use-deckster-websocket-v2.ts',hookSource=fs.readFileSync(path.join(root,hookFile),'utf8')
const receipt={timestamp:new Date().toISOString(),level:'Complete actual new component mounted/updated/unmounted with installed ReactDOM in an inert synthetic DOM. No browser layout/pixels, native viewer, services, real socket, ownership filter or durable-chat integration claim.',runtime:{node:process.version,react:React.version,reactDOM:require('react-dom/package.json').version},observations,runtimeImports,
 sourceHashes:{[file]:hash(source),[hookFile]:hash(hookSource)},scriptSha256:hash(fs.readFileSync(new URL(import.meta.url))),noSideEffects:true,remaining:'Root filters current owner and wires the page; current notice type hash only binds interfaces, hook was not imported at runtime. Browser narrow/dark pixels and connected notice/gate behavior unverified.'}
fs.writeFileSync(path.join(out,'actual-reactdom-receipt.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(`Director notice: ${observations.length} actual ReactDOM mount/update/empty/mixed/raw-reason/wrapping/no-control cases pass; no service/browser claims`)
