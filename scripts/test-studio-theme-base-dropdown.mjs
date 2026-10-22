// PASS2D 6b: the Themes & brand page chooses a theme's base with the deck dialog's searchable dropdown, not a native select
// (flag NEXT_PUBLIC_STUDIO_THEME_BASE_DROPDOWN, exact "true" plus the Studio shell, default off).
// The finding (PASS2-J4-FINDINGS item 6b): the Create tab's "Base theme" was a plain browser select, a third picker style next to the composer popover's dropdowns and the deck
// dialog's. The picker component exists already; this feeds it the select's own choices, and the same handler (`changePreset`) takes the pick.
//
// Run: node scripts/test-studio-theme-base-dropdown.mjs   (plain node: transpile + vm, no network, no React runtime)
//   THEME_BASE_DROPDOWN_BASE=<commit> overrides the base the flag-off identity is checked against (default fbc77c0, origin/studio-v4-dev-preparation-code before this change).
//
// Proven on the REAL sources: lib/studio-theme-base-dropdown.ts (imports nothing), components/studio-libraries/themes-workspace.tsx and base-theme-picker.tsx (with the lib files they
// use) run in a vm with a small hooks runtime. Flag off (unset, any other value, or the flag without the Studio shell) renders the base commit's tree, cell for cell. Flag on, the
// choices, their order and the chosen value are read off the base's native select and must equal the dropdown's. Then every suite is re-run against broken copies: each mutant must be caught.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { stripLibraryManage } from './studio-library-manage-strip.mjs'

const treeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => stripLibraryManage(file, fs.readFileSync(path.join(treeRoot, file), 'utf8')) // FRONTEND-2 Pass 3 track 4 (NEXT_PUBLIC_STUDIO_THEME_LIBRARY_MANAGE / NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE): that change's lines are not part of what this pin holds (scripts/studio-library-manage-strip.mjs)
const BASE_COMMIT = process.env.THEME_BASE_DROPDOWN_BASE || 'fbc77c0'
const baseSource = file => execFileSync('git', ['show', `${BASE_COMMIT}:${file}`], { cwd: treeRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_BASE_DROPDOWN'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const CANON = 'NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED'
const FILES = { lib: 'lib/studio-theme-base-dropdown.ts', workspace: 'components/studio-libraries/themes-workspace.tsx', picker: 'components/studio-libraries/base-theme-picker.tsx', css: 'components/studio-libraries/base-theme-dropdown.css' }
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---- module loader: transpile repo files and run them in a vm --------------------------------------------------------------
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
/** `overrides`: repo-relative path -> source text (a mutant, or the base's file). */
function createLoader({ env = {}, stubs = {}, globals = {}, overrides = {} } = {}) {
  const cache = new Map()
  const exists = rel => rel in overrides || fs.existsSync(path.join(treeRoot, rel))
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const suffix of ['.ts', '.tsx']) if (exists(base + suffix)) return base + suffix
    return null
  }
  function run(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const mod = { exports: {} }
    cache.set(rel, mod.exports)
    const source = rel in overrides ? overrides[rel] : read(rel)
    const requireFor = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) {
        const file = resolve(spec, rel)
        assert.ok(file, `unresolved import ${spec} in ${rel}`)
        return run(file)
      }
      throw new Error(`unexpected import ${spec} in ${rel}`)
    }
    vm.runInNewContext(compile(rel, source), { module: mod, exports: mod.exports, process: { env }, console, ...globals, require: requireFor })
    cache.set(rel, mod.exports)
    return mod.exports
  }
  return { load: run }
}

