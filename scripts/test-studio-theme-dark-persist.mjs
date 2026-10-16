// P2C follow-up: keep the Light / Dark deck choice on a PRESET (flag NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST, exact "true", default off; it acts only while
// NEXT_PUBLIC_THEME_DARK_MODE_ENABLED, the toggle of PR #416, is on too).
//
// Two gaps, one flag:
//   1. the composer's quick picks (preset chip, brand colour, saved theme) replace the whole selection and dropped the palette_mode chosen in the theme panel
//      (page.tsx handleBuildThemeChange is where every pick becomes state);
//   2. the stored-selection restore (page.tsx normalizeStoredBuildThemeSelection, which also reads the stored saved-theme profile) and the Director restore
//      (lib/studio-theme-restore.ts restoredThemeSelection) read a preset as just { mode, preset_id } (+ fonts), so Dark did not survive a reload.
//
// Offline and self-contained: no network, no git, no browser. It runs the REAL sources: lib/studio-theme-dark-toggle.ts (import-free, loaded alone),
// lib/studio-theme-restore.ts, and the page's own functions (normalizeStoredBuildThemeSelection, normalizeStoredBuildThemeProfile, buildThemeProfileMatchesSelection
// and the handleBuildThemeChange callback), cut out of app/builder/page.tsx by AST and evaluated in a vm.
//   pure     the flag (both literals exact "true"), carryPaletteMode and presetPaletteModeField over a grid, the dark-only clamp, no mutation of inputs.
//   restore  the Director restore keeps a preset's palette_mode with the flag on, nothing else changes, and its fingerprint equals the panel's own selection.
//   page     stored selection / stored saved-theme profile round trips; every quick pick through handleBuildThemeChange (state, active profile, lock, Auto).
//   off      flag off (every spelling, and either flag alone) is the base: the outputs over a corpus hash to the values printed from the base sources.
//   pins     where the flag is read (one function in the helper), what the page imports, chat-input.tsx untouched, documented default off, registered.
// Then every suite is re-run against deliberately broken copies of the sources: each mutant must be caught.
//
// Run: node scripts/test-studio-theme-dark-persist.mjs
//   DARK_PERSIST_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-theme-dark-persist.mjs   re-prints the flag-off hashes from the base sources.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'

const repoRoot = process.env.DARK_PERSIST_ROOT
  ? path.resolve(process.env.DARK_PERSIST_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const TOGGLE = 'NEXT_PUBLIC_THEME_DARK_MODE_ENABLED'
const PERSIST = 'NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST'
const ON = { [TOGGLE]: 'true', [PERSIST]: 'true' }
const FILES = {
  lib: 'lib/studio-theme-dark-toggle.ts',
  restore: 'lib/studio-theme-restore.ts',
  page: 'app/builder/page.tsx',
  chat: 'components/builder/chat-input.tsx',
  builder: 'lib/theme-builder.ts',
  panel: 'components/theme-panel.tsx',
}
// The base the flag-off identity is checked against: the merge of #416 (the toggle), where this change starts. Skipped, loudly, where the commit is not in the clone.
const BASE_COMMIT = process.env.DARK_PERSIST_BASE || '80dfde4'
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
// Like JSON, but a key whose value is undefined stays visible, so a changed key set (or key order) cannot hide.
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
// Values built inside a vm have that realm's prototypes; compare them by their JSON.
const plain = value => JSON.parse(JSON.stringify(value ?? null))
const deepEqual = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message)

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
/** `env`: process.env of the sandbox (null = a sandbox with no `process` at all); `overrides`: repo-relative path -> source text (a mutant). */
function createWorld({ env = {}, overrides = {} } = {}) {
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
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      throw new Error(`unexpected import ${spec} in ${rel}`)
    }
    vm.runInNewContext(compile(rel, source), { module, exports: module.exports, ...(env === null ? {} : { process: { env } }), require })
    return module.exports
  }
  return { load }
}

