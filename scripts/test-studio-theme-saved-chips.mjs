// PASS2D 6a: every saved theme in the composer's "My themes" list shows colour chips like the presets do
// (flag NEXT_PUBLIC_STUDIO_THEME_SAVED_CHIPS, exact "true" plus the Studio shell, default off).
// The finding (PASS2-J4-FINDINGS item 6a; S9): a theme saved on a preset ("QA J4 S9 test", Gilded Noir) was listed under My themes with no chip, while saved themes with an explicit brand colour
// had one. The row's chip is the explicit primary colour; a preset-based theme has none because its colours are the preset's, which the list never looked up.
//
// Run: node scripts/test-studio-theme-saved-chips.mjs   (plain node: transpile + vm, no network, no React runtime)
//   THEME_SAVED_CHIPS_BASE=<commit> overrides the base the flag-off identity is checked against (default fbc77c0, origin/studio-v4-dev-preparation-code before this change).
//
// Proven on the REAL sources: lib/studio-theme-saved-chips.ts (imports nothing), components/builder/studio-theme-menu.tsx and studio-saved-theme-picker.tsx (with lib/theme-preset-swatches.ts,
// which makes the Theme Builder read) run in a vm with a small hooks runtime and a local Theme Builder. Flag off (unset, any other value, or the flag without the Studio shell) renders the
// base commit's tree and the chips picker is never drawn. Flag on, a preset-based theme's chips are the canvas Theme dialog's own row for that preset (themeDropdownSwatches on the same
// contract). Then every suite is re-run against deliberately broken copies: each mutant must be caught.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const treeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const BASE_COMMIT = process.env.THEME_SAVED_CHIPS_BASE || 'fbc77c0'
const baseSource = file => execFileSync('git', ['show', `${BASE_COMMIT}:${file}`], { cwd: treeRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_SAVED_CHIPS'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const FILES = { lib: 'lib/studio-theme-saved-chips.ts', menu: 'components/builder/studio-theme-menu.tsx', picker: 'components/builder/studio-saved-theme-picker.tsx' }
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


const plain = value => JSON.parse(JSON.stringify(value))
const realPicker = createLoader({ env: {}, stubs: { react: createRuntime().react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons } }).load('components/theme-dropdown-picker.tsx')

// ---- a local Theme Builder: the five fields the picker reads from GET /api/v1/themes/presets/{id} -----------------------------------
const TB = 'http://tb.local.test'
const CONTRACTS = {
  gilded_noir: { hero: '#17140F', primary: '#C9A227', accent: '#C9A227', background: '#0F0D09', surface: '#17140F', text: '#F3EDE0' },
  minimal: { hero: '#111111', primary: '#E3241D', accent: '#E3241D', background: '#FFFFFF', surface: '#F2F2F2', text: '#111111' },
  corporate_light: { hero: '#121B32', primary: '#16203A', accent: '#D62A3C', background: '#F1F4F9', surface: '#FFFFFF', text: '#16203A' },
}
const contractBody = c => ({ palette: { hero: { hero_background: c.hero }, brand: { primary: c.primary }, accent: { accent: c.accent }, neutral: { background: c.background, surface: c.surface }, text: { text_primary: c.text } } })
function makeFetch(requests, mode = 'ok', gates = {}) {
  return async url => {
    requests.push(String(url))
    if (mode === 'down') throw new Error('network refused')
    if (gates[String(url).split('/').pop()]) await gates[String(url).split('/').pop()]
    const c = CONTRACTS[String(url).split('/').pop()]
    return c ? { ok: true, json: async () => contractBody(c) } : { ok: false, json: async () => ({}) }
  }
}
// Theme Builder's colours as the picker's own reader hands them on (lib/theme-preset-swatches.ts lower-cases every colour).
const lower = c => Object.fromEntries(Object.entries(c).map(([key, value]) => [key, value.toLowerCase()]))
const paletteOf = id => { const c = lower(CONTRACTS[id]); return { background: c.background, surface: c.surface, primary: c.primary, accent: c.accent, text: c.text, swatch: { canvas: '#ffffff', hero: c.hero, lead: c.primary } } }
const dialogChips = (id, overrides = {}) => { const c = lower(CONTRACTS[id]); const o = token => /^#[0-9a-fA-F]{6}$/.test(overrides[token] ?? '') ? overrides[token] : null
  return plain(realPicker.themeDropdownSwatches({ hero: c.hero, primary: o('primary') ?? c.primary, accent: o('accent') ?? c.accent, text: o('text_primary') ?? c.text, surface: o('surface') ?? c.surface, background: o('background') ?? c.background })) }

// ---- the saved themes the list is shown with --------------------------------------------------------------------------------------
const theme = (id, payload, extra = {}) => ({ id, name: `Theme ${id}`, description: null, is_standard: false, theme_payload: payload, ...extra })
const THEMES = [
  theme('c-one', { mode: 'custom', primary_hex: '#123456' }),
  theme('c-four', { mode: 'custom', primary_hex: '#1f6f78', secondary_hex: '#b87333', tertiary_hex: '#223344', neutral_hex: '#EEEEEE' }, { is_standard: true }),
  theme('c-override', { mode: 'custom', primary_hex: '#111111', color_overrides: { primary: '#abcdef' } }),
  theme('p-noir', { mode: 'preset', preset_id: 'gilded_noir' }),
  theme('p-minimal', { mode: 'preset', preset_id: 'minimal', color_overrides: { primary: '#00ff00', accent: '#ff00ff' } }),
  theme('p-noir-two', { mode: 'preset', preset_id: 'gilded_noir', color_overrides: { background: 'not-a-colour' } }),
  theme('p-retired', { mode: 'preset', preset_id: 'retired_theme' }),
  theme('p-retired-override', { mode: 'preset', preset_id: 'retired_theme', color_overrides: { primary: '#445566' } }),
  theme('a-auto', { mode: 'auto' }),
  theme('x-junk', null),
]
// what the base rows show: the explicit primary colour (a primary override, or a custom theme's primary_hex), or nothing
const EXPECT_BASE = { 'c-one': ['#123456'], 'c-four': ['#1f6f78'], 'c-override': ['#abcdef'], 'p-noir': [], 'p-minimal': ['#00ff00'], 'p-noir-two': [], 'p-retired': [], 'p-retired-override': ['#445566'], 'a-auto': [], 'x-junk': [] }

const noop = () => {}
const PRESETS = [{ preset_id: 'minimal', name: 'Minimal', description: 'd1' }, { preset_id: 'gilded_noir', name: 'Gilded Noir', description: 'd2' }]
const menuProps = (over = {}) => ({
  view: 'choices', onView: noop, onClose: noop, selection: { mode: 'auto' }, presets: PRESETS, presetsLoading: false, presetsError: false, themes: THEMES, selectedId: null, currentProfile: null,
  onPreset: noop, onSaved: noop, hex: '', onHex: noop, locked: false, lockReason: null, readBusy: false, readFailed: false, readEmpty: false, onRefresh: noop, name: '', onName: noop,
  asStandard: false, onAsStandard: noop, mutation: null, onSave: noop, onSetStandard: noop, onClearStandard: noop, onDelete: noop, dropdowns: true, ...over,
})
/** The real menu; the chips picker is a marker element ('SavedPicker') and the dropdown another ('Picker'), so each one's props stay readable. */
async function mountMenu(env, props, overrides = {}) {
  const runtime = createRuntime()
  const stubs = { react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, '@/components/theme-dropdown-picker': { ThemeDropdownPicker: 'Picker' }, './studio-saved-theme-picker': { SavedThemePicker: 'SavedPicker' } }
  const { StudioThemeMenu } = createLoader({ env, stubs, overrides }).load(FILES.menu)
  return { tree: runtime.render(StudioThemeMenu, props) }
}
/** The real chips picker as a stateful root, with a local Theme Builder; `mode`: 'ok', 'down' (the read throws), 'unconfigured' (no Theme Builder URL). */
async function mountPicker(props, overrides = {}, mode = 'ok', gates = {}) {
  const runtime = createRuntime()
  const requests = []
  const config = mode === 'unconfigured' ? () => { throw new Error('not configured') } : () => TB
  const stubs = { react: runtime.react, 'react/jsx-runtime': jsxRuntime, '@/components/theme-dropdown-picker': { ThemeDropdownPicker: 'Picker' }, '@/lib/config': { getThemeBuilderUrl: config } }
  const { SavedThemePicker } = createLoader({ env: {}, stubs, globals: { fetch: makeFetch(requests, mode === 'down' ? 'down' : 'ok', gates) }, overrides }).load(FILES.picker)
  let current = props
  const render = () => runtime.render(SavedThemePicker, current)
  const first = render()
  let tree = first
  for (let i = 0; i < 10; i++) { await tick(); if (!runtime.pending) break; tree = render() }
  tree = render()
  const mounted = { first, tree, requests, runtime, render, setProps(next) { current = next } }
  Object.defineProperty(mounted, 'tree', { get: () => tree, set: value => { tree = value } })
  mounted.render = () => { tree = render(); return tree }
  return mounted
}
const pickers = tree => flat(tree).filter(node => node.type === 'Picker')
const savedPickers = tree => flat(tree).filter(node => node.type === 'SavedPicker')
const chipsOf = options => Object.fromEntries(Array.from(options, option => [option.id, plain(option.swatches)]))
const chipsById = tree => chipsOf(pickers(tree)[0].props.options)
const ON = { [FLAG]: 'true', [SHELL]: 'true' }
const BASE_ENVS = [{}, { [SHELL]: 'true' }, { [FLAG]: 'true' }, { [FLAG]: 'TRUE', [SHELL]: 'true' }, { [FLAG]: '1', [SHELL]: 'true' }, { [FLAG]: 'false', [SHELL]: 'true' }, { [FLAG]: '', [SHELL]: 'true' }, { [FLAG]: ' true', [SHELL]: 'true' }]

// ---- suite 1: the pure helper -----------------------------------------------------------------------------------------------
function pureSuite(overrides = {}) {
  const load = env => createLoader({ env, overrides }).load(FILES.lib)
  for (const [env, expected] of [[{}, false], [{ [FLAG]: 'true' }, false], [{ [SHELL]: 'true' }, false], [{ [FLAG]: 'true', [SHELL]: 'true' }, true], [{ [FLAG]: 'TRUE', [SHELL]: 'true' }, false], [{ [FLAG]: '1', [SHELL]: 'true' }, false],
    [{ [FLAG]: 'false', [SHELL]: 'true' }, false], [{ [FLAG]: '', [SHELL]: 'true' }, false], [{ [FLAG]: 'true', [SHELL]: 'false' }, false], [{ [FLAG]: ' true', [SHELL]: 'true' }, false]]) {
    check(assert.equal, load(env).STUDIO_THEME_SAVED_CHIPS_ENABLED, expected, JSON.stringify(env))
  }
  const lib = load(ON)
  check(assert.equal, lib.SAVED_CHIP_LIMIT, 5)
  // which preset a saved theme's colours come from
  for (const [payload, expected] of [[{ mode: 'preset', preset_id: 'minimal' }, 'minimal'], [{ mode: 'preset', preset_id: ' ' }, null], [{ mode: 'preset' }, null], [{ mode: 'preset', preset_id: 7 }, null], [{ mode: 'custom', preset_id: 'minimal' }, null],
    [{ mode: 'auto', preset_id: 'minimal' }, null], [{ preset_id: 'minimal' }, null], [null, null], [undefined, null], ['preset', null], [[], null], [{ mode: 'preset', preset_id: 'gilded_noir', color_overrides: {} }, 'gilded_noir']]) {
    check(assert.equal, lib.savedThemePresetId(payload), expected, ser(payload))
  }
  // custom: the colours it names, primary first (an explicit primary override wins over primary_hex, as the single chip did)
  const chips = (payload, palette) => plain(lib.savedThemeChips(payload, palette))
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#123456' }), ['#123456'])
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#1f6f78', secondary_hex: '#b87333', tertiary_hex: '#223344', neutral_hex: '#EEEEEE' }), ['#1f6f78', '#b87333', '#223344', '#EEEEEE'])
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#111111', color_overrides: { primary: '#abcdef' } }), ['#abcdef'])
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#111111', color_overrides: { primary: '#abcdef', secondary: '#222222' } }), ['#abcdef', '#222222'])
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#111111', secondary_hex: '#111111', tertiary_hex: '#111111' }), ['#111111'], 'distinct')
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#ABCDEF', secondary_hex: '#abcdef' }), ['#ABCDEF'], 'distinct, case-insensitive, first spelling kept')
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: 'nope', secondary_hex: '#222222' }), ['#222222'], 'an invalid colour is skipped')
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#123456', secondary_hex: 'nope', tertiary_hex: '#12', neutral_hex: 7 }), ['#123456'], 'invalid secondary, tertiary and neutral are skipped')
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#123456', secondary_hex: '#12345678' }), ['#123456'], 'eight digits is not a colour')
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#12345' }), [], 'five digits is not a colour')
  check(assert.deepEqual, chips({ mode: 'custom' }), [])
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#123456' }, paletteOf('minimal')), ['#123456'], 'a custom theme ignores any preset palette')
  check(assert.deepEqual, chips({ mode: 'custom', primary_hex: '#123456', secondary_hex: '#654321', preset_id: 'minimal' }, paletteOf('minimal')), ['#123456', '#654321'], 'a custom theme shows its own colours, whatever palette it is given')
  // preset: the canvas dialog's own row, with the theme's valid overrides laid over it
  for (const id of Object.keys(CONTRACTS)) {
    check(assert.deepEqual, chips({ mode: 'preset', preset_id: id }, paletteOf(id)), dialogChips(id), `${id}: the dialog's row`)
    check(assert.deepEqual, chips({ mode: 'preset', preset_id: id, color_overrides: { primary: '#00ff00', text_primary: '#010203', surface: '#0a0b0c' } }, paletteOf(id)), dialogChips(id, { primary: '#00ff00', text_primary: '#010203', surface: '#0a0b0c' }), `${id}: overrides laid over it`)
    check(assert.deepEqual, chips({ mode: 'preset', preset_id: id, color_overrides: { primary: 'red', accent: '#12' } }, paletteOf(id)), dialogChips(id), `${id}: invalid overrides ignored`)
  }
  const noHero = { ...paletteOf('minimal'), swatch: undefined }
  check(assert.deepEqual, chips({ mode: 'preset', preset_id: 'minimal' }, noHero), plain(realPicker.themeDropdownSwatches({ primary: '#e3241d', accent: '#e3241d', text: '#111111', surface: '#f2f2f2', background: '#ffffff' })), 'no hero: the brand colour leads, as in the dialog')
  check(assert.ok, chips({ mode: 'preset', preset_id: 'corporate_light' }, paletteOf('corporate_light')).length <= 5)
  check(assert.equal, chips({ mode: 'preset', preset_id: 'minimal' }, { ...paletteOf('minimal'), swatch: { hero: '#000001', canvas: '#fff', lead: '#000' }, primary: '#000002', accent: '#000003', text: '#000004', surface: '#000005', background: '#000006' }).length, 5, 'five at most')
  // no palette (Theme Builder has not answered, or does not know the preset): what a row showed before, never an invented colour
  check(assert.deepEqual, chips({ mode: 'preset', preset_id: 'retired_theme' }, null), [])
  check(assert.deepEqual, chips({ mode: 'preset', preset_id: 'retired_theme' }, undefined), [])
  check(assert.deepEqual, chips({ mode: 'preset', preset_id: 'retired_theme', color_overrides: { primary: '#445566' } }, null), ['#445566'])
  check(assert.deepEqual, chips({ mode: 'preset', preset_id: 'retired_theme', color_overrides: { primary: 'x' } }, null), [])
  check(assert.deepEqual, chips({ mode: 'preset', color_overrides: { primary: '#445566' } }, paletteOf('minimal')), ['#445566'], 'a preset theme with no preset id has no palette')
  for (const junk of [null, undefined, 'x', 7, [], { mode: 'auto' }, { mode: 'auto', primary_hex: '#123456' }, {}]) check(assert.deepEqual, chips(junk, paletteOf('minimal')), [], ser(junk))
  check(assert.equal, lib.savedThemeChips.length, 2)
  const source = overrides[FILES.lib] ?? read(FILES.lib)
  check(assert.equal, ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true).statements.filter(ts.isImportDeclaration).length, 0, 'imports nothing')
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_SAVED_CHIPS/g) ?? []).length, 1, 'flag read once, literal')
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL/g) ?? []).length, 1, 'shell read once, literal')
}

