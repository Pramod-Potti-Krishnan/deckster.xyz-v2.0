import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const file = 'components/builder/template-picker.tsx'
const source = fs.readFileSync(file, 'utf8')
const baselineRevision = 'f156b0e'
const baseline = execFileSync('git', ['show', `${baselineRevision}:${file}`], { encoding: 'utf8' })
const hookSource = fs.readFileSync('hooks/use-templates.ts', 'utf8')
const helperSource = fs.readFileSync('lib/template-retry-acknowledgement.ts', 'utf8')
const oldPrecedence = "  if (purity === 'failed') return 'needs_cleanup';\n  if (status === 'failed') return 'failed';\n  if (status === 'queued' || status === 'running') return 'optimizing';"
const newPrecedence = "  if (status === 'queued' || status === 'running') return 'optimizing';\n  if (purity === 'failed') return 'needs_cleanup';\n  if (status === 'failed') return 'failed';"
const prerequisiteApplied = hookSource.includes(newPrecedence)
assert.ok(prerequisiteApplied || hookSource.includes(oldPrecedence), 'Status prerequisite has an exact known narrow provenance')
// Atlas exclusively owns the real hook. Until integrated, only this known
// three-line precedence permutation is supplied to the Studio test module.
const proposedHook = prerequisiteApplied ? hookSource : hookSource.replace(oldPrecedence, newPrecedence)
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const compile = code => {
  const out = ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  assert.deepEqual(out.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error), [])
  return out.outputText
}
const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : tree == null || typeof tree === 'boolean' ? '' : String(tree)
const snapshot = tree => JSON.stringify(tree, (_key, value) => typeof value === 'function' ? '[function]' : value)
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const ready = { id: 'template-A', name: 'Template A', slide_count: 3, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' }
const queued = { ...ready, blueprint_enrichment_status: 'queued', template_purity_status: 'pending' }
const failed = { ...ready, blueprint_enrichment_status: 'failed', blueprint_enrichment_error: 'Exact old enrichment refusal', template_purity_status: 'failed', template_purity_error: 'Exact old cleanup refusal' }
const cases = []
const check = (name, fn) => { fn(); cases.push(name) }
const bodyOf = (code, name) => {
  const ast=ts.createSourceFile('picker.tsx',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='TemplatePickerContent')
  const declaration=fn.body.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]).find(n=>n.name.getText(ast)===name)
  return ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Unspecified,declaration.initializer,ast)
}
check('Classic retry, selection conversion and selection gate source remain exact',()=>{
  for(const name of ['handleRetryOptimization','handleTemplateClick','toSelection'])assert.equal(bodyOf(source,name),bodyOf(baseline,name))
  assert.equal(source.slice(source.indexOf('export function TemplatePicker(')),baseline.slice(baseline.indexOf('export function TemplatePicker(')))
  assert.equal(source.slice(source.indexOf('  return (\n    <>')),baseline.slice(baseline.indexOf('  return (\n    <>')),'Classic markup/options remain byte-exact')
})

