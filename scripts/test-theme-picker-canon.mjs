// T-07/T-06 (theme audit TM4 + TM3): NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED.
// Offline: the actual lib and ThemePanel sources run in a sandbox; every network
// read is a local stub. Flag off must be exactly the base (6d47cae4) picker.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// THEME_PICKER_TEST_ROOT renders another checkout's sources (used once to take the base snapshot).
const root = process.env.THEME_PICKER_TEST_ROOT ? new URL(`file://${process.env.THEME_PICKER_TEST_ROOT.replace(/\/?$/, '/')}`) : new URL('../', import.meta.url)
const plain = value => JSON.parse(JSON.stringify(value))

function load(file, { env = {}, imports = {}, fetch } = {}) {
  const source = fs.readFileSync(new URL(file, root), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const module = { exports: {} }
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    process: { env },
    fetch: fetch || (() => { throw new Error('network refused') }),
    require: name => {
      assert.ok(name in imports, `unexpected import ${name}`)
      return imports[name]
    },
  })
  return module.exports
}

const SIX = ['corporate_light', 'corporate_dark', 'minimal', 'vibrant', 'executive', 'pastel']
const FOUR = ['concrete_acid', 'espresso_editorial', 'gilded_noir', 'mission_amber']
const BASE_FALLBACK = [
  { preset_id: 'corporate_light', name: 'Corporate Light', description: 'Clean business theme with a blue brand base' },
  { preset_id: 'corporate_dark', name: 'Corporate Dark', description: 'Dark executive theme with high-contrast accents' },
  { preset_id: 'minimal', name: 'Minimal', description: 'Quiet, restrained theme for simple narratives' },
  { preset_id: 'vibrant', name: 'Vibrant', description: 'High-energy theme with stronger accent colors' },
  { preset_id: 'executive', name: 'Executive', description: 'Boardroom theme with polished, formal styling' },
  { preset_id: 'pastel', name: 'Pastel', description: 'Softer theme for lighter educational or creative decks' },
]
const FLAG = 'NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED'

// ── components/theme-panel.tsx ───────────────────────────────────────────
function renderPanel(env, props, swatchFetch) {
  const effects = []
  const react = {
    useState: init => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: fn => { effects.push(fn) },
    useMemo: fn => fn(),
  }
  const jsx = (type, props) => ({ type, props })
  const icons = new Proxy({}, { get: (_, name) => `Icon:${String(name)}` })
  const builder = load('lib/theme-builder.ts', { env })
  const swatches = fs.existsSync(new URL('lib/theme-preset-swatches.ts', root)) ? load('lib/theme-preset-swatches.ts', { fetch: swatchFetch }) : {}
  const panel = load('components/theme-panel.tsx', {
    env,
    imports: {
      './studio-editor-dialogs.css': {},
      './studio-theme-panel.css': {},
      react,
      'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
      'lucide-react': icons,
      '@/components/ui/button': { Button: 'Button' },
      '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9' },
      '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
      '@/lib/theme-builder': builder,
      '@/lib/theme-preset-swatches': swatches,
    },
  })
  const expand = node => {
    if (Array.isArray(node)) return node.map(expand)
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') return expand(node.type(node.props))
    const props = {}
    for (const [key, value] of Object.entries(node.props || {})) {
      props[key] = key === 'children' ? expand(value) : typeof value === 'function' ? '[fn]' : value
    }
    return { type: node.type, props }
  }
  return { tree: expand(panel.ThemePanel(props)), effects }
}
const sync = { status: 'idle', requestId: null, presentationId: null, themeFingerprint: null, error: null }
const panelCases = [
  ...SIX.map(id => ({ mode: 'preset', preset_id: id })),
  ...FOUR.map(id => ({ mode: 'preset', preset_id: id })),
  { mode: 'preset', preset_id: 'vibrant-orange', color_overrides: { accent: '#123456' } },
  { mode: 'preset', preset_id: 'unknown-old-theme' },
  { mode: 'auto' },
  { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b' },
]
const hashPanel = env => crypto.createHash('sha256').update(JSON.stringify(panelCases.map(selection => renderPanel(env, {
  isOpen: true, onClose() {}, presentationId: 'deck-1', buildThemeSelection: selection, themeSync: sync, onBuildThemeChange() {},
}).tree))).digest('hex')

if (process.env.THEME_PICKER_PRINT_PANEL_HASH) {
  console.log(hashPanel({}))
  process.exit(0)
}

// ── lib/theme-builder.ts ─────────────────────────────────────────────────
for (const env of [{}, { [FLAG]: 'false' }, { [FLAG]: '1' }]) {
  const off = load('lib/theme-builder.ts', { env })
  assert.equal(off.THEME_PICKER_CANON_ENABLED, false)
  assert.deepEqual(plain(off.CANONICAL_THEME_PRESET_IDS), SIX)
  assert.deepEqual(plain(off.FALLBACK_THEME_PRESETS), BASE_FALLBACK)
  for (const id of FOUR) {
    assert.equal(off.isCanonicalThemePresetId(id), false)
    assert.equal(off.normalizeThemePanelSelection({ mode: 'preset', preset_id: id }).preset_id, 'corporate_light')
    assert.equal(off.selectCanonicalThemePreset({ mode: 'auto' }, id).preset_id, 'corporate_light')
  }
}
// A sandbox without `process` (the older lifecycle tests) reads the flag as off.
{
  const source = fs.readFileSync(new URL('lib/theme-builder.ts', root), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports })
  assert.equal(module.exports.THEME_PICKER_CANON_ENABLED, false)
  assert.deepEqual(plain(module.exports.CANONICAL_THEME_PRESET_IDS), SIX)
}

