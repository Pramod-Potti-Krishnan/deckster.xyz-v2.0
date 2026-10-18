// PASS2D 5: the Themes & brand preview draws a preset in Theme Builder's own canon colours (flag NEXT_PUBLIC_STUDIO_THEME_PREVIEW_CANON, exact "true" plus the Studio shell, default off).
// The finding (PASS2-J4-FINDINGS item 5; THEME-2 run 2): a base of Gilded Noir previewed as a white slide with lavender circles and saved an indigo swatch where the deck picker shows near-black
// with gold; Minimal previewed slate where its canon is black and red; any canon-only preset fell back to Corporate Light's blue. components/studio-libraries/theme-preview.tsx keeps pre-canon
// palettes. With the flag on the preview takes a preset's colours from Theme Builder's own contract, the read the deck picker makes, and everything else is the preview's own rule.
//
// Run: node scripts/test-studio-theme-preview-canon.mjs   (plain node: transpile + vm, no network, no React runtime)
//   THEME_PREVIEW_CANON_BASE=<commit> overrides the base the flag-off identity is checked against (default fbc77c0, origin/studio-v4-dev-preparation-code before this change).
//
// Proven on the REAL sources: lib/studio-theme-preview-canon.ts (imports nothing), components/studio-libraries/theme-preview.tsx, use-canon-preview-palettes.ts and themes-workspace.tsx (with
// lib/theme-preset-swatches.ts, which makes the Theme Builder read) run in a vm with a small hooks runtime and a local Theme Builder. Without a palette map the preview is the base commit's,
// output for output; with one, each preset's base is its canon palette and the preview's own override rules sit on top, as before. Then every suite is re-run against broken copies.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const treeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const BASE_COMMIT = process.env.THEME_PREVIEW_CANON_BASE || 'fbc77c0'
const baseSource = file => execFileSync('git', ['show', `${BASE_COMMIT}:${file}`], { cwd: treeRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_PREVIEW_CANON'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const CANON = 'NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED'
const FILES = { lib: 'lib/studio-theme-preview-canon.ts', preview: 'components/studio-libraries/theme-preview.tsx', hook: 'components/studio-libraries/use-canon-preview-palettes.ts', workspace: 'components/studio-libraries/themes-workspace.tsx' }
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

// ---- a local Theme Builder: the five fields the picker reads from GET /api/v1/themes/presets/{id} (colours as Theme Builder's canon library defines them) ----
const TB = 'http://tb.local.test'
const CONTRACTS = {
  corporate_light: { hero: '#121B32', primary: '#16203A', accent: '#D62A3C', background: '#F1F4F9', surface: '#FFFFFF', text: '#16203A' },
  corporate_dark: { hero: '#0E2A31', primary: '#00E0FF', accent: '#00E0FF', background: '#0A0C12', surface: '#12151D', text: '#E8EDF2' },
  minimal: { hero: '#111111', primary: '#E3241D', accent: '#E3241D', background: '#FFFFFF', surface: '#F2F2F2', text: '#111111' },
  vibrant: { hero: '#232842', primary: '#C0392B', accent: '#C0392B', background: '#F2EFE5', surface: '#F2EFE5', text: '#2B2E3D' },
  executive: { hero: '#1D5B3C', primary: '#1D5B3C', accent: '#1D5B3C', background: '#FFFFFF', surface: '#F4F5F3', text: '#161816' },
  pastel: { hero: '#2E3B20', primary: '#2E3B20', accent: '#C06A38', background: '#F1EEE5', surface: '#EAE2D0', text: '#26291C' },
  concrete_acid: { hero: '#0F0F0D', primary: '#0F0F0D', accent: '#D6F221', background: '#E6E4DE', surface: '#D4D1C9', text: '#0F0F0D' },
  espresso_editorial: { hero: '#291D14', primary: '#A9682F', accent: '#A9682F', background: '#F4F0E7', surface: '#FBF8F1', text: '#211F1A' },
  gilded_noir: { hero: '#17140F', primary: '#C9A227', accent: '#C9A227', background: '#0F0D09', surface: '#17140F', text: '#F3EDE0' },
  mission_amber: { hero: '#241A12', primary: '#E8622C', accent: '#E8622C', background: '#171008', surface: '#241A12', text: '#F2E7D2' },
}
const IDS = Object.keys(CONTRACTS)
const SIX = IDS.slice(0, 6), FOUR = IDS.slice(6)
const contractBody = c => ({ palette: { hero: { hero_background: c.hero }, brand: { primary: c.primary }, accent: { accent: c.accent }, neutral: { background: c.background, surface: c.surface }, text: { text_primary: c.text } } })
function makeFetch(requests, mode = 'ok', unknown = []) {
  return async url => {
    requests.push(String(url))
    if (mode === 'down') throw new Error('network refused')
    const id = String(url).split('/').pop()
    return CONTRACTS[id] && !unknown.includes(id) ? { ok: true, json: async () => contractBody(CONTRACTS[id]) } : { ok: false, json: async () => ({}) }
  }
}
// What the picker's own reader (lib/theme-preset-swatches.ts) hands on: every colour lower-cased.
const lower = c => Object.fromEntries(Object.entries(c).map(([key, value]) => [key, value.toLowerCase()]))
const swatchPalette = id => { const c = lower(CONTRACTS[id]); return { background: c.background, surface: c.surface, primary: c.primary, accent: c.accent, text: c.text, swatch: { canvas: '#ffffff', hero: c.hero, lead: c.primary } } }
const CANON_ALL = Object.fromEntries(IDS.map(id => [id, swatchPalette(id)]))
const canonBase = id => { const c = lower(CONTRACTS[id]); return { background: c.background, surface: c.surface, primary: c.primary, accent: c.accent, text_primary: c.text } }

// The preview's own rules, written out independently: derived tokens from the base, then a custom theme's colours, then explicit overrides.
const HEX6 = /^#[0-9a-fA-F]{6}$/
function expectedPalette(selection, base) {
  const palette = { ...base, secondary: base.accent, tertiary: base.primary, neutral: '#64748b', text_body: base.text_primary, border: '#94a3b8' }
  for (const key of ['primary', 'secondary', 'tertiary', 'neutral']) { const color = selection[`${key}_hex`]; if (selection.mode === 'custom' && HEX6.test(color || '')) palette[key] = color }
  if (selection.mode === 'custom' && HEX6.test(selection.secondary_hex || '')) palette.accent = selection.secondary_hex
  for (const [token, color] of Object.entries(selection.color_overrides || {})) if (HEX6.test(color)) palette[token] = color
  return palette
}

// ---- loaders ----------------------------------------------------------------------------------------------------------------
function loadPreview(env = {}, overrides = {}) { return createLoader({ env, stubs: { 'react/jsx-runtime': jsxRuntime }, overrides }).load(FILES.preview) }
const SELECTIONS = [
  { mode: 'auto' }, { mode: 'preset' },
  ...IDS.map(id => ({ mode: 'preset', preset_id: id })),
  { mode: 'preset', preset_id: 'corporate-blue' }, { mode: 'preset', preset_id: 'Gilded Noir' }, { mode: 'preset', preset_id: 'retired_theme' }, { mode: 'preset', preset_id: 'constructor' }, { mode: 'preset', preset_id: '__proto__' },
  { mode: 'preset', preset_id: 'minimal', color_overrides: { primary: '#00ff00', surface: '#0a0b0c', bogus: '#112233', border: 'red' } },
  { mode: 'preset', preset_id: 'gilded_noir', color_overrides: { background: '#ffffff', text_primary: '#010203' } },
  { mode: 'custom', preset_id: 'gilded_noir', primary_hex: '#1e40af', secondary_hex: '#f59e0b' },
  { mode: 'custom', preset_id: 'minimal', primary_hex: '#1e40af', tertiary_hex: '#223344', neutral_hex: 'nope', color_overrides: { accent: '#abcdef' } },
  { mode: 'custom', primary_hex: '#123456' },
  { mode: 'preset', preset_id: 'minimal', font_family: 'Lato', font_family_heading: 'Playfair Display' },
]
const sel = s => `${s.mode}/${s.preset_id ?? ''}${s.primary_hex ? '/c' : ''}${s.color_overrides ? '/o' : ''}`
const ON = { [FLAG]: 'true', [SHELL]: 'true' }
const normalizeId = createLoader({}).load('lib/theme-builder.ts').normalizeThemePresetId

// ---- suite 1: the pure helper -----------------------------------------------------------------------------------------------
function pureSuite(overrides = {}) {
  const load = env => createLoader({ env, overrides }).load(FILES.lib)
  for (const [env, expected] of [[{}, false], [{ [FLAG]: 'true' }, false], [{ [SHELL]: 'true' }, false], [{ [FLAG]: 'true', [SHELL]: 'true' }, true], [{ [FLAG]: 'TRUE', [SHELL]: 'true' }, false], [{ [FLAG]: '1', [SHELL]: 'true' }, false],
    [{ [FLAG]: 'false', [SHELL]: 'true' }, false], [{ [FLAG]: '', [SHELL]: 'true' }, false], [{ [FLAG]: 'true', [SHELL]: 'false' }, false], [{ [FLAG]: ' true', [SHELL]: 'true' }, false]]) {
    check(assert.equal, load(env).STUDIO_THEME_PREVIEW_CANON_ENABLED, expected, JSON.stringify(env))
  }
  // a sandbox with no `process` (the other tests' vm loaders) reads as off and does not throw
  const sandbox = { module: { exports: {} }, exports: {} }
  vm.runInNewContext(compile(FILES.lib, overrides[FILES.lib] ?? read(FILES.lib)), { ...sandbox, exports: sandbox.module.exports })
  check(assert.equal, sandbox.module.exports.STUDIO_THEME_PREVIEW_CANON_ENABLED, false, 'no process: off')
  const lib = load(ON)
  // the pending grey is the deck picker's own (components/theme-panel.tsx PENDING_PREVIEW_PALETTE)
  const panel = read('components/theme-panel.tsx')
  const pending = Object.fromEntries([...panel.slice(panel.indexOf('const PENDING_PREVIEW_PALETTE')).split('}')[0].matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map(match => [match[1], match[2]]))
  check(assert.deepEqual, plain(lib.PENDING_CANON_PREVIEW_BASE), { background: pending.background, surface: pending.surface, primary: pending.primary, accent: pending.accent, text_primary: pending.text }, 'the picker\'s pending swatch')
  // canonPreviewBase: all five colours, six-digit hex, or null
  const good = { background: '#0f0d09', surface: '#17140f', primary: '#c9a227', accent: '#c9a227', text: '#f3ede0' }
  check(assert.deepEqual, plain(lib.canonPreviewBase(good)), { background: '#0f0d09', surface: '#17140f', primary: '#c9a227', accent: '#c9a227', text_primary: '#f3ede0' })
  check(assert.deepEqual, plain(lib.canonPreviewBase({ ...good, swatch: { hero: '#000000' }, extra: 'x' })), { background: '#0f0d09', surface: '#17140f', primary: '#c9a227', accent: '#c9a227', text_primary: '#f3ede0' }, 'other fields are ignored')
  check(assert.deepEqual, plain(lib.canonPreviewBase({ ...good, primary: '#C9A227' })).primary, '#C9A227', 'upper case is a colour')
  for (const field of Object.keys(good)) for (const bad of [undefined, null, '', 'gold', '#fff', '#c9a22', '#c9a2277', '#c9a22g', 'c9a227', 7, [], {}]) {
    check(assert.equal, lib.canonPreviewBase({ ...good, [field]: bad }), null, `${field}=${ser(bad)}`)
  }
  for (const junk of [null, undefined, 'x', 7, [], {}, true]) check(assert.equal, lib.canonPreviewBase(junk), null, ser(junk))
  check(assert.notEqual, lib.canonPreviewBase(good), lib.canonPreviewBase(good), 'a fresh object each time')
  // previewBaseFor: the order
  const legacy = { background: '#111111', surface: '#222222', primary: '#333333', accent: '#444444', text_primary: '#555555' }
  const fallback = { background: '#aaaaaa', surface: '#bbbbbb', primary: '#cccccc', accent: '#dddddd', text_primary: '#eeeeee' }
  const canonOnlyIds = ['gilded_noir', 'mission_amber']
  const pick = args => lib.previewBaseFor({ id: 'gilded_noir', canon: {}, legacy: undefined, canonOnlyIds, fallback, ...args })
  check(assert.deepEqual, plain(pick({ canon: { gilded_noir: good } })), plain(lib.canonPreviewBase(good)), '1. the answered palette')
  check(assert.deepEqual, plain(pick({ canon: { gilded_noir: good }, legacy })), plain(lib.canonPreviewBase(good)), '1. wins over the older guide')
  check(assert.deepEqual, plain(pick({ canon: { gilded_noir: { ...good, text: 'x' } }, legacy })), legacy, '2. an incomplete answer falls to the older guide')
  check(assert.equal, pick({ canon: {}, legacy }), legacy, '2. the older guide, as is')
  check(assert.equal, pick({ canon: { minimal: good }, legacy }), legacy, '2. another preset\'s answer is not used')
  check(assert.deepEqual, plain(pick({ canon: {} })), plain(lib.PENDING_CANON_PREVIEW_BASE), '3. a canon-only preset with no answer: neutral grey')
  check(assert.deepEqual, plain(pick({ canon: { gilded_noir: { ...good, accent: 'x' } } })), plain(lib.PENDING_CANON_PREVIEW_BASE), '3. an incomplete answer too')
  check(assert.notEqual, pick({ canon: {} }), lib.PENDING_CANON_PREVIEW_BASE, '3. a copy, not the shared constant')
  check(assert.equal, pick({ canon: {}, id: 'retired_theme' }), fallback, '4. an unknown preset: the reference palette')
  check(assert.equal, pick({ canon: {}, id: undefined }), fallback, '4. no preset (Auto): the reference palette')
  check(assert.equal, pick({ canon: {}, id: 'minimal' }), fallback, '4. a legacy-less non-canon-only id')
  for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) check(assert.equal, pick({ canon: {}, id }), fallback, `prototype id ${id}`)
  check(assert.deepEqual, plain(pick({ canon: Object.create({ gilded_noir: good }) })), plain(lib.PENDING_CANON_PREVIEW_BASE), 'an inherited property is not an answer')
  check(assert.equal, lib.previewBaseFor.length, 1)
  const source = overrides[FILES.lib] ?? read(FILES.lib)
  check(assert.equal, ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true).statements.filter(ts.isImportDeclaration).length, 0, 'imports nothing')
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_PREVIEW_CANON/g) ?? []).length, 1, 'flag read once, literal')
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL/g) ?? []).length, 1, 'shell read once, literal')
}