// ---- a small hooks runtime: stateful root component, inert children ---------------------------------------------------------
const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' }
function createRuntime() {
  const cells = []
  let cursor = 0, dirty = false, inert = false
  const effects = []
  const depsChanged = (old, deps) => !old || !deps || deps.some((value, index) => !Object.is(value, old.deps?.[index]))
  const react = {
    useState(init) {
      if (inert) return [typeof init === 'function' ? init() : init, () => {}]
      const i = cursor++
      cells[i] ??= { value: typeof init === 'function' ? init() : init }
      const cell = cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(init) { if (inert) return { current: init }; const i = cursor++; return cells[i] ??= { current: init } },
    useMemo(fn, deps) { if (inert) return fn(); const i = cursor++, old = cells[i]; if (depsChanged(old, deps)) cells[i] = { deps, value: fn() }; return cells[i].value },
    useCallback(fn, deps) { if (inert) return fn; const i = cursor++, old = cells[i]; if (depsChanged(old, deps)) cells[i] = { deps, value: fn }; return cells[i].value },
    useEffect(fn, deps) {
      if (inert) return
      const i = cursor++, old = cells[i]
      if (depsChanged(old, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
    useLayoutEffect() {},
    useId: () => 'local-id',
  }
  function expand(node) {
    if (Array.isArray(node)) return node.map(expand)
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') return expand(node.type(node.props))
    const props = {}
    for (const [key, value] of Object.entries(node.props ?? {})) props[key] = key === 'children' ? expand(value) : value
    return { type: node.type, props, key: node.key }
  }
  return {
    react,
    render(Component, props) {
      let tree
      for (let attempt = 0; attempt < 12; attempt++) {
        cursor = 0; dirty = false; inert = false
        const root = Component(props)
        inert = true
        tree = expand(root)
        inert = false
        while (effects.length) effects.shift()()
        if (!dirty) return tree
      }
      throw new Error('render did not settle')
    },
    get pending() { return dirty },
  }
}
const flat = node => Array.isArray(node) ? node.flatMap(flat) : !node || typeof node !== 'object' ? [] : [node, ...flat(node.props?.children)]
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const icons = new Proxy({}, { get: (_, name) => `Icon:${String(name)}` })


const text = node => Array.isArray(node) ? node.map(text).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)
const plain = value => JSON.parse(JSON.stringify(value))
const realPicker = (() => createLoader({ env: {}, stubs: { react: createRuntime().react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons } }).load('components/theme-dropdown-picker.tsx'))()

// ---- a mounted Themes & brand workspace (the real component, with the page's neighbours stubbed) -----------------------------------
const SAVED = [
  { id: 's-auto', name: 'Auto saved', description: 'a', is_standard: false, theme_payload: { mode: 'auto' } },
  { id: 's-vibrant', name: 'Vibrant saved', description: 'b', is_standard: false, theme_payload: { mode: 'preset', preset_id: 'vibrant' } },
  { id: 's-old', name: 'Old base saved', description: 'c', is_standard: false, theme_payload: { mode: 'preset', preset_id: 'retired_theme' } },
  { id: 's-noir', name: 'Noir saved', description: 'd', is_standard: false, theme_payload: { mode: 'preset', preset_id: 'gilded_noir' } },
  { id: 's-custom', name: 'Custom saved', description: 'e', is_standard: false, theme_payload: { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b', preset_id: 'minimal' } },
]
function mountWorkspace(env, overrides = {}, { pickerMarker = true, saveHangs = false } = {}) {
  const runtime = createRuntime()
  const refuse = () => assert.fail('No network, storage, navigation or services allowed')
  const api = { error: null, listThemes: async () => ({ themes: SAVED, count: SAVED.length }), saveTheme: saveHangs ? () => new Promise(() => {}) : refuse, setStandardTheme: refuse, clearStandardTheme: refuse }
  const stubs = {
    react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons,
    '@/lib/studio-inspector-focus': { keepStudioScrollFocusVisible: refuse },
    './library-account-boundary': { useStudioLibraryAccount: () => null, libraryAccountCanStart: () => true, libraryAccountIsCurrent: () => true },
    './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' },
    './library-controls': { ...Object.fromEntries(['FittedLibraryStage', 'LibraryLoading', 'LibraryNotice', 'LibrarySearch', 'LibraryWorkspace', 'MetadataDisclosure', 'ReadValue', 'StudioWorkflowLink'].map(name => [name, name])), libraryDate: String },
    '@/hooks/use-theme-profiles': { useThemeProfiles: () => api },
    // the dropdown is a marker element so its options stay readable; its real helpers are kept
    ...(pickerMarker ? { '@/components/theme-dropdown-picker': { ...realPicker, ThemeDropdownPicker: 'Picker' } } : {}),
  }
  const { ThemesWorkspace } = createLoader({ env: { [SHELL]: 'true', ...env }, stubs, globals: { window: { addEventListener() {}, removeEventListener() {} }, fetch: refuse }, overrides }).load(FILES.workspace)
  const w = {
    tree: null,
    render() { w.tree = runtime.render(ThemesWorkspace, {}); return w.tree },
    async settle() { for (let i = 0; i < 12; i++) { await new Promise(resolve => setTimeout(resolve, 0)); w.render() } return w.tree },
    async mode(mode) { w.tree.props.onModeChange(mode); w.render(); await w.settle() },
    pick(id) { flat(w.tree).find(node => node.type === 'button' && node.key === id).props.onClick(); w.render() },
    click(start) { flat(w.tree).find(node => node.type === 'button' && text(node).startsWith(start)).props.onClick(); w.render() },
    input(label, value) { const holder = flat(w.tree).find(node => node.type === 'label' && text(node).startsWith(label)); flat(holder).find(node => node.type === 'input' || node.type === 'textarea').props.onChange({ target: { value } }); w.render() },
  }
  w.render()
  return w
}
/** A workspace on the Create tab with the draft of saved theme `id` (loaded the way a person does: pick it in the library, Customize a copy), or the blank draft. */
async function createTab(env, id, overrides, opts) {
  const w = mountWorkspace(env, overrides, opts)
  await w.settle()
  if (id) { await w.mode('library'); w.pick(id); w.click('Customize a copy'); await w.settle() }
  return w
}
const baseControl = tree => flat(tree).find(node => node.type === 'label' && text(node).startsWith('Base theme'))
const dropdownControl = tree => flat(tree).find(node => node.props?.className === 'sl-base-dd')
const pickerOf = tree => flat(tree).find(node => node.type === 'Picker')
const replaceNode = (node, predicate, marker) => Array.isArray(node) ? node.map(item => replaceNode(item, predicate, marker)) : !node || typeof node !== 'object' ? node : predicate(node) ? marker : { ...node, props: Object.fromEntries(Object.entries(node.props ?? {}).map(([key, value]) => [key, key === 'children' ? replaceNode(value, predicate, marker) : value])) }
const withoutControl = (tree, predicate) => ser(replaceNode(tree, predicate, '__BASE_THEME_CONTROL__'))
/** What the native select offered: [value, label] per option, and its chosen value. */
const selectOf = control => { const select = flat(control).find(node => node.type === 'select'); return { value: select.props.value, options: flat(select).filter(node => node.type === 'option').map(node => [node.props.value, text(node)]) } }

const ENV_OFF = [{}, { [FLAG]: 'false' }, { [FLAG]: '' }, { [FLAG]: '1' }, { [FLAG]: 'TRUE' }, { [FLAG]: ' true' }, { [FLAG]: 'yes' }]
const DRAFTS = [null, ...SAVED.map(theme => theme.id)]
const ON = { [FLAG]: 'true' }

// ---- suite 1: the pure helper -----------------------------------------------------------------------------------------------
function pureSuite(overrides = {}) {
  const load = env => createLoader({ env, overrides }).load(FILES.lib)
  for (const [env, expected] of [[{}, false], [{ [FLAG]: 'true' }, false], [{ [SHELL]: 'true' }, false], [{ [FLAG]: 'true', [SHELL]: 'true' }, true], [{ [FLAG]: 'TRUE', [SHELL]: 'true' }, false], [{ [FLAG]: '1', [SHELL]: 'true' }, false],
    [{ [FLAG]: 'false', [SHELL]: 'true' }, false], [{ [FLAG]: '', [SHELL]: 'true' }, false], [{ [FLAG]: 'true', [SHELL]: 'false' }, false], [{ [FLAG]: ' true', [SHELL]: 'true' }, false]]) {
    check(assert.equal, load(env).STUDIO_THEME_BASE_DROPDOWN_ENABLED, expected, JSON.stringify(env))
  }
  const lib = load({ [FLAG]: 'true', [SHELL]: 'true' })
  check(assert.equal, lib.BASE_THEME_AUTO_NAME, 'Auto / session default')
  // the chosen value: the select's own rule
  for (const [draft, expected] of [[{ mode: 'auto' }, 'auto'], [{ mode: 'auto', preset_id: 'minimal' }, 'auto'], [{ mode: 'preset', preset_id: 'vibrant' }, 'vibrant'], [{ mode: 'custom', preset_id: 'minimal' }, 'minimal'], [{ mode: 'preset' }, 'corporate_light'],
    [{ mode: 'custom' }, 'corporate_light'], [{}, 'corporate_light'], [{ preset_id: '' }, 'corporate_light'], [{ mode: 'preset', preset_id: 'retired_theme' }, 'retired_theme']]) {
    check(assert.equal, lib.baseThemeSelectedId(draft), expected, ser(draft))
  }
  // the options: Auto, every preset in order, then the draft's own base when no preset has its id
  const presets = [{ preset_id: 'a', name: 'A' }, { preset_id: 'b', name: 'B' }, { preset_id: 'c', name: 'C' }]
  const options = plain(lib.baseThemeOptions(presets, { mode: 'preset', preset_id: 'b' }))
  check(assert.deepEqual, options.map(option => option.id), ['auto', 'a', 'b', 'c'])
  check(assert.deepEqual, options.map(option => option.name), ['Auto / session default', 'A', 'B', 'C'])
  check(assert.deepEqual, options[0], { id: 'auto', name: 'Auto / session default', hint: '', swatches: [], current: false })
  check(assert.equal, 'sub' in options[0], false, 'Auto has no sub, so the picker shows its own "Director picks for you" line')
  for (const option of options.slice(1)) {
    check(assert.equal, option.hint, '', 'no tooltip: the select had none')
    check(assert.equal, option.current, false)
    check(assert.equal, option.sub, '', 'nothing under a preset name')
    check(assert.deepEqual, option.swatches, [], 'no chips: the preview palette is not canon yet')
  }
  for (const draft of [{ mode: 'preset', preset_id: 'old' }, { mode: 'custom', preset_id: 'old' }, { preset_id: 'old' }]) {
    const withSaved = plain(lib.baseThemeOptions(presets, draft))
    check(assert.deepEqual, withSaved.map(option => option.id), ['auto', 'a', 'b', 'c', 'old'])
    check(assert.deepEqual, withSaved[4], { id: 'old', name: 'old (saved base)', hint: '', swatches: [], current: false, sub: '' })
  }
  for (const draft of [{ mode: 'auto' }, {}, { preset_id: '' }, { mode: 'preset' }, { mode: 'preset', preset_id: 'a' }]) {
    check(assert.equal, lib.baseThemeOptions(presets, draft).length, 4, `no saved-base row for ${ser(draft)}`)
  }
  check(assert.deepEqual, plain(lib.baseThemeOptions([], {})).map(option => option.id), ['auto'])
  check(assert.equal, lib.baseThemeOptions.length, 2)
  check(assert.equal, lib.baseThemeSelectedId.length, 1)
  const source = overrides[FILES.lib] ?? read(FILES.lib)
  check(assert.equal, ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true).statements.filter(ts.isImportDeclaration).length, 0, 'imports nothing')
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_BASE_DROPDOWN/g) ?? []).length, 1, 'flag read once, literal')
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL/g) ?? []).length, 1, 'shell read once, literal')
}

