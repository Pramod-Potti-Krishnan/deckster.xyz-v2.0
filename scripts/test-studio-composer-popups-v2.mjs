// PASS2-COMPOSER-POPUPS (frontend-2): the composer's popups. Flag NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2 (exact "true", Studio shell only), default off.
//   1. the prompt text about 15% smaller            2. the Build theme popup as two searchable dropdowns (Deckster themes, My themes)
//   3. one composer popup open at a time            4. the template popup as two dropdowns (Deckster templates, My templates) + the library actions
//   5. the narrow-window pane strip as Slides / Director / Edit (Edit absent, not disabled, until something is selected)
//
// Run: node scripts/test-studio-composer-popups-v2.mjs   (plain node: transpile + vm, no network, no timers that matter, no writes)
//   COMPOSER_POPUPS_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-composer-popups-v2.mjs
//     re-prints the flag-off hashes below from the base sources (the merged studio-v4-dev-preparation-code at 1d5ebf0: base + #371 + #372).
//
// What is proved, on the REAL sources (chat-input.tsx, template-picker.tsx, studio-theme-menu.tsx, theme-dropdown-picker.tsx, the strip component
// and the strip's JSX in app/builder/page.tsx), transpiled and evaluated in a vm with a small hooks runtime:
//   - flag off (unset, "false", any other spelling, or on without the Studio shell): the composer, the theme popup, the template popup and the
//     strip render exactly as the base did (the whole expanded element tree, every key and value, is hashed and compared with the base's);
//   - flag on: the same handlers and payloads (theme apply, template use, strip actions), a shared open-state, Esc and outside click closing;
//   - the stylesheet is scoped to markers that exist only with the flag on; and every check above fails for the mutation it guards against.
//
// PASS2-COMPOSER-POPUPS fix (same flag): with the flag on, "My templates" lists the composer library's own templates (the library dialog's
// request, made under its rule) and offers the dialog's actions, which the dialog itself runs (page.tsx hands it the request); "Template
// library" opens the library dialog and never links /studio/templates where that page is disabled; an empty list says why. Proved here on the
// real chat-input, template picker, library dialog and page.tsx wiring: the same list request; for every listed template, Use original, Rebuild
// and New topic make exactly the requests, writes and navigation of the dialog's own buttons with the flag off; a job the dialog resumes on
// opening is not disturbed; and flag off, the dialog (16 states) and the page's ChatInput / dialog elements are the base's.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'

