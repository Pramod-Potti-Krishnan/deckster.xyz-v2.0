// PASS2-PK-FOUR item 3 (frontend-2): the Studio theme picker as a searchable dropdown with a live preview.
// Flag NEXT_PUBLIC_STUDIO_THEME_DROPDOWN (exact "true", Studio shell only), default off.
// Flag off must render the picker (the PASS2 #7 grid when NEXT_PUBLIC_STUDIO_THEME_PICKER_V2 is on, the plain panel when it is off)
// exactly as the base did.
//
// Run: node scripts/test-studio-theme-dropdown.mjs   (plain node: transpile + vm, no network, no React runtime)
//   THEME_DROPDOWN_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-theme-dropdown.mjs
//     re-prints the flag-off hashes below from the base sources (origin/studio-v4-dev-preparation-code at 5cc455d).
//
// The proof runs on the REAL sources: components/theme-panel.tsx, components/theme-dropdown-picker.tsx and the lib files they use are
// transpiled and evaluated in a vm with a small hooks runtime (state, effects, memo, id) and a local stub for the Theme Builder reads.
// Nothing here opens a socket; `fetch` is a local fixture. The harness below is borrowed from test-studio-theme-picker-v2.mjs.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'

const treeRoot = process.env.THEME_DROPDOWN_ROOT
  ? path.resolve(process.env.THEME_DROPDOWN_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const V2 = 'NEXT_PUBLIC_STUDIO_THEME_PICKER_V2'
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_DROPDOWN'
const FONTS = 'NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const CANON = 'NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value))
// Like JSON, but a key whose value is undefined stays visible, and functions are marked, so a changed key set cannot hide.
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)

