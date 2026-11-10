// PASS2D 4b: theme descriptions in plain words, and theme search on names only (flag NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS, exact "true" plus the Studio shell, default off).
// The finding (PASS2-J4-FINDINGS item 4b; THEME-2 look-and-feel ranks 2 and 3): Theme Builder's canon descriptions are engineers' style notes ("card-token", "acid #D6F221",
// "role-swap"), shown in the canvas dialog's preview header and tooltips, and the composer's Build theme search matched them ("gold" returned Vibrant for hidden text).
// #363 only moved the descriptions into tooltips. With the flag on a known theme is described by its plain-words line, and a search matches names only.
//
// Run: node scripts/test-studio-theme-plain-words.mjs   (plain node: transpile + vm, no network, no React runtime)
//   THEME_PLAIN_WORDS_BASE=<commit> overrides the base the flag-off identity is checked against (default fbc77c0, origin/studio-v4-dev-preparation-code before this change).
//
// Proven on the REAL sources: lib/studio-theme-plain-words.ts (imports nothing), components/theme-panel.tsx and components/builder/studio-theme-menu.tsx (with the lib files and the
// dropdown picker they use) run in a vm with a small hooks runtime. Flag off (unset, any other value, or the flag without the Studio shell) both render the base commit's tree,
// cell for cell. Then every suite is re-run against deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const treeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const BASE_COMMIT = process.env.THEME_PLAIN_WORDS_BASE || 'fbc77c0'
const baseSource = file => execFileSync('git', ['show', `${BASE_COMMIT}:${file}`], { cwd: treeRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS'
const V2 = 'NEXT_PUBLIC_STUDIO_THEME_PICKER_V2'
const DROPDOWN = 'NEXT_PUBLIC_STUDIO_THEME_DROPDOWN'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const CANON = 'NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED'
const FILES = { lib: 'lib/studio-theme-plain-words.ts', panel: 'components/theme-panel.tsx', menu: 'components/builder/studio-theme-menu.tsx' }
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

function mountPanel(env, overrides = {}) {
  const runtime = createRuntime()
  const stubs = { react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, 'next/link': { default: 'Link' }, '@/components/ui/button': { Button: 'Button' }, '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9' }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') } }
  const { ThemePanel } = createLoader({ env, stubs, globals: { fetch: async () => ({ ok: false, json: async () => ({}) }) }, overrides }).load(FILES.panel)
  return {
    async render(props) {
      let tree = runtime.render(ThemePanel, props)
      for (let i = 0; i < 8; i++) {
        await tick()
        if (!runtime.pending) break
        tree = runtime.render(ThemePanel, props)
      }
      return tree
    },
  }
}

const text = node => Array.isArray(node) ? node.map(text).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)

/** The composer's Build theme menu; the dropdown picker is a marker element so its options stay readable. */
function renderMenu(env, props, overrides = {}) {
  const runtime = createRuntime()
  const stubs = { react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, '@/components/theme-dropdown-picker': { ThemeDropdownPicker: 'Picker' } }
  const { StudioThemeMenu } = createLoader({ env, stubs, overrides }).load(FILES.menu)
  return runtime.render(StudioThemeMenu, props)
}
const realMatches = createLoader({ env: {}, stubs: { react: createRuntime().react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons } }).load('components/theme-dropdown-picker.tsx').themeDropdownMatches

// ---- fixtures ---------------------------------------------------------------------------------------------------------------
const ids6 = ['corporate_light', 'corporate_dark', 'minimal', 'vibrant', 'executive', 'pastel']
const ids4 = ['concrete_acid', 'espresso_editorial', 'gilded_noir', 'mission_amber']
const SYNC = { idle: { status: 'idle', requestId: null, presentationId: null, themeFingerprint: null, error: null }, applied: { status: 'applied', requestId: 'r1', presentationId: 'deck-1', themeFingerprint: 'fp', error: null } }
const SELECTIONS = [{ mode: 'auto' }, ...[...ids6, ...ids4].map(id => ({ mode: 'preset', preset_id: id })), { mode: 'custom', primary_hex: '#1e40af' }]
const ENVS = [
  { name: 'plain (no shell)', env: {}, canon: false },
  { name: 'plain (shell)', env: { [SHELL]: 'true' }, canon: false },
  { name: 'plain (shell) + canon', env: { [SHELL]: 'true', [CANON]: 'true' }, canon: true },
  { name: 'picker v2', env: { [SHELL]: 'true', [V2]: 'true' }, canon: false },
  { name: 'picker v2 + canon', env: { [SHELL]: 'true', [V2]: 'true', [CANON]: 'true' }, canon: true },
  { name: 'dropdown', env: { [SHELL]: 'true', [DROPDOWN]: 'true' }, canon: false },
  { name: 'dropdown + canon', env: { [SHELL]: 'true', [DROPDOWN]: 'true', [CANON]: 'true' }, canon: true },
]
const baseProps = (over = {}) => ({ isOpen: true, onClose() {}, presentationId: 'deck-1', buildThemeSelection: { mode: 'auto' }, themeSync: SYNC.idle, selectionLocked: false, onBuildThemeChange() {}, ...over })
// What Theme Builder serves today (UAT): the canon style notes, in the composer's own list.
const TB_PRESETS = [
  { preset_id: 'corporate_light', name: 'Corporate Light', description: 'Board-briefing light style — navy bookends, crimson accent, steel charts' },
  { preset_id: 'vibrant', name: 'Vibrant', description: 'Card-over-art cream style — vermilion accent with gold role-swap on dark' },
  { preset_id: 'minimal', name: 'Minimal', description: 'Hairline paper style — black-as-color with THE one red element per slide' },
  { preset_id: 'concrete_acid', name: 'Concrete Acid', description: 'Flat concrete slabs, sharp corners — acid #D6F221 reserved for the takeaway' },
  { preset_id: 'gilded_noir', name: 'Gilded Noir', description: 'Border-not-fill near-black — 1px gold hairlines, gold as line and type' },
  { preset_id: 'mission_amber', name: 'Mission Amber', description: 'Dual-ground dark card-token — orange on dark, red form on paper slides' },
  { preset_id: 'brand_new_preset', name: 'Brand New', description: 'A description from a newer Theme Builder' },
  { preset_id: 'constructor', name: 'Constructor', description: 'An id that is also an Object property' },
]
const noop = () => {}
const menuProps = (over = {}) => ({
  view: 'choices', onView: noop, onClose: noop, selection: { mode: 'auto' }, presets: TB_PRESETS, presetsLoading: false, presetsError: false, themes: [], selectedId: null, currentProfile: null,
  onPreset: noop, onSaved: noop, hex: '', onHex: noop, locked: false, lockReason: null, readBusy: false, readFailed: false, readEmpty: false, onRefresh: noop, name: '', onName: noop,
  asStandard: false, onAsStandard: noop, mutation: null, onSave: noop, onSetStandard: noop, onClearStandard: noop, onDelete: noop, dropdowns: true, ...over,
})
const BANNED = /card-token|role-swap|hairline|border-not-fill|acid|hex|token|palette study|#[0-9a-f]{3,6}\b|\d/i

// ---- suite 1: the pure helper -----------------------------------------------------------------------------------------------
function pureSuite(overrides = {}) {
  const load = env => createLoader({ env, overrides }).load(FILES.lib)
  // the flag needs its own exact "true" AND the Studio shell
  for (const [env, expected] of [[{}, false], [{ [FLAG]: 'true' }, false], [{ [SHELL]: 'true' }, false], [{ [FLAG]: 'true', [SHELL]: 'true' }, true], [{ [FLAG]: 'TRUE', [SHELL]: 'true' }, false], [{ [FLAG]: '1', [SHELL]: 'true' }, false],
    [{ [FLAG]: 'false', [SHELL]: 'true' }, false], [{ [FLAG]: '', [SHELL]: 'true' }, false], [{ [FLAG]: 'true', [SHELL]: 'false' }, false], [{ [FLAG]: ' true', [SHELL]: 'true' }, false], [{ [FLAG]: 'true', [SHELL]: 'TRUE' }, false]]) {
    check(assert.equal, load(env).STUDIO_THEME_PLAIN_WORDS_ENABLED, expected, JSON.stringify(env))
  }
  const lib = load({ [FLAG]: 'true', [SHELL]: 'true' })
  // the table: the ten presets, one line each, plain words
  check(assert.deepEqual, Object.keys(lib.THEME_PLAIN_DESCRIPTIONS).sort(), [...ids6, ...ids4].sort(), 'the ten Theme Builder presets, no more and no fewer')
  const seen = new Set()
  for (const [id, line] of Object.entries(lib.THEME_PLAIN_DESCRIPTIONS)) {
    check(assert.equal, typeof line, 'string', id)
    check(assert.ok, line.length >= 30 && line.length <= 90, `${id}: short enough to be a tooltip, long enough to say something (${line.length})`)
    check(assert.match, line, /^[A-Z][^]*\.$/, `${id}: a sentence`)
    check(assert.equal, BANNED.test(line), false, `${id}: no style-note jargon, colour codes or digits: ${line}`)
    check(assert.equal, /[—–]/.test(line), false, `${id}: no dashes`)
    check(assert.equal, seen.has(line), false, `${id}: unique`)
    seen.add(line)
  }
  // themePlainDescription
  for (const id of [...ids6, ...ids4]) {
    check(assert.equal, lib.themePlainDescription(true, id, 'ORIGINAL'), lib.THEME_PLAIN_DESCRIPTIONS[id], `${id} on`)
    check(assert.equal, lib.themePlainDescription(false, id, 'ORIGINAL'), 'ORIGINAL', `${id} off`)
  }
  for (const enabled of [false, 'true', 1, undefined, null, 0, '']) check(assert.equal, lib.themePlainDescription(enabled, 'minimal', 'ORIGINAL'), 'ORIGINAL', `enabled=${String(enabled)}`)
  for (const id of ['brand_new_preset', '', 'Minimal', ' minimal', 'minimal ', 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', null, undefined, 7, {}]) {
    check(assert.equal, lib.themePlainDescription(true, id, 'ORIGINAL'), 'ORIGINAL', `unknown id ${String(id)} keeps its own description`)
  }
  // themeSearchText: names only with the flag on; the base's text (name, space, description) with it off
  check(assert.equal, lib.themeSearchText(true, 'Vibrant', 'gold role-swap'), 'Vibrant')
  check(assert.equal, lib.themeSearchText(false, 'Vibrant', 'gold role-swap'), 'Vibrant gold role-swap')
  for (const enabled of ['true', 1, undefined, null]) check(assert.equal, lib.themeSearchText(enabled, 'N', 'D'), 'N D', `enabled=${String(enabled)}`)
  check(assert.equal, lib.themePlainDescription.length, 3)
  check(assert.equal, lib.themeSearchText.length, 3)
  // import-free; both env reads literal
  const source = overrides[FILES.lib] ?? read(FILES.lib)
  check(assert.equal, ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true).statements.filter(ts.isImportDeclaration).length, 0, 'imports nothing')
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS/g) ?? []).length, 1, 'flag read once, literal')
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL/g) ?? []).length, 1, 'shell read once, literal')
}