const treeRoot = process.env.COMPOSER_POPUPS_ROOT
  ? path.resolve(process.env.COMPOSER_POPUPS_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const FLAG = 'NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const TYPE = 'NEXT_PUBLIC_STUDIO_V4_TYPE'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const refuse = () => { throw new Error('composer-popups fixture refuses services and writes') }
const CHAT_INPUT = 'components/builder/chat-input.tsx'
const TEMPLATE_PICKER = 'components/builder/template-picker.tsx'
const THEME_MENU = 'components/builder/studio-theme-menu.tsx'
const DROPDOWN = 'components/theme-dropdown-picker.tsx'
const STRIP = 'components/builder/studio-workspace-switch-v2.tsx'
const POPUPS_LIB = 'lib/studio-composer-popups.ts'
const PAGE = 'app/builder/page.tsx'
const CSS = 'components/builder/studio-composer-popups-v2.css'

// Like JSON, but a key whose value is undefined stays visible and functions are marked, so a changed key set cannot hide.
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
const plain = value => JSON.parse(JSON.stringify(value))
// Values built inside the vm have their own Array/Object prototypes: compare them as plain data.
const deq = (actual, expected, message) => message === undefined ? assert.deepStrictEqual(plain(actual), plain(expected)) : assert.deepStrictEqual(plain(actual), plain(expected), message)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

// ---- module loader: transpile repo files (optionally with in-memory mutations) and run them in a vm -----------------------------------------
class MutationTargetMissing extends Error {}
const transpiled = new Map()
function createLoader({ env = {}, stubs = {}, globals = {}, mutate = {} } = {}) {
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
    const rel = path.relative(treeRoot, file)
    let source = fs.readFileSync(file, 'utf8')
    for (const [from, to] of mutate[rel] ?? []) {
      if (!source.includes(from)) throw new MutationTargetMissing(`mutation target missing in ${rel}: ${from.slice(0, 80)}`)
      source = source.replace(from, to)
    }
    const key = `${rel}\0${sha(source)}`
    if (!transpiled.has(key)) {
      const out = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
      deq((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [], `${rel} transpiles`)
      transpiled.set(key, out.outputText)
    }
    vm.runInNewContext(transpiled.get(key), { module: mod, exports: mod.exports, process: { env }, console, ...globals, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return { load: rel => run(path.join(treeRoot, rel)) }
}

// ---- a small hooks runtime: stateful root component, inert children -------------------------------------------------------------------------
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
    Fragment: 'Fragment',
  }
  react.default = react
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
      for (let attempt = 0; attempt < 14; attempt++) {
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
async function settle(runtime, Component, props) {
  let tree = runtime.render(Component, props)
  for (let i = 0; i < 10; i++) {
    await tick()
    if (!runtime.pending) break
    tree = runtime.render(Component, props)
  }
  return tree
}

// ---- fixtures ---------------------------------------------------------------------------------------------------------------------------------
const PRESETS = [
  { preset_id: 'corporate_light', name: 'Corporate Light', description: 'Clean business theme with a blue brand base' },
  { preset_id: 'minimal', name: 'Minimal', description: 'Quiet, restrained theme for simple narratives' },
  { preset_id: 'vibrant', name: 'Vibrant', description: 'High-energy palette for launches' },
  { preset_id: 'pastel', name: 'Pastel', description: 'Soft palette for workshops' },
]
const SAVED = [
  { id: 'th-1', name: 'Northwind brand', is_standard: true, theme_payload: { mode: 'custom', primary_hex: '#0f766e' } },
  { id: 'th-2', name: 'Investor update', is_standard: false, theme_payload: { mode: 'custom', primary_hex: '#7c3aed' } },
  { id: 'th-3', name: 'Workshop warm', is_standard: false, theme_payload: { mode: 'preset', preset_id: 'pastel' } },
  { id: 'th-4', name: 'Overrides only', is_standard: false, theme_payload: { mode: 'custom', color_overrides: { primary: '#123456' } } },
]
const TEMPLATES = [
  { id: 'tp-1', name: 'Quarterly business review', description: 'Eight-slide QBR', slide_count: 8, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' },
  { id: 'tp-2', name: 'Product launch', description: null, slide_count: 12, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' },
  { id: 'tp-3', name: 'Board update', description: 'Optimizing', slide_count: 10, blueprint_generation_method: 'deterministic_fallback', blueprint_enrichment_status: 'running', template_purity_status: 'pending' },
  { id: 'tp-4', name: 'Case study', description: 'Failed', slide_count: 6, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'failed', blueprint_enrichment_error: 'synthetic failure', template_purity_status: 'pending' },
  { id: 'tp-5', name: 'Needs cleanup', description: null, slide_count: null, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'failed' },
]

/** Everything the composer, the popups and the dropdown import that is not repo code, as stubs; repo modules load for real. */
function makeWorld({ env, mutate = {}, recorder = false, globals: extraGlobals = {}, stubs: extraStubs = {}, savedTemplates = TEMPLATES } = {}) {
  const runtime = createRuntime()
  const toasts = []
  const calls = { listTemplates: 0, reoptimize: [], listThemes: 0 }
  const savedThemes = { themes: SAVED, count: SAVED.length }
  const themeProfiles = {
    loading: false, error: null,
    listThemes: async () => { calls.listThemes += 1; return savedThemes },
    saveTheme: refuse, setStandardTheme: refuse, clearStandardTheme: refuse, deleteTheme: refuse,
  }
  const fakeUseTemplates = {
    loading: false,
    listTemplates: async () => { calls.listTemplates += 1; return { templates: savedTemplates, count: savedTemplates.length } },
    reoptimizeTemplate: async id => { calls.reoptimize.push(id); return { id, blueprint_enrichment_status: 'queued', blueprint_enrichment_error: null, template_purity_status: 'pending' } },
    watchTemplateStatus: () => () => {},
  }
  const stubs = {
    react: runtime.react,
    'react/jsx-runtime': jsxRuntime,
    'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }),
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/textarea': { Textarea: 'Textarea' },
    '@/components/ui/switch': { Switch: 'Switch' },
    '@/components/ui/dropdown-menu': { DropdownMenu: 'DropdownMenu', DropdownMenuContent: 'DropdownMenuContent', DropdownMenuTrigger: 'DropdownMenuTrigger', DropdownMenuItem: 'DropdownMenuItem', DropdownMenuLabel: 'DropdownMenuLabel', DropdownMenuSeparator: 'DropdownMenuSeparator' },
    '@/components/file-chip': { FileChip: 'FileChip' },
    '@/components/builder/chat/mention-popover': { SlideMentionPopover: () => null },
    '@/lib/mdc-mentions': { filterMentionSlides: () => [], mentionToken: refuse },
    '@/lib/mdc-flags': { CHAT_MENTIONS: false },
    '@/lib/config': { getThemeBuilderUrl: () => 'http://127.0.0.1:9', features: { enableFileUploads: true } },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    'next/link': { default: 'a' },
    '@/hooks/use-theme-profiles': { useThemeProfiles: () => themeProfiles },
    '@/hooks/use-toast': { useToast: () => ({ toast: value => toasts.push(value) }) },
    './studio-composer-hint': { StudioComposerHint: ({ children }) => children },
    ...extraStubs,
  }
  const globals = { fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }), ...extraGlobals }
  const loader = createLoader({ env, stubs, globals, mutate })
  // Real use-templates (its pure readiness helpers), with the hook replaced by a local fixture.
  const realTemplates = loader.load('hooks/use-templates.ts')
  stubs['@/hooks/use-templates'] = { ...realTemplates, useTemplates: () => fakeUseTemplates }
  if (recorder) {
    // The real dropdown module, except that its component becomes a recorder: the tree then shows exactly what a popup hands it.
    const realDropdown = loader.load(DROPDOWN)
    stubs['@/components/theme-dropdown-picker'] = { ...realDropdown, ThemeDropdownPicker: props => jsx('ThemeDropdownPicker', props) }
  }
  return { runtime, loader, toasts, calls, stubs }
}

// ---- the composer's props --------------------------------------------------------------------------------------------------------------------
const makeProps = (over = {}, log = []) => ({
  inputMessage: '', onInputChange: () => {}, onSubmit: () => {}, uploadedFiles: [], onFilesSelected: refuse, onRemoveFile: refuse, onClearAllFiles: refuse,
  pendingActionInput: null, onCancelAction: () => {}, researchEnabled: false, onResearchEnabledChange: refuse, webSearchEnabled: false,
  onWebSearchEnabledChange: refuse, knowledgeGraphEnabled: false, onKnowledgeGraphEnabledChange: refuse, showKnowledgeGraphToggle: false,
  knowledgeGraphAccess: 'unavailable', onKnowledgeGraphAccessClick: refuse, isReady: true, isLoadingSession: false, connected: true, connecting: false,
  user: { id: 'synthetic-user' }, currentSessionId: 'synthetic-session', onRequestSession: async () => {}, buildTheme: { mode: 'auto' },
  onBuildThemeChange: value => log.push(['onBuildThemeChange', plain(value)]),
  onActiveBuildThemeProfileChange: value => log.push(['onActiveBuildThemeProfileChange', plain(value)]),
  templateBuilderEnabled: true, onSelectTemplate: value => log.push(['onSelectTemplate', plain(value)]), onOpenComposerLibrary: () => log.push(['onOpenComposerLibrary']),
  ...over,
})
const COMPOSER_STATES = {
  idle: () => makeProps(),
  draft: () => makeProps({ inputMessage: 'Make the title shorter' }),
  uploading: () => makeProps({ uploadedFiles: [{ id: 'f1', name: 'brief.pdf', status: 'uploading', size: 10, type: 'application/pdf' }] }),
  'theme-preset': () => makeProps({ buildTheme: { mode: 'preset', preset_id: 'minimal' } }),
  'theme-custom': () => makeProps({ buildTheme: { mode: 'custom', primary_hex: '#0f766e' }, activeBuildThemeProfile: { id: 'th-1', name: 'Northwind brand', theme_payload: { mode: 'custom', primary_hex: '#0f766e' } } }),
  'template-chip': () => makeProps({ activeTemplate: { id: 'tp-1', name: 'Quarterly business review', blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' } }),
  locked: () => makeProps({ templateSelectionLocked: true }),
  'no-builder': () => makeProps({ templateBuilderEnabled: false, onSelectTemplate: undefined }),
  'no-library': () => makeProps({ onOpenComposerLibrary: undefined }),
  loading: () => makeProps({ isLoadingSession: true }),
  'no-user': () => makeProps({ user: null }),
  'research-on': () => makeProps({ researchEnabled: true, webSearchEnabled: true }),
}
async function renderComposer(env, props, { mutate, recorder } = {}) {
  const world = makeWorld({ env, mutate, recorder })
  const { ChatInput } = world.loader.load(CHAT_INPUT)
  const tree = await settle(world.runtime, ChatInput, props)
  return { world, ChatInput, tree, render: () => settle(world.runtime, ChatInput, props) }
}
const buttonLabelled = (node, label) => flat(node).some(n => n.type === 'button' && n.props['aria-label'] === label)
const menuNodes = tree => {
  const menus = flat(tree).filter(n => n.type === 'DropdownMenu')
  const by = label => menus.find(m => buttonLabelled(m, label))
  return { theme: by('Build theme'), template: by('Reuse a saved template'), research: by('Research options') }
}
const openStates = tree => Object.fromEntries(Object.entries(menuNodes(tree)).map(([name, node]) => [name, node?.props.open]))

// ---- environments ------------------------------------------------------------------------------------------------------------------------------
const OFF_ENVS = []
for (const shell of [false, true]) {
  const variants = [{}, { [FLAG]: 'false' }, { [FLAG]: '1' }, { [FLAG]: 'TRUE' }, { [FLAG]: 'True' }, { [FLAG]: ' true' }, { [FLAG]: 'true ' }, { [FLAG]: '' }]
  if (!shell) variants.push({ [FLAG]: 'true' }) // flag on, but not the Studio shell
  for (const variant of variants) OFF_ENVS.push({ name: `shell=${shell} ${JSON.stringify(variant)}`, shell, env: { ...(shell ? { [SHELL]: 'true' } : {}), ...variant } })
}
const ON_ENV = { [SHELL]: 'true', [FLAG]: 'true' }

// ---- the flag-off hashes ---------------------------------------------------------------------------------------------------------------------
async function composerHash(env, opts) {
  const hashes = []
  for (const [name, make] of Object.entries(COMPOSER_STATES)) {
    const { tree } = await renderComposer(env, make(), opts)
    hashes.push(`${name}:${sha(ser(tree))}`)
  }
  return sha(hashes.join('\n'))
}
async function themeMenuHash(opts) {
  const hashes = []
  const selections = [{ mode: 'auto' }, { mode: 'preset', preset_id: 'minimal' }, { mode: 'custom', primary_hex: '#0f766e' }]
  for (const view of ['choices', 'save', 'manage']) {
    for (const selection of selections) {
      for (const locked of [false, true]) {
        for (const selectedId of [null, 'th-2']) {
          const world = makeWorld({ env: { [SHELL]: 'true' }, ...opts })
          const { StudioThemeMenu } = world.loader.load(THEME_MENU)
          const tree = world.runtime.render(StudioThemeMenu, themeMenuProps({ view, selection, locked, selectedId }))
          hashes.push(sha(ser(tree)))
        }
      }
    }
  }
  return sha(hashes.join('\n'))
}
function themeMenuProps({ view = 'choices', selection = { mode: 'auto' }, locked = false, selectedId = null, dropdowns, log = [], themes = SAVED, presetsLoading = false } = {}) {
  return {
    view, onView: v => log.push(['onView', v]), onClose: () => log.push(['onClose']), selection, presets: PRESETS, presetsLoading, presetsError: false, themes, selectedId,
    currentProfile: selectedId ? { id: selectedId, name: 'Investor update' } : null, activeTheme: themes.find(t => t.id === selectedId), standardTheme: themes.find(t => t.is_standard),
    onPreset: id => log.push(['onPreset', id]), onSaved: id => log.push(['onSaved', id]), hex: '#1e40af', onHex: v => log.push(['onHex', v]),
    locked, lockReason: locked ? 'Build theme selection is locked for this deck.' : null, readBusy: false, readFailed: false, readEmpty: false, onRefresh: () => log.push(['onRefresh']),
    name: '', onName() {}, asStandard: false, onAsStandard() {}, mutation: null, onSave: () => log.push(['onSave']), onSetStandard() {}, onClearStandard() {}, onDelete() {},
    ...(dropdowns === undefined ? {} : { dropdowns }),
  }
}
async function templateHash(env, opts) {
  const hashes = []
  for (const { name, standalone, mode } of [{ name: 'menu-generation', standalone: false, mode: 'generation' }, { name: 'menu-review', standalone: false, mode: 'review' }, { name: 'standalone', standalone: true, mode: 'generation' }]) {
    const world = makeWorld({ env, ...opts })
    const { TemplatePickerContent } = world.loader.load(TEMPLATE_PICKER)
    const props = { onSelect() {}, isOpen: true, mode, standalone }
    hashes.push(`${name}:${sha(ser(await settle(world.runtime, TemplatePickerContent, props)))}`)
  }
  for (const [name, over] of [['closed', {}], ['locked-library', { selectionLocked: true, onOpenLibrary() {} }], ['library', { onOpenLibrary() {} }], ['no-saved', { onOpenLibrary() {}, showSavedTemplates: false }], ['disabled', { disabled: true }]]) {
    const world = makeWorld({ env, ...opts })
    const { TemplatePicker } = world.loader.load(TEMPLATE_PICKER)
    hashes.push(`${name}:${sha(ser(world.runtime.render(TemplatePicker, { onSelect() {}, ...over })))}`)
  }
  return sha(hashes.join('\n'))
}
async function pageStripHash(root = treeRoot) {
  const out = []
  for (const combo of stripCombos()) out.push(sha(ser(renderOldStrip(read(PAGE), combo))))
  return sha(out.join('\n'))
}

// Hash of every cell above, per environment, captured from the base (the merged studio-v4-dev-preparation-code at 1d5ebf0, flag unset).
const BASE_HASHES = {
  composer: {
    'shell=false': '1ebebc11e241d17b1335b5e9c9f731aa856501640d50637d434d57b1a0a47aaf',
    'shell=true': '9fb4f486e1c2f98a0631c72bc122da3dd907ef414724960598beeafac9335644',
  },
  themeMenu: '90f693affd3496f747fb55c5ce038e7fe8f89767f8b3976ca20d8f3ce3727b0a',
  template: {
    'shell=false': '35e876d14fba7a45423856d4df815f56af3ce97aa0999cb8e0b45d49b5deffa3',
    'shell=true': '917670280b22dcea6b3c550d8ae1c69fe25275cfd9b6ff3228395a749f1683c5',
  },
  strip: '494e6e54fc64b1f7cfc85b0632c44a5a5c21a4979e856283de13f2cfbb018a48',
  // PASS2-COMPOSER-POPUPS fix, captured from the base at 37d6fd7 (#374 merged): the library dialog with no request (16 states: tree and every
  // request it makes), and the page's ChatInput / ComposerLibraryDialog elements without the fix's two spreads.
  dialog: 'a9afddd567106c52d82928b71af772f66c43a2b731f26b34f0843e692b6a5801',
  pageWiring: 'f062e97d1a2e9db9738e64d19b2f503ca849a97fe2a59a23aa845b5fb25675dd',
}

// ---- the narrow-window strip, from page.tsx ------------------------------------------------------------------------------------------------------
function stripSourceElements(pageSource) {
  const file = ts.createSourceFile('page.tsx', pageSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const found = { old: null, v2: null }
  const visit = node => {
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node
      const attrs = opening.attributes.properties.filter(ts.isJsxAttribute).map(a => a.name.getText(file))
      if (opening.tagName.getText(file) === 'div' && attrs.includes('data-studio-workspace-switch')) found.old = node.getText(file)
      if (opening.tagName.getText(file) === 'StudioWorkspaceSwitchV2') found.v2 = node.getText(file)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  // the condition each is rendered under
  const cond = (needle) => {
    const i = pageSource.indexOf(needle)
    if (i < 0) return null
    const open = pageSource.lastIndexOf('{', i)
    return pageSource.slice(open, i + needle.length).replace(/\s+/g, ' ')
  }
  return { ...found, oldCondition: cond('<div data-studio-workspace-switch="true"'), v2Condition: cond('<StudioWorkspaceSwitchV2') }
}
// A JSX element taken from page.tsx, compiled with React.createElement and evaluated against a scope of fakes (a name it needs that the scope lacks throws).
const createElement = (type, props, ...children) => ({ type, props: { ...(props ?? {}), ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}) }, key: props?.key })
function compileJsx(source, label) {
  const out = ts.transpileModule(`var __el = (${source});`, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React, alwaysStrict: false } })
  deq((out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error), [], `${label} compiles`)
  // eslint-disable-next-line no-new-func
  const factory = new Function('scope', `with (scope) { ${out.outputText}\nreturn __el }`)
  return scope => factory({ React: { createElement }, ...scope })
}
function stripCombos() {
  const combos = []
  for (const overlay of [false, true]) for (const stage of [false, true]) for (const chat of [false, true]) for (const inspectorVisible of [false, true]) for (const pane of ['chat', 'inspector', 'stage']) for (const inspector of [null, 'slide', 'element']) {
    combos.push({ overlay, stage, chat, inspectorVisible, pane, inspector })
  }
  return combos
}
function stripScope(combo, log) {
  return {
    studioOverlayWorkspace: combo.overlay, studioStageSelected: combo.stage, workspaceLayout: { chatVisible: combo.chat, inspectorVisible: combo.inspectorVisible, presentedPane: combo.pane },
    activeInspector: combo.inspector, showChat: false, retireStudioVoiceOwner: () => log.push('retire'), setStudioStageSelected: v => log.push(['stage', v]),
    selectWorkspacePane: p => log.push(['pane', p]), setShowChat: v => log.push(['showChat', v]),
  }
}
function renderOldStrip(pageSource, combo, log = []) {
  const { old } = stripSourceElements(pageSource)
  assert.ok(old, 'the old strip is in page.tsx')
  const factory = compileJsx(old, 'old strip')
  return factory(stripScope(combo, log))
}

// ---- diff of two trees, as paths ----------------------------------------------------------------------------------------------------------
function diffTrees(a, b, where = '$', out = []) {
  const kind = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v
  if (kind(a) !== kind(b)) { out.push(`${where}: ${kind(a)} -> ${kind(b)}`); return out }
  if (kind(a) === 'function') return out
  if (kind(a) === 'array') {
    if (a.length !== b.length) out.push(`${where}: length ${a.length} -> ${b.length}`)
    for (let i = 0; i < Math.min(a.length, b.length); i++) diffTrees(a[i], b[i], `${where}[${i}]`, out)
    return out
  }
  if (kind(a) === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(key in a)) out.push(`${where}.${key}: added`)
      else if (!(key in b)) out.push(`${where}.${key}: removed`)
      else diffTrees(a[key], b[key], key === 'children' ? `${where}.children` : `${where}.${key}`, out)
    }
    return out
  }
  if (a !== b) out.push(`${where}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`)
  return out
}

// ---- PASS2-COMPOSER-POPUPS fix: the composer library (its dialog, its list, its services) and the page's wiring -------------------------------
const DIALOG = 'components/builder/composer-library-dialog.tsx'
// Invented records named like the QA account's two uploads, plus an id that must be encoded into the path.
const COMPOSER_TEMPLATES = [
  { id: 'cmp-j1', name: 'J1', slide_count: 12, stage_template_summary: { slide_count: 12, schema_version: 'stage-template-v1' } },
  { id: 'cmp-northwind', name: 'Northwind', stage_template_summary: { slide_count: 9 } },
  { id: 'cmp odd/id', name: 'Odd id', slide_count: 3 },
]
const OWNER = 'local-owner'
const LAYOUT = 'https://layout-builder-v75-uat.up.railway.app'
const SESSION = 'fresh-session-0001'
const COMPOSER_ENV = { NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT, NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED: 'true', NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true' }

/** The services the composer library uses, faked and recorded: every fetch, session create, sessionStorage write and navigation, in order. */
function composerServices({ templates = COMPOSER_TEMPLATES, listStatus = 200, pending = null, auth = true } = {}) {
  const log = []
  const store = new Map(pending ? [[`deckster_composer_job_${encodeURIComponent(OWNER)}`, JSON.stringify(pending)]] : [])
  const answer = (status, data) => ({ ok: status < 400, status, json: async () => data })
  let lastUse = null
  // A job the dialog resumes on opening keeps running until the test releases it.
  let held = Boolean(pending)
  const fetch = async (url, init = {}) => {
    log.push(['fetch', url, { method: init.method, cache: init.cache, signal: init.signal ? 'AbortSignal' : init.signal ?? null, headers: init.headers ?? null, body: init.body ?? null }])
    const route = url.replace('/api/composer-library/', '')
    if (route === 'templates' && init.method === 'GET') return answer(listStatus, listStatus < 400 ? { templates } : { error: 'Template library is not configured.' })
    const use = /^templates\/([^/]+)\/use$/.exec(route)
    if (use && init.method === 'POST') { lastUse = { templateId: decodeURIComponent(use[1]), sessionId: JSON.parse(init.body).session_id }; return answer(202, { job_id: 'job-use-1', status: 'queued' }) }
    const job = /^jobs\/([^/]+)$/.exec(route)
    if (job && init.method === 'GET' && job[1] === 'job-use-1') return answer(200, { job_id: 'job-use-1', status: 'complete', checkpoint: { result: { session_id: lastUse.sessionId, template_id: lastUse.templateId, presentation_id: 'deck-1', viewer_url: `${LAYOUT}/p/deck-1`, slide_count: 9 } } })
    if (job && init.method === 'GET') return answer(200, held ? { job_id: job[1], status: 'running', stage: 'preparing' } : { job_id: job[1], status: 'complete' })
    return answer(404, { error: 'Not found' })
  }
  const globals = {
    // One Error for every module, as in the browser (each module here runs in its own vm realm): the dialog and the popup both test `instanceof Error`.
    fetch, URL, AbortController, DOMException, Error,
    setTimeout: callback => { setTimeout(callback, 0); return 1 }, clearTimeout() {},
    crypto: { randomUUID: () => SESSION },
    sessionStorage: {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => { log.push(['sessionStorage.setItem', key, value]); store.set(key, value) },
      removeItem: key => { log.push(['sessionStorage.removeItem', key]); store.delete(key) },
    },
    window: { location: { assign: url => log.push(['location.assign', url]) } },
  }
  const stubs = {
    '@/components/ui/dialog': { Dialog: 'Dialog', DialogContent: 'DialogContent', DialogDescription: 'DialogDescription', DialogHeader: 'DialogHeader', DialogTitle: 'DialogTitle' },
    '@/hooks/use-auth': { useAuth: () => ({ user: auth ? { id: OWNER } : null }) },
    '@/hooks/use-chat-sessions': { useChatSessions: () => ({ createSession: async (id, title) => { log.push(['createSession', id, title]); return true } }) },
    '@/lib/researcher-upload': { uploadFileToResearcher: refuse },
    '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: () => ({ status: 'allowed' }) },
    '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} },
  }
  return { log, store, globals, stubs, release: () => { held = false } }
}
/** Render a stateful root again and again while its async work (requests, polling) runs to the end. */
async function drain(runtime, Component, props, turns = 40) {
  let tree = runtime.render(Component, props())
  for (let i = 0; i < turns; i++) { await tick(); tree = runtime.render(Component, props()) }
  return tree
}
/** The library dialog, mounted for real (its handlers, effects and the real composer-library module) against the recorded services. */
function mountDialog({ env, services, mutate = {} }) {
  const world = makeWorld({ env, globals: services.globals, stubs: services.stubs, mutate })
  return { world, ComposerLibraryDialog: world.loader.load(DIALOG).ComposerLibraryDialog }
}
async function dialogHash() {
  const hashes = []
  for (const shell of [true, false]) for (const auth of [true, false]) for (const extras of [COMPOSER_ENV, { NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT }]) for (const listStatus of [200, 503]) {
    const services = composerServices({ auth, listStatus })
    const { world, ComposerLibraryDialog } = mountDialog({ env: { ...(shell ? { [SHELL]: 'true' } : {}), ...extras }, services })
    const tree = await drain(world.runtime, ComposerLibraryDialog, () => ({ open: true, onOpenChange() {} }), 8)
    hashes.push(sha(ser(tree) + ser(services.log)))
  }
  return sha(hashes.join('\n'))
}

/** The page's ChatInput and ComposerLibraryDialog elements, taken from page.tsx: their attributes and spread expressions. */
function pageWiring(pageSource) {
  const file = ts.createSourceFile('page.tsx', pageSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const found = {}
  const visit = node => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node
      const tag = opening.tagName.getText(file)
      if (tag === 'ChatInput' || tag === 'ComposerLibraryDialog') {
        assert.ok(!found[tag], `one ${tag} in page.tsx`)
        const props = opening.attributes.properties
        found[tag] = { node: node.getText(file), attrs: props.filter(ts.isJsxAttribute).map(p => p.getText(file)), spreads: props.filter(ts.isJsxSpreadAttribute).map(p => p.expression.getText(file)) }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  assert.ok(found.ChatInput && found.ComposerLibraryDialog, 'page.tsx renders ChatInput and ComposerLibraryDialog')
  return found
}
const FIX_SPREAD = /onComposerTemplateAction|onRequestTaken/
// Chat PR D's flag-gated ChatInput prop (NEXT_PUBLIC_STUDIO_CHAT_COMPOSER_CONTEXT); its flag-off value (undefined) is proven by
// scripts/test-studio-chat-composer-recovery-answered.mjs, so it is left out of this pin like the fix's own spreads. Likewise
// NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB's pausedInOtherTab (false unless the tab is paused; the flag-off composer is proven equal to the base's by
// scripts/test-studio-one-live-tab.mjs --base-root). Likewise PASS2B J1-10's studioEditPrompt (NEXT_PUBLIC_STUDIO_CHAT_EDIT_PROMPT; `studioEditPromptActive || undefined`,
// so undefined with the flag off, which scripts/test-studio-pass2b-chat.mjs proves).
const SIBLING_FLAG_ATTR = /^(studioContextLabel|pausedInOtherTab|studioEditPrompt)=/
/** Both elements without the fix's two spreads: equal to the base's means the page passes exactly what it passed before when they add nothing. */
const pageWiringHash = source => { const w = pageWiring(source); return sha(['ChatInput', 'ComposerLibraryDialog'].map(tag => [...w[tag].attrs.filter(a => !SIBLING_FLAG_ATTR.test(a)), ...w[tag].spreads.filter(x => !FIX_SPREAD.test(x))].join('\n')).join('\n----\n')) }

if (process.env.PRINT_GOLDEN) {
  const out = { composer: {}, themeMenu: await themeMenuHash(), template: {}, strip: await pageStripHash(), dialog: await dialogHash(), pageWiring: pageWiringHash(read(PAGE)) }
  for (const shell of [false, true]) {
    const env = shell ? { [SHELL]: 'true' } : {}
    out.composer[`shell=${shell}`] = await composerHash(env)
    out.template[`shell=${shell}`] = await templateHash(env)
  }
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

let testCount = 0
async function run(name, fn) {
  testCount += 1
  try { await fn() } catch (err) { console.error(`FAIL: ${name}`); throw err }
}
const mutants = []   // [name, async () => void] each must THROW
const mutant = (name, fn) => mutants.push([name, fn])

// ================================================================================================================================================
// The flag
// ================================================================================================================================================
await run('the flag is read as the exact string "true", only with the Studio shell, and defaults off (composer and strip)', async () => {
  assert.match(read(CHAT_INPUT), /studio && process\.env\.NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2 === 'true'/)
  assert.match(read(PAGE), /studioShell && process\.env\.NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2 === 'true'/)
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['true', true]]) {
    for (const shell of [false, true]) {
      const env = { ...(shell ? { [SHELL]: 'true' } : {}), ...(value === undefined ? {} : { [FLAG]: value }) }
      const { tree } = await renderComposer(env, makeProps())
      const root = flat(tree)[0]
      assert.equal(root.props['data-studio-composer-popups-v2'] === 'true', expected && shell, `flag=${JSON.stringify(value)} shell=${shell}`)
    }
  }
})

await run('the flag is documented in .env.example, default "false", and has an npm script', async () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2="false"$/m)
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-composer-popups-v2'], 'node scripts/test-studio-composer-popups-v2.mjs')
})

// ================================================================================================================================================
// Flag off is the base
// ================================================================================================================================================
await run('flag off (every spelling, or on without the Studio shell): the composer, with its theme and template popups, renders exactly as the base did (whole expanded tree, 12 states)', async () => {
  for (const { name, shell, env } of OFF_ENVS) {
    assert.equal(await composerHash(env), BASE_HASHES.composer[`shell=${shell}`], name)
  }
})
mutant('composer: the flag is read without the shell or as "truthy" (flag-off tree changes)', async () => {
  const hash = await composerHash({ [FLAG]: 'true' }, { mutate: { [CHAT_INPUT]: [["studio && process.env.NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2 === 'true'", "process.env.NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2 === 'true'"]] } })
  assert.equal(hash, BASE_HASHES.composer['shell=false'])
})
mutant('composer: a V2 attribute is added without the empty-spread guard (a new key appears with the flag off)', async () => {
  const hash = await composerHash({ [SHELL]: 'true' }, { mutate: { [CHAT_INPUT]: [["{...(popupsV2 ? { 'data-studio-composer-popups-v2': 'true' } : {})}", "data-studio-composer-popups-v2={popupsV2 ? 'true' : undefined}"]] } })
  assert.equal(hash, BASE_HASHES.composer['shell=true'])
})
mutant('composer: the theme popup is always the dropdown one (flag-off popup changes)', async () => {
  const hash = await composerHash({ [SHELL]: 'true' }, { mutate: { [CHAT_INPUT]: [["{...(popupsV2 ? { dropdowns: true } : {})}", "dropdowns={true}"]] } })
  assert.equal(hash, BASE_HASHES.composer['shell=true'])
})
mutant('composer: the template picker is always handed V2 props', async () => {
  const hash = await composerHash({ [SHELL]: 'true' }, { mutate: { [CHAT_INPUT]: [["{...(popupsV2 ? { dropdowns: true, open: composerPopup === 'template'", "{...(true ? { dropdowns: true, open: composerPopup === 'template'"]] } })
  assert.equal(hash, BASE_HASHES.composer['shell=true'])
})

await run('flag off: the theme popup (every view, selection, lock) renders exactly as the base did', async () => {
  assert.equal(await themeMenuHash(), BASE_HASHES.themeMenu)
})
mutant('theme popup: the choices view always draws the dropdowns', async () => {
  assert.equal(await themeMenuHash({ mutate: { [THEME_MENU]: [["{p.dropdowns ? dropdownChoices : <div", "{true ? dropdownChoices : <div"]] } }), BASE_HASHES.themeMenu)
})
mutant('theme popup: the refresh button markup is changed while it is refactored', async () => {
  assert.equal(await themeMenuHash({ mutate: { [THEME_MENU]: [["{p.readBusy && <Loader2 aria-hidden=\"true\" className=\"studio-theme-spinner\" />}{p.readFailed ? 'Retry' : 'Refresh'}", "{p.readFailed ? 'Retry' : 'Refresh'}"]] } }), BASE_HASHES.themeMenu)
})

await run('flag off: the template picker and its content (menu, review, standalone, every lock and library case) render exactly as the base did', async () => {
  for (const shell of [false, true]) assert.equal(await templateHash(shell ? { [SHELL]: 'true' } : {}), BASE_HASHES.template[`shell=${shell}`], `shell=${shell}`)
})
mutant('template picker: the V2 popup is drawn for every caller', async () => {
  assert.equal(await templateHash({ [SHELL]: 'true' }, { mutate: { [TEMPLATE_PICKER]: [["{dropdowns && STUDIO_SHELL ? (", "{STUDIO_SHELL ? ("]] } }), BASE_HASHES.template['shell=true'])
})
mutant('template picker: the open-state is always the composer\'s (the picker loses its own)', () => uncontrolledPicker({ [TEMPLATE_PICKER]: [["const setOpen = controlledOpen === undefined ? setOwnOpen :", "const setOpen = false ? setOwnOpen :"]] }))

await run('flag off: the old narrow-window strip, taken from page.tsx, renders exactly as the base did (216 pane / selection combinations)', async () => {
  assert.equal(await pageStripHash(), BASE_HASHES.strip)
})
mutant('strip: the old strip is edited (label reworded)', async () => {
  const mutated = read(PAGE).replace('onClick={() => selectWorkspacePane(\'inspector\')}>Inspector</button>', 'onClick={() => selectWorkspacePane(\'inspector\')}>Edit</button>')
  if (mutated === read(PAGE)) throw new MutationTargetMissing('page mutation did not apply')
  const out = []
  for (const combo of stripCombos()) out.push(sha(ser(renderOldStrip(mutated, combo))))
  assert.equal(sha(out.join('\n')), BASE_HASHES.strip)
})

function pathOf(node, pred, where = '$') {
  if (pred(node)) return where
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const hit = pathOf(node[i], pred, `${where}[${i}]`); if (hit) return hit } return null }
  if (node && typeof node === 'object') { for (const key of Object.keys(node)) { const hit = pathOf(node[key], pred, `${where}.${key}`); if (hit) return hit } }
  return null
}
await run('what the flag changes in the composer is confined to the root marker, the theme popup and the template popup: the form, textarea, upload, drop, send and Escape handlers are untouched', async () => {
  for (const [name, make] of Object.entries(COMPOSER_STATES)) {
    const off = (await renderComposer({ [SHELL]: 'true' }, make())).tree
    const on = (await renderComposer(ON_ENV, make())).tree
    const themePath = pathOf(off, n => n?.type === 'DropdownMenu' && buttonLabelled(n, 'Build theme'))
    const templatePath = pathOf(off, n => n?.type === 'DropdownMenu' && buttonLabelled(n, 'Reuse a saved template'))
    const researchPath = pathOf(off, n => n?.type === 'DropdownMenu' && buttonLabelled(n, 'Research options'))
    assert.ok(themePath && researchPath, `${name}: popups found`)
    const diffs = diffTrees(off, on)
    assert.ok(diffs.length >= 3, `${name}: the flag changes something`)
    for (const line of diffs) {
      const where = line.split(':')[0]
      const allowed = where === '$.props.data-studio-composer-popups-v2'
        || where.startsWith(themePath + '.') || (templatePath && where.startsWith(templatePath + '.'))
      assert.ok(allowed, `${name}: a difference outside the popups: ${line}`)
      assert.ok(!where.startsWith(researchPath + '.'), `${name}: the research popup's contents are unchanged: ${line}`)
    }
    // the shared open-state changes only the popups' open / onOpenChange values, which match the idle base (closed)
    for (const label of ['Build theme', 'Reuse a saved template', 'Research options']) {
      const get = tree => flat(tree).find(n => n.type === 'DropdownMenu' && buttonLabelled(n, label))
      if (!get(off)) continue
      assert.equal(get(on).props.open, get(off).props.open, `${name}: ${label} starts closed in both`)
    }
    for (const type of ['form', 'Textarea', 'Button']) {
      // the form holds the popups as children; its own props (onSubmit) are what must not move
      const pick = tree => flat(tree).filter(n => n.type === type).map(n => ser({ ...n.props, children: type === 'form' ? undefined : n.props.children }))
      deq(pick(on), pick(off), `${name}: ${type} elements are identical`)
    }
    const pickButtons = tree => flat(tree).filter(n => n.type === 'button' && !['Build theme', 'Reuse a saved template'].includes(n.props['aria-label'])).filter(n => n.props['aria-label'] === 'Upload a file' || n.props['data-studio-v4-send'] || n.props['aria-label'] === 'Send message' || n.props['aria-label'] === 'Stop template reuse').map(n => ser(n.props))
    deq(pickButtons(on), pickButtons(off), `${name}: attach, send and stop buttons are identical`)
  }
})

// ================================================================================================================================================
// 1. the prompt text
// ================================================================================================================================================
await run('the prompt text is about 15% smaller, placeholder included, and the field keeps its height rule; every rule hangs off a V2 marker', async () => {
  const css = read(CSS)
  const parsed = postcss.parse(css)
  const sizes = {}
  let rules = 0
  parsed.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
    rules += 1
    for (const selector of rule.selectors) {
      assert.ok(/^(\[data-studio-composer-popups-v2="true"\]|\[data-studio-composer-dd="true"\]|\.dark \[data-studio-composer-menu="(theme|template)"\]|\[data-studio-composer-menu="(theme|template)"\])/.test(selector), `unscoped selector: ${selector}`)
      if (/textarea\[data-studio-v4-type-role="prompt"\]$/.test(selector)) {
        deq(rule.nodes.map(n => n.prop).sort(), ['font-size', 'line-height'], 'the textarea rules set only the size and line height (no height, padding or margin)')
        const size = rule.nodes.find(n => n.prop === 'font-size')?.value
        const line = rule.nodes.find(n => n.prop === 'line-height')?.value
        sizes[selector.includes('data-studio-v4-type="true"') ? 'type' : 'plain'] = { size: parseFloat(size), line: parseFloat(line) }
      }
      if (/studio-composer-popups-v2="true"\]/.test(selector) || /textarea/.test(selector)) assert.ok(!/placeholder/.test(selector), 'the placeholder inherits the textarea size')
    }
  })
  assert.ok(rules > 50)
  // 16px (the Studio type scale) -> 13.6px; 14px (md:text-sm, the default) -> 12px
  assert.ok(Math.abs(sizes.type.size / 16 - 0.85) < 0.005, `type scale: ${sizes.type.size}px is ${(sizes.type.size / 16).toFixed(3)} of 16px`)
  assert.ok(sizes.plain.size / 14 >= 0.84 && sizes.plain.size / 14 <= 0.87, `default: ${sizes.plain.size}px is ${(sizes.plain.size / 14).toFixed(3)} of 14px`)
  for (const s of Object.values(sizes)) assert.ok(s.line / s.size >= 1.4 && s.line / s.size <= 1.6, `line-height ratio ${s.line / s.size}`)
  assert.doesNotMatch(css, /!important/)
  assert.match(read(CHAT_INPUT), /min-h-\[96px\] max-h-\[220px\]/, 'the textarea keeps its min and max height classes')
  assert.match(read(CHAT_INPUT), /const TEXTAREA_MIN_HEIGHT = 96/)
})
mutant('css: a font-size rule loses its marker (reaches the composer with the flag off)', async () => {
  const css = read(CSS).replace('[data-studio-composer-popups-v2="true"] textarea[data-studio-v4-type-role="prompt"] { font-size: 12px', 'textarea[data-studio-v4-type-role="prompt"] { font-size: 12px')
  if (css === read(CSS)) throw new MutationTargetMissing('css mutation did not apply')
  const parsed = postcss.parse(css)
  parsed.walkRules(rule => { for (const selector of rule.selectors) assert.ok(/^(\[data-studio-composer-popups-v2="true"\]|\[data-studio-composer-dd="true"\]|\.dark |\[data-studio-composer-menu)/.test(selector), `unscoped selector: ${selector}`) })
})
mutant('css: the type-scale size is not reduced by about 15%', async () => {
  const css = read(CSS).replace('font-size: 13.6px', 'font-size: 15px')
  if (css === read(CSS)) throw new MutationTargetMissing('css mutation did not apply')
  const m = /font-size: ([\d.]+)px; line-height: 20px/.exec(css)
  assert.ok(Math.abs(Number(m[1]) / 16 - 0.85) < 0.005)
})

// ================================================================================================================================================
// 3. one popup at a time (shared open state, Escape, outside click)
// ================================================================================================================================================
await run('the pure helpers: opening replaces, a late close from a replaced popup is ignored, closing the open one closes it', async () => {
  const { nextComposerPopup, escapeBelongsToDropdownList, keepPopupOpenForDropdownList } = createLoader({ env: {}, globals: { document: { activeElement: null } } }).load(POPUPS_LIB)
  for (const a of [null, 'template', 'theme', 'research']) for (const b of ['template', 'theme', 'research']) assert.equal(nextComposerPopup(a, b, true), b, `open ${b} from ${a}`)
  assert.equal(nextComposerPopup('theme', 'theme', false), null)
  assert.equal(nextComposerPopup('template', 'theme', false), 'template', 'a late close of theme cannot close template')
  assert.equal(nextComposerPopup(null, 'research', false), null)
  const el = (attrs) => ({ getAttribute: name => attrs[name] ?? null })
  assert.equal(escapeBelongsToDropdownList(el({ role: 'combobox', 'aria-expanded': 'true' })), true)
  assert.equal(escapeBelongsToDropdownList(el({ role: 'combobox', 'aria-expanded': 'false' })), false)
  assert.equal(escapeBelongsToDropdownList(el({ role: 'menu', 'aria-expanded': 'true' })), false)
  assert.equal(escapeBelongsToDropdownList(null), false)
  let prevented = 0
  const lib = (active) => createLoader({ env: {}, globals: { document: { activeElement: active } } }).load(POPUPS_LIB)
  lib(el({ role: 'combobox', 'aria-expanded': 'true' })).keepPopupOpenForDropdownList({ preventDefault: () => { prevented += 1 } })
  lib(el({ role: 'textbox' })).keepPopupOpenForDropdownList({ preventDefault: () => { prevented += 10 } })
  assert.equal(prevented, 1, 'Escape is held back only for an expanded combobox')
  assert.doesNotThrow(() => keepPopupOpenForDropdownList({ preventDefault() {} }), 'no document (server): no-op')
})
mutant('lib: opening a popup does not replace the open one', async () => {
  const lib = createLoader({ env: {}, mutate: { [POPUPS_LIB]: [['  if (open) return id\n', '  if (open) return current ?? id\n']] } }).load(POPUPS_LIB)
  assert.equal(lib.nextComposerPopup('theme', 'template', true), 'template')
})
mutant('lib: a late close closes whatever is open', async () => {
  const lib = createLoader({ env: {}, mutate: { [POPUPS_LIB]: [['  return current === id ? null : current', '  return null']] } }).load(POPUPS_LIB)
  assert.equal(lib.nextComposerPopup('template', 'theme', false), 'template')
})

async function popupScenario(env, opts = {}) {
  const log = []
  const props = makeProps({}, log)
  const { world, tree, render } = await renderComposer(env, props, opts)
  const states = []
  let current = tree
  const snap = async label => { current = await render(); states.push([label, openStates(current)]) }
  const act = async (which, open) => { menuNodes(current)[which].props.onOpenChange(open); await snap(`${which}.onOpenChange(${open})`) }
  states.push(['initial', openStates(current)])
  return { world, log, states, act, snap, get tree() { return current }, props }
}
const only = (states, name) => Object.entries(states).filter(([, open]) => open).map(([key]) => key).join(',') === name

await run('flag on: opening the theme, template or research popup closes the other two (one shared open-state); a late close is ignored; Escape and outside click (Radix onOpenChange(false)) close it', async () => {
  const s = await popupScenario(ON_ENV)
  deq(s.states[0][1], { theme: false, template: false, research: false })
  await s.act('theme', true); assert.ok(only(s.states.at(-1)[1], 'theme'), JSON.stringify(s.states.at(-1)))
  await s.act('template', true); assert.ok(only(s.states.at(-1)[1], 'template'), JSON.stringify(s.states.at(-1)))
  await s.act('research', true); assert.ok(only(s.states.at(-1)[1], 'research'), JSON.stringify(s.states.at(-1)))
  await s.act('theme', true); assert.ok(only(s.states.at(-1)[1], 'theme'))
  await s.act('research', false); assert.ok(only(s.states.at(-1)[1], 'theme'), 'a late close from a popup that was replaced does not close its replacement')
  await s.act('template', true); await s.act('theme', false); assert.ok(only(s.states.at(-1)[1], 'template'))
  await s.act('template', false); assert.ok(only(s.states.at(-1)[1], ''), 'Escape / outside click on the open popup closes it')
  // attach: opening the file picker closes whichever popup is open, and does not touch the session path until it asks for one
  await s.act('template', true)
  const attach = flat(s.tree).find(n => n.type === 'button' && n.props['aria-label'] === 'Upload a file')
  const pending = attach.props.onClick()
  await s.snap('attach click')
  assert.ok(only(s.states.at(-1)[1], ''), 'attach closes the open popup')
  await pending
  deq(s.log, [], 'no theme, template or library handler ran during any of this')
})
mutant('composer: the three popups keep their own open-states (both can be open at once)', async () => {
  const s = await popupScenario(ON_ENV, { mutate: { [CHAT_INPUT]: [["const themeOpen = popupsV2 ? composerPopup === 'theme' : themeMenuOpen", "const themeOpen = themeMenuOpen"], ["const setThemeOpen = popupsV2 ? popupSetter('theme') : setThemeMenuOpen", "const setThemeOpen = setThemeMenuOpen"]] } })
  await s.act('theme', true)
  await s.act('research', true)
  assert.ok(only(s.states.at(-1)[1], 'research'), `theme still open: ${JSON.stringify(s.states.at(-1))}`)
})
mutant('composer: the template popup keeps its own open-state', async () => {
  const s = await popupScenario(ON_ENV, { mutate: { [CHAT_INPUT]: [["onOpenChange: popupSetter('template'), ", ""]] } })
  await s.act('theme', true)
  await s.act('template', true)
  assert.ok(only(s.states.at(-1)[1], 'template'), `${JSON.stringify(s.states.at(-1))}`)
})
mutant('composer: attach does not close the open popup', async () => {
  const s = await popupScenario(ON_ENV, { mutate: { [CHAT_INPUT]: [["                    if (popupsV2) setComposerPopup(null)\n", ""]] } })
  await s.act('template', true)
  flat(s.tree).find(n => n.type === 'button' && n.props['aria-label'] === 'Upload a file').props.onClick()
  await s.snap('attach')
  assert.ok(only(s.states.at(-1)[1], ''), 'attach closes the open popup')
})

await run('flag off: the popups keep their separate open-states, as the base did (theme and research can both be open)', async () => {
  const s = await popupScenario({ [SHELL]: 'true' })
  await s.act('theme', true)
  await s.act('research', true)
  deq(s.states.at(-1)[1], { theme: true, research: true, template: false })
  assert.equal(menuNodes(s.tree).template.props.open, false, 'the template picker keeps its own (closed) state: the composer hands it no open prop')
})

await run('Escape: with the flag on, the theme popup holds Escape back while a dropdown list is open; with it off there is no such handler', async () => {
  const on = await renderComposer(ON_ENV, makeProps())
  const contentOn = flat(menuNodes(on.tree).theme).find(n => n.type === 'DropdownMenuContent')
  assert.equal(typeof contentOn.props.onEscapeKeyDown, 'function')
  assert.equal(contentOn.props['data-studio-composer-dd'], 'true')
  const off = await renderComposer({ [SHELL]: 'true' }, makeProps())
  const contentOff = flat(menuNodes(off.tree).theme).find(n => n.type === 'DropdownMenuContent')
  assert.ok(!('onEscapeKeyDown' in contentOff.props) && !('data-studio-composer-dd' in contentOff.props))
})

// ================================================================================================================================================
// the dropdown component, as the composer uses it
// ================================================================================================================================================
function mountDropdown() {
  const runtime = createRuntime()
  const stubs = { react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }) }
  const mod = createLoader({ env: ON_ENV, stubs, globals: { document: { getElementById: () => ({ scrollIntoView() {}, focus() {} }) } } }).load(DROPDOWN)
  return { mod, render: props => runtime.render(mod.ThemeDropdownPicker, props) }
}
const comboOf = tree => flat(tree).find(node => node.type === 'input' && node.props.role === 'combobox')
const optionsOf = tree => flat(tree).filter(node => node.props?.role === 'option')
const ev = (key = '', over = {}) => { const e = { key, prevented: false, stopped: false, preventDefault() { e.prevented = true }, stopPropagation() { e.stopped = true }, target: {}, currentTarget: { select() {} }, ...over }; return e }
const COMPOSER_COPY = { label: 'My templates', help: null, placeholder: 'Search your templates', singular: 'template', plural: 'templates', groups: false, none: 'No saved templates yet.' }
const OPTIONS = [
  { id: 'a', name: 'Quarterly business review', hint: 'Eight-slide QBR', swatches: [], current: false, sub: '8 slides · Ready', search: 'Quarterly business review Eight-slide QBR' },
  { id: 'b', name: 'Product launch', hint: '', swatches: [], current: false, sub: '12 slides · Needs cleanup', muted: true },
  { id: 'c', name: 'Northwind', hint: '', swatches: ['#0f766e'], current: false, sub: '★ Standard' },
  { id: 'd', name: 'Bare', hint: '', swatches: [], current: false, sub: '' },
]
await run('the dropdown with the composer\'s wording: label, no help line, no group headings, no preview; a sub line or swatches; search by name or description; choose = onSelect(id)', async () => {
  const { render } = mountDropdown()
  let chosen = []
  const base = { options: OPTIONS, selectedId: null, locked: false, onSelect: id => chosen.push(id), copy: COMPOSER_COPY }
  let tree = render(base)
  assert.equal(text(flat(tree).find(n => n.type === 'label')), 'My templates')
  assert.equal(flat(tree).filter(n => n.props?.className === 'stpdd-help').length, 0, 'no help line')
  assert.equal(flat(tree).filter(n => n.props?.['data-studio-theme-preview']).length, 0, 'no preview')
  assert.equal(comboOf(tree).props.placeholder, 'Search your templates')
  assert.equal(comboOf(tree).props['aria-describedby'], undefined)
  assert.equal(optionsOf(tree).length, 0, 'closed: no list')
  // open, filter by description, choose
  comboOf(tree).props.onClick(ev())
  tree = render(base)
  assert.equal(optionsOf(tree).length, 4)
  assert.equal(flat(tree).filter(n => n.props?.className === 'stpdd-group-label').length, 0, 'no group headings')
  const subs = flat(tree).filter(n => n.props?.className === 'stpdd-option-sub').map(text)
  deq(subs, ['8 slides · Ready', '12 slides · Needs cleanup', '★ Standard'], 'a sub line where given (with swatches too); none for the empty sub')
  assert.equal(flat(tree).filter(n => n.props?.className === 'stpdd-swatches').length, 1, 'swatches where given')
  assert.equal(optionsOf(tree).find(n => n.props['data-studio-theme-preset'] === 'b').props['data-muted'], 'true')
  comboOf(tree).props.onChange(ev('', { target: { value: 'qbr' } }))
  tree = render(base)
  deq(optionsOf(tree).map(n => n.props['data-studio-theme-preset']), ['a'], 'matches the description through `search`')
  comboOf(tree).props.onKeyDown(ev('Enter'))
  deq(chosen, ['a'])
  tree = render(base)
  assert.equal(optionsOf(tree).length, 0, 'choosing closes the list')
  // Escape closes only the list
  comboOf(tree).props.onClick(ev()); tree = render(base)
  const esc = ev('Escape')
  comboOf(tree).props.onKeyDown(esc)
  assert.ok(esc.prevented && esc.stopped, 'Escape with an open list is consumed by the list')
  assert.equal(optionsOf(render(base)).length, 0)
  const esc2 = ev('Escape')
  comboOf(render(base)).props.onKeyDown(esc2)
  assert.ok(!esc2.prevented && !esc2.stopped, 'Escape with the list closed passes through (it closes the popup)')
  // nothing typed and no options: the empty wording; a miss: "No templates match"
  tree = render({ ...base, options: [] }); comboOf(tree).props.onClick(ev()); tree = render({ ...base, options: [] })
  assert.equal(text(flat(tree).find(n => n.props?.['data-studio-theme-empty'])), 'No saved templates yet.')
  comboOf(tree).props.onChange(ev('', { target: { value: 'zzz' } })); tree = render({ ...base, options: [] })
  assert.equal(text(flat(tree).find(n => n.props?.['data-studio-theme-empty'])), 'No templates match “zzz”.')
  // locked: disabled and closed
  tree = render({ ...base, locked: true })
  assert.equal(comboOf(tree).props.disabled, true)
})
await run('the dropdown with its default wording is the #372 one (label "Theme", "Type to search", group headings, preview)', async () => {
  const { mod, render } = mountDropdown()
  deq(plain(mod.THEME_DROPDOWN_COPY), { label: 'Theme', help: 'Type to search', placeholder: 'Search themes', singular: 'theme', plural: 'themes', groups: true })
  const options = [{ id: 'auto', name: 'Auto', hint: '', swatches: [], current: true }, { id: 'minimal', name: 'Minimal', hint: '', swatches: ['#334155', '#94a3b8'], current: false }]
  const tree = render({ options, selectedId: 'auto', locked: false, preview: { kind: 'auto' }, onSelect() {} })
  assert.equal(text(flat(tree).find(n => n.type === 'label')), 'Theme')
  assert.equal(text(flat(tree).find(n => n.props?.className === 'stpdd-help')), 'Type to search')
  assert.equal(flat(tree).filter(n => n.props?.['data-studio-theme-preview']).length, 1)
  comboOf(tree).props.onClick(ev())
  const open = render({ options, selectedId: 'auto', locked: false, preview: { kind: 'auto' }, onSelect() {} })
  deq(flat(open).filter(n => n.props?.className === 'stpdd-group-label').map(text), ['Current theme', 'Other themes'])
  assert.equal(text(flat(open).find(n => n.props?.className === 'stpdd-option-sub')), 'Director picks for you', 'Auto without swatches keeps its default sub line')
})
mutant('dropdown: a search ignores the description (`search` is dropped)', async () => {
  const { mod } = { mod: null }
  const runtime = createRuntime()
  const stubs = { react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }) }
  const m = createLoader({ env: ON_ENV, stubs, globals: { document: { getElementById: () => ({ scrollIntoView() {}, focus() {} }) } }, mutate: { [DROPDOWN]: [["themeDropdownMatches(option.search ?? option.name, query))\n  const rest", "themeDropdownMatches(option.name, query))\n  const rest"], ["!option.current && themeDropdownMatches(option.search ?? option.name, query)", "!option.current && themeDropdownMatches(option.name, query)"]] } }).load(DROPDOWN)
  const base = { options: OPTIONS, selectedId: null, locked: false, onSelect() {}, copy: COMPOSER_COPY }
  const tree = runtime.render(m.ThemeDropdownPicker, base)
  comboOf(tree).props.onClick(ev())
  comboOf(runtime.render(m.ThemeDropdownPicker, base)).props.onChange(ev('', { target: { value: 'qbr' } }))
  deq(optionsOf(runtime.render(m.ThemeDropdownPicker, base)).map(n => n.props['data-studio-theme-preset']), ['a'])
})

