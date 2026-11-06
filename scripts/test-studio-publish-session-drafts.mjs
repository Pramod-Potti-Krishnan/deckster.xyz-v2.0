// Actual leaf/state/callback harness, supplied local responses only. No browser,
// parent runtime, auth, API, iframe, provider, database or successful write proof.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
const root=fileURLToPath(new URL('../',import.meta.url)),file='components/publish-session-controls.tsx',baseline='7d09e53'
const source=fs.readFileSync(path.join(root,file),'utf8'),original=execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8'})
const canonical=text=>ts.createPrinter().printFile(ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX))
let restored=source
  .replace("import { useCallback, useEffect, useRef, useState } from 'react'","import { useCallback, useState } from 'react'")
const start=restored.indexOf('// Studio draft reconciliation is local only.'),end=restored.indexOf('// End Studio draft reconciliation.\n\n')
assert.ok(start>=0&&end>start)
restored=restored.slice(0,start)+restored.slice(end+'// End Studio draft reconciliation.\n\n'.length)
restored=restored
  .replace('  const studioDrafts = useStudioSessionDrafts(record, onRecordChange, toast)\n  const activeSaving = STUDIO_SESSION_DRAFTS ? studioDrafts.saving : saving\n  const busy = disabled || activeSaving !== null','  const busy = disabled || saving !== null')
  .replace('      if (STUDIO_SESSION_DRAFTS) return studioDrafts.patch(field, body)\n','')
  .replace('[record.slug, onRecordChange, toast, studioDrafts.patch]','[record.slug, onRecordChange, toast]')
  .replaceAll('&& activeSaving &&','&& saving &&').replaceAll("activeSaving?.startsWith('narration')","saving?.startsWith('narration')")
