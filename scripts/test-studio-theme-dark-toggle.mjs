// P2C: Light or Dark for a deck, chosen before the build; a built deck only STAGES "Rebuild in dark / light"
// (flag NEXT_PUBLIC_THEME_DARK_MODE_ENABLED, exact "true", default off).
//
// Offline and self-contained: no network, no git, no browser. It runs the REAL sources: lib/studio-theme-dark-toggle.ts (import-free, loaded alone)
// and components/theme-panel.tsx with components/theme-deck-mode-control.tsx (transpiled and evaluated in a vm with a small hooks runtime, as
// test-studio-theme-picker-v2.mjs does).
//   pure   the helper: flag, default Light, payload shape on / off, custom default, select choices, existing-deck label / note / staging.
//   panel  the real panel: flag off is the base (hashes of the whole rendered tree and of the Apply payloads, captured from the base sources);
//          flag on: the control for preset and custom, the payload each choice sends, and the built-deck action that stages and sends nothing.
//   pins   where the choice goes (the build message and the existing set_theme frame, untouched), that the staged mode lives only in the panel and
//          never reaches the wire, that the page, viewer, presentation area and socket hook are untouched, Themes & brand shares the helper, and the
//          flag is documented.
// Then every suite is re-run against deliberately broken copies of the sources: each mutant must be caught.
//
// Run: node scripts/test-studio-theme-dark-toggle.mjs
//   P2C_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-theme-dark-toggle.mjs   re-prints the flag-off hashes from the base sources.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = process.env.P2C_ROOT
  ? path.resolve(process.env.P2C_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const FLAG = 'NEXT_PUBLIC_THEME_DARK_MODE_ENABLED'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const PICKER = 'NEXT_PUBLIC_STUDIO_THEME_PICKER_V2'
const DROPDOWN = 'NEXT_PUBLIC_STUDIO_THEME_DROPDOWN'
const FILES = {
  lib: 'lib/studio-theme-dark-toggle.ts',
  panel: 'components/theme-panel.tsx',
  control: 'components/theme-deck-mode-control.tsx',
  workspace: 'components/studio-libraries/themes-workspace.tsx',
  page: 'app/builder/page.tsx',
  area: 'components/builder/presentation-area.tsx',
  viewer: 'components/presentation-viewer.tsx',
  hook: 'hooks/use-deckster-websocket-v2.ts',
}
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
// Like JSON, but a key whose value is undefined stays visible, and functions are marked, so a changed key set cannot hide.
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)

