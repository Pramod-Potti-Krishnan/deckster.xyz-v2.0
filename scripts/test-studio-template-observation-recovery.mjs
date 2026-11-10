import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Actual transpiled leaf and readiness helpers. The sole test-only injection
// exposes internal handlers and state; their bodies/JSX remain intact.
// Deferred results are supplied local values, never a service acknowledgement.
const root = new URL('../', import.meta.url)
const file = 'components/template-save-dialog.tsx'
const source = fs.readFileSync(new URL(file, root), 'utf8')
const baseline = execFileSync('git', ['show', `a4f7c15:${file}`], { cwd: root, encoding: 'utf8' })
const jsx = (type, props, key) => ({ type, props, ...(key === undefined ? {} : { key }) })
const flat = value => Array.isArray(value) ? value.flatMap(flat) : !value || typeof value !== 'object' ? [] : [value, ...flat(value.props?.children)]
const text = value => Array.isArray(value) ? value.map(text).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? text(value.props?.children) : String(value)
const canonical = value => ts.createPrinter({ removeComments: true }).printFile(ts.createSourceFile('leaf.tsx', value, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX))
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const compile = value => {
  const out = ts.transpileModule(value, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  assert.equal((out.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0)
  return out.outputText
}
const helperModule = { exports: {} }
vm.runInNewContext(compile(fs.readFileSync(new URL('hooks/use-templates.ts', root), 'utf8')), {
  module: helperModule, exports: helperModule.exports, require: name => { assert.equal(name, 'react'); return {} },
  fetch: () => assert.fail('No requests allowed'),
})
const ready = { id: 'template-A', name: 'Template A', slide_count: 4, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' }
const queued = { ...ready, blueprint_enrichment_status: 'queued', template_purity_status: 'pending' }
const failed = { ...ready, blueprint_enrichment_status: 'failed', blueprint_enrichment_error: 'Exact optimization refusal END' }
const retryModule = { exports: {} }
vm.runInNewContext(compile(fs.readFileSync(new URL('lib/template-retry-acknowledgement.ts', root), 'utf8')), { module: retryModule, exports: retryModule.exports })
let checks = 0
const check = async (label, fn) => { await fn(); checks++; console.log(`PASS ${label}`) }
// Actual component + actual useTemplates transport/watch with supplied responses.
// The virtual clock advances existing timers without browser or service operations.
function harness(code = source, flag) {
  if(arguments.length < 2) flag = 'true'
  const slots = [], effects = [], events = [], watchers = [], timers = new Map()
  let cursor = 0, writes = 0, sequence = 0, props, tree
  const api = { saveTemplate: async () => queued, reoptimizeTemplate: async () => queued, getTemplate: async () => queued }
  const react = {
    Fragment: 'Fragment',
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { writes++; slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useCallback(callback) { return callback },
    useEffect(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((value,index) => value !== old.deps[index])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, effect: callback, cleanup: callback() } }) },
  }
  const actual = { exports: {} }
  vm.runInNewContext(compile(fs.readFileSync(new URL('hooks/use-templates.ts', root), 'utf8')), {
    module: actual, exports: actual.exports, Error, require: name => { assert.equal(name,'react'); return react },
    fetch: async (url, options = {}) => {
      const method = options.method ?? 'GET'
      events.push(['http',method,url,options.body ? JSON.parse(options.body) : null])
      const value = method === 'POST' ? url.endsWith('/enrich') ? await api.reoptimizeTemplate(url) : await api.saveTemplate(options.body) : await api.getTemplate(url)
      return { ok: value !== null, status: value === null ? 503 : 200, json: async () => value ?? { detail: 'Supplied offline refusal' } }
    },
    setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id,{ fn,ms }); return id }, clearTimeout: id => timers.delete(id),
  })
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': Object.fromEntries(['AlertTriangle','CheckCircle2','Loader2','RotateCw'].map(x => [x,x])),
    '@/components/ui/dialog': Object.fromEntries(['Dialog','DialogContent','DialogDescription','DialogFooter','DialogHeader','DialogTitle'].map(x => [x,x])),
    '@/components/ui/button': { Button: 'Button' }, '@/components/ui/input': { Input: 'Input' }, '@/components/ui/label': { Label: 'Label' },
    './studio-editor-dialogs.css': {}, './studio-template-flows.css': {}, '@/lib/template-retry-acknowledgement': retryModule.exports,
    '@/hooks/use-toast': { useToast: () => ({ toast: value => events.push(['toast',value.title,value.description]) }) },
    '@/hooks/use-templates': { ...actual.exports, useTemplates: () => {
      const real = actual.exports.useTemplates()
      return { ...real, watchTemplateStatus: (id, callbacks) => {
        const watch = { id, callbacks, stopped: false }; watchers.push(watch); events.push(['watch',id])
        const stop = real.watchTemplateStatus(id,callbacks)
        return () => { watch.stopped = true; events.push(['stop',id]); stop() }
      } }
    } },
  }
  const mod = { exports: {} }, context = { module: mod, exports: mod.exports, Error, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, require: id => { assert.ok(id in dependencies,id); return dependencies[id] } }
  const injection = '\n  globalThis.__handlers = { handleSave, handleRetryOptimization, handleRefreshStatus: typeof handleRefreshStatus === "undefined" ? null : handleRefreshStatus }; globalThis.__state = { trackedTemplate, studioRetryDiagnostics, studioObservation: typeof studioObservation === "undefined" ? null : studioObservation, studioReadinessRef: typeof studioReadinessRef === "undefined" ? null : studioReadinessRef, studioRefreshButtonRef: typeof studioRefreshButtonRef === "undefined" ? null : studioRefreshButtonRef }\n'
  const point = '\n  return (\n    <Dialog'; assert.equal(code.split(point).length,2)
  vm.runInNewContext(compile(code.replace(point,injection + point)),context)
  const defaultProps = { open: true, sessionId: 'session-A', sourcePresentationId: 'presentation-A', onSavedTemplate: result => events.push(['promote',result.id]), onTemplateOptimizationFailed: id => events.push(['failed',id]), onOpenChange: open => events.push(['close',open]) }
  const h = {
    api, events, watchers, timers,
    render(next = props || defaultProps) { props = next; cursor = 0; tree = mod.exports.TemplateSaveDialog(props); while (effects.length) effects.shift()(); return tree },
    name(value) { flat(tree).find(x => x.type === 'Input').props.onChange({ target: { value } }); h.render() },
    save() { return context.__handlers.handleSave() }, retry() { return context.__handlers.handleRetryOptimization() }, refresh() { return context.__handlers.handleRefreshStatus() },
    get focusRefs() { return [context.__state.studioReadinessRef,context.__state.studioRefreshButtonRef] }, get tracked() { return context.__state.trackedTemplate }, get diagnostics() { return context.__state.studioRetryDiagnostics }, get observation() { return context.__state.studioObservation }, get refreshHandler() { return context.__handlers.handleRefreshStatus }, get props() { return props }, get tree() { return tree }, get writes() { return writes },
    unmount() { for (const slot of slots) slot?.cleanup?.() }, remountEffects() { for (const slot of slots) if(slot?.effect)slot.cleanup = slot.effect() },
    async settle() { for(let i=0;i<40;i++)await Promise.resolve(); h.render() },
    async tick() { const item = timers.entries().next().value; assert.ok(item,'an actual existing watch timer'); assert.equal(item[1].ms,5000); timers.delete(item[0]); item[1].fn(); await h.settle() },
  }
  h.render(); return h
}
const rendered = tree => JSON.stringify(tree, (key,value) => key === 'children' && Array.isArray(value) ? value.filter(child => child !== false && child !== null && child !== undefined) : value)
const paused = h => flat(h.tree).find(x => x.props?.['data-template-observation'] === 'paused')
const refreshing = h => flat(h.tree).find(x => x.props?.['data-template-observation'] === 'refreshing')
const requests = (h,method) => h.events.filter(x => x[0] === 'http' && x[1] === method)
const promotions = h => h.events.filter(x => x[0] === 'promote')
async function saved(code = source, flag, template = queued) {
  if(arguments.length < 2) flag = 'true'
  const h = harness(code,flag); h.api.saveTemplate = async () => template; h.name('Owned'); await h.save(); h.render(); return h
}
async function timeout(h) { h.api.getTemplate = async () => queued; for(let i=0;i<24;i++)await h.tick() }
const baselineSnapshot = snapshot => ({ ...snapshot, id:'template-B' })
for (const wrong of [baselineSnapshot(ready), baselineSnapshot(failed)]) await check(`Reproduce actual accepted stop gap for wrong-ID terminal ${wrong.blueprint_enrichment_status}`, async () => {
  const h = await saved(baseline); h.api.getTemplate = async () => wrong; await h.tick()
  assert.equal(h.timers.size,0); assert.equal(h.tracked.id,queued.id); assert.equal(h.tracked.blueprint_enrichment_status,'queued')
  assert.match(text(h.tree),/Optimizing template/); assert.equal(paused(h),undefined); assert.equal(promotions(h).length,0)
})
await check('Reproduce actual accepted timeout gap: toast only, queued card has no persistent recovery', async () => {
  const h = await saved(baseline); await timeout(h); assert.equal(h.timers.size,0); assert.equal(paused(h),undefined)
  assert.match(text(h.tree),/Optimizing template/); assert.ok(h.events.some(x => x[1] === 'Template still optimizing'))
})
for (const wrong of [baselineSnapshot(ready), baselineSnapshot(failed), { ...ready,id:undefined }]) await check(`Wrong-ID actual watch stop exposes persistent recovery without promotion: ${String(wrong.id)}/${wrong.blueprint_enrichment_status}`, async () => {
  const h = await saved(); const before=JSON.stringify(h.tracked); h.api.getTemplate=async()=>wrong; await h.tick()
  assert.equal(h.timers.size,0); assert.ok(paused(h)); assert.equal(JSON.stringify(h.tracked),before); assert.equal(promotions(h).length,0)
  assert.match(text(h.tree),/Status updates paused/); assert.match(text(h.tree),/did not match/); assert.doesNotMatch(text(h.tree),/Optimizing template\.\.\./)
  const writes=h.writes, events=JSON.stringify(h.events), old=h.watchers[0]
  old.callbacks.onUpdate(ready); old.callbacks.onReady(ready); old.callbacks.onFailed(failed,'failed'); old.callbacks.onTimeout(); h.render()
  assert.equal(h.writes,writes); assert.equal(JSON.stringify(h.events),events)
})
await check('Actual bounded timeout retains card and persistent owner-scoped paused message', async () => {
  const h = await saved(); const before=JSON.stringify(h.tracked); await timeout(h)
  assert.ok(paused(h)); assert.equal(h.timers.size,0); assert.equal(JSON.stringify(h.tracked),before); assert.equal(promotions(h).length,0)
  assert.match(text(h.tree),/ended before completion was confirmed/)
})
for (const value of [null, 'throw', baselineSnapshot(ready), { id:'' }]) await check(`Refused/mismatched GET retains latest authoritative card and persistent recovery: ${JSON.stringify(value)}`, async () => {
  const h=await saved(); await timeout(h); const before=JSON.stringify(h.tracked), posts=requests(h,'POST').length
  h.api.getTemplate=async()=>{if(value==='throw')throw new Error('Supplied read refusal'); return value}; await h.refresh(); h.render()
  assert.equal(JSON.stringify(h.tracked),before); assert.ok(paused(h)); assert.equal(promotions(h).length,0); assert.equal(requests(h,'POST').length,posts)
  assert.equal(h.timers.size,0); assert.match(text(h.tree),value && value!=='throw' ? /did not match/ : /could not be read/)
})
await check('Matching not-ready GET updates authoritative fields and restarts only the existing watch', async () => {
  const h=await saved(); await timeout(h); const posts=requests(h,'POST').length
  const running={...queued,blueprint_enrichment_status:'running',blueprint_enrichment_error:null,template_purity_error:null,blueprint_enriched_at:null}
  h.api.getTemplate=async()=>running; await h.refresh(); h.render()
  assert.equal(h.tracked.blueprint_enrichment_status,'running'); assert.equal(h.tracked.blueprint_enriched_at,null); assert.equal(paused(h),undefined)
  assert.equal(h.timers.size,1); assert.equal(promotions(h).length,0); assert.equal(requests(h,'POST').length,posts)
  h.api.getTemplate=async()=>ready; await h.tick(); assert.equal(promotions(h).length,1); assert.equal(h.timers.size,0)
})
await check('Exact-ready GET promotes once, invalidates stale handler and performs no POST', async () => {
  const h=await saved(); await timeout(h); const old=h.watchers[0], refresh=h.refreshHandler, posts=requests(h,'POST').length
  h.api.getTemplate=async()=>ready; await refresh(); const gets=requests(h,'GET').length; await refresh(); h.render()
  assert.equal(promotions(h).length,1); assert.equal(requests(h,'GET').length,gets); assert.equal(requests(h,'POST').length,posts); assert.equal(paused(h),undefined); assert.equal(h.timers.size,0)
  old.callbacks.onReady(ready); h.render(); assert.equal(promotions(h).length,1)
})
for (const invalid of [{...ready,template_purity_status:'pending'}, {...ready,blueprint_generation_method:'deterministic_fallback'}, {...ready,blueprint_enrichment_status:null}]) await check(`Matching GET cannot bypass exact readiness: ${JSON.stringify(invalid)}`, async () => {
  const h=await saved(); await timeout(h); h.api.getTemplate=async()=>invalid; await h.refresh(); h.render(); assert.equal(promotions(h).length,0)
  assert.equal(helperModule.exports.isTemplateGenerationReady(h.tracked),false)
})
await check('Matching terminal failure GET is authoritative and keeps native Retry distinct from Refresh', async () => {
  const h=await saved(); await timeout(h); h.api.getTemplate=async()=>failed; const posts=requests(h,'POST').length; await h.refresh(); h.render()
  assert.match(text(h.tree),/Optimization failed/); assert.match(text(h.tree),/Exact optimization refusal END/)
  assert.equal(h.events.filter(x=>x[0]==='failed').length,1); assert.equal(promotions(h).length,0); assert.equal(requests(h,'POST').length,posts); assert.equal(h.timers.size,0)
})
await check('Same-ID invalid-ready callback exposes paused recovery and cannot promote', async () => {
  const h=await saved(); const before=JSON.stringify(h.tracked); h.watchers[0].callbacks.onReady(queued); h.render()
  assert.ok(paused(h)); assert.equal(JSON.stringify(h.tracked),before); assert.equal(promotions(h).length,0); assert.match(text(h.tree),/could not confirm readiness/)
})
await check('Normal close during GET preserves owned observation and latest completion callback', async () => {
  const h=await saved(); await timeout(h); const d=deferred(); h.api.getTemplate=()=>d.promise; const task=h.refresh(); h.render({ ...h.props,open:false,onSavedTemplate:r=>h.events.push(['latest-promote',r.id]) })
  d.resolve(ready); await task; h.render(); assert.equal(h.events.filter(x=>x[0]==='latest-promote').length,1); assert.match(text(h.tree),/Ready to reuse/)
})
for (const change of ['source','roundtrip','unmount','remount']) await check(`Deferred GET cannot cross owner/mount boundary: ${change}`, async () => {
  const h=await saved(); await timeout(h); const d=deferred(), props=h.props; h.api.getTemplate=()=>d.promise; const task=h.refresh(); h.render()
  if(change==='unmount'||change==='remount'){h.unmount();if(change==='remount')h.remountEffects()}else{h.render({...props,sessionId:'session-B',sourcePresentationId:'presentation-B'});if(change==='roundtrip')h.render(props)}
  const before=JSON.stringify(h.tracked), events=h.events.filter(x=>x[0]!=='http').length
  d.resolve(ready); await task; h.render(); assert.equal(JSON.stringify(h.tracked),before); assert.equal(h.events.filter(x=>x[0]!=='http').length,events); assert.equal(promotions(h).length,0); assert.equal(paused(h),undefined)
})
await check('Rapid Refresh and competing retry/save share pending ownership; recovery remains available on refusal', async () => {
  const h=await saved(); await timeout(h); const d=deferred(); h.api.getTemplate=()=>d.promise; const gets=requests(h,'GET').length,posts=requests(h,'POST').length
  const first=h.refresh(); await h.refresh(); await h.retry(); h.name('Competing draft'); await h.save(); h.render()
  assert.equal(requests(h,'GET').length,gets+1); assert.equal(requests(h,'POST').length,posts); assert.ok(refreshing(h))
  const button=flat(h.tree).find(x=>x.type==='Button'&&text(x)==='Refreshing…'); assert.equal(button.props.disabled,undefined); assert.equal(button.props['aria-disabled'],true); assert.match(button.props.className,/pointer-events-none/)
  d.resolve(null); await first; h.render(); assert.ok(paused(h)); assert.equal(flat(h.tree).find(x=>x.type==='Input').props.value,'Competing draft')
})
await check('Competing retry acknowledgement supersedes paused observation without creating a GET', async () => {
  const h=await saved(); await timeout(h); const d=deferred(); h.api.reoptimizeTemplate=()=>d.promise; const task=h.retry(); const gets=requests(h,'GET').length
  await h.refresh(); assert.equal(requests(h,'GET').length,gets); d.resolve(queued); await task; h.render()
  assert.equal(paused(h),undefined); assert.equal(h.timers.size,1); h.api.getTemplate=async()=>ready; await h.tick(); assert.equal(promotions(h).length,1)
})
await check('Acknowledged retry diagnostic history survives mismatched/read refusal and clears only current errors', async () => {
  const initial={...failed,template_purity_status:'failed',template_purity_error:'Exact purity refusal END'}
  const h=await saved(source,'true',initial); h.api.reoptimizeTemplate=async()=>({...queued,blueprint_enrichment_error:null,template_purity_error:null}); await h.retry(); h.render()
  h.api.getTemplate=async()=>baselineSnapshot(ready); await h.tick(); assert.ok(paused(h)); assert.match(text(h.tree),/Previous optimization errors/)
  const before=JSON.stringify(h.tracked); h.api.getTemplate=async()=>null; await h.refresh(); h.render(); assert.equal(JSON.stringify(h.tracked),before); assert.match(text(h.tree),/Exact optimization refusal END/); assert.match(text(h.tree),/Exact purity refusal END/)
})
for(const flag of [undefined,'false','TRUE','1'])await check(`Classic/default-off body, terminal watches and timeout match accepted source: ${String(flag)}`,async()=>{
  // An explicit undefined flag must remain absent rather than select the test default.
  const effective=flag
  for(const outcome of ['ready','wrong-ready','failed','timeout']){
    const a=await saved(source,effective),b=await saved(baseline,effective)
    if(outcome==='timeout'){await timeout(a);await timeout(b)}else{const response=outcome==='ready'?ready:outcome==='failed'?failed:baselineSnapshot(ready);a.api.getTemplate=b.api.getTemplate=async()=>response;await a.tick();await b.tick()}
    assert.equal(rendered(a.tree),rendered(b.tree));assert.equal(JSON.stringify(a.events),JSON.stringify(b.events));assert.equal(paused(a),undefined)
  }
})
for(const focus of ['owned','moved','closed'])await check(`Successful GET focus returns without scrolling only when still owned: ${focus}`,async()=>{
  const h=await saved(); await timeout(h); const d=deferred(); h.api.getTemplate=()=>d.promise; const [cardRef,buttonRef]=h.focusRefs
  const doc={activeElement:null}, calls=[], button={ownerDocument:doc}; doc.activeElement=button; buttonRef.current=button
  cardRef.current={isConnected:true,focus:options=>calls.push(options)}
  const task=h.refresh()
  if(focus==='moved')doc.activeElement={other:true}
  if(focus==='closed'){doc.activeElement=null;cardRef.current.isConnected=false;h.render({...h.props,open:false})}
  d.resolve(queued);await task;h.render();assert.equal(calls.length,focus==='owned'?1:0)
  if(calls.length)assert.equal(calls[0].preventScroll,true)
})
await check('Paused recovery exposes native button and persistent status in the existing live card',async()=>{
  const h=await saved();await timeout(h)
  const button=flat(h.tree).find(x=>x.type==='Button'&&text(x)==='Refresh status')
  assert.equal(button.props.type,'button');assert.equal(button.props.disabled,undefined);assert.equal(button.props['aria-disabled'],false)
  const card=flat(h.tree).find(x=>x.props?.['data-template-status'])
  assert.equal(card.props.tabIndex,-1);assert.equal(card.props.role,'status');assert.equal(card.props['aria-live'],'polite')
  assert.match(card.props.className,/focus-visible:ring-2/);assert.match(text(h.tree),/does not request another optimization/)
})
await check('Pending Refresh preserves its native focus while aria-disabled and blocks repeated GETs',async()=>{
  const h=await saved();await timeout(h);const d=deferred();h.api.getTemplate=()=>d.promise;const [cardRef,buttonRef]=h.focusRefs
  const doc={activeElement:null},calls=[],button={ownerDocument:doc};doc.activeElement=button;buttonRef.current=button
  cardRef.current={isConnected:true,focus:options=>calls.push(options)}
  const before=requests(h,'GET').length,task=h.refresh();h.render()
  const pending=flat(h.tree).find(x=>x.type==='Button'&&text(x)==='Refreshing…')
  assert.equal(pending.props.disabled,undefined);assert.equal(pending.props['aria-disabled'],true);assert.match(pending.props.className,/pointer-events-none/)
  // Native disabled caused the lead's Chromium probe to drop button focus.
  // Aria-disabled retains DOM focus; the synchronous owner/pending gate supplies
  // the action guard for keyboard events, which aria-disabled itself cannot do.
  for(let i=0;i<4;i++)await h.refresh()
  assert.equal(requests(h,'GET').length,before+1);assert.equal(doc.activeElement,button)
  d.resolve(queued);await task;h.render();assert.equal(calls.length,1);assert.equal(calls[0].preventScroll,true)
})
await check('Owned pending GET keeps truthful Save label and enables the existing normal footer Close callback',async()=>{
  const h=await saved();await timeout(h);const d=deferred();h.api.getTemplate=()=>d.promise
  const posts=requests(h,'POST').length,gets=requests(h,'GET').length,task=h.refresh();h.render()
  const footer=flat(h.tree).find(x=>x.type==='DialogFooter'),buttons=flat(footer).filter(x=>x.type==='Button')
  assert.equal(text(buttons[0]),'Close');assert.equal(buttons[0].props.disabled,false)
  assert.equal(text(buttons[1]),'Save Template');assert.equal(buttons[1].props.disabled,true)
  buttons[0].props.onClick();assert.deepEqual(h.events.at(-1),['close',false]);h.render({...h.props,open:false})
  d.resolve(ready);await task;h.render()
  assert.equal(promotions(h).length,1);assert.equal(requests(h,'GET').length,gets+1);assert.equal(requests(h,'POST').length,posts)
})
for(const flag of ['true',undefined,'false','TRUE','1'])await check(`Actual pending Save retains Saving label and footer close restriction: ${String(flag)}`,async()=>{
  const h=await saved(source,flag),d=deferred();h.api.saveTemplate=()=>d.promise;h.name('Another owned draft')
  const task=h.save();h.render()
  const footer=flat(h.tree).find(x=>x.type==='DialogFooter'),buttons=flat(footer).filter(x=>x.type==='Button')
  assert.equal(text(buttons[0]),'Close');assert.equal(buttons[0].props.disabled,true)
  assert.equal(text(buttons[1]),'Saving…');assert.equal(buttons[1].props.disabled,true)
  if(flag!=='true'){
    const accepted=await saved(baseline,flag),other=deferred();accepted.api.saveTemplate=()=>other.promise;accepted.name('Another owned draft')
    const acceptedTask=accepted.save();accepted.render();assert.equal(rendered(h.tree),rendered(accepted.tree));assert.equal(JSON.stringify(h.events),JSON.stringify(accepted.events))
    other.resolve(null);await acceptedTask
  }
  d.resolve(null);await task;h.render()
})
console.log(`${checks} actual Save observation/read/watch recovery checks passed; supplied offline responses and virtual timers only.`)
