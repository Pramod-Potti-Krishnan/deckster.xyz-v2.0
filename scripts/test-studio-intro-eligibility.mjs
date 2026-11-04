import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createHash } from 'node:crypto'

const root=new URL('../',import.meta.url)
const source=fs.readFileSync(new URL('lib/studio-intro-eligibility.ts',root),'utf8')
const compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}})
assert.deepEqual((compiled.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error),[])
const module={exports:{}}
vm.runInNewContext(compiled.outputText,{module,exports:module.exports})
const {studioIntroEligibility}=module.exports
const plain=x=>JSON.parse(JSON.stringify(x))
const safe={workspaceReady:true,initialEntry:true,activeBuild:false,decisionPending:false,errorPresent:false,modalOpen:false,dirtyDraft:false,workInFlight:false}
const denied={automatic:false,manual:false}
const results=[]
function check(name,action){action();results.push({case:name,pass:true})}
check('ready_clean_initial_entry_both_allowed',()=>assert.deepEqual(plain(studioIntroEligibility(safe)),{automatic:true,manual:true}))
check('settled_deck_manual_only',()=>assert.deepEqual(plain(studioIntroEligibility({...safe,initialEntry:false})),{automatic:false,manual:true}))
for(const value of [undefined,null,false,'true',1])check(`readiness_${String(value)}`,()=>assert.deepEqual(plain(studioIntroEligibility({...safe,workspaceReady:value})),denied))
for(const field of ['activeBuild','decisionPending','errorPresent','modalOpen','dirtyDraft','workInFlight']){
 for(const value of [true,undefined,null,'false',0])check(`${field}_${String(value)}`,()=>assert.deepEqual(plain(studioIntroEligibility({...safe,[field]:value})),denied))
}
for(const value of [undefined,null,'true',1])check(`unknown_initial_entry_${String(value)}`,()=>assert.deepEqual(plain(studioIntroEligibility({...safe,initialEntry:value})),{automatic:false,manual:true}))

for(const [name,patch] of [
 ['initial_auth_loading',{workspaceReady:false}],['session_restore_loading',{workspaceReady:false,initialEntry:false}],
 ['native_canvas_readiness_unknown',{workspaceReady:null,initialEntry:false}],
 ['real_director_build',{activeBuild:true}],['paused_resume_surface',{activeBuild:true}],
 ['mandatory_question',{decisionPending:true}],['research_retry_gate',{decisionPending:true}],
 ['quota_topup_modal',{modalOpen:true}],['native_error_recovery',{errorPresent:true}],
 ['composer_unsent_text',{dirtyDraft:true}],['attached_files',{dirtyDraft:true}],
 ['blueprint_unsaved',{dirtyDraft:true}],['generation_panel_draft',{dirtyDraft:true}],
 ['native_active_editing',{dirtyDraft:true}],['native_dirty_unknown',{dirtyDraft:null}],
 ['generation_request',{workInFlight:true}],['theme_sync_pending',{workInFlight:true}],
 ['open_about_modal',{modalOpen:true}],['other_modal_open',{modalOpen:true}],
])check(name,()=>assert.deepEqual(plain(studioIntroEligibility({...safe,...patch})),denied))

check('about_close_and_focus_restore_then_explicit_replay',()=>{
 assert.deepEqual(plain(studioIntroEligibility({...safe,initialEntry:false,modalOpen:true})),denied)
 assert.deepEqual(plain(studioIntroEligibility({...safe,initialEntry:false,modalOpen:false})),{automatic:false,manual:true})
})
check('about_focus_return_new_work_refuses_replay',()=>assert.deepEqual(plain(studioIntroEligibility({...safe,initialEntry:false,workInFlight:true})),denied))
check('blocked_entry_consumed_by_owner_does_not_queue_on_modal_close',()=>{
 assert.deepEqual(plain(studioIntroEligibility({...safe,modalOpen:true})),denied)
 assert.deepEqual(plain(studioIntroEligibility({...safe,initialEntry:false,modalOpen:false})),{automatic:false,manual:true})
})
check('pure_helper_does_not_claim_to_consume_automatic_intent',()=>{
 studioIntroEligibility({...safe,modalOpen:true})
 assert.deepEqual(plain(studioIntroEligibility(safe)),{automatic:true,manual:true},'Owner must consume blocked first-entry intent; a stateless helper cannot prevent a later retry by itself')
})
check('unknown_extra_fields_do_not_grant_entry',()=>assert.deepEqual(plain(studioIntroEligibility({...safe,workspaceReady:undefined,connected:true,slideCount:7,quota:'available',presentationUrl:'synthetic'})),denied))
check('repeated_calls_preserve_inputs_and_results',()=>{const input=Object.freeze({...safe,initialEntry:false});for(let i=0;i<10;i++)assert.deepEqual(plain(studioIntroEligibility(input)),{automatic:false,manual:true});assert.deepEqual(input,{...safe,initialEntry:false})})
check('no_effects_DOM_storage_callbacks_actions_or_assumed_quota',()=>assert.ok(!/import\s|useEffect|setTimeout|setInterval|window\.|document\.|localStorage|sessionStorage|fetch\(|postMessage|sendMessage|callback|quota|Date\.|performance\./.test(source)))

if(process.argv.includes('--write-evidence')){
 const evidence=new URL('docs/studio-v4/combined-intros-20261004/evidence/intro-eligibility.json',root)
 fs.mkdirSync(new URL('.',evidence),{recursive:true})
 fs.writeFileSync(evidence,JSON.stringify({level:'Actual pure helper in isolated TypeScript execution; fixed synthetic risk cases only, no browser/connected evidence',checks:results.length,source_sha256:createHash('sha256').update(source).digest('hex'),results},null,2)+'\n')
}
console.log(`Studio intro eligibility: ${results.length} actual-helper readiness/risk/entry/replay/purity checks passed`)
