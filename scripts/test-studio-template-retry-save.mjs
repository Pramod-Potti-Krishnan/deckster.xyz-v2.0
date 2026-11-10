import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Actual transpiled leaf and readiness helpers. The sole test-only injection
// exposes the two existing internal handlers; their bodies/JSX remain intact.
// Deferred results are supplied local values, never a service acknowledgement.
const root = new URL('../', import.meta.url)
const file = 'components/template-save-dialog.tsx'
const source = fs.readFileSync(new URL(file, root), 'utf8')
const baseline = execFileSync('git', ['show', `4cf83ce:${file}`], { cwd: root, encoding: 'utf8' })
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
function harness(code = source, flag) {
  if (arguments.length < 2) flag = 'true'
  const slots = [], effects = [], events = [], watchers = []
  let cursor = 0, writes = 0, props, tree
  const api = { loading: false, saveTemplate: async () => ready, reoptimizeTemplate: async () => queued, getTemplate: async () => ready }
  const react = {
    Fragment: 'Fragment',
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: initial }; return [slots[i].value, value => { writes++; slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useCallback(callback) { return callback },
    useEffect(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v,j) => v !== old.deps[j])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, effect: callback, cleanup: callback() } }) },
  }
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': Object.fromEntries(['AlertTriangle','CheckCircle2','Loader2','RotateCw'].map(x => [x,x])),
    '@/components/ui/dialog': Object.fromEntries(['Dialog','DialogContent','DialogDescription','DialogFooter','DialogHeader','DialogTitle'].map(x => [x,x])),
    '@/components/ui/button': { Button: 'Button' }, '@/components/ui/input': { Input: 'Input' }, '@/components/ui/label': { Label: 'Label' },
    './studio-editor-dialogs.css': {}, './studio-template-flows.css': {},
    '@/lib/template-retry-acknowledgement': retryModule.exports,
    '@/hooks/use-toast': { useToast: () => ({ toast: value => events.push(['toast',value.title,value.description]) }) },
    '@/hooks/use-templates': {
      ...helperModule.exports,
      useTemplates: () => ({ loading: api.loading,
        saveTemplate: value => { events.push(['save', { ...value }]); return api.saveTemplate(value) },
        getTemplate: id => { events.push(['read',id]); return api.getTemplate(id) },
        reoptimizeTemplate: id => { events.push(['retry',id]); return api.reoptimizeTemplate(id) },
        watchTemplateStatus: (id, callbacks) => { const watch = { id, callbacks, stopped: false }; watchers.push(watch); events.push(['watch',id]); return () => { watch.stopped = true; events.push(['stop',id]) } },
      }),
    },
  }
  const mod = { exports: {} }, context = {
    module: mod, exports: mod.exports, Error, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } },
    fetch: () => assert.fail('No requests allowed'), require: id => { assert.ok(id in dependencies,id); return dependencies[id] },
  }
  const injection = '\n  globalThis.__handlers = { handleSave, handleRetryOptimization, handleRefreshStatus: typeof handleRefreshStatus === "undefined" ? null : handleRefreshStatus }; globalThis.__state = { trackedTemplate, studioRetryDiagnostics: typeof studioRetryDiagnostics === "undefined" ? null : studioRetryDiagnostics }\n'
  const point = '\n  return (\n    <Dialog'
  assert.equal(code.split(point).length, 2)
  vm.runInNewContext(compile(code.replace(point, injection + point)), context)
  const defaultProps = { open: true, sessionId: 'session-A', sourcePresentationId: 'presentation-A', deckOwnerSessionId: 'owner-native',
    onSavedTemplate: result => events.push(['promote',result.id]), onTemplateOptimizationFailed: id => events.push(['failed',id]), onOpenChange: open => events.push(['close',open]) }
  const h = {
    api, events, watchers,
    render(next = props || defaultProps) { props = next; cursor = 0; tree = mod.exports.TemplateSaveDialog(props); while (effects.length) effects.shift()(); return tree },
    name(value) { flat(tree).find(x => x.type === 'Input').props.onChange({ target: { value } }); h.render(); return h },
    save() { return context.__handlers.handleSave() }, retry() { return context.__handlers.handleRetryOptimization() }, refresh() { return context.__handlers.handleRefreshStatus() },
    get tracked() { return context.__state.trackedTemplate }, get diagnostics() { return context.__state.studioRetryDiagnostics }, get handler() { return context.__handlers.handleSave }, get props() { return props }, get tree() { return tree }, get writes() { return writes },
    get nameValue() { return flat(tree).find(x => x.type === 'Input').props.value },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
    remountEffects() { for (const slot of slots) if (slot?.effect) slot.cleanup = slot.effect() },
  }
  h.render(); return h
}
const initial = { ...failed, blueprint_enriched_at: 'old-enriched', template_purity_status: 'failed', template_purity_error: 'Exact purity refusal END', template_purified_at: 'old-purified' }
const fields = ['blueprint_enrichment_status','blueprint_enrichment_error','blueprint_enriched_at','template_purity_status','template_purity_error','template_purified_at']
async function saved(template = initial, flag, code = source) {
  if (arguments.length < 2) flag = 'true'
  const h = harness(code, flag); h.api.saveTemplate = async () => template; h.name('Owned'); await h.save(); h.render(); h.events.length = 0; return h
}
const rendered = tree => JSON.stringify(tree, (key, value) => key === 'children' && Array.isArray(value) ? value.filter(child => child !== false && child !== null && child !== undefined) : value)
const statuses = h => flat(h.tree).filter(x => x.props?.['data-template-status']).map(x => x.props['data-template-status'])
for (const response of [
  { id: initial.id },
  { id: initial.id, blueprint_enrichment_status: 'queued' },
  { id: initial.id, blueprint_enrichment_status: null, blueprint_enrichment_error: null, blueprint_enriched_at: null, template_purity_status: null, template_purity_error: null, template_purified_at: null },
  { id: initial.id, blueprint_enrichment_status: 'failed', blueprint_enrichment_error: 'New exact failure', template_purity_status: 'failed', template_purity_error: 'New exact purity failure' },
  { id: initial.id, blueprint_enrichment_status: 'queued', blueprint_enrichment_error: null, template_purity_status: 'pending', template_purity_error: null },
  { id: initial.id, blueprint_enrichment_status: 'complete', template_purity_status: 'clean' },
]) await check(`Actual Studio acknowledgement retains exact null/omitted fields: ${JSON.stringify(response)}`, async () => {
  const h = await saved(); h.api.reoptimizeTemplate = async () => response; await h.retry(); h.render()
  for (const field of fields) assert.equal(h.tracked[field], Object.hasOwn(response, field) ? response[field] : initial[field])
  assert.equal(h.tracked.id, initial.id); assert.equal(h.tracked.name, initial.name)
  assert.equal(statuses(h)[0], helperModule.exports.templateGenerationStatus(h.tracked))
  assert.ok(h.events.some(x => x[0] === 'toast' && x[1] === 'Retry requested'))
  assert.equal(h.events.some(x => x[0] === 'toast' && x[1] === 'Optimizing template'), false)
  assert.equal(h.events.some(x => x[0] === 'promote'), false)
  assert.match(text(h.tree), /Previous optimization errors/)
  assert.match(text(h.tree), /Exact optimization refusal END/); assert.match(text(h.tree), /Exact purity refusal END/)
  const ready = helperModule.exports.isTemplateGenerationReady(h.tracked)
  assert.equal(ready, response.blueprint_enrichment_status === 'complete' && response.template_purity_status === 'clean')
})
await check('Error history survives explicit authoritative nulls and later queued/running snapshots', async () => {
  const h = await saved(); h.api.reoptimizeTemplate = async () => ({ id: initial.id, blueprint_enrichment_status: 'queued', blueprint_enrichment_error: null, template_purity_status: 'pending', template_purity_error: null })
  await h.retry(); h.render(); assert.equal(h.tracked.blueprint_enrichment_error, null); assert.equal(h.tracked.template_purity_error, null)
  const watch = h.watchers.at(-1); assert.ok(watch)
  watch.callbacks.onUpdate({ ...queued, blueprint_enrichment_status: 'running', blueprint_enrichment_error: null, template_purity_error: null }); h.render()
  assert.match(text(h.tree), /Exact optimization refusal END/); assert.match(text(h.tree), /Exact purity refusal END/)
  assert.equal(h.events.some(x => x[0] === 'promote'), false)
})
for (const response of [null, {}, { id: '' }, { id: 'template-B', blueprint_enrichment_status: 'queued' }]) await check(`Unverifiable retry leaves acknowledged template/watch untouched: ${JSON.stringify(response)}`, async () => {
  const h = await saved(); const before = JSON.stringify(h.tracked); const beforeWatch = h.watchers.length
  h.api.reoptimizeTemplate = async () => response; await h.retry(); h.render()
  assert.equal(JSON.stringify(h.tracked), before); assert.equal(h.watchers.length, beforeWatch)
  assert.equal(h.events.some(x => x[0] === 'promote'), false); assert.equal(h.events.some(x => x[1] === 'Retry requested'), false)
  assert.equal(h.diagnostics, null)
})
for (const boundary of ['source','roundtrip','unmount','remount']) await check(`Late retry reply cannot change another source/mount: ${boundary}`, async () => {
  const h = await saved(), props = h.props, d = deferred(); h.api.reoptimizeTemplate = () => d.promise; const task = h.retry(); await h.retry()
  assert.equal(h.events.filter(x => x[0] === 'retry').length, 1)
  if (boundary === 'unmount' || boundary === 'remount') { h.unmount(); if (boundary === 'remount') h.remountEffects() }
  else { h.render({ ...props, sourcePresentationId: 'presentation-B' }); if (boundary === 'roundtrip') h.render(props) }
  const beforeWrites = h.writes, beforeEvents = JSON.stringify(h.events)
  d.resolve({ id: initial.id, blueprint_enrichment_status: 'queued', template_purity_status: 'pending' }); await task
  assert.equal(h.writes, beforeWrites); assert.equal(JSON.stringify(h.events), beforeEvents)
})
await check('Ordinary close preserves an acknowledged retry watcher and latest callbacks', async () => {
  const h = await saved(); h.api.reoptimizeTemplate = async () => ({ id: initial.id, blueprint_enrichment_status: 'queued', template_purity_status: 'pending' }); await h.retry(); h.render()
  const watch = h.watchers.at(-1); assert.ok(watch); const before = h.events.length
  h.render({ ...h.props, open: false, onSavedTemplate: next => h.events.push(['latest-promote', next.id]) })
  assert.equal(watch.stopped, false); watch.callbacks.onUpdate(ready); watch.callbacks.onReady(ready); h.render()
  assert.ok(h.events.slice(before).some(x => x[0] === 'latest-promote')); assert.match(text(h.tree), /Ready to reuse/)
})
await check('Source change stops retry watch, hides old diagnostics and fences late callbacks', async () => {
  const h = await saved(); h.api.reoptimizeTemplate = async () => ({ id: initial.id, blueprint_enrichment_status: 'queued', template_purity_status: 'pending' }); await h.retry(); h.render()
  const watch = h.watchers.at(-1); h.render({ ...h.props, sessionId: 'session-B', sourcePresentationId: 'presentation-B' })
  assert.equal(watch.stopped, true); assert.doesNotMatch(text(h.tree), /Previous optimization errors/)
  const writes = h.writes, events = JSON.stringify(h.events)
  watch.callbacks.onUpdate(ready); watch.callbacks.onReady(ready); watch.callbacks.onFailed(initial, 'failed'); watch.callbacks.onTimeout()
  assert.equal(h.writes, writes); assert.equal(JSON.stringify(h.events), events)
})
await check('Failed retry attempt retains an already acknowledged watcher', async () => {
  const h = await saved(); h.api.reoptimizeTemplate = async () => ({ id: initial.id, blueprint_enrichment_status: 'queued', template_purity_status: 'pending' }); await h.retry(); h.render()
  const watch = h.watchers.at(-1); h.api.reoptimizeTemplate = async () => null; await h.retry(); h.render()
  assert.equal(watch.stopped, false); watch.callbacks.onUpdate(ready); watch.callbacks.onReady(ready); h.render(); assert.match(text(h.tree), /Ready to reuse/)
})
await check('Timeout retains authoritative status/history and matching GET can recover', async () => {
  const h = await saved(); h.api.reoptimizeTemplate = async () => ({ id: initial.id, blueprint_enrichment_status: 'queued', template_purity_status: 'pending', blueprint_enrichment_error: null, template_purity_error: null }); await h.retry(); h.render()
  const watch = h.watchers.at(-1), before = JSON.stringify(h.tracked); watch.callbacks.onTimeout(); h.render()
  assert.equal(JSON.stringify(h.tracked), before); assert.match(text(h.tree), /Previous optimization errors/)
  assert.equal(h.events.some(x => x[0] === 'promote'), false); assert.equal(watch.stopped,true); assert.match(text(h.tree), /Status updates paused/)
  const writes=h.writes,events=JSON.stringify(h.events); watch.callbacks.onUpdate(initial); watch.callbacks.onFailed(initial,'failed'); h.render()
  assert.equal(h.writes,writes); assert.equal(JSON.stringify(h.events),events)
  const retryCount=h.events.filter(x=>x[0]==='retry').length; h.api.getTemplate=async()=>ready; await h.refresh();h.render()
  assert.equal(h.events.filter(x=>x[0]==='retry').length,retryCount); assert.ok(h.events.some(x=>x[0]==='read'&&x[1]===initial.id))
  assert.match(text(h.tree),/Ready to reuse/); assert.doesNotMatch(text(h.tree),/Status updates paused/);assert.match(text(h.tree),/Previous optimization errors/)
})
await check('Acknowledged watcher rejects missing/mismatched IDs and exposes truthful terminal pause', async () => {
  for (const id of [undefined,'','template-B']) for (const outcome of ['onUpdate','onReady','onFailed']) {
    const h=await saved();h.api.reoptimizeTemplate=async()=>({id:initial.id,blueprint_enrichment_status:'queued',template_purity_status:'pending'});await h.retry();h.render()
    const watch=h.watchers.at(-1),writes=h.writes,tracked=JSON.stringify(h.tracked),events=JSON.stringify(h.events)
    watch.callbacks[outcome]({...ready,id},'failed');h.render();assert.equal(JSON.stringify(h.tracked),tracked)
    if(outcome==='onUpdate'){assert.equal(h.writes,writes);assert.equal(JSON.stringify(h.events),events)}
    else {assert.equal(watch.stopped,true);assert.match(text(h.tree),/Status updates paused/);assert.equal(h.events.some(x=>['promote','failed'].includes(x[0])),false)}
    const pausedWrites=h.writes,pausedEvents=JSON.stringify(h.events);watch.callbacks.onUpdate(ready);if(outcome!=='onUpdate') {watch.callbacks.onReady(ready);watch.callbacks.onFailed(initial,'failed');watch.callbacks.onTimeout();assert.equal(h.writes,pausedWrites);assert.equal(JSON.stringify(h.events),pausedEvents)}
  }
})
await check('Studio readiness callback cannot bypass exact llm complete clean and pauses unverified observation', async () => {
  for (const invalid of [queued,{...ready,template_purity_status:'pending'},{...ready,blueprint_generation_method:'deterministic_fallback'},{...ready,blueprint_enrichment_status:null}]) {
    const h=await saved();h.api.reoptimizeTemplate=async()=>({id:initial.id,blueprint_enrichment_status:'queued',template_purity_status:'pending'});await h.retry();h.render()
    const watch=h.watchers.at(-1),tracked=JSON.stringify(h.tracked);watch.callbacks.onReady(invalid);h.render()
    assert.equal(JSON.stringify(h.tracked),tracked);assert.equal(watch.stopped,true);assert.match(text(h.tree),/Status updates paused/)
    assert.equal(h.events.some(x=>['promote','failed'].includes(x[0])),false)
  }
})
for (const flag of [undefined, 'false', 'TRUE', '1']) await check(`Classic exact rendered retry/watch path: ${String(flag)}`, async () => {
  for (const response of [null, { id: initial.id }, { id: initial.id, blueprint_enrichment_status: null, template_purity_status: null }, { id: 'template-B', blueprint_enrichment_status: 'queued' }]) {
    const a = await saved(initial, flag), b = await saved(initial, flag, baseline)
    a.api.reoptimizeTemplate = b.api.reoptimizeTemplate = async () => response
    await a.retry(); await b.retry(); a.render(); b.render()
    assert.equal(rendered(a.tree), rendered(b.tree)); assert.equal(JSON.stringify(a.events), JSON.stringify(b.events))
  }
})
// Actual hook watcher with supplied responses and a deterministic local clock.
function actualWatch() {
  const timers = new Map(), requests = [], responses = [], events = []
  let sequence = 0
  const react = { useState: initial => [initial, () => {}], useCallback: fn => fn }
  const module = { exports: {} }
  vm.runInNewContext(compile(fs.readFileSync(new URL('hooks/use-templates.ts', root), 'utf8')), {
    module, exports: module.exports, Error,
    require: name => { assert.equal(name, 'react'); return react },
    fetch: async (url, options) => { requests.push([url, options]); const item = responses.shift(); const value = item?.promise ? await item.promise : item; return { ok: value !== null, status: value === null ? 503 : 200, json: async () => value ?? { error: 'Supplied offline failure' } } },
    setTimeout: fn => { const id = ++sequence; timers.set(id, fn); return id }, clearTimeout: id => timers.delete(id),
  })
  const hook = module.exports.useTemplates()
  const start = maxAttempts => hook.watchTemplateStatus(initial.id, { maxAttempts, intervalMs: 1, onUpdate: s => events.push(['update', s]), onReady: s => events.push(['ready', s]), onFailed: (s,status) => events.push(['failed', s,status]), onTimeout: s => events.push(['timeout', s]) })
  const tick = async () => { const entry = timers.entries().next().value; assert.ok(entry); timers.delete(entry[0]); entry[1](); for(let i=0;i<8;i++)await Promise.resolve() }
  return { responses, events, requests, start, tick, timers }
}
await check('Actual watch requires exact llm complete clean before readiness; timeout remains bounded', async () => {
  const h = actualWatch(); h.responses.push({ ...queued, template_purity_status: 'pending' }, { ...ready, blueprint_generation_method: 'deterministic_fallback' }); h.start(2)
  await h.tick(); assert.equal(h.events.some(x => x[0] === 'ready'), false)
  await h.tick(); assert.equal(h.events.some(x => x[0] === 'ready'), false); assert.ok(h.events.some(x => x[0] === 'timeout')); assert.equal(h.timers.size, 0)
})
await check('Actual watch readiness stops its timer only on exact ready response', async () => {
  const h = actualWatch(); h.responses.push(queued, ready); h.start(3); await h.tick(); await h.tick()
  assert.deepEqual(h.events.map(x => x[0]), ['update','update','ready']); assert.equal(h.timers.size, 0)
})
await check('Actual watch cancellation before queued timer prevents any request', async () => {
  const h = actualWatch(); const stop = h.start(2); stop(); assert.equal(h.timers.size, 0); assert.equal(h.requests.length, 0)
})
await check('Actual watch cancellation during its read suppresses the late ready result', async () => {
  const h = actualWatch(), d = deferred(); h.responses.push(d); const stop = h.start(2); await h.tick(); assert.equal(h.requests.length, 1); stop()
  d.resolve(ready); for(let i=0;i<12;i++)await Promise.resolve()
  assert.equal(h.events.length, 0); assert.equal(h.timers.size, 0)
})
console.log(`${checks} actual Save retry field/owner/classic/watch checks passed; supplied offline responses only.`)
