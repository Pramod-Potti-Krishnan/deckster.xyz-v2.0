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
const baseline = execFileSync('git', ['show', `d7e8c8f:${file}`], { cwd: root, encoding: 'utf8' })
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
const retryModule = { exports: {} }
vm.runInNewContext(compile(fs.readFileSync(new URL('lib/template-retry-acknowledgement.ts', root), 'utf8')), { module: retryModule, exports: retryModule.exports })
const ready = { id: 'template-A', name: 'Template A', slide_count: 4, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' }
const queued = { ...ready, blueprint_enrichment_status: 'queued', template_purity_status: 'pending' }
const failed = { ...ready, blueprint_enrichment_status: 'failed', blueprint_enrichment_error: 'Exact optimization refusal END' }
let checks = 0
function harness(code = source, flag) {
  if (arguments.length < 2) flag = 'true'
  const slots = [], effects = [], events = [], watchers = []
  let cursor = 0, writes = 0, props, tree
  const api = { loading: false, saveTemplate: async () => ready, reoptimizeTemplate: async () => queued }
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
        reoptimizeTemplate: id => { events.push(['retry',id]); return api.reoptimizeTemplate(id) },
        watchTemplateStatus: (id, callbacks) => { const watch = { id, callbacks, stopped: false }; watchers.push(watch); events.push(['watch',id]); return () => { watch.stopped = true; events.push(['stop',id]) } },
      }),
    },
  }
  const mod = { exports: {} }, context = {
    module: mod, exports: mod.exports, Error, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } },
    fetch: () => assert.fail('No requests allowed'), require: id => { assert.ok(id in dependencies,id); return dependencies[id] },
  }
  const injection = '\n  globalThis.__handlers = { handleSave, handleRetryOptimization }\n'
  const point = '\n  return (\n    <Dialog'
  assert.equal(code.split(point).length, 2)
  vm.runInNewContext(compile(code.replace(point, injection + point)), context)
  const defaultProps = { open: true, sessionId: 'session-A', sourcePresentationId: 'presentation-A', deckOwnerSessionId: 'owner-native',
    onSavedTemplate: result => events.push(['promote',result.id]), onTemplateOptimizationFailed: id => events.push(['failed',id]), onOpenChange: open => events.push(['close',open]) }
  const h = {
    api, events, watchers,
    render(next = props || defaultProps) { props = next; cursor = 0; tree = mod.exports.TemplateSaveDialog(props); while (effects.length) effects.shift()(); return tree },
    name(value) { flat(tree).find(x => x.type === 'Input').props.onChange({ target: { value } }); h.render(); return h },
    save() { return context.__handlers.handleSave() }, retry() { return context.__handlers.handleRetryOptimization() },
    get handler() { return context.__handlers.handleSave }, get props() { return props }, get tree() { return tree }, get writes() { return writes },
    get nameValue() { return flat(tree).find(x => x.type === 'Input').props.value },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
    remountEffects() { for (const slot of slots) if (slot?.effect) slot.cleanup = slot.effect() },
  }
  h.render(); return h
}
const actions = h => h.events.filter(x => ['promote','failed','toast','close','watch'].includes(x[0]))