// ---- suite 2: the real Theme dialog -----------------------------------------------------------------------------------------
async function panelSuite(overrides = {}) {
  const baseOverrides = { [FILES.panel]: baseSource(FILES.panel) }
  const on = { [FLAG]: 'true' }
  // flag off, in any way (unset, other values, or the flag without the shell): the base commit's tree, in every env and cell
  for (const { name, env } of ENVS) {
    for (const extra of [{}, { [FLAG]: 'false' }, { [FLAG]: '' }, { [FLAG]: '1' }, { [FLAG]: 'TRUE' }, ...(env[SHELL] ? [] : [{ [FLAG]: 'true' }])]) {
      for (const selection of SELECTIONS) for (const status of Object.keys(SYNC)) {
        const props = baseProps({ buildThemeSelection: selection, themeSync: SYNC[status] })
        check(assert.equal, ser(await mountPanel({ ...env, ...extra }, overrides).render(props)), ser(await mountPanel(env, baseOverrides).render(props)), `${name} ${JSON.stringify(extra)} ${selection.preset_id ?? selection.mode} ${status}: the base`)
      }
    }
  }
  // flag on (with the shell): the descriptions change and nothing else does
  const builderOf = canon => createLoader({ env: canon ? { [CANON]: 'true' } : {} }).load('lib/theme-builder.ts')
  const plainLib = createLoader({ env: { ...on, [SHELL]: 'true' }, overrides }).load(FILES.lib)
  for (const { name, env, canon } of ENVS.filter(entry => entry.env[SHELL])) {
    const presets = builderOf(canon).FALLBACK_THEME_PRESETS
    check(assert.equal, presets.length, canon ? 10 : 6, `${name}: the presets the panel lists`)
    for (const selection of SELECTIONS) for (const status of Object.keys(SYNC)) {
      const props = baseProps({ buildThemeSelection: selection, themeSync: SYNC[status] })
      const cell = `${name} ${selection.preset_id ?? selection.mode} ${status}`
      const mine = ser(await mountPanel({ ...env, ...on }, overrides).render(props))
      const base = ser(await mountPanel(env, baseOverrides).render(props))
      // base with every description swapped for its plain-words line is exactly the flag-on tree (names, colours, order, handlers untouched)
      let expected = base
      for (const preset of presets) expected = expected.split(JSON.stringify(preset.description)).join(JSON.stringify(plainLib.themePlainDescription(true, preset.preset_id, preset.description)))
      check(assert.equal, mine, expected, `${cell}: only the descriptions differ`)
      // and no style note survives anywhere in the panel
      for (const preset of presets) if (plainLib.THEME_PLAIN_DESCRIPTIONS[preset.preset_id] !== preset.description) check(assert.equal, mine.includes(preset.description), false, `${cell}: the style note for ${preset.preset_id} is gone`)
    }
  }
  // the words reach the places a person reads them
  const cardTitles = tree => flat(tree).filter(node => node.props?.['data-studio-theme-preset'] && node.props.title).map(node => [node.props['data-studio-theme-preset'], node.props.title])
  const tree = await mountPanel({ [SHELL]: 'true', [V2]: 'true', [CANON]: 'true', ...on }, overrides).render(baseProps())
  const titles = Object.fromEntries(cardTitles(tree))
  check(assert.equal, Object.keys(titles).length, 10, 'ten cards')
  for (const id of [...ids6, ...ids4]) check(assert.equal, titles[id], plainLib.THEME_PLAIN_DESCRIPTIONS[id], `card tooltip for ${id}`)
  const dd = await mountPanel({ [SHELL]: 'true', [DROPDOWN]: 'true', [CANON]: 'true', ...on }, overrides).render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'gilded_noir' } }))
  const head = flat(dd).find(node => node.props?.className === 'stpdd-preview-head')
  check(assert.ok, head, 'the dropdown preview header')
  check(assert.equal, text(head), `Gilded Noir${plainLib.THEME_PLAIN_DESCRIPTIONS.gilded_noir}`, 'the preview header reads the plain-words line')
  const plain = await mountPanel({ [SHELL]: 'true', [CANON]: 'true', ...on }, overrides).render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'mission_amber' } }))
  check(assert.ok, text(plain).includes(plainLib.THEME_PLAIN_DESCRIPTIONS.mission_amber), 'the plain panel card line')
  // the panel holds no flag read of its own
  const source = overrides[FILES.panel] ?? read(FILES.panel)
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS/g) ?? []).length, 0, 'the panel never reads the flag itself')
  check(assert.equal, (source.match(/themePlainDescription\(/g) ?? []).length, 1, 'one use of the helper')
}