function harness(code = source, flag, options = {}) {
  if (arguments.length < 2) flag = 'true'
  const slots = [], effects = [], events = [], timers = new Map(), wraps = new WeakMap()
  let cursor = 0, dirty = false, mounted = true, tree, now = 0, timerId = 0, writes = 0
  let props = { onSelect: value => events.push(['select', value]), isOpen: true, standalone: true, mode: 'generation' }
  const api = { list: async () => ({ templates: options.records ?? [queued], count: 1 }), retry: async () => ({ id: ready.id, blueprint_enrichment_status: 'queued' }), status: async () => queued }
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, update => { const value = typeof update === 'function' ? update(slots[i].value) : update; if (!Object.is(value, slots[i].value)) { if (i > 1) writes++; slots[i].value = value; dirty = true } }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useCallback(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v,j) => v !== old.deps[j])) slots[i] = { value: callback, deps }; return slots[i].value },
    useEffect(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v,j) => v !== old.deps[j])) { slots[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = callback() }) } },
  }
  const localFetch = async (url, init) => {
    let value
    if (url === '/api/templates') { events.push(['list']); value = await api.list() }
    else if (url.endsWith('/enrich')) { events.push(['retry', decodeURIComponent(url.split('/')[3])]); value = await api.retry() }
    else { events.push(['poll', decodeURIComponent(url.split('/')[3]), now]); value = await api.status() }
    if (value === null) return { ok: false, status: 503, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => value }
  }
  const timerGlobals = { setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { at: now + delay, callback }); return id }, clearTimeout(id) { timers.delete(id) } }
  const hookMod = { exports: {} }
  vm.runInNewContext(compile(flag === 'true' ? proposedHook : hookSource), { module: hookMod, exports: hookMod.exports, require: id => { assert.equal(id, 'react'); return react }, fetch: localFetch, ...timerGlobals })
  const helperMod = { exports: {} }
  vm.runInNewContext(compile(helperSource), { module: helperMod, exports: helperMod.exports })
  const toast = value => events.push(['toast', value])
  const deps = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'Link' }, './studio-template-picker.css': {},
    'lucide-react': Object.fromEntries(['AlertTriangle', 'CheckCircle2', 'LayoutTemplate', 'Loader2', 'RotateCw', 'Search', 'X'].map(x => [x,x])),
    '@/components/ui/dropdown-menu': Object.fromEntries(['DropdownMenu','DropdownMenuContent','DropdownMenuItem','DropdownMenuLabel','DropdownMenuSeparator','DropdownMenuTrigger'].map(x => [x,x])),
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') }, '@/hooks/use-toast': { useToast: () => ({ toast }) },
    '@/lib/template-retry-acknowledgement': helperMod.exports,
    '@/hooks/use-templates': { ...hookMod.exports, useTemplates() {
      const hook = hookMod.exports.useTemplates()
      if (!wraps.has(hook.watchTemplateStatus)) wraps.set(hook.watchTemplateStatus, (id, callbacks) => {
        events.push(['watch', id, now]); const stop = hook.watchTemplateStatus(id, callbacks)
        return () => { events.push(['stop', id, now]); stop() }
      })
      return { ...hook, watchTemplateStatus: wraps.get(hook.watchTemplateStatus) }
    } },
  }
  const point = '\n  if (STUDIO_SHELL) {\n    const matches'
  assert.equal(code.split(point).length, 2)
  const exposed = code.replace(point, '\n  globalThis.__picker = { templates, refresh, retryNative, handleRetryOptimization, handleTemplateClick }\n' + point)
  const mod = { exports: {} }, context = { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag, NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: options.composer ? 'true' : undefined } }, require: id => { assert.ok(id in deps, id); return deps[id] }, fetch: () => assert.fail('Unmocked request'), ...timerGlobals }
  vm.runInNewContext(compile(exposed), context)
  const h = {
    api, events, timers,
    render(next = props) { props = next; cursor = 0; dirty = false; tree = mod.exports.TemplatePickerContent(props); while (effects.length) effects.shift()(); return tree },
    async settle() { for (let i=0; i<18; i++) { await Promise.resolve(); if (dirty && mounted) h.render() } },
    async tick(ms) { const end = now + ms; let guard=0; for (;;) { const next = [...timers.entries()].sort((a,b) => a[1].at-b[1].at)[0]; if (!next || next[1].at > end) break; assert.ok(++guard < 300); now = next[1].at; timers.delete(next[0]); next[1].callback(); await h.settle() } now = end; await h.settle() },
    refresh: () => context.__picker.refresh(),
    retry: () => context.__picker.retryNative(context.__picker.templates[0]),
    classicRetry: () => context.__picker.handleRetryOptimization(context.__picker.templates[0]),
    select: () => context.__picker.handleTemplateClick(context.__picker.templates[0]),
    get records() { return context.__picker.templates }, get props() { return props }, get tree() { return tree }, get writes() { return writes },
    get polls() { return events.filter(x => x[0] === 'poll').length }, get watches() { return events.filter(x => x[0] === 'watch').length },
    unmount() { mounted = false; for (const slot of slots) slot?.cleanup?.() },
  }
  h.render(); return h
}

