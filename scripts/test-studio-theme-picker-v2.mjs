// PASS2 #7 (frontend-2): the Studio deck-theme picker, lighter and clearer.
// Flag NEXT_PUBLIC_STUDIO_THEME_PICKER_V2 (exact "true", Studio shell only), default off.
// Flag off must render the panel exactly as the base did.
//
// Run: node scripts/test-studio-theme-picker-v2.mjs   (plain node: transpile + vm, no network, no React runtime)
//   THEME_PICKER_V2_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-theme-picker-v2.mjs
//     re-prints the flag-off hashes below from the base sources.
//
// The proof runs on the REAL sources: components/theme-panel.tsx and lib/theme-builder.ts, lib/theme-preset-swatches.ts are
// transpiled and evaluated in a vm with a small hooks runtime (state, effects, memo) and a local stub for the Theme Builder reads.
// Nothing here opens a socket; `fetch` is a local fixture.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'

const treeRoot = process.env.THEME_PICKER_V2_ROOT
  ? path.resolve(process.env.THEME_PICKER_V2_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_PICKER_V2'
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
function mountPanel(env, { fetchImpl = localFetch } = {}) {
  const runtime = createRuntime()
  const stubs = { react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, 'next/link': { default: 'Link' }, '@/components/ui/button': { Button: 'Button' }, '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9' }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') } }
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
const BASE_ENVS = []
for (const shell of [false, true]) for (const canon of [false, true]) BASE_ENVS.push({ name: `shell=${shell} canon=${canon}`, env: { ...(shell ? { [SHELL]: 'true' } : {}), ...(canon ? { [CANON]: 'true' } : {}) } })

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

// Hash of every cell above, per base environment, captured from the base viewer
// (origin/studio-v4-dev-preparation-code at 68e3396, before this change) with the flag unset.
const BASE_HASHES = {
  'shell=false canon=false': '89c2c179f15c7979b0e5e0e7db6ac2bc82a3628625fae5a450e2fdd94cf1f1e6',
  'shell=false canon=true': 'd38654a747d08fc558fd3e386a5a4514189e37d7c061d36057c8320213bb61b3',
  'shell=true canon=false': '9205d5b03769f2cb6bd84e3ae50e54d9a90289aadc4e572f8b15078ea1d26c25',
  'shell=true canon=true': 'aa01e17ef54e98aed930843ac03ec2e0ce7e19c6a99919137cba7e9f0bb3bb40',
}

// sha256 of components/studio-theme-panel.css at the base commit.
const BASE_CSS_SHA256 = 'cddd7fe449756606b9df9ab9fabf52c78fab495ff2ee384ce3930c62c020e8a2'

if (process.env.PRINT_GOLDEN) {
  const out = {}
  for (const { name, env } of BASE_ENVS) out[name] = await hashOf(env)
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

let testCount = 0
async function run(name, fn) {
  testCount += 1
  try { await fn() } catch (err) { console.error(`FAIL: ${name}`); throw err }
}

// ---- helpers for the interaction tests ------------------------------------------------------------------------------------
const V2_ENV = { [SHELL]: 'true', [FLAG]: 'true' }
const V2_CANON_ENV = { ...V2_ENV, [CANON]: 'true' }
const OFF_ENV = { [SHELL]: 'true' }
const buttons = tree => flat(tree).filter(node => node.type === 'button' || node.type === 'Button')
const presetCards = tree => flat(tree).filter(node => node.type === 'button' && node.props['data-studio-theme-preset'] !== undefined)
const cardById = (tree, id) => presetCards(tree).find(node => node.props['data-studio-theme-preset'] === id)
const buttonByText = (tree, prefix) => buttons(tree).find(node => text(node).trim().startsWith(prefix))
const isV2 = tree => flat(tree).some(node => node.props?.['data-studio-theme-picker'] === 'v2')
const baseProps = (over = {}) => ({ isOpen: true, onClose() {}, presentationId: 'deck-1', buildThemeSelection: { mode: 'auto' }, themeSync: SYNC.idle, selectionLocked: false, onBuildThemeChange() {}, ...over })

// ---- the flag ----------------------------------------------------------------------------------------------------------
await run('the flag is read as the exact string "true", only with the Studio shell, and defaults off', async () => {
  assert.match(read('components/theme-panel.tsx'), /process\.env\.NEXT_PUBLIC_STUDIO_THEME_PICKER_V2 === 'true'/)
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['true', true]]) {
    for (const shell of [false, true]) {
      const env = { ...(shell ? { [SHELL]: 'true' } : {}), ...(value === undefined ? {} : { [FLAG]: value }) }
      const panel = mountPanel(env)
      const tree = await panel.render(baseProps())
      assert.equal(isV2(tree), expected && shell, `flag=${JSON.stringify(value)} shell=${shell}`)
    }
  }
})

await run('the flag is documented in .env.example, default "false", and has an npm script', async () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_THEME_PICKER_V2="false"$/m)
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-theme-picker-v2'], 'node scripts/test-studio-theme-picker-v2.mjs')
})