// ================================================================================================================================================
// 2. the theme popup: two dropdowns; same apply handlers and payloads
// ================================================================================================================================================
const themeChoices = [{ name: 'auto', pick: 'auto' }, ...PRESETS.map(p => ({ name: p.preset_id, pick: p.preset_id })), ...SAVED.map(t => ({ name: t.id, pick: t.id, saved: true }))]
async function applyThroughComposer(env, choice, { recorder }) {
  const log = []
  const props = makeProps({}, log)
  const { world, tree: first, render } = await renderComposer(env, props, { recorder })
  // opening the popup refreshes the saved themes (the same read in both modes)
  menuNodes(first).theme.props.onOpenChange(true)
  const tree = await render()
  if (recorder) {
    const pickers = flat(menuNodes(tree).theme).filter(n => n.type === 'ThemeDropdownPicker')
    const mine = pickers.find(n => n.props.copy.label === 'My themes'), deckster = pickers.find(n => n.props.copy.label === 'Deckster themes')
    assert.ok(mine && deckster, 'two dropdowns in the theme popup')
    ;(choice.saved ? mine : deckster).props.onSelect(choice.pick)
  } else {
    const row = flat(menuNodes(tree).theme).find(n => n.props?.['data-studio-theme-choice'] === (choice.saved ? `saved:${choice.pick}` : choice.pick === 'auto' ? 'auto' : `preset:${choice.pick}`))
    assert.ok(row, `row for ${choice.name}`)
    row.props.onClick()
  }
  await tick()
  return { log, tree: await render() }
}
await run('theme apply: choosing Auto, each preset or each saved theme in the dropdowns calls the same handlers with the same payloads as the list rows did', async () => {
  for (const choice of themeChoices) {
    const before = await applyThroughComposer({ [SHELL]: 'true' }, choice, { recorder: false })
    const after = await applyThroughComposer(ON_ENV, choice, { recorder: true })
    deq(after.log, before.log, `${choice.name}: onBuildThemeChange / onActiveBuildThemeProfileChange calls`)
    assert.ok(before.log.length >= 1, `${choice.name}: something was applied`)
  }
  // spot-check the payloads themselves
  const auto = await applyThroughComposer(ON_ENV, { pick: 'auto' }, { recorder: true })
  deq(auto.log, [['onActiveBuildThemeProfileChange', null], ['onBuildThemeChange', { mode: 'auto' }]])
  const preset = await applyThroughComposer(ON_ENV, { pick: 'minimal' }, { recorder: true })
  deq(preset.log, [['onActiveBuildThemeProfileChange', null], ['onBuildThemeChange', { mode: 'preset', preset_id: 'minimal' }]])
  const saved = await applyThroughComposer(ON_ENV, { pick: 'th-3', saved: true }, { recorder: true })
  deq(saved.log, [['onActiveBuildThemeProfileChange', { id: 'th-3', name: 'Workshop warm', theme_payload: { mode: 'preset', preset_id: 'pastel' } }], ['onBuildThemeChange', { mode: 'preset', preset_id: 'pastel' }]])
})
mutant('theme popup: the Deckster dropdown sends presets to the saved-theme handler', async () => {
  const mutate = { [THEME_MENU]: [["onSelect={p.onPreset} copy={DECKSTER_THEMES_COPY}", "onSelect={p.onSaved} copy={DECKSTER_THEMES_COPY}"]] }
  const log = []
  const { tree } = await renderComposer(ON_ENV, makeProps({}, log), { recorder: true, mutate })
  menuNodes(tree).theme.props.onOpenChange(true)
  const picker = flat(menuNodes(tree).theme).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'Deckster themes')
  picker.props.onSelect('minimal')
  deq(log, [['onActiveBuildThemeProfileChange', null], ['onBuildThemeChange', { mode: 'preset', preset_id: 'minimal' }]])
})