for(const [key,id]of[['narrationBudgetMinutes','publish-budget'],['qaReserveMinutes','publish-qa-reserve']]){
 const block=`                {...(STUDIO_SESSION_DRAFTS ? {\n                  value: studioDrafts.drafts.values.${key},\n                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => studioDrafts.change('${key}', e.target.value),\n                  'aria-describedby': studioDrafts.drafts.dirty.${key} ? '${id}-unsaved' : undefined,\n                } : { defaultValue: record.${key} ?? '' })}`
 assert.equal(restored.split(block).length,2)
 restored=restored.replace(block,`                defaultValue={record.${key} ?? ''}`)
 const noop=` else if (STUDIO_SESSION_DRAFTS) {\n                    studioDrafts.reconcileNoop('${key}')\n                  }`
 assert.equal(restored.split(noop).length,2);restored=restored.replace(noop,'')
 const notice=`              {STUDIO_SESSION_DRAFTS && <MinuteDraftNotice id="${id}-unsaved" drafts={studioDrafts.drafts} field="${key}" saved={record.${key}} />}\n`
 assert.equal(restored.split(notice).length,2);restored=restored.replace(notice,'')
}
assert.equal(restored,original,'Whole leaf reverses byte-exact outside only explicit Studio additions; original handlers/gates/null/noop/payloads/classes unchanged')
assert.equal(canonical(restored),canonical(original))
const reviewed=execFileSync('git',['show',`4644c59:${file}`],{cwd:root,encoding:'utf8'})
const numericToast="      callbacksRef.current.toast({ title: key ? 'Session settings not saved' : message, variant: 'destructive' })"
assert.equal(source.split(numericToast).length,2)
assert.equal(source.replace(numericToast,"      callbacksRef.current.toast({ title: message, variant: 'destructive' })"),reviewed,'Only the Studio numeric toast title differs from the reviewed leaf; full notice/payload/receipt/ownership/switch/classic source stays exact')
let checks=3
const compile=(text,fileName=file)=>{
 const result=ts.transpileModule(text,{fileName,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}})
 assert.deepEqual((result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);return result.outputText
}
const jsx=(type,props)=>({type,props:props||{}})
const flatten=tree=>Array.isArray(tree)?tree.flatMap(flatten):!tree||typeof tree!=='object'?[]:[tree,...flatten(tree.props?.children)]
const materialize=tree=>Array.isArray(tree)?tree.map(materialize):!tree||typeof tree!=='object'?tree:typeof tree.type==='function'?materialize(tree.type(tree.props)):{...tree,props:{...tree.props,children:materialize(tree.props.children)}}
const find=(tree,predicate)=>{const result=flatten(materialize(tree)).filter(predicate);assert.equal(result.length,1);return result[0]}
const input=(tree,id)=>find(tree,n=>n.type==='Input'&&n.props.id===id)
const notice=(tree,key)=>flatten(materialize(tree)).find(n=>n.props?.['data-studio-session-unsaved']===key)
const text=tree=>Array.isArray(tree)?tree.map(text).join(''):typeof tree==='string'||typeof tree==='number'?String(tree):tree&&typeof tree==='object'?text(tree.props?.children):''
const snapshot=tree=>JSON.stringify(materialize(tree),(key,value)=>key==='children'&&Array.isArray(value)?value.filter(child=>child!==false&&child!==null&&child!==undefined):typeof value==='function'?'callback':value)
const pure={exports:{}}
vm.runInNewContext(compile(fs.readFileSync(path.join(root,'lib/narration/budget.ts'),'utf8'),'budget.ts'),{module:pure,exports:pure.exports})
const record=(slug='deck-a',values={})=>({slug,qaEnabled:true,qaAutoAnswer:false,narrationEnabled:true,narrationBudgetMinutes:8,qaReserveMinutes:2,...values})
const response=(deck,ok=true,error)=>({ok,json:async()=>({deck,error})})
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
function harness(options={}){
 const {prior=false,disabled=false,deck=record(),result=response(record()),sourceOverride}=options
 const flag=Object.hasOwn(options,'flag')?options.flag:'true'
 const slots=[],effects=[],requests=[],adoptions=[],toasts=[];let cursor=0,writes=0,nextResult=result,props={record:deck,disabled,onRecordChange:next=>{adoptions.push(next);props.record=next}}
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,value=>{writes++;slots[i].value=typeof value==='function'?value(slots[i].value):value}]},useRef(initial){const i=cursor++;return slots[i]??= {current:initial}},useCallback:fn=>fn,useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>d!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()}})}}
 const module={exports:{}}
 vm.runInNewContext(compile(sourceOverride??(prior?original:source)),{module,exports:module.exports,Error,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},fetch:(url,options)=>{requests.push({url,options:{...options,headers:{...options.headers}},body:JSON.parse(options.body)});return nextResult instanceof Error?Promise.reject(nextResult):Promise.resolve(nextResult)},require:name=>{
  if(name==='react')return react
  if(name==='react/jsx-runtime')return{jsx,jsxs:jsx}
  if(name==='@/hooks/use-toast')return{useToast:()=>({toast:entry=>toasts.push(JSON.parse(JSON.stringify(entry)))})}
  if(name==='@/lib/narration/budget')return pure.exports
  if(name==='lucide-react'||name.startsWith('@/components/ui/'))return new Proxy({},{get:(_t,key)=>key})
  throw new Error(`Offline leaf test refuses dependency ${name}`)
 }})
 const render=(changes={})=>{cursor=0;Object.assign(props,changes);const tree=module.exports.PublishSessionControls(props);while(effects.length)effects.shift()();return tree}
 return{render,requests,adoptions,toasts,props,setResult(value){nextResult=value},unmount(){for(const slot of slots)slot?.cleanup?.()},get writes(){return writes}}
}
function enter(h,id,value){input(h.render(),id).props.onChange({target:{value}});return input(h.render(),id)}
function blur(h,id,value){input(h.render(),id).props.onBlur({target:{value}})}
const fields=[['publish-budget','narrationBudgetMinutes',1],['publish-qa-reserve','qaReserveMinutes',0]]
for(const flag of [undefined,'false','TRUE','1'])for(const config of[{},{disabled:true},{deck:record('deck-a',{qaEnabled:false,narrationEnabled:false})},{deck:record('deck-a',{narrationBudgetMinutes:null,qaReserveMinutes:null})}]){
 const current=harness({...config,flag}),before=harness({...config,flag,prior:true});assert.equal(snapshot(current.render()),snapshot(before.render()));checks++
}
for(const [id,key,min]of fields){
 const h=harness();const initial=input(h.render(),id);assert.equal(initial.props.value,String(h.props.record[key]));assert.equal(initial.props.defaultValue,undefined);assert.equal(initial.props.min,min);assert.equal(initial.props.max,480)
 for(const raw of ['NaN',String(h.props.record[key]),'  '+String(h.props.record[key])+'  ']){enter(h,id,raw);blur(h,id,raw);await settle();assert.equal(h.requests.length,0);if(raw!=='NaN')assert.equal(notice(h.render(),key),undefined)}
 const canonical=record('deck-a',{[key]:10});h.setResult(response(canonical));enter(h,id,'10.9');blur(h,id,'10.9');await settle()
 assert.deepEqual(h.requests[0].body,{[key]:10.9});assert.equal(h.requests[0].url,'/api/publish/deck-a');assert.equal(h.requests[0].options.method,'PATCH');assert.equal(h.requests[0].options.headers['Content-Type'],'application/json');assert.equal(input(h.render(),id).props.value,'10');assert.equal(notice(h.render(),key),undefined);assert.equal(h.adoptions[0],canonical);checks++
 for(const raw of ['', '  ', '0', '999']){
  const h=harness({result:response(record('deck-a',{[key]:raw.trim()===''?null:raw==='0'?min:480}))});enter(h,id,raw);blur(h,id,raw);await settle();assert.deepEqual(h.requests[0].body,{[key]:raw.trim()===''?null:Number(raw)});assert.equal(input(h.render(),id).props.value,raw.trim()===''?'':String(raw==='0'?min:480));checks++
 }
 for(const result of [response(undefined,false,'Native refusal\ncomplete reason END'),new Error('Native transport exception'),response(undefined),response(record('other-deck')),response(record('deck-a',{[key]:undefined})),{ok:true,json:async()=>{throw new Error('Invalid JSON')}}]){
  const h=harness({result});enter(h,id,'17.8');blur(h,id,'17.8');await settle();const tree=h.render();assert.equal(h.adoptions.length,0);assert.equal(h.toasts.length,1);assert.equal(input(tree,id).props.value,'17.8');assert.equal(input(tree,id).props.disabled,false);assert.equal(input(tree,id).props['aria-invalid'],undefined);const error=notice(tree,key);assert.equal(error.props.role,'alert');assert.equal(error.props.tabIndex,0);assert.equal(error.props.id,input(tree,id).props['aria-describedby']);assert.match(text(error),/Not saved/);assert.match(text(error),new RegExp(`Saved value: ${h.props.record[key]} minutes`));if(result?.json&&result.ok===false)assert.ok(text(error).includes('Native refusal\ncomplete reason END'));checks++
 }
 const pending=deferred(),hPending=harness({result:pending.promise});enter(hPending,id,'11');blur(hPending,id,'11');const busy=hPending.render();for(const[id2]of fields)assert.equal(input(busy,id2).props.disabled,true);for(const switchNode of flatten(materialize(busy)).filter(n=>n.type==='Switch'))assert.equal(switchNode.props.disabled,true);assert.equal(hPending.adoptions.length,0);pending.resolve(response(record('deck-a',{[key]:11})));await settle();assert.equal(input(hPending.render(),id).props.value,'11');checks++
}
// A long numeric refusal belongs in the complete inline notice, while the
// ordinary destructive toast remains short and cannot repeat that diagnostic.
const completeReason=Array.from({length:60},(_,i)=>`Diagnostic line ${i+1}: retained source detail.`).join('\n')+'\nCOMPLETE REASON END'
for(const [id,key]of fields)for(const thrown of[false,true]){
 const h=harness({result:thrown?new Error(completeReason):response(undefined,false,completeReason)});enter(h,id,'17.8');blur(h,id,'17.8');await settle();const tree=h.render(),inline=text(notice(tree,key))
 assert.deepEqual(h.toasts,[{title:'Session settings not saved',variant:'destructive'}]);assert.ok(inline.includes(completeReason));assert.ok(inline.includes('Your entry is kept. Leave this field again to retry.'));assert.ok(inline.includes(`Saved value: ${h.props.record[key]} minutes.`));assert.equal(input(tree,id).props.value,'17.8');assert.equal(h.adoptions.length,0);checks++
}
for(const flag of[undefined,'false','TRUE','1'])for(const [id]of fields){const current=harness({flag,result:response(undefined,false,completeReason)}),prior=harness({flag,prior:true,result:response(undefined,false,completeReason)});blur(current,id,'17.8');blur(prior,id,'17.8');await settle();assert.deepEqual(current.toasts,prior.toasts);assert.deepEqual(current.toasts,[{title:completeReason,variant:'destructive'}]);assert.deepEqual(current.requests,prior.requests);assert.equal(snapshot(current.render()),snapshot(prior.render()));checks++}
// The native blur action retries retained intent without a new action/control.
for(const [id,key]of fields){const h=harness({result:response(undefined,false,'Temporary refusal')});enter(h,id,'17.8');blur(h,id,'17.8');await settle();assert.equal(input(h.render(),id).props.value,'17.8');assert.match(text(notice(h.render(),key)),/entry is kept/);h.setResult(response(record('deck-a',{[key]:17})));blur(h,id,'17.8');await settle();assert.equal(h.requests.length,2);assert.deepEqual(h.requests[1].body,{[key]:17.8});assert.equal(input(h.render(),id).props.value,'17');assert.equal(notice(h.render(),key),undefined);checks++}
const disabled=harness({disabled:true});for(const[id]of fields)assert.equal(input(disabled.render(),id).props.disabled,true);assert.equal(disabled.requests.length,0);checks++
// New local text after dispatch remains an unsubmitted draft, even if the
// previous request confirms. No implicit follow-up request is created.
const edited=deferred(),editDuring=harness({result:edited.promise});enter(editDuring,'publish-budget','11');blur(editDuring,'publish-budget','11');enter(editDuring,'publish-budget','12');edited.resolve(response(record('deck-a',{narrationBudgetMinutes:11})));await settle();assert.equal(editDuring.requests.length,1);assert.equal(input(editDuring.render(),'publish-budget').props.value,'12');assert.match(text(notice(editDuring.render(),'narrationBudgetMinutes')),/Saved value: 11/);checks++
// Scope object identity also rejects an old response after A→B→A.
const roundTripResponse=deferred(),roundTrip=harness({result:roundTripResponse.promise});enter(roundTrip,'publish-budget','11');blur(roundTrip,'publish-budget','11');roundTrip.render({record:record('deck-b')});roundTrip.render({record:record('deck-a',{narrationBudgetMinutes:30})});roundTripResponse.resolve(response(record('deck-a',{narrationBudgetMinutes:11})));await settle();assert.equal(roundTrip.adoptions.length,0);assert.equal(input(roundTrip.render(),'publish-budget').props.value,'30');assert.equal(roundTrip.toasts.length,0);checks++
// One field's confirmed save must not erase the other field's refused intent.
const both=harness({result:response(undefined,false,'First refused')});enter(both,'publish-budget','17.8');blur(both,'publish-budget','17.8');await settle();both.setResult(response(record('deck-a',{qaReserveMinutes:3})));enter(both,'publish-qa-reserve','3');blur(both,'publish-qa-reserve','3');await settle();assert.equal(input(both.render(),'publish-budget').props.value,'17.8');assert.equal(notice(both.render(),'narrationBudgetMinutes').props.role,'alert');assert.equal(input(both.render(),'publish-qa-reserve').props.value,'3');checks++
// Late A cannot adopt, notify, clear B's busy state or replace B's local intent.
for(const failed of[false,true]){
 const a=deferred(),b=deferred(),h=harness({result:a.promise});enter(h,'publish-budget','11');blur(h,'publish-budget','11');const oldControl=input(h.render(),'publish-qa-reserve');h.render({record:record('deck-b',{narrationBudgetMinutes:20})});assert.equal(input(h.render(),'publish-budget').props.value,'20');h.setResult(b.promise);enter(h,'publish-budget','23');blur(h,'publish-budget','23');oldControl.props.onBlur({target:{value:'4'}});assert.equal(h.requests.length,2);a.resolve(response(record(),!failed,'Old A refusal'));await settle();assert.equal(h.adoptions.length,0);assert.equal(h.toasts.length,0);assert.equal(input(h.render(),'publish-budget').props.disabled,true);assert.equal(input(h.render(),'publish-budget').props.value,'23');b.resolve(response(record('deck-b',{narrationBudgetMinutes:23})));await settle();assert.equal(h.adoptions.length,1);assert.equal(h.adoptions[0].slug,'deck-b');checks++
}
const first=deferred(),second=deferred(),newer=harness({result:first.promise});enter(newer,'publish-budget','11');blur(newer,'publish-budget','11');newer.setResult(second.promise);enter(newer,'publish-budget','12');blur(newer,'publish-budget','12');assert.equal(newer.requests.length,1);first.resolve(response(record('deck-a',{narrationBudgetMinutes:11})));await settle();assert.equal(newer.adoptions.length,1);assert.equal(input(newer.render(),'publish-budget').props.value,'12');assert.equal(input(newer.render(),'publish-budget').props.disabled,false);blur(newer,'publish-budget','12');assert.equal(newer.requests.length,2);second.resolve(response(record('deck-a',{narrationBudgetMinutes:12})));await settle();assert.equal(newer.adoptions.length,2);assert.equal(input(newer.render(),'publish-budget').props.value,'12');checks++
for(const failed of[false,true]){const late=deferred(),h=harness({result:late.promise});enter(h,'publish-budget','11');blur(h,'publish-budget','11');h.unmount();const writes=h.writes;late.resolve(response(record(),!failed,'Unmount refusal'));await settle();assert.equal(h.writes,writes);assert.equal(h.adoptions.length,0);assert.equal(h.toasts.length,0);checks++}
const external=harness();external.render();external.render({record:record('deck-a',{narrationBudgetMinutes:15})});assert.equal(input(external.render(),'publish-budget').props.value,'15');enter(external,'publish-budget','17');external.render({record:record('deck-a',{narrationBudgetMinutes:16})});assert.equal(input(external.render(),'publish-budget').props.value,'17');assert.match(text(notice(external.render(),'narrationBudgetMinutes')),/Saved value: 16/);checks++
// Source mutation proves the synchronous guard, rather than React repaint,
// prevents a blur+switch duplicate. Both callbacks come from one rendered tree.
const admissionGuard='    if (pendingScopeRef.current === scope && requestRef.current !== null) return\n'
assert.equal(source.split(admissionGuard).length,2)
for(const reverse of[false,true])for(const guardRemoved of[false,true]){
 const wait=deferred(),h=harness({result:wait.promise,sourceOverride:guardRemoved?source.replace(admissionGuard,''):source});enter(h,'publish-budget','11');const tree=h.render(),field=input(tree,'publish-budget'),toggle=find(tree,n=>n.type==='Switch'&&n.props.id==='publish-qa-enabled')
 if(reverse){toggle.props.onCheckedChange(false);field.props.onBlur({target:{value:'11'}})}else{field.props.onBlur({target:{value:'11'}});toggle.props.onCheckedChange(false)}
 assert.equal(h.requests.length,guardRemoved?2:1);assert.equal(h.adoptions.length,0);wait.resolve(response(record()));await settle();checks++
}
for(const flag of['false',undefined]){const wait=deferred(),h=harness({flag,result:wait.promise}),prior=harness({flag,prior:true,result:wait.promise});for(const current of[h,prior]){const tree=current.render();input(tree,'publish-budget').props.onBlur({target:{value:'11'}});find(tree,n=>n.type==='Switch'&&n.props.id==='publish-qa-enabled').props.onCheckedChange(false)}assert.equal(h.requests.length,2);assert.deepEqual(h.requests,prior.requests);wait.resolve(response(record()));await settle();checks++}
// A parent callback may synchronously unmount or navigate after receipt.
const unmountWait=deferred(),unmountFromCallback=harness({result:unmountWait.promise});unmountFromCallback.render({onRecordChange:deck=>{unmountFromCallback.adoptions.push(deck);unmountFromCallback.unmount()}});enter(unmountFromCallback,'publish-budget','11');blur(unmountFromCallback,'publish-budget','11');const writesBeforeCallback=unmountFromCallback.writes;unmountWait.resolve(response(record('deck-a',{narrationBudgetMinutes:11})));await settle();assert.equal(unmountFromCallback.adoptions.length,1);assert.equal(unmountFromCallback.writes,writesBeforeCallback);assert.equal(unmountFromCallback.toasts.length,0);checks++
const navigationWait=deferred(),navigateFromCallback=harness({result:navigationWait.promise});navigateFromCallback.render({onRecordChange:deck=>{navigateFromCallback.adoptions.push(deck);navigateFromCallback.render({record:record('deck-b',{narrationBudgetMinutes:30})})}});enter(navigateFromCallback,'publish-budget','11');blur(navigateFromCallback,'publish-budget','11');navigationWait.resolve(response(record('deck-a',{narrationBudgetMinutes:11})));await settle();assert.equal(navigateFromCallback.adoptions.length,1);assert.equal(input(navigateFromCallback.render(),'publish-budget').props.value,'30');assert.equal(notice(navigateFromCallback.render(),'narrationBudgetMinutes'),undefined);assert.equal(navigateFromCallback.toasts.length,0);checks++
const callbackWait=deferred(),latestCallback=harness({result:callbackWait.promise}),oldCallbacks=[],newCallbacks=[];latestCallback.render({onRecordChange:deck=>oldCallbacks.push(deck)});enter(latestCallback,'publish-budget','11');blur(latestCallback,'publish-budget','11');latestCallback.render({onRecordChange:deck=>newCallbacks.push(deck)});callbackWait.resolve(response(record('deck-a',{narrationBudgetMinutes:11})));await settle();assert.equal(oldCallbacks.length,0);assert.equal(newCallbacks.length,1);checks++
const focus=harness({result:response(undefined,false,'Long complete failure')});enter(focus,'publish-budget','11');blur(focus,'publish-budget','11');await settle();const focusNotice=notice(focus.render(),'narrationBudgetMinutes');assert.equal(focusNotice.props.tabIndex,0);assert.match(focusNotice.props.className,/focus-visible:outline-2/);assert.match(focusNotice.props.className,/focus-visible:outline-offset-2/);assert.match(focusNotice.props.className,/focus-visible:outline-violet-600/);assert.match(focusNotice.props.className,/dark:focus-visible:outline-violet-300/);checks++
// Receipt validation is numeric-only; unrelated switches retain their native
// optional-record success/no-op and HTTP refusal behavior, with target fencing.
for(const [id,field]of[['publish-qa-enabled','qaEnabled'],['publish-qa-auto','qaAutoAnswer'],['publish-narration-enabled','narrationEnabled']])for(const [result,adopted,toasted]of[[response(undefined),0,0],[response(record()),1,0],[response(undefined,false,'Native switch refusal'),0,1],[response(record('wrong-target')),0,0]]){
 const h=harness({result});find(h.render(),n=>n.type==='Switch'&&n.props.id===id).props.onCheckedChange(true);await settle();assert.deepEqual(h.requests[0].body,{[field]:true});assert.equal(h.adoptions.length,adopted);assert.equal(h.toasts.length,toasted);if(toasted)assert.deepEqual(h.toasts,[{title:'Native switch refusal',variant:'destructive'}]);assert.equal(find(h.render(),n=>n.type==='Switch'&&n.props.id===id).props.disabled,false);checks++
}
// Preserve native flag-off failure/callback behavior, including malformed success.
for(const result of[response(record()),response(undefined),response(undefined,false,'Classic refusal'),new Error('Classic exception')]){const current=harness({flag:'false',result}),prior=harness({flag:'false',prior:true,result});blur(current,'publish-budget','11');blur(prior,'publish-budget','11');await settle();assert.equal(snapshot(current.render()),snapshot(prior.render()));assert.deepEqual(current.requests,prior.requests);assert.deepEqual(current.toasts,prior.toasts);assert.deepEqual(current.adoptions,prior.adoptions);checks++}
// Current source semantic check uses only the already-generated task client.
const configFile=path.join(root,'.env.studio-v4-runtime/tsconfig.json'),loaded=ts.readConfigFile(configFile,ts.sys.readFile),parsed=ts.parseJsonConfigFileContent(loaded.config,ts.sys,path.dirname(configFile))
const program=ts.createProgram([path.join(root,file)],{...parsed.options,incremental:false,noEmit:true});assert.deepEqual(ts.getPreEmitDiagnostics(program).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);checks++
console.log(`Publish session drafts: ${checks} actual-leaf/source/options/classic/response/identity/compiler checks pass; supplied local results only, no service/auth/browser/persistence/ACK proof.`)