// ---- flag off is the base ----------------------------------------------------------------------------------------------
await run('flag off (unset, "false" or any non-"true" value), or flag on without the Studio shell: the panel renders exactly as the base did', async () => {
  for (const { name, env } of BASE_ENVS) {
    const variants = [{}, { [FLAG]: 'false' }, { [FLAG]: '1' }, { [FLAG]: 'TRUE' }, { [FLAG]: 'true ' }]
    if (!env[SHELL]) variants.push({ [FLAG]: 'true' }) // flag on, but not the Studio shell
    for (const extra of variants) {
      assert.equal(await hashOf({ ...env, ...extra }), BASE_HASHES[name], `${name} ${JSON.stringify(extra)}`)
    }
  }
})

// ---- flag on: the picker -------------------------------------------------------------------------------------------------
await run('flag on: one picker root, same dialog markers as the plain panel, non-modal, with a visible title', async () => {
  const tree = await mountPanel(V2_ENV).render(baseProps())
  const [root] = flat(tree)
  assert.equal(root.props['data-studio-theme-picker'], 'v2')
  assert.equal(root.props['data-studio-v4-dialog'], 'theme')
  assert.equal(root.props['data-studio-theme'], 'true')
  assert.equal(root.props.role, 'dialog')
  assert.equal(root.props['aria-modal'], 'false')
  assert.equal(root.props['aria-label'], 'Theme for this presentation')
  assert.match(text(tree), /Theme for this presentation/)
  assert.equal(flat(tree).filter(node => node.props?.['data-studio-theme-picker']).length, 1)
  assert.equal((await mountPanel(V2_ENV).render(baseProps({ isOpen: false }))), null)
})

await run('breadth: the picker offers exactly the presets the plain panel offers, in the same order (six, or ten with the canon flag)', async () => {
  for (const [offEnv, onEnv, count] of [[OFF_ENV, V2_ENV, 6], [{ ...OFF_ENV, [CANON]: 'true' }, V2_CANON_ENV, 10]]) {
    const before = presetCards(await mountPanel(offEnv).render(baseProps())).map(node => node.props['data-studio-theme-preset'])
    const after = presetCards(await mountPanel(onEnv).render(baseProps())).map(node => node.props['data-studio-theme-preset'])
    assert.equal(before.length, count + 1)
    assert.deepEqual(after, before)
    assert.equal(after[0], 'auto')
  }
})

await run('each card carries an Aa preview from the same swatch colours the plain panel used, and its name', async () => {
  for (const env of [V2_ENV, V2_CANON_ENV]) {
    const off = { ...env, [FLAG]: 'false' }
    const panelOn = mountPanel(env), panelOff = mountPanel(off)
    const treeOn = await panelOn.render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'vibrant' } }))
    const treeOff = await panelOff.render(baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'vibrant' } }))
    for (const card of presetCards(treeOn).filter(node => node.props['data-studio-theme-preset'] !== 'auto')) {
      const id = card.props['data-studio-theme-preset']
      const old = cardById(treeOff, id)
      // the plain card's swatch: canvas, hero, lead, as inline backgrounds
      const oldColours = flat(old).map(node => node.props?.style?.background).filter(Boolean)
      const newColours = flat(card).map(node => node.props?.style?.background).filter(Boolean)
      const [canvas, hero, lead] = oldColours
      assert.equal(newColours[0], canvas, `${id} canvas`)
      assert.ok(newColours.includes(hero), `${id} hero ground is drawn`)
      assert.ok(newColours.includes(lead), `${id} lead colour is drawn`)
      assert.match(text(card), /Aa/)
      assert.match(text(card), new RegExp(text(flat(old).find(node => node.props?.className?.includes('text-gray-900'))).trim()))
      const art = flat(card).find(node => node.props?.['aria-hidden'] === 'true')
      assert.ok(art, `${id}: the preview is decorative (the name is the accessible name)`)
    }
  }
})

