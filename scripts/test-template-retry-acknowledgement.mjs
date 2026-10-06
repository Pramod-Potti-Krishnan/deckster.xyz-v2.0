import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source=fs.readFileSync(new URL('../lib/template-retry-acknowledgement.ts',import.meta.url),'utf8')
const module={exports:{}}
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports})
const merge=module.exports.mergeTemplateRetryAcknowledgement
const template={id:'template-a',name:'Keep this name',blueprint_generation_method:'llm',slide_count:3,
 blueprint_enrichment_status:'failed',blueprint_enrichment_error:'Prior optimization error',blueprint_enriched_at:'old-enrichment-time',
 template_purity_status:'failed',template_purity_error:'Prior cleanup error',template_purified_at:'old-cleanup-time'}
let checks=0
for(const enrichment of ['queued','running','complete','failed','skipped',null]){
 for(const purity of ['pending','clean','failed','skipped',null]){
  const result={id:'template-a',blueprint_enrichment_status:enrichment,template_purity_status:purity}
  const a=JSON.stringify(template),b=JSON.stringify(result),ack=merge(template,result)
  assert.ok(ack);assert.equal(ack.template.blueprint_enrichment_status,enrichment);assert.equal(ack.template.template_purity_status,purity)
  assert.equal(ack.template.blueprint_enrichment_error,template.blueprint_enrichment_error)
  assert.equal(ack.template.template_purity_error,template.template_purity_error)
  assert.deepEqual(Array.from(ack.previousErrors),[template.blueprint_enrichment_error,template.template_purity_error])
  assert.equal(JSON.stringify(template),a);assert.equal(JSON.stringify(result),b);checks++
 }
}
for(const field of ['blueprint_enrichment_status','blueprint_enrichment_error','blueprint_enriched_at','template_purity_status','template_purity_error','template_purified_at']){
 const absent=merge(template,{id:template.id});assert.equal(absent.template[field],template[field]);checks++
 for(const value of [null,undefined,'Exact returned value']){
  const ack=merge(template,{id:template.id,[field]:value});assert.ok(Object.hasOwn(ack.template,field));assert.equal(ack.template[field],value)
  assert.deepEqual(Array.from(ack.previousErrors),[template.blueprint_enrichment_error,template.template_purity_error]);checks++
 }
}
for(const result of [null,undefined,{}, {id:''},{id:'template-b'},{id:1},{id:' template-a '}]){assert.equal(merge(template,result),null);checks++}
const extra=merge(template,{id:template.id,name:'Overwrite',blueprint_generation_method:'legacy',slide_count:99,source_session_id:'other'})
assert.equal(extra.template.name,template.name);assert.equal(extra.template.slide_count,3);assert.equal(extra.template.blueprint_generation_method,'llm');assert.ok(!Object.hasOwn(extra.template,'source_session_id'));checks++
assert.deepEqual(Array.from(merge({...template,blueprint_enrichment_error:'same',template_purity_error:'same'},{id:template.id}).previousErrors),['same']);checks++
assert.deepEqual(Array.from(merge({...template,blueprint_enrichment_error:null,template_purity_error:' '},{id:template.id}).previousErrors),[]);checks++
assert.deepEqual(JSON.parse(JSON.stringify(merge({id:'template-a'},{id:'template-a'}).template)),{id:'template-a'},'No readiness/status/timestamp invented');checks++
console.log(`${checks} retry acknowledgement identity/null/omission/history/immutability cases passed; no optimistic readiness or services.`)
