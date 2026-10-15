// PASS2-PK-FOUR item 4 (frontend-2): the template upload "wow" workspace.
// Flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE (exact "true", Studio shell only), default off; the dev/test-only mock event source needs
// NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE_MOCK (exact "true", build time) as well.
//
// Run: node scripts/test-studio-template-workspace.mjs   (plain node: transpile + vm, no network, no React runtime)
//   TEMPLATE_WORKSPACE_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-template-workspace.mjs
//     re-prints the flag-off goldens below from the base (origin/studio-v4-dev-preparation-code at 1d5ebf0, before this change).
//
// 1. The state machine and the event contract (lib/studio-template-workspace): event sequences, out-of-order, duplicate and late
//    events, pause/resume, leave and return (replays), the 120-slide cap, validation, the mock's determinism, the adapter store and
//    the upload registry.
// 2. Flag off is byte-identical on every surface this touches, on the REAL sources (cut by AST or transpiled, then evaluated with a
//    tiny JSX runtime): the upload dialog, the builder header (the workspace renders from its slot, into the stage), the toolbar's
//    Template entry and the Templates page; the builder page itself is not changed. Each is pinned to a digest of the base's render
//    over a matrix of states (child slots included where React numbers them), and in-memory mutants of the change must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const treeRoot = process.env.TEMPLATE_WORKSPACE_ROOT ? path.resolve(process.env.TEMPLATE_WORKSPACE_ROOT) : repoRoot
const readFrom = (root, file) => fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : null
const FILES = {
  dialog: 'components/template-ingest-dialog.tsx',
  header: 'components/builder/builder-header.tsx',
  viewer: 'components/presentation-viewer.tsx',
  templatesPage: 'app/(app)/studio/templates/page.tsx',
  builderPage: 'app/builder/page.tsx',
  topBarLib: 'lib/studio-top-bar-v2.ts',
  entry: 'components/studio-template-workspace/entry.tsx',
  adapter: 'lib/studio-template-workspace/adapter.ts',
}
const SOURCES = Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, readFrom(treeRoot, file)]))
const FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE'
const MOCK = 'NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE_MOCK'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const OFF_VALUES = [undefined, '', 'false', '0', '1', 'TRUE', 'True', ' true', 'true ', 'yes']
const OFF_DIGEST_VALUES = [undefined, 'false', 'TRUE']
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const withFlag = (env, value) => (value === undefined ? { ...env } : { ...env, [FLAG]: value })

let testCount = 0
async function run(name, fn) {
  testCount += 1
  try { await fn() } catch (error) { console.error(`FAIL: ${name}`); throw error }
}

// ── tiny JSX runtime + expression evaluation over real source (as in test-studio-top-bar-v2.mjs) ────────────────────────
const FRAGMENT = '__Fragment'
const jsx = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) })
const JSX_OPTIONS = { jsx: ts.JsxEmit.React, jsxFactory: '__jsx', jsxFragmentFactory: FRAGMENT, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
function serialise(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(serialise).join('')
  if (node.type === FRAGMENT) return serialise(node.children)
  const attrs = Object.keys(node.props).sort().map(key => typeof node.props[key] === 'function' ? `${key}=<fn>` : `${key}=${JSON.stringify(node.props[key])}`)
  return `<${String(node.type)}${attrs.length ? ' ' + attrs.join(' ') : ''}>${serialise(node.children)}</${String(node.type)}>`
}
// The same, but keeping every child slot, empty ones included: React numbers siblings by slot (useId, and so the ids Radix puts in the
// DOM), so a new conditional slot before other siblings changes their ids even when it renders nothing.
function serialiseSlots(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '\u2205'
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(serialiseSlots).join('|')
  if (node.type === FRAGMENT) return `<>${serialiseSlots(node.children)}</>`
  const attrs = Object.keys(node.props).sort().map(key => typeof node.props[key] === 'function' ? `${key}=<fn>` : `${key}=${JSON.stringify(node.props[key])}`)
  return `<${String(node.type)}${attrs.length ? ' ' + attrs.join(' ') : ''}>${serialiseSlots(node.children)}</${String(node.type)}>`
}
// Slots, ignoring empty slots at the END of a child list (nothing comes after them, so no sibling moves).
const isHole = value => value === null || value === undefined || typeof value === 'boolean'
function serialiseLeadingSlots(node) {
  if (isHole(node)) return '\u2205'
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) {
    const list = [...node]
    while (list.length && isHole(list.at(-1))) list.pop()
    return list.map(serialiseLeadingSlots).join('|')
  }
  const inner = serialiseLeadingSlots(node.children)
  if (node.type === FRAGMENT) return `<>${inner}</>`
  const attrs = Object.keys(node.props).sort().map(key => typeof node.props[key] === 'function' ? `${key}=<fn>` : `${key}=${JSON.stringify(node.props[key])}`)
  return `<${String(node.type)}${attrs.length ? ' ' + attrs.join(' ') : ''}>${inner}</${String(node.type)}>`
}
const findAll = (node, predicate, found = []) => {
  if (node === null || node === undefined || typeof node !== 'object') return found
  if (Array.isArray(node)) { node.forEach(child => findAll(child, predicate, found)); return found }
  if (predicate(node)) found.push(node)
  findAll(node.children, predicate, found)
  return found
}
const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function find(node, predicate) {
  if (predicate(node)) return node
  let match
  ts.forEachChild(node, child => { if (!match) match = find(child, predicate) })
  return match
}
function findEvery(node, predicate, found = []) {
  if (predicate(node)) found.push(node)
  ts.forEachChild(node, child => { findEvery(child, predicate, found) })
  return found
}
const compiled = new Map()
function compile(expressionText, { call = false } = {}) {
  const key = `${call}\n${expressionText}`
  if (compiled.has(key)) return compiled.get(key)
  const js = ts.transpileModule(`(${expressionText})${call ? '()' : ''};`, { compilerOptions: JSX_OPTIONS, fileName: 'expression.tsx' }).outputText
  const script = new vm.Script(`with (__scope) { ${js} }`)
  const evaluate = scope => {
    const proxy = new Proxy(scope, {
      has: (target, k) => typeof k === 'string' && (k in target || (/^[A-Z]/.test(k) && !(k in globalThis))),
      get: (target, k) => k === Symbol.unscopables ? undefined : k in target ? target[k] : String(k),
    })
    return script.runInContext(vm.createContext({ __scope: proxy, console }))
  }
  compiled.set(key, evaluate)
  return evaluate
}
function moduleConstants(sourceFile, scope, names = null) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      const name = declaration.name.getText(sourceFile)
      if (names && !names.includes(name)) continue
      if (declaration.initializer) scope[name] = compile(declaration.initializer.getText(sourceFile))(scope)
    }
  }
  return scope
}
const functionText = (sourceFile, name) => {
  const node = find(sourceFile, n => ts.isFunctionDeclaration(n) && n.name && n.name.text === name)
  assert.ok(node, `function ${name} exists`)
  return node.getText(sourceFile).replace(/^export\s+(default\s+)?/, '')
}
const product = axes => Object.entries(axes).reduce((cells, [key, values]) => cells.flatMap(cell => values.map(value => ({ ...cell, [key]: value }))), [{}])
const BOOLS = [false, true]

// ── module loader for the lib files (transpile + vm, fixed imports only) ──────────────────────────────────────────────────
function loadLib(root = repoRoot, globals = {}) {
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }
    cache.set(file, mod)
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    const req = spec => {
      if (spec === 'react') return { useMemo: fn => fn(), useSyncExternalStore: (_s, get) => get() }
      const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(file), spec)
      for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return load(base + suffix)
      throw new Error(`unexpected import ${spec} in ${path.relative(root, file)}`)
    }
    vm.runInNewContext(js, { module: mod, exports: mod.exports, require: req, console, Date, setTimeout, clearTimeout, process: { env: {} }, ...globals })
    return mod.exports
  }
  return name => load(path.join(root, 'lib/studio-template-workspace', name))
}
function memoryStorage() {
  const data = new Map()
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, String(v)) }, removeItem: k => { data.delete(k) }, data }
}

// ══ 2. FLAG-OFF IDENTITY: renders of the real surfaces ═════════════════════════════════════════════════════════════════