// ---- module loader: transpile repo files and run them in a vm -----------------------------------------------------------
const transpiled = new Map() // source text is transpiled once per file; every loader still evaluates it afresh
function createLoader({ env = {}, stubs = {}, globals = {} } = {}) {
  const cache = new Map()
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(treeRoot, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return base + suffix
    return null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      const file = resolve(spec, from)
      assert.ok(file, `unresolved import ${spec} in ${path.relative(treeRoot, from)}`)
      return run(file)
    }
    throw new Error(`unexpected import ${spec} in ${path.relative(treeRoot, from)}`)
  }
  function run(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }
    cache.set(file, mod.exports)
    if (!transpiled.has(file)) transpiled.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)
    const out = transpiled.get(file)
    vm.runInNewContext(out, { module: mod, exports: mod.exports, process: { env }, console, ...globals, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return { load: rel => run(path.join(treeRoot, rel)) }
}

// ---- a small hooks runtime: stateful root component, inert children -------------------------------------------------------
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
const text = node => Array.isArray(node) ? node.map(text).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

// Theme Builder preset contracts, served locally (the panel reads GET /api/v1/themes/presets/{id} when the canon flag is on).
const CONTRACTS = {
  corporate_light: ['#1e3a8a', '#1e40af', '#f59e0b', '#ffffff', '#eff6ff', '#172033'],
  corporate_dark: ['#0f172a', '#60a5fa', '#fbbf24', '#0f172a', '#1e293b', '#f8fafc'],
  minimal: ['#334155', '#334155', '#94a3b8', '#ffffff', '#f8fafc', '#0f172a'],
  vibrant: ['#6d28d9', '#6d28d9', '#f97316', '#fff7ed', '#f5f3ff', '#27203b'],
  executive: ['#0f172a', '#0f172a', '#b45309', '#f8fafc', '#e2e8f0', '#111827'],
  pastel: ['#c4b5fd', '#8b5cf6', '#2dd4bf', '#fdf2f8', '#ecfeff', '#3f3a52'],
  concrete_acid: ['#2b2d2f', '#2b2d2f', '#d6f221', '#e8e8e6', '#d9d9d6', '#1a1a1a'],
  espresso_editorial: ['#3b2a22', '#5b3a29', '#c68b59', '#f6efe4', '#ece2d2', '#2a1d17'],
  gilded_noir: ['#111111', '#c9a227', '#c9a227', '#0b0b0c', '#17140f', '#f3ede0'],
  mission_amber: ['#1b1410', '#e8742a', '#d62a3c', '#1b1410', '#2a1e17', '#f5e9dc'],
}
const localFetch = async url => {
  const id = String(url).split('/').pop()
  const c = CONTRACTS[id]
  if (!c) return { ok: false, json: async () => ({}) }
  const [hero, primary, accent, background, surface, text] = c
  return { ok: true, json: async () => ({ palette: { hero: { hero_background: hero }, brand: { primary }, accent: { accent }, neutral: { background, surface }, text: { text_primary: text } } }) }
}

const icons = new Proxy({}, { get: (_, name) => `Icon:${String(name)}` })
function mountPanel(env, { fetchImpl = localFetch, extraStubs = {} } = {}) {
  const runtime = createRuntime()
  const stubs = { react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, 'next/link': { default: 'Link' }, '@/components/ui/button': { Button: 'Button' }, '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9' }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') }, ...extraStubs }
  const { ThemePanel } = createLoader({ env, stubs, globals: { fetch: fetchImpl } }).load('components/theme-panel.tsx')
  return {
    runtime,
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

// ---- the matrix the flag-off proof runs over ------------------------------------------------------------------------------
const SYNC = {
  idle: { status: 'idle', requestId: null, presentationId: null, themeFingerprint: null, error: null },
  syncing: { status: 'syncing', requestId: 'r1', presentationId: 'deck-1', themeFingerprint: null, error: null },
  applied: { status: 'applied', requestId: 'r1', presentationId: 'deck-1', themeFingerprint: 'fp', error: null },
  failed: { status: 'failed', requestId: 'r1', presentationId: 'deck-1', themeFingerprint: 'fp', error: 'The theme could not be applied.' },
}
const SELECTIONS = [
  { mode: 'auto' },
  ...Object.keys(CONTRACTS).map(id => ({ mode: 'preset', preset_id: id })),
  { mode: 'preset', preset_id: 'vibrant-orange', color_overrides: { accent: '#123456', surface: '#eeeeee' } },
  { mode: 'preset', preset_id: 'unknown-old-theme' },
  { mode: 'preset', preset_id: 'minimal', font_family: 'Lato', font_family_heading: 'Playfair Display' },
  { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b' },
  { mode: 'custom', primary_hex: 'nope', color_overrides: { background: '#fff', stray: '#abcdef' } },
]
async function hashOf(env) {
  const hashes = []
  for (const selection of SELECTIONS) {
    for (const locked of [false, true]) {
      for (const status of Object.keys(SYNC)) {
        const panel = mountPanel(env)
        const tree = await panel.render({ isOpen: true, onClose() {}, presentationId: 'deck-1', buildThemeSelection: selection, themeSync: SYNC[status], selectionLocked: locked, onBuildThemeChange() {} })
        hashes.push(sha(ser(tree)))
      }
    }
  }
  const closed = mountPanel(env)
  hashes.push(sha(ser(await closed.render({ isOpen: false, onClose() {}, buildThemeSelection: { mode: 'auto' }, themeSync: SYNC.idle }))))
  return sha(hashes.join('\n'))
}

// Environments the flag-off proof runs over: shell off/on, the PASS2 #7 grid off/on (needs the shell), canon presets off/on.
const OFF_MATRIX = []
for (const { shell, v2 } of [{ shell: false, v2: false }, { shell: true, v2: false }, { shell: true, v2: true }]) {
  for (const canon of [false, true]) {
    OFF_MATRIX.push({
      name: `shell=${shell} v2=${v2} canon=${canon}`,
      env: { ...(shell ? { [SHELL]: 'true' } : {}), ...(v2 ? { [V2]: 'true' } : {}), ...(canon ? { [CANON]: 'true' } : {}) },
    })
  }
}

// Hash of every cell above, per environment, captured from the base viewer
// (origin/studio-v4-dev-preparation-code at 5cc455d, before this change) with the dropdown flag unset.
const BASE_HASHES = {
  'shell=false v2=false canon=false': '89c2c179f15c7979b0e5e0e7db6ac2bc82a3628625fae5a450e2fdd94cf1f1e6',
  'shell=false v2=false canon=true': 'd38654a747d08fc558fd3e386a5a4514189e37d7c061d36057c8320213bb61b3',
  'shell=true v2=false canon=false': '9205d5b03769f2cb6bd84e3ae50e54d9a90289aadc4e572f8b15078ea1d26c25',
  'shell=true v2=false canon=true': 'aa01e17ef54e98aed930843ac03ec2e0ce7e19c6a99919137cba7e9f0bb3bb40',
  'shell=true v2=true canon=false': 'fbaccaf86d1bda94a947431a9e850230272d90a7b7a26e25d06c1e9e553df68b',
  'shell=true v2=true canon=true': 'c8be44e36647bad5ac22d8e610ad058e9a652162f3886ac3380a33cf5f00bc49',
}

// sha256 of components/studio-theme-panel.css at the base commit: the dropdown adds its own stylesheet and leaves this one alone.
const BASE_CSS_SHA256 = '81e3560ad84ff9591a9291479c1f3f2bd70327cf4ddf4b83700fbce57e508ba0'

if (process.env.PRINT_GOLDEN) {
  const out = {}
  for (const { name, env } of OFF_MATRIX) out[name] = await hashOf(env)
  console.log(JSON.stringify({ hashes: out, css: sha(read('components/studio-theme-panel.css')) }, null, 2))
  process.exit(0)
}

let testCount = 0
async function run(name, fn) {
  testCount += 1
  try { await fn() } catch (err) { console.error(`FAIL: ${name}`); throw err }
}

// ---- helpers ------------------------------------------------------------------------------------------------------------------
const V2_ENV = { [SHELL]: 'true', [V2]: 'true' }
const V2_CANON_ENV = { ...V2_ENV, [CANON]: 'true' }
const OFF_ENV = { [SHELL]: 'true' }
const DD_ENV = { [SHELL]: 'true', [FLAG]: 'true' }
const DD_V2_ENV = { ...DD_ENV, [V2]: 'true' }
const DD_CANON_ENV = { ...DD_ENV, [CANON]: 'true' }
const buttons = tree => flat(tree).filter(node => node.type === 'button' || node.type === 'Button')
const presetCards = tree => flat(tree).filter(node => node.type === 'button' && node.props['data-studio-theme-preset'] !== undefined)
const cardById = (tree, id) => presetCards(tree).find(node => node.props['data-studio-theme-preset'] === id)
const buttonByText = (tree, prefix) => buttons(tree).find(node => text(node).trim().startsWith(prefix))
const isDropdown = tree => flat(tree).some(node => node.props?.['data-studio-theme-dropdown'] === 'true')
const baseProps = (over = {}) => ({ isOpen: true, onClose() {}, presentationId: 'deck-1', buildThemeSelection: { mode: 'auto' }, themeSync: SYNC.idle, selectionLocked: false, onBuildThemeChange() {}, ...over })
const ev = (key = '', over = {}) => {
  const event = { key, prevented: false, stopped: false, preventDefault() { event.prevented = true }, stopPropagation() { event.stopped = true }, target: {}, currentTarget: { select() {} }, ...over }
  return event
}

// The real dropdown module, mounted as the root component so its own state (open, filter, highlight) is live.
function mountDropdown(env = DD_ENV) {
  const runtime = createRuntime()
  const stubs = { react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons }
  const mod = createLoader({ env, stubs }).load('components/theme-dropdown-picker.tsx')
  return { mod, render: props => runtime.render(mod.ThemeDropdownPicker, props) }
}
const realModule = mountDropdown().mod

// The panel with its dropdown replaced by a recorder, to see exactly what the panel hands it and to drive onSelect.
function panelWithDropdown(env, opts = {}) {
  const seen = []
  const stub = { ...mountDropdown(env).mod, ThemeDropdownPicker: props => { seen.push(props); return jsx('div', { 'data-stub-dropdown': 'true' }) } }
  const panel = mountPanel(env, { ...opts, extraStubs: { './theme-dropdown-picker': stub } })
  return { panel, seen, get last() { return seen[seen.length - 1] } }
}

const comboOf = tree => flat(tree).find(node => node.type === 'input' && node.props.role === 'combobox')
const optionsOf = tree => flat(tree).filter(node => node.props?.role === 'option')
const listOf = tree => flat(tree).find(node => node.props?.role === 'listbox')
const optionNames = tree => optionsOf(tree).map(node => text(flat(node).find(n => n.props?.className === 'stpdd-option-label')))
const activeOf = tree => optionsOf(tree).find(node => node.props['data-active'] === 'true')

// Real panel data, for the direct dropdown tests.
async function dropdownProps(env, selection, over = {}) {
  const harness = panelWithDropdown(env)
  await harness.panel.render(baseProps({ buildThemeSelection: selection, ...over }))
  return harness.last
}

// A deck whose applied theme is custom: the picker opens on the custom colours; "Back to preset themes" brings the dropdown.
async function dropdownAfterBackToPresets(env, selection) {
  const harness = panelWithDropdown(env)
  const props = baseProps({ buildThemeSelection: selection })
  let tree = await harness.panel.render(props)
  assert.equal(harness.last, undefined, 'custom colours: the dropdown is not shown')
  buttonByText(tree, 'Back to preset themes').props.onClick()
  tree = await harness.panel.render(props)
  return harness.last
}

// ---- the flag -----------------------------------------------------------------------------------------------------------------
await run('the flag is read as the exact string "true", only with the Studio shell, and defaults off', async () => {
  assert.match(read('components/theme-panel.tsx'), /process\.env\.NEXT_PUBLIC_STUDIO_THEME_DROPDOWN === 'true'/)
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['true', true]]) {
    for (const shell of [false, true]) {
      for (const v2 of [false, true]) {
        const env = { ...(shell ? { [SHELL]: 'true' } : {}), ...(v2 ? { [V2]: 'true' } : {}), ...(value === undefined ? {} : { [FLAG]: value }) }
        const tree = await mountPanel(env).render(baseProps())
        assert.equal(isDropdown(tree), expected && shell, `flag=${JSON.stringify(value)} shell=${shell} v2=${v2}`)
      }
    }
  }
})

await run('the flag is documented in .env.example, default "false", and has an npm script', async () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_THEME_DROPDOWN="false"$/m)
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-theme-dropdown'], 'node scripts/test-studio-theme-dropdown.mjs')
})

// ---- flag off is the base ------------------------------------------------------------------------------------------------------
await run('flag off (unset, "false" or any non-"true" value), or flag on without the Studio shell: the panel renders exactly as the base did, in every environment', async () => {
  for (const { name, env } of OFF_MATRIX) {
    const variants = [{}, { [FLAG]: 'false' }, { [FLAG]: '1' }, { [FLAG]: 'TRUE' }, { [FLAG]: 'true ' }]
    if (!env[SHELL]) variants.push({ [FLAG]: 'true' }) // flag on, but not the Studio shell
    for (const extra of variants) {
      assert.equal(await hashOf({ ...env, ...extra }), BASE_HASHES[name], `${name} ${JSON.stringify(extra)}`)
    }
  }
})

