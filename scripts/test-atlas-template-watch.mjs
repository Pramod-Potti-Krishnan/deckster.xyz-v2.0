import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'

// Execute the real hook against offline HTTP-shaped input and controlled timers.
// This proves callback behavior, never a connected service acknowledgement.
const source = fs.readFileSync('hooks/use-templates.ts', 'utf8')
function harness(text = source, { firstTimer = 1 } = {}) {
  const exports = {}, timers = new Map(), reads = [], replies = [], updates = [], writes = []
  let nextTimer = firstTimer - 1
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, module: { exports }, console,
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id },
    clearTimeout(id) { timers.delete(id) },
    async fetch(url, options) {
      reads.push({ url, options })
      const reply = replies.shift()
      assert(reply, 'Every offline read must have a deliberate response')
      return await reply
    },
    require(id) {
      assert.equal(id, 'react')
      return { useState: initial => [initial, value => writes.push(value)], useCallback: fn => fn }
    },
  })
  const hook = exports.useTemplates()
  const response = snapshot => ({ ok: true, json: async () => snapshot })
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
  async function tick(snapshot) {
    if (snapshot !== undefined) replies.push(response(snapshot))
    const [id, timer] = timers.entries().next().value || []
    assert(timer, 'Expected an actual scheduled poll')
    timers.delete(id); timer.fn(); await flush()
  }
  return { exports, hook, timers, reads, replies, updates, writes, response, flush, tick }
}
const snapshot = (enrichment, purity, method = 'llm') => ({
  id: 'template/owned', name: 'Owned template', blueprint_generation_method: method,
  blueprint_enrichment_status: enrichment, template_purity_status: purity,
  blueprint_enrichment_error: 'Earlier enrichment diagnostic', template_purity_error: 'Earlier cleanup diagnostic',
})
// Exact non-watcher hook/readiness/API witnesses; only private fetchTemplate
// and the assigned watcher implementation intentionally change in this batch.
const prior=readAtlasBaseline('3f6e8ce:hooks/use-templates.ts')
const ast=value=>ts.createSourceFile('templates.ts',value,ts.ScriptTarget.Latest,true)
const find=(root,predicate)=>{if(predicate(root))return root;let found;ts.forEachChild(root,node=>{if(!found)found=find(node,predicate)});return found}
const currentAst=ast(source),priorAst=ast(prior),printer=ts.createPrinter({removeComments:true})
for(const name of['isTemplateGenerationReady','templateGenerationStatus','templateGenerationStatusLabel','templateGenerationUnavailableReason','listTemplates','getTemplate','saveTemplate','reoptimizeTemplate']){
 const predicate=node=>node.name?.getText()===name,a=find(currentAst,predicate),b=find(priorAst,predicate);assert.ok(a&&b,name)
 assert.equal(printer.printNode(ts.EmitHint.Unspecified,a,currentAst),printer.printNode(ts.EmitHint.Unspecified,b,priorAst),`${name}: native read/mutation/readiness contract unchanged`)
}
const h = harness()
let cases = 0
for (const status of ['queued', 'running', 'complete', 'failed', null, undefined]) {
  for (const purity of ['failed', 'pending', 'clean', null, undefined]) {
    for (const method of ['llm', 'deterministic']) {
      const value = snapshot(status, purity, method), before = JSON.stringify(value)
      const ready = method === 'llm' && status === 'complete' && purity === 'clean'
      const expected = ready ? 'ready' : ['queued', 'running'].includes(status) ? 'optimizing' : purity === 'failed' ? 'needs_cleanup' : status === 'failed' ? 'failed' : method === 'llm' && status === 'complete' ? 'needs_cleanup' : 'needs_optimization'
      assert.equal(h.exports.isTemplateGenerationReady(value), ready)
      assert.equal(h.exports.templateGenerationStatus(value), expected)
      assert.equal(JSON.stringify(value), before, 'Status helpers preserve every supplied field')
      cases++
    }
  }
}
assert.equal(h.exports.templateGenerationStatus(null), 'needs_optimization')
const original = harness(readAtlasBaseline('63e0eb2:hooks/use-templates.ts'))
assert.equal(original.exports.templateGenerationStatus(snapshot('queued', 'failed')), 'needs_cleanup', 'Reviewed predecessor reproduces the watcher-stopping defect')