await run('theme popup (flag on): two dropdowns, "Deckster themes" (Auto + presets) and "My themes" (saved); Brand color, "Save or set standard…" and "Manage themes" stay; the lock disables the dropdowns', async () => {
  const world = makeWorld({ env: ON_ENV, recorder: true })
  const { StudioThemeMenu } = world.loader.load(THEME_MENU)
  const log = []
  let tree = world.runtime.render(StudioThemeMenu, themeMenuProps({ dropdowns: true, log, selection: { mode: 'preset', preset_id: 'minimal' } }))
  const pickers = flat(tree).filter(n => n.type === 'ThemeDropdownPicker')
  deq(pickers.map(n => n.props.copy.label), ['Deckster themes', 'My themes'])
  const [deckster, mine] = pickers
  deq(deckster.props.options.map(o => o.id), ['auto', ...PRESETS.map(p => p.preset_id)], 'Auto first, then the presets in order')
  deq(mine.props.options.map(o => o.id), SAVED.map(t => t.id))
  assert.equal(deckster.props.selectedId, 'minimal')
  assert.equal(mine.props.selectedId, null)
  assert.equal(deckster.props.options[0].sub, 'Your standard theme · Northwind brand')
  assert.equal(mine.props.options[0].sub, '★ Standard')
  deq(plain(mine.props.options[0].swatches), ['#0f766e'], 'explicit primary colours only')
  deq(plain(mine.props.options[2].swatches), [], 'unknown palettes keep no swatch')
  deq(plain(mine.props.options[3].swatches), ['#123456'], 'a primary override is a swatch')
  assert.ok(mine.props.labelAccessory, 'Refresh sits in the My themes label row')
  // the rest of the popup is unchanged
  assert.ok(flat(tree).some(n => n.props?.className === 'studio-theme-brand'), 'Brand color')
  deq(flat(tree).filter(n => n.props?.['data-studio-theme-action']).map(n => n.props['data-studio-theme-action']), ['close', 'save-entry', 'manage-entry'])
  deq(flat(tree).filter(n => n.props?.['data-studio-theme-action'] === 'save-entry' || n.props?.['data-studio-theme-action'] === 'manage-entry').map(text), ['Save or set standard…', 'Manage themes '])
  assert.equal(flat(tree).filter(n => n.props?.['data-studio-theme-choice']).length, 0, 'the long list is gone')
  // selection follows the app state: a saved theme chosen, a brand colour, Auto
  tree = world.runtime.render(StudioThemeMenu, themeMenuProps({ dropdowns: true, selection: { mode: 'custom', primary_hex: '#7c3aed' }, selectedId: 'th-2' }))
  const p2 = flat(tree).filter(n => n.type === 'ThemeDropdownPicker')
  assert.equal(p2[0].props.selectedId, null); assert.equal(p2[1].props.selectedId, 'th-2')
  tree = world.runtime.render(StudioThemeMenu, themeMenuProps({ dropdowns: true, selection: { mode: 'auto' } }))
  assert.equal(flat(tree).filter(n => n.type === 'ThemeDropdownPicker')[0].props.selectedId, 'auto')
  // locks: the whole thing disables, presets also while they load
  tree = world.runtime.render(StudioThemeMenu, themeMenuProps({ dropdowns: true, locked: true }))
  assert.ok(flat(tree).filter(n => n.type === 'ThemeDropdownPicker').every(n => n.props.locked === true))
  tree = world.runtime.render(StudioThemeMenu, themeMenuProps({ dropdowns: true, presetsLoading: true }))
  deq(flat(tree).filter(n => n.type === 'ThemeDropdownPicker').map(n => n.props.locked), [true, false])
  // the Save and Manage views are untouched by the flag
  for (const view of ['save', 'manage']) {
    const off = world.runtime.render(StudioThemeMenu, themeMenuProps({ view }))
    const on = world.runtime.render(StudioThemeMenu, themeMenuProps({ view, dropdowns: true }))
    assert.equal(ser(on), ser(off), `${view} view`)
  }
})