await run('flag off: the grid picker and the plain panel are the base ones, and no dropdown marker or module output exists', async () => {
  const grid = await mountPanel(V2_ENV).render(baseProps())
  assert.equal(isDropdown(grid), false)
  assert.equal(presetCards(grid).length, 7)
  assert.equal(flat(grid).filter(node => node.props?.role === 'combobox' || node.props?.role === 'listbox').length, 0)
  const plain = await mountPanel(OFF_ENV).render(baseProps())
  assert.equal(flat(plain).filter(node => node.props?.['data-studio-theme-picker']).length, 0)
  assert.equal(flat(plain).filter(node => node.props?.['data-studio-theme-dropdown']).length, 0)
})

await run('the existing stylesheet is byte-for-byte what it was; the dropdown has its own, and every rule hangs off the dropdown marker', async () => {
  // PASS2B G35 (e1e9e79) adds one `.stpv2-brandkit` rule to this stylesheet (the brand-kit link; proven in test-studio-theme-brand-link.mjs): everything else is still the base's
  const G35_RULE = '[data-studio-theme-picker="v2"] .stpv2-brandkit { margin: 12px 2px 4px; padding-top: 12px; border-top: 1px solid var(--stp-line); }\n'
  assert.equal(sha(read('components/studio-theme-panel.css').replace(G35_RULE, '')), BASE_CSS_SHA256)
  const css = read('components/studio-theme-dropdown.css')
  const parsed = postcss.parse(css)
  let rules = 0
  parsed.walkRules(rule => {
    rules += 1
    for (const selector of rule.selectors) assert.ok(selector.startsWith('[data-studio-theme-dropdown="true"]'), `unscoped selector: ${selector}`)
  })
  assert.ok(rules > 40)
  assert.doesNotMatch(css, /data-studio-(add-slide|generation|element-panel|v4-thumbnails|authoring-menu)/)
  assert.doesNotMatch(css, /!important/)
})

// ---- flag on: the picker frame and the contract it keeps -----------------------------------------------------------------------
await run('flag on (with or without the grid flag): one picker root with the V2 frame and the dropdown marker, no grid, same dialog markers', async () => {
  for (const env of [DD_ENV, DD_V2_ENV, DD_CANON_ENV]) {
    const tree = await mountPanel(env).render(baseProps())
    const [root] = flat(tree)
    assert.equal(root.props['data-studio-theme-picker'], 'v2')
    assert.equal(root.props['data-studio-theme-dropdown'], 'true')
    assert.equal(root.props['data-studio-v4-dialog'], 'theme')
    assert.equal(root.props['data-studio-theme'], 'true')
    assert.equal(root.props.role, 'dialog')
    assert.equal(root.props['aria-modal'], 'false')
    assert.equal(root.props['aria-label'], 'Theme for this presentation')
    assert.equal(flat(tree).filter(node => node.props?.['data-studio-theme-dropdown']).length, 1)
    assert.equal(presetCards(tree).length, 0, 'the grid of cards is gone')
    assert.equal(flat(tree).filter(node => node.props?.className === 'stpv2-grid').length, 0)
    assert.doesNotMatch(text(tree), /Swatches show each theme/)
    assert.equal(comboOf(tree).props.role, 'combobox')
  }
  assert.equal(await mountPanel(DD_ENV).render(baseProps({ isOpen: false })), null)
})

await run('breadth: the dropdown offers exactly the presets the grid offers, in the same order, Auto first (six, or ten with the canon flag)', async () => {
  for (const [gridEnv, ddEnv, count] of [[V2_ENV, DD_ENV, 6], [V2_CANON_ENV, DD_CANON_ENV, 10]]) {
    const grid = presetCards(await mountPanel(gridEnv).render(baseProps())).map(node => node.props['data-studio-theme-preset'])
    const { options } = await dropdownProps(ddEnv, { mode: 'auto' })
    assert.equal(grid.length, count + 1)
    assert.deepEqual(plain(options.map(option => option.id)), grid)
    assert.equal(options[0].id, 'auto')
    // names and descriptions are the grid's
    const gridTree = await mountPanel(gridEnv).render(baseProps())
    for (const option of options.slice(1)) {
      const card = cardById(gridTree, option.id)
      assert.equal(card.props.title, option.hint, `${option.id} description`)
      assert.ok(text(card).includes(option.name), `${option.id} name`)
    }
  }
})

