import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'

// Actual Themes leaf callbacks, native payload, preview helpers and safe handoff
// props. Deferred receipts are local fixtures; all external operations refuse.
const root = new URL('../', import.meta.url), file = 'components/studio-libraries/themes-workspace.tsx'
const source = fs.readFileSync(new URL(file, root), 'utf8')
// Preserve the actual editable schema/palette algorithms. Only the two text
// handlers gain a live owner guard; normalize that intentional guard for equality.
const baseline = readAtlasBaseline(`a8a0667:${file}`)
// J4-FONTS (reviewed): the only fieldset additions are the flag-gated pickers and the flag-gated sentence; flag off both are today's markup.
const fontPickers = "            {THEME_FONT_SELECTION_ENABLED && draft.mode !== 'auto' && <FontFields draft={draft} onChange={patchDraft} />}\n"
const fontSentence = "{THEME_FONT_SELECTION_ENABLED ? 'Website extraction and AI theme chat are not connected in this workspace. Colors and fonts above are editable now.' : 'Website extraction, font editing, and AI theme chat are not connected in this workspace. Colors above are editable now.'}"
const baseSentence = 'Website extraction, font editing, and AI theme chat are not connected in this workspace. Colors above are editable now.'
assert.equal(source.split(fontPickers).length - 1, 1, 'Only the picker line added'); assert.equal(source.split(fontSentence).length - 1, 1, 'Only the sentence gated')
const ast = code => ts.createSourceFile('themes.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const currentAst = ast(source.replaceAll('if (!mounted.current || !accountIsCurrent()) return; ', '').replaceAll(fontPickers, '').replaceAll(fontSentence, baseSentence)), priorAst = ast(baseline)
const findNode = (node,predicate) => { if(predicate(node))return node;let result;ts.forEachChild(node,child=>{if(!result)result=findNode(child,predicate)});return result }
const printer=ts.createPrinter({removeComments:true})
for(const predicate of [node=>ts.isFunctionDeclaration(node)&&node.name?.text==='ColorField',node=>ts.isJsxElement(node)&&node.openingElement.tagName.getText()==='fieldset',...['changePreset','setOverride'].map(name=>node=>ts.isVariableDeclaration(node)&&node.name.getText()===name)]){
 const actual=findNode(currentAst,predicate),prior=findNode(priorAst,predicate);assert.ok(actual&&prior)
 assert.equal(printer.printNode(ts.EmitHint.Unspecified,actual,currentAst),printer.printNode(ts.EmitHint.Unspecified,prior,priorAst))
}
const refuse = () => assert.fail('No network, storage, navigation or services allowed')
const compile = code => {
  const out = ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } })
  assert.equal(out.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  return out.outputText
}
const jsx = (type, props, key) => ({ type, props, key })
const flat = v => Array.isArray(v) ? v.flatMap(flat) : !v || typeof v !== 'object' ? [] : [v, ...flat(v.props?.children)]
const text = v => Array.isArray(v) ? v.map(text).join('') : v == null || typeof v === 'boolean' ? '' : typeof v === 'object' ? text(v.props?.children) : String(v)
const plain = v => JSON.parse(JSON.stringify(v))
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
function load(path, imports = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(compile(fs.readFileSync(new URL(path, root), 'utf8')), { module: mod, exports: mod.exports, URLSearchParams, require: name => { assert.ok(name in imports, name); return imports[name] }, fetch: refuse })
  return mod.exports
}
const builder = load('lib/theme-builder.ts')
const themeFonts = load('lib/theme-fonts.ts') // J4-FONTS: import-free helper the workspace now imports (flag off here)
const preview = load('components/studio-libraries/theme-preview.tsx', { '@/lib/theme-builder': builder, 'react/jsx-runtime': { jsx, jsxs: jsx } })
const a = { id: 'local-A', name: 'Local A', description: 'A description', theme_payload: { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#aabbcc' } }, is_standard: false }
const b = { id: 'local-B', name: 'Local B', description: 'B description', theme_payload: { mode: 'custom', primary_hex: '#112233', palette_mode: 'both', color_overrides: { private_color: '#445566' } }, is_standard: true }
const receipt = { ...a, name: 'Normalized A', theme_payload: { ...a.theme_payload, color_overrides: { accent: '#abcdef' } }, is_standard: true, updated_at: '2026-10-03T12:00:00Z' }
let cases = 0
function harness({ owner = 'account-A', ready = true, current = { current: { owner, ready } }, initialList } = {}) {
  let account = owner === null ? null : { owner, ready, current }
  const cells = [], effects = [], calls = []
  let cursor = 0, tree, scheduled = false, retired = false, writes = 0
  const api = { listThemes: async () => ({ themes: [a, b], count: 2 }), saveTheme: async () => ({ ...a, id: 'local-saved', name: 'New saved theme' }), setStandardTheme: async () => receipt, clearStandardTheme: async () => true }
  const stableApi = Object.fromEntries(Object.keys(api).map(name => [name, (...args) => { calls.push([name, ...args]); return api[name](...args) }]))
  const react = {
    createContext: () => ({}), useContext: () => account,
    useState(initial) { const i = cursor++; cells[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [cells[i].value, value => { assert.equal(retired, false, 'no state writes after retired mount'); writes++; const next = typeof value === 'function' ? value(cells[i].value) : value; if (!Object.is(next, cells[i].value)) scheduled = true; cells[i].value = next }] },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial } },
    useCallback(callback, deps) { const i = cursor++, old = cells[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) cells[i] = { callback, deps }; return cells[i].callback },
    useEffect(effect, deps) { const i = cursor++, old = cells[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) { cells[i] = { deps, effect, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); cells[i].cleanup = effect() }) } },
    useLayoutEffect() {}, useId: () => 'local-warning',
  }
  const accountHelper = load('components/studio-libraries/library-account-boundary.tsx', { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/hooks/use-auth': { useAuth: refuse } })
  if (initialList) api.listThemes = initialList
  const imports = { './themes-fidelity.css': {}, react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/hooks/use-theme-profiles': { useThemeProfiles: () => stableApi }, '@/lib/theme-builder': builder, '@/lib/theme-fonts': themeFonts, './theme-preview': preview,
    '@/lib/studio-inspector-focus': { keepStudioScrollFocusVisible: refuse }, './library-account-boundary': accountHelper, './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' },
    './library-controls': Object.fromEntries(['FittedLibraryStage', 'LibraryLoading', 'LibraryNotice', 'LibrarySearch', 'LibraryWorkspace', 'MetadataDisclosure', 'ReadValue', 'StudioWorkflowLink'].map(n => [n, n])),
    'lucide-react': Object.fromEntries(['ArrowRight', 'Check', 'Copy', 'Palette', 'RefreshCw', 'RotateCcw', 'Save', 'Star'].map(n => [n, n])),
  }
  imports['./library-controls'].libraryDate = String
  const mod = { exports: {} }, context = { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } }, window: { addEventListener() {}, removeEventListener() {} }, fetch: refuse, require: name => { assert.ok(name in imports, name); return imports[name] } }
  const point = '  return <LibraryWorkspace'
  assert.equal(source.split(point).length, 2)
  vm.runInNewContext(compile(source.replace(point, '  globalThis.__leaf = { refresh, save, changeStandard, requestDraft, loadDraft, themes, selectedId, name, description, draft, dirty, operation, canSave, notice, actionError, listError, mode, accountReady, canContinueInStudio, patchDraft, loading }\n' + point)), context)
  const h = { api, calls,
    render() { let attempts = 0; do { assert.ok(attempts++ < 12); cursor = 0; scheduled = false; tree = mod.exports.ThemesWorkspace(); while (effects.length) effects.shift()() } while (scheduled); return tree },
    async settle() { for (let i = 0; i < 12; i++) { await Promise.resolve(); if (scheduled || effects.length) h.render() } },
    async mode(mode) { tree.props.onModeChange(mode); h.render(); await h.settle() },
    input(label, value) { const parent = flat(tree).find(n => n.type === 'label' && text(n).startsWith(label)); flat(parent).find(n => n.type === 'input' || n.type === 'textarea').props.onChange({ target: { value } }); h.render() },
    choose(id) { flat(tree).find(n => n.type === 'button' && n.key === id).props.onClick(); h.render() },
    async draft() { await h.settle(); await h.mode('create'); h.input('Theme name', ' Draft owner '); h.input('Description', ' Description owner ') },
    verify(nextReady) { if (account) { current.current = { owner: account.owner, ready: nextReady }; account = { ...account, ready: nextReady }; h.render() } },
    switchOwner(nextOwner, nextReady = true) { current.current = { owner: nextOwner, ready: nextReady } },
    get current() { return current },
    unmount() { retired = true; cells.forEach(c => c?.cleanup?.()) },
    replay() { retired = false; cells.forEach(c => { if (c?.effect) c.cleanup = c.effect() }); h.render() },
    get state() { return context.__leaf }, get tree() { return tree }, get writes() { return writes },
  }
  h.render(); return h
}
// Actual boundary source: stable identity key/ref through loading, immediate
// owner retirement on B/null, authenticated readiness only. No session writes.
{
  let auth = { user: { id: 'account-A' }, isAuthenticated: true, isLoading: false }
  let shared
  const helper = load('components/studio-libraries/library-account-boundary.tsx', {
    react: { createContext: () => ({ Provider: 'Provider' }), useContext: () => null, useMemo: fn => fn(), useRef: initial => shared ??= { current: initial } },
    'react/jsx-runtime': { jsx, jsxs: jsx }, '@/hooks/use-auth': { useAuth: () => auth },
  })
  const first = helper.StudioLibraryAccountBoundary({ children: 'leaf' }), captured = first.props.value
  assert.equal(first.key, 'account-A'); assert.equal(helper.libraryAccountCanStart(captured), true)
  auth = { ...auth, isAuthenticated: false, isLoading: true }
  const loading = helper.StudioLibraryAccountBoundary({ children: 'leaf' })
  assert.equal(loading.key, first.key); assert.equal(loading.props.value.current, captured.current)
  assert.equal(helper.libraryAccountIsCurrent(captured), true); assert.equal(helper.libraryAccountCanStart(captured), false)
  const loadingCapture = loading.props.value
  auth = { ...auth, isAuthenticated: true, isLoading: false }
  helper.StudioLibraryAccountBoundary({ children: 'leaf' })
  assert.equal(helper.libraryAccountCanStart(loadingCapture), true, 'captured loading scope resumes with live readiness')
  auth = { ...auth, user: { id: 'account-B' } }
  assert.equal(helper.StudioLibraryAccountBoundary({ children: 'leaf' }).key, 'account-B')
  assert.equal(helper.libraryAccountIsCurrent(captured), false)
  auth = { user: null, isAuthenticated: false, isLoading: false }
  assert.equal(text(helper.StudioLibraryAccountBoundary({ children: 'leaf' })), 'Sign in to view your library.')
  assert.equal(shared.current.owner, null); assert.equal(helper.libraryAccountCanStart(null), false); cases++
}
// Same-owner loading retains cache/draft/effect lifetime and blocks new starts.
{
  const h = harness(); await h.draft(); const draft = h.state.draft, themes = h.state.themes
  const captured = { save: h.state.save, refresh: h.state.refresh, standard: h.state.changeStandard, copy: h.state.loadDraft, handoff: h.state.canContinueInStudio }
  h.verify(false); const count = h.calls.length
  await captured.save(); await captured.refresh(); await captured.standard(); captured.copy(b)
  assert.equal(captured.handoff(), false); assert.equal(h.calls.length, count); assert.equal(h.state.draft, draft); assert.equal(h.state.themes, themes)
  assert.match(text(h.tree), /Verifying your account/)
  h.verify(true); assert.equal(h.calls.length, count, 'verification does not reread populated cache')
  assert.equal(captured.handoff(), true)
  await captured.save(); await h.settle(); assert.equal(h.state.dirty, false)
  assert.deepEqual(plain(h.calls.find(c=>c[0]==='saveTheme')[1]), { name:'Draft owner',description:'Description owner',theme:plain(draft),setStandard:false }); cases++
}
{
  const h = harness({ ready:false }); assert.equal(h.calls.length,0)
  const capturedRefresh = h.state.refresh
  h.verify(true); await h.settle(); assert.equal(h.calls.length,1); assert.equal(h.state.themes.length,2)
  await capturedRefresh(); await h.settle(); assert.equal(h.calls.length,2); cases++
}
// Delayed same-owner completion survives loading; no automatic retry or rerender
// receipt fabrication. New actions remain gated until verification finishes.
for (const action of ['refresh','save','changeStandard']) {
  const h=harness(); await h.settle(); if(action==='save')await h.draft()
  const d=deferred(), method={refresh:'listThemes',save:'saveTheme',changeStandard:'setStandardTheme'}[action]
  h.api[method]=()=>d.promise; const task=h.state[action](); h.verify(false)
  d.resolve(action==='refresh'?{themes:[receipt],count:1}:receipt); await task; await h.settle()
  assert.equal(h.state.accountReady,false); assert.equal(h.state.operation,null)
  assert.ok(h.state.themes.includes(receipt), 'actual service fixture receipt retained'); cases++
}
// Owner ref changes before old effect cleanup: every old leaf start/completion
// fails live owner guard. Separate B leaf state cannot be released by A finally.
for (const action of ['refresh','save','changeStandard','clear']) for(const nextOwner of ['account-B',null]) {
  const h=harness(); await h.settle(); if(action==='save')await h.draft(); if(action==='clear'){await h.mode('library');h.choose(b.id)}
  const d=deferred(), method={refresh:'listThemes',save:'saveTheme',changeStandard:'setStandardTheme',clear:'clearStandardTheme'}[action]
  h.api[method]=()=>d.promise; const captured={save:h.state.save,refresh:h.state.refresh,standard:h.state.changeStandard,copy:h.state.loadDraft,patch:h.state.patchDraft,handoff:h.state.canContinueInStudio}
  const task=h.state[action==='clear'?'changeStandard':action](); h.switchOwner(nextOwner)
  const before=h.writes, calls=h.calls.length
  await captured.save(); await captured.refresh(); await captured.standard(); captured.copy(b); captured.patch({mode:'auto'})
  assert.equal(captured.handoff(),false)
  assert.equal(h.calls.length,calls); assert.equal(h.writes,before)
  let newer, pending, newTask
  if(nextOwner){ newer=harness({owner:nextOwner,current:h.current});await newer.draft();pending=deferred();newer.api.saveTheme=()=>pending.promise;newTask=newer.state.save();newer.render();assert.equal(newer.state.operation,'save') }
  d.resolve(action==='refresh'?{themes:[receipt],count:1}:action==='clear'?true:receipt);await task
  assert.equal(h.writes,before,'no receipt or finally writes before old cleanup')
  h.unmount();if(newer){newer.render();assert.equal(newer.state.operation,'save');pending.resolve({...a,id:'B-saved'});await newTask;await newer.settle();assert.equal(newer.state.operation,null);assert.equal(newer.state.selectedId,'B-saved')}
  cases++
}
// Replay retires pending operation and permits fresh same-owner retry; old
// completion cannot clear the newer busy state or invent cancellation.
for(const action of ['save','changeStandard']){
 const h=harness();await h.settle();if(action==='save')await h.draft();const method=action==='save'?'saveTheme':'setStandardTheme'
 const old=deferred();h.api[method]=()=>old.promise;const oldTask=h.state[action]();h.unmount();h.replay();await h.settle()
 assert.equal(h.state.operation,null);assert.match(h.state.actionError,/interrupted locally/)
 const next=deferred();h.api[method]=()=>next.promise;const newTask=h.state[action]();h.render();const before=h.writes
 old.resolve(receipt);await oldTask;assert.equal(h.writes,before);assert.ok(h.state.operation)
 next.resolve(receipt);await newTask;await h.settle();assert.equal(h.state.operation,null);cases++
}
for(const result of [null,'reject',receipt]){
 const h=harness();await h.draft();const prior=h.state.themes,draft=h.state.draft
 h.api.saveTheme=async()=>{if(result==='reject')throw Error('local refusal');return result};await h.state.save();await h.settle()
 assert.equal(h.state.operation,null)
 if(result===receipt){assert.equal(h.state.themes.find(t=>t.id===receipt.id),receipt);assert.equal(h.state.selectedId,receipt.id)}
 else{assert.equal(h.state.themes,prior);assert.equal(h.state.draft,draft);assert.match(h.state.actionError,/draft is still here/);h.api.saveTheme=async()=>receipt;await h.state.save();await h.settle();assert.equal(h.calls.filter(c=>c[0]==='saveTheme').length,2)} cases++
}
// Outside the standalone provider, existing native/legacy consumer behavior stays.
{
 const h=harness({owner:null});await h.draft();await h.state.save();await h.settle();assert.equal(h.state.dirty,false);cases++
}
const route=fs.readFileSync(new URL('app/(app)/studio/themes/page.tsx',root),'utf8')
assert.match(route,/requireStudioLibraryAccess\(\)/)
assert.match(route,/<StudioLibraryAccountBoundary><ThemesWorkspace\s*\/><\/StudioLibraryAccountBoundary>/)
for(const label of ['Auto / session default','Theme-linked','Custom palette','Color harmony','Palette mode','Individual colors','Customize a copy','Compare base colors'])assert.ok(source.includes(label))


