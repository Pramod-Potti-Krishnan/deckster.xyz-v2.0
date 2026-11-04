// PASS2D A3: the canvas Theme dialog says what a theme does on a blank canvas (flag NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE, default off).
// The finding (ELEMENT-2 item 6, PASS2-J4-FINDINGS item 3): on a blank canvas "Apply theme" looked stuck and the slide did not change. Apply is
// enabled exactly while the picked theme differs from the applied one (theme-panel `hasChanges`); after a pick is applied it is greyed ("Pick a
// different theme to change it.") and Layout does not repaint a blank canvas. What was missing is a word about it. With the flag on, only while the
// deck is the blank canvas and the choice is open, the dialog gets a short note under its header and its preview line changes. Nothing about
// Apply, the draft or the payload moves.
//
// Run: node scripts/test-studio-theme-blank-note.mjs   (plain node: transpile + vm, no network, no React runtime, no git)
//   THEME_BLANK_NOTE_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-theme-blank-note.mjs
//     re-prints the flag-off hashes below from the base sources (origin/studio-v4-dev-preparation-code at 00921c0).
//
// Proven on the REAL sources: lib/studio-theme-blank-note.ts (imports nothing), components/theme-panel.tsx and components/theme-dropdown-picker.tsx
// (and the lib files they use) are transpiled and evaluated in a vm with a small hooks runtime; presentation-viewer.tsx is pinned at the source.
// Then every suite is re-run against deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const treeRoot = process.env.THEME_BLANK_NOTE_ROOT
  ? path.resolve(process.env.THEME_BLANK_NOTE_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE'
const V2 = 'NEXT_PUBLIC_STUDIO_THEME_PICKER_V2'
const DROPDOWN = 'NEXT_PUBLIC_STUDIO_THEME_DROPDOWN'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const CANON = 'NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED'
const DARK = 'NEXT_PUBLIC_THEME_DARK_MODE_ENABLED' // P2C (#416): the Light | Dark control shares the picker; the note must sit beside it
const FILES = {
  lib: 'lib/studio-theme-blank-note.ts',
  panel: 'components/theme-panel.tsx',
  picker: 'components/theme-dropdown-picker.tsx',
  viewer: 'components/presentation-viewer.tsx',
}
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
// Like JSON, but a key whose value is undefined stays visible, and functions are marked, so a changed key set cannot hide.
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---- module loader: transpile repo files and run them in a vm ------------------------------------------------------------
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
/** `overrides`: repo-relative path -> source text. */
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

// ---- a small hooks runtime: stateful root component, inert children ------------------------------------------------------
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
  const c = CONTRACTS[String(url).split('/').pop()]
  if (!c) return { ok: false, json: async () => ({}) }
  const [hero, primary, accent, background, surface, text] = c
  return { ok: true, json: async () => ({ palette: { hero: { hero_background: hero }, brand: { primary }, accent: { accent }, neutral: { background, surface }, text: { text_primary: text } } }) }
}
const icons = new Proxy({}, { get: (_, name) => `Icon:${String(name)}` })
const PICKER_STUBS = () => ({ react: createRuntime().react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') } })

function mountPanel(env, overrides = {}, extraStubs = {}) {
  const runtime = createRuntime()
  const stubs = { ...extraStubs, react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, 'next/link': { default: 'Link' }, '@/components/ui/button': { Button: 'Button' }, '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9' }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') } }
  const { ThemePanel } = createLoader({ env, stubs, globals: { fetch: localFetch }, overrides }).load(FILES.panel)
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

// ---- the matrix the flag-off proof runs over -----------------------------------------------------------------------------
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
const ENVS = [
  { name: 'plain (no shell)', env: {} },
  { name: 'plain (shell)', env: { [SHELL]: 'true' } },
  { name: 'picker v2', env: { [SHELL]: 'true', [V2]: 'true' } },
  { name: 'dropdown', env: { [SHELL]: 'true', [DROPDOWN]: 'true' } },
  { name: 'picker v2 + dropdown', env: { [SHELL]: 'true', [V2]: 'true', [DROPDOWN]: 'true' } },
  { name: 'dropdown + canon', env: { [SHELL]: 'true', [DROPDOWN]: 'true', [CANON]: 'true' } },
]
// Flag-on-only environments (no base golden: the P2C control changes the tree): the note and Apply are checked in them by comparison with themselves.
const EXTRA_ENVS = [
  { name: 'picker v2 + dark toggle', env: { [SHELL]: 'true', [V2]: 'true', [DARK]: 'true' } },
  { name: 'dropdown + dark toggle', env: { [SHELL]: 'true', [DROPDOWN]: 'true', [DARK]: 'true' } },
]
const NOTE_ENVS = [...ENVS.slice(2), ...EXTRA_ENVS]
const NOTE = { note: 'NOTE-TEXT-UNDER-TEST', previewNote: 'PREVIEW-TEXT-UNDER-TEST' }
const baseProps = (over = {}) => ({ isOpen: true, onClose() {}, presentationId: 'deck-1', buildThemeSelection: { mode: 'auto' }, themeSync: SYNC.idle, selectionLocked: false, onBuildThemeChange() {}, ...over })

/** Hash of every cell of the matrix for one env; `extra` is merged into the panel's props (the blank-canvas note, when given). */
async function hashOf(env, extra = {}, overrides = {}) {
  const hashes = []
  for (const selection of SELECTIONS) {
    for (const locked of [false, true]) {
      for (const status of Object.keys(SYNC)) {
        const tree = await mountPanel(env, overrides).render(baseProps({ buildThemeSelection: selection, themeSync: SYNC[status], selectionLocked: locked, ...extra }))
        hashes.push(sha(ser(tree)))
      }
    }
  }
  hashes.push(sha(ser(await mountPanel(env, overrides).render({ isOpen: false, onClose() {}, buildThemeSelection: { mode: 'auto' }, themeSync: SYNC.idle, ...extra }))))
  return sha(hashes.join('\n'))
}

// Hash of every cell above, per env, captured from the base (origin/studio-v4-dev-preparation-code at 00921c0, before this change).
const BASE_HASHES = {
  'plain (no shell)': '89c2c179f15c7979b0e5e0e7db6ac2bc82a3628625fae5a450e2fdd94cf1f1e6',
  'plain (shell)': '9205d5b03769f2cb6bd84e3ae50e54d9a90289aadc4e572f8b15078ea1d26c25',
  'picker v2': 'fbaccaf86d1bda94a947431a9e850230272d90a7b7a26e25d06c1e9e553df68b',
  'dropdown': '9cb6495ff70ee371bf02e23d08c8ec443dfca498856622fa3d9683a3ff91a9c9',
  'picker v2 + dropdown': '9cb6495ff70ee371bf02e23d08c8ec443dfca498856622fa3d9683a3ff91a9c9',
  'dropdown + canon': '74985db3cbbfd42b5db1d9c5d4a9bbc64c18ae0094db6068d3dd288843c67615',
}

if (process.env.PRINT_GOLDEN) {
  const out = {}
  for (const { name, env } of ENVS) out[name] = await hashOf(env)
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

// ---- suite 1: the pure helper ---------------------------------------------------------------------------------------------
function pureSuite(overrides = {}) {
  const load = env => createLoader({ env, overrides }).load(FILES.lib)
  const on = load({ [FLAG]: 'true' })
  check(assert.equal, on.STUDIO_THEME_BLANK_NOTE_ENABLED, true)
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['true', true]]) {
    const lib = load(value === undefined ? {} : { [FLAG]: value })
    check(assert.equal, lib.STUDIO_THEME_BLANK_NOTE_ENABLED, expected, `flag=${JSON.stringify(value)}`)
  }
  // the copy: plain words, short, and it does not promise a repaint
  check(assert.equal, on.THEME_BLANK_NOTE, "A blank canvas doesn't change when you apply a theme. Director uses it when it builds your slides.")
  check(assert.equal, on.THEME_BLANK_PREVIEW_NOTE, 'A preview only: your slides use this theme when Director builds them.')
  check(assert.ok, on.THEME_BLANK_NOTE.length <= 120 && on.THEME_BLANK_PREVIEW_NOTE.length <= 90, 'short')
  check(assert.equal, /your deck changes when you apply/i.test(on.THEME_BLANK_PREVIEW_NOTE), false, 'the blank preview line no longer says the deck changes on apply')
  // the helper: both conditions, exactly
  const note = (enabled, blank) => on.themeBlankNote(enabled, blank)
  check(assert.equal, JSON.stringify(note(true, true)), JSON.stringify({ note: on.THEME_BLANK_NOTE, previewNote: on.THEME_BLANK_PREVIEW_NOTE }))
  for (const [enabled, blank] of [[false, true], [true, false], [false, false], [true, null], [true, undefined], [true, 'true'], [true, 1], ['true', true], [1, true], [undefined, true]]) {
    check(assert.equal, note(enabled, blank), null, `enabled=${String(enabled)} blank=${String(blank)}`)
  }
}

// ---- suite 2: the real panel ----------------------------------------------------------------------------------------------
const buttons = tree => flat(tree).filter(node => node.type === 'Button')
const noticeNodes = (tree, kind) => flat(tree).filter(node => node.props?.['data-studio-theme-notice'] === kind)
const previewNotes = tree => flat(tree).filter(node => node.props?.className === 'stpdd-preview-note')
const DEFAULT_PREVIEW_LINE = 'A preview only: your deck changes when you apply the theme.'
const clone = value => Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value

async function panelSuite(overrides = {}, baseHashes = BASE_HASHES) {
  // flag off: no blankNote prop (or an absent / empty one) renders the base, in every env
  for (const { name, env } of ENVS) {
    check(assert.equal, await hashOf(env, {}, overrides), baseHashes[name], `${name}: no note prop = the base`)
    check(assert.equal, await hashOf(env, { blankNote: undefined }, overrides), baseHashes[name], `${name}: blankNote undefined = the base`)
  }
  // locked: the note is never drawn, the lock notice is the base's, in every env
  for (const { name, env } of [...ENVS, ...EXTRA_ENVS]) {
    for (const selection of [{ mode: 'auto' }, { mode: 'preset', preset_id: 'vibrant' }]) {
      const off = ser(await mountPanel(env, overrides).render(baseProps({ buildThemeSelection: selection, selectionLocked: true })))
      const on = ser(await mountPanel(env, overrides).render(baseProps({ buildThemeSelection: selection, selectionLocked: true, blankNote: NOTE })))
      check(assert.equal, on, off, `${name}: locked + note = locked without it`)
    }
  }
  // the plain panel (V2 and dropdown off) and the closed panel ignore the note
  for (const { name, env } of ENVS.slice(0, 2)) {
    for (const selection of SELECTIONS.slice(0, 4)) {
      const off = ser(await mountPanel(env, overrides).render(baseProps({ buildThemeSelection: selection })))
      const on = ser(await mountPanel(env, overrides).render(baseProps({ buildThemeSelection: selection, blankNote: NOTE })))
      check(assert.equal, on, off, `${name}: the plain panel ignores the note`)
    }
  }
  for (const { name, env } of NOTE_ENVS) {
    check(assert.equal, await mountPanel(env, overrides).render({ isOpen: false, onClose() {}, buildThemeSelection: { mode: 'auto' }, themeSync: SYNC.idle, blankNote: NOTE }), null, `${name}: closed stays closed`)
  }

  // note on, unlocked, in the lighter pickers: exactly one note, in the notice slot, with the words it was given
  for (const { name, env } of NOTE_ENVS) {
    for (const selection of [{ mode: 'auto' }, { mode: 'preset', preset_id: 'vibrant' }, { mode: 'preset', preset_id: 'minimal', font_family: 'Lato' }, { mode: 'custom', primary_hex: '#1e40af' }]) {
      for (const status of ['idle', 'syncing', 'applied', 'failed']) {
        const props = baseProps({ buildThemeSelection: selection, themeSync: SYNC[status] })
        const off = await mountPanel(env, overrides).render(props)
        const on = await mountPanel(env, overrides).render({ ...props, blankNote: NOTE })
        const cell = `${name} ${selection.mode}/${selection.preset_id ?? ''} ${status}`
        const notes = noticeNodes(on, 'blank')
        check(assert.equal, notes.length, 1, `${cell}: one blank note`)
        check(assert.equal, notes[0].props.role, 'note', `${cell}: a note`)
        check(assert.equal, text(notes[0]), NOTE.note, `${cell}: the note's words`)
        check(assert.match, String(notes[0].props.className), /^stpv2-notice$/, `${cell}: styled by the existing notice class`)
        check(assert.equal, noticeNodes(off, 'blank').length, 0, `${cell}: none without it`)
        check(assert.equal, noticeNodes(on, 'locked').length, 0, `${cell}: no lock notice while unlocked`)
        // the note sits above the "Current theme" row, before the body
        const order = flat(on).map(node => node.props?.['data-studio-theme-notice'] === 'blank' ? 'note' : node.props?.['data-studio-theme-current'] ? 'current' : node.props?.['data-studio-theme-part'] === 'body' ? 'body' : '').filter(Boolean)
        check(assert.equal, order.join(','), 'note,current,body', `${cell}: note, current theme, body`)
        // everything else is the base: take the note out and put the preview line back, and the tree is the off tree
        const stripped = clone(on)
        const hostOf = node => flat(stripped).find(item => Array.isArray(item.props?.children) && item.props.children.includes(node))
        const noteIn = noticeNodes(stripped, 'blank')[0]
        const host = flat(stripped).find(item => Array.isArray(item.props?.children) && item.props.children.some(child => child === noteIn))
        check(assert.ok, host, `${cell}: the note has a host`)
        host.props.children = host.props.children.map(child => child === noteIn ? false : child)
        for (const preview of previewNotes(stripped)) {
          const parts = preview.props.children
          if (Array.isArray(parts) && parts[parts.length - 1] === NOTE.previewNote) parts[parts.length - 1] = DEFAULT_PREVIEW_LINE
        }
        check(assert.equal, ser(stripped), ser(off), `${cell}: minus the note and the preview line, it is the base`)
        // the preview line changes only when a theme preview is shown (not for Auto, not for the custom editor)
        const dropdown = Boolean(env[DROPDOWN])
        const lines = previewNotes(on).map(node => text(node))
        if (dropdown && selection.mode === 'preset') {
          check(assert.equal, lines.length, 1, `${cell}: one preview line`)
          check(assert.ok, lines[0].endsWith(NOTE.previewNote) && !lines[0].includes('your deck changes'), `${cell}: the preview line closes with the blank words`)
        } else {
          check(assert.equal, lines.join('|'), previewNotes(off).map(node => text(node)).join('|'), `${cell}: no preview line change`)
        }
      }
    }
  }

  // Apply is untouched: same disabled state, same label and hint, and the same payload on click
  for (const { name, env } of NOTE_ENVS) {
    for (const [selection, picked] of [[{ mode: 'auto' }, null], [{ mode: 'auto' }, 'corporate_light'], [{ mode: 'preset', preset_id: 'minimal' }, 'minimal'], [{ mode: 'preset', preset_id: 'minimal' }, 'vibrant']]) {
      const outcome = async extra => {
        const sent = []
        const props = baseProps({ buildThemeSelection: selection, onBuildThemeChange: next => sent.push(next), ...extra })
        // The dropdown keeps its own state (inert inside the panel tree), so a recorder stands in for it and drives onSelect, as the dropdown tests do.
        const seen = []
        const realPicker = createLoader({ env, stubs: PICKER_STUBS(), overrides }).load(FILES.picker)
        const recorder = { ...realPicker, ThemeDropdownPicker: pickerProps => { seen.push(pickerProps); return jsx('div', { 'data-stub-dropdown': 'true' }) } }
        const panel = mountPanel(env, overrides, env[DROPDOWN] ? { './theme-dropdown-picker': recorder } : {})
        let tree = await panel.render(props)
        if (picked) {
          if (env[DROPDOWN]) seen[seen.length - 1].onSelect(picked)
          else flat(tree).find(node => node.type === 'button' && node.props['data-studio-theme-preset'] === picked).props.onClick()
          tree = await panel.render(props)
        }
        const apply = buttons(tree).find(node => node.props.className === 'stpv2-btn stpv2-apply')
        const hint = text(flat(tree).find(node => node.props?.['data-studio-theme-hint']))
        const state = { disabled: apply.props.disabled, label: text(apply), hint }
        if (!apply.props.disabled) apply.props.onClick()
        return { state, sent }
      }
      const off = await outcome({})
      const on = await outcome({ blankNote: NOTE })
      check(assert.equal, ser(on), ser(off), `${name} ${selection.mode} pick=${picked}: Apply's state and payload are unchanged by the note`)
    }
  }
}

// ---- suite 3: wiring and documentation pins -------------------------------------------------------------------------------
function guardSuite(sources = {}) {
  const viewer = sources.viewer ?? read(FILES.viewer)
  const panel = sources.panel ?? read(FILES.panel)
  const picker = sources.picker ?? read(FILES.picker)
  const lib = sources.lib ?? read(FILES.lib)
  const env = sources.env ?? read('.env.example')
  const pkg = sources.pkg ?? JSON.parse(read('package.json'))

  // the viewer: one import, one const, one conditional prop on the Theme Panel; the flag is the module constant
  check(assert.match, viewer, /import \{ STUDIO_THEME_BLANK_NOTE_ENABLED, themeBlankNote \} from '@\/lib\/studio-theme-blank-note'/)
  check(assert.equal, (viewer.match(/themeBlankNote\(/g) ?? []).length, 1, 'one call')
  check(assert.match, viewer, /const themeBlankCopy = themeBlankNote\(STUDIO_THEME_BLANK_NOTE_ENABLED, isBlankPresentation\)/)
  const themePanel = viewer.slice(viewer.indexOf('{/* Theme Panel */}'))
  check(assert.match, themePanel, /<ThemePanel\s+isOpen=\{showThemePanel\}[\s\S]*?themeSync=\{themeSync\}\n\s*\{\.\.\.\(themeBlankCopy \? \{ blankNote: themeBlankCopy \} : \{\}\)\}\n\s*selectionLocked=\{templateSelectionLocked\}\n\s*onBuildThemeChange=\{onBuildThemeChange\}\n\s*\/>/)
  check(assert.equal, (viewer.match(/blankNote:/g) ?? []).length, 1, 'the viewer passes the note in one place')
  check(assert.equal, (viewer.match(/STUDIO_THEME_BLANK_NOTE_ENABLED/g) ?? []).length, 2, 'the flag is the import and the call')
  // the page's own panel (no deck yet) is not touched
  check(assert.equal, /blankNote|studio-theme-blank-note/.test(read('app/builder/page.tsx')), false, 'the page does not know the note')
  // the panel: no import of its own (the copy arrives as a prop), the note shares the lock notice's slot, the preview line is the base's unless told
  check(assert.equal, /from '@\/lib\/studio-theme-blank-note'/.test(panel) || /from '@\/lib\/studio-theme-blank-note'/.test(picker), false, 'theme-panel.tsx and the picker import nothing new')
  check(assert.match, panel, /\) : blankNote \? \(\s*<div data-studio-theme-notice="blank" role="note" className="stpv2-notice">/)
  check(assert.match, panel, /\{\.\.\.\(blankNote \? \{ blankNote: blankNote\.note \} : \{\}\)\}/)
  check(assert.match, panel, /const blankNote = blankCopy && !selectionLocked \? blankCopy : undefined/)
  check(assert.match, panel, /preview=\{blankNote && dropdownPreview\.kind === 'theme' \? \{ \.\.\.dropdownPreview, applyNote: blankNote\.previewNote \} : dropdownPreview\}/)
  check(assert.equal, (panel.match(/disabled=\{!canApply \|\| syncStatus === 'syncing'\}/g) ?? []).length, 1, "Apply's disabled rule is the base's")
  check(assert.match, panel, /\(hasChanges \|\| visibleSyncStatus === 'failed'\),/)
  // the picker: the closing sentence is the base's unless applyNote is given
  check(assert.match, picker, /\{preview\.applyNote \?\? 'A preview only: your deck changes when you apply the theme\.'\}/)
  check(assert.match, picker, /applyNote\?: string/)
  // the helper imports nothing
  check(assert.equal, /^\s*import\s/m.test(lib), false, 'lib/studio-theme-blank-note.ts imports nothing')
  check(assert.match, lib, /export const STUDIO_THEME_BLANK_NOTE_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE === 'true'/)
  // no stylesheet changed: the note reuses .stpv2-notice
  check(assert.equal, sha(read('components/studio-theme-panel.css')), BASE_PANEL_CSS_SHA256, 'studio-theme-panel.css is the base')
  // documented, default off; script registered
  check(assert.match, env, /^NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE="false"$/m)
  check(assert.equal, pkg.scripts['test:studio-theme-blank-note'], 'node scripts/test-studio-theme-blank-note.mjs')
}

// sha256 of components/studio-theme-panel.css at the base commit.
const BASE_PANEL_CSS_SHA256 = 'ba6fddc8417593373febbfcfc77e8e571d6523713f2b70ad427a1cdb814dc45b'

async function fullSuite(overrides = {}, only = ['pure', 'panel', 'guard']) {
  if (only.includes('pure')) pureSuite(overrides)
  if (only.includes('panel')) await panelSuite(overrides)
  if (only.includes('guard')) {
    const by = Object.fromEntries(Object.entries(FILES).filter(([, rel]) => rel in overrides).map(([key, rel]) => [key, overrides[rel]]))
    guardSuite(by)
  }
}

// ---- the real sources ------------------------------------------------------------------------------------------------------
await fullSuite()

// ---- mutation check: every mutant must be caught ---------------------------------------------------------------------------
// [name, file key, from, to, suites to run]
const mutants = [
  // flag and helper
  ['flag: any value enables', 'lib', "=== 'true'", "!== 'false'", ['pure']],
  ['flag: on by default', 'lib', "=== 'true'", "!== 'never'", ['pure']],
  ['helper: ignores the flag', 'lib', 'return enabled === true && isBlankPresentation === true ?', 'return isBlankPresentation === true ?', ['pure']],
  ['helper: ignores the blank canvas', 'lib', 'return enabled === true && isBlankPresentation === true ?', 'return enabled === true ?', ['pure']],
  ['helper: truthy blank is enough', 'lib', 'enabled === true && isBlankPresentation === true', 'enabled === true && Boolean(isBlankPresentation)', ['pure']],
  ['copy: the note promises a repaint', 'lib', "A blank canvas doesn't change when you apply a theme.", 'A blank canvas changes when you apply a theme.', ['pure']],
  ['copy: the preview line still says the deck changes', 'lib', 'A preview only: your slides use this theme when Director builds them.', 'A preview only: your deck changes when you apply the theme.', ['pure']],
  // the panel
  ['panel: the note is drawn while locked', 'panel', '      ) : blankNote ? (', '      ) : blankCopy ? (', ['panel']],
  ['panel: the note replaces the lock notice', 'panel', '      {locked ? (\n        <div data-studio-theme-notice="locked"', '      {blankNote ? (\n        <div data-studio-theme-notice="locked"', ['panel']],
  ['panel: a locked deck still gets the note', 'panel', 'const blankNote = blankCopy && !selectionLocked ? blankCopy : undefined', 'const blankNote = blankCopy ? blankCopy : undefined', ['panel', 'guard']],
  ['panel: the note is never passed on', 'panel', '        {...(blankNote ? { blankNote: blankNote.note } : {})}\n', '', ['panel', 'guard']],
  ['panel: the wrong words are passed on', 'panel', '{ blankNote: blankNote.note }', '{ blankNote: blankNote.previewNote }', ['panel', 'guard']],
  ['panel: an empty note is always passed (an extra prop with the flag off)', 'panel', '{...(blankNote ? { blankNote: blankNote.note } : {})}', '{...{ blankNote: blankNote?.note }}', ['panel', 'guard']],
  ['panel: the preview line is not changed', 'panel', "preview={blankNote && dropdownPreview.kind === 'theme' ? { ...dropdownPreview, applyNote: blankNote.previewNote } : dropdownPreview}", 'preview={dropdownPreview}', ['panel', 'guard']],
  ['panel: the Auto preview gets the line too', 'panel', "blankNote && dropdownPreview.kind === 'theme' ?", 'blankNote ?', ['panel', 'guard']],
  ['panel: Apply is enabled by the note', 'panel', '&& (hasChanges || visibleSyncStatus === \'failed\'),', '&& (hasChanges || visibleSyncStatus === \'failed\' || Boolean(blankCopy)),', ['panel', 'guard']],
  ['panel: the note changes the Apply payload', 'panel', "    const next = clampDarkOnlyPaletteMode(normalizeThemePanelSelection(draft), THEME_DARK_MODE)\n", "    const next = { ...clampDarkOnlyPaletteMode(normalizeThemePanelSelection(draft), THEME_DARK_MODE), ...(blankCopy ? { harmony_preference: 'analogous' } : {}) }\n", ['panel']],
  ['panel: the note is an alert', 'panel', '<div data-studio-theme-notice="blank" role="note" className="stpv2-notice">', '<div data-studio-theme-notice="blank" role="alert" className="stpv2-notice">', ['panel', 'guard']],
  ['panel: the note loses its role', 'panel', '<div data-studio-theme-notice="blank" role="note" className="stpv2-notice">', '<div data-studio-theme-notice="blank" className="stpv2-notice">', ['panel', 'guard']],
  ['panel: the note has its own class', 'panel', '<div data-studio-theme-notice="blank" role="note" className="stpv2-notice">', '<div data-studio-theme-notice="blank" role="note" className="stpv2-notice stpv2-new">', ['panel', 'guard']],
  ['panel: a new child in the flag-off notice list', 'panel', '      ) : false}\n', '      ) : undefined}\n', ['panel']],
  ['panel: the note moves below the current theme', 'panel', '      {modeControl ? <>{currentRow}{modeControl}</> : currentRow}', '      {modeControl ? <>{currentRow}{modeControl}</> : currentRow}\n      {blankNote && <div data-studio-theme-notice="blank" role="note" className="stpv2-notice"><span>{blankNote}</span></div>}', ['panel']],
  // the picker
  ['picker: applyNote is ignored', 'picker', "{preview.applyNote ?? 'A preview only: your deck changes when you apply the theme.'}", "{'A preview only: your deck changes when you apply the theme.'}", ['panel', 'guard']],
  ['picker: the default line changes', 'picker', "?? 'A preview only: your deck changes when you apply the theme.'", "?? 'A preview only.'", ['panel', 'guard']],
  ['picker: applyNote replaces the font sentence too', 'picker', "        {preview.headingFont || preview.bodyFont\n          ? `Fonts:", "        {preview.applyNote ? '' : preview.headingFont || preview.bodyFont\n          ? `Fonts:", ['panel']],
  // the viewer
  ['viewer: the note is always passed', 'viewer', '{...(themeBlankCopy ? { blankNote: themeBlankCopy } : {})}', '{...{ blankNote: themeBlankCopy }}', ['guard']],
  ['viewer: the flag is not consulted', 'viewer', 'themeBlankNote(STUDIO_THEME_BLANK_NOTE_ENABLED, isBlankPresentation)', 'themeBlankNote(true, isBlankPresentation)', ['guard']],
  ['viewer: every deck counts as blank', 'viewer', 'themeBlankNote(STUDIO_THEME_BLANK_NOTE_ENABLED, isBlankPresentation)', 'themeBlankNote(STUDIO_THEME_BLANK_NOTE_ENABLED, true)', ['guard']],
  ['viewer: the note is never passed', 'viewer', '        {...(themeBlankCopy ? { blankNote: themeBlankCopy } : {})}\n', '', ['guard']],
  // docs and wiring
  ['env: documented on', 'env', 'NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE="false"', 'NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE="true"', ['guard']],
  ['env: not documented', 'env', 'NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE="false"', '', ['guard']],
  ['package: script not registered', 'pkg', '"test:studio-theme-blank-note"', '"test:studio-theme-blank-note-x"', ['guard']],
]

const REL = { lib: FILES.lib, panel: FILES.panel, picker: FILES.picker, viewer: FILES.viewer }
let caught = 0
const survivors = []
const invalid = []
for (const [name, key, from, to, suites] of mutants) {
  const original = key === 'env' ? read('.env.example') : key === 'pkg' ? JSON.stringify(JSON.parse(read('package.json')), null, 2) : read(REL[key])
  assert.ok(original.includes(from), `mutant "${name}" no longer matches the ${key} source`)
  const broken = original.replace(from, () => to)
  assert.notEqual(broken, original, `mutant "${name}" changes nothing`)
  if (key !== 'env' && key !== 'pkg') {
    // a mutant must be valid code: it is caught by behaviour, not by a syntax error
    try { compile(REL[key], broken) } catch (error) { invalid.push(`${name}: ${String(error.message).slice(0, 80)}`); continue }
  }
  const seen = checks
  let survived = false
  try {
    if (key === 'env') guardSuite({ env: broken })
    else if (key === 'pkg') guardSuite({ pkg: JSON.parse(broken) })
    else await fullSuite({ [REL[key]]: broken }, suites)
    survived = true
  } catch { /* caught */ }
  checks = seen
  if (survived) survivors.push(name)
  else caught++
}
assert.deepEqual(invalid, [], 'every mutant must be valid code')
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(' | ')}`)
check(assert.equal, caught, mutants.length)

console.log(`studio-theme-blank-note: ${checks} checks passed, ${caught} mutants caught`)