await run('every row carries 4-5 distinct valid swatches; Auto carries none', async () => {
  for (const env of [DD_ENV, DD_CANON_ENV]) {
    const { options } = await dropdownProps(env, { mode: 'auto' })
    assert.deepEqual(plain(options[0].swatches), [])
    for (const option of options.slice(1)) {
      assert.ok(option.swatches.length >= 4 && option.swatches.length <= 5, `${option.id}: ${option.swatches.length} swatches`)
      assert.ok(option.swatches.every(hex => /^#[0-9a-f]{6}$/i.test(hex)))
      assert.equal(new Set(option.swatches.map(hex => hex.toLowerCase())).size, option.swatches.length, `${option.id}: distinct`)
    }
  }
})

await run('the current theme is flagged for pinning (Auto, a preset, an old alias) and nothing is flagged for a custom theme; the selected id follows the draft', async () => {
  const pinned = async selection => plain((await dropdownProps(DD_ENV, selection)).options.filter(option => option.current).map(option => option.id))
  assert.deepEqual(await pinned({ mode: 'auto' }), ['auto'])
  assert.deepEqual(await pinned({ mode: 'preset', preset_id: 'minimal' }), ['minimal'])
  assert.deepEqual(await pinned({ mode: 'preset', preset_id: 'vibrant-orange' }), ['vibrant'])
  assert.deepEqual(await pinned({ mode: 'preset', preset_id: 'unknown-old-theme' }), ['corporate_light'])
  assert.deepEqual(plain((await dropdownAfterBackToPresets(DD_ENV, { mode: 'custom', primary_hex: '#112233' })).options.filter(option => option.current).map(option => option.id)), [], 'custom is current: nothing in the list to pin')
  const harness = panelWithDropdown(DD_ENV)
  const props = baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal' } })
  await harness.panel.render(props)
  assert.equal(harness.last.selectedId, 'minimal')
  harness.last.onSelect('vibrant')
  await harness.panel.render(props)
  assert.equal(harness.last.selectedId, 'vibrant')
  assert.deepEqual(plain(harness.last.options.filter(option => option.current).map(option => option.id)), ['minimal'], 'Current stays on the applied one')
  harness.last.onSelect('auto')
  await harness.panel.render(props)
  assert.equal(harness.last.selectedId, 'auto')
  assert.equal(harness.last.preview.kind, 'auto')
})

// ---- the same Apply path ---------------------------------------------------------------------------------------------------------
await run('picking in the dropdown sends the same payload to onBuildThemeChange as the grid and the plain panel (pick, auto, canon preset, overrides + fonts, custom, fine-tune)', async () => {
  const scenarios = [
    { name: 'preset from auto', from: { mode: 'auto' }, steps: [['pick', 'vibrant']] },
    { name: 'back to auto', from: { mode: 'preset', preset_id: 'minimal' }, steps: [['pick', 'auto']] },
    { name: 'canon-only preset', from: { mode: 'auto' }, canon: true, steps: [['pick', 'gilded_noir']] },
    { name: 'preset with overrides and fonts', from: { mode: 'preset', preset_id: 'minimal', font_family: 'Lato', font_family_heading: 'Playfair Display', color_overrides: { accent: '#123456' } }, steps: [['pick', 'pastel']] },
    { name: 'pick, then change mind', from: { mode: 'preset', preset_id: 'executive' }, steps: [['pick', 'vibrant'], ['pick', 'pastel']] },
    { name: 'pick the current theme again, nothing to apply', from: { mode: 'preset', preset_id: 'executive' }, steps: [['pick', 'vibrant'], ['pick', 'executive']], expectNone: true },
    { name: 'custom from preset', from: { mode: 'preset', preset_id: 'executive', font_family: 'Lato' }, steps: [['custom'], ['hex', 'Primary / brand', '#112233'], ['hex', 'Secondary', '#445566']] },
    { name: 'custom, then back to presets', from: { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b' }, steps: [['presets'], ['pick', 'vibrant']] },
    { name: 'token overrides set and reset', from: { mode: 'preset', preset_id: 'minimal' }, steps: [['hex', 'Accent', '#abcdef'], ['hex', 'Border', '#010203'], ['hexreset', 'Border']] },
    { name: 'pick then fine-tune', from: { mode: 'auto' }, steps: [['pick', 'vibrant'], ['hex', 'Accent', '#abcdef']] },
  ]
  for (const scenario of scenarios) {
    const results = []
    for (const kind of ['plain', 'grid', 'dropdown']) {
      const env = kind === 'plain' ? OFF_ENV : kind === 'grid' ? V2_ENV : DD_ENV
      const applied = []
      const harness = panelWithDropdown({ ...env, ...(scenario.canon ? { [CANON]: 'true' } : {}) })
      const props = baseProps({ buildThemeSelection: scenario.from, onBuildThemeChange: next => applied.push(plain(next)) })
      let tree = await harness.panel.render(props)
      const hexInput = labelText => flat(tree).find(node => node.type === 'input' && node.props['aria-label'] === `${labelText} hex value`)
      const apply = () => buttonByText(tree, kind === 'plain' ? 'Apply through Director' : 'Apply theme')
      assert.ok(apply().props.disabled, `${scenario.name} (${kind}): nothing to apply yet`)
      for (const [step, a, b] of scenario.steps) {
        if (step === 'pick') {
          if (kind === 'dropdown') harness.last.onSelect(a)
          else cardById(tree, a).props.onClick()
        }
        if (step === 'custom') buttonByText(tree, kind === 'plain' ? 'Build custom' : 'Build a custom palette').props.onClick()
        if (step === 'presets') buttonByText(tree, kind === 'plain' ? 'Preset themes' : 'Back to preset themes').props.onClick()
        if (step === 'hex') hexInput(a).props.onChange({ target: { value: b } })
        if (step === 'hexreset') flat(tree).find(node => node.type === 'button' && node.props['aria-label'] === `Reset ${a} to theme`).props.onClick()
        tree = await harness.panel.render(props)
      }
      if (scenario.expectNone) {
        assert.ok(apply().props.disabled, `${scenario.name} (${kind}): back to what is applied, so nothing to apply`)
      } else {
        assert.equal(apply().props.disabled, false, `${scenario.name} (${kind}): a change enables Apply`)
        apply().props.onClick()
      }
      results.push(applied)
    }
    const [plainResult, gridResult, dropdownResult] = results
    assert.equal(dropdownResult.length, scenario.expectNone ? 0 : 1, `${scenario.name}: ${scenario.expectNone ? 'no' : 'one'} apply`)
    assert.deepEqual(dropdownResult, gridResult, `${scenario.name}: same selection as the grid`)
    assert.deepEqual(dropdownResult, plainResult, `${scenario.name}: same selection as the plain panel`)
  }
})

await run('the dropdown is not in the draft: nothing reaches onBuildThemeChange until Apply theme', async () => {
  const applied = []
  const harness = panelWithDropdown(DD_ENV)
  const props = baseProps({ onBuildThemeChange: next => applied.push(next) })
  await harness.panel.render(props)
  harness.last.onSelect('vibrant')
  harness.last.onSelect('pastel')
  await harness.panel.render(props)
  assert.deepEqual(applied, [])
})

await run('Cancel and Escape (list closed) close the dialog without applying; the footer hint follows the pick', async () => {
  let closed = 0
  const applied = []
  const harness = panelWithDropdown(DD_ENV)
  const props = baseProps({ onClose: () => { closed += 1 }, onBuildThemeChange: next => applied.push(next) })
  let tree = await harness.panel.render(props)
  assert.match(text(tree), /Pick a different theme to change it\./)
  harness.last.onSelect('vibrant')
  tree = await harness.panel.render(props)
  assert.match(text(tree), /Selected: Vibrant\. Not applied yet\./)
  buttonByText(tree, 'Cancel').props.onClick()
  assert.equal(closed, 1)
  flat(tree)[0].props.onKeyDown({ key: 'Escape' })
  assert.equal(closed, 2)
  flat(tree)[0].props.onKeyDown({ key: 'a' })
  assert.equal(closed, 2)
  flat(tree).find(node => node.props?.['data-studio-theme-close']).props.onClick()
  assert.equal(closed, 3)
  assert.deepEqual(applied, [])
})

await run('Apply states are the grid\'s: syncing disables it, failed with nothing new offers Try again, an invalid colour blocks it in plain words', async () => {
  const syncing = await mountPanel(DD_ENV).render(baseProps({ themeSync: SYNC.syncing }))
  assert.ok(buttonByText(syncing, 'Applying').props.disabled)
  const failed = panelWithDropdown(DD_ENV)
  const props = baseProps({ themeSync: SYNC.failed })
  let tree = await failed.panel.render(props)
  assert.equal(buttonByText(tree, 'Try again').props.disabled, false)
  assert.match(text(flat(tree).find(node => node.props?.['data-studio-theme-notice'] === 'failed')), /The theme could not be applied\./)
  failed.last.onSelect('vibrant')
  tree = await failed.panel.render(props)
  assert.equal(buttonByText(tree, 'Apply theme').props.disabled, false)
  const invalid = mountPanel(DD_ENV)
  const customProps = baseProps({ buildThemeSelection: { mode: 'custom', primary_hex: '#1e40af' } })
  tree = await invalid.render(customProps)
  flat(tree).find(node => node.type === 'input' && node.props['aria-label'] === 'Primary / brand hex value').props.onChange({ target: { value: '#12' } })
  tree = await invalid.render(customProps)
  assert.ok(buttonByText(tree, 'Apply theme').props.disabled)
  assert.match(text(flat(tree).find(node => node.props?.['data-studio-theme-hint'] === 'invalid')), /six-digit colour, such as #1e40af/)
})

await run('custom palette and fine-tune stay reachable: "Build a custom palette" swaps the dropdown for the same custom fields; the ten token overrides sit in "Fine-tune individual colours"', async () => {
  const tree = await mountPanel(DD_ENV).render(baseProps())
  assert.ok(buttonByText(tree, 'Build a custom palette'))
  const details = flat(tree).find(node => node.props?.['data-studio-theme-advanced'])
  assert.equal(details.type, 'details')
  assert.equal(flat(details).filter(node => node.props?.['data-studio-theme-color']).length, 10)
  const customSelection = { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b' }
  const fields = t => flat(t).filter(node => node.props?.['data-studio-theme-color']).map(node => [node.props['data-studio-theme-color'], text(node)])
  const grid = await mountPanel(V2_ENV).render(baseProps({ buildThemeSelection: customSelection }))
  const dropdown = await mountPanel(DD_ENV).render(baseProps({ buildThemeSelection: customSelection }))
  assert.deepEqual(fields(dropdown), fields(grid))
  assert.equal(comboOf(dropdown), undefined, 'custom mode shows the custom editor, not the dropdown')
  assert.ok(buttonByText(dropdown, 'Back to preset themes'))
  const click = mountPanel(DD_ENV)
  const clickProps = baseProps()
  let t = await click.render(clickProps)
  buttonByText(t, 'Build a custom palette').props.onClick()
  t = await click.render(clickProps)
  assert.equal(comboOf(t), undefined)
  assert.equal(flat(t).filter(node => node.props?.['data-studio-theme-color']).length, 14)
})

// ---- the lock rule ---------------------------------------------------------------------------------------------------------------
await run('locked: the plain lock note once, the current theme shown, the dropdown disabled, Close the only button, and a stray select changes nothing', async () => {
  let closed = 0
  const applied = []
  const harness = panelWithDropdown(DD_CANON_ENV)
  const props = baseProps({ selectionLocked: true, buildThemeSelection: { mode: 'preset', preset_id: 'pastel' }, onClose: () => { closed += 1 }, onBuildThemeChange: next => applied.push(next) })
  let tree = await harness.panel.render(props)
  const note = flat(tree).filter(node => node.props?.['data-studio-theme-notice'] === 'locked')
  assert.equal(note.length, 1)
  assert.equal(text(note[0]), 'This deck is already building or built, so its theme is fixed. Start a new chat to pick a different one.')
  assert.equal(harness.last.locked, true)
  assert.equal(harness.last.selectedId, 'pastel')
  assert.equal(harness.last.preview.name, 'Pastel')
  assert.equal(buttonByText(tree, 'Apply'), undefined)
  assert.equal(buttonByText(tree, 'Cancel'), undefined)
  assert.equal(buttonByText(tree, 'Build a custom palette'), undefined)
  harness.last.onSelect('vibrant')
  tree = await harness.panel.render(props)
  assert.equal(harness.last.selectedId, 'pastel', 'the lock holds')
  buttonByText(tree, 'Close').props.onClick()
  assert.equal(closed, 1)
  assert.deepEqual(applied, [])
  // unlocked: nothing about locking
  const unlocked = await mountPanel(DD_CANON_ENV).render(baseProps())
  assert.doesNotMatch(text(unlocked), /locked|fixed|generation starts/i)
  // a locked deck that carries overrides still shows them (disabled)
  const withOverrides = await mountPanel(DD_ENV).render(baseProps({ selectionLocked: true, buildThemeSelection: { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#123456' } } }))
  assert.ok(flat(flat(withOverrides).find(node => node.props?.['data-studio-theme-advanced'])).filter(node => node.type === 'input').every(node => node.props.disabled))
})

// ---- the dropdown itself: closed ---------------------------------------------------------------------------------------------------
await run('closed: an accessible combobox showing the chosen theme and its swatches; no list; the label points at the input', async () => {
  const props = await dropdownProps(DD_ENV, { mode: 'preset', preset_id: 'vibrant' })
  const mount = mountDropdown()
  const tree = mount.render(props)
  const combo = comboOf(tree)
  assert.equal(combo.props.role, 'combobox')
  assert.equal(combo.props['aria-expanded'], false)
  assert.equal(combo.props['aria-autocomplete'], 'list')
  assert.equal(combo.props.value, 'Vibrant')
  assert.equal(combo.props.disabled, false)
  assert.equal(combo.props['aria-activedescendant'], undefined)
  assert.equal(listOf(tree), undefined)
  const label = flat(tree).find(node => node.type === 'label')
  assert.equal(label.props.htmlFor, combo.props.id)
  assert.equal(text(label), 'Theme')
  assert.equal(flat(tree).find(node => node.props?.className === 'stpdd-swatches').props.children.length, props.options.find(option => option.id === 'vibrant').swatches.length)
  assert.equal(flat(tree).filter(node => node.props?.className === 'stpdd-swatches').length, 1, 'closed: only the chosen theme\'s swatches')
  assert.equal(typeof combo.props['aria-controls'], 'string')
})

await run('Auto chosen: the field names Auto with its icon and no swatches, and the preview says there is nothing to preview', async () => {
  const props = await dropdownProps(DD_ENV, { mode: 'auto' })
  const tree = mountDropdown().render(props)
  assert.equal(comboOf(tree).props.value, 'Auto')
  assert.equal(flat(tree).filter(node => node.props?.className === 'stpdd-swatches').length, 0)
  assert.equal(flat(tree).filter(node => node.props?.className === 'stpdd-field-icon').length, 1)
  const preview = flat(tree).find(node => node.props?.['data-studio-theme-preview'])
  assert.equal(preview.props['data-studio-theme-preview'], 'auto')
  assert.match(text(preview), /Director picks a theme when it builds your deck, so there is nothing to preview yet\./)
  // typing a search hides the Auto icon (the field is now a search box), clearing it brings it back
  const mount = mountDropdown()
  let typing = mount.render(props)
  comboOf(typing).props.onChange({ target: { value: 'cor' } })
  typing = mount.render(props)
  assert.equal(flat(typing).filter(node => node.props?.className === 'stpdd-field-icon').length, 0)
  comboOf(typing).props.onChange({ target: { value: '' } })
  typing = mount.render(props)
  assert.equal(flat(typing).filter(node => node.props?.className === 'stpdd-field-icon').length, 1)
  // a built deck on Auto: the preview says so in its own words
  const lockedProps = await dropdownProps(DD_ENV, { mode: 'auto' }, { selectionLocked: true })
  assert.match(text(flat(mountDropdown().render(lockedProps)).find(node => node.props?.['data-studio-theme-preview'])), /Director chose this deck’s theme when it built the deck, so there is no preview to show here\./)
})

// ---- open, keyboard, filter ----------------------------------------------------------------------------------------------------------
await run('ArrowDown opens the list on the chosen theme; the arrows move the highlight (wrapping); Enter chooses it and closes; ids and aria-activedescendant line up', async () => {
  const props = await dropdownProps(DD_ENV, { mode: 'preset', preset_id: 'minimal' })
  const picks = []
  const mount = mountDropdown()
  const p = { ...props, onSelect: id => picks.push(id) }
  let tree = mount.render(p)
  comboOf(tree).props.onKeyDown(ev('ArrowDown'))
  tree = mount.render(p)
  assert.equal(comboOf(tree).props['aria-expanded'], true)
  assert.ok(listOf(tree))
  assert.equal(listOf(tree).props.role, 'listbox')
  assert.equal(listOf(tree).props.tabIndex, -1, 'a scrolling list with nothing to focus would otherwise become a Tab stop in Chrome')
  assert.equal(comboOf(tree).props['aria-controls'], listOf(tree).props.id)
  const ids = optionsOf(tree).map(node => node.props.id)
  assert.equal(new Set(ids).size, ids.length, 'unique option ids')
  assert.equal(comboOf(tree).props['aria-activedescendant'], activeOf(tree).props.id)
  assert.equal(activeOf(tree).props['data-studio-theme-preset'], 'minimal', 'opens on the chosen theme')
  // aria-selected marks only the chosen theme
  assert.deepEqual(optionsOf(tree).filter(node => node.props['aria-selected']).map(node => node.props['data-studio-theme-preset']), ['minimal'])
  const names = optionNames(tree)
  assert.deepEqual(names, ['Minimal', 'Auto', 'Corporate Light', 'Corporate Dark', 'Vibrant', 'Executive', 'Pastel'], 'current pinned first, then the rest in source order')
  // move: Minimal(0) -> Auto
  comboOf(tree).props.onKeyDown(ev('ArrowDown'))
  tree = mount.render(p)
  assert.equal(activeOf(tree).props['data-studio-theme-preset'], 'auto')
  // up twice: Minimal then wraps to Pastel
  comboOf(tree).props.onKeyDown(ev('ArrowUp'))
  tree = mount.render(p)
  comboOf(tree).props.onKeyDown(ev('ArrowUp'))
  tree = mount.render(p)
  assert.equal(activeOf(tree).props['data-studio-theme-preset'], 'pastel')
  assert.equal(comboOf(tree).props['aria-activedescendant'], activeOf(tree).props.id)
  const enter = ev('Enter')
  comboOf(tree).props.onKeyDown(enter)
  assert.deepEqual(picks, ['pastel'])
  assert.equal(enter.prevented, true)
  tree = mount.render(p)
  assert.equal(comboOf(tree).props['aria-expanded'], false)
  assert.equal(listOf(tree), undefined)
})

await run('the current theme is pinned under its own heading with a Current pill and is not repeated below; the other heading reads "Other themes"', async () => {
  const props = await dropdownProps(DD_CANON_ENV, { mode: 'preset', preset_id: 'gilded_noir' })
  const mount = mountDropdown()
  let tree = mount.render(props)
  comboOf(tree).props.onKeyDown(ev('ArrowDown'))
  tree = mount.render(props)
  const groups = flat(tree).filter(node => node.props?.role === 'group')
  assert.deepEqual(groups.map(node => node.props['aria-label']), ['Current theme', 'Other themes'])
  assert.deepEqual(optionNames(groups[0]), ['Gilded Noir'])
  assert.match(text(optionsOf(groups[0])[0]), /Current/)
  assert.equal(optionNames(groups[1]).length, 10)
  assert.ok(!optionNames(groups[1]).includes('Gilded Noir'))
  assert.deepEqual(optionNames(groups[1]), ['Auto', 'Corporate Light', 'Corporate Dark', 'Minimal', 'Vibrant', 'Executive', 'Pastel', 'Concrete Acid', 'Espresso Editorial', 'Mission Amber'])
  assert.equal(optionsOf(tree).filter(node => text(node).includes('Current')).length, 1)
  // Auto current: Auto is pinned
  const auto = await dropdownProps(DD_ENV, { mode: 'auto' })
  const m2 = mountDropdown()
  let t2 = m2.render(auto)
  comboOf(t2).props.onKeyDown(ev('ArrowDown'))
  t2 = m2.render(auto)
  assert.deepEqual(optionNames(t2).slice(0, 2), ['Auto', 'Corporate Light'])
  assert.deepEqual(flat(t2).filter(node => node.props?.role === 'group').map(node => node.props['aria-label']), ['Current theme', 'Other themes'])
  // custom current: nothing to pin, one heading
  const custom = await dropdownAfterBackToPresets(DD_ENV, { mode: 'custom', primary_hex: '#112233' })
  const m3 = mountDropdown()
  let t3 = m3.render(custom)
  comboOf(t3).props.onKeyDown(ev('ArrowDown'))
  t3 = m3.render(custom)
  assert.deepEqual(flat(t3).filter(node => node.props?.role === 'group').map(node => node.props['aria-label']), ['All themes'])
})

await run('type to filter: "cor" leaves the two Corporate themes, case and word order do not matter, the first match is highlighted, Enter picks it', async () => {
  const props = await dropdownProps(DD_CANON_ENV, { mode: 'preset', preset_id: 'minimal' })
  const picks = []
  const mount = mountDropdown(DD_CANON_ENV)
  const p = { ...props, onSelect: id => picks.push(id) }
  let tree = mount.render(p)
  comboOf(tree).props.onChange({ target: { value: 'cor' } })
  tree = mount.render(p)
  assert.equal(comboOf(tree).props['aria-expanded'], true)
  assert.equal(comboOf(tree).props.value, 'cor')
  assert.deepEqual(optionNames(tree), ['Corporate Light', 'Corporate Dark'])
  assert.equal(activeOf(tree).props['data-studio-theme-preset'], 'corporate_light')
  assert.equal(comboOf(tree).props['aria-activedescendant'], activeOf(tree).props.id)
  assert.match(text(flat(tree).find(node => node.props?.role === 'status')), /2 themes available/)
  comboOf(tree).props.onChange({ target: { value: 'DARK corp' } })
  tree = mount.render(p)
  assert.deepEqual(optionNames(tree), ['Corporate Dark'])
  assert.match(text(flat(tree).find(node => node.props?.role === 'status')), /1 theme available/)
  comboOf(tree).props.onChange({ target: { value: 'cor' } })
  tree = mount.render(p)
  comboOf(tree).props.onKeyDown(ev('ArrowDown'))
  tree = mount.render(p)
  assert.equal(activeOf(tree).props['data-studio-theme-preset'], 'corporate_dark')
  comboOf(tree).props.onKeyDown(ev('Enter'))
  assert.deepEqual(picks, ['corporate_dark'])
  tree = mount.render(p)
  assert.equal(listOf(tree), undefined)
  assert.equal(comboOf(tree).props.value, 'Minimal', 'the field shows the chosen theme again (the parent owns the choice)')
  // matching is on the name only, not the long description ("corners" in Concrete Acid)
  comboOf(tree).props.onChange({ target: { value: 'cor' } })
  tree = mount.render(p)
  assert.ok(!optionNames(tree).includes('Concrete Acid'))
  // the current theme is filtered like any other
  const pinnedProps = await dropdownProps(DD_CANON_ENV, { mode: 'preset', preset_id: 'minimal' })
  const m2 = mountDropdown(DD_CANON_ENV)
  let t2 = m2.render(pinnedProps)
  comboOf(t2).props.onChange({ target: { value: 'pas' } })
  t2 = m2.render(pinnedProps)
  assert.deepEqual(optionNames(t2), ['Pastel'])
  assert.deepEqual(flat(t2).filter(node => node.props?.role === 'group').map(node => node.props['aria-label']), ['All themes'])
})

await run('typing into the closed field (the chosen name still in it, a paste, a phone keyboard) searches for what was typed, not for the name plus it', async () => {
  const { themeDropdownTypedText } = realModule
  assert.equal(themeDropdownTypedText('Autoc', 'Auto'), 'c')
  assert.equal(themeDropdownTypedText('cAuto', 'Auto'), 'c')
  assert.equal(themeDropdownTypedText('Auto', 'Auto'), '')
  assert.equal(themeDropdownTypedText('c', 'Auto'), 'c', 'the name was selected and replaced')
  assert.equal(themeDropdownTypedText('', 'Auto'), '')
  assert.equal(themeDropdownTypedText('abc', ''), 'abc')
  const props = await dropdownProps(DD_CANON_ENV, { mode: 'preset', preset_id: 'minimal' })
  const mount = mountDropdown(DD_CANON_ENV)
  let tree = mount.render(props)
  comboOf(tree).props.onChange({ target: { value: 'Minimalcor' } })
  tree = mount.render(props)
  assert.equal(comboOf(tree).props.value, 'cor')
  assert.deepEqual(optionNames(tree), ['Corporate Light', 'Corporate Dark'])
  // once open the field is the search text, taken as it comes
  comboOf(tree).props.onChange({ target: { value: 'Minimal' } })
  tree = mount.render(props)
  assert.deepEqual(optionNames(tree), ['Minimal'])
})

await run('no match: a plain message, no options, Enter chooses nothing; clearing the text brings the list back', async () => {
  const props = await dropdownProps(DD_ENV, { mode: 'auto' })
  const picks = []
  const mount = mountDropdown()
  const p = { ...props, onSelect: id => picks.push(id) }
  let tree = mount.render(p)
  comboOf(tree).props.onChange({ target: { value: 'zzz' } })
  tree = mount.render(p)
  assert.equal(optionsOf(tree).length, 0)
  assert.equal(comboOf(tree).props['aria-activedescendant'], undefined)
  assert.match(text(flat(tree).find(node => node.props?.['data-studio-theme-empty'])), /No themes match “zzz”\./)
  assert.match(text(flat(tree).find(node => node.props?.role === 'status')), /No themes match\./)
  comboOf(tree).props.onKeyDown(ev('Enter'))
  comboOf(tree).props.onKeyDown(ev('ArrowDown'))
  assert.deepEqual(picks, [])
  comboOf(tree).props.onChange({ target: { value: '' } })
  tree = mount.render(p)
  assert.equal(optionsOf(tree).length, 7)
})

await run('Escape: with the list open it closes only the list (the event is stopped, nothing is chosen); with the list closed it is left to reach the dialog, which cancels', async () => {
  const props = await dropdownProps(DD_ENV, { mode: 'auto' })
  const picks = []
  const mount = mountDropdown()
  const p = { ...props, onSelect: id => picks.push(id) }
  let tree = mount.render(p)
  const closedEscape = ev('Escape')
  comboOf(tree).props.onKeyDown(closedEscape)
  assert.equal(closedEscape.stopped, false, 'list closed: Escape is not swallowed')
  comboOf(tree).props.onChange({ target: { value: 'viv' } })
  tree = mount.render(p)
  assert.ok(listOf(tree))
  const openEscape = ev('Escape')
  comboOf(tree).props.onKeyDown(openEscape)
  assert.equal(openEscape.stopped, true, 'list open: Escape closes the list only')
  tree = mount.render(p)
  assert.equal(listOf(tree), undefined)
  assert.equal(comboOf(tree).props.value, 'Auto', 'the typed text is dropped')
  assert.deepEqual(picks, [])
})

await run('mouse: clicking a row chooses it; the pointer moves the highlight; pressing in the list does not steal focus; the chevron toggles the list', async () => {
  const props = await dropdownProps(DD_ENV, { mode: 'auto' })
  const picks = []
  const mount = mountDropdown()
  const p = { ...props, onSelect: id => picks.push(id) }
  let tree = mount.render(p)
  comboOf(tree).props.onClick({ currentTarget: { select() {} } })
  tree = mount.render(p)
  assert.ok(listOf(tree), 'clicking the field opens the list')
  const down = ev()
  listOf(tree).props.onMouseDown(down)
  assert.equal(down.prevented, true)
  const row = optionsOf(tree).find(node => node.props['data-studio-theme-preset'] === 'executive')
  row.props.onMouseMove()
  tree = mount.render(p)
  assert.equal(activeOf(tree).props['data-studio-theme-preset'], 'executive')
  optionsOf(tree).find(node => node.props['data-studio-theme-preset'] === 'executive').props.onClick()
  assert.deepEqual(picks, ['executive'])
  tree = mount.render(p)
  assert.equal(listOf(tree), undefined)
  const chevron = flat(tree).find(node => node.props?.className === 'stpdd-chevron')
  const press = ev()
  chevron.props.onMouseDown(press)
  assert.equal(press.prevented, true)
  chevron.props.onClick()
  tree = mount.render(p)
  assert.ok(listOf(tree))
  flat(tree).find(node => node.props?.className === 'stpdd-chevron').props.onClick()
  tree = mount.render(p)
  assert.equal(listOf(tree), undefined)
  assert.equal(flat(tree).find(node => node.props?.className === 'stpdd-chevron').props['aria-hidden'], 'true')
  assert.equal(flat(tree).find(node => node.props?.className === 'stpdd-chevron').props.tabIndex, -1)
})

await run('focus leaving the dropdown closes it and drops the typed text; focus moving inside it does not', async () => {
  const props = await dropdownProps(DD_ENV, { mode: 'preset', preset_id: 'vibrant' })
  const mount = mountDropdown()
  let tree = mount.render(props)
  comboOf(tree).props.onChange({ target: { value: 'exe' } })
  tree = mount.render(props)
  const wrapper = flat(tree).find(node => node.props?.className === 'stpdd-combo')
  const inside = {}
  wrapper.props.onBlur({ currentTarget: { contains: node => node === inside }, relatedTarget: inside })
  tree = mount.render(props)
  assert.ok(listOf(tree), 'focus stayed inside')
  wrapper.props.onBlur({ currentTarget: { contains: node => node === inside }, relatedTarget: null })
  tree = mount.render(props)
  assert.equal(listOf(tree), undefined)
  assert.equal(comboOf(tree).props.value, 'Vibrant')
})

await run('locked: the field is disabled, no key or click opens it, and the preview still shows the chosen theme', async () => {
  const props = await dropdownProps(DD_ENV, { mode: 'preset', preset_id: 'executive' }, { selectionLocked: true })
  const picks = []
  const mount = mountDropdown()
  const p = { ...props, onSelect: id => picks.push(id) }
  let tree = mount.render(p)
  assert.equal(comboOf(tree).props.disabled, true)
  assert.equal(comboOf(tree).props.value, 'Executive')
  comboOf(tree).props.onKeyDown(ev('ArrowDown'))
  comboOf(tree).props.onChange({ target: { value: 'v' } })
  comboOf(tree).props.onClick(ev())
  tree = mount.render(p)
  assert.equal(listOf(tree), undefined)
  assert.equal(comboOf(tree).props['aria-expanded'], false)
  assert.equal(flat(tree).find(node => node.props?.className === 'stpdd-chevron').props.disabled, true)
  assert.equal(flat(tree).find(node => node.props?.['data-studio-theme-preview']).props['data-studio-theme-preview'], 'theme')
  assert.match(text(flat(tree).find(node => node.props?.className === 'stpdd-preview-head')), /Executive/)
  assert.doesNotMatch(text(tree), /Type to search/)
  assert.deepEqual(picks, [])
})

// ---- the preview ---------------------------------------------------------------------------------------------------------------------
const groundOf = (tree, which) => flat(tree).find(node => node.props?.['data-studio-preview-ground'] === which).props.style
await run('the preview draws the chosen theme: title ground, content ground, lead and accent chips, text colours, name and description', async () => {
  const props = await dropdownProps(DD_CANON_ENV, { mode: 'preset', preset_id: 'corporate_light' })
  const tree = mountDropdown(DD_CANON_ENV).render(props)
  const [hero, primary, accent, background, surface, textColour] = CONTRACTS.corporate_light
  const title = groundOf(tree, 'title')
  const content = groundOf(tree, 'content')
  assert.equal(title.background, hero)
  assert.equal(title.color, '#f8fafc', 'light ink on the dark title ground')
  assert.equal(content.background, '#ffffff', 'content slides are always the white canvas')
  assert.equal(content.color, textColour)
  const chips = flat(tree).filter(node => node.props?.className?.startsWith('stpdd-chip'))
  assert.equal(chips[0].props.style.background, primary)
  assert.equal(chips[1].props.style.background, accent)
  assert.equal(chips[2].props.style.background, surface)
  assert.equal(chips[2].props.style.color, '#1b2430', 'dark text on the light surface chip')
  const head = flat(tree).find(node => node.props?.className === 'stpdd-preview-head')
  assert.equal(text(head), 'Corporate LightClean business theme with a blue brand base')
  assert.match(text(flat(tree).find(node => node.props?.['data-studio-theme-preview'])), /Title slide[\s\S]*Content slide/)
  assert.match(text(flat(tree).find(node => node.props?.className === 'stpdd-preview-note')), /A preview only: your deck changes when you apply the theme\./)
  void background
})

await run('the preview follows the draft live: picking another theme changes it, nothing else does; each preset in each environment gets a complete preview', async () => {
  const harness = panelWithDropdown(DD_CANON_ENV)
  const props = baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal' } })
  await harness.panel.render(props)
  const before = harness.last.preview
  assert.equal(before.name, 'Minimal')
  harness.last.onSelect('gilded_noir')
  await harness.panel.render(props)
  const after = harness.last.preview
  assert.equal(after.name, 'Gilded Noir')
  assert.notDeepEqual(after, before)
  assert.equal(after.hero, '#111111')
  assert.equal(after.heroInk, '#f8fafc')
  for (const env of [DD_ENV, DD_CANON_ENV]) {
    const { options } = await dropdownProps(env, { mode: 'auto' })
    for (const option of options.slice(1)) {
      const h = panelWithDropdown(env)
      await h.panel.render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: option.id } }))
      const preview = h.last.preview
      assert.equal(preview.kind, 'theme', option.id)
      for (const key of ['hero', 'heroInk', 'heroRule', 'canvas', 'surface', 'lead', 'leadInk', 'accent', 'accentInk', 'text', 'body']) assert.match(preview[key], /^#[0-9a-f]{6}$/i, `${option.id}.${key}`)
      assert.ok(preview.description.length > 10)
      assert.equal(preview.headingFont, undefined)
      assert.equal(preview.bodyFont, undefined)
    }
  }
})

await run('readable: dark slides keep their text off the white canvas (Gilded Noir\'s cream text becomes dark ink), and ink always contrasts with its ground', async () => {
  const { themeDropdownPreview, contrastRatio, inkFor } = realModule
  const h = panelWithDropdown(DD_CANON_ENV)
  await h.panel.render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'gilded_noir' } }))
  assert.equal(h.last.preview.canvas, '#ffffff')
  assert.ok(contrastRatio(h.last.preview.text, h.last.preview.canvas) >= 3, 'cream text would vanish on white')
  for (const id of Object.keys(CONTRACTS)) {
    const h2 = panelWithDropdown(DD_CANON_ENV)
    await h2.panel.render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: id } }))
    const p = h2.last.preview
    assert.ok(contrastRatio(p.heroInk, p.hero) >= 4.5, `${id}: title ink on its ground`)
    assert.ok(contrastRatio(p.text, p.canvas) >= 3, `${id}: heading on the content ground`)
    assert.ok(contrastRatio(p.leadInk, p.lead) >= 4, `${id}: chip text`)
    assert.ok(contrastRatio(p.surfaceInk, p.surface) >= 4.5, `${id}: text on the surface chip (a dark theme's surface is dark)`)
    const other = p.leadInk === '#1b2430' ? '#f8fafc' : '#1b2430'
    assert.ok(contrastRatio(p.leadInk, p.lead) >= contrastRatio(other, p.lead), `${id}: the better of the two inks`)
  }
  assert.equal(inkFor('#ffffff'), '#1b2430')
  assert.equal(inkFor('#000000'), '#f8fafc')
  assert.equal(inkFor('not a colour'), '#1b2430')
  // a theme with no canon swatch (guide palettes) draws its title ground from the brand colour
  const guide = themeDropdownPreview({ name: 'X', description: 'y', colors: { background: '#ffffff', surface: '#eff6ff', primary: '#1e40af', accent: '#f59e0b', text: '#172033' } })
  assert.equal(guide.hero, '#1e40af')
  assert.equal(guide.lead, '#1e40af')
})

