import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source=fs.readFileSync(new URL('../lib/studio-workflow.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}})
const module={exports:{}};vm.runInNewContext(compiled.outputText,{module,exports:module.exports,URLSearchParams})
const {parseStudioWorkflowAction,getStudioWorkflowHref,draftKey,parseStudioWorkflowDraft,getInitializedBuilderHref}=module.exports
assert.equal(parseStudioWorkflowAction('theme'),'theme');assert.equal(parseStudioWorkflowAction('publish'),null);assert.equal(parseStudioWorkflowAction('https://other.invalid'),null)
const url=new URL(getStudioWorkflowHref('templates','a&studio_action=master','item/one'),'https://local.invalid');assert.equal(url.pathname,'/builder');assert.equal(url.searchParams.get('studio_action'),'templates');assert.equal(url.searchParams.get('session_id'),'a&studio_action=master');assert.equal(url.searchParams.get('studio_item'),'item/one')
assert.notEqual(draftKey('account-one'),draftKey('account-two'));assert.equal(new URL(getStudioWorkflowHref('theme','new'),'https://local.invalid').searchParams.has('session_id'),false)
const now=10000000;const draft=(changes={})=>JSON.stringify({version:1,createdAt:now,text:'Build a thoughtful story',...changes})
assert.equal(parseStudioWorkflowDraft(draft(),now),'Build a thoughtful story')
for(const bad of [null,'not json','[]',draft({version:2}),draft({createdAt:now-3600001}),draft({createdAt:now+60001}),draft({text:' '}),draft({text:'x'.repeat(20001)}),draft({createdAt:'today'})])assert.equal(parseStudioWorkflowDraft(bad,now),null)
console.log('Studio workflow scope, safe navigation and draft lifetime checks passed')

for(const action of ['templates','theme','master','brief']){const fresh=new URLSearchParams({studio_action:action,studio_item:'saved/item&one'});const assigned=new URL(getInitializedBuilderHref(fresh,'assigned-session',true),'https://local.invalid');assert.equal(assigned.searchParams.get('session_id'),'assigned-session');assert.equal(assigned.searchParams.get('studio_action'),action);assert.equal(assigned.searchParams.get('studio_item'),'saved/item&one');assert.equal(new URL(getInitializedBuilderHref(fresh,'assigned-session',false),'https://local.invalid').searchParams.has('studio_action'),false)}
assert.equal(getInitializedBuilderHref(new URLSearchParams('studio_action=unknown&studio_item=x'),'assigned-session',true),'/builder?session_id=assigned-session')
console.log('Fresh session initialization retains allowed review intent; classic path unchanged')