// ---- suite 2: the real composer menu and the real chips picker --------------------------------------------------------------------
async function menuSuite(overrides = {}, { menuOverrides = overrides, pickerOverrides = overrides } = {}) {
  const baseOverrides = { [FILES.menu]: baseSource(FILES.menu) }
  const myPickerOf = tree => pickers(tree)[1]
  // --- the menu: flag off, in any way, is the base commit's tree (the flat list and the dropdowns); the chips picker is never drawn
  for (const env of BASE_ENVS) for (const dropdowns of [true, false]) for (const selectedId of [null, 'c-four', 'p-noir']) {
    const props = menuProps({ dropdowns, selectedId })
    const mine = await mountMenu(env, props, menuOverrides), base = await mountMenu({}, props, baseOverrides)
    check(assert.equal, ser(mine.tree), ser(base.tree), `${JSON.stringify(env)} dropdowns=${dropdowns} selected=${selectedId}: the base`)
    check(assert.equal, savedPickers(mine.tree).length, 0, `${JSON.stringify(env)}: no chips picker`)
  }
  // --- flag on, the flat list is the base's
  for (const selectedId of [null, 'p-noir']) {
    const props = menuProps({ dropdowns: false, selectedId })
    check(assert.equal, ser((await mountMenu(ON, props, menuOverrides)).tree), ser((await mountMenu({}, props, baseOverrides)).tree), `flat list, flag on, selected=${selectedId}: the base`)
  }
  // --- flag on, the dropdowns: the chips picker takes the My themes picker's place, with its props
  for (const props of [menuProps(), menuProps({ selectedId: 'p-noir' }), menuProps({ locked: true }), menuProps({ themes: [] }), menuProps({ readFailed: true, readEmpty: true })]) {
    const base = await mountMenu({}, props, baseOverrides), mine = await mountMenu(ON, props, menuOverrides)
    check(assert.equal, savedPickers(mine.tree).length, 1, 'one chips picker')
    check(assert.equal, pickers(mine.tree).length, 1, 'and the Deckster themes picker only')
    const saved = savedPickers(mine.tree)[0], was = myPickerOf(base.tree)
    check(assert.equal, ser(pickers(mine.tree)[0]), ser(pickers(base.tree)[0]), 'the Deckster themes picker is the base')
    check(assert.equal, ser(saved.props.options), ser(was.props.options), 'the rows are the base rows')
    check(assert.equal, saved.props.themes, props.themes, 'the saved themes')
    for (const key of ['selectedId', 'locked', 'copy', 'labelAccessory', 'onSelect']) check(assert.equal, ser(saved.props[key]), ser(was.props[key]), `prop ${key}`)
    check(assert.equal, saved.props.onSelect, props.onSaved, 'the menu\'s own handler')
    check(assert.deepEqual, Object.keys(saved.props).sort(), ['copy', 'labelAccessory', 'locked', 'onSelect', 'options', 'selectedId', 'themes'], 'the props it is given')
    const swap = (tree, node, marker) => ser(tree).split(ser(node)).join(marker)
    check(assert.equal, swap(mine.tree, saved, '__MY__'), swap(base.tree, was, '__MY__'), 'the rest of the menu is the base')
  }
  const handled = []
  const wired = await mountMenu(ON, menuProps({ onSaved: id => handled.push(id) }), menuOverrides)
  savedPickers(wired.tree)[0].props.onSelect('p-noir'); check(assert.deepEqual, handled, ['p-noir'], 'a pick reaches the menu\'s own handler')

  // --- the chips picker, from the base rows the menu builds
  const baseRows = chipsOf(myPickerOf((await mountMenu({}, menuProps(), baseOverrides)).tree).props.options)
  check(assert.deepEqual, baseRows, EXPECT_BASE, 'the base rows (explicit primary chip only)')
  const rows = myPickerOf((await mountMenu({}, menuProps(), baseOverrides)).tree).props.options
  const pickerProps = (over = {}) => ({ themes: THEMES, options: rows, selectedId: null, locked: false, onSelect: noop, copy: { label: 'My themes' }, labelAccessory: 'ACC', ...over })
  const mine = await mountPicker(pickerProps(), pickerOverrides)
  // before Theme Builder answers: a custom theme already shows the colours it names (no read needed); a preset-based row has the chip it had
  check(assert.deepEqual, chipsById(mine.first), { ...baseRows, 'c-four': ['#1f6f78', '#b87333', '#223344', '#EEEEEE'] }, 'before the answer')
  const expected = {
    'c-one': ['#123456'], 'c-four': ['#1f6f78', '#b87333', '#223344', '#EEEEEE'], 'c-override': ['#abcdef'],
    'p-noir': dialogChips('gilded_noir'), 'p-minimal': dialogChips('minimal', { primary: '#00ff00', accent: '#ff00ff' }), 'p-noir-two': dialogChips('gilded_noir'),
    'p-retired': [], 'p-retired-override': ['#445566'], 'a-auto': [], 'x-junk': [],
  }
  check(assert.deepEqual, chipsById(mine.tree), expected, 'after the answer')
  check(assert.deepEqual, [...mine.requests].sort(), ['gilded_noir', 'minimal', 'retired_theme'].map(id => `${TB}/api/v1/themes/presets/${id}`), 'one read per preset a saved theme is built on, nothing else')
  check(assert.ok, chipsById(mine.tree)['p-noir'].length >= 3 && chipsById(mine.tree)['p-noir'].includes('#c9a227') && chipsById(mine.tree)['p-noir'].includes('#17140f'), 'a theme saved on Gilded Noir has its gold and near-black chips')
  // everything but the chips is the row the menu gave it
  const strip = options => ser(Array.from(options, option => ({ ...option, swatches: 0 })))
  check(assert.equal, strip(pickers(mine.tree)[0].props.options), strip(rows), 'ids, names, hints, sub lines, order')
  const without = picker => ser({ ...picker, props: { ...picker.props, options: 0 } })
  check(assert.equal, without(pickers(mine.tree)[0]), ser({ type: 'Picker', props: { options: 0, selectedId: null, locked: false, onSelect: noop, copy: { label: 'My themes' }, labelAccessory: 'ACC' }, key: undefined }), 'selection, lock, copy, accessory and handler pass through')
  check(assert.equal, pickers(mine.tree)[0].props.onSelect, noop, 'the handler itself')
  const picked = await mountPicker(pickerProps({ selectedId: 'p-noir', locked: true }), pickerOverrides)
  check(assert.equal, pickers(picked.tree)[0].props.selectedId, 'p-noir'); check(assert.equal, pickers(picked.tree)[0].props.locked, true)
  // no saved theme on a preset: nothing is read
  const customOnly = THEMES.filter(item => item.theme_payload?.mode !== 'preset')
  const noPresets = await mountPicker(pickerProps({ themes: customOnly, options: rows.filter(row => customOnly.some(item => item.id === row.id)) }), pickerOverrides)
  check(assert.deepEqual, noPresets.requests, [], 'custom themes need no read')
  check(assert.deepEqual, chipsById(noPresets.tree)['c-four'], ['#1f6f78', '#b87333', '#223344', '#EEEEEE'])
  const empty = await mountPicker(pickerProps({ themes: [], options: [] }), pickerOverrides)
  check(assert.deepEqual, empty.requests, [], 'no saved themes, no read'); check(assert.equal, pickers(empty.tree)[0].props.options.length, 0)
  // a theme that is not in the list of rows is left out; a row with no theme is left alone
  const orphan = await mountPicker(pickerProps({ options: [{ id: 'ghost', name: 'Ghost', hint: '', swatches: ['#010101'], current: false, sub: '' }] }), pickerOverrides)
  check(assert.deepEqual, chipsById(orphan.tree), { ghost: ['#010101'] }, 'a row without a saved theme is untouched')
  // the same presets again: the list is re-read only when the set of presets changes (the helper caches per page load; the picker asks once per set)
  const again = await mountPicker(pickerProps(), pickerOverrides)
  again.render(); await tick(); again.render()
  check(assert.equal, again.requests.length, 3, 'a re-render asks nothing more')
  // a row whose theme yields no chips keeps the chip it was given
  const kept = await mountPicker(pickerProps({ options: [{ id: 'x-junk', name: 'Junk', hint: '', swatches: ['#010101'], current: false, sub: '' }, { id: 'a-auto', name: 'Auto', hint: '', swatches: [], current: false, sub: '' }] }), pickerOverrides)
  check(assert.deepEqual, chipsById(kept.tree), { 'x-junk': ['#010101'], 'a-auto': [] }, 'no chips to show: the row is as it was')
  // an answer for a set of presets that is no longer the list's does not land over the current one
  let release
  const gate = new Promise(resolve => { release = resolve })
  const stale = await mountPicker(pickerProps({ themes: [THEMES[3]], options: rows.filter(row => row.id === 'p-noir') }), pickerOverrides, 'ok', { gilded_noir: gate })
  check(assert.deepEqual, chipsById(stale.tree), { 'p-noir': [] }, 'its answer is still out')
  const minimalOnly = { themes: [THEMES[4]], options: rows.filter(row => row.id === 'p-minimal') }
  stale.setProps(pickerProps(minimalOnly)); stale.render(); await tick(); stale.render(); await tick(); stale.render()
  check(assert.deepEqual, chipsById(stale.tree), { 'p-minimal': dialogChips('minimal', { primary: '#00ff00', accent: '#ff00ff' }) }, 'the current set answered')
  release(); await tick(); await tick(); stale.render()
  check(assert.deepEqual, chipsById(stale.tree), { 'p-minimal': dialogChips('minimal', { primary: '#00ff00', accent: '#ff00ff' }) }, 'the late answer for the old set changes nothing')
  // Theme Builder down: a row keeps the chip it had, nothing throws
  const down = await mountPicker(pickerProps(), pickerOverrides, 'down')
  check(assert.deepEqual, chipsById(down.tree), { ...baseRows, 'c-four': ['#1f6f78', '#b87333', '#223344', '#EEEEEE'] }, 'Theme Builder unreachable: the rows as before')
  check(assert.equal, down.requests.length, 3, 'it was asked, and could not answer')
  // no Theme Builder URL configured: no read
  const unconfigured = await mountPicker(pickerProps(), pickerOverrides, 'unconfigured')
  check(assert.deepEqual, unconfigured.requests, [], 'no Theme Builder URL, no read')
  check(assert.deepEqual, chipsById(unconfigured.tree), { ...baseRows, 'c-four': ['#1f6f78', '#b87333', '#223344', '#EEEEEE'] })

  // --- wiring pins on the real sources
  const menuSource = menuOverrides[FILES.menu] ?? read(FILES.menu)
  check(assert.equal, (menuSource.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_SAVED_CHIPS/g) ?? []).length, 0, 'the menu never reads the flag itself')
  check(assert.equal, (menuSource.match(/<SavedThemePicker /g) ?? []).length, 1, 'one use')
  check(assert.ok, menuSource.includes('<SavedThemePicker themes={p.themes} options={myThemeOptions} selectedId={p.selectedId} locked={p.locked} onSelect={p.onSaved} copy={MY_THEMES_COPY} labelAccessory={refreshButton} />'), 'it takes the menu\'s own rows and handlers')
  const pickerSource = pickerOverrides[FILES.picker] ?? read(FILES.picker)
  check(assert.equal, ts.createSourceFile('p.tsx', pickerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text).sort().join(','),
    "@/components/theme-dropdown-picker,@/hooks/use-theme-profiles,@/lib/config,@/lib/studio-theme-saved-chips,@/lib/theme-preset-swatches,react", 'the picker file imports only these')
  check(assert.equal, /process\.env|localStorage|method:|POST|PUT|DELETE|PATCH/.test(pickerSource), false, 'no env read, storage or write in the picker file')
  check(assert.equal, (pickerSource.match(/loadPresetSwatchPalettes\(/g) ?? []).length, 1, 'one read helper, the dialog\'s own')
}

