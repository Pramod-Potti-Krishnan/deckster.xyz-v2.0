import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'

// Actual leaf callbacks and actual readiness helpers, with no network, storage,
// navigation, server, browser, or service acknowledgement. Fixtures stay local.
const root = new URL('../', import.meta.url)
const path = 'components/studio-libraries/templates-workspace.tsx'
const source = fs.readFileSync(new URL(path, root), 'utf8')
const baseline = readAtlasBaseline(`63e0eb2:${path}`)
const jsx = (type, props, key) => ({ type, props, key })
const flat = value => Array.isArray(value) ? value.flatMap(flat) : !value || typeof value !== 'object' ? [] : [value, ...flat(value.props?.children)]
const text = value => Array.isArray(value) ? value.map(text).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? text(value.props?.children) : String(value)
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const compile = code => {
  const result = ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  return result.outputText
}
const refuse = () => assert.fail('This fixture refuses network, navigation and storage')
const nativeModule = { exports: {} }
vm.runInNewContext(compile(fs.readFileSync(new URL('hooks/use-templates.ts', root), 'utf8')), {
  module: nativeModule, exports: nativeModule.exports, require: name => { assert.equal(name, 'react'); return { useState: () => [false, () => {}], useCallback: f => f } }, fetch: refuse,
})
const native = nativeModule.exports
const a = { id: 'local-A', name: 'Local A', blueprint_generation_method: 'llm', blueprint_enrichment_status: 'failed', blueprint_enrichment_error: 'Prior optimization END', template_purity_status: 'failed', template_purity_error: 'Prior cleanup END', blueprint_enriched_at: 'earlier', template_purified_at: 'earlier', template_blueprint: { generation_method: 'llm', slides: [] }, slots: [{ slot_id: 'retained-source', slide_index: 0 }] }
const b = { ...a, id: 'local-B', name: 'Local B' }
const queued = { id: a.id, blueprint_enrichment_status: 'queued', blueprint_enrichment_error: null, template_purity_status: 'failed', template_purity_error: 'Prior cleanup END' }
let checks = 0
function harness(code = source, enabled = true) {
  let cursor = 0, tree, scheduled = false, unmounted = false, writes = 0
  const cells = [], pending = [], calls = [], watchers = []
  const api = {
    listTemplates: async () => ({ templates: [a, b], count: 2 }),
    getTemplate: async id => id === a.id ? a : b,
    reoptimizeTemplate: async () => queued,
  }
  const react = {
    useState(initial) { const i = cursor++; cells[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [cells[i].value, value => { assert.equal(unmounted, false, 'no state write after unmount'); writes++; const next = typeof value === 'function' ? value(cells[i].value) : value; if (!Object.is(next, cells[i].value)) scheduled = true; cells[i].value = next }] },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial } },
    useCallback(callback, deps) { const i = cursor++, old = cells[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) cells[i] = { callback, deps }; return cells[i].callback },
    useEffect(effect, deps) { const i = cursor++, old = cells[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) { cells[i] = { deps, effect, cleanup: old?.cleanup }; pending.push(() => { old?.cleanup?.(); cells[i].cleanup = effect() }) } },
  }
  const hooks = { ...native, useTemplates: () => stableApi }
  const stableApi = Object.fromEntries(['listTemplates', 'getTemplate', 'reoptimizeTemplate'].map(name => [name, (...args) => { calls.push([name, ...args]); return api[name](...args) }]))
  stableApi.watchTemplateStatus = (id, callbacks) => { const watcher = { id, callbacks, stopped: false }; watchers.push(watcher); return () => { watcher.stopped = true } }
  const imports = { './templates-fidelity.css': {}, './library-account-boundary': { useStudioLibraryAccount:()=>null, libraryAccountIsCurrent:()=>false, libraryAccountCanStart:()=>false }, react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/hooks/use-templates': hooks, '@/components/template-ingest-dialog': { TemplateIngestDialog: 'TemplateIngestDialog' }, './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' }, './library-controls': Object.fromEntries(['FittedLibraryStage', 'LibraryLoading', 'LibraryNotice', 'LibrarySearch', 'LibraryWorkspace', 'MetadataDisclosure', 'ReadValue', 'StudioWorkflowLink'].map(n => [n, n])) }
  imports['./library-controls'].libraryDate = String
  imports['lucide-react'] = Object.fromEntries(['ArrowLeft', 'ArrowRight', 'FileText', 'FileUp', 'Layers', 'LayoutTemplate', 'Loader2', 'RefreshCw'].map(n => [n, n]))
  const mod = { exports: {} }, context = { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: enabled ? 'true' : 'false', NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED: 'false', NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: 'false' } }, window: { addEventListener() {}, removeEventListener() {} }, fetch: refuse, require: name => { assert.ok(name in imports, name); return imports[name] } }
  const point = '  return <LibraryWorkspace'
  assert.equal(code.split(point).length, 2)
  vm.runInNewContext(compile(code.replace(point, '  globalThis.__leaf = { optimize, refresh, loadPreview, templates, snapshot, selectedId, optimizingId, actionError, actionNotice }\n' + point)), context)
  const h = { api, calls, watchers, context,
    render(runEffects = true) { let attempts = 0; do { assert.ok(attempts++ < 12); scheduled = false; cursor = 0; tree = mod.exports.TemplatesWorkspace(); if (runEffects) while (pending.length) pending.shift()() } while (scheduled && runEffects); return tree },
    async settle() { for (let i = 0; i < 12; i++) { await Promise.resolve(); if (scheduled || pending.length) h.render() } },
    async library() { await h.settle(); tree.props.onModeChange('library'); h.render(); await h.settle() },
    choose(id) { flat(tree).find(n => n.type === 'button' && n.key === id).props.onClick() },
    optimize: () => context.__leaf.optimize(),
    unmount() { unmounted = true; for (const cell of cells) cell?.cleanup?.() },
    replayEffects() { unmounted = false; for (const cell of cells) if (cell?.effect) cell.cleanup = cell.effect(); h.render() },
    get state() { return context.__leaf }, get tree() { return tree }, get writes() { return writes },
  }
  h.render(); return h
}
// Reproduce actual reviewed defect: the acknowledgement falsely erased the
// returned failed cleanup and the exact reason. This is a negative control.
{
  const h = harness(baseline); await h.library(); await h.optimize(); await h.settle()
  assert.equal(h.state.snapshot.template_purity_status, 'pending')
  assert.equal(h.state.snapshot.template_purity_error, null); checks++
}
for (const result of [queued,
  { ...queued, blueprint_enrichment_status: 'failed', blueprint_enrichment_error: 'Returned optimization END', template_purity_error: 'Returned cleanup END', blueprint_enriched_at: 'new-opt', template_purified_at: 'new-clean' },
  { id: a.id },
  { id: a.id, blueprint_enrichment_error: null, template_purity_error: null, template_purity_status: null },
]) {
  const h = harness(); await h.library(); const previous = h.state.snapshot
  h.api.reoptimizeTemplate = async () => ({ ...result, name: 'Untrusted replacement', template_blueprint: { slides: ['wrong'] } })
  await h.optimize(); await h.settle()
  for (const field of ['blueprint_enrichment_status', 'blueprint_enrichment_error', 'blueprint_enriched_at', 'template_purity_status', 'template_purity_error', 'template_purified_at']) {
    const expected = result[field] === undefined ? previous[field] : result[field]
    assert.equal(h.state.snapshot[field], expected, field)
    assert.equal(h.state.templates.find(t => t.id === a.id)[field], expected, `cached ${field}`)
  }
  assert.equal(h.state.snapshot.name, a.name)
  assert.equal(h.state.snapshot.template_blueprint, previous.template_blueprint)
  assert.equal(h.state.snapshot.slots, previous.slots)
  assert.equal(h.state.optimizingId, null)
  assert.match(h.state.actionNotice, /Local A/)
  if (result === queued) {
    assert.equal(native.templateGenerationStatus(h.state.snapshot), 'optimizing', 'queued retry remains watchable with prior cleanup evidence')
    assert.equal(native.isTemplateGenerationReady(h.state.snapshot), false)
    assert.equal(h.watchers.at(-1)?.id, a.id)
    const notice = flat(h.tree).find(n => n.type === 'LibraryNotice' && n.props.readingLabel === 'Template generation readiness')
    assert.match(text(notice), /Last recorded cleanup: Prior cleanup END/)
    assert.equal(notice.props.error, false)
  }
  checks++
}
// New selection before its preview settles, including the old click callback.
{
  const h = harness(); await h.library(); const oldClick = h.state.optimize
  h.choose(b.id); h.render(false)
  assert.equal(h.state.selectedId, b.id); assert.equal(h.state.snapshot.id, a.id)
  await h.optimize(); await oldClick(); assert.equal(h.calls.filter(c => c[0] === 'reoptimizeTemplate').length, 0)
  h.render(); await h.settle(); assert.equal(h.state.snapshot.id, b.id); checks++
}
for (const failure of [null, { ...queued, id: b.id }, 'reject']) {
  const h = harness(); await h.library(); const before = h.state.snapshot
  h.api.reoptimizeTemplate = async () => { if (failure === 'reject') throw new Error('Local refusal'); return failure }
  await h.optimize(); await h.settle()
  assert.equal(h.state.snapshot, before); assert.equal(h.state.optimizingId, null)
  assert.match(h.state.actionError, /Refresh this template before retrying/)
  h.api.reoptimizeTemplate = async () => queued; await h.optimize(); await h.settle()
  assert.equal(h.calls.filter(c => c[0] === 'reoptimizeTemplate').length, 2); checks++
}
for (const retirement of ['selection', 'unmount', 'effect-replay']) {
  const h = harness(); await h.library(); const d = deferred(); h.api.reoptimizeTemplate = () => d.promise
  const task = h.optimize(); await h.optimize()
  assert.equal(h.calls.filter(c => c[0] === 'reoptimizeTemplate').length, 1)
  if (retirement === 'selection') { h.choose(b.id); h.render(); await h.settle() }
  else { h.unmount(); if (retirement === 'effect-replay') { h.replayEffects(); await h.settle() } }
  const writes = h.writes; d.resolve(queued); await task
  if (retirement === 'selection') {
    await h.settle(); assert.equal(h.state.snapshot.id, b.id); assert.equal(h.state.snapshot.template_purity_error, b.template_purity_error)
    assert.equal(h.state.templates.find(t => t.id === a.id).blueprint_enrichment_status, 'queued')
    assert.match(h.state.actionNotice, /Local A/)
  } else assert.equal(h.writes, writes, 'retired mutation cannot write into a later mount epoch')
  checks++
}
{
  const h = harness(source, false); await h.settle(); await h.library()
  assert.equal(h.calls.length, 0); assert.equal(h.state.templates, null); checks++
}
// Public route is still gated by the literal shell flag; native Studio handoff,
// importer gate and local planner remain present and unchanged in this slice.
const route = fs.readFileSync(new URL('app/(app)/studio/templates/page.tsx', root), 'utf8')
assert.match(route, /requireStudioLibraryAccess\(\)/)
for (const token of ['NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED', 'NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED', 'action="brief" brief={draftBrief}', 'itemId={snapshot.id}', 'TemplateInspector key={snapshot.id}', 'readingLabel="Template generation readiness"']) assert.ok(source.includes(token))
console.log(`Atlas Templates recovery: ${checks} actual-leaf offline scenarios passed; reviewed error-loss defect reproduced; no connected operation or visual acceptance claimed.`)