// ---- suite 2: the real workspace --------------------------------------------------------------------------------------------
async function workspaceSuite(overrides = {}) {
  const baseOverrides = { [FILES.workspace]: baseSource(FILES.workspace) }
  // flag off (unset, other values, or the flag without the shell): the base commit's tree on both tabs, for every draft
  for (const extra of [...ENV_OFF, ...[{ [FLAG]: 'true', [SHELL]: 'false' }]]) {
    for (const canon of Object.keys(extra).length === 0 || extra[SHELL] === 'false' ? [false, true] : [false]) {
      const env = { ...extra, ...(canon ? { [CANON]: 'true' } : {}) }
      for (const id of DRAFTS) {
        const mine = await createTab(env, id, overrides, { pickerMarker: false })
        const base = await createTab({ ...(canon ? { [CANON]: 'true' } : {}), ...(extra[SHELL] === 'false' ? { [SHELL]: 'false' } : {}) }, id, baseOverrides, { pickerMarker: false })
        check(assert.equal, ser(mine.tree), ser(base.tree), `${JSON.stringify(extra)} canon=${canon} draft=${id}: create tab is the base`)
        check(assert.ok, baseControl(mine.tree) && !dropdownControl(mine.tree), 'the native select is there, no dropdown')
        await mine.mode('library'); await base.mode('library')
        check(assert.equal, ser(mine.tree), ser(base.tree), `${JSON.stringify(extra)} canon=${canon} draft=${id}: library tab is the base`)
      }
    }
  }
  // flag on: the dropdown stands where the select stood, with the select's own choices and chosen value
  for (const canon of [false, true]) {
    const envOn = { ...ON, ...(canon ? { [CANON]: 'true' } : {}) }
    const envBase = canon ? { [CANON]: 'true' } : {}
    const presets = createLoader({ env: envBase }).load('lib/theme-builder.ts').FALLBACK_THEME_PRESETS
    check(assert.equal, presets.length, canon ? 10 : 6)
    for (const id of DRAFTS) {
      const cell = `canon=${canon} draft=${id}`
      const mine = await createTab(envOn, id, overrides)
      const base = await createTab(envBase, id, baseOverrides, { pickerMarker: false })
      const select = selectOf(baseControl(base.tree))
      const picker = pickerOf(mine.tree)
      check(assert.ok, picker, `${cell}: the picker`)
      check(assert.equal, baseControl(mine.tree), undefined, `${cell}: no native Base theme select`)
      check(assert.deepEqual, plain(picker.props.options.map(option => [option.id, option.name])), select.options, `${cell}: the select's choices and order`)
      check(assert.equal, picker.props.selectedId, select.value, `${cell}: the select's chosen value`)
      check(assert.equal, picker.props.locked, false, `${cell}: not locked`)
      check(assert.equal, dropdownControl(mine.tree).props['data-studio-library-dd'], 'true', `${cell}: the wrapper carries the marker the stylesheet hangs off`)
      check(assert.deepEqual, plain(picker.props.copy), { label: 'Base theme', help: 'Type to search', placeholder: 'Search themes', singular: 'theme', plural: 'themes', groups: false }, `${cell}: copy`)
      check(assert.equal, typeof picker.props.onSelect, 'function')
      check(assert.equal, picker.props.preview, undefined, `${cell}: no preview under it (the page has its own)`)
      for (const option of picker.props.options) check(assert.deepEqual, plain(option.swatches), [], `${cell} ${option.id}: no chips`)
      // nothing else moved: with the control taken out, both trees are the same
      check(assert.equal, withoutControl(mine.tree, node => node.props?.className === 'sl-base-dd'), withoutControl(base.tree, node => node.type === 'label' && text(node).startsWith('Base theme')), `${cell}: the rest of the Create tab is the base`)
      // the same handler: a pick through the dropdown leaves the page exactly where the select's change leaves it
      for (const pick of ['auto', 'minimal', canon ? 'mission_amber' : 'pastel']) {
        const m = await createTab(envOn, id, overrides), b = await createTab(envBase, id, baseOverrides, { pickerMarker: false })
        pickerOf(m.tree).props.onSelect(pick); m.render()
        flat(baseControl(b.tree)).find(node => node.type === 'select').props.onChange({ target: { value: pick } }); b.render()
        check(assert.equal, withoutControl(m.tree, node => node.props?.className === 'sl-base-dd'), withoutControl(b.tree, node => node.type === 'label' && text(node).startsWith('Base theme')), `${cell} pick=${pick}: the page after the pick`)
        check(assert.equal, pickerOf(m.tree).props.selectedId, selectOf(baseControl(b.tree)).value, `${cell} pick=${pick}: chosen value after the pick`)
      }
    }
  }
  // locked while a save is in flight (the fieldset the select sat in is disabled then)
  const saving = await createTab(ON, null, overrides, { saveHangs: true })
  saving.input('Theme name', 'Evergreen'); pickerOf(saving.tree).props.onSelect('minimal'); saving.render()
  check(assert.equal, pickerOf(saving.tree).props.locked, false, 'before a save starts')
  saving.click('Save reusable theme'); await saving.settle()
  check(assert.equal, pickerOf(saving.tree).props.locked, true, 'locked while the save is in flight')
  // wiring pins on the real sources
  const source = overrides[FILES.workspace] ?? read(FILES.workspace)
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_BASE_DROPDOWN/g) ?? []).length, 0, 'the workspace never reads the flag itself')
  check(assert.equal, (source.match(/<BaseThemePicker /g) ?? []).length, 1, 'one use')
  check(assert.ok, source.includes('<BaseThemePicker draft={draft} locked={Boolean(operation)} onSelect={changePreset} />'), 'the picker takes the draft, the saving lock and changePreset')
  check(assert.equal, (source.match(/<select /g) ?? []).length >= 3, true, 'the other selects are untouched')
  const pickerSource = overrides[FILES.picker] ?? read(FILES.picker)
  check(assert.equal, ts.createSourceFile('p.tsx', pickerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text).sort().join(','), "./base-theme-dropdown.css,@/components/theme-dropdown-picker,@/lib/studio-theme-base-dropdown,@/lib/theme-builder", 'the picker file imports only these')
  check(assert.equal, /fetch\(|useState|useEffect|useRef|process\.env|localStorage/.test(pickerSource), false, 'the picker file has no state, effect, request or env read')
}