// ---- the builder header (as test-studio-top-bar-v2.mjs renders it) -------------------------------------------------------
function topBarEnabled(src, env) {
  if (!src.topBarLib) return undefined
  return moduleConstants(parse(FILES.topBarLib, src.topBarLib), { process: { env } }, ['STUDIO_TOP_BAR_V2_ENABLED']).STUDIO_TOP_BAR_V2_ENABLED
}
function topBarLibModule(src) {
  const js = ts.transpileModule(src.topBarLib, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(js, { module, exports: module.exports, process: { env: {} } })
  return module.exports
}
function renderHeader(src, cell) {
  const { env = {}, isDark = false, isChatHistoryOpen = false, deckTitle, wsError = null, saveState = null } = cell
  const sourceFile = parse(FILES.header, src.header)
  const fn = () => {}
  const scope = {
    __jsx: jsx, [FRAGMENT]: FRAGMENT, process: { env },
    React: { useRef: () => ({ current: null }), useEffect: () => {}, useSyncExternalStore: (subscribe, getSnapshot) => { subscribe(() => {}); return getSnapshot() } },
    useTheme: () => ({ resolvedTheme: isDark ? 'dark' : 'light' }),
    isDeckIdentityEnabled: () => false,
    STUDIO_TOP_BAR_V2_ENABLED: topBarEnabled(src, env),
    getStudioDeckSaveState: () => saveState,
    subscribeStudioDeckSaveState: () => () => {},
    studioTopBarSavedLabel: topBarLibModule(src).studioTopBarSavedLabel,
    // PASS2B G56 (00cb07f, NEXT_PUBLIC_STUDIO_CREATE_WORD, default off): the create-button helper; off it returns the call site's own word.
    studioCreateLabel: (unified, original) => unified === true ? 'New deck' : original,
  }
  moduleConstants(sourceFile, scope)
  const props = { wsError, onNewPresentation: fn, onOpenChatHistory: fn, isChatHistoryOpen, toolbarSlotRef: fn, onToolbarInteract: fn }
  if (deckTitle !== undefined) props.deckTitle = deckTitle
  return compile(functionText(sourceFile, 'BuilderHeader'))(scope)(props)
}
const HEADER_MATRIX = product({ shell: BOOLS, labels: BOOLS, tokens: BOOLS, topBar: BOOLS, isDark: BOOLS, isChatHistoryOpen: BOOLS,
  deckTitle: [undefined, 'Tidewell QBR master'], wsError: [null, { message: 'Connection lost' }], saveState: ['saved', null] })
const headerEnv = cell => ({ ...(cell.shell ? { [SHELL]: 'true' } : {}), ...(cell.labels ? { NEXT_PUBLIC_STUDIO_V4_LABELS: 'true' } : {}),
  ...(cell.tokens ? { NEXT_PUBLIC_STUDIO_V4_TOKENS: 'true' } : {}), ...(cell.topBar ? { NEXT_PUBLIC_STUDIO_TOP_BAR_V2: 'true' } : {}) })
const headerDigest = (src, flag, write = serialise) => sha(HEADER_MATRIX.map(cell => sha(write(renderHeader(src, { ...cell, env: withFlag(headerEnv(cell), flag) })))).join('\n'))

// ---- the toolbar block of the viewer (as test-studio-toolbar-cleanup.mjs renders it) ---------------------------------------
function toolbarRenderer(src) {
  const viewerSource = parse(FILES.viewer, src.viewer)
  const declaration = name => find(viewerSource, n => ts.isVariableDeclaration(n) && n.name.getText(viewerSource) === name)
  let block = declaration('authoringControls')
  assert.ok(block, 'authoringControls is declared in the viewer')
  while (block && !ts.isArrowFunction(block)) block = block.parent
  assert.ok(block, 'the toolbar block (an immediately-invoked arrow)')
  const render = compile(block.getText(viewerSource), { call: true })
  const cleanup = declaration('studioToolbarCleanup')
  return state => {
    const { studioShell = true, isFullscreen = false, viewerIsReady = true, templateBuilderEnabled = false, templateIngestEnabled = false, cleanupFlag = false, env = {} } = state
    const record = () => () => undefined
    const scope = {
      __jsx: jsx, [FRAGMENT]: FRAGMENT, process: { env: { ...env, ...(cleanupFlag ? { NEXT_PUBLIC_STUDIO_TOOLBAR_CLEANUP: 'true' } : {}) } },
      studioShell, isFullscreen, viewerIsReady, templateBuilderEnabled, presentViewOnlyActive: false, isGenerating: false, showToolbar: true,
      templateIngestEnabled, canSaveTemplate: true, templateSaveGate: { canSave: true, disabledReason: null, sourcePresentationId: 'p' },
      templateModeAvailable: true, templateModeOn: false, templateSelectionLocked: false, studioPartialArtifact: false, studioWorkflowRequest: null,
      toolbarTemplateMenuOpen: false, toolbarTemplatePickerOpen: false, onStudioFormatRequested: record(), studioFormatBusy: false, studioFormatSelection: null,
      studioTabPausedHint: undefined, // NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB: a new prop of the viewer; absent = the base toolbar, byte for byte
      isSlideMutationPending: false, isEditMode: false, isGridActive: false, isBordersActive: false, isSaving: false, saveStatus: 'saved',
      resolvedTheme: 'light', activeVersion: 'blank', strawmanPreviewUrl: null, finalPresentationUrl: null,
      ADD_SLIDE_V2_ENABLED: false, STUDIO_DISABLED_REASONS_ENABLED: false, STUDIO_SLIDE_COUNT_SYNC_ENABLED: false, addSlideV2Settings: null, buildThemeSelection: null, slideThumbnails: [],
      currentSlide: 1, totalSlides: 7, slideCount: 7, visualTotalSlides: 7, syncedFooterTotal: () => 7, toolbarOffset: 0,
      authoringStripRef: { current: null }, viewerInteractionIntentRef: { current: 0 }, toolbarDropdownPortalContainer: null,
      downloadControls: 'DOWNLOAD', onOpenGenerationPanel: record(), onGenerateSlide: record(), onSelectTemplate: record(),
      onTemplateModeChange: record(), onComposerTemplateAction: undefined, onOpenComposerLibrary: undefined, onVersionSwitch: record(), handleAddSlide: record(), handleFullscreen: record(),
      handleInsertTable: record(), handleInsertChart: record(), handleInsertTextBox: record(), handleInsertImage: record(), handleInsertInfographic: record(), handleInsertDiagram: record(),
      handleSaveChanges: record(), handleToggleBorders: record(), handleToggleEditModeButton: record(), handleToggleGrid: record(),
      setShowPresentationSettings: record(), setShowTemplateIngest: record(), setShowTemplateSave: record(), setShowThemePanel: record(), setTheme: record(),
      setToolbarTemplateMenuOpen: record(), setToolbarTemplatePickerOpen: record(),
      studioAuthoringPortalTarget: 'target:authoring', studioPresentPortalTarget: 'target:present', toolbarPortalTarget: 'target:header',
      createPortal: (child, target) => ({ type: 'Portal', props: { target }, children: [child] }),
      cn: (...parts) => parts.flat(Infinity).filter(part => typeof part === 'string' && part).join(' '),
    }
    scope.studioToolbarCleanup = cleanup ? compile(cleanup.initializer.getText(viewerSource))(scope) : undefined
    return render(scope)
  }
}
const TOOLBAR_MATRIX = product({ studioShell: BOOLS, isFullscreen: BOOLS, viewerIsReady: BOOLS, templateBuilderEnabled: BOOLS, templateIngestEnabled: BOOLS, cleanupFlag: BOOLS })
const toolbarDigest = (src, flag, write = serialise) => {
  const render = toolbarRenderer(src)
  return sha(TOOLBAR_MATRIX.map(cell => sha(write(render({ ...cell, env: withFlag(cell.studioShell ? { [SHELL]: 'true' } : {}, flag) })))).join('\n'))
}

// ---- the Templates page --------------------------------------------------------------------------------------------------
function renderTemplatesPage(src, env) {
  const sourceFile = parse(FILES.templatesPage, src.templatesPage)
  const node = find(sourceFile, n => ts.isFunctionDeclaration(n) && n.name && n.name.text === 'StudioTemplatesPage')
  assert.ok(node, 'StudioTemplatesPage exists')
  const body = node.body.getText(sourceFile)
  let calls = 0
  return compile(`function () ${body}`)({ __jsx: jsx, [FRAGMENT]: FRAGMENT, process: { env }, requireStudioLibraryAccess: () => { calls += 1 } }).call(null)
}
const PAGE_ENVS = [{}, { [SHELL]: 'true' }]
const templatesPageDigest = (src, flag) => sha(PAGE_ENVS.map(env => serialise(renderTemplatesPage(src, withFlag(env, flag)))).join('\n'))

// ---- the upload dialog (transpiled whole, evaluated with a small hooks runtime) --------------------------------------------
const DIALOG_ICONS = ['AlertTriangle', 'FileUp', 'Loader2', 'Upload']
function dialogHarness(code, env) {
  const slots = [], effects = [], events = []
  let cursor = 0, scheduled = false, serial = 0, props, tree
  const react = {
    Fragment: 'Fragment',
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: initial }; return [slots[i].value, value => { const next = typeof value === 'function' ? value(slots[i].value) : value; if (!Object.is(next, slots[i].value)) scheduled = true; slots[i].value = next }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useCallback(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) slots[i] = { deps, callback }; return slots[i].callback },
    useLayoutEffect(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: callback() } }) },
  }
  const djsx = (type, p, key) => ({ type, props: p, ...(key === undefined ? {} : { key }) })
  const deps = {
    react, 'react/jsx-runtime': { jsx: djsx, jsxs: djsx }, 'next/navigation': { usePathname: () => '/studio/templates' },
    '@/hooks/use-auth': { useAuth: () => ({ user: { id: 'offline-owner' } }) },
    '@/hooks/use-chat-sessions': { useChatSessions: () => ({ createSession: async id => { events.push(['create', id]); return { id } } }) },
    '@/lib/researcher-upload': { uploadFileToResearcher: async options => { events.push(['upload', options.intent]); return { storagePath: 'offline/x.pptx', researcherSessionId: 'r', jobId: null, fileName: options.file.name } } },
    '@/hooks/use-deckster-websocket-v2': { INGEST_INTENT_KEY_PREFIX: 'deckster_ingest_intent_' }, '@/lib/utils': { cn: (...v) => v.filter(Boolean).join(' ') },
    './studio-editor-dialogs.css': {}, './studio-template-flows.css': {},
    'lucide-react': Object.fromEntries(DIALOG_ICONS.map(n => [n, n])),
    '@/components/ui/dialog': Object.fromEntries(['Dialog', 'DialogContent', 'DialogDescription', 'DialogFooter', 'DialogHeader', 'DialogTitle'].map(n => [n, n])),
    '@/components/ui/button': { Button: 'Button' },
  }
  const mod = { exports: {} }
  const context = {
    module: mod, exports: mod.exports, Error, JSON, Promise, console: { error: () => {} }, process: { env }, crypto: { randomUUID: () => `offline-new-${++serial}` },
    sessionStorage: { setItem: (key, value) => events.push(['storage', key.replace(/offline-new-\d+$/, '<id>'), JSON.parse(value, (k, v) => (k === 'created_at' ? '<time>' : v))]) },
    window: { location: { pathname: '/studio/templates', search: '', assign: url => events.push(['navigate', url]) } },
    document: { fullscreenElement: null }, fetch: () => assert.fail('No network'),
    require: id => { assert.ok(id in deps, `dialog import ${id}`); return deps[id] },
  }
  const point = '\n  const phaseLabel = phase'
  assert.equal(code.split(point).length, 2, 'the dialog has one phaseLabel anchor')
  const js = ts.transpileModule(code.replace(point, '\n  globalThis.__handlers = { handleStart, acceptFile }\n' + point), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(js, context)
  const h = {
    events, context,
    render(next = props || { open: true, onOpenChange: open => events.push(['open', open]) }) { props = next; let turns = 0; do { assert.ok(turns++ < 10); scheduled = false; cursor = 0; tree = mod.exports.TemplateIngestDialog(props); while (effects.length) effects.shift()() } while (scheduled); return tree },
    get tree() { return tree },
    async accept(file) { context.__handlers.acceptFile(file); h.render() },
    async start() { await context.__handlers.handleStart(); h.render() },
  }
  h.render()
  return h
}
const snapshot = tree => JSON.stringify(tree, (k, v) => (typeof v === 'function' ? '[fn]' : v))
const DIALOG_FILES = [
  { name: 'Tidewell-QBR-master-2026.pptx', size: 19293798 }, { name: 'Q3-review.key', size: 4404019 }, { name: 'old.ppt', size: 2048 },
  { name: 'export.pdf', size: 2048 }, { name: 'macro.pptm', size: 2048 }, { name: 'empty.pptx', size: 0 }, { name: 'huge.pptx', size: 100 * 1024 * 1024 + 1 },
]
async function dialogTrace(code, env) {
  const parts = []
  for (const file of DIALOG_FILES) {
    const h = dialogHarness(code, env)
    parts.push(snapshot(h.tree))
    await h.accept(file)
    parts.push(snapshot(h.tree))
    await h.start()
    parts.push(snapshot(h.tree), JSON.stringify(h.events))
  }
  return parts
}
const dialogDigest = async (src, flag) => {
  const traces = []
  for (const env of [{}, { [SHELL]: 'true' }]) traces.push(...await dialogTrace(src.dialog, withFlag(env, flag)))
  return sha(traces.join('\n'))
}

