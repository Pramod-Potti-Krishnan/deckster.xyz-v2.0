// PASS2D 4c: the deck Theme dialog shows no "Applied" pill while the deck's theme is Auto (flag NEXT_PUBLIC_STUDIO_THEME_AUTO_NO_PILL, default off).
// The finding (PASS2-J4-FINDINGS item 4c; THEME-2 look-and-feel rank 4): the header said "Applied" beside "Current theme Auto (Director's choice)" while the preview
// said "nothing to preview yet". An Auto deck reaches the page's `applied` sync state with no pick (restore of a never-picked session, the socket-ready sync), so the
// pill was true to the sync and wrong to the person. With the flag on, only the `applied` pill is hidden, only while the theme the deck has now is Auto.
//
// Run: node scripts/test-studio-theme-auto-pill.mjs   (plain node: transpile + vm, no network, no React runtime)
//   THEME_AUTO_PILL_BASE=<commit> overrides the base the flag-off identity is checked against (default fbc77c0, origin/studio-v4-dev-preparation-code before this change).
//
// Proven on the REAL sources: lib/studio-theme-auto-pill.ts (imports nothing) and components/theme-panel.tsx (with the lib files it uses) run in a vm with a small hooks
// runtime. Flag off, the panel's rendered tree is the base commit's, cell for cell. Then every suite is re-run against deliberately broken copies: each mutant must be caught.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const treeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const BASE_COMMIT = process.env.THEME_AUTO_PILL_BASE || 'fbc77c0'
const baseSource = file => execFileSync('git', ['show', `${BASE_COMMIT}:${file}`], { cwd: treeRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const FLAG = 'NEXT_PUBLIC_STUDIO_THEME_AUTO_NO_PILL'
const V2 = 'NEXT_PUBLIC_STUDIO_THEME_PICKER_V2'
const DROPDOWN = 'NEXT_PUBLIC_STUDIO_THEME_DROPDOWN'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const CANON = 'NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED'
const DARK = 'NEXT_PUBLIC_THEME_DARK_MODE_ENABLED'
const FILES = { lib: 'lib/studio-theme-auto-pill.ts', panel: 'components/theme-panel.tsx' }
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

// ---- the matrix -------------------------------------------------------------------------------------------------------------
const SYNC = {
  idle: { status: 'idle', requestId: null, presentationId: null, themeFingerprint: null, error: null },
  syncing: { status: 'syncing', requestId: 'r1', presentationId: 'deck-1', themeFingerprint: null, error: null },
  applied: { status: 'applied', requestId: 'r1', presentationId: 'deck-1', themeFingerprint: 'fp', error: null },
  failed: { status: 'failed', requestId: 'r1', presentationId: 'deck-1', themeFingerprint: 'fp', error: 'The theme could not be applied.' },
}
const SELECTIONS = [
  { mode: 'auto' },
  { mode: 'preset', preset_id: 'corporate_light' },
  { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#123456' } },
  { mode: 'preset', preset_id: 'unknown-old-theme' },
  { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b' },
]
const LIGHTER = [
  { name: 'picker v2', env: { [SHELL]: 'true', [V2]: 'true' } },
  { name: 'dropdown', env: { [SHELL]: 'true', [DROPDOWN]: 'true' } },
  { name: 'picker v2 + dropdown + canon', env: { [SHELL]: 'true', [V2]: 'true', [DROPDOWN]: 'true', [CANON]: 'true' } },
  { name: 'dropdown + dark toggle', env: { [SHELL]: 'true', [DROPDOWN]: 'true', [DARK]: 'true' } },
]
const PLAIN = [
  { name: 'plain (no shell)', env: {} },
  { name: 'plain (shell)', env: { [SHELL]: 'true' } },
]
const baseProps = (over = {}) => ({ isOpen: true, onClose() {}, presentationId: 'deck-1', buildThemeSelection: { mode: 'auto' }, themeSync: SYNC.idle, selectionLocked: false, onBuildThemeChange() {}, ...over })
const pillStatuses = tree => flat(tree).filter(node => typeof node.props?.['data-studio-theme-sync'] === 'string').map(node => node.props['data-studio-theme-sync'])
const clone = value => Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value

// ---- suite 1: the pure helper -----------------------------------------------------------------------------------------------
function pureSuite(overrides = {}) {
  const load = env => createLoader({ env, overrides }).load(FILES.lib)
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['yes', false], ['true', true]]) {
    check(assert.equal, load(value === undefined ? {} : { [FLAG]: value }).STUDIO_THEME_AUTO_NO_PILL_ENABLED, expected, `flag=${JSON.stringify(value)}`)
  }
  const lib = load({ [FLAG]: 'true' })
  // hidden only when all three hold: flag on, current theme Auto, status applied
  for (const enabled of [true, false, 'true', 1, undefined, null]) {
    for (const status of ['idle', 'syncing', 'applied', 'failed', 'restored', '', undefined]) {
      for (const auto of [true, false, 'true', 1, undefined, null]) {
        const expected = enabled === true && auto === true && status === 'applied'
        check(assert.equal, lib.themeAppliedPillHidden(enabled, status, auto), expected, `hidden(${String(enabled)}, ${String(status)}, ${String(auto)})`)
      }
    }
  }
  check(assert.equal, lib.themeAppliedPillHidden.length, 3)
  // import-free and reads the environment once, inline (so Next can inline it)
  const source = overrides[FILES.lib] ?? read(FILES.lib)
  check(assert.equal, ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true).statements.filter(ts.isImportDeclaration).length, 0, 'imports nothing')
  check(assert.equal, (source.match(/process\.env\.NEXT_PUBLIC_STUDIO_THEME_AUTO_NO_PILL/g) ?? []).length, 1, 'flag read once, literal')
}

// ---- suite 2: the real panel ------------------------------------------------------------------------------------------------
async function panelSuite(overrides = {}) {
  const baseOverrides = { [FILES.panel]: baseSource(FILES.panel) }
  const flagOn = env => ({ ...env, [FLAG]: 'true' })
  // flag off (unset or any value but exact "true"): the rendered tree is the base commit's, in every env and cell
  for (const { name, env } of [...PLAIN, ...LIGHTER]) {
    for (const value of [undefined, 'false', '', '1', 'TRUE']) {
      const withFlag = value === undefined ? env : { ...env, [FLAG]: value }
      for (const selection of SELECTIONS) for (const locked of [false, true]) for (const status of Object.keys(SYNC)) {
        const props = baseProps({ buildThemeSelection: selection, themeSync: SYNC[status], selectionLocked: locked })
        const mine = ser(await mountPanel(withFlag, overrides).render(props))
        const base = ser(await mountPanel(env, baseOverrides).render(props))
        check(assert.equal, mine, base, `${name} flag=${JSON.stringify(value)} ${selection.mode}/${selection.preset_id ?? ''} ${status} locked=${locked}: the base`)
      }
    }
  }
  // the plain panel is untouched even with the flag on
  for (const { name, env } of PLAIN) {
    for (const selection of SELECTIONS) for (const status of Object.keys(SYNC)) {
      const props = baseProps({ buildThemeSelection: selection, themeSync: SYNC[status] })
      check(assert.equal, ser(await mountPanel(flagOn(env), overrides).render(props)), ser(await mountPanel(env, baseOverrides).render(props)), `${name} flag on, ${selection.mode} ${status}: plain panel is the base`)
    }
  }
  // flag on, lighter pickers: the pill rule
  for (const { name, env } of LIGHTER) {
    for (const selection of SELECTIONS) for (const locked of [false, true]) for (const status of Object.keys(SYNC)) {
      const props = baseProps({ buildThemeSelection: selection, themeSync: SYNC[status], selectionLocked: locked })
      const cell = `${name} ${selection.mode}/${selection.preset_id ?? ''} ${status} locked=${locked}`
      const on = await mountPanel(flagOn(env), overrides).render(props)
      const base = await mountPanel(env, baseOverrides).render(props)
      const hidden = selection.mode === 'auto' && status === 'applied'
      check(assert.deepEqual, pillStatuses(on), hidden ? [] : pillStatuses(base), `${cell}: pill statuses`)
      check(assert.deepEqual, pillStatuses(base), status === 'idle' ? [] : [status], `${cell}: the base draws the pill for every non-idle status`)
      if (!hidden) check(assert.equal, ser(on), ser(base), `${cell}: unchanged where the pill is kept`)
      else {
        // only the pill is gone: put it back and the tree is the base's
        const stripped = clone(base)
        const actions = flat(stripped).find(node => node.props?.className === 'stpv2-header-actions')
        check(assert.ok, actions, `${cell}: the header actions row`)
        const kept = actions.props.children.filter(child => !(child && typeof child === 'object' && typeof child.props?.['data-studio-theme-sync'] === 'string'))
        check(assert.equal, kept.length, actions.props.children.length - 1, `${cell}: exactly one pill in the base`)
        actions.props.children = kept
        const onActions = flat(on).find(node => node.props?.className === 'stpv2-header-actions')
        const cleaned = onActions.props.children.filter(child => child !== false)
        const strippedActions = actions.props.children.filter(child => child !== false)
        check(assert.equal, ser(cleaned), ser(strippedActions), `${cell}: the rest of the header actions row`)
      }
      // Apply and the header's current-theme row are the same either way
      const footerOf = tree => ser(flat(tree).filter(node => node.type === 'Button').map(node => [node.props.disabled, node.props.className]))
      check(assert.equal, footerOf(on), footerOf(base), `${cell}: Cancel / Apply buttons`)
    }
  }
  // the panel reads the helper's answer and holds no flag read of its own
  const source = overrides[FILES.panel] ?? read(FILES.panel)
  check(assert.equal, (source.match(/NEXT_PUBLIC_STUDIO_THEME_AUTO_NO_PILL/g) ?? []).length, 0, 'the panel never reads the flag itself')
  check(assert.equal, (source.match(/themeAppliedPillHidden\(/g) ?? []).length, 1, 'one use of the helper')
  check(assert.ok, source.includes("{syncStatus !== 'idle' && !themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, syncStatus, autoCurrent) && <SyncBadge status={syncStatus} />}"), 'the header line')
  check(assert.equal, (source.match(/<SyncBadge /g) ?? []).length, 2, 'the plain panel keeps its own badge')
}

pureSuite()
await panelSuite()

// ---- suite 3: mutants -------------------------------------------------------------------------------------------------------
const MUTANTS = [
  ['helper: drop the flag test', FILES.lib, 'return enabled === true && currentIsAuto === true', 'return currentIsAuto === true'],
  ['helper: drop the Auto test', FILES.lib, 'enabled === true && currentIsAuto === true && status', 'enabled === true && status'],
  ['helper: hide on any non-idle status', FILES.lib, "status === 'applied'", "status !== 'idle'"],
  ['helper: hide on failed instead of applied', FILES.lib, "status === 'applied'", "status === 'failed'"],
  ['helper: hide on syncing too', FILES.lib, "status === 'applied'", "(status === 'applied' || status === 'syncing')"],
  ['helper: loose flag compare', FILES.lib, "=== 'true'", "!== 'false'"],
  ['helper: flag always on', FILES.lib, "process.env.NEXT_PUBLIC_STUDIO_THEME_AUTO_NO_PILL === 'true'", 'true'],
  ['helper: Auto test inverted', FILES.lib, 'currentIsAuto === true', 'currentIsAuto === false'],
  ['panel: pill rule removed', FILES.panel, ' && !themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, syncStatus, autoCurrent)', ''],
  ['panel: rule not negated', FILES.panel, '!themeAppliedPillHidden(', 'themeAppliedPillHidden('],
  ['panel: Auto flag passed as false', FILES.panel, 'themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, syncStatus, autoCurrent)', 'themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, syncStatus, false)'],
  ['panel: Auto flag passed as true', FILES.panel, 'themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, syncStatus, autoCurrent)', 'themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, syncStatus, true)'],
  ['panel: status passed as applied', FILES.panel, 'themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, syncStatus, autoCurrent)', "themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, 'applied', autoCurrent)"],
  ['panel: flag passed as true', FILES.panel, 'themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, syncStatus, autoCurrent)', 'themeAppliedPillHidden(true, syncStatus, autoCurrent)'],
  ['panel: the plain panel badge also gated', FILES.panel, '<SyncBadge status={visibleSyncStatus} />', '{!themeAppliedPillHidden(STUDIO_THEME_AUTO_NO_PILL_ENABLED, visibleSyncStatus, draft.mode === \'auto\') && <SyncBadge status={visibleSyncStatus} />}'],
  ['panel: pill hidden for every idle too', FILES.panel, "{syncStatus !== 'idle' && !themeAppliedPillHidden", "{syncStatus === 'applied' && !themeAppliedPillHidden"],
]
let caught = 0
const survivors = []
for (const [label, file, from, to] of MUTANTS) {
  const original = read(file)
  assert.ok(original.split(from).length - 1 >= 1, `mutant "${label}": the text to break is in ${file}`)
  const overrides = { [file]: original.replace(from, () => to) }
  let failed = false
  try { pureSuite(overrides); await panelSuite(overrides) } catch { failed = true }
  if (failed) caught++
  else survivors.push(label)
}
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join('; ')}`)
console.log(`studio-theme-auto-pill: ${checks} checks passed, ${caught}/${MUTANTS.length} mutants caught`)