// Values built inside the vm have that realm's prototypes; compare them by their JSON.
const deepEqual = (actual, expected, message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual ?? null)), JSON.parse(JSON.stringify(expected ?? null)), message)

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---------------------------------------------------------------- loader: transpile repo files, evaluate in a vm
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
/** `overrides`: repo-relative path -> source text (a mutant); `stubs`: import specifier as written -> module object. Any other bare import is an error. */
function createWorld({ env = {}, stubs = {}, overrides = {}, globals = {} } = {}) {
  const cache = new Map()
  const exists = rel => rel in overrides || (fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile())
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['.ts', '.tsx']) if (exists(base + ext)) return base + ext
    throw new Error(`unresolved import ${spec} in ${fromRel}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const source = rel in overrides ? overrides[rel] : read(rel)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      throw new Error(`unexpected import ${spec} in ${rel}`)
    }
    vm.runInNewContext(compile(rel, source), { module, exports: module.exports, process: { env }, console, require, ...globals })
    return module.exports
  }
  return { load }
}

// ---------------------------------------------------------------- a small hooks runtime: stateful root component, inert children
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
const icons = new Proxy({}, { get: (_, name) => `Icon:${String(name)}` })

function mountPanel(env, overrides = {}) {
  const runtime = createRuntime()
  const stubs = {
    react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, 'next/link': { default: 'Link' },
    '@/components/ui/button': { Button: 'Button' }, '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9' },
    '@/lib/utils': { cn: (...values) => values.flat(Infinity).filter(Boolean).join(' ') },
  }
  const { ThemePanel } = createWorld({ env, stubs, overrides, globals: { fetch: async () => ({ ok: false, json: async () => ({}) }) } }).load(FILES.panel)
  return {
    runtime,
    // No effect of the panel is asynchronous without the canon flag (the only one that fetches), so a render settles in one go.
    async render(props) { return runtime.render(ThemePanel, props) },
  }
}

// ---------------------------------------------------------------- the matrix the flag-off proof runs over
const SYNC = {
  idle: { status: 'idle', requestId: null, presentationId: null, themeFingerprint: null, error: null },
  failed: { status: 'failed', requestId: 'r1', presentationId: 'deck-1', themeFingerprint: 'fp', error: 'The theme could not be applied.' },
}
const SELECTIONS = [
  { mode: 'auto' },
  { mode: 'preset', preset_id: 'corporate_light' },
  { mode: 'preset', preset_id: 'corporate_dark' },
  { mode: 'preset', preset_id: 'vibrant', color_overrides: { accent: '#123456' } },
  { mode: 'preset', preset_id: 'minimal', palette_mode: 'dark' },
  { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b' },
  { mode: 'custom', primary_hex: '#1e40af', palette_mode: 'both', harmony_preference: 'triadic' },
  { mode: 'custom', primary_hex: '#0a7d4f', palette_mode: 'dark' },
]
const ENVS = {
  'plain': {},
  'shell': { [SHELL]: 'true' },
  'shell+picker': { [SHELL]: 'true', [PICKER]: 'true' },
  'shell+dropdown': { [SHELL]: 'true', [PICKER]: 'true', [DROPDOWN]: 'true' },
}
const baseProps = (over = {}) => ({ isOpen: true, onClose() {}, presentationId: 'deck-1', buildThemeSelection: { mode: 'auto' }, themeSync: SYNC.idle, selectionLocked: false, onBuildThemeChange() {}, ...over })

async function renderHash(env, overrides = {}) {
  const hashes = []
  for (const selection of SELECTIONS) {
    for (const locked of [false, true]) {
      for (const status of Object.keys(SYNC)) {
        const tree = await mountPanel(env, overrides).render(baseProps({ buildThemeSelection: selection, themeSync: SYNC[status], selectionLocked: locked }))
        hashes.push(sha(ser(tree)))
      }
    }
  }
  hashes.push(sha(ser(await mountPanel(env, overrides).render(baseProps({ isOpen: false })))))
  return sha(hashes.join('\n'))
}

const buttons = tree => flat(tree).filter(node => node.type === 'button' || node.type === 'Button')
const byText = (tree, prefix) => buttons(tree).find(node => text(node).trim().startsWith(prefix))
const paletteButton = (tree, value) => flat(tree).find(node => node.type === 'button' && node.props['data-studio-theme-palette'] === value)
const rebuildButton = tree => flat(tree).find(node => node.type === 'button' && node.props['data-studio-theme-palette-rebuild'] !== undefined)
const controlRoot = tree => flat(tree).find(node => node.props?.['data-studio-theme-part'] === 'palette-mode')
const applyButton = tree => buttons(tree).find(node => /^(Apply theme|Apply through Director)/.test(text(node).trim()))

/** The Apply payloads of a fixed set of interactions: pick a preset, build a custom palette, pick Auto (picker), build a custom palette (plain). */
async function applyPayloads(env, overrides = {}) {
  const out = []
  const run = async (selection, steps, apply) => {
    const sent = []
    const panel = mountPanel(env, overrides)
    const props = baseProps({ buildThemeSelection: selection, onBuildThemeChange: next => sent.push(next) })
    let tree = await panel.render(props)
    for (const step of steps) { step(tree)?.props.onClick(); tree = await panel.render(props) }
    applyButton(tree).props.onClick()
    out.push(ser(sent))
  }
  const picker = env[PICKER] === 'true' || env[DROPDOWN] === 'true'
  if (picker) {
    await run({ mode: 'auto' }, [tree => flat(tree).find(node => node.props?.['data-studio-theme-preset'] === 'vibrant')], true)
    await run({ mode: 'preset', preset_id: 'minimal' }, [tree => byText(tree, 'Build a custom palette')], true)
    await run({ mode: 'preset', preset_id: 'minimal' }, [tree => flat(tree).find(node => node.props?.['data-studio-theme-preset'] === 'auto')], true)
  } else {
    await run({ mode: 'auto' }, [tree => flat(tree).find(node => node.type === 'button' && text(node).includes('Vibrant'))], true)
    await run({ mode: 'preset', preset_id: 'minimal' }, [tree => byText(tree, 'Build custom')], true)
    await run({ mode: 'preset', preset_id: 'minimal' }, [tree => byText(tree, 'Auto / session default')], true)
  }
  return sha(out.join('\n'))
}

if (process.env.PRINT_GOLDEN) {
  const out = { render: {}, apply: {} }
  for (const [name, env] of Object.entries(ENVS)) { out.render[name] = await renderHash(env); out.apply[name] = await applyPayloads(env) }
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

// Captured from the base sources (origin/studio-v4-dev-preparation-code at 00921c0, before this change) with the flag unset.
const BASE_RENDER = {
  'plain': '429c9bec6a82e95fbbc38cb6290761f9d9f33f0f4e3925b919f05f2617766967',
  'shell': '6573c93beee533405ff0beb46a94414f4e2d2f21e01d4ddf7894b9b24cc5f60c',
  'shell+picker': 'cc83373f0fb4312ac0a577778b6168e86a4638e68411ec11a478b2fa3a912179',
  'shell+dropdown': '4e43665e922d6f09ff69d7030dc9e87e9ef5709e19418980fbd9b3915c4cb3cb',
}
const BASE_APPLY = {
  'plain': '0177dbfce9546de283e976a832a8421d24e633f480a970a76530ade071fe1385',
  'shell': '0177dbfce9546de283e976a832a8421d24e633f480a970a76530ade071fe1385',
  'shell+picker': '0177dbfce9546de283e976a832a8421d24e633f480a970a76530ade071fe1385',
  'shell+dropdown': '8b9f57839f6897f15675c50d4467dba84cd244c0dd0b47f8e32913bb8288e65c',
}

// ---------------------------------------------------------------- the pure helper
function pureSuite(overrides = {}) {
  const load = () => createWorld({ overrides }).load(FILES.lib)
  const lib = load()
  const OFF = false, ON = true

  // import-free: it loads with no stubs at all, and its source has no import or require
  const code = (overrides[FILES.lib] ?? read(FILES.lib)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  check(assert.doesNotMatch, code, /^\s*import\b|\brequire\s*\(|\bprocess\b/m, 'the helper is import-free and reads no env itself')

  // the flag: the exact string "true"
  for (const [raw, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['yes', false], ['on', false], ['true', true]])
    check(assert.equal, lib.themeDarkModeEnabled(raw), expected, `flag ${JSON.stringify(raw)}`)

  // the default is Light: absent, light, both and junk all read as Light; only dark reads as Dark; the control never offers "both"
  for (const selection of [undefined, null, {}, { palette_mode: undefined }, { palette_mode: 'light' }, { palette_mode: 'both' }, { palette_mode: 'DARK' }, { palette_mode: 7 }, { mode: 'custom' }])
    check(assert.equal, lib.paletteModeOf(selection), 'light', `reads as light: ${JSON.stringify(selection)}`)
  check(assert.equal, lib.paletteModeOf({ palette_mode: 'dark' }), 'dark')
  check(assert.equal, lib.otherPaletteMode('light'), 'dark')
  check(assert.equal, lib.otherPaletteMode('dark'), 'light')
  check(assert.equal, lib.paletteModeLabel('light'), 'Light')
  check(assert.equal, lib.paletteModeLabel('dark'), 'Dark')

  // payload shape on: the chosen mode is written, every other key is carried, the input is not mutated, nothing but light / dark is ever written
  const preset = { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#123456' }, font_family: 'Lato' }
  const dark = lib.withPaletteMode(preset, 'dark', ON)
  check(deepEqual, dark, { ...preset, palette_mode: 'dark' })
  check(assert.equal, JSON.stringify(dark), '{"mode":"preset","preset_id":"minimal","color_overrides":{"accent":"#123456"},"font_family":"Lato","palette_mode":"dark"}', 'frame JSON: dark, preset')
  check(assert.equal, JSON.stringify(lib.withPaletteMode(preset, 'light', ON)), '{"mode":"preset","preset_id":"minimal","color_overrides":{"accent":"#123456"},"font_family":"Lato","palette_mode":"light"}', 'frame JSON: light, preset')
  check(assert.equal, 'palette_mode' in preset, false, 'the input is not mutated')
  check(assert.equal, lib.withPaletteMode({ mode: 'custom', primary_hex: '#1e40af', palette_mode: 'both' }, 'dark', ON).palette_mode, 'dark', 'dark replaces both')
  check(assert.equal, lib.withPaletteMode({ mode: 'custom', primary_hex: '#1e40af', palette_mode: 'dark' }, 'light', ON).palette_mode, 'light', 'light replaces dark')
  check(assert.equal, JSON.stringify(lib.withPaletteMode({ mode: 'custom', primary_hex: '#1e40af', palette_mode: 'both', harmony_preference: 'auto' }, 'dark', ON)), '{"mode":"custom","primary_hex":"#1e40af","palette_mode":"dark","harmony_preference":"auto"}', 'frame JSON: dark, custom (key order kept)')
  for (const junk of ['both', 'BOTH', '', undefined, null, 'neon'])
    check(assert.equal, lib.withPaletteMode({ mode: 'auto' }, junk, ON).palette_mode, 'light', `a mode that is not "dark" is written as light: ${String(junk)}`)
  // payload shape off: the very same object comes back, for every mode
  for (const mode of ['light', 'dark', 'both']) check(assert.equal, lib.withPaletteMode(preset, mode, OFF), preset, `flag off: same object (${mode})`)
  check(assert.equal, 'palette_mode' in lib.withPaletteMode(preset, 'dark', OFF), false, 'flag off: no palette_mode key appears')

  // a custom palette starts at today's value, or "both"; flag on: at the chosen mode, never "both"
  for (const [selection, off, on] of [
    [{}, 'both', 'light'], [{ palette_mode: 'light' }, 'light', 'light'], [{ palette_mode: 'dark' }, 'dark', 'dark'], [{ palette_mode: 'both' }, 'both', 'light'],
  ]) {
    check(assert.equal, lib.customEntryPaletteMode(selection, OFF), off, `flag off: ${JSON.stringify(selection)}`)
    check(assert.equal, lib.customEntryPaletteMode(selection, ON), on, `flag on: ${JSON.stringify(selection)}`)
  }

  // Themes & brand select: Light, Dark, Both today; Light and Dark with the flag on; the shown value follows
  check(deepEqual, lib.paletteModeChoices(OFF), [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'both', label: 'Both' }])
  check(deepEqual, lib.paletteModeChoices(ON), [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }])
  for (const [selection, off, on] of [[{}, 'both', 'light'], [{ palette_mode: 'light' }, 'light', 'light'], [{ palette_mode: 'dark' }, 'dark', 'dark'], [{ palette_mode: 'both' }, 'both', 'light']]) {
    check(assert.equal, lib.paletteModeSelectValue(selection, OFF), off, `select, flag off: ${JSON.stringify(selection)}`)
    check(assert.equal, lib.paletteModeSelectValue(selection, ON), on, `select, flag on: ${JSON.stringify(selection)}`)
    check(assert.ok, lib.paletteModeChoices(ON).some(choice => choice.value === lib.paletteModeSelectValue(selection, ON)), 'the shown value is always one of the offered choices')
  }

  // an existing deck: the action names the OPPOSITE mode, the note says nothing happens now, a second click undoes the staging
  check(assert.equal, lib.existingDeckActionLabel('light'), 'Rebuild in dark')
  check(assert.equal, lib.existingDeckActionLabel('dark'), 'Rebuild in light')
  check(assert.equal, lib.nextStagedMode('light', null), 'dark')
  check(assert.equal, lib.nextStagedMode('dark', null), 'light')
  check(assert.equal, lib.nextStagedMode('light', 'dark'), null, 'click again: unstage')
  check(assert.equal, lib.nextStagedMode('dark', 'light'), null, 'click again: unstage (dark deck)')
  check(assert.equal, lib.nextStagedMode('light', 'light'), 'dark', 'a stale staged value equal to the built mode is not "staged"')
  const notes = [lib.existingDeckNote('light', null), lib.existingDeckNote('light', 'dark'), lib.existingDeckNote('dark', null), lib.existingDeckNote('dark', 'light')]
  for (const note of notes) {
    check(assert.match, note, /Nothing is rebuilt or sent now\./, 'every note says nothing is rebuilt or sent')
    check(assert.doesNotMatch, note, /both/i, 'no "both" anywhere')
  }
  check(assert.match, lib.existingDeckNote('light', null), /^This deck was built in light\./)
  check(assert.match, lib.existingDeckNote('dark', null), /^This deck was built in dark\./)
  check(assert.match, lib.existingDeckNote('light', 'dark'), /^Dark is staged\. It applies the next time this deck is rebuilt\./)
  check(assert.match, lib.existingDeckNote('dark', 'light'), /^Light is staged\./)
  check(assert.doesNotMatch, lib.existingDeckNote('light', 'light'), /staged\./, 'staged equal to the built mode is not shown as staged')
}

// ---------------------------------------------------------------- the real panel
async function panelSuite(overrides = {}, thorough = true) {
  const off = (env, extra = {}) => ({ ...env, ...extra })
  const extras = thorough ? [{}, { [FLAG]: 'false' }, { [FLAG]: '1' }, { [FLAG]: 'TRUE' }, { [FLAG]: 'true ' }, { [FLAG]: '' }] : [{}, { [FLAG]: '1' }]

  // flag off is the base: the whole rendered tree, and the Apply payloads, are what the base sources produce
  for (const [name, env] of Object.entries(ENVS)) {
    for (const extra of extras) {
      check(assert.equal, await renderHash(off(env, extra), overrides), BASE_RENDER[name], `render, flag off ${JSON.stringify(extra)} (${name})`)
    }
    check(assert.equal, await applyPayloads(off(env), overrides), BASE_APPLY[name], `Apply payloads, flag off (${name})`)
    check(assert.equal, await applyPayloads(off(env, { [FLAG]: 'false' }), overrides), BASE_APPLY[name], `Apply payloads, flag "false" (${name})`)
  }
  // flag off: no control, no palette attribute, no Light / Dark text, in any panel state
  for (const [name, env] of Object.entries(ENVS)) {
    for (const locked of [false, true]) {
      const tree = await mountPanel(env, overrides).render(baseProps({ selectionLocked: locked }))
      check(assert.equal, controlRoot(tree), undefined, `flag off: no control (${name}, locked=${locked})`)
      check(assert.doesNotMatch, text(tree), /Deck mode|Rebuild in|staged/i, `flag off: no new words (${name})`)
    }
  }

  // flag on, each panel
  const ON = { [FLAG]: 'true' }
  const PANELS = { 'plain panel': ON, 'studio panel': { ...ON, [SHELL]: 'true' }, 'picker': { ...ON, [SHELL]: 'true', [PICKER]: 'true' }, 'dropdown picker': { ...ON, [SHELL]: 'true', [PICKER]: 'true', [DROPDOWN]: 'true' } }
  for (const [name, env] of Object.entries(PANELS)) {
    const picker = env[PICKER] === 'true'
    // before the build: Light is the default, the control is a Light | Dark segment, and it never offers "both"
    {
      const panel = mountPanel(env, overrides)
      const sent = []
      const props = baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal' }, onBuildThemeChange: next => sent.push(next) })
      let tree = await panel.render(props)
      const root = controlRoot(tree)
      check(assert.ok, root, `${name}: the control is there`)
      check(assert.equal, root.props['data-studio-theme-palette-state'], 'draft')
      check(deepEqual, flat(root).filter(node => node.type === 'button').map(node => text(node)), ['Light', 'Dark'], `${name}: exactly Light and Dark`)
      check(assert.doesNotMatch, text(root), /both/i, `${name}: no "both"`)
      check(assert.equal, paletteButton(tree, 'light').props['aria-pressed'], true, `${name}: default Light`)
      check(assert.equal, paletteButton(tree, 'dark').props['aria-pressed'], false)
      check(assert.equal, flat(root).find(node => node.props?.role === 'group').props['aria-label'], 'Deck mode')
      check(assert.equal, rebuildButton(tree), undefined, `${name}: no rebuild action before the build`)
      check(assert.equal, applyButton(tree).props.disabled, true, `${name}: nothing to apply yet`)
      if (picker) {
        const kids = flat(tree).filter(node => node.props?.className === 'stpv2-current' || node.props?.['data-studio-theme-part'] === 'palette-mode' || node.props?.['data-studio-theme-part'] === 'body')
        check(deepEqual, kids.map(node => node.props.className === 'stpv2-current' ? 'current' : node.props['data-studio-theme-part']), ['current', 'palette-mode', 'body'], `${name}: under the current-theme row, above the body`)
      }
      // Dark on a preset: it becomes the draft, Apply sends it, once, with every other key kept
      paletteButton(tree, 'dark').props.onClick()
      tree = await panel.render(props)
      check(assert.equal, paletteButton(tree, 'dark').props['aria-pressed'], true, `${name}: Dark pressed`)
      check(assert.equal, paletteButton(tree, 'light').props['aria-pressed'], false)
      check(assert.equal, sent.length, 0, `${name}: picking a mode sends nothing until Apply`)
      check(assert.equal, applyButton(tree).props.disabled, false, `${name}: a mode change is an applicable change`)
      applyButton(tree).props.onClick()
      check(assert.equal, sent.length, 1)
      check(assert.equal, ser(sent[0]), '{"mode":"preset","preset_id":"minimal","color_overrides":"__undefined__","palette_mode":"dark"}', `${name}: preset + dark payload`)
      check(assert.equal, JSON.stringify(sent[0]), '{"mode":"preset","preset_id":"minimal","palette_mode":"dark"}', `${name}: preset + dark frame JSON`)
      // and back to Light: explicit light, not an absent key
      sent.length = 0
      paletteButton(await panel.render(props), 'light').props.onClick()
      tree = await panel.render(props)
      check(assert.equal, paletteButton(tree, 'light').props['aria-pressed'], true)
      applyButton(tree).props.onClick()
      check(assert.equal, JSON.stringify(sent[0]), '{"mode":"preset","preset_id":"minimal","palette_mode":"light"}', `${name}: Light is sent as an explicit light, not an absent key`)
    }
    // custom: entering a custom palette starts at Light (not "both"); a mode picked first is kept; the payload carries palette_mode
    {
      const enterCustom = tree => picker ? byText(tree, 'Build a custom palette') : byText(tree, 'Build custom')
      const sent = []
      const props = baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal' }, onBuildThemeChange: next => sent.push(next) })
      const panel = mountPanel(env, overrides)
      let tree = await panel.render(props)
      enterCustom(tree).props.onClick()
      tree = await panel.render(props)
      check(assert.equal, paletteButton(tree, 'light').props['aria-pressed'], true, `${name}: a new custom palette starts at Light`)
      applyButton(tree).props.onClick()
      check(assert.equal, sent[0].mode, 'custom')
      check(assert.equal, sent[0].palette_mode, 'light', `${name}: custom default is light, not both`)
      sent.length = 0
      paletteButton(tree, 'dark').props.onClick()
      tree = await panel.render(props)
      check(assert.equal, paletteButton(tree, 'dark').props['aria-pressed'], true, `${name}: custom + Dark`)
      applyButton(tree).props.onClick()
      check(assert.equal, sent[0].palette_mode, 'dark', `${name}: custom + dark payload`)
      check(assert.equal, sent[0].mode, 'custom')
      check(assert.ok, 'primary_hex' in sent[0], 'the custom colours ride along')
      // Dark picked on a preset first, then Build custom: the mode is kept
      const sent2 = []
      const props2 = baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal' }, onBuildThemeChange: next => sent2.push(next) })
      const panel2 = mountPanel(env, overrides)
      let tree2 = await panel2.render(props2)
      paletteButton(tree2, 'dark').props.onClick()
      tree2 = await panel2.render(props2)
      enterCustom(tree2).props.onClick()
      tree2 = await panel2.render(props2)
      check(assert.equal, paletteButton(tree2, 'dark').props['aria-pressed'], true, `${name}: Dark survives entering a custom palette`)
      applyButton(tree2).props.onClick()
      check(assert.equal, sent2[0].palette_mode, 'dark')
      // an applied selection that stored "both" reads as Light, and is sent unchanged until a mode is picked
      const stored = { mode: 'custom', primary_hex: '#1e40af', palette_mode: 'both' }
      const tree3 = await mountPanel(env, overrides).render(baseProps({ buildThemeSelection: stored }))
      check(assert.equal, paletteButton(tree3, 'light').props['aria-pressed'], true, `${name}: a stored "both" reads as Light`)
      check(assert.equal, applyButton(tree3).props.disabled, true, `${name}: and is not a pending change by itself`)
      // an applied Dark shows as Dark, and a preset switch keeps it
      const sent4 = []
      const props4 = baseProps({ buildThemeSelection: { mode: 'preset', preset_id: 'minimal', palette_mode: 'dark' }, onBuildThemeChange: next => sent4.push(next) })
      const panel4 = mountPanel(env, overrides)
      let tree4 = await panel4.render(props4)
      check(assert.equal, paletteButton(tree4, 'dark').props['aria-pressed'], true, `${name}: an applied Dark shows as Dark`)
      const vibrant = flat(tree4).find(node => node.type === 'button' && (node.props['data-studio-theme-preset'] === 'vibrant' || text(node).includes('Vibrant')))
      if (vibrant) { // the dropdown has no preset buttons; its picks run through the same selectPreset
        vibrant.props.onClick()
        tree4 = await panel4.render(props4)
        applyButton(tree4).props.onClick()
        check(assert.equal, sent4[0].palette_mode, 'dark', `${name}: switching the preset keeps Dark`)
        check(assert.equal, sent4[0].preset_id, 'vibrant')
      }
    }
    // a built deck: the labelled action stages and sends nothing; no Light | Dark segment is offered
    for (const [builtMode, selection, label, target] of [
      ['light', { mode: 'preset', preset_id: 'minimal' }, 'Rebuild in dark', 'dark'],
      ['light', { mode: 'custom', primary_hex: '#1e40af', palette_mode: 'both' }, 'Rebuild in dark', 'dark'],
      ['dark', { mode: 'preset', preset_id: 'minimal', palette_mode: 'dark' }, 'Rebuild in light', 'light'],
    ]) {
      const sent = []
      const props = baseProps({ buildThemeSelection: selection, selectionLocked: true, onBuildThemeChange: next => sent.push(next) })
      const panel = mountPanel(env, overrides)
      let tree = await panel.render(props)
      const root = controlRoot(tree)
      const targetWord = target === 'dark' ? 'Dark' : 'Light'
      check(assert.ok, root, `${name}: the control is there on a built deck`)
      check(assert.equal, root.props['data-studio-theme-palette-state'], 'built')
      check(assert.equal, text(rebuildButton(tree)).trim(), label, `${name}: ${builtMode} deck: ${label}`)
      check(assert.equal, rebuildButton(tree).props['aria-pressed'], false)
      check(assert.equal, paletteButton(tree, 'light'), undefined, `${name}: no Light | Dark segment on a built deck`)
      check(assert.match, text(root), new RegExp(`This deck was built in ${builtMode}\\.`))
      check(assert.match, text(root), /Nothing is rebuilt or sent now\./)
      check(assert.equal, text(flat(root).find(node => node.props?.role === 'status')).includes('Nothing is rebuilt or sent now.'), true, `${name}: the note is a live status`)
      // the click stages it: pressed, the note names it, and nothing goes to the build
      rebuildButton(tree).props.onClick()
      check(deepEqual, sent, [], `${name}: the click sends nothing to the build`)
      tree = await panel.render(props)
      check(assert.equal, rebuildButton(tree).props['aria-pressed'], true, `${name}: staged shows pressed`)
      check(assert.match, text(controlRoot(tree)), new RegExp(`${targetWord} is staged\\. It applies the next time this deck is rebuilt\\. Nothing is rebuilt or sent now\\.`))
      check(deepEqual, sent, [], `${name}: nothing is sent to the build`)
      check(assert.equal, text(rebuildButton(tree)).trim(), label, `${name}: the action keeps its label`)
      // it belongs to this deck: another deck shows none, this one shows it again
      const other = await panel.render({ ...props, presentationId: 'deck-2' })
      check(assert.equal, rebuildButton(other).props['aria-pressed'], false, `${name}: another deck is not staged`)
      check(assert.match, text(controlRoot(other)), /^.*This deck was built in/)
      const back = await panel.render(props)
      check(assert.equal, rebuildButton(back).props['aria-pressed'], true, `${name}: the first deck is still staged`)
      // a second click un-stages
      rebuildButton(back).props.onClick()
      tree = await panel.render(props)
      check(assert.equal, rebuildButton(tree).props['aria-pressed'], false, `${name}: a second click un-stages`)
      check(assert.match, text(controlRoot(tree)), new RegExp(`This deck was built in ${builtMode}\\.`))
      check(deepEqual, sent, [], `${name}: still nothing sent`)
      // the lock rule is untouched: no Apply is offered, and the theme itself is still locked
      check(assert.ok, !applyButton(tree) || applyButton(tree).props.disabled === true, `${name}: Apply is not offered on a built deck`)
      check(assert.equal, paletteButton(tree, 'dark'), undefined)
    }
    // closed: nothing
    check(assert.equal, await mountPanel(env, overrides).render(baseProps({ isOpen: false })), null)
  }
}

// ---------------------------------------------------------------- where the choice goes (source pins)
function pinSuite(sources = {}) {
  const src = key => sources[key] ?? read(FILES[key])
  const env = sources.env ?? read('.env.example')
  const pkg = sources.pkg ?? read('package.json')
  const page = src('page'), area = src('area'), viewer = src('viewer'), hook = src('hook'), workspace = src('workspace'), panel = src('panel')

  // the existing set_theme frame is untouched, and the page hands it the selection as is
  check(assert.match, hook, /data: \{ request_id: requestId, theme, presentation_id: presentationId \},/, 'set_theme: the theme is sent as given')
  check(assert.doesNotMatch, hook, /palette_mode|stagedPaletteMode|THEME_DARK_MODE/, 'the socket hook knows nothing of the mode')
  check(assert.match, page, /sendThemeSelection\(target\.selection, requestId, targetPresentationId\)/, 'the deck-theme sync sends the selection as is')
  check(assert.match, page, /theme: buildThemeSelection,\n/, 'the build message carries the selection')
  check(assert.equal, [...page.matchAll(/palette_mode/g)].length, 7, 'the page only reads the stored mode back and compares selections, as the base did (7 mentions)')

  // the page, the viewer, the presentation area and the socket hook know nothing of this feature: the staged mode lives only in the panel
  for (const [name, source] of [['page', page], ['viewer', viewer], ['presentation area', area], ['socket hook', hook]])
    check(assert.doesNotMatch, source, /stagedPaletteMode|StagedPaletteMode|THEME_DARK_MODE|studio-theme-dark-toggle|DeckPaletteMode/, `${name} is untouched`)
  for (const send of ['handleBuildThemeChange', 'buildSendOptions', 'requestThemeSyncForPresentation']) {
    const at = page.indexOf(`const ${send} =`)
    check(assert.ok, at > 0, send)
    const body = page.slice(at, page.indexOf('\n  const ', at + 10))
    check(assert.doesNotMatch, body, /staged/i, `${send} does not read the staged mode`)
  }

  // the panel: the lock rule and the Apply path are what they were; staging never goes through onBuildThemeChange
  check(assert.match, panel, /const \[staged, setStaged\] = useState<\{ deckKey: string; mode: DeckPaletteMode \} \| null>\(null\)/, 'the staged mode is panel state')
  check(assert.match, panel, /const stagedMode = staged && staged\.deckKey === deckKey \? staged\.mode : null/, 'scoped to the deck it was chosen on')
  check(assert.match, panel, /onStage=\{next => setStaged\(next \? \{ deckKey, mode: next \} : null\)\}/, 'staging goes to the panel state, not to the build')
  check(assert.match, panel, /import \{ DeckModeControl \} from '\.\/theme-deck-mode-control'/, 'the control is its own file')
  check(assert.match, panel, /const THEME_DARK_MODE = themeDarkModeEnabled\(process\.env\.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED\)/, 'the panel reads the flag as the exact string "true"')
  check(assert.match, panel, /palette_mode: customEntryPaletteMode\(draft, THEME_DARK_MODE\),/)
  check(assert.match, panel, /onChange=\{next => updateDraft\(withPaletteMode\(draft, next, THEME_DARK_MODE\)\)\}/, 'a mode pick edits the draft like any other control')
  check(assert.equal, [...panel.matchAll(/onBuildThemeChange\(/g)].length, 1, 'the panel sends through onBuildThemeChange in exactly one place (Apply)')
  check(assert.match, panel, /const applyTheme = \(\) => \{\n    if \(selectionLocked \|\| !canApply \|\| !onBuildThemeChange\) return/, 'Apply is still refused on a built deck')

  // Themes & brand shares the helper (one source of truth for the choices)
  check(assert.match, workspace, /import \{ customEntryPaletteMode, paletteModeChoices, paletteModeSelectValue, themeDarkModeEnabled \} from '@\/lib\/studio-theme-dark-toggle'/)
  check(assert.match, workspace, /const THEME_DARK_MODE = themeDarkModeEnabled\(process\.env\.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED\)/)
  check(assert.match, workspace, /palette_mode: customEntryPaletteMode\(draft, THEME_DARK_MODE\) \}\)\}>Custom palette<\/button>/)
  check(assert.match, workspace, /<select value=\{paletteModeSelectValue\(draft, THEME_DARK_MODE\)\} onChange=\{event => patchDraft\(\{ \.\.\.draft, palette_mode: event\.target\.value as BuildThemeSelection\['palette_mode'\] \}\)\}>\{paletteModeChoices\(THEME_DARK_MODE\)\.map\(choice => <option key=\{choice\.value\} value=\{choice\.value\}>\{choice\.label\}<\/option>\)\}<\/select>/)
  check(assert.doesNotMatch, workspace, /<option value="both">/, 'no hard-coded "Both" option')

  // documented, default off, and registered
  check(assert.match, env, /^NEXT_PUBLIC_THEME_DARK_MODE_ENABLED="false"$/m, '.env.example documents the flag, default "false"')
  check(assert.equal, JSON.parse(pkg).scripts['test:studio-theme-dark-toggle'], 'node scripts/test-studio-theme-dark-toggle.mjs', 'registered')
}

async function fullSuite(overrides = {}, suites = ['pure', 'panel', 'pins'], pinSources = {}, thorough = true) {
  if (suites.includes('pure')) pureSuite(overrides)
  if (suites.includes('panel')) await panelSuite(overrides, thorough)
  if (suites.includes('pins')) pinSuite(pinSources)
}

await fullSuite()

// ---------------------------------------------------------------- mutation check: every mutant must be caught
// [name, file key, from, to, suites to run]
const mutants = [
  // the flag
  ['flag: any value enables', 'lib', "return raw === 'true'", "return raw !== 'false'", ['pure', 'panel']],
  ['flag: on by default', 'lib', "return raw === 'true'", 'return raw !== "never"', ['pure', 'panel']],
  ['panel: the flag is always on', 'panel', 'const THEME_DARK_MODE = themeDarkModeEnabled(process.env.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED)', 'const THEME_DARK_MODE = true', ['panel', 'pins']],
  ['panel: the flag is never on', 'panel', 'const THEME_DARK_MODE = themeDarkModeEnabled(process.env.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED)', 'const THEME_DARK_MODE = false', ['panel']],
  ['panel: reads another env name', 'panel', 'process.env.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED', 'process.env.NEXT_PUBLIC_THEME_DARK_ENABLED', ['panel', 'pins']],
  // the default and the reading of a selection
  ['default: absent reads as Dark', 'lib', "selection?.palette_mode === 'dark' ? 'dark' : 'light'", "selection?.palette_mode === 'light' ? 'light' : 'dark'", ['pure', 'panel']],
  ['default: "both" reads as Dark', 'lib', "selection?.palette_mode === 'dark' ? 'dark' : 'light'", "selection?.palette_mode === 'dark' || selection?.palette_mode === 'both' ? 'dark' : 'light'", ['pure', 'panel']],
  ['default: Dark never reads as Dark', 'lib', "selection?.palette_mode === 'dark' ? 'dark' : 'light'", "'light'", ['pure', 'panel']],
  ['default: a null selection throws', 'lib', 'selection?.palette_mode', 'selection.palette_mode', ['pure']],
  ['opposite: not swapped', 'lib', "return mode === 'dark' ? 'light' : 'dark'", "return mode === 'dark' ? 'dark' : 'light'", ['pure', 'panel']],
  ['label: Light and Dark swapped', 'lib', "return mode === 'dark' ? 'Dark' : 'Light'", "return mode === 'dark' ? 'Light' : 'Dark'", ['pure', 'panel']],
  // the payload
  ['payload: written with the flag off', 'lib', 'if (!flagOn) return selection\n', '', ['pure']],
  ['payload: the mode is passed through unchecked', 'lib', "palette_mode: mode === 'dark' ? 'dark' : 'light'", 'palette_mode: mode as never', ['pure']],
  ['payload: "both" is written', 'lib', "palette_mode: mode === 'dark' ? 'dark' : 'light'", "palette_mode: mode === 'dark' ? 'dark' : 'both'", ['pure', 'panel']],
  ['payload: the other keys are dropped', 'lib', 'return { ...selection, palette_mode:', 'return { mode: (selection as never as { mode: string }).mode, palette_mode:', ['pure', 'panel']],
  ['payload: the input object is mutated', 'lib', 'return { ...selection, palette_mode: mode === \'dark\' ? \'dark\' : \'light\' }', "(selection as { palette_mode?: string }).palette_mode = mode === 'dark' ? 'dark' : 'light'; return selection", ['pure']],
  ['payload: Dark picked but Light written', 'panel', 'onChange={next => updateDraft(withPaletteMode(draft, next, THEME_DARK_MODE))}', "onChange={() => updateDraft(withPaletteMode(draft, 'light', THEME_DARK_MODE))}", ['panel', 'pins']],
  ['payload: the pick is written with the flag off', 'panel', 'onChange={next => updateDraft(withPaletteMode(draft, next, THEME_DARK_MODE))}', 'onChange={next => updateDraft(withPaletteMode(draft, next, true))}', ['pins']],
  ['payload: a pick is sent at once', 'panel', 'onChange={next => updateDraft(withPaletteMode(draft, next, THEME_DARK_MODE))}', 'onChange={next => { onBuildThemeChange?.(withPaletteMode(draft, next, true)); updateDraft(withPaletteMode(draft, next, THEME_DARK_MODE)) }}', ['panel', 'pins']],
  // custom
  ['custom: starts at "both" with the flag on', 'lib', 'return flagOn ? paletteModeOf(selection) : selection.palette_mode || \'both\'\n}\n\nexport interface PaletteModeChoice', 'return selection.palette_mode || \'both\'\n}\n\nexport interface PaletteModeChoice', ['pure', 'panel']],
  ['custom: flag off no longer starts at "both"', 'lib', "export function customEntryPaletteMode(selection: PaletteModeSelection, flagOn: boolean): 'light' | 'dark' | 'both' {\n  return flagOn ? paletteModeOf(selection) : selection.palette_mode || 'both'", "export function customEntryPaletteMode(selection: PaletteModeSelection, flagOn: boolean): 'light' | 'dark' | 'both' {\n  return paletteModeOf(selection)", ['pure', 'panel']],
  ['custom: the panel ignores the helper', 'panel', 'palette_mode: customEntryPaletteMode(draft, THEME_DARK_MODE),', "palette_mode: draft.palette_mode || 'both',", ['panel', 'pins']],
  ['custom: the mode is lost on entering a custom palette', 'lib', 'return flagOn ? paletteModeOf(selection) : selection.palette_mode ||', "return flagOn ? 'light' : selection.palette_mode ||", ['pure', 'panel']],
  // Themes & brand
  ['choices: "Both" offered with the flag on', 'lib', 'return flagOn ? choices : [...choices, { value: \'both\', label: \'Both\' }]', "return [...choices, { value: 'both', label: 'Both' }]", ['pure']],
  ['choices: "Both" missing with the flag off', 'lib', 'return flagOn ? choices : [...choices, { value: \'both\', label: \'Both\' }]', 'return choices', ['pure']],
  ['choices: Dark first', 'lib', "const choices: PaletteModeChoice[] = [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]", "const choices: PaletteModeChoice[] = [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]", ['pure']],
  ['select value: a stored "both" shown with the flag on', 'lib', 'return flagOn ? paletteModeOf(selection) : selection.palette_mode || \'both\'\n}\n\n/** The action', 'return selection.palette_mode || \'both\'\n}\n\n/** The action', ['pure']],
  ['select value: flag off shows Light for nothing', 'lib', "export function paletteModeSelectValue(selection: PaletteModeSelection, flagOn: boolean): 'light' | 'dark' | 'both' {\n  return flagOn ? paletteModeOf(selection) : selection.palette_mode || 'both'", "export function paletteModeSelectValue(selection: PaletteModeSelection, flagOn: boolean): 'light' | 'dark' | 'both' {\n  return paletteModeOf(selection)", ['pure']],
  ['workspace: keeps the hard-coded Both option', 'workspace', '{paletteModeChoices(THEME_DARK_MODE).map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}', '<option value="light">Light</option><option value="dark">Dark</option><option value="both">Both</option>', ['pins']],
  ['workspace: the select value ignores the helper', 'workspace', 'value={paletteModeSelectValue(draft, THEME_DARK_MODE)}', "value={draft.palette_mode || 'both'}", ['pins']],
  ['workspace: the custom default ignores the helper', 'workspace', 'palette_mode: customEntryPaletteMode(draft, THEME_DARK_MODE) })}>Custom palette</button>', "palette_mode: draft.palette_mode || 'both' })}>Custom palette</button>", ['pins']],
  // the built deck
  ['built: the action names the same mode', 'lib', "return builtMode === 'dark' ? 'Rebuild in light' : 'Rebuild in dark'", "return builtMode === 'dark' ? 'Rebuild in dark' : 'Rebuild in light'", ['pure', 'panel']],
  ['built: the label says Rebuild now', 'lib', "'Rebuild in dark' | 'Rebuild in light' {\n  return builtMode === 'dark' ? 'Rebuild in light' : 'Rebuild in dark'", "'Rebuild in dark' | 'Rebuild in light' {\n  return builtMode === 'dark' ? 'Rebuild in light' : 'Rebuild now'", ['pure', 'panel']],
  ['built: the note drops "nothing is sent"', 'lib', ' Nothing is rebuilt or sent now.`\n  }', '`\n  }', ['pure', 'panel']],
  ['built: the idle note drops "nothing is sent"', 'lib', ' Choosing a rebuild only stages it for the next rebuild. Nothing is rebuilt or sent now.`', ' Choosing a rebuild only stages it for the next rebuild.`', ['pure', 'panel']],
  ['built: the staged note is missing', 'lib', 'if (staged && staged !== builtMode) {', 'if (false) {', ['pure', 'panel']],
  ['built: a second click does not undo', 'lib', 'return staged === target ? null : target', 'return target', ['pure', 'panel']],
  ['built: a click always un-stages', 'lib', 'return staged === target ? null : target', 'return null', ['pure', 'panel']],
  ['built: the click writes the draft instead of staging', 'control', 'onClick={() => onStage(nextStagedMode(mode, staged))}', 'onClick={() => onChange(otherPaletteMode(mode))}', ['panel']],
  ['built: the click is sent to the build', 'panel', 'onStage={next => setStaged(next ? { deckKey, mode: next } : null)}', 'onStage={next => { if (next) onBuildThemeChange?.(withPaletteMode(draft, next, true)) }}', ['panel', 'pins']],
  ['built: staged is not shown', 'panel', 'const stagedMode = staged && staged.deckKey === deckKey ? staged.mode : null', 'const stagedMode = null', ['panel', 'pins']],
  ['built: staged is not scoped to the deck', 'panel', 'const stagedMode = staged && staged.deckKey === deckKey ? staged.mode : null', 'const stagedMode = staged ? staged.mode : null', ['panel', 'pins']],
  ['built: every deck shares one key', 'panel', "const deckKey = presentationId ?? ''", "const deckKey = ''", ['panel']],
  ['built: staging is dropped on the way', 'panel', 'onStage={next => setStaged(next ? { deckKey, mode: next } : null)}', 'onStage={() => undefined}', ['panel', 'pins']],
  ['built: the control is the pre-build segment', 'panel', 'locked={selectionLocked}', 'locked={false}', ['panel']],
  ['built: the deck mode is always light', 'panel', 'mode={paletteModeOf(draft)}', "mode={'light'}", ['panel']],
  ['built: not a live status', 'control', '<p role="status" className={styles.note}>{existingDeckNote(mode, staged)}</p>', '<p className={styles.note}>{existingDeckNote(mode, staged)}</p>', ['panel']],
  ['built: not marked pressed when staged', 'control', 'aria-pressed={pending}', 'aria-pressed={false}', ['panel']],
  ['built: Apply is allowed on a built deck', 'panel', 'if (selectionLocked || !canApply || !onBuildThemeChange) return', 'if (!canApply || !onBuildThemeChange) return', ['pins']],
  // placement
  ['placement: the picker drops the control', 'panel', '{modeControl ? <>{currentRow}{modeControl}</> : currentRow}', '{currentRow}', ['panel']],
  ['placement: the control is above the current-theme row', 'panel', '{modeControl ? <>{currentRow}{modeControl}</> : currentRow}', '{modeControl ? <>{modeControl}{currentRow}</> : currentRow}', ['panel']],
  ['placement: the plain panel drops the control', 'panel', '{deckModeControl ? <>{lockedNotice}{deckModeControl}</> : lockedNotice}', '{lockedNotice}', ['panel']],
  ['placement: flag off adds an empty child to the picker', 'panel', '{modeControl ? <>{currentRow}{modeControl}</> : currentRow}', '{currentRow}{modeControl}', ['panel']],
  ['placement: flag off adds an empty child to the plain panel', 'panel', '{deckModeControl ? <>{lockedNotice}{deckModeControl}</> : lockedNotice}', '{lockedNotice}{deckModeControl}', ['panel']],
  ['wording: "both" offered in the control', 'control', "{(['light', 'dark'] as const).map(value => (", "{(['light', 'dark', 'both'] as unknown as readonly ('light' | 'dark')[]).map(value => (", ['panel']],
  // the page and the wire
  ['page: the build message reads the staged mode', 'page', '      theme: buildThemeSelection,\n      ...(deckIdentity', '      theme: { ...buildThemeSelection, palette_mode: stagedPaletteMode ?? buildThemeSelection.palette_mode },\n      ...(deckIdentity', ['pins']],
  ['page: the page edits palette_mode itself', 'page', 'const THEME_SYNC_TIMEOUT_MS = 20_000', 'const THEME_SYNC_TIMEOUT_MS = 20_000\nconst PALETTE_MODE_KEY = "palette_mode"', ['pins']],
  ['page: the dark flag is read by the page', 'page', 'const THEME_SYNC_TIMEOUT_MS = 20_000', 'const THEME_SYNC_TIMEOUT_MS = 20_000\nconst THEME_DARK_MODE_ENABLED = true', ['pins']],
  ['viewer: the stage mode is handed to the viewer panel', 'viewer', '        selectionLocked={templateSelectionLocked}\n        onBuildThemeChange={onBuildThemeChange}\n      />', '        selectionLocked={templateSelectionLocked}\n        onBuildThemeChange={onBuildThemeChange}\n        stagedPaletteMode={null}\n      />', ['pins']],
  ['area: the stage mode is handed to the viewer', 'area', '            onBuildThemeChange={onBuildThemeChange}\n', '            onBuildThemeChange={onBuildThemeChange}\n            stagedPaletteMode={null}\n', ['pins']],
  ['hook: the frame is changed', 'hook', 'data: { request_id: requestId, theme, presentation_id: presentationId },', 'data: { request_id: requestId, theme: { ...theme, palette_mode: theme.palette_mode ?? "light" }, presentation_id: presentationId },', ['pins']],
  ['hook: the sync sends a changed selection', 'page', 'sendThemeSelection(target.selection, requestId, targetPresentationId)', 'sendThemeSelection({ ...target.selection, palette_mode: "dark" }, requestId, targetPresentationId)', ['pins']],
  // documentation
  ['env: documented on', 'env', 'NEXT_PUBLIC_THEME_DARK_MODE_ENABLED="false"', 'NEXT_PUBLIC_THEME_DARK_MODE_ENABLED="true"', ['pins']],
  ['env: not documented', 'env', 'NEXT_PUBLIC_THEME_DARK_MODE_ENABLED="false"', '', ['pins']],
  ['package: script not registered', 'pkg', '"test:studio-theme-dark-toggle": "node scripts/test-studio-theme-dark-toggle.mjs"', '"test:studio-theme-dark-toggle-x": "node scripts/test-studio-theme-dark-toggle.mjs"', ['pins']],
]

const SOURCE = { ...Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, read(rel)])), env: read('.env.example'), pkg: read('package.json') }
let caught = 0
const survivors = []
const invalid = []
for (const [name, key, from, to, suites] of mutants) {
  const original = SOURCE[key]
  assert.ok(original.includes(from), `mutant "${name}" no longer matches the ${key} source`)
  const broken = original.replace(from, () => to)
  assert.notEqual(broken, original, `mutant "${name}" changes nothing`)
  const overrides = {}
  const pinSources = {}
  if (key === 'env' || key === 'pkg') pinSources[key] = broken
  else {
    // a mutant must be valid code: it is caught by behaviour, not by a syntax error
    try { compile(FILES[key], broken) } catch (error) { invalid.push(`${name}: ${String(error.message).slice(0, 90)}`); continue }
    overrides[FILES[key]] = broken
    pinSources[key] = broken
  }
  const seen = checks
  let threw = false
  try { await fullSuite(overrides, suites, pinSources, false) } catch (error) {
    threw = true
    if (process.env.P2C_VERBOSE) console.log(`caught  ${name}  <-  ${error.name}: ${String(error.message).split('\n')[0].slice(0, 110)}`)
  }
  checks = seen
  if (threw) caught++
  else survivors.push(name)
}
deepEqual(invalid, [], 'every mutant must be valid code')
deepEqual(survivors, [], `mutants survived: ${survivors.join(' | ')}`)
check(assert.equal, caught, mutants.length)

console.log(`studio-theme-dark-toggle: ${checks} checks passed, ${caught} mutants caught`)