const on = load('lib/theme-builder.ts', { env: { [FLAG]: 'true' } })
assert.equal(on.THEME_PICKER_CANON_ENABLED, true)
assert.deepEqual(plain(on.CANONICAL_THEME_PRESET_IDS), [...SIX, ...FOUR])
assert.deepEqual(plain(on.FALLBACK_THEME_PRESETS).slice(0, 6), BASE_FALLBACK)
assert.deepEqual(plain(on.FALLBACK_THEME_PRESETS).slice(6).map(p => [p.preset_id, p.name]), [
  ['concrete_acid', 'Concrete Acid'],
  ['espresso_editorial', 'Espresso Editorial'],
  ['gilded_noir', 'Gilded Noir'],
  ['mission_amber', 'Mission Amber'],
])
for (const id of FOUR) {
  assert.equal(on.isCanonicalThemePresetId(id), true)
  assert.equal(on.normalizeThemePanelSelection({ mode: 'preset', preset_id: id }).preset_id, id)
  assert.equal(on.selectCanonicalThemePreset({ mode: 'auto' }, id).preset_id, id)
  assert.equal(on.normalizeThemePanelSelection({ mode: 'preset', preset_id: ` ${id.toUpperCase()} ` }).preset_id, id)
}
assert.equal(on.normalizeThemePanelSelection({ mode: 'preset', preset_id: 'Gilded Noir' }).preset_id, 'gilded_noir')
assert.equal(on.normalizeThemePanelSelection({ mode: 'preset', preset_id: 'unknown-old-theme' }).preset_id, 'corporate_light')
assert.equal(on.normalizeThemePanelSelection({ mode: 'preset', preset_id: 'dark-mode' }).preset_id, 'corporate_dark')