// ---- the builder page is not changed at all: the workspace renders from the top bar's slot into the stage (a portal) ----------

// The flag-off goldens: digests over the base's renders (origin/studio-v4-dev-preparation-code at 1d5ebf0) with the flag unset.
// header: 512 states (and its slots, ignoring trailing empty ones); toolbar: 64 states (and every slot); Templates page: 2; dialog: 7 files x (open, choose, start) x 2 shell states.
const GOLDEN = {
  header: 'e0f80fc6ddb8358f06625bb05f5aa266be4d618e7d0ad294398495576be4a879',
  toolbar: '272c241a06f2cc3b7e003a10c72e23c90901b7ed7c33e3a77c5469397859716d',
  toolbarSlots: '6f5cf51d0147fd247d9809dd672678c4423bc23c7d11ef9fec4cd72c1530f5b6',
  headerSlots: '164207ad4daab139dfabad3829dce7f78ce1f6f3568dc5de157cc2d27ef2a061',
  templatesPage: '25af90501f04f034cbe5fc98a349117df4f4bf93a988ed635ec00533416764d3',
  dialog: '4b46969329d080b0c659b09a4a06efe24d2b4e406029d16572385df45149fdcb',
}

if (process.env.PRINT_GOLDEN) {
  console.log(JSON.stringify({
    header: headerDigest(SOURCES, undefined), toolbar: toolbarDigest(SOURCES, undefined), toolbarSlots: toolbarDigest(SOURCES, undefined, serialiseSlots), headerSlots: headerDigest(SOURCES, undefined, serialiseLeadingSlots), templatesPage: templatesPageDigest(SOURCES, undefined),
    dialog: await dialogDigest(SOURCES, undefined),
    states: { header: HEADER_MATRIX.length, toolbar: TOOLBAR_MATRIX.length, templatesPage: PAGE_ENVS.length, dialogFiles: DIALOG_FILES.length },
  }, null, 2))
  process.exit(0)
}

// The surface checks, as functions of the source texts, so the mutants below go through the very same checks.
const SURFACE_CHECKS = {
  header: src => { for (const flag of OFF_DIGEST_VALUES) assert.equal(headerDigest(src, flag), GOLDEN.header, `header, flag=${JSON.stringify(flag)}`) },
  toolbar: src => { for (const flag of OFF_DIGEST_VALUES) assert.equal(toolbarDigest(src, flag), GOLDEN.toolbar, `toolbar, flag=${JSON.stringify(flag)}`) },
  headerSlots: src => { for (const flag of OFF_DIGEST_VALUES) assert.equal(headerDigest(src, flag, serialiseLeadingSlots), GOLDEN.headerSlots, `header slots, flag=${JSON.stringify(flag)}`) },
  toolbarSlots: src => { for (const flag of OFF_DIGEST_VALUES) assert.equal(toolbarDigest(src, flag, serialiseSlots), GOLDEN.toolbarSlots, `toolbar slots, flag=${JSON.stringify(flag)}`) },
  templatesPage: src => {
    for (const flag of OFF_VALUES) assert.equal(templatesPageDigest(src, flag), GOLDEN.templatesPage, `Templates page, flag=${JSON.stringify(flag)}`)
  },
  dialog: async src => { for (const flag of OFF_DIGEST_VALUES) assert.equal(await dialogDigest(src, flag), GOLDEN.dialog, `dialog, flag=${JSON.stringify(flag)}`) },
  // Not pinned to the base's bytes (other work changes this page); what matters is that this feature adds nothing to it.
  // The one change the page carries (toolbar template picker fix-forward): it reads the flag once, to hand the composer library's action callback to the
  // picker and the dialog (see test-studio-toolbar-template-list.mjs). Those lines are set aside; nothing else may name the workspace.
  builderPage: src => { assert.doesNotMatch(src.builderPage.split('\n').filter(line => !/studioTemplateWorkspace|Toolbar template picker fix-forward/.test(line)).join('\n'), /studio-template-workspace|StudioTemplateWorkspace|NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE/) },
}