await run('the deck\'s explicit colour overrides show in the preview (valid hex only); the fonts show only when the fonts flag is on and the draft names them', async () => {
  const withOverrides = panelWithDropdown(DD_ENV)
  await withOverrides.panel.render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#123456', background: '#fafafa', text_primary: '#222222', text_body: '#333333', surface: '#eeeeee', primary: '#abcdef', border: '#010101' } } }))
  const p = withOverrides.last.preview
  assert.equal(p.accent, '#123456')
  assert.equal(p.canvas, '#fafafa')
  assert.equal(p.text, '#222222')
  assert.equal(p.body, '#333333')
  assert.equal(p.surface, '#eeeeee')
  assert.equal(p.lead, '#abcdef')
  const typing = panelWithDropdown(DD_ENV)
  await typing.panel.render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#12' } } }))
  assert.equal(typing.last.preview.accent, '#94a3b8', 'a half-typed colour is ignored')
  // the picked theme keeps the draft's overrides and the preview keeps showing them
  const keep = panelWithDropdown(DD_ENV)
  const keepProps = baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#123456' } } })
  await keep.panel.render(keepProps)
  keep.last.onSelect('pastel')
  await keep.panel.render(keepProps)
  assert.equal(keep.last.preview.name, 'Pastel')
  assert.equal(keep.last.preview.accent, '#123456')
  // fonts
  const fonts = { font_family: 'Lato', font_family_heading: 'Playfair Display' }
  const off = panelWithDropdown(DD_ENV)
  await off.panel.render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal', ...fonts } }))
  assert.equal(off.last.preview.headingFont, undefined, 'fonts flag off: no fonts, even if the selection carries them')
  assert.equal(off.last.preview.bodyFont, undefined)
  const on = panelWithDropdown({ ...DD_ENV, [FONTS]: 'true' })
  await on.panel.render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal', ...fonts } }))
  assert.equal(on.last.preview.headingFont, 'Playfair Display')
  assert.equal(on.last.preview.bodyFont, 'Lato')
  const tree = mountDropdown({ ...DD_ENV, [FONTS]: 'true' }).render(on.last)
  assert.match(flat(tree).find(node => node.props?.className === 'stpdd-slide-h1').props.style.fontFamily, /^'Playfair Display', Georgia, serif$/)
  assert.match(flat(tree).find(node => node.props?.className === 'stpdd-slide-body').props.style.fontFamily, /^'Lato', system-ui, sans-serif$/)
  assert.match(text(flat(tree).find(node => node.props?.className === 'stpdd-preview-note')), /Fonts: Playfair Display for headings, Lato for body text\./)
  const plainTree = mountDropdown().render(off.last)
  assert.equal(flat(plainTree).find(node => node.props?.className === 'stpdd-slide-h1').props.style, undefined)
  assert.match(text(flat(plainTree).find(node => node.props?.className === 'stpdd-preview-note')), /Fonts: the theme’s own\./)
})