pureSuite()
await menuSuite()

// ---- suite 3: mutants -------------------------------------------------------------------------------------------------------
const L = FILES.lib, M = FILES.menu, P = FILES.picker
const MUTANTS = [
  ['helper: flag without the shell', L, " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", ''],
  ['helper: flag always on', L, "process.env.NEXT_PUBLIC_STUDIO_THEME_SAVED_CHIPS === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", 'true'],
  ['helper: loose flag compare', L, "process.env.NEXT_PUBLIC_STUDIO_THEME_SAVED_CHIPS === 'true'", "process.env.NEXT_PUBLIC_STUDIO_THEME_SAVED_CHIPS !== 'false'"],
  ['helper: limit raised', L, 'export const SAVED_CHIP_LIMIT = 5', 'export const SAVED_CHIP_LIMIT = 6'],
  ['helper: limit lowered', L, 'export const SAVED_CHIP_LIMIT = 5', 'export const SAVED_CHIP_LIMIT = 3'],
  ['helper: duplicates kept', L, 'if (seen.has(key)) continue', 'if (false) continue'],
  ['helper: case-sensitive duplicates', L, 'const key = value.toLowerCase()', 'const key = value'],
  ['helper: invalid colours kept', L, "if (typeof value !== 'string' || !HEX.test(value)) continue", "if (typeof value !== 'string') continue"],
  ['helper: short hex accepted', L, 'const HEX = /^#[0-9a-fA-F]{6}$/', 'const HEX = /^#[0-9a-fA-F]{3,6}$/'],
  ['helper: preset mode not required', L, "payload.mode !== 'preset') return null", "payload.mode === 'auto') return null"],
  ['helper: blank preset id accepted', L, "payload.preset_id.trim() !== '' ? payload.preset_id : null", 'payload.preset_id : null'],
  ['helper: custom ignores secondary', L, 'overrides.secondary ?? payload.secondary_hex, ', ''],
  ['helper: custom ignores neutral', L, ', overrides.neutral ?? payload.neutral_hex', ''],
  ['helper: primary override loses', L, 'HEX.test(String(overrides.primary)) ? overrides.primary : payload.mode', 'false ? overrides.primary : payload.mode'],
  ['helper: custom uses the preset palette', L, "if (payload.mode === 'custom') {", "if (payload.mode === 'custom' && !palette) {"],
  ['helper: preset needs no palette', L, 'if (savedThemePresetId(payload) !== null && isRecord(palette))', 'if (savedThemePresetId(payload) !== null)'],
  ['helper: hero ignored', L, 'palette.swatch?.hero ?? primary, primary', 'primary, primary'],
  ['helper: overrides ignored', L, "HEX.test(String(overrides[token])) ? overrides[token] : fallback", 'fallback'],
  ['helper: invalid overrides used', L, "HEX.test(String(overrides[token])) ? overrides[token] : fallback", 'overrides[token] ?? fallback'],
  ['helper: text token wrong', L, "pick('text_primary', palette.text)", "pick('text', palette.text)"],
  ['helper: accent dropped', L, "pick('accent', palette.accent), ", ''],
  ['helper: background dropped', L, ", pick('background', palette.background)", ''],
  ['helper: fallback loses the explicit primary', L, 'return distinctColors([explicitPrimary])', 'return []'],
  ['helper: auto themes get chips', L, "if (savedThemePresetId(payload) !== null && isRecord(palette))", "if (isRecord(palette))"],
  ['menu: chips always', M, 'STUDIO_THEME_SAVED_CHIPS_ENABLED ? <SavedThemePicker', 'true ? <SavedThemePicker'],
  ['menu: chips never', M, 'STUDIO_THEME_SAVED_CHIPS_ENABLED ? <SavedThemePicker', 'false ? <SavedThemePicker'],
  ['menu: wrong handler', M, 'onSelect={p.onSaved} copy={MY_THEMES_COPY} labelAccessory={refreshButton} /> :', 'onSelect={p.onPreset} copy={MY_THEMES_COPY} labelAccessory={refreshButton} /> :'],
  ['menu: lock dropped', M, 'locked={p.locked} onSelect={p.onSaved} copy={MY_THEMES_COPY} labelAccessory={refreshButton} /> :', 'locked={false} onSelect={p.onSaved} copy={MY_THEMES_COPY} labelAccessory={refreshButton} /> :'],
  ['menu: accessory dropped', M, 'copy={MY_THEMES_COPY} labelAccessory={refreshButton} /> :', 'copy={MY_THEMES_COPY} /> :'],
  ['menu: themes not passed', M, '<SavedThemePicker themes={p.themes}', '<SavedThemePicker themes={[]}'],
  ['menu: the Deckster list gets the chips picker', M, '<ThemeDropdownPicker options={decksterOptions}', '<SavedThemePicker themes={p.themes} options={decksterOptions}'],
  ['picker: reads for every theme', P, 'const presetId = savedThemePresetId(theme.theme_payload)\n    const chips', 'const presetId = String(theme.id)\n    const chips'],
  ['picker: no read', P, 'loadPresetSwatchPalettes(baseUrl, presetKey.split(\'|\')).then(loaded => {', 'Promise.resolve({}).then(loaded => {'],
  ['picker: answer ignored', P, 'if (!cancelled) setPalettes(loaded)', 'if (!cancelled) setPalettes({})'],
  ['picker: reads when nothing needs it', P, 'if (!presetKey) return', ''],
  ['picker: a stale answer lands', P, 'if (!cancelled) setPalettes(loaded)', 'setPalettes(loaded)'],
  ['picker: chips replace even when empty', P, 'return chips.length > 0 ? { ...option, swatches: chips } : option', 'return { ...option, swatches: chips }'],
  ['picker: wrong theme matched', P, 'themes.find(item => item.id === option.id)', 'themes[0]'],
  ['picker: selection dropped', P, 'selectedId={selectedId}', 'selectedId={null}'],
  ['picker: handler dropped', P, 'onSelect={onSelect}', 'onSelect={() => {}}'],
  ['picker: a write added', P, 'if (!presetKey) return', "if (!presetKey) return\n    void fetch('/api/themes', { method: 'POST' })"],
]
let caught = 0
const survivors = []
for (const [label, file, from, to] of MUTANTS) {
  const original = read(file)
  assert.ok(original.split(from).length - 1 >= 1, `mutant "${label}": the text to break is in ${file}`)
  const overrides = { [file]: original.replace(from, () => to) }
  let failed = false
  try { pureSuite(overrides); await menuSuite(overrides) } catch { failed = true }
  if (failed) caught++
  else survivors.push(label)
}
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join('; ')}`)
console.log(`studio-theme-saved-chips: ${checks} checks passed, ${caught}/${MUTANTS.length} mutants caught`)