await run('flag off (unset, "false" or any non-"true" value): the builder header renders byte-for-byte as the base (512 states)', () => SURFACE_CHECKS.header(SOURCES))
await run('flag off: the toolbar (Template entry, Theme and the rest of the strip) renders byte-for-byte as the base (64 states)', () => SURFACE_CHECKS.toolbar(SOURCES))
await run('flag off: the header keeps every child slot where the base has it; its two new slots are the last of their lists, so no sibling (or id) moves', () => SURFACE_CHECKS.headerSlots(SOURCES))
await run('flag off: the toolbar keeps every child slot where the base has it (so React and Radix ids do not move)', () => SURFACE_CHECKS.toolbarSlots(SOURCES))
await run('flag off: the Templates page renders byte-for-byte as the base', () => SURFACE_CHECKS.templatesPage(SOURCES))
await run('flag off: the upload dialog renders and behaves byte-for-byte as the base (7 files: open, choose, upload; shell on and off)', () => SURFACE_CHECKS.dialog(SOURCES))
await run('the builder page itself is unchanged (the workspace renders from the top bar slot, into the stage)', () => SURFACE_CHECKS.builderPage(SOURCES))

// ---- flag on, on the same harnesses: the change is where the frames put it -----------------------------------------------
await run('flag on: the header gains the workspace heading and actions (and nothing else changes in the tree around them)', () => {
  const env = { [SHELL]: 'true', NEXT_PUBLIC_STUDIO_TOP_BAR_V2: 'true', [FLAG]: 'true' }
  const tree = renderHeader(SOURCES, { env, deckTitle: 'Deck' })
  assert.equal(findAll(tree, n => n.type === 'StudioTemplateWorkspaceHeading').length, 1)
  assert.equal(findAll(tree, n => n.type === 'StudioTemplateWorkspaceHeaderActions').length, 1)
  const strip = node => Array.isArray(node) ? node.map(strip)
    : node && typeof node === 'object' ? (/^StudioTemplateWorkspace/.test(String(node.type)) ? null : { ...node, children: strip(node.children) }) : node
  assert.equal(serialise(strip(tree)), serialise(renderHeader(SOURCES, { env: { [SHELL]: 'true', NEXT_PUBLIC_STUDIO_TOP_BAR_V2: 'true' }, deckTitle: 'Deck' })))
  const classic = renderHeader(SOURCES, { env: { [FLAG]: 'true' } })
  assert.equal(findAll(classic, n => /^StudioTemplateWorkspace/.test(String(n.type))).length, 0, 'never outside the Studio shell')
})
await run('flag on: Template ▾ (the picker) sits right after Theme, the old Template control is gone, and its props carry the old menu\'s actions', () => {
  const render = toolbarRenderer(SOURCES)
  for (const templateBuilderEnabled of BOOLS) for (const templateIngestEnabled of BOOLS) {
    const tree = render({ templateBuilderEnabled, templateIngestEnabled, env: { [SHELL]: 'true', [FLAG]: 'true' } })
    const pickers = findAll(tree, n => n.type === 'StudioTemplatePicker')
    assert.equal(pickers.length, 1)
    assert.equal(findAll(tree, n => n.props && n.props.title === 'Template options').length, 0, 'the old Template menu trigger is gone')
    assert.equal(findAll(tree, n => n.props && n.props.title === 'Templates — coming soon').length, 0)
    // the elements of the strip in order, with fragments flattened (what the DOM will hold)
    const flatten = list => list.flatMap(child => (child && typeof child === 'object' ? (child.type === FRAGMENT ? flatten(child.children) : [child]) : []))
    const strip = findAll(tree, n => Array.isArray(n.children) && flatten(n.children).includes(pickers[0]) && n.type !== FRAGMENT)[0]
    const siblings = flatten(strip.children)
    const at = siblings.indexOf(pickers[0])
    assert.equal(siblings[at - 1].props.title, 'Presentation theme', 'right after Theme')
    assert.equal(siblings[at + 1].props.className, 'mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700', 'then the divider, as before')
    assert.equal(typeof pickers[0].props.onUploadTemplate, templateIngestEnabled ? 'function' : 'undefined')
    assert.equal(pickers[0].props.templateMode === null, !templateBuilderEnabled)
  }
  const classic = render({ studioShell: false, env: { [FLAG]: 'true' } })
  assert.equal(findAll(classic, n => n.type === 'StudioTemplatePicker').length, 0, 'never outside the Studio shell')
})
await run('flag on: the Templates page adds the uploads card list beside the workspace, inside the account boundary', () => {
  const tree = renderTemplatesPage(SOURCES, { [SHELL]: 'true', [FLAG]: 'true' })
  assert.equal(tree.type, 'StudioLibraryAccountBoundary')
  assert.deepEqual(tree.children.map(child => child.type), ['TemplatesWorkspace', 'StudioTemplateWorkspaceLibrary'])
})
await run('flag on: the dialog takes .pptx only, refuses other files in plain words and stays open, and stages the workspace handoff', async () => {
  const env = { [SHELL]: 'true', [FLAG]: 'true' }
  const text = node => (node === null || node === undefined || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children))
  const keynote = dialogHarness(SOURCES.dialog, env)
  await keynote.accept({ name: 'Q3-review.key', size: 4404019 })
  assert.match(text(keynote.tree), /This is a Keynote file\. Export it as PowerPoint \(\.pptx\), then upload it again\./)
  assert.match(text(keynote.tree), /Choose another file/)
  await keynote.start()
  assert.deepEqual(keynote.events, [], 'nothing uploaded, created or saved; the dialog did not close')
  for (const [name, reason] of [['old.ppt', /older PowerPoint file/], ['export.pdf', /A PDF can.t become a template/], ['macro.pptm', /has macros/], ['notes.txt', /isn.t a PowerPoint file/]]) {
    const h = dialogHarness(SOURCES.dialog, env)
    await h.accept({ name, size: 2048 })
    assert.match(text(h.tree), reason, name)
  }
  const ok = dialogHarness(SOURCES.dialog, env)
  assert.match(text(ok.tree), /Upload a template/)
  await ok.accept({ name: 'Tidewell-QBR-master-2026.pptx', size: 19293798 })
  await ok.start()
  const kinds = ok.events.map(event => event[0] === 'storage' ? `storage:${event[1]}` : event[0])
  assert.deepEqual(kinds, ['upload', 'create', 'storage:deckster_ingest_intent_<id>', 'storage:deckster_template_workspace_handoff_<id>', 'open', 'navigate'])
  assert.deepEqual(ok.events[3][2], { v: 1, file_name: 'Tidewell-QBR-master-2026.pptx', file_size: 19293798, created_at: '<time>' })
  assert.equal(ok.events.at(-1)[1], '/builder?session_id=offline-new-1', 'the same hard navigation to the new builder session')
})