{
  const h = harness(), events = []
  h.hook.watchTemplateStatus('template/owned', {
    onUpdate: (next, status) => { events.push(['update', status]); assert.equal(next.template_purity_error, 'Earlier cleanup diagnostic') },
    onReady: () => events.push(['ready']), onFailed: () => events.push(['failed']),
  })
  assert.equal([...h.timers.values()][0].delay, 5000, 'Native polling interval preserved')
  await h.tick(snapshot('queued', 'failed')); assert.equal(h.timers.size, 1)
  await h.tick(snapshot('running', 'failed')); assert.equal(h.timers.size, 1)
  await h.tick(snapshot('complete', 'clean')); assert.equal(h.timers.size, 0)
  assert.deepEqual(events, [['update', 'optimizing'], ['update', 'optimizing'], ['update', 'ready'], ['ready']])
  assert(h.reads.every(read => read.url === '/api/templates/template%2Fowned' && read.options.cache === 'no-store'))
  cases++
}
for (const [status, purity, expected] of [['failed', 'pending', 'failed'], ['complete', 'failed', 'needs_cleanup'], ['failed', 'failed', 'needs_cleanup']]) {
  const h = harness(), events = []
  h.hook.watchTemplateStatus('template/owned', { onFailed: (next, state) => events.push(state), onReady: () => assert.fail('Terminal failure cannot unlock') })
  await h.tick(snapshot(status, purity)); assert.deepEqual(events, [expected]); assert.equal(h.timers.size, 0); cases++
}
{
  const h = harness(), events = []
  h.hook.watchTemplateStatus('template/owned', { intervalMs: 17, maxAttempts: 2, onTimeout: next => events.push(next) })
  assert.equal([...h.timers.values()][0].delay, 17)
  const value = snapshot('running', 'failed')
  await h.tick(value); await h.tick(value)
  assert.equal(events[0], value); assert.equal(h.timers.size, 0); assert.equal(h.reads.length, 2); cases++
}
{
  const h = harness()
  const stop = h.hook.watchTemplateStatus('template/owned', { onUpdate: () => assert.fail('Stopped watcher cannot report') })
  stop(); stop(); assert.equal(h.timers.size, 0); assert.equal(h.reads.length, 0); cases++
}
{
  const h = harness(); let release
  h.replies.push(new Promise(resolve => { release = resolve }))
  const stop = h.hook.watchTemplateStatus('template/owned', { onUpdate: () => assert.fail('Pending response after stop cannot report'), onReady: () => assert.fail('Pending response after stop cannot unlock') })
  await h.tick(); stop(); release(h.response(snapshot('complete', 'clean'))); await h.flush()
  assert.equal(h.timers.size, 0); assert.equal(h.reads.length, 1); cases++
}
// Live outer owner/readiness: retired queued/inflight callbacks cannot read or
// report; temporary verification pauses do not consume the native read budget.
{
 const h=harness();const stop=h.hook.watchTemplateStatus('template/owned');const queued=[...h.timers.values()][0].fn
 stop();queued();await h.flush();assert.equal(h.reads.length,0);assert.equal(h.timers.size,0);cases++
}
{
 const h=harness();let current=true;h.hook.watchTemplateStatus('template/owned',{isCurrent:()=>current});current=false
 await h.tick();assert.equal(h.reads.length,0);assert.equal(h.timers.size,0);cases++
}
{
 const h=harness();let current=true,release;const events=[]
 h.replies.push(new Promise(resolve=>{release=resolve}));h.hook.watchTemplateStatus('template/owned',{isCurrent:()=>current,onUpdate:()=>events.push('update'),onReady:()=>events.push('ready')})
 await h.tick();current=false;release(h.response(snapshot('complete','clean')));await h.flush()
 assert.deepEqual(events,[]);assert.equal(h.timers.size,0);cases++
}
for(const status of['ready','optimizing','failed']){
 const h=harness();let current=true;const events=[]
 h.hook.watchTemplateStatus('template/owned',{isCurrent:()=>current,onUpdate:()=>{events.push('update');current=false},onReady:()=>events.push('ready'),onFailed:()=>events.push('failed'),onTimeout:()=>events.push('timeout'),maxAttempts:1})
 await h.tick(status==='ready'?snapshot('complete','clean'):status==='failed'?snapshot('failed','pending'):snapshot('queued','failed'))
 assert.deepEqual(events,['update']);assert.equal(h.timers.size,0);cases++
}
{
 const h=harness();let ready=false;const events=[]
 const stop=h.hook.watchTemplateStatus('template/owned',{canStart:()=>ready,onTimeout:()=>events.push('timeout')})
 for(let i=0;i<30;i++)await h.tick()
 assert.equal(h.reads.length,0);assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].delay,5000)
 ready=true;for(let i=0;i<23;i++)await h.tick(snapshot('queued','failed'))
 assert.equal(h.reads.length,23);assert.deepEqual(events,[]);assert.equal(h.timers.size,1)
 ready=false;for(let i=0;i<4;i++)await h.tick();assert.equal(h.reads.length,23)
 ready=true;await h.tick(snapshot('running','failed'));assert.equal(h.reads.length,24);assert.deepEqual(events,['timeout']);assert.equal(h.timers.size,0);stop();cases++
}
{
 const h=harness();h.hook.watchTemplateStatus('template/owned',{isCurrent:()=>false,canStart:()=>false});assert.equal(h.timers.size,0);assert.equal(h.reads.length,0);cases++
}
{
 const h=harness();let ready=false;const stop=h.hook.watchTemplateStatus('template/owned',{canStart:()=>ready});await h.tick();const queued=[...h.timers.values()][0].fn
 stop();ready=true;queued();await h.flush();assert.equal(h.reads.length,0);assert.equal(h.timers.size,0);cases++
}
{
 const h=harness(source,{firstTimer:0});const stop=h.hook.watchTemplateStatus('template/owned');assert.ok(h.timers.has(0));stop();assert.equal(h.timers.size,0);cases++
}
{
 const h=harness();let current=true,reject;h.replies.push(new Promise((resolve,rejection)=>{reject=rejection}))
 h.hook.watchTemplateStatus('template/owned',{isCurrent:()=>current});await h.tick();const writes=h.writes.length;current=false;reject(Error('Retired HTTP failure'));await h.flush()
 assert.equal(h.writes.length,writes,'Retired watcher cannot write a late hook error');assert.equal(h.timers.size,0);cases++
}
{
 const h=harness();let ready=true,release;const events=[];h.replies.push(new Promise(resolve=>{release=resolve}))
 h.hook.watchTemplateStatus('template/owned',{isCurrent:()=>true,canStart:()=>ready,onUpdate:()=>events.push('update'),onReady:()=>events.push('ready')});await h.tick();ready=false
 release(h.response(snapshot('complete','clean')));await h.flush();assert.deepEqual(events,['update','ready'],'Same-owner verified receipt may settle during loading');assert.equal(h.timers.size,0);cases++
}
console.log(`PASS ${cases} actual status/watcher cases; unchanged readiness, polling, cancellation and timeout; offline inputs only`)