// ================================================================================================================================================
// 4. the template popup: two dropdowns; same use handlers; two actions
// ================================================================================================================================================
async function mountTemplates(env, props, opts = {}) {
  const world = makeWorld({ env, ...opts })
  const mod = world.loader.load(TEMPLATE_PICKER)
  return { world, mod, render: () => settle(world.runtime, mod.TemplatePickerContent, props) }
}
await run('template use: choosing a template in "My templates" calls onSelect with the same selection payload (and the same toast for one that is not ready) as the card did', async () => {
  for (const mode of ['generation', 'review']) {
    for (const template of TEMPLATES) {
      const offLog = [], onLog = []
      const off = await mountTemplates({ [SHELL]: 'true' }, { onSelect: v => offLog.push(plain(v)), isOpen: true, mode })
      const offTree = await off.render()
      flat(offTree).filter(n => n.props?.className === 'stp-main')[TEMPLATES.indexOf(template)].props.onClick()
      let closed = 0
      const on = await mountTemplates(ON_ENV, { onSelect: v => onLog.push(plain(v)), isOpen: true, mode, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: true, onClose: () => { closed += 1 }, onNewTemplate() {} } }, { recorder: true })
      const onTree = await on.render()
      const mine = flat(onTree).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates')
      mine.props.onSelect(template.id)
      deq(onLog, offLog, `${mode} ${template.id}: onSelect payload`)
      deq(plain(on.world.toasts), plain(off.world.toasts), `${mode} ${template.id}: toast`)
      const usable = mode !== 'generation' || (template.blueprint_generation_method === 'llm' && template.blueprint_enrichment_status === 'complete' && template.template_purity_status === 'clean')
      assert.equal(onLog.length, usable ? 1 : 0, `${mode} ${template.id}: only a usable template is selected`)
      assert.equal(closed, usable ? 1 : 0, `${mode} ${template.id}: a usable template closes the popup, one that is not ready explains why and stays`)
    }
  }
  const payload = []
  const t = await mountTemplates(ON_ENV, { onSelect: v => payload.push(plain(v)), isOpen: true, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: true, onClose() {} } }, { recorder: true })
  flat(await t.render()).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates').props.onSelect('tp-1')
  deq(payload, [{ id: 'tp-1', name: 'Quarterly business review', blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', blueprint_enrichment_error: undefined, template_purity_status: 'clean', template_purity_error: undefined }].map(plain))
})
mutant('template popup: choosing sends a selection with the wrong id', async () => {
  const log = []
  const t = await mountTemplates(ON_ENV, { onSelect: v => log.push(v.id), isOpen: true, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: true, onClose() {} } }, { recorder: true, mutate: { [TEMPLATE_PICKER]: [["const template = templates?.find(item => item.id === id)\n      if (!template) return", "const template = templates?.[0]\n      if (!template) return"]] } })
  flat(await t.render()).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates').props.onSelect('tp-2')
  deq(log, ['tp-2'])
})
mutant('template popup: a template that is not ready is selected anyway (the readiness rule is bypassed)', async () => {
  const log = []
  const t = await mountTemplates(ON_ENV, { onSelect: v => log.push(v.id), isOpen: true, mode: 'generation', dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: true, onClose() {} } }, { recorder: true, mutate: { [TEMPLATE_PICKER]: [["      handleTemplateClick(template)\n      // As with", "      onSelect({ id: template.id, name: template.name })\n      // As with"]] } })
  flat(await t.render()).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates').props.onSelect('tp-3')
  deq(log, [])
})

await run('template popup (flag on): "Deckster templates" (none provided yet: disabled, honest wording) and "My templates" (the same saved records); Template library → and New template…; retry for a failed one', async () => {
  const log = []
  let closed = 0, newTemplate = 0
  // (PASS2-COMPOSER-POPUPS fix) Saved templates without a composer library: "Template library" is the Templates page, which works here
  // because saved templates are connected (NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED). Without that flag the page is never linked (see below).
  const t = await mountTemplates({ ...ON_ENV, NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: 'true' }, { onSelect: v => log.push(v), isOpen: true, dropdowns: { selectedTemplateId: 'tp-2', locked: false, savedTemplates: true, onClose: () => { closed += 1 }, onNewTemplate: () => { newTemplate += 1 } } }, { recorder: true })
  const tree = await t.render()
  const [deckster, mine] = flat(tree).filter(n => n.type === 'ThemeDropdownPicker')
  deq([deckster.props.copy.label, mine.props.copy.label], ['Deckster templates', 'My templates'])
  deq(deckster.props.options, [])
  assert.equal(deckster.props.locked, true, 'nothing to pick yet')
  assert.equal(deckster.props.copy.placeholder, 'No Deckster templates yet')
  deq(mine.props.options.map(o => o.id), TEMPLATES.map(x => x.id), 'the same records, in the same order, as the cards')
  assert.equal(mine.props.selectedId, 'tp-2')
  assert.equal(mine.props.options[0].sub, '8 slides · Ready')
  assert.equal(mine.props.options[2].sub, '10 slides · Optimizing')
  assert.equal(mine.props.options[4].sub, 'Saved template · Needs cleanup')
  assert.equal(mine.props.options[2].muted, true); assert.equal(mine.props.options[0].muted, false)
  // the two actions
  const link = flat(tree).find(n => n.type === 'a')
  assert.equal(link.props.href, '/studio/templates')
  assert.match(text(link), /^Template library/)
  link.props.onClick(); assert.equal(closed, 1)
  const newButton = flat(tree).find(n => n.props?.['data-studio-template-action'] === 'new')
  assert.equal(text(newButton), 'New template…')
  assert.ok(flat(newButton).some(n => n.type === 'Icon:Plus'), 'with its icon')
  newButton.props.onClick(); assert.equal(newTemplate, 1)
  // retry: a failed or needs-cleanup template can still be retried (the same re-optimize call as the card's button)
  const rows = flat(tree).filter(n => n.props?.className === 'stcd-attention-row')
  deq(rows.map(r => text(flat(r).find(n => n.props?.className === 'stcd-attention-head'))), ['Case study · FailedRetry', 'Needs cleanup · Needs cleanupRetry'])
  flat(rows[0]).find(n => n.props?.className === 'stcd-retry').props.onClick()
  await tick(); await tick()
  deq(t.world.calls.reoptimize, ['tp-4'])
  // no upload flow in this environment: no New template…; no saved templates: only the actions
  const noLibrary = await mountTemplates(ON_ENV, { onSelect() {}, isOpen: true, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: true, onClose() {} } }, { recorder: true })
  assert.equal(flat(await noLibrary.render()).filter(n => n.props?.['data-studio-template-action'] === 'new').length, 0)
  const noSaved = await mountTemplates(ON_ENV, { onSelect() {}, isOpen: false, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: false, onClose() {}, onNewTemplate() {} } }, { recorder: true })
  const noSavedTree = await noSaved.render()
  assert.equal(flat(noSavedTree).filter(n => n.type === 'ThemeDropdownPicker').length, 0)
  assert.equal(noSaved.world.calls.listTemplates, 0, 'no templates are requested when saved templates are off')
  // (PASS2-COMPOSER-POPUPS fix) the upload flow and the library stay; "Template library" opens the library dialog, never the disabled page
  let library = 0
  const noSavedWithLibrary = await mountTemplates(ON_ENV, { onSelect() {}, isOpen: false, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: false, onClose() {}, onNewTemplate() {}, onLibrary: () => { library += 1 } } }, { recorder: true })
  const noSavedWithLibraryTree = await noSavedWithLibrary.render()
  assert.ok(flat(noSavedWithLibraryTree).some(n => n.props?.['data-studio-template-action'] === 'new'))
  assert.equal(flat(noSavedWithLibraryTree).filter(n => n.type === 'a').length, 0, 'no link to /studio/templates')
  flat(noSavedWithLibraryTree).find(n => n.type === 'button' && n.props['data-studio-template-action'] === 'library').props.onClick()
  assert.equal(library, 1)
  assert.equal(flat(noSavedTree).filter(n => n.props?.['data-studio-template-action'] === 'library').length, 0, 'no library and the page is disabled here: no library link at all')
  // a locked deck: dropdowns locked with the lock wording, the actions stay
  const locked = await mountTemplates({ ...ON_ENV, NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: 'true' }, { onSelect() {}, isOpen: true, dropdowns: { selectedTemplateId: null, locked: true, savedTemplates: true, onClose() {}, onNewTemplate() {} } }, { recorder: true })
  const lockedTree = await locked.render()
  assert.ok(flat(lockedTree).filter(n => n.type === 'ThemeDropdownPicker').every(n => n.props.locked))
  assert.match(text(lockedTree), /Template selection is locked for this deck\./)
  assert.ok(flat(lockedTree).some(n => n.type === 'a') && flat(lockedTree).some(n => n.props?.['data-studio-template-action'] === 'new'))
})

await run('template popup (flag on): the picker is controlled by the composer, hands it the open-state, and opens the library or the upload flow through the handlers it was given', async () => {
  const world = makeWorld({ env: ON_ENV, recorder: true })
  const { TemplatePicker } = world.loader.load(TEMPLATE_PICKER)
  const changes = []
  const tree = world.runtime.render(TemplatePicker, { onSelect() {}, onOpenLibrary: () => changes.push('library'), showSavedTemplates: true, dropdowns: true, open: true, onOpenChange: v => changes.push(v), selectedTemplateId: 'tp-1' })
  const menu = flat(tree).find(n => n.type === 'DropdownMenu')
  assert.equal(menu.props.open, true)
  menu.props.onOpenChange(false)
  deq(changes, [false])
  const content = flat(tree).find(n => n.type === 'DropdownMenuContent')
  assert.equal(content.props['data-studio-composer-menu'], 'template')
  assert.equal(content.props['data-studio-composer-dd'], 'true')
  assert.equal(typeof content.props.onEscapeKeyDown, 'function')
  const tab = ev('Tab'); content.props.onKeyDownCapture(tab); assert.ok(tab.stopped, 'Tab reaches the browser (native traversal)')
  const other = ev('a'); content.props.onKeyDownCapture(other); assert.ok(!other.stopped)
  assert.equal(flat(tree).filter(n => n.type === 'DropdownMenuItem').length, 0, 'no menu items: typing in the dropdowns is never taken by the menu\'s type-ahead')
  const closed = world.runtime.render(TemplatePicker, { onSelect() {}, dropdowns: true, open: false, onOpenChange() {} })
  assert.equal(flat(closed).find(n => n.type === 'DropdownMenu').props.open, false)
  // the trigger keeps its rules (disabled while loading; locked without a library)
  const trig = props => flat(world.runtime.render(TemplatePicker, { onSelect() {}, ...props })).find(n => n.type === 'button')
  assert.equal(trig({ dropdowns: true, open: false, onOpenChange() {}, disabled: true }).props.disabled, true)
  assert.equal(trig({ dropdowns: true, open: false, onOpenChange() {}, selectionLocked: true }).props.disabled, true)
  assert.equal(trig({ dropdowns: true, open: false, onOpenChange() {}, selectionLocked: true, onOpenLibrary() {} }).props.disabled, false)
})

async function uncontrolledPicker(mutate = {}) {
  const world = makeWorld({ env: { [SHELL]: 'true' }, mutate })
  const { TemplatePicker } = world.loader.load(TEMPLATE_PICKER)
  const props = { onSelect() {}, onOpenLibrary() {}, showSavedTemplates: true }
  let tree = await settle(world.runtime, TemplatePicker, props)
  assert.equal(flat(tree).find(n => n.type === 'DropdownMenu').props.open, false)
  flat(tree).find(n => n.type === 'DropdownMenu').props.onOpenChange(true)
  tree = await settle(world.runtime, TemplatePicker, props)
  assert.equal(flat(tree).find(n => n.type === 'DropdownMenu').props.open, true)
  flat(tree).find(n => n.type === 'DropdownMenu').props.onOpenChange(false)
  tree = await settle(world.runtime, TemplatePicker, props)
  assert.equal(flat(tree).find(n => n.type === 'DropdownMenu').props.open, false)
  // the library item closes the picker, then opens the library (as before)
  flat(tree).find(n => n.type === 'DropdownMenu').props.onOpenChange(true)
  tree = await settle(world.runtime, TemplatePicker, props)
  const item = flat(tree).find(n => n.type === 'DropdownMenuItem')
  item.props.onSelect()
  tree = await settle(world.runtime, TemplatePicker, props)
  assert.equal(flat(tree).find(n => n.type === 'DropdownMenu').props.open, false)
}
await run('uncontrolled (flag off): the picker keeps its own open-state and opens and closes itself, exactly as before', () => uncontrolledPicker())

