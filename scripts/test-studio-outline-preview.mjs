import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createHash } from 'node:crypto'

const root=new URL('../',import.meta.url)
const source=fs.readFileSync(new URL('hooks/use-studio-outline-preview.ts',root),'utf8')
const compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}})
assert.deepEqual((compiled.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error),[])
const initial={enabled:true,sessionId:'synthetic-session',buildId:'synthetic-build',phase:'building',slidesDone:0,activeVersion:'strawman',templateModeOn:false}
const event={build_id:'synthetic-build',phase:'building',label:'Synthetic build began',auto_proceed:true}

function harness(){
 let cursor=0,dirty=false,pending=[],slots=[],props={...initial},api,now=0,sequence=0,disposed=false,updatesAfterUnmount=0
 const timers=new Map()
 const react={
  useRef(initial){const i=cursor++;return slots[i]??={current:initial}},
  useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return [slots[i].value,update=>{if(disposed)updatesAfterUnmount++;const next=typeof update==='function'?update(slots[i].value):update;if(next!==slots[i].value){slots[i].value=next;dirty=true}}]},
  useCallback(callback,deps){const i=cursor++,old=slots[i];if(!old||deps.some((x,n)=>x!==old.deps[n]))slots[i]={callback,deps};return slots[i].callback},
  useEffect(callback,deps){const i=cursor++,old=slots[i];if(!old||deps.some((x,n)=>x!==old.deps[n])){const slot={deps,cleanup:old?.cleanup};slots[i]=slot;pending.push(()=>{slot.cleanup?.();slot.cleanup=callback()})}},
 }
 const module={exports:{}}
 vm.runInNewContext(compiled.outputText,{module,exports:module.exports,require:id=>{assert.equal(id,'react');return react},performance:{now:()=>now},setTimeout:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,at:now+delay});return id},clearTimeout:id=>timers.delete(id)})
 const hook=module.exports.useStudioOutlinePreview
 function render(next=props,flush=true){props=next;const once=()=>{cursor=0;dirty=false;api=hook(props)};once();if(flush){let turns=0;do{while(pending.length)pending.shift()();if(dirty)once();assert.ok(++turns<30,'hook settles')}while(dirty||pending.length)}return api}
 function advance(ms){const target=now+ms;let timer;while((timer=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0])){now=timer[1].at;timers.delete(timer[0]);timer[1].callback();render()}now=target;return render()}
 const deliver=(payload=event,owner='synthetic-session')=>{api.onNativeBuildPhase(payload,owner);return render()}
 const dispose=()=>{disposed=true;for(const slot of slots)slot?.cleanup?.()}
 return {render,advance,deliver,dispose,timers,props:()=>props,api:()=>api,updatesAfterUnmount:()=>updatesAfterUnmount}
}
const results=[]
const check=(name,run)=>{run();results.push({case:name,pass:true})}

check('no_native_receipt_no_intro',()=>{const h=harness();assert.equal(h.render().showOutlinePreview,false);assert.equal(h.timers.size,0);h.dispose()})
check('owned_automatic_receipt_at_most_3000ms',()=>{const h=harness();h.render();assert.equal(h.deliver().showOutlinePreview,true);assert.equal(h.advance(2999).showOutlinePreview,true);assert.equal(h.advance(1).showOutlinePreview,false);assert.equal(h.timers.size,0);h.dispose()})
check('duplicate_receipt_does_not_extend_or_reopen',()=>{const h=harness();h.render();h.deliver();h.advance(2500);assert.equal(h.deliver().showOutlinePreview,true);assert.equal(h.advance(500).showOutlinePreview,false);assert.equal(h.deliver().showOutlinePreview,false);h.dispose()})
check('props_changes_do_not_renew_deadline',()=>{const h=harness();h.render();h.deliver();h.advance(2000);h.render({...h.props(),phase:'building'});assert.equal(h.advance(1000).showOutlinePreview,false);h.dispose()})
check('receipt_before_reducer_building_adoption',()=>{const h=harness();h.render({...initial,phase:'strawman'});assert.equal(h.deliver().showOutlinePreview,false);h.advance(1000);assert.equal(h.render({...initial}).showOutlinePreview,true);assert.equal(h.advance(2000).showOutlinePreview,false);h.dispose()})
check('late_reducer_adoption_does_not_restart_budget',()=>{const h=harness();h.render({...initial,phase:'strawman'});h.deliver();h.advance(3000);assert.equal(h.render({...initial}).showOutlinePreview,false);assert.equal(h.deliver().showOutlinePreview,false);h.dispose()})
check('refused_foreign_receipt_does_not_consume_owned_event',()=>{const h=harness();h.render();h.deliver(event,'synthetic-other-session');assert.equal(h.deliver().showOutlinePreview,true);h.dispose()})
check('ordinary_building_event_cannot_extend_existing_intro',()=>{const h=harness();h.render();h.deliver();h.advance(2000);assert.equal(h.deliver({...event,auto_proceed:undefined}).showOutlinePreview,true);assert.equal(h.advance(1000).showOutlinePreview,false);h.dispose()})

for(const [name,payload,owner] of [
 ['owner_missing',event,null],['owner_foreign',event,'synthetic-other-session'],
 ['build_foreign',{...event,build_id:'synthetic-other-build'},'synthetic-session'],
 ['auto_absent',{...event,auto_proceed:undefined},'synthetic-session'],
 ['auto_false',{...event,auto_proceed:false},'synthetic-session'],
 ['auto_truthy_not_literal',{...event,auto_proceed:'true'},'synthetic-session'],
 ['phase_strawman',{...event,phase:'strawman'},'synthetic-session'],
 ['payload_already_built',{...event,slides_done:1},'synthetic-session'],
 ['payload_uncertain_done',{...event,slides_done:NaN},'synthetic-session'],
])check(name,()=>{const h=harness();h.render();assert.equal(h.deliver(payload,owner).showOutlinePreview,false);assert.equal(h.timers.size,0);h.dispose()})