{ const h=harness();await h.settle();await h.mode('library');const actions=flat(h.tree).filter(n=>n.type==='StudioWorkflowAction');assert.equal(actions.length,2);assert.equal(actions[0].props.itemId,a.id);assert.equal(actions[1].props.itemId,undefined);for(const action of actions){assert.equal(action.props.canStart(),true);h.verify(false);assert.equal(action.props.canStart(),false);h.verify(true);assert.equal(action.props.canStart(),true)}h.switchOwner('account-B');for(const action of actions)assert.equal(action.props.canStart(),false) }

for(const result of [null,{...receipt,is_standard:false},'reject',receipt]){
 const h=harness();await h.settle();const prior=h.state.themes;h.api.setStandardTheme=async()=>{if(result==='reject')throw Error('local refusal');return result};await h.state.changeStandard();await h.settle()
 assert.equal(h.state.operation,null)
 if(result===receipt)assert.equal(h.state.themes.find(t=>t.id===receipt.id),receipt)
 else{assert.equal(h.state.themes,prior);assert.match(h.state.actionError,/standard change was not confirmed/)}cases++
}
for(const result of [null,false,'reject',true]){
 const h=harness();await h.settle();await h.mode('library');h.choose(b.id);const prior=h.state.themes;h.api.clearStandardTheme=async()=>{if(result==='reject')throw Error('local refusal');return result};await h.state.changeStandard();await h.settle()
 assert.equal(h.state.operation,null)
 if(result===true)assert.ok(h.state.themes.every(t=>t.is_standard===false))
 else{assert.equal(h.state.themes,prior);assert.match(h.state.actionError,/standard change was not confirmed/)}cases++
}
{
 const h=harness();await h.settle();h.state.loadDraft(b);h.render();assert.deepEqual(plain(h.state.draft),plain(b.theme_payload));assert.notEqual(h.state.draft.color_overrides,b.theme_payload.color_overrides)
 const oldSave=h.state.save;h.input('Theme name','Current draft');await oldSave();assert.equal(h.calls.filter(c=>c[0]==='saveTheme').length,0)
 const prior=h.state.themes;h.api.listThemes=async()=>{throw Error('local read refusal')};await h.state.refresh();await h.settle();assert.equal(h.state.themes,prior);assert.match(h.state.listError,/could not be loaded/);cases++
}
console.log(`Atlas Themes account boundary: ${cases} actual-source offline cases passed. Leaf live Studio predicates covered; shared navigation witness remains lead-owned. No connected/visual acceptance.`)