await run('the preview text colour is readable on the preview ground (light ground: dark ink, dark ground: light ink)', async () => {
  const tree = await mountPanel(V2_CANON_ENV).render(baseProps())
  const inkOn = id => flat(cardById(tree, id)).find(node => node.props?.className === 'stpv2-tile-aa').props.style.color
  assert.equal(inkOn('corporate_light'), '#1b2430')
  assert.equal(inkOn('gilded_noir'), '#1b2430', 'canon tiles always draw the white content canvas')
  const dark = mountPanel(V2_ENV) // guide palettes: corporate_dark has a dark ground
  const darkTree = await dark.render(baseProps())
  assert.equal(flat(cardById(darkTree, 'corporate_dark')).find(node => node.props?.className === 'stpv2-tile-aa').props.style.color, '#f8fafc')
})

await run('the current theme is named and marked; the selection ring follows the pick; "Current" stays on the applied one', async () => {
  const env = mountPanel(V2_ENV)
  const props = baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal' } })
  let tree = await env.render(props)
  const current = node => text(flat(node).filter(n => n.props?.className === 'stpv2-current-pill'))
  assert.match(text(flat(tree).find(node => node.props?.['data-studio-theme-current'])), /Current theme\s*Minimal/)
  for (const card of presetCards(tree)) {
    const id = card.props['data-studio-theme-preset']
    assert.equal(card.props['aria-pressed'], id === 'minimal', `${id} selected`)
    assert.equal(current(card), id === 'minimal' ? 'Current' : '', `${id} current pill`)
  }
  cardById(tree, 'vibrant').props.onClick()
  tree = await env.render(props)
  for (const card of presetCards(tree)) {
    const id = card.props['data-studio-theme-preset']
    assert.equal(card.props['aria-pressed'], id === 'vibrant', `${id} selected after pick`)
    assert.equal(current(card), id === 'minimal' ? 'Current' : '', `${id} current pill after pick`)
  }
  assert.match(text(flat(tree).find(node => node.props?.['data-studio-theme-current'])), /Current theme\s*Minimal/, 'the heading line still names the applied theme')
  assert.match(text(tree), /Selected: Vibrant\. Not applied yet\./)
  // auto and custom are named too
  for (const [selection, label] of [[{ mode: 'auto' }, 'Auto (Director’s choice)'], [{ mode: 'custom', primary_hex: '#112233' }, 'Custom colours'], [{ mode: 'preset', preset_id: 'unknown-old-theme' }, 'Corporate Light']]) {
    const t = await mountPanel(V2_ENV).render(baseProps({ buildThemeSelection: selection }))
    assert.match(text(flat(t).find(node => node.props?.['data-studio-theme-current'])), new RegExp(`Current theme\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  }
})

// ---- apply / cancel ------------------------------------------------------------------------------------------------------
await run('Apply and Cancel are the two obvious buttons; Apply waits for a change; same payload as the plain panel', async () => {
  const scenarios = [
    { name: 'preset from auto', from: { mode: 'auto' }, steps: [['card', 'vibrant']] },
    { name: 'back to auto', from: { mode: 'preset', preset_id: 'minimal' }, steps: [['card', 'auto']] },
    { name: 'canon-only preset', from: { mode: 'auto' }, canon: true, steps: [['card', 'gilded_noir']] },
    { name: 'preset with overrides and fonts', from: { mode: 'preset', preset_id: 'minimal', font_family: 'Lato', font_family_heading: 'Playfair Display', color_overrides: { accent: '#123456' } }, steps: [['card', 'pastel']] },
    { name: 'custom from preset', from: { mode: 'preset', preset_id: 'executive', font_family: 'Lato' }, steps: [['custom'], ['hex', 'Primary / brand', '#112233'], ['hex', 'Secondary', '#445566']] },
    { name: 'custom, then back to presets', from: { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b' }, steps: [['presets'], ['card', 'vibrant']] },
    { name: 'token overrides set and reset', from: { mode: 'preset', preset_id: 'minimal' }, steps: [['hex', 'Accent', '#abcdef'], ['hex', 'Border', '#010203'], ['hexreset', 'Border']] },
  ]
  for (const scenario of scenarios) {
    const results = []
    for (const [label, envBase] of [['off', scenario.canon ? { ...OFF_ENV, [CANON]: 'true' } : OFF_ENV], ['on', scenario.canon ? V2_CANON_ENV : V2_ENV]]) {
      const applied = []
      const panel = mountPanel(envBase)
      const props = baseProps({ buildThemeSelection: scenario.from, onBuildThemeChange: next => applied.push(plain(next)) })
      let tree = await panel.render(props)
      const hexInput = labelText => flat(tree).find(node => node.type === 'input' && node.props['aria-label'] === `${labelText} hex value`)
      const apply = () => buttonByText(tree, label === 'off' ? 'Apply through Director' : 'Apply theme')
      assert.ok(apply().props.disabled, `${scenario.name} (${label}): nothing to apply yet`)
      for (const [kind, a, b] of scenario.steps) {
        if (kind === 'card') cardById(tree, a).props.onClick()
        if (kind === 'custom') buttonByText(tree, label === 'off' ? 'Build custom' : 'Build a custom palette').props.onClick()
        if (kind === 'presets') buttonByText(tree, label === 'off' ? 'Preset themes' : 'Back to preset themes').props.onClick()
        if (kind === 'hex') {
          // the overrides sit in a <details> in the picker; the fields are the same HexField either way
          hexInput(a).props.onChange({ target: { value: b } })
        }
        if (kind === 'hexreset') flat(tree).find(node => node.type === 'button' && node.props['aria-label'] === `Reset ${a} to theme`).props.onClick()
        tree = await panel.render(props)
      }
      assert.equal(apply().props.disabled, false, `${scenario.name} (${label}): a change enables Apply`)
      apply().props.onClick()
      results.push(applied)
    }
    assert.equal(results[1].length, 1, `${scenario.name}: one apply`)
    assert.deepEqual(results[1], results[0], `${scenario.name}: the same selection reaches onBuildThemeChange`)
  }
})

await run('Cancel and Escape close without applying', async () => {
  let closed = 0
  const applied = []
  const panel = mountPanel(V2_ENV)
  const props = baseProps({ onClose: () => { closed += 1 }, onBuildThemeChange: next => applied.push(next) })
  let tree = await panel.render(props)
  cardById(tree, 'vibrant').props.onClick()
  tree = await panel.render(props)
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

await run('Apply states: syncing disables it, a failed apply with nothing new offers Try again, a failed one with a new pick offers Apply theme', async () => {
  const syncing = await mountPanel(V2_ENV).render(baseProps({ themeSync: SYNC.syncing, buildThemeSelection: { mode: 'auto' } }))
  assert.ok(buttonByText(syncing, 'Applying').props.disabled)
  const failed = mountPanel(V2_ENV)
  const props = baseProps({ themeSync: SYNC.failed })
  let tree = await failed.render(props)
  assert.equal(buttonByText(tree, 'Try again').props.disabled, false)
  assert.match(text(tree), /That did not go through\. Try again\./)
  assert.match(text(flat(tree).find(node => node.props?.['data-studio-theme-notice'] === 'failed')), /The theme could not be applied\./)
  assert.equal(flat(tree).find(node => node.props?.['data-studio-theme-notice'] === 'failed').props.role, 'alert')
  cardById(tree, 'vibrant').props.onClick()
  tree = await failed.render(props)
  assert.equal(buttonByText(tree, 'Apply theme').props.disabled, false)
  const applied = await mountPanel(V2_ENV).render(baseProps({ themeSync: SYNC.applied }))
  assert.match(text(applied), /Applied/)
  const idle = await mountPanel(V2_ENV).render(baseProps({ themeSync: SYNC.idle }))
  assert.doesNotMatch(text(idle), /Not synced/)
})

await run('an invalid custom colour blocks Apply and says so in plain words', async () => {
  const panel = mountPanel(V2_ENV)
  const props = baseProps({ buildThemeSelection: { mode: 'custom', primary_hex: '#1e40af' } })
  let tree = await panel.render(props)
  flat(tree).find(node => node.type === 'input' && node.props['aria-label'] === 'Primary / brand hex value').props.onChange({ target: { value: '#12' } })
  tree = await panel.render(props)
  assert.ok(buttonByText(tree, 'Apply theme').props.disabled)
  const hint = flat(tree).find(node => node.props?.['data-studio-theme-hint'] === 'invalid')
  assert.equal(hint.props.role, 'alert')
  assert.match(text(hint), /six-digit colour, such as #1e40af/)
})

// ---- the lock note -------------------------------------------------------------------------------------------------------
await run('the lock note appears only when the selection is locked, in plain words; unlocked, nothing about locking is shown', async () => {
  const unlocked = await mountPanel(V2_CANON_ENV).render(baseProps({ selectionLocked: false }))
  assert.equal(flat(unlocked).filter(node => node.props?.['data-studio-theme-notice'] === 'locked').length, 0)
  assert.doesNotMatch(text(unlocked), /locked|fixed|generation starts/i)
  const locked = await mountPanel(V2_CANON_ENV).render(baseProps({ selectionLocked: true, buildThemeSelection: { mode: 'preset', preset_id: 'pastel' } }))
  const note = flat(locked).filter(node => node.props?.['data-studio-theme-notice'] === 'locked')
  assert.equal(note.length, 1)
  assert.equal(text(note[0]), 'This deck is already building or built, so its theme is fixed. Start a new chat to pick a different one.')
  assert.doesNotMatch(text(locked), /generation starts|build settings|Director session/)
})

await run('locked: the previews stay (current one marked), nothing can be chosen or applied, and the only button is Close', async () => {
  let closed = 0
  const applied = []
  const tree = await mountPanel(V2_CANON_ENV).render(baseProps({ selectionLocked: true, buildThemeSelection: { mode: 'preset', preset_id: 'pastel' }, onClose: () => { closed += 1 }, onBuildThemeChange: next => applied.push(next) }))
  const cards = presetCards(tree)
  assert.equal(cards.length, 11)
  assert.ok(cards.every(card => card.props.disabled === true))
  assert.equal(cards.filter(card => card.props['aria-pressed']).length, 1)
  assert.equal(cardById(tree, 'pastel').props['aria-pressed'], true)
  assert.match(text(cardById(tree, 'pastel')), /Current/)
  assert.equal(buttonByText(tree, 'Apply'), undefined)
  assert.equal(buttonByText(tree, 'Cancel'), undefined)
  assert.equal(buttonByText(tree, 'Build a custom palette'), undefined)
  assert.equal(flat(tree).find(node => node.props?.['data-studio-theme-advanced']), undefined, 'no token overrides to fine-tune while locked')
  buttonByText(tree, 'Close').props.onClick()
  assert.equal(closed, 1)
  assert.deepEqual(applied, [])
  // a locked deck that carries overrides still shows them (disabled), so nothing it carries is hidden
  const withOverrides = await mountPanel(V2_ENV).render(baseProps({ selectionLocked: true, buildThemeSelection: { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#123456' } } }))
  const advanced = flat(withOverrides).find(node => node.props?.['data-studio-theme-advanced'])
  assert.ok(advanced)
  assert.match(text(advanced), /Fine-tune individual colours \(1 set\)/)
  assert.ok(flat(advanced).filter(node => node.type === 'input').every(node => node.props.disabled))
})

// ---- custom palette and fine-tuning -----------------------------------------------------------------------------------------
await run('the custom palette and the token overrides are still reachable: same fields, same seeds, same count', async () => {
  const off = await mountPanel(OFF_ENV).render(baseProps({ buildThemeSelection: { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b' } }))
  const on = await mountPanel(V2_ENV).render(baseProps({ buildThemeSelection: { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b' } }))
  const fields = tree => flat(tree).filter(node => node.props?.['data-studio-theme-color']).map(node => [node.props['data-studio-theme-color'], text(node)])
  assert.equal(fields(off).length, 14)
  assert.deepEqual(fields(on), fields(off))
  const picker = await mountPanel(V2_ENV).render(baseProps())
  assert.equal(fields(picker).length, 10, 'preset view: the ten token overrides, folded into "Fine-tune individual colours"')
  const details = flat(picker).find(node => node.props?.['data-studio-theme-advanced'])
  assert.equal(details.type, 'details')
  assert.equal(details.props.open, undefined, 'collapsed until asked for')
  assert.equal(flat(details).filter(node => node.props?.['data-studio-theme-color']).length, 10)
})

// ---- scope: presentation only --------------------------------------------------------------------------------------------
await run('the picker adds no state, effect, request or env read of its own, and uses the panel\'s own handlers', async () => {
  const source = read('components/theme-panel.tsx')
  const start = source.indexOf('// ── PASS2 #7')
  const end = source.indexOf('export function ThemePanel(')
  assert.ok(start > 0 && end > start)
  // PASS2B G35 (e1e9e79) adds one inline, exact-"true" flag read to the picker (the brand-kit link; proven in test-studio-theme-brand-link.mjs): it is the one env read allowed here
  const block = source.slice(start, end).replace(/ *\/\/ PASS2B G35 \(NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK[\s\S]*?\n {2}\) : null\n/, '')
  assert.doesNotMatch(block, /fetch\(|useState|useEffect|useMemo|useRef|useCallback|process\.env|localStorage|sendCommand/)
  assert.equal([...source.matchAll(/(?<![A-Za-z_])STUDIO_THEME_PICKER_V2\b/g)].length, 2, 'declared once, used once')
  assert.equal([...source.matchAll(/<ThemePickerV2\b/g)].length, 1)
  for (const handler of ['onSelectAuto={selectAuto}', 'onSelectPreset={selectPreset}', 'onBuildCustom={selectCustomMode}', 'onApply={applyTheme}', 'onClose={onClose}']) assert.ok(source.includes(handler), handler)
  // the panel's own imports are untouched apart from icons, a type and (PASS2-PK-FOUR item 3) the dropdown module
  const imports = ts.createSourceFile('theme-panel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).statements
    .filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text)
  // PASS2D 4c adds '@/lib/studio-theme-auto-pill' (import-free; the header pill rule, proven in test-studio-theme-auto-pill.mjs)
  // PASS2D 4b adds '@/lib/studio-theme-plain-words' (import-free; plain-words descriptions, proven in test-studio-theme-plain-words.mjs)
  // P2C adds '@/lib/studio-theme-dark-toggle' and './theme-deck-mode-control' (the Light | Dark control; flag NEXT_PUBLIC_THEME_DARK_MODE_ENABLED, proven in test-studio-theme-dark-toggle.mjs)
  assert.deepEqual(imports.sort(), ['./studio-editor-dialogs.css', './studio-theme-panel.css', './theme-deck-mode-control', './theme-dropdown-picker', '@/components/ui/button', '@/lib/config', '@/lib/studio-theme-auto-pill', '@/lib/studio-theme-dark-toggle', '@/lib/studio-theme-plain-words', '@/lib/theme-builder', '@/lib/theme-preset-swatches', '@/lib/theme-sync', '@/lib/utils', 'lucide-react', 'next/link', 'react'].sort())
})

await run('flag on, no Theme Builder answer (offline): the picker still renders every preset with a neutral preview, and nothing throws', async () => {
  const panel = mountPanel(V2_CANON_ENV, { fetchImpl: async () => { throw new Error('network refused') } })
  const tree = await panel.render(baseProps())
  assert.equal(presetCards(tree).length, 11)
})

await run('the stylesheet: every new rule hangs off the picker marker, and the plain panel\'s rules are byte-for-byte what they were', async () => {
  const css = read('components/studio-theme-panel.css')
  const cut = css.indexOf('/* PASS2 #7')
  assert.ok(cut > 0)
  // the base file, golden
  assert.equal(sha(css.slice(0, cut).replace(/\n\n$/, '\n')), BASE_CSS_SHA256)
  const added = postcss.parse(css.slice(cut))
  let rules = 0
  added.walkRules(rule => {
    rules += 1
    for (const selector of rule.selectors) assert.ok(selector.includes('[data-studio-theme-picker="v2"]'), `unscoped selector: ${selector}`)
  })
  assert.ok(rules > 40)
  const tokens = added.toString()
  assert.match(tokens, /\.dark \[data-studio-theme-picker="v2"\]/, 'dark value for the on-accent colour')
  assert.doesNotMatch(tokens, /data-studio-(add-slide|generation|element-panel|v4-thumbnails|authoring-menu)/)
})

console.log(`PASS: studio theme picker v2 (${testCount} tests)`)