// ---- suite 3: the stylesheet ------------------------------------------------------------------------------------------------
function cssSuite(overrides = {}) {
  const css = overrides[FILES.css] ?? read(FILES.css)
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(part => part.trim()).filter(Boolean).map(part => part.split('{')[0].trim())
  check(assert.ok, rules.length >= 20, 'the rules are there')
  for (const selector of rules) check(assert.match, selector, /^\.studio-library \[data-studio-library-dd="true"\]/, `scoped to the marker: ${selector}`)
  // the library's own tokens only; no other picker's token leaks in
  check(assert.equal, /--stp-|--sco-|--stpv2/.test(css), false, 'no other picker tokens')
  for (const token of ['--sl-line', '--sl-panel', '--sl-text', '--sl-muted', '--sl-accent', '--sl-soft']) check(assert.ok, css.includes(`var(${token})`), token)
  const defined = fs.readFileSync(path.join(treeRoot, 'components/studio-libraries/libraries.css'), 'utf8')
  for (const token of ['--sl-line', '--sl-panel', '--sl-text', '--sl-muted', '--sl-accent', '--sl-soft']) check(assert.ok, defined.includes(`${token}:`), `${token} is defined by the library page`)
  for (const part of ['stpdd-field', 'stpdd-input', 'stpdd-chevron', 'stpdd-list', 'stpdd-option', 'stpdd-check', 'stpdd-empty', 'stpdd-label', 'stpdd-combo']) check(assert.ok, css.includes(part), part)
  // colours come from the page's tokens: the only literal is the list's own shadow
  check(assert.deepEqual, [...new Set(css.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])], ['#22332222'], 'no hard-coded colour but the shadow')
  // every class it styles exists in the picker's markup
  const pickerSource = read('components/theme-dropdown-picker.tsx')
  for (const cls of new Set([...css.matchAll(/\.(stpdd[a-z-]*)/g)].map(match => match[1]))) check(assert.ok, pickerSource.includes(cls), `the picker has the class ${cls}`)
}