// Exact classic source after removal of only the explicit ownership additions.
assert.equal(source.split("loading && !(STUDIO_TEMPLATE_FLOW && visibleStudioObservation?.status === 'refreshing')").length - 1, 2)
// The separately exercised fullscreen wrapper prop changes placement only.
// Reverse that exact one attribute before retaining the original whole-leaf
// ownership/options comparison; all behavioral cases still execute source.
const fullscreenPortal = "portalContainer={STUDIO_TEMPLATE_FLOW && open && typeof document !== 'undefined' ? document.fullscreenElement : undefined} "
assert.equal(source.split(fullscreenPortal).length - 1, 1)
let restored = source.replace(fullscreenPortal, '')
  .replaceAll("loading && !(STUDIO_TEMPLATE_FLOW && visibleStudioObservation?.status === 'refreshing')", 'loading')
  .replace('saveTemplate, getTemplate, loading', 'saveTemplate, loading')
  .replace(/  const handleRefreshStatus = async \(\) => \{[\s\S]*?\n  const handleRetryOptimization =/, '  const handleRetryOptimization =')
  .replace(/        if \(STUDIO_TEMPLATE_FLOW && snapshot\?\.id !== template.id\) \{\n          pauseStudioObservation\(studioWatch!, template.id, 'mismatch'\)\n          return\n        \}/g, '        if (STUDIO_TEMPLATE_FLOW && snapshot?.id !== template.id) return')
  .replace(/        if \(STUDIO_TEMPLATE_FLOW && !isTemplateGenerationReady\(snapshot\)\) \{\n          pauseStudioObservation\(studioWatch!, template.id, 'unverified'\)\n          return\n        \}/, '        if (STUDIO_TEMPLATE_FLOW && !isTemplateGenerationReady(snapshot)) return')
  .replace(/^    if \(STUDIO_TEMPLATE_FLOW\) updateStudioObservation\(null\)\n/m, '')
  .replace(/^        if \(STUDIO_TEMPLATE_FLOW && isCurrentStudioWatch\(studioWatch!\)\) studioWatchRef.current = null\n/gm, '')
  .replace(/        if \(STUDIO_TEMPLATE_FLOW\) \{\n          pauseStudioObservation\(studioWatch!, template.id, 'timeout'\)\n          return\n        \}\n/, '')
  .replace(/              \{visibleStudioObservation && \([\s\S]*?                <\/div>\n              \)\}\n/, '')
  .replace('ref={STUDIO_TEMPLATE_FLOW ? studioReadinessRef : undefined} tabIndex={STUDIO_TEMPLATE_FLOW ? -1 : undefined} ', '')
  .replace(/className=\{`(studio-template-flow-readiness[^`]*?)\$\{STUDIO_TEMPLATE_FLOW \? ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' : ''\}`\}/, 'className="$1"')
  .replace("(visibleStudioObservation || templateGenerationStatus(visibleTrackedTemplate) === 'needs_optimization')", "templateGenerationStatus(visibleTrackedTemplate) === 'needs_optimization'")
  .replace("visibleStudioObservation ? 'Last verified status: ' + (templateGenerationStatus(visibleTrackedTemplate) === 'needs_optimization' ? 'needs optimization' : 'optimization incomplete') : ", '')
  .replace("import { mergeTemplateRetryAcknowledgement } from '@/lib/template-retry-acknowledgement'\n", '')
  .replace(/    if \(STUDIO_TEMPLATE_FLOW\) \{\n      const acknowledgement = mergeTemplateRetryAcknowledgement[\s\S]*?\n    \}\n    const next = \{/, '    const next = {')
  .replace(/              \{STUDIO_TEMPLATE_FLOW && studioRetryDiagnostics\?\.owner[\s\S]*?<\/details>\n              \)\}\n/, '')
  .replace(/  \/\/ Studio ownership[\s\S]*?  const startStatusPolling =/, '  const startStatusPolling =')
  .replace(/^    const studioRequest = studioRequestRef.current\n/m, '')
  .replace(/^    const studioWatch = STUDIO_TEMPLATE_FLOW[^\n]*\n/m, '')
  .replace(/^    if \(STUDIO_TEMPLATE_FLOW\) studioWatchRef.current[^\n]*\n/m, '')
  .replace(/^\s*if \(STUDIO_TEMPLATE_FLOW &&[^\n]*\) return\n/gm, '')
  .replace(/^    if \(STUDIO_TEMPLATE_FLOW\) studioTrackedOwnerRef.current[^\n]*\n/m, '')
  .replace(/^    if \(STUDIO_TEMPLATE_FLOW\) studioPollingOwnerRef.current[^\n]*\n/m, '')
  .replace(/        if \(STUDIO_TEMPLATE_FLOW\) studioCallbacksRef.current.onSavedTemplate\?\.\(next\)\n        else onSavedTemplate\?\.\(next\)/, '        onSavedTemplate?.(next)')
  .replace(/        if \(STUDIO_TEMPLATE_FLOW\) studioCallbacksRef.current.onTemplateOptimizationFailed\?\.\(next.id\)\n        else onTemplateOptimizationFailed\?\.\(next.id\)/, '        onTemplateOptimizationFailed?.(next.id)')
  .replaceAll(';(STUDIO_TEMPLATE_FLOW ? studioCallbacksRef.current.toast : toast)', 'toast')
  .replace(/    const studioRequest = STUDIO_TEMPLATE_FLOW \? beginStudioRequest\(\) : null\n/g, '')
  .replace(/    let result: Awaited<ReturnType<typeof reoptimizeTemplate>>[\s\S]*?    if \(!result\)/, '    const result = await reoptimizeTemplate(trackedTemplate.id)\n    if (!result)')
  .replace(/    let result: Awaited<ReturnType<typeof saveTemplate>>[\s\S]*?    if \(result\)/, `    const result = await saveTemplate({\n      name: trimmed,\n      sourceSessionId: sessionId,\n      sourcePresentationId,\n    })\n    if (result)`)
  .replace(/      if \(generationReady\) \{[\s\S]*?      \}/, '      if (generationReady) onSavedTemplate?.(result)')
  .replace(/      if \(STUDIO_TEMPLATE_FLOW\) studioCallbacksRef.current.onOpenChange\(false\)\n      else onOpenChange\(false\)/, '      onOpenChange(false)')
  .replaceAll('visibleTrackedTemplate', 'trackedTemplate')
assert.equal(canonical(restored), canonical(baseline), 'Exact baseline options, copy, gates, callbacks and classic body'); checks++

// Reproduce the original stale success, not an invented expected defect.
for (const change of ['source','unmount']) {
  const h = harness(baseline), d = deferred(); h.api.saveTemplate = () => d.promise; h.name('A'); const task = h.save()
  if (change === 'unmount') h.unmount(); else h.render({ ...h.props, sessionId: 'session-B', sourcePresentationId: 'presentation-B' })
  d.resolve(ready); await task
  assert.ok(actions(h).some(x => x[0] === 'promote')); assert.ok(actions(h).some(x => x[0] === 'close')); checks++
}
// Original queued save also registers a watcher after unmount; correction
// must fence before registration, not merely cancel an already-live timer.
{
  const h = harness(baseline), d = deferred(); h.name('A'); h.api.saveTemplate = () => d.promise
  const task = h.save(); h.unmount(); d.resolve(queued); await task
  assert.equal(h.watchers.length,1); assert.equal(h.watchers[0].stopped,false); checks++
}
for (const flag of [undefined,'false','TRUE','1']) {
  for (const result of [ready,queued,failed,null]) {
    const a = harness(source,flag), b = harness(baseline,flag)
    a.api.saveTemplate = b.api.saveTemplate = async () => result
    a.name(' Native name '); b.name(' Native name '); await a.save(); await b.save(); a.render(); b.render()
    assert.deepEqual(a.events,b.events)
    const snap = value => JSON.stringify(value,(k,v) => typeof v === 'function' ? '[callback]' : k === 'children' && Array.isArray(v) ? v.filter(child => child !== false && child !== null && child !== undefined) : v)
    assert.equal(snap(a.tree),snap(b.tree)); checks++
  }
  const error = new Error('Classic thrown hook remains rejected'), h = harness(source,flag)
  h.name('Classic'); h.api.saveTemplate = async () => { throw error }; await assert.rejects(h.save(),e => e === error); checks++
}
for (const result of [ready,queued,failed,null,'throw']) {
  const h = harness(); h.name(' Native name '); h.api.saveTemplate = async () => { if (result === 'throw') throw 'Exact unexpected hook throw'; return result }
  await h.save(); h.render()
  assert.deepEqual(h.events[0], ['save',{ name: 'Native name', sourceSessionId: 'session-A', sourcePresentationId: 'presentation-A' }])
  if (result && result !== 'throw') {
    assert.equal(h.nameValue,''); assert.ok(actions(h).some(x => x[0] === 'close'))
    assert.equal(h.watchers.length,result === queued ? 1 : 0)
    assert.equal(actions(h).filter(x => x[0] === 'promote').length,result === ready ? 1 : 0)
  } else { assert.equal(h.nameValue,' Native name '); assert.equal(actions(h)[0][1],'Could not save template') }
  checks++
}
for (const missing of ['name','sessionId','sourcePresentationId']) {
  const h = harness(); h.name(missing === 'name' ? '  ' : 'A'); if (missing !== 'name') h.render({ ...h.props,[missing]:null })
  await h.save(); assert.equal(h.events.filter(x => x[0] === 'save').length,0); assert.equal(actions(h).length,1); checks++
}
for (const change of ['session','presentation','roundtrip','unmount','mount-epoch']) for (const result of [ready,queued,null,'throw']) {
  const h = harness(), d = deferred(); h.name('A'); h.api.saveTemplate = () => d.promise; const oldHandler = h.handler, task = oldHandler()
  const oldProps = h.props
  if (change === 'unmount' || change === 'mount-epoch') { h.unmount(); if (change === 'mount-epoch') h.remountEffects() }
  else {
    h.render({ ...oldProps, ...(change === 'presentation' ? { sourcePresentationId:'presentation-B' } : { sessionId:'session-B' }) })
    if (change === 'roundtrip') h.render(oldProps)
    h.name('B separate draft')
    await oldHandler(); assert.equal(h.events.filter(x => x[0] === 'save').length,1)
  }
  const writes = h.writes
  result === 'throw' ? d.reject(new Error('Late refusal')) : d.resolve(result); await task
  assert.deepEqual(actions(h),[]); assert.equal(h.writes,writes)
  if (change !== 'unmount' && change !== 'mount-epoch') { h.render(); assert.equal(h.nameValue,'B separate draft'); assert.doesNotMatch(text(h.tree),/Template A/) }
  checks++
}
// A later source request may finish before A; A cannot reset/promote/watch B.
{
  const h = harness(), a = deferred(), b = deferred(); h.name('A'); h.api.saveTemplate = () => a.promise; const first = h.save()
  await h.save(); assert.equal(h.events.filter(x => x[0] === 'save').length,1)
  h.render({ ...h.props,sessionId:'session-B' }); h.name('B'); h.api.saveTemplate = () => b.promise; const second = h.save()
  b.resolve({ ...queued,id:'template-B',name:'Template B' }); await second; h.render(); h.name('B new draft'); const before = JSON.stringify(actions(h)), writes = h.writes
  a.resolve(ready); await first; h.render(); assert.equal(JSON.stringify(actions(h)),before); assert.equal(h.writes,writes); assert.equal(h.nameValue,'B new draft'); checks++
}
// Normal close is deliberately NOT a source epoch change. All real watcher
// outcomes still flow to the latest same-source callbacks after closing.
for (const outcome of ['onUpdate','onReady','onFailed','onTimeout']) {
  const h = harness(); h.api.saveTemplate = async () => queued; h.name('A'); await h.save(); h.render({ ...h.props,open:false })
  const watch = h.watchers[0]; assert.equal(watch.stopped,false)
  h.events.length = 0
  h.render({ ...h.props,onSavedTemplate:r => h.events.push(['new-promote',r.id]),onTemplateOptimizationFailed:id => h.events.push(['new-failed',id]),onOpenChange:o => h.events.push(['new-close',o]) })
  if (outcome === 'onTimeout') watch.callbacks[outcome]()
  else watch.callbacks[outcome](outcome === 'onFailed' ? failed : ready,'failed')
  h.render()
  if (outcome === 'onReady') assert.ok(h.events.some(x => x[0] === 'new-promote'))
  if (outcome === 'onFailed') { assert.ok(h.events.some(x => x[0] === 'new-failed')); assert.match(h.events.find(x => x[0] === 'toast')[2],/Exact optimization refusal END/) }
  if (outcome === 'onUpdate') assert.match(text(h.tree),/Ready to reuse/)
  if (outcome === 'onTimeout') { assert.equal(watch.stopped,true); assert.match(text(h.tree),/Status updates paused/); assert.equal(h.events.some(x => x[0] === 'toast' && x[1] === 'Template still optimizing'),false) }
  checks++
}
for (const change of ['source','roundtrip','unmount','replacement']) {
  const h = harness(); h.api.saveTemplate = async () => queued; h.name('A'); await h.save(); h.render(); const old = h.watchers[0], oldProps = h.props
  if (change === 'unmount') h.unmount()
  else if (change === 'replacement') { h.name('Next template'); h.api.saveTemplate = async () => failed; await h.save(); h.render() }
  else { h.render({ ...oldProps, sourcePresentationId:'presentation-B' }); if (change === 'roundtrip') h.render(oldProps) }
  assert.equal(old.stopped,true); const before = JSON.stringify(h.events), writes = h.writes
  old.callbacks.onUpdate(ready); old.callbacks.onReady(ready); old.callbacks.onFailed(failed,'failed'); old.callbacks.onTimeout()
  assert.equal(JSON.stringify(h.events),before); assert.equal(h.writes,writes); checks++
}
for (const change of ['none','source','unmount']) for (const result of [queued,null,'throw']) {
  const h = harness(); h.api.saveTemplate = async () => failed; h.name('A'); await h.save(); h.render(); h.events.length = 0
  const d = deferred(); h.api.reoptimizeTemplate = () => d.promise; const task = h.retry(); await h.retry(); assert.equal(h.events.filter(x => x[0] === 'retry').length,1)
  if (change === 'source') h.render({ ...h.props,sessionId:'session-B' }); if (change === 'unmount') h.unmount()
  result === 'throw' ? d.reject('Retry exception') : d.resolve(result); await task
  assert.equal(actions(h).length, change === 'none' ? result === queued ? 2 : 1 : 0)
  if (change === 'none' && result === queued) { h.render(); assert.match(text(h.tree),/Optimizing template/); assert.equal(h.watchers.length,1) }
  checks++
}
// Latest completion callbacks; parent callback changing source/unmounting fences
// the remaining effects of that completion (without claiming the save vanished).
for (const boundary of ['callback-swap','parent-source','parent-unmount']) {
  const h = harness(), d = deferred(); h.name('A'); h.api.saveTemplate = () => d.promise; const task = h.save()
  h.render({ ...h.props,onSavedTemplate:r => { h.events.push(['latest-promote',r.id]); if (boundary === 'parent-source') h.render({ ...h.props,sessionId:'session-B' }); if (boundary === 'parent-unmount') h.unmount() },onOpenChange:o => h.events.push(['latest-close',o]) })
  d.resolve(ready); await task
  assert.ok(h.events.some(x => x[0] === 'latest-promote'))
  assert.equal(h.events.filter(x => ['toast','close','latest-close','watch'].includes(x[0])).length,boundary === 'callback-swap' ? 2 : 0); checks++
}
// Closing during a valid in-flight save keeps the current acknowledgement path.
{
  const h = harness(), d = deferred(); h.name('A'); h.api.saveTemplate = () => d.promise; const task = h.save()
  h.render({ ...h.props,open:false }); d.resolve(queued); await task
  assert.equal(h.watchers.length,1); assert.equal(h.watchers[0].stopped,false); assert.ok(h.events.some(x => x[0] === 'close')); checks++
}
// Hook loading continues to disable the same native fields/actions; native
// close/Enter wiring remains present, and no owner-session equality is invented.
{
  const h = harness(); h.api.loading = true; h.render()
  assert.equal(flat(h.tree).find(x => x.type === 'Input').props.disabled,true)
  assert.equal(flat(h.tree).filter(x => x.type === 'Button' && !x.props.disabled).length,0)
  h.api.loading = false; h.render({ ...h.props,deckOwnerSessionId:'different-existing-owner' }); h.name('A'); await h.save()
  assert.equal(h.events.filter(x => x[0] === 'save').length,1); checks++
}
// Classic retry result, throw, normal close and all four poll callbacks retain
// exact baseline events. These checks exercise the real classic handler bodies.
for (const flag of [undefined,'false','TRUE','1']) {
  for (const result of [queued,null,'throw']) {
    const a = harness(source,flag), b = harness(baseline,flag)
    for (const h of [a,b]) { h.api.saveTemplate = async () => failed; h.name('A'); await h.save(); h.render(); h.events.length = 0; h.api.reoptimizeTemplate = async () => { if (result === 'throw') throw 'classic-retry-throw'; return result } }
    if (result === 'throw') { await assert.rejects(a.retry(),e => e === 'classic-retry-throw'); await assert.rejects(b.retry(),e => e === 'classic-retry-throw') }
    else { await a.retry(); await b.retry() }
    assert.deepEqual(a.events,b.events); checks++
  }
  const a = harness(source,flag), b = harness(baseline,flag)
  for (const h of [a,b]) {
    h.api.saveTemplate = async () => queued; h.name('A'); await h.save(); h.render({ ...h.props,open:false })
    const w = h.watchers[0]; assert.equal(w.stopped,false)
    w.callbacks.onUpdate(ready); w.callbacks.onReady(ready); w.callbacks.onFailed(failed,'needs_cleanup'); w.callbacks.onTimeout()
  }
  assert.deepEqual(a.events,b.events); checks++
}
// Regression found in 39403df: acknowledged A watching was cancelled merely
// by starting B, so B failing left A permanently optimizing in the frontend.
{
  const prior = execFileSync('git', ['show', '39403df:components/template-save-dialog.tsx'], { cwd: root, encoding: 'utf8' })
  const h = harness(prior); h.api.saveTemplate = async () => queued; h.name('A'); await h.save(); h.render()
  const watch = h.watchers[0]; h.name('B draft'); h.api.saveTemplate = async () => null; await h.save(); h.render()
  assert.equal(watch.stopped,true); watch.callbacks.onReady(ready); h.render()
  assert.match(text(h.tree),/Optimizing template/); assert.doesNotMatch(text(h.tree),/Ready to reuse/); checks++
}
// Failed same-source attempts preserve A's acknowledged watcher, including
// A completing while B remains pending. No restart or fabricated readiness.
for (const outcome of ['null','reject','throw']) for (const completion of ['during','after']) {
  const h = harness(); h.api.saveTemplate = async () => queued; h.name('A'); await h.save(); h.render()
  const watch = h.watchers[0], d = deferred(); h.name('B newer draft')
  h.api.saveTemplate = () => outcome === 'throw' ? (() => { throw new Error('Immediate B rejection') })() : d.promise
  const second = h.save(); assert.equal(watch.stopped,false)
  if (completion === 'during') { watch.callbacks.onUpdate(ready); watch.callbacks.onReady(ready); h.render(); assert.equal(h.nameValue,'B newer draft'); assert.match(text(h.tree),/Ready to reuse/) }
  if (outcome === 'null') d.resolve(null); else if (outcome === 'reject') d.reject(new Error('Deferred B rejection'))
  await second
  if (completion === 'after') { watch.callbacks.onUpdate(ready); watch.callbacks.onReady(ready) }
  h.render(); assert.equal(watch.stopped,false); assert.equal(h.watchers.length,1); assert.match(text(h.tree),/Ready to reuse/)
  assert.equal(h.nameValue,'B newer draft'); assert.equal(h.events.filter(x => x[0] === 'promote').length,1)
  assert.equal(h.events.filter(x => x[0] === 'close').length,1); checks++
}
// Successful replacement, including a terminal acknowledgement, retires A
// only after B has been acknowledged. Late A callbacks cannot overwrite B.
for (const replacement of [ready,queued,failed]) {
  const h = harness(); h.api.saveTemplate = async () => queued; h.name('A'); await h.save(); h.render()
  const a = h.watchers[0], d = deferred(); h.name('B'); h.api.saveTemplate = () => d.promise; const second = h.save()
  assert.equal(a.stopped,false); d.resolve({ ...replacement,id:'template-B',name:'Template B' }); await second; h.render(); h.name('B retained later draft')
  assert.equal(a.stopped,true); const before = JSON.stringify(h.events), writes = h.writes
  a.callbacks.onUpdate(ready); a.callbacks.onReady(ready); a.callbacks.onFailed(failed,'failed'); a.callbacks.onTimeout()
  h.render(); assert.equal(JSON.stringify(h.events),before); assert.equal(h.writes,writes); assert.match(text(h.tree),/Template B/); assert.equal(h.nameValue,'B retained later draft'); checks++
}
// Source/mount retirement still stops acknowledged A while a second B save is
// pending; neither A polling nor B completion may affect the new source.
for (const change of ['source','roundtrip','unmount']) {
  const h = harness(); h.api.saveTemplate = async () => queued; h.name('A'); await h.save(); h.render()
  const a = h.watchers[0], originalProps = h.props, d = deferred(); h.name('B'); h.api.saveTemplate = () => d.promise; const second = h.save()
  if (change === 'unmount') h.unmount()
  else { h.render({ ...originalProps,sessionId:'session-C' }); if (change === 'roundtrip') h.render(originalProps); h.name('Current draft') }
  assert.equal(a.stopped,true); const before = JSON.stringify(h.events), writes = h.writes
  a.callbacks.onUpdate(ready); a.callbacks.onReady(ready); a.callbacks.onFailed(failed,'failed'); a.callbacks.onTimeout(); d.resolve(null); await second
  assert.equal(JSON.stringify(h.events),before); assert.equal(h.writes,writes); checks++
}
// A surviving watcher uses the latest callbacks and continues after normal
// close even after a refused B attempt.
{
  const h = harness(); h.api.saveTemplate = async () => queued; h.name('A'); await h.save(); h.render(); const a = h.watchers[0]
  h.name('B'); h.api.saveTemplate = async () => null; await h.save()
  h.render({ ...h.props,open:false,onSavedTemplate:r => h.events.push(['latest-A-ready',r.id]) }); a.callbacks.onReady(ready); h.render()
  assert.equal(a.stopped,false); assert.ok(h.events.some(x => x[0] === 'latest-A-ready')); assert.equal(h.nameValue,'B'); checks++
}
console.log(`Template save ownership: ${checks} checks passed; actual baseline defect reproduced; no network/service ACK.`)