// ---- suite 2: the real preview ----------------------------------------------------------------------------------------------
function previewSuite(overrides = {}) {
  const baseOverrides = { [FILES.preview]: baseSource(FILES.preview) }
  for (const env of [{}, { [CANON]: 'true' }]) {
    const mine = loadPreview(env, overrides), base = loadPreview(env, baseOverrides)
    // no palette map (flag off): the base commit's outputs, palette, swatches and specimens alike
    for (const s of SELECTIONS) {
      check(assert.deepEqual, plain(mine.themePreviewPalette(s)), plain(base.themePreviewPalette(s)), `${JSON.stringify(env)} ${sel(s)}: palette`)
      check(assert.equal, ser(mine.ThemeSwatches({ selection: s })), ser(base.ThemeSwatches({ selection: s })), `${sel(s)}: swatches`)
      for (const specimen of ['title', 'data', 'content']) check(assert.equal, ser(mine.ThemePreview({ selection: s, specimen, name: 'Evergreen' })), ser(base.ThemePreview({ selection: s, specimen, name: 'Evergreen' })), `${sel(s)} ${specimen}: specimen`)
    }
    // a complete palette map: each preset's base is its canon palette; the preview's own rules sit on top
    for (const s of SELECTIONS) {
      const id = normalizeId(s.preset_id)
      const known = typeof id === 'string' && IDS.includes(id)
      const baseFor = known ? canonBase(id) : (() => { const p = base.themePreviewPalette({ mode: 'preset', preset_id: s.preset_id }); return { background: p.background, surface: p.surface, primary: p.primary, accent: p.accent, text_primary: p.text_primary } })()
      check(assert.deepEqual, plain(mine.themePreviewPalette(s, CANON_ALL)), plain(expectedPalette(s, baseFor)), `${JSON.stringify(env)} ${sel(s)}: canon palette`)
    }
    // no answer yet: the six keep their older guide; a canon-only preset a neutral grey, never Corporate Light's colours; the rest as before
    for (const id of SIX) {
      const s = { mode: 'preset', preset_id: id }
      check(assert.deepEqual, plain(mine.themePreviewPalette(s, {})), plain(base.themePreviewPalette(s)), `${id}: the older guide while Theme Builder is silent`)
    }
    for (const id of FOUR) {
      const s = { mode: 'preset', preset_id: id }
      const p = plain(mine.themePreviewPalette(s, {}))
      check(assert.deepEqual, [p.background, p.surface, p.primary, p.accent, p.text_primary], ['#ffffff', '#f3f4f6', '#d1d5db', '#e5e7eb', '#374151'], `${id}: neutral grey while Theme Builder is silent`)
      const corporate = plain(base.themePreviewPalette({ mode: 'preset', preset_id: 'corporate_light' }))
      check(assert.notEqual, p.primary, corporate.primary, `${id}: not Corporate Light's blue`)
      check(assert.notEqual, p.accent, corporate.accent, `${id}: not Corporate Light's amber`)
    }
    for (const s of [{ mode: 'auto' }, { mode: 'preset', preset_id: 'retired_theme' }, { mode: 'custom', primary_hex: '#123456' }]) {
      check(assert.deepEqual, plain(mine.themePreviewPalette(s, {})), plain(base.themePreviewPalette(s)), `${sel(s)}: unchanged while Theme Builder is silent`)
      check(assert.deepEqual, plain(mine.themePreviewPalette(s, CANON_ALL)), plain(base.themePreviewPalette(s)), `${sel(s)}: unchanged when Theme Builder does not know it`)
    }
    // some answered, some not
    const partial = { gilded_noir: swatchPalette('gilded_noir'), minimal: { ...swatchPalette('minimal'), surface: 'x' } }
    check(assert.deepEqual, plain(mine.themePreviewPalette({ mode: 'preset', preset_id: 'gilded_noir' }, partial)), plain(expectedPalette({}, canonBase('gilded_noir'))), 'the answered one')
    check(assert.deepEqual, plain(mine.themePreviewPalette({ mode: 'preset', preset_id: 'minimal' }, partial)), plain(base.themePreviewPalette({ mode: 'preset', preset_id: 'minimal' })), 'an incomplete answer: the older guide')
    check(assert.deepEqual, plain(mine.themePreviewPalette({ mode: 'preset', preset_id: 'mission_amber' }, partial)).primary, '#d1d5db', 'an unanswered canon-only preset: grey')
    // the J4 finding, in numbers
    const noir = plain(mine.themePreviewPalette({ mode: 'preset', preset_id: 'gilded_noir' }, CANON_ALL))
    check(assert.equal, noir.background, '#0f0d09', 'Gilded Noir is near-black'); check(assert.equal, noir.primary, '#c9a227', 'with gold'); check(assert.equal, noir.text_primary, '#f3ede0')
    const minimal = plain(mine.themePreviewPalette({ mode: 'preset', preset_id: 'minimal' }, CANON_ALL))
    check(assert.equal, minimal.primary, '#e3241d', 'Minimal is red'); check(assert.equal, minimal.text_primary, '#111111', 'and black'); check(assert.notEqual, minimal.primary, '#334155'); check(assert.notEqual, minimal.accent, '#94a3b8')
    const baseNoir = plain(base.themePreviewPalette({ mode: 'preset', preset_id: 'gilded_noir' }))
    check(assert.equal, baseNoir.background, '#ffffff', 'the base drew Gilded Noir on white'); check(assert.equal, baseNoir.primary, '#1e40af', 'in Corporate Light\'s blue')
    // swatches and specimens read the same palette
    for (const id of ['gilded_noir', 'minimal', 'concrete_acid']) {
      const s = { mode: 'preset', preset_id: id }
      const palette = plain(expectedPalette(s, canonBase(id)))
      const chips = flat(mine.ThemeSwatches({ selection: s, canon: CANON_ALL })).filter(node => node.type === 'i').map(node => node.props.style.backgroundColor)
      check(assert.deepEqual, chips, ['primary', 'accent', 'surface', 'background'].map(token => palette[token]), `${id}: swatch chips`)
      for (const specimen of ['title', 'data', 'content']) {
        const slide = mine.ThemePreview({ selection: s, specimen, name: 'X', canon: CANON_ALL })
        for (const [key, value] of Object.entries(palette)) check(assert.equal, slide.props.style[`--spec-${key}`], value, `${id} ${specimen}: --spec-${key}`)
        check(assert.equal, JSON.stringify(slide).includes('"canon"'), false, 'the canon map is not passed on to the DOM')
      }
    }
    // the font attributes and the rest of the specimen are unchanged by a palette map
    const withFonts = { mode: 'preset', preset_id: 'minimal', font_family: 'Lato', font_family_heading: 'Playfair Display' }
    const strip = node => ser(node).replace(/#[0-9a-fA-F]{6}/g, '#')
    check(assert.equal, strip(mine.ThemePreview({ selection: withFonts, specimen: 'title', name: 'X', canon: CANON_ALL })), strip(base.ThemePreview({ selection: withFonts, specimen: 'title', name: 'X' })), 'with a palette map only colours differ')
  }
  const source = overrides[FILES.preview] ?? read(FILES.preview)
  check(assert.equal, (source.match(/process\.env/g) ?? []).length, 0, 'the preview reads no environment')
  check(assert.equal, (source.match(/previewBaseFor\(/g) ?? []).length, 1, 'one use of the helper')
  check(assert.ok, source.includes('const base = canon ? previewBaseFor({ id, canon, legacy, canonOnlyIds: CANON_ONLY_THEME_PRESET_IDS, fallback: PREVIEW_PALETTES.corporate_light }) : legacy || PREVIEW_PALETTES.corporate_light'), 'the line')
  check(assert.ok, source.includes('const legacy = (isCanonicalThemePresetId(id) && PREVIEW_PALETTES[id]) || undefined'), 'the older guide, as it was looked up')
  check(assert.equal, ts.createSourceFile('p.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text).sort().join(','), '@/lib/studio-theme-preview-canon,@/lib/theme-builder,@/lib/theme-preset-swatches,react', 'the preview file imports only these')
}

// ---- suite 3: the real hook -------------------------------------------------------------------------------------------------
async function hookSuite(overrides = {}) {
  async function run(env, { mode = 'ok', unknown = [], unconfigured = false } = {}) {
    const runtime = createRuntime(); const requests = []
    const stubs = { react: runtime.react, '@/lib/config': { getThemeBuilderUrl: unconfigured ? () => { throw new Error('not configured') } : () => TB } }
    const { useCanonPreviewPalettes } = createLoader({ env, stubs, globals: { fetch: makeFetch(requests, mode, unknown) }, overrides }).load(FILES.hook)
    let value
    const Root = () => { value = useCanonPreviewPalettes(); return { type: 'div', props: {} } }
    runtime.render(Root, {})
    const first = value
    for (let i = 0; i < 10; i++) { await tick(); if (!runtime.pending) break; runtime.render(Root, {}) }
    runtime.render(Root, {})
    return { first, value, requests }
  }
  const expectedUrls = IDS.map(id => `${TB}/api/v1/themes/presets/${id}`).sort()
  // flag off, in any way: undefined, and no read
  for (const env of [{}, { [SHELL]: 'true' }, { [FLAG]: 'true' }, { [FLAG]: 'TRUE', [SHELL]: 'true' }, { [FLAG]: '1', [SHELL]: 'true' }, { [FLAG]: 'false', [SHELL]: 'true' }, { [FLAG]: '', [SHELL]: 'true' }]) {
    const r = await run(env)
    check(assert.equal, r.value, undefined, `${JSON.stringify(env)}: undefined`); check(assert.deepEqual, r.requests, [], `${JSON.stringify(env)}: no read`)
  }
  // flag on: {} until Theme Builder answers, then every preset it answered for; the same ten reads whatever the picker's own canon flag says
  for (const env of [ON, { ...ON, [CANON]: 'true' }]) {
    const r = await run(env)
    check(assert.deepEqual, plain(r.first), {}, `${JSON.stringify(env)}: {} before the answer`)
    check(assert.deepEqual, Object.keys(r.value).sort(), [...IDS].sort(), `${JSON.stringify(env)}: all ten answered`)
    for (const id of IDS) check(assert.deepEqual, plain(r.value[id]), plain(swatchPalette(id)), `${JSON.stringify(env)} ${id}: the picker's own reading of the contract`)
    check(assert.deepEqual, [...r.requests].sort(), expectedUrls, `${JSON.stringify(env)}: one read per preset`)
  }
  // some unknown to Theme Builder, all down, not configured
  const some = await run(ON, { unknown: ['gilded_noir', 'pastel'] })
  check(assert.deepEqual, Object.keys(some.value).sort(), IDS.filter(id => !['gilded_noir', 'pastel'].includes(id)).sort(), 'only the answered presets')
  const down = await run(ON, { mode: 'down' })
  check(assert.deepEqual, plain(down.value), {}, 'Theme Builder down: {}'); check(assert.equal, down.requests.length, 10, 'it was asked')
  const unconfigured = await run(ON, { unconfigured: true })
  check(assert.deepEqual, plain(unconfigured.value), {}, 'no Theme Builder URL: {}'); check(assert.deepEqual, unconfigured.requests, [], 'and no read')
  const source = overrides[FILES.hook] ?? read(FILES.hook)
  check(assert.equal, /process\.env|localStorage|method:|POST|PUT|DELETE|PATCH/.test(source), false, 'no env read, storage or write in the hook file')
  check(assert.equal, (source.match(/loadPresetSwatchPalettes\(/g) ?? []).length, 1, 'the deck picker\'s own reader')
  check(assert.equal, ts.createSourceFile('h.ts', source, ts.ScriptTarget.Latest, true).statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text).sort().join(','), '@/lib/config,@/lib/studio-theme-preview-canon,@/lib/theme-builder,@/lib/theme-preset-swatches,react', 'imports')
}

// ---- suite 4: the real workspace --------------------------------------------------------------------------------------------
const SAVED = [
  { id: 's-noir', name: 'Noir saved', description: 'd', is_standard: false, theme_payload: { mode: 'preset', preset_id: 'gilded_noir' } },
  { id: 's-minimal', name: 'Minimal saved', description: 'e', is_standard: false, theme_payload: { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#abcdef' } } },
  { id: 's-acid', name: 'Acid saved', description: 'f', is_standard: false, theme_payload: { mode: 'preset', preset_id: 'concrete_acid' } },
  { id: 's-custom', name: 'Custom saved', description: 'g', is_standard: false, theme_payload: { mode: 'custom', primary_hex: '#1e40af', preset_id: 'gilded_noir' } },
  { id: 's-old', name: 'Old saved', description: 'h', is_standard: false, theme_payload: { mode: 'preset', preset_id: 'retired_theme' } },
]
function mountWorkspace(env, overrides = {}, hookValue = { real: true }) {
  const runtime = createRuntime()
  const refuse = () => assert.fail('No network, storage, navigation or services allowed')
  const api = { error: null, listThemes: async () => ({ themes: SAVED, count: SAVED.length }), saveTheme: refuse, setStandardTheme: refuse, clearStandardTheme: refuse }
  const stubs = {
    react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons,
    '@/lib/studio-inspector-focus': { keepStudioScrollFocusVisible: refuse },
    './library-account-boundary': { useStudioLibraryAccount: () => null, libraryAccountCanStart: () => true, libraryAccountIsCurrent: () => true },
    './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' },
    './library-controls': { ...Object.fromEntries(['FittedLibraryStage', 'LibraryLoading', 'LibraryNotice', 'LibrarySearch', 'LibraryWorkspace', 'MetadataDisclosure', 'ReadValue', 'StudioWorkflowLink'].map(name => [name, name])), libraryDate: String },
    '@/hooks/use-theme-profiles': { useThemeProfiles: () => api },
    '@/lib/config': { getThemeBuilderUrl: () => TB },
    ...(hookValue.real ? {} : { './use-canon-preview-palettes': { useCanonPreviewPalettes: () => hookValue.value } }),
  }
  const requests = []
  const { ThemesWorkspace } = createLoader({ env: { [SHELL]: 'true', ...env }, stubs, globals: { window: { addEventListener() {}, removeEventListener() {} }, fetch: makeFetch(requests) }, overrides }).load(FILES.workspace)
  const w = {
    tree: null, requests,
    render() { w.tree = runtime.render(ThemesWorkspace, {}); return w.tree },
    async settle() { for (let i = 0; i < 12; i++) { await new Promise(resolve => setTimeout(resolve, 0)); w.render() } return w.tree },
    async mode(mode) { w.tree.props.onModeChange(mode); w.render(); await w.settle() },
    pick(id) { flat(w.tree).find(node => node.type === 'button' && node.key === id).props.onClick(); w.render() },
    click(start) { flat(w.tree).find(node => node.type === 'button' && text(node).startsWith(start)).props.onClick(); w.render() },
  }
  w.render()
  return w
}
async function createTab(env, id, overrides, hookValue) {
  const w = mountWorkspace(env, overrides, hookValue)
  await w.settle()
  if (id) { await w.mode('library'); w.pick(id); w.click('Customize a copy'); await w.settle() }
  return w
}
const specimenOf = tree => flat(tree).find(node => typeof node.props?.className === 'string' && node.props.className.startsWith('sl-theme-slide'))
const chipsOfRecord = (tree, id) => flat(flat(tree).find(node => node.type === 'button' && node.key === id)).filter(node => node.type === 'i').map(node => node.props.style.backgroundColor)
const stripColours = tree => ser(tree).replace(/#[0-9a-fA-F]{6}/g, '#')

async function workspaceSuite(overrides = {}) {
  const baseOverrides = { [FILES.workspace]: baseSource(FILES.workspace), [FILES.preview]: baseSource(FILES.preview) }
  const DRAFTS = [null, 's-noir', 's-minimal', 's-acid', 's-custom', 's-old']
  // flag off: the base commit's tree on both tabs, whether the hook is the real one (flag unset or wrong) or answers undefined
  for (const env of [{}, { [FLAG]: 'true', [SHELL]: 'false' }, { [FLAG]: 'TRUE', [SHELL]: 'true' }, { [FLAG]: '1', [SHELL]: 'true' }, { [FLAG]: 'false', [SHELL]: 'true' }, { [SHELL]: 'true' }]) {
    for (const id of DRAFTS) {
      const mine = await createTab(env, id, overrides), base = await createTab(env, id, baseOverrides, { value: undefined })
      check(assert.equal, ser(mine.tree), ser(base.tree), `${JSON.stringify(env)} draft=${id}: create tab is the base`)
      check(assert.deepEqual, mine.requests, [], `${JSON.stringify(env)}: no read`)
      await mine.mode('library'); await base.mode('library')
      check(assert.equal, ser(mine.tree), ser(base.tree), `${JSON.stringify(env)} draft=${id}: library tab is the base`)
    }
  }
  // the hook answering undefined (the stub) is the same
  for (const id of DRAFTS) {
    const mine = await createTab({}, id, overrides, { value: undefined }), base = await createTab({}, id, baseOverrides, { value: undefined })
    check(assert.equal, ser(mine.tree), ser(base.tree), `stub undefined, draft=${id}: the base`)
  }
  // flag on, palettes in hand
  for (const [label, value] of [['all ten answered', CANON_ALL], ['none answered yet', {}], ['two answered', { gilded_noir: CANON_ALL.gilded_noir, minimal: CANON_ALL.minimal }]]) {
    for (const id of DRAFTS) {
      const cell = `${label} draft=${id}`
      const mine = await createTab({}, id, overrides, { value }), base = await createTab({}, id, baseOverrides, { value: undefined })
      // only colours differ
      check(assert.equal, stripColours(mine.tree), stripColours(base.tree), `${cell}: only colours differ (create tab)`)
      const draft = SAVED.find(theme => theme.id === id)?.theme_payload ?? { mode: 'preset', preset_id: 'minimal' }
      const nid = normalizeId(draft.preset_id)
      const known = typeof nid === 'string' && IDS.includes(nid)
      const answered = known && Object.hasOwn(value, nid)
      const legacyP = plain(loadPreview({}, baseOverrides).themePreviewPalette(draft))
      const expectedBase = answered ? canonBase(nid) : null
      const specimen = specimenOf(mine.tree)
      check(assert.ok, specimen, `${cell}: the specimen`)
      const palette = plain(loadPreview({}, overrides).themePreviewPalette(draft, value))
      if (expectedBase) check(assert.deepEqual, palette, plain(expectedPalette(draft, expectedBase)), `${cell}: the palette is the canon one with the preview's rules on top`)
      for (const [key, color] of Object.entries(palette)) check(assert.equal, specimen.props.style[`--spec-${key}`], color, `${cell}: specimen --spec-${key}`)
      check(assert.ok, !answered || palette.primary !== legacyP.primary || canonBase(nid).primary === legacyP.primary || draft.mode === 'custom' || draft.color_overrides, `${cell}: moved off the older guide`)
      await mine.mode('library'); await base.mode('library')
      check(assert.equal, stripColours(mine.tree), stripColours(base.tree), `${cell}: only colours differ (library tab)`)
      // each saved theme's chips are the preview's palette for it, with the map
      for (const theme of SAVED) {
        const p = plain(loadPreview({}, overrides).themePreviewPalette(theme.theme_payload, value))
        check(assert.deepEqual, chipsOfRecord(mine.tree, theme.id), ['primary', 'accent', 'surface', 'background'].map(token => p[token]), `${cell} ${theme.id}: row chips`)
      }
    }
  }
  // the J4 finding in the page: a saved Gilded Noir theme's chips are near-black and gold, not Corporate Light's indigo and amber
  const noir = await createTab({}, null, overrides, { value: CANON_ALL }); await noir.mode('library')
  check(assert.deepEqual, chipsOfRecord(noir.tree, 's-noir'), ['#c9a227', '#c9a227', '#17140f', '#0f0d09'], 'Gilded Noir row: gold and near-black')
  const was = await createTab({}, null, baseOverrides, { value: undefined }); await was.mode('library')
  check(assert.deepEqual, chipsOfRecord(was.tree, 's-noir'), ['#1e40af', '#f59e0b', '#eff6ff', '#ffffff'], 'the base drew it in Corporate Light\'s colours')
  // the real hook inside the workspace, flag on: asks Theme Builder, then the page uses the answer
  const live = await createTab(ON, null, overrides); await live.settle()
  check(assert.equal, live.requests.length, 10, 'ten reads through the real hook')
  check(assert.equal, specimenOf(live.tree).props.style['--spec-background'], '#ffffff', 'Minimal (the starting base) is on white')
  check(assert.equal, specimenOf(live.tree).props.style['--spec-primary'], '#e3241d', 'in its red, not slate')
  // wiring pins on the real sources
  const source = overrides[FILES.workspace] ?? read(FILES.workspace)
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_PREVIEW_CANON/g) ?? []).length, 0, 'the workspace never reads the flag itself')
  check(assert.equal, (source.match(/useCanonPreviewPalettes\(/g) ?? []).length, 1, 'one hook call')
  check(assert.ok, source.includes('const canonProp = canon ? { canon } : {}'), 'no canon key without a map')
  check(assert.ok, source.includes('const palette = themePreviewPalette(draft, canon)'), 'the placeholders read the same map')
  check(assert.equal, (source.match(/\{\.\.\.canonProp\}/g) ?? []).length, 2, 'swatches and specimen')
}

pureSuite()
previewSuite()
await hookSuite()
await workspaceSuite()

// ---- suite 5: mutants -------------------------------------------------------------------------------------------------------
const L = FILES.lib, V = FILES.preview, H = FILES.hook, W = FILES.workspace
const MUTANTS = [
  ['helper: flag without the shell', L, " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", ''],
  ['helper: flag always on', L, "process.env.NEXT_PUBLIC_STUDIO_THEME_PREVIEW_CANON === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", 'true'],
  ['helper: loose flag compare', L, "process.env.NEXT_PUBLIC_STUDIO_THEME_PREVIEW_CANON === 'true'", "process.env.NEXT_PUBLIC_STUDIO_THEME_PREVIEW_CANON !== 'false'"],
  ['helper: no process guard', L, '  } catch {\n    return false\n  }', '  } catch {\n    return true\n  }'],
  ['helper: pending grey changed', L, "primary: '#d1d5db'", "primary: '#d1d5dc'"],
  ['helper: pending grey is Corporate Light', L, "background: '#ffffff', surface: '#f3f4f6', primary: '#d1d5db', accent: '#e5e7eb', text_primary: '#374151'", "background: '#ffffff', surface: '#eff6ff', primary: '#1e40af', accent: '#f59e0b', text_primary: '#172033'"],
  ['helper: short hex accepted', L, 'const HEX = /^#[0-9a-fA-F]{6}$/', 'const HEX = /^#[0-9a-fA-F]{3,6}$/'],
  ['helper: surface unchecked', L, 'for (const value of [background, surface, primary, accent, text])', 'for (const value of [background, primary, accent, text])'],
  ['helper: text unchecked', L, 'for (const value of [background, surface, primary, accent, text])', 'for (const value of [background, surface, primary, accent])'],
  ['helper: text mapped to the wrong token', L, 'text_primary: text as string', 'text_primary: primary as string'],
  ['helper: accent mapped to primary', L, 'accent: accent as string,', 'accent: primary as string,'],
  ['helper: shared object returned', L, "return { ...PENDING_CANON_PREVIEW_BASE }", 'return PENDING_CANON_PREVIEW_BASE as PreviewBase'],
  ['helper: legacy before canon', L, "  if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(canon, id)) {\n    const answered = canonPreviewBase(canon[id])\n    if (answered) return answered\n  }\n  if (legacy) return legacy", "  if (legacy) return legacy\n  if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(canon, id)) {\n    const answered = canonPreviewBase(canon[id])\n    if (answered) return answered\n  }"],
  ['helper: legacy ignored', L, '  if (legacy) return legacy\n', ''],
  ['helper: canon-only grey dropped', L, "  if (typeof id === 'string' && canonOnlyIds.includes(id)) return { ...PENDING_CANON_PREVIEW_BASE }\n", ''],
  ['helper: grey for every id', L, "if (typeof id === 'string' && canonOnlyIds.includes(id)) return", 'if (typeof id === \'string\') return'],
  ['helper: prototype ids answer', L, 'Object.prototype.hasOwnProperty.call(canon, id)', '(id in canon)'],
  ['helper: incomplete answer used', L, 'if (answered) return answered', 'if (canon[id]) return canon[id] as PreviewBase'],
  ['preview: canon ignored', V, 'const base = canon ? previewBaseFor(', 'const base = false ? previewBaseFor('],
  ['preview: canon always', V, 'const base = canon ? previewBaseFor(', 'const base = true ? previewBaseFor('],
  ['preview: older guide dropped', V, 'canon, legacy, canonOnlyIds', 'canon, legacy: undefined, canonOnlyIds'],
  ['preview: canon-only ids empty', V, 'canonOnlyIds: CANON_ONLY_THEME_PRESET_IDS,', 'canonOnlyIds: [],'],
  ['preview: fallback changed', V, 'fallback: PREVIEW_PALETTES.corporate_light }) :', 'fallback: PREVIEW_PALETTES.minimal! }) :'],
  ['preview: legacy lookup changed', V, "const legacy = (isCanonicalThemePresetId(id) && PREVIEW_PALETTES[id]) || undefined", 'const legacy = undefined'],
  ['preview: swatches ignore the map', V, 'const palette = themePreviewPalette(selection, canon)\n  return <span', 'const palette = themePreviewPalette(selection)\n  return <span'],
  ['preview: specimen ignores the map', V, 'const palette = themePreviewPalette(selection, canon)\n  const style', 'const palette = themePreviewPalette(selection)\n  const style'],
  ['preview: the map reaches the DOM', V, 'return <div className={`sl-theme-slide sl-theme-${specimen}`} style={style}', 'return <div className={`sl-theme-slide sl-theme-${specimen}`} data-canon={JSON.stringify(canon)} style={style}'],
  ['preview: an env read added', V, 'export type CanonPreviewPalettes', 'const read = process.env.NEXT_PUBLIC_X\nexport type CanonPreviewPalettes'],
  ['hook: flag ignored', H, 'return STUDIO_THEME_PREVIEW_CANON_ENABLED ? palettes : undefined', 'return palettes'],
  ['hook: reads when off', H, 'if (!STUDIO_THEME_PREVIEW_CANON_ENABLED) return\n    let baseUrl', 'let baseUrl'],
  ['hook: one preset only', H, 'loadPresetSwatchPalettes(baseUrl, PRESET_IDS)', 'loadPresetSwatchPalettes(baseUrl, PRESET_IDS.slice(0, 1))'],
  ['hook: only the picker\'s ids', H, '[...new Set([...CANONICAL_THEME_PRESET_IDS, ...CANON_ONLY_THEME_PRESET_IDS])]', '[...CANONICAL_THEME_PRESET_IDS]'],
  ['hook: answer ignored', H, 'if (!cancelled) setPalettes(loaded)', 'if (!cancelled) setPalettes({})'],
  ['hook: a write added', H, 'let cancelled = false', "void fetch('/api/themes', { method: 'POST' })\n    let cancelled = false"],
  ['hook: an unconfigured URL still reads', H, '    } catch {\n      return\n    }\n    let cancelled', '    } catch {\n      baseUrl = TB_FALLBACK\n    }\n    let cancelled'],
  ['workspace: map not passed to the specimen', W, "name={mode === 'create' ? name : selected?.name || ''} {...canonProp} />", "name={mode === 'create' ? name : selected?.name || ''} />"],
  ['workspace: map not passed to the swatches', W, '<ThemeSwatches selection={theme.theme_payload} {...canonProp} />', '<ThemeSwatches selection={theme.theme_payload} />'],
  ['workspace: placeholders ignore the map', W, 'const palette = themePreviewPalette(draft, canon)', 'const palette = themePreviewPalette(draft)'],
  ['workspace: an undefined key without the map', W, 'const canonProp = canon ? { canon } : {}', 'const canonProp = { canon }'],
  ['workspace: hook result dropped', W, 'const canon = useCanonPreviewPalettes()', 'const canon = undefined as undefined | Record<string, never>'],
]
let caught = 0
const survivors = []
for (const [label, file, from, to] of MUTANTS) {
  const original = read(file)
  if (original.split(from).length - 1 < 1) { survivors.push(`${label} (text not found)`); continue }
  const overrides = { [file]: original.replace(from, () => to) }
  let failed = false
  try { pureSuite(overrides); previewSuite(overrides); await hookSuite(overrides); await workspaceSuite(overrides) } catch { failed = true }
  if (failed) caught++
  else survivors.push(label)
}
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join('; ')}`)
console.log(`studio-theme-preview-canon: ${checks} checks passed, ${caught}/${MUTANTS.length} mutants caught`)