// Demonstrate the original defect with the actual shared 5s/24-attempt watcher.
{
  const h = harness(baseline); await h.settle(); await h.tick(125000)
  check('baseline onUpdate renders restart watch past its finite attempt limit', () => { assert.equal(h.polls, 25); assert.ok(h.watches >= 26); assert.equal(h.timers.size, 1); assert.doesNotMatch(text(h.tree), /checks paused/) }); h.unmount()
}
{
  const h = harness(); await h.settle(); await h.tick(125000)
  check('24 actual watcher polls reach visible timeout without subscription reset', () => { assert.equal(h.polls,24); assert.equal(h.watches,1); assert.equal(h.timers.size,0); assert.match(text(h.tree),/Automatic status checks paused/); assert.equal(h.records[0].blueprint_enrichment_status,'queued') })
  h.render(); await h.tick(15000)
  check('ordinary renders cannot restart completed polling budget', () => assert.equal(h.polls,24))
  await h.refresh(); await h.settle(); await h.tick(5000)
  check('explicit successful refresh permits one new bounded watch', () => { assert.equal(h.watches,2); assert.equal(h.polls,25); assert.doesNotMatch(text(h.tree),/checks paused/) }); h.unmount()
}
for (const result of [null, {}, { id:'other' }, { id:ready.id }, { id:ready.id, blueprint_enrichment_status:'queued' }, { id:ready.id, blueprint_enrichment_status:'running', blueprint_enrichment_error:null, template_purity_error:null }, { ...ready, blueprint_enrichment_error:null, template_purity_error:null }]) {
  const h=harness(source,'true',{records:[failed]}); await h.settle(); h.api.retry=async()=>result
  const original=JSON.stringify(h.records[0]); await h.retry(); await h.settle()
  check(`authoritative retry fields/diagnostic history ${JSON.stringify(result)}`, () => {
    if (!result || result.id !== ready.id) { assert.equal(JSON.stringify(h.records[0]), original); assert.equal(h.watches,0); assert.ok(h.events.some(e=>e[0]==='toast' && e[1].title==='Could not retry optimization')); return }
    for (const field of ['blueprint_enrichment_status','blueprint_enrichment_error','template_purity_status','template_purity_error']) assert.equal(h.records[0][field], Object.hasOwn(result,field)?result[field]:failed[field])
    assert.equal(h.records[0].name,failed.name); assert.equal(h.records[0].slide_count,3)
    assert.match(text(h.tree),/Previous attempt: Exact old enrichment refusal · Exact old cleanup refusal/)
    if (!Object.hasOwn(result,'template_purity_error')) assert.match(text(h.tree),/Current diagnostics:.*Exact old cleanup refusal/)
    const optimizing=['queued','running'].includes(result.blueprint_enrichment_status)
    assert.equal(h.watches,optimizing?1:0)
    if (optimizing) { assert.equal(h.records[0].template_purity_status,'failed'); assert.ok(nodes(h.tree).find(n=>n.props.className==='stp-main').props['aria-disabled']) }
  }); h.unmount()
}
for (const change of ['close','unmount','replacement','refresh-start','close-reopen']) {
  const h=harness(source,'true',{records:[failed]}); await h.settle(); const d=deferred(); h.api.retry=()=>d.promise; const task=h.retry(); await h.settle()
  if (change==='unmount') h.unmount()
  else if (change==='close' || change==='close-reopen') { h.render({...h.props,isOpen:false}); if(change==='close-reopen'){h.render({...h.props,isOpen:true});await h.settle()} }
  else if(change==='refresh-start'){ const list=deferred();h.api.list=()=>list.promise;void h.refresh() }
  else { h.api.list=async()=>({templates:[{...failed,name:'Replacement owner'}]});await h.refresh();await h.settle() }
  const writes=h.writes, before=h.events.length; d.resolve({...ready,blueprint_enrichment_error:null,template_purity_error:null});await task;await h.settle()
  check(`late retry fenced after ${change}`,()=>{ assert.equal(h.writes,writes); assert.equal(h.events.length,before); if(change==='replacement')assert.equal(h.records[0].name,'Replacement owner') }); if(change!=='unmount')h.unmount()
}
for(const change of ['close','unmount','list-replacement']){
  const h=harness();await h.settle();const d=deferred();h.api.status=()=>d.promise;await h.tick(5000)
  if(change==='unmount')h.unmount();else if(change==='close')h.render({...h.props,isOpen:false});else{h.api.list=async()=>({templates:[{...queued,name:'New list owner'}]});await h.refresh();await h.settle()}
  const before=h.events.length,writes=h.writes;d.resolve(ready);await h.settle()
  check(`late actual watcher response fenced after ${change}`,()=>{assert.equal(h.writes,writes);assert.equal(h.events.length,before);if(change==='list-replacement')assert.equal(h.records[0].name,'New list owner')});h.unmount()
}
for(const outcome of ['ready','failed','wrong-ready','wrong-queued','null']){
  const h=harness();await h.settle();h.api.status=async()=>outcome==='ready'?ready:outcome==='failed'?failed:outcome==='null'?null:{...(outcome==='wrong-ready'?ready:queued),id:'wrong-record',name:'Wrong record'}
  await h.tick(outcome==='null'||outcome==='wrong-queued'?125000:5000)
  check(`actual watcher terminal and snapshot identity ${outcome}`,()=>{
    assert.equal(h.watches,1);assert.equal(h.timers.size,0);assert.equal(h.records[0].id,ready.id);assert.equal(h.records[0].name,ready.name)
    if(outcome==='ready'){assert.equal(h.records[0].blueprint_enrichment_status,'complete');h.select();assert.equal(h.events.filter(e=>e[0]==='select').length,1)}
    else if(outcome==='failed')assert.equal(h.records[0].blueprint_enrichment_status,'failed')
    else{assert.equal(h.records[0].blueprint_enrichment_status,'queued');assert.match(text(h.tree),/Refresh to check/);assert.equal(h.events.filter(e=>e[0]==='toast'&&e[1].title==='Template ready').length,0)}
  });h.unmount()
}
for(const flag of [undefined,'false','TRUE','1']){
  const actual=harness(source,flag), old=harness(baseline,flag)
  await actual.settle();await old.settle();check(`Classic/default-off tree and watch unchanged ${flag}`,()=>{assert.equal(snapshot(actual.tree),snapshot(old.tree));assert.equal(actual.watches,old.watches)})
  actual.api.retry=old.api.retry=async()=>({id:ready.id,blueprint_enrichment_status:'queued',template_purity_status:'failed',template_purity_error:'returned refusal'})
  await actual.classicRetry();await old.classicRetry();await actual.settle();await old.settle()
  check(`Classic retry/options/readiness unchanged ${flag}`,()=>{assert.equal(snapshot(actual.tree),snapshot(old.tree));assert.equal(JSON.stringify(actual.records),JSON.stringify(old.records));assert.equal(JSON.stringify(actual.events),JSON.stringify(old.events))});actual.unmount();old.unmount()
}
for(const mode of ['generation','review']){
  const h=harness(source,'true',{composer:true});h.api.list=async()=>({templates:[failed,{...ready,id:'composer',stage_template_summary:{}}]});await h.settle();await h.refresh();await h.settle();h.render({...h.props,mode,preferredTemplateId:ready.id});h.select()
  check(`Composer filtering and ${mode} selection preserved`,()=>{assert.equal(h.records.length,1);assert.equal(h.events.filter(e=>e[0]==='select').length,mode==='review'?1:0);assert.match(text(h.tree),/From your library/);assert.ok(nodes(h.tree).find(n=>n.type==='input'&&n.props['aria-label']==='Search saved templates'))});h.unmount()
}
{
  const h=harness(source,'true',{records:[failed]});await h.settle();const a=deferred(),b=deferred();h.api.retry=()=>a.promise;const first=h.retry();await h.settle();void h.retry();await h.settle()
  check('duplicate in-flight retry does not submit another request',()=>assert.equal(h.events.filter(e=>e[0]==='retry').length,1))
  h.api.list=async()=>({templates:[{...failed,name:'B current owner'}]});await h.refresh();await h.settle();h.api.retry=()=>b.promise;const second=h.retry();await h.settle()
  a.resolve(ready);await first;await h.settle()
  check('old retry completion cannot clear a newer owner busy state',()=>{assert.match(text(h.tree),/Requesting…/);assert.equal(h.records[0].name,'B current owner')})
  b.resolve({id:ready.id,blueprint_enrichment_status:'running'});await second;await h.settle()
  check('new owner receives only its matching acknowledgement',()=>{assert.equal(h.records[0].name,'B current owner');assert.equal(h.records[0].blueprint_enrichment_status,'running');assert.equal(h.records[0].template_purity_error,failed.template_purity_error)});h.unmount()
}
{
  const staleCleanup={...failed,blueprint_enrichment_status:'queued'}
  const h=harness(source,'true',{records:[staleCleanup]});h.api.status=async()=>({...staleCleanup,blueprint_enrichment_status:'running'});await h.settle();await h.tick(10000)
  check('queued/running prior failed cleanup is polled without inventing readiness',()=>{assert.equal(h.polls,2);assert.equal(h.watches,1);assert.equal(h.records[0].template_purity_status,'failed');assert.match(text(h.tree),/Current diagnostics:.*Exact old cleanup refusal/);h.select();assert.equal(h.events.filter(e=>e[0]==='select').length,0)});h.unmount()
}
{
  const h=harness();await h.settle();const input=nodes(h.tree).find(n=>n.type==='input');let focuses=0;input.props.ref.current={focus(){focuses++}}
  input.props.onChange({target:{value:'no match'}});h.render();const clear=nodes(h.tree).find(n=>n.props['aria-label']==='Clear saved template search');clear.props.onClick();h.render()
  let stopped=0;nodes(h.tree).find(n=>n.type==='input').props.onKeyDown({key:'ArrowLeft',stopPropagation(){stopped++}})
  check('search clearing restores focus and existing keyboard propagation boundary',()=>{assert.equal(focuses,1);assert.equal(stopped,1);assert.equal(nodes(h.tree).find(n=>n.type==='input').props.value,'')});h.unmount()
}
const evidence='docs/studio-v4/overnight-fidelity-20261002/evidence/template-retry-picker'
fs.mkdirSync(evidence,{recursive:true})
fs.writeFileSync(evidence+'/focused-results.json',JSON.stringify({capturedAt:new Date().toISOString(),baselineRevision,componentHash:hash(source),hookHash:hash(hookSource),helperHash:hash(helperSource),prerequisiteApplied,
  statusPrerequisite:prerequisiteApplied?'Actual integrated shared status precedence':'PROPOSED TEST-ONLY exact three-line queued/running precedence permutation; Atlas owns integration',
  statusPrerequisiteOriginal:oldPrecedence,statusPrerequisiteProposed:newPrecedence,actualSharedWatcher:true,intervalMs:5000,maxAttempts:24,
  casesPassed:cases.length,cases,networkOrServices:false,browserOrLiveBackendProof:false},null,2)+'\n')
console.log(`PASS ${cases.length} actual component/shared watcher fake-clock cases; status prerequisite ${prerequisiteApplied?'integrated':'proposed test-only'}; no services or browser.`)