pureSuite()
await workspaceSuite()
cssSuite()

// ---- suite 4: mutants -------------------------------------------------------------------------------------------------------
const L = FILES.lib, W = FILES.workspace, P = FILES.picker, C = FILES.css
const MUTANTS = [
  ['helper: flag without the shell', L, " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", ''],
  ['helper: flag always on', L, "process.env.NEXT_PUBLIC_STUDIO_THEME_BASE_DROPDOWN === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", 'true'],
  ['helper: loose flag compare', L, "process.env.NEXT_PUBLIC_STUDIO_THEME_BASE_DROPDOWN === 'true'", "process.env.NEXT_PUBLIC_STUDIO_THEME_BASE_DROPDOWN !== 'false'"],
  ['helper: Auto label changed', L, "'Auto / session default'", "'Auto'"],
  ['helper: chosen value ignores Auto', L, "draft.mode === 'auto' ? 'auto' : draft.preset_id || 'corporate_light'", "draft.preset_id || 'corporate_light'"],
  ['helper: chosen value has no default', L, "draft.preset_id || 'corporate_light'", 'draft.preset_id'],
  ['helper: Auto missing', L, "const options: BaseThemeOption[] = [{ id: 'auto', name: BASE_THEME_AUTO_NAME, hint: '', swatches: [], current: false }]", 'const options: BaseThemeOption[] = []'],
  ['helper: Auto has a sub', L, "swatches: [], current: false }]\n  for", "swatches: [], current: false, sub: 'x' }]\n  for"],
  ['helper: presets reversed', L, 'for (const preset of presets) options.push', 'for (const preset of [...presets].reverse()) options.push'],
  ['helper: a preset has a hint', L, "name: preset.name, hint: ''", 'name: preset.name, hint: preset.preset_id'],
  ['helper: a preset gets chips', L, "name: preset.name, hint: '', swatches: []", "name: preset.name, hint: '', swatches: ['#ffffff']"],
  ['helper: preset row marked current', L, "swatches: [], current: false, sub: '' })\n  if", "swatches: [], current: true, sub: '' })\n  if"],
  ['helper: preset sub missing', L, "name: preset.name, hint: '', swatches: [], current: false, sub: '' }", "name: preset.name, hint: '', swatches: [], current: false }"],
  ['helper: saved base always added', L, 'if (draft.preset_id && !presets.some(preset => preset.preset_id === draft.preset_id))', 'if (draft.preset_id)'],
  ['helper: saved base never added', L, 'if (draft.preset_id && !presets.some(preset => preset.preset_id === draft.preset_id))', 'if (false)'],
  ['helper: saved base label changed', L, '`${draft.preset_id} (saved base)`', 'draft.preset_id'],
  ['helper: saved base gets chips', L, "name: `${draft.preset_id} (saved base)`, hint: '', swatches: []", "name: `${draft.preset_id} (saved base)`, hint: '', swatches: ['#112233']"],
  ['workspace: dropdown always', W, 'STUDIO_THEME_BASE_DROPDOWN_ENABLED ? <BaseThemePicker', 'true ? <BaseThemePicker'],
  ['workspace: dropdown never', W, 'STUDIO_THEME_BASE_DROPDOWN_ENABLED ? <BaseThemePicker', 'false ? <BaseThemePicker'],
  ['workspace: wrong handler', W, 'onSelect={changePreset}', 'onSelect={() => {}}'],
  ['workspace: never locked', W, 'locked={Boolean(operation)}', 'locked={false}'],
  ['workspace: always locked', W, 'locked={Boolean(operation)}', 'locked'],
  ['workspace: draft not passed', W, '<BaseThemePicker draft={draft}', '<BaseThemePicker draft={{ mode: "auto" }}'],
  ['workspace: select label changed', W, '<label className="sl-field">Base theme<select', '<label className="sl-field">Base<select'],
  ['workspace: select value changed', W, "<select value={draft.mode === 'auto' ? 'auto' : draft.preset_id || 'corporate_light'}", "<select value={draft.preset_id || 'corporate_light'}"],
  ['workspace: saved base option dropped', W, '{draft.preset_id && !FALLBACK_THEME_PRESETS.some(theme => theme.preset_id === draft.preset_id) && <option', '{false && <option'],
  ['picker: wrong copy label', P, "label: 'Base theme'", "label: 'Theme'"],
  ['picker: no search help', P, "help: 'Type to search'", 'help: null'],
  ['picker: wrong selected id', P, 'selectedId={baseThemeSelectedId(draft)}', 'selectedId={draft.preset_id ?? null}'],
  ['picker: lock dropped', P, 'locked={locked}', 'locked={false}'],
  ['picker: choice not forwarded', P, 'onSelect={onSelect}', 'onSelect={() => {}}'],
  ['picker: presets from nowhere', P, 'baseThemeOptions(FALLBACK_THEME_PRESETS, draft)', 'baseThemeOptions([], draft)'],
  ['picker: draft not given to the options', P, 'baseThemeOptions(FALLBACK_THEME_PRESETS, draft)', 'baseThemeOptions(FALLBACK_THEME_PRESETS, {})'],
  ['picker: marker dropped', P, ' data-studio-library-dd="true"', ''],
  ['picker: a preview added', P, 'copy={COPY} />', "copy={COPY} preview={{ kind: 'auto' }} />"],
  ['picker: an env read added', P, 'export function BaseThemePicker', "const read = process.env.NEXT_PUBLIC_X\nexport function BaseThemePicker"],
  ['css: a rule leaks out of the marker', C, '.studio-library [data-studio-library-dd="true"] .stpdd-label {', '.studio-library .stpdd-label {'],
  ['css: another picker\'s token', C, 'color: var(--sl-muted); font-size: 12px; font-weight: 600; }', 'color: var(--stp-muted); font-size: 12px; font-weight: 600; }'],
  ['css: a class the picker does not have', C, '.stpdd-empty {', '.stpdd-missing {'],
  ['css: a hard-coded colour replaces a token', C, 'background: var(--sl-panel); box-shadow: 0 10px 28px #22332222;', 'background: #ffffff; box-shadow: 0 10px 28px #22332222;'],
]
let caught = 0
const survivors = []
for (const [label, file, from, to] of MUTANTS) {
  const original = read(file)
  assert.ok(original.split(from).length - 1 >= 1, `mutant "${label}": the text to break is in ${file}`)
  const overrides = { [file]: original.replace(from, () => to) }
  let failed = false
  try { pureSuite(overrides); await workspaceSuite(overrides); cssSuite(overrides) } catch { failed = true }
  if (failed) caught++
  else survivors.push(label)
}
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join('; ')}`)
console.log(`studio-theme-base-dropdown: ${checks} checks passed, ${caught}/${MUTANTS.length} mutants caught`)