await run('the Deckster-provided template list is empty (no catalog exists) and the popup is ready for one', async () => {
  const lib = createLoader({ env: {} }).load(POPUPS_LIB)
  deq([...lib.DECKSTER_PROVIDED_TEMPLATES], [])
  const log = []
  const t = await mountTemplates(ON_ENV, { onSelect: v => log.push(v.id), isOpen: true, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: true, onClose() {} } }, { recorder: true })
  // with a provided template in the catalog the dropdown lists it (same card shape), unlocked
  const filled = createLoader({ env: ON_ENV, stubs: t.world.stubs, mutate: { [POPUPS_LIB]: [['export const DECKSTER_PROVIDED_TEMPLATES: readonly DecksterTemplateOption[] = []', "export const DECKSTER_PROVIDED_TEMPLATES: readonly DecksterTemplateOption[] = [{ id: 'dk-1', name: 'Deckster pitch', description: 'Provided', slideCount: 9 }]"]] } })
  const fakeLib = filled.load(POPUPS_LIB)
  assert.equal(fakeLib.DECKSTER_PROVIDED_TEMPLATES.length, 1)
})

// ================================================================================================================================================
// 4b. PASS2-COMPOSER-POPUPS fix: the template popup lists the composer library's templates, runs their actions through the library dialog, and
//     "Template library" opens the working library (never the disabled /studio/templates page)
// ================================================================================================================================================
const DIALOG_ENV_ON = { ...ON_ENV, ...COMPOSER_ENV }
const DIALOG_ENV_OFF = { [SHELL]: 'true', ...COMPOSER_ENV }

/** Flag off: the library dialog as it is today. Open it, click a template's action (as a person would), and record everything that leaves. */
async function flagOffDialogAction({ action, templateId, brief, pending = null, mutate = {} }) {
  const services = composerServices({ pending })
  const { world, ComposerLibraryDialog } = mountDialog({ env: DIALOG_ENV_OFF, services, mutate })
  const props = () => ({ open: true, onOpenChange() {} })
  let tree = await drain(world.runtime, ComposerLibraryDialog, props, 6)
  const record = flat(tree).find(n => n.props?.['data-studio-composer-record'] === templateId)
  assert.ok(record, `the dialog lists ${templateId}`)
  const button = flat(record).find(n => n.props?.['data-studio-composer-action'] === action)
  if (!button.props.disabled) button.props.onClick()
  tree = await drain(world.runtime, ComposerLibraryDialog, props, 6)
  if (action === 'new-topic' && brief !== undefined) {
    flat(tree).find(n => n.props?.id === 'composer-new-brief').props.onChange({ target: { value: brief } })
    tree = await drain(world.runtime, ComposerLibraryDialog, props, 2)
    flat(tree).find(n => n.props?.['data-studio-composer-action'] === 'create').props.onClick()
  }
  services.release()
  tree = await drain(world.runtime, ComposerLibraryDialog, props, 40)
  return { log: collapse(services.log), tree, buttonDisabled: Boolean(button.props.disabled) }
}

/** Flag on, end to end on the real sources: page.tsx's wiring -> the composer -> the template popup -> page.tsx's dialog element -> the dialog. */
async function flagOnPopupAction({ action, templateId, brief, pending = null, mutate = {}, page = read(PAGE), user = { id: OWNER }, rerenderWithSameRequest = false }) {
  const wiring = pageWiring(page)
  const pageState = { request: null, show: false }
  const pageScope = () => ({ studioPopupsV2: true, studioTemplateWorkspace: false, composerLibraryEnabled: true, showComposerLibrary: pageState.show, composerLibraryRequest: pageState.request,
    setShowComposerLibrary: v => { pageState.show = v }, setComposerLibraryRequest: v => { pageState.request = v }, ComposerLibraryDialog: 'ComposerLibraryDialog' })
  const fixSpread = wiring.ChatInput.spreads.filter(x => FIX_SPREAD.test(x))
  assert.equal(fixSpread.length, 1, 'page.tsx hands ChatInput the action handler through one spread')
  const fromPage = compileJsx(fixSpread[0], 'ChatInput spread')(pageScope())
  // the composer (real chat-input; the picker recorded) hands the page's handler and the signed-in identity to the template picker
  const composerWorld = makeWorld({ env: DIALOG_ENV_ON, mutate, stubs: { './template-picker': { TemplatePicker: props => jsx('TemplatePicker', props) } } })
  const { ChatInput } = composerWorld.loader.load(CHAT_INPUT)
  const composerTree = await settle(composerWorld.runtime, ChatInput, makeProps({ ...fromPage, templateBuilderEnabled: false, onSelectTemplate: undefined, user }))
  const picker = flat(composerTree).find(n => n.type === 'TemplatePicker').props
  // the popup (real template picker) lists the library's templates, one is picked, its action is clicked
  const popupServices = composerServices()
  const popupWorld = makeWorld({ env: DIALOG_ENV_ON, recorder: true, mutate, globals: popupServices.globals })
  const { ComposerTemplatePopupBody } = popupWorld.loader.load(TEMPLATE_PICKER)
  let closed = 0
  const body = () => ({ onSelect: refuse, open: true, mode: 'generation', showSavedTemplates: Boolean(picker.showSavedTemplates), selectionLocked: false, selectedTemplateId: null,
    onClose: () => { closed += 1 }, onOpenLibrary: picker.onOpenLibrary, onComposerAction: picker.onComposerAction, composerUserId: picker.composerUserId ?? null })
  let popup = await drain(popupWorld.runtime, ComposerTemplatePopupBody, body, 6)
  flat(popup).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates').props.onSelect(`composer:${templateId}`)
  popup = await drain(popupWorld.runtime, ComposerTemplatePopupBody, body, 2)
  flat(popup).find(n => n.props?.['data-studio-template-composer-action'] === action).props.onClick()
  // the page opens the library dialog with the request (the element from page.tsx), and the dialog runs it
  const services = composerServices({ pending })
  const { world, ComposerLibraryDialog } = mountDialog({ env: DIALOG_ENV_ON, services, mutate })
  const dialogProps = () => compileJsx(wiring.ComposerLibraryDialog.node, 'dialog element')(pageScope()).props
  const shown = pageState.show
  const picked = pageState.request
  let tree = await drain(world.runtime, ComposerLibraryDialog, dialogProps, 6)
  if (rerenderWithSameRequest) {
    // a later page render that still carries the same request (with a new onRequestTaken, as the page's inline arrow is): once the first
    // run is over, it must not run again
    tree = await drain(world.runtime, ComposerLibraryDialog, dialogProps, 40)
    assert.ok(picked, 'the page held a request')
    tree = await drain(world.runtime, ComposerLibraryDialog, () => ({ ...dialogProps(), request: picked, onRequestTaken: () => {} }), 20)
  }
  if (action === 'new-topic' && brief !== undefined) {
    flat(tree).find(n => n.props?.id === 'composer-new-brief').props.onChange({ target: { value: brief } })
    tree = await drain(world.runtime, ComposerLibraryDialog, dialogProps, 2)
    flat(tree).find(n => n.props?.['data-studio-composer-action'] === 'create').props.onClick()
  }
  services.release()
  tree = await drain(world.runtime, ComposerLibraryDialog, dialogProps, 40)
  return { log: collapse(services.log), tree, popupLog: popupServices.log, popup, picker, fromPage, closed, shown, pageState }
}
/** A resumed job is polled until it ends; how many polls depends on timing, so repeated identical entries count once. */
function collapse(log) { return log.filter((entry, i) => i === 0 || ser(entry) !== ser(log[i - 1])) }
const strip = log => log.map(entry => entry[0] === 'fetch' ? `${entry[2].method} ${entry[1]} ${entry[2].body ?? ''}` : entry.join(' '))

await run('fix: the popup lists the composer library\'s own list: the same request as the library dialog (path, method, cache, no body), read the same way, and only while open for a signed-in user', async () => {
  // the dialog's own request when it opens (flag off)
  const off = await flagOffDialogAction({ action: 'use', templateId: 'cmp-j1' })
  const dialogList = off.log.filter(e => e[0] === 'fetch' && e[1].endsWith('/templates'))[0]
  deq(dialogList, ['fetch', '/api/composer-library/templates', { method: 'GET', cache: 'no-store', signal: null, headers: null, body: null }])
  // the popup's request (flag on)
  const on = await flagOnPopupAction({ action: 'use', templateId: 'cmp-j1' })
  deq(on.popupLog, [dialogList], 'one request, identical to the dialog\'s')
  const mine = flat(on.popup).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates')
  deq(mine.props.options.map(o => [o.id, o.name, o.sub]), COMPOSER_TEMPLATES.map(t => [`composer:${t.id}`, t.name, `${t.stage_template_summary?.slide_count ?? t.slide_count ?? 0} slides`]), 'the dialog\'s records, names and slide counts, in its order')
  deq(flat(off.tree).filter(n => n.props?.['data-studio-composer-name']).map(text), COMPOSER_TEMPLATES.map(t => t.name), 'the dialog shows the same records')
  // readiness: nothing is requested while closed, signed out, or without a composer library (the dialog's rule: open and signed in)
  for (const [name, over] of [['closed', { open: false }], ['signed out', { composerUserId: null }], ['no composer library', { onComposerAction: undefined }]]) {
    const services = composerServices()
    const world = makeWorld({ env: DIALOG_ENV_ON, recorder: true, globals: services.globals })
    const { ComposerTemplatePopupBody } = world.loader.load(TEMPLATE_PICKER)
    const props = { onSelect: refuse, open: true, mode: 'generation', showSavedTemplates: false, selectionLocked: false, selectedTemplateId: null, onClose() {}, onOpenLibrary() {}, onComposerAction() {}, composerUserId: OWNER, ...over }
    const tree = await drain(world.runtime, ComposerTemplatePopupBody, () => props, 4)
    deq(services.log, [], `${name}: no request`)
    if (name === 'signed out') assert.match(text(tree), /Sign in to see your templates\./)
    if (name === 'no composer library') assert.equal(flat(tree).filter(n => n.type === 'ThemeDropdownPicker').length, 0, 'without saved templates or a library there is nothing to list')
  }
})
mutant('fix: the popup reads another list (a different path)', async () => {
  const on = await flagOnPopupAction({ action: 'use', templateId: 'cmp-j1', mutate: { [POPUPS_LIB]: [["composerRequest<{ templates: ComposerTemplate[] }>('templates')", "composerRequest<{ templates: ComposerTemplate[] }>('templates?all=1')"]] } })
  assert.equal(on.popupLog[0][1], '/api/composer-library/templates')
})
mutant('fix: the popup lists while closed (the readiness rule is dropped)', async () => {
  const services = composerServices()
  const world = makeWorld({ env: DIALOG_ENV_ON, recorder: true, globals: services.globals, mutate: { [TEMPLATE_PICKER]: [['const listing = Boolean(onComposerAction && open && composerUserId)', 'const listing = Boolean(onComposerAction)']] } })
  const { ComposerTemplatePopupBody } = world.loader.load(TEMPLATE_PICKER)
  await drain(world.runtime, ComposerTemplatePopupBody, () => ({ onSelect: refuse, open: false, mode: 'generation', showSavedTemplates: false, selectionLocked: false, selectedTemplateId: null, onClose() {}, onComposerAction() {}, composerUserId: OWNER }), 4)
  deq(services.log, [])
})

await run('fix: Use original and Rebuild from the popup make exactly the requests the library dialog\'s own buttons make (session, use payload, job polling, ready record, navigation), for every listed template', async () => {
  for (const action of ['use', 'ditto']) {
    for (const template of COMPOSER_TEMPLATES) {
      const off = await flagOffDialogAction({ action, templateId: template.id })
      const on = await flagOnPopupAction({ action, templateId: template.id })
      deq(on.log, off.log, `${action} ${template.id}: every request, write and navigation`)
      assert.equal(ser(on.tree), ser(off.tree), `${action} ${template.id}: the dialog ends in the same state`)
      const posted = off.log.find(e => e[0] === 'fetch' && e[2].method === 'POST')
      assert.equal(posted[1], `/api/composer-library/templates/${encodeURIComponent(template.id)}/use`)
      assert.equal(posted[2].body, action === 'use' ? JSON.stringify({ session_id: SESSION }) : JSON.stringify({ session_id: SESSION, mode: 'ditto' }))
      deq(off.log.find(e => e[0] === 'createSession'), ['createSession', SESSION, action === 'use' ? `Template: ${template.name}` : `Rebuild: ${template.name}`])
      deq(off.log.at(-1), ['location.assign', `/builder?session_id=${SESSION}`])
      // the popup closed, the page opened the dialog, and the request was taken (cleared) once
      assert.equal(on.closed, 1); assert.equal(on.shown, true); assert.equal(on.pageState.request, null)
    }
  }
  deq(strip((await flagOffDialogAction({ action: 'use', templateId: 'cmp-northwind' })).log), [
    'GET /api/composer-library/templates ', `createSession ${SESSION} Template: Northwind`,
    `POST /api/composer-library/templates/cmp-northwind/use {"session_id":"${SESSION}"}`,
    `sessionStorage.setItem deckster_composer_job_${OWNER} {"job_id":"job-use-1","session_id":"${SESSION}","kind":"use"}`,
    'GET /api/composer-library/jobs/job-use-1 ',
    `sessionStorage.setItem deckster_composer_ready_${SESSION} ${off_ready(SESSION, 'cmp-northwind')}`,
    `sessionStorage.removeItem deckster_composer_job_${OWNER}`, `location.assign /builder?session_id=${SESSION}`,
  ])
})
function off_ready(session, templateId) {
  return JSON.stringify({ user_id: OWNER, result: { composer_adoption: { schema_version: 'composer-adoption-v1', template_id: templateId, presentation_id: 'deck-1', frozen_theme: true }, session_id: session, template_id: templateId, presentation_id: 'deck-1', viewer_url: `${LAYOUT}/p/deck-1`, slide_count: 9 } })
}
mutant('fix: the dialog runs Use original as a rebuild', async () => {
  const off = await flagOffDialogAction({ action: 'use', templateId: 'cmp-j1' })
  const on = await flagOnPopupAction({ action: 'use', templateId: 'cmp-j1', mutate: { [DIALOG]: [["if (action === 'use') useTemplate(template)", "if (action === 'use') rebuildTemplate(template)"]] } })
  deq(on.log, off.log)
})
mutant('fix: the popup hands over another template than the one picked', async () => {
  const off = await flagOffDialogAction({ action: 'use', templateId: 'cmp-northwind' })
  const on = await flagOnPopupAction({ action: 'use', templateId: 'cmp-northwind', mutate: { [TEMPLATE_PICKER]: [['onClick={() => composer.onAction({ action, template: chosen })}', 'onClick={() => composer.onAction({ action, template: composer.templates![0] })}']] } })
  deq(on.log, off.log)
})
mutant('fix: chat-input hands the picker another identity than the dialog reads (email first)', async () => {
  const on = await flagOnPopupAction({ action: 'use', templateId: 'cmp-j1', user: { id: OWNER, email: 'someone@example.invalid' }, mutate: { [CHAT_INPUT]: [['composerUserId: user?.id || user?.email || null', 'composerUserId: user?.email || user?.id || null']] } })
  assert.equal(on.picker.composerUserId, OWNER)
})