// ---- scope: presentation only ----------------------------------------------------------------------------------------------------------
await run('the dropdown module keeps to UI state: no request, storage, env read or command of its own; a fixed set of imports', async () => {
  const source = read('components/theme-dropdown-picker.tsx')
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|process\.env|sendCommand|XMLHttpRequest|WebSocket|navigator\./)
  const imports = ts.createSourceFile('theme-dropdown-picker.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).statements
    .filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text)
  assert.deepEqual(imports.sort(), ['./studio-theme-dropdown.css', '@/lib/theme-builder', '@/lib/theme-fonts', 'lucide-react', 'react'].sort())
  // the panel hands it handlers it already had, and only builds it behind the flag
  const panel = read('components/theme-panel.tsx')
  assert.equal([...panel.matchAll(/(?<![A-Za-z_])STUDIO_THEME_DROPDOWN\b/g)].length, 3, 'declared once, used twice')
  assert.equal([...panel.matchAll(/<ThemeDropdownPicker\b/g)].length, 1)
  assert.ok(panel.includes('onSelect={id => { if (id === \'auto\') selectAuto(); else selectPreset(id) }}'))
  assert.ok(panel.includes("process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'"))
  assert.match(panel, /const STUDIO_THEME_DROPDOWN = STUDIO_THEME_PANEL && process\.env\.NEXT_PUBLIC_STUDIO_THEME_DROPDOWN === 'true'/)
})

await run('offline (no Theme Builder answer): the dropdown still lists every preset, with the neutral preview colours for canon-only themes, and nothing throws', async () => {
  const h = panelWithDropdown(DD_CANON_ENV, { fetchImpl: async () => { throw new Error('network refused') } })
  await h.panel.render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'mission_amber' } }))
  assert.equal(h.last.options.length, 11)
  assert.equal(h.last.preview.name, 'Mission Amber')
  assert.match(h.last.preview.canvas, /^#[0-9a-f]{6}$/i)
})

console.log(`PASS: studio theme dropdown (${testCount} tests)`)