// ---- the entry module and the mock switch --------------------------------------------------------------------------------
function entryExports(src, env) {
  const sourceFile = parse(FILES.entry, src.entry)
  const out = {}
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      const name = declaration.name.getText(sourceFile)
      if (!/^Studio/.test(name)) continue
      out[name] = compile(declaration.initializer.getText(sourceFile))({ process: { env }, dynamic: () => 'LAZY', Nothing: 'NOTHING', import: () => null })
    }
  }
  return out
}
const ENTRY_CHECK = src => {
  const names = ['StudioTemplateWorkspaceHeading', 'StudioTemplateWorkspaceHeaderActions', 'StudioTemplatePicker', 'StudioTemplateWorkspaceLibrary']
  for (const flag of OFF_VALUES) for (const shell of [undefined, 'true']) {
    const exports = entryExports(src, withFlag(shell ? { [SHELL]: shell } : {}, flag))
    assert.deepEqual(Object.keys(exports).sort(), [...names].sort())
    for (const name of names) assert.equal(exports[name], 'NOTHING', `${name} with flag=${JSON.stringify(flag)} shell=${shell}`)
  }
  for (const name of names) assert.equal(entryExports(src, { [FLAG]: 'true' })[name], 'NOTHING', `${name} needs the Studio shell`)
  for (const name of names) assert.equal(entryExports(src, { [SHELL]: 'true', [FLAG]: 'true' })[name], 'LAZY')
  // The bundler can only drop the lazy imports if each guard is the literal env comparison itself.
  const guards = src.entry.match(/process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true'\n\s+\? dynamic\(\(\) => import\('\.\/[a-z]+'\)/g) || []
  assert.equal(guards.length, names.length)
}
const MOCK_CHECK = src => {
  const at = src.adapter.indexOf("import('./mock-source')")
  assert.ok(at > 0, 'the mock is imported lazily')
  assert.equal(src.adapter.split("import('./mock-source')").length, 2, 'from one place')
  const guard = src.adapter.lastIndexOf("if (process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE_MOCK === 'true') {", at)
  assert.ok(guard > 0 && src.adapter.slice(guard, at).split('\n').length < 8, 'behind the literal build-time switch, right above it')
  assert.doesNotMatch(src.adapter, /from '\.\/mock-(source|deck)'/, 'never imported statically')
  for (const file of fs.readdirSync(path.join(repoRoot, 'components/studio-template-workspace'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(repoRoot, 'components/studio-template-workspace', file), 'utf8'), /mock-(source|deck)/, `${file} does not reach the mock`)
  }
}
await run('the entry module: with the flag off (any value but "true", or outside the Studio shell) every part is a component that renders nothing, and the lazy imports sit behind the literal flag checks', () => ENTRY_CHECK(SOURCES))
await run('the mock event source is dev/test only: one lazy import, behind the literal build-time switch; no component imports it', () => MOCK_CHECK(SOURCES))
await run('scope: the Director WebSocket hook is untouched and nothing here sends on it; the workspace has no new request of its own', () => {
  for (const file of ['lib/studio-template-workspace/adapter.ts', 'lib/studio-template-workspace/state.ts', 'lib/studio-template-workspace/contract.ts', 'lib/studio-template-workspace/registry.ts', 'lib/studio-template-workspace/mock-source.ts',
    ...fs.readdirSync(path.join(repoRoot, 'components/studio-template-workspace')).filter(f => f.endsWith('.tsx')).map(f => `components/studio-template-workspace/${f}`)]) {
    const text = fs.readFileSync(path.join(repoRoot, file), 'utf8')
    assert.doesNotMatch(text, /use-deckster-websocket|sendMessage\(|new WebSocket|fetch\(|XMLHttpRequest|localStorage/, file)
  }
})

// ---- mutants: each one must be caught by the checks above ------------------------------------------------------------------
const MUTANTS = [
  ['header: heading slot without its flag guard', 'header', s => s.replace("{process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' && <StudioTemplateWorkspaceHeading />}", '{<StudioTemplateWorkspaceHeading />}'), 'header'],
  ['header: actions slot without its flag guard', 'header', s => s.replace("{process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' && <StudioTemplateWorkspaceHeaderActions />}", '{<StudioTemplateWorkspaceHeaderActions />}'), 'header'],
  ['header: flag read as "not true"', 'header', s => s.replaceAll("NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true'", "NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE !== 'true'"), 'header'],
  ['header: the heading slot placed before the deck title (moves the siblings after it)', 'header', s => s.replace("{process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' && <StudioTemplateWorkspaceHeading />}\n", '').replace('<span title={deckTitle}', "{process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' && <StudioTemplateWorkspaceHeading />}<span title={deckTitle}"), 'headerSlots'],
  ['toolbar: old Template control suppressed regardless of the flag', 'viewer', s => s.replace("{studioShell && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' ? null : templateBuilderEnabled ? (", '{studioShell ? null : templateBuilderEnabled ? ('), 'toolbar'],
  ['toolbar: picker without its flag guard', 'viewer', s => s.replace("{studioShell && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' ? <>\n                {tabPausedWrap(<StudioTemplatePicker", '{studioShell ? <>\n                {tabPausedWrap(<StudioTemplatePicker'), 'toolbar'],
  ['Templates page: library without its flag guard', 'templatesPage', s => s.replace("if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true') {", 'if (true) {'), 'templatesPage'],
  ['dialog: the workspace flag ignores the shell', 'dialog', s => s.replace("const STUDIO_TEMPLATE_WORKSPACE = STUDIO_TEMPLATE_FLOW && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true'", 'const STUDIO_TEMPLATE_WORKSPACE = STUDIO_TEMPLATE_FLOW'), 'dialog'],
  ['dialog: .pptx-only check applied with the flag off', 'dialog', s => s.replace('(STUDIO_TEMPLATE_WORKSPACE ? templateWorkspaceFileProblem(candidate) : null) ?? validateIngestFile(candidate)', 'templateWorkspaceFileProblem(candidate) ?? validateIngestFile(candidate)'), 'dialog'],
  ['dialog: handoff staged with the flag off', 'dialog', s => s.replace('      if (STUDIO_TEMPLATE_WORKSPACE) {\n        // The workspace opens', '      if (true) {\n        // The workspace opens'), 'dialog'],
  ['dialog: the title swapped', 'dialog', s => s.replace("{STUDIO_TEMPLATE_WORKSPACE ? 'Upload a template' : 'Upload presentation'}", "{STUDIO_TEMPLATE_WORKSPACE ? 'Upload presentation' : 'Upload a template'}"), 'dialog'],
  ['dialog: the help text swapped', 'dialog', s => s.replace("{STUDIO_TEMPLATE_WORKSPACE ? 'The template workspace opens as soon as the file is uploaded: your deck as-is first, then each slide locks in while you browse.' : 'Upload this file, then continue conversion in a new Builder conversation.'}", "{'The template workspace opens as soon as the file is uploaded: your deck as-is first, then each slide locks in while you browse.'}"), 'dialog'],
  ['builder page: a mount added', 'builderPage', s => s.replace('{/* Main Content */}', "{/* Main Content */}{process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' && <StudioTemplateWorkspaceHost />}"), 'builderPage'],
  ['toolbar: the picker given its own slot (shifts every later sibling, and their ids)', 'viewer', s => s.replace("{studioShell && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' ? <>\n                {tabPausedWrap(<StudioTemplatePicker", "{studioShell && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' && null}{studioShell && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true' ? <>\n                {tabPausedWrap(<StudioTemplatePicker"), 'toolbarSlots'],
  ['entry: one part not behind the flag', 'entry', s => s.replace("export const StudioTemplatePicker: ComponentType<StudioTemplatePickerProps> =\n  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true'", "export const StudioTemplatePicker: ComponentType<StudioTemplatePickerProps> =\n  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'"), 'entry'],
  ['adapter: the mock without its build-time switch', 'adapter', s => s.replace("if (process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE_MOCK === 'true') {", 'if (true) {'), 'mock'],
]
await run(`mutants: each of ${MUTANTS.length} in-memory mutants of the change is caught`, async () => {
  const checks = { ...SURFACE_CHECKS, entry: ENTRY_CHECK, mock: MOCK_CHECK }
  for (const [name, key, mutate, check] of MUTANTS) {
    const mutated = mutate(SOURCES[key])
    assert.notEqual(mutated, SOURCES[key], `mutant applies: ${name}`)
    let caught = false
    try { await checks[check]({ ...SOURCES, [key]: mutated }) } catch { caught = true }
    assert.ok(caught, `mutant caught: ${name}`)
  }
})

// ══ 1. THE STATE MACHINE, THE CONTRACT, THE MOCK, THE STORE, THE REGISTRY ══════════════════════════════════════════════════
const plain = value => (value === undefined ? value : JSON.parse(JSON.stringify(value)))
const deq = (actual, expected, message) => assert.deepEqual(plain(actual), plain(expected), message)
const storage = memoryStorage()
const libFor = loadLib(repoRoot, { window: { sessionStorage: storage } })
const C = libFor('contract.ts')
const S = libFor('state.ts')
const M = libFor('mock-source.ts')
const A = libFor('adapter.ts')
const R = libFor('registry.ts')
const J = 'job-1'
const ev = (type, fields = {}) => C.normaliseTemplateWorkspaceEvent({ type, job_id: J, ...fields })
const asIs = (slide_count = 4, extra = {}) => ev('as_is_ready', { template_id: 't1', template_name: 'Tidewell QBR master', presentation_id: 'p1', viewer_url: 'https://layout.invalid/p/p1', slide_count, element_count: 20, changes: [{ slide_index: null, text: 'Fonts swapped.' }], use_original: 'available', ...extra })
const reduce = (events, state = S.initialTemplateWorkspaceState(J)) => events.reduce((acc, event) => { assert.ok(event, 'every event is valid'); return S.reduceTemplateWorkspace(acc, event) }, state)
const states = state => Array.from({ length: state.slideCount ?? 0 }, (_, i) => S.slideStateOf(state, i)[0]).join('')
const ready = (extra = {}) => ev('template_ready', { template_id: 't1', capabilities: { use_original: 'available', new_topic: 'available' }, layouts: { count: 3, representatives: [{ layout_id: 'title', label: 'Title', slide_index: 0 }] }, ...extra })

await run('contract: every event type validates; malformed events (no job, wrong types, negative or fractional counts, unknown type, done > count) are rejected; extra fields are dropped', () => {
  deq([...C.TEMPLATE_WORKSPACE_EVENT_TYPES].sort(), ['as_is_ready', 'failed', 'paused', 'slide_analysed', 'slide_analysing', 'slide_locked', 'slide_unlockable', 'slides_done', 'stage', 'template_ready'])
  assert.ok(asIs()); assert.ok(ready()); assert.ok(ev('stage', { stage: 'placing', slides_converted: 3, slide_count: 30 }))
  assert.ok(ev('slide_analysing', { slide_index: 0, fixed: [{ element_id: 'e1', role: 'Logo', policy: 'fixed' }] }))
  assert.ok(ev('slide_unlockable', { slide_index: 2, reason_code: 'x', reason: 'Plain words.' }))
  assert.ok(ev('paused', { reason_code: 'daily_budget', reason: 'Budget.', retryable: true }))
  for (const raw of [null, 'x', [], { type: 'stage', stage: 'placing' }, { job_id: J, type: 'nope' }, { job_id: J, type: 'stage', stage: 'baking' },
    { job_id: J, type: 'slide_locked', slide_index: -1 }, { job_id: J, type: 'slide_locked', slide_index: 1.5 }, { job_id: J, type: 'slide_locked', slide_index: '1' },
    { job_id: J, type: 'slides_done', slides_done: 5, slide_count: 4 }, { job_id: J, type: 'slides_done', slides_done: 1, slide_count: 0 },
    { job_id: J, type: 'paused', reason_code: 'x', reason: 'y' }, { job_id: J, type: 'failed', reason_code: 'x', reason: '', retryable: false },
    { job_id: J, type: 'as_is_ready', template_id: 't', template_name: 'n', presentation_id: 'p', viewer_url: 'u', slide_count: 3, element_count: 1, changes: [], use_original: 'maybe' },
    { job_id: J, type: 'template_ready', template_id: 't', capabilities: { use_original: 'available', new_topic: 'soon' }, layouts: { count: 1 } },
    { job_id: J, type: 'slide_locked', slide_index: 0, seq: 'x' }]) {
    assert.equal(C.normaliseTemplateWorkspaceEvent(raw), null, JSON.stringify(raw))
  }
  deq(C.normaliseTemplateWorkspaceEvent({ type: 'slide_locked', job_id: J, slide_index: 2, layout_id: 'kpi', secret: 'x', seq: 4 }), { job_id: J, seq: 4, type: 'slide_locked', slide_index: 2, layout_id: 'kpi' })
  const roles = C.normaliseTemplateWorkspaceEvent({ type: 'slide_analysed', job_id: J, slide_index: 0, roles: [{ element_id: 'e', role: 'Title', policy: 'fillable' }, { element_id: 'e2', role: 'X', policy: 'weird' }, 'junk'] })
  deq(roles.roles, [{ element_id: 'e', role: 'Title', policy: 'fillable' }], 'bad roles inside a good event are dropped, the event kept')
})

await run('state: the happy sequence: converting -> as-is ready (locking) -> per-slide analysing / analysed / locked -> template ready', () => {
  let s = reduce([ev('stage', { stage: 'converting', slide_count: 4 }), ev('stage', { stage: 'placing', slides_converted: 2, slide_count: 4 })])
  assert.equal(s.status, 'converting'); assert.equal(s.slidesConverted, 2)
  assert.equal(S.templateWorkspacePill(s).label, 'Converting: 2/4')
  s = reduce([asIs()], s)
  assert.equal(s.status, 'locking'); assert.equal(states(s), 'qqqq'); assert.equal(S.templateWorkspacePill(s).label, 'Locking template: 0/4')
  deq(S.templateCapabilities(s), { reuseAsIs: true, newTopic: false }, 'reuse as-is works from as-is ready')
  s = reduce([ev('slide_analysing', { slide_index: 0 }), ev('slide_analysing', { slide_index: 1 }), ev('slide_analysed', { slide_index: 0, roles: [] })], s)
  assert.equal(states(s), 'aaqq')
  s = reduce([ev('slide_locked', { slide_index: 0 }), ev('slides_done', { slides_done: 1, slide_count: 4, eta_seconds: 130 })], s)
  assert.equal(states(s), 'laqq'); assert.equal(S.templateWorkspacePill(s).label, 'Locking template: 1/4'); assert.equal(S.templateWorkspacePill(s).eta, 'about 2 min left')
  deq(S.templateWorkspacePill(s).ticks, ['l', 'a', 'q', 'q'])
  s = reduce([ready()], s)
  assert.equal(s.status, 'ready'); assert.equal(states(s), 'llll', 'ready means every slide is done')
  assert.equal(S.templateWorkspacePill(s).label, 'Template ready · 4/4'); assert.equal(S.templateReadySummary(s), '4 of 4 slides locked')
  deq(S.templateCapabilities(s), { reuseAsIs: true, newTopic: true })
})

await run('state: duplicates change nothing (the same state object comes back), so replaying a stream after leaving and returning is safe', () => {
  const events = [asIs(), ev('slide_analysing', { slide_index: 0 }), ev('slide_locked', { slide_index: 0 }), ev('slides_done', { slides_done: 1, slide_count: 4, eta_seconds: 60 }),
    ev('paused', { reason_code: 'b', reason: 'Budget.', retryable: true }), ready()]
  let s = S.initialTemplateWorkspaceState(J)
  for (const event of events) { const next = S.reduceTemplateWorkspace(s, event); assert.equal(S.reduceTemplateWorkspace(next, event), next, `duplicate ${event.type}`); s = next }
  // leave and return: the source replays everything from the start
  for (let cut = 0; cut <= events.length; cut++) deq(reduce([...events.slice(0, cut), ...events]), reduce(events), `replay after ${cut}`)
})

await run('state: per-slide states never go backwards (late analysing after locked, analysed after locked); a kept-as-is slide may still lock; a locked one never becomes kept-as-is', () => {
  let s = reduce([asIs(), ev('slide_locked', { slide_index: 1 }), ev('slide_analysing', { slide_index: 1 }), ev('slide_analysed', { slide_index: 1, roles: [] })])
  assert.equal(states(s), 'qlqq')
  s = reduce([ev('slide_unlockable', { slide_index: 2, reason_code: 'chart', reason: 'Kept.' }), ev('slide_analysing', { slide_index: 2 })], s)
  assert.equal(states(s), 'qluq'); assert.equal(s.slides[2].reason.text, 'Kept.')
  s = reduce([ev('slide_locked', { slide_index: 2 })], s)
  assert.equal(states(s), 'qllq', 'retry succeeded'); assert.equal(s.slides[2].reason, undefined)
  s = reduce([ev('slide_unlockable', { slide_index: 1, reason_code: 'x', reason: 'Late.' })], s)
  assert.equal(states(s), 'qllq')
})

await run('state: out of order: slide events before as_is_ready are kept; as_is_ready then fixes the count and drops slides out of range; later out-of-range events are ignored', () => {
  let s = reduce([ev('slide_analysing', { slide_index: 0 }), ev('slide_locked', { slide_index: 9 }), ev('slides_done', { slides_done: 1, slide_count: 10 })])
  assert.equal(s.status, 'converting'); assert.equal(s.slides[9].state, 'locked')
  s = reduce([asIs(4)], s)
  assert.equal(s.status, 'locking'); assert.equal(s.slideCount, 4); assert.equal(s.slides[9], undefined); assert.equal(states(s), 'aqqq')
  assert.equal(S.reduceTemplateWorkspace(s, ev('slide_locked', { slide_index: 4 })), s)
  // a late stage event after as-is changes nothing
  assert.equal(S.reduceTemplateWorkspace(s, ev('stage', { stage: 'converting', slide_count: 4 })), s)
  // template_ready before as_is_ready: ready stays, the deck still arrives
  const early = reduce([ready(), asIs(4)])
  assert.equal(early.status, 'ready'); assert.ok(early.deck)
})

await run('state: pause and resume, failure, late status events by seq; "ready" is final', () => {
  const base = reduce([asIs(4, { seq: 1 }), ev('slide_analysing', { slide_index: 0, seq: 2 }), ev('slide_locked', { slide_index: 0, seq: 3 })])
  let s = reduce([ev('paused', { reason_code: 'daily_budget', reason: 'Budget used up.', retryable: true, seq: 10 })], base)
  assert.equal(s.status, 'paused'); assert.equal(S.templateWorkspacePill(s).tone, 'warn'); assert.equal(S.templateWorkspacePill(s).label, 'Locking paused: 1/4')
  assert.equal(S.reduceTemplateWorkspace(s, ev('slide_analysing', { slide_index: 1, seq: 9 })).status, 'paused', 'a late (lower seq) slide event does not resume')
  assert.equal(S.reduceTemplateWorkspace(s, ev('slide_analysing', { slide_index: 1, seq: 11 })).status, 'locking', 'work moving on with a higher seq resumes')
  // a late pause (seq lower than the last status change) is ignored
  const resumed = S.reduceTemplateWorkspace(s, ev('slide_analysing', { slide_index: 1, seq: 11 }))
  assert.equal(S.reduceTemplateWorkspace(resumed, ev('paused', { reason_code: 'x', reason: 'Old.', retryable: true, seq: 10 })), resumed)
  // without seq: only a slide that starts analysing resumes; an analysed/locked result that lands late does not
  let n = reduce([asIs(4), ev('slide_analysing', { slide_index: 0 }), ev('paused', { reason_code: 'b', reason: 'B.', retryable: true })])
  assert.equal(S.reduceTemplateWorkspace(n, ev('slide_locked', { slide_index: 0 })).status, 'paused')
  assert.equal(S.reduceTemplateWorkspace(n, ev('slide_analysing', { slide_index: 0 })), n, 'a duplicate start does not resume')
  assert.equal(S.reduceTemplateWorkspace(n, ev('slide_analysing', { slide_index: 1 })).status, 'locking')
  // failure: before as-is there is nothing usable; after it the as-is deck stays usable
  const early = reduce([ev('stage', { stage: 'converting' }), ev('failed', { reason_code: 'unreadable', reason: 'Damaged.', retryable: false })])
  assert.equal(early.status, 'failed'); assert.equal(S.templateWorkspacePill(early).label, 'Conversion stopped'); assert.equal(S.templateCapabilities(early).reuseAsIs, false)
  const late = reduce([ev('failed', { reason_code: 'svc', reason: 'Service.', retryable: true })], base)
  assert.equal(late.status, 'failed'); assert.equal(S.templateWorkspacePill(late).label, 'Locking stopped: 1/4'); assert.equal(S.templateCapabilities(late).reuseAsIs, true)
  assert.equal(S.reduceTemplateWorkspace(late, ev('paused', { reason_code: 'b', reason: 'B.', retryable: true })), late, 'a pause does not replace a failure')
  // ready is final
  const done = reduce([ready()], base)
  for (const event of [ev('paused', { reason_code: 'b', reason: 'B.', retryable: true }), ev('failed', { reason_code: 'f', reason: 'F.', retryable: false }), ready()]) assert.equal(S.reduceTemplateWorkspace(done, event), done)
})

await run('state: events for another job are ignored; progress never goes backwards; the time left follows the latest estimate that is not late', () => {
  let s = reduce([asIs(4)])
  assert.equal(S.reduceTemplateWorkspace(s, C.normaliseTemplateWorkspaceEvent({ type: 'slide_locked', job_id: 'other-job', slide_index: 0 })), s)
  s = reduce([ev('slides_done', { slides_done: 3, slide_count: 4, eta_seconds: 30 }), ev('slides_done', { slides_done: 2, slide_count: 4, eta_seconds: 300 })], s)
  assert.equal(s.slidesDone, 3); assert.equal(s.etaSeconds, 300, 'no seq: arrival order')
  let q = reduce([asIs(4, { seq: 1 }), ev('slides_done', { slides_done: 2, slide_count: 4, eta_seconds: 40, seq: 8 }), ev('slides_done', { slides_done: 1, slide_count: 4, eta_seconds: 400, seq: 5 })])
  assert.equal(q.slidesDone, 2); assert.equal(q.etaSeconds, 40, 'with seq: a late estimate is ignored')
  assert.equal(S.templateEtaLabel(null), null); assert.equal(S.templateEtaLabel(20), 'less than a minute left'); assert.equal(S.templateEtaLabel(130), 'about 2 min left'); assert.equal(S.templateEtaLabel(720), 'about 12 min left')
})

await run('state: the 120-slide cap (PK, Q10): 120 is fine and "long" (Notify me first from 60); 121+ is refused, from the stage count or as-is, and nothing after it applies', () => {
  assert.equal(C.TEMPLATE_WORKSPACE_SLIDE_CAP, 120); assert.equal(C.TEMPLATE_WORKSPACE_LONG_DECK_SLIDES, 60); assert.equal(C.TEMPLATE_WORKSPACE_PARALLEL_SLIDES, 3)
  assert.equal(reduce([asIs(120)]).status, 'locking'); assert.equal(S.isLongDeck(120), true); assert.equal(S.isLongDeck(59), false); assert.equal(S.isLongDeck(60), true); assert.equal(S.isLongDeck(121), false)
  const refused = reduce([asIs(121)])
  assert.equal(refused.status, 'refused'); assert.match(refused.problem.text, /121 slides\. A template can have up to 120/)
  assert.equal(S.templateWorkspacePill(refused).label, 'Too many slides'); assert.equal(S.templateCapabilities(refused).reuseAsIs, false)
  for (const event of [ev('slide_analysing', { slide_index: 0 }), ready(), ev('slides_done', { slides_done: 1, slide_count: 121 })]) assert.equal(S.reduceTemplateWorkspace(refused, event), refused)
  assert.equal(reduce([ev('stage', { stage: 'converting', slide_count: 140 })]).status, 'refused')
})

await run('state: kept-as-is reads "29 of 30 locked · 1 kept as-is", never a bare "ready"', () => {
  const events = [asIs(3), ev('slide_locked', { slide_index: 0 }), ev('slide_unlockable', { slide_index: 1, reason_code: 'c', reason: 'Kept.' }), ev('slide_locked', { slide_index: 2 }), ready()]
  const s = reduce(events)
  assert.equal(S.templateReadySummary(s), '2 of 3 locked · 1 kept as-is'); assert.equal(S.templateWorkspacePill(s).label, 'Template ready · 2/3 · 1 kept as-is')
  deq(S.templateWorkspacePill(s).ticks, ['l', 'w', 'l'])
})

await run('mock source: deterministic (same record + config = same timeline), seq strictly increasing, times in order, every event valid; each scenario ends where it should', () => {
  const record = { session_id: 's1', file_name: 'Tidewell-QBR-master-2026.pptx', created_at: 1_000_000 }
  const expected = { happy: ['ready', 'llllllllllllllllllllllllllllll'], unlockable: ['ready', 'lllllllllullllllllllllllllllll'], paused: ['paused', null], failed: ['failed', null],
    failed_convert: ['failed', null], long: ['ready', null], over_cap: ['refused', null] }
  for (const [scenario, [status, slideStates]] of Object.entries(expected)) for (const pace of ['demo', 'real']) {
    const config = { scenario, pace, slides: scenario === 'long' ? 120 : scenario === 'over_cap' ? 140 : 30 }
    const a = M.buildTemplateMockTimeline(record, config), b = M.buildTemplateMockTimeline(record, config)
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${scenario}/${pace} deterministic`)
    a.forEach((item, i) => { assert.ok(C.normaliseTemplateWorkspaceEvent(item.event), `${scenario} event ${i} valid`); if (i) { assert.ok(item.at >= a[i - 1].at); assert.ok(item.event.seq > a[i - 1].event.seq) } })
    const s = reduce(a.map(item => C.normaliseTemplateWorkspaceEvent(item.event)), S.initialTemplateWorkspaceState('mock-s1'))
    assert.equal(s.status, status, `${scenario}/${pace}`)
    if (slideStates) assert.equal(states(s), slideStates)
    // at most three slides analyse at once (PK, Q8)
    let peak = 0, cur = S.initialTemplateWorkspaceState('mock-s1')
    for (const item of a) { cur = S.reduceTemplateWorkspace(cur, C.normaliseTemplateWorkspaceEvent(item.event)); if (cur.status === 'locking') peak = Math.max(peak, S.templateWorkspaceCounts(cur).analysing) }
    assert.ok(peak <= 3, `${scenario}: ${peak} analysing at once`)
    if (scenario === 'happy') assert.equal(peak, 3)
  }
  // real pace follows the frames: as-is at 58 s, about 4 min 40 s of locking for 30 slides, "Locking template: 18/30 · about 2 min left"
  const real = M.buildTemplateMockTimeline(record, { scenario: 'happy', pace: 'real', slides: 30 })
  assert.equal(real.find(item => item.event.type === 'as_is_ready').at - record.created_at, 58_000)
  const lockingMs = real.at(-1).at - real.find(item => item.event.type === 'as_is_ready').at
  assert.ok(lockingMs > 4.5 * 60_000 && lockingMs < 5 * 60_000, `${lockingMs} ms of locking`)
  let s = S.initialTemplateWorkspaceState('mock-s1')
  for (const item of real) { s = S.reduceTemplateWorkspace(s, C.normaliseTemplateWorkspaceEvent(item.event)); if (S.templateWorkspaceCounts(s).done === 18) break }
  assert.equal(S.templateWorkspacePill(s).label, 'Locking template: 18/30'); assert.equal(S.templateWorkspacePill(s).eta, 'about 2 min left')
  // "Finish now": the paused timeline, resumed, finishes; events seen before the pause keep their seq, so a replay is a duplicate
  const paused = M.buildTemplateMockTimeline(record, { scenario: 'paused', pace: 'demo', slides: 30 })
  const pausedAt = paused.find(item => item.event.type === 'paused').at
  const resumed = M.buildTemplateMockTimeline(record, { scenario: 'paused', pace: 'demo', slides: 30 }, pausedAt + 5000)
  const before = list => JSON.stringify(list.filter(item => item.at <= pausedAt && item.event.type !== 'slides_done'))
  assert.equal(before(resumed), before(paused), 'the same events, times and seq up to the pause')
  assert.ok(resumed.filter(item => item.at > pausedAt).every(item => item.event.seq > paused.find(p => p.event.type === 'paused').event.seq), 'everything after it is newer')
  let r = S.initialTemplateWorkspaceState('mock-s1')
  for (const item of [...paused, ...resumed]) r = S.reduceTemplateWorkspace(r, C.normaliseTemplateWorkspaceEvent(item.event))
  assert.equal(r.status, 'ready', 'paused, then Finish now, then ready')
  assert.equal(M.mockTemplateName('Tidewell-QBR-master-2026.pptx'), 'Tidewell QBR master')
})

await run('mock source: per-upload config; the leave-and-return replay through the adapter store lands on the same state as a straight run', async () => {
  storage.setItem(M.TEMPLATE_MOCK_CONFIG_KEY, JSON.stringify({ scenario: 'happy', pace: 'demo', sessions: { s2: { scenario: 'paused', slides: 18 } } }))
  deq(M.readTemplateMockConfig('s1'), { scenario: 'happy', pace: 'demo', slides: 30 })
  deq(M.readTemplateMockConfig('s2'), { scenario: 'paused', pace: 'demo', slides: 18 })
  const record = { v: 1, session_id: 's1', file_name: 'Tidewell-QBR-master-2026.pptx', file_size: 1, created_at: Date.now() - 20_000 }
  const store = new A.TemplateWorkspaceStore(record, M.createMockTemplateWorkspaceSource(record, 'u'))
  let notified = 0
  const off = store.subscribe(() => { notified += 1 })
  const first = store.getSnapshot()
  assert.equal(first.state.jobId, 'mock-s1'); assert.equal(first.state.status, 'locking'); assert.ok(notified > 0)
  assert.equal(first.fixture.slideLabel(0), 'Title'); assert.match(first.fixture.slideHtml(0), /data-el-id="s1-e1" data-el="Logo\|Logo\|fixed"/)
  // the source replays from the start (leave and come back, a reload): every event already seen is a duplicate
  for (const item of M.buildTemplateMockTimeline(record, M.readTemplateMockConfig('s1')).filter(item => item.at <= Date.now() - 1000)) store.receive(item.event)
  assert.equal(store.getSnapshot().state, first.state, 'the replay changes nothing')
  // a fresh store (a new page) on the same upload lands on the same state
  const fresh = new A.TemplateWorkspaceStore(record, M.createMockTemplateWorkspaceSource(record, 'u'))
  const offFresh = fresh.subscribe(() => {})
  deq(S.templateWorkspaceCounts(fresh.getSnapshot().state), S.templateWorkspaceCounts(store.getSnapshot().state))
  assert.equal(fresh.getSnapshot().state.status, first.state.status)
  off(); offFresh()
  storage.removeItem(M.TEMPLATE_MOCK_CONFIG_KEY)
})

await run('adapter store: every event goes through validation; invalid ones are counted and dropped; the first job is followed and others ignored; listeners fire only on change', () => {
  let emit
  const store = new A.TemplateWorkspaceStore({ v: 1, session_id: 's', file_name: 'f.pptx', file_size: 1, created_at: 0 }, { kind: 'director', subscribe: e => { emit = e; return () => {} }, commands: {} })
  let calls = 0
  store.subscribe(() => { calls += 1 })
  emit({ type: 'slide_locked', slide_index: 0 })
  assert.equal(store.dropped, 1); assert.equal(calls, 0)
  emit({ type: 'as_is_ready', job_id: 'J1', template_id: 't', template_name: 'n', presentation_id: 'p', viewer_url: 'u', slide_count: 2, element_count: 1, changes: [], use_original: 'available' })
  assert.equal(store.getSnapshot().state.jobId, 'J1'); assert.equal(calls, 1)
  emit({ type: 'slide_locked', job_id: 'J2', slide_index: 0 })
  assert.equal(S.slideStateOf(store.getSnapshot().state, 0), 'queued'); assert.equal(store.dropped, 2); assert.equal(calls, 1)
  emit({ type: 'slide_locked', job_id: 'J1', slide_index: 0 }); emit({ type: 'slide_locked', job_id: 'J1', slide_index: 0 })
  assert.equal(calls, 2, 'the duplicate does not notify')
  const director = A.createDirectorJobSource({ session_id: 's' })
  assert.equal(director.kind, 'director'); deq(director.commands, {}, 'no commands until Director exposes them (controls stay hidden)')
})

await run('registry: the dialog\'s handoff is adopted once, per account; malformed handoffs are ignored; records update; names come from the file', () => {
  const box = memoryStorage()
  const reg = loadLib(repoRoot, { window: { sessionStorage: box } })('registry.ts')
  box.setItem(`${reg.TEMPLATE_WORKSPACE_HANDOFF_PREFIX}s1`, JSON.stringify({ v: 1, file_name: 'Tidewell-QBR-master-2026.pptx', file_size: 9, created_at: 5 }))
  const record = reg.adoptTemplateWorkspaceHandoff('user-a', 's1')
  deq(record, { v: 1, session_id: 's1', file_name: 'Tidewell-QBR-master-2026.pptx', file_size: 9, created_at: 5 })
  assert.equal(box.getItem(`${reg.TEMPLATE_WORKSPACE_HANDOFF_PREFIX}s1`), null, 'the handoff is consumed')
  deq(reg.adoptTemplateWorkspaceHandoff('user-a', 's1'), record, 'the record stays')
  deq(reg.readTemplateWorkspaceRecords('user-b'), [], 'another account sees nothing')
  box.setItem(`${reg.TEMPLATE_WORKSPACE_HANDOFF_PREFIX}s2`, '{"v":1,"file_name":5}')
  assert.equal(reg.adoptTemplateWorkspaceHandoff('user-a', 's2'), null)
  reg.updateTemplateWorkspaceRecord('user-a', 's1', { ready_seen: true })
  assert.equal(reg.readTemplateWorkspaceRecords('user-a')[0].ready_seen, true)
  assert.equal(reg.templateNameFromFile('Tidewell-QBR-master-2026.pptx'), 'Tidewell QBR master 2026')
})

console.log(`PASS: studio template workspace (${testCount} tests, ${MUTANTS.length} mutants caught)`)