await run('fix: New topic from the popup opens the same topic box as the dialog\'s New topic button, and Create deck then sends the same brief', async () => {
  const brief = 'Quarterly results for the board: revenue up 12 percent, two new regions, hiring plan for next year.'
  const offOpen = await flagOffDialogAction({ action: 'new-topic', templateId: 'cmp-northwind' })
  const onOpen = await flagOnPopupAction({ action: 'new-topic', templateId: 'cmp-northwind' })
  assert.equal(ser(onOpen.tree), ser(offOpen.tree), 'the same dialog, with the topic box open for that template')
  assert.ok(flat(onOpen.tree).some(n => n.props?.['data-studio-composer-topic']))
  deq(onOpen.log, offOpen.log, 'opening the box sends nothing beyond the dialog\'s list')
  const off = await flagOffDialogAction({ action: 'new-topic', templateId: 'cmp-northwind', brief })
  const on = await flagOnPopupAction({ action: 'new-topic', templateId: 'cmp-northwind', brief })
  deq(on.log, off.log)
  assert.equal(off.log.find(e => e[0] === 'fetch' && e[2].method === 'POST')[2].body, JSON.stringify({ session_id: SESSION, brief }))
})

await run('fix: an action is run once, on the render after the dialog opens: a job the dialog resumes on opening keeps running and the action is dropped, as a click on its disabled buttons is', async () => {
  const pending = { job_id: 'job-upload-9', session_id: 'upload-session-9', kind: 'upload' }
  for (const action of ['use', 'ditto', 'new-topic']) {
    const off = await flagOffDialogAction({ action, templateId: 'cmp-j1', pending })
    assert.equal(off.buttonDisabled, true, 'the dialog\'s buttons are disabled while it resumes the job')
    const on = await flagOnPopupAction({ action, templateId: 'cmp-j1', pending })
    deq(on.log, off.log, `${action}: only the resumed job's requests`)
    assert.ok(!on.log.some(e => e[0] === 'createSession'))
    assert.ok(!flat(on.tree).some(n => n.props?.['data-studio-composer-topic']), `${action}: no topic box opened`)
    assert.equal(ser(on.tree), ser(off.tree))
  }
  // a page render that still carries the same request does not run it again
  const once = await flagOnPopupAction({ action: 'use', templateId: 'cmp-j1', rerenderWithSameRequest: true })
  assert.equal(once.log.filter(e => e[0] === 'createSession').length, 1)
})
mutant('fix: the dialog runs the action in the same render it opens (before a resumed job shows as busy)', async () => {
  const pending = { job_id: 'job-upload-9', session_id: 'upload-session-9', kind: 'upload' }
  const on = await flagOnPopupAction({ action: 'use', templateId: 'cmp-j1', pending, mutate: { [DIALOG]: [['    setPickedRequest(request)\n  }, [open, request, onRequestTaken])', "    if (request.action === 'use') useTemplate(request.template)\n  }, [open, request, onRequestTaken])"]] } })
  assert.ok(!on.log.some(e => e[0] === 'createSession'))
})
mutant('fix: New topic ignores a busy dialog', async () => {
  const pending = { job_id: 'job-upload-9', session_id: 'upload-session-9', kind: 'upload' }
  const on = await flagOnPopupAction({ action: 'new-topic', templateId: 'cmp-j1', pending, mutate: { [DIALOG]: [["action === 'new-topic' && newTopicEnabled && !busy && userId", "action === 'new-topic' && newTopicEnabled"]] } })
  assert.ok(!flat(on.tree).some(n => n.props?.['data-studio-composer-topic']))
})
mutant('fix: the dialog takes the same request twice', async () => {
  const once = await flagOnPopupAction({ action: 'use', templateId: 'cmp-j1', rerenderWithSameRequest: true, mutate: { [DIALOG]: [['if (!open || !request || takenRequest.current === request) return', 'if (!open || !request) return']] } })
  assert.equal(once.log.filter(e => e[0] === 'createSession').length, 1)
})

await run('fix: the popup offers the library dialog\'s actions with its labels, in its order, behind the same flags; they are off for a signed-out user', async () => {
  const lib = createLoader({ env: {} }).load(POPUPS_LIB)
  deq(lib.composerTemplateActions({ ditto: false, newTopic: false }).map(a => a.label), ['Use original'])
  deq(lib.composerTemplateActions({ ditto: true, newTopic: false }).map(a => a.label), ['Use original', 'Rebuild from own content'])
  deq(lib.composerTemplateActions({ ditto: false, newTopic: true }).map(a => a.label), ['Use original', 'New topic'])
  deq(lib.composerTemplateActions({ ditto: true, newTopic: true }).map(a => [a.action, a.label]), [['use', 'Use original'], ['ditto', 'Rebuild from own content'], ['new-topic', 'New topic']])
  for (const [ditto, newTopic] of [[false, false], [true, false], [false, true], [true, true]]) {
    const env = { ...ON_ENV, NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT, ...(ditto ? { NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED: 'true' } : {}), ...(newTopic ? { NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true' } : {}) }
    // the dialog's buttons for a template, flag off
    const dialogServices = composerServices()
    const dialog = mountDialog({ env: { ...env, [FLAG]: 'false' }, services: dialogServices })
    const dialogTree = await drain(dialog.world.runtime, dialog.ComposerLibraryDialog, () => ({ open: true, onOpenChange() {} }), 6)
    const dialogLabels = flat(flat(dialogTree).find(n => n.props?.['data-studio-composer-record'] === 'cmp-j1')).filter(n => n.type === 'Button').map(text)
    // the popup's buttons for the same template, flag on
    for (const userId of [OWNER, null]) {
      const services = composerServices()
      const world = makeWorld({ env, recorder: true, globals: services.globals })
      const { ComposerTemplatePopupBody } = world.loader.load(TEMPLATE_PICKER)
      const props = () => ({ onSelect: refuse, open: true, mode: 'generation', showSavedTemplates: false, selectionLocked: false, selectedTemplateId: null, onClose() {}, onComposerAction() {}, composerUserId: userId })
      let tree = await drain(world.runtime, ComposerTemplatePopupBody, props, 4)
      if (userId === null) {
        // signed out: nothing listed (so nothing to act on), and it says why
        assert.equal(flat(tree).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates').props.options.length, 0)
        continue
      }
      flat(tree).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates').props.onSelect('composer:cmp-j1')
      tree = await drain(world.runtime, ComposerTemplatePopupBody, props, 2)
      const buttons = flat(tree).filter(n => n.props?.['data-studio-template-composer-action'])
      deq(buttons.map(text), dialogLabels, `ditto=${ditto} newTopic=${newTopic}: the dialog's actions`)
      assert.ok(buttons.every(b => b.props.disabled === false))
      assert.match(text(flat(tree).find(n => n.props?.['data-studio-template-composer'] === 'cmp-j1')), /^J1 · 12 slides/)
    }
  }
})
mutant('fix: Rebuild is offered without its flag', async () => {
  const lib = createLoader({ env: {}, mutate: { [POPUPS_LIB]: [['...(enabled.ditto ? [', '...(true ? [']] } }).load(POPUPS_LIB)
  deq(lib.composerTemplateActions({ ditto: false, newTopic: false }).map(a => a.label), ['Use original'])
})

await run('fix: "Template library" opens the working library (the library dialog wherever there is one); the Templates page only where it works; never /studio/templates where it says saved templates are not enabled; never the template workspace', async () => {
  const lib = createLoader({ env: {} }).load(POPUPS_LIB)
  assert.equal(lib.templateLibraryTarget({ composerLibrary: true, templatesPage: true }), 'dialog')
  assert.equal(lib.templateLibraryTarget({ composerLibrary: true, templatesPage: false }), 'dialog')
  assert.equal(lib.templateLibraryTarget({ composerLibrary: false, templatesPage: true }), 'page')
  assert.equal(lib.templateLibraryTarget({ composerLibrary: false, templatesPage: false }), null)
  let checked = 0
  for (const builder of [undefined, 'false', 'true', 'TRUE']) for (const workspace of [undefined, 'true']) for (const withLibrary of [false, true]) for (const savedTemplates of [false, true]) {
    const env = { ...ON_ENV, ...(builder === undefined ? {} : { NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: builder }), ...(workspace ? { NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE: workspace } : {}) }
    let library = 0, closed = 0
    const t = await mountTemplates(env, { onSelect() {}, isOpen: true, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates, onClose: () => { closed += 1 },
      onNewTemplate() {}, ...(withLibrary ? { onLibrary: () => { library += 1 } } : {}) } }, { recorder: true })
    const tree = await t.render()
    const entries = flat(tree).filter(n => n.props?.['data-studio-template-action'] === 'library')
    const pageWorks = builder === 'true'
    assert.ok(entries.length <= 1)
    const where = `builder=${builder} workspace=${workspace} library=${withLibrary} saved=${savedTemplates}`
    for (const node of flat(tree)) assert.ok(!(node.props?.href === '/studio/templates' && !pageWorks), `${where}: never links the disabled page`)
    if (withLibrary) {
      assert.equal(entries[0].type, 'button', `${where}: the library dialog`)
      assert.equal(entries[0].props.href, undefined)
      entries[0].props.onClick(); assert.equal(library, 1)
    } else if (pageWorks) {
      assert.equal(entries[0].type, 'a'); assert.equal(entries[0].props.href, '/studio/templates')
      entries[0].props.onClick(); assert.equal(closed, 1)
    } else assert.equal(entries.length, 0, `${where}: no library link`)
    checked += 1
  }
  assert.equal(checked, 32)
  // the real picker hands "Template library" the same library handler as before ("Template library" in the flag-off menu)
  const world = makeWorld({ env: DIALOG_ENV_ON, recorder: true })
  const { TemplatePicker } = world.loader.load(TEMPLATE_PICKER)
  const calls = []
  const tree = world.runtime.render(TemplatePicker, { onSelect() {}, onOpenLibrary: () => calls.push('library'), showSavedTemplates: false, dropdowns: true, open: true, onOpenChange: v => calls.push(['open', v]), onComposerAction() {}, composerUserId: OWNER })
  const offWorld = makeWorld({ env: { [SHELL]: 'true' } })
  const offTree = offWorld.runtime.render(offWorld.loader.load(TEMPLATE_PICKER).TemplatePicker, { onSelect() {}, onOpenLibrary: () => calls.push('library'), showSavedTemplates: false })
  const offCalls = calls.length
  flat(offTree).find(n => n.type === 'DropdownMenuItem').props.onSelect()
  const offEffect = calls.slice(offCalls)
  const onCalls = calls.length
  flat(tree).find(n => n.props?.['data-studio-template-action'] === 'library').props.onClick()
  deq(calls.slice(onCalls), [['open', false], ...offEffect], 'closes the popup, then opens the library, as the flag-off menu item does')
})
mutant('fix: "Template library" goes back to /studio/templates', async () => {
  const lib = createLoader({ env: {}, mutate: { [POPUPS_LIB]: [["return available.composerLibrary ? 'dialog' : available.templatesPage ? 'page' : null", "return 'page'"]] } }).load(POPUPS_LIB)
  assert.equal(lib.templateLibraryTarget({ composerLibrary: true, templatesPage: false }), 'dialog')
})
mutant('fix: the Templates page is linked without checking that it works', async () => {
  const lib = createLoader({ env: {}, mutate: { [POPUPS_LIB]: [["return available.composerLibrary ? 'dialog' : available.templatesPage ? 'page' : null", "return available.composerLibrary ? 'dialog' : 'page'"]] } }).load(POPUPS_LIB)
  assert.equal(lib.templateLibraryTarget({ composerLibrary: false, templatesPage: false }), null)
})
mutant('fix: the picker reads the Templates page flag as truthy', async () => {
  const t = await mountTemplates({ ...ON_ENV, NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: 'false' }, { onSelect() {}, isOpen: true, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: true, onClose() {} } },
    { recorder: true, mutate: { [TEMPLATE_PICKER]: [["const TEMPLATES_PAGE_ENABLED = process.env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED === 'true'", 'const TEMPLATES_PAGE_ENABLED = Boolean(process.env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED)']] } })
  assert.ok(!flat(await t.render()).some(n => n.props?.href === '/studio/templates'))
})

await run('fix: an empty list says why in plain words (Deckster has no catalog; signed out; failed; loading; nothing uploaded; no saved templates), never a blank control', async () => {
  const bodyTree = async ({ listStatus = 200, templates = COMPOSER_TEMPLATES, userId = OWNER, turns = 4, withLibrary = true } = {}) => {
    const onOpenLibrary = withLibrary ? () => {} : undefined
    const services = composerServices({ listStatus, templates })
    const world = makeWorld({ env: DIALOG_ENV_ON, recorder: true, globals: services.globals })
    const { ComposerTemplatePopupBody } = world.loader.load(TEMPLATE_PICKER)
    const props = () => ({ onSelect: refuse, open: true, mode: 'generation', showSavedTemplates: false, selectionLocked: false, selectedTemplateId: null, onClose() {}, onOpenLibrary, onComposerAction() {}, composerUserId: userId })
    return turns === 0 ? world.runtime.render(ComposerTemplatePopupBody, props()) : drain(world.runtime, ComposerTemplatePopupBody, props, turns)
  }
  const note = (tree, which) => text(flat(tree).find(n => n.props?.['data-studio-template-empty'] === which) ?? '')
  const field = (tree, label) => flat(tree).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === label)
  let tree = await bodyTree()
  assert.equal(note(tree, 'deckster'), 'Deckster has no ready-made templates yet. Templates you upload are listed under My templates.')
  assert.equal(field(tree, 'Deckster templates').props.locked, true)
  assert.equal(note(tree, 'mine'), '', 'a filled list needs no note')
  assert.equal(field(tree, 'My templates').props.locked, false)
  tree = await bodyTree({ templates: [] })
  assert.equal(note(tree, 'mine'), 'You have no templates yet. Upload a PowerPoint with New template… and it is listed here.')
  assert.equal(field(tree, 'My templates').props.copy.placeholder, 'No templates yet')
  tree = await bodyTree({ templates: [], withLibrary: false })
  assert.equal(note(tree, 'mine'), 'You have no templates yet.')
  tree = await bodyTree({ listStatus: 503 })
  assert.equal(note(tree, 'mine'), 'Your templates could not be loaded: Template library is not configured. Use Refresh to try again.')
  assert.equal(field(tree, 'My templates').props.copy.placeholder, 'Library unavailable')
  tree = await bodyTree({ userId: null })
  assert.equal(note(tree, 'mine'), 'Sign in to see your templates.')
  tree = await bodyTree({ turns: 0 })
  assert.equal(note(tree, 'mine'), 'Loading your templates…')
  assert.equal(field(tree, 'My templates').props.copy.placeholder, 'Loading your templates…')
  // without a composer library: saved templates only (the #374 popup); an empty saved list says why too
  const emptySaved = await mountTemplates(ON_ENV, { onSelect() {}, isOpen: true, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: true, onClose() {} } }, { recorder: true, savedTemplates: [] })
  const emptySavedTree = await emptySaved.render()
  assert.equal(text(flat(emptySavedTree).find(n => n.props?.['data-studio-template-empty'] === 'mine')), 'No saved templates yet. Build a deck and use Save as Template to add one.')
  assert.ok(text(flat(emptySavedTree).find(n => n.props?.['data-studio-template-empty'] === 'deckster')).startsWith('Deckster has no ready-made templates yet.'))
})
mutant('fix: the Deckster list is a blank control again', async () => {
  const world = makeWorld({ env: DIALOG_ENV_ON, recorder: true, globals: composerServices().globals, mutate: { [TEMPLATE_PICKER]: [['{deckster.length === 0 && <p className="stcd-empty" data-studio-template-empty="deckster">{DECKSTER_TEMPLATES_EMPTY}</p>}', '']] } })
  const { ComposerTemplatePopupBody } = world.loader.load(TEMPLATE_PICKER)
  const tree = await drain(world.runtime, ComposerTemplatePopupBody, () => ({ onSelect: refuse, open: true, mode: 'generation', showSavedTemplates: false, selectionLocked: false, selectedTemplateId: null, onClose() {}, onComposerAction() {}, composerUserId: OWNER }), 4)
  assert.ok(flat(tree).some(n => n.props?.['data-studio-template-empty'] === 'deckster'))
})