// ── lib/theme-preset-swatches.ts ────────────────────────────────────────
const contract = (hero, primary, accent, surface = '#FFFFFF', text = '#111111') => ({
  meta: { name: 'x' },
  palette: { hero: { hero_background: hero }, brand: { primary }, accent: { accent }, neutral: { surface, background: '#0A0C12' }, text: { text_primary: text } },
})
{
  const swatches = load('lib/theme-preset-swatches.ts')
  assert.deepEqual(plain(swatches.swatchPaletteFromThemeContract(contract('#17140F', '#C9A227', '#B0B0B0', '#17140F', '#F3EDE0'))), {
    background: '#0a0c12', surface: '#17140f', primary: '#c9a227', accent: '#b0b0b0', text: '#f3ede0',
    swatch: { canvas: '#ffffff', hero: '#17140f', lead: '#c9a227' },
  })
  assert.equal(swatches.swatchPaletteFromThemeContract({ palette: { hero: {} } }), null)
  assert.equal(swatches.swatchPaletteFromThemeContract(null), null)

  const calls = []
  let failGilded = true
  const stub = async url => {
    calls.push(url)
    const id = url.split('/').pop()
    if (id === 'gilded_noir' && failGilded) return { ok: false, json: async () => ({}) }
    if (id === 'mission_amber') throw new Error('offline')
    return { ok: true, json: async () => contract('#121B32', '#16203A', '#D62A3C') }
  }
  const first = await swatches.loadPresetSwatchPalettes('http://127.0.0.1:9/', ['corporate_light', 'gilded_noir', 'mission_amber'], stub)
  assert.deepEqual(Object.keys(first), ['corporate_light'])
  assert.deepEqual(calls, [
    'http://127.0.0.1:9/api/v1/themes/presets/corporate_light',
    'http://127.0.0.1:9/api/v1/themes/presets/gilded_noir',
    'http://127.0.0.1:9/api/v1/themes/presets/mission_amber',
  ])
  failGilded = false
  const second = await swatches.loadPresetSwatchPalettes('http://127.0.0.1:9', ['corporate_light', 'gilded_noir'], stub)
  assert.deepEqual(Object.keys(second).sort(), ['corporate_light', 'gilded_noir'])
  // corporate_light was cached; only the failed read is retried.
  assert.deepEqual(calls.slice(3), ['http://127.0.0.1:9/api/v1/themes/presets/gilded_noir'])
}

// The flag-off snapshot was rendered from the base commit 6d47cae4 with this
// same harness. Any flag-off drift in the picker changes this hash.
const BASE_FLAG_OFF_PANEL_SHA256 = '4ee91f7a017012b5f51d86b4aac78d17398c198c49bd80c1035abfd407f296fc'
assert.equal(hashPanel({}), BASE_FLAG_OFF_PANEL_SHA256)
assert.equal(hashPanel({ [FLAG]: 'false' }), BASE_FLAG_OFF_PANEL_SHA256)

// Flag off: no Theme Builder read is scheduled to do anything.
{
  let fetched = 0
  const { effects } = renderPanel({}, { isOpen: true, onClose() {}, buildThemeSelection: { mode: 'auto' }, themeSync: sync }, async () => { fetched++ })
  effects.forEach(fn => fn())
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(fetched, 0)
}

// Flag on: ten cards, the canon-only pick is not coerced, and the panel reads TB's contracts.
{
  const find = (node, test, out = []) => {
    if (Array.isArray(node)) node.forEach(child => find(child, test, out))
    else if (node && typeof node === 'object') { if (test(node)) out.push(node); find(node.props?.children, test, out) }
    return out
  }
  const urls = []
  const { tree, effects } = renderPanel({ [FLAG]: 'true' }, {
    isOpen: true, onClose() {}, buildThemeSelection: { mode: 'preset', preset_id: 'gilded_noir' }, themeSync: sync,
  }, async url => { urls.push(url); return { ok: true, json: async () => contract('#17140F', '#C9A227', '#C9A227') } })
  const cards = find(tree, node => node.type === 'button' && /relative rounded-lg border-2 p-2/.test(node.props.className || ''))
  assert.equal(cards.length, 10)
  const selected = cards.filter(card => /border-blue-500/.test(card.props.className))
  assert.equal(selected.length, 1)
  assert.ok(JSON.stringify(selected[0]).includes('Gilded Noir'))
  effects.forEach(fn => fn())
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(urls, [...SIX, ...FOUR].map(id => `http://127.0.0.1:9/api/v1/themes/presets/${id}`))
}

console.log('theme picker canon tests passed')
