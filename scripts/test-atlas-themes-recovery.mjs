import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'

// Actual Themes leaf callbacks, native payload, preview helpers and safe handoff
// props. Deferred receipts are local fixtures; all external operations refuse.
const root = new URL('../', import.meta.url), file = 'components/studio-libraries/themes-workspace.tsx'
const source = fs.readFileSync(new URL(file, root), 'utf8')
const baseline = readAtlasBaseline(`b1e8370:${file}`)
const ast = code => ts.createSourceFile('themes.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const findNode = (node, predicate) => { if (predicate(node)) return node; let found; ts.forEachChild(node, child => { if (!found) found = findNode(child, predicate) }); return found }
// Equality excludes only the reviewed live owner guards. Runtime cases below
// execute the unmodified source; palette fields/copy algorithms remain exact.
assert.equal(source.split('if (!mounted.current || !accountIsCurrent()) return; ').length - 1, 3, 'Only patchDraft/name/description owner guards normalized')
assert.equal(source.split('if (!mounted.current || !accountCanStart() || busy.current) return').length - 1, 2, 'Only loadDraft/requestDraft start guards normalized')
const equalitySource = source
  .replaceAll('if (!mounted.current || !accountIsCurrent()) return; ', '')
  .replaceAll('if (!mounted.current || !accountCanStart() || busy.current) return', 'if (busy.current) return')
const currentAst = ast(equalitySource), originalAst = ast(baseline), printer = ts.createPrinter({ removeComments: true })
for (const [label, predicate] of [
  ['ColorField', node => ts.isFunctionDeclaration(node) && node.name?.text === 'ColorField'],
  ['all native editable fields and options', node => ts.isJsxElement(node) && node.openingElement.tagName.getText() === 'fieldset'],
  ...['loadDraft', 'requestDraft', 'patchDraft', 'changePreset', 'setOverride'].map(name => [name, node => ts.isVariableDeclaration(node) && node.name.getText() === name]),
]) {
  const current = findNode(currentAst, predicate), original = findNode(originalAst, predicate)
  assert.ok(current && original, label)
  assert.equal(printer.printNode(ts.EmitHint.Unspecified, current, currentAst), printer.printNode(ts.EmitHint.Unspecified, original, originalAst), `${label} is unchanged`)
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
const preview = load('components/studio-libraries/theme-preview.tsx', { '@/lib/theme-builder': builder, 'react/jsx-runtime': { jsx, jsxs: jsx } })
const workflow = load('lib/studio-workflow.ts')
const a = { id: 'local-A', name: 'Local A', description: 'A description', theme_payload: { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#aabbcc' } }, is_standard: false }
const b = { id: 'local-B', name: 'Local B', description: 'B description', theme_payload: { mode: 'custom', primary_hex: '#112233', palette_mode: 'both', color_overrides: { private_color: '#445566' } }, is_standard: true }
const receipt = { ...a, name: 'Normalized A', theme_payload: { ...a.theme_payload, color_overrides: { accent: '#abcdef' } }, is_standard: true, updated_at: '2026-10-03T12:00:00Z' }
let cases = 0
function harness(code = source) {
  const cells = [], effects = [], calls = []
  let cursor = 0, tree, scheduled = false, retired = false, writes = 0
  const api = { listThemes: async () => ({ themes: [a, b], count: 2 }), saveTheme: async () => ({ ...a, id: 'local-saved', name: 'New saved theme' }), setStandardTheme: async () => receipt, clearStandardTheme: async () => true }
  const stableApi = Object.fromEntries(Object.keys(api).map(name => [name, (...args) => { calls.push([name, ...args]); return api[name](...args) }]))
  const react = {
    useState(initial) { const i = cursor++; cells[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [cells[i].value, value => { assert.equal(retired, false, 'no state writes after retired mount'); writes++; const next = typeof value === 'function' ? value(cells[i].value) : value; if (!Object.is(next, cells[i].value)) scheduled = true; cells[i].value = next }] },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial } },
    useCallback(callback, deps) { const i = cursor++, old = cells[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) cells[i] = { callback, deps }; return cells[i].callback },
    useEffect(effect, deps) { const i = cursor++, old = cells[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) { cells[i] = { deps, effect, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); cells[i].cleanup = effect() }) } },
    useLayoutEffect() {}, useId: () => 'local-warning',
  }
  const accountHelper = load('components/studio-libraries/library-account-boundary.tsx', { react: { createContext: () => ({}), useContext: () => null }, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/hooks/use-auth': { useAuth: refuse } })
  // This historical native/recovery witness runs outside the standalone provider.
  // New owner transitions are exercised by the actual account-boundary witness.
  const imports = { './themes-fidelity.css': {}, react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/hooks/use-theme-profiles': { useThemeProfiles: () => stableApi }, '@/lib/theme-builder': builder, './theme-preview': preview,
    '@/lib/studio-inspector-focus': { keepStudioScrollFocusVisible: refuse }, './library-account-boundary': accountHelper, './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' },
    './library-controls': Object.fromEntries(['FittedLibraryStage', 'LibraryLoading', 'LibraryNotice', 'LibrarySearch', 'LibraryWorkspace', 'MetadataDisclosure', 'ReadValue', 'StudioWorkflowLink'].map(n => [n, n])),
    'lucide-react': Object.fromEntries(['ArrowRight', 'Check', 'Copy', 'Palette', 'RefreshCw', 'RotateCcw', 'Save', 'Star'].map(n => [n, n])),
  }
  imports['./library-controls'].libraryDate = String
  const mod = { exports: {} }, context = { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } }, window: { addEventListener() {}, removeEventListener() {} }, fetch: refuse, require: name => { assert.ok(name in imports, name); return imports[name] } }
  const point = '  return <LibraryWorkspace'
  assert.equal(code.split(point).length, 2)
  vm.runInNewContext(compile(code.replace(point, '  globalThis.__leaf = { refresh, save, changeStandard, requestDraft, loadDraft, themes, selectedId, name, description, draft, dirty, operation, canSave, notice, actionError, listError, mode }\n' + point)), context)
  const h = { api, calls,
    render() { let attempts = 0; do { assert.ok(attempts++ < 12); cursor = 0; scheduled = false; tree = mod.exports.ThemesWorkspace(); while (effects.length) effects.shift()() } while (scheduled); return tree },
    async settle() { for (let i = 0; i < 12; i++) { await Promise.resolve(); if (scheduled || effects.length) h.render() } },
    async mode(mode) { tree.props.onModeChange(mode); h.render(); await h.settle() },
    input(label, value) { const parent = flat(tree).find(n => n.type === 'label' && text(n).startsWith(label)); flat(parent).find(n => n.type === 'input' || n.type === 'textarea').props.onChange({ target: { value } }); h.render() },
    choose(id) { flat(tree).find(n => n.type === 'button' && n.key === id).props.onClick(); h.render() },
    async draft() { await h.settle(); await h.mode('create'); h.input('Theme name', ' Draft owner '); h.input('Description', ' Description owner ') },
    unmount() { retired = true; cells.forEach(c => c?.cleanup?.()) },
    replay() { retired = false; cells.forEach(c => { if (c?.effect) c.cleanup = c.effect() }); h.render() },
    get state() { return context.__leaf }, get tree() { return tree }, get writes() { return writes },
  }
  h.render(); return h
}
// Actual baseline falsely claimed a standard despite explicit false receipt.
{
  const h = harness(baseline); await h.settle(); h.api.setStandardTheme = async () => ({ ...a, is_standard: false }); await h.state.changeStandard(); await h.settle()
  assert.equal(h.state.themes.find(t => t.id === a.id).is_standard, true); assert.match(h.state.notice, /now the standard/); cases++
}
for (const result of [null, false, true, { ...receipt, id: b.id }, { ...receipt, is_standard: false }, { ...receipt, is_standard: undefined }, { ...receipt, theme_payload: null }, 'reject', receipt]) {
  const h = harness(); await h.settle(); const previous = h.state.themes
  h.api.setStandardTheme = async () => { if (result === 'reject') throw new Error('Local standard refusal'); return result }
  await h.state.changeStandard(); await h.settle()
  assert.equal(h.state.operation, null)
  if (result === receipt) {
    assert.equal(h.state.themes.find(t => t.id === a.id), receipt, 'actual returned profile is authoritative')
    assert.equal(h.state.themes.find(t => t.id === b.id).is_standard, false)
    assert.match(h.state.notice, /Normalized A/)
    await h.mode('library'); const action = flat(h.tree).find(n => n.type === 'StudioWorkflowAction')
    assert.equal(action.props.action, 'theme'); assert.equal(action.props.itemId, a.id)
    const href = new URL(workflow.getStudioWorkflowHref(action.props.action, 'owned-session', action.props.itemId), 'https://local.invalid')
    assert.equal(href.searchParams.get('studio_item'), a.id); assert.equal(href.searchParams.get('session_id'), 'owned-session')
  } else {
    assert.equal(h.state.themes, previous); assert.match(h.state.actionError, /standard change was not confirmed/)
    h.api.setStandardTheme = async () => receipt; await h.state.changeStandard(); await h.settle()
    assert.equal(h.calls.filter(c => c[0] === 'setStandardTheme').length, 2)
  }
  cases++
}
for (const result of [false, null, { ...b }, 'reject', true]) {
  const h = harness(); await h.settle(); await h.mode('library'); h.choose(b.id); const previous = h.state.themes
  h.api.clearStandardTheme = async () => { if (result === 'reject') throw new Error('Local clear refusal'); return result }
  await h.state.changeStandard(); await h.settle()
  if (result === true) { assert.ok(h.state.themes.every(t => t.is_standard === false)); assert.match(h.state.notice, /Standard cleared/) }
  else { assert.equal(h.state.themes, previous); assert.match(h.state.actionError, /standard change was not confirmed/) }
  assert.equal(h.state.operation, null); cases++
}
for (const result of [null, { id: 'unconfirmed' }, 'reject', { ...a, id: 'local-saved', name: 'New saved theme' }]) {
  const h = harness(); await h.draft(); const draft = h.state.draft, prior = h.state.themes
  h.api.saveTheme = async () => { if (result === 'reject') throw new Error('Local save refusal'); return result }
  await h.state.save(); await h.settle()
  assert.deepEqual(plain(h.calls.find(c => c[0] === 'saveTheme')[1]), { name: 'Draft owner', description: 'Description owner', theme: plain(draft), setStandard: false })
  assert.equal(h.state.operation, null)
  if (result?.theme_payload) { assert.equal(h.state.selectedId, result.id); assert.equal(h.state.dirty, false); assert.equal(h.state.mode, 'library') }
  else { assert.equal(h.state.name, ' Draft owner '); assert.equal(h.state.description, ' Description owner '); assert.equal(h.state.draft, draft); assert.equal(h.state.themes, prior); assert.equal(h.state.dirty, true); assert.equal(h.state.canSave, true); assert.match(h.state.actionError, /draft is still here/) }
  cases++
}
// Captured stale action cannot change a newly chosen item or replaced draft.
{
  const h = harness(); await h.settle(); const captured = h.state.changeStandard
  await h.mode('library'); h.choose(b.id); await captured()
  assert.equal(h.calls.filter(c => c[0] === 'setStandardTheme' || c[0] === 'clearStandardTheme').length, 0)
  await h.draft(); const oldSave = h.state.save; h.input('Theme name', 'Current replacement'); await oldSave()
  assert.equal(h.calls.filter(c => c[0] === 'saveTheme').length, 0); cases++
}
for (const operation of ['save', 'standard']) for (const retirement of ['none', 'selection', 'unmount', 'replay']) {
  const h = harness(); await h.settle(); if (operation === 'save') await h.draft(); else await h.mode('library')
  const d = deferred(); h.api[operation === 'save' ? 'saveTheme' : 'setStandardTheme'] = () => d.promise
  const start = operation === 'save' ? h.state.save : h.state.changeStandard, task = start(); await start()
  assert.equal(h.calls.filter(c => c[0] === (operation === 'save' ? 'saveTheme' : 'setStandardTheme')).length, 1)
  if (retirement === 'selection') { await h.mode('library'); h.choose(b.id) }
  if (retirement === 'unmount' || retirement === 'replay') { h.unmount(); if (retirement === 'replay') { h.replay(); await h.settle(); assert.equal(h.state.operation, null); assert.match(h.state.actionError, /interrupted locally/) } }
  const writes = h.writes; d.resolve(operation === 'save' ? { ...a, id: 'local-saved', name: 'New saved theme' } : receipt); await task
  if (retirement === 'unmount' || retirement === 'replay') assert.equal(h.writes, writes)
  else { await h.settle(); assert.equal(h.state.operation, null); if (operation === 'standard' && retirement === 'selection') assert.equal(h.state.selectedId, b.id) }
  cases++
}
// Copy preserves all supplied settings, clones explicit overrides and never
// applies them. A refused refresh keeps cached saved record and standard.
{
  const h = harness(); await h.settle(); h.state.loadDraft(b); h.render()
  assert.deepEqual(plain(h.state.draft), plain(b.theme_payload)); assert.notEqual(h.state.draft, b.theme_payload); assert.notEqual(h.state.draft.color_overrides, b.theme_payload.color_overrides)
  assert.equal(h.state.name, 'Local B copy'); const previous = h.state.themes
  h.api.listThemes = async () => null; await h.state.refresh(); await h.settle(); assert.equal(h.state.themes, previous); assert.match(h.state.listError, /could not be loaded/); cases++
}
const route = fs.readFileSync(new URL('app/(app)/studio/themes/page.tsx', root), 'utf8')
assert.match(route, /requireStudioLibraryAccess\(\)/)
assert.ok(source.includes("title={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'Themes & brand' : 'Themes'}"))
for (const label of ['Auto / session default', 'Theme-linked', 'Custom palette', 'Color harmony', 'Palette mode', 'Individual colors', 'Customize a copy', 'Compare base colors', 'Website extraction, font editing, and AI theme chat are not connected']) assert.ok(source.includes(label))
assert.deepEqual(plain(builder.CANONICAL_THEME_PRESET_IDS), ['corporate_light', 'corporate_dark', 'minimal', 'vibrant', 'executive', 'pastel'])
assert.equal(preview.themePreviewPalette(b.theme_payload).private_color, '#445566')
assert.equal(preview.themePreviewPalette({ mode: 'preset', preset_id: 'unknown-owned-base', color_overrides: { accent: '#778899' } }).accent, '#778899')
console.log(`Atlas Themes recovery: ${cases} actual-leaf offline cases passed; baseline false-standard receipt defect reproduced; no connected save/standard/apply or visual acceptance.`)
