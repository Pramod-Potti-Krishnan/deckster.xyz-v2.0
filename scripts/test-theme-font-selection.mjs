// J4-FONTS, Studio half: NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED (literal "true", default off).
// Theme Builder !52 and Director !466 are the backend contract: the eight families, and the two optional
// fields `font_family` (body) and `font_family_heading` (heading) in `data.theme`, absent when not chosen.
//
// Offline: the actual lib, hook, workspace, preview, panel, builder-page functions and the WebSocket
// user_message constructor run in a vm; the only "services" are a local Director emulator and stubs.
//  1. Flag off is the base build (30c9fc9). Outputs of the working tree are compared with
//     fixtures/theme-font-selection/flag-off-base-30c9fc9.json, captured once from a pristine checkout of the
//     base commit (THEME_FONT_BASE_ROOT=<dir> THEME_FONT_CAPTURE=1), so this test needs no git history.
//  2. Flag on, colour-only inputs: the same fixture still holds (the pickers are the only difference).
//  3. Flag on with fonts: create -> save -> reload -> pick -> standard -> `data.theme` carries both fonts.
//  4. Mutation check: each rule below is broken in the source in turn and the suite must notice.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const FLAG = 'NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED'
const treeRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const fixtureFile = fileURLToPath(new URL('./fixtures/theme-font-selection/flag-off-base-30c9fc9.json', import.meta.url))
const FAMILIES = ['Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 'Lora']
const plain = value => JSON.parse(JSON.stringify(value))
// Like JSON, but a key whose value is undefined stays visible, so a changed key set cannot hide.
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
let checks = 0
const ok = name => { checks++; if (process.env.THEME_FONT_VERBOSE) console.log('PASS ' + name) }

// ── module loader: transpile repo files and run them in a vm ─────────────────────────────────────────
function createLoader(rootDir, { env = {}, stubs = {}, overrides = {}, globals = {} } = {}) {
  const cache = new Map()
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(rootDir, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return base + suffix
    return null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      const file = resolve(spec, from)
      assert.ok(file, `unresolved import ${spec} in ${path.relative(rootDir, from)}`)
      return run(file)
    }
    throw new Error(`unexpected import ${spec} in ${path.relative(rootDir, from)}`)
  }
  function run(file) {
    if (cache.has(file)) return cache.get(file)
    const text = overrides[path.relative(rootDir, file)] ?? fs.readFileSync(file, 'utf8')
    const mod = { exports: {} }
    cache.set(file, mod.exports)
    const out = ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    vm.runInNewContext(out, { module: mod, exports: mod.exports, process: { env }, URLSearchParams, console, ...globals, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return { load: rel => run(path.join(rootDir, rel)), has: rel => fs.existsSync(path.join(rootDir, rel)) }
}

// ── a small hooks runtime: stateful root component, inert children ───────────────────────────────────
const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' }
function createRuntime() {
  const cells = []
  let cursor = 0, dirty = false, inert = false
  const effects = [], childEffects = []
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
      if (inert) { childEffects.push(fn); return }
      const i = cursor++, old = cells[i]
      if (depsChanged(old, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
    useLayoutEffect() {},
    useId: () => 'local-id',
    createContext: () => ({}),
    useContext: () => null,
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
    react, childEffects,
    // Render the root until its state settles; child components are expanded with inert hooks.
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
const labelled = (tree, start) => flat(tree).find(node => node.type === 'label' && text(node).startsWith(start))
const selectIn = (tree, label) => { const parent = labelled(tree, label); return parent && flat(parent).find(node => node.type === 'select') }
// What a DOM would show: false/null children vanish, handlers are not attributes, style objects become CSS text.
const escapeText = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
function markup(node) {
  if (Array.isArray(node)) return node.map(markup).join('')
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node !== 'object') return escapeText(node)
  const attributes = Object.entries(node.props ?? {}).filter(([key, value]) => key !== 'children' && typeof value !== 'function' && value !== undefined && value !== false && value !== null)
    .map(([key, value]) => value === true ? ` ${key}` : ` ${key === 'className' ? 'class' : key}="${escapeText(typeof value === 'object' ? (key === 'style' ? Object.entries(value).map(([name, item]) => `${name}:${item}`).join(';') : JSON.stringify(value)) : value)}"`).join('')
  return `<${node.type}${attributes}>${markup(node.props?.children)}</${node.type}>`
}
const button = (tree, start) => flat(tree).find(node => node.type === 'button' && text(node).startsWith(start))

// ── local Director: the profile routes' behaviour, per MR !466 ────────────────────────────────────────
function createDirector({ fonts = true, allowed = FAMILIES } = {}) {
  const profiles = []
  const requests = []
  let standardId = null
  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
  const keepFonts = payload => {
    const out = { ...payload }
    if (!fonts) { delete out.font_family; delete out.font_family_heading; return out }
    return out
  }
  const fetch = async (url, init = {}) => {
    const method = init.method || 'GET'
    requests.push({ url, method, body: init.body })
    if (url === '/api/themes' && method === 'GET') return reply(200, { themes: profiles.map(p => ({ ...p, is_standard: p.id === standardId })), count: profiles.length })
    if (url === '/api/themes/standard' && method === 'GET') { const p = profiles.find(item => item.id === standardId); return reply(200, { theme: p ? { ...p, is_standard: true } : null }) }
    if (url === '/api/themes' && method === 'POST') {
      const body = JSON.parse(init.body)
      if (fonts) for (const field of ['font_family', 'font_family_heading']) {
        const value = body.theme?.[field]
        if (value !== undefined && value !== null && !allowed.includes(value)) return reply(422, { detail: `invalid body: ${field} must be one of: ${allowed.join(', ')}` })
      }
      const profile = { id: `saved-${profiles.length + 1}`, name: body.name, description: body.description, theme_payload: keepFonts(body.theme), usage_count: 0 }
      profiles.push(profile)
      if (body.set_standard) standardId = profile.id
      return reply(200, { ...profile, is_standard: profile.id === standardId })
    }
    const standard = /^\/api\/themes\/([^/]+)\/standard$/.exec(url)
    if (standard && method === 'PUT') { standardId = decodeURIComponent(standard[1]); return reply(200, { theme: { ...profiles.find(p => p.id === standardId), is_standard: true } }) }
    if (url === '/api/themes/standard' && method === 'DELETE') { standardId = null; return reply(200, {}) }
    throw new Error(`unexpected request ${method} ${url}`)
  }
  return { fetch, requests, profiles, get standardId() { return standardId } }
}

// ── the actual WebSocket user_message constructor, extracted from the hook source ────────────────────
function userMessageBuilder(rootDir, overrides = {}) {
  const rel = 'hooks/use-deckster-websocket-v2.ts'
  const source = overrides[rel] ?? fs.readFileSync(path.join(rootDir, rel), 'utf8')
  const file = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let arrow
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'buildUserMessage') arrow = node.initializer; else if (!arrow) ts.forEachChild(node, visit) }
  visit(file)
  assert.ok(arrow, 'buildUserMessage found in the hook')
  const js = ts.transpileModule(`module.exports = ${arrow.getText(file)}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { module: { exports: null }, CHAT_DIRECTIVES: false, CHAT_MENTIONS: false, slideStructureRef: { current: null }, parseSlideMentions: () => [] }
  vm.runInNewContext(js, context)
  // The frame the socket would send for `buildSendOptions` ({ theme, ... }), exactly as JSON.stringify writes it.
  return (theme, extra = {}) => {
    Object.assign(context, { options: { theme, ...extra }, storeName: null, fileCount: 0, text: 'hello' })
    return JSON.stringify(context.module.exports())
  }
}

// ── actual functions of app/builder/page.tsx (the file itself cannot be loaded) ──────────────────────
function pageFunctions(rootDir, env, themeFontsLoader, overrides = {}) {
  const rel = 'app/builder/page.tsx'
  const source = overrides[rel] ?? fs.readFileSync(path.join(rootDir, rel), 'utf8')
  const file = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names = ['normalizeStoredBuildThemeSelection', 'stableStringifyRecord', 'buildThemeSelectionsEqual', 'buildThemeProfileMatchesSelection']
  const found = {}
  file.forEachChild(node => { if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) found[node.name.text] = node.getText(file) })
  for (const name of names) assert.ok(found[name], `${name} found in the page`)
  const js = ts.transpileModule(`${Object.values(found).join('\n')}\nmodule.exports = { ${names.join(', ')} }`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { module: { exports: null }, ...(themeFontsLoader ? { themeFontFields: themeFontsLoader.themeFontFields, themeFontsEqual: themeFontsLoader.themeFontsEqual } : {}) }
  vm.runInNewContext(js, context)
  return context.module.exports
}

// ── the corpus of colour-only inputs (today's world) ────────────────────────────────────────────────
const SELECTIONS = [
  { mode: 'auto' },
  { mode: 'preset', preset_id: 'minimal' },
  { mode: 'preset', preset_id: 'vibrant-orange', color_overrides: { accent: '#123456', primary: '#abcdef' } },
  { mode: 'preset', preset_id: 'executive', harmony_preference: 'triadic', palette_mode: 'dark' },
  { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b', tertiary_hex: '#10b981', neutral_hex: '#64748b', harmony_preference: 'auto', palette_mode: 'both' },
  { mode: 'custom', primary_hex: '#1e40af', color_overrides: { background: '#ffffff' } },
  { mode: 'custom', primary_hex: '#1E40AF', preset_id: 'pastel', palette_mode: 'light' },
  { mode: 'preset', preset_id: 'unknown-old-theme' },
]
const PRESET_IDS = ['corporate_light', 'minimal', 'vibrant', 'pastel', 'executive', 'corporate_dark', 'professional', 'no-such-theme', 'concrete_acid']
const STORED = [null, 'text', 42, {}, { mode: 'auto' }, { mode: 'preset' }, { mode: 'preset', preset_id: 'minimal' },
  { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#111111' }, extra: true },
  { mode: 'custom' }, { mode: 'custom', primary_hex: '#112233' }, { mode: 'custom', color_overrides: { primary: '#445566' } },
  { mode: 'custom', primary_hex: '#112233', harmony_preference: 'nonsense', palette_mode: 'dark', color_overrides: { x: '#000000' } },
  { mode: 'custom', secondary_hex: '#778899', tertiary_hex: '#aabbcc', neutral_hex: '#ddeeff', harmony_preference: 'triadic' }]
const PROFILES = [
  { id: 'p-1', name: 'Minimal', description: null, theme_payload: { mode: 'preset', preset_id: 'minimal' }, is_standard: false, usage_count: 2, created_at: '2026-10-01T00:00:00Z', updated_at: null },
  { id: 'p-2', name: 'Brand', theme_payload: { mode: 'custom', primary_hex: '#1e40af', secondary_hex: '#f59e0b', color_overrides: { background: '#ffffff' }, harmony_preference: 'auto', palette_mode: 'both' }, is_standard: true },
]
const PANEL_SYNC = { status: 'idle', requestId: null, presentationId: null, themeFingerprint: null, error: null }

// ── observations of one source root under one environment ────────────────────────────────────────────
async function observe(rootDir, env) {
  const out = {}
  // builder
  {
    const builder = createLoader(rootDir, { env }).load('lib/theme-builder.ts')
    const group = out.builder = {}
    SELECTIONS.forEach((selection, index) => {
      group[`normalize:${index}`] = ser(builder.normalizeThemePanelSelection(selection))
      group[`fingerprint:${index}`] = builder.themeSelectionFingerprint(selection)
      for (const id of PRESET_IDS) group[`select:${index}:${id}`] = ser(builder.selectCanonicalThemePreset(selection, id))
    })
  }
  // saved-profile hook: the requests it makes and what it returns
  {
    const group = out.hook = {}
    const calls = []
    let answer
    const fetch = async (url, init) => { calls.push(ser({ url, init })); const r = answer; return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.body } }
    const runtime = { useState: init => [init, () => {}], useCallback: fn => fn }
    const hook = createLoader(rootDir, { env, stubs: { react: runtime }, globals: { fetch } }).load('hooks/use-theme-profiles.ts').useThemeProfiles()
    const run = async (name, body, call) => { calls.length = 0; answer = { body }; const result = await call(); group[name] = ser({ result, calls: [...calls] }) }
    await run('list', { themes: PROFILES, count: 2 }, () => hook.listThemes())
    await run('list-empty', { themes: [], count: 0 }, () => hook.listThemes())
    await run('list-bare', {}, () => hook.listThemes())
    await run('standard', { theme: PROFILES[1] }, () => hook.getStandardTheme())
    await run('standard-none', { theme: null }, () => hook.getStandardTheme())
    for (const [index, theme] of SELECTIONS.slice(1).entries()) {
      await run(`save:${index}`, { ...PROFILES[0], theme_payload: theme }, () => hook.saveTheme({ name: `n${index}`, description: index % 2 ? 'd' : undefined, theme, setStandard: index === 3 }))
    }
    await run('set-standard', { theme: PROFILES[0] }, () => hook.setStandardTheme('a/b'))
    await run('clear-standard', {}, () => hook.clearStandardTheme())
    await run('delete', {}, () => hook.deleteTheme('p 1'))
  }
  // builder-page functions
  {
    const group = out.page = {}
    const fonts = fs.existsSync(path.join(rootDir, 'lib/theme-fonts.ts')) ? createLoader(rootDir, { env }).load('lib/theme-fonts.ts') : null
    const page = pageFunctions(rootDir, env, fonts)
    STORED.forEach((value, index) => { group[`stored:${index}`] = ser(page.normalizeStoredBuildThemeSelection(value)) })
    SELECTIONS.forEach((a, i) => SELECTIONS.forEach((b, j) => { group[`equal:${i}:${j}`] = String(page.buildThemeSelectionsEqual(a, b)); group[`match:${i}:${j}`] = String(page.buildThemeProfileMatchesSelection({ id: 'x', name: 'x', theme_payload: a }, b)) }))
    group['match:none'] = String(page.buildThemeProfileMatchesSelection(null, SELECTIONS[1]))
  }
  // the WebSocket user_message and the REST session handoff, as they go out
  {
    const group = out.wire = {}
    const build = userMessageBuilder(rootDir)
    const handoff = createLoader(rootDir, { env }).load('lib/manual-deck-workflow.ts').buildSessionHandoffRequest
    SELECTIONS.forEach((theme, index) => {
      group[`user_message:${index}`] = build(theme)
      group[`user_message-deck:${index}`] = build(theme, { deckIdentity: { main_title: 'T' }, deepResearch: true, storeName: 'store-1' })
      group[`handoff:${index}`] = JSON.stringify(handoff({ userId: 'u', idempotencyKey: 'k', pendingRequest: 'p', theme, templateMode: false, deepResearch: false, webSearch: false, useKnowledgeGraph: false, manualDeckSummary: {} }))
    })
    group['user_message:none'] = build(undefined)
  }
  // ThemePanel and the specimen, as render trees
  {
    const group = out.render = {}
    const icons = new Proxy({}, { get: (_, name) => `Icon:${String(name)}` })
    const fakeReact = { useState: init => [typeof init === 'function' ? init() : init, () => {}], useEffect() {}, useLayoutEffect() {}, useMemo: fn => fn(), useCallback: fn => fn, useRef: init => ({ current: init }), useId: () => 'id' }
    const stubs = { react: fakeReact, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, '@/components/ui/button': { Button: 'Button' }, '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9' }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') } }
    const loader = createLoader(rootDir, { env, stubs, globals: { fetch: () => { throw new Error('network refused') } } })
    const expand = (node, hooks = true) => {
      if (Array.isArray(node)) return node.map(item => expand(item))
      if (!node || typeof node !== 'object') return node
      if (typeof node.type === 'function') return expand(node.type(node.props))
      const props = {}
      for (const [key, value] of Object.entries(node.props ?? {})) props[key] = key === 'children' ? expand(value) : value
      return { type: node.type, props }
    }
    const panel = loader.load('components/theme-panel.tsx')
    const preview = loader.load('components/studio-libraries/theme-preview.tsx')
    for (const [index, selection] of [...SELECTIONS, { mode: 'preset', preset_id: 'concrete_acid' }].entries()) {
      group[`panel:${index}`] = sha(ser(expand(panel.ThemePanel({ isOpen: true, onClose() {}, presentationId: 'deck-1', buildThemeSelection: selection, themeSync: PANEL_SYNC, onBuildThemeChange() {} }))))
      for (const specimen of ['title', 'data', 'content']) group[`specimen:${index}:${specimen}`] = sha(ser(expand(preview.ThemePreview({ selection, specimen, name: 'Evergreen' }))))
    }
    group['swatches'] = sha(ser(expand(preview.ThemeSwatches({ selection: SELECTIONS[4] }))))
  }
  return out
}

// Workspace markup is compared separately: flag on, the pickers are the (only) difference.
async function observeWorkspace(rootDir, env) {
  const group = {}
  const director = createDirector()
  for (const mode of ['create', 'library']) {
    const runtime = createRuntime()
    const w = mountWorkspace(rootDir, env, runtime, director.fetch, { seed: PROFILES })
    await w.settle()
    if (mode === 'library') await w.mode('library')
    group[mode] = sha(markup(w.tree))
  }
  return { workspace: group }
}

function mountWorkspace(rootDir, env, runtime, fetch, { seed = [], overrides = {}, realHook = false, document } = {}) {
  const refuse = () => assert.fail('No network, storage, navigation or services allowed')
  const icons = new Proxy({}, { get: (_, name) => String(name) })
  const stableApi = {
    error: null,
    listThemes: async () => ({ themes: seed, count: seed.length }), saveTheme: refuse, setStandardTheme: refuse, clearStandardTheme: refuse,
  }
  const stubs = {
    react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons,
    '@/lib/studio-inspector-focus': { keepStudioScrollFocusVisible: refuse },
    './library-account-boundary': { useStudioLibraryAccount: () => null, libraryAccountCanStart: () => true, libraryAccountIsCurrent: () => true },
    './studio-workflow-action': { StudioWorkflowAction: 'StudioWorkflowAction' },
    './library-controls': { ...Object.fromEntries(['FittedLibraryStage', 'LibraryLoading', 'LibraryNotice', 'LibrarySearch', 'LibraryWorkspace', 'MetadataDisclosure', 'ReadValue', 'StudioWorkflowLink'].map(name => [name, name])), libraryDate: String },
    ...(realHook ? {} : { '@/hooks/use-theme-profiles': { useThemeProfiles: () => stableApi } }),
  }
  const loader = createLoader(rootDir, { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', ...env }, stubs, overrides, globals: { fetch, document, window: { addEventListener() {}, removeEventListener() {} } } })
  const { ThemesWorkspace } = loader.load('components/studio-libraries/themes-workspace.tsx')
  const w = {
    tree: null, runtime,
    render() { w.tree = runtime.render(ThemesWorkspace, {}); return w.tree },
    async settle() { for (let i = 0; i < 12; i++) { await new Promise(resolve => setTimeout(resolve, 0)); w.render() } return w.tree },
    async mode(mode) { w.tree.props.onModeChange(mode); w.render(); await w.settle() },
    input(label, value) { const parent = labelled(w.tree, label); flat(parent).find(node => node.type === 'input' || node.type === 'textarea').props.onChange({ target: { value } }); w.render() },
    choose(label, value) { selectIn(w.tree, label).props.onChange({ target: { value } }); w.render() },
    click(start) { button(w.tree, start).props.onClick(); w.render() },
    pick(id) { flat(w.tree).find(node => node.type === 'button' && node.key === id).props.onClick(); w.render() },
    notices() { return flat(w.tree).filter(node => node.type === 'LibraryNotice').map(text) },
  }
  w.render()
  return w
}

// ── fixture: capture (base checkout) or compare ─────────────────────────────────────────────────────
const ENV_OFF = [{}, { [FLAG]: 'false' }, { [FLAG]: '1' }, { [FLAG]: 'TRUE' }, { [FLAG]: ' true' }, { [FLAG]: 'yes' }, { [FLAG]: '' }]
function compact(observed) {
  const out = {}
  for (const [name, group] of Object.entries(observed)) out[name] = Object.fromEntries(Object.entries(group).map(([key, value]) => [key, typeof value === 'string' && value.length > 600 && !/^[0-9a-f]{64}$/.test(value) ? { sha256: sha(value), bytes: value.length } : value]))
  return out
}

if (process.env.THEME_FONT_CAPTURE) {
  const base = path.resolve(process.env.THEME_FONT_BASE_ROOT || '')
  assert.ok(process.env.THEME_FONT_BASE_ROOT && fs.existsSync(path.join(base, 'lib/theme-builder.ts')), 'THEME_FONT_BASE_ROOT must be a checkout of the base commit')
  assert.ok(!fs.existsSync(path.join(base, 'lib/theme-fonts.ts')), 'the capture root must be the pristine base, not this branch')
  const observed = compact(await observe(base, {}))
  Object.assign(observed, compact(await observeWorkspace(base, {})))
  fs.mkdirSync(path.dirname(fixtureFile), { recursive: true })
  fs.writeFileSync(fixtureFile, JSON.stringify({ base: '30c9fc9', note: 'flag-off outputs of the pristine base; see scripts/test-theme-font-selection.mjs', observed }, null, 1) + '\n')
  console.log('captured', fixtureFile, Object.fromEntries(Object.entries(observed).map(([key, group]) => [key, Object.keys(group).length])))
  process.exit(0)
}

// ═══════════════════════════ the suite (rerun against mutated sources below) ═════════════════════════
const EXPECTED = JSON.parse(fs.readFileSync(fixtureFile, 'utf8')).observed

async function suite(overrides = {}, { envs = ENV_OFF } = {}) {
  const fontEnv = { [FLAG]: 'true' }
  const load = (env, extra = {}) => createLoader(treeRoot, { env, overrides, ...extra })
  const lib = env => load(env).load('lib/theme-fonts.ts')
  const on = lib(fontEnv)
  const off = lib({})
  const treeObserved = async env => compact(await observe(treeRoot, env))

  // 1 + 2: identity with the base --------------------------------------------------------------------
  const expectedWithout = Object.fromEntries(Object.entries(EXPECTED).filter(([key]) => key !== 'workspace'))
  for (const env of envs) {
    assert.deepEqual(plain(await treeObserved(env)), plain(expectedWithout), `flag ${JSON.stringify(env)} is the base`)
    assert.deepEqual(plain(compact(await observeWorkspace(treeRoot, env))), plain({ workspace: EXPECTED.workspace }), `workspace markup, flag ${JSON.stringify(env)}, is the base`)
    ok('flag off is the base build')
  }
  assert.deepEqual(plain(await treeObserved(fontEnv)), plain(expectedWithout), 'flag on, colour-only inputs: still the base')
  ok('flag on with colour-only inputs is the base')

  // 3: the helper ----------------------------------------------------------------------------------------
  assert.equal(off.THEME_FONT_SELECTION_ENABLED, false); assert.equal(on.THEME_FONT_SELECTION_ENABLED, true)
  assert.deepEqual(plain(on.THEME_FONT_FAMILIES), FAMILIES)
  assert.deepEqual(plain(on.THEME_FONT_FIELDS), ['font_family', 'font_family_heading'])
  assert.equal(on.canonicalThemeFont('  open SANS '), 'Open Sans'); assert.equal(on.canonicalThemeFont('Comic Sans'), undefined); assert.equal(on.canonicalThemeFont(null), undefined); assert.equal(on.canonicalThemeFont(7), undefined)
  const both = { font_family: 'Lato', font_family_heading: 'Playfair Display' }
  assert.deepEqual(plain(on.themeFontFields({ ...both, mode: 'preset' })), both)
  assert.deepEqual(plain(on.themeFontFields({ font_family: 'lato', font_family_heading: null })), { font_family: 'Lato' })
  assert.deepEqual(plain(on.themeFontFields({ font_family: '', font_family_heading: 'Comic Sans' })), {})
  assert.deepEqual(plain(on.themeFontFields(null)), {}); assert.deepEqual(plain(off.themeFontFields(both)), {})
  const draft = { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#123456' } }
  const withHeading = on.setThemeFont(draft, 'font_family_heading', 'Playfair Display')
  const withBoth = on.setThemeFont(withHeading, 'font_family', 'lato')
  assert.equal(JSON.stringify(withBoth), JSON.stringify({ ...draft, font_family: 'Lato', font_family_heading: 'Playfair Display' }), 'canonical order: colours, body, heading')
  assert.equal(JSON.stringify(on.setThemeFont(withBoth, 'font_family_heading', '')), JSON.stringify({ ...draft, font_family: 'Lato' }), 'Theme default removes the key')
  assert.equal(JSON.stringify(on.setThemeFont(withBoth, 'font_family', undefined)), JSON.stringify({ ...draft, font_family_heading: 'Playfair Display' }))
  assert.ok(!('font_family' in on.setThemeFont(withBoth, 'font_family', 'Comic Sans')), 'an unsupported family clears, never stores')
  assert.equal(JSON.stringify(off.setThemeFont(draft, 'font_family', 'Lato')), JSON.stringify(draft), 'flag off: nothing is stored'); assert.equal(draft.font_family, undefined, 'input is not mutated')
  assert.equal(on.applyThemeFontPolicy(draft), draft, 'font-free selection: the same object'); assert.equal(on.applyThemeFontPolicy(withBoth), withBoth, 'canonical fonts: the same object')
  assert.equal(JSON.stringify(on.applyThemeFontPolicy({ ...draft, font_family: 'LATO', font_family_heading: 'Comic Sans' })), JSON.stringify({ ...draft, font_family: 'Lato' }))
  assert.equal(JSON.stringify(off.applyThemeFontPolicy({ ...withBoth, font_family: null })), JSON.stringify(draft), 'flag off removes every font key')
  assert.equal(on.themeFontsEqual(withBoth, { ...withBoth }), true); assert.equal(on.themeFontsEqual(withBoth, withHeading), false); assert.equal(on.themeFontsEqual(draft, { ...draft, font_family: 'Comic Sans' }), true)
  assert.equal(off.themeFontsEqual(withBoth, draft), true, 'flag off: fonts never take part in equality')
  assert.equal(on.themeFontRefusal(new Error('invalid body: font_family_heading must be one of: Inter, Lora')), 'font_family_heading must be one of: Inter, Lora')
  assert.equal(on.themeFontRefusal('save failed: HTTP 500'), null); assert.equal(on.themeFontRefusal(null), null)
  assert.equal(off.themeFontRefusal(new Error('invalid body: font_family must be one of: Inter')), null)
  assert.equal(on.themeFontCss('Lora'), "'Lora', Georgia, serif"); assert.equal(on.themeFontCss('Inter'), "'Inter', system-ui, sans-serif")
  // stylesheet: once, flag on, browser only
  const doc = { head: { children: [], appendChild(node) { this.children.push(node) } }, getElementById(id) { return this.head.children.find(node => node.id === id) ?? null }, createElement(tag) { return { tag } } }
  assert.equal(on.ensureThemeFontStylesheet(doc), true); assert.equal(on.ensureThemeFontStylesheet(doc), true); assert.equal(doc.head.children.length, 1)
  assert.equal(doc.head.children[0].rel, 'stylesheet'); assert.ok(doc.head.children[0].href.startsWith('https://fonts.googleapis.com/css2?') && doc.head.children[0].href.endsWith('&display=swap'))
  for (const family of FAMILIES) assert.ok(doc.head.children[0].href.includes(`family=${family.replace(/ /g, '+')}:wght@400;700`), family)
  const emptyDoc = { head: { children: [], appendChild(node) { this.children.push(node) } }, getElementById: () => null, createElement: tag => ({ tag }) }
  assert.equal(off.ensureThemeFontStylesheet(emptyDoc), false); assert.equal(emptyDoc.head.children.length, 0); assert.equal(on.ensureThemeFontStylesheet(undefined), false)
  ok('helper')

  // 4: builder: the DTO and the preset switch -------------------------------------------------------------
  {
    const builder = load(fontEnv).load('lib/theme-builder.ts')
    for (const base of [{ mode: 'preset', preset_id: 'minimal', ...both }, { mode: 'custom', primary_hex: '#1e40af', color_overrides: { accent: '#123456' }, ...both }, { mode: 'auto', ...both }]) {
      for (const id of ['vibrant', 'executive', 'corporate-blue', 'concrete_acid', 'nope']) {
        const next = builder.selectCanonicalThemePreset(base, id)
        assert.equal(next.mode, 'preset'); assert.equal(next.font_family, 'Lato'); assert.equal(next.font_family_heading, 'Playfair Display')
      }
    }
    const heading = builder.selectCanonicalThemePreset({ mode: 'preset', preset_id: 'minimal', font_family_heading: 'Lora' }, 'pastel')
    assert.equal(JSON.stringify(heading), JSON.stringify({ mode: 'preset', preset_id: 'pastel', font_family_heading: 'Lora' }), 'one font carried, the other absent (no null)')
    assert.ok(!('font_family' in heading))
    assert.deepEqual(Object.keys(builder.selectCanonicalThemePreset({ mode: 'preset', preset_id: 'minimal', font_family: null }, 'pastel')).sort(), ['color_overrides', 'harmony_preference', 'mode', 'palette_mode', 'preset_id'], 'a null font is not carried')
    assert.equal(builder.themeSelectionFingerprint({ mode: 'preset', preset_id: 'minimal', ...both }).includes('"font_family_heading":"Playfair Display"'), true, 'fingerprint sees fonts')
    assert.notEqual(builder.themeSelectionFingerprint({ mode: 'preset', preset_id: 'minimal', ...both }), builder.themeSelectionFingerprint({ mode: 'preset', preset_id: 'minimal' }))
    assert.deepEqual(plain(builder.normalizeThemePanelSelection({ mode: 'custom', primary_hex: '#112233', ...both })), { mode: 'custom', primary_hex: '#112233', ...both })
    ok('builder')
  }

  // 5: the profile hook: reads keep fonts only with the flag on --------------------------------------------
  {
    const profile = (extra = {}) => ({ id: 'p', name: 'N', theme_payload: { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#123456' }, ...extra }, is_standard: true })
    const hookFor = env => {
      const calls = []
      let answer
      const fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => answer } }
      const hook = load(env, { stubs: { react: { useState: init => [init, () => {}], useCallback: fn => fn } }, globals: { fetch } }).load('hooks/use-theme-profiles.ts').useThemeProfiles()
      return { hook, calls, answer: value => { answer = value } }
    }
    for (const [env, label] of [[fontEnv, 'on'], [{}, 'off']]) {
      const h = hookFor(env)
      const withFonts = profile(both), clean = profile(), odd = profile({ font_family: 'Comic Sans', font_family_heading: null })
      h.answer({ themes: [withFonts, clean, odd], count: 3 })
      const listed = plain((await h.hook.listThemes()).themes)
      h.answer({ theme: withFonts }); const standard = plain(await h.hook.getStandardTheme())
      if (label === 'on') {
        assert.deepEqual(listed[0].theme_payload, { mode: 'preset', preset_id: 'minimal', color_overrides: { accent: '#123456' }, ...both }, 'list keeps both fonts')
        assert.deepEqual(standard.theme_payload, listed[0].theme_payload, 'standard keeps both fonts')
        assert.deepEqual(listed[2].theme_payload, clean.theme_payload, 'an unsupported or null font is dropped')
      } else {
        assert.deepEqual(listed.map(p => p.theme_payload), [clean.theme_payload, clean.theme_payload, clean.theme_payload], 'flag off: fonts from a server never reach the selection')
        assert.deepEqual(standard.theme_payload, clean.theme_payload)
      }
      assert.deepEqual(listed[1], plain(clean), 'a font-free profile is untouched')
      // the save body is the draft as chosen
      h.answer({ ...clean }); h.calls.length = 0
      await h.hook.saveTheme({ name: 'Evergreen', theme: { mode: 'preset', preset_id: 'minimal', ...both }, setStandard: false })
      assert.equal(h.calls[0].url, '/api/themes'); assert.equal(h.calls[0].init.method, 'POST')
      assert.equal(h.calls[0].init.body, JSON.stringify({ name: 'Evergreen', description: null, theme: { mode: 'preset', preset_id: 'minimal', ...both }, set_standard: false }), 'save body: exact field names, no null')
    }
    ok('profile hook')
  }

  // 6: the builder page: session storage and equality ---------------------------------------------------------
  {
    const page = pageFunctions(treeRoot, fontEnv, on, overrides)
    const offPage = pageFunctions(treeRoot, {}, off, overrides)
    const preset = { mode: 'preset', preset_id: 'minimal', ...both }
    const custom = { mode: 'custom', primary_hex: '#112233', color_overrides: { accent: '#123456' }, ...both }
    for (const selection of [preset, custom]) {
      const restored = page.normalizeStoredBuildThemeSelection(JSON.parse(JSON.stringify(selection)))
      assert.equal(restored.font_family, 'Lato'); assert.equal(restored.font_family_heading, 'Playfair Display')
      assert.equal(page.buildThemeSelectionsEqual(selection, restored), true, 'a stored selection equals its profile')
      assert.equal(page.buildThemeSelectionsEqual(selection, { ...restored, font_family_heading: 'Lora' }), false, 'a different heading font is a different selection')
      assert.equal(page.buildThemeSelectionsEqual(selection, { ...restored, font_family: undefined }), false, 'a missing body font is a different selection')
      assert.equal(page.buildThemeProfileMatchesSelection({ id: 'p', name: 'n', theme_payload: selection }, restored), true)
      assert.equal(page.buildThemeProfileMatchesSelection({ id: 'p', name: 'n', theme_payload: selection }, { ...restored, font_family: 'Lora' }), false)
      const clean = JSON.parse(JSON.stringify(selection)); delete clean.font_family; delete clean.font_family_heading
      assert.equal(page.buildThemeSelectionsEqual(selection, clean), false, 'fonts vs no fonts differ')
      assert.equal(page.buildThemeSelectionsEqual(clean, JSON.parse(JSON.stringify(clean))), true)
      // flag off: stored fonts are dropped and never take part in equality
      const dropped = offPage.normalizeStoredBuildThemeSelection(JSON.parse(JSON.stringify(selection)))
      assert.ok(!('font_family' in dropped) && !('font_family_heading' in dropped), 'flag off: no font key survives storage')
      assert.equal(offPage.buildThemeSelectionsEqual(selection, clean), true, 'flag off: equality is colours only')
    }
    const garbage = page.normalizeStoredBuildThemeSelection({ mode: 'preset', preset_id: 'minimal', font_family: 'Comic Sans', font_family_heading: null })
    assert.deepEqual(plain(garbage), { mode: 'preset', preset_id: 'minimal' }, 'unsupported and null fonts do not survive storage')
    assert.deepEqual(plain(page.normalizeStoredBuildThemeSelection({ mode: 'auto', ...both })), { mode: 'auto' })
    ok('builder page')
  }

  // 7: the outgoing frames --------------------------------------------------------------------------------------
  {
    const build = userMessageBuilder(treeRoot, overrides)
    const theme = { mode: 'preset', preset_id: 'minimal', ...both }
    const frame = JSON.parse(build(theme))
    assert.equal(frame.type, 'user_message'); assert.deepEqual(frame.data.theme, theme)
    assert.deepEqual(Object.keys(frame.data.theme), ['mode', 'preset_id', 'font_family', 'font_family_heading'])
    assert.ok(build(theme).includes('"font_family":"Lato","font_family_heading":"Playfair Display"'), 'exact wire names')
    assert.ok(!('font_family' in JSON.parse(build({ mode: 'preset', preset_id: 'minimal' })).data.theme), 'absent, not null, when unset')
    assert.ok(!build({ mode: 'preset', preset_id: 'minimal' }).includes('font_family'))
    const handoff = createLoader(treeRoot, { env: fontEnv, overrides }).load('lib/manual-deck-workflow.ts').buildSessionHandoffRequest
    assert.deepEqual(plain(handoff({ userId: 'u', idempotencyKey: 'k', pendingRequest: 'p', theme, templateMode: false, deepResearch: false, webSearch: false, useKnowledgeGraph: false, manualDeckSummary: {} }).theme), theme, 'REST handoff carries the same theme')
    ok('wire')
  }

  // 7b: the deck theme panel in the builder keeps the fonts of the selection it was opened with ---------------------
  {
    const icons = new Proxy({}, { get: (_, name) => String(name) })
    const stubs = (runtime) => ({ react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, '@/components/ui/button': { Button: 'Button' }, '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9' }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') } })
    const applied = []
    const runtime = createRuntime()
    const { ThemePanel } = load(fontEnv, { stubs: stubs(runtime), globals: { fetch: async () => { throw new Error('network refused') } } }).load('components/theme-panel.tsx')
    const props = { isOpen: true, onClose() {}, presentationId: 'deck-1', buildThemeSelection: { mode: 'preset', preset_id: 'minimal', ...both }, themeSync: PANEL_SYNC, onBuildThemeChange: next => applied.push(plain(next)) }
    const render = () => runtime.render(ThemePanel, props)
    let tree = render()
    const apply = () => { const target = flat(tree).find(node => node.type === 'Button' && text(node).startsWith('Apply through Director')); assert.ok(target && !target.props.disabled, 'Apply is enabled'); target.props.onClick(); tree = render() }
    // custom palette from a preset that carries fonts: the fonts come along
    flat(tree).find(node => node.type === 'button' && text(node).includes('Build custom')).props.onClick(); tree = render()
    apply()
    assert.equal(applied.length, 1); assert.equal(applied[0].mode, 'custom'); assert.equal(applied[0].font_family, 'Lato'); assert.equal(applied[0].font_family_heading, 'Playfair Display')
    // back to presets, then another preset: the fonts stay
    flat(tree).find(node => node.type === 'button' && text(node).includes('Preset themes')).props.onClick(); tree = render()
    flat(tree).find(node => node.type === 'button' && node.key === 'vibrant').props.onClick(); tree = render()
    apply()
    assert.equal(applied[1].mode, 'preset'); assert.equal(applied[1].preset_id, 'vibrant'); assert.equal(applied[1].font_family, 'Lato'); assert.equal(applied[1].font_family_heading, 'Playfair Display')
    ok('theme panel')
  }

  // 8: the workspace -------------------------------------------------------------------------------------------
  {
    // flag off: no pickers, and the sentence says what it said before
    const offRuntime = createRuntime()
    const wOff = mountWorkspace(treeRoot, {}, offRuntime, createDirector().fetch, { overrides })
    await wOff.settle()
    assert.equal(selectIn(wOff.tree, 'Heading font'), undefined); assert.equal(selectIn(wOff.tree, 'Body font'), undefined)
    assert.ok(text(wOff.tree).includes('Website extraction, font editing, and AI theme chat are not connected in this workspace. Colors above are editable now.'))
    assert.equal(offRuntime.childEffects.length, 0, 'flag off: no stylesheet effect is even mounted')

    // flag on: the pickers, their options and the stylesheet effect
    const links = []
    const fakeDoc = { head: { appendChild: node => links.push(node) }, getElementById: id => links.find(node => node.id === id) ?? null, createElement: tag => ({ tag }) }
    const runtime = createRuntime()
    const w = mountWorkspace(treeRoot, fontEnv, runtime, createDirector().fetch, { overrides, realHook: true, document: fakeDoc })
    await w.settle()
    assert.ok(text(w.tree).includes('Website extraction and AI theme chat are not connected in this workspace. Colors and fonts above are editable now.'))
    assert.ok(runtime.childEffects.length >= 1, 'the picker mounts its stylesheet effect')
    for (const effect of runtime.childEffects) effect()
    assert.equal(links.length, 1, 'the stylesheet is added once'); assert.equal(links[0].rel, 'stylesheet'); assert.ok(links[0].href.startsWith('https://fonts.googleapis.com/css2?'))
    for (const field of ['Heading font', 'Body font']) {
      const select = selectIn(w.tree, field)
      assert.ok(select, field)
      const options = flat(select).filter(node => node.type === 'option')
      assert.deepEqual(options.map(node => node.props.value), ['', ...FAMILIES], `${field}: Theme default, then the eight`)
      assert.equal(text(options[0]), 'Theme default'); assert.deepEqual(options.slice(1).map(text), FAMILIES)
      options.slice(1).forEach(option => assert.ok(option.props.style.fontFamily.startsWith(`'${option.props.value}'`), 'each option in its own font'))
      assert.equal(select.props.value, '')
    }
    w.choose('Heading font', 'Playfair Display'); w.choose('Body font', 'Lato')
    assert.equal(selectIn(w.tree, 'Heading font').props.value, 'Playfair Display'); assert.equal(selectIn(w.tree, 'Body font').props.value, 'Lato')
    assert.ok(selectIn(w.tree, 'Heading font').props.style.fontFamily.startsWith("'Playfair Display'"))
    const specimen = () => flat(w.tree).find(node => node.type === 'div' && String(node.props.className).startsWith('sl-theme-slide'))
    assert.equal(specimen().props['data-spec-font-heading'], 'Playfair Display'); assert.equal(specimen().props.style['--spec-font-heading'], "'Playfair Display'")
    assert.equal(specimen().props['data-spec-font-body'], 'Lato'); assert.equal(specimen().props.style['--spec-font-body'], "'Lato'")
    // the base theme and colour approach switch; the fonts stay
    const stays = () => { assert.equal(selectIn(w.tree, 'Heading font').props.value, 'Playfair Display'); assert.equal(selectIn(w.tree, 'Body font').props.value, 'Lato') }
    w.choose('Base theme', 'vibrant'); stays()
    w.click('Custom palette'); stays()
    w.click('Theme-linked'); stays()
    // Theme default clears one font; the other stays
    w.choose('Body font', ''); assert.equal(selectIn(w.tree, 'Body font').props.value, ''); assert.equal(selectIn(w.tree, 'Heading font').props.value, 'Playfair Display')
    assert.equal(specimen().props['data-spec-font-body'], undefined); assert.equal(specimen().props.style['--spec-font-body'], undefined)
    // Auto has no fonts to pick
    w.choose('Base theme', 'auto'); assert.equal(selectIn(w.tree, 'Heading font'), undefined)
    w.choose('Base theme', 'vibrant'); assert.equal(selectIn(w.tree, 'Heading font').props.value, '', 'fonts do not survive an Auto detour')

    // create -> save, against a Director that has the flag on
    const director = createDirector()
    const maker = mountWorkspace(treeRoot, fontEnv, createRuntime(), director.fetch, { overrides, realHook: true })
    await maker.settle()
    maker.input('Theme name', 'Evergreen studio')
    maker.choose('Base theme', 'vibrant'); maker.choose('Heading font', 'Playfair Display'); maker.choose('Body font', 'Lato')
    maker.click('Save reusable theme'); await maker.settle()
    const post = director.requests.find(request => request.method === 'POST')
    assert.ok(post, 'saved')
    const sent = JSON.parse(post.body)
    assert.equal(post.body, JSON.stringify({ name: 'Evergreen studio', description: '', theme: { mode: 'preset', preset_id: 'vibrant', font_family: 'Lato', font_family_heading: 'Playfair Display' }, set_standard: false }), 'POST /api/themes body')
    assert.deepEqual(Object.keys(sent.theme), ['mode', 'preset_id', 'font_family', 'font_family_heading'])
    const notices = maker.notices()
    assert.ok(notices.some(n => n.includes('was saved to your library')) && !notices.some(n => n.includes('did not keep')), 'nothing implies the fonts were lost')
    assert.deepEqual(plain(director.profiles[0].theme_payload), { mode: 'preset', preset_id: 'vibrant', font_family: 'Lato', font_family_heading: 'Playfair Display' })

    // reload: a fresh mount reads the library back; the saved theme shows its fonts
    const again = mountWorkspace(treeRoot, fontEnv, createRuntime(), director.fetch, { overrides, realHook: true })
    await again.settle(); await again.mode('library')
    const reads = flat(again.tree).filter(node => node.type === 'ReadValue').map(node => [node.props.label, node.props.value])
    assert.deepEqual(reads.filter(([label]) => /font/.test(label)), [['Heading font', 'Playfair Display'], ['Body font', 'Lato']])
    // set as standard: the standard comes back with the fonts
    again.click('Set as standard'); await again.settle()
    assert.equal(director.standardId, 'saved-1')
    // pick: what the composer forwards is the profile's payload; the page keeps it; the socket sends it
    const picked = plain(director.profiles[0].theme_payload)
    const readHook = createLoader(treeRoot, { env: fontEnv, overrides, stubs: { react: { useState: init => [init, () => {}], useCallback: fn => fn } }, globals: { fetch: director.fetch } }).load('hooks/use-theme-profiles.ts').useThemeProfiles()
    const listed = (await readHook.listThemes()).themes.find(profileItem => profileItem.id === 'saved-1')
    const standard = await readHook.getStandardTheme()
    const page = pageFunctions(treeRoot, fontEnv, on, overrides)
    for (const selection of [listed.theme_payload, standard.theme_payload]) {
      assert.deepEqual(plain(selection), picked)
      const stored = page.normalizeStoredBuildThemeSelection(JSON.parse(JSON.stringify(selection)))
      assert.equal(page.buildThemeSelectionsEqual(selection, stored), true)
      const frame = JSON.parse(userMessageBuilder(treeRoot, overrides)(stored))
      assert.deepEqual(frame.data.theme, { mode: 'preset', preset_id: 'vibrant', font_family: 'Lato', font_family_heading: 'Playfair Display' }, 'data.theme carries both fonts')
    }
    // customize a copy keeps the fonts
    again.click('Customize a copy'); await again.settle()
    assert.equal(selectIn(again.tree, 'Heading font').props.value, 'Playfair Display'); assert.equal(selectIn(again.tree, 'Body font').props.value, 'Lato')

    // a Director that has not enabled fonts: saved without them, and the Studio says so
    {
      const old = createDirector({ fonts: false })
      const v = mountWorkspace(treeRoot, fontEnv, createRuntime(), old.fetch, { overrides, realHook: true })
      await v.settle(); v.input('Theme name', 'No fonts server'); v.choose('Heading font', 'Lora'); v.click('Save reusable theme'); await v.settle()
      assert.ok(v.notices().some(n => n.includes('was saved to your library') && n.includes('did not keep the font choice')), v.notices().join('|'))
    }
    // a Director that refuses a family (422): its text is shown and the draft stays
    {
      const strict = createDirector({ allowed: FAMILIES.filter(name => name !== 'Lora') })
      const v = mountWorkspace(treeRoot, fontEnv, createRuntime(), strict.fetch, { overrides, realHook: true })
      await v.settle(); v.input('Theme name', 'Refused'); v.choose('Heading font', 'Lora')
      v.click('Save reusable theme'); await v.settle()
      const shown = v.notices().join('|')
      assert.ok(shown.includes('Theme not saved: font_family_heading must be one of: Inter, Poppins'), shown)
      assert.equal(selectIn(v.tree, 'Heading font').props.value, 'Lora', 'the draft is kept')
      assert.equal(strict.profiles.length, 0)
    }
    ok('workspace')
  }
}

await suite()
console.log(`PASS ${checks} theme-font-selection checks (flag off is the base; flag on carries both fonts)`)

// ═══════════════════════════ mutation check: break each rule, expect the suite to notice ═════════════
const read = rel => fs.readFileSync(path.join(treeRoot, rel), 'utf8')
const MUTATIONS = [
  ['wire field renamed', 'lib/theme-fonts.ts', text => text.replace("'font_family_heading']", "'fontFamilyHeading']")],
  ['flag gate dropped from themeFontFields', 'lib/theme-fonts.ts', text => text.replace('if (!THEME_FONT_SELECTION_ENABLED || !source || typeof source', 'if (!source || typeof source')],
  ['unsupported family kept', 'lib/theme-fonts.ts', text => text.replace('return THEME_FONT_FAMILIES.find(name => name.toLowerCase() === wanted)', 'return (THEME_FONT_FAMILIES.find(name => name.toLowerCase() === wanted) ?? value.trim()) as ThemeFontFamily')],
  ['Theme default leaves an empty key', 'lib/theme-fonts.ts', text => text.replace('if (chosen) next[name] = chosen', 'next[name] = chosen ?? ""')],
  ['fonts ignored in equality', 'lib/theme-fonts.ts', text => text.replace('return THEME_FONT_FIELDS.every(field => left[field] === right[field])', 'return true')],
  ['preset switch drops the fonts', 'lib/theme-builder.ts', text => text.replace('return carryThemeFonts(selection, {', 'return ((_from: object, to: BuildThemeSelection) => to)(selection, {')],
  ['hook keeps server fonts with the flag off', 'hooks/use-theme-profiles.ts', text => text.replace('const next = applyThemeFontPolicy(payload)', 'const next = payload')],
  ['hook skips the standard theme', 'hooks/use-theme-profiles.ts', text => text.replace('(data.theme ? withThemeFontPolicy(data.theme) : data.theme)', 'data.theme')],
  ['page forgets the stored fonts', 'app/builder/page.tsx', text => text.replace("{ mode: 'preset', preset_id: raw.preset_id, ...themeFontFields(raw) }", "{ mode: 'preset', preset_id: raw.preset_id }")],
  ['page custom selection forgets the fonts', 'app/builder/page.tsx', text => text.replace('Object.assign(next, themeFontFields(raw))', '')],
  ['page equality ignores the fonts', 'app/builder/page.tsx', text => text.replace('a.preset_id === b.preset_id && themeFontsEqual(a, b)', 'a.preset_id === b.preset_id')],
  ['theme panel custom switch drops the fonts', 'components/theme-panel.tsx', text => text.replace('updateDraft(carryThemeFonts(draft, {', 'updateDraft(((_from: object, to: BuildThemeSelection) => to)(draft, {')],
  ['heading picker writes the body field', 'components/studio-libraries/themes-workspace.tsx', text => text.replace("picker('font_family_heading', 'Heading font')", "picker('font_family', 'Heading font')")],
  ['picker shown with the flag off', 'components/studio-libraries/themes-workspace.tsx', text => text.replace('{THEME_FONT_SELECTION_ENABLED && draft.mode', '{draft.mode')],
  ['lost fonts are not reported', 'components/studio-libraries/themes-workspace.tsx', text => text.replace('const fontsKept = themeFontsEqual(sentDraft, result.theme_payload)', 'const fontsKept = true')],
  ['Director refusal is hidden', 'components/studio-libraries/themes-workspace.tsx', text => text.replace('fontRefusal ? `Theme not saved', 'false ? `Theme not saved')],
  ['specimen ignores the heading font', 'components/studio-libraries/theme-preview.tsx', text => text.replace("...(headingFont ? { 'data-spec-font-heading': headingFont } : {}),", '')],
  ['WebSocket drops the theme fonts', 'hooks/use-deckster-websocket-v2.ts', text => text.replace('...(options?.theme && { theme: options.theme }),', '...(options?.theme && { theme: { ...options.theme, font_family: undefined, font_family_heading: undefined } }),')],
]
for (const [name, rel, mutate] of MUTATIONS) {
  const original = read(rel)
  const mutated = mutate(original)
  assert.notEqual(mutated, original, `mutation "${name}" must change ${rel}`)
  let caught = false
  let why = ''
  try { await suite({ [rel]: mutated }, { envs: [{}] }) } catch (error) { caught = true; why = String(error.message).split('\n')[0].slice(0, 110) }
  assert.ok(caught, `mutation "${name}" went unnoticed`)
  console.log(`caught: ${name} -> ${why}`)
}
console.log(`PASS ${MUTATIONS.length} mutations noticed`)