// ---- suite 3: the real composer menu ----------------------------------------------------------------------------------------
function menuSuite(overrides = {}) {
  const baseOverrides = { [FILES.menu]: baseSource(FILES.menu) }
  const plainLib = createLoader({ env: { [FLAG]: 'true', [SHELL]: 'true' }, overrides }).load(FILES.lib)
  const pickers = tree => flat(tree).filter(node => node.type === 'Picker')
  const decksterOptions = tree => pickers(tree)[0].props.options
  const rows = tree => flat(tree).filter(node => node.props?.['data-studio-theme-choice'])
  const MENU_ENVS = [{}, { [SHELL]: 'true' }, { [SHELL]: 'true', [FLAG]: 'false' }, { [FLAG]: 'true' }, { [FLAG]: 'TRUE', [SHELL]: 'true' }, { [FLAG]: '1', [SHELL]: 'true' }]
  // flag off: the base commit's tree, the dropdown and the flat list alike
  for (const env of MENU_ENVS) for (const dropdowns of [true, false]) for (const selection of [{ mode: 'auto' }, { mode: 'preset', preset_id: 'vibrant' }]) {
    const props = menuProps({ dropdowns, selection })
    check(assert.equal, ser(renderMenu(env, props, overrides)), ser(renderMenu({}, props, baseOverrides)), `${JSON.stringify(env)} dropdowns=${dropdowns}: the base`)
  }
  const ON = { [FLAG]: 'true', [SHELL]: 'true' }
  // flag on, the dropdowns: hint = plain words (or the preset's own for an unknown id); search = the name alone
  const options = decksterOptions(renderMenu(ON, menuProps(), overrides))
  const baseOptions = decksterOptions(renderMenu({}, menuProps(), baseOverrides))
  check(assert.equal, options.length, TB_PRESETS.length + 1, 'Auto and every preset')
  for (const preset of TB_PRESETS) {
    const option = options.find(item => item.id === preset.preset_id), baseOption = baseOptions.find(item => item.id === preset.preset_id)
    check(assert.equal, option.search, preset.name, `${preset.preset_id}: search is the name`)
    check(assert.equal, baseOption.search, `${preset.name} ${preset.description}`, `${preset.preset_id}: the base searched the description too`)
    check(assert.equal, option.hint, Object.hasOwn(plainLib.THEME_PLAIN_DESCRIPTIONS, preset.preset_id) ? plainLib.THEME_PLAIN_DESCRIPTIONS[preset.preset_id] : preset.description, `${preset.preset_id}: hint`)
    // nothing else about the option moved
    check(assert.equal, ser({ ...option, hint: 0, search: 0 }), ser({ ...baseOption, hint: 0, search: 0 }), `${preset.preset_id}: id, name, swatches, sub, current`)
  }
  check(assert.equal, ser(options[0]), ser(baseOptions[0]), 'Auto is the base')
  const matching = (query, list) => Array.from(list, option => option).filter(option => realMatches(option.search ?? option.name, query)).map(option => option.id).filter(id => id !== 'auto')
  // the finding: "gold" returned Vibrant (hidden text). With the flag on a name search is a name search.
  check(assert.deepEqual, matching('gold', baseOptions), ['vibrant', 'gilded_noir'], 'base: "gold" finds Vibrant (hidden text) and Gilded Noir (hidden text)')
  check(assert.deepEqual, matching('gold', options), [], 'flag on: "gold" matches no theme name')
  check(assert.deepEqual, matching('gilded', options), ['gilded_noir'])
  check(assert.deepEqual, matching('noir', options), ['gilded_noir'])
  check(assert.deepEqual, matching('vib', options), ['vibrant'])
  check(assert.deepEqual, matching('vibrant', options), ['vibrant'])
  check(assert.deepEqual, matching('mission amber', options), ['mission_amber'])
  check(assert.deepEqual, matching('amber mission', options), ['mission_amber'])
  check(assert.deepEqual, matching('hairline', options), [], 'a style-note word finds nothing')
  check(assert.deepEqual, matching('hairline', baseOptions), ['minimal', 'gilded_noir'], 'base: it found two')
  check(assert.deepEqual, matching('corporate', options), ['corporate_light'])
  check(assert.equal, matching('', options).length, TB_PRESETS.length, 'an empty search lists everything')
  // flag on, the flat list: the tooltip is plain words, names and everything else are the base's
  const flatOn = rows(renderMenu(ON, menuProps({ dropdowns: false }), overrides))
  const flatBase = rows(renderMenu({}, menuProps({ dropdowns: false }), baseOverrides))
  check(assert.equal, flatOn.length, flatBase.length)
  for (let i = 0; i < flatOn.length; i++) {
    const id = flatOn[i].props['data-studio-theme-choice']
    const preset = TB_PRESETS.find(item => `preset:${item.preset_id}` === id)
    const expectedTitle = !preset ? flatBase[i].props.title : Object.hasOwn(plainLib.THEME_PLAIN_DESCRIPTIONS, preset.preset_id) ? plainLib.THEME_PLAIN_DESCRIPTIONS[preset.preset_id] : preset.description
    check(assert.equal, flatOn[i].props.title, expectedTitle, `${id}: row tooltip`)
    check(assert.equal, ser({ ...flatOn[i].props, title: 0 }), ser({ ...flatBase[i].props, title: 0 }), `${id}: the rest of the row`)
    check(assert.equal, ser(flatOn[i].props.children), ser(flatBase[i].props.children), `${id}: the row's children`)
  }
  // the menu holds no flag read of its own
  const source = overrides[FILES.menu] ?? read(FILES.menu)
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS/g) ?? []).length, 0, 'the menu never reads the flag itself')
  check(assert.equal, (source.match(/themePlainDescription\(/g) ?? []).length, 2, 'two uses: the dropdown hint and the row tooltip')
  check(assert.equal, (source.match(/themeSearchText\(/g) ?? []).length, 1, 'one use: the dropdown search')
}

pureSuite()
await panelSuite()
menuSuite()

// ---- suite 4: mutants -------------------------------------------------------------------------------------------------------
const L = FILES.lib, P = FILES.panel, M = FILES.menu
const MUTANTS = [
  ['helper: flag without the shell', L, " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", ''],
  ['helper: flag always on', L, "process.env.NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", 'true'],
  ['helper: loose flag compare', L, "process.env.NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS === 'true'", "process.env.NEXT_PUBLIC_STUDIO_THEME_PLAIN_WORDS !== 'false'"],
  ['helper: plain words even when off', L, 'if (enabled !== true || typeof presetId', 'if (typeof presetId'],
  ['helper: unknown id loses its description', L, ': original\n}\n\n/** The text', ": ''\n}\n\n/** The text"],
  ['helper: prototype ids leak', L, 'Object.prototype.hasOwnProperty.call(THEME_PLAIN_DESCRIPTIONS, presetId) ? THEME_PLAIN_DESCRIPTIONS[presetId] : original', 'THEME_PLAIN_DESCRIPTIONS[presetId] ?? original'],
  ['helper: search keeps the description when on', L, 'return enabled === true ? name : `${name} ${description}`', 'return `${name} ${description}`'],
  ['helper: search drops the name when on', L, 'return enabled === true ? name : `${name} ${description}`', 'return enabled === true ? description : `${name} ${description}`'],
  ['helper: search drops the description when off', L, 'return enabled === true ? name : `${name} ${description}`', 'return name'],
  ['helper: a line goes back to jargon', L, 'Dramatic and luxurious.', 'Border-not-fill near-black with 1px gold hairlines.'],
  ['helper: a line carries a colour code', L, 'one bright lime highlight', 'one acid #D6F221 highlight'],
  ['helper: a preset is missing', L, "  mission_amber: 'Warm dark slides with orange highlights, plus cream paper slides. Bold and warm.',\n", ''],
  ['helper: two presets share a line', L, "'Dark slides with bright cyan highlights. Sharp and modern.'", "'White slides with black text and one red accent. Quiet and uncluttered.'"],
  ['helper: a line is too long', L, 'Reads like a printed magazine.', 'Reads like a printed magazine, with long columns of text that run on and on and on.'],
  ['helper: an extra preset', L, "  mission_amber:", "  surprise: 'Bright slides with lots of sparkle everywhere. Fun and loud.',\n  mission_amber:"],
  ['panel: description not replaced', P, 'description: themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, id, preset.description) }', 'description: preset.description }'],
  ['panel: flag passed as true', P, 'themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, id, preset.description)', 'themePlainDescription(true, id, preset.description)'],
  ['panel: wrong id passed', P, 'themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, id, preset.description)', 'themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, preset.name, preset.description)'],
  ['panel: name replaced as well', P, 'description: themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, id, preset.description) }', 'name: id, description: themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, id, preset.description) }'],
  ['panel: id key lost', P, 'return { id, ...preset, description', 'return { ...preset, description'],
  ['menu: search still includes the description', M, 'search: themeSearchText(STUDIO_THEME_PLAIN_WORDS_ENABLED, preset.name, preset.description)', 'search: `${preset.name} ${preset.description}`'],
  ['menu: search flag passed as false', M, 'themeSearchText(STUDIO_THEME_PLAIN_WORDS_ENABLED,', 'themeSearchText(false,'],
  ['menu: hint not mapped', M, 'hint: themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, preset.preset_id, preset.description), swatches', 'hint: preset.description, swatches'],
  ['menu: row tooltip not mapped', M, 'themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, preset.preset_id, preset.description), false, p.locked || p.presetsLoading))}', 'preset.description, false, p.locked || p.presetsLoading))}'],
  ['menu: hint flag passed as true', M, 'hint: themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED,', 'hint: themePlainDescription(true,'],
  ['menu: wrong id for the hint', M, 'hint: themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, preset.preset_id,', 'hint: themePlainDescription(STUDIO_THEME_PLAIN_WORDS_ENABLED, preset.name,'],
  ['menu: name replaced by the description', M, "{ id: preset.preset_id, name: preset.name, hint: themePlainDescription", "{ id: preset.preset_id, name: preset.description, hint: themePlainDescription"],
]
let caught = 0
const survivors = []
for (const [label, file, from, to] of MUTANTS) {
  const original = read(file)
  assert.ok(original.split(from).length - 1 >= 1, `mutant "${label}": the text to break is in ${file}`)
  const overrides = { [file]: original.replace(from, () => to) }
  let failed = false
  try { pureSuite(overrides); await panelSuite(overrides); menuSuite(overrides) } catch { failed = true }
  if (failed) caught++
  else survivors.push(label)
}
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join('; ')}`)
console.log(`studio-theme-plain-words: ${checks} checks passed, ${caught}/${MUTANTS.length} mutants caught`)
