import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'

// Actual leaf render/effects, private element/timer witnesses. No browser,
// service, upload, session creation, storage or navigation can run here.
const root = new URL('../', import.meta.url)
const path = 'components/studio-libraries/templates-workspace.tsx'
const source = fs.readFileSync(new URL(path, root), 'utf8')
const prior = readAtlasBaseline(`0f690ec:${path}`)
const compile = value => {
  const result = ts.transpileModule(value, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  return result.outputText
}
const jsx = (type, props, key) => ({ type, props, key })
const flat = value => Array.isArray(value) ? value.flatMap(flat) : !value || typeof value !== 'object' ? [] : [value, ...flat(value.props?.children)]
const refuse = () => assert.fail('Render witness refuses all connected/service operations')
let checks = 0
function harness(code = source, flag = 'true', owner = 'A') {
  let cursor = 0, tree, scheduled = false, dead = false, focusCount = 0, nextTimer = 0
  const cells = [], effects = [], timers = new Map(), events = new Map()
  const shared = { current: { owner, ready: true } }
  let account = owner === null ? null : { owner, ready: true, current: shared }
  const document = { body: {}, documentElement: {}, activeElement: null }
  document.activeElement = document.body
  const trigger = { isConnected: true, disabled: false, visible: true, getClientRects() { return this.visible ? [{}] : [] }, focus(options) { assert.equal(options.preventScroll, true); focusCount++; document.activeElement = this } }
  const window = { location: { href: 'https://local.invalid/studio/templates' }, addEventListener(name, fn) { events.set(name, fn) }, removeEventListener(name, fn) { if (events.get(name) === fn) events.delete(name) }, setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id }, clearTimeout(id) { timers.delete(id) } }
  const react = {
    useState(initial) { const i = cursor++; cells[i] ??= { value: initial }; return [cells[i].value, v => { assert.equal(dead, false, 'no unmounted state writes'); const next = typeof v === 'function' ? v(cells[i].value) : v; if (!Object.is(next, cells[i].value)) scheduled = true; cells[i].value = next }] },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial } },
    useCallback(callback, deps) { const i = cursor++, old = cells[i]; if (!old || deps.some((v,j) => !Object.is(v,old.deps[j]))) cells[i] = { callback, deps }; return cells[i].callback },
    useEffect(effect, deps) { const i = cursor++, old = cells[i]; if (!old || deps.some((v,j) => !Object.is(v,old.deps[j]))) { cells[i] = { effect, deps, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); cells[i].cleanup = effect() }) } },
    createContext: () => ({ Provider: 'Provider' }), useContext: () => account, useMemo: f => f(),
  }
  const accountModule = { exports: {} }
  vm.runInNewContext(compile(fs.readFileSync(new URL('components/studio-libraries/library-account-boundary.tsx',root),'utf8')), { module: accountModule, exports: accountModule.exports, require: name => name === 'react' ? react : { useAuth: refuse } })
  const stableApi = { listTemplates: refuse, getTemplate: refuse, reoptimizeTemplate: refuse, watchTemplateStatus: refuse }
  const imports = { './templates-fidelity.css': {}, react, 'react/jsx-runtime': { jsx, jsxs: jsx }, './library-account-boundary': accountModule.exports, '@/hooks/use-templates': { useTemplates: () => stableApi }, '@/components/template-ingest-dialog': { TemplateIngestDialog: 'TemplateIngestDialog' }, './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' }, './library-controls': Object.fromEntries(['FittedLibraryStage','LibraryLoading','LibraryNotice','LibrarySearch','LibraryWorkspace','MetadataDisclosure','ReadValue','StudioWorkflowLink'].map(n=>[n,n])) }
  imports['./library-controls'].libraryDate = String
  imports['lucide-react'] = Object.fromEntries(['ArrowLeft','ArrowRight','FileText','FileUp','Layers','LayoutTemplate','Loader2','RefreshCw'].map(n=>[n,n]))
  const mod = { exports: {} }
  vm.runInNewContext(compile(code), { module: mod, exports: mod.exports, require: name => { assert.ok(name in imports,name); return imports[name] }, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag === 'unset' ? undefined : flag, NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: 'false', NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED: 'true', NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: 'false' } }, window, document, fetch: refuse })
  const h = {
    render() { let attempts=0; do { assert.ok(attempts++<10); scheduled=false; cursor=0; tree=mod.exports.TemplatesWorkspace(); const action=tree.props.actions; if(action.props.ref) action.props.ref.current=trigger; trigger.disabled=action.props.disabled; while(effects.length) effects.shift()() } while(scheduled); return tree },
    open() { tree.props.actions.props.onClick(); h.render(); const dialog=flat(tree).find(n=>n.type==='TemplateIngestDialog'); assert.ok(dialog); return dialog.props.onOpenChange },
    close() { const fn=h.open(); fn(false); h.render(); return fn },
    flush() { const queued=[...timers.values()]; timers.clear(); for(const fn of queued) fn() },
    library() { tree.props.onModeChange('library'); h.render() },
    retire(next) { shared.current={ owner:next,ready:next!==null } },
    ready(value) { shared.current={ owner:account.owner,ready:value }; account={...account,ready:value}; h.render() },
    unmount() { dead=true; for(const cell of cells) cell?.cleanup?.() },
    get tree(){return tree}, get focusCount(){return focusCount}, get timers(){return timers}, document, trigger, window, events,
  }
  h.render(); return h
}
// Actual previous source reproduces both observed deficiencies.
{
  const h=harness(prior); assert.equal(flat(h.tree).find(n=>n.type==='aside').props.style,undefined); h.close(); h.flush(); assert.equal(h.focusCount,0); checks++
}
for(const flag of ['true','false','TRUE','unset']) for(const owner of ['A',null]) {
  const h=harness(source,flag,owner), studio=flag==='true'&&owner!==null
  const side=flat(h.tree).find(n=>n.type==='aside')
  assert.equal(side.props.style?.order,studio?-2:undefined)
  assert.equal(Boolean(h.tree.props.actions.props.ref),studio)
  h.close(); assert.equal(h.focusCount,0,'close never focuses synchronously'); h.flush(); assert.equal(h.focusCount,studio?1:0)
  h.library(); assert.equal(flat(h.tree).find(n=>n.type==='aside').props.style,undefined,'Library order remains original'); checks++
}
for(const scenario of ['owner-B','owner-null','loading','unmount','route-change','pagehide','other-focus','hidden','disconnected','disabled']) {
  const h=harness(); h.close(); assert.equal(h.timers.size,1)
  if(scenario==='owner-B')h.retire('B')
  if(scenario==='owner-null')h.retire(null)
  if(scenario==='loading')h.ready(false)
  if(scenario==='unmount')h.unmount()
  if(scenario==='route-change')h.window.location.href='https://local.invalid/builder?session_id=local'
  if(scenario==='pagehide')h.events.get('pagehide')()
  if(scenario==='other-focus')h.document.activeElement={ deliberateOtherControl:true }
  if(scenario==='hidden')h.trigger.visible=false
  if(scenario==='disconnected')h.trigger.isConnected=false
  if(scenario==='disabled')h.trigger.disabled=true
  h.flush(); assert.equal(h.focusCount,0,scenario); checks++
}
{
  const h=harness(); const old=h.open(); h.retire('B'); old(false); h.render(); assert.equal(h.timers.size,0); assert.ok(flat(h.tree).find(n=>n.type==='TemplateIngestDialog'),'retired captured callback cannot close/update'); checks++
}
{
  const h=harness(); h.close(); h.open(); h.flush(); assert.equal(h.focusCount,0,'reopening cancels old return-focus'); checks++
}
{
  const h=harness(); const close=h.open(); close(false); h.window.location.href='https://local.invalid/builder?session_id=local'; h.render(); h.flush(); assert.equal(h.focusCount,0,'native synchronous close then navigation never takes focus'); checks++
}
assert.match(fs.readFileSync(new URL('components/studio-libraries/libraries.css',root),'utf8'),/\.studio-library \.sl-preview-panel \{ order: -1;/,'existing narrow preview-first rule preserved')
assert(source.includes('canStart={account === null ? undefined : canStartImportAccount} isCurrent={account === null ? undefined : isCurrentImportAccount}'))
console.log(`PASS Templates render corrections: ${checks} actual-leaf offline cases; no service operations`)