for(const [name,patch] of [
 ['disabled',{enabled:false}],['session_unknown',{sessionId:null}],['session_new',{sessionId:'new'}],
 ['session_empty',{sessionId:' '}],['build_unknown',{buildId:null}],['build_empty',{buildId:' '}],
 ['template_mode',{templateModeOn:true}],['prior_slide',{slidesDone:1}],['unknown_slide_count',{slidesDone:NaN}],
 ...['awaiting_user','qa','finalizing','complete','error','paused','stopped'].map(phase=>[`gate_${phase}`,{phase}]),
])check(name,()=>{const h=harness();h.render({...initial,...patch});assert.equal(h.deliver().showOutlinePreview,false);assert.equal(h.timers.size,0);h.dispose()})

for(const [name,patch] of [
 ['first_built',{slidesDone:1}],['foreign_session',{sessionId:'synthetic-other-session'}],['new_build',{buildId:'synthetic-other-build'}],
 ['version_intent',{activeVersion:'blank'}],['template_intent',{templateModeOn:true}],['disable',{enabled:false}],
 ...['qa','finalizing','complete','error','paused','stopped','awaiting_user'].map(phase=>[phase,{phase}]),
])check(`immediate_cancel_${name}`,()=>{const h=harness();h.render();h.deliver();h.advance(500);const changed={...h.props(),...patch};assert.equal(h.render(changed,false).showOutlinePreview,false,'Cancellation visible before effect cleanup');h.render();assert.equal(h.timers.size,0);h.render({...initial});assert.equal(h.api().showOutlinePreview,false);assert.equal(h.deliver().showOutlinePreview,false,'Consumed receipt cannot reopen');h.dispose()})

check('manual_same_version_intent_cancels_and_quarantines',()=>{const h=harness();h.render();h.deliver();h.api().cancelOutlinePreview();assert.equal(h.render().showOutlinePreview,false);assert.equal(h.deliver().showOutlinePreview,false);h.dispose()})
check('manual_intent_before_receipt_quarantines_current_build',()=>{const h=harness();h.render();h.api().cancelOutlinePreview();h.render();assert.equal(h.deliver().showOutlinePreview,false);h.dispose()})
check('stale_owner_callback_cannot_start_returned_session',()=>{const h=harness();const old=h.render();h.render({...initial,sessionId:'synthetic-other-session'});h.render({...initial});old.onNativeBuildPhase(event,'synthetic-session');assert.equal(h.render().showOutlinePreview,false);h.dispose()})
check('new_owned_build_can_have_its_own_intro',()=>{const h=harness();h.render();h.deliver();h.render({...initial,buildId:'synthetic-next-build'});assert.equal(h.deliver({...event,build_id:'synthetic-next-build'}).showOutlinePreview,true);h.dispose()})
check('old_manual_cancel_callback_cannot_clear_new_owned_intro',()=>{const h=harness();const old=h.render();h.render({...initial,buildId:'synthetic-next-build'});h.deliver({...event,build_id:'synthetic-next-build'});old.cancelOutlinePreview();assert.equal(h.render().showOutlinePreview,true);h.dispose()})
check('return_after_many_builds_cannot_reopen_consumed_receipt',()=>{const h=harness();h.render();h.deliver();for(let index=0;index<20;index++){const id=`synthetic-intervening-${index}`;h.render({...initial,buildId:id});h.deliver({...event,build_id:id})}h.render({...initial});assert.equal(h.deliver().showOutlinePreview,false);h.dispose()})
check('unmount_clears_timer_and_rejects_late_callback',()=>{const h=harness();h.render();h.deliver();const old=h.api();h.dispose();assert.equal(h.timers.size,0);old.onNativeBuildPhase(event,'synthetic-session');old.cancelOutlinePreview();assert.equal(h.updatesAfterUnmount(),0)})
check('event_and_options_remain_unchanged',()=>{const h=harness();const props=Object.freeze({...initial}),payload=Object.freeze({...event});h.render(props);h.deliver(payload);h.advance(3000);assert.deepEqual(props,initial);assert.deepEqual(payload,event);h.dispose()})
check('no_native_action_or_viewer_mutation',()=>{assert.ok(!/fetch\(|postMessage|sendCommand|sendMessage|accept_strawman|localStorage|sessionStorage|presentationUrl|presentationId|goToSlide|router\.|location\./.test(source));assert.ok(source.includes('payload.auto_proceed !== true'));assert.ok(source.includes('performance.now()'),'Deadline uses monotonic time, no wall-clock completion')})

if(process.argv.includes('--write-evidence')){
 const evidence=new URL('docs/studio-v4/canvas-lifecycle-20261004/evidence/outline-preview-hook.json',root)
 fs.mkdirSync(new URL('.',evidence),{recursive:true})
 fs.writeFileSync(evidence,JSON.stringify({level:'Actual hook executed in isolated React lifecycle harness with fake monotonic timers; synthetic cases only; no service/browser evidence',checks:results.length,max_dwell_ms:3000,source_sha256:createHash('sha256').update(source).digest('hex'),results},null,2)+'\n')
}
console.log(`Studio outline preview: ${results.length} actual-hook owner/event/deadline/cancellation/actionless checks passed`)
