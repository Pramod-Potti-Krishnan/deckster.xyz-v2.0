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
const baseline = readAtlasBaseline(`a8a0667:${path}`)
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
function harness(code = source, enabled = true, owner = 'owner-A', ready = true, shared = { current: { owner, ready } }) {
  let cursor = 0, tree, scheduled = false, unmounted = false, writes = 0
  let account = owner === null ? null : { owner, ready, current: shared }
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
    createContext: () => ({ Provider: 'AccountProvider' }), useContext: () => account, useMemo: f => f(),
    useEffect(effect, deps) { const i = cursor++, old = cells[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) { cells[i] = { deps, effect, cleanup: old?.cleanup }; pending.push(() => { old?.cleanup?.(); cells[i].cleanup = effect() }) } },
  }
  const accountModule = { exports: {} }
  vm.runInNewContext(compile(fs.readFileSync(new URL('components/studio-libraries/library-account-boundary.tsx', root), 'utf8')), { module: accountModule, exports: accountModule.exports, require: name => name === 'react' ? react : { useAuth: refuse } })
  const hooks = { ...native, useTemplates: () => stableApi }
  const stableApi = Object.fromEntries(['listTemplates', 'getTemplate', 'reoptimizeTemplate'].map(name => [name, (...args) => { calls.push([name, ...args]); return api[name](...args) }]))
  stableApi.watchTemplateStatus = (id, callbacks) => { const watcher = { id, callbacks, stopped: false }; watchers.push(watcher); return () => { watcher.stopped = true } }
  const imports = { './templates-fidelity.css': {}, './library-account-boundary': accountModule.exports, react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/hooks/use-templates': hooks, '@/components/template-ingest-dialog': { TemplateIngestDialog: 'TemplateIngestDialog' }, './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' }, './library-controls': Object.fromEntries(['FittedLibraryStage', 'LibraryLoading', 'LibraryNotice', 'LibrarySearch', 'LibraryWorkspace', 'MetadataDisclosure', 'ReadValue', 'StudioWorkflowLink'].map(n => [n, n])) }
  imports['./library-controls'].libraryDate = String
  imports['lucide-react'] = Object.fromEntries(['ArrowLeft', 'ArrowRight', 'FileText', 'FileUp', 'Layers', 'LayoutTemplate', 'Loader2', 'RefreshCw'].map(n => [n, n]))
  const mod = { exports: {} }, context = { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: enabled ? 'true' : 'false', NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED: 'true', NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: 'true' } }, window: { addEventListener() {}, removeEventListener() {} }, fetch: refuse, require: name => { assert.ok(name in imports, name); return imports[name] } }
  const point = '  return <LibraryWorkspace'
  assert.equal(code.split(point).length, 2)
  const expose = code.includes('useStudioLibraryAccount()') ? 'draftName, draftPurpose, draftSlides, dirty, query, importOpen, canStartAccountAction, isCurrentAccount' : 'draftName, draftPurpose, draftSlides, dirty, query, importOpen'
  vm.runInNewContext(compile(code.replace(point, '  globalThis.__leaf = { optimize, refresh, loadPreview, templates, snapshot, selectedId, optimizingId, actionError, actionNotice, ' + expose + ' }\n' + point)), context)
  const h = { api, calls, watchers, context,
    render(runEffects = true) { let attempts = 0; do { assert.ok(attempts++ < 12); scheduled = false; cursor = 0; tree = mod.exports.TemplatesWorkspace(); if (runEffects) while (pending.length) pending.shift()() } while (scheduled && runEffects); return tree },
    async settle() { for (let i = 0; i < 12; i++) { await Promise.resolve(); if (scheduled || pending.length) h.render() } },
    async library() { await h.settle(); tree.props.onModeChange('library'); h.render(); await h.settle() },
    choose(id) { flat(tree).find(n => n.type === 'button' && n.key === id).props.onClick() },
    optimize: () => context.__leaf.optimize(),
    unmount() { unmounted = true; for (const cell of cells) cell?.cleanup?.() },
    replayEffects() { unmounted = false; for (const cell of cells) if (cell?.effect) cell.cleanup = cell.effect(); h.render() },
    accountReady(ready) { shared.current = { owner: account.owner, ready }; account = { ...account, ready }; h.render() },
    retireOwner(owner = null) { shared.current = { owner, ready: owner !== null } },
    inputName(name) { flat(tree).find(n => n.type === 'input' && n.props.placeholder === 'e.g. Quarterly business review').props.onChange({ target: { value: name } }); h.render() },
    get shared() { return shared }, get account() { return account }, get state() { return context.__leaf }, get tree() { return tree }, get writes() { return writes },
  }
  h.render(); return h
}
// Negative control: the previous leaf could start reads/mutation for a retired
// account, even before its eventual cleanup ran.
{
  const h = harness(baseline)
  await h.library(); const calls = h.calls.length; h.retireOwner('owner-B')
  await h.state.refresh(); await h.state.loadPreview(a.id); await h.optimize(); await h.settle()
  assert.ok(h.calls.length > calls); checks++
}
{
  const h = harness(source, true, 'owner-A', false)
  await h.settle(); assert.equal(h.calls.length, 0)
  h.inputName('Keep this local plan')
  const captured = h.state.refresh
  await captured(); assert.equal(h.calls.length, 0)
  h.accountReady(true); await h.settle()
  assert.equal(h.state.draftName, 'Keep this local plan'); assert.equal(h.calls.filter(c => c[0] === 'listTemplates').length, 1)
  await captured(); await h.settle(); assert.equal(h.calls.filter(c => c[0] === 'listTemplates').length, 2, 'loading-captured same-owner callback recovers')
  h.accountReady(false); h.accountReady(true); await h.settle()
  assert.equal(h.calls.filter(c => c[0] === 'listTemplates').length, 2, 'same-owner readiness does not restart initial read'); checks++
}
{
  const h = harness(); h.inputName('Owned plan'); await h.library()
  flat(h.tree).find(n => n.type === 'LibrarySearch').props.onChange('Local'); h.render()
  const launch = h.tree.props.actions.props.onClick; launch(); h.render()
  const dialog = flat(h.tree).find(n => n.type === 'TemplateIngestDialog')
  assert.equal(dialog.props.open, true)
  assert.equal(dialog.props.canStart(), true); assert.equal(dialog.props.isCurrent(), true)
  const snapshot = h.state.snapshot, templates = h.state.templates, calls = h.calls.length
  h.accountReady(false); await h.settle()
  assert.equal(h.state.snapshot, snapshot); assert.equal(h.state.templates, templates); assert.equal(h.state.query, 'Local'); assert.equal(h.state.draftName, 'Owned plan')
  assert.equal(flat(h.tree).find(n => n.type === 'TemplateIngestDialog').props.open, true, 'same-owner refresh preserves selected import state')
  assert.equal(h.tree.props.actions.props.disabled, true)
  assert.equal(dialog.props.canStart(), false); assert.equal(dialog.props.isCurrent(), true)
  assert.equal(flat(h.tree).find(n => n.type === 'StudioWorkflowAction').props.canStart(), false)
  assert.equal(flat(h.tree).find(n => n.type === 'StudioWorkflowAction').props.disabled, true)
  await h.state.refresh(); await h.state.loadPreview(a.id); await h.optimize(); launch(); await h.settle()
  assert.equal(h.calls.length, calls)
  h.accountReady(true); await h.settle(); assert.equal(h.calls.length, calls, 'settled preview is not refetched on verification')
  h.retireOwner('owner-B'); const writes = h.writes
  launch(); dialog.props.onOpenChange(false)
  assert.equal(h.writes, writes, 'retired dialog parent callback is inert')
  assert.equal(dialog.props.canStart(), false); assert.equal(dialog.props.isCurrent(), false)
  assert.equal(flat(h.tree).find(n => n.type === 'StudioWorkflowAction').props.canStart(), false);  checks++
}
for (const operation of ['list', 'preview', 'optimize']) for (const transition of ['same-loading', 'owner-B', 'null']) {
  const h = harness(); await h.library(); const d = deferred()
  const apiName = operation === 'list' ? 'listTemplates' : operation === 'preview' ? 'getTemplate' : 'reoptimizeTemplate'
  h.api[apiName] = () => d.promise
  const task = operation === 'list' ? h.state.refresh() : operation === 'preview' ? h.state.loadPreview(a.id) : h.optimize()
  h.render()
  if (transition === 'same-loading') h.accountReady(false)
  else h.retireOwner(transition === 'null' ? null : 'owner-B')
  const writes = h.writes
  d.resolve(operation === 'list' ? { templates: [a], count: 1 } : operation === 'preview' ? a : queued)
  await task
  if (transition === 'same-loading') {
    assert.ok(h.writes > writes, 'same-owner receipts may settle during verification')
    await h.settle(); assert.equal(h.state.templates[0].id, a.id)
  } else assert.equal(h.writes, writes, 'synchronous account retirement fences completion before cleanup')
  h.unmount(); checks++
}
for (const transition of ['owner-B', 'null', 'unmount', 'replay']) {
  const h = harness(); await h.library()
  const captured = { refresh: h.state.refresh, preview: h.state.loadPreview, optimize: h.state.optimize }
  if (transition === 'unmount' || transition === 'replay') { h.unmount(); if (transition === 'replay') { h.replayEffects(); await h.settle() } }
  else h.retireOwner(transition === 'null' ? null : 'owner-B')
  const calls = h.calls.length, writes = h.writes
  await captured.refresh(); await captured.preview(a.id); await captured.optimize()
  assert.equal(h.calls.length, calls); assert.equal(h.writes, writes, 'captured retired actions cannot start writes/reads')
  checks++
}
{
  const h = harness(); await h.library(); await h.optimize(); await h.settle()
  const watcher = h.watchers.at(-1), callbacks = watcher.callbacks
  const ready = { ...a, blueprint_enrichment_status: 'complete', template_purity_status: 'clean' }
  h.accountReady(false)
  assert.equal(callbacks.canStart(), false); assert.equal(callbacks.isCurrent(), true)
  callbacks.onUpdate(ready); callbacks.onReady(ready); h.render()
  assert.equal(h.state.snapshot.template_purity_status, 'clean', 'same-owner pending watcher receipt is retained')
  const writes = h.writes
  callbacks.onUpdate({ ...ready, id: b.id }); callbacks.onReady({ ...ready, id: b.id }); callbacks.onTimeout()
  assert.equal(h.writes, writes, 'stopped/wrong-id watcher completion cannot write')
  assert.equal(watcher.stopped, true); checks++
}
{
  const h = harness(); await h.library(); await h.optimize(); await h.settle()
  const watcher = h.watchers.at(-1), writes = h.writes
  h.retireOwner('owner-B')
  assert.equal(watcher.callbacks.canStart(), false); assert.equal(watcher.callbacks.isCurrent(), false)
  watcher.callbacks.onUpdate(a); watcher.callbacks.onReady(a); watcher.callbacks.onTimeout()
  assert.equal(h.writes, writes)
  h.unmount(); assert.equal(watcher.stopped, true)
  h.shared.current = { owner: 'owner-A', ready: true }
  await h.state.refresh(); watcher.callbacks.onReady(a)
  assert.equal(h.writes, writes, 'A-null-A cannot revive an unmounted owner epoch'); checks++
}
{
  const h = harness(source, false); await h.library()
  assert.equal(h.calls.length, 0); assert.equal(h.state.templates, null)
  h.tree.props.onModeChange('create'); h.render(); h.inputName('Offline local planner'); assert.equal(h.state.draftName, 'Offline local planner'); checks++
}
for (const operation of ['list', 'preview', 'optimize']) for (const replay of [false, true]) {
  const h = harness(); await h.library(); const d = deferred()
  const apiName = operation === 'list' ? 'listTemplates' : operation === 'preview' ? 'getTemplate' : 'reoptimizeTemplate'
  h.api[apiName] = () => d.promise
  const task = operation === 'list' ? h.state.refresh() : operation === 'preview' ? h.state.loadPreview(a.id) : h.optimize()
  h.render(); h.unmount()
  h.api[apiName] = async () => operation === 'list' ? { templates: [a], count: 1 } : operation === 'preview' ? a : queued
  if (replay) { h.replayEffects(); await h.settle() }
  const writes = h.writes
  d.resolve(operation === 'list' ? { templates: [b], count: 1 } : operation === 'preview' ? b : queued)
  await task; assert.equal(h.writes, writes, 'old pending response cannot write into replayed owner epoch'); checks++
}
{
  const h = harness(); await h.library(); await h.optimize(); await h.settle()
  const watcher = h.watchers.at(-1)
  h.tree.props.onModeChange('create'); h.render(false)
  const writes = h.writes
  watcher.callbacks.onUpdate(a); watcher.callbacks.onReady(a); watcher.callbacks.onTimeout()
  assert.equal(h.writes, writes, 'synchronous mode change fences captured watcher before effect cleanup')
  h.render(); assert.equal(watcher.stopped, true); checks++
}
// Shared/nonboundary caller remains compatible; the standalone route is the
// only newly wrapped consumer, native Studio picker/save is outside scope.
{
  const h = harness(source, true, null); await h.library(); await h.optimize(); await h.settle()
  assert.equal(h.state.snapshot.blueprint_enrichment_status, 'queued'); checks++
}
// Render the actual shared action using the leaf's actual predicates; all
// navigation/storage are local counters, never the app/browser/system stores.
for (const action of ['brief', 'selected', 'footer']) {
  const h = harness(); h.inputName('Exact account-owned brief')
  if (action !== 'brief') await h.library()
  const leaves = flat(h.tree).filter(n => n.type === 'StudioWorkflowAction')
  const element = leaves.find(n => action === 'brief' ? n.props.action === 'brief' : action === 'selected' ? n.props.itemId === a.id : !n.props.itemId)
  assert.ok(element); assert.equal(element.props.canStart(), true)
  const calls = [], module = { exports: {} }, helpers = {}
  for (const [name, path] of [['workflow', 'lib/studio-workflow.ts'], ['session', 'lib/last-builder-session.ts']]) {
    const m = { exports: {} }; vm.runInNewContext(compile(fs.readFileSync(new URL(path, root), 'utf8')), { module: m, exports: m.exports, URLSearchParams }); helpers[name] = m.exports
  }
  const imports = { react: { useState: initial => [initial, () => {}], useRef: current => ({ current }) }, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/navigation': { useRouter: () => ({ push: href => calls.push(['navigate', href]) }) }, '@/hooks/use-auth': { useAuth: () => ({ user: { id: 'owner-A' } }) }, '@/lib/last-builder-session': helpers.session, '@/lib/studio-workflow': helpers.workflow }
  vm.runInNewContext(compile(fs.readFileSync(new URL('components/studio-libraries/studio-workflow-action.tsx', root), 'utf8')), { module, exports: module.exports, require: name => { assert.ok(name in imports); return imports[name] }, window: { localStorage: { getItem: key => { calls.push(['read-local', key]); return 'owned-session-A' } }, sessionStorage: { setItem: (key, value) => calls.push(['stage-local', key, value]) } }, fetch: refuse })
  const tree = module.exports.StudioWorkflowAction(element.props), click = flat(tree).find(n => n.type === 'button').props.onClick
  h.accountReady(false); click(); assert.equal(calls.length, 0)
  h.accountReady(true); click()
  assert.equal(calls[0][1], 'deckster:last_session_id:owner-A')
  const url = new URL(calls.at(-1)[1], 'http://offline.invalid')
  assert.equal(url.searchParams.get('studio_action'), action === 'brief' ? 'brief' : 'templates')
  assert.equal(url.searchParams.get('session_id'), 'owned-session-A')
  assert.equal(url.searchParams.get('studio_item'), action === 'selected' ? a.id : null)
  if (action === 'brief') {
    const staged = calls.find(c => c[0] === 'stage-local')
    assert.equal(staged[1], 'deckster:studio-workflow-draft:owner-A')
    assert.equal(JSON.parse(staged[2]).text, element.props.brief.trim())
  }
  const count = calls.length; h.retireOwner('owner-B'); click(); assert.equal(calls.length, count)
  h.unmount(); h.shared.current = { owner: 'owner-A', ready: true }; click(); assert.equal(calls.length, count, 'same old owner cannot revive captured handoff'); checks++
}
const page = fs.readFileSync(new URL('app/(app)/studio/templates/page.tsx', root), 'utf8')
assert.match(page, /requireStudioLibraryAccess\(\)/)
assert.match(page, /<StudioLibraryAccountBoundary><TemplatesWorkspace \/><\/StudioLibraryAccountBoundary>/)
const ast = code => ts.createSourceFile('templates.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const find = (node, predicate) => { if (predicate(node)) return node; let found; ts.forEachChild(node, child => { if (!found) found = find(child, predicate) }); return found }
const oldAst = ast(baseline), currentAst = ast(source), printer = ts.createPrinter({ removeComments: true })
for (const name of ['withOptimizationResult', 'TemplateStatus', 'BlueprintPreview', 'TemplateInspector']) {
  const predicate = node => ts.isFunctionDeclaration(node) && node.name?.text === name
  assert.equal(printer.printNode(ts.EmitHint.Unspecified, find(currentAst, predicate), currentAst), printer.printNode(ts.EmitHint.Unspecified, find(oldAst, predicate), oldAst), `${name} stays exact`)
}
for (const name of ['draftBrief', 'draftSlide', 'filtered']) {
  const predicate = node => ts.isVariableDeclaration(node) && node.name.getText() === name
  assert.equal(printer.printNode(ts.EmitHint.Unspecified, find(currentAst, predicate), currentAst), printer.printNode(ts.EmitHint.Unspecified, find(oldAst, predicate), oldAst), `${name} stays exact`)
}
console.log(`Atlas Templates account boundary: ${checks} actual-leaf offline cases pass; initial/same-owner verification, immediate account retirement, deferred list/preview/optimization receipts, captured handlers, watch completion cleanup, import parent launch/close and native-null compatibility; only local read/mutation/navigation/storage counters; no connected operations.`)