await run('fix: with saved templates too, "My templates" lists the library\'s templates, then the saved ones; a saved one is chosen exactly as before; a locked deck keeps the library\'s (each opens a new deck) and drops the saved ones', async () => {
  const mount = async locked => {
    const services = composerServices()
    const log = []
    const world = makeWorld({ env: DIALOG_ENV_ON, recorder: true, globals: services.globals })
    const { ComposerTemplatePopupBody } = world.loader.load(TEMPLATE_PICKER)
    let closed = 0
    const props = () => ({ onSelect: v => log.push(plain(v)), open: true, mode: 'generation', showSavedTemplates: true, selectionLocked: locked, selectedTemplateId: null, onClose: () => { closed += 1 }, onOpenLibrary() {}, onComposerAction() {}, composerUserId: OWNER })
    const tree = await drain(world.runtime, ComposerTemplatePopupBody, props, 4)
    return { tree, log, closed: () => closed, world, props, Body: ComposerTemplatePopupBody }
  }
  const open = await mount(false)
  const mine = flat(open.tree).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates')
  // (the saved records are loaded by the picker content, which this harness draws without its own state: the composer records lead)
  deq(mine.props.options.slice(0, COMPOSER_TEMPLATES.length).map(o => o.id), COMPOSER_TEMPLATES.map(t => `composer:${t.id}`))
  // a saved template, chosen through the merged list, sends the same selection as #374's list (checked on TemplatePickerContent directly)
  const offLog = [], onLog = []
  const plainList = await mountTemplates(ON_ENV, { onSelect: v => offLog.push(plain(v)), isOpen: true, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: true, onClose() {} } }, { recorder: true })
  flat(await plainList.render()).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates').props.onSelect('tp-1')
  const composer = { templates: COMPOSER_TEMPLATES, loading: false, error: null, userId: OWNER, chosenId: null, onChoose: () => {}, actions: [], onAction: refuse, refresh() {} }
  const merged = await mountTemplates(ON_ENV, { onSelect: v => onLog.push(plain(v)), isOpen: true, dropdowns: { selectedTemplateId: null, locked: false, savedTemplates: true, onClose() {}, composer } }, { recorder: true })
  const mergedMine = flat(await merged.render()).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates')
  deq(mergedMine.props.options.map(o => o.id), [...COMPOSER_TEMPLATES.map(t => `composer:${t.id}`), ...TEMPLATES.map(t => t.id)])
  mergedMine.props.onSelect('tp-1')
  deq(onLog, offLog)
  const lockedMerged = await mountTemplates(ON_ENV, { onSelect: refuse, isOpen: true, dropdowns: { selectedTemplateId: null, locked: true, savedTemplates: true, onClose() {}, composer } }, { recorder: true })
  const lockedTree = await lockedMerged.render()
  const lockedMine = flat(lockedTree).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates')
  deq(lockedMine.props.options.map(o => o.id), COMPOSER_TEMPLATES.map(t => `composer:${t.id}`))
  assert.equal(lockedMine.props.locked, false)
  assert.match(text(lockedTree), /Saved templates are locked for this deck\./)
})

await run('fix (page.tsx): flag off, the page hands ChatInput and the library dialog exactly what it did before; flag on, the popup\'s action opens the dialog with the request, which is cleared once taken', async () => {
  const page = read(PAGE)
  assert.equal(pageWiringHash((await import('./studio-later-changes.mjs')).stripLaterChanges(PAGE, page)), BASE_HASHES.pageWiring, 'both elements, without the fix\'s spreads, are the base\'s') // LATER-CHANGES: registry read (SPEED-PERCEIVED): a registered later change's marked lines come out first (an unmarked line still counts)
  const wiring = pageWiring(page)
  const chatSpread = wiring.ChatInput.spreads.filter(x => FIX_SPREAD.test(x))
  const dialogSpread = wiring.ComposerLibraryDialog.spreads.filter(x => FIX_SPREAD.test(x))
  assert.equal(chatSpread.length, 1); assert.equal(dialogSpread.length, 1)
  const log = []
  const scope = (flag, library) => ({ studioPopupsV2: flag, studioTemplateWorkspace: false, composerLibraryEnabled: library, composerLibraryRequest: { marker: 'request' },
    setComposerLibraryRequest: v => log.push(['request', v]), setShowComposerLibrary: v => log.push(['show', v]) })
  // (keys, not deq: deq compares as JSON, which drops function values)
  for (const library of [false, true]) deq(Object.keys(compileJsx(chatSpread[0], 'chat spread')(scope(false, library))), [], 'flag off: nothing added to ChatInput')
  deq(Object.keys(compileJsx(chatSpread[0], 'chat spread')(scope(true, false))), [], 'no composer library: nothing added')
  deq(Object.keys(compileJsx(dialogSpread[0], 'dialog spread')(scope(false, true))), [], 'flag off: nothing added to the dialog')
  deq(Object.keys(compileJsx(chatSpread[0], 'chat spread')(scope(true, true))), ['onComposerTemplateAction'])
  const handler = compileJsx(chatSpread[0], 'chat spread')(scope(true, true)).onComposerTemplateAction
  const request = { action: 'use', template: COMPOSER_TEMPLATES[0] }
  handler(request)
  deq(log, [['request', request], ['show', true]])
  const dialogExtra = compileJsx(dialogSpread[0], 'dialog spread')(scope(true, true))
  deq(Object.keys(dialogExtra), ['request', 'onRequestTaken'])
  deq(dialogExtra.request, { marker: 'request' })
  log.length = 0; dialogExtra.onRequestTaken(); deq(log, [['request', null]])
  assert.match(page, /const \[composerLibraryRequest, setComposerLibraryRequest\] = useState<ComposerLibraryRequest \| null>\(null\)/)
})
mutant('fix (page.tsx): the action handler reaches ChatInput with the flag off', async () => {
  const page = read(PAGE).replace('{...(studioPopupsV2 && composerLibraryEnabled ? { onComposerTemplateAction:', '{...(composerLibraryEnabled ? { onComposerTemplateAction:')
  if (page === read(PAGE)) throw new MutationTargetMissing('page mutation did not apply')
  const spread = pageWiring(page).ChatInput.spreads.find(x => FIX_SPREAD.test(x))
  deq(Object.keys(compileJsx(spread, 'chat spread')({ studioPopupsV2: false, composerLibraryEnabled: true, setComposerLibraryRequest() {}, setShowComposerLibrary() {} })), [])
})
mutant('fix (page.tsx): the dialog gets the request with the flag off', async () => {
  const page = read(PAGE).replace('{...(studioPopupsV2 || studioTemplateWorkspace ? { request: composerLibraryRequest', '{...(true ? { request: composerLibraryRequest')
  if (page === read(PAGE)) throw new MutationTargetMissing('page mutation did not apply')
  const spread = pageWiring(page).ComposerLibraryDialog.spreads.find(x => FIX_SPREAD.test(x))
  deq(Object.keys(compileJsx(spread, 'dialog spread')({ studioPopupsV2: false, studioTemplateWorkspace: false, composerLibraryRequest: null, setComposerLibraryRequest() {} })), [])
})
mutant('fix (page.tsx): an unmarked spread added to ChatInput is not a registered later change\'s (the wiring hash sees it)', async () => { const page = read(PAGE).replace('<ChatInput\n', '<ChatInput\n                    {...({ extra: 1 })}\n'); if (page === read(PAGE)) throw new MutationTargetMissing('page mutation did not apply'); assert.equal(pageWiringHash((await import('./studio-later-changes.mjs')).stripLaterChanges(PAGE, page)), BASE_HASHES.pageWiring) }) // LATER-CHANGES: registry read (SPEED-PERCEIVED)

await run('fix: flag off (no request), the library dialog renders and requests exactly as the base did (16 states: tree and every request)', async () => {
  assert.equal(await dialogHash(), BASE_HASHES.dialog)
})

// ================================================================================================================================================
// 5. the narrow-window strip
// ================================================================================================================================================
await run('strip (flag on): Slides / Director / Edit with icons and the tooltip; Edit is absent (not disabled) until there is something to edit; the buttons carry the old pressed states', async () => {
  const { StudioWorkspaceSwitchV2 } = createLoader({ env: ON_ENV, stubs: { react: createRuntime().react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }) } }).load(STRIP)
  const calls = []
  const props = { showSlides: true, slidesPressed: false, onSlides: () => calls.push('slides'), directorPressed: true, onDirector: () => calls.push('director'), showEdit: false, editPressed: false, onEdit: () => calls.push('edit') }
  let tree = StudioWorkspaceSwitchV2(props)
  assert.equal(tree.props['data-studio-workspace-switch'], 'true', 'the existing bar hooks (position, key handling, focus rules) still apply')
  assert.equal(tree.props.role, 'group'); assert.equal(tree.props['aria-label'], 'Workspace pane')
  assert.equal(tree.props.title, 'Narrow window: switch between panes')
  let buttons = flat(tree).filter(n => n.type === 'button')
  deq(buttons.map(text), ['Slides', 'Director'])
  assert.ok(buttons.every(b => !('disabled' in b.props)), 'never disabled')
  assert.deepEqual(buttons.map(b => flat(b).find(n => typeof n.type === 'string' && n.type.startsWith('Icon:'))?.type), ['Icon:Presentation', 'Icon:MessageSquare'], 'each has its icon')
  deq(buttons.map(b => b.props['aria-pressed']), [false, true])
  tree = StudioWorkspaceSwitchV2({ ...props, showEdit: true, editPressed: true, showSlides: false })
  buttons = flat(tree).filter(n => n.type === 'button')
  deq(buttons.map(text), ['Director', 'Edit'])
  buttons.forEach(b => b.props.onClick())
  deq(calls, ['director', 'edit'])
  assert.ok(!/Stage|Chat|Inspector/.test(text(tree)), 'the plain words replace the old ones')
})
await run('strip (page.tsx): the V2 strip is drawn only with the flag, the old one only without; the V2 props give the same pressed states and call the same handlers as the old buttons, over every pane / selection combination', async () => {
  const page = read(PAGE)
  const { old, v2, oldCondition, v2Condition } = stripSourceElements(page)
  assert.match(oldCondition, /\{studioShell && !studioPopupsV2 && !workspaceLayout\.dualPane && \(\s*<div data-studio-workspace-switch="true"/)
  assert.match(v2Condition, /\{studioPopupsV2 && !workspaceLayout\.dualPane && \(\s*<StudioWorkspaceSwitchV2/)
  assert.match(page, /const studioPopupsV2 = studioShell && process\.env\.NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2 === 'true'/)
  const v2Factory = compileJsx(v2, 'v2 strip')
  let checked = 0
  for (const combo of stripCombos()) {
    const oldLog = [], newLog = []
    const oldTree = renderOldStrip(page, combo, oldLog)
    const oldButtons = flat(oldTree).filter(n => n.type === 'button')
    const el = v2Factory({ ...stripScope(combo, newLog), StudioWorkspaceSwitchV2: 'V2' })
    const p = el.props
    // old: [Stage?] Chat Inspector; new: showSlides == Stage exists, showEdit == Inspector is enabled
    const stage = combo.overlay ? oldButtons[0] : null
    const chat = oldButtons[combo.overlay ? 1 : 0], inspector = oldButtons[combo.overlay ? 2 : 1]
    assert.equal(p.showSlides, Boolean(stage), 'Slides exists exactly when Stage did')
    assert.equal(p.showEdit, !inspector.props.disabled, 'Edit exists exactly when Inspector was enabled')
    if (stage) assert.equal(p.slidesPressed, stage.props['aria-pressed'])
    assert.equal(p.directorPressed, chat.props['aria-pressed'])
    assert.equal(p.editPressed, inspector.props['aria-pressed'])
    for (const [oldButton, handler] of [[stage, p.onSlides], [chat, p.onDirector], [inspector, p.onEdit]]) {
      if (!oldButton) continue
      oldLog.length = 0; newLog.length = 0
      oldButton.props.onClick(); handler()
      deq(newLog, oldLog, `handler for ${JSON.stringify(combo)}`)
    }
    checked += 1
  }
  assert.equal(checked, stripCombos().length)
})
mutant('strip: Edit is disabled instead of absent', async () => {
  const { StudioWorkspaceSwitchV2 } = createLoader({ env: ON_ENV, stubs: { react: createRuntime().react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }) }, mutate: { [STRIP]: [["{p.showEdit && <button type=\"button\" aria-pressed={p.editPressed} onClick={p.onEdit}>", "{<button type=\"button\" disabled={!p.showEdit} aria-pressed={p.editPressed} onClick={p.onEdit}>"]] } }).load(STRIP)
  const tree = StudioWorkspaceSwitchV2({ showSlides: true, slidesPressed: false, onSlides() {}, directorPressed: true, onDirector() {}, showEdit: false, editPressed: false, onEdit() {} })
  const buttons = flat(tree).filter(n => n.type === 'button')
  assert.equal(buttons.length, 2); assert.ok(buttons.every(b => !('disabled' in b.props)))
})
mutant('strip: the page draws both strips (the old one loses its flag guard)', async () => {
  const page = read(PAGE).replace('{studioShell && !studioPopupsV2 && !workspaceLayout.dualPane && (', '{studioShell && !workspaceLayout.dualPane && (')
  if (page === read(PAGE)) throw new MutationTargetMissing('page mutation did not apply')
  const { oldCondition } = stripSourceElements(page)
  assert.match(oldCondition, /!studioPopupsV2/)
})
mutant('strip: Director calls the wrong pane handler', async () => {
  const page = read(PAGE).replace("onDirector={() => { selectWorkspacePane('chat'); if (!showChat) setShowChat(true) }}", "onDirector={() => { selectWorkspacePane('inspector') }}")
  if (page === read(PAGE)) throw new MutationTargetMissing('page mutation did not apply')
  const { v2 } = stripSourceElements(page)
  const combo = stripCombos()[0]
  const log = []
  const el = compileJsx(v2, 'v2')({ ...stripScope(combo, log), StudioWorkspaceSwitchV2: 'V2' })
  el.props.onDirector()
  deq(log, [['pane', 'chat'], ['showChat', true]])
})

// ================================================================================================================================================
// the stylesheet and the rest of the tree
// ================================================================================================================================================
await run('every selector of the strip and popup stylesheets is scoped to a V2 marker; the existing stylesheets are not edited', async () => {
  for (const file of [CSS, 'components/builder/studio-workspace-switch-v2.css']) {
    const parsed = postcss.parse(read(file))
    let n = 0
    parsed.walkRules(rule => {
      if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
      n += 1
      for (const selector of rule.selectors) assert.ok(/^(\[data-studio-v4-shell="true"\] \[data-studio-workspace-switch-v2="true"\]|\[data-studio-composer-popups-v2="true"\]|\[data-studio-composer-dd="true"\]|\.dark \[data-studio-composer-menu="(theme|template)"\]|\[data-studio-composer-menu="(theme|template)"\])/.test(selector), `${file}: unscoped selector ${selector}`)
    })
    assert.ok(n >= 5, file)
  }
  assert.doesNotMatch(read('components/builder/studio-workspace-switch-v2.css'), /!important/)
})
await run('the dropdown component gained only optional props: #372\'s own test still passes (run separately in the suite), and its default copy is exported', async () => {
  const src = read(DROPDOWN)
  assert.match(src, /export const THEME_DROPDOWN_COPY: ThemeDropdownCopy = \{/)
  assert.match(src, /copy = THEME_DROPDOWN_COPY,/)
  assert.match(src, /preview\?: ThemeDropdownPreviewData/)
})

// ---- every guard above, against the mutation it is for -----------------------------------------------------------------------------------------
await run(`mutation checks: ${mutants.length} mutants, each caught by the checks above`, async () => {
  const survivors = []
  for (const [name, fn] of mutants) {
    let caught = false
    try { await fn() } catch (error) {
      if (error instanceof MutationTargetMissing) throw error // a mutant that did not apply proves nothing
      caught = true
    }
    if (!caught) survivors.push(name)
  }
  deq(survivors, [], `mutants that survived: ${survivors.join(' | ')}`)
})

console.log(`PASS: composer popups V2 (${testCount} tests, ${mutants.length} mutants)`)