// ---------------------------------------------------------------- the page's own functions, cut out of app/builder/page.tsx
const PAGE_FUNCTIONS = ['normalizeStoredBuildThemeSelection', 'normalizeStoredBuildThemeProfile', 'stableStringifyRecord', 'buildThemeSelectionsEqual', 'buildThemeProfileMatchesSelection']
function pageParts(source) {
  const file = ts.createSourceFile(FILES.page, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const functions = {}
  let callback = null, restoreCall = null
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name && PAGE_FUNCTIONS.includes(node.name.text)) functions[node.name.text] = node.getText(file)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'handleBuildThemeChange' && node.initializer && ts.isCallExpression(node.initializer)) {
      callback = { fn: node.initializer.arguments[0].getText(file), deps: node.initializer.arguments[1].getText(file) }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'selection' && node.initializer?.getText(file).startsWith('restoredAdoptedSelection(')) restoreCall = node.initializer.getText(file)
    ts.forEachChild(node, visit)
  }
  visit(file)
  for (const name of PAGE_FUNCTIONS) assert.ok(functions[name], `${name} is in the page`)
  assert.ok(callback, 'handleBuildThemeChange is a useCallback in the page')
  assert.ok(restoreCall, 'the Director restore adopts a selection in the page')
  return { functions, callback, restoreCall }
}
/** The page functions, bound to the real helper files under `env`. `overrides` swaps in a mutant of any repo file (the page included). */
function createPage(env, overrides = {}) {
  const parts = pageParts(overrides[FILES.page] ?? read(FILES.page))
  const world = createWorld({ env, overrides })
  const toggle = world.load(FILES.lib)
  const fonts = world.load('lib/theme-fonts.ts')
  const names = PAGE_FUNCTIONS.join(', ')
  const js = ts.transpileModule(`${Object.values(parts.functions).join('\n')}\nmodule.exports = { ${names} }`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = {
    module: { exports: null },
    // a tree without the follow-up (the base, for the flag-off hashes) names none of these
    ...(toggle.carryPaletteMode ? { carryPaletteMode: toggle.carryPaletteMode, presetPaletteModeField: toggle.presetPaletteModeField } : {}),
    themeFontFields: fonts.themeFontFields, themeFontsEqual: fonts.themeFontsEqual,
  }
  vm.runInNewContext(js, context)
  const fns = context.module.exports
  const callbackJs = ts.transpileModule(`var __fn = (${parts.callback.fn});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const factory = new Function('scope', `with (scope) { ${callbackJs}\nreturn __fn }`)
  /** A page in a given state; returns { pick(selection), state, calls }. */
  function pageWith({ selection, profile = null, locked = false }) {
    const state = { selection, profile, selectionWrites: [], profileWrites: 0, saves: 0, toasts: [], localPick: false }
    const scope = {
      toast: value => { state.toasts.push(value) },
      templateSelectionLockedRef: { current: locked },
      saveSessionOnFirstAction: () => { state.saves++ },
      setActiveBuildThemeProfile: update => { state.profileWrites++; state.profile = typeof update === 'function' ? update(state.profile) : update },
      themeSelectionChangedLocallyRef: { set current(value) { state.localPick = value }, get current() { return state.localPick } },
      setBuildThemeSelection: value => { state.selectionWrites.push(value); state.selection = value },
      buildThemeSelectionRef: { get current() { return state.selection } },
      buildThemeProfileMatchesSelection: (current, next) => fns.buildThemeProfileMatchesSelection(current, next),
      ...(toggle.carryPaletteMode ? { carryPaletteMode: toggle.carryPaletteMode } : {}),
    }
    const handler = factory(scope)
    return { state, pick: next => handler(next) }
  }
  return { ...fns, parts, pageWith, restoreCall: parts.restoreCall }
}

// ---------------------------------------------------------------- the corpus
const DARK_ONLY = ['corporate_dark', 'gilded_noir', 'mission_amber']
const DARK_ONLY_ALIASES = ['dark-mode', 'dark_mode']
const preset = (id, mode, extra = {}) => ({ mode: 'preset', preset_id: id, ...(mode === undefined ? {} : { palette_mode: mode }), ...extra })
const custom = (hex, mode, extra = {}) => ({ mode: 'custom', primary_hex: hex, ...(mode === undefined ? {} : { palette_mode: mode }), ...extra })
const MODES = [undefined, 'light', 'dark', 'both', 'DARK', null, '', 7]
const STORED = [
  null, 'text', 42, {}, { mode: 'auto' }, { mode: 'preset' }, preset('minimal'), preset('minimal', 'dark'), preset('minimal', 'light'), preset('minimal', 'both'),
  preset('vibrant', 'dark', { color_overrides: { accent: '#111111' }, extra: true }), preset('corporate_dark', 'light'), preset('corporate_dark', 'dark'), preset('gilded_noir', 'both'),
  preset('mission_amber', 'light'), preset('dark-mode', 'light'), preset(' Corporate Dark ', 'light'),
  { mode: 'preset', preset_id: 'minimal', palette_mode: 'dark', harmony_preference: 'triadic' },
  { mode: 'custom' }, custom('#112233'), custom('#112233', 'dark'), custom('#112233', 'both'), custom('#112233', 'light', { harmony_preference: 'triadic', color_overrides: { x: '#000000' } }),
  { mode: 'custom', color_overrides: { primary: '#445566' }, palette_mode: 'dark' },
]
const RESTORE = [
  null, 'x', {}, { mode: 'auto' }, { mode: 'auto', palette_mode: 'dark' }, { mode: 'preset' }, { mode: 'preset', preset_id: '  ' },
  preset('vibrant'), preset('vibrant', 'dark'), preset('vibrant', 'light'), preset('vibrant', 'both'), preset('vibrant', 'nonsense'),
  preset('vibrant', 'dark', { color_overrides: { accent: '#123456', bad: 3 } }), preset('vibrant', 'dark', { color_overrides: {} }),
  preset('corporate_dark', 'light'), preset('gilded_noir', 'dark'), preset('mission_amber', 'both'), preset('dark_mode', 'light'),
  { mode: 'custom', primary_hex: '#1e40af', palette_mode: 'dark', harmony_preference: 'triadic' }, { mode: 'custom', primary_hex: '#1e40af', palette_mode: 'both' },
  { mode: 'custom', color_overrides: { primary: '#445566' } }, { mode: 'custom', secondary_hex: '#778899' },
]
const PICKS = [
  { mode: 'auto' }, preset('minimal'), preset('vibrant'), preset('corporate_dark'), preset('gilded_noir'), preset('mission_amber'), preset('dark_mode'), preset('minimal', 'light'),
  preset('minimal', 'dark'), preset('corporate_dark', 'light'), preset('corporate_dark', 'both'), custom('#336699'), custom('#336699', 'dark'), custom('#336699', 'both'), custom('#336699', 'light'),
]
const CURRENTS = [
  { mode: 'auto' }, { mode: 'auto', palette_mode: 'dark' }, preset('minimal'), preset('minimal', 'light'), preset('minimal', 'dark'), preset('minimal', 'both'), preset('corporate_dark', 'dark'),
  custom('#112233'), custom('#112233', 'dark'), custom('#112233', 'both'),
]

// ---------------------------------------------------------------- the pure helper
function pureSuite(overrides = {}) {
  const load = env => createWorld({ env, overrides }).load(FILES.lib)
  const lib = load(ON)

  // the flag: BOTH literals, exact "true" (the follow-up needs the toggle on too)
  for (const toggle of [undefined, '', 'false', '1', 'TRUE', 'True', ' true', 'true ', 'yes', 'true']) {
    for (const persist of [undefined, '', 'false', '1', 'TRUE', 'True', ' true', 'true ', 'yes', 'true']) {
      const expected = toggle === 'true' && persist === 'true'
      check(assert.equal, lib.darkPersistEnabled(toggle, persist), expected, `darkPersistEnabled(${JSON.stringify(toggle)}, ${JSON.stringify(persist)})`)
      const env = { ...(toggle === undefined ? {} : { [TOGGLE]: toggle }), ...(persist === undefined ? {} : { [PERSIST]: persist }) }
      check(assert.equal, load(env).THEME_DARK_PERSIST, expected, `the module reads its env: ${JSON.stringify(env)}`)
    }
  }
  check(assert.equal, load({ [PERSIST]: 'true' }).THEME_DARK_PERSIST, false, 'the persist flag alone does nothing')
  check(assert.equal, load({ [TOGGLE]: 'true' }).THEME_DARK_PERSIST, false, 'the toggle alone does nothing')
  check(assert.equal, load(null).THEME_DARK_PERSIST, false, 'a sandbox with no process reads as off')

  // the defaults follow the env flag; an explicit argument wins
  const on = load(ON), off = load({})
  check(assert.equal, on.carryPaletteMode(preset('x'), preset('y', 'dark')).palette_mode, 'dark', 'carryPaletteMode: default is the env flag (on)')
  check(assert.equal, off.carryPaletteMode(preset('x'), preset('y', 'dark')).palette_mode, undefined, 'carryPaletteMode: default is the env flag (off)')
  check(assert.equal, on.carryPaletteMode(preset('x'), preset('y', 'dark'), false).palette_mode, undefined, 'carryPaletteMode: an explicit false wins')
  check(assert.equal, off.carryPaletteMode(preset('x'), preset('y', 'dark'), true).palette_mode, 'dark', 'carryPaletteMode: an explicit true wins')
  deepEqual(on.presetPaletteModeField({ palette_mode: 'dark', preset_id: 'x' }), { palette_mode: 'dark' }, 'presetPaletteModeField: default is the env flag (on)')
  deepEqual(off.presetPaletteModeField({ palette_mode: 'dark', preset_id: 'x' }), {}, 'presetPaletteModeField: default is the env flag (off)')
  deepEqual(off.presetPaletteModeField({ palette_mode: 'dark', preset_id: 'x' }, true), { palette_mode: 'dark' }, 'presetPaletteModeField: an explicit true wins')
  deepEqual(on.presetPaletteModeField({ palette_mode: 'dark', preset_id: 'x' }, false), {}, 'presetPaletteModeField: an explicit false wins')

  // carryPaletteMode, flag off: the very same object, whatever the inputs
  for (const picked of PICKS) for (const current of [...CURRENTS, null, undefined]) {
    check(assert.strictEqual, lib.carryPaletteMode(picked, current, false), picked, `flag off: the pick itself (${ser(picked)} over ${ser(current)})`)
  }

  // carryPaletteMode, flag on, the grid: what the pick says wins; else Light or Dark of the current choice; Auto takes nothing; a dark-only preset ends on Dark
  const isDarkOnly = pick => pick.mode === 'preset' && [...DARK_ONLY, ...DARK_ONLY_ALIASES].includes(String(pick.preset_id).trim().toLowerCase().replace(/\s+/g, '_'))
  for (const picked of PICKS) for (const current of [...CURRENTS, null, undefined]) {
    const frozen = ser(picked), frozenCurrent = ser(current)
    const got = lib.carryPaletteMode(picked, current, true)
    let expected
    if (picked.mode !== 'auto' && picked.palette_mode == null && (current?.palette_mode === 'light' || current?.palette_mode === 'dark')) expected = { ...picked, palette_mode: current.palette_mode }
    else expected = picked
    if (isDarkOnly(expected) && expected.palette_mode != null && expected.palette_mode !== 'dark') expected = { ...expected, palette_mode: 'dark' }
    check(assert.equal, ser(got), ser(expected), `flag on: ${ser(picked)} over ${ser(current)}`)
    check(assert.equal, ser(picked), frozen, 'the pick is not mutated')
    check(assert.equal, ser(current), frozenCurrent, 'the current selection is not mutated')
    if (ser(got) === ser(picked)) check(assert.strictEqual, got, picked, 'nothing to carry: the very same object')
  }
  // named cases
  deepEqual(on.carryPaletteMode(preset('minimal'), preset('vibrant', 'dark')), preset('minimal', 'dark'), 'preset chip over Dark keeps Dark')
  deepEqual(on.carryPaletteMode(preset('minimal'), preset('vibrant', 'light')), preset('minimal', 'light'), 'preset chip over an explicit Light keeps Light')
  deepEqual(on.carryPaletteMode(custom('#336699'), preset('vibrant', 'dark')), custom('#336699', 'dark'), 'brand colour over Dark keeps Dark')
  deepEqual(on.carryPaletteMode(preset('minimal', 'light'), preset('vibrant', 'dark')), preset('minimal', 'light'), 'a saved theme that holds its own mode keeps it')
  deepEqual(on.carryPaletteMode(custom('#336699', 'both'), preset('vibrant', 'dark')), custom('#336699', 'both'), 'a saved theme holding "both" keeps it')
  deepEqual(on.carryPaletteMode(preset('minimal'), preset('vibrant', 'both')), preset('minimal'), '"both" is never carried')
  deepEqual(on.carryPaletteMode(preset('minimal'), custom('#112233', 'both')), preset('minimal'), '"both" of a custom palette is never carried')
  deepEqual(on.carryPaletteMode({ mode: 'auto' }, preset('vibrant', 'dark')), { mode: 'auto' }, 'Auto is a reset: it takes nothing')
  deepEqual(on.carryPaletteMode(preset('minimal'), { mode: 'auto', palette_mode: 'dark' }), preset('minimal', 'dark'), 'the choice kept on Auto rides on to the next pick')
  for (const id of [...DARK_ONLY, ...DARK_ONLY_ALIASES, ' Gilded Noir ', 'MISSION_AMBER']) {
    deepEqual(on.carryPaletteMode(preset(id), preset('vibrant', 'light')), preset(id, 'dark'), `dark-only ${JSON.stringify(id)} over Light ends on Dark`)
    deepEqual(on.carryPaletteMode(preset(id), preset('vibrant', 'dark')), preset(id, 'dark'), `dark-only ${JSON.stringify(id)} over Dark`)
    deepEqual(on.carryPaletteMode(preset(id), preset('vibrant')), preset(id), `dark-only ${JSON.stringify(id)} over nothing adds nothing`)
    deepEqual(on.carryPaletteMode(preset(id, 'light'), preset('vibrant', 'dark')), preset(id, 'dark'), `a saved dark-only ${JSON.stringify(id)} holding Light still ends on Dark`)
  }
  deepEqual(on.carryPaletteMode(preset('minimal'), preset('corporate_dark', 'dark')), preset('minimal', 'dark'), 'leaving a dark-only preset for a normal one keeps the Dark that was written')
  deepEqual(on.carryPaletteMode(custom('#336699'), preset('corporate_dark', 'light')), custom('#336699', 'light'), 'custom colours are never dark-only')
  deepEqual(on.carryPaletteMode(preset('minimal'), null), preset('minimal'), 'no current selection')
  deepEqual(on.carryPaletteMode(preset('minimal', undefined, { palette_mode: undefined }), preset('vibrant', 'dark')), preset('minimal', 'dark'), 'an explicit undefined reads as nothing said')
  const keyed = on.carryPaletteMode({ mode: 'preset', preset_id: 'minimal', color_overrides: { a: '#111111' }, font_family: 'Inter' }, preset('v', 'dark'))
  deepEqual(keyed, { mode: 'preset', preset_id: 'minimal', color_overrides: { a: '#111111' }, font_family: 'Inter', palette_mode: 'dark' }, 'every other key rides along untouched')

  // presetPaletteModeField: flag off the drop of today; on, Light or Dark only
  for (const mode of MODES) for (const id of ['minimal', 'vibrant', ...DARK_ONLY, ...DARK_ONLY_ALIASES, undefined, 5]) {
    const source = { palette_mode: mode, preset_id: id }
    check(assert.equal, ser(lib.presetPaletteModeField(source, false)), '{}', `flag off: nothing (${ser(source)})`)
    const darkOnly = typeof id === 'string' && [...DARK_ONLY, ...DARK_ONLY_ALIASES].includes(id)
    const expected = mode === 'light' || mode === 'dark' ? { palette_mode: darkOnly ? 'dark' : mode } : {}
    check(assert.equal, ser(lib.presetPaletteModeField(source, true)), ser(expected), `flag on: ${ser(source)}`)
  }
  for (const source of [null, undefined, {}, 'text', 3]) {
    check(assert.equal, ser(lib.presetPaletteModeField(source, true)), '{}', `flag on, no source: ${ser(source)}`)
    check(assert.equal, ser(lib.presetPaletteModeField(source, false)), '{}', `flag off, no source: ${ser(source)}`)
  }
}

// ---------------------------------------------------------------- the Director restore
function restoreSuite(overrides = {}) {
  const lib = env => createWorld({ env, overrides }).load(FILES.restore)
  const on = lib(ON), off = lib({})
  const builder = createWorld({ env: ON, overrides }).load(FILES.builder)

  // flag on: a preset keeps Light / Dark, in the panel's own key order (mode, preset_id, palette_mode, overrides)
  for (const mode of ['light', 'dark']) {
    deepEqual(on.restoredThemeSelection(preset('vibrant', mode)), preset('vibrant', mode), `a restored ${mode} preset keeps it`)
    check(assert.equal, ser(on.restoredThemeSelection(preset('vibrant', mode, { color_overrides: { accent: '#123456' } }))), ser({ mode: 'preset', preset_id: 'vibrant', palette_mode: mode, color_overrides: { accent: '#123456' } }), 'key order: palette_mode before the overrides, as selectCanonicalThemePreset writes it')
  }
  deepEqual(on.restoredThemeSelection(preset('vibrant', 'both')), preset('vibrant'), '"both" is not carried onto a preset')
  deepEqual(on.restoredThemeSelection(preset('vibrant', 'nonsense')), preset('vibrant'), 'an unknown mode is dropped')
  deepEqual(on.restoredThemeSelection(preset('vibrant')), preset('vibrant'), 'nothing stored, nothing added')
  for (const id of [...DARK_ONLY, ...DARK_ONLY_ALIASES]) deepEqual(on.restoredThemeSelection(preset(id, 'light')), preset(id, 'dark'), `a restored dark-only ${id} reads Dark`)
  // nothing else moves
  deepEqual(on.restoredThemeSelection({ mode: 'auto', palette_mode: 'dark' }), { mode: 'auto' }, 'Auto drops it as before')
  deepEqual(on.restoredThemeSelection({ mode: 'custom', primary_hex: '#1e40af', palette_mode: 'both' }), { mode: 'custom', primary_hex: '#1e40af', palette_mode: 'both' }, 'custom keeps its own mode as before')
  // the restore's fingerprint equals the one the panel's own selection has, so re-applying the restored theme is not a change
  const panelMade = builder.selectCanonicalThemePreset(preset('minimal', 'dark'), 'vibrant')
  check(assert.equal, builder.themeSelectionFingerprint(on.restoredThemeSelection(preset('vibrant', 'dark'))), builder.themeSelectionFingerprint(panelMade), 'the restored selection has the panel-made fingerprint')
  // the never-picked rule is untouched
  deepEqual(on.restoredAdoptedSelection({ request_id: 'restore:s1:none', theme: preset('vibrant', 'dark') }), { mode: 'auto' }, 'never picked: still Auto')
  deepEqual(on.restoredAdoptedSelection({ request_id: 'restore:s1:req-1', theme: preset('vibrant', 'dark') }), preset('vibrant', 'dark'), 'a real pick: kept with its mode')
  // flag off (every spelling, either flag alone): exactly what the restore returned before
  for (const env of [{}, { [PERSIST]: 'true' }, { [TOGGLE]: 'true' }, { [TOGGLE]: 'true', [PERSIST]: 'TRUE' }, { [TOGGLE]: 'false', [PERSIST]: 'true' }, { [TOGGLE]: '1', [PERSIST]: 'true' }]) {
    const w = lib(env)
    for (const theme of RESTORE) {
      const got = w.restoredThemeSelection(theme)
      const expected = off.restoredThemeSelection(theme)
      check(assert.equal, ser(got), ser(expected), `flag off ${ser(env)}: ${ser(theme)}`)
      if (theme && theme.mode === 'preset') check(assert.equal, got === null || !('palette_mode' in got), true, 'a preset comes back without palette_mode')
    }
  }
}

// ---------------------------------------------------------------- the page: stored selection, stored profile, quick picks
function pageSuite(overrides = {}) {
  const on = createPage(ON, overrides)

  // the stored selection and the stored saved-theme profile (a session reload)
  for (const mode of ['light', 'dark']) {
    const stored = preset('vibrant', mode, { color_overrides: { a: '#111111' } })
    deepEqual(on.normalizeStoredBuildThemeSelection(JSON.parse(JSON.stringify(stored))), preset('vibrant', mode), `a stored ${mode} preset survives the reload`)
    const profile = { id: 'p1', name: 'My dark', theme_payload: preset('vibrant', mode) }
    deepEqual(on.normalizeStoredBuildThemeProfile(JSON.parse(JSON.stringify(profile))), profile, `a stored saved theme holding ${mode} keeps it`)
  }
  deepEqual(on.normalizeStoredBuildThemeProfile({ id: 'p1', name: 'n', theme_payload: preset('vibrant', 'dark', { extra: true, color_overrides: { a: '#111111' } }) }), { id: 'p1', name: 'n', theme_payload: preset('vibrant', 'dark') }, 'the stored saved theme goes through the same normaliser as the selection')
  deepEqual(on.normalizeStoredBuildThemeProfile({ id: 'p1', name: 'n', theme_payload: preset('vibrant', 'both') }), { id: 'p1', name: 'n', theme_payload: preset('vibrant') }, 'a stored saved theme holding "both" on a preset drops it')
  deepEqual(on.normalizeStoredBuildThemeSelection(preset('vibrant', 'both')), preset('vibrant'), 'a stored "both" on a preset is dropped')
  deepEqual(on.normalizeStoredBuildThemeSelection(preset('corporate_dark', 'light')), preset('corporate_dark', 'dark'), 'a stored Light on a dark-only preset reads Dark')
  deepEqual(on.normalizeStoredBuildThemeSelection(preset('vibrant')), preset('vibrant'), 'nothing stored, nothing added')
  deepEqual(on.normalizeStoredBuildThemeSelection(custom('#112233', 'both')), custom('#112233', 'both'), 'custom is unchanged')
  check(assert.equal, ser(on.normalizeStoredBuildThemeSelection(preset('vibrant', 'dark'))), ser({ mode: 'preset', preset_id: 'vibrant', palette_mode: 'dark' }), 'key order mode, preset_id, palette_mode')
  // the session options round trip: write exactly as the page does (JSON), read back, the profile still matches the selection
  const selection = preset('vibrant', 'dark'), profile = { id: 'p1', name: 'My dark', theme_payload: preset('vibrant', 'dark') }
  const back = { selection: on.normalizeStoredBuildThemeSelection(JSON.parse(JSON.stringify(selection))), profile: on.normalizeStoredBuildThemeProfile(JSON.parse(JSON.stringify(profile))) }
  check(assert.equal, on.buildThemeProfileMatchesSelection(back.profile, back.selection), true, 'after a reload the saved theme still matches the selection')
  // without the flag the same reload loses it (the gap)
  const off = createPage({}, overrides)
  deepEqual(off.normalizeStoredBuildThemeSelection(JSON.parse(JSON.stringify(selection))), preset('vibrant'), 'flag off: the reload drops Dark, as before')

  // quick picks through handleBuildThemeChange
  const dark = preset('minimal', 'dark')
  {
    const page = on.pageWith({ selection: dark })
    page.pick(preset('vibrant'))
    deepEqual(page.state.selection, preset('vibrant', 'dark'), 'preset chip keeps Dark')
    check(assert.equal, page.state.selectionWrites.length, 1, 'one write')
    check(assert.equal, page.state.saves, 1, 'the session is saved on first action as before')
    check(assert.equal, page.state.localPick, true, 'it still counts as the user\'s own pick')
  }
  {
    const page = on.pageWith({ selection: dark })
    page.pick(custom('#336699'))
    deepEqual(page.state.selection, custom('#336699', 'dark'), 'brand colour keeps Dark')
  }
  {
    const saved = preset('executive')
    const active = { id: 's1', name: 'Saved', theme_payload: saved }
    const page = on.pageWith({ selection: dark, profile: active })
    page.pick(saved)
    deepEqual(page.state.selection, preset('executive', 'dark'), 'a saved preset theme keeps Dark')
    check(assert.notEqual, page.state.profile, null, 'the saved theme stays the active one')
    deepEqual(page.state.profile, { id: 's1', name: 'Saved', theme_payload: preset('executive', 'dark') }, 'and holds the payload that matches the selection')
    check(assert.equal, on.buildThemeProfileMatchesSelection(page.state.profile, page.state.selection), true, 'the active saved theme matches the selection')
    check(assert.equal, ser(active.theme_payload), ser(saved), 'the saved theme\'s own payload is not mutated')
  }
  {
    const savedCustom = custom('#336699')
    const page = on.pageWith({ selection: dark, profile: { id: 's2', name: 'Brand', theme_payload: savedCustom } })
    page.pick(savedCustom)
    deepEqual(page.state.selection, custom('#336699', 'dark'), 'a saved custom theme keeps Dark')
    check(assert.equal, on.buildThemeProfileMatchesSelection(page.state.profile, page.state.selection), true, 'a saved custom theme stays the active one (the custom match compares the mode)')
  }
  {
    const saved = preset('executive', 'light')
    const page = on.pageWith({ selection: dark, profile: { id: 's3', name: 'Light one', theme_payload: saved } })
    page.pick(saved)
    deepEqual(page.state.selection, saved, 'a saved theme that holds Light keeps Light')
    check(assert.strictEqual, page.state.selection, saved, 'the very same object')
    check(assert.notEqual, page.state.profile, null, 'and stays the active one')
  }
  {
    const page = on.pageWith({ selection: dark, profile: { id: 's1', name: 'Saved', theme_payload: preset('executive') } })
    page.pick(custom('#336699'))
    check(assert.equal, page.state.profile, null, 'a pick that is not the active saved theme still clears it')
  }
  for (const id of DARK_ONLY) {
    const page = on.pageWith({ selection: preset('minimal', 'light') })
    page.pick(preset(id))
    deepEqual(page.state.selection, preset(id, 'dark'), `${id} over Light ends on Dark`)
  }
  {
    const page = on.pageWith({ selection: preset('corporate_dark', 'dark') })
    page.pick(preset('minimal'))
    deepEqual(page.state.selection, preset('minimal', 'dark'), 'from a dark-only preset to a normal one keeps the Dark that was written')
  }
  {
    const page = on.pageWith({ selection: dark })
    const auto = { mode: 'auto' }
    page.pick(auto)
    check(assert.strictEqual, page.state.selection, auto, 'Auto is a reset: the very same object, no mode')
  }
  {
    const plainSelection = preset('minimal')
    const page = on.pageWith({ selection: plainSelection })
    const next = preset('vibrant')
    page.pick(next)
    check(assert.strictEqual, page.state.selection, next, 'nothing chosen: the pick, untouched')
  }
  {
    const explicit = preset('vibrant', 'light')
    const page = on.pageWith({ selection: dark })
    page.pick(explicit)
    check(assert.strictEqual, page.state.selection, explicit, 'a pick that names its mode (the panel\'s Apply) is not changed')
  }
  {
    const page = on.pageWith({ selection: dark, locked: true })
    page.pick(preset('vibrant'))
    check(assert.equal, page.state.selectionWrites.length, 0, 'locked: nothing is written')
    check(assert.equal, page.state.saves, 0, 'locked: nothing is saved')
    check(assert.equal, page.state.toasts.length, 1, 'locked: the lock notice')
    check(assert.equal, page.state.localPick, false, 'locked: not a pick')
  }
  {
    const page = on.pageWith({ selection: preset('minimal', 'both') })
    page.pick(preset('vibrant'))
    deepEqual(page.state.selection, preset('vibrant'), 'a "both" held by the current selection is not carried')
  }
}

// ---------------------------------------------------------------- flag off is the base: the outputs over a corpus hash to the values printed from the base sources
const OFF_ENVS = [{}, { [PERSIST]: 'true' }, { [TOGGLE]: 'true' }, { [TOGGLE]: 'true', [PERSIST]: 'TRUE' }, { [TOGGLE]: 'false', [PERSIST]: 'true' }, { [TOGGLE]: '1', [PERSIST]: 'true' }, { [TOGGLE]: 'true', [PERSIST]: 'false' }]
function offOutputs(env, overrides = {}) {
  const page = createPage(env, overrides)
  const restore = createWorld({ env, overrides }).load(FILES.restore)
  const out = { stored: [], profile: [], equal: [], restore: [], restored: [], picks: [] }
  for (const value of STORED) {
    out.stored.push(ser(page.normalizeStoredBuildThemeSelection(JSON.parse(JSON.stringify(value ?? null)))))
    out.profile.push(ser(page.normalizeStoredBuildThemeProfile(JSON.parse(JSON.stringify({ id: 'p', name: 'n', theme_payload: value ?? null })))))
  }
  for (const a of STORED.filter(Boolean).map(value => page.normalizeStoredBuildThemeSelection(value))) for (const b of CURRENTS) out.equal.push(page.buildThemeSelectionsEqual(a, b))
  for (const theme of RESTORE) out.restore.push(ser(restore.restoredThemeSelection(theme)))
  for (const theme of RESTORE) out.restored.push(ser(restore.restoredAdoptedSelection({ request_id: 'restore:s:req-1', theme })), ser(restore.restoredAdoptedSelection({ request_id: 'restore:s:none', theme })))
  for (const current of CURRENTS) for (const pick of PICKS) for (const withProfile of [false, true]) {
    const instance = page.pageWith({ selection: current, profile: withProfile ? { id: 'p', name: 'n', theme_payload: pick } : null })
    instance.pick(pick)
    out.picks.push(ser({ selection: instance.state.selection, same: instance.state.selection === pick, profile: instance.state.profile, profileSame: instance.state.profile?.theme_payload === pick, writes: instance.state.selectionWrites.length, saves: instance.state.saves, local: instance.state.localPick }))
  }
  return Object.fromEntries(Object.entries(out).map(([key, list]) => [key, sha(JSON.stringify(list))]))
}
// printed from the base sources (studio-v4-dev-preparation-code @ 80dfde4, the merge of #416): DARK_PERSIST_ROOT=<base checkout> PRINT_GOLDEN=1 node scripts/test-studio-theme-dark-persist.mjs
const GOLDEN = {
  stored: '065d194f17501077e485f2cc05740d60a9951c08169b40895e6d8def2cadd5cd',
  profile: '932c7ca1d5cd8be5919380b16c11e608c0cfd13687c0b8134bd45188691996d4',
  equal: '4b38e9a5c755bb00818846fd05d5106e090505423637a98451197301e341d366',
  restore: 'e808de05a1e99c3763e97cdeb94735a4a02c78dfd6f457073b83d8bdf7e2d4b1',
  restored: '1aa4e6ae31f2d1fcead5ecba881fd946c9057b4280d62c5d4bd39158a4323cd2',
  picks: '70c07f3143a87fd7f825307b4e263504f4ffdcfb81712bc7e6582c06cf851663',
}
function offSuite(overrides = {}) {
  for (const env of OFF_ENVS) {
    const got = offOutputs(env, overrides)
    for (const key of Object.keys(GOLDEN)) check(assert.equal, got[key], GOLDEN[key], `flag off ${JSON.stringify(env)}: ${key} equals the base`)
  }
}

// ---------------------------------------------------------------- where it goes (source pins)
function pinSuite(sources = {}) {
  const src = key => sources[key] ?? read(FILES[key])
  const env = sources.env ?? read('.env.example')
  const pkg = sources.pkg ?? read('package.json')
  const lib = src('lib'), restore = src('restore'), page = src('page'), chat = src('chat')
  const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  // the flag is read in ONE function of the helper, from its two literals, and nowhere else
  check(assert.match, lib, /export function darkPersistEnabled\(darkModeRaw: string \| undefined, persistRaw: string \| undefined\): boolean \{\n  return themeDarkModeEnabled\(darkModeRaw\) && persistRaw === 'true'\n\}/, 'both literals, exact "true"')
  check(assert.match, lib, /function readDarkPersistFlag\(\): boolean \{\n  try \{\n    return darkPersistEnabled\(process\.env\.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED, process\.env\.NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST\)\n  \} catch \{\n    return false\n  \}\n\}/, 'the flag is read in one function')
  check(assert.equal, [...code(lib).matchAll(/process\.env/g)].length, 2, 'the helper reads exactly the two literals')
  check(assert.match, lib, /export const THEME_DARK_PERSIST = readDarkPersistFlag\(\)/)
  check(assert.doesNotMatch, code(lib).replace(/function readDarkPersistFlag\(\)[\s\S]*?\n\}\n/, ''), /^\s*import\b|\brequire\s*\(|\bprocess\b/m, 'the helper stays import-free and reads no other env')
  for (const rel of ['app', 'components', 'hooks', 'lib', 'types']) {
    const walk = dir => fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)])
    for (const file of walk(rel).filter(item => /\.(tsx?|css)$/.test(item) && item !== FILES.lib)) {
      const text = sources[`file:${file}`] ?? fs.readFileSync(path.join(repoRoot, file), 'utf8')
      check(assert.doesNotMatch, code(text), /process\.env\.NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST|THEME_DARK_PERSIST/, `${file} does not read the flag (only the helper does)`)
    }
  }

  // the page: two helpers, three sites, and the restore call is the base's
  check(assert.match, page, /import \{ carryPaletteMode, presetPaletteModeField \} from '@\/lib\/studio-theme-dark-toggle'/, 'the page imports the two helpers')
  check(assert.equal, [...page.matchAll(/studio-theme-dark-toggle/g)].length, 1, 'one import')
  check(assert.match, page, /\? \{ mode: 'preset', preset_id: raw\.preset_id, \.\.\.presetPaletteModeField\(raw\), \.\.\.themeFontFields\(raw\) \}/, 'the stored preset keeps its mode (before the fonts)')
  check(assert.match, page, /const carried = carryPaletteMode\(next, buildThemeSelectionRef\.current\)\n/, 'a pick is carried against the committed selection')
  check(assert.match, page, /buildThemeProfileMatchesSelection\(current, next\) \? \(current && carried !== next \? \{ \.\.\.current, theme_payload: carried \} : current\) : null/, 'the match is made on the pick; the active saved theme then holds the carried payload')
  check(assert.match, page, /themeSelectionChangedLocallyRef\.current = true\n    setBuildThemeSelection\(carried\)\n  \}, \[toast, saveSessionOnFirstAction\]\)/, 'the carried selection is what is stored; the dependency list is the base\'s')
  check(assert.ok, page.indexOf('const carried = carryPaletteMode(') > page.indexOf('const handleBuildThemeChange = useCallback') && page.indexOf('const carried = carryPaletteMode(') < page.indexOf('setBuildThemeSelection(carried)'), 'carry before write')
  check(assert.match, page, /const selection = restoredAdoptedSelection\(restore\)\n/, 'the Director restore call is the base\'s (the flag lives in the helper)')
  check(assert.equal, [...page.matchAll(/palette_mode/g)].length, 7, 'the page still mentions palette_mode only where the base did (7)')
  check(assert.doesNotMatch, code(page), /THEME_DARK_PERSIST|THEME_DARK_MODE|process\.env\.NEXT_PUBLIC_STUDIO_THEME_DARK/, 'the page holds no flag of its own')
  check(assert.doesNotMatch, page, /buildThemeSelectionsEqual\([^)]*\)[^\n]*carryPaletteMode|presetPaletteModesEqual/, 'the profile match is the base\'s')
  const equalAt = page.indexOf('function buildThemeSelectionsEqual')
  check(assert.match, page.slice(equalAt, equalAt + 400), /if \(a\.mode === 'preset'\) return a\.preset_id === b\.preset_id && themeFontsEqual\(a, b\)\n/, 'the preset match ignores the mode, as before')

  // the restore helper: one import, one spread, before the overrides
  check(assert.match, restore, /import \{ presetPaletteModeField \} from '@\/lib\/studio-theme-dark-toggle'/, 'the restore imports one helper')
  check(assert.match, restore, /preset_id: theme\.preset_id,\n      \.\.\.presetPaletteModeField\(theme\),\n      \.\.\.\(overrides \? \{ color_overrides: overrides \} : \{\}\),\n      \.\.\.fonts,/, 'the preset keeps its mode before the overrides and fonts')
  check(assert.doesNotMatch, code(restore), /palette_mode: theme\.palette_mode|THEME_DARK/, 'the restore holds no flag of its own')
  check(assert.match, restore, /export function restoredAdoptedSelection\(payload: ThemeRestorePayload\): BuildThemeSelection \| null \{/, 'the restore signatures are the base\'s')
  check(assert.match, restore, /export function restoredThemeSelection\(theme: unknown\): BuildThemeSelection \| null \{/)

  // the composer does not know the feature: chat-input.tsx carries nothing of it (a pin on it freezes it to the base commit)
  check(assert.doesNotMatch, chat, /studio-theme-dark-toggle|carryPaletteMode|presetPaletteModeField|THEME_DARK/, 'chat-input.tsx is untouched')

  // the strip that sibling pins use (scripts/studio-theme-dark-persist-strip.mjs) takes out exactly what this change added to the page and the restore helper
  for (const key of ['page', 'restore']) {
    const base = baseSource(FILES[key])
    if (base === null) console.log(`  SKIP ${FILES[key]} without this change is ${BASE_COMMIT}'s: the commit is not in this clone`)
    else check(assert.equal, stripDarkPersist(FILES[key], src(key)), base, `${FILES[key]} without this change is ${BASE_COMMIT}'s (the strip the sibling pins use)`)
  }
  check(assert.equal, stripDarkPersist(FILES.chat, chat), chat, 'the strip leaves every other file alone')
  for (const sibling of ['studio-first-run-poster-hide', 'studio-rail-add-slide', 'studio-welcome-polish'])
    check(assert.match, fs.readFileSync(path.join(repoRoot, `scripts/test-${sibling}.mjs`), 'utf8'), /stripDarkPersist\(/, `scripts/test-${sibling}.mjs strips this change before comparing the page with its base`)

  // documented, default off, registered
  check(assert.match, env, /^NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST="false"$/m, '.env.example documents the flag, default "false"')
  check(assert.match, env, /only while NEXT_PUBLIC_THEME_DARK_MODE_ENABLED is "true" too/, 'and says it needs the toggle')
  check(assert.equal, JSON.parse(pkg).scripts['test:studio-theme-dark-persist'], 'node scripts/test-studio-theme-dark-persist.mjs', 'registered')
}

async function fullSuite(overrides = {}, suites = ['pure', 'restore', 'page', 'off', 'pins'], pinSources = {}) {
  if (suites.includes('pure')) pureSuite(overrides)
  if (suites.includes('restore')) restoreSuite(overrides)
  if (suites.includes('page')) pageSuite(overrides)
  if (suites.includes('off')) offSuite(overrides)
  if (suites.includes('pins')) pinSuite(pinSources)
}

if (process.env.PRINT_GOLDEN) {
  const results = OFF_ENVS.map(env => offOutputs(env))
  for (const [index, got] of results.entries()) assert.deepStrictEqual(got, results[0], `the base does not depend on the env (${JSON.stringify(OFF_ENVS[index])})`)
  console.log(JSON.stringify(results[0], null, 2))
  process.exit(0)
}

await fullSuite()

// ---------------------------------------------------------------- mutation check: every mutant must be caught
// [name, file key, from, to, suites to run]
const mutants = [
  // the flag
  ['flag: the persist literal is loosened', 'lib', "persistRaw === 'true'", "persistRaw !== 'false'", ['pure']],
  ['flag: the toggle is not required', 'lib', "return themeDarkModeEnabled(darkModeRaw) && persistRaw === 'true'", "return persistRaw === 'true'", ['pure']],
  ['flag: either one is enough', 'lib', "return themeDarkModeEnabled(darkModeRaw) && persistRaw === 'true'", "return themeDarkModeEnabled(darkModeRaw) || persistRaw === 'true'", ['pure']],
  ['flag: on by default', 'lib', "return themeDarkModeEnabled(darkModeRaw) && persistRaw === 'true'", 'return true', ['pure', 'off']],
  ['flag: the module reads the wrong variable', 'lib', 'process.env.NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST)', 'process.env.NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST_X)', ['pure', 'pins']],
  ['flag: the module reads the toggle twice', 'lib', 'darkPersistEnabled(process.env.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED, process.env.NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST)', 'darkPersistEnabled(process.env.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED, process.env.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED)', ['pure']],
  ['flag: a missing process throws', 'lib', '  } catch {\n    return false\n  }\n}\n\nexport const THEME_DARK_PERSIST', '  } finally {\n  }\n}\n\nexport const THEME_DARK_PERSIST', ['pure', 'pins']],
  ['flag: the default argument is off', 'lib', 'flagOn: boolean = THEME_DARK_PERSIST): T {', 'flagOn: boolean = false): T {', ['pure']],
  ['flag: the default argument is on', 'lib', 'flagOn: boolean = THEME_DARK_PERSIST): T {', 'flagOn: boolean = true): T {', ['pure', 'off']],
  ['flag: the field default is off', 'lib', "source: { palette_mode?: unknown; preset_id?: unknown } | null | undefined, flagOn: boolean = THEME_DARK_PERSIST)", "source: { palette_mode?: unknown; preset_id?: unknown } | null | undefined, flagOn: boolean = false)", ['pure']],
  ['flag: the field default is on', 'lib', "source: { palette_mode?: unknown; preset_id?: unknown } | null | undefined, flagOn: boolean = THEME_DARK_PERSIST)", "source: { palette_mode?: unknown; preset_id?: unknown } | null | undefined, flagOn: boolean = true)", ['pure', 'off']],
  // carryPaletteMode
  ['carry: flag off still carries', 'lib', '  if (!flagOn) return picked\n  const chosen', '  const chosen', ['pure', 'off']],
  ['carry: flag on never carries', 'lib', "const inherits = picked.mode !== 'auto' && picked.palette_mode == null", "const inherits = false && picked.palette_mode == null", ['pure', 'page']],
  ['carry: Auto takes the mode', 'lib', "picked.mode !== 'auto' && picked.palette_mode == null", 'picked.palette_mode == null', ['pure', 'page']],
  ['carry: a pick that names its mode is overwritten', 'lib', "picked.mode !== 'auto' && picked.palette_mode == null", "picked.mode !== 'auto'", ['pure', 'page']],
  ['carry: "both" is carried', 'lib', "(chosen === 'light' || chosen === 'dark')", "(chosen === 'light' || chosen === 'dark' || chosen === 'both')", ['pure', 'page']],
  ['carry: Light is not carried', 'lib', "(chosen === 'light' || chosen === 'dark')", "(chosen === 'dark')", ['pure']],
  ['carry: Dark is not carried', 'lib', "(chosen === 'light' || chosen === 'dark')", "(chosen === 'light')", ['pure', 'page']],
  ['carry: always Dark', 'lib', '{ ...picked, palette_mode: chosen }', "{ ...picked, palette_mode: 'dark' }", ['pure']],
  ['carry: the dark-only clamp is gone', 'lib', 'return clampDarkOnlyPaletteMode(inherits ? { ...picked, palette_mode: chosen } : picked, flagOn)', 'return inherits ? { ...picked, palette_mode: chosen } : picked', ['pure', 'page']],
  ['carry: the clamp is skipped for a pick that carries its own mode', 'lib', 'return clampDarkOnlyPaletteMode(inherits ? { ...picked, palette_mode: chosen } : picked, flagOn)', 'return inherits ? clampDarkOnlyPaletteMode({ ...picked, palette_mode: chosen }, flagOn) : picked', ['pure']],
  ['carry: the current selection is mutated', 'lib', '{ ...picked, palette_mode: chosen }', '(picked.palette_mode = chosen, picked)', ['pure', 'page']],
  ['carry: a copy is made even when nothing is carried', 'lib', ': picked, flagOn)\n}', ': { ...picked }, flagOn)\n}', ['pure']],
  ['carry: reads the pick instead of the current selection', 'lib', 'const chosen = current?.palette_mode', 'const chosen = picked.palette_mode', ['pure', 'page']],
  // presetPaletteModeField
  ['field: flag off keeps the mode', 'lib', '  if (!flagOn) return {}\n  const mode = source?.palette_mode', '  const mode = source?.palette_mode', ['pure', 'off']],
  ['field: flag on keeps nothing', 'lib', "if (mode !== 'light' && mode !== 'dark') return {}", 'return {}', ['pure', 'restore', 'page']],
  ['field: "both" is kept', 'lib', "if (mode !== 'light' && mode !== 'dark') return {}", "if (mode !== 'light' && mode !== 'dark' && mode !== 'both') return {}", ['pure', 'restore', 'page']],
  ['field: any string is kept', 'lib', "if (mode !== 'light' && mode !== 'dark') return {}", "if (typeof mode !== 'string') return {}", ['pure', 'restore', 'page']],
  ['field: Light is dropped', 'lib', "if (mode !== 'light' && mode !== 'dark') return {}", "if (mode !== 'dark') return {}", ['pure', 'restore', 'page']],
  ['field: the dark-only clamp is gone', 'lib', "return { palette_mode: isDarkOnlyPreset({ mode: 'preset', preset_id: source?.preset_id }) ? 'dark' : mode }", 'return { palette_mode: mode }', ['pure', 'restore', 'page']],
  ['field: every preset reads Dark', 'lib', "return { palette_mode: isDarkOnlyPreset({ mode: 'preset', preset_id: source?.preset_id }) ? 'dark' : mode }", "return { palette_mode: 'dark' }", ['pure', 'restore', 'page']],
  ['field: custom colours count as presets', 'lib', "isDarkOnlyPreset({ mode: 'preset', preset_id: source?.preset_id })", "isDarkOnlyPreset({ mode: 'preset', preset_id: source?.preset_id ?? 'corporate_dark' })", ['pure']],
  // the Director restore
  ['restore: the preset drops the mode', 'restore', '      ...presetPaletteModeField(theme),\n', '', ['restore', 'off', 'pins']],
  ['restore: the mode is read from the wrong place', 'restore', '...presetPaletteModeField(theme),', '...presetPaletteModeField(overrides),', ['restore', 'pins']],
  ['restore: the mode comes after the overrides', 'restore', '      ...presetPaletteModeField(theme),\n      ...(overrides ? { color_overrides: overrides } : {}),', '      ...(overrides ? { color_overrides: overrides } : {}),\n      ...presetPaletteModeField(theme),', ['restore', 'pins']],
  ['restore: the flag is forced on for the restore', 'restore', '...presetPaletteModeField(theme),', '...presetPaletteModeField(theme, true),', ['restore', 'off', 'pins']],
  ['restore: the mode is kept on Auto', 'restore', "if (theme.mode === 'auto') return { mode: 'auto', ...fonts }", "if (theme.mode === 'auto') return { mode: 'auto', ...presetPaletteModeField(theme, true), ...fonts }", ['restore']],
  ['restore: the never-picked rule keeps the stored theme', 'restore', "return isNeverPickedRestore(payload) ? { mode: 'auto' } : stored", 'return stored', ['restore']],
  ['restore: a custom palette loses its mode', 'restore', 'if (palette) next.palette_mode = palette', '', ['restore']],
  // the page: stored selection
  ['page: the stored preset drops the mode', 'page', '...presetPaletteModeField(raw), ...themeFontFields(raw)', '...themeFontFields(raw)', ['page', 'off', 'pins']],
  ['page: the stored preset keeps the mode with the flag off', 'page', '...presetPaletteModeField(raw), ...themeFontFields(raw)', '...(raw.palette_mode === \'dark\' ? { palette_mode: raw.palette_mode } : {}), ...themeFontFields(raw)', ['off', 'pins']],
  ['page: the stored preset keeps the mode after the fonts', 'page', '...presetPaletteModeField(raw), ...themeFontFields(raw)', '...themeFontFields(raw), ...presetPaletteModeField(raw)', ['page', 'pins']],
  ['page: the stored profile bypasses the normaliser', 'page', 'const themePayload = normalizeStoredBuildThemeSelection(raw.theme_payload)', 'const themePayload = (raw.theme_payload as BuildThemeSelection)', ['page']],
  ['page: the stored profile drops the mode', 'page', 'const themePayload = normalizeStoredBuildThemeSelection(raw.theme_payload)', "const themePayload = { ...normalizeStoredBuildThemeSelection(raw.theme_payload), palette_mode: undefined }", ['page']],
  ['page: the preset match compares the mode', 'page', 'return a.preset_id === b.preset_id && themeFontsEqual(a, b)\n', "return a.preset_id === b.preset_id && themeFontsEqual(a, b) && a.palette_mode === b.palette_mode\n", ['pins', 'off']],
  // the page: quick picks
  ['page: the pick is stored as it came', 'page', 'setBuildThemeSelection(carried)\n  }, [toast, saveSessionOnFirstAction])', 'setBuildThemeSelection(next)\n  }, [toast, saveSessionOnFirstAction])', ['page', 'pins']],
  ['page: the carry reads the pick, not the committed selection', 'page', 'carryPaletteMode(next, buildThemeSelectionRef.current)', 'carryPaletteMode(next, next)', ['page', 'pins']],
  ['page: the carry reads nothing', 'page', 'carryPaletteMode(next, buildThemeSelectionRef.current)', 'carryPaletteMode(next, null)', ['page', 'pins']],
  ['page: the active saved theme keeps its old payload', 'page', '(current && carried !== next ? { ...current, theme_payload: carried } : current)', 'current', ['page', 'pins']],
  ['page: the active saved theme is dropped on a carry', 'page', '(current && carried !== next ? { ...current, theme_payload: carried } : current)', '(carried !== next ? null : current)', ['page', 'pins']],
  ['page: the match is made on the carried pick', 'page', 'buildThemeProfileMatchesSelection(current, next) ? (current', 'buildThemeProfileMatchesSelection(current, carried) ? (current', ['page', 'pins']],
  ['page: the active profile is rewritten even with nothing carried', 'page', '(current && carried !== next ? { ...current, theme_payload: carried } : current)', '(current ? { ...current, theme_payload: carried } : current)', ['off', 'pins']],
  ['page: the lock is checked after the carry', 'page', "    saveSessionOnFirstAction()\n    // NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST:", "    setBuildThemeSelection(carryPaletteMode(next, buildThemeSelectionRef.current))\n    saveSessionOnFirstAction()\n    // NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST:", ['page']],
  ['page: the callback depends on the selection', 'page', '}, [toast, saveSessionOnFirstAction])\n\n  const handleActiveBuildThemeProfileChange', '}, [toast, saveSessionOnFirstAction, buildThemeSelection])\n\n  const handleActiveBuildThemeProfileChange', ['pins']],
  ['page: the page reads the flag itself', 'page', 'const THEME_SYNC_TIMEOUT_MS = 20_000', "const THEME_SYNC_TIMEOUT_MS = 20_000\nconst THEME_DARK_PERSIST = process.env.NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST === 'true'", ['pins']],
  ['page: the Director restore call is changed', 'page', 'const selection = restoredAdoptedSelection(restore)\n', 'const selection = restoredAdoptedSelection(restore, true)\n', ['pins']],
  ['page: a second import of the helper file', 'page', "import { carryPaletteMode, presetPaletteModeField } from '@/lib/studio-theme-dark-toggle'\n", "import { carryPaletteMode, presetPaletteModeField } from '@/lib/studio-theme-dark-toggle'\nimport { clampDarkOnlyPaletteMode } from '@/lib/studio-theme-dark-toggle'\n", ['pins']],
  // the composer
  ['composer: chat-input imports the helper', 'chat', "import type { ActionRequest } from \"@/hooks/use-deckster-websocket-v2\"\n", "import type { ActionRequest } from \"@/hooks/use-deckster-websocket-v2\"\nimport { carryPaletteMode } from '@/lib/studio-theme-dark-toggle'\n", ['pins']],
  // documentation
  ['env: documented on', 'env', 'NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST="false"', 'NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST="true"', ['pins']],
  ['env: not documented', 'env', 'NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST="false"', '', ['pins']],
  ['env: the toggle is not mentioned', 'env', 'only while NEXT_PUBLIC_THEME_DARK_MODE_ENABLED is "true" too', 'always', ['pins']],
  ['package: script not registered', 'pkg', '"test:studio-theme-dark-persist": "node scripts/test-studio-theme-dark-persist.mjs"', '"test:studio-theme-dark-persist-x": "node scripts/test-studio-theme-dark-persist.mjs"', ['pins']],
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
  try { await fullSuite(overrides, suites, pinSources) } catch (error) {
    threw = true
    if (process.env.DARK_PERSIST_VERBOSE) console.log(`caught  ${name}  <-  ${error.name}: ${String(error.message).split('\n')[0].slice(0, 110)}`)
  }
  checks = seen
  if (threw) caught++
  else survivors.push(name)
}
deepEqual(invalid, [], 'every mutant must be valid code')
deepEqual(survivors, [], `mutants survived: ${survivors.join(' | ')}`)
check(assert.equal, caught, mutants.length)

console.log(`studio-theme-dark-persist: ${checks} checks passed, ${caught} mutants caught`)
